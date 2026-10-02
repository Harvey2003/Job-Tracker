/* JobTrack Service Worker
 * ---------------------------------------------------------------
 * VERSION is overwritten by build.js on every build.
 * Do not edit it manually — edit build.js and rebuild.
 */

const VERSION = '20261002062746';
const CACHE = `jobtrack-${VERSION}`;

const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json'
];

// ---------- install ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE);
            // Fetch with cache: 'reload' so we never precache a stale HTTP-cached copy.
            await Promise.all(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        const req = new Request(url, { cache: 'reload' });
                        const res = await fetch(req);
                        if (res && res.ok) await cache.put(url, res.clone());
                    } catch (e) {
                        // Offline or missing — skip. The runtime fetch handler will fill gaps.
                    }
                })
            );
            await self.skipWaiting();
        })()
    );
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => k !== CACHE)
                    .map((k) => caches.delete(k))
            );
            await self.clients.claim();
        })()
    );
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Only GET, same-origin.
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    const path = url.pathname.toLowerCase();
    const networkFirst =
        path.endsWith('.html') ||
        path.endsWith('.css')  ||
        path.endsWith('.js')   ||
        path.endsWith('.json') ||
        path.endsWith('/') ||
        path === '' ;

    if (networkFirst) {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req);
                    if (fresh && fresh.ok) {
                        const cache = await caches.open(CACHE);
                        cache.put(req, fresh.clone());
                    }
                    return fresh;
                } catch (e) {
                    const cached = await caches.match(req);
                    if (cached) return cached;
                    // Last resort for navigations: serve cached index.
                    if (req.mode === 'navigate') {
                        const fallback = await caches.match('./index.html');
                        if (fallback) return fallback;
                    }
                    throw e;
                }
            })()
        );
    } else {
        event.respondWith(
            (async () => {
                const cached = await caches.match(req);
                if (cached) return cached;
                try {
                    const fresh = await fetch(req);
                    if (fresh && fresh.ok) {
                        const cache = await caches.open(CACHE);
                        cache.put(req, fresh.clone());
                    }
                    return fresh;
                } catch (e) {
                    throw e;
                }
            })()
        );
    }
});

// ---------- message ----------
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});