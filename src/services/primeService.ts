import axios from 'axios';
import https from 'https';

export interface PrimeEvent {
    id: string;
    matchId: string;
    title: string;
    rawTitle: string;
    name: string;
    synopsis?: string;
    status: 'LIVE' | 'UPCOMING';
    isLive: boolean;
    time?: string;
    thumbnail: string;
    cover_image?: string;
    matchUrl: string;
    streamUrl: string;
    stream_url: string;
    drmKey: string;
    clearkey: string;
    keyId: string;
    key: string;
    sportName: string;
    sportEmoji: string;
    category: string;
    league: string;
    source: 'prime';
    isPrime: boolean;
    playUrl: string;
    canWatch: boolean;
    countdown?: string;
}

const PRIME_VIDEO_JSON_URL = 'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/primevideo_sports.json';
const PRIME_BACKUP_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/primesport.json';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 8000
});

let cachedPrimeEvents: PrimeEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

function detectSportAndEmoji(title: string, synopsis: string): { sport: string; emoji: string } {
    const text = `${title} ${synopsis}`.toLowerCase();
    if (text.includes('cricket') || text.includes('india') || text.includes('west indies') || text.includes('t20') || text.includes('odi') || text.includes('champions')) {
        return { sport: 'Cricket', emoji: '🏏' };
    }
    if (text.includes('drive') || text.includes('golf') || text.includes('pga')) {
        return { sport: 'Golf', emoji: '⛳' };
    }
    if (text.includes('tennis') || text.includes('cordoba') || text.includes('boca raton') || text.includes('ptt') || text.includes('atp') || text.includes('wta')) {
        return { sport: 'Tennis', emoji: '🎾' };
    }
    if (text.includes('football') || text.includes('soccer') || text.includes('fifa')) {
        return { sport: 'Football', emoji: '⚽' };
    }
    if (text.includes('nba') || text.includes('basketball')) {
        return { sport: 'Basketball', emoji: '🏀' };
    }
    return { sport: 'Sports', emoji: '🏆' };
}

export function extractPrimeStreamUrl(rawStream: any): string {
    if (!rawStream) return '';
    if (typeof rawStream === 'string') return rawStream.trim();
    if (typeof rawStream === 'object') {
        const val = rawStream['Cloudfront Server 1'] ||
                    rawStream['Amazon Server'] ||
                    rawStream['Fastly Server'] ||
                    rawStream['Fistly Server'] ||
                    rawStream['Akamai Server'] ||
                    rawStream['Cloudfront Server 2'] ||
                    rawStream['Original Server'] ||
                    Object.values(rawStream).find(v => typeof v === 'string' && v.trim()) ||
                    '';
        return (typeof val === 'string' ? val : '').trim();
    }
    return '';
}

export async function fetchPrimeEvents(forceRefresh = false): Promise<PrimeEvent[]> {
    const now = Date.now();
    if (!forceRefresh && cachedPrimeEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return cachedPrimeEvents;
    }

    const urls = [PRIME_VIDEO_JSON_URL, PRIME_BACKUP_JSON_URL];
    let matches: any[] = [];

    for (const u of urls) {
        try {
            const res = await axios.get(u, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent
            });
            if (res.data && Array.isArray(res.data.Matches) && res.data.Matches.length > 0) {
                matches = res.data.Matches;
                break;
            }
        } catch (err: any) {
            console.warn(`[PrimeService] Warning fetching ${u}:`, err?.message || err);
        }
    }

    if (matches.length === 0) {
        return cachedPrimeEvents;
    }

    try {
        const events: PrimeEvent[] = matches.map((m: any, idx: number) => {
            const matchId = String(m.match_id || `prime_${idx + 1}`);
            const isLive = String(m.status || '').toUpperCase() === 'LIVE';
            const title = (m.title || m.synopsis || `Sports Match #${idx + 1}`).trim();
            const synopsis = (m.synopsis || title).trim();
            const streamUrl = extractPrimeStreamUrl(m.stream_url) || extractPrimeStreamUrl(m.stream_url_alpha) || extractPrimeStreamUrl(m.stream_url_bravo);
            const drmKey = (typeof m.drm_key === 'string' ? m.drm_key : (typeof m.clearkey === 'string' ? m.clearkey : '')).trim();
            const keyParts = drmKey.includes(':') ? drmKey.split(':') : ['', ''];
            const keyId = keyParts[0].trim();
            const key = keyParts[1].trim();

            const thumbnail = m.cover_image || 'https://images-na.ssl-images-amazon.com/images/G/01/digital/video/merch/subs/benefit-id/a-f/freewithads/logos/channels-logo-white.png';
            const { sport, emoji } = detectSportAndEmoji(title, synopsis);

            const streamType = streamUrl.includes('.m3u8') ? 'hls' : 'dash';
            const playUrl = `/play_consumet.php?channel_id=prime_${encodeURIComponent(matchId)}&name=${encodeURIComponent(title)}&url=${encodeURIComponent(streamUrl)}&key_id=${encodeURIComponent(keyId)}&key=${encodeURIComponent(key)}&clearkey=${encodeURIComponent(drmKey)}&source=prime&type=${streamType}`;

            const leagueName = (m.league || (sport ? `${sport} Tour` : 'Live Sports')).trim();

            return {
                id: `prime_${matchId}`,
                matchId: matchId,
                title: title,
                rawTitle: title,
                name: title,
                synopsis: synopsis,
                status: isLive ? 'LIVE' : 'UPCOMING',
                isLive: isLive,
                time: m.time || (isLive ? 'LIVE NOW' : 'UPCOMING'),
                thumbnail: thumbnail,
                cover_image: thumbnail,
                matchUrl: m.match_url || '',
                streamUrl: streamUrl,
                stream_url: streamUrl,
                drmKey: drmKey,
                clearkey: drmKey,
                keyId: keyId,
                key: key,
                sportName: sport,
                sportEmoji: emoji,
                category: sport.toLowerCase(),
                league: leagueName,
                source: 'prime',
                isPrime: true,
                playUrl: playUrl,
                canWatch: !!streamUrl,
                countdown: isLive ? 'LIVE NOW' : (m.time || 'UPCOMING')
            };
        });

        cachedPrimeEvents = events;
        lastFetchTime = now;
        console.log(`[PrimeService] Loaded ${events.length} Amazon Prime sports events.`);
        return events;
    } catch (err: any) {
        console.warn('[PrimeService] Error fetching Prime Video sports:', err?.message || err);
        return cachedPrimeEvents;
    }
}
