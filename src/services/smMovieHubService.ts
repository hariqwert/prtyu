import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface MkvMetadata {
    duration: number; // in seconds
    audioTracks: Array<{
        index: number; // 0, 1, 2...
        streamIndex: number;
        codec: string;
        language: string;
        label: string;
    }>;
}

const MKV_METADATA_CACHE = new Map<string, MkvMetadata>();

export async function probeMkvMetadata(url: string, referer = 'https://fibwatch.art/'): Promise<MkvMetadata | null> {
    const cleanUrl = encodeURI(url.split('|')[0].trim().replace(/herthg\.b-cdn\.net/gi, 'qwefgh.b-cdn.net'));
    if (MKV_METADATA_CACHE.has(cleanUrl)) {
        return MKV_METADATA_CACHE.get(cleanUrl)!;
    }

    return new Promise((resolve) => {
        const headers = `Referer: ${referer}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n`;
        const ff = spawn('ffprobe', [
            '-headers', headers,
            '-show_streams',
            '-show_format',
            '-print_format', 'json',
            cleanUrl
        ]);

        let out = '';
        ff.stdout.on('data', d => out += d);

        const timeout = setTimeout(() => {
            try { ff.kill('SIGKILL'); } catch {}
            resolve(null);
        }, 3500);

        ff.on('close', () => {
            clearTimeout(timeout);
            try {
                const info = JSON.parse(out);
                const duration = parseFloat(info.format?.duration || '0') || 0;
                const audioTracks: MkvMetadata['audioTracks'] = [];
                let aIndex = 0;

                for (const s of info.streams || []) {
                    if (s.codec_type === 'audio') {
                        const langCode = (s.tags?.language || s.tags?.LANGUAGE || '').toLowerCase();
                        let langName = s.tags?.title || s.tags?.handler_name || '';
                        if (langCode === 'hin' || langCode === 'hi') langName = 'Hindi';
                        else if (langCode === 'mal' || langCode === 'ml') langName = 'Malayalam';
                        else if (langCode === 'eng' || langCode === 'en') langName = 'English';
                        else if (langCode === 'ben' || langCode === 'bn') langName = 'Bengali';
                        else if (langCode === 'tam' || langCode === 'ta') langName = 'Tamil';
                        else if (langCode === 'tel' || langCode === 'te') langName = 'Telugu';
                        else if (!langName) langName = `Audio ${aIndex + 1}`;

                        audioTracks.push({
                            index: aIndex,
                            streamIndex: s.index,
                            codec: s.codec_name || 'aac',
                            language: langCode || 'unk',
                            label: langName
                        });
                        aIndex++;
                    }
                }

                const result: MkvMetadata = { duration, audioTracks };
                MKV_METADATA_CACHE.set(cleanUrl, result);
                resolve(result);
            } catch {
                resolve(null);
            }
        });
    });
}

export interface SmMovieItem {
    id: string;
    title: string;
    cleanTitle: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeEnd?: number;
    isSeries: boolean;
    group: string;
    logo: string;
    streamUrl: string;
    referrer?: string;
    userAgent?: string;
    quality?: string;
    language?: string;
    rawLine?: string;
}

export interface SmMovieCategory {
    name: string;
    count: number;
}

interface SmMovieCache {
    items: SmMovieItem[];
    categories: SmMovieCategory[];
    movieIndex: Map<string, SmMovieItem[]>; // cleanTitle -> items
    seriesIndex: Map<string, SmMovieItem[]>; // cleanTitle -> items
    idIndex: Map<string, SmMovieItem>; // id -> item
    timestamp: number;
}

const SM_MOVIE_PRIMARY_URL = 'https://raw.githubusercontent.com/sm-monirulislam/SM-Movie-Hup-Auto-Update/refs/heads/main/latest_movies.m3u';
const SM_MOVIE_BACKUP_URL = 'https://raw.githubusercontent.com/sm-monirulislam/SM-Movie-Hup-Auto-Update/refs/heads/main/Movie_Combined.m3u';
const LOCAL_CACHE_FILE = path.join(process.cwd(), 'storage', 'sm_movies_cache.m3u');
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes

