// AnimeStream Test Suite - Client Application
let hlsInstance = null;
let currentCatalog = null;
let selectedAnime = null;
let selectedSeason = null;
let currentPlayingStream = null;

const videoPlayer = document.getElementById('videoPlayer');
const playerPlaceholder = document.getElementById('playerPlaceholder');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const tagSeason = document.getElementById('tagSeason');
const tagQuality = document.getElementById('tagQuality');
const tagAudio = document.getElementById('tagAudio');

// --- HLS Player Controller with Audio & Subtitle Selectors ---
function setupSubtitles(subtitles = []) {
    const subSelect = document.getElementById('subtitleTrackSelect');
    if (!subSelect) return;

    // Clear existing text tracks from video element
    const tracks = videoPlayer.querySelectorAll('track');
    tracks.forEach(t => t.remove());

    subSelect.innerHTML = '<option value="-1">Subtitles: Off</option>';

    if (!subtitles || subtitles.length === 0) return;

    subtitles.forEach((sub, idx) => {
        const trackEl = document.createElement('track');
        trackEl.kind = 'subtitles';
        trackEl.label = sub.label || 'English';
        trackEl.srclang = sub.language || 'en';
        trackEl.src = `/api/subtitle?url=${encodeURIComponent(sub.file)}`;
        if (idx === 0) trackEl.default = true;
        videoPlayer.appendChild(trackEl);

        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `💬 ${sub.label || 'English'}`;
        if (idx === 0) opt.selected = true;
        subSelect.appendChild(opt);
    });

    subSelect.onchange = (e) => {
        const val = parseInt(e.target.value, 10);
        for (let i = 0; i < videoPlayer.textTracks.length; i++) {
            videoPlayer.textTracks[i].mode = (i === val) ? 'showing' : 'disabled';
        }
    };
}

function playStream(streamUrl, episodeTitle, seasonName, posterUrl, subtitles = []) {
    currentPlayingStream = streamUrl;
    nowPlayingTitle.textContent = episodeTitle || 'Live Stream';
    tagSeason.textContent = seasonName || 'Episode';
    playerPlaceholder.style.display = 'none';

    // Setup subtitles
    setupSubtitles(subtitles);

    // Route through local HLS proxy to prevent browser CORS restrictions
    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;

    if (Hls.isSupported()) {
        if (hlsInstance) {
            hlsInstance.destroy();
        }
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true
        });

        hlsInstance.loadSource(proxiedUrl);
        hlsInstance.attachMedia(videoPlayer);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS Manifest parsed. Quality levels:', data.levels);
            if (data.levels && data.levels.length > 0) {
                const maxLevel = data.levels[data.levels.length - 1];
                tagQuality.textContent = `${maxLevel.height}p HD`;
            }
            videoPlayer.play().catch(e => console.log('Autoplay deferred:', e));
        });

        // Populate and connect Audio Tracks
        hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
            const audioSelect = document.getElementById('audioTrackSelect');
            if (audioSelect && data.audioTracks && data.audioTracks.length > 0) {
                audioSelect.innerHTML = '';
                data.audioTracks.forEach((track, index) => {
                    const opt = document.createElement('option');
                    opt.value = index;
                    const langName = track.name || track.lang || `Track ${index + 1}`;
                    opt.textContent = `🔊 ${langName} (${(track.lang || '').toUpperCase()})`;
                    if (index === hlsInstance.audioTrack) opt.selected = true;
                    audioSelect.appendChild(opt);
                });

                tagAudio.textContent = `${data.audioTracks.length} Audio Tracks`;

                audioSelect.onchange = (e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (hlsInstance && idx >= 0) {
                        hlsInstance.audioTrack = idx;
                        console.log('Switched audio track to index:', idx);
                    }
                };
            }
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.warn('Hls error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Fatal network error encountered, trying to recover...');
                        hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Fatal media error encountered, trying to recover...');
                        hlsInstance.recoverMediaError();
                        break;
                    default:
                        hlsInstance.destroy();
                        break;
                }
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari / iOS HLS
        videoPlayer.src = proxiedUrl;
        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.play();
        });
    } else {
        alert('Your browser does not support HLS video playback.');
    }
}

// --- Catalog & Library Management ---
async function fetchCatalog() {
    try {
        const res = await fetch('/api/catalog');
        currentCatalog = await res.json();
        
        // Update nav stats
        document.getElementById('statSeries').textContent = `${currentCatalog.stats.totalSeries} Series`;
        document.getElementById('statEpisodes').textContent = `${currentCatalog.stats.totalEpisodes} Episodes`;

        renderSeriesSelector();
    } catch (err) {
        console.error('Failed to load catalog:', err);
    }
}

