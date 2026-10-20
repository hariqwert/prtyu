import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { StalkerAPI } from '../stalkerAPI';
import { ChannelJsonService } from '../services/channelJsonService';
import { getTimChannels, getTimLiveEvents, getAllTimStreams, resolveTimChannel, getSportCategoryName } from '../services/timstreamsService';
import { JtvService } from '../services/jtvService';
import { fetchFanCodeEvents, getFanCodeM3u, wrapFanCodeProxyUrl } from '../services/fancodeService';
import { getAllSportsHighlights, searchHighlights } from '../services/sportsHighlightsService';
import { syncZeeChannels, getZeePlaylistM3u } from '../services/zeeChannelsService';
import { getBiggBossSeasons, getBiggBossEpisodes, resolveBiggBossStream } from '../services/biggBossService';
import { fetchSonyLivEvents } from '../services/sonylivService';
import { getMix1TvChannels } from '../services/mix1tvService';
import { fetchWillowEvents } from '../services/willowService';
import { fetchPrimeEvents } from '../services/primeService';

const router = Router();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours for the channel list itself
let cachedPlaylist: string | null = null;
let lastFetchTime = 0;

function fetchUrl(url: string, referer: string = 'https://epiembeds.online/', timeoutMs: number = 8000): Promise<string> {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const isHttps = u.protocol === 'https:';
            const client = isHttps ? https : http;
            const options: any = {
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + u.search,
                timeout: timeoutMs,
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': referer
                }
            };
            const req = client.get(options, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
            
            req.on('timeout', () => {
                req.destroy();
                resolve('');
            });
        } catch(e) {
            resolve('');
        }
    });
}

