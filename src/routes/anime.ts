import { Router, Request, Response } from 'express';
import {
    searchAnimeSalt,
    resolveKitsuEnglishTitle,
    searchMalWithKitsu,
    matchAnimeSeries,
    discoverAnimeEpisodes,
    resolveAnimeEpisodeStream,
    scrapeAnimeEpisode,
    handleAnimeHlsProxy,
    handleAnimeSubtitleProxy,
    buildAnimeM3u,
    fetchAniSkipTimes,
    resolveMalIdFromTitle,
    fetchAniListEpisodes
} from '../services/animeScraperService';

const router = Router();

// --- 1. Search Anime via AnimeSalt ---
router.get('/search', async (req: Request, res: Response) => {
    const q = (req.query.q || req.query.query || '').toString().trim();
    if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }
    try {
        const results = await searchAnimeSalt(q);
        return res.json({ query: q, results });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
});

// --- 2. Search MyAnimeList with Kitsu English Title Sync ---
router.get('/mal/search', async (req: Request, res: Response) => {
    const q = (req.query.q || req.query.query || '').toString().trim();
    if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }
    try {
        const data = await searchMalWithKitsu(q);
        return res.json(data);
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
});

// --- 3. Match Anime Title to Series URL ---
router.get('/match', async (req: Request, res: Response) => {
    const title = (req.query.title || req.query.q || '').toString().trim();
    if (!title) {
        return res.status(400).json({ error: 'Title parameter is required' });
    }
    try {
        const match = await matchAnimeSeries(title);
        return res.json(match);
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
});

// --- 4. Discover Episodes for a Series URL ---
router.get('/discover', async (req: Request, res: Response) => {
    const url = (req.query.url || '').toString().trim();
    const season = parseInt((req.query.season || '1').toString(), 10) || 1;
    if (!url) {
        return res.status(400).json({ error: 'Series URL parameter is required' });
    }
    try {
        const discovery = await discoverAnimeEpisodes(url, season);
        return res.json(discovery);
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
});

// --- 5. Stream Resolver: by URL or Title+Season+Episode ---
router.get('/stream', async (req: Request, res: Response) => {
    const url = (req.query.url || '').toString().trim();
    const title = (req.query.title || '').toString().trim();
    const season = parseInt((req.query.season || req.query.s || '1').toString(), 10) || 1;
    const episode = parseInt((req.query.episode || req.query.ep || req.query.e || '1').toString(), 10) || 1;

    try {
        if (url) {
            const streamData = await resolveAnimeEpisodeStream(url);
            return res.json({
                success: true,
                url,
                primaryM3u8: streamData.proxiedM3u8,
                directM3u8: streamData.masterM3u8,
                poster: streamData.poster,
                audioTracks: streamData.audioTracks,
                qualities: streamData.qualities,
                subtitles: streamData.subtitles.map(s => ({
                    lang: s.language || 'English',
                    label: s.label || 'English',
                    url: `/api/anime/subtitle?url=${encodeURIComponent(s.file)}`
                })),
                sources: [
                    {
                        url: streamData.proxiedM3u8,
                        quality: '1080p',
                        type: 'application/x-mpegurl',
                        label: 'AnimeSalt Multi-Audio HLS (Proxied)'
                    },
                    {
                        url: streamData.masterM3u8,
                        quality: '1080p',
                        type: 'application/x-mpegurl',
                        label: 'AnimeSalt Direct Master HLS'
                    }
                ]
            });
        }

        if (title) {
            const result = await scrapeAnimeEpisode(title, season, episode);
            return res.json(result);
        }

        return res.status(400).json({ error: 'Either url or title is required' });
    } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
    }
});

// --- 6. Scrape Endpoint (POST) ---
router.post('/scrape', async (req: Request, res: Response) => {
    const { url, title, season = 1, episode = 1 } = req.body || {};
    try {
        if (url) {
            const streamData = await resolveAnimeEpisodeStream(url);
            return res.json({ success: true, ...streamData });
        }
        if (title) {
            const result = await scrapeAnimeEpisode(title, Number(season) || 1, Number(episode) || 1);
            return res.json(result);
        }
        return res.status(400).json({ error: 'Must provide url or title in JSON body' });
    } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
    }
});

// --- 7. Direct Playback Redirect (302) ---
router.get('/play', async (req: Request, res: Response) => {
    const title = (req.query.title || '').toString().trim();
    const season = parseInt((req.query.season || req.query.s || '1').toString(), 10) || 1;
    const episode = parseInt((req.query.episode || req.query.e || '1').toString(), 10) || 1;
    const url = (req.query.url || '').toString().trim();

    try {
        if (url) {
            const streamData = await resolveAnimeEpisodeStream(url);
            return res.redirect(302, streamData.proxiedM3u8);
        }
        if (title) {
            const result = await scrapeAnimeEpisode(title, season, episode);
            return res.redirect(302, result.primaryM3u8);
        }
        return res.status(400).send('Missing title or url parameter');
    } catch (err: any) {
        return res.status(500).send(`Failed to resolve stream: ${err?.message}`);
    }
});

// --- 8. Transparent CORS HLS Proxy ---
router.get('/proxy', async (req: Request, res: Response) => {
    const targetUrl = (req.query.url || '').toString();
    await handleAnimeHlsProxy(req, res, targetUrl);
});

