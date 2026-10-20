import { GoogleGenAI } from '@google/genai';
import { Router, Request, Response } from 'express';

export interface ChatbotRoleConfig {
    id: string;
    name: string;
    title: string;
    icon: string;
    defaultModel: 'gemini-3.5-flash' | 'gemini-3.1-flash-lite';
    systemInstruction: string;
    suggestedPrompts: string[];
}

export const CHATBOT_ROLES: Record<string, ChatbotRoleConfig> = {
    copilot: {
        id: 'copilot',
        name: 'Entertainment Copilot',
        title: 'Cinema, TV, Music & IPTV Navigator',
        icon: 'sparkles',
        defaultModel: 'gemini-3.5-flash',
        systemInstruction: `You are Aetheris Quantum AI, the supreme neural intelligence for the Stalker Pro & Aetheris entertainment platform.
You are an expert guide across the entire multimedia ecosystem:
- 4K Movies & TV Series (plot synopses, cast info, directors, cinematic trivia, release details).
- 5,200+ Live IPTV Channels (sports, news, entertainment, global broadcasts).
- 320kbps Lossless Music & Radio (tracks, artists, albums, moods, genres).
- YouTube 4K Videos, trailers, live feeds, podcasts.
- Live Sports Events (Cricket, Football, F1, Tennis, UFC, broadcasting networks).

Style & Tone:
- Enthusiastic, knowledgeable, articulate, and modern.
- Structure responses cleanly using Markdown (bold titles, bullet points, headers).
- If the user wants to watch or play something, explicitly identify the exact title, season/episode (if TV show), or channel name so our interactive player deck can launch it.`,
        suggestedPrompts: [
            'Recommend a mind-bending sci-fi thriller like Interstellar',
            'Find live cricket or football channels broadcasting today',
            'Play 320kbps relaxing acoustic music playlist',
            'Search YouTube for 4K Cyberpunk city walking tours'
        ]
    },
    pro_polymath: {
        id: 'pro_polymath',
        name: 'Quantum Polymath & Researcher',
        title: 'Deep Complex Reasoning & Scientific Analysis',
        icon: 'brain',
        defaultModel: 'gemini-3.5-flash',
        systemInstruction: `You are the Quantum Polymath AI, an advanced high-order reasoning intelligence for complex tasks, deep technical research, mathematics, code architecture, script analysis, and scientific inquiries.
You solve difficult, intricate problems with rigor, clarity, and depth.
- Break down complex subjects systematically.
- Provide step-by-step logic, proofs, or code implementations where appropriate.
- Format equations clearly and use formatted markdown code blocks with language identifiers.
- Deliver comprehensive, highly intelligent, and meticulously structured analyses.`,
        suggestedPrompts: [
            'Analyze Christopher Nolan\'s non-linear narrative architecture across Memento, Inception, and Oppenheimer',
            'Explain the mathematical theory behind audio FFT spectrum analyzers and HLS video encryption',
            'Write a TypeScript algorithm to optimize live video segment pre-fetching'
        ]
    },
    fast_assistant: {
        id: 'fast_assistant',
        name: 'Lightning Assistant',
        title: 'Instant Speed & Ultra-Concise Answers',
        icon: 'zap',
        defaultModel: 'gemini-3.1-flash-lite',
        systemInstruction: `You are the Lightning Fast Assistant for Stalker Pro.
Your core directive is high speed, maximum conciseness, and precision.
- Deliver direct, punchy answers immediately.
- Zero fluff, zero unnecessary filler, zero preamble.
- Give the exact fact, direct answer, or fast summary right away.`,
        suggestedPrompts: [
            'Who directed Blade Runner 2049?',
            'What channel broadcasts Formula 1 in 4K?',
            'How long is Avatar: The Way of Water?'
        ]
    },
    movie_critic: {
        id: 'movie_critic',
        name: 'Cinema & Screenplay Critic',
        title: 'Film Analysis, Auteur Directing & Screenplay Review',
        icon: 'clapperboard',
        defaultModel: 'gemini-3.5-flash',
        systemInstruction: `You are an elite Film & Screenplay Critic, Director, and Cinematography Analyst.
You dissect films and television shows through the lens of auteur directing, visual storytelling, screenplay structure, cinematography techniques, color palettes, sound design, and narrative themes.
Provide deep, insightful critiques, compare director styles (e.g. Nolan, Kubrick, Tarantino, Villeneuve, Fincher), and offer curated viewing recommendations with critical reasoning.`,
        suggestedPrompts: [
            'Compare the cinematography of Roger Deakins vs Hoyte van Hoytema',
            'Explain the thematic symbolism in Denis Villeneuve\'s Dune Part Two',
            'Dissect the three-act structure and pacing of The Dark Knight'
        ]
    },
    audiophile: {
        id: 'audiophile',
        name: 'Audiophile & Music Curator',
        title: 'Lossless Sound, Production & Discography',
        icon: 'headphones',
        defaultModel: 'gemini-3.5-flash',
        systemInstruction: `You are a Master Sound Engineer, Musicologist, and Audiophile Curator.
You specialize in music genres, production techniques, audio mixing, vinyl/lossless acoustics (FLAC, 320kbps MP3), artist discographies, and tailored playlist curation.
Provide rich musical analysis, recommend hidden gems and tracks based on mood, tempo, and sonic texture, and discuss music theory and production history.`,
        suggestedPrompts: [
            'Curate a 10-track synthwave playlist for night driving',
            'Explain the audio production difference between analog tape and 32-bit float digital recording',
            'What made Pink Floyd\'s The Dark Side of the Moon a sonic masterpiece?'
        ]
    }
};

