const fs = require('fs');
const path = require('path');
const StorageManager = require('./storage-manager');
const StreamResolver = require('./stream-resolver');
const PlaylistBuilder = require('./playlist-builder');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ScraperEngine {
    constructor(options = {}) {
        this.storage = new StorageManager(options.baseDir);
        this.resolver = new StreamResolver({ userAgent: this.storage.config.userAgent });
        this.playlistBuilder = new PlaylistBuilder(this.storage);
        this.delayMs = options.delayMs || this.storage.config.requestDelayMs || 800;
    }

    /**
     * Parse series title, seasons, and episode links from AnimeSalt HTML
     */
    async discoverEpisodes(targetUrl) {
        this.storage.log('info', `Discovering episodes from: ${targetUrl}`);
        const html = await this.resolver.fetchText(targetUrl, {
            'Referer': 'https://animesalt.cx/'
        });

        // Parse Title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let rawTitle = titleMatch 
            ? titleMatch[1]
                .replace(/\s*-\s*Anime Salt.*/i, '')
                .replace(/\s*-\s*Watch Now.*/i, '')
                .replace(/&amp;/g, '&')
                .replace(/&#0*39;|&apos;|`/g, "'")
                .replace(/&quot;/g, '"')
                .trim() 
            : 'Anime';
        
        // Derive clean anime name and season name if episode format like "One Piece 21x1155"
        let animeTitle = rawTitle;
        let seasonSlug = 'season-1';
        let seasonTitle = 'Season 1';

        const epTitleMatch = rawTitle.match(/^(.+?)\s+(\d+)x\d+/i);
        if (epTitleMatch) {
            animeTitle = epTitleMatch[1].trim();
            const seasonNum = epTitleMatch[2];
            seasonSlug = `season-${seasonNum}`;
            seasonTitle = `Season ${seasonNum}`;
        }

        const animeSlug = this.storage.sanitizeSlug(animeTitle);

        // Extract episode articles with English titles and numbers
        const episodeMap = new Map();
        const articles = html.split('<article').slice(1);

        for (const art of articles) {
            const urlM = art.match(/href="([^"]*\/episode\/[^"]*)"/);
            const numM = art.match(/class="num-epi">([^<]+)<\/span>/);
            const titleM = art.match(/class="entry-title">([^<]+)<\/h2>/);

            if (urlM) {
                const epUrl = urlM[1].replace(/\/+$/, '') + '/';
                const epSlug = epUrl.match(/\/episode\/([^\/]+)\//)[1];
                const epNum = numM ? parseInt(numM[1].trim(), 10) : null;
                const rawEngTitle = titleM ? titleM[1].trim()
                    .replace(/&#0*39;|&apos;|`/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"') : '';

                const displayTitle = epNum
                    ? (rawEngTitle ? `${animeTitle} - Episode ${epNum}: ${rawEngTitle}` : `${animeTitle} - Episode ${epNum}`)
                    : (rawEngTitle || epSlug.replace(/[-_]/g, ' '));

                episodeMap.set(epUrl, {
                    url: epUrl,
                    slug: epSlug,
                    episodeNumber: epNum,
                    englishTitle: rawEngTitle,
                    title: displayTitle
                });
            }
        }

        // Fallback: If no articles matched, search for any href
        if (episodeMap.size === 0) {
            const regex = /href=["'](https:\/\/animesalt\.cx\/episode\/([^"']+))["']/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
                const epUrl = match[1].replace(/\/+$/, '') + '/';
                const epSlug = match[2].replace(/\/+$/, '');
                if (!episodeMap.has(epUrl)) {
                    const epNumMatch = epSlug.match(/(?:x|ep(?:isode)?[-_]?)(\d+)/i) || epSlug.match(/(\d+)$/);
                    const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : null;
                    const displayTitle = epNum ? `${animeTitle} - Episode ${epNum}` : epSlug.replace(/[-_]/g, ' ');

                    episodeMap.set(epUrl, {
                        url: epUrl,
                        slug: epSlug,
                        episodeNumber: epNum,
                        englishTitle: '',
                        title: displayTitle
                    });
                }
            }
        }

        // If targetUrl is an episode itself and no other links were found
        if (episodeMap.size === 0 && targetUrl.includes('/episode/')) {
            const slug = targetUrl.replace(/\/+$/, '').split('/').pop();
            const epNumMatch = slug.match(/(?:x|ep(?:isode)?[-_]?)(\d+)/i) || slug.match(/(\d+)$/);
            const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : null;
            episodeMap.set(targetUrl, {
                url: targetUrl,
                slug,
                episodeNumber: epNum,
                englishTitle: '',
                title: rawTitle
            });
        }

        const episodes = Array.from(episodeMap.values());
        // Sort episodes by episodeNumber ascending
        episodes.sort((a, b) => {
            if (a.episodeNumber && b.episodeNumber) return a.episodeNumber - b.episodeNumber;
            return a.slug.localeCompare(b.slug);
        });

        return {
            animeTitle,
            animeSlug,
            seasonSlug,
            seasonTitle,
            episodes
        };
    }

    /**
     * Run scraping job with incremental caching, episode number selection, and file system persistence
     */
    async scrape(targetUrl, options = {}) {
        const {
            force = false,
            limit = null,
            episodeNumber = null,
            episodeNumbers = null,
            singleEpisode = false,
            range = null,
            onProgress = null
        } = options;

        const discovery = await this.discoverEpisodes(targetUrl);
        const { animeTitle, animeSlug, seasonSlug, seasonTitle, episodes } = discovery;

        // Apply episode number filtering if requested
        let filteredEpisodes = episodes;

        const isSingleTarget = Boolean(singleEpisode || (episodeNumber !== null && episodeNumber !== undefined && episodeNumber !== ''));

        if (episodeNumber !== null && episodeNumber !== undefined && episodeNumber !== '') {
            const targetNum = parseInt(episodeNumber, 10);
            filteredEpisodes = episodes.filter(e => e.episodeNumber === targetNum || e.slug.includes(String(targetNum)));
        } else if (singleEpisode) {
            // Extract from URL if targetUrl is an episode URL
            const urlSlugMatch = targetUrl.replace(/\/+$/, '').split('/').pop();
            const epNumMatch = urlSlugMatch.match(/(?:x|ep(?:isode)?[-_]?)(\d+)/i) || urlSlugMatch.match(/(\d+)$/);
            const targetNum = epNumMatch ? parseInt(epNumMatch[1], 10) : null;
            if (targetNum) {
                filteredEpisodes = episodes.filter(e => e.episodeNumber === targetNum || e.slug.includes(String(targetNum)));
            } else {
                filteredEpisodes = episodes.filter(e => e.slug === urlSlugMatch || e.url.includes(urlSlugMatch));
            }
        } else if (Array.isArray(episodeNumbers) && episodeNumbers.length > 0) {
            const numSet = new Set(episodeNumbers.map(n => parseInt(n, 10)));
            filteredEpisodes = episodes.filter(e => numSet.has(e.episodeNumber));
        } else if (range && (range.from || range.to)) {
            const from = range.from ? parseInt(range.from, 10) : -Infinity;
            const to = range.to ? parseInt(range.to, 10) : Infinity;
            filteredEpisodes = episodes.filter(e => e.episodeNumber >= from && e.episodeNumber <= to);
        }

        // If a single episode was targeted but wasn't found in discovery, handle safely
        if (filteredEpisodes.length === 0) {
            if (isSingleTarget) {
                // If targetUrl itself is an episode, use it directly as the target episode
                if (targetUrl.includes('/episode/')) {
                    const slug = targetUrl.replace(/\/+$/, '').split('/').pop();
                    const epNumMatch = slug.match(/(?:x|ep(?:isode)?[-_]?)(\d+)/i) || slug.match(/(\d+)$/);
                    const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : (episodeNumber ? parseInt(episodeNumber, 10) : null);
                    filteredEpisodes = [{
                        url: targetUrl,
                        slug,
                        episodeNumber: epNum,
                        englishTitle: '',
                        title: `${animeTitle} - Episode ${epNum || slug}`
                    }];
                } else {
                    throw new Error(`Single episode ${episodeNumber ? '#' + episodeNumber : 'specified'} was not found in ${animeTitle} (${seasonTitle}).`);
                }
            } else {
                filteredEpisodes = episodes; // Fallback only for general scrapes
            }
        }

        const targetEpisodes = limit ? filteredEpisodes.slice(0, limit) : filteredEpisodes;

        this.storage.log('info', `Starting scrape for ${animeTitle} (${seasonSlug}) with ${targetEpisodes.length} selected episodes.`);

        // Load existing season metadata if any
        let metadata = this.storage.loadMetadata(animeSlug, seasonSlug);
        if (!metadata) {
            metadata = {
                animeTitle,
                animeSlug,
                seasonSlug,
                seasonTitle,
                firstScraped: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                episodes: {}
            };
        }

        let updatedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < targetEpisodes.length; i++) {
            const ep = targetEpisodes[i];
            const existing = metadata.episodes[ep.slug];

            // Check if stream is already valid and not expired
            if (!force && existing && existing.streamUrl && !this.storage.isStreamExpired(existing.streamUrl)) {
                skippedCount++;
                if (onProgress) {
                    onProgress({
                        index: i + 1,
                        total: targetEpisodes.length,
                        slug: ep.slug,
                        status: 'cached',
                        title: ep.title
                    });
                }
                continue;
            }

            // Resolve stream
            try {
                if (onProgress) {
                    onProgress({
                        index: i + 1,
                        total: targetEpisodes.length,
                        slug: ep.slug,
                        status: 'scraping',
                        title: ep.title
                    });
                }

                const streamData = await this.resolver.resolveEpisode(ep.url, { deepParse: false });

                // Store episode in metadata
                metadata.episodes[ep.slug] = {
                    slug: ep.slug,
                    title: ep.title,
                    englishTitle: ep.englishTitle || '',
                    episodeNumber: ep.episodeNumber,
                    url: ep.url,
                    videoId: streamData.videoId,
                    streamUrl: streamData.masterM3u8,
                    poster: streamData.poster,
                    subtitles: streamData.subtitles || [],
                    resolvedAt: streamData.resolvedAt
                };

                // Cache token
                this.storage.saveCache(streamData.videoId, {
                    masterM3u8: streamData.masterM3u8,
                    poster: streamData.poster
                });

                updatedCount++;

                if (onProgress) {
                    onProgress({
                        index: i + 1,
                        total: targetEpisodes.length,
                        slug: ep.slug,
                        status: 'resolved',
                        title: ep.title
                    });
                }

                // Wait delay before next request
                if (i < targetEpisodes.length - 1) {
                    await sleep(this.delayMs);
                }
            } catch (err) {
                failedCount++;
                this.storage.log('error', `Failed to scrape ${ep.slug}: ${err.message}`);
                if (onProgress) {
                    onProgress({
                        index: i + 1,
                        total: targetEpisodes.length,
                        slug: ep.slug,
                        status: 'failed',
                        error: err.message,
                        title: ep.title
                    });
                }
            }
        }

        metadata.lastUpdated = new Date().toISOString();

        // 1. Save metadata JSON
        const metadataPath = this.storage.saveMetadata(animeSlug, seasonSlug, metadata);

        // 2. Generate Season M3U Playlist
        const episodeList = Object.values(metadata.episodes);
        const playlistPath = this.playlistBuilder.saveSeasonPlaylist(
            animeSlug,
            seasonSlug,
            animeTitle,
            seasonTitle,
            episodeList
        );

        // 3. Update Master All-Seasons Playlist
        this.updateMasterPlaylist(animeSlug, animeTitle);

        // 4. Update Catalog Index
        this.storage.updateCatalog(animeSlug, animeTitle, seasonSlug, {
            title: seasonTitle,
            episodesCount: episodeList.length,
            metadataFile: path.relative(this.storage.storageDir, metadataPath),
            playlistFile: path.relative(this.storage.storageDir, playlistPath)
        });

        this.storage.log('info', `Completed scrape for ${animeTitle}: ${updatedCount} resolved, ${skippedCount} cached, ${failedCount} failed.`);

        return {
            animeTitle,
            animeSlug,
            seasonSlug,
            totalEpisodes: episodeList.length,
            updatedCount,
            skippedCount,
            failedCount,
            metadataPath,
            playlistPath
        };
    }

    /**
     * Aggregate all seasons for an anime and generate all-seasons.m3u
     */
    updateMasterPlaylist(animeSlug, animeTitle) {
        const metadataDir = this.storage.getMetadataDir(animeSlug);
        const files = fs.readdirSync(metadataDir).filter(f => f.endsWith('.json'));

        let allEpisodes = [];
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf8'));
                if (data && data.episodes) {
                    allEpisodes = allEpisodes.concat(Object.values(data.episodes));
                }
            } catch (e) {
                // ignore corrupted file
            }
        }

        // Sort all episodes
        allEpisodes.sort((a, b) => {
            if (a.episodeNumber && b.episodeNumber) return a.episodeNumber - b.episodeNumber;
            return a.slug.localeCompare(b.slug);
        });

        return this.playlistBuilder.saveMasterPlaylist(animeSlug, animeTitle, allEpisodes);
    }
}

module.exports = ScraperEngine;
