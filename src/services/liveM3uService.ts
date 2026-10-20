import axios from 'axios';

export interface LiveM3uChannel {
    id: string;
    name: string;
    logo: string;
    group: string;
    category: string;
    stream_url: string;
    type: 'mpd' | 'hls' | 'mpegts';
    user_agent?: string;
    referrer?: string;
    license_type?: string;
    license_key?: string;
    key_id?: string;
    key?: string;
    source: 'livem3u';
    play_url?: string;
}

export interface LiveM3uCategory {
    name: string;
    count: number;
    icon?: string;
}

interface LiveM3uCache {
    channels: LiveM3uChannel[];
    categories: LiveM3uCategory[];
    rawM3u: string;
    timestamp: number;
}

const LIVE_M3U_URL = 'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.m3u';
const LIVE_M3U_URLS = [
    'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.m3u'
];
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes auto-update interval

let cache: LiveM3uCache | null = null;
let fetchingPromise: Promise<LiveM3uCache> | null = null;
let autoUpdateTimer: NodeJS.Timeout | null = null;

function getGroupIcon(group: string): string {
    const lower = group.toLowerCase();
    if (lower.includes('cricket')) return '🏏';
    if (lower.includes('football') || lower.includes('soccer') || lower.includes('league') || lower.includes('champions')) return '⚽';
    if (lower.includes('tennis')) return '🎾';
    if (lower.includes('snooker')) return '🎱';
    if (lower.includes('racing') || lower.includes('f1')) return '🏎️';
    if (lower.includes('basketball')) return '🏀';
    if (lower.includes('espn') || lower.includes('sport') || lower.includes('tnt') || lower.includes('sky')) return '🏆';
    return '⚡';
}

