# 📋 Changelog — Stalker Pro & Quantum OTT Suite

All notable changes from initial state to current release (v2.5.0).

---

## [v2.5.0] - 2026-08-24

### 🌌 Refined Quantum 3D Visualizer
- **Crystalline Quantum Core**: Added multifaceted inner icosahedron core with rotating outer dodecahedron lattice.
- **4 Orbital Gimbal Rings**: Added 4-ring orbital matrix reacting across bass, mid, and treble frequency bands.
- **Spiral Vortex Nebula**: Replaced static particles with a 1,200-particle toroidal vortex flowing in 3D spacetime.
- **Dynamic Lighting**: Added point light at the core pulsing with audio amplitude.
- **Cyber-Neon Color Shift**: Implemented real-time color gradient cycling across cyan, violet, magenta, amber, and emerald synced to audio beats.
- **Card Aura Glow**: Card border and box shadow dynamically synchronize with active music colors.

### 🛠️ Maintenance Mode Engine & Audio Player
- **Integrated Full Audio Player**: Embedded play/pause, scrubbable progress bar, rewind/fast-forward, volume, search, and download button.
- **Auto-Playing Assigned Music**: Directly loads and plays music playlists or search queries assigned via Admin (`hari.html`).
- **Eliminated Reload Loop**: Fixed `public/watchdog.js` 1-second blinking bug with multi-layer 503 detection.
- **Active Real-Time Sync**: Injected `watchdog.js` into `consumet.html` and `hero.html` for instant client transition when maintenance is toggled.

### 🚀 BitTorrent Player & Search Upgrades
- **Parallel Multi-Provider Search**: Eliminated 5-second artificial delay in `src/routes/torrent.ts`, switching to `Promise.allSettled` across YTS, PirateBay, Nyaa, and Torrentio (search time reduced from 12s+ &rarr; 3.2s).
- **Glitch-Free Seeking**: Wrapped video player seek handlers in debouncing guards to prevent timeline jitter.
- **Direct Stream Downloader**: Added download button to player controls.
- **Syntax Error Fix**: Resolved duplicate variable declarations in `public/torrent.js`.

### 🎬 Consumet Sports UI & Performance
- **16:9 Widescreen Cards**: Replaced tall cards with modern widescreen aspect ratio cards featuring LIVE pulse indicators.
- **Lag-Free Rendering**: Capped shelf rendering at 60 items per shelf and added chunked pagination to eliminate UI freeze across 3,540 channels.
- **Optimized Lucide Icons**: Replaced per-card icon generation with scoped single-pass calls.

### ⚡ Video Proxy & Xtream Engine
- **Direct Socket Piping**: Replaced memory buffering with direct socket pipe in `src/proxy.ts`.
- **fMP4 / `#EXT-X-MAP` Support**: Added manifest parser rewriting for initialization segments.
- **Xtream Keep-Alive**: Added background 30s keep-alive loop and request payload size guards in `src/xtream/xtreamProxy.ts`.

### 🔒 Security & Admin Authentication
- **Master Admin Password `2008`**: Unified password verification across all endpoints and portals for users `admin` and `hari`.
- **Removed Duplicate Verification**: Removed redundant second password prompt in `public/hari.js`.
- **Sports M3U Uploader**: Added admin tools for uploading and syncing custom sports playlist feeds.

### 🐧 Cross-Platform Linux / Cloud Run Support
- **Cross-Platform yt-dlp Resolver**: Auto-detects and runs `yt-dlp` on Windows, Linux, and containerized Google Cloud Run environments in `src/routes/youtube.js`.
