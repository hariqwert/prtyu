import { Router, Request, Response } from 'express';
import axios from 'axios';
import net from 'net';
import { cleanTsBuffer } from '../proxy';
import {
    searchBingr,
    getMovieDetails,
    getTvDetails,
    getTvEpisodes,
    findTmdbMatch,
    scrapeBingrStream,
    buildBingrM3u,
    unwrapDirectStreamUrl,
    normalizeServerId,
    BINGR_SERVERS,
    getTmdbKeys,
    getRotatingTmdbKey,
    getCdnHeaders,
    requiresReferer
} from '../services/bingrScraperService';
import { resolveMalIdFromTitle, fetchAniSkipTimes, fetchAniListEpisodes } from '../services/animeScraperService';
import { scrapeMegaPlayAnime } from '../services/megaPlayService';
import {
    searchSmMovies,
    getSmMovieCategories,
    getSmMoviesByCategory,
    findSmMovieStream,
    getSmMovieData
} from '../services/smMovieHubService';

const router = Router();

/**
 * Validates that an HTTP/HTTPS URL does not target localhost, private subnets,
 * loopback, or cloud metadata IP addresses (SSRF protection).
 */
export function isSafePublicUrl(inputUrl: string): boolean {
    try {
        if (!inputUrl || typeof inputUrl !== 'string') return false;
        const parsed = new URL(inputUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }

        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname.endsWith('.localhost') ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal')
        ) {
            return false;
        }

        const ipType = net.isIP(hostname);
        if (ipType === 4) {
            const parts = hostname.split('.').map(Number);
            const [b0, b1] = parts;
            if (b0 === 0) return false;
            if (b0 === 10) return false;
            if (b0 === 127) return false;
            if (b0 === 169 && b1 === 254) return false; // Cloud metadata
            if (b0 === 172 && b1 >= 16 && b1 <= 31) return false;
            if (b0 === 192 && b1 === 168) return false;
            if (b0 === 100 && b1 >= 64 && b1 <= 127) return false;
            if (b0 >= 224) return false;
        } else if (ipType === 6) {
            if (hostname === '::1' || hostname === '::' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Sliding-window rate limiter for TMDB Proxy (60 requests per minute per IP)
 */
const tmdbRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const TMDB_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const TMDB_RATE_LIMIT_MAX_REQUESTS = 60;

function isTmdbRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = tmdbRateLimitMap.get(ip);
    if (!record || now > record.resetAt) {
        tmdbRateLimitMap.set(ip, { count: 1, resetAt: now + TMDB_RATE_LIMIT_WINDOW_MS });
        return false;
    }
    record.count++;
    return record.count > TMDB_RATE_LIMIT_MAX_REQUESTS;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of tmdbRateLimitMap.entries()) {
        if (now > record.resetAt) {
            tmdbRateLimitMap.delete(ip);
        }
    }
}, 60 * 1000).unref();

const ALLOWED_TMDB_ENDPOINT = /^(movie|tv|search|trending|discover|find|genre|person)(\/[a-zA-Z0-9_\-]+)+$/;

/**
 * Root & Health Check Endpoint
 */
router.get(['/', '/health'], (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        name: 'Bingr M3U8 Stream Scraper API',
        endpoints: [
            'GET  /search?q={query_or_tmdb_id}',
            'GET  /movie/:tmdbId',
            'GET  /movie/:tmdbId/stream?srv={optional_server}',
            'GET  /tv/:tmdbId',
            'GET  /tv/:tmdbId/season/:seasonNumber',
            'GET  /tv/:tmdbId/season/:seasonNumber/episode/:episodeNumber/stream?srv={optional_server}',
            'GET  /tmdb-proxy?endpoint=...',
            'GET  /servers',
            'POST /scrape',
            'POST /stream',
            'GET  /play?type=...&id=...',
            'GET  /m3u?type=...&id=...'
        ]
    });
});

interface TmdbCacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

const tmdbProxyCache = new Map<string, TmdbCacheEntry>();
const MAX_CACHE_ENTRIES = 2000;

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of tmdbProxyCache.entries()) {
        if (now - v.timestamp > v.ttl * 2) {
            tmdbProxyCache.delete(k);
        }
    }
}, 10 * 60 * 1000).unref();

/**
 * TMDB Proxy endpoint with validation, rate limiting, and in-memory caching
 */
