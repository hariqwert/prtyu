# 📡 Comprehensive Analysis: FanCode & SonyLIV Streaming Architecture, Failures & Implemented Fixes

---

## 1. Executive Summary

This document details the streaming architecture, technical failures, root cause analysis, and engineered fixes for **FanCode Live Matches** and **SonyLIV Live Events** within the **remix-hl / Stalker Pro 2.0** ecosystem.

It explains why live CDN streams from these providers behave differently between **cloud-hosted web players** (Cloud Run / VPS) and **local client video players** (Kodi, VLC, TiviMate, OTT Navigator), and details how the platform addresses these challenges.

---

## 2. Technical Anatomy of the Problem

### A. Upstream CDN Edge Infrastructure
Both FanCode and SonyLIV rely on enterprise tier Content Delivery Networks (CDNs):
* **FanCode**: Google Cloud MediaCDN (`in-mc-flive.fancode.com`) and Akamai CDN (`in-ak-flive.akamaized.net`, `dai-fancode.akamaized.net`).
* **SonyLIV**: Akamai Live Packaging (`sonyliv.akamaized.net`, `slivcdn.com`, `sonydaimenew`).

### B. The Geo-Fence Mechanism (TCP-Level vs. HTTP-Level)
Commercial live sports broadcasters protect broadcast rights through regional geoblocking:
1. **TCP Socket Level IP Inspection**:
   * Google Cloud MediaCDN and Akamai evaluate the client's **real TCP/TLS source IP address** at the network socket layer.
   * If the connecting IP belongs to a commercial cloud datacenter ASN (Google Cloud, AWS, DigitalOcean, Hetzner, Microsoft Azure) or originates outside India, the CDN immediately drops the request with **`HTTP 403 Forbidden`** or **`HTTP 451 Unavailable For Legal Reasons`**.
   * Headers like `x-client-region: SG` or `x-client-region: US` are appended to the response by Google-Edge-Cache before terminating the connection.

2. **Dynamic Akamai & MediaCDN Token Lifetime**:
   * Streams are signed with cryptographic tokens in the URL:
     ```text
     ?hdntl=Expires=1790499279~_GO=Generated~acl=/mumbai/4249583_*~Signature=AUh_zpUlHDSI8AXAEjs...
     __hdnea__=st=1790422203~exp=1790443803~acl=/*~data=...~hmac=...
     ```
   * These tokens have short expiration windows (typically 1 to 4 hours). If a match is scraped hours before kickoff, the token may expire by the time the user clicks Play.

3. **Master Manifest vs. Child Variant Playlists**:
   * A live stream consists of a master manifest (`index.m3u8`) defining resolution levels:
     ```m3u
     #EXTM3U
     #EXT-X-STREAM-INF:BANDWIDTH=446936,RESOLUTION=426x240
     https://in-mc-flive.fancode.com/mumbai/4249583_english_hls/240p.m3u8?hdntl=...
     #EXT-X-STREAM-INF:BANDWIDTH=3322120,RESOLUTION=1920x1080
     https://in-mc-flive.fancode.com/mumbai/4249583_english_hls/1080p.m3u8?hdntl=...
     ```
   * If the master playlist is fetched through an edge proxy (e.g. Cloudflare Pages relay), the master playlist loads (`HTTP 200`), but as soon as the video player requests a specific child quality manifest (`1080p.m3u8`) or media chunks (`segment01.ts`), it hits the MediaCDN origin directly and receives `HTTP 403`.

---

## 3. Why Prior Approaches Failed

### ❌ Attempt 1: Server-Side Reverse Proxy (`/api/proxy/fancode?url=...`)
* **What was done**: The server received the stream URL, made an outbound HTTP request using Axios, and streamed the bytes back to the browser with open CORS headers.
* **Why it failed**: The server itself is running in a cloud datacenter (e.g. `34.34.254.3` in Google Cloud Asia-Southeast1). When the server requested `in-mc-flive.fancode.com`, MediaCDN detected the datacenter IP and returned `HTTP 403`. The proxy had no media bytes to forward.

### ❌ Attempt 2: HTTP Client IP Spoofing Headers
* **What was done**: Added `X-Forwarded-For: 49.36.100.1`, `True-Client-IP: 49.36.100.1`, and `X-Real-IP: 49.36.100.1` (Indian ISP IP pool) to the outbound proxy request headers.
* **Why it failed**: Enterprise CDNs ignore client-supplied IP headers from unauthenticated forwarders. They enforce geo-rules strictly on the physical TCP socket IP address established during the TLS 1.3 handshake.

