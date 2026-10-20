// Stalker Pro Advanced PWA Service Worker
const CACHE_NAME = 'stalker-pro-cache-v7';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/stalker_pro_infinity.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA SW] Pre-caching offline essentials');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Precache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[PWA SW] Deleting stale cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip video streaming chunks, party mode, and admin scripts from SW caching
  if (
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.includes('/live.php') ||
    url.pathname.includes('/api/proxy') ||
    url.pathname.includes('/api/party') ||
    url.pathname.includes('/api/admin') ||
    url.pathname.includes('party-mode.js') ||
    url.pathname.includes('hari.js') ||
    url.pathname.includes('hari.html') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-first for HTML pages, APIs, and JavaScript files
  if (
    event.request.mode === 'navigate' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.js') ||
    url.search.includes('v=') ||
    event.request.destination === 'script'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              // Offline fallback response for navigation
              return new Response(
                `<!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Offline | Stalker Pro</title>
                  <style>
                    body { background: #030712; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .box { padding: 32px; border: 1px solid #374151; border-radius: 24px; background: #111827; max-width: 400px; }
                    h1 { color: #ef4444; font-size: 24px; margin-bottom: 8px; }
                    p { color: #9ca3af; font-size: 14px; line-height: 1.5; }
                    button { margin-top: 16px; background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <div class="box">
                    <h1>You're Currently Offline</h1>
                    <p>Stalker Pro requires an internet connection to stream live TV and movies. Please reconnect and reload.</p>
                    <button onclick="window.location.reload()">Retry Connection</button>
                  </div>
                </body>
                </html>`,
                { headers: { 'Content-Type': 'text/html' } }
              );
            }
            return new Response('/* Offline fallback */', { headers: { 'Content-Type': 'application/javascript' } });
          });
        })
    );
    return;
  }

  // Cache-first for images and fonts only
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
