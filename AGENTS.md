# 🤖 HL AI & Stalker Pro 2.0 Master Architecture Guide

Authoritative technical documentation and operational rules for AI coding assistants (Antigravity, Claude Code, Cursor, Copilot) working inside the **remix-hl** (Stalker Pro 2.0) codebase.

---

## 1. System Overview & Core Philosophy

**remix-hl / Stalker Pro 2.0** is an enterprise-grade IPTV & Live Sports streaming platform written in modern **TypeScript (Node.js + Express)**. It provides multi-source live scraping, dynamic token decryption, reverse CORS proxying, and Kodi-compatible M3U generation.

### Key Architectural Tenet: PURE STREAM PLAYLISTS
> [!IMPORTANT]
> **Streams in `.m3u` playlists MUST ALWAYS point to direct video stream endpoints (`/live.php?token=STALKER_PRO&id=...`, `/api/play_stream/:id`, or `.mpd`/`.m3u8` CDN URLs).**
> **NEVER inject HTML embed URLs (e.g. `/player/...`, `aioplayer.html`, etc.) into an M3U file.** External players (VLC, TiviMate, OTT Navigator, Kodi) require binary media manifests and will fail if HTML is returned.

```
                   ┌──────────────────────────────────────────────────────────┐
                   │                 Clients & Video Players                  │
                   │   (Kodi / TiviMate / OTT Navigator / VLC / Stalker Pro)  │
                   └────────────────────────────┬─────────────────────────────┘
                                                │ HTTP / M3U Requests
                                                ▼
                   ┌──────────────────────────────────────────────────────────┐
                   │                     server.ts:3000                       │
                   │              (Express Gateway Router)                    │
                   └──────┬─────────────────────┬──────────────────────┬──────┘
                          │                     │                      │
                          ▼                     ▼                      ▼
               ┌─────────────────────┐┌───────────────────┐┌──────────────────┐
               │  routes/sportsM3u   ││   src/proxy.ts    ││  routes/hybridM3u│
               │ (/sports.m3u, /dlhd)││   (/live.php)     ││  (/hybrid.m3u)   │
               └──────────┬──────────┘└─────────┬─────────┘└──────────────────┘
                          │                     │
                          ▼                     ▼
          ┌──────────────────────────────────────────────────────┐
          │                  Backend Services                    │
          ├──────────────────────────────────────────────────────┤
          │ • MdtvService (src/services/mdtvService.ts)          │
          │ • TimstreamsService (src/services/timstreamsService) │
          │ • EmbedScraperService (services/embedScraperService) │
          │ • ChannelJsonService (assets/channels.json)          │
          └──────────────────────────────────────────────────────┘
```

---

## 2. Directory & Module Boundaries

```text
/
├── server.ts                       # Gateway router & Express entrypoint (port 3000)
├── package.json                    # Scripts (dev, start, build) & dependencies
├── tsconfig.json                   # Strict TypeScript compiler configuration
│
├── assets/                         # Channel catalogs, SVG logos & M3U outputs
│   ├── channels.json               # Master channel database (700+ channels)
│   ├── sports.m3u                  # Auto-generated live sports M3U with Kodi DRM tags
│   └── logos/                      # High-definition SVG channel badges
│
├── src/
│   ├── proxy.ts                    # Core TS/HLS/DASH proxy, CORS stripper & RAM cache
│   ├── stalkerAPI.ts               # Stalker portal crypto (Scarlet Witch & Wanda ciphers)
│   │
│   ├── routes/
│   │   ├── sportsM3u.ts            # Master sports M3U generator & /api/play_stream/
│   │   ├── hybridM3u.ts            # Dynamic multi-source hybrid playlist merger
│   │   └── admin.ts                # Channel manager, status monitor & portal editor
│   │
│   └── services/
│       ├── mdtvService.ts          # MDTV Sports Scraper (34 DASH + ClearKey channels)
│       ├── timstreamsService.ts    # TimStreams resolver & XOR subtraction decoders
│       ├── sportsScraperService.ts # SuperSport & sports event schedule aggregator
│       ├── embedScraperService.ts  # Generic web embed analyzer & m3u8 extractor
│       └── channelJsonService.ts   # Catalog I/O with auto-repair and backup safety
```

---

## 3. Streaming Engine & Resolver Protocols

