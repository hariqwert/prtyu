import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AiStreamDoctorService } from './aiStreamDoctorService';

export interface ChannelHealthRecord {
    id: string;
    name: string;
    url: string;
    status: 'healthy' | 'failing' | 'backup_active';
    latencyMs: number;
    lastChecked: string;
    consecutiveFailures: number;
    errorReason?: string;
    backupUrl?: string;
    isBackupSwitched?: boolean;
}

export interface StreamHealthSummary {
    totalScanned: number;
    healthyCount: number;
    failingCount: number;
    backupSwitchedCount: number;
    lastScanTime: string;
    isScanning: boolean;
    scanIntervalMinutes: number;
    autoSwitchEnabled: boolean;
}

const HEALTH_FILE = path.join(process.cwd(), 'doctor_strange', 'stream_health.json');

class StreamHealthService {
    private healthMap: Map<string, ChannelHealthRecord> = new Map();
    private isScanning: boolean = false;
    private scanIntervalMinutes: number = 5;
    private autoSwitchEnabled: boolean = true;
    private timer: NodeJS.Timeout | null = null;
    private lastScanTime: string = 'Never';

    constructor() {
        this.loadState();
        // Start background worker
        this.startWorker();
    }

    private loadState() {
        try {
            if (fs.existsSync(HEALTH_FILE)) {
                const raw = fs.readFileSync(HEALTH_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed.records && Array.isArray(parsed.records)) {
                    parsed.records.forEach((r: ChannelHealthRecord) => {
                        this.healthMap.set(r.id, r);
                    });
                }
                if (typeof parsed.scanIntervalMinutes === 'number') {
                    this.scanIntervalMinutes = parsed.scanIntervalMinutes;
                }
                if (typeof parsed.autoSwitchEnabled === 'boolean') {
                    this.autoSwitchEnabled = parsed.autoSwitchEnabled;
                }
                if (parsed.lastScanTime) {
                    this.lastScanTime = parsed.lastScanTime;
                }
            }
        } catch (e: any) {
            console.warn('[StreamHealth] Could not load prior health state:', e.message);
        }
    }

