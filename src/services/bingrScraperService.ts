import nacl from 'tweetnacl';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import axios from 'axios';
import { scrapeAnimeEpisode, resolveMalIdFromTitle, fetchAniSkipTimes } from './animeScraperService';
import { resolveRareAnimeStream } from './rareAnimesService';
import { scrapeMegaPlayAnime, getMegaPlayToken } from './megaPlayService';
import { SubtitleService } from './subtitleService';
import { searchKissKh, getKissKhDrama, resolveKissKhEpisode } from './kisskhService';
import { searchAsiaflix, resolveAsiaflixEpisodeStream } from './asiaflixService';
import { scrapeMovies4uCluster } from './movies4uService';
import { getCineProStreams } from './cineproService';
import { scrapeFrameXStream } from './framexService';
import {
    findSmMovieStream,
    searchSmMovies,
    getSmMovieCategories,
    getSmMoviesByCategory,
    initSmMovieAutoUpdate
} from './smMovieHubService';

export const tmdbAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    keepAliveMsecs: 20000,
    rejectUnauthorized: true
});

export interface BingrServerCluster {
    id: string;
    name: string;
    cc: string;
    priority: number;
}

export interface CdnHeaders {
    referer?: string;
    origin?: string;
    userAgent: string;
}

export function getCdnHeaders(url?: string): CdnHeaders {
    const defaultUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    if (!url) return { userAgent: defaultUa };
    const lower = url.toLowerCase();

    if (
        lower.includes('animecurx.tech') ||
        lower.includes('rousav.tech') ||
        lower.includes('streamrip.fun') ||
        lower.includes('bingr.one') ||
        lower.includes('hakunamatata') ||
        lower.includes('hakunaymatata')
    ) {
        return {
            referer: 'https://bingr.one/',
            origin: 'https://bingr.one',
            userAgent: defaultUa
        };
    }

    if (lower.includes('m4uplay') || lower.includes('callistanise') || lower.includes('acek-cdn')) {
        return {
            referer: 'https://m4uplay.quest/',
            origin: 'https://m4uplay.quest',
            userAgent: defaultUa
        };
    }

    if (
        lower.includes('nexabloom') ||
        lower.includes('megaplay') ||
        lower.includes('mistyhorizon') ||
        lower.includes('horizon') ||
        lower.includes('goldenanchor') ||
        lower.includes('filmu.in') ||
        lower.includes('midnightvoyage') ||
        lower.includes('onehpanddreaming') ||
        lower.includes('broforgotsave') ||
        lower.includes('eclipseharbor') ||
        (lower.includes('.space') && lower.includes('/anime/')) ||
        (lower.includes('/anime/') && !lower.includes('animesalt') && !lower.includes('ravok'))
    ) {
        return {
            referer: 'https://megaplay.buzz/',
            origin: 'https://megaplay.buzz',
            userAgent: defaultUa
        };
    }

    if (
        lower.includes('ravok') ||
        lower.includes('as-cdn') ||
        lower.includes('animesalt')
    ) {
        return {
            referer: 'https://animesalt.cx/',
            origin: 'https://animesalt.cx',
            userAgent: defaultUa
        };
    }

    if (lower.includes('b-cdn.net') || lower.includes('fibwatch') || lower.includes('fertgh')) {
        return {
            referer: 'https://fibwatch.art/',
            origin: 'https://fibwatch.art',
            userAgent: defaultUa
        };
    }

    if (
        lower.includes('kisskh') ||
        lower.includes('cdnvideo') ||
        lower.includes('newvideostream')
    ) {
        return {
            referer: 'https://kisskh.co/',
            origin: 'https://kisskh.co',
            userAgent: defaultUa
        };
    }

    if (lower.includes('filmu.in') || lower.includes('bingr.one')) {
        return {
            referer: 'https://bingr.one/',
            origin: 'https://bingr.one',
            userAgent: defaultUa
        };
    }

    if (
        lower.includes('framextv') ||
        lower.includes('cheaptruckrepairs') ||
        lower.includes('krussdomi') ||
        lower.includes('bwcvxn')
    ) {
        return {
            referer: 'https://framextv.xyz/',
            origin: 'https://framextv.xyz',
            userAgent: defaultUa
        };
    }

    return { userAgent: defaultUa };
}

export function requiresReferer(url?: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
        lower.includes('animecurx.tech') ||
        lower.includes('rousav.tech') ||
        lower.includes('streamrip.fun') ||
        lower.includes('bingr.one') ||
        lower.includes('m4uplay') ||
        lower.includes('callistanise') ||
        lower.includes('acek-cdn') ||
        lower.includes('nexabloom') ||
        lower.includes('megaplay') ||
        lower.includes('goldenanchor') ||
        lower.includes('midnightvoyage') ||
        lower.includes('onehpanddreaming') ||
        lower.includes('broforgotsave') ||
        lower.includes('ravok') ||
        lower.includes('as-cdn') ||
        lower.includes('animesalt') ||
        lower.includes('cdnvideo') ||
        lower.includes('newvideostream') ||
        lower.includes('filmu.in') ||
        lower.includes('fibwatch') ||
        lower.includes('fertgh') ||
        lower.includes('kisskh') ||
        lower.includes('hakunamatata') ||
        lower.includes('hakunaymatata') ||
        lower.includes('krussdomi') ||
        lower.includes('bwcvxn')
    );
}

export function normalizeServerId(rawSrv?: string): string | undefined {
    if (!rawSrv) return undefined;
    const lower = rawSrv.toLowerCase().trim();
    const map: Record<string, string> = {
        'bing_anime': 'bing_anime',
        'binganime': 'bing_anime',
        'bing-anime': 'bing_anime',
        'framex': 'framex',
        'framextv': 'framex',
        'polaris': 's70',
        'aphelion': 's40',
        'darkmatter': 's40',
        'moscow': 's80',
        'novo': 's81',
        'nova': 's30',
        'edmunds': 's3',
        'edmendus': 's3',
        'edmund': 's3',
        'bastion': 's62',
        'orion': 's31',
        'vertex': 's60',
        'corvus': 's61',
        'hallyu': 's63',
        'phoenix': 's71',
        'paris': 's72',
        'quasar': 's12',
        'sirius': 's11',
        'delta': 's50',
        'delta+': 's51',
        'deltaplus': 's51',
        'miller': 's1',
        'mann': 's2',
        'luna': 's4',
        'aditya': 's5',
        'movies4u': 'm4u',
        'm4u': 'm4u',
        'cinepro': 'cinepro',
        'sm_hub': 'sm_hub',
        'smmovies': 'sm_hub',
        'smhub': 'sm_hub',
        'hianime': 'hianime',
        'megaplay': 'hianime',
        'animesalt': 'animesalt',
        'anime': 'animesalt',
        'asiaflix': 'asiaflix',
        'kisskh': 'kisskh',
        'filmu': 'filmu',
        'vidbolt': 'vidbolt',
        'vidy': 'vidy',
        'cinezo': 'cinezo',
        'vidrift': 'vidrift'
    };
    return map[lower] || lower;
}


// ==========================================
// 🚀 VIDLINK PRO NATIVE DECRYPTOR
// ==========================================
const VIDLINK_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';
const VIDLINK_KEY = Buffer.from(VIDLINK_KEY_HEX, 'hex');
const VIDLINK_NONCE = Buffer.alloc(24, 0);

export function encryptVidlinkToken(mediaId: string | number): string {
    const timestamp = Math.floor(Date.now() / 1000) + 480;
    const mediaIdBuf = Buffer.from(String(mediaId), 'utf-8');
    const tsBuf = Buffer.alloc(8);
    tsBuf.writeBigInt64BE(BigInt(timestamp));
    const message = Buffer.concat([mediaIdBuf, tsBuf]);
    const encrypted = nacl.secretbox(message, VIDLINK_NONCE, VIDLINK_KEY);
    const fullPayload = Buffer.concat([VIDLINK_NONCE, Buffer.from(encrypted)]);
    return fullPayload.toString('base64url').replace(/=/g, '');
}

export async function scrapeVidlinkStream(params: {
    tmdbId: string | number;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
}): Promise<any> {
    try {
        const token = encryptVidlinkToken(params.tmdbId);
        const url = params.type === 'tv'
            ? `https://vidlink.pro/api/b/tv/${token}/${params.season || 1}/${params.episode || 1}?multiLang=1`
            : `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;

        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                'Origin': 'https://vidlink.pro',
                'Referer': 'https://vidlink.pro/'
            },
            timeout: 8000
        });

        if (res.data && res.data.stream) {
            const st = res.data.stream;
            const sources: any[] = [];
            if (st.playlist) {
                sources.push({
                    url: `/stream_proxy.php?url=${encodeURIComponent(st.playlist)}`,
                    rawUrl: st.playlist,
                    quality: 'auto',
                    type: 'application/x-mpegurl',
                    label: 'VidLink HLS (Adaptive)',
                    skipProxy: false
                });
            }
            if (st.qualities) {
                for (const q of Object.keys(st.qualities)) {
                    const item = st.qualities[q];
                    if (item && item.url) {
                        sources.push({
                            url: `/stream_proxy.php?url=${encodeURIComponent(item.url)}`,
                            rawUrl: item.url,
                            quality: q + 'p',
                            type: item.type === 'mp4' || item.url.includes('.mp4') ? 'video/mp4' : 'application/x-mpegurl',
                            label: `VidLink ${q}p (Direct CDN)`,
                            skipProxy: false
                        });
                    }
                }
            }
            const subtitles = (st.captions || []).map((c: any) => ({
                lang: c.language || c.label || 'en',
                url: c.url,
                label: c.label || c.language || 'English'
            }));
            return { success: sources.length > 0, sources, subtitles };
        }
    } catch (e: any) {
        console.warn('[VidLink Scraper Error]:', e?.message || e);
    }
    return { success: false, sources: [], subtitles: [] };
}

/**
 * 🚀 VIDRIFT NATIVE SCRAPER
 * Resolves direct HLS manifests from embed.vidrift.in
 */
export async function scrapeVidriftStream(params: {
    tmdbId: string | number;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
}): Promise<any> {
    try {
        const s = params.season || 1;
        const e = params.episode || 1;
        const embedUrl = params.type === 'tv'
            ? `https://embed.vidrift.in/embed/tv/${params.tmdbId}/${s}/${e}`
            : `https://embed.vidrift.in/embed/movie/${params.tmdbId}`;

        const htmlRes = await axios.get(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
            },
            timeout: 7000
        });

        const match = htmlRes.data.match(/embedMeta\s*=\s*({[\s\S]*?});/);
        if (!match) return { success: false, sources: [], subtitles: [] };

        const meta = JSON.parse(match[1]);
        const token = meta.playbackToken;
        if (!token) return { success: false, sources: [], subtitles: [] };

        const path = params.type === 'tv'
            ? `tv/${params.tmdbId}/${s}/${e}`
            : `movie/${params.tmdbId}`;

        const apiUrl = `https://embed.vidrift.in/api/source/${path}?token=${encodeURIComponent(token)}`;
        const apiRes = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': embedUrl
            },
            timeout: 7000
        });

        if (apiRes.data && apiRes.data.success && Array.isArray(apiRes.data.streams)) {
            const sources: any[] = [];
            for (const st of apiRes.data.streams) {
                const streamUrl = st.proxyUrl || st.url;
                if (streamUrl) {
                    sources.push({
                        url: `/stream_proxy.php?url=${encodeURIComponent(streamUrl)}`,
                        rawUrl: streamUrl,
                        quality: st.maxRes ? `${st.maxRes}p` : '1080p',
                        type: 'application/x-mpegurl',
                        label: `Vidrift ${st.provider || 'HLS'} (${st.quality || 'HD'})`,
                        provider: st.provider,
                        skipProxy: false
                    });
                }
            }
            const subtitles = (apiRes.data.subtitles || []).map((c: any) => ({
                lang: c.lang || c.label || 'en',
                url: c.url?.startsWith('http') ? c.url : `https://embed.vidrift.in${c.url}`,
                label: c.label || 'English'
            }));
            return {
                success: sources.length > 0,
                sources,
                subtitles,
                primaryM3u8: sources[0]?.url
            };
        }
    } catch (e: any) {
        console.warn('[Vidrift Scraper Error]:', e?.message || e);
    }
    return { success: false, sources: [], subtitles: [] };
}

/**
 * 🚀 FILMU / VIDLY NATIVE CIPHER SCRAPER
 * Decrypts Next.js sealed streams from embed.filmu.in / vidly.pro
 */
const FILMU_KEY = "vY7#qL2!mZ9@wK4$";

