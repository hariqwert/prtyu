import axios from 'axios';
import https from 'https';
import { scrapeMovie, scrapeTvEpisode } from './bingrScraperService';

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 8000
});

export interface CineProSource {
    name: string;
    provider: string;
    url: string;
    quality?: string;
    type: 'hls' | 'mp4' | 'embed';
    headers?: Record<string, string>;
    subtitles?: Array<{ label: string; file: string; kind?: string }>;
}

export interface CineProStreamResult {
    status: 'success' | 'error';
    tmdbId: string | number;
    title?: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    streamUrl?: string;
    sources: CineProSource[];
    embedUrl?: string;
    m3uPlayUrl?: string;
    message?: string;
}

// OMSS-compliant CinePro Core providers list
export const CINEPRO_PROVIDERS = [
    { id: 'cinepro_core', name: 'CinePro Core 4K', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://vidsrc.vip/embed/tv/${id}/${s}/${e}` : `https://vidsrc.vip/embed/movie/${id}` },
    { id: 'videasy', name: 'VidEasy Ultra', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://player.videasy.net/tv/${id}/${s}/${e}` : `https://player.videasy.net/movie/${id}` },
    { id: 'vixsrc', name: 'VixSrc 1080P', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://vixsrc.to/embed/tv/${id}/${s}/${e}` : `https://vixsrc.to/embed/movie/${id}` },
    { id: 'vidzee', name: 'VidZee Fast', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://vidzee.org/embed/tv/${id}/${s}/${e}` : `https://vidzee.org/embed/movie/${id}` },
    { id: 'autoembed', name: 'AutoEmbed 4K', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://autoembed.cc/embed/tv/${id}/${s}/${e}` : `https://autoembed.cc/embed/movie/${id}` },
    { id: 'vidsrc_pro', name: 'VidSrc Pro', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://vidsrc.pro/embed/tv/${id}/${s}/${e}` : `https://vidsrc.pro/embed/movie/${id}` },
    { id: 'vidlink', name: 'VidLink Pro', embedPattern: (type: string, id: string | number, s = 1, e = 1) => type === 'tv' ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` : `https://vidlink.pro/movie/${id}?autoplay=true` }
];

/**
 * Resolve OMSS direct streams & embeds for CinePro Core
 */
export async function getCineProStreams(
    tmdbId: string | number,
    type: 'movie' | 'tv' = 'movie',
    season = 1,
    episode = 1,
    providerId = 'cinepro_core'
): Promise<CineProStreamResult> {
    const prov = CINEPRO_PROVIDERS.find(p => p.id === providerId) || CINEPRO_PROVIDERS[0];
    const embedUrl = prov.embedPattern(type, tmdbId, season, episode);

    const sources: CineProSource[] = [];

    // 1. Resolve Direct HLS .m3u8 Streams
    let directHlsUrl: string | undefined = undefined;
    try {
        const directRes: any = type === 'tv'
            ? await scrapeTvEpisode(tmdbId, season, episode, { srv: 's40' })
            : await scrapeMovie(tmdbId, { srv: 's40' });

        if (directRes?.sources && directRes.sources.length > 0) {
            directRes.sources.forEach((s: any) => {
                if (s.url && (s.url.includes('.m3u8') || s.type === 'application/x-mpegurl')) {
                    if (!directHlsUrl) directHlsUrl = s.url;
                    sources.push({
                        name: `CinePro Direct ${s.label || s.name || 'HLS 1080p'}`,
                        provider: 'cinepro_direct_hls',
                        url: s.url,
                        quality: s.quality || '1080p',
                        type: 'hls'
                    });
                }
            });
        }
    } catch (e: any) {
        console.error('[CinePro Direct Scraper] Failed to resolve direct HLS:', e?.message);
    }

    // 2. Include OMSS Provider Embed Fallbacks
    CINEPRO_PROVIDERS.forEach(p => {
        sources.push({
            name: `${p.name} Embed`,
            provider: p.id,
            url: p.embedPattern(type, tmdbId, season, episode),
            quality: '1080p',
            type: 'embed'
        });
    });

    const m3uPlayUrl = `/api/cinepro/play?id=${tmdbId}&type=${type}&s=${season}&e=${episode}`;

    return {
        status: 'success',
        tmdbId,
        mediaType: type,
        season: type === 'tv' ? season : undefined,
        episode: type === 'tv' ? episode : undefined,
        streamUrl: directHlsUrl,
        m3uPlayUrl,
        sources,
        embedUrl
    };
}
