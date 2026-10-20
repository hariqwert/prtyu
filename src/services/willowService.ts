import axios from 'axios';
import { fetchPrimeEvents, PrimeEvent } from './primeService';

export interface WillowEvent {
    id: string;
    matchId: string;
    title: string;
    rawTitle: string;
    name: string;
    synopsis?: string;
    status: 'LIVE' | 'UPCOMING';
    isLive: boolean;
    time?: string;
    timeIST?: string;
    thumbnail: string;
    cover_image?: string;
    matchUrl: string;
    streamUrl?: string;
    stream_url?: string;
    drmKey?: string;
    clearkey?: string;
    sportName: string;
    sportEmoji: string;
    category: string;
    league: string;
    source: 'willow';
    isWillow: boolean;
    playUrl: string;
    canWatch: boolean;
    countdown?: string;
    startMinutes?: number;
    startTime?: number;
    isLatestLiveEvent?: boolean;
    isWillowActiveBroadcast?: boolean;
    channels?: Array<{
        channelName: string;
        language: string;
        isEnglish: boolean;
        userHasChannel: boolean;
        userChannelUrl: string;
        playUrl: string;
    }>;
}

export function parseEventStartTime(timeStr?: string): number {
    if (!timeStr) return 0;
    const str = String(timeStr).trim();
    
    let hours = 0;
    let minutes = 0;
    
    // Pattern 1: HH:MM with optional AM/PM
    const matchCol = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (matchCol) {
        hours = parseInt(matchCol[1], 10);
        minutes = parseInt(matchCol[2], 10);
        const ampm = matchCol[3] ? matchCol[3].toLowerCase() : null;
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
    } else {
        // Pattern 2: HH followed by AM/PM
        const matchAmPm = str.match(/(\d{1,2})\s*(am|pm)/i);
        if (matchAmPm) {
            hours = parseInt(matchAmPm[1], 10);
            minutes = 0;
            const ampm = matchAmPm[2].toLowerCase();
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
        }
    }
    
    let dayOffset = 0;
    if (/tomorrow/i.test(str)) {
        dayOffset = 24 * 60;
    }
    const monthMatch = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})/i);
    if (monthMatch) {
        const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const mIdx = monthNames.indexOf(monthMatch[1].toLowerCase().slice(0, 3));
        const day = parseInt(monthMatch[2], 10);
        dayOffset += (mIdx * 31 + day) * 24 * 60;
    }
    
    return dayOffset + (hours * 60) + minutes;
}

const WILLOW_JSON_URL = 'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.json';
const WILLOW_BACKUP_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/willow.json';

export function extractWillowStreamUrl(m: any): string {
    if (!m) return '';
    const sources = [m.stream_url_alpha, m.stream_url_bravo, m.stream_url];
    for (const src of sources) {
        if (!src) continue;
        if (typeof src === 'string' && src.trim()) return src.trim();
        if (typeof src === 'object') {
            const val = src['Cloudfront Server 1'] ||
                        src['Amazon Server'] ||
                        src['Fastly Server'] ||
                        src['Fistly Server'] ||
                        src['Akamai Server'] ||
                        src['Cloudfront Server 2'] ||
                        src['Original Server'] ||
                        Object.values(src).find(v => typeof v === 'string' && v.trim()) || '';
            if (typeof val === 'string' && val.trim()) return val.trim();
        }
    }
    return '';
}

