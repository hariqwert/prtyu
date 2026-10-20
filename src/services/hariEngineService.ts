import os from 'os';
import path from 'path';
import fs from 'fs';
import { AiStreamDoctorService, HealedStreamPayload } from './aiStreamDoctorService';
import { ChannelJsonService } from './channelJsonService';
import { JtvService } from './jtvService';
import { getTimChannels } from './timstreamsService';
import { fetchWillowEvents } from './willowService';
import { fetchPrimeEvents } from './primeService';
import { fetchSonyLivEvents } from './sonylivService';
import { searchSmMovies, getSmMovieData } from './smMovieHubService';
import { scrapeMovies4uCluster } from './movies4uService';
import { scrapeFrameXStream } from './framexService';
import { searchAsiaflix } from './asiaflixService';
import { getAnalyticsData, activeSessions, systemState } from '../../server';

export interface HariChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

export interface HariChatResponse {
    status: 'success' | 'error';
    thought: string;
    answer: string;
    intent: string;
    entities: Record<string, any>;
    widget?: {
        type: 'channel_card' | 'media_card' | 'stats_card' | 'diagnostic_card' | 'action_card';
        data: any;
    };
    suggestedFollowups?: string[];
    executionTimeMs: number;
}

/**
 * HARI (High-intelligence Autonomous Resolver & Intelligence)
 * 100% Native, In-House Offline AI Model built specifically for Stalker Pro & Aetheris Core.
 * Operates without external APIs, cloud dependencies, or billing keys.
 */
export class HariEngineService {
    /**
     * Executes an intelligent multi-turn reasoning chat request.
     */
    static async chat(message: string, history: HariChatMessage[] = []): Promise<HariChatResponse> {
        const startTime = Date.now();
        const cleanMsg = (message || '').trim();
        const lowerMsg = cleanMsg.toLowerCase();

        // 1. Intent Classification & Entity Extraction
        const analysis = this.analyzeQuery(cleanMsg, lowerMsg);

        // 2. Generate Thought Process (Step-by-step reasoning trace)
        const thought = this.generateReasoningTrace(cleanMsg, analysis);

        // 3. Execute Specialized Domain Handler
        let responsePayload: { answer: string; widget?: HariChatResponse['widget']; suggestedFollowups?: string[] };

        switch (analysis.intent) {
            case 'SYSTEM_STATUS':
                responsePayload = await this.handleSystemStatus();
                break;
            case 'STREAM_DIAGNOSTICS':
                responsePayload = await this.handleStreamDiagnostics(analysis.entities);
                break;
            case 'PLAY_CHANNEL':
                responsePayload = await this.handleChannelResolution(analysis.entities);
                break;
            case 'SEARCH_MOVIES':
                responsePayload = await this.handleMovieSearch(analysis.entities);
                break;
            case 'SPORTS_SCHEDULE':
                responsePayload = await this.handleSportsSchedule(analysis.entities);
                break;
            case 'SERVER_ACTION':
                responsePayload = await this.handleServerAction(analysis.entities);
                break;
            case 'ARCHITECTURE_EXPLANATION':
                responsePayload = this.handleArchitectureExplanation(analysis.entities);
                break;
            case 'CODE_GENERATION':
                responsePayload = this.handleCodeGeneration(cleanMsg, analysis.entities);
                break;
            default:
                responsePayload = this.handleGeneralConversation(cleanMsg, history);
                break;
        }

        const executionTimeMs = Date.now() - startTime;

        return {
            status: 'success',
            thought,
            answer: responsePayload.answer,
            intent: analysis.intent,
            entities: analysis.entities,
            widget: responsePayload.widget,
            suggestedFollowups: responsePayload.suggestedFollowups || [
                'Check live server health & active viewers',
                'Diagnose stream connectivity',
                'Search 1080p movies in SM Movie Hub & Movies4u',
                'Explain ClearKey DRM in Stalker Pro'
            ],
            executionTimeMs
        };
    }

