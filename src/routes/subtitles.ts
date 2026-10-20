import AdmZip from 'adm-zip';
import express, { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import zlib from 'zlib';

const router = express.Router();

// Helper to convert SRT string to WebVTT string
function srtToVtt(srtText: string): string {
    if (!srtText) return 'WEBVTT\n\n';
    let vtt = 'WEBVTT\n\n' + srtText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
    return vtt;
}

// Helper to convert ASS/SSA anime subtitles to WebVTT
function assToVtt(assText: string): string {
    if (!assText) return 'WEBVTT\n\n';
    const lines = assText.split(/\r?\n/);
    let vtt = 'WEBVTT\n\n';
    let count = 1;

    for (const line of lines) {
        if (line.startsWith('Dialogue:')) {
            const parts = line.substring(9).split(',');
            if (parts.length >= 10) {
                let start = parts[1].trim();
                let end = parts[2].trim();
                let text = parts.slice(9).join(',').trim();

                const padTime = (t: string) => {
                    const segs = t.split(':');
                    if (segs.length === 3) {
                        const h = segs[0].padStart(2, '0');
                        const m = segs[1].padStart(2, '0');
                        let [s, ms] = segs[2].split('.');
                        s = s.padStart(2, '0');
                        ms = (ms || '0').padEnd(3, '0').substring(0, 3);
                        return `${h}:${m}:${s}.${ms}`;
                    }
                    return t;
                };

                // Remove ASS styling tags like {\pos(..)}, {\an8}, \N (newline)
                text = text.replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').trim();
                if (text) {
                    vtt += `${count++}\n${padTime(start)} --> ${padTime(end)}\n${text}\n\n`;
                }
            }
        }
    }

    return count > 1 ? vtt : srtToVtt(assText);
}

// Universal Proxy endpoint to convert any SRT/ASS/VTT/GZ subtitle URL to valid WebVTT format for browser <track>

router.get('/msone', async (req: Request, res: Response) => {
    const pageUrl = req.query.url as string;
    if (!pageUrl) return res.status(400).send('Missing url');

    try {
        const pageRes = await axios.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(pageRes.data);
        const downloadLink = $('a.wpdm-download-link').attr('data-downloadurl') || $('a.wpdm-download-link').attr('href') || $('.wpdm-download-link').attr('href') || $('a[href*="download"]').attr('href');
        
        if (!downloadLink) {
             throw new Error("No download link found on MSone page");
        }

        // Fetch the zip
        const zipRes = await axios.get(downloadLink, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buf = Buffer.from(zipRes.data);
        
        let rawText = '';
        if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
            const zip = new AdmZip(buf);
            const zipEntries = zip.getEntries();
            let subEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.srt') || e.entryName.toLowerCase().endsWith('.vtt') || e.entryName.toLowerCase().endsWith('.ass'));
            if (subEntry) {
                rawText = zip.readAsText(subEntry, "utf8");
            }
        }
        
        if (!rawText) {
            rawText = buf.toString('utf8');
        }

        
        // Convert to VTT format manually like the main /vtt route does
        let vttContent = rawText;
        if (!vttContent.includes('WEBVTT')) {
            vttContent = 'WEBVTT\n\n' + vttContent
                .replace(/\r\n|\r/g, '\n')
                .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }

        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(vttContent);
    } catch (err: any) {
        console.error('MSone proxy error:', err?.message);
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send('WEBVTT\n\n');
    }
});

router.get('/vtt', async (req: Request, res: Response) => {
    const subUrl = req.query.url as string;
    if (!subUrl) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send('WEBVTT\n\n');
    }

    try {
        const response = await axios.get(subUrl, {
            responseType: 'arraybuffer',
            timeout: 12000,
            headers: {
                'User-Agent': 'VLSub 0.10.2'
            }
        });

        const buf = Buffer.from(response.data);
        let rawText = '';

        // Check if data is GZIP compressed
        try {
            rawText = zlib.gunzipSync(buf).toString('utf8');
        } catch (e1) {
            try {
                rawText = zlib.inflateSync(buf).toString('utf8');
            } catch (e2) {
                rawText = buf.toString('utf8');
            }
        }

        let vttContent = '';
        if (rawText.includes('WEBVTT')) {
            vttContent = rawText;
        } else if (rawText.includes('[Events]') && rawText.includes('Dialogue:')) {
            vttContent = assToVtt(rawText);
        } else {
            vttContent = srtToVtt(rawText);
        }

        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(vttContent);
    } catch (e: any) {
        console.error('Subtitle VTT proxy error:', e?.message || e);
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send('WEBVTT\n\n');
    }
});

