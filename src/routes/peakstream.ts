import { Router, Request, Response } from 'express';
import { scrapePeakStream } from '../services/peakStreamService';

const router = Router();

router.all('/', async (req: Request, res: Response) => {
    try {
        const { id, type, title, season, episode, year } = req.query;
        if (!id) return res.status(400).json({ success: false, error: 'Missing ID' });

        const result = await scrapePeakStream({
            id: id as string,
            type: (type as any) || 'movie',
            title: title as string,
            season: season as string,
            episode: episode as string,
            year: year as string
        });

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
