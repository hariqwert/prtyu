import { YouTubeService } from './youtubeService';
import { WebSearchService } from './webSearchService';
import { MusicService } from './musicService';
import { SubtitleService } from './subtitleService';
import { LiveDataAggregator, SportsScoreService, NewsService, WeatherService } from './liveDataService';
import { EpgService } from './epgService';
import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { SITE_MAP, UrlGenerator } from './siteMap';
import { getChannelsList, getChannelStreamUrl } from './channelJsonService';
import { SportsScraperService, SportsEvent, SuperSportChannel, SportsMatchBroadcasterResolver } from './sportsScraperService';
import { searchBingr } from './bingrScraperService';
import { GeminiChatService } from './geminiChatService';

const router = Router();

// TMDB Multi-Key Fallback Engine for Movie & TV Intelligence
const TMDB_KEYS = [
    '9d83476d2e27f56748167514c69cd2b4',
    'b7cd3340179e838e124806a38615b80b',
    '15d2ade9021b7e86aa7e0e11de3733dd',
    '4f82155ee320c0d313bb4ffd52f3974e'
];

export function cleanMediaTitle(rawQuery: string): string {
    if (!rawQuery) return '';
    return rawQuery
        .replace(/^(?:play|watch|stream|put on|start|tune into|show me|find|search|tell me about|info about|details on|what is the movie|movie|film|tv show|series|anime)\s+/i, '')
        .replace(/\s+(?:movie|film|series|show|in 4k|in hindi|in english|with subtitles|full movie|season\s*\d+|episode\s*\d+|s\d+\s*e\d+|via\s+\w+|on\s+\w+)$/i, '')
        .trim();
}