router.get('/tmdb-proxy', async (req: Request, res: Response) => {
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    if (isTmdbRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many TMDB requests. Please slow down.' });
    }

    const endpoint = (req.query.endpoint as string || '').trim();
    if (!endpoint || endpoint.includes('..') || !ALLOWED_TMDB_ENDPOINT.test(endpoint)) {
        return res.status(400).json({ error: 'Invalid or unauthorized TMDB endpoint' });
    }

    // Build normalized cache key excluding api_key
    const params = new URLSearchParams();
    const sortedKeys = Object.keys(req.query).filter(k => k !== 'endpoint' && k !== 'api_key').sort();
    for (const key of sortedKeys) {
        params.append(key, String(req.query[key]));
    }
    const cacheKey = `${endpoint}?${params.toString()}`;

    // Determine TTL: 1 hour for item details/credits, 30 min for searches/trending
    const isDetail = endpoint.includes('/') && !endpoint.startsWith('search/');
    const ttlMs = isDetail ? 60 * 60 * 1000 : 30 * 60 * 1000;

    const cached = tmdbProxyCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < cached.ttl)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.json(cached.data);
    }

    const keys = getTmdbKeys();
    for (let attempts = 0; attempts < keys.length; attempts++) {
        const apiKey = keys[attempts];
        params.set('api_key', apiKey);
        
        try {
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${endpoint}?${params.toString()}`, {
                timeout: 6000
            });
            if (tmdbRes.status === 200 && tmdbRes.data) {
                if (tmdbProxyCache.size >= MAX_CACHE_ENTRIES) {
                    const firstKey = tmdbProxyCache.keys().next().value;
                    if (firstKey) tmdbProxyCache.delete(firstKey);
                }
                tmdbProxyCache.set(cacheKey, {
                    data: tmdbRes.data,
                    timestamp: now,
                    ttl: ttlMs
                });

                res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
                res.setHeader('X-Cache', 'MISS-FETCHED');
                return res.json(tmdbRes.data);
            }
        } catch (e: any) {
            if (e.response?.status === 404) {
                return res.status(404).json({ error: 'Not found' });
            }
        }
    }

    // Fallback: If network failed but we have stale cache, serve stale data gracefully
    if (cached) {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
        res.setHeader('X-Cache', 'STALE-FALLBACK');
        return res.json(cached.data);
    }
    
    return res.status(500).json({ error: 'TMDB request failed' });
});

/**
 * GET /api/bingr/servers
 * Return list of active scraper clusters
 */
router.get('/servers', (req: Request, res: Response) => {
    const isAnime = req.query.type === 'anime' || 
                    req.query.mode === 'anime' || 
                    Boolean(req.query.malId) || 
                    Boolean(req.query.mal_id) || 
                    Boolean(req.query.mal) || 
                    Boolean(req.query.anilistId);
    if (isAnime) {
        const animeServers = BINGR_SERVERS.filter(s =>
            ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'].includes(s.id)
        );
        return res.json({ status: 'success', servers: animeServers });
    }
    res.json({ status: 'success', servers: BINGR_SERVERS });
});

router.get('/anime_servers', (req: Request, res: Response) => {
    const animeServers = BINGR_SERVERS.filter(s =>
        ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'].includes(s.id)
    );
    res.json({ status: 'success', servers: animeServers });
});

/**
 * GET /api/bingr/movie/:tmdbId/stream
 * Direct movie stream scraping endpoint with optional ?srv= cluster param
 */
router.get('/movie/:tmdbId/stream', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const srv = (req.query.srv as string) || undefined;
        const result = await scrapeBingrStream({
            type: 'movie',
            id: tmdbId,
            srv
        });
        return res.status(result.success ? 200 : 404).json(result);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Movie stream scraping failed' });
    }
});

/**
 * GET /api/bingr/movie/:tmdbId
 * Direct movie metadata endpoint
 */
router.get('/movie/:tmdbId', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const details = await getMovieDetails(tmdbId);
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Movie fetch failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId/season/:season/episode/:episode/stream
 * Direct TV episode stream scraping endpoint with optional ?srv= cluster param
 */
router.get('/tv/:tmdbId/season/:season/episode/:episode/stream', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const season = String(req.params.season || '1');
        const episode = String(req.params.episode || '1');
        const srv = (req.query.srv as string) || undefined;
        const result = await scrapeBingrStream({
            type: 'tv',
            id: tmdbId,
            season: Number(season),
            episode: Number(episode),
            srv
        });
        return res.status(result.success ? 200 : 404).json(result);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV stream scraping failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId/season/:season
 * Direct TV Season episodes endpoint
 */
router.get('/tv/:tmdbId/season/:season', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const season = String(req.params.season || '1');
        const episodes = await getTvEpisodes(tmdbId, season);
        res.json({ tmdbId: Number(tmdbId), season: Number(season), episodes });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV season fetch failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId
 * Direct TV Show metadata endpoint
 */
router.get('/tv/:tmdbId', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const details = await getTvDetails(tmdbId);
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV show fetch failed' });
    }
});

/**
 * GET /api/bingr/search?q=...
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q as string) || '';
        if (!query.trim()) {
            return res.json({ status: 'success', results: [] });
        }
        const data = await searchBingr(query);
        res.json({ status: 'success', ...data });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Search failed' });
    }
});

/**
 * GET /api/bingr/details/:type/:id
 * Retrieve rich movie/show details including full Cast and Characters with profile photos
 */
router.get('/details/:type/:id', async (req: Request, res: Response) => {
    try {
        const type = String(req.params.type || 'movie');
        const id = String(req.params.id || '');
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const details = mediaType === 'tv' ? await getTvDetails(id) : await getMovieDetails(id);
        res.json({ status: 'success', details });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Details fetch failed' });
    }
});

/**
 * GET /api/bingr/episodes/:id/:season
 * Retrieve episode listing for a specific TV Season
 */
router.get('/episodes/:id/:season', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '');
        const season = String(req.params.season || '1');
        const episodes = await getTvEpisodes(id, season);
        res.json({ status: 'success', episodes });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Episodes fetch failed' });
    }
});

/**
 * GET /api/bingr/srt2vtt
 * Proxies and converts an SRT subtitle file to WebVTT format for native HTML5 video <track> support.
 */
router.get('/srt2vtt', async (req: Request, res: Response) => {
    try {
        const url = (req.query.url as string || '').trim();
        if (!url || !url.startsWith('http') || !isSafePublicUrl(url)) {
            return res.status(400).send('Invalid or restricted subtitle URL');
        }
        
        const cdnHeaders = getCdnHeaders(url);
        const response = await axios.get(url, {
            responseType: 'text',
            headers: {
                'User-Agent': cdnHeaders.userAgent,
                ...(cdnHeaders.referer ? { 'Referer': cdnHeaders.referer } : {}),
                ...(cdnHeaders.origin ? { 'Origin': cdnHeaders.origin } : {})
            },
            timeout: 8000
        });
        const srtContent = (response.data || '').replace(/^\uFEFF/, '');
        
        // Convert SRT to VTT (Change comma to dot in timestamps and add WEBVTT header)
        const vttContent = "WEBVTT\n\n" + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(vttContent);
    } catch (e: any) {
        console.error('SRT to VTT conversion error:', e.message);
        res.status(500).send('WEBVTT\n\n'); // Return empty valid VTT on error
    }
});

/**
 * ALL /api/bingr/stream and ALL /api/bingr/scrape
 * Scrape direct M3U8 live stream using multi-cluster auto cascade (Bastion -> DarkMatter -> Polaris -> Edmunds)
 * Fully compatible with microservice payload: { srv, t, id, query: { title, year, season, episode } }
 */
router.all(['/stream', '/scrape'], async (req: Request, res: Response) => {
    try {
        // CSRF & Unauthorized Cross-Site Leeching Protection
        const fetchSite = req.headers['sec-fetch-site'];
        if (fetchSite === 'cross-site') {
            const host = req.headers.host || '';
            const origin = (req.headers.origin || '') as string;
            const referer = (req.headers.referer || '') as string;
            const isSelf = (origin && host && origin.includes(host)) || (referer && host && referer.includes(host));
            if (!isSelf) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Forbidden: Cross-site requests to media scraping endpoint are blocked.'
                });
            }
        }

        const queryParams = (req.query || {}) as Record<string, any>;
        const bodyParams = (req.body || {}) as Record<string, any>;
        const body = { ...queryParams, ...bodyParams };
        const rawType = (body.type || body.t || 'movie') as string;
        const anilistId = body.anilistId || body.anilist_id || body.anilist || body.query?.anilistId;
        const malId = body.malId || body.mal_id || body.mal || body.query?.malId;
        const isAnime = rawType === 'anime' || Boolean(anilistId) || Boolean(malId);
        const type = (isAnime ? 'anime' : (rawType === 'tv' ? 'tv' : 'movie')) as 'movie' | 'tv' | 'anime';
        const id = body.id;
        const title = body.title || body.query?.title;
        const year = body.year || body.query?.year;
        const season = body.season ? Number(body.season) : (body.query?.season ? Number(body.query.season) : undefined);
        const episode = body.episode ? Number(body.episode) : (body.query?.episode ? Number(body.query.episode) : undefined);
        const srv = body.srv || body.server;
        const strictSrv = body.strictSrv === true || body.strict === true || body.strictSrv === 'true' || body.strict === 'true';
        const nocache = body.nocache === '1' || body.nocache === true || body.force === '1' || body.force === true;

        const result = await scrapeBingrStream({
            type,
            id,
            title,
            year,
            season,
            episode,
            srv,
            strictSrv,
            anilistId,
            malId,
            nocache
        });

        if (result.success) {
            return res.json({ status: 'success', ...result });
        } else {
            return res.status(404).json({ status: 'error', ...result });
        }
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Stream scraping failed' });
    }
});

/**
 * GET /api/bingr/play
 * Dynamic playback resolver. Resolves stream on-the-fly and redirects to the active M3U8
 * Ideal for external IPTV players (VLC, Kodi, Tivimate) and in-app players.
 */
router.get('/play', async (req: Request, res: Response) => {
    try {
        const rawType = (req.query.type as string) || '';
        const malId = (req.query.malId || req.query.mal_id || req.query.mal) as string;
        const isAnime = rawType === 'anime' || Boolean(malId);
        const type = isAnime ? 'anime' : (rawType === 'tv' ? 'tv' : 'movie');
        const id = (req.query.id as string) || (req.query.tmdbId as string) || '';
        const title = (req.query.title as string) || '';
        const year = req.query.year as string;
        const season = req.query.season ? Number(req.query.season) : (isAnime || type === 'tv' ? 1 : undefined);
        const episode = req.query.episode ? Number(req.query.episode) : (isAnime || type === 'tv' ? 1 : undefined);
        const srv = req.query.srv as string;
        const mode = (req.query.mode as string) || 'redirect'; // 'redirect' | 'player'

        // Anime resolution via MAL ID / MegaPlay
        let targetMal: number | undefined = malId ? Number(malId) : undefined;
        if (!targetMal && isAnime && title) {
            try {
                targetMal = await resolveMalIdFromTitle(title) || undefined;
            } catch (_) {}
        }

        if (isAnime && targetMal) {
            const epNum = episode || 1;
            try {
                const isDub = req.query.dub === '1' || req.query.dub === 'true';
                const megaRes = await scrapeMegaPlayAnime({
                    malId: targetMal,
                    episode: epNum,
                    type: isDub ? 'dub' : 'sub'
                });
                if (megaRes && megaRes.success && megaRes.sources && megaRes.sources.length > 0) {
                    let directM3u8 = megaRes.sources[0].url;
                    if (directM3u8.startsWith('/')) {
                        const host = req.get('host') || 'localhost:3000';
                        directM3u8 = `${req.protocol || 'http'}://${host}${directM3u8}`;
                    }
                    if (mode === 'player') {
                        return res.redirect(`/play_bingr.php?url=${encodeURIComponent(directM3u8)}&name=${encodeURIComponent(title || 'Anime')}&type=anime&source=index.php`);
                    }
                    if (requiresReferer(directM3u8)) {
                        return res.redirect(`/api/bingr/manifest.m3u8?url=${encodeURIComponent(directM3u8)}`);
                    }
                    return res.redirect(directM3u8);
                }
            } catch (_) {}
        }

        const result = await scrapeBingrStream({
            type: isAnime ? 'tv' : (type === 'tv' ? 'tv' : 'movie'),
            id,
            title,
            year,
            season,
            episode,
            srv: isAnime ? (srv || 'hianime') : srv
        });

        if (result.success && result.primaryM3u8) {
            if (mode === 'player') {
                const safeTitle = encodeURIComponent(result.title || title || 'Bingr Stream');
                const sParam = season !== undefined ? `&season=${season}&s=${season}` : '';
                const eParam = episode !== undefined ? `&episode=${episode}&e=${episode}` : '';
                const idParam = result.tmdbId ? `&id=${result.tmdbId}&tmdbId=${result.tmdbId}` : (id ? `&id=${id}&tmdbId=${id}` : '');
                const srvParam = result.serverId ? `&srv=${result.serverId}` : (srv ? `&srv=${srv}` : '');
                const yearParam = result.year ? `&year=${encodeURIComponent(result.year)}` : '';
                return res.redirect(`/play_bingr.php?url=${encodeURIComponent(result.primaryM3u8)}&name=${safeTitle}&title=${safeTitle}&type=${type}&media_type=${type}${idParam}${sParam}${eParam}${srvParam}${yearParam}&source=index.php`);
            }
            // For external players (VLC, Kodi, TiviMate), referer-locked streams fail on raw 302 redirect.
            // Route through manifest normalizer to preserve headers and proxy segments.
            if (requiresReferer(result.primaryM3u8) || req.query.normalized === '1') {
                return res.redirect(`/api/bingr/manifest.m3u8?url=${encodeURIComponent(result.primaryM3u8)}`);
            }
            return res.redirect(result.primaryM3u8);
        }

        // External players fail if redirected to HTML embed pages. Only allow browser players.
        const isBrowser = (req.headers['accept'] || '').includes('text/html') && mode === 'player';
        if (isBrowser && result.fallbackEmbeds && result.fallbackEmbeds.length > 0) {
            return res.redirect(result.fallbackEmbeds[0]);
        }

        res.status(404).send('Direct video stream not available across active Bingr clusters');
    } catch (err: any) {
        res.status(500).send('Playback resolution error: ' + (err?.message || 'Unknown error'));
    }
});

