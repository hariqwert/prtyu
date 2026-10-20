import fs from 'fs';
import path from 'path';
import { syncToFirestore } from './firestoreSyncService';
import axios from 'axios';
import { LogoService } from './logoService';

export interface ChannelItem {
    channel_id: string; // The stream URL or ID
    name: string;
    genre: string;
    logo?: string;
    source?: string;
    url?: string;
    stream_url?: string;
    title?: string;
    group?: string;
    score?: number;
    streamUrl?: string;
    playUrl?: string;
}

export interface ConvertOptions {
    content?: string;
    m3uUrl?: string;
    mode: 'preview' | 'append' | 'replace';
    defaultGenre?: string;
    defaultSource?: string;
    deduplicate?: boolean;
}

export interface ChannelStats {
    totalChannels: number;
    totalGenres: number;
    fileSizeBytes: number;
    fileSizeFormatted: string;
    lastModified: string;
    genres: { name: string; count: number }[];
    sources: { name: string; count: number }[];
}

export class ChannelJsonService {
    private static channelsPath = path.join(process.cwd(), 'assets', 'channels.json');
    private static backupsDir = path.join(process.cwd(), 'doctor_strange', 'backups');

    private static ensureBackupDir(): void {
        if (!fs.existsSync(this.backupsDir)) {
            fs.mkdirSync(this.backupsDir, { recursive: true });
        }
    }