export async function fetchTmdbMedia(query: string, type: 'multi' | 'movie' | 'tv' = 'multi'): Promise<any[]> {
    const cleaned = cleanMediaTitle(query) || query;
    if (!cleaned) return [];

    // 1. Try TMDB keys with 5000ms timeout
    for (const key of TMDB_KEYS) {
        try {
            const url = `https://api.themoviedb.org/3/search/${type}?api_key=${key}&query=${encodeURIComponent(cleaned)}&include_adult=false`;
            const resp = await axios.get(url, { timeout: 5000 });
            if (resp.data && resp.data.results && resp.data.results.length > 0) {
                return resp.data.results
                    .filter((r: any) => r && r.media_type !== 'person')
                    .map((item: any) => {
                        const actualType = item.media_type || (item.title ? 'movie' : 'tv');
                        const title = item.title || item.name || 'Untitled';
                        const year = (item.release_date || item.first_air_date || '').substring(0, 4) || '2024';
                        const poster = item.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
                            : (item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400');
                        const backdrop = item.backdrop_path 
                            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
                            : poster;
                        const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.8';

                        return {
                            id: item.id,
                            tmdbId: item.id,
                            title: title,
                            name: title,
                            media_type: actualType,
                            type: actualType,
                            year: year,
                            rating: rating,
                            vote_average: item.vote_average,
                            overview: item.overview || `Watch ${title} in 4K Ultra HD with multiple high-speed streaming servers.`,
                            poster: poster,
                            backdrop: backdrop,
                            playUrl: `/consumet.html?player=true&id=${item.id}&type=${actualType}&s=1&e=1&server=vidrift`,
                            cinemaUrl: `/consumet.html?player=true&id=${item.id}&type=${actualType}&s=1&e=1&server=vidrift`,
                            infoUrl: `/info.html?id=${item.id}&type=${actualType}`,
                            torrentUrl: UrlGenerator.generateTorrentUrl(title, actualType, 1, 1),
                            servers: {
                                vidapi: actualType === 'tv' ? `https://vidapi.xyz/embed/tv/${item.id}/1/1` : `https://vidapi.xyz/embed/movie/${item.id}`,
                                vidlink: actualType === 'tv' ? `https://vidlink.pro/tv/${item.id}/1/1?autoplay=true` : `https://vidlink.pro/movie/${item.id}?autoplay=true`,
                                vidsrc: actualType === 'tv' ? `https://vidsrc.to/embed/tv/${item.id}/1/1` : `https://vidsrc.to/embed/movie/${item.id}`,
                                vidsrc_pro: actualType === 'tv' ? `https://vidsrc.pro/embed/tv/${item.id}/1/1` : `https://vidsrc.pro/embed/movie/${item.id}`,
                                superembed: actualType === 'tv' ? `https://multiembed.mov/directstream.php?video_id=${item.id}&tmdb=1&s=1&e=1` : `https://multiembed.mov/directstream.php?video_id=${item.id}&tmdb=1`,
                                embedsu: actualType === 'tv' ? `https://embed.su/embed/tv/${item.id}/1/1` : `https://embed.su/embed/movie/${item.id}`,
                                twoembed: actualType === 'tv' ? `https://www.2embed.cc/embedtv/${item.id}?s=1&e=1` : `https://www.2embed.cc/embed/${item.id}`,
                                autoembed: actualType === 'tv' ? `https://player.autoembed.cc/embed/tv/${item.id}/1/1` : `https://player.autoembed.cc/embed/movie/${item.id}`,
                                vidrift: actualType === 'tv' ? `https://embed.vidrift.in/embed/tv/${item.id}/1/1` : `https://embed.vidrift.in/embed/movie/${item.id}`,
                                vidbinge: actualType === 'tv' ? `https://vidbinge.dev/embed/tv/${item.id}/1/1` : `https://vidbinge.dev/embed/movie/${item.id}`
                            }
                        };
                    });
            }
        } catch (e: any) {
            // Try next key
        }
    }

    // 2. High-speed Fallback: Bingr Scraper Gateway Search
    try {
        const bingrData = await searchBingr(cleaned);
        if (bingrData?.results && bingrData.results.length > 0) {
            return bingrData.results.map((b: any) => {
                const actualType = b.type === 'tv' || b.media_type === 'tv' ? 'tv' : 'movie';
                const title = b.title || b.name || cleaned;
                const poster = b.poster || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400';
                const backdrop = b.backdrop || poster;
                const rating = b.rating || '7.9';
                const year = b.year || '2024';

                return {
                    id: b.id,
                    tmdbId: b.id,
                    title: title,
                    name: title,
                    media_type: actualType,
                    type: actualType,
                    year: year,
                    rating: rating,
                    vote_average: parseFloat(rating),
                    overview: b.overview || `Watch ${title} in 4K Ultra HD with multiple high-speed streaming servers.`,
                    poster: poster,
                    backdrop: backdrop,
                    playUrl: `/consumet.html?player=true&id=${b.id}&type=${actualType}&s=1&e=1&server=vidrift`,
                    cinemaUrl: `/consumet.html?player=true&id=${b.id}&type=${actualType}&s=1&e=1&server=vidrift`,
                    infoUrl: `/info.html?id=${b.id}&type=${actualType}`,
                    torrentUrl: UrlGenerator.generateTorrentUrl(title, actualType, 1, 1),
                    servers: {
                        vidapi: actualType === 'tv' ? `https://vidapi.xyz/embed/tv/${b.id}/1/1` : `https://vidapi.xyz/embed/movie/${b.id}`,
                        vidlink: actualType === 'tv' ? `https://vidlink.pro/tv/${b.id}/1/1?autoplay=true` : `https://vidlink.pro/movie/${b.id}?autoplay=true`,
                        vidsrc: actualType === 'tv' ? `https://vidsrc.to/embed/tv/${b.id}/1/1` : `https://vidsrc.to/embed/movie/${b.id}`,
                        vidsrc_pro: actualType === 'tv' ? `https://vidsrc.pro/embed/tv/${b.id}/1/1` : `https://vidsrc.pro/embed/movie/${b.id}`,
                        superembed: actualType === 'tv' ? `https://multiembed.mov/directstream.php?video_id=${b.id}&tmdb=1&s=1&e=1` : `https://multiembed.mov/directstream.php?video_id=${b.id}&tmdb=1`,
                        embedsu: actualType === 'tv' ? `https://embed.su/embed/tv/${b.id}/1/1` : `https://embed.su/embed/movie/${b.id}`,
                        twoembed: actualType === 'tv' ? `https://www.2embed.cc/embedtv/${b.id}?s=1&e=1` : `https://www.2embed.cc/embed/${b.id}`,
                        autoembed: actualType === 'tv' ? `https://player.autoembed.cc/embed/tv/${b.id}/1/1` : `https://player.autoembed.cc/embed/movie/${b.id}`,
                        vidrift: actualType === 'tv' ? `https://embed.vidrift.in/embed/tv/${b.id}/1/1` : `https://embed.vidrift.in/embed/movie/${b.id}`,
                        vidbinge: actualType === 'tv' ? `https://vidbinge.dev/embed/tv/${b.id}/1/1` : `https://vidbinge.dev/embed/movie/${b.id}`
                    }
                };
            });
        }
    } catch (e: any) {}

    return [];
}

function similarityScore(s1: string, s2: string): number {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 85;
    
    const tokensA = new Set(a.split(/[\s\-_:,|.]+/).filter(t => t.length > 1));
    const tokensB = new Set(b.split(/[\s\-_:,|.]+/).filter(t => t.length > 1));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    
    let intersection = 0;
    tokensA.forEach(t => {
        if (tokensB.has(t)) intersection++;
    });
    
    const union = new Set([...tokensA, ...tokensB]).size;
    return Math.round((intersection / union) * 100);
}

export interface AIIntentResult {
    intent: 'PLAY_MOVIE' | 'PLAY_TV' | 'PLAY_SPORTS_EVENT' | 'PLAY_CHANNEL' | 'PLAY_MUSIC' | 'CREATE_PLAYLIST' | 'READ_BOOK' | 'STALKER_PORTAL' | 'NAVIGATE' | 'CONTROL' | 'GET_INFO' | 'RECOMMENDATION' | 'GREETING' | 'HELP' | 'SEARCH_ALL' | 'CHAT' | 'LIVE_SCORES' | 'WEATHER_REPORT' | 'NEWS_HEADLINES' | 'PLAY_YOUTUBE' | 'ADMIN_SWITCH_MODEL' | 'ADMIN_OPEN_GRID';
    confidence: number;
    query: string;
    targetQuery?: string;
    params?: Record<string, any>;
    chatResponse: string;
    speechText: string;
    data?: any;
    playlistName?: string;
    playlistSongs?: string[];
}

import { GoogleGenAI } from '@google/genai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

function parseJsonResponse(rawText: string): any {
    if (!rawText) return null;
    let clean = rawText.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
        return JSON.parse(clean);
    } catch (e) {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (err) {}
        }
    }
    return null;
}