/**
 * GET /api/bingr/segment
 * Media segment proxy that fetches upstream chunks with appropriate CDN headers,
 * strips non-standard headers using cleanTsBuffer, and streams compliant video/mp2t.
 */
router.get(['/segment', '/segment.ts'], async (req: Request, res: Response) => {
    try {
        const segUrl = (req.query.url as string || '').trim();
        if (!segUrl || !segUrl.startsWith('http') || !isSafePublicUrl(segUrl)) {
            return res.status(400).send('Invalid or restricted segment URL');
        }

        const cdnHeaders = getCdnHeaders(segUrl);
        const upstreamRes = await axios.get(segUrl, {
            headers: {
                'User-Agent': cdnHeaders.userAgent,
                ...(cdnHeaders.referer ? { 'Referer': cdnHeaders.referer } : {}),
                ...(cdnHeaders.origin ? { 'Origin': cdnHeaders.origin } : {})
            },
            responseType: 'arraybuffer',
            timeout: 15000
        });

        const rawBuffer = Buffer.from(upstreamRes.data);
        const { buffer: cleanBuffer, contentType } = cleanTsBuffer(rawBuffer);

        res.setHeader('Content-Type', contentType || 'video/mp2t');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(cleanBuffer);
    } catch (err: any) {
        return res.status(502).send('Error proxying media segment: ' + (err?.message || 'Unknown error'));
    }
});

