import axios from 'axios';
import https from 'https';

export interface FanCodeEvent {
    id: string;
    matchId: number | string;
    title: string;
    eventName: string;
    sportCategory: string;
    team1?: string;
    team2?: string;
    status: 'LIVE' | 'UPCOMING' | 'FINISHED';
    startTime?: string;
    thumbnail: string;
    streamUrl?: string;
    playUrl?: string;
    m3u8Content?: string;
    token?: string;
    isLive: boolean;
    updatedAt: number;
}

/**
 * Wrap FanCode stream URLs through proxy-web-sage.vercel.app edge proxy (bom1 Mumbai)
 */
export function wrapFanCodeProxyUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.includes('proxy-web-sage.vercel.app')) return rawUrl;
    let cleanUrl = rawUrl;
    if (cleanUrl.includes('url=')) {
        const urlMatch = cleanUrl.match(/[?&]url=([^&]+)/);
        if (urlMatch) {
            try {
                cleanUrl = decodeURIComponent(urlMatch[1]);
            } catch (e) {}
        }
    }
    cleanUrl = cleanUrl.split('|')[0].trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return cleanUrl;
    return `https://proxy-web-sage.vercel.app/api/live-proxy?url=${encodeURIComponent(cleanUrl)}`;
}

const FANCODE_M3U_URLS = [
    'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u',
    'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u',
    'https://raw.githubusercontent.com/doctor-8trange/zyphx8/main/fancode.m3u'
];
const FANCODE_JSON_URLS = [
    
    'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json'
    
];

// In-memory cache for live FanCode events
let cachedLiveEvents: FanCodeEvent[] = [];
let cachedAllEvents: FanCodeEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute auto-refresh

/**
 * Parse standard M3U playlist format from FanCode upstream
 */
function parseFanCodeM3u(m3uContent: string): Map<string, { streamUrl: string; logo?: string; group?: string; title?: string }> {
    const streamMap = new Map<string, { streamUrl: string; logo?: string; group?: string; title?: string }>();
    if (!m3uContent) return streamMap;

    const lines = m3uContent.split(/\r?\n/);
    let currentLogo = '';
    let currentGroup = '';
    let currentTitle = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            const commaIdx = line.lastIndexOf(',');
            let rawTitle = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : '';
            // Clean any trailing tag remnants
            rawTitle = rawTitle.replace(/^(?:tvg-[^,]+|group-title="[^"]+"),\s*/gi, '').trim();
            currentTitle = rawTitle;
            currentLogo = logoMatch ? logoMatch[1] : '';
            currentGroup = groupMatch ? groupMatch[1] : 'FanCode';
        } else if (line.startsWith('http://') || line.startsWith('https://')) {
            const streamUrl = line.split('|')[0].trim();
            // Match ID extraction e.g. /mumbai/4249577_english_hls...
            const matchIdMatch = streamUrl.match(/\/(\d{5,10})_/);
            const matchKey = matchIdMatch ? matchIdMatch[1] : currentTitle;

            streamMap.set(matchKey, {
                streamUrl,
                logo: currentLogo,
                group: currentGroup,
                title: currentTitle
            });
            // Also store by full title lowercase for fuzzy lookup
            if (currentTitle) {
                streamMap.set(currentTitle.toLowerCase().replace(/\[.*?\]|\(.*?\)/g, '').trim(), {
                    streamUrl,
                    logo: currentLogo,
                    group: currentGroup,
                    title: currentTitle
                });
            }
        }
    }

    return streamMap;
}

/**
 * Fetch and synchronize ongoing FanCode live sports events
 */
