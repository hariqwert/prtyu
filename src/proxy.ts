import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { Request, Response } from 'express';
import { StalkerAPI } from './stalkerAPI';
import { QuarantineService } from './services/quarantineService';
import { resolveTimChannel, resolveEmbedUrl, extractM3u8FromHtml } from './services/timstreamsService';
import { JtvService } from './services/jtvService';
import { fetchFanCodeEvents, wrapFanCodeProxyUrl } from './services/fancodeService';
import { fetchSonyLivEvents } from './services/sonylivService';
import { resolveAirtelStream } from './services/airtelService';
import { trackUserStreamSession, recordSessionBytes, endUserStreamSession } from './services/loggerService';
import { activeSessions, features, systemState, addStreamingIp, removeStreamingIp, shouldSendUserIp, trackBandwidth, trackMediaRequest, trackClientIpActivity } from '../server';

// RAM HLS Segment Caching & Pre-fetcher
interface SegmentCacheEntry {
    buffer: Buffer;
    contentType: string;
    expiresAt: number;
}
export const hlsSegmentCache = new Map<string, SegmentCacheEntry>();

// Clean up expired segments periodically and cap memory usage
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hlsSegmentCache.entries()) {
        if (entry.expiresAt < now) {
            hlsSegmentCache.delete(key);
        }
    }
    // Limit cache size to 150 items to keep RAM lean over 6+ hour continuous streaming
    if (hlsSegmentCache.size > 150) {
        let excess = hlsSegmentCache.size - 150;
        for (const key of hlsSegmentCache.keys()) {
            hlsSegmentCache.delete(key);
            if (--excess <= 0) break;
        }
    }
}, 20000);

/**
 * Strip junk headers (such as 42-byte fake RIFF/WebP headers) from MPEG-TS buffers
 * to ensure every segment strictly aligns with 0x47 sync byte and 188-byte packet stride.
 * Preserves fMP4, AAC, and clean TS buffers untouched.
 */
export function cleanTsBuffer(buf: Buffer): { buffer: Buffer; contentType: string } {
    if (!buf || buf.length < 188) {
        return { buffer: buf, contentType: 'video/mp2t' };
    }

    // 1. ISOBMFF / fMP4 Box detection (ftyp, moof, moov, styp, mdat, free, skip, prft, emsg)
    if (buf.length >= 8) {
        const boxType = buf.toString('ascii', 4, 8);
        if (boxType === 'ftyp' || boxType === 'moof' || boxType === 'moov' || boxType === 'styp' ||
            boxType === 'mdat' || boxType === 'free' || boxType === 'skip' || boxType === 'prft' || boxType === 'emsg') {
            return { buffer: buf, contentType: 'video/mp4' };
        }
    }

    // 2. Audio tags detection (ID3, ADTS AAC, WebM)
    if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
        return { buffer: buf, contentType: 'audio/mpeg' };
    }
    if (buf.length >= 2 && buf[0] === 0xFF && (buf[1] & 0xF0) === 0xF0) {
        return { buffer: buf, contentType: 'audio/aac' };
    }
    if (buf.length >= 4 && buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
        return { buffer: buf, contentType: 'video/webm' };
    }

    // 3. Clean standard MPEG-TS: starts with 0x47 and has 188-byte stride
    if (buf[0] === 0x47 && (buf.length < 376 || buf[188] === 0x47)) {
        return { buffer: buf, contentType: 'video/mp2t' };
    }

    // 4. Known wrapper offsets with strict 3-packet 188-byte stride check
    if (buf.length > 42 + 188 * 2 && buf[42] === 0x47 && buf[42 + 188] === 0x47 && (buf.length < 42 + 376 || buf[42 + 376] === 0x47)) {
        return { buffer: Buffer.from(buf.subarray(42)), contentType: 'video/mp2t' };
    }
    if (buf.length > 70 + 188 * 2 && buf[70] === 0x47 && buf[70 + 188] === 0x47 && (buf.length < 70 + 376 || buf[70 + 376] === 0x47)) {
        return { buffer: Buffer.from(buf.subarray(70)), contentType: 'video/mp2t' };
    }

    // 5. Scan first 1024 bytes ONLY when at least 3 consecutive packets confirm 0x47 stride
    const maxScan = Math.min(buf.length - 188 * 3, 1024);
    for (let i = 1; i <= maxScan; i++) {
        if (buf[i] === 0x47 && buf[i + 188] === 0x47 && buf[i + 376] === 0x47) {
            return { buffer: Buffer.from(buf.subarray(i)), contentType: 'video/mp2t' };
        }
    }

    return { buffer: buf, contentType: 'video/mp2t' };
}

/**
 * Asynchronously pre-fetches HLS video segments into RAM cache for buttery-smooth, zero-buffer playback
 */
export async function prefetchHlsSegments(baseM3u8Url: string, m3u8Body: string, headersArray: string[] = []) {
    if (!m3u8Body || typeof m3u8Body !== 'string') return;
    try {
        const lines = m3u8Body.split('\n');
        const allCandidateUrls: string[] = [];
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            // Handle rewritten segment tokens (cassie=...)
            if (line.includes('cassie=')) {
                const match = line.match(/cassie=([^&\s"]+)/);
                if (match) {
                    try {
                        const decrypted = StalkerAPI.scarletWitch('decrypt', decodeURIComponent(match[1]));
                        if (decrypted && decrypted.startsWith('http')) {
                            allCandidateUrls.push(decrypted);
                        }
                    } catch(e) {}
                }
            } else {
                let segUrl = resolveM3u8Url(baseM3u8Url, line);
                if (segUrl.startsWith('http')) {
                    allCandidateUrls.push(segUrl);
                }
            }
        }

        if (allCandidateUrls.length === 0) return;

        // In live streaming, the newest segments at the bottom (live edge) are most critical!
        // We prefetch the latest 5 live segments (live edge) AND the first 2
        const segmentUrls = Array.from(new Set([
            ...allCandidateUrls.slice(0, 2),
            ...allCandidateUrls.slice(-5)
        ]));

        const isSony = baseM3u8Url.includes('sonyliv') || baseM3u8Url.includes('akamaized.net') || baseM3u8Url.includes('sonydaime') || baseM3u8Url.includes('sonymtmnew') || baseM3u8Url.includes('slivcdn.com') || baseM3u8Url.includes('kliv.in');
        const isJudias = baseM3u8Url.includes('judiaslevels') || baseM3u8Url.includes('embeds.gay') || baseM3u8Url.includes('ehgembxe') || baseM3u8Url.includes('exmxbxe');
        const defaultReferer = isSony ? 'https://www.sonyliv.com/' : (isJudias ? 'https://ehgembxe.cfd/' : 'https://timst.top/');
        const defaultOrigin = isSony ? 'https://www.sonyliv.com' : (isJudias ? 'https://ehgembxe.cfd' : 'https://timst.top');
        const prefetchHeaders: Record<string, string> = {
            'User-Agent': isSony ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': defaultReferer,
            'Origin': defaultOrigin,
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };
        for (const h of headersArray) {
            const idx = h.indexOf(':');
            if (idx > 0) {
                const key = h.substring(0, idx).trim();
                const val = h.substring(idx + 1).trim();
                if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
                    prefetchHeaders[key] = val;
                }
            }
        }

        for (const segUrl of segmentUrls) {
            if (hlsSegmentCache.has(segUrl)) continue;
            // Pre-fetch segment into RAM cache with low latency
            axios.get(segUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: prefetchHeaders,
                httpsAgent: agent
            }).then(response => {
                if (response.status === 200 && response.data) {
                    let buf = Buffer.from(response.data);
                    let finalContentType = 'video/mp2t';
                    if (segUrl.includes('.m4s') || segUrl.includes('.mp4')) {
                        finalContentType = 'video/mp4';
                    } else if (segUrl.includes('.aac')) {
                        finalContentType = 'audio/aac';
                    } else if (segUrl.includes('.vtt')) {
                        finalContentType = 'text/vtt';
                    } else {
                        const cleaned = cleanTsBuffer(buf);
                        buf = cleaned.buffer;
                        finalContentType = 'video/mp2t';
                    }
                    hlsSegmentCache.set(segUrl, {
                        buffer: buf,
                        contentType: finalContentType,
                        expiresAt: Date.now() + 90000 // 90s TTL
                    });
                    trackBandwidth(buf.length);
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

import dns from 'dns';
import { promisify } from 'util';
const lookup = promisify(dns.lookup);

// Clean public DNS resolver (Cloudflare & Google) to bypass local ISP DNS poisoning/sinkholing (e.g. 49.44.x.x)
const cleanDnsResolver = new dns.promises.Resolver();
cleanDnsResolver.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);

const dnsCache = new Map<string, { ip: string; family: number; expires: number }>();

export function customCleanLookup(hostname: string, options: any, callback: (err: any, address?: any, family?: any) => void) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    const cached = dnsCache.get(hostname);
    if (cached && cached.expires > Date.now()) {
        if (options && options.all) {
            return callback(null, [{ address: cached.ip, family: cached.family }]);
        }
        return callback(null, cached.ip, cached.family);
    }

    const isSpecialCdn = hostname.includes('tiktokcdn') || hostname.includes('byteoversea') || hostname.includes('ibytedtos') || hostname.includes('musical.ly') || hostname.includes('edgesuite.net');

    if (isSpecialCdn) {
        cleanDnsResolver.resolve4(hostname).then(ips => {
            if (ips && ips.length > 0) {
                const cleanIps = ips.filter(ip => !ip.startsWith('49.44.') && ip !== '0.0.0.0' && ip !== '127.0.0.1');
                const selectedIp = cleanIps[0] || ips[0];
                dnsCache.set(hostname, { ip: selectedIp, family: 4, expires: Date.now() + 300000 });
                if (options && options.all) {
                    return callback(null, [{ address: selectedIp, family: 4 }]);
                }
                return callback(null, selectedIp, 4);
            }
            dns.lookup(hostname, options, callback);
        }).catch(() => {
            dns.lookup(hostname, options, callback);
        });
    } else {
        dns.lookup(hostname, options, (err, address, family) => {
            if (err || !address || (typeof address === 'string' && address.startsWith('49.44.'))) {
                cleanDnsResolver.resolve4(hostname).then(ips => {
                    if (ips && ips.length > 0) {
                        const cleanIps = ips.filter(ip => !ip.startsWith('49.44.') && ip !== '0.0.0.0' && ip !== '127.0.0.1');
                        const selectedIp = cleanIps[0] || ips[0];
                        dnsCache.set(hostname, { ip: selectedIp, family: 4, expires: Date.now() + 300000 });
                        if (options && options.all) {
                            return callback(null, [{ address: selectedIp, family: 4 }]);
                        }
                        return callback(null, selectedIp, 4);
                    }
                    callback(err, address, family);
                }).catch(() => callback(err, address, family));
            } else {
                callback(null, address, family);
            }
        });
    }
}

export const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 50,
    timeout: 0,
    keepAliveMsecs: 10000,
    lookup: customCleanLookup
});
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 50,
    timeout: 0,
    keepAliveMsecs: 10000,
    lookup: customCleanLookup
});

export function isPrivateOrBlockedIp(ip: string): boolean {
    if (!ip) return true;
    const clean = ip.replace('::ffff:', '').trim().toLowerCase();

    // IPv6 checks (Loopback, Link-Local, Unique Local, Unspecified)
    if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') return true;
    if (clean.startsWith('fe80:') || clean.startsWith('fc00:') || clean.startsWith('fd00:')) return true;

    // IPv4 checks
    const parts = clean.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
        // 0.0.0.0/8 (Current network)
        if (parts[0] === 0) return true;
        // 10.0.0.0/8 (Private network)
        if (parts[0] === 10) return true;
        // 127.0.0.0/8 (Loopback network)
        if (parts[0] === 127) return true;
        // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata 169.254.169.254)
        if (parts[0] === 169 && parts[1] === 254) return true;
        // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16 (Private network)
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 100.64.0.0/10 (Carrier-grade NAT) & 100.100.100.200 (Alibaba Cloud metadata)
        if (parts[0] === 100 && ((parts[1] >= 64 && parts[1] <= 127) || (parts[1] === 100 && parts[2] === 100 && parts[3] === 200))) return true;
        // 192.0.0.0/24 (IETF Assignments) & 192.0.2.0/24 (TEST-NET-1)
        if (parts[0] === 192 && parts[1] === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
        // 198.51.100.0/24 (TEST-NET-2)
        if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
        // 203.0.113.0/24 (TEST-NET-3)
        if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
        // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
        if (parts[0] >= 224 && parts[0] <= 239) return true;
        // 240.0.0.0/4 (Reserved: 240.0.0.0 - 255.255.255.254)
        if (parts[0] >= 240) return true;
    }

    return false;
}