// 0. High-Speed Stremio OpenSubtitles v3 Provider (Instant Multi-Language Subtitles)
const ISO_LANG_MAP: Record<string, string> = {
    eng: 'English', en: 'English',
    spa: 'Spanish', es: 'Spanish',
    fre: 'French', fra: 'French', fr: 'French',
    deu: 'German', ger: 'German', de: 'German',
    ita: 'Italian', it: 'Italian',
    por: 'Portuguese', pt: 'Portuguese', pob: 'Portuguese (BR)',
    rus: 'Russian', ru: 'Russian',
    hin: 'Hindi', hi: 'Hindi',
    tam: 'Tamil', ta: 'Tamil',
    tel: 'Telugu', te: 'Telugu',
    mal: 'Malayalam', ml: 'Malayalam',
    kan: 'Kannada', kn: 'Kannada',
    ben: 'Bengali', bn: 'Bengali',
    ara: 'Arabic', ar: 'Arabic',
    zho: 'Chinese', chi: 'Chinese', zh: 'Chinese',
    jpn: 'Japanese', ja: 'Japanese',
    kor: 'Korean', ko: 'Korean',
    tur: 'Turkish', tr: 'Turkish',
    vie: 'Vietnamese', vi: 'Vietnamese',
    tha: 'Thai', th: 'Thai',
    ind: 'Indonesian', id: 'Indonesian',
    pol: 'Polish', pl: 'Polish',
    dut: 'Dutch', nld: 'Dutch', nl: 'Dutch',
    swe: 'Swedish', sv: 'Swedish',
    nor: 'Norwegian', no: 'Norwegian',
    dan: 'Danish', da: 'Danish',
    fin: 'Finnish', fi: 'Finnish',
    gre: 'Greek', ell: 'Greek', el: 'Greek',
    heb: 'Hebrew', he: 'Hebrew',
    ukr: 'Ukrainian', uk: 'Ukrainian'
};

function resolveLanguageName(code: string): string {
    if (!code) return 'English';
    const lower = code.toLowerCase();
    return ISO_LANG_MAP[lower] || ISO_LANG_MAP[lower.substring(0, 2)] || code.toUpperCase();
}

async function fetchStremioOpenSubtitles(imdbId: string, season?: string, episode?: string): Promise<any[]> {
    const subs: any[] = [];
    if (!imdbId) return subs;
    const cleanImdb = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
    try {
        const isTv = !!(season && episode && season !== '0');
        const idPath = isTv ? `series/${cleanImdb}:${season}:${episode}` : `movie/${cleanImdb}`;
        const url = `https://opensubtitles-v3.strem.io/subtitles/${idPath}.json`;
        console.log('[Stremio Subs] Querying:', url);
        const res = await axios.get(url, {
            timeout: 6000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            validateStatus: () => true
        });
        console.log('[Stremio Subs] Response status:', res.status, 'count:', res.data?.subtitles?.length);
        if (res.status === 200 && res.data && Array.isArray(res.data.subtitles)) {
            res.data.subtitles.slice(0, 60).forEach((s: any) => {
                if (s.url) {
                    const rawLang = s.lang || 'eng';
                    const langName = resolveLanguageName(rawLang);
                    const langCode = rawLang.substring(0, 2).toLowerCase();
                    const releaseName = s.movieReleaseName || s.subtitleFileName || '';
                    subs.push({
                        id: `strem-${s.id || Math.random().toString(36).substring(2, 8)}`,
                        display: `[OpenSubs] ${releaseName ? releaseName.substring(0, 38) : langName} (${langName})`,
                        language: langName,
                        langCode: langCode,
                        url: `/api/subtitles/vtt?url=${encodeURIComponent(s.url)}`,
                        rawUrl: s.url,
                        format: 'SRT',
                        source: 'OpenSubtitles v3'
                    });
                }
            });
        }
    } catch (e: any) {
        console.warn('Stremio OpenSubtitles v3 fetch notice:', e?.message || e);
    }
    return subs;
}

