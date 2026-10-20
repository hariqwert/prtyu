import { Router, Request, Response } from 'express';
import { scrapeMovie, scrapeTvEpisode, unwrapDirectStreamUrl } from '../services/bingrScraperService';

const router = Router();

/**
 * Clean & Format direct video stream URLs without forced proxying
 */
export function formatRawDirectStreamUrl(rawUrl: string, baseUrl: string): string {
    if (!rawUrl) return baseUrl;
    const unwrapped = unwrapDirectStreamUrl(rawUrl);
    const candidate = unwrapped.streamUrl || rawUrl;
    // Return direct http/https stream URL as-is so external players connect directly to CDN
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
        return candidate;
    }
    return `${baseUrl}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
}

/**
 * On-Demand Live Stream Resolver (Always fetches fresh up-to-date streams when called)
 */
export async function resolveLiveDirectMediaStream(
    id: string | number,
    type: 'movie' | 'tv' = 'movie',
    season = 1,
    episode = 1,
    srv = 's40'
): Promise<string | null> {
    try {
        let res: any;
        if (type === 'tv') {
            res = await scrapeTvEpisode(id, season, episode, { srv });
        } else {
            res = await scrapeMovie(id, { srv });
        }

        let directUrl: string | null = null;

        if (res?.primaryM3u8) {
            directUrl = res.primaryM3u8;
        } else if (res?.sources && res.sources.length > 0) {
            const hlsSource = res.sources.find((s: any) => s.url && (s.url.includes('.m3u8') || s.type === 'application/x-mpegurl')) ||
                              res.sources.find((s: any) => s.url && !s.url.includes('/embed/'));
            if (hlsSource) {
                directUrl = hlsSource.url;
            }
        }

        return directUrl;
    } catch (e: any) {
        console.error(`[CinePro On-Demand Scraper] Error resolving ${type} ${id}:`, e?.message);
    }

    return null;
}

/**
 * GET /api/cinepro/play
 * Dynamic On-Demand 302 Redirect to fresh raw direct .m3u8 stream
 */
router.get('/play', async (req: Request, res: Response) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const id = (req.query.id || req.query.tmdbId || '550') as string;
    const type = (req.query.type || 'movie') as 'movie' | 'tv';
    const season = parseInt((req.query.s || req.query.season || '1') as string, 10);
    const episode = parseInt((req.query.e || req.query.episode || '1') as string, 10);
    const srv = (req.query.srv || 's40') as string;

    const directUrl = await resolveLiveDirectMediaStream(id, type, season, episode, srv);

    if (directUrl) {
        const rawUrl = formatRawDirectStreamUrl(directUrl, baseUrl);
        return res.redirect(302, rawUrl);
    }

    return res.status(404).send('#EXTM3U\n#EXT-X-ERROR: Stream currently unavailable');
});

/**
 * GET /cinepro.m3u & /api/cinepro/m3u
 * Pure M3U Playlist Generator for CinePro Movies & TV Shows
 * Generates dynamic stream links that fetch the latest live .m3u8 stream on every API play request
 */
router.get(['/m3u', '/playlist.m3u'], async (req: Request, res: Response) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const POPULAR_MOVIES = [
        { id: '550', title: 'Fight Club (1999)', logo: 'https://image.tmdb.org/t/p/w500/pB8BM7PDSp6B6Ih7QZ4DrQ3PmJK.jpg' },
        { id: '27205', title: 'Inception (2010)', logo: 'https://image.tmdb.org/t/p/w500/oYuLE1311oA8h3C18M2A2SCo211.jpg' },
        { id: '157336', title: 'Interstellar (2014)', logo: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
        { id: '155', title: 'The Dark Knight (2008)', logo: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
        { id: '299536', title: 'Avengers: Infinity War (2018)', logo: 'https://image.tmdb.org/t/p/w500/7WsyChLLEz336A9339999.jpg' },
        { id: '680', title: 'Pulp Fiction (1994)', logo: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JP23Te5.jpg' },
        { id: '238', title: 'The Godfather (1972)', logo: 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsL22o121W382.jpg' },
        { id: '13', title: 'Forrest Gump (1994)', logo: 'https://image.tmdb.org/t/p/w500/arw2323498.jpg' }
    ];

    const POPULAR_SERIES = [
        { id: '1396', title: 'Breaking Bad', season: 1, episode: 1, logo: 'https://image.tmdb.org/t/p/w500/zt239842.jpg' },
        { id: '1399', title: 'Game of Thrones', season: 1, episode: 1, logo: 'https://image.tmdb.org/t/p/w500/u3b1W23849.jpg' },
        { id: '66732', title: 'Stranger Things', season: 1, episode: 1, logo: 'https://image.tmdb.org/t/p/w500/x2LSRK239842.jpg' },
        { id: '71446', title: 'Money Heist', season: 1, episode: 1, logo: 'https://image.tmdb.org/t/p/w500/re239842.jpg' }
    ];

    const lines: string[] = ['#EXTM3U x-tvg-url=""'];

    // Movies Section
    for (const item of POPULAR_MOVIES) {
        const streamUrl = `${baseUrl}/api/cinepro/play?id=${item.id}&type=movie`;
        lines.push(`#EXTINF:-1 tvg-id="cinepro_${item.id}" tvg-name="${item.title}" tvg-logo="${item.logo}" group-title="CinePro Movies",${item.title}`);
        lines.push(streamUrl);
    }

    // TV Series Section
    for (const item of POPULAR_SERIES) {
        const streamUrl = `${baseUrl}/api/cinepro/play?id=${item.id}&type=tv&s=${item.season}&e=${item.episode}`;
        lines.push(`#EXTINF:-1 tvg-id="cinepro_tv_${item.id}" tvg-name="${item.title} S${item.season}E${item.episode}" tvg-logo="${item.logo}" group-title="CinePro Series",${item.title} S${item.season}E${item.episode}`);
        lines.push(streamUrl);
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', 'inline; filename="cinepro.m3u"');
    res.send(lines.join('\n'));
});

export default router;
