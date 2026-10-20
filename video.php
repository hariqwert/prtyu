<?php
$id = isset($_GET['id']) ? $_GET['id'] : (isset($_GET['tmdbId']) ? $_GET['tmdbId'] : '{{ID}}');
$type = isset($_GET['type']) ? $_GET['type'] : (isset($_GET['media_type']) ? $_GET['media_type'] : '{{TYPE}}');
if ($type === '{{TYPE}}' || empty($type)) $type = 'movie';
$title = isset($_GET['title']) ? $_GET['title'] : (isset($_GET['name']) ? $_GET['name'] : '{{TITLE}}');
if ($title === '{{TITLE}}' || empty($title)) $title = 'Cinema Presentation';
$s = isset($_GET['s']) ? $_GET['s'] : (isset($_GET['season']) ? $_GET['season'] : '{{SEASON}}');
if ($s === '{{SEASON}}' || empty($s)) $s = '1';
$e = isset($_GET['e']) ? $_GET['e'] : (isset($_GET['episode']) ? $_GET['episode'] : '{{EPISODE}}');
if ($e === '{{EPISODE}}' || empty($e)) $e = '1';
$srv = isset($_GET['srv']) ? $_GET['srv'] : '{{SRV}}';
if ($srv === '{{SRV}}' || empty($srv)) $srv = 's40';
$directUrl = isset($_GET['url']) ? $_GET['url'] : '{{URL}}';
if ($directUrl === '{{URL}}') $directUrl = '';
$source = isset($_GET['source']) ? $_GET['source'] : 'consumet.html';
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?php echo htmlspecialchars($title); ?> | Bingr 4K Cinema Player</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            font-family: 'Plus Jakarta Sans', sans-serif;
            color-scheme: dark;
            --sub-font-size: 1.15rem;
            --sub-color: #ffffff;
            --sub-bg: rgba(0, 0, 0, 0.65);
            --sub-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
        }
        * {
            -webkit-tap-highlight-color: transparent !important;
            user-select: none;
            box-sizing: border-box;
        }
        *:focus, *:focus-visible { outline: none !important; }
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            color: #fff;
            overflow: hidden;
        }

        #playerContainer {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            transition: transform 0.3s ease;
        }

        video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
            transition: transform 0.3s ease, object-fit 0.3s ease;
        }
        video.fit-cover { object-fit: cover !important; }
        video.fit-fill { object-fit: fill !important; }
        video.zoom-120 { transform: scale(1.2) !important; }

        /* Subtitle Styling */
        ::cue {
            font-size: var(--sub-font-size) !important;
            color: var(--sub-color) !important;
            background-color: var(--sub-bg) !important;
            text-shadow: var(--sub-shadow) !important;
            line-height: 1.4 !important;
            border-radius: 8px !important;
            padding: 3px 8px !important;
        }

        /* Glassmorphism Classes */
        .glass-panel {
            background: rgba(10, 10, 14, 0.45);
            backdrop-filter: blur(28px) saturate(180%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.10);
        }
        .glass-sub-panel {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glass-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(16px);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.25);
            transform: translateY(-1px);
        }
        .glass-btn:active {
            transform: scale(0.95);
        }

        /* Animated Play/Pause Button */
        .play-btn-animated {
            position: relative;
            background: #ffffff;
            color: #000000;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, background-color 0.2s ease;
        }
        .play-btn-animated:hover {
            transform: scale(1.12);
            box-shadow: 0 0 35px rgba(255, 255, 255, 0.6), 0 6px 18px rgba(0, 0, 0, 0.6);
            background: #f8fafc;
        }
        .play-btn-animated:active {
            transform: scale(0.92);
        }
        .play-btn-animated::before {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        .play-btn-animated:hover::before {
            opacity: 1;
        }
        .icon-morph {
            transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
        }

        /* Timeline Scrubber */
        .timeline-container {
            position: relative;
            height: 24px;
            display: flex;
            align-items: center;
            cursor: pointer;
            touch-action: none;
        }
        .timeline-track {
            position: relative;
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.18);
            border-radius: 9999px;
            transition: height 0.15s ease;
        }
        .timeline-container:hover .timeline-track,
        .timeline-container.is-scrubbing .timeline-track {
            height: 7px;
        }
        .timeline-buffer {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.35);
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
        }
        .timeline-progress {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: linear-gradient(90deg, #dc2626, #ef4444);
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.6);
        }
        .timeline-thumb {
            position: absolute;
            top: 50%;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #ef4444;
            transform: translate(-50%, -50%) scale(0);
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
            pointer-events: none;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.95);
        }
        .timeline-container:hover .timeline-thumb,
        .timeline-container.is-scrubbing .timeline-thumb {
            transform: translate(-50%, -50%) scale(1.35);
        }

        /* Volume Slider */
        .volume-slider-track {
            -webkit-appearance: none;
            appearance: none;
            height: 4px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.25);
            outline: none;
            cursor: pointer;
        }
        .volume-slider-track::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ffffff;
            border: 1px solid #ef4444;
            cursor: pointer;
        }
        .volume-slider-track::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ffffff;
            border: 1px solid #ef4444;
            cursor: pointer;
        }

        /* Toast HUD Indicator */
        #zoom-indicator {
            position: absolute;
            top: 5.5rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 10, 14, 0.65);
            color: #fff;
            padding: 0.55rem 1.4rem;
            border-radius: 9999px;
            font-size: 0.825rem;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(28px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s;
            z-index: 10000;
        }

        /* Floating Sleep Badge */
        #sleep-indicator {
            position: absolute;
            top: 5.5rem;
            right: 1.5rem;
            background: rgba(10, 10, 14, 0.65);
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
            backdrop-filter: blur(20px);
        }

        /* Skip Intro & Next Episode Pills */
        .apple-skip-btn {
            position: absolute;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(10, 10, 14, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.20);
            color: #ffffff;
            padding: 10px 22px;
            border-radius: 9999px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            backdrop-filter: blur(25px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, box-shadow 0.2s;
        }
        .apple-skip-btn:hover {
            transform: scale(1.05);
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.35);
        }
        .apple-skip-btn:active {
            transform: scale(0.97);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        
        .animate-fade-in { animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
        }

        /* Center Burst Expansion */
        @keyframes burstPulse {
            0% { transform: scale(0.65); opacity: 0; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 0.95; }
        }
        .burst-active {
            animation: burstPulse 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
    </style>
    <style>
        body.embed-active .hide-in-embed {
            display: none !important;
        }
    </style>
</head>
<body class="bg-black text-white relative w-screen h-screen overflow-hidden select-none">

    <!-- Toast Indicator -->
    <div id="zoom-indicator">Fit to Screen</div>

    <!-- Sleep Timer Floating Badge -->
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3.5 h-3.5 animate-pulse"></i>
        <span id="sleep-time">00:00</span>
    </div>

    <!-- Main Player Canvas -->
    <div id="playerContainer" class="relative w-full h-full flex items-center justify-center bg-black">
        <video id="mainVideo" class="w-full h-full object-contain cursor-pointer" playsinline preload="auto"></video>
        
        <!-- Fallback Embed Iframe -->
        <iframe id="embedFrame" class="w-full h-full border-0 hidden" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="origin"></iframe>

        <!-- Embed Touch Sensor (For showing controls over iframe) -->
        <div id="embedTouchSensor" class="absolute inset-0 z-20 hidden" onmousemove="resetControlsTimer()" ontouchstart="resetControlsTimer()"></div>

        <!-- Loading Spinner -->
        <div id="streamLoading" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-300">
            <div class="relative flex items-center justify-center">
                <div class="w-14 h-14 rounded-full border-3 border-white/10 border-t-red-500 animate-spin"></div>
                <i data-lucide="play" class="w-5 h-5 text-red-500 absolute fill-current"></i>
            </div>
            <p id="streamLoadingMsg" class="mt-4 text-xs font-bold tracking-widest uppercase text-zinc-300">Connecting to Stream...</p>
            <span id="streamLoadingSub" class="text-[10px] text-zinc-500 mt-1">Cascading high-speed CDN clusters</span>
        </div>

        <!-- Center Play/Pause / Rewind / Forward Animated Burst -->
        <div id="centerPlayBurst" class="absolute z-20 w-20 h-20 rounded-full glass-panel flex items-center justify-center text-white opacity-0 pointer-events-none transition-all duration-300 transform scale-75 shadow-2xl">
            <i id="centerBurstIcon" data-lucide="play" class="w-10 h-10 ml-1"></i>
        </div>

        <!-- MEDIA HUD OVERLAY (ON PAUSE / INITIAL LOAD) -->
        <div id="mediaHudOverlay" class="absolute inset-0 z-20 pointer-events-none transition-opacity duration-500 bg-gradient-to-t from-black/90 via-black/35 to-black/60 flex flex-col justify-between p-6 sm:p-10 lg:p-14 opacity-100">
            <div class="h-16"></div>

            <div class="max-w-2xl space-y-3 pointer-events-auto pb-16">
                <!-- TMDB Stylized Logo Image or Title -->
                <div id="hudLogoContainer" class="min-h-[50px] flex items-end">
                    <img id="hudLogoImg" src="" alt="Title Logo" class="max-h-24 sm:max-h-28 max-w-[280px] sm:max-w-[380px] object-contain hidden filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                    <h1 id="hudTitleText" class="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight drop-shadow-lg leading-none">
                        <?php echo htmlspecialchars($title); ?>
                    </h1>
                </div>

                <!-- Metadata Row: Year • Runtime • Rating • Certification • Badges -->
                <div class="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-zinc-300 flex-wrap">
                    <span id="hudYear" class="px-2 py-0.5 rounded-lg glass-sub-panel text-white">2024</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRuntime">1h 55m</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRating" class="px-2 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-300 font-extrabold text-[11px] sm:text-xs">
                        7.8 / 10
                    </span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudCert" class="px-2 py-0.5 rounded-lg glass-sub-panel text-[10px] uppercase font-bold text-zinc-400">PG-13</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudClusterBadge" class="px-2 py-0.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-wider">Bingr 4K Master</span>
                </div>

                <!-- Synopsis Text Paragraph -->
                <p id="hudOverview" class="text-xs sm:text-sm text-zinc-300/90 leading-relaxed line-clamp-3 sm:line-clamp-4 drop-shadow">
                    Loading media overview and synopsis from databanks...
                </p>
            </div>
        </div>

        <!-- TOP CONTROLS BAR -->
        <div id="topControlsBar" class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-6 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300">
            <!-- Left Controls: Back + Title Pill -->
            <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <button id="btnBack" onclick="handleGoBack()" class="w-10 h-10 rounded-full glass-btn hover:bg-red-600 hover:border-red-500/50 flex items-center justify-center text-white shrink-0 shadow-lg cursor-pointer" title="Back">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div class="flex flex-col min-w-0">
                    <h2 id="topBarTitle" class="text-xs sm:text-base font-bold text-white truncate drop-shadow max-w-[150px] xs:max-w-[220px] sm:max-w-md">
                        <?php echo htmlspecialchars($title); ?>
                    </h2>
                    <span id="topBarSub" class="text-[9px] sm:text-[10px] text-zinc-400 font-semibold tracking-wider uppercase truncate">
                        <?php echo $type === 'tv' ? "Season {$s} &bull; Episode {$e}" : "Cinema Movie Presentation"; ?>
                    </span>
                </div>
            </div>

            <!-- Right Controls: Power Tools & Modals (with Mobile Scrolling Option) -->
            <div class="flex items-center min-w-0 max-w-[65vw] sm:max-w-none">
                <button onclick="const el=document.getElementById('videoTopControlsScroll'); if(el) el.scrollBy({left: -120, behavior: 'smooth'});" class="sm:hidden w-6 h-6 rounded-full bg-black/70 border border-white/15 text-zinc-300 flex items-center justify-center shrink-0 active:scale-90 mr-1" title="Scroll Tools Left">
                    <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                </button>
                <div id="videoTopControlsScroll" class="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-1 min-w-0 justify-start sm:justify-end flex-nowrap" style="-webkit-overflow-scrolling: touch;">
                <!-- Reconnect Stream Button -->
                <button onclick="triggerAutoReconnect()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Reconnect Stream">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>

                <!-- Aspect Ratio Button -->
                <button onclick="toggleAspectRatio()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Toggle Aspect Ratio">
                    <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>

                <!-- Rotate View Button -->
                <button onclick="toggleRotation()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Rotate Player">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>

                <!-- Sleep Timer Button -->
                <button onclick="toggleSleepModal()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Sleep Timer">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                </button>

                <!-- TV Episodes Drawer Toggle (If Series) -->
                <?php if ($type === 'tv'): ?>
                <button id="btnEpisodesDrawer" onclick="toggleEpisodesDrawer()" class="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-xs font-bold text-blue-300 hover:text-white flex items-center gap-1.5 transition-all glass-btn cursor-pointer shadow-lg shrink-0" title="Episodes Picker">
                    <i data-lucide="list-video" class="w-3.5 h-3.5"></i>
                    <span class="hidden md:inline">Episodes</span>
                </button>
                <?php endif; ?>

                <!-- Watch Together (Party Mode) Button -->
                <button onclick="togglePartyMode()" class="hide-in-embed px-3 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600 border border-pink-500/30 text-xs font-bold text-pink-300 hover:text-white flex items-center gap-1.5 transition-all glass-btn cursor-pointer shadow-lg shrink-0" title="Watch Together (Party Mode)">
                    <i data-lucide="users" class="w-3.5 h-3.5"></i>
                    <span class="hidden md:inline">Party</span>
                </button>

                <!-- Quality & Server Button -->
                <button id="btnOpenQualityServer" onclick="toggleQualityServerModal()" class="px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-lg shrink-0" title="Quality & Servers">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span id="qualityButtonLabel" class="hidden xs:inline">Auto &bull; 1080p</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
                </button>

                <!-- Audio Dubs Button -->
                <button id="btnOpenAudio" onclick="openAudioModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Audio Dubs & Multi-Language Tracks">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5 text-emerald-400"></i>
                    <span id="topBarAudioLabel" class="hidden sm:inline">Audio</span>
                </button>

                <!-- Subtitles Button -->
                <button id="btnOpenSubtitles" onclick="openSubtitlesModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Subtitles & Closed Captions">
                    <i data-lucide="languages" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span class="hidden sm:inline">Subtitles</span>
                </button>
                </div>
                <button onclick="const el=document.getElementById('videoTopControlsScroll'); if(el) el.scrollBy({left: 120, behavior: 'smooth'});" class="sm:hidden w-6 h-6 rounded-full bg-black/70 border border-white/15 text-zinc-300 flex items-center justify-center shrink-0 active:scale-90 ml-1" title="Scroll Tools Right">
                    <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>

        <!-- BOTTOM CONTROLS BAR -->
        <div id="bottomControlsBar" class="absolute bottom-0 left-0 right-0 z-30 flex flex-col p-3 sm:p-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300 gap-2">
            <!-- Timeline Scrubber -->
            <div id="timelineContainer" class="timeline-container w-full">
                <div class="timeline-track">
                    <div id="timelineBuffer" class="timeline-buffer"></div>
                    <div id="timelineProgress" class="timeline-progress"></div>
                    <div id="timelineThumb" class="timeline-thumb"></div>
                </div>
                <div id="timelineTooltip" class="absolute -top-7 px-2 py-0.5 rounded-lg glass-panel text-[10px] font-mono text-white pointer-events-none opacity-0 transition-opacity">0:00</div>
            </div>

            <!-- Control Actions Bar (Responsive Horizontal Scrolling on Mobile) -->
            <div class="relative w-full flex items-center">
                <!-- Mobile Scroll Left Button -->
                <button onclick="const el=document.getElementById('videoControlsActionBar'); if(el) el.scrollBy({left: -160, behavior: 'smooth'});" class="sm:hidden w-8 h-8 rounded-full bg-black/70 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 active:scale-90 shadow-xl mr-1 z-10 cursor-pointer" title="Scroll Controls Left">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>

                <div id="videoControlsActionBar" class="flex items-center justify-start sm:justify-between gap-2.5 sm:gap-4 pt-1 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x w-full flex-nowrap" style="-webkit-overflow-scrolling: touch;">
                <!-- Left: Rewind, Animated Play/Pause, Fast Forward, Volume -->
                <div class="flex items-center gap-2 sm:gap-4 shrink-0">
                    <button onclick="seekRelative(-10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Rewind 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">&laquo; 10</span>
                    </button>

                    <!-- ANIMATED PLAY / PAUSE BUTTON -->
                    <button id="btnPlayPause" onclick="togglePlayPause()" class="w-11 h-11 sm:w-12 sm:h-12 play-btn-animated group shrink-0" title="Play/Pause">
                        <i id="playIcon" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current icon-morph"></i>
                        <i id="pauseIcon" data-lucide="pause" class="w-5 h-5 hidden fill-current icon-morph"></i>
                    </button>

                    <button onclick="seekRelative(10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Forward 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">10 &raquo;</span>
                    </button>

                    <div class="flex items-center gap-2 group shrink-0">
                        <button id="btnMute" onclick="toggleMute()" class="text-zinc-300 hover:text-white transition-colors cursor-pointer p-1" title="Mute/Unmute">
                            <i id="volumeIcon" data-lucide="volume-2" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                        </button>
                        <input id="volumeSlider" type="range" min="0" max="1" step="0.05" value="1" oninput="setVolume(this.value)" class="volume-slider-track w-14 sm:w-20 hidden group-hover:block sm:block transition-all">
                    </div>
                </div>

                <!-- Center: More Like This Drawer Toggle -->
                <div class="flex items-center shrink-0 px-1">
                    <button id="btnToggleMoreLikeThis" onclick="toggleMoreLikeThisDrawer()" class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-btn text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer shadow-lg group shrink-0">
                        <span class="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform"></span>
                        <span class="truncate">More Like This</span>
                        <i id="moreLikeThisChevron" data-lucide="chevron-up" class="w-3.5 h-3.5 transition-transform duration-300"></i>
                    </button>
                </div>

                <!-- Right: Direct | Embed Mode, Time, PiP & Fullscreen -->
                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div class="hidden sm:flex items-center p-0.5 rounded-xl glass-sub-panel text-[10px] font-bold text-zinc-400">
                        <button id="btnModeDirect" onclick="switchPlayerMode('direct')" class="px-2.5 py-1 rounded-lg bg-white text-black font-extrabold transition-all shadow">DIRECT</button>
                        <button id="btnModeEmbed" onclick="switchPlayerMode('embed')" class="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all">EMBED</button>
                    </div>

                    <div class="text-[10px] sm:text-[11px] font-mono text-zinc-300 tracking-wider shrink-0 whitespace-nowrap">
                        <span id="timeCurrent">0:00</span> <span class="text-zinc-600">/</span> <span id="timeDuration">0:00</span>
                    </div>

                    <button id="btnPip" onclick="togglePiP()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hidden xs:block shrink-0" title="Picture-in-Picture">
                        <i data-lucide="picture-in-picture-2" class="w-4 h-4"></i>
                    </button>

                    <button id="btnFullscreen" onclick="toggleFullscreen()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 shrink-0" title="Fullscreen">
                        <i id="fullscreenIcon" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
                </div>

                <!-- Mobile Scroll Right Button -->
                <button onclick="const el=document.getElementById('videoControlsActionBar'); if(el) el.scrollBy({left: 160, behavior: 'smooth'});" class="sm:hidden w-8 h-8 rounded-full bg-black/70 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 active:scale-90 shadow-xl ml-1 z-10 cursor-pointer" title="Scroll Controls Right">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>

        <!-- FLOATING SKIP INTRO & NEXT EPISODE PILLS -->
        <button id="btnSkipIntro" onclick="skipIntro()" class="apple-skip-btn bottom-24 right-6 hidden">
            <i data-lucide="fast-forward" class="w-4 h-4 text-red-400"></i>
            <span>Skip Intro</span>
        </button>

        <button id="btnNextEpisode" onclick="playNextEpisode()" class="apple-skip-btn bottom-24 right-6 hidden border-blue-500/40 text-blue-300 hover:text-white">
            <i data-lucide="skip-forward" class="w-4 h-4 text-blue-400"></i>
            <span>Next Episode</span>
        </button>

        <!-- DUAL-COLUMN QUALITY & SERVER DRAWER MODAL (TRANSPARENT GLASS) -->
        <div id="qualityServerModal" class="absolute top-16 right-3 sm:right-6 lg:right-10 z-40 hidden animate-fade-in w-[330px] sm:w-[480px] glass-panel rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white">
            <div class="flex items-center justify-between pb-3 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300">Stream Configuration</span>
                </div>
                <button onclick="toggleQualityServerModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Two Columns: QUALITY (Left) & SERVER (Right) -->
            <div class="grid grid-cols-2 gap-3 sm:gap-4 py-3">
                <div class="space-y-1">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1 px-1">QUALITY</div>
                    <div class="px-2.5 py-1.5 mb-2 rounded-xl glass-sub-panel text-[10px] font-bold text-amber-400 flex items-center justify-between">
                        <span>4K / UHD Master</span>
                        <span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-[9px] font-black">HLS</span>
                    </div>
                    <div id="qualityList" class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left glass-sub-panel bg-white/15 text-white">
                            <span>Auto (Adaptive)</span>
                            <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                        </button>
                    </div>
                </div>

                <div class="space-y-1 border-l border-white/10 pl-3">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1 px-1">SERVER CLUSTER</div>
                    <div id="serverList" class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1"></div>
                </div>
            </div>

            <!-- HUGE EMBEDDED STREAMS SECTION -->
            <div class="pt-3 pb-1 border-t border-white/10">
                <div class="flex items-center justify-between mb-2 px-1">
                    <div class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                        <i data-lucide="monitor-play" class="w-3.5 h-3.5"></i>
                        EMBEDDED STREAMS
                    </div>
                    <span class="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Alternative Players</span>
                </div>
                <div class="grid grid-cols-2 gap-2" id="embedProvidersGrid">
                    <!-- Populated by JS -->
                </div>
            </div>

            <!-- Bottom Row: Speed Selector -->
            <div class="pt-3 border-t border-white/10 flex items-center justify-between gap-1 flex-wrap">
                <div class="flex items-center gap-1">
                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">SPEED</span>
                    <button onclick="setPlaybackSpeed(0.5, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.5x</button>
                    <button onclick="setPlaybackSpeed(0.75, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.75x</button>
                    <button onclick="setPlaybackSpeed(1, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-black transition-all">1x</button>
                    <button onclick="setPlaybackSpeed(1.25, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.25x</button>
                    <button onclick="setPlaybackSpeed(1.5, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.5x</button>
                    <button onclick="setPlaybackSpeed(2, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">2x</button>
                </div>
            </div>
        </div>

        <!-- FULL AUDIO & SUBTITLES CONTROLLER MODAL (TRANSPARENT GLASS) -->
        <div id="subtitlesModal" class="absolute top-16 right-3 sm:right-6 lg:right-10 z-40 hidden animate-fade-in w-[330px] sm:w-[460px] glass-panel rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="languages" class="w-4 h-4 text-red-500"></i>
                    <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300">Audio & Subtitles Controller</span>
                </div>
                <button onclick="toggleSubtitlesModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Tabs: Audio Tracks vs Subtitles vs Appearance & Sync -->
            <div class="grid grid-cols-3 gap-1 rounded-xl glass-sub-panel p-1 mb-3">
                <button id="tabAudioBtn" onclick="switchSubTab('audio')" class="py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white">
                    Audio Dubs
                </button>
                <button id="tabSubtitlesBtn" onclick="switchSubTab('subtitles')" class="py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow">
                    Subtitles
                </button>
                <button id="tabVisualBtn" onclick="switchSubTab('visual')" class="py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white">
                    Styling
                </button>
            </div>

            <!-- Tab 1: AUDIO TRACKS (MULTI-LANGUAGE DUBS) -->
            <div id="tabContentAudio" class="hidden space-y-2">
                <div class="flex items-center justify-between">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">DETECTED AUDIO TRACKS</div>
                    <span id="audioTrackCountBadge" class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">1 Track</span>
                </div>
                <div id="audioTracksList" class="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                    <div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">Detecting audio streams...</div>
                </div>
            </div>

            <!-- Tab 2: SUBTITLE TRACKS -->
            <div id="tabContentSubtitles" class="space-y-2">
                <div class="flex items-center justify-between">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">SUBTITLE TRACKS</div>
                    <span id="subtitleTrackCountBadge" class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">Auto-detected</span>
                </div>
                <div id="subtitlesList" class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left glass-sub-panel bg-white/15 text-white">
                        <span>Off</span>
                        <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                    </button>
                </div>
                <div class="border-t border-white/10 pt-2">
                    <label class="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Upload Custom Subtitle (.vtt / .srt)</label>
                    <input type="file" id="customSubInput" accept=".vtt,.srt" class="block w-full text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer">
                </div>
            </div>

            <!-- Tab 3: Visual Controller & Audio Sync -->
            <div id="tabContentVisual" class="hidden space-y-3">
                <!-- Live Preview Card -->
                <div class="p-2.5 glass-sub-panel rounded-xl text-center">
                    <div id="subPreviewBox" class="py-1.5 px-3 rounded-lg inline-block transition-all" style="font-size: var(--sub-font-size); color: var(--sub-color); background-color: var(--sub-bg); text-shadow: var(--sub-shadow); font-weight: 700;">
                        The quick brown fox jumps over the lazy dog
                    </div>
                </div>

                <!-- Font Size -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Font Size</label>
                    <div class="grid grid-cols-4 gap-1">
                        <button onclick="setSubtitleFontSize('0.85rem')" class="py-1 px-1.5 glass-sub-panel hover:bg-white/15 rounded-lg text-[11px] font-bold text-zinc-300">Small</button>
                        <button onclick="setSubtitleFontSize('1.15rem')" class="py-1 px-1.5 bg-red-600 text-white rounded-lg text-[11px] font-bold">Normal</button>
                        <button onclick="setSubtitleFontSize('1.45rem')" class="py-1 px-1.5 glass-sub-panel hover:bg-white/15 rounded-lg text-[11px] font-bold text-zinc-300">Large</button>
                        <button onclick="setSubtitleFontSize('1.75rem')" class="py-1 px-1.5 glass-sub-panel hover:bg-white/15 rounded-lg text-[11px] font-bold text-zinc-300">Huge</button>
                    </div>
                </div>

                <!-- Colors -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Color</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleColor('#ffffff')" class="py-1.5 rounded-lg glass-sub-panel hover:bg-white/20 text-white text-[11px] font-bold">White</button>
                        <button onclick="setSubtitleColor('#facc15')" class="py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-[11px] font-bold border border-yellow-500/30">Yellow</button>
                        <button onclick="setSubtitleColor('#38bdf8')" class="py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[11px] font-bold border border-sky-500/30">Cyan</button>
                        <button onclick="setSubtitleColor('#4ade80')" class="py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">Green</button>
                    </div>
                </div>

                <!-- Audio / Subtitle Sync Offset -->
                <div class="p-2.5 glass-sub-panel rounded-xl">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[10px] font-bold text-zinc-300 uppercase">Timing Sync Offset</span>
                        <span id="subOffsetDisplay" class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">0.00s</span>
                    </div>
                    <div class="grid grid-cols-5 gap-1">
                        <button onclick="adjustSubtitleSync(-1.0)" class="py-1 glass-sub-panel hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">-1.0s</button>
                        <button onclick="adjustSubtitleSync(-0.25)" class="py-1 glass-sub-panel hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">-0.25s</button>
                        <button onclick="resetSubtitleSync()" class="py-1 bg-white/10 hover:bg-white/20 text-zinc-300 rounded-lg text-[10px] font-bold">Reset</button>
                        <button onclick="adjustSubtitleSync(0.25)" class="py-1 glass-sub-panel hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">+0.25s</button>
                        <button onclick="adjustSubtitleSync(1.0)" class="py-1 glass-sub-panel hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">+1.0s</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- TV SEASONS & EPISODES DRAWER (TRANSPARENT GLASS) -->
        <?php if ($type === 'tv'): ?>
        <div id="episodesDrawer" class="absolute bottom-0 left-0 right-0 z-40 max-h-[75vh] glass-panel border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-3">
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">Episodes</h3>
                    <select id="seasonSelect" onchange="changeSeason(this.value)" class="bg-zinc-900/80 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/15 outline-none cursor-pointer"></select>
                </div>
                <button onclick="toggleEpisodesDrawer(false)" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar pt-3 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading episodes...</div>
            </div>
        </div>
        <?php endif; ?>

        <!-- MORE LIKE THIS SLIDE-UP TRAY (TRANSPARENT GLASS & CINEMATIC REDESIGN) -->
        <div id="moreLikeThisTray" class="absolute bottom-0 left-0 right-0 z-40 max-h-[78vh] glass-panel border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-25px_60px_rgba(0,0,0,0.85)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"></span>
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">More Like This</h3>
                    <span class="text-xs text-zinc-400 font-semibold truncate max-w-xs sm:max-w-md">&bull; <?php echo htmlspecialchars($title); ?></span>
                </div>
                <button onclick="toggleMoreLikeThisDrawer(false)" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="moreLikeThisGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 overflow-y-auto custom-scrollbar pt-4 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading recommendations...</div>
            </div>
        </div>

        <!-- SLEEP TIMER MODAL (TRANSPARENT GLASS) -->
        <div id="sleepModal" class="hidden fixed inset-0 z-[10001] bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div class="glass-panel rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl text-center relative flex flex-col">
                <button onclick="toggleSleepModal(false)" class="absolute top-4 right-4 w-9 h-9 rounded-full glass-btn flex items-center justify-center cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20 text-red-500">
                    <i data-lucide="clock" class="w-6 h-6"></i>
                </div>
                <h3 class="text-base font-bold text-white mb-1">Set Sleep Timer</h3>
                <p class="text-xs text-zinc-400 mb-4">Playback will pause automatically when timer expires.</p>
                <div class="grid grid-cols-2 gap-2.5 mb-4">
                    <button onclick="setSleepTimer(15)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">15 Minutes</button>
                    <button onclick="setSleepTimer(30)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">30 Minutes</button>
                    <button onclick="setSleepTimer(45)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">45 Minutes</button>
                    <button onclick="setSleepTimer(60)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">60 Minutes</button>
                </div>
                <div class="flex gap-2">
                    <button onclick="setSleepTimer(0)" class="flex-1 py-2.5 glass-sub-panel hover:bg-white/15 text-zinc-400 font-bold text-xs rounded-xl transition-all">Turn Off</button>
                    <button onclick="toggleSleepModal(false)" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all">Cancel</button>
                </div>
            </div>
        </div>

    </div>

    <!-- Script Engine -->
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const MEDIA_ID = urlParams.get('id') || urlParams.get('tmdbId') || '<?php echo addslashes($id); ?>';
        const MEDIA_TYPE = urlParams.get('type') || urlParams.get('media_type') || '<?php echo addslashes($type); ?>' || 'movie';
        const MEDIA_TITLE = urlParams.get('title') || urlParams.get('name') || '<?php echo addslashes($title); ?>';
        let MEDIA_SEASON = parseInt(urlParams.get('s') || urlParams.get('season') || '<?php echo $s; ?>', 10) || 1;
        let MEDIA_EPISODE = parseInt(urlParams.get('e') || urlParams.get('episode') || '<?php echo $e; ?>', 10) || 1;
        let CURRENT_SERVER = urlParams.get('srv') || '<?php echo addslashes($srv); ?>' || 's40';
        let DIRECT_STREAM_URL = urlParams.get('url') || '<?php echo addslashes($directUrl); ?>';
        const SOURCE_ORIGIN = urlParams.get('source') || '<?php echo addslashes($source); ?>' || 'consumet.html';

        const mainVideo = document.getElementById('mainVideo');
        const embedFrame = document.getElementById('embedFrame');
        const streamLoading = document.getElementById('streamLoading');
        const streamLoadingMsg = document.getElementById('streamLoadingMsg');
        const mediaHudOverlay = document.getElementById('mediaHudOverlay');
        const topControlsBar = document.getElementById('topControlsBar');
        const bottomControlsBar = document.getElementById('bottomControlsBar');
        const timelineContainer = document.getElementById('timelineContainer');
        const timelineBuffer = document.getElementById('timelineBuffer');
        const timelineProgress = document.getElementById('timelineProgress');
        const timelineThumb = document.getElementById('timelineThumb');
        const timelineTooltip = document.getElementById('timelineTooltip');
        const timeCurrent = document.getElementById('timeCurrent');
        const timeDuration = document.getElementById('timeDuration');
        const btnPlayPause = document.getElementById('btnPlayPause');
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        const qualityServerModal = document.getElementById('qualityServerModal');
        const subtitlesModal = document.getElementById('subtitlesModal');
        const moreLikeThisTray = document.getElementById('moreLikeThisTray');
        const moreLikeThisChevron = document.getElementById('moreLikeThisChevron');
        const episodesDrawer = document.getElementById('episodesDrawer');
        const btnSkipIntro = document.getElementById('btnSkipIntro');
        const btnNextEpisode = document.getElementById('btnNextEpisode');
        const zoomIndicator = document.getElementById('zoom-indicator');
        const sleepIndicator = document.getElementById('sleep-indicator');
        const sleepModal = document.getElementById('sleepModal');

        let hlsInstance = null;
        let controlsTimeout = null;
        let isScrubbing = false;
        let availableServers = [];
        let playerMode = 'direct';
        let currentRotation = 0;
        let currentAspectMode = 0; // 0: contain, 1: cover, 2: fill, 3: zoom-120
        let sleepTimerInterval = null;
        let sleepEndTime = null;
        let subtitleSyncOffset = 0;
        let currentActiveAudioTrack = 0;
        let currentActiveSubtitleTrack = -1;
        let externalSubtitlesLoaded = [];

        const DEFAULT_SERVERS = [
            { id: 'sm_hub', name: 'SM Movie Hub (Direct VOD/MKV/Dual Audio)', cc: 'BD' },
            { id: 'cinepro', name: 'CinePro Core (OMSS Multi-Provider 4K)', cc: 'US' },
            { id: 's40', name: 'Aphelion (DarkMatter / Fast 1080p Direct)', cc: 'GL' },
            { id: 's62', name: 'Bastion (Multi-Audio HLS / KNOCW / NXOCW)', cc: 'IN' },
            { id: 'm4u', name: 'Movie 4U (Movies4u / Acek CDN)', cc: 'IN' },
            { id: 's61', name: 'Corvus (Mirror Cluster)', cc: 'US' },
            { id: 's3',  name: 'Edmunds (Filmu Proxy)', cc: 'US' },
            { id: 's70', name: 'Polaris (Multi-Language Dubs / HLS v7)', cc: 'US' },
            { id: 's30', name: 'Nova (VidRock CDN)', cc: 'US' },
            { id: 's31', name: 'Orion (Filmu Workers)', cc: 'US' },
            { id: 's4k', name: 'PeakStream 4K (SpeedRace 4K UHD Master)', cc: 'US' },
            { id: 's60', name: 'Vertex (Mirror Cluster)', cc: 'US' }
        ];

        window.addEventListener('DOMContentLoaded', async () => {
            if (window.lucide) lucide.createIcons();
            loadMediaHudMetadata();
            await loadServerList();
            loadMoreLikeThis();
            if (MEDIA_TYPE === 'tv') {
                loadTvSeasonsAndEpisodes();
            }

            if (DIRECT_STREAM_URL && DIRECT_STREAM_URL.startsWith('http')) {
                showLoading(false);
                initHlsPlayer(DIRECT_STREAM_URL);
                window.bingrActiveStreamUrl = DIRECT_STREAM_URL;
                
                // Background fetch to populate multi-audio dubs (sources) if we skipped the main fetch
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null') {
                    fetch('/api/bingr/stream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            srv: CURRENT_SERVER,
                            t: MEDIA_TYPE,
                            id: MEDIA_ID,
                            query: MEDIA_TITLE,
                            s: MEDIA_SEASON,
                            e: MEDIA_EPISODE
                        })
                    })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.sources && data.sources.length > 0) {
                            window.bingrSources = data.sources;
                            if (data.subtitles && data.subtitles.length > 0) {
                                externalSubtitlesLoaded = data.subtitles;
                            }
                            // Refresh Audio UI in case the modal is already open
                            if (typeof detectAndPopulateAudioTracks === 'function') {
                                detectAndPopulateAudioTracks();
                            }
                            if (typeof populateSubtitlesList === 'function') {
                                populateSubtitlesList();
                            }
                        }
                    })
                    .catch(e => console.warn('Background fetch for audio sources failed', e));
                }
            } else {
                fetchAndPlayStream(CURRENT_SERVER);
            }

            fetchExternalSubtitles();
            populateEmbedProviders();
            setupControlsAutoHide();
            setupTimeline();
            setupSubtitlesUploader();
        });

        async function fetchAndPlayStream(serverId) {
            CURRENT_SERVER = serverId;
            showLoading(true, 'Connecting to Server: ' + getServerName(serverId) + '...');
            updateServerListUI();

            try {
                const payload = {
                    type: MEDIA_TYPE,
                    id: MEDIA_ID,
                    title: MEDIA_TITLE,
                    season: MEDIA_TYPE === 'tv' ? MEDIA_SEASON : undefined,
                    episode: MEDIA_TYPE === 'tv' ? MEDIA_EPISODE : undefined,
                    srv: serverId
                };

                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                const streamUrl = data.primaryM3u8 || (data.sources && data.sources.length > 0 ? data.sources[0].url : null);
                if (streamUrl) {
                    window.bingrSources = data.sources || [];
                    window.bingrActiveStreamUrl = streamUrl;
                    showLoading(false);
                    initHlsPlayer(streamUrl);
                    if (data.subtitles && data.subtitles.length > 0) {
                        externalSubtitlesLoaded = data.subtitles;
                        populateSubtitlesList();
                    }
                } else {
                    console.warn('Server ' + serverId + ' returned no stream, auto-cascading...');
                    cascadeFallback(serverId);
                }
            } catch (err) {
                console.error('Failed to fetch stream:', err);
                cascadeFallback(serverId);
            }
        }

        const failedServers = new Set();
        let fallbackDoubleCheckCount = 0;

        function cascadeFallback(failedServerId) {
            failedServers.add(failedServerId);
            const fallbackOrder = ['s40', 's62', 'm4u', 's61', 's3', 's70', 's30', 's31', 's4k', 's60'];
            const nextServer = fallbackOrder.find(srv => !failedServers.has(srv));
            if (nextServer) {
                fetchAndPlayStream(nextServer);
            } else {
                if (fallbackDoubleCheckCount === 0) {
                    fallbackDoubleCheckCount = 1;
                    console.log("[Fallback] Direct stream not found on initial pass. Initiating double-check verification on primary clusters...");
                    failedServers.clear();
                    showToast('Verifying alternative clusters (double-check)...');
                    fetchAndPlayStream('s40');
                    return;
                }

                showLoading(false);
                failedServers.clear();
                fallbackDoubleCheckCount = 0;
                console.log("[Fallback] Direct stream unavailable after double check. Switching automatically to Embed player mode.");
                showToast('Direct stream unavailable after double check. Auto-switching to Embed player...');
                setTimeout(() => {
                    switchPlayerMode('embed');
                }, 500);
            }
        }

        function preparePlayableHlsUrl(rawUrl) {
            if (!rawUrl) return rawUrl;
            let url = String(rawUrl).trim();
            if (url.startsWith('/stream_proxy.php') || url.startsWith('/api/proxy/')) {
                return url;
            }
            if (url.startsWith(window.location.origin)) {
                return url;
            }
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return '/stream_proxy.php?url=' + encodeURIComponent(url);
            }
            return url;
        }

        function initHlsPlayer(streamUrl) {
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }

            const playableUrl = preparePlayableHlsUrl(streamUrl);

            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    capLevelToPlayerSize: false,
                    maxBufferLength: 10,
                    maxMaxBufferLength: 20,
                    backBufferLength: 10,
                    enableWorker: true,
                    lowLatencyMode: true
                });

                hlsInstance.loadSource(playableUrl);
                hlsInstance.attachMedia(mainVideo);

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    // Default to best quality level (4K / 1080p FHD)
                    if (data.levels && data.levels.length > 0) {
                        const topLevel = data.levels.length - 1;
                        hlsInstance.startLevel = topLevel;
                        hlsInstance.nextLevel = topLevel;
                    }
                    populateQualityLevels(data.levels);
                    detectAndPopulateAudioTracks();
                    detectAndPopulateSubtitleTracks();
                    
                    if (previousVideoTime > 0) {
                        mainVideo.currentTime = previousVideoTime;
                        previousVideoTime = 0;
                    }
                    
                    mainVideo.play().catch(() => {
                        mainVideo.muted = true;
                        mainVideo.play().catch(() => {});
                    });
                });

                hlsInstance.on(Hls.Events.MANIFEST_LOADED, () => {
                    detectAndPopulateAudioTracks();
                });

                // Audio Tracks Event Handlers
                hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
                    currentActiveAudioTrack = data.id;
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.AUDIO_TRACK_LOADED, (event, data) => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.LEVEL_LOADED, () => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.FRAG_PARSED, () => {
                    if (!window._audioCheckedAfterFrag) {
                        window._audioCheckedAfterFrag = true;
                        detectAndPopulateAudioTracks();
                    }
                });

                hlsInstance.on(Hls.Events.BUFFER_CREATED, () => {
                    detectAndPopulateAudioTracks();
                });

                // Subtitle Tracks Event Handlers
                hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
                    detectAndPopulateSubtitleTracks();
                });

                hlsInstance.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
                    currentActiveSubtitleTrack = data.id;
                    populateSubtitlesList();
                });

                hlsInstance.on(Hls.Events.LEVEL_SWITCHED, () => {
                    updateQualityButtonLabel();
                });

                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hlsInstance.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hlsInstance.recoverMediaError();
                                break;
                            default:
                                hlsInstance.destroy();
                                cascadeFallback(CURRENT_SERVER);
                                break;
                        }
                    }
                });
            } else if (mainVideo.canPlayType('application/vnd.apple.mpegurl')) {
                mainVideo.src = playableUrl;
                mainVideo.play().catch(() => {
                    mainVideo.muted = true;
                    mainVideo.play().catch(() => {});
                });
            }
        }

        /* ---------------- AUDIO TRACKS DETECTION & SWITCHING (GENUINE STREAM TRACKS ONLY) ---------------- */
        function getLanguageDisplayName(langCode) {
            if (!langCode) return '';
            const code = String(langCode).toLowerCase().trim();
            const map = {
                'en': 'English', 'eng': 'English',
                'hi': 'Hindi', 'hin': 'Hindi',
                'es': 'Spanish', 'spa': 'Spanish',
                'fr': 'French', 'fra': 'French', 'fre': 'French',
                'de': 'German', 'ger': 'German', 'deu': 'German',
                'ja': 'Japanese', 'jpn': 'Japanese',
                'ko': 'Korean', 'kor': 'Korean',
                'ta': 'Tamil', 'tam': 'Tamil',
                'te': 'Telugu', 'tel': 'Telugu',
                'zh': 'Chinese', 'zho': 'Chinese', 'chi': 'Chinese',
                'it': 'Italian', 'ita': 'Italian',
                'ru': 'Russian', 'rus': 'Russian',
                'ar': 'Arabic', 'ara': 'Arabic',
                'pt': 'Portuguese', 'por': 'Portuguese',
                'tr': 'Turkish', 'tur': 'Turkish',
                'bn': 'Bengali', 'ben': 'Bengali',
                'ml': 'Malayalam', 'mal': 'Malayalam',
                'kn': 'Kannada', 'kan': 'Kannada',
                'mr': 'Marathi', 'mar': 'Marathi',
                'pa': 'Punjabi', 'pan': 'Punjabi',
                'gu': 'Gujarati', 'guj': 'Gujarati',
                'ur': 'Urdu', 'urd': 'Urdu',
                'id': 'Indonesian', 'ind': 'Indonesian',
                'vi': 'Vietnamese', 'vie': 'Vietnamese',
                'th': 'Thai', 'tha': 'Thai'
            };
            return map[code] || (langCode.length <= 4 ? langCode.toUpperCase() : langCode);
        }

        function getAudioTrackLabel(trackIdx) {
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks[trackIdx]) {
                const t = hlsInstance.audioTracks[trackIdx];
                return getLanguageDisplayName(t.lang) || t.name || `Audio Track ${trackIdx + 1}`;
            }
            return `Audio Track ${trackIdx + 1}`;
        }

        function detectAndPopulateAudioTracks() {
            const list = document.getElementById('audioTracksList');
            const countBadge = document.getElementById('audioTrackCountBadge');
            const topBarAudioLabel = document.getElementById('topBarAudioLabel');
            if (!list) return;

            let hlsAudioTracks = [];
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks.length > 0) {
                hlsAudioTracks = hlsInstance.audioTracks;
            }

            let tracks = [];

            // Read genuine embedded HLS audio tracks from stream manifest
            if (hlsAudioTracks.length > 0) {
                hlsAudioTracks.forEach((t, idx) => {
                    const langCode = t.lang || t.language || '';
                    const friendlyLang = getLanguageDisplayName(langCode) || t.name || `Audio Track ${idx + 1}`;
                    const channels = t.channels ? `${t.channels} Ch` : (t.name && t.name.toLowerCase().includes('5.1') ? '5.1 Surround' : 'Stereo');
                    const isSelected = (hlsInstance && hlsInstance.audioTrack >= 0)
                        ? (hlsInstance.audioTrack === idx)
                        : (currentActiveAudioTrack === idx || (currentActiveAudioTrack === -1 && (t.default || idx === 0)));
                    
                    tracks.push({
                        id: idx,
                        name: friendlyLang,
                        rawName: t.name || '',
                        details: channels,
                        isDefault: !!t.default,
                        isSelected: isSelected
                    });
                });
            } else if (mainVideo && mainVideo.audioTracks && mainVideo.audioTracks.length > 0) {
                // Native HTML5 Video AudioTrackList API
                for (let i = 0; i < mainVideo.audioTracks.length; i++) {
                    const natTrack = mainVideo.audioTracks[i];
                    const friendlyLang = getLanguageDisplayName(natTrack.language) || natTrack.label || `Audio Track ${i + 1}`;
                    tracks.push({
                        id: i,
                        name: friendlyLang,
                        rawName: natTrack.label || '',
                        details: 'Native Stream Track',
                        isDefault: i === 0,
                        isSelected: natTrack.enabled || (currentActiveAudioTrack === i)
                    });
                }
            } else {
                // Single Master Audio Track present in the stream
                tracks.push({
                    id: 0,
                    name: 'Primary Audio (Original Stream)',
                    rawName: 'Master Stream Audio',
                    details: 'Direct Stream Audio Mix',
                    isDefault: true,
                    isSelected: true
                });
            }

            if (countBadge) {
                countBadge.textContent = tracks.length === 1 ? '1 Track' : `${tracks.length} Tracks`;
            }

            let activeName = 'Audio';

            let html = `
                <div class="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            `;

            tracks.forEach(track => {
                if (track.isSelected) {
                    activeName = track.name;
                }

                html += `
                    <button type="button" onclick="setAudioTrack(${track.id})" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${track.isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30 shadow-md' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2.5 truncate">
                            <i data-lucide="volume-2" class="w-4 h-4 ${track.isSelected ? 'text-emerald-400' : 'text-zinc-400'} shrink-0"></i>
                            <div class="truncate">
                                <div class="text-white font-bold truncate flex items-center gap-1.5">
                                    <span>${track.name}</span>
                                    ${track.isDefault ? '<span class="text-[8px] px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 font-bold uppercase">Default</span>' : ''}
                                </div>
                                <div class="text-[10px] text-zinc-400 font-normal truncate">${track.details}</div>
                            </div>
                        </div>
                        ${track.isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-400 shrink-0 ml-2"></i>' : ''}
                    </button>
                `;
            });

            html += `</div>`;

            // Dubbed Regional Feeds (Multi-Source Parsing)
            const languageSources = (window.bingrSources || []).filter(s => s.language || (s.label && s.label.includes('—')));
            if (languageSources.length > 0) {
                html += `
                    <div class="border-t border-white/10 pt-2.5 mt-2 mb-1.5">
                        <div class="flex items-center justify-between mb-1.5 px-0.5">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Dubbed Regional Feeds (Polaris)</span>
                            <span class="text-[9px] text-zinc-500 font-medium">${languageSources.length} Feeds</span>
                        </div>
                        <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                `;
                
                languageSources.forEach((srcObj, idx) => {
                    const isActive = (window.bingrActiveStreamUrl === srcObj.url);
                    const labelText = srcObj.language || srcObj.label || ('Language ' + (idx + 1));
                    html += `
                        <button type="button" onclick="switchStreamByIndex(${idx})" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${isActive ? 'bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-red-500/25 border border-white/20' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="flex items-center gap-2.5 truncate">
                                <i data-lucide="globe" class="w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'} shrink-0"></i>
                                <div class="truncate">
                                    <div class="text-white font-bold truncate flex items-center gap-1.5">
                                        <span>${labelText}</span>
                                        <span class="text-[8px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">DUB</span>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-normal truncate">${srcObj.quality || '1080p'}</div>
                                </div>
                            </div>
                            ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-white shrink-0 ml-2"></i>' : ''}
                        </button>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }

            // Multi-Language Dub Server Clusters Fast Switcher
            html += `
                <div class="border-t border-white/10 pt-2.5 mt-2">
                    <div class="flex items-center justify-between mb-1.5 px-0.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Language Dub Clusters</span>
                        <span class="text-[9px] text-zinc-500 font-medium">Fast Server Switch</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        <button type="button" onclick="switchServerCluster('cinepro')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'cinepro' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">CinePro Core</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">OMSS Multi-Server 4K</div>
                            </div>
                            ${CURRENT_SERVER === 'cinepro' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s40')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's40' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Aphelion (s40)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Fast 1080p Direct</div>
                            </div>
                            ${CURRENT_SERVER === 's40' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s62')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's62' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Bastion (s62)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Dual Audio & Dubs</div>
                            </div>
                            ${CURRENT_SERVER === 's62' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s70')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's70' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Polaris (s70)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Language Dubs</div>
                            </div>
                            ${CURRENT_SERVER === 's70' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('m4u')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'm4u' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Movie 4U (m4u)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Acek Unpacked Master</div>
                            </div>
                            ${CURRENT_SERVER === 'm4u' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s61')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's61' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Corvus (s61)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Source Hub</div>
                            </div>
                            ${CURRENT_SERVER === 's61' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s3')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's3' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Edmunds (s3)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Filmu Original Audio</div>
                            </div>
                            ${CURRENT_SERVER === 's3' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                    </div>
                </div>
            `;

            list.innerHTML = html;
            if (topBarAudioLabel) {
                topBarAudioLabel.textContent = activeName.length > 10 ? activeName.slice(0, 8) + '..' : activeName;
            }
            if (window.lucide) lucide.createIcons();
        }

        window.switchStreamByIndex = function(idx) {
            const sources = (window.bingrSources || []).filter(s => s.language || (s.label && s.label.includes('—')));
            const target = sources[idx];
            if (target && target.url) {
                switchStreamUrl(target.url);
            }
        };

        function setAudioTrack(trackIdx) {
            currentActiveAudioTrack = trackIdx;
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks.length > trackIdx) {
                try {
                    hlsInstance.audioTrack = trackIdx;
                    // Instant audio buffer flush & resync
                    const cur = mainVideo.currentTime;
                    if (mainVideo && !mainVideo.paused && cur > 0) {
                        setTimeout(() => {
                            try {
                                if (mainVideo.fastSeek) mainVideo.fastSeek(cur);
                                else mainVideo.currentTime = cur;
                            } catch(e) {}
                        }, 50);
                    }
                } catch (e) {
                    console.warn('HLS audio switch notice:', e);
                }
            }
            if (mainVideo && mainVideo.audioTracks && mainVideo.audioTracks.length > 0) {
                for (let i = 0; i < mainVideo.audioTracks.length; i++) {
                    mainVideo.audioTracks[i].enabled = (i === trackIdx);
                }
            }
            detectAndPopulateAudioTracks();
            const trackLabel = getAudioTrackLabel(trackIdx);
            showToast(`Audio Track: ${trackLabel}`);
        }

        let previousVideoTime = 0;

        function switchServerCluster(serverId) {
            if (CURRENT_SERVER === serverId) return;
            previousVideoTime = mainVideo.currentTime || 0;
            showToast(`Switching audio server to ${getServerName(serverId)}...`);
            fetchAndPlayStream(serverId);
        }

        function switchStreamUrl(url) {
            if (window.bingrActiveStreamUrl === url) return;
            previousVideoTime = mainVideo.currentTime || 0;
            window.bingrActiveStreamUrl = url;
            showToast(`Switching audio track stream...`);
            initHlsPlayer(url);
            toggleSubtitlesModal(false);
        }

        function openAudioModalTab() {
            toggleSubtitlesModal(true);
            switchSubTab('audio');
        }

        function openSubtitlesModalTab() {
            toggleSubtitlesModal(true);
            switchSubTab('subtitles');
        }

        /* ---------------- SUBTITLE TRACKS DETECTION & FETCHING ---------------- */
        function detectAndPopulateSubtitleTracks() {
            populateSubtitlesList();
        }

        async function fetchExternalSubtitles() {
            try {
                const sParam = MEDIA_TYPE === 'tv' ? `&season=${MEDIA_SEASON}&episode=${MEDIA_EPISODE}` : '';
                const res = await fetch(`/api/subtitles/fetch?title=${encodeURIComponent(MEDIA_TITLE)}&id=${MEDIA_ID}${sParam}`);
                const data = await res.json();
                if (data && data.subtitles && Array.isArray(data.subtitles)) {
                    data.subtitles.forEach(sub => {
                        if (!externalSubtitlesLoaded.some(e => e.url === sub.url || e.lang === sub.language)) {
                            externalSubtitlesLoaded.push({
                                lang: sub.language || sub.display,
                                url: sub.url
                            });
                        }
                    });
                    populateSubtitlesList();
                }
            } catch (err) {
                console.warn('External subtitles fetch notice:', err);
            }
        }

        function populateSubtitlesList() {
            const list = document.getElementById('subtitlesList');
            const countBadge = document.getElementById('subtitleTrackCountBadge');
            if (!list) return;

            let hlsSubs = [];
            if (hlsInstance && hlsInstance.subtitleTracks) {
                hlsSubs = hlsInstance.subtitleTracks;
            }

            const totalSubsCount = hlsSubs.length + externalSubtitlesLoaded.length;
            if (countBadge) countBadge.textContent = `${totalSubsCount} Available`;

            let html = `
                <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${currentActiveSubtitleTrack === -1 ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                    <span>Off</span>
                    ${currentActiveSubtitleTrack === -1 ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
            `;

            // Embedded HLS Subtitles
            hlsSubs.forEach((sub, idx) => {
                const isSelected = currentActiveSubtitleTrack === idx;
                const lang = sub.name || sub.lang || `Track ${idx + 1}`;
                html += `
                    <button onclick="setHlsSubtitleTrack(${idx})" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2 truncate">
                            <span class="truncate">${lang}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-300 font-bold uppercase">HLS</span>
                        </div>
                        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                    </button>
                `;
            });

            // External Auto-fetched WebVTT Subtitles
            externalSubtitlesLoaded.forEach((sub, idx) => {
                const virtualId = 1000 + idx;
                const isSelected = currentActiveSubtitleTrack === virtualId;
                const lang = sub.lang || sub.label || `CC ${idx + 1}`;
                html += `
                    <button onclick="loadExternalSubtitle('${sub.url}', '${lang.replace(/'/g, "\\'")}', ${virtualId})" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2 truncate">
                            <span class="truncate">${lang}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300 font-bold uppercase">WebVTT</span>
                        </div>
                        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                    </button>
                `;
            });

            list.innerHTML = html;
            if (window.lucide) lucide.createIcons();
        }

        function setHlsSubtitleTrack(trackIdx) {
            currentActiveSubtitleTrack = trackIdx;
            if (hlsInstance) {
                hlsInstance.subtitleTrack = trackIdx;
            }
            populateSubtitlesList();
            showToast('HLS Subtitle Activated');
        }

        function setSubtitleTrack(trackIdx) {
            currentActiveSubtitleTrack = -1;
            if (hlsInstance) {
                hlsInstance.subtitleTrack = -1;
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    mainVideo.textTracks[i].mode = 'disabled';
                }
            }
            populateSubtitlesList();
            showToast('Subtitles Disabled');
        }

        function loadExternalSubtitle(url, label, virtualId) {
            currentActiveSubtitleTrack = virtualId !== undefined ? virtualId : 9999;
            if (hlsInstance) hlsInstance.subtitleTrack = -1;

            const existing = mainVideo.querySelectorAll('track');
            existing.forEach(t => t.remove());

            let safeUrl = url;
            if (url.startsWith('http') && !url.includes('/api/subtitles/vtt')) {
                safeUrl = `/api/subtitles/vtt?url=${encodeURIComponent(url)}`;
            }

            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = label || 'Subtitle';
            track.srclang = 'en';
            track.src = safeUrl;
            track.default = true;
            mainVideo.appendChild(track);

            setTimeout(() => {
                if (mainVideo.textTracks) {
                    const tracks = Array.from(mainVideo.textTracks);
                    tracks.forEach(t => t.mode = 'disabled');
                    const target = tracks.find(t => t.label === (label || 'Subtitle'));
                    if (target) {
                        target.mode = 'showing';
                    } else if (tracks.length > 0) {
                        tracks[tracks.length - 1].mode = 'showing';
                    }
                }
            }, 250);

            populateSubtitlesList();
            showToast(`Loaded Subtitles: ${label}`);
        }

        function setupSubtitlesUploader() {
            const input = document.getElementById('customSubInput');
            if (!input) return;
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                loadExternalSubtitle(url, file.name, 8888);
            });
        }

        /* ---------------- TABS SWITCHER FOR SUBTITLES & AUDIO ---------------- */
        function switchSubTab(tab) {
            const btnAudio = document.getElementById('tabAudioBtn');
            const btnSubs = document.getElementById('tabSubtitlesBtn');
            const btnVisual = document.getElementById('tabVisualBtn');
            const contentAudio = document.getElementById('tabContentAudio');
            const contentSubs = document.getElementById('tabContentSubtitles');
            const contentVisual = document.getElementById('tabContentVisual');

            [btnAudio, btnSubs, btnVisual].forEach(b => {
                b.className = 'py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white';
            });
            [contentAudio, contentSubs, contentVisual].forEach(c => c.classList.add('hidden'));

            if (tab === 'audio') {
                btnAudio.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentAudio.classList.remove('hidden');
                detectAndPopulateAudioTracks();
            } else if (tab === 'subtitles') {
                btnSubs.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentSubs.classList.remove('hidden');
                populateSubtitlesList();
            } else if (tab === 'visual') {
                btnVisual.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentVisual.classList.remove('hidden');
            }
        }

        function populateQualityLevels(levels) {
            const list = document.getElementById('qualityList');
            if (!list || !levels || levels.length === 0) return;

            list.innerHTML = `
                <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left hover:bg-white/10 transition-colors glass-sub-panel bg-white/15 text-white">
                    <span>Auto (Adaptive)</span>
                    <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                </button>
            `;

            levels.forEach((lvl, idx) => {
                const height = lvl.height || 'HD';
                const btn = document.createElement('button');
                btn.id = 'quality-btn-' + idx;
                btn.className = 'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left text-zinc-300 hover:bg-white/10 transition-colors glass-sub-panel';
                btn.onclick = () => setQualityLevel(idx);
                btn.innerHTML = '<span>' + height + (typeof height === 'number' ? 'p' : '') + '</span>';
                list.appendChild(btn);
            });

            if (window.lucide) lucide.createIcons();
        }

        function setQualityLevel(levelIndex) {
            if (!hlsInstance) return;
            hlsInstance.currentLevel = levelIndex;
            
            const list = document.getElementById('qualityList');
            const buttons = list.querySelectorAll('button');
            buttons.forEach(b => {
                b.classList.remove('bg-white/15', 'text-white');
                b.classList.add('text-zinc-300');
                const chk = b.querySelector('[data-lucide="check"]');
                if (chk) chk.remove();
            });

            const targetBtn = levelIndex === -1 ? document.getElementById('quality-btn-auto') : document.getElementById('quality-btn-' + levelIndex);
            if (targetBtn) {
                targetBtn.classList.add('bg-white/15', 'text-white');
                targetBtn.classList.remove('text-zinc-300');
                const checkIcon = document.createElement('i');
                checkIcon.setAttribute('data-lucide', 'check');
                checkIcon.className = 'w-3.5 h-3.5 text-white';
                targetBtn.appendChild(checkIcon);
            }

            updateQualityButtonLabel();
            if (window.lucide) lucide.createIcons();
        }

        function updateQualityButtonLabel() {
            const btnLabel = document.getElementById('qualityButtonLabel');
            if (!btnLabel || !hlsInstance) return;

            if (hlsInstance.autoLevelEnabled) {
                const cur = hlsInstance.levels[hlsInstance.currentLevel];
                const res = cur ? (cur.height + 'p') : '1080p';
                btnLabel.textContent = 'Auto • ' + res;
            } else {
                const cur = hlsInstance.levels[hlsInstance.currentLevel];
                const res = cur ? (cur.height + 'p') : '1080p';
                btnLabel.textContent = res;
            }
        }

        async function loadServerList() {
            try {
                const res = await fetch('/api/bingr/servers');
                const data = await res.json();
                if (data.status === 'success' && data.servers) {
                    availableServers = data.servers;
                } else {
                    availableServers = DEFAULT_SERVERS;
                }
            } catch (e) {
                availableServers = DEFAULT_SERVERS;
            }
            renderServerList();
        }

        function renderServerList() {
            const list = document.getElementById('serverList');
            if (!list) return;

            list.innerHTML = availableServers.map(srv => {
                const isSelected = srv.id === CURRENT_SERVER;
                const flag = srv.cc === 'IN' ? '🇮🇳' : (srv.cc === 'US' ? '🇺🇸' : (srv.cc === 'IT' ? '🇮🇹' : (srv.cc === 'IS' ? '🇮🇸' : '⚡')));
                return `
                    <button onclick="switchServer('${srv.id}')" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/20' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <span class="truncate">${flag} ${srv.name.split('(')[0].trim()}</span>
                        ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white shrink-0 ml-1"></i>' : ''}
                    </button>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        }

        function updateServerListUI() {
            renderServerList();
        }

        function switchServer(serverId) {
            if (serverId === CURRENT_SERVER) return;
            const curTime = mainVideo.currentTime || 0;
            toggleQualityServerModal(false);
            fetchAndPlayStream(serverId).then(() => {
                if (mainVideo && curTime > 0) {
                    mainVideo.currentTime = curTime;
                }
            });
        }

        function getServerName(id) {
            const s = availableServers.find(x => x.id === id);
            return s ? s.name : id;
        }

        function triggerAutoReconnect() {
            showToast('Reconnecting Stream...');
            const curTime = mainVideo.currentTime || 0;
            fetchAndPlayStream(CURRENT_SERVER).then(() => {
                if (mainVideo && curTime > 0) {
                    mainVideo.currentTime = curTime;
                }
            });
        }

        function toggleAspectRatio() {
            currentAspectMode = (currentAspectMode + 1) % 4;
            mainVideo.classList.remove('fit-cover', 'fit-fill', 'zoom-120');

            let modeName = 'Fit to Screen';
            if (currentAspectMode === 1) {
                mainVideo.classList.add('fit-cover');
                modeName = 'Cover (Fill Viewport)';
            } else if (currentAspectMode === 2) {
                mainVideo.classList.add('fit-fill');
                modeName = 'Stretch to Fill (16:9)';
            } else if (currentAspectMode === 3) {
                mainVideo.classList.add('zoom-120');
                modeName = 'Cinema Zoom (120%)';
            }
            showToast(modeName);
        }

        function toggleRotation() {
            currentRotation = (currentRotation + 90) % 360;
            const container = document.getElementById('playerContainer');
            if (currentRotation === 90 || currentRotation === 270) {
                container.style.width = window.innerHeight + 'px';
                container.style.height = window.innerWidth + 'px';
                container.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
                container.style.position = 'fixed';
                container.style.top = '50%';
                container.style.left = '50%';
            } else {
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.position = 'relative';
                container.style.top = 'auto';
                container.style.left = 'auto';
                container.style.transform = `rotate(${currentRotation}deg)`;
            }
            showToast('Rotated ' + currentRotation + '°');
        }

        function togglePiP() {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            } else if (mainVideo && document.pictureInPictureEnabled) {
                mainVideo.requestPictureInPicture().catch(() => {});
            }
        }

        function togglePartyMode() {
            if (typeof window.togglePartyModal === 'function') {
                window.togglePartyModal(true);
            } else {
                showToast('Party Mode Ready');
            }
        }

        function showToast(text) {
            zoomIndicator.textContent = text;
            zoomIndicator.style.opacity = '1';
            zoomIndicator.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
                zoomIndicator.style.opacity = '0';
                zoomIndicator.style.transform = 'translateX(-50%) translateY(-10px)';
            }, 2500);
        }

        /* ---------------- ANIMATED PLAY / PAUSE LOGIC ---------------- */
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            if (reason && (
                reason.name === 'AbortError' || 
                (typeof reason.message === 'string' && (
                    reason.message.includes('interrupted by a call to pause') ||
                    reason.message.includes('interrupted by a new load request')
                ))
            )) {
                event.preventDefault();
            }
        });

        let pendingPlayPromise = null;
        function safePlayVideo() {
            if (!mainVideo) return Promise.resolve();
            try {
                const promise = mainVideo.play();
                if (promise !== undefined && typeof promise.then === 'function') {
                    pendingPlayPromise = promise;
                    return promise.then(() => { pendingPlayPromise = null; }).catch(err => {
                        pendingPlayPromise = null;
                        if (err && err.name === 'NotAllowedError') {
                            try {
                                mainVideo.muted = true;
                                const retry = mainVideo.play();
                                if (retry !== undefined && typeof retry.then === 'function') retry.catch(() => {});
                            } catch (_) {}
                        }
                    });
                }
            } catch (_) {}
            return Promise.resolve();
        }

        function safePauseVideo() {
            if (!mainVideo) return;
            if (pendingPlayPromise) {
                pendingPlayPromise.then(() => { try { mainVideo.pause(); } catch (_) {} }).catch(() => { try { mainVideo.pause(); } catch (_) {} });
            } else {
                try { mainVideo.pause(); } catch (_) {}
            }
        }

        function togglePlayPause() {
            if (mainVideo.paused) {
                safePlayVideo();
                showCenterBurst('play');
            } else {
                safePauseVideo();
                showCenterBurst('pause');
            }
        }

        mainVideo.addEventListener('play', () => {
            playIcon.classList.add('hidden', 'scale-75', 'opacity-0');
            pauseIcon.classList.remove('hidden', 'scale-75', 'opacity-0');
            pauseIcon.classList.add('scale-100', 'opacity-100');
            mediaHudOverlay.classList.remove('opacity-100');
            mediaHudOverlay.classList.add('opacity-0', 'pointer-events-none');
        });

        mainVideo.addEventListener('pause', () => {
            playIcon.classList.remove('hidden', 'scale-75', 'opacity-0');
            playIcon.classList.add('scale-100', 'opacity-100');
            pauseIcon.classList.add('hidden', 'scale-75', 'opacity-0');
            mediaHudOverlay.classList.remove('opacity-0', 'pointer-events-none');
            mediaHudOverlay.classList.add('opacity-100');
            showControls(true);
        });

        mainVideo.addEventListener('click', () => {
            togglePlayPause();
        });

        function seekRelative(seconds) {
            mainVideo.currentTime = Math.max(0, Math.min(mainVideo.duration || 0, mainVideo.currentTime + seconds));
            showCenterBurst(seconds > 0 ? 'forward' : 'rewind');
        }

        function setPlaybackSpeed(speed, btnEl) {
            mainVideo.playbackRate = speed;
            document.querySelectorAll('.speed-btn').forEach(b => {
                b.className = 'speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all';
            });
            if (btnEl) {
                btnEl.className = 'speed-btn px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-black transition-all shadow';
            }
        }

        function setVolume(val) {
            mainVideo.volume = parseFloat(val);
            mainVideo.muted = false;
            updateVolumeIcon();
        }

        function toggleMute() {
            mainVideo.muted = !mainVideo.muted;
            updateVolumeIcon();
        }

        function updateVolumeIcon() {
            const icon = document.getElementById('volumeIcon');
            if (!icon) return;
            if (mainVideo.muted || mainVideo.volume === 0) {
                icon.setAttribute('data-lucide', 'volume-x');
            } else if (mainVideo.volume < 0.5) {
                icon.setAttribute('data-lucide', 'volume-1');
            } else {
                icon.setAttribute('data-lucide', 'volume-2');
            }
            if (window.lucide) lucide.createIcons();
        }

        function setupTimeline() {
            mainVideo.addEventListener('timeupdate', () => {
                if (isScrubbing) return;
                const current = mainVideo.currentTime || 0;
                const duration = mainVideo.duration || 1;
                const pct = (current / duration) * 100;
                timelineProgress.style.width = pct + '%';
                timelineThumb.style.left = pct + '%';
                timeCurrent.textContent = formatTime(current);
                timeDuration.textContent = formatTime(duration);

                // Skip Intro & Next Episode triggers (Starts right from 00)
                if (current >= 0 && current <= 95) {
                    btnSkipIntro.classList.remove('hidden');
                    btnSkipIntro.classList.add('flex');
                } else {
                    btnSkipIntro.classList.add('hidden');
                    btnSkipIntro.classList.remove('flex');
                }

                if (MEDIA_TYPE === 'tv' && duration > 120 && (duration - current) <= 120) {
                    btnNextEpisode.classList.remove('hidden');
                    btnNextEpisode.classList.add('flex');
                } else {
                    btnNextEpisode.classList.add('hidden');
                    btnNextEpisode.classList.remove('flex');
                }
            });

            mainVideo.addEventListener('progress', () => {
                if (mainVideo.buffered.length > 0) {
                    const bufferedEnd = mainVideo.buffered.end(mainVideo.buffered.length - 1);
                    const duration = mainVideo.duration || 1;
                    timelineBuffer.style.width = ((bufferedEnd / duration) * 100) + '%';
                }
            });

            timelineContainer.addEventListener('mousedown', (e) => {
                isScrubbing = true;
                timelineContainer.classList.add('is-scrubbing');
                seekWithEvent(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (isScrubbing) seekWithEvent(e);
                updateTimelineTooltip(e);
            });

            window.addEventListener('mouseup', () => {
                if (isScrubbing) {
                    isScrubbing = false;
                    timelineContainer.classList.remove('is-scrubbing');
                }
            });

            timelineContainer.addEventListener('touchstart', (e) => {
                isScrubbing = true;
                timelineContainer.classList.add('is-scrubbing');
                if (e.touches[0]) seekWithEvent(e.touches[0]);
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                if (isScrubbing && e.touches[0]) seekWithEvent(e.touches[0]);
            }, { passive: true });

            window.addEventListener('touchend', () => {
                if (isScrubbing) {
                    isScrubbing = false;
                    timelineContainer.classList.remove('is-scrubbing');
                }
            });
        }

        function seekWithEvent(e) {
            const rect = timelineContainer.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const targetTime = pos * (mainVideo.duration || 0);
            mainVideo.currentTime = targetTime;
            timelineProgress.style.width = (pos * 100) + '%';
            timelineThumb.style.left = (pos * 100) + '%';
            timeCurrent.textContent = formatTime(targetTime);
        }

        function updateTimelineTooltip(e) {
            const rect = timelineContainer.getBoundingClientRect();
            if (e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20 && e.clientX >= rect.left && e.clientX <= rect.right) {
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetTime = pos * (mainVideo.duration || 0);
                timelineTooltip.textContent = formatTime(targetTime);
                timelineTooltip.style.left = (pos * 100) + '%';
                timelineTooltip.style.opacity = '1';
            } else {
                timelineTooltip.style.opacity = '0';
            }
        }

        function skipIntro() {
            mainVideo.currentTime = Math.min(mainVideo.duration || 0, (mainVideo.currentTime || 0) + 85);
            btnSkipIntro.classList.add('hidden');
        }

        function playNextEpisode() {
            const nextEp = MEDIA_EPISODE + 1;
            window.location.href = `/video.php?id=${MEDIA_ID}&tmdbId=${MEDIA_ID}&type=tv&title=${encodeURIComponent(MEDIA_TITLE)}&s=${MEDIA_SEASON}&season=${MEDIA_SEASON}&e=${nextEp}&episode=${nextEp}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        function formatTime(sec) {
            if (isNaN(sec) || sec < 0) return '0:00';
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) {
                return h + ':' + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
            }
            return m + ':' + s.toString().padStart(2, '0');
        }

        function setupControlsAutoHide() {
            window.addEventListener('mousemove', () => resetControlsTimer());
            window.addEventListener('touchstart', () => resetControlsTimer(), { passive: true });
            resetControlsTimer();
        }

        function resetControlsTimer() {
            showControls(true);
            clearTimeout(controlsTimeout);
            if (!mainVideo.paused) {
                controlsTimeout = setTimeout(() => {
                    showControls(false);
                }, 3500);
            }
        }

        function showControls(show) {
            const isModalOpen = !qualityServerModal.classList.contains('hidden') || 
                                !subtitlesModal.classList.contains('hidden') || 
                                !moreLikeThisTray.classList.contains('translate-y-full') ||
                                (episodesDrawer && !episodesDrawer.classList.contains('translate-y-full')) ||
                                !sleepModal.classList.contains('hidden');
            const embedTouchSensor = document.getElementById('embedTouchSensor');
            
            if (show || isModalOpen || mainVideo.paused) {
                topControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                bottomControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'default';
                if (embedTouchSensor) embedTouchSensor.classList.add('hidden');
            } else {
                topControlsBar.classList.add('opacity-0', 'pointer-events-none');
                bottomControlsBar.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'none';
                if (playerMode === 'embed' && embedTouchSensor) {
                    embedTouchSensor.classList.remove('hidden');
                }
            }
        }

        function toggleQualityServerModal(force) {
            const isHidden = qualityServerModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                qualityServerModal.classList.add('hidden');
            } else {
                subtitlesModal.classList.add('hidden');
                qualityServerModal.classList.remove('hidden');
                updateServerListUI();
            }
        }

        function toggleSubtitlesModal(force) {
            const isHidden = subtitlesModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                subtitlesModal.classList.add('hidden');
            } else {
                qualityServerModal.classList.add('hidden');
                subtitlesModal.classList.remove('hidden');
                detectAndPopulateAudioTracks();
                populateSubtitlesList();
            }
        }

        function toggleMoreLikeThisDrawer(force) {
            const isClosed = moreLikeThisTray.classList.contains('translate-y-full');
            const shouldOpen = force !== undefined ? force : isClosed;
            if (shouldOpen) {
                moreLikeThisTray.classList.remove('translate-y-full');
                moreLikeThisChevron.classList.add('rotate-180');
                if (episodesDrawer) episodesDrawer.classList.add('translate-y-full');
            } else {
                moreLikeThisTray.classList.add('translate-y-full');
                moreLikeThisChevron.classList.remove('rotate-180');
            }
        }

        function toggleEpisodesDrawer(force) {
            if (!episodesDrawer) return;
            const isClosed = episodesDrawer.classList.contains('translate-y-full');
            const shouldOpen = force !== undefined ? force : isClosed;
            if (shouldOpen) {
                episodesDrawer.classList.remove('translate-y-full');
                moreLikeThisTray.classList.add('translate-y-full');
                moreLikeThisChevron.classList.remove('rotate-180');
            } else {
                episodesDrawer.classList.add('translate-y-full');
            }
        }

        function toggleSleepModal(force) {
            const isHidden = sleepModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                sleepModal.classList.add('hidden');
            } else {
                sleepModal.classList.remove('hidden');
            }
        }

        function setSleepTimer(minutes) {
            if (sleepTimerInterval) clearInterval(sleepTimerInterval);
            if (minutes === 0) {
                sleepIndicator.style.display = 'none';
                toggleSleepModal(false);
                showToast('Sleep Timer Disabled');
                return;
            }
            sleepEndTime = Date.now() + (minutes * 60 * 1000);
            sleepIndicator.style.display = 'flex';
            toggleSleepModal(false);
            showToast(`Sleep Timer Set: ${minutes}m`);

            sleepTimerInterval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((sleepEndTime - Date.now()) / 1000));
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                document.getElementById('sleep-time').textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                if (remaining <= 0) {
                    clearInterval(sleepTimerInterval);
                    mainVideo.pause();
                    sleepIndicator.style.display = 'none';
                    showToast('Playback paused by Sleep Timer');
                }
            }, 1000);
        }

        function setSubtitleFontSize(size) {
            document.documentElement.style.setProperty('--sub-font-size', size);
            document.getElementById('subPreviewBox').style.fontSize = size;
        }

        function setSubtitleColor(color) {
            document.documentElement.style.setProperty('--sub-color', color);
            document.getElementById('subPreviewBox').style.color = color;
        }

        function adjustSubtitleSync(delta) {
            subtitleSyncOffset = parseFloat((subtitleSyncOffset + delta).toFixed(2));
            const disp = document.getElementById('subOffsetDisplay');
            if (disp) {
                disp.textContent = (subtitleSyncOffset >= 0 ? '+' : '') + subtitleSyncOffset.toFixed(2) + 's';
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    const track = mainVideo.textTracks[i];
                    if (track.cues) {
                        for (let j = 0; j < track.cues.length; j++) {
                            track.cues[j].startTime += delta;
                            track.cues[j].endTime += delta;
                        }
                    }
                }
            }
        }

        function resetSubtitleSync() {
            adjustSubtitleSync(-subtitleSyncOffset);
        }

        async function loadMediaHudMetadata() {
            try {
                const endpoint = MEDIA_TYPE === 'tv' ? '/api/bingr/tv/' + MEDIA_ID : '/api/bingr/movie/' + MEDIA_ID;
                const res = await fetch(endpoint);
                const data = await res.json();

                if (data) {
                    if (data.year) document.getElementById('hudYear').textContent = data.year;
                    if (data.rating) document.getElementById('hudRating').textContent = `${Number(data.rating).toFixed(1)} / 10`;
                    if (data.runtime) {
                        const h = Math.floor(data.runtime / 60);
                        const m = data.runtime % 60;
                        document.getElementById('hudRuntime').textContent = h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
                    }
                    if (data.certification) document.getElementById('hudCert').textContent = data.certification;
                    if (data.overview) document.getElementById('hudOverview').textContent = data.overview;
                }

                const imgEndpoint = '/api/bingr/tmdb-proxy?endpoint=' + MEDIA_TYPE + '/' + MEDIA_ID + '/images&include_image_language=en,null';
                const imgRes = await fetch(imgEndpoint);
                const imgData = await imgRes.json();

                if (imgData && imgData.logos && imgData.logos.length > 0) {
                    const logo = imgData.logos.find(l => l.file_path && l.file_path.endsWith('.png')) || imgData.logos[0];
                    if (logo && logo.file_path) {
                        const hudLogoImg = document.getElementById('hudLogoImg');
                        hudLogoImg.src = 'https://image.tmdb.org/t/p/w500' + logo.file_path;
                        hudLogoImg.classList.remove('hidden');
                        document.getElementById('hudTitleText').classList.add('hidden');
                    }
                }
            } catch (e) {
                console.warn('HUD info load notice:', e);
            }
        }

        /* ---------------- REDESIGNED MORE LIKE THIS (TRANSPARENT GLASS & NO STARS) ---------------- */
        async function loadMoreLikeThis() {
            const grid = document.getElementById('moreLikeThisGrid');
            if (!grid) return;

            try {
                const endpoint = '/api/bingr/tmdb-proxy?endpoint=' + MEDIA_TYPE + '/' + MEDIA_ID + '/recommendations';
                const res = await fetch(endpoint);
                const data = await res.json();
                const items = data.results ? data.results.slice(0, 12) : [];

                if (items.length === 0) {
                    grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-zinc-500">No related titles found.</div>';
                    return;
                }

                grid.innerHTML = items.map(item => {
                    const title = item.title || item.name || 'Title';
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.0';
                    const year = (item.release_date || item.first_air_date || '2024').slice(0, 4);
                    const thumb = item.backdrop_path ? 'https://image.tmdb.org/t/p/w500' + item.backdrop_path : (item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : '');
                    
                    return `
                        <div onclick="switchMovie(${item.id}, '${item.media_type || MEDIA_TYPE}', '${title.replace(/'/g, "\\'")}')" class="group cursor-pointer space-y-2 transition-all duration-300 transform hover:scale-[1.04] active:scale-95">
                            <div class="relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border border-white/10 shadow-xl group-hover:border-white/30 group-hover:shadow-2xl">
                                <img src="${thumb}" alt="${title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                                    <span class="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                        <i data-lucide="play" class="w-3 h-3 fill-white"></i> Play
                                    </span>
                                </div>
                                <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md glass-panel text-amber-300 text-[10px] font-black tracking-wide border border-white/10">
                                    ${rating}
                                </div>
                            </div>
                            <div class="space-y-0.5 px-0.5">
                                <h4 class="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">${title}</h4>
                                <div class="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase font-semibold">
                                    <span>${year}</span>
                                    <span>&bull;</span>
                                    <span class="text-zinc-500">${MEDIA_TYPE === 'tv' ? 'Series' : 'Cinema'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                if (window.lucide) lucide.createIcons();
            } catch (e) {
                grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-zinc-500">Failed to load recommendations.</div>';
            }
        }

        async function loadTvSeasonsAndEpisodes() {
            if (MEDIA_TYPE !== 'tv') return;
            const seasonSelect = document.getElementById('seasonSelect');
            const grid = document.getElementById('episodesGrid');
            if (!seasonSelect || !grid) return;

            try {
                const res = await fetch('/api/bingr/tv/' + MEDIA_ID);
                const data = await res.json();
                if (!data || !data.seasons) return;

                const seasons = data.seasons.filter(s => (s.season !== undefined ? s.season : s.season_number) > 0);
                seasonSelect.innerHTML = seasons.map(s => {
                    const sNum = s.season !== undefined ? s.season : s.season_number;
                    const eCount = s.episodes !== undefined ? s.episodes : s.episode_count;
                    const sName = s.name && s.name !== `Season ${sNum}` ? ` - ${s.name}` : '';
                    return `<option value="${sNum}" ${sNum === MEDIA_SEASON ? 'selected' : ''}>Season ${sNum}${sName} (${eCount} eps)</option>`;
                }).join('');

                loadEpisodesForSeason(MEDIA_SEASON);
            } catch (e) {
                console.warn('Seasons load error:', e);
            }
        }

        async function changeSeason(seasonNum) {
            MEDIA_SEASON = parseInt(seasonNum);
            loadEpisodesForSeason(MEDIA_SEASON);
        }

        async function loadEpisodesForSeason(seasonNum) {
            const grid = document.getElementById('episodesGrid');
            if (!grid) return;
            grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">Loading episodes...</div>';

            try {
                const res = await fetch(`/api/bingr/tmdb-proxy?endpoint=tv/${MEDIA_ID}/season/${seasonNum}`);
                const data = await res.json();
                const episodes = data.episodes || [];

                if (episodes.length === 0) {
                    grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">No episodes found.</div>';
                    return;
                }

                grid.innerHTML = episodes.map(ep => {
                    const isCurrent = ep.episode_number === MEDIA_EPISODE && seasonNum === MEDIA_SEASON;
                    const thumb = ep.still_path ? 'https://image.tmdb.org/t/p/w300' + ep.still_path : '';
                    return `
                        <div onclick="switchEpisode(${seasonNum}, ${ep.episode_number})" class="group cursor-pointer space-y-1.5 transition-all transform hover:scale-[1.03] active:scale-95">
                            <div class="relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border ${isCurrent ? 'border-red-500 ring-2 ring-red-500/50' : 'border-white/10'} shadow-lg">
                                ${thumb ? `<img src="${thumb}" alt="Ep ${ep.episode_number}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">EP ${ep.episode_number}</div>`}
                                <div class="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md glass-panel text-white text-[10px] font-black">
                                    EP ${ep.episode_number}
                                </div>
                            </div>
                            <div class="text-[11px] font-bold text-white truncate group-hover:text-red-400 transition-colors px-0.5">
                                ${ep.name || `Episode ${ep.episode_number}`}
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (e) {
                grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">Failed to load episodes.</div>';
            }
        }

        function switchEpisode(season, episode) {
            window.location.href = `/video.php?id=${MEDIA_ID}&tmdbId=${MEDIA_ID}&type=tv&title=${encodeURIComponent(MEDIA_TITLE)}&s=${season}&season=${season}&e=${episode}&episode=${episode}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        function switchMovie(newId, newType, newTitle) {
            window.location.href = `/video.php?id=${newId}&tmdbId=${newId}&type=${newType}&title=${encodeURIComponent(newTitle)}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        const EMBED_PROVIDERS = [
            { id: 'cinepro_core', name: 'CinePro Core 4K', url: (t, id, s, e) => t === 'tv' ? `https://vidsrc.vip/embed/tv/${id}/${s}/${e}` : `https://vidsrc.vip/embed/movie/${id}` },
            { id: 'videasy', name: 'VidEasy Ultra', url: (t, id, s, e) => t === 'tv' ? `https://player.videasy.net/tv/${id}/${s}/${e}` : `https://player.videasy.net/movie/${id}` },
            { id: 'vixsrc', name: 'VixSrc 1080P', url: (t, id, s, e) => t === 'tv' ? `https://vixsrc.to/embed/tv/${id}/${s}/${e}` : `https://vixsrc.to/embed/movie/${id}` },
            { id: 'vidzee', name: 'VidZee Fast', url: (t, id, s, e) => t === 'tv' ? `https://vidzee.org/embed/tv/${id}/${s}/${e}` : `https://vidzee.org/embed/movie/${id}` },
            { id: 'vidlink_pro', name: 'VidLink Pro', url: (t, id, s, e) => t === 'tv' ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` : `https://vidlink.pro/movie/${id}?autoplay=true` },
            { id: 'vidrift', name: 'Vidrift', url: (t, id, s, e) => t === 'tv' ? `https://embed.vidrift.in/embed/tv/${id}/${s}/${e}` : `https://embed.vidrift.in/embed/movie/${id}` },
            { id: 'vidsrc_pm', name: 'VidSrc PM', url: (t, id, s, e) => t === 'tv' ? `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` : `https://vidsrc.pm/embed/movie/${id}` },
            { id: 'vidsrc_to', name: 'VidSrc TO', url: (t, id, s, e) => t === 'tv' ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}` : `https://vidsrc.to/embed/movie/${id}` },
            { id: 'vidsrc_in', name: 'VidSrc IN', url: (t, id, s, e) => t === 'tv' ? `https://vidsrc.in/embed/tv/${id}/${s}/${e}` : `https://vidsrc.in/embed/movie/${id}` },
            { id: 'autoembed', name: 'AutoEmbed 4K', url: (t, id, s, e) => t === 'tv' ? `https://autoembed.cc/embed/tv/${id}/${s}/${e}` : `https://autoembed.cc/embed/movie/${id}` },
            { id: 'smashy', name: 'SmashyStream', url: (t, id, s, e) => t === 'tv' ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}` : `https://embed.smashystream.com/playere.php?tmdb=${id}` },
            { id: 'filmu', name: 'Filmu Stream', url: (t, id, s, e) => t === 'tv' ? `https://embed.filmu.in/tv/${id}/${s}/${e}` : `https://embed.filmu.in/movie/${id}` },
            { id: 'cinezo', name: 'Cinezo HD', url: (t, id, s, e) => t === 'tv' ? `https://player.cinezo.live/embed/tv/${id}/${s}/${e}` : `https://player.cinezo.live/embed/movie/${id}` },
            { id: '2embed', name: '2Embed Multi', url: (t, id, s, e) => t === 'tv' ? `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` : `https://www.2embed.cc/embed/${id}` }
        ];

        function populateEmbedProviders() {
            const grid = document.getElementById('embedProvidersGrid');
            if (!grid) return;
            
            grid.innerHTML = EMBED_PROVIDERS.map(prov => {
                const isSelected = playerMode === 'embed' && embedFrame.dataset.provider === prov.id;
                return `
                    <button onclick="switchPlayerMode('embed', '${prov.id}')" class="flex flex-col items-start px-3 py-2 rounded-xl border ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 glass-sub-panel hover:bg-white/5'} transition-all cursor-pointer">
                        <span class="text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}">${prov.name}</span>
                        <span class="text-[9px] text-zinc-500 font-medium mt-0.5">${isSelected ? 'Currently Playing' : 'Select Provider'}</span>
                    </button>
                `;
            }).join('');
        }

        function switchPlayerMode(mode, providerId = 'vidsrc_cc') {
            playerMode = mode;
            const btnDirect = document.getElementById('btnModeDirect');
            const btnEmbed = document.getElementById('btnModeEmbed');
            const bottomControls = document.getElementById('bottomControlsBar');
            
            if (mode === 'embed') {
                if (hlsInstance) hlsInstance.stopLoad();
                mainVideo.pause();
                mainVideo.classList.add('hidden');
                document.body.classList.add('embed-active');
                
                embedFrame.dataset.provider = providerId;
                const prov = EMBED_PROVIDERS.find(p => p.id === providerId) || EMBED_PROVIDERS[1];
                embedFrame.src = prov.url(MEDIA_TYPE, MEDIA_ID, MEDIA_SEASON, MEDIA_EPISODE);
                
                embedFrame.classList.remove('hidden');
                embedFrame.style.zIndex = '10'; // sit above mainVideo, but under controls
                
                if (bottomControls) bottomControls.style.display = 'none'; // fully remove timeline

                if (btnDirect) btnDirect.className = 'px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all';
                if (btnEmbed) btnEmbed.className = 'px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-extrabold transition-all shadow';
                
                showToast(`Switched to Embed: ${prov.name}`);
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer(); // Ensure sensor gets initialized properly
            } else {
                embedFrame.classList.add('hidden');
                embedFrame.src = '';
                embedFrame.style.zIndex = '0';
                document.body.classList.remove('embed-active');
                
                if (bottomControls) bottomControls.style.display = 'flex'; // restore timeline
                
                mainVideo.classList.remove('hidden');
                if (hlsInstance) hlsInstance.startLoad();
                mainVideo.play().catch(() => {});
                
                if (btnDirect) btnDirect.className = 'px-2.5 py-1 rounded-lg bg-white text-black font-extrabold transition-all shadow';
                if (btnEmbed) btnEmbed.className = 'px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all';
                
                showToast('Switched to Direct Native Stream');
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer();
            }
        }

        function showLoading(show, msg) {
            if (msg) streamLoadingMsg.textContent = msg;
            if (show) {
                streamLoading.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            } else {
                streamLoading.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => streamLoading.classList.add('hidden'), 300);
            }
        }

        function showCenterBurst(iconName) {
            const burst = document.getElementById('centerPlayBurst');
            const icon = document.getElementById('centerBurstIcon');
            if (!burst || !icon) return;

            icon.setAttribute('data-lucide', iconName === 'pause' ? 'pause' : (iconName === 'forward' ? 'fast-forward' : (iconName === 'rewind' ? 'rewind' : 'play')));
            if (window.lucide) lucide.createIcons();

            burst.classList.remove('opacity-0', 'scale-75');
            burst.classList.add('burst-active');
            setTimeout(() => {
                burst.classList.remove('burst-active');
                burst.classList.add('opacity-0', 'scale-75');
            }, 380);
        }

        function toggleFullscreen() {
            const container = document.getElementById('playerContainer') || document.documentElement;
            const video = document.getElementById('mainVideo');
            
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

            if (!isFullscreen) {
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(() => {});
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                } else if (container.mozRequestFullScreen) {
                    container.mozRequestFullScreen();
                } else if (container.msRequestFullscreen) {
                    container.msRequestFullscreen();
                } else if (video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
                const icon = document.getElementById('fullscreenIcon');
                if (icon) icon.setAttribute('data-lucide', 'minimize');
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                const icon = document.getElementById('fullscreenIcon');
                if (icon) icon.setAttribute('data-lucide', 'maximize');
            }
            if (window.lucide) lucide.createIcons();
        }

        function handleGoBack() {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = '/' + (SOURCE_ORIGIN || 'consumet.html');
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            switch (e.code) {
                case 'Space':
                case 'KeyK':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'ArrowLeft':
                case 'KeyJ':
                    seekRelative(-10);
                    break;
                case 'ArrowRight':
                case 'KeyL':
                    seekRelative(10);
                    break;
                case 'ArrowUp':
                    mainVideo.volume = Math.min(1, mainVideo.volume + 0.1);
                    document.getElementById('volumeSlider').value = mainVideo.volume;
                    updateVolumeIcon();
                    break;
                case 'ArrowDown':
                    mainVideo.volume = Math.max(0, mainVideo.volume - 0.1);
                    document.getElementById('volumeSlider').value = mainVideo.volume;
                    updateVolumeIcon();
                    break;
                case 'KeyF':
                    toggleFullscreen();
                    break;
                case 'KeyM':
                    toggleMute();
                    break;
                case 'KeyS':
                    skipIntro();
                    break;
                case 'KeyN':
                    if (MEDIA_TYPE === 'tv') playNextEpisode();
                    break;
                case 'KeyR':
                    toggleRotation();
                    break;
                case 'KeyA':
                    toggleAspectRatio();
                    break;
            }
        });
    </script>
</body>
</html>