// 1. OpenSubtitles Search Helper (With Title Cleaning & Query Fallback)
async function fetchOpenSubtitles(query: string, imdbId?: string, season?: string, episode?: string): Promise<any[]> {
    const subs: any[] = [];
    if (!query && !imdbId) return subs;

    const urlsToTry: string[] = [];
    const cleanImdb = (imdbId || '').replace(/^tt/i, '').trim();

    if (cleanImdb) {
        let u = `https://rest.opensubtitles.org/search/imdbid-${cleanImdb}`;
        if (season && episode && season !== '0') {
            u += `/season-${season}/episode-${episode}`;
        }
        urlsToTry.push(u);
    }

    if (query && query.trim()) {
        urlsToTry.push(`https://rest.opensubtitles.org/search/query-${encodeURIComponent(query.trim())}`);
        // Clean query by removing release tags, years, resolutions
        const cleanQ = query
            .replace(/\.(mp4|mkv|avi|webm|ts|mov)$/i, '')
            .replace(/(1080p|720p|2160p|4k|hdr|web-?dl|bluray|hdrip|x264|x265|hevc|aac|dts)/gi, ' ')
            .replace(/[\.\[\]\(\)\-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanQ && cleanQ.toLowerCase() !== query.trim().toLowerCase()) {
            urlsToTry.push(`https://rest.opensubtitles.org/search/query-${encodeURIComponent(cleanQ)}`);
        }
    }

    for (const url of urlsToTry) {
        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'VLSub 0.10.2' },
                timeout: 5000,
                validateStatus: () => true
            });

            if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
                res.data.slice(0, 35).forEach((item: any) => {
                    if (item.SubDownloadLink) {
                        subs.push({
                            id: `os-${item.IDSubtitleFile || item.IDSubtitle || Math.random()}`,
                            display: `${item.MovieReleaseName || item.SubFileName || query} [${item.LanguageName || 'Eng'}]`,
                            language: item.LanguageName || 'English',
                            langCode: (item.ISO639 || item.SubLanguageID || 'en').substring(0, 2).toLowerCase(),
                            url: `/api/subtitles/vtt?url=${encodeURIComponent(item.SubDownloadLink)}`,
                            rawUrl: item.SubDownloadLink,
                            format: item.SubFormat || 'SRT',
                            downloads: item.SubDownloadsCnt || 0,
                            rating: item.SubRating || '0.0',
                            source: 'OpenSubtitles'
                        });
                    }
                });
                if (subs.length > 0) break; // Found matches
            }
        } catch (e: any) {
            if (e?.code !== 'ENOTFOUND' && e?.code !== 'EAI_AGAIN') {
                console.warn('OpenSubtitles query warning:', e?.message || e);
            }
        }
    }
    return subs;
}

