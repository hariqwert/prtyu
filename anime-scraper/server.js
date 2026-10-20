const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ScraperEngine = require('./lib/scraper-engine');
const StorageManager = require('./lib/storage-manager');

const PORT = process.env.PORT || 3050;
const baseDir = __dirname;
const engine = new ScraperEngine({ baseDir });
const storage = new StorageManager(baseDir);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.m3u': 'application/x-mpegURL; charset=utf-8',
    '.m3u8': 'application/vnd.apple.mpegurl; charset=utf-8'
};

// Set CORS headers helper
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

// Serve static file helper
function serveStaticFile(req, res, filePath) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}

// Transparent HLS CORS Proxy to bypass CDN origin restrictions in web browsers
async function handleHlsProxy(req, res, targetUrl) {
    setCorsHeaders(res);
    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing target URL');
        return;
    }

    try {
        const parsedTarget = new URL(targetUrl);
        const origin = parsedTarget.origin;

        const upstreamRes = await fetch(targetUrl, {
            headers: {
                'Referer': `${origin}/`,
                'User-Agent': storage.config.userAgent || 'Mozilla/5.0'
            }
        });

        if (!upstreamRes.ok) {
            res.writeHead(upstreamRes.status, { 'Content-Type': 'text/plain' });
            res.end(`Upstream error: HTTP ${upstreamRes.status}`);
            return;
        }

        const contentType = upstreamRes.headers.get('content-type') || '';
        const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('/hls/') || contentType.includes('mpegurl');

        if (isPlaylist) {
            const playlistText = await upstreamRes.text();
            
            // Rewrite relative & absolute URLs inside the playlist to route back through this proxy
            const rewrittenLines = playlistText.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    // Check for URI="..." in tags like #EXT-X-MEDIA:TYPE=AUDIO
                    if (trimmed.includes('URI="')) {
                        return trimmed.replace(/URI="([^"]+)"/g, (m, u) => {
                            const absUrl = u.startsWith('http') ? u : new URL(u, targetUrl).toString();
                            return `URI="/api/proxy?url=${encodeURIComponent(absUrl)}"`;
                        });
                    }
                    return line;
                }

                // Media or Sub-playlist URI
                const absUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, targetUrl).toString();
                return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
            });

            res.writeHead(200, {
                'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                'Cache-Control': 'no-cache'
            });
            res.end(rewrittenLines.join('\n'));
        } else {
            // Binary segment stream (video/audio/ts)
            res.writeHead(200, {
                'Content-Type': contentType || 'video/MP2T',
                'Cache-Control': 'public, max-age=3600'
            });
            const buffer = Buffer.from(await upstreamRes.arrayBuffer());
            res.end(buffer);
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${err.message}`);
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- Static Web Assets ---
    if (pathname === '/' || pathname === '/index.html') {
        serveStaticFile(req, res, path.join(baseDir, 'public', 'index.html'));
        return;
    }
    if (pathname.startsWith('/public/')) {
        const relativePath = pathname.replace(/^\/public\//, '');
        const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        serveStaticFile(req, res, path.join(baseDir, 'public', safePath));
        return;
    }

    // --- API: Get Catalog ---
    if (pathname === '/api/catalog' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(storage.getCatalog()));
        return;
    }

    // --- API: Get Season Episodes ---
    if (pathname === '/api/episodes' && req.method === 'GET') {
        const animeSlug = parsedUrl.query.anime;
        const seasonSlug = parsedUrl.query.season;
        if (!animeSlug || !seasonSlug) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing anime or season parameter' }));
            return;
        }

        const metadata = storage.loadMetadata(animeSlug, seasonSlug);
        if (!metadata) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Season metadata not found' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metadata));
        return;
    }

    // --- API: Download or View Playlist ---
    if (pathname === '/api/playlist' && req.method === 'GET') {
        const animeSlug = parsedUrl.query.anime;
        const seasonSlug = parsedUrl.query.season;
        if (!animeSlug) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing anime parameter');
            return;
        }

        const playlistDir = storage.getPlaylistDir(animeSlug);
        const filename = seasonSlug ? `${storage.sanitizeSlug(seasonSlug)}.m3u` : 'all-seasons.m3u';
        const filePath = path.join(playlistDir, filename);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Playlist not found');
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'application/x-mpegURL',
            'Content-Disposition': `inline; filename="${filename}"`
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // --- API: MyAnimeList Search (with English Title Resolution) ---
    if (pathname === '/api/mal/search' && req.method === 'GET') {
        const query = parsedUrl.query.q;
        if (!query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Query parameter q is required' }));
            return;
        }

        try {
            const malUrl = `https://myanimelist.net/search/prefix.json?type=anime&keyword=${encodeURIComponent(query)}&v=1`;
            const kitsuUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=12`;

            const [malRes, kitsuRes] = await Promise.allSettled([
                fetch(malUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }),
                fetch(kitsuUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            ]);

            let kitsuMap = new Map();
            const cleanKey = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            if (kitsuRes.status === 'fulfilled' && kitsuRes.value.ok) {
                try {
                    const kData = await kitsuRes.value.json();
                    for (const k of (kData.data || [])) {
                        const attr = k.attributes || {};
                        const eng = attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp;
                        if (eng) {
                            if (attr.canonicalTitle) kitsuMap.set(cleanKey(attr.canonicalTitle), eng);
                            if (attr.titles?.en_jp) kitsuMap.set(cleanKey(attr.titles.en_jp), eng);
                            if (attr.titles?.ja_jp) kitsuMap.set(cleanKey(attr.titles.ja_jp), eng);
                            if (attr.titles?.en) kitsuMap.set(cleanKey(attr.titles.en), eng);
                        }
                    }
                } catch (e) {}
            }

            let results = [];
            if (malRes.status === 'fulfilled' && malRes.value.ok) {
                const malData = await malRes.value.json();
                const items = (malData.categories && malData.categories[0] && malData.categories[0].items) || [];
                results = items.map(item => {
                    const key = cleanKey(item.name);
                    let englishTitle = kitsuMap.get(key);

                    // Fuzzy sub-string match if exact clean key not found
                    if (!englishTitle) {
                        for (const [k, v] of kitsuMap.entries()) {
                            if (k && (key.includes(k) || k.includes(key))) {
                                englishTitle = v;
                                break;
                            }
                        }
                    }

                    // Fallback to query if user searched in English and it matches context
                    if (!englishTitle && cleanKey(query).length > 3 && key.includes(cleanKey(query))) {
                        englishTitle = query;
                    }

                    const resolvedEnglish = englishTitle || item.name;

                    return {
                        id: item.id,
                        name: item.name,
                        english_name: resolvedEnglish,
                        display_name: resolvedEnglish !== item.name ? `${resolvedEnglish} (${item.name})` : item.name,
                        url: item.url,
                        image: item.image_url,
                        score: item.payload ? item.payload.score : null,
                        status: item.payload ? item.payload.status : '',
                        media_type: item.payload ? item.payload.media_type : '',
                        year: item.payload ? item.payload.start_year : null,
                        aired: item.payload ? item.payload.aired : ''
                    };
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: Discover Available Episodes with English Titles ---
    if (pathname === '/api/discover' && req.method === 'GET') {
        const targetUrl = parsedUrl.query.url;
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Target URL is required' }));
            return;
        }

        try {
            const discovery = await engine.discoverEpisodes(targetUrl);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(discovery));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: MyAnimeList User Watchlist ---
    if (pathname === '/api/mal/user' && req.method === 'GET') {
        const username = parsedUrl.query.username;
        const status = parsedUrl.query.status || '1'; // 1 = watching, 7 = all, 6 = plan to watch
        if (!username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username parameter is required' }));
            return;
        }

        try {
            const listUrl = `https://myanimelist.net/animelist/${encodeURIComponent(username)}/load.json?status=${status}&offset=0`;
            const malRes = await fetch(listUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!malRes.ok) throw new Error(`MAL User HTTP ${malRes.status}`);
            const listData = await malRes.json();
            const results = listData.slice(0, 50).map(item => ({
                id: item.anime_id,
                title: item.anime_title,
                english_title: item.anime_title_eng || item.anime_title,
                image: item.anime_image_path,
                num_watched: item.num_watched_episodes,
                total_episodes: item.anime_num_episodes,
                score: item.score,
                airing_status: item.anime_airing_status_string,
                url: `https://myanimelist.net${item.anime_url}`
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ username, count: results.length, results }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: Auto-Match AnimeSalt Series by Title (with Romaji -> English Auto-Resolution) ---
    if (pathname === '/api/match' && req.method === 'GET') {
        const title = parsedUrl.query.title;
        if (!title) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Title parameter is required' }));
            return;
        }

        const searchAnimeSalt = async (q) => {
            const searchUrl = `https://animesalt.cx/?s=${encodeURIComponent(q)}`;
            const resHtml = await (await fetch(searchUrl, {
                headers: { 'User-Agent': storage.config.userAgent || 'Mozilla/5.0' }
            })).text();

            const matches = [];
            const articles = resHtml.split('<article').slice(1);
            for (const art of articles) {
                const urlMatch = art.match(/href="([^"]+)"/);
                const titleMatch = art.match(/alt="([^"]+)"/) || art.match(/<h2[^>]*>([^<]+)<\/h2>/i);
                if (urlMatch && urlMatch[1].includes('animesalt.cx')) {
                    matches.push({
                        url: urlMatch[1],
                        title: titleMatch ? titleMatch[1].replace(/^Image\s*/i, '').trim() : 'Anime',
                        isSeries: urlMatch[1].includes('/series/'),
                        isEpisode: urlMatch[1].includes('/episode/')
                    });
                }
            }
            return matches;
        };

        try {
            const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/Season\s*\d+/i, '').trim();
            let seriesMatches = await searchAnimeSalt(cleanTitle);

            // If no match found, auto-translate Japanese Romaji to English via Kitsu
            if (seriesMatches.length === 0) {
                try {
                    const kitsuCheck = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanTitle)}&page[limit]=1`, {
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    if (kitsuCheck.ok) {
                        const kd = await kitsuCheck.json();
                        const enTitle = kd.data?.[0]?.attributes?.titles?.en;
                        if (enTitle && enTitle.toLowerCase() !== cleanTitle.toLowerCase()) {
                            const englishClean = enTitle.replace(/\(.*?\)/g, '').replace(/Season\s*\d+/i, '').trim();
                            seriesMatches = await searchAnimeSalt(englishClean);
                        }
                    }
                } catch (e) {}
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ query: title, matches: seriesMatches }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: Scraper Job with Server-Sent Events (SSE) Live Progress ---
    if (pathname === '/api/scrape' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const params = JSON.parse(body || '{}');
                const targetUrl = params.url;
                const limit = params.limit ? parseInt(params.limit, 10) : null;
                const force = Boolean(params.force);
                const singleEpisode = Boolean(params.singleEpisode);
                const episodeNumber = params.episodeNumber !== undefined ? params.episodeNumber : null;
                const episodeNumbers = Array.isArray(params.episodeNumbers) ? params.episodeNumbers : null;
                const range = params.range || null;

                if (!targetUrl || !targetUrl.startsWith('http')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Valid URL is required' }));
                    return;
                }

                // Setup SSE
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                const sendEvent = (event, data) => {
                    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                };

                sendEvent('start', { message: `Beginning scraping for ${targetUrl}` });

                const result = await engine.scrape(targetUrl, {
                    limit,
                    force,
                    singleEpisode,
                    episodeNumber,
                    episodeNumbers,
                    range,
                    onProgress: (p) => {
                        sendEvent('progress', p);
                    }
                });

                sendEvent('complete', result);
                res.end();
            } catch (err) {
                res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
                res.end();
            }
        });
        return;
    }

    // --- API: HLS CORS Stream Proxy ---
    if (pathname === '/api/proxy' && req.method === 'GET') {
        const target = parsedUrl.query.url;
        await handleHlsProxy(req, res, target);
        return;
    }

    // --- API: Subtitle Fetch & WebVTT Converter ---
    if (pathname === '/api/subtitle' && req.method === 'GET') {
        setCorsHeaders(res);
        const subUrl = parsedUrl.query.url;
        if (!subUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing subtitle URL');
            return;
        }

        try {
            const subRes = await fetch(subUrl, {
                headers: {
                    'Referer': 'https://as-cdn26.top/',
                    'User-Agent': storage.config.userAgent || 'Mozilla/5.0'
                }
            });
            if (!subRes.ok) {
                res.writeHead(subRes.status, { 'Content-Type': 'text/plain' });
                res.end(`Subtitle fetch error: HTTP ${subRes.status}`);
                return;
            }

            const rawText = await subRes.text();
            let vttText = rawText;
            if (!rawText.startsWith('WEBVTT')) {
                vttText = 'WEBVTT\n\n' + rawText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
            }

            res.writeHead(200, {
                'Content-Type': 'text/vtt; charset=utf-8',
                'Cache-Control': 'public, max-age=86400'
            });
            res.end(vttText);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Subtitle error: ${err.message}`);
        }
        return;
    }

    // --- API: Storage Status ---
    if (pathname === '/api/status' && req.method === 'GET') {
        const catalog = storage.getCatalog();
        const cacheFiles = fs.readdirSync(storage.paths.cache);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            storageDir: storage.storageDir,
            cacheFilesCount: cacheFiles.length,
            stats: catalog.stats
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

server.listen(PORT, () => {
    console.log(`
┌──────────────────────────────────────────────────────────┐
│  AnimeStream Test Website & HLS Player running on:       │
│  ➜ http://localhost:${PORT}                              │
└──────────────────────────────────────────────────────────┘
`);
});
