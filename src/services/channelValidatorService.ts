import axios from 'axios';
import { getChannelsList, ChannelItem } from './channelJsonService';

export class ChannelValidatorService {
    private static verifiedActiveChannels: ChannelItem[] = [];
    private static isProbing: boolean = false;
    private static lastProbeTime: number = 0;

    /**
     * Fast probe a single stream URL with 1.5s timeout
     */
    static async isStreamAlive(url: string): Promise<boolean> {
        if (!url || typeof url !== 'string') return false;
        try {
            const res = await axios.head(url, {
                timeout: 2000,
                headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' }
            });
            return res.status >= 200 && res.status < 400;
        } catch (e) {
            // Fallback try GET with small range
            try {
                const getRes = await axios.get(url, {
                    timeout: 2000,
                    headers: { 'Range': 'bytes=0-100', 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' }
                });
                return getRes.status >= 200 && getRes.status < 400;
            } catch (err) {
                return false;
            }
        }
    }

    /**
     * Filter channels list, keeping known active and valid stream formats
     */
    static getActiveWorkingChannels(): ChannelItem[] {
        const all = getChannelsList();
        
        // Filter out obvious broken/corrupted items
        return all.filter(c => {
            const url = c.url || c.stream_url || '';
            const name = c.name || c.title || '';
            
            if (!url || url.length < 8) return false;
            if (!name || name.trim().length === 0) return false;
            if (url.includes('example.com') || url.includes('localhost:9999')) return false;

            return true;
        });
    }
}