let cache: SmMovieCache | null = null;
let fetchingPromise: Promise<SmMovieCache> | null = null;
let autoUpdateTimer: NodeJS.Timeout | null = null;

export function normalizeTitle(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\.(mkv|mp4|avi|webm|ts)/gi, '')
        .replace(/\[fibwatch\.com\]/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\((19\d\d|20\d\d)\)/g, '')
        .replace(/\b(19\d\d|20\d\d)\b/g, '')
        .replace(/\b(s\d{1,2}e\d{1,2}(-\d{1,2})?|s\d{1,2}|season\s*\d{1,2}|episode\s*\d{1,2}|ep\s*\d{1,2})\b/gi, '')
        .replace(/\b(480p|720p|1080p|2160p|4k|hd|fhd|hq|dual|hindi|bengali|tamil|telugu|malayalam|kannada|english|korean|dubbed|multi|audio|org|original|web-dl|webdl|bluray|rip|camrip|cam|clean|new|hdtc|hdrip|dvdrip|webrip|complete|uncut|extended|remastered)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
}

function parseItemMetadata(title: string): {
    cleanTitle: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeEnd?: number;
    isSeries: boolean;
    quality?: string;
    language?: string;
} {
    const raw = title || '';
    
    // Year extraction
    const yearMatch = raw.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    // Season & Episode extraction (e.g. S01E17-20 or S01E03 or S02)
    const seMatch = raw.match(/\bS(\d{1,2})E(\d{1,2})(?:-(\d{1,2}))?\b/i);
    let season: number | undefined;
    let episode: number | undefined;
    let episodeEnd: number | undefined;
    let isSeries = false;

    if (seMatch) {
        isSeries = true;
        season = parseInt(seMatch[1], 10);
        episode = parseInt(seMatch[2], 10);
        if (seMatch[3]) {
            episodeEnd = parseInt(seMatch[3], 10);
        }
    } else {
        const sOnlyMatch = raw.match(/\bS(\d{1,2})\b/i) || raw.match(/\bSeason\s*(\d{1,2})\b/i);
        if (sOnlyMatch) {
            isSeries = true;
            season = parseInt(sOnlyMatch[1], 10);
        }
    }

    // Quality extraction
    let quality = '1080p';
    if (/4k|2160p/i.test(raw)) quality = '4K UHD';
    else if (/1080p|fhd/i.test(raw)) quality = '1080p FHD';
    else if (/720p|hd/i.test(raw)) quality = '720p HD';
    else if (/480p|sd/i.test(raw)) quality = '480p';

    // Language extraction
    let language = 'Original';
    if (/dual/i.test(raw)) language = 'Dual Audio';
    else if (/hindi/i.test(raw)) language = 'Hindi';
    else if (/bengali/i.test(raw)) language = 'Bengali';
    else if (/tamil/i.test(raw)) language = 'Tamil';
    else if (/telugu/i.test(raw)) language = 'Telugu';
    else if (/malayalam/i.test(raw)) language = 'Malayalam';
    else if (/dubbed/i.test(raw)) language = 'Dubbed';

    const cleanTitle = normalizeTitle(raw);

    return {
        cleanTitle,
        year,
        season,
        episode,
        episodeEnd,
        isSeries,
        quality,
        language
    };
}