export function decryptFilmuPayload(payload: string): any {
    if (!payload || !payload.startsWith("v1.")) throw new Error("bad payload");
    const base64 = payload.slice(3).replace(/-/g, "+").replace(/_/g, "/");
    const raw = Buffer.from(base64, 'base64');
    const s = raw.subarray(0, 12);
    const n = Buffer.from(raw.subarray(12));

    const keys = (function(nonce: Buffer) {
        const t: number[] = [];
        for (let sIdx = 0; sIdx < 4; sIdx++) {
            let num = (0x811c9dc5 ^ 0x9e3779b9 * sIdx) >>> 0;
            for (let i = 0; i < FILMU_KEY.length; i++) num = Math.imul(num ^ FILMU_KEY.charCodeAt(i), 0x1000193) >>> 0;
            for (let i = 0; i < nonce.length; i++) num = Math.imul(num ^ nonce[i], 0x1000193) >>> 0;
            t.push(num);
        }
        return t;
    })(s);

    let [k0, k1, k2, k3] = keys;
    let r = 0;
    for (let t = 0; t < n.length; t++) {
        if ((3 & t) === 0) {
            k2 >>>= 0; k3 >>>= 0;
            let sum = ((k0 >>>= 0) + (k1 >>>= 0)) | 0;
            k0 = k1 ^ (k1 >>> 9);
            k1 = (k2 + (k2 << 3)) | 0;
            k2 = ((k2 << 21 | k2 >>> 11) + (sum = (sum + (k3 = (k3 + 1) | 0)) | 0)) | 0;
            r = sum >>> 0;
        }
        n[t] ^= (r >>> ((3 & t) * 8)) & 255;
    }

    return JSON.parse(n.toString('utf-8'));
}

