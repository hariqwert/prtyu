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
if ($srv === '{{SRV}}' || empty($srv)) $srv = 'hianime';
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
            --sub-bg: rgba(0, 0, 0, 0.78);
            --sub-shadow: 0 2px 5px rgba(0, 0, 0, 0.95);
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
            border-radius: 6px !important;
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
            background: rgba(255, 255, 255, 0.2);
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
            background: rgba(255, 255, 255, 0.4);
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
        }
        .timeline-progress {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: #ef4444;
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
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
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.9);
        }
        .timeline-container:hover .timeline-thumb,
        .timeline-container.is-scrubbing .timeline-thumb {
            transform: translate(-50%, -50%) scale(1.3);
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
            background: rgba(18, 18, 24, 0.9);
            color: #fff;
            padding: 0.55rem 1.4rem;
            border-radius: 9999px;
            font-size: 0.825rem;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(25px);
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
            background: rgba(0, 0, 0, 0.85);
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
            backdrop-filter: blur(12px);
        }

        /* Apple TV Skip Intro & Next Episode Pills */
        .apple-skip-btn {
            position: absolute;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(20, 20, 26, 0.88);
            border: 1px solid rgba(255, 255, 255, 0.22);
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
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
        }
        .apple-skip-btn:active {
            transform: scale(0.97);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }

        .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }

        .animate-fade-in { animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
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
        <iframe id="embedFrame" class="w-full h-full border-0 hidden" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>

        <!-- Loading Spinner -->
        <div id="streamLoading" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md transition-opacity duration-300">
            <div class="relative flex items-center justify-center">
                <div class="w-14 h-14 rounded-full border-3 border-white/10 border-t-red-500 animate-spin"></div>
                <i data-lucide="play" class="w-5 h-5 text-red-500 absolute fill-current"></i>
            </div>
            <p id="streamLoadingMsg" class="mt-4 text-xs font-bold tracking-widest uppercase text-zinc-300">Connecting to Stream...</p>
            <span id="streamLoadingSub" class="text-[10px] text-zinc-500 mt-1">Cascading high-speed CDN clusters</span>
        </div>

        <!-- Center Play/Pause / Rewind / Forward Burst Animation -->
        <div id="centerPlayBurst" class="absolute z-20 w-20 h-20 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white opacity-0 pointer-events-none transition-all duration-300 transform scale-75 shadow-2xl backdrop-blur-md">
            <i id="centerBurstIcon" data-lucide="play" class="w-10 h-10 ml-1"></i>
        </div>

        <!-- MEDIA HUD OVERLAY (ON PAUSE / INITIAL LOAD) -->
        <div id="mediaHudOverlay" class="absolute inset-0 z-20 pointer-events-none transition-opacity duration-500 bg-gradient-to-t from-black/95 via-black/45 to-black/75 flex flex-col justify-between p-6 sm:p-10 lg:p-14 opacity-100">
            <div class="h-16"></div>

            <div class="max-w-2xl space-y-3 pointer-events-auto pb-16">
                <!-- TMDB Stylized Logo Image or Title -->
                <div id="hudLogoContainer" class="min-h-[50px] flex items-end">
                    <img id="hudLogoImg" src="" alt="Title Logo" class="max-h-24 sm:max-h-28 max-w-[280px] sm:max-w-[380px] object-contain hidden filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                    <h1 id="hudTitleText" class="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight drop-shadow-lg leading-none">
                        <?php echo htmlspecialchars($title); ?>
                    </h1>
                </div>

                <!-- Metadata Row: Year • Runtime • Rating • Certification -->
                <div class="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-zinc-300 flex-wrap">
                    <span id="hudYear" class="px-2 py-0.5 rounded-md bg-white/10 text-white">2024</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRuntime">1h 55m</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRating" class="flex items-center gap-1 text-amber-400 font-extrabold">
                        <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400"></i>
                        <span>7.8</span>
                    </span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudCert" class="px-1.5 py-0.5 rounded border border-white/20 text-[10px] uppercase font-bold text-zinc-400">PG-13</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudClusterBadge" class="px-2 py-0.5 rounded-md bg-red-600/30 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-wider">Bingr 4K Master</span>
                </div>

                <!-- Synopsis Text Paragraph -->
                <p id="hudOverview" class="text-xs sm:text-sm text-zinc-300/90 leading-relaxed line-clamp-3 sm:line-clamp-4 drop-shadow">
                    Loading media overview and synopsis from databanks...
                </p>
            </div>
        </div>

        <!-- TOP CONTROLS BAR -->
        <div id="topControlsBar" class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300">
            <!-- Left Controls: Back + Title Pill -->
            <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <button id="btnBack" onclick="handleGoBack()" class="w-10 h-10 rounded-full bg-black/70 hover:bg-red-600 border border-white/15 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md shrink-0 shadow-lg" title="Back">
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
                <button onclick="const el=document.getElementById('bingrTopControlsScroll'); if(el) el.scrollBy({left: -120, behavior: 'smooth'});" class="sm:hidden w-6 h-6 rounded-full bg-black/70 border border-white/15 text-zinc-300 flex items-center justify-center shrink-0 active:scale-90 mr-1" title="Scroll Tools Left">
                    <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                </button>
                <div id="bingrTopControlsScroll" class="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-1 min-w-0 justify-start sm:justify-end flex-nowrap" style="-webkit-overflow-scrolling: touch;">
                <!-- Reconnect Stream Button -->
                <button onclick="triggerAutoReconnect()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Reconnect Stream">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>

                <!-- Aspect Ratio Button -->
                <button onclick="toggleAspectRatio()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Toggle Aspect Ratio">
                    <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>

                <!-- Rotate View Button -->
                <button onclick="toggleRotation()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Rotate Player">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>

                <!-- Sleep Timer Button -->
                <button onclick="toggleSleepModal()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Sleep Timer">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                </button>

                <!-- TV Episodes Drawer Toggle (If Series) -->
                <?php if ($type === 'tv'): ?>
                <button id="btnEpisodesDrawer" onclick="toggleEpisodesDrawer()" class="px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600 border border-blue-500/40 text-xs font-bold text-blue-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Episodes Picker">
                    <i data-lucide="list-video" class="w-3.5 h-3.5"></i>
                    <span class="hidden md:inline">Episodes</span>
                </button>
                <?php endif; ?>

                <!-- Watch Together (Party Mode) Button -->
                <button onclick="togglePartyMode()" class="px-3 py-2 rounded-xl bg-pink-600/30 hover:bg-pink-600 border border-pink-500/40 text-xs font-bold text-pink-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Watch Together (Party Mode)">
                    <i data-lucide="users" class="w-3.5 h-3.5"></i>
                    <span class="hidden md:inline">Party</span>
                </button>

                <!-- Quality & Server Button -->
                <button id="btnOpenQualityServer" onclick="toggleQualityServerModal()" class="px-3 py-2 rounded-xl bg-black/70 hover:bg-white/15 border border-white/20 text-xs font-bold text-white flex items-center gap-2 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Quality & Servers">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span id="qualityButtonLabel" class="hidden xs:inline">Auto &bull; 1080p</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
                </button>

                <!-- Audio & Subtitles Button -->
                <button id="btnOpenSubtitles" onclick="toggleSubtitlesModal()" class="px-3 py-2 rounded-xl bg-black/70 hover:bg-white/15 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0" title="Audio & Subtitles">
                    <i data-lucide="subtitles" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span class="hidden sm:inline">Audio & Subs</span>
                </button>
                </div>
                <button onclick="const el=document.getElementById('bingrTopControlsScroll'); if(el) el.scrollBy({left: 120, behavior: 'smooth'});" class="sm:hidden w-6 h-6 rounded-full bg-black/70 border border-white/15 text-zinc-300 flex items-center justify-center shrink-0 active:scale-90 ml-1" title="Scroll Tools Right">
                    <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>

        <!-- BOTTOM CONTROLS BAR -->
        <div id="bottomControlsBar" class="absolute bottom-0 left-0 right-0 z-30 flex flex-col p-3 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 gap-2">
            <!-- Timeline Scrubber -->
            <div id="timelineContainer" class="timeline-container w-full">
                <div class="timeline-track">
                    <div id="timelineBuffer" class="timeline-buffer"></div>
                    <div id="timelineProgress" class="timeline-progress"></div>
                    <div id="timelineThumb" class="timeline-thumb"></div>
                </div>
                <div id="timelineTooltip" class="absolute -top-7 px-2 py-0.5 rounded bg-black/90 border border-white/20 text-[10px] font-mono text-white pointer-events-none opacity-0 transition-opacity">0:00</div>
            </div>

            <!-- Control Actions Bar (Responsive Horizontal Scrolling on Mobile) -->
            <div class="relative w-full flex items-center">
                <!-- Mobile Scroll Left Button -->
                <button onclick="const el=document.getElementById('bingrControlsActionBar'); if(el) el.scrollBy({left: -160, behavior: 'smooth'});" class="sm:hidden w-8 h-8 rounded-full bg-black/70 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 active:scale-90 shadow-xl mr-1 z-10 cursor-pointer" title="Scroll Controls Left">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>

                <div id="bingrControlsActionBar" class="flex items-center justify-start sm:justify-between gap-2.5 sm:gap-4 pt-1 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x w-full flex-nowrap" style="-webkit-overflow-scrolling: touch;">
                <!-- Left: Rewind, Play/Pause, Fast Forward, Volume -->
                <div class="flex items-center gap-2 sm:gap-4 shrink-0">
                    <button onclick="seekRelative(-10)" class="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90 shrink-0" title="Rewind 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">&laquo; 10</span>
                    </button>

                    <button id="btnPlayPause" onclick="togglePlayPause()" class="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all transform active:scale-95 cursor-pointer shadow-lg shadow-white/10 shrink-0" title="Play/Pause">
                        <i id="playIcon" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current"></i>
                        <i id="pauseIcon" data-lucide="pause" class="w-5 h-5 hidden fill-current"></i>
                    </button>

                    <button onclick="seekRelative(10)" class="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90 shrink-0" title="Forward 10s">
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
                    <button id="btnToggleMoreLikeThis" onclick="toggleMoreLikeThisDrawer()" class="px-3.5 py-1.5 rounded-full bg-black/70 hover:bg-white/15 border border-white/20 text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-lg shrink-0">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
                        <span class="truncate">More Like This</span>
                        <i id="moreLikeThisChevron" data-lucide="chevron-up" class="w-3.5 h-3.5 transition-transform"></i>
                    </button>
                </div>

                <!-- Right: Direct | Embed Mode, Time, PiP & Fullscreen -->
                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div class="hidden sm:flex items-center p-0.5 rounded-lg bg-black/70 border border-white/15 text-[10px] font-bold text-zinc-400">
                        <button id="btnModeDirect" onclick="switchPlayerMode('direct')" class="px-2 py-1 rounded-md bg-white text-black font-extrabold transition-all">DIRECT</button>
                        <button id="btnModeEmbed" onclick="switchPlayerMode('embed')" class="px-2 py-1 rounded-md text-zinc-400 hover:text-white transition-all">EMBED</button>
                    </div>

                    <div class="text-[10px] sm:text-[11px] font-mono text-zinc-300 tracking-wider shrink-0 whitespace-nowrap">
                        <span id="timeCurrent">0:00</span> <span class="text-zinc-600">/</span> <span id="timeDuration">0:00</span>
                    </div>

                    <button id="party-mode-btn" onclick="if (typeof window.togglePartyModal === 'function') window.togglePartyModal(true)" class="p-1.5 text-pink-400 hover:text-pink-300 transition-all cursor-pointer active:scale-90 shrink-0" title="Watch Together (Party Mode)"><i data-lucide="users" class="w-4 h-4"></i></button>
                    <button id="btnPip" onclick="togglePiP()" class="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90 hidden xs:block shrink-0" title="Picture-in-Picture">
                        <i data-lucide="picture-in-picture-2" class="w-4 h-4"></i>
                    </button>

                    <button id="btnFullscreen" onclick="toggleFullscreen()" class="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90 shrink-0" title="Fullscreen">
                        <i id="fullscreenIcon" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
                </div>

                <!-- Mobile Scroll Right Button -->
                <button onclick="const el=document.getElementById('bingrControlsActionBar'); if(el) el.scrollBy({left: 160, behavior: 'smooth'});" class="sm:hidden w-8 h-8 rounded-full bg-black/70 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 active:scale-90 shadow-xl ml-1 z-10 cursor-pointer" title="Scroll Controls Right">
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

        <!-- DUAL-COLUMN QUALITY & SERVER DRAWER MODAL -->
        <div id="qualityServerModal" class="absolute top-16 right-3 sm:right-6 lg:right-10 z-40 hidden animate-fade-in w-[330px] sm:w-[480px] bg-[#121214]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-white">
            <div class="flex items-center justify-between pb-3 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <i data-lucide="server" class="w-4 h-4 text-red-500"></i>
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
                    <div class="px-2 py-1.5 mb-2 rounded-lg bg-zinc-800/80 border border-white/10 text-[10px] font-bold text-amber-400 flex items-center justify-between">
                        <span>4K / UHD Master</span>
                        <i data-lucide="sparkles" class="w-3 h-3 text-amber-400"></i>
                    </div>
                    <div id="qualityList" class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left bg-white/15 text-white">
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

            <!-- Bottom Row: Speed Selector -->
            <div class="pt-3 border-t border-white/10 flex items-center justify-between gap-1 flex-wrap">
                <div class="flex items-center gap-1">
                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">SPEED</span>
                    <button onclick="setPlaybackSpeed(0.5, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.5x</button>
                    <button onclick="setPlaybackSpeed(0.75, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.75x</button>
                    <button onclick="setPlaybackSpeed(1, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold bg-white text-black transition-all">1x</button>
                    <button onclick="setPlaybackSpeed(1.25, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.25x</button>
                    <button onclick="setPlaybackSpeed(1.5, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.5x</button>
                    <button onclick="setPlaybackSpeed(2, this)" class="speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all">2x</button>
                </div>
            </div>
        </div>

        <!-- SUBTITLES & AUDIO CONTROLLER MODAL -->
        <div id="subtitlesModal" class="absolute top-16 right-3 sm:right-6 lg:right-10 z-40 hidden animate-fade-in w-[330px] sm:w-[440px] bg-[#121214]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-white">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="subtitles" class="w-4 h-4 text-red-500"></i>
                    <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300">Audio & Subtitles Controller</span>
                </div>
                <button onclick="toggleSubtitlesModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Tabs: Tracks vs Appearance & Sync -->
            <div class="flex rounded-xl bg-white/5 p-1 mb-3">
                <button id="subTabTracksBtn" onclick="switchSubTab('tracks')" class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow">
                    Language Tracks
                </button>
                <button id="subTabVisualBtn" onclick="switchSubTab('visual')" class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white">
                    Visual & Sync
                </button>
            </div>

            <!-- Tab 1: Tracks -->
            <div id="subTabContentTracks" class="space-y-2">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">SUBTITLE TRACKS</div>
                <div id="subtitlesList" class="space-y-1 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                    <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left bg-white/15 text-white">
                        <span>Off</span>
                        <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                    </button>
                </div>
                <div class="border-t border-white/10 pt-2">
                    <label class="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Upload Custom Subtitle (.vtt / .srt)</label>
                    <input type="file" id="customSubInput" accept=".vtt,.srt" class="block w-full text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer">
                </div>
            </div>

            <!-- Tab 2: Visual Controller & Audio Sync -->
            <div id="subTabContentVisual" class="hidden space-y-3">
                <!-- Live Preview Card -->
                <div class="p-2.5 bg-black/60 rounded-xl border border-white/10 text-center">
                    <div id="subPreviewBox" class="py-1.5 px-2.5 rounded-lg inline-block transition-all" style="font-size: var(--sub-font-size); color: var(--sub-color); background-color: var(--sub-bg); text-shadow: var(--sub-shadow); font-weight: 700;">
                        The quick brown fox jumps over the lazy dog
                    </div>
                </div>

                <!-- Font Size -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Font Size</label>
                    <div class="grid grid-cols-4 gap-1">
                        <button onclick="setSubtitleFontSize('0.85rem')" class="py-1 px-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-zinc-300">Small</button>
                        <button onclick="setSubtitleFontSize('1.15rem')" class="py-1 px-1.5 bg-red-600 text-white rounded-lg text-[11px] font-bold">Normal</button>
                        <button onclick="setSubtitleFontSize('1.45rem')" class="py-1 px-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-zinc-300">Large</button>
                        <button onclick="setSubtitleFontSize('1.75rem')" class="py-1 px-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-zinc-300">Huge</button>
                    </div>
                </div>

                <!-- Colors -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Color</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleColor('#ffffff')" class="py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/20">White</button>
                        <button onclick="setSubtitleColor('#facc15')" class="py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-[11px] font-bold border border-yellow-500/30">Yellow</button>
                        <button onclick="setSubtitleColor('#38bdf8')" class="py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[11px] font-bold border border-sky-500/30">Cyan</button>
                        <button onclick="setSubtitleColor('#4ade80')" class="py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">Green</button>
                    </div>
                </div>

                <!-- Audio / Subtitle Sync Offset -->
                <div class="p-2.5 bg-white/5 rounded-xl border border-white/10">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[10px] font-bold text-zinc-300 uppercase">Timing Sync Offset</span>
                        <span id="subOffsetDisplay" class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">0.00s</span>
                    </div>
                    <div class="grid grid-cols-5 gap-1">
                        <button onclick="adjustSubtitleSync(-1.0)" class="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">-1.0s</button>
                        <button onclick="adjustSubtitleSync(-0.25)" class="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">-0.25s</button>
                        <button onclick="resetSubtitleSync()" class="py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold">Reset</button>
                        <button onclick="adjustSubtitleSync(0.25)" class="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">+0.25s</button>
                        <button onclick="adjustSubtitleSync(1.0)" class="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold">+1.0s</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- TV SEASONS & EPISODES DRAWER -->
        <?php if ($type === 'tv'): ?>
        <div id="episodesDrawer" class="absolute bottom-0 left-0 right-0 z-40 max-h-[75vh] bg-[#0c0d10]/95 backdrop-blur-3xl border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-3">
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">Episodes</h3>
                    <select id="seasonSelect" onchange="changeSeason(this.value)" class="bg-zinc-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/15 outline-none cursor-pointer"></select>
                </div>
                <button onclick="toggleEpisodesDrawer(false)" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar pt-3 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading episodes...</div>
            </div>
        </div>
        <?php endif; ?>

        <!-- MORE LIKE THIS SLIDE-UP TRAY -->
        <div id="moreLikeThisTray" class="absolute bottom-0 left-0 right-0 z-40 max-h-[75vh] bg-[#0c0d10]/95 backdrop-blur-3xl border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">More Like This</h3>
                    <span class="text-xs text-zinc-400 font-semibold truncate max-w-xs sm:max-w-md">&bull; <?php echo htmlspecialchars($title); ?></span>
                </div>
                <button onclick="toggleMoreLikeThisDrawer(false)" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="moreLikeThisGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 overflow-y-auto custom-scrollbar pt-4 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading recommendations...</div>
            </div>
        </div>

        <!-- SLEEP TIMER MODAL -->
        <div id="sleepModal" class="hidden fixed inset-0 z-[10001] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div class="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl text-center relative flex flex-col">
                <button onclick="toggleSleepModal(false)" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-red-600 hover:text-white flex items-center justify-center cursor-pointer transition-all">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20 text-red-500">
                    <i data-lucide="clock" class="w-6 h-6"></i>
                </div>
                <h3 class="text-base font-bold text-white mb-1">Set Sleep Timer</h3>
                <p class="text-xs text-zinc-400 mb-4">Playback will pause automatically when timer expires.</p>
                <div class="grid grid-cols-2 gap-2.5 mb-4">
                    <button onclick="setSleepTimer(15)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">15 Minutes</button>
                    <button onclick="setSleepTimer(30)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">30 Minutes</button>
                    <button onclick="setSleepTimer(45)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">45 Minutes</button>
                    <button onclick="setSleepTimer(60)" class="py-2.5 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">60 Minutes</button>
                </div>
                <div class="flex gap-2">
                    <button onclick="setSleepTimer(0)" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-xs rounded-xl transition-all">Turn Off</button>
                    <button onclick="toggleSleepModal(false)" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all">Cancel</button>
                </div>
            </div>
        </div>

    </div>

    <!-- Script Engine -->
    <script>
        // Early global modal declarations
        window.toggleQualityServerModal = function(force) {
            const modal = document.getElementById('qualityServerModal');
            if (!modal) return;
            const isHidden = modal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) modal.classList.add('hidden');
            else {
                if (typeof closeAllOpenModals === 'function') closeAllOpenModals(false);
                modal.classList.remove('hidden');
                if (typeof updateServerListUI === 'function') updateServerListUI();
            }
        };
        window.toggleSubtitlesModal = function(force) {
            const modal = document.getElementById('subtitlesModal');
            if (!modal) return;
            const isHidden = modal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) modal.classList.add('hidden');
            else {
                if (typeof closeAllOpenModals === 'function') closeAllOpenModals(false);
                modal.classList.remove('hidden');
            }
        };

        const urlParams = new URLSearchParams(window.location.search);
        const MEDIA_ID = urlParams.get('id') || urlParams.get('tmdbId') || '<?php echo addslashes($id); ?>';
        const MEDIA_TYPE = urlParams.get('type') || urlParams.get('media_type') || '<?php echo addslashes($type); ?>' || 'tv';
        let rawTitleFromPhp = '';
        try { rawTitleFromPhp = '<?php echo addslashes($title); ?>'; } catch(e) {}
        const MEDIA_TITLE = urlParams.get('title') || urlParams.get('name') || (rawTitleFromPhp && !rawTitleFromPhp.includes('{{') ? rawTitleFromPhp : 'Anime Presentation');
        let MEDIA_SEASON = parseInt(urlParams.get('s') || urlParams.get('season') || '<?php echo $s; ?>', 10) || 1;
        let MEDIA_EPISODE = parseInt(urlParams.get('e') || urlParams.get('episode') || '<?php echo $e; ?>', 10) || 1;
        const rawMal = urlParams.get('malId') || urlParams.get('mal_id') || urlParams.get('mal') || '<?php echo addslashes($malId); ?>' || '';
        const MAL_ID = rawMal && rawMal !== '{{MAL_ID}}' ? rawMal : '';
        const rawAni = urlParams.get('anilistId') || urlParams.get('anilist_id') || urlParams.get('anilist') || '<?php echo addslashes($anilistId); ?>' || '';
        const ANILIST_ID = rawAni && rawAni !== '{{ANILIST_ID}}' ? rawAni : '';
        let CURRENT_SERVER = urlParams.get('srv') || '<?php echo addslashes($srv); ?>' || 'bing_anime';
        if (CURRENT_SERVER === '{{SRV}}' || !CURRENT_SERVER) CURRENT_SERVER = 'bing_anime';
        let DIRECT_STREAM_URL = urlParams.get('url') || '<?php echo addslashes($directUrl); ?>';
        const SOURCE_ORIGIN = urlParams.get('source') || '<?php echo addslashes($source); ?>' || 'anime.html';

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

        const DEFAULT_SERVERS = [
            { id: 'bing_anime', name: 'Bing Anime (Multi-Audio HLS / Nexa & Ravok Direct)', cc: 'JP' },
            { id: 'hianime', name: 'HiAnime (MegaPlay Anime Scraper)', cc: 'JP' },
            { id: 'animesalt', name: 'AnimeSalt (Special Multi-Audio Anime)', cc: 'JP' },
            { id: 'kisskh', name: 'KissKH (Asian Drama & Anime / Direct HLS)', cc: 'JP' },
            { id: 'asiaflix', name: 'Asiaflix (Vidmoly Multi-Bitrate HLS)', cc: 'KR' },
            { id: 's40', name: 'Aphelion (DarkMatter / 1080p Direct HLS)', cc: 'GL' },
            { id: 'framex', name: 'FrameX TV (Multi-Source 4K/1080p Anime)', cc: 'US' }
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
            } else {
                fetchAndPlayStream(CURRENT_SERVER);
            }

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
                    srv: serverId,
                    malId: MAL_ID || undefined,
                    anilistId: ANILIST_ID || undefined
                };

                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                const streamUrl = data.primaryM3u8 || (data.sources && data.sources.length > 0 ? data.sources[0].url : null);
                if (streamUrl) {
                    showLoading(false);
                    initHlsPlayer(streamUrl);
                    if (data.subtitles) populateSubtitlesList(data.subtitles);
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
            const fallbackOrder = ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'];
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

        function initHlsPlayer(streamUrl) {
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }

            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    capLevelToPlayerSize: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    enableWorker: true,
                    lowLatencyMode: true
                });

                hlsInstance.loadSource(streamUrl);
                hlsInstance.attachMedia(mainVideo);

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    populateQualityLevels(data.levels);
                    if (data.subtitles && data.subtitles.length > 0) {
                        populateSubtitlesList(data.subtitles);
                    }
                    mainVideo.play().catch(() => {
                        mainVideo.muted = true;
                        mainVideo.play().catch(() => {});
                    });
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
                mainVideo.src = streamUrl;
                mainVideo.play().catch(() => {
                    mainVideo.muted = true;
                    mainVideo.play().catch(() => {});
                });
            }
        }

        function populateQualityLevels(levels) {
            const list = document.getElementById('qualityList');
            if (!list || !levels || levels.length === 0) return;

            list.innerHTML = `
                <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left hover:bg-white/10 transition-colors bg-white/15 text-white">
                    <span>Auto (Adaptive)</span>
                    <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                </button>
            `;

            levels.forEach((lvl, idx) => {
                const height = lvl.height || 'HD';
                const btn = document.createElement('button');
                btn.id = 'quality-btn-' + idx;
                btn.className = 'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left text-zinc-300 hover:bg-white/10 transition-colors';
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
                const qParams = `?type=anime&malId=${encodeURIComponent(MAL_ID || '')}&anilistId=${encodeURIComponent(ANILIST_ID || '')}`;
                const res = await fetch(`/api/bingr/servers${qParams}`);
                const data = await res.json();
                if (data.status === 'success' && data.servers && data.servers.length > 0) {
                    availableServers = data.servers.filter(s => ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'].includes(s.id));
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
                    <button onclick="switchServer('${srv.id}')" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-colors ${isSelected ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/10'}">
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
                showToast('Party Mode Ready (Connecting to Sync)');
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
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
            mediaHudOverlay.classList.remove('opacity-100');
            mediaHudOverlay.classList.add('opacity-0', 'pointer-events-none');
        });

        mainVideo.addEventListener('pause', () => {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
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
                b.className = 'speed-btn px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white transition-all';
            });
            if (btnEl) {
                btnEl.className = 'speed-btn px-2 py-1 rounded-md text-[10px] font-bold bg-white text-black transition-all';
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
            window.location.href = `/bingr_player.php?id=${MEDIA_ID}&tmdbId=${MEDIA_ID}&type=tv&title=${encodeURIComponent(MEDIA_TITLE)}&s=${MEDIA_SEASON}&season=${MEDIA_SEASON}&e=${nextEp}&episode=${nextEp}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
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
            if (show || isModalOpen || mainVideo.paused) {
                topControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                bottomControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'default';
            } else {
                topControlsBar.classList.add('opacity-0', 'pointer-events-none');
                bottomControlsBar.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'none';
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

        function switchSubTab(tab) {
            const btnTracks = document.getElementById('subTabTracksBtn');
            const btnVisual = document.getElementById('subTabVisualBtn');
            const contentTracks = document.getElementById('subTabContentTracks');
            const contentVisual = document.getElementById('subTabContentVisual');

            if (tab === 'tracks') {
                btnTracks.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                btnVisual.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white';
                contentTracks.classList.remove('hidden');
                contentVisual.classList.add('hidden');
            } else {
                btnTracks.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white';
                btnVisual.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentTracks.classList.add('hidden');
                contentVisual.classList.remove('hidden');
            }
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

        function populateSubtitlesList(subs) {
            const list = document.getElementById('subtitlesList');
            if (!list || !subs || subs.length === 0) return;

            list.innerHTML = `
                <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left bg-white/15 text-white">
                    <span>Off</span>
                    <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                </button>
            `;

            subs.forEach((sub, idx) => {
                const lang = sub.lang || sub.label || `Track ${idx + 1}`;
                const btn = document.createElement('button');
                btn.className = 'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left text-zinc-300 hover:bg-white/10 transition-colors';
                btn.onclick = () => {
                    loadExternalSubtitle(sub.url, lang);
                    toggleSubtitlesModal(false);
                };
                btn.innerHTML = `<span>${lang}</span>`;
                list.appendChild(btn);
            });

            if (window.lucide) lucide.createIcons();
        }

        function loadExternalSubtitle(url, label) {
            // Remove existing custom tracks
            const existing = mainVideo.querySelectorAll('track');
            existing.forEach(t => t.remove());

            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = label || 'Subtitle';
            track.srclang = 'en';
            track.src = url;
            track.default = true;
            mainVideo.appendChild(track);
            showToast(`Loaded Subtitles: ${label}`);
        }

        function setupSubtitlesUploader() {
            const input = document.getElementById('customSubInput');
            if (!input) return;
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                loadExternalSubtitle(url, file.name);
                toggleSubtitlesModal(false);
            });
        }

        function setSubtitleTrack(trackIdx) {
            if (hlsInstance) {
                hlsInstance.subtitleTrack = trackIdx;
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    mainVideo.textTracks[i].mode = (i === trackIdx) ? 'showing' : 'hidden';
                }
            }
        }

        async function loadMediaHudMetadata() {
            try {
                const endpoint = MEDIA_TYPE === 'tv' ? '/api/bingr/tv/' + MEDIA_ID : '/api/bingr/movie/' + MEDIA_ID;
                const res = await fetch(endpoint);
                const data = await res.json();

                if (data) {
                    if (data.year) document.getElementById('hudYear').textContent = data.year;
                    if (data.rating) document.getElementById('hudRating').querySelector('span').textContent = Number(data.rating).toFixed(1);
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
                        <div onclick="switchMovie(${item.id}, '${item.media_type || MEDIA_TYPE}', '${title.replace(/'/g, "\\'")}')" class="group cursor-pointer space-y-1.5 transition-transform hover:scale-105 active:scale-95">
                            <div class="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-lg">
                                <img src="${thumb}" alt="${title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                                <div class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-amber-500/30 text-amber-300 text-[10px] font-black flex items-center gap-1">
                                    <i data-lucide="star" class="w-2.5 h-2.5 fill-amber-400"></i> ${rating}
                                </div>
                            </div>
                            <div class="space-y-0.5">
                                <h4 class="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors">${title}</h4>
                                <div class="text-[10px] text-zinc-400 uppercase font-semibold">${year} &bull; ${MEDIA_TYPE === 'tv' ? 'TV' : 'MOVIE'}</div>
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

                const seasons = data.seasons.filter(s => s.season_number > 0);
                seasonSelect.innerHTML = seasons.map(s => `
                    <option value="${s.season_number}" ${s.season_number === MEDIA_SEASON ? 'selected' : ''}>Season ${s.season_number} (${s.episode_count} eps)</option>
                `).join('');

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
                        <div onclick="switchEpisode(${seasonNum}, ${ep.episode_number})" class="group cursor-pointer space-y-1.5 transition-transform hover:scale-105 active:scale-95">
                            <div class="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border ${isCurrent ? 'border-red-500 ring-2 ring-red-500/50' : 'border-white/10'} shadow-lg">
                                ${thumb ? `<img src="${thumb}" alt="Ep ${ep.episode_number}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">EP ${ep.episode_number}</div>`}
                                <div class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-black">
                                    EP ${ep.episode_number}
                                </div>
                            </div>
                            <div class="text-[11px] font-bold text-white truncate group-hover:text-red-400 transition-colors">
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
            window.location.href = `/bingr_player.php?id=${MEDIA_ID}&tmdbId=${MEDIA_ID}&type=tv&title=${encodeURIComponent(MEDIA_TITLE)}&s=${season}&season=${season}&e=${episode}&episode=${episode}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        function switchMovie(newId, newType, newTitle) {
            window.location.href = `/bingr_player.php?id=${newId}&tmdbId=${newId}&type=${newType}&title=${encodeURIComponent(newTitle)}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        function switchPlayerMode(mode) {
            playerMode = mode;
            const btnDirect = document.getElementById('btnModeDirect');
            const btnEmbed = document.getElementById('btnModeEmbed');

            if (mode === 'embed') {
                if (hlsInstance) hlsInstance.stopLoad();
                mainVideo.pause();
                mainVideo.classList.add('hidden');
                embedFrame.classList.remove('hidden');
                
                const embedUrl = MEDIA_TYPE === 'tv'
                    ? `https://vidlink.pro/tv/${MEDIA_ID}/${MEDIA_SEASON}/${MEDIA_EPISODE}?autoplay=true`
                    : `https://vidlink.pro/movie/${MEDIA_ID}?autoplay=true`;
                embedFrame.src = embedUrl;
                embedFrame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                embedFrame.setAttribute('allowfullscreen', 'true');

                if (btnDirect) btnDirect.className = 'px-2 py-1 rounded-md text-zinc-400 hover:text-white transition-all';
                if (btnEmbed) btnEmbed.className = 'px-2 py-1 rounded-md bg-white text-black font-extrabold transition-all';
                showToast('Switched to Embed Backup');
            } else {
                embedFrame.classList.add('hidden');
                embedFrame.src = '';
                mainVideo.classList.remove('hidden');
                if (hlsInstance) hlsInstance.startLoad();
                mainVideo.play().catch(() => {});

                if (btnDirect) btnDirect.className = 'px-2 py-1 rounded-md bg-white text-black font-extrabold transition-all';
                if (btnEmbed) btnEmbed.className = 'px-2 py-1 rounded-md text-zinc-400 hover:text-white transition-all';
                showToast('Switched to Direct 4K Stream');
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
            burst.classList.add('opacity-100', 'scale-100');
            setTimeout(() => {
                burst.classList.remove('opacity-100', 'scale-100');
                burst.classList.add('opacity-0', 'scale-75');
            }, 400);
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
                document.getElementById('fullscreenIcon').setAttribute('data-lucide', 'minimize');
            } else {
                document.exitFullscreen().catch(() => {});
                document.getElementById('fullscreenIcon').setAttribute('data-lucide', 'maximize');
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

        // Recursively unwrap nested proxy wrappers to reach the genuine raw CDN stream
        function unwrapRawStreamUrl(inputUrl) {
            if (!inputUrl) return { rawUrl: '', referer: '' };
            let current = inputUrl.trim();
            let referer = '';
            let depth = 0;

            while (depth++ < 10) {
                if (!current) break;
                let unwrapped = false;
                try {
                    const parseTarget = current.startsWith('http://') || current.startsWith('https://')
                        ? current
                        : (window.location.origin + (current.startsWith('/') ? '' : '/') + current);
                    const parsed = new URL(parseTarget);

                    const isProxy = 
                        parsed.pathname.includes('/stream_proxy.php') ||
                        parsed.pathname.includes('/proxy/m3u8') ||
                        parsed.pathname.includes('/api/proxy') ||
                        parsed.hostname.includes('filmu.in') ||
                        parsed.hostname.includes('wormhole');

                    const inner = parsed.searchParams.get('url');
                    if (inner && (isProxy || inner.startsWith('http://') || inner.startsWith('https://'))) {
                        current = decodeURIComponent(inner);
                        unwrapped = true;

                        const ref = parsed.searchParams.get('referer') || parsed.searchParams.get('ref');
                        if (ref) referer = decodeURIComponent(ref);

                        const hdrs = parsed.searchParams.get('headers');
                        if (hdrs) {
                            try {
                                const parsedHeaders = JSON.parse(decodeURIComponent(hdrs));
                                if (parsedHeaders.Referer || parsedHeaders.referer) {
                                    referer = parsedHeaders.Referer || parsedHeaders.referer;
                                }
                            } catch (_) {}
                        }
                    }
                } catch(e) {
                    break;
                }
                if (!unwrapped) break;
            }

            // Default known CDN referrers if not explicitly attached
            if (!referer) {
                const lower = current.toLowerCase();
                if (lower.includes('ravok.buzz') || lower.includes('animesalt')) {
                    referer = 'https://animesalt.cx/';
                } else if (lower.includes('megaplay') || lower.includes('megacloud')) {
                    referer = 'https://megaplay.buzz/';
                } else if (lower.includes('darkmatter') || lower.includes('fetchbox') || lower.includes('bingr.one')) {
                    referer = 'https://bingr.one/';
                }
            }

            return { rawUrl: current, referer };
        }

        // M3U Copy Engine (Unlocked via secret shortcut or Key U)
        function copyM3uPlaylist(event) {
            if (event) event.stopPropagation();

            let candidateUrl = window.bingrActiveStreamUrl || (typeof DIRECT_STREAM_URL !== 'undefined' ? DIRECT_STREAM_URL : '');
            if (!candidateUrl || candidateUrl === '{{URL}}' || candidateUrl === '') {
                candidateUrl = window.location.origin + '/api/play_stream/' + (typeof MEDIA_ID !== 'undefined' ? MEDIA_ID : '1');
            }

            const { rawUrl, referer } = unwrapRawStreamUrl(candidateUrl);
            const finalStreamUrl = rawUrl || candidateUrl;

            const title = (typeof MEDIA_TITLE !== 'undefined' && MEDIA_TITLE) ? MEDIA_TITLE : 'Bingr Stream';
            const id = (typeof MEDIA_ID !== 'undefined' && MEDIA_ID) ? MEDIA_ID : 'bingr';
            const group = 'Anime';

            let m3uContent = `#EXTM3U\n`;
            m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" group-title="${group}",${title}\n`;
            if (referer) {
                m3uContent += `#EXTVLCOPT:http-referrer=${referer}\n`;
                m3uContent += `#EXTHTTP:{"Referer":"${referer}"}\n`;
            }
            m3uContent += `${finalStreamUrl}\n`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(m3uContent).then(() => {
                    if (typeof showToast === 'function') showToast('Raw M3U Playlist copied to clipboard!');
                    else alert('Raw M3U Playlist copied to clipboard!');
                }).catch(() => {
                    fallbackCopyText(m3uContent);
                });
            } else {
                fallbackCopyText(m3uContent);
            }
        }

        function fallbackCopyText(text) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            ta.style.pointerEvents = 'none';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                if (typeof showToast === 'function') showToast('Raw M3U Playlist copied to clipboard!');
                else alert('Raw M3U Playlist copied to clipboard!');
            } catch(err) {
                if (typeof showToast === 'function') showToast('Failed to copy M3U playlist');
            }
            document.body.removeChild(ta);
        }

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            switch (e.code) {
                case 'KeyU':
                    copyM3uPlaylist(e);
                    break;
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
    <script src="/party-mode.js?v=7.0"></script>
</body>
</html>
