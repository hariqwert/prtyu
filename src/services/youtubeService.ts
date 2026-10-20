import axios from 'axios';

export interface YouTubeVideoItem {
    id: string;
    title: string;
    uploader: string;
    duration?: number | string;
    thumbnail: string;
    embedUrl: string;
    watchUrl: string;
    downloadVideoUrl: string;
    downloadAudioUrl: string;
}

export class YouTubeService {
    /**
     * In-process high-speed YouTube Search across Direct YouTube Scraping, TMDB Trailers, and Invidious/Piped
     */
    static async searchYouTube(query: string, limit: number = 8): Promise<YouTubeVideoItem[]> {
        
        const cleanQ = (query || '').trim();
        if (!cleanQ) return [];

        const results: YouTubeVideoItem[] = [];

        // Check if query is a direct YouTube URL
        const ytMatch = cleanQ.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        if (ytMatch && ytMatch[1]) {
            const vidId = ytMatch[1];
            try {
                const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vidId}`;
                const noRes = await axios.get(noembedUrl);
                if (noRes.data && !noRes.data.error) {
                    return [{
                        id: vidId,
                        title: noRes.data.title || 'YouTube Video',
                        uploader: noRes.data.author_name || 'YouTube Creator',
                        duration: 'URL',
                        thumbnail: noRes.data.thumbnail_url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                        embedUrl: `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&enablejsapi=1&rel=0`,
                        watchUrl: `https://www.youtube.com/watch?v=${vidId}`,
                        downloadVideoUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp4&quality=1080`,
                        downloadAudioUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp3`
                    }];
                }
            } catch(e) {
                console.error("Direct URL fetch error", e);
            }
        }


        // 1. TIER 1: Direct YouTube Search Parser (Ultra fast, full rich metadata, no rate limits)
        try {
            const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
            const ytRes = await axios.get(ytSearchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 5000
            });

            const html = ytRes.data;
            const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
            if (match) {
                const data = JSON.parse(match[1]);
                const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
                
                for (const item of contents) {
                    if (item.videoRenderer) {
                        const vr = item.videoRenderer;
                        const vidId = vr.videoId;
                        if (!vidId) continue;

                        const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || 'YouTube Video';
                        const uploader = vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || 'YouTube Creator';
                        const lengthText = vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || '';
                        
                        let thumbUrl = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
                        if (vr.thumbnail?.thumbnails && vr.thumbnail.thumbnails.length > 0) {
                            const lastThumb = vr.thumbnail.thumbnails[vr.thumbnail.thumbnails.length - 1];
                            if (lastThumb?.url) thumbUrl = lastThumb.url;
                        }

                        results.push({
                            id: vidId,
                            title: title,
                            uploader: uploader,
                            duration: lengthText,
                            thumbnail: thumbUrl,
                            embedUrl: `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&enablejsapi=1&rel=0`,
                            watchUrl: `https://www.youtube.com/watch?v=${vidId}`,
                            downloadVideoUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp4&quality=1080`,
                            downloadAudioUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp3`
                        });

                        if (results.length >= limit) break;
                    }
                }

                if (results.length > 0) {
                    return results;
                }
            }
        } catch (err: any) {
            console.warn('[YouTubeService] Direct search parser warning:', err?.message);
        }

        // 2. TIER 2: If movie/trailer query, try TMDB official videos API
        if (/trailer|teaser|movie|film/i.test(cleanQ)) {
            try {
                const cleanTitle = cleanQ.replace(/trailer|official|teaser|movie|film|play|watch|on youtube|youtube/gi, '').trim();
                const TMDB_KEY = '9d83476d2e27f56748167514c69cd2b4';
                const sRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}`, { timeout: 3000 });
                const top = sRes.data?.results?.[0];
                if (top) {
                    const mediaType = top.media_type || (top.name ? 'tv' : 'movie');
                    const vRes = await axios.get(`https://api.themoviedb.org/3/${mediaType}/${top.id}/videos?api_key=${TMDB_KEY}`, { timeout: 3000 });
                    const vids = vRes.data?.results || [];
                    const trailers = vids.filter((v: any) => v.site === 'YouTube');
                    if (trailers.length > 0) {
                        for (const tr of trailers.slice(0, limit)) {
                            results.push({
                                id: tr.key,
                                title: `${top.title || top.name} - ${tr.name}`,
                                uploader: 'Official Studio Release',
                                thumbnail: `https://i.ytimg.com/vi/${tr.key}/hqdefault.jpg`,
                                embedUrl: `https://www.youtube-nocookie.com/embed/${tr.key}?autoplay=1&enablejsapi=1&rel=0`,
                                watchUrl: `https://www.youtube.com/watch?v=${tr.key}`,
                                downloadVideoUrl: `/api/v1/youtube/stream?v=${tr.key}&type=mp4&quality=1080`,
                                downloadAudioUrl: `/api/v1/youtube/stream?v=${tr.key}&type=mp3`
                            });
                        }
                        if (results.length > 0) return results;
                    }
                }
            } catch (e) {}
        }

        // 3. TIER 3: Try Invidious and Piped instances
        const invidiousHosts = [
            'https://invidious.flokinet.to',
            'https://inv.nadeko.net',
            'https://invidious.nerdvpn.de',
            'https://pipedapi.kavin.rocks'
        ];

        for (const host of invidiousHosts) {
            try {
                const searchUrl = host.includes('piped') 
                    ? `${host}/search?q=${encodeURIComponent(cleanQ)}&filter=videos`
                    : `${host}/api/v1/search?q=${encodeURIComponent(cleanQ)}&type=video`;

                const res = await axios.get(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 4000
                });

                const items = host.includes('piped') ? (res.data?.items || []) : (Array.isArray(res.data) ? res.data : []);
                if (items.length > 0) {
                    return items.slice(0, limit).map((v: any) => {
                        const vidId = v.videoId || v.url?.replace('/watch?v=', '') || v.id;
                        return {
                            id: vidId,
                            title: v.title,
                            uploader: v.author || v.uploaderName || 'YouTube Creator',
                            duration: v.lengthSeconds || v.duration || 0,
                            thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                            embedUrl: `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&enablejsapi=1&rel=0`,
                            watchUrl: `https://www.youtube.com/watch?v=${vidId}`,
                            downloadVideoUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp4&quality=1080`,
                            downloadAudioUrl: `/api/v1/youtube/stream?v=${vidId}&type=mp3`
                        };
                    });
                }
            } catch (e) {}
        }

        return results;
    }
}