export async function scrapeFilmuStream(params: {
    tmdbId: string | number;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
}): Promise<any> {
    try {
        const s = params.season || 1;
        const e = params.episode || 1;
        const targetUrl = params.type === 'tv'
            ? `https://vidly.pro/tv/${params.tmdbId}/${s}/${e}`
            : `https://vidly.pro/movie/${params.tmdbId}`;

        const res = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                'Referer': 'https://embed.filmu.in/'
            },
            timeout: 8000
        });

        const match = res.data.match(/sealed\\?":\\?"(v1\.[^\\"]+)/);
        if (!match) return { success: false, sources: [], subtitles: [] };

        const decrypted = decryptFilmuPayload(match[1]);
        if (!decrypted || !Array.isArray(decrypted.streams)) {
            return { success: false, sources: [], subtitles: [] };
        }

        const sources: any[] = [];
        for (const st of decrypted.streams) {
            if (st.url && !st.url.includes('tiles')) {
                sources.push({
                    url: `/stream_proxy.php?url=${encodeURIComponent(st.url)}`,
                    rawUrl: st.url,
                    quality: st.quality || '1080p',
                    type: 'application/x-mpegurl',
                    label: `Filmu ${decrypted.provider?.label || st.label || 'Direct HLS'}`,
                    provider: decrypted.provider?.id || 'filmu',
                    skipProxy: false
                });
            }
        }

        const subtitles = (decrypted.subtitles || []).map((c: any) => ({
            lang: c.lang || c.label || 'en',
            url: c.url,
            label: c.label || 'English'
        }));

        return {
            success: sources.length > 0,
            sources,
            subtitles,
            primaryM3u8: sources[0]?.url
        };
    } catch (e: any) {
        console.warn('[Filmu Scraper Error]:', e?.message || e);
    }
    return { success: false, sources: [], subtitles: [] };
}

export const BINGR_SERVERS: BingrServerCluster[] = [
    { id: 'vidlink', name: 'VidLink Pro (Decrypted 1080p / Direct CDN)', cc: 'US', priority: 1 },
    { id: 'm4u', name: 'Movie 4U (Movies4u / Acek CDN)', cc: 'IN', priority: 1 },
    { id: 'vidrift', name: 'Vidrift (Decrypted Multi-Provider HLS)', cc: 'IN', priority: 2 },
    { id: 'filmu', name: 'Filmu / Vidly (Native HLS / Decrypted Stream)', cc: 'IN', priority: 2 },
    { id: 's62', name: 'Bastion (Multi-Audio HLS / Fast Direct)', cc: 'IN', priority: 3 },
    { id: 's70', name: 'Polaris (Multi-Language Dubs / HLS)', cc: 'US', priority: 4 },
    { id: 's30', name: 'Nova (Direct Fast HLS)', cc: 'US', priority: 5 },
    { id: 's80', name: 'Moscow (Fast Direct HLS / StreamRip)', cc: 'US', priority: 6 },
    { id: 's31', name: 'Orion (Worker CDN Direct)', cc: 'US', priority: 7 },
    { id: 'sm_hub', name: 'SM Movie Hub Pro (Direct VOD/MKV/Dual Audio)', cc: 'BD', priority: 8 },
    { id: 'framex', name: 'FrameX TV (Multi-Source 4K/1080p Movies, TV & Anime)', cc: 'US', priority: 9 },
    { id: 's81', name: 'Novo (Direct StreamRip / High-Speed HLS)', cc: 'US', priority: 10 },
    { id: 's40', name: 'Aphelion (DarkMatter / Dedicated TV Series HLS)', cc: 'GL', priority: 11 },
    { id: 's3', name: 'Edmunds (High Reliability Proxy / 1080p)', cc: 'US', priority: 12 },
    { id: 's60', name: 'Vertex (Direct CDN)', cc: 'US', priority: 13 },
    { id: 's63', name: 'Hallyu (Asian & International HLS)', cc: 'KR', priority: 14 },
    { id: 's61', name: 'Corvus (Multi-Source Hub / 1080p)', cc: 'US', priority: 15 },
    { id: 'cinepro', name: 'CinePro Core (OMSS Multi-Provider 4K/1080p)', cc: 'US', priority: 16 },
    { id: 'bing_anime', name: 'Bing Anime (Multi-Audio HLS / Nexa & Ravok Direct)', cc: 'JP', priority: 16 },
    { id: 'hianime', name: 'HiAnime (MegaPlay Anime Scraper)', cc: 'JP', priority: 17 },
    { id: 'animesalt', name: 'AnimeSalt (Special Anime Scraper)', cc: 'JP', priority: 18 },
    { id: 'asiaflix', name: 'Asiaflix (Vidmoly Multi-Bitrate HLS)', cc: 'KR', priority: 19 },
    { id: 'kisskh', name: 'KissKH (Asian Drama & Anime)', cc: 'JP', priority: 20 },
    { id: 'cinezo', name: 'Cinezo (Player Cinezo Multi-Audio)', cc: 'FR', priority: 22 },
    { id: 'vidbolt', name: 'Vidbolt (Vidbolt Embed Streamer)', cc: 'US', priority: 23 },
    { id: 'vidy', name: 'Vidy (Vidy.st Direct Embed)', cc: 'US', priority: 24 },
    { id: 's71', name: 'Phoenix (US Cluster)', cc: 'US', priority: 26 },
    { id: 's72', name: 'Paris (IT Cluster)', cc: 'IT', priority: 27 },
    { id: 's50', name: 'Delta (US Cluster)', cc: 'US', priority: 28 },
    { id: 's51', name: 'Delta+ (IN Cluster)', cc: 'IN', priority: 29 },
    { id: 's12', name: 'Quasar (GL Cluster)', cc: 'GL', priority: 30 },
    { id: 's11', name: 'Sirius (GL Cluster)', cc: 'GL', priority: 31 },
    { id: 's1', name: 'Miller (US Cluster)', cc: 'US', priority: 32 },
    { id: 's2', name: 'Mann (US Cluster)', cc: 'US', priority: 33 },
    { id: 's4', name: 'Luna (US Cluster)', cc: 'US', priority: 34 },
    { id: 's5', name: 'Aditya (IN Cluster)', cc: 'IN', priority: 35 }
];

// In-memory stream and details cache
const STREAM_CACHE = new Map<string, { timestamp: number; result: BingrScrapeResult }>();
const DETAILS_CACHE = new Map<string, { timestamp: number; data: BingrMediaDetails }>();
const CACHE_TTL_STREAM = 10 * 60 * 1000; // 10 minutes
const CACHE_TTL_DETAILS = 60 * 60 * 1000; // 1 hour

/**
 * Deep check to detect if a manifest is actually just storyboard thumbnail scrub tiles (.vtt / spritesheet)
 * Note: Genuine DarkMatter/Fetchbox video streams name their MPEG-TS chunks .jpg/.png or playlist tiles.m3u8,
 * which are real 1080p video streams with 0x47 sync bytes and must NEVER be rejected here.
 */
export async function isStoryboardStream(url: string): Promise<boolean> {
    if (!url) return false;
    const lower = url.toLowerCase();
    // Only reject pure sprite/vtt thumbnail tracks (e.g. spritesheet.jpg or scrubber.vtt)
    if (lower.includes('thumbnails.vtt') || lower.includes('spritesheet') || lower.includes('sprite.vtt')) {
        return true;
    }
    return false;
}

/**
 * Fast stream probe to verify upstream is alive and returns HTTP 200..399
 */
export async function verifyStreamReachable(url: string, timeoutMs: number = 2500): Promise<boolean> {
    if (!url) return false;
    let target = url;
    if (url.startsWith('/api/') || url.startsWith('/')) {
        try {
            const parsed = new URL(url, 'http://localhost:3000');
            const inner = parsed.searchParams.get('url') || parsed.searchParams.get('u');
            if (inner && inner.startsWith('http')) {
                target = inner;
            } else {
                return true;
            }
        } catch {
            return true;
        }
    }
    if (!target.startsWith('http')) return false;

    if (
        target.includes('reelvault') || 
        target.includes('vidrift') || 
        target.includes('hakunaymatata') || 
        target.includes('hakunamatata') || 
        target.includes('rousav') || 
        target.includes('animecurx')
    ) {
        return true;
    }

    const headers = getCdnHeaders(target);
    let extraApiKey: string | undefined;
    if (target.includes('filmu.in') && target.includes('/proxy/')) {
        try {
            extraApiKey = await getMegaPlayToken();
        } catch (_) {}
    }

    return new Promise((resolve) => {
        try {
            const u = new URL(target);
            const isHttps = u.protocol === 'https:';
            const client = isHttps ? https : http;

            const req = client.request({
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + u.search,
                method: 'GET',
                headers: {
                    'User-Agent': headers.userAgent,
                    ...(headers.referer ? { 'Referer': headers.referer } : {}),
                    ...(headers.origin ? { 'Origin': headers.origin } : {}),
                    ...(extraApiKey ? { 'x-api-key': extraApiKey } : {}),
                    ...(!u.pathname.endsWith('.m3u8') ? { 'Range': 'bytes=0-1024' } : {}),
                    'Accept': '*/*'
                },
                timeout: timeoutMs
            }, (res) => {
                const code = res.statusCode || 0;
                res.destroy();
                resolve((code >= 200 && code < 400) || code === 416 || code === 429);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        } catch {
            resolve(false);
        }
    });
}

export interface BingrCastMember {
    id?: number;
    name: string;
    character: string;
    photo?: string;
}

export interface BingrMediaDetails {
    id: number;
    type: 'movie' | 'tv';
    title: string;
    year?: string;
    poster?: string;
    backdrop?: string;
    backdrop_original?: string;
    rating?: number;
    overview?: string;
    runtime?: number;
    genres?: Array<{ id: number; name: string } | string>;
    certification?: string;
    director?: string;
    directors?: string[];
    cast?: BingrCastMember[];
    seasons?: Array<{ season: number; episodes: number }>;
    release_date?: string;
    status?: string;
    trailer?: string;
}

export interface BingrEpisode {
    episode: number;
    title: string;
    overview?: string;
    still?: string;
    air_date?: string;
    rating?: number;
}

export interface BingrStreamSource {
    url: string;
    quality: string;
    type: string;
    label?: string;
    name?: string;
    language?: string;
    rawUrl?: string;
    directUrl?: string;
    referrer?: string;
    proxyUrl?: string;
    skipProxy?: boolean;
    headers?: Record<string, string>;
    audioTracks?: any[];
}

export interface BingrScrapeResult {
    success: boolean;
    type: 'movie' | 'tv' | 'anime';
    tmdbId: number;
    title?: string;
    year?: string;
    season?: number;
    episode?: number;
    serverId?: string;
    serverName?: string;
    scraperName?: string;
    primaryM3u8?: string;
    quality?: string;
    sources: BingrStreamSource[];
    subtitles?: Array<{ lang: string; url: string; label?: string }>;
    attempts?: Array<{ serverId: string; serverName: string; status: string; latencyMs: number; error?: string }>;
    fallbackEmbeds?: string[];
    fallbackNote?: string;
    error?: string;
    expectedDurationMinutes?: number;
    streamDurationMinutes?: number;
    streamDurationSec?: number;
    duration?: number;
    audioTracks?: Array<{ index: number; streamIndex: number; codec: string; language: string; label: string }>;
}

const BINGR_API_BASE = 'https://api.bingr.one/api';

/**
 * Universal HTTPS request with Bingr anti-bot and Origin/Referer bypass headers
 */
export function bingrRequest<T = any>(pathname: string, options: {
    method?: string;
    body?: any;
    referer?: string;
    origin?: string;
    timeout?: number;
} = {}): Promise<{ status: number; data: T }> {
    return new Promise((resolve, reject) => {
        const fullUrl = pathname.startsWith('http') ? pathname : `${BINGR_API_BASE}${pathname}`;
        const u = new URL(fullUrl);
        const postData = options.body ? JSON.stringify(options.body) : null;
        
        const defaultOrigin = options.referer ? new URL(options.referer).origin : 'https://bingr.one';
        const req = https.request({
            hostname: u.hostname,
            port: 443,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': options.referer || 'https://bingr.one/',
                'Origin': options.origin || defaultOrigin,
                'Accept': 'application/json, text/plain, */*',
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

export const TMDB_KEYS: string[] = [
    '844dba0bfd8f3a231a957b6e07a10be8',
    '9d83476d2e27f56748167514c69cd2b4',
    '15d2ea6d0dc1d476efbca3eba2b9bbfb',
    'a07e22bc18f5cb106bfe4cc1f83ad8ed'
];

let rotatingTmdbKeyIdx = 0;

export function getTmdbKeys(): string[] {
    return TMDB_KEYS;
}

export function getRotatingTmdbKey(): string {
    const key = TMDB_KEYS[rotatingTmdbKeyIdx % TMDB_KEYS.length];
    rotatingTmdbKeyIdx = (rotatingTmdbKeyIdx + 1) % TMDB_KEYS.length;
    return key;
}

export const ROTATING_TMDB_KEYS = TMDB_KEYS;

/**
 * Resolve IMDb ID (tt...) to TMDB ID using rotating keys
 */
export async function resolveImdbToTmdbId(imdbId: string): Promise<{ tmdbId: number; type: 'movie' | 'tv'; title?: string; year?: string } | null> {
    if (!imdbId || typeof imdbId !== 'string' || !imdbId.trim().startsWith('tt')) return null;
    const cleanImdb = imdbId.trim();
    for (let attempt = 0; attempt < ROTATING_TMDB_KEYS.length; attempt++) {
        const apiKey = getRotatingTmdbKey();
        try {
            const url = `https://api.themoviedb.org/3/find/${cleanImdb}?api_key=${apiKey}&external_source=imdb_id`;
            const res = await axios.get(url, { timeout: 4000, httpsAgent: tmdbAgent });
            if (res.data?.movie_results && res.data.movie_results.length > 0) {
                const mov = res.data.movie_results[0];
                return {
                    tmdbId: mov.id,
                    type: 'movie',
                    title: mov.title,
                    year: (mov.release_date || '').slice(0, 4)
                };
            }
            if (res.data?.tv_results && res.data.tv_results.length > 0) {
                const tv = res.data.tv_results[0];
                return {
                    tmdbId: tv.id,
                    type: 'tv',
                    title: tv.name || tv.title,
                    year: (tv.first_air_date || '').slice(0, 4)
                };
            }
        } catch (_) {}
    }
    return null;
}

/**
 * Search Movies & TV Shows via Bingr / TMDB Gateway
 */
export async function searchBingr(query: string): Promise<any> {
    if (!query || !query.trim()) return { results: [] };
    const clean = query.trim();

    // Direct numeric TMDB ID check
    if (/^\d+$/.test(clean)) {
        try {
            const movie = await getMovieDetails(clean);
            if (movie && movie.id) return { results: [movie], isDirectTmdb: true };
        } catch {}
        try {
            const tv = await getTvDetails(clean);
            if (tv && tv.id) return { results: [tv], isDirectTmdb: true };
        } catch {}
    }

    let results: any[] = [];
    try {
        const res = await bingrRequest(`/search?q=${encodeURIComponent(clean)}`);
        const data = res.data || { results: [] };
        if (Array.isArray(data.results)) {
            results = data.results;
        }
    } catch (_) {}

    // Fallback: If Bingr gateway returned 0 results, query TMDB multi-search directly using working keys
    if (results.length === 0) {
        for (let attempt = 0; attempt < ROTATING_TMDB_KEYS.length; attempt++) {
            const apiKey = getRotatingTmdbKey();
            try {
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(clean)}&include_adult=false`, {
                    timeout: 4000,
                    httpsAgent: tmdbAgent
                });
                if (tmdbRes.data?.results && Array.isArray(tmdbRes.data.results) && tmdbRes.data.results.length > 0) {
                    for (const r of tmdbRes.data.results) {
                        if (r.media_type === 'person') continue;
                        results.push({
                            id: r.id,
                            title: r.title || r.name || 'Untitled',
                            name: r.name || r.title,
                            type: r.media_type || (r.title ? 'movie' : 'tv'),
                            year: (r.release_date || r.first_air_date || '').slice(0, 4),
                            poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : undefined,
                            backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
                            overview: r.overview,
                            rating: r.vote_average,
                            vote_count: r.vote_count
                        });
                    }
                    break;
                }
            } catch (_) {}
        }
    }

    // Ensure One Piece Anime (TMDB 37854) is present when searching One Piece
    if (/one\s*piece/i.test(clean)) {
        const isLiveActionSpecific = /\b(live action|live-action|netflix|2023)\b/i.test(clean);
        const hasAnime = results.some((r: any) => r.id === 37854);
        if (!hasAnime) {
            try {
                const animeDetails = await getTvDetails(37854);
                if (animeDetails && animeDetails.id) {
                    const animeItem = {
                        id: 37854,
                        title: 'One Piece (Anime)',
                        year: '1999',
                        type: 'tv',
                        poster: animeDetails.poster || 'https://image.tmdb.org/t/p/w500/cMD9Ygz11yj5GvEi4O269vDp8um.jpg',
                        overview: animeDetails.overview || 'Years ago, the fearsome Pirate King Gol D. Roger was executed leaving behind the famed "One Piece" treasure.',
                        rating: animeDetails.rating || 8.7
                    };
                    if (isLiveActionSpecific) {
                        results.push(animeItem);
                    } else {
                        results.unshift(animeItem);
                    }
                }
            } catch {}
        }
    }

    return { results };
}

/**
 * Get Movie Details and full Cast/Character list
 */
export async function getMovieDetails(tmdbId: number | string): Promise<BingrMediaDetails> {
    const cacheKey = `movie:${tmdbId}`;
    const cached = DETAILS_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_DETAILS)) {
        return cached.data;
    }
    const res = await bingrRequest<BingrMediaDetails>(`/details/movie/${tmdbId}`);
    if (res.status !== 200 || !res.data) {
        throw new Error(`Movie not found for TMDB ID: ${tmdbId}`);
    }
    DETAILS_CACHE.set(cacheKey, { timestamp: Date.now(), data: res.data });
    return res.data;
}

/**
 * Get TV Series Details and full Cast/Character list
 */
export async function getTvDetails(tmdbId: number | string): Promise<BingrMediaDetails> {
    const cacheKey = `tv:${tmdbId}`;
    const cached = DETAILS_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_DETAILS)) {
        return cached.data;
    }
    const res = await bingrRequest<BingrMediaDetails>(`/details/tv/${tmdbId}`);
    if (res.status !== 200 || !res.data) {
        throw new Error(`TV Show not found for TMDB ID: ${tmdbId}`);
    }
    DETAILS_CACHE.set(cacheKey, { timestamp: Date.now(), data: res.data });
    return res.data;
}

/**
 * Get Season Episodes
 */
export async function getTvEpisodes(tmdbId: number | string, seasonNumber: number | string): Promise<BingrEpisode[]> {
    const res = await bingrRequest<{ episodes: BingrEpisode[] }>(`/episodes/${tmdbId}/${seasonNumber}`);
    if (res.status !== 200 || !res.data?.episodes) {
        throw new Error(`Episodes not found for TMDB ID ${tmdbId} Season ${seasonNumber}`);
    }
    return res.data.episodes;
}

/**
 * Smart TMDB Matcher: Given an arbitrary title/name from Stalker or M3U, find the best TMDB match
 */
export async function findTmdbMatch(
    rawTitle: string,
    expectedType: 'movie' | 'tv' = 'movie',
    yearHint?: string | number
): Promise<{ id: number; title: string; year?: string; details?: BingrMediaDetails } | null> {
    if (!rawTitle) return null;

    // Check if rawTitle contains a direct numeric ID
    if (/^\d+$/.test(rawTitle.trim())) {
        const numId = parseInt(rawTitle.trim(), 10);
        try {
            const details = expectedType === 'tv' ? await getTvDetails(numId) : await getMovieDetails(numId);
            return { id: details.id, title: details.title, year: details.year, details };
        } catch {}
    }

    // 1. Check for explicit bracketed or parenthesized year, e.g. "Fight Club (1999)" or "[2021]"
    let extractedYear: string | undefined = yearHint ? String(yearHint).trim() : undefined;
    const parenYearMatch = rawTitle.match(/\((?:19\d{2}|20[0-2]\d)\)|\[(?:19\d{2}|20[0-2]\d)\]/);
    if (!extractedYear && parenYearMatch) {
        extractedYear = parenYearMatch[0].replace(/[\[\]\(\)]/g, '');
    }

    // 2. Known titles where a 4-digit number is intrinsically part of the title, NEVER treat as a release year
    const isTitleWithNumber = /\b(2001|2010|2012|2049|2077|1917|1984|300|2000|1941|1942|1408)\b/i.test(rawTitle);

    // 3. If year not yet found and not an intrinsic numbered title, check for trailing or standalone release year
    if (!extractedYear && !isTitleWithNumber) {
        const trailingYearMatch = rawTitle.match(/\b(19\d{2}|20[0-2]\d)\b/);
        if (trailingYearMatch) {
            extractedYear = trailingYearMatch[1];
        }
    }

    // 4. Clean up title: remove bracketed text, release tags, qualities, languages, etc.
    let clean = rawTitle
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/\b(https?:\/\/\S+|www\.\S+)\b/gi, '')
        // Strip season and episode codes
        .replace(/\bS\d{1,2}(?:\s*E\d{1,2})?\b/gi, '')
        .replace(/\b(?:Season|Series|Episode|Ep)\s*\d+\b/gi, '')
        .replace(/\bE\d{1,3}\b/gi, '')
        // Strip audio/video formats & resolutions
        .replace(/\b(4K|UHD|FHD|HD|1080p?|720p?|480p?|2160p?|WEB-?DL|WEBRip|Blu-?Ray|BRRip|BDRip|HDTV|DVDRip|REMUX|PROPER|REPACK|HDR\d*|HEVC|x264|x265|H\.?264|H\.?265|10bit|AV1)\b/gi, '')
        // Strip audio channels and codecs
        .replace(/\b(AAC\d*|AC3|DDP\d*(\.\d*)?|Dolby|Atmos|TrueHD|5\.1|7\.1|Dual\s*Audio|Multi\s*Audio)\b/gi, '')
        // Strip languages & dubs
        .replace(/\b(Hindi|English|Tamil|Telugu|Kannada|Malayalam|Bengali|Marathi|Punjabi|Gujarati|Dubbed|Org|Subbed|Eng\s*Sub)\b/gi, '')
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // If we extracted a verified release year AND it is not an intrinsic numbered title, strip it from clean search title
    if (extractedYear && !isTitleWithNumber) {
        clean = clean.replace(new RegExp(`\\b${extractedYear}\\b`, 'g'), '').trim();
    }

    if (!clean) clean = rawTitle.replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();

    try {
        let searchRes = await searchBingr(clean);
        let results: any[] = searchRes?.results || [];

        // Fallback 1: If 0 results and clean differs from rawTitle, try searching rawTitle without punctuation
        if (results.length === 0 && clean.toLowerCase() !== rawTitle.toLowerCase()) {
            const rawSimple = rawTitle.replace(/[\[\]\(\)._-]/g, ' ').replace(/\s+/g, ' ').trim();
            const fallbackRes = await searchBingr(rawSimple);
            results = fallbackRes?.results || [];
        }

        // Fallback 2: If still 0 results and we have an extractedYear, try searching clean without year constraint
        if (results.length === 0 && extractedYear) {
            const unconstrainedRes = await searchBingr(clean);
            results = unconstrainedRes?.results || [];
        }

        if (results.length === 0) return null;

        // Score results
        let bestMatch: any = null;
        let bestScore = -999;

        const isAnimeQuery = /\b(anime|animated|animation|japanese|straw hat|luffy|wano|egghead|marineford)\b/i.test(rawTitle) || /\b(anime|animated|animation|japanese|straw hat|luffy|wano|egghead|marineford)\b/i.test(clean);
        const isLiveActionQuery = /\b(live action|live-action|netflix|2023)\b/i.test(rawTitle) || /\b(live action|live-action|netflix|2023)\b/i.test(clean);

        // Priority check for One Piece anime unless live action is explicitly requested
        if (/one\s*piece/i.test(clean)) {
            if (!isLiveActionQuery && (!extractedYear || extractedYear !== '2023')) {
                try {
                    const animeDetails = await getTvDetails(37854);
                    if (animeDetails && animeDetails.id) {
                        return {
                            id: 37854,
                            title: 'One Piece (Anime)',
                            year: '1999',
                            details: animeDetails
                        };
                    }
                } catch {}
            }
        }

        const cleanLower = clean.toLowerCase();

        for (const item of results) {
            let score = 0;
            const itemType = item.type || (item.name ? 'tv' : 'movie');

            // Strictly separate Movies and TV Shows
            if (itemType === expectedType) {
                score += 50;
            } else {
                score -= 150; // Severe penalty for mismatched media type
            }

            const itemTitle = (item.title || item.name || '').toLowerCase();

            // Exact title matching
            if (itemTitle === cleanLower) {
                score += 100;
            } else if (itemTitle.startsWith(cleanLower) || cleanLower.startsWith(itemTitle)) {
                score += 60;
            } else if (itemTitle.includes(cleanLower) || cleanLower.includes(itemTitle)) {
                score += 40;
            }

            // Intrinsic number match (e.g. 2049 in "Blade Runner 2049", 2077 in "Cyberpunk 2077")
            if (isTitleWithNumber) {
                const numMatch = rawTitle.match(/\b(2001|2010|2012|2049|2077|1917|1984|300|2000)\b/);
                if (numMatch && itemTitle.includes(numMatch[1])) {
                    score += 120; // Massive boost for matching the intrinsic title number
                }
            }

            // Year scoring
            const itemYearStr = item.year ? String(item.year).slice(0, 4) : '';
            if (extractedYear && itemYearStr) {
                if (itemYearStr === String(extractedYear)) {
                    score += 60;
                } else {
                    const diff = Math.abs(parseInt(itemYearStr, 10) - parseInt(String(extractedYear), 10));
                    if (diff <= 1) {
                        score += 30; // 1-year tolerance
                    } else {
                        score -= 50; // Penalize wrong release year
                    }
                }
            }

            // Popularity / vote count tie-breaker (boost real blockbusters over zero-vote home videos)
            const votes = Number(item.vote_count || item.rating || 0);
            if (votes > 0) {
                score += Math.min(25, Math.log10(votes + 1) * 8);
            }

            // One Piece differentiation
            if (item.id === 37854 || itemTitle.includes('one piece')) {
                if (item.id === 37854) {
                    if (isAnimeQuery || (!isLiveActionQuery && (!extractedYear || extractedYear === '1999'))) {
                        score += 90;
                    }
                } else if (item.id === 111110) {
                    if (isLiveActionQuery || extractedYear === '2023') {
                        score += 90;
                    } else {
                        score -= 60;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = item;
            }
        }

        if (bestMatch && bestMatch.id && bestScore > 0) {
            return {
                id: bestMatch.id,
                title: bestMatch.title || bestMatch.name,
                year: bestMatch.year,
                details: bestMatch
            };
        }
    } catch (e) {
        console.warn(`[BingrMatcher] Failed search for "${clean}":`, e);
    }

    return null;
}

/**
 * Get Subtitles from Direct VTT CDN / Subtitle Engine
 */
export async function getSubtitles(type: 'movie' | 'tv', tmdbId: number | string, season?: number | string, episode?: number | string): Promise<Array<{ lang: string; url: string; label?: string; source?: string }>> {
    const list: Array<{ lang: string; url: string; label?: string; source?: string }> = [];
    if (!tmdbId) return list;

    try {
        // 1. Direct vdrk.site CDN probe (instant and reliable for TMDB IDs)
        const vdrkEn = `https://cache.vdrk.site/v1/vtt/${type}/${tmdbId}/English.vtt`;
        try {
            const check = await axios.head(vdrkEn, { timeout: 1200 });
            if (check.status === 200) {
                list.push({
                    lang: 'en',
                    label: 'English',
                    url: vdrkEn,
                    source: 'vdrk'
                });
            }
        } catch {}

        // 2. SubtitleService search fallback with fast timeout
        if (list.length === 0) {
            const subs = await SubtitleService.searchSubtitles(tmdbId, undefined, 'en');
            for (const s of subs) {
                list.push({
                    lang: s.language || 'en',
                    label: s.label || 'English',
                    url: s.url,
                    source: 'subtitles'
                });
            }
        }
    } catch {}

    return list;
}


/**
 * Universal Stream Scraper with Server Cascade
 */


const TMDB_RUNTIME_CACHE = new Map<string, { runtime: number; timestamp: number }>();
const TMDB_RUNTIME_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Retrieves expected runtime from TMDB with caching and key rotation
 */
export async function getExpectedRuntime(type: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number): Promise<number> {
    const cacheKey = `${type}_${tmdbId}_${season || 0}_${episode || 0}`;
    const cached = TMDB_RUNTIME_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < TMDB_RUNTIME_CACHE_TTL)) {
        return cached.runtime;
    }

    let expectedRuntime = 0;
    for (let attempt = 0; attempt < ROTATING_TMDB_KEYS.length; attempt++) {
        const apiKey = getRotatingTmdbKey();
        try {
            if (type === 'movie') {
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`, {
                    timeout: 4000,
                    httpsAgent: tmdbAgent
                });
                expectedRuntime = tmdbRes.data?.runtime || 0;
            } else {
                if (season && episode) {
                    try {
                        const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${apiKey}`, {
                            timeout: 4000,
                            httpsAgent: tmdbAgent
                        });
                        expectedRuntime = epRes.data?.runtime || 0;
                    } catch (_) {}
                }
                if (!expectedRuntime) {
                    const showRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}`, {
                        timeout: 4000,
                        httpsAgent: tmdbAgent
                    });
                    if (showRes.data?.episode_run_time && showRes.data.episode_run_time.length > 0) {
                        expectedRuntime = showRes.data.episode_run_time[0];
                    } else if (showRes.data?.runtime) {
                        expectedRuntime = showRes.data.runtime;
                    }
                }
            }
            if (expectedRuntime > 0) {
                break;
            }
        } catch (_) {
            // Try next key if available
        }
    }

    if (expectedRuntime > 0) {
        TMDB_RUNTIME_CACHE.set(cacheKey, { runtime: expectedRuntime, timestamp: Date.now() });
    }
    return expectedRuntime;
}

/**
 * Validates the duration of the M3U8 stream against TMDB expected runtime.
 * Prevents fake/trailer/short loop videos from polluting search and playback.
 */
export async function verifyStreamDuration(
    url: string,
    type: 'movie' | 'tv',
    tmdbId: number,
    season?: number,
    episode?: number,
    isStrict?: boolean
): Promise<{ isValid: boolean; expected?: number; actual?: number; reason?: string }> {
    try {
        if (!url || !url.startsWith('http')) return { isValid: true };

        const expectedRuntime = await getExpectedRuntime(type, tmdbId, season, episode);
        if (expectedRuntime <= 0) {
            // If TMDB runtime is unavailable, allow stream
            return { isValid: true };
        }

        const actualRuntime = await getM3u8Duration(url);
        if (actualRuntime === null) {
            const isSb = await isStoryboardStream(url);
            if (isSb) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    reason: 'Storyboard/thumbnail sprite manifest rejected'
                };
            }
            // For progressive MP4 URLs, probe content-length to reject tiny dummy/preview clips
            if ((url.includes('.mp4') || url.includes('/f/') || url.includes('streamrip.fun')) && expectedRuntime >= 30) {
                try {
                    let probeUrl = url;
                    if (probeUrl.startsWith('/')) {
                        probeUrl = `http://127.0.0.1:3000${probeUrl}`;
                    }
                    const headRes = await axios.head(probeUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://bingr.one/'
                        },
                        timeout: 2500,
                        maxRedirects: 3
                    });
                    const cl = Number(headRes.headers['content-length']);
                    // If content-length is under 35MB for a feature movie (expected >= 45m), it's definitely a dummy/ad clip
                    if (cl > 0 && expectedRuntime >= 45 && cl < 35 * 1024 * 1024) {
                        return {
                            isValid: false,
                            expected: expectedRuntime,
                            reason: `MP4 file size is too small (${Math.round(cl / (1024 * 1024))}MB) for a ${expectedRuntime}m feature film`
                        };
                    }
                } catch (_) {}
            }
            // When upstream CDN protects master playlist with token or live manifest, don't drop legitimate streams
            return { isValid: true, expected: expectedRuntime };
        }

        // Reject fake preview clips, ad loops, trailers, or dummy videos (even if requested strictly)
        const isDummyShort = (expectedRuntime >= 30 && (actualRuntime < 15 || actualRuntime < expectedRuntime * 0.25)) ||
                             (expectedRuntime >= 15 && actualRuntime < 5);
        if (isDummyShort) {
            return {
                isValid: false,
                expected: expectedRuntime,
                actual: actualRuntime,
                reason: `Sample/dummy clip rejected: stream is only ${Math.round(actualRuntime)}m, expected feature of ~${expectedRuntime}m`
            };
        }

        // If user strictly requested this specific server, allow it (provided it's not a dummy clip)
        if (isStrict) {
            return { isValid: true, expected: expectedRuntime, actual: actualRuntime };
        }

        const diff = Math.abs(actualRuntime - expectedRuntime);

        // Feature Film / Movie Scraping (Strict +/- 15 minutes tolerance or 15%)
        if (type === 'movie') {
            // Reject fake 1-12 minute trailer clips pretending to be a full feature
            if (actualRuntime < 12 && expectedRuntime >= 20) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Trailer or sample clip rejected: stream is only ${Math.round(actualRuntime)}m, expected feature film of ~${expectedRuntime}m`
                };
            }
            // Movie tolerance: +/- 35 minutes or 35% (handles theatrical vs director cuts)
            const tolerance = Math.max(35, Math.round(expectedRuntime * 0.35));
            if (diff > tolerance) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Duration mismatch: expected ~${expectedRuntime}m, stream is ${Math.round(actualRuntime)}m (Movie tolerance: +/-${tolerance}m, diff was ${Math.round(diff)}m)`
                };
            }
        } else {
            // TV episode / Anime / Sitcom
            if (actualRuntime < 4) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Teaser clip rejected: stream is only ${Math.round(actualRuntime)}m, expected episode of ~${expectedRuntime}m`
                };
            }
            // Prevent serving a 2-hour full movie when a short episode was requested
            if (expectedRuntime < 40 && actualRuntime > 115) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Wrong media: stream is ${Math.round(actualRuntime)}m, expected short episode of ~${expectedRuntime}m`
                };
            }
            // TV tolerance: +/- 25 minutes or 50% (handles specials, double episodes, Korean drama pacing)
            const tolerance = Math.max(25, Math.round(expectedRuntime * 0.50));
            if (diff > tolerance) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Duration mismatch: expected ~${expectedRuntime}m, stream is ${Math.round(actualRuntime)}m (TV tolerance: +/-${Math.round(tolerance)}m, diff was ${Math.round(diff)}m)`
                };
            }
        }

        return { isValid: true, expected: expectedRuntime, actual: actualRuntime };
    } catch (e: any) {
        return { isValid: true };
    }
}

/**
 * Deep M3U8 duration parser with full anti-bot headers and Master Playlist traversal
 */
export async function getM3u8Duration(url: string, depth = 0): Promise<number | null> {
    if (!url || depth > 3) return null;
    const lower = url.toLowerCase();
    if (lower.includes('thumbnails.vtt') || lower.includes('spritesheet') || lower.includes('sprite.vtt')) {
        return null; // Reject thumbnail sprite tracks
    }

    try {
        let fetchUrl = url;
        if (fetchUrl.startsWith('/')) {
            fetchUrl = `http://127.0.0.1:3000${fetchUrl}`;
        }

        let parsedOrigin = 'https://bingr.one';
        try {
            const parsed = new URL(fetchUrl);
            parsedOrigin = parsed.origin;
        } catch (_) {}

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (fetchUrl.includes('bingr.one') || fetchUrl.includes('api.bingr') || fetchUrl.includes('streamrip.fun')) {
            headers['Referer'] = 'https://bingr.one/';
            headers['Origin'] = 'https://bingr.one';
        }

        const res = await axios.get(fetchUrl, {
            timeout: 6000,
            headers
        });
        const content = res.data;
        if (typeof content !== 'string') return null;

        // 1. Is it a master playlist? (#EXT-X-STREAM-INF)
        if (content.includes('#EXT-X-STREAM-INF')) {
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXT-X-STREAM-INF')) {
                    // Forward scan for the next non-comment URI line
                    for (let j = i + 1; j < lines.length; j++) {
                        const candidate = lines[j].trim();
                        if (!candidate) continue;
                        if (candidate.startsWith('#')) continue;
                        const mediaUrl = candidate.startsWith('http') ? candidate : new URL(candidate, fetchUrl).toString();
                        const dur = await getM3u8Duration(mediaUrl, depth + 1);
                        if (dur !== null && dur > 0) return dur;
                        break;
                    }
                }
            }
            // Fallback: search for any child .m3u8 path
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.includes('/hls/'))) {
                    const mediaUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, fetchUrl).toString();
                    const dur = await getM3u8Duration(mediaUrl, depth + 1);
                    if (dur !== null && dur > 0) return dur;
                }
            }
            return null;
        }

        // Sum #EXTINF segments
        const extinfRegex = /#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/gi;
        let match: RegExpExecArray | null;
        let totalSeconds = 0;
        let segmentCount = 0;
        while ((match = extinfRegex.exec(content)) !== null) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0) {
                totalSeconds += sec;
                segmentCount++;
            }
        }

        // 3. Fallback: Target duration approximation if segments exist but explicit durations are omitted
        if (totalSeconds <= 0 && segmentCount > 0) {
            const targetDurMatch = content.match(/#EXT-X-TARGETDURATION:\s*([0-9]+)/i);
            if (targetDurMatch) {
                const targetSec = parseFloat(targetDurMatch[1]);
                if (!isNaN(targetSec) && targetSec > 0) {
                    totalSeconds = targetSec * segmentCount;
                }
            }
        }

        if (totalSeconds > 0) {
            return totalSeconds / 60; // Minutes
        }
        return null;
    } catch (err: any) {
        return null;
    }
}

