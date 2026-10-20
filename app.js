// TorrStream Client Application Logic

const TORRSERVER_BASE = 'http://localhost:8090';

// State
let activeTorrentHash = null;
let activeFileIndex = null;
let currentTorrentData = null;
let statsPollInterval = null;
let serverPollInterval = null;
let metadataPollTimer = null;
let waitingTimer = null;

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
  serverPollInterval = setInterval(checkServerConnection, 5000);
  
  setupEventListeners();
  loadActiveTorrentsList();
  
  // Set Instant Stream 200MB + 10% Prebuffer + Auto Cache Removal for zero-wait playback
  applyBufferSettings(209715200, 120, 10, '200MB Instant', 'Instant Stream');

  // Check URL parameters for Direct Auto-Play API Link (?q=... or ?play=... or ?magnet=...)
  checkUrlAutoPlay();
});

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
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const bestResult = data.results[0];
            console.log(`[Auto-Play API] Selected top stream: ${bestResult.title}`);
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
  
  if (clearInputBtn) {
    clearInputBtn.addEventListener('click', () => {
      magnetInput.value = '';
      magnetInput.focus();
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
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
  }

  if (magnetForm) {
    magnetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputVal = magnetInput.value.trim();
      if (inputVal) {
        playMagnetOrUrl(inputVal);
      }
    });
  }

  // Search Type Radio Toggle (Movie vs TV Series)
  document.querySelectorAll('input[name="mediaType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (episodeSelectRow) {
        if (radio.value === 'series') {
          episodeSelectRow.classList.remove('hidden');
        } else {
          episodeSelectRow.classList.add('hidden');
        }
      }
    });
  });

  // Search Modal Handlers
  if (openSearchBtn && searchModal) {
    openSearchBtn.addEventListener('click', () => {
      searchModal.classList.remove('hidden');
      if (modalSearchInput) modalSearchInput.focus();
    });
  }

  if (closeSearchBtn && searchModal) {
    closeSearchBtn.addEventListener('click', () => {
      searchModal.classList.add('hidden');
    });
  }

  if (searchModal) {
    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) {
        searchModal.classList.add('hidden');
      }
    });
  }

  if (modalSearchForm) {
    modalSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = modalSearchInput ? modalSearchInput.value.trim() : '';
      const selectedType = document.querySelector('input[name="mediaType"]:checked')?.value || 'movie';
      const season = seasonInput ? seasonInput.value : '1';
      const episode = episodeInput ? episodeInput.value : '1';

      if (q) performMovieSearch(q, selectedType, season, episode);
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
      const tagText = cacheSize >= 500000000 ? 'Ultra 4K' : (cacheSize >= 200000000 ? 'Instant Stream' : 'Standard');

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

  // Video Events - Smooth Glitch-Free Overlay Logic
  if (videoPlayer) {
    videoPlayer.addEventListener('playing', () => {
      if (waitingTimer) clearTimeout(waitingTimer);
      hideLoading();
      if (playerPlaceholder) playerPlaceholder.classList.add('hidden');
    });

    videoPlayer.addEventListener('timeupdate', () => {
      if (videoPlayer.currentTime > 0.1 && !videoPlayer.paused) {
        hideLoading();
      }
    });

    videoPlayer.addEventListener('canplay', () => {
      hideLoading();
    });

    videoPlayer.addEventListener('waiting', () => {
      if (waitingTimer) clearTimeout(waitingTimer);
      waitingTimer = setTimeout(() => {
        if (videoPlayer.paused || videoPlayer.seeking) {
          showLoading('Buffering Stream...', 'Fetching data from TorrServer cache...');
        }
      }, 500);
    });

    videoPlayer.addEventListener('error', (e) => {
      console.error('Video player error:', videoPlayer.error);
      if (waitingTimer) clearTimeout(waitingTimer);
      hideLoading();
    });
  }

  if (copyStreamUrlBtn) {
    copyStreamUrlBtn.addEventListener('click', () => {
      if (videoPlayer && videoPlayer.src) {
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
  }

  if (refreshTorrentsBtn) refreshTorrentsBtn.addEventListener('click', loadActiveTorrentsList);
}

// Perform Movie & Series Search Query via Standalone REST API V1
async function performMovieSearch(query, mediaType = 'movie', season = '1', episode = '1') {
  if (!searchResultsArea) return;
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
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error('Search failed');

    const data = await res.json();
    renderSearchResults(data.results || data.streams || []);
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
  if (!searchResultsArea) return;
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
    const card = document.createElement('div');
    card.className = 'movie-result-card';
    card.innerHTML = `
      <div class="result-content">
        <div class="result-title">🎬 ${m.title} ${m.year ? `(${m.year})` : ''}</div>
        <div class="result-meta">
          <span class="meta-badge badge-quality">${m.quality || '1080p'}</span>
          <span class="meta-badge badge-size">💾 ${m.size || '1 GB'}</span>
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
      if (searchModal) searchModal.classList.add('hidden');
      if (magnetInput) magnetInput.value = m.magnet;
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
      console.log(`[TorrServer Engine] Settings Applied`);
    }
  } catch (err) {
    console.warn('Could not update engine settings:', err);
  }
}

// Check TorrServer API Connectivity & Parse Engine Version
async function checkServerConnection() {
  try {
    const res = await fetch(`${TORRSERVER_BASE}/echo`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const text = await res.text();
      let ver = text.trim();
      if (ver.startsWith('<') || ver.includes('<!doctype') || ver.includes('<html')) {
        const titleMatch = ver.match(/<title>(.*?)<\/title>/i);
        ver = titleMatch ? titleMatch[1] : 'TorrServer Engine';
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
        setServerStatus(true, 'Online (TorrServer Engine)');
        return true;
      }
    } catch (e) {}
  }
  setServerStatus(false, 'Offline (Port 8090)');
  return false;
}

function setServerStatus(isOnline, text) {
  if (serverStatusPill) serverStatusPill.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
  if (serverStatusText) serverStatusText.textContent = text;
}

// Main Function: Play Magnet Link or Stream URL
async function playMagnetOrUrl(input) {
  if (metadataPollTimer) clearTimeout(metadataPollTimer);
  if (statsPollInterval) clearInterval(statsPollInterval);

  if (!input.startsWith('magnet:?') && !input.startsWith('http://') && !input.startsWith('https://')) {
    if (searchModal && modalSearchInput) {
      searchModal.classList.remove('hidden');
      modalSearchInput.value = input;
      performMovieSearch(input);
    }
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

    if (!addRes.ok) {
      throw new Error(`Failed to add magnet: HTTP ${addRes.status}`);
    }

    const torrData = await addRes.json();
    currentTorrentData = torrData;
    activeTorrentHash = torrData.hash;

    await pollTorrentMetadata(torrData.hash, 0);

  } catch (err) {
    console.error('Error adding magnet:', err);
    hideLoading();
    alert(`Could not stream magnet link: ${err.message}\n\nMake sure TorrServer is running on http://localhost:8090`);
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

    if (!res.ok) throw new Error('Could not fetch torrent info');

    const data = await res.json();
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
        alert('No files found inside this torrent.');
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
      alert('Timed out waiting for torrent metadata. Ensure the magnet link has active seeders.');
    }
  }
}

// Play specific file inside torrent
function playTorrentFile(hash, fileId, filePath, title, fileLength) {
  activeTorrentHash = hash;
  activeFileIndex = fileId;

  const isAvi = filePath.toLowerCase().endsWith('.avi');
  const streamUrl = `${TORRSERVER_BASE}/stream?link=${encodeURIComponent(hash)}&index=${fileId}&play=1`;

  if (currentTitle) currentTitle.textContent = getFileName(title || filePath || 'Torrent Video Stream');
  if (currentHash) currentHash.textContent = isAvi ? '⚠️ Legacy AVI Format (Use Copy Stream URL for VLC)' : `Hash: ${hash.substring(0, 10)}...`;
  if (currentSize) currentSize.textContent = fileLength ? `Size: ${formatBytes(fileLength)}` : 'Size: Dynamic';

  highlightActiveFile(fileId);

  if (playerPlaceholder) playerPlaceholder.classList.add('hidden');

  if (isAvi) {
    hideLoading();
    alert(`⚠️ AVI Format Detected:\n\nBrowsers do not support .avi video playback natively.\n\nClick "Copy Stream URL" and paste into VLC Media Player (Ctrl+N) to play instantly!`);
  } else {
    showLoading('Instant Stream Starting...', 'Prioritizing video header...');
    if (videoPlayer) {
      videoPlayer.src = streamUrl;
      videoPlayer.play().catch(e => {
        console.log('Autoplay deferred, waiting for user click:', e);
      });
    }
  }

  startStatsPolling(hash);
}

function startDirectVideo(url, title) {
  if (currentTitle) currentTitle.textContent = title;
  if (currentHash) currentHash.textContent = 'Hash: Direct URL';
  if (currentSize) currentSize.textContent = 'Size: Dynamic';
  
  if (playerPlaceholder) playerPlaceholder.classList.add('hidden');
  if (videoPlayer) {
    videoPlayer.src = url;
    videoPlayer.play();
  }
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
        const data = await res.json();
        
        const speed = formatBytes(data.download_speed || 0) + '/s';
        const peers = `${data.connected_seeders || 0} / ${data.active_peers || 0}`;
        const buffer = data.prebuffer_bytes && data.preload_size
          ? Math.min(100, Math.round((data.prebuffer_bytes / data.preload_size) * 100))
          : (data.stat_string || 'Ready');

        if (statSpeed) statSpeed.textContent = speed;
        if (statPeers) statPeers.textContent = `${peers} Peers`;
        if (statBuffer) statBuffer.textContent = typeof buffer === 'number' ? `Buffer ${buffer}%` : buffer;

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
  if (filesCountBadge) filesCountBadge.textContent = `${fileStats.length} files`;
  if (!filesListContainer) return;
  
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
  if (!activeTorrentsList) return;
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

// Loading Helpers - Smooth Glitch-Free Overlay
function showLoading(title, subtitle) {
  // Do not overlay loading screen if video is actively playing!
  if (videoPlayer && !videoPlayer.paused && videoPlayer.currentTime > 0.5) {
    return;
  }
  if (loadingTitle) loadingTitle.textContent = title;
  if (loadingSubtitle) loadingSubtitle.textContent = subtitle;
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.classList.remove('hidden');
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
    loadingOverlay.style.display = 'none';
  }
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
