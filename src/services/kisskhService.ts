import https from 'https';
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

// -------------------------------------------------------------
// KissKH Proprietary Key Token Decryption & Signature Engine
// -------------------------------------------------------------
const VI_GUID = "62f176f3bb1b5b8e70e39932ad34a0c7";
const SUB_GUID = "VgV52sWhwvBSf8BsM3BRY9weWiiCbtGp";
const APP_VER = "2.8.10";
const PLATFORM_VER = 4830201;
const APP_NAME = "kisskh";
const PRIMARY_DOMAIN = "kisskh.is";

function computeKissKhToken(
    epId: number | string,
    guid: string = VI_GUID
): string {
    function _0x3a8d(_0x526f3f: number) {
        const _0x1d5de3 = ['join','1766601DKvkfN','39aXORCP','toUpperCase','87280owbbkp','6AzawBg','fromCharCode','toString','splice','mg3c3b04ba','substr','9634ttJadP','length','referrer','499416bEetdB','platform','appCodeName','navigator','359664FzBQCJ','12yJxJzi','userAgent','1065160icGOUk','toLowerCase','document','push','charCodeAt','undefined','178276lBUtOp'];
        return _0x1d5de3[_0x526f3f - 0x10a];
    }
    function _0x1b25b9(_0x3378d3: string): [number[], number] {
        const _0x186fc8 = _0x3378d3.length;
        const _0x5ac8cf: number[] = [];
        for (let _0x2ccc5f = 0; _0x2ccc5f < _0x186fc8; _0x2ccc5f++) {
            _0x5ac8cf[_0x2ccc5f >>> 2] |= (0xff & _0x3378d3.charCodeAt(_0x2ccc5f)) << (24 - (_0x2ccc5f % 4) * 8);
        }
        return [_0x5ac8cf, _0x186fc8];
    }
    function _0x1c779c(_0x3ff981: number[], _0x459037: number): string {
        const _0x220b47: string[] = [];
        for (let _0x44ccb3 = 0; _0x44ccb3 < _0x459037; _0x44ccb3++) {
            _0x220b47.push(((_0x3ff981[_0x44ccb3 >>> 2] >>> (24 - (_0x44ccb3 % 4) * 8)) & 0xff).toString(16).padStart(2, '0'));
        }
        return _0x220b47.join('');
    }
    function _0x12af79(_0x4dcec4: string): string {
        return (_0x4dcec4 || '').substr(0, 48);
    }
    function _0x70dbf4(_0x524c4a: string): number {
        let _0x109c6f = 0;
        const _0x5ebb16 = _0x524c4a.length;
        for (let _0x419dc5 = 0; _0x419dc5 < _0x5ebb16; _0x419dc5++) {
            _0x109c6f = (_0x109c6f << 5) - _0x109c6f + _0x524c4a.charCodeAt(_0x419dc5);
        }
        return _0x109c6f;
    }
    function _0x29e11d(_0x4440b3: string): string {
        const _0x384f5f = 16 - (_0x4440b3.length % 16);
        for (let _0x120ea8 = 0; _0x120ea8 < _0x384f5f; ++_0x120ea8) {
            _0x4440b3 += String.fromCharCode(_0x384f5f);
        }
        return _0x4440b3;
    }

    const _0x6b7b62: number[][] = [[
        0x4f6bdaa3, -0x61d07350, 0x7f5e722d, -0x61210cec, 0x536620a8, -0x32b653e8, -0x4de821cb, 0x2cc92d21,
        -0x73412227, 0x41f771c1, -0xc1f500c, -0x20d67d2b, 0x2dadde47, 0x6c5aaf86, -0x6045ff8e, 0x409382a7,
        -0x6417db2, -0x6a1bd238, 0xa5e2dba, 0x4acdaf1d, 0x54c72698, -0x3edcf4b0, -0x3482d916, -0x7e4f7609,
        -0x6c9fb16c, 0x524345c4, -0x66c19cd2, 0x188eead9, -0x351884c7, -0x675bc103, 0x19a5dd3, 0x1914b70a,
        -0x4fb1e313, 0x28ea2210, 0x29707fc3, 0x3064c8c9, -0x17593e17, -0x3fb31c07, -0x16c363c6, -0x26a7ab0d,
        -0x4b793324, 0x74ca2f25, -0x62094ce1, 0x44aee7ec
    ]];

    const _0x43be17: number[] = [], _0x42a74d: number[] = [], _0xb4bd43: number[] = [], _0x25f5e6: number[] = [], _0x5d5f77: number[] = [], _0x2de806: number[] = [];
    for (let _0x21abca = 0; _0x21abca < 256; _0x21abca++) {
        _0x2de806[_0x21abca] = _0x21abca < 128 ? _0x21abca << 1 : (_0x21abca << 1) ^ 0x11b;
    }
    let _0x2119ec = 0, _0x1a0508 = 0;
    for (let _0x11eabb = 0; _0x11eabb < 256; _0x11eabb++) {
        let _0x5034cc = _0x1a0508 ^ (_0x1a0508 << 1) ^ (_0x1a0508 << 2) ^ (_0x1a0508 << 3) ^ (_0x1a0508 << 4);
        _0x5034cc = (_0x5034cc >>> 8) ^ (0xff & _0x5034cc) ^ 0x63;
        _0x43be17[_0x2119ec] = _0x5034cc;
        const _0x580af8 = _0x2de806[_0x2119ec];
        const _0x354320 = _0x2de806[_0x2de806[_0x580af8]];
        const _0x410b1f = (0x101 * _0x2de806[_0x5034cc]) ^ (0x1010100 * _0x5034cc);
        _0x42a74d[_0x2119ec] = (_0x410b1f << 24) | (_0x410b1f >>> 8);
        _0xb4bd43[_0x2119ec] = (_0x410b1f << 16) | (_0x410b1f >>> 16);
        _0x25f5e6[_0x2119ec] = (_0x410b1f << 8) | (_0x410b1f >>> 24);
        _0x5d5f77[_0x2119ec] = _0x410b1f;
        if (_0x2119ec) {
            _0x2119ec = _0x580af8 ^ _0x2de806[_0x2de806[_0x2de806[_0x354320 ^ _0x580af8]]];
            _0x1a0508 ^= _0x2de806[_0x2de806[_0x1a0508]];
        } else {
            _0x2119ec = _0x1a0508 = 1;
        }
    }
    _0x6b7b62.push(_0x42a74d);
    _0x6b7b62.push(_0xb4bd43);
    _0x6b7b62.push(_0x25f5e6);
    _0x6b7b62.push(_0x5d5f77);
    _0x6b7b62.push(_0x43be17);

    function _0x3505d7(_0x13a508: number[], _0x5baaa1: number) {
        const [_0x458390, _0x32aa26, _0x53dadc, _0x4810d1, _0x3c0f1b, _0x128bff] = _0x6b7b62;
        let _0x21ba3f: number[];
        if (_0x5baaa1 === 0) {
            _0x21ba3f = [0x1504af3, 0x56e619cf, 0x2e42bba6, -0x73c08f07];
        } else {
            _0x21ba3f = _0x13a508.slice(_0x5baaa1 - 4, _0x5baaa1);
        }
        for (let _0x5b9637 = 0; _0x5b9637 < 4; _0x5b9637++) {
            _0x13a508[_0x5baaa1 + _0x5b9637] ^= _0x21ba3f[_0x5b9637];
        }
        let _0x4d3231 = _0x13a508[_0x5baaa1] ^ _0x458390[0];
        let _0x1f3a4f = _0x13a508[_0x5baaa1 + 1] ^ _0x458390[1];
        let _0x598b52 = _0x13a508[_0x5baaa1 + 2] ^ _0x458390[2];
        let _0x2265d4 = _0x13a508[_0x5baaa1 + 3] ^ _0x458390[3];
        let _0xcb5ec5 = 4;
        for (let _0x5e2dc7 = 1; _0x5e2dc7 < 10; _0x5e2dc7++) {
            const _0x34de78 = _0x32aa26[_0x4d3231 >>> 24] ^ _0x53dadc[(_0x1f3a4f >>> 16) & 0xff] ^ _0x4810d1[(_0x598b52 >>> 8) & 0xff] ^ _0x3c0f1b[0xff & _0x2265d4] ^ _0x458390[_0xcb5ec5++];
            const _0x42d7a0 = _0x32aa26[_0x1f3a4f >>> 24] ^ _0x53dadc[(_0x598b52 >>> 16) & 0xff] ^ _0x4810d1[(_0x2265d4 >>> 8) & 0xff] ^ _0x3c0f1b[0xff & _0x4d3231] ^ _0x458390[_0xcb5ec5++];
            const _0x4a8c71 = _0x32aa26[_0x598b52 >>> 24] ^ _0x53dadc[(_0x2265d4 >>> 16) & 0xff] ^ _0x4810d1[(_0x4d3231 >>> 8) & 0xff] ^ _0x3c0f1b[0xff & _0x1f3a4f] ^ _0x458390[_0xcb5ec5++];
            _0x2265d4 = _0x32aa26[_0x2265d4 >>> 24] ^ _0x53dadc[(_0x4d3231 >>> 16) & 0xff] ^ _0x4810d1[(_0x1f3a4f >>> 8) & 0xff] ^ _0x3c0f1b[0xff & _0x598b52] ^ _0x458390[_0xcb5ec5++];
            _0x4d3231 = _0x34de78;
            _0x1f3a4f = _0x42d7a0;
            _0x598b52 = _0x4a8c71;
        }
        const _0x34de78 = ((_0x128bff[_0x4d3231 >>> 24] << 24) | (_0x128bff[(_0x1f3a4f >>> 16) & 0xff] << 16) | (_0x128bff[(_0x598b52 >>> 8) & 0xff] << 8) | _0x128bff[0xff & _0x2265d4]) ^ _0x458390[_0xcb5ec5++];
        const _0x42d7a0 = ((_0x128bff[_0x1f3a4f >>> 24] << 24) | (_0x128bff[(_0x598b52 >>> 16) & 0xff] << 16) | (_0x128bff[(_0x2265d4 >>> 8) & 0xff] << 8) | _0x128bff[0xff & _0x4d3231]) ^ _0x458390[_0xcb5ec5++];
        const _0x4a8c71 = ((_0x128bff[_0x598b52 >>> 24] << 24) | (_0x128bff[(_0x2265d4 >>> 16) & 0xff] << 16) | (_0x128bff[(_0x4d3231 >>> 8) & 0xff] << 8) | _0x128bff[0xff & _0x1f3a4f]) ^ _0x458390[_0xcb5ec5++];
        _0x2265d4 = ((_0x128bff[_0x2265d4 >>> 24] << 24) | (_0x128bff[(_0x4d3231 >>> 16) & 0xff] << 16) | (_0x128bff[(_0x1f3a4f >>> 8) & 0xff] << 8) | _0x128bff[0xff & _0x598b52]) ^ _0x458390[_0xcb5ec5++];
        _0x13a508[_0x5baaa1] = _0x34de78;
        _0x13a508[_0x5baaa1 + 1] = _0x42d7a0;
        _0x13a508[_0x5baaa1 + 2] = _0x4a8c71;
        _0x13a508[_0x5baaa1 + 3] = _0x2265d4;
    }

    const _0x5989e7: any[] = [
        '',
        epId,
        null,
        'mg3c3b04ba',
        APP_VER,
        guid,
        PLATFORM_VER,
        _0x12af79(APP_NAME),
        _0x12af79(APP_NAME.toLowerCase()),
        _0x12af79(APP_NAME),
        APP_NAME,
        APP_NAME,
        APP_NAME,
        '00',
        ''
    ];
    _0x5989e7.splice(1, 0, _0x70dbf4(_0x5989e7.join('|')));
    const _0x278f64 = _0x29e11d(_0x5989e7.join('|'));
    const [_0x3db385, _0x2f9d88] = _0x1b25b9(_0x278f64);
    const _0x5c4ece = _0x3db385.length;
    for (let _0x3835b2 = 0; _0x3835b2 < _0x5c4ece; _0x3835b2 += 4) {
        _0x3505d7(_0x3db385, _0x3835b2);
    }
    return _0x1c779c(_0x3db385, _0x2f9d88).toUpperCase();
}

