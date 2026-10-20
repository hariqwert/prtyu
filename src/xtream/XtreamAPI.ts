import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { httpAgent, httpsAgent } from './xtreamAgent';

const DARK_SIDE = path.join(process.cwd(), 'doctor_strange');
const LIGHT_SIDE = path.join(process.cwd(), 'cache_stalker');

export interface XtreamAccount {
    portalUrl: string;
    username: string;
    password: string;
    maxConnections?: number;
    activeConnections?: number;
    allowedFormats?: string[];
    expDate?: number;
}

export class XtreamAPI {
    private account: XtreamAccount;
    private timeout: number = 120000;

    constructor(account: XtreamAccount) {
        const portalUrl = account.portalUrl || (account as any).URL || '';
        this.account = {
            ...account,
            portalUrl: portalUrl.replace(/\/+$/, '')
        };
    }

    getAccount(): XtreamAccount {
        return this.account;
    }

    private getAxiosConfig() {
        const isHttps = this.account.portalUrl.startsWith('https');
        return {
            httpAgent: isHttps ? undefined : httpAgent,
            httpsAgent: isHttps ? httpsAgent : undefined,
            headers: {
                'User-Agent': 'OTT Navigator/1.6.9.4 (Linux;Android 11)',
                'Accept': '*/*',
                'Referer': this.account.portalUrl + '/'
            },
            timeout: this.timeout
        };
    }

    async authenticate(): Promise<any> {
        const url = `${this.account.portalUrl}/player_api.php?username=${encodeURIComponent(this.account.username)}&password=${encodeURIComponent(this.account.password)}`;
        try {
            const response = await axios.get(url, this.getAxiosConfig());
            const data = response.data;
            if (data && data.user_info && data.user_info.auth !== 0) {
                return data;
            }
            throw new Error('Authentication failed');
        } catch (e: any) {
            console.error(`[XtreamAPI] Auth Error: ${e.message}`);
            throw e;
        }
    }

    async getLiveCategories(): Promise<any[]> {
        return this.fetchAction('get_live_categories');
    }

    async getLiveStreams(categoryId?: string): Promise<any[]> {
        const extra = categoryId ? `&category_id=${categoryId}` : '';
        return this.fetchAction('get_live_streams', extra);
    }

    async getVodCategories(): Promise<any[]> {
        return this.fetchAction('get_vod_categories');
    }

    async getVodStreams(categoryId?: string): Promise<any[]> {
        const extra = categoryId ? `&category_id=${categoryId}` : '';
        return this.fetchAction('get_vod_streams', extra);
    }

    async getSeriesCategories(): Promise<any[]> {
        return this.fetchAction('get_series_categories');
    }

    async getSeries(): Promise<any[]> {
        return this.fetchAction('get_series');
    }

    async getSeriesInfo(seriesId: string): Promise<any> {
        return this.fetchAction('get_series_info', `&series_id=${seriesId}`);
    }

    async getShortEPG(streamId: string): Promise<any> {
        return this.fetchAction('get_short_epg', `&stream_id=${streamId}`);
    }

    private async fetchAction(action: string, extra: string = ''): Promise<any> {
        const url = `${this.account.portalUrl}/player_api.php?username=${encodeURIComponent(this.account.username)}&password=${encodeURIComponent(this.account.password)}&action=${action}${extra}`;
        try {
            const response = await axios.get(url, this.getAxiosConfig());
            return response.data;
        } catch (e: any) {
            console.error(`[XtreamAPI] Action ${action} failed: ${e.message}`);
            return { error: e.message };
        }
    }

    resolveStreamUrl(contentId: string): string {
        const { portalUrl, username, password } = this.account;
        const user = encodeURIComponent(username);
        const pass = encodeURIComponent(password);

        let extension = contentId.endsWith('.m3u8') ? 'm3u8' : 'ts';

        const cleanId = contentId.replace(/\.ts$/, '').replace(/\.m3u8$/, '');

        if (cleanId.startsWith('xtream_live_')) {
            const id = cleanId.replace('xtream_live_', '');
            return `${portalUrl}/live/${user}/${pass}/${id}.ts`;
        }

        if (cleanId.startsWith('xtream_movie_')) {
            const parts = cleanId.replace('xtream_movie_', '').split('_');
            const id = parts[0];
            const ext = parts[1] || 'mp4';
            return `${portalUrl}/movie/${user}/${pass}/${id}.${ext}`;
        }

        if (cleanId.startsWith('xtream_series_')) {
            const parts = cleanId.replace('xtream_series_', '').split('_');
            // Format: xtream_series_{series_id}_{episode_id}_{ext}
            if (parts.length >= 2) {
                const episodeId = parts[1];
                const ext = parts[2] || 'mp4';
                return `${portalUrl}/series/${user}/${pass}/${episodeId}.${ext}`;
            }
        }

        // Legacy/Direct format support
        if (cleanId.startsWith('xtream_') && !cleanId.includes('_live_') && !cleanId.includes('_movie_') && !cleanId.includes('_series_')) {
             const id = cleanId.replace('xtream_', '');
             return `${portalUrl}/live/${user}/${pass}/${id}.${extension}`;
        }

        return '';
    }

    static getAccountByHost(host: string): XtreamAccount | null {
        const filePath = path.join(DARK_SIDE, `xtream_${host}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return {
                    portalUrl: (data.portalUrl || data.URL || '').replace(/\/+$/, ''),
                    username: data.username || '',
                    password: data.password || '',
                    maxConnections: data.maxConnections,
                    activeConnections: data.activeConnections,
                    allowedFormats: data.allowedFormats,
                    expDate: data.expDate
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    static getActiveAccount(): XtreamAccount | null {
        const loginFile = path.join(DARK_SIDE, 'login.stalker');
        if (fs.existsSync(loginFile)) {
            try {
                const portal = JSON.parse(fs.readFileSync(loginFile, 'utf8'));
                if (portal.type === 'xtream') {
                    return {
                        portalUrl: portal.URL.replace(/\/+$/, ''),
                        username: portal.username,
                        password: portal.password
                    };
                }
            } catch (e) {}
        }
        // Robust Fallback: Scan DARK_SIDE directory for any saved Xtream portal config
        try {
            const files = fs.readdirSync(DARK_SIDE);
            for (const f of files) {
                if (f.endsWith('.json')) {
                    const temp = JSON.parse(fs.readFileSync(path.join(DARK_SIDE, f), 'utf8'));
                    if (temp && temp.type === 'xtream' && temp.username && temp.password) {
                        return {
                            portalUrl: (temp.portalUrl || temp.URL || '').replace(/\/+$/, ''),
                            username: temp.username,
                            password: temp.password
                        };
                    }
                }
            }
        } catch (e) {}
        return null;
    }
}