function parseM3uToCache(rawData: string): SmMovieCache {
    const lines = rawData.split('\n');

    const items: SmMovieItem[] = [];
    const movieIndex = new Map<string, SmMovieItem[]>();
    const seriesIndex = new Map<string, SmMovieItem[]>();
    const idIndex = new Map<string, SmMovieItem>();
    const categoryCountMap = new Map<string, number>();

    let currentInfo: {
        title?: string;
        group?: string;
        logo?: string;
        referrer?: string;
        userAgent?: string;
    } | null = null;

    let index = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
            const groupTitleMatch = line.match(/group-title="([^"]*)"/i);

            const commaIdx = line.lastIndexOf(',');
            let rawTitle = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';
            if (!rawTitle) rawTitle = `Movie ${index}`;

            const rawGroup = groupTitleMatch ? groupTitleMatch[1].trim() : 'Movies';

            currentInfo = {
                title: rawTitle,
                logo: tvgLogoMatch ? tvgLogoMatch[1].trim() : '',
                group: rawGroup,
                referrer: 'https://fibwatch.art/'
            };
        } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
            if (currentInfo) {
                currentInfo.referrer = line.replace('#EXTVLCOPT:http-referrer=', '').trim();
            }
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
            if (currentInfo) {
                currentInfo.userAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
            }
        } else if (line.startsWith('http://') || line.startsWith('https://')) {
            if (currentInfo) {
                let streamUrl = line.trim();
                let ref = currentInfo.referrer || 'https://fibwatch.art/';
                let ua = currentInfo.userAgent;

                if (streamUrl.includes('|')) {
                    const parts = streamUrl.split('|');
                    streamUrl = parts[0].trim();
                    for (let p = 1; p < parts.length; p++) {
                        const part = parts[p].trim();
                        if (part.toLowerCase().startsWith('referer=')) {
                            ref = part.substring(8).trim();
                        } else if (part.toLowerCase().startsWith('user-agent=')) {
                            ua = part.substring(11).trim();
                        } else if (part.toLowerCase().startsWith('http-referrer=')) {
                            ref = part.substring(14).trim();
                        }
                    }
                }

                // Transparently migrate suspended BunnyCDN domains to the live active domain
                streamUrl = streamUrl.replace(/herthg\.b-cdn\.net/gi, 'qwefgh.b-cdn.net');

                const meta = parseItemMetadata(currentInfo.title || '');
                const id = `sm_vod_${index}`;

                const item: SmMovieItem = {
                    id,
                    title: currentInfo.title || `Movie ${index}`,
                    cleanTitle: meta.cleanTitle,
                    year: meta.year,
                    season: meta.season,
                    episode: meta.episode,
                    episodeEnd: meta.episodeEnd,
                    isSeries: meta.isSeries,
                    group: currentInfo.group || 'Movies',
                    logo: currentInfo.logo || '',
                    streamUrl,
                    referrer: ref,
                    userAgent: ua,
                    quality: meta.quality,
                    language: meta.language,
                    rawLine: line
                };

                items.push(item);
                idIndex.set(id, item);

                // Index by clean title
                if (meta.cleanTitle) {
                    if (meta.isSeries) {
                        const list = seriesIndex.get(meta.cleanTitle) || [];
                        list.push(item);
                        seriesIndex.set(meta.cleanTitle, list);
                    } else {
                        const list = movieIndex.get(meta.cleanTitle) || [];
                        list.push(item);
                        movieIndex.set(meta.cleanTitle, list);
                    }
                }

                // Category count
                const groupName = currentInfo.group || 'Movies';
                categoryCountMap.set(groupName, (categoryCountMap.get(groupName) || 0) + 1);

                index++;
                currentInfo = null;
            }
        }
    }

    const categories: SmMovieCategory[] = Array.from(categoryCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        items,
        categories,
        movieIndex,
        seriesIndex,
        idIndex,
        timestamp: Date.now()
    };
}

/**
 * Fetch and parse SM Movie Hub M3U playlist from GitHub with local disk cache
 */