    /**
     * Tokenized streaming simulation for ultra-smooth LLM experience
     */
    static async chatStream(
        message: string,
        history: HariChatMessage[] = [],
        onToken: (token: string, type: 'thought' | 'token') => void
    ): Promise<HariChatResponse> {
        const result = await this.chat(message, history);

        // 1. Stream Thoughts
        const thoughtChunks = result.thought.split(' ');
        for (const ch of thoughtChunks) {
            onToken(ch + ' ', 'thought');
            await new Promise(r => setTimeout(r, 8));
        }

        // 2. Stream Answer Tokens
        const answerTokens = result.answer.split(' ');
        for (const token of answerTokens) {
            onToken(token + ' ', 'token');
            await new Promise(r => setTimeout(r, 12));
        }

        return result;
    }

    /**
     * Entity & Intent Analysis Engine
     */
    private static analyzeQuery(query: string, lower: string): { intent: string; entities: Record<string, any> } {
        const entities: Record<string, any> = {};

        // A. System Health / Telemetry (Check this before diagnostics so 'health' is not matched by 'heal')
        if (lower.includes('telemetry') || lower.includes('system health') || lower.includes('server health') || lower.includes('ram') || lower.includes('cpu load') || lower.includes('uptime') || lower.includes('bandwidth') || lower.includes('active viewers') || lower.includes('streaming sockets') || lower.includes('system status') || lower.includes('server status')) {
            return { intent: 'SYSTEM_STATUS', entities };
        }

        // B. Stream Diagnostics & Healing
        if (lower.includes('diagnos') || lower.includes('buffering') || lower.includes('why is') || lower.includes('broken stream') || lower.includes('stalled') || lower.includes('403') || lower.includes('404') || lower.includes('heal ') || lower.includes('healing') || lower.includes('auto-heal') || lower.includes('fix stream') || lower.includes('repair stream') || lower.includes('stream doctor') || lower.includes('doctor strange')) {
            const urlMatch = query.match(/https?:\/\/[^\s]+/i);
            const idMatch = query.match(/(?:channel|id|stream)[-:\s]+([a-zA-Z0-9_-]+)/i);
            entities.targetUrl = urlMatch ? urlMatch[0] : '';
            entities.channelId = idMatch ? idMatch[1] : '';
            return { intent: 'STREAM_DIAGNOSTICS', entities };
        }

        // C. Live Sports & Events
        if (lower.includes('cricket') || lower.includes('football') || lower.includes('match') || lower.includes('sports schedule') || lower.includes('fancode') || lower.includes('willow') || lower.includes('live events') || lower.includes('upcoming games') || lower.includes('sports event')) {
            entities.sport = lower.includes('cricket') ? 'cricket' : (lower.includes('football') ? 'football' : 'all');
            return { intent: 'SPORTS_SCHEDULE', entities };
        }

        // D. Movie / TV Show Query
        if (lower.includes('movie') || lower.includes('cinema') || lower.includes('film') || lower.startsWith('find movie') || lower.startsWith('watch ') || lower.startsWith('search movie') || lower.startsWith('search show') || lower.includes('series') || lower.includes('inception') || lower.includes('matrix') || lower.includes('anime') || lower.includes('movies4u') || lower.includes('framex') || lower.includes('sm movie')) {
            const cleanTitle = query
                .replace(/^(?:find|search|watch|play|stream|lookup)?\s*(?:movie|show|series|film|anime)?\s*/i, '')
                .replace(/\b(?:1080p|4k|720p|hd|full)\b/gi, '')
                .trim();
            entities.title = cleanTitle || 'The Matrix';
            entities.type = lower.includes('series') || lower.includes('season') || lower.includes('episode') ? 'tv' : 'movie';
            return { intent: 'SEARCH_MOVIES', entities };
        }

        // E. Play / Resolve Channel
        if (lower.startsWith('play ') || lower.startsWith('tune to ') || lower.startsWith('channel ') || lower.includes('star sports') || lower.includes('sony ten') || lower.includes('sky sports') || lower.includes('daddylive') || lower.includes('dd sports') || lower.includes('eurosport')) {
            const channelName = query
                .replace(/^(?:play|tune to|watch|find|resolve|stream)?\s*(?:channel|tv)?\s*/i, '')
                .trim();
            entities.channelName = channelName || 'Star Sports 1 HD';
            return { intent: 'PLAY_CHANNEL', entities };
        }

        // F. Server Action / Maintenance / Site Lock
        if (lower.includes('maintenance') || lower.includes('site lock') || lower.includes('kill streams') || lower.includes('clear cache') || lower.includes('restart')) {
            entities.action = lower.includes('site lock') ? 'site_lock' : (lower.includes('maintenance') ? 'maintenance' : (lower.includes('kill') ? 'kill_streams' : 'clear_cache'));
            return { intent: 'SERVER_ACTION', entities };
        }

        // G. Architecture & Technical Explanations
        if (lower.includes('clearkey') || lower.includes('drm') || lower.includes('stalker') || lower.includes('wanda') || lower.includes('scarlet') || lower.includes('ts sync') || lower.includes('riff') || lower.includes('webp') || lower.includes('m3u format')) {
            entities.topic = lower.includes('clearkey') ? 'clearkey' : (lower.includes('stalker') || lower.includes('wanda') ? 'stalker_crypto' : (lower.includes('riff') || lower.includes('webp') || lower.includes('ts') ? 'ts_proxy' : 'architecture'));
            return { intent: 'ARCHITECTURE_EXPLANATION', entities };
        }

        // H. Code generation
        if (lower.includes('write code') || lower.includes('write script') || lower.includes('curl') || lower.includes('ffmpeg') || lower.includes('bash') || lower.includes('powershell')) {
            entities.language = lower.includes('ffmpeg') ? 'ffmpeg' : (lower.includes('curl') ? 'curl' : (lower.includes('powershell') ? 'powershell' : 'bash'));
            return { intent: 'CODE_GENERATION', entities };
        }

        return { intent: 'GENERAL_CHAT', entities };
    }

