import https from 'https';
import { getMovieDetails, getTvDetails } from './bingrScraperService';

export interface PeakStreamResult {
    success: boolean;
    type: string;
    tmdbId: number;
    title: string;
    year: string;
    season?: number;
    episode?: number;
    serverId: string;
    serverName: string;
    scraperName: string;
    primaryM3u8: string;
    quality: string;
    sources: Array<{ url: string; quality: string; type: string; label: string; name: string }>;
    subtitles: Array<{ lang: string; url: string; label?: string }>;
}

function requestJsonOrText<T = any>(pathname: string, options: { method?: string; body?: any; referer?: string; origin?: string; timeout?: number } = {}): Promise<{ status: number; data: T }> {
    return new Promise((resolve, reject) => {
        const u = new URL(pathname);
        const postData = options.body ? JSON.stringify(options.body) : null;
        const req = https.request({
            hostname: u.hostname,
            port: 443,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': options.referer || 'https://www.vidking.net/',
                ...(options.origin ? { 'Origin': options.origin } : {}),
                ...(postData ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                } : {})
            },
            timeout: options.timeout || 12000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode || 200, data: json });
                } catch {
                    resolve({ status: res.statusCode || 200, data: body as any });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out to ${u.pathname}`));
        });
        if (postData) req.write(postData);
        req.end();
    });
}

export async function scrapePeakStream(params: {
    type?: 'movie' | 'tv';
    id: number | string;
    title?: string;
    year?: string | number;
    season?: number | string;
    episode?: number | string;
}): Promise<PeakStreamResult> {
    const tmdbId = Number(params.id);
    const type = params.type || 'movie';
    let title = params.title || '';
    let year = params.year ? String(params.year) : '';
    const season = params.season ? Number(params.season) : undefined;
    const episode = params.episode ? Number(params.episode) : undefined;

    let realImdbId = '';
    let realReleaseYear = '';
    try {
        const details = type === 'tv' ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
        if (!title) title = details.title;
        if (!year && details.year) year = String(details.year);
        // Sometimes details contains imdb_id (but BingrMediaDetails might not have it unless we fetch external_ids)
        // Let's just try to fetch it directly from TMDB if possible
        const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
        const axios = require('axios');
        const extRes = await axios.get(`https://api.themoviedb.org/3/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${apiKey}`, { timeout: 3000 });
        if (extRes.data && extRes.data.imdb_id) {
            realImdbId = extRes.data.imdb_id;
        }
        if (extRes.data && extRes.data.release_date) {
            realReleaseYear = String(extRes.data.release_date).substring(0, 4);
        } else if (extRes.data && extRes.data.first_air_date) {
            realReleaseYear = String(extRes.data.first_air_date).substring(0, 4);
        }
    } catch (e) {}

    // 1. Fetch seed token from SpeedRace
    const seedRes = await requestJsonOrText<{ seed?: string }>(`https://api.speedracelight.com/seed?mediaId=${tmdbId}`, {
        referer: 'https://www.vidking.net/',
        origin: 'https://www.vidking.net',
        timeout: 7000
    });

    const seed = seedRes.data?.seed;
    if (!seed) throw new Error('Failed to retrieve seed token from PeakStream gateway');

    // 2. Query SpeedRace CDN gateway
    const encTitle = encodeURIComponent(encodeURIComponent(title || ''));
    // If realImdbId is not found, don't send a fake one which confuses the upstream CDN
    const finalImdbId = realImdbId ? realImdbId : '';
    let url = `https://api.speedracelight.com/cdn/sources-with-title?title=${encTitle}&mediaType=${type}&year=${year}&tmdbId=${tmdbId}&imdbId=${finalImdbId}&enc=2&seed=${seed}`;
    
    // In SpeedRace, if you pass an imdb_id and it doesn't match perfectly, it might still return *something*.
    // However, if we know we want Leo (2023) Tamil (tt15654328), and it doesn't exist, it might fallback to tt1152063 (Animation).
    // The only way to know is if SpeedRace's encrypted JSON includes the title, but it's encrypted.
    // If the API returns a master playlist that works, we have to assume it found it.
    // To prevent the fake Leo from playing on S4K, we will explicitly block the animation tt1152063 from playing if the user requested the Tamil one (tt15654328).
    
    if (finalImdbId === 'tt15654328') {
         // Lokesh Kanagaraj's Leo is notoriously missing from PeakStream, they only have the animation.
         // If we request tt15654328, Peakstream will silently serve the animation. 
         // Since PeakStream doesn't return metadata with its stream, we must manually block this specific known collision.
         throw new Error('PeakStream known collision: Tamil Leo not available, blocked animation fallback.');
    }
    if (type === 'tv' && season && episode) {
        url += `&season=${season}&episode=${episode}`;
    }

    const encRes = await requestJsonOrText<string | {error?: string}>(url, {
        referer: 'https://www.vidking.net/',
        origin: 'https://www.vidking.net',
        timeout: 8000
    });

    const encText = encRes.data;
    if (!encText) {
        throw new Error('Empty response from PeakStream gateway');
    }
    
    // Strict safeguard: if the gateway returns a completely different movie, SpeedRace JSON often includes the title.
    // However, since it's encrypted, we might not be able to read it before decrypting.
    // If the backend returns 'Nothing Found' or similar, it's handled below.
    if (typeof encText !== 'string') {
        if ((encText as any).error) throw new Error('PeakStream Gateway Error: ' + (encText as any).error);
        throw new Error('Invalid JSON response from PeakStream gateway');
    }

    // 3. Decrypt via enc-dec.app gateway
    const decRes = await requestJsonOrText<{
        status?: number;
        result?: {
            playlist?: string;
            sources?: Array<{ url: string; quality?: string; type?: string }>;
            subtitles?: Array<{ lang: string; url: string; label?: string }>;
            thumbnail?: string;
        }
    }>('https://enc-dec.app/api/dec-videasy', {
        method: 'POST',
        body: { text: encText, id: String(tmdbId), seed },
        referer: 'https://www.vidking.net/',
        origin: 'https://www.vidking.net',
        timeout: 8000
    });

    const resData = decRes.data?.result;
    if (!resData) throw new Error('Failed to decrypt PeakStream payload');

    const sources: Array<{ url: string; quality: string; type: string; label: string; name: string }> = [];

    // If the returned source is totally different, check if the gateway passed back imdb
    // Peakstream often returns a totally different movie if it doesn't have the one we want.
    // We will do a double check with the returned text if we can.
    
    if (resData.playlist) {
        sources.push({
            url: resData.playlist,
            quality: '4K / Auto',
            type: 'application/x-mpegurl',
            label: 'PeakStream #0 (Master 4K UHD)',
            name: 'Master 4K UHD'
        });
    }

    if (Array.isArray(resData.sources)) {
        for (let i = 0; i < resData.sources.length; i++) {
            const s = resData.sources[i];
            sources.push({
                url: s.url,
                quality: s.quality || 'Auto',
                type: s.type || 'application/x-mpegurl',
                label: `PeakStream #${i + 1} (${s.quality || '1080p'})`,
                name: s.quality || '1080p'
            });
        }
    }

    if (sources.length === 0) {
        throw new Error('No video sources in PeakStream payload');
    }

    let subtitles: Array<{ lang: string; url: string; label?: string }> = Array.isArray(resData.subtitles) ? resData.subtitles : [];

    return {
        success: true,
        type,
        tmdbId,
        title,
        year,
        ...(type === 'tv' ? { season, episode } : {}),
        serverId: 's4k',
        serverName: 'PeakStream 4K (SpeedRace 4K UHD Master)',
        scraperName: 'PeakStream 4K',
        primaryM3u8: sources[0].url,
        quality: sources[0].quality || '4K / Auto',
        sources,
        subtitles
    };
}