let cachedGeminiClient: GoogleGenAI | null = null;

export function getGeminiClientInstance(): GoogleGenAI {
    if (!cachedGeminiClient) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
        cachedGeminiClient = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'stalker-pro-gemini/2.0'
                }
            }
        });
    }
    return cachedGeminiClient;
}

export function resolveGeminiModel(modelPref?: string, complexity?: string): string {
    if (complexity === 'complex') {
        return 'gemini-3.5-flash';
    }
    if (complexity === 'fast') {
        return 'gemini-3.1-flash-lite';
    }
    if (complexity === 'general') {
        return 'gemini-3.5-flash';
    }

    if (modelPref) {
        const lower = modelPref.toLowerCase().trim();
        if (lower.includes('pro') || lower.includes('3.1-pro')) {
            return 'gemini-3.5-flash';
        }
        if (lower.includes('lite') || lower.includes('flash-lite')) {
            return 'gemini-3.1-flash-lite';
        }
        if (lower.includes('3.5-flash') || lower.includes('flash')) {
            return 'gemini-3.5-flash';
        }
        if (lower.includes('2.5-flash')) {
            return 'gemini-2.5-flash';
        }
    }

    return 'gemini-3.5-flash';
}

export interface ChatHistoryMessage {
    role: 'user' | 'model' | 'assistant';
    content?: string;
    text?: string;
    parts?: any[];
}

export interface ChatRequestOptions {
    message: string;
    history?: ChatHistoryMessage[];
    role?: string;
    model?: string;
    complexity?: 'fast' | 'general' | 'complex';
    enableSearch?: boolean;
    image?: {
        mimeType: string;
        data: string; // base64
    };
    temperature?: number;
}

export class GeminiChatService {
    /**
     * Executes a multi-turn chat request using Google Gemini.
     */
    static async chat(options: ChatRequestOptions): Promise<{
        text: string;
        model: string;
        role: string;
        groundingMetadata?: any;
        intent?: string;
        target?: string;
    }> {
        const ai = getGeminiClientInstance();
        const roleConfig = CHATBOT_ROLES[options.role || 'copilot'] || CHATBOT_ROLES.copilot;
        const targetModel = options.model 
            ? resolveGeminiModel(options.model, options.complexity)
            : (options.complexity ? resolveGeminiModel(undefined, options.complexity) : roleConfig.defaultModel);

        // Format history according to @google/genai guidelines:
        // Roles MUST be 'user' or 'model'
        const contents: any[] = [];

        if (Array.isArray(options.history)) {
            for (const msg of options.history) {
                const textContent = msg.content || msg.text || '';
                if (!textContent.trim()) continue;
                const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
                contents.push({
                    role: role,
                    parts: [{ text: textContent }]
                });
            }
        }

        // Add current user prompt
        const userParts: any[] = [];
        if (options.image && options.image.data) {
            userParts.push({
                inlineData: {
                    mimeType: options.image.mimeType || 'image/jpeg',
                    data: options.image.data
                }
            });
        }
        userParts.push({ text: options.message });

        contents.push({
            role: 'user',
            parts: userParts
        });

                const currentDate = new Date().toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
        const config: any = {
            systemInstruction: roleConfig.systemInstruction + '\n\nCurrent System Time: ' + currentDate,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.7
        };

        if (options.enableSearch && !targetModel.includes('flash-lite')) {
            config.tools = [{ googleSearch: {} }];
        }

        console.log(`[GeminiChatService] Invoking model "${targetModel}" (Role: ${roleConfig.name}, Complexity: ${options.complexity || 'auto'}, Search: ${Boolean(options.enableSearch)})`);

        try {
            const response = await ai.models.generateContent({
                model: targetModel,
                contents: contents,
                config: config
            });

            const replyText = response.text || '';
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

            return {
                text: replyText,
                model: targetModel,
                role: roleConfig.id,
                groundingMetadata: groundingMetadata
            };
        } catch (error: any) {
            console.error(`[GeminiChatService Error with ${targetModel}]:`, error.message);
            // Fallback to gemini-3.5-flash or gemini-2.5-flash if pro or specific model failed
            if (targetModel !== 'gemini-3.5-flash') {
                console.log(`[GeminiChatService] Falling back to "gemini-3.5-flash"...`);
                const fallbackResponse = await ai.models.generateContent({
                    model: 'gemini-3.5-flash',
                    contents: contents,
                    config: config
                });
                return {
                    text: fallbackResponse.text || '',
                    model: 'gemini-3.5-flash',
                    role: roleConfig.id,
                    groundingMetadata: fallbackResponse.candidates?.[0]?.groundingMetadata
                };
            }
            throw error;
        }
    }

