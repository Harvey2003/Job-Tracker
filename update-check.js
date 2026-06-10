// ===========================================================================
// update-check.js — Service Worker Registration & Automatic Update Detection  
// ===========================================================================
// Fix: Register the SW on every page load (never was happening before).
// Detects new builds via direct app-version.json comparison (cache-busted) 
// to bypass all browser / SW caching, then registers the SW for full PWA flow.
// Shows update banner reliably when waiting SW detected or version mismatch.  
// ===========================================================================

'use strict';
(function () {
    if (!('serviceWorker' in navigator)) return;

    var BANNER          = document.getElementById('appBanner');
    var RELOAD_BTN      = document.getElementById('reloadBtn');
    var SW_SCOPE        = '/Job-Tracker/';
    var SW_URL          = '/Job-Tracker/service-worker.js';
    var BUILD_KEY       = 'jobtrack-build';

    // ─── showBanner(reg): Display update banner immediately (trust no state) 
    function showBanner(reg) {
        if (!BANNER || BANNER.style.display === 'block') return;
        BANNER.style.display = 'block';
        
          // Click anywhere on banner → triggers clean reload  
        var wrapper = function (e) {
            e.stopPropagation();
            doCleanReload(reg);
         };
        BANNER.removeEventListener('click', BANNER._cachedHandler);
        BANNER._cachedHandler = wrapper;
        BANNER.addEventListener('click', wrapper, { once: true });

          // Button click → same handler with confirmation  
        if (RELOAD_BTN) {
            var newBtn = RELOAD_BTN.cloneNode(true);
            RELOAD_BTN.parentNode.replaceChild(newBtn, RELOAD_BTN);
            RELOAD_BTN = newBtn;
            RELOAD_BTN.addEventListener('click', function (e) {
                e.stopPropagation();
                doCleanReload(reg);
             }, { once: true });
           }
       }

    // ─── doCleanReload(reg): Full clean-reload sequence ──────────────────────
    function doCleanReload(reg) {
        if (!reg) return;

          // Force the waiting SW to become active NOW  
        if (reg.active)       reg.active.postMessage({ type: 'SKIP_WAITING' });
        if (reg.waiting)      reg.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Clear ALL caches then reload fresh
        if ('caches' in window) {
            caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) {
                    return caches.delete(k);
                  }));
              }).finally(function () {
                location.reload();   // Fresh page load, new SW now active  
              });
           } else {
            location.reload();
           }
       }

    // ─── registerServiceWorker: ALWAYS register/update the service worker ──
      // This is the MISSING piece — it was never called before.
    function registerServiceWorker() {
        navigator.serviceWorker.register(SW_URL + '?v=' + Date.now(), { scope: SW_SCOPE })
             .then(function (reg) {
                  // Check if there's a waiting version already ready to activate  
                if (reg.waiting) showBanner(reg);

                  // Listen for messages from the newly registered SW  
                navigator.serviceWorker.addEventListener('message', function (e) {
                    if (!e.data || e.data.type === 'UPDATE_AVAILABLE') showBanner(reg);
                 }, { once: true });

                  return reg;
             })
            .catch(function () {}); // Silent fail — app still works as normal PWA-less page  
         }

    // ─── CORE LOGIC: ALWAYS compare build against server directly (cache-busted)
      // This bypasses ALL browser caching including mobile Chrome's aggressive HTTP cache.
    function checkForUpdates() {
        var buildReq = new XMLHttpRequest();
         buildReq.open('GET', '/Job-Tracker/app-version.json?v=' + Date.now(), true);  
        buildReq.onload = function () {
            try {
                var data = JSON.parse(buildReq.responseText);
                if (!data || !data.build) return;

                var stored = localStorage.getItem(BUILD_KEY);

                if (stored !== data.build) {
                      // Build diverged from server — force SW re-registration  
                    registerServiceWorker();
                    
                      // Also immediately check for waiting SW from previous deploy
                    navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (reg) {
                        if (reg && reg.waiting) showBanner(reg);
                      }).catch(function () {});
                  } else {
                      // Same build — still check if there's a waiting SW ready  
                    navigator.serviceWorker.getRegistration(SW_SCOPE).then(function (reg) {
                        if (reg && reg.waiting) showBanner(reg);
                      }).catch(function () {});
                   }

                localStorage.setItem(BUILD_KEY, data.build);
             } catch (e) {} // Ignore parse errors silently
         };
        buildReq.send();
     }

    // ─── INITIAL EXECUTION: Run version check immediately on page load  
    checkForUpdates();

    // ─── PERIODIC RE-CHECK (30 sec — safety net for mobile Chrome's aggressive caching)  
     setInterval(checkForUpdates, 30000);

    // ─── VISIBILITY CHANGE: Re-check every time user returns to the tab
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkForUpdates();
     });

    // ─── MESSAGE LISTENER: Handle any updates from the service worker  
    navigator.serviceWorker.onmessage = function (e) {
        if (!e.data || e.data.type !== 'UPDATE_AVAILABLE') return;
         checkForUpdates();   // Triggers banner via registration + version comparison  
     };
})();