/**
 * GET /api/bingr/manifest.m3u8
 * HLS manifest normalizer & aliaser for VLC, Kodi, TiviMate, OTT Navigator.
 * Fetches upstream manifests, rewrites sub-playlists, keys, maps, and referer-locked media segments.
 */
router.get(['/manifest.m3u8', '/manifest'], async (req: Request, res: Response) => {
    try {
        const targetUrl = (req.query.url as string || '').trim();
        if (!targetUrl || !targetUrl.startsWith('http') || !isSafePublicUrl(targetUrl)) {
            return res.status(400).send('Valid public ?url= query parameter is required');
        }

        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const selfBase = `${protocol}://${host}/api/bingr/manifest.m3u8`;
        const segmentBase = `${protocol}://${host}/api/bingr/segment`;

        const cdnHeaders = getCdnHeaders(targetUrl);
        const upstreamRes = await axios.get(targetUrl, {
            headers: {
                'User-Agent': cdnHeaders.userAgent,
                ...(cdnHeaders.referer ? { 'Referer': cdnHeaders.referer } : {}),
                ...(cdnHeaders.origin ? { 'Origin': cdnHeaders.origin } : {})
            },
            timeout: 10000,
            responseType: 'text'
        });

        const content = upstreamRes.data;
        if (typeof content !== 'string') {
            return res.status(502).send('Invalid upstream manifest content');
        }

        const lines = content.split(/\r?\n/);
        const rewrittenLines: string[] = [];
        const isMaster = content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:TYPE=');
        const needsProxy = requiresReferer(targetUrl);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                rewrittenLines.push(line);
                continue;
            }

            if (trimmed.startsWith('#')) {
                // Rewrite URI="..." in #EXT-X-MEDIA (audio / subtitle playlists)
                if (trimmed.startsWith('#EXT-X-MEDIA:') && trimmed.includes('URI=')) {
                    const replaced = trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
                        const resolvedChild = new URL(uri, targetUrl).toString();
                        return `URI="${selfBase}?url=${encodeURIComponent(resolvedChild)}"`;
                    });
                    rewrittenLines.push(replaced);
                } else if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI=')) {
                    // Rewrite relative or referer-locked encryption keys to absolute/proxied URLs
                    const replaced = trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
                        const resolvedKey = new URL(uri, targetUrl).toString();
                        if (needsProxy || requiresReferer(resolvedKey)) {
                            return `URI="${segmentBase}?url=${encodeURIComponent(resolvedKey)}"`;
                        }
                        return `URI="${resolvedKey}"`;
                    });
                    rewrittenLines.push(replaced);
                } else if (trimmed.startsWith('#EXT-X-MAP:') && trimmed.includes('URI=')) {
                    // Rewrite relative or referer-locked media initialization maps to absolute/proxied URLs
                    const replaced = trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
                        const resolvedMap = new URL(uri, targetUrl).toString();
                        if (needsProxy || requiresReferer(resolvedMap)) {
                            return `URI="${segmentBase}?url=${encodeURIComponent(resolvedMap)}"`;
                        }
                        return `URI="${resolvedMap}"`;
                    });
                    rewrittenLines.push(replaced);
                } else {
                    rewrittenLines.push(line);
                }
            } else {
                // Playlist or segment URL line
                const resolvedUrl = new URL(trimmed, targetUrl).toString();
                if (isMaster) {
                    // Forward child playlists to this normalizer
                    rewrittenLines.push(`${selfBase}?url=${encodeURIComponent(resolvedUrl)}`);
                } else {
                    const segNeedsProxy = needsProxy || requiresReferer(resolvedUrl);
                    const lower = resolvedUrl.toLowerCase();
                    const hasValidExt = lower.includes('.ts') || lower.includes('.mp4') || lower.includes('.m4s') || lower.includes('.aac');
                    
                    if (segNeedsProxy || !hasValidExt) {
                        rewrittenLines.push(`${segmentBase}?url=${encodeURIComponent(resolvedUrl)}&ext=.ts`);
                    } else {
                        rewrittenLines.push(resolvedUrl);
                    }
                }
            }
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.send(rewrittenLines.join('\n'));
    } catch (err: any) {
        return res.status(502).send('Error fetching upstream manifest: ' + (err?.message || 'Unknown error'));
    }
});

