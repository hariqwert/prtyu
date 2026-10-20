import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { spawn, ChildProcess } from 'child_process';
import { URL } from 'url';
import { addStreamingIp, removeStreamingIp, shouldSendUserIp } from '../../server';
import { isSafeUrl } from '../proxy';

const router = Router();

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Clean & sanitize User-Agent parameter.
 * Prevents string "undefined" or "null" from being passed to upstream servers.
 */
function sanitizeUserAgent(uaInput: any): string {
    if (!uaInput) return DEFAULT_USER_AGENT;
    const str = String(uaInput).trim();
    if (!str || str === 'undefined' || str === 'null') {
        return DEFAULT_USER_AGENT;
    }
    return str;
}

/**
 * SSRF Safety Validator for stream URLs.
 * Rejects non-HTTP(S) protocols and private IP/cloud metadata ranges.
 */
async function isSafeStreamUrl(urlStr: string): Promise<boolean> {
    try {
        const u = new URL(urlStr);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return false;
        }
        const hostname = u.hostname.toLowerCase();

        // Allow internal loopback calls to localhost/127.0.0.1 for /api/internal-stream
        if (u.pathname.startsWith('/api/internal-stream') && (hostname === '127.0.0.1' || hostname === 'localhost')) {
            return true;
        }

        return await isSafeUrl(urlStr);
    } catch {
        return false;
    }
}

// Handle preflight OPTIONS requests for CORS
router.options('/api/stream-proxy', (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, User-Agent, Referer');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.sendStatus(204);
});

router.options('/api/internal-stream', (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, User-Agent, Referer');
    res.sendStatus(204);
});

/**
 * Protocol-aware HTTP/HTTPS client that recursively follows redirects up to maxRedirects.
 */
function streamWithRedirects(
    targetUrl: string,
    headers: Record<string, string>,
    res: Response,
    req: Request,
    redirectCount = 0
) {
    if (redirectCount > 5) {
        console.error('[CustomM3U internal-stream] Too many redirects for:', targetUrl);
        if (!res.headersSent) res.status(508).send('Too Many Redirects');
        return;
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        if (!res.headersSent) res.status(400).send('Invalid redirect URL');
        return;
    }

    const requestModule = parsedUrl.protocol === 'https:' ? https : http;
    const clientReq = requestModule.get(targetUrl, {
        headers,
        timeout: 0,
        rejectUnauthorized: false
    }, (upstream) => {
        // Follow 301/302/303/307/308 redirects transparently across HTTP <-> HTTPS
        if (upstream.statusCode && upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
            const redirectUrl = new URL(upstream.headers.location, targetUrl).toString();
            console.log(`[CustomM3U internal-stream] Hop ${redirectCount + 1}: Redirecting to ${redirectUrl}`);
            return streamWithRedirects(redirectUrl, headers, res, req, redirectCount + 1);
        }

        res.status(upstream.statusCode || 200);
        if (upstream.headers['content-type']) {
            res.setHeader('Content-Type', upstream.headers['content-type']);
        }
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=86400, max=1000000');
        res.setHeader('X-Accel-Buffering', 'no');
        if (res.socket) {
            res.socket.setKeepAlive(true, 10000);
            res.socket.setNoDelay(true);
        }

        let idleTimer: NodeJS.Timeout | null = null;
        const resetIdle = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                console.warn('[CustomM3U internal-stream] Inactivity timeout (60s no data) for:', targetUrl);
                clientReq.destroy();
            }, 60000);
        };
        resetIdle();

        upstream.on('data', () => resetIdle());

        upstream.on('end', () => {
            if (idleTimer) clearTimeout(idleTimer);
        });

        upstream.pipe(res);

        upstream.on('error', (err) => {
            if (idleTimer) clearTimeout(idleTimer);
            console.error('[CustomM3U internal-stream] Upstream data error:', err.message);
            if (!res.headersSent) res.status(502);
            res.end();
        });
    });

    clientReq.on('error', (err) => {
        console.error('[CustomM3U internal-stream] Request connection error:', err.message);
        if (!res.headersSent) {
            res.status(504).send('Gateway Timeout connecting to stream source');
        } else {
            res.end();
        }
    });

    const cleanup = () => {
        if (!clientReq.destroyed) {
            clientReq.destroy();
        }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
}

/**
 * /api/internal-stream
 * Loop-back helper endpoint for custom M3U TS streams.
 * Hides upstream DNS/headers from FFmpeg and provides a clean MPEG-TS feed.
 */