    /**
     * Executes a streaming multi-turn chat request using Google Gemini.
     */
    static async chatStream(
        options: ChatRequestOptions,
        onChunk: (chunkText: string) => void
    ): Promise<{
        fullText: string;
        model: string;
        role: string;
        groundingMetadata?: any;
    }> {
        const ai = getGeminiClientInstance();
        const roleConfig = CHATBOT_ROLES[options.role || 'copilot'] || CHATBOT_ROLES.copilot;
        const targetModel = options.model 
            ? resolveGeminiModel(options.model, options.complexity)
            : (options.complexity ? resolveGeminiModel(undefined, options.complexity) : roleConfig.defaultModel);

        const contents: any[] = [];
        if (Array.isArray(options.history)) {
            for (const msg of options.history) {
                const textContent = msg.content || msg.text || '';
                if (!textContent.trim()) continue;
                const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
                contents.push({
                    role: role,
                    parts: [{ text: textContent }]
                });
            }
        }

        const userParts: any[] = [];
        if (options.image && options.image.data) {
            userParts.push({
                inlineData: {
                    mimeType: options.image.mimeType || 'image/jpeg',
                    data: options.image.data
                }
            });
        }
        userParts.push({ text: options.message });

        contents.push({
            role: 'user',
            parts: userParts
        });

                const currentDate = new Date().toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
        const config: any = {
            systemInstruction: roleConfig.systemInstruction + '\n\nCurrent System Time: ' + currentDate,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.7
        };

        if (options.enableSearch && !targetModel.includes('flash-lite')) {
            config.tools = [{ googleSearch: {} }];
        }

        console.log(`[GeminiChatService Stream] Starting stream on "${targetModel}" (Role: ${roleConfig.name})`);

        let fullText = '';
        let lastMetadata: any = null;

        let responseStream;
        try {
            responseStream = await ai.models.generateContentStream({
                model: targetModel,
                contents: contents,
                config: config
            });
        } catch (error: any) {
            console.error(`[GeminiChatService Stream Error with ${targetModel}]:`, error.message);
            if (targetModel !== 'gemini-3.5-flash' && error.message.includes('429')) {
                console.log(`[GeminiChatService Stream] Quota exceeded on ${targetModel}, falling back to "gemini-3.5-flash"...`);
                responseStream = await ai.models.generateContentStream({
                    model: 'gemini-3.5-flash',
                    contents: contents,
                    config: config
                });
            } else {
                throw error;
            }
        }

        for await (const chunk of responseStream) {
            const piece = chunk.text || '';
            if (piece) {
                fullText += piece;
                onChunk(piece);
            }
            if (chunk.candidates?.[0]?.groundingMetadata) {
                lastMetadata = chunk.candidates[0].groundingMetadata;
            }
        }

        return {
            fullText,
            model: targetModel,
            role: roleConfig.id,
            groundingMetadata: lastMetadata
        };
    }