export async function getSmMovieData(forceRefresh = false): Promise<SmMovieCache> {
    const now = Date.now();
    if (!forceRefresh && cache && (now - cache.timestamp < CACHE_TTL_MS)) {
        return cache;
    }

    if (fetchingPromise) {
        return fetchingPromise;
    }

    fetchingPromise = (async () => {
        try {
            console.log('[SmMovieHubService] Fetching auto-updating latest_movies.m3u from GitHub...');
            let rawData = '';

            try {
                const res = await axios.get<string>(SM_MOVIE_PRIMARY_URL, {
                    timeout: 25000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                rawData = res.data;
            } catch (pErr: any) {
                console.warn(`[SmMovieHubService] Primary fetch failed (${pErr?.message}), trying backup Movie_Combined.m3u...`);
                try {
                    const resBackup = await axios.get<string>(SM_MOVIE_BACKUP_URL, {
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    rawData = resBackup.data;
                } catch (bErr: any) {
                    console.warn(`[SmMovieHubService] Backup fetch failed (${bErr?.message}). Checking local disk cache...`);
                }
            }

            // If GitHub fetch succeeded, persist to disk cache
            if (rawData && rawData.length > 5000) {
                try {
                    const dir = path.dirname(LOCAL_CACHE_FILE);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(LOCAL_CACHE_FILE, rawData, 'utf-8');
                } catch (fsErr) {
                    console.error('[SmMovieHubService] Failed writing local disk cache:', fsErr);
                }
            } else if (fs.existsSync(LOCAL_CACHE_FILE)) {
                // Fallback to local disk cache
                console.log('[SmMovieHubService] Loading from local disk cache:', LOCAL_CACHE_FILE);
                rawData = fs.readFileSync(LOCAL_CACHE_FILE, 'utf-8');
            }

            if (!rawData) {
                throw new Error('No data available from GitHub or local disk cache.');
            }

            cache = parseM3uToCache(rawData);
            console.log(`[SmMovieHubService] Indexed ${cache.items.length} titles across ${cache.categories.length} categories.`);
            return cache;
        } catch (err: any) {
            console.error('[SmMovieHubService] Error loading SM Movie playlist:', err?.message || err);
            if (cache) return cache;
            return {
                items: [],
                categories: [],
                movieIndex: new Map(),
                seriesIndex: new Map(),
                idIndex: new Map(),
                timestamp: 0
            };
        } finally {
            fetchingPromise = null;
        }
    })();

    return fetchingPromise;
}

export async function isStreamUrlAlive(rawUrl: string, ref: string): Promise<boolean> {
    const cleanUrl = encodeURI(rawUrl.split('|')[0].trim().replace(/herthg\.b-cdn\.net/gi, 'qwefgh.b-cdn.net'));
    try {
        const res = await axios.head(cleanUrl, {
            headers: {
                'Referer': ref || 'https://fibwatch.art/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 3000,
            validateStatus: s => (s >= 200 && s < 400)
        });
        return true;
    } catch {
        try {
            const res = await axios.get(cleanUrl, {
                headers: {
                    'Referer': ref || 'https://fibwatch.art/',
                    'Range': 'bytes=0-1024',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 3000,
                validateStatus: s => (s >= 200 && s < 400)
            });
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Match a movie or TV episode against the SM Movie Hub catalog
 */
export async function findSmMovieStream(params: {
    type?: 'movie' | 'tv';
    title?: string;
    year?: string | number;
    season?: number | string;
    episode?: number | string;
}): Promise<{
    success: boolean;
    scraperName: string;
    duration?: number;
    audioTracks?: Array<{
        index: number;
        streamIndex: number;
        codec: string;
        language: string;
        label: string;
    }>;
    sources: Array<{
        url: string;
        directUrl: string;
        transcodeUrl: string;
        quality: string;
        type: string;
        label: string;
        name: string;
        referrer?: string;
        userAgent?: string;
    }>;
    matchedTitle?: string;
}> {
    if (!params.title) {
        return { success: false, scraperName: 'SM Movie Hub', sources: [] };
    }

    const data = await getSmMovieData();
    const cleanQ = normalizeTitle(params.title);
    if (!cleanQ) {
        return { success: false, scraperName: 'SM Movie Hub', sources: [] };
    }

    const isTv = params.type === 'tv' || (params.type !== 'movie' && params.season !== undefined && params.episode !== undefined);
    const reqYear = params.year ? parseInt(String(params.year), 10) : undefined;
    const reqSeason = params.season !== undefined ? parseInt(String(params.season), 10) : undefined;
    const reqEpisode = params.episode !== undefined ? parseInt(String(params.episode), 10) : undefined;

    let candidates: SmMovieItem[] = [];

    if (isTv) {
        // Look up in series index
        const seriesList = data.seriesIndex.get(cleanQ) || [];
        if (seriesList.length > 0) {
            candidates = seriesList.filter(item => {
                if (reqSeason !== undefined && item.season !== undefined && item.season !== reqSeason) {
                    return false;
                }
                if (reqEpisode !== undefined) {
                    if (item.episode !== undefined) {
                        if (item.episodeEnd !== undefined) {
                            return reqEpisode >= item.episode && reqEpisode <= item.episodeEnd;
                        }
                        return item.episode === reqEpisode;
                    }
                }
                return true;
            });
        }

        // If no exact series found, search substring and token overlap
        if (candidates.length === 0) {
            for (const [sKey, items] of data.seriesIndex.entries()) {
                if (sKey.includes(cleanQ) || cleanQ.includes(sKey)) {
                    for (const item of items) {
                        if (reqSeason !== undefined && item.season !== undefined && item.season !== reqSeason) {
                            continue;
                        }
                        if (reqEpisode !== undefined && item.episode !== undefined) {
                            if (item.episodeEnd !== undefined) {
                                if (reqEpisode >= item.episode && reqEpisode <= item.episodeEnd) {
                                    candidates.push(item);
                                }
                            } else if (item.episode === reqEpisode) {
                                candidates.push(item);
                            }
                        } else {
                            candidates.push(item);
                        }
                    }
                }
            }
        }
    }

    if (!isTv || candidates.length === 0) {
        // Look up in movie index
        const movieList = data.movieIndex.get(cleanQ) || [];
        if (movieList.length > 0) {
            if (reqYear) {
                const yearMatches = movieList.filter(m => m.year === reqYear || m.year === reqYear - 1 || m.year === reqYear + 1);
                candidates = yearMatches.length > 0 ? yearMatches : movieList;
            } else {
                candidates = movieList;
            }
        }

        // Substring / token fallback
        if (candidates.length === 0) {
            for (const [mKey, items] of data.movieIndex.entries()) {
                if (mKey.length >= 3 && (mKey.includes(cleanQ) || cleanQ.includes(mKey))) {
                    if (reqYear) {
                        const yearMatches = items.filter(m => m.year === reqYear || m.year === reqYear - 1 || m.year === reqYear + 1);
                        if (yearMatches.length > 0) {
                            candidates.push(...yearMatches);
                        } else {
                            candidates.push(...items);
                        }
                    } else {
                        candidates.push(...items);
                    }
                }
            }
        }
    }

    if (candidates.length === 0) {
        return { success: false, scraperName: 'SM Movie Hub', sources: [] };
    }

    // Filter candidates through quick reachability probe
    const validCandidates: SmMovieItem[] = [];
    for (const c of candidates.slice(0, 8)) {
        const alive = await isStreamUrlAlive(c.streamUrl, c.referrer || 'https://fibwatch.art/');
        if (alive) {
            validCandidates.push(c);
            if (validCandidates.length >= 3) break;
        }
    }

    if (validCandidates.length === 0) {
        return { success: false, scraperName: 'SM Movie Hub', sources: [] };
    }

    const activeCandidates = validCandidates;

    // Sort candidates: prefer 1080p / Dual Audio / exact matches
    const sources = activeCandidates.map(c => {
        let streamType = 'video/mp4';
        let cleanDirectUrl = c.streamUrl.split('|')[0].trim().replace(/herthg\.b-cdn\.net/gi, 'qwefgh.b-cdn.net');
        try {
            cleanDirectUrl = decodeURI(cleanDirectUrl);
        } catch (_) {}

        if (cleanDirectUrl.toLowerCase().includes('.mkv')) streamType = 'video/x-matroska';
        else if (cleanDirectUrl.toLowerCase().includes('.m3u8')) streamType = 'application/x-mpegurl';

        const label = `SM Movie Hub (${c.quality || '1080p'} - ${c.language || 'Multi'})`;
        const ref = c.referrer || 'https://fibwatch.art/';
        const isMkv = cleanDirectUrl.toLowerCase().includes('.mkv');
        const activeUrl = isMkv 
            ? `/api/transcode/mkv?url=${encodeURIComponent(cleanDirectUrl)}&ref=${encodeURIComponent(ref)}`
            : `/stream_proxy.php?url=${encodeURIComponent(cleanDirectUrl)}&referer=${encodeURIComponent(ref)}`;

        return {
            url: activeUrl,
            directUrl: cleanDirectUrl,
            transcodeUrl: `/api/transcode/mkv?url=${encodeURIComponent(cleanDirectUrl)}&ref=${encodeURIComponent(ref)}`,
            quality: c.quality || '1080p',
            type: isMkv ? 'video/mp4' : streamType,
            label: label,
            name: c.title,
            referrer: ref,
            userAgent: c.userAgent
        };
    });

    // Probe metadata (duration & audio tracks) for top candidate stream
    let meta: MkvMetadata | null = null;
    if (activeCandidates[0] && activeCandidates[0].streamUrl) {
        meta = await probeMkvMetadata(activeCandidates[0].streamUrl, activeCandidates[0].referrer || 'https://fibwatch.art/');
    }

    return {
        success: true,
        scraperName: 'SM Movie Hub (Direct VOD/MKV)',
        duration: meta?.duration || 0,
        audioTracks: meta?.audioTracks || [],
        sources,
        matchedTitle: activeCandidates[0].title
    };
}

/**
 * Search the SM Movie Hub catalog
 */
export async function searchSmMovies(query: string, limit = 60): Promise<SmMovieItem[]> {
    if (!query) return [];
    const data = await getSmMovieData();
    const cleanQ = normalizeTitle(query);
    const qLower = query.toLowerCase().trim();

    const results: SmMovieItem[] = [];
    for (const item of data.items) {
        if (item.cleanTitle.includes(cleanQ) || item.title.toLowerCase().includes(qLower)) {
            results.push(item);
            if (results.length >= limit) break;
        }
    }
    return results;
}

/**
 * Get categories list
 */
export async function getSmMovieCategories(): Promise<SmMovieCategory[]> {
    const data = await getSmMovieData();
    return data.categories;
}

/**
 * Get items by category with pagination
 */
export async function getSmMoviesByCategory(category?: string, page = 1, limit = 50): Promise<{
    items: SmMovieItem[];
    total: number;
    page: number;
    totalPages: number;
}> {
    const data = await getSmMovieData();
    let filtered = data.items;

    if (category && category !== 'All') {
        filtered = filtered.filter(i => i.group.toLowerCase() === category.toLowerCase());
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
        items,
        total,
        page,
        totalPages
    };
}

export function initSmMovieAutoUpdate() {
    if (autoUpdateTimer) return;
    getSmMovieData().catch(() => {});
    autoUpdateTimer = setInterval(() => {
        console.log('[SmMovieHubService] Running 25-minute background auto-refresh...');
        getSmMovieData(true).catch(e => console.error('[SmMovieHubService] Auto-refresh failed:', e?.message));
    }, 25 * 60 * 1000);
}