export async function scrapeBingrStream(params: {
    type?: 'movie' | 'tv' | 'anime';
    id?: number | string;
    title?: string;
    year?: string | number;
    season?: number;
    episode?: number;
    srv?: string;
    strictSrv?: boolean;
    anilistId?: number | string;
    malId?: number | string;
    nocache?: boolean;
    force?: boolean;
}): Promise<BingrScrapeResult> {
    const isTv = params.type === 'tv' || params.type === 'anime' || (params.type !== 'movie' && (params.season !== undefined || params.episode !== undefined));
    const type: 'movie' | 'tv' | 'anime' = params.type ? params.type : (isTv ? 'tv' : 'movie');
    const strictSrv = !!params.strictSrv;
    let rawIdStr = params.id ? String(params.id).trim() : '';
    let tmdbId = Number(rawIdStr) || 0;
    const requestedTitle = (params.title || '').trim();
    let mediaTitle = requestedTitle;
    let mediaYear = params.year ? String(params.year) : undefined;

    // Direct IMDb ID resolution (e.g. tt3801314 or tt33379543)
    if (rawIdStr.startsWith('tt')) {
        const imdbMatch = await resolveImdbToTmdbId(rawIdStr);
        if (imdbMatch) {
            tmdbId = imdbMatch.tmdbId;
            if (!mediaTitle && imdbMatch.title) mediaTitle = imdbMatch.title;
            if (!mediaYear && imdbMatch.year) mediaYear = imdbMatch.year;
        }
    } else if (!tmdbId && mediaTitle && mediaTitle.trim().startsWith('tt')) {
        const imdbMatch = await resolveImdbToTmdbId(mediaTitle.trim());
        if (imdbMatch) {
            tmdbId = imdbMatch.tmdbId;
            if (imdbMatch.title) mediaTitle = imdbMatch.title;
            if (!mediaYear && imdbMatch.year) mediaYear = imdbMatch.year;
        }
    }

    // If tmdbId is missing, resolve it via search
    if (!tmdbId && mediaTitle) {
        const match = await findTmdbMatch(mediaTitle, type === 'anime' ? 'tv' : type, mediaYear);
        if (match) {
            tmdbId = match.id;
            mediaTitle = match.title;
            if (!mediaYear && match.year) mediaYear = match.year;
        }
    }

    if (!tmdbId && type !== 'anime' && params.srv !== 'bing_anime') {
        return {
            success: false,
            type: type,
            tmdbId: 0,
            title: mediaTitle,
            error: 'Could not resolve TMDB ID for title: ' + mediaTitle,
            sources: []
        };
    }

    // Auto-resolve title, year, and duration runtime from TMDB
    let tmdbRuntimeMinutes: number | undefined;
    try {
        const details = type === 'tv' ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
        if (details) {
            if (!mediaTitle) mediaTitle = details.title;
            if (!mediaYear && details.year) mediaYear = details.year;
            if (details.runtime) tmdbRuntimeMinutes = details.runtime;
        }
    } catch {}

    // Check in-memory stream cache
    const s = isTv ? (params.season !== undefined ? Number(params.season) : 1) : 1;
    const e = isTv ? (params.episode !== undefined ? Number(params.episode) : 1) : 1;
    const cacheKey = `${type}:${tmdbId}:${s}:${e}:${params.srv || 'default'}`;
    const cachedStream = STREAM_CACHE.get(cacheKey);
    if (!params.nocache && !params.force && cachedStream && cachedStream.result && cachedStream.result.success && (Date.now() - cachedStream.timestamp < CACHE_TTL_STREAM)) {
        return { ...cachedStream.result };
    }

    const query: Record<string, any> = {
        title: mediaTitle || '',
        year: mediaYear ? String(mediaYear) : undefined
    };

    if (isTv) {
        query.season = String(s);
        query.episode = String(e);
    }

    let malId: number | null = params.malId ? Number(params.malId) : null;
    let isAnimeConfirmed = Boolean(type === 'anime' || params.anilistId);
    let hasSkipTimes = false;
    let isAnimeLikely = Boolean(
        type === 'anime' ||
        params.anilistId ||
        (params as any).isAnime ||
        (mediaTitle && mediaTitle.match(/naruto|titan|dragon ball|one piece|jujutsu|bleach|hero academia|slayer|hunter|clover|alchemist|evangelion|death note|sword art|ghoul|tokyo|chainsaw|frieren|dandadan|solo leveling|kaiju|boruto|inuyasha|haikyu|basket|detective conan|gintama|steins|dr\.?\s*stone|code geass|fairy tail|vinland|berserk|monster|cowboy bebop|mob psycho|rezero|re:zero|overlord|slime|danmachi|fate|konosuba|blue lock|spy x family|baki/i))
    );

    // Fast check for MAL ID and anime detection for series before scraping (with strict 1200ms timeout)
    if (type === 'tv' && (requestedTitle || mediaTitle)) {
        try {
            malId = await Promise.race([
                resolveMalIdFromTitle(requestedTitle || mediaTitle),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200))
            ]);
            if (!malId && requestedTitle && mediaTitle && requestedTitle !== mediaTitle) {
                malId = await Promise.race([
                    resolveMalIdFromTitle(mediaTitle),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
                ]);
            }
            if (malId) {
                const epNum = params.episode || 1;
                const skipData = await Promise.race([
                    fetchAniSkipTimes(malId, epNum),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
                ]).catch(() => null);
                if (skipData && skipData.found && skipData.results && skipData.results.length > 0) {
                    hasSkipTimes = true;
                }
                isAnimeConfirmed = true;
                isAnimeLikely = true;
                console.log(`[BingrScraper] Series "${mediaTitle}" confirmed as Anime (MAL #${malId}, Intro Skip: ${hasSkipTimes ? 'Yes' : 'Pending'}). HiAnime/KissKH set as 1st priority.`);
            }
        } catch (e: any) {
            // Non-blocking lookup fallback
        }
    }

    const attempts: Array<{ serverId: string; serverName: string; status: string; latencyMs: number; error?: string }> = [];

    // Helper: Resolve a single server cluster at maximum speed
    async function tryServer(serverId: string): Promise<BingrScrapeResult | null> {
        const serverMeta = BINGR_SERVERS.find(srv => srv.id === serverId) || { id: serverId, name: serverId };
        const startTime = Date.now();

        try {
            let scraperName = serverMeta.name;
            let sources: BingrStreamSource[] = [];
            let subtitles: Array<{ lang: string; url: string; label?: string }> = [];
            let probeDurationSec: number | undefined = undefined;
            let upstreamDurationSec: number | undefined = undefined;
            let probeAudioTracks: any[] = [];

            if (serverId === 'bing_anime') {
                scraperName = 'Bing Anime (Multi-Audio HLS & NexaDirect)';
                const effectiveTitle = requestedTitle || mediaTitle || '';
                let anilistIdNum = params.anilistId ? Number(params.anilistId) : (type === 'anime' && tmdbId ? tmdbId : undefined);
                let malIdNum = malId;

                // 1. If anilistId or malId not provided, search HiAnime / AniList catalog
                if (!anilistIdNum && effectiveTitle) {
                    try {
                        const token = await getMegaPlayToken();
                        const searchRes = await axios.get(`https://hianime.filmu.in/search?q=${encodeURIComponent(effectiveTitle)}`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                                'Referer': 'https://bingr.one/',
                                'Origin': 'https://bingr.one',
                                ...(token ? { 'x-api-key': token } : {})
                            },
                            timeout: 5000
                        });
                        const results = searchRes.data?.results || [];
                        if (results.length > 0) {
                            let match = results[0];
                            if (s > 1) {
                                const sMatch = results.find((r: any) => 
                                    (r.title && (r.title.toLowerCase().includes(`season ${s}`) || r.title.toLowerCase().includes(`${s}nd season`) || r.title.toLowerCase().includes(`${s}rd season`) || r.title.toLowerCase().includes(`${s}th season`))) ||
                                    (r.titleRomaji && (r.titleRomaji.toLowerCase().includes(`season ${s}`) || r.titleRomaji.toLowerCase().includes(`${s}nd season`) || r.titleRomaji.toLowerCase().includes(`${s}rd season`) || r.titleRomaji.toLowerCase().includes(`${s}th season`)))
                                );
                                if (sMatch) match = sMatch;
                            }
                            anilistIdNum = match.id;
                            if (match.malId && !malIdNum) malIdNum = match.malId;
                        }
                    } catch (e: any) {
                        console.warn('[BingrAnime] Search lookup notice:', e.message);
                    }
                }

                // Step A: First attempt AnimeSalt Multi-Audio stream (highest fidelity with up to 5 language tracks)
                try {
                    const token = await getMegaPlayToken();
                    const saltTitle = effectiveTitle.replace(/\s*Season\s*\d+/i, '').trim();
                    const saltRes = await axios.get(`https://hianime.filmu.in/animesalt/streams?title=${encodeURIComponent(saltTitle)}&ep=${e}&season=${s}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                            'Referer': 'https://bingr.one/',
                            'Origin': 'https://bingr.one',
                            ...(token ? { 'x-api-key': token } : {})
                        },
                        timeout: 7000
                    });

                    if (saltRes.data?.streams && saltRes.data.streams.length > 0) {
                        const sItem = saltRes.data.streams[0];
                        const upstreamProxyUrl = sItem.proxyUrl || `https://hianime.filmu.in/proxy/m3u8?url=${encodeURIComponent(sItem.url)}&referer=${encodeURIComponent(sItem.referer || 'https://animesalt.cx/')}`;
                        const localPlayUrl = `/stream_proxy.php?url=${encodeURIComponent(upstreamProxyUrl)}`;

                        sources.push({
                            url: localPlayUrl,
                            rawUrl: sItem.url,
                            directUrl: sItem.url,
                            referrer: sItem.referer || 'https://animesalt.cx/',
                            proxyUrl: localPlayUrl,
                            quality: `${sItem.quality || 1080}p`,
                            type: 'application/x-mpegurl',
                            label: 'AnimeSalt Multi-Audio (5 Tracks: JPN/ENG/HIN/TAM/TEL)',
                            name: 'Bing Anime | Multi-Audio HLS'
                        });

                        if (sItem.subtitles && Array.isArray(sItem.subtitles)) {
                            subtitles = sItem.subtitles.map((sub: any) => ({
                                lang: sub.lang || 'en',
                                label: sub.label || 'English',
                                url: `/stream_proxy.php?url=${encodeURIComponent(sub.url)}`
                            }));
                        }
                        scraperName = 'Bing Anime (AnimeSalt Multi-Audio)';
                    }
                } catch (e: any) {
                    console.warn('[BingrAnime] AnimeSalt attempt notice:', e.message);
                }

                // Step B: If AnimeSalt had no streams, cascade to MegaPlay AniPM Sub & Dub
                if (sources.length === 0 && (anilistIdNum || malIdNum)) {
                    try {
                        const megaSub = await scrapeMegaPlayAnime({
                            anilistId: anilistIdNum || undefined,
                            malId: malIdNum || undefined,
                            episode: e,
                            type: 'sub'
                        });
                        const megaDub = await scrapeMegaPlayAnime({
                            anilistId: anilistIdNum || undefined,
                            malId: malIdNum || undefined,
                            episode: e,
                            type: 'dub'
                        });

                        if (megaSub.success && megaSub.sources.length > 0) {
                            sources.push({
                                ...megaSub.sources[0],
                                label: 'MegaPlay (Japanese Sub)',
                                name: 'Bing Anime | Japanese Sub'
                            });
                        }
                        if (megaDub.success && megaDub.sources.length > 0) {
                            sources.push({
                                ...megaDub.sources[0],
                                label: 'MegaPlay (English Dub)',
                                name: 'Bing Anime | English Dub'
                            });
                        }

                        if (sources.length > 0) {
                            scraperName = 'Bing Anime (MegaPlay AniPM HLS)';
                            const activeMeta = megaSub.success ? megaSub : megaDub;
                            if (activeMeta.subtitles && activeMeta.subtitles.length > 0) {
                                subtitles = activeMeta.subtitles.map(sub => ({
                                    ...sub,
                                    url: `/stream_proxy.php?url=${encodeURIComponent(sub.url)}`
                                }));
                            }
                        }
                    } catch (e: any) {
                        console.warn('[BingrAnime] MegaPlay AniPM attempt notice:', e.message);
                    }
                }

                // Step C: Fallback to FrameX TV if still no streams
                if (sources.length === 0) {
                    try {
                        const fxRes = await scrapeFrameXStream({
                            id: tmdbId || undefined,
                            type: 'anime',
                            season: s,
                            episode: e,
                            title: effectiveTitle,
                            malId: malIdNum || undefined
                        });
                        if (fxRes.success && fxRes.sources.length > 0) {
                            scraperName = `Bing Anime (FrameX Fallback)`;
                            sources = fxRes.sources.map((src: any) => ({
                                url: src.url,
                                rawUrl: src.url,
                                proxyUrl: src.url,
                                quality: src.quality || '1080p',
                                type: src.type || 'application/x-mpegurl',
                                label: src.label || 'FrameX Stream',
                                name: src.name || 'Bing Anime | FrameX'
                            }));
                            subtitles = fxRes.subtitles || [];
                        }
                    } catch (e: any) {
                        console.warn('[BingrAnime] FrameX fallback notice:', e.message);
                    }
                }
            } else if (serverId === 'megaplay' || serverId === 'hianime' || serverId === 'hianime_dub' || serverId === 'megaplay_dub') {
                const isDubReq = serverId.includes('dub') || (params as any).dub === true || (params as any).type === 'dub';
                if (!malId && (requestedTitle || mediaTitle)) {
                    try {
                        malId = await resolveMalIdFromTitle(requestedTitle || mediaTitle);
                        if (!malId && requestedTitle && mediaTitle && requestedTitle !== mediaTitle) {
                            malId = await resolveMalIdFromTitle(mediaTitle);
                        }
                    } catch (_) {}
                }
                const megaSub = await scrapeMegaPlayAnime({
                    malId: malId || undefined,
                    episode: e,
                    type: 'sub'
                });
                const megaDub = await scrapeMegaPlayAnime({
                    malId: malId || undefined,
                    episode: e,
                    type: 'dub'
                });

                const primaryRes = isDubReq && megaDub.success && megaDub.sources.length > 0 ? megaDub : (megaSub.success ? megaSub : megaDub);
                if (primaryRes.success && primaryRes.sources.length > 0) {
                    const activeIsDub = primaryRes === megaDub;
                    scraperName = `HiAnime (${activeIsDub ? 'English DUB' : 'Japanese SUB'})`;
                    sources = primaryRes.sources.map(s => ({
                        ...s,
                        language: activeIsDub ? 'English Dub' : 'Japanese Sub'
                    }));

                    // Append alternative dub/sub source if available for 1-click in-player switching
                    const altRes = activeIsDub ? megaSub : megaDub;
                    if (altRes.success && altRes.sources.length > 0) {
                        altRes.sources.forEach(altSrc => {
                            sources.push({
                                ...altSrc,
                                label: activeIsDub ? 'Japanese Sub' : 'English Dub',
                                language: activeIsDub ? 'Japanese Sub' : 'English Dub'
                            });
                        });
                    }
                    subtitles = primaryRes.subtitles || [];
                }
            
            } else if (serverId === 'vidlink' || serverId === 'vidlinkpro') {
                try {
                    const vlRes = await scrapeVidlinkStream({
                        tmdbId: tmdbId!,
                        type: type as any,
                        season: s,
                        episode: e
                    });
                    if (vlRes.success && vlRes.sources.length > 0) {
                        scraperName = 'VidLink Pro (Direct CDN)';
                        sources = vlRes.sources;
                        subtitles = vlRes.subtitles;
                    }
                } catch (err: any) {
                    console.warn('[BingrScraper] VidLink error:', err?.message || err);
                }
            } else if (serverId === 'framex' || serverId === 'framextv') {
                try {
                    const fxRes = await scrapeFrameXStream({
                        id: tmdbId || undefined,
                        type: isAnimeLikely ? 'anime' : (type as any),
                        season: s,
                        episode: e,
                        title: mediaTitle,
                        malId: malId || undefined
                    });
                    if (fxRes.success && fxRes.sources.length > 0) {
                        scraperName = `FrameX TV (${fxRes.provider || fxRes.server || 'Direct Engine'})`;
                        sources = fxRes.sources.map((src: any) => ({
                            url: src.url,
                            quality: src.quality || '1080p',
                            type: src.type || (src.url.includes('.mp4') ? 'video/mp4' : 'application/x-mpegurl'),
                            label: src.label,
                            name: src.name,
                            skipProxy: src.skipProxy ?? true,
                            headers: src.headers,
                            audioTracks: src.audioTracks
                        }));
                        subtitles = (fxRes.subtitles || []).map((sub: any) => ({
                            lang: sub.lang,
                            url: sub.url,
                            label: sub.label
                        }));
                    }
                } catch (err: any) {
                    console.warn('[BingrScraper] FrameX error:', err?.message || err);
                }
            } else if (serverId === 'm4u' || serverId === 'movies4u') {
                const m4uRes = await scrapeMovies4uCluster({
                    type: type as any,
                    id: tmdbId,
                    title: mediaTitle,
                    year: mediaYear,
                    season: s,
                    episode: e
                });
                scraperName = m4uRes.scraperName || 'Movie 4U';
                sources = m4uRes.sources || [];
                subtitles = m4uRes.subtitles || [];
            } else if (serverId === 'animesalt' || serverId === 'anime') {
                const animeRes = await scrapeAnimeEpisode(mediaTitle, s, e);
                scraperName = 'AnimeSalt (Special Anime Scraper)';
                sources = (animeRes.sources || []).map(src => ({
                    url: src.url,
                    quality: src.quality || '1080p',
                    type: src.type || 'application/x-mpegurl',
                    label: src.label,
                    name: src.name
                }));
                subtitles = (animeRes.subtitles || []).map(sub => ({
                    lang: sub.lang,
                    url: sub.url,
                    label: sub.label
                }));
            } else if (serverId === 'ranime' || serverId === 'rareanimes') {
                const rareRes = await resolveRareAnimeStream({
                    title: mediaTitle,
                    season: s,
                    episode: e
                });
                scraperName = 'RareAnimes (Hindi Dub / Rare Anime Scraper)';
                sources = (rareRes.sources || []).map(src => ({
                    url: src.iframeUrl || src.embedUrl,
                    quality: '1080p',
                    type: 'embed',
                    label: `RareAnimes (Vimeo ${src.vimeoId})`,
                    name: `RareAnimes ${src.language ? `[${src.language.toUpperCase()}]` : ''}`
                }));
            } else if (serverId === 'kisskh') {
                const kissResults = await searchKissKh(mediaTitle);
                if (kissResults && kissResults.length > 0) {
                    const cleanQ = mediaTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const exact = kissResults.find(r => r.title.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQ) || kissResults[0];
                    const drama = await getKissKhDrama(String(exact.id));
                    const targetEp = type === 'tv' ? (s ? e : 1) : 1;
                    const foundEp = drama?.episodes?.find(epItem => epItem.number === targetEp) || drama?.episodes?.[targetEp - 1] || drama?.episodes?.[0];
                    if (foundEp) {
                        const streamData = await resolveKissKhEpisode(String(foundEp.id));
                        if (streamData && streamData.video) {
                            scraperName = 'KissKH (Asian Drama & Anime)';
                            sources = [{
                                url: streamData.video,
                                quality: '1080p FHD',
                                type: 'application/x-mpegurl',
                                label: 'KissKH Direct HLS',
                                name: 'KissKH'
                            }];
                            subtitles = (streamData.subtitles || []).map((sub: any) => ({
                                lang: sub.label || sub.land || 'English',
                                url: sub.src || sub.url,
                                label: sub.label || 'English'
                            }));
                        }
                    }
                }
            } else if (serverId === 'asiaflix') {
                const afResults = await searchAsiaflix(mediaTitle);
                if (afResults && afResults.length > 0) {
                    const target = afResults[0];
                    const targetEp = type === 'tv' ? (s ? e : 1) : 1;
                    const streamData = await resolveAsiaflixEpisodeStream(target.slug, targetEp);
                    if (streamData && streamData.video) {
                        scraperName = 'Asiaflix (Vidmoly Multi-Bitrate HLS)';
                        sources = [{
                            url: streamData.video,
                            quality: '720p/1080p',
                            type: 'application/x-mpegurl',
                            label: 'Vidmoly HLS',
                            name: 'Asiaflix'
                        }];
                    }
                }
            } else if (serverId === 's40') {
                // Bingr Aphelion TV dedicated endpoint matching Watch-CRSz6z0p.js
                if (type === 'tv' && s && e) {
                    try {
                        const tvRes = await bingrRequest<{
                            sources?: BingrStreamSource[];
                            subtitles?: Array<{ lang: string; url: string; label?: string }>;
                        }>(`/stream/aphelion-tv/${tmdbId}/${s}/${e}`, {
                            method: 'GET',
                            referer: `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}`,
                            timeout: 5000
                        });
                        if (tvRes.status === 200 && tvRes.data?.sources && tvRes.data.sources.length > 0) {
                            scraperName = 'Aphelion';
                            sources = tvRes.data.sources;
                            subtitles = tvRes.data.subtitles || [];
                        }
                    } catch (_) {}
                }

                if (!sources || sources.length === 0) {
                    const payload = {
                        srv: 's40',
                        t: type,
                        id: Number(tmdbId),
                        query
                    };
                    const res = await bingrRequest<{
                        scraperName?: string;
                        sources?: BingrStreamSource[];
                        subtitles?: Array<{ lang: string; url: string; label?: string }>;
                    }>('/stream', {
                        method: 'POST',
                        body: payload,
                        referer: type === 'tv' ? `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}` : `https://bingr.one/watch/movie/${tmdbId}`,
                        timeout: 5000
                    });
                    if (res.status === 200 && res.data?.sources && res.data.sources.length > 0) {
                        scraperName = res.data?.scraperName || 'Aphelion';
                        sources = res.data.sources;
                        subtitles = res.data?.subtitles || [];
                    }
                }
            } else if (serverId === 'sm_hub' || serverId === 'smmovies' || serverId === 'moviehub' || serverId === 'fibwatch') {
                const smRes = await findSmMovieStream({
                    type: type as any,
                    title: mediaTitle,
                    year: mediaYear,
                    season: s,
                    episode: e
                });
                if (smRes && smRes.success && smRes.sources.length > 0) {
                    scraperName = smRes.scraperName || 'SM Movie Hub (Direct VOD/MKV)';
                    if (smRes.duration) probeDurationSec = smRes.duration;
                    if (smRes.audioTracks && smRes.audioTracks.length > 0) probeAudioTracks = smRes.audioTracks;
                    sources = smRes.sources.map(src => ({
                        url: src.url,
                        quality: src.quality || '1080p',
                        type: src.type || 'video/x-matroska',
                        label: src.label,
                        name: src.name
                    }));
                }
            } else if (serverId === 'cinepro' || serverId === 'cinepro_core') {
                scraperName = 'CinePro Core (OMSS Multi-Provider)';
                try {
                    const cineRes = await getCineProStreams(tmdbId, type === 'anime' ? 'tv' : type, s ? Number(s) : 1, e ? Number(e) : 1);
                    if (cineRes && cineRes.sources && cineRes.sources.length > 0) {
                        const directOnly = cineRes.sources.filter(src => src.type !== 'embed');
                        if (directOnly.length > 0) {
                            sources = directOnly.map(src => ({
                                url: src.url,
                                quality: src.quality || '1080p',
                                type: 'application/x-mpegurl',
                                label: src.name,
                                name: src.name
                            }));
                        }
                    }
                } catch (_) {}
            } else if (serverId === 'filmu' || serverId === 'vidbolt' || serverId === 'vidy' || serverId === 'cinezo' || serverId === 'vidrift') {
                const targetId = tmdbId || 0;
                const epNum = e || 1;
                const sNum = s || 1;
                let embedUrl = '';
                if (serverId === 'filmu' || (serverId as string) === 'vidly') {
                    scraperName = 'Filmu / Vidly (Decrypted HLS / Multi-Provider)';
                    try {
                        const flRes = await scrapeFilmuStream({
                            tmdbId: targetId,
                            type: type as any,
                            season: sNum,
                            episode: epNum
                        });
                        if (flRes && flRes.success && flRes.sources && flRes.sources.length > 0) {
                            sources = flRes.sources;
                            subtitles = flRes.subtitles || [];
                        }
                    } catch (_) {}
                    if (sources.length === 0) {
                        embedUrl = type === 'tv'
                            ? `https://vidly.pro/tv/${targetId}/${sNum}/${epNum}`
                            : ((type as string) === 'anime' ? `https://vidly.pro/anime/${malId || targetId}/${epNum}` : `https://vidly.pro/movie/${targetId}`);
                    }
                } else if (serverId === 'vidbolt') {
                    scraperName = 'Vidbolt (Vidbolt Embed Streamer)';
                    embedUrl = type === 'tv'
                        ? `https://vidbolt.xyz/tv/${targetId}/${sNum}/${epNum}`
                        : ((type as string) === 'anime' ? `https://vidbolt.xyz/anime/${malId || targetId}/${epNum}` : `https://vidbolt.xyz/movie/${targetId}`);
                } else if (serverId === 'vidy') {
                    scraperName = 'Vidy (Vidy.st Direct Embed)';
                    embedUrl = type === 'tv'
                        ? `https://www.vidy.st/tv/${targetId}/${sNum}/${epNum}`
                        : ((type as string) === 'anime' ? `https://www.vidy.st/anime/${malId || targetId}/${epNum}` : `https://www.vidy.st/movie/${targetId}`);
                } else if (serverId === 'cinezo') {
                    scraperName = 'Cinezo (Player Cinezo Multi-Audio)';
                    embedUrl = type === 'tv'
                        ? `https://player.cinezo.live/embed/tv/${targetId}/${sNum}/${epNum}`
                        : ((type as string) === 'anime' ? `https://player.cinezo.live/embed/anime/${malId || targetId}/${epNum}?dub=true` : `https://player.cinezo.live/embed/movie/${targetId}`);
                } else if (serverId === 'vidrift') {
                    scraperName = 'Vidrift (Direct HLS / Multi-Provider)';
                    try {
                        const vdRes = await scrapeVidriftStream({
                            tmdbId: targetId,
                            type: type as any,
                            season: sNum,
                            episode: epNum
                        });
                        if (vdRes && vdRes.success && vdRes.sources && vdRes.sources.length > 0) {
                            sources = vdRes.sources;
                            subtitles = vdRes.subtitles || [];
                        }
                    } catch (_) {}
                    if (sources.length === 0) {
                        embedUrl = type === 'tv'
                            ? `https://embed.vidrift.in/embed/tv/${targetId}/${sNum}/${epNum}`
                            : ((type as string) === 'anime' ? `https://embed.vidrift.in/embed/anime/${malId || targetId}/${epNum}` : `https://embed.vidrift.in/embed/movie/${targetId}`);
                    }
                }

                if (embedUrl) {
                    sources = [{
                        url: embedUrl,
                        quality: '1080p Auto',
                        type: 'embed',
                        label: `${scraperName} Player`,
                        name: scraperName
                    }];
                }
            } else {
                const payload = {
                    srv: serverId,
                    t: type,
                    id: Number(tmdbId),
                    query
                };
                const referer = type === 'tv'
                    ? `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}`
                    : `https://bingr.one/watch/movie/${tmdbId}`;

                // Upstream cluster timeout (6000ms ensures clusters like Polaris/Bastion complete resolution)
                const timeoutMs = 6000;

                let res: { status: number; data: any } | null = null;
                try {
                    res = await bingrRequest<{
                        scraperName?: string;
                        sources?: BingrStreamSource[];
                        subtitles?: Array<{ lang: string; url: string; label?: string }>;
                    }>('/stream', {
                        method: 'POST',
                        body: payload,
                        referer,
                        timeout: timeoutMs
                    });
                } catch (bErr) {}

                if (res && res.status === 200 && res.data?.sources && res.data.sources.length > 0) {
                    scraperName = res.data?.scraperName || serverMeta.name;
                    sources = res.data.sources;
                    subtitles = res.data?.subtitles || [];
                    if (res.data?.duration && Number(res.data.duration) > 10) {
                        upstreamDurationSec = Number(res.data.duration) * 60;
                    }
                } else {
                    throw new Error(`Upstream returned status ${res?.status || 500}`);
                }
            }

            const latencyMs = Date.now() - startTime;

            if (sources && sources.length > 0) {
                // Ensure rawUrl, directUrl, and referrer are populated for every source
                for (const s of sources) {
                    const candidate = (s as any).rawUrl || (s as any).directUrl || s.url;
                    const unwrapped = unwrapDirectStreamUrl(candidate);
                    if (unwrapped.streamUrl) {
                        (s as any).rawUrl = unwrapped.streamUrl;
                        (s as any).directUrl = unwrapped.streamUrl;
                        if (unwrapped.referer && !(s as any).referrer) {
                            (s as any).referrer = unwrapped.referer;
                        }
                    }
                    const isMandatoryProxy = s.url.includes('hakunamatata.com') || 
                                             s.url.includes('hakunaymatata.com') || 
                                             s.url.includes('reelvault.click') || 
                                             s.url.includes('streamrip.fun/f/') ||
                                             s.url.includes('rousav.tech') ||
                                             serverId === 'vidlink' ||
                                             serverId === 'vidrift' ||
                                             serverId === 'filmu';
                    if (isMandatoryProxy) {
                        const targetRaw = unwrapped.streamUrl || (s as any).rawUrl || s.url;
                        (s as any).rawUrl = targetRaw;
                        (s as any).directUrl = targetRaw;
                        if (!s.url.startsWith('/stream_proxy.php')) {
                            (s as any).proxyUrl = s.url;
                            s.url = `/stream_proxy.php?url=${encodeURIComponent(targetRaw)}`;
                        }
                    } else {
                        const isFrameX = serverId === 'framex' || s.url.includes('framextv.tech') || (s as any).skipProxy;
                        if (serverId !== 'bing_anime' && serverId !== 'animesalt' && !isFrameX) {
                            if (unwrapped.streamUrl && unwrapped.streamUrl.startsWith('http') && s.url !== unwrapped.streamUrl) {
                                (s as any).proxyUrl = s.url;
                                s.url = unwrapped.streamUrl;
                            }
                        }
                    }
                }

                // Always prioritize highest resolution quality: 4K / 2160p > 1080p > 720p > 480p
                sources.sort((a, b) => {
                    const qScore = (q: string = '') => {
                        const l = q.toLowerCase();
                        if (l.includes('4k') || l.includes('2160')) return 4000;
                        if (l.includes('1080') || l.includes('fhd')) return 1080;
                        if (l.includes('720') || l.includes('hd')) return 720;
                        if (l.includes('480')) return 480;
                        return 500;
                    };
                    return qScore(b.quality) - qScore(a.quality);
                });

                const candidateUrl = sources[0].url;
                let durCheck: { isValid: boolean; expected?: number; actual?: number; reason?: string } = { isValid: true };

                if (sources[0].type !== 'embed') {
                    // Reachability check across candidates (up to first 5 sources)
                    let activeIndex = -1;
                    for (let i = 0; i < Math.min(sources.length, 5); i++) {
                        const reachable = await verifyStreamReachable(sources[i].url, 2000);
                        if (reachable) {
                            activeIndex = i;
                            break;
                        }
                    }

                    if (activeIndex === -1) {
                        const embedFallback = sources.find(s => s.type === 'embed');
                        if (embedFallback) {
                            sources = [embedFallback];
                        } else {
                            attempts.push({
                                serverId,
                                serverName: serverMeta.name,
                                status: '404_unreachable',
                                latencyMs,
                                error: `Upstream returned HTTP 404/dead link for ${candidateUrl}`
                            });
                            return null;
                        }
                    }

                    // Promote healthy working source to primary if fallback was needed
                    if (activeIndex > 0) {
                        const [healthySrc] = sources.splice(activeIndex, 1);
                        sources.unshift(healthySrc);
                    }
                    const activeCandidateUrl = sources[0].url;

                    // Storyboard Scrubbing Thumbnail Detection (rejects thumbnail sprites / tiles.m3u8)
                    const isStoryboard = await isStoryboardStream(activeCandidateUrl);
                    if (isStoryboard) {
                        attempts.push({
                            serverId,
                            serverName: serverMeta.name,
                            status: 'storyboard_rejected',
                            latencyMs,
                            error: `Storyboard thumbnail scrub playlist rejected (no genuine video stream): ${activeCandidateUrl}`
                        });
                        return null;
                    }
                    
                    // Fast Duration Verification (use upstream duration if available or race with 1s timeout)
                    if (serverId === 'vidlink' || serverId === 'vidrift' || serverId === 'filmu') {
                        durCheck = { isValid: true };
                    } else if (upstreamDurationSec && upstreamDurationSec > 600) {
                        durCheck = { isValid: true, actual: upstreamDurationSec / 60 };
                    } else {
                        durCheck = await Promise.race([
                            verifyStreamDuration(activeCandidateUrl, (type === 'anime' ? 'movie' : type), Number(tmdbId), s ? Number(s) : undefined, e ? Number(e) : undefined, strictSrv),
                            new Promise<{ isValid: boolean }>((resolve) => setTimeout(() => resolve({ isValid: true }), 3500))
                        ]);
                    }
                    if (!durCheck.isValid) {
                        attempts.push({
                            serverId,
                            serverName: serverMeta.name,
                            status: 'duration_mismatch',
                            latencyMs,
                            error: durCheck.reason
                        });
                        return null; // Skip this stream because duration doesn't match
                    }
                }

                if (subtitles.length <= 1) {
                    try {
                        const vdrkSubs = await getSubtitles((type === 'anime' ? 'movie' : type), tmdbId, s, e);
                        if (vdrkSubs && vdrkSubs.length > subtitles.length) {
                            subtitles = vdrkSubs;
                        }
                    } catch {}
                }

                const result: BingrScrapeResult = {
                    success: true,
                    type,
                    tmdbId: Number(tmdbId),
                    title: mediaTitle,
                    year: mediaYear,
                    ...(type === 'tv' ? { season: s, episode: e } : {}),
                    serverId,
                    serverName: serverMeta.name,
                    scraperName: scraperName,
                    primaryM3u8: (sources[0] && sources[0].type === 'embed') ? undefined : (sources[0]?.url || candidateUrl),
                    quality: sources[0].quality || '1080p',
                    sources: sources,
                    subtitles: subtitles,
                    audioTracks: probeAudioTracks,
                    expectedDurationMinutes: durCheck.expected || tmdbRuntimeMinutes,
                    streamDurationMinutes: durCheck.actual || (probeDurationSec ? Math.round(probeDurationSec / 60) : tmdbRuntimeMinutes),
                    streamDurationSec: probeDurationSec || (durCheck.actual ? Math.round(durCheck.actual * 60) : (tmdbRuntimeMinutes ? tmdbRuntimeMinutes * 60 : (durCheck.expected ? Math.round(durCheck.expected * 60) : undefined))),
                    duration: probeDurationSec ? Math.round(probeDurationSec / 60) : (durCheck.actual || tmdbRuntimeMinutes || durCheck.expected)
                };

                attempts.push({
                    serverId,
                    serverName: serverMeta.name,
                    status: 'success',
                    latencyMs
                });
                return result;
            } else {
                attempts.push({
                    serverId,
                    serverName: serverMeta.name,
                    status: 'empty_sources',
                    latencyMs
                });
                return null;
            }
        } catch (err: any) {
            attempts.push({
                serverId,
                serverName: serverMeta.name,
                status: 'error',
                latencyMs: Date.now() - startTime,
                error: err?.message || 'Network error'
            });
            return null;
        }
    }

    // Staged parallel cluster cascade
    let successResult: BingrScrapeResult | null = null;
    let fallbackEmbedResult: BingrScrapeResult | null = null;

    const checkDirect = (res: BingrScrapeResult | null): boolean => {
        if (!res || !res.success) return false;
        return Boolean(res.sources && res.sources.some(s =>
            s.type !== 'embed' &&
            Boolean(s.url && (
                s.url.includes('.m3u8') ||
                s.url.includes('/api/proxy') ||
                s.url.includes('/stream') ||
                s.url.includes('.mpd') ||
                s.url.includes('.mp4') ||
                s.url.includes('.mkv') ||
                s.type === 'application/x-mpegurl' ||
                s.type === 'hls' ||
                s.type === 'application/dash+xml'
            ))
        ));
    };

    const normalizedReqSrv = normalizeServerId(params.srv);
    if (normalizedReqSrv) {
        const preferredRes = await tryServer(normalizedReqSrv);
        if (preferredRes && checkDirect(preferredRes)) {
            successResult = preferredRes;
            STREAM_CACHE.set(cacheKey, { timestamp: Date.now(), result: { ...successResult, attempts } });
            return { ...successResult, attempts };
        } else if (preferredRes) {
            fallbackEmbedResult = preferredRes;
        }

        if (params.strictSrv) {
            if (fallbackEmbedResult) {
                return { ...fallbackEmbedResult, attempts };
            }
            return {
                success: false,
                type,
                tmdbId: Number(tmdbId) || 0,
                title: mediaTitle,
                serverId: normalizedReqSrv,
                serverName: BINGR_SERVERS.find(s => s.id === normalizedReqSrv)?.name || normalizedReqSrv,
                error: `No stream available on ${BINGR_SERVERS.find(s => s.id === normalizedReqSrv)?.name || normalizedReqSrv}`,
                sources: [],
                attempts
            };
        }
    }

    if (!successResult) {
        // If content has a MAL ID or is anime, strictly search ONLY anime-special scrapers
        const isAnimeTarget = Boolean(malId || isAnimeConfirmed || isAnimeLikely || params.anilistId || type === 'anime');

        // Filter out normalizedReqSrv if already tried
        const filterTier = (tier: string[]) => normalizedReqSrv ? tier.filter(s => s !== normalizedReqSrv) : tier;

        // Fast race helper: returns immediately as soon as ANY server in the tier finds a direct stream
        async function raceTierForDirectStream(tierList: string[], maxWaitMs = 4500): Promise<BingrScrapeResult | null> {
            const list = filterTier(tierList);
            if (list.length === 0) return null;

            return new Promise((resolve) => {
                let resolved = false;
                let pending = list.length;

                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                    }
                }, maxWaitMs);

                for (const srv of list) {
                    tryServer(srv).then((val) => {
                        if (resolved) return;
                        if (val && checkDirect(val)) {
                            resolved = true;
                            clearTimeout(timer);
                            resolve(val);
                        } else {
                            if (val && !fallbackEmbedResult) {
                                fallbackEmbedResult = val;
                            }
                            pending--;
                            if (pending === 0 && !resolved) {
                                resolved = true;
                                clearTimeout(timer);
                                resolve(null);
                            }
                        }
                    }).catch(() => {
                        if (resolved) return;
                        pending--;
                        if (pending === 0 && !resolved) {
                            resolved = true;
                            clearTimeout(timer);
                            resolve(null);
                        }
                    });
                }
            });
        }

        if (isAnimeTarget) {
            const animeTier = ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'];
            successResult = await raceTierForDirectStream(animeTier, 4500);
        } else if (type === 'movie') {
            // Fast parallel race across prioritized movie sequence:
            // m4u, s62, framex, s80, s31, sm_hub, s81
            const moviePriorityServers = filterTier(['m4u', 's62', 'framex', 's80', 's31', 'sm_hub', 's81']);
            successResult = await raceTierForDirectStream(moviePriorityServers, 4000);

            // Fallback: If top priority servers did not yield a direct stream, race the remaining movie servers
            if (!successResult) {
                const remainingMovieServers = ['s3', 's40', 's30', 's70', 's60', 's63', 's61', 'cinepro'];
                successResult = await raceTierForDirectStream(remainingMovieServers, 3500);
            }
        } else {
            // TV series default cascade
            const tvTier1 = ['m4u', 's62', 'framex', 's80', 's31', 'sm_hub', 's81'];
            const tvTier2 = ['s3', 's40', 's30', 's70', 's60', 's63', 's61'];

            successResult = await raceTierForDirectStream(tvTier1, 2500);
            if (!successResult) {
                successResult = await raceTierForDirectStream(tvTier2, 2000);
            }
        }

        // If direct stream was unavailable, accept fallback embed without checking dead tiers
        if (!successResult && fallbackEmbedResult) {
            successResult = fallbackEmbedResult;
        }
    }

    if (successResult) {
        STREAM_CACHE.set(cacheKey, { timestamp: Date.now(), result: { ...successResult, attempts } });
        return { ...successResult, attempts };
    }

    const season = params.season || 1;
    const episode = params.episode || 1;

    return {
        success: false,
        type,
        tmdbId: Number(tmdbId),
        title: mediaTitle,
        year: mediaYear,
        ...(type === 'tv' ? { season, episode } : {}),
        error: 'No working stream found across active scraper clusters',
        attempts,
        sources: [],
        fallbackEmbeds: [
            type === 'tv' ? `https://embed.filmu.in/tv/${tmdbId}/${season}/${episode}` : `https://embed.filmu.in/movie/${tmdbId}`,
            type === 'tv' ? `https://www.vidy.st/tv/${tmdbId}/${season}/${episode}` : `https://www.vidy.st/movie/${tmdbId}`,
            type === 'tv' ? `https://player.cinezo.live/embed/tv/${tmdbId}/${season}/${episode}` : `https://player.cinezo.live/embed/movie/${tmdbId}`,
            type === 'tv' ? `https://vidbolt.xyz/tv/${tmdbId}/${season}/${episode}` : `https://vidbolt.xyz/movie/${tmdbId}`,
            type === 'tv' ? `https://embed.vidrift.in/embed/tv/${tmdbId}/${season}/${episode}` : `https://embed.vidrift.in/embed/movie/${tmdbId}`
        ]
    };
}

