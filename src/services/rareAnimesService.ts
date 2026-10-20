/**
 * RareAnimes Scraper Service
 * 
 * Scrapes https://www.rareanimes.mov — a WordPress-based anime download/streaming blog
 * featuring Hindi-dubbed and rare anime titles via Vimeo embeds.
 * 
 * Architecture:
 * - Search via WordPress URL search (?s=query)
 * - Fetch season/series page to extract episode pages
 * - Extract Vimeo video IDs from iframe embeds
 * - Return Vimeo player embed URLs (browser-side rendering since Vimeo blocks server IP via Cloudflare Turnstile)
 */

import axios from 'axios';

const BASE_URL = 'https://www.rareanimes.mov';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const axiosOptions = {
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': BASE_URL + '/',
    },
    timeout: 15000,
};

export interface RareAnimeResult {
    title: string;
    url: string;
    excerpt?: string;
    poster?: string;
    seasons?: RareAnimeSeason[];
}

export interface RareAnimeSeason {
    label: string;
    url: string;
    season: number;
    language?: string;
}

export interface RareAnimeEpisodeSource {
    vimeoId: string;
    vimeoHash?: string;
    embedUrl: string;
    iframeUrl: string;
    episodeNumber?: number;
    title?: string;
    language?: string;
}

export interface RareAnimeStreamResult {
    success: boolean;
    title?: string;
    url?: string;
    sources: RareAnimeEpisodeSource[];
    allEpisodeLinks?: string[];
    error?: string;
}

/**
 * Search RareAnimes for an anime title.
 * Returns matching series/season pages.
 */
export async function searchRareAnimes(query: string, language = 'hindi'): Promise<RareAnimeResult[]> {
    const results: RareAnimeResult[] = [];

    try {
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const res = await axios.get(searchUrl, axiosOptions);
        const html = res.data as string;

        // WordPress search results: extract article links
        const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
        let articleMatch: RegExpExecArray | null;

        while ((articleMatch = articlePattern.exec(html)) !== null) {
            const articleHtml = articleMatch[1];

            // Title + link
            const linkMatch = articleHtml.match(/href="(https:\/\/www\.rareanimes\.mov\/[^"]+)"[^>]*>([^<]{3,120})</);
            if (!linkMatch) continue;

            const url = linkMatch[1];
            const rawTitle = linkMatch[2].trim();

            // Filter out feed/category/tag pages
            if (url.includes('/feed/') || url.includes('/category/') || url.includes('/tag/') || url.includes('xmlrpc')) continue;

            // Poster image
            const posterMatch = articleHtml.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
            const poster = posterMatch ? posterMatch[1] : undefined;

            // Excerpt
            const excerptMatch = articleHtml.match(/<p[^>]*class="[^"]*excerpt[^"]*"[^>]*>([^<]{10,300})</i);
            const excerpt = excerptMatch ? excerptMatch[1].trim() : undefined;

            // Skip if title is too short or clearly non-anime
            if (rawTitle.length < 3) continue;

            results.push({
                title: rawTitle,
                url,
                excerpt,
                poster
            });
        }
    } catch (err: any) {
        console.error('[RareAnimes] Search error:', err?.message);
    }

    return results;
}

/**
 * Fetch a RareAnimes season/series page and extract:
 * - All Vimeo embed IDs (one per episode or multiple per page)
 * - Links to individual episode pages (if paginated)
 */
