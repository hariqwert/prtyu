import axios from 'axios';
import { fetchAniListEpisodes, resolveMalIdFromTitle } from './animeScraperService';

export const FRAMEX_API_BASE = 'https://api.framextv.tech';
export const FRAMEX_FRONTEND_ORIGIN = 'https://framextv.xyz';

const FRAMEX_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Origin': FRAMEX_FRONTEND_ORIGIN,
    'Referer': `${FRAMEX_FRONTEND_ORIGIN}/`
};

export interface FrameXSource {
    url: string;
    rawUrl: string;
    proxyUrl?: string;
    quality: string;
    type: string;
    server: string;
    label: string;
    name: string;
    headers?: Record<string, string>;
    audio?: string;
    audioTracks?: Array<{ id: string; language: string; label: string; default?: boolean }>;
    skipProxy?: boolean;
}

export interface FrameXSubtitle {
    lang: string;
    label: string;
    url: string;
}

export interface FrameXStreamResult {
    success: boolean;
    provider?: string;
    server?: string;
    audio?: string;
    primaryM3u8?: string;
    sources: FrameXSource[];
    subtitles: FrameXSubtitle[];
    audioTracks?: Array<{ id: string; language: string; label: string; default?: boolean }>;
    title?: string;
    meta?: any;
    error?: string;
}

/**
 * Fetch anime metadata from FrameX TV backend (AniList ID)
 */
export async function getFrameXAnimeMeta(anilistId: number | string): Promise<any | null> {
    try {
        const res = await axios.get(`${FRAMEX_API_BASE}/anime/api/meta?id=${anilistId}`, {
            headers: FRAMEX_HEADERS,
            timeout: 6000
        });
        if (res.status === 200 && res.data?.meta) {
            return res.data.meta;
        }
    } catch (e: any) {
        // Fallback or silent error
    }
    return null;
}

/**
 * Fetch available anime providers from FrameX backend
 */
export async function getFrameXAnimeProviders(): Promise<Array<{ id: string; name: string; audio: string; tagline: string }>> {
    try {
        const res = await axios.get(`${FRAMEX_API_BASE}/anime/api/providers`, {
            headers: FRAMEX_HEADERS,
            timeout: 5000
        });
        if (res.status === 200 && Array.isArray(res.data?.providers)) {
            return res.data.providers;
        }
    } catch (_) {}
    return [];
}

/**
 * Normalize any relative FrameX stream/proxy URL into an absolute playable endpoint
 */
export function normalizeFrameXStreamUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('/')) {
        return `${FRAMEX_API_BASE}${trimmed}`;
    }
    return trimmed;
}

function detectFrameXSourceType(s: any, directUrl: string): string {
    const rawType = (s.type || '').toLowerCase();
    const urlLower = directUrl.toLowerCase();
    if (rawType === 'mp4' || urlLower.includes('.mp4')) {
        return 'video/mp4';
    }
    if (rawType === 'dash' || urlLower.includes('.mpd')) {
        return 'application/dash+xml';
    }
    return 'application/x-mpegurl';
}

/**
 * Fast concurrent health probe for FrameX sources.
 * Validates initialization segments (#EXT-X-MAP) and child variants.
 * If 1080p is broken on upstream CDN (e.g. 502/404), tests 720p fallback and rewrites the source URL
 * so players do not experience black screens, and promotes completely healthy 1080p sources to primary.
 */
