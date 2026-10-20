<?php
$stream_url = isset($_GET['url']) ? $_GET['url'] : (isset($_GET['id']) ? $_GET['id'] : '');
$name = isset($_GET['name']) ? $_GET['name'] : 'Live Stream';
$source = isset($_GET['source']) ? $_GET['source'] : 'consumet.html';
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <meta name="theme-color" content="#dc2626">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <title><?php echo htmlspecialchars($name); ?> | Stalker Pro Pure HLS Player</title>

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script>
        (function() {
            var origWarn = console.warn;
            console.warn = function() {
                if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].indexOf('cdn.tailwindcss.com') !== -1) return;
                return origWarn.apply(console, arguments);
            };
        })();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <!-- Plyr, Hls.js & mpegts.js Libraries -->
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
    <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js" crossorigin></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js"></script>
    <style>
        * { -webkit-tap-highlight-color: transparent !important; }
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #000;
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #fff;
        }
        #player-container {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
        }
        .plyr {
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            --plyr-color-main: #ef4444;
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

        /* Player Screen Lock Engine */
        body.player-screen-locked #top-controls,
        body.player-screen-locked .plyr__controls,
        body.player-screen-locked .vjs-control-bar,
        body.player-screen-locked #embed-zoom-controls,
        body.player-screen-locked .vjs-big-play-button,
        body.player-screen-locked #engineIndicatorBadge,
        body.player-screen-locked #unmuteBadge,
        body.player-screen-locked #touchGestureOverlay,
        body.player-screen-locked #player-error,
        body.player-screen-locked #engineModal,
        body.player-screen-locked #qualityModal,
        body.player-screen-locked .plyr__captions {
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
            transform: translateY(-16px) !important;
        }

        #player-unlock-btn {
            position: fixed !important;
            top: 1.25rem !important;
            right: 1.25rem !important;
            z-index: 2147483647 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 0.5rem !important;
            padding: 0.65rem 1.15rem !important;
            border-radius: 9999px !important;
            background: rgba(220, 38, 38, 0.95) !important;
            color: #ffffff !important;
            border: 1px solid rgba(255, 255, 255, 0.4) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(220, 38, 38, 0.6) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            font-size: 0.75rem !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            cursor: pointer !important;
            transition: opacity 0.35s ease, transform 0.35s ease !important;
            will-change: opacity, transform;
            -webkit-tap-highlight-color: transparent !important;
        }
        #player-unlock-btn:hover {
            background: rgba(239, 68, 68, 1) !important;
            transform: scale(1.06) !important;
        }
        #player-unlock-btn:active {
            transform: scale(0.95) !important;
        }
        #player-unlock-btn.unlock-hidden {
            opacity: 0 !important;
            pointer-events: none !important;
            transform: translateY(-12px) !important;
        }

        #player-lock-overlay {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483646 !important;
            background: rgba(0, 0, 0, 0.001) !important;
            cursor: pointer !important;
            display: none !important;
            touch-action: manipulation !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        body.player-screen-locked #player-lock-overlay {
            display: block !important;
        }
        .plyr--video input[type="range"]:active::-moz-range-thumb,
        .plyr__progress.is-scrubbing input[type="range"]::-moz-range-thumb {
            transform: scale(1.45) !important;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 0 7px rgba(239, 68, 68, 0.35) !important;
        }
        /* Live Stream Timeline & Timestamp Optimization: Clean presentation without / 00:00 */
        .is-live-stream .plyr__time--duration,
        .plyr--is-live .plyr__time--duration {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
        }
        .is-live-stream .plyr__time--current::after,
        .plyr--is-live .plyr__time--current::after {
            display: none !important;
            content: "" !important;
        }
        .is-live-stream .plyr__time--current,
        .plyr--is-live .plyr__time--current {
            padding-right: 4px !important;
            font-variant-numeric: tabular-nums !important;
        }
        .plyr__tooltip {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
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
            z-index: 10002;
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
        .plyr__video-wrapper {
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
            transition: transform 0.3s ease, object-fit 0.3s ease;
        }
        video.fit-cover {
            object-fit: cover !important;
        }
        video.fit-fill {
            object-fit: fill !important;
        }
        video.zoom-120 {
            transform: scale(1.2) !important;
        }
        /* Loading Overlay */
        #loading {
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .loading-text {
            font-size: 1.75rem;
            font-weight: 800;
            letter-spacing: 0.15em;
            display: flex;
            gap: 4px;
        }
        .loading-text span {
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        /* Gestures Indicators */
        #zoom-indicator {
            position: absolute;
            top: 2rem;
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
            z-index: 10000;
            backdrop-filter: blur(8px);
        }
        #gesture-ripple {
            position: absolute;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.3);
            pointer-events: none;
            transform: scale(0);
            opacity: 0;
            transition: transform 0.4s ease-out, opacity 0.4s ease-out;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 1.25rem;
            color: #fff;
        }
        /* Sleep Timer Indicator */
        #sleep-indicator {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(0, 0, 0, 0.75);
            border: 1px solid rgba(239, 68, 68, 0.4);
            padding: 0.35rem 0.85rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 800;
            color: #ef4444;
            display: none;
            align-items: center;
            gap: 0.4rem;
            z-index: 9999;
            backdrop-filter: blur(8px);
        }
        /* Disable TV spatial navigation borders */
    *:focus, *:focus-visible, *:-webkit-direct-focus, *:focus-within { 
        outline: none !important; 
        outline-width: 0 !important;
        box-shadow: none !important; 
        -webkit-tap-highlight-color: transparent !important;
    }
    ::-moz-focus-inner {
        border: 0;
    }
    .tv-focus-disabled {
        outline: none !important;
    }
</style>
    <style>
        .plyr { touch-action: pan-y pinch-zoom !important; }
    </style>
    <link rel="icon" type="image/png" href="stalker_pro_infinity.svg">