function renderSeriesSelector() {
    const seriesSelect = document.getElementById('seriesSelector');
    seriesSelect.innerHTML = '';

    const seriesKeys = Object.keys(currentCatalog.series || {});
    if (seriesKeys.length === 0) {
        seriesSelect.innerHTML = '<option value="">(No anime scraped yet)</option>';
        document.getElementById('seasonPills').innerHTML = '';
        document.getElementById('episodesList').innerHTML = '<div class="empty-state">No anime series stored in the file system. Use the scraper above to add one!</div>';
        return;
    }

    seriesKeys.forEach(slug => {
        const item = currentCatalog.series[slug];
        const opt = document.createElement('option');
        opt.value = slug;
        opt.textContent = `${item.title} (${item.slug})`;
        seriesSelect.appendChild(opt);
    });

    if (!selectedAnime || !currentCatalog.series[selectedAnime]) {
        selectedAnime = seriesKeys[0];
    }
    seriesSelect.value = selectedAnime;

    seriesSelect.onchange = (e) => {
        selectedAnime = e.target.value;
        renderSeasonPills();
    };

    renderSeasonPills();
}

function renderSeasonPills() {
    const pillsContainer = document.getElementById('seasonPills');
    pillsContainer.innerHTML = '';

    const seriesData = currentCatalog.series[selectedAnime];
    if (!seriesData || !seriesData.seasons) return;

    const seasonKeys = Object.keys(seriesData.seasons);
    if (seasonKeys.length === 0) return;

    if (!selectedSeason || !seriesData.seasons[selectedSeason]) {
        selectedSeason = seasonKeys[0];
    }

    seasonKeys.forEach(sKey => {
        const season = seriesData.seasons[sKey];
        const pill = document.createElement('button');
        pill.className = `season-pill ${sKey === selectedSeason ? 'active' : ''}`;
        pill.textContent = `${season.title || sKey} (${season.episodesCount})`;
        pill.onclick = () => {
            selectedSeason = sKey;
            renderSeasonPills();
        };
        pillsContainer.appendChild(pill);
    });

    // Update download buttons
    const btnDownloadSeason = document.getElementById('btnDownloadSeasonM3u');
    const btnDownloadMaster = document.getElementById('btnDownloadMasterM3u');

    btnDownloadSeason.href = `/api/playlist?anime=${selectedAnime}&season=${selectedSeason}`;
    btnDownloadMaster.href = `/api/playlist?anime=${selectedAnime}`;

    loadEpisodes(selectedAnime, selectedSeason);
}

async function loadEpisodes(animeSlug, seasonSlug) {
    const listEl = document.getElementById('episodesList');
    listEl.innerHTML = '<div class="loading-state">Loading episodes...</div>';

    try {
        const res = await fetch(`/api/episodes?anime=${animeSlug}&season=${seasonSlug}`);
        if (!res.ok) throw new Error('Failed to load season');
        const seasonData = await res.json();

        const episodes = Object.values(seasonData.episodes || {});
        if (episodes.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No episodes recorded for this season.</div>';
            return;
        }

        // Sort by episode number
        episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));

        // Populate Player Episode Switcher
        populatePlayerSwitcher(episodes, seasonData.seasonTitle);

        listEl.innerHTML = '';
        episodes.forEach(ep => {
            const item = document.createElement('div');
            item.className = 'episode-item';
            
            const posterImg = ep.poster ? `<img src="${ep.poster}" class="episode-thumb" alt="thumb" onerror="this.style.display='none'">` : '';

            item.innerHTML = `
                ${posterImg}
                <div class="episode-details">
                    <div class="episode-title">${ep.title || ep.slug}</div>
                    <div class="episode-sub">ID: ${ep.videoId.slice(0, 12)}... • Stream ready</div>
                </div>
                <div class="play-action-btn">▶</div>
            `;

            item.onclick = () => {
                document.querySelectorAll('.episode-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                playStream(ep.streamUrl, ep.title, seasonData.seasonTitle, ep.poster, ep.subtitles || []);
                const switcher = document.getElementById('playerEpisodeSwitcher');
                if (switcher) switcher.value = ep.slug;
            };

            listEl.appendChild(item);
        });
    } catch (err) {
        listEl.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

// Populate video player top episode dropdown
function populatePlayerSwitcher(episodes, seasonTitle) {
    const switcher = document.getElementById('playerEpisodeSwitcher');
    if (!switcher) return;

    switcher.innerHTML = '<option value="">🎬 Switch Episode...</option>';
    episodes.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.slug;
        const epNumStr = ep.episodeNumber ? `Ep ${ep.episodeNumber}: ` : '';
        const rawName = ep.englishTitle || ep.title || ep.slug;
        // Clean display name
        const cleanName = rawName.replace(/^.+?-\s*Episode\s*\d+:\s*/i, '');
        opt.textContent = `${epNumStr}${cleanName}`;
        switcher.appendChild(opt);
    });

    switcher.onchange = (e) => {
        const slug = e.target.value;
        if (!slug) return;
        const targetEp = episodes.find(ep => ep.slug === slug);
        if (targetEp) {
            playStream(targetEp.streamUrl, targetEp.title, seasonTitle, targetEp.poster, targetEp.subtitles || []);
        }
    };
}