// 2. Anime Tosho Helper (Automated Anime Subtitles & Attachments)
async function fetchAnimeTosho(query: string): Promise<any[]> {
    const subs: any[] = [];
    if (!query || !query.trim()) return subs;

    try {
        const cleanQuery = query.replace(/[\[\]\(\)\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
        const url = `https://feed.animetosho.org/json?q=${encodeURIComponent(cleanQuery)}&only_tor=0`;
        const res = await axios.get(url, {
            timeout: 6000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            validateStatus: () => true
        });

        if (res.status === 200 && Array.isArray(res.data)) {
            res.data.slice(0, 25).forEach((item: any) => {
                const title = item.title || item.torrent_name || 'Anime Release';
                if (item.torrent_url) {
                    subs.push({
                        id: `at-${item.id || Math.random()}`,
                        display: `[AnimeTosho] ${title}`,
                        language: title.toLowerCase().includes('dual') || title.toLowerCase().includes('eng') ? 'English / Japanese' : 'Multi-Subs',
                        langCode: 'en',
                        url: `/api/subtitles/vtt?url=${encodeURIComponent(item.torrent_url)}`,
                        rawUrl: item.torrent_url,
                        format: 'ASS/SRT',
                        seeders: item.seeders || 0,
                        source: 'Anime Tosho'
                    });
                }
            });
        }
    } catch (e: any) {
        console.warn('Anime Tosho fetch warning:', e?.message || e);
    }
    return subs;
}

// 3. Kitsunekko Helper (Raw & Text-Based Japanese/English Anime Subtitles)
async function fetchKitsunekko(query: string): Promise<any[]> {
    const subs: any[] = [];
    if (!query || !query.trim()) return subs;

    try {
        const cleanQuery = query.toLowerCase().replace(/season\s*\d+/i, '').replace(/s\d+/i, '').trim();
        // Search Japanese and English repository listings
        const repos = [
            { lang: 'English', code: 'en', path: 'subtitles/english/' },
            { lang: 'Japanese', code: 'ja', path: 'subtitles/japanese/' }
        ];

        for (const repo of repos) {
            const listUrl = `https://kitsunekko.com/dirlist.php?dir=${encodeURIComponent(repo.path)}`;
            const res = await axios.get(listUrl, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                validateStatus: () => true
            });

            if (res.status === 200 && typeof res.data === 'string') {
                const $ = cheerio.load(res.data);
                $('a[href]').each((_, a) => {
                    const text = $(a).text().trim();
                    const href = $(a).attr('href') || '';
                    const lowerText = text.toLowerCase();
                    const isSubFile = lowerText.endsWith('.ass') || lowerText.endsWith('.srt') || lowerText.endsWith('.vtt');
                    if (text && isSubFile && lowerText.includes(cleanQuery)) {
                        const fullUrl = href.startsWith('http') ? href : `https://kitsunekko.com/${href.replace(/^\//, '')}`;
                        subs.push({
                            id: `kit-${Math.random().toString(36).substring(2, 8)}`,
                            display: `[Kitsunekko] ${text} (${repo.lang})`,
                            language: repo.lang,
                            langCode: repo.code,
                            url: `/api/subtitles/vtt?url=${encodeURIComponent(fullUrl)}`,
                            rawUrl: fullUrl,
                            format: lowerText.endsWith('.ass') ? 'ASS' : (lowerText.endsWith('.vtt') ? 'VTT' : 'SRT'),
                            source: 'Kitsunekko'
                        });
                    }
                });
            }
        }
    } catch (e: any) {
        if (e?.code !== 'ENOTFOUND' && e?.code !== 'EAI_AGAIN') {
            console.warn('Kitsunekko search warning:', e?.message || e);
        }
    }
    return subs;
}

// 4. SubDL Helper
async function fetchSubDL(query: string, imdbId?: string): Promise<any[]> {
    const subs: any[] = [];
    if (!query && !imdbId) return subs;

    try {
        const url = `https://api.subdl.com/api/v1/subtitles?film_name=${encodeURIComponent(query)}&type=movie`;
        const res = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            validateStatus: () => true
        });

        if (res.status === 200 && res.data && Array.isArray(res.data.subtitles)) {
            res.data.subtitles.slice(0, 20).forEach((s: any) => {
                const subUrl = s.url || s.link;
                if (subUrl) {
                    subs.push({
                        id: `subdl-${s.id || Math.random()}`,
                        display: `[SubDL] ${s.release_name || s.name || query} (${s.lang || 'English'})`,
                        language: s.lang || 'English',
                        langCode: (s.lang || 'en').substring(0, 2).toLowerCase(),
                        url: `/api/subtitles/vtt?url=${encodeURIComponent(subUrl)}`,
                        rawUrl: subUrl,
                        format: s.format || 'SRT',
                        source: 'SubDL'
                    });
                }
            });
        }
    } catch (e: any) {
        console.warn('SubDL fetch warning:', e?.message || e);
    }
    return subs;
}

