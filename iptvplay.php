<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>IPTV Xtream Optimized Player</title>
    
    <!-- Styling & Icons -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    
    <!-- Player Core (HLS.js & Plyr) -->
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.0/dist/hls.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js"></script>
    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>

    <style>
        body, html {
            margin: 0; padding: 0; width: 100%; height: 100%;
            background-color: #000; overflow: hidden; font-family: sans-serif;
            -webkit-tap-highlight-color: transparent !important;
        }
        #player-container {
            width: 100%; height: 100vh; display: flex; flex-direction: column;
        }
        /* Make Plyr fill the container perfectly */
        .plyr { width: 100%; height: 100%; --plyr-color-main: #ef4444; }
        .plyr__video-wrapper { height: 100%; background: #000; }
        
        /* Custom Top Bar Z-index to overlay Fullscreen */
        #custom-top-bar {
            z-index: 2147483647 !important;
        }
        
        /* Interactive overlay for Plyr */
        .plyr--active #custom-top-bar {
            opacity: 1;
            pointer-events: auto;
        }
        .plyr--hide-controls #custom-top-bar {
            opacity: 0;
            pointer-events: none;
        }

        /* High-Precision Smooth Touch Responsive Timeline & Seeking */
        .plyr__progress {
            position: relative !important;
            touch-action: none !important;
            padding: 10px 0 !important;
            cursor: pointer !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            min-height: 28px !important;
            display: flex !important;
            align-items: center !important;
        }
        .plyr__progress input[type="range"] {
            position: relative !important;
            height: 28px !important;
            cursor: pointer !important;
            touch-action: none !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 10 !important;
        }
        /* Progress track */
        .plyr--video .plyr__progress__buffer,
        .plyr--video .plyr__progress input[type="range"]::-webkit-slider-runnable-track,
        .plyr--video .plyr__progress input[type="range"]::-moz-range-track {
            height: 6px !important;
            border-radius: 9999px !important;
            transition: height 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* Smooth Expand on hover, active, touch or scrubbing */
        .plyr__progress:hover .plyr__progress__buffer,
        .plyr__progress:active .plyr__progress__buffer,
        .plyr__progress:hover input[type="range"]::-webkit-slider-runnable-track,
        .plyr__progress:active input[type="range"]::-webkit-slider-runnable-track,
        .plyr__progress.is-scrubbing .plyr__progress__buffer,
        .plyr__progress.is-scrubbing input[type="range"]::-webkit-slider-runnable-track {
            height: 9px !important;
        }
        /* Scrubber thumb - smooth glowing & enlarged touch radius */
        .plyr--video input[type="range"]::-webkit-slider-thumb {
            width: 15px !important;
            height: 15px !important;
            background: #ef4444 !important;
            border: 2px solid #ffffff !important;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0,0,0,0.6) !important;
            border-radius: 50% !important;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease !important;
            margin-top: -4.5px !important;
            cursor: pointer !important;
        }
        .plyr--video input[type="range"]:active::-webkit-slider-thumb,
        .plyr--video input[type="range"]:focus::-webkit-slider-thumb,
        .plyr__progress.is-scrubbing input[type="range"]::-webkit-slider-thumb {
            transform: scale(1.45) !important;
            background: #ff3b30 !important;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 0 7px rgba(239, 68, 68, 0.35) !important;
        }
        .plyr--video input[type="range"]::-moz-range-thumb {
            width: 15px !important;
            height: 15px !important;
            background: #ef4444 !important;
            border: 2px solid #ffffff !important;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0,0,0,0.6) !important;
            border-radius: 50% !important;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease !important;
        }
        .plyr--video input[type="range"]:active::-moz-range-thumb,
        .plyr__progress.is-scrubbing input[type="range"]::-moz-range-thumb {
            transform: scale(1.45) !important;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 0 7px rgba(239, 68, 68, 0.35) !important;
        }
        .plyr__tooltip {
            font-family: system-ui, sans-serif !important;
            font-weight: 800 !important;
            font-size: 11px !important;
            letter-spacing: 0.04em !important;
            border-radius: 8px !important;
            padding: 5px 9px !important;
            background: rgba(10, 10, 15, 0.95) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8) !important;
            backdrop-filter: blur(12px) !important;
            color: #ffffff !important;
        }
        /* Touch Seek HUD overlay */
        .touch-seek-hud {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background: rgba(10, 10, 15, 0.92);
            border: 1px solid rgba(239, 68, 68, 0.4);
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.2);
            color: #fff;
            padding: 16px 28px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 800;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 2147483647;
            backdrop-filter: blur(16px);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-width: 200px;
        }
        .touch-seek-hud.active {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        .touch-seek-hud .hud-time {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0.05em;
            color: #fff;
        }
        .touch-seek-hud .hud-diff {
            font-size: 13px;
            font-weight: 800;
            color: #ef4444;
        }
        .touch-seek-hud .hud-bar {
            width: 100%;
            height: 5px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 6px;
        }
        .touch-seek-hud .hud-bar-fill {
            height: 100%;
            background: #ef4444;
            border-radius: 9999px;
            transition: width 0.05s linear;
        }
        #zoom-indicator {
            position: absolute;
            top: 5rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 0.5rem 1.25rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.15);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 2147483647;
            backdrop-filter: blur(8px);
        }
    </style>
    <link rel="stylesheet" href="assets/local-ai.css?v=2.0">
