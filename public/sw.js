const TILE_CACHE = 'khopripada-map-tiles-v1';
const APP_CACHE = 'khopripada-app-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/data/roads.geojson',
  '/data/facilities.csv',
  '/data/issues.csv',
  '/data/facilities_augmented.csv',
  '/data/issues_augmented.csv',
];

// Install: pre-cache critical shell assets, GeoJSON, icons, and CSVs immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching critical village GIS assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Non-critical precache failure (proceeding):', err);
        return self.skipWaiting();
      })
  );
});

// Activate: purge legacy caches while preserving tile cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== TILE_CACHE && name !== APP_CACHE) {
              console.log('[SW] Purging stale cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Engine: Cache-First for Map Raster Tiles, Network-First with Cache fallback for Data/Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Navigation Fallback for SPA (Full Offline Navigation)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = (await caches.match('/index.html')) || (await caches.match('/'));
        if (cached) return cached;
        return new Response('Offline: Smart Village GIS App Shell Not Cached Yet', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    return;
  }

  // 2. Map Raster & Vector Tiles: STRICT CACHE-FIRST STRATEGY
  const isMapTile =
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('opentopomap.org');

  if (isMapTile) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // If offline and tile was not cached yet, return a clean dark placeholder SVG so Leaflet never breaks
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
              <rect width="256" height="256" fill="#132228" stroke="#334B56" stroke-width="1"/>
              <text x="128" y="128" fill="#38BDF8" font-size="11" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">Offline Tile</text>
            </svg>`,
            {
              status: 200,
              headers: { 'Content-Type': 'image/svg+xml' },
            }
          );
        }
      })
    );
    return;
  }

  // 3. Application Assets, GeoJSON, CSV Data, Fonts, Media: Network-First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET' &&
          (url.pathname.startsWith('/data/') ||
            url.pathname.startsWith('/assets/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.json') ||
            url.pathname.endsWith('.geojson') ||
            url.pathname.endsWith('.csv') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css'))
        ) {
          const clone = networkResponse.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline: Content unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
