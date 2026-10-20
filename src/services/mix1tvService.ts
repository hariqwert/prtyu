import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface Mix1TvChannel {
    id: string;
    channel_id: string;
    name: string;
    logo: string;
    group: string;
    category: string;
    stream_url: string;
    source: 'mix1tv';
    play_url?: string;
    key_id?: string;
    key?: string;
    clearkey?: string;
    drm?: {
        type: 'clearkey';
        key_id: string;
        key: string;
    };
    referrer: string;
    userAgent: string;
    cookie?: string;
    headers?: Record<string, string>;
}

export interface Mix1TvCategory {
    name: string;
    count: number;
    icon?: string;
}

interface Mix1TvCache {
    channels: Mix1TvChannel[];
    categories: Mix1TvCategory[];
    rawM3u: string;
    timestamp: number;
}

const MIX1TV_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/mixiptv.m3u';
const LOCAL_CACHE_FILE = path.join(process.cwd(), 'storage', 'mix1tv_cache.m3u');
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes RAM cache

let cache: Mix1TvCache | null = null;
let fetchingPromise: Promise<Mix1TvCache> | null = null;

function getGroupIcon(group: string): string {
    const lower = group.toLowerCase();
    if (lower.includes('cricket') || lower.includes('fancode')) return '🏏';
    if (lower.includes('football') || lower.includes('soccer')) return '⚽';
    if (lower.includes('racing') || lower.includes('f1')) return '🏎️';
    if (lower.includes('sport') || lower.includes('ten') || lower.includes('sonyliv')) return '🏆';
    if (lower.includes('movie') || lower.includes('cinema') || lower.includes('dangal')) return '🎬';
    if (lower.includes('music')) return '🎵';
    if (lower.includes('news')) return '📰';
    if (lower.includes('kids') || lower.includes('kidz')) return '🧸';
    if (lower.includes('hotstar')) return '⭐';
    if (lower.includes('zee')) return '📺';
    return '📺';
}

function parseMix1TvM3u(rawData: string): Mix1TvCache {
    const lines = rawData.split('\n');
    const channels: Mix1TvChannel[] = [];
    const categoryCountMap = new Map<string, number>();

    let cur: Partial<Mix1TvChannel> | null = null;
    let idx = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            const idM = line.match(/tvg-id="([^"]*)"/i);
            const nameM = line.match(/tvg-name="([^"]*)"/i);
            const logoM = line.match(/tvg-logo="([^"]*)"/i);
            const groupM = line.match(/group-title="([^"]*)"/i);
            const commaIdx = line.lastIndexOf(',');
            let title = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : (nameM ? nameM[1] : `Channel ${idx}`);
            if (!title) title = nameM ? nameM[1] : `Channel ${idx}`;

            const rawGroup = groupM ? groupM[1].trim() : 'Jio TV+ | Entertainment';
            const cleanGroup = rawGroup.replace(/^Jio\s*TV\+\s*\|\s*/i, '').trim() || rawGroup;

            cur = {
                id: idM ? idM[1].trim() : `mix_${idx}`,
                channel_id: `mix1tv_${idM ? idM[1].trim() : idx}`,
                name: title,
                logo: logoM ? logoM[1].trim() : '',
                group: cleanGroup,
                category: cleanGroup,
                source: 'mix1tv',
                referrer: 'https://www.jiotv.com/',
                userAgent: 'Premium Plugx',
                cookie: '',
                key_id: '',
                key: '',
                clearkey: ''
            };
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
            const keyPair = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim();
            if (cur && keyPair.includes(':')) {
                const parts = keyPair.split(':');
                cur.key_id = parts[0].trim();
                cur.key = parts[1].trim();
                cur.clearkey = keyPair;
                cur.drm = {
                    type: 'clearkey',
                    key_id: parts[0].trim(),
                    key: parts[1].trim()
                };
            }
        } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
            if (cur) cur.referrer = line.replace('#EXTVLCOPT:http-referrer=', '').trim() || 'https://www.jiotv.com/';
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
            if (cur) cur.userAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim() || 'Premium Plugx';
        } else if (line.startsWith('#EXTVLCOPT:http-cookie=')) {
            if (cur) cur.cookie = line.replace('#EXTVLCOPT:http-cookie=', '').trim();
        } else if (line.startsWith('http://') || line.startsWith('https://')) {
            if (cur) {
                let streamUrl = line.trim();
                // Extract cookie from __hdnea__ query param if present
                const hdneaMatch = streamUrl.match(/__hdnea__=([^\s&]+)/);
                if (hdneaMatch && !cur.cookie) {
                    cur.cookie = `__hdnea__=${hdneaMatch[1]}`;
                }

                // If cookie contains __hdnea__ and streamUrl doesn't have it, append it to URL
                if (cur.cookie && cur.cookie.includes('__hdnea__=') && !streamUrl.includes('__hdnea__=')) {
                    const tokenMatch = cur.cookie.match(/__hdnea__=[^\s;]+/);
                    if (tokenMatch) {
                        streamUrl = streamUrl + (streamUrl.includes('?') ? '&' : '?') + tokenMatch[0];
                    }
                }

                cur.stream_url = streamUrl;
                cur.headers = {
                    'Referer': cur.referrer || 'https://www.jiotv.com/',
                    'User-Agent': cur.userAgent || 'Premium Plugx',
                    ...(cur.cookie ? { 'Cookie': cur.cookie } : {})
                };

                const isMpd = streamUrl.includes('.mpd');
                const tokenParam = cur.cookie ? `&token=${encodeURIComponent(cur.cookie)}` : '';
                if (cur.clearkey && isMpd) {
                    cur.play_url = `/play_consumet.php?channel_id=${encodeURIComponent(cur.channel_id || '')}&url=${encodeURIComponent(streamUrl)}&key_id=${encodeURIComponent(cur.key_id || '')}&key=${encodeURIComponent(cur.key || '')}&name=${encodeURIComponent(cur.name || '')}${tokenParam}&source=mix1tv&type=dash`;
                } else {
                    cur.play_url = `/play_consumet.php?channel_id=${encodeURIComponent(cur.channel_id || '')}&url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(cur.name || '')}${tokenParam}&source=mix1tv&type=${isMpd ? 'dash' : 'hls'}`;
                }

                const completeChannel = cur as Mix1TvChannel;
                channels.push(completeChannel);

                const grp = completeChannel.group || 'General';
                categoryCountMap.set(grp, (categoryCountMap.get(grp) || 0) + 1);

                idx++;
                cur = null;
            }
        }
    }

    const categories: Mix1TvCategory[] = Array.from(categoryCountMap.entries())
        .map(([name, count]) => ({
            name,
            count,
            icon: getGroupIcon(name)
        }))
        .sort((a, b) => b.count - a.count);

    return {
        channels,
        categories,
        rawM3u: rawData,
        timestamp: Date.now()
    };
}