function decodeStreamUrl(html: string): string | null {
    if (!html) return null;
    const atobMatch = html.match(/atob\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (atobMatch) {
        try {
            const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
            if (decoded.includes('.m3u8')) return decoded;
        } catch(e) {}
    }
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (!match) {
        match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    }
    if (match) {
        const arr = match[2].split(',').map(Number);
        const arg1 = parseInt(match[4]);
        const arg2 = parseInt(match[6]);
        let decoded = "";
        for (let i = 0; i < arr.length; i++) {
            decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
        }
        const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
        if (m3u8Match) return m3u8Match[0];
    }
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

const DLHD_TO_TIM: Record<string, string> = {
    'sky-sports-main-event': 'skysportsmainevent-uk',
    'sky-sports-premier-league': 'skysportspremierleague-uk',
    'sky-sports-football': 'skysportsfootball-uk',
    'sky-sports-f1': 'skysportsf1-uk',
    'sky-sports-cricket': 'skysportscricket-uk',
    'sky-sports-action': 'skysportsaction-uk',
    'sky-sports-arena': 'skysportsarena-uk',
    'sky-sports-golf': 'skysportsgolf-uk',
    'sky-sports-news': 'skysportsnews-uk',
    'tnt-sports-1': 'tntsports1-uk',
    'tnt-sports-2': 'tntsports2-uk',
    'tnt-sports-3': 'tntsports3-uk',
    'tnt-sports-4': 'tntsports4-uk',
    'bein-sports-1': 'beinsports-usa',
    'bein-sports-2': 'beinsports2-fr',
    'bein-sports-3': 'beinsports3-fr',
    'espn': 'espn-usa',
    'espn2': 'espn2-usa',
    'fox-sports-1': 'fs1-usa',
    'fox-sports-2': 'fs2-usa',
    'dazn-1': 'dazn1-uk',
    'willow-hd': 'willowcricket-usa',
    'willow': 'willowcricket-usa',
    'willow-2': '247-willow-2',
    'willow2': '247-willow-2',
    '247-willow-2': '247-willow-2',
    'embed-247-willow-2': '247-willow-2',
    'embed_247-willow-2': '247-willow-2',
    'sony-ten-1': 'sonyten1-in',
    'sony-ten-2': 'sonyten2-in',
    'sony-six': 'sonysix-in',
    'star-sports-1': 'starsports1-in',
    'eurosport-1': 'eurosport1-uk',
    'eurosport-2': 'eurosport2-uk',
    'wwe-network': 'wwenetwork-usa',
    'abc': 'abc-usa',
    'cbs': 'cbs-usa',
    'nbc': 'nbc-usa',
    'fox': 'fox-usa'
};

async function resolveChannelStream(rawId: string): Promise<string | null> {
    if (!rawId) return null;

    let targetUrl = rawId;
    let decoded = rawId;
    try {
        decoded = decodeURIComponent(rawId);
    } catch (_) {}

    if (rawId.includes('url=')) {
        try {
            const rawPart = rawId.substring(rawId.indexOf('url=') + 4);
            const dec = decodeURIComponent(rawPart.includes('&') ? rawPart.substring(0, rawPart.indexOf('&')) : rawPart);
            if (dec.startsWith('http://') || dec.startsWith('https://')) {
                targetUrl = dec;
            }
        } catch (_) {}
    }

    // Check FanCode channel prefix or embedded FanCode stream / match ID
    const isFancode = rawId.startsWith('fancode-') || 
                      rawId.startsWith('fancode_') || 
                      rawId.toLowerCase().includes('fancode') || 
                      targetUrl.includes('fancode') || 
                      targetUrl.includes('flive');

    if (isFancode) {
        const matchMatch = decoded.match(/fancode[-_]?([0-9]{5,10})/i) || 
                           decoded.match(/(?:mumbai\/|\/)([0-9]{5,10})_/i) ||
                           decoded.match(/(\d{6,8})/);
        const cleanId = matchMatch ? matchMatch[1] : rawId.replace(/^fancode[_-]?/i, '').trim();
        const { live, all } = await fetchFanCodeEvents();
        const found = live.find(e => String(e.matchId) === cleanId || e.id === cleanId || e.id === `fancode-${cleanId}` || e.id === rawId) || 
                      all.find(e => String(e.matchId) === cleanId || e.id === cleanId || e.id === `fancode-${cleanId}` || e.id === rawId);
        if (found && found.streamUrl) {
            return wrapFanCodeProxyUrl(found.streamUrl);
        }
        if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            return wrapFanCodeProxyUrl(targetUrl);
        }
    }

    if (targetUrl.includes('m4uplay')) {
        const fileId = targetUrl.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '';
        if (fileId) {
            return `https://m4uplay.quest/file/${fileId}`;
        }
    }

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        return targetUrl;
    }

    if (rawId.startsWith('/api/proxy/') || rawId.startsWith('/live.php')) {
        return rawId;
    }

    const isDlhd = rawId.startsWith('dlhd-') || rawId.startsWith('dlhd_') || rawId.toLowerCase().startsWith('dlhd');
    const isTim = rawId.startsWith('tim_') || rawId.startsWith('tim-') || rawId.toLowerCase().startsWith('tim');
    const isEmbed = rawId.startsWith('embed-') || rawId.startsWith('embed_') || rawId.startsWith('embedindia-') || rawId.startsWith('247-');
    const isJtv = rawId.startsWith('jtv-') || rawId.startsWith('mdtv-') || rawId.startsWith('jtv_') || rawId.startsWith('mdtv_');
    let channelId = rawId;
    if (isDlhd) {
        channelId = channelId.replace(/^dlhd[_-]?/i, '');
    } else if (isTim) {
        channelId = channelId.replace(/^tim[_-]?/i, '');
    } else if (isEmbed) {
        channelId = channelId.replace(/^(embed|embedindia)[_-]?/i, '');
    } else if (isJtv) {
        channelId = channelId.replace(/^(jtv|mdtv)[_-]?/i, '');
    }

    if (channelId.startsWith('http://') || channelId.startsWith('https://')) {
        return channelId;
    }

    // High priority: Check SonyLIV live sports events
    const isSonyLiv = rawId.startsWith('sonyliv') || rawId.startsWith('sliv');
    if (isSonyLiv) {
        try {
            const sonylivRes = await fetchSonyLivEvents();
            const cleanId = rawId.toLowerCase().trim();
            const matched = sonylivRes.all.find(e => 
                e.id.toLowerCase() === cleanId || 
                e.id.toLowerCase() === cleanId.replace('_', '-') ||
                e.contentId.toString() === cleanId.replace(/^(sonyliv|sliv)[_-]?/i, '')
            );
            if (matched && matched.streamUrl) {
                return matched.streamUrl;
            }
        } catch(e) {}
    }

    // High priority: Check JtvService live sports events (e.g. sonyliv-, fancode-, willow-, etc.)
    const liveEvents = await JtvService.fetchLiveEvents();
    const cleanLookupKey = rawId.toLowerCase().trim();
    const eventMatch = liveEvents.find((e: any) => 
        e.id.toLowerCase() === cleanLookupKey || 
        e.id.toLowerCase() === `sonyliv-${cleanLookupKey}` ||
        cleanLookupKey === e.id.toLowerCase().replace(/^(sonyliv|fancode|willow|cric)[-_]?/i, '') ||
        (e.name && e.name.toLowerCase() === cleanLookupKey)
    );
    if (eventMatch && eventMatch.stream_url) {
        return eventMatch.stream_url;
    }

    try {
        const wEvents = await fetchWillowEvents();
        const wMatch = wEvents.find((w: any) => w.id.toLowerCase() === cleanLookupKey || cleanLookupKey === w.id.toLowerCase().replace(/^willow[-_]?/i, ''));
        if (wMatch && (wMatch.streamUrl || wMatch.stream_url)) {
            return (wMatch.streamUrl || wMatch.stream_url) as string;
        }
        const pEvents = await fetchPrimeEvents();
        const pMatch = pEvents.find((p: any) => p.id.toLowerCase() === cleanLookupKey || cleanLookupKey === p.id.toLowerCase().replace(/^prime[-_]?/i, ''));
        if (pMatch && (pMatch.streamUrl || pMatch.stream_url)) {
            return (pMatch.streamUrl || pMatch.stream_url) as string;
        }
    } catch (_) {}

    // 1. High priority: Resolve via TimStreams online engine for tim_/dlhd/embed channels
    if (isTim || isDlhd || isEmbed || rawId.includes('sony-sports') || rawId.includes('sonyten')) {
        let timId = channelId;
        if (isDlhd) {
            const cleanDlhd = channelId.toLowerCase();
            timId = DLHD_TO_TIM[cleanDlhd] || DLHD_TO_TIM[cleanDlhd.replace(/[-_]/g, '')] || (cleanDlhd.replace(/[-_]/g, '') + '-uk');
        } else if (isEmbed && DLHD_TO_TIM[channelId]) {
            timId = DLHD_TO_TIM[channelId];
        }

        try {
            const resolvedTim = await resolveTimChannel(timId) || 
                                await resolveTimChannel(timId.replace(/^ev[_-]?/i, '')) || 
                                await resolveTimChannel(rawId);
            if (resolvedTim) {
                return resolvedTim;
            }
        } catch(e) {}
    }

    // High priority: Resolve JioTV DASH / SonyLIV / Hotstar channels directly
    if (isJtv || (!isTim && !isDlhd && !isEmbed)) {
        const jtvCh = await JtvService.resolveChannel(channelId) || await JtvService.resolveChannel(rawId);
        if (jtvCh) {
            if (jtvCh.manifest_url && !jtvCh.stream_url.includes('.m3u8') && !jtvCh.full_stream_url?.includes('.m3u8')) {
                return jtvCh.manifest_url;
            }
            if (jtvCh.full_stream_url || jtvCh.stream_url) {
                return jtvCh.full_stream_url || jtvCh.stream_url;
            }
        }
    }

    let streamUrl: string | null = null;
    let html = '';

    if (isTim || isDlhd || isEmbed) {

        html = await fetchUrl(`https://epiembeds.online/embed/${encodeURIComponent(channelId)}`, 'https://epiembeds.online/');
        streamUrl = decodeStreamUrl(html);

        if (!streamUrl && isDlhd) {
            // Try without -uk suffix
            const plainId = channelId.replace(/[-_]/g, '').toLowerCase();
            html = await fetchUrl(`https://epiembeds.online/embed/${encodeURIComponent(plainId)}`, 'https://epiembeds.online/');
            streamUrl = decodeStreamUrl(html);
        }
    }

    // 2. Secondary fallback: Try DaddyLive endpoints
    if (!streamUrl && isDlhd) {
        html = await fetchUrl(`https://hamis.romponalis.st/premiumtv/daddy3.php?id=${encodeURIComponent(channelId)}`, 'https://dlhd.st/');
        let tempUrl = decodeStreamUrl(html);
        if (tempUrl && !tempUrl.includes('premium0')) {
            streamUrl = tempUrl;
        }

        if (!streamUrl) {
            html = await fetchUrl(`https://dlhd.st/stream/stream-${encodeURIComponent(channelId)}.php`, 'https://dlhd.st/');
            tempUrl = decodeStreamUrl(html);
            if (tempUrl && !tempUrl.includes('premium0')) {
                streamUrl = tempUrl;
            }
        }
    }

    // 3. Fallback: Lookup in Master channels.json catalog
    if (!streamUrl) {
        const diskChannels = ChannelJsonService.getChannels();
        const foundCh = diskChannels.find(c => 
            c.channel_id === rawId || 
            c.channel_id === channelId ||
            (c.name && c.name.toLowerCase() === cleanLookupKey)
        );
        if (foundCh && (foundCh.stream_url || foundCh.url || foundCh.channel_id)) {
            const candidate = foundCh.stream_url || foundCh.url || foundCh.channel_id;
            if (candidate.startsWith('http')) {
                streamUrl = candidate;
            }
        }
    }

    return streamUrl;
}