// 5. MSone Helper (Malayalam Subtitles)
async function fetchMSone(query: string): Promise<any[]> {
    const subs: any[] = [];
    if (!query || !query.trim()) return subs;

    try {
        const searchUrl = `https://malayalamsubtitles.org/?s=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            validateStatus: () => true
        });

        if (response.status === 403 || response.data.includes('Just a moment...')) {
            console.warn('MSone search blocked by Cloudflare.');
            return subs;
        }

        const $ = cheerio.load(response.data);
        $('article').each((_, el) => {
            const titleElement = $(el).find('.entry-title a');
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');

            if (title && link) {
                subs.push({
                    id: `msone-${Math.random().toString(36).substring(2, 8)}`,
                    display: `[MSone] ${title} (Malayalam)`,
                    language: 'Malayalam',
                    langCode: 'ml',
                    url: `/api/subtitles/msone?url=${encodeURIComponent(link)}`, // Note: Will fail to render unless download link is extracted later
                    rawUrl: link,
                    format: 'ZIP/SRT',
                    source: 'MSone'
                });
            }
        });
    } catch (e: any) {
        console.warn('MSone fetch warning:', e?.message || e);
    }
    return subs;
}

// Comprehensive Subtitle Fetcher (Aggregates OpenSubtitles v3, OpenSubtitles Org, SubDL, AnimeTosho, Kitsunekko, Wyzie, MSone)
router.get('/fetch', async (req: Request, res: Response) => {
    const rawTitle = (req.query.title || req.query.q || '') as string;
    let imdbId = (req.query.imdb || req.query.imdb_id || '') as string;
    let tmdbId = (req.query.tmdb || req.query.tmdbId || req.query.tmdb_id || req.query.id || '') as string;
    let season = (req.query.season || req.query.s || '') as string;
    let episode = (req.query.episode || req.query.e || '') as string;
    const lang = (req.query.lang || '') as string;
    const provider = (req.query.provider || 'all') as string;

    if (tmdbId && tmdbId.startsWith('tt')) {
        imdbId = tmdbId;
        tmdbId = '';
    }

    // Auto-extract Season and Episode if present in query string (e.g. S01E01)
    if (!season || !episode) {
        const seMatch = rawTitle.match(/s(\d{1,2})[\s._-]*e(\d{1,2})/i) || rawTitle.match(/(\d{1,2})x(\d{1,2})/i);
        if (seMatch) {
            season = String(parseInt(seMatch[1], 10));
            episode = String(parseInt(seMatch[2], 10));
        }
    }

    // Clean title from release tags, hashes, and codec labels
    let title = rawTitle
        .replace(/\.(mp4|mkv|avi|webm|ts|mov)$/i, '')
        .replace(/s\d{1,2}[\s._-]*e\d{1,2}.*$/i, '')
        .replace(/\b(19\d\d|20\d\d)\b.*$/i, '')
        .replace(/(1080p|720p|2160p|4k|hdr|web-?dl|bluray|hdrip|x264|x265|hevc|aac|dts|cakes|eztv|yts|yify|rarbg|ettv|galaxyrg|tgx|vostfr|multi).*$/gi, '')
        .replace(/[\.\[\]\(\)\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!title) title = rawTitle;

    // TMDB metadata resolution for accurate IMDb ID / TMDB ID lookup
    const port = process.env.PORT || 3000;
    if (!imdbId && tmdbId && /^\d+$/.test(tmdbId.trim())) {
        try {
            const cleanId = tmdbId.trim();
            const mediaType = season && episode && season !== '0' ? 'tv' : 'movie';
            const extRes = await axios.get(`http://127.0.0.1:${port}/api/bingr/tmdb-proxy?endpoint=${mediaType}/${cleanId}/external_ids`, {
                timeout: 3500,
                validateStatus: () => true
            });
            if (extRes.status === 200 && extRes.data?.imdb_id) {
                imdbId = extRes.data.imdb_id;
            }
            if (!title) {
                const detRes = await axios.get(`http://127.0.0.1:${port}/api/bingr/tmdb-proxy?endpoint=${mediaType}/${cleanId}`, {
                    timeout: 3500,
                    validateStatus: () => true
                });
                if (detRes.status === 200 && detRes.data) {
                    title = detRes.data.title || detRes.data.name || '';
                }
            }
        } catch (e) {}
    }

    if (!imdbId && title) {
        try {
            const endpoint = season && episode && season !== '0' ? 'search/tv' : 'search/multi';
            const searchRes = await axios.get(`http://127.0.0.1:${port}/api/bingr/tmdb-proxy?endpoint=${endpoint}&query=${encodeURIComponent(title)}`, {
                timeout: 3500,
                validateStatus: () => true
            });
            if (searchRes.status === 200 && searchRes.data?.results?.[0]) {
                const match = searchRes.data.results[0];
                if (!tmdbId) tmdbId = String(match.id);
                const mediaType = match.media_type || (season && episode ? 'tv' : 'movie');
                const extRes = await axios.get(`http://127.0.0.1:${port}/api/bingr/tmdb-proxy?endpoint=${mediaType}/${match.id}/external_ids`, {
                    timeout: 3500,
                    validateStatus: () => true
                });
                if (extRes.status === 200 && extRes.data?.imdb_id) {
                    imdbId = extRes.data.imdb_id;
                }
            }
        } catch (e) {}
    }

    let subtitles: any[] = [];

    // Parallel Subtitle Retrieval
    const tasks: Promise<any[]>[] = [];

    // 0. Stremio OpenSubtitles v3 (High speed, reliable, multi-language)
    if ((provider === 'all' || provider === 'opensubtitles') && imdbId) {
        tasks.push(fetchStremioOpenSubtitles(imdbId, season, episode));
    }

    // 1. OpenSubtitles Org (Standard & VIP Movies/Shows)
    if (provider === 'all' || provider === 'opensubtitles') {
        tasks.push(fetchOpenSubtitles(title, imdbId, season, episode));
        if (rawTitle !== title) {
            tasks.push(fetchOpenSubtitles(rawTitle, imdbId, season, episode));
        }
    }

    // 2. Wyzie Subs (Fast Movie & TV subtitle cloud)
    if (provider === 'all' || provider === 'wyzie') {
        tasks.push((async () => {
            const list: any[] = [];
            if (imdbId || tmdbId || title) {
                try {
                    let wyzieUrl = `https://sub.wyzie.ru/search?id=${imdbId || tmdbId}`;
                    if (season && episode && season !== '0') {
                        wyzieUrl += `&season=${season}&episode=${episode}`;
                    }
                    const wyzieRes = await axios.get(wyzieUrl, { timeout: 6000, validateStatus: () => true });
                    if (wyzieRes.status === 200 && Array.isArray(wyzieRes.data)) {
                        wyzieRes.data.forEach((sub: any) => {
                            if (sub.url) {
                                list.push({
                                    id: `wy-${sub.id || sub.url}`,
                                    display: `${sub.display || sub.language || 'English'} (${sub.format || 'SRT'})`,
                                    language: sub.language || sub.lang || 'English',
                                    langCode: (sub.lang || sub.language || 'en').substring(0, 2).toLowerCase(),
                                    url: `/api/subtitles/vtt?url=${encodeURIComponent(sub.url)}`,
                                    rawUrl: sub.url,
                                    format: sub.format || 'SRT',
                                    source: 'Wyzie Subs'
                                });
                            }
                        });
                    }
                } catch (e: any) {}
            }
            return list;
        })());
    }

    // 3. Anime Tosho (Encode-Synced Anime Subtitle Releases)
    if (provider === 'all' || provider === 'animetosho') {
        tasks.push(fetchAnimeTosho(title));
    }

    // 4. Kitsunekko (Raw Japanese / English Anime Subtitles)
    if (provider === 'all' || provider === 'kitsunekko') {
        tasks.push(fetchKitsunekko(title));
    }

    // 5. SubDL
    if (provider === 'all' || provider === 'subdl') {
        tasks.push(fetchSubDL(title, imdbId));
    }

    // 6. MSone (Only when explicitly queried)
    if (provider === 'msone') {
        tasks.push(fetchMSone(title));
    }

    const results = await Promise.allSettled(tasks);
    results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            subtitles.push(...r.value);
        }
    });

    // Remove duplicates based on rawUrl or display
    const seen = new Set<string>();
    subtitles = subtitles.filter(s => {
        const key = s.rawUrl || s.display;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Filter by language if specified
    let filtered = subtitles;
    if (lang && lang !== 'all') {
        const targetLang = lang.toLowerCase();
        filtered = subtitles.filter(s =>
            s.language.toLowerCase().includes(targetLang) ||
            s.langCode.toLowerCase().includes(targetLang)
        );
        if (filtered.length === 0) filtered = subtitles; // Fallback to all if specific language not found
    }

    res.json({
        title,
        imdbId,
        provider,
        count: filtered.length,
        subtitles: filtered
    });
});