</head>
<body>
    <!-- Loading Screen -->
    <div id="loading">
        <div class="loading-text mb-4">
            <span class="text-red-500">P</span>
            <span class="text-red-500">U</span>
            <span class="text-red-500">R</span>
            <span class="text-red-500">E</span>
            <span class="text-white ml-2">H</span>
            <span class="text-white">L</span>
            <span class="text-white">S</span>
        </div>
        <p class="text-xs text-zinc-400 font-medium uppercase tracking-widest mb-6">Initializing High-Speed Stream...</p>
        <div id="loading-fallback" class="hidden">
             <button onclick="location.reload()" class="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/10 transition-all flex items-center gap-2 backdrop-blur-sm cursor-pointer">
                 <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                 <span>Stream slow? <strong class="ml-1">Force Reload</strong></span>
             </button>
        </div>
    </div>
    <!-- Floating Indicators -->
    <div id="zoom-indicator">Fit to Screen</div>
    <div id="gesture-ripple"></div>
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3.5 h-3.5 animate-pulse"></i>
        <span id="sleep-time">00:00</span>
    </div>
    <!-- Main Player Canvas -->
    <div id="player-container">
        <video id="player" autoplay playsinline crossorigin="anonymous"></video>
    </div>
    <!-- Sleep Timer Modal -->
    <div id="sleepModal" class="hidden fixed inset-0 z-[10001] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 text-red-500">
                <i data-lucide="clock" class="w-6 h-6"></i>
            </div>
            <h3 class="text-lg font-bold text-white mb-1">Set Sleep Timer</h3>
            <p class="text-xs text-zinc-400 mb-6">Playback will pause automatically when timer expires.</p>
            <div class="grid grid-cols-2 gap-3 mb-6">
                <button onclick="setSleepTimer(15)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700">15 Minutes</button>
                <button onclick="setSleepTimer(30)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700">30 Minutes</button>
                <button onclick="setSleepTimer(45)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700">45 Minutes</button>
                <button onclick="setSleepTimer(60)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700">60 Minutes</button>
            </div>
            <div class="flex gap-3">
                <button onclick="setSleepTimer(0)" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-xs rounded-xl transition-all">Turn Off</button>
                <button onclick="closeSleepModal()" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all">Cancel</button>
            </div>
        </div>
    </div>
    <!-- Multi-Audio Modal -->
    <div id="audioModal" class="hidden fixed inset-0 z-[10002] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="volume-2" class="w-5 h-5 text-red-500"></i> Audio Tracks
                </h3>
                <button onclick="closeAudioModal()" class="text-zinc-400 hover:text-white p-1">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="audio-tracks-list" class="space-y-2 max-h-60 overflow-y-auto pr-1">
                <p class="text-xs text-zinc-500 text-center py-4">No secondary audio tracks detected</p>
            </div>
        </div>
    </div>
    <!-- Subtitles Modal -->
    <div id="subtitleModal" class="hidden fixed inset-0 z-[10002] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="subtitles" class="w-5 h-5 text-red-500"></i> Subtitles & Captions
                </h3>
                <button onclick="closeSubtitleModal()" class="text-zinc-400 hover:text-white p-1">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="subtitle-tracks-list" class="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1">
                <p class="text-xs text-zinc-500 text-center py-2">No embedded captions found</p>
            </div>
            <div class="border-t border-zinc-800 pt-4">
                <label class="block text-xs font-semibold text-zinc-400 mb-2">Upload Custom Subtitles (.srt, .vtt)</label>
                <input type="file" id="sub-file-input" accept=".srt,.vtt" class="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"/>
            </div>
        </div>
    </div>
    <!-- 4K & 8K Resolution Quality Selector Modal -->
    <div id="qualityModal" class="hidden fixed inset-0 z-[10002] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-5 h-5 text-red-500"></i> Stream Quality (4K/8K)
                </h3>
                <button onclick="closeQualityModal()" class="text-zinc-400 hover:text-white p-1">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="quality-tracks-list" class="space-y-2 max-h-60 overflow-y-auto pr-1">
                <p class="text-xs text-zinc-500 text-center py-4">Detecting video resolution levels...</p>
            </div>
        </div>
    </div>
    <!-- Error Overlay -->
    <div id="player-error" class="hidden fixed inset-0 z-[10001] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
        <div class="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 text-red-500">
                <i data-lucide="alert-triangle" class="w-8 h-8 animate-pulse"></i>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">Stream Playback Failed</h3>
            <p id="error-message-text" class="text-zinc-400 text-sm mb-6 leading-relaxed">Unable to establish connection with stream provider. The link may be offline or blocked.</p>
            <div class="flex flex-col gap-3 w-full max-w-sm">
                <div class="flex gap-3 w-full">
                    <button onclick="location.reload()" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm rounded-xl transition-all border border-zinc-700 flex justify-center items-center gap-2 cursor-pointer">
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Retry
                    </button>
                    <button onclick="try { sessionStorage.setItem('consumet_player_opened', '1'); } catch(e){} window.history.back()" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm rounded-xl transition-all border border-zinc-700 flex justify-center items-center gap-2 cursor-pointer">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
                    </button>
                </div>
                <button onclick="removeBrokenChannel()" id="remove-broken-btn" class="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 flex justify-center items-center gap-2 cursor-pointer border border-red-500">
                    <i data-lucide="trash-2" class="w-4 h-4"></i> Remove Dead Channel from DB
                </button>
            </div>
        </div>
    </div>
    <script>
        window.currentRotation = 0;
        window.originalContainerStyles = null;
        window.toggleRotation = function() {
            if (screen.orientation && screen.orientation.lock) {
                const currentType = screen.orientation.type;
                if (currentType.startsWith('portrait')) {
                    screen.orientation.lock('landscape').catch(e => {
                        console.warn("Screen orientation lock failed:", e);
                        fallbackRotation();
                    });
                } else {
                    screen.orientation.lock('portrait').catch(e => {
                        console.warn("Screen orientation lock failed:", e);
                        fallbackRotation();
                    });
                }
            } else {
                fallbackRotation();
            }
            function fallbackRotation() {
                const playerContainer = document.getElementById('player-container');
                if (!playerContainer) return;
                if (!window.originalContainerStyles) {
                    window.originalContainerStyles = {
                        position: playerContainer.style.position || window.getComputedStyle(playerContainer).position,
                        width: playerContainer.style.width || window.getComputedStyle(playerContainer).width,
                        height: playerContainer.style.height || window.getComputedStyle(playerContainer).height,
                        top: playerContainer.style.top || window.getComputedStyle(playerContainer).top,
                        left: playerContainer.style.left || window.getComputedStyle(playerContainer).left,
                        zIndex: playerContainer.style.zIndex || window.getComputedStyle(playerContainer).zIndex
                    };
                }
                window.currentRotation = (window.currentRotation + 90) % 360;
                if (window.currentRotation === 90 || window.currentRotation === 270) {
                    playerContainer.style.width = window.innerHeight + 'px';
                    playerContainer.style.height = window.innerWidth + 'px';
                    playerContainer.style.position = 'fixed';
                    playerContainer.style.top = '50%';
                    playerContainer.style.left = '50%';
                    playerContainer.style.transform = `translate(-50%, -50%) rotate(${window.currentRotation}deg)`;
                    playerContainer.style.zIndex = '9999';
                } else {
                    playerContainer.style.width = window.originalContainerStyles.width;
                    playerContainer.style.height = window.originalContainerStyles.height;
                    playerContainer.style.position = window.originalContainerStyles.position;
                    playerContainer.style.top = window.originalContainerStyles.top;
                    playerContainer.style.left = window.originalContainerStyles.left;
                    playerContainer.style.transform = `rotate(${window.currentRotation}deg)`;
                    playerContainer.style.zIndex = window.originalContainerStyles.zIndex;
                }
                const indicator = document.getElementById('zoom-indicator') || document.getElementById('indicator');
                if (indicator) {
                    indicator.textContent = 'Rotated ' + window.currentRotation + '°';
                    indicator.style.opacity = '1';
                    setTimeout(() => indicator.style.opacity = '0', 1500);
                }
            }
        };

        window.toggleScreenLock = function(lockState) {
            let unlockBtn = document.getElementById('player-unlock-btn');
            let lockOverlay = document.getElementById('player-lock-overlay');

            if (!lockOverlay) {
                lockOverlay = document.createElement('div');
                lockOverlay.id = 'player-lock-overlay';
                const triggerReveal = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    revealUnlockBtnOnTouch(e);
                };
                lockOverlay.onclick = triggerReveal;
                lockOverlay.ontouchstart = triggerReveal;
                lockOverlay.onpointerdown = triggerReveal;
            }

            if (!unlockBtn) {
                unlockBtn = document.createElement('button');
                unlockBtn.id = 'player-unlock-btn';
                unlockBtn.type = 'button';
                unlockBtn.className = 'unlock-hidden';
                unlockBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>Unlock Screen</span>';
                const doUnlock = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.toggleScreenLock(false);
                };
                unlockBtn.onclick = doUnlock;
                unlockBtn.ontouchstart = doUnlock;
            }

            const targetParent = document.fullscreenElement || document.querySelector('.plyr') || document.getElementById('player-container') || document.body;
            if (lockOverlay.parentNode !== targetParent) {
                targetParent.appendChild(lockOverlay);
            }
            if (unlockBtn.parentNode !== targetParent) {
                targetParent.appendChild(unlockBtn);
            }

            const shouldLock = (typeof lockState === 'boolean') ? lockState : !document.body.classList.contains('player-screen-locked');

            if (shouldLock) {
                document.body.classList.add('player-screen-locked');
                unlockBtn.classList.remove('unlock-hidden');
                if (typeof showIndicator === 'function') showIndicator('🔒 Screen Controls Locked');
                
                clearTimeout(window._unlockBtnTimer);
                window._unlockBtnTimer = setTimeout(() => {
                    if (document.body.classList.contains('player-screen-locked')) {
                        unlockBtn.classList.add('unlock-hidden');
                    }
                }, 3500);
            } else {
                document.body.classList.remove('player-screen-locked');
                unlockBtn.classList.add('unlock-hidden');
                clearTimeout(window._unlockBtnTimer);
                if (typeof showIndicator === 'function') showIndicator('🔓 Screen Controls Unlocked');
            }
        };

        const revealUnlockBtnOnTouch = (e) => {
            if (document.body.classList.contains('player-screen-locked')) {
                let unlockBtn = document.getElementById('player-unlock-btn');
                if (!unlockBtn) {
                    window.toggleScreenLock(true);
                    unlockBtn = document.getElementById('player-unlock-btn');
                }
                if (unlockBtn) {
                    const targetParent = document.fullscreenElement || document.querySelector('.plyr') || document.getElementById('player-container') || document.body;
                    if (unlockBtn.parentNode !== targetParent) {
                        targetParent.appendChild(unlockBtn);
                    }
                    if (e && (e.target === unlockBtn || unlockBtn.contains(e.target))) {
                        return;
                    }
                    unlockBtn.classList.remove('unlock-hidden');
                    clearTimeout(window._unlockBtnTimer);
                    window._unlockBtnTimer = setTimeout(() => {
                        if (document.body.classList.contains('player-screen-locked')) {
                            unlockBtn.classList.add('unlock-hidden');
                        }
                    }, 3500);
                }
            }
        };

        ['click', 'touchstart', 'pointerdown'].forEach(evt => {
            window.addEventListener(evt, revealUnlockBtnOnTouch, { capture: true, passive: true });
        });
        document.addEventListener("DOMContentLoaded", () => {
            document.addEventListener("fullscreenchange", () => {
                if (document.fullscreenElement) {
                    if (screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock("landscape").catch(() => {});
                    }
                } else {
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                }
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
            let src = "<?php echo htmlspecialchars($stream_url); ?>";
            let name = "<?php echo htmlspecialchars($name); ?>";
            let source = "<?php echo htmlspecialchars($source); ?>";
            const urlParams = new URLSearchParams(window.location.search);
            const urlParamsForMedia = urlParams;
            window.urlParamsForMedia = urlParams;
            if (!src) {
                src = urlParams.get('url') || urlParams.get('id') || urlParams.get('stream') || '';
            }
            if (!name || name === 'Live Stream' || name === 'Live Channel') {
                name = urlParams.get('name') || urlParams.get('title') || name;
            }
            let lowerSrc = (src || '').toLowerCase();
            let decodedLowerSrc = lowerSrc;
            try { decodedLowerSrc = decodeURIComponent(lowerSrc); } catch(e) {}
            window.lowerSrc = lowerSrc;
            window.decodedLowerSrc = decodedLowerSrc;
            const video = document.getElementById('player');
            const loading = document.getElementById('loading');
            const zoomIndicator = document.getElementById('zoom-indicator');
            const sleepModal = document.getElementById('sleepModal');
            const sleepIndicator = document.getElementById('sleep-indicator');
            const sleepTimeLabel = document.getElementById('sleep-time');
            let hls = null;
            let mpegPlayer = null;
            let player = null;
            let isReconnecting = false;
            let watchdogTimer = null;
            let lastCurrentTime = -1;
            let lastProgressTime = Date.now();
            let sleepTimerInterval = null;
            let sleepTargetTime = null;
            // Aspect ratio state: 0=fit(contain), 1=fill(cover), 2=stretch(fill), 3=zoom-120
            let aspectState = 0;
            const aspectModes = ['Default (Fit)', 'Fill Screen', 'Stretch 16:9', 'Zoom 120%'];
            function showIndicator(text) {
                if (!zoomIndicator) return;
                zoomIndicator.textContent = text;
                zoomIndicator.style.opacity = '1';
                setTimeout(() => { zoomIndicator.style.opacity = '0'; }, 2000);
            }
            function toggleAspectRatio() {
                aspectState = (aspectState + 1) % aspectModes.length;
                video.classList.remove('fit-cover', 'fit-fill', 'zoom-120');
                if (aspectState === 1) video.classList.add('fit-cover');
                else if (aspectState === 2) video.classList.add('fit-fill');
                else if (aspectState === 3) video.classList.add('zoom-120');
                showIndicator(`Aspect Mode: ${aspectModes[aspectState]}`);
            }
            // Audio & Subtitle Modals
            window.toggleAudioModal = function() {
                const modal = document.getElementById('audioModal');
                const list = document.getElementById('audio-tracks-list');
                list.innerHTML = '';
                if (window.hls && window.hls.audioTracks && window.hls.audioTracks.length > 0) {
                    window.hls.audioTracks.forEach((track, idx) => {
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.audioTrack === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<span>${track.name || track.lang || 'Audio Track ' + (idx + 1)}</span> ${window.hls.audioTrack === idx ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.hls.audioTrack = idx;
                            showIndicator('Audio Track: ' + (track.name || track.lang || 'Track ' + (idx + 1)));
                            closeAudioModal();
                        };
                        list.appendChild(btn);
                    });
                } else {
                    list.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Standard Default Audio Active</p>';
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
                modal.classList.remove('hidden');
            };
            window.closeAudioModal = function() {
                document.getElementById('audioModal').classList.add('hidden');
            };
            window.toggleSubtitleModal = function() {
                const modal = document.getElementById('subtitleModal');
                const list = document.getElementById('subtitle-tracks-list');
                list.innerHTML = '';
                if (window.hls && window.hls.subtitleTracks && window.hls.subtitleTracks.length > 0) {
                    const offBtn = document.createElement('button');
                    offBtn.className = `w-full text-left px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.subtitleTrack === -1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    offBtn.innerHTML = '<span>Off</span>';
                    offBtn.onclick = () => { window.hls.subtitleTrack = -1; closeSubtitleModal(); };
                    list.appendChild(offBtn);
                    window.hls.subtitleTracks.forEach((track, idx) => {
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.subtitleTrack === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<span>${track.name || track.lang || 'Subtitle ' + (idx + 1)}</span>`;
                        btn.onclick = () => { window.hls.subtitleTrack = idx; closeSubtitleModal(); };
                        list.appendChild(btn);
                    });
                } else {
                    list.innerHTML = '<p class="text-xs text-zinc-500 text-center py-2">No embedded captions found</p>';
                }
                modal.classList.remove('hidden');
            };
            window.closeSubtitleModal = function() {
                document.getElementById('subtitleModal').classList.add('hidden');
            };
            // Quality Modal (4K / 8K / 1080p / Auto)
            window.toggleQualityModal = function() {
                const modal = document.getElementById('qualityModal');
                const list = document.getElementById('quality-tracks-list');
                list.innerHTML = '';
                if (window.hls && window.hls.levels && window.hls.levels.length > 0) {
                    // Auto Option
                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.currentLevel === -1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 4K/HD)</span> ${window.hls.currentLevel === -1 ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.hls.currentLevel = -1;
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);
                    window.hls.levels.forEach((level, idx) => {
                        let label = `${level.height || 'SD'}p`;
                        let badge = '';
                        if (level.height >= 4320) {
                            label = '8K Ultra HD (7680x4320)';
                            badge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-black text-[10px] uppercase border border-amber-500/30">8K UHD</span>';
                        } else if (level.height >= 2160) {
                            label = '4K Ultra HD (3840x2160)';
                            badge = '<span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black text-[10px] uppercase border border-red-500/30">4K UHD</span>';
                        } else if (level.height >= 1440) {
                            label = '2K QHD (2560x1440)';
                            badge = '<span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">2K</span>';
                        } else if (level.height >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (level.height >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        }
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.currentLevel === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${window.hls.currentLevel === idx ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.hls.currentLevel = idx;
                            if (level.height >= 2160) {
                                window.hls.config.maxBufferLength = 60;
                                window.hls.config.maxMaxBufferLength = 300;
                            }
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else if (window.shakaPlayer && typeof window.shakaPlayer.getVariantTracks === 'function' && window.shakaPlayer.getVariantTracks().length > 0) {
                    const tracks = window.shakaPlayer.getVariantTracks();
                    const isAbr = window.shakaPlayer.getConfiguration().abr.enabled;
                    const activeTrack = tracks.find(t => t.active);

                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isAbr ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 1080p/HD)</span> ${isAbr ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.shakaPlayer.configure({ abr: { enabled: true } });
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);

                    const uniqueHeights = Array.from(new Set(tracks.map(t => t.height).filter(Boolean))).sort((a, b) => b - a);
                    uniqueHeights.forEach(h => {
                        const matchedTrack = tracks.find(t => t.height === h);
                        const isCurrent = !isAbr && activeTrack && activeTrack.height === h;
                        let label = `${h}p`;
                        let badge = '';
                        if (h >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (h >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        } else if (h >= 540) {
                            label = '540p qHD';
                            badge = '<span class="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 font-bold text-[10px]">SD</span>';
                        }
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isCurrent ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${isCurrent ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.shakaPlayer.configure({ abr: { enabled: false } });
                            window.shakaPlayer.selectVariantTrack(matchedTrack, true);
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else if (window.dashPlayer && typeof window.dashPlayer.getBitrateInfoListFor === 'function') {
                    const bitrates = window.dashPlayer.getBitrateInfoListFor('video');
                    const autoSwitch = window.dashPlayer.getSettings()?.streaming?.abr?.autoSwitchBitrate?.video !== false;
                    const currentQual = window.dashPlayer.getQualityFor('video');

                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${autoSwitch ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 1080p/HD)</span> ${autoSwitch ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.dashPlayer.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);

                    bitrates.forEach((b, idx) => {
                        let label = `${b.height || 'SD'}p`;
                        let badge = '';
                        if (b.height >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (b.height >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        }
                        const isCurrent = !autoSwitch && currentQual === idx;
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isCurrent ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${isCurrent ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.dashPlayer.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
                            window.dashPlayer.setQualityFor('video', idx);
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else {
                    list.innerHTML = `
                        <div class="space-y-2 py-2">
                            <p class="text-xs text-zinc-400 text-center font-bold">Standard Single Stream Active</p>
                            <div class="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/50 text-center">
                                <span class="px-2.5 py-1 rounded bg-red-600/30 text-red-400 font-black text-xs uppercase tracking-wider inline-block">4K / 8K Passthrough Ready</span>
                                <p class="text-[11px] text-zinc-400 mt-1">Hardware acceleration and native 4K/8K decoding enabled.</p>
                            </div>
                        </div>
                    `;
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
                modal.classList.remove('hidden');
            };
            window.closeQualityModal = function() {
                document.getElementById('qualityModal').classList.add('hidden');
            };
            // Custom Subtitle File Handling (.srt / .vtt)
            document.addEventListener('change', (e) => {
                if (e.target && e.target.id === 'sub-file-input') {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        let text = evt.target.result;
                        if (file.name.endsWith('.srt')) {
                            text = 'WEBVTT\n\n' + text.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
                        }
                        const blob = new Blob([text], { type: 'text/vtt' });
                        const subUrl = URL.createObjectURL(blob);
                        const existingTracks = video.querySelectorAll('track');
                        existingTracks.forEach(t => t.remove());
                        const track = document.createElement('track');
                        track.kind = 'subtitles';
                        track.label = file.name;
                        track.srclang = 'custom';
                        track.src = subUrl;
                        track.default = true;
                        video.appendChild(track);
                        showIndicator('Subtitles Loaded: ' + file.name);
                        closeSubtitleModal();
                    };
                    reader.readAsText(file);
                }
            });
            // Sleep Timer
            window.toggleSleepTimer = function() {
                sleepModal.classList.remove('hidden');
            };
            window.closeSleepModal = function() {
                sleepModal.classList.add('hidden');
            };
            window.setSleepTimer = function(minutes) {
                closeSleepModal();
                if (sleepTimerInterval) clearInterval(sleepTimerInterval);
                if (minutes <= 0) {
                    sleepIndicator.style.display = 'none';
                    showIndicator('Sleep Timer Cancelled');
                    return;
                }
                sleepTargetTime = Date.now() + (minutes * 60 * 1000);
                sleepIndicator.style.display = 'flex';
                showIndicator(`Sleep Timer: ${minutes} Minutes`);
                sleepTimerInterval = setInterval(() => {
                    const remaining = Math.max(0, Math.floor((sleepTargetTime - Date.now()) / 1000));
                    if (remaining <= 0) {
                        clearInterval(sleepTimerInterval);
                        if (player) player.pause();
                        video.pause();
                        sleepIndicator.style.display = 'none';
                        showIndicator('Sleep Timer Expired: Stream Paused');
                    } else {
                        const m = Math.floor(remaining / 60);
                        const s = remaining % 60;
                        sleepTimeLabel.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            };
            async function removeBrokenChannel() {
                const btn = document.getElementById('remove-broken-btn');
                btn.innerHTML = '<i class="w-4 h-4 animate-spin" data-lucide="loader-2"></i> Removing...';
                try {
                    const res = await fetch('/api/remove-broken-channel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stream_url: src })
                    });
                    const data = await res.json();
                    if (data.success) {
                        btn.classList.replace('bg-red-600', 'bg-emerald-600');
                        btn.classList.replace('hover:bg-red-700', 'hover:bg-emerald-700');
                        btn.classList.replace('border-red-500', 'border-emerald-500');
                        btn.innerHTML = '<i class="w-4 h-4" data-lucide="check"></i> Removed Forever';
                        setTimeout(() => window.history.back(), 1500);
                    } else {
                        btn.innerHTML = '<i class="w-4 h-4" data-lucide="alert-circle"></i> Failed to remove';
                    }
                    lucide.createIcons();
                } catch(e) {
                    btn.innerHTML = 'Error removing';
                }
            }

            function showPlayerError(msg) {
                document.getElementById('error-message-text').innerText = msg;
                document.getElementById('player-error').classList.remove('hidden');
                loading.style.display = 'none';
                if (window.lucide) lucide.createIcons();
            }
            // Top Control Bar Overlay (Back, Title, Aspect, PiP, Sleep, Reconnect)
            function initTopControls(plyrInstance) {
                let topControls = document.getElementById('top-controls');
                if (!topControls) {
                    topControls = document.createElement('div');
                    topControls.id = 'top-controls';
                    topControls.className = 'absolute top-2 left-2 right-2 md:top-6 md:left-6 md:right-6 flex items-center justify-between transition-opacity duration-300 opacity-0 pointer-events-none gap-2';
                    topControls.style.zIndex = '2147483647';
                    // Left controls group
                    const leftGroup = document.createElement('div');
                    leftGroup.className = 'flex items-center gap-2 sm:gap-3 pointer-events-auto shrink-0';
                    // Back button
                    const backBtn = document.createElement('button');
                    backBtn.onclick = () => {
                        try { sessionStorage.setItem('consumet_player_opened', '1'); } catch(e){}
                        window.history.back();
                    };
                    backBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-5 h-5"></i>';
                    leftGroup.appendChild(backBtn);
                    // Rotate Button (Screen Left End)
                    const rotateBtn = document.createElement('button');
                    rotateBtn.title = "Rotate View (Portrait / Landscape)";
                    rotateBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    rotateBtn.innerHTML = '<i data-lucide="smartphone" class="w-5 h-5"></i>';
                    rotateBtn.onclick = (e) => { e.stopPropagation(); window.toggleRotation(); };
                    leftGroup.appendChild(rotateBtn);
                    // Title pill
                    const titlePill = document.createElement('div');
                    titlePill.className = 'flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full backdrop-blur-md max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md truncate';
                    titlePill.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span><span class="text-[10px] sm:text-xs md:text-sm font-bold text-white truncate">${name}</span>`;
                    leftGroup.appendChild(titlePill);
                    topControls.appendChild(leftGroup);
                    // Right controls group
                    const rightGroup = document.createElement('div');
                    rightGroup.className = 'flex items-center gap-2 sm:gap-3 pointer-events-auto';
                    // Reconnect Button
                    const reconnectBtn = document.createElement('button');
                    reconnectBtn.title = "Force Reconnect Stream";
                    reconnectBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    reconnectBtn.innerHTML = '<i data-lucide="rotate-ccw" class="w-5 h-5"></i>';
                    reconnectBtn.onclick = (e) => { e.stopPropagation(); triggerAutoReconnect(); };
                    rightGroup.appendChild(reconnectBtn);
                    // Aspect Ratio Button
                    const aspectBtn = document.createElement('button');
                    aspectBtn.title = "Toggle Aspect Ratio";
                    aspectBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    aspectBtn.innerHTML = '<i data-lucide="maximize" class="w-5 h-5"></i>';
                    aspectBtn.onclick = (e) => { e.stopPropagation(); toggleAspectRatio(); };
                    rightGroup.appendChild(aspectBtn);
                    // Quality Selector Button (4K / 8K)
                    const qualityBtn = document.createElement('button');
                    qualityBtn.title = "Stream Quality (4K / 8K / HD)";
                    qualityBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    qualityBtn.innerHTML = '<i data-lucide="sparkles" class="w-5 h-5 text-amber-400"></i>';
                    qualityBtn.onclick = (e) => { e.stopPropagation(); window.toggleQualityModal(); };
                    rightGroup.appendChild(qualityBtn);
                    // AI Stream Doctor Button
                    const aiDoctorBtn = document.createElement('button');
                    aiDoctorBtn.title = "AI Stream Doctor (Instant Self-Healing & Diagnostics)";
                    aiDoctorBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-sky-400 rounded-full transition-all duration-300 shadow-lg border border-sky-500/30 backdrop-blur-md cursor-pointer';
                    aiDoctorBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3" fill="#38bdf8"/></svg>';
                    aiDoctorBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (window.AiStreamDoctor) {
                            window.AiStreamDoctor.showIndicator('AI Doctor: Optimizing Stream...', false);
                            window.AiStreamDoctor.heal('Manual AI Doctor Trigger');
                        }
                    };
                    rightGroup.appendChild(aiDoctorBtn);
                    // Audio Track Button
                    const audioBtn = document.createElement('button');
                    audioBtn.title = "Audio Tracks";
                    audioBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    audioBtn.innerHTML = '<i data-lucide="volume-2" class="w-5 h-5"></i>';
                    audioBtn.onclick = (e) => { e.stopPropagation(); window.toggleAudioModal(); };
                    rightGroup.appendChild(audioBtn);
                    // Subtitle Button
                    const subBtn = document.createElement('button');
                    subBtn.title = "Subtitles & Captions";
                    subBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    subBtn.innerHTML = '<i data-lucide="subtitles" class="w-5 h-5"></i>';
                    subBtn.onclick = (e) => { e.stopPropagation(); window.toggleSubtitleModal(); };
                    rightGroup.appendChild(subBtn);
                    // Sleep Timer Button
                    const sleepBtn = document.createElement('button');
                    sleepBtn.title = "Set Sleep Timer";
                    sleepBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    sleepBtn.innerHTML = '<i data-lucide="clock" class="w-5 h-5"></i>';
                    sleepBtn.onclick = (e) => { e.stopPropagation(); window.toggleSleepTimer(); };
                    rightGroup.appendChild(sleepBtn);

                    // Watch Together (Party Mode) Button
                    const partyBtn = document.createElement('button');
                    partyBtn.id = 'party-mode-btn';
                    partyBtn.title = "Watch Together (Party Mode)";
                    partyBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-pink-600/30 hover:bg-pink-600 text-pink-400 hover:text-white rounded-full transition-all duration-300 shadow-lg border border-pink-500/40 backdrop-blur-md cursor-pointer';
                    partyBtn.innerHTML = '<i data-lucide="users" class="w-5 h-5"></i>';
                    partyBtn.onclick = (e) => { e.stopPropagation(); if (typeof window.togglePartyModal === 'function') window.togglePartyModal(true); };
                    rightGroup.appendChild(partyBtn);

                    // Movie & Stream Info Details Button
                    const infoBtn = document.createElement('button');
                    infoBtn.id = 'stream-info-btn';
                    infoBtn.title = "Movie & Stream Details";
                    infoBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    infoBtn.innerHTML = '<i data-lucide="info" class="w-5 h-5 text-amber-400"></i>';
                    infoBtn.onclick = (e) => { e.stopPropagation(); if (typeof window.openMediaInfoModal === 'function') window.openMediaInfoModal(e, (typeof stream_id !== 'undefined' ? stream_id : src), name, src, 'movie'); };
                    rightGroup.appendChild(infoBtn);

                    // Chromecast & AirPlay Button
                    const castBtn = document.createElement('button');
                    castBtn.id = 'stream-cast-btn';
                    castBtn.title = "Cast to TV / Chromecast / AirPlay";
                    castBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white rounded-full transition-all duration-300 shadow-lg border border-cyan-500/30 backdrop-blur-md cursor-pointer';
                    castBtn.innerHTML = '<i data-lucide="cast" class="w-5 h-5"></i>';
                    castBtn.onclick = (e) => { e.stopPropagation(); if (typeof window.startCastSession === 'function') window.startCastSession(); };
                    rightGroup.appendChild(castBtn);
                    // Screen Lock Button (Hide all screen controls & buttons)
                    const lockBtn = document.createElement('button');
                    lockBtn.id = 'btn-lock-top';
                    lockBtn.title = "Lock Screen Controls (Hide All Buttons)";
                    lockBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded-full transition-all duration-300 shadow-lg border border-red-500/40 backdrop-blur-md cursor-pointer';
                    lockBtn.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
                    lockBtn.onclick = (e) => { e.stopPropagation(); window.toggleScreenLock(true); };
                    rightGroup.appendChild(lockBtn);

                    // Download Button
                    const downloadBtn = document.createElement('button');
                    downloadBtn.title = "Download Video";
                    downloadBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    downloadBtn.innerHTML = '<i data-lucide="download" class="w-5 h-5"></i>';
                    downloadBtn.onclick = (e) => {
                        e.stopPropagation();
                        let dlUrl = `/live.php?url=${encodeURIComponent(src)}&download=1&title=${encodeURIComponent(name || 'video')}`;
                        if (src.includes('live.php')) {
                            dlUrl = src + '&download=1';
                        } else if (src.startsWith('/')) {
                            dlUrl = src + (src.includes('?') ? '&' : '?') + 'download=1';
                        }
                        window.open(dlUrl, '_blank');
                    };
                    rightGroup.appendChild(downloadBtn);

                    // PiP Button
                    if (document.pictureInPictureEnabled || video.webkitSupportsPresentationMode) {
                        const pipBtn = document.createElement('button');
                        pipBtn.title = "Picture in Picture";
                        pipBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                        pipBtn.innerHTML = '<i data-lucide="picture-in-picture-2" class="w-5 h-5"></i>';
                        pipBtn.onclick = async (e) => {
                            e.stopPropagation();
                            try {
                                if (document.pictureInPictureElement) {
                                    await document.exitPictureInPicture();
                                } else {
                                    await video.requestPictureInPicture();
                                }
                            } catch(err) { console.warn("PiP failed:", err); }
                        };
                        rightGroup.appendChild(pipBtn);
                    }
                    topControls.appendChild(rightGroup);
                    const container = plyrInstance?.elements?.container || document.querySelector('.plyr') || document.getElementById('player-container');
                    if (container) {
                        container.appendChild(topControls);
                        ['sleepModal', 'audioModal', 'subtitleModal', 'qualityModal', 'player-error'].forEach(id => {
                            const modal = document.getElementById(id);
                            if (modal && modal.parentElement !== container) {
                                container.appendChild(modal);
                            }
                        });
                    } else {
                        document.body.appendChild(topControls);
                    }
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                let fadeTimer = null;
                let lastTouchTime = 0;

                const showAllUI = (delay = 4500) => {
                    const plyrContainer = document.querySelector('.plyr') || plyrInstance?.elements?.container;
                    const topControls = document.getElementById('top-controls');
                    const zoomControls = document.getElementById('embed-zoom-controls');
                    if (plyrContainer) {
                        plyrContainer.classList.remove('plyr--hide-controls');
                    }
                    if (topControls) {
                        topControls.classList.remove('opacity-0', 'pointer-events-none');
                        topControls.style.opacity = '1';
                        topControls.style.pointerEvents = 'auto';
                        topControls.style.transform = 'translateY(0)';
                    }
                    if (zoomControls) {
                        zoomControls.style.opacity = '1';
                        zoomControls.style.pointerEvents = 'auto';
                    }

                    if (fadeTimer) clearTimeout(fadeTimer);
                    if (delay > 0) {
                        fadeTimer = setTimeout(() => {
                            const activeModal = document.querySelector('#sleepModal:not(.hidden), #player-error:not(.hidden), #engineModal:not(.hidden), #qualityModal:not(.hidden)');
                            if (activeModal) return;

                            const isPaused = plyrInstance ? plyrInstance.paused : false;
                            if (plyrContainer && !isPaused) {
                                plyrContainer.classList.add('plyr--hide-controls');
                                if (topControls) {
                                    topControls.classList.add('opacity-0', 'pointer-events-none');
                                    topControls.style.opacity = '0';
                                    topControls.style.pointerEvents = 'none';
                                    topControls.style.transform = 'translateY(-12px)';
                                }
                                if (zoomControls) {
                                    zoomControls.style.opacity = '0';
                                    zoomControls.style.pointerEvents = 'none';
                                }
                            }
                        }, delay);
                    }
                };
                window.showAllUI = showAllUI;

                const hideAllUI = () => {
                    const plyrContainer = document.querySelector('.plyr') || plyrInstance?.elements?.container;
                    const topControls = document.getElementById('top-controls');
                    const zoomControls = document.getElementById('embed-zoom-controls');
                    const isPaused = plyrInstance ? plyrInstance.paused : false;
                    if (plyrContainer && !isPaused) {
                        plyrContainer.classList.add('plyr--hide-controls');
                        if (topControls) {
                            topControls.classList.add('opacity-0', 'pointer-events-none');
                            topControls.style.opacity = '0';
                            topControls.style.pointerEvents = 'none';
                            topControls.style.transform = 'translateY(-12px)';
                        }
                        if (zoomControls) {
                            zoomControls.style.opacity = '0';
                            zoomControls.style.pointerEvents = 'none';
                        }
                    }
                };
                window.hideAllUI = hideAllUI;

                window.toggleAllUI = function() {
                    const plyrContainer = document.querySelector('.plyr') || plyrInstance?.elements?.container;
                    if (plyrContainer && plyrContainer.classList.contains('plyr--hide-controls')) {
                        showAllUI(4500);
                    } else {
                        hideAllUI();
                    }
                };

                const handleUIInteraction = (e) => {
                    if (e.type === 'touchstart') {
                        lastTouchTime = Date.now();
                    } else if ((e.type === 'click' || e.type === 'pointerdown') && (Date.now() - lastTouchTime < 600)) {
                        return; // Suppress synthetic click after touch
                    }
                    showAllUI(4500);
                };

                ['mousemove', 'touchstart', 'touchmove', 'keydown'].forEach(evt => {
                    window.addEventListener(evt, handleUIInteraction, { passive: true });
                });

                if (plyrInstance) {
                    plyrInstance.on('controlsshown', () => showAllUI(4500));
                    plyrInstance.on('controlshidden', () => {
                        const isPaused = plyrInstance ? plyrInstance.paused : false;
                        if (!isPaused) hideAllUI();
                    });
                }
                showAllUI(4500);
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
                    if (!progressEl) return;
                    const rect = progressEl.getBoundingClientRect();
                    if (!rect || !rect.width) return;
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

                const indicator = document.getElementById('zoom-indicator');
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
                let wasHiddenAtTouchStart = false;

                container.addEventListener('touchstart', (e) => {
                    if (e.target.closest('.plyr__controls') || e.target.closest('button')) return;
                    if (e.touches.length === 1) {
                        const plyrContainer = document.querySelector('.plyr') || container;
                        wasHiddenAtTouchStart = plyrContainer ? plyrContainer.classList.contains('plyr--hide-controls') : false;
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                        isDragging = false;
                        dragType = null;
                        initialTime = (player && player.currentTime !== undefined) ? player.currentTime : (video.currentTime || 0);
                    }
                }, { passive: true });

                container.addEventListener('touchmove', (e) => {
                    if (e.target.closest('.plyr__controls') || e.target.closest('button')) return;
                    if (e.touches.length === 1) {
                        let moveX = e.touches[0].clientX;
                        let moveY = e.touches[0].clientY;
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

                    if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('.modal')) {
                        return;
                    }

                    if (e.touches.length === 0) {
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - lastTap;
                        const rect = container.getBoundingClientRect();
                        const clientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : (rect.left + rect.width / 2);
                        const x = clientX - rect.left;

                        if (tapLength < 320 && tapLength > 0) {
                            // Double tap
                            if (x < rect.width * 0.32) {
                                if (player && player.rewind) player.rewind(10); else video.currentTime = Math.max(0, video.currentTime - 10);
                                showIndicator('Rewind 10s «');
                            } else if (x > rect.width * 0.68) {
                                if (player && player.forward) player.forward(10); else video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                                showIndicator('Forward 10s »');
                            } else {
                                if (video.paused) video.play().catch(() => {}); else video.pause();
                                showIndicator(video.paused ? 'Paused' : '▶ Playing');
                            }
                            lastTap = 0;
                            e.preventDefault();
                        } else {
                            // Single tap
                            lastTap = currentTime;
                            setTimeout(() => {
                                if (!isDragging && (new Date().getTime() - lastTap >= 250)) {
                                    const plyrContainer = document.querySelector('.plyr') || container;
                                    const isCurrentlyHidden = plyrContainer ? plyrContainer.classList.contains('plyr--hide-controls') : false;
                                    if (wasHiddenAtTouchStart || isCurrentlyHidden) {
                                        if (typeof window.showAllUI === 'function') {
                                            window.showAllUI(5000);
                                        } else if (plyrContainer) {
                                            plyrContainer.classList.remove('plyr--hide-controls');
                                        }
                                    } else {
                                        if (typeof window.hideAllUI === 'function') {
                                            window.hideAllUI();
                                        } else if (plyrContainer) {
                                            plyrContainer.classList.add('plyr--hide-controls');
                                        }
                                    }
                                }
                            }, 260);
                        }
                    }
                    isDragging = false;
                    dragType = null;
                }, { passive: false });

                // Initialize Timeline Touch Scrubbing
                initSmoothTouchTimeline(player, video);
            }
                // Keyboard Shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                switch(e.key.toLowerCase()) {
                    case ' ':
                    case 'k':
                        e.preventDefault();
                        if (video.paused) video.play(); else video.pause();
                        break;
                    case 'arrowright':
                    case 'l':
                        e.preventDefault();
                        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                        showIndicator('+10s Forward');
                        break;
                    case 'arrowleft':
                    case 'j':
                        e.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - 10);
                        showIndicator('-10s Rewind');
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        video.volume = Math.min(1, video.volume + 0.1);
                        showIndicator(`Volume: ${Math.round(video.volume * 100)}%`);
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        video.volume = Math.max(0, video.volume - 0.1);
                        showIndicator(`Volume: ${Math.round(video.volume * 100)}%`);
                        break;
                    case 'f':
                        e.preventDefault();
                        if (!document.fullscreenElement) {
                            document.getElementById('player-container').requestFullscreen().catch(() => {});
                        } else {
                            document.exitFullscreen();
                        }
                        break;
                    case 'm':
                        e.preventDefault();
                        video.muted = !video.muted;
                        showIndicator(video.muted ? 'Muted' : 'Unmuted');
                        break;
                    case 'a':
                        e.preventDefault();
                        toggleAspectRatio();
                        break;
                }
            });
            window.reconnectAttempts = 0;
            const MAX_RECONNECT_ATTEMPTS = 999;
            // Smart Auto-Reconnect Watchdog
            window.triggerAutoReconnect = async function() {
                if (isReconnecting) return;
                window.reconnectAttempts++;
                if (window.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.warn(`[Player] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnect loop.`);
                    isReconnecting = false;
                    loading.style.display = 'none';
                    showPlayerError("⚠️ Stream Offline: The upstream provider for this channel is currently offline or returning an invalid stream. Please select another live channel or try again later.");
                    return;
                }
                isReconnecting = true;
                console.warn(`[Player] Triggering Auto-Reconnect (Attempt ${window.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                loading.style.display = 'flex';
                if (typeof destroyMpegPlayer === 'function') {
                    destroyMpegPlayer();
                } else if (mpegPlayer) {
                    try {
                        mpegPlayer.destroy();
                    } catch(e){}
                    mpegPlayer = null;
                }
                if (hls) {
                    try { hls.destroy(); } catch(e){}
                    hls = null;
                }
                const urlParams = new URLSearchParams(window.location.search);
                const rawIdParam = urlParams.get('channel_id') || urlParams.get('channelId') || urlParams.get('id') || urlParams.get('url') || '';
                const isBingrReq = urlParams.has('media_type') || urlParams.has('type') || urlParams.has('tmdbId') || urlParams.has('srv') || (rawIdParam && !isNaN(Number(rawIdParam)) && rawIdParam.length > 3);
                
                if (!isBingrReq && rawIdParam && !rawIdParam.startsWith('http') && !rawIdParam.includes('.mp4') && !rawIdParam.includes('.mkv')) {
                    try {
                        const resolveRes = await fetch(`/api/resolve_stream/${encodeURIComponent(rawIdParam)}?nocache=1`);
                        if (resolveRes.ok) {
                            const resolveData = await resolveRes.json();
                            if (resolveData && resolveData.status === 'success' && resolveData.url) {
                                streamUrl = resolveData.url;
                                console.log('[Auto-Reconnect] Resolved fresh stream token:', streamUrl);
                            }
                        }
                    } catch(e) {
                        console.warn('[Auto-Reconnect] Fresh token resolve failed:', e);
                    }
                }
                setTimeout(() => {
                    isReconnecting = false;
                    initPlayer();
                }, 1500);
            }
            function jumpToSafeLiveBuffer(vid) {
                if (!vid || vid.paused || vid.seeking || !vid.buffered || vid.buffered.length === 0) return;
                const start = vid.buffered.start(0);
                const end = vid.buffered.end(vid.buffered.length - 1);
                // If currentTime is behind buffer start when playing, move safely forward
                if (vid.currentTime < start - 0.5) {
                    console.warn(`[Live Guard] currentTime (${vid.currentTime}) behind buffer start (${start}). Fast-forwarding...`);
                    vid.currentTime = Math.max(start + 0.1, end - 0.5);
                    vid.play().catch(() => {});
                }
            }
            // ===============================================
            // DOCTOR STRANGE AI STREAM DOCTOR (CLIENT AGENT)
            // ===============================================
            window.AiStreamDoctor = {
                isHealing: false,
                healCount: 0,
                lastHealTime: 0,
                
                showIndicator: function(msg, isSuccess = true) {
                    let el = document.getElementById('ai-stream-doctor-pill');
                    if (!el) {
                        el = document.createElement('div');
                        el.id = 'ai-stream-doctor-pill';
                        el.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.92);backdrop-filter:blur(10px);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);transition:opacity 0.3s ease,transform 0.3s ease;pointer-events:none;opacity:0;';
                        document.body.appendChild(el);
                    }
                    el.innerHTML = isSuccess 
                        ? `<span style="color:#10b981;">✨</span> <span>${msg}</span>` 
                        : `<span style="color:#38bdf8;animation:spin 1s linear infinite;display:inline-block;">⚡</span> <span>${msg}</span>`;
                    el.style.opacity = '1';
                    el.style.transform = 'translateX(-50%) translateY(0)';
                    clearTimeout(el._hideTimer);
                    el._hideTimer = setTimeout(() => {
                        el.style.opacity = '0';
                        el.style.transform = 'translateX(-50%) translateY(-6px)';
                    }, 2800);
                },

                heal: async function(errorContext = 'Playback Stall / Error') {
                    const now = Date.now();
                    if (this.isHealing || (now - this.lastHealTime < 2500)) return;
                    this.isHealing = true;
                    this.lastHealTime = now;
                    this.healCount++;

                    const currentStream = window.currentStreamUrl || (video ? video.src : '') || '';
                    const urlParams = new URLSearchParams(window.location.search);
                    const chId = urlParams.get('channel_id') || urlParams.get('id') || '';
                    const chName = urlParams.get('name') || document.title || '';
                    const activeEngine = (typeof shakaPlayer !== 'undefined' && shakaPlayer ? 'shaka' : (typeof hls !== 'undefined' && hls ? 'hls' : 'dash'));
                    const mediaType = urlParams.get('type') || (chId.includes('movie') ? 'movie' : 'sports');
                    const mediaId = urlParams.get('id') || chId;

                    console.log('[AI Stream Doctor] Initiating silent stream healing:', { chName, chId, errorContext });

                    try {
                        const res = await fetch('/api/ai/heal_stream', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: currentStream,
                                channelId: chId,
                                channelName: chName,
                                reportedError: errorContext,
                                playbackTime: video ? video.currentTime : 0,
                                engine: activeEngine,
                                type: mediaType,
                                mediaId: mediaId
                            })
                        });

                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && data.healed && data.healedStream) {
                                const hs = data.healedStream;
                                console.log(`[AI Stream Doctor] Healed in ${data.healingTimeMs}ms:`, hs);

                                if (hs.clearKeys && typeof shakaPlayer !== 'undefined' && shakaPlayer) {
                                    try {
                                        shakaPlayer.configure({ drm: { clearKeys: hs.clearKeys, preferredKeySystems: ['org.w3.clearkey', 'webkit-org.w3.clearkey'] } });
                                    } catch(e) {}
                                }

                                if (hs.url && hs.url !== currentStream) {
                                    window.currentStreamUrl = hs.url;
                                    if (hs.engine === 'shaka' && typeof loadShaka === 'function') {
                                        loadShaka(hs.url, hs.key_id, hs.key);
                                    } else if (hs.engine === 'dash' && typeof loadDash === 'function') {
                                        loadDash(hs.url, hs.key_id, hs.key);
                                    } else if (typeof loadHls === 'function') {
                                        loadHls(hs.url);
                                    } else if (video) {
                                        video.src = hs.url;
                                        video.play().catch(() => {});
                                    }
                                } else if (video) {
                                    video.currentTime = Math.max(0, video.currentTime + 0.4);
                                    if (hls) { try { hls.startLoad(); } catch(e){} }
                                    video.play().catch(() => {});
                                }

                                this.showIndicator(`Stream Healed (${(data.healingTimeMs/1000).toFixed(1)}s)`, true);
                                this.isHealing = false;
                                return true;
                            }
                        }
                    } catch(err) {
                        console.warn('[AI Stream Doctor] Request notice:', err);
                    }

                    if (activeEngine === 'shaka' && typeof loadHls === 'function') {
                        loadHls(currentStream);
                    } else if (activeEngine === 'hls' && typeof loadDash === 'function') {
                        loadDash(currentStream);
                    }

                    this.isHealing = false;
                    return false;
                }
            };

            function startWatchdog() {
                if (watchdogTimer) clearInterval(watchdogTimer);
                lastCurrentTime = video.currentTime;
                lastProgressTime = Date.now();
                watchdogTimer = setInterval(() => {
                    if (isReconnecting || video.paused || video.ended || video.seeking || video.readyState < 2) {
                        lastCurrentTime = video.currentTime;
                        lastProgressTime = Date.now();
                        return;
                    }
                    if (video.currentTime !== lastCurrentTime) {
                        lastCurrentTime = video.currentTime;
                        lastProgressTime = Date.now();
                    } else {
                        const stalledTime = Date.now() - lastProgressTime;
                        // Micro gap jump at 2.2s
                        if (stalledTime >= 2200 && stalledTime < 3800) {
                            video.currentTime = Math.max(0, video.currentTime + 0.35);
                            if (hls) { try { hls.startLoad(); } catch(e){} }
                            if (video.paused && !video.ended) video.play().catch(() => {});
                        } else if (stalledTime >= 3800) {
                            console.warn(`[Watchdog] Stalled for ${(stalledTime/1000).toFixed(1)}s. Invoking AI Stream Doctor...`);
                            lastProgressTime = Date.now();
                            if (window.AiStreamDoctor) {
                                window.AiStreamDoctor.heal(`Playback stalled for ${(stalledTime/1000).toFixed(1)}s`);
                            } else {
                                triggerAutoReconnect();
                            }
                        }
                    }
                }, 1000);
            }
            // Main Player Initialization
            // Main Player Initialization
            async function initPlayer() {
                if (!src) {
                    showPlayerError("No stream URL specified.");
                    return;
                }
                // 15 seconds fallback warning
                setTimeout(() => {
                    const fallbackBtn = document.getElementById('loading-fallback');
                    if (fallbackBtn) fallbackBtn.classList.remove('hidden');
                }, 15000);

                const urlParams = new URLSearchParams(window.location.search);
                const urlParamsForMedia = urlParams;
                window.urlParamsForMedia = urlParams;
                let resolvedSrc = src;
                let lowerSrc = (src || '').toLowerCase();
                let decodedLowerSrc = lowerSrc;
                try { decodedLowerSrc = decodeURIComponent(lowerSrc); } catch(e) {}
                window.lowerSrc = lowerSrc;
                window.decodedLowerSrc = decodedLowerSrc;
                let mediaTypeParam = (urlParams.get('media_type') || urlParams.get('type') || '').toLowerCase();
                let drmKeyId = (urlParams.get('key_id') || urlParams.get('keyid') || '').trim();
                let drmKey = (urlParams.get('key') || '').trim();
                const clearkeyParam = urlParams.get('clearkey');
                if (clearkeyParam && clearkeyParam.includes(':') && (!drmKeyId || !drmKey)) {
                    const ckParts = clearkeyParam.split(':');
                    const pId = (ckParts[0] || '').trim().replace(/[^0-9a-fA-F]/g, '');
                    const pKey = (ckParts[1] || '').trim().replace(/[^0-9a-fA-F]/g, '');
                    if (pId.length === 32 && pKey.length === 32) {
                        drmKeyId = pId;
                        drmKey = pKey;
                    }
                }
                const channelIdParam = (urlParams.get('channel_id') || '').toLowerCase();
                const eventIdParam = (urlParams.get('event_id') || '').toLowerCase();

                // Check for live sporting event
                const isEvent = eventIdParam || channelIdParam.startsWith('live-event-') || channelIdParam.startsWith('cric-event-') || channelIdParam.startsWith('fancode-') || channelIdParam.startsWith('prime-') || channelIdParam.startsWith('sonyliv-') || channelIdParam.startsWith('fc-') || channelIdParam.startsWith('sliv-');
                if (isEvent) {
                    const eventId = eventIdParam || channelIdParam;
                    try {
                        const statusEl = document.getElementById('apple-loading-status');
                        if (statusEl) statusEl.textContent = `Resolving Live Sports Event...`;
                        const res = await fetch(`/api/live/event/${encodeURIComponent(eventId)}`);
                        if (res.ok) {
                            const ev = await res.json();
                            if (ev && (ev.manifest_url || ev.full_stream_url || ev.stream_url)) {
                                src = ev.manifest_url || ev.full_stream_url || ev.stream_url;
                                resolvedSrc = src;
                                if (ev.token) {
                                    window._activeAkamaiToken = ev.token;
                                } else {
                                    const tokenMatch = ((ev.stream_url || '') + ' ' + (ev.full_stream_url || '')).match(/((?:__hdnea__|hdnea|hdntl)=[^&]+)/i);
                                    if (tokenMatch) window._activeAkamaiToken = tokenMatch[1];
                                }
                                if (ev.clearkey) {
                                    window._activeClearKeyString = ev.clearkey;
                                }
                                if (ev.key_id && ev.key) {
                                    const cId = (ev.key_id + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                    const cKey = (ev.key + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                    if (cId.length === 32 && cKey.length === 32) {
                                        drmKeyId = cId;
                                        drmKey = cKey;
                                        window._activeClearKeyId = drmKeyId;
                                        window._activeClearKey = drmKey;
                                    } else {
                                        drmKeyId = '';
                                        drmKey = '';
                                        window._activeClearKeyId = '';
                                        window._activeClearKey = '';
                                    }
                                } else {
                                    drmKeyId = '';
                                    drmKey = '';
                                    window._activeClearKeyId = '';
                                    window._activeClearKey = '';
                                }
                                if (ev.name) {
                                    name = ev.name;
                                    document.title = `${ev.name} | Live Sports`;
                                }
                            }
                        }
                    } catch (e) {}
                }

                // Detect Live TV channels (JioTV, SonyLIV, Hotstar)
                const checkSrc = (src || '').toLowerCase();
                const rawUrl = (urlParams.get('url') || '').toLowerCase();
                const isChannel = channelIdParam.startsWith('jtv-') || channelIdParam.startsWith('mdtv-') || checkSrc.includes('jtv-') || checkSrc.includes('mdtv-') || rawUrl.includes('jtv-') || rawUrl.includes('mdtv-') || channelIdParam.includes('hotstar') || channelIdParam.includes('sonyliv');

                if (isChannel) {
                    let cleanId = channelIdParam.replace(/^(?:jtv|mdtv)[-_]/, '');
                    if (!cleanId) {
                        const m = (checkSrc + ' ' + rawUrl).match(/(?:jtv|mdtv)[-_]([a-zA-Z0-9_-]+)/i);
                        if (m) cleanId = m[1];
                    }
                    if (cleanId) {
                        try {
                            const statusEl = document.getElementById('apple-loading-status');
                            if (statusEl) statusEl.textContent = `Resolving channel ${cleanId}...`;
                            console.log("[Player] Resolving channel stream metadata for:", cleanId);
                            const res = await fetch(`/api/jtv/stream/${encodeURIComponent(cleanId)}`);
                            if (res.ok) {
                                const ch = await res.json();
                                if (ch) {
                                    if (ch.source === 'sonyliv' || ch.source === 'hotstar' || ch.stream_url?.includes('.m3u8') || ch.full_stream_url?.includes('.m3u8')) {
                                        // Direct HLS stream (SonyLIV, Hotstar)
                                        src = ch.full_stream_url || ch.stream_url;
                                        resolvedSrc = src;
                                    } else {
                                        // DASH ClearKey stream (JioTV)
                                        src = ch.manifest_url || `/api/jtv/manifest/${ch.id}.mpd` || `/api/mdtv/manifest/${ch.id}.mpd` || ch.full_stream_url || ch.stream_url;
                                        resolvedSrc = src;
                                        if (ch.token) window._activeAkamaiToken = ch.token;
                                        if (ch.clearkey) window._activeClearKeyString = ch.clearkey;
                                        if (ch.key_id && ch.key) {
                                            const cId = (ch.key_id + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                            const cKey = (ch.key + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                            if (cId.length === 32 && cKey.length === 32) {
                                                drmKeyId = cId;
                                                drmKey = cKey;
                                                window._activeClearKeyId = drmKeyId;
                                                window._activeClearKey = drmKey;
                                            } else {
                                                drmKeyId = '';
                                                drmKey = '';
                                                window._activeClearKeyId = '';
                                                window._activeClearKey = '';
                                            }
                                        } else {
                                            drmKeyId = '';
                                            drmKey = '';
                                            window._activeClearKeyId = '';
                                            window._activeClearKey = '';
                                        }
                                    }
                                    if (ch.name && (!name || name === 'Live Stream' || name === 'Live Channel')) {
                                        name = ch.name;
                                        document.title = `${ch.name} | Live TV`;
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn("[Player] Channel resolution error, attempting direct stream:", err);
                        }
                    }
                }

                // Extract Akamai token if already present in stream URL
                const tokenMatch = (src + ' ' + (urlParams.get('url') || '')).match(/(__hdnea__=[^&]+)/);
                if (tokenMatch && !window._activeAkamaiToken) {
                    window._activeAkamaiToken = tokenMatch[1];
                }

                lowerSrc = (src || '').toLowerCase();
                try {
                    decodedLowerSrc = decodeURIComponent(lowerSrc);
                } catch(e) {}
                window.lowerSrc = lowerSrc;
                window.decodedLowerSrc = decodedLowerSrc;
                mediaTypeParam = (urlParams.get('media_type') || urlParams.get('type') || '').toLowerCase();

                const isFancodeOrSonyliv = (
                    urlParamsForMedia.get('source') === 'fancode' ||
                    urlParamsForMedia.get('source') === 'sonyliv' ||
                    channelIdParam.startsWith('fancode-') ||
                    channelIdParam.startsWith('sonyliv-') ||
                    channelIdParam.startsWith('fc-') ||
                    channelIdParam.startsWith('sliv-') ||
                    lowerSrc.includes('fancode') ||
                    lowerSrc.includes('sonyliv') ||
                    lowerSrc.includes('in-mc-flive') ||
                    lowerSrc.includes('in-ak-flive') ||
                    lowerSrc.includes('sonydaimenew') ||
                    lowerSrc.includes('slivcdn') ||
                    decodedLowerSrc.includes('fancode') ||
                    decodedLowerSrc.includes('sonyliv')
                );

                let isExplicitDash = isFancodeOrSonyliv || (!lowerSrc.includes('.m3u8') && !decodedLowerSrc.includes('.m3u8') && (
                    lowerSrc.includes('.mpd') ||
                    decodedLowerSrc.includes('.mpd') ||
                    mediaTypeParam === 'dash' ||
                    mediaTypeParam === 'mpd' ||
                    (!!drmKeyId && !lowerSrc.includes('.m3u8'))
                ));
                const isMovieOrSeries = urlParamsForMedia.get('media_type') === 'movie' || urlParamsForMedia.get('media_type') === 'series';
                const isMkv = lowerSrc.includes('.mkv') || decodedLowerSrc.includes('.mkv');
                const isForceHls = !isExplicitDash && (urlParamsForMedia.get('type') === 'hls' || urlParamsForMedia.get('hls') === '1' || lowerSrc.includes('type=hls') || lowerSrc.includes('hls=1') || lowerSrc.includes('.m3u8') || lowerSrc.includes('m3u=1'));
                
                // "make hls m3u if it is mkv not hls use mpeg buttery smooth"
                const isExplicitTs = !isExplicitDash && !isForceHls && (
                    isMkv ||
                    lowerSrc.endsWith('.ts') ||
                    lowerSrc.includes('custom_ts=1') ||
                    lowerSrc.includes('type=mpegts') ||
                    lowerSrc.includes('type=ts') ||
                    mediaTypeParam === 'mpegts'
                );

                const isDirectMedia = !isMkv && (isMovieOrSeries || lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.webm') || lowerSrc.endsWith('.avi') || lowerSrc.endsWith('.mp3'));
                if ((src.startsWith('http://') || src.startsWith('https://')) && !src.includes('live.php') && !src.includes('xtream.php')) {
                    if (isExplicitDash || lowerSrc.includes('.mpd') || lowerSrc.includes('jio')) {
                        resolvedSrc = src; // Native DASH ClearKey streams loaded directly by Dash.js
                    } else if (isExplicitTs) {
                        resolvedSrc = `/api/stream-proxy?url=${encodeURIComponent(src)}&type=mpegts`;
                    } else if (isForceHls) {
                        resolvedSrc = `live.php?id=${encodeURIComponent(src)}&type=hls&m3u=1`;
                    } else {
                        resolvedSrc = `live.php?id=${encodeURIComponent(src)}&m3u=1`;
                    }
                }
                try {
                    resolvedSrc = new URL(resolvedSrc, window.location.origin).href;
                } catch(e) {
                    console.warn("URL resolution error:", e);
                }

                let isAutoplayMuted = false;

                function showUnmuteBadge() {
                    let badge = document.getElementById('unmuteFloatingBadge');
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.id = 'unmuteFloatingBadge';
                        badge.className = 'fixed top-6 right-6 z-[99999] flex items-center gap-2.5 px-4 py-2.5 bg-red-600/95 hover:bg-red-500 text-white text-xs sm:text-sm font-black tracking-wide rounded-full shadow-2xl border border-white/30 cursor-pointer select-none backdrop-blur-md transition-all active:scale-95 animate-bounce';
                        badge.innerHTML = `
                            <svg class="w-4 h-4 shrink-0 animate-pulse text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                            <span>TAP OR PRESS OK TO UNMUTE</span>
                        `;
                        badge.onclick = (e) => {
                            e.stopPropagation();
                            unmuteAndPlay();
                        };
                        document.body.appendChild(badge);
                    }
                    badge.style.display = 'flex';
                }

                function hideUnmuteBadge() {
                    const badge = document.getElementById('unmuteFloatingBadge');
                    if (badge) badge.style.display = 'none';
                }

                function unmuteAndPlay() {
                    try {
                        video.muted = false;
                        if (window.plyrPlayer) window.plyrPlayer.muted = false;
                        if (window.player) window.player.muted = false;
                        isAutoplayMuted = false;
                        hideUnmuteBadge();
                        if (video.paused) {
                            video.play().catch(() => {});
                        }
                        console.log("[Audio Recovery] Audio unmuted successfully!");
                    } catch(e) {}
                }

                function triggerSafePlayback(source = 'general') {
                    const p = video.play();
                    if (p !== undefined && p && p.catch) {
                        p.then(() => {
                            console.log(`[Playback Engine] ${source} play() succeeded with audio!`);
                            if (!video.muted) {
                                hideUnmuteBadge();
                            }
                        }).catch(err => {
                            console.warn(`[Playback Engine] ${source} direct unmuted play blocked (${err.name}). Engaging muted autoplay fallback...`);
                            video.muted = true;
                            if (window.plyrPlayer) {
                                try { window.plyrPlayer.muted = true; } catch(e){}
                            }
                            if (window.player) {
                                try { window.player.muted = true; } catch(e){}
                            }
                            isAutoplayMuted = true;
                            video.play().then(() => {
                                console.log(`[Playback Engine] ${source} muted autoplay succeeded! Showing unmute badge.`);
                                showUnmuteBadge();
                            }).catch(e2 => {
                                console.warn(`[Playback Engine] ${source} muted autoplay also blocked (${e2.name}). Awaiting user click.`);
                            });
                        });
                    }
                }

                // Global listener for TV remote, keyboard, touch, clicks to seamlessly unmute
                ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach(evt => {
                    document.addEventListener(evt, () => {
                        if (isAutoplayMuted || video.muted) {
                            unmuteAndPlay();
                        } else if (video.paused && !video.ended) {
                            triggerSafePlayback('user-interaction');
                        }
                    }, { passive: true });
                });

                function destroyMpegPlayer() {
                    if (mpegPlayer) {
                        try {
                            mpegPlayer.destroy();
                        } catch(e){}
                        mpegPlayer = null;
                    }
                }
                function loadMpegTs(streamUrl) {
                    if (!streamUrl || streamUrl.includes('.m3u8') || streamUrl.includes('.mpd')) {
                        console.warn("[MPEG-TS Engine] Skipping MPEG-TS loader for playlist manifest:", streamUrl);
                        if (streamUrl && streamUrl.includes('.mpd')) {
                            loadShaka(streamUrl);
                        } else if (Hls.isSupported()) {
                            loadHls(streamUrl);
                        }
                        return;
                    }
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[MPEG-TS Engine] Initializing buttery-smooth mpegts.js for stream:", streamUrl);
                    destroyMpegPlayer();
                    try {
                        const isLive = !isMkv && (lowerSrc.includes('/live/') || lowerSrc.endsWith('.ts'));
                        mpegPlayer = mpegts.createPlayer({
                            type: 'mpegts',
                            isLive: isLive,
                            url: streamUrl
                        }, {
                            enableWorker: true,
                            enableStashBuffer: true,
                            stashInitialSize: 512 * 1024,
                            liveBufferLatencyChasing: isLive,
                            liveBufferLatencyMaxLatency: 4,
                            liveBufferLatencyMinLatency: 1.5,
                            liveBufferLatencyChasingOnStall: isLive,
                            fixAudioTimestampGap: true,
                            reuse33bitClip: true,
                            autoCleanupSourceBuffer: true,
                            autoCleanupMaxBackwardDuration: 60,
                            autoCleanupMinBackwardDuration: 30,
                            lazyLoad: false
                        });
                        mpegPlayer.attachMediaElement(video);
                        mpegPlayer.load();
                        mpegPlayer.on(mpegts.Events.MEDIA_INFO, (mediaInfo) => {
                            console.log("[MPEG-TS Engine] Media Info parsed:", mediaInfo);
                            reconnectAttempts = 0;
                            if (video.paused) {
                                const p = video.play();
                                if (p && p.catch) {
                                    p.catch(() => {
                                        console.warn("[MPEG-TS] Autoplay unmuted blocked, muting video to auto-start...");
                                        video.muted = true;
                                        video.play().catch(() => {});
                                    });
                                }
                            }
                        });
                        mpegPlayer.on(mpegts.Events.ERROR, (type, details, data) => {
                            console.error('[MPEG-TS Engine Error]', type, details, data);
                            if (type === mpegts.ErrorTypes.MEDIA_ERROR || details === mpegts.ErrorDetails.FORMAT_UNSUPPORTED) {
                                console.warn("[MPEG-TS] Fallback to native or HLS video playback...");
                                destroyMpegPlayer();
                                if (Hls.isSupported()) {
                                    loadHls(streamUrl);
                                } else {
                                    video.src = streamUrl;
                                    video.load();
                                    video.play().catch(e => {
                                        showPlayerError("Playback failed: Incompatible MPEG-TS video/audio codecs or unreachable stream.");
                                    });
                                }
                                return;
                            } else if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
                                console.warn("[MPEG-TS Network Error] Attempting auto-reconnect...");
                                triggerAutoReconnect();
                                return;
                            }
                            triggerAutoReconnect();
                        });
                        // Anti-Freeze & Rate Guard
                        video.addEventListener('ratechange', () => {
                            if (video.playbackRate !== 1.0) {
                                video.playbackRate = 1.0;
                            }
                        });
                    } catch (err) {
                        console.error("[MPEG-TS Engine Init Failed]", err);
                        if (Hls.isSupported()) {
                            loadHls(streamUrl);
                        } else {
                            video.src = streamUrl;
                            video.load();
                            video.play().catch(() => {
                                showPlayerError("Failed to initialize MPEG-TS player: " + (err.message || "Unknown error"));
                            });
                        }
                        return;
                    }
                    if (!player) {
                        player = new Plyr(video, {
                            controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download',
                    'fullscreen'],
                            autoplay: true,
                            muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                clickToPlay: false, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                        window.plyrPlayer = player;
                    }
                    video.style.opacity = '1';
                    loading.style.display = 'none';
                    triggerSafePlayback('MPEG-TS');
                    initTopControls(player);
                    initAdvancedGestures(player, video);
                    startWatchdog();
                    window.mpegPlayer = mpegPlayer;
                }
                function loadHls(streamUrl) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[HLS Engine] Initializing Hls.js for stream:", streamUrl);
                    if (hls) {
                        try { hls.destroy(); } catch(e){}
                        hls = null;
                    }
                    hls = new Hls({
                        enableWorker: true,
                        startFragPrefetch: true,
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                        maxBufferSize: 128 * 1024 * 1024,
                        backBufferLength: 60,
                        maxBufferHole: 0.5,
                        highBufferWatchdogPeriod: 2,
                        nudgeOffset: 0.1,
                        nudgeMaxRetry: 10,
                        liveSyncDurationCount: 3,
                        liveMaxLatencyDurationCount: 8,
                        liveDurationInfinity: true,
                        lowLatencyMode: false,
                        manifestLoadingTimeOut: 25000,
                        manifestLoadingMaxRetry: 6,
                        manifestLoadingRetryDelay: 500,
                        levelLoadingTimeOut: 25000,
                        levelLoadingMaxRetry: 6,
                        levelLoadingRetryDelay: 500,
                        fragLoadingTimeOut: 25000,
                        fragLoadingMaxRetry: 6,
                        fragLoadingRetryDelay: 500,
                        fragLoadingMaxRetryTimeout: 64000,
                        xhrSetup: (xhr, url) => {
                            xhr.withCredentials = false;
                        }
                    });
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                        console.log(`[HLS] Manifest parsed. Quality levels: ${data.levels.length}`);
                        reconnectAttempts = 0;
                        video.style.opacity = '1';
                        loading.style.display = 'none';
                        if (!player) {
                            player = new Plyr(video, {
                                controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download',
                    'fullscreen'],
                                autoplay: true,
                                muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                                clickToPlay: false, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                            window.plyrPlayer = player;
                        }
                        triggerSafePlayback('HLS-Manifest-Parsed');
                        initTopControls(player);
                        initAdvancedGestures(player, video);
                        startWatchdog();
                    });
                    hls.on(Hls.Events.ERROR, (event, data) => {
                        console.warn('[HLS Error Event]', data.type, data.details, data.fatal ? 'FATAL' : 'NON-FATAL');
                        if (data.details === 'bufferFullError' || data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR) {
                            console.warn('[HLS] Buffer full detected. Evicting old buffer...');
                            try { hls.cleanUpBuffer(15); } catch(e){}
                            return;
                        }
                        if (data.details === 'bufferAddCodecError' || data.details === Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR) {
                            console.warn('[HLS] Codec change in stream. Recovering media...');
                            try { hls.recoverMediaError(); } catch(e){}
                            return;
                        }
                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            if (data.details === 'bufferSeekOverHole' || data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                                if (data.buffer) {
                                    video.currentTime = data.buffer.nextStart;
                                }
                                return;
                            }
                            if (data.details === 'bufferStalledError' || data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                                console.warn('[HLS] Non-fatal buffer stall detected. Nudging playhead and recovering playback...');
                                if (video.buffered && video.buffered.length > 0) {
                                    const curTime = video.currentTime;
                                    let nudged = false;
                                    for (let i = 0; i < video.buffered.length; i++) {
                                        const start = video.buffered.start(i);
                                        const end = video.buffered.end(i);
                                        if (curTime < start) {
                                            video.currentTime = start + 0.1;
                                            nudged = true;
                                            break;
                                        } else if (curTime >= start && curTime < end) {
                                            if (end - curTime < 0.3 && i + 1 < video.buffered.length) {
                                                video.currentTime = video.buffered.start(i + 1) + 0.1;
                                                nudged = true;
                                            }
                                            break;
                                        }
                                    }
                                    if (!nudged) {
                                        const end = video.buffered.end(video.buffered.length - 1);
                                        if (video.currentTime < end - 0.2) {
                                            video.currentTime += 0.15;
                                        }
                                    }
                                }
                                if (video.paused && !video.ended) {
                                    triggerSafePlayback('HLS-Buffer-Stall');
                                }
                                return;
                            }
                            if (data.details === 'fragParsingError' || data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR || data.details === 'bufferAppendNoProgress' || data.details === Hls.ErrorDetails.BUFFER_APPENDING_ERROR) {
                                console.warn('[HLS Media Stream Recovery] Stream fragment parser sync:', data.details);
                                if (data.fatal) {
                                    try { hls.recoverMediaError(); } catch(e) {}
                                    return;
                                }
                                return;
                            }
                        }
                        if (data.fatal) {
                            if (window.AiStreamDoctor) {
                                window.AiStreamDoctor.heal(data);
                                return;
                            }
                            if (data.details === 'manifestParsingError' || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                if (isMdtv || (streamUrl && (streamUrl.includes('mdtv') || streamUrl.includes('.mpd')))) {
                                    console.log('[HLS Fallback] Detected MPD manifest on DASH/MDTV stream. Switching to DASH/Shaka engine...');
                                    if (typeof shaka !== 'undefined') {
                                        loadShaka(streamUrl, drmKeyId, drmKey);
                                    } else {
                                        loadDash(streamUrl, drmKeyId, drmKey);
                                    }
                                    return;
                                }
                                if (streamUrl && !streamUrl.includes('stream_proxy.php') && !streamUrl.includes('/api/proxy/')) {
                                    console.warn('[HLS Fallback] Manifest error on direct stream. Retrying through master stream proxy...');
                                    const proxied = `/stream_proxy.php?url=${encodeURIComponent(streamUrl)}`;
                                    loadHls(proxied);
                                    return;
                                }
                                loading.style.display = 'none';
                                showPlayerError("⚠️ Stream Feed Unreachable: The upstream provider for this channel is currently offline or returning an invalid stream. Please try another live channel (e.g. Sony, TimStreams, Sports).");
                                return;
                            }
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.warn('[HLS Network Error] Retrying stream load...');
                                    try {
                                        hls.startLoad();
                                    } catch(e) {
                                        triggerAutoReconnect();
                                    }
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.warn('[HLS Media Error] Recovering media error...');
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    console.error('[HLS Fatal Error] Unrecoverable error.');
                                    if (streamUrl.includes('.mpd')) {
                                        showPlayerError("🔒 DRM Protected Channel: This channel uses Widevine DRM encryption and cannot be played directly in web browser without DRM keys. Please try HLS channels (Sony, TimStreams, Sports).");
                                    } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                                        loadMpegTs(streamUrl);
                                    } else {
                                        showPlayerError("⚠️ Stream Feed Unreachable: Stream playback failed. Please try another live channel.");
                                    }
                                    break;
                            }
                        }
                    });
                    window.hls = hls;
                }
                
                function hexToBase64Url(hex) {
                    if (!hex) return '';
                    const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
                    if (cleanHex.length % 2 !== 0) return '';
                    const bytes = new Uint8Array(cleanHex.length / 2);
                    for (let i = 0; i < cleanHex.length; i += 2) {
                        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
                    }
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary)
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=+$/, '');
                }

                let shakaPlayer = null;
                function destroyShakaPlayer() {
                    if (shakaPlayer) {
                        try { shakaPlayer.destroy(); } catch(e){}
                        shakaPlayer = null;
                    }
                }

                async function loadShaka(streamUrl, keyId, key) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[Shaka Engine] Initializing Shaka Player for stream:", streamUrl);
                    destroyMpegPlayer();
                    destroyDashPlayer();
                    destroyShakaPlayer();
                    if (hls) { try { hls.destroy(); const v = document.getElementById('player'); if(v){ v.src = ''; v.load(); } } catch(e){} hls = null; }

                    if (typeof shaka === 'undefined' || !shaka.Player.isBrowserSupported()) {
                        console.warn("[Shaka Engine] Shaka not supported or not loaded, falling back to Dash.js");
                        loadDash(streamUrl, keyId, key);
                        return;
                    }

                    try {
                        shaka.polyfill.installAll();
                        shakaPlayer = new shaka.Player(video);
                        window.shakaPlayer = shakaPlayer;

                        // Configure ClearKey DRM for ALL key pairs (multi-key tracks)
                        const clearKeysMap = {};
                        const rawClearkey = (window._activeClearKeyString || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('clearkey') : '') || '').trim();
                        if (rawClearkey) {
                            const pairs = rawClearkey.split(',');
                            for (const pair of pairs) {
                                const [kId, kVal] = pair.split(':');
                                if (kId && kVal) {
                                    const cId = kId.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                                    const cVal = kVal.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                                    if (cId.length === 32 && cVal.length === 32) {
                                        clearKeysMap[cId] = cVal;
                                    }
                                }
                            }
                        }

                        const rawKeyId = (keyId || drmKeyId || window._activeClearKeyId || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key_id') : '') || '').trim();
                        const rawKey = (key || drmKey || window._activeClearKey || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key') : '') || '').trim();
                        const cleanKeyId = rawKeyId.toLowerCase().replace(/[^0-9a-f]/g, '');
                        const cleanKey = rawKey.toLowerCase().replace(/[^0-9a-f]/g, '');
                        if (cleanKeyId.length === 32 && cleanKey.length === 32) {
                            clearKeysMap[cleanKeyId] = cleanKey;
                        }

                        // Auto-scan MPD manifest for any default_KID attributes and associate the key
                        if (streamUrl.includes('.mpd') && (Object.keys(clearKeysMap).length > 0 || cleanKey)) {
                            try {
                                const mpdRes = await fetch(streamUrl, { method: 'GET' });
                                if (mpdRes.ok) {
                                    const mpdText = await mpdRes.text();
                                    const manifestKids = [...mpdText.matchAll(/cenc:default_KID="([^"]+)"/gi)]
                                        .map(m => m[1].replace(/[^0-9a-fA-F]/g, '').toLowerCase());
                                    const fallbackKeyVal = cleanKey || Object.values(clearKeysMap)[0];
                                    if (fallbackKeyVal && manifestKids.length === 1) {
                                        const singleKid = manifestKids[0];
                                        if (singleKid && singleKid.length === 32 && !clearKeysMap[singleKid]) {
                                            clearKeysMap[singleKid] = fallbackKeyVal;
                                        }
                                    }
                                }
                            } catch(e) {
                                console.warn("[Shaka Engine] Could not pre-scan manifest KIDs:", e);
                            }
                        }

                        if (Object.keys(clearKeysMap).length > 0) {
                            shakaPlayer.configure({
                                drm: {
                                    clearKeys: clearKeysMap,
                                    preferredKeySystems: ['org.w3.clearkey', 'webkit-org.w3.clearkey']
                                },
                                restrictions: {
                                    minWidth: 0,
                                    maxWidth: Infinity,
                                    minHeight: 0,
                                    maxHeight: Infinity,
                                    minPixels: 0,
                                    maxPixels: Infinity,
                                    minFrameRate: 0,
                                    maxFrameRate: Infinity,
                                    minBandwidth: 0,
                                    maxBandwidth: Infinity
                                }
                            });
                            console.log("[Shaka Engine] Configured ClearKey DRM keys map:", clearKeysMap);
                        } else {
                            // Explicitly clear DRM so unencrypted / clear streams play without 6006 EME session errors
                            shakaPlayer.configure({
                                drm: {
                                    clearKeys: {}
                                }
                            });
                        }

                        // Configure initial bandwidth estimate to 15 Mbps for immediate FHD 1080p and zero buffer
                        shakaPlayer.configure({
                            abr: {
                                enabled: true,
                                defaultBandwidthEstimate: 15000000,
                                switchInterval: 4
                            },
                            streaming: {
                                rebufferingGoal: 2,
                                bufferingGoal: 25,
                                bufferBehind: 30,
                                segmentPrefetchLimit: 3,
                                stallEnabled: false,
                                stallThreshold: 4,
                                stallSkip: 0,
                                gapDetectionThreshold: 0.1,
                                safeSeekOffset: 3,
                                retryParameters: {
                                    maxAttempts: 6,
                                    baseDelay: 500,
                                    backoffFactor: 1.5,
                                    fuzzFactor: 0.5,
                                    timeout: 20000
                                }
                            },
                            manifest: {
                                dash: {
                                    autoCorrectDrift: true,
                                    clockSyncUri: '',
                                    ignoreMinBufferTime: true
                                },
                                retryParameters: {
                                    maxAttempts: 6,
                                    baseDelay: 500,
                                    backoffFactor: 1.5,
                                    fuzzFactor: 0.5,
                                    timeout: 20000
                                }
                            }
                        });

                        // Configure Request Filter for Akamai token injection on chunks
                        shakaPlayer.getNetworkingEngine().registerRequestFilter((type, request) => {
                            if (window._activeAkamaiToken) {
                                const tokenVal = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                    ? window._activeAkamaiToken 
                                    : ('__hdnea__=' + window._activeAkamaiToken);
                                request.uris = request.uris.map(uri => {
                                    if ((uri.includes('.mpd') || uri.includes('.m4s') || uri.includes('.dash') || uri.includes('jio')) && !uri.includes('__hdnea__')) {
                                        return uri + (uri.includes('?') ? '&' : '?') + tokenVal;
                                    }
                                    return uri;
                                });
                            }
                        });

                        // Configure Response Filter to inject ClearKey UUID into raw DASH manifests that only declare Widevine/PlayReady
                        shakaPlayer.getNetworkingEngine().registerResponseFilter((type, response) => {
                            if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST && response.data && Object.keys(clearKeysMap).length > 0) {
                                try {
                                    let str = new TextDecoder('utf-8').decode(response.data);
                                    if (str && str.includes('<MPD')) {
                                        // If manifest lacks W3C ClearKey UUID, inject it into AdaptationSet so Shaka negotiates ClearKey
                                        if (!str.includes('1077efec-c0b2-4d02-ace3-3c1e52e2fb4b')) {
                                            const clearKeyProtection = '<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b" value="ClearKey1.0"/>';
                                            str = str.replace(/(<ContentProtection[^>]*cenc[^>]*\/>)/gi, `${clearKeyProtection}\n      $1`);
                                            if (!str.includes('1077efec-c0b2-4d02-ace3-3c1e52e2fb4b')) {
                                                str = str.replace(/(<ContentProtection[^>]*>)/i, `${clearKeyProtection}\n      $1`);
                                            }
                                        }
                                        // Rewrite minBufferTime to PT1.500S to stop 10s stalls
                                        str = str.replace(/minBufferTime="PT[0-9\.]+S"/gi, 'minBufferTime="PT1.500S"');
                                        response.data = new TextEncoder().encode(str);
                                    }
                                } catch (_) {}
                            }
                        });

                        shakaPlayer.addEventListener('error', (event) => {
                            const detail = event.detail || {};
                            console.warn("[Shaka Engine Error]", detail.code, detail.category, detail.severity, detail.message, detail);
                            // Fatal decoding pipeline errors (3016 PIPELINE_ERROR_DECODE, 3015 MSE failure): immediately switch to Dash.js
                            if (detail.code === 3016 || detail.code === 3015) {
                                console.warn("[Shaka Decode Error " + detail.code + "] Browser media decoder failure. Immediately switching to Dash.js...");
                                destroyShakaPlayer();
                                loadDash(streamUrl, keyId, key);
                                return;
                            }
                            if (window.AiStreamDoctor && (detail.severity === 2 || detail.code === 4038 || detail.code === 4000 || detail.code === 6006 || detail.code === 6007)) {
                                window.AiStreamDoctor.heal(detail);
                                return;
                            }
                            if (detail.code === 4038 || detail.code === 4000 || detail.code === 4012 || detail.code === 6006 || detail.code === 6007 || detail.severity === 2) {
                                console.warn("[Shaka Error " + detail.code + "] Restrictions or playback error. Retrying via Dash.js / fallback...");
                                destroyShakaPlayer();
                                if (streamUrl.includes('.mpd')) {
                                    loadDash(streamUrl, keyId, key);
                                } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                                    loadHls(streamUrl);
                                } else if (typeof loadVideoJs === 'function') {
                                    loadVideoJs(streamUrl);
                                }
                            }
                        });

                        await shakaPlayer.load(streamUrl);
                        console.log("[Shaka Engine] Stream loaded successfully.");
                        video.style.opacity = '1';
                        loading.style.display = 'none';
                        if (!player) {
                            player = new Plyr(video, {
                                controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download', 'fullscreen'],
                                autoplay: true,
                                muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                                clickToPlay: false, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                            window.plyrPlayer = player;
                            window.player = player;
                        }
                        triggerSafePlayback('Shaka-DASH');
                        initTopControls(player);
                        initAdvancedGestures(player, video);
                        startWatchdog();
                    } catch (err) {
                        console.warn("[Shaka Engine Init Failed] Error:", err, "Falling back to Dash.js...");
                        destroyShakaPlayer();
                        loadDash(streamUrl, keyId, key);
                    }
                }

                let dashPlayer = null;
                function destroyDashPlayer() {
                    if (dashPlayer) {
                        try { dashPlayer.reset(); } catch(e){}
                        dashPlayer = null;
                    }
                    destroyShakaPlayer();
                }
                function loadDash(streamUrl, keyId, key) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[DASH Engine] Initializing Dash.js for stream:", streamUrl);
                    destroyMpegPlayer();
                    if (hls) { try { hls.destroy(); } catch(e){} hls = null; }
                    destroyDashPlayer();
                    
                    try {
                        dashPlayer = dashjs.MediaPlayer().create();

                        // Akamai Token injection for JioTV / MDTV DASH chunks (.m4s, .dash)
                        if (window._activeAkamaiToken) {
                            const tokenVal = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                ? window._activeAkamaiToken 
                                : ('__hdnea__=' + window._activeAkamaiToken);
                            dashPlayer.extend("RequestModifier", () => {
                                return {
                                    modifyRequestURL: (url) => {
                                        if (url && typeof url === 'string') {
                                            if ((url.includes('.mpd') || url.includes('.m4s') || url.includes('.dash') || url.includes('jio')) && !url.includes('__hdnea__')) {
                                                return url + (url.includes('?') ? '&' : '?') + tokenVal;
                                            }
                                        }
                                        return url;
                                    }
                                };
                            });
                        }

                        // Configure ClearKey DRM for ALL key pairs (multi-key tracks)
                        const dashKeysMap = {};
                        const rawDashClearkey = (window._activeClearKeyString || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('clearkey') : '') || '').trim();
                        if (rawDashClearkey) {
                            const pairs = rawDashClearkey.split(',');
                            for (const pair of pairs) {
                                const [kId, kVal] = pair.split(':');
                                if (kId && kVal) {
                                    const cId = kId.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                                    const cVal = kVal.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
                                    if (cId.length === 32 && cVal.length === 32) {
                                        dashKeysMap[cId] = cVal;
                                    }
                                }
                            }
                        }

                        const rawDashKeyId = (keyId || drmKeyId || window._activeClearKeyId || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key_id') : '') || '').trim();
                        const rawDashKey = (key || drmKey || window._activeClearKey || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key') : '') || '').trim();
                        const cleanDashKeyId = rawDashKeyId.toLowerCase().replace(/[^0-9a-f]/g, '');
                        const cleanDashKey = rawDashKey.toLowerCase().replace(/[^0-9a-f]/g, '');
                        if (cleanDashKeyId.length === 32 && cleanDashKey.length === 32) {
                            dashKeysMap[cleanDashKeyId] = cleanDashKey;
                        }

                        if (Object.keys(dashKeysMap).length > 0) {
                            console.log("[DASH Engine] Configuring ClearKey DRM protection map:", dashKeysMap);
                            const dashClearkeys = {};
                            for (const [cId, cVal] of Object.entries(dashKeysMap)) {
                                const b64KeyId = hexToBase64Url(cId);
                                const b64Key = hexToBase64Url(cVal);
                                if (b64KeyId && b64Key) {
                                    dashClearkeys[b64KeyId] = b64Key;
                                }
                                dashClearkeys[cId] = cVal;
                            }
                            dashPlayer.setProtectionData({
                                "org.w3.clearkey": {
                                    "clearkeys": dashClearkeys,
                                    "priority": 0
                                },
                                "com.microsoft.playready": {
                                    "priority": 99
                                },
                                "com.widevine.alpha": {
                                    "priority": 99
                                }
                            });
                        }

                        dashPlayer.updateSettings({
                            streaming: {
                                buffer: {
                                    fastSwitchEnabled: true,
                                    bufferTimeAtTopQuality: 30,
                                    bufferTimeAtTopQualityLongForm: 30,
                                    bufferToKeep: 30,
                                    bufferPruningInterval: 30
                                },
                                retryIntervals: {
                                    MPD: 500,
                                    InitializationSegment: 500,
                                    MediaSegment: 500
                                },
                                retryAttempts: {
                                    MPD: 6,
                                    InitializationSegment: 6,
                                    MediaSegment: 6
                                },
                                delay: {
                                    liveDelay: 8
                                }
                            }
                        });

                        dashPlayer.initialize(video, streamUrl, true);
                        dashPlayer.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
                            console.log("[DASH Engine] Stream initialized successfully.");
                            video.style.opacity = '1';
                            loading.style.display = 'none';
                            if (!player) {
                                player = new Plyr(video, {
                                    controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download', 'fullscreen'],
                                    autoplay: true,
                                    muted: false,
                                    hideControls: { enabled: true, delay: 4000 },
                                    clickToPlay: false, fullscreen: { enabled: true, fallback: true, iosNative: true }
                                });
                                window.plyrPlayer = player;
                                window.player = player;
                            }
                            triggerSafePlayback('DASH');
                            initTopControls(player);
                            initAdvancedGestures(player, video);
                            startWatchdog();
                        });
                        dashPlayer.on(dashjs.MediaPlayer.events.ERROR, (e) => {
                            console.warn("[DASH Engine Error]", e);
                            if (window.AiStreamDoctor) {
                                window.AiStreamDoctor.heal(e);
                                return;
                            }
                            loading.style.display = 'none';
                            if (Hls.isSupported() && !streamUrl.includes('.mpd') && !isExplicitDash) {
                                loadHls(streamUrl);
                            } else {
                                showPlayerError("⚠️ Stream Notice: " + (e.error?.message || e.message || "Failed to decode live stream. Please try reconnecting or select another stream."));
                            }
                        });
                        window.dashPlayer = dashPlayer;
                    } catch(err) {
                        console.error("[DASH Engine Init Failed]", err);
                        if (Hls.isSupported() && !streamUrl.includes('.mpd') && !isExplicitDash) {
                            loadHls(streamUrl);
                        } else {
                            showPlayerError("⚠️ Player initialization failed: " + err.message);
                        }
                    }
                }
                if (resolvedSrc.includes('.mpd') || resolvedSrc.includes('type=dash')) {
                    isExplicitDash = true;
                }
                if (isDirectMedia) {
                    video.src = resolvedSrc;
                    video.load();
                    triggerSafePlayback('Direct-Media');
                    if (!player) {
                        player = new Plyr(video, {
                            controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download', 'fullscreen'],
                            autoplay: true,
                            muted: false,
                            hideControls: { enabled: true, delay: 4000 },
                            clickToPlay: true,
                            fullscreen: { enabled: true, fallback: true, iosNative: true }
                        });
                        window.plyrPlayer = player;
                    }
                    video.style.opacity = '1';
                    loading.style.display = 'none';
                    initTopControls(player);
                    initAdvancedGestures(player, video);
                    startWatchdog();
                } else if (isExplicitDash) {
                    if (typeof shaka !== 'undefined') {
                        loadShaka(resolvedSrc, drmKeyId, drmKey);
                    } else if (typeof dashjs !== 'undefined') {
                        loadDash(resolvedSrc, drmKeyId, drmKey);
                    }
                } else if (isExplicitTs && typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                    loadMpegTs(resolvedSrc);
                } else if (Hls.isSupported() && !resolvedSrc.includes('.mpd')) {
                    loadHls(resolvedSrc);
                } else if (typeof shaka !== 'undefined') {
                    loadShaka(resolvedSrc, drmKeyId, drmKey);
                } else if (typeof dashjs !== 'undefined') {
                    loadDash(resolvedSrc, drmKeyId, drmKey);
                } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                    loadMpegTs(resolvedSrc);
                } else {
                    video.src = resolvedSrc;
                    video.load();
                    triggerSafePlayback('Native-Fallback');
                }
            }

            async function resolveStreamAndInit() {
                if (!src) {
                    const id = urlParams.get('id') || urlParams.get('tmdb') || '';
                    const q = urlParams.get('q') || urlParams.get('name') || (name !== 'Live Stream' && name !== 'Live Channel' ? name : '');
                    const type = urlParams.get('type') || 'movie';
                    const s = urlParams.get('s') || urlParams.get('season') || '1';
                    const e = urlParams.get('e') || urlParams.get('episode') || '1';

                    if (id || q) {
                        try {
                            const res = await fetch(`/api/scrape-m3u8?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&s=${encodeURIComponent(s)}&e=${encodeURIComponent(e)}&q=${encodeURIComponent(q)}`);
                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.m3u8Url) {
                                    src = data.m3u8Url;
                                    if (data.query) name = data.query;
                                    initPlayer();
                                    return;
                                }
                            }
                        } catch (e) {}
                    }

                    const lookupName = (name && name !== 'Live Channel' && name !== 'Live Stream') ? name : (urlParams.get('name') || urlParams.get('q') || urlParams.get('id') || urlParams.get('channel') || '');
                    if (lookupName) {
                        try {
                            const res = await fetch(`/api/channels/resolve?name=${encodeURIComponent(lookupName)}`);
                            if (res.ok) {
                                const data = await res.json();
                                if (data && (data.streamUrl || data.url)) {
                                    src = data.streamUrl || data.url;
                                    if (data.name) name = data.name;
                                    console.log('[Auto-Resolve Consumet] Resolved channel stream from channels.json:', src);
                                    try {
                                        await initPlayer();
                                    } catch(err) {
                                        console.error('[Auto-Resolve Consumet] initPlayer error:', err);
                                    }
                                    return;
                                }
                            }
                        } catch (e) {
                            console.warn('[Auto-Resolve Consumet] Failed to resolve channel:', e);
                        }
                    }
                }
                try {
                    await initPlayer();
                } catch(err) {
                    console.error('[Auto-Resolve Consumet] Direct initPlayer error:', err);
                }
            }

            resolveStreamAndInit();
        });
    </script>
    <!-- Touch Gestures Overlay -->
    <div id="touchGestureOverlay" class="absolute inset-0 z-40 hidden md:block" style="touch-action: none; pointer-events: none;"></div>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const plyrContainer = document.querySelector('.plyr') || document.getElementById('player-container');
            if(!plyrContainer) return;
        });

        // Continue Watching - Watch History Logic
        document.addEventListener("DOMContentLoaded", () => {
            const video = document.querySelector('video');
            if (!video) return;

            const urlParams = new URLSearchParams(window.location.search);
            const mediaName = urlParams.get('name') || urlParams.get('title');
            const source = urlParams.get('source');
            
            // Only engage logic if coming from our catalog (consumet.html) with a valid name
            if (mediaName && source === 'consumet.html') {
                const historyKey = 'consumet_watch_history';
                let hasResumed = false;
                let lastSaveTime = 0;

                // Resume logic
                video.addEventListener('canplay', () => {
                    if (hasResumed) return; // allow infinite duration initially
                    
                    try {
                        const history = JSON.parse(localStorage.getItem(historyKey)) || [];
                        const itemIndex = history.findIndex(h => mediaName.startsWith(h.title) || mediaName.startsWith(h.name) || h.title === mediaName || h.name === mediaName);
                        
                        if (itemIndex !== -1) {
                            const item = history[itemIndex];
                            if (item.currentTime > 5) {
                                let percentage = 0;
                                if (item.duration && item.duration !== Infinity && !isNaN(item.duration)) {
                                    percentage = (item.currentTime / item.duration) * 100;
                                }
                                // Resume only if less than 95% finished, or if percentage is unknown
                                if (percentage < 95 || isNaN(percentage)) {
                                    video.currentTime = item.currentTime;
                                    console.log("[History] Resumed", mediaName, "at", item.currentTime);
                                    
                                    const toast = document.createElement('div');
                                    toast.className = 'absolute top-4 right-4 bg-gray-900/90 text-white px-4 py-2 rounded-lg text-sm z-50 transition-all border border-amber-500/30 shadow-lg';
                                    toast.innerText = `Resumed at ${Math.floor(item.currentTime / 60)}:${Math.floor(item.currentTime % 60).toString().padStart(2, '0')}`;
                                    document.body.appendChild(toast);
                                    
                                    setTimeout(() => {
                                        toast.style.opacity = '0';
                                        setTimeout(() => toast.remove(), 500);
                                    }, 4000);
                                }
                            }
                        }
                    } catch(e) {
                        console.warn("[History] Failed to load history", e);
                    }
                    hasResumed = true;
                });

                // Save logic
                video.addEventListener('timeupdate', () => {
                    // Only save if duration is valid and it's not a live stream
                    if (video.currentTime > 5) { window.reconnectAttempts = 0;
                        const now = Date.now();
                        // Throttle saves to every 5 seconds to reduce localStorage operations
                        if (now - lastSaveTime < 5000) return;
                        lastSaveTime = now;
                        
                        try {
                            const history = JSON.parse(localStorage.getItem(historyKey)) || [];
                            const itemIndex = history.findIndex(h => mediaName.startsWith(h.title) || mediaName.startsWith(h.name) || h.title === mediaName || h.name === mediaName);
                            
                            if (itemIndex !== -1) {
                                let percentage = 50; // default for unknown duration
                                if (video.duration && video.duration !== Infinity && !isNaN(video.duration)) {
                                    percentage = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
                                }
                                
                                history[itemIndex].currentTime = video.currentTime;
                                history[itemIndex].duration = video.duration || 0;
                                history[itemIndex].progressPercent = percentage;
                                history[itemIndex].timestamp = Date.now();
                                
                                // Move it to the front of the array (most recently watched)
                                const activeItem = history.splice(itemIndex, 1)[0];
                                history.unshift(activeItem);
                                
                                localStorage.setItem(historyKey, JSON.stringify(history));
                            }
                        } catch(e) {
                            console.warn("[History] Failed to save history", e);
                        }
                    }
                });
            }
        });
    </script>
    <script src="/watchdog.js" id="maintenance-watchdog"></script>
    <script src="/cast-pwa-helper.js"></script>
    <script src="/tv-remote.js"></script>
    <script src="/party-mode.js?v=7.0"></script>
    <script src="/media-info.js"></script>
</body>
</html>