export async function fetchFanCodeEvents(forceRefresh = false): Promise<{ live: FanCodeEvent[]; all: FanCodeEvent[] }> {
    const now = Date.now();
    if (!forceRefresh && cachedLiveEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return { live: cachedLiveEvents, all: cachedAllEvents };
    }

    try {
        let streamMap = new Map<string, { streamUrl: string; logo?: string; group?: string; title?: string }>();
        for (const m3uUrl of FANCODE_M3U_URLS) {
            try {
                const res = await axios.get(m3uUrl, { timeout: 4000 });
                if (typeof res.data === 'string' && res.data.includes('#EXTINF:')) {
                    streamMap = parseFanCodeM3u(res.data);
                    if (streamMap.size > 0) break;
                }
            } catch (e) {}
        }

        let jsonEvents: any[] = [];
        for (const jsonUrl of FANCODE_JSON_URLS) {
            try {
                const res = await axios.get(jsonUrl, { timeout: 4000 });
                const matches = res.data?.matches || (Array.isArray(res.data) ? res.data : null);
                if (Array.isArray(matches) && matches.length > 0) {
                    jsonEvents = matches;
                    break;
                }
            } catch (e) {}
        }

        const allList: FanCodeEvent[] = [];
        const liveList: FanCodeEvent[] = [];

        // 1. Process matches from json feed
        for (const m of jsonEvents) {
            const matchIdStr = String(m.match_id || '');
            const matchKey = matchIdStr;
            const cleanTitle = (m.title || m.match_name || 'FanCode Match').replace(/\[.*?\]|\(.*?\)/g, '').trim();
            const streamData = streamMap.get(matchKey) || streamMap.get(cleanTitle.toLowerCase());

            let streamUrl = streamData?.streamUrl || m.video_url || m.pub_url || m.dai_url || '';
            if (!streamUrl && m.akamai_m3u8_hex) {
                try {
                    const decoded = Buffer.from(m.akamai_m3u8_hex, 'hex').toString('utf8');
                    const urls = decoded.match(/https?:\/\/[^\s]+/g);
                    if (urls && urls.length > 0) {
                        streamUrl = urls[urls.length - 1]; // Pick highest resolution (1080p)
                    }
                } catch (e) {}
            }
            const isLive = Boolean(streamUrl || m.status === 'LIVE');
            const proxiedStream = wrapFanCodeProxyUrl(streamUrl);
            const event: FanCodeEvent = {
                    id: `fancode-${matchIdStr}`,
                    matchId: m.match_id,
                    title: m.title || m.match_name || 'Live Sports',
                    eventName: m.event_name || 'FanCode Live',
                    sportCategory: m.event_category || 'Cricket',
                    team1: m.team_1,
                    team2: m.team_2,
                    status: isLive ? 'LIVE' : (m.status || 'UPCOMING'),
                    startTime: m.startTime,
                    thumbnail: m.src || streamData?.logo || 'https://www.fancode.com/skillup-uploads/cms-media/web-1.png',
                    streamUrl: proxiedStream,
                    playUrl: proxiedStream ? `/play_consumet.php?channel_id=fancode-${matchIdStr}&name=${encodeURIComponent(m.title || m.match_name)}&url=${encodeURIComponent(proxiedStream)}&logo=${encodeURIComponent(m.src || streamData?.logo || '')}&source=fancode&type=hls` : undefined,
                    isLive,
                    updatedAt: now
                };

                allList.push(event);
                if (isLive && proxiedStream) {
                    liveList.push(event);
                }
            }

            // 2. Add any active streams from M3U that weren't in JSON
            for (const [key, val] of streamMap.entries()) {
                if (/^\d+$/.test(key) && !liveList.some(e => String(e.matchId) === key)) {
                    const proxiedStream = wrapFanCodeProxyUrl(val.streamUrl || '');
                    const event: FanCodeEvent = {
                        id: `fancode-${key}`,
                        matchId: key,
                        title: val.title || `FanCode Match #${key}`,
                        eventName: val.group || 'FanCode Live',
                        sportCategory: (val.group || '').includes('Cricket') ? 'Cricket' : ((val.group || '').includes('Football') ? 'Football' : 'Sports'),
                        status: 'LIVE',
                        thumbnail: val.logo || 'https://www.fancode.com/skillup-uploads/cms-media/web-1.png',
                        streamUrl: proxiedStream,
                        playUrl: `/play_consumet.php?channel_id=fancode-${key}&name=${encodeURIComponent(val.title || `FanCode Match #${key}`)}&url=${encodeURIComponent(proxiedStream)}&logo=${encodeURIComponent(val.logo || '')}&source=fancode&type=hls`,
                        isLive: true,
                        updatedAt: now
                    };
                    liveList.push(event);
                    allList.unshift(event);
                }
            }

            cachedLiveEvents = liveList;
            cachedAllEvents = allList;
            lastFetchTime = now;

            console.log(`[FanCode] Refreshed: ${liveList.length} ongoing live streams, ${allList.length} total events`);
            return { live: liveList, all: allList };
        } catch (err: any) {
            console.warn('[FanCode] Refresh warning:', err?.message);
            return { live: cachedLiveEvents, all: cachedAllEvents };
        }
    }

    /**
     * Generate standard IPTV M3U for FanCode live sports
     */
    export async function getFanCodeM3u(baseUrl?: string): Promise<string> {
        const { live } = await fetchFanCodeEvents();
        let m3u = `#EXTM3U\n`;
        for (const ev of live) {
            if (!ev.streamUrl) continue;
            const category = ev.sportCategory ? `Fancode-${ev.sportCategory}` : 'FanCode Live';
            const streamTarget = wrapFanCodeProxyUrl(ev.streamUrl);
            m3u += `#EXTINF:-1 tvg-id="${ev.id}" tvg-name="${ev.title}" tvg-logo="${ev.thumbnail}" group-title="${category}",${ev.title}\n`;
            m3u += `${streamTarget}\n\n`;
        }
        return m3u;
}

// Background auto-updater every 2 minutes
setInterval(() => {
    fetchFanCodeEvents(true).catch(() => {});
}, 2 * 60 * 1000);
