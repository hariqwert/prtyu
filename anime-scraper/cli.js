#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const ScraperEngine = require('./lib/scraper-engine');
const StorageManager = require('./lib/storage-manager');

const baseDir = __dirname;
const engine = new ScraperEngine({ baseDir });
const storage = new StorageManager(baseDir);

function printBanner() {
    console.log(`
┌──────────────────────────────────────────────────────────┐
│      AnimeStream M3U Automated Scraping File System      │
└──────────────────────────────────────────────────────────┘`);
}

function printHelp() {
    printBanner();
    console.log(`
Commands:
  scrape <url> [options]    Scrape an episode or season and store in file system
    Options:
      --episode, -e <num>   Scrape ONLY a specific single episode number (e.g. -e 1091)
      --single, -s          Scrape ONLY the single episode specified in the URL
      --limit <num>         Limit the number of episodes to process (e.g. --limit 5)
      --force               Force re-scrape even if cached and unexpired

  episode <url> [num]       Shortcut: scrape a specific single episode directly
  list                      List all stored anime series, seasons, and playlists
  export <anime-slug>       Regenerate M3U playlists for a given anime series
  status                    Show storage system status, directories, and statistics
  clean                     Clean up expired stream cache tokens

Examples:
  # Scrape a specific single episode by number
  node anime-scraper/cli.js scrape https://animesalt.cx/episode/one-piece-21x1155/ --episode 1091
  node anime-scraper/cli.js episode https://animesalt.cx/episode/one-piece-21x1155/ 1089

  # Scrape only the single episode linked in the URL
  node anime-scraper/cli.js scrape https://animesalt.cx/episode/one-piece-21x1155/ --single

  # Scrape entire season with limit
  node anime-scraper/cli.js scrape https://animesalt.cx/episode/one-piece-21x1155/ --limit 3
`);
}

async function handleScrape(args) {
    const url = args[0];
    if (!url || !url.startsWith('http')) {
        console.error('Error: Please provide a valid HTTP URL to scrape.');
        process.exit(1);
    }

    let limit = null;
    let force = false;
    let episodeNumber = null;
    let singleEpisode = false;

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1], 10);
            i++;
        } else if ((args[i] === '--episode' || args[i] === '-e') && args[i + 1]) {
            episodeNumber = parseInt(args[i + 1], 10);
            singleEpisode = true;
            i++;
        } else if (args[i] === '--single' || args[i] === '-s') {
            singleEpisode = true;
        } else if (args[i] === '--force') {
            force = true;
        }
    }

    printBanner();
    console.log(`Target URL: ${url}`);
    if (episodeNumber) console.log(`Mode: 🎯 Specific Single Episode #${episodeNumber}`);
    else if (singleEpisode) console.log(`Mode: 🎯 Single Episode (from URL)`);
    else if (limit) console.log(`Episode Limit: ${limit}`);
    else console.log(`Mode: Full Season Scrape`);
    if (force) console.log(`Force Refresh: Enabled (cache bypass)`);
    console.log('────────────────────────────────────────────────────────────');

    try {
        const result = await engine.scrape(url, {
            limit,
            force,
            episodeNumber,
            singleEpisode,
            onProgress: (p) => {
                const icon = p.status === 'cached' ? '⚡ [CACHED]' : p.status === 'resolved' ? '✅ [RESOLVED]' : p.status === 'scraping' ? '⏳ [FETCHING]' : '❌ [FAILED]';
                console.log(`[${p.index}/${p.total}] ${icon} ${p.title}`);
                if (p.error) console.log(`    ↳ Error: ${p.error}`);
            }
        });

        console.log('────────────────────────────────────────────────────────────');
        console.log(`🎉 Scrape complete for "${result.animeTitle}" (${result.seasonSlug})`);
        console.log(`   • Newly Resolved : ${result.updatedCount}`);
        console.log(`   • Kept from Cache: ${result.skippedCount}`);
        console.log(`   • Failed         : ${result.failedCount}`);
        console.log(`   • Total Episodes : ${result.totalEpisodes}`);
        console.log(`📁 Metadata File   : ${path.resolve(result.metadataPath)}`);
        console.log(`📺 Season Playlist : ${path.resolve(result.playlistPath)}`);
        console.log(`🌐 Master Playlist : ${path.resolve(storage.getPlaylistDir(result.animeSlug), 'all-seasons.m3u')}`);
    } catch (err) {
        console.error('Fatal scrape error:', err.message);
        process.exit(1);
    }
}