async function queryMultiTierLLM(userPrompt: string, conversationHistory: Array<{ role: string; content: string }> = []): Promise<{
    intent?: string;
    target?: string;
    mediaType?: string;
    chatResponse?: string;
    explanation?: string;
    season?: number;
    episode?: number;
} | null> {
    const cleanHistory = (conversationHistory || []).slice(-4).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || ''
    }));

    const systemPrompt = `You are Aetheris Quantum AI, the supreme neural intelligence for the Stalker Pro entertainment platform.
You are the entertainment controller for Stalker Pro & Aetheris. You are also a highly capable AI assistant capable of answering questions, writing lengthy responses, rendering math equations, and executing commands.
- If the user asks to play, watch, or stream a movie/film (e.g. "play Inception in 4k", "watch Oppenheimer", "play movie Interstellar"), set intent to "PLAY_MOVIE" and extract the movie title into "target".
- If the user asks to play/watch a TV series (e.g. "play Breaking Bad", "watch Stranger Things"), set intent to "PLAY_TV".
- If the user asks to play/watch a Live TV channel (e.g. "play Star Sports 1", "watch HBO", "CNN"), set intent to "PLAY_CHANNEL".
- If the user asks to search or play a YouTube video or trailer (e.g. "play trailer of Inception", "youtube video of Lofi Beats"), set intent to "PLAY_YOUTUBE".
- If the user asks to play or search a song/music (e.g. "play song Believer", "listen to Arijit Singh"), set intent to "PLAY_MUSIC".
- If the user asks a question, trivia, science, history, math equation, or conversation, set intent to "CHAT" and provide a detailed, accurate, and properly formatted answer (using Markdown and LaTeX for math if needed).
- For general knowledge, science, facts, trivia, Q&A, greetings, or conversational questions, ALWAYS set intent to "CHAT".
- SECRET ADMIN COMMANDS: If the user inputs exactly "/switch provider" or mentions switching models providers, set intent to "ADMIN_SWITCH_MODEL". If the user inputs "/open grids" or mentions opening grids directly, set intent to "ADMIN_OPEN_GRID".
- Set intent to "PLAY_MOVIE" ONLY if the user specifically requests to watch/play a movie.
- Set intent to "PLAY_TV" ONLY if the user specifically requests to watch/play a TV series.
- Set intent to "PLAY_CHANNEL" ONLY if the user specifically requests a live TV channel (e.g. Star Sports, HBO, CNN).
- Set intent to "PLAY_MUSIC" ONLY if the user specifically asks to play a song/music.
- Set intent to "CREATE_PLAYLIST" if the user asks to create a playlist with a specific name and list of songs. Set "playlistName" to the requested name, and "playlistSongs" to an array of song titles.
- Set intent to "PLAY_YOUTUBE" ONLY if the user specifically asks for YouTube or video trailers.

CRITICAL INSTRUCTION: You MUST respond ONLY in valid JSON format. Do not add markdown code blocks or extra text around the JSON object. Example:
{"chatResponse": "Your markdown text here...", "intent": "CHAT", "target": "extracted query"}`;

    // ----------------------------------------------------
    // TIER 1: GOOGLE GEMINI NATIVE PRIMARY (gemini-3.5-flash, gemini-3.1-flash-lite)
    // ----------------------------------------------------
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
        const isComplex = userPrompt.length > 250 || /analyze|proof|math|code|algorithm|philosophy|script|compare|theory/i.test(userPrompt);
        const isFast = userPrompt.length < 40 && !isComplex;
        const targetModel = isFast ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';

        for (const geminiModel of [targetModel, 'gemini-3.5-flash', 'gemini-3.1-flash-lite']) {
            try {
                console.log(`[LLM Pipeline] Calling Tier 1 Primary: Google Gemini (${geminiModel})...`);
                const ai = new GoogleGenAI({ apiKey: geminiKey });
                const contents = [
                    ...cleanHistory.map(h => ({
                        role: h.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: h.content }]
                    })),
                    {
                        role: 'user',
                        parts: [{ text: userPrompt }]
                    }
                ];

                const response = await ai.models.generateContent({
                    model: geminiModel,
                    contents: contents,
                    config: {
                        systemInstruction: systemPrompt,
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                        responseMimeType: 'application/json'
                    }
                });

                const text = response.text;
                if (text) {
                    const parsed = parseJsonResponse(text);
                    if (parsed && (parsed.chatResponse || parsed.intent)) {
                        console.log(`[LLM Pipeline] Tier 1 Google Gemini (${geminiModel}) Success`);
                        return parsed;
                    }
                }
            } catch (e: any) {
                console.warn(`[LLM Pipeline] Tier 1 Google Gemini (${geminiModel}) Failed:`, e.message);
            }
        }
    }

    // ----------------------------------------------------
    // TIER 2: OPENROUTER API FALLBACK
    // ----------------------------------------------------
    const openRouterModels = [
        'google/gemini-2.5-flash',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct',
        'openrouter/auto',
        'deepseek/deepseek-r1-distill-llama-70b',
        'qwen/qwen-2.5-coder-32b-instruct'
    ];

    for (const modelName of openRouterModels) {
        try {
            console.log(`[LLM Pipeline] Calling Tier 1 Primary: OpenRouter API (${modelName})...`);
            const messages = [
                { role: 'system', content: systemPrompt },
                ...cleanHistory,
                { role: 'user', content: userPrompt }
            ];

            let res;
            try {
                res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: modelName,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    tools: [
                        { type: "openrouter:web_search" }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://stalker-pro.local',
                        'X-Title': 'Stalker Pro Quantum Matrix'
                    },
                    timeout: 4000
                });
            } catch (toolErr: any) {
                const errMsg = toolErr.response?.data?.error?.message || toolErr.message || '';
                if (errMsg.includes('tool') || errMsg.includes('support') || toolErr.code === 'ECONNABORTED' || toolErr.message?.includes('timeout')) {
                    console.log(`[LLM Pipeline] Model ${modelName} tool call failed (${errMsg}), retrying standard call...`);
                    res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                        model: modelName,
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 1000
                    }, {
                        headers: {
                            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': 'https://stalker-pro.local',
                            'X-Title': 'Stalker Pro Quantum Matrix'
                        },
                        timeout: 3500
                    });
                } else {
                    throw toolErr;
                }
            }

            const content = res.data?.choices?.[0]?.message?.content;
            if (content) {
                const parsed = parseJsonResponse(content);
                if (parsed && (parsed.chatResponse || parsed.intent)) {
                    console.log(`[LLM Pipeline] Tier 2 OpenRouter Primary (${modelName}) Success`);
                    if (parsed.chatResponse) {
                        parsed.chatResponse += "\n\n> ⚠️ **Notice:** Real-time Google Search Grounding is temporarily disabled because your Gemini API quota was exceeded. This response was generated by a fallback model and may not contain live data.";
                    }
                    return parsed;
                }
            }
        } catch (e: any) {
            console.warn(`[LLM Pipeline] Tier 2 OpenRouter (${modelName}) Failed:`, e.response?.data?.error?.message || e.message);
        }
    }

    // ----------------------------------------------------
    // TIER 3: GROQ API THIRD ("grow")
    // ----------------------------------------------------
    if (GROQ_API_KEY) {
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        for (const groqModel of groqModels) {
            try {
                console.log(`[LLM Pipeline] Calling Tier 3: Groq API (${groqModel})...`);
                const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: groqModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.6,
                    max_tokens: 2000
                }, {
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 3500
                });

                const content = res.data?.choices?.[0]?.message?.content;
                if (content) {
                    const parsed = parseJsonResponse(content);
                    if (parsed && (parsed.chatResponse || parsed.intent)) {
                        console.log(`[LLM Pipeline] Tier 3 Groq (${groqModel}) Success`);
                        if (parsed.chatResponse) {
                            parsed.chatResponse += "\n\n> ⚠️ **Notice:** Real-time Google Search Grounding is temporarily disabled because your Gemini API quota was exceeded. This response was generated by a fallback model and may not contain live data.";
                        }
                        return parsed;
                    }
                }
            } catch (e: any) {
                console.warn(`[LLM Pipeline] Tier 3 Groq (${groqModel}) Failed:`, e.message);
            }
        }
    }

    return null;
}

