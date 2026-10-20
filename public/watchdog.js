(function() {
    if (window.__maintenanceWatchdogActive) return;
    window.__maintenanceWatchdogActive = true;

    // 1. Clean any sensitive URL parameters to prevent history / referrer leakage
    try {
        if (window.history && window.history.replaceState && window.location.search) {
            var urlObj = new URL(window.location.href);
            if (urlObj.searchParams.has('unlock_token')) {
                var tokenFromUrl = urlObj.searchParams.get('unlock_token');
                if (tokenFromUrl) {
                    try {
                        localStorage.setItem('site_unlock_token', tokenFromUrl);
                    } catch(e) {}
                    var isHttps = window.location.protocol === 'https:';
                    document.cookie = "site_unlock_token=" + encodeURIComponent(tokenFromUrl) + "; path=/; max-age=604800; SameSite=Lax" + (isHttps ? "; Secure" : "");
                }
                urlObj.searchParams.delete('unlock_token');
                window.history.replaceState({}, document.title, urlObj.pathname + (urlObj.search || '') + urlObj.hash);
            }
        }
    } catch (e) {}

    // Detect if current page is explicitly the server-rendered 503 Maintenance / Offline page
    function checkIs503Page() {
        if (window.__IS_503_MAINTENANCE_PAGE__ === true) return true;
        if (document.getElementById('stalker-maintenance-portal') || document.querySelector('[data-page="maintenance-503"]')) {
            return true;
        }
        if (document.getElementById('broadcastOverlay') || document.getElementById('maintenanceAudioToggleBtn') || document.getElementById('musicControlBar')) {
            return true;
        }
        var title = (document.title || '').toLowerCase();
        return (title.includes('maintenance') || title.includes('downtime') || title.includes('offline') || title.includes('503'));
    }

    // Detect if current page is the Quantum Lock Screen
    function checkIsLockPage() {
        if (window.__IS_SITE_LOCKED_PAGE__ === true) return true;
        if (document.getElementById('stalker-lock-portal') || document.querySelector('[data-page="site-lock-screen"]')) {
            return true;
        }
        if (document.getElementById('lockCard') || document.getElementById('lockForm')) {
            return true;
        }
        var title = (document.title || '').toLowerCase();
        return (title.includes('restricted access') || title.includes('site locked') || title.includes('quantum lock') || title.includes('locked'));
    }

    var lastReloadTime = 0;
    function safeReload(reason) {
        var now = Date.now();
        // Prevent rapid reload loops (minimum 3s cooldown)
        if (now - lastReloadTime < 3000) return;
        lastReloadTime = now;
        window.location.reload();
    }

    var isChecking = false;
    async function checkStatus() {
        if (isChecking) return;
        // Skip background checks if the browser tab is hidden to conserve system resources
        if (document.hidden) return;

        isChecking = true;
        try {
            var is503Page = checkIs503Page();
            var isLockPage = checkIsLockPage();
            var currentPath = (window.location.pathname || '/') + (window.location.search || '');
            
            // Do not trigger reload on Hari Admin Console or login pages
            var isHariConsole = window.location.pathname.startsWith('/hari') || window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/admin');

            var storedToken = '';
            try {
                storedToken = localStorage.getItem('site_unlock_token') || sessionStorage.getItem('site_unlock_token') || '';
            } catch(e) {}

            var reqHeaders = { 'X-Requested-With': 'XMLHttpRequest' };
            if (storedToken) {
                reqHeaders['X-Site-Unlock-Token'] = storedToken;
            }

            var res = await fetch('/api/system/public-status?page=' + encodeURIComponent(currentPath) + '&t=' + Date.now(), {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: reqHeaders
            });
            if (!res.ok) return;
            var data = await res.json();
            if (!data) return;

            // 1. Check Site Lock Mode State (Priority: Instant Lock Screen Gate)
            var isAdminAuth = Boolean(data && data.isAdmin === true) || (document.cookie.indexOf('admin_auth=') !== -1);
            if (typeof data.locked === 'boolean' && !isHariConsole && !isAdminAuth) {
                if (!isLockPage && data.locked === true) {
                    safeReload('Lock Mode activated');
                    return;
                } else if (isLockPage && data.locked === false) {
                    safeReload('Lock Mode deactivated or unlocked');
                    return;
                }
            }

            // 2. Check Maintenance Mode State
            if (typeof data.maintenance === 'boolean' && !data.locked && !isHariConsole && !isAdminAuth) {
                if (!is503Page && data.maintenance === true) {
                    safeReload('Maintenance Mode activated');
                } else if (is503Page && data.maintenance === false) {
                    safeReload('Maintenance Mode deactivated');
                }
            }

            // 3. Live Broadcast Video Dynamic Update (No Reload Required)
            if (data.videoBroadcast && typeof window.applyLiveVideoBroadcastUpdate === 'function') {
                window.applyLiveVideoBroadcastUpdate(data.videoBroadcast);
            }

            // 4. Maintenance Schedule Banner & Countdown Update
            if (data.maintenanceSchedule && typeof window.updateMaintenanceScheduleBanner === 'function') {
                window.updateMaintenanceScheduleBanner(data.maintenanceSchedule);
            }
        } catch(e) {
        } finally {
            isChecking = false;
        }
    }

    // Adaptive, lightweight status polling: 10 seconds when tab is active (80% load reduction)
    var pollTimer = setInterval(checkStatus, 10000);
    setTimeout(checkStatus, 800);

    // Instant status check on tab visibility change or window focus
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkStatus();
        }
    });
    window.addEventListener('focus', checkStatus);
})();
