// JobTrack Service Worker (Stage 1 Refactor)
// Dynamic cache names derived from app-version.json
// Updated: 2026-06-11

const VERSION_FILE = "/app-version.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch(VERSION_FILE, { cache: "no-store" })
      .then((resp) => resp.json())
      .catch(() => ({ build: String(Date.now()), timestamp: String(Date.now()) }))
      .then((verData) => {
        // Build dynamic cache names from version data - every deploy gets unique keys
        const CACHE_NAME = "jobtrack-assets-" + verData.build + "-" + (verData.timestamp || Date.now());
        
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.addAll([
            "/Job-Tracker/icon-192.png",
            "/Job-Tracker/icon-512.png"
          ]).catch((err) => console.error("SW install partial:", err.message || "unknown"));
        });
      })
  );
  self.skipWaiting();   // Activate immediately so new SW takes effect.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Delete every cache that does NOT match our dynamic naming convention - this purges old stale caches automatically
      const toKeep   = keys.filter((k) => k.startsWith("jobtrack-assets-") || k.startsWith("jobtrack-nav-"));
      const toRemove = keys.filter((k) => !toKeep.includes(k));
      
      console.log("[SW] Activated. Keeping:", toKeep.length, "caches. Purging old caches.");
      
      return Promise.all(toRemove.map((k) => caches.delete(k)));
    }).then(() => {
      // Claim all clients so stale pages are replaced immediately.
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // --- Supabase / API calls: network-only ---
  if (url.hostname.includes("supabase")) {
    event.respondWith(networkOnlyStrategy(event.request));
    return;
  }

  // --- Static assets (css, js, json, png): network-first with cache fallback ---
  if (/\.css$|/\.png$/.test(url.pathname) || /\.(js|json)$/.test(url.pathname)) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // --- Navigation / HTML: stale-while-revalidate ---
  if (event.request.mode === "navigate") {
    event.respondWith(offlineFallbackStrategy(event.request));
    return;
  }

  // --- Everything else: cache-first with network fallback.
});

// ─── NETWORK-FIRST STRATEGY FOR STATIC ASSETS ────────

function networkFirstStrategy(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return new Response(response.body, { 
        status: response.status, 
        statusText: response.statusText, 
        headers: response.headers 
      });
    })
    .catch(() => {
      // Fallback to cached version (may be stale on GitHub Pages).
      return caches.match(request) || new Response("Offline", {status: 408});
    });
}

// ─── STALE-WHILE-REVALIDATE STRATEGY FOR NAVIGATION ──

function offlineFallbackStrategy(request) {
  const cachedPromise = caches.open(CACHE_NAME).then((cache) => cache.match(request));

  // In the background, try to get a fresh copy. If successful, update the nav cache.
  fetch(request.clone())
    .then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));

        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "UPDATE_AVAILABLE", timestamp: Date.now() });
          });
        }).catch(() => {});
      }
    })
    .catch(() => {});  // Silently ignore — we still serve the cached version.

  return cachedPromise;
}

// ─── NETWORK-ONLY STRATEGY (Supabase / API) ──────────

function networkOnlyStrategy(request) {
  return fetch(request).catch(() => new Response("Offline", { status: 503 }));
}

// ─── MESSAGE HANDLER (force-update button support) ───

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data?.type === "PURGE_ALL_CACHE") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
      // Force reload of all tabs after cache purge.
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    }).catch(() => {});
  } else if (event.data?.type === "SKIP_INSTALL_CHECK") {
    // Allow main thread to skip install-time fetch when offline.
    console.log("[SW] Skipping install check");
  }
});

// ─── PUSH NOTIFICATION CALLBACK (for future use) ──────

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification("JobTrack Update", {
      body: data.message || "updates available",
      icon: "/icon-192.png"
    })
  );
});
