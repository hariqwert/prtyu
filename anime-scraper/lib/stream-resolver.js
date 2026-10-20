const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

class StreamResolver {
    constructor(options = {}) {
        this.userAgent = options.userAgent || USER_AGENT;
    }

    async fetchText(url, headers = {}) {
        const res = await fetch(url, {
            headers: {
                'User-Agent': this.userAgent,
                ...headers
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
        }
        return await res.text();
    }

    /**
     * Parse audio tracks, qualities, and subtitles from master M3U8 playlist
     */
    parseMasterPlaylist(masterContent, baseUrl) {
        const audioTracks = [];
        const qualities = [];

        // Audio tracks: #EXT-X-MEDIA:TYPE=AUDIO...NAME="...",LANGUAGE="..."
        const audioRegex = /#EXT-X-MEDIA:TYPE=AUDIO[^,\n]*,LANGUAGE=["']([^"']+)["'][^,\n]*,NAME=["']([^"']+)["'][^,\n]*(?:,URI=["']([^"']+)["'])?/gi;
        let match;
        while ((match = audioRegex.exec(masterContent)) !== null) {
            audioTracks.push({
                language: match[1],
                name: match[2],
                uri: match[3] ? (match[3].startsWith('http') ? match[3] : new URL(match[3], baseUrl).toString()) : null
            });
        }

        // Video streams: #EXT-X-STREAM-INF...RESOLUTION=...,NAME="..."
        const streamRegex = /#EXT-X-STREAM-INF:[^\n]*?(?:RESOLUTION=(\d+x\d+))?[^\n]*?(?:NAME=["']([^"']+)["'])?[^\n]*\n([^\n#]+)/gi;
        while ((match = streamRegex.exec(masterContent)) !== null) {
            const streamUri = match[3].trim();
            qualities.push({
                resolution: match[1] || 'Unknown',
                name: match[2] || 'Default',
                uri: streamUri.startsWith('http') ? streamUri : new URL(streamUri, baseUrl).toString()
            });
        }

        return { audioTracks, qualities };
    }

    /**
     * Resolves the AnimeSalt episode stream and master M3U8
     */
    async resolveEpisode(episodeUrl, options = { deepParse: false }) {
        // 1. Fetch Episode HTML
        const html = await this.fetchText(episodeUrl, {
            'Referer': 'https://animesalt.cx/'
        });

        // 2. Extract player iframe
        const iframeMatch = html.match(/src=["'](https?:\/\/[^"']+\/video\/([a-f0-9]+))["']/i);
        if (!iframeMatch) {
            throw new Error('No player iframe found in episode page');
        }

        const [_, iframeUrl, videoId] = iframeMatch;
        const cdnHost = new URL(iframeUrl).origin;

        // 3. Post to getVideo API
        const apiUrl = `${cdnHost}/player/index.php?data=${videoId}&do=getVideo`;
        const postBody = new URLSearchParams({
            hash: videoId,
            r: 'https://animesalt.cx/'
        }).toString();

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': iframeUrl,
                'Origin': cdnHost,
                'User-Agent': this.userAgent,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: postBody
        });

        if (!res.ok) {
            throw new Error(`Video resolver API returned HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data || !data.videoSource) {
            throw new Error('Video source not returned by resolver API');
        }

        const masterM3u8 = data.videoSource;
        const poster = data.videoImage || '';

        let audioTracks = [];
        let qualities = [];
        let subtitles = [];

        // 4. Extract subtitle tracks from iframe HTML (supports packed scripts)
        try {
            const iframeHtml = await this.fetchText(iframeUrl, { 'Referer': 'https://animesalt.cx/' });
            let scriptContent = iframeHtml;
            const pMatch = iframeHtml.match(/eval\((function\(p,a,c,k,e,[rd]\)[\s\S]*?)\)\s*;?\s*<\/script>/);
            if (pMatch) {
                try {
                    scriptContent = Function(`return (${pMatch[1]})`)() || iframeHtml;
                } catch (e) {}
            }

            const captionRegex = /"kind"\s*:\s*"captions"[^}]*?"file"\s*:\s*"([^"]+)"[^}]*?"label"\s*:\s*"([^"]+)"/g;
            let cMatch;
            while ((cMatch = captionRegex.exec(scriptContent)) !== null) {
                const cleanFile = cMatch[1].replace(/\\\//g, '/').replace(/\\/g, '');
                subtitles.push({
                    file: cleanFile,
                    label: cMatch[2] || 'English',
                    language: 'eng'
                });
            }
        } catch (e) {
            // Non-fatal if iframe subtitle extraction fails
        }

        // 5. Optionally fetch and parse master playlist
        if (options.deepParse) {
            try {
                const masterContent = await this.fetchText(masterM3u8, {
                    'Referer': `${cdnHost}/`
                });
                const parsed = this.parseMasterPlaylist(masterContent, masterM3u8);
                audioTracks = parsed.audioTracks;
                qualities = parsed.qualities;
            } catch (err) {
                // Non-fatal if deep parse fails
            }
        }

        return {
            videoId,
            iframeUrl,
            masterM3u8,
            poster,
            audioTracks,
            qualities,
            subtitles,
            resolvedAt: new Date().toISOString()
        };
    }
}

module.exports = StreamResolver;