    /**
     * Fast media and action intent classifier using gemini-3.1-flash-lite.
     */
    static async classifyIntent(prompt: string): Promise<{
        intent: 'PLAY_MOVIE' | 'PLAY_TV' | 'PLAY_CHANNEL' | 'PLAY_MUSIC' | 'PLAY_YOUTUBE' | 'CREATE_PLAYLIST' | 'CHAT';
        target?: string;
        season?: number;
        episode?: number;
        playlistName?: string;
        playlistSongs?: string[];
        chatResponse?: string;
    }> {
        const ai = getGeminiClientInstance();
        const systemPrompt = `Analyze the user query for the Stalker Pro entertainment platform.
Identify if the user is asking to play or watch media, or if they are just chatting:
- "PLAY_MOVIE": User explicitly wants to watch/stream a movie (e.g., "play Inception", "watch Oppenheimer"). Extract movie title into "target".
- "PLAY_TV": User wants to watch a TV series (e.g., "watch Stranger Things season 2 episode 1"). Extract show title into "target", season, episode.
- "PLAY_CHANNEL": User wants to tune into a live TV channel (e.g., "watch HBO", "play Star Sports 1", "BBC News"). Extract channel name into "target".
- "PLAY_MUSIC": User wants to listen to a song or artist (e.g., "play song Believer", "listen to Taylor Swift"). Extract song/artist into "target".
- "PLAY_YOUTUBE": User wants to play/search a YouTube video or trailer (e.g., "youtube trailer of Avatar 3"). Extract title into "target".
- "CREATE_PLAYLIST": User asks to create a playlist. Extract "playlistName" and "playlistSongs".
- "CHAT": Conversational inquiry, trivia, question, coding, analysis, greeting, or explanation.

Respond ONLY with pure JSON:
{"intent": "CHAT"|"PLAY_MOVIE"|"PLAY_TV"|"PLAY_CHANNEL"|"PLAY_MUSIC"|"PLAY_YOUTUBE"|"CREATE_PLAYLIST", "target": "extracted name", "chatResponse": "optional concise greeting or explanation"}`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: `${systemPrompt}\n\nUser query: "${prompt}"`,
                config: {
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                }
            });

            const parsed = JSON.parse(response.text || '{}');
            return parsed;
        } catch (e: any) {
            console.warn('[Gemini Intent Classifier Note]:', e.message);
            return { intent: 'CHAT' };
        }
    }
}

// ----------------------------------------------------
// Express Router Definition
// ----------------------------------------------------
const geminiRouter = Router();

// GET /api/gemini/roles - Get available personas
geminiRouter.get('/roles', (req: Request, res: Response) => {
    return res.json({
        status: 'success',
        roles: Object.values(CHATBOT_ROLES).map(r => ({
            id: r.id,
            name: r.name,
            title: r.title,
            icon: r.icon,
            defaultModel: r.defaultModel,
            suggestedPrompts: r.suggestedPrompts
        }))
    });
});

// GET /api/gemini/models - Get supported Gemini models
geminiRouter.get('/models', (req: Request, res: Response) => {
    return res.json({
        status: 'success',
        models: [
            {
                id: 'gemini-3.1-flash-lite',
                name: 'Gemini 3.1 Flash Lite',
                tier: 'Fast',
                description: 'Ultra-low latency, instant responses, rapid lookups and intent extraction.'
            },
            {
                id: 'gemini-3.5-flash',
                name: 'Gemini 3.5 Flash',
                tier: 'General',
                description: 'Balanced multimodal intelligence, default multi-turn chat and media reasoning.'
            }
            ]
    });
});

// POST /api/gemini/chat - Multi-turn non-streaming chat
geminiRouter.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, history, role, model, complexity, enableSearch, image, temperature } = req.body;
        if (!message && !image) {
            return res.status(400).json({ error: 'Message or image is required' });
        }

        const result = await GeminiChatService.chat({
            message: message || '',
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
            ...result
        });
    } catch (err: any) {
        console.error('[Gemini Route Error]:', err.message);
        return res.status(500).json({
            status: 'error',
            error: err.message || 'Gemini processing failed'
        });
    }
});

// POST /api/gemini/chat/stream - Server-Sent Events (SSE) Streaming Multi-turn Chat
geminiRouter.post('/chat/stream', async (req: Request, res: Response) => {
    const { message, history, role, model, complexity, enableSearch, image, temperature } = req.body;
    if (!message && !image) {
        return res.status(400).json({ error: 'Message or image is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
        const result = await GeminiChatService.chatStream(
            {
                message: message || '',
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
        console.error('[Gemini Stream Route Error]:', err.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
    }
});

// POST /api/gemini/intent - Fast media intent classification
geminiRouter.post('/intent', async (req: Request, res: Response) => {
    try {
        const prompt = req.body.prompt || req.body.query || '';
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        const result = await GeminiChatService.classifyIntent(prompt);
        return res.json({ status: 'success', ...result });
    } catch (err: any) {
        return res.status(500).json({ status: 'error', error: err.message });
    }
});

export default geminiRouter;
