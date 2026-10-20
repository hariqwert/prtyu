import axios from 'axios';
import https from 'https';
import http from 'http';
import { exec, execFile } from 'child_process';
import { extractM3u8FromHtml, resolveEmbedUrl } from './timstreamsService';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 10000
});

const httpAgent = new http.Agent({
    keepAlive: true,
    timeout: 10000
});

export interface EmbedAnalysisResult {
    success: boolean;
    embedUrl: string;
    resolvedM3u8?: string;
    m3u8Url?: string;
    streamType: 'hls' | 'mp4' | 'iframe_only' | 'unknown';
    detectedCdn?: string;
    detectedReferer?: string;
    referer?: string;
    detectedOrigin?: string;
    origin?: string;
    isTokenBased: boolean;
    tokenType?: 'timstream' | 'dlhd' | 'query_token' | 'bearer' | 'none';
    requiresProxy: boolean;
    proxyUrl?: string;
    playbackUrl?: string;
    qualities: { resolution?: string; bandwidth?: number; url: string }[];
    suggestedName: string;
    inferredChannelName?: string;
    suggestedCategory: string;
    inferredCategory?: string;
    suggestedLogo: string;
    inferredLogo?: string;
    previewHtml?: string;
    rawHtmlSnippet?: string;
    error?: string;
    verifiedActive: boolean;
    latencyMs?: number;
}

// Known sports logos library for instant matching
const POPULAR_SPORTS_LOGOS: Record<string, string> = {
    'sky sports premier league': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Sky_Sports_Premier_League_logo.svg/512px-Sky_Sports_Premier_League_logo.svg.png',
    'sky sports main event': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Sky_Sports_Main_Event_logo.svg/512px-Sky_Sports_Main_Event_logo.svg.png',
    'sky sports football': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Sky_Sports_Football_logo.svg/512px-Sky_Sports_Football_logo.svg.png',
    'sky sports f1': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/Sky_Sports_F1_logo.svg/512px-Sky_Sports_F1_logo.svg.png',
    'sky sports cricket': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png',
    'sky sports tennis': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png',
    'tnt sports 1': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/TNT_Sports_1.svg/512px-TNT_Sports_1.svg.png',
    'tnt sports 2': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/TNT_Sports_2.svg/512px-TNT_Sports_2.svg.png',
    'tnt sports 3': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/TNT_Sports_3.svg/512px-TNT_Sports_3.svg.png',
    'tnt sports 4': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/TNT_Sports_4.svg/512px-TNT_Sports_4.svg.png',
    'bein sports 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/BeIN_Sports_1_logo.svg/512px-BeIN_Sports_1_logo.svg.png',
    'bein sports 2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/BeIN_Sports_2_logo.svg/512px-BeIN_Sports_2_logo.svg.png',
    'willow': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Willow_TV_logo.svg/512px-Willow_TV_logo.svg.png',
    'star sports 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Star_Sports_1_logo.svg/512px-Star_Sports_1_logo.svg.png',
    'sony sports 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sony_Sports_Network_Logo.png/512px-Sony_Sports_Network_Logo.png',
    'sony sports ten 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sony_Sports_Network_Logo.png/512px-Sony_Sports_Network_Logo.png',
    'sony sports ten 5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sony_Sports_Network_Logo.png/512px-Sony_Sports_Network_Logo.png',
    'espn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/512px-ESPN_logo.svg.png',
    'espn 2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN2_logo.svg/512px-ESPN2_logo.svg.png',
    'dazn 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/DAZN_Logo_2019.svg/512px-DAZN_Logo_2019.svg.png',
    'dazn f1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/DAZN_Logo_2019.svg/512px-DAZN_Logo_2019.svg.png'
};

/**
 * Fetch HTML via curl to bypass Cloudflare/bot restrictions
 */