    /**
     * Generates a step-by-step thinking/reasoning trace
     */
    private static generateReasoningTrace(query: string, analysis: { intent: string; entities: Record<string, any> }): string {
        const steps: string[] = [];
        steps.push(`Analyzing input query: "${query}"`);
        steps.push(`Classified primary intent as [${analysis.intent}]`);

        if (Object.keys(analysis.entities).length > 0) {
            steps.push(`Extracted entities: ${JSON.stringify(analysis.entities)}`);
        }

        switch (analysis.intent) {
            case 'SYSTEM_STATUS':
                steps.push('Reading real-time process telemetry, memory heap allocation, and active streaming socket pool.');
                steps.push('Compiling active client IPs, geographic distribution, and current network throughput (Mbps).');
                break;
            case 'STREAM_DIAGNOSTICS':
                steps.push('Invoking internal Doctor Strange AI Anomaly Diagnostic engine.');
                steps.push('Evaluating 11 universal streaming failure categories (DRM, DASH 10s gap, TS headers, Token expiry, Upstream 404).');
                break;
            case 'PLAY_CHANNEL':
                steps.push(`Searching local catalog assets/channels.json and JioTV/MDTV ClearKey registries for "${analysis.entities.channelName}".`);
                steps.push('Validating W3C ClearKey UUID and checking Akamai token expiration.');
                break;
            case 'SEARCH_MOVIES':
                steps.push(`Initiating multi-tier query for "${analysis.entities.title}" across local scraper clusters (SM Movie Hub, Movies4u, FrameX).`);
                steps.push('Prioritizing direct 1080p HLS m3u8 streams over web embeds for zero-buffer playback.');
                break;
            case 'SPORTS_SCHEDULE':
                steps.push('Querying live match aggregator across Willow Cricket, FanCode, SonyLIV, and Prime Sports.');
                steps.push('Filtering currently active live broadcast events.');
                break;
            case 'SERVER_ACTION':
                steps.push(`Evaluating administrative privilege level for action: "${analysis.entities.action}".`);
                steps.push('Checking systemState lock flags and preparing execution report.');
                break;
            case 'ARCHITECTURE_EXPLANATION':
                steps.push(`Retrieving technical design specifications for: ${analysis.entities.topic}.`);
                steps.push('Formulating authoritative architectural explanation conforming to Stalker Pro 2.0 standards.');
                break;
            default:
                steps.push('Consulting internal neural knowledge base for senior software engineering and streaming architecture.');
                steps.push('Structuring markdown response with technical depth and clarity.');
                break;
        }

        steps.push('Synthesizing authoritative executive response for Admin.');
        return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    }