export function parseLocalIntent(rawInput: string): AIIntentResult {
    const input = (rawInput || '').trim();
    const lower = input.toLowerCase();

    // SECRET ADMIN COMMANDS
    if (/^\/?(switch\s*provider|switch\s*model|switch\s*models?\s*providers?|provider|model)$/i.test(lower) || lower.includes('switch provider') || lower.includes('switch model')) {
        return {
            intent: 'ADMIN_SWITCH_MODEL',
            confidence: 1.0,
            query: input,
            params: { provider: 'openrouter' },
            chatResponse: `⚡ **Secret Admin Command Executed**: Switched primary AI model provider cluster to **OpenRouter / Puter.js (Gemini 2.5 Flash / Perplexity Sonar)**.`,
            speechText: 'Model provider switched successfully.'
        };
    }

    if (/^\/?(open\s*grids?|grid|opengrids?|show\s*grid)$/i.test(lower) || lower.includes('open grid') || lower.includes('opengrid')) {
        return {
            intent: 'ADMIN_OPEN_GRID',
            confidence: 1.0,
            query: input,
            params: { grid: 'unlocked' },
            chatResponse: `🔓 **Secret Admin Command Executed**: IPTV & Media Grids unlocked and opened directly.`,
            speechText: 'Secure grid unlocked.'
        };
    }

    // 0. GREETING
    if (/^(hi|hello|hey|yo|greetings|hola|namaste|sup|good morning|good evening|good afternoon)/i.test(lower) && lower.length < 25) {
        return {
            intent: 'GREETING',
            confidence: 0.99,
            query: input,
            params: {},
            chatResponse: `Hello! I am **Aetheris Quantum AI**, your neural entertainment copilot. I can answer questions, launch 4K movies, TV series, live sports, 5,200+ IPTV channels, and lossless music. How can I assist you today?`,
            speechText: 'Hello! I am Aetheris Quantum AI. How can I assist you today?'
        };
    }

    const clean = cleanMediaTitle(input) || input;

    // 1. MUSIC & SONGS
    if (/song|music|sing|track|audio|mp3|album|artist|playlist|audius|saavn/i.test(lower)) {
        return {
            intent: 'PLAY_MUSIC',
            confidence: 0.95,
            query: input,
            targetQuery: clean,
            params: { title: clean },
            chatResponse: `Searching 320kbps lossless music network for **"${clean}"**:`,
            speechText: `Playing ${clean} music.`
        };
    }

    // 2. YOUTUBE
    if (/youtube|trailer|yt|video|clip/i.test(lower)) {
        return {
            intent: 'PLAY_YOUTUBE',
            confidence: 0.95,
            query: input,
            targetQuery: clean,
            params: { title: clean },
            chatResponse: `Searching 4K YouTube network for **"${clean}"**:`,
            speechText: `Searching YouTube for ${clean}.`
        };
    }

    // 3. SPORTS
    if (/sport|match|cricket|football|soccer|score|f1|wwe|nba|ipl|t20|premier league/i.test(lower)) {
        return {
            intent: 'PLAY_SPORTS_EVENT',
            confidence: 0.95,
            query: input,
            targetQuery: clean,
            params: { title: clean },
            chatResponse: `Fetching live sports match broadcasts & fixtures for **"${clean}"**:`,
            speechText: `Fetching sports for ${clean}.`
        };
    }

    // 4. MOVIES & TV SHOWS
    if (/movie|film|watch|play|stream|cinema|4k|series|show|episode|season/i.test(lower)) {
        return {
            intent: 'PLAY_MOVIE',
            confidence: 0.95,
            query: input,
            targetQuery: clean,
            params: { title: clean },
            chatResponse: `Launching 4K Cinema library stream for **"${clean}"**:`,
            speechText: `Playing ${clean}.`
        };
    }

    // 5. IPTV CHANNELS
    if (/channel|tv|live|hbo|star sports|espn|cnn|bbc|news/i.test(lower)) {
        return {
            intent: 'PLAY_CHANNEL',
            confidence: 0.95,
            query: input,
            targetQuery: clean,
            params: { title: clean },
            chatResponse: `Tuning into IPTV broadcast network for **"${clean}"**:`,
            speechText: `Tuning into ${clean}.`
        };
    }

    // Default Conversational Fallback (no "Thinking about ..." placeholder!)
    return {
        intent: 'CHAT',
        confidence: 0.85,
        query: input,
        targetQuery: clean,
        params: { query: input },
        chatResponse: `I am **Aetheris Quantum AI**. You can ask me to launch any 4K movie, search YouTube videos, stream 320kbps lossless music, or tune into live sports and 5,200+ IPTV channels. How can I help you with **"${input}"**?`,
        speechText: `How can I help you with ${input}?`
    };
}