export async function getOrUpdatePlaylist(force: boolean = false): Promise<string> {
    const now = Date.now();
    if (force) {
        cachedPlaylist = null;
        lastFetchTime = 0;
    }

    const sportsM3uDiskPath = path.join(process.cwd(), 'assets', 'sports.m3u');
    if (!force && fs.existsSync(sportsM3uDiskPath)) {
        try {
            const diskPlaylist = fs.readFileSync(sportsM3uDiskPath, 'utf-8');
            if (diskPlaylist && diskPlaylist.length > 500) {
                cachedPlaylist = diskPlaylist;
                return cachedPlaylist;
            }
        } catch(e) {}
    }

    if (!force && cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedPlaylist;
    }
    
    console.log(`[*] Generating master unified dynamic M3U playlist...`);
    let m3uLines = ['#EXTM3U\n'];
    let totalStreamsCount = 0;
    let data: any[] = [];
    const seenUrls = new Set<string>();

    const addChannelToCatalog = (ch: any) => {
        if (!ch) return;
        const streamUrl = ch.stream_url || ch.channel_id || ch.url;
        if (!streamUrl) return;
        const cleanUrl = String(streamUrl).trim();
        // Immediately discard dead/expired kliv.in streams
        if (cleanUrl.includes('kliv.in') || cleanUrl.includes('playlivtv.whf.bz') || cleanUrl.includes('Expired.m3u8')) return;
        if (seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);
        data.push({
            channel_id: ch.channel_id || cleanUrl,
            stream_url: cleanUrl,
            name: (ch.name || ch.title || 'Channel ' + (data.length + 1)).trim(),
            genre: (ch.genre || ch.group || 'Sports').trim(),
            logo: (ch.logo || '').trim(),
            drm: ch.drm || null,
            clearkey: ch.clearkey || (ch.drm ? (ch.drm.license_key || '') : '') || ''
        });
    };

    // 1. Primary Source: assets/channels.json
    try {
        const localChannels = ChannelJsonService.getChannels();
        if (Array.isArray(localChannels) && localChannels.length > 0) {
            console.log(`[+] Loaded ${localChannels.length} channels from channels.json.`);
            localChannels.forEach(addChannelToCatalog);
        }
    } catch (err: any) {
        console.error('[!] Failed to load channels.json', err.message);
    }

    // 2. Secondary Source: doctor_strange/admin_db.json (sportsM3uFiles & sports)
    try {
        const dbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
        if (fs.existsSync(dbPath)) {
            const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            
            // Custom Sports M3U Files
            if (db.sportsM3uFiles && Array.isArray(db.sportsM3uFiles)) {
                for (const m3u of db.sportsM3uFiles) {
                    if (!m3u.url) continue;
                    let m3uContent = '';
                    if (m3u.url.startsWith('/doctor_strange/')) {
                        const localPath = path.join(process.cwd(), m3u.url);
                        if (fs.existsSync(localPath)) {
                            m3uContent = fs.readFileSync(localPath, 'utf8');
                        }
                    } else if (m3u.url.startsWith('http://') || m3u.url.startsWith('https://')) {
                        m3uContent = await fetchUrl(m3u.url);
                    }
                    
                    if (m3uContent) {
                        const lines = m3uContent.split('\n');
                        let currentChannel: any = null;
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.startsWith('#EXTINF:')) {
                                let name = line.split(',').pop() || 'Unknown';
                                let logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                                let groupMatch = line.match(/group-title="([^"]+)"/i);
                                currentChannel = {
                                    name: name.trim(),
                                    logo: logoMatch ? logoMatch[1] : '',
                                    genre: groupMatch ? groupMatch[1] : m3u.name || 'Custom Sports',
                                    source: 'sports_m3u_file'
                                };
                            } else if (line && !line.startsWith('#') && currentChannel) {
                                currentChannel.stream_url = line;
                                addChannelToCatalog(currentChannel);
                                currentChannel = null;
                            }
                        }
                    }
                }
            }

            // Single Sports Items
            if (db.sports && Array.isArray(db.sports)) {
                const DUMMY_FILTER = /(cricbuzz\s*-\s*aq|stream\.kliv\.in|placeholder|testtapmad|crichd|1st\s*test\s*australia|caribbean\s*premier\s*league|the\s*hundred\s*2026|5th\s*odi\s*afghanistan|sports\s*live\s*vs\s*sports\s*live|playerado|crichdsee|player0003|cricgo|demo|dummy|sample|offline|expired)/i;
                for (const s of db.sports) {
                    if (s.url) {
                        const checkStr = `${s.title || ''} ${s.name || ''} ${s.url || ''}`;
                        if (DUMMY_FILTER.test(checkStr)) continue;
                        addChannelToCatalog({
                            name: s.title || 'Sports Stream',
                            stream_url: s.url,
                            logo: s.icon && s.icon.startsWith('http') ? s.icon : '',
                            genre: 'Custom Sports',
                            source: 'admin_single_sports'
                        });
                    }
                }
            }
        }
    } catch (err: any) {
        console.error('[!] Failed to parse admin_db M3U items:', err.message);
    }

    // 3. Third Source: doctor_strange/m3u_playlists/*.m3u directory
    try {
        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(vaultDir)) {
            const files = fs.readdirSync(vaultDir);
            for (const file of files) {
                if (file.endsWith('.m3u') || file.endsWith('.m3u8')) {
                    const filePath = path.join(vaultDir, file);
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const lines = fileContent.split('\n');
                    let currentChannel: any = null;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('#EXTINF:')) {
                            let name = line.split(',').pop() || 'Unknown';
                            let logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                            let groupMatch = line.match(/group-title="([^"]+)"/i);
                            currentChannel = {
                                name: name.trim(),
                                logo: logoMatch ? logoMatch[1] : '',
                                genre: groupMatch ? groupMatch[1] : file.replace(/\.m3u8?$/i, ''),
                                source: 'vault_file'
                            };
                        } else if (line && !line.startsWith('#') && currentChannel) {
                            currentChannel.stream_url = line;
                            addChannelToCatalog(currentChannel);
                            currentChannel = null;
                        }
                    }
                }
            }
        }
    } catch (err: any) {
        console.error('[!] Failed scanning vault directory:', err.message);
    }

    // 4. Guaranteed Proxy Streams: TimStreams & DaddyLive (DLHD)
    try {
        // Fetch online TimStreams directory
        try {
            const timChannels = await getTimChannels();
            if (Array.isArray(timChannels)) {
                timChannels.forEach((c: any) => {
                    const slug = c.url;
                    if (slug) {
                        addChannelToCatalog({
                            channel_id: 'tim_' + slug,
                            stream_url: 'tim_' + slug,
                            name: '⚡ ' + (c.name || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                            genre: 'Proxy Streams',
                            logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
                            source: 'timstreams'
                        });
                    }
                });
            }
        } catch (e: any) {
            console.warn('[!] Note: TimStreams online fetch fallback:', e.message);
        }
    } catch (e: any) {
        console.error('[!] Error populating proxy streams:', e.message);
    }

    const curatedProxyStreams = [
        { id: 'dlhd-sky-sports-main-event', name: '⚡ Sky Sports Main Event (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Sky_Sports_Main_Event_logo.svg/512px-Sky_Sports_Main_Event_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-premier-league', name: '⚡ Sky Sports Premier League (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Sky_Sports_Premier_League_logo.svg/512px-Sky_Sports_Premier_League_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-football', name: '⚡ Sky Sports Football (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Sky_Sports_Football_logo.svg/512px-Sky_Sports_Football_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-f1', name: '⚡ Sky Sports F1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/Sky_Sports_F1_logo.svg/512px-Sky_Sports_F1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-cricket', name: '⚡ Sky Sports Cricket (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-1', name: '⚡ TNT Sports 1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/TNT_Sports_1.svg/512px-TNT_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-2', name: '⚡ TNT Sports 2 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/TNT_Sports_2.svg/512px-TNT_Sports_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-3', name: '⚡ TNT Sports 3 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/TNT_Sports_3.svg/512px-TNT_Sports_3.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-4', name: '⚡ TNT Sports 4 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/TNT_Sports_4.svg/512px-TNT_Sports_4.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-1', name: '⚡ beIN Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/BeIN_Sports_1_logo.svg/512px-BeIN_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-2', name: '⚡ beIN Sports 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/BeIN_Sports_2_logo.svg/512px-BeIN_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn', name: '⚡ ESPN USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/512px-ESPN_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn2', name: '⚡ ESPN 2 USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/ESPN2_logo.svg/512px-ESPN2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-1', name: '⚡ Fox Sports 1 (FS1) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fox_Sports_1_logo.svg/512px-Fox_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-2', name: '⚡ Fox Sports 2 (FS2) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Fox_Sports_2_logo.svg/512px-Fox_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-dazn-1', name: '⚡ DAZN 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo.svg/512px-DAZN_Logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-willow-hd', name: '⚡ Willow Cricket HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-1', name: '⚡ Sony Ten 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Sony_Ten_1.svg/512px-Sony_Ten_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-2', name: '⚡ Sony Ten 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Sony_Ten_2.svg/512px-Sony_Ten_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-six', name: '⚡ Sony Sports Ten 5 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Sony_Sports_Ten_5_logo.png/512px-Sony_Sports_Ten_5_logo.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-1', name: '⚡ Star Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Star_Sports_1.svg/512px-Star_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-hindi', name: '⚡ Star Sports 1 Hindi (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Star_Sports_Hindi_1.svg/512px-Star_Sports_Hindi_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-select-1', name: '⚡ Star Sports Select 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Sports_Select_1.svg/512px-Star_Sports_Select_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sports18-1', name: '⚡ Sports18 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Sports18_1_logo.svg/512px-Sports18_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-eurosport-1', name: '⚡ Eurosport 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Eurosport_1_logo.svg/512px-Eurosport_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-wwe-network', name: '⚡ WWE Network Live 24/7 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/WWE_Network_Logo.svg/512px-WWE_Network_Logo.svg.png', source: 'dlhd' },
        { id: 'embed-247-willow-2', name: '⚡ Willow 2 (Embed)', genre: 'Cricket', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'embed' }
    ];
    curatedProxyStreams.forEach(c => {
        addChannelToCatalog({
            channel_id: c.id,
            stream_url: c.id,
            name: c.name,
            genre: c.genre,
            logo: c.logo,
            source: c.source
        });
    });

    // 5. Dynamic Live FanCode Sports Matches
    try {
        const { live: fcLive } = await fetchFanCodeEvents();
        if (Array.isArray(fcLive)) {
            fcLive.forEach(ev => {
                if (ev.streamUrl) {
                    addChannelToCatalog({
                        channel_id: ev.id,
                        stream_url: ev.streamUrl,
                        name: `🔴 ${ev.title}`,
                        genre: `FanCode Live (${ev.sportCategory || 'Sports'})`,
                        logo: ev.thumbnail || 'https://www.fancode.com/skillup-uploads/cms-media/web-1.png',
                        source: 'fancode'
                    });
                }
            });
        }
    } catch (e: any) {}

    // 6. Dynamic Live SonyLIV Sports Events
    let slLive: any[] = [];
    try {
        const sonyData = await fetchSonyLivEvents();
        slLive = sonyData?.live || [];
        if (Array.isArray(slLive)) {
            slLive.forEach(ev => {
                if (ev.streamUrl) {
                    addChannelToCatalog({
                        channel_id: ev.id,
                        stream_url: ev.streamUrl,
                        name: `🔴 ${ev.title}`,
                        genre: `SonyLIV Live (${ev.category || 'Sports'})`,
                        logo: ev.thumbnail || 'https://origin-staticv2.sonyliv.com/UI_icons/sonyliv_new_revised_header_logo.png',
                        source: 'sonyliv'
                    });
                }
            });
        }
    } catch (e: any) {}

    // Format all catalog channels into standard M3U
    try {
        if (Array.isArray(data) && data.length > 0) {
            for (const ch of data) {
                if (!ch.channel_id && !ch.stream_url) continue;
                totalStreamsCount++;
                const genre = ch.genre || 'Sports Channels';
                const name = ch.name || 'Unknown Channel';
                const logo = ch.logo || '';
                
                let streamUrl = ch.stream_url || ch.channel_id;

                // If channel is a SonyLIV event ID, dynamically resolve its fresh Akamai stream URL
                if (ch.channel_id && (ch.channel_id.startsWith('sonyliv') || ch.channel_id.startsWith('sliv')) && (!streamUrl || !streamUrl.startsWith('http') || streamUrl.includes('live.php'))) {
                    try {
                        const cleanId = ch.channel_id.replace(/^(?:sonyliv|sliv)[-_]?/i, '');
                        const matched = slLive.find(e => String(e.contentId) === cleanId || e.id === ch.channel_id || String(e.contentId).split('_')[0] === cleanId.split('_')[0]);
                        if (matched && matched.streamUrl) {
                            streamUrl = matched.streamUrl;
                        }
                    } catch(e) {}
                }

                if (streamUrl && (streamUrl.startsWith('http://') || streamUrl.startsWith('https://'))) {
                    streamUrl = streamUrl.includes('/live.php') ? streamUrl : `__HOSTURL__/live.php?url=${encodeURIComponent(streamUrl)}`;
                } else if (ch.source === 'sonyliv' || (ch.channel_id && (ch.channel_id.startsWith('sonyliv-') || ch.channel_id.startsWith('sonyliv_') || ch.channel_id.startsWith('sliv-')))) {
                    if (ch.stream_url && (ch.stream_url.startsWith('http://') || ch.stream_url.startsWith('https://'))) {
                        streamUrl = `__HOSTURL__/live.php?url=${encodeURIComponent(ch.stream_url)}`;
                    } else {
                        streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                    }
                } else if (ch.source === 'jtv' || ch.source === 'mdtv' || (ch.channel_id && (ch.channel_id.startsWith('jtv-') || ch.channel_id.startsWith('mdtv-')))) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.source === 'fancode' || (ch.channel_id && (ch.channel_id.startsWith('fancode-') || ch.channel_id.startsWith('fancode_')))) {
                    if (ch.stream_url) {
                        streamUrl = wrapFanCodeProxyUrl(ch.stream_url);
                    } else {
                        streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                    }
                } else if (ch.source === 'kliv_jozo' || (ch.channel_id && (ch.channel_id.startsWith('http://stream.kliv.in') || ch.channel_id.startsWith('https://stream.kliv.in')))) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.channel_id && (ch.channel_id.startsWith('tim_') || ch.channel_id.startsWith('dlhd-') || ch.channel_id.startsWith('embed-') || ch.channel_id.startsWith('embed_') || ch.source === 'embed')) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.channel_id && (ch.channel_id.startsWith('http://') || ch.channel_id.startsWith('https://'))) {
                    streamUrl = ch.channel_id.includes('/live.php') ? ch.channel_id : `__HOSTURL__/live.php?url=${encodeURIComponent(ch.channel_id)}`;
                } else if (ch.stream_url && (ch.stream_url.includes('.m3u8') || ch.stream_url.includes('.mpd'))) {
                    streamUrl = `__HOSTURL__/live.php?url=${encodeURIComponent(ch.stream_url)}`;
                }
                
                m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genre}",${name}\n`);
                const clearkeyStr = ch.clearkey || (ch.drm && ch.drm.license_key) || (ch.drm && (ch.drm.key_id || ch.drm.keyId) && ch.drm.key ? `${ch.drm.key_id || ch.drm.keyId}:${ch.drm.key}` : '') || (ch.key_id && ch.key ? `${ch.key_id}:${ch.key}` : '');
                if (clearkeyStr) {
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`);
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.license_type=clearkey\n`);
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.license_key=${clearkeyStr}\n`);
                }
                m3uLines.push(`${streamUrl}\n`);
            }
        }
    } catch(e: any) {
        console.error("[!] Error generating playlist from channels catalog:", e.message);
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    try { fs.writeFileSync(path.join(process.cwd(), 'assets', 'sports.m3u'), cachedPlaylist, 'utf-8'); } catch(e) {}
    console.log(`[✓] Master Sports M3U connected & synchronized with ${totalStreamsCount} total stream items.`);
    return cachedPlaylist;
}

router.get(['/sports.m3u', '/playlist.m3u', '/dlhd.m3u'], async (req: Request, res: Response) => {
    // Generate base URL from incoming request
    const reqHost = (req.headers['x-forwarded-host'] || req.get('host') || '').toString();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    let hostUrl = reqHost ? `${protocol}://${reqHost}` : '';
    
    const forceRefresh = req.query.refresh === '1' || req.query.force === 'true';
    const playlist = await getOrUpdatePlaylist(forceRefresh);
    const finalPlaylist = playlist.replace(/__HOSTURL__/g, hostUrl);
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=2700');
    res.send(finalPlaylist);
});