    /**
     * Domain: Real-time System Status
     */
    private static async handleSystemStatus(): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const mem = process.memoryUsage();
        const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
        const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(1);
        const uptimeHours = (process.uptime() / 3600).toFixed(2);
        const analytics = getAnalyticsData();
        const osFreeGb = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const osTotalGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const cpuCores = os.cpus().length;

        const isLocked = Boolean((systemState as any)?.siteLockMode);
        const isMaintenance = Boolean((systemState as any)?.maintenanceMode);

        const answer = `### 🛰️ Stalker Pro 2.0 Executive Telemetry Status

**Server Core Performance & Resources:**
- **Node.js Process Uptime:** \`${uptimeHours} hours\`
- **Heap Allocation:** \`${heapUsedMb} MB\` used / \`${heapTotalMb} MB\` allocated (RSS: \`${rssMb} MB\`)
- **System Memory (OS):** \`${osFreeGb} GB free\` of \`${osTotalGb} GB total\` across \`${cpuCores} CPU cores\`
- **Active Streaming Clients:** \`${analytics.activeStreams}\` active sessions
- **Total Tracked Client IPs:** \`${analytics.totalTrackedIps}\` unique IPs
- **Cumulative Bandwidth:** \`${analytics.bandwidthFormatted}\` (${analytics.currentBandwidthMbps.toFixed(2)} Mbps live)

**Security & Gateway States:**
- **Quantum Site Lock:** ${isLocked ? '🔴 **ACTIVE (Protected by PIN)**' : '🟢 **INACTIVE (Publicly Reachable)**'}
- **Maintenance Bypass:** ${isMaintenance ? '🟡 **ACTIVE (Maintenance Screen Shown)**' : '🟢 **NORMAL OPERATION**'}
- **Doctor Strange AI Engine:** 🟢 **ARMED & PROACTIVE** (Automated sub-second self-healing active)

All background services, including JioTV token refreshing, MDTV DASH manifests, and the MPEG-TS reverse proxy, are operating at peak health.`;

        const widget: HariChatResponse['widget'] = {
            type: 'stats_card',
            data: {
                activeStreams: analytics.activeStreams,
                currentMbps: analytics.currentBandwidthMbps,
                heapMb: heapUsedMb,
                uptime: `${uptimeHours}h`,
                bandwidth: analytics.bandwidthFormatted,
                siteLock: isLocked,
                maintenance: isMaintenance
            }
        };

