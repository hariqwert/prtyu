import { Router, Request, Response } from 'express';
import {
    searchAsiaflix,
    getAsiaflixDrama,
    resolveAsiaflixEpisodeStream,
    generateAsiaflixM3u
} from '../services/asiaflixService';

const router = Router();

/**
 * Search Dramas on Asiaflix
 * Example: GET /api/asiaflix/search?q=Queen of Tears
 */
router.get('/search', async (req: Request, res: Response) => {
    const q = (req.query.q as string || req.query.query as string || '').trim();
    if (!q) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    try {
        const results = await searchAsiaflix(q);
        return res.json({
            success: true,
            query: q,
            count: results.length,
            results
        });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Get Drama Details & Episodes Catalog
 * Example: GET /api/asiaflix/drama/queen-of-tears
 */
router.get('/drama/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    try {
        const drama = await getAsiaflixDrama(slug);
        if (!drama) {
            return res.status(404).json({ success: false, error: 'Drama not found on Asiaflix' });
        }
        return res.json({ success: true, drama });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Resolve Direct Stream for a Drama Episode
 * Example: GET /api/asiaflix/episode/:slug/:ep/stream
 */
router.get('/episode/:slug/:ep/stream', async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    const ep = parseInt(String(req.params.ep || '1'), 10) || 1;
    try {
        const streamData = await resolveAsiaflixEpisodeStream(slug, ep);
        if (!streamData || !streamData.video) {
            return res.status(404).json({ success: false, error: 'Stream could not be resolved from Asiaflix' });
        }
        const proxiedStream = `/api/proxy/hls?url=${encodeURIComponent(streamData.video)}`;
        return res.json({
            success: true,
            streamUrl: proxiedStream,
            rawVideo: streamData.video,
            source: streamData.source,
            dramaName: streamData.dramaName,
            episodeNum: streamData.episodeNum
        });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Generate M3U Playlist for an Asiaflix Drama
 * Example: GET /api/asiaflix/playlist.m3u?slug=queen-of-tears
 */
router.get(['/playlist.m3u', '/playlist'], async (req: Request, res: Response) => {
    const slug = (req.query.slug as string || req.query.id as string || req.query.q as string || '').trim();
    if (!slug) {
        return res.status(400).send('#EXTM3U\n#ERROR: Missing ?slug= parameter\n');
    }

    try {
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;

        const m3uContent = await generateAsiaflixM3u(slug, baseUrl);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="asiaflix_${slug}.m3u"`);
        res.setHeader('Cache-Control', 'public, max-age=1800');
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).send(`#EXTM3U\n#ERROR: ${e.message}\n`);
    }
});

/**
 * Dynamic Episode Player & Redirect Resolver
 * Example: GET /api/asiaflix/play?slug=queen-of-tears&ep=1
 */
router.get(['/play', '/play.m3u8'], async (req: Request, res: Response) => {
    const slug = (req.query.slug as string || req.query.id as string || '').trim();
    const epNum = parseInt((req.query.ep || req.query.episode || '1').toString(), 10) || 1;

    if (!slug) {
        return res.status(400).send('Missing slug parameter');
    }

    try {
        const streamData = await resolveAsiaflixEpisodeStream(slug, epNum);
        if (!streamData || !streamData.video) {
            return res.status(404).send('Episode stream could not be resolved from Asiaflix');
        }

        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;
        const proxiedUrl = `${baseUrl}/api/proxy/hls.m3u8?url=${encodeURIComponent(streamData.video)}`;
        return res.redirect(302, proxiedUrl);
    } catch (e: any) {
        return res.status(500).send(`Stream resolution error: ${e.message}`);
    }
});

export default router;
