import { Router, Request, Response } from 'express';
import { searchKissKh, generateKissKhM3uPlaylist } from '../services/kisskhService';
import { searchAsiaflix, generateAsiaflixM3u } from '../services/asiaflixService';
import { findTmdbMatch, getMovieDetails, getTvDetails, getTvEpisodes, scrapeMovie, scrapeTvEpisode, buildBingrM3u } from '../services/bingrScraperService';
import { matchAnimeSeries, discoverAnimeEpisodes, buildAnimeM3u } from '../services/animeScraperService';
import { formatRawDirectStreamUrl } from './cineproM3u';

export const m3uHubRouter = Router();

/**
 * Universal M3U Discovery Hub API
 * GET /api/m3u/hub
 */
m3uHubRouter.get('/hub', (req: Request, res: Response) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    res.json({
        name: 'Stalker Pro — Universal M3U Scraper Hub',
        status: 'active',
        version: '3.1',
        categories: {
            movies_and_tv: {
                name: 'Movies & TV Series (Bingr & Movies4u Direct .m3u8 Engines)',
                features: ['1080p Direct HLS', 'Movies4u Cluster', 'Acek CDN', 'Multi-Audio'],
                endpoints: {
                    movie_m3u: `${baseUrl}/api/m3u/movie?id={tmdbId}&title={title}`,
                    tv_m3u: `${baseUrl}/api/m3u/tv?id={tmdbId}&season={seasonNum}&title={title}`,
                    movies4u_m3u: `${baseUrl}/api/m3u/movies4u?id={tmdbId}&title={title}`,
                    bingr_direct_m3u: `${baseUrl}/api/m3u/bingr?id={tmdbId}&type=movie|tv&s={season}`
                }
            },
            live_sports: {
                name: 'Live Sports & Live TV',
                endpoints: {
                    sports_m3u: `${baseUrl}/sports.m3u`,
                    cinepro_m3u: `${baseUrl}/cinepro.m3u`
                }
            }
        }
    });
});

/**
 * Movies4u Direct M3U Scraper Endpoint
 * GET /api/m3u/movies4u?id=27205 OR GET /api/m3u/movies4u?title=Inception
 */