/**
 * Unwrap any proxy wrapper (local Express proxy or Cloudflare proxy) to raw upstream CDN stream URL
 */
export function unwrapDirectStreamUrl(inputUrl: string): { streamUrl: string; referer?: string; userAgent?: string } {
    if (!inputUrl) return { streamUrl: '' };
    let streamUrl = inputUrl.trim();
    let referer: string | undefined;
    let userAgent: string | undefined;

    // Peel away all nested proxy wrappers (local express proxy, hianime proxy, wormhole, etc.)
    let maxDepth = 10;
    while (maxDepth-- > 0) {
        if (!streamUrl) break;
        let unwrappedInner = false;

        try {
            const parseTarget = streamUrl.startsWith('http://') || streamUrl.startsWith('https://')
                ? streamUrl
                : `http://localhost${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}`;
            const parsed = new URL(parseTarget);
            if (parsed.hostname.includes('framextv.tech')) {
                break;
            }

            const isProxyPath = 
                parsed.pathname.includes('/api/proxy') ||
                parsed.pathname.includes('/stream_proxy.php') ||
                parsed.pathname.includes('/proxy/m3u8') ||
                parsed.pathname.includes('/proxy') ||
                parsed.hostname.includes('wormhole.filmu.in') ||
                parsed.hostname.includes('hianime.filmu.in') ||
                parsed.searchParams.has('url');

            const inner = parsed.searchParams.get('url');
            if (inner && (isProxyPath || inner.startsWith('http://') || inner.startsWith('https://'))) {
                streamUrl = inner.trim();
                unwrappedInner = true;

                const refParam = parsed.searchParams.get('referer') || parsed.searchParams.get('ref');
                if (refParam) {
                    referer = refParam.trim();
                }

                const headersParam = parsed.searchParams.get('headers');
                if (headersParam) {
                    try {
                        const parsedHeaders = JSON.parse(decodeURIComponent(headersParam));
                        if (parsedHeaders.Referer || parsedHeaders.referer) {
                            referer = parsedHeaders.Referer || parsedHeaders.referer;
                        }
                        if (parsedHeaders['User-Agent'] || parsedHeaders['user-agent']) {
                            userAgent = parsedHeaders['User-Agent'] || parsedHeaders['user-agent'];
                        }
                    } catch {}
                }
            }
        } catch {}

        if (!unwrappedInner) break;
    }

    if (!referer) {
        const cdn = getCdnHeaders(streamUrl);
        referer = cdn.referer;
        userAgent = userAgent || cdn.userAgent;
    }

    return { streamUrl, referer, userAgent };
}