function cleanCategoryName(rawGroup: string): string {
    if (!rawGroup) return 'Live Sports';
    const trimmed = rawGroup.replace(/^[#\s]+|[#\s]+$/g, '').trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'Live Sports';
    return trimmed || 'Live Sports';
}

/**
 * Fetch and parse Live.m3u and LiveEvent.m3u from GitHub
 */
export async function getLiveM3uData(forceRefresh = false): Promise<LiveM3uCache> {
    const now = Date.now();
    if (!forceRefresh && cache && (now - cache.timestamp < CACHE_TTL_MS)) {
        return cache;
    }

    if (fetchingPromise) {
        return fetchingPromise;
    }

    fetchingPromise = (async () => {
        try {
            console.log('[LiveM3uService] Fetching auto-updating LiveEvent.m3u & Live.m3u from GitHub...');
            
            const responses = await Promise.allSettled(
                LIVE_M3U_URLS.map(u => axios.get<string>(u, {
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                }))
            );

            const allM3uTexts = responses
                .filter((r): r is PromiseFulfilledResult<axios.AxiosResponse<string>> => r.status === 'fulfilled' && typeof r.value.data === 'string')
                .map(r => r.value.data);

            const rawData = allM3uTexts.join('\n');
            const lines = rawData.split('\n');

            const channels: LiveM3uChannel[] = [];
            const categoryCountMap = new Map<string, number>();
            const seenStreams = new Set<string>();

            let currentInfo: {
                id?: string;
                name?: string;
                logo?: string;
                group?: string;
                userAgent?: string;
                referrer?: string;
                licenseType?: string;
                licenseKey?: string;
            } | null = null;

            let index = 1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (line.startsWith('#EXTINF:')) {
                    const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
                    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
                    const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
                    const groupTitleMatch = line.match(/group-title="([^"]*)"/i);

                    const commaIdx = line.lastIndexOf(',');
                    let rawName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';
                    if (!rawName && tvgNameMatch) rawName = tvgNameMatch[1].trim();
                    if (!rawName && tvgIdMatch) rawName = tvgIdMatch[1].trim();
                    if (!rawName) rawName = `Live Event ${index}`;

                    const rawGroup = groupTitleMatch ? groupTitleMatch[1].trim() : 'Live Sports';

                    currentInfo = {
                        id: `livem3u-${index}`,
                        name: rawName,
                        logo: tvgLogoMatch ? tvgLogoMatch[1].trim() : '',
                        group: rawGroup
                    };
                } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
                    if (currentInfo) {
                        currentInfo.userAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
                    }
                } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
                    if (currentInfo) {
                        currentInfo.referrer = line.replace('#EXTVLCOPT:http-referrer=', '').trim();
                    }
                } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
                    if (currentInfo) {
                        currentInfo.licenseType = line.replace('#KODIPROP:inputstream.adaptive.license_type=', '').trim();
                    }
                } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    if (currentInfo) {
                        currentInfo.licenseKey = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim();
                    }
                } else if (line.startsWith('http://') || line.startsWith('https://')) {
                    if (currentInfo) {
                        let streamUrl = line;
                        // Separate attached headers from stream URL if present (e.g. url|http-user-agent=...)
                        if (streamUrl.includes('|http-user-agent=')) {
                            const parts = streamUrl.split('|http-user-agent=');
                            streamUrl = parts[0];
                            if (!currentInfo.userAgent && parts[1]) {
                                currentInfo.userAgent = parts[1].split('&')[0];
                            }
                        }

                        const category = cleanCategoryName(currentInfo.group || 'Live Sports');
                        let type: 'mpd' | 'hls' | 'mpegts' = 'hls';

                        if (streamUrl.includes('.mpd') || currentInfo.licenseType === 'clearkey') {
                            type = 'mpd';
                        } else if (streamUrl.includes('.ts') || streamUrl.includes('.mpg')) {
                            type = 'mpegts';
                        }

                        let keyId = '';
                        let key = '';
                        if (currentInfo.licenseKey) {
                            if (currentInfo.licenseKey.includes(':')) {
                                const parts = currentInfo.licenseKey.split(':');
                                keyId = parts[0].trim();
                                key = parts[1].trim();
                            } else {
                                key = currentInfo.licenseKey.trim();
                            }
                        }

                        // Local proxy for FanCode and Sony
                        const lowerStream = streamUrl.toLowerCase();
                        const isFanCode = lowerStream.includes('in-mc-flive.fancode.com') || lowerStream.includes('in-ak-flive') || lowerStream.includes('fancode.com') || lowerStream.includes('fancode');
                        const isSony = lowerStream.includes('sonydaimenew') || lowerStream.includes('sonymtmnew') || lowerStream.includes('sonyliv') || lowerStream.includes('slivcdn') || lowerStream.includes('dishmt') || lowerStream.includes('sony');
                        
                        let finalStream = streamUrl;
                        if (isFanCode && !streamUrl.startsWith('/live.php') && !streamUrl.startsWith('/stream_proxy.php')) {
                            finalStream = `/live.php?url=${encodeURIComponent(streamUrl)}`;
                        } else if (isSony && !streamUrl.startsWith('/live.php') && !streamUrl.startsWith('/stream_proxy.php')) {
                            finalStream = `/live.php?url=${encodeURIComponent(streamUrl)}`;
                        }

                        let playUrl = '';
                        if (type === 'mpd') {
                            playUrl = `/play_consumet.php?channel_id=${currentInfo.id || `livem3u-${index}`}&url=${encodeURIComponent(finalStream)}&key_id=${keyId}&key=${key}&type=mpd&name=${encodeURIComponent(currentInfo.name || '')}&source=livem3u`;
                        } else {
                            playUrl = `/play_consumet.php?channel_id=${currentInfo.id || `livem3u-${index}`}&url=${encodeURIComponent(finalStream)}&name=${encodeURIComponent(currentInfo.name || '')}&source=livem3u&type=${type}`;
                            if (currentInfo.userAgent) playUrl += `&ua=${encodeURIComponent(currentInfo.userAgent)}`;
                            if (currentInfo.referrer) playUrl += `&ref=${encodeURIComponent(currentInfo.referrer)}`;
                        }

                        if (!seenStreams.has(finalStream)) {
                            seenStreams.add(finalStream);
                            channels.push({
                                id: currentInfo.id || `livem3u-${index}`,
                                name: currentInfo.name || `Live Event ${index}`,
                                logo: currentInfo.logo || '',
                                group: currentInfo.group || 'Live Sports',
                                category: category,
                                stream_url: finalStream,
                                type: type,
                                user_agent: currentInfo.userAgent,
                                referrer: currentInfo.referrer,
                                license_type: currentInfo.licenseType,
                                license_key: currentInfo.licenseKey,
                                key_id: keyId,
                                key: key,
                                source: 'livem3u',
                                play_url: playUrl
                            });

                            categoryCountMap.set(category, (categoryCountMap.get(category) || 0) + 1);
                            index++;
                        }
                        currentInfo = null;
                    }
                }
            }

            const categories: LiveM3uCategory[] = Array.from(categoryCountMap.entries())
                .map(([name, count]) => ({
                    name,
                    count,
                    icon: getGroupIcon(name)
                }))
                .sort((a, b) => b.count - a.count);

            cache = {
                channels,
                categories,
                rawM3u: rawData,
                timestamp: Date.now()
            };

            console.log(`[LiveM3uService] Loaded ${channels.length} Live.m3u channels across ${categories.length} categories.`);
            return cache;
        } catch (err: any) {
            console.error('[LiveM3uService] Error loading Live.m3u:', err?.message || err);
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

export async function getLiveM3uChannels(forceRefresh = false) {
    const data = await getLiveM3uData(forceRefresh);
    return {
        success: true,
        count: data.channels.length,
        channels: data.channels,
        categories: data.categories,
        lastUpdated: data.timestamp,
        autoUpdateMinutes: 25
    };
}

export async function getLiveM3uChannelById(id: string): Promise<LiveM3uChannel | undefined> {
    const data = await getLiveM3uData();
    return data.channels.find(c => c.id === id);
}

export async function getLiveM3uRawM3u(forceRefresh = false): Promise<string> {
    const data = await getLiveM3uData(forceRefresh);
    return data.rawM3u;
}

/**
 * Start 25-minute background auto-update timer
 */
export function initLiveM3uAutoUpdate() {
    if (autoUpdateTimer) return;
    // Initial fetch
    getLiveM3uData().catch(() => {});
    // Auto-refresh every 25 minutes (1,500,000 ms)
    autoUpdateTimer = setInterval(() => {
        console.log('[LiveM3uService] Running 25-minute background auto-refresh cycle...');
        getLiveM3uData(true).catch(e => console.error('[LiveM3uService] Background refresh failed:', e?.message));
    }, 25 * 60 * 1000);
}