function fetchCurlHtml(url: string, referer?: string): Promise<string | null> {
    return new Promise((resolve) => {
        const args = ['-s', '-L', url];
        if (referer) {
            args.push('-H', `Referer: ${referer}`);
        }
        args.push(
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '--max-time', '8'
        );
        execFile('curl', args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout || stdout.length < 30) return resolve(null);
            resolve(stdout);
        });
    });
}

/**
 * Unpack JavaScript eval(function(p,a,c,k,e,d)...)
 */
function unpackJs(code: string): string {
    const packerPattern = /eval\(function\(p,a,c,k,e,d\)\{.+?\}\((.+?)\)\)/s;
    const match = code.match(packerPattern);
    if (!match) return code;

    try {
        const argsStr = match[1];
        const lastParen = argsStr.lastIndexOf(')');
        const safeArgs = lastParen !== -1 ? argsStr.substring(0, lastParen + 1) : argsStr;
        const fn = new Function(`return (function(p,a,c,k,e,d){
            while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c]);}}
            return p;
        }(${safeArgs}))`);
        const unpacked = fn();
        return typeof unpacked === 'string' ? unpacked : code;
    } catch {
        return code;
    }
}

/**
 * Infer Channel Name & Category from URL or page content
 */
export function inferChannelMetadata(url: string, html?: string): { name: string; category: string; logo: string } {
    let rawName = '';
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const pathname = urlObj.pathname;
    const slug = pathname.split('/').filter(Boolean).pop() || '';

    // If slug has something like "sky-sports-premier-league" or "espn-usa"
    if (slug) {
        rawName = slug.replace(/[-_]/g, ' ')
            .replace(/\b(stream|embed|live|channel|hd|watch)\b/gi, '')
            .trim();
    }

    // Try HTML title if available
    if (html) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            const pageTitle = titleMatch[1].replace(/[-|].+$/, '').trim();
            if (pageTitle.length > 2 && pageTitle.length < 50 && !pageTitle.toLowerCase().includes('embed') && !pageTitle.toLowerCase().includes('player')) {
                rawName = pageTitle;
            }
        }
    }

    if (!rawName) rawName = 'Live Stream Channel';

    // Capitalize words
    const cleanName = rawName.split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    const lower = cleanName.toLowerCase();
    let category = 'Live Sports';
    if (lower.includes('cricket') || lower.includes('willow') || lower.includes('ipl')) category = 'Cricket';
    else if (lower.includes('football') || lower.includes('soccer') || lower.includes('laliga') || lower.includes('premier') || lower.includes('serie') || lower.includes('bundesliga') || lower.includes('champions')) category = 'Football';
    else if (lower.includes('f1') || lower.includes('racing') || lower.includes('motogp') || lower.includes('motorsport') || lower.includes('nascar')) category = 'F1 / Motorsport';
    else if (lower.includes('tennis') || lower.includes('wimbledon') || lower.includes('atp') || lower.includes('wta')) category = 'Tennis';
    else if (lower.includes('combat') || lower.includes('ufc') || lower.includes('wwe') || lower.includes('boxing') || lower.includes('mma')) category = 'Combat Sports';
    else if (lower.includes('nba') || lower.includes('basketball')) category = 'Basketball';
    else if (lower.includes('nfl') || lower.includes('american football')) category = 'American Football';
    else if (lower.includes('news') || lower.includes('cnn') || lower.includes('bbc')) category = 'News';
    else if (lower.includes('movie') || lower.includes('cinema') || lower.includes('hbo') || lower.includes('starz')) category = 'Movies & Entertainment';

    // Find Logo Match
    let matchedLogo = 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg';
    for (const [key, logo] of Object.entries(POPULAR_SPORTS_LOGOS)) {
        if (lower.includes(key)) {
            matchedLogo = logo;
            break;
        }
    }

    return {
        name: cleanName,
        category,
        logo: matchedLogo
    };
}

/**
 * Universal Scraper: Extract M3U8 and CDN headers from ANY embed link
 */
