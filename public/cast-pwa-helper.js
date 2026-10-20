/**
 * Stalker Pro - Chromecast, Apple AirPlay & PWA Install Engine
 */
(function() {
    // 1. PWA In-App Install Prompt Manager
    let deferredPrompt = null;
    let isInstalled = false;

    function initPwaInstall() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             window.navigator.standalone === true;
        isInstalled = isStandalone;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallButtons();
        });

        window.addEventListener('appinstalled', () => {
            isInstalled = true;
            deferredPrompt = null;
            hideInstallButtons();
            console.log('[PWA] Application successfully installed.');
        });

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then((reg) => {
                    console.log('[PWA] Service Worker registered with scope:', reg.scope);
                }).catch((err) => {
                    console.warn('[PWA] Service Worker registration failed:', err);
                });
            });
        }
    }

    function showInstallButtons() {
        const btns = document.querySelectorAll('.pwa-install-btn');
        btns.forEach(btn => btn.classList.remove('hidden'));
    }

    function hideInstallButtons() {
        const btns = document.querySelectorAll('.pwa-install-btn');
        btns.forEach(btn => btn.classList.add('hidden'));
    }

    window.promptPwaInstall = async function() {
        const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
        if (isIos && !isInstalled) {
            showIosInstallGuide();
            return;
        }

        if (!deferredPrompt) {
            alert("To install, tap your browser's menu (⋮) and select 'Install app' or 'Add to Home screen'.");
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            isInstalled = true;
            hideInstallButtons();
        }
        deferredPrompt = null;
    };

    function showIosInstallGuide() {
        let modal = document.getElementById('iosInstallModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'iosInstallModal';
            modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4';
            modal.innerHTML = `
                <div class="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl text-center space-y-4">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 text-2xl">
                        📲
                    </div>
                    <h3 class="text-lg font-bold text-white">Install on iPhone / iPad</h3>
                    <p class="text-xs text-zinc-300 leading-relaxed">
                        1. Tap the <strong class="text-white">Share</strong> button <span class="inline-block p-1 bg-zinc-800 rounded">⎋</span> in Safari's bottom toolbar.<br>
                        2. Scroll down and tap <strong class="text-red-400">Add to Home Screen ➕</strong>.<br>
                        3. Open Stalker Pro from your home screen for full-screen playback!
                    </p>
                    <button onclick="document.getElementById('iosInstallModal').classList.add('hidden')" class="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all">
                        Got It
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
    }

    // 2. Chromecast & AirPlay Integration
    let castInitialized = false;

    function initCasting() {
        // Check for Apple AirPlay availability
        const video = document.querySelector('video');
        if (video && window.WebKitPlaybackTargetAvailabilityEvent) {
            video.addEventListener('webkitplaybacktargetavailabilitychanged', (e) => {
                const airplayBtns = document.querySelectorAll('.airplay-btn');
                if (e.availability === 'available') {
                    airplayBtns.forEach(btn => btn.classList.remove('hidden'));
                } else {
                    airplayBtns.forEach(btn => btn.classList.add('hidden'));
                }
            });
        }

        // Initialize Google Cast SDK
        window['__onGCastApiAvailable'] = function(isAvailable) {
            if (isAvailable) {
                try {
                    const sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
                    const apiConfig = new chrome.cast.ApiConfig(
                        sessionRequest,
                        (session) => console.log('[Cast] Session joined:', session),
                        (status) => console.log('[Cast] Receiver status:', status)
                    );
                    chrome.cast.initialize(apiConfig, () => {
                        castInitialized = true;
                        console.log('[Cast] Google Cast SDK initialized.');
                    }, (err) => console.warn('[Cast] Cast init error:', err));
                } catch (e) {
                    console.warn('[Cast] Exception initializing Google Cast:', e);
                }
            }
        };

        // Load Cast sender script if not already present
        if (!document.getElementById('gcast-sdk-script')) {
            const script = document.createElement('script');
            script.id = 'gcast-sdk-script';
            script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
            document.head.appendChild(script);
        }
    }

    // Trigger AirPlay
    window.triggerAirPlay = function() {
        const video = document.querySelector('video');
        if (video && video.webkitShowPlaybackTargetPicker) {
            video.webkitShowPlaybackTargetPicker();
            return;
        }
        showCastModal('AirPlay is native to Apple devices (Safari on iOS / macOS). Ensure Apple TV or AirPlay 2 Smart TV is on the same Wi-Fi.');
    };

    // Trigger Chromecast
    window.triggerChromeCast = function(streamUrl, streamTitle) {
        const video = document.querySelector('video');
        const urlToCast = streamUrl || (video ? video.src : window.location.href);
        const titleToCast = streamTitle || document.title || 'Stalker Pro Stream';

        // Check if Chrome Cast API session request is possible
        if (window.chrome && window.chrome.cast && chrome.cast.isAvailable) {
            chrome.cast.requestSession((session) => {
                const mediaInfo = new chrome.cast.media.MediaInfo(urlToCast, 'application/x-mpegurl');
                mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
                mediaInfo.metadata.title = titleToCast;
                const request = new chrome.cast.media.LoadRequest(mediaInfo);
                session.loadMedia(request, () => {
                    console.log('[Cast] Media successfully loaded on Chromecast device.');
                }, (err) => console.warn('[Cast] Load error:', err));
            }, (err) => {
                console.warn('[Cast] Session error:', err);
                showCastModal();
            });
            return;
        }

        // Check Remote Playback API (Android Chrome / Smart TV)
        if (video && video.remote && video.remote.prompt) {
            video.remote.prompt().catch(() => showCastModal());
            return;
        }

        showCastModal();
    };

    function showCastModal(customMessage) {
        let modal = document.getElementById('castGuideModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'castGuideModal';
            modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4';
            modal.innerHTML = `
                <div class="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl text-left space-y-4">
                    <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="p-2.5 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white">Cast to Smart TV / Nest Hub</h3>
                                <p class="text-[10px] text-zinc-400">Beam live stream to any big screen</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('castGuideModal').classList.add('hidden')" class="text-zinc-400 hover:text-white p-1">
                            ✕
                        </button>
                    </div>
                    <p class="text-xs text-zinc-300 leading-relaxed" id="castGuideText">
                        ${customMessage || 'To cast this stream to your Google Nest Hub, Android TV, Apple TV, or Smart TV:'}
                    </p>
                    <div class="space-y-2.5 text-xs text-zinc-300 bg-black/40 p-4 rounded-2xl border border-zinc-800">
                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                            <span>Make sure your phone/PC and Smart TV are on the <strong>same Wi-Fi network</strong>.</span>
                        </div>
                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                            <span>On <strong>Chrome/Edge</strong>, click the 3 dots menu (⋮) &gt; <strong>Cast...</strong> &gt; Select your TV or Nest Hub.</span>
                        </div>
                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                            <span>On <strong>iPhone/iPad/Mac</strong>, tap the AirPlay button in the video controls bar.</span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('castGuideModal').classList.add('hidden')" class="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all">
                        Dismiss
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        } else if (customMessage) {
            const txt = document.getElementById('castGuideText');
            if (txt) txt.innerText = customMessage;
        }
        modal.classList.remove('hidden');
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initPwaInstall();
            initCasting();
        });
    } else {
        initPwaInstall();
        initCasting();
    }
})();