async function kissKhGet(pathOrUrl: string, referer: string = `https://${PRIMARY_DOMAIN}/`): Promise<string> {
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
                'Origin': `https://${PRIMARY_DOMAIN}`,
                'Accept': 'application/json, text/plain, */*'
            },
            servername: u.hostname,
            timeout: 12000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', (err) => {
            reject(new Error(`KissKH request failed for ${u.pathname}: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`KissKH request timed out for ${u.pathname}`));
        });

        req.end();
    });
}

export interface KissKhDramaSearchItem {
    id: number;
    title: string;
    thumbnail: string;
    episodesCount: number;
    status?: string;
}

export interface KissKhDramaDetail {
    id: number;
    title: string;
    description: string;
    thumbnail: string;
    status: string;
    type: string;
    country: string;
    episodes: Array<{
        id: number;
        number: number;
        sub: number;
    }>;
}

export interface KissKhEpisodeStream {
    video: string;
    thirdParty?: string;
    subtitles?: Array<{
        src: string;
        label: string;
        land?: string;
        default?: boolean;
    }>;
}

/**
 * Search Asian dramas by title or keywords
 */
export async function searchKissKh(query: string): Promise<KissKhDramaSearchItem[]> {
    if (!query || !query.trim()) return [];
    try {
        const raw = await kissKhGet(`/api/DramaList/Search?q=${encodeURIComponent(query.trim())}`);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item: any) => ({
            id: item.id,
            title: item.title || item.name || 'Untitled Drama',
            thumbnail: item.thumbnail || '',
            episodesCount: item.episodesCount || (item.episodes ? item.episodes.length : 0),
            status: item.status || 'Completed'
        }));
    } catch (e: any) {
        console.warn(`[KissKH] Search failed for "${query}":`, e.message);
        return [];
    }
}

/**
 * Get full metadata and episode catalog for a specific drama
 */
export async function getKissKhDrama(dramaId: number | string): Promise<KissKhDramaDetail | null> {
    try {
        const raw = await kissKhGet(`/api/DramaList/Drama/${dramaId}`);
        const data = JSON.parse(raw);
        if (!data || !data.id) return null;
        return {
            id: data.id,
            title: data.title || 'Unknown Drama',
            description: data.description || '',
            thumbnail: data.thumbnail || '',
            status: data.status || 'Completed',
            type: data.type || 'Drama',
            country: data.country || 'KR',
            episodes: Array.isArray(data.episodes) ? data.episodes.map((ep: any) => ({
                id: ep.id,
                number: ep.number,
                sub: ep.sub || 1
            })) : []
        };
    } catch (e: any) {
        console.warn(`[KissKH] Failed to fetch drama details for #${dramaId}:`, e.message);
        return null;
    }
}