/**
 * GET /api/bingr/m3u
 * Export and generate M3U playlists with scraped M3U8 video streams
 * Fully supports TMDB ID (tmdbId) and MAL ID (malId) cross-connection
 */
router.get('/m3u', async (req: Request, res: Response) => {
    try {
        const rawType = (req.query.type as string) || '';
        const malIdQuery = req.query.malId || req.query.mal_id || req.query.mal;
        const tmdbIdQuery = req.query.tmdbId || req.query.tmdb_id || req.query.tmdb;
        let id = req.query.id ? Number(req.query.id) : (tmdbIdQuery ? Number(tmdbIdQuery) : 0);
        let malId = malIdQuery ? Number(malIdQuery) : undefined;
        const isAnime = rawType === 'anime' || Boolean(malId);
        const type = isAnime ? 'anime' : (rawType === 'tv' ? 'tv' : 'movie');

        let title = (req.query.title as string) || '';
        let year = req.query.year as string;
        const season = req.query.season ? Number(req.query.season) : 1;
        const direct = req.query.direct !== '0' && req.query.direct !== 'false';
        const isRaw = req.query.raw === '1' || req.query.raw === 'true' || req.query.mode === 'raw';

        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const baseUrl = `${protocol}://${host}`;

        let m3uContent = '';

        // ── 1. ANIME M3U GENERATION (MAL ID & TMDB ID CONNECTED) ──
        if (type === 'anime') {
            let targetMalId = malId;
            let targetTmdbId = id;

            // If only id is given and no malId, check if id is a MAL ID
            if (!targetMalId && id) {
                targetMalId = id;
            }

            let animeDetails = await fetchAniListEpisodes({ malId: targetMalId, title });

            // If not found by malId, attempt by title or TMDB lookup
            if (!animeDetails && id) {
                try {
                    const tvDet = await getTvDetails(id);
                    if (tvDet && tvDet.title) {
                        title = tvDet.title;
                        const detected = await resolveMalIdFromTitle(title);
                        if (detected) {
                            targetMalId = detected;
                            animeDetails = await fetchAniListEpisodes({ malId: detected, title });
                        }
                    }
                } catch (_) {}
            }

            const animeTitle = animeDetails?.displayTitle || animeDetails?.title?.english || animeDetails?.title?.romaji || title || 'Anime Series';
            const logo = animeDetails?.coverImage || animeDetails?.bannerImage || '';
            const connectedMalId = animeDetails?.idMal || targetMalId;

            // Auto cross-connect TMDB ID if missing
            if (!targetTmdbId && animeTitle) {
                try {
                    const tmdbMatch = await findTmdbMatch(animeTitle, 'tv');
                    if (tmdbMatch) targetTmdbId = tmdbMatch.id;
                } catch (_) {}
            }

            let episodesList: any[] = (animeDetails?.episodes as any[]) || [];
            if (episodesList.length === 0) {
                const totalCount = animeDetails?.episodesCount || 12;
                episodesList = Array.from({ length: totalCount }, (_, i) => ({
                    episodeNumber: i + 1,
                    title: `Episode ${i + 1}`,
                    thumbnail: logo,
                    seasonNumber: 1
                }));
            }

            const episodeStreams = new Map<number, string>();
            if (connectedMalId && direct) {
                // Pre-scrape first 2 episodes so instant playback works immediately without 429 rate-limit stalls
                const preFetchList = episodesList.slice(0, 2);
                await Promise.allSettled(
                    preFetchList.map(async (ep, idx) => {
                        const epNum = ep.episodeNumber || (idx + 1);
                        try {
                            const megaRes = await scrapeMegaPlayAnime({ malId: connectedMalId, episode: epNum, type: 'sub' });
                            if (megaRes && megaRes.success && megaRes.sources && megaRes.sources.length > 0) {
                                const src = megaRes.sources[0];
                                const directCandidate = (src as any).rawUrl || src.url;
                                const unwrapped = unwrapDirectStreamUrl(directCandidate);
                                if (unwrapped.streamUrl) {
                                    const finalStream = (isRaw || !requiresReferer(unwrapped.streamUrl))
                                        ? unwrapped.streamUrl
                                        : `${baseUrl}/api/bingr/manifest.m3u8?url=${encodeURIComponent(unwrapped.streamUrl)}`;
                                    episodeStreams.set(epNum, finalStream);
                                }
                            }
                        } catch (_) {}
                    })
                );
            }

            const items: any[] = [];
            for (let i = 0; i < episodesList.length; i++) {
                const ep = episodesList[i];
                const epNum = ep.episodeNumber || (i + 1);
                const epTitle = ep.title || `Episode ${epNum}`;
                const epThumb = ep.thumbnail || logo;

                const directUrl = episodeStreams.get(epNum) || `${baseUrl}/api/bingr/play?type=anime&id=${connectedMalId || targetTmdbId}&episode=${epNum}&malId=${connectedMalId || ''}&tmdbId=${targetTmdbId || ''}&title=${encodeURIComponent(animeTitle)}`;

                items.push({
                    name: `${animeTitle} E${String(epNum).padStart(2, '0')} - ${epTitle}`,
                    url: directUrl,
                    quality: '1080p Multi-Audio',
                    logo: epThumb,
                    season: 1,
                    episode: epNum,
                    tmdbId: targetTmdbId || connectedMalId,
                    referrer: 'https://megaplay.buzz/'
                });
            }

            m3uContent = buildBingrM3u({
                title: `${animeTitle} (MAL #${connectedMalId}${targetTmdbId ? ` / TMDB #${targetTmdbId}` : ''})`,
                type: 'tv',
                tmdbId: targetTmdbId || connectedMalId,
                groupTitle: 'Anime',
                logo,
                baseUrl,
                raw: isRaw,
                items
            });

            const cleanFileName = `${animeTitle.replace(/[^a-zA-Z0-9]/g, '_')}_MAL_${connectedMalId || 'anime'}`;
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}_bingr.m3u"`);
            return res.send(m3uContent);
        }

        // ── 2. MOVIE M3U GENERATION (TMDB ID & DIRECT CLUSTER STREAMS) ──
        if (type === 'movie') {
            if (!id && title) {
                const match = await findTmdbMatch(title, 'movie', year);
                if (match) {
                    id = match.id;
                    title = match.title;
                    if (!year && match.year) year = match.year;
                }
            }

            if (!id && !title) {
                return res.status(400).send('TMDB ID or Media Title is required');
            }

            let details: any = null;
            if (id) {
                try { details = await getMovieDetails(id); } catch {}
            }
            const movieTitle = details?.title || title || 'Movie';
            const movieYear = details?.year || year || '';
            const logo = details?.poster || '';

            const requestedSrv = req.query.srv ? String(req.query.srv) : '';
            const isAllServers = requestedSrv.toLowerCase() === 'all';
            const normSrv = isAllServers ? undefined : normalizeServerId(requestedSrv);

            const items: any[] = [];

            if (isAllServers) {
                const clusterList = [
                    { id: 'm4u', name: 'Movie 4U' },
                    { id: 's62', name: 'Bastion' },
                    { id: 's70', name: 'Polaris' },
                    { id: 's30', name: 'Nova' },
                    { id: 's80', name: 'Moscow' },
                    { id: 's31', name: 'Orion' },
                    { id: 'sm_hub', name: 'SM Movie Hub Pro' },
                    { id: 'framex', name: 'FrameX TV' },
                    { id: 's81', name: 'Novo' },
                    { id: 's40', name: 'Aphelion' },
                    { id: 's3', name: 'Edmunds' },
                    { id: 's60', name: 'Vertex' },
                    { id: 's63', name: 'Hallyu' },
                    { id: 's61', name: 'Corvus' },
                    { id: 'cinepro', name: 'CinePro' }
                ];
                const clusterResults = await Promise.allSettled(
                    clusterList.map(async (cl) => {
                        try {
                            const sc = await scrapeBingrStream({
                                type: 'movie',
                                id,
                                title: movieTitle,
                                year: movieYear,
                                srv: cl.id,
                                strictSrv: true
                            });
                            if (sc && sc.success && sc.primaryM3u8) {
                                const unwrapped = unwrapDirectStreamUrl(sc.primaryM3u8);
                                return {
                                    name: `${movieTitle}${movieYear ? ` (${movieYear})` : ''} - [${cl.name}]`,
                                    url: unwrapped.streamUrl,
                                    rawUrl: unwrapped.streamUrl,
                                    referrer: unwrapped.referer,
                                    quality: sc.quality || '1080p',
                                    logo,
                                    tmdbId: id
                                };
                            }
                        } catch (_) {}
                        return null;
                    })
                );

                for (const r of clusterResults) {
                    if (r.status === 'fulfilled' && r.value) {
                        items.push(r.value);
                    }
                }
            }

            // Single server direct resolution (Polaris, Aphelion, Nova, Edmunds, etc.)
            if (items.length === 0) {
                let streamUrl: string | null = null;
                let qualityTag = '1080p';
                let srvLabel = '';

                try {
                    const scrapeRes = await scrapeBingrStream({
                        type: 'movie',
                        id,
                        title: movieTitle,
                        year: movieYear,
                        srv: normSrv || undefined,
                        strictSrv: Boolean(normSrv)
                    });
                    if (scrapeRes && scrapeRes.success && scrapeRes.primaryM3u8) {
                        const unwrapped = unwrapDirectStreamUrl(scrapeRes.primaryM3u8);
                        streamUrl = unwrapped.streamUrl;
                        qualityTag = scrapeRes.quality || '1080p';
                        if (scrapeRes.serverName) srvLabel = ` [${scrapeRes.serverName.split(' ')[0]}]`;
                    }
                } catch (_) {}

                if (!streamUrl) {
                    streamUrl = `${baseUrl}/api/bingr/play?type=movie&id=${id || ''}&title=${encodeURIComponent(movieTitle)}${movieYear ? `&year=${movieYear}` : ''}${normSrv ? `&srv=${normSrv}` : ''}`;
                }

                items.push({
                    name: `${movieTitle}${movieYear ? ` (${movieYear})` : ''}${srvLabel}`,
                    url: streamUrl,
                    quality: qualityTag,
                    logo,
                    tmdbId: id
                });
            }

            m3uContent = buildBingrM3u({
                title: movieTitle,
                type: 'movie',
                tmdbId: id,
                groupTitle: 'Movies',
                logo,
                baseUrl,
                raw: isRaw,
                items
            });

            const cleanFileName = movieTitle.replace(/[^a-zA-Z0-9]/g, '_');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}_bingr.m3u"`);
            return res.send(m3uContent);
        }

        // ── 3. TV SERIES M3U GENERATION (TMDB ID) ──
        if (type === 'tv') {
            let details: any = null;
            if (id) {
                try { details = await getTvDetails(id); } catch {}
            }
            const tvTitle = details?.title || title || 'TV Series';
            const logo = details?.poster || '';

            // Check if MAL ID and intro skip timing exist to classify as Anime
            let isTvAnime = false;
            let detectedMalId: number | null = null;
            try {
                detectedMalId = await resolveMalIdFromTitle(tvTitle);
                if (detectedMalId) {
                    isTvAnime = true;
                }
            } catch (_) {}

            let episodesList: any[] = [];
            if (id) {
                try {
                    episodesList = await getTvEpisodes(id, season);
                } catch {}
            }

            // Fallback: standard episode listing if API details are unavailable
            if (episodesList.length === 0) {
                episodesList = Array.from({ length: 12 }, (_, i) => ({
                    episode: i + 1,
                    title: `Episode ${i + 1}`
                }));
            }

            const items: any[] = [];
            for (const ep of episodesList) {
                const epNum = ep.episode;
                const epTitle = ep.title || `Episode ${epNum}`;
                const streamUrl = `${baseUrl}/api/bingr/play?type=tv&id=${id || ''}&title=${encodeURIComponent(tvTitle)}&season=${season}&episode=${epNum}${isTvAnime ? `&srv=hianime&malId=${detectedMalId || ''}` : ''}`;

                items.push({
                    name: `${tvTitle} S${String(season).padStart(2, '0')}E${String(epNum).padStart(2, '0')} - ${epTitle}`,
                    url: streamUrl,
                    quality: 'HD Live',
                    logo: ep.still || logo,
                    season,
                    episode: epNum,
                    tmdbId: id
                });
            }

            m3uContent = buildBingrM3u({
                title: `${tvTitle} Season ${season}`,
                type: 'tv',
                tmdbId: id,
                groupTitle: isTvAnime ? 'Anime' : 'TV Series',
                logo,
                baseUrl,
                raw: isRaw,
                items
            });

            const cleanFileName = `${tvTitle.replace(/[^a-zA-Z0-9]/g, '_')}_S${season}`;
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}_bingr.m3u"`);
            return res.send(m3uContent);
        }

        return res.status(400).send('Invalid media type for M3U playlist');
    } catch (err: any) {
        res.status(500).send('M3U Generation Error: ' + (err?.message || 'Unknown error'));
    }
});

/**
 * SM Movie Hub Dedicated API Endpoints (35,800+ Movies & Series VOD)
 */
router.get('/sm-movies/search', async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string, 10) || 50;
    try {
        const results = await searchSmMovies(q, limit);
        res.json({
            success: true,
            query: q,
            count: results.length,
            results
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Search error' });
    }
});

router.get('/sm-movies/categories', async (req: Request, res: Response) => {
    try {
        const categories = await getSmMovieCategories();
        res.json({
            success: true,
            categories
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Categories error' });
    }
});

router.get('/sm-movies/list', async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    try {
        const result = await getSmMoviesByCategory(category, page, limit);
        res.json({
            success: true,
            ...result
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'List error' });
    }
});

router.get('/sm-movies/stream', async (req: Request, res: Response) => {
    const title = req.query.title as string;
    const year = req.query.year as string;
    const type = (req.query.type as 'movie' | 'tv') || 'movie';
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const episode = req.query.episode ? parseInt(req.query.episode as string, 10) : undefined;

    try {
        const streamData = await findSmMovieStream({
            type,
            title,
            year,
            season,
            episode
        });
        res.json(streamData);
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Stream error' });
    }
});

export default router;