router.get('/api/internal-stream', async (req: Request, res: Response) => {
    const urlStr = (req.query.url as string || '').trim();
    const referer = (req.query.referer as string || '').trim();
    const userAgent = sanitizeUserAgent(req.query.userAgent);

    if (!urlStr) {
        return res.status(400).send('Missing stream URL');
    }

    if (!await isSafeStreamUrl(urlStr)) {
        console.warn(`[CustomM3U internal-stream] SSRF protection blocked URL: ${urlStr}`);
        return res.status(403).send('Forbidden stream URL destination');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'video/mp2t');


    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = Array.isArray(clientIp) ? clientIp[0] : (clientIp as string).replace('::ffff:', '');

    const headers: Record<string, string> = {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Connection': 'keep-alive'
    };
    if (shouldSendUserIp(cleanIp)) {
        headers['X-Forwarded-For'] = cleanIp;
        headers['X-Real-IP'] = cleanIp;
    }
    if (referer) {
        headers['Referer'] = referer;
    }

    addStreamingIp(cleanIp);
    res.on('close', () => removeStreamingIp(cleanIp));
    streamWithRedirects(urlStr, headers, res, req, 0);
});

/**
 * /api/stream-proxy
 * High-performance transcode proxy router for custom M3U MPEG-TS streams.
 * Decides whether stream needs FFmpeg transcoding or raw pass-through.
 */
