import axios from 'axios';
import https from 'https';

export interface SonyLivEvent {
    id: string;
    contentId: string | number;
    title: string;
    eventName: string;
    category: string;
    sportName?: string;
    sportEmoji?: string;
    broadcastChannel: string;
    isLive: boolean;
    status: 'LIVE' | 'UPCOMING';
    thumbnail: string;
    streamUrl?: string;
    playUrl?: string;
    m3u8Content?: string;
    token?: string;
    language?: string;
    updatedAt: number;
}

const SONYLIV_M3U_URLS = [
    'https://raw.githubusercontent.com/doctor-8trange/zyphora/main/data/sony.m3u',
    'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.m3u',
    'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/refs/heads/main/sonyliv.m3u'
];

const SONYLIV_JSON_URLS = [
    'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json',
    'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.json'
];

let cachedLiveEvents: SonyLivEvent[] = [];
let cachedUpcomingEvents: SonyLivEvent[] = [];
let cachedAllEvents: SonyLivEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute auto-refresh

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 8000
});

function getSportEmoji(cat: string): string {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('cricket')) return '🏏';
    if (lower.includes('football') || lower.includes('soccer')) return '⚽';
    if (lower.includes('tennis')) return '🎾';
    if (lower.includes('combat') || lower.includes('mma') || lower.includes('ufc') || lower.includes('wwe')) return '🥊';
    if (lower.includes('f1') || lower.includes('motorsport')) return '🏎️';
    if (lower.includes('basketball')) return '🏀';
    return '🏆';
}

/**
 * Normalize Sony CDN stream URLs:
 * Akamai de-authorized sonydaimenew.akamaized.net and moved Sony LIV live sports to sonymtmnew.akamaized.net
 */
export function normalizeSonyLivStreamUrl(url: string): string {
    if (!url) return '';
    let normalized = url.trim();
    if (normalized.includes('sonydaimenew.akamaized.net')) {
        normalized = normalized.replace(/sonydaimenew\.akamaized\.net/g, 'sonymtmnew.akamaized.net');
    }
    return normalized;
}

/**
 * Fetch and synchronize ongoing and upcoming SonyLIV sports fixtures
 */
