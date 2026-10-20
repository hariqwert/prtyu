import https from 'https';
import http from 'http';
import { Resolver } from 'dns';

const dnsResolver = new Resolver();
dnsResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const dnsCache = new Map<string, { ip: string; expires: number }>();

function resolveDns(hostname: string): Promise<string> {
    const cached = dnsCache.get(hostname);
    if (cached && cached.expires > Date.now()) {
        return Promise.resolve(cached.ip);
    }
    return new Promise((resolve) => {
        dnsResolver.resolve4(hostname, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                return resolve(hostname);
            }
            const chosen = addresses[0];
            dnsCache.set(hostname, { ip: chosen, expires: Date.now() + 10 * 60 * 1000 });
            resolve(chosen);
        });
    });
}

const PRIMARY_DOMAIN = 'asiaflix.in';

async function asiaflixGet(pathOrUrl: string, referer: string = `https://${PRIMARY_DOMAIN}/`): Promise<string> {
    const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `https://${PRIMARY_DOMAIN}${pathOrUrl}`;
    const u = new URL(fullUrl);
    const ip = await resolveDns(u.hostname);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: ip,
            port: 443,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
                'Host': u.hostname,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': referer,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            servername: u.hostname,
            timeout: 12000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout fetching from ${u.hostname}`));
        });
        req.end();
    });
}

function extractNgState(html: string): any | null {
    const match = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/i);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

export interface AsiaflixSearchResult {
    id: string;
    name: string;
    slug: string;
    image?: string;
    releaseYear?: string;
    casts?: string[];
}

export interface AsiaflixEpisodeStream {
    source: string;
    url: string;
    type?: number;
}

export interface AsiaflixEpisode {
    number: number;
    title?: string;
    epUrl?: string;
    type?: string;
    streamUrls: AsiaflixEpisodeStream[];
}

export interface AsiaflixDrama {
    id: string;
    name: string;
    slug: string;
    image?: string;
    coverImage?: string;
    description?: string;
    country?: string;
    releaseYear?: string;
    episodes: AsiaflixEpisode[];
}

/**
 * Search dramas by title on Asiaflix
 */
export async function searchAsiaflix(query: string): Promise<AsiaflixSearchResult[]> {
    if (!query) return [];
    const html = await asiaflixGet(`/search?q=${encodeURIComponent(query)}`);
    const state = extractNgState(html);
    if (!state) return [];

    for (const key of Object.keys(state)) {
        const b = state[key]?.b;
        if (b && Array.isArray(b.body)) {
            return b.body.map((item: any) => ({
                id: item._id,
                name: item.name,
                slug: item.slug || (item.name ? item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''),
                image: item.image,
                releaseYear: item.releaseYear,
                casts: Array.isArray(item.casts) ? item.casts.map((c: any) => c.name) : []
            }));
        }
    }
    return [];
}

/**
 * Get full metadata and episode catalog for an Asiaflix drama
 */
export async function getAsiaflixDrama(slugOrQuery: string): Promise<AsiaflixDrama | null> {
    let slug = slugOrQuery.trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
    let html = await asiaflixGet(`/drama/${slug}`);
    let state = extractNgState(html);

    // If initial slug lookup fails, perform search to find the correct slug
    if (!state || Object.keys(state).length <= 2) {
        const searchResults = await searchAsiaflix(slugOrQuery);
        if (searchResults.length > 0) {
            slug = searchResults[0].slug;
            html = await asiaflixGet(`/drama/${slug}`);
            state = extractNgState(html);
        }
    }

    if (!state) return null;

    for (const key of Object.keys(state)) {
        if (key === '2399756916' || key === '__nghData__') continue;
        const b = state[key]?.b;
        if (b && b.name && Array.isArray(b.episodes)) {
            return {
                id: b._id,
                name: b.name,
                slug: b.slug || slug,
                image: b.image,
                coverImage: b.coverImage,
                description: b.description || b.synopsis,
                country: b.country,
                releaseYear: b.releaseYear,
                episodes: b.episodes.map((ep: any) => ({
                    number: ep.number,
                    title: ep.title || `Episode ${ep.number}`,
                    epUrl: ep.epUrl,
                    type: ep.type,
                    streamUrls: ep.streamUrls || []
                }))
            };
        }
    }

    return null;
}

/**
 * Resolves direct HLS master.m3u8 from an embed URL (Vidmoly, etc.)
 */
async function extractMasterM3u8(embedUrl: string, referer: string = `https://${PRIMARY_DOMAIN}/`): Promise<string | null> {
    try {
        let target = embedUrl;
        if (target.includes('vidmoly.net')) {
            target = target.replace('vidmoly.net', 'vidmoly.biz');
        } else if (target.includes('vidmoly.to')) {
            target = target.replace('vidmoly.to', 'vidmoly.biz');
        }

        const html = await asiaflixGet(target, referer);
        const m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
        if (m3u8Match) {
            return m3u8Match[0];
        }
    } catch {
        // failover
    }
    return null;
}

