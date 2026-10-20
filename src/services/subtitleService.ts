import axios from 'axios';

export interface SubtitleTrack {
    id: string;
    language: string;
    label: string;
    format: string;
    url: string;
    downloadUrl: string;
    isDefault?: boolean;
}

export class SubtitleService {
    /**
     * Search subtitles by TMDB ID or Movie/TV Show Title
     */
    static async searchSubtitles(tmdbId?: string | number, title?: string, lang: string = 'en'): Promise<SubtitleTrack[]> {
        const results: SubtitleTrack[] = [];

        // 1. Wyzie Subtitles Provider
        if (tmdbId) {
            try {
                const wyzieUrl = `https://sub.wyzie.ru/search?id=${tmdbId}`;
                const res = await axios.get(wyzieUrl, { timeout: 4000 });
                const tracks = Array.isArray(res.data) ? res.data : [];
                
                for (const t of tracks) {
                    const l = (t.language || t.lang || 'en').toLowerCase();
                    const label = t.display || t.label || l.toUpperCase();
                    const subUrl = t.url || t.file;
                    if (subUrl) {
                        results.push({
                            id: `wyz-${results.length}`,
                            language: l,
                            label: label,
                            format: subUrl.endsWith('.vtt') ? 'vtt' : 'srt',
                            url: subUrl,
                            downloadUrl: `/api/subtitles/download?url=${encodeURIComponent(subUrl)}&title=${encodeURIComponent(title || 'subtitles')}_${l}`,
                            isDefault: l === 'en' || l === lang
                        });
                    }
                }
            } catch (e: any) {}
        }

        // 2. OpenSubtitles Direct Fallback
        if (results.length === 0 && title) {
            try {
                const osUrl = `https://rest.opensubtitles.org/search/query-${encodeURIComponent(title)}/sublanguageid-${lang}`;
                const res = await axios.get(osUrl, {
                    headers: { 'User-Agent': 'TemporaryUserAgent' },
                    timeout: 4000
                });
                const subs = Array.isArray(res.data) ? res.data : [];
                for (const s of subs.slice(0, 5)) {
                    if (s.SubDownloadLink) {
                        results.push({
                            id: `os-${s.IDSubtitleFile || results.length}`,
                            language: s.SubLanguageID || 'en',
                            label: `${s.LanguageName || 'English'} (${s.SubFormat || 'SRT'})`,
                            format: s.SubFormat || 'srt',
                            url: s.SubDownloadLink,
                            downloadUrl: `/api/subtitles/download?url=${encodeURIComponent(s.SubDownloadLink)}&title=${encodeURIComponent(title)}_${s.SubLanguageID || 'en'}`,
                            isDefault: results.length === 0
                        });
                    }
                }
            } catch (e: any) {}
        }

        return results;
    }
}
