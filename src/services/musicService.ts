import axios from 'axios';
import { JioSaavnService, SaavnSong } from './jiosaavnService';
import { YouTubeService } from './youtubeService';

export interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    durationFormatted?: string;
    artwork: string;
    streamUrl: string;
    downloadUrl: string;
    source: 'jiosaavn' | 'audius' | 'youtube' | 'jamendo';
}

export class MusicService {
    /**
     * Search full-length 320kbps tracks across JioSaavn (Tier 1), Audius, and YouTube Music engines
     */
    static async searchMusic(query: string, limit: number = 15): Promise<MusicTrack[]> {
        const cleanQ = (query || '').trim();
        if (!cleanQ) return [];

        
        if (cleanQ.startsWith('http://') || cleanQ.startsWith('https://')) {
            const resolvedTracks = await this.resolveLink(cleanQ);
            if (resolvedTracks && resolvedTracks.length > 0) return resolvedTracks;
        }

        const results: MusicTrack[] = [];

        // 1. TIER 1: JioSaavn Official 320kbps Lossless Audio Engine
        try {
            const saavnSongs = await JioSaavnService.searchSongs(cleanQ, limit);
            if (saavnSongs.length > 0) {
                for (const s of saavnSongs) {
                    results.push({
                        id: s.id,
                        title: s.title,
                        artist: s.artist,
                        album: s.album,
                        duration: s.duration,
                        durationFormatted: s.durationFormatted,
                        artwork: s.artwork,
                        streamUrl: s.streamUrl,
                        downloadUrl: s.downloadUrl,
                        source: 'jiosaavn' as 'jiosaavn'
                    });
                }
            }
        } catch (e: any) {
            console.error('[MusicService] JioSaavn Tier 1 error:', e.message);
        }

        // 2.5 TIER: Jamendo API (CC Music)
        if (results.length < limit) {
            try {
                const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=c9cb2a0a&format=json&limit=${limit - results.length}&search=${encodeURIComponent(cleanQ)}`;
                const res = await axios.get(jamendoUrl, { timeout: 3000 });
                const tracks = res.data?.results || [];
                for (const t of tracks) {
                    const durSec = t.duration || 210;
                    const m = Math.floor(durSec / 60);
                    const s = durSec % 60;
                    results.push({
                        id: `jamendo-${t.id}`,
                        title: t.name || 'Unknown Track',
                        artist: t.artist_name || 'Unknown Artist',
                        album: t.album_name || 'Jamendo Indie',
                        duration: durSec,
                        durationFormatted: `${m}:${s < 10 ? '0' : ''}${s}`,
                        artwork: t.image || t.album_image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=480',
                        streamUrl: t.audio || '',
                        downloadUrl: `/api/music/proxy?url=${encodeURIComponent(t.audio || '')}&download=1&title=${encodeURIComponent(t.name || 'audio')}&artist=${encodeURIComponent(t.artist_name || 'artist')}`,
                        source: 'jamendo'
                    });
                }
            } catch (e: any) {}
        }

        // 2. TIER 2: Audius Full-Length Master Audio Network
        if (results.length < limit) {
            try {
                const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(cleanQ)}&app_name=STALKER_PRO`;
                const res = await axios.get(audiusUrl, { timeout: 3000 });
                const tracks = res.data?.data || [];
                
                for (const t of tracks.slice(0, limit - results.length)) {
                    const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=STALKER_PRO`;
                    const durSec = t.duration || 210;
                    const m = Math.floor(durSec / 60);
                    const s = durSec % 60;
                    results.push({
                        id: `audius-${t.id}`,
                        title: t.title,
                        artist: t.user?.name || 'Artist',
                        album: t.genre || 'Lossless Audio',
                        duration: durSec,
                        durationFormatted: `${m}:${s < 10 ? '0' : ''}${s}`,
                        artwork: t.artwork?.['480x480'] || t.artwork?.['150x150'] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=480',
                        streamUrl: streamUrl,
                        downloadUrl: `/api/music/proxy?url=${encodeURIComponent(streamUrl)}&download=1&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.user?.name || 'Artist')}`,
                        source: 'audius'
                    });
                }
            } catch (e: any) {}
        }

        

        return results;
    }

    /**
     * Get Trending Full-Length Top Tracks
     */
    
    
    static async resolveLink(url: string): Promise<MusicTrack[]> {
        if (!url) return [];
        try {
            if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
                let vid = '';
                if (url.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split('?')[0];
                else if (url.includes('v=')) vid = url.split('v=')[1].split('&')[0];
                
                if (vid) {
                    try {
                        const ytTracks = await YouTubeService.searchYouTube('https://www.youtube.com/watch?v=' + vid, 1);
                        if (ytTracks.length > 0) {
                            const v = ytTracks[0];
                            let durationSec = 210;
                            if (typeof v.duration === 'string' && v.duration.includes(':')) {
                                const parts = v.duration.split(':').map(Number);
                                if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
                                if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            }
                            const streamUrl = `/api/v1/youtube/stream?v=${vid}&type=mp3`;
                            return [{
                                id: `yt-${vid}`, title: v.title, artist: v.uploader || 'YouTube Artist', album: 'Studio Master',
                                duration: durationSec, durationFormatted: `${Math.floor(durationSec / 60)}:${durationSec % 60 < 10 ? '0' : ''}${durationSec % 60}`,
                                artwork: v.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                                streamUrl: streamUrl, downloadUrl: streamUrl, source: 'youtube' as 'youtube'
                            }];
                        }
                    } catch(e) {}
                }
            } else if (url.includes('jiosaavn.com/')) {
                const saavnTracks = await JioSaavnService.resolveFromUrl(url);
                if (saavnTracks && saavnTracks.length > 0) {
                    return saavnTracks.map(s => ({
                        id: s.id,
                        title: s.title,
                        artist: s.artist,
                        album: s.album,
                        duration: s.duration,
                        durationFormatted: s.durationFormatted,
                        artwork: s.artwork,
                        streamUrl: s.streamUrl,
                        downloadUrl: s.downloadUrl,
                        source: 'jiosaavn' as const
                    }));
                }
            }
        } catch (e) {
            console.error('[MusicService] resolveLink error:', e);
        }

        if (url.startsWith('http')) {
            const isAudioExt = /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(url.split('?')[0]);
            return [{
                id: 'direct_' + Date.now(),
                title: isAudioExt ? url.split('/').pop() || 'Direct Audio URL' : 'Direct Stream',
                artist: 'Custom Stream',
                artwork: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=150&h=150',
                streamUrl: url,
                downloadUrl: url,
                source: 'jiosaavn' as 'jiosaavn'
            }];
        }
        return [];
    }

    static async getTrendingTracks(limit: number = 12): Promise<MusicTrack[]> {
        // Try JioSaavn Top Trending first
        try {
            const saavnTrending = await JioSaavnService.searchSongs('Trending Top Hits', limit);
            if (saavnTrending.length > 0) {
                return saavnTrending.map(s => ({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    duration: s.duration,
                    durationFormatted: s.durationFormatted,
                    artwork: s.artwork,
                    streamUrl: s.streamUrl,
                    downloadUrl: s.downloadUrl,
                    source: 'jiosaavn' as 'jiosaavn'
                }));
            }
        } catch (e) {}

        try {
            const url = 'https://discoveryprovider.audius.co/v1/tracks/trending?app_name=STALKER_PRO';
            const res = await axios.get(url, { timeout: 3500 });
            const tracks = res.data?.data || [];
            return tracks.slice(0, limit).map((t: any) => {
                const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=STALKER_PRO`;
                return {
                    id: `audius-${t.id}`,
                    title: t.title,
                    artist: t.user?.name || 'Artist',
                    album: t.genre || 'Top Hit',
                    duration: t.duration || 210,
                    artwork: t.artwork?.['480x480'] || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=480',
                    streamUrl: streamUrl,
                    downloadUrl: `/api/music/proxy?url=${encodeURIComponent(streamUrl)}&download=1&title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.user?.name || 'Artist')}`,
                    source: 'audius'
                };
            });
        } catch (e) {
            return [];
        }
    }
}
