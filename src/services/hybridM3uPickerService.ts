import axios, { AxiosRequestConfig } from 'axios';
import { URL } from 'url';
import { isSafeUrl } from '../proxy';

export interface M3uTestCondition {
    name: string;
    passed: boolean;
    score: number;
    maxScore: number;
    latencyMs?: number;
    detail: string;
}

export interface StreamVariantInfo {
    resolution?: string;
    bandwidth?: number;
    codecs?: string;
    url: string;
}

export interface M3uStreamDiagnostic {
    url: string;
    healthy: boolean;
    overallScore: number; // 0 - 100
    grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DEGRADED' | 'FAILED';
    latencyMs: number;
    requiresProxy: boolean;
    recommendedPlayUrl: string;
    conditions: {
        ssrfSafe: M3uTestCondition;
        handshake: M3uTestCondition;
        httpStatus: M3uTestCondition;
        mimeType: M3uTestCondition;
        cors: M3uTestCondition;
        manifestIntegrity: M3uTestCondition;
        segmentProbed: M3uTestCondition;
        experienceHeaders: M3uTestCondition;
    };
    metadata: {
        isMaster: boolean;
        isLive: boolean;
        targetDuration?: number;
        mediaSequence?: number;
        variants: StreamVariantInfo[];
        encryption: { method: string; uri?: string } | null;
        totalSegments?: number;
        sampleSegmentUrl?: string;
        segmentFormat?: 'MPEG-TS' | 'FMP4' | 'AAC' | 'UNKNOWN';
        detectedContentType?: string;
    };
    testedAt: string;
    errorReason?: string;
}

export interface HybridPickResult {
    selectedStream: M3uStreamDiagnostic | null;
    effectivePlayUrl: string;
    requiresProxy: boolean;
    failoverOrder: string[];
    allDiagnostics: M3uStreamDiagnostic[];
    totalCandidates: number;
    selectionReason: string;
}

