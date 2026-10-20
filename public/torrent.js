
window.addEventListener('error', function(e) {
  if (e && e.message && (e.message.includes('Script error') || e.message.includes('currentTime') || e.message.includes('play'))) {
    e.preventDefault();
    return True;
  }
});
window.addEventListener('unhandledrejection', function(e) {
  if (e && e.reason && (String(e.reason).includes('abort') || String(e.reason).includes('pause') || String(e.reason).includes('play') || String(e.reason).includes('Script error'))) {
    e.preventDefault();
  }
});


// Global Toast Notification Helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
window.showToast = showToast;

// TorrStream Client Application Logic

const TORRSERVER_BASE = '';

// State
let activeTorrentHash = null;
let activeFileIndex = null;
let currentTorrentData = null;
let activeMediaData = null;
let statsPollInterval = null;
let serverPollInterval = null;
let metadataPollTimer = null;
let gstEngineMode = 'direct'; // Default: 'direct' (Direct Stream Raw), 'remux' (FFmpeg Remux), 'transcode' (FFmpeg Transcode)
let currentStreamInfo = { hash: null, fileId: null, filePath: '', title: '', fileLength: 0 };
let directRetryCount = 0;
let isPlaybackInitiated = false;

// DOM Elements
const serverStatusPill = document.getElementById('serverStatusPill');
const serverStatusText = document.getElementById('serverStatusText');
const refreshServerBtn = document.getElementById('refreshServerBtn');
const bufferPresetText = document.getElementById('bufferPresetText');
const presetTag = document.getElementById('presetTag');

const magnetForm = document.getElementById('magnetForm');
const magnetInput = document.getElementById('magnetInput');
const pasteBtn = document.getElementById('pasteBtn');
const clearInputBtn = document.getElementById('clearInputBtn');
const playBtn = document.getElementById('playBtn');

const videoPlayer = document.getElementById('videoPlayer');
const playerPlaceholder = document.getElementById('playerPlaceholder');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
const loadingSubtitle = document.getElementById('loadingSubtitle');
const bufferProgressFill = document.getElementById('bufferProgressFill');

const statsOverlay = document.getElementById('statsOverlay');
const statSpeed = document.getElementById('statSpeed');
const statPeers = document.getElementById('statPeers');
const statBuffer = document.getElementById('statBuffer');

const currentTitle = document.getElementById('currentTitle');
const currentHash = document.getElementById('currentHash');
const currentSize = document.getElementById('currentSize');
const copyStreamUrlBtn = document.getElementById('copyStreamUrlBtn');
const toggleFilesBtn = document.getElementById('toggleFilesBtn');

const filesListContainer = document.getElementById('filesListContainer');
const filesCountBadge = document.getElementById('filesCountBadge');
const activeTorrentsList = document.getElementById('activeTorrentsList');
const refreshTorrentsBtn = document.getElementById('refreshTorrentsBtn');

// Search Modal Elements
const openSearchBtn = document.getElementById('openSearchBtn');
const closeSearchBtn = document.getElementById('closeSearchBtn');
const searchModal = document.getElementById('searchModal');
const modalSearchForm = document.getElementById('modalSearchForm');
const modalSearchInput = document.getElementById('modalSearchInput');
const searchResultsArea = document.getElementById('searchResultsArea');
const episodeSelectRow = document.getElementById('episodeSelectRow');
const seasonInput = document.getElementById('seasonInput');
const episodeInput = document.getElementById('episodeInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  
  checkServerConnection();
  serverPollInterval = setInterval(checkServerConnection, 30000);
  
  setupEventListeners();
  loadActiveTorrentsList();
  
  // Set Instant Stream 200MB + 10% Prebuffer + Auto Cache Removal for zero-wait playback
  applyBufferSettings(524288000, 120, 10, '500MB Instant', 'Instant Stream');

  // Check URL parameters for Direct Auto-Play API Link (?q=... or ?play=... or ?magnet=...)
  checkUrlAutoPlay();
});

// Helper functions for size prioritization (1.5GB - 2.5GB movie streams given top priority)
function parseSizeBytes(input) {
  if (typeof input === 'number' && !isNaN(input)) return input;
  if (!input || typeof input !== 'string') return 0;
  const str = input.trim();
  const match = str.match(/([\d\.]+)\s*([GMKT]?i?B)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase().replace('I', '');
    if (unit === 'TB') return val * 1024 * 1024 * 1024 * 1024;
    if (unit === 'GB') return val * 1024 * 1024 * 1024;
    if (unit === 'MB') return val * 1024 * 1024;
    if (unit === 'KB') return val * 1024;
    if (unit === 'B') return val;
  }
  return 0;
}

function getStreamPriorityScore(item, isMovie = true) {
  let bytes = item.sizeBytes || 0;
  if (!bytes && item.size) {
    bytes = parseSizeBytes(item.size);
  }
  if (!bytes && item.raw_title) {
    bytes = parseSizeBytes(item.raw_title);
  }

  const sizeInGB = bytes / (1024 * 1024 * 1024);
  const seeders = item.seeders || item.seeds || 0;

  let tierScore = 0;
  if (isMovie) {
    if (sizeInGB >= 1.45 && sizeInGB <= 2.55) {
      // MOST PRIORITIZED: 1.5 GB to 2.5 GB
      tierScore = 300000;
    } else if (sizeInGB > 0 && sizeInGB < 1.45) {
      // MEDIUM PRIORITY: Less than 1.5 GB
      tierScore = 200000;
    } else if (sizeInGB > 2.55) {
      // LEAST PRIORITIZED: Above 2.5 GB
      tierScore = 100000;
    } else {
      tierScore = 300000;
    }
  } else {
    tierScore = 100000;
  }

  return tierScore + Math.min(seeders, 9999);
}

