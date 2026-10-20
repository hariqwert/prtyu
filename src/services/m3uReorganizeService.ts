import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LogoService } from './logoService';
import { syncM3uToFirestore } from './firestoreSyncService';

export interface M3uChannelItem {
    id: string;
    name: string;
    logo: string;
    group: string;
    stream_url: string;
    xmltv_id?: string;
    user_agent?: string;
    order: number;
}

export interface PlaylistInfo {
    id: string;
    name: string;
    filePath: string;
    channelCount: number;
    subsections: string[];
}

export class M3uReorganizeService {
    public static listAvailablePlaylists(): PlaylistInfo[] {
        const list: PlaylistInfo[] = [];

        const register = (id: string, name: string, filePath: string) => {
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split(/\r?\n/);
                    let count = 0;
                    const subSet = new Set<string>();
                    for (const l of lines) {
                        if (l.startsWith('#EXTINF:')) {
                            count++;
                            const gMatch = l.match(/group-title="([^"]+)"/i) || l.match(/group-title=([^ ]+)/i);
                            if (gMatch) subSet.add(gMatch[1].trim());
                            else subSet.add('General');
                        }
                    }
                    list.push({
                        id,
                        name,
                        filePath,
                        channelCount: count,
                        subsections: Array.from(subSet).sort()
                    });
                } catch (e) {}
            }
        };

        register('kliv_zob', 'KLIV Master Zob Playlist (Default)', path.join(process.cwd(), 'public', 'kliv_zob.m3u'));
        register('kliv_jozo', 'KLIV Jozo Entertainment', path.join(process.cwd(), 'public', 'kliv_jozo.m3u'));

        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(vaultDir)) {
            const files = fs.readdirSync(vaultDir);
            for (const f of files) {
                if (f.endsWith('.m3u') || f.endsWith('.m3u8')) {
                    register(
                        f.replace(/\.(m3u|m3u8)$/i, ''),
                        `Vault: ${f}`,
                        path.join(vaultDir, f)
                    );
                }
            }
        }

        return list;
    }

    public static getPlaylistFilePath(playlistId: string): string | null {
        if (playlistId === 'kliv_zob') return path.join(process.cwd(), 'public', 'kliv_zob.m3u');
        if (playlistId === 'kliv_jozo') return path.join(process.cwd(), 'public', 'kliv_jozo.m3u');

        const vaultPath = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists', `${playlistId}.m3u`);
        if (fs.existsSync(vaultPath)) return vaultPath;

        const vaultPath2 = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists', playlistId);
        if (fs.existsSync(vaultPath2)) return vaultPath2;

        return null;
    }

    public static getChannels(playlistId: string): { channels: M3uChannelItem[]; subsections: string[] } {
        const filePath = this.getPlaylistFilePath(playlistId);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`Playlist not found: ${playlistId}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const channels: M3uChannelItem[] = [];
        const subsectionSet = new Set<string>();

        let currentInf: string | null = null;
        let currentVlcOptUA = '';
        let order = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                currentInf = line;
                currentVlcOptUA = '';
                continue;
            }

            if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
                currentVlcOptUA = line.substring('#EXTVLCOPT:http-user-agent='.length).trim();
                continue;
            }

            if (line.startsWith('#')) continue;

            if (currentInf && line.startsWith('http')) {
                order++;
                const commaPos = currentInf.lastIndexOf(',');
                const name = commaPos !== -1 ? currentInf.substring(commaPos + 1).trim() : `Channel ${order}`;

                const groupMatch = currentInf.match(/group-title="([^"]+)"/i) || currentInf.match(/group-title=([^ ]+)/i);
                let group = groupMatch ? groupMatch[1].trim() : 'General';

                // Strip ugly spam prefix if present
                if (group.includes('𝐏𝐥𝐚𝐲𝐥𝐢𝐯𝐭𝐯') || group.includes('Join Now')) {
                    group = 'General';
                }

                subsectionSet.add(group);

                const logoMatch = currentInf.match(/tvg-logo="([^"]+)"/i) || currentInf.match(/tvg-logo=([^ ]+)/i);
                const currentLogo = logoMatch ? logoMatch[1].trim() : '';

                const idMatch = currentInf.match(/tvg-id="([^"]+)"/i) || currentInf.match(/tvg-id=([^ ]+)/i);
                const xmltvId = idMatch ? idMatch[1].trim() : '';

                const resolvedLogo = LogoService.getLogoForChannel(name, xmltvId, currentLogo);

                channels.push({
                    id: 'ch_' + crypto.createHash('md5').update(line + '_' + order).digest('hex').substring(0, 10),
                    name,
                    logo: resolvedLogo,
                    group,
                    stream_url: line,
                    xmltv_id: xmltvId,
                    user_agent: currentVlcOptUA || undefined,
                    order
                });

                currentInf = null;
            }
        }

        return {
            channels,
            subsections: Array.from(subsectionSet).sort()
        };
    }

    public static saveChannels(playlistId: string, channels: M3uChannelItem[]): { success: boolean; message: string; channelCount: number } {
        const filePath = this.getPlaylistFilePath(playlistId);
        if (!filePath) {
            throw new Error(`Playlist not found: ${playlistId}`);
        }

        // Backup existing file first
        const backupPath = `${filePath}.bak`;
        try {
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, backupPath);
            }
        } catch (e) {}

        const outLines: string[] = [
            '#EXTM3U x-tvg-url="https://raw.githubusercontent.com/StrangeDrVN/epg/public/guide.xml.gz"'
        ];

        for (const ch of channels) {
            const xmltvPart = ch.xmltv_id ? ` tvg-id="${ch.xmltv_id}"` : '';
            const logo = LogoService.getLogoForChannel(ch.name, ch.xmltv_id, ch.logo);
            const logoPart = ` tvg-logo="${logo}"`;
            const groupPart = ` group-title="${ch.group || 'General'}"`;

            outLines.push(`#EXTINF:-1${xmltvPart}${logoPart}${groupPart},${ch.name}`);
            if (ch.user_agent) {
                outLines.push(`#EXTVLCOPT:http-user-agent=${ch.user_agent}`);
            }
            outLines.push(ch.stream_url);
        }

        const content = outLines.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        
        syncM3uToFirestore(path.basename(filePath), content);

        return {
            success: true,
            message: `Successfully saved ${channels.length} channels with updated sub-sections!`,
            channelCount: channels.length
        };
    }

    public static batchMoveToSubsection(playlistId: string, channelIds: string[], targetSubsection: string): { success: boolean; updatedCount: number } {
        const { channels } = this.getChannels(playlistId);
        const idSet = new Set(channelIds);
        let updatedCount = 0;

        for (const ch of channels) {
            if (idSet.has(ch.id)) {
                ch.group = targetSubsection.trim();
                updatedCount++;
            }
        }

        this.saveChannels(playlistId, channels);
        return { success: true, updatedCount };
    }

    public static renameSubsection(playlistId: string, oldName: string, newName: string): { success: boolean; updatedCount: number } {
        const { channels } = this.getChannels(playlistId);
        let updatedCount = 0;

        for (const ch of channels) {
            if (ch.group.trim().toLowerCase() === oldName.trim().toLowerCase()) {
                ch.group = newName.trim();
                updatedCount++;
            }
        }

        this.saveChannels(playlistId, channels);
        return { success: true, updatedCount };
    }

    public static addChannel(playlistId: string, channelData: Partial<M3uChannelItem>): { success: boolean; channel: M3uChannelItem; message: string } {
        const { channels } = this.getChannels(playlistId);
        const name = (channelData.name || 'New Channel').trim();
        const stream_url = (channelData.stream_url || '').trim();
        if (!stream_url) {
            throw new Error('Stream URL is required');
        }

        const group = (channelData.group || 'General').trim();
        const xmltv_id = (channelData.xmltv_id || '').trim();
        const user_agent = (channelData.user_agent || '').trim();
        const customLogo = (channelData.logo || '').trim();
        const logo = customLogo || LogoService.getLogoForChannel(name, xmltv_id, '');

        const newChannel: M3uChannelItem = {
            id: 'ch_' + crypto.createHash('md5').update(stream_url + '_' + Date.now()).digest('hex').substring(0, 10),
            name,
            logo,
            group,
            stream_url,
            xmltv_id: xmltv_id || undefined,
            user_agent: user_agent || undefined,
            order: channels.length + 1
        };

        channels.push(newChannel);
        this.saveChannels(playlistId, channels);

        return {
            success: true,
            channel: newChannel,
            message: `Channel '${name}' added to sub-section '${group}'!`
        };
    }

    public static updateChannel(playlistId: string, channelId: string, updatedData: Partial<M3uChannelItem>): { success: boolean; channel: M3uChannelItem; message: string } {
        const { channels } = this.getChannels(playlistId);
        const ch = channels.find(c => c.id === channelId);
        if (!ch) {
            throw new Error(`Channel not found with ID: ${channelId}`);
        }

        if (updatedData.name !== undefined) ch.name = updatedData.name.trim();
        if (updatedData.stream_url !== undefined) ch.stream_url = updatedData.stream_url.trim();
        if (updatedData.group !== undefined) ch.group = updatedData.group.trim();
        if (updatedData.logo !== undefined) ch.logo = updatedData.logo.trim();
        if (updatedData.xmltv_id !== undefined) ch.xmltv_id = updatedData.xmltv_id.trim();
        if (updatedData.user_agent !== undefined) ch.user_agent = updatedData.user_agent.trim();

        this.saveChannels(playlistId, channels);

        return {
            success: true,
            channel: ch,
            message: `Channel '${ch.name}' updated successfully!`
        };
    }

    public static deleteChannel(playlistId: string, channelId: string): { success: boolean; message: string } {
        const { channels } = this.getChannels(playlistId);
        const filtered = channels.filter(c => c.id !== channelId);
        if (filtered.length === channels.length) {
            throw new Error(`Channel not found with ID: ${channelId}`);
        }

        this.saveChannels(playlistId, filtered);
        return {
            success: true,
            message: 'Channel deleted successfully!'
        };
    }

    public static deleteSubsection(playlistId: string, subsectionName: string, fallbackGroup: string = 'General'): { success: boolean; updatedCount: number } {
        const { channels } = this.getChannels(playlistId);
        let updatedCount = 0;

        for (const ch of channels) {
            if (ch.group.trim().toLowerCase() === subsectionName.trim().toLowerCase()) {
                ch.group = fallbackGroup;
                updatedCount++;
            }
        }

        this.saveChannels(playlistId, channels);
        return { success: true, updatedCount };
    }

    public static getAllLibraryChannels(options?: { query?: string; playlistId?: string; group?: string; limit?: number }): {
        channels: Array<M3uChannelItem & { playlist_id: string; playlist_name: string; source_type: 'm3u' | 'portal' }>;
        total: number;
        playlists: Array<{ id: string; name: string; count: number }>;
        groups: string[];
    } {
        const allItems: Array<M3uChannelItem & { playlist_id: string; playlist_name: string; source_type: 'm3u' | 'portal' }> = [];
        const playlistSummary: Array<{ id: string; name: string; count: number }> = [];
        const allGroups = new Set<string>();

        // 1. Scan all M3U playlists
        const playlists = this.listAvailablePlaylists();
        for (const p of playlists) {
            try {
                const { channels } = this.getChannels(p.id);
                playlistSummary.push({ id: p.id, name: p.name, count: channels.length });
                for (const ch of channels) {
                    const grp = ch.group || 'General';
                    allGroups.add(grp);
                    allItems.push({
                        ...ch,
                        playlist_id: p.id,
                        playlist_name: p.name,
                        source_type: 'm3u'
                    });
                }
            } catch (e) {}
        }

        // 2. Scan any Portal Cached Channels (.stalker files)
        const darkSide = path.join(process.cwd(), 'doctor_strange');
        if (fs.existsSync(darkSide)) {
            const files = fs.readdirSync(darkSide);
            for (const f of files) {
                if (f.startsWith('live_') && f.endsWith('.stalker')) {
                    try {
                        const raw = fs.readFileSync(path.join(darkSide, f), 'utf8');
                        const portalChannels = JSON.parse(raw);
                        if (Array.isArray(portalChannels) && portalChannels.length > 0) {
                            const portalName = f.replace(/^live_/, '').replace(/\.stalker$/, '');
                            let pCount = 0;
                            for (const pc of portalChannels) {
                                const chName = pc.name || pc.Name || pc.title || `Channel ${pc.id || ''}`;
                                const chLogo = pc.logo || pc.logo_url || LogoService.getLogoForChannel(chName, '', '');
                                const chGroup = pc.genre || pc.group || pc.category_name || 'Portal Live';
                                const streamUrl = pc.cmd || pc.playback_url || (pc.id ? `/live.php?ch=${pc.id}` : '');
                                if (streamUrl) {
                                    pCount++;
                                    allGroups.add(chGroup);
                                    allItems.push({
                                        id: 'portal_' + (pc.id || crypto.createHash('md5').update(chName + streamUrl).digest('hex').substring(0, 8)),
                                        name: chName,
                                        logo: chLogo,
                                        group: chGroup,
                                        stream_url: streamUrl,
                                        order: allItems.length + 1,
                                        playlist_id: 'portal_' + portalName,
                                        playlist_name: `Portal (${portalName})`,
                                        source_type: 'portal'
                                    });
                                }
                            }
                            if (pCount > 0) {
                                playlistSummary.push({ id: 'portal_' + portalName, name: `Portal (${portalName})`, count: pCount });
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // Filter by options
        let filtered = allItems;
        if (options?.playlistId && options.playlistId !== 'ALL') {
            filtered = filtered.filter(c => c.playlist_id === options.playlistId);
        }
        if (options?.group && options.group !== 'ALL') {
            filtered = filtered.filter(c => c.group.toLowerCase() === options.group!.toLowerCase());
        }
        if (options?.query && options.query.trim()) {
            const q = options.query.toLowerCase().trim();
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(q) || 
                c.stream_url.toLowerCase().includes(q) || 
                (c.group && c.group.toLowerCase().includes(q))
            );
        }

        const total = filtered.length;
        const limit = options?.limit && options.limit > 0 ? options.limit : 500;
        const sliced = filtered.slice(0, limit);

        return {
            channels: sliced,
            total,
            playlists: playlistSummary,
            groups: Array.from(allGroups).sort()
        };
    }

    public static batchAddChannels(
        playlistId: string,
        targetGroup: string,
        channelsToAdd: Array<{ name: string; stream_url: string; logo?: string; group?: string; xmltv_id?: string; user_agent?: string }>
    ): { success: boolean; addedCount: number; message: string } {
        const { channels } = this.getChannels(playlistId);
        let addedCount = 0;

        for (const item of channelsToAdd) {
            const name = (item.name || 'Channel').trim();
            const stream_url = (item.stream_url || '').trim();
            if (!stream_url) continue;

            const group = (targetGroup || item.group || 'General').trim();
            const customLogo = (item.logo || '').trim();
            const xmltv_id = (item.xmltv_id || '').trim();
            const user_agent = (item.user_agent || '').trim();
            const logo = customLogo || LogoService.getLogoForChannel(name, xmltv_id, '');

            const newChannel: M3uChannelItem = {
                id: 'ch_' + crypto.createHash('md5').update(stream_url + '_' + Date.now() + '_' + Math.random()).digest('hex').substring(0, 10),
                name,
                logo,
                group,
                stream_url,
                xmltv_id: xmltv_id || undefined,
                user_agent: user_agent || undefined,
                order: channels.length + 1
            };

            channels.push(newChannel);
            addedCount++;
        }

        this.saveChannels(playlistId, channels);
        return {
            success: true,
            addedCount,
            message: `Successfully imported ${addedCount} channel(s) into sub-section '${targetGroup}'!`
        };
    }
}