export async function scrapeEmbedToM3u8(embedUrl: string, customHeaders?: Record<string, string>): Promise<EmbedAnalysisResult> {
    const startTime = Date.now();
    const cleanUrl = embedUrl.trim();

    if (!cleanUrl.startsWith('http')) {
        return {
            success: false,
            embedUrl: cleanUrl,
            streamType: 'unknown',
            isTokenBased: false,
            requiresProxy: false,
            qualities: [],
            suggestedName: 'Invalid URL',
            suggestedCategory: 'Live Sports',
            suggestedLogo: '',
            error: 'URL must start with http:// or https://',
            verifiedActive: false
        };
    }

    const urlObj = new URL(cleanUrl);
    const domain = urlObj.hostname;
    const referer = customHeaders?.Referer || customHeaders?.referer || `${urlObj.protocol}//${urlObj.host}/`;
    const origin = customHeaders?.Origin || customHeaders?.origin || `${urlObj.protocol}//${urlObj.host}`;

    // 1. Check if URL is DIRECT M3U8
    if (cleanUrl.includes('.m3u8') || cleanUrl.includes('/hls/') || cleanUrl.includes('.mp4')) {
        const metadata = inferChannelMetadata(cleanUrl);
        const testRes = await testM3u8Connectivity(cleanUrl, { Referer: referer, Origin: origin });
        const isToken = /[?&](token|auth|expires|sign|h=|hdnts)=/i.test(cleanUrl);
        const proxyUrl = `/live.php?token=STALKER_PRO&url=${encodeURIComponent(cleanUrl)}`;

        return {
            success: testRes.active,
            embedUrl: cleanUrl,
            resolvedM3u8: cleanUrl,
            m3u8Url: cleanUrl,
            streamType: cleanUrl.includes('.mp4') ? 'mp4' : 'hls',
            detectedCdn: domain,
            detectedReferer: referer,
            referer: referer,
            detectedOrigin: origin,
            origin: origin,
            isTokenBased: isToken,
            tokenType: isToken ? 'query_token' : 'none',
            requiresProxy: isToken || !!testRes.requiresCorsProxy,
            proxyUrl,
            playbackUrl: proxyUrl,
            qualities: testRes.qualities,
            suggestedName: metadata.name,
            inferredChannelName: metadata.name,
            suggestedCategory: metadata.category,
            inferredCategory: metadata.category,
            suggestedLogo: metadata.logo,
            inferredLogo: metadata.logo,
            verifiedActive: testRes.active,
            latencyMs: Date.now() - startTime
        };
    }

    // 2. Check TimStreams / EpiEmbeds Embed
    if (cleanUrl.includes('epiembeds.online') || cleanUrl.includes('exmxbxe.cfd') || cleanUrl.includes('timst.cfd')) {
        try {
            const m3u8 = await resolveEmbedUrl(cleanUrl, true);
            if (m3u8) {
                const metadata = inferChannelMetadata(cleanUrl);
                const testRes = await testM3u8Connectivity(m3u8, { Referer: 'https://epiembeds.online/', Origin: 'https://epiembeds.online' });
                const proxyUrl = `/live.php?token=STALKER_PRO&id=tim_${cleanUrl.split('/').pop()}&m3u=1`;
                return {
                    success: true,
                    embedUrl: cleanUrl,
                    resolvedM3u8: m3u8,
                    m3u8Url: m3u8,
                    streamType: 'hls',
                    detectedCdn: new URL(m3u8).hostname,
                    detectedReferer: 'https://epiembeds.online/',
                    referer: 'https://epiembeds.online/',
                    detectedOrigin: 'https://epiembeds.online',
                    origin: 'https://epiembeds.online',
                    isTokenBased: true,
                    tokenType: 'timstream',
                    requiresProxy: true,
                    proxyUrl,
                    playbackUrl: proxyUrl,
                    qualities: testRes.qualities,
                    suggestedName: metadata.name,
                    inferredChannelName: metadata.name,
                    suggestedCategory: metadata.category,
                    inferredCategory: metadata.category,
                    suggestedLogo: metadata.logo,
                    inferredLogo: metadata.logo,
                    verifiedActive: testRes.active,
                    latencyMs: Date.now() - startTime
                };
            }
        } catch (e: any) {
            console.warn('[EmbedScraper] EpiEmbed resolution failed:', e?.message);
        }
    }

    // 3. Fetch Full Embed HTML via Axios and Curl fallback
    let html: string | null = null;
    try {
        const res = await axios.get(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': referer,
                'Origin': origin,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            httpsAgent,
            httpAgent,
            timeout: 7000
        });
        html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch {
        html = await fetchCurlHtml(cleanUrl, referer);
    }

    if (!html) {
        return {
            success: false,
            embedUrl: cleanUrl,
            streamType: 'unknown',
            isTokenBased: false,
            requiresProxy: false,
            qualities: [],
            suggestedName: inferChannelMetadata(cleanUrl).name,
            suggestedCategory: 'Live Sports',
            suggestedLogo: '',
            error: 'Failed to connect to embed server (Network Timeout or Anti-Bot protection).',
            verifiedActive: false
        };
    }

    // 4. Try unpacking obfuscated JavaScript
    const unpacked = unpackJs(html);
    const combinedHtml = html + '\n' + unpacked;

    // 5. Extract M3U8 from HTML using multi-pattern regex
    let extractedM3u8 = await extractM3u8FromHtml(combinedHtml);

    // Advanced search for JSON / script configs
    if (!extractedM3u8) {
        const patterns = [
            /(?:source|file|src|streamUrl|m3u8|hls)\s*[:=]\s*["'](https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)["']/i,
            /["'](https?:\/\/[^"'\s<>]+\/hls\/[^"'\s<>]*)["']/i,
            /["'](https?:\/\/[^"'\s<>]+\.m3u8(?:\?[^"'\s<>]*)?)["']/i,
            /window\.\w+\s*=\s*["'](https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)["']/i
        ];
        for (const pat of patterns) {
            const m = combinedHtml.match(pat);
            if (m && m[1] && m[1].startsWith('http')) {
                extractedM3u8 = m[1].replace(/\\/g, '');
                break;
            }
        }
    }

    // Check for base64 encoded stream
    if (!extractedM3u8) {
        const b64Match = combinedHtml.match(/atob\(["']([A-Za-z0-9+/=]{20,})["']\)/);
        if (b64Match && b64Match[1]) {
            try {
                const decoded = Buffer.from(b64Match[1], 'base64').toString('utf8');
                if (decoded.includes('.m3u8') || decoded.startsWith('http')) {
                    extractedM3u8 = decoded;
                }
            } catch {}
        }
    }

    // 6. Check for nested iframe embeds if no M3U8 found directly
    if (!extractedM3u8) {
        const iframeMatch = combinedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch && iframeMatch[1]) {
            let nestedUrl = iframeMatch[1];
            if (nestedUrl.startsWith('//')) nestedUrl = 'https:' + nestedUrl;
            else if (nestedUrl.startsWith('/')) nestedUrl = `${urlObj.protocol}//${urlObj.host}${nestedUrl}`;

            if (nestedUrl.startsWith('http') && nestedUrl !== cleanUrl) {
                // Recursive scrape on nested iframe
                const nestedResult = await scrapeEmbedToM3u8(nestedUrl, { Referer: cleanUrl, Origin: origin });
                if (nestedResult.success && nestedResult.resolvedM3u8) {
                    nestedResult.embedUrl = cleanUrl; // Keep parent embed URL
                    return nestedResult;
                }
            }
        }
    }

    const metadata = inferChannelMetadata(cleanUrl, combinedHtml);

    if (extractedM3u8) {
        const isToken = /[?&](token|auth|expires|sign|h=|hdnts)=/i.test(extractedM3u8);
        const cdnHost = new URL(extractedM3u8).hostname;
        const testRes = await testM3u8Connectivity(extractedM3u8, { Referer: cleanUrl, Origin: origin });

        const proxyUrl = `/live.php?token=STALKER_PRO&url=${encodeURIComponent(extractedM3u8)}&referer=${encodeURIComponent(cleanUrl)}`;

        return {
            success: true,
            embedUrl: cleanUrl,
            resolvedM3u8: extractedM3u8,
            m3u8Url: extractedM3u8,
            streamType: 'hls',
            detectedCdn: cdnHost,
            detectedReferer: cleanUrl,
            referer: cleanUrl,
            detectedOrigin: origin,
            origin: origin,
            isTokenBased: isToken,
            tokenType: isToken ? 'query_token' : 'none',
            requiresProxy: true,
            proxyUrl,
            playbackUrl: proxyUrl,
            qualities: testRes.qualities,
            suggestedName: metadata.name,
            inferredChannelName: metadata.name,
            suggestedCategory: metadata.category,
            inferredCategory: metadata.category,
            suggestedLogo: metadata.logo,
            inferredLogo: metadata.logo,
            rawHtmlSnippet: combinedHtml.slice(0, 500),
            verifiedActive: testRes.active,
            latencyMs: Date.now() - startTime
        };
    }

    return {
        success: false,
        embedUrl: cleanUrl,
        resolvedM3u8: '',
        m3u8Url: '',
        streamType: 'unknown',
        isTokenBased: false,
        requiresProxy: false,
        qualities: [],
        suggestedName: metadata.name,
        inferredChannelName: metadata.name,
        suggestedCategory: metadata.category,
        inferredCategory: metadata.category,
        suggestedLogo: metadata.logo,
        inferredLogo: metadata.logo,
        rawHtmlSnippet: combinedHtml.slice(0, 300),
        error: 'No direct M3U8 stream manifest could be detected inside this embed. The player may require DRM or sandbox rendering.',
        verifiedActive: false
    };
}

/**
 * Test connectivity and parse qualities of an M3U8 playlist
 */
export async function testM3u8Connectivity(m3u8Url: string, headers?: Record<string, string>): Promise<{
    active: boolean;
    statusCode: number;
    requiresCorsProxy: boolean;
    qualities: { resolution?: string; bandwidth?: number; url: string }[];
}> {
    const qualities: { resolution?: string; bandwidth?: number; url: string }[] = [];
    try {
        const res = await axios.get(m3u8Url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                ...headers
            },
            httpsAgent,
            httpAgent,
            timeout: 6000
        });

        if (res.status === 200 && typeof res.data === 'string' && res.data.includes('#EXTM3U')) {
            // Parse Stream qualities
            const lines = res.data.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXT-X-STREAM-INF:')) {
                    const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
                    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
                    const nextLine = lines[i + 1]?.trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        let streamVariantUrl = nextLine;
                        if (!streamVariantUrl.startsWith('http')) {
                            const base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
                            streamVariantUrl = base + streamVariantUrl;
                        }
                        qualities.push({
                            resolution: resMatch ? resMatch[1] : undefined,
                            bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : undefined,
                            url: streamVariantUrl
                        });
                    }
                }
            }

            if (qualities.length === 0) {
                qualities.push({ resolution: 'Direct HD Stream', url: m3u8Url });
            }

            return {
                active: true,
                statusCode: res.status,
                requiresCorsProxy: !res.headers['access-control-allow-origin'] || res.headers['access-control-allow-origin'] !== '*',
                qualities
            };
        }
        return { active: false, statusCode: res.status, requiresCorsProxy: true, qualities: [] };
    } catch (e: any) {
        return { active: false, statusCode: e?.response?.status || 500, requiresCorsProxy: true, qualities: [] };
    }
}
