import { GoogleGenAI } from '@google/genai';

/**
 * Lazy initialization of GoogleGenAI client
 */
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
}

export interface AiContainerResult {
    title: string;
    subtitle: string;
    badge: string;
    bgUrl: string;
    playerPng: string;
    gridBgUrl: string;
    gridStyle: 'shelf' | 'grid' | 'glass_cards' | 'compact_chips' | 'spotlight';
    keywords: string[];
    webSearchQueries?: string[];
    sources?: Array<{ title?: string; uri?: string }>;
}

/**
 * Generates an intelligent Sports Container with Google Web Search Grounding
 */
export async function generateContainerWithWebSearch(prompt: string, availableChannels: any[] = []): Promise<AiContainerResult> {
    const channelNames = availableChannels.slice(0, 50).map(c => c.title || c.name).filter(Boolean);
    
    // Default fallback in case API key is missing or network failure
    const pLower = prompt.toLowerCase();
    const fallbackResult: AiContainerResult = {
        title: prompt.toUpperCase(),
        subtitle: "Curated high-speed sports broadcasts and live event multi-cam streams.",
        badge: "AI SHOWCASE",
        bgUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop",
        playerPng: "https://pngimg.com/d/football_player_PNG11.png",
        gridBgUrl: "",
        gridStyle: "grid",
        keywords: pLower.split(/\s+/).filter(w => w.length > 2)
    };

    if (pLower.includes('cricket') || pLower.includes('ipl') || pLower.includes('icc') || pLower.includes('t20')) {
        fallbackResult.title = fallbackResult.title.includes('CRICKET') ? fallbackResult.title : `${fallbackResult.title} · CRICKET LIVE`;
        fallbackResult.badge = "LIVE CRICKET";
        fallbackResult.subtitle = "Official stadium feeds, dugout Hindi & English commentary, 4K multi-cam coverage.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/cricket_PNG10.png";
        fallbackResult.gridStyle = "shelf";
        fallbackResult.keywords = ['cricket', 'ipl', 'star', 'willow', 'icc', 'sky'];
    } else if (pLower.includes('football') || pLower.includes('soccer') || pLower.includes('champions') || pLower.includes('premier') || pLower.includes('laliga')) {
        fallbackResult.title = fallbackResult.title.includes('FOOTBALL') ? fallbackResult.title : `${fallbackResult.title} · LIVE ARENA`;
        fallbackResult.badge = "CHAMPIONS LEAGUE";
        fallbackResult.subtitle = "Ultra HD 60FPS coverage, tactical broadcast angles, and live match stats.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/football_player_PNG95.png";
        fallbackResult.gridStyle = "grid";
        fallbackResult.keywords = ['football', 'soccer', 'champions', 'premier', 'laliga', 'bein', 'tnt'];
    } else if (pLower.includes('f1') || pLower.includes('racing') || pLower.includes('grand prix')) {
        fallbackResult.title = fallbackResult.title.includes('F1') ? fallbackResult.title : `${fallbackResult.title} · F1 GRAND PRIX`;
        fallbackResult.badge = "F1 SPEEDWAY";
        fallbackResult.subtitle = "Cockpit onboards, team radio channels, live telemetry timing, and pitlane feeds.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/formula_1_PNG27.png";
        fallbackResult.gridStyle = "glass_cards";
        fallbackResult.keywords = ['f1', 'racing', 'grand prix', 'sky', 'speed'];
    } else if (pLower.includes('ufc') || pLower.includes('boxing') || pLower.includes('fight')) {
        fallbackResult.title = fallbackResult.title.includes('FIGHT') ? fallbackResult.title : `${fallbackResult.title} · FIGHT NIGHT`;
        fallbackResult.badge = "OCTAGON LIVE";
        fallbackResult.subtitle = "Main championship cards, preliminary bouts, corner audio streams, and blow-by-blow feeds.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/boxing_PNG82.png";
        fallbackResult.gridStyle = "compact_chips";
        fallbackResult.keywords = ['ufc', 'fight', 'combat', 'boxing', 'mma'];
    } else if (pLower.includes('nba') || pLower.includes('basketball')) {
        fallbackResult.title = fallbackResult.title.includes('NBA') ? fallbackResult.title : `${fallbackResult.title} · NBA SHOWDOWN`;
        fallbackResult.badge = "COURTSIDE LIVE";
        fallbackResult.subtitle = "Courtside 4K camera feeds, rim mic sound, and high-flying playoff action.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/basketball_player_PNG41.png";
        fallbackResult.gridStyle = "spotlight";
        fallbackResult.keywords = ['nba', 'basketball', 'espn'];
    }

    const ai = getGeminiClient();
    if (!ai) {
        return fallbackResult;
    }

    try {
        const systemInstruction = `You are an elite Sports Broadcast & Streaming Showcase Curator.
Your task is to analyze user requests for sports/event channels and search the web using Google Search to discover real-time live events, team logos, stadium visual themes, and channel mappings.
Always output a strictly valid JSON object matching the requested schema.`;

        const userPrompt = `Search the web for real-time information regarding: "${prompt}".
Identify current tournaments, team rosters, official stadium broadcast backgrounds, star athlete cutouts, and keywords.

Available channels in database: ${JSON.stringify(channelNames.slice(0, 30))}

Respond with ONLY a valid JSON object matching this exact TypeScript structure:
{
  "title": "Short punchy uppercase title (e.g. ICC T20 WORLD CUP 2026)",
  "subtitle": "Informative 1-2 sentence subtitle about the live coverage",
  "badge": "2-3 word uppercase badge (e.g. 4K ULTRA HD / WORLD FINALS)",
  "bgUrl": "Direct high-res Unsplash or official stadium background image URL (e.g. https://images.unsplash.com/...)",
  "playerPng": "Direct high quality transparent athlete cutout PNG (or pngimg.com URL)",
  "gridBgUrl": "Optional subtle background texture URL or empty string",
  "gridStyle": "shelf" | "grid" | "glass_cards" | "compact_chips" | "spotlight",
  "keywords": ["array", "of", "matching", "channel", "name", "keywords"]
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || '';
        const searchMetadata = response.candidates?.[0]?.groundingMetadata;
        const webSearchQueries = searchMetadata?.webSearchQueries || [];
        const sources = searchMetadata?.groundingChunks?.map(chunk => ({
            title: chunk.web?.title,
            uri: chunk.web?.uri
        })).filter(s => s.uri) || [];

        if (text) {
            const parsed = JSON.parse(text);
            return {
                title: parsed.title || fallbackResult.title,
                subtitle: parsed.subtitle || fallbackResult.subtitle,
                badge: parsed.badge || fallbackResult.badge,
                bgUrl: parsed.bgUrl || fallbackResult.bgUrl,
                playerPng: parsed.playerPng || fallbackResult.playerPng,
                gridBgUrl: parsed.gridBgUrl || fallbackResult.gridBgUrl,
                gridStyle: ['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(parsed.gridStyle) 
                    ? parsed.gridStyle 
                    : fallbackResult.gridStyle,
                keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 
                    ? parsed.keywords.map((k: string) => String(k).toLowerCase()) 
                    : fallbackResult.keywords,
                webSearchQueries,
                sources
            };
        }
    } catch (e) {
        console.warn('[AI Service] Gemini Web Search Grounding error, falling back to local heuristic:', e);
    }

    return fallbackResult;
}

/**
 * Intelligent AI Broadcast Assistant with Persona & Live Web Search Grounding
 */
export async function queryAiBroadcastAssistant(
    query: string,
    persona: string = 'copilot',
    enableGrounding: boolean = true
): Promise<{
    answer: string;
    webSearchQueries: string[];
    sources: Array<{ title?: string; uri?: string }>;
}> {
    const personaConfigs: Record<string, { role: string; systemPrompt: string }> = {
        copilot: {
            role: "Entertainment & Sports Broadcast Copilot",
            systemPrompt: "You are the Entertainment & Media Copilot for Stalker Pro 2.0. You provide real-time sports fixture dates, timings, official TV network broadcast channels (Sky, TNT, Star Sports, Sony, FanCode, Willow, Prime), movie/series streaming insights, and IPTV recommendations. Format clearly with Markdown headers, bullet points, and key details."
        },
        pro_polymath: {
            role: "Quantum Polymath Intelligence",
            systemPrompt: "You are the Quantum Polymath Intelligence for Stalker Pro 2.0. You provide deep technical analysis, algorithmic reasoning, network protocol optimization (HLS, DASH, WebSockets, TCP/UDP), security threat modeling, and high-level architectural solutions. Be thorough, rigorous, and technically precise."
        },
        fast_assistant: {
            role: "Lightning Fast Assistant",
            systemPrompt: "You are the Lightning Fast Assistant for Stalker Pro 2.0. Provide ultra-concise, rapid, direct answers without unnecessary filler. Deliver immediate answers in bullet points or short punchy sentences."
        },
        scraper_healer: {
            role: "Scraper Auto-Healer & Stream Diagnostic Expert",
            systemPrompt: "You are the Scraper Auto-Healer and Stream Diagnostic Expert for Stalker Pro 2.0. You diagnose video stream failures, analyze m3u8 playlists, DASH MPD manifests, W3C ClearKey DRM, CORS proxy headers, AES-128 segment decryption, and recommend concrete fixes for web scrapers and media pipelines."
        }
    };

    const activeConfig = personaConfigs[persona] || personaConfigs.copilot;
    const ai = getGeminiClient();

    if (!ai) {
        // High quality local mode fallbacks based on persona and query
        const pLower = query.toLowerCase();
        let localAnswer = `### [Local AI Mode · ${activeConfig.role}]\n\n`;

        if (persona === 'scraper_healer') {
            localAnswer += `**Stream Pipeline Diagnostic for:** "${query}"\n\n` +
                `- **ClearKey DRM Validation**: Ensure manifest injects W3C ClearKey UUID (\`urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b\`) and hex keys match.\n` +
                `- **Akamai Token Inheritance**: Verify \`__hdnea__\` token query string is retained during segment redirection.\n` +
                `- **CORS Proxy Pipeline**: Check that Access-Control-Allow-Origin: * and custom Referer/Origin headers are forwarded via \`/live.php\`.\n` +
                `- **HLS Pre-fetch RAM Buffer**: Verify active edge TS segments are cached without RIFF/WebP fake headers.`;
        } else if (persona === 'pro_polymath') {
            localAnswer += `**Algorithmic & Systems Analysis for:** "${query}"\n\n` +
                `- **Concurrency Model**: Node.js event-loop with in-memory non-blocking RAM caches ensures low-overhead proxying under high load.\n` +
                `- **Cryptographic Handshake**: Stalker portal Wanda cipher operates on XOR byte permutation with dynamic device binding salt.\n` +
                `- **Adaptive Bitrate Switching**: Master playlists expose multi-rendition HLS streams sorted descending by bandwidth.`;
        } else if (persona === 'fast_assistant') {
            localAnswer += `**Instant Answer:**\n\n` +
                `- Target: "${query}"\n` +
                `- Status: Online & Ready\n` +
                `- Recommendation: Connect to master sports M3U or Bingr s40 cluster for optimal throughput.`;
        } else {
            localAnswer += `**Entertainment & Sports Intelligence:**\n\n` +
                `- Live sports feeds are actively synchronized across Willow, FanCode, SonyLIV, and Star Sports.\n` +
                `- Configure \`GEMINI_API_KEY\` in environment settings to enable live real-time Google Web Search Grounding for live match fixtures and instant web schedules.`;
        }

        return {
            answer: localAnswer,
            webSearchQueries: [],
            sources: []
        };
    }

    try {
        const configOptions: any = {
            systemInstruction: activeConfig.systemPrompt
        };

        if (enableGrounding) {
            configOptions.tools = [{ googleSearch: {} }];
        }

        const promptText = `User query: "${query}"\n\nPersona: ${activeConfig.role}.\nPlease provide a comprehensive, accurate, and cleanly formatted response.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: promptText,
            config: configOptions
        });

        const searchMetadata = response.candidates?.[0]?.groundingMetadata;
        const webSearchQueries = searchMetadata?.webSearchQueries || [];
        const sources = searchMetadata?.groundingChunks?.map(chunk => ({
            title: chunk.web?.title,
            uri: chunk.web?.uri
        })).filter(s => s.uri) || [];

        return {
            answer: response.text || "No response generated.",
            webSearchQueries,
            sources
        };
    } catch (e: any) {
        return {
            answer: `Unable to complete AI query: ${e.message || String(e)}`,
            webSearchQueries: [],
            sources: []
        };
    }
}