/**
 * Fetch and parse Mix1TV M3U directly with disk caching
 */
export async function getMix1TvData(forceRefresh = false): Promise<Mix1TvCache> {
    const now = Date.now();
    if (!forceRefresh && cache && (now - cache.timestamp < CACHE_TTL_MS)) {
        return cache;
    }

    if (fetchingPromise) {
        return fetchingPromise;
    }

    fetchingPromise = (async () => {
        try {
            console.log('[Mix1TvService] Fetching standalone mixiptv.m3u from GitHub...');
            let rawData = '';

            try {
                const response = await axios.get<string>(MIX1TV_M3U_URL, {
                    timeout: 25000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                rawData = response.data || '';
            } catch (netErr: any) {
                console.warn(`[Mix1TvService] GitHub fetch failed (${netErr?.message}), checking disk cache...`);
            }

            if (rawData && rawData.length > 5000) {
                try {
                    const dir = path.dirname(LOCAL_CACHE_FILE);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(LOCAL_CACHE_FILE, rawData, 'utf-8');
                } catch (fsErr) {
                    console.error('[Mix1TvService] Failed writing disk cache:', fsErr);
                }
            } else if (fs.existsSync(LOCAL_CACHE_FILE)) {
                console.log('[Mix1TvService] Loading from local disk cache:', LOCAL_CACHE_FILE);
                rawData = fs.readFileSync(LOCAL_CACHE_FILE, 'utf-8');
            }

            if (!rawData) {
                throw new Error('No Mix1TV data available from GitHub or local cache.');
            }

            cache = parseMix1TvM3u(rawData);
            console.log(`[Mix1TvService] Successfully loaded ${cache.channels.length} channels across ${cache.categories.length} categories.`);
            return cache;
        } catch (err: any) {
            console.error('[Mix1TvService] Error loading mixiptv.m3u:', err?.message || err);
            if (cache) return cache;
            return {
                channels: [],
                categories: [],
                rawM3u: '',
                timestamp: 0
            };
        } finally {
            fetchingPromise = null;
        }
    })();

    return fetchingPromise;
}

export async function getMix1TvChannels(forceRefresh = false): Promise<{
    count: number;
    channels: Mix1TvChannel[];
    categories: Mix1TvCategory[];
}> {
    const data = await getMix1TvData(forceRefresh);
    return {
        count: data.channels.length,
        channels: data.channels,
        categories: data.categories
    };
}

export async function resolveMix1TvStream(channelId: string): Promise<Mix1TvChannel | null> {
    const data = await getMix1TvData();
    const cleanId = String(channelId).replace(/^mix1tv_/, '').trim().toLowerCase();
    const found = data.channels.find(c => c.id.toLowerCase() === cleanId || c.channel_id.toLowerCase() === cleanId || c.name.toLowerCase() === cleanId);
    return found || null;
}

export async function getMix1TvRawM3u(forceRefresh = false, hostBase = 'http://localhost:3000'): Promise<string> {
    const data = await getMix1TvData(forceRefresh);
    if (!data.channels.length) return '#EXTM3U\n# Error: No Mix1TV channels available\n';

    let m3u = `#EXTM3U name="Mix1TV Live Network" url-tvg="https://avkb.short.gy/jioepg.xml.gz"\n`;
    for (const ch of data.channels) {
        const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : '';
        const grpAttr = ch.group ? ` group-title="${ch.group}"` : '';
        const idAttr = ` tvg-id="${ch.id}"`;
        m3u += `#EXTINF:-1${idAttr}${logoAttr}${grpAttr},${ch.name}\n`;
        if (ch.clearkey) {
            m3u += `#KODIPROP:inputstream=inputstream.adaptive\n`;
            m3u += `#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`;
            m3u += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
            m3u += `#KODIPROP:inputstream.adaptive.license_key=${ch.clearkey}\n`;
        }
        if (ch.userAgent) m3u += `#EXTVLCOPT:http-user-agent=${ch.userAgent}\n`;
        if (ch.referrer) m3u += `#EXTVLCOPT:http-referrer=${ch.referrer}\n`;
        if (ch.cookie) m3u += `#EXTVLCOPT:http-cookie=${ch.cookie}\n`;
        m3u += `${ch.stream_url}\n`;
    }
    return m3u;
}

// Backward-compatibility aliases for former Airtel callers
export const getAirtelData = getMix1TvData;
export const getAirtelChannels = getMix1TvChannels;
export const resolveAirtelStream = resolveMix1TvStream;
export const getAirtelRawM3u = getMix1TvRawM3u;
