// JobTrack Service Worker — GitHub Pages Optimized
// VERSION: v2  |  Updated: 2025-06-09T14:37Z

const CACHE_NAME = 'jobtrack-v4';
const APP_ASSETS = [
    '/Job-Tracker/icon-192.png',
    '/Job-Tracker/icon-512.png'
];

// ─── INSTALL ───────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_ASSETS).catch(() => {
                // Partial failure — proceed anyway, assets can be updated later
            });
        }).then(() => {
            // Always register the new service worker immediately
            return self.skipWaiting();
        })
    );
});

// ─── ACTIVATE ──────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            // Delete all old cache versions (keep only CACHE_NAME)
            const promises = keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k));
            return Promise.all(promises);
        }).finally(() => {
            // Immediately take control of ALL open tabs — no more stale serving
            return self.clients.claim();
        })
    );
});

// ─── FETCH ROUTING ──────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Supabase / API calls: network-only (no stale cache for data)
    if (url.hostname.includes('supabase')) {
        event.respondWith(networkOnlyStrategy(event.request));
        return;
    }

    // Static assets (.css, .js, .json, images): network-first with cache fallback
    // THIS IS THE FIX FOR GITHUB PAGES STALE CACHE:
    // Always check server first → get new files immediately after deploy
    if (/\.css$|\.js$|\.json$|\.png$/.test(url.pathname)) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }

    // Navigation / HTML pages: stale-while-revalidate
    // Serve cached version instantly, then update cache in background
    if (event.request.mode === 'navigate') {
        event.respondWith(offlineFallbackStrategy(event.request));
        return;
    }

    // Everything else: cache-first with network fallback
    const fallback = caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).catch(() => new Response('', {status: 404}));
    });
    event.respondWith(fallback);
});

// ─── STRATEGY: NETWORK-FIRST FOR ASSETS ──────────────
// Fixes GitHub Pages stale cache issue completely.
function networkFirstStrategy(request) {
    return fetch(request)
        .then((networkResponse) => {
            // Got fresh version from server — great!
            if (networkResponse.ok) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, clone);
                });
            }
            return networkResponse;
        })
        .catch(() => {
            // Network failed — fall back to what we have cached
            return caches.match(request);
        });
}

// ─── STRATEGY: OFFLINE FALLBACK FOR NAVIGATION ───────
// Stale-while-revalidate: serve instantly, update in background
function offlineFallbackStrategy(request) {
    const cacheCopy = caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request);
    });

    // In background, try to fetch fresh version — if available, replace cache
    fetch(request.clone())
        .then((networkResponse) => {
            if (networkResponse.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, networkResponse.clone());
                    
                    // Notify all open clients that update is ready — they can reload silently
                    return self.clients.matchAll().then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: 'UPDATE_AVAILABLE',
                                timestamp: Date.now()
                            });
                        });
                    });
                }).catch(() => {}); // Silent fail for background update notify
            }
        })
        .catch(() => {}); // Silently ignore — we still serve cached

    return cacheCopy.catch(() => {
        // Ultimate fallback: root index.html as a page with message "Go offline"
        return caches.match('/Job-Tracker/');
    });
}

// ─── STRATEGY: NETWORK-ONLY FOR SUPABASE / APIs ──────
function networkOnlyStrategy(request) {
    return fetch(request)
        .catch(() => new Response('Network unavailable — offline', {status: 503}));
}

// ─── BACKGROUND SYNC (future extensibility) ──────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification('JobTrack Update', {
            body: data.message || 'New updates available',
            icon: '/icon-192.png'
        })
    );
});

// Allow main thread to tell SW to skip waiting (manual refresh)
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
