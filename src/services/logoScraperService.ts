import axios from 'axios';

export interface LogoSearchResult {
    logo: string;
    engine: 'curated' | 'iptv_map' | 'logopedia' | 'duckduckgo' | 'yahoo' | 'wikimedia' | 'wikipedia' | 'wikidata' | 'broadcast_svg';
    channelName: string;
    cleanedName: string;
    verified: boolean;
}

export class LogoScraperService {
    private static cache = new Map<string, LogoSearchResult>();

    public static cleanChannelName(rawName: string): string {
        if (!rawName) return '';
        let cl = rawName.trim();
        // Remove stream details inside brackets like [Codecs: H.264 / AVC ...]
        cl = cl.replace(/\[.*?\]|\(.*?\)/g, '');
        // Remove country prefixes like "US: ", "CA: ", "IN: ", "UK: ", "1▁...▁"
        cl = cl.replace(/^[A-Z]{2,3}\s*:\s*/i, '');
        cl = cl.replace(/^[\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\s•☆|💎⭐️]+/, '');
        // Remove common resolution & tag suffixes
        cl = cl.replace(/\b(?:4k|uhd|fhd|hd|sd|1080p|720p|hevc|h264|h265|ca|usa|uk|us|in|india|canada|vip|backup|east|west|latino|multiaudio|cc|24\/7|24x7)\b/gi, '');
        return cl.trim();
    }

