(async function() {
    try {
        const pageName = window.location.pathname.replace('/', '').replace('.html', '').replace('.php', '') || 'hero';
        const res = await fetch('/api/config/backgrounds');
        const data = await res.json();
        
        let targetBg = null;
        if (pageName.includes('hero')) targetBg = data.hero;
        else if (pageName.includes('consumet')) targetBg = data.consumet;
        else if (pageName.includes('music')) targetBg = data.music;
        else if (pageName.includes('index')) targetBg = data.index;
        
        if (targetBg && targetBg.url) {
            const container = document.createElement('div');
            container.id = 'global-admin-bg-container';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.zIndex = '-9999';
            container.style.pointerEvents = 'none';
            container.style.overflow = 'hidden';
            
            if (targetBg.type === 'youtube') {
                container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/${targetBg.url}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${targetBg.url}&modestbranding=1&playsinline=1&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" style="min-width: 100vw; min-height: 100vh; transform: scale(1.2); pointer-events: none;"></iframe>`;
            } else if (targetBg.type === 'image') {
                container.innerHTML = `<img src="${targetBg.url}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />`;
            } else if (targetBg.type === 'video') {
                container.innerHTML = `<video src="${targetBg.url}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;"></video>`;
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
                if ((typeof targetBg !== 'undefined' && targetBg.type === 'youtube') || (typeof type !== "undefined" && type === 'youtube')) {
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

            document.body.appendChild(container);
            
            // Allow music page to override
            window.injectBackground = function(type, url) {
                if (type === 'youtube') {
                    container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/${url}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${url}&modestbranding=1&playsinline=1&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" style="min-width: 100vw; min-height: 100vh; transform: scale(1.2); pointer-events: none;"></iframe>`;
                } else if (type === 'image') {
                    container.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />`;
                } else if (type === 'video') {
                    container.innerHTML = `<video src="${url}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;"></video>`;
                }
                container.style.display = 'block';
            };
        }
    } catch(e) {
        console.error("Background injector error:", e);
    }
})();
