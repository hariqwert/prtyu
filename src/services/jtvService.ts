import axios from 'axios';
import https from 'https';
import { syncZeeChannels } from './zeeChannelsService';
import { fetchFanCodeEvents } from './fancodeService';
import { fetchSonyLivEvents } from './sonylivService';
import fs from 'fs';
import path from 'path';

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 10000
});

export interface JtvChannel {
    id: string;
    name: string;
    category: string;
    genre: string;
    stream_url: string;
    cookie: string;
    token: string;
    full_stream_url: string;
    manifest_url: string;
    key_id: string;
    key: string;
    clearkey: string;
    logo: string;
    source: 'jtv' | 'sonyliv' | 'hotstar';
}

export interface LiveSportsEvent {
    id: string;
    name: string;
    title: string;
    badge: string;
    quality: string;
    tournament: string;
    group: string;
    logo: string;
    stream_url: string;
    manifest_type: 'mpd' | 'hls' | 'dash';
    clearkey: string;
    key_id: string;
    key: string;
    referrer: string;
    user_agent: string;
    source: 'live_event' | 'cric_live' | 'fancode' | 'primesport' | 'zyphx8' | 'crichd' | 'sport_special' | 'sonyliv' | 'willow' | 'icc' | 'fifa' | 'tnt' | 'axsports' | string;
    manifest_url?: string;
    full_stream_url?: string;
    token?: string;
    m3u8_content?: string;
}

export interface IplReplayMatch {
    id: string;
    title: string;
    matchNumber: string;
    teams: string;
    language: 'ENGLISH' | 'HINDI' | string;
    logo: string;
    stream_url: string;
    proxy_url: string;
}

export interface CategorySummary {
    name: string;
    count: number;
    icon: string;
}

export function isLinearChannelName(titleOrItem: any): boolean {
    if (!titleOrItem) return false;
    const title = (typeof titleOrItem === 'string' ? titleOrItem : (titleOrItem?.title || titleOrItem?.name || '')).replace(/^[⭐️\s]+/, '').trim();
    if (!title) return false;

    // Fixture / event indicators - if present, it's considered an event rather than a static channel
    const eventMarkers = /\b(vs\.?|v\b|@|match|final|semi-?final|quarter-?final|round\s*\d+|day\s*\d+|innings|test\s*\d+|odi\s*\d+|grand\s*prix|\bgp\b|fight\s*night|ufc\s*\d+|wrestlemania|summerslam|royal\s*rumble|championship|tournament|league\s*\d+|game\s*\d+)\b/i;
    if (eventMarkers.test(title)) {
        return false;
    }

    // Known linear 24/7 channel network patterns
    const channelPatterns = /\b(sports?\s*(?:1|2|3|4|5|hd|uhd|4k|select|ten|six|extra|plus|max|news|premier|action|variety|cricket|football)|star\s*(?:sports|select|plus|gold|bharat|utsav|pravah|jalsha)|sony\s*(?:ten|six|sports|yay|max|sab|bbc|pal|pix|aath|wah)|sky\s*sports|supersport|bein\s*sports|willow\s*(?:tv|hd|extra)|eurosport|dd\s*sports|fox\s*(?:sports|cricket|footy)|tnt\s*sports|dazn|tsn\s*\d*|optus|astro\s*supersport|ptv\s*sports|geo\s*super|ten\s*sports|arena\s*sport|bt\s*sport|espn\s*(?:1|2|hd|extra|news|plus)?|polsat\s*sport|ziggo\s*sport|canal\+\s*sport|laligatv|mutv|chelsea\s*tv|real\s*madrid\s*tv|lfctv|mono\s*max|sportstars|sansad|colors|zee\s*(?:tv|cinema|anmol|keralam)|aaj\s*tak|ndtv)\b/i;

    return channelPatterns.test(title);
}

const JTV_PRIMARY_CATALOG_URL = 'https://raw.githubusercontent.com/sixpg/zeyo-test/main/jtv.m3u';
const JTV_BACKUP_CATALOG_URL = 'https://raw.githubusercontent.com/sportlive18/sportlink-update/main/zio.m3u';
const JTV_CATALOG_URL = JTV_PRIMARY_CATALOG_URL;
const LIVE_EVENTS_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/LiveEvent.m3u';
const SPORTLIVE18_LIVE_M3U_URL = 'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.m3u';
const CRIC_LIVE_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/CricLive.m3u';
const WILDCARD_COOKIE_URL = 'https://allinonereborn2.online/jstrweb2/cookies.json';
const SPORTLIVE18_COOKIE_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/main/cookie.json';
const SONYLIV_FEED_URL = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sony.m3u';
const HOTSTAR_FEED_URL = 'https://raw.githubusercontent.com/sanju-github24/m3u8-player/main/feeds/hotstar.m3u';
const FANCODE_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Fancode-New-Auto-Update/main/fancode.json';
const PRIME_VIDEO_JSON_URL = 'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/primevideo_sports.json';
const PRIME_VIDEO_BACKUP_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/primesport.json';
const IPL_REPLAYS_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/c0e63d06212c481c0f157848e3466d7c6412073d/Replay/IPL2026.m3u';
const ZYPHX8_FANCODE_M3U = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u';
const ZYPHX8_FANCODE_JSON = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json';
const SPORT_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/main/Sport.m3u';
const ICC_LIVE_URL = 'https://raw.githubusercontent.com/doctor-8trange/nexphi0/refs/heads/main/data/icc.m3u';
const FIFA_LIVE_URL = 'https://raw.githubusercontent.com/srhady/fifaplus/refs/heads/main/fifa_live.m3u';
const TNT_SPORTS_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/Tnt.m3u';
const WAVES_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/waves.m3u';
const SONYLIV_EVENTS_JSON = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.json';
const SONYLIV_EVENTS_M3U = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.m3u';
const DOCTOR_8TRANGE_SONY_M3U = 'https://raw.githubusercontent.com/doctor-8trange/zyphora/main/data/sony.m3u';
const WILLOW_EVENTS_JSON = 'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.json';
const WILLOW_EVENTS_BACKUP_JSON = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/willow.json';
const WILLOW_EVENTS_M3U = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/willow.m3u';
const AXSPORTS_M3U = 'https://raw.githubusercontent.com/srhady/axsports/refs/heads/main/playlist.m3u';
const MOVIE_SPOTLIGHT_JSON = 'https://raw.githubusercontent.com/sportlive18/MOVIE-API-AUTO-UPDATE/main/movie.json';
const IPL_HIGHLIGHTS_FANCODE_JSON = 'https://raw.githubusercontent.com/sportlive18/playlist/main/fancode2.json';
const IPL_HIGHLIGHTS_FANCODE3_JSON = 'https://raw.githubusercontent.com/sportlive18/playlist/main/fancode3.json';
const STAR2_SPORTS_JSON = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/star2.json';
const SPORTS_COOKIE_URL = 'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/refs/heads/main/sportcookie.json';
const SPORTLINK_PAGES_JTVPLUS_URL = 'https://sportlink-tv10.pages.dev/jtvplus.json';
const SPORTLINK_PAGES_JTV2_URL = 'https://sportlink-tv10.pages.dev/jtv2.json';

