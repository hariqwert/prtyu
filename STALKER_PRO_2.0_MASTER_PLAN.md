# 🚀 Stalker Pro 2.0 — Master Architecture & Build Plan

> **Version:** 2.0.0-MEGA  
> **Status:** Draft Blueprint & Master Roadmap  
> **Objective:** Transform Stalker Pro into a unified, ultra-low latency, multi-media streaming ecosystem combining **IPTV Master (Stalker/Xtream/M3U)**, **Netflix-Grade Cinema (TMDB/Consumet)**, **Spotify Audio Hub**, and **Advanced Streaming Proxy Pipelines**.

---

## 🛠️ Executive Summary & Core Architectural Goals

Stalker Pro 2.0 is a complete evolutionary upgrade designed to bridge high-performance Node.js streaming proxy engines with a modern glassmorphic web UI.

### 🌟 4 Key Pillars of 2.0
1. **Next-Gen Cinema & IPTV UI/UX:** A Netflix/Apple TV-inspired glassmorphic interface with fluid hero billboarding, category rails, persistent Spotify-style audio bars, and command-K search.
2. **Dual High-Speed Video Engines:** Unified Plyr + Hls.js + mpegts.js player suite supporting multi-audio track selection, WebVTT/SRT subtitles, aspect ratio scaling (Fit, Cover, Fill, Zoom 120%), and Smart Watchdog auto-reconnects.
3. **Interactive EPG & Catch-Up Guide:** 24-hour horizontal timeline guide with live program progress bars, episode details modals, and 7-day Stalker archive catch-up playback.
4. **Zero-Latency Stream Proxy Engine:** Low-overhead Node.js HTTP stream piping (`proxyRes.pipe`), M3U8 manifest LRU caching, range request support (206 Partial Content), dynamic header/referer spoofing, and automatic token auto-healing on HTTP 401/403 errors.

---

## 📐 Technology Architecture Stack

```text
                                 +---------------------------------+
                                 |    Unified Client App Shell     |
                                 | (index.php / consumet.html /    |
                                 |    music.html / hero.html)      |
                                 +---------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
         +-----------------------------+                     +-----------------------------+
         |     Live IPTV Engine        |                     |   Pure HLS / Cinema Engine  |
         |    (play.php / Plyr.js)     |                     |    (play_consumet.php)      |
         +-----------------------------+                     +-----------------------------+
                        |                                                   |
                        +-------------------------+-------------------------+
                                                  |
                                                  v
                                 +---------------------------------+
                                 |     Node.js Express Server      |
                                 |           (server.ts)           |
                                 +---------------------------------+
                                                  |
                       +--------------------------+--------------------------+
                       |                                                     |
                       v                                                     v
        +------------------------------+                      +------------------------------+
        |   Stalker / Xtream Connector |                      |   Streaming Proxy Pipeline   |
        |      (src/stalkerAPI.ts)     |                      |       (src/proxy.ts)         |
        +------------------------------+                      +------------------------------+
                       |                                                     |
                       v                                                     v
        +------------------------------+                      +------------------------------+
        | Protected Session Vault      |                      | Upstream IPTV CDNs /         |
        | (/doctor_strange/ & Cache)   |                      | HLS Stream Providers         |
        +------------------------------+                      +------------------------------+
```

---

## 📑 Detailed Module Breakdowns

---

### Module 1: Next-Gen UI/UX Redesign (Netflix × Spotify × Stalker Pro)

