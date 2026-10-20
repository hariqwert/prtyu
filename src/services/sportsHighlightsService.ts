import { YouTubeService } from './youtubeService';

export interface SportsHighlight {
    id: string;
    title: string;
    competition: string;
    matchDate: string;
    thumbnail: string;
    sport: 'football' | 'cricket' | 'motorsport' | 'other';
    side1?: { name: string; url?: string };
    side2?: { name: string; url?: string };
    embedUrl?: string;
    videoUrl?: string;
    source: string;
    updatedAt: number;
}

// In-memory cache storage
let cachedHighlights: SportsHighlight[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetch genuine football match highlights using YouTubeService direct parser
 */
async function fetchFootballHighlights(): Promise<SportsHighlight[]> {
    try {
        const videos = await YouTubeService.searchYouTube('premier league champions league match highlights 2026', 6);
        return videos.map(v => ({
            id: `yt-fb-${v.id}`,
            title: v.title,
            competition: 'Football Highlights',
            matchDate: new Date().toISOString(),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            sport: 'football',
            embedUrl: v.embedUrl,
            videoUrl: v.watchUrl,
            source: v.uploader || 'Football Official',
            updatedAt: Date.now()
        }));
    } catch (err: any) {
        console.warn('[SportsHighlights] Failed to fetch football highlights:', err.message);
        return [];
    }
}

/**
 * Fetch genuine cricket match highlights using YouTubeService direct parser
 */
async function fetchCricketHighlights(): Promise<SportsHighlight[]> {
    try {
        const videos = await YouTubeService.searchYouTube('cricket match highlights 2026', 6);
        return videos.map(v => ({
            id: `yt-crick-${v.id}`,
            title: v.title,
            competition: 'Cricket Highlights',
            matchDate: new Date().toISOString(),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            sport: 'cricket',
            embedUrl: v.embedUrl,
            videoUrl: v.watchUrl,
            source: v.uploader || 'Cricket Official',
            updatedAt: Date.now()
        }));
    } catch (err: any) {
        console.warn('[SportsHighlights] Failed to fetch cricket highlights:', err.message);
        return [];
    }
}

/**
 * Fetch genuine F1 & motorsports race highlights
 */
async function fetchMotorsportHighlights(): Promise<SportsHighlight[]> {
    try {
        const videos = await YouTubeService.searchYouTube('formula 1 race highlights 2026', 4);
        return videos.map(v => ({
            id: `yt-f1-${v.id}`,
            title: v.title,
            competition: 'F1 & Motorsport',
            matchDate: new Date().toISOString(),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            sport: 'motorsport',
            embedUrl: v.embedUrl,
            videoUrl: v.watchUrl,
            source: v.uploader || 'Formula 1',
            updatedAt: Date.now()
        }));
    } catch (err: any) {
        return [];
    }
}

/**
 * Get all real sports highlights with auto-refresh cache (No dummy links)
 */
export async function getAllSportsHighlights(forceRefresh = false): Promise<SportsHighlight[]> {
    const now = Date.now();
    if (!forceRefresh && cachedHighlights.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return cachedHighlights;
    }

    const [football, cricket, motorsports] = await Promise.all([
        fetchFootballHighlights(),
        fetchCricketHighlights(),
        fetchMotorsportHighlights()
    ]);

    const combined = [...cricket, ...football, ...motorsports];
    if (combined.length > 0) {
        cachedHighlights = combined;
        lastFetchTime = now;
    }

    return cachedHighlights;
}

/**
 * Search highlights by keyword or competition
 */
export async function searchHighlights(query: string): Promise<SportsHighlight[]> {
    const cleanQ = (query || '').trim();
    if (!cleanQ) return getAllSportsHighlights();

    try {
        const videos = await YouTubeService.searchYouTube(`${cleanQ} match highlights 2026`, 8);
        return videos.map(v => ({
            id: `yt-search-${v.id}`,
            title: v.title,
            competition: cleanQ,
            matchDate: new Date().toISOString(),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            sport: cleanQ.toLowerCase().includes('cricket') ? 'cricket' : 'football',
            embedUrl: v.embedUrl,
            videoUrl: v.watchUrl,
            source: v.uploader || 'Highlights',
            updatedAt: Date.now()
        }));
    } catch {
        return [];
    }
}
