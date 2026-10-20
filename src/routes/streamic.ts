import { Router, Request, Response } from 'express';
import {
    getLiveSportsSchedule,
    USER_STREAMABLE_CHANNELS,
    buildTimPlayUrl
} from '../services/streamicSportsService';

export const streamicRouter = Router();

/**
 * GET /api/streamic/schedule
 * Full live sports schedule in IST with official thumbnails and TimStreams channel routing
 */
streamicRouter.get('/schedule', async (req: Request, res: Response) => {
    try {
        const onlyLive = req.query.live === '1' || req.query.live === 'true';
        const activeOnly = req.query.activeOnly === '1' || req.query.activeOnly === 'true';
        const onlyMyChannels = req.query.myChannels === '1' || req.query.myChannels === 'true';
        const category = req.query.category as string | undefined;
        const search = req.query.search as string | undefined;
        const force = req.query.force === '1' || req.query.force === 'true';

        const englishOnly = req.query.englishOnly === '1' || req.query.englishOnly === 'true';

        const events = await getLiveSportsSchedule({
            onlyLive,
            activeOnly,
            onlyMyChannels,
            category,
            search,
            hideEnded: true,
            onlyEnglishAndFamous: englishOnly
        }, force);

        return res.json({
            status: 'success',
            timezone: 'IST (UTC+5:30)',
            total: events.length,
            liveCount: events.filter(e => e.isLive).length,
            startingSoonCount: events.filter(e => e.isStartingSoon).length,
            events
        });
    } catch (e: any) {
        console.error('[StreamicRoute] Schedule error:', e?.message || e);
        return res.status(500).json({ status: 'error', message: e?.message || 'Failed to fetch schedule' });
    }
});

/**
 * GET /api/streamic/live
 * Strictly LIVE matches streaming right now
 */
streamicRouter.get('/live', async (req: Request, res: Response) => {
    try {
        const force = req.query.force === '1' || req.query.force === 'true';
        const events = await getLiveSportsSchedule({
            onlyLive: true,
            hideEnded: true
        }, force);

        return res.json({
            status: 'success',
            timezone: 'IST (UTC+5:30)',
            total: events.length,
            events
        });
    } catch (e: any) {
        return res.status(500).json({ status: 'error', message: e?.message });
    }
});

/**
 * GET /api/streamic/channels
 * Directory of our TimStreams sports channels
 */
streamicRouter.get('/channels', async (req: Request, res: Response) => {
    try {
        const schedule = await getLiveSportsSchedule({ onlyLive: true });
        const channelMap = USER_STREAMABLE_CHANNELS.map(ch => {
            const activeOnChannel = schedule.filter(e =>
                e.channels.some(c => c.channelSlug === ch.slug) ||
                e.myConvertedChannels.some(c => c.channelSlug === ch.slug)
            );
            return {
                ...ch,
                playUrl: buildTimPlayUrl(ch.slug, ch.name),
                activeEventsCount: activeOnChannel.length,
                currentEvents: activeOnChannel.map(e => ({ id: e.id, title: e.title, status: e.status }))
            };
        });

        return res.json({
            status: 'success',
            total: channelMap.length,
            channels: channelMap
        });
    } catch (e: any) {
        return res.status(500).json({ status: 'error', message: e?.message });
    }
});

/**
 * GET /api/streamic/playlist.m3u
 * Dynamic #EXTM3U playlist of active matches
 */
streamicRouter.get('/playlist.m3u', async (req: Request, res: Response) => {
    try {
        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const events = await getLiveSportsSchedule({ activeOnly: true });

        let m3u = `#EXTM3U x-tvg-url="" tvg-shift="0"\n`;
        events.forEach(e => {
            const primaryChannel = e.myConvertedChannels[0] || (e.channels.find(c => c.timChannelId));
            if (primaryChannel) {
                const streamUrl = `${baseUrl}/live.php?token=STALKER_PRO&id=${encodeURIComponent(primaryChannel.timChannelId || 'tim_' + primaryChannel.channelSlug)}&m3u=1`;
                m3u += `#EXTINF:-1 tvg-id="${primaryChannel.channelSlug}" tvg-name="${e.title}" tvg-logo="${e.thumbnail || ''}" group-title="${e.sportName}", ${e.title} (${primaryChannel.channelName})\n`;
                m3u += `${streamUrl}\n`;
            }
        });

        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.setHeader('Content-Disposition', 'attachment; filename="live_sports.m3u"');
        return res.send(m3u);
    } catch (e: any) {
        return res.status(500).send('#EXTM3U\n');
    }
});