// ----------------------------------------------------
// AI REST API Endpoints
// ----------------------------------------------------

router.post('/query', async (req: Request, res: Response) => {
    try {
        const userPrompt = (req.body.prompt || req.body.query || '').trim();
        const conversationHistory = Array.isArray(req.body.history) ? req.body.history : [];
        if (!userPrompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('[AI Query Request Received]:', userPrompt);

        // Instant fast-path for Secret Admin Commands
        const cleanP = userPrompt.toLowerCase();
        if (/^\/?(switch\s*provider|switch\s*model|switch\s*models?\s*providers?|provider|model|open\s*grids?|grid|opengrids?|show\s*grid)$/i.test(cleanP) || cleanP.includes('switch provider') || cleanP.includes('switch model') || cleanP.includes('open grid') || cleanP.includes('opengrid')) {
            const adminRes = parseLocalIntent(userPrompt);
            return res.json(adminRes);
        }

        // Instant fast-path for short greetings (< 10ms)
        if (/^(hi|hello|hey|yo|greetings|hola|namaste|sup)$/i.test(cleanP)) {
            const fastGreet = parseLocalIntent(userPrompt);
            return res.json(fastGreet);
        }

        // Fast-path for explicit movie requests (e.g. "play Inception in 4k", "play movie Interstellar")
        if (/^(?:play|watch|stream)\s+(?:the\s+)?(?:movie\s+|film\s+)?([^\?]+?)(?:\s+in\s+4k|\s+in\s+hd|\s+movie|\s+film)?$/i.test(cleanP) && !cleanP.includes('channel') && !cleanP.includes('sports') && !cleanP.includes('who') && !cleanP.includes('what') && !cleanP.includes('how')) {
            const match = cleanP.match(/^(?:play|watch|stream)\s+(?:the\s+)?(?:movie\s+|film\s+)?([^\?]+?)(?:\s+in\s+4k|\s+in\s+hd|\s+movie|\s+film)?$/i);
            const extractedTitle = cleanMediaTitle(match ? match[1] : userPrompt);
            if (extractedTitle && extractedTitle.length > 1) {
                const moviesList = await fetchTmdbMedia(extractedTitle, 'movie');
                if (moviesList && moviesList.length > 0) {
                    const topMedia = moviesList[0];
                    return res.json({
                        status: 'success',
                        intent: 'PLAY_MOVIE',
                        confidence: 0.99,
                        chatResponse: `Launching **${topMedia.title}** (${topMedia.year}) on primary server **Vidrift Direct** in 4K Ultra HD.`,
                        speechText: `Playing ${topMedia.title} on Vidrift.`,
                        targetQuery: topMedia.title,
                        actions: [{
                            type: 'PLAY_MOVIE',
                            tmdbId: topMedia.id,
                            mediaType: 'movie',
                            title: topMedia.title,
                            season: 1,
                            episode: 1,
                            server: 'vidrift',
                            poster: topMedia.poster,
                            backdrop: topMedia.backdrop,
                            playUrl: `/consumet.html?player=true&id=${topMedia.id}&type=movie&s=1&e=1&server=vidrift`,
                            cinemaUrl: `/consumet.html?player=true&id=${topMedia.id}&type=movie&s=1&e=1&server=vidrift`,
                            infoUrl: `/info.html?id=${topMedia.id}&type=movie`,
                            autoExecute: true
                        }],
                        data: {
                            movies: moviesList.slice(0, 8),
                            media: topMedia,
                            serverOptions: SITE_MAP.streaming_servers
                        }
                    });
                }
            }
        }

        const bypassLLM = req.body.bypassLLM;
        const llmInsight = bypassLLM ? bypassLLM : await queryMultiTierLLM(userPrompt, conversationHistory);
        
        let parsed: AIIntentResult;
        if (llmInsight && (llmInsight.chatResponse || llmInsight.intent)) {
            parsed = {
                intent: (llmInsight.intent || 'CHAT') as any,
                confidence: 0.98,
                query: userPrompt,
                targetQuery: llmInsight.target || cleanMediaTitle(userPrompt),
                params: {
                    title: llmInsight.target,
                    season: llmInsight.season || 1,
                    episode: llmInsight.episode || 1,
                    mediaType: llmInsight.mediaType || 'movie'
                },
                chatResponse: llmInsight.chatResponse || `Response for "${userPrompt}":`,
                speechText: (llmInsight.chatResponse || '').slice(0, 140)
            };
        } else {
            parsed = parseLocalIntent(userPrompt);
        }

        const channels = getChannelsList();
        const results: any = {
            status: 'success',
            intent: parsed.intent,
            confidence: parsed.confidence,
            chatResponse: parsed.chatResponse,
            speechText: parsed.speechText,
            params: parsed.params,
            targetQuery: parsed.targetQuery || userPrompt,
            actions: [],
            data: {}
        };

        // For general conversation, trivia, questions, and explanations, return pure text response immediately (NO unnecessary movie cards!)
        if (parsed.intent === 'CHAT' || parsed.intent === 'GREETING' || (!parsed.intent && parsed.chatResponse)) {
            console.log('[AI Query Fast Reply]:', parsed.chatResponse.slice(0, 60));
            return res.json(results);
        }

        const target = parsed.targetQuery || cleanMediaTitle(userPrompt);

        // 1. MOVIE / TV INTENTS: Resolve TMDB media metadata & direct 4K server streams
        if (parsed.intent === 'PLAY_MOVIE' || parsed.intent === 'PLAY_TV' || parsed.intent === 'RECOMMENDATION') {
            try {
                const searchType = parsed.intent === 'PLAY_TV' ? 'tv' : 'movie';
                const moviesList = await fetchTmdbMedia(target, searchType);
                if (moviesList && moviesList.length > 0) {
                    results.data.movies = moviesList.slice(0, 8);
                    const topMedia = moviesList[0];
                    results.data.media = topMedia;
                    results.data.serverOptions = SITE_MAP.streaming_servers;

                    const season = parsed.params?.season || 1;
                    const episode = parsed.params?.episode || 1;

                    results.actions.push({
                        type: parsed.intent,
                        tmdbId: topMedia.id,
                        mediaType: topMedia.media_type,
                        title: topMedia.title,
                        season: season,
                        episode: episode,
                        server: 'vidrift',
                        poster: topMedia.poster,
                        backdrop: topMedia.backdrop,
                        playUrl: `/consumet.html?player=true&id=${topMedia.id}&type=${topMedia.media_type}&s=${season}&e=${episode}&server=vidrift`,
                        cinemaUrl: `/consumet.html?player=true&id=${topMedia.id}&type=${topMedia.media_type}&s=${season}&e=${episode}&server=vidrift`,
                        infoUrl: `/info.html?id=${topMedia.id}&type=${topMedia.media_type}`,
                        autoExecute: true
                    });
                }
            } catch (e: any) {}
        }

        // 2. LIVE SPORTS EVENT
        if (parsed.intent === 'PLAY_SPORTS_EVENT') {
            try {
                const sportsData = await SportsScraperService.searchSports(target);
                results.data.sportsEvents = sportsData.events;
                results.data.superSportChannels = sportsData.supersport;
            } catch (e: any) {}
        }

        // 3. CHANNEL INTENTS
        if (parsed.intent === 'PLAY_CHANNEL') {
            const matchedChannels = channels
                .map((c: any) => {
                    const streamUrl = getChannelStreamUrl(c);
                    return {
                        ...c,
                        score: similarityScore(c.name || c.title || '', target),
                        url: streamUrl,
                        streamUrl: streamUrl,
                        playUrl: `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(c.name)}&logo=${encodeURIComponent(c.logo || '')}&source=local_ai`
                    };
                })
                .filter((c: any) => c.score > 20)
                .sort((a: any, b: any) => b.score - a.score)
                .slice(0, 8);

            results.data.channels = matchedChannels;
            if (matchedChannels.length > 0) {
                const best = matchedChannels[0];
                results.actions.push({
                    type: 'PLAY_CHANNEL',
                    name: best.name,
                    url: best.streamUrl,
                    streamUrl: best.streamUrl,
                    logo: best.logo,
                    genre: best.genre || best.group || 'Live TV',
                    playUrl: best.playUrl,
                    autoExecute: true
                });
            }
        }

        // 4. YOUTUBE INTENTS
        if (parsed.intent === 'PLAY_YOUTUBE') {
            try {
                const ytData = await YouTubeService.searchYouTube(target || userPrompt, 6);
                results.data.youtubeVideos = ytData;
                if (ytData && ytData.length > 0) {
                    results.actions.push({
                        type: 'PLAY_YOUTUBE',
                        id: ytData[0].id,
                        title: ytData[0].title,
                        embedUrl: ytData[0].embedUrl,
                        autoExecute: true
                    });
                }
            } catch (e: any) {}
        }

        // 5. MUSIC INTENTS
        
        if (parsed.intent === 'CREATE_PLAYLIST') {
            try {
                const songs = parsed.playlistSongs || [];
                const playlistTracks = [];
                for (const song of songs) {
                    const tracks = await MusicService.searchMusic(song, 1);
                    if (tracks && tracks.length > 0) playlistTracks.push(tracks[0]);
                }
                results.data.playlistName = parsed.playlistName || 'My Mixtape';
                results.data.playlistTracks = playlistTracks;
            } catch(e) {}
        }

        if (parsed.intent === 'LIVE_SCORES') {
            try {
                const scores = await SportsScoreService.fetchLiveWebTelemetry();
                results.data.liveScores = scores;
            } catch (e: any) {}
        }
        if (parsed.intent === 'WEATHER_REPORT') {
            try {
                const weather = await WeatherService.getWeather(target);
                results.data.weather = weather;
            } catch (e: any) {}
        }
        if (parsed.intent === 'NEWS_HEADLINES') {
            try {
                const news = await NewsService.getBreakingNews(target);
                results.data.news = news;
            } catch (e: any) {}
        }
        if (parsed.intent === 'PLAY_MUSIC') {
            try {
                const tracks = await MusicService.searchMusic(target || userPrompt, 10);
                results.data.musicTracks = tracks;
                if (tracks && tracks.length > 0) {
                    results.actions.push({
                        type: 'PLAY_MUSIC',
                        id: tracks[0].id,
                        title: tracks[0].title,
                        artist: tracks[0].artist,
                        streamUrl: tracks[0].streamUrl,
                        autoExecute: true
                    });
                }
            } catch (e: any) {}
        }

        return res.json(results);
    } catch (err: any) {
        console.error('[LocalAI Error]', err);
        return res.status(500).json({ error: err.message || 'Internal Local AI error' });
    }
});

// Sitemap Endpoint
router.get('/sitemap', (req: Request, res: Response) => {
    return res.json(SITE_MAP);
});

// Live Media Search Endpoint
router.get('/search-media', async (req: Request, res: Response) => {
    const q = (req.query.q || req.query.query || '').toString().trim();
    const type = (req.query.type as any) || 'multi';
    if (!q) return res.status(400).json({ error: 'Missing query parameter q' });
    try {
        const results = await fetchTmdbMedia(q, type);
        return res.json({ status: 'success', total: results.length, results });
    } catch (e: any) {
        return res.status(500).json({ status: 'error', message: e.message });
    }
});

// Dedicated Fast YouTube Search Endpoint
router.all(['/youtube-search', '/v1/youtube/search'], async (req: Request, res: Response) => {
    const q = (req.query.q || req.query.query || req.body?.q || req.body?.query || req.body?.prompt || '').toString().trim();
    const limit = parseInt((req.query.limit || req.body?.limit || '8') as string, 10) || 8;
    if (!q) {
        return res.status(400).json({ error: 'Missing query parameter q' });
    }
    try {
        const videos = await YouTubeService.searchYouTube(q, limit);
        return res.json({
            status: 'success',
            query: q,
            total: videos.length,
            videos,
            data: { youtubeVideos: videos }
        });
    } catch (e: any) {
        console.error('[YouTube Endpoint Error]:', e.message);
        return res.status(500).json({ status: 'error', message: e.message, videos: [] });
    }
});

// Instant Channel & Content Matcher
router.get('/channels', (req: Request, res: Response) => {
    const q = (req.query.q || req.query.query || '').toString().trim().toLowerCase();
    const channels = getChannelsList();
    if (!q) {
        return res.json(channels.slice(0, 30).map((c: any) => {
            const streamUrl = getChannelStreamUrl(c);
            return {
                ...c,
                url: streamUrl,
                streamUrl,
                playUrl: `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(c.name)}&logo=${encodeURIComponent(c.logo || '')}&source=local_ai`
            };
        }));
    }
    const matches = channels
        .map((c: any) => {
            const streamUrl = getChannelStreamUrl(c);
            return {
                ...c,
                url: streamUrl,
                streamUrl,
                score: similarityScore(c.name || '', q),
                playUrl: `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(c.name)}&logo=${encodeURIComponent(c.logo || '')}&source=local_ai`
            };
        })
        .filter((c: any) => c.score > 20)
                .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 25);

    return res.json(matches);
});

