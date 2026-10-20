import fs from 'fs';
import path from 'path';

export interface ServerLogEntry {
    id: string;
    timestamp: number;
    timeFormatted: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'STREAM' | 'AUTH' | 'PROXY';
    message: string;
    ip?: string;
    stream?: string;
    userAgent?: string;
    durationMs?: number;
}

export interface DetailedSession {
    ip: string;
    streamId: string;
    streamTitle: string;
    type: string;
    startTime: number;
    lastActive: number;
    uptimeSeconds: number;
    formattedUptime: string;
    userAgent: string;
    bytesTransferred: number;
    status: 'active' | 'buffering' | 'idle';
}

const RETENTION_MS = 36 * 60 * 60 * 1000; // 36 Hours Rolling Retention
const LOG_FILE_PATH = path.join(process.cwd(), 'doctor_strange', 'server_logs_36h.jsonl');
const MAX_IN_MEMORY_LOGS = 5000;

// In-Memory Ring Buffer for instantaneous live queries
let inMemoryLogs: ServerLogEntry[] = [];
// Active sessions registry
const detailedSessionsMap = new Map<string, DetailedSession>();

// Ensure directory exists
try {
    const dir = path.dirname(LOG_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
} catch (e) {}

/**
 * Format uptime into clean readable string (e.g. "1h 14m 20s" or "45s")
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m ${secs}s`;
}

/**
 * Clean & prune logs older than 36 hours
 */
export function pruneOldLogs(): void {
    const cutoff = Date.now() - RETENTION_MS;
    
    // Prune in-memory logs
    inMemoryLogs = inMemoryLogs.filter(log => log.timestamp >= cutoff);
    if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
        inMemoryLogs = inMemoryLogs.slice(-MAX_IN_MEMORY_LOGS);
    }

    // Prune on-disk JSONL file asynchronously
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) return;
        const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const lines = fileContent.trim().split('\n');
        const freshLines: string[] = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    freshLines.push(line);
                }
            } catch (err) {}
        }
        
        fs.writeFileSync(LOG_FILE_PATH, freshLines.join('\n') + (freshLines.length > 0 ? '\n' : ''), 'utf8');
    } catch (e) {
        // Non-fatal
    }
}

/**
 * Load initial logs from disk into in-memory ring buffer
 */
function initLogsFromDisk(): void {
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) return;
        const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const lines = fileContent.trim().split('\n');
        const cutoff = Date.now() - RETENTION_MS;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const entry: ServerLogEntry = JSON.parse(line);
                if (entry.timestamp >= cutoff) {
                    inMemoryLogs.push(entry);
                }
            } catch (err) {}
        }
        
        if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
            inMemoryLogs = inMemoryLogs.slice(-MAX_IN_MEMORY_LOGS);
        }
    } catch (e) {}
}

initLogsFromDisk();
// Run auto-pruning every 15 minutes
setInterval(pruneOldLogs, 15 * 60 * 1000);

let logCounter = 0;

/**
 * Add a structured server log entry
 */
export function logServerEvent(
    level: 'INFO' | 'WARN' | 'ERROR' | 'STREAM' | 'AUTH' | 'PROXY',
    message: string,
    meta: { ip?: string; stream?: string; userAgent?: string; durationMs?: number } = {}
): ServerLogEntry {
    const now = Date.now();
    const entry: ServerLogEntry = {
        id: `log_${now}_${++logCounter}`,
        timestamp: now,
        timeFormatted: new Date(now).toISOString().replace('T', ' ').substring(0, 19),
        level,
        message,
        ip: meta.ip?.replace('::ffff:', ''),
        stream: meta.stream,
        userAgent: meta.userAgent,
        durationMs: meta.durationMs
    };

    inMemoryLogs.push(entry);
    if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
        inMemoryLogs.shift();
    }

    // Append to 36h JSONL file
    try {
        fs.appendFile(LOG_FILE_PATH, JSON.stringify(entry) + '\n', () => {});
    } catch (e) {}

    return entry;
}

/**
 * Query logs with filters
 */