// --- Scraper Form & Live Terminal SSE ---
const scrapeForm = document.getElementById('scrapeForm');
const scrapeBtn = document.getElementById('scrapeBtn');
const terminalContainer = document.getElementById('terminalContainer');
const terminalLogs = document.getElementById('terminalLogs');
const terminalStatus = document.getElementById('terminalStatus');

// --- Interactive Specific Episode Selection Modal Controller ---
let modalEpisodesCache = [];
let modalActiveFilter = 'all';
let currentModalAnimeSlug = null;
let currentModalSeasonSlug = 'season-1';

// Open picker modal by anime title (e.g. from MyAnimeList cards)
window.openEpisodePickerForTitle = async function(animeTitle) {
    const modal = document.getElementById('epPickerModal');
    const titleEl = document.getElementById('epModalAnimeTitle');
    const subEl = document.getElementById('epModalSubtitle');
    const loadingEl = document.getElementById('epModalLoading');
    const gridEl = document.getElementById('epModalGrid');
    const emptyEl = document.getElementById('epModalEmpty');
    const countEl = document.getElementById('epModalCount');

    if (modal) modal.style.display = 'flex';
    if (titleEl) titleEl.textContent = animeTitle;
    if (subEl) subEl.textContent = 'Resolving series sources and discovering episodes...';
    if (loadingEl) loadingEl.style.display = 'block';
    if (gridEl) gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';
    if (countEl) countEl.textContent = 'Searching...';

    try {
        const matchRes = await fetch(`/api/match?title=${encodeURIComponent(animeTitle)}`);
        const matchData = await matchRes.json();
        const matches = matchData.matches || [];

        if (matches.length === 0) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) {
                emptyEl.textContent = `No streaming source found for "${animeTitle}". You can enter a direct URL in the Direct Scraper tab.`;
                emptyEl.style.display = 'block';
            }
            if (countEl) countEl.textContent = '0 episodes';
            return;
        }

        const lower = animeTitle.toLowerCase();
        let bestMatch = matches.find(m => m.isSeries && m.title.toLowerCase() === lower);
        if (!bestMatch) {
            bestMatch = matches.find(m => m.title.toLowerCase() === lower);
        }
        if (!bestMatch && !lower.includes('live action')) {
            bestMatch = matches.find(m => m.isSeries && !m.title.toLowerCase().includes('live action'));
        }
        if (!bestMatch) {
            bestMatch = matches.find(m => m.isSeries) || matches[0];
        }

        await loadModalEpisodesForUrl(bestMatch.url, animeTitle);
    } catch (err) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.textContent = `Error discovering episodes: ${err.message}`;
            emptyEl.style.display = 'block';
        }
    }
};

// Open picker modal directly from a URL (e.g. from Direct Scraper tab)
window.openEpisodePickerForUrl = async function(sourceUrl) {
    const modal = document.getElementById('epPickerModal');
    if (modal) modal.style.display = 'flex';
    await loadModalEpisodesForUrl(sourceUrl, 'Anime Episodes');
};

// Universal episode picker launcher (from Direct Scraper tab button or onclick)
window.openEpisodePicker = function(url) {
    const targetInput = document.getElementById('targetUrl');
    let target = (url || (targetInput ? targetInput.value.trim() : '')).trim();
    if (!target) {
        target = 'https://animesalt.cx/episode/one-piece-21x1155/';
        if (targetInput) targetInput.value = target;
    }
    window.openEpisodePickerForUrl(target);
};

