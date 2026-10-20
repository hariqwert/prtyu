import axios from 'axios';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 50,
    timeout: 0,
    keepAliveMsecs: 10000
});

export interface TimChannelStream {
    name: string;
    url: string;
    vip?: boolean;
}

export interface TimChannel {
    url: string;
    name: string;
    logo?: string;
    genre?: number;
    flag?: string;
    vip?: boolean;
    viewers?: number;
    streams?: TimChannelStream[];
}

export interface TimLiveEventStream {
    name: string;
    url?: string;
    embedSlug?: string;
    vip?: boolean;
}

export interface TimLiveEvent {
    url: string;
    name: string;
    logo?: string;
    genre?: number;
    sub_genre?: number;
    time?: string | number;
    isevent?: boolean;
    vip?: boolean;
    featured?: boolean;
    viewers?: number;
    category?: string;
    streams: TimLiveEventStream[];
}

export interface TimStreamsCategory {
    category: string;
    events: any[];
}

// In-memory cache for TimStreams channels list (TTL: 5 minutes)
let channelsCache: TimChannel[] = [];
let channelsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory cache for TimStreams live events list (TTL: 2 minutes)
let liveEventsCache: TimLiveEvent[] = [];
let liveEventsCacheTime = 0;
const EVENTS_CACHE_TTL_MS = 2 * 60 * 1000;

// In-memory cache for all streams categories
let allCategoriesCache: TimStreamsCategory[] = [];
let allCategoriesCacheTime = 0;

// Load static fallback if memory cache is empty
function loadFallbackChannels(): TimChannel[] {
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_channels.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {}
    return [];
}

// Load static fallback for live events
function loadFallbackLiveEvents(): TimLiveEvent[] {
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_live_events.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                const evCat = parsed.find((c: any) => c.category === 'Events' || c.category === 'Live');
                if (evCat && Array.isArray(evCat.events)) {
                    return evCat.events.map((ev: any) => mapRawTimEvent(ev));
                }
            }
        }
    } catch (e) {}
    return [];
}

export function getSportCategoryName(genre?: number, subGenre?: number, titleOrName?: string): string {
    const text = (titleOrName || '').toLowerCase();

    // 1. Text-based detection from Channel Name / Match Title (Highest Accuracy)
    if (text.includes('cricket') || text.includes('willow') || text.includes('ipl') || text.includes('t20') || text.includes('bcci') || text.includes('astro cricket') || text.includes('star sports 1') || text.includes('star sports hindi')) {
        return 'Cricket';
    }
    if (text.includes('football') || text.includes('soccer') || text.includes('premier league') || text.includes('laliga') || text.includes('serie a') || text.includes('bundesliga') || text.includes('uefa') || text.includes('champions league') || text.includes('chelsea') || text.includes('arsenal') || text.includes('liverpool') || text.includes('madrid') || text.includes('barca') || text.includes('sportdigital') || text.includes('sky sports premier') || text.includes('sky sports football') || text.includes('mls') || text.includes('copa') || text.includes('chile') || text.includes('brazil') || text.includes('argentina') || text.includes('fifa')) {
        return 'Football / Soccer';
    }
    if (text.includes('f1') || text.includes('formula 1') || text.includes('motogp') || text.includes('nascar') || text.includes('indycar') || text.includes('rally') || text.includes('dazn f1') || text.includes('sky sports f1') || text.includes('speedway') || text.includes('dirtvision') || text.includes('racing') || text.includes('supercross')) {
        return 'Motorsport / F1';
    }
    if (text.includes('tennis') || text.includes('wimbledon') || text.includes('atp') || text.includes('wta') || text.includes('us open') || text.includes('roland garros') || text.includes('tennis channel') || text.includes('australian open')) {
        return 'Tennis';
    }
    if (text.includes('ufc') || text.includes('wwe') || text.includes('boxing') || text.includes('mma') || text.includes('smackdown') || text.includes('raw') || text.includes('nxt') || text.includes('fight pass') || text.includes('fight network') || text.includes('contender series') || text.includes('dana white') || text.includes('pantoja') || text.includes('knockout') || text.includes('bellator')) {
        return 'Combat Sports / UFC';
    }
    if (text.includes('nba') || text.includes('basketball') || text.includes('euroleague') || text.includes('wnba') || text.includes('ncaa') || text.includes('rams vs') || text.includes('hawks') || text.includes('celtics') || text.includes('lakers') || text.includes('warriors')) {
        return 'Basketball / NBA';
    }
    if (text.includes('nfl') || text.includes('american football') || text.includes('super bowl') || text.includes('redzone') || text.includes('touchdown')) {
        return 'American Football / NFL';
    }
    if (text.includes('mlb') || text.includes('baseball') || text.includes('astros') || text.includes('sox') || text.includes('yankees') || text.includes('padres') || text.includes('cubs') || text.includes('dodgers') || text.includes('mets') || text.includes('braves') || text.includes('phillies') || text.includes('red sox') || text.includes('white sox')) {
        return 'Baseball / MLB';
    }
    if (text.includes('golf') || text.includes('pga') || text.includes('liv golf') || text.includes('masters') || text.includes('ryder cup')) {
        return 'Golf / PGA Tour';
    }
    if (text.includes('nhl') || text.includes('ice hockey') || text.includes('stanley cup')) {
        return 'Ice Hockey / NHL';
    }

    // 2. Fallback to API genre IDs
    switch (genre) {
        case 9: return 'Baseball / MLB';
        case 2: return 'Motorsport / F1';
        case 3: return 'Combat Sports / UFC';
        case 4: return 'Combat Sports / UFC';
        case 5: return 'Tennis';
        case 6: return 'Cricket';
        case 7: return 'Rugby';
        case 8: return 'American Football / NFL';
        case 11: return 'Ice Hockey / NHL';
        case 17: return 'Combat Sports / UFC';
        case 1:
            if (subGenre === 1) return 'Football / Premier League';
            if (subGenre === 3) return 'Football / Bundesliga';
            if (subGenre === 5) return 'Football / Serie A';
            return 'Live Sports';
        default: return 'Live Sports';
    }
}