export function queryServerLogs(options: {
    limit?: number;
    level?: string;
    ip?: string;
    search?: string;
    since?: number;
}): { logs: ServerLogEntry[]; total: number; retentionHours: number } {
    let result = inMemoryLogs;
    const since = options.since || (Date.now() - RETENTION_MS);

    result = result.filter(l => l.timestamp >= since);

    if (options.level && options.level !== 'ALL') {
        const lvl = options.level.toUpperCase();
        result = result.filter(l => l.level === lvl);
    }

    if (options.ip) {
        const cleanIp = options.ip.trim().replace('::ffff:', '');
        result = result.filter(l => l.ip && l.ip.includes(cleanIp));
    }

    if (options.search) {
        const q = options.search.toLowerCase().trim();
        result = result.filter(l => 
            l.message.toLowerCase().includes(q) ||
            (l.ip && l.ip.toLowerCase().includes(q)) ||
            (l.stream && l.stream.toLowerCase().includes(q))
        );
    }

    const total = result.length;
    const limit = Math.min(options.limit || 200, 1000);
    const sliced = result.slice(-limit);

    return {
        logs: sliced,
        total,
        retentionHours: 36
    };
}

/**
 * Clear all logs
 */
export function clearAllLogs(): void {
    inMemoryLogs = [];
    try {
        if (fs.existsSync(LOG_FILE_PATH)) {
            fs.writeFileSync(LOG_FILE_PATH, '', 'utf8');
        }
    } catch (e) {}
}

/**
 * Export logs as plain text for download
 */
export function exportLogsAsText(sinceHours = 36): string {
    const cutoff = Date.now() - (sinceHours * 60 * 60 * 1000);
    const eligible = inMemoryLogs.filter(l => l.timestamp >= cutoff);
    
    let out = `# STALKER PRO 2.0 SERVER LOG ARCHIVE (LAST ${sinceHours} HOURS)\n`;
    out += `# Generated At: ${new Date().toISOString()}\n`;
    out += `# Total Events: ${eligible.length}\n`;
    out += `# Format: [TIMESTAMP] [LEVEL] [IP] [STREAM] MESSAGE\n`;
    out += '--------------------------------------------------------------------------------\n\n';

    for (const l of eligible) {
        const ipStr = l.ip ? ` [${l.ip}]` : '';
        const streamStr = l.stream ? ` (${l.stream})` : '';
        out += `[${l.timeFormatted}] [${l.level}]${ipStr}${streamStr} ${l.message}\n`;
    }

    return out;
}

// =========================================================================
// ACTIVE STREAM SESSION MANAGER WITH UPTIME & STREAM IDENTIFICATION
// =========================================================================

/**
 * Map raw stream/channel IDs to friendly readable names
 */
export function resolveStreamTitle(streamId: string): { title: string; type: string } {
    if (!streamId) return { title: 'Unknown Stream', type: 'General' };

    const lower = streamId.toLowerCase();

    // MDTV Sports
    if (lower.startsWith('mdtv-')) {
        const id = lower.replace('mdtv-', '');
        const names: Record<string, string> = {
            '1106': 'Star Sports 1 HD (JioTV)',
            '1107': 'Star Sports 1 Hindi HD (JioTV)',
            '1108': 'Star Sports 1 Tamil (JioTV)',
            '1109': 'Star Sports 2 HD (JioTV)',
            '1110': 'Star Sports Select 1 HD',
            '1111': 'Star Sports Select 2 HD',
            '1112': 'Star Sports First',
            '1113': 'Sony Sports Ten 1 HD',
            '1114': 'Sony Sports Ten 2 HD',
            '1115': 'Sony Sports Ten 3 HD (Hindi)',
            '1116': 'Sony Sports Ten 4 HD (Tamil/Telugu)',
            '1117': 'Sony Sports Ten 5 HD',
            '1118': 'Eurosport HD',
            '1119': 'DD Sports 1.0 HD'
        };
        return {
            title: names[id] || `MDTV Sports Channel #${id}`,
            type: 'DASH ClearKey'
        };
    }

    // FanCode Live Matches
    if (lower.includes('fancode') || lower.includes('fc-')) {
        return { title: `FanCode Live Event (${streamId})`, type: 'FanCode Sports' };
    }

    // Willow Cricket
    if (lower.includes('willow')) {
        return { title: `Willow Cricket Live Feed (${streamId})`, type: 'Willow Cricket' };
    }

    // SonyLIV
    if (lower.includes('sonyliv') || lower.includes('sony')) {
        return { title: `SonyLIV Sports Broadcast (${streamId})`, type: 'SonyLIV' };
    }

    // Prime Sports
    if (lower.includes('prime')) {
        return { title: `Amazon Prime Video Sports (${streamId})`, type: 'Prime Sports' };
    }

    // TimStreams
    if (lower.includes('tim') || lower.includes('exmxbxe')) {
        return { title: `TimStreams Live Relay (${streamId})`, type: 'TimStreams HLS' };
    }

    // Movies4U
    if (lower.includes('m4u') || lower.includes('movies4u')) {
        return { title: `Movies4U VOD Stream (${streamId})`, type: 'Movies4U Acek' };
    }

    // SM Movie Hub
    if (lower.includes('sm_hub') || lower.includes('fibwatch')) {
        return { title: `SM Movie Hub Direct Stream (${streamId})`, type: 'SM Hub MKV' };
    }

    // Anime
    if (lower.includes('anime') || lower.includes('asiaflix') || lower.includes('kisskh')) {
        return { title: `Anime Stream (${streamId})`, type: 'Anime Engine' };
    }

    // Bingr Clusters
    if (['s40', 's62', 's61', 's3', 's70', 's31', 's30', 's4k', 'cinepro'].includes(lower)) {
        return { title: `OTT Streaming Cluster [${streamId.toUpperCase()}]`, type: 'HLS Cluster' };
    }

    return { title: streamId, type: 'HLS Stream' };
}