// Fetch episodes & cross-reference with file system library cache
async function loadModalEpisodesForUrl(sourceUrl, fallbackTitle) {
    const titleEl = document.getElementById('epModalAnimeTitle');
    const subEl = document.getElementById('epModalSubtitle');
    const loadingEl = document.getElementById('epModalLoading');
    const gridEl = document.getElementById('epModalGrid');
    const emptyEl = document.getElementById('epModalEmpty');
    const countEl = document.getElementById('epModalCount');
    const searchInput = document.getElementById('epModalSearchInput');
    const clearSearch = document.getElementById('epModalClearSearch');

    if (titleEl) titleEl.textContent = fallbackTitle || 'Anime Episodes';
    if (subEl) subEl.textContent = `Connecting to source and discovering episodes...`;
    if (loadingEl) loadingEl.style.display = 'block';
    if (gridEl) gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';
    if (countEl) countEl.textContent = 'Discovering...';
    if (searchInput) searchInput.value = '';
    if (clearSearch) clearSearch.style.display = 'none';
    modalActiveFilter = 'all';
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));

    try {
        const res = await fetch(`/api/discover?url=${encodeURIComponent(sourceUrl)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        titleEl.textContent = data.animeTitle || fallbackTitle || 'Anime Episodes';
        subEl.textContent = `${data.seasonTitle || 'Season 1'} • Source: ${sourceUrl}`;
        currentModalAnimeSlug = data.animeSlug;
        currentModalSeasonSlug = data.seasonSlug || 'season-1';

        // Check local storage for cached episodes
        let cachedEpisodeMap = {};
        if (currentCatalog && currentCatalog.series && currentCatalog.series[data.animeSlug]) {
            try {
                const epRes = await fetch(`/api/episodes?anime=${data.animeSlug}&season=${currentModalSeasonSlug}`);
                if (epRes.ok) {
                    const seasonData = await epRes.json();
                    cachedEpisodeMap = seasonData.episodes || {};
                }
            } catch (e) {}
        }

        modalEpisodesCache = (data.episodes || []).map(ep => {
            const cached = cachedEpisodeMap[ep.slug] || 
                           (ep.episodeNumber && Object.values(cachedEpisodeMap).find(c => c.episodeNumber === ep.episodeNumber));
            return {
                ...ep,
                isCached: !!cached,
                streamUrl: cached ? cached.streamUrl : null,
                cachedData: cached || null
            };
        });

        loadingEl.style.display = 'none';
        renderFilteredModalEpisodes();
    } catch (err) {
        loadingEl.style.display = 'none';
        emptyEl.textContent = `Error discovering episodes: ${err.message}`;
        emptyEl.style.display = 'block';
        countEl.textContent = 'Error';
    }
}

// Render episode cards inside modal based on search & filter
function renderFilteredModalEpisodes() {
    const gridEl = document.getElementById('epModalGrid');
    const emptyEl = document.getElementById('epModalEmpty');
    const countEl = document.getElementById('epModalCount');
    const searchVal = document.getElementById('epModalSearchInput').value.trim().toLowerCase();

    let filtered = modalEpisodesCache;

    // Filter pill logic
    if (modalActiveFilter === 'cached') {
        filtered = filtered.filter(ep => ep.isCached);
    } else if (modalActiveFilter === 'latest') {
        filtered = filtered.slice(0, 20);
    }

    // Live number & English text search
    if (searchVal) {
        const searchNum = parseInt(searchVal, 10);
        filtered = filtered.filter(ep => {
            if (!isNaN(searchNum) && ep.episodeNumber === searchNum) return true;
            const fullTitle = (ep.englishTitle || ep.title || '').toLowerCase();
            return fullTitle.includes(searchVal);
        });
    }

    countEl.textContent = `${filtered.length} of ${modalEpisodesCache.length} episodes`;

    if (filtered.length === 0) {
        gridEl.innerHTML = '';
        emptyEl.textContent = 'No episodes matched your search filter.';
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';
    gridEl.innerHTML = '';

    filtered.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'ep-picker-card';

        const epNumBadge = ep.episodeNumber ? `Ep ${ep.episodeNumber}` : 'Ep --';
        const rawEng = ep.englishTitle || ep.title || ep.slug;
        const cleanEng = rawEng.replace(/^.+?-\s*Episode\s*\d+:\s*/i, '');
        const statusBadge = ep.isCached 
            ? '<span class="ep-card-status cached">✓ Ready / Cached</span>'
            : '<span class="ep-card-status online">Source Stream</span>';
        const actionBtnText = ep.isCached ? '▶ Play Now' : '🎯 Scrape Single Ep';
        const actionBtnClass = ep.isCached ? 'btn-primary' : 'btn-secondary';

        card.innerHTML = `
            <div>
                <div class="ep-card-top">
                    <span class="ep-card-badge">${epNumBadge}</span>
                    ${statusBadge}
                </div>
                <div class="ep-card-title" title="${cleanEng}">${cleanEng}</div>
            </div>
            <div class="ep-card-action">
                <button type="button" class="btn btn-sm ${actionBtnClass}">${actionBtnText}</button>
            </div>
        `;

        card.onclick = () => {
            handleEpisodeSelection(ep, card);
        };

        gridEl.appendChild(card);
    });
}

// Handle 1-click episode selection from modal
async function handleEpisodeSelection(ep, card) {
    const modal = document.getElementById('epPickerModal');

    // If already stored in library cache, play instantly!
    if (ep.isCached && ep.cachedData) {
        if (modal) modal.style.display = 'none';
        const epData = ep.cachedData;
        playStream(epData.streamUrl, epData.title, selectedSeason || 'Season', epData.poster, epData.subtitles || []);
        const switcher = document.getElementById('playerEpisodeSwitcher');
        if (switcher) switcher.value = epData.slug;
        return;
    }

    if (card) {
        const btn = card.querySelector('.btn');
        if (btn) btn.textContent = '⏳ Scraping...';
    }

    // Set values in Direct Form
    const targetInput = document.getElementById('targetUrl');
    const specificEpInput = document.getElementById('specificEpNum');
    if (targetInput) targetInput.value = ep.url;
    if (specificEpInput) specificEpInput.value = ep.episodeNumber || '';

    // Switch to Single Episode Mode in UI
    if (typeof updateScrapeMode === 'function') {
        updateScrapeMode('single');
    }

    // Switch to Direct Scraper tab
    const tabDirect = document.querySelector('.hub-tab[data-tab="direct-url"]');
    if (tabDirect) tabDirect.click();

    // Close modal
    if (modal) modal.style.display = 'none';

    // Trigger scraping of this specific single episode
    await triggerScraper(ep.url, {
        singleEpisode: true,
        episodeNumber: ep.episodeNumber,
        force: false
    });
}

// Setup Modal Event Listeners
const epModal = document.getElementById('epPickerModal');
const btnEpModalClose = document.getElementById('btnEpModalClose');
const btnEpModalCancel = document.getElementById('btnEpModalCancel');
const btnOpenEpModal = document.getElementById('btnOpenEpModal');
const epModalSearchInput = document.getElementById('epModalSearchInput');
const epModalClearSearch = document.getElementById('epModalClearSearch');

if (btnEpModalClose) btnEpModalClose.onclick = () => { epModal.style.display = 'none'; };
if (btnEpModalCancel) btnEpModalCancel.onclick = () => { epModal.style.display = 'none'; };

if (epModal) {
    epModal.onclick = (e) => {
        if (e.target === epModal) epModal.style.display = 'none';
    };
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && epModal && epModal.style.display === 'flex') {
        epModal.style.display = 'none';
    }
});

if (btnOpenEpModal) {
    btnOpenEpModal.addEventListener('click', () => {
        window.openEpisodePicker();
    });
}

if (epModalSearchInput) {
    epModalSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (epModalClearSearch) epModalClearSearch.style.display = val ? 'block' : 'none';
        renderFilteredModalEpisodes();
    });
}

if (epModalClearSearch) {
    epModalClearSearch.addEventListener('click', () => {
        epModalSearchInput.value = '';
        epModalClearSearch.style.display = 'none';
        renderFilteredModalEpisodes();
        epModalSearchInput.focus();
    });
}

// Modal filter pills
document.querySelectorAll('.modal-quick-filters .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.modal-quick-filters .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        modalActiveFilter = pill.dataset.filter;
        renderFilteredModalEpisodes();
    });
});

// Auto-play newly scraped episode if episodeNumber was targeted
async function autoPlayScrapedEpisode(episodeNumber) {
    if (!currentCatalog || !currentCatalog.series) return;
    
    // Check series for the scraped episode
    for (const [animeSlug, sData] of Object.entries(currentCatalog.series)) {
        if (!sData.seasons) continue;
        for (const seasonSlug of Object.keys(sData.seasons)) {
            try {
                const res = await fetch(`/api/episodes?anime=${animeSlug}&season=${seasonSlug}`);
                if (!res.ok) continue;
                const seasonObj = await res.json();
                const ep = Object.values(seasonObj.episodes || {}).find(e => e.episodeNumber === episodeNumber);
                if (ep) {
                    console.log(`Auto-playing freshly scraped Ep ${episodeNumber}:`, ep.title);
                    playStream(ep.streamUrl, ep.title, seasonObj.seasonTitle, ep.poster, ep.subtitles || []);
                    const switcher = document.getElementById('playerEpisodeSwitcher');
                    if (switcher) switcher.value = ep.slug;
                    return;
                }
            } catch (err) {}
        }
    }
}

// Modular scrape executor
async function triggerScraper(url, options = {}) {
    const { limit = null, force = false, episodeNumber = null, singleEpisode = false, range = null } = options;

    terminalContainer.style.display = 'block';
    terminalLogs.textContent = `[INIT] Starting scraping job for: ${url}\n`;
    if (episodeNumber) terminalLogs.textContent += `[TARGET] Specific Episode No: ${episodeNumber}\n`;
    else if (singleEpisode) terminalLogs.textContent += `[TARGET] Single Episode (auto-detected from URL)\n`;
    if (range) terminalLogs.textContent += `[TARGET] Range: Episodes ${range.from || 1} to ${range.to || 'end'}\n`;

    terminalStatus.textContent = 'RUNNING';
    terminalStatus.classList.remove('done');
    scrapeBtn.disabled = true;

    terminalContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, limit, force, episodeNumber, singleEpisode, range })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('data: ')) {
                    const dataJson = line.replace(/^data:\s*/, '');
                    try {
                        const data = JSON.parse(dataJson);
                        if (data.status) {
                            terminalLogs.textContent += `[${data.index}/${data.total}] [${data.status.toUpperCase()}] ${data.title}\n`;
                        } else if (data.message) {
                            terminalLogs.textContent += `[STATUS] ${data.message}\n`;
                        } else if (data.totalEpisodes !== undefined) {
                            terminalLogs.textContent += `\n🎉 Finished! ${data.totalEpisodes} episodes organized in file system.\n`;
                        }
                        terminalLogs.scrollTop = terminalLogs.scrollHeight;
                    } catch (e) {}
                }
            }
        }

        terminalStatus.textContent = 'COMPLETE';
        terminalStatus.classList.add('done');
        await fetchCatalog();

        // If specific episode was targeted, automatically play it!
        if (episodeNumber) {
            await autoPlayScrapedEpisode(episodeNumber);
        }
    } catch (err) {
        terminalLogs.textContent += `\n❌ Error: ${err.message}\n`;
        terminalStatus.textContent = 'FAILED';
    } finally {
        scrapeBtn.disabled = false;
    }
}

// --- Scrape Mode Toggle Controller (Single Episode vs Season) ---
const modeSingleEp = document.getElementById('modeSingleEp');
const modeSeason = document.getElementById('modeSeason');
const modeSingleLabel = document.getElementById('modeSingleLabel');
const modeSeasonLabel = document.getElementById('modeSeasonLabel');
const epNumInputGroup = document.getElementById('epNumInputGroup');
const seasonLimitGroup = document.getElementById('seasonLimitGroup');
const scrapeBtnText = scrapeBtn ? scrapeBtn.querySelector('.btn-text') : null;

window.updateScrapeMode = function(mode) {
    if (mode === 'single') {
        if (modeSingleLabel) modeSingleLabel.classList.add('active');
        if (modeSeasonLabel) modeSeasonLabel.classList.remove('active');
        if (modeSingleEp) modeSingleEp.checked = true;
        if (epNumInputGroup) epNumInputGroup.style.display = 'flex';
        if (seasonLimitGroup) seasonLimitGroup.style.display = 'none';
        if (scrapeBtnText) scrapeBtnText.textContent = '🎯 Scrape Single Episode';
    } else {
        if (modeSeasonLabel) modeSeasonLabel.classList.add('active');
        if (modeSingleLabel) modeSingleLabel.classList.remove('active');
        if (modeSeason) modeSeason.checked = true;
        if (epNumInputGroup) epNumInputGroup.style.display = 'none';
        if (seasonLimitGroup) seasonLimitGroup.style.display = 'flex';
        if (scrapeBtnText) scrapeBtnText.textContent = '⚡ Scrape Full Season';
    }
};

if (modeSingleEp) {
    modeSingleEp.addEventListener('change', () => window.updateScrapeMode('single'));
}
if (modeSeason) {
    modeSeason.addEventListener('change', () => window.updateScrapeMode('season'));
}

scrapeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = document.getElementById('targetUrl').value.trim();
    if (!url) return;

    const forceEl = document.getElementById('forceScrape');
    const force = forceEl ? forceEl.checked : false;

    const isSingle = modeSingleEp ? modeSingleEp.checked : true;

    if (isSingle) {
        const specificEpInput = document.getElementById('specificEpNum');
        let episodeNumber = null;
        if (specificEpInput && specificEpInput.value && specificEpInput.value.toLowerCase() !== 'auto') {
            episodeNumber = parseInt(specificEpInput.value, 10);
        }
        await triggerScraper(url, { force, singleEpisode: true, episodeNumber });
    } else {
        const limitInput = document.getElementById('scrapeLimit');
        let limit = null;
        if (limitInput && limitInput.value) {
            limit = parseInt(limitInput.value, 10);
        }
        await triggerScraper(url, { force, singleEpisode: false, limit });
    }
});

// --- MyAnimeList Integration ---

// Hub Tab Switching
document.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.hub-panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = `tab-${tab.dataset.tab}`;
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add('active');
    });
});

// MAL Search Form Handler
const malSearchForm = document.getElementById('malSearchForm');
const malSearchResults = document.getElementById('malSearchResults');

malSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('malSearchInput').value.trim();
    if (!q) return;

    malSearchResults.innerHTML = '<div class="loading-state">Searching MyAnimeList...</div>';

    try {
        const res = await fetch(`/api/mal/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            malSearchResults.innerHTML = '<div class="empty-state">No anime found on MyAnimeList for this query.</div>';
            return;
        }

        malSearchResults.innerHTML = '';
        results.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'mal-card';
            const poster = anime.image || '';
            const scoreText = anime.score ? `★ ${anime.score}` : 'No score';
            const yearText = anime.year ? ` • ${anime.year}` : '';

            const primaryTitle = anime.english_name || anime.name;
            const hasRomaji = anime.english_name && anime.english_name.toLowerCase() !== anime.name.toLowerCase();
            const romajiSub = hasRomaji ? `<div class="mal-romaji-sub">🇯🇵 ${anime.name}</div>` : '';

            card.innerHTML = `
                <img src="${poster}" class="mal-poster" alt="${primaryTitle}" onerror="this.style.display='none'">
                <div class="mal-info">
                    <div>
                        <div class="mal-title" title="${primaryTitle}">${primaryTitle}</div>
                        ${romajiSub}
                        <div class="mal-meta">
                            <span><span class="mal-score">${scoreText}</span>${yearText}</span>
                            <span>${anime.media_type || 'Anime'} • ${anime.status || ''}</span>
                        </div>
                    </div>
                    <div class="mal-actions">
                        <button type="button" class="btn btn-sm btn-primary btn-scrape-all">⚡ Scrape All</button>
                        <button type="button" class="btn btn-sm btn-secondary btn-pick-ep">🎯 Pick Ep</button>
                        <a href="${anime.url}" target="_blank" class="btn btn-sm btn-outline">MAL ↗</a>
                    </div>
                </div>
            `;

            const btnScrape = card.querySelector('.btn-scrape-all');
            const btnPick = card.querySelector('.btn-pick-ep');
            if (btnScrape) btnScrape.addEventListener('click', () => autoMatchAndScrape(primaryTitle));
            if (btnPick) btnPick.addEventListener('click', () => window.openEpisodePickerForTitle(primaryTitle));

            malSearchResults.appendChild(card);
        });
    } catch (err) {
        malSearchResults.innerHTML = `<div class="empty-state">Error searching MyAnimeList: ${err.message}</div>`;
    }
});