// --- 9. Subtitle Fetch & WebVTT Converter ---
router.get('/subtitle', async (req: Request, res: Response) => {
    const subUrl = (req.query.url || '').toString();
    await handleAnimeSubtitleProxy(req, res, subUrl);
});

// --- 10. M3U Playlist Generator ---
router.get(['/m3u', '/playlist'], async (req: Request, res: Response) => {
    const url = (req.query.url || '').toString().trim();
    const title = (req.query.title || '').toString().trim();
    const season = parseInt((req.query.season || '1').toString(), 10) || 1;

    try {
        let seriesUrl = url;
        if (!seriesUrl && title) {
            const match = await matchAnimeSeries(title);
            if (match.matchedUrl) seriesUrl = match.matchedUrl;
        }

        if (!seriesUrl) {
            return res.status(400).send('Could not find series for requested title/url');
        }

        const discovery = await discoverAnimeEpisodes(seriesUrl, season);
        const episodesWithStreams = [];

        // Build items with stream links using /api/anime/play
        for (const ep of discovery.episodes) {
            episodesWithStreams.push({
                ...ep,
                proxiedStreamUrl: `/api/anime/play?url=${encodeURIComponent(ep.url)}`
            });
        }

        const m3uContent = buildAnimeM3u(episodesWithStreams, discovery.animeTitle);
        res.setHeader('Content-Type', 'application/x-mpegURL');
        res.setHeader('Content-Disposition', `inline; filename="${discovery.animeSlug}-season-${season}.m3u"`);
        return res.send(m3uContent);
    } catch (err: any) {
        return res.status(500).send(`Failed to generate M3U: ${err?.message}`);
    }
});

// --- 11. AniSkip Anime Skip Times Endpoint ---
// GET /api/anime/skip-times?malId=52299&episode=1&episodeLength=1420
router.get(['/skip-times', '/aniskip'], async (req: Request, res: Response) => {
    let malId: string | number | undefined = req.query.malId ? String(req.query.malId) : (req.query.mal_id ? String(req.query.mal_id) : (req.query.mal ? String(req.query.mal) : (req.query.id ? String(req.query.id) : undefined)));
    const title = (req.query.title || req.query.name || '').toString().trim();
    const episode = parseInt((req.query.episode || req.query.ep || req.query.e || '1').toString(), 10) || 1;
    const episodeLength = parseFloat((req.query.episodeLength || req.query.length || req.query.duration || '0').toString()) || 0;
    const typesParam = req.query.types ? (req.query.types as string).split(',').map(s => s.trim()) : undefined;

    try {
        // If malId was not directly supplied, attempt to resolve it by title
        if (!malId && title) {
            const resolved = await resolveMalIdFromTitle(title);
            if (resolved) {
                malId = resolved;
            }
        }

        if (!malId) {
            return res.status(400).json({
                found: false,
                error: 'Missing MAL ID. Provide malId parameter or anime title.'
            });
        }

        const skipData = await fetchAniSkipTimes(malId.toString(), episode, episodeLength, typesParam);
        return res.json(skipData);
    } catch (err: any) {
        return res.status(500).json({
            found: false,
            error: err?.message || 'Failed to fetch AniSkip skip times'
        });
    }
});

// --- 12. Resolve MAL ID from Anime Title ---
// GET /api/anime/mal/resolve?title=Solo+Leveling
router.get('/mal/resolve', async (req: Request, res: Response) => {
    const title = (req.query.title || req.query.q || '').toString().trim();
    if (!title) {
        return res.status(400).json({ error: 'Title parameter is required' });
    }
    try {
        const malId = await resolveMalIdFromTitle(title);
        return res.json({
            title,
            malId,
            found: !!malId
        });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
});

// --- 13. AniList Episode-Wise Fetching & Rich Metadata ---
// GET /api/anime/anilist/episodes?id=151807&title=Solo+Leveling
router.get(['/anilist/episodes', '/episodes'], async (req: Request, res: Response) => {
    const id = req.query.id || req.query.anilistId || req.query.aniId;
    const malId = req.query.malId || req.query.mal_id;
    const title = (req.query.title || req.query.name || req.query.q || '').toString().trim();

    try {
        const data = await fetchAniListEpisodes({
            id: id ? String(id) : undefined,
            malId: malId ? String(malId) : undefined,
            title: title || undefined
        });

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Anime not found on AniList for provided query'
            });
        }

        return res.json({
            success: true,
            anilistId: data.id,
            malId: data.idMal,
            title: data.displayTitle,
            coverImage: data.coverImage,
            bannerImage: data.bannerImage,
            description: data.description,
            genres: data.genres,
            averageScore: data.averageScore,
            status: data.status,
            seasonYear: data.seasonYear,
            totalEpisodes: data.episodesCount,
            episodes: data.episodes
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch AniList episodes'
        });
    }
});

// --- 14. AniList Anime Information s---
router.get('/anilist/info', async (req: Request, res: Response) => {
    const id = req.query.id || req.query.anilistId;
    const malId = req.query.malId || req.query.mal_id;
    const title = (req.query.title || req.query.q || '').toString().trim();

    try {
        const data = await fetchAniListEpisodes({
            id: id ? String(id) : undefined,
            malId: malId ? String(malId) : undefined,
            title: title || undefined
        });

        if (!data) {
            return res.status(404).json({ success: false, error: 'Anime info not found on AniList' });
        }

        return res.json({ success: true, data });
    } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
    }
});

export default router;