export async function isSafeUrl(urlStr: string): Promise<boolean> {
    try {
        if (!urlStr || typeof urlStr !== 'string') return false;

        const trimmed = urlStr.trim();
        // Allow relative internal application routes (e.g. /live.php, /api/mdtv/, live.php)
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            // Block directory traversal attempts
            if (trimmed.includes('..') || trimmed.includes('\\')) return false;
            if (trimmed.startsWith('/') || trimmed.startsWith('live.php') || trimmed.startsWith('xtream.php')) {
                return true;
            }
            return false;
        }

        const url = new URL(trimmed);

        // Strictly allow only http and https protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

        // Block embedded credentials in URLs (e.g. http://user:pass@host)
        if (url.username || url.password) return false;

        const host = url.hostname.toLowerCase();

        // Block cloud metadata endpoints directly by hostname
        const blockedHosts = [
            'metadata.google.internal',
            'metadata.google',
            'metadata.internal',
            'instance-data',
            '169.254.169.254',
            '169.254.169.253',
            '100.100.100.200'
        ];
        if (blockedHosts.some(h => host === h || host.endsWith('.' + h))) return false;

        // Block numeric/dotless/hex/octal IP representations
        const numericIpRe = /^(0x[\da-f]+|\d{8,10}|0\d+)$/i;
        if (numericIpRe.test(host)) return false;

        // Check if destination is self / localhost
        const isSelfHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
        const serverPort = String(process.env.PORT || 3000);

        if (isSelfHost) {
            // ONLY permit connection to the server's own listening port and whitelisted media routes
            const targetPort = url.port || (url.protocol === 'https:' ? '443' : '80');
            if (targetPort !== serverPort && targetPort !== '3000') {
                return false; // Prohibit arbitrary port probing on localhost (e.g. 22, 8080, 2375, 6379, 9200)
            }
            const safeLocalPaths = ['/live.php', '/api/mdtv/', '/api/live/', '/api/proxy/', '/stream_proxy.php', '/api/play_stream/'];
            if (!safeLocalPaths.some(p => url.pathname.startsWith(p))) {
                return false;
            }
            return true;
        }

        // Check if raw hostname is already a private/blocked IP literal
        if (isPrivateOrBlockedIp(host)) {
            return false;
        }

        // DNS resolve and check EVERY resolved IP address to prevent DNS rebinding attacks
        try {
            const records = await dns.promises.lookup(host, { all: true });
            for (const record of records) {
                if (isPrivateOrBlockedIp(record.address)) {
                    return false;
                }
            }
        } catch (dnsErr) {
            // DNS lookup failure on public CDN: try clean fallback DNS resolver
            try {
                const ips = await cleanDnsResolver.resolve4(host);
                if (ips.length === 0) return false;
                for (const ip of ips) {
                    if (isPrivateOrBlockedIp(ip)) return false;
                }
            } catch (_) {
                // If the host fails to resolve completely, reject to prevent blind SSRF
                return false;
            }
        }

        return true;
    } catch (e) {
        return false;
    }
}


function resolveM3u8Url(base: string, pathStr: string): string {
    try {
        const baseUrlObj = new URL(base);
        const resolved = new URL(pathStr, base);
        
        // If the base URL had query parameters (e.g. ?hdnea=..., token=...),
        // merge/inherit the parent query parameters into the child URL so tokens are not lost
        if (baseUrlObj.search) {
            const baseParams = new URLSearchParams(baseUrlObj.search);
            const resolvedParams = new URLSearchParams(resolved.search);
            
            baseParams.forEach((val, key) => {
                if (!resolvedParams.has(key)) {
                    resolvedParams.set(key, val);
                }
            });
            resolved.search = resolvedParams.toString();
        }
        return resolved.href;
    } catch (e) {
        if (pathStr.startsWith('http')) return pathStr;
        if (pathStr.startsWith('//')) return 'http:' + pathStr;
        if (pathStr.startsWith('/')) {
            try {
                const parsed = new URL(base);
                return parsed.protocol + '//' + parsed.host + pathStr;
            } catch (ex) {
                return base + pathStr;
            }
        }
        return base + (base.endsWith('/') ? '' : '/') + pathStr;
    }
}

/**
 * Rewrites an HLS M3U8 manifest so all variant streams, media renditions, keys,
 * and segment chunks route securely through the /live.php proxy with token inheritance.
 */
export function rewriteHlsManifest(
    manifestContent: string,
    currentManifestUrl: string,
    m3u_suffix: string
): string {
    const is_master_manifest = manifestContent.includes('#EXT-X-STREAM-INF') || manifestContent.includes('#EXT-X-I-FRAME-STREAM-INF');
    const lines = manifestContent.split('\n');
    let rewritten = '';

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.includes('URI="')) {
            line = line.replace(/URI="([^"]+)"/g, (_match, uri) => {
                const is_uri_playlist = is_master_manifest || uri.includes('.m3u8') || uri.includes('.m3u');
                const uri_param = is_uri_playlist ? 'wanda' : 'cassie';

                const finalUri = resolveM3u8Url(currentManifestUrl, uri);
                const stalkerEnc = StalkerAPI.scarletWitch('encrypt', finalUri.substring(0, finalUri.lastIndexOf('/') + 1));
                const paramEnc = StalkerAPI.scarletWitch('encrypt', finalUri);

                const proxied = `live.php?token=STALKER_PRO${m3u_suffix}&stalker=${stalkerEnc}&${uri_param}=${paramEnc}`;
                return `URI="${proxied}"`;
            });
            rewritten += line + '\n';
        } else if (line.startsWith('#EXTINF') && line.includes(',')) {
            const parts = line.split(',');
            const extinf = parts[0];
            const potentialUrl = parts.slice(1).join(',').trim();

            if (potentialUrl && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
                const is_playlist = is_master_manifest || potentialUrl.includes('.m3u8') || potentialUrl.includes('.m3u');
                const param_name = is_playlist ? 'wanda' : 'cassie';

                const finalUrl = resolveM3u8Url(currentManifestUrl, potentialUrl);
                const stalkerEnc = StalkerAPI.scarletWitch('encrypt', finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1));
                const paramEnc = StalkerAPI.scarletWitch('encrypt', finalUrl);

                const proxied = `live.php?token=STALKER_PRO${m3u_suffix}&stalker=${stalkerEnc}&${param_name}=${paramEnc}`;
                rewritten += extinf + ',\n' + proxied + '\n';
            } else {
                rewritten += line + '\n';
            }
        } else if (line.startsWith('#')) {
            rewritten += line + '\n';
        } else {
            const is_playlist = is_master_manifest || line.includes('.m3u8') || line.includes('.m3u');
            const param_name = is_playlist ? 'wanda' : 'cassie';

            const finalUrl = resolveM3u8Url(currentManifestUrl, line);
            const stalkerEnc = StalkerAPI.scarletWitch('encrypt', finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1));
            const paramEnc = StalkerAPI.scarletWitch('encrypt', finalUrl);

            const proxied = `live.php?token=STALKER_PRO${m3u_suffix}&stalker=${stalkerEnc}&${param_name}=${paramEnc}`;
            rewritten += proxied + '\n';
        }
    }
    return rewritten.trim();
}

async function decodeStreamUrl(html: string): Promise<string | null> {
    return await extractM3u8FromHtml(html);
}

export const activeStreamingResponses = new Set<Response>();
export function killAllActiveStreams() {
    console.log(`[PROXY] Terminating ${activeStreamingResponses.size} active streams immediately.`);
    for (const res of activeStreamingResponses) {
        try {
            res.destroy();
        } catch(e) {}
    }
    activeStreamingResponses.clear();
}