### ❌ Attempt 3: Cloudflare Pages Edge Relays (`dai-fancode.pages.dev`)
* **What was done**: Sourced master manifests from Cloudflare Pages relays (`https://dai-fancode.pages.dev/mumbai/.../index.m3u8`).
* **Why it was partial/failed**: The Cloudflare worker successfully delivered the master `.m3u8` index file. However, the child stream URLs inside the file pointed directly to `https://in-mc-flive.fancode.com/.../1080p.m3u8`. When the browser requested these child manifests, MediaCDN blocked them with 403.

### ❌ Attempt 4: HLS.js Auto-Reconnect & Multi-Bitrate Cycling
* **What was done**: The frontend player had a watchdog that retried stream loading 3 times whenever a network error was detected.
* **Why it degraded UX**: Because the master playlist listed 6 separate bitrates (240p, 360p, 480p, 540p, 720p, 1080p), `Hls.js` treated 403 errors on child variants as `NON-FATAL levelLoadError` and attempted to downgrade sequentially through all 6 levels. This produced a barrage of console warnings and kept the user waiting through 3 full reconnect cycles before displaying any feedback.

---

## 4. Engineering Solutions & Fixes Implemented

```
                       ┌──────────────────────────────────────────────────────────┐
                       │                     User Client Types                    │
                       └───────────────┬──────────────────────────┬───────────────┘
                                       │                          │
                    Local Players      │                          │ Cloud Web Player
              (Kodi, TiviMate, VLC,    │                          │ (play_consumet.php)
               OTT Navigator on TV)    │                          │
                                       ▼                          ▼
                       ┌─────────────────────────┐    ┌───────────────────────────┐
                       │ HTTP 302 Found Handoff  │    │ Instant 403/451 Detection │
                       │ (/live.php, /sports.m3u)│    │ (Non-blocking UI error)   │
                       └───────────────┬─────────┘    └─────────────┬─────────────┘
                                       │                            │
                                       ▼                            ▼
                       ┌─────────────────────────┐    ┌───────────────────────────┐
                       │ Direct Local ISP Connect│    │ Suggest 24/7 DASH/ClearKey│
                       │ (Bypasses Cloud Server) │    │ Channels (Star 1-3, Sony) │
                       └─────────────────────────┘    └───────────────────────────┘
```

### ✅ Fix 1: Upstream Source Feed Synchronization
* **Files Modified**: `src/services/fancodeService.ts`, `src/services/jtvService.ts`
* **Changes**:
  * Updated upstream GitHub endpoints to match active repositories (`doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u` & `data/fancode.json`).
  * Added URL pipe sanitizer (`streamUrl.split('|')[0]`) to strip appended User-Agent flags that broke URL parsing.
  * Added fallback providers: `drmlive/fancode-live-events`, `Hexa-C/fancode`, and `allinonereborn2.online`.

### ✅ Fix 2: Direct HTTP 302 Handoff for External Players
* **Files Modified**: `server.ts`, `src/proxy.ts`, `src/routes/sportsM3u.ts`
* **Changes**:
  * For CDNs that enforce residential IP checks (`in-mc-flive.fancode.com`, `in-ak-flive.akamaized.net`, `flive.fancode.com`, `acek-cdn`, `cloudmelvaro`), the backend **does not proxy bytes**.
  * Instead, it returns an **`HTTP 302 Found`** redirect containing the full tokenized upstream CDN URL.
  * When a user in India opens the playlist on Kodi, TiviMate, OTT Navigator, or VLC on their home Wi-Fi/mobile network, their player follows the 302 redirect and connects to the CDN using their Indian ISP IP address.

### ✅ Fix 3: Instant 403/451 Interception in the Web Player
* **Files Modified**: `play_consumet.php`
* **Changes**:
  * Added an interceptor inside `hls.on(Hls.Events.ERROR)`.
  * If `data.response.code === 403` or `data.response.code === 451` on any manifest or level load request:
    1. Immediately terminates the retry loop (`hls.destroy()`).
    2. Clears the spinning loader.
    3. Displays a clear message:
       > *"⚠️ Regional Stream Geoblocked (403): This live feed is geo-restricted to Indian residential IP connections by the upstream CDN. Kodi, TiviMate, and VLC will connect directly via your local network. You can also watch live sports on Star Sports 1 HD or Sony Ten channels."*
    4. Prevents the player from freezing or cycling through 18 redundant level requests.

### ✅ Fix 4: Resilient 24/7 Live Channels (Star Sports & Sony Ten)
* **Channels**: Star Sports 1 HD, Star Sports 2, Star Sports Select 1/2, Sony Sports Ten 1 HD, Sony Sports Ten 2 HD, Sony Sports Ten 3 HD (Hindi), Sony Sports Ten 4 HD (Tamil/Telugu), Sony Sports Ten 5 HD.
* **Format**: Dynamic DASH manifests with W3C ClearKey DRM keys injected natively via Shaka Player / Dash.js.
* **Advantage**: These 24/7 channels use JioTV Akamai tokens (`__hdnea__`) managed and auto-renewed by `src/services/mdtvService.ts` and `src/services/jtvService.ts`, remaining fully operational on both cloud web players and external IPTV apps.