/**
 * Generate standard IPTV M3U playlist format from scraped Bingr streams
 */
export function buildBingrM3u(options: {
    title: string;
    type: 'movie' | 'tv';
    tmdbId?: number;
    logo?: string;
    groupTitle?: string;
    baseUrl?: string;
    raw?: boolean;
    items: Array<{
        name: string;
        url: string;
        rawUrl?: string;
        directUrl?: string;
        referrer?: string;
        ref?: string;
        userAgent?: string;
        quality?: string;
        logo?: string;
        season?: number;
        episode?: number;
        tmdbId?: number;
    }>;
}): string {
    const lines: string[] = ['#EXTM3U'];
    const defaultGroup = options.groupTitle || (options.type === 'movie' ? 'Bingr Movies' : 'Bingr TV Series');

    for (const item of options.items) {
        const logo = item.logo || options.logo || '';
        const id = item.tmdbId || options.tmdbId || '';
        const qualityTag = item.quality ? ` [${item.quality}]` : '';
        const displayName = `${item.name}${qualityTag}`;
        
        let extraTags = `tvg-id="${id}" tvg-name="${displayName}" group-title="${defaultGroup}"`;
        if (logo) extraTags += ` tvg-logo="${logo}"`;
        if (item.season && item.episode) {
            extraTags += ` tvg-season="${item.season}" tvg-episode="${item.episode}"`;
        }

        lines.push(`#EXTINF:-1 ${extraTags},${displayName}`);
        
        // Extract direct raw stream URL from candidate
        const rawCandidate = item.rawUrl || item.directUrl || item.url;
        const unwrapped = unwrapDirectStreamUrl(rawCandidate);
        let finalStreamUrl = unwrapped.streamUrl || rawCandidate;

        // Route referer-locked streams through manifest normalizer only when raw is NOT requested
        if (!options.raw && requiresReferer(finalStreamUrl) && options.baseUrl && !finalStreamUrl.includes('/api/bingr/manifest.m3u8')) {
            finalStreamUrl = `${options.baseUrl}/api/bingr/manifest.m3u8?url=${encodeURIComponent(finalStreamUrl)}`;
        }

        // Add Kodi and VLC compatible Referer headers for each M3U stream
        const cdn = getCdnHeaders(unwrapped.streamUrl);
        let itemRef = item.referrer || item.ref || unwrapped.referer || cdn.referer;
        let itemUa = item.userAgent || unwrapped.userAgent || cdn.userAgent;

        if (itemRef) {
            lines.push(`#EXTVLCOPT:http-referrer=${itemRef}`);
            lines.push(`#EXTHTTP:{"Referer":"${itemRef}"}`);
        }
        if (itemUa) {
            lines.push(`#EXTVLCOPT:http-user-agent=${itemUa}`);
        }

        lines.push(finalStreamUrl);
    }

    return lines.join('\n');
}

/**
 * Scrape a Movie stream by TMDB ID (Node.js SDK pattern)
 */
export async function scrapeMovie(tmdbId: number | string, options?: { srv?: string; title?: string; year?: string | number }): Promise<BingrScrapeResult> {
    return scrapeBingrStream({
        type: 'movie',
        id: tmdbId,
        title: options?.title,
        year: options?.year,
        srv: options?.srv
    });
}

/**
 * Scrape a TV Series episode stream by TMDB ID, Season, and Episode (Node.js SDK pattern)
 */
export async function scrapeTvEpisode(
    tmdbId: number | string,
    season: number | string,
    episode: number | string,
    options?: { srv?: string; title?: string; year?: string | number }
): Promise<BingrScrapeResult> {
    return scrapeBingrStream({
        type: 'tv',
        id: tmdbId,
        season: Number(season),
        episode: Number(episode),
        title: options?.title,
        year: options?.year,
        srv: options?.srv
    });
}