// Direct playback redirect endpoint
router.get(['/api/play_stream', '/api/play_stream/:id', '/api/play_stream/*splat'], async (req: Request, res: Response) => {
    let channelId = (req.query.id || req.query.url || req.params.id || (req.params as any).splat || '') as string;
    if (!channelId && req.originalUrl.includes('/api/play_stream/')) {
        channelId = req.originalUrl.split('/api/play_stream/')[1].split('?')[0];
    }
    try {
        channelId = decodeURIComponent(channelId);
    } catch (_) {}

    try {
        const streamUrl = await resolveChannelStream(channelId);
        
        if (streamUrl) {
            let targetUrl = streamUrl;
            if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                if (!targetUrl.includes('/live.php') && !targetUrl.includes('/api/mdtv/manifest/')) {
                    targetUrl = `/live.php?url=${encodeURIComponent(targetUrl)}`;
                }
            }
            res.redirect(302, targetUrl);
            return;
        } else {
            console.error(`[!] Failed to resolve stream for channel: ${channelId}`);
            res.status(404).send('Stream not found or token expired.');
        }
    } catch (err) {
        res.status(500).send('Error resolving stream.');
    }
});

// Dynamic stream resolver endpoint
router.get(['/api/resolve_stream', '/api/resolve_stream/:id', '/api/resolve_stream/*splat'], async (req: Request, res: Response) => {
    let channelId = (req.query.id || req.query.url || req.params.id || (req.params as any).splat || '') as string;
    if (!channelId && req.originalUrl.includes('/api/resolve_stream/')) {
        channelId = req.originalUrl.split('/api/resolve_stream/')[1].split('?')[0];
    }
    try {
        channelId = decodeURIComponent(channelId);
    } catch (_) {}

    try {
        const streamUrl = await resolveChannelStream(channelId);
        
        if (streamUrl) {
            let proxiedUrl = streamUrl;
            if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
                if (!streamUrl.includes('/live.php') && !streamUrl.includes('/api/mdtv/manifest/')) {
                    proxiedUrl = `/live.php?url=${encodeURIComponent(streamUrl)}`;
                }
            } else if (!streamUrl.startsWith('/api/proxy/')) {
                const stalkerEnc = StalkerAPI.scarletWitch('encrypt', streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1));
                const wandaEnc = StalkerAPI.scarletWitch('encrypt', streamUrl);
                proxiedUrl = `/live.php?token=STALKER_PRO&stalker=${stalkerEnc}&wanda=${wandaEnc}&m3u=1`;
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.json({ status: 'success', url: proxiedUrl, raw_url: streamUrl });
        } else {
            console.error(`[!] Failed to resolve stream for channel: ${channelId}`);
            res.status(404).json({ status: 'error', message: 'Stream not found or token expired.' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error resolving stream.' });
    }
});

// GET /api/fancode/live - Genuine ongoing FanCode live matches with playable HLS streams
router.get('/api/fancode/live', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const { live, all } = await fetchFanCodeEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: live.length,
            totalMatches: all.length,
            events: live,
            allMatches: all
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch FanCode live events' });
    }
});