</head>
<body>

<div id="player-container" class="relative group">
    
    <!-- Xtream Optimized Top Bar -->
    <div id="custom-top-bar" class="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-300 opacity-1 pointer-events-auto">
        
        <!-- Back Button -->
        <button onclick="window.history.back()" class="w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-colors">
            <i data-lucide="arrow-left" class="w-5 h-5 sm:w-6 sm:h-6"></i>
        </button>
        
        <!-- Stream Info -->
        <div class="flex flex-col items-center justify-center flex-1 px-4">
            <h1 id="stream-title" class="text-white text-base sm:text-xl font-black tracking-wide drop-shadow-md line-clamp-1 text-center">
                Loading IPTV Stream...
            </h1>
            <div id="stream-status" class="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <span id="status-dot" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span id="status-text" class="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-widest">CONNECTING</span>
            </div>
        </div>

        <!-- Manual Reconnect Button -->
        <button onclick="forceReconnect()" class="w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-colors" title="Force Reconnect">
            <i data-lucide="refresh-cw" class="w-5 h-5 sm:w-6 sm:h-6"></i>
        </button>

    </div>

    <!-- Video Element -->
    <video id="iptv-video" class="w-full h-full" playsinline></video>

    <!-- Error / Reconnect Overlay -->
    <div id="reconnect-overlay" class="absolute inset-0 bg-black/95 z-[2147483646] flex-col items-center justify-center hidden">
        <i data-lucide="satellite" class="w-16 h-16 text-red-500 mb-4 animate-pulse"></i>
        <h2 class="text-white text-xl sm:text-2xl font-black tracking-widest uppercase">Signal Lost</h2>
        <p class="text-zinc-400 text-sm sm:text-base mt-2 mb-6 text-center max-w-md px-4">The Xtream server stopped responding or the stream dropped. Attempting to auto-recover...</p>
        <div class="flex items-center gap-3">
            <i data-lucide="loader-2" class="w-5 h-5 text-indigo-500 animate-spin"></i>
            <span class="text-indigo-400 font-bold text-sm">Reconnecting (Attempt <span id="retry-count">0</span>)...</span>
        </div>
        <button onclick="forceReconnect()" class="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-widest transition">
            Force Manual Reload
        </button>
    </div>

</div>