export interface HybridTestOptions {
    timeoutMs?: number;
    referer?: string;
    userAgent?: string;
    origin?: string;
    probeSegment?: boolean;
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const STALKER_MAG_UA = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

export class HybridM3uPickerService {
    /**
     * Deeply tests a single stream URL under various multi-vector streaming conditions.
     */
    public static async testSingleStream(streamUrl: string, options: HybridTestOptions = {}): Promise<M3uStreamDiagnostic> {
        const timeoutMs = options.timeoutMs || 6500;
        const testedAt = new Date().toISOString();

        // 1. SSRF & Security Condition (Max: 10)
        let isSafe = false;
        try {
            if (streamUrl && (streamUrl.startsWith('http://') || streamUrl.startsWith('https://'))) {
                isSafe = await isSafeUrl(streamUrl);
            }
        } catch {
            isSafe = false;
        }

        const ssrfCond: M3uTestCondition = {
            name: 'Security & SSRF Verification',
            passed: isSafe,
            score: isSafe ? 10 : 0,
            maxScore: 10,
            detail: isSafe ? 'URL protocol is valid and passes SSRF boundary verification' : 'Invalid scheme or restricted private IP range'
        };

        if (!isSafe) {
            return {
                url: streamUrl,
                healthy: false,
                overallScore: 0,
                grade: 'FAILED',
                latencyMs: 0,
                requiresProxy: false,
                recommendedPlayUrl: '',
                conditions: {
                    ssrfSafe: ssrfCond,
                    handshake: { name: 'Network Handshake & Latency', passed: false, score: 0, maxScore: 15, detail: 'Skipped due to security failure' },
                    httpStatus: { name: 'HTTP Status & Redirect Resolution', passed: false, score: 0, maxScore: 15, detail: 'Skipped' },
                    mimeType: { name: 'Content-Type & Non-HTML Check', passed: false, score: 0, maxScore: 10, detail: 'Skipped' },
                    cors: { name: 'CORS Headers & Direct Playability', passed: false, score: 0, maxScore: 10, detail: 'Skipped' },
                    manifestIntegrity: { name: 'HLS Manifest Deep Verification', passed: false, score: 0, maxScore: 20, detail: 'Skipped' },
                    segmentProbed: { name: 'TS/fMP4 Segment Probe', passed: false, score: 0, maxScore: 15, detail: 'Skipped' },
                    experienceHeaders: { name: 'Anti-Block Header Resilience', passed: false, score: 0, maxScore: 5, detail: 'Skipped' }
                },
                metadata: { isMaster: false, isLive: false, variants: [], encryption: null },
                testedAt,
                errorReason: 'SSRF verification failed'
            };
        }

        // 2. Handshake & HTTP Fetch with experience-informed headers
        let primaryResponse: any = null;
        let connectLatencyMs = 0;
        let effectiveHeaders: Record<string, string> = {
            'User-Agent': options.userAgent || DEFAULT_UA,
            'Accept': '*/*'
        };
        if (options.referer) effectiveHeaders['Referer'] = options.referer;
        if (options.origin) effectiveHeaders['Origin'] = options.origin;

        let usedFallbackHeaders = false;
        const startFetch = Date.now();

        try {
            primaryResponse = await axios.get(streamUrl, {
                timeout: timeoutMs,
                headers: effectiveHeaders,
                maxRedirects: 5,
                responseType: 'text',
                validateStatus: (status) => status < 500
            });
            connectLatencyMs = Date.now() - startFetch;
        } catch (err: any) {
            connectLatencyMs = Date.now() - startFetch;
            // Experience Check: If 403 Forbidden or 401, test with Stalker MAG200 / IPTV headers
            try {
                const retryStart = Date.now();
                primaryResponse = await axios.get(streamUrl, {
                    timeout: timeoutMs,
                    headers: {
                        'User-Agent': STALKER_MAG_UA,
                        'Accept': '*/*',
                        'Referer': options.referer || streamUrl
                    },
                    maxRedirects: 5,
                    responseType: 'text',
                    validateStatus: (status) => status < 500
                });
                connectLatencyMs = Date.now() - retryStart;
                usedFallbackHeaders = true;
            } catch (err2: any) {
                // Completely unreachable
                return {
                    url: streamUrl,
                    healthy: false,
                    overallScore: ssrfCond.score,
                    grade: 'FAILED',
                    latencyMs: connectLatencyMs,
                    requiresProxy: true,
                    recommendedPlayUrl: `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}`,
                    conditions: {
                        ssrfSafe: ssrfCond,
                        handshake: { name: 'Network Handshake & Latency', passed: false, score: 0, maxScore: 15, latencyMs: connectLatencyMs, detail: `Connection failed: ${err.message || 'Timeout'}` },
                        httpStatus: { name: 'HTTP Status & Redirect Resolution', passed: false, score: 0, maxScore: 15, detail: `HTTP unreachable (${err.code || 'ERR_CONNECTION'})` },
                        mimeType: { name: 'Content-Type & Non-HTML Check', passed: false, score: 0, maxScore: 10, detail: 'No response received' },
                        cors: { name: 'CORS Headers & Direct Playability', passed: false, score: 0, maxScore: 10, detail: 'No headers received' },
                        manifestIntegrity: { name: 'HLS Manifest Deep Verification', passed: false, score: 0, maxScore: 20, detail: 'No manifest received' },
                        segmentProbed: { name: 'TS/fMP4 Segment Probe', passed: false, score: 0, maxScore: 15, detail: 'Skipped' },
                        experienceHeaders: { name: 'Anti-Block Header Resilience', passed: false, score: 0, maxScore: 5, detail: 'Failed under all header configurations' }
                    },
                    metadata: { isMaster: false, isLive: false, variants: [], encryption: null },
                    testedAt,
                    errorReason: err.message || 'Connection failed'
                };
            }
        }

        // 3. Handshake & Latency scoring (Max: 15)
        let handshakeScore = 5;
        if (connectLatencyMs < 600) handshakeScore = 15;
        else if (connectLatencyMs < 1500) handshakeScore = 12;
        else if (connectLatencyMs < 3000) handshakeScore = 8;

        const handshakeCond: M3uTestCondition = {
            name: 'Network Handshake & Latency',
            passed: connectLatencyMs < 5000,
            score: handshakeScore,
            maxScore: 15,
            latencyMs: connectLatencyMs,
            detail: `Handshake and TTFB completed in ${connectLatencyMs}ms`
        };

        // 4. HTTP Status condition (Max: 15)
        const httpStatus = primaryResponse.status;
        const isStatusOk = httpStatus === 200 || httpStatus === 206;
        let httpScore = isStatusOk ? 15 : (httpStatus === 301 || httpStatus === 302 ? 10 : 0);

        const httpCond: M3uTestCondition = {
            name: 'HTTP Status & Redirect Resolution',
            passed: isStatusOk,
            score: httpScore,
            maxScore: 15,
            detail: `Upstream returned status HTTP ${httpStatus}`
        };

        // 5. Content-Type & HTML Anti-Slop Check (Max: 10)
        const headers = primaryResponse.headers || {};
        const contentType = String(headers['content-type'] || '').toLowerCase();
        const responseBody = typeof primaryResponse.data === 'string' ? primaryResponse.data : '';
        const isHtmlLanding = contentType.includes('text/html') || responseBody.includes('<!DOCTYPE html') || responseBody.includes('<html');

        let mimeScore = 0;
        let mimePassed = false;
        let mimeDetail = '';

        if (isHtmlLanding) {
            mimeScore = 0;
            mimePassed = false;
            mimeDetail = `Returned HTML landing/error page instead of HLS stream (${contentType})`;
        } else if (contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl') || contentType.includes('application/vnd.apple.mpegurl')) {
            mimeScore = 10;
            mimePassed = true;
            mimeDetail = `Valid HLS MIME type confirmed (${contentType})`;
        } else if (contentType.includes('video/mp2t') || contentType.includes('octet-stream') || contentType.includes('text/plain')) {
            mimeScore = 8;
            mimePassed = true;
            mimeDetail = `Compatible stream MIME type (${contentType})`;
        } else {
            mimeScore = responseBody.includes('#EXTM3U') ? 7 : 0;
            mimePassed = responseBody.includes('#EXTM3U');
            mimeDetail = `Non-standard MIME (${contentType || 'none'}), ${mimePassed ? 'validated by manifest magic bytes' : 'invalid stream content'}`;
        }

        const mimeCond: M3uTestCondition = {
            name: 'Content-Type & Non-HTML Check',
            passed: mimePassed,
            score: mimeScore,
            maxScore: 10,
            detail: mimeDetail
        };

        // 6. CORS Headers & Direct Browser Playability (Max: 10)
        const corsHeader = headers['access-control-allow-origin'] || '';
        const hasOpenCors = corsHeader === '*' || corsHeader.length > 0;
        let requiresProxy = !hasOpenCors || usedFallbackHeaders;

        const corsCond: M3uTestCondition = {
            name: 'CORS Headers & Direct Playability',
            passed: hasOpenCors,
            score: hasOpenCors ? 10 : 3,
            maxScore: 10,
            detail: hasOpenCors
                ? `CORS open (${corsHeader}), direct browser playback supported`
                : 'CORS headers absent; stream proxying required for smooth playback'
        };

        // 7. HLS Manifest Deep Verification (Max: 20)
        const hasExtM3u = responseBody.includes('#EXTM3U');
        const isMaster = responseBody.includes('#EXT-X-STREAM-INF');
        const hasExtInf = responseBody.includes('#EXTINF:');
        const isLive = !responseBody.includes('#EXT-X-ENDLIST');

        let manifestScore = 0;
        let manifestPassed = false;
        let manifestDetail = '';

        const variants: StreamVariantInfo[] = [];
        let encryption: { method: string; uri?: string } | null = null;
        let targetDuration: number | undefined;
        let mediaSequence: number | undefined;
        let totalSegments = 0;
        let firstSegmentUrl: string | undefined;

        if (hasExtM3u) {
            manifestPassed = true;
            manifestScore += 10; // Base valid tag

            // Check target duration
            const targetMatch = responseBody.match(/#EXT-X-TARGETDURATION:(\d+)/i);
            if (targetMatch) targetDuration = parseInt(targetMatch[1], 10);

            // Check media sequence
            const seqMatch = responseBody.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/i);
            if (seqMatch) mediaSequence = parseInt(seqMatch[1], 10);

            // Check encryption
            const keyMatch = responseBody.match(/#EXT-X-KEY:METHOD=([^,\r\n]+)(?:,URI="([^"]+)")?/i);
            if (keyMatch) {
                encryption = {
                    method: keyMatch[1],
                    uri: keyMatch[2]
                };
            }

            if (isMaster) {
                // Parse variant streams
                manifestScore += 10;
                const lines = responseBody.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXT-X-STREAM-INF:')) {
                        const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
                        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
                        const codeMatch = line.match(/CODECS="([^"]+)"/i);
                        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                        if (nextLine && !nextLine.startsWith('#')) {
                            try {
                                const resolvedVarUrl = new URL(nextLine, streamUrl).href;
                                variants.push({
                                    resolution: resMatch ? resMatch[1] : undefined,
                                    bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : undefined,
                                    codecs: codeMatch ? codeMatch[1] : undefined,
                                    url: resolvedVarUrl
                                });
                            } catch {}
                        }
                    }
                }
                manifestDetail = `Master HLS Manifest validated with ${variants.length} variant stream(s)`;
            } else if (hasExtInf) {
                // Media playlist
                manifestScore += 8;
                const lines = responseBody.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXTINF:')) {
                        totalSegments++;
                        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                        if (nextLine && !nextLine.startsWith('#') && !firstSegmentUrl) {
                            try {
                                firstSegmentUrl = new URL(nextLine, streamUrl).href;
                            } catch {}
                        }
                    }
                }
                manifestDetail = `Media HLS Manifest validated with ${totalSegments} segment(s)${isLive ? ' (LIVE)' : ' (VOD)'}`;
            } else {
                manifestDetail = 'Valid #EXTM3U header found, but lacks standard #EXT-X-STREAM-INF or #EXTINF';
            }
        } else {
            manifestDetail = 'Stream payload does not contain valid #EXTM3U magic header';
        }

        const manifestCond: M3uTestCondition = {
            name: 'HLS Manifest Deep Verification',
            passed: manifestPassed,
            score: Math.min(20, manifestScore),
            maxScore: 20,
            detail: manifestDetail
        };

        // 8. Segment Probe & MPEG-TS / fMP4 Sync Byte Verification (Max: 15)
        let segmentScore = 0;
        let segmentPassed = false;
        let segmentFormat: 'MPEG-TS' | 'FMP4' | 'AAC' | 'UNKNOWN' = 'UNKNOWN';
        let segmentDetail = '';

        const shouldProbe = options.probeSegment !== false;

        if (shouldProbe && (firstSegmentUrl || variants.length > 0)) {
            let targetSegmentProbeUrl = firstSegmentUrl;

            // If master playlist, resolve first variant's first segment
            if (!targetSegmentProbeUrl && variants.length > 0) {
                try {
                    const variantRes = await axios.get(variants[0].url, {
                        timeout: Math.min(4000, timeoutMs),
                        headers: effectiveHeaders,
                        responseType: 'text',
                        validateStatus: (s) => s < 400
                    });
                    const vLines = variantRes.data.split(/\r?\n/);
                    for (let i = 0; i < vLines.length; i++) {
                        if (vLines[i].startsWith('#EXTINF:')) {
                            const nxt = vLines[i + 1]?.trim();
                            if (nxt && !nxt.startsWith('#')) {
                                targetSegmentProbeUrl = new URL(nxt, variants[0].url).href;
                                break;
                            }
                        }
                    }
                } catch {}
            }

            if (targetSegmentProbeUrl) {
                try {
                    const segRes = await axios.get(targetSegmentProbeUrl, {
                        timeout: Math.min(4000, timeoutMs),
                        headers: {
                            ...effectiveHeaders,
                            'Range': 'bytes=0-2048'
                        },
                        responseType: 'arraybuffer',
                        validateStatus: (s) => s < 400
                    });

                    const buffer = Buffer.from(segRes.data);
                    if (buffer.length > 0) {
                        // Check MPEG-TS sync byte 0x47 (every 188 bytes)
                        if (buffer[0] === 0x47 || (buffer.length >= 189 && buffer[188] === 0x47)) {
                            segmentFormat = 'MPEG-TS';
                            segmentPassed = true;
                            segmentScore = 15;
                            segmentDetail = `MPEG-TS segment verified with sync byte 0x47 (${buffer.length} bytes inspected)`;
                        } else if (buffer.includes(Buffer.from('ftyp')) || buffer.includes(Buffer.from('moof'))) {
                            segmentFormat = 'FMP4';
                            segmentPassed = true;
                            segmentScore = 15;
                            segmentDetail = 'Fragmented MP4 (fMP4) segment verified with ISO base media box';
                        } else if (buffer[0] === 0xff && (buffer[1] & 0xf0) === 0xf0) {
                            segmentFormat = 'AAC';
                            segmentPassed = true;
                            segmentScore = 14;
                            segmentDetail = 'AAC audio stream segment verified';
                        } else {
                            segmentFormat = 'UNKNOWN';
                            segmentPassed = true;
                            segmentScore = 10;
                            segmentDetail = `Segment returned ${buffer.length} bytes of binary payload`;
                        }
                    } else {
                        segmentDetail = 'Segment probe returned 0-byte payload';
                    }
                } catch (segErr: any) {
                    segmentPassed = false;
                    segmentScore = 0;
                    segmentDetail = `Segment probe failed (${segErr.response?.status ? 'HTTP ' + segErr.response.status : segErr.message})`;
                }
            } else {
                segmentScore = 8;
                segmentDetail = 'Segment probe skipped: no segment URL identified';
            }
        } else {
            segmentScore = manifestPassed ? 8 : 0;
            segmentDetail = 'Segment probe omitted';
        }

        const segmentCond: M3uTestCondition = {
            name: 'TS/fMP4 Segment Probe',
            passed: segmentPassed || segmentScore > 0,
            score: segmentScore,
            maxScore: 15,
            detail: segmentDetail
        };

        // 9. Anti-Block Header Resilience (Max: 5)
        const expCond: M3uTestCondition = {
            name: 'Anti-Block Header Resilience',
            passed: true,
            score: usedFallbackHeaders ? 3 : 5,
            maxScore: 5,
            detail: usedFallbackHeaders
                ? 'Required Stalker MAG200 / IPTV emulation headers to clear upstream firewall'
                : 'Compatible with standard modern web browser user-agent'
        };

        // Calculate Overall Score (0-100)
        const totalScore = ssrfCond.score + handshakeCond.score + httpCond.score + mimeCond.score + corsCond.score + manifestCond.score + segmentCond.score + expCond.score;

        let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DEGRADED' | 'FAILED' = 'FAILED';
        if (totalScore >= 85) grade = 'EXCELLENT';
        else if (totalScore >= 70) grade = 'GOOD';
        else if (totalScore >= 50) grade = 'FAIR';
        else if (totalScore >= 30) grade = 'DEGRADED';

        const healthy = totalScore >= 45 && !isHtmlLanding && httpStatus < 400;

        // Recommended play URL: proxy if required or direct if CORS is wide open
        let recommendedPlayUrl = streamUrl;
        if (requiresProxy) {
            recommendedPlayUrl = `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
            if (options.referer) recommendedPlayUrl += `&referer=${encodeURIComponent(options.referer)}`;
        }

        return {
            url: streamUrl,
            healthy,
            overallScore: totalScore,
            grade,
            latencyMs: connectLatencyMs,
            requiresProxy,
            recommendedPlayUrl,
            conditions: {
                ssrfSafe: ssrfCond,
                handshake: handshakeCond,
                httpStatus: httpCond,
                mimeType: mimeCond,
                cors: corsCond,
                manifestIntegrity: manifestCond,
                segmentProbed: segmentCond,
                experienceHeaders: expCond
            },
            metadata: {
                isMaster,
                isLive,
                targetDuration,
                mediaSequence,
                variants,
                encryption,
                totalSegments,
                sampleSegmentUrl: firstSegmentUrl,
                segmentFormat,
                detectedContentType: contentType
            },
            testedAt,
            errorReason: healthy ? undefined : (isHtmlLanding ? 'Upstream returned HTML landing page' : `Stream scored low (${totalScore}/100)`)
        };
    }

    /**
     * Hybrid Multi-Stream Picker:
     * Evaluates a pool of candidate streams against all conditions concurrently,
     * picks the highest-scoring live stream, and returns it with a prioritized failover list.
     */
    public static async pickBestM3uStream(
        candidates: Array<string | { name?: string; url: string; headers?: Record<string, string> }>,
        options: HybridTestOptions = {}
    ): Promise<HybridPickResult> {
        if (!candidates || candidates.length === 0) {
            return {
                selectedStream: null,
                effectivePlayUrl: '',
                requiresProxy: false,
                failoverOrder: [],
                allDiagnostics: [],
                totalCandidates: 0,
                selectionReason: 'No candidate stream URLs provided'
            };
        }

        // Deduplicate URLs
        const normalizedUrls: string[] = [];
        const seen = new Set<string>();

        for (const item of candidates) {
            const rawUrl = typeof item === 'string' ? item : item?.url;
            if (rawUrl && typeof rawUrl === 'string' && !seen.has(rawUrl.trim())) {
                seen.add(rawUrl.trim());
                normalizedUrls.push(rawUrl.trim());
            }
        }

        // Test in parallel (max 6 concurrent to protect network bandwidth)
        const diagnostics: M3uStreamDiagnostic[] = [];
        const batchSize = 6;

        for (let i = 0; i < normalizedUrls.length; i += batchSize) {
            const chunk = normalizedUrls.slice(i, i + batchSize);
            const chunkResults = await Promise.all(
                chunk.map((u) => this.testSingleStream(u, options))
            );
            diagnostics.push(...chunkResults);
        }

        // Sort by health first, then overallScore desc, then latency asc
        const sorted = [...diagnostics].sort((a, b) => {
            if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
            if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
            return a.latencyMs - b.latencyMs;
        });

        const selected = sorted.find((d) => d.healthy) || sorted[0] || null;

        const failoverOrder = sorted
            .filter((d) => d !== selected && d.healthy)
            .map((d) => d.recommendedPlayUrl || d.url);

        let selectionReason = 'No viable stream candidates passed health verification';
        if (selected && selected.healthy) {
            selectionReason = `Selected highest-rated candidate (${selected.grade} - Score: ${selected.overallScore}/100, Latency: ${selected.latencyMs}ms, Format: ${selected.metadata.segmentFormat || 'HLS'})`;
        }

        return {
            selectedStream: selected,
            effectivePlayUrl: selected ? selected.recommendedPlayUrl : '',
            requiresProxy: selected ? selected.requiresProxy : false,
            failoverOrder,
            allDiagnostics: sorted,
            totalCandidates: normalizedUrls.length,
            selectionReason
        };
    }
}
