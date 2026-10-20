/**
 * Stalker Pro - 10-Foot Couch TV Remote & Spatial D-Pad Navigation Engine
 * Optimizes the entire application for Android TV, Firestick, Apple TV, and keyboard arrow navigation.
 */
(function() {
    let isTvMode = false;
    let currentFocusedIndex = -1;
    let focusableElements = [];
    let tvModeBadge = null;

    // Detect if running on TV or user triggered D-pad
    function detectTvEnvironment() {
        const ua = (navigator.userAgent || '').toLowerCase();
        const isTvUA = ua.includes('tv') || ua.includes('smarttv') || ua.includes('android tv') ||
                       ua.includes('firetv') || ua.includes('aft') || ua.includes('apple tv') ||
                       ua.includes('tizen') || ua.includes('web0s') || ua.includes('roku') ||
                       ua.includes('crkey') || ua.includes('silk');
        if (isTvUA || localStorage.getItem('stalker_tv_mode') === 'true') {
            enableTvMode();
        }
    }

    // Dynamic style injection for high-visibility TV cursor / focus ring
    function injectTvStyles() {
        if (document.getElementById('stalker-tv-remote-styles')) return;
        const style = document.createElement('style');
        style.id = 'stalker-tv-remote-styles';
        style.textContent = `
            .tv-active-cursor {
                outline: 3.5px solid #ef4444 !important;
                outline-offset: 3px !important;
                transform: scale(1.04) !important;
                box-shadow: 0 0 25px rgba(239, 68, 68, 0.75), 0 0 10px rgba(255, 255, 255, 0.5) !important;
                transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), outline-color 0.15s ease, box-shadow 0.15s ease !important;
                z-index: 9999 !important;
                position: relative !important;
            }
            .tv-mode-badge {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 100000;
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(239, 68, 68, 0.4);
                backdrop-filter: blur(12px);
                color: #fff;
                padding: 6px 14px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.05em;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.5);
                user-select: none;
                cursor: pointer;
            }
            .tv-mode-badge:hover {
                background: #ef4444;
            }
        `;
        document.head.appendChild(style);
    }

    function scanFocusables() {
        const selector = [
            'button:not([disabled]):not([aria-hidden="true"])',
            'a[href]:not([aria-hidden="true"])',
            'input:not([disabled])',
            '.channel-card',
            '.tv-focusable',
            '.plyr__control',
            '[role="button"]'
        ].join(',');

        const nodes = Array.from(document.querySelectorAll(selector));
        // Filter out hidden elements
        focusableElements = nodes.filter(el => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            if (!rect) return false;
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 &&
                   style.visibility !== 'hidden' &&
                   style.display !== 'none' &&
                   style.opacity !== '0' &&
                   !el.closest('.hidden');
        });
    }

    function setFocus(index) {
        if (!focusableElements.length) scanFocusables();
        if (index < 0) index = 0;
        if (index >= focusableElements.length) index = focusableElements.length - 1;

        // Remove previous cursor
        if (currentFocusedIndex >= 0 && focusableElements[currentFocusedIndex]) {
            focusableElements[currentFocusedIndex].classList.remove('tv-active-cursor');
        }

        currentFocusedIndex = index;
        const target = focusableElements[currentFocusedIndex];
        if (target) {
            target.classList.add('tv-active-cursor');
            target.focus({ preventScroll: true });
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    // Directional spatial navigation
    function moveSpatial(direction) {
        scanFocusables();
        if (!focusableElements.length) return;

        if (currentFocusedIndex < 0 || !focusableElements[currentFocusedIndex]) {
            setFocus(0);
            return;
        }

        const currentEl = focusableElements[currentFocusedIndex];
        const curRect = currentEl.getBoundingClientRect();
        const curCenter = {
            x: curRect.left + curRect.width / 2,
            y: curRect.top + curRect.height / 2
        };

        let bestIndex = -1;
        let bestDistance = Infinity;

        focusableElements.forEach((el, idx) => {
            if (idx === currentFocusedIndex) return;
            const r = el.getBoundingClientRect();
            const center = {
                x: r.left + r.width / 2,
                y: r.top + r.height / 2
            };

            const dx = center.x - curCenter.x;
            const dy = center.y - curCenter.y;

            let inDirection = false;
            let primaryDist = 0;
            let secondaryDist = 0;

            if (direction === 'up' && dy < -10) {
                inDirection = true;
                primaryDist = Math.abs(dy);
                secondaryDist = Math.abs(dx);
            } else if (direction === 'down' && dy > 10) {
                inDirection = true;
                primaryDist = Math.abs(dy);
                secondaryDist = Math.abs(dx);
            } else if (direction === 'left' && dx < -10) {
                inDirection = true;
                primaryDist = Math.abs(dx);
                secondaryDist = Math.abs(dy);
            } else if (direction === 'right' && dx > 10) {
                inDirection = true;
                primaryDist = Math.abs(dx);
                secondaryDist = Math.abs(dy);
            }

            if (inDirection) {
                // Weight distance heavily towards the primary vector
                const weight = primaryDist * 1.0 + secondaryDist * 2.5;
                if (weight < bestDistance) {
                    bestDistance = weight;
                    bestIndex = idx;
                }
            }
        });

        if (bestIndex !== -1) {
            setFocus(bestIndex);
        } else {
            // Edge fallback wrap
            if (direction === 'right' && currentFocusedIndex < focusableElements.length - 1) {
                setFocus(currentFocusedIndex + 1);
            } else if (direction === 'left' && currentFocusedIndex > 0) {
                setFocus(currentFocusedIndex - 1);
            }
        }
    }

    function enableTvMode() {
        if (isTvMode) return;
        isTvMode = true;
        localStorage.setItem('stalker_tv_mode', 'true');
        injectTvStyles();
        scanFocusables();
        if (!tvModeBadge) {
            tvModeBadge = document.createElement('div');
            tvModeBadge.className = 'tv-mode-badge';
            tvModeBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> 📺 TV D-PAD MODE`;
            tvModeBadge.title = "Click to toggle TV Remote Navigation";
            tvModeBadge.onclick = toggleTvMode;
            document.body.appendChild(tvModeBadge);
        }
        tvModeBadge.style.display = 'flex';
        setFocus(0);
        console.log('[TV Remote] 10-Foot Couch TV Remote navigation enabled.');
    }

    function disableTvMode() {
        isTvMode = false;
        localStorage.setItem('stalker_tv_mode', 'false');
        if (currentFocusedIndex >= 0 && focusableElements[currentFocusedIndex]) {
            focusableElements[currentFocusedIndex].classList.remove('tv-active-cursor');
        }
        if (tvModeBadge) tvModeBadge.style.display = 'none';
        console.log('[TV Remote] TV Remote navigation disabled.');
    }

    function toggleTvMode() {
        if (isTvMode) disableTvMode();
        else enableTvMode();
    }

    // Keydown listener for standard TV remote codes
    window.addEventListener('keydown', (e) => {
        // Automatically activate TV mode if Arrow keys or remote control keys are used
        if (!isTvMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            enableTvMode();
        }

        if (!isTvMode) return;

        // Skip default arrow navigation if currently typing in an input
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && !['Escape', 'Enter'].includes(e.key)) {
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                moveSpatial('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveSpatial('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moveSpatial('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveSpatial('right');
                break;
            case 'Enter':
            case 'Select':
            case 'Ok':
                if (currentFocusedIndex >= 0 && focusableElements[currentFocusedIndex]) {
                    e.preventDefault();
                    focusableElements[currentFocusedIndex].click();
                }
                break;
            case 'Escape':
            case 'Back':
            case 'GoBack':
                // Check if any open modal exists and close it
                const openModal = document.querySelector('.modal:not(.hidden), [id$="Modal"]:not(.hidden)');
                if (openModal) {
                    e.preventDefault();
                    openModal.classList.add('hidden');
                } else if (window.location.pathname.includes('play')) {
                    e.preventDefault();
                    window.history.back();
                }
                break;
            case 'MediaPlayPause':
                const vid = document.querySelector('video');
                if (vid) {
                    e.preventDefault();
                    if (vid.paused) vid.play();
                    else vid.pause();
                }
                break;
            case 'MediaFastForward':
                const vidFf = document.querySelector('video');
                if (vidFf) {
                    e.preventDefault();
                    vidFf.currentTime += 10;
                }
                break;
            case 'MediaRewind':
                const vidRw = document.querySelector('video');
                if (vidRw) {
                    e.preventDefault();
                    vidRw.currentTime -= 10;
                }
                break;
        }
    });

    // Expose global controller
    window.StalkerTV = {
        enable: enableTvMode,
        disable: disableTvMode,
        toggle: toggleTvMode,
        rescan: scanFocusables,
        setFocus: setFocus
    };

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', detectTvEnvironment);
    } else {
        detectTvEnvironment();
    }
})();