/**
 * Resolve direct Master HLS stream and subtitles for a specific episode using computed kkey
 */
export async function resolveKissKhEpisode(episodeId: number | string): Promise<KissKhEpisodeStream | null> {
    try {
        const videoKkey = computeKissKhToken(episodeId, VI_GUID);
        const subKkey = computeKissKhToken(episodeId, SUB_GUID);

        const [videoResRaw, subResRaw] = await Promise.all([
            kissKhGet(`/api/DramaList/Episode/${episodeId}.png?kkey=${encodeURIComponent(videoKkey)}`),
            kissKhGet(`/api/Sub/${episodeId}?kkey=${encodeURIComponent(subKkey)}`).catch(() => '[]')
        ]);

        const videoData = JSON.parse(videoResRaw);
        if (!videoData || (!videoData.Video && !videoData.video)) return null;

        let subtitles: Array<{ src: string; label: string; land?: string; default?: boolean }> = [];
        try {
            const subParsed = JSON.parse(subResRaw);
            if (Array.isArray(subParsed)) {
                subtitles = subParsed.map((s: any) => ({
                    src: s.src,
                    label: s.label || 'English',
                    land: s.land || 'en',
                    default: !!s.default
                }));
            }
        } catch {}

        return {
            video: videoData.Video || videoData.video,
            thirdParty: videoData.ThirdParty || videoData.thirdParty || '',
            subtitles
        };
    } catch (e: any) {
        console.warn(`[KissKH] Failed to resolve episode #${episodeId}:`, e.message);
        return null;
    }
}