// Malayalam Subtitles Portal Scraper
router.get('/search', async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const searchUrl = `https://malayalamsubtitles.org/?s=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            validateStatus: () => true
        });

        if (response.status === 403 || response.data.includes('Just a moment...')) {
            return res.json({ error: 'Search blocked by Cloudflare. Please try again later or use OpenSubtitles / SubDL.' });
        }

        const $ = cheerio.load(response.data);
        const results: any[] = [];

        $('article').each((_, el) => {
            const titleElement = $(el).find('.entry-title a');
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');
            const image = $(el).find('img').attr('src');

            if (title && link) {
                results.push({ title, link, image });
            }
        });

        res.json({ results });
    } catch (error: any) {
        console.error('Subtitle search error:', error.message);
        res.status(500).json({ error: 'Failed to fetch subtitles' });
    }
});

// Proxy route for raw subtitle downloads (like MSone zip files) to bypass CORS and Cloudflare blocks
router.get('/download', async (req: Request, res: Response) => {
    const url = req.query.url as string;
    
    if (!url) {
        return res.status(400).json({ error: 'Missing subtitle URL' });
    }

    try {
        const response = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            validateStatus: () => true
        });

        // MSone passes the file directly through Cloudflare or redirects to it
        if (response.status === 403 || response.status === 404) {
            return res.status(404).json({ error: 'Subtitle file not found or blocked' });
        }

        const contentType = response.headers['content-type'];
        const contentDisposition = response.headers['content-disposition'];
        
        if (contentType && typeof contentType === 'string') res.setHeader('Content-Type', contentType);
        if (contentDisposition && typeof contentDisposition === 'string') {
            res.setHeader('Content-Disposition', contentDisposition);
        } else {
            res.setHeader('Content-Disposition', 'attachment; filename="subtitle.zip"');
        }

        response.data.pipe(res);
    } catch (error: any) {
        console.error('Subtitle download error:', error.message);
        res.status(500).json({ error: 'Failed to download subtitle file' });
    }
});

export default router;