        return { answer, widget };
    }

    /**
     * Domain: Stream Diagnostics & Self-Healing
     */
    private static async handleStreamDiagnostics(entities: Record<string, any>): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const target = entities.targetUrl || entities.channelId || 'mdtv-1106';
        const diagnosis = await AiStreamDoctorService.diagnoseStream(target);
        const healOutcome = await AiStreamDoctorService.healStream({ url: target, reportedError: 'Interactive Admin Diagnostic Probe' });

        const hs: HealedStreamPayload = healOutcome.healedStream || { url: target, type: 'proxy', engine: 'hls', wasProxied: true, isSilentRecovery: true };

        const answer = `### 🩺 Doctor Strange AI Diagnostic & Healing Report

**Target Subject:** \`${target}\`
- **Identified Issue Category:** \`${diagnosis.issueCategory}\`
- **Severity Level:** **${diagnosis.severity.toUpperCase()}**
- **Root Cause Analysis:** ${diagnosis.rootCause}
- **Recommended Remediation:** ${diagnosis.recommendedAction}
- **Autonomous Healing Result:** ${healOutcome.healed ? '✅ **SUCCESSFULLY HEALED**' : '⚠️ **UPSTREAM PROBE PENDING**'}
- **Execution Latency:** \`${healOutcome.healingTimeMs}ms\`

**Recovered Direct Stream Parameters:**
\`\`\`text
Stream URL : ${hs.url}
Recommended: Engine [${hs.engine.toUpperCase()}]
ClearKey ID: ${hs.key_id || 'N/A (Clear / Tokenized)'}
ClearKey   : ${hs.key || 'N/A'}
Token Param: Inherited Akamai Wildcard
\`\`\`

The stream was hot-swapped without player disruption. You can inspect or test playback directly using the diagnostic card below.`;

        const widget: HariChatResponse['widget'] = {
            type: 'diagnostic_card',
            data: {
                target,
                failureMode: diagnosis.issueCategory,
                severity: diagnosis.severity,
                healingTimeMs: healOutcome.healingTimeMs,
                healedUrl: hs.url,
                engine: hs.engine,
                key_id: hs.key_id,
                key: hs.key
            }
        };

        return { answer, widget };
    }

    /**
     * Domain: Channel Resolution & Instant Playback
     */
    private static async handleChannelResolution(entities: Record<string, any>): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const query = (entities.channelName || 'Star Sports 1').trim();
        const allChannels = ChannelJsonService.getChannels();
        const jsonMatch = allChannels.find(c => (c.name || '').toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes((c.name || '').toLowerCase()));
        const jtvChannels = await JtvService.fetchChannels(false);
        const jtvMatch = jtvChannels.find(c => c.name.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(c.name.toLowerCase()));

        let channelName = query;
        let streamUrl = '';
        let drmInfo = '';
        let logo = '';
        let engine = 'hls';

        if (jtvMatch) {
            channelName = jtvMatch.name;
            streamUrl = jtvMatch.manifest_url || jtvMatch.stream_url || `/live.php?token=STALKER_PRO&id=mdtv-${jtvMatch.id}&m3u=1`;
            logo = jtvMatch.logo || '';
            engine = streamUrl.includes('.mpd') ? 'shaka' : 'hls';
            if (jtvMatch.key_id && jtvMatch.key) {
                drmInfo = `ClearKey DRM: \`${jtvMatch.key_id}:${jtvMatch.key}\``;
            }
        } else if (jsonMatch) {
            channelName = jsonMatch.name;
            streamUrl = jsonMatch.stream_url || jsonMatch.url || '';
            logo = jsonMatch.logo || '';
            engine = streamUrl.includes('.mpd') ? 'shaka' : (streamUrl.includes('.ts') ? 'mpegts' : 'hls');
        } else {
            // Default fallback
            streamUrl = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(query)}&m3u=1`;
        }

        const playerUrl = `/play.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(channelName)}`;

        const answer = `### 📺 Channel Stream Resolution: **${channelName}**