// GET /api/sonyliv/live - Genuine ongoing and upcoming SonyLIV sports fixtures
router.get('/api/sonyliv/live', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const { live, upcoming, all } = await fetchSonyLivEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: live.length,
            upcomingCount: upcoming.length,
            totalMatches: all.length,
            events: live,
            upcoming,
            allMatches: all
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch SonyLIV events' });
    }
});

// GET /api/sports/highlights - Major sports replays and highlights
router.get('/api/sports/highlights', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const force = req.query.refresh === '1';
        const highlights = query ? await searchHighlights(query) : await getAllSportsHighlights(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: highlights.length,
            highlights
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch highlights' });
    }
});

// GET /api/zee/channels - Working Zee Network live channels
router.get('/api/zee/channels', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const channels = await syncZeeChannels(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: channels.length,
            channels
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Failed to sync Zee channels' });
    }
});

// GET /api/zee/playlist.m3u - Standard Kodi / IPTV M3U for Zee channels
router.get('/api/zee/playlist.m3u', async (req: Request, res: Response) => {
    try {
        const m3u = await getZeePlaylistM3u();
        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(m3u);
    } catch (err: any) {
        res.status(500).send('#EXTM3U\n# Error generating Zee playlist');
    }
});

// GET /api/biggboss/seasons - Bigg Boss reality seasons catalog
router.get('/api/biggboss/seasons', async (req: Request, res: Response) => {
    try {
        const seasons = getBiggBossSeasons();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ status: 'success', seasons });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message });
    }
});