export async function fetchSonyLivEvents(forceRefresh = false): Promise<{ live: SonyLivEvent[]; upcoming: SonyLivEvent[]; all: SonyLivEvent[] }> {
    const now = Date.now();
    if (!forceRefresh && cachedAllEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return { live: cachedLiveEvents, upcoming: cachedUpcomingEvents, all: cachedAllEvents };
    }

    const liveEvents: SonyLivEvent[] = [];
    const upcomingEvents: SonyLivEvent[] = [];
    const allEvents: SonyLivEvent[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch from active SonyLIV M3U Feeds (Primary: drmlive with fresh hdnea tokens)
    for (const m3uUrl of SONYLIV_M3U_URLS) {
        try {
            const res = await axios.get(m3uUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                httpsAgent,
                timeout: 7000
            });

            if (res.data && typeof res.data === 'string' && res.data.includes('#EXTINF')) {
                const lines = res.data.split('\n');
                let currentInfo: any = null;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'SonyLIV Event';
                        const idMatch = line.match(/tvg-id="([^"]+)"/);
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        const langMatch = line.match(/tvg-language="([^"]+)"/);

                        currentInfo = {
                            id: idMatch ? idMatch[1] : '',
                            title: rawTitle,
                            logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/UI_icons/sonyliv_new_revised_header_logo.png',
                            category: (groupMatch ? groupMatch[1] : 'Sports').replace(/^sonyliv-/i, ''),
                            language: langMatch ? langMatch[1] : 'ENG'
                        };
                    } else if (currentInfo && (line.startsWith('http://') || line.startsWith('https://'))) {
                        let streamUrl = line.split('|')[0].trim();
                        // Auto-migrate Akamai host to sonymtmnew
                        streamUrl = normalizeSonyLivStreamUrl(streamUrl);

                        const cid = currentInfo.id || `${Math.abs(currentInfo.title.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;
                        const eventId = `sonyliv_${cid}`;

                        if (!seenIds.has(eventId)) {
                            seenIds.add(eventId);

                            const directProxyUrl = `/live.php?url=${encodeURIComponent(streamUrl)}`;
                            const playUrl = `/play_consumet.php?channel_id=${eventId}&name=${encodeURIComponent(currentInfo.title)}&url=${encodeURIComponent(directProxyUrl)}&logo=${encodeURIComponent(currentInfo.logo)}&source=sonyliv&type=hls`;
                            const emoji = getSportEmoji(currentInfo.category);

                            const ev: SonyLivEvent = {
                                id: eventId,
                                contentId: cid,
                                title: currentInfo.title,
                                eventName: currentInfo.title,
                                category: currentInfo.category,
                                sportName: currentInfo.category,
                                sportEmoji: emoji,
                                broadcastChannel: 'SonyLIV',
                                isLive: true,
                                status: 'LIVE',
                                thumbnail: currentInfo.logo,
                                streamUrl: streamUrl,
                                playUrl,
                                language: currentInfo.language,
                                updatedAt: now
                            };

                            allEvents.push(ev);
                            liveEvents.push(ev);
                        }

                        currentInfo = null;
                    }
                }

                if (liveEvents.length > 0) {
                    console.log(`[SonyLivService] Loaded ${liveEvents.length} active SonyLIV live matches from M3U (${m3uUrl}).`);
                    break;
                }
            }
        } catch (e: any) {
            console.warn(`[SonyLivService] Mirror ${m3uUrl} failed:`, e?.message || e);
        }
    }

    // 2. Fetch JSON matches if available as fallback or supplemental fixtures
    for (const url of SONYLIV_JSON_URLS) {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                httpsAgent,
                timeout: 6000
            });
            if (res.data && Array.isArray(res.data.matches) && res.data.matches.length > 0) {
                res.data.matches.forEach((m: any, idx: number) => {
                    const isLive = m.isLive === true;
                    const cid = m.contentId || idx;
                    const eventId = `sonyliv_${cid}`;
                    if (seenIds.has(eventId)) return;
                    seenIds.add(eventId);

                    const title = m.match_name || m.event_name || `SonyLIV Match ${idx + 1}`;
                    let rawStream = m.video_url || m.pub_url || m.dai_url || '';
                    if (rawStream) rawStream = normalizeSonyLivStreamUrl(rawStream);

                    const thumb = m.src || 'https://origin-staticv2.sonyliv.com/UI_icons/sonyliv_new_revised_header_logo.png';
                    const cat = m.event_category || 'Sports';
                    const ch = m.broadcast_channel || 'SonyLIV';
                    const emoji = getSportEmoji(cat);

                    const playUrl = rawStream
                        ? `/play_consumet.php?channel_id=${eventId}&name=${encodeURIComponent(title)}&url=${encodeURIComponent('/api/play_stream/' + eventId)}&logo=${encodeURIComponent(thumb)}&source=sonyliv&type=hls`
                        : '#';

                    const ev: SonyLivEvent = {
                        id: eventId,
                        contentId: cid,
                        title,
                        eventName: m.event_name || title,
                        category: cat,
                        sportName: cat,
                        sportEmoji: emoji,
                        broadcastChannel: ch,
                        isLive,
                        status: isLive ? 'LIVE' : 'UPCOMING',
                        thumbnail: thumb,
                        streamUrl: rawStream,
                        playUrl,
                        language: m.audioLanguageName || 'ENG',
                        updatedAt: now
                    };

                    allEvents.push(ev);
                    if (isLive && rawStream) {
                        liveEvents.push(ev);
                    } else if (!isLive) {
                        upcomingEvents.push(ev);
                    }
                });
                break;
            }
        } catch (e) {
            // Try next mirror
        }
    }

    if (allEvents.length > 0) {
        cachedLiveEvents = liveEvents;
        cachedUpcomingEvents = upcomingEvents;
        cachedAllEvents = allEvents;
        lastFetchTime = now;
        return { live: liveEvents, upcoming: upcomingEvents, all: allEvents };
    }

    return { live: cachedLiveEvents, upcoming: cachedUpcomingEvents, all: cachedAllEvents };
}