export async function streamUrl(url: string, headersArray: string[], req: Request, res: Response) {
    console.log("STREAM_URL_FETCH:", url);
    if (url && url.startsWith('http') && !(await isSafeUrl(url))) {
        if (!res.headersSent) {
            res.status(403).send('Access Denied: Unsafe streaming URL detected.');
        }
        return;
    }
    // Check System Power State (Proxy Kill)
    if (systemState.status === 'offline' || systemState.status === 'killed') {
        res.status(403).send('System Offline: Access Terminated by Administrator.');
        return;
    }
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = Array.isArray(clientIp) ? clientIp[0] : (clientIp as string).replace('::ffff:', '');

    // Track Media & Client Activity
    if (req.query.title) {
        trackMediaRequest(req.query.title as string, (req.query.type as string) || 'stream');
    }
    trackClientIpActivity(cleanIp, req.headers['user-agent'] as string || '', true);

    // RAM Cache Check for Instant Startup (<1s latency)
    if (hlsSegmentCache.has(url)) {
        const cached = hlsSegmentCache.get(url)!;
        if (cached.expiresAt > Date.now()) {
            res.setHeader('Content-Type', cached.contentType);
            res.setHeader('Content-Length', cached.buffer.length);
            res.setHeader('X-Cache', 'RAM-HIT');
            res.setHeader('Access-Control-Allow-Origin', '*');
            trackBandwidth(cached.buffer.length);
            return res.send(cached.buffer);
        }
    }

    const headers: Record<string, string> = {
        'Accept': '*/*',
        
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        
        'Referer': url.substring(0, url.lastIndexOf('/') + 1)
    };
    
    addStreamingIp(cleanIp);
    activeStreamingResponses.add(res);
    res.on('close', () => {
        removeStreamingIp(cleanIp);
        activeStreamingResponses.delete(res);
    });
    if (url.includes('tiktokcdn') || url.includes('byteoversea') || url.includes('ibytedtos')) {
        headers['Referer'] = 'https://callistanise.com/';
        headers['Origin'] = 'https://callistanise.com';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    } else if (
        url.includes('nexabloom.top') || 
        url.includes('megaplay') || 
        url.includes('mistyhorizon') || 
        url.includes('horizon') || 
        url.includes('onehpanddreaming') || 
        url.includes('broforgotsave') || 
        url.includes('goldenanchor') || 
        url.includes('midnightvoyage') || 
        url.includes('eclipseharbor') || 
        (url.includes('.space') && url.includes('/anime/')) ||
        (url.includes('/anime/') && !url.includes('animesalt') && !url.includes('ravok'))
    ) {
        headers['Referer'] = 'https://megaplay.buzz/';
        headers['Origin'] = 'https://megaplay.buzz';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    } else if (url.includes('judiaslevels') || url.includes('embeds.gay') || url.includes('ehgembxe') || url.includes('exmxbxe')) {
        headers['Referer'] = 'https://ehgembxe.cfd/';
        headers['Origin'] = 'https://ehgembxe.cfd';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else if (url.includes('hiveatick') || url.includes('casadenoval') || url.includes('timstreams') || url.includes('timst') || url.includes('cdx-08192') || url.includes('diffevixed') || url.includes('vilevodules') || url.includes('hundxvision') || url.includes('epidd') || url.includes('epiembeds') || url.includes('embedindia')) {
        headers['Referer'] = 'https://timst.top/';
        headers['Origin'] = 'https://timst.top';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else if (url.includes('phantemlis') || url.includes('xameleon') || url.includes('romponalis') || url.includes('daddy') || url.includes('dlhd') || url.includes('cloudflarestorage.com')) {
        headers['Referer'] = 'https://hamis.romponalis.st/';
    } else if (url.includes('fancode.com') || url.includes('flive') || url.includes('dai-fancode') || url.includes('in-mc-flive') || url.includes('in-ak-flive')) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
        headers['Referer'] = 'https://fancode.com/';
        headers['Origin'] = 'https://fancode.com';
        headers['Accept'] = '*/*';
    } else if (url.includes('sonydaimenew') || url.includes('akamaized.net') || url.includes('sonymtmnew')) {
        url = url.replace(/sonydaimenew\.akamaized\.net/g, 'sonymtmnew.akamaized.net');
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0';
        headers['Referer'] = 'https://www.sonyliv.com/';
        headers['Origin'] = 'https://www.sonyliv.com';
        headers['Accept'] = '*/*';
        const hdneaMatch = url.match(/[?&]hdnea=([^&]+)/);
        if (hdneaMatch) {
            headers['Cookie'] = `hdnea=${hdneaMatch[1]}`;
        }
        headers['x-playback-session-id'] = 'd41d93298b2cc00eafdeb0c6e9992b20-' + Date.now();
    } else if (url.includes('slivcdn.com') || url.includes('kliv.in') || url.includes('dishmt.com') || url.includes('sonyliv.com')) {
        headers['User-Agent'] = 'VLC/3.0.18';
        headers['Referer'] = 'https://kliv.in/';
        headers['Origin'] = 'https://kliv.in/';
        headers['Accept'] = '*/*';
    }

    const lowerUrlCheck = url.toLowerCase();
    const isMkvStream = lowerUrlCheck.includes('.mkv') || lowerUrlCheck.endsWith('.mkv');

    // "make hls m3u if it is mkv not hls use mpeg buttery smooth"
    if (isMkvStream) {
        const isHls = req.query.type === 'hls' || req.query.hls === '1' || req.query.m3u === '1' || req.url.includes('.m3u8');
        if (isHls) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            const host = req.get('host') || 'localhost:3000';
            const proto = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
            const mpegUrl = `${proto}://${host}/api/stream-proxy?url=${encodeURIComponent(url)}&type=mpegts`;
            const hlsPlaylist = [
                '#EXTM3U',
                '#EXT-X-VERSION:3',
                '#EXT-X-TARGETDURATION:6',
                '#EXT-X-MEDIA-SEQUENCE:0',
                '#EXT-X-PLAYLIST-TYPE:EVENT',
                '#EXTINF:6.0,',
                mpegUrl,
                '#EXT-X-ENDLIST'
            ].join('\n');
            return res.send(hlsPlaylist);
        } else {
            return remuxMkvToMpegTs(url, req, res, headersArray);
        }
    }

    if (req.query.remux === 'mpegts' || req.query.type === 'mpegts') {
        return remuxMkvToMpegTs(url, req, res, headersArray);
    }

    // Instant RAM Cache Hit (<1ms) for prefetched or cached segments
    if (hlsSegmentCache.has(url)) {
        const cached = hlsSegmentCache.get(url)!;
        if (cached.expiresAt > Date.now()) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', cached.contentType);
            res.setHeader('Content-Length', cached.buffer.length);
            res.setHeader('X-Cache', 'RAM-HIT');
            trackBandwidth(cached.buffer.length);
            return res.send(cached.buffer);
        }
    }

    const isLiveTs = lowerUrlCheck.includes('/live/') || lowerUrlCheck.includes('/play/') || lowerUrlCheck.includes('.ts') || (!lowerUrlCheck.includes('.mp4') && !lowerUrlCheck.includes('.mkv') && !lowerUrlCheck.includes('.avi'));
    if (req.headers.range && !isLiveTs) {
        headers['Range'] = req.headers.range as string;
    }

    for (const h of headersArray) {
        const colonIndex = h.indexOf(':');
        if (colonIndex !== -1) {
            const key = h.substring(0, colonIndex).trim();
            const val = h.substring(colonIndex + 1).trim();
            const lowKey = key.toLowerCase();
            if (lowKey !== 'host' && lowKey !== 'connection') {
                headers[key] = val;
            }
        }
    }

    if (lowerUrlCheck.includes('tiktokcdn') || lowerUrlCheck.includes('byteoversea') || lowerUrlCheck.includes('ibytedtos')) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
        headers['Referer'] = 'https://callistanise.com/';
        headers['Origin'] = 'https://callistanise.com';
        headers['Accept'] = '*/*';
        delete headers['Authorization'];
        delete headers['authorization'];
        delete headers['Cookie'];
        delete headers['cookie'];
        delete headers['X-User-Agent'];
        delete headers['x-user-agent'];
    } else if (lowerUrlCheck.includes('judiaslevels') || lowerUrlCheck.includes('embeds.gay') || lowerUrlCheck.includes('ehgembxe') || lowerUrlCheck.includes('exmxbxe')) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        headers['Referer'] = 'https://ehgembxe.cfd/';
        headers['Origin'] = 'https://ehgembxe.cfd';
        headers['Accept'] = '*/*';
        delete headers['Authorization'];
        delete headers['authorization'];
        delete headers['Cookie'];
        delete headers['cookie'];
        delete headers['X-User-Agent'];
        delete headers['x-user-agent'];
    } else if (lowerUrlCheck.includes('timst') || lowerUrlCheck.includes('hundxvision') || lowerUrlCheck.includes('casadenoval') || lowerUrlCheck.includes('diffevixed') || lowerUrlCheck.includes('vilevodules') || lowerUrlCheck.includes('hiveatick') || lowerUrlCheck.includes('cdx-08192') || lowerUrlCheck.includes('epidd') || lowerUrlCheck.includes('epiembeds') || lowerUrlCheck.includes('embedindia')) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        headers['Referer'] = 'https://timst.top/';
        headers['Origin'] = 'https://timst.top';
        headers['Accept'] = '*/*';
        delete headers['Authorization'];
        delete headers['authorization'];
        delete headers['Cookie'];
        delete headers['cookie'];
        delete headers['X-User-Agent'];
        delete headers['x-user-agent'];
    }

    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=86400, max=1000000');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (res.socket) {
        res.socket.setKeepAlive(true, 10000);
        res.socket.setNoDelay(true);
    }

    if (req.query.download === '1') {
        const rawTitle = (req.query.title as string) || 'video_media';
        const safeTitle = rawTitle.replace(/[^a-zA-Z0-9_\-\. ]/g, '_').trim();
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
    }

    try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? require('https') : require('http');

        const requestOptions = {
            method: 'GET',
            headers: headers,
            agent: isHttps ? agent : httpAgent,
            timeout: 86400000 // 24 hours for continuous long live streams
        };

        const proxyReq = client.request(url, requestOptions, (proxyRes: any) => {
            if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                let redirectUrl = proxyRes.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    try {
                        redirectUrl = new URL(redirectUrl, url).toString();
                    } catch (e) {}
                }
                console.log(`[PROXY] Stream redirect (${proxyRes.statusCode}) from ${url} -> ${redirectUrl}`);
                
                if (redirectUrl.includes('/error/expired') || redirectUrl.includes('expired.mpd') || redirectUrl.includes('error.m3u8')) {
                    console.log(`[PROXY] Blocked redirect to expired/error stream: ${redirectUrl}`);
                    if (!res.headersSent) {
                        res.status(404).send('Stream Expired or Denied');
                    }
                    proxyReq.destroy();
                    return;
                }
                
                // Transparent proxying for browser web players (Hls.js CORS compliance)
                if (redirectUrl.includes('sunnxt.com')) {
                    if (!res.headersSent) {
                        res.redirect(302, redirectUrl);
                    }
                    if (proxyReq && typeof proxyReq.destroy === 'function') {
                        proxyReq.destroy();
                    }
                    return;
                }

                if (redirectUrl.includes('timst') || redirectUrl.includes('exmxbxe') || redirectUrl.includes('hundxvision') || redirectUrl.includes('tiktokcdn') || redirectUrl.includes('casadenoval') || redirectUrl.includes('diffevixed') || redirectUrl.includes('vilevodules') || redirectUrl.includes('hiveatick') || redirectUrl.includes('cdx-08192') || redirectUrl.includes('epidd') || redirectUrl.includes('epiembeds') || redirectUrl.includes('embedindia')) {
                    headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:') && !h.toLowerCase().startsWith('referer:') && !h.toLowerCase().startsWith('origin:'));
                    headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                    headersArray.push('Referer: https://timst.top/');
                    headersArray.push('Origin: https://timst.top');
                    headersArray.push('Accept: */*');
                } else if (redirectUrl.includes('slivcdn.com') || redirectUrl.includes('dishmt.com') || redirectUrl.includes('kliv.in') || url.includes('kliv.in') || redirectUrl.includes('sonyliv.com')) {
                    headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:') && !h.toLowerCase().startsWith('referer:') && !h.toLowerCase().startsWith('origin:'));
                    headersArray.push('User-Agent: VLC/3.0.18');
                    headersArray.push('Referer: https://kliv.in/');
                    headersArray.push('Origin: https://kliv.in/');
                    headersArray.push('Accept: */*');
                }
                return streamUrl(redirectUrl, headersArray, req, res);
            }

            const lowerUrl = url.toLowerCase();
            const actualContentType = (proxyRes.headers['content-type'] || '').toLowerCase();
            
            const isMediaChunk = lowerUrl.includes('.ts') || lowerUrl.includes('.m4s') || lowerUrl.includes('.m3u8') || lowerUrl.includes('.mpd') || lowerUrl.includes('.image') || lowerUrl.includes('tiktokcdn') || lowerUrl.includes('junksonus') || lowerUrl.includes('.key') || !!req.query.cassie || !!req.query.wanda;
            
            // SSRF Protection: Prevent Open Proxying of web pages and API data
            if (!isMediaChunk && (actualContentType.includes('text/html') || actualContentType.includes('application/json'))) {
                console.warn(`[PROXY SSRF Protection] Blocked attempt to proxy non-media content from ${url}`);
                if (!res.headersSent) {
                    res.status(403).send('Access Denied: Stream Proxy cannot be used to fetch HTML or JSON content.');
                }
                proxyReq.destroy();
                return;
            }

            const isHlsSegmentUrl = !!req.query.cassie || lowerUrl.includes('.ts') || lowerUrl.includes('.m4s') || lowerUrl.includes('.aac') || lowerUrl.includes('/segment') || lowerUrl.includes('hundxvision') || lowerUrl.includes('diffevixed') || lowerUrl.includes('casadenoval') || lowerUrl.includes('exmxbxe') || actualContentType.includes('image/');
            const isLiveStream = isHlsSegmentUrl || lowerUrl.includes('/live/') || lowerUrl.includes('/play/');

            let contentType = proxyRes.headers['content-type'];
            if (isHlsSegmentUrl || !contentType || contentType === 'application/octet-stream' || contentType.includes('image/') || contentType.includes('text/plain') || contentType.includes('text/html')) {
                if (lowerUrl.includes('.m4s') || lowerUrl.includes('.mp4')) contentType = 'video/mp4';
                else if (lowerUrl.includes('.mkv')) contentType = 'video/x-matroska';
                else if (lowerUrl.includes('.avi')) contentType = 'video/x-msvideo';
                else if (lowerUrl.includes('.aac')) contentType = 'audio/aac';
                else if (lowerUrl.includes('.vtt')) contentType = 'text/vtt';
                else if (lowerUrl.includes('.mp3')) contentType = 'audio/mpeg';
                else if (lowerUrl.includes('.m4a')) contentType = 'audio/mp4';
                else contentType = 'video/mp2t';
            }
            if (contentType) res.setHeader('content-type', contentType);

            const contentLength = proxyRes.headers['content-length'];
            if (!isLiveStream && !isHlsSegmentUrl && contentLength) {
                res.setHeader('content-length', contentLength);
            } else {
                res.setHeader('connection', 'keep-alive');
            }

            const contentRange = proxyRes.headers['content-range'];
            if (contentRange) res.setHeader('content-range', contentRange);

            const acceptRanges = proxyRes.headers['accept-ranges'] || 'bytes';
            res.setHeader('accept-ranges', acceptRanges);

            if (proxyRes.statusCode === 206) {
                res.status(206);
            } else if (proxyRes.statusCode >= 400) {
                console.warn(`[PROXY] Upstream ${url} returned ${proxyRes.statusCode}`);
                res.status(proxyRes.statusCode);
            } else {
                res.status(proxyRes.statusCode || 200);
            }

            const useFmp4 = req.query.fm4 === '1' || req.query.fmp4 === '1';
            
            if (useFmp4 && (contentType === 'video/mp2t' || isLiveStream)) {
                res.setHeader('content-type', 'video/mp2t');
                console.log("[PROXY] Transcoding TS stream audio to AAC on the fly");
                
                const ffmpeg = require('child_process').spawn('ffmpeg', [
                    '-fflags', '+genpts+discardcorrupt+nobuffer',
                    '-flags', 'low_delay',
                    '-analyzeduration', '1000000',
                    '-probesize', '1000000',
                    '-thread_queue_size', '1024',
                    '-i', 'pipe:0',
                    '-map', '0:v:0?',
                    '-map', '0:a:0?',
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-ac', '2',
                    '-ar', '48000',
                    '-b:a', '128k',
                    '-async', '1',
                    '-f', 'mpegts',
                    '-flush_packets', '1',
                    '-mpegts_flags', '+initial_discontinuity',
                    'pipe:1'
                ]);

                proxyRes.pipe(ffmpeg.stdin);
                ffmpeg.stdout.pipe(res);
                
                ffmpeg.stderr.on('data', (data: any) => {
                    // console.log(`[FFMPEG] ${data}`);
                });

                ffmpeg.on('close', () => {
                    res.end();
                });
                
                req.on('close', () => {
                    ffmpeg.kill('SIGKILL');
                    proxyReq.destroy();
                });
                
                return;
            }

            // Dynamic Activity-based watchdog: Keeps stream alive indefinitely (6+ hours) as long as chunks flow
            let idleTimer: NodeJS.Timeout | null = null;
            const resetIdleWatchdog = () => {
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                    console.warn('[PROXY] Stream inactivity timeout (60s no data received) for:', url);
                    proxyReq.destroy();
                }, 60000);
            };
            resetIdleWatchdog();

            const cleanupProxy = () => {
                if (idleTimer) {
                    clearTimeout(idleTimer);
                    idleTimer = null;
                }
                if (!proxyReq.destroyed) {
                    proxyReq.destroy();
                }
            };

            req.on('close', cleanupProxy);
            res.on('close', cleanupProxy);

            proxyRes.on('error', (err: any) => {
                cleanupProxy();
                console.error('Error streaming chunk:', err?.message || 'No error message');
                if (!res.headersSent) {
                    res.status(502).send('Streaming chunk failed');
                }
            });

            res.on('error', (err: any) => {
                cleanupProxy();
                console.error('Client response error:', err?.message || 'Unknown');
            });

            let firstChunk = true;
            const segmentChunks: Buffer[] = [];
            let totalSegmentSize = 0;
            const isTsSegment = isHlsSegmentUrl && !lowerUrl.includes('.m4s') && !lowerUrl.includes('.mp4') && !lowerUrl.includes('.vtt');
            let initialBuffer = Buffer.alloc(0);
            let headerCleaned = false;

            proxyRes.on('data', (chunk: Buffer) => {
                resetIdleWatchdog();
                if (firstChunk) {
                    firstChunk = false;
                    // Check for fake "200 OK" responses that actually contain plain text errors like "not found"
                    if (isLiveStream && chunk.length < 100 && chunk.toString('utf8').toLowerCase().includes('not found')) {
                        console.warn(`[PROXY] Blocked fake 200 response containing "not found" from ${url}`);
                        cleanupProxy();
                        if (!res.headersSent) {
                            res.status(404).send('Segment Not Found at Source');
                        }
                        return;
                    }
                }

                if (isTsSegment && !headerCleaned) {
                    initialBuffer = Buffer.concat([initialBuffer, chunk]);
                    // Accumulate at least 1024 bytes so cleanTsBuffer can reliably detect and strip fake headers
                    if (initialBuffer.length >= 1024) {
                        headerCleaned = true;
                        const cleaned = cleanTsBuffer(initialBuffer);
                        const cleanedBuf = cleaned.buffer;
                        res.write(cleanedBuf);
                        if (totalSegmentSize < 15 * 1024 * 1024) {
                            segmentChunks.push(cleanedBuf);
                            totalSegmentSize += cleanedBuf.length;
                        }
                    }
                    return;
                }

                if (isHlsSegmentUrl && totalSegmentSize < 15 * 1024 * 1024) {
                    segmentChunks.push(chunk);
                    totalSegmentSize += chunk.length;
                }
                res.write(chunk);
            });

            proxyRes.on('end', () => {
                if (idleTimer) {
                    clearTimeout(idleTimer);
                    idleTimer = null;
                }
                if (isTsSegment && !headerCleaned && initialBuffer.length > 0) {
                    headerCleaned = true;
                    const cleaned = cleanTsBuffer(initialBuffer);
                    const cleanedBuf = cleaned.buffer;
                    res.write(cleanedBuf);
                    if (totalSegmentSize < 15 * 1024 * 1024) {
                        segmentChunks.push(cleanedBuf);
                        totalSegmentSize += cleanedBuf.length;
                    }
                }
                if (isHlsSegmentUrl && segmentChunks.length > 0 && proxyRes.statusCode === 200 && totalSegmentSize <= 15 * 1024 * 1024) {
                    let fullBuf = Buffer.concat(segmentChunks);
                    let finalContentType = contentType || 'video/mp2t';
                    if (isTsSegment) {
                        const cleaned = cleanTsBuffer(fullBuf);
                        fullBuf = Buffer.from(cleaned.buffer) as any;
                        finalContentType = 'video/mp2t';
                    }
                    hlsSegmentCache.set(url, {
                        buffer: fullBuf,
                        contentType: finalContentType,
                        expiresAt: Date.now() + 90000 // 90s TTL
                    });
                }
                res.end();
            });
        });

        proxyReq.on('timeout', () => {
            console.error('[PROXY] Request connection timeout:', url);
            proxyReq.destroy();
            if (!res.headersSent) res.status(504).send('Gateway Timeout');
        });

        proxyReq.on('error', (err: any) => {
            console.error('Proxy request to chunk failed:', err.message);
            if (!res.headersSent) {
                res.status(502).send('Proxy stream failed: ' + err.message);
            }
        });

        proxyReq.end();
    } catch (e: any) {
        console.error('Proxy setup failed:', e.message);
        if (!res.headersSent) {
            res.status(502).send('Proxy stream setup failed: ' + e.message);
        }
    }
}