// Multi-turn Gemini Chat Endpoint
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, prompt, history, role, model, complexity, enableSearch, image, temperature } = req.body;
        const userPrompt = message || prompt || '';
        if (!userPrompt && !image) {
            return res.status(400).json({ status: 'error', message: 'Message or image required' });
        }

        const result = await GeminiChatService.chat({
            message: userPrompt,
            history: history || [],
            role,
            model,
            complexity,
            enableSearch: Boolean(enableSearch),
            image,
            temperature
        });

        return res.json({
            status: 'success',
            ...result,
            chatResponse: result.text
        });
    } catch (err: any) {
        console.error('[LocalAI Chat Gemini Error]:', err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message || 'Gemini chat processing error'
        });
    }
});

// Multi-turn Streaming Gemini Chat Endpoint
router.post('/chat/stream', async (req: Request, res: Response) => {
    const { message, prompt, history, role, model, complexity, enableSearch, image, temperature } = req.body;
    const userPrompt = message || prompt || '';
    if (!userPrompt && !image) {
        return res.status(400).json({ status: 'error', message: 'Message or image required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
        const result = await GeminiChatService.chatStream(
            {
                message: userPrompt,
                history: history || [],
                role,
                model,
                complexity,
                enableSearch: Boolean(enableSearch),
                image,
                temperature
            },
            (chunkText: string) => {
                res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
            }
        );

        res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            fullText: result.fullText, 
            model: result.model, 
            role: result.role, 
            groundingMetadata: result.groundingMetadata 
        })}\n\n`);
        res.end();
    } catch (err: any) {
        console.error('[LocalAI Chat Stream Error]:', err.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
    }
});

export default router;
