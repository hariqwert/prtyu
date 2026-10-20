import axios from 'axios';

export interface SaavnSong {
    id: string;
    title: string;
    artist: string;
    album: string;
    year: string;
    duration: number;
    durationFormatted: string;
    artwork: string;
    streamUrl: string;
    downloadUrl: string;
    source: 'jiosaavn';
}

export class JioSaavnService {
    private static readonly BASE_URL = 'https://www.jiosaavn.com/api.php';
    private static readonly HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Accept': 'application/json, text/plain, */*'
    };

    /**
     * Search songs on JioSaavn with full 320kbps audio streams
     */
    static async searchSongs(query: string, limit: number = 15): Promise<SaavnSong[]> {
        const cleanQ = (query || '').trim();
        if (!cleanQ) return [];

        try {
            const searchUrl = `${this.BASE_URL}?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&p=1&q=${encodeURIComponent(cleanQ)}`;
            const res = await axios.get(searchUrl, {
                headers: this.HEADERS,
                timeout: 4500
            });

            const data = res.data;
            const songs = data?.results || [];
            if (!Array.isArray(songs) || songs.length === 0) return [];

            const parsedTracks: SaavnSong[] = [];

            // Process songs and fetch signed 320kbps streams concurrently
            const promises = songs.map(async (s: any) => {
                const title = (s.title || s.song || 'Song')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'")
                    .replace(/&amp;/g, '&')
                    .trim();

                const artist = s.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ')
                    || s.more_info?.primary_artists
                    || s.more_info?.singers
                    || s.subtitle
                    || 'JioSaavn Artist';

                const album = (s.more_info?.album || s.album || 'JioSaavn Release')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'")
                    .replace(/&amp;/g, '&')
                    .trim();

                const durationSec = parseInt(s.more_info?.duration || s.duration, 10) || 210;
                const m = Math.floor(durationSec / 60);
                const sec = durationSec % 60;
                const durationFormatted = `${m}:${sec < 10 ? '0' : ''}${sec}`;

                const rawImg = s.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
                const artwork = rawImg.replace(/150x150|50x50/, '500x500');

                const enc = s.more_info?.encrypted_media_url;
                let stream320 = '';

                if (enc) {
                    try {
                        const authUrl = `${this.BASE_URL}?__call=song.generateAuthToken&_format=json&_marker=0&api_version=4&ctx=web6dot0&url=${encodeURIComponent(enc)}&bitrate=320`;
                        const authRes = await axios.get(authUrl, {
                            headers: this.HEADERS,
                            timeout: 3000
                        });
                        stream320 = authRes.data?.auth_url || '';
                    } catch (err) {}
                }

                if (stream320) {
                    const proxiedStream = `/api/music/proxy?url=${encodeURIComponent(stream320)}`;
                    const downloadLink = `/api/music/proxy?url=${encodeURIComponent(stream320)}&download=1&title=${encodeURIComponent(title)}`;

                    return {
                        id: `saavn_${s.id}`,
                        title,
                        artist,
                        album,
                        year: s.year || s.more_info?.year || '2026',
                        duration: durationSec,
                        durationFormatted,
                        artwork,
                        streamUrl: proxiedStream,
                        downloadUrl: downloadLink,
                        source: 'jiosaavn' as const
                    };
                }
                return null;
            });

            const resolved = await Promise.all(promises);
            for (const r of resolved) {
                if (r) parsedTracks.push(r);
            }

            return parsedTracks;
        } catch (e: any) {
            console.error('[JioSaavnService] Search error:', e.message);
            return [];
        }
    }