---

## 5. Playback Platform Compatibility Matrix

| Stream Type | Web Player (Cloud Hosted) | External Players (Kodi / TiviMate / VLC) | Recommended Action |
|---|---|---|---|
| **FanCode Live Matches** | ⚠️ Blocked by CDN (if IP non-Indian) | ✅ **Works 100%** via `/sports.m3u` or `/live.php` (Direct 302) | Use Kodi/TiviMate or connect residential proxy |
| **SonyLIV Live Fixtures** | ⚠️ Blocked by CDN (if IP non-Indian) | ✅ **Works 100%** via `/sports.m3u` (Direct 302) | Use Kodi/TiviMate or 24/7 Sony Ten channels |
| **Star Sports 1–3 HD (DASH)** | ✅ **Works 100%** (ClearKey Shaka Player) | ✅ **Works 100%** (`#KODIPROP` DRM ClearKey) | Play directly in web player or Kodi |
| **Sony Sports Ten 1–5 HD** | ✅ **Works 100%** (ClearKey Shaka Player) | ✅ **Works 100%** (`#KODIPROP` DRM ClearKey) | Play directly in web player or Kodi |
| **TimStreams Live Channels** | ✅ **Works 100%** (XOR Deobfuscated HLS) | ✅ **Works 100%** (Proxied clean MPEG-TS) | Play directly in web player |
| **Movies, TV Shows & Anime** | ✅ **Works 100%** (TorrServer + Bingr API) | ✅ **Works 100%** | Play directly in web player |

---

## 6. Server-Side Indian Exit Gateway (VPN & SOCKS5 / HTTP Proxy)

To play geoblocked FanCode and SonyLIV live streams directly inside the **cloud web player**, you can route server outbound traffic through an Indian exit point (VPN SOCKS5 forwarder or HTTP residential proxy):

### Supported Protocols & Environment Variables
Add any of the following to your server `.env` configuration:

```bash
# Option A: SOCKS5 / SOCKS5H Indian VPN Exit Node (WireGuard/OpenVPN SOCKS tunnel)
INDIAN_VPN_PROXY_URL=socks5://user:pass@in-vpn-node.example.com:1080

# Option B: Residential Indian HTTP/HTTPS Proxy
RESIDENTIAL_PROXY_URL=http://user:pass@indian-residential-proxy.net:8080

# Option C: Local SOCKS5 Proxy Bridge (e.g. Shadowsocks / WireGuard proxy sidecar)
INDIAN_PROXY_URL=socks5://127.0.0.1:1080
```

### How the Engine Handles It
* **`getOutboundProxyAgent()`**: Automatically instantiates `SocksProxyAgent` for `socks5://` / `socks4://` schemes and `HttpsProxyAgent` for `http://` / `https://` schemes.
* When configured, the backend intercepts MediaCDN (`in-mc-flive.fancode.com`) and Akamai requests, pulling the `.m3u8` playlists and MPEG-TS media segments through the Indian gateway and streaming them directly to your browser with full CORS support.
* If no outbound proxy is configured, the server defaults to the **`HTTP 302 Found`** handoff so external apps (Kodi, TiviMate, VLC) use your local internet connection.

---

## 7. Manifest-Only Proxy with Direct Akamai/MediaCDN Segment Delivery (DRMLive / Cee-TV Model)

To allow users in India to stream FanCode and SonyLIV inside the web player without server-side video proxying latency or cloud IP blocks, the platform implements the **`cee-tv / drmlive`** manifest proxy pattern:

```text
User in India → Web Player (play_consumet.php)
                      ↓
           /stream_proxy.php?url=...
                      ↓
   (Only fetches the lightweight .m3u8 text playlist & injects CORS)
                      ↓
   Resolves all relative paths to direct absolute Akamai / MediaCDN URLs
                      ↓
User’s browser downloads .ts video segments DIRECTLY from Akamai / MediaCDN
```

### Key Advantages:
1. **Zero Server Video Bandwidth**: The cloud server only fetches and delivers small `.m3u8` text manifests (~1 KB).
2. **Native Full HD Quality**: The browser downloads `.ts` chunks directly from Google MediaCDN (`in-mc-flive.fancode.com`) or Akamai (`in-ak-flive.akamaized.net`).
3. **Residential IP Match**: Since the user's browser is on an Indian residential/mobile network, Akamai and MediaCDN accept the segment requests with `200 OK`.