// GET /api/biggboss/episodes/:seasonId - Latest Bigg Boss episodes
router.get('/api/biggboss/episodes/:seasonId', async (req: Request, res: Response) => {
    try {
        const rawParam = req.params.seasonId;
        const seasonId = Array.isArray(rawParam) ? rawParam[0] : (rawParam || 'bb-hindi-18');
        const episodes = await getBiggBossEpisodes(seasonId);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ status: 'success', seasonId, count: episodes.length, episodes });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message });
    }
});

// GET /api/biggboss/resolve - Unpack and resolve direct playable stream
router.get('/api/biggboss/resolve', async (req: Request, res: Response) => {
    try {
        const embedUrl = req.query.url as string;
        const resolved = await resolveBiggBossStream(embedUrl);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ status: 'success', resolved });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message });
    }
});

// JSON channels list endpoint for fast rendering and admin channel picker
router.get('/api/sports/channels', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        await getOrUpdatePlaylist(force);
        
        let allChannels: any[] = [];
        const existingIds = new Set<string>();

        const registerChannel = (ch: any) => {
            if (!ch) return;
            const idKey = String(ch.channel_id || ch.id || ch.stream_url || '');
            if (!idKey || existingIds.has(idKey)) return;
            existingIds.add(idKey);
            allChannels.push(ch);
        };

        // 1. SonyLIV Live & Upcoming Matches (Priority in Live)
        try {
            const sonyData = await fetchSonyLivEvents(force);
            (sonyData.live || []).forEach(sl => {
                if (sl.streamUrl) {
                    registerChannel({
                        channel_id: `sonyliv_${sl.id || sl.contentId}`,
                        id: `sonyliv_${sl.id || sl.contentId}`,
                        name: `📺 ${sl.title} [SonyLIV Live]`,
                        genre: sl.sportName ? `SonyLIV ${sl.sportName}` : 'SonyLIV Sports',
                        group: 'SonyLIV Events',
                        logo: sl.thumbnail || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        stream_url: sl.streamUrl,
                        source: 'sonyliv',
                        isLive: true,
                        isEvent: true
                    });
                }
            });
        } catch (_) {}

        // 2. Ongoing Live FanCode Matches
        try {
            const { live } = await fetchFanCodeEvents(force);
            live.forEach(fc => {
                if (fc.streamUrl) {
                    registerChannel({
                        channel_id: fc.id,
                        id: fc.id,
                        name: `🏏 ${fc.title} [FanCode Live]`,
                        genre: fc.sportCategory ? `FanCode ${fc.sportCategory}` : 'FanCode Live',
                        group: 'FanCode Events',
                        logo: fc.thumbnail || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        stream_url: fc.streamUrl,
                        source: 'fancode',
                        isLive: true,
                        isEvent: true
                    });
                }
            });
        } catch (_) {}

        // 3. TimStreams Live Match Events
        try {
            const timEvents = await getTimLiveEvents(force);
            if (Array.isArray(timEvents)) {
                timEvents.forEach((ev: any) => {
                    const slug = (ev.streams && ev.streams[0]?.embedSlug) || ev.url;
                    if (slug) {
                        registerChannel({
                            channel_id: 'tim_' + slug,
                            id: 'tim_' + slug,
                            name: `⚡ ${ev.name} [TimStreams Event]`,
                            genre: ev.category ? `TimStreams ${ev.category}` : 'TimStreams Events',
                            group: 'TimStreams Events',
                            logo: ev.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                            stream_url: `tim_${slug}`,
                            source: 'tim_events',
                            isLive: true,
                            isEvent: true
                        });
                    }
                });
            }
        } catch (_) {}

        // 4. JioTV Match Events & Dedicated Feeds
        try {
            const jtvEvents = await JtvService.fetchLiveEvents(force);
            if (Array.isArray(jtvEvents)) {
                jtvEvents.forEach(ev => {
                    if (ev.stream_url) {
                        registerChannel({
                            channel_id: `jtv_ev_${ev.id}`,
                            id: `jtv_ev_${ev.id}`,
                            name: `🔴 ${ev.name || ev.title} [Jio Match Feed]`,
                            genre: ev.tournament || ev.badge || 'JioTV Events',
                            group: 'JioTV Events',
                            logo: ev.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                            stream_url: ev.stream_url,
                            source: 'jtv_events',
                            isLive: true,
                            isEvent: true
                        });
                    }
                });
            }
        } catch (_) {}

        // 5. JioTV 24/7 Channels (Star Sports, Sony Ten, DD Sports, etc.)
        try {
            const jtvChannels = await JtvService.fetchChannels(force);
            if (Array.isArray(jtvChannels)) {
                jtvChannels.forEach(ch => {
                    const cat = (ch.category || ch.genre || '').toLowerCase();
                    const n = (ch.name || '').toLowerCase();
                    const isSports = cat.includes('sport') || n.includes('sport') || n.includes('ten') || n.includes('cricket') || n.includes('eurosport') || n.includes('dd sports') || n.includes('willow') || n.includes('fancode') || n.includes('golf') || n.includes('football');
                    if (!isSports) return; // Strictly skip non-sports channels from /api/sports/channels
                    registerChannel({
                        channel_id: `mdtv-${ch.id}`,
                        id: `mdtv-${ch.id}`,
                        name: `${ch.name} (JioTV)`,
                        genre: ch.category || 'Sports',
                        group: 'JioTV Sports',
                        logo: ch.logo,
                        stream_url: `/live.php?token=STALKER_PRO&id=mdtv-${ch.id}&m3u=1`,
                        source: 'jtv',
                        isLive: true
                    });
                });
            }
        } catch (_) {}

        // 6. Mix1TV Channels (mixiptv.m3u)
        try {
            const mixData = await getMix1TvChannels(force);
            if (mixData && Array.isArray(mixData.channels)) {
                mixData.channels.forEach((ch: any) => {
                    const grp = (ch.group || '').toLowerCase();
                    const n = (ch.name || '').toLowerCase();
                    const isSports = grp.includes('sports') || grp.includes('sonyliv') || grp.includes('fancode') || n.includes('sports') || n.includes('ten') || n.includes('cricket');
                    if (!isSports) return; // Strictly skip non-sports channels
                    registerChannel({
                        channel_id: `mix1tv_${ch.id}`,
                        id: `mix1tv_${ch.id}`,
                        name: `${ch.name} (Mix1TV)`,
                        genre: ch.group || 'Mix1TV',
                        group: isSports ? 'Mix1TV Sports' : 'Mix1TV',
                        logo: ch.logo,
                        stream_url: ch.stream_url,
                        source: 'mix1tv',
                        drm: ch.clearkey ? {
                            type: 'clearkey',
                            key_id: ch.key_id,
                            key: ch.key
                        } : undefined,
                        key_id: ch.key_id,
                        key: ch.key,
                        cookie: ch.cookie,
                        headers: {
                            'Referer': ch.referrer || 'https://www.jiotv.com/',
                            'User-Agent': ch.userAgent || 'Premium Plugx',
                            ...(ch.cookie ? { 'Cookie': ch.cookie } : {})
                        },
                        isLive: true
                    });
                });
            }
        } catch (_) {}

        // 7. Zee Network Live Channels
        try {
            const zeeChs = await syncZeeChannels(force);
            if (Array.isArray(zeeChs)) {
                zeeChs.forEach((z: any) => {
                    registerChannel({
                        channel_id: `zee_${z.id}`,
                        id: `zee_${z.id}`,
                        name: `${z.name} (Zee Network)`,
                        genre: z.genre || 'Entertainment',
                        group: 'Zee Network',
                        logo: z.logo,
                        stream_url: z.streamUrl,
                        source: 'zee',
                        isLive: true
                    });
                });
            }
        } catch (_) {}

        // 8. TimStreams 24/7 Channels
        try {
            const timChs = await getTimChannels(force);
            if (Array.isArray(timChs)) {
                timChs.forEach((tc: any) => {
                    if (tc.url) {
                        registerChannel({
                            channel_id: 'tim_' + tc.url,
                            id: 'tim_' + tc.url,
                            name: `⚡ ${tc.name} (TimStreams)`,
                            genre: tc.category || 'TimStreams',
                            group: 'TimStreams',
                            logo: tc.logo,
                            stream_url: `tim_${tc.url}`,
                            source: 'timstreams',
                            isLive: true
                        });
                    }
                });
            }
        } catch (_) {}

        // 9. Master Curated Catalog from channels.json
        try {
            const data = ChannelJsonService.getChannels();
            if (Array.isArray(data)) {
                data.forEach(c => registerChannel(c));
            }
        } catch (err: any) {
            console.error('[!] Failed to read channels in /api/sports/channels:', err.message);
        }

        // 10. Curated Proxy Streams (DLHD, Sky Sports, TNT, etc.)
        try {
            const proxyStreams = await getProxyStreamsList();
            proxyStreams.forEach(ps => registerChannel(ps));
        } catch (_) {}

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(allChannels);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load channels' });
    }
});