function mapRawTimEvent(ev: any): TimLiveEvent {
    const streams: TimLiveEventStream[] = (ev.streams || []).map((s: any) => {
        let embedSlug = '';
        if (s.url) {
            const m = s.url.match(/exmxbxe\.cfd\/([a-zA-Z0-9_-]+)/);
            if (m) embedSlug = m[1];
            else embedSlug = s.url.replace(/^https?:\/\/[^\/]+\//, '');
        }
        return {
            name: s.name || 'Stream',
            url: s.url,
            embedSlug: embedSlug || undefined,
            vip: !!s.vip
        };
    });
    const eventName = (ev.name || 'Live Event').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    return {
        url: ev.url || '',
        name: eventName,
        logo: ev.logo || '',
        genre: ev.genre,
        sub_genre: ev.sub_genre,
        time: ev.time,
        isevent: true,
        vip: !!ev.vip,
        featured: !!ev.featured,
        viewers: ev.viewers || 0,
        category: getSportCategoryName(ev.genre, ev.sub_genre, eventName),
        streams
    };
}

const TIMSTREAMS_MIRRORS = [
    'https://timst.top',
    'https://timst.cfd'
];

/**
 * Fetch all categories (Events, Replays, 24/7) from TimStreams mirrors
 */
export async function getAllTimStreams(forceRefresh = false): Promise<TimStreamsCategory[]> {
    const now = Date.now();
    if (!forceRefresh && allCategoriesCache.length > 0 && (now - allCategoriesCacheTime < EVENTS_CACHE_TTL_MS)) {
        return allCategoriesCache;
    }

    for (const origin of TIMSTREAMS_MIRRORS) {
        try {
            const res = await axios.get(`${origin}/api/streams`, {
                headers: {
                    'Referer': `${origin}/`,
                    'Origin': origin,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                httpsAgent: agent,
                timeout: 8000
            });

            if (Array.isArray(res.data) && res.data.length > 0) {
                allCategoriesCache = res.data;
                allCategoriesCacheTime = now;
                // Also write out cache
                try {
                    fs.writeFileSync(path.join(process.cwd(), 'assets', 'tim_live_events.json'), JSON.stringify(res.data, null, 2), 'utf8');
                } catch (e) {}
                return res.data;
            }
        } catch (e: any) {
            // Try next mirror
        }
    }

    console.info('[TimStreamsService] Upstream /api/streams temporarily unavailable, using cached schedule.');

    // Fallback to disk cache
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_live_events.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allCategoriesCache = parsed;
                allCategoriesCacheTime = now;
                return parsed;
            }
        }
    } catch (e) {}

    return allCategoriesCache;
}

/**
 * Fetch all LIVE EVENTS from TimStreams API (with fallback to assets/tim_live_events.json and top 24/7 sports channels)
 */