#### 1.1 Glassmorphic Cyber-Dark Design System
* **Palette:** Deep Obsidian (#05070a canvas, #0d1117 container cards) with crimson (`#ef4444`) and emerald (`#10b981`) status accents.
* **Backdrop Blurs:** High-density glassmorphism (`backdrop-blur-md`, `border-white/10`) for overlays, navigation drawers, and control panels.
* **Dynamic Color Extraction:** Uses HTML5 Canvas API to sample dominant palette colors from active movie posters/album art, subtly tinting hero backgrounds.

#### 1.2 Hero Showcase & Gateway (`hero.html`)
* **3D Glass Showcase Card:** Interactive glass card displaying live portal status, connected MAC credentials, latency ping, and active channels.
* **Auto-Rotating Hero Billboard:** Ambient video backdrop crossfading top trending movies and live sports events with instant Play and Watchlist buttons.
* **One-Click Quick Launcher:** Direct single-click entry into Stalker Live IPTV or Cinema mode.

#### 1.3 Cinema & Multi-Provider Hub (`consumet.html`)
* **Netflix-Style Rails:** Horizontal poster carousels categorized by Trending Now, Action, Sci-Fi, Documentaries, and TV Series.
* **TMDB Metadata Integration:** Rich movie modals displaying 4K HDR badges, IMDb ratings, cast bios, and official YouTube trailer lightboxes.
* **Multi-Server Selector:** Seamless fallback between direct M3U8 streams, VidSrc, VidLink, and secondary embeds.

#### 1.4 Persistent Spotify-Style Audio Hub (`music.html`)
* **Floating Bottom Player Bar:** Continuous audio playback that stays active while users browse channel guides or movie listings.
* **Multi-Provider Stream Selector:** Integrated JioSaavn, Audius, and global live radio station streaming.
* **Real-time Audio Visualizers:** Audio spectrum visualizer canvas with playlist management saved via IndexedDB.

---

### Module 2: Ultimate Dual Video Engine & Player Capabilities

#### 2.1 Unified Dual-Player Pipeline (`play.php` & `play_consumet.php`)
* **Multi-Codec Fallback:** Automatic dynamic switching between **Hls.js**, **mpegts.js**, and native HTML5 video based on stream mime-types (.m3u8, .ts, .mp4, .mkv).
* **Smart Watchdog & Auto-Healing:** Background watchdog timer monitoring `video.currentTime` delta. If playback freezes for >15 seconds, triggers a silent auto-reconnection without reloading the page.

#### 2.2 Advanced Audio & Subtitle Controls
* **Multi-Audio Track Selector:** Extract and display embedded multi-language audio tracks (`#EXT-X-MEDIA:TYPE=AUDIO`) in a clean player settings menu.
* **Subtitle Engine:** Embedded WebVTT/CEA-608 caption rendering plus a custom drag-and-drop `.srt` / `.vtt` file uploader with adjustable font sizing and sync timing offsets (±5s).

#### 2.3 Interactive Gesture & Display Suite
* **Aspect Ratio Modes:** Cycle through Default (Fit/Contain), Fill Screen (Cover), Stretch (16:9), and Zoom (120%).
* **Touch Gestures:** Double-tap left/right for ±10s seeking with visual ripple feedback; vertical swipe for brightness and volume adjustments.
* **Utility Features:** Integrated Sleep Timer (15m, 30m, 45m, 60m), Picture-in-Picture (PiP), and Screen Rotation Lock.

---

### Module 3: Advanced EPG (Electronic Program Guide) & Catch-Up Matrix

#### 3.1 24-Hour Interactive Timeline EPG
* **Ruler Timeline View:** Horizontally scrollable 24-hour time ruler with a real-time vertical red seeker line showing current elapsed time.
* **Show Completion Progress:** Visual percentage progress bar overlaid on currently airing TV shows.
* **Program Information Modal:** Clicking any EPG tile opens full program descriptions, episode numbers, rating badges, and cast info.

#### 3.2 Catch-Up Archive Playback
* **7-Day Stalker Replay:** Integrates with Stalker Portal `cmd=get_ordered_list` archive APIs, allowing users to scroll back in time and replay previously aired shows.
* **One-Click Show Reminders:** Schedule local browser notifications when upcoming favorite programs are about to air.

---

### Module 4: Ultra Low-Latency Streaming Proxy Engine (`src/proxy.ts`)

#### 4.1 Native Node Stream Piping
* **Zero-Copy Pipeline:** Replaced heavy HTTP abstractions with low-level Node `http.request` / `https.request` streams using direct `proxyRes.pipe(res)`.
* **Byte-Range Seeking:** Full support for `Range` request headers (`HTTP 206 Partial Content`) to enable fast scrubbing in heavy VOD files (.mp4/.mkv).

#### 4.2 Security, Headers & Caching
* **CORS & Domain Unblocking:** Dynamic header injection (`User-Agent`, `Referer`, `Origin`, `Cookie: mac=...`) to bypass strict upstream IPTV CDN blocks.
* **Manifest LRU Cache:** Caching `.m3u8` playlist manifests in memory for 2-5 seconds, reducing upstream server load by up to 70%.
* **Token Auto-Healing:** Automatic detection of HTTP 401/403 token expiration with instant background Stalker token refresh before retrying streams.

---

### Module 5: Admin Control Center & System Shielding (`server.ts` & Admin UI)

#### 5.1 Real-Time Analytics Dashboard
* **Active Connections Inspector:** Live monitoring of connected client IPs, current streaming channels, stream types (Portal/M3U/Xtream), and uptime statistics.
* **Bandwidth Throughput Monitor:** Real-time data transfer metrics for ingress/egress proxy streams.

#### 5.2 Multi-Portal Vault & Security
* **Multi-Account Manager:** Add, edit, test, and switch between multiple Stalker MAC portals, Xtream Codes credentials, and M3U files in `/doctor_strange/`.
* **System Master Kill Switch:** One-click activation of Maintenance Mode or System Offline Mode with custom overlay messages.
* **Developer IP Whitelist:** IP firewall controls restricting system access during active development.

---

## 🗓️ Phase-by-Phase Implementation Roadmap

| Phase | Title | Major Deliverables | Target Files |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Proxy & Token Auto-Healing** | Implement LRU caching, Range request 206 support, and automatic Stalker bearer token renewal on HTTP 401/403. | `src/proxy.ts`, `src/stalkerAPI.ts` |
| **Phase 2** | **Unified Player Suite** | Build multi-audio track switcher, WebVTT subtitle parser, gesture seeking, and aspect ratio controls. | `play_consumet.php`, `play.php` |
| **Phase 3** | **Interactive EPG Matrix** | Create 24-hour horizontal timeline guide, live progress bars, program modals, and 7-day catch-up replay. | `index.php`, `src/stalkerAPI.ts` |
| **Phase 4** | **Netflix & Spotify UI Overhaul** | Upgrade Cinema poster rails, TMDB metadata modals, Spotify persistent floating player, and hero landing page. | `consumet.html`, `music.html`, `hero.html`, `index.php` |
| **Phase 5** | **Admin Control Panel** | Real-time traffic graphs, session inspector table, portal vault manager, and firewall IP whitelist. | `server.ts`, `/doctor_strange/` |

---

## 💡 Summary & Verification

This document (`STALKER_PRO_2.0_MASTER_PLAN.md`) serves as the official master plan and single source of truth for the **Stalker Pro 2.0 Mega Update**. All future code updates and features can be built incrementally following this roadmap.
