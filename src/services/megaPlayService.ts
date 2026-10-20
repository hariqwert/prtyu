import axios from 'axios';

let megaPlayToken: string | null = null;
let megaPlayTokenExp = 0;
let pendingTokenPromise: Promise<string> | null = null;

/**
 * Acquire / reuse active JWT session token from HiAnime/MegaPlay gateway
 */
export async function getMegaPlayToken(): Promise<string> {
    const now = Date.now();
    if (megaPlayToken && now < megaPlayTokenExp) {
        return megaPlayToken;
    }
    if (pendingTokenPromise) {
        return pendingTokenPromise;
    }
    pendingTokenPromise = (async () => {
        try {
            const res = await axios.post('https://hianime.filmu.in/token', {}, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://megaplay.buzz/',
                    'Origin': 'https://megaplay.buzz'
                },
                timeout: 5000
            });
            if (res.data?.token) {
                megaPlayToken = res.data.token;
                megaPlayTokenExp = Date.now() + (2.5 * 60 * 60 * 1000);
                return megaPlayToken || '';
            }
        } catch (e: any) {
            console.error('[MegaPlay] Failed to acquire token:', e.message);
        } finally {
            pendingTokenPromise = null;
        }
        return '';
    })();
    return pendingTokenPromise;
}

/**
 * Scrape official MegaPlay anime stream for given AniList or MAL ID
 */
export async function scrapeMegaPlayAnime(params: {
    anilistId?: number | string;
    malId?: number | string;
    episode?: number;
    type?: 'sub' | 'dub';
}): Promise<{
    success: boolean;
    primaryM3u8?: string;
    rawUrl?: string;
    sources: Array<{ url: string; quality: string; type: string; label: string; name: string; rawUrl?: string; proxyUrl?: string; referrer?: string }>;
    subtitles: Array<{ lang: string; url: string; label: string }>;
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
}> {
    const ep = params.episode || 1;
    const dubType = params.type || 'sub';
    const anilistId = params.anilistId;
    const malId = params.malId;

    const targetUrl = anilistId
        ? `https://hianime.filmu.in/anipm/megaplay?anilistId=${anilistId}&ep=${ep}&type=${dubType}`
        : malId
        ? `https://hianime.filmu.in/hianime/megaplay?malId=${malId}&ep=${ep}&type=${dubType}`
        : null;

    if (!targetUrl) return { success: false, sources: [], subtitles: [] };

    try {
        const token = await getMegaPlayToken();
        const res = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://megaplay.buzz/',
                'Origin': 'https://megaplay.buzz',
                ...(token ? { 'x-api-key': token } : {})
            },
            timeout: 8000
        });

        const streams = (res.data?.streams || []).filter((s: any) => s?.url && s.type === 'm3u8');
        if (streams.length === 0) {
            return { success: false, sources: [], subtitles: [] };
        }

        const sources = streams.map((s: any) => {
            const rawUrl = s.url;
            const ref = s.headers?.Referer || s.referer || 'https://megaplay.buzz/';
            const playUrl = `/api/proxy/hls?url=${encodeURIComponent(rawUrl)}&headers=${encodeURIComponent(JSON.stringify({ Referer: ref }))}`;
            return {
                url: rawUrl,
                rawUrl,
                proxyUrl: playUrl,
                referrer: ref,
                quality: '1080p',
                type: 'application/x-mpegurl',
                label: `MegaPlay (${dubType.toUpperCase()})`,
                name: `MegaPlay Anime | ${dubType.toUpperCase()}`
            };
        });

        const subtitles = (streams[0]?.subtitles || []).filter((sub: any) => sub?.url).map((sub: any) => ({
            lang: sub.lang || 'en',
            label: sub.label || 'English',
            url: sub.url
        }));

        return {
            success: true,
            primaryM3u8: streams[0]?.url,
            rawUrl: streams[0]?.url,
            sources,
            subtitles,
            intro: streams[0]?.intro,
            outro: streams[0]?.outro
        };
    } catch (e: any) {
        console.error('[MegaPlay] Scrape error:', e.message);
        return { success: false, sources: [], subtitles: [] };
    }
}