// Quick MAL Search Chip
window.quickMalSearch = function(title) {
    document.getElementById('malSearchInput').value = title;
    malSearchForm.dispatchEvent(new Event('submit'));
};

// MAL User Watchlist Form Handler
const malUserForm = document.getElementById('malUserForm');
const malUserResults = document.getElementById('malUserResults');

malUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('malUsernameInput').value.trim();
    const status = document.getElementById('malListStatus').value;
    if (!username) return;

    malUserResults.innerHTML = `<div class="loading-state">Loading ${username}'s MyAnimeList watchlist...</div>`;

    try {
        const res = await fetch(`/api/mal/user?username=${encodeURIComponent(username)}&status=${status}`);
        const data = await res.json();
        const items = data.results || [];

        if (items.length === 0) {
            malUserResults.innerHTML = `<div class="empty-state">No anime found in ${username}'s list under this filter.</div>`;
            return;
        }

        malUserResults.innerHTML = '';
        items.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'mal-card';
            const poster = anime.image || '';
            const epText = anime.total_episodes ? `${anime.num_watched} / ${anime.total_episodes} eps` : `${anime.num_watched} eps`;

            const primaryTitle = anime.english_title || anime.title;
            const hasRomaji = anime.english_title && anime.english_title.toLowerCase() !== anime.title.toLowerCase();
            const romajiSub = hasRomaji ? `<div class="mal-romaji-sub">🇯🇵 ${anime.title}</div>` : '';

            card.innerHTML = `
                <img src="${poster}" class="mal-poster" alt="${primaryTitle}" onerror="this.style.display='none'">
                <div class="mal-info">
                    <div>
                        <div class="mal-title" title="${primaryTitle}">${primaryTitle}</div>
                        ${romajiSub}
                        <div class="mal-meta">
                            <span class="mal-score">Watched: ${epText}</span>
                            <span>Status: ${anime.airing_status || 'Airing'}</span>
                        </div>
                    </div>
                    <div class="mal-actions">
                        <button type="button" class="btn btn-sm btn-primary btn-scrape-all">⚡ Scrape All</button>
                        <button type="button" class="btn btn-sm btn-secondary btn-pick-ep">🎯 Pick Ep</button>
                        <a href="${anime.url}" target="_blank" class="btn btn-sm btn-outline">MAL ↗</a>
                    </div>
                </div>
            `;

            const btnScrape = card.querySelector('.btn-scrape-all');
            const btnPick = card.querySelector('.btn-pick-ep');
            if (btnScrape) btnScrape.addEventListener('click', () => autoMatchAndScrape(primaryTitle));
            if (btnPick) btnPick.addEventListener('click', () => window.openEpisodePickerForTitle(primaryTitle));

            malUserResults.appendChild(card);
        });
    } catch (err) {
        malUserResults.innerHTML = `<div class="empty-state">Error loading user list: ${err.message}</div>`;
    }
});

