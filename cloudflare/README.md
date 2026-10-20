# 🛡️ Cloudflare Edge Security Worker (Citadel Edge Shield)

Configured for **Google AI Studio Origin**: `https://ellamoonu.ai.studio/`

This Cloudflare Worker operates as an edge reverse proxy and firewall directly in front of your Google AI Studio instance. It absorbs bot traffic, enforces rate limiting, strips malicious exploit probes, and hides your underlying Google AI Studio hosting URL.

---

## ⚡ What It Protects

1. **Origin Obfuscation**: Visitors access your Cloudflare Worker URL (e.g., `https://yourdomain.com` or `https://citadel-edge-shield.yourname.workers.dev`). Your Google AI Studio URL (`ellamoonu.ai.studio`) is never exposed in headers or browser address bars.
2. **Malicious Vulnerability Probes**: Instantly drops probes for `.env`, `.git`, `wp-login.php`, `phpmyadmin`, `HNAP1`, etc. with HTTP 403 before reaching Google Cloud.
3. **Bad Bot & Scanner Neutralization**: Blocks automated tools like `sqlmap`, `nikto`, `masscan`, `zgrab`, `censys`, `shodan` based on User-Agent signatures.
4. **Multi-Tier Edge Rate Limiting**:
   - **Admin Console & Gate Endpoints (`/api/admin/*`, `/hari`)**: Max 20 req/min per IP.
   - **Media Scraper API (`/api/bingr/*`)**: Max 60 req/min per IP.
   - **Stream Video Manifests (`/live.php`, `/stream_proxy.php`)**: Max 400 req/min per IP.
   - **Public Traffic**: Max 120 req/min per IP.
   - Exceeded traffic receives `HTTP 429 Too Many Requests` with `Retry-After` headers.
5. **Anti-Leech / Anti-Scrape Protection**: Blocks cross-origin websites from hotlinking or framing your `/api/bingr/stream` endpoint (`Sec-Fetch-Site: cross-site`).
6. **Automatic Google AI Studio Host Routing & Redirect Rewriting**: Sets `Host: ellamoonu.ai.studio` so Google Cloud accepts the traffic, and rewrites HTTP 302 redirects back to your Cloudflare URL.

---

## 🚀 How to Deploy (Takes 2 Minutes — 100% Free)

### Step 1: Create Worker in Cloudflare
1. Log into your **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Click **Workers & Pages** in the left sidebar $\rightarrow$ click **Create Application**.
3. Click **Create Worker**.
4. Name your worker (for example: `citadel-shield`) and click **Deploy**.

### Step 2: Paste the Pre-Configured Code
1. Click **Edit Code** in the top right.
2. Delete everything inside the editor.
3. Copy all code from [`cloudflare/worker.js`](worker.js) and paste it into the editor.
   *(The code is already pre-configured with `ORIGIN_HOST: "ellamoonu.ai.studio"`!)*
4. Click **Deploy** in the top right.

### Step 3: Access & Test Your Site
Your Cloudflare Worker is now live!
- You can access your platform securely through your Cloudflare Worker URL:
  `https://citadel-shield.<your-account>.workers.dev`
- **(Optional) Use Your Own Custom Domain**:
  If you have a domain in Cloudflare (e.g. `mysite.com`):
  1. In Cloudflare, go to **Websites** $\rightarrow$ select your domain.
  2. Go to **Workers Routes** $\rightarrow$ click **Add Route**.
  3. Route: `*mysite.com/*`
  4. Worker: Select `citadel-shield`.
  5. Click **Save**.
