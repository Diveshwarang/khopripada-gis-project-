const TILE_CACHE = 'khopripada-tiles-v1';
const APP_CACHE = 'khopripada-app-v3';

// Install: claim immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: purge any older caches immediately so stale HTML/JS is never served
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== TILE_CACHE && name !== APP_CACHE) {
              console.log('Purging stale cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Pure Network-First with Cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Map Raster Tiles (Network-First with Tile Cache fallback)
  const isMapTile =
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('opentopomap.org');

  if (isMapTile) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(TILE_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(null, { status: 504, statusText: 'Tile Offline' });
        })
    );
    return;
  }

  // Strategy 2: For Local Development & Code Updates (ALWAYS Network-First)
  // Ensures user NEVER gets stuck with a stale cached bundle
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Only cache successful GET responses for assets/data
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET' &&
          (url.pathname.startsWith('/data/') || url.pathname.startsWith('/assets/'))
        ) {
          const clone = networkResponse.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        // If completely offline, serve from cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline: Content not cached yet', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