// Dedicated FanCode Live Streams & Events Endpoints
router.get('/api/fancode/live', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const { live } = await fetchFanCodeEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: live.length,
            events: live
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e?.message || 'Failed to fetch FanCode live events' });
    }
});

router.get('/api/fancode/all', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const { live, all } = await fetchFanCodeEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            liveCount: live.length,
            totalCount: all.length,
            events: all
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e?.message || 'Failed to fetch FanCode events' });
    }
});

router.get('/api/fancode/playlist.m3u', async (req: Request, res: Response) => {
    try {
        const forwardedProto = (req.headers['x-forwarded-proto'] as string || '').split(',')[0].trim();
        const proto = (forwardedProto === 'https' || req.secure || (req.get('host') || '').includes('run.app')) ? 'https' : (req.protocol || 'http');
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = req.query.direct === '1' ? undefined : `${proto}://${host}`;
        const m3u = await getFanCodeM3u(baseUrl);
        res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(m3u);
    } catch (e: any) {
        res.status(500).send('#EXTM3U\n');
    }
});

// Dedicated Proxy Streams (TimStreams & DLHD) endpoint
router.get('/api/sports/proxy-streams', async (req: Request, res: Response) => {
    try {
        const proxyStreams = await getProxyStreamsList();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: proxyStreams.length,
            channels: proxyStreams
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Dedicated TimStreams Live Events endpoint (https://timst.cfd/api/streams)
router.get('/api/sports/live-events', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const events = await getTimLiveEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: events.length,
            events
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// All TimStreams (categories, channels, live events)
router.get('/api/sports/timstreams', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const data = await getAllTimStreams(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            data
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Dedicated TimStreams Channels & Events endpoint (All 174+ TimStreams channels and live matches)
router.get('/api/sports/timstreams/channels', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const [channels, events] = await Promise.all([
            getTimChannels(force).catch(() => []),
            getTimLiveEvents(force).catch(() => [])
        ]);

        const formattedChannels: any[] = [];
        const seen = new Set<string>();

        // 1. Live match events first
        if (Array.isArray(events)) {
            events.forEach((ev: any) => {
                const slug = (ev.streams && ev.streams[0]?.embedSlug) || ev.url;
                if (slug && !seen.has('tim_' + slug)) {
                    seen.add('tim_' + slug);
                    formattedChannels.push({
                        id: 'tim_' + slug,
                        channel_id: 'tim_' + slug,
                        name: '🔴 ' + (ev.name || 'Live Event') + (ev.category ? ` (${ev.category})` : ''),
                        genre: ev.category || 'Live Events',
                        logo: ev.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        url: `/live.php?token=STALKER_PRO&id=tim_${encodeURIComponent(slug)}`,
                        stream_url: `/live.php?token=STALKER_PRO&id=tim_${encodeURIComponent(slug)}`,
                        source: 'tim_events',
                        isLive: true,
                        isEvent: true,
                        isTimStreams: true
                    });
                }
            });
        }

        // 2. All 174+ 24/7 channels
        if (Array.isArray(channels)) {
            channels.forEach((c: any) => {
                if (c.url && !seen.has('tim_' + c.url)) {
                    seen.add('tim_' + c.url);
                    formattedChannels.push({
                        id: 'tim_' + c.url,
                        channel_id: 'tim_' + c.url,
                        name: '⚡ ' + (c.name || 'TimStreams Channel'),
                        genre: getSportCategoryName(c.genre, undefined, c.name),
                        logo: c.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        url: `/live.php?token=STALKER_PRO&id=tim_${encodeURIComponent(c.url)}`,
                        stream_url: `/live.php?token=STALKER_PRO&id=tim_${encodeURIComponent(c.url)}`,
                        source: 'timstreams',
                        isLive: true,
                        isTimStreams: true
                    });
                }
            });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: formattedChannels.length,
            channels: formattedChannels
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e?.message || 'Failed to load TimStreams channels' });
    }
});

async function getProxyStreamsList(): Promise<any[]> {
    const list: any[] = [];
    const seen = new Set<string>();

    const add = (c: any) => {
        if (!c || !c.channel_id || seen.has(c.channel_id)) return;
        seen.add(c.channel_id);
        const resolvedUrl = `/live.php?token=STALKER_PRO&id=${c.channel_id}`;
        list.push({
            channel_id: c.channel_id,
            stream_url: resolvedUrl,
            url: resolvedUrl,
            name: c.name,
            genre: c.genre || 'Proxy Streams',
            logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
            source: c.source || 'dlhd',
            isProxyStream: true
        });
    };

    // TimStreams Live Events
    try {
        const liveEvents = await getTimLiveEvents();
        if (Array.isArray(liveEvents)) {
            liveEvents.forEach((ev: any) => {
                if (ev.url) {
                    const bestStream = (ev.streams && ev.streams[0]) ? ev.streams[0].embedSlug : ev.url;
                    add({
                        channel_id: 'tim_' + bestStream,
                        name: '🔴 ' + (ev.name || '').replace(/&amp;/g, '&') + (ev.category ? ` (${ev.category})` : ''),
                        genre: 'Live Events',
                        logo: ev.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        source: 'tim_events'
                    });
                }
            });
        }
    } catch (e: any) {}

    // TimStreams Channels
    try {
        const timChannels = await getTimChannels();
        if (Array.isArray(timChannels)) {
            timChannels.forEach((c: any) => {
                const slug = c.url;
                if (slug) {
                    add({
                        channel_id: 'tim_' + slug,
                        stream_url: 'tim_' + slug,
                        name: '⚡ ' + (c.name || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'") + ' (TimStreams)',
                        genre: 'Proxy Streams',
                        logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
                        source: 'timstreams'
                    });
                }
            });
        }
    } catch (e: any) {}

    const curatedProxyStreams = [
        { id: 'dlhd-sky-sports-main-event', name: '⚡ Sky Sports Main Event (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Sky_Sports_Main_Event_logo.svg/512px-Sky_Sports_Main_Event_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-premier-league', name: '⚡ Sky Sports Premier League (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Sky_Sports_Premier_League_logo.svg/512px-Sky_Sports_Premier_League_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-football', name: '⚡ Sky Sports Football (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Sky_Sports_Football_logo.svg/512px-Sky_Sports_Football_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-f1', name: '⚡ Sky Sports F1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/Sky_Sports_F1_logo.svg/512px-Sky_Sports_F1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-cricket', name: '⚡ Sky Sports Cricket (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-1', name: '⚡ TNT Sports 1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/TNT_Sports_1.svg/512px-TNT_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-2', name: '⚡ TNT Sports 2 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/TNT_Sports_2.svg/512px-TNT_Sports_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-3', name: '⚡ TNT Sports 3 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/TNT_Sports_3.svg/512px-TNT_Sports_3.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-4', name: '⚡ TNT Sports 4 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/TNT_Sports_4.svg/512px-TNT_Sports_4.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-1', name: '⚡ beIN Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/BeIN_Sports_1_logo.svg/512px-BeIN_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-2', name: '⚡ beIN Sports 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/BeIN_Sports_2_logo.svg/512px-BeIN_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn', name: '⚡ ESPN USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/512px-ESPN_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn2', name: '⚡ ESPN 2 USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/ESPN2_logo.svg/512px-ESPN2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-1', name: '⚡ Fox Sports 1 (FS1) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fox_Sports_1_logo.svg/512px-Fox_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-2', name: '⚡ Fox Sports 2 (FS2) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Fox_Sports_2_logo.svg/512px-Fox_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-dazn-1', name: '⚡ DAZN 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo.svg/512px-DAZN_Logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-willow-hd', name: '⚡ Willow Cricket HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-1', name: '⚡ Sony Ten 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Sony_Ten_1.svg/512px-Sony_Ten_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-2', name: '⚡ Sony Ten 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Sony_Ten_2.svg/512px-Sony_Ten_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-six', name: '⚡ Sony Sports Ten 5 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Sony_Sports_Ten_5_logo.png/512px-Sony_Sports_Ten_5_logo.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-1', name: '⚡ Star Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Star_Sports_1.svg/512px-Star_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-hindi', name: '⚡ Star Sports 1 Hindi (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Star_Sports_Hindi_1.svg/512px-Star_Sports_Hindi_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-select-1', name: '⚡ Star Sports Select 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Sports_Select_1.svg/512px-Star_Sports_Select_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sports18-1', name: '⚡ Sports18 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Sports18_1_logo.svg/512px-Sports18_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-eurosport-1', name: '⚡ Eurosport 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Eurosport_1_logo.svg/512px-Eurosport_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-wwe-network', name: '⚡ WWE Network Live 24/7 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/WWE_Network_Logo.svg/512px-WWE_Network_Logo.svg.png', source: 'dlhd' },
        { id: 'embed-247-willow-2', name: '⚡ Willow 2 (Embed)', genre: 'Cricket', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'embed' }
    ];

    curatedProxyStreams.forEach(c => {
        add({
            channel_id: c.id,
            name: c.name,
            genre: c.genre,
            logo: c.logo,
            source: c.source
        });
    });

    return list;
}

export default router;
