import axios from 'axios';
import https from 'https';

export interface ZeeChannel {
    id: string;
    name: string;
    logo: string;
    genre: string;
    manifestUrl: string;
    streamUrl: string;
    licenseType: 'clearkey';
    licenseKey: string;
    keyId: string;
    key: string;
    isAlive: boolean;
    updatedAt: number;
}

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const ZEE_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/zee.m3u';

let cachedZeeChannels: ZeeChannel[] = [];
let lastSyncTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch and parse all working Zee channels from Cloudfront origin
 */
export async function syncZeeChannels(forceRefresh = false): Promise<ZeeChannel[]> {
    const now = Date.now();
    if (!forceRefresh && cachedZeeChannels.length > 0 && (now - lastSyncTime < CACHE_TTL_MS)) {
        return cachedZeeChannels;
    }

    try {
        const res = await axios.get(ZEE_M3U_URL, {
            httpsAgent,
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!res.data || typeof res.data !== 'string') {
            return cachedZeeChannels;
        }

        const lines = res.data.split(/\r?\n/);
        const channels: ZeeChannel[] = [];

        let currentName = '';
        let currentLogo = '';
        let currentKey = '';
        let currentKeyId = '';
        let currentRawKey = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/tvg-name="([^"]+)"/);
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const commaIdx = line.lastIndexOf(',');
                const fallbackName = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Zee Channel';

                currentName = (nameMatch ? nameMatch[1] : fallbackName)
                    .replace(/By\s*@\w+/gi, '')
                    .replace(/@\w+/gi, '')
                    .trim();
                currentLogo = logoMatch ? logoMatch[1] : '';
            } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                currentKey = line.split('=')[1]?.trim() || '';
                if (currentKey.includes(':')) {
                    const parts = currentKey.split(':');
                    currentKeyId = parts[0];
                    currentRawKey = parts[1];
                }
            } else if (line.startsWith('http://') || line.startsWith('https://')) {
                const streamUrl = line;
                const channelId = `zee-${currentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

                let genre = 'Entertainment';
                const lowerName = currentName.toLowerCase();
                if (lowerName.includes('cinema') || lowerName.includes('picture') || lowerName.includes('bollywood') || lowerName.includes('movie')) {
                    genre = 'Movies';
                } else if (lowerName.includes('news') || lowerName.includes('business') || lowerName.includes('hindustan')) {
                    genre = 'News';
                } else if (lowerName.includes('discovery') || lowerName.includes('science') || lowerName.includes('turbo')) {
                    genre = 'Infotainment';
                } else if (lowerName.includes('zing') || lowerName.includes('zoom')) {
                    genre = 'Music';
                }

                // Auto-route via our clean MDTV player with ClearKey support
                const playerUrl = `http://localhost:3000/player/mdtv?id=${channelId}&stream=${encodeURIComponent(streamUrl)}&key=${encodeURIComponent(currentKey)}`;

                channels.push({
                    id: channelId,
                    name: currentName,
                    logo: currentLogo,
                    genre,
                    manifestUrl: streamUrl,
                    streamUrl: playerUrl,
                    licenseType: 'clearkey',
                    licenseKey: currentKey,
                    keyId: currentKeyId,
                    key: currentRawKey,
                    isAlive: true,
                    updatedAt: now
                });

                // Reset per-channel temp state
                currentKey = '';
                currentKeyId = '';
                currentRawKey = '';
            }
        }

        if (channels.length > 0) {
            cachedZeeChannels = channels;
            lastSyncTime = now;
            console.log(`[ZeeService] Synced ${channels.length} Zee Network channels from Cloudfront origin.`);
        }

        return cachedZeeChannels;
    } catch (err: any) {
        console.warn('[ZeeService] Failed to sync Zee channels:', err.message);
        return cachedZeeChannels;
    }
}

/**
 * Generate standard Kodi / IPTV M3U for Zee channels
 */
export async function getZeePlaylistM3u(): Promise<string> {
    const channels = await syncZeeChannels();
    let m3u = '#EXTM3U\n';

    for (const ch of channels) {
        m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${ch.genre}",${ch.name}\n`;
        if (ch.licenseKey) {
            m3u += `#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`;
            m3u += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
            m3u += `#KODIPROP:inputstream.adaptive.license_key=${ch.licenseKey}\n`;
        }
        m3u += `${ch.manifestUrl}\n\n`;
    }

    return m3u;
}