    /**
     * Parse raw JioSaavn song objects into SaavnSong items with 320kbps streams
     */
    static async parseSongList(songs: any[]): Promise<SaavnSong[]> {
        if (!Array.isArray(songs) || songs.length === 0) return [];
        const parsedTracks: SaavnSong[] = [];

        const promises = songs.map(async (s: any) => {
            const title = (s.title || s.song || 'Song')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .trim();

            const artist = s.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ')
                || s.more_info?.primary_artists
                || s.more_info?.singers
                || s.subtitle
                || 'JioSaavn Artist';

            const album = (s.more_info?.album || s.album || 'JioSaavn Release')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .trim();

            const durationSec = parseInt(s.more_info?.duration || s.duration, 10) || 210;
            const m = Math.floor(durationSec / 60);
            const sec = durationSec % 60;
            const durationFormatted = `${m}:${sec < 10 ? '0' : ''}${sec}`;

            const rawImg = s.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
            const artwork = rawImg.replace(/150x150|50x50/, '500x500');

            const enc = s.more_info?.encrypted_media_url;
            let stream320 = '';

            if (enc) {
                try {
                    const authUrl = `${this.BASE_URL}?__call=song.generateAuthToken&_format=json&_marker=0&api_version=4&ctx=web6dot0&url=${encodeURIComponent(enc)}&bitrate=320`;
                    const authRes = await axios.get(authUrl, {
                        headers: this.HEADERS,
                        timeout: 3000
                    });
                    stream320 = authRes.data?.auth_url || '';
                } catch (err) {}
            }

            if (stream320) {
                const proxiedStream = `/api/music/proxy?url=${encodeURIComponent(stream320)}`;
                const downloadLink = `/api/music/proxy?url=${encodeURIComponent(stream320)}&download=1&title=${encodeURIComponent(title)}`;

                return {
                    id: `saavn_${s.id}`,
                    title,
                    artist,
                    album,
                    year: s.year || s.more_info?.year || '2026',
                    duration: durationSec,
                    durationFormatted,
                    artwork,
                    streamUrl: proxiedStream,
                    downloadUrl: downloadLink,
                    source: 'jiosaavn' as const
                };
            }
            return null;
        });

        const resolved = await Promise.all(promises);
        for (const r of resolved) {
            if (r) parsedTracks.push(r);
        }
        return parsedTracks;
    }

    /**
     * Resolve JioSaavn URL (song, album, playlist, artist) to songs with 320kbps streams
     */
    static async resolveFromUrl(url: string): Promise<SaavnSong[]> {
        const cleanUrl = url.split('?')[0].split('#')[0].replace(/\/$/, '');
        const parts = cleanUrl.split('/').filter(Boolean);
        const token = parts[parts.length - 1];
        let type = 'song';
        if (cleanUrl.includes('/artist/')) type = 'artist';
        else if (cleanUrl.includes('/album/')) type = 'album';
        else if (cleanUrl.includes('/playlist/') || cleanUrl.includes('/featured/')) type = 'playlist';

        // 1. Try webapi.get with token
        if (token) {
            try {
                const saavnApiUrl = `${this.BASE_URL}?__call=webapi.get&token=${encodeURIComponent(token)}&type=${type}&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
                const res = await axios.get(saavnApiUrl, { headers: this.HEADERS, timeout: 4000 });
                if (res?.data) {
                    let songsArr: any[] = [];
                    if (type === 'artist' && res.data.topSongs) songsArr = res.data.topSongs;
                    else if (type === 'playlist' || type === 'album') songsArr = res.data.list || res.data.songs || [];
                    else if (res.data.songs) {
                        songsArr = Array.isArray(res.data.songs) ? res.data.songs : Object.values(res.data.songs);
                    }

                    if (songsArr.length > 0) {
                        const tracks = await this.parseSongList(songsArr);
                        if (tracks.length > 0) return tracks;
                    }
                }
            } catch (e) {}
        }

        // 2. Try slug query if webapi.get didn't yield tracks
        const meaningfulParts = parts.filter(p => !['http:', 'https:', 'www.jiosaavn.com', 'jiosaavn.com', 'song', 'album', 'artist', 'playlist', 'featured'].includes(p.toLowerCase()));
        if (meaningfulParts.length > 0) {
            // First part is usually the title slug, e.g. "indrajaalam" or "ellaam-indrajaalam-from-karma"
            const slug = meaningfulParts[0].replace(/-/g, ' ');
            if (slug && slug.length >= 2) {
                const searchResults = await this.searchSongs(slug, 5);
                if (searchResults.length > 0) {
                    return searchResults;
                }
            }
            if (meaningfulParts.length > 1) {
                const altSlug = meaningfulParts[1].replace(/-/g, ' ');
                if (altSlug && altSlug.length >= 2 && altSlug !== slug) {
                    const altResults = await this.searchSongs(altSlug, 5);
                    if (altResults.length > 0) {
                        return altResults;
                    }
                }
            }
        }

        return [];
    }
}