<script>
    lucide.createIcons();

    // Elements
    const video = document.getElementById('iptv-video');
    const titleEl = document.getElementById('stream-title');
    const overlay = document.getElementById('reconnect-overlay');
    const retryCountEl = document.getElementById('retry-count');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    let player = null;
    let hls = null;
    let mpegPlayer = null;
    let retryAttempt = 0;
    let maxRetries = 999; // Essentially infinite for IPTV

    let streamUrl = '{{STREAM_URL}}';
    if (streamUrl === '{{' + 'STREAM_URL}}') {
        const urlParams = new URLSearchParams(window.location.search);
        streamUrl = urlParams.get('url');
    }
    const title = '{{TITLE}}' !== '{{' + 'TITLE}}' ? '{{TITLE}}' : (new URLSearchParams(window.location.search).get('title') || 'Xtream Live Channel');
    titleEl.textContent = title;

    function updateStatus(state, colorClass) {
        statusText.textContent = state;
        statusDot.className = `w-2 h-2 rounded-full animate-pulse ${colorClass}`;
        statusText.parentElement.className = `mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-${colorClass.split('-')[1]}-500/20 border border-${colorClass.split('-')[1]}-500/30`;
        statusText.className = `text-[10px] sm:text-xs font-bold text-${colorClass.split('-')[1]}-400 uppercase tracking-widest`;
    }

    function initPlayer() {
        if (!streamUrl) {
            titleEl.textContent = 'No Stream URL Provided';
            updateStatus('ERROR', 'bg-red-500');
            return;
        }

        const isExplicitVod = streamUrl.toLowerCase().endsWith('.mp4') || streamUrl.toLowerCase().endsWith('.mkv') || streamUrl.includes('movie') || streamUrl.includes('series');

        // Initialize Plyr UI
        if (!player) {
            player = new Plyr(video, {
                controls: ['play-large', 'play', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
                autoplay: true,
                muted: false,
                hideControls: { enabled: true, delay: 3000 },
                settings: ['quality', 'speed']
            });
            initAdvancedGestures(player, video);
        }

        loadStream();
    }

    // High-Precision Smooth Touch Timeline & Seeking Engine
    function initSmoothTouchTimeline(player, video) {
        const container = player.elements?.container || video.closest('.plyr') || document.getElementById('player-container');
        if (!container) return;
        const progressEl = container.querySelector('.plyr__progress');
        if (!progressEl) return;

        const rangeInput = progressEl.querySelector('input[type="range"]');
        let isScrubbing = false;
        let scrubTargetTime = 0;
        let wasPausedBeforeScrub = false;
        let rafId = null;

        function formatTime(secs) {
            if (isNaN(secs) || secs < 0) secs = 0;
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = Math.floor(secs % 60);
            if (h > 0) {
                return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
            }
            return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }

        function updateScrubPosition(clientX) {
            const rect = progressEl.getBoundingClientRect();
            if (!rect.width) return;
            let percent = (clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            
            const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
            if (duration > 0) {
                scrubTargetTime = percent * duration;
                if (rangeInput) {
                    rangeInput.value = (percent * 100).toFixed(2);
                    rangeInput.style.setProperty('--value', `${(percent * 100).toFixed(1)}%`);
                }
                const curTimeEl = container.querySelector('.plyr__time--current');
                if (curTimeEl) {
                    curTimeEl.textContent = formatTime(scrubTargetTime);
                }
            }
        }

        progressEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            isScrubbing = true;
            progressEl.classList.add('is-scrubbing');
            wasPausedBeforeScrub = video.paused;
            updateScrubPosition(e.touches[0].clientX);
            e.stopPropagation();
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isScrubbing || e.touches.length !== 1) return;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                updateScrubPosition(e.touches[0].clientX);
            });
            e.preventDefault();
        }, { passive: false });

        const endScrub = (e) => {
            if (!isScrubbing) return;
            isScrubbing = false;
            progressEl.classList.remove('is-scrubbing');
            if (rafId) cancelAnimationFrame(rafId);

            const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
            if (duration > 0 && scrubTargetTime >= 0) {
                try {
                    if (player) {
                        player.currentTime = scrubTargetTime;
                    } else {
                        video.currentTime = scrubTargetTime;
                    }
                } catch(err) {
                    console.warn("Touch seek error:", err);
                }
            }
            if (!wasPausedBeforeScrub && video.paused) {
                video.play().catch(() => {});
            }
        };

        window.addEventListener('touchend', endScrub, { passive: true });
        window.addEventListener('touchcancel', endScrub, { passive: true });
    }

    // Advanced Touch Gestures (Swipe Seek, Volume, Brightness, Double Tap -10s/+10s)
    function initAdvancedGestures(player, video) {
        const container = player.elements?.container || video.closest('.plyr') || document.getElementById('player-container');
        if (!container) return;

        // Create Touch Seek HUD element if not present
        let seekHud = document.getElementById('touchSeekHud');
        if (!seekHud) {
            seekHud = document.createElement('div');
            seekHud.id = 'touchSeekHud';
            seekHud.className = 'touch-seek-hud';
            seekHud.innerHTML = `
                <div class="flex items-center gap-2">
                    <i data-lucide="fast-forward" class="w-5 h-5 text-red-500 hud-icon"></i>
                    <span class="hud-time">00:00</span>
                </div>
                <span class="hud-diff">+0s</span>
                <div class="hud-bar"><div class="hud-bar-fill" style="width: 0%;"></div></div>
            `;
            container.appendChild(seekHud);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        const indicator = document.getElementById('zoom-indicator') || (function() {
            const ind = document.createElement('div');
            ind.id = 'zoom-indicator';
            document.body.appendChild(ind);
            return ind;
        })();

        function showIndicator(text) {
            if (!indicator) return;
            indicator.textContent = text;
            indicator.style.opacity = '1';
            setTimeout(() => indicator.style.opacity = '0', 1500);
        }

        function formatTime(secs) {
            if (isNaN(secs) || secs < 0) secs = 0;
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = Math.floor(secs % 60);
            if (h > 0) {
                return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
            }
            return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }

        // --- MOBILE GESTURES ---
        let startX = 0, startY = 0;
        let isDragging = false;
        let dragType = null; // 'volume', 'brightness', 'seek'
        let initialValue = 0;
        let initialTime = 0;
        let targetSeekTime = 0;
        let brightness = 100;
        let lastTap = 0;

        container.addEventListener('touchstart', (e) => {
            if (e.target.closest('.plyr__controls') || e.target.closest('button')) return;
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX || e.touches[0].pageX;
                startY = e.touches[0].clientY || e.touches[0].pageY;
                isDragging = false;
                dragType = null;
                initialTime = (player && player.currentTime !== undefined) ? player.currentTime : (video.currentTime || 0);
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (e.target.closest('.plyr__controls') || e.target.closest('button')) return;
            if (e.touches.length === 1) {
                let moveX = e.touches[0].clientX || e.touches[0].pageX;
                let moveY = e.touches[0].clientY || e.touches[0].pageY;
                let diffX = moveX - startX;
                let diffY = moveY - startY;
                let absX = Math.abs(diffX);
                let absY = Math.abs(diffY);
                const rect = container.getBoundingClientRect();

                if (!isDragging && (absX > 18 || absY > 18)) {
                    isDragging = true;
                    // Horizontal Swipe -> Smooth Seek
                    if (absX > absY * 1.15) {
                        dragType = 'seek';
                        initialTime = (player && player.currentTime !== undefined) ? player.currentTime : (video.currentTime || 0);
                        if (seekHud) seekHud.classList.add('active');
                    } else {
                        // Vertical Swipe -> Left = Brightness, Right = Volume
                        const touchX = startX - rect.left;
                        if (touchX < rect.width / 2) {
                            dragType = 'brightness';
                            initialValue = brightness;
                        } else {
                            dragType = 'volume';
                            initialValue = (player ? player.volume : video.volume) * 100;
                        }
                    }
                }

                if (isDragging) {
                    if (dragType === 'seek') {
                        const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
                        const seekWindow = duration > 0 ? Math.min(300, Math.max(60, duration * 0.2)) : 90;
                        const seekDelta = (diffX / (rect.width * 0.7)) * seekWindow;
                        targetSeekTime = Math.max(0, Math.min(duration || Infinity, initialTime + seekDelta));
                        
                        if (seekHud) {
                            const timeEl = seekHud.querySelector('.hud-time');
                            const diffEl = seekHud.querySelector('.hud-diff');
                            const fillEl = seekHud.querySelector('.hud-bar-fill');
                            const iconEl = seekHud.querySelector('.hud-icon');
                            
                            const formattedTarget = formatTime(targetSeekTime);
                            const formattedDuration = duration > 0 ? formatTime(duration) : '';
                            if (timeEl) timeEl.textContent = duration > 0 ? `${formattedTarget} / ${formattedDuration}` : formattedTarget;
                            
                            const diffSecs = Math.round(targetSeekTime - initialTime);
                            if (diffEl) {
                                diffEl.textContent = (diffSecs >= 0 ? `+${diffSecs}s` : `${diffSecs}s`);
                                diffEl.className = `hud-diff font-extrabold ${diffSecs >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
                            }
                            if (fillEl && duration > 0) {
                                fillEl.style.width = `${Math.max(0, Math.min(100, (targetSeekTime / duration) * 100))}%`;
                            }
                        }
                        e.preventDefault();
                    } else if (dragType === 'brightness') {
                        const change = (diffY / rect.height) * -200;
                        brightness = Math.max(10, Math.min(200, initialValue + change));
                        document.body.style.filter = `brightness(${brightness}%)`;
                        showIndicator(`Brightness: ${Math.round(brightness)}%`);
                        e.preventDefault();
                    } else if (dragType === 'volume') {
                        const change = (diffY / rect.height) * -1;
                        const newVolume = Math.max(0, Math.min(1, (initialValue / 100) + change));
                        if (player) player.volume = newVolume; else video.volume = newVolume;
                        showIndicator(`Volume: ${Math.round(newVolume * 100)}%`);
                        e.preventDefault();
                    }
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            if (seekHud) seekHud.classList.remove('active');
            
            if (isDragging && dragType === 'seek') {
                if (targetSeekTime >= 0) {
                    if (player) player.currentTime = targetSeekTime; else video.currentTime = targetSeekTime;
                    showIndicator(`Seeked to ${formatTime(targetSeekTime)}`);
                }
                isDragging = false;
                dragType = null;
                return;
            }

            if (e.touches.length === 0) {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0 && !isDragging) {
                    const rect = container.getBoundingClientRect();
                    const x = (e.changedTouches && e.changedTouches[0]) ? (e.changedTouches[0].clientX - rect.left) : (rect.width / 2);
                    if (x < rect.width * 0.35) {
                        if (player && player.rewind) player.rewind(10); else video.currentTime = Math.max(0, video.currentTime - 10);
                        showIndicator('Rewind 10s «');
                        e.preventDefault();
                    } else if (x > rect.width * 0.65) {
                        if (player && player.forward) player.forward(10); else video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                        showIndicator('Forward 10s »');
                        e.preventDefault();
                    } else {
                        document.body.classList.toggle('video-zoom-fill');
                        showIndicator(document.body.classList.contains('video-zoom-fill') ? 'Zoomed to Fill' : 'Original Fit');
                        e.preventDefault();
                    }
                }
                lastTap = currentTime;
            }
            isDragging = false;
            dragType = null;
        }, { passive: false });

        // Initialize Timeline Touch Scrubbing
        initSmoothTouchTimeline(player, video);
    }

    let fallbackStage = 0; // 0: primary (MPEG-TS or HLS), 1: secondary, 2: native

    function loadStream() {
        try { streamUrl = new URL(streamUrl, window.location.origin).href; } catch(e){}
        const lowerUrl = streamUrl.toLowerCase();
        // Stalker portal streams (live.php) and .m3u8 are HLS streams
        const isHlsStream = lowerUrl.includes('.m3u8') || lowerUrl.includes('live.php') || lowerUrl.includes('m3u8=1') || lowerUrl.includes('playlist.m3u8');
        
        if (isHlsStream && Hls.isSupported()) {
            console.log("[Stream Engine] Detected HLS/Stalker stream, initializing HLS player directly.");
            loadHls(streamUrl);
        } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
            console.log("[Stream Engine] Detected raw TS stream, initializing MPEG-TS player.");
            loadMpegTs(streamUrl);
        } else if (Hls.isSupported()) {
            loadHls(streamUrl);
        } else {
            loadNative(streamUrl);
        }
        
        video.addEventListener('playing', () => {
            overlay.style.display = 'none';
            updateStatus('LIVE', 'bg-emerald-500');
        });
        video.addEventListener('waiting', () => {
            if (video.paused) { video.play().catch(()=>{}); }
            updateStatus('BUFFERING', 'bg-amber-500');
        });
        video.addEventListener('ended', () => {
            triggerHardReconnect();
        });
    }

    function loadNative(urlStr) {
        if (hls) { try { hls.destroy(); hls = null; } catch(e){} }
        if (mpegPlayer) { try { mpegPlayer.destroy(); mpegPlayer = null; } catch(e){} }
        video.src = urlStr;
        video.play().catch(() => {});
    }

    function loadMpegTs(urlStr) {
        if (mpegPlayer) {
            try { mpegPlayer.destroy(); } catch(e){}
            mpegPlayer = null;
        }
        
        console.log("Initializing ultra-low latency MPEG-TS player for direct TS stream");
        mpegPlayer = mpegts.createPlayer({
            type: 'mpegts',
            isLive: true,
            url: urlStr,
            cors: true,
            hasAudio: true,
            hasVideo: true
        }, {
            enableWorker: true,
            enableStashBuffer: true,
            stashInitialSize: 1024 * 1024,      // 1MB pre-buffer for silky smooth start
            lazyLoad: false,
            lazyLoadMaxDuration: 180,
            lazyLoadRecoverDuration: 30,
            deferLoadAfterSourceOpen: false,
            liveBufferLatencyChasing: true,     // Gentle latency chasing
            liveBufferLatencyMaxLatency: 10.0,  // Max 10s ceiling
            liveBufferLatencyMinLatency: 3.0,   // Min 3s solid cushion to prevent micro-stutters
            liveBufferLatencyChasingOnStall: false, // Do not drop frames on brief network jitter
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 60,
            autoCleanupMinBackwardDuration: 30,
            fixAudioTimestampGap: true,         // Synchronize A/V timestamps
            accurateSeek: false,
            reuseRedirectedURL: true
        });
        
        mpegPlayer.attachMediaElement(video);
        mpegPlayer.load();
        
        mpegPlayer.on(mpegts.Events.MEDIA_INFO, () => {
            overlay.style.display = 'none';
            retryAttempt = 0;
            updateStatus('LIVE', 'bg-emerald-500');
            video.play().catch(() => {
                video.muted = true;
                video.play();
            });
        });
        
        mpegPlayer.on(mpegts.Events.ERROR, (type, details, data) => {
            console.warn("MPEG-TS Issue detected (" + details + "). Executing smart fallback...");
            try { mpegPlayer.destroy(); } catch(e){}
            mpegPlayer = null;

            // 1. Try HLS fallback first
            if (Hls.isSupported()) {
                console.log("[Smart Fallback] Transitioning to HLS engine for stream:", urlStr);
                loadHls(urlStr);
                return;
            }

            // 2. Try native direct HTML5 video playback
            video.src = urlStr;
            video.play().catch(() => {
                updateStatus('RECONNECTING', 'bg-amber-500');
                setTimeout(() => triggerHardReconnect(), 2000);
            });
        });
    }

    function loadHls(urlStr) {
        if (hls) {
            hls.destroy();
            hls = null;
        }

        hls = new Hls({
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 8,
            liveDurationIntersection: true,
            maxBufferLength: 30,               // Deep 30s buffer cushion
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,   // 60 MB buffer
            backBufferLength: 30,
            manifestLoadingMaxRetry: 10,
            manifestLoadingRetryDelay: 1000,
            levelLoadingMaxRetry: 10,
            fragLoadingMaxRetry: 10,
            fragLoadingRetryDelay: 500,
            enableWorker: true,
            lowLatencyMode: false,             // Stable buffering over aggressive low latency
            nudgeOffset: 0.1,
            nudgeMaxRetry: 5
        });

        hls.loadSource(urlStr);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            overlay.style.display = 'none';
            retryAttempt = 0;
            video.play().catch(() => {
                video.muted = true;
                video.play();
            });
            updateStatus('LIVE', 'bg-emerald-500');
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("HLS Error:", data.type, data.details);
            
            if (data.details === 'manifestParsingError' || data.details === 'manifestLoadError') {
                console.warn('Manifest parsing failed. Attempting fallback to MPEG-TS...');
                if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                    loadMpegTs(urlStr);
                    return;
                }
            }
            
            if (data.fatal) {
                updateStatus('SIGNAL LOST', 'bg-red-500');
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        overlay.style.display = 'flex';
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        triggerHardReconnect();
                        break;
                }
            } else {
                if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR || data.details === 'bufferStalledError') {
                    updateStatus('BUFFERING', 'bg-amber-500');
                    try { hls.startLoad(); } catch(e){}
                }
            }
        });
    }

    function triggerHardReconnect() {
        retryAttempt++;
        retryCountEl.textContent = retryAttempt;
        overlay.style.display = 'flex';
        updateStatus('RECONNECTING', 'bg-indigo-500');
        
        // Wait 2 seconds before completely tearing down and rebuilding the stream connection
        setTimeout(() => {
            loadStream();
        }, 2000);
    }

    function forceReconnect() {
        retryAttempt = 0;
        triggerHardReconnect();
    }

    // Start
    document.addEventListener('DOMContentLoaded', initPlayer);

</script>
    <script src="assets/local-ai.js?v=2.0"></script>
</body>
</html>