    /**
     * Search Logopedia (logos.fandom.com) for high-resolution TV network SVG & PNG logos
     */
    public static async searchLogopedia(cleanName: string): Promise<string | null> {
        try {
            const queries = [
                cleanName,
                `${cleanName} (TV channel)`,
                `${cleanName} TV`
            ];

            const firstWord = cleanName.split(' ')[0].toLowerCase();
            const cleanLower = cleanName.toLowerCase();

            for (const q of queries) {
                const res = await axios.get('https://logos.fandom.com/api.php', {
                    params: {
                        action: 'query',
                        generator: 'search',
                        gsrsearch: q,
                        gsrlimit: 4,
                        prop: 'pageimages|images',
                        pithumbsize: 600,
                        format: 'json'
                    },
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 4000
                });

                const pages = res.data?.query?.pages || {};
                for (const pid in pages) {
                    const p = pages[pid];
                    const titleLower = (p.title || '').toLowerCase();
                    const isRelevant = titleLower.includes(firstWord) || titleLower.includes(cleanLower);

                    // 1. Direct Page Thumbnail
                    if (isRelevant && p.thumbnail?.source) {
                        const src = p.thumbnail.source;
                        if (!src.includes('Prototype') && !src.includes('Screenshot') && !src.includes('Canal%2B') && !src.includes('InfoWhite')) {
                            return src;
                        }
                    }

                    // 2. Specific matching SVG or PNG file attached to this page
                    if (isRelevant && Array.isArray(p.images)) {
                        for (const img of p.images) {
                            const imgTitle = (img.title || '').toLowerCase();
                            if ((imgTitle.includes(firstWord) || imgTitle.includes(cleanLower)) && (imgTitle.endsWith('.svg') || imgTitle.endsWith('.png'))) {
                                if (!imgTitle.includes('prototype') && !imgTitle.includes('infowhite') && !imgTitle.includes('screenshot')) {
                                    const fileRes = await axios.get('https://logos.fandom.com/api.php', {
                                        params: {
                                            action: 'query',
                                            titles: img.title,
                                            prop: 'imageinfo',
                                            iiprop: 'url',
                                            format: 'json'
                                        },
                                        headers: { 'User-Agent': 'Mozilla/5.0' },
                                        timeout: 3000
                                    });
                                    const filePages = fileRes.data?.query?.pages || {};
                                    for (const fpid in filePages) {
                                        const fileUrl = filePages[fpid]?.imageinfo?.[0]?.url;
                                        if (fileUrl) return fileUrl;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * Ensures Wikimedia URLs are converted to direct upload.wikimedia.org links with UTM query params
     * e.g. https://upload.wikimedia.org/wikipedia/commons/6/66/Asianet_Plus_Logo.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original
     */
    public static async normalizeWikimediaUrl(urlOrFileName: string): Promise<string> {
        if (!urlOrFileName) return urlOrFileName;

        // If it's already an upload.wikimedia.org link
        if (urlOrFileName.includes('upload.wikimedia.org')) {
            let clean = urlOrFileName;
            // Strip thumb resizing if present to get clean direct asset
            if (clean.includes('/thumb/')) {
                const match = clean.match(/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/thumb\/([^/]+)\/([^/]+)\/([^/]+)\/[^/?#]+/);
                if (match) {
                    clean = `https://upload.wikimedia.org/wikipedia/${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
                }
            }
            if (!clean.includes('utm_source=')) {
                const separator = clean.includes('?') ? '&' : '?';
                clean += `${separator}utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original`;
            }
            return clean;
        }

        // If it's a Special:FilePath or File: URL, query the Wikimedia imageinfo API to get the direct upload.wikimedia.org URL
        let fileName = '';
        const fileMatch = urlOrFileName.match(/(?:Special:FilePath\/|File:|\/wiki\/File:)([^?#&]+)/i);
        if (fileMatch) {
            fileName = decodeURIComponent(fileMatch[1]);
        }

        if (fileName) {
            try {
                const apiRes = await axios.get('https://commons.wikimedia.org/w/api.php', {
                    params: {
                        action: 'query',
                        titles: fileName.startsWith('File:') ? fileName : 'File:' + fileName,
                        prop: 'imageinfo',
                        iiprop: 'url',
                        format: 'json'
                    },
                    headers: { 'User-Agent': 'StalkerProLogoBot/1.0 (contact@stalkerpro.tv)' },
                    timeout: 3500
                });
                const pages = apiRes.data?.query?.pages || {};
                for (const pid in pages) {
                    const info = pages[pid]?.imageinfo?.[0];
                    if (info?.url && info.url.includes('upload.wikimedia.org')) {
                        let directUrl = info.url;
                        if (!directUrl.includes('utm_source=')) {
                            const separator = directUrl.includes('?') ? '&' : '?';
                            directUrl += `${separator}utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original`;
                        }
                        return directUrl;
                    }
                }
            } catch (e) {}

            return `https://upload.wikimedia.org/wikipedia/commons/wiki/Special:FilePath/${encodeURIComponent(fileName)}?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original`;
        }

        return urlOrFileName;
    }

    /**
     * Search DuckDuckGo Instant API & HTML for channel logo
     */
    public static async searchDuckDuckGo(cleanName: string): Promise<string | null> {
        try {
            // 1. DuckDuckGo Instant Answer / Icon API
            const q = encodeURIComponent(`${cleanName} tv channel logo`);
            const res = await axios.get(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3000
            });

            if (res.data && res.data.Image) {
                const img = res.data.Image;
                const fullUrl = img.startsWith('http') ? img : `https://duckduckgo.com${img}`;
                if (fullUrl.includes('wikimedia.org') || fullUrl.includes('wikipedia.org')) {
                    return await this.normalizeWikimediaUrl(fullUrl);
                }
                return fullUrl;
            }

            if (res.data?.RelatedTopics && Array.isArray(res.data.RelatedTopics)) {
                for (const t of res.data.RelatedTopics) {
                    if (t.Icon && t.Icon.URL) {
                        const iconUrl = t.Icon.URL;
                        const fullUrl = iconUrl.startsWith('http') ? iconUrl : `https://duckduckgo.com${iconUrl}`;
                        if (fullUrl.includes('wikimedia.org') || fullUrl.includes('wikipedia.org')) {
                            return await this.normalizeWikimediaUrl(fullUrl);
                        }
                        return fullUrl;
                    }
                }
            }
        } catch (e) {}

        // 2. DuckDuckGo HTML Fallback Search
        try {
            const q = encodeURIComponent(`${cleanName} channel logo transparent png`);
            const res = await axios.get(`https://html.duckduckgo.com/html/?q=${q}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 4000
            });

            const html = res.data || '';
            const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
            for (const h of hrefs) {
                if (h.includes('uddg=')) {
                    const match = h.match(/uddg=([^&]+)/);
                    if (match) {
                        const decoded = decodeURIComponent(match[1]);
                        const fileMatch = decoded.match(/\/wiki\/File:([^#?]+)/i);
                        if (fileMatch) {
                            return await this.normalizeWikimediaUrl(decoded);
                        }
                        if (decoded.match(/\.(png|svg|webp|jpg|jpeg)$/i) && !decoded.includes('duckduckgo.com')) {
                            if (decoded.includes('wikimedia.org') || decoded.includes('wikipedia.org')) {
                                return await this.normalizeWikimediaUrl(decoded);
                            }
                            return decoded;
                        }
                    }
                }
            }
        } catch (e) {}

        return null;
    }

    /**
     * Search Yahoo Search Engine for channel logo / media files
     */
    public static async searchYahoo(cleanName: string): Promise<string | null> {
        try {
            const q = encodeURIComponent(`${cleanName} channel logo wikipedia png`);
            const res = await axios.get(`https://search.yahoo.com/search?p=${q}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 4000
            });

            const html = res.data || '';
            const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
            for (const h of hrefs) {
                if (h.includes('r.search.yahoo.com')) {
                    const match = h.match(/\/RU=([^/]+)\//);
                    if (match) {
                        const decoded = decodeURIComponent(match[1]);
                        const fileMatch = decoded.match(/\/wiki\/File:([^#?]+)/i);
                        if (fileMatch) {
                            return await this.normalizeWikimediaUrl(decoded);
                        }
                        if (decoded.match(/\.(png|svg|webp|jpg|jpeg)$/i) && !decoded.includes('yimg.com')) {
                            if (decoded.includes('wikimedia.org') || decoded.includes('wikipedia.org')) {
                                return await this.normalizeWikimediaUrl(decoded);
                            }
                            return decoded;
                        }
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * BACKUP 1: Search Wikimedia Commons API for high-resolution PNG or SVG logo files
     */
    public static async searchWikimediaCommons(cleanName: string): Promise<string | null> {
        try {
            const res = await axios.get('https://commons.wikimedia.org/w/api.php', {
                params: {
                    action: 'query',
                    generator: 'search',
                    gsrsearch: `${cleanName} logo filetype:png|svg|jpg`,
                    gsrnamespace: 6,
                    gsrlimit: 4,
                    prop: 'imageinfo',
                    iiprop: 'url',
                    format: 'json'
                },
                headers: { 'User-Agent': 'StalkerProLogoBot/1.0 (contact@stalkerpro.tv)' },
                timeout: 3500
            });

            const pages = res.data?.query?.pages || {};
            for (const pid in pages) {
                const info = pages[pid]?.imageinfo?.[0];
                const u = info?.url || info?.thumburl;
                if (u) {
                    return await this.normalizeWikimediaUrl(u);
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * BACKUP 2: Search Wikipedia API for broadcast channel thumbnail
     */
    public static async searchWikipedia(cleanName: string): Promise<string | null> {
        try {
            const queries = [
                `${cleanName} television channel`,
                `${cleanName} (TV channel)`,
                `${cleanName} TV network`
            ];

            for (const q of queries) {
                const res = await axios.get('https://en.wikipedia.org/w/api.php', {
                    params: {
                        action: 'query',
                        generator: 'search',
                        gsrsearch: q,
                        gsrlimit: 3,
                        prop: 'pageimages',
                        pithumbsize: 512,
                        format: 'json'
                    },
                    headers: { 'User-Agent': 'StalkerProLogoBot/1.0 (contact@stalkerpro.tv)' },
                    timeout: 3500
                });

                const pages = res.data?.query?.pages || {};
                for (const pid in pages) {
                    const thumb = pages[pid]?.thumbnail?.source;
                    if (thumb && (thumb.includes('.png') || thumb.includes('.svg') || thumb.includes('.webp') || thumb.includes('.jpg'))) {
                        return await this.normalizeWikimediaUrl(thumb);
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * BACKUP 3: Search Wikidata P154 (Official Logo Property)
     */
    public static async searchWikidata(cleanName: string): Promise<string | null> {
        try {
            const res = await axios.get('https://www.wikidata.org/w/api.php', {
                params: {
                    action: 'wbsearchentities',
                    search: `${cleanName} television`,
                    language: 'en',
                    limit: 2,
                    format: 'json'
                },
                headers: { 'User-Agent': 'StalkerProLogoBot/1.0 (contact@stalkerpro.tv)' },
                timeout: 3500
            });

            if (res.data?.search && res.data.search.length > 0) {
                for (const entity of res.data.search) {
                    const entityId = entity.id;
                    const entityDetails = await axios.get('https://www.wikidata.org/w/api.php', {
                        params: {
                            action: 'wbgetclaims',
                            entity: entityId,
                            property: 'P154',
                            format: 'json'
                        },
                        headers: { 'User-Agent': 'StalkerProLogoBot/1.0 (contact@stalkerpro.tv)' },
                        timeout: 3000
                    });

                    const claims = entityDetails.data?.claims?.P154;
                    if (claims && claims.length > 0) {
                        const fileName = claims[0]?.mainsnak?.datavalue?.value;
                        if (fileName) {
                            return await this.normalizeWikimediaUrl(fileName);
                        }
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * Comprehensive multi-engine search:
     * 1. Logopedia (logos.fandom.com) -> Primary TV network logo encyclopedia
     * 2. DuckDuckGo Image & Instant API -> Fast Web Search
     * 3. Yahoo Search Scraper -> Direct Media Index
     * 4. Wikimedia / Wikipedia / Wikidata -> Backup Secondary Sources
     */
    public static async searchChannelLogoOnline(channelName: string): Promise<LogoSearchResult | null> {
        const clean = this.cleanChannelName(channelName);
        if (!clean) return null;

        const cacheKey = clean.toLowerCase();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // 1. PRIMARY: Logopedia (logos.fandom.com)
        let logo = await this.searchLogopedia(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'logopedia', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        // 2. DuckDuckGo Scraper (Direct Image / Instant API)
        logo = await this.searchDuckDuckGo(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'duckduckgo', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        // 3. Yahoo Web Scraper
        logo = await this.searchYahoo(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'yahoo', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        // 4. BACKUP: Wikimedia Commons File Search
        logo = await this.searchWikimediaCommons(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'wikimedia', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        // 5. BACKUP: Wikipedia TV Channel Media
        logo = await this.searchWikipedia(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'wikipedia', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        // 6. BACKUP: Wikidata Official Property P154
        logo = await this.searchWikidata(clean);
        if (logo) {
            const result: LogoSearchResult = { logo, engine: 'wikidata', channelName, cleanedName: clean, verified: true };
            this.cache.set(cacheKey, result);
            return result;
        }

        return null;
    }
}
