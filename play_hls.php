<?php
require_once "stalker_api.php";
global $SCARLET_WITCH;
$id = $_GET['id'] ?? '';
$name = $_GET['name'] ?? 'Unknown';
$source = $_GET['source'] ?? 'index.php';
$isXtream = strpos($id, 'xtream_') === 0;
$extension = 'm3u8';
if ($isXtream) {
    $DARK_SIDE = "doctor_strange";
    $token_file = $DARK_SIDE . "/token.stalker";
    if (file_exists($token_file)) {
        $token_data = json_decode(file_get_contents($token_file), true);
        $allowed = $token_data['STALKER']['data']['user_info']['allowed_output_formats'] ?? null;
        if (is_array($allowed) && !in_array('m3u8', $allowed) && in_array('ts', $allowed)) {
            $extension = 'ts';
        }
    }
}
$stream_url = '';
if (strpos($id, 'http://') === 0 || strpos($id, 'https://') === 0) {
    $stream_url = $id;
} else {
    $stream_url = ($isXtream ? "xtream.php?id=" : "live.php?id=") . urlencode($id);
    if ($isXtream) {
        $stream_url .= '.' . $extension;
    }
}
$ROLEX  = $SCARLET_WITCH["meta_data"];
function e($str)
{
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>{{NAME}} | Stalker Pro Player</title>

    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.6.2/dist/plyr.css" />
    <script src="https://cdn.jsdelivr.net/npm/plyr@3.6.12/dist/plyr.min.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.1.4/dist/hls.min.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js" crossorigin></script>
    <style>
        * { -webkit-tap-highlight-color: transparent !important; }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html,
        body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
            font-family: Poppins;
        }
        video,
        .plyr,
        .plyr__video-wrapper {
            width: 100vw;
            height: 100dvh;
        }
        video,
        .plyr {
            position: fixed;
            top: 0;
            left: 0;
        }
        .plyr {
            margin: 0 !important;
        }
        .plyr video,
        video {
            object-fit: contain !important;
            opacity: 1;
        }
        /* Zoom to Fill functionality */
        .video-zoom-fill .plyr video,
        .video-zoom-fill video {
            object-fit: cover !important;
        }
        #zoom-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 14px 28px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 800;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .video-aspect-4-3 video { object-fit: contain !important; aspect-ratio: 4/3; }
        .video-aspect-16-9 video { object-fit: contain !important; aspect-ratio: 16/9; }
        .video-aspect-stretch video { object-fit: fill !important; }
        .video-aspect-fill video { object-fit: cover !important; }
        .sleep-timer-active #sleep-indicator { 
            opacity: 1 !important; 
            transform: translateY(0);
        }
        #sleep-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(220, 38, 38, 0.9);
            color: white;
            padding: 10px 18px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 800;
            z-index: 10001;
            opacity: 0;
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transform: translateY(-20px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        /* Loader */
        .loading {
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2rem;
        }
        .loading-text {
            text-align: center;
        }
        .loading-text span {
            display: inline-block;
            margin: 0 8px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 2.5rem;
            font-weight: 900;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }
        .loading-text span:nth-child(1) {
            animation: blur-text 1.5s 0s infinite linear alternate;
        }
        .loading-text span:nth-child(2) {
            animation: blur-text 1.5s 0.15s infinite linear alternate;
        }
        .loading-text span:nth-child(3) {
            animation: blur-text 1.5s 0.3s infinite linear alternate;
        }
        .loading-text span:nth-child(4) {
            animation: blur-text 1.5s 0.45s infinite linear alternate;
        }
        .loading-text span:nth-child(5) {
            animation: blur-text 1.5s 0.6s infinite linear alternate;
        }
        .loading-text span:nth-child(6) {
            animation: blur-text 1.5s 0.75s infinite linear alternate;
        }
        .loading-text span:nth-child(7) {
            animation: blur-text 1.5s 0.9s infinite linear alternate;
        }
        .loading-text span:nth-child(8) {
            animation: blur-text 1.5s 1.05s infinite linear alternate;
        }
        .loading-text span:nth-child(9) {
            animation: blur-text 1.5s 1.2s infinite linear alternate;
        }
        .loading-text span:nth-child(10) {
            animation: blur-text 1.5s 1.35s infinite linear alternate;
        }
        .loading-text span:nth-child(11) {
            animation: blur-text 1.5s 1.5s infinite linear alternate;
        }
        .loading-text span:nth-child(12) {
            animation: blur-text 1.5s 1.65s infinite linear alternate;
        }
        .loading-text span:nth-child(13) {
            animation: blur-text 1.5s 1.8s infinite linear alternate;
        }
        .loading-text span:nth-child(14) {
            animation: blur-text 1.5s 1.95s infinite linear alternate;
        }
        .loading-text span:nth-child(15) {
            animation: blur-text 1.5s 2.1s infinite linear alternate;
        }
        .loading-text span:nth-child(16) {
            animation: blur-text 1.5s 2.25s infinite linear alternate;
        }
        .loading-text span:nth-child(17) {
            animation: blur-text 1.5s 2.4s infinite linear alternate;
        }
        .loading-text span:nth-child(18) {
            animation: blur-text 1.5s 2.55s infinite linear alternate;
        }
        @keyframes blur-text {
            0% {
                filter: blur(0px);
            }
            100% {
                filter: blur(4px);
            }
        }
        /* Logos */
        .plyr__video-wrapper::before {
            content: '';
            position: absolute;
            top: 10px;
            right: 10px;
            width: 35px;
            height: 35px;
            background: url('<?= e($ROLEX['Rimg'] ?? '') ?>') no-repeat;
            background-size: cover;
            z-index: 10;
            pointer-events: none;
        }
        .plyr__video-wrapper::after {
            content: '';
            position: absolute;
            top: 100px;
            left: 15px;
            width: 300px;
            height: 150px;
            background: url('<?= e($ROLEX['Limg'] ?? '') ?>') no-repeat;
            background-size: contain;
            z-index: 10;
            pointer-events: none;
        }
        @media (max-width: 768px) {
            .plyr__video-wrapper::after {
                top: auto;
                bottom: 75px;
                left: 10px;
                width: 140px;
                height: 70px;
            }
            .plyr__video-wrapper::before {
                top: 12px;
                right: 12px;
                width: 24px;
                height: 24px;
            }
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
    </style>
    <link rel="icon" type="image/png" href="stalker_pro_infinity.svg">
    <link rel="stylesheet" href="assets/local-ai.css?v=2.0">
</head>
<body>
    <div id="loading" class="loading">
        <div class="loading-text">
            <span style="color:#FF9966">M</span>
            <span style="color:#FF9966">Y</span>
            <span style="color:transparent">&nbsp;</span>
            <span style="color:#FF0000">I</span>
            <span style="color:#FF0000">P</span>
            <span style="color:#FF0000">T</span>
            <span style="color:#FF0000">V</span>
            <span style="color:transparent">&nbsp;</span>
            <span style="color:#66CC66">P</span>
            <span style="color:#66CC66">L</span>
            <span style="color:#66CC66">A</span>
            <span style="color:#66CC66">Y</span>
            <span style="color:#66CC66">E</span>
            <span style="color:#66CC66">R</span>
        </div>
        <div id="loading-fallback" class="hidden">
             <button onclick="location.reload()" class="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/10 transition-all flex items-center gap-2 backdrop-blur-sm">
                 <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                 <span>Stream taking too long? <strong class="ml-1">Force Reload</strong></span>
             </button>
        </div>
    </div>
    <div id="zoom-indicator">Zoomed to Fill</div>
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3 h-3"></i>
        <span id="sleep-time">00:00</span>
    </div>
    <div id="player-container" class="fixed inset-0 bg-black z-0">
        <video id="player" autoplay muted controls playsinline poster="<?= heaven(); ?>">
            <source src="{{STREAM_URL}}" type="application/x-mpegURL">
        </video>
    </div>
    <!-- Playback Error Overlay -->
    <div id="player-error" class="hidden fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-6 text-center">
        <div class="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 text-red-500">
                <i data-lucide="alert-triangle" class="w-8 h-8 animate-pulse"></i>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">Playback Connection Error</h3>
            <p id="error-message-text" class="text-zinc-400 text-sm mb-6 leading-relaxed">Failed to load the stream. The stream might be temporarily offline, or the portal is slow to respond.</p>
            <div class="flex gap-4">
                <button onclick="location.reload()" class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Retry Stream
                </button>
                <button onclick="window.history.back()" class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm rounded-xl transition-all border border-zinc-700 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i> Go Back
                </button>
            </div>
        </div>
    </div>
    <!-- Smart Auto-Reconnect Overlay -->
    <div id="reconnect-overlay" class="hidden fixed inset-0 z-[9998] bg-black/80 flex flex-col items-center justify-center p-6 text-center transition-all duration-300">
        <div class="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20 text-amber-500 animate-spin" style="animation-duration: 3s;">
                <i data-lucide="refresh-cw" class="w-8 h-8"></i>
            </div>
            <h3 class="text-xl font-bold text-white mb-2" id="reconnect-title">Connecting...</h3>
            <p id="reconnect-status" class="text-zinc-400 text-sm mb-6 leading-relaxed">Stream dropped. Automatically reconnecting in <span id="reconnect-countdown" class="font-bold text-amber-500">5</span> seconds...</p>
            <div class="text-[10px] uppercase tracking-wider font-mono text-zinc-500 px-3 py-1 bg-zinc-800 rounded-full" id="reconnect-attempt-info">
                Attempt 1
            </div>
        </div>
    </div>
    <!-- Playback Sleep Overlay -->
    <div id="player-sleep-screen" class="hidden fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
        <div class="max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6">
            <div class="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center border border-teal-500/20 text-teal-500 animate-pulse">
                <i data-lucide="moon" class="w-8 h-8"></i>
            </div>
            <div class="space-y-1">
                <p class="text-[10px] font-black tracking-[0.3em] text-teal-500 uppercase">System Asleep</p>
                <h3 class="text-3xl font-black text-white" id="playerSleepClock">00:00:00</h3>
            </div>
            <p class="text-zinc-500 text-xs leading-relaxed max-w-xs">The playback has been put to sleep to conserve bandwidth and power.</p>
            <div class="flex gap-4 pt-2">
                <button onclick="wakePlayerUp()" class="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-teal-600/20 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="play" class="w-4 h-4"></i> Resume Stream
                </button>
                <button onclick="window.history.back()" class="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-zinc-800 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="home" class="w-4 h-4"></i> Dashboard
                </button>
            </div>
        </div>
    </div>
    <script>
        // Override MediaSource.prototype.addSourceBuffer to handle unsupported audio/video codecs (like Dolby AC-3) gracefully
        if (typeof window.MediaSource !== 'undefined' && window.MediaSource.prototype) {
            const originalAddSourceBuffer = window.MediaSource.prototype.addSourceBuffer;
            window.MediaSource.prototype.addSourceBuffer = function(type) {
                try {
                    return originalAddSourceBuffer.call(this, type);
                } catch (e) {
                    if (type.includes('codecs=ac-3') || type.includes('codecs=ec-3') || type.includes('codecs=mp4a.a6') || type.includes('codecs=mp4a.A6') || type.includes('codecs=ac3')) {
                        console.warn("[MediaSource] Unsupported Dolby AC-3 / EC-3 codec blocked to prevent player crash. Returning dummy source buffer.", type);
                        // Construct a dummy SourceBuffer mock object to prevent client-side player crashes
                        const dummySB = {
                            updating: false,
                            buffered: {
                                length: 0,
                                start: () => 0,
                                end: () => 0
                            },
                            listeners: {},
                            addEventListener: function(event, cb) {
                                if (!this.listeners[event]) this.listeners[event] = [];
                                this.listeners[event].push(cb);
                            },
                            removeEventListener: function(event, cb) {
                                if (this.listeners[event]) {
                                    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
                                }
                            },
                            appendBuffer: function(buf) {
                                this.updating = true;
                                setTimeout(() => {
                                    this.updating = false;
                                    if (this.listeners['updateend']) {
                                        this.listeners['updateend'].forEach(cb => {
                                            try { cb({ target: this }); } catch(err) {}
                                        });
                                    }
                                }, 5);
                            },
                            abort: function() {},
                            changeType: function() {},
                            dispatchEvent: function() { return true; }
                        };
                        return dummySB;
                    }
                    throw e;
                }
            };
        }
        document.addEventListener("DOMContentLoaded", () => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            function initTopControls(player, video) {
                const setupControls = () => {
                    let topControls = document.getElementById('top-controls');
                    if (!topControls) {
                        topControls = document.createElement('div');
                        topControls.id = 'top-controls';
                        topControls.className = 'absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-3 transition-opacity duration-300 opacity-0 pointer-events-none';
                        topControls.style.zIndex = '2147483647';
                        // Create Back Button
                        const backBtn = document.createElement('button');
                        backBtn.onclick = () => {
                            window.history.back();
                        };
                        backBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 group backdrop-blur-md';
                        backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"></i>';
                        topControls.appendChild(backBtn);
                        // Create PiP Button if supported
                        // Create Rotate Button
                        const rotateBtn = document.createElement('button');
                        rotateBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 backdrop-blur-md';
                        rotateBtn.innerHTML = '<i data-lucide="rotate-cw" class="w-5 h-5"></i>';
                        let currentRotation = 0;
                        rotateBtn.onclick = async (e) => {
                            e.stopPropagation();
                            try {
                                if (screen.orientation && screen.orientation.lock) {
                                    if (!document.fullscreenElement && player && player.fullscreen) {
                                        await player.fullscreen.enter();
                                    }
                                    if (screen.orientation.type.startsWith('portrait')) {
                                        await screen.orientation.lock('landscape');
                                    } else {
                                        await screen.orientation.lock('portrait');
                                    }
                                    return;
                                }
                            } catch(err) {
                                console.warn("Orientation lock failed, using CSS fallback", err);
                            }
                            currentRotation = (currentRotation + 90) % 360;
                            const container = player.elements?.container || document.getElementById('player-container');
                            const isPortrait = currentRotation === 90 || currentRotation === 270;
                            const updateSize = () => {
                                if (currentRotation === 0) {
                                    container.style.removeProperty('width');
                                    container.style.removeProperty('height');
                                    container.style.removeProperty('position');
                                    container.style.removeProperty('top');
                                    container.style.removeProperty('left');
                                    container.style.removeProperty('right');
                                    container.style.removeProperty('bottom');
                                    container.style.removeProperty('z-index');
                                    container.style.removeProperty('transform');
                                    container.style.removeProperty('transform-origin');
                                    document.body.style.overflow = '';
                                    return;
                                }
                                document.body.style.overflow = 'hidden';
                                const w = window.innerWidth;
                                const h = window.innerHeight;
                                if (isPortrait) {
                                    container.style.setProperty('width', `${h}px`, 'important');
                                    container.style.setProperty('height', `${w}px`, 'important');
                                } else {
                                    container.style.setProperty('width', `${w}px`, 'important');
                                    container.style.setProperty('height', `${h}px`, 'important');
                                }
                            };
                            if (currentRotation !== 0) {
                                container.style.setProperty('position', 'fixed', 'important');
                                container.style.setProperty('top', '50%', 'important');
                                container.style.setProperty('left', '50%', 'important');
                                container.style.setProperty('z-index', '999999', 'important');
                                container.style.setProperty('transform-origin', 'center center', 'important');
                                container.style.setProperty('transform', `translate(-50%, -50%) rotate(${currentRotation}deg)`, 'important');
                            }
                            updateSize();
                            if (!window._rotationResizeAttached) {
                                window.addEventListener('resize', () => {
                                    if (currentRotation !== 0) updateSize();
                                });
                                window._rotationResizeAttached = true;
                            }
                            // Try to trigger a window resize to force Plyr controls to update
                            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                        };
                        topControls.appendChild(rotateBtn);
                        // Create Local Subtitle Button
                        const subLabel = document.createElement('label');
                        subLabel.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 backdrop-blur-md cursor-pointer';
                        subLabel.innerHTML = '<i data-lucide="subtitles" class="w-5 h-5"></i><input type="file" id="local-sub-upload" accept=".srt,.vtt" class="hidden">';
                        topControls.appendChild(subLabel);
                        setTimeout(() => {
                            const subInput = document.getElementById('local-sub-upload');
                            if (subInput) {
                                subInput.addEventListener('change', (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = function(evt) {
                                        let text = evt.target.result;
                                        if (file.name.toLowerCase().endsWith('.srt')) {
                                            text = 'WEBVTT\n\n' + text
                                                .replace(/\{\\([ibu])\}/g, '<$1>')
                                                .replace(/\{\\\/([ibu])\}/g, '</$1>')
                                                .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
                                                .replace(/\r\n|\r|\n/g, '\n');
                                        }
                                        const blob = new Blob([text], { type: 'text/vtt' });
                                        const url = URL.createObjectURL(blob);
                                        let trackEl = Array.from(video.querySelectorAll('track')).find(t => t.label === 'Local Subtitle');
                                        if (trackEl) {
                                            trackEl.src = url;
                                        } else {
                                            trackEl = document.createElement('track');
                                            trackEl.kind = 'captions';
                                            trackEl.label = 'Local Subtitle';
                                            trackEl.srclang = 'en';
                                            trackEl.src = url;
                                            trackEl.default = true;
                                            video.appendChild(trackEl);
                                        }
                                        setTimeout(() => {
                                            if (trackEl.track) {
                                                trackEl.track.mode = 'showing';
                                            }
                                        }, 100);
                                        const indicator = document.getElementById('zoom-indicator');
                                        if (indicator) {
                                            indicator.textContent = 'Subtitle Added';
                                            indicator.style.opacity = '1';
                                            setTimeout(() => indicator.style.opacity = '0', 2000);
                                        }
                                        // Reset input so the same file can be uploaded again if needed
                                        subInput.value = '';
                                    };
                                    reader.readAsText(file);
                                });
                            }
                        }, 500);
                        // Create Aspect Ratio Button
                        const aspectBtn = document.createElement('button');
                        aspectBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 backdrop-blur-md cursor-pointer';
                        aspectBtn.innerHTML = '<i data-lucide="maximize" class="w-5 h-5"></i>';
                        aspectBtn.onclick = (e) => { e.stopPropagation(); toggleAspectRatio(); };
                        topControls.appendChild(aspectBtn);
                        // Create Sleep Timer Button
                        const sleepBtn = document.createElement('button');
                        sleepBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 backdrop-blur-md cursor-pointer';
                        sleepBtn.innerHTML = '<i data-lucide="clock" class="w-5 h-5"></i>';
                        sleepBtn.onclick = (e) => { e.stopPropagation(); toggleSleepTimer(); };
                        topControls.appendChild(sleepBtn);
                        // Create Power/Off Button
                        const powerBtn = document.createElement('button');
                        powerBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600/20 text-red-500 rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-red-500/10 backdrop-blur-md cursor-pointer hover:text-white hover:border-red-500';
                        powerBtn.innerHTML = '<i data-lucide="power" class="w-5 h-5"></i>';
                        powerBtn.onclick = (e) => { e.stopPropagation(); window.sleepPlayer(); };
                        topControls.appendChild(powerBtn);
                        const isPipSupported = (document.pictureInPictureEnabled || 
                                                (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === "function"));
                        if (isPipSupported) {
                             const pipBtn = document.createElement('button');
                             pipBtn.id = 'pip-trigger-button';
                             pipBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all duration-300 shadow-lg shadow-black/40 border border-white/10 group backdrop-blur-md cursor-pointer';
                             pipBtn.innerHTML = '<i data-lucide="picture-in-picture-2" class="w-5 h-5 group-hover:scale-105 transition-transform"></i>';
                             pipBtn.addEventListener('click', async (e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 try {
                                     if (document.pictureInPictureElement) {
                                         await document.exitPictureInPicture();
                                     } else if (video.readyState >= 1) { // HAVE_METADATA or higher
                                         if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
                                             await video.requestPictureInPicture();
                                         } else if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === "function") {
                                             const isPip = video.webkitPresentationMode === "picture-in-picture";
                                             await video.webkitSetPresentationMode(isPip ? "inline" : "picture-in-picture");
                                         }
                                     } else {
                                         console.warn("Video metadata not loaded yet. Cannot enter Picture-in-Picture.");
                                     }
                                 } catch (error) {
                                     console.error("Picture-in-Picture failed:", error);
                                 }
                             });
                             topControls.appendChild(pipBtn);
                        }
                        const container = player.elements?.container || video.closest('.plyr') || document.getElementById('player-container');
                        if (container) {
                            container.appendChild(topControls);
                            const sleepScreen = document.getElementById('player-sleep-screen');
                            if (sleepScreen && sleepScreen.parentElement !== container) {
                                container.appendChild(sleepScreen);
                            }
                            const errDiv = document.getElementById('player-error');
                            if (errDiv && errDiv.parentElement !== container) {
                                container.appendChild(errDiv);
                            }
                        } else {
                            document.body.appendChild(topControls);
                        }
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons();
                        }
                    }
                    if (typeof player.on === 'function') {
                        if (player.elements) {
                            player.on('controlsshown', () => {
                                if (topControls && topControls.classList) topControls.classList.remove('opacity-0', 'pointer-events-none');
                            });
                            player.on('controlshidden', () => {
                                if (topControls && topControls.classList) topControls.classList.add('opacity-0', 'pointer-events-none');
                            });
                        } else {
                            // Artplayer events
                            player.on('control', (state) => {
                                if (topControls && topControls.classList) {
                                    if (state) topControls.classList.remove('opacity-0', 'pointer-events-none');
                                    else topControls.classList.add('opacity-0', 'pointer-events-none');
                                }
                            });
                            player.on('hover', (state) => {
                                if (topControls && topControls.classList) {
                                    if (state) topControls.classList.remove('opacity-0', 'pointer-events-none');
                                    else topControls.classList.add('opacity-0', 'pointer-events-none');
                                }
                            });
                        }
                    }
                    // Force show initially
                    if (topControls && topControls.classList) topControls.classList.remove('opacity-0', 'pointer-events-none');
                };
                const isArtplayer = !player.elements;
                if (isArtplayer || player.ready) {
                    setupControls();
                } else {
                    player.on('ready', setupControls);
                    setTimeout(setupControls, 50);
                }
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
                // --- PC KEYBOARD SHORTCUTS ---
                let sleepTimer = null;
                let sleepMinutes = 0;
                let playerSleepInterval = null;
                window.sleepPlayer = function() {
                    const screen = document.getElementById('player-sleep-screen');
                    if (!screen) return;
                    // Pause video playback
                    if (window.player) {
                        window.player.pause();
                    } else {
                        const vid = document.getElementById('player');
                        if (vid) vid.pause();
                    }
                    screen.classList.remove('hidden');
                    // Start clock
                    updatePlayerSleepClock();
                    if (playerSleepInterval) clearInterval(playerSleepInterval);
                    playerSleepInterval = setInterval(updatePlayerSleepClock, 1000);
                };
                window.wakePlayerUp = function() {
                    const screen = document.getElementById('player-sleep-screen');
                    if (!screen) return;
                    screen.classList.add('hidden');
                    if (playerSleepInterval) {
                        clearInterval(playerSleepInterval);
                        playerSleepInterval = null;
                    }
                    // Resume video playback
                    if (window.player) {
                        window.player.play().catch(e => console.log('Resume failed', e));
                    } else {
                        const vid = document.getElementById('player');
                        if (vid) vid.play().catch(e => console.log('Resume failed', e));
                    }
                };
                function updatePlayerSleepClock() {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
                    const clockEl = document.getElementById('playerSleepClock');
                    if (clockEl) clockEl.textContent = timeStr;
                }
                window.toggleAspectRatio = function() {
                    const modes = ['', 'video-aspect-fill', 'video-aspect-stretch', 'video-aspect-4-3', 'video-aspect-16-9'];
                    const labels = ['Original Fit', 'Zoom to Fill', 'Stretch to Fill', '4:3 Ratio', '16:9 Ratio'];
                    let currentModeIndex = modes.findIndex(m => m && document.body.classList.contains(m));
                    if (currentModeIndex === -1) currentModeIndex = 0;
                    document.body.classList.remove(...modes.filter(m => m));
                    const nextIndex = (currentModeIndex + 1) % modes.length;
                    if (modes[nextIndex]) document.body.classList.add(modes[nextIndex]);
                    showIndicator(labels[nextIndex]);
                };
                window.toggleSleepTimer = function() {
                    const intervals = [0, 15, 30, 45, 60, 90, 120];
                    let currentIndex = intervals.indexOf(sleepMinutes);
                    sleepMinutes = intervals[(currentIndex + 1) % intervals.length];
                    if (sleepTimer) {
                        clearInterval(sleepTimer);
                        sleepTimer = null;
                    }
                    if (sleepMinutes === 0) {
                        document.body.classList.remove('sleep-timer-active');
                        showIndicator('Sleep Timer: OFF');
                    } else {
                        document.body.classList.add('sleep-timer-active');
                        showIndicator(`Sleep Timer: ${sleepMinutes}m`);
                        let remainingSeconds = sleepMinutes * 60;
                        // Initial update
                        const mins = Math.floor(remainingSeconds / 60);
                        const secs = remainingSeconds % 60;
                        const indicatorText = document.getElementById('sleep-time');
                        if (indicatorText) indicatorText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                        sleepTimer = setInterval(() => {
                            remainingSeconds--;
                            if (remainingSeconds <= 0) {
                                clearInterval(sleepTimer);
                                sleepTimer = null;
                                window.sleepPlayer();
                                showIndicator('Time Up: Player Stopped');
                                document.body.classList.remove('sleep-timer-active');
                                sleepMinutes = 0;
                            }
                            const mins = Math.floor(remainingSeconds / 60);
                            const secs = remainingSeconds % 60;
                            const indicatorText = document.getElementById('sleep-time');
                            if (indicatorText) indicatorText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                        }, 1000);
                    }
                };
                window.addEventListener('keydown', (e) => {
                    if (document.activeElement.tagName === 'INPUT') return;
                    switch(e.key.toLowerCase()) {
                        case ' ':
                            player.togglePlay();
                            e.preventDefault();
                            break;
                        case 'arrowleft':
                            player.rewind(10);
                            showIndicator('Rewind 10s');
                            break;
                        case 'arrowright':
                            player.forward(10);
                            showIndicator('Forward 10s');
                            break;
                        case 'arrowup':
                            player.volume = Math.min(1, player.volume + 0.1);
                            showIndicator(`Volume: ${Math.round(player.volume * 100)}%`);
                            e.preventDefault();
                            break;
                        case 'arrowdown':
                            player.volume = Math.max(0, player.volume - 0.1);
                            showIndicator(`Volume: ${Math.round(player.volume * 100)}%`);
                            e.preventDefault();
                            break;
                        case 'm':
                            player.muted = !player.muted;
                            showIndicator(player.muted ? 'Muted' : 'Unmuted');
                            break;
                        case 'f':
                            player.fullscreen.toggle();
                            break;
                        case 'z':
                            window.toggleAspectRatio();
                            break;
                        case 's':
                            window.toggleSleepTimer();
                            break;
                    }
                });
            }
            function initZoomGesture(player, video) {
                const container = player.elements?.container || video.closest('.plyr');
                if (!container) return;
                let initialDistance = 0;
                let isZoomed = false;
                const indicator = document.getElementById('zoom-indicator');
                function showIndicator(text) {
                    if (!indicator) return;
                    indicator.textContent = text;
                    indicator.style.opacity = '1';
                    setTimeout(() => {
                        indicator.style.opacity = '0';
                    }, 1500);
                }
                container.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 2) {
                        initialDistance = Math.hypot(
                            e.touches[0].pageX - e.touches[1].pageX,
                            e.touches[0].pageY - e.touches[1].pageY
                        );
                    }
                }, { passive: true });
                container.addEventListener('touchmove', (e) => {
                    if (e.touches.length === 2 && initialDistance > 0) {
                        const currentDistance = Math.hypot(
                            e.touches[0].pageX - e.touches[1].pageX,
                            e.touches[0].pageY - e.touches[1].pageY
                        );
                        const delta = currentDistance - initialDistance;
                        const threshold = 40;
                        if (Math.abs(delta) > threshold) {
                            if (delta > 0 && !isZoomed) {
                                document.body.classList.add('video-zoom-fill');
                                showIndicator('Zoomed to Fill');
                                isZoomed = true;
                                initialDistance = currentDistance;
                            } else if (delta < 0 && isZoomed) {
                                document.body.classList.remove('video-zoom-fill');
                                showIndicator('Original Fit');
                                isZoomed = false;
                                initialDistance = currentDistance;
                            }
                        }
                    }
                }, { passive: true });
                container.addEventListener('touchend', (e) => {
                    if (e.touches.length < 2) {
                        initialDistance = 0;
                    }
                }, { passive: true });
            }
            const video = document.getElementById("player");
            if (!video) return;
            window.addEventListener('error', function(event) {
                console.error('[Global Error]', event.error || event.message);
                if (event.message && (event.message.includes('Unhandled error') || event.message.includes('undefined'))) {
                    console.warn('Caught suspicious unhandled error. Suppressing crash.');
                    event.preventDefault();
                }
            });
            window.addEventListener('unhandledrejection', function(event) {
                console.error('[Unhandled Rejection]', event.reason);
            });
            const source = video.querySelector("source");
            if (!source) return;
            const domSrc = source.src;
            const urlParams = new URLSearchParams(window.location.search);
            const lowerId = (urlParams.get('id') || '').toLowerCase();
            const mediaType = urlParams.get('media_type') || '';
            let isDirectVideo = lowerId.includes('.mp4') || 
                                  lowerId.includes('.mkv') || 
                                  lowerId.includes('.avi') || 
                                  lowerId.includes('.mp3') || 
                                  lowerId.includes('.m4a') || 
                                  lowerId.includes('_mp4') || 
                                  lowerId.includes('_mkv') || 
                                  lowerId.includes('_avi') || 
                                  lowerId.includes('movie') || 
                                  lowerId.includes('series');
            const src = "{{STREAM_URL}}";
            const name = "{{NAME}}";
            const isXtream = {{IS_XTREAM}};
            const srcUrl = src; 
            window.isXtream = isXtream;
            const hasVodKeywords = lowerId.includes('movie') || 
                                   lowerId.includes('series') || 
                                   lowerId.includes('media') || 
                                   lowerId.includes('vod') || 
                                   lowerId.includes('/media/') ||
                                   mediaType === 'movie' ||
                                   mediaType === 'series';
             const hasVodExtension = src.toLowerCase().includes('.mp4') || 
                                     src.toLowerCase().includes('.mkv') || 
                                     src.toLowerCase().includes('.avi');
             const isLive = !hasVodKeywords && !hasVodExtension;
             window.isLive = isLive;
            // --- SMART AUTO-RECONNECT LOGIC ---
            let lastPlayProgressTime = Date.now();
            let lastPlayProgressPosition = -1;
            let isReconnecting = false;
            window.hasStartedPlaying = false;
            let hasStartedPlaying = false; // keep local ref for backward compat in this scope
            Object.defineProperty(window, 'hasStartedPlaying', {
                get: () => hasStartedPlaying,
                set: (v) => { hasStartedPlaying = v; }
            });
            document.addEventListener('playing', (e) => {
                if (e.target && e.target.tagName !== 'VIDEO') return;
                window.hasStartedPlaying = true;
                const overlay = document.getElementById('play-overlay');
                if (overlay) overlay.remove();
                reconnectAttemptCount = 0;
                isReconnecting = false;
                if (typeof countdownInterval !== 'undefined' && countdownInterval) {
                    clearInterval(countdownInterval);
                }
                if (typeof reconnectTimer !== 'undefined' && reconnectTimer) {
                    clearTimeout(reconnectTimer);
                }
                if (typeof showReconnectUI === 'function') {
                    showReconnectUI(false);
                }
                const errDiv = document.getElementById('player-error');
                if (errDiv) errDiv.classList.add('hidden');
                // Show floating unmute badge if muted
                setTimeout(() => {
                    const videoEl = document.getElementById('player');
                    if (videoEl && (videoEl.muted || (window.plyrPlayer && window.plyrPlayer.muted))) {
                        if (typeof window.showUnmuteBadge === 'function') {
                            window.showUnmuteBadge();
                        }
                    }
                }, 1200);
            }, true);
            let reconnectAttemptCount = 0;
            const MAX_RECONNECT_RETRIES = 8;
            let reconnectTimer = null;
            let watchdogInterval = null;
            let countdownInterval = null;
            let currentEngine = null;
            let art = null;
            let xtreamRetryCount = 0;
            let xtreamRetryTimeout = null;
            window.showPlayerError = function(msg) {
                document.getElementById('loading').style.display = 'none';
                const errDiv = document.getElementById('player-error');
                if (errDiv) {
                    errDiv.classList.remove('hidden');
                    const textEl = document.getElementById('error-message-text');
                    if (textEl && msg) {
                        textEl.textContent = msg;
                    }
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
            };
            const showPlayerError = window.showPlayerError;
            window.showUnmuteBadge = function() {
                if (document.getElementById('unmute-badge')) return;
                const badge = document.createElement('div');
                badge.id = 'unmute-badge';
                badge.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-red-600 to-rose-500 text-white font-black uppercase text-[11px] tracking-widest px-6 py-3.5 rounded-full flex items-center gap-2.5 shadow-[0_10px_30px_rgba(239,68,68,0.5)] hover:from-red-500 hover:to-rose-400 active:scale-95 transition-all cursor-pointer animate-bounce border border-red-400/20';
                badge.innerHTML = `
                    <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    <span>Tap to Unmute Audio</span>
                `;
                badge.onclick = function(e) {
                    e.stopPropagation();
                    console.log("[Player] Unmute badge clicked");
                    const video = document.getElementById('player');
                    if (video) video.muted = false;
                    if (window.plyrPlayer) {
                        window.plyrPlayer.muted = false;
                        window.plyrPlayer.volume = 1;
                        window.plyrPlayer.play();
                    }
                    badge.remove();
                };
                document.body.appendChild(badge);
            };
            function showReconnectUI(show = true) {
                const overlay = document.getElementById('reconnect-overlay');
                if (!overlay) return;
                if (show) {
                    const errDiv = document.getElementById('player-error');
                    if (errDiv) errDiv.classList.add('hidden');
                    overlay.classList.remove('hidden');
                    overlay.classList.add('flex');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } else {
                    overlay.classList.add('hidden');
                    overlay.classList.remove('flex');
                }
            }
            // Global interaction handler to resume blocked playback
            document.addEventListener('click', () => {
                console.log("[Player] Interaction detected, attempting forced play/unmute...");
                if (window.art && window.art.video) {
                    window.art.video.muted = false;
                    window.art.video.play().catch(() => {});
                }
                const players = document.querySelectorAll('video');
                players.forEach(p => {
                    p.muted = false;
                    p.play().catch(() => {});
                });
            }, { once: true });
            // Artplayer configs removed in favor of native Plyr.
            function attachAutoReconnect(engine, streamUrl) {
                const onError = (event, data) => {
                    if ((data && data.fatal) || !data) {
                        triggerAutoReconnect(video, engine, streamUrl);
                    }
                };
                const onLoaded = () => {
                    reconnectAttemptCount = 0;
                    showReconnectUI(false);
                };
                if (typeof Hls !== 'undefined' && engine instanceof Hls) {
                    engine.on(Hls.Events.ERROR, onError);
                    engine.on(Hls.Events.FRAG_LOADED, onLoaded);
                } else if (typeof mpegts !== 'undefined') {
                    engine.on('error', onError);
                    engine.on('statistics_info', onLoaded);
                }
            }
            function triggerAutoReconnect(videoElement, engine, srcUrl) {
                if (isReconnecting) return;
                isReconnecting = true;
                hasStartedPlaying = false;
                if (reconnectTimer) clearTimeout(reconnectTimer);
                if (countdownInterval) clearInterval(countdownInterval);
                reconnectAttemptCount++;
                if (reconnectAttemptCount > MAX_RECONNECT_RETRIES) {
                    showPlayerError("Connection failed after multiple attempts.");
                    return;
                }
                const backoffSeconds = Math.min(Math.pow(2, reconnectAttemptCount), 15);
                showReconnectUI(true);
                const titleEl = document.getElementById('reconnect-title');
                if (titleEl) titleEl.textContent = "Connecting...";
                let remaining = backoffSeconds;
                countdownInterval = setInterval(() => {
                    remaining--;
                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        if (engine && engine.destroy) engine.destroy();
                        isReconnecting = false;
                        let newSrc = srcUrl;
                        if (newSrc.includes('nocache=')) {
                            newSrc = newSrc.replace(/nocache=\d+/, 'nocache=' + Date.now());
                        } else {
                            newSrc += (newSrc.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
                        }
                        initLegacyPlayer(newSrc);
                    }
                }, 1000);
            }
            function startWatchdog(videoElement, hlsInstance, srcUrl) {
                if (!isLive) return;
                if (watchdogInterval) clearInterval(watchdogInterval);
                lastPlayProgressTime = Date.now();
                lastPlayProgressPosition = videoElement.currentTime;
                watchdogInterval = setInterval(() => {
                    if (isReconnecting) return;
                    if (!hasStartedPlaying) return;
                    // If paused, sleeping, or ended, we shouldn't trigger reconnect
                    const sleepScreen = document.getElementById('player-sleep-screen');
                    const isSleeping = sleepScreen && !sleepScreen.classList.contains('hidden');
                    if (videoElement.paused || videoElement.ended || isSleeping || videoElement.seeking) {
                        lastPlayProgressTime = Date.now();
                        lastPlayProgressPosition = videoElement.currentTime;
                        return;
                    }
                    const currentPos = videoElement.currentTime;
                    if (currentPos !== lastPlayProgressPosition) {
                        // Playback is active and progressing!
                        lastPlayProgressTime = Date.now();
                        lastPlayProgressPosition = currentPos;
                    } else {
                        // Playback is stalled/frozen!
                        const timeStalled = Date.now() - lastPlayProgressTime;
                        if (timeStalled > 30000) {
                            console.warn(`Watchdog: Playback has been frozen for ${Math.round(timeStalled/1000)}s while expected to play. Reconnecting...`);
                            triggerAutoReconnect(videoElement, hlsInstance, srcUrl);
                        }
                    }
                }, 1000);
            }
            let options = {
                controls: [
                    'play-large',
                    'rewind',
                    'play',
                    'fast-forward',
                    'progress',
                    'current-time',
                    'mute',
                    'volume',
                    'settings',
                    'pip',
                    'download',
                    'fullscreen'
                ],
                settings: ['quality', 'speed']
            };
            let speed = navigator.connection?.downlink || 5;
            let targetQuality = 720;
            if (speed < 1) targetQuality = 240;
            else if (speed < 2) targetQuality = 360;
            else if (speed < 5) targetQuality = 480;
            initLegacyPlayer(src);
            async function initLegacyPlayer(srcUrl) {
                if (srcUrl && !srcUrl.startsWith('http') && !srcUrl.startsWith('blob')) {
                    srcUrl = new URL(srcUrl, window.location.origin).href;
                }
                let hls = null;
                let mpegPlayer = null;
                let player = null;
                let seekOffset = 0;
                let isM3U8 = srcUrl.includes('.m3u8') || lowerId.includes('m3u8') || srcUrl.includes('xtream_live_') || srcUrl.includes('m3u=1');
                let isTs = !isM3U8 && (srcUrl.includes('.ts') || srcUrl.includes('/live/') || srcUrl.includes('transcode=1') || lowerId.includes('_mkv') || lowerId.includes('.mkv'));
                const originalDurationGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration').get;
                const originalCurrentTimeGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').get;
                const originalCurrentTimeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').set;
                const originalBufferedGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'buffered').get;
                // Retrieve VOD duration from server to override native video tag read-only property
                let movieDuration = 0;
                if (!isLive) {
                    try {
                        const infoRes = await fetch(`stalker_api.php?action=stream_info`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: lowerId })
                        });
                        const infoData = await infoRes.json();
                        if (infoData.status === 'success') {
                            movieDuration = infoData.duration || 0;
                            if (movieDuration > 0) {
                                console.log("[Player] Resolved movie duration:", movieDuration);
                            }
                            if (infoData.isM3U8) {
                                console.log("[Player] Server detected stream format: HLS (M3U8)");
                                isM3U8 = true;
                                isTs = false;
                                isDirectVideo = false;
                            } else if (infoData.isTs) {
                                console.log("[Player] Server detected stream format: MPEG-TS");
                                isM3U8 = false;
                                isTs = true;
                                isDirectVideo = false;
                            } else if (infoData.isDirectVideo) {
                                console.log("[Player] Server detected stream format: Direct Video");
                                isM3U8 = false;
                                isTs = false;
                                isDirectVideo = true;
                            }
                            Object.defineProperty(video, 'duration', {
                                get: function() {
                                    if (movieDuration > 0) {
                                        return movieDuration;
                                    }
                                    return originalDurationGetter.call(this);
                                },
                                configurable: true
                            });
                             window.draggedTime = undefined;
                             Object.defineProperty(video, 'currentTime', {
                                get: function() {
                                    const stack = new Error().stack || '';
                                    const nativeTime = originalCurrentTimeGetter.call(this);
                                    if (stack.includes('hls') || stack.includes('Hls') || stack.includes('mpegts') || stack.includes('tsdemuxer')) {
                                        return nativeTime;
                                    }
                                    if (window.isSeekingReload) {
                                        return seekOffset;
                                    }
                                    if (window.draggedTime !== undefined) {
                                        return window.draggedTime;
                                    }
                                    return nativeTime + seekOffset;
                                },
                                set: function(val) {
                                    const stack = new Error().stack || '';
                                    if (stack.includes('hls') || stack.includes('Hls') || stack.includes('mpegts') || stack.includes('tsdemuxer')) {
                                        originalCurrentTimeSetter.call(this, val);
                                    } else {
                                        const isScrubbing = player && (player.seeking || player.scrubbing);
                                        if (isScrubbing) {
                                            window.draggedTime = val;
                                        } else {
                                            triggerSeekReload(val);
                                        }
                                    }
                                },
                                configurable: true
                             });
                             Object.defineProperty(video, 'buffered', {
                                get: function() {
                                    const nativeBuffered = originalBufferedGetter.call(this);
                                    const stack = new Error().stack || '';
                                    if (stack.includes('hls') || stack.includes('Hls') || stack.includes('mpegts') || stack.includes('tsdemuxer')) {
                                        return nativeBuffered;
                                    }
                                    const len = nativeBuffered ? nativeBuffered.length : 0;
                                    return {
                                        length: len,
                                        start: function(index) { return nativeBuffered.start(index) + seekOffset; },
                                        end: function(index) { return nativeBuffered.end(index) + seekOffset; }
                                    };
                                },
                                configurable: true
                             });
                            // Force Plyr refresh on metadata loaded
                            video.addEventListener('loadedmetadata', () => {
                                console.log("[Player] Metadata loaded. Triggering duration change update...");
                                video.dispatchEvent(new Event('durationchange'));
                            });
                        }
                    } catch(e) {
                        console.error("[Player] Failed to load VOD duration:", e);
                    }
                }
                // Unified VOD seek event listener
                function triggerSeekReload(targetTime) {
                    if (isDirectVideo && !mpegPlayer) return; // Native direct videos handle seeks natively
                    if (window.isSeekingReload) return;
                    if (Math.abs(targetTime - (originalCurrentTimeGetter.call(video) + seekOffset)) < 2) return;
                    const wasPaused = video.paused;
                    window.isSeekingReload = true;
                    let seekUrl = srcUrl;
                    if (seekUrl.includes('seek=')) {
                        seekUrl = seekUrl.replace(/seek=\d+/, `seek=${Math.round(targetTime)}`);
                    } else {
                        seekUrl += (seekUrl.includes('?') ? '&' : '?') + `seek=${Math.round(targetTime)}`;
                    }
                    console.log("[Player] Seeking VOD via Virtual Timeline to:", targetTime, "Reloading:", seekUrl);
                    seekOffset = targetTime;
                    if (mpegPlayer) {
                        try { mpegPlayer.destroy(); } catch(e){}
                        mpegPlayer = mpegts.createPlayer({
                            type: 'mpegts',
                            isLive: isLive,
                            url: new URL(seekUrl, window.location.origin).href
                        }, {
                            enableWorker: true,
                            enableStashBuffer: false,
                            stashInitialSize: 128
                        });
                        mpegPlayer.attachMediaElement(video);
                        mpegPlayer.load();
                        mpegPlayer.on(mpegts.Events.ERROR, (type, details, data) => {
                            console.error('mpegts.js Seek Error:', type, details, data);
                            if (type === mpegts.ErrorTypes.MEDIA_ERROR) {
                                console.warn("MSE Error detected. Trying native playback fallback...");
                                mpegPlayer.destroy();
                                window.currentEngine = null;
                                mpegPlayer = null;
                                video.src = srcUrl;
                                video.load();
                                video.currentTime = targetTime;
                                video.play().catch(e => {
                                    console.error("Native fallback play failed:", e);
                                    showPlayerError("Playback failed: Incompatible audio/video codecs (e.g. HEVC/H.265). Your browser/device cannot decode this stream natively.");
                                });
                                window.isSeekingReload = false;
                                return;
                            }
                            triggerAutoReconnect(video, mpegPlayer, srcUrl);
                        });
                        if (wasPaused) {
                            video.pause();
                            window.isSeekingReload = false;
                        } else {
                            mpegPlayer.play().then(() => {
                                window.isSeekingReload = false;
                            }).catch(() => {
                                window.isSeekingReload = false;
                            });
                        }
                    } else if (hls) {
                        hls.destroy();
                        hls = new Hls({
                            enableWorker: true,
                            xhrSetup: (xhr, url) => {
                                try {
                                    if (!url || url.startsWith('/') || !url.includes('://') || (window.location && url.includes(window.location.host))) {
                                        xhr.withCredentials = true;
                                    } else {
                                        xhr.withCredentials = false;
                                    }
                                } catch (e) {
                                    xhr.withCredentials = false;
                                }
                            }
                        });
                        hls.loadSource(new URL(seekUrl, window.location.origin).href);
                        hls.attachMedia(video);
                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            if (wasPaused) {
                                video.pause();
                                window.isSeekingReload = false;
                            } else {
                                video.play().then(() => {
                                    window.isSeekingReload = false;
                                }).catch(() => {
                                    window.isSeekingReload = false;
                                });
                            }
                        });
                    } else {
                        if (player) {
                            player.source = {
                                type: 'video',
                                sources: [
                                    {
                                        src: new URL(seekUrl, window.location.origin).href
                                    }
                                ]
                            };
                        } else {
                            video.src = new URL(seekUrl, window.location.origin).href;
                        }
                        if (wasPaused) {
                            video.pause();
                            window.isSeekingReload = false;
                        } else {
                            video.play().then(() => {
                                window.isSeekingReload = false;
                            }).catch(() => {
                                window.isSeekingReload = false;
                            });
                        }
                    }
                }
                if (isTs && mpegts.isSupported()) {
                    console.log("[Player] Initializing mpegts.js for TS stream:", srcUrl);
                    mpegPlayer = mpegts.createPlayer({
                        type: 'mpegts',
                        isLive: isLive,
                        url: srcUrl
                    }, {
                        enableWorker: true,
                        enableStashBuffer: false,
                        stashInitialSize: 128,
                        liveBufferLatencyChasing: true,
                        liveBufferLatencyMaxLatency: 15.0,
                        liveBufferLatencyMinRemain: 1.0,
                        autoCleanupSourceBuffer: true,
                        autoCleanupMaxBackwardDuration: 30,
                        autoCleanupMinBackwardDuration: 10
                    });
                    mpegPlayer.attachMediaElement(video);
                    mpegPlayer.load();
                    mpegPlayer.on(mpegts.Events.ERROR, (type, details, data) => {
                        console.error('mpegts.js Error:', type, details, data);
                        if (type === mpegts.ErrorTypes.MEDIA_ERROR || details === mpegts.ErrorDetails.FORMAT_UNSUPPORTED) {
                            console.warn("MSE/Format Error detected. Trying native playback fallback...");
                            mpegPlayer.destroy();
                            window.currentEngine = null;
                            mpegPlayer = null;
                            video.src = srcUrl;
                            video.load();
                            video.play().catch(e => {
                                console.error("Native fallback play failed:", e);
                                showPlayerError("Playback failed: Incompatible audio/video codecs (e.g. HEVC/H.265). Your browser/device cannot decode this stream natively.");
                            });
                            return;
                        } else if (type === mpegts.ErrorTypes.NETWORK_ERROR && details === mpegts.ErrorDetails.HTTP_STATUS_CODE_INVALID) {
                            console.error("Stream is currently offline or returning HTTP error. Retrying...");
                            triggerAutoReconnect(video, mpegPlayer, srcUrl);
                            return;
                        }
                        triggerAutoReconnect(video, mpegPlayer, srcUrl);
                    });
                    player = new Plyr(video, options);
                    window.plyrPlayer = player;
                    player.on('error', (err) => {
                        console.error('Plyr error:', err);
                    });
                    video.style.opacity = 1;
                    document.getElementById('loading').style.display = 'none';
                    player.play().catch(() => {});
                    initTopControls(player, video);
                    initAdvancedGestures(player, video);
                    initZoomGesture(player, video);
                    startWatchdog(video, mpegPlayer, srcUrl);
                    window.currentEngine = mpegPlayer;
                    // Restrict live seek limit in mpegts
                    if (isLive) {
                        player.on('seeking', () => {
                            let maxBuffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : video.currentTime;
                            if (player.currentTime < maxBuffered - 50) {
                                player.currentTime = maxBuffered - 50;
                            }
                        });
                    }
                    // Native Multi-audio / Subtitles tracks selection support for Plyr
                    video.addEventListener('loadedmetadata', () => {
                        console.log("[Player] Loaded metadata. Scanning for embedded audio/subtitle tracks...");
                        // Handle native audio track selection UI or triggers
                        if (video.audioTracks && video.audioTracks.length > 1) {
                            console.log("[Player] Found native multi-audio tracks:", video.audioTracks.length);
                            // Set up custom audio select elements or log
                        }
                    });
                } else if (Hls.isSupported() && !isDirectVideo) {
                    hls = new Hls({
                    startFragPrefetch: true,
                    progressive: true,
                    maxBufferLength: 60,
                    maxMaxBufferLength: 600,
                    backBufferLength: 90,
                    enableWorker: true,
                    capLevelToPlayerSize: true,
                    // Let hls.js naturally calculate the live edge
                    // We only increase timeouts to handle slow proxies
                    manifestLoadingTimeOut: 30000, 
                    manifestLoadingMaxRetry: 10,
                    manifestLoadingRetryDelay: 1000,
                    levelLoadingTimeOut: 30000,
                    levelLoadingMaxRetry: 10,
                    levelLoadingRetryDelay: 1000,
                    fragLoadingTimeOut: 60000, 
                    fragLoadingMaxRetry: 10,
                    fragLoadingRetryDelay: 1000,
                });
                let manifestLoaded = false;
                let loadingTimeout = setTimeout(() => {
                    if (!manifestLoaded) {
                        console.error("Manifest load timed out (App Level Fallback). Triggering Smart Auto-Reconnect...");
                        triggerAutoReconnect(video, hls, src);
                    }
                }, 45000); // 45 seconds fallback timeout
                let bufferAppendErrorCount = 0;
                let networkRetryCount = 0;
                let mediaRetryCount = 0;
                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.error('HLS Fatal Error:', data.type, data.details);
                    } else {
                        console.warn('HLS Warning:', data.type, data.details);
                    }
                    const statusCode = data.response?.code || data.response?.status;
                    if (statusCode === 401 || statusCode === 403) {
                        console.error(`Authorization error (${statusCode}) encountered. Reconnecting...`);
                        triggerAutoReconnect(video, hls, src);
                        return;
                    }
                    // Handle direct codec error or MSE incompatibility immediately by falling back to native player
                    if (data.details === 'bufferIncompatibleCodecsError' || 
                        data.details === 'bufferAddCodecError' || 
                        data.details === 'bufferIncompatibleCodecs' || 
                        (data.details && data.details.toLowerCase().includes('codec'))) {
                        if (supportsNativeHls) {
                            console.warn(`Browser MSE codec incompatibility (${data.details}). Falling back to native player...`);
                            clearTimeout(loadingTimeout);
                            if (reconnectTimer) clearTimeout(reconnectTimer);
                            if (countdownInterval) clearInterval(countdownInterval);
                            isReconnecting = false;
                            try {
                                hls.destroy();
                            } catch (e) {}
                            while (video.firstChild) {
                                video.removeChild(video.firstChild);
                            }
                            video.removeAttribute('type');
                            video.src = src;
                            video.load();
                            video.play()
                                .then(() => {
                                    console.log("Native player fallback: Playback started successfully!");
                                    document.getElementById('loading').style.display = 'none';
                                })
                                .catch(e => {
                                    console.error("Native fallback play failed:", e);
                                    showPlayerError("Playback failed: Incompatible audio/video codecs. Your browser/device cannot decode this stream.");
                                });
                        } else {
                            console.error(`Browser MSE codec incompatibility (${data.details}) and native HLS is NOT supported. Triggering Smart Auto-Reconnect...`);
                            clearTimeout(loadingTimeout);
                            triggerAutoReconnect(video, hls, src);
                        }
                        return;
                    }
                    // Proactively handle bufferAppendError (whether fatal or non-fatal) to prevent playback freezing/stuck issues
                    if (data.details === 'bufferAppendError' || data.details === 'bufferAppendedError' || data.details === Hls.ErrorDetails?.BUFFER_APPEND_ERROR) {
                        bufferAppendErrorCount++;
                        if (bufferAppendErrorCount <= 3) {
                            console.warn(`Buffer append error detected (${bufferAppendErrorCount}/3). Attempting media recovery...`);
                            hls.recoverMediaError();
                        } else {
                            if (supportsNativeHls) {
                                console.error('Persistent buffer append error. Falling back to native player...');
                                bufferAppendErrorCount = 0;
                                clearTimeout(loadingTimeout);
                                if (reconnectTimer) clearTimeout(reconnectTimer);
                                if (countdownInterval) clearInterval(countdownInterval);
                                isReconnecting = false;
                                try {
                                    hls.destroy();
                                } catch (e) {}
                                while (video.firstChild) {
                                    video.removeChild(video.firstChild);
                                }
                                video.removeAttribute('type');
                                video.src = src;
                                video.load();
                                video.play().catch(e => {
                                    console.error("Native fallback play failed:", e);
                                    showPlayerError("Playback failed: Incompatible audio/video codecs. Your browser/device cannot decode this stream.");
                                });
                            } else {
                                console.error('Persistent buffer append error and native HLS is NOT supported. Triggering Smart Auto-Reconnect...');
                                bufferAppendErrorCount = 0;
                                clearTimeout(loadingTimeout);
                                triggerAutoReconnect(video, hls, src);
                            }
                        }
                        return;
                    } else if (data.details === 'bufferStalledError' || data.details === Hls.ErrorDetails?.BUFFER_STALLED_ERROR) {
                        // Log stall but don't nudge aggressively, let hls.js handle it
                        if (!video.paused && video.readyState < 3) {
                            console.warn('Playback stalled. Waiting for buffer...');
                        }
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        // Reset count on successful recovery or other non-append media events
                        bufferAppendErrorCount = 0;
                    }
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                networkRetryCount++;
                                if (networkRetryCount <= 5) {
                                    console.warn(`Fatal network error (${data.details}), retrying (${networkRetryCount}/5)...`);
                                    const delay = Math.min(1000 * Math.pow(2, networkRetryCount - 1), 8000);
                                    setTimeout(() => {
                                        if (data.details === 'manifestLoadError' || 
                                            data.details === 'manifestLoadTimeOut' || 
                                            data.details === Hls.ErrorDetails?.MANIFEST_LOAD_ERROR || 
                                            data.details === Hls.ErrorDetails?.MANIFEST_LOAD_TIMEOUT) {
                                            console.log("HLS SRC:", src); hls.loadSource(src);
                                        } else {
                                            hls.startLoad();
                                        }
                                    }, delay);
                                } else {
                                    console.error('Max network retries reached. Triggering background Smart Auto-Reconnect...');
                                    clearTimeout(loadingTimeout);
                                    triggerAutoReconnect(video, hls, src);
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                mediaRetryCount++;
                                if (mediaRetryCount <= 5) {
                                    console.warn(`Fatal media error (${data.details}), recovering (${mediaRetryCount}/5)...`);
                                    hls.recoverMediaError();
                                } else {
                                    if (supportsNativeHls) {
                                        console.error('Max media retries reached. Falling back to native player...');
                                        mediaRetryCount = 0;
                                        clearTimeout(loadingTimeout);
                                        if (reconnectTimer) clearTimeout(reconnectTimer);
                                        if (countdownInterval) clearInterval(countdownInterval);
                                        isReconnecting = false;
                                        try {
                                            hls.destroy();
                                        } catch (e) {}
                                        while (video.firstChild) {
                                            video.removeChild(video.firstChild);
                                        }
                                        video.removeAttribute('type');
                                        video.src = src;
                                        video.load();
                                        video.play().catch(e => {
                                            console.error("Native fallback play failed:", e);
                                            showPlayerError("Playback failed: Incompatible audio/video codecs. Your browser/device cannot decode this stream.");
                                        });
                                    } else {
                                        console.error('Max media retries reached and native HLS is NOT supported. Triggering fresh Smart Auto-Reconnect...');
                                        mediaRetryCount = 0;
                                        clearTimeout(loadingTimeout);
                                        triggerAutoReconnect(video, hls, src);
                                    }
                                }
                                break;
                            default:
                                console.error('Unrecoverable HLS error. Triggering background Smart Auto-Reconnect...');
                                clearTimeout(loadingTimeout);
                                triggerAutoReconnect(video, hls, src);
                                break;
                        }
                    }
                });
                console.log("HLS SRC:", src); hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    clearTimeout(loadingTimeout);
                    manifestLoaded = true;
                    const levels = hls.levels;
                    let qualities = [];
                    levels.forEach(l => {
                        if (l.height && !qualities.includes(l.height)) {
                            qualities.push(l.height);
                        }
                    });
                    qualities.unshift(0);
                    hls.currentLevel = -1;
                    options.quality = {
                        default: 0,
                        options: qualities,
                        forced: true,
                        onChange: q => {
                            if (q === 0) {
                                hls.currentLevel = -1;
                            } else {
                                const idx = levels.findIndex(l => l.height === q);
                                if (idx > -1) hls.currentLevel = idx;
                            }
                        }
                    };
                    options.i18n = {
                        qualityLabel: {
                            0: 'Auto'
                        }
                    };
                    player = new Plyr(video, options);
                    window.plyrPlayer = player;
                    player.on('error', (err) => {
                        console.error('Plyr error:', err);
                    });
                    video.style.opacity = 1;
                    document.getElementById('loading').style.display = 'none';
                    player.play().catch(() => {});
                    player.on('ready', () => {
                        video.style.opacity = 1;
                        document.getElementById('loading').style.display = 'none';
                    });
                    initTopControls(player, video);
                    initAdvancedGestures(player, video);
                    initZoomGesture(player, video);
                    startWatchdog(video, hls, src);
                    window.currentEngine = hls;
                });
                window.hls = hls;
            } else {
                if (isDirectVideo) {
                    while (video.firstChild) {
                        video.removeChild(video.firstChild);
                    }
                    video.removeAttribute('type');
                    video.src = src;
                }
                let manifestLoaded = false;
                let loadingTimeout = setTimeout(() => {
                    if (!manifestLoaded) {
                        console.error("Native player loading timed out. Triggering Smart Auto-Reconnect...");
                        triggerAutoReconnect(video, null, src);
                    }
                }, 45000);
                player = new Plyr(video, options);
                window.plyrPlayer = player;
                video.style.opacity = 1;
                document.getElementById('loading').style.display = 'none';
                player.play().catch(() => {});
                video.addEventListener('error', function() {
                    const err = video.error;
                    console.error('Native video element error:', err);
                    let errMsg = "A native playback error occurred.";
                    if (err) {
                        if (err.code === 1) errMsg = "Playback aborted by user.";
                        else if (err.code === 2) errMsg = "Network error while downloading the stream.";
                        else if (err.code === 3) errMsg = "Media decoding failed. The format may not be supported.";
                        else if (err.code === 4) errMsg = "The stream is not playable or access was denied.";
                    }
                    showPlayerError(errMsg);
                });
                player.on('ready', () => {
                    video.style.opacity = 1;
                    document.getElementById('loading').style.display = 'none';
                    clearTimeout(loadingTimeout);
                    manifestLoaded = true;
                });
                initTopControls(player, video);
                initAdvancedGestures(player, video);
                initZoomGesture(player, video);
                startWatchdog(video, null, src);
                window.currentEngine = player;
                if (!isLive) {
                    player.on('seeked', () => {
                        if (window.draggedTime !== undefined) {
                            const target = window.draggedTime;
                            window.draggedTime = undefined;
                            triggerSeekReload(target);
                        }
                    });
                }
            }
        }
        });
        // Global interaction listener for autoplay/unmute recovery
        document.addEventListener('click', function(e) {
            if (e.target && e.target.closest && (e.target.closest('.plyr__controls') || e.target.closest('.plyr__video-wrapper'))) return;
            if (!window.hasStartedPlaying) {
                console.log("[Player] Interaction detected, attempting forced play/unmute...");
                const video = document.getElementById('player');
                if (video) {
                    video.muted = false;
                }
                if (window.plyrPlayer) {
                    window.plyrPlayer.muted = false;
                    window.plyrPlayer.volume = 1;
                    window.plyrPlayer.play().then(() => {
                        window.hasStartedPlaying = true;
                        const overlay = document.getElementById('play-overlay');
                        if (overlay) overlay.remove();
                        const badge = document.getElementById('unmute-badge');
                        if (badge) badge.remove();
                    }).catch(e => console.warn("Plyr forced play failed:", e));
                } else if (video) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            window.hasStartedPlaying = true;
                            const overlay = document.getElementById('play-overlay');
                            if (overlay) overlay.remove();
                            const badge = document.getElementById('unmute-badge');
                            if (badge) badge.remove();
                        }).catch(e => console.warn("Video forced play failed:", e));
                    }
                }
            }
        }, { once: false });
        const targetVideo = document.getElementById('player');
        if (targetVideo) {
            targetVideo.addEventListener('loadedmetadata', () => {
                // Track selector logic removed
            });
        }
    </script>
    <script src="assets/tv-navigation.js"></script>
    <script src="assets/local-ai.js?v=2.0"></script>
</body>
</html>