async function handleSingleEpisode(args) {
    const url = args[0];
    if (!url || !url.startsWith('http')) {
        console.error('Error: Please provide a valid HTTP URL to scrape.');
        process.exit(1);
    }

    const epNum = args[1] && !args[1].startsWith('--') ? parseInt(args[1], 10) : null;
    const force = args.includes('--force');

    printBanner();
    console.log(`Target URL: ${url}`);
    console.log(`Mode: 🎯 Single Episode Scrape ${epNum ? `(#${epNum})` : '(from URL)'}`);
    console.log('────────────────────────────────────────────────────────────');

    try {
        const result = await engine.scrape(url, {
            singleEpisode: true,
            episodeNumber: epNum,
            force,
            onProgress: (p) => {
                const icon = p.status === 'cached' ? '⚡ [CACHED]' : p.status === 'resolved' ? '✅ [RESOLVED]' : p.status === 'scraping' ? '⏳ [FETCHING]' : '❌ [FAILED]';
                console.log(`[${p.index}/${p.total}] ${icon} ${p.title}`);
                if (p.error) console.log(`    ↳ Error: ${p.error}`);
            }
        });

        console.log('────────────────────────────────────────────────────────────');
        console.log(`🎉 Single episode scrape complete for "${result.animeTitle}"!`);
        console.log(`📁 Metadata File   : ${path.resolve(result.metadataPath)}`);
        console.log(`📺 Season Playlist : ${path.resolve(result.playlistPath)}`);
    } catch (err) {
        console.error('Fatal scrape error:', err.message);
        process.exit(1);
    }
}

function handleList() {
    printBanner();
    const catalog = storage.getCatalog();
    const seriesKeys = Object.keys(catalog.series || {});

    if (seriesKeys.length === 0) {
        console.log('No anime series scraped yet. Run a scrape command first!');
        return;
    }

    console.log(`Total Stored Series: ${catalog.stats.totalSeries} | Total Episodes: ${catalog.stats.totalEpisodes}\n`);

    seriesKeys.forEach((key, idx) => {
        const item = catalog.series[key];
        console.log(`${idx + 1}. ${item.title} (slug: ${item.slug})`);
        console.log(`   Last Updated: ${item.lastUpdated}`);
        const seasons = Object.keys(item.seasons || {});
        seasons.forEach(s => {
            const sn = item.seasons[s];
            console.log(`   ├── ${sn.title || s}: ${sn.episodesCount} episode(s)`);
            console.log(`   │   Playlist: ${path.join(storage.storageDir, sn.playlistFile)}`);
        });
        console.log(`   └── Master Playlist: ${path.join(storage.getPlaylistDir(item.slug), 'all-seasons.m3u')}\n`);
    });
}

function handleStatus() {
    printBanner();
    const catalog = storage.getCatalog();
    const cacheFiles = fs.readdirSync(storage.paths.cache);

    console.log('File System Storage Locations:');
    console.log(`  • Root Storage Dir : ${storage.storageDir}`);
    console.log(`  • Metadata Directory: ${storage.paths.metadata}`);
    console.log(`  • Playlists Directory: ${storage.paths.playlists}`);
    console.log(`  • Cache Directory   : ${storage.paths.cache} (${cacheFiles.length} files)`);
    console.log(`  • Logs Directory    : ${storage.paths.logs}`);
    console.log(`  • Catalog Index     : ${storage.paths.catalog}`);
    console.log('\nDatabase Statistics:');
    console.log(`  • Total Series Scraped : ${catalog.stats.totalSeries || 0}`);
    console.log(`  • Total Episodes Indexed: ${catalog.stats.totalEpisodes || 0}`);
}

function handleClean() {
    printBanner();
    const removed = storage.cleanExpiredCache();
    console.log(`Cleaned ${removed} expired stream cache token(s).`);
}

function handleExport(args) {
    const slug = args[0];
    if (!slug) {
        console.error('Error: Please provide anime slug to export (e.g. "one-piece"). Run "list" to see slugs.');
        process.exit(1);
    }
    const catalog = storage.getCatalog();
    const item = catalog.series[storage.sanitizeSlug(slug)];
    if (!item) {
        console.error(`Error: Series "${slug}" not found in catalog.`);
        process.exit(1);
    }

    const playlistPath = engine.updateMasterPlaylist(item.slug, item.title);
    console.log(`✅ Master playlist regenerated at: ${path.resolve(playlistPath)}`);
}

// --- Main Router ---
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
    case 'scrape':
        handleScrape(args);
        break;
    case 'episode':
        handleSingleEpisode(args);
        break;
    case 'list':
        handleList();
        break;
    case 'status':
        handleStatus();
        break;
    case 'clean':
        handleClean();
        break;
    case 'export':
        handleExport(args);
        break;
    default:
        printHelp();
        break;
}