m3uHubRouter.get('/movies4u', async (req: Request, res: Response) => {
    let idRaw = (req.query.id || req.query.tmdbId || '').toString().trim();
    let title = (req.query.title || req.query.q || '').toString().trim();

    try {
        if (!idRaw && title) {
            const match = await findTmdbMatch(title, 'movie');
            if (match) {
                idRaw = String(match.id);
                title = match.title;
            }
        }

        if (!idRaw && !title) {
            return res.status(400).send('#EXTM3U\n#ERROR: Missing ?id= or ?title= parameter');
        }

        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;

        // Scrape Movies4u cluster specifically (srv='m4u')
        const scrapeRes = await scrapeMovie(idRaw, { srv: 'm4u', title });

        const items: any[] = [];
        if (scrapeRes?.sources && scrapeRes.sources.length > 0) {
            scrapeRes.sources.forEach((s: any) => {
                if (s.url && (s.url.includes('.m3u8') || s.type === 'application/x-mpegurl')) {
                    items.push({
                        name: `${title || 'Movie'} [Movies4u ${s.label || s.quality || '720p/1080p'}]`,
                        url: formatRawDirectStreamUrl(s.url, baseUrl),
                        quality: s.quality || '1080p',
                        tmdbId: scrapeRes.tmdbId || idRaw
                    });
                }
            });
        }

        // Fallback to primary stream
        if (items.length === 0 && scrapeRes?.primaryM3u8) {
            items.push({
                name: `${title || 'Movie'} [Movies4u Direct HLS]`,
                url: formatRawDirectStreamUrl(scrapeRes.primaryM3u8, baseUrl),
                quality: '1080p',
                tmdbId: scrapeRes.tmdbId || idRaw
            });
        }

        const isRaw = req.query.raw === '1' || req.query.raw === 'true';
        const m3uContent = buildBingrM3u({
            title: title || `Movies4u Movie ${idRaw}`,
            type: 'movie',
            tmdbId: Number(scrapeRes.tmdbId) || undefined,
            groupTitle: 'Movies4u Direct',
            baseUrl,
            raw: isRaw,
            items
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Disposition', `inline; filename="movies4u_${idRaw || 'movie'}.m3u"`);
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).send(`#EXTM3U\n#ERROR: Movies4u scraper error: ${e.message}`);
    }
});

/**
 * Universal Bingr / CinePro Direct M3U Scraper Endpoint
 * GET /api/m3u/movie?id=27205 OR GET /api/m3u/bingr?id=27205&type=movie
 */
m3uHubRouter.get(['/movie', '/bingr'], async (req: Request, res: Response) => {
    let idRaw = (req.query.id || req.query.tmdbId || '').toString().trim();
    let title = (req.query.title || req.query.q || '').toString().trim();
    let type = (req.query.type || 'movie') as 'movie' | 'tv';
    let season = req.query.season ? Number(req.query.season) : (req.query.s ? Number(req.query.s) : 1);
    let episode = req.query.episode ? Number(req.query.episode) : (req.query.e ? Number(req.query.e) : 1);
    let srv = (req.query.srv || 's40') as string;

    try {
        if (!idRaw && title) {
            const match = await findTmdbMatch(title, type);
            if (match) {
                idRaw = String(match.id);
                title = match.title;
            }
        }

        if (!idRaw && !title) {
            return res.status(400).send('#EXTM3U\n#ERROR: Missing ?id= or ?title= parameter');
        }

        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;

        // Directly resolve active live .m3u8 streams using Bingr / CinePro Scraper Cluster on demand
        const scrapeRes: any = type === 'tv'
            ? await scrapeTvEpisode(idRaw, season, episode, { title, srv })
            : await scrapeMovie(idRaw, { title, srv });

        const items: any[] = [];
        if (scrapeRes?.sources && scrapeRes.sources.length > 0) {
            scrapeRes.sources.forEach((s: any) => {
                if (s.url && (s.url.includes('.m3u8') || s.type === 'application/x-mpegurl')) {
                    items.push({
                        name: `${title || scrapeRes.title || 'Media'} [${s.label || s.name || s.quality || 'Direct HLS'}]`,
                        url: formatRawDirectStreamUrl(s.url, baseUrl),
                        quality: s.quality || '1080p',
                        season: type === 'tv' ? season : undefined,
                        episode: type === 'tv' ? episode : undefined,
                        tmdbId: scrapeRes.tmdbId || idRaw
                    });
                }
            });
        }

        if (items.length === 0 && scrapeRes?.primaryM3u8) {
            items.push({
                name: `${title || scrapeRes.title || 'Media'} [CinePro Direct HLS]`,
                url: formatRawDirectStreamUrl(scrapeRes.primaryM3u8, baseUrl),
                quality: '1080p',
                season: type === 'tv' ? season : undefined,
                episode: type === 'tv' ? episode : undefined,
                tmdbId: scrapeRes.tmdbId || idRaw
            });
        }

        if (items.length === 0) {
            // Include dynamic play link as live resolver
            items.push({
                name: `${title || scrapeRes.title || 'Media'} [CinePro On-Demand Live Stream]`,
                url: `${baseUrl}/api/cinepro/play?id=${scrapeRes.tmdbId || idRaw}&type=${type}&s=${season}&e=${episode}`,
                quality: '1080p',
                season: type === 'tv' ? season : undefined,
                episode: type === 'tv' ? episode : undefined,
                tmdbId: scrapeRes.tmdbId || idRaw
            });
        }

        const isRaw = req.query.raw === '1' || req.query.raw === 'true';
        const m3uContent = buildBingrM3u({
            title: title || scrapeRes.title || `Stream ${idRaw}`,
            type,
            tmdbId: Number(scrapeRes.tmdbId) || undefined,
            groupTitle: type === 'movie' ? 'CinePro Movies' : 'CinePro TV Series',
            baseUrl,
            raw: isRaw,
            items
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Disposition', `inline; filename="cinepro_${type}_${idRaw}.m3u"`);
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).send(`#EXTM3U\n#ERROR: Scraper error: ${e.message}`);
    }
});

/**
 * Universal TV Show Season M3U Scraper Endpoint
 * GET /api/m3u/tv?id=1396&season=1
 */
m3uHubRouter.get('/tv', async (req: Request, res: Response) => {
    let id = req.query.id ? Number(req.query.id) : 0;
    let title = (req.query.title || req.query.q || '').toString().trim();
    const season = req.query.season ? Number(req.query.season) : 1;

    try {
        if (!id && title) {
            const match = await findTmdbMatch(title, 'tv');
            if (match) {
                id = match.id;
                title = match.title;
            }
        }

        if (!id && !title) {
            return res.status(400).send('#EXTM3U\n#ERROR: Missing ?id= or ?title= parameter');
        }

        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;

        let episodesList: any[] = [];
        if (id) {
            try { episodesList = await getTvEpisodes(id, season); } catch {}
        }

        if (episodesList.length === 0) {
            episodesList = Array.from({ length: 10 }, (_, i) => ({
                episode: i + 1,
                title: `Episode ${i + 1}`
            }));
        }

        const items: any[] = [];
        // Parallel scrape first 5 episodes for fast direct .m3u8 generation
        await Promise.all(
            episodesList.slice(0, 5).map(async (ep) => {
                const epNum = ep.episode;
                const epTitle = ep.title || `Episode ${epNum}`;
                try {
                    const scrapeRes = await scrapeTvEpisode(id, season, epNum, { title });
                    if (scrapeRes?.primaryM3u8) {
                        items.push({
                            name: `${title || 'TV'} S${String(season).padStart(2, '0')}E${String(epNum).padStart(2, '0')} - ${epTitle}`,
                            url: formatRawDirectStreamUrl(scrapeRes.primaryM3u8, baseUrl),
                            quality: '1080p',
                            season,
                            episode: epNum,
                            tmdbId: id
                        });
                    }
                } catch (_) {}
            })
        );

        // Fallback to player redirect for rest if un-scraped
        for (const ep of episodesList) {
            const epNum = ep.episode;
            if (!items.some(i => i.episode === epNum)) {
                items.push({
                    name: `${title || 'TV'} S${String(season).padStart(2, '0')}E${String(epNum).padStart(2, '0')} - ${ep.title || `Episode ${epNum}`}`,
                    url: `${baseUrl}/api/cinepro/play?type=tv&id=${id}&season=${season}&episode=${epNum}`,
                    quality: '1080p',
                    season,
                    episode: epNum,
                    tmdbId: id
                });
            }
        }

        // Sort items by episode order
        items.sort((a, b) => (a.episode || 0) - (b.episode || 0));

        const isRaw = req.query.raw === '1' || req.query.raw === 'true';
        const m3uContent = buildBingrM3u({
            title: `${title || 'TV Show'} Season ${season}`,
            type: 'tv',
            tmdbId: id,
            groupTitle: 'CinePro TV Series',
            baseUrl,
            raw: isRaw,
            items
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Disposition', `inline; filename="tv_${id}_S${season}.m3u"`);
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).send(`#EXTM3U\n#ERROR: ${e.message}`);
    }
});

export default m3uHubRouter;