export async function probeAndRankFrameXSources(sources: FrameXSource[]): Promise<FrameXSource[]> {
    if (!sources || sources.length === 0) return [];
    if (sources.length === 1 && !sources[0].url.includes('cheaptruckrepairs.cc')) {
        sources[0].skipProxy = sources[0].skipProxy ?? true;
        return sources;
    }

    const probed = await Promise.all(sources.map(async (src) => {
        const rawUrl = src.url;
        const decoded = decodeURIComponent(rawUrl).toLowerCase();
        const isHls = decoded.includes('.m3u8') || decoded.includes('/m3u8') || (src.type && (src.type.includes('mpegurl') || src.type.includes('hls')));

        if (!isHls) {
            return {
                source: { ...src, skipProxy: src.skipProxy ?? true },
                rank: 80,
                healthy: true
            };
        }

        try {
            const mRes = await axios.get(rawUrl, {
                headers: { 'Referer': FRAMEX_FRONTEND_ORIGIN, 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000
            });

            if (mRes.status !== 200 || !mRes.data || typeof mRes.data !== 'string') {
                return { source: { ...src, skipProxy: src.skipProxy ?? true }, rank: -1, healthy: false };
            }

            const lines = mRes.data.split('\n').map(l => l.trim());
            const variantLines = lines.filter(l => l && !l.startsWith('#'));

            if (variantLines.length === 0) {
                // Direct media manifest
                const mapMatch = mRes.data.match(/#EXT-X-MAP:URI="([^"]+)"/);
                if (mapMatch) {
                    const mapUrl = new URL(mapMatch[1], rawUrl).href;
                    const mapRes = await axios.get(mapUrl, {
                        headers: { 'Referer': FRAMEX_FRONTEND_ORIGIN },
                        validateStatus: () => true,
                        timeout: 2500
                    });
                    if (mapRes.status >= 400) {
                        return { source: { ...src, skipProxy: src.skipProxy ?? true }, rank: -1, healthy: false };
                    }
                }
                return { source: { ...src, skipProxy: src.skipProxy ?? true }, rank: 90, healthy: true };
            }

            // Master manifest: probe variants
            let firstWorkingVariantUrl: string | null = null;
            let firstWorkingQuality: string | null = null;
            let primaryVariantHealthy = false;

            for (let i = 0; i < variantLines.length; i++) {
                const vLine = variantLines[i];
                const vUrl = new URL(vLine, rawUrl).href;
                try {
                    const vRes = await axios.get(vUrl, {
                        headers: { 'Referer': FRAMEX_FRONTEND_ORIGIN },
                        timeout: 2500
                    });
                    if (vRes.status === 200 && vRes.data && typeof vRes.data === 'string') {
                        const mapMatch = vRes.data.match(/#EXT-X-MAP:URI="([^"]+)"/);
                        let segHealthy = true;
                        if (mapMatch) {
                            const mapUrl = new URL(mapMatch[1], vUrl).href;
                            const mapRes = await axios.get(mapUrl, {
                                headers: { 'Referer': FRAMEX_FRONTEND_ORIGIN },
                                validateStatus: () => true,
                                timeout: 2500
                            });
                            if (mapRes.status >= 400) {
                                segHealthy = false;
                            }
                        } else {
                            const firstSeg = vRes.data.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
                            if (firstSeg) {
                                const segUrl = new URL(firstSeg, vUrl).href;
                                const segRes = await axios.get(segUrl, {
                                    headers: { 'Referer': FRAMEX_FRONTEND_ORIGIN },
                                    validateStatus: () => true,
                                    timeout: 2500
                                });
                                if (segRes.status >= 400) {
                                    segHealthy = false;
                                }
                            }
                        }

                        if (segHealthy) {
                            if (i === 0) {
                                primaryVariantHealthy = true;
                            }
                            if (!firstWorkingVariantUrl) {
                                firstWorkingVariantUrl = vUrl;
                                firstWorkingQuality = vUrl.includes('720p') ? '720p' : (vUrl.includes('1080p') ? '1080p' : 'Auto');
                            }
                            if (primaryVariantHealthy) break;
                        }
                    }
                } catch (_) {}
            }

            if (primaryVariantHealthy) {
                return {
                    source: { ...src, skipProxy: src.skipProxy ?? true },
                    rank: 100,
                    healthy: true
                };
            } else if (firstWorkingVariantUrl) {
                return {
                    source: {
                        ...src,
                        url: firstWorkingVariantUrl,
                        quality: firstWorkingQuality || src.quality || '720p',
                        label: `${src.label} (${firstWorkingQuality || '720p'} Direct)`,
                        skipProxy: src.skipProxy ?? true
                    },
                    rank: 70,
                    healthy: true
                };
            } else {
                return { source: { ...src, skipProxy: src.skipProxy ?? true }, rank: -1, healthy: false };
            }
        } catch (_) {
            return { source: { ...src, skipProxy: src.skipProxy ?? true }, rank: 50, healthy: true };
        }
    }));

    const hasHealthy = probed.some(p => p.healthy && p.rank > 0);
    const filtered = hasHealthy ? probed.filter(p => p.healthy && p.rank > 0) : probed;

    filtered.sort((a, b) => b.rank - a.rank);
    return filtered.map(p => p.source);
}

async function scrapeFrameXAnimeInternal(params: {
    id?: number | string;
    season?: number;
    episode?: number;
    title?: string;
    anilistId?: number | string;
    malId?: number | string;
    subType?: 'sub' | 'dub';
    provider?: string;
}): Promise<FrameXStreamResult> {
    const season = params.season || 1;
    const episode = params.episode || 1;
    const requestedSubType = params.subType;

    let targetAniId = params.anilistId ? Number(params.anilistId) : undefined;
    let targetMalId = params.malId ? Number(params.malId) : undefined;

    // If targetAniId is not provided or looks like a title/mal search is needed
    if (!targetAniId && (params.title || targetMalId)) {
        try {
            const aniDetails = await fetchAniListEpisodes({ malId: targetMalId, title: params.title });
            if (aniDetails && aniDetails.id) {
                targetAniId = aniDetails.id;
                if (!targetMalId && aniDetails.idMal) {
                    targetMalId = aniDetails.idMal;
                }
            }
        } catch (_) {}
    }

    // Only fallback to params.id if neither title nor malId gave us an anilistId
    if (!targetAniId && params.id) {
        targetAniId = Number(params.id);
    }

    if (!targetAniId) {
        return {
            success: false,
            sources: [],
            subtitles: [],
            error: 'Could not resolve AniList ID for FrameX anime stream'
        };
    }

    // Helper to resolve stream for a given audio type ('sub' or 'dub')
    const resolveAudioStream = async (audioType: 'sub' | 'dub'): Promise<{
        sources: FrameXSource[];
        subtitles: FrameXSubtitle[];
        provider?: string;
        server?: string;
        meta?: any;
    } | null> => {
        const providersToTry = params.provider
            ? [params.provider]
            : (audioType === 'dub'
                ? ['grand_warden_dub', 'goblin_dub', 'wizard_dub', 'valkyrie_dub', 'archer_dub', 'healer_dub']
                : ['', 'grand_warden', 'goblin', 'wizard', 'valkyrie', 'super_pekka']);

        for (const prov of providersToTry) {
            try {
                let streamEndpoint = `${FRAMEX_API_BASE}/anime/api/stream?id=${targetAniId}&type=anime&episode=${episode}&sub_type=${audioType}&season=${season}`;
                if (prov) {
                    streamEndpoint += `&provider=${encodeURIComponent(prov)}`;
                }

                const res = await axios.get(streamEndpoint, {
                    headers: FRAMEX_HEADERS,
                    timeout: 7000
                });

                if (res.status === 200 && res.data?.success && Array.isArray(res.data?.sources) && res.data.sources.length > 0) {
                    const langLabel = audioType === 'dub' ? 'English Dub' : 'Japanese Sub';
                    const sources: FrameXSource[] = res.data.sources.map((s: any) => {
                        const directUrl = normalizeFrameXStreamUrl(s.url);
                        const srcType = detectFrameXSourceType(s, directUrl);
                        return {
                            url: directUrl,
                            rawUrl: directUrl,
                            quality: s.quality || '1080p',
                            type: srcType,
                            server: s.server || res.data.server || 'FrameX Anime',
                            label: `FrameX | ${s.server || 'Fast HLS'} (${langLabel})`,
                            name: `FrameX Anime | ${s.server || '1080p'} [${langLabel}]`,
                            language: langLabel,
                            headers: s.headers || {
                                'Referer': FRAMEX_FRONTEND_ORIGIN,
                                'Origin': FRAMEX_FRONTEND_ORIGIN
                            },
                            audio: audioType,
                            skipProxy: s.skipProxy ?? true
                        };
                    });

                    let subtitles: FrameXSubtitle[] = [];
                    try {
                        const subRes = await axios.get(`${FRAMEX_API_BASE}/anime/api/subtitles?id=${targetAniId}&type=anime&episode=${episode}`, {
                            headers: FRAMEX_HEADERS,
                            timeout: 4000
                        });
                        if (subRes.status === 200 && Array.isArray(subRes.data?.subtitles)) {
                            subtitles = subRes.data.subtitles.map((sub: any) => ({
                                lang: sub.lang || sub.language || 'en',
                                label: sub.label || sub.display || 'English',
                                url: normalizeFrameXStreamUrl(sub.url)
                            }));
                        }
                    } catch (_) {}

                    const rankedSources = await probeAndRankFrameXSources(sources);
                    const finalSources = rankedSources.length > 0 ? rankedSources : sources;

                    return {
                        sources: finalSources,
                        subtitles,
                        provider: res.data.provider || prov || 'default',
                        server: res.data.server || 'FrameX Anime',
                        meta: res.data.meta
                    };
                }
            } catch (_) {}
        }
        return null;
    };

    // If a specific subType was strictly requested, query only that
    if (requestedSubType === 'dub' || requestedSubType === 'sub') {
        const singleRes = await resolveAudioStream(requestedSubType);
        if (singleRes && singleRes.sources.length > 0) {
            return {
                success: true,
                provider: singleRes.provider,
                server: singleRes.server,
                audio: requestedSubType,
                primaryM3u8: singleRes.sources[0]?.url,
                sources: singleRes.sources,
                subtitles: singleRes.subtitles,
                meta: singleRes.meta
            };
        }
    }

    // Default multi-audio mode: concurrently resolve BOTH Japanese Sub and English Dub
    const [subOutcome, dubOutcome] = await Promise.allSettled([
        resolveAudioStream('sub'),
        resolveAudioStream('dub')
    ]);

    const subData = subOutcome.status === 'fulfilled' ? subOutcome.value : null;
    const dubData = dubOutcome.status === 'fulfilled' ? dubOutcome.value : null;

    if (!subData && !dubData) {
        return {
            success: false,
            sources: [],
            subtitles: [],
            error: `No working anime streams found from FrameX for AniList ID #${targetAniId}`
        };
    }

    // Build unified audioTracks descriptor for player UI
    const audioTracks: Array<{ id: string; language: string; label: string; default?: boolean }> = [];
    if (subData?.sources?.length) {
        audioTracks.push({ id: '0', language: 'Japanese', label: 'Japanese (Sub)', default: true });
    }
    if (dubData?.sources?.length) {
        audioTracks.push({ id: '1', language: 'English', label: 'English (Dub)', default: !subData?.sources?.length });
    }

    // Merge sources (Sub first by default, followed by Dub)
    const combinedSources: FrameXSource[] = [
        ...(subData?.sources || []),
        ...(dubData?.sources || [])
    ];

    combinedSources.forEach(s => {
        s.audioTracks = audioTracks;
    });

    // Merge & deduplicate subtitles
    const allSubs = [
        ...(subData?.subtitles || []),
        ...(dubData?.subtitles || [])
    ];
    const seenSubs = new Set<string>();
    const uniqueSubs = allSubs.filter(sub => {
        if (!sub.url || seenSubs.has(sub.url)) return false;
        seenSubs.add(sub.url);
        return true;
    });

    const primarySource = subData?.sources?.[0] || dubData?.sources?.[0];

    return {
        success: true,
        provider: subData?.provider || dubData?.provider || 'default',
        server: (subData && dubData) ? 'FrameX Anime (Multi-Audio Dual Feed)' : (subData?.server || dubData?.server || 'FrameX Anime'),
        audio: (subData && dubData) ? 'multi' : (subData ? 'sub' : 'dub'),
        primaryM3u8: primarySource?.url,
        sources: combinedSources,
        subtitles: uniqueSubs,
        meta: subData?.meta || dubData?.meta
    };
}

async function scrapeFrameXMovieTvInternal(params: {
    id?: number | string;
    type?: 'movie' | 'tv';
    season?: number;
    episode?: number;
    provider?: string;
}): Promise<FrameXStreamResult> {
    const tmdbId = params.id ? Number(params.id) : 0;
    const type = params.type === 'tv' ? 'tv' : 'movie';
    const season = params.season || 1;
    const episode = params.episode || 1;

    if (!tmdbId) {
        return {
            success: false,
            sources: [],
            subtitles: [],
            error: 'TMDB ID is required for FrameX movie/tv streams'
        };
    }

    // Try Titan (high-speed active provider) first, followed by unconstrained fallback
    const providersToTry = params.provider ? [params.provider] : ['titan', ''];

    for (const prov of providersToTry) {
        try {
            let streamEndpoint = `${FRAMEX_API_BASE}/api/stream?id=${tmdbId}&type=${type}`;
            if (type === 'tv') {
                streamEndpoint += `&season=${season}&episode=${episode}`;
            }
            if (prov) {
                streamEndpoint += `&provider=${encodeURIComponent(prov)}`;
            }

            const res = await axios.get(streamEndpoint, {
                headers: FRAMEX_HEADERS,
                timeout: prov === 'titan' ? 4000 : 3000
            });

            if (res.status === 200 && res.data?.success && Array.isArray(res.data?.sources) && res.data.sources.length > 0) {
                const sources: FrameXSource[] = res.data.sources.map((s: any) => {
                    const directUrl = normalizeFrameXStreamUrl(s.url);
                    const srcType = detectFrameXSourceType(s, directUrl);
                    return {
                        url: directUrl,
                        rawUrl: directUrl,
                        quality: s.quality || '4K / 1080p',
                        type: srcType,
                        server: s.server || res.data.provider || 'FrameX Stream Engine',
                        label: `FrameX | ${s.server || 'Direct Stream'}`,
                        name: `FrameX ${type === 'movie' ? 'Movie' : 'TV'} | ${s.quality || '1080p'}`,
                        headers: s.headers || {
                            'Referer': FRAMEX_FRONTEND_ORIGIN,
                            'Origin': FRAMEX_FRONTEND_ORIGIN
                        },
                        audioTracks: s.audioTracks,
                        skipProxy: s.skipProxy
                    };
                });

                // Extract subtitles if provided by FrameX
                const subtitles: FrameXSubtitle[] = (res.data.subtitles || []).map((sub: any) => ({
                    lang: sub.lang || sub.language || 'en',
                    label: sub.label || sub.display || 'English',
                    url: normalizeFrameXStreamUrl(sub.url)
                }));

                const rankedSources = await probeAndRankFrameXSources(sources);
                const finalSources = rankedSources.length > 0 ? rankedSources : sources;

                return {
                    success: true,
                    provider: res.data.provider || prov || 'titan',
                    primaryM3u8: finalSources[0]?.url,
                    sources: finalSources,
                    subtitles
                };
            }
        } catch (e: any) {
            // Continue to next provider in list
        }
    }

    return {
        success: false,
        sources: [],
        subtitles: [],
        error: 'No active streams found on FrameX'
    };
}

/**
 * Scrape live stream from FrameX TV (Movie, TV Series, or Anime) with bidirectional fallback
 */
export async function scrapeFrameXStream(params: {
    id?: number | string;
    type?: 'movie' | 'tv' | 'anime';
    season?: number;
    episode?: number;
    title?: string;
    anilistId?: number | string;
    malId?: number | string;
    subType?: 'sub' | 'dub';
    provider?: string;
}): Promise<FrameXStreamResult> {
    const isAnime = params.type === 'anime' || Boolean(params.anilistId);

    if (isAnime) {
        // 1. Try Anime resolver
        const animeRes = await scrapeFrameXAnimeInternal(params);
        if (animeRes.success && animeRes.sources.length > 0) {
            return animeRes;
        }

        // Cross-fallback: If anime endpoint fails and TMDB id exists, try Movie/TV endpoint
        if (params.id) {
            const fallbackRes = await scrapeFrameXMovieTvInternal({
                id: params.id,
                type: (params.type === 'movie' ? 'movie' : 'tv'),
                season: params.season,
                episode: params.episode
            });
            if (fallbackRes.success && fallbackRes.sources.length > 0) {
                return fallbackRes;
            }
        }

        return animeRes;
    } else {
        // 1. Try Movie/TV resolver
        const tvMovieRes = await scrapeFrameXMovieTvInternal({
            id: params.id,
            type: (params.type === 'tv' ? 'tv' : 'movie'),
            season: params.season,
            episode: params.episode
        });
        if (tvMovieRes.success && tvMovieRes.sources.length > 0) {
            return tvMovieRes;
        }

        // Cross-fallback: Only try Anime resolver if content is anime (malId/anilistId provided)
        if (params.malId || params.anilistId) {
            const animeFallback = await scrapeFrameXAnimeInternal({
                ...params,
                season: params.season,
                episode: params.episode
            });
            if (animeFallback.success && animeFallback.sources.length > 0) {
                return animeFallback;
            }
        }

        return tvMovieRes;
    }
}
