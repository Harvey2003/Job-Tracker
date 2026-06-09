// ===========================================================================
// update-check.js — Version-based SW detection + clean reload flow
// Solves Problems #1, #2, and #3 from the audit plan.
// ===========================================================================

(function () {
    if (!('serviceWorker' in navigator)) return;

    var appBanner  = document.getElementById('appBanner');
    var reloadBtn  = document.getElementById('reloadBtn');

    // ─── Helper: register SW with version-based URL ────────────────────────
    // Problem #1 fix: fetch app-version.json, append ?.build=?  param.
    //   Different build string → different URL → browser fetches fresh SW code.
    function registerVersionedSW() {
        navigator.serviceWorker.getRegistration().then(function (reg) {
            var swUrl = '/Job-Tracker/service-worker.js?v=' + Date.now();

            if (reg && reg.active) {
                // The service worker is already active — check for updates.
                checkForUpdates(reg);
            } else {
                navigator.serviceWorker.register(swUrl)
                    .then(function (newReg) {
                        console.log('[Update Check] Service Worker registered:', newReg.scope);
                        checkForUpdates(newReg);
                    })
                    .catch(function (err) {
                        console.warn('[Update Check] SW registration failed', err);
                    });
            }
        });
    }

    // ─── Helper: compare stored version against current app-version.json ────
    // Problem #3 fix: cross-page version detection via localStorage.
    function checkForUpdates(swRegistration) {
        fetch('/Job-Tracker/app-version.json')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var currentVersion = data.build;
                var storedVersion  = localStorage.getItem('jobtrack-version');

                if (!storedVersion || storedVersion !== currentVersion) {
                    // A new build exists but hasn't been loaded yet.
                    // Show the banner so the user can reload and pick it up.
                    showUpdateBanner(swRegistration, currentVersion);
                }
            })
            .catch(function () {
                // Silently ignore — network errors shouldn't block banner display.
            });
    }

    // ─── Helper: show update banner for clean reload flow ──────────────────
    function showUpdateBanner(swReg, newVersion) {
        if (appBanner && swReg) {
            appBanner.style.display = 'block';
            appBanner.setAttribute('data-new-version', newVersion);

            // Problem #2 fix: attach a proper reload handler to the button that
            //   - tells the waiting SW to skip waiting
            //   - clears old caches (from previous build)
            //   - reloads the page cleanly so the active SW serves it.
            if (reloadBtn) {
                // Remove stale listeners by replacing element's clone node
                var newBtn = reloadBtn.cloneNode(true);
                reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);

                newBtn.addEventListener('click', function (e) {
                    e.stopPropagation();  // don't trigger banner click too

                    // Ask SW controller to skip its waiting period.
                    if (swReg.active) {
                        swReg.active.postMessage({ type: 'SKIP_WAITING' });
                    } else {
                        // Fallback: message the whole service worker registration.
                        navigator.serviceWorker.ready.then(function (reg) {
                            reg.active.postMessage({ type: 'SKIP_WAITING' });
                        });
                    }

                    // Clear old cache buckets from previous builds.
                    if ('caches' in window) {
                        caches.keys().then(function (keys) {
                            keys.forEach(function (key) {
                                caches.delete(key);
                            });
                        }).finally(function () {
                            // Clean reload — served by the now-active SW.
                            location.reload();
                        });
                    } else {
                        location.reload();
                    }
                }, { once: true });  // attach only once per banner show.
            }
        }
    }

    // ─── Run on load: register SW + check version ──────────────────────────
    registerVersionedSW();

    // Also re-check whenever the tab becomes visible (covers multi-tab updates).
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            navigator.serviceWorker.getRegistration().then(function (reg) {
                if (reg && reg.active) checkForUpdates(reg);
            });
        }
    });

    // ─── SW message listener from service-worker.js offlineFallbackStrategy ─
    // Problem #3 continued: SW posts 'UPDATE_AVAILABLE' when stale-while-revalidate
    //   fetches a fresh copy of index.html. This catches the same update
    //   (sometimes missed by localStorage check alone).
    navigator.serviceWorker.onmessage = function (e) {
        if (e.data && e.data.type === 'UPDATE_AVAILABLE') {
            getRegistration().then(checkForUpdates);  // re-check version too.
        }
    };

    function getRegistration() {
        return navigator.serviceWorker.ready;
    }
})();