export async function getTimLiveEvents(forceRefresh = false): Promise<TimLiveEvent[]> {
    const now = Date.now();
    if (!forceRefresh && liveEventsCache.length > 0 && (now - liveEventsCacheTime < EVENTS_CACHE_TTL_MS)) {
        return liveEventsCache;
    }

    const categories = await getAllTimStreams(forceRefresh);
    let events: TimLiveEvent[] = [];
    const evCat = categories.find((c: any) => c.category === 'Events' || c.category === 'Live');
    if (evCat && Array.isArray(evCat.events) && evCat.events.length > 0) {
        events = evCat.events.map((ev: any) => mapRawTimEvent(ev));
    }

    // Include Replays category (e.g. UFC events, match replays)
    const replayCat = categories.find((c: any) => c.category === 'Replays');
    if (replayCat && Array.isArray(replayCat.events) && replayCat.events.length > 0) {
        replayCat.events.forEach((ev: any) => {
            const mapped = mapRawTimEvent(ev);
            if (!events.some(e => e.url === mapped.url || e.name === mapped.name)) {
                events.push(mapped);
            }
        });
    }

    // Only if zero scheduled match/fight events found upstream, fallback to top 24/7 sports channels
    if (events.length === 0) {
        const ch247 = categories.find((c: any) => c.category === '24/7');
        if (ch247 && Array.isArray(ch247.events)) {
            const sportsChannels = ch247.events.filter((ch: any) => {
                const sportName = getSportCategoryName(ch.genre, ch.sub_genre, ch.name);
                return sportName && !['General / Entertainment', 'Entertainment', 'Family', 'Kids', 'News', 'Movies', 'Live Sports'].includes(sportName);
            });

            sportsChannels.forEach((ch: any) => {
                events.push({
                    url: ch.url || (ch.name || 'channel').toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    name: `${ch.name} (Live Sports)`,
                    logo: ch.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
                    genre: ch.genre || 17,
                    sub_genre: ch.sub_genre,
                    time: 'LIVE',
                    isevent: true,
                    vip: ch.vip || false,
                    featured: true,
                    viewers: ch.viewers || 1,
                    category: getSportCategoryName(ch.genre, ch.sub_genre, ch.name),
                    streams: Array.isArray(ch.streams) ? ch.streams.map((s: any) => ({
                        name: s.name || ch.name,
                        url: s.url,
                        embedSlug: ch.url,
                        vip: s.vip || false
                    })) : [{
                        name: ch.name,
                        url: ch.url,
                        embedSlug: ch.url,
                        vip: false
                    }]
                });
            });
        }
    }

    if (events.length > 0) {
        liveEventsCache = events;
        liveEventsCacheTime = now;
    }

    return events;
}

// In-memory cache for decoded stream M3U8 URLs (TTL: 25 seconds for fresh live tokens)
const streamUrlCache = new Map<string, { m3u8: string; timestamp: number }>();
const STREAM_CACHE_TTL_MS = 25 * 1000;

/**
 * Invalidate cached stream URL for a given embed or channel
 */
export function invalidateStreamCache(key?: string) {
    if (key) {
        streamUrlCache.delete(key);
    } else {
        streamUrlCache.clear();
    }
}

/**
 * Fetch all available channels and streams from TimStreams API
 */
