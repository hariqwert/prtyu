import { Router, Request, Response } from 'express';
import { ConsumetSearchService } from '../services/consumetSearchService';

const router = Router();

// GET /api/consumet or /api/consumet/search - Unified fast multi-source search
router.get(['/', '/search'], async (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const source = (req.query.source || 'all') as string;
        const limit = parseInt(req.query.limit as string) || 24;

        if (!query.trim()) {
            return res.json({
                query: '',
                source,
                timing_ms: 0,
                cached: false,
                total: 0,
                results: { events: [], channels: [], movies: [], anime: [] }
            });
        }

        const data = await ConsumetSearchService.search(query, source, limit);
        res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
        return res.json(data);
    } catch (e: any) {
        console.error('[ConsumetSearchRoute] Error during search:', e?.message || e);
        return res.status(500).json({ status: "error", message: e?.message || "Search failed" });
    }
});

// GET /api/consumet/suggestions - Instant auto-complete search suggestions
router.get('/suggestions', (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const limit = parseInt(req.query.limit as string) || 8;
        const suggestions = ConsumetSearchService.getSuggestions(query, limit);
        return res.json({ status: "success", suggestions });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to fetch suggestions" });
    }
});

// GET /api/consumet/channels - Fast channel search
router.get('/channels', (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const limit = parseInt(req.query.limit as string) || 24;
        const channels = ConsumetSearchService.searchChannelsFast(query, limit);
        return res.json({ status: "success", count: channels.length, channels });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to search channels" });
    }
});

// GET /api/consumet/sports - Fast sports events search
router.get('/sports', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const limit = parseInt(req.query.limit as string) || 18;
        const events = await ConsumetSearchService.searchSportsEventsFast(query, limit);
        return res.json({ status: "success", count: events.length, events });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to search sports events" });
    }
});

// GET /api/consumet/movies - Fast movies & series search
router.get('/movies', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const limit = parseInt(req.query.limit as string) || 24;
        const movies = await ConsumetSearchService.searchMoviesAndSeriesFast(query, limit);
        return res.json({ status: "success", count: movies.length, movies });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to search movies" });
    }
});

// GET /api/consumet/anime - Fast anime search
router.get('/anime', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q || req.query.query || '') as string;
        const limit = parseInt(req.query.limit as string) || 20;
        const anime = await ConsumetSearchService.searchAnimeFast(query, limit);
        return res.json({ status: "success", count: anime.length, anime });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to search anime" });
    }
});

export default router;
