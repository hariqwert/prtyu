# Stalker Pro: Full System Architecture

Stalker Pro is a high-performance IPTV portal and player built with **Node.js (TypeScript)**. It acts as a bridge between IPTV providers (Stalker Middleware and Xtream Codes) and modern web browsers.

---

## 🏗️ Core Architecture Overview

The system follows a **Full-Stack Proxy Architecture**:
1.  **Backend (Node.js/Express)**: Handles portal handshakes, authentication, metadata fetching, and video stream proxying.
2.  **Storage (JSON File System)**: Persists credentials, tokens, and session data in the `doctor_strange/` directory.
3.  **Frontend (HTML/PHP Templates)**: Serves a polished UI using Tailwind CSS and ArtPlayer, with dynamic logic injected server-side.

---

## 📡 1. Portal Connectors (API Layer)

### Stalker Middleware (`src/stalkerAPI.ts`)
- **Protocol**: Mimics a Mag250/254 set-top box.
- **Handshake**: Performs multi-step authentication (handshake -> get_profile -> get_token).
- **Encryption**: Handles portal-specific encryption/decryption of stream URLs.
- **Caching**: Caches channel lists and genres in `cache_stalker/` to reduce API load.

### Xtream Codes (`src/xtream/XtreamAPI.ts`)
- **Protocol**: Uses the Xtream Codes Player API (`player_api.php`).
- **Data Flow**: Fetches Live, VOD, and Series metadata in JSON format.
- **Session Management**: Tracks user expiry and connection limits.

---

## 🛠️ 2. The Proxy Engine (Streaming Pipeline)

Browsers cannot natively play IPTV streams due to CORS restrictions and non-standard headers. The proxy engine is the "heart" of Stalker Pro.

### Stalker Proxy (`src/proxy.ts`) & Xtream Proxy (`src/xtream/xtreamProxy.ts`)
- **Header Masking**: Injects headers like `User-Agent: TiviMate` or `IPTVSmartersPro` to bypass provider blocks.
- **Binary Pass-through**: Uses `Axios` with `responseType: 'stream'` to pipe data from the provider to the client without loading the entire video into server memory.
- **MIME Correction**: Ensures the browser receives correct types (e.g., `video/MP2T` for TS streams).
- **Route Handlers**:
    - `/live.php`: Proxies Stalker streams.
    - `/xtream.php`: Proxies Xtream streams.

---

## 📺 3. Frontend Player Logic (`play.php`)

The player is designed for resilience and low latency.

- **Playback Engines**:
    - **mpegts.js**: Required for `.ts` (MPEG-TS) chunks common in IPTV.
    - **Hls.js**: Handles standard HLS (`.m3u8`) playlists.
- **ArtPlayer Integration**: A customizable UI wrapper that handles:
    - **Stall Detection**: Monitors `currentTime` to detect frozen streams and "nudges" the player forward.
    - **Latency Chasing**: Automatically skips ahead if the buffer gap exceeds a threshold (e.g., 5 seconds) to keep the stream live.
    - **Retry Logic**: Implements exponential backoff to recover from transient network errors.

---

## 📂 Directory Structure

| Path | Purpose |
| :--- | :--- |
| `server.ts` | Main Express server and route orchestrator. |
| `src/` | Core TypeScript backend logic (API and Proxies). |
| `doctor_strange/` | **Protected Data**: JSON databases for admins and portal credentials. |
| `cache_stalker/` | Temporary cache for channel lists and session tokens. |
| `assets/` | Branding, logos, and global CSS. |
| `*.php` | UI templates (parsed as HTML by the server). |

---

## 🔐 Security & Access Control

- **Directory Protection**: The server explicitly blocks public access to `doctor_strange/` and `cache_stalker/`.
- **CORS Management**: The server acts as a CORS gateway, allowing the frontend to talk to any provider via the proxy.
- **Error Handling**: Graceful failure modes for 401 Unauthorized (Expired) or 404 Not Found (Stream Down) states.
