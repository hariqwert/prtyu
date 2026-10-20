import { Router, Request, Response } from 'express';
import { HybridM3uPickerService } from '../services/hybridM3uPickerService';

export const hybridM3uRouter = Router();

/**
 * GET /api/hybrid-m3u/test
 * Quickly tests an M3U stream URL and returns a full multi-vector condition diagnostic.
 */
hybridM3uRouter.get('/test', async (req: Request, res: Response) => {
    try {
        const streamUrl = String(req.query.url || '').trim();
        if (!streamUrl) {
            return res.status(400).json({ error: 'Missing required query parameter "url"' });
        }

        const referer = req.query.referer ? String(req.query.referer) : undefined;
        const origin = req.query.origin ? String(req.query.origin) : undefined;
        const userAgent = req.query.ua ? String(req.query.ua) : undefined;

        const diagnostic = await HybridM3uPickerService.testSingleStream(streamUrl, {
            referer,
            origin,
            userAgent,
            probeSegment: req.query.probe !== 'false'
        });

        return res.json({
            success: true,
            data: diagnostic
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error during M3U test'
        });
    }
});

/**
 * POST /api/hybrid-m3u/test
 * Detailed test with configurable headers and options.
 */
hybridM3uRouter.post('/test', async (req: Request, res: Response) => {
    try {
        const { url, referer, origin, userAgent, probeSegment, timeoutMs } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Missing required field "url"' });
        }

        const diagnostic = await HybridM3uPickerService.testSingleStream(url, {
            referer,
            origin,
            userAgent,
            probeSegment: probeSegment !== false,
            timeoutMs: Number(timeoutMs) || 6500
        });

        return res.json({
            success: true,
            data: diagnostic
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal error in hybrid test'
        });
    }
});

/**
 * POST /api/hybrid-m3u/pick
 * Evaluates candidate stream URLs and returns the optimal selected stream with failover order.
 */
hybridM3uRouter.post('/pick', async (req: Request, res: Response) => {
    try {
        const { candidates, referer, origin, userAgent, timeoutMs } = req.body;
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ error: 'Candidates must be a non-empty array of URLs or stream objects' });
        }

        const result = await HybridM3uPickerService.pickBestM3uStream(candidates, {
            referer,
            origin,
            userAgent,
            timeoutMs: Number(timeoutMs) || 6000
        });

        return res.json({
            success: true,
            data: result
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal error in hybrid picker'
        });
    }
});

/**
 * GET /api/hybrid-m3u/play
 * Resolves candidate streams and redirects immediately to the optimal play URL for instant video player consumption.
 */
hybridM3uRouter.get('/play', async (req: Request, res: Response) => {
    try {
        const rawCandidates = req.query.urls || req.query.candidates;
        let candidatesList: string[] = [];

        if (typeof rawCandidates === 'string') {
            try {
                const parsed = JSON.parse(rawCandidates);
                if (Array.isArray(parsed)) candidatesList = parsed;
                else candidatesList = [rawCandidates];
            } catch {
                candidatesList = rawCandidates.split(',').map((s) => s.trim()).filter(Boolean);
            }
        }

        if (candidatesList.length === 0) {
            return res.status(400).send('No valid candidate URLs supplied');
        }

        const result = await HybridM3uPickerService.pickBestM3uStream(candidatesList, {
            timeoutMs: 4500
        });

        if (!result.selectedStream || !result.effectivePlayUrl) {
            return res.status(502).send('No working M3U stream candidates passed health check');
        }

        return res.redirect(302, result.effectivePlayUrl);
    } catch (err: any) {
        return res.status(500).send(`Stream resolution error: ${err.message}`);
    }
});