/**
 * Generates an extended M3U (#EXTM3U) playlist for an entire Asian Drama series
 */
export async function generateKissKhM3uPlaylist(dramaId: number | string, baseUrl: string = 'http://localhost:3000'): Promise<string> {
    const drama = await getKissKhDrama(dramaId);
    if (!drama || !drama.episodes || drama.episodes.length === 0) {
        throw new Error(`Drama #${dramaId} not found or contains no episodes`);
    }

    const cleanTitle = drama.title.replace(/[\r\n",]/g, '').trim();
    const poster = drama.thumbnail || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';
    const groupName = `Asian Drama - ${cleanTitle} [${drama.country || 'Asia'}]`;

    const lines: string[] = [
        '#EXTM3U',
        `#PLAYLIST:${cleanTitle} (${drama.episodes.length} Episodes)`,
        ''
    ];

    // Sort episodes ascending (Ep 1 -> Ep N)
    const sortedEps = [...drama.episodes].sort((a, b) => a.number - b.number);

    for (const ep of sortedEps) {
        const epNum = ep.number;
        const epId = ep.id;
        const trackTitle = `${cleanTitle} - Episode ${epNum}`;
        const tvgId = `kisskh-${drama.id}-ep${epNum}`;

        // Local proxy stream URL that enforces CORS and forwards headers
        const playUrl = `${baseUrl}/api/kisskh/play.m3u8?id=${drama.id}&ep=${epNum}&epId=${epId}`;

        lines.push(
            `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${trackTitle}" tvg-logo="${poster}" group-title="${groupName}",${trackTitle}`,
            `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)`,
            `#EXTHTTP:{"Referer":"https://${PRIMARY_DOMAIN}/"}`,
            playUrl,
            ''
        );
    }

    return lines.join('\n');
}
