import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { LogoService } from './logoService';
import { ChannelJsonService } from './channelJsonService';

export interface QuarantinedChannel {
    id: string;
    name: string;
    logo: string;
    stream_url: string;
    group: string;
    playlist_id: string;
    playlist_name: string;
    playlist_file: string;
    error_reason: string;
    http_status?: number;
    quarantined_at: string;
    last_checked_at: string;
}

export interface ScanProgress {
    is_scanning: boolean;
    total: number;
    checked: number;
    dead: number;
    active: number;
    current_channel?: string;
    started_at?: string;
    finished_at?: string;
}

export class QuarantineService {
    private static dbPath = path.join(process.cwd(), 'doctor_strange', 'quarantine_channels.json');
    private static scanAborted = false;
    private static scanState: ScanProgress = {
        is_scanning: false,
        total: 0,
        checked: 0,
        dead: 0,
        active: 0
    };

    public static getScanStatus(): ScanProgress {
        return this.scanState;
    }

    public static getQuarantined(): QuarantinedChannel[] {
        try {
            if (fs.existsSync(this.dbPath)) {
                return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            }
        } catch (e) {
            console.error('Failed to read quarantine DB:', e);
        }
        return [];
    }

    public static saveQuarantined(items: QuarantinedChannel[]): void {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.dbPath, JSON.stringify(items, null, 2), 'utf8');
        } catch (e) {
            console.error('Failed to save quarantine DB:', e);
        }
    }

    public static isQuarantinedUrl(streamUrl: string): boolean {
        if (!streamUrl) return false;
        const list = this.getQuarantined();
        const cleanUrl = streamUrl.trim().toLowerCase();
        return list.some(q => q.stream_url.trim().toLowerCase() === cleanUrl);
    }

    public static quarantineStreamOnFailure(streamUrl: string, reason: string, httpStatus: number = 502, channelName?: string): void {
        if (!streamUrl || !streamUrl.startsWith('http')) return;
        try {
            const list = this.getQuarantined();
            const cleanUrl = streamUrl.trim();
            const existingIdx = list.findIndex(q => q.stream_url.trim().toLowerCase() === cleanUrl.toLowerCase());
            
            const qItem: QuarantinedChannel = {
                id: 'q_' + crypto.createHash('md5').update(cleanUrl).digest('hex'),
                name: channelName || 'Channel Stream',
                logo: '',
                stream_url: cleanUrl,
                group: 'Unreachable / Dead Feed',
                playlist_id: 'auto_quarantine',
                playlist_name: 'Dynamic Live Proxy Failure',
                playlist_file: '',
                error_reason: reason || 'Upstream provider returned non-playlist error',
                http_status: httpStatus,
                quarantined_at: new Date().toISOString(),
                last_checked_at: new Date().toISOString()
            };

            if (existingIdx >= 0) {
                list[existingIdx].error_reason = reason;
                list[existingIdx].last_checked_at = new Date().toISOString();
                list[existingIdx].http_status = httpStatus;
            } else {
                list.push(qItem);
            }
            this.saveQuarantined(list);
        } catch (e) {
            console.error('Failed to auto-quarantine dead stream:', e);
        }
    }

    public static getNonSportsM3uFiles(): Array<{ id: string; name: string; filePath: string }> {
        const result: Array<{ id: string; name: string; filePath: string }> = [];

        // 1. public/kliv_zob.m3u
        const zobPath = path.join(process.cwd(), 'public', 'kliv_zob.m3u');
        if (fs.existsSync(zobPath)) {
            result.push({ id: 'kliv_zob', name: 'KLIV Master Zob Playlist', filePath: zobPath });
        }

        // 2. public/kliv_jozo.m3u or public/kliv_jozo.txt
        const jozoM3u = path.join(process.cwd(), 'public', 'kliv_jozo.m3u');
        const jozoTxt = path.join(process.cwd(), 'public', 'kliv_jozo.txt');
        if (fs.existsSync(jozoM3u)) {
            result.push({ id: 'kliv_jozo', name: 'KLIV Jozo Entertainment', filePath: jozoM3u });
        } else if (fs.existsSync(jozoTxt)) {
            result.push({ id: 'kliv_jozo', name: 'KLIV Jozo Entertainment', filePath: jozoTxt });
        }

        // 3. doctor_strange/m3u_playlists/*.m3u (excluding sports_m3u_*)
        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(vaultDir)) {
            const files = fs.readdirSync(vaultDir);
            for (const f of files) {
                // EXCLUDE sportsM3u files explicitly
                if (f.startsWith('local_sports_m3u_') || f.includes('sports_m3u') || f.toLowerCase().includes('sportsm3u')) {
                    continue;
                }
                if (f.endsWith('.m3u') || f.endsWith('.m3u8')) {
                    result.push({
                        id: f.replace(/\.(m3u|m3u8)$/i, ''),
                        name: `Vault: ${f}`,
                        filePath: path.join(vaultDir, f)
                    });
                }
            }
        }

        return result;
    }

    public static async probeStream(streamUrl: string): Promise<{ live: boolean; reason: string; status?: number }> {
        if (!streamUrl || !streamUrl.startsWith('http')) {
            return { live: false, reason: 'Invalid or missing stream URL' };
        }

        // Clean user-agent if embedded
        let targetUrl = streamUrl;
        let customUA = 'VLC/3.0.18 LibVLC/3.0.18';
        if (targetUrl.includes('http-user-agent=')) {
            const parts = targetUrl.split('http-user-agent=');
            targetUrl = parts[0].replace(/[?&]$/, '');
            try {
                customUA = decodeURIComponent(parts[1]);
            } catch (e) {}
        }

        const executeProbe = async (): Promise<{ live: boolean; reason: string; status?: number }> => {
            try {
                // Try a GET Range request first to get the first chunk and detect fake 200 OKs
                const getRes = await axios.get(targetUrl, {
                    timeout: 8000,
                    headers: {
                        'User-Agent': customUA,
                        'Range': 'bytes=0-2048',
                        'Accept': '*/*'
                    },
                    responseType: 'arraybuffer', // Get the actual bytes to inspect them
                    validateStatus: (s) => s < 400 || s === 405 || s === 403
                });

                if (getRes.status >= 200 && getRes.status < 400) {
                    const data = getRes.data;
                    if (data && data.byteLength < 100) {
                        const strData = Buffer.from(data).toString('utf8').toLowerCase();
                        if (strData.includes('not found') || strData.includes('denied') || strData.includes('forbidden') || strData.includes('error')) {
                            return { live: false, reason: 'Fake 200 OK (Upstream Provider Error)', status: 404 };
                        }
                    }
                    return { live: true, reason: 'OK', status: getRes.status };
                }
                
                if (getRes.status === 405 || getRes.status === 403) {
                     return { live: false, reason: `HTTP Status ${getRes.status}`, status: getRes.status };
                }

                return { live: false, reason: `HTTP Status ${getRes.status}`, status: getRes.status };

            } catch (err: any) {
                let reason = err.message || 'Connection failed';
                if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                    reason = 'Stream Handshake Timeout (>8.0s)';
                } else if (err.code === 'ENOTFOUND') {
                    reason = 'Domain / Host Not Found';
                } else if (err.code === 'ECONNREFUSED') {
                    reason = 'Connection Refused';
                } else if (err.response?.status) {
                    reason = `HTTP ${err.response.status} ${err.response.statusText || 'Error'}`;
                }
                return { live: false, reason, status: err.response?.status };
            }
        };

        // Primary probe attempt
        const firstAttempt = await executeProbe();
        if (firstAttempt.live) {
            return firstAttempt;
        }

        // Retry once after 1 second to resolve transient network drops and dynamic token handshakes
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryAttempt = await executeProbe();
        return retryAttempt;
    }

    public static async startBackgroundHealthScan(scope: 'all' | 'channels_json' = 'channels_json'): Promise<ScanProgress> {
        if (this.scanState.is_scanning) {
            return this.scanState;
        }

        const allChannelsToScan: Array<{
            name: string;
            logo: string;
            stream_url: string;
            group: string;
            playlist_id: string;
            playlist_name: string;
            playlist_file: string;
            xmltv_id?: string;
        }> = [];

        const seenUrls = new Set<string>();

        // 1. PRIMARY SOURCE: assets/channels.json (5,223 channels catalog)
        const channelsJsonPath = path.join(process.cwd(), 'assets', 'channels.json');
        const jsonChannels = ChannelJsonService.getChannels();

        for (const ch of jsonChannels) {
            const url = (ch.channel_id || '').trim();
            if (!url || !url.startsWith('http') || seenUrls.has(url)) continue;
            seenUrls.add(url);

            const name = ch.name || 'Channel';
            const group = ch.genre || 'General';
            const currentLogo = ch.logo || '';
            const resolvedLogo = LogoService.getLogoForChannel(name, undefined, currentLogo);

            allChannelsToScan.push({
                name,
                logo: resolvedLogo,
                stream_url: url,
                group,
                playlist_id: 'channels_json',
                playlist_name: 'channels.json (Master Catalog)',
                playlist_file: channelsJsonPath,
                xmltv_id: undefined
            });
        }

        // 2. Also include M3U files if scope is 'all'
        if (scope === 'all') {
            const files = this.getNonSportsM3uFiles();
            for (const file of files) {
                try {
                    const content = fs.readFileSync(file.filePath, 'utf8');
                    const lines = content.split(/\r?\n/);
                    let curInf: string | null = null;

                    for (const line of lines) {
                        const l = line.trim();
                        if (!l) continue;
                        if (l.startsWith('#EXTINF:')) {
                            curInf = l;
                            continue;
                        }
                        if (l.startsWith('#')) continue;

                        if (curInf && l.startsWith('http')) {
                            if (!seenUrls.has(l)) {
                                seenUrls.add(l);
                                const commaPos = curInf.lastIndexOf(',');
                                const name = commaPos !== -1 ? curInf.substring(commaPos + 1).trim() : 'Channel';
                                const groupMatch = curInf.match(/group-title="([^"]+)"/i) || curInf.match(/group-title=([^ ]+)/i);
                                const group = groupMatch ? groupMatch[1].trim() : 'General';
                                const logoMatch = curInf.match(/tvg-logo="([^"]+)"/i) || curInf.match(/tvg-logo=([^ ]+)/i);
                                const currentLogo = logoMatch ? logoMatch[1].trim() : '';
                                const idMatch = curInf.match(/tvg-id="([^"]+)"/i) || curInf.match(/tvg-id=([^ ]+)/i);
                                const xmltvId = idMatch ? idMatch[1].trim() : '';

                                const resolvedLogo = LogoService.getLogoForChannel(name, xmltvId, currentLogo);

                                allChannelsToScan.push({
                                    name,
                                    logo: resolvedLogo,
                                    stream_url: l,
                                    group,
                                    playlist_id: file.id,
                                    playlist_name: file.name,
                                    playlist_file: file.filePath,
                                    xmltv_id: xmltvId
                                });
                            }
                            curInf = null;
                        }
                    }
                } catch (e) {
                    console.error(`Error parsing ${file.filePath}:`, e);
                }
            }
        }

        this.scanAborted = false;
        this.scanState = {
            is_scanning: true,
            total: allChannelsToScan.length,
            checked: 0,
            dead: 0,
            active: 0,
            started_at: new Date().toISOString()
        };

        // Run scanner asynchronously in batches
        (async () => {
            const concurrency = 16;
            let index = 0;
            const existingQuarantine = this.getQuarantined();
            const quarantineMap = new Map<string, QuarantinedChannel>();
            existingQuarantine.forEach(q => quarantineMap.set(q.stream_url, q));

            const worker = async () => {
                while (index < allChannelsToScan.length) {
                    if (this.scanAborted) break;
                    const curIndex = index++;
                    const ch = allChannelsToScan[curIndex];
                    if (!ch) break;

                    this.scanState.current_channel = ch.name;
                    const probeResult = await this.probeStream(ch.stream_url);

                    if (this.scanAborted) break;

                    this.scanState.checked++;

                    if (!probeResult.live) {
                        this.scanState.dead++;
                        const qItem: QuarantinedChannel = {
                            id: 'q_' + crypto.createHash('md5').update(ch.stream_url).digest('hex'),
                            name: ch.name,
                            logo: ch.logo,
                            stream_url: ch.stream_url,
                            group: ch.group,
                            playlist_id: ch.playlist_id,
                            playlist_name: ch.playlist_name,
                            playlist_file: ch.playlist_file,
                            error_reason: probeResult.reason,
                            http_status: probeResult.status,
                            quarantined_at: new Date().toISOString(),
                            last_checked_at: new Date().toISOString()
                        };
                        quarantineMap.set(ch.stream_url, qItem);
                    } else {
                        this.scanState.active++;
                        // If it came back online, remove from quarantine
                        quarantineMap.delete(ch.stream_url);
                    }

                    // Periodically persist
                    if (!this.scanAborted && this.scanState.checked % 25 === 0) {
                        this.saveQuarantined(Array.from(quarantineMap.values()));
                    }
                }
            };

            const workers = Array(concurrency).fill(null).map(() => worker());
            await Promise.all(workers);

            if (!this.scanAborted) {
                this.scanState.is_scanning = false;
                this.scanState.finished_at = new Date().toISOString();
                this.saveQuarantined(Array.from(quarantineMap.values()));
                console.log(`[QUARANTINE SCAN COMPLETE] Total: ${this.scanState.total}, Dead/Quarantined: ${this.scanState.dead}, Active: ${this.scanState.active}`);
            } else {
                console.log('[QUARANTINE SCAN ABORTED] Scan stopped and diagnostic data cleared.');
            }
        })().catch(err => {
            console.error('Scan worker failure:', err);
            this.scanState.is_scanning = false;
        });

        return this.scanState;
    }

    public static deleteQuarantinedChannel(channelIdOrUrl: string): { success: boolean; message: string } {
        const list = this.getQuarantined();
        const target = list.find(q => q.id === channelIdOrUrl || q.stream_url === channelIdOrUrl);
        if (!target) {
            return { success: false, message: 'Channel not found in quarantine' };
        }

        // 1. Remove from assets/channels.json
        try {
            ChannelJsonService.deleteSingleChannel(target.stream_url);
        } catch (err: any) {
            console.warn(`[!] Quarantine deletion in channels.json warning:`, err.message);
        }

        // 2. Remove channel lines from playlist file if M3U
        if (target.playlist_file && target.playlist_file.endsWith('.m3u') && fs.existsSync(target.playlist_file)) {
            try {
                const content = fs.readFileSync(target.playlist_file, 'utf8');
                const lines = content.split(/\r?\n/);
                const newLines: string[] = [];
                let skipNextUrl = false;

                for (let i = 0; i < lines.length; i++) {
                    const l = lines[i];
                    if (l.startsWith('#EXTINF:')) {
                        let nextUrl = '';
                        for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
                            const candidate = lines[j].trim();
                            if (candidate && !candidate.startsWith('#')) {
                                nextUrl = candidate;
                                break;
                            }
                        }
                        if (nextUrl === target.stream_url || nextUrl.includes(target.stream_url) || target.stream_url.includes(nextUrl)) {
                            skipNextUrl = true;
                            continue;
                        }
                    }

                    if (skipNextUrl) {
                        if (l.trim().startsWith('#EXTVLCOPT:') || l.trim().startsWith('#EXTGRP:')) {
                            continue;
                        }
                        if (l.trim() && !l.trim().startsWith('#')) {
                            skipNextUrl = false;
                            continue;
                        }
                    }

                    newLines.push(l);
                }

                fs.writeFileSync(target.playlist_file, newLines.join('\n'), 'utf8');
            } catch (e) {
                console.error(`Failed to update playlist ${target.playlist_file}:`, e);
            }
        }

        // 3. Remove from quarantine DB
        const updated = list.filter(q => q.id !== target.id);
        this.saveQuarantined(updated);

        return { success: true, message: `Deleted '${target.name}' from channels.json and playlist records` };
    }

    public static purgeAllQuarantinedChannels(): { deletedCount: number; message: string } {
        const list = this.getQuarantined();
        if (list.length === 0) {
            return { deletedCount: 0, message: 'No quarantined channels to delete.' };
        }

        const allUrlsToDelete = list.map(q => q.stream_url.trim());

        // 1. Purge from assets/channels.json
        let jsonDeleted = 0;
        try {
            jsonDeleted = ChannelJsonService.batchDelete(allUrlsToDelete);
        } catch (err: any) {
            console.error('[!] Failed to batch delete from channels.json:', err.message);
        }

        // 2. Purge from any M3U files
        const byFile: Record<string, Set<string>> = {};
        for (const item of list) {
            if (item.playlist_file && item.playlist_file.endsWith('.m3u')) {
                if (!byFile[item.playlist_file]) byFile[item.playlist_file] = new Set();
                byFile[item.playlist_file].add(item.stream_url.trim());
            }
        }

        let m3uRemoved = 0;
        for (const [filePath, urlSet] of Object.entries(byFile)) {
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split(/\r?\n/);
                    const newLines: string[] = [];
                    let skipNextUrl = false;

                    for (let i = 0; i < lines.length; i++) {
                        const l = lines[i];
                        if (l.startsWith('#EXTINF:')) {
                            let nextUrl = '';
                            for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
                                const candidate = lines[j].trim();
                                if (candidate && !candidate.startsWith('#')) {
                                    nextUrl = candidate;
                                    break;
                                }
                            }
                            if (urlSet.has(nextUrl)) {
                                skipNextUrl = true;
                                m3uRemoved++;
                                continue;
                            }
                        }

                        if (skipNextUrl) {
                            if (l.trim().startsWith('#EXTVLCOPT:') || l.trim().startsWith('#EXTGRP:')) {
                                continue;
                            }
                            if (l.trim() && !l.trim().startsWith('#')) {
                                skipNextUrl = false;
                                continue;
                            }
                        }

                        newLines.push(l);
                    }

                    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
                } catch (e) {
                    console.error(`Error purging from ${filePath}:`, e);
                }
            }
        }

        const totalRemoved = Math.max(jsonDeleted, list.length);
        this.saveQuarantined([]);
        return { 
            deletedCount: totalRemoved, 
            message: `Successfully deleted ${totalRemoved} dead channels from channels.json (${jsonDeleted} entries purged) and M3U playlists!` 
        };
    }

    public static restoreChannel(channelId: string): { success: boolean; message: string } {
        const list = this.getQuarantined();
        const updated = list.filter(q => q.id !== channelId);
        this.saveQuarantined(updated);
        return { success: true, message: 'Channel restored from quarantine.' };
    }

    public static clearScannedData(): { count: number; message: string } {
        this.scanAborted = true;
        const currentList = this.getQuarantined();
        const count = currentList.length;
        this.saveQuarantined([]);
        this.scanState = {
            is_scanning: false,
            total: 0,
            checked: 0,
            dead: 0,
            active: 0
        };
        return { count, message: `Successfully cleared ${count} scanned diagnostic records. channels.json and M3U files were not modified.` };
    }
}