export async function getTimChannels(forceRefresh = false): Promise<TimChannel[]> {
    const now = Date.now();
    if (!forceRefresh && channelsCache.length > 0 && (now - channelsCacheTime < CACHE_TTL_MS)) {
        return channelsCache;
    }

    try {
        const res = await axios.get('https://timst.top/api/channels', {
            headers: {
                'Referer': 'https://timst.top/',
                'Origin': 'https://timst.top',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            timeout: 9000
        });

        const raw = res.data?.channels || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
            channelsCache = raw;
            channelsCacheTime = now;
            return raw;
        }
    } catch (e: any) {
        console.warn('[TimStreamsService] Failed to fetch /api/channels:', e?.message || e);
    }

    // Fallback: try secondary /api/streams endpoint if available
    try {
        const resStreams = await axios.get('https://timst.top/api/streams', {
            headers: {
                'Referer': 'https://timst.top/',
                'Origin': 'https://timst.top',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            timeout: 9000
        });
        let raw: TimChannel[] = [];
        if (Array.isArray(resStreams.data)) {
            const cat247 = resStreams.data.find((c: any) => c.category === '24/7' || c.category === 'Channels');
            if (cat247 && Array.isArray(cat247.events) && cat247.events.length > 0) {
                raw = cat247.events;
            }
        }
        if (raw.length > 0) {
            channelsCache = raw;
            channelsCacheTime = now;
            return raw;
        }
    } catch (e: any) {}

    // Fallback to static assets/tim_channels.json
    if (channelsCache.length === 0) {
        const fallback = loadFallbackChannels();
        if (fallback.length > 0) {
            channelsCache = fallback;
            channelsCacheTime = now;
            return fallback;
        }
    }

    return channelsCache;
}

/**
 * Resolve encrypted binary token payload used by 2026 TimStreams / ehgembxe / judiaslevels embeds
 */
async function resolveBinaryTokenUrl(tokenUrl: string, embedUrl?: string): Promise<string | null> {
    try {
        let referer = 'https://ehgembxe.cfd/';
        let origin = 'https://ehgembxe.cfd';
        if (embedUrl && embedUrl.startsWith('http')) {
            try {
                const u = new URL(embedUrl);
                origin = u.origin;
                referer = u.origin + '/';
            } catch (_) {}
        }

        const res = await axios.get(tokenUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': referer,
                'Origin': origin,
                'Accept': '*/*'
            },
            httpsAgent: agent,
            timeout: 5000
        });

        if (res.status === 200 && res.data && res.data.length > 0) {
            const tk = tokenUrl.substring(tokenUrl.lastIndexOf('/') + 1);
            const b = new Uint8Array(res.data);
            const s = b[0];
            let o = '';
            for (let i = 1; i < b.length; i++) {
                o += String.fromCharCode(b[i] ^ tk.charCodeAt((i - 1) % tk.length) ^ ((s + i - 1) & 255));
            }
            if (o.startsWith('http') && o.includes('.m3u8')) {
                return o;
            }
        }
    } catch (e: any) {
        // Fallback: curl sub-process
        try {
            const tk = tokenUrl.substring(tokenUrl.lastIndexOf('/') + 1);
            let referer = 'https://ehgembxe.cfd/';
            let origin = 'https://ehgembxe.cfd';
            if (embedUrl && embedUrl.startsWith('http')) {
                try {
                    const u = new URL(embedUrl);
                    origin = u.origin;
                    referer = u.origin + '/';
                } catch (_) {}
            }
            const buf = await new Promise<Buffer | null>((resolve) => {
                const args = [
                    '-s', '-L', tokenUrl,
                    '-H', `Referer: ${referer}`,
                    '-H', `Origin: ${origin}`,
                    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    '--max-time', '4'
                ];
                execFile('curl', args, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                    if (err || !stdout || stdout.length < 10) return resolve(null);
                    resolve(stdout);
                });
            });
            if (buf && buf.length > 0) {
                const b = new Uint8Array(buf);
                const s = b[0];
                let o = '';
                for (let i = 1; i < b.length; i++) {
                    o += String.fromCharCode(b[i] ^ tk.charCodeAt((i - 1) % tk.length) ^ ((s + i - 1) & 255));
                }
                if (o.startsWith('http') && o.includes('.m3u8')) {
                    return o;
                }
            }
        } catch (_) {}
    }
    return null;
}

/**
 * Extract and deobfuscate M3U8 stream from exmxbxe / ehgembxe / timst embed HTML
 */