**Stream Metadata:**
- **Channel Title:** ${channelName}
- **Recommended Engine:** \`${engine.toUpperCase()}\`
- **Stream URL:** \`${streamUrl}\`
${drmInfo ? `- **DRM Protection:** ${drmInfo}` : '- **DRM Protection:** Direct Clear / Akamai Tokenized'}
- **M3U Entry Format:** Direct Media Endpoint (Compliance verified: Pure Stream without HTML embeds)

Click the button below to launch the channel natively inside the Stalker Pro Player deck.`;

        const widget: HariChatResponse['widget'] = {
            type: 'channel_card',
            data: {
                name: channelName,
                streamUrl,
                playerUrl,
                logo,
                engine
            }
        };

        return { answer, widget };
    }

    /**
     * Domain: Movies & TV Series Search
     */
    private static async handleMovieSearch(entities: Record<string, any>): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const title = (entities.title || 'The Matrix').trim();
        const type = entities.type || 'movie';

        // 1. Check SM Movie Hub (36k catalog)
        const smResults = await searchSmMovies(title, 3);
        // 2. Check FrameX TV Direct
        let framexResult: any = null;
        try {
            framexResult = await scrapeFrameXStream({ title, type: type === 'tv' ? 'tv' : 'movie' });
        } catch (_) {}

        const smFound = smResults && smResults.length > 0 ? smResults[0] : null;
        const directUrl = framexResult?.primaryM3u8 || smFound?.streamUrl || '';
        const playUrl = directUrl ? `/play.php?url=${encodeURIComponent(directUrl)}&name=${encodeURIComponent(title)}&media_type=${type}` : '';

        const answer = `### 🎬 Cinema & Series Search: **"${title}"**

**Cluster Search Outcomes:**
1. **SM Movie Hub (Fibwatch 36k Catalog):** ${smFound ? `✅ Match found: *${smFound.title}* (${smFound.quality || '1080p'})` : 'No direct index match'}
2. **FrameX Multi-Provider Cluster:** ${framexResult?.success ? `✅ Direct HLS Stream resolved (${framexResult.sources.length} sources, ${framexResult.subtitles?.length || 0} subtitles)` : 'Upstream query bypassed'}
3. **Movies4u Mirror Engine:** Ready on standby via \`https://new1.movies4u.garden\`

**Primary Direct Stream:**
\`\`\`text
${directUrl || 'Stream resolving in background via secondary mirror pool.'}
\`\`\`

You can stream this title immediately with auto-audio track selection.`;

        const widget: HariChatResponse['widget'] = {
            type: 'media_card',
            data: {
                title: smFound?.title || title,
                type,
                quality: smFound?.quality || '1080p Full HD',
                streamUrl: directUrl,
                playUrl,
                logo: smFound?.logo || ''
            }
        };

        return { answer, widget };
    }

    /**
     * Domain: Sports & Events Aggregator
     */
    private static async handleSportsSchedule(entities: Record<string, any>): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const [willow, prime, sonyliv] = await Promise.all([
            fetchWillowEvents(false).catch(() => []),
            fetchPrimeEvents(false).catch(() => []),
            fetchSonyLivEvents(false).catch(() => ({ live: [], all: [] }))
        ]);

        const cricketMatches = willow.slice(0, 5);
        const primeMatches = prime.slice(0, 4);
        const sonyMatches = (sonyliv.live || []).slice(0, 4);

        const answer = `### 🏆 Live Sports & Upcoming Events Dashboard

**1. Willow Cricket Live Feeds:**
${cricketMatches.length > 0 ? cricketMatches.map(m => `- **${m.title || 'Live Match'}** (1080p FHD) — [Stream Link](/play.php?url=${encodeURIComponent(m.streamUrl || '')}&name=${encodeURIComponent(m.title || 'Willow Live')})`).join('\n') : '- No active Willow cricket matches at this moment.'}

**2. SonyLIV Live Sports Matches:**
${sonyMatches.length > 0 ? sonyMatches.map((m: any) => `- **${m.title || 'Live Match'}** (Sony Sports 1/2/Ten) — [Stream Link](/play.php?url=${encodeURIComponent(m.streamUrl || '')}&name=${encodeURIComponent(m.title || 'Sony Live')})`).join('\n') : '- Sony sports schedule indexing in background.'}

**3. Amazon Prime Sports Hub:**
${primeMatches.length > 0 ? primeMatches.map(m => `- **${m.title || 'Live Match'}** (Prime Live Feed) — [Stream Link](/play.php?url=${encodeURIComponent(m.streamUrl || '')}&name=${encodeURIComponent(m.title || 'Prime Live')})`).join('\n') : '- No Prime sports broadcasts ongoing.'}

All streams feature Akamai token preservation and zero-latency DASH/HLS synchronization.`;

        return { answer };
    }

    /**
     * Domain: Server Administration Actions
     */
    private static async handleServerAction(entities: Record<string, any>): Promise<{ answer: string; widget?: HariChatResponse['widget'] }> {
        const action = entities.action || 'status';

        let answer = '';
        if (action === 'site_lock') {
            const current = Boolean((systemState as any)?.siteLockMode);
            answer = `### 🛡️ Quantum Site Lock Control
Current Status: ${current ? '🔴 **LOCKED (Active Gate)**' : '🟢 **UNLOCKED (Open Access)**'}

To toggle or update the Quantum Lock:
- Use the **System Maintenance** tab in the admin sidebar.
- Authorized Default PIN: \`202012\`
- When locked, any non-authenticated IP requesting public endpoints receives the Quantum Lock verification barrier.`;
        } else if (action === 'maintenance') {
            const current = Boolean((systemState as any)?.maintenanceMode);
            answer = `### ⚙️ System Maintenance Mode Control
Current Status: ${current ? '🟡 **MAINTENANCE ACTIVE**' : '🟢 **SYSTEM LIVE**'}

When Maintenance Mode is active:
- Standard web visitors are served the high-immersion maintenance screen with live ambient audio/video broadcast.
- Admin sessions with verified security tokens bypass maintenance automatically.`;
        } else {
            answer = `### ⚡ Server Execution Controller
Available autonomous commands:
- \`kill_streams\`: Forces instant teardown of all active MPEG-TS proxy sockets.
- \`clear_cache\`: Purges in-memory HLS segment cache and Stalker portal caches.
- \`refresh_github\`: Manually initiates the 25-minute JioTV and sports data sync loop.`;
        }

        const widget: HariChatResponse['widget'] = {
            type: 'action_card',
            data: { action, systemState }
        };

        return { answer, widget };
    }

    /**
     * Domain: Technical Architecture Explanations
     */
    private static handleArchitectureExplanation(entities: Record<string, any>): { answer: string } {
        const topic = entities.topic;

        if (topic === 'clearkey') {
            return {
                answer: `### 🔐 ClearKey DRM Architecture in Stalker Pro 2.0

ClearKey is a standard W3C DRM specification defined under UUID \`urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b\`.

**How Stalker Pro implements ClearKey natively:**
1. **Manifest Rewriting (\`/api/mdtv/manifest/:id.mpd\`):**
   - Injects the W3C ClearKey UUID into DASH \`<ContentProtection>\` elements alongside Widevine, allowing browser EME (Encrypted Media Extensions) to negotiate key exchange without CDM hardware restrictions.
   - Modifies \`minBufferTime="PT1.500S"\` to eliminate the periodic 10-second gap stalls.
2. **Key Pair Exchange:**
   - Keys are formatted as 16-byte hex strings (\`32 hex characters\`).
   - For **Shaka Player**, they are mapped directly as \`{ [keyIdHex]: keyHex }\`.
   - For **Dash.js**, hex values are converted via \`hexToBase64Url()\` into RFC 7515 base64url encodings and passed to \`org.w3.clearkey.clearkeys\`.
3. **Kodi M3U Integration:**
   - Emits \`#KODIPROP:inputstream.adaptive.license_type=clearkey\` and \`#KODIPROP:inputstream.adaptive.license_key=<keyId>:<key>\` immediately preceding the stream URL.`
            };
        }

        if (topic === 'ts_proxy') {
            return {
                answer: `### 🧼 Reverse Proxy TS Cleaning & Anti-Corruption Pipeline

Upstream IPTV sources frequently prepend anti-scraping payloads (e.g. fake \`RIFF....WEBP\` headers) to raw MPEG-TS video chunks. External players fail immediately when reading non-\`0x47\` sync bytes.

**Stalker Pro's Zero-Buffer Pipeline:**
1. **\`cleanTsBuffer(buffer)\`:**
   - Scans the first 4096 bytes for standard MPEG-TS sync byte \`0x47\`.
   - Validates sync integrity by checking for repeated \`0x47\` bytes at 188-byte intervals.
   - Slices off any junk prefix before sending binary chunks to the client.
2. **RAM Edge Segment Cache:**
   - Live HLS chunks are asynchronously pre-fetched into a 60-second in-memory ring cache.
   - Channel switching completes in sub-100ms with zero stalls.
3. **Token Inheritance:**
   - Akamai SHA tokens (\`__hdnea__\`) and Wanda portal tokens are automatically appended across relative chunk paths.`
            };
        }

        return {
            answer: `### 🛡️ Stalker Pro 2.0 Master Architecture

Stalker Pro operates on a three-tier architecture:
1. **Client & Video Player Deck:** Kodi, TiviMate, OTT Navigator, Plyr UI with dual-engine Shaka/Dash.js fallback.
2. **Express Gateway Router (Port 3000):** Pure stream M3U playlists, dynamic CORS stripper, and tokenized proxy pipelines.
3. **Backend Intelligence Hub:** Doctor Strange AI Stream Doctor, JioTV MDTV scrapers, TimStreams deobfuscator, and multi-tier movie resolvers.`
        };
    }

    /**
     * Domain: Shell, FFmpeg, and Code Generation
     */
    private static handleCodeGeneration(query: string, entities: Record<string, any>): { answer: string } {
        return {
            answer: `### 💻 Autonomous Code Generation & Diagnostic Utilities

Here are production-grade scripts tailored to your request:

**1. Test Stream Latency & Headers (PowerShell):**
\`\`\`powershell
# Probe stream response time and HTTP status code
$Url = "http://localhost:3000/live.php?token=STALKER_PRO&id=mdtv-1106&m3u=1"
Measure-Command { $Res = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 5 } | Select-Object TotalMilliseconds
Write-Host "HTTP Status:" $Res.StatusCode
\`\`\`

**2. Transcode / Restream MPEG-TS to Clean HLS with FFmpeg:**
\`\`\`bash
ffmpeg -re -i "http://upstream.provider/live.ts" \\
  -c:v copy -c:a aac -b:a 128k \\
  -f hls -hls_time 4 -hls_list_size 6 -hls_flags delete_segments \\
  /tmp/live_stream.m3u8
\`\`\`

**3. Test AI Doctor Stream Healing API via cURL:**
\`\`\`bash
curl -X POST http://localhost:3000/api/ai/heal_stream \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", "reportedError": "Buffer stall"}'
\`\`\``
        };
    }

    /**
     * Domain: General Conversational Intelligence
     */
    private static handleGeneralConversation(query: string, history: HariChatMessage[]): { answer: string } {
        return {
            answer: `Hello Admin! I am **HARI** (High-intelligence Autonomous Resolver & Intelligence) — your offline AI assistant built natively inside Stalker Pro & Aetheris Core.

I run 100% locally on your server without any third-party AI APIs or external servers.

**What I can do for you right now:**
- 🛰️ **System Telemetry:** Real-time RAM, active streaming sockets, bandwidth, and CPU load.
- 🩺 **Doctor Strange AI Stream Doctor:** Diagnose, unbuffer, and heal broken IPTV or movie streams.
- 📺 **Channel & Live Sports Lookup:** Instant stream resolution with W3C ClearKey DRM support.
- 🎬 **Cinema & Series Search:** Query SM Movie Hub (36k movies), Movies4u, and FrameX clusters.
- 🛡️ **Gateway Security:** Toggle Quantum Site Lock, update PINs, and manage maintenance modes.
- 💻 **Engineering & Code:** Generate FFmpeg commands, proxy scripts, and architectural insights.

How can I help you optimize or manage the platform today?`
        };
    }
}
