import { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { httpAgent, httpsAgent } from './xtreamAgent';
import { XtreamAPI } from './XtreamAPI';
import { StalkerAPI } from '../stalkerAPI';
import { isSafeUrl } from '../proxy';

function setXtreamCorsHeaders(res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
}

function xtreamEncode(url: string): string {
    return Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function xtreamDecode(encoded: string): string {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf8');
}

function guessContentType(url: string, upstreamType?: string): string {
    if (upstreamType && upstreamType !== 'application/octet-stream') return upstreamType;
    try {
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        switch (ext) {
            case '.mp4': return 'video/mp4';
            case '.mkv': return 'video/x-matroska';
            case '.ts': return 'video/mp2t';
            case '.m3u8': return 'application/vnd.apple.mpegurl';
            default: return 'video/mp2t';
        }
    } catch (e) {
        return 'video/mp2t';
    }
}

async function pipeDirectBinary(url: string, req: Request, res: Response, api: XtreamAPI) {
    setXtreamCorsHeaders(res);
    try { req.socket.setNoDelay(true); } catch(e){}
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Transfer-Encoding', 'binary');

    const isHttps = url.startsWith('https');
    const isLive = url.includes('/live/') || url.includes('xtream_live_');
    
    const portalUrl = api.getAccount().portalUrl;
    const headers: Record<string, string> = {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive'
    };
    
    if (req.headers.range && !isLive) {
        headers['Range'] = req.headers.range as string;
    }

    let hasFinished = false;
    // Binary Streaming Proxy using native Node.js http/https directly for maximum socket-to-socket throughput
    let redirectCount = 0;
    const maxRedirects = 5;

    function executeRequest(requestUrl: string) {
        const isUrlHttps = requestUrl.startsWith('https');
        const options = {
            method: 'GET',
            headers: headers,
            rejectUnauthorized: false,
            agent: isUrlHttps ? httpsAgent : httpAgent
        };

        const clientReq = (isUrlHttps ? https : http).request(requestUrl, options, (upstreamRes) => {
            if (upstreamRes.statusCode && [301, 302, 303, 307, 308].includes(upstreamRes.statusCode)) {
                let redirectUrl = upstreamRes.headers['location'];
                if (redirectUrl) {
                    if (!redirectUrl.startsWith('http')) {
                        const u = new URL(requestUrl);
                        redirectUrl = new URL(redirectUrl, u.origin).href;
                    }

                    redirectCount++;
                    if (redirectCount > maxRedirects) {
                        console.error(`[XtreamProxy] Too many redirects for ${url}`);
                        hasFinished = true;
                        return res.status(508).send('Too many redirects').end();
                    }

                    console.log(`[XtreamProxy] Following redirect to: ${redirectUrl}`);
                    return executeRequest(redirectUrl);
                }
            }

            if (upstreamRes.statusCode && upstreamRes.statusCode >= 400) {
                console.error(`[XtreamProxy] Upstream Error: ${upstreamRes.statusCode} (${upstreamRes.statusMessage}) for ${requestUrl}`);
                hasFinished = true;
                return res.status(upstreamRes.statusCode).end();
            }

            const userAgent = (req.headers['user-agent'] || '').toLowerCase();
            const isBrowser = userAgent.includes('mozilla') || userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge');

            const isMkv = url.toLowerCase().includes('.mkv');
            // Only auto-transcode MKV for web browsers (since they lack native MKV decoding support)
            const transcodeParam = req.query.transcode === '1' || req.query.fm4 === '1' || req.query.fmp4 === '1' || (!isLive && isMkv && isBrowser);

            if (transcodeParam) {
                console.log(`[XtreamProxy] Transcode mode active (isLive: ${isLive}, isMkv: ${isMkv}, isBrowser: ${isBrowser}, seek: ${req.query.seek || '0'}). Spawning FFmpeg transcode pipeline...`);
                
                const seekVal = req.query.seek ? String(req.query.seek) : '';
                const ffmpegArgs = [];
                if (seekVal) {
                    ffmpegArgs.push('-ss', seekVal);
                }
                ffmpegArgs.push(
                    '-fflags', '+genpts+discardcorrupt+nobuffer',
                    '-flags', 'low_delay',
                    '-avoid_negative_ts', 'make_zero',
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
                    '-sn',
                    '-dn',
                    '-max_muxing_queue_size', '4096',
                    '-flush_packets', '1',
                    '-mpegts_flags', '+initial_discontinuity'
                );
                
                if (isLive && req.query.format !== 'mp4') {
                    ffmpegArgs.push(
                        '-f', 'mpegts',
                        'pipe:1'
                    );
                    res.status(200);
                    res.setHeader('Content-Type', 'video/mp2t');
                } else {
                    ffmpegArgs.push(
                        '-f', 'mp4',
                        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                        '-frag_duration', '1000',
                        'pipe:1'
                    );
                    res.status(200);
                    res.setHeader('Content-Type', 'video/mp4');
                }
                
                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                upstreamRes.pipe(ffmpeg.stdin);
                ffmpeg.stderr.on('data', (d) => console.log('[Xtream FFmpeg]', d.toString().trim()));

                ffmpeg.stdin.on('error', (err: any) => {
                    // Suppress pipe errors
                });
                ffmpeg.stdout.on('error', (err: any) => {
                    console.error('[XtreamProxy] FFmpeg stdout Error:', err.message);
                });
                res.on('error', (err: any) => {
                    console.error('[XtreamProxy] Client Response Error:', err.message);
                });

                ffmpeg.stdout.pipe(res);

                req.on('close', () => {
                    hasFinished = true;
                    try { ffmpeg.kill('SIGKILL'); } catch (e) {}
                });

                ffmpeg.on('error', (err) => {
                    console.error('[XtreamProxy] FFmpeg Spawn Error:', err.message);
                });
            } else {
                const contentType = guessContentType(requestUrl, upstreamRes.headers['content-type'] as string);
                
                if (contentType.includes('mpegurl') || contentType.includes('apple.mpegurl') || (requestUrl.includes('.m3u8') && !contentType.includes('video/'))) {
                    let m3u8Data = '';
                    upstreamRes.on('data', (chunk) => { m3u8Data += chunk.toString(); });
                    upstreamRes.on('end', () => {
                        hasFinished = true;
                        const baseUrl = requestUrl.substring(0, requestUrl.lastIndexOf('/') + 1);
                        let rewritten = '';
                        const lines = m3u8Data.split('\n');
                        for (let line of lines) {
                            line = line.trim();
                            if (!line) continue;
                            if (line.startsWith('#')) {
                                if (line.includes('URI="') || line.includes('URI=')) {
                                    line = line.replace(/URI="?([^",\s]+)"?/g, (_match, uri) => {
                                        const absUrl = uri.startsWith('http') ? uri : baseUrl + uri;
                                        const proxyUrl = `/xtream.php?xurl=${xtreamEncode(absUrl)}`;
                                        return `URI="${proxyUrl}"`;
                                    });
                                }
                                rewritten += line + '\n';
                            } else {
                                const absUrl = line.startsWith('http') ? line : baseUrl + line;
                                const proxyUrl = `/xtream.php?xurl=${xtreamEncode(absUrl)}`;
                                rewritten += proxyUrl + '\n';
                            }
                        }
                        res.status(upstreamRes.statusCode || 200);
                        res.setHeader('Content-Type', contentType);
                        res.send(rewritten);
                    });
                    
                    upstreamRes.on('error', (err: any) => {
                        console.error('[XtreamProxy] Upstream M3U8 Error:', err.message);
                        if (!res.headersSent) res.status(502).end();
                    });
                } else {
                    res.status(upstreamRes.statusCode || 200);
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');

                    const isLiveStream = isLive || requestUrl.includes('/live/') || requestUrl.includes('.ts') || contentType === 'video/mp2t';
                    if (!isLiveStream && upstreamRes.headers['content-length']) {
                        res.setHeader('Content-Length', upstreamRes.headers['content-length']);
                    } else {
                        res.setHeader('Connection', 'keep-alive');
                    }
                    
                    if (upstreamRes.headers['content-range']) res.setHeader('Content-Range', upstreamRes.headers['content-range']);
                    if (upstreamRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges']);

                    upstreamRes.pipe(res);

                    upstreamRes.on('error', (err: any) => {
                        console.error('[XtreamProxy] Upstream Response Direct Error:', err.message);
                    });
                    res.on('error', (err: any) => {
                        console.error('[XtreamProxy] Client Response Direct Error:', err.message);
                    });

                    req.on('close', () => {
                        hasFinished = true;
                        upstreamRes.destroy();
                    });
                }
            }
        });

        clientReq.on('error', (e) => {
            hasFinished = true;
            console.error(`[XtreamProxy] Binary Pipe Error: ${e.message}`);
            if (!res.headersSent) res.status(502).end();
        });

        req.on('close', () => {
            if (!hasFinished) {
                hasFinished = true;
                clientReq.destroy();
            }
        });

        clientReq.end();
    }

    executeRequest(url);
}