let cachedWillowEvents: WillowEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export async function fetchWillowEvents(forceRefresh = false): Promise<WillowEvent[]> {
    const now = Date.now();
    if (!forceRefresh && cachedWillowEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return cachedWillowEvents;
    }

    const urls = [WILLOW_JSON_URL, WILLOW_BACKUP_JSON_URL];
    let matches: any[] = [];

    for (const u of urls) {
        try {
            const res = await axios.get(u, {
                timeout: 6000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (res.data && Array.isArray(res.data.Matches) && res.data.Matches.length > 0) {
                matches = res.data.Matches;
                break;
            }
        } catch (err: any) {
            console.warn(`[WillowService] Warning fetching ${u}:`, err?.message || err);
        }
    }

    if (matches.length === 0) {
        return cachedWillowEvents;
    }

    let primeEvents: PrimeEvent[] = [];
    try {
        primeEvents = await fetchPrimeEvents(false);
    } catch (_) {}

    const events: WillowEvent[] = matches.map((m: any, idx: number) => {
        const matchId = String(m.match_id || `willow_${idx + 1}`);
        const isLive = String(m.status || '').toUpperCase() === 'LIVE';
        const title = m.title || m.synopsis || `Willow Match #${idx + 1}`;
        const rawStream = extractWillowStreamUrl(m);
        const drmKey = (typeof m.drm_key === 'string' ? m.drm_key : (typeof m.clearkey === 'string' ? m.clearkey : '')).trim();
        const thumbnail = m.cover_image || 'https://www.willow.tv/images/willow-logo.png';
        
        let playUrl = '';
        let resolvedStream = rawStream;
        let resolvedDrmKey = drmKey;

        if (rawStream) {
            const encodedStream = encodeURIComponent(rawStream);
            const keyParam = drmKey ? `&clearkey=${encodeURIComponent(drmKey)}` : '';
            const streamType = (rawStream.includes('.mpd') || drmKey) ? 'dash' : 'hls';
            playUrl = `/play_consumet.php?channel_id=willow_${matchId}&name=${encodeURIComponent(title)}&url=${encodedStream}${keyParam}&source=willow&type=${streamType}`;
        } else {
            // Check if there is an active Amazon Prime stream for this match (e.g. India vs West Indies)
            const titleLower = title.toLowerCase();
            const primeMatch = primeEvents.find(p => {
                if (!p.streamUrl) return false;
                const pTitle = p.title.toLowerCase();
                if (titleLower.includes('india') && pTitle.includes('india')) return true;
                if (titleLower.includes('west indies') && pTitle.includes('west indies')) return true;
                if (titleLower.includes('champions') && pTitle.includes('champions')) return true;
                return false;
            });

            if (primeMatch && primeMatch.streamUrl) {
                resolvedStream = primeMatch.streamUrl;
                resolvedDrmKey = primeMatch.drmKey;
                playUrl = primeMatch.playUrl;
            } else {
                // Live/Upcoming fallback: fallback to Willow TV live channel stream
                playUrl = `/play_consumet.php?channel_id=willow_${matchId}&name=${encodeURIComponent(title)}&url=${encodeURIComponent('/live.php?token=STALKER_PRO&id=dlhd-willow-hd&m3u=1')}&source=willow&type=hls`;
            }
        }

        const startMinutes = parseEventStartTime(m.time);

        return {
            id: `willow_${matchId}`,
            matchId: matchId,
            title: title,
            rawTitle: title,
            name: title,
            synopsis: m.synopsis || title,
            status: isLive ? 'LIVE' : 'UPCOMING',
            isLive: isLive,
            time: m.time || (isLive ? 'LIVE NOW' : 'UPCOMING'),
            timeIST: m.time || (isLive ? 'LIVE NOW' : 'UPCOMING'),
            thumbnail: thumbnail,
            cover_image: thumbnail,
            matchUrl: m.match_url || '',
            streamUrl: resolvedStream,
            stream_url: resolvedStream,
            drmKey: resolvedDrmKey,
            clearkey: resolvedDrmKey,
            sportName: 'Cricket',
            sportEmoji: '🏏',
            category: 'cricket',
            league: 'Willow Cricket Event',
            source: 'willow',
            isWillow: true,
            playUrl: playUrl,
            canWatch: true,
            countdown: isLive ? 'LIVE NOW' : (m.time || 'UPCOMING'),
            startMinutes: startMinutes,
            startTime: startMinutes,
            channels: [{
                channelName: 'Willow Cricket HD',
                language: 'English',
                isEnglish: true,
                userHasChannel: true,
                userChannelUrl: resolvedStream || '/live.php?token=STALKER_PRO&id=dlhd-willow-hd&m3u=1',
                playUrl: playUrl
            }]
        };
    });

    // WILLOW STREAM RULE:
    // 1. If ANY India event is live/listed, HIGHLIGHT THAT FIRST!
    // 2. Otherwise, Willow only broadcasts ONE event at a time, so pick latest started event!
    let latestLiveId = '';
    let maxStartVal = -1;

    // Check for any live India match
    const liveIndiaMatches = events.filter(e => (e.isLive || e.status === 'LIVE') && /india|ind\s*(vs|\/|-)|india\s*champions/i.test(e.title || e.rawTitle || ''));
    if (liveIndiaMatches.length > 0) {
        // Highlight India match first! If multiple, pick latest started
        const sortedIndia = [...liveIndiaMatches].sort((a, b) => (b.startMinutes || 0) - (a.startMinutes || 0));
        latestLiveId = sortedIndia[0].id;
    } else {
        events.forEach(e => {
            if (e.isLive || e.status === 'LIVE') {
                const startVal = e.startMinutes || 0;
                if (startVal > maxStartVal) {
                    maxStartVal = startVal;
                    latestLiveId = e.id;
                }
            }
        });
    }

    // Mark the latest live event as active broadcast, and conclude linear stream for older live events
    events.forEach(e => {
        if (e.isLive || e.status === 'LIVE') {
            const isLatest = (!latestLiveId || e.id === latestLiveId);
            e.isLatestLiveEvent = isLatest;
            e.isWillowActiveBroadcast = isLatest;
            if (isLatest) {
                e.canWatch = true;
                e.countdown = 'LIVE NOW • ON AIR';
            } else {
                // If this is an older live event without its own separate stream URL,
                // Willow linear broadcast has moved on to the later event
                const hasDedicatedStream = Boolean(e.streamUrl && !e.streamUrl.includes('dlhd-willow-hd'));
                if (!hasDedicatedStream) {
                    e.canWatch = false;
                    e.countdown = 'Concluded (Willow switched to latest match)';
                    e.timeIST = e.time ? `${e.time} (Concluded)` : 'Concluded';
                }
            }
        }
    });

    cachedWillowEvents = events;
    lastFetchTime = now;
    console.log(`[WillowService] Successfully loaded ${events.length} Willow cricket events.`);
    return events;
}