function isTokenExpired(token: string): boolean {
    if (!token) return true;
    const m = token.match(/exp=(\d+)/);
    if (!m) return false;
    const expSec = parseInt(m[1], 10);
    return (expSec * 1000) <= (Date.now() + 30000);
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

let cachedChannels: JtvChannel[] = [];
let lastChannelsFetch = 0;

let cachedSportsCookies: Map<string, string> = new Map();
let lastSportsCookiesFetch = 0;

let cachedManifests: Map<string, { data: string; contentType: string; expires: number }> = new Map();

let cachedEvents: LiveSportsEvent[] = [];
let lastEventsFetch = 0;

let liveEventM3uCache: LiveSportsEvent[] = [];
let lastLiveEventM3uFetch = 0;

let cachedIplReplays: IplReplayMatch[] = [];
let lastIplFetch = 0;

let cachedIplHighlights: IplReplayMatch[] = [];
let lastHighlightsFetch = 0;

let activeWildcardCookie = '';
let lastCookieFetch = 0;
let autoSyncTimer: NodeJS.Timeout | null = null;

export function categorizeChannel(name: string): string {
    const n = (name || '').toLowerCase();
    if (/\b(sport|sports|ten|cricket|euro|dd sports|khel|fancode|willow|golf|nba|wwe|football|kabaddi)\b/i.test(n) ||
        n.includes('sports') || n.includes('ten 1') || n.includes('ten 2') || n.includes('ten 3') || n.includes('ten 4') || n.includes('ten 5') ||
        n.includes('star sports') || n.includes('sony sports')) {
        return 'Sports';
    }
    if (/\b(cinema|movie|movies|star gold|sony max|zee cinema|b4u movies|cineplex|filam|pictures|talkies|box office|action cinema|dhamaal|gold)\b/i.test(n) ||
        n.includes('cinema') || n.includes('movies')) {
        return 'Movies';
    }
    if (/\b(news|aaj tak|ndtv|abp|india today|cnbc|times now|republic|samachar|khabar|tv9|wion|news18|zee news|bharat|dilli|uttar pradesh|bihar|mp)\b/i.test(n) ||
        n.includes('news')) {
        return 'News';
    }
    if (/\b(cartoon|pogo|nick|hungama|disney|sonic|discovery kids|animax|baby|chutti|kochu|junior|cbeebies)\b/i.test(n) ||
        n.includes('kids')) {
        return 'Kids';
    }
    if (/\b(music|mtv|9xm|9x jalwa|zing|b4u music|zoom|mastiii|vh1|song|sangeet|balle balle|mh one|bindass play)\b/i.test(n) ||
        n.includes('music')) {
        return 'Music';
    }
    if (/\b(discovery|nat geo|history|animal planet|tlc|investigation|travel|science|fox life|national geographic)\b/i.test(n)) {
        return 'Infotainment';
    }
    if (/\b(tamil|telugu|kannada|malayalam|bengali|marathi|punjabi|gujarati|bhojpuri|odia|urdu|assamese|bangla|marath|surya|asianet|sun tv|vijay|kalaignar|jaya|polimer|etv|gemini|udaya|tarang|zee bangla|zee marathi|zee telugu|zee tamil|zee kannada|zee sarthak|zee punjabi|star maa|star vijay|star suvarna|star jalsha|star pravah|sun news|kairali|mazhavil|amrita|asianet plus|ptc)\b/i.test(n)) {
        return 'Regional';
    }
    return 'Entertainment';
}

function extractBadgeAndQuality(rawName: string): { name: string; badge: string; quality: string } {
    let cleanName = rawName || '';
    let badge = 'LIVE';
    let quality = 'HD';

    if (/fancode/i.test(cleanName)) badge = 'FANCODE';
    else if (/willow/i.test(cleanName)) badge = 'WILLOW';
    else if (/cricbuzz/i.test(cleanName)) badge = 'CRICBUZZ';
    else if (/cricgo/i.test(cleanName)) badge = 'CRICGO';
    else if (/sony/i.test(cleanName)) badge = 'SONY';
    else if (/star/i.test(cleanName)) badge = 'STAR';

    if (/\bFHD\b/i.test(cleanName) || /1080p/i.test(cleanName)) quality = 'FHD';
    else if (/\bHD\b/i.test(cleanName) || /720p/i.test(cleanName)) quality = 'HD';
    else if (/\bAQ\b/i.test(cleanName)) quality = 'AUTO';
    else if (/\bALT\b/i.test(cleanName)) quality = 'ALT';

    // Format display title
    const parts = cleanName.split(' - ');
    const title = parts[0].trim();

    return { name: title, badge, quality };
}

export class JtvService {
    /**
     * Fetch active wildcard Akamai cookie (__hdnea__ with acl=/*)
     */
    public static async fetchWildcardCookie(force = false): Promise<string> {
        const now = Date.now();
        if (!force && activeWildcardCookie && !isTokenExpired(activeWildcardCookie) && (now - lastCookieFetch < CACHE_TTL_MS)) {
            return activeWildcardCookie;
        }

        try {
            // First check sportlive18 auto-updated cookie.json
            const slRes = await axios.get(SPORTLIVE18_COOKIE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 6000
            });
            if (Array.isArray(slRes.data)) {
                for (const item of slRes.data) {
                    if (item && item.cookie && typeof item.cookie === 'string') {
                        activeWildcardCookie = item.cookie.trim();
                        lastCookieFetch = now;
                        console.log(`[JtvService] Updated wildcard cookie from sportlive18: ${activeWildcardCookie.substring(0, 45)}...`);
                        return activeWildcardCookie;
                    }
                }
            }
        } catch (e: any) {
            // Fallback to secondary endpoint
        }

        try {
            const res = await axios.get(WILDCARD_COOKIE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (Array.isArray(res.data)) {
                for (const item of res.data) {
                    if (item && item.cookie && typeof item.cookie === 'string') {
                        activeWildcardCookie = item.cookie.trim();
                        lastCookieFetch = now;
                        console.log(`[JtvService] Updated wildcard cookie: ${activeWildcardCookie.substring(0, 45)}...`);
                        return activeWildcardCookie;
                    }
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch wildcard cookie from fallback endpoint:', e?.message || e);
        }

        return activeWildcardCookie;
    }

    /**
     * Fetch active sports channel cookies from sportcookie.json (updated every 10 min by sportlive18)
     */
    public static async fetchSportsCookies(force = false): Promise<Map<string, string>> {
        const now = Date.now();
        if (!force && cachedSportsCookies.size > 0 && (now - lastSportsCookiesFetch < 5 * 60 * 1000)) {
            return cachedSportsCookies;
        }

        const newMap = new Map<string, string>();

        // 1. Fetch from sportlink-tv10.pages.dev/jtvplus.json (1,066 channels with direct cookie & stream_url)
        try {
            let slChannels: any[] = [];
            try {
                const slRes = await axios.get(SPORTLINK_PAGES_JTVPLUS_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                slChannels = slRes.data?.channels || (Array.isArray(slRes.data) ? slRes.data : []);
            } catch {
                const slRes = await axios.get(SPORTLINK_PAGES_JTV2_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                slChannels = slRes.data?.channels || (Array.isArray(slRes.data) ? slRes.data : []);
            }
            if (Array.isArray(slChannels)) {
                for (const item of slChannels) {
                    if (!item || !item.id) continue;
                    const cId = String(item.id).trim();
                    const sUrl = item.stream_url || '';
                    const cVal = item.cookie || '';
                    if (sUrl && cVal && !isTokenExpired(cVal)) {
                        const tokenPart = cVal.startsWith('__hdnea__=') ? cVal : `__hdnea__=${cVal}`;
                        const full = `${sUrl}?${tokenPart}`;
                        newMap.set(cId, full);
                    }
                }
            }
        } catch (slErr: any) {
            console.warn('[JtvService] Could not load cookies from sportlink-tv10:', slErr?.message);
        }

        // 2. Overlay Broadpeak sportcookie.json results
        try {
            const res = await axios.get(SPORTS_COOKIE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            const data = res.data;
            const results = [...(data?.successful_results || []), ...(data?.failed_results || [])];
            for (const item of results) {
                if (!item || !item.channel_id) continue;
                let finalUrl = item.final_url || item.error_details?.final_url || '';
                if (finalUrl) {
                    finalUrl = finalUrl.replace('/output/', '/WDVLive/');
                    newMap.set(String(item.channel_id).trim(), finalUrl);
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch sports cookies:', e?.message || e);
        }

        if (newMap.size > 0) {
            cachedSportsCookies = newMap;
            lastSportsCookiesFetch = now;
            console.log(`[JtvService] Loaded ${newMap.size} fresh channel-specific tokens from sportlink-tv10 & sportcookie.`);
        }

        return cachedSportsCookies;
    }

    /**
     * Fetch all channels from JioTV (1,176 ch), SonyLIV Direct CDN (22 ch), and Hotstar (126 ch)
     */
    public static async fetchChannels(force = false): Promise<JtvChannel[]> {
        const now = Date.now();
        if (!force && cachedChannels.length > 0 && (now - lastChannelsFetch < CACHE_TTL_MS)) {
            return cachedChannels;
        }

        const allChannels: JtvChannel[] = [];
        let wildcardCookie = '';

        // 1. Fetch JioTV Channels (Primary: jtvplus3.m3u, Backup: jtv2.json)
        try {
            wildcardCookie = await this.fetchWildcardCookie(force);
            let rawItems: any[] = [];
            let isM3u = false;
            let m3uChannels: JtvChannel[] = [];

            // Always load baseline catalog from local assets/jtv2.json first
            try {
                const localPath = path.resolve(process.cwd(), 'assets', 'jtv2.json');
                if (fs.existsSync(localPath)) {
                    const fileContent = fs.readFileSync(localPath, 'utf8');
                    const parsed = JSON.parse(fileContent);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        rawItems = parsed;
                        console.log(`[JtvService] Loaded baseline ${rawItems.length} JioTV channels from local assets/jtv2.json.`);
                    }
                }
            } catch (lErr: any) {
                console.warn('[JtvService] Failed to load local jtv2.json cache:', lErr?.message);
            }

            // Next, attempt to fetch live auto-updating M3U from GitHub (Primary: zeyo-test, Backup: zio.m3u)
            try {
                let m3uRes: any = null;
                try {
                    m3uRes = await axios.get(JTV_PRIMARY_CATALOG_URL, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        httpsAgent: agent,
                        timeout: 8000
                    });
                } catch (_) {}

                if (!m3uRes || !m3uRes.data || !m3uRes.data.includes('#EXTINF')) {
                    m3uRes = await axios.get(JTV_BACKUP_CATALOG_URL, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        httpsAgent: agent,
                        timeout: 10000
                    });
                }

                if (m3uRes && typeof m3uRes.data === 'string' && m3uRes.data.includes('#EXTINF')) {
                    isM3u = true;
                    m3uChannels = this.parseJtvM3uContent(m3uRes.data, wildcardCookie);
                    console.log(`[JtvService] Fetched ${m3uChannels.length} fresh channels from remote M3U.`);
                }
            } catch (pErr: any) {
                console.warn(`[JtvService] Remote M3U fetch failed (${pErr?.message}), using local catalog.`);
            }

            if (isM3u && m3uChannels.length > 0) {
                allChannels.push(...m3uChannels);
                console.log(`[JtvService] Loaded ${m3uChannels.length} JioTV channels from remote M3U.`);
            } else if (rawItems.length > 0) {
                const jtvChannels = rawItems.map((item: any) => {
                    const id = String(item.id || item.channel_id || '').trim();
                    const name = (item.name || item.channel_name || 'TV Channel').trim();
                    const category = item.catogry || item.category || categorizeChannel(name);

                    let rawCookie = item.cookie || '';
                    if (!rawCookie || isTokenExpired(rawCookie)) {
                        if (wildcardCookie) {
                            rawCookie = wildcardCookie;
                        }
                    }

                    const token = rawCookie.startsWith('__hdnea__=') ? rawCookie : (rawCookie ? `__hdnea__=${rawCookie}` : '');
                    const streamUrl = item.stream_url || item.channel_url || '';
                    const fullStreamUrl = streamUrl ? (streamUrl + (streamUrl.includes('?') ? '&' : '?') + token) : '';
                    const rawKeyId = String(item.key_id || item.keyId || '').trim();
                    const rawKey = String(item.key || '').trim();
                    const keyId = (rawKeyId !== 'null' && rawKeyId !== 'undefined') ? rawKeyId : '';
                    const key = (rawKey !== 'null' && rawKey !== 'undefined') ? rawKey : '';
                    const manifestUrl = id ? `/api/mdtv/manifest/${id}.mpd` : '';

                    return {
                        id,
                        name,
                        category,
                        genre: category,
                        stream_url: streamUrl,
                        cookie: rawCookie,
                        token,
                        full_stream_url: fullStreamUrl,
                        manifest_url: manifestUrl,
                        key_id: keyId,
                        key,
                        clearkey: item.clearkey || ((keyId && key) ? `${keyId}:${key}` : ''),
                        logo: item.logo || item.channel_logo || '',
                        source: 'jtv' as const
                    };
                });
                allChannels.push(...jtvChannels);
                console.log(`[JtvService] Loaded ${jtvChannels.length} JioTV channels from local baseline catalog.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to load JioTV channels:', e?.message || e);
        }

        // 1b. Merge active channel-specific sports tokens from sportcookie.json
        try {
            const sportsTokens = await this.fetchSportsCookies(force);
            if (sportsTokens.size > 0) {
                let updatedWithSports = 0;
                for (const ch of allChannels) {
                    const freshUrl = sportsTokens.get(String(ch.id));
                    if (freshUrl) {
                        const cookiePart = freshUrl.includes('?') ? freshUrl.split('?')[1] : '';
                        const baseUrl = freshUrl.split('?')[0];
                        const isBtsWithWildcard = baseUrl.includes('_BTS') && cookiePart.includes('acl=/*');
                        if (!isBtsWithWildcard) {
                            ch.stream_url = baseUrl || ch.stream_url;
                            if (cookiePart) {
                                ch.cookie = cookiePart;
                                ch.token = cookiePart;
                                ch.full_stream_url = baseUrl + `?${cookiePart}`;
                            }
                            updatedWithSports++;
                        }
                    }
                }
                console.log(`[JtvService] Injected fresh Broadpeak tokens into ${updatedWithSports} sports channels.`);
            }
        } catch (sErr: any) {
            console.warn('[JtvService] Failed to merge sports cookies:', sErr?.message || sErr);
        }

        // 1c. Ingest and merge Sportlink Pages JTVPLUS Dedicated Feed (sportlink-tv10.pages.dev/jtvplus.json) with 1,066+ live channels, official HD logos and multi-key DRM
        try {
            let slChannels: any[] = [];
            try {
                const slRes = await axios.get(SPORTLINK_PAGES_JTVPLUS_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    httpsAgent: agent,
                    timeout: 9000
                });
                slChannels = slRes.data?.channels || (Array.isArray(slRes.data) ? slRes.data : []);
            } catch (errPlus: any) {
                console.warn('[JtvService] jtvplus.json fetch failed, trying jtv2.json fallback:', errPlus?.message || errPlus);
                const slRes2 = await axios.get(SPORTLINK_PAGES_JTV2_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                slChannels = slRes2.data?.channels || (Array.isArray(slRes2.data) ? slRes2.data : []);
            }

            if (Array.isArray(slChannels) && slChannels.length > 0) {
                let updatedCount = 0;
                let addedCount = 0;
                for (const item of slChannels) {
                    const id = String(item.id || '').trim();
                    const name = (item.name || '').trim();
                    if (!id && !name) continue;
                    const rawCookie = item.cookie || '';
                    const token = rawCookie.startsWith('__hdnea__=') ? rawCookie : (rawCookie ? `__hdnea__=${rawCookie}` : '');
                    let streamUrl = (item.stream_url || '').trim();
                    if (streamUrl.includes('|')) {
                        streamUrl = streamUrl.split('|')[0].trim();
                    }
                    const fullStreamUrl = streamUrl ? (streamUrl + (streamUrl.includes('?') ? '&' : '?') + token) : '';
                    const keyId = item.key_id || '';
                    const key = item.key || '';
                    const clearkey = Array.isArray(item.sportlink) && item.sportlink.length > 0
                        ? item.sportlink.join(',')
                        : ((keyId && key) ? `${keyId}:${key}` : '');
                    const manifestUrl = id ? `/api/mdtv/manifest/${id}.mpd` : '';

                    const existingIdx = allChannels.findIndex(c => String(c.id) === id || (name && c.name.toLowerCase() === name.toLowerCase()));
                    const isCookieValid = rawCookie && !isTokenExpired(rawCookie);
                    const cleanCat = categorizeChannel(name);

                    if (existingIdx !== -1) {
                        const existingCh = allChannels[existingIdx];
                        const isExistingMob = existingCh.stream_url && existingCh.stream_url.includes('_MOB');
                        const isNewBtsWithWildcard = streamUrl.includes('_BTS') && (!rawCookie || rawCookie.includes('acl=/*'));

                        if (isCookieValid && (!isExistingMob || !isNewBtsWithWildcard)) {
                            existingCh.cookie = rawCookie;
                            existingCh.token = token;
                            if (streamUrl && !isNewBtsWithWildcard) existingCh.stream_url = streamUrl;
                            if (fullStreamUrl && !isNewBtsWithWildcard) existingCh.full_stream_url = fullStreamUrl;
                        } else if (wildcardCookie) {
                            existingCh.cookie = wildcardCookie;
                            existingCh.token = wildcardCookie;
                            if (existingCh.stream_url) {
                                const base = existingCh.stream_url.split('?')[0].split('|')[0].trim();
                                existingCh.stream_url = base;
                                existingCh.full_stream_url = `${base}?${wildcardCookie}`;
                            }
                        }
                        existingCh.manifest_url = manifestUrl;
                        if (keyId && !isExistingMob) existingCh.key_id = keyId;
                        if (key && !isExistingMob) existingCh.key = key;
                        if (clearkey) {
                            if (!existingCh.clearkey) existingCh.clearkey = clearkey;
                            else {
                                const combined = [...new Set([...existingCh.clearkey.split(','), ...clearkey.split(',')])].join(',');
                                existingCh.clearkey = combined;
                            }
                        }
                        // Always update logo to fresh high-definition official JioTV logo
                        if (item.logo) existingCh.logo = item.logo;
                        existingCh.category = cleanCat;
                        existingCh.genre = cleanCat;
                        updatedCount++;
                    } else {
                        let finalStream = streamUrl;
                        let finalCookie = rawCookie;
                        let finalToken = token;
                        if (!isCookieValid && wildcardCookie) {
                            if (finalStream.includes('_BTS')) {
                                finalStream = finalStream
                                    .replace('jiotvpllive.cdn.jio.com', 'jiotvmblive.cdn.jio.com')
                                    .replace('_BTS', '_MOB');
                            }
                            finalCookie = wildcardCookie;
                            finalToken = wildcardCookie;
                        }
                        const finalFull = finalStream ? (finalStream + (finalStream.includes('?') ? '&' : '?') + finalToken) : '';
                        allChannels.push({
                            id,
                            name,
                            category: cleanCat,
                            genre: cleanCat,
                            stream_url: finalStream,
                            cookie: finalCookie,
                            token: finalToken,
                            full_stream_url: finalFull,
                            manifest_url: manifestUrl,
                            key_id: keyId,
                            key,
                            clearkey,
                            logo: item.logo || '',
                            source: 'jtv' as const
                        });
                        addedCount++;
                    }
                }
                console.log(`[JtvService] sportlink-tv10 jtvplus.json synced: ${updatedCount} updated, ${addedCount} added.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch sportlink-tv10 channels:', e?.message || e);
        }

        // Persist clean updated catalog to local assets/jtv2.json
        try {
            if (allChannels.length > 500) {
                const localPath = path.resolve(process.cwd(), 'assets', 'jtv2.json');
                fs.writeFileSync(localPath, JSON.stringify(allChannels, null, 2), 'utf8');
                console.log(`[JtvService] Persisted ${allChannels.length} channels to assets/jtv2.json.`);
            }
        } catch (wErr: any) {
            console.warn('[JtvService] Failed to persist jtv2.json:', wErr?.message);
        }

        // 2. Fetch SonyLIV Direct CDN Channels (22 Channels)
        try {
            const sonyRes = await axios.get(SONYLIV_FEED_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (sonyRes.data && typeof sonyRes.data === 'string') {
                const cookieMatch = sonyRes.data.match(/#\s*Cookie:\s*(hdnea=[^\r\n]+)/i);
                const sonyToken = cookieMatch ? cookieMatch[1].trim() : '';
                const lines = sonyRes.data.split('\n');
                let currentCh: Partial<JtvChannel> | null = null;
                let sonyCount = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const chName = titleMatch ? titleMatch[1].trim() : `Sony Channel ${sonyCount}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const idMatch = line.match(/tvg-id="([^"]+)"/);

                        currentCh = {
                            id: `sonyliv-${idMatch ? idMatch[1].replace(/[^a-zA-Z0-9_-]/g, '') : sonyCount++}`,
                            name: chName.includes('Sony') || chName.includes('SET') || chName.includes('BBC') ? chName : `${chName} [SonyLIV]`,
                            category: 'SonyLIV',
                            genre: categorizeChannel(chName),
                            stream_url: '',
                            cookie: sonyToken,
                            token: sonyToken,
                            full_stream_url: '',
                            manifest_url: '',
                            key_id: '',
                            key: '',
                            clearkey: '',
                            logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000024408/1790022758022512_ENGvsSL26_1odi_landscape_thumb.jpg',
                            source: 'sonyliv' as const
                        };
                    } else if (currentCh && (line.startsWith('http://') || line.startsWith('https://'))) {
                        const directUrl = line;
                        const fullUrl = directUrl + (sonyToken ? (directUrl.includes('?') ? '&' : '?') + sonyToken : '');
                        currentCh.stream_url = directUrl;
                        currentCh.full_stream_url = fullUrl;
                        currentCh.manifest_url = fullUrl;
                        allChannels.push(currentCh as JtvChannel);
                        currentCh = null;
                    }
                }
                console.log(`[JtvService] Loaded ${allChannels.filter(c => c.source === 'sonyliv').length} SonyLIV channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch SonyLIV channels:', e?.message || e);
        }

        // 3. Fetch Hotstar Channels (126 Channels)
        try {
            const hotstarRes = await axios.get(HOTSTAR_FEED_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (hotstarRes.data && typeof hotstarRes.data === 'string') {
                const lines = hotstarRes.data.split('\n');
                let currentCh: Partial<JtvChannel> | null = null;
                let hotstarCount = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const chName = titleMatch ? titleMatch[1].trim() : `Hotstar ${hotstarCount}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);

                        currentCh = {
                            id: `hotstar-${hotstarCount++}`,
                            name: chName,
                            category: 'Hotstar',
                            genre: categorizeChannel(chName),
                            stream_url: '',
                            cookie: '',
                            token: '',
                            full_stream_url: '',
                            manifest_url: '',
                            key_id: '',
                            key: '',
                            clearkey: '',
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/sources/r1/cms/prod/2305/1788708712305-h.jpg',
                            source: 'hotstar' as const
                        };
                    } else if (currentCh && line.includes('http-cookie=')) {
                        const m = line.match(/http-cookie=([^\r\n]+)/);
                        if (m) currentCh.token = m[1].trim();
                    } else if (currentCh && (line.startsWith('http://') || line.startsWith('https://'))) {
                        currentCh.stream_url = line;
                        currentCh.full_stream_url = line + (currentCh.token ? (line.includes('?') ? '&' : '?') + currentCh.token : '');
                        currentCh.manifest_url = currentCh.full_stream_url;
                        allChannels.push(currentCh as JtvChannel);
                        currentCh = null;
                    }
                }
                console.log(`[JtvService] Loaded ${allChannels.filter(c => c.source === 'hotstar').length} Hotstar channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch Hotstar channels:', e?.message || e);
        }

        // 4. Ingest Zee Network Channels (Cloudfront Broadpeak origin with ClearKey DRM)
        try {
            const zeeChs = await syncZeeChannels();
            for (const z of zeeChs) {
                allChannels.push({
                    id: z.id,
                    name: z.name,
                    category: z.genre,
                    genre: z.genre,
                    stream_url: z.manifestUrl,
                    cookie: '',
                    token: '',
                    full_stream_url: z.manifestUrl,
                    manifest_url: z.manifestUrl,
                    key_id: z.keyId,
                    key: z.key,
                    clearkey: z.licenseKey,
                    logo: z.logo,
                    source: 'jtv' as const
                });
            }
            console.log(`[JtvService] Loaded ${zeeChs.length} Zee Network channels.`);
        } catch (e: any) {
            console.warn('[JtvService] Failed to load Zee channels:', e?.message || e);
        }

        cachedChannels = allChannels;
        lastChannelsFetch = now;
        console.log(`[JtvService] Total channels ready: ${cachedChannels.length}`);
        return cachedChannels;
    }

    /**
     * Fast-fetch and parse jtvplus3.m3u (contains 1,176 JioTV channels with ClearKey DRM)
     */
    public static parseJtvM3uContent(m3uText: string, wildcardCookie: string = ''): JtvChannel[] {
        if (!m3uText || typeof m3uText !== 'string') return [];
        const lines = m3uText.split(/\r?\n/);
        const channels: JtvChannel[] = [];
        let cur: Partial<JtvChannel> | null = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                const nameMatch = line.match(/tvg-name="([^"]+)"/);
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const groupMatch = line.match(/group-title="([^"]+)"/);
                const commaIdx = line.lastIndexOf(',');
                const title = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';

                const id = idMatch ? idMatch[1].trim() : '';
                const name = (nameMatch ? nameMatch[1].trim() : title) || 'TV Channel';
                const category = groupMatch ? groupMatch[1].trim() : categorizeChannel(name);

                cur = {
                    id,
                    name,
                    category,
                    genre: category,
                    stream_url: '',
                    cookie: '',
                    token: '',
                    full_stream_url: '',
                    manifest_url: id ? `/api/mdtv/manifest/${id}.mpd` : '',
                    key_id: '',
                    key: '',
                    clearkey: '',
                    logo: logoMatch ? logoMatch[1].trim() : '',
                    source: 'jtv' as const
                };
            } else if (cur) {
                if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    const keyPart = line.substring('#KODIPROP:inputstream.adaptive.license_key='.length).trim();
                    cur.clearkey = keyPart;
                    const pairs = keyPart.split(',').map(p => p.trim()).filter(Boolean);
                    if (pairs.length > 0 && pairs[0].includes(':')) {
                        const colonIdx = pairs[0].indexOf(':');
                        cur.key_id = pairs[0].substring(0, colonIdx).trim();
                        cur.key = pairs[0].substring(colonIdx + 1).trim();
                    }
                } else if (line.includes('__hdnea__=')) {
                    const cMatch = line.match(/__hdnea__=[^\s"';&]+/);
                    if (cMatch && !cur.token) {
                        cur.cookie = cMatch[0].trim();
                        cur.token = cur.cookie;
                    }
                } else if (line.startsWith('http://') || line.startsWith('https://')) {
                    let directUrl = line.trim();
                    if (directUrl.includes('|')) {
                        const pipeParts = directUrl.split('|');
                        directUrl = pipeParts[0].trim();
                        const headerStr = pipeParts.slice(1).join('|');
                        const cMatch = headerStr.match(/Cookie=([^\s&]+)/i) || headerStr.match(/__hdnea__=[^\s"';&]+/i);
                        if (cMatch && !cur.token) {
                            cur.cookie = cMatch[1] || cMatch[0];
                            cur.token = cur.cookie;
                        }
                    }
                    cur.stream_url = directUrl;
                    if (!cur.token && line.includes('__hdnea__=')) {
                        const urlTok = line.match(/__hdnea__=[^\s"';&]+/);
                        if (urlTok) {
                            cur.token = urlTok[0].trim();
                            cur.cookie = cur.token;
                        }
                    }
                    let rawCookie = cur.cookie || cur.token || '';
                    if (!rawCookie && wildcardCookie) {
                        rawCookie = wildcardCookie;
                    }
                    const token = rawCookie.startsWith('__hdnea__=') ? rawCookie : (rawCookie ? `__hdnea__=${rawCookie}` : '');
                    cur.cookie = rawCookie;
                    cur.token = token;
                    cur.full_stream_url = cur.stream_url + (token ? (cur.stream_url.includes('?') ? '&' : '?') + token : '');
                    channels.push(cur as JtvChannel);
                    cur = null;
                }
            }
        }
        return channels;
    }

    /**
     * Fast-fetch and parse LiveEvent.m3u (contains live-event-1, live-event-2, ..., live-event-200+)
     */
    private static parseM3uContentToEvents(m3uText: string, startCounter = 1): LiveSportsEvent[] {
        if (!m3uText || typeof m3uText !== 'string') return [];
        const lines = m3uText.split('\n');
        let eventCounter = startCounter;
        let current: Partial<LiveSportsEvent> | null = null;
        const parsed: LiveSportsEvent[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                if (current && current.stream_url) {
                    parsed.push(current as LiveSportsEvent);
                }

                const titleMatch = line.match(/,(.+)$/);
                const rawTitle = titleMatch ? titleMatch[1].trim() : 'Live Match Event';
                const { name, badge, quality } = extractBadgeAndQuality(rawTitle);

                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const groupMatch = line.match(/group-title="([^"]+)"/);

                current = {
                    id: `live-event-${eventCounter++}`,
                    name,
                    title: rawTitle,
                    badge,
                    quality,
                    tournament: groupMatch ? groupMatch[1] : 'Live Sports',
                    group: groupMatch ? groupMatch[1] : 'Sports',
                    logo: logoMatch ? logoMatch[1] : '',
                    stream_url: '',
                    manifest_type: 'mpd',
                    clearkey: '',
                    key_id: '',
                    key: '',
                    referrer: '',
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    source: 'live_event'
                };
            } else if (current) {
                if (line.includes('manifest_type=mpd') || line.includes('.mpd')) {
                    current.manifest_type = 'mpd';
                } else if (line.includes('manifest_type=hls') || line.includes('.m3u8')) {
                    current.manifest_type = 'hls';
                }
                
                if (line.includes('license_key=')) {
                    const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                    if (m) {
                        current.clearkey = m[1].trim();
                        const parts = current.clearkey.split(':');
                        if (parts.length === 2) {
                            current.key_id = parts[0];
                            current.key = parts[1];
                        }
                    }
                } else if (line.includes('http-referrer=')) {
                    const m = line.match(/http-referrer=([^\s]+)/);
                    if (m) current.referrer = m[1].trim();
                } else if (line.includes('http-user-agent=')) {
                    const m = line.match(/http-user-agent=([^\r\n]+)/);
                    if (m) current.user_agent = m[1].trim();
                } else if (line.startsWith('http://') || line.startsWith('https://')) {
                    current.stream_url = line;
                    if (line.includes('.mpd')) current.manifest_type = 'mpd';
                    else if (line.includes('.m3u8')) current.manifest_type = 'hls';
                    parsed.push(current as LiveSportsEvent);
                    current = null;
                }
            }
        }
        if (current && current.stream_url) {
            parsed.push(current as LiveSportsEvent);
        }
        return parsed;
    }

    /**
     * Fast M3U feeds fetch for live sports match events (LiveEvent.m3u & Live.m3u)
     */
    public static async fetchLiveEventM3uOnly(force = false): Promise<LiveSportsEvent[]> {
        const now = Date.now();
        if (!force && liveEventM3uCache.length > 0 && (now - lastLiveEventM3uFetch < 2 * 60 * 1000)) {
            return liveEventM3uCache;
        }

        try {
            const resLive = await axios.get(SPORTLIVE18_LIVE_M3U_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 7000
            });

            if (resLive.data && typeof resLive.data === 'string') {
                const parsed = this.parseM3uContentToEvents(resLive.data, 1);
                // Exclude any static 24/7 channels from live match fixtures
                liveEventM3uCache = parsed.filter(e => !isLinearChannelName(e));
                lastLiveEventM3uFetch = now;
            }
        } catch (e: any) {
            console.warn('[JtvService] Fast M3U live events fetch error:', e?.message || e);
        }

        return liveEventM3uCache;
    }

    /**
     * Fetch all live sports match events (FanCode, Willow Cricbuzz, Prime Video Sports)
     */
    public static async fetchLiveEvents(force = false): Promise<LiveSportsEvent[]> {
        const now = Date.now();
        if (!force && cachedEvents.length > 0 && (now - lastEventsFetch < CACHE_TTL_MS)) {
            return cachedEvents;
        }

        const events: LiveSportsEvent[] = [];
        let eventCounter = 1;

        // 1. Fetch LiveEvent.m3u (217 matches)
        try {
            const m3uMatches = await this.fetchLiveEventM3uOnly(force);
            events.push(...m3uMatches);
            eventCounter += m3uMatches.length;
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch LiveEvent.m3u:', e?.message || e);
        }

        // 2. Fetch FanCode JSON feeds (fancode.json)
        try {
            const fcRes = await axios.get(FANCODE_JSON_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (fcRes.data && Array.isArray(fcRes.data.matches)) {
                for (const m of fcRes.data.matches) {
                    let streamUrl = '';
                    if (m.akamai_m3u8_hex) {
                        try {
                            const decoded = Buffer.from(m.akamai_m3u8_hex, 'hex').toString('utf8');
                            const lines = decoded.split('\n');
                            // Find highest resolution variant or master URL
                            const urls = lines.filter((l: string) => l.startsWith('https://'));
                            streamUrl = urls[urls.length - 1] || urls[0] || '';
                        } catch (e) {}
                    }
                    if (!streamUrl && m.stream_url) streamUrl = m.stream_url;

                    if (streamUrl) {
                        events.push({
                            id: `fancode-live-${eventCounter++}`,
                            name: m.match_name || 'FanCode Live Match',
                            title: `${m.event_name ? m.event_name + ' - ' : ''}${m.match_name || 'FanCode Match'}`,
                            badge: 'FANCODE',
                            quality: 'FHD',
                            tournament: m.event_name || 'FanCode Sports',
                            group: 'Cricket',
                            logo: m.src || 'https://www.fancode.com/skillup-uploads/cms-media/fancode_logo.png',
                            stream_url: streamUrl,
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.7.0 (Linux;Android 10) AndroidXMedia3/1.6.1',
                            source: 'fancode'
                        });
                    }
                }
                console.log(`[JtvService] Added FanCode direct match feeds.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch fancode.json:', e?.message || e);
        }

        // 3. Fetch Prime Video Sports Matches (primevideo_sports.json)

        // 5. Fetch doctor-8trange / zyphx8 FanCode M3U (Direct DAI HLS Streams)
        try {
            const zRes = await axios.get(ZYPHX8_FANCODE_M3U, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (zRes.data && typeof zRes.data === 'string') {
                const lines = zRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'FanCode Live Match';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `zyphx8-fc-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge: 'FANCODE',
                            quality: 'FHD',
                            tournament: groupMatch ? groupMatch[1] : 'FanCode Sports',
                            group: 'Cricket',
                            logo: logoMatch ? logoMatch[1] : 'https://www.fancode.com/skillup-uploads/cms-media/FC_Sports_Default_cricket.jpg',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                            source: 'zyphx8'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        const parts = line.split('|');
                        current.stream_url = parts[0].trim();
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded doctor-8trange/zyphx8 FanCode M3U streams.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch zyphx8 fancode.m3u:', e?.message || e);
        }

        // 6. Fetch doctor-8trange / zyphx8 FanCode JSON (Matches with Multi-bitrate & Score Data)
        try {
            const zJsonRes = await axios.get(ZYPHX8_FANCODE_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (zJsonRes.data && Array.isArray(zJsonRes.data.matches)) {
                for (const m of zJsonRes.data.matches) {
                    const primaryUrl = m.STREAMING_CDN?.Primary_Playback_URL || m.STREAMING_CDN?.fancode_cdn;
                    if (primaryUrl && (m.status === 'LIVE' || m.streamingStatus === 'STARTED')) {
                        const matchTitle = m.title || `${m.team?.[0]?.name || 'Team 1'} vs ${m.team?.[1]?.name || 'Team 2'}`;
                        const logo = m.image || m.image_cdn?.APP || m.image_cdn?.TATAPLAY || 'https://www.fancode.com/skillup-uploads/cms-media/FC_Sports_Default_cricket.jpg';
                        events.push({
                            id: `zyphx8-json-${m.match_id || eventCounter++}`,
                            name: matchTitle,
                            title: matchTitle,
                            badge: 'FANCODE',
                            quality: '1080p',
                            tournament: m.tournament || 'FanCode Live',
                            group: m.category || 'Cricket',
                            logo,
                            stream_url: primaryUrl,
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                            source: 'zyphx8'
                        });
                    }
                }
                console.log(`[JtvService] Loaded doctor-8trange/zyphx8 FanCode JSON matches.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch zyphx8 fancode.json:', e?.message || e);
        }

        // 12. Fetch SonyLIV Live Events (drmlive + sportlive18)
        const sonylivM3uCandidates = [
            'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.m3u',
            SONYLIV_EVENTS_M3U
        ];
        for (const m3uUrl of sonylivM3uCandidates) {
            try {
                const slRes = await axios.get(m3uUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                if (slRes.data && typeof slRes.data === 'string' && slRes.data.includes('#EXTINF')) {
                    const lines = slRes.data.split('\n');
                    let current: Partial<LiveSportsEvent> | null = null;
                    let addedFromFeed = 0;
                    for (const rawLine of lines) {
                        const line = rawLine.trim();
                        if (!line) continue;
                        if (line.startsWith('#EXTINF:')) {
                            if (current && current.stream_url) {
                                events.push(current as LiveSportsEvent);
                                addedFromFeed++;
                            }
                            const titleMatch = line.match(/,(.+)$/);
                            const rawTitle = titleMatch ? titleMatch[1].trim() : 'SonyLIV Live Event';
                            const { name, badge, quality } = extractBadgeAndQuality(rawTitle);
                            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                            const groupMatch = line.match(/group-title="([^"]+)"/);
                            current = {
                                id: `sonyliv-ev-${eventCounter++}`,
                                name,
                                title: rawTitle,
                                badge: 'SONYLIV',
                                quality,
                                tournament: groupMatch ? groupMatch[1] : 'SonyLIV Sports',
                                group: 'Sports',
                                logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000024408/1790022758022512_ENGvsSL26_1odi_landscape_thumb.jpg',
                                stream_url: '',
                                manifest_type: 'hls',
                                clearkey: '',
                                key_id: '',
                                key: '',
                                referrer: 'https://www.sonyliv.com/',
                                user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0',
                                source: 'sport_special'
                            };
                        } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                            current.stream_url = line.replace(/sonydaimenew\.akamaized\.net/g, 'sonymtmnew.akamaized.net');
                            events.push(current as LiveSportsEvent);
                            addedFromFeed++;
                            current = null;
                        }
                    }
                    if (current && current.stream_url) {
                        events.push(current as LiveSportsEvent);
                        addedFromFeed++;
                    }
                    if (addedFromFeed > 0) {
                        console.log(`[JtvService] Loaded ${addedFromFeed} SonyLIV live events from ${m3uUrl}.`);
                        break;
                    }
                }
            } catch (e: any) {
                console.warn(`[JtvService] Failed to fetch SonyLIV events from ${m3uUrl}:`, e?.message || e);
            }
        }

        // 14. Fetch sportlive18 Willow Cricket Event Info (live_sports.json & willow.json)
        try {
            const wUrls = [WILLOW_EVENTS_JSON, WILLOW_EVENTS_BACKUP_JSON];
            let wMatches: any[] = [];
            for (const wu of wUrls) {
                try {
                    const wRes = await axios.get(wu, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        httpsAgent: agent,
                        timeout: 8000
                    });
                    if (wRes.data && Array.isArray(wRes.data.Matches) && wRes.data.Matches.length > 0) {
                        wMatches = wRes.data.Matches;
                        break;
                    }
                } catch (_) {}
            }

            if (wMatches.length > 0) {
                for (const wm of wMatches) {
                    let targetStream = '';
                    const wSources = [wm.stream_url_alpha, wm.stream_url_bravo, wm.stream_url];
                    for (const ws of wSources) {
                        if (!ws) continue;
                        if (typeof ws === 'string' && ws.trim()) { targetStream = ws.trim(); break; }
                        if (typeof ws === 'object') {
                            const val = ws['Cloudfront Server 1'] || ws['Amazon Server'] || ws['Fastly Server'] || ws['Fistly Server'] || ws['Akamai Server'] || ws['Cloudfront Server 2'] || ws['Original Server'] || Object.values(ws).find(v => typeof v === 'string') || '';
                            if (typeof val === 'string' && val.trim()) { targetStream = val.trim(); break; }
                        }
                    }
                    const streamToUse = targetStream || '/api/live/willow.m3u8';
                    const drmKey = (typeof wm.drm_key === 'string' ? wm.drm_key : (typeof wm.clearkey === 'string' ? wm.clearkey : '')).trim();
                    const parts = drmKey.split(':');
                    events.push({
                        id: `willow-ev-${wm.match_id || eventCounter++}`,
                        name: wm.title || 'Willow Cricket',
                        title: wm.synopsis || wm.title || 'Willow Cricket Live',
                        badge: 'WILLOW',
                        quality: 'HD',
                        tournament: 'Willow Cricket Event',
                        group: 'Cricket',
                        logo: wm.cover_image || 'https://www.willow.tv/images/willow-logo.png',
                        stream_url: streamToUse,
                        manifest_type: streamToUse.includes('.mpd') ? 'mpd' : 'hls',
                        clearkey: drmKey,
                        key_id: parts[0] || '',
                        key: parts[1] || '',
                        referrer: 'https://www.willow.tv/',
                        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        source: 'willow'
                    });
                }
                console.log(`[JtvService] Loaded ${wMatches.length} Willow cricket matches.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch willow.json:', e?.message || e);
        }

        // 17. Synchronize Live FanCode Events & Stream manifests
        try {
            const { live: fcLive, all: fcAll } = await fetchFanCodeEvents(force);
            const fcPool = (fcLive && fcLive.length > 0) ? fcLive : (fcAll || []).filter(e => e.streamUrl || e.m3u8Content);
            for (const ev of fcPool) {
                if (!ev.streamUrl && !ev.m3u8Content) continue;
                const matchIdStr = String(ev.matchId || '');
                const m3u8Content = ev.m3u8Content || '';
                const sUrl = ev.streamUrl || (m3u8Content ? `/api/live/manifest/fancode-${matchIdStr}.m3u8` : '');
                const token = ev.token || (sUrl.match(/((?:__hdnea__|hdnea|hdntl)=[^&]+)/i)?.[1] || '');

                events.unshift({
                    id: `fancode-${matchIdStr}`,
                    name: ev.title,
                    title: ev.eventName ? `${ev.eventName} - ${ev.title}` : ev.title,
                    badge: 'FANCODE',
                    quality: '1080p',
                    tournament: ev.eventName || 'FanCode Live',
                    group: ev.sportCategory || 'Cricket',
                    logo: ev.thumbnail,
                    stream_url: sUrl,
                    full_stream_url: sUrl,
                    manifest_url: `/api/live/manifest/fancode-${matchIdStr}.m3u8`,
                    token,
                    manifest_type: 'dash',
                    clearkey: '',
                    key_id: '',
                    key: '',
                    referrer: 'https://fancode.com/',
                    user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                    source: 'fancode',
                    m3u8_content: m3u8Content
                });
            }
            console.log(`[JtvService] Synchronized ${fcPool.length} active FanCode live events.`);
        } catch (e: any) {
            console.warn('[JtvService] Failed to sync FanCode events:', e?.message || e);
        }

        // 18. Synchronize Live SonyLIV Events & Stream manifests
        try {
            const { live: slLive, all: slAll } = await fetchSonyLivEvents(force);
            const slPool = (slLive && slLive.length > 0) ? slLive : (slAll || []).filter(e => e.streamUrl);
            for (const ev of slPool) {
                if (!ev.streamUrl) continue;
                const cidStr = String(ev.contentId || '');
                const token = ev.token || (ev.streamUrl.match(/((?:__hdnea__|hdnea|hdntl)=[^&]+)/i)?.[1] || '');

                events.unshift({
                    id: `sonyliv-${cidStr}`,
                    name: ev.title,
                    title: ev.eventName ? `${ev.eventName} - ${ev.title}` : ev.title,
                    badge: 'SONYLIV',
                    quality: 'HD',
                    tournament: ev.eventName || ev.category || 'SonyLIV Sports',
                    group: ev.category || 'Sports',
                    logo: ev.thumbnail,
                    stream_url: ev.streamUrl,
                    full_stream_url: ev.streamUrl,
                    manifest_url: `/live.php?url=${encodeURIComponent(ev.streamUrl)}`,
                    token,
                    manifest_type: ev.streamUrl.includes('.mpd') ? 'dash' : 'hls',
                    clearkey: '',
                    key_id: '',
                    key: '',
                    referrer: 'https://www.sonyliv.com/',
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0',
                    source: 'sonyliv'
                });
            }
            console.log(`[JtvService] Synchronized ${slPool.length} active SonyLIV live events.`);
        } catch (e: any) {
            console.warn('[JtvService] Failed to sync SonyLIV events:', e?.message || e);
        }

        const DUMMY_EVENT_REGEX = /(cricbuzz\s*-\s*aq|stream\.kliv\.in|placeholder|testtapmad|crichd|1st\s*test\s*australia|caribbean\s*premier\s*league|the\s*hundred\s*2026|5th\s*odi\s*afghanistan|sports\s*live\s*vs\s*sports\s*live|playerado|crichdsee|player0003|cricgo)/i;
        cachedEvents = events.filter(e => {
            if (e.source === 'crichd' || e.badge === 'CRICHD' || (e.id && String(e.id).startsWith('crichd-'))) {
                return false;
            }
            // Strip malformed/corrupted titles (e.g. image URLs or percent strings parsed as titles)
            if (e.name && (/^(q_\d+|l:[\d.]+%)/i.test(e.name) || e.name.includes('/dhome/posters/'))) {
                return false;
            }
            // Strictly exclude 24/7 linear channels (Sony SAB, Sony MAX, Sony BBC Earth, Star Sports linear, etc.) from live fixtures
            if (isLinearChannelName(e)) {
                return false;
            }
            const str = `${e.name || ''} ${e.title || ''} ${e.stream_url || ''} ${e.badge || ''} ${e.source || ''}`;
            return !DUMMY_EVENT_REGEX.test(str);
        });
        lastEventsFetch = now;
        console.log(`[JtvService] Total live sporting events (after filtering dummy fixtures): ${cachedEvents.length}`);
        return cachedEvents;
    }

    /**
     * Fetch all IPL 2026 Replay Matches from sportlive18/playlist
     */
    public static async fetchIplReplays(force = false): Promise<IplReplayMatch[]> {
        const now = Date.now();
        if (!force && cachedIplReplays.length > 0 && (now - lastIplFetch < CACHE_TTL_MS)) {
            return cachedIplReplays;
        }

        const replays: IplReplayMatch[] = [];
        try {
            let m3uContent = '';
            const localM3uPath = path.join(process.cwd(), 'assets', 'IPL2026.m3u');
            if (fs.existsSync(localM3uPath)) {
                try {
                    m3uContent = fs.readFileSync(localM3uPath, 'utf8');
                } catch (_) {}
            }

            if (!m3uContent) {
                const res = await axios.get(IPL_REPLAYS_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 10000
                });
                if (res.data && typeof res.data === 'string') {
                    m3uContent = res.data;
                }
            }

            if (m3uContent) {
                const lines = m3uContent.split('\n');
                let current: Partial<IplReplayMatch> | null = null;
                let counter = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) replays.push(current as IplReplayMatch);

                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : `IPL Match ${counter}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);

                        const lang = groupMatch ? groupMatch[1].toUpperCase() : (rawTitle.includes('(HINDI)') ? 'HINDI' : 'ENGLISH');
                        const matchNumMatch = rawTitle.match(/MATCH\s*(\d+)/i);
                        const matchNum = matchNumMatch ? matchNumMatch[1] : String(counter);
                        const teams = rawTitle.replace(/\(ENGLISH\)|\(HINDI\)|MATCH\s*\d+/gi, '').trim();

                        current = {
                            id: `ipl-replay-${counter++}`,
                            title: rawTitle,
                            matchNumber: matchNum,
                            teams,
                            language: lang,
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/f_auto/sources/r1/cms/prod/4384/1774726004384-h',
                            stream_url: '',
                            proxy_url: ''
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        current.proxy_url = `/api/proxy/fancode?url=${encodeURIComponent(line)}`;
                        replays.push(current as IplReplayMatch);
                        current = null;
                    }
                }
                if (current && current.stream_url) replays.push(current as IplReplayMatch);
                console.log(`[JtvService] Successfully parsed ${replays.length} IPL 2026 replays.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch IPL 2026 replays:', e?.message || e);
        }

        cachedIplReplays = replays;
        lastIplFetch = now;
        return cachedIplReplays;
    }

    /**
     * Fetch IPL 2026 Highlights:
     * 1. Key playoff/final matches from the same IPL2026.m3u (Qualifier, Eliminator, Final)
     * 2. Completed FanCode cricket matches from fancode2.json / fancode3.json
     */
    public static async fetchIplHighlights(force = false): Promise<IplReplayMatch[]> {
        const now = Date.now();
        if (!force && cachedIplHighlights.length > 0 && (now - lastHighlightsFetch < CACHE_TTL_MS)) {
            return cachedIplHighlights;
        }

        const highlights: IplReplayMatch[] = [];

        // --- Source 1: Playoff/Key matches from IPL2026.m3u ---
        try {
            let m3uContent = '';
            const localM3uPath = path.join(process.cwd(), 'assets', 'IPL2026.m3u');
            if (fs.existsSync(localM3uPath)) {
                try {
                    m3uContent = fs.readFileSync(localM3uPath, 'utf8');
                } catch (_) {}
            }

            if (!m3uContent) {
                const res = await axios.get(IPL_REPLAYS_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 10000
                });
                if (res.data && typeof res.data === 'string') {
                    m3uContent = res.data;
                }
            }

            if (m3uContent) {
                const lines = m3uContent.split('\n');
                let current: Partial<IplReplayMatch> | null = null;
                let counter = 1000;
                const HIGHLIGHT_KEYWORDS = /qualifier|eliminator|final|super.over|semifinal|playoff/i;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : '';
                        if (!HIGHLIGHT_KEYWORDS.test(rawTitle)) { current = null; continue; }

                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        const lang = groupMatch ? groupMatch[1].toUpperCase() : (rawTitle.includes('(HINDI)') ? 'HINDI' : 'ENGLISH');
                        const teams = rawTitle.replace(/\(ENGLISH\)|\(HINDI\)/gi, '').trim();

                        current = {
                            id: `ipl-highlight-${counter++}`,
                            title: rawTitle,
                            matchNumber: teams.includes('FINAL') ? 'FINAL' : teams.includes('QUALIFIER') ? 'QF' : teams.includes('ELIMINATOR') ? 'ELIM' : 'KM',
                            teams,
                            language: lang,
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/f_auto/sources/r1/cms/prod/4384/1774726004384-h',
                            stream_url: '',
                            proxy_url: ''
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        current.proxy_url = `/api/proxy/fancode?url=${encodeURIComponent(line)}`;
                        highlights.push(current as IplReplayMatch);
                        current = null;
                    }
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] highlights - failed to parse IPL2026.m3u:', e?.message);
        }

        // --- Source 2: Completed FanCode cricket matches ---
        const fancodeUrls = [IPL_HIGHLIGHTS_FANCODE_JSON, IPL_HIGHLIGHTS_FANCODE3_JSON];
        for (const url of fancodeUrls) {
            try {
                const res = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                const data = res.data;
                const matches: any[] = data?.matches || [];
                for (const m of matches) {
                    // Only include completed cricket matches with a stream_url
                    if (m.status !== 'COMPLETED' && m.status !== 'FINISHED' && m.status !== 'ENDED') continue;
                    if (m.category !== 'Cricket' && m.category !== 'cricket') continue;
                    const streamUrl = m.stream_url || m.hls_url || m.url || '';
                    if (!streamUrl) continue;

                    const title = m.title || m.name || m.tournament || 'Cricket Highlights';
                    const thumb = m.image || m.image_cdn?.APP || m.image_cdn?.CLOUDFARE || m.image_cdn?.SPORTS || '';
                    const teams = m.team ? m.team.map((t: any) => t.shortName || t.name).join(' VS ') : (m.title || '');

                    highlights.push({
                        id: `fc-highlight-${m.match_id || Math.random()}`,
                        title,
                        matchNumber: 'HIGHLIGHTS',
                        teams,
                        language: 'ENGLISH',
                        logo: thumb,
                        stream_url: streamUrl,
                        proxy_url: streamUrl.startsWith('/api/') ? streamUrl : `/api/proxy/fancode?url=${encodeURIComponent(streamUrl)}`
                    });
                }
                console.log(`[JtvService] Highlights from ${url}: ${highlights.length} total`);
            } catch (e: any) {
                console.warn('[JtvService] highlights - fancode fetch failed:', e?.message);
            }
        }

        cachedIplHighlights = highlights;
        lastHighlightsFetch = now;
        console.log(`[JtvService] Total highlights fetched: ${highlights.length}`);
        return cachedIplHighlights;
    }

    /**
     * Fetch auto-updated spotlight movies from sportlive18/MOVIE-API-AUTO-UPDATE
     */
    public static async fetchMovieSpotlight(): Promise<any> {
        try {
            const res = await axios.get(MOVIE_SPOTLIGHT_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            return res.data;
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch movie spotlight:', e?.message || e);
            return { success: false, data: { spotlight: [] } };
        }
    }

    /**
     * Regional Bigg Boss fallback resolver:
     * Maps tokenized Hotstar 24/7 feeds to 1080p JioTV live TV broadcast channels
     */
    public static resolveBiggBossFallback(channelIdOrName: string): { fallbackChannelId: string; name: string } | null {
        const lower = (channelIdOrName || '').toLowerCase();
        if (!lower.includes('big') && !lower.includes('boss') && !lower.includes('bb')) return null;

        if (lower.includes('malayalam') || lower.includes('mal')) return { fallbackChannelId: '443', name: 'Asianet HD (Bigg Boss Malayalam Official Live)' };
        if (lower.includes('hindi') || lower.includes('hin')) return { fallbackChannelId: '144', name: 'Colors HD (Bigg Boss Hindi Official Live)' };
        if (lower.includes('telugu') || lower.includes('tel')) return { fallbackChannelId: '439', name: 'Star Maa HD (Bigg Boss Telugu Official Live)' };
        if (lower.includes('tamil') || lower.includes('tam')) return { fallbackChannelId: '441', name: 'Star Vijay HD (Bigg Boss Tamil Official Live)' };
        if (lower.includes('kannada') || lower.includes('kan')) return { fallbackChannelId: '757', name: 'Colors Kannada HD (Bigg Boss Kannada Official Live)' };
        if (lower.includes('bangla') || lower.includes('ben')) return { fallbackChannelId: '756', name: 'Colors Bangla HD (Bigg Boss Bangla Official Live)' };
        if (lower.includes('marathi') || lower.includes('mar')) return { fallbackChannelId: '755', name: 'Colors Marathi HD (Bigg Boss Marathi Official Live)' };

        return { fallbackChannelId: '144', name: 'Colors HD (Bigg Boss Official Live)' };
    }

    /**
     * Resolve channel from catalog by ID or name
     */
    public static async resolveChannel(idOrSlug: string): Promise<JtvChannel | null> {
        if (!idOrSlug) return null;
        let clean = String(idOrSlug).trim().toLowerCase();
        if (clean.startsWith('jtv-')) clean = clean.replace('jtv-', '');
        if (clean.startsWith('mdtv-')) clean = clean.replace('mdtv-', '');

        const channels = await this.fetchChannels();

        let match = channels.find(c => String(c.id).toLowerCase() === clean);
        if (!match) match = channels.find(c => c.name.toLowerCase() === clean);
        if (!match) match = channels.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, ''));
        if (!match) match = channels.find(c => c.name.toLowerCase().includes(clean));

        // If the channel is a Hotstar channel, Hotstar ephemeral 24/7 stream tokens frequently expire.
        // Transparently fallback to the official live broadcaster channel (Asianet HD, Colors HD, Star Sports, etc.)
        if (match && (match.id.includes('hotstar') || match.source === 'hotstar' || match.name.toLowerCase().includes('bigboss') || match.name.toLowerCase().includes('bigg boss'))) {
            const fb = this.resolveBiggBossFallback(match.name || match.id);
            if (fb) {
                const fbCh = channels.find(c => String(c.id) === fb.fallbackChannelId);
                if (fbCh) {
                    return {
                        ...fbCh,
                        id: match.id,
                        name: `${match.name} [Broadcaster: ${fb.name}]`
                    };
                }
            }

            // General Hotstar channel: find official JioTV/MDTV broadcast counterpart
            const cleanName = match.name.toLowerCase()
                .replace(/hotstar|vip|special|live|\bhd\b|\bfeed\b/gi, '')
                .trim();
            if (cleanName.length >= 3) {
                const liveMatch = channels.find(c => 
                    (c.source === 'jtv' || (c.source as string) === 'mdtv') && 
                    c.name.toLowerCase().includes(cleanName)
                );
                if (liveMatch) {
                    return {
                        ...liveMatch,
                        id: match.id,
                        name: `${match.name} [Live]`
                    };
                }
            }
        }

        if (!match) {
            const fb = this.resolveBiggBossFallback(clean);
            if (fb) {
                const fbCh = channels.find(c => String(c.id) === fb.fallbackChannelId);
                if (fbCh) {
                    return {
                        ...fbCh,
                        id: clean,
                        name: fb.name
                    };
                }
            }
            // Seamless fallback: If a FanCode or SonyLIV event ID was passed to resolveChannel
            const ev = await this.resolveEvent(idOrSlug).catch(() => null);
            if (ev) {
                return {
                    id: ev.id,
                    name: ev.name,
                    category: ev.group || 'Sports',
                    genre: ev.group || 'Sports',
                    stream_url: ev.stream_url,
                    cookie: ev.token || '',
                    token: ev.token || '',
                    full_stream_url: ev.full_stream_url || ev.stream_url,
                    manifest_url: ev.manifest_url || '',
                    key_id: ev.key_id || '',
                    key: ev.key || '',
                    clearkey: ev.clearkey || '',
                    logo: ev.logo || '',
                    source: ev.source as any
                };
            }
        }

        if (match && match.source === 'jtv') {
            if (isTokenExpired(match.token) || !match.token) {
                const sportsTokens = await this.fetchSportsCookies();
                const freshUrl = sportsTokens.get(String(match.id));
                if (freshUrl) {
                    const cookiePart = freshUrl.includes('?') ? freshUrl.split('?')[1] : '';
                    const baseUrl = freshUrl.split('?')[0];
                    match.stream_url = baseUrl || match.stream_url;
                    match.cookie = cookiePart;
                    match.token = cookiePart;
                    match.full_stream_url = baseUrl + (cookiePart ? `?${cookiePart}` : '');
                }
            }
        }

        return match || null;
    }

    /**
     * Fetch upstream manifest and rewrite it with absolute CDN base URL, ClearKey ContentProtection and Akamai tokens
     */
    public static async getRewrittenManifest(idOrSlug: string): Promise<{ manifest: string; contentType: string } | null> {
        const cacheKey = String(idOrSlug).toLowerCase().trim();
        const now = Date.now();
        const cached = cachedManifests.get(cacheKey);
        if (cached && cached.expires > now) {
            return {
                manifest: cached.data,
                contentType: cached.contentType
            };
        }

        let ch = await this.resolveChannel(idOrSlug);
        if (!ch || !ch.stream_url) return null;

        if (ch.stream_url.includes('.m3u8') || (ch.full_stream_url && ch.full_stream_url.includes('.m3u8'))) {
            return null;
        }

        // Ensure we have fresh token for sports channel
        if (isTokenExpired(ch.token) || !ch.token) {
            const sportsTokens = await this.fetchSportsCookies(true);
            const freshUrl = sportsTokens.get(String(ch.id));
            if (freshUrl) {
                const cookiePart = freshUrl.includes('?') ? freshUrl.split('?')[1] : '';
                const baseUrl = freshUrl.split('?')[0];
                ch.stream_url = baseUrl || ch.stream_url;
                ch.cookie = cookiePart;
                ch.token = cookiePart;
                ch.full_stream_url = baseUrl + (cookiePart ? `?${cookiePart}` : '');
            }
        }

        const fetchUpstream = async (channel: JtvChannel) => {
            let cookiePart = channel.token ? (channel.token.startsWith('__hdnea__=') ? channel.token : `__hdnea__=${channel.token}`) : (channel.cookie || '');
            let baseUrl = channel.stream_url.split('?')[0];
            if (baseUrl.includes('|')) {
                baseUrl = baseUrl.split('|')[0].trim();
            }
            const upstreamUrl = cookiePart ? `${baseUrl}?${cookiePart}` : baseUrl;

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://www.jiotv.com/',
                'Origin': 'https://www.jiotv.com/'
            };
            if (cookiePart) {
                headers['Cookie'] = cookiePart;
            }

            try {
                return await axios.get(upstreamUrl, {
                    headers,
                    httpsAgent: agent,
                    timeout: 8000,
                    responseType: 'text'
                });
            } catch (firstErr: any) {
                // Secondary attempt with Android ExoPlayer User-Agent
                headers['User-Agent'] = 'plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7';
                return await axios.get(upstreamUrl, {
                    headers,
                    httpsAgent: agent,
                    timeout: 8000,
                    responseType: 'text'
                });
            }
        };

        let res: any;
        try {
            res = await fetchUpstream(ch);
        } catch (err: any) {
            const status = err?.response?.status || err?.status;
            if (status === 403 || status === 450 || status === 401 || status === 451 || status === 400) {
                console.log(`[JtvService] Manifest ${status} on ${idOrSlug}, refreshing sports cookies and jtv.m3u catalog...`);
                let retrySuccess = false;
                // 1. Try sportcookie.json first
                const sportsTokens = await this.fetchSportsCookies(true);
                let freshUrl = sportsTokens.get(String(ch.id));

                if (freshUrl) {
                    try {
                        const cookiePart = freshUrl.includes('?') ? freshUrl.split('?')[1] : (ch.token || '');
                        const baseUrl = freshUrl.split('?')[0].split('|')[0].trim();
                        ch.stream_url = baseUrl || ch.stream_url;
                        ch.cookie = cookiePart;
                        ch.token = cookiePart;
                        ch.full_stream_url = baseUrl + (cookiePart ? `?${cookiePart}` : '');
                        res = await fetchUpstream(ch);
                        retrySuccess = true;
                    } catch (e) {
                        retrySuccess = false;
                    }
                }
                
                // 2. If not found or failed, force refresh from primary jtv.m3u catalog
                if (!retrySuccess) {
                    try {
                        const refreshedCatalog = await this.fetchChannels(true);
                        const freshCh = refreshedCatalog.find(c => String(c.id) === String(ch.id) || c.name.toLowerCase() === ch.name.toLowerCase());
                        if (freshCh && freshCh.stream_url) {
                            freshUrl = freshCh.full_stream_url || freshCh.stream_url;
                            const cookiePart = freshUrl.includes('?') ? freshUrl.split('?')[1] : (freshCh.token || '');
                            const baseUrl = freshUrl.split('?')[0].split('|')[0].trim();
                            ch.stream_url = baseUrl || freshCh.stream_url;
                            ch.cookie = cookiePart;
                            ch.token = cookiePart;
                            ch.full_stream_url = baseUrl + (cookiePart ? `?${cookiePart}` : '');
                            res = await fetchUpstream(ch);
                            retrySuccess = true;
                        }
                    } catch (e) {
                        retrySuccess = false;
                    }
                }

                // 3. Fallback: If still failing and stream is _BTS or jiotvpllive, try _MOB on jiotvmblive with fresh wildcard cookie
                if (!retrySuccess) {
                    try {
                        const wildcardCookie = await this.fetchWildcardCookie(true);
                        const BTS_SLUG_FALLBACKS: Record<string, { slug: string; keyId?: string; key?: string }> = {
                            'SonySportsTen1HDSTB': { slug: 'Ten_HD_MOB', keyId: '3525c924e54154b39533d86b1c7a428a', key: '8548b566fc6608a7d3bd601ee5f3d889' },
                            'SonySportsTen2HDSTB': { slug: 'Ten2_HD_MOB', keyId: '91fce77f2f8056f084ed961c7ebe86ed', key: '8214bd5eb6c21444e8ea644824affd79' },
                            'SonySportsTen3HDSTB': { slug: 'Ten3_HD_MOB', keyId: '111e6908b965566e97139efddf7ef459', key: 'c87903abbc052e1f21e51ebd928d9cb1' },
                            'Sony_Ten_1_HD': { slug: 'Ten_HD_MOB', keyId: '3525c924e54154b39533d86b1c7a428a', key: '8548b566fc6608a7d3bd601ee5f3d889' },
                            'Sony_Ten_2_HD': { slug: 'Ten2_HD_MOB', keyId: '91fce77f2f8056f084ed961c7ebe86ed', key: '8214bd5eb6c21444e8ea644824affd79' },
                            'Sony_Ten_3_HD': { slug: 'Ten3_HD_MOB', keyId: '111e6908b965566e97139efddf7ef459', key: 'c87903abbc052e1f21e51ebd928d9cb1' }
                        };

                        let mobUrl = ch.stream_url.split('?')[0].split('|')[0].trim();
                        for (const [badSlug, fix] of Object.entries(BTS_SLUG_FALLBACKS)) {
                            if (mobUrl.includes(badSlug)) {
                                mobUrl = `https://jiotvmblive.cdn.jio.com/bpk-tv/${fix.slug}/WDVLive/index.mpd`;
                                if (fix.keyId && fix.key) {
                                    ch.key_id = fix.keyId;
                                    ch.key = fix.key;
                                    const pair = `${fix.keyId}:${fix.key}`;
                                    if (!ch.clearkey.includes(fix.keyId)) {
                                        ch.clearkey = ch.clearkey ? `${pair},${ch.clearkey}` : pair;
                                    }
                                }
                                break;
                            }
                        }
                        if (mobUrl.includes('_BTS') || mobUrl.includes('jiotvpllive')) {
                            mobUrl = mobUrl
                                .replace('jiotvpllive.cdn.jio.com', 'jiotvmblive.cdn.jio.com')
                                .replace('_BTS', '_MOB');
                        }
                        const tokenPart = wildcardCookie.startsWith('__hdnea__=') ? wildcardCookie : `__hdnea__=${wildcardCookie}`;
                        const mobCh: JtvChannel = {
                            ...ch,
                            stream_url: mobUrl,
                            cookie: tokenPart,
                            token: tokenPart,
                            full_stream_url: `${mobUrl}?${tokenPart}`
                        };
                        console.log(`[JtvService] Trying _MOB wildcard fallback for ${idOrSlug}: ${mobUrl}`);
                        res = await fetchUpstream(mobCh);
                        ch.stream_url = mobUrl;
                        ch.cookie = tokenPart;
                        ch.token = tokenPart;
                        ch.full_stream_url = `${mobUrl}?${tokenPart}`;
                        retrySuccess = true;
                    } catch (mobErr: any) {
                        console.warn(`[JtvService] _MOB wildcard fallback failed for ${idOrSlug}:`, mobErr?.message || mobErr);
                        throw err;
                    }
                }
            } else {
                throw err;
            }
        }

        let data = res.data;
        if (!data || typeof data !== 'string') return null;

        // Calculate absolute CDN base directory from stream_url
        const lastSlash = ch.stream_url.lastIndexOf('/');
        const cdnDir = lastSlash !== -1 ? ch.stream_url.substring(0, lastSlash + 1) : ch.stream_url;

        // Rewrite relative BaseURL
        data = data.replace(/<BaseURL>dash\/<\/BaseURL>/gi, `<BaseURL>${cdnDir}dash/</BaseURL>`);
        data = data.replace(/<BaseURL>([a-zA-Z0-9_\-\/]+)<\/BaseURL>/gi, (match: string, p1: string) => {
            if (p1.startsWith('http://') || p1.startsWith('https://')) return match;
            return `<BaseURL>${cdnDir}${p1}</BaseURL>`;
        });

        // Insert ClearKey ContentProtection if not present
        if (!data.includes('1077efec-c0b2-4d02-ace3-3c1e52e2fb4b')) {
            const clearKeyProtection = `<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b" value="ClearKey1.0"/>`;
            data = data.replace(
                /<ContentProtection schemeIdUri="urn:uuid:EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED"[\s\S]*?(?:<\/ContentProtection>|\/>)/gi,
                (match: string) => `${clearKeyProtection}\n      ${match}`
            );
        }

        // Inject Akamai authentication token into segment templates so CDN chunk requests succeed
        const tokenQuery = ch.token ? (ch.token.startsWith('__hdnea__=') ? ch.token : `__hdnea__=${ch.token}`) : '';
        if (tokenQuery) {
            data = data.replace(/initialization="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `initialization="${url}${separator}${tokenQuery}"`;
            });
            data = data.replace(/media="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `media="${url}${separator}${tokenQuery}"`;
            });
            data = data.replace(/sourceURL="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `sourceURL="${url}${separator}${tokenQuery}"`;
            });
        }

        // Rewrite minBufferTime to PT1.500S to stop players from pausing or cutting on 8-10s segment boundaries
        data = data.replace(/minBufferTime="PT[0-9\.]+S"/gi, 'minBufferTime="PT1.500S"');

        const result = {
            manifest: data,
            contentType: res.headers['content-type'] || 'application/dash+xml'
        };

        cachedManifests.set(cacheKey, {
            data: result.manifest,
            contentType: result.contentType,
            expires: now + 4000 // 4s TTL cache
        });

        return result;
    }

    /**
     * Resolve single live sports match event by ID (FanCode, SonyLIV, ICC, FIFA, etc.)
     */
    public static async resolveEvent(eventId: string): Promise<LiveSportsEvent | null> {
        if (!eventId) return null;
        const clean = String(eventId).trim().toLowerCase();

        // 0. Super-fast direct path for LiveEvent.m3u events (e.g. live-event-13)
        if (clean.startsWith('live-event-') || clean.startsWith('live_event_') || clean.startsWith('live-event')) {
            const m3uEvents = await this.fetchLiveEventM3uOnly();
            const targetClean = clean.replace(/_/g, '-');
            const matched = m3uEvents.find(e => e.id?.toLowerCase() === targetClean || e.id?.toLowerCase() === clean);
            if (matched) return matched;
        }

        const normalizeId = (idStr: string) => {
            return String(idStr || '')
                .toLowerCase()
                .trim()
                .replace(/_/g, '-')
                .replace(/^(?:fancode|fc|sonyliv|sliv)[-_]/i, '');
        };

        const targetNorm = normalizeId(clean);
        const targetNum = targetNorm.split(/[^0-9]/)[0];

        const events = await this.fetchLiveEvents();

        // 1. Check in events catalog
        let found = events.find(e => {
            const eId = (e.id || '').toLowerCase();
            if (eId === clean) return true;
            const eNorm = normalizeId(eId);
            if (eNorm === targetNorm) return true;
            if (targetNorm && (eNorm.startsWith(targetNorm) || targetNorm.startsWith(eNorm))) return true;
            if (targetNum && targetNum.length >= 4) {
                const eNum = eNorm.split(/[^0-9]/)[0];
                if (eNum === targetNum) return true;
            }
            return false;
        });
        if (found) return found;

        // 2. Fallback: Check FanCode scraper cache directly
        try {
            const { live: fcLive, all: fcAll } = await fetchFanCodeEvents();
            const allFc = [...(fcLive || []), ...(fcAll || [])];
            const fcMatch = allFc.find(e => {
                const matchIdStr = String(e.matchId || '');
                const mNorm = normalizeId(matchIdStr);
                const eIdNorm = normalizeId(e.id || '');
                if (mNorm === targetNorm || eIdNorm === targetNorm) return true;
                if (targetNorm && (mNorm.startsWith(targetNorm) || targetNorm.startsWith(mNorm))) return true;
                if (targetNum && targetNum.length >= 4) {
                    const mNum = mNorm.split(/[^0-9]/)[0];
                    if (mNum === targetNum) return true;
                }
                return false;
            });
            if (fcMatch && (fcMatch.streamUrl || fcMatch.m3u8Content)) {
                const matchIdStr = String(fcMatch.matchId || targetNorm);
                const token = fcMatch.token || (fcMatch.streamUrl?.match(/((?:__hdnea__|hdnea|hdntl)=[^&]+)/i)?.[1] || '');
                const sUrl = fcMatch.streamUrl || (fcMatch.m3u8Content ? `/api/live/manifest/fancode-${matchIdStr}.m3u8` : '');
                return {
                    id: `fancode-${matchIdStr}`,
                    name: fcMatch.title,
                    title: fcMatch.eventName ? `${fcMatch.eventName} - ${fcMatch.title}` : fcMatch.title,
                    badge: 'FANCODE',
                    quality: '1080p',
                    tournament: fcMatch.eventName || 'FanCode Live',
                    group: fcMatch.sportCategory || 'Cricket',
                    logo: fcMatch.thumbnail,
                    stream_url: sUrl,
                    full_stream_url: sUrl,
                    manifest_url: `/api/live/manifest/fancode-${matchIdStr}.m3u8`,
                    token,
                    manifest_type: 'dash',
                    clearkey: '',
                    key_id: '',
                    key: '',
                    referrer: 'https://fancode.com/',
                    user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                    source: 'fancode',
                    m3u8_content: fcMatch.m3u8Content
                };
            }
        } catch(e) {}

        // 3. Fallback: Check SonyLIV scraper cache directly
        try {
            const { live: slLive, all: slAll } = await fetchSonyLivEvents();
            const allSl = [...(slLive || []), ...(slAll || [])];
            const slMatch = allSl.find(e => {
                const cidStr = String(e.contentId || '');
                const cNorm = normalizeId(cidStr);
                const eIdNorm = normalizeId(e.id || '');
                if (cNorm === targetNorm || eIdNorm === targetNorm) return true;
                if (targetNorm && (cNorm.startsWith(targetNorm) || targetNorm.startsWith(cNorm))) return true;
                if (targetNum && targetNum.length >= 4) {
                    const cNum = cNorm.split(/[^0-9]/)[0];
                    if (cNum === targetNum) return true;
                }
                return false;
            });
            if (slMatch && slMatch.streamUrl) {
                const cidStr = String(slMatch.contentId || targetNorm);
                const token = slMatch.token || (slMatch.streamUrl.match(/((?:__hdnea__|hdnea|hdntl)=[^&]+)/i)?.[1] || '');
                return {
                    id: `sonyliv-${cidStr}`,
                    name: slMatch.title,
                    title: slMatch.eventName ? `${slMatch.eventName} - ${slMatch.title}` : slMatch.title,
                    badge: 'SONYLIV',
                    quality: 'HD',
                    tournament: slMatch.eventName || slMatch.category || 'SonyLIV Sports',
                    group: slMatch.category || 'Sports',
                    logo: slMatch.thumbnail,
                    stream_url: slMatch.streamUrl,
                    full_stream_url: slMatch.streamUrl,
                    manifest_url: `/live.php?url=${encodeURIComponent(slMatch.streamUrl)}`,
                    token,
                    manifest_type: slMatch.streamUrl.includes('.mpd') ? 'dash' : 'hls',
                    clearkey: '',
                    key_id: '',
                    key: '',
                    referrer: 'https://www.sonyliv.com/',
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0',
                    source: 'sonyliv'
                };
            }
        } catch(e) {}

        return null;
    }

    /**
     * Get summary category counts
     */
    public static async getCategories(): Promise<CategorySummary[]> {
        const channels = await this.fetchChannels();
        const counts: Record<string, number> = {};
        for (const c of channels) {
            counts[c.category] = (counts[c.category] || 0) + 1;
        }

        const iconMap: Record<string, string> = {
            'Sports': '⚽',
            'SonyLIV': '⚡',
            'Hotstar': '🌟',
            'Movies': '🎬',
            'Entertainment': '🎭',
            'News': '📰',
            'Kids': '🧸',
            'Music': '🎵',
            'Infotainment': '🌍',
            'Regional': '🇮🇳'
        };

        return Object.keys(counts).sort().map(cat => ({
            name: cat,
            count: counts[cat],
            icon: iconMap[cat] || '📺'
        }));
    }

    /**
     * Start background auto-synchronization every 15 minutes
     */
    public static startAutoSync(intervalMs = CACHE_TTL_MS): void {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
        }

        console.log(`[JtvService] Starting auto-sync worker every ${Math.round(intervalMs / 60000)} minutes`);

        Promise.all([
            this.fetchWildcardCookie(true),
            this.fetchChannels(true),
            this.fetchLiveEvents(true)
        ]).catch(err => console.error('[JtvService] Initial background sync error:', err));

        autoSyncTimer = setInterval(async () => {
            try {
                console.log('[JtvService] Auto-sync triggered: refreshing tokens, SonyLIV, Hotstar, FanCode, and live events...');
                await this.fetchWildcardCookie(true);
                await this.fetchChannels(true);
                await this.fetchLiveEvents(true);
                console.log('[JtvService] Auto-sync completed successfully.');
            } catch (err: any) {
                console.error('[JtvService] Auto-sync error:', err?.message || err);
            }
        }, intervalMs);
    }

    /**
     * Stop background auto-sync worker
     */
    public static stopAutoSync(): void {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }
    }
}
