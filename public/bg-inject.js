(async function() {
    try {
        const res = await fetch('/api/config/backgrounds');
        const config = await res.json();
        
        let targetBgObj = null;
        let useSongVideo = config.musicUseSongVideo !== false;
        window.__bgMusicUseSongVideo = useSongVideo;
        window.__bgMusicDefault = (config.music && typeof config.music === 'object') ? (config.music.url || '') : (typeof config.music === 'string' ? config.music : ''); 
        window.__bgMusicType = (config.music && typeof config.music === 'object') ? (config.music.type || 'auto') : 'auto';

        const path = window.location.pathname.toLowerCase();
        if (path.includes('hero.html') || path === '/hero') {
            targetBgObj = config.hero;
        } else if (path.includes('consumet') || path === '/cinema') {
            targetBgObj = config.consumet;
        } else if (path.includes('music')) {
            targetBgObj = null; // Handled by music.html explicitly for dynamic sync
        } else if (path.includes('index') || path === '/' || path === '/tv') {
            targetBgObj = config.index;
        }

        
        window.injectBackground = function(type, url) {
            const existingBgs = document.querySelectorAll('#quantum-bg-canvas, #canvas-container');
            const oldGlob = document.getElementById('global-admin-bg-container'); if(oldGlob) oldGlob.remove(); existingBgs.forEach(el => el.style.display = 'none');
            
            const container = document.createElement('div');
            container.id = 'global-admin-bg-container';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.zIndex = '-9999';
            container.style.overflow = 'hidden';
            container.style.pointerEvents = 'none';
            container.style.backgroundColor = '#000';

            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.inset = '0';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; 
            overlay.style.zIndex = '1';
            
            let finalType = type;
            if (type === 'auto') {
                if (isYouTube(url)) finalType = 'youtube';
                else if (url.includes('.m3u') || url.includes('.m3u8')) finalType = 'm3u';
                else if (url.match(/\.(jpeg|jpg|gif|png|webp|avif)(\?.*)?$/i) || url.includes('format_webp') || url.includes('format=webp')) finalType = 'image';
                else finalType = 'direct';
            }

            if (finalType === 'image') {
                const img = document.createElement('img');
                img.src = url;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.position = 'absolute';
                img.style.zIndex = '0';
                container.appendChild(img);
            } else if (finalType === 'youtube') {
                const ytId = extractYTId(url) || url;
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube-nocookie.com/embed/\${ytId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=\${ytId}&modestbranding=1&playsinline=1&enablejsapi=1`;
                iframe.frameBorder = '0';
                iframe.allow = 'autoplay; encrypted-media';
                iframe.style.width = '100vw';
                iframe.style.height = '56.25vw';
                iframe.style.minHeight = '100vh';
                iframe.style.minWidth = '177.77vh';
                iframe.style.position = 'absolute';
                iframe.style.top = '50%';
                iframe.style.left = '50%';
                iframe.style.transform = 'translate(-50%, -50%)';
                iframe.style.zIndex = '0';
                iframe.style.pointerEvents = 'none';
                container.appendChild(iframe);
            } else {
                // Direct MP4 or M3U8
                const video = document.createElement('video');
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'cover';
                video.style.position = 'absolute';
                video.style.zIndex = '0';
                
                if (finalType === 'm3u') {
                    if (window.Hls && window.Hls.isSupported()) {
                        const hls = new window.Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    } else {
                        // Dynamically load Hls.js
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
                        script.onload = () => {
                            if (window.Hls && window.Hls.isSupported()) {
                                const hls = new window.Hls();
                                hls.loadSource(url);
                                hls.attachMedia(video);
                            }
                        };
                        document.head.appendChild(script);
                    }
                } else {
                    video.src = url;
                }
                container.appendChild(video);
            }

            
            // --- SOUND SUPPORT (Background Audio Unmuter) ---
            const existingPrompt = document.getElementById('bgUnmutePrompt');
            if (existingPrompt) existingPrompt.remove();
            
            const prompt = document.createElement('div');
            prompt.id = 'bgUnmutePrompt';
            prompt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:8px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg><span>Tap to enable background audio</span>';
            prompt.style.position = 'fixed';
            prompt.style.bottom = '40px';
            prompt.style.left = '50%';
            prompt.style.transform = 'translateX(-50%)';
            prompt.style.zIndex = '999999';
            prompt.style.padding = '10px 20px';
            prompt.style.borderRadius = '50px';
            prompt.style.backgroundColor = 'rgba(8, 51, 68, 0.85)';
            prompt.style.border = '1px solid rgba(34, 211, 238, 0.5)';
            prompt.style.color = '#67e8f9';
            prompt.style.fontSize = '12px';
            prompt.style.fontWeight = 'bold';
            prompt.style.cursor = 'pointer';
            prompt.style.backdropFilter = 'blur(10px)';
            prompt.style.boxShadow = '0 0 30px rgba(34,211,238,0.3)';
            prompt.style.display = 'flex';
            prompt.style.alignItems = 'center';
            prompt.style.animation = 'pulse 2s infinite';
            
            // Add pulse animation if not exists
            if (!document.getElementById('bgUnmuteStyle')) {
                const style = document.createElement('style');
                style.id = 'bgUnmuteStyle';
                style.innerHTML = '@keyframes pulse { 0% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.05); } 100% { transform: translateX(-50%) scale(1); } }';
                document.head.appendChild(style);
            }

            prompt.onclick = () => {
                if (finalType === 'youtube' || (typeof type !== "undefined" && type === 'youtube')) {
                    const iframe = container.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                        iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
                    }
                } else {
                    const video = container.querySelector('video');
                    if (video) {
                        video.muted = false;
                        video.volume = 1;
                    }
                }
                prompt.style.display = 'none';
            };
            document.body.appendChild(prompt);

            // --- GLOBAL PERSISTENT MUTE/UNMUTE BUTTON ---
            if (finalType !== 'image') {
                const existingMuteBtn = document.getElementById('globalBgMuteBtn');
                if (existingMuteBtn) existingMuteBtn.remove();

                const muteBtn = document.createElement('button');
                muteBtn.id = 'globalBgMuteBtn';
                // Initially muted (since autoplay requires it)
                let isMuted = true;
                
                const getIcon = (muted) => muted ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
                
                muteBtn.innerHTML = getIcon(isMuted);
                muteBtn.title = "Toggle Background Audio";
                muteBtn.style.position = 'fixed';
                muteBtn.style.bottom = '20px';
                muteBtn.style.right = '20px';
                muteBtn.style.zIndex = '9999999';
                muteBtn.style.width = '44px';
                muteBtn.style.height = '44px';
                muteBtn.style.borderRadius = '50%';
                muteBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                muteBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                muteBtn.style.color = '#fff';
                muteBtn.style.display = 'flex';
                muteBtn.style.alignItems = 'center';
                muteBtn.style.justifyContent = 'center';
                muteBtn.style.cursor = 'pointer';
                muteBtn.style.backdropFilter = 'blur(10px)';
                muteBtn.style.transition = 'all 0.3s ease';
                muteBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                
                muteBtn.onmouseover = () => { muteBtn.style.backgroundColor = 'rgba(34, 211, 238, 0.2)'; muteBtn.style.borderColor = 'rgba(34, 211, 238, 0.5)'; muteBtn.style.color = '#22d3ee'; };
                muteBtn.onmouseout = () => { muteBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; muteBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)'; muteBtn.style.color = '#fff'; };
                
                muteBtn.onclick = () => {
                    isMuted = !isMuted;
                    muteBtn.innerHTML = getIcon(isMuted);
                    
                    // Hide the "Tap to enable" prompt if it's still there
                    const p = document.getElementById('bgUnmutePrompt');
                    if (p) p.style.display = 'none';

                    if (finalType === 'youtube' || (typeof type !== "undefined" && type === 'youtube')) {
                        const iframe = container.querySelector('iframe');
                        if (iframe && iframe.contentWindow) {
                            if (isMuted) {
                                iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                            } else {
                                iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                                iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
                            }
                        }
                    } else {
                        const video = container.querySelector('video');
                        if (video) {
                            video.muted = isMuted;
                            if (!isMuted) video.volume = 1;
                        }
                    }
                };
                document.body.appendChild(muteBtn);

                // If they click the prompt, sync this button's state
                const promptEl = document.getElementById('bgUnmutePrompt');
                if (promptEl) {
                    const originalOnClick = promptEl.onclick;
                    promptEl.onclick = (e) => {
                        if (originalOnClick) originalOnClick(e);
                        isMuted = false;
                        muteBtn.innerHTML = getIcon(isMuted);
                    };
                }
            }
            // ------------------------------------------------

            // ------------------------------------------------

            container.appendChild(overlay);
            document.body.prepend(container);
        }

        if (config.globalAudio && config.globalAudio.url && config.globalAudio.url.trim() !== '') {
            const target = config.globalAudio.target || 'global';
            let shouldPlay = false;
            const p = window.location.pathname.toLowerCase();
            if (target === 'global') shouldPlay = true;
            else if (target === 'hero' && (p.includes('hero.html') || p === '/hero')) shouldPlay = true;
            else if (target === 'music' && (p.includes('music.html') || p.includes('music'))) shouldPlay = true;
            else if (target === 'consumet' && (p.includes('consumet') || p === '/cinema')) shouldPlay = true;
            else if (target === 'index' && (p.includes('index') || p === '/' || p === '/tv')) shouldPlay = true;

            if (shouldPlay) {
                window.injectGlobalAudio(config.globalAudio.url.trim());
            }
        }

        if (targetBgObj && targetBgObj.url && targetBgObj.url.trim() !== '') {

            window.injectBackground(targetBgObj.type || 'auto', targetBgObj.url.trim());
        }

        function isYouTube(url) {
            return url.length === 11 && !url.includes('.') || url.includes('youtube.com') || url.includes('youtu.be');
        }

        function extractYTId(url) {
            if (url.length === 11 && !url.includes('.')) return url;
            const match = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
            return (match && match[1].length === 11) ? match[1] : null;
        }

    } catch (e) {
        console.error('Failed to load global background configuration:', e);
    }
})();

window.injectGlobalAudio = function(url) {
    const existing = document.getElementById('global-admin-audio-bg');
    if (existing) existing.remove();
    
    const audio = document.createElement('audio');
    audio.id = 'global-admin-audio-bg';
    audio.src = url;
    audio.autoplay = true;
    audio.loop = true;
    audio.style.display = 'none';
    
    document.body.appendChild(audio);
    
    // Autoplay policy bypass attempt (interaction listener)
    const playAudio = () => {
        audio.play().catch(e => console.warn('Autoplay blocked for global audio:', e));
        document.removeEventListener('click', playAudio);
        document.removeEventListener('keydown', playAudio);
    };
    
    audio.play().catch(e => {
        document.addEventListener('click', playAudio);
        document.addEventListener('keydown', playAudio);
    });
};
