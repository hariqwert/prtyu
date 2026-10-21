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
if ($srv === '{{SRV}}' || empty($srv)) $srv = 'm4u';
$directUrl = isset($_GET['url']) ? $_GET['url'] : '{{URL}}';
if ($directUrl === '{{URL}}') $directUrl = '';
$source = isset($_GET['source']) ? $_GET['source'] : 'consumet.html';
$malId = isset($_GET['malId']) ? $_GET['malId'] : (isset($_GET['mal_id']) ? $_GET['mal_id'] : (isset($_GET['mal']) ? $_GET['mal'] : ''));
$anilistId = isset($_GET['anilistId']) ? $_GET['anilistId'] : (isset($_GET['anilist_id']) ? $_GET['anilist_id'] : (isset($_GET['anilist']) ? $_GET['anilist'] : ''));
$imdbId = isset($_GET['imdbId']) ? $_GET['imdbId'] : (isset($_GET['imdb_id']) ? $_GET['imdb_id'] : (isset($_GET['imdb']) ? $_GET['imdb'] : ''));
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    <title><?php echo htmlspecialchars($title); ?> | Bingr 4K Cinema Player</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <script src="/search_launcher.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script>
        window.resolveBackUrl = function() {
            let s = '';
            let fromTab = '';
            try {
                const p = new URLSearchParams(window.location.search);
                s = p.get('source') || (typeof SOURCE_ORIGIN !== 'undefined' ? SOURCE_ORIGIN : '') || '<?php echo addslashes($source); ?>' || '';
                fromTab = p.get('from_tab') || p.get('tab') || '';
            } catch(e) {}
            if (!fromTab) {
                try { fromTab = sessionStorage.getItem('consumet_last_tab') || ''; } catch(e) {}
            }
            s = String(s).trim().toLowerCase();
            const tabParam = (fromTab && fromTab !== 'home') ? ('#' + fromTab) : '';
            if (!s || s === 'null' || s === 'undefined') return '/consumet.html' + tabParam;
            if (s.includes('hero')) return '/hero.html';
            if (s.includes('stalker') || s.includes('portal')) return '/index.php';
            if (s.includes('music')) return '/music.html';
            if (s.includes('consumet')) return '/consumet.html' + tabParam;
            if (s.endsWith('.html') || s.endsWith('.php')) {
                return (s.startsWith('/') ? s : ('/' + s)) + tabParam;
            }
            return '/consumet.html' + tabParam;
        };
        window.handleGoBack = function() {
            try { sessionStorage.setItem('consumet_player_opened', '1'); } catch(e) {}
            try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
            try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{}); } catch(e) {}
            const targetUrl = window.resolveBackUrl ? window.resolveBackUrl() : '/consumet.html';
            const ref = document.referrer || '';
            const isHostReferrer = ref && ref.includes(window.location.host);
            const isPlayerReferrer = ref && (ref.includes('play_bingr') || ref.includes('play_consumet') || ref.includes('play.php') || ref.includes('video.php'));
            if (window.history.length > 1 && isHostReferrer && !isPlayerReferrer) {
                window.history.back();
            } else {
                window.location.href = targetUrl;
            }
        };
    </script>
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
            height: 100dvh;
            min-height: 100dvh;
            max-height: 100dvh;
            background-color: #000;
            color: #fff;
            overflow: hidden;
            position: fixed;
            inset: 0;
        }

        #playerContainer {
            position: relative;
            width: 100%;
            height: 100%;
            height: 100dvh;
            max-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            transition: transform 0.3s ease;
            overflow: hidden;
        }

        /* Fullscreen Cinema Styles */
        body.is-fullscreen #playerContainer,
        #playerContainer.fullscreen-active {
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
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
            background: rgba(10, 10, 14, 0.90);
            backdrop-filter: blur(28px) saturate(180%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .glass-sub-panel {
            background: rgba(14, 14, 20, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(20px);
        }
        .glass-btn, .ott-btn {
            background: rgba(18, 18, 24, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.14);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: #ffffff;
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }
        .glass-btn:hover, .ott-btn:hover {
            background: rgba(32, 32, 42, 0.92);
            border-color: rgba(255, 255, 255, 0.35);
            color: #ffffff;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        .glass-btn:active, .ott-btn:active {
            transform: scale(0.92);
            background: rgba(14, 14, 18, 0.95);
        }
        .ott-segmented {
            background: rgba(12, 12, 16, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 9999px;
            padding: 2.5px;
            display: inline-flex;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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

        /* Timeline Scrubber - Ultra High Visibility & Smooth Touch */
        .timeline-container {
            position: relative;
            height: 32px !important;
            display: flex;
            align-items: center;
            cursor: pointer;
            touch-action: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            width: 100% !important;
            padding: 8px 0 !important;
            z-index: 20;
        }
        .timeline-track {
            position: relative;
            width: 100%;
            height: 6px !important;
            background: rgba(255, 255, 255, 0.28) !important;
            border-radius: 9999px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
            transition: height 0.15s ease;
        }
        .timeline-container:hover .timeline-track,
        .timeline-container.is-scrubbing .timeline-track {
            height: 8px !important;
        }
        .timeline-buffer {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.45);
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
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.85);
        }
        .timeline-thumb {
            position: absolute;
            top: 50%;
            width: 16px !important;
            height: 16px !important;
            border-radius: 50%;
            background: #ffffff !important;
            border: 2.5px solid #ef4444 !important;
            transform: translate(-50%, -50%) scale(1) !important;
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
            pointer-events: none;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.95), 0 2px 6px rgba(0,0,0,0.6) !important;
            z-index: 25;
        }
        .timeline-container:hover .timeline-thumb,
        .timeline-container.is-scrubbing .timeline-thumb {
            transform: translate(-50%, -50%) scale(1.35) !important;
            box-shadow: 0 0 18px rgba(239, 68, 68, 1), 0 0 0 6px rgba(239, 68, 68, 0.3) !important;
        }

        /* Touch & Mobile Scrubber Polish */
        @media (max-width: 1024px), (pointer: coarse) {
            .timeline-thumb {
                transform: translate(-50%, -50%) scale(1) !important;
                width: 16px !important;
                height: 16px !important;
            }
            .timeline-track {
                height: 6px !important;
            }
            .timeline-container {
                height: 36px !important;
            }
        }

        /* Mobile Slide-Up Animations & Touch Ripples */
        @keyframes slideUpSheet {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
            animation: slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .double-tap-ripple {
            position: absolute;
            top: 50%;
            width: 90px;
            height: 90px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 75%);
            pointer-events: none;
            animation: ripplePop 0.5s ease-out forwards;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 40;
            backdrop-filter: blur(8px);
        }
        @keyframes ripplePop {
            0% { opacity: 0; transform: translateY(-50%) scale(0.6); }
            45% { opacity: 1; transform: translateY(-50%) scale(1.15); }
            100% { opacity: 0; transform: translateY(-50%) scale(1.4); }
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
            display: none;
            align-items: center;
            gap: 8px;
            background: rgba(10, 10, 14, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.25);
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
        .apple-skip-btn.show {
            display: flex !important;
        }
        .apple-skip-btn:hover {
            transform: scale(1.05);
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.45);
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

        /* ==========================================================================
           MOBILE & TABLET ADAPTIVE CONTROLS SYSTEM
           ========================================================================== */
        .mobile-controls-cluster {
            display: flex !important;
        }
        .desktop-controls-cluster {
            display: none !important;
        }

        @media (min-width: 900px) and (min-height: 540px) and (pointer: fine) {
            .mobile-controls-cluster {
                display: none !important;
            }
            .desktop-controls-cluster {
                display: flex !important;
            }
        }

        /* Portrait & Universal Mobile Safe Area & Touch Layout */
        @media (max-width: 899px) {
            #topControlsBar {
                padding-top: max(8px, env(safe-area-inset-top)) !important;
                padding-left: max(10px, env(safe-area-inset-left)) !important;
                padding-right: max(10px, env(safe-area-inset-right)) !important;
                padding-bottom: 6px !important;
            }
            #bottomControlsBar {
                padding-left: max(12px, env(safe-area-inset-left)) !important;
                padding-right: max(12px, env(safe-area-inset-right)) !important;
                padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
                padding-top: 8px !important;
                gap: 4px !important;
            }
            /* Clean Cinema View on Mobile: Hide intrusive text HUD so controls & timeline remain fully visible */
            #mediaHudOverlay {
                display: none !important;
                pointer-events: none !important;
            }
        }

        /* Portrait Mobile Fine-Tuning (< 480px) */
        @media (max-width: 480px) and (orientation: portrait),
               (max-width: 480px) {
            #btnAspectTopMob {
                display: none !important;
            }
            #topBarTitle {
                max-width: 130px !important;
                font-size: 0.75rem !important;
            }
            #topBarSub {
                font-size: 8px !important;
            }
            .mobile-controls-cluster {
                gap: 4px !important;
            }
        }

        /* Narrow Phones (< 420px) Portrait Optimization */
        @media (max-width: 420px) and (orientation: portrait),
               (max-width: 380px) {
            #topControlsBar {
                padding-left: 6px !important;
                padding-right: 6px !important;
            }
            #btnBack, #btnRotateTopMob {
                width: 2rem !important;
                height: 2rem !important;
            }
            #btnBack svg, #btnRotateTopMob svg {
                width: 0.9rem !important;
                height: 0.9rem !important;
            }
            #topBarTitle {
                max-width: 105px !important;
            }
            #bottomControlsBar {
                padding-left: 6px !important;
                padding-right: 6px !important;
                padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
            }
            #btnPlayPauseMob {
                width: 2.25rem !important;
                height: 2.25rem !important;
            }
            #btnPlayPauseMob svg {
                width: 1rem !important;
                height: 1rem !important;
            }
            .ott-btn {
                width: 2rem !important;
                height: 2rem !important;
            }
            .ott-btn svg {
                width: 0.9rem !important;
                height: 0.9rem !important;
            }
            #timeCurrentMob, #timeDurationMob {
                font-size: 9.5px !important;
            }
            .ott-segmented button {
                padding: 1px 4px !important;
                font-size: 9px !important;
            }
        }

        /* Landscape Mobile & Low-Height Touch Screen Polish */
        @media (max-height: 540px) and (orientation: landscape),
               (pointer: coarse) and (max-height: 580px) and (orientation: landscape) {
            
            /* Safe area padding for notch, Dynamic Island, home bar */
            #topControlsBar {
                padding-top: max(6px, env(safe-area-inset-top)) !important;
                padding-left: max(16px, env(safe-area-inset-left)) !important;
                padding-right: max(16px, env(safe-area-inset-right)) !important;
                padding-bottom: 4px !important;
            }

            #bottomControlsBar {
                padding-left: max(16px, env(safe-area-inset-left)) !important;
                padding-right: max(16px, env(safe-area-inset-right)) !important;
                padding-bottom: max(6px, env(safe-area-inset-bottom)) !important;
                padding-top: 4px !important;
                gap: 2px !important;
            }

            /* Ultra-sleek timeline scrubber for landscape thumb swiping */
            .timeline-container {
                height: 28px !important;
            }
            .timeline-track {
                height: 5px !important;
            }
            .timeline-thumb {
                width: 14px !important;
                height: 14px !important;
                transform: translate(-50%, -50%) scale(1) !important;
            }

            /* Floating Skip Buttons inside safe boundaries */
            .apple-skip-btn {
                bottom: max(56px, calc(env(safe-area-inset-bottom) + 50px)) !important;
                right: max(14px, env(safe-area-inset-right)) !important;
                padding: 6px 14px !important;
                font-size: 11px !important;
            }
            #btnNextEpisode {
                bottom: max(96px, calc(env(safe-area-inset-bottom) + 90px)) !important;
            }

            /* Compact Modals in Landscape Mobile */
            #qualityServerModal,
            #subtitlesModal,
            #aniSkipModal,
            #mobileMoreMenuSheet {
                max-height: 94vh !important;
                max-height: 94dvh !important;
                overflow-y: auto !important;
                overscroll-behavior: contain !important;
                padding: 12px 16px !important;
                border-radius: 20px !important;
                width: min(94vw, 560px) !important;
                left: 50% !important;
                right: auto !important;
                top: auto !important;
                transform: translateX(-50%) !important;
                bottom: max(6px, env(safe-area-inset-bottom)) !important;
            }

            #mobileMoreMenuSheet .grid {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 6px !important;
            }

            #mobileMoreMenuSheet .col-span-2 {
                grid-column: span 2 / span 2 !important;
            }

            /* Episodes & Recommendations Drawers */
            #episodesDrawer,
            #moreLikeThisTray {
                max-height: 88vh !important;
                max-height: 88dvh !important;
                padding: 10px max(14px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)) !important;
            }
            #episodesGrid,
            #moreLikeThisGrid {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 6px !important;
            }
        }

        /* Center Burst Expansion */
        @keyframes burstPulse {
            0% { transform: scale(0.65); opacity: 0; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 0.95; }
        }
        /* Player Screen Lock Engine */
        body.player-screen-locked #topControlsBar,
        body.player-screen-locked #bottomControlsBar,
        body.player-screen-locked #mediaHudOverlay,
        body.player-screen-locked #centerPlayBurst,
        body.player-screen-locked #mobileMoreMenuSheet,
        body.player-screen-locked #qualityServerModal,
        body.player-screen-locked #subtitlesModal,
        body.player-screen-locked #aniSkipModal,
        body.player-screen-locked #episodesDrawer,
        body.player-screen-locked #moreLikeThisTray,
        body.player-screen-locked .apple-skip-btn {
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
            transform: translateY(-16px) !important;
        }
        #player-unlock-btn {
            position: fixed !important;
            top: max(1rem, env(safe-area-inset-top)) !important;
            right: max(1rem, env(safe-area-inset-right)) !important;
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

        /* Ultra-fast Touch Responsiveness - Instant Single-Touch Action (Eliminates 300ms delay & 3-tap bug) */
        button, .ott-btn, .glass-btn, .mobile-controls-cluster, #topControlsBar, #bottomControlsBar, .modal-content, [role="button"], a {
            touch-action: manipulation !important;
            -webkit-tap-highlight-color: transparent !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }

        /* Default Embed Video: 110% Zoom & -16px Nudge */
        #embedFrame {
            transform: scale(1.10) translateY(-16px);
            transform-origin: center center;
            transition: transform 0.2s ease-out;
        }
    </style>
    <style>
        body.embed-active .hide-in-embed {
            display: none !important;
        }
        body.embed-active #timelineContainer {
            display: none !important;
            visibility: hidden !important;
        }
        body.embed-active #mediaHudOverlay,
        body.embed-active .media-hud-overlay,
        body.embed-active #hudLogoContainer,
        body.embed-active #hudTitleText,
        body.embed-active #hudOverview,
        body.embed-active #centerPlayBurst {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            animation: none !important;
            pointer-events: none !important;
        }
    </style>