export async function handleXtreamStream(req: Request, res: Response) {
    if (req.method === 'OPTIONS') {
        setXtreamCorsHeaders(res);
        return res.sendStatus(204);
    }

    const portal = StalkerAPI.getActivePortal(req);
    const account = (portal && portal.type === 'xtream') ? {
        portalUrl: portal.URL,
        username: portal.username,
        password: portal.password
    } : XtreamAPI.getActiveAccount();

    if (!account) {
        return res.status(401).send('No active Xtream account');
    }

    const api = new XtreamAPI(account);
    const contentId = req.query.id as string;
    const xurl = req.query.xurl as string;

    if (xurl) {
        if (xurl.length > 4096) {
            return res.status(400).send('Request parameter too large');
        }
        const decodedUrl = xtreamDecode(xurl);
        if (!await isSafeUrl(decodedUrl)) {
            return res.status(403).send('Access Denied: Unsafe URL detected.');
        }
        return pipeDirectBinary(decodedUrl, req, res, api);
    }

    if (!contentId) {
        return res.status(400).send('Missing ID');
    }

    const streamUrl = api.resolveStreamUrl(contentId);
    if (!streamUrl) {
        return res.status(404).send('Invalid Stream ID');
    }
    
    if (!await isSafeUrl(streamUrl)) {
        return res.status(403).send('Access Denied: Unsafe URL detected.');
    }

    console.log(`[XtreamProxy] Resolved: ${streamUrl}`);
    return pipeDirectBinary(streamUrl, req, res, api);
}