// Auto-Match AnimeSalt streams by title and launch scraper
window.autoMatchAndScrape = async function(animeTitle) {
    // Show notification/feedback
    terminalContainer.style.display = 'block';
    terminalLogs.textContent = `[MATCH] Querying stream sources for MyAnimeList title: "${animeTitle}"...\n`;
    terminalStatus.textContent = 'MATCHING';
    terminalContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        const res = await fetch(`/api/match?title=${encodeURIComponent(animeTitle)}`);
        const data = await res.json();
        const matches = data.matches || [];

        if (matches.length === 0) {
            terminalLogs.textContent += `❌ No direct series page match found on stream provider for "${animeTitle}".\nYou can paste a direct URL in the "Direct Scraper" tab.\n`;
            terminalStatus.textContent = 'NO MATCH';
            return;
        }

        const bestMatch = matches.find(m => m.isSeries) || matches[0];
        terminalLogs.textContent += `✅ Found matching stream source:\n   Title: ${bestMatch.title}\n   URL: ${bestMatch.url}\n\n`;

        // Launch scraper automatically for this series
        await triggerScraper(bestMatch.url, { limit: 2, force: false });
    } catch (err) {
        terminalLogs.textContent += `❌ Match error: ${err.message}\n`;
        terminalStatus.textContent = 'FAILED';
    }
};

// Quick Sample Filler
window.setSample = function(url, epNum = 1155) {
    document.getElementById('targetUrl').value = url;
    const epInput = document.getElementById('specificEpNum');
    if (epInput) epInput.value = epNum;
};

// Copy URL Button
document.getElementById('btnCopyStream').addEventListener('click', () => {
    if (!currentPlayingStream) {
        alert('No stream is currently playing.');
        return;
    }
    navigator.clipboard.writeText(currentPlayingStream).then(() => {
        const btn = document.getElementById('btnCopyStream');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    });
});

// Test Custom URL Input
document.getElementById('btnTestCustom').addEventListener('click', () => {
    const customUrl = document.getElementById('customUrlInput').value.trim();
    if (!customUrl) {
        alert('Please enter a valid .m3u8 stream URL.');
        return;
    }
    playStream(customUrl, 'Custom Test Stream', 'Custom', '');
});

// Initialize on Load
fetchCatalog();
