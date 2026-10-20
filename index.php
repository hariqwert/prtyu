<?php
require_once 'stalker_api.php';
global $SCARLET_WITCH;
$has_playlists = false;
$playlists_file = $DARK_SIDE . "/m3u_playlists.json";
if (file_exists($playlists_file)) {
    $list = json_decode(file_get_contents($playlists_file), true);
    if (is_array($list) && count($list) > 0) {
        $has_playlists = true;
    }
}
if (!file_exists($DARK_SIDE . "/login.stalker") && !$has_playlists) {
    // Public dashboard, no redirect needed
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#dc2626">
    <meta name="description" content="Stalker Pro & Aetheris - Next-generation entertainment, IPTV, VOD, and Watch Together platform">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <title>AETHERIS | Quantum Live Broadcast Nexus</title>
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
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .mask-blur { filter: blur(3px); opacity: 0.8; user-select: none; pointer-events: none; transition: all 0.3s ease; }
        body.unmasked .mask-blur { filter: blur(0); opacity: 1; user-select: text; pointer-events: auto; }
        /* Premium Shimmer Animation */
        .skeleton {
            position: relative;
            overflow: hidden;
            background-color: #0d1117;
            /* Dark background to match your theme */
        }
        .skeleton::after {
            content: "";
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(90deg,
                    rgba(255, 255, 255, 0) 0,
                    rgba(255, 255, 255, 0.03) 20%,
                    rgba(255, 255, 255, 0.07) 50%,
                    rgba(255, 255, 255, 0.03) 80%,
                    rgba(255, 255, 255, 0) 100%);
            animation: shimmer 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes shimmer {
            100% {
                transform: translateX(100%);
            }
        }
        body {
            background: #010409;
            color: #f8fafc;
            min-height: 100vh;
            overflow-x: hidden;
            -webkit-tap-highlight-color: transparent;
        }
        /* Smooth Scrollbar */
        ::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #1e293b;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #ef4444;
        }
        .glass-nav {
            background: #000000;
            border-bottom: 2px solid #ef4444;
        }
        /* Animation Keyframes */
        @keyframes cardEntrance {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
                filter: blur(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0);
            }
        }
        @keyframes gridFade {
            from {
                opacity: 0;
                filter: grayscale(1) blur(5px);
            }
            to {
                opacity: 1;
                filter: grayscale(0) blur(0);
            }
        }
        .channel-entrance {
            opacity: 0;
            animation: cardEntrance 0.6s cubic-bezier(0.2, 1, 0.2, 1) forwards;
        }
        .grid-fade-in {
            animation: gridFade 0.5s ease-out forwards;
        }
        /* Genre Adaptive Layout */
        .genre-container-wrapper {
            display: flex;
            overflow-x: auto;
            scrollbar-width: none;
            padding: 0.5rem 1rem;
            gap: 0.5rem;
        }
        .genre-container-wrapper::-webkit-scrollbar {
            display: none;
        }
        /* Generic No Scrollbar Utility */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .genre-item {
            white-space: nowrap;
            padding: 0.6rem 1.2rem;
            color: #fff;
            border-radius: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            background: #000;
            border: 1px solid #ef4444;
        }
        .genre-item.active {
            color: #fff;
            background: #ef4444;
            border-color: #ef4444;
            box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
        }
        @media (min-width: 1024px) {
            .genre-container-wrapper {
                flex-direction: column;
                position: sticky;
                top: 110px;
                height: calc(100vh - 150px);
                overflow-y: auto;
                padding: 0;
            }
            .genre-item {
                background: transparent;
                border: none;
                margin-bottom: 4px;
            }
            .genre-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }
        }
        .channel-card {
            background: #0d1117;
            border-radius: 1.5rem;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.04);
            transition: all 0.4s ease;
        }
        .channel-card:hover {
            border-color: #3b82f6;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }
        .vault-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
        }
        .vault-card:hover {
            background: rgba(59, 130, 246, 0.08);
            border-color: rgba(59, 130, 246, 0.3);
        }
        .skeleton {
            background: linear-gradient(90deg, #0d1117 25%, #161b22 50%, #0d1117 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        @keyframes loading {
            0% {
                background-position: 200% 0;
            }
            100% {
                background-position: -200% 0;
            }
        }
        /* Ensure the grid doesn't squash cards */
        #channelGrid {
            grid-auto-rows: 1fr;
        }
        .channel-card img {
            /* This prevents the "stretched" look seen in your Gulf War logos */
            pointer-events: none;
            user-select: none;
        }
        /* Optional: If many logos have white backgrounds, this helps them blend */
        .channel-card img.relative {
            filter: brightness(0.9) contrast(1.1);
        }
        .channel-card:hover img.relative {
            filter: brightness(1.1) contrast(1.1);
        }
        /* Smooth out the container for the logo */
        .channel-card .aspect-square {
            border-top-left-radius: 1.5rem;
            border-top-right-radius: 1.5rem;
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
    <link rel="icon" type="image/png" href="stalker_pro_infinity.svg">
</head>
<body class="bg-black text-white">

    <div id="portalModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in">
        <div class="w-full max-w-xl rounded-[2.5rem] p-8 border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">
            <div id="vaultListView">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-white">Identity Vault</h2>
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Select a stored handshake</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <a href="login.php" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 hover:text-white text-red-400 text-xs font-bold transition-all border border-red-500/20">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add New
                        </a>
                        <button onclick="togglePortalModal(false)" class="p-2 text-slate-500 hover:text-white transition-colors"><i data-lucide="x"></i></button>
                    </div>
                </div>
                <div id="portalList" class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"></div>
            </div>
            <div id="vaultDetailView" class="hidden animate-in slide-in-from-right-10">
                <div class="flex justify-between items-center mb-6">
                    <button onclick="backToVaultList()" class="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase hover:text-white transition-all">
                        <i data-lucide="chevron-left" class="w-4 h-4"></i> Back to Vault
                    </button>
                    <button id="vaultEditBtn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase border border-white/5 transition-all">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit Portal
                    </button>
                </div>
                <div id="portalDetailContent" class="grid grid-cols-1 gap-3 bg-black/20 p-5 rounded-3xl border border-white/5"></div>
                <div id="portalEditForm" class="hidden space-y-4 bg-black/20 p-5 rounded-3xl border border-white/5 text-left">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Portal URL</label>
                        <input id="editPortalUrl" type="text" class="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 transition-colors w-full font-mono">
                    </div>
                    <div id="editPortalXtreamFields" class="hidden space-y-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Username</label>
                            <input id="editPortalUsername" type="text" class="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 transition-colors w-full font-mono">
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Password (Leave blank to keep unchanged)</label>
                            <input id="editPortalPassword" type="password" class="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 transition-colors w-full font-mono" placeholder="••••••••">
                        </div>
                    </div>
                    <button id="savePortalEditBtn" class="w-full mt-4 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-wider transition-all">
                        Save Stored Credentials
                    </button>
                </div>
                <button id="activatePortalBtn" class="w-full mt-8 py-5 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/30">
                    Switch Identity Now
                </button>
            </div>
            <button onclick="togglePortalModal(false)" id="vaultCloseBtn" class="w-full mt-8 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 transition-all">Dismiss</button>
        </div>
    </div>
    <!-- Beautiful Sleep Mode Screen Overlay -->
    <div id="sleepModeScreen" class="fixed inset-0 bg-black/95 z-[9999] hidden flex flex-col items-center justify-center transition-all duration-700 opacity-0 pointer-events-none">
        <div class="text-center space-y-8 p-8 max-w-md w-full scale-95 transition-all duration-700" id="sleepContainer">
            <!-- Pulsing ambient light behind a moon/clock icon -->
            <div class="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center bg-teal-500/10 rounded-full border border-teal-500/25 animate-pulse shadow-2xl shadow-teal-500/10">
                <i data-lucide="moon" class="w-10 h-10 text-teal-400"></i>
            </div>
            <div class="space-y-2">
                <p class="text-[10px] font-black tracking-[0.3em] text-teal-500 uppercase">System Sleep Mode</p>
                <h2 class="text-6xl font-black text-slate-100 tracking-tighter" id="sleepScreenTime">00:00:00</h2>
                <p class="text-xs text-slate-500 uppercase tracking-widest font-bold" id="sleepScreenDate">Sunday, June 2</p>
            </div>
            <div class="pt-6 flex flex-col items-center gap-4">
                <button onclick="toggleAppSleep(false)" class="px-8 py-3.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-teal-600/20 active:scale-95">
                    Wake Up System
                </button>
                <a href="/music.html" class="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-wider transition-all">
                    <i data-lucide="music" class="w-3 h-3"></i>
                    Music Hub
                </a>
            </div>
        </div>
    </div>
    <!-- Music Player Modal -->
    <div id="musicModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in">
        <div class="w-full max-w-md rounded-[2rem] p-6 border border-white/10 bg-[#0d1117]/95 shadow-2xl relative">
            <div class="flex items-center justify-between mb-5">
                <div class="flex flex-col">
                    <h3 class="text-xl font-black text-white tracking-tight uppercase">Ambient Lounge</h3>
                    <p class="text-[10px] uppercase font-bold text-teal-400 tracking-wider mt-0.5">Stalker Pro Music</p>
                </div>
                <div class="flex items-center gap-1">
                    <button class="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full" title="Menu">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                    </button>
                    <button onclick="toggleMusicPlayer(false)" class="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full" title="Close"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="flex gap-2 mb-5">
                <input type="text" id="musicSearchIndex" placeholder="Search track, artist, or paste JioSaavn link..." class="flex-1 bg-black/50 border border-white/10 rounded-2xl py-3 px-4 text-xs font-semibold text-white outline-none focus:border-teal-500 transition-colors placeholder:text-gray-500" onkeydown="if(event.key === 'Enter') searchMusicIndex()">
                <button onclick="searchMusicIndex()" class="bg-teal-400 hover:bg-teal-300 w-10 h-10 rounded-full font-bold transition-all transform active:scale-95 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>
            </div>
            <div class="flex gap-1.5 mb-5 overflow-x-auto custom-scrollbar py-1">
                <button onclick="showPlaylistsManager()" class="whitespace-nowrap bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider hover:bg-teal-500/20">Playlists</button>
                <button onclick="searchMusicIndex('Lofi Chill')" class="whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10">Lofi Chill</button>
                <button onclick="searchMusicIndex('Top Hits')" class="whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10">Top Hits</button>
                <button onclick="searchMusicIndex('Arijit Singh')" class="whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10">Arijit Singh</button>
                <button onclick="searchMusicIndex('Synthwave')" class="whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10">Synthwave</button>
            </div>
            <div id="musicResultsIndex" class="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar hidden -mx-1 px-1"></div>
            <!-- Custom Audio Player Interface -->
            <div id="playerContainerIndex" class="hidden mt-5 pt-5 border-t border-white/10">
                <div class="relative h-12 w-full bg-black/40 rounded-xl overflow-hidden border border-white/5 mb-4">
                    <canvas id="visualizerCanvasIndex" class="absolute inset-0 w-full h-full"></canvas>
                </div>
                <div class="flex items-center gap-3 mb-4">
                    <img id="nowPlayingImgIndex" src="" class="w-12 h-12 rounded-xl object-cover bg-black/50 shadow-md border border-white/5">
                    <div class="flex-1 min-w-0">
                        <div id="nowPlayingTitleIndex" class="text-sm font-bold text-white truncate text-left tracking-tight"></div>
                        <div id="nowPlayingArtistIndex" class="text-[10px] font-bold text-gray-500 truncate text-left uppercase mt-0.5 tracking-wider"></div>
                    </div>
                </div>
                <audio id="audioPlayerIndex" class="hidden" autoplay></audio>
                <div class="space-y-3">
                    <!-- Progress Bar & Time -->
                    <div class="flex items-center gap-2.5">
                        <span id="currentTimeIndex" class="text-[9px] font-bold text-gray-500 w-6 text-left">0:00</span>
                        <div id="progressBarContainerIndex" class="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group" onclick="seekAudioIndex(event)">
                            <div id="progressBarIndex" class="h-full bg-teal-400 rounded-full w-0 transition-all duration-100 group-hover:bg-teal-300"></div>
                        </div>
                        <span id="durationTimeIndex" class="text-[9px] font-bold text-gray-500 w-6 text-right">0:00</span>
                    </div>
                    <!-- Actions -->
                    <div class="flex items-center justify-between px-3 mt-1">
                        <button onclick="playPrevTrackIndex()" class="p-2 text-slate-400 hover:text-white transition-colors focus:outline-none" title="Previous">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="playPauseBtnIndex" onclick="togglePlayPauseIndex()" class="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-all transform active:scale-95 focus:outline-none shadow-lg">
                            <svg id="playIconIndex" class="w-4 h-4 ml-0.5 hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <svg id="pauseIconIndex" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                        <button onclick="playNextTrackIndex()" class="p-2 text-slate-400 hover:text-white transition-colors focus:outline-none" title="Next">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6zm9-12h2v12h-2z"/></svg>
                        </button>
                        <a id="downloadBtnIndex" href="#" download class="p-2 text-teal-400 hover:text-white transition-colors focus:outline-none" title="Download Track" target="_blank">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Adaptive Mobile Music Player Container (Invisible when not playing) -->
    <div id="mobileMusicContainerIndex" class="hidden fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-80 z-50 bg-[#0d1117]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-2.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 transition-all">
        <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onclick="toggleMusicPlayer(true)">
            <img id="mobileNowPlayingImgIndex" src="" class="w-10 h-10 rounded-xl object-cover bg-black/60 border border-white/10 flex-shrink-0" alt="Cover">
            <div class="min-w-0 flex-1">
                <div id="mobileNowPlayingTitleIndex" class="text-xs font-bold text-white truncate">Playing Music</div>
                <div id="mobileNowPlayingArtistIndex" class="text-[9px] font-bold text-teal-400 uppercase tracking-wider truncate">Stalker Audio</div>
            </div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="playPrevTrackIndex()" class="p-2 text-slate-400 hover:text-white transition-all active:scale-90" title="Previous">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button onclick="togglePlayPauseIndex()" class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center transition-all active:scale-90 shadow-md" title="Play/Pause">
                <svg id="mobilePlayPauseIconIndex" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button onclick="playNextTrackIndex()" class="p-2 text-slate-400 hover:text-white transition-all active:scale-90" title="Next">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6zm9-12h2v12h-2z"/></svg>
            </button>
            <button onclick="playerIndex.pause();" class="p-1.5 text-slate-500 hover:text-white transition-colors" title="Close">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    </div>
    <!-- Subtitle Search Modal -->
    <div id="subtitleModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in">
        <div class="w-full max-w-xl rounded-[2.5rem] p-8 border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div class="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h2 class="text-2xl font-black text-white">Subtitle Search</h2>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">MSone Subtitles</p>
                </div>
                <button onclick="toggleSubtitleModal(false)" class="p-2 text-slate-500 hover:text-white transition-colors"><i data-lucide="x"></i></button>
            </div>
            <div class="relative mb-6 shrink-0">
                <input type="text" id="subtitleSearchInput" placeholder="Search for movies..." 
                    class="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                    onkeydown="if(event.key === 'Enter') searchSubtitles()">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"></i>
                <button onclick="searchSubtitles()" class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all">Search</button>
            </div>
            <div id="subtitleLoading" class="hidden shrink-0 flex justify-center py-8">
                <div class="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <div id="subtitleResults" class="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                <!-- Results will be injected here -->
            </div>
            <button onclick="toggleSubtitleModal(false)" class="w-full mt-6 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 transition-all shrink-0">Dismiss</button>
        </div>
    </div>
    <!-- M3U Playlists Manager Modal -->
    <div id="m3uModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in">
        <div class="w-full max-w-xl rounded-[2.5rem] p-8 border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">
            <!-- Playlist List View -->
            <div id="m3uPlaylistListView">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-white">M3U Playlists</h2>
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Manage and switch playlists</p>
                    </div>
                    <button onclick="toggleM3UModal(false)" class="p-2 text-slate-500 hover:text-white transition-colors"><i data-lucide="x"></i></button>
                </div>
                <div id="m3uList" class="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"></div>
                <button onclick="showM3UAddView()" class="w-full mt-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2">
                    <i data-lucide="plus-circle" class="w-5 h-5"></i> Add New M3U Playlist
                </button>
            </div>
            <!-- Add Playlist View -->
            <div id="m3uAddPlaylistView" class="hidden animate-in slide-in-from-right-10">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-white">Add M3U Playlist</h2>
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Import from URL or upload a file</p>
                    </div>
                    <button onclick="backToM3UList()" class="p-2 text-slate-500 hover:text-white transition-colors"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Playlist Name</label>
                        <input type="text" id="m3uName" placeholder="e.g. My Favorite Channels" class="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 mt-1 text-sm outline-none focus:border-indigo-500 text-white transition-colors">
                    </div>
                    <div>
                        <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Import Method</label>
                        <div class="flex gap-2 mt-1">
                            <button onclick="setM3UMethod('url')" id="methodBtnUrl" class="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition-all border border-indigo-500">M3U URL</button>
                            <button onclick="setM3UMethod('file')" id="methodBtnFile" class="flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold transition-all border border-white/5">File Upload</button>
                        </div>
                    </div>
                    <div id="m3uUrlGroup">
                        <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">M3U Playlist URL</label>
                        <input type="text" id="m3uUrl" placeholder="https://example.com/playlist.m3u" class="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 mt-1 text-sm outline-none focus:border-indigo-500 text-white transition-colors">
                    </div>
                    <div id="m3uFileGroup" class="hidden">
                        <label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">M3U File Upload</label>
                        <div id="m3uDropZone" class="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer mt-1 bg-black/10 transition-colors">
                            <i data-lucide="upload-cloud" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
                            <p class="text-xs font-bold text-slate-400">Click to upload or drag & drop</p>
                            <p class="text-[9px] text-slate-600 mt-1 uppercase">.m3u, .m3u8 files up to 10MB</p>
                            <input type="file" id="m3uFileInput" accept=".m3u,.m3u8" class="hidden">
                        </div>
                        <div id="m3uFileInfo" class="hidden mt-2 p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i data-lucide="file-text" class="w-4 h-4 text-indigo-400"></i>
                                <span id="m3uFileName" class="text-xs font-bold text-slate-300 truncate max-w-[200px]">filename.m3u</span>
                            </div>
                            <button onclick="clearM3UFile()" class="text-[10px] uppercase font-black text-red-400 hover:text-white transition-colors">Remove</button>
                        </div>
                    </div>
                    <div class="mt-4">
                        <label class="text-[8px] font-black text-rose-500 uppercase tracking-widest">Security Password *</label>
                        <input type="password" id="m3uPassword" placeholder="Enter System Password" class="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 mt-1 text-sm outline-none focus:border-rose-500 text-white transition-colors">
                    </div>
                </div>
                <div class="flex gap-3 mt-8">
                    <button onclick="backToM3UList()" class="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all text-xs uppercase tracking-wider">Cancel</button>
                    <button onclick="saveM3UPlaylist()" id="saveM3UBtn" class="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-500 transition-all text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/15">Import Playlist</button>
                </div>
            </div>
            <button onclick="toggleM3UModal(false)" id="m3uCloseBtn" class="w-full mt-6 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 transition-all">Dismiss</button>
        </div>
    </div>
    <!-- Series Details & Episodes Modal -->
    <div id="seriesDetailsModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in">
        <div class="w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/10 bg-[#0d1117] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div class="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h3 class="text-xl font-black text-white tracking-tighter">SERIES CORNER</h3>
                    <p class="text-[10px] uppercase font-bold text-red-500 tracking-widest mt-1">Seasons & Episodes Explorer</p>
                </div>
                <button onclick="toggleSeriesDetailsModal(false)" class="p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div id="seriesDetailsContent" class="overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2"></div>
            <button onclick="toggleSeriesDetailsModal(false)" class="w-full mt-6 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 transition-all shrink-0">Close Explorer</button>
        </div>
    </div>
    <header class="glass-nav sticky top-0 z-[60] px-4 py-3 md:px-10">
        <div class="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <a href="/hero.html" class="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl border border-red-500/20 hover:border-transparent transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg shadow-red-600/5" title="Back to Hero Hub">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </a>
                <div class="flex items-center gap-3 group cursor-pointer" onclick="location.reload()">
                    <div class="w-10 h-10 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-center p-1 shadow-[0_0_20px_rgba(0,245,212,0.3)] group-hover:scale-105 transition-all backdrop-blur-md">
                        <img src="/stalker_pro_infinity.svg" class="w-full h-full object-contain" alt="Aetheris">
                    </div>
                    <div class="flex flex-col">
                        <h1 class="text-base font-black uppercase tracking-widest flex items-center bg-gradient-to-r from-white via-zinc-200 to-cyan-300 bg-clip-text text-transparent font-mono leading-none">AETHERIS <span class="text-cyan-400 italic ml-1.5 text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 font-sans">NEXUS</span></h1>
                        <span class="text-[8px] font-mono tracking-widest text-zinc-500 uppercase mt-0.5">QUANTUM BROADCAST CONTINUUM</span>
                    </div>
                </div>
            </div>
            <div class="flex-1 max-w-md hidden md:flex items-center bg-white/5 border border-white/5 p-1 rounded-2xl focus-within:border-red-500/40 transition-all">
                <i data-lucide="search" class="w-4 h-4 ml-4 text-slate-500"></i>
                <input type="text" id="searchInput" placeholder="Find a channel..." class="w-full bg-transparent py-2 px-3 text-sm outline-none">
            </div>
            <div class="flex items-center gap-4">
                <!-- SCARLET_WITCH Dynamic Message Box -->
                <div class="hidden lg:block text-right font-bold text-xs" id="dynamicMessage">
                </div>
                <!-- Desktop Action Button Bar (hidden on mobile) -->
                <div class="hidden md:flex items-center gap-2">
                    <button onclick="window.tvRemoteNavigation?.toggle()" class="p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all" title="TV Remote 10-foot Couch Navigation (Shortcut: F2)">
                        <i data-lucide="tv" class="w-5 h-5"></i>
                    </button>
                    <button onclick="window.startCastSession ? window.startCastSession() : alert('Connect stream to cast')" class="p-3 bg-cyan-600/10 text-cyan-400 rounded-2xl border border-cyan-500/20 hover:bg-cyan-600 hover:text-white transition-all" title="Chromecast & AirPlay">
                        <i data-lucide="cast" class="w-5 h-5"></i>
                    </button>
                    <button onclick="toggleSubtitleModal(true)" class="p-3 bg-blue-600/10 text-blue-400 rounded-2xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all" title="Subtitles Search">
                        <i data-lucide="subtitles" class="w-5 h-5"></i>
                    </button>
                    <button onclick="toggleMusicPlayer()" class="p-3 bg-fuchsia-600/10 text-fuchsia-400 rounded-2xl border border-fuchsia-500/20 hover:bg-fuchsia-600 hover:text-white transition-all" title="Premium Music Station">
                        <i data-lucide="music" id="musicToggleIcon" class="w-5 h-5"></i>
                    </button>
                    <a href="/music.html" class="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all" title="Open Music Hub">
                        <i data-lucide="headphones" class="w-5 h-5"></i>
                    </a>
                    <a href="/consumet.html" class="p-3 bg-amber-600/10 text-amber-400 rounded-2xl border border-amber-500/20 hover:bg-amber-600 hover:text-white transition-all" title="Stremio & VidSrc Embeds">
                        <i data-lucide="film" class="w-5 h-5"></i>
                    </a>
                    <a href="/books.html" class="p-3 bg-orange-600/10 text-orange-400 rounded-2xl border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all" title="Stalker E-Book Reader & Kindle Library">
                        <i data-lucide="book-open" class="w-5 h-5"></i>
                    </a>
                    <button onclick="toggleAppSleep()" class="p-3 bg-teal-600/10 text-teal-400 rounded-2xl border border-teal-500/20 hover:bg-teal-600 hover:text-white transition-all" title="Sleep / Off Mode">
                        <i data-lucide="power" class="w-5 h-5"></i>
                    </button>
                    <button onclick="openM3UModal()" class="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all" title="M3U Playlists (Shortcut: M)">
                        <i data-lucide="list-video" class="w-5 h-5"></i>
                    </button>
                    <button onclick="fetchSavedPortals()" class="p-3 bg-red-600/10 text-red-400 rounded-2xl border border-red-500/20 hover:bg-red-600 hover:text-white transition-all" title="Identity Vault (Shortcut: V)">
                        <i data-lucide="layers" class="w-5 h-5"></i>
                    </button>
                </div>
                <!-- Compact Sleep toggle always visible on top right for mobile -->
                <button onclick="toggleAppSleep()" class="flex md:hidden p-2.5 bg-teal-600/10 text-teal-400 rounded-xl border border-teal-500/20 hover:bg-teal-600 hover:text-white transition-all" title="Sleep / Off Mode">
                    <i data-lucide="power" class="w-4.5 h-4.5"></i>
                </button>
            </div>
        </div>
        <!-- Mobile Optimized Secondary Section (Search + Horizontally Scrollable Toolbelt) -->
        <div class="md:hidden mt-3 space-y-3">
            <!-- Mobile Search Bar -->
            <div class="flex items-center bg-white/5 border border-white/5 p-1 rounded-xl focus-within:border-red-500/40 transition-all">
                <i data-lucide="search" class="w-4 h-4 ml-3 text-slate-500"></i>
                <input type="text" id="mobileSearch" placeholder="Search channels..." class="w-full bg-transparent py-1.5 px-3 text-xs outline-none text-slate-200">
            </div>
            <!-- Scrollable quick actions belt (perfect for mobile touch targets) -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 -mx-4 sm:mx-0">
                <div class="flex items-center gap-2 px-4">
                    <button onclick="toggleSubtitleModal(true)" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-blue-600/10 text-blue-400 text-[11px] font-bold rounded-xl border border-blue-500/10 hover:bg-blue-600 hover:text-white transition-all">
                        <i data-lucide="subtitles" class="w-3.5 h-3.5"></i> Subtitles
                    </button>
                    <button onclick="toggleMusicPlayer()" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-fuchsia-600/10 text-fuchsia-400 text-[11px] font-bold rounded-xl border border-fuchsia-500/10 hover:bg-fuchsia-600 hover:text-white transition-all">
                        <i data-lucide="music" class="w-3.5 h-3.5"></i> Music Station
                    </button>
                    <a href="/music.html" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-indigo-600/10 text-indigo-400 text-[11px] font-bold rounded-xl border border-indigo-500/10 hover:bg-indigo-600 hover:text-white transition-all">
                        <i data-lucide="headphones" class="w-3.5 h-3.5"></i> Music Hub
                    </a>
                    <a href="/consumet.html" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-amber-600/10 text-amber-400 text-[11px] font-bold rounded-xl border border-amber-500/10 hover:bg-amber-600 hover:text-white transition-all">
                        <i data-lucide="film" class="w-3.5 h-3.5"></i> Cinema
                    </a>
                    <a href="/books.html" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-orange-600/10 text-orange-400 text-[11px] font-bold rounded-xl border border-orange-500/10 hover:bg-orange-600 hover:text-white transition-all">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Books
                    </a>
                    <button onclick="openM3UModal()" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-indigo-600/10 text-indigo-400 text-[11px] font-bold rounded-xl border border-indigo-500/10 hover:bg-indigo-600 hover:text-white transition-all">
                        <i data-lucide="list-video" class="w-3.5 h-3.5"></i> Playlists
                    </button>
                    <button onclick="fetchSavedPortals()" class="flex items-center gap-1.5 shrink-0 px-3 py-2 bg-red-600/10 text-red-400 text-[11px] font-bold rounded-xl border border-red-500/10 hover:bg-red-600 hover:text-white transition-all">
                        <i data-lucide="layers" class="w-3.5 h-3.5"></i> Portals
                    </button>
                </div>
            </div>
        </div>
        <!-- Mobile View for System Messages -->
        <div class="block lg:hidden mt-2 text-center text-[11px] font-medium">
        </div>
    </header>
    <!-- Public Maintenance Countdown Timer Banner -->
    <div id="maintenanceScheduleBanner" class="hidden max-w-screen-2xl mx-auto px-4 md:px-10 mt-3">
        <div class="bg-gradient-to-r from-amber-950/80 via-orange-950/80 to-red-950/80 border border-amber-500/40 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3 text-white animate-in slide-in-from-top">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <i data-lucide="clock" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded font-mono border border-amber-500/30">MAINTENANCE SCHEDULED</span>
                        <span id="maintNoticeText" class="text-xs font-bold text-slate-100">Scheduled server upgrades incoming</span>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-0.5">Please conclude active streams before the maintenance window begins.</p>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <div class="bg-black/60 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-center">
                    <span class="block text-[8px] uppercase font-bold text-amber-400 tracking-wider">STARTS IN</span>
                    <span id="maintCountdownTimer" class="text-xs font-mono font-black text-amber-200">--:--:--</span>
                </div>
            </div>
        </div>
    </div>
    <!-- Live Status Bar -->
    <div id="liveStatusBar" class="hidden bg-[#0a0d14] border-b border-white/5 py-3 px-4 md:px-10 text-xs font-bold text-slate-400 select-none">
        <div class="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" id="statusDot"></span>
                <span id="statusPortalName" class="text-white uppercase font-black tracking-tight truncate max-w-[200px]">Active Portal</span>
                <span class="text-slate-700 font-normal shrink-0">|</span>
                <span id="statusUrl" class="font-mono text-[10px] text-slate-500 truncate max-w-[300px]">http://example.com</span>
            </div>
            <div class="flex items-center gap-4 text-[11px] uppercase tracking-wider">
                <span id="statusConnections" class="text-slate-300">Connections: --/--</span>
                <span id="statusType" class="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-black text-slate-400 border border-white/5">STALKER</span>
            </div>
        </div>
    </div>
    <div class="lg:hidden mt-2 border-b border-white/5 pb-2">
        <div id="genreContainerMobile" class="genre-container-wrapper"></div>
    </div>
    <div class="max-w-[1800px] mx-auto mt-4 lg:mt-12 px-4 md:px-10 flex flex-col lg:flex-row gap-10">
        <aside class="hidden lg:block w-64 shrink-0">
            <h3 class="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 px-4">Categories</h3>
            <div id="genreContainerDesktop" class="genre-container-wrapper"></div>
        </aside>
        <div class="flex-1">
            <!-- Media Type Selector for Xtream Portals -->
            <div id="mediaTypeSelector" class="hidden flex gap-2 mb-8 border-b border-white/5 pb-4 overflow-x-auto no-scrollbar">
                <button onclick="setMediaType('live')" id="mediaTab_live" class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-wider transition-all border border-red-500/20 shadow-lg shadow-red-600/10">
                    <i data-lucide="tv" class="w-4 h-4"></i> Live TV
                </button>
                <button onclick="setMediaType('movie')" id="mediaTab_movie" class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 text-slate-400 text-xs font-black uppercase tracking-wider transition-all border border-white/5 hover:bg-white/10">
                    <i data-lucide="clapperboard" class="w-4 h-4"></i> Movies (VOD)
                </button>
                <button onclick="setMediaType('series')" id="mediaTab_series" class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 text-slate-400 text-xs font-black uppercase tracking-wider transition-all border border-white/5 hover:bg-white/10">
                    <i data-lucide="film" class="w-4 h-4"></i> TV Series
                </button>
            </div>
            <!-- Quick Access Sections -->
            <div id="quickAccess" class="hidden mb-12 space-y-10">
                <!-- Favorites -->
                <div id="favoritesSection" class="hidden">
                    <div class="flex items-center justify-between mb-5 px-2">
                        <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span> ⭐ Favorite Channels
                        </h3>
                        <button onclick="clearQuickAccess('favorites')" class="text-[9px] font-bold text-slate-600 hover:text-red-500 transition-colors uppercase tracking-widest">Clear All</button>
                    </div>
                    <div id="favoritesList" class="flex gap-5 overflow-x-auto no-scrollbar pb-4 scroll-smooth"></div>
                </div>
                <!-- Recents -->
                <div id="recentsSection" class="hidden">
                    <div class="flex items-center justify-between mb-5 px-2">
                        <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> 🕒 Recently Played
                        </h3>
                        <button onclick="clearQuickAccess('recents')" class="text-[9px] font-bold text-slate-600 hover:text-blue-500 transition-colors uppercase tracking-widest">Clear All</button>
                    </div>
                    <div id="recentsList" class="flex gap-5 overflow-x-auto no-scrollbar pb-4 scroll-smooth"></div>
                </div>
            </div>
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h2 id="currentCategoryTitle" class="text-3xl font-black uppercase tracking-tighter">Recommended</h2>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Showing <span id="channelCount" class="text-red-500">0</span> <span id="channelCountLabel">channels</span></p>
                </div>
            </div>
            <div id="channelGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8">
            </div>
            <div id="loadMoreTrigger" class="h-40 flex items-center justify-center w-full">
                <div class="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin opacity-0" id="loaderDot"></div>
            </div>
        </div>
    </div>
    <script>
        // --- INDEXEDDB STORAGE FOR M3U PLAYLISTS & CHANNELS ---
        // Keeps user M3U storage strictly local to the device!
        const DB_NAME = 'StalkerProLocalDB';
        const DB_VERSION = 1;
        let localDB = null;
        function initLocalDB() {
            return new Promise((resolve, reject) => {
                if (localDB) {
                    resolve(localDB);
                    return;
                }
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('playlists')) {
                        db.createObjectStore('playlists', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('channels')) {
                        db.createObjectStore('channels', { keyPath: 'id_unique' });
                    }
                };
                request.onsuccess = (e) => {
                    localDB = e.target.result;
                    resolve(localDB);
                };
                request.onerror = (e) => reject(e);
            });
        }
        async function dbSavePlaylist(playlist, channels) {
            await initLocalDB();
            return new Promise((resolve, reject) => {
                const tx = localDB.transaction(['playlists', 'channels'], 'readwrite');
                const pStore = tx.objectStore('playlists');
                const cStore = tx.objectStore('channels');
                pStore.put(playlist);
                // Add all channels
                channels.forEach(ch => {
                    ch.playlist_id = playlist.id;
                    ch.id_unique = playlist.id + '_' + ch.id;
                    cStore.put(ch);
                });
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e);
            });
        }
        async function dbDeletePlaylist(playlistId) {
            await initLocalDB();
            return new Promise((resolve, reject) => {
                const tx = localDB.transaction(['playlists', 'channels'], 'readwrite');
                const pStore = tx.objectStore('playlists');
                const cStore = tx.objectStore('channels');
                pStore.delete(playlistId);
                const req = cStore.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.playlist_id === playlistId) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e);
            });
        }
        async function dbGetPlaylists() {
            await initLocalDB();
            return new Promise((resolve, reject) => {
                const tx = localDB.transaction('playlists', 'readonly');
                const store = tx.objectStore('playlists');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = (e) => reject(e);
            });
        }
        async function dbGetChannels(playlistId) {
            await initLocalDB();
            return new Promise((resolve, reject) => {
                const tx = localDB.transaction('channels', 'readonly');
                const store = tx.objectStore('channels');
                const req = store.getAll();
                req.onsuccess = () => {
                    const allChs = req.result || [];
                    const filtered = allChs.filter(c => c.playlist_id === playlistId);
                    resolve(filtered);
                };
                req.onerror = (e) => reject(e);
            });
        }
        function parseM3U(content) {
            const lines = content.split('\n');
            const channels = [];
            let currentChannel = null;
            let channelCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXTM3U')) {
                    continue;
                }
                if (line.startsWith('#EXTINF:')) {
                    currentChannel = {};
                    const infoPart = line.substring(8);
                    const commaIdx = infoPart.lastIndexOf(',');
                    let metadata = infoPart;
                    let name = 'Unknown Channel';
                    if (commaIdx !== -1) {
                        metadata = infoPart.substring(0, commaIdx);
                        name = infoPart.substring(commaIdx + 1).trim();
                    }
                    currentChannel.Name = name;
                    const logoMatch = metadata.match(/tvg-logo="([^"]+)"/);
                    if (logoMatch) currentChannel.logo_url = logoMatch[1];
                    const groupMatch = metadata.match(/group-title="([^"]+)"/);
                    if (groupMatch) currentChannel.genre = groupMatch[1];
                    else currentChannel.genre = 'Other';
                    channelCount++;
                    currentChannel.number = channelCount;
                } else if (line && !line.startsWith('#')) {
                    if (currentChannel) {
                        currentChannel.playback_url = line;
                        currentChannel.id = 'm3u_ch_' + hashCode(line);
                        channels.push(currentChannel);
                        currentChannel = null;
                    }
                }
            }
            return channels;
        }
        function hashCode(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash).toString(16);
        }
        let allChannels = [];
        let currentFilteredChannels = [];
        let savedPortalsData = [];
        let currentGenre = 'all';
        let limit = 24;
        let offset = 0;
        lucide.createIcons();
        // FALLBACK GENERATOR
        const getFallback = (name) => {
            return 'public/stalker_pro_infinity.svg';
        };
        // --- SUBTITLE SEARCH LOGIC ---
        function toggleSubtitleModal(s) {
            document.getElementById('subtitleModal').classList.toggle('hidden', !s);
            if (s) {
                setTimeout(() => document.getElementById('subtitleSearchInput').focus(), 100);
            }
        }
        async function searchSubtitles() {
            const query = document.getElementById('subtitleSearchInput').value.trim();
            if (!query) return;
            const resultsContainer = document.getElementById('subtitleResults');
            const loading = document.getElementById('subtitleLoading');
            resultsContainer.innerHTML = '';
            loading.classList.remove('hidden');
            try {
                const response = await fetch(`/api/subtitles/search?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                loading.classList.add('hidden');
                if (data.error) {
                    resultsContainer.innerHTML = `<div class="p-4 text-center text-red-500">${data.error}</div>`;
                    return;
                }
                if (!data.results || data.results.length === 0) {
                    resultsContainer.innerHTML = '<div class="p-4 text-center text-slate-500">No subtitles found.</div>';
                    return;
                }
                data.results.forEach(result => {
                    const div = document.createElement('div');
                    div.className = 'p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-4';
                    div.onclick = () => downloadSubtitle(result.link, result.title);
                    const imgHtml = result.image ? `<img src="${result.image}" class="w-12 h-16 object-cover rounded-lg">` : `<div class="w-12 h-16 bg-white/10 rounded-lg flex items-center justify-center"><i data-lucide="file-text" class="text-slate-500"></i></div>`;
                    div.innerHTML = `
                        ${imgHtml}
                        <div class="flex-1 overflow-hidden">
                            <h3 class="text-white font-bold line-clamp-2">${result.title}</h3>
                            <p class="text-xs text-blue-400 mt-1">Click to download</p>
                        </div>
                    `;
                    resultsContainer.appendChild(div);
                });
                if (window.lucide) lucide.createIcons();
            } catch (error) {
                console.error(error);
                loading.classList.add('hidden');
                resultsContainer.innerHTML = '<div class="p-4 text-center text-red-500">Error fetching subtitles.</div>';
            }
        }
        async function downloadSubtitle(url, title) {
            showToast('Fetching...', `Retrieving subtitle file for ${title}`, 'info');
            try {
                // Pass the subtitle through our own proxy route
                const downloadUrl = `/api/subtitles/download?url=${encodeURIComponent(url)}`;
                showToast('Success', 'Download starting...', 'success');
                window.location.href = downloadUrl;
            } catch (error) {
                console.error(error);
                showToast('Error', 'Failed to retrieve download link.', 'error');
            }
        }
        // --- M3U PLAYLIST MANAGEMENT LOGIC ---
        let currentM3UMethod = 'url';
        let uploadedM3UBase64 = '';
        let uploadedM3UFileName = '';
        function toggleM3UModal(s) {
            document.getElementById('m3uModal').classList.toggle('hidden', !s);
            if (s) {
                backToM3UList();
                fetchM3UPlaylists();
            }
        }
        function openM3UModal() {
            toggleM3UModal(true);
        }
        function showM3UAddView() {
            document.getElementById('m3uPlaylistListView').classList.add('hidden');
            document.getElementById('m3uCloseBtn').classList.add('hidden');
            document.getElementById('m3uAddPlaylistView').classList.remove('hidden');
        }
        function backToM3UList() {
            document.getElementById('m3uAddPlaylistView').classList.add('hidden');
            document.getElementById('m3uPlaylistListView').classList.remove('hidden');
            document.getElementById('m3uCloseBtn').classList.remove('hidden');
            document.getElementById('m3uName').value = '';
            document.getElementById('m3uUrl').value = '';
            clearM3UFile();
        }
        function setM3UMethod(method) {
            currentM3UMethod = method;
            const btnUrl = document.getElementById('methodBtnUrl');
            const btnFile = document.getElementById('methodBtnFile');
            const urlGroup = document.getElementById('m3uUrlGroup');
            const fileGroup = document.getElementById('m3uFileGroup');
            if (method === 'url') {
                btnUrl.className = 'flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition-all border border-indigo-500';
                btnFile.className = 'flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold transition-all border border-white/5';
                urlGroup.classList.remove('hidden');
                fileGroup.classList.add('hidden');
            } else {
                btnFile.className = 'flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition-all border border-indigo-500';
                btnUrl.className = 'flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold transition-all border border-white/5';
                fileGroup.classList.remove('hidden');
                urlGroup.classList.add('hidden');
            }
        }
        window.addEventListener('DOMContentLoaded', () => {
            const dropZone = document.getElementById('m3uDropZone');
            const fileInput = document.getElementById('m3uFileInput');
            if (dropZone && fileInput) {
                dropZone.addEventListener('click', () => fileInput.click());
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.classList.add('border-indigo-500', 'bg-indigo-500/5');
                });
                ['dragleave', 'dragend'].forEach(type => {
                    dropZone.addEventListener(type, () => {
                        dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
                    });
                });
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
                    if (e.dataTransfer.files.length) {
                        handleM3UFile(e.dataTransfer.files[0]);
                    }
                });
                fileInput.addEventListener('change', () => {
                    if (fileInput.files.length) {
                        handleM3UFile(fileInput.files[0]);
                    }
                });
            }
        });
        function handleM3UFile(file) {
            if (!file.name.endsWith('.m3u') && !file.name.endsWith('.m3u8')) {
                alert('Please upload a valid M3U or M3U8 file.');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('File is too large. Maximum size is 10MB.');
                return;
            }
            uploadedM3UFileName = file.name;
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                uploadedM3UBase64 = btoa(unescape(encodeURIComponent(content)));
                document.getElementById('m3uDropZone').classList.add('hidden');
                document.getElementById('m3uFileName').innerText = file.name;
                document.getElementById('m3uFileInfo').classList.remove('hidden');
                const nameInput = document.getElementById('m3uName');
                if (!nameInput.value) {
                    nameInput.value = file.name.replace(/\.[^/.]+$/, "");
                }
            };
            reader.readAsText(file);
        }
        function clearM3UFile() {
            uploadedM3UBase64 = '';
            uploadedM3UFileName = '';
            const dropZone = document.getElementById('m3uDropZone');
            const fileInfo = document.getElementById('m3uFileInfo');
            const fileInput = document.getElementById('m3uFileInput');
            if (dropZone) dropZone.classList.remove('hidden');
            if (fileInfo) fileInfo.classList.add('hidden');
            if (fileInput) fileInput.value = '';
        }
        function esc(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        async function fetchM3UPlaylists() {
            const list = document.getElementById('m3uList');
            list.innerHTML = Array(2).fill(0).map(() => `
                <div class="vault-card flex items-center justify-between p-4 rounded-3xl opacity-50">
                    <div class="flex-1 space-y-2">
                        <div class="h-3 w-40 skeleton rounded-full"></div>
                        <div class="h-2 w-20 skeleton rounded-full"></div>
                    </div>
                </div>
            `).join('');
            try {
                const playlists = await dbGetPlaylists();
                const activeId = localStorage.getItem('active_playlist_id') || 'portal';
                let html = '';
                html += `
                    <div class="vault-card flex items-center justify-between p-4 rounded-3xl group ${activeId === 'portal' ? 'border-indigo-500/40 bg-indigo-500/5' : ''}">
                        <div onclick="switchM3UPlaylist('portal')" class="flex-1 cursor-pointer">
                            <div class="flex items-center gap-2">
                                <p class="text-xs font-black text-white group-hover:text-indigo-400 transition-colors">MAIN PORTAL CHANNELS</p>
                                ${activeId === 'portal' ? '<span class="text-[7px] font-black uppercase text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-md">Active</span>' : ''}
                            </div>
                            <p class="text-[9px] font-mono text-slate-500 uppercase mt-1 tracking-tighter">Your main stalker portal server</p>
                        </div>
                    </div>
                `;
                playlists.forEach(p => {
                    const isActive = activeId === p.id;
                    const safeId = p.id.replace(/'/g, "\\'");
                    html += `
                        <div class="vault-card flex items-center justify-between p-4 rounded-3xl group ${isActive ? 'border-indigo-500/40 bg-indigo-500/5' : ''}">
                            <div onclick="switchM3UPlaylist('${safeId}')" class="flex-1 cursor-pointer">
                                <div class="flex items-center gap-2">
                                    <p class="text-xs font-black text-white group-hover:text-indigo-400 transition-colors truncate max-w-[200px] uppercase">${esc(p.name)}</p>
                                    ${isActive ? '<span class="text-[7px] font-black uppercase text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-md">Active</span>' : ''}
                                </div>
                                <p class="text-[9px] font-mono text-slate-500 mt-1 tracking-tighter uppercase">${p.channels_count} channels &bull; ${p.source_type} import</p>
                            </div>
                            <div class="flex items-center gap-1">
                                <button onclick="copyM3ULink('${safeId}')" class="p-3 rounded-2xl bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-400 transition-all" title="Copy Playlist ID">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                                <button onclick="deleteM3UPlaylist('${safeId}')" class="p-3 rounded-2xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-400 transition-all" title="Delete Playlist">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                list.innerHTML = html;
                lucide.createIcons();
            } catch (err) {
                list.innerHTML = `<p class="text-center text-rose-500 text-[10px] font-black uppercase py-6">Failed to retrieve playlists</p>`;
            }
        }
        async function saveM3UPlaylist() {
            const name = document.getElementById('m3uName').value.trim();
            const url = document.getElementById('m3uUrl').value.trim();
            const password = document.getElementById('m3uPassword').value.trim();
            const saveBtn = document.getElementById('saveM3UBtn');
            if (!name) {
                alert('Please enter a playlist name.');
                return;
            }
            if (!password) {
                alert('Please enter the security password.');
                return;
            }
            saveBtn.disabled = true;
            saveBtn.innerText = 'Importing...';
            try {
                const payload = {
                    action: 'm3u_save',
                    name: name,
                    password: password
                };
                if (currentM3UMethod === 'url') {
                    if (!url) {
                        alert('Please enter an M3U playlist URL.');
                        saveBtn.disabled = false;
                        saveBtn.innerText = 'Import Playlist';
                        return;
                    }
                    payload.url = url;
                } else {
                    if (!uploadedM3UBase64) {
                        alert('Please select or upload an M3U file.');
                        saveBtn.disabled = false;
                        saveBtn.innerText = 'Import Playlist';
                        return;
                    }
                    payload.file_content = uploadedM3UBase64.split(',')[1] || uploadedM3UBase64;
                }
                const res = await fetch('stalker_api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.status === 'success') {
                    const playlist = {
                        id: name.toLowerCase().replace(/\s+/g, '-'),
                        name: name,
                        channels_count: data.channels_count,
                        source_type: data.source_type,
                        source_value: data.source_value
                    };
                    await dbSavePlaylist(playlist, data.channels);
                    showToast('Playlist Imported Successfully');
                    backToM3UList();
                    fetchM3UPlaylists();
                } else {
                    throw new Error(data.message || 'Import failed');
                }
            } catch (err) {
                alert('Error importing playlist: ' + err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Import Playlist';
            }
        }
        async function switchM3UPlaylist(id) {
            localStorage.setItem('active_playlist_id', id);
            showToast('Playlist switched!');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
        async function deleteM3UPlaylist(id) {
            if (!confirm('Are you sure you want to delete this M3U playlist?')) {
                return;
            }
            try {
                await dbDeletePlaylist(id);
                showToast('Playlist Deleted');
                const activeId = localStorage.getItem('active_playlist_id') || 'portal';
                if (activeId === id) {
                    localStorage.setItem('active_playlist_id', 'portal');
                }
                fetchM3UPlaylists();
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            } catch (err) {
                alert('Error deleting playlist: ' + err.message);
            }
        }
        async function copyM3ULink(id) {
            try {
                await navigator.clipboard.writeText(id);
                showToast('Playlist ID copied to clipboard');
            } catch (e) {
                showToast('Failed to copy ID');
            }
        }
        async function deletePortal(id) {
            if (!confirm('Are you sure you want to delete this portal identity?')) {
                return;
            }
            try {
                const response = await fetch('stalker_api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_portal', id: id })
                });
                const data = await response.json();
                if (data.statusCode === 200 || data.status === 'success') {
                    showToast('Portal Identity Deleted');
                    fetchSavedPortals();
                } else {
                    alert(data.message || 'Failed to delete portal.');
                }
            } catch (err) {
                alert('Connection error deleting portal.');
            }
        }
        // --- VAULT & INSPECTOR LOGIC ---
        function maskSensitive(text, showLen = 6) {
            if (document.body.classList.contains('unmasked')) return text;
            if (!text || text.length <= showLen * 2) return text;
            return text.substring(0, showLen) + '••••••••' + text.substring(text.length - showLen);
        }
        function togglePortalModal(s) {
            document.getElementById('portalModal').classList.toggle('hidden', !s);
            if (s) backToVaultList();
        }
        async function fetchSavedPortals() {
            togglePortalModal(true);
            const list = document.getElementById('portalList');
            // PUT THIS HERE: Show list skeletons
            list.innerHTML = Array(4).fill(0).map(() => `
        <div class="vault-card flex items-center justify-between p-4 rounded-3xl opacity-50">
            <div class="flex-1 space-y-2">
                <div class="h-3 w-40 skeleton rounded-full"></div>
                <div class="h-2 w-20 skeleton rounded-full"></div>
            </div>
        </div>
    `).join('');
            try {
                const response = await fetch('stalker_api.php?action=all_portals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                savedPortalsData = data.portals || [];
                const activeId = data.active_portal_id;
                let html = '';
                const defaultIndex = savedPortalsData.findIndex(p => p.id === '123.geoent.cc' || p.id === 'stalker_123_geoent_cc');
                const isDefaultActive = activeId === '123.geoent.cc' || activeId === 'stalker_123_geoent_cc';
                const defaultId = defaultIndex !== -1 ? savedPortalsData[defaultIndex].id : 'stalker_123_geoent_cc';
                // Pin the default stream portal to the top of the list in Identity Vault
                html += `
                    <div class="vault-card flex items-center justify-between p-4 rounded-3xl group border-2 ${isDefaultActive ? 'border-red-500 bg-red-500/10' : 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'}">
                        <div onclick="switchPortal('${defaultId}')" class="flex-1 cursor-pointer">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded-md bg-red-500 text-white text-[8px] font-black uppercase tracking-widest">SYSTEM DEFAULT</span>
                                ${isDefaultActive ? '<span class="px-2 py-0.5 rounded-md bg-green-500 text-white text-[8px] font-black uppercase tracking-widest">ACTIVE</span>' : ''}
                            </div>
                            <p class="text-xs font-bold text-white group-hover:text-red-400 mt-1 transition-colors truncate w-40 md:w-80 mask-blur">${maskSensitive('http://123.geoent.cc/stalker_portal')}</p>
                            <p class="text-[9px] font-mono text-slate-400 uppercase mt-1 tracking-tighter">Protected</p>
                        </div>
                        <button onclick="${defaultIndex !== -1 ? `inspectPortal(${defaultIndex})` : `switchPortal('${defaultId}')`}" class="p-3 ml-2 rounded-2xl bg-white/5 hover:bg-red-600 hover:text-white transition-all" title="Inspect Default Portal">
                            <i data-lucide="${defaultIndex !== -1 ? 'chevron-right' : 'play'}" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
                const otherPortals = savedPortalsData.map((p, i) => ({p, i})).filter(item => item.p.id !== '123.geoent.cc' && item.p.id !== 'stalker_123_geoent_cc');
                if (otherPortals.length > 0) {
                    html += `<div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-3 pl-2">Other Saved Portals</div>`;
                    html += otherPortals.map(item => {
                        const isActive = activeId === item.p.id;
                        const labelText = item.p.type === 'xtream' ? 'XTREAM' : 'STALKER';
                        const infoText = item.p.type === 'xtream' ? ('USER: ' + item.p.username) : 'Protected';
                        return `
                        <div class="vault-card flex items-center justify-between p-4 rounded-3xl group ${isActive ? 'bg-white/10 border-2 border-white/20' : 'bg-transparent border border-transparent'}">
                            <div onclick="switchPortal('${item.p.id}')" class="flex-1 cursor-pointer">
                                <div class="flex items-center gap-2">
                                    <p class="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate max-w-[12rem] md:max-w-xs mask-blur">${maskSensitive(item.p.URL)}</p>
                                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[8px] font-black uppercase text-slate-400 border border-white/5">${labelText}</span>
                                    ${isActive ? '<span class="px-2 py-0.5 rounded-md bg-green-500 text-white text-[8px] font-black uppercase tracking-widest">ACTIVE</span>' : ''}
                                </div>
                                <p class="text-[9px] font-mono text-slate-500 uppercase mt-1 tracking-tighter">${infoText}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="deletePortal('${item.p.id}')" class="p-3 rounded-2xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-500 transition-all" title="Delete Identity">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                                <button onclick="inspectPortal(${item.i})" class="p-3 rounded-2xl bg-white/5 hover:bg-red-600 hover:text-white transition-all">
                                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    `}).join('');
                }
                // Add a stylish button/card at the very end to link to login.php for adding a new portal
                html += `
                    <div class="mt-6 border-t border-white/5 pt-4">
                        <a href="login.php" class="flex items-center justify-center gap-3 p-5 rounded-3xl border-2 border-dashed border-slate-800 hover:border-red-500/40 hover:bg-red-500/5 group transition-all text-center">
                            <div class="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 group-hover:bg-red-500/10 group-hover:text-red-400 transition-all"><i data-lucide="plus"></i></div>
                            <div class="text-left">
                                <p class="text-xs font-bold text-slate-400 group-hover:text-white transition-all">Add New Portal</p>
                                <p class="text-[9px] font-medium text-slate-600 group-hover:text-slate-400 transition-all">Configure custom Stalker Portal credentials</p>
                            </div>
                        </a>
                    </div>
                `;
                list.innerHTML = html;
                if (typeof lucide !== 'undefined' && lucide.createIcons) {
                    lucide.createIcons();
                }
            } catch (e) {
                console.error("Vault fetch error:", e);
                list.innerHTML = `
                    <div class="text-center py-6 space-y-2">
                        <p class="text-rose-500 text-[10px] font-black uppercase">Vault Access Denied</p>
                        <p class="text-slate-500 text-[9px] font-mono">${e.message || 'Unknown Error'}</p>
                    </div>
                `;
            }
        }
        let isEditMode = false;
        function inspectPortal(idx) {
            const p = savedPortalsData[idx];
            document.getElementById('vaultListView').classList.add('hidden');
            document.getElementById('vaultCloseBtn').classList.add('hidden');
            document.getElementById('vaultDetailView').classList.remove('hidden');
            isEditMode = false;
            document.getElementById('portalDetailContent').classList.remove('hidden');
            document.getElementById('portalEditForm').classList.add('hidden');
            document.getElementById('activatePortalBtn').classList.remove('hidden');
            const editBtn = document.getElementById('vaultEditBtn');
            editBtn.innerHTML = `<i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit Portal`;
            let rows = [];
            if (p.type === 'xtream') {
                rows = [
                    {
                        l: 'Portal URL',
                        v: maskSensitive(p.URL)
                    },
                    {
                        l: 'Connection Type',
                        v: 'Xtream Codes API'
                    },
                    {
                        l: 'Username',
                        v: maskSensitive(p.username || '')
                    },
                    {
                        l: 'Proxy Status',
                        v: p.Proxy || 'AUTO'
                    }
                ];
            } else {
                rows = [
                    {
                        l: 'Portal URL',
                        v: maskSensitive(p.URL)
                    },
                    {
                        l: 'Device SN',
                        v: maskSensitive(p.SN || 'N/A')
                    },
                    {
                        l: 'Model',
                        v: p.Model
                    },
                    {
                        l: 'Device ID 1',
                        v: maskSensitive(p.D1 || 'N/A', 8)
                    },
                    {
                        l: 'Device ID 2',
                        v: maskSensitive(p.D2 || 'N/A', 8)
                    },
                    {
                        l: 'Proxy Status',
                        v: p.Proxy || 'AUTO'
                    }
                ];
            }
            document.getElementById('portalDetailContent').innerHTML = rows.map(r => `
                <div class="flex flex-col text-left">
                    <span class="text-[8px] font-black text-slate-600 uppercase tracking-widest">${r.l}</span>
                    <span class="text-[11px] font-mono text-slate-300 break-all mask-blur">${r.v}</span>
                </div>
            `).join('');
            if (p.id === '123.geoent.cc' || p.id === 'stalker_123_geoent_cc') {
                editBtn.classList.add('hidden');
            } else {
                editBtn.classList.remove('hidden');
                editBtn.onclick = () => {
                    isEditMode = !isEditMode;
                    if (isEditMode) {
                        document.getElementById('portalDetailContent').classList.add('hidden');
                        document.getElementById('portalEditForm').classList.remove('hidden');
                        document.getElementById('activatePortalBtn').classList.add('hidden');
                        editBtn.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5"></i> Show Details`;
                        document.getElementById('editPortalUrl').value = p.URL;
                        if (p.type === 'xtream') {
                            document.getElementById('editPortalXtreamFields').classList.remove('hidden');
                            document.getElementById('editPortalUsername').value = p.username || '';
                            document.getElementById('editPortalPassword').value = '';
                        } else {
                            document.getElementById('editPortalXtreamFields').classList.add('hidden');
                        }
                    } else {
                        document.getElementById('portalDetailContent').classList.remove('hidden');
                        document.getElementById('portalEditForm').classList.add('hidden');
                        document.getElementById('activatePortalBtn').classList.remove('hidden');
                        editBtn.innerHTML = `<i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit Portal`;
                    }
                    lucide.createIcons();
                };
            }
            document.getElementById('savePortalEditBtn').onclick = async () => {
                const url = document.getElementById('editPortalUrl').value.trim();
                const username = document.getElementById('editPortalUsername').value.trim();
                const password = document.getElementById('editPortalPassword').value.trim();
                if (!url) {
                    alert('Portal URL is required.');
                    return;
                }
                try {
                    showToast('Saving changes...');
                    const res = await fetch(`stalker_api.php?action=save_portal`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: p.id,
                            url,
                            username,
                            password
                        })
                    });
                    const data = await res.json();
                    if (data.statusCode === 200 || data.status === 'success') {
                        showToast('Portal Updated Successfully!', '', 'success');
                        await fetchSavedPortals();
                        backToVaultList();
                    } else {
                        alert(data.message || 'Failed to update portal.');
                    }
                } catch (err) {
                    console.error('Error saving portal edits:', err);
                    alert('Connection error saving changes.');
                }
            };
            document.getElementById('activatePortalBtn').onclick = () => switchPortal(p.id);
            lucide.createIcons();
        }
        function backToVaultList() {
            document.getElementById('vaultDetailView').classList.add('hidden');
            document.getElementById('vaultListView').classList.remove('hidden');
            document.getElementById('vaultCloseBtn').classList.remove('hidden');
        }
        async function switchPortal(id) {
            try {
                showToast('Switching portal identity...');
                const res = await fetch(`stalker_api.php?action=switch_portal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id
                    })
                });
                const data = await res.json();
                console.log('Switch Portal Response:', data);
                if (data.statusCode === 200 || data.status === 'success') {
                    showToast('Portal Switched Successfully! Reloading...');
                    localStorage.setItem('active_portal_id', id);
                    localStorage.setItem('active_playlist_id', 'portal');
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                } else {
                    alert(data.message || 'Failed to switch portal.');
                }
            } catch (err) {
                console.error('Error switching portal:', err);
                alert('Connection error switching portal.');
            }
        }
        // --- CHANNEL RENDERING & ANIMATION ---
        async function fetchChannels() {
            const grid = document.getElementById('channelGrid');
            // PUT THIS HERE: Show 18 skeletons immediately
            grid.innerHTML = Array(18).fill(0).map(() => `
        <div class="channel-card border-none opacity-40">
            <div class="aspect-square skeleton rounded-[1.5rem]"></div>
            <div class="p-3 space-y-2">
                <div class="h-2 w-10 skeleton rounded-full opacity-50"></div>
                <div class="h-3 w-full skeleton rounded-full"></div>
            </div>
        </div>
    `).join('');
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            if (activeId === 'portal' && !isXtreamPortal) {
                checkPortalType().catch(e => console.error("checkPortalType failed:", e));
            }
            if (activeId !== 'portal') {
                document.getElementById('mediaTypeSelector').classList.add('hidden');
                try {
                    const localChannels = await dbGetChannels(activeId);
                    let favs = [];
                    try {
                        favs = JSON.parse(localStorage.getItem(`favorites_${activeId}`) || '[]');
                    } catch (e) {}
                    if (!Array.isArray(favs)) favs = [];
                    allChannels = localChannels.map(c => {
                        return {
                            ...c,
                            is_favorite: favs.includes(c.id),
                            logo: c.logo_url || c.logo || ''
                        };
                    });
                    if (allChannels.length === 0) {
                        grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
                            <i data-lucide="search-x" class="w-12 h-12 text-slate-700 mx-auto"></i>
                            <p class="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">No channels found in this playlist</p>
                        </div>`;
                        lucide.createIcons();
                    } else {
                        renderGenres();
                        renderQuickAccess();
                        resetAndLoad();
                    }
                } catch (err) {
                    grid.innerHTML = `<p class="col-span-full py-10 text-center text-slate-500 uppercase text-xs font-bold">Failed to load local channels</p>`;
                }
                return;
            }
            try {
                const response = await fetch(`stalker_api.php?action=livechannels&media_type=${currentMediaType}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                if (data && data.STALKER && data.STALKER.message && data.STALKER.message !== "CHECKPOINT_ERROR") {
                    grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
                        <i data-lucide="alert-circle" class="w-12 h-12 text-red-500 mx-auto"></i>
                        <p class="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">${data.STALKER.message}</p>
                        <a href="login.php" class="inline-block px-6 py-2 bg-red-600 text-white text-[10px] font-bold rounded-xl uppercase tracking-widest">Re-authenticate</a>
                    </div>`;
                    lucide.createIcons();
                    return;
                }
                if (data && data.error) {
                    grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
                        <i data-lucide="lock" class="w-12 h-12 text-red-500 mx-auto"></i>
                        <p class="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">${data.error}</p>
                        <a href="login.php" class="inline-block px-6 py-2 bg-red-600 text-white text-[10px] font-bold rounded-xl uppercase tracking-widest">Login Required</a>
                    </div>`;
                    lucide.createIcons();
                    return;
                }
                allChannels = Array.isArray(data) ? data : (data.channels || []);
                if (allChannels.length === 0) {
                     let term = 'channels';
                     if (currentMediaType === 'movie') term = 'movies';
                     if (currentMediaType === 'series') term = 'series';
                     grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
                        <i data-lucide="search-x" class="w-12 h-12 text-slate-700 mx-auto"></i>
                        <p class="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">No ${term} found in this portal</p>
                    </div>`;
                    lucide.createIcons();
                }
                renderGenres();
                renderQuickAccess();
                resetAndLoad();
            } catch (err) {
                grid.innerHTML = `<p class="col-span-full py-10 text-center text-slate-500 uppercase text-xs font-bold">Sync Failed</p>`;
            }
        }
        function renderQuickAccess() {
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            let favorites = [];
            let recents = [];
            if (activeId !== 'portal') {
                favorites = allChannels.filter(c => c.is_favorite);
                let recs = [];
                try {
                    recs = JSON.parse(localStorage.getItem(`recents_${activeId}`) || '[]');
                } catch (e) {}
                recents = recs.map(id => allChannels.find(c => c.id === id)).filter(Boolean).slice(0, 10);
            } else {
                favorites = allChannels.filter(c => c.genre === '⭐ Favorites');
                recents = allChannels.filter(c => c.genre === '🕒 Recents').slice(0, 10);
            }
            const favSection = document.getElementById('favoritesSection');
            const recSection = document.getElementById('recentsSection');
            const quickAccess = document.getElementById('quickAccess');
            const search = (document.getElementById('searchInput').value || document.getElementById('mobileSearch').value).toLowerCase();
            if (favorites.length > 0) {
                favSection.classList.remove('hidden');
                document.getElementById('favoritesList').innerHTML = favorites.map(c => renderQuickCard(c)).join('');
            } else {
                favSection.classList.add('hidden');
            }
            if (recents.length > 0) {
                recSection.classList.remove('hidden');
                document.getElementById('recentsList').innerHTML = recents.map(c => renderQuickCard(c)).join('');
            } else {
                recSection.classList.add('hidden');
            }
            if ((favorites.length > 0 || recents.length > 0) && currentGenre === 'all' && !search) {
                quickAccess.classList.remove('hidden');
            } else {
                quickAccess.classList.add('hidden');
            }
            lucide.createIcons();
        }
        function generateBroadcastSvgBadge(title, genre) {
            const cleanTitle = (title || 'Live TV').replace(/[💎⭐️]/g, '').trim();
            const shortTitle = cleanTitle.length > 20 ? cleanTitle.substring(0, 18) + '...' : cleanTitle;
            const tag = (genre || 'LIVE').toUpperCase().replace(/[^A-Z0-9 ]/g, '').substring(0, 10);
            let hash = 0;
            for (let i = 0; i < cleanTitle.length; i++) hash = (hash << 5) - hash + cleanTitle.charCodeAt(i);
            const hues = [
                ['#ef4444', '#b91c1c'],
                ['#3b82f6', '#1d4ed8'],
                ['#10b981', '#047857'],
                ['#8b5cf6', '#6d28d9'],
                ['#f59e0b', '#d97706'],
                ['#ec4899', '#be185d'],
                ['#06b6d4', '#0e7490'],
                ['#6366f1', '#4338ca']
            ];
            const pair = hues[Math.abs(hash) % hues.length];
            const escapeXml = (str) => str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c] || c));
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pair[0]}"/>
      <stop offset="100%" stop-color="${pair[1]}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="16" fill="url(#bg)" stroke="#1e293b" stroke-width="2"/>
  <circle cx="160" cy="80" r="44" fill="url(#accent)" opacity="0.18" />
  <g transform="translate(140, 60)">
    <rect x="2" y="7" width="36" height="26" rx="4" fill="none" stroke="${pair[0]}" stroke-width="3"/>
    <polyline points="12 1 20 7 28 1" fill="none" stroke="${pair[0]}" stroke-width="3" stroke-linecap="round"/>
  </g>
  <text x="160" y="145" text-anchor="middle" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="17" font-weight="700" letter-spacing="0.5">${escapeXml(shortTitle)}</text>
  <rect x="120" y="162" width="80" height="20" rx="10" fill="${pair[0]}" opacity="0.9"/>
  <text x="160" y="176" text-anchor="middle" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="800" letter-spacing="1">${escapeXml(tag)}</text>
</svg>`;
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        }

        function getRobustLogo(c) {
            const rawTitle = c.Name || c.name || 'Live TV';
            const fallbackImg = generateBroadcastSvgBadge(rawTitle, c.genre || c.group);
            let logo = c.logo || c.Logo || c.logo_url || c.icon || '';
            const name = (c.Name || c.name || '').toLowerCase();
            
            // Name-based direct matching for curated brand logos
            if (name.includes('star gold select')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Star_Gold_Select_logo.png/512px-Star_Gold_Select_logo.png';
            if (name.includes('star gold 2')) return 'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_2/images/LOGO_HD/image.png';
            if (name.includes('star gold romance')) return 'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_ROMANCE/images/LOGO_HD/image.png';
            if (name.includes('star gold thrills')) return 'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_THRILLS/images/LOGO_HD/image.png';
            if (name.includes('star gold')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Star_Gold_2023.svg/512px-Star_Gold_2023.svg.png';
            if (name.includes('star movies')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Star_Movies_2023.svg/512px-Star_Movies_2023.svg.png';
            if (name.includes('star plus')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Star_Plus_2018.svg/960px-Star_Plus_2018.svg.png';
            if (name.includes('star bharat')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Star_Bharat_logo_2017.svg/960px-Star_Bharat_logo_2017.svg.png';
            if (name.includes('star sports')) return 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Star_Sports_logo.png';

            if (name.includes('&pictures') || name.includes('& pictures') || name.includes('and pictures')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/%26pictures_logo_2017.svg/512px-%26pictures_logo_2017.svg.png';
            if (name.includes('&tv') || name.includes('& tv') || name.includes('and tv')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/%26TV_logo_2017.svg/512px-%26TV_logo_2017.svg.png';
            if (name.includes('&flix') || name.includes('& flix') || name.includes('and flix')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/%26flix_logo_2018.svg/512px-%26flix_logo_2018.svg.png';

            if (name.includes('zee cinema')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Zee_Cinema_2017.svg/512px-Zee_Cinema_2017.svg.png';
            if (name.includes('zee tv')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Zee_TV_2017.svg/512px-Zee_TV_2017.svg.png';
            if (name.includes('sony max 2')) return 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Sony_Max_logo.png';
            if (name.includes('sony max')) return 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Sony_Max_logo.png';
            if (name.includes('sony sab')) return 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Sony_SAB_logo.png';
            if (name.includes('sony yay')) return 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Sony_Yay%21_logo.png';
            if (name.includes('sony pal')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Sony_Pal_logo_2022.svg/512px-Sony_Pal_logo_2022.svg.png';
            if (name.includes('sony wah')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Sony_Wah_logo_2022.svg/512px-Sony_Wah_logo_2022.svg.png';
            if (name.includes('sony ten') || name.includes('sony six') || name.includes('sony sports')) return 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sony_Sports_Network_logo.png';
            if (name.includes('colors cineplex')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Colors_Cineplex_logo.svg/512px-Colors_Cineplex_logo.svg.png';
            if (name.includes('colors rishtey')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Colors_Rishtey_logo.svg/512px-Colors_Rishtey_logo.svg.png';
            if (name.includes('colors tv') || name.includes('colors hd') || name === 'colors') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Colors_TV_logo.svg/512px-Colors_TV_logo.svg.png';

            if (name.includes('asianet')) return 'https://upload.wikimedia.org/wikipedia/commons/7/77/Asianet_logo.png';
            if (name.includes('mazhavil')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Mazhavil_Manorama_logo.svg/512px-Mazhavil_Manorama_logo.svg.png';
            if (name.includes('flowers')) return 'https://upload.wikimedia.org/wikipedia/commons/3/30/Flowers_TV_logo.png';
            if (name.includes('sun music')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Sun_Music_logo.svg/512px-Sun_Music_logo.svg.png';
            if (name.includes('sun news')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Sun_News_logo.svg/512px-Sun_News_logo.svg.png';
            if (name.includes('sun tv')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Sun_TV_logo.svg/512px-Sun_TV_logo.svg.png';
            if (name.includes('ktv')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/KTV_logo_2018.svg/512px-KTV_logo_2018.svg.png';
            if (name.includes('surya')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Surya_TV_logo.svg/512px-Surya_TV_logo.svg.png';

            if (name.includes('abc ny') || name.includes('abc usa') || name === 'abc') return '/assets/logos/abc_usa.svg';
            if (name.includes('a&e') || name.includes('a & e')) return '/assets/logos/a_and_e_usa.svg';
            if (name.includes('bein sports 1 fr')) return '/assets/logos/bein_sports_1_france.svg';
            if (name.includes('bein sports 2 fr')) return '/assets/logos/bein_sports_2_france.svg';
            if (name.includes('bein sports 3 fr')) return '/assets/logos/bein_sports_3_france.svg';
            if (name.includes('bein sports 1 tr') || name.includes('bein sports 1 turkey')) return '/assets/logos/bein_sports_1_turkey.svg';
            if (name.includes('bein sports 2 tr') || name.includes('bein sports 2 turkey')) return '/assets/logos/bein_sports_2_turkey.svg';
            if (name.includes('bein sports 3 tr') || name.includes('bein sports 3 turkey')) return '/assets/logos/bein_sports_3_turkey.svg';
            if (name.includes('bein sports 4 tr') || name.includes('bein sports 4 turkey')) return '/assets/logos/bein_sports_4_turkey.svg';
            if (name.includes('bein')) return '/assets/logos/bein_sports_mena_english_2.svg';
            if (name.includes('astro supersport 3')) return '/assets/logos/astro_supersport_3.svg';
            if (name.includes('astro supersport 4')) return '/assets/logos/astro_supersport_4.svg';
            if (name.includes('astro cricket')) return '/assets/logos/astro_cricket.svg';
            if (name.includes('dazn')) return '/assets/logos/dazn_2_spain.svg';
            if (name.includes('arena sport 2 cro')) return '/assets/logos/arena_sport_2_croatia.svg';
            if (name.includes('arena sport')) return '/assets/logos/arena_sport_2_serbia.svg';
            if (name.includes('espn brasil')) return '/assets/logos/espn_brasil.svg';
            if (name.includes('fox sports 2')) return '/assets/logos/fox_sports_2_usa.svg';
            if (name.includes('fox sports 503')) return '/assets/logos/fox_sports_503_au.svg';
            if (name.includes('fanduel')) return '/assets/logos/fanduel_sports_network_midwest.svg';
            if (name.includes('sportsnet one')) return '/assets/logos/sportsnet_one.svg';
            if (name.includes('sportsnet 360')) return '/assets/logos/sportsnet_360.svg';
            if (name.includes('supersport variety')) return '/assets/logos/supersport_variety_1.svg';
            if (name.includes('tsn5') || name.includes('tsn 5')) return '/assets/logos/tsn5.svg';
            if (name.includes('tnt usa') || name === 'tnt') return '/assets/logos/tnt_usa.svg';
            if (name.includes('starz')) return '/assets/logos/starz.svg';
            if (name.includes('cinemax')) return '/assets/logos/cinemax_usa.svg';
            if (name.includes('mgm+') || name.includes('epix')) return '/assets/logos/mgm_plus_usa_epix.svg';
            if (name.includes('showtime')) return '/assets/logos/showtime_showcase_usa.svg';
            if (name.includes('bbc america') || name.includes('bbca')) return '/assets/logos/bbc_america_bbca.svg';
            if (name.includes('bet usa') || name === 'bet') return '/assets/logos/bet_usa.svg';
            if (name.includes('cnbc')) return '/assets/logos/cnbc_usa.svg';
            if (name.includes('ctv canada') || name === 'ctv') return '/assets/logos/ctv_canada.svg';
            if (name.includes('cbsny') || name.includes('cbs ny') || name === 'cbs') return '/assets/logos/cbsny_usa.svg';
            if (name.includes('canal 5') || name.includes('canal5')) return '/assets/logos/canal5_mx.svg';
            if (name.includes('sport 1 cz') || name.includes('sport 1')) return '/assets/logos/sport_1_cz.svg';
            if (name.includes('joj')) return '/assets/logos/joj_sport_sk.svg';
            if (name.includes('discovery life')) return '/assets/logos/discovery_life_channel.svg';
            if (name.includes('disney xd')) return '/assets/logos/disney_xd.svg';
            if (name.includes('racer tv')) return '/assets/logos/racer_tv_usa.svg';
            if (name.includes('nbc sports')) return '/assets/logos/nbc_sports_philadelphia.svg';
            if (name.includes('nat geo wild')) return '/assets/logos/nat_geo_wild_usa.svg';
            if (name.includes('reelz')) return '/assets/logos/reelz_channel.svg';
            if (name.includes('sport 5 plus')) return '/assets/logos/sport_5_plus_israel.svg';
            if (name.includes('sport 5 live')) return '/assets/logos/sport_5_live_israel.svg';
            if (name.includes('sport 5 star') || name.includes('sport 5')) return '/assets/logos/sport_5_star_israel.svg';
            if (name.includes('tv4 sport')) return '/assets/logos/tv4_sport_live_3.svg';
            if (name.includes('v sport motor') || name.includes('v sport')) return '/assets/logos/v_sport_motor_sweden.svg';
            if (name.includes('fox weather')) return '/assets/logos/fox_weather_channel.svg';
            if (name.includes('eurosport 1') || name.includes('eurosport')) return '/assets/logos/eurosport_1_spain.svg';
            
            const isBroken = !logo || 
                           logo.includes('alphacoders') ||
                           logo.includes('865013') ||
                           logo.includes('portal.png') ||
                           logo.includes('/portal/picon') ||
                           logo.includes('generic.png') ||
                           logo.includes('Screenshot-2026-04-13') || 
                            
                           logo.includes('localhost') || 
                           logo.includes('example.com') ||
                           logo.includes('placeholder') ||
                           logo.length < 5;
            if (isBroken) {
                let cleanName = (c.Name || c.name || '')
                    .replace(/\s*(?:HD|UHD|4K|SD|FHD|HQ|720p|1080p)\b/gi, '')
                    .replace(/\s*(?:UK|US|USA|CA|FR|DE|ES|IT|IN|TR|AR|RU|BR|MX|AU|NZ|HE|ARAB|AF|AL|AM|AZ|BA|BE|BG|BY|CH|CN|CZ|DK|EE|EG|FI|GR|HR|HU|ID|IE|IL|IR|IS|JP|KR|KZ|LT|LU|LV|MA|MD|ME|MK|MY|NL|NO|PH|PK|PL|PT|RO|RS|SE|SG|SI|SK|TH|TW|UA|VN|ZA)\b/gi, '')
                    .replace(/\s*\[.*?\]|\(.*?\)/g, '')
                    .trim();
                const slug = cleanName.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');
                if (slug) {
                    return `https://iptv-org.github.io/api/logos/channels/${slug}.png`;
                }
            }
            return logo || fallbackImg;
        }
        function renderQuickCard(c) {
            if (!c) return '';
            const rawName = c.Name || c.name || 'Channel';
            const safeName = String(rawName).replace(/'/g, "\\'");
            const fallbackImg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>')}`;
            const logoToUse = getRobustLogo(c);
            return `
                <div onclick="playChannel('${c.id}', '${c.playback_url}', '${safeName}')" class="flex-shrink-0 w-32 md:w-40 group cursor-pointer">
                    <div class="aspect-video rounded-2xl overflow-hidden mb-2 relative border border-white/5 bg-slate-900 shadow-lg group-hover:border-red-500/50 transition-all flex items-center justify-center">
                        <span class="absolute inset-0 flex items-center justify-center text-white/5 text-3xl font-black uppercase pointer-events-none group-hover:text-white/10 transition-colors">
                            ${String(rawName).substring(0, 2)}
                        </span>
                        <img src="${logoToUse}" 
                             alt="${String(rawName).replace(/"/g, '&quot;')}"
                             class="relative z-10 w-full h-full object-contain p-2" 
                             onerror="this.onerror=null; this.src='${fallbackImg}';">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                            <i data-lucide="play" class="w-6 h-6 text-white fill-current"></i>
                        </div>
                    </div>
                    <p class="text-[9px] font-bold text-slate-400 truncate group-hover:text-white transition-colors text-center uppercase tracking-tighter">${rawName}</p>
                </div>
            `;
        }
        function renderGenres() {
            const rawGenres = [...new Set(allChannels.map(c => c.genre).filter(Boolean))];
            // Prioritize Special Categories
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            let hasFavorites = false;
            let hasRecents = false;
            if (activeId !== 'portal') {
                try {
                    const favs = JSON.parse(localStorage.getItem(`favorites_${activeId}`) || '[]');
                    const recs = JSON.parse(localStorage.getItem(`recents_${activeId}`) || '[]');
                    hasFavorites = favs.length > 0;
                    hasRecents = recs.length > 0;
                } catch (e) {}
            } else {
                hasFavorites = rawGenres.includes('⭐ Favorites');
                hasRecents = rawGenres.includes('🕒 Recents');
            }
            const special = [];
            if (hasFavorites) special.push('⭐ Favorites');
            if (hasRecents) special.push('🕒 Recents');
            const sortedGenres = [
                'all',
                ...special,
                ...rawGenres.filter(g => g !== '⭐ Favorites' && g !== '🕒 Recents').sort()
            ];
            const html = sortedGenres.map(g => {
                let label = g === 'all' ? 'Discovery' : g;
                return `<div class="genre-item ${g === currentGenre ? 'active' : ''}" onclick="filterByGenre('${g}', this)">${label}</div>`;
            }).join('');
            const desktop = document.getElementById('genreContainerDesktop');
            const mobile = document.getElementById('genreContainerMobile');
            if (desktop) desktop.innerHTML = html;
            if (mobile) mobile.innerHTML = html;
        }
        function filterByGenre(g, el) {
            currentGenre = g;
            const grid = document.getElementById('channelGrid');
            grid.classList.remove('grid-fade-in');
            void grid.offsetWidth;
            grid.classList.add('grid-fade-in');
            document.querySelectorAll('.genre-item').forEach(i => i.classList.remove('active'));
            document.getElementById('currentCategoryTitle').innerText = g === 'all' ? 'Discovery' : g;
            resetAndLoad();
        }
        function resetAndLoad() {
            offset = 0;
            document.getElementById('channelGrid').innerHTML = "";
            const search = (document.getElementById('searchInput').value || document.getElementById('mobileSearch').value).toLowerCase();
            currentFilteredChannels = allChannels.filter(c => {
                if (!c) return false;
                const nameMatches = (c.Name || c.name || '').toLowerCase().includes(search);
                if (!nameMatches) return false;
                if (currentGenre === 'all') return true;
                if (currentGenre === '⭐ Favorites') return c.is_favorite;
                if (currentGenre === '🕒 Recents') {
                    const activeId = localStorage.getItem('active_playlist_id') || 'portal';
                    let recs = [];
                    try {
                        recs = JSON.parse(localStorage.getItem(`recents_${activeId}`) || '[]');
                    } catch (e) {}
                    return recs.includes(c.id);
                }
                return c.genre === currentGenre;
            });
            renderQuickAccess();
            loadMore();
        }

        function loadMore() {
            const grid = document.getElementById('channelGrid');
            if (!grid) return;
            document.getElementById('channelCount').innerText = currentFilteredChannels.length;
            let countLabel = 'channels';
            if (currentMediaType === 'movie') countLabel = 'movies';
            if (currentMediaType === 'series') countLabel = 'series';
            const lblEl = document.getElementById('channelCountLabel');
            if (lblEl) lblEl.innerText = countLabel;

            const next = currentFilteredChannels.slice(offset, offset + limit);
            if (next.length > 0) {
                next.forEach((c, index) => {
                    if (!c) return;
                    const delay = index * 40;
                    const rawName = c.Name || c.name || c.title || c.channel_name || c.tvg_name || (c.number ? ('Channel #' + c.number) : 'Channel');
                    const safeName = String(rawName).replace(/'/g, "\\'");
                    const safeAlt = String(rawName).replace(/"/g, '&quot;');
                    
                    let actual_media_type = c.media_type || currentMediaType;
                    if (c.genre && c.genre.toLowerCase().includes('anim')) {
                        actual_media_type = 'anime';
                    }

                    const fallbackImg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>')}`;
                    const logoToUse = getRobustLogo(c);
                    const html = `
                <div class="channel-card group channel-entrance relative" style="animation-delay: ${delay}ms">
                    <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                        <button onclick="openMediaInfoModal(event, '${c.id}', '${safeName}', '${c.playback_url || ''}', '${actual_media_type}')" class="p-1.5 rounded-lg backdrop-blur-md bg-black/70 hover:bg-red-600 text-slate-300 hover:text-white transition-all shadow-md" title="Movie Details">
                            <i data-lucide="info" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="toggleFavorite(event, '${c.id}')" class="p-1.5 rounded-lg backdrop-blur-md bg-black/60 hover:bg-zinc-800 transition-all" title="Favorite">
                            <i data-lucide="heart" class="w-3.5 h-3.5 transition-all ${c.is_favorite ? 'text-red-500 fill-red-500' : 'text-slate-400 hover:text-white'}"></i>
                        </button>
                    </div>
                    <a href="javascript:void(0)" onclick="${(actual_media_type === 'series' || actual_media_type === 'anime') ? `showSeriesDetails('${c.id}', '${safeName}')` : `playChannel('${c.id}', '${c.playback_url}', '${safeName}')`}" class="block">
                        <div class="relative aspect-square flex items-center justify-center bg-black overflow-hidden border border-red-500/20">
                            <div class="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700 bg-gradient-to-br from-red-600/40 via-transparent to-red-600/40"></div>
                                <div class="relative z-10 w-[75%] h-[75%] rounded-full bg-black border border-red-500/30 backdrop-blur-md flex items-center justify-center p-5 shadow-2xl group-hover:scale-110 group-hover:border-red-500 transition-all duration-500 overflow-hidden">
                                    <span class="absolute inset-0 flex items-center justify-center text-red-500/30 text-2xl font-black uppercase pointer-events-none group-hover:text-red-500/50 transition-colors">
                                        ${String(rawName).substring(0, 2)}
                                    </span>
                                    <img src="${logoToUse}"
                                          alt="${safeAlt}"
                                        class="relative z-10 w-full h-full object-contain filter brightness-110"
                                        onerror="this.onerror=null; this.src='${fallbackImg}';">
                                    <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
                                </div>
                            <div class="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-red-600/40">
                                <i data-lucide="${(actual_media_type === 'series' || actual_media_type === 'anime') ? 'film' : 'play'}" class="w-3.5 h-3.5 ${((actual_media_type === 'series' || actual_media_type === 'anime') ? '' : 'fill-current')}"></i>
                            </div>
                        </div>
                        <div class="p-3 bg-black border-t border-red-500/20">
                            <div class="flex items-center justify-between gap-1 mb-1">
                                <div class="flex items-center gap-1.5 overflow-hidden">
                                    <span class="text-[7px] font-black text-white uppercase">${actual_media_type === 'movie' ? 'VOD' : ((actual_media_type === 'series' || actual_media_type === 'anime') ? 'SERIES' : `#${String(c.number || 0).padStart(3, '0')}`)}</span>
                                    ${c.rating ? `<span class="text-[6px] font-bold text-amber-500 bg-amber-500/10 px-1 rounded-sm">★ ${c.rating}</span>` : ''}
                                    ${c.year ? `<span class="text-[6px] font-bold text-slate-400 bg-white/5 px-1 rounded-sm">${c.year}</span>` : ''}
                                    ${String(rawName).toUpperCase().includes('4K') ? '<span class="text-[6px] font-bold text-red-400 bg-red-400/10 px-1 rounded-sm">4K</span>' : ''}
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    ${(actual_media_type === 'movie' || actual_media_type === 'series' || actual_media_type === 'anime') ? `
                                    <button onclick="window.playBingDirect(event, '${safeName}', '${actual_media_type}')" class="px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow" title="Direct Play via Bingr Scraper">
                                        <i data-lucide="play" class="w-2.5 h-2.5 fill-current"></i>
                                        <span>Bing</span>
                                    </button>
                                    ` : ''}
                                    <button onclick="openMediaInfoModal(event, '${c.id}', '${safeName}', '${c.playback_url || ''}', '${c.media_type || currentMediaType}')" class="px-2 py-0.5 rounded-md bg-white/10 hover:bg-red-600 text-slate-300 hover:text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow" title="Movie & Stream Details">
                                        <i data-lucide="info" class="w-2.5 h-2.5"></i>
                                        <span>Info</span>
                                    </button>
                                </div>
                            </div>
                            <h3 class="font-bold text-[11px] sm:text-xs text-white truncate uppercase tracking-tight group-hover:text-red-500 transition-colors" title="${safeAlt}">${safeAlt || rawName}</h3>
                        </div>
                    </a>
                </div>`;
                    grid.insertAdjacentHTML('beforeend', html);
                });
                offset += limit;
                lucide.createIcons();
            }
        }
        async function toggleFavorite(e, id) {
            e.stopPropagation();
            const btn = e.currentTarget;
            const icon = btn.querySelector('i');
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            if (activeId !== 'portal') {
                let favs = [];
                try {
                    favs = JSON.parse(localStorage.getItem(`favorites_${activeId}`) || '[]');
                } catch (e) {}
                if (!Array.isArray(favs)) favs = [];
                const index = favs.indexOf(id);
                let added = false;
                if (index === -1) {
                    favs.push(id);
                    added = true;
                } else {
                    favs.splice(index, 1);
                }
                localStorage.setItem(`favorites_${activeId}`, JSON.stringify(favs));
                allChannels = allChannels.map(ch => {
                    if (ch.id === id) ch.is_favorite = added;
                    return ch;
                });
                if (currentGenre === '⭐ Favorites') {
                    offset = 0;
                    resetAndLoad();
                } else if (btn && icon) {
                    if (added) {
                        icon.classList.add('text-red-500', 'fill-red-500');
                        icon.classList.remove('text-slate-400', 'hover:text-white');
                    } else {
                        icon.classList.remove('text-red-500', 'fill-red-500');
                        icon.classList.add('text-slate-400', 'hover:text-white');
                    }
                }
                showToast(added ? 'Added to Favorites' : 'Removed from Favorites');
                renderQuickAccess();
                return;
            }
            try {
                const response = await fetch('stalker_api.php?action=toggle_favorite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    allChannels = allChannels.map(ch => {
                        if (ch.id === id) ch.is_favorite = !ch.is_favorite;
                        return ch;
                    });
                    if (currentGenre === '⭐ Favorites') {
                        offset = 0;
                        resetAndLoad();
                    } else if (btn && icon) {
                        if (data.favorite === 'added') {
                            icon.classList.add('text-red-500', 'fill-red-500');
                            icon.classList.remove('text-slate-400', 'hover:text-white');
                        } else {
                            icon.classList.remove('text-red-500', 'fill-red-500');
                            icon.classList.add('text-slate-400', 'hover:text-white');
                        }
                    }
                    showToast(data.favorite === 'added' ? 'Added to Favorites' : 'Removed from Favorites');
                }
            } catch (err) {
                console.error('Favorite toggle failed', err);
            }
        }
        window.playBingDirect = function(e, title, type) {
            if (e && e.stopPropagation) e.stopPropagation();
            window.location.href = `/api/bingr/play?type=${(type === 'series' || type === 'anime') ? 'tv' : 'movie'}&title=${encodeURIComponent(title)}&mode=player`;
        };
        async function playChannel(id, playback_url, name) {
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            if (activeId !== 'portal') {
                let recents = [];
                try {
                    recents = JSON.parse(localStorage.getItem(`recents_${activeId}`) || '[]');
                } catch (e) {}
                if (!Array.isArray(recents)) recents = [];
                recents = recents.filter(rId => rId !== id);
                recents.unshift(id);
                recents = recents.slice(0, 50);
                localStorage.setItem(`recents_${activeId}`, JSON.stringify(recents));
            } else {
                fetch('stalker_api.php?action=add_recent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
            }
            const targetUrl = playback_url || id;
            const lowerTarget = (targetUrl || '').toLowerCase();
            if (activeId !== 'portal' || lowerTarget.startsWith('http://') || lowerTarget.startsWith('https://') || lowerTarget.includes('.m3u') || lowerTarget.includes('m3u8')) {
                window.location.href = `play_consumet.php?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(name)}&source=index.php`;
            } else {
                window.location.href = `iptvplay.php?id=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(name)}&source=index.php`;
            }
        }
        async function clearQuickAccess(type) {
            if (!confirm(`Clear all ${type}?`)) return;
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            if (activeId !== 'portal') {
                if (type === 'favorites') {
                    localStorage.removeItem(`favorites_${activeId}`);
                } else {
                    localStorage.removeItem(`recents_${activeId}`);
                }
                showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} Cleared`);
                fetchChannels();
                return;
            }
            try {
                const action = type === 'favorites' ? 'clear_favorites' : 'clear_recents';
                const response = await fetch('stalker_api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} Cleared`);
                    fetchChannels(); // Refresh channel list to update UI
                }
            } catch (e) {
                showToast('Failed to clear');
            }
        }
        async function clearSystemCache() {
            if (!confirm('Clear portal cache and refresh channels?')) return;
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            if (activeId !== 'portal') {
                localStorage.removeItem(`favorites_${activeId}`);
                localStorage.removeItem(`recents_${activeId}`);
                showToast('Local Data Cleared! Refreshing...');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }
            try {
                const response = await fetch('stalker_api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear_cache' })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    showToast('Cache Cleared! Re-syncing...');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast('Failed to clear cache');
                }
            } catch (e) {
                showToast('Error clearing cache');
            }
        }
        // Interactive EPG 24-Hour Schedule Functions
        async function openEpgModal(e, channelId, channelName) {
            if (e && e.stopPropagation) e.stopPropagation();
            const modal = document.getElementById('epgMatrixModal');
            const titleEl = document.getElementById('epgChannelTitle');
            const loading = document.getElementById('epgMatrixLoading');
            const list = document.getElementById('epgMatrixScheduleList');
            if (titleEl) titleEl.innerText = channelName || 'Channel Guide';
            if (modal) modal.classList.remove('hidden');
            if (loading) loading.classList.remove('hidden');
            if (list) list.innerHTML = '';
            try {
                const res = await fetch(`/api/epg?channelId=${encodeURIComponent(channelId)}`);
                const data = await res.json();
                if (loading) loading.classList.add('hidden');
                if (data && data.status === 'success' && data.epg && data.epg.length > 0) {
                    data.epg.forEach(item => {
                        const progress = item.progress || 0;
                        const el = document.createElement('div');
                        el.className = 'p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-red-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4';
                        el.innerHTML = `
                            <div class="space-y-1.5 flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-0.5 rounded-md bg-red-600/20 text-red-400 font-mono text-[10px] font-bold border border-red-500/20">${item.time}</span>
                                    ${progress > 0 ? `<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider animate-pulse">AIRING NOW (${progress}%)</span>` : ''}
                                </div>
                                <h4 class="text-sm font-bold text-white">${item.name}</h4>
                                <p class="text-xs text-slate-400 line-clamp-2">${item.descr || 'Standard IPTV broadcast feed.'}</p>
                                ${progress > 0 ? `
                                    <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                                        <div class="h-full bg-red-500 rounded-full" style="width: ${progress}%"></div>
                                    </div>
                                ` : ''}
                            </div>
                            <button onclick="playChannel('${channelId}', '', '${(channelName || '').replace(/'/g, "\\'")}')" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider shrink-0 transition-all">
                                Play Stream
                            </button>
                        `;
                        list.appendChild(el);
                    });
                } else {
                    list.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No EPG program guide found for this stream.</p>';
                }
            } catch (err) {
                if (loading) loading.classList.add('hidden');
                if (list) list.innerHTML = '<p class="text-xs text-red-400 text-center py-8">Failed to fetch broadcast schedule.</p>';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        function closeEpgModal() {
            const modal = document.getElementById('epgMatrixModal');
            if (modal) modal.classList.add('hidden');
        }
        function openEpgModalForActive() {
            if (allChannels && allChannels.length > 0) {
                openEpgModal(null, allChannels[0].id, allChannels[0].Name);
            } else {
                openEpgModal(null, 'default_ch', 'Stalker Pro Main Feed');
            }
        }
        function playFeaturedHeroStream() {
            if (allChannels && allChannels.length > 0) {
                const topCh = allChannels[0];
                playChannel(topCh.id, topCh.playback_url, topCh.Name);
            } else {
                showToast('Connecting to featured live stream...');
            }
        }
        function setAudioVolume(val) {
            const player = document.getElementById('audioPlayerIndex');
            if (player) player.volume = parseFloat(val);
        }
        let sleepClockInterval = null;
        function toggleAppSleep(enable = true) {
            const screen = document.getElementById('sleepModeScreen');
            const container = document.getElementById('sleepContainer');
            if (enable) {
                screen.classList.remove('hidden');
                setTimeout(() => {
                    screen.classList.remove('opacity-0', 'pointer-events-none');
                    container.classList.remove('scale-95');
                }, 50);
                updateSleepClock();
                if (sleepClockInterval) clearInterval(sleepClockInterval);
                sleepClockInterval = setInterval(updateSleepClock, 1000);
                showToast('System Entering Sleep Mode');
            } else {
                screen.classList.add('opacity-0', 'pointer-events-none');
                container.classList.add('scale-95');
                setTimeout(() => {
                    screen.classList.add('hidden');
                }, 700);
                if (sleepClockInterval) {
                    clearInterval(sleepClockInterval);
                    sleepClockInterval = null;
                }
                showToast('System Awake');
            }
        }
        function updateSleepClock() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const clockEl = document.getElementById('sleepScreenTime');
            const dateEl = document.getElementById('sleepScreenDate');
            if (clockEl) clockEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
        }
        function showToast(msg) {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[200] px-6 py-3 bg-red-600 text-white text-xs font-bold rounded-full shadow-2xl animate-in slide-in-from-bottom-10';
            toast.innerText = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-10');
                setTimeout(() => toast.remove(), 500);
            }, 2000);
        }
        function toggleMusicPlayer(show) {
            const modal = document.getElementById('musicModal');
            if (show === false) {
                modal.classList.add('hidden');
            } else {
                modal.classList.remove('hidden');
            }
        }
        const playerIndex = document.getElementById('audioPlayerIndex');
        const playPauseBtnIndex = document.getElementById('playPauseBtnIndex');
        const playIconIndex = document.getElementById('playIconIndex');
        const pauseIconIndex = document.getElementById('pauseIconIndex');
        const progressBarIndex = document.getElementById('progressBarIndex');
        const currentTimeElIndex = document.getElementById('currentTimeIndex');
        const durationTimeElIndex = document.getElementById('durationTimeIndex');
        function formatTimeIndex(secs) {
            if (isNaN(secs)) return "0:00";
            const m = Math.floor(secs / 60);
            const s = Math.floor(secs % 60);
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        }
        playerIndex.addEventListener('timeupdate', () => {
            const cur = playerIndex.currentTime || 0;
            const dur = playerIndex.duration || 1;
            currentTimeElIndex.textContent = formatTimeIndex(cur);
            const percent = (cur / dur) * 100;
            progressBarIndex.style.width = `${percent}%`;
        });
        playerIndex.addEventListener('loadedmetadata', () => {
            durationTimeElIndex.textContent = formatTimeIndex(playerIndex.duration);
        });
        function updateMobileMusicWidget(isPlaying) {
            const widget = document.getElementById('mobileMusicContainerIndex');
            const playerBox = document.getElementById('playerContainerIndex');
            const mIcon = document.getElementById('mobilePlayPauseIconIndex');
            if (isPlaying && playerIndex && !playerIndex.paused && playerIndex.src) {
                if (widget) widget.classList.remove('hidden');
                if (playerBox) playerBox.classList.remove('hidden');
                const title = document.getElementById('nowPlayingTitleIndex')?.textContent || 'Playing Music';
                const artist = document.getElementById('nowPlayingArtistIndex')?.textContent || 'Stalker Audio';
                const img = document.getElementById('nowPlayingImgIndex')?.src || '';
                const mTitle = document.getElementById('mobileNowPlayingTitleIndex');
                const mArtist = document.getElementById('mobileNowPlayingArtistIndex');
                const mImg = document.getElementById('mobileNowPlayingImgIndex');
                if (mTitle) mTitle.textContent = title;
                if (mArtist) mArtist.textContent = artist;
                if (mImg && img) mImg.src = img;
                if (mIcon) mIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            } else {
                if (widget) widget.classList.add('hidden');
                if (playerBox) playerBox.classList.add('hidden');
                if (mIcon) mIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        }
        playerIndex.addEventListener('play', () => {
            playIconIndex.classList.add('hidden');
            pauseIconIndex.classList.remove('hidden');
            updateMobileMusicWidget(true);
        });
        playerIndex.addEventListener('pause', () => {
            playIconIndex.classList.remove('hidden');
            pauseIconIndex.classList.add('hidden');
            updateMobileMusicWidget(false);
        });
        let savedMaintenancePlaylist = [];
        let maintenanceMusicMode = 'query';
        let currentMusicQueueIndex = [];
        let currentPlayingIndex = -1;
        let indexVisualizerAnimId = null;
        // Web Audio API Analyzer for synchronization
        let audioCtx = null;
        let analyser = null;
        let sourceNode = null;
        let dataArray = null;
        function initAudioAnalyzer(audioElement) {
            if (audioCtx) return;
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                sourceNode = audioCtx.createMediaElementSource(audioElement);
                sourceNode.connect(analyser);
                analyser.connect(audioCtx.destination);
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            } catch (e) {
                console.warn("Web Audio API blocked or not supported:", e);
            }
        }
        function drawIndexWaveform() {
            const canvas = document.getElementById('visualizerCanvasIndex');
            if (!canvas) return;
            const isPlaying = playerIndex && !playerIndex.paused && playerIndex.currentTime > 0;
            // Show/hide background visualizer wrapper
            const fsContainer = document.getElementById('fsVisualizerContainer');
            if (fsContainer) {
                if (isPlaying) {
                    fsContainer.classList.remove('opacity-0');
                    fsContainer.classList.add('opacity-100');
                } else {
                    fsContainer.classList.remove('opacity-100');
                    fsContainer.classList.add('opacity-0');
                }
            }
            // Real-time Web Audio API synchronization
            let volumeFactor = 1;
            if (isPlaying) {
                initAudioAnalyzer(playerIndex);
                if (analyser && dataArray) {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length; // 0 to 255
                    volumeFactor = average / 16; // scale factor
                    if (volumeFactor < 0.2) volumeFactor = 0.2;
                }
            } else {
                volumeFactor = 0;
            }
            // Draw on visualizerCanvasIndex
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const width = canvas.width = canvas.clientWidth;
                const height = canvas.height = canvas.clientHeight;
                const centerY = height / 2;
                ctx.clearRect(0, 0, width, height);
                ctx.lineWidth = 3;
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, '#f472b6'); // Pink
                gradient.addColorStop(0.5, '#3b82f6'); // Blue
                gradient.addColorStop(1, '#14b8a6'); // Teal
                ctx.strokeStyle = gradient;
                ctx.shadowBlur = isPlaying ? 10 : 0;
                ctx.shadowColor = '#14b8a6';
                ctx.beginPath();
                const pointsCount = 100;
                const sliceWidth = width / pointsCount;
                let x = 0;
                const time = Date.now() * 0.005;
                for (let i = 0; i < pointsCount; i++) {
                    let amplitude = 2;
                    if (isPlaying) {
                        const centerFactor = 1 - Math.abs(i - pointsCount/2) / (pointsCount/2);
                        amplitude = 3 + (Math.sin(i * 0.2 + time) * Math.cos(i * 0.08 - time * 0.6) * 12 * volumeFactor * centerFactor);
                    } else {
                        amplitude = Math.sin(i * 0.1 + time * 0.2) * 2;
                    }
                    const y = centerY + amplitude;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(width, centerY);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            // Draw on fullscreenVisualizerCanvas
            const fsCanvas = document.getElementById('fullscreenVisualizerCanvas');
            if (fsCanvas) {
                const ctx = fsCanvas.getContext('2d');
                const width = fsCanvas.width = fsCanvas.clientWidth;
                const height = fsCanvas.height = fsCanvas.clientHeight;
                const centerY = height / 2;
                ctx.clearRect(0, 0, width, height);
                ctx.lineWidth = 4;
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, '#14b8a6'); // Teal
                gradient.addColorStop(0.5, '#3b82f6'); // Blue
                gradient.addColorStop(1, '#f472b6'); // Pink
                ctx.strokeStyle = gradient;
                ctx.shadowBlur = isPlaying ? 15 : 0;
                ctx.shadowColor = '#3b82f6';
                ctx.beginPath();
                const pointsCount = 150;
                const sliceWidth = width / pointsCount;
                let x = 0;
                const time = Date.now() * 0.003;
                for (let i = 0; i < pointsCount; i++) {
                    let amplitude = 2;
                    if (isPlaying) {
                        const centerFactor = 1 - Math.abs(i - pointsCount/2) / (pointsCount/2);
                        amplitude = 4 + (Math.sin(i * 0.1 + time) * Math.cos(i * 0.05 - time * 0.4) * 25 * volumeFactor * centerFactor);
                    } else {
                        amplitude = Math.sin(i * 0.05 + time * 0.2) * 4;
                    }
                    const y = centerY + amplitude;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(width, centerY);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            indexVisualizerAnimId = requestAnimationFrame(drawIndexWaveform);
        }
        // Start animation loop when DOM loads
        window.addEventListener('DOMContentLoaded', () => {
            drawIndexWaveform();
        });
        playerIndex.addEventListener('ended', () => {
            if (currentPlayingIndex >= 0 && currentPlayingIndex + 1 < currentMusicQueueIndex.length) {
                playTrackIndexByIndex(currentPlayingIndex + 1);
            } else {
                playIconIndex.classList.remove('hidden');
                pauseIconIndex.classList.add('hidden');
                progressBarIndex.style.width = '0%';
                currentTimeElIndex.textContent = '0:00';
                updateMobileMusicWidget(false);
            }
        });
        function togglePlayPauseIndex() {
            if (playerIndex.paused) {
                playerIndex.play().catch(e => console.log('Playback error:', e));
            } else {
                playerIndex.pause();
            }
        }
        function rewindAudioIndex(secs) {
            playerIndex.currentTime = Math.max(0, playerIndex.currentTime - secs);
        }
        function forwardAudioIndex(secs) {
            playerIndex.currentTime = Math.min(playerIndex.duration || 1, playerIndex.currentTime + secs);
        }
        function seekAudioIndex(event) {
            const container = document.getElementById('progressBarContainerIndex');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (!rect || !rect.width) return;
            const clickX = event.clientX - rect.left;
            const width = rect.width;
            const ratio = clickX / width;
            if (playerIndex) {
                const duration = playerIndex.duration || 1;
                playerIndex.currentTime = ratio * duration;
            }
        }
        let myMusicPlaylists = JSON.parse(localStorage.getItem('myMusicPlaylists') || 'null');
        if (!myMusicPlaylists) {
            let legacy = JSON.parse(localStorage.getItem('myPlaylistIndex') || '[]');
            myMusicPlaylists = [{ id: 'default', name: 'My Playlist', tracks: legacy }];
            localStorage.setItem('myMusicPlaylists', JSON.stringify(myMusicPlaylists));
        }
        function showPlaylistsManager() {
            const resultsDiv = document.getElementById('musicResultsIndex');
            resultsDiv.classList.remove('hidden');
            let html = `
                <div class="flex gap-2 mb-4">
                    <input type="text" id="newPlaylistName" placeholder="New Playlist Name..." class="flex-1 bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 text-white">
                    <button onclick="createNewPlaylist()" class="bg-teal-600 hover:bg-teal-500 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Create</button>
                </div>
                <div class="space-y-2">
            `;
            myMusicPlaylists.forEach(pl => {
                html += `
                    <div class="flex items-center justify-between p-3 hover:bg-white/10 rounded-xl cursor-pointer group transition-all" onclick="loadPlaylistIndex('${pl.id}')">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                            </div>
                            <div class="text-left">
                                <div class="text-[13px] font-bold text-gray-200 group-hover:text-white">${pl.name}</div>
                                <div class="text-[10px] text-gray-500">${pl.tracks.length} tracks</div>
                            </div>
                        </div>
                        ${pl.id !== 'default' ? `<button onclick="deletePlaylist('${pl.id}', event)" class="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
            resultsDiv.innerHTML = html;
        }
        function createNewPlaylist() {
            const name = document.getElementById('newPlaylistName').value.trim();
            if(!name) return;
            myMusicPlaylists.push({ id: 'pl_' + Date.now(), name, tracks: [] });
            localStorage.setItem('myMusicPlaylists', JSON.stringify(myMusicPlaylists));
            showPlaylistsManager();
        }
        function deletePlaylist(id, e) {
            e.stopPropagation();
            if(!confirm('Delete this playlist?')) return;
            myMusicPlaylists = myMusicPlaylists.filter(p => p.id !== id);
            localStorage.setItem('myMusicPlaylists', JSON.stringify(myMusicPlaylists));
            showPlaylistsManager();
        }
        function loadPlaylistIndex(id) {
            const pl = myMusicPlaylists.find(p => p.id === id);
            const resultsDiv = document.getElementById('musicResultsIndex');
            if (!pl || pl.tracks.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="flex justify-between items-center mb-4 px-2">
                        <button onclick="showPlaylistsManager()" class="text-[10px] text-teal-500 hover:text-teal-400 font-bold uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg">&larr; Back</button>
                        <span class="text-[11px] font-black text-white uppercase tracking-widest">${pl.name}</span>
                    </div>
                    <div class="text-center text-xs text-gray-500 py-6 font-bold uppercase tracking-widest">Playlist is empty</div>
                `;
                return;
            }
            currentMusicQueueIndex = pl.tracks;
            let html = `
                <div class="flex justify-between items-center mb-4 px-2">
                    <button onclick="showPlaylistsManager()" class="text-[10px] text-teal-500 hover:text-teal-400 font-bold uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg">&larr; Back</button>
                    <span class="text-[11px] font-black text-white uppercase tracking-widest">${pl.name}</span>
                </div>
            `;
            html += currentMusicQueueIndex.map((track, idx) => `
                <div class="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl cursor-pointer group transition-all active:scale-[0.98]" onclick="playTrackIndexByIndex(${idx})">
                    <div class="flex items-center gap-3 overflow-hidden text-left">
                        <img src="${track.img}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                        <div class="overflow-hidden">
                            <div class="text-[13px] font-bold truncate text-gray-200 group-hover:text-white">${track.title.replace(/'/g, "&#39;")}</div>
                            <div class="text-[10px] text-gray-400 truncate">${track.artist.replace(/'/g, "&#39;")}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="removeFromPlaylistIndex('${id}', ${idx}, event)" class="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all flex-shrink-0" title="Remove">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>
            `).join('');
            resultsDiv.innerHTML = html;
        }
        function removeFromPlaylistIndex(plId, idx, event) {
            event.stopPropagation();
            const pl = myMusicPlaylists.find(p => p.id === plId);
            if(pl) {
                pl.tracks.splice(idx, 1);
                localStorage.setItem('myMusicPlaylists', JSON.stringify(myMusicPlaylists));
                loadPlaylistIndex(plId);
            }
        }
        let pendingTrackToAdd = null;
        function addToPlaylistIndex(idx, event) {
            event.stopPropagation();
            pendingTrackToAdd = currentMusicQueueIndex[idx];
            const resultsDiv = document.getElementById('musicResultsIndex');
            const originalHTML = resultsDiv.innerHTML;
            resultsDiv.innerHTML = `
                <div class="text-center mb-4 mt-2 text-[10px] font-black text-teal-500 uppercase tracking-widest">Select Playlist to Add</div>
                <div class="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                ${myMusicPlaylists.map(pl => `
                    <div onclick="confirmAddToPlaylist('${pl.id}')" class="p-3 bg-white/5 hover:bg-teal-500/20 rounded-xl cursor-pointer text-xs font-bold text-white transition-all text-left flex justify-between items-center group">
                        <span>${pl.name}</span>
                        <span class="text-[10px] text-gray-500 group-hover:text-teal-400">${pl.tracks.length} tracks</span>
                    </div>
                `).join('')}
                </div>
                <button onclick="searchMusicIndex(document.getElementById('musicSearchIndex').value || 'Arijit Singh')" class="mt-4 w-full py-3 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all">Cancel</button>
            `;
        }
        function confirmAddToPlaylist(plId) {
            const pl = myMusicPlaylists.find(p => p.id === plId);
            if(pl && pendingTrackToAdd) {
                if(!pl.tracks.find(t => t.url === pendingTrackToAdd.url)) {
                    pl.tracks.push(pendingTrackToAdd);
                    localStorage.setItem('myMusicPlaylists', JSON.stringify(myMusicPlaylists));
                    showToast('Added to ' + pl.name);
                } else {
                    showToast('Already in ' + pl.name);
                }
            }
            searchMusicIndex(document.getElementById('musicSearchIndex').value || 'Arijit Singh');
        }
        async function searchMusicIndex(presetQuery) {
            const query = presetQuery || document.getElementById('musicSearchIndex').value.trim();
            if (presetQuery) document.getElementById('musicSearchIndex').value = presetQuery;
            if (!query) return;
            const resultsDiv = document.getElementById('musicResultsIndex');
            resultsDiv.innerHTML = '<div class="text-center text-xs text-cyan-400 py-4 font-bold flex items-center justify-center gap-2"><div class="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div> Fetching JioSaavn 320kbps Audio...</div>';
            resultsDiv.classList.remove('hidden');
            try {
                let tracks = [];
                let fetchedSuccess = false;
                // 1. Query Official JioSaavn 320kbps Master Engine
                try {
                    const searchRes = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
                    const searchData = await searchRes.json();
                    const list = Array.isArray(searchData) ? searchData : (searchData.tracks || searchData.results || []);
                    if (Array.isArray(list) && list.length > 0) {
                        currentMusicQueueIndex = list.map(item => ({
                            url: item.streamUrl || item.url,
                            title: item.title,
                            artist: item.artist,
                            img: item.artwork || item.img || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=150&h=150',
                            duration: item.durationFormatted || item.duration || '3:30',
                            isSaavn: true
                        })).filter(t => t.url);
                        fetchedSuccess = true;
                    }
                } catch (e) {
                    console.warn("JioSaavn search failed...", e);
                }
                // 3. Fallback to Internet Archive if needed
                if (!fetchedSuccess) {
                    try {
                        const searchRes = await fetch(`https://archive.org/advancedsearch.php?q=(${encodeURIComponent(query)}) AND mediatype:(audio)&fl[]=identifier,title,creator,album,length&rows=15&output=json`);
                        const json = await searchRes.json();
                        if (json.response && json.response.docs) {
                            const archiveTracks = json.response.docs.map(doc => {
                                const identifier = doc.identifier;
                                if (!identifier) return null;
                                const title = doc.title || identifier;
                                const artist = doc.creator || 'Archive Creator';
                                const imgUrl = `https://archive.org/services/img/${identifier}`;
                                return {
                                    url: '',
                                    title: title,
                                    artist: artist,
                                    img: imgUrl,
                                    isArchive: true,
                                    identifier: identifier
                                };
                            }).filter(Boolean);
                            if (archiveTracks.length > 0) {
                                currentMusicQueueIndex = archiveTracks;
                                fetchedSuccess = true;
                            }
                        }
                    } catch (e) {
                        console.warn("Archive.org failed too...", e);
                    }
                }
                if (tracks && tracks.length > 0) {
                    currentMusicQueueIndex = tracks.map(track => {
                        let artwork = '';
                        if (Array.isArray(track.image)) {
                            artwork = track.image.find(i => i.quality === '150x150')?.link || track.image[0]?.link;
                        } else {
                            artwork = track.image || '';
                        }
                        if (!artwork) artwork = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=150&h=150';
                        let streamUrl = '';
                        const downloadUrls = track.download_url || track.downloadUrl;
                        if (Array.isArray(downloadUrls)) {
                            streamUrl = downloadUrls.find(d => d.quality === '320kbps' || d.quality === '160kbps')?.link || downloadUrls[0]?.link || downloadUrls[0]?.url;
                        } else {
                            streamUrl = track.url || '';
                        }
                        let artistName = track.subtitle || '';
                        if (!artistName && track.primaryArtists) {
                            artistName = track.primaryArtists;
                        } else if (!artistName && track.artist_map?.primary_artists) {
                            artistName = track.artist_map.primary_artists.map(a => a.name).join(', ');
                        }
                        if (!artistName) artistName = 'Unknown Artist';
                        return {
                            url: streamUrl,
                            title: track.name || track.title || 'Unknown',
                            artist: artistName,
                            img: artwork
                        };
                    }).filter(t => t.url);
                }
                if (currentMusicQueueIndex && currentMusicQueueIndex.length > 0) {
                    resultsDiv.innerHTML = currentMusicQueueIndex.map((track, idx) => `
                        <div class="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl cursor-pointer group transition-all active:scale-[0.98]" onclick="playTrackIndexByIndex(${idx})">
                            <div class="flex items-center gap-3 overflow-hidden text-left">
                                <img src="${track.img}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                                <div class="overflow-hidden">
                                    <div class="text-[13px] font-bold truncate text-gray-200 group-hover:text-white">${(track.title || '').replace(/'/g, "&#39;")}</div>
                                    <div class="text-[10px] text-gray-400 truncate">${(track.artist || '').replace(/'/g, "&#39;")}</div>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="addToPlaylistIndex(${idx}, event)" class="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 hover:bg-teal-500 hover:text-white flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0" title="Add to Playlist">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                </button>
                                <div class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    resultsDiv.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 font-bold uppercase tracking-widest">No tracks found</div>';
                }
            } catch (err) {
                console.error(err);
                resultsDiv.innerHTML = '<div class="text-center text-xs text-red-500 py-4 font-bold">Error connecting to Music API</div>';
            }
        }
        async function downloadCurrentTrackIndex() {
            if (currentPlayingIndex < 0 || currentPlayingIndex >= currentMusicQueueIndex.length) return;
            const track = currentMusicQueueIndex[currentPlayingIndex];
            const btn = document.getElementById('downloadBtnIndex');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
            try {
                let downloadUrl = track.url;
                if (track.isArchive && !track.url) {
                    const metaRes = await fetch(`https://archive.org/metadata/${track.identifier}`);
                    const metaJson = await metaRes.json();
                    if (metaJson.files && metaJson.files.length > 0) {
                        const mp3File = metaJson.files.find(f => f.name.toLowerCase().endsWith('.mp3') && f.format && f.format.toLowerCase().includes('mp3'));
                        const fileToPlay = mp3File || metaJson.files.find(f => f.name.toLowerCase().endsWith('.mp3')) || metaJson.files[0];
                        if (fileToPlay) {
                            downloadUrl = `https://archive.org/download/${track.identifier}/${encodeURIComponent(fileToPlay.name)}`;
                            track.url = downloadUrl;
                        }
                    }
                }
                if (!downloadUrl) {
                    downloadUrl = `https://archive.org/download/${track.identifier}/${track.identifier}.mp3`;
                }
                const response = await fetch(downloadUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `${track.title}.mp3`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.error("Download failed", e);
                const fallbackUrl = track.url || `https://archive.org/download/${track.identifier}/${track.identifier}.mp3`;
                window.open(fallbackUrl, '_blank');
            }
            btn.innerHTML = originalHTML;
        }
        async function playTrackIndexByIndex(idx, startMuted = false) {
            if (idx < 0 || idx >= currentMusicQueueIndex.length) return;
            currentPlayingIndex = idx;
            const track = currentMusicQueueIndex[idx];
            document.getElementById('nowPlayingTitleIndex').textContent = track.title;
            document.getElementById('nowPlayingArtistIndex').textContent = track.artist;
            document.getElementById('nowPlayingImgIndex').src = track.img;
            // setup direct download
            const dBtn = document.getElementById('downloadBtnIndex');
            dBtn.removeAttribute('download');
            dBtn.href = "#";
            dBtn.onclick = function(e) {
                e.preventDefault();
                downloadCurrentTrackIndex();
            };
            playerIndex.crossOrigin = "anonymous";
            let playUrl = track.url;
            if (track.isArchive && !track.url) {
                try {
                    const metaRes = await fetch(`https://archive.org/metadata/${track.identifier}`);
                    const metaJson = await metaRes.json();
                    if (metaJson.files && metaJson.files.length > 0) {
                        const mp3File = metaJson.files.find(f => f.name.toLowerCase().endsWith('.mp3') && f.format && f.format.toLowerCase().includes('mp3'));
                        const fileToPlay = mp3File || metaJson.files.find(f => f.name.toLowerCase().endsWith('.mp3')) || metaJson.files[0];
                        if (fileToPlay) {
                            playUrl = `https://archive.org/download/${track.identifier}/${encodeURIComponent(fileToPlay.name)}`;
                            track.url = playUrl;
                        } else {
                            playUrl = `https://archive.org/download/${track.identifier}/${track.identifier}.mp3`;
                        }
                    } else {
                        playUrl = `https://archive.org/download/${track.identifier}/${track.identifier}.mp3`;
                    }
                } catch (err) {
                    playUrl = `https://archive.org/download/${track.identifier}/${track.identifier}.mp3`;
                }
            }
            
            let audioSrc = '';
            if (playUrl && playUrl.startsWith('http') && !playUrl.includes('youtube.com') && !playUrl.includes('youtu.be')) {
                audioSrc = '/api/music/proxy?url=' + encodeURIComponent(playUrl);
            } else if (track.videoId || (playUrl && (playUrl.includes('youtube.com') || playUrl.includes('youtu.be')))) {
                let vid = track.videoId || '';
                if (!vid && playUrl) {
                    if (playUrl.includes('v=')) {
                        vid = playUrl.split('v=')[1].split('&')[0];
                    } else if (playUrl.includes('youtu.be/')) {
                        vid = playUrl.split('youtu.be/')[1].split('?')[0].split('&')[0];
                    }
                }
                audioSrc = '/api/v1/youtube/stream?v=' + encodeURIComponent(vid) + '&type=audio';
            } else if (playUrl) {
                audioSrc = playUrl;
            }
            
            playerIndex.src = audioSrc;
            document.getElementById('playerContainerIndex').classList.remove('hidden');
            playerIndex.muted = false;
            playerIndex.play().catch(e => console.log("Play blocked", e));
        }
        function playPrevTrackIndex() {
            if (currentMusicQueueIndex.length === 0) return;
            let prevIdx = currentPlayingIndex - 1;
            if (prevIdx < 0) prevIdx = currentMusicQueueIndex.length - 1;
            playTrackIndexByIndex(prevIdx);
        }
        function playNextTrackIndex() {
            if (currentMusicQueueIndex.length === 0) return;
            let nextIdx = currentPlayingIndex + 1;
            if (nextIdx >= currentMusicQueueIndex.length) nextIdx = 0;
            playTrackIndexByIndex(nextIdx);
        }
        function playTrackIndex(url, title, artist, img) {
            document.getElementById('nowPlayingTitleIndex').textContent = title;
            document.getElementById('nowPlayingArtistIndex').textContent = artist;
            document.getElementById('nowPlayingImgIndex').src = img;
            playerIndex.src = url;
            document.getElementById('playerContainerIndex').classList.remove('hidden');
            playerIndex.play().catch(e => console.log("Play blocked", e));
        }
        // KEYBOARD SHORTCUTS
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            // Functional Shortcuts
            if (e.key.toLowerCase() === 'm') { openM3UModal(); return; }
            if (e.key.toLowerCase() === 's') { e.preventDefault(); toggleSubtitleModal(true); return; }
            if (e.key.toLowerCase() === 'v') { fetchSavedPortals(); return; }
            if (e.key.toLowerCase() === 't') { toggleMusicPlayer(); return; }
            if (e.key.toLowerCase() === 'p') {
                e.preventDefault();
                document.body.classList.toggle('unmasked');
                if (!document.getElementById('portalModal').classList.contains('hidden')) {
                    fetchSavedPortals();
                }
                showToast('Privacy Mode', document.body.classList.contains('unmasked') ? 'OFF - Credentials Unmasked' : 'ON - Credentials Masked', 'info');
                return;
            }
            const grid = document.getElementById('channelGrid');
            const cards = grid.querySelectorAll('.channel-card');
            if (cards.length === 0) return;
            let currentIndex = -1;
            cards.forEach((card, i) => {
                if (card.classList.contains('ring-4')) currentIndex = i;
            });
            const columns = window.innerWidth >= 1280 ? 6 : (window.innerWidth >= 1024 ? 5 : (window.innerWidth >= 768 ? 4 : 2));
            let nextIndex = currentIndex;
            if (e.key === 'ArrowRight') nextIndex = Math.min(currentIndex + 1, cards.length - 1);
            else if (e.key === 'ArrowLeft') nextIndex = Math.max(currentIndex - 1, 0);
            else if (e.key === 'ArrowDown') nextIndex = Math.min(currentIndex + columns, cards.length - 1);
            else if (e.key === 'ArrowUp') nextIndex = Math.max(currentIndex - columns, 0);
            else if (e.key === 'Enter' && currentIndex !== -1) {
                cards[currentIndex].querySelector('a').click();
                return;
            } else if (e.key === 'f' && currentIndex !== -1) {
                cards[currentIndex].querySelector('[onclick^="toggleFavorite"]').click();
                return;
            } else if (e.key === '/' || e.key === 's') {
                document.getElementById('searchInput').focus();
                e.preventDefault();
                return;
            }
            if (nextIndex !== currentIndex) {
                if (currentIndex !== -1) cards[currentIndex].classList.remove('ring-4', 'ring-red-500', 'scale-105', 'z-20');
                if (nextIndex === -1) nextIndex = 0;
                cards[nextIndex].classList.add('ring-4', 'ring-red-500', 'scale-105', 'z-20');
                cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                e.preventDefault();
            }
        });
        let currentMediaType = 'live';
        let isXtreamPortal = false;
        async function checkPortalType() {
            const activeId = localStorage.getItem('active_playlist_id') || 'portal';
            const bar = document.getElementById('liveStatusBar');
            if (activeId !== 'portal') {
                document.getElementById('mediaTypeSelector').classList.add('hidden');
                bar.classList.add('hidden');
                return;
            }
            try {
                const response = await fetch('stalker_api.php?action=login_details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                const dot = document.getElementById('statusDot');
                const pName = document.getElementById('statusPortalName');
                const pUrl = document.getElementById('statusUrl');
                const pCon = document.getElementById('statusConnections');
                const pType = document.getElementById('statusType');
                const core = (data && data.STALKER && data.STALKER.statusCode === 200) ? data.STALKER : (data && data.active_portal ? data.active_portal : null);
                if (core) {
                    bar.classList.remove('hidden');
                    pName.textContent = core.Name || 'Active Portal';
                    pUrl.textContent = core.URL || '';
                    pType.textContent = core.type === 'xtream' ? 'XTREAM' : 'STALKER';
                    if (core.type === 'xtream') {
                        let active = 0;
                        let max = 0;
                        if (core.data && core.data.user_info) {
                            const info = core.data.user_info;
                            active = info.active_connections !== undefined ? parseInt(info.active_connections) : 0;
                            max = info.max_connections !== undefined ? parseInt(info.max_connections) : 0;
                        }
                        if (max > 0) {
                            pCon.textContent = `Connections: ${active}/${max}`;
                            if (active >= max) {
                                dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0";
                                pCon.innerHTML = `<span class="text-amber-500">Connections Limited: ${active}/${max}</span>`;
                            } else {
                                dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0";
                            }
                        } else {
                            pCon.textContent = '';
                            dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0";
                        }
                        isXtreamPortal = true;
                        document.getElementById('mediaTypeSelector').classList.remove('hidden');
                    } else {
                        pCon.textContent = '';
                        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0";
                        isXtreamPortal = false;
                        document.getElementById('mediaTypeSelector').classList.remove('hidden');
                    }
                } else {
                    bar.classList.add('hidden');
                    document.getElementById('mediaTypeSelector').classList.add('hidden');
                }
            } catch (e) {
                console.error('Error checking portal type:', e);
                bar.classList.add('hidden');
            }
        }
        async function setMediaType(type) {
            if (currentMediaType === type) return;
            currentMediaType = type;
            // update tabs
            const tabs = ['live', 'movie', 'series'];
            tabs.forEach(t => {
                const btn = document.getElementById(`mediaTab_${t}`);
                if (btn) {
                    if (t === type) {
                        btn.className = "flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-wider transition-all border border-red-500/20 shadow-lg shadow-red-600/10";
                    } else {
                        btn.className = "flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 text-slate-400 text-xs font-black uppercase tracking-wider transition-all border border-white/5 hover:bg-white/10";
                    }
                }
            });
            // update search input placeholder
            const input = document.getElementById('searchInput');
            const mInput = document.getElementById('mobileSearch');
            let term = 'channel';
            if (type === 'movie') term = 'movie';
            if (type === 'series') term = 'series';
            if (input) input.placeholder = `Find a ${term}...`;
            if (mInput) mInput.placeholder = `Search ${term}s...`;
            currentGenre = 'all';
            await fetchChannels();
        }
        function toggleSeriesDetailsModal(show) {
            document.getElementById('seriesDetailsModal').classList.toggle('hidden', !show);
        }
        async function showSeriesDetails(seriesId, seriesName) {
            toggleSeriesDetailsModal(true);
            const content = document.getElementById('seriesDetailsContent');
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 space-y-4">
                    <svg class="w-12 h-12 text-slate-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Series Details...</p>
                </div>
            `;
            try {
                const response = await fetch(`stalker_api.php?action=series_info&series_id=${seriesId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (data.error) {
                    content.innerHTML = `<div class="text-center text-red-500 text-xs font-bold py-10">${data.error}</div>`;
                    return;
                }
                const info = data.info || {};
                const episodes = data.episodes || {};
                const seasons = Object.keys(episodes).sort((a, b) => parseInt(a) - parseInt(b));
                if (seasons.length === 0) {
                    content.innerHTML = `<div class="text-center text-slate-500 text-xs font-bold py-10">No episodes available.</div>`;
                    return;
                }
                let infoHtml = `
                    <div class="flex flex-col md:flex-row gap-6 mb-8 bg-white/5 p-6 rounded-[2rem] border border-white/5 text-left">
                        ${info.cover ? `<img src="${info.cover}" class="w-32 h-44 object-cover rounded-2xl shadow-xl border border-white/10 mx-auto md:mx-0" onerror="this.src='data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>')}'">` : ''}
                        <div class="flex-1 space-y-3">
                            <h4 class="text-lg font-black text-white leading-tight uppercase tracking-tight text-center md:text-left">${seriesName}</h4>
                            <div class="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                ${info.releaseDate ? `<span class="text-[8px] font-black text-slate-300 bg-white/10 px-2.5 py-1 rounded-full uppercase">${info.releaseDate}</span>` : ''}
                                ${info.rating ? `<span class="text-[8px] font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full uppercase">★ ${info.rating}</span>` : ''}
                                ${info.genre ? `<span class="text-[8px] font-black text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full uppercase">${info.genre}</span>` : ''}
                            </div>
                            <p class="text-xs text-slate-400 leading-relaxed text-center md:text-left">${info.plot || 'No synopsis available.'}</p>
                        </div>
                    </div>
                `;
                let seasonsHtml = seasons.map((seasonNum, sIdx) => {
                    const seasonEpisodes = episodes[seasonNum] || [];
                    const isFirst = sIdx === 0;
                    const epsListHtml = seasonEpisodes.map(ep => {
                        const playbackId = seriesId.startsWith('stalker_series_')
                            ? `stalker_series_episode_${ep.id}_${ep.container_extension || 'mp4'}`
                            : `xtream_series_episode_${ep.id}_${ep.container_extension || 'mp4'}`;
                        const safeTitle = (ep.title || `Episode ${ep.episode_num}`).replace(/'/g, "\\'");
                        const safeSeriesTitle = (seriesName || '').replace(/'/g, "\\'");
                        return `
                            <div class="flex items-center justify-between p-3.5 hover:bg-white/10 rounded-2xl group transition-all text-left bg-[#121822] border border-white/5 hover:border-red-500/50">
                                <div onclick="playChannel('${playbackId}', '', '${safeTitle}')" class="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer">
                                    <div class="w-8 h-8 rounded-full bg-red-600/10 text-red-500 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all">
                                        ${ep.episode_num}
                                    </div>
                                    <div class="overflow-hidden">
                                        <div class="text-[12px] font-bold text-slate-200 group-hover:text-white truncate">${ep.title || `Episode ${ep.episode_num}`}</div>
                                        ${ep.info?.plot ? `<div class="text-[10px] text-slate-500 truncate mt-0.5">${ep.info.plot}</div>` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); playEpisodeBing('${safeSeriesTitle}', ${seasonNum}, ${ep.episode_num}, '${safeTitle}')" class="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-black uppercase flex items-center gap-1 transition-all border border-indigo-500/30 shadow cursor-pointer" title="Stream via Bingr Multi-Cluster Engine">
                                        <i data-lucide="zap" class="w-3 h-3 text-indigo-300"></i>
                                        <span>Bing</span>
                                    </button>
                                    <div onclick="playChannel('${playbackId}', '', '${safeTitle}')" class="w-8 h-8 rounded-full bg-white/5 text-slate-400 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all cursor-pointer">
                                        <i data-lucide="play" class="w-4 h-4 fill-current"></i>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    return `
                        <div class="mb-6 text-left">
                            <button onclick="toggleSeasonAccordion(this)" class="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-wider text-slate-300">
                                <span class="flex items-center gap-2">
                                    <i data-lucide="folder-open" class="w-4 h-4 text-red-500"></i> Season ${seasonNum}
                                </span>
                                <span class="text-[10px] text-slate-500 font-bold">${seasonEpisodes.length} Episodes</span>
                            </button>
                            <div class="season-content ${isFirst ? '' : 'hidden'} space-y-2 mt-3 pl-2 border-l border-white/5">
                                ${epsListHtml}
                            </div>
                        </div>
                    `;
                }).join('');
                content.innerHTML = infoHtml + `<h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">SEASONS</h4>` + seasonsHtml;
                lucide.createIcons();
            } catch (err) {
                console.error(err);
                content.innerHTML = `<div class="text-center text-red-500 text-xs font-bold py-10">Failed to load series details</div>`;
            }
        }
        function toggleSeasonAccordion(btn) {
            const container = btn.nextElementSibling;
            if (container) {
                container.classList.toggle('hidden');
            }
        }

        window.playEpisodeBing = async function(title, season, episode, epTitle) {
            try {
                const payload = {
                    type: 'tv',
                    title: title,
                    season: Number(season),
                    episode: Number(episode),
                    srv: 's40'
                };
                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                let malParam = '';
                try {
                    const savedMal = (data?.tmdbId ? localStorage.getItem('stalker_mal_id_' + data.tmdbId) : null) || localStorage.getItem('stalker_mal_id_' + title.toLowerCase().trim());
                    if (savedMal) malParam = `&malId=${encodeURIComponent(savedMal)}`;
                } catch (e) {}

                if (data && (data.status === 'success' || data.success) && (data.primaryM3u8 || data.streamUrl)) {
                    const stream = data.primaryM3u8 || data.streamUrl;
                    const fullTitle = `${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}: ${epTitle}`;
                    const tmdbParam = data.tmdbId ? `&id=${data.tmdbId}&tmdbId=${data.tmdbId}` : '';
                    window.location.href = `/play_bingr.php?url=${encodeURIComponent(stream)}&name=${encodeURIComponent(fullTitle)}&title=${encodeURIComponent(title)}&media_type=tv&type=tv&season=${season}&episode=${episode}&s=${season}&e=${episode}&srv=${data.serverId || data.server || 'framex'}${tmdbParam}${malParam}&source=index.php`;
                } else {
                    const tmdbParam = data?.tmdbId ? `&id=${data.tmdbId}&tmdbId=${data.tmdbId}` : '';
                    window.location.href = `/play_bingr.php?type=tv&media_type=tv&title=${encodeURIComponent(title)}&name=${encodeURIComponent(fullTitle || title)}&season=${season}&episode=${episode}&s=${season}&e=${episode}&srv=framex${tmdbParam}${malParam}&source=index.php`;
                }
            } catch(e) {
                let malParam = '';
                try {
                    const savedMal = localStorage.getItem('stalker_mal_id_' + title.toLowerCase().trim());
                    if (savedMal) malParam = `&malId=${encodeURIComponent(savedMal)}`;
                } catch (err) {}
                window.location.href = `/play_bingr.php?type=tv&media_type=tv&title=${encodeURIComponent(title)}&name=${encodeURIComponent(title)}&season=${season}&episode=${episode}&s=${season}&e=${episode}&srv=framex${malParam}&source=index.php`;
            }
        };
        document.getElementById('searchInput').addEventListener('input', resetAndLoad);
        document.getElementById('mobileSearch').addEventListener('input', resetAndLoad);
        const observer = new IntersectionObserver((e) => {
            if (e[0].isIntersecting) loadMore();
        }, {
            threshold: 0.1
        });
        observer.observe(document.getElementById('loadMoreTrigger'));
        document.body.addEventListener('click', () => {
            initAudioAnalyzer(playerIndex);
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (playerIndex.muted) {
                playerIndex.muted = false;
                console.log("Unmuted main index background music");
            }
        });
        function renderSavedPlaylistHTMLIndex() {
            const resultsDiv = document.getElementById('musicResultsIndex');
            if (!resultsDiv) return;
            resultsDiv.innerHTML = currentMusicQueueIndex.map((track, idx) => `
                <div class="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl cursor-pointer group transition-all active:scale-[0.98]" onclick="playTrackIndexByIndex(${idx})">
                    <div class="flex items-center gap-3 overflow-hidden text-left">
                        <img src="${track.img}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                        <div class="overflow-hidden">
                            <div class="text-[13px] font-bold truncate text-gray-200 group-hover:text-white">${track.title.replace(/'/g, "&#39;")}</div>
                            <div class="text-[10px] text-gray-400 truncate">${track.artist.replace(/'/g, "&#39;")}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="addToPlaylistIndex(${idx}, event)" class="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 hover:bg-teal-500 hover:text-white flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0" title="Add to Playlist">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                        <div class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                </div>
            `).join('');
            resultsDiv.classList.remove('hidden');
        }
        window.addEventListener('DOMContentLoaded', () => {
            fetchChannels();
            // Client-side retrieve maintenance settings to fetch saved tracks
            fetch('/api/admin/maintenance')
                .then(res => res.json())
                .then(data => {
                    if (data && data.maintenanceMusicPlaylist) {
                        const playlist = data.maintenanceMusicPlaylist;
                        const mode = data.maintenanceMusicMode || 'query';
                        if (mode === 'query' && playlist && playlist.length > 0) {
                            currentMusicQueueIndex = playlist;
                            renderSavedPlaylistHTMLIndex();
                            playTrackIndexByIndex(0, true);
                        }
                    }
                })
                .catch(err => console.warn("Failed to retrieve maintenance music queue:", err));
        });
    </script>
    <!-- Full-Width Background Visualizer Wave -->
    <div id="fsVisualizerContainer" class="fixed bottom-0 left-0 right-0 h-16 pointer-events-none z-[49] overflow-hidden transition-opacity duration-700 opacity-0">
        <canvas id="fullscreenVisualizerCanvas" class="w-full h-full opacity-50"></canvas>
    </div>
    <script src="assets/tv-navigation.js"></script>
<script src="/watchdog.js" id="maintenance-watchdog"></script>

<script src="/cast-pwa-helper.js"></script>
<script src="/tv-remote.js"></script>
    <link rel="stylesheet" href="/local-ai.css?v=gemini-3.5-v3">
    <script src="/local-ai.js?v=gemini-3.5-v3"></script>
</body>
</html>