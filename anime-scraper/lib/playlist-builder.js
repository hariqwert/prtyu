const fs = require('fs');
const path = require('path');

class PlaylistBuilder {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    /**
     * Build an M3U playlist string from an array of episode objects
     */
    generateM3u(episodes, groupTitle = 'Anime') {
        let content = '#EXTM3U\n';

        for (const ep of episodes) {
            if (!ep.streamUrl) continue;

            const logoAttr = ep.poster ? ` tvg-logo="${ep.poster}"` : '';
            const idAttr = ep.slug ? ` tvg-id="${ep.slug}"` : '';
            const nameAttr = ep.title ? ` tvg-name="${ep.title.replace(/"/g, "'")}"` : '';
            const groupAttr = groupTitle ? ` group-title="${groupTitle.replace(/"/g, "'")}"` : '';

            const displayTitle = ep.title || ep.slug || 'Episode';

            content += `#EXTINF:-1${idAttr}${nameAttr}${logoAttr}${groupAttr}, ${displayTitle}\n`;
            content += `${ep.streamUrl}\n`;
        }

        return content;
    }

    /**
     * Save a season playlist
     */
    saveSeasonPlaylist(animeSlug, seasonSlug, animeTitle, seasonTitle, episodes) {
        const playlistDir = this.storage.getPlaylistDir(animeSlug);
        const filename = `${this.storage.sanitizeSlug(seasonSlug)}.m3u`;
        const filePath = path.join(playlistDir, filename);

        const groupName = `${animeTitle || animeSlug} - ${seasonTitle || seasonSlug}`;
        const content = this.generateM3u(episodes, groupName);

        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    }

    /**
     * Save an all-seasons combined playlist
     */
    saveMasterPlaylist(animeSlug, animeTitle, allEpisodes) {
        const playlistDir = this.storage.getPlaylistDir(animeSlug);
        const filePath = path.join(playlistDir, 'all-seasons.m3u');

        const content = this.generateM3u(allEpisodes, animeTitle || animeSlug);
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    }
}

module.exports = PlaylistBuilder;
