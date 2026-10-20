// ==UserScript==
// @name         EmbedIndia Stream Catcher -> TorrStream
// @namespace    https://github.com/yourok/torrserver
// @version      1.0.0
// @description  Automatically intercepts decrypted .m3u8 streams from embedindia.st and sends them to your local TorrStream server for seamless VLC/web playback.
// @author       TorrStream
// @match        *://embedindia.st/*
// @match        *://*.embedindia.st/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(function () {
  'use strict';

  const TORRSTREAM_HOST = 'http://localhost:3000';
  let capturedStream = null;

  // Extract slug from URL pathname (e.g. /embed/cryptocom-ufc-331-van-vs-pantoja-2-29012)
  function getChannelSlug() {
    const p = window.location.pathname.replace(/^\/embed\//i, '').replace(/\.html$/i, '').trim();
    return p || 'embedindia-stream';
  }

  // Send captured stream to local TorrStream server
  function notifyServer(slug, streamUrl) {
    if (capturedStream === streamUrl) return;
    capturedStream = streamUrl;

    const payload = JSON.stringify({ slug, url: streamUrl });

    // Try standard fetch first
    fetch(`${TORRSTREAM_HOST}/api/live/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).then(res => res.json()).then(data => {
      console.log('[TorrStream Catcher] Ingested successfully:', data);
      showCaptureHUD(slug, streamUrl, data.playerUrl);
    }).catch(() => {
      // Fallback to GM_xmlhttpRequest if browser blocks mixed/cross-origin fetch
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${TORRSTREAM_HOST}/api/live/ingest`,
          headers: { 'Content-Type': 'application/json' },
          data: payload,
          onload: (r) => {
            try {
              const d = JSON.parse(r.responseText);
              showCaptureHUD(slug, streamUrl, d.playerUrl);
            } catch (e) {
              showCaptureHUD(slug, streamUrl, `${TORRSTREAM_HOST}/api/live/${slug}.m3u8`);
            }
          },
          onerror: () => {
            showCaptureHUD(slug, streamUrl, `${TORRSTREAM_HOST}/api/live/${slug}.m3u8`);
          }
        });
      } else {
        showCaptureHUD(slug, streamUrl, `${TORRSTREAM_HOST}/api/live/${slug}.m3u8`);
      }
    });
  }

  function handleFoundStream(url) {
    if (!url || typeof url !== 'string') return;
    if (!url.includes('.m3u8')) return;
    if (url.includes('adcash') || url.includes('adexchangeclear')) return; // Ignore ad networks

    console.log('%c[TorrStream Catcher] 🎯 CAPTURED M3U8 STREAM:', 'background: #8b5cf6; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;', url);
    notifyServer(getChannelSlug(), url);
  }

  // ── 1. Hook fetch() ────────────────────────────────────────────────────────
  const origFetch = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).fetch;
  (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).fetch = async function (...args) {
    const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (reqUrl.includes('.m3u8')) {
      handleFoundStream(reqUrl);
    }
    const res = await origFetch.apply(this, args);
    return res;
  };

  // ── 2. Hook XMLHttpRequest ──────────────────────────────────────────────────
  const origXHROpen = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).XMLHttpRequest.prototype.open;
  (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string' && url.includes('.m3u8')) {
      handleFoundStream(url);
    }
    return origXHROpen.call(this, method, url, ...rest);
  };

  // ── 3. Hook HTMLMediaElement.src (HTML5 <video>) ───────────────────────────
  const targetWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const videoProto = targetWin.HTMLMediaElement?.prototype;
  if (videoProto) {
    const origSrcDescriptor = Object.getOwnPropertyDescriptor(videoProto, 'src');
    if (origSrcDescriptor && origSrcDescriptor.set) {
      Object.defineProperty(videoProto, 'src', {
        set: function (val) {
          if (typeof val === 'string' && val.includes('.m3u8')) {
            handleFoundStream(val);
          }
          return origSrcDescriptor.set.call(this, val);
        },
        get: origSrcDescriptor.get,
        configurable: true
      });
    }
  }

  // ── 4. Hook JWPlayer instance creation & setup ────────────────────────────
  let jwCheckTimer = setInterval(() => {
    const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (w.jwplayer && !w.jwplayer.__torr_hooked) {
      w.jwplayer.__torr_hooked = true;
      const origJw = w.jwplayer;
      w.jwplayer = function (...jwArgs) {
        const playerInst = origJw.apply(this, jwArgs);
        if (playerInst && playerInst.setup && !playerInst.__torr_setup_hooked) {
          playerInst.__torr_setup_hooked = true;
          const origSetup = playerInst.setup;
          playerInst.setup = function (cfg) {
            if (cfg?.file && cfg.file.includes('.m3u8')) handleFoundStream(cfg.file);
            if (cfg?.playlist?.[0]?.file && cfg.playlist[0].file.includes('.m3u8')) handleFoundStream(cfg.playlist[0].file);
            if (cfg?.playlist?.[0]?.sources) {
              cfg.playlist[0].sources.forEach(s => { if (s?.file?.includes('.m3u8')) handleFoundStream(s.file); });
            }
            return origSetup.call(this, cfg);
          };
        }
        return playerInst;
      };
      Object.assign(w.jwplayer, origJw);
    }
  }, 200);

  // ── 5. Render Glassmorphic Ingest HUD on Page ──────────────────────────────
  function showCaptureHUD(slug, rawUrl, proxyUrl) {
    if (document.getElementById('torrstream-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'torrstream-hud';
    hud.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        background: rgba(15, 18, 28, 0.95);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(139, 92, 246, 0.5);
        border-radius: 14px;
        padding: 16px 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(139, 92, 246, 0.3);
        color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        max-width: 380px;
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <style>
          @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          .ts-btn {
            background: #8b5cf6; color: white; border: none; padding: 7px 12px;
            border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;
            transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
          }
          .ts-btn:hover { background: #7c3aed; transform: translateY(-1px); }
          .ts-btn-outline {
            background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15);
          }
          .ts-btn-outline:hover { background: rgba(255, 255, 255, 0.16); color: white; }
        </style>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🚀</span>
            <strong style="color: #38bdf8; font-size: 14px;">TorrStream Stream Captured!</strong>
          </div>
          <button onclick="this.closest('#torrstream-hud').remove()" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;">&times;</button>
        </div>
        <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 11px; line-height: 1.4;">
          <strong>Channel:</strong> <span style="color: #cbd5e1;">${slug}</span><br>
          Stream is ingested and proxying on port 3000.
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="ts-btn" id="ts-btn-vlc">📋 Copy VLC URL</button>
          <button class="ts-btn ts-btn-outline" id="ts-btn-play">▶ Play Locally</button>
          <button class="ts-btn ts-btn-outline" id="ts-btn-raw">📋 Copy Raw</button>
        </div>
      </div>
    `;

    document.body.appendChild(hud);

    document.getElementById('ts-btn-vlc').onclick = () => {
      navigator.clipboard.writeText(proxyUrl);
      alert(\`VLC Stream URL copied:\\n\${proxyUrl}\\n\\nOpen VLC -> Ctrl+N -> Paste & Play\`);
    };

    document.getElementById('ts-btn-play').onclick = () => {
      window.open(proxyUrl, '_blank');
    };

    document.getElementById('ts-btn-raw').onclick = () => {
      navigator.clipboard.writeText(rawUrl);
      alert('Raw decrypted .m3u8 URL copied!');
    };
  }

  console.log('[TorrStream Catcher] Active on', window.location.href);
})();
