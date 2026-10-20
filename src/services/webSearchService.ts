import axios from 'axios';

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
    source?: string;
}

export class WebSearchService {
    /**
     * Search the live web using DuckDuckGo HTML & Wikipedia APIs (100% Free, Zero API Keys, Unlimited)
     */
    static async searchLiveWeb(query: string, limit: number = 5): Promise<WebSearchResult[]> {
        const cleanQ = (query || '').trim();
        if (!cleanQ) return [];

        const results: WebSearchResult[] = [];

        // 1. DuckDuckGo HTML Instant Search
        try {
            const searchUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(cleanQ);
            const res = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 5000
            });

            const html = res.data || '';
            const titleRegex = new RegExp('<h2 class="result__title">[\\s\\S]*?<a class="result__url"[^>]*href="([^"]*)"[^>]*>([\\s\\S]*?)<\\/a>', 'gi');
            const snippetRegex = new RegExp('<a class="result__snippet[^>]*>([\\s\\S]*?)<\\/a>', 'gi');

            const titleMatches = [...html.matchAll(titleRegex)];
            const snippetMatches = [...html.matchAll(snippetRegex)];

            for (let i = 0; i < Math.min(titleMatches.length, limit); i++) {
                const rawUrl = titleMatches[i][1]?.trim();
                let cleanUrl = rawUrl;
                // Parse duckduckgo redirect URL
                const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
                if (uddgMatch) {
                    cleanUrl = decodeURIComponent(uddgMatch[1]);
                }

                const title = titleMatches[i][2]?.replace(/<[^>]*>/g, '').trim();
                const snippet = snippetMatches[i] ? snippetMatches[i][1]?.replace(/<[^>]*>/g, '').trim() : '';

                if (title && cleanUrl && !cleanUrl.includes('duckduckgo.com')) {
                    results.push({
                        title: title,
                        url: cleanUrl,
                        snippet: snippet.slice(0, 220),
                        source: new URL(cleanUrl).hostname.replace('www.', '')
                    });
                }
            }
        } catch (e: any) {
            console.warn('[WebSearchService] DuckDuckGo notice:', e.message);
        }

        // 2. Wikipedia Summary Fallback
        if (results.length === 0) {
            try {
                const wikiRes = await axios.get('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(cleanQ) + '&utf8=&format=json', { timeout: 4000 });
                const wikiItems = wikiRes.data?.query?.search || [];
                for (const item of wikiItems.slice(0, 3)) {
                    results.push({
                        title: item.title,
                        url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(item.title.replace(/\s+/g, '_')),
                        snippet: item.snippet?.replace(/<[^>]*>/g, '') || '',
                        source: 'wikipedia.org'
                    });
                }
            } catch (e) {}
        }

        return results;
    }

    /**
     * Generate structured live web context to feed into Gemini/OpenRouter/Groq prompts
     */
    static async getWebContextForAi(userPrompt: string): Promise<string> {
        const p = userPrompt.toLowerCase();
        
        // Check if query needs real-time live web facts
        const needsSearch = /search|who is|what is|when is|why did|latest|news|weather|score|price|release date|cast|review|facts|wiki|explain|tell me about|how to|trailer/i.test(p);
        if (!needsSearch && p.length < 15) return '';

        const searchResults = await this.searchLiveWeb(userPrompt, 4);
        if (!searchResults.length) return '';

        let context = '\n=== REAL-TIME LIVE WEB SEARCH TELEMETRY (Current Search Query: "' + userPrompt + '") ===\n';
        searchResults.forEach((r, idx) => {
            context += '[' + (idx + 1) + '] "' + r.title + '" (Source: ' + (r.source || r.url) + ')\n';
            context += '    ' + r.snippet + '\n    Link: ' + r.url + '\n\n';
        });

        return context;
    }
}