export async function extractM3u8FromHtml(html: string, embedUrl?: string): Promise<string | null> {
    if (!html || typeof html !== 'string') return null;

    // Pattern 1: Deobfuscate array XOR / addition cipher used by exmxbxe.cfd, ehgembxe.cfd & timst embeds
    const cipherMatch = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,\s]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (cipherMatch) {
        try {
            const arr = cipherMatch[2].split(',').map(n => parseInt(n.trim(), 10));
            const k1 = parseInt(cipherMatch[4], 10);
            const k2 = parseInt(cipherMatch[6], 10);
            let decoded = '';
            for (let i = 0; i < arr.length; i++) {
                decoded += String.fromCharCode(((arr[i] ^ k1) - k2 + 256) % 256);
            }
            // 1a. Direct M3U8 in decoded code
            const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
            if (m3u8Match) return m3u8Match[0];

            // 1b. Binary token resolver endpoint (loadStreamUrl)
            const tokenMatch = decoded.match(/loadStreamUrl\s*\(\s*["']([^"']+)["']/i) ||
                               decoded.match(/https?:\/\/[^\s'"\\]+\/p\/[a-zA-Z0-9_-]+/i);
            if (tokenMatch) {
                const tokenUrl = tokenMatch[1] || tokenMatch[0];
                const resolved = await resolveBinaryTokenUrl(tokenUrl, embedUrl);
                if (resolved) return resolved;
            }
        } catch (e) {}
    }

    // Pattern 2: atob base64 encoding
    const atobMatch = html.match(/atob\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (atobMatch) {
        try {
            const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
            if (decoded.includes('.m3u8')) return decoded;
        } catch (e) {}
    }

    // Pattern 3: standard semicoloned cipher
    const semiMatch = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    if (semiMatch) {
        try {
            const arr = semiMatch[2].split(',').map(Number);
            const k1 = parseInt(semiMatch[4], 10);
            const k2 = parseInt(semiMatch[6], 10);
            let decoded = '';
            for (let i = 0; i < arr.length; i++) {
                decoded += String.fromCharCode(((arr[i] ^ k1) - k2 + 256) % 256);
            }
            const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
            if (m3u8Match) return m3u8Match[0];

            const tokenMatch = decoded.match(/loadStreamUrl\s*\(\s*["']([^"']+)["']/i) ||
                               decoded.match(/https?:\/\/[^\s'"\\]+\/p\/[a-zA-Z0-9_-]+/i);
            if (tokenMatch) {
                const tokenUrl = tokenMatch[1] || tokenMatch[0];
                const resolved = await resolveBinaryTokenUrl(tokenUrl, embedUrl);
                if (resolved) return resolved;
            }
        } catch (e) {}
    }

    // Pattern 4: Direct loadStreamUrl in raw HTML
    const rawTokenMatch = html.match(/loadStreamUrl\s*\(\s*["']([^"']+)["']/i) ||
                          html.match(/https?:\/\/[^\s'"\\]+\/p\/[a-zA-Z0-9_-]+/i);
    if (rawTokenMatch) {
        const tokenUrl = rawTokenMatch[1] || rawTokenMatch[0];
        const resolved = await resolveBinaryTokenUrl(tokenUrl, embedUrl);
        if (resolved) return resolved;
    }

    // Pattern 5: Direct M3U8 string match
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

/**
 * Fallback to native curl sub-process if Cloudflare WAF or TLS fingerprint blocks Node axios
 */
function fetchHtmlViaCurl(url: string, referer: string = 'https://timst.top/'): Promise<string | null> {
    return new Promise((resolve) => {
        const args = [
            '-s',
            '-L',
            url,
            '-H', `Referer: ${referer}`,
            '-H', 'Origin: https://timst.top',
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            '--max-time', '4'
        ];
        execFile('curl', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout || stdout.length < 50) return resolve(null);
            resolve(stdout);
        });
    });
}

/**
 * Resolve direct M3U8 URL given an embed URL (e.g. https://ehgembxe.cfd/2e3uhhu1-7488 or https://exmxbxe.cfd/nhmzkzez-7144)
 */
export async function resolveEmbedUrl(embedUrl: string, forceFresh = false): Promise<string | null> {
    if (!embedUrl || !embedUrl.startsWith('http')) return null;

    if (!forceFresh) {
        const cached = streamUrlCache.get(embedUrl);
        if (cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL_MS)) {
            return cached.m3u8;
        }
    }

    const browserHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://timst.top/',
        'Origin': 'https://timst.top',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    // Prioritize direct URL first for speed (sub-second resolution)
    const candidates = [embedUrl];
    
    // Add primary mirror domain only if needed
    if (embedUrl.includes('exmxbxe.cfd')) {
        candidates.push(embedUrl.replace('exmxbxe.cfd', 'ehgembxe.cfd'));
    } else if (embedUrl.includes('ehgembxe.cfd')) {
        candidates.push(embedUrl.replace('ehgembxe.cfd', 'exmxbxe.cfd'));
    } else if (embedUrl.includes('grandemx.org')) {
        candidates.push(embedUrl.replace('grandemx.org', 'ehgembxe.cfd'));
    }

    for (const urlToTry of candidates) {
        let html: string | null = null;
        try {
            const res = await axios.get(urlToTry, {
                headers: browserHeaders,
                httpsAgent: agent,
                timeout: 3500
            });
            if (res.status === 200 && typeof res.data === 'string') {
                html = res.data;
            }
        } catch (e: any) {
            html = await fetchHtmlViaCurl(urlToTry, 'https://timst.top/');
        }

        if (html) {
            const m3u8 = await extractM3u8FromHtml(html, urlToTry);
            if (m3u8 && !m3u8.includes('epidd.hundxvision.co.uk')) {
                streamUrlCache.set(embedUrl, { m3u8, timestamp: Date.now() });
                if (urlToTry !== embedUrl) {
                    streamUrlCache.set(urlToTry, { m3u8, timestamp: Date.now() });
                }
                return m3u8;
            }
        }
    }

    console.info(`[TimStreamsService] Embed stream currently unavailable or ended: ${embedUrl}`);
    return null;
}

// Canonical alias dictionary for channels with regional / prefix variations
const KNOWN_ALIASES: Record<string, string> = {
    // Willow Cricket
    'willow': 'willow-cricket',
    'willow-hd': 'willow-cricket',
    'willow-usa': 'willow-cricket',
    'willowcricket-usa': 'willow-cricket',
    'willowcricket': 'willow-cricket',
    'willow-1': 'willow-cricket',
    '247-willow': 'willow-cricket',
    '247-willow-hd': 'willow-cricket',
    'willow-2': 'willow-cricket-2',
    'willow2': 'willow-cricket-2',
    'willow-2-usa': 'willow-cricket-2',
    'willowcricket2': 'willow-cricket-2',
    '247-willow-2': 'willow-cricket-2',

    // Sky Sports UK
    'sky-sports-cricket': 'sky-sports-cricket',
    'skysportscricket': 'sky-sports-cricket',
    'skysportscricket-uk': 'sky-sports-cricket',
    'sky-sports-premier-league': 'sky-sports-premier-league',
    'skysportspremierleague': 'sky-sports-premier-league',
    'skysportspremierleague-uk': 'sky-sports-premier-league',
    'sky-sports-main-event': 'sky-sports-main-event',
    'skysportsmainevent': 'sky-sports-main-event',
    'skysportsmainevent-uk': 'sky-sports-main-event',
    'sky-sports-football': 'sky-sports-football',
    'skysportsfootball': 'sky-sports-football',
    'skysportsfootball-uk': 'sky-sports-football',
    'sky-sports-f1': 'sky-sports-f1',
    'skysportsf1': 'sky-sports-f1',
    'skysportsf1-uk': 'sky-sports-f1',
    'sky-sports-action': 'sky-sports-action',
    'skysportsaction': 'sky-sports-action',
    'skysportsaction-uk': 'sky-sports-action',
    'sky-sports-golf': 'sky-sports-golf',
    'skysportsgolf': 'sky-sports-golf',
    'skysportsgolf-uk': 'sky-sports-golf',
    'sky-sports-news': 'sky-sports-news',
    'skysportsnews': 'sky-sports-news',
    'skysportsnews-uk': 'sky-sports-news',
    'sky-sports-tennis': 'sky-sports-tennis',
    'skysportstennis': 'sky-sports-tennis',
    'skysportstennis-uk': 'sky-sports-tennis',
    'sky-sports-racing': 'sky-sports-racing',
    'skysportsracing': 'sky-sports-racing',
    'sky-sports-plus': 'sky-sports-plus',
    'skysportsplus': 'sky-sports-plus',
    'sky-sports-mix': 'sky-sports-mix',
    'skysportsmix': 'sky-sports-mix',

    // TNT Sports UK
    'tnt-sports-1': 'tnt-sports-1',
    'tntsports1': 'tnt-sports-1',
    'tntsports1-uk': 'tnt-sports-1',
    'tnt-sports-2': 'tnt-sports-2',
    'tntsports2': 'tnt-sports-2',
    'tntsports2-uk': 'tnt-sports-2',
    'tnt-sports-3': 'tnt-sports-3',
    'tntsports3': 'tnt-sports-3',
    'tntsports3-uk': 'tnt-sports-3',
    'tnt-sports-4': 'tnt-sports-4',
    'tntsports4': 'tnt-sports-4',
    'tntsports4-uk': 'tnt-sports-4',

    // Sony Sports Network
    'sony-sports-1': 'sony-sports-network',
    'sony-sports-network': 'sony-sports-network',
    'sonyten1': 'sony-sports-network',
    'sony-ten-1': 'sony-sports-network',
    'sonyten1-in': 'sony-sports-network',
    'sony-sports-2': 'sony-sports-network-2',
    'sony-sports-network-2': 'sony-sports-network-2',
    'sonyten2': 'sony-sports-network-2',
    'sony-ten-2': 'sony-sports-network-2',
    'sonyten2-in': 'sony-sports-network-2',
    'sony-sports-3': 'sony-sports-network-3',
    'sony-sports-network-3': 'sony-sports-network-3',
    'sonyten3': 'sony-sports-network-3',
    'sony-ten-3': 'sony-sports-network-3',
    'sonyten3-in': 'sony-sports-network-3',
    'sony-sports-4': 'sony-sports-network-4',
    'sony-sports-network-4': 'sony-sports-network-4',
    'sony-six': 'sony-sports-network-4',
    'sonysix': 'sony-sports-network-4',
    'sonysix-in': 'sony-sports-network-4',
    'sony-sports-5': 'sony-sports-network-5',
    'sony-sports-network-5': 'sony-sports-network-5',

    // Fox Sports
    'fox-cricket': 'fox-sports-501-cricket',
    'foxcricket': 'fox-sports-501-cricket',
    'foxcricket-au': 'fox-sports-501-cricket',
    'fox-sports-501': 'fox-sports-501-cricket',
    'fox-sports-1': 'fox-sports-1',
    'fs1': 'fox-sports-1',
    'fs1-usa': 'fox-sports-1',
    'fox-sports-2': 'fox-sports-2',
    'fs2': 'fox-sports-2',
    'fs2-usa': 'fox-sports-2',

    // ESPN
    'espn': 'espn',
    'espn-usa': 'espn',
    'espn-2': 'espn2',
    'espn2': 'espn2',
    'espn2-usa': 'espn2',

    // Eleven Sports
    'eleven-sports-1-poland': 'eleven-sports-1',
    'eleven-sports-2-poland': 'eleven-sports-2',
    'eleven-sports-3-poland': 'eleven-sports-3',
    'eleven-sports-4-poland': 'eleven-sports-4',

    // beIN & DAZN
    'bein-sports-1': 'bein-sports',
    'beinsports-usa': 'bein-sports',
    'dazn-1': 'dazn-1-spain',
    'dazn1-uk': 'dazn-1-spain',
    'ufc-fight-pass': 'ufc-fight-pass-24-7',
    'ufc': 'ufc-fight-pass-24-7'
};

/**
 * Resolve a channel slug or ID (e.g., 'abc', 'cartoon-network', 'tim_abc', 'tim_cartoon-network')
 */
export async function resolveTimChannel(channelSlugOrId: string, forceFresh = false): Promise<string | null> {
    if (!channelSlugOrId) return null;

    // 1. If it is an HTTP/HTTPS URL, detect whether it is a timst.top page or an embed
    if (channelSlugOrId.startsWith('http://') || channelSlugOrId.startsWith('https://')) {
        const pageMatch = channelSlugOrId.match(/https?:\/\/(?:www\.)?timst\.(?:top|cfd)\/(?:channel|watch|replay|live-tv)\/([a-zA-Z0-9_\-]+)/i);
        if (pageMatch && pageMatch[1]) {
            channelSlugOrId = pageMatch[1];
        } else if (channelSlugOrId.includes('exmxbxe') || channelSlugOrId.includes('ehgembxe') || channelSlugOrId.includes('grandemx') || channelSlugOrId.includes('epiembeds') || channelSlugOrId.includes('/e/')) {
            return await resolveEmbedUrl(channelSlugOrId, forceFresh);
        } else if (channelSlugOrId.includes('timst') && channelSlugOrId.includes('/channel/')) {
            channelSlugOrId = channelSlugOrId.split('/channel/')[1].split(/[?#]/)[0];
        } else {
            return channelSlugOrId;
        }
    }

    let cleanSlug = channelSlugOrId
        .replace(/^(tim_ev_|tim-|tim_|embed-|embed_|embedindia-|dlhd-|dlhd_|247-|ev_)/i, '')
        .replace(/^(tim|embed|embedindia|dlhd|247|ev)[_-]?/i, '')
        .replace(/^channel\//i, '')
        .replace(/^live-tv\//i, '')
        .trim()
        .toLowerCase();

    // Check direct alias dictionary
    if (KNOWN_ALIASES[cleanSlug]) {
        cleanSlug = KNOWN_ALIASES[cleanSlug];
    } else {
        // Strip country code suffixes (-uk, -usa, -us, -in, -au, -za, -pl, -fr, -ie)
        const strippedCountry = cleanSlug.replace(/-(uk|usa|us|in|au|za|pl|fr|ie)$/i, '');
        if (KNOWN_ALIASES[strippedCountry]) {
            cleanSlug = KNOWN_ALIASES[strippedCountry];
        }
    }

    // 2. Fetch or retrieve from cache
    const channels = await getTimChannels();
    
    // Match 1: Exact URL slug match
    let target = channels.find(c => c.url?.toLowerCase() === cleanSlug);

    // Match 2: Normalized alphanumeric slug match (e.g. 'skysportscricket' === 'sky-sports-cricket')
    if (!target) {
        const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum);
    }

    // Match 3: Channel Name normalized match
    if (!target) {
        const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum);
    }

    // Match 4: Normalized name with country stripped
    if (!target) {
        const strippedClean = cleanSlug.replace(/(uk|usa|us|in|au|za|pl|fr|ie)$/i, '').replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === strippedClean || (c.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === strippedClean);
    }

    if (target && target.streams && target.streams.length > 0) {
        for (const streamObj of target.streams) {
            if (streamObj.url) {
                const resolved = await resolveEmbedUrl(streamObj.url, forceFresh);
                if (resolved) return resolved;
            }
        }
    }

    // 3. Fallback: Check if cleanSlug is a Live Event from timst.top/api/streams (try cache first, then fresh)
    for (const shouldRefresh of [false, true]) {
        try {
            const liveEvents = await getTimLiveEvents(shouldRefresh);
            let matchedEvent = liveEvents.find(e => e.url?.toLowerCase() === cleanSlug);
            if (!matchedEvent) {
                const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
                matchedEvent = liveEvents.find(e => 
                    (e.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum ||
                    (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum
                );
            }
            if (matchedEvent && matchedEvent.streams && matchedEvent.streams.length > 0) {
                for (const st of matchedEvent.streams) {
                    if (st.url) {
                        const resolved = await resolveEmbedUrl(st.url, forceFresh);
                        if (resolved) return resolved;
                    }
                }
            }
            // Also check if cleanSlug matches any event stream's embedSlug directly
            for (const ev of liveEvents) {
                const matchedStream = ev.streams.find(s => s.embedSlug === cleanSlug || s.embedSlug === cleanSlug.replace(/-\d+$/, ''));
                if (matchedStream && matchedStream.url) {
                    const resolved = await resolveEmbedUrl(matchedStream.url, forceFresh);
                    if (resolved) return resolved;
                }
            }
            if (matchedEvent) break;
        } catch(e) {}
    }

    // 4. Fallback: Check if cleanSlug is an exmxbxe or timst slug directly (e.g. e/6x2ugx9gojm5, 6x2ugx9gojm5, b3sfc94n-6526 or nhmzkzez-7144)
    const directSlugCandidates = [
        cleanSlug,
        cleanSlug.replace(/^e[_-]/i, ''),
        cleanSlug.replace(/^e\//i, ''),
        cleanSlug.replace(/^ev[_-]/i, '')
    ];

    for (const s of directSlugCandidates) {
        if (!s) continue;
        const testUrls = [
            `https://ehgembxe.cfd/${s}`,
            `https://ehgembxe.cfd/e/${s}`,
            `https://grandemx.org/${s}`,
            `https://grandemx.org/e/${s}`,
            `https://exmxbxe.cfd/${s}`,
            `https://exmxbxe.cfd/e/${s}`,
            `https://timst.top/${s}`,
            `https://timst.top/e/${s}`,
            `https://timst.cfd/${s}`
        ];
        for (const u of testUrls) {
            try {
                const resolved = await resolveEmbedUrl(u, forceFresh);
                if (resolved) return resolved;
            } catch (e) {}
        }
    }

    // 5. Secondary Fallback: JioTV / MDTV ClearKey HD stream mapping if TimStreams embed is not active or unresolvable
    const SONY_MDTV_MAP: Record<string, string> = {
        'sony-sports-network': '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1',
        'sonyten1': '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1',
        'sony-ten-1': '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1',
        'sony-sports-1': '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1',

        'sony-sports-network-2': '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1',
        'sonyten2': '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1',
        'sony-ten-2': '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1',
        'sony-sports-2': '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1',

        'sony-sports-network-3': '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1',
        'sonyten3': '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1',
        'sony-ten-3': '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1',
        'sony-sports-3': '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1',

        'sony-sports-network-4': '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1',
        'sonyten4': '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1',
        'sony-ten-4': '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1',
        'sony-sports-4': '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1',
        'sonysix': '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1',

        'sony-sports-network-5': '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1',
        'sonyten5': '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1',
        'sony-ten-5': '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1',
        'sony-sports-5': '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1'
    };

    if (SONY_MDTV_MAP[cleanSlug]) {
        return SONY_MDTV_MAP[cleanSlug];
    }

    return null;
}

