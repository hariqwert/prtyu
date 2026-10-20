import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import http from 'http';
import https from 'https';
import jwt from 'jsonwebtoken';
import { XtreamAPI } from './xtream/XtreamAPI';
import { LogoService } from './services/logoService';

const DARK_SIDE = path.join(process.cwd(), 'doctor_strange');
const LIGHT_SIDE = path.join(process.cwd(), 'cache_stalker');
const JWT_SECRET = process.env.JWT_SECRET || 'stalker_pro_ultra_secure_secret_token_2026';

// Create folders if they do not exist
if (!fs.existsSync(DARK_SIDE)) {
    fs.mkdirSync(DARK_SIDE, { recursive: true });
}
if (!fs.existsSync(LIGHT_SIDE)) {
    fs.mkdirSync(LIGHT_SIDE, { recursive: true });
}

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 30000
});
const httpAgent = new http.Agent({
    keepAlive: true,
    timeout: 30000
});

export interface StalkerConfig {
    type?: 'stalker' | 'xtream';
    URL?: string;
    url?: string;
    MAC?: string;
    mac?: string;
    SN?: string;
    sn?: string;
    D1?: string;
    d1?: string;
    device_id?: string;
    D2?: string;
    d2?: string;
    device_id2?: string;
    SG?: string;
    Model?: string;
    model?: string;
    Proxy?: string;
    API?: string;
    api?: string;
    signature?: string;
    Share?: string;
    hw_version?: string;
    hw_version_2?: string;
    generated_time?: number;
    username?: string;
    password?: string;
    Name?: string;
    name?: string;
    id?: string;
    [key: string]: any;
}

export class StalkerAPI {
    
    static vision_logs(message: string, level: string = 'INFO') {
        const logFile = path.join(DARK_SIDE, 'multiverse.log');
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const formatted = `[${timestamp}] [${level}] ${message}\n`;
        fs.appendFileSync(logFile, formatted);
    }

    static getApiUrl(portalUrl: string): string {
        let clean = (portalUrl || '').trim().replace(/\/+$/, '');
        if (clean.includes('/server/load.php')) return clean;
        if (clean.endsWith('/c')) clean = clean.slice(0, -2);
        if ((clean.includes('b4u.live') || clean.includes('tatasky.xyz') || clean.includes('geoent.cc')) && !clean.includes('/stalker_portal')) {
            clean = `${clean}/stalker_portal`;
        }
        return `${clean}/server/load.php`;
    }

    private static keyCache = new Map<string, Buffer>();