</head>
<body class="bg-black text-white fixed inset-0 w-full h-full h-[100dvh] overflow-hidden select-none">

    <!-- Toast Indicator -->
    <div id="zoom-indicator">Fit to Screen</div>

    <!-- Sleep Timer Floating Badge -->
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3.5 h-3.5 animate-pulse"></i>
        <span id="sleep-time">00:00</span>
    </div>

    <!-- Main Player Canvas -->
    <div id="playerContainer" class="relative w-full h-full h-[100dvh] flex items-center justify-center bg-black">
        <video id="mainVideo" class="w-full h-full object-contain cursor-pointer" playsinline preload="auto" crossorigin="anonymous"></video>
        
        <!-- Fallback Embed Iframe -->
        <iframe id="embedFrame" class="w-full h-full border-0 hidden" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="origin"></iframe>

        <!-- Embed Touch Sensor (For showing controls over iframe) -->
        <div id="embedTouchSensor" class="absolute inset-0 z-20 hidden" onmousemove="resetControlsTimer()" ontouchstart="resetControlsTimer()" onclick="resetControlsTimer()"></div>

        <!-- High-Precision Custom Subtitle Overlay Layer -->
        <div id="customSubtitleOverlay" class="absolute inset-x-0 bottom-12 sm:bottom-16 md:bottom-20 z-25 pointer-events-none flex flex-col items-center justify-end px-4 text-center select-none transition-all duration-100">
            <div id="customSubtitleText" class="inline-block py-1.5 px-4 rounded-xl max-w-[94%] sm:max-w-[85%] md:max-w-[75%] font-semibold tracking-wide leading-snug transition-all duration-150 hidden shadow-2xl" style="font-size: var(--sub-font-size, 1.15rem); color: var(--sub-color, #ffffff); background-color: var(--sub-bg, rgba(0,0,0,0.55)); text-shadow: var(--sub-shadow, 1px 1px 2px black, 0 0 1em black);"></div>
        </div>

        <!-- Ultra-Sleek Professional Studio Loader (Minimalist, Apple TV / HBO Max Cinema Grade) -->
        <div id="streamLoading" class="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4 transition-all duration-300">
            <div class="relative flex flex-col items-center px-6 py-6 sm:px-8 sm:py-7 rounded-[28px] bg-[#090a0f]/85 backdrop-blur-3xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.85)] w-full max-w-[340px] sm:max-w-[400px] transition-all duration-300 transform scale-100 overflow-hidden">
                <!-- Subtle Top Studio Accent Line -->
                <div class="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

                <!-- Clean Dual-Arc Studio Spinner -->
                <div class="relative w-12 h-12 flex items-center justify-center mb-3">
                    <div class="absolute inset-0 rounded-full border border-white/10"></div>
                    <div class="w-12 h-12 rounded-full border-[2px] border-transparent border-t-white border-r-white/40 animate-spin"></div>
                    <i data-lucide="play" class="w-4 h-4 text-white/90 fill-white/80 absolute ml-0.5"></i>
                </div>

                <!-- Stage Header Text -->
                <p id="streamLoadingMsg" class="text-sm sm:text-base font-semibold tracking-tight text-white text-center drop-shadow-sm">Connecting to Stream...</p>
                <span id="streamLoadingSub" class="text-[11px] text-zinc-400 font-normal tracking-normal text-center mt-0.5">Tuning high-speed edge node</span>

                <!-- 3-Step Studio Timeline (NO COLORED SQUARE BUTTONS) -->
                <div class="w-full flex items-center justify-between relative px-4 my-4">
                    <!-- Baseline Track -->
                    <div class="absolute left-9 right-9 top-[13px] h-[1px] bg-white/10 -z-0"></div>
                    <!-- Active Fill Track -->
                    <div id="loaderTimelineFill" class="absolute left-9 top-[13px] h-[1px] bg-white/70 -z-0 transition-all duration-500" style="width: 15%"></div>

                    <!-- Step 1: Waiting -->
                    <div id="loaderStep1" class="relative z-10 flex flex-col items-center gap-1.5 transition-all">
                        <div id="loaderDot1" class="w-6 h-6 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-lg transition-all">1</div>
                        <span id="loaderLabel1" class="text-[10px] font-bold tracking-wider uppercase text-white transition-all">Waiting</span>
                    </div>

                    <!-- Step 2: M3U Ready -->
                    <div id="loaderStep2" class="relative z-10 flex flex-col items-center gap-1.5 transition-all">
                        <div id="loaderDot2" class="w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-zinc-400 text-[10px] font-semibold flex items-center justify-center transition-all">2</div>
                        <span id="loaderLabel2" class="text-[10px] font-medium tracking-wider uppercase text-zinc-500 transition-all">M3U Ready</span>
                    </div>

                    <!-- Step 3: Play Now -->
                    <div id="loaderStep3" class="relative z-10 flex flex-col items-center gap-1.5 transition-all">
                        <div id="loaderDot3" class="w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-zinc-400 text-[10px] font-semibold flex items-center justify-center transition-all">3</div>
                        <span id="loaderLabel3" class="text-[10px] font-medium tracking-wider uppercase text-zinc-500 transition-all">Play Now</span>
                    </div>
                </div>

                <!-- Refined Cinema Quote (Anti-Boredom, Elegant & Minimalist) -->
                <div class="w-full text-center px-1 py-1 my-0.5 min-h-[38px] flex items-center justify-center">
                    <p id="streamLoadingQuoteText" class="text-[11px] sm:text-xs font-normal italic text-zinc-300 leading-relaxed transition-opacity duration-300 text-center">
                        Dimming the theater lights — your front-row stream is warming up.
                    </p>
                </div>

                <!-- Hairline Silver Progress Bar & Status Hint -->
                <div class="w-full space-y-1.5 mt-2">
                    <div class="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
                        <div id="streamLoadingProgressBar" class="h-full bg-gradient-to-r from-white/40 via-white to-white/90 rounded-full transition-all duration-500" style="width: 24%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-0.5">
                        <span id="streamLoadingStatusHint">Negotiating fastest stream server...</span>
                        <span id="streamLoadingPercent" class="text-white font-semibold">24%</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Center Play/Pause / Rewind / Forward Animated Burst -->
        <div id="centerPlayBurst" class="absolute z-20 w-20 h-20 rounded-full glass-panel flex items-center justify-center text-white opacity-0 pointer-events-none transition-all duration-300 transform scale-75 shadow-2xl">
            <i id="centerBurstIcon" data-lucide="play" class="w-10 h-10 ml-1"></i>
        </div>

        <!-- MOBILE DOUBLE-TAP RIPPLE INDICATORS -->
        <div id="seekRippleLeft" class="absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-0 flex flex-col items-center gap-1 transition-opacity duration-200">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                <i data-lucide="rotate-ccw" class="w-7 h-7"></i>
            </div>
            <span class="text-xs font-black tracking-wider text-white bg-black/60 px-2.5 py-0.5 rounded-full">-10s</span>
        </div>
        <div id="seekRippleRight" class="absolute right-6 sm:right-12 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-0 flex flex-col items-center gap-1 transition-opacity duration-200">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                <i data-lucide="rotate-cw" class="w-7 h-7"></i>
            </div>
            <span class="text-xs font-black tracking-wider text-white bg-black/60 px-2.5 py-0.5 rounded-full">+10s</span>
        </div>

        <!-- MOBILE VERTICAL SWIPE HUD (BRIGHTNESS / VOLUME) -->
        <div id="swipeHud" class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-none opacity-0 flex items-center gap-3 glass-panel px-4 py-3 rounded-2xl shadow-2xl transition-opacity duration-200">
            <i id="swipeHudIcon" data-lucide="volume-2" class="w-6 h-6 text-white"></i>
            <div class="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <div id="swipeHudBar" class="h-full bg-red-500 rounded-full transition-all duration-75" style="width: 50%;"></div>
            </div>
            <span id="swipeHudPercent" class="text-xs font-mono font-bold text-white min-w-[32px] text-right">50%</span>
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
            <!-- Left Controls: Back + Rotate + Title Pill -->
            <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
                <button id="btnBack" onclick="handleGoBack()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-full glass-btn hover:bg-red-600 hover:border-red-500/50 flex items-center justify-center text-white shrink-0 shadow-lg cursor-pointer active:scale-95" title="Back">
                    <i data-lucide="arrow-left" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                </button>
                <!-- Quick Rotate Screen Button for Mobile / Tablet -->
                <button id="btnRotateTopMob" onclick="toggleRotation(event)" class="w-9 h-9 sm:w-10 sm:h-10 rounded-full glass-btn flex items-center justify-center text-zinc-300 hover:text-white shrink-0 shadow-lg cursor-pointer active:scale-95" title="Rotate Screen (Cinema Landscape)">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>
                <div class="flex flex-col min-w-0">
                    <h2 id="topBarTitle" class="text-xs sm:text-base font-bold text-white truncate drop-shadow max-w-[150px] xs:max-w-[210px] sm:max-w-md">
                        <?php echo htmlspecialchars($title); ?>
                    </h2>
                    <span id="topBarSub" class="text-[9px] sm:text-[10px] text-zinc-400 font-semibold tracking-wider uppercase truncate">
                        <?php echo $type === 'tv' ? "Season {$s} &bull; Episode {$e}" : "Cinema Movie Presentation"; ?>
                    </span>
                </div>
            </div>

            <!-- Mobile Quick Actions Cluster (Clean Glass OTT Pills - No colored square buttons) -->
            <div class="mobile-controls-cluster items-center gap-1.5 shrink-0 ml-2">
                <!-- Fullscreen Cinema Quick Toggle (Landscape Cinema) -->
                <button id="btnFullscreenTopMob" onclick="toggleFullscreen(event)" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shrink-0 active:scale-90 shadow-lg" title="Toggle Fullscreen (Landscape Cinema)">
                    <i id="fullscreenTopIconMob" data-lucide="maximize" class="w-4 h-4 text-white"></i>
                </button>
                <!-- Aspect Ratio Quick Toggle -->
                <button id="btnAspectTopMob" onclick="toggleAspectRatio(); updateMobileStatusBadges(); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shrink-0 active:scale-90 shadow-lg" title="Toggle Aspect Ratio">
                    <i data-lucide="scan" class="w-4 h-4 text-zinc-300"></i>
                </button>
                <!-- TV Episodes Drawer Toggle (If Series) -->
                <button id="btnEpisodesDrawerMob" onclick="toggleEpisodesDrawer(); if(event) event.stopPropagation();" class="<?php echo $type === 'tv' ? 'flex' : 'hidden'; ?> ott-btn px-2.5 py-1.5 gap-1.5 text-zinc-300 hover:text-white text-xs font-bold shrink-0 active:scale-90 shadow-lg" title="Episodes Picker">
                    <i data-lucide="list-video" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span class="text-[11px] font-bold">Ep</span>
                </button>
                <!-- Audio & Subs Pill -->
                <button onclick="openSubtitlesModalTab(); if(event) event.stopPropagation();" class="ott-btn px-2.5 py-1.5 gap-1.5 text-zinc-300 hover:text-white text-xs font-bold shrink-0 active:scale-90 shadow-lg" title="Audio Dubs & Subtitles">
                    <i data-lucide="languages" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span class="text-[11px]">CC</span>
                </button>
                <!-- Quality & Server Pill (Clean monochrome glass - No colored squares) -->
                <button id="btnOpenQualityServerMob" onclick="toggleQualityServerModal(); if(event) event.stopPropagation();" class="ott-btn px-2.5 py-1.5 gap-1 text-zinc-300 hover:text-white text-xs font-bold shrink-0 active:scale-90 shadow-lg" title="Quality & Servers">
                    <span id="qualityButtonLabelMob" class="text-[11px] font-mono">1080p</span>
                </button>
                <!-- Mobile Quick Settings Button -->
                <button onclick="toggleMobileMoreMenu(); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shadow-lg shrink-0 active:scale-90" title="Player Quick Settings">
                    <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Desktop Right Controls -->
            <div class="desktop-controls-cluster items-center gap-2.5 min-w-0 justify-end">
                <!-- Reconnect Stream Button -->
                <button onclick="triggerAutoReconnect()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Reconnect Stream">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>

                <!-- Aspect Ratio Button -->
                <button onclick="toggleAspectRatio()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Toggle Aspect Ratio">
                    <i data-lucide="scan" class="w-4 h-4"></i>
                </button>

                <!-- Rotate View Button -->
                <button onclick="toggleRotation(event)" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Rotate Player">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>

                <!-- Fullscreen Button in Desktop Top Bar -->
                <button id="btnFullscreenTop" onclick="toggleFullscreen(event)" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-white hover:bg-red-600 shadow-lg cursor-pointer shrink-0 transition-all" title="Toggle Fullscreen">
                    <i id="fullscreenTopIcon" data-lucide="maximize" class="w-4 h-4"></i>
                </button>

                <!-- Sleep Timer Button -->
                <button onclick="toggleSleepModal()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Sleep Timer">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                </button>

                <!-- TV Episodes Drawer Toggle (If Series) -->
                <button id="btnEpisodesDrawer" onclick="toggleEpisodesDrawer()" class="hidden px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shrink-0" title="Episodes Picker">
                    <i data-lucide="list-video" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Episodes</span>
                </button>

                <!-- Watch Together (Party Mode) Button -->
                <button onclick="togglePartyMode()" class="hide-in-embed px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shrink-0" title="Watch Together (Party Mode)">
                    <i data-lucide="users" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Party</span>
                </button>

                <!-- Quality & Server Button (Clean monochrome glass - No colored squares) -->
                <button id="btnOpenQualityServer" onclick="toggleQualityServerModal()" class="px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Quality & Servers">
                    <span id="qualityButtonLabel" class="hidden xs:inline">Auto &bull; 1080p</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
                </button>

                <!-- Direct Mode Switch Button (Visible when embedded) -->
                <button id="btnSwitchToDirect" onclick="switchPlayerMode('direct', '', true)" class="hidden px-3.5 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/25 hover:border-white/50 text-xs font-bold text-white flex items-center gap-1.5 shadow-xl cursor-pointer transition-all active:scale-95 shrink-0" title="Switch to Direct Native Stream">
                    <i data-lucide="play-circle" class="w-4 h-4 text-white"></i>
                    <span>Direct Player</span>
                </button>

                <!-- Audio Dubs Button -->
                <button id="btnOpenAudio" onclick="openAudioModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Audio Dubs & Multi-Language Tracks">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5 text-emerald-400"></i>
                    <span id="topBarAudioLabel">Audio</span>
                </button>

                <!-- Subtitles Button -->
                <button id="btnOpenSubtitles" onclick="openSubtitlesModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Subtitles & Closed Captions">
                    <i data-lucide="languages" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Subtitles</span>
                </button>

                <!-- AniSkip (MAL ID) Button -->
                <button id="btnOpenAniSkip" onclick="toggleAniSkipModal()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg hover:border-amber-400/40 transition-all shrink-0" title="AniSkip Anime Intro & Outro Timestamps">
                    <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span id="topBarAniSkipLabel">AniSkip</span>
                    <span id="aniSkipBadge" class="hidden px-1.5 py-0.5 text-[9px] rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 font-extrabold">OP/ED</span>
                </button>
            </div>
        </div>

        <!-- BOTTOM CONTROLS BAR -->
        <div id="bottomControlsBar" class="absolute bottom-0 left-0 right-0 z-30 flex flex-col p-3 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 gap-1.5 sm:gap-2">
            <!-- Timeline Scrubber -->
            <div id="timelineContainer" class="timeline-container w-full">
                <div class="timeline-track relative">
                    <div id="timelineBuffer" class="timeline-buffer"></div>
                    <div id="timelineProgress" class="timeline-progress"></div>
                    <!-- AniSkip Scrubber Interval Markers -->
                    <div id="timelineOpMarker" class="absolute top-0 bottom-0 bg-amber-400/75 border-x border-amber-200 pointer-events-none hidden z-10" title="Opening (OP)"></div>
                    <div id="timelineEdMarker" class="absolute top-0 bottom-0 bg-purple-400/75 border-x border-purple-200 pointer-events-none hidden z-10" title="Ending (ED)"></div>
                    <div id="timelineRecapMarker" class="absolute top-0 bottom-0 bg-sky-400/75 border-x border-sky-200 pointer-events-none hidden z-10" title="Recap"></div>
                    <div id="timelineThumb" class="timeline-thumb"></div>
                </div>
                <div id="timelineTooltip" class="absolute -top-7 px-2 py-0.5 rounded-lg glass-panel text-[10px] font-mono text-white pointer-events-none opacity-0 transition-opacity">0:00</div>
            </div>

            <!-- Mobile Bottom Controls Layout (World-Class OTT Experience) -->
            <div class="mobile-controls-cluster items-center justify-between w-full pt-1.5 px-0.5">
                <!-- Left: Play/Pause, Rewind 10, Forward 10, Time -->
                <div class="flex items-center gap-2 min-w-0">
                    <button id="btnPlayPauseMob" onclick="togglePlayPause(event)" class="w-11 h-11 play-btn-animated active:scale-90 flex items-center justify-center shadow-2xl shrink-0" title="Play/Pause">
                        <i id="playIconMob" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current icon-morph"></i>
                        <i id="pauseIconMob" data-lucide="pause" class="w-5 h-5 hidden fill-current icon-morph"></i>
                    </button>
                    <button onclick="seekRelative(-10); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 rounded-full text-zinc-300 hover:text-white shrink-0 active:scale-90" title="Rewind 10s">
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                    </button>
                    <button onclick="seekRelative(10); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 rounded-full text-zinc-300 hover:text-white shrink-0 active:scale-90" title="Forward 10s">
                        <i data-lucide="rotate-cw" class="w-4 h-4"></i>
                    </button>
                    <div class="text-[11px] font-mono text-zinc-300 tracking-tight whitespace-nowrap bg-black/40 backdrop-blur px-2 py-0.5 rounded-lg border border-white/10 ml-0.5">
                        <span id="timeCurrentMob">0:00</span> <span class="text-zinc-500">/</span> <span id="timeDurationMob">0:00</span>
                    </div>
                </div>

                <!-- Right: Mute, Segmented Mode Switch, More Like This, Fullscreen -->
                <div class="flex items-center gap-1.5 shrink-0">
                    <button id="btnMuteMob" onclick="toggleMute(); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shrink-0 active:scale-90" title="Mute/Unmute">
                        <i id="volumeIconMob" data-lucide="volume-2" class="w-4 h-4"></i>
                    </button>
                    <div class="ott-segmented text-[10px] font-bold text-zinc-400">
                        <button id="btnModeDirectMob" onclick="switchPlayerMode('direct'); if(event) event.stopPropagation();" class="px-2 py-1 rounded-full bg-white text-black font-extrabold transition-all shadow">DIR</button>
                        <button id="btnModeEmbedMob" onclick="switchPlayerMode('embed', 'vidlink_pro', true); if(event) event.stopPropagation();" class="px-2 py-1 rounded-full text-zinc-400 hover:text-white transition-all">EMB</button>
                    </div>
                    <button onclick="toggleMoreLikeThisDrawer(); if(event) event.stopPropagation();" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shrink-0 active:scale-90" title="More Like This">
                        <i data-lucide="sparkles" class="w-4 h-4"></i>
                    </button>
                    <button id="btnFullscreenMob" onclick="toggleFullscreen(event)" class="ott-btn w-9 h-9 text-zinc-300 hover:text-white shrink-0 active:scale-90 shadow-lg" title="Fullscreen (Landscape Cinema)">
                        <i id="fullscreenIconMob" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Desktop Bottom Controls Layout -->
            <div class="desktop-controls-cluster items-center justify-between w-full pt-1">
                <!-- Left: Rewind, Animated Play/Pause, Fast Forward, Volume -->
                <div class="flex items-center gap-4 shrink-0">
                    <button onclick="seekRelative(-10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Rewind 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">&laquo; 10</span>
                    </button>

                    <!-- ANIMATED PLAY / PAUSE BUTTON -->
                    <button id="btnPlayPause" onclick="togglePlayPause()" class="w-12 h-12 play-btn-animated group shrink-0" title="Play/Pause">
                        <i id="playIcon" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current icon-morph"></i>
                        <i id="pauseIcon" data-lucide="pause" class="w-5 h-5 hidden fill-current icon-morph"></i>
                    </button>

                    <button onclick="seekRelative(10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Forward 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">10 &raquo;</span>
                    </button>

                    <div class="flex items-center gap-2 group shrink-0">
                        <button id="btnMute" onclick="toggleMute()" class="text-zinc-300 hover:text-white transition-colors cursor-pointer p-1" title="Mute/Unmute">
                            <i id="volumeIcon" data-lucide="volume-2" class="w-5 h-5"></i>
                        </button>
                        <input id="volumeSlider" type="range" min="0" max="1" step="0.05" value="1" oninput="setVolume(this.value)" class="volume-slider-track w-20 transition-all">
                    </div>
                </div>

                <!-- Center: More Like This Drawer Toggle -->
                <div class="flex items-center shrink-0 px-1">
                    <button id="btnToggleMoreLikeThis" onclick="toggleMoreLikeThisDrawer()" class="px-4 py-2 rounded-full glass-btn text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer shadow-lg group shrink-0">
                        <span class="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform"></span>
                        <span class="truncate">More Like This</span>
                        <i id="moreLikeThisChevron" data-lucide="chevron-up" class="w-3.5 h-3.5 transition-transform duration-300"></i>
                    </button>
                </div>

                <!-- Right: Direct | Embed Mode, Time, PiP & Fullscreen -->
                <div class="flex items-center gap-3 shrink-0">
                    <div class="flex items-center p-0.5 rounded-xl glass-sub-panel text-[10px] font-bold text-zinc-400">
                        <button id="btnModeDirect" onclick="switchPlayerMode('direct')" class="px-2.5 py-1 rounded-lg bg-white text-black font-extrabold transition-all shadow">DIRECT</button>
                        <button id="btnModeEmbed" onclick="switchPlayerMode('embed', 'vidlink_pro', true)" class="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all">EMBED</button>
                    </div>

                    <div class="text-[11px] font-mono text-zinc-300 tracking-wider shrink-0 whitespace-nowrap">
                        <span id="timeCurrent">0:00</span> <span class="text-zinc-600">/</span> <span id="timeDuration">0:00</span>
                    </div>

                    <button id="party-mode-btn" onclick="if (typeof window.togglePartyModal === 'function') window.togglePartyModal(true)" class="p-1.5 text-pink-400 hover:text-pink-300 transition-all cursor-pointer active:scale-90 shrink-0" title="Watch Together (Party Mode)"><i data-lucide="users" class="w-4 h-4"></i></button>
                    <button id="btnPip" onclick="togglePiP()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hidden xs:block shrink-0" title="Picture-in-Picture">
                        <i data-lucide="picture-in-picture-2" class="w-4 h-4"></i>
                    </button>

                    <button id="btnFullscreen" onclick="toggleFullscreen()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 shrink-0" title="Fullscreen">
                        <i id="fullscreenIcon" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- FLOATING SKIP INTRO & NEXT EPISODE PILLS -->
        <button id="btnSkipIntro" onclick="skipIntro()" class="apple-skip-btn bottom-24 right-6 bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-white font-bold items-center gap-2" title="Skip Segment (Key: S)">
            <i id="skipIntroIcon" data-lucide="fast-forward" class="w-4 h-4 text-amber-400"></i>
            <span id="skipIntroText">Skip Intro</span>
        </button>

        <button id="btnNextEpisode" onclick="playNextEpisode()" class="apple-skip-btn bottom-36 right-6 bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-white font-bold" title="Next Episode (Key: N)">
            <i data-lucide="skip-forward" class="w-4 h-4 text-zinc-300"></i>
            <span>Next Episode</span>
        </button>

        <!-- MOBILE QUICK SETTINGS SHEET -->
        <div id="mobileMoreMenuSheet" class="fixed inset-x-0 bottom-0 z-50 glass-panel rounded-t-3xl p-5 shadow-2xl border-t border-white/20 hidden animate-slide-up text-white max-h-[85vh] overflow-y-auto pb-8">
            <div class="w-12 h-1 bg-white/25 rounded-full mx-auto mb-4"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                    <i data-lucide="sliders" class="w-4 h-4 text-red-500"></i>
                    Quick Player Settings
                </span>
                <button onclick="toggleMobileMoreMenu(false)" class="p-1 text-zinc-400 hover:text-white cursor-pointer active:scale-90">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
                <!-- Aspect Ratio -->
                <button onclick="toggleAspectRatio(); updateMobileStatusBadges();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="maximize-2" class="w-4 h-4 text-sky-400"></i>
                        <span id="mobAspectBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">Fit</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Aspect Ratio</span>
                    <span class="text-[10px] text-zinc-400">Fit, Cover, Zoom</span>
                </button>
                <!-- Rotate Screen -->
                <button onclick="toggleRotation(); updateMobileStatusBadges();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="smartphone" class="w-4 h-4 text-emerald-400"></i>
                        <span id="mobRotateBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">0°</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Orientation</span>
                    <span class="text-[10px] text-zinc-400">Rotate Screen</span>
                </button>
                <!-- Sleep Timer -->
                <button onclick="toggleMobileMoreMenu(false); toggleSleepModal();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="clock" class="w-4 h-4 text-purple-400"></i>
                        <span id="mobSleepBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">Off</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Sleep Timer</span>
                    <span class="text-[10px] text-zinc-400">Auto shut-off</span>
                </button>
                <!-- Episodes Drawer (if series) -->
                <button id="mobBtnEpisodes" onclick="toggleMobileMoreMenu(false); toggleEpisodesDrawer();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="list-video" class="w-4 h-4 text-amber-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">List</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Episodes</span>
                    <span class="text-[10px] text-zinc-400">Select episode</span>
                </button>
                <!-- Party Mode -->
                <button onclick="toggleMobileMoreMenu(false); togglePartyMode();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="users" class="w-4 h-4 text-pink-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-bold">Party</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Watch Party</span>
                    <span class="text-[10px] text-zinc-400">Watch together</span>
                </button>
                <!-- AniSkip -->
                <button onclick="toggleMobileMoreMenu(false); toggleAniSkipModal();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">OP/ED</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">AniSkip Engine</span>
                    <span class="text-[10px] text-zinc-400">Anime intro skip</span>
                </button>
                <!-- Reconnect -->
                <button onclick="toggleMobileMoreMenu(false); triggerAutoReconnect();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer col-span-2">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="rotate-ccw" class="w-4 h-4 text-rose-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">Reload</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Reconnect Stream</span>
                    <span class="text-[10px] text-zinc-400">Refresh and re-establish video feed</span>
                </button>
                <!-- Screen Lock (Mobile Anti-Accidental Touch) -->
                <button onclick="toggleMobileMoreMenu(false); toggleScreenLock(true);" class="p-3 rounded-2xl bg-red-950/35 border border-red-500/40 flex flex-col items-start gap-1 hover:border-red-500/60 text-left active:scale-95 transition-all cursor-pointer col-span-2">
                    <div class="flex items-center justify-between w-full text-red-400">
                        <i data-lucide="lock" class="w-4 h-4 text-red-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase tracking-wider">Lock UI</span>
                    </div>
                    <span class="text-xs font-bold text-red-300 mt-1">Lock Screen Controls</span>
                    <span class="text-[10px] text-zinc-400">Prevent accidental touches and hide all buttons while watching</span>
                </button>
            </div>
            <!-- Playback Speed Row -->
            <div class="mt-4 pt-3 border-t border-white/10">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">PLAYBACK SPEED</div>
                <div class="grid grid-cols-6 gap-1">
                    <button onclick="setPlaybackSpeed(0.5, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">0.5x</button>
                    <button onclick="setPlaybackSpeed(0.75, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">0.75x</button>
                    <button onclick="setPlaybackSpeed(1, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold bg-white text-black font-extrabold">1x</button>
                    <button onclick="setPlaybackSpeed(1.25, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">1.25x</button>
                    <button onclick="setPlaybackSpeed(1.5, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">1.5x</button>
                    <button onclick="setPlaybackSpeed(2, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">2x</button>
                </div>
            </div>
        </div>

        <!-- MOBILE MODAL BACKDROP -->
        <div id="mobileModalBackdrop" onclick="closeAllOpenModals()" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 hidden transition-opacity"></div>

        <!-- DUAL-COLUMN QUALITY & SERVER DRAWER MODAL (TRANSPARENT GLASS) -->
        <div id="qualityServerModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[480px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
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
                <button type="button" onclick="openInPurePlayer()" class="w-full mt-2.5 flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-left glass-sub-panel bg-red-600/25 border border-red-500/40 hover:bg-red-600 text-white transition-all cursor-pointer shadow-lg active:scale-98">
                    <div class="flex items-center gap-2">
                        <i data-lucide="play-circle" class="w-4 h-4 text-red-400"></i>
                        <span>Open in Stalker Pure Player (play.php)</span>
                    </div>
                    <span class="text-[10px] text-zinc-300 font-normal">Direct Smooth Mode &rarr;</span>
                </button>
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
        <div id="subtitlesModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[460px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
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
                        <button onclick="setSubtitleFontSize('0.85rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Small</button>
                        <button onclick="setSubtitleFontSize('1.15rem', this)" class="sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all">Normal</button>
                        <button onclick="setSubtitleFontSize('1.45rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Large</button>
                        <button onclick="setSubtitleFontSize('1.75rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Huge</button>
                    </div>
                </div>

                <!-- Colors -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Color</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleColor('#ffffff', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">White</button>
                        <button onclick="setSubtitleColor('#facc15', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-yellow-300 text-[11px] font-bold border border-white/10">Yellow</button>
                        <button onclick="setSubtitleColor('#38bdf8', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-sky-300 text-[11px] font-bold border border-white/10">Cyan</button>
                        <button onclick="setSubtitleColor('#4ade80', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-emerald-300 text-[11px] font-bold border border-white/10">Green</button>
                    </div>
                </div>
                <!-- Background -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Background</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleBg('rgba(0,0,0,0)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">None</button>
                        <button onclick="setSubtitleBg('rgba(0,0,0,0.55)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">Half</button>
                        <button onclick="setSubtitleBg('rgba(0,0,0,0.85)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">Dark</button>
                        <button onclick="setSubtitleBg('rgba(255,255,255,0.85)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-zinc-200 hover:bg-white text-black text-[11px] font-bold border border-white/10">Light</button>
                    </div>
                </div>
                <!-- Shadow -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Shadow</label>
                    <div class="grid grid-cols-3 gap-1.5">
                        <button onclick="setSubtitleShadow('none', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">None</button>
                        <button onclick="setSubtitleShadow('1px 1px 2px black, 0 0 1em black', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">Drop</button>
                        <button onclick="setSubtitleShadow('-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">Outline</button>
                    </div>
                </div>

                <!-- Audio / Subtitle Sync Offset -->
                <div class="p-2.5 glass-sub-panel rounded-xl">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[10px] font-bold text-zinc-300 uppercase">Timing Sync Offset</span>
                        <span id="subOffsetDisplay" class="px-2 py-0.5 rounded-full bg-zinc-900 text-white border border-white/20 font-mono text-[10px] font-bold">0.00s</span>
                    </div>
                    <div class="grid grid-cols-5 gap-1">
                        <button onclick="adjustSubtitleSync(-1.0)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">-1.0s</button>
                        <button onclick="adjustSubtitleSync(-0.25)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">-0.25s</button>
                        <button onclick="resetSubtitleSync()" class="py-1 bg-black/90 hover:bg-zinc-900 border border-white/25 text-white rounded-lg text-[10px] font-bold transition-all">Reset</button>
                        <button onclick="adjustSubtitleSync(0.25)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">+0.25s</button>
                        <button onclick="adjustSubtitleSync(1.0)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">+1.0s</button>
                    </div>
                </div>

                <!-- Apply Subtitle Styles & Reset Controls (Explicit User Apply Action) -->
                <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <button id="btnApplySubStyles" onclick="applyAndConfirmSubtitleStyles()" class="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all cursor-pointer">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-white"></i>
                        <span id="btnApplySubStylesLabel">Apply Subtitle Styles</span>
                    </button>
                    <button onclick="resetSubtitleStylesToDefault()" class="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5" title="Reset Subtitle Styles to Default">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        <span>Reset</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ANISKIP ANIME INTRO & OUTRO TIMESTAMPS MODAL (TRANSPARENT GLASS) -->
        <div id="aniSkipModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[460px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                        <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
                    </div>
                    <div>
                        <span class="text-xs font-extrabold uppercase tracking-widest text-amber-300">AniSkip Anime Engine</span>
                        <p class="text-[9px] text-zinc-400">Crowdsourced Anime Opening & Ending timestamps</p>
                    </div>
                </div>
                <button onclick="toggleAniSkipModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- MAL ID Input Group -->
            <div class="space-y-3">
                <div class="p-3 rounded-xl glass-sub-panel space-y-2">
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">
                        <span class="flex items-center gap-1.5"><i data-lucide="hash" class="w-3 h-3 text-amber-400"></i> MyAnimeList ID (MAL ID)</span>
                        <span id="aniSkipStatusBadge" class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 font-bold">Idle</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <input type="number" id="inputMalId" placeholder="e.g. 52299 (Solo Leveling), 20 (Naruto)" class="w-full bg-black/50 border border-white/15 focus:border-amber-400 px-3 py-2 rounded-xl text-xs font-mono text-white placeholder-zinc-500 outline-none transition-all">
                        <button id="btnFetchAniSkip" onclick="applyCustomMalId()" class="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer">
                            <i data-lucide="search" class="w-3.5 h-3.5"></i>
                            <span>Fetch</span>
                        </button>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                        <span>Current Episode: <strong id="aniSkipEpisodeDisplay" class="text-white">1</strong></span>
                        <button onclick="autoDetectMalId()" class="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer">
                            <i data-lucide="sparkles" class="w-3 h-3"></i> Auto-Detect MAL ID
                        </button>
                    </div>
                </div>

                <!-- Detected Timestamps List -->
                <div class="space-y-1.5">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">DETECTED SKIP INTERVALS</div>
                    <div id="aniSkipSegmentsList" class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        <div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No AniSkip data loaded yet. Enter MAL ID above.</div>
                    </div>
                </div>

                <!-- Automation & Preferences -->
                <div class="pt-2 border-t border-white/10 space-y-2">
                    <div class="flex items-center justify-between p-2 rounded-xl glass-sub-panel">
                        <div>
                            <div class="text-xs font-bold text-white flex items-center gap-1.5">
                                <i data-lucide="fast-forward" class="w-3.5 h-3.5 text-amber-400"></i> Auto-Skip Intro & Outro
                            </div>
                            <div class="text-[9px] text-zinc-400">Skip OP/ED automatically without clicking</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="chkAutoSkip" onchange="toggleAniSkipAuto(this.checked)" class="sr-only peer">
                            <div class="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>

                    <!-- Quick Preset Badges -->
                    <div>
                        <div class="text-[9px] font-extrabold uppercase text-zinc-500 mb-1 px-1">POPULAR ANIME PRESETS</div>
                        <div class="flex flex-wrap gap-1">
                            <button onclick="setQuickMalPreset(52299, 'Solo Leveling')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Solo Leveling (#52299)</button>
                            <button onclick="setQuickMalPreset(20, 'Naruto')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Naruto (#20)</button>
                            <button onclick="setQuickMalPreset(16498, 'Attack on Titan')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">AOT (#16498)</button>
                            <button onclick="setQuickMalPreset(40748, 'Jujutsu Kaisen')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">JJK (#40748)</button>
                            <button onclick="setQuickMalPreset(38000, 'Demon Slayer')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Demon Slayer (#38000)</button>
                            <button onclick="setQuickMalPreset(21, 'One Piece')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">One Piece (#21)</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TV SEASONS & EPISODES DRAWER (TRANSPARENT GLASS) -->
        <div id="episodesDrawer" class="hidden absolute bottom-0 left-0 right-0 z-40 max-h-[75vh] glass-panel border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
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

        <!-- HOTSTAR-STYLE END SCREEN "MORE LIKE THIS" & NEXT RECOMMENDATION DRAWER -->
        <div id="hotstarEndDrawer" class="hidden fixed inset-x-0 bottom-0 z-[10003] max-h-[85vh] bg-gradient-to-t from-black via-zinc-950/95 to-transparent backdrop-blur-2xl border-t border-white/15 rounded-t-[32px] p-5 sm:p-7 shadow-[0_-30px_90px_rgba(0,0,0,0.95)] flex flex-col animate-fade-in transition-all">
            <div class="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-4"></div>
            <div class="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-3">
                    <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]"></span>
                    <div>
                        <h3 class="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                            <span>Up Next &bull; More Like This</span>
                            <span id="hotstarCountdownBadge" class="px-2.5 py-0.5 rounded-full bg-red-600/30 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold">Auto-playing in 10s</span>
                        </h3>
                        <p class="text-[11px] text-zinc-400 font-medium">Enjoyed this title? Dive right into the next recommended movie</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="cancelHotstarCountdown()" id="btnCancelCountdown" class="px-3 py-1.5 rounded-xl glass-btn text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer">Cancel</button>
                    <button onclick="closeHotstarEndDrawer()" class="w-9 h-9 rounded-full glass-btn flex items-center justify-center text-white cursor-pointer hover:bg-white/10">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <!-- Recommendations Cards Carousel/Grid -->
            <div id="hotstarRecGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4 overflow-y-auto custom-scrollbar pt-4 flex-grow max-h-[60vh]">
                <div class="col-span-full py-6 text-center text-xs text-zinc-500">Loading recommendations...</div>
            </div>
        </div>

        <!-- RESUME WATCHING LOCALSTORAGE MODAL -->
        <div id="resumeModal" class="hidden fixed inset-0 z-[10005] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
            <div class="glass-panel border border-white/20 rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-[0_30px_90px_rgba(0,0,0,0.95)] text-center relative flex flex-col items-center animate-fade-in">
                <div class="w-14 h-14 bg-red-600/20 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500 mb-4 shadow-inner">
                    <i data-lucide="history" class="w-7 h-7"></i>
                </div>
                <span class="px-3 py-0.5 rounded-full bg-white/10 text-zinc-300 text-[10px] font-extrabold uppercase tracking-widest mb-1">Watch History Detected</span>
                <h3 class="text-lg sm:text-xl font-black text-white tracking-tight mb-1" id="resumeTitleText">Resume Playback?</h3>
                <p class="text-xs text-zinc-400 leading-relaxed mb-5" id="resumeDescText">
                    You left off at <span class="font-bold text-white" id="resumeTimeDisplay">00:00</span> on server <span class="font-bold text-red-400" id="resumeServerDisplay">Bastion</span>. Would you like to pick up where you left off?
                </p>
                <div class="flex flex-col sm:flex-row gap-2.5 w-full">
                    <button onclick="confirmResumeWatching()" class="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer">
                        <i data-lucide="play" class="w-4 h-4 fill-white"></i> Continue Watching
                    </button>
                    <button onclick="confirmStartBeginning()" class="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl transition-all border border-zinc-700 flex items-center justify-center gap-1.5 cursor-pointer">
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Start Beginning
                    </button>
                </div>
            </div>
        </div>

    </div>

    <!-- Script Engine -->
    <script>
        // Early global modal declarations to guarantee inline HTML button onclicks never fail
        window.toggleQualityServerModal = function(force) {
            const modal = document.getElementById('qualityServerModal');
            if (!modal) return;
            const isHidden = modal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                modal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                if (typeof window.closeAllOpenModals === 'function') window.closeAllOpenModals(false);
                modal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                if (typeof updateServerListUI === 'function') updateServerListUI();
            }
        };
        window.toggleSubtitlesModal = function(force) {
            const modal = document.getElementById('subtitlesModal');
            if (!modal) return;
            const isHidden = modal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                modal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                if (typeof window.closeAllOpenModals === 'function') window.closeAllOpenModals(false);
                modal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
            }
        };
        window.openSubtitlesModalTab = function(tab) {
            window.toggleSubtitlesModal(true);
            if (typeof switchSubtitlesModalTab === 'function') switchSubtitlesModalTab(tab || 'subs');
        };
        window.toggleSleepModal = function(force) {
            const modal = document.getElementById('sleepModal');
            if (!modal) return;
            const isHidden = modal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) modal.classList.add('hidden');
            else modal.classList.remove('hidden');
        };
        window.toggleEpisodesDrawer = function(force) {
            const drawer = document.getElementById('episodesDrawer');
            if (!drawer) return;
            const isHidden = drawer.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) drawer.classList.add('hidden');
            else drawer.classList.remove('hidden');
        };
        window.toggleMobileMoreMenu = function(force) {
            const menu = document.getElementById('mobileMoreMenu');
            if (!menu) return;
            const isHidden = menu.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) menu.classList.add('hidden');
            else menu.classList.remove('hidden');
        };

        const urlParams = new URLSearchParams(window.location.search);
        let MEDIA_ID = urlParams.get('id') || urlParams.get('tmdbId') || '<?php echo addslashes($id); ?>';
        const MEDIA_TYPE = urlParams.get('type') || urlParams.get('media_type') || '<?php echo addslashes($type); ?>' || 'movie';
        let rawTitleFromPhp = '';
        try { rawTitleFromPhp = '<?php echo addslashes($title); ?>'; } catch(e) {}
        const MEDIA_TITLE = urlParams.get('title') || urlParams.get('name') || (rawTitleFromPhp && !rawTitleFromPhp.includes('{{') ? rawTitleFromPhp : 'Cinema Presentation');
        let MEDIA_SEASON = parseInt(urlParams.get('s') || urlParams.get('season') || '<?php echo $s; ?>', 10) || 1;
        let MEDIA_EPISODE = parseInt(urlParams.get('e') || urlParams.get('episode') || '<?php echo $e; ?>', 10) || 1;
        let CURRENT_SERVER = urlParams.get('srv') || '<?php echo addslashes($srv); ?>' || 'm4u';
        if (CURRENT_SERVER === '{{SRV}}' || CURRENT_SERVER === 's61') CURRENT_SERVER = 'm4u';
        let DIRECT_STREAM_URL = urlParams.get('url') || '<?php echo addslashes($directUrl); ?>';
        if (DIRECT_STREAM_URL === '{{URL}}') DIRECT_STREAM_URL = '';
        const SOURCE_ORIGIN = urlParams.get('source') || '<?php echo addslashes($source); ?>' || 'consumet.html';
        let IMDB_ID = urlParams.get('imdb') || urlParams.get('imdbId') || urlParams.get('imdb_id') || '<?php echo addslashes($imdbId); ?>';

        if (!MEDIA_ID || MEDIA_ID === '{{ID}}') {
            if (DIRECT_STREAM_URL) {
                try {
                    const u = new URL(DIRECT_STREAM_URL, window.location.origin);
                    const inner = u.searchParams.get('url') || DIRECT_STREAM_URL;
                    const idMatch = inner.match(/[\/=](\d{4,8})[\/_\.\?&]/) || window.location.search.match(/[?&]id=(\d+)/);
                    if (idMatch) MEDIA_ID = idMatch[1];
                } catch(e) {}
            }
        }

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

        // AniSkip Elements
        const aniSkipModal = document.getElementById('aniSkipModal');
        const btnOpenAniSkip = document.getElementById('btnOpenAniSkip');
        const aniSkipBadge = document.getElementById('aniSkipBadge');
        const inputMalId = document.getElementById('inputMalId');
        const aniSkipStatusBadge = document.getElementById('aniSkipStatusBadge');
        const aniSkipSegmentsList = document.getElementById('aniSkipSegmentsList');
        const aniSkipEpisodeDisplay = document.getElementById('aniSkipEpisodeDisplay');
        const chkAutoSkip = document.getElementById('chkAutoSkip');
        const timelineOpMarker = document.getElementById('timelineOpMarker');
        const timelineEdMarker = document.getElementById('timelineEdMarker');
        const timelineRecapMarker = document.getElementById('timelineRecapMarker');
        const skipIntroText = document.getElementById('skipIntroText');
        const skipIntroIcon = document.getElementById('skipIntroIcon');

        function getStoredMalId() {
            try {
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null' && MEDIA_ID !== '{{ID}}') {
                    const v1 = localStorage.getItem('stalker_mal_id_' + MEDIA_ID);
                    if (v1 && !isNaN(parseInt(v1, 10))) return parseInt(v1, 10);
                }
                if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation' && !MEDIA_TITLE.includes('{{')) {
                    const v2 = localStorage.getItem('stalker_mal_id_' + MEDIA_TITLE.toLowerCase().trim());
                    if (v2 && !isNaN(parseInt(v2, 10))) return parseInt(v2, 10);
                }
            } catch (e) {}
            return null;
        }

        function saveStoredMalId(malId) {
            if (!malId || isNaN(parseInt(malId, 10))) return;
            const num = parseInt(malId, 10);
            try {
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null' && MEDIA_ID !== '{{ID}}') {
                    localStorage.setItem('stalker_mal_id_' + MEDIA_ID, String(num));
                }
                if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation' && !MEDIA_TITLE.includes('{{')) {
                    localStorage.setItem('stalker_mal_id_' + MEDIA_TITLE.toLowerCase().trim(), String(num));
                }
            } catch (e) {}
        }

        const rawMalParam = urlParams.get('malId') || urlParams.get('mal_id') || urlParams.get('mal') || '<?php echo addslashes($malId); ?>';
        let MAL_ID = (rawMalParam && !isNaN(parseInt(rawMalParam, 10))) ? parseInt(rawMalParam, 10) : getStoredMalId();
        if (MAL_ID) saveStoredMalId(MAL_ID);

        const rawAnilistParam = urlParams.get('anilistId') || urlParams.get('anilist_id') || urlParams.get('anilist') || '<?php echo addslashes($anilistId); ?>';
        let ANILIST_ID = (rawAnilistParam && !isNaN(parseInt(rawAnilistParam, 10))) ? parseInt(rawAnilistParam, 10) : (MEDIA_TYPE === 'anime' && !isNaN(parseInt(MEDIA_ID, 10)) ? parseInt(MEDIA_ID, 10) : null);
        window.ANILIST_ID = ANILIST_ID;

        /* ---------------- ROBUST PLAY/PAUSE CONTROLLER & ABORT REJECTION SUPPRESSION ---------------- */
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
                    return promise
                        .then(() => {
                            pendingPlayPromise = null;
                        })
                        .catch((err) => {
                            pendingPlayPromise = null;
                            if (err && err.name === 'NotAllowedError') {
                                // Browser policy blocked audio autoplay; fallback to muted autoplay
                                try {
                                    mainVideo.muted = true;
                                    const retry = mainVideo.play();
                                    if (retry !== undefined && typeof retry.then === 'function') {
                                        retry.catch(() => {});
                                    }
                                } catch (_) {}
                            } else if (err && err.name === 'AbortError') {
                                // Benign abort: play request was superseded by pause() or stream switch
                            } else {
                                console.debug('Playback notice:', err);
                            }
                        });
                }
            } catch (e) {
                // Ignore synchronous play exceptions
            }
            return Promise.resolve();
        }

        function safePauseVideo() {
            if (!mainVideo) return;
            if (pendingPlayPromise) {
                pendingPlayPromise
                    .then(() => {
                        try { mainVideo.pause(); } catch (_) {}
                    })
                    .catch(() => {
                        try { mainVideo.pause(); } catch (_) {}
                    });
            } else {
                try { mainVideo.pause(); } catch (_) {}
            }
        }

        window.MAL_ID = MAL_ID;
        window.MEDIA_SEASON = MEDIA_SEASON;
        window.MEDIA_EPISODE = MEDIA_EPISODE;
        window.MEDIA_TITLE = MEDIA_TITLE;
        let aniSkipResults = [];
        let activeAniSkipSegment = null;
        // Default Auto-Skip to true unless user explicitly set it to false
        let aniSkipAutoSkip = localStorage.getItem('stalker_aniskip_autoskip') !== 'false';
        let lastAutoSkippedId = null;
        let aniSkipCurrentRequestEp = null;

        let hlsInstance = null;
        let controlsTimeout = null;
        let isScrubbing = false;
        let availableServers = [];
        let playerMode = 'direct';
        let currentRotation = 0;
        let currentAspectMode = 0; // 0: contain, 1: cover, 2: fill, 3: zoom-120
        let sleepTimerInterval = null;
        let sleepEndTime = null;
        let sleepTimerId = null;
        let subtitleSyncOffset = 0;
        let currentActiveAudioTrack = 0;
        let currentActiveSubtitleTrack = -1;
        let externalSubtitlesLoaded = [];

        const isAnimeContent = (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'anime') || Boolean(MAL_ID) || Boolean(ANILIST_ID);
        const ANIME_SPECIAL_SERVERS = [
            { id: 'bing_anime', name: 'Bing Anime (Multi-Audio HLS / Nexa & Ravok Direct)', cc: 'JP' },
            { id: 'hianime', name: 'HiAnime (MegaPlay Anime Scraper)', cc: 'JP' },
            { id: 'animesalt', name: 'AnimeSalt (Special Anime Scraper / Multi-Audio)', cc: 'JP' },
            { id: 'kisskh', name: 'KissKH (Asian Drama & Anime / Direct HLS)', cc: 'JP' },
            { id: 'asiaflix', name: 'Asiaflix (Vidmoly Multi-Bitrate HLS)', cc: 'KR' },
            { id: 's40', name: 'Aphelion (DarkMatter / 1080p Direct HLS)', cc: 'GL' },
            { id: 'framex', name: 'FrameX TV (Multi-Source 4K/1080p Anime)', cc: 'US' }
        ];

        if (isAnimeContent) {
            const animeIds = ANIME_SPECIAL_SERVERS.map(s => s.id);
            if (!CURRENT_SERVER || !animeIds.includes(CURRENT_SERVER)) {
                CURRENT_SERVER = 'bing_anime';
            }
        }

        const DEFAULT_SERVERS = isAnimeContent ? ANIME_SPECIAL_SERVERS : [
            { id: 'm4u', name: 'Movie 4U (Movies4u / Acek CDN)', cc: 'IN' },
            { id: 's62', name: 'Bastion (Multi-Audio HLS / Fast Direct)', cc: 'IN' },
            { id: 's30', name: 'Nova (Direct Fast HLS)', cc: 'US' },
            { id: 's80', name: 'Moscow (Fast Direct HLS / StreamRip)', cc: 'US' },
            { id: 's31', name: 'Orion (Worker CDN Direct)', cc: 'US' },
            { id: 'sm_hub', name: 'SM Movie Hub Pro (Direct VOD/MKV/Dual Audio)', cc: 'BD' },
            { id: 's70', name: 'Polaris (Multi-Language Dubs / HLS)', cc: 'US' },
            { id: 'framex', name: 'FrameX TV (Multi-Source 4K/1080p Movies, TV & Anime)', cc: 'US' },
            { id: 's81', name: 'Novo (Direct StreamRip / High-Speed HLS)', cc: 'US' },
            { id: 's40', name: 'Aphelion (DarkMatter / 1080p Direct HLS)', cc: 'GL' },
            { id: 's3', name: 'Edmunds (High Reliability Proxy / 1080p)', cc: 'US' },
            { id: 's60', name: 'Vertex (Direct CDN)', cc: 'US' },
            { id: 's63', name: 'Hallyu (Asian & International HLS)', cc: 'KR' },
            { id: 's61', name: 'Corvus (Multi-Source Hub / 1080p)', cc: 'US' },
            { id: 'vidlink', name: 'VidLink Pro (Decrypted 1080p / Direct CDN)', cc: 'US' },
            { id: 'cinepro', name: 'CinePro Core (OMSS Multi-Provider 4K/1080p)', cc: 'US' },
            { id: 'bing_anime', name: 'Bing Anime (Multi-Audio HLS / Nexa & Ravok Direct)', cc: 'JP' }
        ];

        window.addEventListener('DOMContentLoaded', async () => {
            if (window.lucide) lucide.createIcons();
            loadMediaHudMetadata();
            loadStoredSubtitleSettings();
            loadServerList().catch(() => {}); // Run in background — don't block initial m4u playback
            loadMoreLikeThis();

            const btnEp = document.getElementById('btnEpisodesDrawer');
            const epDrawer = document.getElementById('episodesDrawer');
            if (MEDIA_TYPE === 'tv') {
                if (btnEp) btnEp.classList.remove('hidden');
                if (epDrawer) epDrawer.classList.remove('hidden');
                loadTvSeasonsAndEpisodes();
            } else {
                if (btnEp) btnEp.classList.add('hidden');
                if (epDrawer) epDrawer.classList.add('hidden');
            }

            fetchExternalSubtitles();
            populateEmbedProviders();
            setupControlsAutoHide();
            setupTimeline();
            setupSubtitlesUploader();
            initAniSkip();

            // Check for saved progress in localStorage and prompt to Resume if applicable
            checkSavedResumeProgress();
        });

        /* ---------------- RESUME WATCHING LOGIC (LOCALSTORAGE) ---------------- */
        let pendingResumeData = null;

        function checkSavedResumeProgress() {
            try {
                const resumeKey = `bingr_resume_${MEDIA_TYPE}_${MEDIA_ID}`;
                const raw = localStorage.getItem(resumeKey);
                if (!raw) {
                    startInitialStreamPlayback();
                    return;
                }
                const data = JSON.parse(raw);
                // Prompt if user watched more than 30s and has at least 60s remaining
                if (data && data.time && data.time > 30 && (!data.duration || (data.duration - data.time) > 60)) {
                    pendingResumeData = data;
                    showResumeModal(data);
                } else {
                    startInitialStreamPlayback();
                }
            } catch(e) {
                startInitialStreamPlayback();
            }
        }

        function showResumeModal(data) {
            const modal = document.getElementById('resumeModal');
            if (!modal) {
                startInitialStreamPlayback();
                return;
            }
            const timeDisp = document.getElementById('resumeTimeDisplay');
            const srvDisp = document.getElementById('resumeServerDisplay');
            const titleDisp = document.getElementById('resumeTitleText');
            if (timeDisp) timeDisp.textContent = formatTime(data.time);
            if (srvDisp) srvDisp.textContent = getServerName(data.srv || CURRENT_SERVER);
            if (titleDisp && (data.title || MEDIA_TITLE)) titleDisp.textContent = `Resume "${(data.title || MEDIA_TITLE).slice(0, 30)}"?`;
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function confirmResumeWatching() {
            const modal = document.getElementById('resumeModal');
            if (modal) modal.classList.add('hidden');
            if (pendingResumeData) {
                previousVideoTime = pendingResumeData.time;
                if (pendingResumeData.srv && pendingResumeData.srv !== CURRENT_SERVER) {
                    CURRENT_SERVER = pendingResumeData.srv;
                }
                showToast(`Resuming at ${formatTime(pendingResumeData.time)} on ${getServerName(CURRENT_SERVER)}...`);
            }
            startInitialStreamPlayback();
        }

        function confirmStartBeginning() {
            const modal = document.getElementById('resumeModal');
            if (modal) modal.classList.add('hidden');
            try {
                const resumeKey = `bingr_resume_${MEDIA_TYPE}_${MEDIA_ID}`;
                localStorage.removeItem(resumeKey);
            } catch(e) {}
            previousVideoTime = 0;
            pendingResumeData = null;
            showToast('Starting from beginning...');
            startInitialStreamPlayback();
        }

        function getSiteApiHeaders() {
            const h = {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            };
            try {
                const tok = localStorage.getItem('site_unlock_token') || sessionStorage.getItem('site_unlock_token');
                if (tok) h['X-Site-Unlock-Token'] = tok;
            } catch(e) {}
            return h;
        }

        function startInitialStreamPlayback() {
            const hasDirectStream = DIRECT_STREAM_URL && (DIRECT_STREAM_URL.startsWith('http') || DIRECT_STREAM_URL.startsWith('/'));
            if (hasDirectStream) {
                showLoading(true, 'M3U Stream Locked — Few Seconds to Play!', 'Pre-buffering HD frames • You are right here in the front row', 'm3u_loaded');
                initHlsPlayer(DIRECT_STREAM_URL);
                window.bingrActiveStreamUrl = DIRECT_STREAM_URL;
                if (typeof probeSmMovieStream === 'function') {
                    probeSmMovieStream(DIRECT_STREAM_URL);
                }
                
                // Background fetch to populate multi-audio dubs (sources) if we skipped the main fetch
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null') {
                    fetch('/api/bingr/stream', {
                        method: 'POST',
                        headers: getSiteApiHeaders(),
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
                        if (data) {
                            if (data.streamDurationSec && data.streamDurationSec > 0) {
                                window.bingrDuration = data.streamDurationSec;
                                if (typeof syncDurationDisplay === 'function') syncDurationDisplay();
                            } else if (data.duration && data.duration > 0) {
                                window.bingrDuration = data.duration * 60;
                                if (typeof syncDurationDisplay === 'function') syncDurationDisplay();
                            }
                            if (data.audioTracks && data.audioTracks.length > 0) {
                                window.bingrAudioTracks = data.audioTracks;
                            }
                            if (data.sources && data.sources.length > 0) {
                                window.bingrSources = data.sources;
                            }
                            if (typeof detectAndPopulateAudioTracks === 'function') {
                                detectAndPopulateAudioTracks();
                            }
                            if (data.subtitles && data.subtitles.length > 0) {
                                externalSubtitlesLoaded = data.subtitles;
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
        }

        let isProbingStream = false;

        async function fetchAndPlayStream(serverId, isManual = false) {
            if (isProbingStream && isManual) {
                showToast('Connecting, please wait...');
                return;
            }
            if (isManual) isProbingStream = true;

            showLoading(true, 'Connecting to ' + getServerName(serverId) + '...', 'Searching fastest cinema node while you wait', 'waiting');

            try {
                const payload = {
                    type: MEDIA_TYPE,
                    id: MEDIA_ID,
                    title: MEDIA_TITLE,
                    season: (MEDIA_TYPE === 'tv' || MEDIA_TYPE === 'anime') ? MEDIA_SEASON : undefined,
                    episode: (MEDIA_TYPE === 'tv' || MEDIA_TYPE === 'anime') ? MEDIA_EPISODE : undefined,
                    srv: serverId,
                    strictSrv: isManual,
                    malId: MAL_ID || undefined,
                    anilistId: ANILIST_ID || undefined
                };

                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: getSiteApiHeaders(),
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                const firstSource = (data.sources && data.sources.length > 0) ? data.sources[0] : null;
                const isExplicitEmbed = (firstSource && firstSource.type === 'embed') ||
                    (data.sources && data.sources.length > 0 && data.sources.every(s => s.type === 'embed'));

                const streamCandidate = (isExplicitEmbed && firstSource)
                    ? firstSource.url
                    : (data.primaryM3u8 || (firstSource ? firstSource.url : null));

                const isEmbedSource = isExplicitEmbed || (streamCandidate && (
                    streamCandidate.includes('vidlink') || 
                    streamCandidate.includes('/embed') || 
                    streamCandidate.includes('embed.php') ||
                    streamCandidate.endsWith('.html')
                ));

                const isDirectStream = !isEmbedSource && streamCandidate && (
                    streamCandidate.includes('.m3u8') || 
                    streamCandidate.includes('/api/proxy/hls') || 
                    streamCandidate.includes('/stream') || 
                    streamCandidate.includes('.mpd') ||
                    (firstSource && (firstSource.type === 'application/x-mpegurl' || firstSource.type === 'hls' || firstSource.type === 'application/dash+xml'))
                );

                const streamUrl = streamCandidate;

                if (isDirectStream || (!isEmbedSource && streamUrl)) {
                    CURRENT_SERVER = data.serverId || serverId;
                    updateServerListUI();
                    window.bingrSources = data.sources || [];
                    window.bingrActiveStreamUrl = streamUrl;
                    window.currentStreamUrl = streamUrl;
                    window.bingrDuration = data.streamDurationSec || (data.duration ? data.duration * 60 : 0);
                    if (data.expectedDurationMinutes && data.expectedDurationMinutes > 0) {
                        window.bingrExpectedDurationSec = data.expectedDurationMinutes * 60;
                    } else if (!window.bingrExpectedDurationSec && MEDIA_TYPE === 'movie') {
                        window.bingrExpectedDurationSec = 5400;
                    }
                    hasValidatedDurationForCurrentStream = false;
                    window.bingrAudioTracks = data.audioTracks || (data.sources && data.sources[0] && data.sources[0].audioTracks ? data.sources[0].audioTracks : []);
                    if (window.bingrDuration && window.bingrDuration > 0) {
                        const initDurFmt = formatTime(window.bingrDuration);
                        if (timeDuration) timeDuration.textContent = initDurFmt;
                        const timeDurationMob = document.getElementById('timeDurationMob');
                        if (timeDurationMob) timeDurationMob.textContent = initDurFmt;
                    }
                    showLoading(true, 'M3U Stream Loaded — Starting in a Few Seconds!', 'Connected to ' + getServerName(CURRENT_SERVER) + ' • Decoding master playlist', 'm3u_loaded');
                    initHlsPlayer(streamUrl);
                    if (data.subtitles && data.subtitles.length > 0) {
                        externalSubtitlesLoaded = data.subtitles;
                        populateSubtitlesList();
                    }
                    if (isManual) {
                        if (data.fallbackNote) {
                            showToast(data.fallbackNote, 'info');
                        } else {
                            showToast(`Connected to ${getServerName(CURRENT_SERVER)}`);
                        }
                    }
                } else if (isEmbedSource) {
                    const isAnimeMode = (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'anime') || Boolean(window.MAL_ID) || Boolean(window.ANILIST_ID);
                    const fallbackOrder = isAnimeMode
                        ? ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex']
                        : (MEDIA_TYPE === 'tv'
                            ? ['m4u', 's62', 's30', 's80', 's31', 'framex', 's81', 's70', 's40', 'sm_hub', 's3', 'vidlink']
                            : ['m4u', 's62', 's30', 's80', 's31', 'framex', 's81', 'sm_hub', 's70', 's40', 's3', 'vidlink']);
                    failedServers.add(serverId);
                    const unattemptedDirect = fallbackOrder.find(srv => !failedServers.has(srv));
                    // If this was an auto-cascade and another direct server is available, search remaining direct servers first!
                    if (!isManual && unattemptedDirect) {
                        console.log(`[Bingr Cascade] Server "${serverId}" returned embed only. Searching direct server "${unattemptedDirect}"...`);
                        fetchAndPlayStream(unattemptedDirect, false);
                        return;
                    }

                    // Direct streams exhausted or user explicitly selected embed server
                    CURRENT_SERVER = data.serverId || serverId;
                    updateServerListUI();
                    showLoading(false);
                    const embedTarget = (firstSource && firstSource.url) || streamUrl;
                    switchPlayerMode('embed', 'vidlink_pro', true, embedTarget);
                    if (isManual) showToast(`Playing via ${getServerName(CURRENT_SERVER)} Embed`);
                } else {
                    console.warn('Server ' + serverId + ' returned no stream.');
                    failedServers.add(serverId);
                    if (isManual) {
                        showToast(`${getServerName(serverId)} has no direct stream for this title. Auto-connecting to next best server...`, 'info');
                    }
                    cascadeFallback(serverId);
                }
            } catch (err) {
                console.error('Failed to fetch stream:', err);
                failedServers.add(serverId);
                if (isManual) {
                    showToast(`Could not connect to ${getServerName(serverId)}. Auto-connecting to next best server...`, 'info');
                }
                cascadeFallback(serverId);
            } finally {
                isProbingStream = false;
            }
        }

        let failedServers = new Set();
        let isCascading = false;
        let hasValidatedDurationForCurrentStream = false;

        function validatePlayingStreamDuration() {
            if (hasValidatedDurationForCurrentStream) return true;
            if (!mainVideo || !isFinite(mainVideo.duration) || mainVideo.duration <= 0) return true;
            if (mainVideo.duration === Infinity) return true;
            const isTranscode = window.bingrActiveStreamUrl && (window.bingrActiveStreamUrl.includes('/api/transcode/mkv') || window.bingrActiveStreamUrl.includes('transcode_mkv.php'));
            if (isTranscode) return true;

            const expected = window.bingrExpectedDurationSec || (MEDIA_TYPE === 'movie' ? 5400 : 0);
            const actual = mainVideo.duration;

            // Strict check for movies or episodes expected >= 25 minutes
            if (expected >= 1500) {
                // If actual stream is under 12 minutes (720s) OR under 25% of expected runtime:
                if (actual < 720 || actual < (expected * 0.25)) {
                    hasValidatedDurationForCurrentStream = true;
                    console.warn(`[Duration Guard] Server "${CURRENT_SERVER}" served an ad/preview clip (${Math.round(actual)}s vs expected ~${Math.round(expected)}s). Auto-rejecting stream!`);
                    try { mainVideo.pause(); } catch(_) {}
                    if (hlsInstance) {
                        try { hlsInstance.stopLoad(); hlsInstance.destroy(); } catch (_) {}
                        hlsInstance = null;
                    }
                    showToast(`${getServerName(CURRENT_SERVER)} served a short preview/sample clip. Switching to full-length stream...`, 'info');
                    failedServers.add(CURRENT_SERVER);
                    cascadeFallback(CURRENT_SERVER);
                    return false;
                }
            }
            hasValidatedDurationForCurrentStream = true;
            return true;
        }

        function cascadeFallback(failedServerId) {
            isCascading = false;
            failedServers.add(failedServerId);
            const isAnimeMode = (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'anime') || Boolean(window.MAL_ID) || Boolean(window.ANILIST_ID);
            const fallbackOrder = isAnimeMode
                ? ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex']
                : (MEDIA_TYPE === 'tv'
                    ? ['m4u', 's62', 's30', 's80', 's31', 'framex', 's81', 's70', 's40', 'sm_hub', 's3', 'vidlink']
                    : ['m4u', 's62', 's30', 's80', 's31', 'framex', 's81', 'sm_hub', 's70', 's40', 's3', 'vidlink']);
            // Find next unattempted direct server in priority sequence
            const nextServer = failedServers.size <= 10 ? fallbackOrder.find(srv => !failedServers.has(srv)) : null;
            if (nextServer) {
                console.log(`[Bingr Cascade] Stepping down from "${failedServerId}" to "${nextServer}"...`);
                fetchAndPlayStream(nextServer, false);
            } else {
                showLoading(false);
                failedServers.clear();
                console.warn("[Fallback] Direct streams unavailable across primary clusters.");
                showToast("Direct stream unavailable across clusters. Please select another server.", 'error');
            }
        }

        async function probeSmMovieStream(streamUrl) {
            if (!streamUrl) return;
            let mkvUrl = '';
            if (streamUrl.includes('/api/transcode/mkv') || streamUrl.includes('transcode_mkv.php')) {
                const match = streamUrl.match(/[?&]url=([^&]+)/);
                if (match) mkvUrl = decodeURIComponent(match[1]);
            } else if (streamUrl.includes('.mkv')) {
                mkvUrl = streamUrl;
            }
            if (!mkvUrl) return;

            try {
                const res = await fetch(`/api/sm/probe?url=${encodeURIComponent(mkvUrl)}`);
                const data = await res.json();
                if (data && data.success && data.duration > 0) {
                    window.bingrDuration = data.duration;
                    if (data.audioTracks && data.audioTracks.length > 0) {
                        window.bingrAudioTracks = data.audioTracks;
                    }
                    if (typeof syncDurationDisplay === 'function') {
                        syncDurationDisplay();
                    }
                    if (typeof detectAndPopulateAudioTracks === 'function') {
                        detectAndPopulateAudioTracks();
                    }
                }
            } catch (err) {
                console.warn('[SM Probe] Failed to fetch stream metadata:', err);
            }
        }

        function initHlsPlayer(streamUrl) {
            if (!streamUrl) return;

            // Auto-proxy CDNs that enforce strict Origin/Referer or fail direct browser CORS
            let effectiveUrl = streamUrl;
            if (effectiveUrl.startsWith('/live.php?url=')) {
                effectiveUrl = effectiveUrl.replace('/live.php?url=', '/stream_proxy.php?url=');
            }
            // VidLink (hakunaymatata / hakunamatata) MUST be proxied so server sends VLC User-Agent to bypass Alibaba 428 block
            if ((effectiveUrl.includes('hakunaymatata.com') || effectiveUrl.includes('hakunamatata.com')) && !effectiveUrl.startsWith('/stream_proxy.php')) {
                effectiveUrl = '/stream_proxy.php?url=' + encodeURIComponent(effectiveUrl);
            }
            const isCorsReady = effectiveUrl.startsWith('/stream_proxy.php') ||
                                effectiveUrl.includes('dash-hls-bridge') ||
                                effectiveUrl.includes('workers.dev') ||
                                effectiveUrl.includes('proxy-web-sage.vercel.app');
            if (!isCorsReady && (effectiveUrl.startsWith('http://') || effectiveUrl.startsWith('https://')) && !effectiveUrl.startsWith(window.location.origin)) {
                effectiveUrl = '/stream_proxy.php?url=' + encodeURIComponent(streamUrl);
                console.log('[HLS] Automatically routed stream through reverse proxy for CORS compliance:', effectiveUrl);
            }

            window.bingrActiveStreamUrl = effectiveUrl;
            if (effectiveUrl.includes('/api/transcode/mkv') || effectiveUrl.includes('transcode_mkv.php')) {
                const ssMatch = effectiveUrl.match(/[?&]ss=([\d\.]+)/);
                window.bingrSeekOffset = ssMatch ? parseFloat(ssMatch[1]) : 0;
            } else {
                window.bingrSeekOffset = 0;
            }

            // Auto-proxy streamrip progressive video or HLS streams to bypass CORS and 401 blocks
            if (effectiveUrl && effectiveUrl.includes('streamrip.fun') && !effectiveUrl.startsWith('/stream_proxy.php') && !effectiveUrl.includes('/stream_proxy.php?url=')) {
                effectiveUrl = `/stream_proxy.php?url=${encodeURIComponent(effectiveUrl)}`;
            }

            // Cleanly detach and destroy previous Hls instance
            if (hlsInstance) {
                try {
                    hlsInstance.stopLoad();
                    hlsInstance.detachMedia();
                    hlsInstance.destroy();
                } catch(e) {}
                hlsInstance = null;
            }

            // Reset HTML5 video element pipeline
            try {
                mainVideo.pause();
                mainVideo.removeAttribute('src');
                mainVideo.load();
            } catch(e) {}

            const targetSeekTime = previousVideoTime;

            const isDirectVideo = effectiveUrl.toLowerCase().includes('.mkv') || 
                                  effectiveUrl.toLowerCase().includes('.mp4') || 
                                  effectiveUrl.toLowerCase().includes('.webm') ||
                                  effectiveUrl.includes('streamrip.fun/f/') ||
                                  (window.bingrSources && window.bingrSources[0] && (window.bingrSources[0].type === 'video/mp4' || window.bingrSources[0].type === 'video/x-matroska'));

            if (isDirectVideo) {
                showLoading(true, 'Direct Stream Ready — Playing in a Moment!', 'Buffering initial high-bitrate video frames...', 'almost_playing');
                // Remove crossorigin attribute so browser loads CDN video directly without CORS preflight blocks (same as VLC)
                mainVideo.removeAttribute('crossorigin');
                mainVideo.src = effectiveUrl;
                probeSmMovieStream(effectiveUrl);
                if (typeof syncDurationDisplay === 'function') syncDurationDisplay();
                mainVideo.onerror = () => {
                    console.warn('[Video Player] Direct video stream load error. Triggering fallback cascade...');
                    mainVideo.onerror = null;
                    cascadeFallback(CURRENT_SERVER);
                };
                if (targetSeekTime > 0 && !effectiveUrl.includes('/api/transcode/mkv') && !effectiveUrl.includes('transcode_mkv.php')) {
                    previousVideoTime = 0;
                    mainVideo.addEventListener('loadedmetadata', () => {
                        try { mainVideo.currentTime = targetSeekTime; } catch(e) {}
                    }, { once: true });
                }
                safePlayVideo();
                return;
            }

            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    enableWorker: true,
                    startFragPrefetch: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    maxBufferSize: 64 * 1024 * 1024,
                    backBufferLength: 30,
                    maxBufferHole: 0.5,
                    highBufferWatchdogPeriod: 2,
                    nudgeOffset: 0.1,
                    nudgeMaxRetry: 5,
                    manifestLoadingTimeOut: 15000,
                    manifestLoadingMaxRetry: 3,
                    manifestLoadingRetryDelay: 500,
                    levelLoadingTimeOut: 15000,
                    levelLoadingMaxRetry: 3,
                    levelLoadingRetryDelay: 500,
                    fragLoadingTimeOut: 15000,
                    fragLoadingMaxRetry: 3,
                    fragLoadingRetryDelay: 500,
                    xhrSetup: (xhr, url) => {
                        xhr.withCredentials = false;
                    }
                });

                hlsInstance.loadSource(effectiveUrl);
                hlsInstance.attachMedia(mainVideo);

                hlsInstance.on(Hls.Events.FRAG_LOADED, () => {
                    networkErrorRetries = 0;
                });

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    showLoading(true, 'M3U Playlist Loaded — Few Seconds to Play!', 'You are here! Synchronizing ' + ((data && data.levels && data.levels.length) ? (data.levels.length + ' HD quality levels') : 'cinema stream') + '...', 'almost_playing');
                    populateQualityLevels(data.levels);
                    detectAndPopulateAudioTracks();
                    detectAndPopulateSubtitleTracks();
                    
                    if (previousVideoTime > 0) {
                        const seekTo = previousVideoTime;
                        previousVideoTime = 0;
                        const applySeek = () => {
                            try {
                                if (mainVideo.duration && isFinite(mainVideo.duration) && seekTo < mainVideo.duration) {
                                    mainVideo.currentTime = seekTo;
                                } else if (seekTo > 0) {
                                    mainVideo.currentTime = seekTo;
                                }
                            } catch(e) {}
                        };

                        if (mainVideo.readyState >= 1) {
                            applySeek();
                        } else {
                            mainVideo.addEventListener('loadedmetadata', applySeek, { once: true });
                        }
                    }
                    
                    safePlayVideo();
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

                let networkErrorRetries = 0;
                let mediaErrorRetries = 0;
                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.details === 'bufferFullError' || data.details === Hls.ErrorDetails?.BUFFER_FULL_ERROR) {
                        try { hlsInstance.cleanUpBuffer(15); } catch(e){}
                        return;
                    }
                    if (data.details === 'bufferAddCodecError' || data.details === Hls.ErrorDetails?.BUFFER_ADD_CODEC_ERROR) {
                        try { hlsInstance.recoverMediaError(); } catch(e){}
                        return;
                    }
                    if (data.details === 'bufferSeekOverHole' || data.details === Hls.ErrorDetails?.BUFFER_SEEK_OVER_HOLE) {
                        if (data.buffer && data.buffer.nextStart) {
                            mainVideo.currentTime = data.buffer.nextStart;
                        }
                        return;
                    }
                    if (data.details === 'bufferStalledError' || data.details === Hls.ErrorDetails?.BUFFER_STALLED_ERROR) {
                        console.warn('[HLS] Non-fatal buffer stall detected. Nudging playhead and recovering playback...');
                        if (mainVideo.buffered && mainVideo.buffered.length > 0) {
                            const curTime = mainVideo.currentTime;
                            let nudged = false;
                            for (let i = 0; i < mainVideo.buffered.length; i++) {
                                const start = mainVideo.buffered.start(i);
                                const end = mainVideo.buffered.end(i);
                                if (curTime < start) {
                                    mainVideo.currentTime = start + 0.1;
                                    nudged = true;
                                    break;
                                } else if (curTime >= start && curTime < end) {
                                    if (end - curTime < 0.3 && i + 1 < mainVideo.buffered.length) {
                                        mainVideo.currentTime = mainVideo.buffered.start(i + 1) + 0.1;
                                        nudged = true;
                                    }
                                    break;
                                }
                            }
                            if (!nudged) {
                                const end = mainVideo.buffered.end(mainVideo.buffered.length - 1);
                                if (mainVideo.currentTime < end - 0.2) {
                                    mainVideo.currentTime += 0.15;
                                }
                            }
                        }
                        if (mainVideo.paused && !mainVideo.ended) {
                            safePlayVideo();
                        }
                        return;
                    }
                    if (!data.fatal) {
                        if (data.details === 'audioTrackLoadError' || data.details === 'audioTrackLoadTimeOut') {
                            try { hlsInstance.startLoad(); } catch (_) {}
                            return;
                        }
                        if (data.details === 'fragLoadTimeOut' || data.details === 'fragLoadError' || data.details === 'fragParsingError' || data.details === 'bufferAppendError' || data.details === 'bufferAppendNoProgress') {
                            try { hlsInstance.startLoad(); } catch (_) {}
                            return;
                        }
                        if (data.details === 'levelLoadError' || data.details === 'levelLoadTimeOut') {
                            setTimeout(() => { try { hlsInstance.startLoad(); } catch (_) {} }, 500);
                            return;
                        }
                        return;
                    }

                    console.warn('[HLS Fatal Error]', data.type, data.details);
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            networkErrorRetries++;
                            if (networkErrorRetries <= 3) {
                                console.log(`[HLS] Attempting network recovery (attempt ${networkErrorRetries})...`);
                                try { hlsInstance.startLoad(); } catch (_) {}
                            } else if (!streamUrl.includes('/stream_proxy.php') && !streamUrl.includes('/live.php') && !streamUrl.includes('/api/proxy/')) {
                                console.log('[HLS] Direct CDN stream network error. Trying reverse proxy...');
                                const proxiedUrl = `/stream_proxy.php?url=${encodeURIComponent(streamUrl)}`;
                                initHlsPlayer(proxiedUrl);
                            } else {
                                console.warn('[HLS] Unrecoverable network error. Triggering fallback cascade...');
                                if (hlsInstance) {
                                    try { hlsInstance.stopLoad(); hlsInstance.destroy(); } catch (_) {}
                                    hlsInstance = null;
                                }
                                cascadeFallback(CURRENT_SERVER);
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            mediaErrorRetries++;
                            if (mediaErrorRetries <= 3) {
                                console.log(`[HLS] Attempting media error recovery (attempt ${mediaErrorRetries})...`);
                                try { hlsInstance.recoverMediaError(); } catch (_) {}
                            } else {
                                console.warn('[HLS] Unrecoverable media parsing error. Triggering auto-fallback cascade...');
                                if (hlsInstance) {
                                    try { hlsInstance.stopLoad(); hlsInstance.destroy(); } catch (_) {}
                                    hlsInstance = null;
                                }
                                cascadeFallback(CURRENT_SERVER);
                            }
                            break;
                        default:
                            console.warn('[HLS] Fatal error, triggering fallback cascade...');
                            if (hlsInstance) {
                                try { hlsInstance.stopLoad(); hlsInstance.destroy(); } catch (_) {}
                                hlsInstance = null;
                            }
                            cascadeFallback(CURRENT_SERVER);
                            break;
                    }
                });
            } else if (mainVideo.canPlayType('application/vnd.apple.mpegurl')) {
                mainVideo.src = streamUrl;
                if (targetSeekTime > 0) {
                    previousVideoTime = 0;
                    mainVideo.addEventListener('loadedmetadata', () => {
                        try { mainVideo.currentTime = targetSeekTime; } catch(e) {}
                    }, { once: true });
                }
                safePlayVideo();
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

        /* ---------------- WEB AUDIO EQUALIZER & STEREO DOWNMIX ENGINE ---------------- */
        let webAudioCtx = null;
        let webAudioSource = null;
        let webAudioNodes = null;
        let currentAudioMode = 'stereo'; // 'stereo', 'dialogue', 'left_only', 'right_only', 'mono', 'passthrough'

        function initWebAudioEngine() {
            if (webAudioCtx) return;
            try {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtxClass || !mainVideo) return;
                webAudioCtx = new AudioCtxClass();
                
                try {
                    webAudioCtx.destination.channelCount = 2;
                    webAudioCtx.destination.channelCountMode = 'explicit';
                    webAudioCtx.destination.channelInterpretation = 'speakers';
                } catch (_) {}

                if (!mainVideo.crossOrigin) {
                    mainVideo.crossOrigin = 'anonymous';
                }

                webAudioSource = webAudioCtx.createMediaElementSource(mainVideo);
                applyAudioDownmixMode(currentAudioMode || 'stereo');
            } catch (err) {
                console.warn('[Web Audio Engine] Init notice (falling back to native audio):', err);
            }
        }

        function resumeWebAudio() {
            if (webAudioCtx && webAudioCtx.state === 'suspended') {
                webAudioCtx.resume().catch(() => {});
            }
        }

        function applyAudioDownmixMode(mode) {
            currentAudioMode = mode;
            if (!webAudioCtx || !webAudioSource) return;

            try {
                if (webAudioNodes) {
                    try {
                        webAudioNodes.splitter.disconnect();
                        webAudioNodes.merger.disconnect();
                        webAudioSource.disconnect();
                    } catch (_) {}
                    webAudioNodes = null;
                }

                if (mode === 'passthrough' || mode === 'stereo') {
                    webAudioSource.connect(webAudioCtx.destination);
                    return;
                }

                const splitter = webAudioCtx.createChannelSplitter(6);
                const merger = webAudioCtx.createChannelMerger(2);

                const gL_L = webAudioCtx.createGain(); // Left from Left
                const gR_R = webAudioCtx.createGain(); // Right from Right
                const gL_R = webAudioCtx.createGain(); // Left from Right
                const gR_L = webAudioCtx.createGain(); // Right from Left
                const gL_C = webAudioCtx.createGain(); // Left from Center (Dialogue)
                const gR_C = webAudioCtx.createGain(); // Right from Center (Dialogue)
                const gL_Ls = webAudioCtx.createGain(); // Left from Left Surround
                const gR_Rs = webAudioCtx.createGain(); // Right from Right Surround
                const gL_Lfe = webAudioCtx.createGain(); // Left from LFE
                const gR_Lfe = webAudioCtx.createGain(); // Right from LFE

                if (mode === 'stereo') {
                    // Standard ITU-R BS.775 5.1 -> Stereo Downmix
                    gL_L.gain.value = 1.0;
                    gR_R.gain.value = 1.0;
                    gL_R.gain.value = 0.0;
                    gR_L.gain.value = 0.0;
                    gL_C.gain.value = 0.707;
                    gR_C.gain.value = 0.707;
                    gL_Ls.gain.value = 0.707;
                    gR_Rs.gain.value = 0.707;
                    gL_Lfe.gain.value = 0.5;
                    gR_Lfe.gain.value = 0.5;
                } else if (mode === 'dialogue') {
                    // Center Dialogue Boost: Enhances vocal clarity equally in both ears
                    gL_L.gain.value = 0.75;
                    gR_R.gain.value = 0.75;
                    gL_R.gain.value = 0.0;
                    gR_L.gain.value = 0.0;
                    gL_C.gain.value = 1.4;
                    gR_C.gain.value = 1.4;
                    gL_Ls.gain.value = 0.4;
                    gR_Rs.gain.value = 0.4;
                    gL_Lfe.gain.value = 0.3;
                    gR_Lfe.gain.value = 0.3;
                } else if (mode === 'left_only') {
                    // Left channel sent to both ears (Fixes dual-audio Hindi/Eng or one-sided Left sound)
                    gL_L.gain.value = 1.0;
                    gR_L.gain.value = 1.0;
                    gR_R.gain.value = 0.0;
                    gL_R.gain.value = 0.0;
                    gL_C.gain.value = 0.0;
                    gR_C.gain.value = 0.0;
                    gL_Ls.gain.value = 0.0;
                    gR_Rs.gain.value = 0.0;
                    gL_Lfe.gain.value = 0.0;
                    gR_Lfe.gain.value = 0.0;
                } else if (mode === 'right_only') {
                    // Right channel sent to both ears (Fixes dual-audio Hindi/Eng or one-sided Right sound)
                    gL_L.gain.value = 0.0;
                    gR_L.gain.value = 0.0;
                    gR_R.gain.value = 1.0;
                    gL_R.gain.value = 1.0;
                    gL_C.gain.value = 0.0;
                    gR_C.gain.value = 0.0;
                    gL_Ls.gain.value = 0.0;
                    gR_Rs.gain.value = 0.0;
                    gL_Lfe.gain.value = 0.0;
                    gR_Lfe.gain.value = 0.0;
                } else if (mode === 'mono') {
                    // 50/50 blend of Left and Right into both ears
                    gL_L.gain.value = 0.5;
                    gL_R.gain.value = 0.5;
                    gR_L.gain.value = 0.5;
                    gR_R.gain.value = 0.5;
                    gL_C.gain.value = 0.5;
                    gR_C.gain.value = 0.5;
                    gL_Ls.gain.value = 0.35;
                    gR_Rs.gain.value = 0.35;
                    gL_Lfe.gain.value = 0.25;
                    gR_Lfe.gain.value = 0.25;
                }

                webAudioSource.connect(splitter);

                // Ch 0 (Left)
                splitter.connect(gL_L, 0);
                splitter.connect(gR_L, 0);
                // Ch 1 (Right)
                splitter.connect(gR_R, 1);
                splitter.connect(gL_R, 1);
                // Ch 2 (Center)
                splitter.connect(gL_C, 2);
                splitter.connect(gR_C, 2);
                // Ch 3 (LFE)
                splitter.connect(gL_Lfe, 3);
                splitter.connect(gR_Lfe, 3);
                // Ch 4 (Left Surround)
                splitter.connect(gL_Ls, 4);
                // Ch 5 (Right Surround)
                splitter.connect(gR_Rs, 5);

                // Merge to Left output (channel 0)
                gL_L.connect(merger, 0, 0);
                gL_R.connect(merger, 0, 0);
                gL_C.connect(merger, 0, 0);
                gL_Ls.connect(merger, 0, 0);
                gL_Lfe.connect(merger, 0, 0);

                // Merge to Right output (channel 1)
                gR_R.connect(merger, 0, 1);
                gR_L.connect(merger, 0, 1);
                gR_C.connect(merger, 0, 1);
                gR_Rs.connect(merger, 0, 1);
                gR_Lfe.connect(merger, 0, 1);

                merger.connect(webAudioCtx.destination);
                webAudioNodes = { splitter, merger };
            } catch (err) {
                console.warn('[Web Audio Engine] Mode configuration error:', err);
                try {
                    webAudioSource.disconnect();
                    webAudioSource.connect(webAudioCtx.destination);
                } catch (_) {}
            }
        }

        window.setAudioDownmixMode = function(mode) {
            initWebAudioEngine();
            resumeWebAudio();
            applyAudioDownmixMode(mode);
            detectAndPopulateAudioTracks();
            const labels = {
                'stereo': 'Balanced Stereo (5.1 Downmix)',
                'dialogue': 'Dialogue Boost Active',
                'left_only': 'Left Ear Mono (Dub A)',
                'right_only': 'Right Ear Mono (Dub B)',
                'mono': 'Mono Balanced Blend'
            };
            showToast(labels[mode] || 'Audio mode updated');
        };

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

            // Check if multi-audio tracks are loaded from MKV probe metadata
            if (window.bingrAudioTracks && window.bingrAudioTracks.length > 0) {
                tracks = window.bingrAudioTracks.map((t, idx) => {
                    const isSelected = currentActiveAudioTrack === idx || (currentActiveAudioTrack === -1 && idx === 0);
                    return {
                        id: idx,
                        name: t.label || getLanguageDisplayName(t.language) || `Audio Track ${idx + 1}`,
                        rawName: t.label || '',
                        details: t.codec ? `${t.codec.toUpperCase()} Multi-Audio` : 'Dual/Multi-Audio Track',
                        isDefault: idx === 0,
                        isSelected: isSelected
                    };
                });
            } else if (hlsAudioTracks.length > 0) {
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

            // Audio Balance & Downmixing Controls
            const audioModes = [
                { id: 'stereo', name: 'Balanced Stereo', desc: '5.1 Downmix / Balanced Stereo' },
                { id: 'dialogue', name: 'Dialogue Boost', desc: 'Centered Vocals & Clarity' },
                { id: 'left_only', name: 'Left Ear (Dub A)', desc: 'Dual-Audio Left Channel' },
                { id: 'right_only', name: 'Right Ear (Dub B)', desc: 'Dual-Audio Right Channel' },
                { id: 'mono', name: 'Mono Blend', desc: '50/50 Channel Blend' }
            ];

            html += `
                <div class="border-t border-white/10 pt-2.5 mt-2 mb-2">
                    <div class="flex items-center justify-between mb-1.5 px-0.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Audio Channels & Stereo Downmix</span>
                        <span class="text-[9px] text-zinc-400 font-medium">${currentAudioMode === 'stereo' ? '5.1 Downmixed' : currentAudioMode.toUpperCase()}</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5" id="audioModeSelectorGrid">
            `;

            audioModes.forEach(m => {
                const isSelected = (currentAudioMode === m.id);
                html += `
                    <button type="button" onclick="setAudioDownmixMode('${m.id}')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${isSelected ? 'glass-sub-panel bg-emerald-500/20 text-white ring-1 ring-emerald-400/40 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="truncate">
                            <div class="text-white font-bold text-[11px] truncate">${m.name}</div>
                            <div class="text-[9px] text-zinc-400 font-normal truncate">${m.desc}</div>
                        </div>
                        ${isSelected ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                    </button>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            // Multi-Language Dub Server Clusters Fast Switcher
            html += `
                <div class="border-t border-white/10 pt-2.5 mt-2">
                    <div class="flex items-center justify-between mb-1.5 px-0.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Language Dub Clusters</span>
                        <span class="text-[9px] text-zinc-500 font-medium">Fast Server Switch</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        <button type="button" onclick="switchServerCluster('m4u')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'm4u' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Movie 4U (m4u)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Direct M3U8 Master</div>
                            </div>
                            ${CURRENT_SERVER === 'm4u' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
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
                        <button type="button" onclick="switchServerCluster('s30')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's30' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Nova (s30)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Fast Direct HLS</div>
                            </div>
                            ${CURRENT_SERVER === 's30' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s80')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's80' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Moscow (s80)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Fast Direct HLS</div>
                            </div>
                            ${CURRENT_SERVER === 's80' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s31')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's31' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Orion (s31)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Worker High-Speed</div>
                            </div>
                            ${CURRENT_SERVER === 's31' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('sm_hub')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'sm_hub' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">SM Movie Hub</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Direct VOD/MKV Audio</div>
                            </div>
                            ${CURRENT_SERVER === 'sm_hub' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('framex')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'framex' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">FrameX TV</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Source 4K/1080p</div>
                            </div>
                            ${CURRENT_SERVER === 'framex' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s81')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's81' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Novo (s81)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">StreamRip Direct HLS</div>
                            </div>
                            ${CURRENT_SERVER === 's81' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s40')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's40' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Aphelion (s40)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">DarkMatter Direct</div>
                            </div>
                            ${CURRENT_SERVER === 's40' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s3')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's3' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Edmunds (s3)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Filmu Original Audio</div>
                            </div>
                            ${CURRENT_SERVER === 's3' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s60')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's60' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Vertex (s60)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Direct CDN</div>
                            </div>
                            ${CURRENT_SERVER === 's60' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s63')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's63' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Hallyu (s63)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Asian & International</div>
                            </div>
                            ${CURRENT_SERVER === 's63' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s61')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's61' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Corvus (s61)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Source Hub</div>
                            </div>
                            ${CURRENT_SERVER === 's61' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('hianime')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'hianime' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">HiAnime (Anime)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">MegaPlay Multi-Audio</div>
                            </div>
                            ${CURRENT_SERVER === 'hianime' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('asiaflix')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'asiaflix' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Asiaflix</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Vidmoly Multi-Bitrate</div>
                            </div>
                            ${CURRENT_SERVER === 'asiaflix' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('kisskh')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'kisskh' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">KissKH</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Asian Drama & Anime</div>
                            </div>
                            ${CURRENT_SERVER === 'kisskh' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('animesalt')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'animesalt' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">AnimeSalt</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Special Multi-Audio</div>
                            </div>
                            ${CURRENT_SERVER === 'animesalt' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
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

            if (window.bingrAudioTracks && window.bingrAudioTracks.length > 0) {
                const curTime = (mainVideo && !isNaN(mainVideo.currentTime) && mainVideo.currentTime > 0) ? mainVideo.currentTime : previousVideoTime || 0;
                previousVideoTime = curTime;
                
                let activeUrl = window.bingrActiveStreamUrl || '';
                if (activeUrl.includes('audio=')) {
                    activeUrl = activeUrl.replace(/audio=\d+/, `audio=${trackIdx}`);
                } else if (activeUrl.includes('a=')) {
                    activeUrl = activeUrl.replace(/a=\d+/, `a=${trackIdx}`);
                } else {
                    activeUrl += (activeUrl.includes('?') ? '&' : '?') + `audio=${trackIdx}`;
                }

                if (activeUrl.includes('ss=')) {
                    activeUrl = activeUrl.replace(/ss=[\d\.]+/, `ss=${Math.floor(curTime)}`);
                } else if (curTime > 0) {
                    activeUrl += `&ss=${Math.floor(curTime)}`;
                }

                const trackName = window.bingrAudioTracks[trackIdx]?.label || (`Track ${trackIdx + 1}`);
                showToast(`Switching Audio: ${trackName}`);
                initHlsPlayer(activeUrl);
                detectAndPopulateAudioTracks();
                return;
            }

            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks.length > trackIdx) {
                try {
                    hlsInstance.audioTrack = trackIdx;
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
            const curTime = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
            if (curTime > 0) previousVideoTime = curTime;
            showToast(`Switching audio cluster to ${getServerName(serverId)}...`);
            fetchAndPlayStream(serverId, true);
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
        let parsedSubtitleCues = [];

        function parseVttCues(vttText) {
            if (!vttText || typeof vttText !== 'string') return [];
            const cues = [];
            const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            let i = 0;
            const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

            function parseTimestamp(hours, mins, secs, ms) {
                const h = hours ? parseInt(hours, 10) : 0;
                const m = parseInt(mins, 10);
                const s = parseInt(secs, 10);
                const milli = parseInt(ms, 10);
                return h * 3600 + m * 60 + s + milli / 1000;
            }

            while (i < lines.length) {
                const line = lines[i].trim();
                const match = line.match(timeRegex);
                if (match) {
                    const start = parseTimestamp(match[1], match[2], match[3], match[4]);
                    const end = parseTimestamp(match[5], match[6], match[7], match[8]);
                    i++;
                    const textLines = [];
                    while (i < lines.length && lines[i].trim() !== '') {
                        let cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
                        if (cleaned) textLines.push(cleaned);
                        i++;
                    }
                    if (textLines.length > 0) {
                        cues.push({
                            start: start,
                            end: end,
                            text: textLines.join('<br>')
                        });
                    }
                } else {
                    i++;
                }
            }
            return cues;
        }

        function updateSubtitleOverlay() {
            const overlayText = document.getElementById('customSubtitleText');
            if (!overlayText) return;

            if (currentActiveSubtitleTrack === -1 || !mainVideo) {
                overlayText.classList.add('hidden');
                return;
            }

            // High-precision memory cue overlay for loaded WebVTT / SRT
            if (parsedSubtitleCues && parsedSubtitleCues.length > 0) {
                const current = (mainVideo.currentTime || 0) + (subtitleSyncOffset || 0);
                const activeCue = parsedSubtitleCues.find(c => c.start <= current && current <= c.end);
                if (activeCue && activeCue.text) {
                    overlayText.innerHTML = activeCue.text;
                    overlayText.classList.remove('hidden');
                    return;
                } else {
                    overlayText.classList.add('hidden');
                    return;
                }
            }

            // HLS native track active cue detection
            if (mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    const track = mainVideo.textTracks[i];
                    if (track.mode === 'showing' || track.mode === 'hidden') {
                        if (track.activeCues && track.activeCues.length > 0) {
                            const cue = track.activeCues[0];
                            const txt = cue.text || (cue.getCueAsHTML ? cue.getCueAsHTML().textContent : '');
                            if (txt) {
                                overlayText.innerHTML = txt.replace(/\n/g, '<br>');
                                overlayText.classList.remove('hidden');
                                return;
                            }
                        }
                    }
                }
            }

            overlayText.classList.add('hidden');
        }

        function detectAndPopulateSubtitleTracks() {
            populateSubtitlesList();
        }

        async function fetchExternalSubtitles() {
            try {
                const sParam = MEDIA_TYPE === 'tv' ? `&season=${MEDIA_SEASON}&episode=${MEDIA_EPISODE}` : '';
                const imdbParam = IMDB_ID ? `&imdb=${encodeURIComponent(IMDB_ID)}` : '';
                const tmdbParam = (MEDIA_ID && MEDIA_ID !== '{{ID}}') ? `&tmdb=${encodeURIComponent(MEDIA_ID)}` : '';
                const res = await fetch(`/api/subtitles/fetch?title=${encodeURIComponent(MEDIA_TITLE)}${tmdbParam}${imdbParam}${sParam}`);
                const data = await res.json();
                if (data && data.subtitles && Array.isArray(data.subtitles)) {
                    data.subtitles.forEach(sub => {
                        // Avoid duplicates by unique URL, but keep multiple distinct subtitle releases
                        if (!externalSubtitlesLoaded.some(e => e.url === sub.url)) {
                            const label = sub.display || (sub.source ? `[${sub.source}] ${sub.language || 'English'}` : (sub.language || 'English'));
                            externalSubtitlesLoaded.push({
                                lang: label,
                                url: sub.url,
                                id: sub.id
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
            parsedSubtitleCues = [];
            if (hlsInstance) {
                hlsInstance.subtitleTrack = trackIdx;
            }
            populateSubtitlesList();
            updateSubtitleOverlay();
            showToast('HLS Subtitle Activated');
        }

        function setSubtitleTrack(trackIdx) {
            currentActiveSubtitleTrack = -1;
            parsedSubtitleCues = [];
            if (hlsInstance) {
                hlsInstance.subtitleTrack = -1;
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    mainVideo.textTracks[i].mode = 'disabled';
                }
            }
            const overlayText = document.getElementById('customSubtitleText');
            if (overlayText) overlayText.classList.add('hidden');
            populateSubtitlesList();
            showToast('Subtitles Disabled');
        }

        async function loadExternalSubtitle(url, label, virtualId) {
            currentActiveSubtitleTrack = virtualId !== undefined ? virtualId : 9999;
            if (hlsInstance) hlsInstance.subtitleTrack = -1;

            let safeUrl = url;
            if (url.startsWith('http') && !url.includes('/api/subtitles/vtt')) {
                safeUrl = `/api/subtitles/vtt?url=${encodeURIComponent(url)}`;
            }

            showToast(`Loading: ${label}...`);

            // 1. Fetch text and parse into in-memory cues for guaranteed custom overlay rendering
            try {
                const res = await fetch(safeUrl);
                if (res.ok) {
                    const text = await res.text();
                    parsedSubtitleCues = parseVttCues(text);
                    console.log(`[Subtitles] Loaded ${parsedSubtitleCues.length} cues for: ${label}`);
                }
            } catch (err) {
                console.warn('[Subtitles] Overlay parsing warning:', err);
            }

            // 2. Attach as native HTML5 track as secondary fallback
            const existing = mainVideo.querySelectorAll('track');
            existing.forEach(t => t.remove());

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
                        target.mode = 'hidden'; // 'hidden' keeps cues active without double native rendering
                    }
                }
            }, 200);

            applySubtitleStyles();
            updateSubtitleOverlay();
            populateSubtitlesList();
            showToast(`Active: ${label}`);
        }

        function setupSubtitlesUploader() {
            const input = document.getElementById('customSubInput');
            if (!input) return;
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    parsedSubtitleCues = parseVttCues(text);
                    currentActiveSubtitleTrack = 8888;
                    if (hlsInstance) hlsInstance.subtitleTrack = -1;
                    applySubtitleStyles();
                    updateSubtitleOverlay();
                    populateSubtitlesList();
                    showToast(`Uploaded Subtitle: ${file.name}`);
                } catch (err) {
                    showToast('Failed to read subtitle file');
                }
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
            if (!list) return;

            // 1. If HLS has multiple rendition levels
            if (levels && levels.length > 0) {
                const isAutoActive = !hlsInstance || hlsInstance.autoLevelEnabled;
                list.innerHTML = `
                    <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left hover:bg-white/10 transition-colors glass-sub-panel ${isAutoActive ? 'bg-white/15 text-white' : 'text-zinc-300'}">
                        <span>Auto (Adaptive Bitrate)</span>
                        ${isAutoActive ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}
                    </button>
                `;

                levels.forEach((lvl, idx) => {
                    const height = lvl.height || (lvl.bitrate ? `${Math.round(lvl.bitrate / 1000)}k` : 'HD');
                    const isSelected = hlsInstance && !hlsInstance.autoLevelEnabled && hlsInstance.currentLevel === idx;
                    const btn = document.createElement('button');
                    btn.id = 'quality-btn-' + idx;
                    btn.className = `w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left hover:bg-white/10 transition-colors glass-sub-panel ${isSelected ? 'bg-white/15 text-white' : 'text-zinc-300'}`;
                    btn.onclick = () => setQualityLevel(idx);
                    btn.innerHTML = `<span>${height}${typeof height === 'number' ? 'p' : ''}</span>${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}`;
                    list.appendChild(btn);
                });
            } else if (window.bingrSources && window.bingrSources.length > 1) {
                // 2. If multi-source qualities are provided (e.g. 1080p, 720p, 480p from scraper)
                list.innerHTML = '';
                window.bingrSources.forEach((srcObj, idx) => {
                    const qText = srcObj.quality || srcObj.label || `Quality Stream ${idx + 1}`;
                    const isSelected = window.bingrActiveStreamUrl === srcObj.url;
                    const btn = document.createElement('button');
                    btn.id = 'quality-src-btn-' + idx;
                    btn.className = `w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left hover:bg-white/10 transition-colors glass-sub-panel ${isSelected ? 'bg-white/15 text-white' : 'text-zinc-300'}`;
                    btn.onclick = () => switchSourceQuality(srcObj.url, qText);
                    btn.innerHTML = `<span>${qText}</span>${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}`;
                    list.appendChild(btn);
                });
            } else {
                // 3. Single stream quality options
                list.innerHTML = `
                    <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left glass-sub-panel bg-white/15 text-white">
                        <span>Auto (Best Quality • 1080p FHD)</span>
                        <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                    </button>
                    <button class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left text-zinc-400 glass-sub-panel opacity-60 cursor-default">
                        <span>1080p Full HD (Master Bitrate)</span>
                    </button>
                `;
            }

            if (window.lucide) lucide.createIcons();
            updateQualityButtonLabel();
        }

        function switchSourceQuality(url, label) {
            if (!url || url === window.bingrActiveStreamUrl) return;
            previousVideoTime = mainVideo.currentTime;
            initHlsPlayer(url);
            showToast(`Switched quality to ${label}`);
            const btnLabel = document.getElementById('qualityButtonLabel');
            const btnLabelMob = document.getElementById('qualityButtonLabelMob');
            if (btnLabel) btnLabel.textContent = label;
            if (btnLabelMob) btnLabelMob.textContent = label;
        }

        function setQualityLevel(levelIndex) {
            if (hlsInstance) {
                hlsInstance.currentLevel = levelIndex;
            }
            populateQualityLevels(hlsInstance ? hlsInstance.levels : []);
            updateQualityButtonLabel();
            showToast(levelIndex === -1 ? 'Quality: Auto (Adaptive)' : `Quality level set to #${levelIndex + 1}`);
        }

        function updateQualityButtonLabel() {
            const btnLabel = document.getElementById('qualityButtonLabel');
            const btnLabelMob = document.getElementById('qualityButtonLabelMob');
            let text = '1080p';
            if (hlsInstance && hlsInstance.levels && hlsInstance.levels.length > 0) {
                if (hlsInstance.autoLevelEnabled) {
                    const cur = hlsInstance.levels[hlsInstance.currentLevel];
                    const res = cur && cur.height ? (cur.height + 'p') : '1080p';
                    text = 'Auto • ' + res;
                } else {
                    const cur = hlsInstance.levels[hlsInstance.currentLevel];
                    text = cur && cur.height ? (cur.height + 'p') : '1080p';
                }
            } else if (window.bingrSources && window.bingrSources.length > 0) {
                const active = window.bingrSources.find(s => s && s.url === window.bingrActiveStreamUrl);
                if (active && active.quality) text = active.quality;
            }

            if (btnLabel) btnLabel.textContent = text;
            if (btnLabelMob) btnLabelMob.textContent = text;
        }

        async function loadServerList() {
            try {
                const isAnime = Boolean(isAnimeContent || (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'anime') || window.MAL_ID || window.ANILIST_ID);
                const queryParam = isAnime 
                    ? `?type=anime&malId=${encodeURIComponent(window.MAL_ID || '')}&anilistId=${encodeURIComponent(window.ANILIST_ID || '')}` 
                    : `?type=${encodeURIComponent(MEDIA_TYPE)}`;
                const res = await fetch(`/api/bingr/servers${queryParam}`);
                const data = await res.json();
                if (data.status === 'success' && data.servers && data.servers.length > 0) {
                    availableServers = isAnime 
                        ? data.servers.filter(s => ['bing_anime', 'hianime', 'animesalt', 'kisskh', 'asiaflix', 's40', 'framex'].includes(s.id))
                        : data.servers;
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
                const flag = srv.cc === 'BD' ? '🇧🇩' : (srv.cc === 'IN' ? '🇮🇳' : (srv.cc === 'US' ? '🇺🇸' : (srv.cc === 'JP' ? '🇯🇵' : (srv.cc === 'KR' ? '🇰🇷' : (srv.cc === 'IT' ? '🇮🇹' : (srv.cc === 'IS' ? '🇮🇸' : '⚡'))))));
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
            if (typeof detectAndPopulateAudioTracks === 'function') {
                detectAndPopulateAudioTracks();
            }
            const clusterBadge = document.getElementById('hudClusterBadge');
            if (clusterBadge) {
                clusterBadge.textContent = getServerName(CURRENT_SERVER);
            }
        }

        function switchServer(serverId) {
            if (serverId === CURRENT_SERVER) return;
            const curTime = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
            if (curTime > 0) previousVideoTime = curTime;
            toggleQualityServerModal(false);
            failedServers.clear();
            showToast(`Switching server to ${getServerName(serverId)}...`);
            fetchAndPlayStream(serverId, true);
        }

        function getServerName(id) {
            const s = availableServers.find(x => x.id === id);
            return s ? s.name : id;
        }

        function triggerAutoReconnect() {
            showToast('Reconnecting Stream...');
            const curTime = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
            if (curTime > 0) previousVideoTime = curTime;
            fetchAndPlayStream(CURRENT_SERVER, true);
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

        function toggleRotation(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (screen.orientation && screen.orientation.lock) {
                const currentType = screen.orientation.type || '';
                if (currentType.startsWith('portrait')) {
                    screen.orientation.lock('landscape').then(() => {
                        showToast('Locked to Landscape Cinema');
                    }).catch(() => {
                        fallbackRotation();
                    });
                } else {
                    screen.orientation.lock('portrait').then(() => {
                        showToast('Locked to Portrait');
                    }).catch(() => {
                        fallbackRotation();
                    });
                }
            } else {
                fallbackRotation();
            }

            function fallbackRotation() {
                currentRotation = (currentRotation + 90) % 360;
                const container = document.getElementById('playerContainer');
                if (!container) return;
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
        }

        function toggleScreenLock(lockState) {
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
                document.body.appendChild(lockOverlay);
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
                    toggleScreenLock(false);
                };
                unlockBtn.onclick = doUnlock;
                unlockBtn.ontouchstart = doUnlock;
                document.body.appendChild(unlockBtn);
            }

            const shouldLock = (typeof lockState === 'boolean') ? lockState : !document.body.classList.contains('player-screen-locked');

            if (shouldLock) {
                document.body.classList.add('player-screen-locked');
                unlockBtn.classList.remove('unlock-hidden');
                showToast('🔒 Screen Controls Locked');
                
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
                showToast('🔓 Screen Controls Unlocked');
            }
        }

        function revealUnlockBtnOnTouch(e) {
            if (document.body.classList.contains('player-screen-locked')) {
                let unlockBtn = document.getElementById('player-unlock-btn');
                if (!unlockBtn) {
                    toggleScreenLock(true);
                    unlockBtn = document.getElementById('player-unlock-btn');
                }
                if (unlockBtn) {
                    unlockBtn.classList.remove('unlock-hidden');
                    clearTimeout(window._unlockBtnTimer);
                    window._unlockBtnTimer = setTimeout(() => {
                        if (document.body.classList.contains('player-screen-locked')) {
                            unlockBtn.classList.add('unlock-hidden');
                        }
                    }, 3500);
                }
            }
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

        /* ---------------- ANIMATED PLAY / PAUSE LOGIC & SCREEN STOP OVERLAY ---------------- */
        function updatePlayPauseIcons(isPlaying) {
            const pairs = [
                { play: document.getElementById('playIcon'), pause: document.getElementById('pauseIcon') },
                { play: document.getElementById('playIconMob'), pause: document.getElementById('pauseIconMob') }
            ];
            pairs.forEach(p => {
                if (p.play && p.pause) {
                    if (isPlaying) {
                        p.play.classList.add('hidden', 'scale-75', 'opacity-0');
                        p.play.classList.remove('scale-100', 'opacity-100');
                        p.pause.classList.remove('hidden', 'scale-75', 'opacity-0');
                        p.pause.classList.add('scale-100', 'opacity-100');
                    } else {
                        p.play.classList.remove('hidden', 'scale-75', 'opacity-0');
                        p.play.classList.add('scale-100', 'opacity-100');
                        p.pause.classList.add('hidden', 'scale-75', 'opacity-0');
                        p.pause.classList.remove('scale-100', 'opacity-100');
                    }
                }
            });
        }

        function togglePlayPause(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (playerMode === 'embed') {
                showToast('Embedded player: use on-screen controls or toggle fullscreen');
                return;
            }
            if (!mainVideo) return;
            if (mainVideo.paused) {
                safePlayVideo();
                showCenterBurst('play');
            } else {
                safePauseVideo();
                showCenterBurst('pause');
            }
            showControls(true);
            resetControlsTimer();
        }

        mainVideo.addEventListener('play', () => {
            if (mainVideo.readyState >= 3) {
                showLoading(false);
            }
            updatePlayPauseIcons(true);
            if (mediaHudOverlay) {
                mediaHudOverlay.classList.remove('opacity-100');
                mediaHudOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
        });

        mainVideo.addEventListener('waiting', () => {
            if (playerMode !== 'embed') {
                showLoading(true, 'Smoothing Stream Buffer — Few Seconds to Play!', 'Hang tight! Fetching the next high-definition segment...', 'm3u_loaded');
            }
        });

        mainVideo.addEventListener('playing', () => {
            showLoading(false);
        });

        mainVideo.addEventListener('canplay', () => {
            showLoading(false);
        });

        mainVideo.addEventListener('pause', () => {
            updatePlayPauseIcons(false);
            if (playerMode !== 'embed') {
                if (mediaHudOverlay && window.innerWidth >= 900) {
                    mediaHudOverlay.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
                    mediaHudOverlay.classList.add('opacity-100');
                }
            }
            showControls(true);
        });

        let lastTouchEndTime = 0;

        mainVideo.addEventListener('click', (e) => {
            if (Date.now() - lastTouchEndTime < 450) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            togglePlayPause(e);
        });

        function getEffectiveDuration() {
            const isTranscode = window.bingrActiveStreamUrl && (window.bingrActiveStreamUrl.includes('/api/transcode/mkv') || window.bingrActiveStreamUrl.includes('transcode_mkv.php'));
            if (isTranscode && window.bingrDuration && isFinite(window.bingrDuration) && window.bingrDuration > 0) {
                return window.bingrDuration;
            }

            if (mainVideo && isFinite(mainVideo.duration) && mainVideo.duration > 0 && mainVideo.duration !== Infinity) {
                return mainVideo.duration;
            }
            if (window.bingrDuration && isFinite(window.bingrDuration) && window.bingrDuration > 0) {
                return window.bingrDuration;
            }
            return 0;
        }

        function seekRelative(seconds) {
            const dur = getEffectiveDuration();
            const offset = (window.bingrSeekOffset !== undefined && window.bingrSeekOffset > 0) ? window.bingrSeekOffset : 0;
            let cur = offset + ((mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0);
            const targetTime = Math.max(0, dur > 0 ? Math.min(dur, cur + seconds) : cur + seconds);

            if (window.bingrActiveStreamUrl && (window.bingrActiveStreamUrl.includes('/api/transcode/mkv') || window.bingrActiveStreamUrl.includes('transcode_mkv.php'))) {
                let baseUrl = window.bingrActiveStreamUrl || '';
                if (baseUrl.includes('&ss=')) {
                    baseUrl = baseUrl.replace(/&ss=[\d\.]+/, '');
                } else if (baseUrl.includes('?ss=')) {
                    baseUrl = baseUrl.replace(/\?ss=[\d\.]+&?/, '?');
                }
                const sep = baseUrl.includes('?') ? '&' : '?';
                const newUrl = baseUrl + `${sep}ss=${Math.floor(targetTime)}`;
                window.bingrSeekOffset = Math.floor(targetTime);
                window.bingrActiveStreamUrl = newUrl;
                previousVideoTime = 0;
                initHlsPlayer(newUrl);
            } else if (mainVideo) {
                mainVideo.currentTime = targetTime;
            }
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
            const iconMob = document.getElementById('volumeIconMob');
            const iconName = (mainVideo.muted || mainVideo.volume === 0) 
                ? 'volume-x' 
                : (mainVideo.volume < 0.5 ? 'volume-1' : 'volume-2');
            
            if (icon) icon.setAttribute('data-lucide', iconName);
            if (iconMob) iconMob.setAttribute('data-lucide', iconName);
            if (window.lucide) lucide.createIcons();
        }

        function setupTimeline() {
            function syncDurationDisplay() {
                const dur = getEffectiveDuration();
                if (dur > 0) {
                    const durFmt = formatTime(dur);
                    if (timeDuration) timeDuration.textContent = durFmt;
                    const timeDurationMob = document.getElementById('timeDurationMob');
                    if (timeDurationMob) timeDurationMob.textContent = durFmt;
                } else {
                    if (timeDuration) timeDuration.textContent = '--:--';
                    const timeDurationMob = document.getElementById('timeDurationMob');
                    if (timeDurationMob) timeDurationMob.textContent = '--:--';
                }
            }

            mainVideo.addEventListener('timeupdate', () => {
                if (isScrubbing) return;
                let current = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
                
                // Account for server-side seek offset in transcode streams
                const offset = (window.bingrSeekOffset !== undefined && window.bingrSeekOffset > 0) ? window.bingrSeekOffset : 0;
                if (offset > 0) {
                    current += offset;
                } else if (window.bingrActiveStreamUrl && (window.bingrActiveStreamUrl.includes('/api/transcode/mkv') || window.bingrActiveStreamUrl.includes('transcode_mkv.php'))) {
                    const ssMatch = window.bingrActiveStreamUrl.match(/[?&]ss=([\d\.]+)/);
                    if (ssMatch) {
                        current += parseFloat(ssMatch[1]) || 0;
                    }
                }

                const duration = getEffectiveDuration();
                const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
                timelineProgress.style.width = pct + '%';
                timelineThumb.style.left = pct + '%';
                
                const curFmt = formatTime(current);
                if (timeCurrent) timeCurrent.textContent = curFmt;
                const timeCurrentMob = document.getElementById('timeCurrentMob');
                if (timeCurrentMob) timeCurrentMob.textContent = curFmt;

                syncDurationDisplay();

                // AniSkip / Skip Intro & Outro triggers (strictly for pure 'op' and 'ed', excluding mixed-op and mixed-ed)
                let matchedAniSkip = null;
                if (aniSkipResults && aniSkipResults.length > 0) {
                    matchedAniSkip = aniSkipResults.find(s => {
                        const t = (s.skipType || '').toLowerCase().trim();
                        // Skip intro and outro ONLY for intro (op) and outro (ed), NOT for mixed opening and ending
                        if (t !== 'op' && t !== 'ed') return false;
                        const start = Math.max(0, (s.interval.startTime || 0) - 0.25);
                        return current >= start && current < s.interval.endTime;
                    });
                }

                if (matchedAniSkip && current >= 0) {
                    activeAniSkipSegment = matchedAniSkip;
                    const segId = matchedAniSkip.skipId || `${matchedAniSkip.skipType}_${Math.round(matchedAniSkip.interval.startTime)}`;

                    if (aniSkipAutoSkip) {
                        if (lastAutoSkippedId !== segId) {
                            lastAutoSkippedId = segId;
                            const targetTime = Math.min(duration, matchedAniSkip.interval.endTime + 0.5);
                            mainVideo.currentTime = targetTime;
                            showToast('⚡ Auto-Skipped ' + getSkipTypeName(matchedAniSkip.skipType));
                        }
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('show');
                            btnSkipIntro.classList.add('hidden');
                        }
                    } else {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('hidden');
                            btnSkipIntro.classList.add('show');
                            const typeName = getSkipTypeName(matchedAniSkip.skipType);
                            const rem = Math.max(0, Math.ceil(matchedAniSkip.interval.endTime - current));
                            if (skipIntroText) skipIntroText.textContent = `Skip ${typeName} (${rem}s)`;
                            if (skipIntroIcon) {
                                if (matchedAniSkip.skipType === 'op') {
                                    skipIntroIcon.setAttribute('data-lucide', 'zap');
                                    btnSkipIntro.style.borderColor = 'rgba(251, 191, 36, 0.7)';
                                } else if (matchedAniSkip.skipType === 'ed') {
                                    skipIntroIcon.setAttribute('data-lucide', 'skip-forward');
                                    btnSkipIntro.style.borderColor = 'rgba(192, 132, 252, 0.7)';
                                } else {
                                    skipIntroIcon.setAttribute('data-lucide', 'fast-forward');
                                    btnSkipIntro.style.borderColor = 'rgba(56, 189, 248, 0.7)';
                                }
                                if (window.lucide) lucide.createIcons();
                            }
                        }
                    }
                } else {
                    activeAniSkipSegment = null;
                    if (lastAutoSkippedId && (!aniSkipResults || !aniSkipResults.some(s => {
                        const sid = s.skipId || `${s.skipType}_${Math.round(s.interval.startTime)}`;
                        const isIntro = s.skipType === 'op';
                        const start = isIntro ? 0 : Math.max(0, s.interval.startTime);
                        return sid === lastAutoSkippedId && current >= start;
                    }))) {
                        lastAutoSkippedId = null;
                    }

                    // Heuristic fallback for standard series (starting from 00 up to 90s) if no AniSkip entries loaded
                    if (current >= 0 && current <= 90 && (!aniSkipResults || aniSkipResults.length === 0)) {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('hidden');
                            btnSkipIntro.classList.add('show');
                            if (skipIntroText) skipIntroText.textContent = 'Skip Intro';
                            if (skipIntroIcon) skipIntroIcon.setAttribute('data-lucide', 'fast-forward');
                            btnSkipIntro.style.borderColor = '';
                            if (window.lucide) lucide.createIcons();
                        }
                    } else {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('show');
                            btnSkipIntro.classList.add('hidden');
                        }
                    }
                }

                // Next Episode trigger for TV series
                if (MEDIA_TYPE === 'tv' && duration > 120 && (duration - current) <= 120) {
                    if (btnNextEpisode) {
                        btnNextEpisode.classList.remove('hidden');
                        btnNextEpisode.classList.add('show');
                    }
                } else {
                    if (btnNextEpisode) {
                        btnNextEpisode.classList.remove('show');
                        btnNextEpisode.classList.add('hidden');
                    }
                }

                // Hotstar-style "More Like This" & Next Movie Drawer trigger near movie end (remaining <= 25 seconds)
                if (MEDIA_TYPE !== 'tv' && duration > 300 && (duration - current) <= 25 && current > 0) {
                    if (typeof showHotstarEndDrawer === 'function') {
                        showHotstarEndDrawer();
                    }
                }

                // Save playback progress to localStorage (throttle to once every 4 seconds)
                if (current > 10 && duration > 60) {
                    const nowTs = Date.now();
                    if (!window._lastProgressSaveTs || (nowTs - window._lastProgressSaveTs) > 4000) {
                        window._lastProgressSaveTs = nowTs;
                        try {
                            const resumeKey = `bingr_resume_${MEDIA_TYPE}_${MEDIA_ID}`;
                            const resumeData = {
                                time: Math.floor(current),
                                duration: Math.floor(duration),
                                srv: CURRENT_SERVER,
                                title: MEDIA_TITLE,
                                timestamp: nowTs
                            };
                            localStorage.setItem(resumeKey, JSON.stringify(resumeData));
                        } catch(e) {}
                    }
                }

                // High-precision custom subtitle overlay update
                updateSubtitleOverlay();
            });

            mainVideo.addEventListener('seeked', () => {
                updateSubtitleOverlay();
            });

            mainVideo.addEventListener('ended', () => {
                // Clear saved progress on completion so user starts fresh next time
                try {
                    const resumeKey = `bingr_resume_${MEDIA_TYPE}_${MEDIA_ID}`;
                    localStorage.removeItem(resumeKey);
                } catch(e) {}

                if (MEDIA_TYPE === 'tv') {
                    showToast('Episode finished! Auto-playing next episode...');
                    setTimeout(() => {
                        playNextEpisode();
                    }, 1200);
                } else {
                    if (typeof showHotstarEndDrawer === 'function') {
                        showHotstarEndDrawer();
                    } else {
                        const firstRec = window.recommendations && window.recommendations.length > 0 ? window.recommendations[0] : null;
                        if (firstRec) {
                            showToast('Movie finished! Auto-playing recommended movie...');
                            setTimeout(() => {
                                switchMovie(firstRec.id, firstRec.media_type || 'movie', firstRec.title || firstRec.name);
                            }, 5000);
                        }
                    }
                }
            });

            mainVideo.addEventListener('loadedmetadata', () => {
                if (!validatePlayingStreamDuration()) return;
                syncDurationDisplay();
                updateTimelineAniSkipMarkers();
            });

            mainVideo.addEventListener('durationchange', () => {
                if (!validatePlayingStreamDuration()) return;
                syncDurationDisplay();
                updateTimelineAniSkipMarkers();
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
                    if (timelineContainer) timelineContainer.classList.remove('is-scrubbing');
                }
            });
        }

        function seekWithEvent(e) {
            if (!timelineContainer) return;
            const rect = timelineContainer.getBoundingClientRect();
            if (!rect || !rect.width) return;
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const duration = getEffectiveDuration();
            const targetTime = pos * duration;

            if (window.bingrActiveStreamUrl && (window.bingrActiveStreamUrl.includes('/api/transcode/mkv') || window.bingrActiveStreamUrl.includes('transcode_mkv.php'))) {
                let baseUrl = window.bingrActiveStreamUrl || '';
                if (baseUrl.includes('&ss=')) {
                    baseUrl = baseUrl.replace(/&ss=[\d\.]+/, '');
                } else if (baseUrl.includes('?ss=')) {
                    baseUrl = baseUrl.replace(/\?ss=[\d\.]+&?/, '?');
                }
                const sep = baseUrl.includes('?') ? '&' : '?';
                const newUrl = baseUrl + `${sep}ss=${Math.floor(targetTime)}`;
                window.bingrSeekOffset = Math.floor(targetTime);
                window.bingrActiveStreamUrl = newUrl;
                previousVideoTime = 0;
                initHlsPlayer(newUrl);
            } else if (mainVideo && duration > 0) {
                mainVideo.currentTime = targetTime;
            }

            if (timelineProgress) timelineProgress.style.width = (pos * 100) + '%';
            if (timelineThumb) timelineThumb.style.left = (pos * 100) + '%';
            if (timeCurrent) timeCurrent.textContent = formatTime(targetTime);
            const timeCurrentMob = document.getElementById('timeCurrentMob');
            if (timeCurrentMob) timeCurrentMob.textContent = formatTime(targetTime);
        }

        function updateTimelineTooltip(e) {
            if (!timelineContainer || !timelineTooltip) return;
            const rect = timelineContainer.getBoundingClientRect();
            if (!rect || !rect.width) return;
            if (e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20 && e.clientX >= rect.left && e.clientX <= rect.right) {
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const duration = getEffectiveDuration();
                const targetTime = pos * duration;
                timelineTooltip.textContent = formatTime(targetTime);
                timelineTooltip.style.left = (pos * 100) + '%';
                timelineTooltip.style.opacity = '1';
            } else {
                timelineTooltip.style.opacity = '0';
            }
        }

        function skipIntro() {
            if (!mainVideo) return;
            if (activeAniSkipSegment && activeAniSkipSegment.interval) {
                const targetTime = Math.min(mainVideo.duration || 0, activeAniSkipSegment.interval.endTime + 0.5);
                mainVideo.currentTime = targetTime;
                showToast('Skipped ' + getSkipTypeName(activeAniSkipSegment.skipType));
            } else {
                mainVideo.currentTime = Math.min(mainVideo.duration || 0, (mainVideo.currentTime || 0) + 85);
                showToast('Skipped Intro (+85s)');
            }
            if (btnSkipIntro) {
                btnSkipIntro.classList.remove('show');
                btnSkipIntro.classList.add('hidden');
            }
        }

        function playNextEpisode() {
            const nextEp = MEDIA_EPISODE + 1;
            switchEpisode(MEDIA_SEASON, nextEp);
        }

        function formatTime(sec) {
            if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) {
                return h + ':' + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
            }
            return m + ':' + s.toString().padStart(2, '0');
        }

        let isUserTouching = false;

        function setupControlsAutoHide() {
            window.addEventListener('mousemove', () => resetControlsTimer());
            window.addEventListener('touchstart', (e) => {
                isUserTouching = true;
                clearTimeout(controlsTimeout);
                if (typeof isInteractiveControl === 'function' && isInteractiveControl(e.target)) {
                    showControls(true);
                    resetControlsTimer(4500);
                }
            }, { passive: true });
            window.addEventListener('touchmove', () => {
                isUserTouching = true;
                clearTimeout(controlsTimeout);
            }, { passive: true });
            window.addEventListener('touchend', (e) => {
                isUserTouching = false;
                if (typeof isInteractiveControl === 'function' && isInteractiveControl(e.target)) {
                    resetControlsTimer(4500);
                }
            }, { passive: true });
            window.addEventListener('touchcancel', () => {
                isUserTouching = false;
                resetControlsTimer(4500);
            }, { passive: true });
            window.addEventListener('click', () => resetControlsTimer());
            resetControlsTimer();
        }

        function resetControlsTimer(delay = 3500) {
            showControls(true);
            clearTimeout(controlsTimeout);
            if (isUserTouching) return; // Keep controls visible while user is actively touching
            const shouldAutoHide = playerMode === 'embed' || (mainVideo && !mainVideo.paused);
            if (shouldAutoHide) {
                controlsTimeout = setTimeout(() => {
                    if (!isUserTouching) {
                        showControls(false);
                    }
                }, delay);
            }
        }

        function showControls(show) {
            const isModalOpen = (qualityServerModal && !qualityServerModal.classList.contains('hidden')) || 
                                (subtitlesModal && !subtitlesModal.classList.contains('hidden')) || 
                                (aniSkipModal && !aniSkipModal.classList.contains('hidden')) ||
                                (moreLikeThisTray && !moreLikeThisTray.classList.contains('translate-y-full')) ||
                                (episodesDrawer && !episodesDrawer.classList.contains('translate-y-full')) ||
                                (sleepModal && !sleepModal.classList.contains('hidden'));
            const embedTouchSensor = document.getElementById('embedTouchSensor');
            const isPaused = mainVideo ? mainVideo.paused : false;
            
            if (show || isUserTouching || isModalOpen || (playerMode !== 'embed' && isPaused)) {
                if (topControlsBar) topControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                if (bottomControlsBar) bottomControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'default';
                if (embedTouchSensor) embedTouchSensor.classList.add('hidden');
            } else {
                if (topControlsBar) topControlsBar.classList.add('opacity-0', 'pointer-events-none');
                if (bottomControlsBar) bottomControlsBar.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'none';
                if (playerMode === 'embed' && embedTouchSensor) {
                    embedTouchSensor.classList.remove('hidden');
                }
            }
        }

        function closeAllOpenModals(closeBackdrop = true) {
            if (qualityServerModal) qualityServerModal.classList.add('hidden');
            if (subtitlesModal) subtitlesModal.classList.add('hidden');
            if (aniSkipModal) aniSkipModal.classList.add('hidden');
            if (sleepModal) sleepModal.classList.add('hidden');
            const sheet = document.getElementById('mobileMoreMenuSheet');
            if (sheet) sheet.classList.add('hidden');
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (backdrop && closeBackdrop) backdrop.classList.add('hidden');
        }

        function toggleMobileMoreMenu(force) {
            const sheet = document.getElementById('mobileMoreMenuSheet');
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (!sheet) return;
            const isHidden = sheet.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                sheet.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                sheet.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                updateMobileStatusBadges();
            }
        }

        function updateMobileStatusBadges() {
            const aspectBadge = document.getElementById('mobAspectBadge');
            if (aspectBadge) {
                const modes = ['Fit', 'Cover', 'Stretch', 'Zoom'];
                aspectBadge.textContent = modes[currentAspectMode] || 'Fit';
            }
            const rotateBadge = document.getElementById('mobRotateBadge');
            if (rotateBadge) {
                rotateBadge.textContent = currentRotation + '°';
            }
            const sleepBadge = document.getElementById('mobSleepBadge');
            if (sleepBadge) {
                sleepBadge.textContent = (sleepTimerId || sleepTimerInterval || sleepEndTime) ? 'Active' : 'Off';
            }
            const epBtn = document.getElementById('mobBtnEpisodes');
            if (epBtn) {
                if (MEDIA_TYPE === 'tv') {
                    epBtn.classList.remove('hidden');
                } else {
                    epBtn.classList.add('hidden');
                }
            }
        }

        function openInPurePlayer() {
            let activeUrl = window.bingrActiveStreamUrl || DIRECT_STREAM_URL;
            if (!activeUrl) {
                showToast('No active stream loaded to open in Pure Player');
                return;
            }
            const currentPos = mainVideo && mainVideo.currentTime ? mainVideo.currentTime : 0;
            const target = `/play.php?url=${encodeURIComponent(activeUrl)}&name=${encodeURIComponent(MEDIA_TITLE || 'Stream')}&source=${encodeURIComponent(SOURCE_ORIGIN || 'consumet.html')}`;
            window.location.href = target;
        }
        window.openInPurePlayer = openInPurePlayer;

        function toggleQualityServerModal(force) {
            const isHidden = qualityServerModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                qualityServerModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                qualityServerModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                updateServerListUI();
            }
        }

        function toggleSubtitlesModal(force) {
            const isHidden = subtitlesModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                subtitlesModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                subtitlesModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                detectAndPopulateAudioTracks();
                populateSubtitlesList();
            }
        }

        // ==========================================
        // ANISKIP TIMESTAMPS CONTROLLER (MAL ID)
        // ==========================================
        function getSkipTypeName(type) {
            if (!type) return 'Intro';
            switch (type) {
                case 'op': return 'Opening';
                case 'ed': return 'Ending';
                case 'mixed-op': return 'Mixed Opening';
                case 'mixed-ed': return 'Mixed Ending';
                case 'recap': return 'Recap';
                default: return type.toUpperCase();
            }
        }

        function toggleAniSkipModal(force) {
            if (!aniSkipModal) return;
            const isHidden = aniSkipModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                aniSkipModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                aniSkipModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                if (inputMalId && MAL_ID) inputMalId.value = MAL_ID;
            }
            if (window.lucide) lucide.createIcons();
        }

        function toggleAniSkipAuto(checked) {
            aniSkipAutoSkip = checked;
            localStorage.setItem('stalker_aniskip_autoskip', checked ? 'true' : 'false');
            showToast(`AniSkip Auto-Skip: ${checked ? 'Enabled' : 'Disabled'}`);
        }

        function seekToAniSkip(sec) {
            if (mainVideo) mainVideo.currentTime = sec;
            toggleAniSkipModal(false);
            showToast(`Seeked to ${formatTime(sec)}`);
        }

        function applyCustomMalId() {
            const val = inputMalId ? inputMalId.value.trim() : '';
            if (!val || isNaN(parseInt(val, 10))) {
                showToast('Please enter a valid numeric MAL ID');
                return;
            }
            MAL_ID = parseInt(val, 10);
            window.MAL_ID = MAL_ID;
            saveStoredMalId(MAL_ID);
            
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({}, '', url.toString());
            } catch (e) {}

            showToast(`MAL ID #${MAL_ID} Saved`);
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
        }

        function setQuickMalPreset(malId, name) {
            if (inputMalId) inputMalId.value = malId;
            MAL_ID = parseInt(malId, 10);
            window.MAL_ID = MAL_ID;
            saveStoredMalId(MAL_ID);

            try {
                const url = new URL(window.location.href);
                url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({}, '', url.toString());
            } catch (e) {}

            showToast(`Preset: ${name} (MAL #${malId})`);
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
        }

        async function autoDetectMalId(showFeedback = true) {
            const titleToSearch = MEDIA_TITLE || '';
            if (!titleToSearch || titleToSearch === 'Cinema Presentation') {
                if (showFeedback) showToast('No title available to detect MAL ID');
                return;
            }
            if (showFeedback) showToast(`Detecting MAL ID for "${titleToSearch}"...`);
            if (aniSkipStatusBadge) {
                aniSkipStatusBadge.textContent = 'Searching MAL...';
                aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold animate-pulse';
            }

            try {
                const res = await fetch(`/api/anime/mal/resolve?title=${encodeURIComponent(titleToSearch)}`);
                const data = await res.json();
                if (data && data.found && data.malId) {
                    MAL_ID = parseInt(data.malId, 10);
                    window.MAL_ID = MAL_ID;
                    saveStoredMalId(MAL_ID);
                    if (inputMalId) inputMalId.value = MAL_ID;
                    try {
                        const url = new URL(window.location.href);
                        url.searchParams.set('malId', MAL_ID);
                        window.history.replaceState({}, '', url.toString());
                    } catch (e) {}
                    if (showFeedback) showToast(`Found MAL ID #${data.malId} (${data.title || titleToSearch})`);
                    fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
                } else {
                    if (showFeedback) showToast(`Could not auto-detect MAL ID. Please enter manually.`);
                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = 'Manual Entry Needed';
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-bold';
                    }
                }
            } catch (e) {
                console.warn('Auto detect MAL failed:', e);
                if (showFeedback) showToast('Auto-detection error. Enter MAL ID directly.');
            }
        }

        async function fetchAniSkipData(malId, episode) {
            episode = parseInt(episode || MEDIA_EPISODE || 1, 10);
            aniSkipCurrentRequestEp = episode;
            const targetEp = episode;

            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = episode;
            if (aniSkipStatusBadge) {
                aniSkipStatusBadge.textContent = `Catching Ep ${episode}...`;
                aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold animate-pulse';
            }

            const epLength = Math.floor(mainVideo ? (mainVideo.duration || 0) : 0);
            const effectiveMalId = malId || MAL_ID || getStoredMalId();

            try {
                let response = null;
                // Query server skip-times proxy
                try {
                    const qParams = new URLSearchParams();
                    if (effectiveMalId) qParams.set('malId', effectiveMalId);
                    if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation') qParams.set('title', MEDIA_TITLE);
                    qParams.set('episode', episode);
                    if (epLength > 0) qParams.set('episodeLength', epLength);

                    response = await fetch(`/api/anime/skip-times?${qParams.toString()}`);
                } catch (e) {
                    console.warn('Backend skip-times proxy failed, trying public aniskip API directly', e);
                }

                if ((!response || !response.ok) && effectiveMalId) {
                    response = await fetch(`https://api.aniskip.com/v2/skip-times/${effectiveMalId}/${episode}?types=op&types=ed&episodeLength=${epLength}`);
                }

                if (!response) {
                    throw new Error('AniSkip service unreachable');
                }

                const data = await response.json();

                // If user switched to another episode while this request was running, discard stale data
                if (targetEp !== MEDIA_EPISODE) {
                    console.log(`Discarding AniSkip data for Ep ${targetEp}, current is Ep ${MEDIA_EPISODE}`);
                    return;
                }

                if (data && data.malId && !MAL_ID) {
                    MAL_ID = parseInt(data.malId, 10);
                    window.MAL_ID = MAL_ID;
                    saveStoredMalId(MAL_ID);
                    if (inputMalId) inputMalId.value = MAL_ID;
                    try {
                        const u = new URL(window.location.href);
                        u.searchParams.set('malId', MAL_ID);
                        window.history.replaceState({}, '', u.toString());
                    } catch (e) {}
                }

                // Filter strictly for pure intro ('op') and outro ('ed') - NEVER mixed-op or mixed-ed
                const filteredResults = (data && data.found && Array.isArray(data.results))
                    ? data.results.filter(r => {
                        const t = (r.skipType || '').toLowerCase().trim();
                        return t === 'op' || t === 'ed';
                    })
                    : [];

                if (filteredResults.length > 0) {
                    aniSkipResults = filteredResults;
                    lastAutoSkippedId = null; // Reset auto-skip trigger for new episode

                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = `Active: Ep ${episode} (${aniSkipResults.length} intervals)`;
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold';
                    }
                    if (aniSkipBadge) {
                        aniSkipBadge.classList.remove('hidden');
                        aniSkipBadge.textContent = aniSkipResults.map(r => r.skipType.toUpperCase()).join('/');
                    }

                    renderAniSkipSegmentsList();
                    updateTimelineAniSkipMarkers();
                    showToast(`AniSkip: Caught Ep ${episode} timestamps (${aniSkipResults.length} intervals)`);
                } else {
                    aniSkipResults = [];
                    lastAutoSkippedId = null;
                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = `No Skip Times (Ep ${episode})`;
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 font-bold';
                    }
                    if (aniSkipBadge) aniSkipBadge.classList.add('hidden');
                    if (aniSkipSegmentsList) {
                        aniSkipSegmentsList.innerHTML = `<div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No AniSkip timestamps found for Ep ${episode}${effectiveMalId ? ' (MAL #' + effectiveMalId + ')' : ''}.</div>`;
                    }
                    updateTimelineAniSkipMarkers();
                }
            } catch (err) {
                console.error('AniSkip fetch failed:', err);
                if (targetEp === MEDIA_EPISODE && aniSkipStatusBadge) {
                    aniSkipStatusBadge.textContent = 'Error';
                    aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold';
                }
            } finally {
                if (window.lucide) lucide.createIcons();
            }
        }

        function renderAniSkipSegmentsList() {
            if (!aniSkipSegmentsList) return;
            if (!aniSkipResults || aniSkipResults.length === 0) {
                aniSkipSegmentsList.innerHTML = `<div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No timestamps loaded.</div>`;
                return;
            }

            aniSkipSegmentsList.innerHTML = aniSkipResults.map((seg, idx) => {
                const type = seg.skipType;
                const start = Math.floor(seg.interval.startTime);
                const end = Math.floor(seg.interval.endTime);
                const dur = Math.max(0, end - start);
                let colorClass = 'border-amber-400/40 bg-amber-500/10 text-amber-300';
                let iconName = 'zap';

                if (type.includes('ed')) {
                    colorClass = 'border-purple-400/40 bg-purple-500/10 text-purple-300';
                    iconName = 'skip-forward';
                } else if (type === 'recap') {
                    colorClass = 'border-sky-400/40 bg-sky-500/10 text-sky-300';
                    iconName = 'fast-forward';
                }

                return `
                    <div class="p-2.5 rounded-xl border ${colorClass} flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${iconName}" class="w-4 h-4"></i>
                            <div>
                                <div class="text-xs font-extrabold capitalize">${getSkipTypeName(type)}</div>
                                <div class="text-[10px] text-zinc-400 font-mono">${formatTime(start)} &rarr; ${formatTime(end)} (${dur}s)</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="seekToAniSkip(${start})" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all cursor-pointer">
                                Jump to Start
                            </button>
                            <button onclick="seekToAniSkip(${end + 0.5})" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all cursor-pointer">
                                Jump to End
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        }

        function updateTimelineAniSkipMarkers() {
            const duration = mainVideo ? (mainVideo.duration || 0) : 0;
            if (!duration || !aniSkipResults || aniSkipResults.length === 0) {
                if (timelineOpMarker) timelineOpMarker.classList.add('hidden');
                if (timelineEdMarker) timelineEdMarker.classList.add('hidden');
                if (timelineRecapMarker) timelineRecapMarker.classList.add('hidden');
                return;
            }

            const op = aniSkipResults.find(s => (s.skipType || '').toLowerCase().trim() === 'op');
            if (op && timelineOpMarker) {
                const left = (op.interval.startTime / duration) * 100;
                const width = ((op.interval.endTime - op.interval.startTime) / duration) * 100;
                timelineOpMarker.style.left = left + '%';
                timelineOpMarker.style.width = width + '%';
                timelineOpMarker.classList.remove('hidden');
            } else if (timelineOpMarker) {
                timelineOpMarker.classList.add('hidden');
            }

            const ed = aniSkipResults.find(s => (s.skipType || '').toLowerCase().trim() === 'ed');
            if (ed && timelineEdMarker) {
                const left = (ed.interval.startTime / duration) * 100;
                const width = ((ed.interval.endTime - ed.interval.startTime) / duration) * 100;
                timelineEdMarker.style.left = left + '%';
                timelineEdMarker.style.width = width + '%';
                timelineEdMarker.classList.remove('hidden');
            } else if (timelineEdMarker) {
                timelineEdMarker.classList.add('hidden');
            }

            const recap = aniSkipResults.find(s => s.skipType === 'recap');
            if (recap && timelineRecapMarker) {
                const left = (recap.interval.startTime / duration) * 100;
                const width = ((recap.interval.endTime - recap.interval.startTime) / duration) * 100;
                timelineRecapMarker.style.left = left + '%';
                timelineRecapMarker.style.width = width + '%';
                timelineRecapMarker.classList.remove('hidden');
            } else if (timelineRecapMarker) {
                timelineRecapMarker.classList.add('hidden');
            }
        }

        function initAniSkip() {
            if (chkAutoSkip) chkAutoSkip.checked = aniSkipAutoSkip;
            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = MEDIA_EPISODE;

            const effectiveMalId = MAL_ID || getStoredMalId();
            if (effectiveMalId) {
                if (inputMalId) inputMalId.value = effectiveMalId;
                fetchAniSkipData(effectiveMalId, MEDIA_EPISODE);
            } else {
                // Automatically catch AniSkip data in background on load
                fetchAniSkipData(null, MEDIA_EPISODE);
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
            if (MEDIA_TYPE !== 'tv' || !episodesDrawer) return;
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
                    safePauseVideo();
                    sleepIndicator.style.display = 'none';
                    showToast('Playback paused by Sleep Timer');
                }
            }, 1000);
        }

        let subtitleSettings = {
            fontSize: '1.15rem',
            color: '#ffffff',
            bg: 'rgba(0,0,0,0.55)',
            shadow: '1px 1px 2px black, 0 0 1em black'
        };

        function loadStoredSubtitleSettings() {
            try {
                const stored = localStorage.getItem('bingr_sub_settings');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    subtitleSettings = Object.assign(subtitleSettings, parsed);
                }
            } catch (_) {}
            applySubtitleStyles();
        }

        function applySubtitleStyles() {
            // 1. Update CSS custom properties on documentElement
            document.documentElement.style.setProperty('--sub-font-size', subtitleSettings.fontSize);
            document.documentElement.style.setProperty('--sub-color', subtitleSettings.color);
            document.documentElement.style.setProperty('--sub-bg', subtitleSettings.bg);
            document.documentElement.style.setProperty('--sub-shadow', subtitleSettings.shadow);

            // 2. Update Live Preview Box
            const preview = document.getElementById('subPreviewBox');
            if (preview) {
                preview.style.fontSize = subtitleSettings.fontSize;
                preview.style.color = subtitleSettings.color;
                preview.style.backgroundColor = subtitleSettings.bg;
                preview.style.textShadow = subtitleSettings.shadow;
            }

            // 3. Update High-Precision Custom Subtitle Overlay
            const overlayText = document.getElementById('customSubtitleText');
            if (overlayText) {
                overlayText.style.fontSize = subtitleSettings.fontSize;
                overlayText.style.color = subtitleSettings.color;
                overlayText.style.backgroundColor = subtitleSettings.bg;
                overlayText.style.textShadow = subtitleSettings.shadow;
            }

            // 4. Inject explicit ::cue rule into head to guarantee browser engine rendering
            let cueStyle = document.getElementById('dynamicCueStyle');
            if (!cueStyle) {
                cueStyle = document.createElement('style');
                cueStyle.id = 'dynamicCueStyle';
                document.head.appendChild(cueStyle);
            }
            cueStyle.textContent = `
                ::cue, video::cue {
                    font-size: ${subtitleSettings.fontSize} !important;
                    color: ${subtitleSettings.color} !important;
                    background-color: ${subtitleSettings.bg} !important;
                    text-shadow: ${subtitleSettings.shadow} !important;
                    line-height: 1.4 !important;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                    border-radius: 8px !important;
                    padding: 4px 12px !important;
                }
            `;

            try {
                localStorage.setItem('bingr_sub_settings', JSON.stringify(subtitleSettings));
            } catch (_) {}
        }

        function applyAndConfirmSubtitleStyles() {
            applySubtitleStyles();
            updateSubtitleOverlay();

            const btn = document.getElementById('btnApplySubStyles');
            const label = document.getElementById('btnApplySubStylesLabel');
            if (btn && label) {
                const originalText = label.textContent;
                btn.className = 'flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all';
                label.textContent = 'Styles Applied!';
                setTimeout(() => {
                    btn.className = 'flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all cursor-pointer';
                    label.textContent = originalText;
                }, 1800);
            }
            showToast('Subtitle styles applied successfully');
        }

        function resetSubtitleStylesToDefault() {
            subtitleSettings = {
                fontSize: '1.15rem',
                color: '#ffffff',
                bg: 'rgba(0,0,0,0.55)',
                shadow: '1px 1px 2px black, 0 0 1em black'
            };
            applySubtitleStyles();
            updateSubtitleOverlay();

            // Refresh UI button states
            document.querySelectorAll('.sub-font-btn').forEach((b, idx) => {
                b.className = idx === 1 
                    ? 'sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all'
                    : 'sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all';
            });
            document.querySelectorAll('.sub-color-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 0) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });
            document.querySelectorAll('.sub-bg-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 1) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });
            document.querySelectorAll('.sub-shadow-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 1) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });

            showToast('Subtitle styles reset to defaults');
        }

        function setSubtitleFontSize(size, btnElement) {
            subtitleSettings.fontSize = size;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-font-btn').forEach(btn => {
                    btn.className = 'sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all';
                });
                btnElement.className = 'sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all';
            }
        }

        function setSubtitleColor(color, btnElement) {
            subtitleSettings.color = color;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-color-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
        }

        function setSubtitleBg(bg, btnElement) {
            subtitleSettings.bg = bg;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-bg-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
        }

        function setSubtitleShadow(shadow, btnElement) {
            subtitleSettings.shadow = shadow;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-shadow-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
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
            updateSubtitleOverlay();
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
                        window.bingrExpectedDurationSec = data.runtime * 60;
                        const h = Math.floor(data.runtime / 60);
                        const m = data.runtime % 60;
                        document.getElementById('hudRuntime').textContent = h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
                        if (!window.bingrDuration || window.bingrDuration <= 0) {
                            window.bingrDuration = data.runtime * 60;
                            const durFmt = formatTime(window.bingrDuration);
                            if (timeDuration) timeDuration.textContent = durFmt;
                            const timeDurationMob = document.getElementById('timeDurationMob');
                            if (timeDurationMob) timeDurationMob.textContent = durFmt;
                        }
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
                const items = data.results ? data.results.slice(0, 12) : []; window.recommendations = items;

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

        /* ---------------- HOTSTAR-STYLE END SCREEN "MORE LIKE THIS" DRAWER & AUTO-NEXT ---------------- */
        let hotstarCountdownTimer = null;
        let hotstarSecondsRemaining = 10;
        let hotstarNextMovieTarget = null;

        function showHotstarEndDrawer() {
            const drawer = document.getElementById('hotstarEndDrawer');
            if (!drawer || !drawer.classList.contains('hidden')) return;

            const grid = document.getElementById('hotstarRecGrid');
            const items = window.recommendations && window.recommendations.length > 0 ? window.recommendations.slice(0, 8) : [];
            
            if (grid && items.length > 0) {
                hotstarNextMovieTarget = items[0];
                grid.innerHTML = items.map((item, idx) => {
                    const title = item.title || item.name || 'Title';
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.5';
                    const year = (item.release_date || item.first_air_date || '2024').slice(0, 4);
                    const thumb = item.backdrop_path ? 'https://image.tmdb.org/t/p/w500' + item.backdrop_path : (item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : '');
                    const isNext = idx === 0;

                    return `
                        <div onclick="switchMovie(${item.id}, '${item.media_type || 'movie'}', '${title.replace(/'/g, "\\'")}')" class="group relative cursor-pointer space-y-2 transition-all duration-300 transform hover:scale-[1.04] active:scale-95">
                            <div class="relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border ${isNext ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'border-white/10'} shadow-xl">
                                <img src="${thumb}" alt="${title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                ${isNext ? '<div class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black uppercase tracking-wider shadow">UP NEXT</div>' : ''}
                                <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md glass-panel text-amber-300 text-[10px] font-black tracking-wide border border-white/10">
                                    ★ ${rating}
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                                    <span class="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                        <i data-lucide="play" class="w-3 h-3 fill-white"></i> Play Now
                                    </span>
                                </div>
                            </div>
                            <div class="space-y-0.5 px-0.5">
                                <h4 class="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">${title}</h4>
                                <div class="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase font-semibold">
                                    <span>${year}</span>
                                    <span>&bull;</span>
                                    <span class="text-zinc-500">Recommended</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else if (grid) {
                grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-zinc-500">No additional recommendations found.</div>';
            }

            drawer.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            // Auto-countdown to next movie
            if (hotstarNextMovieTarget) {
                hotstarSecondsRemaining = 10;
                updateHotstarCountdownText();
                if (hotstarCountdownTimer) clearInterval(hotstarCountdownTimer);
                hotstarCountdownTimer = setInterval(() => {
                    hotstarSecondsRemaining--;
                    updateHotstarCountdownText();
                    if (hotstarSecondsRemaining <= 0) {
                        clearInterval(hotstarCountdownTimer);
                        hotstarCountdownTimer = null;
                        const next = hotstarNextMovieTarget;
                        if (next) {
                            switchMovie(next.id, next.media_type || 'movie', next.title || next.name);
                        }
                    }
                }, 1000);
            }
        }

        function updateHotstarCountdownText() {
            const badge = document.getElementById('hotstarCountdownBadge');
            if (!badge) return;
            if (hotstarSecondsRemaining > 0 && hotstarNextMovieTarget) {
                const nextTitle = hotstarNextMovieTarget.title || hotstarNextMovieTarget.name || 'Next Movie';
                badge.textContent = `Auto-playing "${nextTitle.slice(0, 20)}..." in ${hotstarSecondsRemaining}s`;
            } else {
                badge.textContent = 'Auto-play cancelled';
            }
        }

        function cancelHotstarCountdown() {
            if (hotstarCountdownTimer) {
                clearInterval(hotstarCountdownTimer);
                hotstarCountdownTimer = null;
            }
            const badge = document.getElementById('hotstarCountdownBadge');
            if (badge) {
                badge.textContent = 'Auto-play stopped';
                badge.className = 'px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/10 text-[10px] font-mono font-bold';
            }
            const btn = document.getElementById('btnCancelCountdown');
            if (btn) btn.classList.add('hidden');
        }

        function closeHotstarEndDrawer() {
            cancelHotstarCountdown();
            const drawer = document.getElementById('hotstarEndDrawer');
            if (drawer) drawer.classList.add('hidden');
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
                        <div onclick="switchEpisode(${seasonNum}, ${ep.episode_number})" data-season="${seasonNum}" data-episode="${ep.episode_number}" class="episode-card-item group cursor-pointer space-y-1.5 transition-all transform hover:scale-[1.03] active:scale-95">
                            <div class="episode-thumb-container relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border ${isCurrent ? 'border-red-500 ring-2 ring-red-500/50' : 'border-white/10'} shadow-lg">
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

        function highlightCurrentEpisode(season, episode) {
            const cards = document.querySelectorAll('.episode-card-item');
            cards.forEach(card => {
                const epNum = parseInt(card.dataset.episode, 10);
                const sNum = parseInt(card.dataset.season, 10);
                const thumb = card.querySelector('.episode-thumb-container');
                if (epNum === episode && sNum === season) {
                    if (thumb) {
                        thumb.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
                        thumb.classList.remove('border-white/10');
                    }
                } else {
                    if (thumb) {
                        thumb.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');
                        thumb.classList.add('border-white/10');
                    }
                }
            });
        }

        function switchEpisode(season, episode) {
            MEDIA_SEASON = parseInt(season, 10) || 1;
            MEDIA_EPISODE = parseInt(episode, 10) || 1;
            window.MEDIA_SEASON = MEDIA_SEASON;
            window.MEDIA_EPISODE = MEDIA_EPISODE;

            // 1. Update browser URL history without reloading the page
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('s', MEDIA_SEASON);
                url.searchParams.set('season', MEDIA_SEASON);
                url.searchParams.set('e', MEDIA_EPISODE);
                url.searchParams.set('episode', MEDIA_EPISODE);
                if (MAL_ID) url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({ season: MEDIA_SEASON, episode: MEDIA_EPISODE }, '', url.toString());
            } catch (e) {}

            // 2. Update UI titles and labels
            const mediaTitleEl = document.getElementById('mediaTitle');
            if (mediaTitleEl) mediaTitleEl.textContent = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE}`;
            const hudTitleEl = document.getElementById('hudMediaTitle');
            if (hudTitleEl) hudTitleEl.textContent = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE}`;
            document.title = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE} | Bingr 4K Cinema Player`;

            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = MEDIA_EPISODE;

            // 3. Clear previous episode's AniSkip / skip states
            aniSkipResults = [];
            activeAniSkipSegment = null;
            lastAutoSkippedId = null;
            updateTimelineAniSkipMarkers();
            if (aniSkipBadge) aniSkipBadge.classList.add('hidden');
            if (btnSkipIntro) {
                btnSkipIntro.classList.remove('show');
                btnSkipIntro.classList.add('hidden');
            }
            if (btnNextEpisode) {
                btnNextEpisode.classList.remove('show');
                btnNextEpisode.classList.add('hidden');
            }

            // 4. Close episodes drawer and highlight new episode
            toggleEpisodesDrawer(false);
            highlightCurrentEpisode(MEDIA_SEASON, MEDIA_EPISODE);

            showToast(`Loading S${MEDIA_SEASON} E${MEDIA_EPISODE}...`);

            // 5. AUTOMATICALLY CATCH ANISKIP IN THE BACKGROUND FOR THIS SPECIFIC EPISODE!
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);

            // 6. Play new episode stream
            if (playerMode === 'embed') {
                const provId = (embedFrame && embedFrame.dataset.provider) ? embedFrame.dataset.provider : 'vidrift';
                const prov = EMBED_PROVIDERS.find(p => p.id === provId) || EMBED_PROVIDERS[0];
                if (embedFrame && prov) {
                    embedFrame.src = prov.url(MEDIA_TYPE, MEDIA_ID, MEDIA_SEASON, MEDIA_EPISODE);
                }
            } else {
                fetchAndPlayStream(CURRENT_SERVER);
            }

            // 7. Refresh subtitles for this episode
            fetchExternalSubtitles();
        }

        function switchMovie(newId, newType, newTitle) {
            window.location.href = `/play_bingr.php?id=${newId}&tmdbId=${newId}&type=${newType}&title=${encodeURIComponent(newTitle)}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        let customEmbedUrl = '';

        function loadCustomEmbed(url, name = 'Movie 4U') {
            customEmbedUrl = url;
            switchPlayerMode('embed', 'm4u_custom', true);
        }

        const EMBED_PROVIDERS = [
            { id: 'filmu', name: 'Filmu Stream (Bingr Official)', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://embed.filmu.in/tv/${id}/${s}/${e}` : `https://embed.filmu.in/movie/${id}` },
            { id: 'vidy', name: 'Vidy (Bingr Official)', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://www.vidy.st/tv/${id}/${s}/${e}` : `https://www.vidy.st/movie/${id}` },
            { id: 'cinezo', name: 'Cinezo (Bingr Official)', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://player.cinezo.live/embed/tv/${id}/${s}/${e}` : `https://player.cinezo.live/embed/movie/${id}` },
            { id: 'vidbolt', name: 'Vidbolt (Bingr Official)', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidbolt.xyz/tv/${id}/${s}/${e}` : `https://vidbolt.xyz/movie/${id}` },
            { id: 'vidrift', name: 'Vidrift (Bingr Official)', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://embed.vidrift.in/embed/tv/${id}/${s}/${e}` : `https://embed.vidrift.in/embed/movie/${id}` },
            { id: 'vidlink_pro', name: 'VidLink Pro', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` : `https://vidlink.pro/movie/${id}?autoplay=true` },
            { id: 'm4u_custom', name: 'Movie 4U (Direct Embed)', url: () => customEmbedUrl || 'https://new1.movies4u.garden' }
        ];

        function populateEmbedProviders() {
            const grid = document.getElementById('embedProvidersGrid');
            if (!grid) return;
            
            grid.innerHTML = EMBED_PROVIDERS.map(prov => {
                const isSelected = playerMode === 'embed' && embedFrame.dataset.provider === prov.id;
                return `
                    <button onclick="switchPlayerMode('embed', '${prov.id}', true)" class="flex flex-col items-start px-3 py-2 rounded-xl border ${isSelected ? 'border-white/40 bg-zinc-900 ring-1 ring-white/20 text-white shadow-lg' : 'border-white/10 bg-black/70 hover:bg-zinc-900 text-zinc-300'} transition-all cursor-pointer">
                        <span class="text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}">${prov.name}</span>
                        <span class="text-[9px] text-zinc-500 font-medium mt-0.5">${isSelected ? 'Currently Playing' : 'Select Provider'}</span>
                    </button>
                `;
            }).join('');
        }

        function switchPlayerMode(mode, providerId = 'vidlink_pro', isManualTrigger = true, customEmbedUrl = null) {
            playerMode = mode;
            const btnDirect = document.getElementById('btnModeDirect');
            const btnEmbed = document.getElementById('btnModeEmbed');
            const btnDirectMob = document.getElementById('btnModeDirectMob');
            const btnEmbedMob = document.getElementById('btnModeEmbedMob');
            const bottomControls = document.getElementById('bottomControlsBar');
            
            if (mode === 'embed') {
                if (hlsInstance) {
                    try { hlsInstance.stopLoad(); } catch (_) {}
                }
                safePauseVideo();
                if (mainVideo) {
                    mainVideo.classList.add('hidden');
                }
                document.body.classList.add('embed-active');
                
                embedFrame.dataset.provider = providerId;
                const prov = EMBED_PROVIDERS.find(p => p.id === providerId) || EMBED_PROVIDERS[0];
                embedFrame.src = customEmbedUrl ? customEmbedUrl : prov.url(MEDIA_TYPE, MEDIA_ID, MEDIA_SEASON, MEDIA_EPISODE);
                embedFrame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                embedFrame.setAttribute('allowfullscreen', 'true');
                
                embedFrame.classList.remove('hidden');
                embedFrame.style.zIndex = '10'; // sit above mainVideo, but under controls
                embedFrame.style.transform = 'scale(1.10) translateY(-16px)';
                embedFrame.style.transformOrigin = 'center center';
                
                if (bottomControls) bottomControls.style.display = 'flex';

                const btnSwitchDirect = document.getElementById('btnSwitchToDirect');
                if (btnSwitchDirect) btnSwitchDirect.classList.remove('hidden');

                if (mediaHudOverlay) {
                    mediaHudOverlay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
                    mediaHudOverlay.classList.remove('opacity-100');
                }

                if (btnDirect) btnDirect.className = 'px-3 py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white font-bold transition-all';
                if (btnEmbed) btnEmbed.className = 'px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white font-bold transition-all shadow-md';
                if (btnDirectMob) btnDirectMob.className = 'px-2 py-0.5 rounded text-zinc-400 hover:text-white transition-all';
                if (btnEmbedMob) btnEmbedMob.className = 'px-2 py-0.5 rounded bg-white text-black font-extrabold transition-all shadow';
                
                showToast(`Switched to Embed: ${prov.name}`);
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer(); // Ensure sensor gets initialized properly
            } else {
                embedFrame.classList.add('hidden');
                embedFrame.src = '';
                embedFrame.style.zIndex = '0';
                document.body.classList.remove('embed-active');

                const btnSwitchDirect = document.getElementById('btnSwitchToDirect');
                if (btnSwitchDirect) btnSwitchDirect.classList.add('hidden');

                if (mediaHudOverlay) {
                    mediaHudOverlay.classList.remove('hidden');
                }
                
                if (bottomControls) bottomControls.style.display = 'flex'; // restore timeline
                
                mainVideo.classList.remove('hidden');
                if (hlsInstance) {
                    try { hlsInstance.startLoad(); } catch (_) {}
                }
                if (mainVideo.src || (hlsInstance && hlsInstance.url)) {
                    safePlayVideo();
                }
                
                if (btnDirect) btnDirect.className = 'px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white font-bold transition-all shadow-md';
                if (btnEmbed) btnEmbed.className = 'px-3 py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white font-bold transition-all';
                if (btnDirectMob) btnDirectMob.className = 'px-2 py-0.5 rounded bg-white text-black font-extrabold transition-all shadow';
                if (btnEmbedMob) btnEmbedMob.className = 'px-2 py-0.5 rounded text-zinc-400 hover:text-white transition-all';
                
                showToast('Switched to Direct Native Stream');
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer();
            }
        }

        const BINGR_LOADER_QUOTES = {
            waiting: [
                "While you're waiting, we're locking onto the fastest cinema server for uninterrupted playback.",
                "Dimming the theater lights — every great story begins with a moment of anticipation.",
                "Scanning high-speed edge clusters for zero-buffer streaming.",
                "Good cinema is worth a moment — synchronizing master audio & HD video streams.",
                "Skipping congested routes to give you a pristine front-row seat."
            ],
            m3u_loaded: [
                "M3U stream loaded and locked! Just a few seconds to play — you are right here at the start.",
                "Master playlist decoded! Pre-buffering crystal-clear high-definition frames...",
                "Audio and video tracks synchronized — curtains rise in just a moment.",
                "Almost there! Your cinema stream is warming up for smooth playback."
            ],
            almost_playing: [
                "M3U loaded & ready! Only a few seconds to play — you are here, enjoy the show!",
                "First frames decoded! Sit back and enjoy the presentation.",
                "Thank you for waiting — launching straight into the action now."
            ]
        };

        let _bingrQuoteTimer = null;
        let _bingrQuoteIdx = 0;
        let _bingrCurrentStage = 'waiting';
        let _bingrProgressVal = 24;

        function updateBingrLoaderStageUI(stage) {
            _bingrCurrentStage = stage || 'waiting';
            const dot1 = document.getElementById('loaderDot1');
            const dot2 = document.getElementById('loaderDot2');
            const dot3 = document.getElementById('loaderDot3');
            const label1 = document.getElementById('loaderLabel1');
            const label2 = document.getElementById('loaderLabel2');
            const label3 = document.getElementById('loaderLabel3');
            const timelineFill = document.getElementById('loaderTimelineFill');
            const bar = document.getElementById('streamLoadingProgressBar');
            const pct = document.getElementById('streamLoadingPercent');
            const hint = document.getElementById('streamLoadingStatusHint');

            const activeDotClass = 'w-6 h-6 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-all';
            const doneDotClass = 'w-6 h-6 rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center transition-all';
            const idleDotClass = 'w-6 h-6 rounded-full bg-zinc-900 border border-white/15 text-zinc-500 text-[10px] font-medium flex items-center justify-center transition-all';

            const checkSvg = '<svg class="w-3 h-3 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

            if (_bingrCurrentStage === 'waiting') {
                _bingrProgressVal = Math.max(20, Math.min(48, _bingrProgressVal));
                if (dot1) { dot1.className = activeDotClass; dot1.innerHTML = '1'; }
                if (dot2) { dot2.className = idleDotClass; dot2.innerHTML = '2'; }
                if (dot3) { dot3.className = idleDotClass; dot3.innerHTML = '3'; }
                if (label1) label1.className = 'text-[10px] font-bold tracking-wider uppercase text-white transition-all';
                if (label2) label2.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-500 transition-all';
                if (label3) label3.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-500 transition-all';
                if (timelineFill) timelineFill.style.width = '12%';
                if (hint) hint.textContent = 'Locating fastest cinema server...';
            } else if (_bingrCurrentStage === 'm3u_loaded') {
                _bingrProgressVal = Math.max(65, Math.min(84, _bingrProgressVal));
                if (dot1) { dot1.className = doneDotClass; dot1.innerHTML = checkSvg; }
                if (dot2) { dot2.className = activeDotClass; dot2.innerHTML = '2'; }
                if (dot3) { dot3.className = idleDotClass; dot3.innerHTML = '3'; }
                if (label1) label1.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-400 transition-all';
                if (label2) label2.className = 'text-[10px] font-bold tracking-wider uppercase text-white transition-all';
                if (label3) label3.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-500 transition-all';
                if (timelineFill) timelineFill.style.width = '50%';
                if (hint) hint.textContent = 'M3U loaded! Few seconds to play...';
            } else {
                _bingrProgressVal = Math.max(88, Math.min(98, _bingrProgressVal));
                if (dot1) { dot1.className = doneDotClass; dot1.innerHTML = checkSvg; }
                if (dot2) { dot2.className = doneDotClass; dot2.innerHTML = checkSvg; }
                if (dot3) { dot3.className = activeDotClass + ' ring-4 ring-white/20 animate-pulse'; dot3.innerHTML = '3'; }
                if (label1) label1.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-400 transition-all';
                if (label2) label2.className = 'text-[10px] font-medium tracking-wider uppercase text-zinc-400 transition-all';
                if (label3) label3.className = 'text-[10px] font-bold tracking-wider uppercase text-white transition-all';
                if (timelineFill) timelineFill.style.width = '100%';
                if (hint) hint.textContent = 'You are here! Launching playback...';
            }

            if (bar) bar.style.width = _bingrProgressVal + '%';
            if (pct) pct.textContent = _bingrProgressVal + '%';
        }

        function rotateBingrLoaderQuote() {
            const pool = BINGR_LOADER_QUOTES[_bingrCurrentStage] || BINGR_LOADER_QUOTES.waiting;
            const quoteEl = document.getElementById('streamLoadingQuoteText');
            const bar = document.getElementById('streamLoadingProgressBar');
            const pct = document.getElementById('streamLoadingPercent');
            if (!quoteEl || !pool.length) return;

            _bingrQuoteIdx = (_bingrQuoteIdx + 1) % pool.length;
            const quoteText = pool[_bingrQuoteIdx];

            quoteEl.style.opacity = '0';
            setTimeout(() => {
                quoteEl.textContent = typeof quoteText === 'string' ? quoteText : (quoteText.text || '');
                quoteEl.style.opacity = '1';
            }, 180);

            // Gently advance progress bar so user sees continuous life
            const cap = _bingrCurrentStage === 'waiting' ? 60 : (_bingrCurrentStage === 'm3u_loaded' ? 88 : 98);
            if (_bingrProgressVal < cap) {
                _bingrProgressVal = Math.min(cap, _bingrProgressVal + Math.floor(Math.random() * 5) + 2);
                if (bar) bar.style.width = _bingrProgressVal + '%';
                if (pct) pct.textContent = _bingrProgressVal + '%';
            }
        }

        function showLoading(show, msg, sub, stage) {
            if (msg && streamLoadingMsg) streamLoadingMsg.textContent = msg;
            const subEl = document.getElementById('streamLoadingSub');
            if (sub && subEl) subEl.textContent = sub;

            if (show) {
                const inferredStage = stage || (msg && (msg.toLowerCase().includes('m3u') || msg.toLowerCase().includes('few seconds')) ? 'm3u_loaded' : 'waiting');
                const stageChanged = inferredStage !== _bingrCurrentStage;
                updateBingrLoaderStageUI(inferredStage);

                if (stageChanged || !_bingrQuoteTimer) {
                    const pool = BINGR_LOADER_QUOTES[_bingrCurrentStage] || BINGR_LOADER_QUOTES.waiting;
                    _bingrQuoteIdx = Math.floor(Math.random() * pool.length);
                    const quoteEl = document.getElementById('streamLoadingQuoteText');
                    const quoteText = pool[_bingrQuoteIdx];
                    if (quoteEl && quoteText) quoteEl.textContent = typeof quoteText === 'string' ? quoteText : (quoteText.text || '');
                }

                if (!_bingrQuoteTimer) {
                    _bingrQuoteTimer = setInterval(rotateBingrLoaderQuote, 2800);
                }

                streamLoading.classList.remove('hidden');
                requestAnimationFrame(() => {
                    streamLoading.classList.remove('opacity-0');
                });
            } else {
                if (_bingrQuoteTimer) {
                    clearInterval(_bingrQuoteTimer);
                    _bingrQuoteTimer = null;
                }
                _bingrProgressVal = 24;
                streamLoading.classList.add('opacity-0');
                setTimeout(() => streamLoading.classList.add('hidden'), 250);
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

        function updateFullscreenIcons(isFullscreen) {
            const iconIds = ['fullscreenIcon', 'fullscreenIconMob', 'fullscreenTopIcon', 'fullscreenTopIconMob'];
            const iconName = isFullscreen ? 'minimize' : 'maximize';
            iconIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('data-lucide', iconName);
            });
            if (window.lucide) lucide.createIcons();
        }

        function handleFullscreenChange() {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            const container = document.getElementById('playerContainer') || document.documentElement;
            if (isFs) {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
                document.body.classList.add('is-fullscreen');
                if (container) container.classList.add('fullscreen-active');
                updateFullscreenIcons(true);
            } else {
                if (screen.orientation && screen.orientation.unlock) {
                    try { screen.orientation.unlock(); } catch (_) {}
                }
                document.body.classList.remove('is-fullscreen');
                if (container) container.classList.remove('fullscreen-active');
                updateFullscreenIcons(false);
            }
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        function toggleFullscreen(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            const container = document.getElementById('playerContainer') || document.documentElement;
            const video = document.getElementById('mainVideo');
            
            const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

            if (!isFullscreen) {
                const req = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
                if (req) {
                    try {
                        const p = req.call(container);
                        if (p && typeof p.then === 'function') {
                            p.then(() => {
                                if (screen.orientation && screen.orientation.lock) {
                                    screen.orientation.lock('landscape').catch(() => {});
                                }
                            }).catch(() => {});
                        } else if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape').catch(() => {});
                        }
                    } catch (err) {
                        if (video && video.webkitEnterFullscreen) {
                            video.webkitEnterFullscreen();
                        }
                    }
                } else if (video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
                document.body.classList.add('is-fullscreen');
                container.classList.add('fullscreen-active');
                updateFullscreenIcons(true);
                showToast('Fullscreen Cinema Mode (Landscape)');
            } else {
                const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
                if (exit) {
                    try { exit.call(document); } catch (_) {}
                }
                if (screen.orientation && screen.orientation.unlock) {
                    try { screen.orientation.unlock(); } catch (_) {}
                }
                document.body.classList.remove('is-fullscreen');
                container.classList.remove('fullscreen-active');
                updateFullscreenIcons(false);
                showToast('Exited Fullscreen');
            }
        }

        /* ---------------- ADVANCED MOBILE TOUCH GESTURES ---------------- */
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastTapTime = 0;
        let lastTapX = 0;
        let isTouching = false;
        let isSwipeGesture = false;
        let swipeMode = null;
        let currentBrightness = 1.0;
        let initialSwipeVal = 0;
        let singleTapTimeout = null;
        let controlsWereHiddenOnTouchStart = false;

        const playerContainerEl = document.getElementById('playerContainer');
        const swipeHudEl = document.getElementById('swipeHud');
        const swipeHudIconEl = document.getElementById('swipeHudIcon');
        const swipeHudBarEl = document.getElementById('swipeHudBar');
        const swipeHudPercentEl = document.getElementById('swipeHudPercent');
        const seekRippleLeftEl = document.getElementById('seekRippleLeft');
        const seekRippleRightEl = document.getElementById('seekRippleRight');

        function triggerRipple(side) {
            const el = side === 'left' ? seekRippleLeftEl : seekRippleRightEl;
            if (!el) return;
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
            setTimeout(() => {
                el.classList.remove('opacity-100');
                el.classList.add('opacity-0');
            }, 600);
        }

        function showSwipeHud(icon, percent, color = 'bg-red-500') {
            if (!swipeHudEl) return;
            if (swipeHudIconEl) swipeHudIconEl.setAttribute('data-lucide', icon);
            if (swipeHudBarEl) {
                swipeHudBarEl.style.width = Math.min(100, Math.max(0, percent)) + '%';
                swipeHudBarEl.className = 'h-full rounded-full transition-all duration-75 ' + color;
            }
            if (swipeHudPercentEl) swipeHudPercentEl.textContent = Math.round(percent) + '%';
            if (window.lucide) lucide.createIcons();

            swipeHudEl.classList.remove('opacity-0');
            swipeHudEl.classList.add('opacity-100');
        }

        function hideSwipeHud() {
            if (!swipeHudEl) return;
            setTimeout(() => {
                swipeHudEl.classList.remove('opacity-100');
                swipeHudEl.classList.add('opacity-0');
            }, 500);
        }

        /* ---------------- ADVANCED FINGER PINCH ZOOM & TOUCH PLAY/STOP ---------------- */
        let isPinching = false;
        let pinchStartDistance = 0;
        let initialZoomScale = 1.0;
        let currentZoomScale = 1.0;
        let zoomPanX = 0;
        let zoomPanY = 0;
        let panStartX = 0;
        let panStartY = 0;

        function applyVideoZoom() {
            if (!mainVideo) return;
            if (currentZoomScale <= 1.02) {
                currentZoomScale = 1.0;
                zoomPanX = 0;
                zoomPanY = 0;
                mainVideo.style.transform = '';
                mainVideo.style.transformOrigin = 'center center';
            } else {
                mainVideo.style.transformOrigin = 'center center';
                mainVideo.style.transform = `scale(${currentZoomScale}) translate(${zoomPanX / currentZoomScale}px, ${zoomPanY / currentZoomScale}px)`;
            }
        }

        function showZoomToast(text) {
            const ind = document.getElementById('zoom-indicator');
            if (!ind) return;
            ind.textContent = text;
            ind.style.opacity = '1';
            ind.style.transform = 'translateX(-50%) translateY(12px)';
            clearTimeout(ind._ztimer);
            ind._ztimer = setTimeout(() => {
                ind.style.opacity = '0';
                ind.style.transform = 'translateX(-50%) translateY(0)';
            }, 1200);
        }

        function isInteractiveControl(el) {
            if (!el) return false;
            return !!el.closest('#topControlsBar, #bottomControlsBar, button, .ott-btn, .glass-btn, .mobile-controls-cluster, .desktop-controls-cluster, .timeline-container, .glass-panel, input, select, #mobileMoreModal, #qualityServerModal, #subtitlesModal, #sleepModal, #episodesDrawer, #partyModal, #serverPillsModal, #audioDubsModal, [role="button"], a');
        }

        if (playerContainerEl) {
            playerContainerEl.addEventListener('touchstart', (e) => {
                if (isInteractiveControl(e.target)) {
                    isTouching = false;
                    clearTimeout(singleTapTimeout);
                    return;
                }
                controlsWereHiddenOnTouchStart = !bottomControlsBar || bottomControlsBar.classList.contains('opacity-0');

                // Two-finger Pinch Zoom In / Out
                if (e.touches.length === 2) {
                    isPinching = true;
                    isTouching = false;
                    isSwipeGesture = false;
                    pinchStartDistance = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    initialZoomScale = currentZoomScale;
                    return;
                }

                if (e.touches.length !== 1) return;
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
                isTouching = true;
                isSwipeGesture = false;
                swipeMode = null;

                if (currentZoomScale > 1.05) {
                    panStartX = touch.clientX - zoomPanX;
                    panStartY = touch.clientY - zoomPanY;
                }

                const rect = playerContainerEl.getBoundingClientRect();
                const relativeX = touchStartX - rect.left;
                if (relativeX < rect.width * 0.45) {
                    swipeMode = 'brightness';
                    initialSwipeVal = currentBrightness;
                } else if (relativeX > rect.width * 0.55) {
                    swipeMode = 'volume';
                    initialSwipeVal = mainVideo ? mainVideo.volume : 1;
                }
            }, { passive: false });

            playerContainerEl.addEventListener('touchmove', (e) => {
                // Two-finger pinch-to-zoom scaling
                if (isPinching && e.touches.length === 2) {
                    const curDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    if (pinchStartDistance > 0) {
                        const factor = curDist / pinchStartDistance;
                        currentZoomScale = Math.max(1.0, Math.min(4.5, Math.round(initialZoomScale * factor * 100) / 100));
                        applyVideoZoom();
                        showZoomToast(`🔍 Zoom: ${Math.round(currentZoomScale * 100)}%`);
                    }
                    if (e.cancelable) e.preventDefault();
                    return;
                }

                if (!isTouching || e.touches.length !== 1) return;
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;

                // When zoomed in, allow dragging / panning the video
                if (currentZoomScale > 1.05 && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                    zoomPanX = touch.clientX - panStartX;
                    zoomPanY = touch.clientY - panStartY;
                    applyVideoZoom();
                    return;
                }

                if (Math.abs(deltaY) > 15 && Math.abs(deltaY) > Math.abs(deltaX)) {
                    isSwipeGesture = true;
                    const rect = playerContainerEl.getBoundingClientRect();
                    const travel = -deltaY / (rect.height * 0.5);

                    if (swipeMode === 'brightness') {
                        currentBrightness = Math.max(0.3, Math.min(1.8, initialSwipeVal + travel));
                        if (mainVideo) mainVideo.style.filter = `brightness(${currentBrightness})`;
                        const pct = Math.round(((currentBrightness - 0.3) / 1.5) * 100);
                        showSwipeHud('sun', pct, 'bg-amber-400');
                    } else if (swipeMode === 'volume') {
                        const newVol = Math.max(0, Math.min(1, initialSwipeVal + travel));
                        if (mainVideo) {
                            mainVideo.volume = newVol;
                            mainVideo.muted = false;
                        }
                        updateVolumeIcon();
                        const icon = newVol === 0 ? 'volume-x' : (newVol < 0.5 ? 'volume-1' : 'volume-2');
                        showSwipeHud(icon, newVol * 100, 'bg-emerald-500');
                    }
                }
            }, { passive: false });

            playerContainerEl.addEventListener('touchend', (e) => {
                if (isInteractiveControl(e.target)) {
                    isTouching = false;
                    clearTimeout(singleTapTimeout);
                    return;
                }
                if (isPinching) {
                    if (e.touches.length < 2) {
                        isPinching = false;
                        if (currentZoomScale <= 1.05) {
                            currentZoomScale = 1.0;
                            applyVideoZoom();
                            showZoomToast('Fit to Screen (100%)');
                        }
                    }
                    return;
                }

                if (!isTouching) return;
                isTouching = false;

                if (isSwipeGesture) {
                    hideSwipeHud();
                    return;
                }

                const touchDuration = Date.now() - touchStartTime;
                const touch = e.changedTouches[0];
                if (!touch) return;
                const deltaX = Math.abs(touch.clientX - touchStartX);
                const deltaY = Math.abs(touch.clientY - touchStartY);

                if (touchDuration < 320 && deltaX < 15 && deltaY < 15) {
                    lastTouchEndTime = Date.now();
                    const now = Date.now();
                    const rect = playerContainerEl.getBoundingClientRect();
                    const clickX = touch.clientX - rect.left;
                    const widthFraction = clickX / rect.width;

                    // Double-tap handler
                    if (now - lastTapTime < 320 && Math.abs(clickX - lastTapX) < 90) {
                        clearTimeout(singleTapTimeout);
                        lastTapTime = 0;

                        if (currentZoomScale > 1.05) {
                            // Double-tap resets finger zoom
                            currentZoomScale = 1.0;
                            applyVideoZoom();
                            showZoomToast('Zoom Reset: 100%');
                        } else if (widthFraction < 0.35) {
                            seekRelative(-10);
                            triggerRipple('left');
                        } else if (widthFraction > 0.65) {
                            seekRelative(10);
                            triggerRipple('right');
                        } else {
                            toggleAspectRatio();
                            updateMobileStatusBadges();
                        }
                    } else {
                        // Single-tap on mobile/touch: toggle HUD controls visibility
                        lastTapTime = now;
                        lastTapX = clickX;
                        clearTimeout(singleTapTimeout);
                        singleTapTimeout = setTimeout(() => {
                            if (controlsWereHiddenOnTouchStart) {
                                showControls(true);
                                resetControlsTimer(4500);
                            } else {
                                showControls(false);
                            }
                        }, 180);
                    }
                }
            }, { passive: true });
        }

        // resolveBackUrl and handleGoBack are cleanly declared and initialized globally in document head
        const resolveBackUrl = window.resolveBackUrl;
        const handleGoBack = window.handleGoBack;

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
            
            // Determine accurate group-title
            let group = 'Bingr Media';
            if (typeof MEDIA_TYPE !== 'undefined' && (MEDIA_TYPE === 'anime' || MEDIA_TYPE === 'tv_anime')) {
                group = 'Anime';
            } else if (typeof IS_ANIME !== 'undefined' && IS_ANIME) {
                group = 'Anime';
            } else if (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'movie') {
                group = 'Movies';
            } else if (typeof MEDIA_TYPE !== 'undefined' && MEDIA_TYPE === 'tv') {
                group = 'TV Series';
            } else if (window.location.pathname.includes('anime')) {
                group = 'Anime';
            }

            let m3uContent = `#EXTM3U\n`;
            m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" group-title="${group}",${title}\n`;
            if (referer) {
                m3uContent += `#EXTVLCOPT:http-referrer=${referer}\n`;
                m3uContent += `#EXTHTTP:{"Referer":"${referer}"}\n`;
            }
            m3uContent += `${finalStreamUrl}\n`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(m3uContent).then(() => {
                    showToast('Raw M3U Playlist copied to clipboard!');
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
                showToast('Raw M3U Playlist copied to clipboard!');
            } catch(err) {
                showToast('Failed to copy M3U playlist');
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
                case 'KeyZ':
                    toggleAniSkipModal();
                    break;
                case 'Escape':
                    toggleQualityServerModal(false);
                    toggleSubtitlesModal(false);
                    toggleAniSkipModal(false);
                    toggleSleepModal(false);
                    break;
            }
        });

        window.addEventListener('popstate', (e) => {
            try {
                const url = new URL(window.location.href);
                const s = parseInt(url.searchParams.get('s') || url.searchParams.get('season') || '1', 10);
                const ep = parseInt(url.searchParams.get('e') || url.searchParams.get('episode') || '1', 10);
                if (s !== MEDIA_SEASON || ep !== MEDIA_EPISODE) {
                    switchEpisode(s, ep);
                }
            } catch (err) {}
        });

        // Mobile orientation change & resize listener
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                updateQualityButtonLabel();
                updateMobileStatusBadges();
                if (window.lucide) lucide.createIcons();
            }, 150);
        });
        window.addEventListener('resize', () => {
            updateQualityButtonLabel();
            updateMobileStatusBadges();
        });
    </script>
    <script src="/party-mode.js?v=7.0"></script>
</body>
</html>