/**
 * Buttery-smooth on-the-fly MKV/Direct to MPEG-TS stream pipeline via FFmpeg.
 * Copies video bitstream directly without transcoding (0% loss, full 60fps), remuxes audio to standard AAC stereo.
 */
export function remuxMkvToMpegTs(streamUrl: string, req: Request, res: Response, headersArray: string[] = []) {
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=86400, max=1000000');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.socket) {
        res.socket.setKeepAlive(true, 10000);
        res.socket.setNoDelay(true);
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = Array.isArray(clientIp) ? clientIp[0] : (clientIp as string).replace('::ffff:', '');
    addStreamingIp(cleanIp);
    trackClientIpActivity(cleanIp, req.headers['user-agent'] as string || '', true);

    const refererHeader = headersArray.find(h => h.toLowerCase().startsWith('referer:'));
    const uaHeader = headersArray.find(h => h.toLowerCase().startsWith('user-agent:'));

    const ffmpegArgs: string[] = [
        '-reconnect', '1',
        '-reconnect_at_eof', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '2',
        '-rw_timeout', '30000000',
        '-fflags', '+genpts+discardcorrupt+nobuffer',
        '-avoid_negative_ts', 'make_zero',
        '-analyzeduration', '3000000',
        '-probesize', '3000000'
    ];

    if (refererHeader || uaHeader) {
        let headersStr = '';
        if (refererHeader) headersStr += refererHeader + "\r\n";
        if (uaHeader) headersStr += uaHeader + "\r\n";
        ffmpegArgs.push('-headers', headersStr);
    }

    ffmpegArgs.push('-i', streamUrl);

    // Stream-copy video directly for 0% CPU loss and buttery-smooth 60fps
    // Transcode audio to standard AAC stereo with 192k bitrate for universal browser decoding
    ffmpegArgs.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ac', '2',
        '-f', 'mpegts',
        '-muxdelay', '0',
        '-muxpreload', '0',
        'pipe:1'
    );

    console.log(`[MPEG Remux Engine] Launching buttery-smooth MPEG-TS pipeline for: ${streamUrl}`);
    const ff = spawn('ffmpeg', ffmpegArgs);

    ff.stdout.on('data', (chunk: Buffer) => {
        trackBandwidth(chunk.length);
    });

    ff.stdout.pipe(res);

    ff.on('error', (err: any) => {
        console.error('[MPEG Remux Engine Error]:', err?.message || err);
        if (!res.headersSent) {
            res.status(502).send('MPEG-TS remux stream error: ' + (err?.message || 'Unknown'));
        }
    });

    req.on('close', () => {
        removeStreamingIp(cleanIp);
        try {
            ff.kill('SIGKILL');
        } catch (e) {}
    });
}

const embedCache = new Map<string, { url: string, time: number }>();
const manifestCache = new Map<string, { content: string, contentType: string, time: number }>();

export function clearManifestCache() {
    manifestCache.clear();
}

let cachedChannelsJson: any[] | null = null;
function getCachedChannelsJson(): any[] {
    if (cachedChannelsJson && cachedChannelsJson.length > 0) return cachedChannelsJson;
    try {
        const p = path.resolve(process.cwd(), 'assets/channels.json');
        if (fs.existsSync(p)) {
            cachedChannelsJson = JSON.parse(fs.readFileSync(p, 'utf8'));
            return cachedChannelsJson || [];
        }
    } catch (e) {}
    return [];
}

export function findFallbackFromChannelsJson(rawName: string): any | null {
    if (!rawName) return null;
    const channels = getCachedChannelsJson();
    if (!channels || !channels.length) return null;

    // 0. Channel ID match (e.g. "asianet-hd" or "airtel-8420")
    for (const c of channels) {
        if (c.channel_id && c.channel_id.toLowerCase() === rawName.toLowerCase()) return c;
    }

    const clean = rawName
        .replace(/^(IN\s*\|\s*|AMAIRA\s*[A-Z]+\s*\|\s*|UK\s*\|\s*|[A-Z]+\s*-\s*)/i, '')
        .replace(/\[.*?\]/g, '')
        .trim()
        .toLowerCase();

    // 1. Exact match (case insensitive)
    for (const c of channels) {
        const cClean = (c.name || '').replace(/\[.*?\]/g, '').trim().toLowerCase();
        if (cClean === clean) return c;
    }

    // 2. All words match (e.g. "asianet" and "hd")
    const words = clean.split(/\s+/).filter(w => w.length > 2 && !['and', 'the', 'for'].includes(w));
    if (words.length > 0) {
        for (const c of channels) {
            const cClean = (c.name || '').replace(/\[.*?\]/g, '').trim().toLowerCase();
            if (words.every(w => cClean.includes(w))) return c;
        }
    }

    return null;
}