    static scarletWitch(action: 'encrypt' | 'decrypt', data: string, passphrase: string = 'STALKER_PRO'): string {
        const cipherName = 'aes-256-cbc';
        const hashAlgo = 'sha256';
        
        let key = StalkerAPI.keyCache.get(passphrase);
        if (!key) {
            const saltStr = crypto.createHash(hashAlgo).update('CHAOS_MAGIC_SALT').digest('hex');
            const salt = Buffer.from(saltStr, 'utf8');
            key = crypto.pbkdf2Sync(passphrase, salt, 10000, 32, hashAlgo);
            StalkerAPI.keyCache.set(passphrase, key);
        }

        if (action === 'encrypt') {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(cipherName, key, iv);
            let ciphertext = cipher.update(data, 'utf8');
            ciphertext = Buffer.concat([ciphertext, cipher.final()]);
            const hmac = crypto.createHmac(hashAlgo, key).update(ciphertext).digest();
            const combined = Buffer.concat([iv, hmac, ciphertext]);
            return combined.toString('hex');
        } else if (action === 'decrypt') {
            try {
                const combined = Buffer.from(data, 'hex');
                if (combined.length < 48) {
                    return "Integrity check failed: Data is too short.";
                }
                const iv = combined.subarray(0, 16);
                const hmac = combined.subarray(16, 48);
                const ciphertext = combined.subarray(48);

                const calculatedHmac = crypto.createHmac(hashAlgo, key).update(ciphertext).digest();
                if (!crypto.timingSafeEqual(hmac, calculatedHmac)) {
                    return "Integrity check failed: Data has been tampered with.";
                }

                const decipher = crypto.createDecipheriv(cipherName, key, iv);
                let decrypted = decipher.update(ciphertext, undefined, 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            } catch (e: any) {
                return "Decryption failed.";
            }
        }
        return "Invalid action.";
    }

    static Stark_Industries() {
        return {
            api_endpoint: {
                img_cdn_url: "",
                epg: "https://tsepg.cf/epg.xml.gz",
                heartbeat_headers: "",
                zee5: "",
                live_channels: ""
            },
            heartbeat_api: {
                url: "",
                heartbeat: "OFF",
                cdn_type: "google",
                note: "Updated",
                updatedBy: "STALKER TEAM",
                base: "JIOTV",
                domain: "",
                headers: {
                    "x-api-key": "",
                    "User-Agent": "STALKER_PRO"
                }
            },
            STALKER_UNIVERSE: {
                "x-developed-by": "STALKER_PRO_DEV",
                token: "STALKER_PRO",
                "X-POWERED-BY": "STALKER-PRO",
                "X-GITHUB-USERNAME": "stalkerpro",
                DEV_NAME: "STALKER TEAM",
                live_cache: true
            },
            addon_service: {
                fancode: "",
                sonyliv: "",
                icc: ""
            },
            meta_data: {
                fallback_video: "https://video.twimg.com/amplify_video/1797150287292981248/pl/-GLBpWJuiNKBrdvp.m3u8",
                himg: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=80",
                hname: "STALKER PRO",
                ppimg: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&h=250&q=80",
                jpimg: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&h=250&q=80",
                Rimg: "",
                Limg: "",
                bgpic: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80",
                span: ["S", "T", "A", "L", "K", "E", "R", "P", "R", "O"],
                pstatus: "WORKING \u2705",
                plast: "2 JUNE \u267b\ufe0f",
                error: "",
                key: "STALKER_PRO",
                message1: "",
                message2: "",
                message3: "",
                message4: "",
                message5: "",
                message6: "",
                message7: "",
                message8: "",
                message9: "",
                message10: "",
                message11: "",
                message12: "",
                message13: "",
                message14: "",
                url: "",
                mac: "",
                pro_user: "PRO USER",
                latest_script: "StalkerPro v1.0.0",
                play: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
            },
            token_share: "",
            key: "",
            worldwide: "",
            message: [
                {
                    message: "",
                    color: "#FFD700",
                    tag_op: "<h3>",
                    tag_c: "</h3>"
                }
            ]
        };
    }

    static getMessage(christine: any, statusCode: number, rawData?: string, portal?: any): string {
        if (rawData && typeof rawData === 'string' && rawData.includes("Authorization failed")) {
            const host_id = StalkerAPI.getHostId(portal);
            const tokenStalkerPath = path.join(DARK_SIDE, `token_${host_id}.stalker`);
            if (fs.existsSync(tokenStalkerPath)) fs.unlinkSync(tokenStalkerPath);
            return "Authorization Expired ⚠️ Please click Re-authenticate.";
        }
        if (christine?.js?.msg) return christine.js.msg;
        if (statusCode === 401) return "Unauthorized ❌ Login expired or invalid MAC.";
        if (statusCode === 403) return "Forbidden 🚫 Portal blocked your request.";
        if (statusCode === 404) return "Not Found 🔍 Resource missing.";
        if (statusCode === 429) return "Too Many Requests ⚠️ Slow down or try again later.";
        if (statusCode >= 500) return "Server Error 💥 Portal is unstable.";
        if (!christine) return "Empty response ⚠️ No data received from portal: " + (portal ? portal.URL : "");
        return "Unknown error occurred.";
    }

    static async stalkerRequest(
        targetUrl: string,
        headersArray: string[],
        method: 'GET' | 'POST' = 'GET',
        body: any = null,
        followRedirect: boolean = true
    ): Promise<any> {
        if (!targetUrl || targetUrl.includes('undefined.m3u8') || !targetUrl.startsWith('http')) {
            return {
                STALKER: {
                    data: '',
                    info: {
                        http_code: 404,
                        content_type: 'text/html',
                        redirect_url: undefined,
                        final_url: targetUrl || ''
                    },
                    THOR: "JANE_FOSTER",
                    LOKI: "SYLVIE",
                    DOCTOR_STRANGE: "CHRISTINE",
                    Date: new Date().toString()
                }
            };
        }

        const headers: Record<string, string> = {};
        for (const h of headersArray) {
            const colonIndex = h.indexOf(':');
            if (colonIndex !== -1) {
                const key = h.substring(0, colonIndex).trim();
                const val = h.substring(colonIndex + 1).trim();
                headers[key] = val;
            }
        }

        if (targetUrl.includes('hundxvision') || targetUrl.includes('exmxbxe')) {
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            headers['Referer'] = 'https://exmxbxe.cfd/';
            headers['Origin'] = 'https://exmxbxe.cfd';
            headers['Accept'] = '*/*';
            delete headers['Authorization'];
            delete headers['authorization'];
            delete headers['Cookie'];
            delete headers['cookie'];
            delete headers['X-User-Agent'];
            delete headers['x-user-agent'];
        } else if (targetUrl.includes('timst') || targetUrl.includes('tiktokcdn') || targetUrl.includes('casadenoval') || targetUrl.includes('diffevixed') || targetUrl.includes('vilevodules') || targetUrl.includes('hiveatick') || targetUrl.includes('cdx-08192') || targetUrl.includes('epidd') || targetUrl.includes('epiembeds') || targetUrl.includes('embedindia')) {
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            headers['Referer'] = 'https://timst.cfd/';
            headers['Origin'] = 'https://timst.cfd';
            headers['Accept'] = '*/*';
            delete headers['Authorization'];
            delete headers['authorization'];
            delete headers['Cookie'];
            delete headers['cookie'];
            delete headers['X-User-Agent'];
            delete headers['x-user-agent'];
        } else if (targetUrl.includes('kliv.in') || targetUrl.includes('slivcdn.com') || targetUrl.includes('dishmt.com') || targetUrl.includes('sonyliv.com')) {
            headers['User-Agent'] = 'VLC/3.0.18';
            headers['Referer'] = 'https://kliv.in/';
            headers['Origin'] = 'https://kliv.in/';
            headers['Accept'] = '*/*';
        }

        try {
            const response = await axios({
                url: targetUrl,
                method: method,
                headers: headers,
                data: body,
                httpAgent,
                httpsAgent,
                timeout: (targetUrl.includes('acek-cdn') || targetUrl.includes('cloudmelvaro')) ? 2000 : 15000,
                validateStatus: () => true,
                maxRedirects: followRedirect ? 5 : 0,
                responseType: 'text'
            });

            // Handle 301/302 redirects explicitly if location header is present or status code is 3xx
            if (followRedirect && [301, 302, 303, 307, 308].includes(response.status) && response.headers['location']) {
                let redirectLoc = response.headers['location'] as string;
                if (!redirectLoc.startsWith('http')) {
                    try {
                        redirectLoc = new URL(redirectLoc, targetUrl).href;
                    } catch (e) {}
                }
                const redirectHeaders = { ...headers };
                if (redirectLoc.includes('hundxvision') || redirectLoc.includes('exmxbxe')) {
                    redirectHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
                    redirectHeaders['Referer'] = 'https://exmxbxe.cfd/';
                    redirectHeaders['Origin'] = 'https://exmxbxe.cfd';
                    redirectHeaders['Accept'] = '*/*';
                    delete redirectHeaders['Authorization'];
                    delete redirectHeaders['authorization'];
                    delete redirectHeaders['Cookie'];
                    delete redirectHeaders['cookie'];
                    delete redirectHeaders['X-User-Agent'];
                    delete redirectHeaders['x-user-agent'];
                } else if (redirectLoc.includes('timst') || redirectLoc.includes('tiktokcdn') || redirectLoc.includes('casadenoval') || redirectLoc.includes('diffevixed') || redirectLoc.includes('vilevodules') || redirectLoc.includes('hiveatick') || redirectLoc.includes('cdx-08192') || redirectLoc.includes('epidd') || redirectLoc.includes('epiembeds') || redirectLoc.includes('embedindia')) {
                    redirectHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
                    redirectHeaders['Referer'] = 'https://timst.cfd/';
                    redirectHeaders['Origin'] = 'https://timst.cfd';
                    redirectHeaders['Accept'] = '*/*';
                    delete redirectHeaders['Authorization'];
                    delete redirectHeaders['authorization'];
                    delete redirectHeaders['Cookie'];
                    delete redirectHeaders['cookie'];
                    delete redirectHeaders['X-User-Agent'];
                    delete redirectHeaders['x-user-agent'];
                } else if (redirectLoc.includes('slivcdn.com') || redirectLoc.includes('dishmt.com') || redirectLoc.includes('kliv.in') || targetUrl.includes('kliv.in') || redirectLoc.includes('sonyliv.com')) {
                    redirectHeaders['User-Agent'] = 'VLC/3.0.18';
                    redirectHeaders['Referer'] = 'https://kliv.in/';
                    redirectHeaders['Origin'] = 'https://kliv.in/';
                    redirectHeaders['Accept'] = '*/*';
                }
                try {
                    const redirectedResponse = await axios({
                        url: redirectLoc,
                        method: method,
                        headers: redirectHeaders,
                        data: body,
                        httpAgent,
                        httpsAgent,
                        timeout: 15000,
                        validateStatus: () => true,
                        maxRedirects: 5,
                        responseType: 'text'
                    });
                    return {
                        STALKER: {
                            data: redirectedResponse.data,
                            info: {
                                http_code: redirectedResponse.status,
                                content_type: redirectedResponse.headers['content-type'] || 'text/html',
                                redirect_url: redirectLoc,
                                final_url: redirectedResponse.request?.res?.responseUrl || redirectedResponse.config?.url || redirectLoc
                            },
                            THOR: "JANE_FOSTER",
                            LOKI: "SYLVIE",
                            DOCTOR_STRANGE: "CHRISTINE",
                            Date: new Date().toString()
                        }
                    };
                } catch (rErr) {}
            }

            // Automatic 404 fallback for Stalker portals with alternative path structures
            if (response.status === 404 && targetUrl.includes('/server/load.php')) {
                let altUrl = '';
                if (!targetUrl.includes('/stalker_portal/server/load.php')) {
                    altUrl = targetUrl.replace('/server/load.php', '/stalker_portal/server/load.php');
                } else {
                    altUrl = targetUrl.replace('/stalker_portal/server/load.php', '/server/load.php');
                }

                if (altUrl && altUrl !== targetUrl) {
                    try {
                        const altRes = await axios({
                            url: altUrl,
                            method: method,
                            headers: headers,
                            data: body,
                            httpAgent,
                            httpsAgent,
                            timeout: 15000,
                            validateStatus: () => true,
                            maxRedirects: followRedirect ? 5 : 0,
                            responseType: 'text'
                        });
                        if (altRes.status === 200) {
                            return {
                                STALKER: {
                                    data: altRes.data,
                                    info: {
                                        http_code: altRes.status,
                                        content_type: altRes.headers['content-type'] || 'text/html',
                                        redirect_url: altRes.headers['location'] as string | undefined,
                                        final_url: altRes.request?.res?.responseUrl || altRes.config?.url || altUrl
                                    },
                                    THOR: "JANE_FOSTER",
                                    LOKI: "SYLVIE",
                                    DOCTOR_STRANGE: "CHRISTINE",
                                    Date: new Date().toString()
                                }
                            };
                        }
                    } catch (altErr) {}
                }
            }

            return {
                STALKER: {
                    data: response.data,
                    info: {
                        http_code: response.status,
                        content_type: response.headers['content-type'] || 'text/html',
                        redirect_url: response.headers['location'] as string | undefined,
                        final_url: response.request?.res?.responseUrl || response.config?.url || targetUrl
                    },
                    THOR: "JANE_FOSTER",
                    LOKI: "SYLVIE",
                    DOCTOR_STRANGE: "CHRISTINE",
                    Date: new Date().toString()
                }
            };
        } catch (e: any) {
            console.error(`[StalkerAPI] stalkerRequest failed for ${targetUrl}:`, e.message);
            return {
                STALKER: {
                    data: '',
                    info: {
                        http_code: e.response?.status || 500,
                        content_type: 'text/html',
                        redirect_url: undefined,
                        final_url: targetUrl
                    },
                    THOR: "JANE_FOSTER",
                    LOKI: "SYLVIE",
                    DOCTOR_STRANGE: "CHRISTINE",
                    Date: new Date().toString()
                }
            };
        }
    }

    static image(rolex: string, portalUrl?: string): string {
        const fallback = "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=80";
        if (!rolex || typeof rolex !== 'string') return fallback;

        const cleanName = rolex.replace(/\.(png|jpg|jpeg)$/i, '');
        if (/^\d+$/.test(cleanName)) {
            return (portalUrl || '') + '/misc/logos/320/' + rolex;
        } else if (rolex.startsWith('http')) {
            return rolex;
        } else if (rolex.startsWith('/')) {
            if (!portalUrl) return rolex;
            try {
                const u = new URL(portalUrl);
                return u.origin + rolex;
            } catch (e) {
                return portalUrl + rolex;
            }
        } else if (rolex) {
            if (!portalUrl) return rolex;
            return portalUrl + '/' + rolex.replace(/^\/+/, '');
        }
        return fallback;
    }

    static match_iptv_logo(name: string, xmltv_id: string, logoMap?: any): string {
        return LogoService.getLogoForChannel(name, xmltv_id);
    }

    static async get_iptv_org_logo_map(): Promise<any> {
        const cacheFile = path.join(DARK_SIDE, 'iptv_logo_map.json');
        
        if (fs.existsSync(cacheFile)) {
            try {
                const stat = fs.statSync(cacheFile);
                // 7 days cache limit (7 * 24 * 60 * 60 * 1000)
                if (Date.now() - stat.mtimeMs < 7 * 86400 * 1000) {
                    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                    if (data && data.ids && data.names) {
                        return data;
                    }
                }
            } catch (e) {
                // ignore and rebuild
            }
        }

        this.vision_logs("Fetching latest logos from iptv-org to populate cache...");
        
        try {
            const contextOptions = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTV-Player'
                },
                timeout: 8000,
                httpsAgent
            };

            const logosRes = await axios.get("https://iptv-org.github.io/api/logos.json", contextOptions);
            const channelsRes = await axios.get("https://iptv-org.github.io/api/channels.json", contextOptions);

            const logos = logosRes.data;
            const channels = channelsRes.data;

            if (Array.isArray(logos) && Array.isArray(channels)) {
                const logo_map: Record<string, string> = {};
                for (const lg of logos) {
                    if (lg?.url) {
                        logo_map[lg.channel.toLowerCase()] = lg.url;
                    }
                }

                const compiled_map: any = {
                    ids: logo_map,
                    names: {}
                };

                for (const ch of channels) {
                    const id = ch?.id?.toLowerCase();
                    if (id && logo_map[id]) {
                        const logo_url = logo_map[id];
                        
                        let cl_name = ch.name ? ch.name.toLowerCase() : '';
                        cl_name = cl_name.replace(/\b(4k|hd|sd|fhd|hevc|h264|h265|ca|usa|uk|us|ca|canada|in|vip|backup|east|west|latino|multiaudio)\b/gi, "");
                        cl_name = cl_name.replace(/[^a-z0-9]/gi, "");
                        cl_name = cl_name.trim();
                        if (cl_name) {
                            compiled_map.names[cl_name] = logo_url;
                        }

                        if (ch.alt_names && Array.isArray(ch.alt_names)) {
                            for (const alt of ch.alt_names) {
                                let cl_alt = alt ? alt.toLowerCase() : '';
                                cl_alt = cl_alt.replace(/\b(4k|hd|sd|fhd|hevc|h264|h265|ca|usa|uk|us|ca|canada|in|vip|backup|east|west|latino|multiaudio)\b/gi, "");
                                cl_alt = cl_alt.replace(/[^a-z0-9]/gi, "");
                                cl_alt = cl_alt.trim();
                                if (cl_alt) {
                                    compiled_map.names[cl_alt] = logo_url;
                                }
                            }
                        }
                    }
                }

                fs.writeFileSync(cacheFile, JSON.stringify(compiled_map, null, 2), 'utf8');
                return compiled_map;
            }
        } catch (err) {
            this.vision_logs("Failed to download logo data from iptv-org. Falling back to cache.");
        }

