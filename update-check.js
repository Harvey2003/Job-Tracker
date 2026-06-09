// ===========================================================================
// update-check.js — Fixed Service Worker Detection for Mobile Chrome
// ===========================================================================
// Fixes: random SW URLs, missing scope in getRegistration(), no force-update.
//
// Deploy flow:
//    1. Harvey updates app-version.json with a new "build" string per deploy.
//    2. Each page load fetches that build value → registers SW with ?v=<build>.
//    3. Browser sees the new URL, fetches fresh service-worker.js, installs it.
//    4. Service worker calls skipWaiting() during install → becomes "waiting".
//    5. Banner appears. User taps reload → SKIP_WAITING sent → caches cleared
//       → page reloaded under CONTROL of the new (now-active) SW.
// ===========================================================================

(function () {
    if (!('serviceWorker' in navigator)) return;

    var BANNER = document.getElementById('appBanner');
    var RELOAD_BTN = document.getElementById('reloadBtn');
    var SW_SCOPE = '/Job-Tracker/';
    var SW_URL   = '/Job-Tracker/service-worker.js';

    // ─── doCleanReload(reg): full clean-reload sequence ──────────────────────
    function doCleanReload(reg) {
        if (!reg) return;

        // Tell both active AND waiting service workers to skip their queues
        if (reg.active)       reg.active.postMessage({ type: 'SKIP_WAITING' });
        if (reg.waiting)      reg.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Clear ALL caches so the new SW starts fresh — no stale content leaks
        if ('caches' in window) {
            caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) {
                    return caches.delete(k);
                }));
            }).finally(function () {
                location.reload();
            });
        } else {
            location.reload();
        }
    }

    // ─── showBanner(reg): display update banner with full-banner click ──────
    function showBanner(reg) {
        if (!BANNER || (reg && BANNER.style.display === 'block')) return;

        BANNER.style.display = 'block';

        // Entire banner is clickable, not just the button — triggers clean reload
        var bannerWrapper = function (e) {
            e.stopPropagation();
            showBannerConfirm(reg);
        };
        BANNER.addEventListener('click', bannerWrapper, { once: true });

        // Button click also triggers the same handler
        if (RELOAD_BTN && !RELOAD_BTN._wasReplaced) {
            var newBtn = RELOAD_BTN.cloneNode(true);
            RELOAD_BTN.parentNode.replaceChild(newBtn, RELOAD_BTN);
            RELOAD_BTN = newBtn;
            RELOAD_BTN._wasReplaced = true;
        }

        if (RELOAD_BTN) {
            var btnWrapper = function (e) {
                e.stopPropagation();
                showBannerConfirm(reg);
            };
            RELOAD_BTN.addEventListener('click', btnWrapper, { once: true });
        }
    }

    // Confirm before reloading (avoids accidental taps)
    function showBannerConfirm(reg) {
        if (confirm('A new version of JobTrack is available. Reload to update?')) {
            doCleanReload(reg);
        } else {
            BANNER.style.display = 'none';
            BANNER.setAttribute('data-shown-version', localStorage.getItem('jobtrack-build') || '');
        }
    }

    // ─── STEP 1: Fetch app-version.json for versioned SW registration ──────
    fetch('/Job-Tracker/app-version.json')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var build = (data && data.build) || 'dev';

            // Persist this build so we can compare across page loads / other tabs
            localStorage.setItem('jobtrack-build', build);

            // Register service worker with a stable versioned URL (NOT Date.now())
            return navigator.serviceWorker.register(SW_URL + '?v=' + build, { scope: SW_SCOPE });
        })
        .then(function (reg) {
            // If there's already a waiting SW from a previous deploy, show banner immediately
            if (reg.waiting) {
                showBanner(reg);
                return;
            }

            // Cross-version check — detects updates while this tab was open
            fetch('/Job-Tracker/app-version.json')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var newBuild = (data && data.build) || 'dev';
                    if (localStorage.getItem('jobtrack-build') !== newBuild) {
                        showBanner(reg);
                    }
                })
                .catch(function () {});

            return reg;
        })
        .then(function (reg) {
            // ─── FORCE UPDATE CHECK: THE KEY FIX FOR MOBILE CHROME ──────
            navigator.serviceWorker.ready.then(function (readyReg) {
                readyReg.update();  // Forces browser to check server for new SW code

                // After initial update cycle, re-check if a waiting SW appeared
                setTimeout(function () {
                    navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (r) {
                        if (r && r.waiting) showBanner(r);
                    });
                }, 3000);
            });

            return reg;
        })
        .catch(function (err) { console.warn('[update-check] init failed:', err); });

    // ─── VISIBILITY CHANGE: re-check when user returns to the tab ──────
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;

        navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (reg) {
            if (!reg || !reg.waiting) return;
            showBanner(reg);
        }).catch(function () {});
    });

    // ─── MESSAGE LISTENER: handle updates posted by the service worker ──
    navigator.serviceWorker.onmessage = function (e) {
        if (!e.data || e.data.type !== 'UPDATE_AVAILABLE') return;

        doCleanReload(navigator.serviceWorker.controller);
    };
})();