export async function scrapeRareAnimesPage(pageUrl: string): Promise<{
    vimeoSources: RareAnimeEpisodeSource[];
    episodeLinks: string[];
    title?: string;
}> {
    const vimeoSources: RareAnimeEpisodeSource[] = [];
    const episodeLinks: string[] = [];

    try {
        const res = await axios.get(pageUrl, {
            ...axiosOptions,
            headers: {
                ...axiosOptions.headers,
                'Referer': BASE_URL + '/',
            }
        });
        const html = res.data as string;

        // Extract page title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].replace(/\s*[|-].*$/, '').trim() : undefined;

        // Extract all Vimeo embeds — pattern: player.vimeo.com/video/{id}?h={hash}
        const vimeoPattern = /player\.vimeo\.com\/video\/(\d+)(?:\?h=([a-f0-9]+))?/gi;
        let vimeoMatch: RegExpExecArray | null;
        let epNum = 1;

        while ((vimeoMatch = vimeoPattern.exec(html)) !== null) {
            const vimeoId = vimeoMatch[1];
            const vimeoHash = vimeoMatch[2];
            const embedUrl = vimeoHash
                ? `https://player.vimeo.com/video/${vimeoId}?h=${vimeoHash}`
                : `https://player.vimeo.com/video/${vimeoId}`;

            // Try to detect episode number from surrounding HTML context
            const contextStart = Math.max(0, vimeoMatch.index - 200);
            const context = html.substring(contextStart, vimeoMatch.index + 100);
            const epMatch = context.match(/(?:episode|ep\.?|episode\s+#?)\s*(\d+)/i);
            const episodeNumber = epMatch ? parseInt(epMatch[1]) : epNum;

            // Build iframe embed URL with referrer policy
            const iframeUrl = `${embedUrl}&autoplay=1&muted=0&loop=0&byline=0&title=0&portrait=0`;

            vimeoSources.push({
                vimeoId,
                vimeoHash,
                embedUrl,
                iframeUrl,
                episodeNumber,
                language: 'hindi'
            });

            epNum++;
        }

        // Extract links to individual episode sub-pages
        // Pattern: /hindi/anime-name-episode-1/ or /english/...
        const episodeLinkPattern = /href="(https:\/\/www\.rareanimes\.mov\/(?:hindi|english|tamil|telugu)\/[^"]+)"/gi;
        let epLinkMatch: RegExpExecArray | null;
        const seen = new Set<string>();

        while ((epLinkMatch = episodeLinkPattern.exec(html)) !== null) {
            const epUrl = epLinkMatch[1];
            if (!seen.has(epUrl) && !epUrl.includes('/feed/')) {
                seen.add(epUrl);
                episodeLinks.push(epUrl);
            }
        }

        return { vimeoSources, episodeLinks, title: pageTitle };
    } catch (err: any) {
        console.error('[RareAnimes] Page scrape error for', pageUrl, ':', err?.message);
        return { vimeoSources, episodeLinks };
    }
}

/**
 * Main resolver: search + scrape Vimeo sources for a given anime title, season, episode.
 */
export async function resolveRareAnimeStream(params: {
    title: string;
    season?: number;
    episode?: number;
    language?: string;
}): Promise<RareAnimeStreamResult> {
    const { title, season = 1, episode = 1, language = 'hindi' } = params;

    try {
        // 1. Search for the anime
        const searchResults = await searchRareAnimes(title, language);

        if (!searchResults.length) {
            return {
                success: false,
                error: `No results found on RareAnimes for "${title}"`,
                sources: []
            };
        }

        // 2. Pick best match — prefer season-specific pages
        const seasonKeywords = [
            `season ${season}`,
            `season-${season}`,
            `s${season}`,
            `part ${season}`,
        ];

        let bestMatch = searchResults.find(r =>
            seasonKeywords.some(kw => r.url.toLowerCase().includes(kw) || r.title.toLowerCase().includes(kw))
        ) || searchResults[0];

        // 3. Scrape the page for Vimeo sources
        const scraped = await scrapeRareAnimesPage(bestMatch.url);

        if (!scraped.vimeoSources.length && scraped.episodeLinks.length > 0) {
            // Try fetching an episode sub-page if season page has no direct embeds
            // Pick the episode-specific link
            const epLink = scraped.episodeLinks.find(l => {
                const lLower = l.toLowerCase();
                return lLower.includes(`episode-${episode}`) ||
                    lLower.includes(`ep-${episode}`) ||
                    lLower.includes(`episode${episode}`) ||
                    lLower.includes(`ep${episode}`) ||
                    lLower.includes(`-${episode}-`) ||
                    lLower.endsWith(`-${episode}/`);
            }) || scraped.episodeLinks[episode - 1] || scraped.episodeLinks[0];

            if (epLink) {
                const subScraped = await scrapeRareAnimesPage(epLink);
                scraped.vimeoSources.push(...subScraped.vimeoSources);
            }
        }

        if (!scraped.vimeoSources.length) {
            return {
                success: false,
                title: bestMatch.title,
                url: bestMatch.url,
                error: `No streamable video sources found on RareAnimes for "${title}" S${season}E${episode}`,
                sources: [],
                allEpisodeLinks: scraped.episodeLinks
            };
        }

        // 4. Filter to the specific episode if multiple are present
        let targetSources = scraped.vimeoSources.filter(s => s.episodeNumber === episode);
        if (!targetSources.length) {
            // Return all sources (may be one per page)
            targetSources = scraped.vimeoSources;
        }

        return {
            success: true,
            title: scraped.title || bestMatch.title,
            url: bestMatch.url,
            sources: targetSources,
            allEpisodeLinks: scraped.episodeLinks
        };
    } catch (err: any) {
        return {
            success: false,
            error: `RareAnimes resolver failed: ${err?.message}`,
            sources: []
        };
    }
}