    public static getChannels(): ChannelItem[] {
        try {
            if (fs.existsSync(this.channelsPath)) {
                const raw = fs.readFileSync(this.channelsPath, 'utf8');
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                } catch (jsonErr: any) {
                    console.warn('[!] channels.json parse error, attempting auto-repair:', jsonErr.message);
                    // Attempt auto-repair on truncated or corrupted JSON array
                    const lastBrace = raw.lastIndexOf('}');
                    if (lastBrace !== -1) {
                        const candidate = raw.substring(0, lastBrace + 1) + '\n]';
                        try {
                            const recovered = JSON.parse(candidate);
                            if (Array.isArray(recovered) && recovered.length > 0) {
                                console.log(`[+] Auto-repaired channels.json: recovered ${recovered.length} channels.`);
                                this.saveChannels(recovered, false);
                                return recovered;
                            }
                        } catch (repairErr) {
                            console.error('[!] Auto-repair failed:', repairErr);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error('[!] Failed to read channels.json:', e.message);
        }
        return [];
    }

    public static getStreamUrl(channel: any): string {
        if (!channel) return '';
        return channel.stream_url || channel.channel_id || channel.url || channel.cmd || '';
    }

    public static sanitizeChannel(channel: any): ChannelItem {
        if (!channel || typeof channel !== 'object') {
            return {
                name: 'Unknown Channel',
                stream_url: '',
                channel_id: '',
                genre: 'Uncategorized',
                logo: '',
                source: 'custom'
            };
        }

        const sanitizeStr = (val: any, fallback: string = ''): string => {
            if (typeof val === 'string') {
                // Remove binary/control characters except newlines/spaces
                return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').trim();
            }
            return fallback;
        };

        const name = sanitizeStr(channel.name || channel.title, 'Channel');
        const streamUrl = sanitizeStr(channel.stream_url || channel.channel_id || channel.url || channel.cmd, '');
        const channelId = sanitizeStr(channel.channel_id || channel.id || streamUrl, streamUrl);
        const genre = sanitizeStr(channel.genre || channel.group || 'Live TV', 'Live TV');
        let logo = sanitizeStr(channel.logo || channel.tvg_logo, '');
        // Validate logo is a realistic URL or asset path
        if (logo && !logo.startsWith('http://') && !logo.startsWith('https://') && !logo.startsWith('/') && !logo.startsWith('data:image/')) {
            logo = '';
        }

        return {
            name,
            stream_url: streamUrl,
            channel_id: channelId,
            genre,
            logo,
            source: sanitizeStr(channel.source, 'm3u_storage')
        };
    }

    public static saveChannels(channels: ChannelItem[], createBackup: boolean = true): void {
        const sanitized = (Array.isArray(channels) ? channels : []).map(c => this.sanitizeChannel(c));

        if (createBackup && fs.existsSync(this.channelsPath)) {
            try {
                this.ensureBackupDir();
                const backupPath = path.join(this.backupsDir, `channels_backup_${Date.now()}.json`);
                fs.copyFileSync(this.channelsPath, backupPath);
            } catch (err: any) {
                console.warn('[!] Could not create channels backup:', err.message);
            }
        }

        // 1. Primary storage: assets/channels.json
        const jsonStr = JSON.stringify(sanitized, null, 4);
        fs.writeFileSync(this.channelsPath, jsonStr, 'utf8');

        // 2. Public copy: public/channels.json
        try {
            const publicPath = path.join(process.cwd(), 'public', 'channels.json');
            fs.writeFileSync(publicPath, jsonStr, 'utf8');
        } catch (e) {}

        // 3. Sync doctor_strange/genre.json
        try {
            const genreMap: { [key: string]: number } = {};
            channels.forEach(c => {
                const g = (c.genre || 'Uncategorized').trim();
                genreMap[g] = (genreMap[g] || 0) + 1;
            });
            const genreList = Object.keys(genreMap).map(title => ({
                id: title,
                title,
                count: genreMap[title]
            })).sort((a, b) => b.count - a.count);
            const genrePath = path.join(process.cwd(), 'doctor_strange', 'genre.json');
            fs.writeFileSync(genrePath, JSON.stringify(genreList, null, 2), 'utf8');
        } catch (e) {}

        // 4. Invalidate cache_stalker directory cache files
        try {
            const cacheDir = path.join(process.cwd(), 'cache_stalker');
            if (fs.existsSync(cacheDir)) {
                const files = fs.readdirSync(cacheDir);
                for (const f of files) {
                    if (f.endsWith('.json') || f.endsWith('.cache')) {
                        try { fs.unlinkSync(path.join(cacheDir, f)); } catch(e) {}
                    }
                }
            }
        } catch(e) {}

        // 5. Invalidate sports.m3u disk cache
        try {
            const sportsM3uPath = path.join(process.cwd(), 'assets', 'sports.m3u');
            if (fs.existsSync(sportsM3uPath)) {
                try { fs.unlinkSync(sportsM3uPath); } catch(e) {}
            }
        } catch(e) {}
    }

    public static getStats(): ChannelStats {
        const channels = this.getChannels();
        let fileSizeBytes = 0;
        let lastModified = 'N/A';

        try {
            if (fs.existsSync(this.channelsPath)) {
                const stat = fs.statSync(this.channelsPath);
                fileSizeBytes = stat.size;
                lastModified = stat.mtime.toISOString();
            }
        } catch (e) {}

        const genreCounts: { [key: string]: number } = {};
        const sourceCounts: { [key: string]: number } = {};

        channels.forEach(ch => {
            const g = (ch.genre || 'Uncategorized').trim();
            genreCounts[g] = (genreCounts[g] || 0) + 1;

            const s = (ch.source || 'default').trim();
            sourceCounts[s] = (sourceCounts[s] || 0) + 1;
        });

        const genres = Object.keys(genreCounts)
            .map(name => ({ name, count: genreCounts[name] }))
            .sort((a, b) => b.count - a.count);

        const sources = Object.keys(sourceCounts)
            .map(name => ({ name, count: sourceCounts[name] }))
            .sort((a, b) => b.count - a.count);

        const formatSize = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return {
            totalChannels: channels.length,
            totalGenres: genres.length,
            fileSizeBytes,
            fileSizeFormatted: formatSize(fileSizeBytes),
            lastModified,
            genres,
            sources
        };
    }

    public static parseM3uString(
        content: string,
        options?: { defaultGenre?: string; defaultSource?: string }
    ): ChannelItem[] {
        const cleanContent = content.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM
        const lines = cleanContent.split(/\r?\n/);
        const parsedChannels: ChannelItem[] = [];

        let currentChannel: Partial<ChannelItem> | null = null;
        const defaultGenre = options?.defaultGenre?.trim() || 'Custom M3U';
        const defaultSource = options?.defaultSource?.trim() || 'm3u_converter';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                // Parse attributes
                const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
                const tvgLogoMatch = line.match(/(?:tvg-logo|logo)="([^"]+)"/i);
                const groupMatch = line.match(/(?:group-title|group)="([^"]+)"/i);
                
                // Extract channel title after last comma if present
                const commaIdx = line.lastIndexOf(',');
                let channelTitle = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';
                if (!channelTitle && tvgNameMatch) {
                    channelTitle = tvgNameMatch[1].trim();
                }
                if (!channelTitle) {
                    channelTitle = 'Channel ' + (parsedChannels.length + 1);
                }

                currentChannel = {
                    name: channelTitle,
                    logo: tvgLogoMatch ? tvgLogoMatch[1].trim() : '',
                    genre: groupMatch ? groupMatch[1].trim() : defaultGenre,
                    source: defaultSource
                };
            } else if (!line.startsWith('#') && currentChannel) {
                // This line is the stream URL
                if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.startsWith('mms://') || line.includes('.m3u8')) {
                    currentChannel.channel_id = line;
                    parsedChannels.push(currentChannel as ChannelItem);
                }
                currentChannel = null;
            }
        }

        return parsedChannels;
    }

    public static async convertM3u(options: ConvertOptions): Promise<{
        totalParsed: number;
        newUniqueCount?: number;
        existingCount?: number;
        totalAfter?: number;
        genresFound: string[];
        sampleChannels: ChannelItem[];
        status: string;
        message: string;
    }> {
        let rawContent = options.content || '';

        if (!rawContent && options.m3uUrl) {
            try {
                const resp = await axios.get(options.m3uUrl, {
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    responseType: 'text'
                });
                rawContent = resp.data;
            } catch (err: any) {
                throw new Error(`Failed to fetch M3U from URL: ${err.message}`);
            }
        }

        if (!rawContent || typeof rawContent !== 'string') {
            throw new Error('No valid M3U playlist content provided.');
        }

        const parsed = this.parseM3uString(rawContent, {
            defaultGenre: options.defaultGenre,
            defaultSource: options.defaultSource
        });

        if (parsed.length === 0) {
            throw new Error('No channels could be parsed from the provided M3U. Check that it contains valid #EXTINF tags and stream URLs.');
        }

        const genresFound = Array.from(new Set(parsed.map(c => c.genre || 'Uncategorized')));
        const sampleChannels = parsed.slice(0, 20);

        const currentChannels = this.getChannels();
        const existingUrls = new Set(currentChannels.map(c => c.channel_id));

        const uniqueNewChannels = parsed.filter(c => !existingUrls.has(c.channel_id));

        if (options.mode === 'preview') {
            return {
                status: 'success',
                message: `Preview generated successfully. Found ${parsed.length} channels across ${genresFound.length} genres.`,
                totalParsed: parsed.length,
                newUniqueCount: uniqueNewChannels.length,
                existingCount: currentChannels.length,
                genresFound,
                sampleChannels
            };
        }

        if (options.mode === 'replace') {
            let finalChannels = parsed;
            if (options.deduplicate !== false) {
                const seen = new Set<string>();
                finalChannels = [];
                for (const ch of parsed) {
                    if (!seen.has(ch.channel_id)) {
                        seen.add(ch.channel_id);
                        finalChannels.push(ch);
                    }
                }
            }

            this.saveChannels(finalChannels, true);
            return {
                status: 'success',
                message: `Successfully replaced channels.json with ${finalChannels.length} new channels.`,
                totalParsed: parsed.length,
                totalAfter: finalChannels.length,
                genresFound,
                sampleChannels: finalChannels.slice(0, 20)
            };
        }

        // Mode is 'append'
        let toAdd = parsed;
        if (options.deduplicate !== false) {
            toAdd = uniqueNewChannels;
        }

        const combined = [...currentChannels, ...toAdd];
        this.saveChannels(combined, true);

        return {
            status: 'success',
            message: `Successfully merged ${toAdd.length} channels into channels.json (skipped ${parsed.length - toAdd.length} duplicates). Total catalog is now ${combined.length} channels.`,
            totalParsed: parsed.length,
            newUniqueCount: toAdd.length,
            existingCount: currentChannels.length,
            totalAfter: combined.length,
            genresFound,
            sampleChannels: toAdd.slice(0, 20)
        };
    }

    public static listChannels(params: {
        page?: number;
        limit?: number;
        search?: string;
        genre?: string;
        source?: string;
    url?: string;
    stream_url?: string;
    title?: string;
    group?: string;
    score?: number;
    streamUrl?: string;
    playUrl?: string;
    }): {
        channels: ChannelItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        genres: string[];
        sources: string[];
    } {
        const all = this.getChannels();
        const search = (params.search || '').toLowerCase().trim();
        const genre = (params.genre || '').trim();
        const source = (params.source || '').trim();
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(200, Math.max(1, params.limit || 50));

        const genresSet = new Set<string>();
        const sourcesSet = new Set<string>();

        all.forEach(c => {
            if (c.genre) genresSet.add(c.genre);
            if (c.source) sourcesSet.add(c.source);
        });

        let filtered = all.filter(c => {
            if (genre && genre !== 'ALL' && c.genre !== genre) return false;
            if (source && source !== 'ALL' && c.source !== source) return false;
            if (search) {
                const name = (c.name || '').toLowerCase();
                const chGenre = (c.genre || '').toLowerCase();
                const url = (c.channel_id || '').toLowerCase();
                return name.includes(search) || chGenre.includes(search) || url.includes(search);
            }
            return true;
        });

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const start = (page - 1) * limit;
        const paginatedChannels = filtered.slice(start, start + limit);

        return {
            channels: paginatedChannels,
            total,
            page,
            limit,
            totalPages,
            genres: Array.from(genresSet).sort(),
            sources: Array.from(sourcesSet).sort()
        };
    }

    public static addSingleChannel(channel: ChannelItem): ChannelItem {
        if (!channel.name || !channel.channel_id) {
            throw new Error('Channel name and stream URL (channel_id) are required.');
        }

        const channels = this.getChannels();
        const newChannel: ChannelItem = {
            channel_id: channel.channel_id.trim(),
            name: channel.name.trim(),
            genre: (channel.genre || 'Custom').trim(),
            logo: (channel.logo || '').trim(),
            source: (channel.source || 'admin_manual').trim()
        };

        // Insert at beginning
        channels.unshift(newChannel);
        this.saveChannels(channels, true);
        return newChannel;
    }

    public static updateSingleChannel(
        originalChannelId: string,
        updated: Partial<ChannelItem>
    ): ChannelItem {
        const channels = this.getChannels();
        const idx = channels.findIndex(c => c.channel_id === originalChannelId);
        if (idx === -1) {
            throw new Error('Channel not found in database.');
        }

        channels[idx] = {
            ...channels[idx],
            name: updated.name ? updated.name.trim() : channels[idx].name,
            genre: updated.genre ? updated.genre.trim() : channels[idx].genre,
            logo: updated.logo !== undefined ? updated.logo.trim() : channels[idx].logo,
            channel_id: updated.channel_id ? updated.channel_id.trim() : channels[idx].channel_id,
            source: updated.source ? updated.source.trim() : channels[idx].source
        };

        this.saveChannels(channels, true);
        return channels[idx];
    }

    public static deleteSingleChannel(channelId: string, channelName?: string): boolean {
        if (!channelId && !channelName) return false;
        const channels = this.getChannels();
        const initialLength = channels.length;
        
        const cleanId = channelId ? String(channelId).trim().toLowerCase() : '';
        const cleanName = channelName ? String(channelName).trim().toLowerCase() : '';
        
        const filtered = channels.filter(c => {
            const cId = c.channel_id ? String(c.channel_id).trim().toLowerCase() : '';
            const cStream = (c as any).stream_url ? String((c as any).stream_url).trim().toLowerCase() : '';
            const cUrl = (c as any).url ? String((c as any).url).trim().toLowerCase() : '';
            const cName = c.name ? String(c.name).trim().toLowerCase() : '';

            // Match by ID / Stream URL
            if (cleanId && (cId === cleanId || cStream === cleanId || cUrl === cleanId)) {
                return false;
            }
            // Match by Name if cleanName provided
            if (cleanName && cName && cName === cleanName) {
                return false;
            }
            return true;
        });

        // Also clean up from doctor_strange/admin_db.json if present
        try {
            const adminDbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
            if (fs.existsSync(adminDbPath)) {
                const db = JSON.parse(fs.readFileSync(adminDbPath, 'utf8'));
                let dbChanged = false;
                if (Array.isArray(db.sports)) {
                    const beforeLen = db.sports.length;
                    db.sports = db.sports.filter((s: any) => {
                        const sId = s.id ? String(s.id).trim().toLowerCase() : '';
                        const sUrl = s.url ? String(s.url).trim().toLowerCase() : '';
                        const sTitle = s.title ? String(s.title).trim().toLowerCase() : '';
                        if (cleanId && (sId === cleanId || sUrl === cleanId)) return false;
                        if (cleanName && sTitle && sTitle === cleanName) return false;
                        return true;
                    });
                    if (db.sports.length !== beforeLen) dbChanged = true;
                }
                if (Array.isArray(db.liveEvents)) {
                    const beforeLen = db.liveEvents.length;
                    db.liveEvents = db.liveEvents.filter((s: any) => {
                        const sId = s.id ? String(s.id).trim().toLowerCase() : '';
                        const sUrl = s.url ? String(s.url).trim().toLowerCase() : '';
                        const sTitle = s.title ? String(s.title).trim().toLowerCase() : '';
                        if (cleanId && (sId === cleanId || sUrl === cleanId)) return false;
                        if (cleanName && sTitle && sTitle === cleanName) return false;
                        return true;
                    });
                    if (db.liveEvents.length !== beforeLen) dbChanged = true;
                }
                if (dbChanged) {
                    fs.writeFileSync(adminDbPath + '.tmp', JSON.stringify(db, null, 2), 'utf8'); fs.renameSync(adminDbPath + '.tmp', adminDbPath); syncToFirestore(db).catch((e: any) => console.error("Firestore sync error from channelJsonService:", e));
                }
            }
        } catch (e) {}

        if (filtered.length === initialLength) {
            return false;
        }

        this.saveChannels(filtered, true);
        return true;
    }

    public static clearAllChannels(): { clearedCount: number } {
        const channels = this.getChannels();
        const clearedCount = channels.length;
        this.saveChannels([], true);

        // Also clean up sports / liveEvents in admin_db.json
        try {
            const adminDbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
            if (fs.existsSync(adminDbPath)) {
                const db = JSON.parse(fs.readFileSync(adminDbPath, 'utf8'));
                db.sports = [];
                db.liveEvents = [];
                fs.writeFileSync(adminDbPath + '.tmp', JSON.stringify(db, null, 2), 'utf8'); fs.renameSync(adminDbPath + '.tmp', adminDbPath);
            }
        } catch (e) {}

        return { clearedCount };
    }

    public static async fixAllLogos(options?: {
        forceRescrape?: boolean;
        batchSize?: number;
        onProgress?: (info: { current: number; total: number; percent: number; channelName: string; status: 'fixed' | 'valid' | 'fallback'; logo?: string; engine?: string }) => void;
    }): Promise<{ totalChannels: number; fixedCount: number; alreadyValidCount: number; details: any[] }> {
        return LogoService.fixAllChannelsJsonLogosWithWebSearch(options);
    }

    public static deduplicateChannels(): { totalBefore: number, totalAfter: number, removedCount: number } {
        const channels = this.getChannels();
        const initialLength = channels.length;
        
        const seenUrls = new Set<string>();
        const deduplicated = channels.filter(c => {
            const id = c.channel_id || c.stream_url;
            if (!id) return false; // filter out completely invalid ones
            if (seenUrls.has(id)) return false;
            seenUrls.add(id);
            return true;
        });

        if (deduplicated.length < initialLength) {
            this.saveChannels(deduplicated, true);
        }

        return {
            totalBefore: initialLength,
            totalAfter: deduplicated.length,
            removedCount: initialLength - deduplicated.length
        };
    }

    public static batchDelete(channelIds: string[]): number {
        if (!Array.isArray(channelIds) || channelIds.length === 0) return 0;
        const set = new Set(channelIds);
        const channels = this.getChannels();
        const initialLength = channels.length;
        const filtered = channels.filter(c => !set.has(c.channel_id) && !(c.stream_url && set.has(c.stream_url)));
        const deletedCount = initialLength - filtered.length;

        // Also clean up from doctor_strange/admin_db.json
        try {
            const adminDbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
            if (fs.existsSync(adminDbPath)) {
                const db = JSON.parse(fs.readFileSync(adminDbPath, 'utf8'));
                let dbChanged = false;
                if (Array.isArray(db.sports)) {
                    const beforeLen = db.sports.length;
                    db.sports = db.sports.filter((s: any) => !set.has(s.id) && !set.has(s.url));
                    if (db.sports.length !== beforeLen) dbChanged = true;
                }
                if (Array.isArray(db.liveEvents)) {
                    const beforeLen = db.liveEvents.length;
                    db.liveEvents = db.liveEvents.filter((s: any) => !set.has(s.id) && !set.has(s.url));
                    if (db.liveEvents.length !== beforeLen) dbChanged = true;
                }
                if (dbChanged) {
                    fs.writeFileSync(adminDbPath + '.tmp', JSON.stringify(db, null, 2), 'utf8'); fs.renameSync(adminDbPath + '.tmp', adminDbPath);
                }
            }
        } catch (e) {}

        if (deletedCount > 0) {
            this.saveChannels(filtered, true);
        }
        return deletedCount;
    }

    public static deleteByGenre(genre: string): number {
        if (!genre) return 0;
        const channels = this.getChannels();
        const initialLength = channels.length;
        const filtered = channels.filter(c => c.genre !== genre);
        const deletedCount = initialLength - filtered.length;

        if (deletedCount > 0) {
            this.saveChannels(filtered, true);
        }
        return deletedCount;
    }

    public static deduplicateAll(): { before: number; after: number; removed: number } {
        const channels = this.getChannels();
        const before = channels.length;
        const seen = new Set<string>();
        const unique: ChannelItem[] = [];

        for (const ch of channels) {
            if (!seen.has(ch.channel_id)) {
                seen.add(ch.channel_id);
                unique.push(ch);
            }
        }

        const after = unique.length;
        const removed = before - after;

        if (removed > 0) {
            this.saveChannels(unique, true);
        }

        return { before, after, removed };
    }

        public static async importAllM3uStorage(options?: { mode?: 'append' | 'replace'; deduplicate?: boolean }): Promise<{
        totalImported: number;
        sourcesScanned: number;
        totalAfter: number;
        sourcesList: string[];
    }> {
        const mode = options?.mode || 'append';
        const deduplicate = options?.deduplicate !== false;
        const currentChannels = this.getChannels();
        const collectedChannels: ChannelItem[] = [];
        const sourcesList: string[] = [];

        // 1. Scan doctor_strange/m3u_playlists/*.m3u
        const m3uVaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(m3uVaultDir)) {
            try {
                const files = fs.readdirSync(m3uVaultDir);
                for (const file of files) {
                    if (file.endsWith('.m3u') || file.endsWith('.m3u8')) {
                        const filePath = path.join(m3uVaultDir, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        const parsed = this.parseM3uString(content, {
                            defaultGenre: 'M3U Vault',
                            defaultSource: file.replace(/\.m3u8?$/i, '')
                        });
                        collectedChannels.push(...parsed);
                        sourcesList.push(`Vault: ${file} (${parsed.length} channels)`);
                    }
                }
            } catch (err: any) {
                console.warn('[!] Failed reading m3u_playlists vault:', err.message);
            }
        }

        // 2. Scan admin_db.json (sportsM3uFiles & sports)
        const adminDbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
        if (fs.existsSync(adminDbPath)) {
            try {
                const adminDb = JSON.parse(fs.readFileSync(adminDbPath, 'utf8'));
                if (adminDb.sportsM3uFiles && Array.isArray(adminDb.sportsM3uFiles)) {
                    for (const m3u of adminDb.sportsM3uFiles) {
                        if (!m3u.url) continue;
                        let content = '';
                        if (m3u.url.startsWith('/doctor_strange/')) {
                            const localPath = path.join(process.cwd(), m3u.url);
                            if (fs.existsSync(localPath)) content = fs.readFileSync(localPath, 'utf8');
                        } else if (m3u.url.startsWith('http://') || m3u.url.startsWith('https://')) {
                            try {
                                const resp = await axios.get(m3u.url, { timeout: 8000 });
                                content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
                            } catch(e) {}
                        }
                        if (content) {
                            const parsed = this.parseM3uString(content, {
                                defaultGenre: m3u.name || 'Admin Sports M3U',
                                defaultSource: 'admin_m3u_' + (m3u.name || 'custom')
                            });
                            collectedChannels.push(...parsed);
                            sourcesList.push(`Admin M3U: ${m3u.name || m3u.url} (${parsed.length} channels)`);
                        }
                    }
                }
                if (adminDb.sports && Array.isArray(adminDb.sports)) {
                    for (const s of adminDb.sports) {
                        if (s.url) {
                            collectedChannels.push({
                                channel_id: s.url,
                                name: s.title || 'Custom Sport',
                                genre: 'Admin Sports',
                                logo: s.icon && s.icon.startsWith('http') ? s.icon : '',
                                source: 'admin_sports_db'
                            });
                        }
                    }
                    if (adminDb.sports.length > 0) {
                        sourcesList.push(`Admin Single Sports: ${adminDb.sports.length} items`);
                    }
                }
            } catch (err: any) {
                console.warn('[!] Failed reading admin_db.json in importAllM3uStorage:', err.message);
            }
        }

        // 3. Scan assets/sports.m3u if exists on disk
        const sportsM3uPath = path.join(process.cwd(), 'assets', 'sports.m3u');
        if (fs.existsSync(sportsM3uPath)) {
            try {
                const content = fs.readFileSync(sportsM3uPath, 'utf8');
                if (content.length > 20) {
                    const parsed = this.parseM3uString(content, {
                        defaultGenre: 'Sports',
                        defaultSource: 'assets_sports_m3u'
                    });
                    collectedChannels.push(...parsed);
                    sourcesList.push(`assets/sports.m3u (${parsed.length} channels)`);
                }
            } catch(e) {}
        }

        // Merge logic
        let baseList = mode === 'replace' ? [] : [...currentChannels];
        let toMerge = collectedChannels;

        if (deduplicate) {
            const seen = new Set<string>();
            baseList.forEach(c => seen.add(c.channel_id));
            const uniqueToMerge: ChannelItem[] = [];
            for (const ch of toMerge) {
                if (!seen.has(ch.channel_id)) {
                    seen.add(ch.channel_id);
                    uniqueToMerge.push(ch);
                }
            }
            toMerge = uniqueToMerge;
        }

        const finalChannels = [...baseList, ...toMerge];
        this.saveChannels(finalChannels, true);

        return {
            totalImported: toMerge.length,
            sourcesScanned: sourcesList.length,
            totalAfter: finalChannels.length,
            sourcesList
        };
    }

    public static generateM3u(): string {
        const channels = this.getChannels();
        const lines = ['#EXTM3U\n'];

        for (const ch of channels) {
            const name = ch.name || 'Unknown Channel';
            const logo = ch.logo || '';
            const genre = ch.genre || 'General';
            const url = ch.channel_id || '';

            if (!url) continue;

            lines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genre}",${name}\n`);
            lines.push(`${url}\n`);
        }

        return lines.join('');
    }
}

export function getChannelsList(): ChannelItem[] {
    return ChannelJsonService.getChannels();
}

export function getChannelStreamUrl(channel: any): string {
    return ChannelJsonService.getStreamUrl(channel);
}