### 📡 A. MDTV JioTV Sports Scraper (`src/services/mdtvService.ts`)
- **Upstream Feed**: `https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/star2.json`
- **Managed Channels**: 34 premium channels (Star Sports 1/2/3/Select/Regional, Sony Ten 1/2/3/4/5, Eurosport, DD Sports).
- **Stream Format**: Dynamic DASH (`application/dash+xml` `.mpd` manifests).
- **DRM**: W3C ClearKey (`key_id:key`).
- **Authorization**: Akamai SHA-256 tokens (`__hdnea__`).
- **Resolver Flow**:
  1. Requests to `/live.php?token=STALKER_PRO&id=mdtv-<id>&m3u=1` trigger `MdtvService.resolveStream(id)`.
  2. The service resolves the fresh tokenized DASH URL.
  3. The proxy issues an immediate HTTP 302 redirect directly to the rewritten ClearKey `.mpd` manifest (`/api/mdtv/manifest/<id>.mpd`).
  4. The manifest rewriter (`MdtvService.getRewrittenManifest`):
     - Substitutes relative `<BaseURL>` with absolute JioTV CDN base URLs.
     - Injects W3C ClearKey UUID (`urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b`) alongside Widevine so browser players negotiate ClearKey without CDM errors.
  5. Browser players (`play_consumet.php` / `play.php`):
     - Play natively in Plyr UI (NO iframe embeds).
     - Primary engine: **Shaka Player (v4.7.11)** with `drm.clearKeys: { [keyIdHex]: keyHex }` and Akamai request filter.
     - Secondary engine: **Dash.js** with `hexToBase64Url()` encoded keys in `org.w3.clearkey.clearkeys`.
  6. In `sports.m3u`, channels include Kodi ClearKey properties:
     ```m3u
     #EXTINF:-1 tvg-id="1106" tvg-name="Star Sports 1 HD" group-title="Cricket",Star Sports 1 HD
     #KODIPROP:inputstream.adaptive.manifest_type=mpd
     #KODIPROP:inputstream.adaptive.license_type=clearkey
     #KODIPROP:inputstream.adaptive.license_key=965dc2ddb1d85138ad787999a7f30ca5:859695076e67fe961836b564db6d689c
     http://localhost:3000/live.php?token=STALKER_PRO&id=mdtv-1106&m3u=1
     ```

### 📡 B. TimStreams & epiembeds Engine (`src/services/timstreamsService.ts`)
- **Upstream Hub**: `https://timst.cfd/api/streams` & `https://exmxbxe.cfd/<slug>`
- **Deobfuscation Cipher**:
  ```typescript
  decoded += String.fromCharCode(((arr[i] ^ k1) - k2 + 256) & 255);
  ```
- **Stream Caching**: In-memory 60s TTL cache prevents upstream rate-limiting during channel surfing.

### 📡 C. Reverse Proxy Pipeline (`src/proxy.ts`)
- Cleans fake RIFF/WebP bytes prepended to TS segments (`cleanTsBuffer()`).
- Asynchronously pre-fetches live edge HLS segments into RAM cache for zero-buffer playback.
- Automatically handles token inheritance across segment chunks.

---

## 4. API Endpoints Reference

| Endpoint | Method | Purpose | Response Format |
|---|---|---|---|
| `/sports.m3u` | `GET` | Master live sports playlist with ClearKey DRM tags | `application/vnd.apple.mpegurl` |
| `/api/mdtv/manifest/:id.mpd` | `GET` | Rewritten DASH MPD manifest (Absolute BaseURL + ClearKey UUID) | `application/dash+xml` |
| `/api/play_stream/:id` | `GET` | 302 redirect to active stream (Pure Video Stream) | HTTP 302 $\rightarrow$ Stream |
| `/live.php?id=:id` | `GET` | Universal stream proxy & reverse proxy handler | Video Stream / 302 |
| `/api/sports/channels` | `GET` | JSON channel catalog for OTT dashboards | `application/json` |
| `/api/resolve_stream/:id` | `GET` | Inspects resolved stream metadata & proxy URL | `application/json` |

---

## 5. Developer & AI Agent Operating Rules

### Mandatory Practices:
1. **Never Output Embed HTML in M3U**: M3U lines must always be direct stream URLs.
2. **Preserve `assets/channels.json`**: Always use `ChannelJsonService` or merge existing custom streams when syncing new scrapers.
3. **Use Native HTTP/Axios**: Do not introduce Puppeteer or Chromium processes; all scrapers must remain headless-free and lightweight.
4. **Clean TS Buffers**: When proxying raw MPEG-TS, always pass buffers through `cleanTsBuffer()` to strip non-standard sync bytes.

### Common Troubleshooting:
- **Stream returns 403 Forbidden**: Verify that `__hdnea__` token is appended to the manifest request.
- **Kodi / VLC black screen on DASH**: Verify that `#KODIPROP:inputstream.adaptive.license_type=clearkey` and `#KODIPROP:inputstream.adaptive.license_key` lines are present directly below `#EXTINF`.
- **EADDRINUSE Port 3000**: Run `Stop-Process -Name node -Force` in PowerShell before launching.