export async function handleLiveStream(req: Request, res: Response) {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ip = Array.isArray(clientIp) ? clientIp[0] : (clientIp as string);
    const cleanIp = ip ? ip.replace('::ffff:', '') : '0.0.0.0';

    let req_id = (req.query.id as string) || (req.query.url as string);
    const channelName = (req.query.name as string) || '';
    const channelId = (req.query.channel_id as string) || '';
    
    let stream = '';

    if (req_id) {
        req_id = req_id.replace(/^ffmpeg\s+/i, '').replace(/^ffrt\s+/i, '').trim();
    }

    // Smart Fallback and direct resolution for Airtel or known named channels
    if (req_id && (req_id.startsWith('airtel-') || req_id.startsWith('airtel_') || channelId.startsWith('airtel-') || req_id.includes('yolomax.pro'))) {
        try {
            const targetName = channelName || channelId || (req_id.startsWith('airtel-') ? req_id : '');
            if (targetName) {
                const fallback = findFallbackFromChannelsJson(targetName);
                if (fallback && fallback.stream_url && !fallback.stream_url.includes('yolomax.pro')) {
                    console.log(`[Airtel Smart Fallback] Resolved "${targetName}" to authoritative stream: ${fallback.stream_url}`);
                    return res.redirect(302, fallback.stream_url);
                }
            }
            const airtelId = (req_id.startsWith('airtel-') || req_id.startsWith('airtel_')) ? req_id : (channelId.startsWith('airtel-') || channelId.startsWith('airtel_') ? channelId : '');
            if (airtelId) {
                const resolved = await resolveAirtelStream(airtelId);
                if (resolved) {
                    const resAny = resolved as any;
                    if (resAny.resolved_stream && !resAny.resolved_stream.includes('yolomax.pro')) {
                        return res.redirect(302, resAny.resolved_stream);
                    }
                    if (resolved.stream_url) {
                        return res.redirect(302, `/live.php?token=STALKER_PRO&id=${encodeURIComponent(airtelId)}&m3u=1`);
                    }
                }
            }
            if (req_id.includes('yolomax.pro')) {
                return res.redirect(302, `/live.php?token=STALKER_PRO&id=${encodeURIComponent(req_id)}&m3u=1`);
            }
        } catch (e) {
            console.warn('[handleLiveStream] Airtel resolution fallback error:', e);
        }
    }

    if (req_id && (req_id.startsWith('/api/proxy/hls') || req_id.startsWith('/proxy') || req_id.startsWith('/stream_proxy.php'))) {
        return res.redirect(302, req_id);
    }

    // External CDNs that permit direct browser playback or firewall datacenter IP ranges:
    // Immediately redirect client directly to target stream so client's residential connection fetches it with 0ms delay.
    if (req_id && (req_id.includes('cloudmelvaro') || req_id.includes('cdnvideo') || req_id.includes('fragrancecdn') || req_id.includes('cheaptruckrepairs.cc') || req_id.includes('api.framextv.tech'))) {
        return res.redirect(302, req_id);
    }

    if (req_id && (req_id.startsWith('jtv-') || req_id.startsWith('mdtv-') || req_id.startsWith('jtv_') || req_id.startsWith('mdtv_'))) {
        try {
            const ch = await JtvService.resolveChannel(req_id);
            if (ch && (ch.manifest_url || ch.full_stream_url || ch.stream_url)) {
                return res.redirect(302, ch.manifest_url || ch.full_stream_url || ch.stream_url);
            }
        } catch (e) {}
    }

    if (req_id && (
        req_id.startsWith('fancode-') || req_id.startsWith('fancode_') || req_id.startsWith('fc-') ||
        (req_id.startsWith('http') && (req_id.includes('fancode') || req_id.includes('flive') || req_id.includes('dai-fancode')))
    )) {
        try {
            if (req_id.startsWith('http://') || req_id.startsWith('https://')) {
                return res.redirect(302, wrapFanCodeProxyUrl(req_id));
            }
            const ev = await JtvService.resolveEvent(req_id);
            const target = ev?.full_stream_url || ev?.stream_url || ev?.manifest_url;
            if (target) {
                return res.redirect(302, wrapFanCodeProxyUrl(target));
            }
            const { live, all } = await fetchFanCodeEvents();
            const cleanId = req_id.replace(/^(?:fancode|fc)[-_]?/i, '');
            const match = live.find(e => String(e.matchId) === cleanId || e.id === req_id) ||
                          all.find(e => String(e.matchId) === cleanId || e.id === req_id);
            if (match && match.streamUrl) {
                return res.redirect(302, wrapFanCodeProxyUrl(match.streamUrl));
            }
        } catch (e) {}
    }

    if (req_id && (req_id.startsWith('sonyliv-') || req_id.startsWith('sonyliv_') || req_id.startsWith('sliv-'))) {
        try {
            const ev = await JtvService.resolveEvent(req_id);
            let target = ev?.stream_url || ev?.full_stream_url || ev?.manifest_url;
            if (target && !target.includes('/live.php') && (target.startsWith('http://') || target.startsWith('https://'))) {
                req_id = target;
            } else {
                const { live, all } = await fetchSonyLivEvents();
                const cleanId = req_id.replace(/^(?:sonyliv|sliv)[-_]?/i, '');
                const match = live.find(e => String(e.contentId) === cleanId || e.id === req_id || String(e.contentId).split('_')[0] === cleanId.split('_')[0]) ||
                              all.find(e => String(e.contentId) === cleanId || e.id === req_id || String(e.contentId).split('_')[0] === cleanId.split('_')[0]);
                if (match) {
                    const bChan = (match.broadcastChannel || '').toLowerCase();
                    if (bChan.includes('ten 1') || bChan.includes('sports 1')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1');
                    if (bChan.includes('ten 2') || bChan.includes('sports 2')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1');
                    if (bChan.includes('ten 3') || bChan.includes('sports 3')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1');
                    if (bChan.includes('ten 4') || bChan.includes('sports 4') || bChan.includes('six')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1');
                    if (bChan.includes('ten 5') || bChan.includes('sports 5')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1');

                    if (match.streamUrl && (match.streamUrl.startsWith('http://') || match.streamUrl.startsWith('https://'))) {
                        req_id = match.streamUrl;
                    }
                }
            }
        } catch (e) {}
    }
    
    if (req_id && (req_id.includes('exmxbxe.cfd/') || req_id.includes('timst.top/') || req_id.includes('epiembeds.online/embed/') || req_id.includes('embedindia.st/embed/'))) {
        if (!await isSafeUrl(req_id)) {
            return res.status(403).send('Access Denied: Unsafe URL detected.');
        }
        const cached = embedCache.get(req_id);
        if (cached && Date.now() - cached.time < 60 * 1000) {
            req_id = cached.url;
        } else {
            try {
                const original_req_id = req_id;
                let targetUrl = req_id;
                if (req_id.includes('epiembeds.online') || req_id.includes('embedindia.st')) {
                    const embedSlugMatch = req_id.match(/\/embed\/([a-zA-Z0-9_-]+)/);
                    targetUrl = embedSlugMatch ? `https://epiembeds.online/embed/${embedSlugMatch[1]}` : req_id;
                }
                const m3u8Found = await resolveEmbedUrl(targetUrl);
                if (m3u8Found) {
                    req_id = m3u8Found;
                    embedCache.set(original_req_id, { url: req_id, time: Date.now() });
                }
            } catch (err) {
                console.info("Embed resolution failed in proxy:", err);
            }
        }
    }
    
    if (req_id && req_id.startsWith('xtream_')) {
        return res.status(400).send('Xtream Codes streams must be routed via xtream.php');
    }

    const wanda = req.query.wanda as string;
    const cassie = req.query.cassie as string;
    const isTimOrExternal = (req_id && (
        req_id.startsWith('tim_') || req_id.startsWith('tim-') ||
        req_id.startsWith('embed-') || req_id.startsWith('embed_') ||
        req_id.startsWith('embedindia') || req_id.startsWith('247-') ||
        req_id.startsWith('event_') || req_id.includes('-v-') ||
        req_id.startsWith('dlhd') || req_id.startsWith('http://') ||
        req_id.startsWith('https://') || req_id.match(/^[a-z0-9]{6,12}-\d+$/) ||
        req_id.startsWith('airtel-') || req_id.startsWith('airtel_') ||
        req_id.startsWith('fancode-') || req_id.startsWith('fancode_') || req_id.startsWith('fc-') ||
        req_id.startsWith('sonyliv-') || req_id.startsWith('sonyliv_') || req_id.startsWith('sliv-') ||
        req_id.startsWith('jtv-') || req_id.startsWith('mdtv-') ||
        req_id.startsWith('jtv_') || req_id.startsWith('mdtv_')
    ));
    const m3u_mode = req.query.m3u === '1' || !!wanda || !!cassie || !!isTimOrExternal;

    if (m3u_mode && !features.m3uEnabled && !isTimOrExternal) {
        return res.status(403).send('M3U streaming is currently disabled by administrator.');
    }
    if (!m3u_mode && !features.stalkerEnabled) {
        return res.status(403).send('Stalker portal streaming is currently disabled by administrator.');
    }

    let headersArray = [
        'User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'Connection: Keep-Alive'
    ];

    const portal = isTimOrExternal ? null : StalkerAPI.getActivePortal(req);
    if (m3u_mode) {
        headersArray = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Connection: Keep-Alive'
        ];
        let urlToCheck = req_id || '';
        if (!urlToCheck && wanda) urlToCheck = StalkerAPI.scarletWitch('decrypt', wanda);
        if (!urlToCheck && cassie) urlToCheck = StalkerAPI.scarletWitch('decrypt', cassie);
        if (urlToCheck && (urlToCheck.includes('phantemlis') || urlToCheck.includes('romponalis') || urlToCheck.includes('dlhd') || urlToCheck.includes('daddylive') || urlToCheck.includes('premiumtv') || urlToCheck.includes('xameleon'))) {
            headersArray.push('Referer: https://hamis.romponalis.st/');
            headersArray.push('Origin: https://hamis.romponalis.st/');
        } else if (urlToCheck && (urlToCheck.includes('dramiyos') || urlToCheck.includes('morencius') || urlToCheck.includes('movies4u') || urlToCheck.includes('acek-cdn') || urlToCheck.includes('cloudmelvaro') || urlToCheck.includes('callistanise') || urlToCheck.includes('vidhidefast') || urlToCheck.includes('vidhidevip') || urlToCheck.includes('vidhidepre') || urlToCheck.includes('m4uplay') || urlToCheck.includes('vidhide') || urlToCheck.includes('streamhide') || urlToCheck.includes('filelions'))) {
            headersArray.push('Referer: https://callistanise.com/');
            headersArray.push('Origin: https://callistanise.com');
        } else if (urlToCheck && (urlToCheck.includes('judiaslevels') || urlToCheck.includes('embeds.gay') || urlToCheck.includes('ehgembxe') || urlToCheck.includes('exmxbxe'))) {
            headersArray.push('Referer: https://ehgembxe.cfd/');
            headersArray.push('Origin: https://ehgembxe.cfd');
            headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        } else if (urlToCheck && (urlToCheck.includes('timstreams') || urlToCheck.includes('timst') || urlToCheck.includes('casadenoval') || urlToCheck.includes('cdx-08192') || urlToCheck.includes('hiveatick') || urlToCheck.includes('vilevodules') || urlToCheck.includes('diffevixed') || urlToCheck.includes('hundxvision') || urlToCheck.includes('epidd') || urlToCheck.includes('tiktokcdn') || urlToCheck.includes('epiembeds') || urlToCheck.includes('embedindia'))) {
            headersArray.push('Referer: https://timst.top/');
            headersArray.push('Origin: https://timst.top');
            headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        } else if (urlToCheck && (urlToCheck.includes('fancode') || urlToCheck.includes('flive') || urlToCheck.includes('dai-fancode'))) {
            headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:'));
            headersArray.push('User-Agent: VLC/3.0.21 LibVLC/3.0.21 (Android; Mobile)');
            headersArray.push('Referer: https://fancode.com/');
            headersArray.push('Origin: https://fancode.com');
        } else if (urlToCheck && (urlToCheck.includes('sonydaimenew') || urlToCheck.includes('akamaized.net') || urlToCheck.includes('sonymtmnew') || urlToCheck.includes('sonyliv'))) {
            headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:'));
            headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0');
            headersArray.push('Referer: https://www.sonyliv.com/');
            headersArray.push('Origin: https://www.sonyliv.com');
            headersArray.push('x-playback-session-id: d41d93298b2cc00eafdeb0c6e9992b20-1790706000927');
        } else if (urlToCheck && (urlToCheck.includes('kliv.in') || urlToCheck.includes('slivcdn.com') || urlToCheck.includes('dishmt.com') || urlToCheck.includes('sonyliv.com'))) {
            headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:'));
            headersArray.push('User-Agent: VLC/3.0.18');
            headersArray.push('Referer: https://kliv.in/');
            headersArray.push('Origin: https://kliv.in/');
            headersArray.push('Accept: */*');
        } else if (urlToCheck && (urlToCheck.includes('fragrancecdn') || urlToCheck.includes('cdnvideo') || urlToCheck.includes('kisskh'))) {
            headersArray.push('Referer: https://kisskh.co/');
            headersArray.push('Origin: https://kisskh.co');
        }

        const customRef = (req.query.referer as string) || (req.query.ref as string);
        if (customRef) {
            headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('referer:') && !h.toLowerCase().startsWith('origin:'));
            headersArray.push(`Referer: ${customRef}`);
            try {
                const u = new URL(customRef);
                headersArray.push(`Origin: ${u.protocol}//${u.host}`);
            } catch(e) {}
        }
    } else if (portal) {
        if (portal.Model) headersArray.push(`X-User-Agent: Model: ${portal.Model}; Link: WiFi`);
        if (portal.URL) headersArray.push(`Referer: ${portal.URL}/c/`);
        if (portal.MAC) headersArray.push(`Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`);
        
        // Retrieve active Stalker bearer token if it exists
        const host_id = StalkerAPI.getHostId(portal);
        const tokenFile = path.join(process.cwd(), 'doctor_strange', `token_${host_id}.stalker`);
        const legacyTokenFile = path.join(process.cwd(), 'doctor_strange', 'token.stalker');
        
        let tokenToUse = '';
        if (fs.existsSync(tokenFile)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
                tokenToUse = tokenData?.STALKER?.Token;
            } catch (e) {}
        }
        
        if (!tokenToUse && fs.existsSync(legacyTokenFile)) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(legacyTokenFile, 'utf8'));
                tokenToUse = tokenData?.STALKER?.Token;
            } catch (e) {}
        }

        if (tokenToUse) {
            headersArray.push(`Authorization: Bearer ${tokenToUse}`);
        }
    }

    let custom_ua = req.query['http-user-agent'] as string || '';
    if (custom_ua) {
        headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:'));
        headersArray.push(`User-Agent: ${custom_ua}`);
    }

    
    const token = req.query.token as string;

    
    if (wanda && (token === 'STALKER_PRO' || !token || m3u_mode)) {
        let wanda_url = StalkerAPI.scarletWitch('decrypt', wanda);
        if (!wanda_url || !wanda_url.startsWith('http')) {
            return res.status(404).send('Playlist expired or not found');
        }
        let stalkerRes = await StalkerAPI.stalkerRequest(wanda_url, headersArray, 'GET', null, true);
        let content = stalkerRes.STALKER.data;
        let status_code = stalkerRes.STALKER.info.http_code;
        
        const final_wanda_url = stalkerRes.STALKER.info.final_url || wanda_url;
        wanda_url = final_wanda_url;
        console.log("WANDA STREAM:", wanda_url, "STATUS:", status_code, "CONTENT_LEN:", content.length);

        let redirectCount = 0;
        while ([301, 302, 303, 307, 308].includes(status_code) && redirectCount < 10) {
            let redirectUrl = stalkerRes.STALKER.info.redirect_url;
            if (!redirectUrl) {
                const locMatch = content.match(/Location:\s*([^\r\n]+)/i);
                if (locMatch) redirectUrl = locMatch[1].trim();
            }

            if (redirectUrl) {
                if (redirectUrl.includes('/error/expired') || redirectUrl.includes('expired.mpd') || redirectUrl.includes('error.m3u8')) {
                    console.log(`[PROXY] Blocked stalker redirect to expired stream: ${redirectUrl}`);
                    status_code = 404;
                    break;
                }
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = resolveM3u8Url(wanda_url, redirectUrl);
                }
                wanda_url = redirectUrl;
                stalkerRes = await StalkerAPI.stalkerRequest(wanda_url, headersArray, 'GET', null, true);
                content = stalkerRes.STALKER.data;
                status_code = stalkerRes.STALKER.info.http_code;
                const final_wanda_url = stalkerRes.STALKER.info.final_url || wanda_url;
                wanda_url = final_wanda_url;
                redirectCount++;
            } else {
                break;
            }
        }

        // If wanda stream returned 404/expired token and channel ID is known, attempt transparent re-resolution via cdx embed
        if (status_code !== 200 && req_id) {
            console.log(`[Proxy Auto-Refresh] Wanda stream returned HTTP ${status_code} for ID '${req_id}'. Attempting re-resolution...`);
            try {
                let timId = req_id;
                if (req_id.startsWith('dlhd-') || req_id.startsWith('dlhd_') || req_id.toLowerCase().startsWith('dlhd')) {
                     timId = req_id.replace(/^dlhd[_-]?/i, '').replace(/-/g, '').toLowerCase() + '-uk';
                } else if (req_id.startsWith('tim_') || req_id.startsWith('tim-') || req_id.startsWith('embed-') || req_id.startsWith('embedindia-') || req_id.startsWith('247-')) {
                     timId = req_id.replace(/^(tim|embed|embedindia)[_-]?/i, '');
                }
                let freshMasterUrl = await resolveTimChannel(timId) || await resolveTimChannel(req_id);

                if (freshMasterUrl) {
                    const freshMasterRes = await StalkerAPI.stalkerRequest(freshMasterUrl, headersArray, 'GET', null, true);
                    if (freshMasterRes.STALKER.info.http_code === 200 && freshMasterRes.STALKER.data) {
                        const freshMasterContent = freshMasterRes.STALKER.data;
                        if (freshMasterContent.includes('#EXT-X-STREAM-INF')) {
                            const freshVision = freshMasterUrl.substring(0, freshMasterUrl.lastIndexOf('/') + 1);
                            const lines = freshMasterContent.split('\n');
                            let freshSubUrl = '';
                            for (let l of lines) {
                                l = l.trim();
                                if (l && !l.startsWith('#')) {
                                    freshSubUrl = l.startsWith('http') ? l : resolveM3u8Url(freshVision, l);
                                    break;
                                }
                            }
                            if (freshSubUrl) {
                                wanda_url = freshSubUrl;
                                stalkerRes = await StalkerAPI.stalkerRequest(wanda_url, headersArray, 'GET', null, true);
                                content = stalkerRes.STALKER.data;
                                status_code = stalkerRes.STALKER.info.http_code;
                            }
                        } else {
                            wanda_url = freshMasterUrl;
                            content = freshMasterContent;
                            status_code = 200;
                        }
                        console.log(`[Proxy Auto-Refresh] Successfully refreshed stream level! New HTTP status: ${status_code}`);
                    }
                }
            } catch (e: any) {
                console.warn('[Proxy Auto-Refresh] Re-resolution attempt:', e?.message || e);
            }
        }

        if (wanda_url.startsWith('http') && status_code === 200) {
            const is_playlist_content = content.includes('#EXTM3U');
            if (is_playlist_content) {
                if (req.query.download === '1') {
                    return handleHlsDownload(req, res, wanda_url, headersArray);
                }
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');

                let m3u_suffix = m3u_mode ? '&m3u=1' : '';
                if (req_id) {
                    m3u_suffix += '&id=' + encodeURIComponent(req_id);
                }
                if (custom_ua) {
                    m3u_suffix += '&http-user-agent=' + encodeURIComponent(custom_ua);
                }

                const rewritten = rewriteHlsManifest(content, wanda_url, m3u_suffix);
                prefetchHlsSegments(wanda_url, content, headersArray);
                return res.send(rewritten);
            } else {
                res.setHeader('Access-Control-Allow-Origin', '*');
                const contentType = stalkerRes.STALKER.info.content_type || 'video/mp2t';
                res.setHeader('Content-Type', contentType);
                return await streamUrl(wanda_url, headersArray, req, res);
            }
        }
    }


    if (cassie && (token === 'STALKER_PRO' || !token || m3u_mode)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const decrypted_cassie = StalkerAPI.scarletWitch('decrypt', cassie);
        if (!decrypted_cassie || !decrypted_cassie.startsWith('http')) {
            return res.status(404).send('Segment expired or not found');
        }

        // Instant RAM Hit for prefetched segments (<1ms)
        if (hlsSegmentCache.has(decrypted_cassie)) {
            const cached = hlsSegmentCache.get(decrypted_cassie)!;
            if (cached.expiresAt > Date.now()) {
                res.setHeader('Content-Type', cached.contentType);
                res.setHeader('Content-Length', cached.buffer.length);
                res.setHeader('X-Cache', 'RAM-HIT');
                res.setHeader('Access-Control-Allow-Origin', '*');
                trackBandwidth(cached.buffer.length);
                return res.send(cached.buffer);
            }
        }

        try {
            const u = new URL(decrypted_cassie);
            const ext = path.extname(u.pathname).toLowerCase();

            if (ext === '.m4s' || ext === '.mp4') {
                res.setHeader('Content-Type', 'video/mp4');
            } else if (ext === '.aac') {
                res.setHeader('Content-Type', 'audio/aac');
            } else if (ext === '.vtt') {
                res.setHeader('Content-Type', 'text/vtt');
            } else {
                res.setHeader('Content-Type', 'video/mp2t');
            }
        } catch (e) {
            res.setHeader('Content-Type', 'video/mp2t');
        }

        return await streamUrl(decrypted_cassie, headersArray, req, res);
    }
    if (req_id && !wanda && !cassie) {
        // Record Activity for Live Monitor
        activeSessions.set(cleanIp, {
            ip: cleanIp,
            channelId: req_id,
            startTime: Date.now(),
            userAgent: req.headers['user-agent'] || 'Unknown',
            type: m3u_mode ? 'M3U' : 'Portal'
        });
        trackUserStreamSession({
            ip: cleanIp,
            streamId: req_id,
            userAgent: (req.headers['user-agent'] as string) || 'Unknown Player',
            type: m3u_mode ? 'M3U' : 'Portal'
        });

        let apiRes: any = null;
        // --- MAP BROKEN TEXT IDs to WORKING DLHD IDs ---
        const DLHD_MAP: Record<string, string> = {
            "sky-sports-main-event": "38",
            "sky-sports-premier-league": "130",
            "sky-sports-football": "35",
            "sky-sports-f1": "60",
            "sky-sports-cricket": "65",
            "tnt-sports-1": "31",
            "tnt-sports-2": "32",
            "tnt-sports-3": "33",
            "tnt-sports-4": "34",
            "bein-sports-1": "91",
            "bein-sports-2": "92",
            "espn": "44",
            "espn2": "386",
            "fox-sports-1": "39",
            "fox-sports-2": "758",
            "dazn-1": "230",
            "willow-hd": "346",
            "willow": "346",
            "willow-2": "346",
            "willow2": "346",
            "247-willow-2": "346",
            "embed-247-willow-2": "346",
            "sony-ten-1": "885",
            "sony-ten-2": "886",
            "star-sports-1": "267",
            "eurosport-1": "41",
            "wwe-network": "376",
            "skysportsmainevent": "38",
            "skysportspremierleague": "130",
            "skysportsfootball": "35",
            "skysportsf1": "60",
            "skysportscricket": "65",
            "tntsports1": "31",
            "tntsports2": "32",
            "tntsports3": "33",
            "tntsports4": "34",
            "beinsports1": "91",
            "beinsports2": "92",
            "foxsports1": "39",
            "foxsports2": "758",
            "dazn1": "230",
            "willowhd": "346",
            "sonyten1": "885",
            "sonyten2": "886",
            "starsports1": "267",
            "eurosport1": "41",
            "wwenetwork": "376"
        };
        let extracted = req_id.replace(/^dlhd[_-]?/i, '').toLowerCase();
        // --------------------------------------------------
        if (req_id.startsWith('http://') || req_id.startsWith('https://')) {
            if (!await isSafeUrl(req_id)) {
                return res.status(403).send('Access Denied: Unsafe URL detected.');
            }
            stream = req_id;
        } else if (!wanda && !cassie && (req_id.startsWith('jtv-') || req_id.startsWith('mdtv-') || req_id.startsWith('jtv_') || req_id.startsWith('mdtv_'))) {
            const cleanId = req_id.replace(/^(?:jtv|mdtv)[_-]?/i, '');
            try {
                const ch = await JtvService.resolveChannel(cleanId);
                if (ch && (ch.manifest_url || ch.full_stream_url)) {
                    return res.redirect(302, ch.manifest_url || ch.full_stream_url);
                }
            } catch (e: any) {
                console.error('[JTV Proxy] Failed to resolve channel:', cleanId, e?.message);
            }
        } else if (!wanda && !cassie && (req_id.startsWith('fancode-') || req_id.startsWith('fancode_') || req_id.startsWith('fc-'))) {
            try {
                const ev = await JtvService.resolveEvent(req_id);
                if (ev && (ev.manifest_url || ev.full_stream_url || ev.stream_url)) {
                    return res.redirect(302, ev.manifest_url || ev.full_stream_url || ev.stream_url);
                }
                const { live, all } = await fetchFanCodeEvents();
                const cleanId = req_id.replace(/^(?:fancode|fc)[-_]?/i, '');
                const match = live.find(e => String(e.matchId) === cleanId || e.id === req_id) ||
                              all.find(e => String(e.matchId) === cleanId || e.id === req_id);
                if (match && match.streamUrl) {
                    return res.redirect(302, `/api/live/manifest/${req_id}.m3u8`);
                }
            } catch (e: any) {
                console.error('[FanCode Proxy] Failed to resolve event:', req_id, e?.message);
            }
        } else if (!wanda && !cassie && (req_id.startsWith('sonyliv-') || req_id.startsWith('sonyliv_') || req_id.startsWith('sliv-'))) {
            try {
                const ev = await JtvService.resolveEvent(req_id);
                let target = ev?.stream_url || ev?.full_stream_url || ev?.manifest_url;
                if (target && !target.includes('/live.php') && (target.startsWith('http://') || target.startsWith('https://'))) {
                    req_id = target;
                    stream = target;
                } else {
                    const { live, all } = await fetchSonyLivEvents();
                    const cleanId = req_id.replace(/^(?:sonyliv|sliv)[-_]?/i, '');
                    const match = live.find(e => String(e.contentId) === cleanId || e.id === req_id || String(e.contentId).split('_')[0] === cleanId.split('_')[0]) ||
                                  all.find(e => String(e.contentId) === cleanId || e.id === req_id || String(e.contentId).split('_')[0] === cleanId.split('_')[0]);
                    if (match) {
                        const bChan = (match.broadcastChannel || '').toLowerCase();
                        if (bChan.includes('ten 1') || bChan.includes('sports 1')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-162&m3u=1');
                        if (bChan.includes('ten 2') || bChan.includes('sports 2')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-891&m3u=1');
                        if (bChan.includes('ten 3') || bChan.includes('sports 3')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-892&m3u=1');
                        if (bChan.includes('ten 4') || bChan.includes('sports 4') || bChan.includes('six')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-1773&m3u=1');
                        if (bChan.includes('ten 5') || bChan.includes('sports 5')) return res.redirect(302, '/live.php?token=STALKER_PRO&id=mdtv-155&m3u=1');

                        if (match.streamUrl) {
                            req_id = match.streamUrl;
                            stream = match.streamUrl;
                        }
                    }
                }
            } catch (e: any) {
                console.error('[SonyLIV Proxy] Failed to resolve event:', req_id, e?.message);
            }
        } else if (!wanda && !cassie && (
            req_id.startsWith('tim_') || req_id.startsWith('tim-') || 
            req_id.startsWith('embed-') || req_id.startsWith('embed_') || 
            req_id.startsWith('embedindia-') || req_id.startsWith('embedindia_') || 
            req_id.startsWith('247-') || req_id.startsWith('event_') ||
            req_id.includes('-v-') || req_id.match(/^[a-z0-9]{6,12}-\d+$/)
        )) {
            let timId = req_id.replace(/^(tim|embed|embedindia|event)[_-]?/i, '');
            try {
                const resolved = await resolveTimChannel(timId) || await resolveTimChannel(req_id);
                if (resolved) {
                    if (resolved.startsWith('/') || resolved.startsWith('http://localhost') || resolved.startsWith('http://127.0.0.1')) {
                        return res.redirect(302, resolved);
                    }
                    stream = resolved;
                    headersArray = headersArray.filter(h => 
                        !h.toLowerCase().startsWith('referer:') && 
                        !h.toLowerCase().startsWith('origin:') && 
                        !h.toLowerCase().startsWith('user-agent:') &&
                        !h.toLowerCase().startsWith('authorization:') &&
                        !h.toLowerCase().startsWith('cookie:') &&
                        !h.toLowerCase().startsWith('x-user-agent:')
                    );
                    if (resolved.includes('judiaslevels') || resolved.includes('embeds.gay') || resolved.includes('ehgembxe') || resolved.includes('hundxvision') || resolved.includes('exmxbxe')) {
                        headersArray.push('Referer: https://ehgembxe.cfd/');
                        headersArray.push('Origin: https://ehgembxe.cfd');
                    } else {
                        headersArray.push('Referer: https://timst.top/');
                        headersArray.push('Origin: https://timst.top');
                    }
                    headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                }
            } catch (e: any) {
                console.error('[TimStreams/Embed Proxy] Failed to resolve channel:', timId, e?.message);
            }
        } else if (!wanda && !cassie && (req_id.startsWith('dlhd-') || req_id.startsWith('dlhd_') || req_id.toLowerCase().startsWith('dlhd'))) {
            let dlhdId = req_id.replace(/^dlhd[_-]?/i, '').toLowerCase();
            const DLHD_TO_TIM: Record<string, string> = {
                'sky-sports-main-event': 'sky-sports-main-event',
                'sky-sports-premier-league': 'sky-sports-premier-league',
                'sky-sports-football': 'sky-sports-football',
                'sky-sports-f1': 'sky-sports-f1',
                'sky-sports-cricket': 'sky-sports-cricket',
                'sky-sports-action': 'sky-sports-action',
                'sky-sports-arena': 'sky-sports-action',
                'sky-sports-golf': 'sky-sports-golf',
                'sky-sports-news': 'sky-sports-news',
                'tnt-sports-1': 'tnt-sports-1',
                'tnt-sports-2': 'tnt-sports-2',
                'tnt-sports-3': 'tnt-sports-3',
                'tnt-sports-4': 'tnt-sports-4',
                'bein-sports-1': 'bein-sports',
                'espn': 'espn',
                'espn2': 'espn2',
                'fox-sports-1': 'fox-sports-1',
                'fox-sports-2': 'fox-sports-2',
                'fox-cricket': 'fox-sports-501-cricket',
                'dazn-1': 'dazn-1-spain',
                'willow-hd': 'willow-cricket',
                'willow': 'willow-cricket',
                'willow-2': 'willow-cricket-2',
                'willow2': 'willow-cricket-2',
                '247-willow-2': 'willow-cricket-2',
                'embed-247-willow-2': 'willow-cricket-2',
                'sony-ten-1': 'sony-sports-network',
                'sony-ten-2': 'sony-sports-network-2',
                'sony-six': 'sony-sports-network-4',
                'abc': 'abc',
                'cbs': 'cbs',
                'nbc': 'nbc',
                'fox': 'fox'
            };
            const timId = DLHD_TO_TIM[dlhdId] || DLHD_TO_TIM[dlhdId.replace(/[-_]/g, '')] || dlhdId;
            try {
                const resolved = await resolveTimChannel(timId) || await resolveTimChannel(dlhdId);
                if (resolved) {
                    stream = resolved;
                    headersArray = headersArray.filter(h => 
                        !h.toLowerCase().startsWith('referer:') && 
                        !h.toLowerCase().startsWith('origin:') && 
                        !h.toLowerCase().startsWith('user-agent:') &&
                        !h.toLowerCase().startsWith('authorization:') &&
                        !h.toLowerCase().startsWith('cookie:') &&
                        !h.toLowerCase().startsWith('x-user-agent:')
                    );
                    if (resolved.includes('judiaslevels') || resolved.includes('embeds.gay') || resolved.includes('ehgembxe') || resolved.includes('hundxvision') || resolved.includes('exmxbxe')) {
                        headersArray.push('Referer: https://ehgembxe.cfd/');
                        headersArray.push('Origin: https://ehgembxe.cfd');
                    } else {
                        headersArray.push('Referer: https://timst.top/');
                        headersArray.push('Origin: https://timst.top');
                    }
                    headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                }
            } catch (e: any) {
                console.warn('[DLHD Proxy] TimStreams resolution for', timId, 'failed, attempting DaddyLive fallback...');
            }

            if (!stream) {
                const DLHD_NUM_MAP: Record<string, string> = {
                    "sky-sports-main-event": "38",
                    "sky-sports-premier-league": "130",
                    "sky-sports-football": "35",
                    "sky-sports-f1": "60",
                    "sky-sports-cricket": "65",
                    "tnt-sports-1": "31",
                    "tnt-sports-2": "32",
                    "tnt-sports-3": "33",
                    "tnt-sports-4": "34",
                    "bein-sports-1": "91",
                    "bein-sports-2": "92",
                    "espn": "44",
                    "espn2": "386",
                    "fox-sports-1": "39",
                    "fox-sports-2": "758",
                    "dazn-1": "230",
                    "willow-hd": "346",
                    "willow": "346",
                    "willow-2": "346",
                    "willow2": "346",
                    "247-willow-2": "346",
                    "embed-247-willow-2": "346",
                    "sony-ten-1": "885",
                    "sony-ten-2": "886",
                    "star-sports-1": "267",
                    "eurosport-1": "41",
                    "wwe-network": "376"
                };
                const numId = DLHD_NUM_MAP[dlhdId] || dlhdId;
                try {
                    const daddyUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${encodeURIComponent(numId)}`;
                    const daddyRes = await axios.get(daddyUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'Referer': 'https://dlhd.st/'
                        },
                        httpsAgent: agent,
                        timeout: 8000
                    });
                    let resolved = await decodeStreamUrl(daddyRes.data);
                    if (resolved && resolved.includes('premium0')) resolved = null;
                    if (!resolved) {
                        const fallbackDlhdUrl = `https://dlhd.st/stream/stream-${encodeURIComponent(numId)}.php`;
                        const fallbackRes = await axios.get(fallbackDlhdUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                'Referer': 'https://dlhd.st/'
                            },
                            httpsAgent: agent,
                            timeout: 8000
                        });
                        resolved = await decodeStreamUrl(fallbackRes.data);
                        if (resolved && resolved.includes('premium0')) resolved = null;
                    }
                    if (resolved) {
                        stream = resolved;
                        headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('referer:') && !h.toLowerCase().startsWith('origin:') && !h.toLowerCase().startsWith('user-agent:'));
                        headersArray.push('Referer: https://hamis.romponalis.st/');
                        headersArray.push('Origin: https://hamis.romponalis.st/');
                        headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                    }
                } catch (e: any) {
                    console.error('[DLHD Proxy] Failed to resolve DLHD channel:', dlhdId, e?.message);
                }
            }
        } else {
            if (req.query.nocache) {
                const cacheFile = path.join(process.cwd(), 'cache_stalker', `${req_id}.json`);
                if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
            }
            const apiResStr = await StalkerAPI.doctor_strange(req_id, portal);
            try {
                apiRes = JSON.parse(apiResStr);
            } catch (e) {}

            if (apiRes?.STALKER?.data && typeof apiRes.STALKER.data === 'string' && apiRes.STALKER.data.includes('Authorization failed')) {
                if (!req.query.retried) {
                    const tokenStalkerPath = path.join(process.cwd(), 'doctor_strange', 'token.stalker');
                    if (fs.existsSync(tokenStalkerPath)) fs.unlinkSync(tokenStalkerPath);
                    const separator = req.originalUrl.includes('?') ? '&' : '?';
                    return res.redirect(req.originalUrl + separator + 'retried=1');
                } else {
                    console.warn('[Proxy] Stalker portal authorization failed again. Skipping further redirects.');
                }
            }
            stream = apiRes?.STALKER?.cmd || '';
            stream = StalkerAPI.id_generator(stream);
        }

        if (!wanda && !cassie && !stream && (req_id.startsWith('tim_') || req_id.startsWith('tim-') || req_id.startsWith('embed-') || req_id.startsWith('embedindia-') || req_id.startsWith('247-') || req_id.startsWith('dlhd-') || req_id.startsWith('dlhd_') || req_id.toLowerCase().startsWith('dlhd'))) {
            try {
                let timId = req_id;
                if (req_id.startsWith('dlhd-') || req_id.startsWith('dlhd_') || req_id.toLowerCase().startsWith('dlhd')) {
                     timId = req_id.replace(/^dlhd[_-]?/i, '').replace(/-/g, '').toLowerCase() + '-uk';
                } else if (req_id.startsWith('tim_') || req_id.startsWith('tim-') || req_id.startsWith('embed-') || req_id.startsWith('embed_') || req_id.startsWith('embedindia-') || req_id.startsWith('embedindia_') || req_id.startsWith('247-')) {
                     timId = req_id.replace(/^(tim|embed|embedindia)[_-]?/i, '');
                     
                     // Verify and swap out broken 247- prefixes for their known working counterparts
                     const slugMappings: { [key: string]: string } = {
                         '247-willow-2': 'willow-cricket-2',
                         '247-willow-hd': 'willow-cricket',
                         '247-willow': 'willow-cricket',
                         '247-willow-1': 'willow-cricket',
                         'willow-2': 'willow-cricket-2',
                         'willow2': 'willow-cricket-2',
                         'willow-usa': 'willow-cricket',
                         'willowcricket-usa': 'willow-cricket',
                         '247-sky-sports-cricket': 'sky-sports-cricket',
                         '247-sky-sports-main-event': 'sky-sports-main-event',
                         '247-sky-sports-premier-league': 'sky-sports-premier-league',
                         'skysportscricket-uk': 'sky-sports-cricket',
                         'skysportspremierleague-uk': 'sky-sports-premier-league',
                         'skysportsmainevent-uk': 'sky-sports-main-event',
                         '247-fox-cricket': 'fox-sports-501-cricket',
                         'foxcricket-au': 'fox-sports-501-cricket'
                     };
                     if (slugMappings[timId]) {
                         timId = slugMappings[timId];
                     }
                }
                const resolved = await resolveTimChannel(timId);
                if (resolved) {
                    stream = resolved;
                    headersArray = headersArray.filter(h => 
                        !h.toLowerCase().startsWith('referer:') && 
                        !h.toLowerCase().startsWith('origin:') && 
                        !h.toLowerCase().startsWith('user-agent:') &&
                        !h.toLowerCase().startsWith('authorization:') &&
                        !h.toLowerCase().startsWith('cookie:') &&
                        !h.toLowerCase().startsWith('x-user-agent:')
                    );
                    headersArray.push('Referer: https://timst.top/');
                    headersArray.push('Origin: https://timst.top');
                    headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                }
            } catch (e: any) {}
        }

        if (!stream) {
            try {
                const daddyRes = await axios.get(`https://hamis.romponalis.st/premiumtv/daddy3.php?id=${encodeURIComponent(req_id)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Referer': 'https://dlhd.st/'
                    },
                    httpsAgent: agent,
                    timeout: 8000
                });
                const decoded = await decodeStreamUrl(daddyRes.data);
                if (decoded && !decoded.includes('premium0')) {
                    stream = decoded;
                    headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('referer:') && !h.toLowerCase().startsWith('origin:') && !h.toLowerCase().startsWith('user-agent:'));
                    headersArray.push('Referer: https://hamis.romponalis.st/');
                    headersArray.push('Origin: https://hamis.romponalis.st/');
                    headersArray.push('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                }
            } catch (e: any) {}
        }

        if (!stream) {
            console.log('Fell through! req_id=', req_id, 'wanda=', wanda, 'stream=', stream); return res.status(404).send('Stream not found');
        }

        if (stream.includes('epiembeds.online/embed/') || stream.includes('embedindia.st/embed/')) {
            if (!await isSafeUrl(stream)) {
                return res.status(403).send('Access Denied: Unsafe URL detected.');
            }
            try {
                const embedSlugMatch = stream.match(/\/embed\/([a-zA-Z0-9_-]+)/);
                const targetStreamUrl = embedSlugMatch ? `https://epiembeds.online/embed/${embedSlugMatch[1]}` : stream;
                const embedRes = await axios.get(targetStreamUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://epiembeds.online/'
                    }
                });
                const decoded = await decodeStreamUrl(embedRes.data);
                if (decoded) {
                    stream = decoded;
                }
            } catch (e: any) {
                console.error('[Proxy] Failed to decode embed stream:', e?.message || e);
            }
        }

        const uaMatch = stream.match(/[?&]http-user-agent=([^&]+)/);
        if (uaMatch) {
            custom_ua = decodeURIComponent(uaMatch[1]);
            stream = stream.replace(/([?&])http-user-agent=[^&]+(&?)/, '$1');
            stream = stream.replace(/[?&]$/, '');

            headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('user-agent:'));
            headersArray.push(`User-Agent: ${custom_ua}`);
        }

        if (stream.startsWith('http')) {
            const lowerStream = stream.toLowerCase();
            const isM3u8 = lowerStream.includes('.m3u8') || lowerStream.includes('.m3u') || lowerStream.includes('stream.php') || req.query.type === 'hls' || req.query.hls === '1';
            const isMkv = lowerStream.includes('.mkv') || lowerStream.endsWith('.mkv');

            // "make hls m3u if it is mkv not hls use mpeg buttery smooth"
            if (isMkv) {
                if (isM3u8 || req.query.m3u === '1' || req.query.format === 'm3u' || req.url.includes('.m3u8')) {
                    // Make HLS M3U playlist for MKV
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    const host = req.get('host') || 'localhost:3000';
                    const proto = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
                    const mpegUrl = `${proto}://${host}/api/stream-proxy?url=${encodeURIComponent(stream)}&type=mpegts`;
                    const hlsPlaylist = [
                        '#EXTM3U',
                        '#EXT-X-VERSION:3',
                        '#EXT-X-TARGETDURATION:6',
                        '#EXT-X-MEDIA-SEQUENCE:0',
                        '#EXT-X-PLAYLIST-TYPE:EVENT',
                        '#EXTINF:6.0,',
                        mpegUrl,
                        '#EXT-X-ENDLIST'
                    ].join('\n');
                    return res.send(hlsPlaylist);
                } else {
                    // If it is MKV not HLS, use MPEG buttery smooth via FFmpeg remuxing!
                    return remuxMkvToMpegTs(stream, req, res, headersArray);
                }
            }

            if (req.query.type === 'mpegts' || req.query.remux === 'mpegts') {
                return remuxMkvToMpegTs(stream, req, res, headersArray);
            }

            const isDirect = (
                !isM3u8 ||
                lowerStream.includes('.ts') ||
                lowerStream.includes('.mp4') ||
                lowerStream.includes('.avi') ||
                lowerStream.includes('.mp3') ||
                lowerStream.includes('.m4a') ||
                lowerStream.includes('/play/') ||
                lowerStream.includes('/live/') ||
                lowerStream.includes('type=ts') ||
                lowerStream.includes('format=ts')
            );
            if (isDirect && !isM3u8) {
                res.setHeader('Access-Control-Allow-Origin', '*');
                return await streamUrl(stream, headersArray, req, res);
            }

            let stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
            let content = stalkerRes.STALKER.data;
            let status_code = stalkerRes.STALKER.info.http_code;
            
            const final_url = stalkerRes.STALKER.info.final_url || stream;
            stream = final_url;
            let vision = stream.substring(0, stream.lastIndexOf('/') + 1);
            console.log("STREAM:", stream, "STATUS:", status_code, "CONTENT_LEN:", content.length);

            let is_cached = apiRes?.STALKER?.message === "Playback URL fetched from cache";
            if (status_code !== 200) {
                console.warn(`[Proxy] Upstream returned HTTP ${status_code} for ${stream}. Initiating auto-recovery pipeline...`);
                
                // Clear any cached item for this ID
                if (req_id) {
                    const cacheFile = path.join(process.cwd(), 'cache_stalker', `${req_id}.json`);
                    if (fs.existsSync(cacheFile)) {
                        try { fs.unlinkSync(cacheFile); } catch(e){}
                    }
                }

                if (portal) {
                    const freshResStr = await StalkerAPI.doctor_strange(req_id, portal);
                    let freshRes: any = null;
                    try { freshRes = JSON.parse(freshResStr); } catch (e) {}
                    stream = freshRes?.STALKER?.cmd || '';
                    if (stream.startsWith('http')) {
                        stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
                        content = stalkerRes.STALKER.data;
                        status_code = stalkerRes.STALKER.info.http_code;
                        const final_url = stalkerRes.STALKER.info.final_url || stream;
                        stream = final_url;
                        vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                    }
                } else if (req_id && (req_id.startsWith('tim_') || req_id.startsWith('tim-') || req_id.startsWith('embed-') || req_id.startsWith('embedindia-') || req_id.startsWith('247-') || req_id.startsWith('dlhd') || stream.includes('timst.top') || stream.includes('cdx-08192') || stream.includes('hundxvision') || stream.includes('exmxbxe'))) {
                    const timId = req_id.replace(/^(tim|embed|embedindia|dlhd)[_-]?/i, '');
                    try {
                        const decoded = await resolveTimChannel(timId, true) || await resolveTimChannel(req_id, true);
                        if (decoded) {
                            stream = decoded;
                            stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
                            content = stalkerRes.STALKER.data;
                            status_code = stalkerRes.STALKER.info.http_code;
                            const final_url = stalkerRes.STALKER.info.final_url || stream;
                            stream = final_url;
                            vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                        }
                    } catch(e){}
                } else if (stream.includes('streamrip.fun') || (req_id && req_id.includes('streamrip.fun'))) {
                    console.warn(`[Proxy Recovery] Dead streamrip upstream 404 detected for: ${stream}`);
                    const tmdbId = req.query.tmdb_id || req.query.id;
                    const mediaType = (req.query.type as string) || 'movie';
                    if (tmdbId && !isNaN(Number(tmdbId))) {
                        try {
                            const { scrapeBingrStream } = require('./services/bingrScraperService');
                            const fallbackResult = await scrapeBingrStream({
                                type: mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie',
                                tmdbId: Number(tmdbId),
                                season: Number(req.query.season) || 1,
                                episode: Number(req.query.episode) || 1
                            });
                            if (fallbackResult?.primaryM3u8 && fallbackResult.primaryM3u8 !== stream) {
                                stream = fallbackResult.primaryM3u8;
                                console.log(`[Proxy Recovery] Recovered via alternate cluster (${fallbackResult.serverName}): ${stream}`);
                                stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
                                content = stalkerRes.STALKER.data;
                                status_code = stalkerRes.STALKER.info.http_code;
                                const final_url = stalkerRes.STALKER.info.final_url || stream;
                                stream = final_url;
                                vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                            }
                        } catch(e) {}
                    }
                }
            }

            if ((status_code === 401 || status_code === 403 || (typeof content === 'string' && content.includes('Authorization failed'))) && portal) {
                console.log("[PROXY] Token expired or 401/403 returned. Triggering Stalker auto-healing handshake...");
                const host_id = StalkerAPI.getHostId(portal);
                const tokenFile = path.join(process.cwd(), 'doctor_strange', `token_${host_id}.stalker`);
                if (fs.existsSync(tokenFile)) { try { fs.unlinkSync(tokenFile); } catch (e) {} }
                const freshProfileStr = await StalkerAPI.doctor_strange('', portal);
                let freshToken = '';
                try {
                    const freshObj = JSON.parse(freshProfileStr);
                    freshToken = freshObj?.STALKER?.Token || '';
                } catch (e) {}

                if (freshToken) {
                    headersArray = headersArray.filter(h => !h.toLowerCase().startsWith('authorization:'));
                    headersArray.push(`Authorization: Bearer ${freshToken}`);
                    
                    const freshResStr = await StalkerAPI.doctor_strange(req_id, portal);
                    let freshResObj: any = null;
                    try { freshResObj = JSON.parse(freshResStr); } catch (e) {}
                    const newCmd = freshResObj?.STALKER?.cmd || stream;
                    if (newCmd && newCmd.startsWith('http')) {
                        stream = StalkerAPI.id_generator(newCmd);
                        stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
                        content = stalkerRes.STALKER.data;
                        status_code = stalkerRes.STALKER.info.http_code;
                        const final_url = stalkerRes.STALKER.info.final_url || stream;
                        stream = final_url;
                        vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                    }
                }
            }

            let redirectCount = 0;
            while ([301, 302, 303, 307, 308].includes(status_code) && redirectCount < 10) {
                let redirectUrl = stalkerRes.STALKER.info.redirect_url;
                if (!redirectUrl) {
                    const locMatch = content.match(/Location:\s*([^\r\n]+)/i);
                    if (locMatch) redirectUrl = locMatch[1].trim();
                }

                if (redirectUrl) {
                    if (redirectUrl.includes('/error/expired') || redirectUrl.includes('expired.mpd') || redirectUrl.includes('error.m3u8')) {
                        console.log(`[PROXY] Blocked stalker redirect to expired stream: ${redirectUrl}`);
                        status_code = 404;
                        break;
                    }
                    if (!redirectUrl.startsWith('http')) {
                        redirectUrl = resolveM3u8Url(stream, redirectUrl);
                    }
                    stream = redirectUrl;
                    stalkerRes = await StalkerAPI.stalkerRequest(stream, headersArray, 'GET', null, true);
                    content = stalkerRes.STALKER.data;
                    status_code = stalkerRes.STALKER.info.http_code;
                    const final_url = stalkerRes.STALKER.info.final_url || stream;
                    stream = final_url;
                    vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                    redirectCount++;
                } else {
                    break;
                }
            }

            if (stream.startsWith('http') && status_code === 200) {
                const is_playlist_content = typeof content === 'string' && content.includes('#EXTM3U');
                const is_mpd_content = typeof content === 'string' && (content.includes('<MPD') || stream.toLowerCase().includes('.mpd'));

                if (is_playlist_content) {
                    if (req.query.download === '1') {
                        return handleHlsDownload(req, res, stream, headersArray);
                    }
                    vision = stream.substring(0, stream.lastIndexOf('/') + 1);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');

                    // Pre-fetch first 4 HLS segments into RAM cache for ultra-fast startup (<1s)
                    prefetchHlsSegments(stream, content, headersArray);

                    let m3u_suffix = m3u_mode ? '&m3u=1' : '';
                    if (req_id) {
                        m3u_suffix += '&id=' + encodeURIComponent(req_id);
                    }
                    if (custom_ua) {
                        m3u_suffix += '&http-user-agent=' + encodeURIComponent(custom_ua);
                    }

                    const rewritten = rewriteHlsManifest(content, stream, m3u_suffix);
                    return res.send(rewritten);
                } else if (is_mpd_content) {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Content-Type', 'application/dash+xml');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    return res.send(content);
                } else {
                    // Check if upstream returned a JSON/HTML error response for an m3u8 playlist request
                    const isM3u8Request = stream.toLowerCase().includes('.m3u8') || req.url.includes('.m3u8') || req.url.includes('type=hls') || m3u_mode;
                    const isErrorPayload = typeof content === 'string' && (
                        content.trim().startsWith('{') || 
                        content.trim().startsWith('<') || 
                        content.includes('error') || 
                        content.includes('Error')
                    );

                    if (isM3u8Request && isErrorPayload) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                        console.warn(`[Proxy Upstream Error] Stream '${stream}' returned non-playlist error.`);
                        QuarantineService.quarantineStreamOnFailure(stream, `Non-playlist upstream response`, 502, req_id);
                        if (req_id) {
                            const cacheFile = require("path").join(process.cwd(), "cache_stalker", `${req_id}.json`);
                            if (require("fs").existsSync(cacheFile)) {
                                try { require("fs").unlinkSync(cacheFile); } catch(e){}
                            }
                        }
                        return res.status(502).send(`Upstream stream is currently offline or returning invalid feed.`);
                    }

                    res.setHeader('Access-Control-Allow-Origin', '*');
                    const contentType = stalkerRes.STALKER.info.content_type || (stream.toLowerCase().includes('.mpd') ? 'application/dash+xml' : 'video/mp2t');
                    res.setHeader('Content-Type', contentType);
                    return await streamUrl(stream, headersArray, req, res);
                }
            } else {
                res.setHeader('Access-Control-Allow-Origin', '*');
                if (stream && (stream.startsWith('http://') || stream.startsWith('https://'))) {
                    console.warn(`[Proxy Fallback] Upstream proxy failed (HTTP ${status_code || 502}) for ${stream}. Redirecting client directly via 302...`);
                    return res.redirect(302, stream);
                }
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                return res.status(status_code || 502).send('Proxy failed: Upstream returned HTTP ' + status_code);
            }
        } else {
            console.log('Fell through! req_id=', req_id, 'wanda=', wanda, 'stream=', stream); return res.status(404).send('Stream not found');
        }
    }


    


    if (!req_id && !wanda && !cassie) {
        return res.status(400).send('Missing ID or query parameters');
    }
    console.log('Fell through! req_id=', req_id, 'wanda=', wanda, 'stream=', stream); return res.status(404).send('Stream not found');
}


function handleHlsDownload(req: Request, res: Response, streamUrl: string, headersArray: string[]) {
    const rawTitle = (req.query.title as string) || 'movie_download';
    const safeTitle = rawTitle.replace(/[^a-zA-Z0-9_\-\.\ ]/g, '_').trim();
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    let ffmpegArgs = [];
    const refererHeader = headersArray.find(h => h.toLowerCase().startsWith('referer:'));
    const uaHeader = headersArray.find(h => h.toLowerCase().startsWith('user-agent:'));
    if (refererHeader || uaHeader) {
        let headersStr = '';
        if (refererHeader) headersStr += refererHeader + "\r\n";
        if (uaHeader) headersStr += uaHeader + "\r\n";
        ffmpegArgs.push('-headers', headersStr);
    }
    
    ffmpegArgs.push('-i', streamUrl, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1');
    
    const ff = spawn('ffmpeg', ffmpegArgs);
    ff.stdout.pipe(res);
    ff.on('error', (err: any) => { console.error('FFmpeg error:', err); });
    req.on('close', () => { ff.kill('SIGKILL'); });
}