router.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const urlStr = (req.query.url as string || '').trim();
    const referer = (req.query.referer as string || '').trim();
    const userAgent = sanitizeUserAgent(req.query.userAgent);
    const transcode = req.query.transcode !== 'false' && req.query.transcode !== '0';

    if (!urlStr) {
        return res.status(400).json({ error: 'Missing stream URL' });
    }

    if (!await isSafeStreamUrl(urlStr)) {
        console.warn(`[CustomM3U stream-proxy] SSRF protection blocked URL: ${urlStr}`);
        return res.status(403).json({ error: 'Forbidden stream URL destination' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const lowerUrl = urlStr.toLowerCase();
    const isXtreamPlay = lowerUrl.includes('/play/') ||
                         lowerUrl.includes('/live/') ||
                         lowerUrl.includes('transcode=1') ||
                         lowerUrl.includes('custom_ts=1');

    const isHls = !isXtreamPlay && (
        lowerUrl.includes('.m3u8') ||
        lowerUrl.includes('.m3u') ||
        lowerUrl.includes('/hls/')
    );

    // Raw pass-through mode
    if (!transcode) {
        console.log(`[CustomM3U stream-proxy] Direct raw proxy requested for: ${urlStr}`);
        const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/internal-stream?url=${encodeURIComponent(urlStr)}&referer=${encodeURIComponent(referer)}&userAgent=${encodeURIComponent(userAgent)}`;
        return res.redirect(internalUrl);
    }

    // Determine FFmpeg input path: Xtream panel stream links (/play/...) go via internal-stream helper
    const port = process.env.PORT || 3000;
    const internalStreamUrl = `http://127.0.0.1:${port}/api/internal-stream?url=${encodeURIComponent(urlStr)}&referer=${encodeURIComponent(referer)}&userAgent=${encodeURIComponent(userAgent)}`;
    const ffmpegInput = isHls ? urlStr : internalStreamUrl;

    const rawMode = (req.query.mode as string || '').toLowerCase().trim();
    const mode = rawMode || (req.query.transcode === 'full' ? 'transcode' : 'remux');

    console.log(`[CustomM3U stream-proxy] Spawning FFmpeg (mode=${mode}, isHls=${isHls}, isXtreamPlay=${isXtreamPlay}): ${urlStr}`);

    const args: string[] = [
        '-fflags', '+genpts+discardcorrupt+nobuffer',
        '-avoid_negative_ts', 'make_zero',
        '-rw_timeout', '30000000',
        '-analyzeduration', '5000000',
        '-probesize', '5000000',
        '-reconnect', '1',
        '-reconnect_at_eof', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '2',
        '-user_agent', userAgent
    ];

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const cleanIp = Array.isArray(clientIp) ? clientIp[0] : (clientIp as string).replace('::ffff:', '');

    let headersStr = '';
    if (referer) headersStr += `Referer: ${referer}\r\n`;
    if (shouldSendUserIp(cleanIp)) {
        headersStr += `X-Forwarded-For: ${cleanIp}\r\n`;
        headersStr += `X-Real-IP: ${cleanIp}\r\n`;
    }

    if (headersStr) {
        args.push('-headers', headersStr);
    }

    if (isHls) {
        // Use -live_start_index -3 for live HLS streams to start safely near live edge
        args.push('-live_start_index', '-3');
    }

    args.push('-i', ffmpegInput);
    args.push('-flush_packets', '1');

    if (mode === 'copy') {
        // Pure 0% CPU stream copy for both video & audio
        args.push(
            '-c', 'copy',
            '-max_muxing_queue_size', '2048',
            '-f', 'mpegts',
            '-'
        );
    } else if (mode === 'transcode') {
        // Full CPU x264 re-encode for non-H264 video streams
        args.push(
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-pix_fmt', 'yuv420p',
            '-g', '50',
            '-b:v', '1500k',
            '-maxrate', '2000k',
            '-bufsize', '4000k',
            '-c:a', 'aac',
            '-ac', '2',
            '-ar', '48000',
            '-b:a', '128k',
            '-async', '1',
            '-max_muxing_queue_size', '2048',
            '-f', 'mpegts',
            '-'
        );
    } else {
        // Default 'remux': Video stream copy (0% CPU, full 60fps) + Audio convert to AAC 2-channel 48kHz
        args.push(
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-ac', '2',
            '-ar', '48000',
            '-b:a', '128k',
            '-async', '1',
            '-max_muxing_queue_size', '2048',
            '-f', 'mpegts',
            '-'
        );
    }

    
    const outputFormat = req.query.format === 'mp4' ? 'mp4' : 'mpegts';
    if (outputFormat === 'mp4') {
        args.pop(); // remove '-'
        args.pop(); // remove 'mpegts'
        args.pop(); // remove '-f'
        args.push('-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1');
        res.setHeader('Content-Type', 'video/mp4');
    } else {
        res.setHeader('Content-Type', 'video/mp2t');
    }
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=86400, max=1000000');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.socket) {
        res.socket.setKeepAlive(true, 10000);
        res.socket.setNoDelay(true);
    }


    addStreamingIp(cleanIp);
    const onDisconnectProxy = () => removeStreamingIp(cleanIp);
    res.on('close', onDisconnectProxy);
    const ffmpegProcess: ChildProcess = spawn('ffmpeg', args);

    let hasReceivedData = false;
    const startupTimeout = setTimeout(() => {
        if (!hasReceivedData) {
            console.error('[CustomM3U stream-proxy] FFmpeg startup timeout (25s) with no video output produced.');
            killFFmpegProcess(ffmpegProcess, 'Startup timeout');
            if (!res.headersSent) {
                res.status(504).send('FFmpeg startup timeout');
            } else {
                res.end();
            }
        }
    }, 25000);

    ffmpegProcess.stdout?.on('data', (chunk) => {
        if (!hasReceivedData) {
            hasReceivedData = true;
            clearTimeout(startupTimeout);
        }
        res.write(chunk);
    });

    ffmpegProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('Server returned') || msg.includes('mime type')) {
            console.warn('[CustomM3U FFmpeg stderr]:', msg.trim());
        }
    });

    ffmpegProcess.on('exit', (code, signal) => {
        clearTimeout(startupTimeout);
        console.log(`[CustomM3U stream-proxy] FFmpeg process exited with code ${code}, signal ${signal}`);
        if (!res.headersSent) {
            res.status(500).send('FFmpeg process terminated unexpectedly');
        } else {
            res.end();
        }
    });

    ffmpegProcess.on('error', (err) => {
        clearTimeout(startupTimeout);
        console.error('[CustomM3U stream-proxy] FFmpeg failed to spawn:', err.message);
        if (!res.headersSent) {
            res.status(500).send('Failed to start FFmpeg worker');
        } else {
            res.end();
        }
    });

    function killFFmpegProcess(proc: ChildProcess, reason: string) {
        if (!proc || proc.killed) return;
        console.log(`[CustomM3U stream-proxy] Killing FFmpeg process (${reason})`);
        try {
            proc.stdout?.unpipe(res);
            proc.kill('SIGTERM');
        } catch (e) {
            // ignore
        }
        setTimeout(() => {
            if (proc && !proc.killed) {
                try {
                    proc.kill('SIGKILL');
                } catch (e) {
                    // ignore
                }
            }
        }, 2000);
    }

    const onDisconnect = () => {
        clearTimeout(startupTimeout);
        killFFmpegProcess(ffmpegProcess, 'Client disconnected');
    };

    req.on('close', onDisconnect);
    res.on('close', onDisconnect);
    res.on('finish', onDisconnect);
});

export default router;
