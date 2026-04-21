const CACHE_NAME = "jobtrack-v1";
const FILES_TO_CACHE = [
    "/Job-Tracker/",
    "/Job-Tracker/index.html",
    "/Job-Tracker/style1.css",
    "/Job-Tracker/script.js"
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});