// Direct Auto-Play API Handler
async function checkUrlAutoPlay() {
  const urlParams = new URLSearchParams(window.location.search);
  const autoQuery = urlParams.get('play') || urlParams.get('q') || urlParams.get('search') || urlParams.get('magnet');

  if (autoQuery) {
    const queryStr = autoQuery.trim();
    console.log(`[Auto-Play API] Direct play trigger for: "${queryStr}"`);
    magnetInput.value = queryStr;

    if (queryStr.startsWith('magnet:?') || queryStr.startsWith('http://') || queryStr.startsWith('https://')) {
      playMagnetOrUrl(queryStr);
    } else {
      showLoading(`Searching & Auto-Playing "${queryStr}"...`, 'Fetching best stream from external providers...');
      try {
        const type = urlParams.get('type') || 'movie';
        const season = urlParams.get('season') || urlParams.get('s') || '1';
        const episode = urlParams.get('episode') || urlParams.get('e') || '1';
        const tmdb = urlParams.get('tmdb');
        const imdb = urlParams.get('imdb');

        let searchApiUrl = `/api/v1/search?q=${encodeURIComponent(queryStr)}&type=${type}&s=${season}&e=${episode}`;
        if (tmdb) searchApiUrl += `&tmdb=${tmdb}`;
        if (imdb) searchApiUrl += `&imdb=${imdb}`;

        const res = await fetch(searchApiUrl);
        if (res.ok) {
          if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();
          
    let results = data.results || data.streams || [];
    if (results.length === 0 && data.imdbId) {
        try {
            const torrentioType = data.mediaType === 'series' ? 'series' : 'movie';
            const streamPath = torrentioType === 'series' ? `${data.imdbId}:${data.season}:${data.episode}` : data.imdbId;
            const torUrl = `https://torrentio.strem.fun/stream/${torrentioType}/${streamPath}.json`;
            console.log('Fallback fetching from Torrentio API on client:', torUrl);
            const torRes = await fetch(torUrl);
            const torData = await torRes.json();
            if (torData && torData.streams) {
                results = torData.streams.map(s => {
                    const infoHash = s.infoHash;
                    let magnet = s.magnet;
                    if (!magnet && infoHash) {
                        magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(data.title)}`;
                        const DEFAULT_TRACKERS = [
                            'http://nyaa.tracker.wf:7777/announce',
                            'udp://tracker.opentrackr.org:1337/announce',
                            'udp://open.stealth.si:80/announce',
                            'udp://tracker.torrent.eu.org:451/announce',
                            'udp://exodus.desync.com:6969/announce',
                            'udp://tracker.dler.org:6969/announce',
                            'udp://open.demonii.com:1337/announce',
                            'udp://tracker.openbittorrent.com:6969/announce',
                            'udp://opentracker.i2p.rocks:6969/announce'
                        ];
                        DEFAULT_TRACKERS.forEach(tr => {
                            magnet += `&tr=${encodeURIComponent(tr)}`;
                        });
                    }
                    const rawTitle = s.title || s.name || data.title;
                    const seedMatch = rawTitle.match(/👤\s*(\d+)/);
                    const sizeMatch = rawTitle.match(/💾\s*([\d\.]+\s*[GMK]B)/i);
                    const qualityMatch = rawTitle.match(/(2160p|4K|1080p|720p|HDR|Remux|CAM|TS)/i);
                    return {
                        name: s.name || 'Torrent Stream',
                        title: `${data.title} (${qualityMatch ? qualityMatch[1] : '1080p'})`,
                        raw_title: rawTitle,
                        magnet: magnet,
                        infoHash: infoHash,
                        seeders: seedMatch ? parseInt(seedMatch[1]) : 0,
                        size: sizeMatch ? sizeMatch[1] : 'Unknown',
                        quality: qualityMatch ? qualityMatch[1] : 'HD'
                    };
                });
                results.sort((a, b) => getStreamPriorityScore(b, (type || 'movie') === 'movie') - getStreamPriorityScore(a, (type || 'movie') === 'movie'));
                data.results = results;
            }
        } catch (e) {
            console.error('Fallback torrentio error:', e);
        }
    }

          if (data.results && data.results.length > 0) {
            const isMovie = (type || 'movie') === 'movie';
            data.results.sort((a, b) => getStreamPriorityScore(b, isMovie) - getStreamPriorityScore(a, isMovie));
            const bestResult = data.results[0];
            console.log(`[Auto-Play API] Selected top stream (Size Prioritized): ${bestResult.title} (${bestResult.size || 'Unknown'})`);
            magnetInput.value = bestResult.magnet;
            playMagnetOrUrl(bestResult.magnet);
            return;
          }
        }
      } catch (e) {
        console.warn('Auto-play search failed:', e);
      }
      playMagnetOrUrl(queryStr);
    }
  }
}

// Event Listeners
function setupEventListeners() {
  if (refreshServerBtn) refreshServerBtn.addEventListener('click', checkServerConnection);
  
  if (clearInputBtn) clearInputBtn.addEventListener('click', () => {
    magnetInput.value = '';
    magnetInput.focus();
  });

  if (pasteBtn) pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        magnetInput.value = text.trim();
        magnetInput.focus();
      }
    } catch (err) {
      console.warn('Clipboard access denied:', err);
    }
  });

  if (magnetForm) magnetForm.addEventListener('submit', (e) => {
    e.preventDefault();
        e.stopImmediatePropagation();
    const inputVal = magnetInput.value.trim();
    if (inputVal) {
      playMagnetOrUrl(inputVal);
    }
  });

  // Search Type Radio Toggle (Movie vs TV Series)
  document.querySelectorAll('input[name="mediaType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'series') {
        episodeSelectRow.classList.remove('hidden');
      } else {
        episodeSelectRow.classList.add('hidden');
      }
    });
  });

  // Search Modal Handlers
  const triggerSearchModalOpen = () => {
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch(e) {}
    }
    if (window.plyrPlayer && window.plyrPlayer.fullscreen && window.plyrPlayer.fullscreen.active) {
      try { window.plyrPlayer.fullscreen.exit(); } catch(e) {}
    }
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('modalSearchInput');
    if (modal) modal.classList.remove('hidden');
    if (input) setTimeout(() => input.focus(), 150);
  };

  const openSearchBtnToolbar = document.getElementById('openSearchBtnToolbar');
  if (openSearchBtnToolbar) openSearchBtnToolbar.addEventListener('click', triggerSearchModalOpen);
  if (openSearchBtn) openSearchBtn.addEventListener('click', triggerSearchModalOpen);
  
  document.querySelectorAll('.open-search-trigger, #openSearchBtn, #openSearchBtnToolbar, [data-action="open-search"]').forEach(el => {
    el.addEventListener('click', triggerSearchModalOpen);
  });

  if (closeSearchBtn) closeSearchBtn.addEventListener('click', () => {
    searchModal.classList.add('hidden');
  });

  if (searchModal) searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      searchModal.classList.add('hidden');
    }
  });

  if (modalSearchForm) modalSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let q = modalSearchInput.value.trim();
    let selectedType = document.querySelector('input[name="mediaType"]:checked').value;
    let season = seasonInput.value || '1';
    let episode = episodeInput.value || '1';

    const seMatch = q.match(/s(\d+)[\s._-]*(?:e|p)(\d+)/i) || q.match(/(\d+)x(\d+)/i) || q.match(/season\s*(\d+)\s*(?:ep(?:isode)?|p(?:art)?)\s*(\d+)/i);
    const epMatch = q.match(/(?:ep(?:isode)?|p(?:art)?)\s*(\d+)/i);
    
    if (seMatch) {
        season = parseInt(seMatch[1], 10);
        episode = parseInt(seMatch[2], 10);
        selectedType = 'series';
        q = q.replace(/s\d+[\s._-]*(?:e|p)\d+/i, '').replace(/\d+x\d+/i, '').replace(/season\s*\d+\s*(?:ep(?:isode)?|p(?:art)?)\s*\d+/i, '').trim();
    } else if (epMatch) {
        episode = parseInt(epMatch[1], 10);
        selectedType = 'series';
        q = q.replace(/(?:ep(?:isode)?|p(?:art)?)\s*\d+/i, '').trim();
    }

    if (selectedType === 'series') {
        const seriesRadio = document.querySelector('input[value="series"]');
        if (seriesRadio) seriesRadio.checked = true;
        const epRow = document.getElementById('episodeSelectRow');
        if (epRow) epRow.classList.remove('hidden');
        if (seasonInput) seasonInput.value = season;
        if (episodeInput) episodeInput.value = episode;
    }

    if (q) performMovieSearch(q, selectedType, season, episode);
  });

  if (modalSearchInput) {
    modalSearchInput.addEventListener('input', (e) => {
      let q = e.target.value.trim();
      const seMatch = q.match(/s(\d+)[\s._-]*(?:e|p)(\d+)/i) || q.match(/(\d+)x(\d+)/i) || q.match(/season\s*(\d+)\s*(?:ep(?:isode)?|p(?:art)?)\s*(\d+)/i);
      const epMatch = q.match(/(?:ep(?:isode)?|p(?:art)?)\s*(\d+)/i);
      const seriesRadio = document.querySelector('input[name="mediaType"][value="series"]');
      const epRow = document.getElementById('episodeSelectRow');

      if (seMatch || epMatch) {
        if (seriesRadio && !seriesRadio.checked) {
          seriesRadio.checked = true;
          if (epRow) epRow.classList.remove('hidden');
        }
        if (seMatch && seasonInput) seasonInput.value = parseInt(seMatch[1], 10);
        if (seMatch && episodeInput) episodeInput.value = parseInt(seMatch[2], 10);
        if (!seMatch && epMatch && episodeInput) episodeInput.value = parseInt(epMatch[1], 10);
      }
    });
  }

  // Buffer Mode Buttons
  document.querySelectorAll('.buffer-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.buffer-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cacheSize = parseInt(btn.dataset.cache);
      const maxPeers = parseInt(btn.dataset.peers);
      const label = btn.dataset.label;
      const tagText = cacheSize >= 3000000000 ? 'Ultra 4K' : (cacheSize >= 200000000 ? 'Instant Stream' : 'Standard');

      applyBufferSettings(cacheSize, maxPeers, 10, `${label} Cache`, tagText);
    });
  });

  // Sample Chips
  document.querySelectorAll('.sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const mag = chip.getAttribute('data-magnet');
      if (mag) {
        magnetInput.value = mag;
        playMagnetOrUrl(mag);
      }
    });
  });

  // Video Events
  ['play', 'playing', 'timeupdate', 'canplay', 'loadeddata'].forEach(evt => {
    videoPlayer.addEventListener(evt, () => {
      isPlaybackInitiated = true;
      hideLoading();
      playerPlaceholder.classList.add('hidden');
    });
  });

  videoPlayer.addEventListener('waiting', () => {
    // Only show loading if video has not started or is actively seeking
    if (typeof isPerformSeeking !== 'undefined' && isPerformSeeking) return;
    if (!isPlaybackInitiated) {
      showLoading('Buffering Stream...', 'Fetching data from TorrServer cache...');
    }
  });

  videoPlayer.addEventListener('ended', () => {
    isPerformSeeking = false;
    hideLoading();
  });

  videoPlayer.addEventListener('error', (e) => {
    if (!videoPlayer.src || videoPlayer.src === window.location.href) return;
    hideLoading();

    // If playback reached near EOF (last 10 seconds of probed duration), do not trigger recovery
    const currentActual = (window.currentSeekOffset || 0) + (videoPlayer.currentTime || 0);
    if (window.exactProbedDuration && window.exactProbedDuration > 0) {
      if (currentActual >= window.exactProbedDuration - 10) {
        isPerformSeeking = false;
        return;
      }
    }

    const err = videoPlayer.error;
    console.warn('[Video Player]', err ? `Media Error Code ${err.code}` : 'Playback error occurred');

    // Cascading Auto-Recovery: Direct -> Remux -> Transcode
    if (gstEngineMode === 'direct' && currentStreamInfo.hash) {
      if (directRetryCount < 2) {
        directRetryCount++;
        console.warn(`[Video Player] Buffering torrent piece headers. Retrying Direct Native Stream (${directRetryCount}/2)...`);
        showLoading('Buffering Header Pieces...', 'TorrServer downloading video metadata & header...');
        setTimeout(() => {
          if (gstEngineMode === 'direct' && currentStreamInfo.hash) {
            const directUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
            videoPlayer.src = directUrl;
            videoPlayer.load();
            videoPlayer.play().catch(() => { hideLoading(); });
          }
        }, 1200);
        return;
      }

      console.warn('[Video Player] Direct playback unsupported by browser. Auto-recovering via FFmpeg Live Remux...');
      gstEngineMode = 'remux';
      const engineLabelEl = document.getElementById('currentEngineLabel');
      if (engineLabelEl) engineLabelEl.textContent = 'FFmpeg (Live Remux)';

      showLoading('Auto-Recovering via FFmpeg...', 'Remuxing video/audio for browser compatibility...');
      const directUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
      loadStreamWithExactTimeline(`/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directUrl)}&mode=remux`);
    } else if (gstEngineMode === 'remux' && currentStreamInfo.hash) {
      console.warn('[Video Player] Remux playback failed. Auto-recovering via FFmpeg Transcode...');
      gstEngineMode = 'transcode';
      const engineLabelEl = document.getElementById('currentEngineLabel');
      if (engineLabelEl) engineLabelEl.textContent = 'FFmpeg (Live Transcode)';

      showLoading('Auto-Transcoding Stream...', 'Transcoding video via x264/AAC for full browser compatibility...');
      const directUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
      loadStreamWithExactTimeline(`/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directUrl)}&mode=transcode`);
    }
  });

  const ffmpegEngineBtn = document.getElementById('ffmpegEngineBtn');
  if (ffmpegEngineBtn) {
    if (ffmpegEngineBtn) ffmpegEngineBtn.addEventListener('click', () => {
      if (gstEngineMode === 'direct') {
        gstEngineMode = 'remux';
      } else if (gstEngineMode === 'remux') {
        gstEngineMode = 'transcode';
      } else {
        gstEngineMode = 'direct';
      }

      const labels = {
        direct: 'Direct Stream (Full Timeline)',
        remux: 'FFmpeg (Live Remux)',
        transcode: 'FFmpeg (Live Transcode)'
      };

      const engineLabelEl = document.getElementById('currentEngineLabel');
      if (engineLabelEl) engineLabelEl.textContent = labels[gstEngineMode];

      if (currentStreamInfo.hash && currentStreamInfo.fileId) {
        playTorrentFile(
          currentStreamInfo.hash,
          currentStreamInfo.fileId,
          currentStreamInfo.filePath,
          currentStreamInfo.title,
          currentStreamInfo.fileLength
        );
      }
    });
  }

  if (copyStreamUrlBtn) copyStreamUrlBtn.addEventListener('click', () => {
    if (videoPlayer.src) {
      navigator.clipboard.writeText(videoPlayer.src);
      const originalText = copyStreamUrlBtn.innerHTML;
      copyStreamUrlBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        copyStreamUrlBtn.innerHTML = originalText;
        if (window.lucide) lucide.createIcons();
      }, 2000);
    }
  });

  const downloadVideoBtn = document.getElementById('downloadVideoBtn');
  if (downloadVideoBtn) {
    downloadVideoBtn.addEventListener('click', () => {
      if (!currentStreamInfo || !currentStreamInfo.hash) {
        showToast('Please play a video torrent first before downloading.', 'info');
        return;
      }
      const fileIdx = (currentStreamInfo.fileId !== undefined && currentStreamInfo.fileId !== null) ? currentStreamInfo.fileId : 1;
      const rawTitle = currentStreamInfo.title || currentStreamInfo.filePath || 'torrent_video.mp4';
      let cleanFileName = getFileName(rawTitle);
      if (!/\.(mp4|mkv|avi|mov|webm)$/i.test(cleanFileName)) {
        cleanFileName += '.mp4';
      }
      const downloadUrl = `/api/torrent/download?hash=${encodeURIComponent(currentStreamInfo.hash)}&index=${fileIdx}&filename=${encodeURIComponent(cleanFileName)}`;
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch(e) {}
      }, 1000);
    });
  }

  if (refreshTorrentsBtn) refreshTorrentsBtn.addEventListener('click', loadActiveTorrentsList);
}

// Perform Movie & Series Search Query via Standalone REST API V1
async function performMovieSearch(query, mediaType = 'movie', season = '1', episode = '1') {
  const isTmdbId = /^\d+$/.test(query);
  const isImdbId = /^tt\d+$/.test(query);
  let searchUrl = `/api/v1/search?type=${mediaType}&s=${season}&e=${episode}`;

  if (isTmdbId) searchUrl += `&tmdb=${query}`;
  else if (isImdbId) searchUrl += `&imdb=${query}`;
  else searchUrl += `&q=${encodeURIComponent(query)}`;

  searchResultsArea.innerHTML = `
    <div class="search-initial-state">
      <div class="spinner"></div>
      <p>Searching ${mediaType === 'series' ? 'TV episode' : 'movie'} streams for "${query}"...</p>
    </div>`;

  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!res.ok) throw new Error('Search failed');

    if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();
    
    let results = data.results || data.streams || [];
    if (results.length === 0 && data.imdbId) {
        try {
            const torrentioType = data.mediaType === 'series' ? 'series' : 'movie';
            const streamPath = torrentioType === 'series' ? `${data.imdbId}:${data.season}:${data.episode}` : data.imdbId;
            const torUrl = `https://torrentio.strem.fun/stream/${torrentioType}/${streamPath}.json`;
            console.log('Fallback fetching from Torrentio API on client:', torUrl);
            const torRes = await fetch(torUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
            const torData = await torRes.json();
            if (torData && torData.streams) {
                results = torData.streams.map(s => {
                    const infoHash = s.infoHash;
                    let magnet = s.magnet;
                    if (!magnet && infoHash) {
                        magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(data.title)}`;
                        const DEFAULT_TRACKERS = [
                            'http://nyaa.tracker.wf:7777/announce',
                            'udp://tracker.opentrackr.org:1337/announce',
                            'udp://open.stealth.si:80/announce',
                            'udp://tracker.torrent.eu.org:451/announce',
                            'udp://exodus.desync.com:6969/announce',
                            'udp://tracker.dler.org:6969/announce',
                            'udp://open.demonii.com:1337/announce',
                            'udp://tracker.openbittorrent.com:6969/announce',
                            'udp://opentracker.i2p.rocks:6969/announce'
                        ];
                        DEFAULT_TRACKERS.forEach(tr => {
                            magnet += `&tr=${encodeURIComponent(tr)}`;
                        });
                    }
                    const rawTitle = s.title || s.name || data.title;
                    const seedMatch = rawTitle.match(/👤\s*(\d+)/);
                    const sizeMatch = rawTitle.match(/💾\s*([\d\.]+\s*[GMK]B)/i);
                    const qualityMatch = rawTitle.match(/(2160p|4K|1080p|720p|HDR|Remux|CAM|TS)/i);
                    return {
                        name: s.name || 'Torrent Stream',
                        title: `${data.title} (${qualityMatch ? qualityMatch[1] : '1080p'})`,
                        raw_title: rawTitle,
                        magnet: magnet,
                        infoHash: infoHash,
                        seeders: seedMatch ? parseInt(seedMatch[1]) : 0,
                        size: sizeMatch ? sizeMatch[1] : 'Unknown',
                        quality: qualityMatch ? qualityMatch[1] : 'HD'
                    };
                });
                results.sort((a, b) => getStreamPriorityScore(b, (data.mediaType || 'movie') === 'movie') - getStreamPriorityScore(a, (data.mediaType || 'movie') === 'movie'));
                data.results = results;
            }
        } catch (e) {
            console.error('Fallback torrentio error:', e);
        }
    }

    renderSearchResults(results);
  } catch (err) {
    console.error('Search query error:', err);
    searchResultsArea.innerHTML = `
      <div class="search-initial-state">
        <i data-lucide="alert-circle"></i>
        <p>Could not perform search. Try again.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
}

// Render Movie & Series Search Cards
function renderSearchResults(results) {
  if (results.length === 0) {
    searchResultsArea.innerHTML = `
      <div class="search-initial-state">
        <i data-lucide="film"></i>
        <p>No torrent results found for that query.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  searchResultsArea.innerHTML = '';
  results.forEach(m => {
    let bytes = m.sizeBytes || parseSizeBytes(m.size) || parseSizeBytes(m.raw_title);
    let sizeInGB = bytes / (1024 * 1024 * 1024);
    let isOptimalSize = (sizeInGB >= 1.45 && sizeInGB <= 2.55);
    let isOverSize = (sizeInGB > 2.55);

    let sizeBadgeHtml = `<span class="meta-badge badge-size">💾 ${m.size || '1 GB'}</span>`;
    if (isOptimalSize) {
      sizeBadgeHtml = `<span class="meta-badge badge-size" style="background: rgba(34, 197, 94, 0.25); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); font-weight: 700;">⭐ Optimal Size: ${m.size}</span>`;
    } else if (isOverSize) {
      sizeBadgeHtml = `<span class="meta-badge badge-size" style="opacity: 0.7;">💾 ${m.size} (Large)</span>`;
    }

    const card = document.createElement('div');
    card.className = 'movie-result-card';
    card.innerHTML = `
      <div class="result-content">
        <div class="result-title">🎬 ${m.title} ${m.year ? `(${m.year})` : ''}</div>
        <div class="result-meta">
          <span class="meta-badge badge-quality">${m.quality || '1080p'}</span>
          ${m.name ? `<span class="meta-badge" style="background: ${m.name === 'Nyaa' ? 'rgba(236, 72, 153, 0.25)' : 'rgba(99, 102, 241, 0.25)'}; color: ${m.name === 'Nyaa' ? '#f472b6' : '#818cf8'}; border: 1px solid ${m.name === 'Nyaa' ? 'rgba(244, 114, 182, 0.4)' : 'rgba(129, 140, 248, 0.4)'}; font-weight: 700;">${m.name === 'Nyaa' ? '🌸 Nyaa.si' : m.name}</span>` : ''}
          ${sizeBadgeHtml}
          <span class="meta-badge badge-seeds">👥 ${m.seeds || m.seeders || 100} Seeders</span>
        </div>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary btn-sm play-result-btn">
          <i data-lucide="play"></i> Stream Now
        </button>
      </div>
    `;

    card.querySelector('.play-result-btn').addEventListener('click', () => {
      searchModal.classList.add('hidden');
      magnetInput.value = m.magnet;
      playMagnetOrUrl(m.magnet);
    });

    searchResultsArea.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

// Apply Instant Stream Settings to TorrServer Engine API
async function applyBufferSettings(cacheSizeBytes, maxPeers, preloadPercent = 10, badgeText, tagText) {
  try {
    const res = await fetch(`${TORRSERVER_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set',
        sets: {
          CacheSize: cacheSizeBytes,
          ConnectionsLimit: maxPeers,
          PreloadCache: preloadPercent,
          ReaderReadAHead: 30,
          ResponsiveMode: true,
          RetrackersMode: 1,
          RemoveCacheOnDrop: true,
          TorrentDisconnectTimeout: 30
        }
      })
    });

    if (res.ok) {
      if (bufferPresetText) bufferPresetText.textContent = badgeText;
      if (presetTag) presetTag.textContent = tagText;
      console.log(`[TorrServer Engine] Instant Stream + Auto Cache Removal Applied: Cache=${cacheSizeBytes}, Preload=${preloadPercent}%, RemoveCacheOnDrop=true`);
    }
  } catch (err) {
    console.warn('Could not update engine settings:', err);
  }
}

// Check TorrServer API Connectivity
async function checkServerConnection() {
  try {
    const res = await fetch(`${TORRSERVER_BASE}/echo`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const text = await res.text();
      let ver = text.trim();
      if (ver.startsWith('<') || ver.includes('<!doctype') || ver.includes('<html')) {
        setServerStatus(false, 'Offline (Starting Up)');
        return false;
      }
      setServerStatus(true, `Online (${ver || 'TorrServer'})`);
      return true;
    }
  } catch (err) {
    try {
      const res = await fetch(`${TORRSERVER_BASE}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          setServerStatus(true, 'Online (TorrServer)');
          return true;
        }
      }
    } catch (e) {}
  }
  setServerStatus(false, 'Offline (Port 3000)');
  return false;
}

function setServerStatus(isOnline, text) {
  serverStatusPill.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
  serverStatusText.textContent = text;
}

// Main Function: Play Magnet Link or Stream URL
async function playMagnetOrUrl(input) {
  if (metadataPollTimer) clearTimeout(metadataPollTimer);
  if (statsPollInterval) clearInterval(statsPollInterval);

  if (!input.startsWith('magnet:?') && !input.startsWith('http://') && !input.startsWith('https://')) {
    searchModal.classList.remove('hidden');
    modalSearchInput.value = input;
    performMovieSearch(input);
    return;
  }

  showLoading('Connecting to BitTorrent Peers...', 'Adding magnet link to TorrServer engine...');

  try {
    const addRes = await fetch(`${TORRSERVER_BASE}/torrents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        link: input,
        save_to_db: true
      })
    });

    const resText = await addRes.text();
    let torrData;
    try {
      torrData = JSON.parse(resText);
    } catch (e) {
      throw new Error('TorrServer is starting up or unavailable. Please try again in a few seconds.');
    }

    if (!addRes.ok || torrData.status === 'error') {
      throw new Error(torrData.message || `Failed to add magnet: HTTP ${addRes.status}`);
    }

    currentTorrentData = torrData;
    activeTorrentHash = torrData.hash;

    await pollTorrentMetadata(torrData.hash, 0);

  } catch (err) {
    console.error('Error adding magnet:', err);
    hideLoading();
    showToast(`Could not stream magnet link: ${err.message}`, 'error');
  }
}

// Poll TorrServer until torrent metadata is loaded
async function pollTorrentMetadata(hash, attempts = 0) {
  const maxAttempts = 40;

  try {
    const res = await fetch(`${TORRSERVER_BASE}/torrents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', hash: hash })
    });

    const resText = await res.text();
    let data;
    try {
      data = JSON.parse(resText);
    } catch (e) {
      throw new Error('TorrServer service starting up');
    }

    if (!res.ok) throw new Error(data.message || 'Could not fetch torrent info');
    currentTorrentData = data;

    const fileStats = data.file_stats || data.FileStats || [];
    
    const peers = data.active_peers || data.connected_seeders || 0;
    const statText = data.stat_string ? ` (${data.stat_string})` : '';
    showLoading(
      'Fetching Torrent Metadata...',
      `Connected to ${peers} peers${statText}. Resolving file contents...`
    );

    if (fileStats.length > 0) {
      renderFileList(fileStats);

      const videoFiles = fileStats.filter(f => isVideoFile(f.path));
      let targetFile = null;

      // Prefer MKV/MP4 files over legacy AVI files for native browser playback
      const mkvMp4Files = videoFiles.filter(f => !f.path.toLowerCase().endsWith('.avi'));
      if (mkvMp4Files.length > 0) {
        targetFile = mkvMp4Files.reduce((prev, current) => (prev.length > current.length) ? prev : current);
      } else if (videoFiles.length > 0) {
        targetFile = videoFiles.reduce((prev, current) => (prev.length > current.length) ? prev : current);
      } else {
        targetFile = fileStats.reduce((prev, current) => (prev.length > current.length) ? prev : current);
      }

      if (targetFile) {
        playTorrentFile(hash, targetFile.id, targetFile.path, data.title || targetFile.path, targetFile.length);
      } else {
        hideLoading();
        showToast('No printable files found inside this torrent.', 'warning');
      }

      loadActiveTorrentsList();
      return;
    }

    if (attempts < maxAttempts) {
      metadataPollTimer = setTimeout(() => {
        pollTorrentMetadata(hash, attempts + 1);
      }, 800);
    } else {
      console.warn('Metadata timeout, attempting direct stream index 1 fallback...');
      playTorrentFile(hash, 1, data.title || 'Torrent Stream', data.title || 'Torrent Stream', 0);
    }

  } catch (err) {
    console.error('Torrent metadata poll error:', err);
    if (attempts < maxAttempts) {
      metadataPollTimer = setTimeout(() => {
        pollTorrentMetadata(hash, attempts + 1);
      }, 800);
    } else {
      hideLoading();
      showToast('Timed out waiting for torrent metadata. Ensure the torrent has active seeders.', 'error');
    }
  }
}

window.exactProbedDuration = 0;
let plyrInstance = null;

function initPlyrPlayer() {
  if (window.Plyr && videoPlayer && !window.plyrInstance) {
    try {
      window.plyrInstance = new Plyr(videoPlayer, {
        controls: [
          'play-large', 'restart', 'rewind', 'play', 'fast-forward',
          'progress', 'current-time', 'duration', 'mute', 'volume',
          'settings', 'pip', 'airplay', 'download', 'fullscreen'
        ],
        invertTime: false,
        toggleInvert: false
      });
      window.plyrPlayer = window.plyrInstance;

      window.plyrInstance.on('timeupdate', enforceExactDuration);
      // Remove the direct 'seeking' override from plyr instance to prevent timeline vibration and jumping back to 0
      // We will handle seeking entirely via our custom pointerdown interceptor and native proxy
      window.plyrInstance.on('seeked', enforceExactDuration);
    } catch(e) {
      console.warn("Plyr initialization fallback", e);
    }
  }
  attachSeekingHandler();
}
window.initPlyrPlayer = initPlyrPlayer;

let _lastDefinedDur = 0;
function enforceExactDuration() {
  if (!window.exactProbedDuration || window.exactProbedDuration <= 0) return;

  if (_lastDefinedDur === window.exactProbedDuration && videoPlayer && videoPlayer._durOverridden) return;
  _lastDefinedDur = window.exactProbedDuration;

  const getExactDur = () => window.exactProbedDuration;
  const getExactCurrent = () => {
    const nativeVal = (window._nativeCurrentTimeDesc && videoPlayer) ? (window._nativeCurrentTimeDesc.get.call(videoPlayer) || 0) : 0;
    return Math.min(window.exactProbedDuration, Math.max(0, (window.currentSeekOffset || 0) + nativeVal));
  };

  if (videoPlayer) {
    try {
      Object.defineProperty(videoPlayer, 'duration', {
        get: getExactDur,
        configurable: true
      });
      videoPlayer._durOverridden = true;
    } catch(e) {}
  }

  if (window.plyrInstance) {
    try {
      Object.defineProperty(window.plyrInstance, 'duration', {
        get: getExactDur,
        configurable: true
      });
      Object.defineProperty(window.plyrInstance, 'currentTime', {
        get: getExactCurrent,
        configurable: true
      });
    } catch(e) {}
    if (window.plyrInstance.media) {
      try {
        Object.defineProperty(window.plyrInstance.media, 'duration', {
          get: getExactDur,
          configurable: true
        });
        Object.defineProperty(window.plyrInstance.media, 'currentTime', {
          get: getExactCurrent,
          configurable: true
        });
      } catch(e) {}
    }
  }
}
window.enforceExactDuration = enforceExactDuration;

if (videoPlayer) {
  ['loadedmetadata', 'durationchange', 'timeupdate', 'playing', 'progress', 'canplay'].forEach(evt => {
    videoPlayer.addEventListener(evt, enforceExactDuration);
  });
  videoPlayer.addEventListener('error', () => {
    console.warn('[Torrent Stream Error] Native playback failed or codec unsupported.');
    if (currentStreamInfo && currentStreamInfo.hash && directRetryCount < 2) {
        directRetryCount++;
        const mode = directRetryCount === 1 ? 'remux' : 'transcode';
        console.log(`[Torrent Stream Recovery] Auto-switching to FFmpeg (${mode})...`);
        const directStreamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
        const activeUrl = `/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directStreamUrl)}&mode=${mode}`;
        loadStreamWithExactTimeline(activeUrl);
    }
  });
}

// ==========================================
// ============================================================================
// FIX MODULE: GETDURATION & SEEKING FOR TORRENT STREAMS
// ============================================================================
let isPerformSeeking = false;
let isSeekingAttached = false;
let seekDebounceTimer = null;
let isUserScrubbing = false;

function formatTime(seconds) {
  const totalSecs = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = (totalSecs % 60).toString().padStart(2, '0');
  return hours > 0 
    ? `${hours}:${mins.toString().padStart(2, '0')}:${secs}` 
    : `${mins.toString().padStart(2, '0')}:${secs}`;
}

function handleSeekRequest(targetSecs) {
  if (!currentStreamInfo || !currentStreamInfo.hash) return;
  
  if (seekDebounceTimer) {
    clearTimeout(seekDebounceTimer);
  }

  seekDebounceTimer = setTimeout(() => {
    _executeSeek(targetSecs);
  }, 120);
}

function _executeSeek(targetSecs) {
  if (!currentStreamInfo || !currentStreamInfo.hash) return;
  targetSecs = Math.max(0, Math.floor(targetSecs));

  if (window.exactProbedDuration && window.exactProbedDuration > 0) {
    const maxAllowed = Math.max(0, Math.floor(window.exactProbedDuration) - 5);
    targetSecs = Math.min(targetSecs, maxAllowed);
  }

  // Avoid duplicate seeking if within 2 seconds of current offset
  const nativeCurrent = (window._nativeCurrentTimeDesc && videoPlayer) ? (window._nativeCurrentTimeDesc.get.call(videoPlayer) || 0) : 0;
  const currentActual = Math.floor((window.currentSeekOffset || 0) + nativeCurrent);

  if (Math.abs(currentActual - targetSecs) < 2) return;

  console.log(`[Torrent Player] Seeking timeline directly to: ${targetSecs}s (${formatTime(targetSecs)})`);
  isPerformSeeking = true;
  window.currentSeekOffset = targetSecs;

  const bufFill = document.getElementById('bufferProgressFill');
  if (bufFill) bufFill.style.width = '0%';

  const directStreamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
  let modeToUse = gstEngineMode === 'direct' ? 'remux' : gstEngineMode;
  let seekUrl = `/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directStreamUrl)}&mode=${modeToUse}&startTime=${targetSecs}`;
  if (currentAudioTrackIndex !== '') {
    seekUrl += `&audioTrack=${currentAudioTrackIndex}`;
  }

  showLoading(`Seeking to ${formatTime(targetSecs)}...`, 'Loading stream segment...');

  if (videoPlayer) {
    try { videoPlayer.pause(); } catch(e) {}
    if (window.plyrInstance) {
      try {
        window.plyrInstance.source = {
          type: 'video',
          sources: [{ src: seekUrl }]
        };
      } catch(err) {
        videoPlayer.src = seekUrl;
        try { videoPlayer.load(); } catch(err2) {}
      }
    } else {
      videoPlayer.src = seekUrl;
      try { videoPlayer.load(); } catch(err2) {}
    }

    let playTriggered = false;
    const startPlay = () => {
      if (playTriggered) return;
      playTriggered = true;
      const p = window.plyrInstance ? window.plyrInstance.play() : videoPlayer.play();
      if (p && p.then) {
        p.then(() => {
          hideLoading();
          setTimeout(() => { isPerformSeeking = false; isUserScrubbing = false; }, 400);
        }).catch((err) => {
          console.warn('Play error during seek:', err);
          hideLoading();
          setTimeout(() => { isPerformSeeking = false; isUserScrubbing = false; }, 400);
        });
      } else {
        hideLoading();
        setTimeout(() => { isPerformSeeking = false; isUserScrubbing = false; }, 400);
      }
    };

    videoPlayer.addEventListener('canplay', startPlay, { once: true });
    videoPlayer.addEventListener('loadeddata', startPlay, { once: true });

    // Fallback safety timeout if events take long
    setTimeout(() => {
      if (!playTriggered && isPerformSeeking) {
        startPlay();
      }
    }, 2000);
  }
}

function getClickRatio(e, element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect || rect.width <= 0) return null;
  let clientX = e.clientX;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
  }
  if (clientX === undefined) return null;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

function attachSeekingHandler() {
  if (!videoPlayer || isSeekingAttached) return;
  isSeekingAttached = true;

  if (!window._nativeCurrentTimeDesc) {
    window._nativeCurrentTimeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        get: function() {
          try {
            const nativeVal = window._nativeCurrentTimeDesc.get.call(this) || 0;
            return (window.currentSeekOffset || 0) + nativeVal;
          } catch(e) {
            return window.currentSeekOffset || 0;
          }
        },
        set: function(val) {
          if (isPerformSeeking || isUserScrubbing || !this.readyState || this.readyState < 1) {
            return;
          }
          if (val < 3 && (window.currentSeekOffset || 0) > 10) return;

          const nativeCurrent = (window._nativeCurrentTimeDesc && window._nativeCurrentTimeDesc.get) ? (window._nativeCurrentTimeDesc.get.call(this) || 0) : 0;
          const actualCurrent = (window.currentSeekOffset || 0) + nativeCurrent;
          if (Math.abs(actualCurrent - val) > 3) {
            handleSeekRequest(val);
          }
        },
        configurable: true
      });
    } catch(e) {}
  }

  if (!window._nativeDurationDesc) {
    window._nativeDurationDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration');
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        get: function() {
          if (window.exactProbedDuration && window.exactProbedDuration > 0) {
            return window.exactProbedDuration;
          }
          try {
            return window._nativeDurationDesc.get.call(this) || 0;
          } catch(e) {
            return 0;
          }
        },
        configurable: true
      });
    } catch(e) {}
  }

  // Direct screen click/touch interceptor on Plyr progress bar
  document.addEventListener('pointerdown', (e) => {
    const progressEl = e.target.closest('.plyr__progress');
    if (progressEl && window.exactProbedDuration > 0) {
      isUserScrubbing = true;
      const ratio = getClickRatio(e, progressEl);
      if (ratio !== null) {
        const targetSecs = Math.floor(ratio * window.exactProbedDuration);
        console.log(`[Plyr Touch Seek] Clicked progress bar at ${(ratio*100).toFixed(1)}% -> ${targetSecs}s (${formatTime(targetSecs)})`);
        e.stopPropagation();
        handleSeekRequest(targetSecs);
      }
    }
  }, true);

  document.addEventListener('pointerup', () => {
    setTimeout(() => { isUserScrubbing = false; }, 300);
  });

  // Range input listener for keyboard arrow navigation
  document.addEventListener('change', (e) => {
    if (e.target && e.target.matches('.plyr__progress input[type="range"]')) {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        handleSeekRequest(val);
      }
    }
  }, true);
}

setInterval(() => {
  if (window.exactProbedDuration && window.exactProbedDuration > 0 && !isPerformSeeking && !isUserScrubbing) {
    enforceExactDuration();
    const totalSecs = Math.floor(window.exactProbedDuration);
    const nativeCurrent = (window._nativeCurrentTimeDesc && videoPlayer) ? (window._nativeCurrentTimeDesc.get.call(videoPlayer) || 0) : (videoPlayer ? videoPlayer.currentTime : 0);
    const currentActualSecs = Math.min(totalSecs, Math.floor((window.currentSeekOffset || 0) + nativeCurrent));

    const timeDisplays = document.querySelectorAll('.plyr__time--duration');
    timeDisplays.forEach(el => {
      el.textContent = formatTime(totalSecs);
    });

    const currentTimeDisplays = document.querySelectorAll('.plyr__time--current');
    currentTimeDisplays.forEach(el => {
      el.textContent = formatTime(currentActualSecs);
    });

    const percent = totalSecs > 0 ? (currentActualSecs / totalSecs) * 100 : 0;

    const inputs = document.querySelectorAll('.plyr__progress input[type="range"]');
    inputs.forEach(input => {
       input.max = totalSecs;
       input.setAttribute('aria-valuemax', totalSecs.toString());
       if (document.activeElement !== input) {
           input.value = currentActualSecs;
           input.style.setProperty('--value', percent.toFixed(2) + '%');
       }
    });

    const progressBars = document.querySelectorAll('.plyr__progress progress');
    progressBars.forEach(progress => {
       progress.max = totalSecs;
       progress.value = currentActualSecs;
    });

    if (window.plyrInstance && window.plyrInstance.elements && window.plyrInstance.elements.display) {
       if (window.plyrInstance.elements.display.currentTime) {
         window.plyrInstance.elements.display.currentTime.textContent = formatTime(currentActualSecs);
       }
       if (window.plyrInstance.elements.display.duration) {
         window.plyrInstance.elements.display.duration.textContent = formatTime(totalSecs);
       }
    }
  }
}, 250);

document.addEventListener('DOMContentLoaded', initPlyrPlayer);

// Load FFmpeg Stream with Exact Probed Duration Timeline
async function loadStreamWithExactTimeline(ffmpegStreamUrl) {
  initPlyrPlayer();
  window.exactProbedDuration = 0;
  window.currentSeekOffset = 0;

  if (videoPlayer) {
    videoPlayer.src = ffmpegStreamUrl;
    videoPlayer.load();
    enforceExactDuration();
    
    const promise = window.plyrInstance ? window.plyrInstance.play() : videoPlayer.play();
    if (promise && promise.catch) {
      promise.catch(err => {
        console.warn('[Autoplay/Source] Play promise rejected:', err);
        if (err.name === 'NotSupportedError' && gstEngineMode === 'remux') {
            console.warn('[Fallback] Remux not supported by browser, falling back to transcode...');
            gstEngineMode = 'transcode';
            const engineLabelEl = document.getElementById('currentEngineLabel');
            if (engineLabelEl) engineLabelEl.textContent = 'FFmpeg (Live Transcode)';
            showLoading('Auto-Transcoding Stream...', 'Transcoding video via x264/AAC for full browser compatibility...');
            const directUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
            loadStreamWithExactTimeline(`/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directUrl)}&mode=transcode`);
            return;
        }
        videoPlayer.muted = true;
        const mutedPromise = window.plyrInstance ? window.plyrInstance.play() : videoPlayer.play();
        if (mutedPromise && mutedPromise.catch) {
          mutedPromise.catch(() => { hideLoading(); });
        }
      });
    }
  }

  // Probe duration asynchronously with retry polling until prebuffered headers resolve
  (async () => {
    if (!currentStreamInfo || !currentStreamInfo.hash) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const directStreamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
        const durRes = await fetch(`/api/torrent/duration?url=${encodeURIComponent(directStreamUrl)}`);
        const durData = await durRes.json();
        if (durData.duration && durData.duration > 0) {
          window.exactProbedDuration = durData.duration;
          console.log(`[Torrent Stream] Exact probed duration via API: ${durData.duration}s (${formatTime(durData.duration)})`);
          enforceExactDuration();
          break;
        }
      } catch(e) {
        console.warn("[FFmpeg Stream] Duration probe attempt failed", e);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  })();
}
window.loadStreamWithExactTimeline = loadStreamWithExactTimeline;

// Play specific file inside torrent
function playTorrentFile(hash, fileId, filePath, title, fileLength) {
  activeTorrentHash = hash;
  activeFileIndex = fileId;
  currentStreamInfo = { hash, fileId, filePath, title, fileLength };
  directRetryCount = 0;
  window.currentSeekOffset = 0;

  const fileName = (filePath || title || '').toLowerCase();
  const ext = fileName.split('.').pop();
  const isNonNativeFormat = ['avi', 'flv', 'wmv', 'vob', 'divx', 'xvid', 'ts', 'm2ts', 'mkv', 'm2t', 'ogv'].includes(ext);
  const isHevcOr10Bit = /(x265|h265|hevc|10bit|hdr|dovi|dv)/i.test(fileName);

  const directStreamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(hash)}&index=${fileId}&play=1`;

  let modeToUse = gstEngineMode;
  if (isHevcOr10Bit) {
    modeToUse = 'transcode';
  } else if (isNonNativeFormat || modeToUse === 'direct') {
    // MKV containers & non-MP4 torrent formats require remuxing for browser HTML5 video playback
    modeToUse = 'remux';
  }

  let activeEngineLabel = 'FFmpeg (Live Remux)';
  let activeUrl = directStreamUrl;

  if (modeToUse === 'transcode') {
    activeUrl = `/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directStreamUrl)}&mode=transcode`;
    activeEngineLabel = isHevcOr10Bit ? 'FFmpeg (Auto x264 Transcode for HEVC/x265)' : 'FFmpeg (Live Transcode)';
  } else {
    activeUrl = `/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directStreamUrl)}&mode=remux`;
    activeEngineLabel = 'FFmpeg (Live Remux)';
  }

  const engineLabelEl = document.getElementById('currentEngineLabel');
  if (engineLabelEl) engineLabelEl.textContent = activeEngineLabel;

  currentTitle.textContent = getFileName(title || filePath || 'Torrent Video Stream');
  currentHash.textContent = `Hash: ${hash.substring(0, 10)}...`;
  currentSize.textContent = fileLength ? `Size: ${formatBytes(fileLength)}` : 'Size: Dynamic';

  highlightActiveFile(fileId);

  playerPlaceholder.classList.add('hidden');
  const playerSection = document.getElementById('playerSection') || document.querySelector('.player-section');
  if (playerSection) {
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Pre-set estimated duration from file size if available so duration display is active immediately
  if (fileLength && fileLength > 0) {
    const estSecs = Math.round(fileLength / 280000);
    if (estSecs > 60) {
      window.exactProbedDuration = estSecs;
      enforceExactDuration();
    }
  }

  showLoading('Instant Stream Starting...', `Streaming via ${activeEngineLabel}...`);
  loadStreamWithExactTimeline(activeUrl);

  startStatsPolling(hash);
  checkAndApplyTorrentSubtitles(hash);
}

// Function to check and auto-load SRT subtitle files from the torrent package
async function checkAndApplyTorrentSubtitles(hash) {
  if (!hash) return;
  try {
    const res = await fetch(`/api/torrent/check-subtitles?link=${encodeURIComponent(hash)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.subtitles && data.subtitles.length > 0) {
      const firstSub = data.subtitles[0];
      console.log(`[Torrent Subtitle] Auto-applying SRT subtitle from torrent: ${firstSub.name}`);
      applySubtitleTrack(firstSub.url, `[Torrent] ${firstSub.name}`);
    }
  } catch (e) {
    console.warn('[Torrent Subtitle Check Failed]', e);
  }
}

function startDirectVideo(url, title) {
  currentTitle.textContent = title;
  currentHash.textContent = 'Hash: Direct URL';
  currentSize.textContent = 'Size: Dynamic';
  
  playerPlaceholder.classList.add('hidden');
  videoPlayer.src = url;
  videoPlayer.load();
  videoPlayer.play();
}

// Live TorrServer Statistics Poller
function startStatsPolling(hash) {
  if (statsPollInterval) clearInterval(statsPollInterval);

  statsPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${TORRSERVER_BASE}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', hash: hash })
      });

      if (res.ok) {
        if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();
        
        const speed = formatBytes(data.download_speed || 0) + '/s';
        const peers = `${data.connected_seeders || 0} / ${data.active_peers || 0}`;
        const buffer = data.prebuffer_bytes && data.preload_size
          ? Math.min(100, Math.round((data.prebuffer_bytes / data.preload_size) * 100))
          : (data.stat_string || 'Ready');

        statSpeed.textContent = speed;
        statPeers.textContent = `${peers} Peers`;
        statBuffer.textContent = typeof buffer === 'number' ? `Buffer ${buffer}%` : buffer;

        const loadingStats = document.getElementById('loadingStats');
        if (loadingStats && loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
          loadingStats.textContent = `Speed: ${speed} | Peers: ${peers} | Status: ${typeof buffer === 'number' ? `Buffer ${buffer}%` : buffer}`;
        }
        if (typeof buffer === 'number' && bufferProgressFill) {
          bufferProgressFill.style.width = `${buffer}%`;
        }
      }
    } catch (e) {
      console.warn('Stats poll fail:', e);
    }
  }, 1500);
}

// File List & Tree Renderer
function renderFileList(fileStats) {
  filesCountBadge.textContent = `${fileStats.length} files`;
  
  if (fileStats.length === 0) {
    filesListContainer.innerHTML = `
      <div class="panel-empty-state">
        <i data-lucide="file-video"></i>
        <p>No files found in torrent metadata</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  filesListContainer.innerHTML = '';
  fileStats.forEach(file => {
    const isVideo = isVideoFile(file.path);
    const isAvi = file.path.toLowerCase().endsWith('.avi');

    const item = document.createElement('div');
    item.className = `file-item ${file.id === activeFileIndex ? 'active' : ''}`;
    item.dataset.fileId = file.id;

    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-name';
    fileNameSpan.title = file.path;
    fileNameSpan.textContent = (isAvi ? '⚠️ ' : (isVideo ? '🎬 ' : '📄 ')) + getFileName(file.path);

    const fileSizeSpan = document.createElement('span');
    fileSizeSpan.className = 'file-size';
    fileSizeSpan.textContent = formatBytes(file.length);

    item.appendChild(fileNameSpan);
    item.appendChild(fileSizeSpan);

    item.addEventListener('click', () => {
      playTorrentFile(activeTorrentHash, file.id, file.path, getFileName(file.path), file.length);
    });

    filesListContainer.appendChild(item);
  });
}

function highlightActiveFile(fileId) {
  document.querySelectorAll('.file-item').forEach(el => {
    if (parseInt(el.dataset.fileId) === fileId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// Active Torrents List in Sidebar
async function loadActiveTorrentsList() {
  try {
    const res = await fetch(`${TORRSERVER_BASE}/torrents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' })
    });

    if (!res.ok) return;
    const torrents = await res.json();
    
    if (!torrents || torrents.length === 0) {
      activeTorrentsList.innerHTML = `
        <div class="panel-empty-state">
          <p>No active torrents in TorrServer memory</p>
        </div>`;
      return;
    }

    activeTorrentsList.innerHTML = '';
    torrents.forEach(t => {
      const card = document.createElement('div');
      card.className = 'torrent-item';
      card.innerHTML = `
        <div class="torrent-title" title="${t.title || t.hash}">${t.title || 'Torrent ' + t.hash.substring(0, 8)}</div>
        <div class="torrent-stats">
          <span>⚡ ${formatBytes(t.download_speed || 0)}/s</span>
          <span>👥 ${t.active_peers || 0} peers</span>
        </div>
      `;
      card.addEventListener('click', () => {
        pollTorrentMetadata(t.hash, 0);
      });
      activeTorrentsList.appendChild(card);
    });
  } catch (e) {
    console.warn('Load active torrents failed:', e);
  }
}

// Loading Helpers
let bufferTimeoutTimer = null;
function showLoading(title, subtitle) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingTitle = document.getElementById('loadingTitle');
  const loadingSubtitle = document.getElementById('loadingSubtitle');
  const loadingStats = document.getElementById('loadingStats');
  const bufferProgressFill = document.getElementById('bufferProgressFill');

  if (title && loadingTitle) loadingTitle.textContent = title;
  if (subtitle && loadingSubtitle) loadingSubtitle.textContent = subtitle;
  if (loadingStats) loadingStats.textContent = '';
  if (bufferProgressFill) bufferProgressFill.style.width = '20%';
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

if (loadingOverlay) {
  if (loadingOverlay) loadingOverlay.addEventListener('click', hideLoading);
}

function parseMediaMetadata(raw) {
  if (!raw) return { title: '', cleanTitle: '', season: '', episode: '', year: '' };
  let str = String(raw).replace(/\.(mp4|mkv|avi|webm|ts|mov|m4v|flv)$/i, '');
  
  // Check for S01E01 or 1x01 or Season 1 Episode 1
  let season = '';
  let episode = '';
  const seMatch = str.match(/s(\d{1,2})[\s._-]*e(\d{1,2})/i) || str.match(/(\d{1,2})x(\d{1,2})/i);
  if (seMatch) {
    season = String(parseInt(seMatch[1], 10));
    episode = String(parseInt(seMatch[2], 10));
  }

  // Check for Year
  let year = '';
  const yearMatch = str.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Clean title: remove everything starting from S01E01, year, quality, codec tags
  let clean = str
    .replace(/s\d{1,2}[\s._-]*e\d{1,2}.*$/i, '')
    .replace(/\b(19\d\d|20\d\d)\b.*$/i, '')
    .replace(/(1080p|720p|2160p|4k|hdr|web-?dl|bluray|hdrip|x264|x265|hevc|aac|dts|cakes|eztv|yts|yify|rarbg|ettv|galaxyrg|tgx|vostfr|multi).*$/gi, '')
    .replace(/[\.\[\]\(\)\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) {
    clean = str.replace(/[\.\[\]\(\)\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    raw,
    cleanTitle: clean,
    title: clean,
    season,
    episode,
    year
  };
}

// Utilities
function isVideoFile(path) {
  if (!path) return false;
  const ext = path.split('.').pop().toLowerCase();
  return ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v', 'ts', 'flv', 'wmv', 'mpg', 'mpeg', 'm2ts', '3gp', 'vob', 'divx', 'ogv', 'mp3', 'aac', 'flac', 'm4a'].includes(ext);
}

function getFileName(path) {
  if (!path) return 'File';
  return path.split(/[\/\\]/).pop();
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Subtitles Modal Handlers
const subtitleModal = document.getElementById('subtitleModal');
const subtitlesBtn = document.getElementById('subtitlesBtn');
const closeSubtitleBtn = document.getElementById('closeSubtitleBtn');
const btnFetchSubs = document.getElementById('btnFetchSubs');
const subSearchQuery = document.getElementById('subSearchQuery');
const subLangSelect = document.getElementById('subLangSelect');
const subResultsList = document.getElementById('subResultsList');
const subFileInput = document.getElementById('subFileInput');

if (subtitlesBtn) {
  subtitlesBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch(e) {}
    }
    if (window.plyrPlayer && window.plyrPlayer.fullscreen && window.plyrPlayer.fullscreen.active) {
      try { window.plyrPlayer.fullscreen.exit(); } catch(e) {}
    }
    const modal = document.getElementById('subtitleModal');
    if (modal) modal.classList.remove('hidden');
    if (currentStreamInfo && currentStreamInfo.title) {
      const fileName = getFileName(currentStreamInfo.title);
      const parsed = parseMediaMetadata(fileName);
      if (subSearchQuery) {
        subSearchQuery.value = parsed.cleanTitle || fileName;
      }
      fetchSubtitlesOnline();
    } else {
      fetchSubtitlesOnline();
    }
  });
}

let activeSubtitleProvider = 'all';
let currentLoadedSubtitle = null;

const subProviderTabs = document.querySelectorAll('.sub-tab');
const activeSubStatusBanner = document.getElementById('activeSubStatusBanner');
const activeSubLabel = document.getElementById('activeSubLabel');
const btnRemoveSubtitle = document.getElementById('btnRemoveSubtitle');

if (subProviderTabs) {
  subProviderTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subProviderTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeSubtitleProvider = tab.getAttribute('data-provider') || 'all';
      fetchSubtitlesOnline();
    });
  });
}

if (subSearchQuery) {
  if (subSearchQuery) subSearchQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchSubtitlesOnline();
    }
  });
}

if (subLangSelect) {
  if (subLangSelect) subLangSelect.addEventListener('change', () => {
    fetchSubtitlesOnline();
  });
}

if (btnRemoveSubtitle) {
  if (btnRemoveSubtitle) btnRemoveSubtitle.addEventListener('click', () => {
    removeSubtitleTrack();
  });
}

if (closeSubtitleBtn) {
  if (closeSubtitleBtn) closeSubtitleBtn.addEventListener('click', () => {
    subtitleModal.classList.add('hidden');
  });
}

if (btnFetchSubs) {
  if (btnFetchSubs) btnFetchSubs.addEventListener('click', fetchSubtitlesOnline);
}

async function fetchSubtitlesOnline() {
  const subResultsList = document.getElementById('subResultsList');
  const subSearchQuery = document.getElementById('subSearchQuery');
  const subLangSelect = document.getElementById('subLangSelect');
  const subtitleModal = document.getElementById('subtitleModal');

  if (!subResultsList) return;

  let q = subSearchQuery ? subSearchQuery.value.trim() : '';
  const lang = subLangSelect ? subLangSelect.value : 'all';
  const rawTitle = currentStreamInfo?.title ? getFileName(currentStreamInfo.title) : (q || '');
  const parsed = parseMediaMetadata(rawTitle || q);

  if (!q) {
    if (typeof activeMediaData !== 'undefined' && activeMediaData && (activeMediaData.title || activeMediaData.name)) {
      q = activeMediaData.title || activeMediaData.name;
      if (subSearchQuery) subSearchQuery.value = q;
    } else if (parsed.cleanTitle) {
      q = parsed.cleanTitle;
      if (subSearchQuery) subSearchQuery.value = q;
    } else if (typeof currentPlayInfo !== 'undefined' && currentPlayInfo && currentPlayInfo.name) {
      q = currentPlayInfo.name.replace(/\.(mp4|mkv|avi|webm|ts|mov)$/i, '').replace(/[\._\-]/g, ' ').trim();
      if (subSearchQuery) subSearchQuery.value = q;
    }
  }

  // Clear Subtitle Loading Animation
  subResultsList.innerHTML = `
    <div style="text-align: center; padding: 30px 10px; color: #ffffff;">
      <div style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px auto;"></div>
      <p style="font-size: 13px; font-weight: 700; color: #ffffff;">Searching Subtitle Repositories...</p>
      <p style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">Querying OpenSubtitles, SubDL, Kitsunekko, Anime Tosho & Torrent files</p>
    </div>
  `;

  let torrentSubs = [];
  if (activeTorrentHash && (activeSubtitleProvider === 'all' || activeSubtitleProvider === 'torrent')) {
    try {
      const tRes = await fetch(`/api/torrent/check-subtitles?link=${encodeURIComponent(activeTorrentHash)}`);
      if (tRes.ok) {
        const tData = await tRes.json();
        if (tData.subtitles) torrentSubs = tData.subtitles;
      }
    } catch (e) {}
  }

  let onlineSubs = [];
  try {
    const imdb = (typeof activeMediaData !== 'undefined' && activeMediaData && activeMediaData.imdb_id) ? activeMediaData.imdb_id : '';
    const tmdb = (typeof activeMediaData !== 'undefined' && activeMediaData && activeMediaData.id) ? activeMediaData.id : '';
    const s = (typeof activeMediaData !== 'undefined' && activeMediaData && activeMediaData.season) ? activeMediaData.season : (parsed.season || '');
    const e = (typeof activeMediaData !== 'undefined' && activeMediaData && activeMediaData.episode) ? activeMediaData.episode : (parsed.episode || '');
    const url = `/api/subtitles/fetch?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}&imdb=${encodeURIComponent(imdb)}&tmdb=${encodeURIComponent(tmdb)}&s=${encodeURIComponent(s)}&e=${encodeURIComponent(e)}&provider=${encodeURIComponent(activeSubtitleProvider)}`;
    const res = await fetch(url);
    if (res.ok) {
      if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();
      if (data && Array.isArray(data.subtitles)) {
        onlineSubs = data.subtitles;
      }
    }
  } catch (e) {
    console.warn('Online subtitle fetch notice:', e);
  }

  if (activeSubtitleProvider === 'torrent') {
    onlineSubs = [];
  }

  if (torrentSubs.length === 0 && onlineSubs.length === 0) {
    subResultsList.innerHTML = `
      <div style="text-align: center; padding: 25px 10px; color: #f87171; font-size: 13px;">
        <i data-lucide="alert-circle" style="width: 24px; height: 24px; margin: 0 auto 8px auto; stroke: #ef4444;"></i>
        <p>No subtitle matches found for "<strong style="color:#ffffff;">${q || 'query'}</strong>" under selected filters.</p>
        <div style="margin-top: 10px; display: flex; justify-content: center; gap: 8px;">
          <button type="button" id="btnResetSubLang" class="btn btn-black-theme btn-sm" style="font-size: 11px;">Search All Languages</button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    const btnReset = document.getElementById('btnResetSubLang');
    if (btnReset && subLangSelect) {
      btnReset.addEventListener('click', () => {
        subLangSelect.value = 'all';
        fetchSubtitlesOnline();
      });
    }
    return;
  }

  subResultsList.innerHTML = '';

  // Render Torrent Package Subtitles
  if (torrentSubs.length > 0 && (activeSubtitleProvider === 'all' || activeSubtitleProvider === 'torrent')) {
    const tHeader = document.createElement('div');
    tHeader.style.cssText = 'color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;';
    tHeader.innerHTML = `<i data-lucide="package" style="width: 14px; height: 14px;"></i> Torrent Package Subtitles (${torrentSubs.length})`;
    subResultsList.appendChild(tHeader);

    torrentSubs.forEach((sub) => {
      const item = document.createElement('div');
      item.className = 'sub-item-card';
      item.innerHTML = `
        <div class="sub-item-info">
          <div class="sub-item-title" title="${sub.name}">${sub.name}</div>
          <div class="sub-item-badges">
            <span class="sub-badge-src sub-badge-torrent">Torrent</span>
            <span class="sub-badge-format">SRT/VTT</span>
          </div>
        </div>
        <div class="sub-actions">
          <button class="btn btn-sm btn-black-theme" style="padding: 5px 12px; font-size: 11px; border-radius: 6px;">Load Track</button>
          <a href="${sub.url}" download="${sub.name}" class="btn btn-sm btn-secondary" style="padding: 5px 8px; font-size: 11px; border-radius: 6px;" title="Download"><i data-lucide="download" style="width: 12px; height: 12px;"></i></a>
        </div>
      `;
      item.querySelector('.btn-black-theme').addEventListener('click', () => {
        applySubtitleTrack(sub.url, `[Torrent] ${sub.name}`);
        const modal = document.getElementById('subtitleModal');
        if (modal) modal.classList.add('hidden');
      });
      subResultsList.appendChild(item);
    });
  }

  // Render Multi-Provider Subtitles
  if (onlineSubs.length > 0) {
    const oHeader = document.createElement('div');
    oHeader.style.cssText = 'color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;';
    oHeader.innerHTML = `<i data-lucide="globe" style="width: 14px; height: 14px;"></i> Subtitles Available (${onlineSubs.length} Found)`;
    subResultsList.appendChild(oHeader);

    onlineSubs.forEach((sub) => {
      const item = document.createElement('div');
      item.className = 'sub-item-card';
      const srcLower = (sub.source || '').toLowerCase().replace(/\s+/g, '');
      let badgeClass = 'sub-badge-opensubtitles';
      if (srcLower.includes('subdl')) badgeClass = 'sub-badge-subdl';
      else if (srcLower.includes('kitsunekko')) badgeClass = 'sub-badge-kitsunekko';
      else if (srcLower.includes('animetosho')) badgeClass = 'sub-badge-animetosho';
      else if (srcLower.includes('wyzie')) badgeClass = 'sub-badge-wyzie';

      item.innerHTML = `
        <div class="sub-item-info">
          <div class="sub-item-title" title="${sub.display}">${sub.display}</div>
          <div class="sub-item-badges">
            <span class="sub-badge-src ${badgeClass}">${sub.source}</span>
            <span class="sub-badge-lang">${sub.language || 'English'}</span>
            <span class="sub-badge-format">${sub.format || 'SRT'}</span>
          </div>
        </div>
        <div class="sub-actions">
          <button class="btn btn-sm btn-black-theme" style="padding: 5px 12px; font-size: 11px; border-radius: 6px;">Load Track</button>
          <a href="${sub.rawUrl || sub.url}" target="_blank" download class="btn btn-sm btn-secondary" style="padding: 5px 8px; font-size: 11px; border-radius: 6px;" title="Download Subtitle File"><i data-lucide="download" style="width: 12px; height: 12px;"></i></a>
        </div>
      `;
      item.querySelector('.btn-black-theme').addEventListener('click', () => {
        applySubtitleTrack(sub.url, sub.display, sub.langCode);
        const modal = document.getElementById('subtitleModal');
        if (modal) modal.classList.add('hidden');
      });
      subResultsList.appendChild(item);
    });
  }

  if (window.lucide) lucide.createIcons();
}

function applySubtitleTrack(vttUrl, label, srclang = 'en') {
  if (!videoPlayer) return;
  const existingTracks = videoPlayer.querySelectorAll('track');
  existingTracks.forEach(t => t.remove());

  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = label || 'Subtitle';
  track.srclang = srclang;
  track.src = vttUrl;
  track.default = true;

  videoPlayer.appendChild(track);
  if (videoPlayer.textTracks && videoPlayer.textTracks[0]) {
    videoPlayer.textTracks[0].mode = 'showing';
  }

  if (window.plyrInstance) {
    window.plyrInstance.currentTrack = 0;
  }

  currentLoadedSubtitle = label;
  if (activeSubStatusBanner && activeSubLabel) {
    activeSubLabel.textContent = label;
    activeSubStatusBanner.style.display = 'flex';
  }

  const subBtn = document.getElementById('subtitlesBtn');
  if (subBtn) {
    subBtn.innerHTML = `<i data-lucide="subtitles"></i> Subtitles: Active`;
    if (window.lucide) lucide.createIcons();
  }

  showToast(`Subtitle track active: ${label}`, 'success');
}

function removeSubtitleTrack() {
  if (!videoPlayer) return;
  const existingTracks = videoPlayer.querySelectorAll('track');
  existingTracks.forEach(t => t.remove());
  if (videoPlayer.textTracks) {
    for (let i = 0; i < videoPlayer.textTracks.length; i++) {
      videoPlayer.textTracks[i].mode = 'disabled';
    }
  }
  if (window.plyrInstance) {
    window.plyrInstance.currentTrack = -1;
  }
  currentLoadedSubtitle = null;
  if (activeSubStatusBanner) {
    activeSubStatusBanner.style.display = 'none';
  }

  const subBtn = document.getElementById('subtitlesBtn');
  if (subBtn) {
    subBtn.innerHTML = `<i data-lucide="subtitles"></i> Additional Subtitles`;
    if (window.lucide) lucide.createIcons();
  }

  showToast('Subtitle track removed', 'info');
}

if (subFileInput) {
  if (subFileInput) subFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileUrl = URL.createObjectURL(file);
    applySubtitleTrack(fileUrl, file.name.replace(/\.[^/.]+$/, ''));
    if (subtitleModal) subtitleModal.classList.add('hidden');
  });
}

// Audio Tracks Modal Handlers
let currentAudioTrackIndex = '';
const audioTrackModal = document.getElementById('audioTrackModal');
const audioTracksBtn = document.getElementById('audioTracksBtn');
const closeAudioBtn = document.getElementById('closeAudioBtn');
const audioTracksList = document.getElementById('audioTracksList');

if (audioTracksBtn && audioTrackModal) {
  if (audioTracksBtn) audioTracksBtn.addEventListener('click', () => {
    audioTrackModal.classList.remove('hidden');
    loadAudioTracks();
  });
}

if (closeAudioBtn) {
  if (closeAudioBtn) closeAudioBtn.addEventListener('click', () => {
    audioTrackModal.classList.add('hidden');
  });
}

async function loadAudioTracks() {
  if (!audioTracksList) return;
  if (!currentStreamInfo || !currentStreamInfo.hash) {
    audioTracksList.innerHTML = `<p style="color: #a1a1aa; font-size: 13px;">Play a video torrent first to inspect audio tracks.</p>`;
    return;
  }

  audioTracksList.innerHTML = `<p style="color: #6366f1; font-size: 13px;">Probing audio streams via ffprobe...</p>`;

  const directStreamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(currentStreamInfo.hash)}&index=${currentStreamInfo.fileId}&play=1`;
  
  try {
    const res = await fetch(`/api/torrent/audio-tracks?url=${encodeURIComponent(directStreamUrl)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
    const data = await res.json();

    if (!data.tracks || data.tracks.length === 0) {
      audioTracksList.innerHTML = `<p style="color: #a1a1aa; font-size: 13px;">Default Audio Track active.</p>`;
      return;
    }

    audioTracksList.innerHTML = '';
    data.tracks.forEach((tr, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.style.cssText = 'width: 100%; text-align: left; justify-content: space-between; padding: 12px; font-size: 13px; font-weight: 600;';
      if ((currentAudioTrackIndex === '' && i === 0) || currentAudioTrackIndex === tr.index.toString()) {
        btn.className = 'btn btn-primary';
      }
      btn.innerHTML = `
        <span><i data-lucide="volume-2" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px;"></i> ${tr.label}</span>
        ${(currentAudioTrackIndex === '' && i === 0) || currentAudioTrackIndex === tr.index.toString() ? '<span style="font-size:11px; font-weight:800; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:12px;">ACTIVE</span>' : ''}
      `;
      btn.addEventListener('click', () => {
        currentAudioTrackIndex = tr.index.toString();
        audioTrackModal.classList.add('hidden');
        
        const targetTime = videoPlayer ? videoPlayer.currentTime : 0;
        let modeToUse = gstEngineMode === 'direct' ? 'remux' : gstEngineMode;
        let seekUrl = `/api/torrent/stream-ffmpeg?url=${encodeURIComponent(directStreamUrl)}&mode=${modeToUse}&audioTrack=${currentAudioTrackIndex}`;
        if (targetTime > 5) {
          seekUrl += `&startTime=${Math.floor(targetTime)}`; window.currentSeekOffset = Math.floor(targetTime);
        }
        showLoading(`Switching Audio Track to ${tr.label}...`, 'Re-muxing audio stream...');
        if (videoPlayer) {
          videoPlayer.src = seekUrl;
    videoPlayer.load();
          videoPlayer.play().catch(e => console.warn(e));
        }
      });
      audioTracksList.appendChild(btn);
    });
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    audioTracksList.innerHTML = `<p style="color: #ef4444; font-size: 13px;">Failed to probe audio tracks.</p>`;
  }
}



// Set default UI hidden mode on load so normal user only sees the video player
document.addEventListener('DOMContentLoaded', () => {
  
  attachSeekingHandler();
});

window.addEventListener("error", function (e) {
    if (e.message === undefined && e.error === undefined && e.isTrusted !== undefined) {
        // This is a DOM element error (e.g., <track>, <video>, <img> failing or EOF)
        // Prevent it from bubbling up to AI Studio's global error capturer
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}, true);


// Side Panels & Magnet Card Toggle (Mobile & Desktop)
function toggleExtraPanels() {
  const magnetCard = document.getElementById('magnetHeroCard');
  const sidePanel = document.getElementById('sidePanel');
  const contentGrid = document.querySelector('.content-grid');
  
  if (magnetCard) magnetCard.classList.toggle('panel-collapsed');
  if (sidePanel) sidePanel.classList.toggle('panel-collapsed');
  if (contentGrid) contentGrid.classList.toggle('single-column');
  
  const isCollapsed = sidePanel && sidePanel.classList.contains('panel-collapsed');
  showToast(isCollapsed ? 'Panels minimized (Press Q to expand)' : 'Panels expanded (Press Q to minimize)', 'info');
}

// Bind Q key for panel toggle
document.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      toggleExtraPanels();
    }
  }
});