/**
 * Register or update a user streaming session
 */
export function trackUserStreamSession(params: {
    ip: string;
    streamId: string;
    userAgent?: string;
    type?: string;
    bytes?: number;
}): DetailedSession {
    const cleanIp = (params.ip || '0.0.0.0').replace('::ffff:', '').trim();
    const now = Date.now();

    const existing = detailedSessionsMap.get(cleanIp);
    const { title: resolvedTitle, type: resolvedType } = resolveStreamTitle(params.streamId);

    if (existing && existing.streamId === params.streamId) {
        existing.lastActive = now;
        existing.uptimeSeconds = Math.floor((now - existing.startTime) / 1000);
        existing.formattedUptime = formatDuration(existing.uptimeSeconds);
        if (params.bytes) existing.bytesTransferred += params.bytes;
        existing.status = 'active';
        return existing;
    }

    const session: DetailedSession = {
        ip: cleanIp,
        streamId: params.streamId,
        streamTitle: resolvedTitle,
        type: params.type || resolvedType,
        startTime: now,
        lastActive: now,
        uptimeSeconds: 0,
        formattedUptime: '0s',
        userAgent: params.userAgent || 'Unknown Player',
        bytesTransferred: params.bytes || 0,
        status: 'active'
    };

    detailedSessionsMap.set(cleanIp, session);

    // Also log this stream access event to 36-hour archive!
    logServerEvent('STREAM', `Client ${cleanIp} started playing: ${resolvedTitle}`, {
        ip: cleanIp,
        stream: params.streamId,
        userAgent: params.userAgent
    });

    return session;
}

/**
 * Update bytes transferred for a session
 */
export function recordSessionBytes(ip: string, bytes: number): void {
    const cleanIp = ip.replace('::ffff:', '').trim();
    const s = detailedSessionsMap.get(cleanIp);
    if (s) {
        s.bytesTransferred += bytes;
        s.lastActive = Date.now();
        s.uptimeSeconds = Math.floor((s.lastActive - s.startTime) / 1000);
        s.formattedUptime = formatDuration(s.uptimeSeconds);
    }
}

/**
 * End a user stream session
 */
export function endUserStreamSession(ip: string): void {
    const cleanIp = ip.replace('::ffff:', '').trim();
    const s = detailedSessionsMap.get(cleanIp);
    if (s) {
        logServerEvent('STREAM', `Client ${cleanIp} ended playback of: ${s.streamTitle} (Total watched: ${s.formattedUptime})`, {
            ip: cleanIp,
            stream: s.streamId
        });
        detailedSessionsMap.delete(cleanIp);
    }
}

/**
 * Sweep idle sessions (older than 90 seconds without segment pull)
 */
export function sweepIdleSessions(): void {
    const now = Date.now();
    for (const [ip, session] of detailedSessionsMap.entries()) {
        const idleTime = (now - session.lastActive) / 1000;
        if (idleTime > 90) {
            session.status = 'idle';
        }
        if (idleTime > 180) { // Disconnected after 3 mins of zero requests
            endUserStreamSession(ip);
        }
    }
}

setInterval(sweepIdleSessions, 15000);

/**
 * Get all active sessions with refreshed uptime durations
 */
export function getAllDetailedSessions(): DetailedSession[] {
    const now = Date.now();
    const sessions: DetailedSession[] = [];

    for (const s of detailedSessionsMap.values()) {
        s.uptimeSeconds = Math.floor((now - s.startTime) / 1000);
        s.formattedUptime = formatDuration(s.uptimeSeconds);
        sessions.push(s);
    }

    // Sort by longest uptime first
    sessions.sort((a, b) => b.startTime - a.startTime);
    return sessions;
}
