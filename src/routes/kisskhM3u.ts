import { Router, Request, Response } from 'express';
import {
    searchKissKh,
    getKissKhDrama,
    resolveKissKhEpisode,
    generateKissKhM3uPlaylist
} from '../services/kisskhService';

const router = Router();

/**
 * Search Dramas
 * Example: GET /api/kisskh/search?q=vincenzo
 */
router.get('/search', async (req: Request, res: Response) => {
    const q = (req.query.q as string || '').trim();
    if (!q) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }
    try {
        const results = await searchKissKh(q);
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
 * Get Drama Metadata & Episodes
 * Example: GET /api/kisskh/drama/12345
 */
router.get('/drama/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    try {
        const drama = await getKissKhDrama(id);
        if (!drama) {
            return res.status(404).json({ success: false, error: 'Drama not found' });
        }
        return res.json({ success: true, drama });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Resolve direct HLS stream for an episode
 * Example: GET /api/kisskh/episode/67890/stream
 */
router.get('/episode/:id/stream', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    try {
        const streamData = await resolveKissKhEpisode(id);
        if (!streamData || !streamData.video) {
            return res.status(404).json({ success: false, error: 'Stream not found for episode' });
        }
        const proxiedStream = `/api/proxy/hls?url=${encodeURIComponent(streamData.video)}`;
        return res.json({
            success: true,
            streamUrl: proxiedStream,
            rawVideo: streamData.video,
            subtitles: streamData.subtitles || []
        });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Dynamic M3U Playlist Generator for an entire Drama series
 * Example: GET /api/kisskh/playlist.m3u?id=12345
 */
router.get(['/playlist.m3u', '/playlist'], async (req: Request, res: Response) => {
    const id = (req.query.id as string || '').trim();
    if (!id) {
        return res.status(400).send('#EXTM3U\n#ERROR: Missing ?id= parameter');
    }

    try {
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${proto}://${host}`;

        const m3uContent = await generateKissKhM3uPlaylist(id, baseUrl);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="kisskh_${id}.m3u"`);
        res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes cache
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).send(`#EXTM3U\n#ERROR: ${e.message}`);
    }
});

/**
 * Dynamic Episode Player & Redirect Resolver
 * Resolves the underlying HLS stream for an episode on-demand and redirects
 * Example: GET /api/kisskh/play?id=12345&ep=1&epId=67890
 */
router.get(['/play', '/play.m3u8'], async (req: Request, res: Response) => {
    let epId = req.query.epId as string;
    const dramaId = req.query.id as string;
    const epNum = Number(req.query.ep || '1');

    try {
        if (!epId && dramaId) {
            const drama = await getKissKhDrama(dramaId);
            const found = drama?.episodes?.find(e => e.number === epNum);
            if (found) epId = String(found.id);
        }

        if (!epId) {
            return res.status(404).send('Episode ID not specified or could not be determined');
        }

        const streamData = await resolveKissKhEpisode(epId);
        if (!streamData || !streamData.video) {
            return res.status(404).send('Episode stream could not be resolved from upstream');
        }

        // Redirect directly to the reverse proxy HLS stream (absolute URL for VLC/IPTV player compatibility)
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
