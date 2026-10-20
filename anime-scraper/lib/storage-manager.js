const fs = require('fs');
const path = require('path');

class StorageManager {
    constructor(baseDir = path.resolve(__dirname, '..')) {
        this.baseDir = baseDir;
        this.config = this.loadConfig();
        this.storageDir = path.resolve(this.baseDir, this.config.storageRoot || './storage');

        this.paths = {
            metadata: path.join(this.storageDir, 'metadata'),
            playlists: path.join(this.storageDir, 'playlists'),
            cache: path.join(this.storageDir, 'cache'),
            logs: path.join(this.storageDir, 'logs'),
            catalog: path.join(this.storageDir, 'catalog.json'),
            logFile: path.join(this.storageDir, 'logs', 'scraper.log')
        };

        this.ensureDirectories();
    }

    loadConfig() {
        const configPath = path.join(this.baseDir, 'config', 'default-config.json');
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (e) {
            console.warn('[StorageManager] Could not read config file, using defaults.');
        }
        return {
            storageRoot: './storage',
            requestDelayMs: 800,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            defaultQuality: 'auto',
            preferredAudio: 'jpn',
            logLevel: 'info'
        };
    }

    ensureDirectories() {
        [this.storageDir, this.paths.metadata, this.paths.playlists, this.paths.cache, this.paths.logs].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        if (!fs.existsSync(this.paths.catalog)) {
            fs.writeFileSync(this.paths.catalog, JSON.stringify({ series: {}, stats: { totalSeries: 0, totalEpisodes: 0 } }, null, 2), 'utf8');
        }
    }

    sanitizeSlug(str) {
        return (str || 'unknown')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    getMetadataDir(animeSlug) {
        const dir = path.join(this.paths.metadata, this.sanitizeSlug(animeSlug));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    getPlaylistDir(animeSlug) {
        const dir = path.join(this.paths.playlists, this.sanitizeSlug(animeSlug));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    // --- Metadata Management ---

    saveMetadata(animeSlug, seasonSlug, data) {
        const dir = this.getMetadataDir(animeSlug);
        const filePath = path.join(dir, `${this.sanitizeSlug(seasonSlug)}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return filePath;
    }

    loadMetadata(animeSlug, seasonSlug) {
        const filePath = path.join(this.getMetadataDir(animeSlug), `${this.sanitizeSlug(seasonSlug)}.json`);
        if (fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (err) {
                this.log('error', `Failed to parse metadata file: ${filePath}`);
            }
        }
        return null;
    }

    // --- Catalog Index ---

    getCatalog() {
        try {
            return JSON.parse(fs.readFileSync(this.paths.catalog, 'utf8'));
        } catch (e) {
            return { series: {}, stats: { totalSeries: 0, totalEpisodes: 0 } };
        }
    }

    updateCatalog(animeSlug, animeTitle, seasonSlug, seasonSummary) {
        const catalog = this.getCatalog();
        const slug = this.sanitizeSlug(animeSlug);
        const sSlug = this.sanitizeSlug(seasonSlug);

        if (!catalog.series[slug]) {
            catalog.series[slug] = {
                title: animeTitle || slug,
                slug,
                firstScraped: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                seasons: {}
            };
        }

        catalog.series[slug].lastUpdated = new Date().toISOString();
        catalog.series[slug].seasons[sSlug] = {
            ...seasonSummary,
            lastUpdated: new Date().toISOString()
        };

        // Recalculate stats
        let totalEpisodes = 0;
        for (const s of Object.values(catalog.series)) {
            for (const sn of Object.values(s.seasons || {})) {
                totalEpisodes += (sn.episodesCount || 0);
            }
        }
        catalog.stats = {
            totalSeries: Object.keys(catalog.series).length,
            totalEpisodes,
            lastUpdated: new Date().toISOString()
        };

        fs.writeFileSync(this.paths.catalog, JSON.stringify(catalog, null, 2), 'utf8');
        return catalog;
    }

    // --- Stream Expiry & Cache ---

    isStreamExpired(streamUrl) {
        if (!streamUrl) return true;
        try {
            const parsed = new URL(streamUrl);
            const expires = parsed.searchParams.get('expires');
            if (!expires) return false; // If no expires param, assume valid
            const expirySeconds = parseInt(expires, 10);
            const currentSeconds = Math.floor(Date.now() / 1000);
            // Allow 60 seconds grace period
            return currentSeconds >= (expirySeconds - 60);
        } catch (e) {
            return true;
        }
    }

    getCache(key) {
        const cacheFile = path.join(this.paths.cache, `${this.sanitizeSlug(key)}.json`);
        if (fs.existsSync(cacheFile)) {
            try {
                const item = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                if (item && item.expiresAt && Date.now() > item.expiresAt) {
                    fs.unlinkSync(cacheFile); // Expired cache
                    return null;
                }
                return item ? item.data : null;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    saveCache(key, data, ttlSeconds = 86400) {
        const cacheFile = path.join(this.paths.cache, `${this.sanitizeSlug(key)}.json`);
        const item = {
            cachedAt: Date.now(),
            expiresAt: Date.now() + (ttlSeconds * 1000),
            data
        };
        fs.writeFileSync(cacheFile, JSON.stringify(item, null, 2), 'utf8');
    }

    cleanExpiredCache() {
        let removed = 0;
        const files = fs.readdirSync(this.paths.cache);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const fullPath = path.join(this.paths.cache, file);
            try {
                const item = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                if (item && item.expiresAt && Date.now() > item.expiresAt) {
                    fs.unlinkSync(fullPath);
                    removed++;
                }
            } catch (e) {
                fs.unlinkSync(fullPath);
                removed++;
            }
        }
        return removed;
    }

    // --- Logging ---

    log(level, message) {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        try {
            fs.appendFileSync(this.paths.logFile, line, 'utf8');
        } catch (e) {
            // ignore logging error
        }
    }
}

module.exports = StorageManager;