        if (fs.existsSync(cacheFile)) {
            try {
                return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            } catch (e) {
                // ignore
            }
        }
        return { ids: {}, names: {} };
    }

    static id_generator(cmd: string): string {
        let clean = (cmd || '').trim();
        if (clean.includes('http://localhost/ch/')) {
            clean = clean.replace(/ffrt http:\/\/localhost\/ch\//i, '');
            clean = clean.replace(/ffmpeg http:\/\/localhost\/ch\//i, '');
        } else if (clean.includes('http:///ch/')) {
            clean = clean.replace(/ffrt http:\/\/\/ch\//i, '');
            clean = clean.replace(/ffmpeg http:\/\/\/ch\//i, '');
        } else if (clean.includes('auto ')) {
            clean = Buffer.from(clean.replace('auto ', '')).toString('base64');
        } else {
            clean = clean.replace(/^ffrt\s+/i, '').replace(/^ffmpeg\s+/i, '');
        }
        return clean.trim();
    }

    static async handshake(portal: StalkerConfig, token: string = ''): Promise<any> {
        const time = Math.floor(Date.now() / 1000);
        const portalUrl = portal.URL || portal.url || '';
        const portalMac = portal.MAC || portal.mac || '';
        const portalModel = portal.Model || portal.model || 'MAG250';

        const url = `${StalkerAPI.getApiUrl(portalUrl)}?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
        const headers = [
            "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
            "Connection: Keep-Alive",
            `X-User-Agent: Model: ${portalModel}; Link: WiFi`,
            `Referer: ${portalUrl}/c/`,
            `Cookie: mac=${portalMac}; stb_lang=en; timezone=GMT`
        ];

        const response = await this.stalkerRequest(url, headers, 'GET');
        
        if (response.STALKER.info.http_code === 404) {
            console.error(`[StalkerAPI] 404 error fetching from ${url}`);
        }
        
        let parsed: any = null;
        try {
            parsed = JSON.parse(response.STALKER.data);
        } catch (e) {
            // ignore
        }

        const statusCode = response.STALKER.info.http_code;
        if (parsed?.js?.token && statusCode === 200) {
            this.vision_logs(`Handshake Successful. Token generated for: ${portal.URL}`);
            return {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    generated_time: token ? portal.generated_time || time : time,
                    message: "Handshake token generated successfully.",
                    Token: parsed.js.token,
                    Random: parsed.js.random,
                    URL: portal.URL,
                    Statuscode: statusCode,
                    data: parsed
                }
            };
        } else {
            this.vision_logs(`Handshake Failed for ${portal.URL} - Code: ${statusCode}`, "ERROR");
            return {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                    block_msg: parsed?.js?.block_msg,
                    Statuscode: statusCode,
                    data: parsed,
                    raw: response.STALKER.data
                }
            };
        }
    }

    static async get_profile(portal: StalkerConfig, token: string = ''): Promise<any> {
        let handshakeResult: any = null;
        if (token) {
            handshakeResult = await this.handshake(portal, token);
            if (!handshakeResult?.STALKER?.Token || handshakeResult.STALKER.Statuscode !== 200) {
                this.vision_logs("Handshake with cached token failed. Falling back to fresh handshake.");
                handshakeResult = await this.handshake(portal);
            }
        } else {
            handshakeResult = await this.handshake(portal);
        }

        if (!handshakeResult?.STALKER?.Token || handshakeResult.STALKER.Statuscode !== 200) {
            return JSON.stringify(handshakeResult);
        }

        const activeToken = handshakeResult.STALKER.Token;
        const genTime = handshakeResult.STALKER.generated_time;
        if (!token) {
            portal.generated_time = genTime;
        }

        const base = StalkerAPI.getApiUrl(portal.URL || portal.url || '');
        const sn = portal.SN || portal.sn || '';
        const d1 = portal.D1 || portal.d1 || portal.device_id || '';
        const d2 = portal.D2 || portal.d2 || portal.device_id2 || '';
        const apiSig = portal.API || portal.api || portal.signature || '263';
        const hwVer = portal.hw_version || '';
        const hwVer2 = portal.hw_version_2 || '';
        const model = portal.Model || portal.model || 'MAG250';
        const mac = portal.MAC || portal.mac || '';

        const params = new URLSearchParams({
            type: "stb",
            action: "get_profile",
            hd: "1",
            ver: "ImageDescription: 0.2.18-r14-pub-250; ImageDate: Fri Jan 15 15:20:44 EET 2016; PORTAL version: 5.1.0; API Version: JS API version: 328; STB API version: 134; Player Engine version: 0x566",
            num_banks: "2",
            sn: sn,
            stb_type: model,
            image_version: "218",
            video_out: "hdmi",
            device_id: d1,
            device_id2: d2,
            signature: apiSig,
            auth_second_step: "1",
            hw_version: hwVer,
            not_valid_token: "0",
            client_type: "STB",
            hw_version_2: hwVer2,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            api_signature: apiSig,
            metrics: JSON.stringify({
                mac: mac,
                sn: sn,
                model: model,
                type: "STB",
                uid: "",
                random: handshakeResult.STALKER.Random
            }),
            JsHttpRequest: "1-xml"
        });

        const targetUrl = `${base}?${params.toString()}`;
        const headers = [
            "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
            "Connection: Keep-Alive",
            `X-User-Agent: Model: ${portal.Model}; Link: WiFi`,
            `Referer: ${portal.URL}/c/`,
            `Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`,
            `Authorization: Bearer ${activeToken}`
        ];

        const response = await this.stalkerRequest(targetUrl, headers, 'GET');
        let parsed: any = null;
        try {
            parsed = JSON.parse(response.STALKER.data);
        } catch (e) {
            // ignore
        }

        const statusCode = response.STALKER.info.http_code;
        if (parsed?.js?.password && statusCode === 200) {
            const host_id = StalkerAPI.getHostId(portal);
            const tokenPath = path.join(DARK_SIDE, `token_${host_id}.stalker`);
            const livePath = path.join(DARK_SIDE, `live_${host_id}.stalker`);
            const genrePath = path.join(DARK_SIDE, `genre_${host_id}.json`);
            
            if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
            if (fs.existsSync(livePath)) fs.unlinkSync(livePath);
            if (fs.existsSync(genrePath)) fs.unlinkSync(genrePath);

            // Clear directory cache_stalker
            const cachedFiles = fs.readdirSync(LIGHT_SIDE);
            for (const file of cachedFiles) {
                try {
                    // Only delete files that are related to THIS host if possible, 
                    // but for now clearing all is fine or we can prefix them.
                    fs.unlinkSync(path.join(LIGHT_SIDE, file));
                } catch (e) {
                    // ignore
                }
            }

            const loginPath = path.join(DARK_SIDE, 'login.stalker');
            if (!portal.type) portal.type = 'stalker';
            // Only write to login.stalker if it doesn't exist (initial setup)
            if (!fs.existsSync(loginPath)) {
                fs.writeFileSync(loginPath, JSON.stringify(portal), 'utf8');
            }

            const host = new URL(portal.URL || portal.url || 'http://localhost').host;
            fs.writeFileSync(path.join(DARK_SIDE, `${host}.json`), JSON.stringify(portal), 'utf8');

            const exp = parsed.js.expirydate || parsed.js.expire_billing_date || "Unlimited";
            const name = parsed.js.name || parsed.js.fname || "Guest User";

            const result = {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: "Stalker data Fetched Successfully.",
                    generated_time: genTime,
                    Token: activeToken,
                    device_id: portal.D1,
                    device_id2: portal.D2,
                    sig: portal.SN,
                    settings_password: parsed.js.parent_password || "0000",
                    Random: handshakeResult.STALKER.Random,
                    URL: portal.URL + "/c/",
                    Name: name,
                    login: parsed.js.login || null,
                    Password: parsed.js.password || null,
                    parent_password: parsed.js.parent_password || "0000",
                    mac: parsed.js.mac || null,
                    expirydate: exp,
                    statusCode: statusCode,
                    Date: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    handshake: handshakeResult,
                    data: parsed
                }
            };

            fs.writeFileSync(tokenPath, JSON.stringify(result, null, 2), 'utf8');
            return JSON.stringify(result);
        } else {
            return JSON.stringify({
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                    Statuscode: statusCode || handshakeResult.STALKER.Statuscode,
                    raw: response.STALKER.data,
                    data: parsed
                }
            });
        }
    }

    static async getXtreamProfile(config: any): Promise<any> {
        try {
            const api = new XtreamAPI(config);
            const data = await api.authenticate();

            const expEpoch = data.user_info.exp_date ? parseInt(data.user_info.exp_date) : null;
            let expiryDate = "Unlimited";
            if (expEpoch) {
                expiryDate = new Date(expEpoch * 1000).toISOString().replace('T', ' ').substring(0, 19);
            }
            const name = data.user_info.username || "Xtream User";

            const result = {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: "Xtream Codes details fetched successfully",
                    type: "xtream",
                    URL: config.URL,
                    username: config.username,
                    Name: name,
                    expirydate: expiryDate,
                    statusCode: 200,
                    Date: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    data: data
                }
            };

            const host = new URL(config.URL).host;
            const tokenPath = path.join(DARK_SIDE, `token_${host}.stalker`);
            fs.writeFileSync(tokenPath, JSON.stringify(result, null, 2), 'utf8');

            const loginPath = path.join(DARK_SIDE, 'login.stalker');
            if (!config.type) config.type = 'xtream';
            if (!fs.existsSync(loginPath)) {
                fs.writeFileSync(loginPath, JSON.stringify(config, null, 2), 'utf8');
            }

            fs.writeFileSync(path.join(DARK_SIDE, `xtream_${host}.json`), JSON.stringify(config, null, 2), 'utf8');

            const livePath = path.join(DARK_SIDE, `live_${host}.stalker`);
            if (fs.existsSync(livePath)) fs.unlinkSync(livePath);

            return JSON.stringify(result);
        } catch (e: any) {
            return JSON.stringify({
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: `Authentication failed: ${e.message}`,
                    statusCode: e.response?.status || 401
                }
            });
        }
    }

    static async getXtreamChannels(config: any): Promise<string> {
        const host_id = StalkerAPI.getHostId(config);
        const liveCacheFile = path.join(DARK_SIDE, `live_${host_id}.stalker`);
        if (fs.existsSync(liveCacheFile)) {
            this.vision_logs("Loading channels from local cache (Xtream).");
            return fs.readFileSync(liveCacheFile, 'utf8');
        }

        try {
            this.vision_logs("Fetching channels and categories from Xtream Codes Portal...");
            const api = new XtreamAPI(config);
            const categories = await api.getLiveCategories();
            const streams = await api.getLiveStreams();

            if (!Array.isArray(streams) && (streams as any)?.error) {
                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        message: "Xtream API Error: " + (streams as any).error,
                        statusCode: 500,
                        Date: new Date().toISOString()
                    }
                });
            }

            const categoryMap: Record<string, string> = {};
            if (Array.isArray(categories)) {
                for (const cat of categories) {
                    if (cat.category_id && cat.category_name) {
                        categoryMap[cat.category_id.toString()] = cat.category_name;
                    }
                }
            }

            const logoMap = await this.get_iptv_org_logo_map();
            const globalConfig = this.Stark_Industries();
            const channelsList: any[] = [];

            if (Array.isArray(streams)) {
                for (const item of streams) {
                    const catId = item.category_id ? item.category_id.toString() : '0';
                    const genreName = categoryMap[catId] || 'Uncategorized';
                    const name = item.name || '';
                    const streamId = item.stream_id ? item.stream_id.toString() : '';

                    if (!streamId) continue;

                    const portalLogo = item.stream_icon || '';
                    let logo = '';
                    const isPlaceholder = !portalLogo || 
                                          portalLogo === globalConfig.meta_data.himg || 
                                          portalLogo.includes('unsplash.com');

                    if (isPlaceholder) {
                        logo = this.match_iptv_logo(name, item.epg_channel_id || '', logoMap);
                    }
                    if (!logo) {
                        logo = portalLogo;
                    }

                    channelsList.push({
                        id: `xtream_live_${streamId}`,
                        Name: name,
                        number: item.num ? item.num.toString() : '0',
                        logo: logo,
                        cmd: `xtream_live_${streamId}`,
                        genre: genreName,
                        playback_url: `xtream_live_${streamId}`,
                        tv_genre_id: catId,
                        xmltv_id: item.epg_channel_id || ''
                    });
                }
            }

            if (channelsList.length > 0) {
                const out = JSON.stringify(channelsList);
                fs.writeFileSync(liveCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify({ error: "No channels found in this Xtream Portal" });
            }
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Xtream Channels: ${e.message}`, "ERROR");
            return JSON.stringify({ error: `Xtream Fetch Error: ${e.message}` });
        }
    }

    static async getXtreamMovies(config: any): Promise<string> {
        const host_id = StalkerAPI.getHostId(config);
        const moviesCacheFile = path.join(DARK_SIDE, `movies_${host_id}.stalker`);
        if (fs.existsSync(moviesCacheFile)) {
            this.vision_logs(`Loading movies from local cache (Xtream): ${host_id}`);
            return fs.readFileSync(moviesCacheFile, 'utf8');
        }

        try {
            this.vision_logs("Fetching movies and categories from Xtream Codes Portal...");
            const api = new XtreamAPI(config);
            const categories = await api.getVodCategories();
            const streams = await api.getVodStreams();

            if (!Array.isArray(streams) && (streams as any)?.error) {
                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        message: "Xtream API Error: " + (streams as any).error,
                        statusCode: 500,
                        Date: new Date().toISOString()
                    }
                });
            }

            const categoryMap: Record<string, string> = {};
            if (Array.isArray(categories)) {
                for (const cat of categories) {
                    if (cat.category_id && cat.category_name) {
                        categoryMap[cat.category_id.toString()] = cat.category_name;
                    }
                }
            }

            const moviesList: any[] = [];
            if (Array.isArray(streams)) {
                for (const item of streams) {
                    const catId = item.category_id ? item.category_id.toString() : '0';
                    const genreName = categoryMap[catId] || 'Uncategorized';
                    const name = item.name || '';
                    const streamId = item.stream_id ? item.stream_id.toString() : '';
                    const ext = item.container_extension || 'mp4';

                    if (!streamId) continue;

                    const logo = item.stream_icon || '';

                    moviesList.push({
                        id: `xtream_movie_${streamId}_${ext}`,
                        Name: name,
                        number: item.num ? item.num.toString() : '0',
                        logo: logo,
                        cmd: `xtream_movie_${streamId}_${ext}`,
                        genre: genreName,
                        playback_url: `xtream_movie_${streamId}_${ext}`,
                        tv_genre_id: catId,
                        xmltv_id: '',
                        media_type: 'movie',
                        rating: item.rating || '',
                        year: item.year || ''
                    });
                }
            }

            if (moviesList.length > 0) {
                const out = JSON.stringify(moviesList);
                fs.writeFileSync(moviesCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify([]);
            }
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Xtream Movies: ${e.message}`, "ERROR");
            return JSON.stringify({ error: `Xtream Movie Fetch Error: ${e.message}` });
        }
    }

    static async getXtreamSeries(config: any): Promise<string> {
        const host_id = StalkerAPI.getHostId(config);
        const seriesCacheFile = path.join(DARK_SIDE, `series_${host_id}.stalker`);
        if (fs.existsSync(seriesCacheFile)) {
            this.vision_logs(`Loading series from local cache (Xtream): ${host_id}`);
            return fs.readFileSync(seriesCacheFile, 'utf8');
        }

        try {
            this.vision_logs("Fetching series and categories from Xtream Codes Portal...");
            const api = new XtreamAPI(config);
            const categories = await api.getSeriesCategories();
            const series = await api.getSeries();

            if (!Array.isArray(series) && (series as any)?.error) {
                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        message: "Xtream API Error: " + (series as any).error,
                        statusCode: 500,
                        Date: new Date().toISOString()
                    }
                });
            }

            const categoryMap: Record<string, string> = {};
            if (Array.isArray(categories)) {
                for (const cat of categories) {
                    if (cat.category_id && cat.category_name) {
                        categoryMap[cat.category_id.toString()] = cat.category_name;
                    }
                }
            }

            const seriesList: any[] = [];
            if (Array.isArray(series)) {
                for (const item of series) {
                    const catId = item.category_id ? item.category_id.toString() : '0';
                    const genreName = categoryMap[catId] || 'Uncategorized';
                    const name = item.name || '';
                    const seriesId = item.series_id ? item.series_id.toString() : '';

                    if (!seriesId) continue;

                    const logo = item.last_modified ? item.cover : (item.cover || '');

                    seriesList.push({
                        id: `xtream_series_${seriesId}`,
                        Name: name,
                        number: item.num ? item.num.toString() : '0',
                        logo: logo,
                        cmd: `xtream_series_${seriesId}`,
                        genre: genreName,
                        playback_url: `xtream_series_${seriesId}`,
                        tv_genre_id: catId,
                        xmltv_id: '',
                        media_type: 'series',
                        rating: item.rating || '',
                        releaseDate: item.releaseDate || ''
                    });
                }
            }

            if (seriesList.length > 0) {
                const out = JSON.stringify(seriesList);
                fs.writeFileSync(seriesCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify([]);
            }
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Xtream Series: ${e.message}`, "ERROR");
            return JSON.stringify({ error: `Xtream Series Fetch Error: ${e.message}` });
        }
    }

    static async getXtreamSeriesInfo(config: any, seriesId: string): Promise<string> {
        try {
            const cleanId = seriesId.replace('xtream_series_', '').replace('stalker_series_', '');
            const api = new XtreamAPI(config);
            const data = await api.getSeriesInfo(cleanId);
            return JSON.stringify(data);
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Xtream Series Info for ${seriesId}: ${e.message}`, "ERROR");
            return JSON.stringify({ error: e.message });
        }
    }

    static async getStalkerMovies(portal: StalkerConfig): Promise<string> {
        const host_id = StalkerAPI.getHostId(portal);
        const moviesCacheFile = path.join(DARK_SIDE, `movies_${host_id}.stalker`);
        if (fs.existsSync(moviesCacheFile)) {
            this.vision_logs(`Loading movies from local cache (Stalker): ${host_id}`);
            return fs.readFileSync(moviesCacheFile, 'utf8');
        }

        try {
            this.vision_logs("Fetching movies from Stalker Portal VOD...");
            const auth = await this.validation(portal);
            if (auth.error) {
                return JSON.stringify({ error: auth.error });
            }

            const pUrl = portal.URL || portal.url || '';
            const pModel = portal.Model || portal.model || 'MAG250';
            const pMac = portal.MAC || portal.mac || '';

            const catUrl = `${StalkerAPI.getApiUrl(pUrl)}?type=vod&action=get_categories&JsHttpRequest=1-xml`;
            const headers = [
                "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
                `X-User-Agent: Model: ${pModel}; Link: WiFi`,
                `Referer: ${pUrl}/c/`,
                `Cookie: mac=${pMac}; stb_lang=en; timezone=GMT`,
                `Authorization: Bearer ${auth.Token || ''}`
            ];

            const catRes = await this.stalkerRequest(catUrl, headers, 'GET');
            let catParsed: any = null;
            try {
                catParsed = JSON.parse(catRes.STALKER.data);
            } catch (e) {}

            const categories: any[] = catParsed?.js || [];
            const moviesList: any[] = [];

            if (Array.isArray(categories)) {
                const fetchPromises = categories.map(async (cat: any) => {
                    const catId = cat.id;
                    const catTitle = cat.title || cat.name || 'Uncategorized';
                    if (!catId) return;

                    const listUrl = `${StalkerAPI.getApiUrl(pUrl)}?type=vod&action=get_ordered_list&category=${catId}&JsHttpRequest=1-xml`;
                    const listRes = await this.stalkerRequest(listUrl, headers, 'GET');
                    let listParsed: any = null;
                    try {
                        listParsed = JSON.parse(listRes.STALKER.data);
                    } catch (e) {}

                    const items = listParsed?.js?.data || listParsed?.js || [];
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            if (!item.id && !item.movie_id) continue;
                            const id = item.id || item.movie_id;
                            const name = item.name || item.title || '';
                            const cmd = item.cmd || '';
                            const logo = this.image(item.logo || item.image || item.screenshot, pUrl);

                            moviesList.push({
                                id: `stalker_movie_${id}`,
                                Name: name,
                                number: '0',
                                logo: logo,
                                cmd: cmd,
                                genre: catTitle,
                                playback_url: `stalker_movie_${id}`,
                                tv_genre_id: catId.toString(),
                                xmltv_id: '',
                                media_type: 'movie',
                                rating: item.rating || '',
                                year: item.year || ''
                            });
                        }
                    }
                });

                await Promise.all(fetchPromises);
            }

            if (moviesList.length > 0) {
                const out = JSON.stringify(moviesList);
                fs.writeFileSync(moviesCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify([]);
            }
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Stalker Movies: ${e.message}`, "ERROR");
            return JSON.stringify({ error: `Stalker Movie Fetch Error: ${e.message}` });
        }
    }

    static async getStalkerSeries(portal: StalkerConfig): Promise<string> {
        const host_id = StalkerAPI.getHostId(portal);
        const seriesCacheFile = path.join(DARK_SIDE, `series_${host_id}.stalker`);
        if (fs.existsSync(seriesCacheFile)) {
            this.vision_logs(`Loading series from local cache (Stalker): ${host_id}`);
            return fs.readFileSync(seriesCacheFile, 'utf8');
        }

        try {
            this.vision_logs("Fetching series from Stalker Portal...");
            const auth = await this.validation(portal);
            if (auth.error) {
                return JSON.stringify({ error: auth.error });
            }

            const pUrl = portal.URL || portal.url || '';
            const pModel = portal.Model || portal.model || 'MAG250';
            const pMac = portal.MAC || portal.mac || '';

            const catUrl = `${StalkerAPI.getApiUrl(pUrl)}?type=series&action=get_categories&JsHttpRequest=1-xml`;
            const headers = [
                "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
                `X-User-Agent: Model: ${pModel}; Link: WiFi`,
                `Referer: ${pUrl}/c/`,
                `Cookie: mac=${pMac}; stb_lang=en; timezone=GMT`,
                `Authorization: Bearer ${auth.Token || ''}`
            ];

            const catRes = await this.stalkerRequest(catUrl, headers, 'GET');
            let catParsed: any = null;
            try {
                catParsed = JSON.parse(catRes.STALKER.data);
            } catch (e) {}

            const categories: any[] = catParsed?.js || [];
            const seriesList: any[] = [];

            if (Array.isArray(categories)) {
                const fetchPromises = categories.map(async (cat: any) => {
                    const catId = cat.id;
                    const catTitle = cat.title || cat.name || 'Uncategorized';
                    if (!catId) return;

                    const listUrl = `${StalkerAPI.getApiUrl(pUrl)}?type=series&action=get_ordered_list&category=${catId}&JsHttpRequest=1-xml`;
                    const listRes = await this.stalkerRequest(listUrl, headers, 'GET');
                    let listParsed: any = null;
                    try {
                        listParsed = JSON.parse(listRes.STALKER.data);
                    } catch (e) {}

                    const items = listParsed?.js?.data || listParsed?.js || [];
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            if (!item.id) continue;
                            const id = item.id;
                            const name = item.name || item.title || '';
                            const logo = this.image(item.logo || item.image || item.screenshot, pUrl);

                            seriesList.push({
                                id: `stalker_series_${id}`,
                                Name: name,
                                number: '0',
                                logo: logo,
                                cmd: item.cmd || '',
                                genre: catTitle,
                                playback_url: `stalker_series_${id}`,
                                tv_genre_id: catId.toString(),
                                xmltv_id: '',
                                media_type: 'series',
                                rating: item.rating || '',
                                year: item.year || ''
                            });
                        }
                    }
                });

                await Promise.all(fetchPromises);
            }

            if (seriesList.length > 0) {
                const out = JSON.stringify(seriesList);
                fs.writeFileSync(seriesCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify([]);
            }
        } catch (e: any) {
            this.vision_logs(`Failed to fetch Stalker Series: ${e.message}`, "ERROR");
            return JSON.stringify({ error: `Stalker Series Fetch Error: ${e.message}` });
        }
    }

    static async getStalkerSeriesInfo(portal: StalkerConfig, seriesId: string): Promise<string> {
        try {
            const cleanId = seriesId.replace('stalker_series_', '');
            const auth = await this.validation(portal);
            if (auth.error) {
                return JSON.stringify({ error: auth.error });
            }

            const pUrl = portal.URL || portal.url || '';
            const pModel = portal.Model || portal.model || 'MAG250';
            const pMac = portal.MAC || portal.mac || '';

            const url = `${StalkerAPI.getApiUrl(pUrl)}?type=series&action=get_ordered_list&series_id=${cleanId}&JsHttpRequest=1-xml`;
            const headers = [
                "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
                `X-User-Agent: Model: ${pModel}; Link: WiFi`,
                `Referer: ${pUrl}/c/`,
                `Cookie: mac=${pMac}; stb_lang=en; timezone=GMT`,
                `Authorization: Bearer ${auth.Token || ''}`
            ];

            const response = await this.stalkerRequest(url, headers, 'GET');
            let parsed: any = null;
            try {
                parsed = JSON.parse(response.STALKER.data);
            } catch (e) {}

            const items = parsed?.js?.data || parsed?.js || [];
            const episodes: any[] = [];
            let info: any = {};

            if (Array.isArray(items)) {
                for (const item of items) {
                    const epId = item.id;
                    const name = item.name || item.title || `Episode ${item.episode_num || episodes.length + 1}`;
                    const cmd = item.cmd || '';
                    const plot = item.plot || '';

                    episodes.push({
                        id: epId,
                        episode_num: item.episode_num || (episodes.length + 1).toString(),
                        title: name,
                        container_extension: 'mp4',
                        cmd: cmd,
                        info: {
                            plot: plot
                        }
                    });

                    if (epId && cmd) {
                        try {
                            const epCacheFile = path.join(DARK_SIDE, `episode_cmd_${epId}.txt`);
                            fs.writeFileSync(epCacheFile, cmd, 'utf8');
                        } catch (e) {}
                    }

                    if (!info.cover && item.logo) {
                        info.cover = this.image(item.logo || item.image || item.screenshot, pUrl);
                    }
                }
            }

            const epsGroup: Record<string, any[]> = { "1": episodes };

            return JSON.stringify({
                info: info,
                episodes: epsGroup
            });
        } catch (e: any) {
            return JSON.stringify({ error: e.message });
        }
    }

    static async validation(portalConfig?: any): Promise<any> {
        const portal = portalConfig || StalkerAPI.getActivePortal();

        if (!portal) {
            return { error: "Identity not found. Login required." };
        }

        const host_id = StalkerAPI.getHostId(portal);
        const tokenFile = path.join(DARK_SIDE, `token_${host_id}.stalker`);

        if (portal.type === 'xtream') {
            if (fs.existsSync(tokenFile)) {
                try {
                    const savedData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
                    if (savedData?.STALKER && savedData.STALKER.type === 'xtream') {
                        const mtime = fs.statSync(tokenFile).mtimeMs;
                        if (Date.now() - mtime < 7200 * 1000) {
                            return savedData.STALKER;
                        }
                    }
                } catch (e) {}
            }
            const profileStr = await this.getXtreamProfile(portal);
            return JSON.parse(profileStr)?.STALKER || { error: "Failed to fetch Xtream profile" };
        }

        if (fs.existsSync(tokenFile)) {
            try {
                const savedData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
                if (!savedData?.STALKER) {
                    const profileStr = await this.get_profile(portal);
                    return JSON.parse(profileStr)?.STALKER || { error: "Failed to fetch profile" };
                }

                const core = savedData.STALKER;
                const oldUrl = core.URL || '';
                const normalizedOldUrl = oldUrl.replace(/\/c\/?$/, '');
                const normalizedNewUrl = portal.URL.replace(/\/c\/?$/, '');

                if (normalizedOldUrl !== normalizedNewUrl) {
                    const livePath = path.join(DARK_SIDE, `live_${host_id}.stalker`);
                    if (fs.existsSync(livePath)) fs.unlinkSync(livePath);
                    this.vision_logs("Portal mismatch. Clean up cache and generate fresh token");
                    const profileStr = await this.get_profile(portal);
                    return JSON.parse(profileStr)?.STALKER || { error: "Failed to fetch profile" };
                }

                const genTime = core.generated_time || 0;
                const minutesElapsed = (Date.now() / 1000 - genTime) / 60;

                if (minutesElapsed < 0.5) {
                    this.vision_logs("Auth Phase 1: Using cached token (Under 30s old)");
                    return core;
                } else if (minutesElapsed < 840) {
                    this.vision_logs("Auth Phase 2: Using cached token (Under 14h old)");
                    const profileStr = await this.get_profile(portal, core.Token);
                    let parsedProfile = null;
                    try {
                        parsedProfile = JSON.parse(profileStr);
                    } catch (e) {}
                    if (!parsedProfile?.STALKER?.Token) {
                        this.vision_logs("Auth Phase 2: Cached token validation failed. Falling back to Phase 3 (fresh fetch)");
                        const freshProfileStr = await this.get_profile(portal);
                        return JSON.parse(freshProfileStr)?.STALKER || { error: "Failed to fetch profile" };
                    }
                    return parsedProfile.STALKER;
                } else {
                    this.vision_logs("Auth Phase 3: Token expired, performing full fetch");
                    const profileStr = await this.get_profile(portal);
                    return JSON.parse(profileStr)?.STALKER || { error: "Failed to fetch profile" };
                }
            } catch (e) {
                // ignore and full profile fetch
            }
        }

        this.vision_logs("Token file not present. Direct profile fetch");
        const profileStr = await this.get_profile(portal);
        return JSON.parse(profileStr)?.STALKER || { error: "Failed to fetch profile" };
    }

    static async genre(portalConfig?: any): Promise<any> {
        const portal = portalConfig || StalkerAPI.getActivePortal();
        if (!portal) return { error: "Login required" };

        const host_id = StalkerAPI.getHostId(portal);
        const genrePath = path.join(DARK_SIDE, `genre_${host_id}.json`);
        
        const auth = await this.validation(portal);
        if (auth.error) {
            return { error: auth.error };
        }

        const targetUrl = `${StalkerAPI.getApiUrl(portal.URL)}?type=itv&action=get_genres&JsHttpRequest=1-xml`;
        const headers = [
            "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
            `X-User-Agent: Model: ${portal.Model}; Link: WiFi`,
            `Referer: ${portal.URL}/c/`,
            `Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`,
            `Authorization: Bearer ${auth.Token || ''}`
        ];

        const response = await this.stalkerRequest(targetUrl, headers, 'GET');
        fs.writeFileSync(genrePath, response.STALKER.data, 'utf8');

        let parsed: any = null;
        try {
            parsed = JSON.parse(response.STALKER.data);
        } catch (e) {
            // ignore
        }

        const statusCode = response.STALKER.info.http_code;
        if (!parsed?.js) {
            return {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                    Statuscode: statusCode,
                    data: response.STALKER.data
                }
            };
        }

        const genres: Record<string, string> = {};
        if (Array.isArray(parsed.js)) {
            for (const item of parsed.js) {
                if (item?.id !== undefined && item?.title !== undefined) {
                    genres[item.id] = item.title;
                }
            }
        }
        return genres;
    }

    static async json_fetcher(mediaType: string = 'live', portalConfig?: any, userId: string = 'anonymous'): Promise<string> {
        const portal = portalConfig || StalkerAPI.getActivePortal();
        
        this.vision_logs(`[json_fetcher] Using portal: ${portal ? (portal.Name || portal.URL) : 'NONE'}`);

        if (!portal) {
            return JSON.stringify({ error: "Identity not found. Login required." });
        }

        const host_id = StalkerAPI.getHostId(portal);
        const liveCacheFile = path.join(DARK_SIDE, `live_${host_id}.stalker`);
        const moviesCacheFile = path.join(DARK_SIDE, `movies_${host_id}.stalker`);
        const seriesCacheFile = path.join(DARK_SIDE, `series_${host_id}.stalker`);

        // 1. Check active custom M3U playlist
        const activeFile = path.join(DARK_SIDE, `active_playlist_id_${userId}.txt`);
        if (fs.existsSync(activeFile)) {
            const activeId = fs.readFileSync(activeFile, 'utf8').trim();
            if (activeId && activeId !== 'portal') {
                const m3uFile = path.join(DARK_SIDE, `m3u_channels_${activeId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
                if (fs.existsSync(m3uFile)) {
                    this.vision_logs(`Loading channels from active M3U playlist: ${activeId} for user ${userId}`);
                    return fs.readFileSync(m3uFile, 'utf8');
                }
            }
        }

        if (mediaType === 'movie') {
            if (fs.existsSync(moviesCacheFile)) {
                this.vision_logs(`Loading movies from local cache: ${host_id}`);
                return fs.readFileSync(moviesCacheFile, 'utf8');
            }
        } else if (mediaType === 'series') {
            if (fs.existsSync(seriesCacheFile)) {
                this.vision_logs(`Loading series from local cache: ${host_id}`);
                return fs.readFileSync(seriesCacheFile, 'utf8');
            }
        } else {
            if (fs.existsSync(liveCacheFile)) {
                this.vision_logs(`Loading channels from local cache: ${host_id}`);
                return fs.readFileSync(liveCacheFile, 'utf8');
            }
        }

        if (portal.type === 'xtream') {
            if (mediaType === 'movie') {
                return this.getXtreamMovies(portal);
            } else if (mediaType === 'series') {
                return this.getXtreamSeries(portal);
            } else {
                return this.getXtreamChannels(portal);
            }
        } else {
            if (mediaType === 'movie') {
                return this.getStalkerMovies(portal);
            } else if (mediaType === 'series') {
                return this.getStalkerSeries(portal);
            }
        }

        const auth = await this.validation(portal);
        if (auth.error) {
            return JSON.stringify({ error: auth.error });
        }

        const url = `${StalkerAPI.getApiUrl(portal.URL)}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
        const headers = [
            "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
            `X-User-Agent: Model: ${portal.Model}; Link: WiFi`,
            `Referer: ${portal.URL}/c/`,
            `Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`,
            `Authorization: Bearer ${auth.Token || ''}`
        ];

        const response = await this.stalkerRequest(url, headers, 'GET');
        
        if (response?.STALKER?.info?.http_code === 404) {
            console.error(`[StalkerAPI] 404 error fetching from ${url}`);
        }
        
        let parsed: any = null;
        try {
            parsed = JSON.parse(response.STALKER.data);
        } catch (e) {
            // ignore
        }

        const statusCode = response.STALKER.info.http_code;
        const genres = await this.genre(portal);

        if (parsed?.js?.data && (parsed.js.total_items || (Array.isArray(parsed.js.data) && parsed.js.data.length > 0))) {
            this.vision_logs("Cache expired or missing. Fetching channels from Portal...");
            const logoMap = await this.get_iptv_org_logo_map();
            const globalConfig = this.Stark_Industries();
            const channelsList: any[] = [];

            for (const item of parsed.js.data) {
                const genreId = item.tv_genre_id;
                const genreName = (genres && genres[genreId]) ? genres[genreId] : 'General';
                
                const xmltv_id = (item.xmltv_id || '').toLowerCase();
                const name = item.name || '';
                const portalLogo = this.image(item.logo, portal.URL);

                let logo = '';
                const isPlaceholder = !portalLogo || 
                                      portalLogo === globalConfig.meta_data.himg || 
                                      portalLogo.includes('unsplash.com') || 
                                      portalLogo.includes('Screenshot-2026-04-13') || 
                                      portalLogo.includes('i.ibb.co');

                if (isPlaceholder) {
                    logo = this.match_iptv_logo(name, xmltv_id, logoMap);
                }
                if (!logo) {
                    logo = portalLogo;
                }

                channelsList.push({
                    id: item.id,
                    Name: item.name,
                    number: item.number,
                    logo: logo,
                    cmd: item.cmd,
                    genre: genreName,
                    playback_url: item.id ? item.id.toString() : this.id_generator(item.cmd),
                    tv_genre_id: item.tv_genre_id,
                    xmltv_id: item.xmltv_id
                });
            }

            if (channelsList.length > 0) {
                const out = JSON.stringify(channelsList);
                fs.writeFileSync(liveCacheFile, out, 'utf8');
                return out;
            } else {
                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                        Statuscode: statusCode,
                        data: parsed
                    }
                });
            }
        } else {
            return JSON.stringify({
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                    Statuscode: statusCode,
                    data: response.STALKER.data
                }
            });
        }
    }

    static getHostId(portal: any) {
        if (!portal || !portal.URL) return 'portal';
        try {
            let host = new URL(portal.URL).host;
            let id = portal.MAC || portal.username || '';
            id = id.replace(/[^a-zA-Z0-9_-]/g, '');
            return id ? `${host}_${id}` : host;
        } catch (e) {
            return 'portal';
        }
    }

    static parseCookies(cookieHeader: string) {
        const list: any = {};
        if (!cookieHeader) return list;
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                const key = parts.shift()?.trim();
                if (key) list[key] = decodeURIComponent(parts.join('='));
            }
        });
        return list;
    }

    static getActivePortal(req?: any) {
        if (req) {
            const cookieHeader = (req.headers.cookie || '') as string;
            const cookies = this.parseCookies(cookieHeader);
            const userActivePortalId = cookies.active_portal_id;

            if (userActivePortalId && userActivePortalId !== 'login') {
                const portalFile = path.join(DARK_SIDE, `${userActivePortalId}.json`);
                if (fs.existsSync(portalFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(portalFile, 'utf8'));
                        if (data?.URL) {
                            if (!data.type) {
                                const isXtream = !!(data.username && data.password && !data.MAC);
                                data.type = isXtream ? 'xtream' : 'stalker';
                            }
                            return data;
                        }
                    } catch (e) {}
                }
            }

            if (cookies.portal_session) {
                try {
                    const data = jwt.verify(cookies.portal_session, JWT_SECRET) as any;
                    if (data && data.URL) {
                        if (!data.type) {
                            const isXtream = !!(data.username && data.password && !data.MAC);
                            data.type = isXtream ? 'xtream' : 'stalker';
                        }
                        return data;
                    }
                } catch (e: any) {
                    // Ignore and fallback if token is invalid or expired
                }
            }
        }

        const loginFile = path.join(DARK_SIDE, 'login.stalker');
        if (fs.existsSync(loginFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(loginFile, 'utf8'));
                if (data?.URL) {
                    if (!data.type) {
                        const isXtream = !!(data.username && data.password && !data.MAC);
                        data.type = isXtream ? 'xtream' : 'stalker';
                    }
                    return data;
                }
            } catch (e) {}
        } else {
            const dbFile = path.join(DARK_SIDE, 'admin_db.json');
            if (fs.existsSync(dbFile)) {
                try {
                    const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
                    if (dbData && Array.isArray(dbData.portals)) {
                        const defaultPortal = dbData.portals.find((p: any) => p.isDefault) || dbData.portals[0];
                        if (defaultPortal) {
                            const portalConfig = {
                                URL: defaultPortal.url,
                                MAC: defaultPortal.mac,
                                username: defaultPortal.username,
                                password: defaultPortal.password,
                                type: defaultPortal.type,
                                model: defaultPortal.model,
                                API: defaultPortal.API,
                                hw_version: defaultPortal.hw_version,
                                hw_version_2: defaultPortal.hw_version_2,
                                D1: defaultPortal.D1,
                                D2: defaultPortal.D2
                            };
                            fs.writeFileSync(loginFile, JSON.stringify(portalConfig, null, 2), 'utf8');
                            return portalConfig;
                        }
                    }
                } catch (e) {}
            }
        }
        return null;
    }

    static async doctor_strange(id: string, config?: StalkerConfig): Promise<string> {
        if (!id || typeof id !== 'string') return JSON.stringify({ error: "Invalid ID" });

        const loginFile = path.join(DARK_SIDE, 'login.stalker');
        let portal = config || StalkerAPI.getActivePortal();
        
        if (id.startsWith('stalker_movie_') || id.startsWith('stalker_series_episode_')) {
            if (!portal) {
                return JSON.stringify({ error: "Identity not found. Login required." });
            }

            const cleanId = id.startsWith('stalker_movie_') 
                ? id.replace('stalker_movie_', '') 
                : id.replace('stalker_series_episode_', '').split('_')[0];

            let cmd = '';
            const host_id = StalkerAPI.getHostId(portal);
            const moviesCacheFile = path.join(DARK_SIDE, `movies_${host_id}.stalker`);
            const seriesCacheFile = path.join(DARK_SIDE, `series_${host_id}.stalker`);
            
            if (fs.existsSync(moviesCacheFile)) {
                try {
                    const list = JSON.parse(fs.readFileSync(moviesCacheFile, 'utf8'));
                    const found = list.find((m: any) => m.id === id || m.id.replace('stalker_movie_', '') === cleanId);
                    if (found && found.cmd) {
                        cmd = found.cmd;
                    }
                } catch (e) {}
            }

            if (!cmd && fs.existsSync(seriesCacheFile)) {
                try {
                    const list = JSON.parse(fs.readFileSync(seriesCacheFile, 'utf8'));
                    const found = list.find((s: any) => s.id === id || s.id.replace('stalker_series_', '') === cleanId);
                    if (found && found.cmd) {
                        cmd = found.cmd;
                    }
                } catch (e) {}
            }

            if (!cmd) {
                const epCacheFile = path.join(DARK_SIDE, `episode_cmd_${cleanId}.txt`);
                if (fs.existsSync(epCacheFile)) {
                    cmd = fs.readFileSync(epCacheFile, 'utf8').trim();
                }
            }

            if (!cmd) {
                cmd = `ffmpeg http://localhost/vod/${cleanId}`;
            }

            const auth = await this.validation(portal);
            if (auth.error) {
                return JSON.stringify({ error: auth.error });
            }

            const url = `${StalkerAPI.getApiUrl(portal.URL)}?type=vod&action=create_link&cmd=${encodeURIComponent(cmd)}&JsHttpRequest=1-xml`;
            const headers = [
                "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
                `X-User-Agent: Model: ${portal.Model}; Link: WiFi`,
                `Referer: ${portal.URL}/c/`,
                `Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`,
                `Authorization: Bearer ${auth.Token || ''}`
            ];

            const response = await this.stalkerRequest(url, headers, 'GET');
            let parsed: any = null;
            try {
                parsed = JSON.parse(response.STALKER.data);
            } catch (e) {}

            const statusCode = response.STALKER.info.http_code;
            if (parsed?.js?.cmd && statusCode === 200) {
                this.vision_logs(`VOD Stream Link Acquired for ID: ${id}`);
                const result = {
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        generated_time: Math.floor(Date.now() / 1000),
                        message: "Playback URL fetched successfully",
                        cmd: parsed.js.cmd,
                        Statuscode: statusCode,
                        data: parsed
                    }
                };
                return JSON.stringify(result);
            } else {
                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                        Statuscode: statusCode,
                        data: response.STALKER.data
                    }
                });
            }
        }

        if (id.startsWith('xtream_')) {
            let portal: any = null;
            
            try {
                if (fs.existsSync(loginFile)) {
                    const temp = JSON.parse(fs.readFileSync(loginFile, 'utf8'));
                    if (temp && temp.type === 'xtream' && temp.username && temp.password) {
                        portal = temp;
                    }
                }
            } catch (e) {}

            // Robust fallback: scan DARK_SIDE for any valid saved Xtream Codes credentials
            if (!portal) {
                try {
                    const files = fs.readdirSync(DARK_SIDE);
                    for (const f of files) {
                        if (f.endsWith('.json')) {
                            const temp = JSON.parse(fs.readFileSync(path.join(DARK_SIDE, f), 'utf8'));
                            if (temp && temp.type === 'xtream' && temp.username && temp.password) {
                                portal = temp;
                                break;
                            }
                        }
                    }
                } catch (e) {}
            }

            if (!portal || !portal.URL || !portal.username || !portal.password) {
                return JSON.stringify({ error: "Xtream Codes credentials or profile not found." });
            }

            try {
                let streamUrl = '';
                if (id.startsWith('xtream_movie_')) {
                    const parts = id.replace('xtream_movie_', '').split('_');
                    const streamId = parts[0];
                    const ext = parts[1] || 'mp4';
                    streamUrl = `${portal.URL}/movie/${portal.username}/${portal.password}/${streamId}.${ext}`;
                } else if (id.startsWith('xtream_series_episode_')) {
                    const parts = id.replace('xtream_series_episode_', '').split('_');
                    const episodeId = parts[0];
                    const ext = parts[1] || 'mp4';
                    streamUrl = `${portal.URL}/series/${portal.username}/${portal.password}/${episodeId}.${ext}`;
                } else {
                    const streamId = id.replace('xtream_live_', '').replace('xtream_', '');
                    let extension = 'm3u8';
                    const host_id = StalkerAPI.getHostId(portal);
                    const tokenFile = path.join(DARK_SIDE, `token_${host_id}.stalker`);
                    if (fs.existsSync(tokenFile)) {
                        try {
                            const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
                            const allowed = tokenData?.STALKER?.data?.user_info?.allowed_output_formats;
                            if (Array.isArray(allowed) && !allowed.includes('m3u8') && allowed.includes('ts')) {
                                extension = 'ts';
                            }
                        } catch (e) {}
                    }
                    streamUrl = `${portal.URL}/live/${portal.username}/${portal.password}/${streamId}.${extension}`;
                }

                return JSON.stringify({
                    STALKER: {
                        Author: "DOCTOR_STRANGE",
                        generated_time: Math.floor(Date.now() / 1000),
                        message: "Playback URL fetched successfully",
                        cmd: streamUrl,
                        Statuscode: 200,
                        data: {}
                    }
                });
            } catch (e: any) {
                return JSON.stringify({ error: `Failed to load identity: ${e.message}` });
            }
        }

        // Check if cached link exists
        const cacheFile = path.join(LIGHT_SIDE, `${id}.json`);
        if (/^\d+$/.test(id)) {
            if (fs.existsSync(cacheFile)) {
                try {
                    const stat = fs.statSync(cacheFile);
                    if (Date.now() - stat.mtimeMs < 180 * 1000) {
                        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                        if (cached?.js?.cmd) {
                            this.vision_logs(`Reusing cached stream link for channel ID: ${id}`);
                            return JSON.stringify({
                                STALKER: {
                                    Author: "DOCTOR_STRANGE",
                                    generated_time: Math.floor(stat.mtimeMs / 1000),
                                    message: "Playback URL fetched from cache",
                                    cmd: cached.js.cmd,
                                    Statuscode: 200,
                                    data: cached
                                }
                            });
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        if (!portal) {
            portal = StalkerAPI.getActivePortal();
        }

        if (!portal) {
            if (fs.existsSync(loginFile)) {
                portal = JSON.parse(fs.readFileSync(loginFile, 'utf8'));
            }
        }

        if (!portal) {
            return JSON.stringify({ error: "Identity not found. Login required." });
        }

        const auth = await this.validation(portal);
        if (auth.error) {
            return JSON.stringify({ error: auth.error });
        }

        let finalCmd = `ffrt http://localhost/ch/${id}`;
        if (id.includes(' ') || id.startsWith('http://') || id.startsWith('https://')) {
            finalCmd = id.includes(' ') ? id : `ffrt ${id}`;
        } else if (/^\d+$/.test(id)) {
            const host_id = StalkerAPI.getHostId(portal);
            const liveCacheFile = path.join(DARK_SIDE, `live_${host_id}.stalker`);
            if (fs.existsSync(liveCacheFile)) {
                try {
                    const list = JSON.parse(fs.readFileSync(liveCacheFile, 'utf8'));
                    const found = list.find((c: any) => c.id === id || c.id === parseInt(id, 10) || c.id === id.toString());
                    if (found && found.cmd) {
                        finalCmd = found.cmd;
                    }
                } catch(e) {}
            }
        }
        
        const encodedCmd = encodeURIComponent(finalCmd);
        const url = `${StalkerAPI.getApiUrl(portal.URL)}?type=itv&action=create_link&cmd=${encodedCmd}&JsHttpRequest=1-xml`;
        const headers = [
            "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
            `X-User-Agent: Model: ${portal.Model}; Link: WiFi`,
            `Referer: ${portal.URL}/c/`,
            `Cookie: mac=${portal.MAC}; stb_lang=en; timezone=GMT`,
            `Authorization: Bearer ${auth.Token || ''}`
        ];

        const response = await this.stalkerRequest(url, headers, 'GET');
        
        if (response?.STALKER?.info?.http_code === 404) {
            console.error(`[StalkerAPI] 404 error fetching from ${url}`);
        }
        
        let parsed: any = null;
        try {
            parsed = JSON.parse(response.STALKER.data);
        } catch (e) {
            // ignore
        }

        const statusCode = response.STALKER.info.http_code;
        if (parsed?.js?.cmd && statusCode === 200) {
            this.vision_logs(`Stream Link Acquired for ID: ${id}`);
            const result = {
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    generated_time: Math.floor(Date.now() / 1000),
                    message: "Playback URL fetched successfully",
                    cmd: parsed.js.cmd,
                    Statuscode: statusCode,
                    data: parsed
                }
            };

            try {
                fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2), 'utf8');
            } catch (err) {
                this.vision_logs(`Failed to write cache for ID ${id}: ${(err as Error).message}`, "WARN");
            }
            return JSON.stringify(result);
        } else {
            return JSON.stringify({
                STALKER: {
                    Author: "DOCTOR_STRANGE",
                    message: this.getMessage(parsed, statusCode, response.STALKER.data, portal),
                    Statuscode: statusCode,
                    data: response.STALKER.data
                }
            });
        }
    }

    static protect_profile(jsonStr: string): string {
        try {
            const data = JSON.parse(jsonStr);
            const mask = (val: string) => {
                if (!val) return 'N/A';
                if (val.length <= 8) return '••••••••';
                return val.substring(0, 4) + '••••••••' + val.substring(val.length - 4);
            };

            if (data?.STALKER?.data?.js) {
                const js = data.STALKER.data.js;
                if (js.mac) js.mac = 'Protected (Locked)';
                if (js.ip) js.ip = 'Protected (Encrypted)';
                if (js.login) js.login = 'Protected';
                if (js.password) js.password = 'Protected';
                if (js.name) js.name = 'Protected User';
                if (js.fname) js.fname = 'Protected User';
                if (js.parent_password) js.parent_password = '••••';
            }
            if (data?.STALKER) {
                if (data.STALKER.mac) data.STALKER.mac = 'Protected (Locked)';
                if (data.STALKER.MAC) data.STALKER.MAC = 'Protected (Locked)';
                if (data.STALKER.Name) data.STALKER.Name = 'Protected User';
                if (data.STALKER.login) data.STALKER.login = 'Protected';
                if (data.STALKER.Password) data.STALKER.Password = 'Protected';
                if (data.STALKER.password) data.STALKER.password = 'Protected';
                if (data.STALKER.username) data.STALKER.username = 'Protected';
                if (data.STALKER.URL) data.STALKER.URL = mask(data.STALKER.URL);
                if (data.STALKER.device_id) data.STALKER.device_id = 'Protected';
                if (data.STALKER.device_id2) data.STALKER.device_id2 = 'Protected';
                if (data.STALKER.sig) data.STALKER.sig = 'Protected';
                if (data.STALKER.SN) data.STALKER.SN = 'Protected';
                if (data.STALKER.D1) data.STALKER.D1 = 'Protected';
                if (data.STALKER.D2) data.STALKER.D2 = 'Protected';
            }
            return JSON.stringify(data);
        } catch (e) {
            return jsonStr;
        }
    }

    static async generatePlaylist(baseUrl: string, portalConfig?: any, userId: string = 'anonymous'): Promise<string> {
        const channelsJson = await this.json_fetcher('live', portalConfig, userId);
        let channels: any[] = [];
        try {
            channels = JSON.parse(channelsJson);
        } catch (e) {
            return "#EXTM3U\n#EXTINF:-1,Cache Missing - Please Refresh Dashboard";
        }

        if (!Array.isArray(channels)) {
            return "#EXTM3U\n#EXTINF:-1,Cache Missing - Please Refresh Dashboard";
        }

        let m3u = "#EXTM3U\n";
        for (const ch of channels) {
            const name = ch.Name;
            const id = ch.playback_url;
            const logo = ch.logo || '';
            const genre = ch.genre || '';
            const isXtream = id.startsWith('xtream_');
            const fullStreamUrl = isXtream ? `${baseUrl}/xtream.php?id=${id}` : `${baseUrl}/live.php?id=${id}`;
            m3u += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${genre}",${name}\n`;
            m3u += `${fullStreamUrl}\n`;
        }
        return m3u;
    }

    static is_safe_m3u_url(urlStr: string): boolean {
        try {
            const parsed = new URL(urlStr);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return false;
            }
            const host = parsed.hostname.toLowerCase();
            if (!host || host === 'localhost' || host === 'localhost.localdomain' || host === '::1' || host === '127.0.0.1') {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    static parse_m3u_content(content: string, logoMap: any): any[] {
        const lines = content.split(/\r?\n/);
        const channels: any[] = [];
        let channel_number = 1;
        let current_inf: string | null = null;
        let current_vlcopt_ua = '';

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                current_inf = line;
                current_vlcopt_ua = '';
                continue;
            }

            if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
                current_vlcopt_ua = line.substring('#EXTVLCOPT:http-user-agent='.length);
                continue;
            }

            if (line.startsWith('#')) {
                continue;
            }

            if (current_inf !== null) {
                let stream_url = line;
                let name = '';
                let logo = '';
                let group = 'M3U Channels';
                let xmltv_id = '';

                const comma_pos = current_inf.lastIndexOf(',');
                let meta_part = '';
                if (comma_pos !== -1) {
                    name = current_inf.substring(comma_pos + 1).trim();
                    meta_part = current_inf.substring(0, comma_pos);
                } else {
                    name = 'Channel ' + channel_number;
                    meta_part = current_inf;
                }

                let matches = meta_part.match(/tvg-id="([^"]+)"/i);
                if (matches) {
                    xmltv_id = matches[1].trim();
                } else {
                    matches = meta_part.match(/tvg-id=([^ ]+)/i);
                    if (matches) xmltv_id = matches[1].trim();
                }

                matches = meta_part.match(/tvg-logo="([^"]+)"/i);
                if (matches) {
                    logo = matches[1].trim();
                } else {
                    matches = meta_part.match(/tvg-logo=([^ ]+)/i);
                    if (matches) logo = matches[1].trim();
                }

                let user_agent = '';
                if (current_vlcopt_ua) {
                    user_agent = current_vlcopt_ua;
                } else {
                    matches = meta_part.match(/http-user-agent="([^"]+)"/i);
                    if (matches) {
                        user_agent = matches[1].trim();
                    } else {
                        matches = meta_part.match(/user-agent="([^"]+)"/i);
                        if (matches) user_agent = matches[1].trim();
                    }
                }

                if (user_agent) {
                    stream_url += (stream_url.indexOf('?') !== -1 ? '&' : '?') + 'http-user-agent=' + encodeURIComponent(user_agent);
                }

                if (!logo) {
                    logo = StalkerAPI.match_iptv_logo(name, xmltv_id, logoMap);
                }

                matches = meta_part.match(/group-title="([^"]+)"/i);
                if (matches) {
                    group = matches[1].trim();
                } else {
                    matches = meta_part.match(/group-title=([^ ]+)/i);
                    if (matches) group = matches[1].trim();
                }

                channels.push({
                    id: "m3u_" + crypto.createHash('md5').update(stream_url).digest('hex'),
                    Name: name,
                    number: channel_number,
                    logo: logo,
                    cmd: stream_url,
                    genre: group,
                    playback_url: stream_url,
                    tv_genre_id: "m3u_genre",
                    xmltv_id: xmltv_id
                });

                channel_number++;
                current_inf = null;
            }
        }
        return channels;
    }

}