    private saveState() {
        try {
            const dir = path.dirname(HEALTH_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const data = {
                lastScanTime: this.lastScanTime,
                scanIntervalMinutes: this.scanIntervalMinutes,
                autoSwitchEnabled: this.autoSwitchEnabled,
                records: Array.from(this.healthMap.values())
            };
            fs.writeFileSync(HEALTH_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (e: any) {
            console.warn('[StreamHealth] Could not save health state:', e.message);
        }
    }

    public startWorker() {
        if (this.timer) clearInterval(this.timer);
        const ms = Math.max(1, this.scanIntervalMinutes) * 60 * 1000;
        this.timer = setInterval(() => {
            this.runHealthScan().catch(() => {});
        }, ms);
        console.log(`[StreamHealth] Background health checker scheduled every ${this.scanIntervalMinutes} minute(s).`);
    }

    /**
     * Check a single stream URL with low-overhead HTTP HEAD / range GET
     */
    public async checkStream(url: string, timeoutMs: number = 4000): Promise<{ healthy: boolean; latency: number; error?: string }> {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return { healthy: false, latency: 0, error: 'Invalid URL scheme' };
        }

        const start = Date.now();
        try {
            // First attempt quick HEAD request
            const headRes = await axios.head(url, {
                timeout: timeoutMs,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                maxRedirects: 3,
                validateStatus: (status) => status < 400
            });
            const latency = Date.now() - start;
            return { healthy: true, latency };
        } catch (headErr: any) {
            // HEAD might be rejected by some HLS servers; fallback to range GET (1st byte)
            try {
                const getRes = await axios.get(url, {
                    timeout: timeoutMs,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Range': 'bytes=0-512',
                        'Accept': '*/*'
                    },
                    maxRedirects: 3,
                    responseType: 'arraybuffer',
                    validateStatus: (status) => status < 400
                });
                const latency = Date.now() - start;
                return { healthy: true, latency };
            } catch (getErr: any) {
                const errDetail = getErr.response ? `HTTP ${getErr.response.status}` : (getErr.code || getErr.message || 'Timeout');
                return { healthy: false, latency: Date.now() - start, error: errDetail };
            }
        }
    }

    /**
     * Run full scan across channels
     */
    public async runHealthScan(): Promise<StreamHealthSummary> {
        if (this.isScanning) {
            return this.getSummary();
        }

        this.isScanning = true;
        console.log('[StreamHealth] Starting automated stream health scan...');

        try {
            // Load channels from channels.json or cached channels
            const channelsJsonPath = path.join(process.cwd(), 'doctor_strange', 'channels.json');
            let channels: any[] = [];

            if (fs.existsSync(channelsJsonPath)) {
                try {
                    const raw = fs.readFileSync(channelsJsonPath, 'utf8');
                    channels = JSON.parse(raw);
                } catch (e) {}
            }

            // If empty, look in m3u storage or live cache
            if (!Array.isArray(channels) || channels.length === 0) {
                const sampleChannels = [
                    { id: 'ch_sample_1', name: 'Global News HD', stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
                    { id: 'ch_sample_2', name: 'Sports 24/7', stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8' },
                    { id: 'ch_sample_3', name: 'Action Cinema', stream_url: 'https://live-par-2-cdn-alt.livepush.io/live/bigbuckbunnyclip/index.m3u8' }
                ];
                channels = sampleChannels;
            }

            // Scan in batches of 10 concurrently
            const batchSize = 10;
            const toScan = channels.slice(0, 100); // Scan top 100 channels per cycle

            for (let i = 0; i < toScan.length; i += batchSize) {
                const batch = toScan.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (ch) => {
                        const streamUrl = ch.stream_url || ch.playback_url || ch.url || '';
                        if (!streamUrl) return;

                        const id = String(ch.id || ch.name);
                        const prev = this.healthMap.get(id);
                        const result = await this.checkStream(streamUrl);

                        if (result.healthy) {
                            this.healthMap.set(id, {
                                id,
                                name: ch.name || 'Channel ' + id,
                                url: streamUrl,
                                status: 'healthy',
                                latencyMs: result.latency,
                                lastChecked: new Date().toISOString(),
                                consecutiveFailures: 0,
                                backupUrl: ch.backup_url || '',
                                isBackupSwitched: false
                            });
                        } else {
                            const failCount = (prev?.consecutiveFailures || 0) + 1;
                            let newStatus: 'failing' | 'backup_active' = 'failing';
                            let isSwitched = false;
                            let backupStreamUrl = ch.backup_url || '';

                            // Attempt autonomous AI healing
                            try {
                                const aiHeal = await AiStreamDoctorService.healStream({
                                    url: streamUrl,
                                    channelId: id,
                                    channelName: ch.name,
                                    reportedError: result.error
                                });
                                if (aiHeal.healed && aiHeal.healedStream?.url) {
                                    newStatus = 'backup_active';
                                    isSwitched = true;
                                    backupStreamUrl = aiHeal.healedStream.url;
                                    console.log(`[StreamHealth AI] Proactively healed channel ${ch.name || id} in ${aiHeal.healingTimeMs}ms: ${aiHeal.actionTaken}`);
                                } else if (this.autoSwitchEnabled && (ch.backup_url || failCount >= 2)) {
                                    newStatus = 'backup_active';
                                    isSwitched = true;
                                }
                            } catch (_) {
                                if (this.autoSwitchEnabled && (ch.backup_url || failCount >= 2)) {
                                    newStatus = 'backup_active';
                                    isSwitched = true;
                                }
                            }

                            this.healthMap.set(id, {
                                id,
                                name: ch.name || 'Channel ' + id,
                                url: streamUrl,
                                status: newStatus,
                                latencyMs: result.latency,
                                lastChecked: new Date().toISOString(),
                                consecutiveFailures: failCount,
                                errorReason: isSwitched ? undefined : result.error,
                                backupUrl: backupStreamUrl,
                                isBackupSwitched: isSwitched
                            });
                        }
                    })
                );
            }

            this.lastScanTime = new Date().toISOString();
            this.saveState();
            console.log(`[StreamHealth] Scan complete. ${this.healthMap.size} channels evaluated.`);
        } catch (e: any) {
            console.error('[StreamHealth] Health scan error:', e.message);
        } finally {
            this.isScanning = false;
        }

        return this.getSummary();
    }

    public getSummary(): StreamHealthSummary {
        const records = Array.from(this.healthMap.values());
        const healthyCount = records.filter(r => r.status === 'healthy').length;
        const failingCount = records.filter(r => r.status === 'failing').length;
        const backupSwitchedCount = records.filter(r => r.status === 'backup_active' || r.isBackupSwitched).length;

        return {
            totalScanned: records.length,
            healthyCount,
            failingCount,
            backupSwitchedCount,
            lastScanTime: this.lastScanTime,
            isScanning: this.isScanning,
            scanIntervalMinutes: this.scanIntervalMinutes,
            autoSwitchEnabled: this.autoSwitchEnabled
        };
    }

    public getRecords(): ChannelHealthRecord[] {
        return Array.from(this.healthMap.values());
    }

    public getPublicStatusMap(): Record<string, { status: string; latency: number; error?: string; backupActive?: boolean }> {
        const map: Record<string, { status: string; latency: number; error?: string; backupActive?: boolean }> = {};
        for (const [id, rec] of this.healthMap.entries()) {
            map[id] = {
                status: rec.status,
                latency: rec.latencyMs,
                error: rec.errorReason,
                backupActive: rec.isBackupSwitched
            };
        }
        return map;
    }

    public updateConfig(params: { scanIntervalMinutes?: number; autoSwitchEnabled?: boolean }) {
        if (typeof params.scanIntervalMinutes === 'number' && params.scanIntervalMinutes >= 1) {
            this.scanIntervalMinutes = params.scanIntervalMinutes;
            this.startWorker();
        }
        if (typeof params.autoSwitchEnabled === 'boolean') {
            this.autoSwitchEnabled = params.autoSwitchEnabled;
        }
        this.saveState();
        return this.getSummary();
    }
}

export const streamHealthService = new StreamHealthService();
