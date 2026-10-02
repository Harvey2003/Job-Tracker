/* update-check.js
 * ---------------------------------------------------------------
 * 1. Reads CURRENT_VERSION from <meta name="app-version">.
 * 2. Polls ./app-version.json (cache-busted) on load + every 60s.
 * 3. If mismatch → shows banner + posts UPDATE_AVAILABLE to SW controller.
 * 4. Wires #reloadBtn → dispatches 'jobtrack:force-update'.
 */

(function () {
    'use strict';

    var meta = document.querySelector('meta[name="app-version"]');
    var CURRENT_VERSION = meta ? (meta.getAttribute('content') || '') : '';

    function showBanner() {
        if (typeof window.showUpdateBanner === 'function') {
            try { window.showUpdateBanner(); return; } catch (e) {}
        }
        var banner = document.getElementById('appBanner');
        if (banner) banner.style.display = 'block';
    }

    function checkForUpdate() {
        return fetch('app-version.json?_=' + Date.now(), { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.version) return;
                if (data.version === CURRENT_VERSION) return;

                console.log('[update-check] new version detected:', data.version, '(current:', CURRENT_VERSION + ')');
                showBanner();

                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    try {
                        navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_AVAILABLE' });
                    } catch (e) {}
                }
            })
            .catch(function () {
                // Silent — offline or file missing.
            });
    }

    window.addEventListener('load', checkForUpdate);
    setInterval(checkForUpdate, 60000);

    function wireReloadBtn() {
        var btn = document.getElementById('reloadBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            window.dispatchEvent(new CustomEvent('jobtrack:force-update'));
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireReloadBtn);
    } else {
        wireReloadBtn();
    }
})();