/**
 * Resolve direct HLS stream for a specific episode of an Asiaflix drama
 */
export async function resolveAsiaflixEpisodeStream(
    slugOrQuery: string,
    episodeNum: number = 1
): Promise<{ video: string; dramaName: string; episodeNum: number; source: string } | null> {
    const drama = await getAsiaflixDrama(slugOrQuery);
    if (!drama || !drama.episodes || drama.episodes.length === 0) {
        return null;
    }

    const ep = drama.episodes.find(e => e.number === episodeNum) || drama.episodes[0];
    if (!ep || !ep.streamUrls || ep.streamUrls.length === 0) {
        return null;
    }

    // Try vidmoly sources first (highest reliability, unencrypted master.m3u8)
    const vidmolySources = ep.streamUrls.filter(s => s.source === 'vidmoly');
    for (const v of vidmolySources) {
        if (!v.url) continue;
        const m3u8 = await extractMasterM3u8(v.url);
        if (m3u8) {
            return {
                video: m3u8,
                dramaName: drama.name,
                episodeNum: ep.number,
                source: 'vidmoly'
            };
        }
    }

    // Try other sources as fallback
    for (const s of ep.streamUrls) {
        if (!s.url || s.source === 'vidmoly') continue;
        const m3u8 = await extractMasterM3u8(s.url);
        if (m3u8) {
            return {
                video: m3u8,
                dramaName: drama.name,
                episodeNum: ep.number,
                source: s.source
            };
        }
    }

    return null;
}

/**
 * Generate standard #EXTM3U playlist for an entire Asiaflix drama series
 */
export async function generateAsiaflixM3u(slugOrQuery: string, baseUrl: string): Promise<string> {
    const drama = await getAsiaflixDrama(slugOrQuery);
    if (!drama) {
        return '#EXTM3U\n#ERROR: Drama not found on Asiaflix\n';
    }

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push(`#PLAYLIST:${drama.name} (${drama.episodes.length} Episodes)`);
    lines.push('');

    const logo = drama.image || drama.coverImage || '';
    const groupTitle = `Asian Drama - ${drama.name} [Asiaflix]`;

    for (const ep of drama.episodes) {
        const title = `${drama.name} - Episode ${ep.number}`;
        const tvgId = `asiaflix-${drama.slug}-ep${ep.number}`;
        const playUrl = `${baseUrl}/api/asiaflix/play.m3u8?slug=${encodeURIComponent(drama.slug)}&ep=${ep.number}`;

        lines.push(`#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${title}" tvg-logo="${logo}" group-title="${groupTitle}",${title}`);
        lines.push('#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
        lines.push(`#EXTHTTP:{"Referer":"https://${PRIMARY_DOMAIN}/"}`);
        lines.push(playUrl);
        lines.push('');
    }

    return lines.join('\n');
}
