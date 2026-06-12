const VERSION_FILE = "/app-version.json";
let currentCacheName = null;

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch(VERSION_FILE, { cache: "no-store" })
      .then((resp) => resp.json())
      .catch(() => ({ build: String(Date.now()), timestamp: String(Date.now()) }))
      .then((verData) => {
        currentCacheName = "jobtrack-assets-" + verData.build + "-" + (verData.timestamp || Date.now());
        return caches.open(currentCacheName).then((cache) => {
          return cache.addAll([
            "/Job-Tracker/icon-192.png",
            "/Job-Tracker/icon-512.png"
          ]).catch((err) => console.error("SW install partial:", err.message || "unknown"));
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const toKeep = keys.filter(k => k.startsWith("jobtrack-assets-"));
      const toRemove = keys.filter(k => !toKeep.includes(k));
      
      console.log("[SW] Activated. Keeping:", toKeep.length, "caches. Removing:", toRemove.length);
      return Promise.all(toRemove.map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // --- Supabase / API: network-only ---
  if (url.hostname.includes("supabase")) {
    event.respondWith(networkOnlyStrategy(event.request));
    return;
  }

  // --- Static assets ---
  if (/\.(css|js|json|png)$/i.test(url.pathname)) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // --- Navigation / HTML ---
  if (event.request.mode === "navigate") {
    event.respondWith(offlineFallbackStrategy(event.request));
    return;
  }
  // (optional: you could add a cache-first strategy here)
});

// ─── NETWORK-FIRST FOR STATIC ASSETS ─────────────────
function networkFirstStrategy(request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(currentCacheName).then(cache => cache.put(request, clone)).catch(console.warn);
        return response;
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then(cached => cached || new Response("Offline asset not available", { status: 408 }));
    });
}

// ─── STALE-WHILE-REVALIDATE FOR NAVIGATION ───────────
function offlineFallbackStrategy(request) {
  const cachedPromise = caches.open(currentCacheName).then(cache => cache.match(request));
  fetch(request.clone())
    .then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        caches.open(currentCacheName).then(cache => cache.put(request, networkResponse.clone()));
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: "UPDATE_AVAILABLE", timestamp: Date.now() }));
        }).catch(() => {});
      }
    })
    .catch(() => {});

  return cachedPromise.then(cached => {
    if (cached) return cached;
    return fetch(request).catch(() => new Response("You are offline", { status: 503, headers: { "Content-Type": "text/html" } }));
  });
}

// ─── NETWORK-ONLY (API) ──────────────────────────────
function networkOnlyStrategy(request) {
  return fetch(request).catch(() => new Response("Offline", { status: 503 }));
}

// ─── MESSAGE HANDLER (force updates, cache purge) ────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data?.type === "PURGE_ALL_CACHE") {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
      self.clients.matchAll().then(clients => clients.forEach(client => client.navigate(client.url)));
    }).catch(console.warn);
  } else if (event.data?.type === "SKIP_INSTALL_CHECK") {
    console.log("[SW] Skipping install check");
  }
});

// ─── PUSH NOTIFICATIONS (future use) ─────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification("JobTrack Update", {
      body: data.message || "Updates available",
      icon: "/Job-Tracker/icon-192.png"
    })
  );
});