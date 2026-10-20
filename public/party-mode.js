// Watch Together (Party Mode) Client Engine for Stalker Pro & Aetheris
(function() {
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderBubbleHtml(msg, myName) {
        if (!msg) return '';
        if (msg.sender === 'System') {
            return `<div style="display: flex; justify-content: center; margin: 6px 0; width: 100%;">
                <span style="display: inline-block; font-size: 11px; color: #94a3b8; font-style: italic; background: rgba(255,255,255,0.07); padding: 3px 10px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.1); max-width: 90%; text-align: center; word-break: break-word; overflow-wrap: anywhere;">${escapeHtml(msg.text)}</span>
            </div>`;
        }
        const isMe = (msg.sender && myName && msg.sender.trim().toLowerCase() === myName.trim().toLowerCase());
        return `<div style="display: flex; flex-direction: column; margin-bottom: 8px; width: 100%; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; padding: 0 4px;">
                <span style="font-weight: 700; font-size: 11px; color: ${isMe ? '#fbbf24' : '#38bdf8'};">${escapeHtml(msg.sender || 'Friend')}</span>
                <span style="font-size: 9px; color: #64748b;">${escapeHtml(msg.time || '')}</span>
            </div>
            <div style="display: inline-block; background: ${isMe ? '#d97706' : '#1e293b'}; color: ${isMe ? '#000000' : '#f8fafc'}; font-weight: ${isMe ? '600' : 'normal'}; border: 1px solid ${isMe ? '#f59e0b' : 'rgba(255,255,255,0.12)'}; padding: 7px 12px; border-radius: ${isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px'}; font-size: 13px; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; max-width: 84%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                ${escapeHtml(msg.text)}
            </div>
        </div>`;
    }

    function partyToast(title, msg, type = 'info') {
        const container = document.getElementById('partySyncContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[2147483647] bg-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center gap-3 shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300';
        
        let icon = '<i data-lucide="info" class="w-5 h-5 text-blue-400"></i>';
        if (type === 'success') icon = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i>';
        if (type === 'error') icon = '<i data-lucide="alert-circle" class="w-5 h-5 text-red-400"></i>';
        
        toast.innerHTML = `
            ${icon}
            <div class="flex flex-col">
                <span class="text-white text-sm font-bold">${title}</span>
                <span class="text-gray-400 text-xs">${msg}</span>
            </div>
        `;
        
        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();
        
        setTimeout(() => {
            toast.classList.replace('animate-in', 'animate-out');
            toast.classList.replace('slide-in-from-top-4', 'slide-out-to-top-4');
            toast.classList.replace('fade-in', 'fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    let currentRoom = null;
    let participantId = localStorage.getItem('party_participant_id') || null;
    let isHost = false;
    let syncInterval = null;
    let lastChatCount = 0;
    let inactivityTimer = null;
    let overlayEnabled = localStorage.getItem('party_overlay') !== 'false';

    // Check if URL has ?party=ROOM_ID
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('party');
    const autoJoinName = urlParams.get('party_user') || 'Friend_' + Math.floor(100 + Math.random() * 900);

    // Inactivity hide for floating badge
    function resetInactivity() {
        const badge = document.getElementById('partyFloatingBadge');
        if (badge && currentRoom && (document.getElementById('partySyncModal')?.classList.contains('hidden') && (document.getElementById('partyChatSidebar') ? document.getElementById('partyChatSidebar').classList.contains('translate-x-full') : true))) {
            badge.style.opacity = '1';
            badge.style.pointerEvents = 'auto';
        }
        
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            if (badge && currentRoom && (document.getElementById('partySyncModal')?.classList.contains('hidden') && (document.getElementById('partyChatSidebar') ? document.getElementById('partyChatSidebar').classList.contains('translate-x-full') : true))) {
                badge.style.opacity = '0';
                badge.style.pointerEvents = 'none';
            }
        }, 3000);
    }

    document.addEventListener('mousemove', resetInactivity);
    document.addEventListener('touchstart', resetInactivity);
    document.addEventListener('keydown', resetInactivity);

    // ==========================================
    // EMBED PROVIDER & TIMELINE SYNC ENGINE
    // ==========================================

    function getActiveEmbedIframe() {
        return document.getElementById('cinema-iframe') || 
               document.getElementById('fullscreenVideoIframe') || 
               document.querySelector('iframe[src*="embed"], iframe[src*="vidlink"], iframe[src*="vidsrc"], iframe[src*="smashystream"], iframe[src*="filmu"], iframe[src*="cinezo"], iframe[src*="2embed"], iframe[src*="vidrift"]');
    }

    function getActiveEmbedServerSelect() {
        return document.getElementById('embedServerSelect') || document.getElementById('playerServerSelector');
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function applyTimeToEmbedUrl(rawUrl, targetSeconds) {
        if (!rawUrl || isNaN(targetSeconds) || targetSeconds <= 0) return rawUrl;
        const sec = Math.floor(targetSeconds);
        try {
            const u = new URL(rawUrl, window.location.origin);
            u.searchParams.set('start', sec);
            u.searchParams.set('t', sec);
            u.searchParams.set('time', sec);
            u.hash = `t=${sec}`;
            return u.toString();
        } catch(e) {
            return rawUrl.includes('?') ? `${rawUrl}&start=${sec}&t=${sec}#t=${sec}` : `${rawUrl}?start=${sec}&t=${sec}#t=${sec}`;
        }
    }

    // Embed playhead tracking state
    const embedPlayhead = {
        currentTime: 0,
        isPlaying: true,
        lastUpdate: Date.now(),
        lastDriftSync: 0,
        currentServer: ''
    };

    function getEstimatedPlayhead() {
        const video = document.querySelector('video');
        if (video) {
            return {
                currentTime: video.currentTime || 0,
                isPlaying: !video.paused
            };
        }
        const ifr = getActiveEmbedIframe();
        if (ifr) {
            let t = embedPlayhead.currentTime;
            if (embedPlayhead.isPlaying) {
                const elapsed = (Date.now() - embedPlayhead.lastUpdate) / 1000;
                t += elapsed;
            }
            return {
                currentTime: Math.max(0, t),
                isPlaying: embedPlayhead.isPlaying
            };
        }
        return {
            currentTime: 0,
            isPlaying: true
        };
    }

    // Cross-origin command dispatcher to player iframes
    function sendEmbedIframeCommand(iframe, action, time) {
        if (!iframe || !iframe.contentWindow) return;
        const targetTime = Math.max(0, Math.floor(time || 0));

        const messages = [];

        if (action === 'seek' || action === 'sync') {
            messages.push({ event: 'command', func: 'seekTo', args: [targetTime] });
            messages.push({ event: 'seek', time: targetTime });
            messages.push({ event: 'seek', value: targetTime });
            messages.push({ action: 'seek', time: targetTime });
            messages.push({ action: 'seek', value: targetTime });
            messages.push({ action: 'setCurrentTime', value: targetTime });
            messages.push({ type: 'seek', time: targetTime });
            messages.push({ type: 'SEEK', time: targetTime });
            messages.push({ type: 'player:seek', time: targetTime });
            messages.push({ context: 'player.js', version: '0.0.11', event: 'setCurrentTime', value: targetTime });
        }

        if (action === 'play') {
            messages.push({ event: 'command', func: 'playVideo', args: [] });
            messages.push({ event: 'play' });
            messages.push({ action: 'play' });
            messages.push({ type: 'play' });
            messages.push({ type: 'PLAY' });
            messages.push({ type: 'player:play' });
            messages.push({ context: 'player.js', version: '0.0.11', event: 'play' });
        }

        if (action === 'pause') {
            messages.push({ event: 'command', func: 'pauseVideo', args: [] });
            messages.push({ event: 'pause' });
            messages.push({ action: 'pause' });
            messages.push({ type: 'pause' });
            messages.push({ type: 'PAUSE' });
            messages.push({ type: 'player:pause' });
            messages.push({ context: 'player.js', version: '0.0.11', event: 'pause' });
        }

        messages.forEach(msg => {
            try {
                iframe.contentWindow.postMessage(msg, '*');
                iframe.contentWindow.postMessage(JSON.stringify(msg), '*');
            } catch (e) {}
        });
    }

    // Inbound postMessage listener for embed player updates (VidLink, Plyr, PlayerJS)
    window.addEventListener('message', (event) => {
        try {
            let data = event.data;
            if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                data = JSON.parse(data);
            }
            if (!data || typeof data !== 'object') return;

            // VidLink event format
            if (data.type === 'PLAYER_EVENT' && data.data) {
                if (typeof data.data.currentTime === 'number') {
                    embedPlayhead.currentTime = data.data.currentTime;
                    embedPlayhead.isPlaying = !data.data.paused;
                    embedPlayhead.lastUpdate = Date.now();
                    updateEmbedHUD();
                }
            }
            // PlayerJS event format
            if (data.event === 'time' || data.event === 'timeupdate') {
                const t = parseFloat(data.time || data.currentTime || data.value);
                if (!isNaN(t)) {
                    embedPlayhead.currentTime = t;
                    embedPlayhead.lastUpdate = Date.now();
                    updateEmbedHUD();
                }
            }
            if (data.event === 'pause') {
                embedPlayhead.isPlaying = false;
                embedPlayhead.lastUpdate = Date.now();
                updateEmbedHUD();
            }
            if (data.event === 'play') {
                embedPlayhead.isPlaying = true;
                embedPlayhead.lastUpdate = Date.now();
                updateEmbedHUD();
            }
            // player.js standard specification
            if (data.context === 'player.js') {
                if (data.event === 'timeupdate' && data.value && typeof data.value.seconds === 'number') {
                    embedPlayhead.currentTime = data.value.seconds;
                    embedPlayhead.lastUpdate = Date.now();
                    updateEmbedHUD();
                }
                if (data.event === 'pause') {
                    embedPlayhead.isPlaying = false;
                    embedPlayhead.lastUpdate = Date.now();
                    updateEmbedHUD();
                }
                if (data.event === 'play') {
                    embedPlayhead.isPlaying = true;
                    embedPlayhead.lastUpdate = Date.now();
                    updateEmbedHUD();
                }
            }
        } catch(e) {}
    });

    function updateEmbedHUD() {}

    // Host Embed Server Change trigger
    window.onHostEmbedServerChange = function(serverName, newUrl, targetTime) {
        if (!currentRoom || !isHost) return;
        const playhead = getEstimatedPlayhead();
        const timeToSend = (typeof targetTime === 'number' && targetTime > 0) ? targetTime : playhead.currentTime;

        embedPlayhead.currentTime = timeToSend;
        embedPlayhead.lastUpdate = Date.now();
        embedPlayhead.currentServer = serverName;

        fetch('/api/party/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: currentRoom.roomId,
                participantId,
                action: 'embed_change',
                embedServer: serverName,
                embedUrl: newUrl,
                currentTime: timeToSend,
                isPlaying: playhead.isPlaying
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success' && data.room) {
                currentRoom = data.room;
                partyToast('Provider Synced', `Broadcasted ${serverName.toUpperCase()} @ ${formatTime(timeToSend)} to all party members`, 'info');
                updateEmbedHUD();
            }
        }).catch(() => {});
    };

    // Guest Force Timeline Alignment
    window.forceEmbedTimelineSync = function() {
        if (!currentRoom) return;
        const ifr = getActiveEmbedIframe();
        if (!ifr) return;
        const targetTime = currentRoom.currentTime || 0;
        embedPlayhead.currentTime = targetTime;
        embedPlayhead.isPlaying = currentRoom.isPlaying;
        embedPlayhead.lastUpdate = Date.now();

        // 1. Cross-origin seek & play/pause dispatch
        sendEmbedIframeCommand(ifr, 'seek', targetTime);
        sendEmbedIframeCommand(ifr, currentRoom.isPlaying ? 'play' : 'pause', targetTime);

        // 2. Re-inject timeline into iframe URL parameters & reload iframe with start time
        try {
            ifr.src = applyTimeToEmbedUrl(ifr.src, targetTime);
        } catch(e) {}

        partyToast('Timeline Synced', `Realigned with Host timeline (${formatTime(targetTime)})`, 'success');
        updateEmbedHUD();
    };

    // Host Embed Scrubber Controls
    window.hostSeekEmbed = function(secondsDelta) {
        if (!currentRoom || !isHost) return;
        const current = getEstimatedPlayhead().currentTime;
        const newTime = Math.max(0, current + secondsDelta);
        embedPlayhead.currentTime = newTime;
        embedPlayhead.lastUpdate = Date.now();

        const ifr = getActiveEmbedIframe();
        if (ifr) {
            sendEmbedIframeCommand(ifr, 'seek', newTime);
            try {
                const u = new URL(ifr.src);
                u.searchParams.set('start', Math.floor(newTime));
                u.searchParams.set('t', Math.floor(newTime));
                u.hash = `t=${Math.floor(newTime)}`;
                ifr.src = u.toString();
            } catch(e) {}
        }

        fetch('/api/party/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: currentRoom.roomId,
                participantId,
                action: 'seek',
                currentTime: newTime,
                isPlaying: embedPlayhead.isPlaying
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success' && data.room) {
                currentRoom = data.room;
                partyToast('Timeline Seek', `Jumped to ${formatTime(newTime)} (Synced)`, 'info');
                updateEmbedHUD();
            }
        }).catch(() => {});
    };

    window.hostToggleEmbedPlay = function() {
        if (!currentRoom || !isHost) return;
        embedPlayhead.isPlaying = !embedPlayhead.isPlaying;
        embedPlayhead.lastUpdate = Date.now();
        const ifr = getActiveEmbedIframe();
        if (ifr) {
            sendEmbedIframeCommand(ifr, embedPlayhead.isPlaying ? 'play' : 'pause', embedPlayhead.currentTime);
        }
        fetch('/api/party/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: currentRoom.roomId,
                participantId,
                action: embedPlayhead.isPlaying ? 'play' : 'pause',
                currentTime: embedPlayhead.currentTime,
                isPlaying: embedPlayhead.isPlaying
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success' && data.room) {
                currentRoom = data.room;
                partyToast(embedPlayhead.isPlaying ? 'Resumed' : 'Paused', `Playback ${embedPlayhead.isPlaying ? 'resumed' : 'paused'} across party`, 'info');
                updateEmbedHUD();
            }
        }).catch(() => {});
    };
    
    // Inject Watch Together UI Modal and Chat Drawer into DOM
    function injectPartyUI() {
        if (document.getElementById('partySyncModal')) return;

        const container = document.createElement('div');
        container.id = 'partySyncContainer';
        container.innerHTML = `
            <!-- Watch Together Setup & Status Modal -->
            <div id="partySyncModal" class="hidden fixed inset-0 z-[2147483640] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in select-none">
                <div class="w-full max-w-lg rounded-[1.5rem] p-4 sm:p-8 border border-amber-500/30 bg-[#0c0d14] text-white shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                    <div class="absolute -top-24 -right-24 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-yellow-600/20 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div class="flex justify-between items-center mb-5 shrink-0 z-10">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <i data-lucide="users" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-black tracking-tight flex items-center gap-2">
                                    WATCH TOGETHER
                                    <span class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold border border-amber-500/30">SYNC ENGINE</span>
                                </h3>
                                <p class="text-xs text-slate-400">Stream synchronized in real-time across friends</p>
                            </div>
                        </div>
                        <button onclick="window.togglePartyModal(false)" class="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>

                    <!-- Room Create / Join Forms (When Not in a Room) -->
                    <div id="partySetupView" class="space-y-4 z-10">
                        <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <label class="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Your Display Name</label>
                            <input id="partyUserName" type="text" placeholder="e.g. Alex" class="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors">
                        </div>

                        <!-- Direct Join Setting for Host -->
                        <div class="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer" onclick="const cb = document.getElementById('setupDirectJoinToggle'); cb.checked = !cb.checked;">
                            <div>
                                <span class="text-xs font-bold text-amber-400 block">Allow Anyone to Join Directly</span>
                                <span class="text-[10px] text-slate-400">If unchecked, guests will need your approval before joining</span>
                            </div>
                            <div class="relative ml-2" onclick="event.stopPropagation();">
                                <input type="checkbox" id="setupDirectJoinToggle" checked class="sr-only peer">
                                <div class="w-10 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button id="btnCreateParty" onclick="window.createPartyRoom()" class="py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all active:scale-95">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                                <span>Host New Room</span>
                            </button>
                            <div class="flex gap-2">
                                <input id="joinRoomCode" type="text" placeholder="Enter Room Code" class="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs uppercase font-mono tracking-wider text-center focus:outline-none focus:border-amber-500">
                                <button onclick="window.joinPartyRoomManual()" class="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-all">
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Active Room Controls View (When In Room) -->
                    <div id="partyActiveView" class="hidden space-y-4 z-10 flex-1 overflow-y-auto">
                        <div class="bg-gradient-to-r from-pink-950/40 to-purple-950/40 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-mono uppercase text-amber-400 font-black tracking-widest flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                    ROOM SYNCHRONIZED
                                </span>
                                <span id="partyRoomCodeBadge" class="text-xs font-mono font-black text-white bg-black/60 px-2.5 py-1 rounded-lg border border-white/10">------</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <input id="partyShareLink" readonly type="text" class="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all outline-none">
                                <button onclick="window.copyPartyLink()" id="btnCopyPartyLink" class="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md">
                                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                                    <span>Copy</span>
                                </button>
                            </div>
                        </div>

                        <!-- Participants List -->
                        <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    Participants (<span id="partyParticipantsCount">0</span>)
                                    <button onclick="window.changePartyName()" class="text-[10px] text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded transition-colors border border-amber-500/20">Change Name</button>
                                </span>
                                <span id="partyRoleBadge" class="text-[10px] uppercase font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">Guest</span>
                            </div>
                            <div id="partyParticipantsList" class="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1"></div>
                        </div>
                        
                        <!-- Host Controls: Join Access & Approval Toggle -->
                        <div id="partyHostSettings" class="hidden bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>👑</span> Host Controls: Join Access
                                </span>
                                <span id="partyApprovalModeStatus" class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Direct Join: ON</span>
                            </div>
                            <div class="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5 cursor-pointer" onclick="const cb = document.getElementById('partyAllCanJoinCheck'); cb.checked = !cb.checked; window.toggleAllCanJoin(cb.checked);">
                                <div>
                                    <span class="text-xs font-bold text-white block">Anyone Can Join Directly</span>
                                    <span class="text-[10px] text-slate-400">Turn ON to let friends join without waiting for host approval</span>
                                </div>
                                <div class="relative ml-3" onclick="event.stopPropagation();">
                                    <input type="checkbox" id="partyAllCanJoinCheck" checked class="sr-only peer" onchange="window.toggleAllCanJoin(this.checked)">
                                    <div class="w-10 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </div>
                            </div>
                            <div id="partyHostPendingBanner" class="hidden bg-amber-950/70 border border-amber-500/60 p-2.5 rounded-xl flex items-center justify-between">
                                <div>
                                    <span class="text-xs font-bold text-amber-300 block"><span id="partyPendingBadgeNum">0</span> Guest(s) Waiting</span>
                                    <span class="text-[10px] text-amber-200/80">Pending your approval to watch</span>
                                </div>
                                <button type="button" onclick="window.allowAllWaitingGuests()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] rounded-lg transition-colors shadow">
                                    Allow All Now
                                </button>
                            </div>
                        </div>

                        <!-- Quick Reactions -->
                        <div class="bg-white/5 border border-white/10 rounded-2xl p-2 sm:p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                            <span class="text-xs font-bold text-slate-400">Quick React:</span>
                            <div class="flex items-center gap-2">
                                <button onclick="window.sendPartyReaction('❤️')" class="text-lg hover:scale-125 transition-transform p-1">❤️</button>
                                <button onclick="window.sendPartyReaction('🔥')" class="text-lg hover:scale-125 transition-transform p-1">🔥</button>
                                <button onclick="window.sendPartyReaction('😂')" class="text-lg hover:scale-125 transition-transform p-1">😂</button>
                                <button onclick="window.sendPartyReaction('🍿')" class="text-lg hover:scale-125 transition-transform p-1">🍿</button>
                                <button onclick="window.sendPartyReaction('😱')" class="text-lg hover:scale-125 transition-transform p-1">😱</button>
                            </div>
                        </div>

                        <!-- Text Chat Box -->
                        <div class="bg-black border border-white/10 rounded-2xl flex flex-col overflow-hidden h-44 sm:h-52 shrink-0">
                            <div id="partyChatMessages" class="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col text-xs bg-black" style="overflow-y: auto; display: flex; flex-direction: column;">
                                <!-- chat messages go here -->
                            </div>
                            <div class="p-2 border-t border-white/10 flex gap-2 bg-neutral-900">
                                <input id="partyChatInput" type="text" placeholder="Type a message..." class="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500" onkeypress="if(event.key === 'Enter') window.sendPartyChat()">
                                <button onclick="window.sendPartyChat()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-colors shadow">
                                    Send
                                </button>
                            </div>
                        </div>

                        <button onclick="window.leavePartyRoom()" class="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs uppercase tracking-wider transition-all shrink-0">
                            Leave Watch Party
                        </button>
                    </div>
                </div>
            </div>

            <!-- Floating Party Sync Indicator Badge -->
            <div id="partyFloatingBadge" class="hidden fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[2147483630] flex items-center gap-2 bg-black/95 backdrop-blur-md border border-amber-500/40 px-3 py-2 rounded-2xl shadow-xl hover:border-amber-500 transition-all cursor-pointer group max-w-[calc(100vw-2rem)]" onclick="window.togglePartyModal(true)">
                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                            PARTY <span id="floatUserCount" class="text-black font-mono bg-amber-600 px-1 py-0.2 rounded text-[9px]">1</span>
                        </span>
                        <span id="floatStatusText" class="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5 truncate hidden sm:block whitespace-nowrap">Syncing</span>
                    </div>
                </div>
                <div class="w-[1px] h-6 bg-white/20 mx-1 shrink-0"></div>
                <button onclick="window.toggleChatSidebar(true); event.stopPropagation();" class="p-1.5 sm:p-2 bg-amber-500/10 hover:bg-amber-500/30 rounded-full text-amber-400 transition-colors pointer-events-auto flex items-center justify-center shrink-0" title="Open Sidebar Chat">
                    <i data-lucide="message-square" class="w-4 h-4"></i>
                </button>
                <div class="w-[1px] h-6 bg-white/20 mx-1 shrink-0"></div>
                <button onclick="document.getElementById('partyFloatingBadge').style.display='none'; event.stopPropagation();" class="p-1.5 sm:p-2 bg-red-500/10 hover:bg-red-500/30 rounded-full text-red-400 transition-colors pointer-events-auto flex items-center justify-center shrink-0" title="Hide Badge">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Right Sidebar Chat -->
            <div id="partyChatSidebar" style="box-sizing: border-box; width: 360px; max-width: calc(100vw - 16px); height: 100%; max-height: 100dvh; display: flex; flex-direction: column; z-index: 2147483640;" class="fixed bottom-0 right-0 bg-neutral-950 border-l border-white/15 transform translate-x-full transition-transform duration-300 shadow-2xl">
                <!-- Header with explicit X close button -->
                <div class="p-3.5 border-b border-white/10 flex justify-between items-center bg-neutral-900 shrink-0 w-full">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <h3 class="text-white font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-1.5">
                            Party Chat
                        </h3>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button id="toggleOverlayBtn" onclick="window.togglePartyOverlay()" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Toggle Floating Mode">
                            <i id="overlayIcon" data-lucide="${overlayEnabled ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>
                        </button>
                        <button onclick="window.toggleChatSidebar(false)" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center" title="Close Chat">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Messages container (Clean Bubble Layout) -->
                <div id="sidebarChatMessages" class="flex-1 p-3 overflow-y-auto w-full bg-neutral-950" style="display: flex; flex-direction: column; gap: 4px; word-break: break-word; overflow-wrap: anywhere;">
                    <!-- Messages go here -->
                </div>
                
                <!-- Reactions -->
                <div class="p-2 border-t border-white/10 flex gap-4 justify-center bg-neutral-900 shrink-0 w-full">
                    <button onclick="window.sendPartyReaction('❤️')" class="text-xl hover:scale-125 transition-transform">❤️</button>
                    <button onclick="window.sendPartyReaction('🔥')" class="text-xl hover:scale-125 transition-transform">🔥</button>
                    <button onclick="window.sendPartyReaction('😂')" class="text-xl hover:scale-125 transition-transform">😂</button>
                    <button onclick="window.sendPartyReaction('🍿')" class="text-xl hover:scale-125 transition-transform">🍿</button>
                    <button onclick="window.sendPartyReaction('😱')" class="text-xl hover:scale-125 transition-transform">😱</button>
                </div>
                
                <!-- Input Box -->
                <div class="p-3 border-t border-white/10 bg-neutral-900 flex gap-2 shrink-0 w-full">
                    <input id="sidebarChatInput" type="text" placeholder="Type a message..." class="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" onkeypress="if(event.key === 'Enter') window.sendSidebarChat()">
                    <button onclick="window.sendSidebarChat()" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-colors shadow">Send</button>
                </div>
            </div>

            <!-- Floating Emoji Reaction Container -->
            <div id="partyReactionCanvas" class="fixed inset-0 pointer-events-none z-[2147483635] overflow-hidden"></div>
        `;
        document.body.appendChild(container);
        if (window.lucide) lucide.createIcons();

        // Check if user should auto-join from URL
        if (roomParam) {
            const storedName = localStorage.getItem('party_user_name');
            if (storedName) {
                joinRoom(roomParam, storedName);
            } else {
                window.togglePartyModal(true);
                const joinInput = document.getElementById('joinRoomCode');
                if (joinInput) joinInput.value = roomParam;
            }
        }
    }

    // Toggle Modal Visibility
    window.togglePartyModal = function(show = true) {
        const modal = document.getElementById('partySyncModal');
        if (!modal) {
            injectPartyUI();
            return window.togglePartyModal(show);
        }
        if (show) {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            const container = document.getElementById('partySyncContainer');
            if (fsEl && container && container.parentElement !== fsEl) {
                fsEl.appendChild(container);
            } else if (!fsEl && container && container.parentElement !== document.body) {
                document.body.appendChild(container);
            }
            modal.classList.remove('hidden');
            document.getElementById('partyFloatingBadge')?.classList.add('hidden');
            const storedName = localStorage.getItem('party_user_name') || 'Friend_' + Math.floor(100 + Math.random() * 900);
            const input = document.getElementById('partyUserName');
            if (input && !input.value) input.value = storedName;
            if (window.lucide) lucide.createIcons();
        } else {
            modal.classList.add('hidden');
            if (currentRoom) {
                document.getElementById('partyFloatingBadge')?.classList.remove('hidden');
                resetInactivity();
            }
        }
    };


    // Sidebar Resizing Logic
    let isResizingChat = false;
    let chatStartX = 0;
    let chatStartWidth = 0;
    let isResizingChatVertical = false;
    let chatStartY = 0;
    let chatStartHeight = 0;

    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('#partyChatResizerTop')) {
            isResizingChatVertical = true;
            chatStartY = e.clientY;
            const sidebar = document.getElementById('partyChatSidebar');
            chatStartHeight = sidebar.offsetHeight;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        } else if (e.target.closest('#partyChatResizer')) {
            isResizingChat = true;
            chatStartX = e.clientX;
            const sidebar = document.getElementById('partyChatSidebar');
            chatStartWidth = sidebar.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
    });

    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('#partyChatResizerTop')) {
            isResizingChatVertical = true;
            chatStartY = e.touches[0].clientY;
            const sidebar = document.getElementById('partyChatSidebar');
            chatStartHeight = sidebar.offsetHeight;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        } else if (e.target.closest('#partyChatResizer')) {
            isResizingChat = true;
            chatStartX = e.touches[0].clientX;
            const sidebar = document.getElementById('partyChatSidebar');
            chatStartWidth = sidebar.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
    }, {passive: true});

            const handleChatDrag = (currentX, currentY) => {
        if (isResizingChat) {
            const diffX = chatStartX - currentX;
            let newWidth = chatStartWidth + diffX;
            if (newWidth < 280) newWidth = 280;
            if (newWidth > window.innerWidth - 40) newWidth = window.innerWidth - 40;
            const sidebar = document.getElementById('partyChatSidebar');
            if (sidebar) {
                sidebar.style.transition = 'none'; 
                sidebar.style.width = newWidth + 'px';
            }
        } else if (isResizingChatVertical) {
            const diffY = chatStartY - currentY;
            let newHeight = chatStartHeight + diffY;
            if (newHeight < 300) newHeight = 300;
            if (newHeight > window.innerHeight) newHeight = window.innerHeight;
            const sidebar = document.getElementById('partyChatSidebar');
            if (sidebar) {
                sidebar.style.transition = 'none'; 
                sidebar.style.height = newHeight + 'px';
            }
        }
    };

    document.addEventListener('mousemove', (e) => {
        if (isResizingChat || isResizingChatVertical) handleChatDrag(e.clientX, e.clientY);
    });

    document.addEventListener('touchmove', (e) => {
        if (isResizingChat || isResizingChatVertical) handleChatDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: true});

    const stopChatResize = () => {
        if (isResizingChat || isResizingChatVertical) {
            isResizingChat = false;
            isResizingChatVertical = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const sidebar = document.getElementById('partyChatSidebar');
            if (sidebar) {
                // Remove inline transition to restore class-based transition
                sidebar.style.transition = ''; 
            }
        }
    };
    
    document.addEventListener('mouseup', stopChatResize);
    document.addEventListener('touchend', stopChatResize);
    // Create Room
    window.createPartyRoom = async function() {
        const nameInput = document.getElementById('partyUserName');
        const hostName = (nameInput?.value || '').trim() || 'Host';
        localStorage.setItem('party_user_name', hostName);

        const playhead = getEstimatedPlayhead();
        const currentTime = playhead.currentTime;
        let mediaUrl = window.location.href;
        let mediaName = document.title || 'Cinema Stream';

        const embedSelect = getActiveEmbedServerSelect();
        const embedIframe = getActiveEmbedIframe();
        const embedServer = embedSelect ? embedSelect.value : '';
        const embedUrl = embedIframe ? embedIframe.src : '';

        // If on consumet.html with selected media, use its player stream URL
        let season = undefined;
        let episode = undefined;
        if (typeof selectedMedia !== 'undefined' && selectedMedia && selectedMedia.id) {
            const tmdbId = selectedMedia.id;
            const title = selectedMedia.title || selectedMedia.name || 'Cinema Stream';
            const type = selectedMedia.media_type || (selectedMedia.name ? 'tv' : 'movie');
            season = (typeof selectedSeason !== 'undefined') ? selectedSeason : 1;
            episode = (typeof selectedEpisode !== 'undefined') ? selectedEpisode : 1;
            mediaUrl = `${window.location.origin}/play_consumet.php?id=${tmdbId}&name=${encodeURIComponent(title)}&type=${type}&s=${season}&e=${episode}&source=consumet.html`;
            if (selectedMedia.external_ids?.imdb_id) {
                mediaUrl += `&imdb=${encodeURIComponent(selectedMedia.external_ids.imdb_id)}`;
            }
            mediaName = title;
        }

        const directJoinChecked = document.getElementById('setupDirectJoinToggle') ? document.getElementById('setupDirectJoinToggle').checked : true;
        const requireApproval = !directJoinChecked;

        try {
            const res = await fetch('/api/party/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hostName,
                    mediaUrl,
                    mediaName,
                    currentTime,
                    requireApproval,
                    embedServer,
                    embedUrl,
                    season,
                    episode
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                currentRoom = data.room;
                participantId = data.participantId;
                localStorage.setItem('party_participant_id', participantId);
                localStorage.setItem('party_is_host_' + currentRoom.roomId, 'true');
                if (data.hostToken) {
                    localStorage.setItem('party_host_token_' + currentRoom.roomId, data.hostToken);
                }
                isHost = true;

                updateEmbedHUD();

                // If created on consumet.html and points to player, navigate to it with room id
                if (currentRoom.mediaUrl && window.location.pathname.includes('consumet.html') && currentRoom.mediaUrl.includes('play_consumet.php')) {
                    const targetUrl = new URL(currentRoom.mediaUrl);
                    targetUrl.searchParams.set('party', currentRoom.roomId);
                    window.location.href = targetUrl.toString();
                    return;
                }

                setupActiveRoom();
                
                // Update URL to preserve party context on reload
                if (!window.location.search.includes('party=')) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('party', currentRoom.roomId);
                    window.history.replaceState({}, '', url.toString());
                }
            } else {
                alert(data.message || 'Failed to create room');
            }
        } catch (e) {
            console.error('[PartyMode] Error creating room:', e);
            alert('Failed to connect to party sync engine.');
        }
    };

    // Join Room
    window.joinPartyRoomManual = function() {
        let code = (document.getElementById('joinRoomCode')?.value || '').trim();
        if (!code) return alert('Please enter a room code (e.g. PARTY-1234 or 1234)');

        // Extract room code if user pasted a full URL or query string
        try {
            if (code.includes('party=')) {
                const match = code.match(/[?&]party=([^&#\s]+)/i);
                if (match && match[1]) {
                    code = match[1];
                }
            }
        } catch (e) {}

        // Strip leading hash or spaces
        code = code.replace(/^[#\s]+/, '').trim().toUpperCase();

        const nameInput = document.getElementById('partyUserName');
        const userName = (nameInput?.value || '').trim() || 'Friend';
        joinRoom(code, userName);
    };

    async function joinRoom(roomId, userName) {
        localStorage.setItem('party_user_name', userName);
        const hostToken = localStorage.getItem('party_host_token_' + roomId) || '';
        try {
            const res = await fetch('/api/party/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, userName, existingId: participantId, hostToken })
            });
            const data = await res.json();
            if (data.status === 'success') {
                currentRoom = data.room;
                participantId = data.participantId;
                localStorage.setItem('party_participant_id', participantId);
                if (data.isHost || localStorage.getItem('party_is_host_' + currentRoom.roomId) === 'true' || currentRoom.hostId === participantId) {
                    isHost = true;
                    localStorage.setItem('party_is_host_' + currentRoom.roomId, 'true');
                } else {
                    isHost = false;
                }
                const pStatus = data.participantStatus;

                if (pStatus === 'rejected' || pStatus === 'removed') {
                    alert('You have been removed or rejected from this party.');
                    window.location.search = '';
                    return;
                }

                // Auto-Redirect: If the room is watching something different than the user's current page, redirect them!
                if (currentRoom.mediaUrl && !isHost) {
                    try {
                        const targetUrl = new URL(currentRoom.mediaUrl, window.location.origin);
                        targetUrl.searchParams.set('party', currentRoom.roomId);
                        
                        // Compare paths and core query params to avoid infinite loops, ignoring things like time
                        const currentUrl = new URL(window.location.href);
                        if (targetUrl.pathname !== currentUrl.pathname || targetUrl.searchParams.get('url') !== currentUrl.searchParams.get('url')) {
                            console.log("Redirecting to host's media:", targetUrl.toString());
                            window.location.href = targetUrl.toString();
                            return;
                        }
                    } catch(e) {}
                }

                setupActiveRoom(pStatus);
            } else {
                console.warn('[PartyMode] Join failed:', data.message);
                partyToast('Join Failed', data.message || 'Room not found or expired. Check your room code.', 'error');
                if (roomParam) window.togglePartyModal(true);
            }
        } catch (e) {
            console.error('[PartyMode] Error joining room:', e);
            partyToast('Connection Error', 'Could not reach watch party server. Please try again.', 'error');
        }
    }

    function setupActiveRoom(pStatus) {
        document.getElementById('partySetupView')?.classList.add('hidden');
        document.getElementById('partyActiveView')?.classList.remove('hidden');
        document.getElementById('partyFloatingBadge')?.classList.remove('hidden');
        resetInactivity();
        
        // --- History Reset Logic to prevent ghosting & mass float ---
        const myName = localStorage.getItem('party_user_name') || 'You';
        if (currentRoom) {
            lastChatCount = currentRoom.chat ? currentRoom.chat.length : 0;
            const chatBox = document.getElementById('partyChatMessages');
            const sidebarChatBox = document.getElementById('sidebarChatMessages');
            if (chatBox) chatBox.innerHTML = '';
            if (sidebarChatBox) sidebarChatBox.innerHTML = '';
            
            // Render historical chat to panel in clean bubbles
            if (currentRoom.chat && currentRoom.chat.length > 0) {
                currentRoom.chat.forEach(msg => {
                    if (!msg.isReaction) {
                        const msgHtml = renderBubbleHtml(msg, myName);
                        if (chatBox) {
                            const msgEl = document.createElement('div');
                            msgEl.style.width = '100%';
                            msgEl.innerHTML = msgHtml;
                            chatBox.appendChild(msgEl);
                        }
                        if (sidebarChatBox) {
                            const sideMsgEl = document.createElement('div');
                            sideMsgEl.style.width = '100%';
                            sideMsgEl.innerHTML = msgHtml;
                            sidebarChatBox.appendChild(sideMsgEl);
                        }
                    }
                });
                if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
                if (sidebarChatBox) sidebarChatBox.scrollTop = sidebarChatBox.scrollHeight;
            }
        }
        // -----------------------------------------------------------

        if (pStatus === 'pending') {
            document.getElementById('partyRoleBadge').innerText = '⏳ Pending Approval';
            document.getElementById('partyRoleBadge').className = 'text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20';
        } else {
            document.getElementById('partyRoleBadge').innerText = isHost ? '👑 Host' : 'Guest';
            document.getElementById('partyRoleBadge').className = 'text-[10px] uppercase font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20';
        }

        // Share link
        const base = (currentRoom && currentRoom.mediaUrl) ? currentRoom.mediaUrl : window.location.href;
        const shareUrl = new URL(base, window.location.origin);
        shareUrl.searchParams.set('party', currentRoom.roomId);
        const shareInput = document.getElementById('partyShareLink');
        if (shareInput) shareInput.value = shareUrl.toString();

        document.getElementById('partyRoomCodeBadge').innerText = currentRoom.roomId;

        updateParticipantsUI();
        if (!syncInterval) startSyncLoop();
        if (pStatus === 'approved' || isHost) {
            showNotification(`Joined Watch Party: ${currentRoom.roomId}`);
        } else {
            showNotification(`Requested to join Watch Party... Waiting for host.`);
        }
        if (window.lucide) lucide.createIcons();
    }

    window.toggleAllCanJoin = async function(allCanJoin) {
        if (!currentRoom) return;
        const requireApproval = !allCanJoin;
        const hostToken = localStorage.getItem('party_host_token_' + currentRoom.roomId) || '';
        try {
            const res = await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/approval`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: participantId, hostToken, requireApproval })
            });
            const data = await res.json();
            if (data.status === 'success') {
                currentRoom.requireApproval = requireApproval;
                partyToast(
                    allCanJoin ? 'Direct Access ON' : 'Approval Required',
                    allCanJoin ? 'All guests can now join instantly without approval.' : 'Guests will need host approval before joining.',
                    'info'
                );
                updateParticipantsUI();
                if (window.forcePartySync) window.forcePartySync();
            } else {
                partyToast('Host Error', data.message || 'Could not update room setting', 'error');
            }
        } catch(e) {
            console.error('[Party] Error toggling approval mode:', e);
        }
    };

    window.allowAllWaitingGuests = async function() {
        if (!currentRoom) return;
        // Setting direct join mode approves all waiting guests on server!
        await window.toggleAllCanJoin(true);
    };

    window.toggleRequireApproval = function(checked) {
        window.toggleAllCanJoin(!checked);
    };

    let lastPendingCount = 0;
    function updateParticipantsUI() {
        if (!currentRoom) return;
        
        const isHostUser = isHost || (currentRoom && currentRoom.hostId === participantId) || (localStorage.getItem('party_is_host_' + currentRoom?.roomId) === 'true');
        
        if (isHostUser && currentRoom.pendingRequests) {
            if (currentRoom.pendingRequests.length > lastPendingCount) {
                partyToast('Join Request', currentRoom.pendingRequests.length + ' guest(s) waiting for approval. Open Party Settings to approve.', 'info');
            }
            lastPendingCount = currentRoom.pendingRequests.length;
        }

        const hostSettings = document.getElementById('partyHostSettings');
        if (hostSettings) {
            if (isHostUser) {
                hostSettings.classList.remove('hidden');
                hostSettings.style.display = 'block';
                const allCanJoinCheck = document.getElementById('partyAllCanJoinCheck');
                const modeStatus = document.getElementById('partyApprovalModeStatus');
                const isDirect = !currentRoom.requireApproval;
                if (allCanJoinCheck) allCanJoinCheck.checked = isDirect;
                if (modeStatus) {
                    modeStatus.innerText = isDirect ? 'Direct Join: ON' : 'Approval: REQUIRED';
                    modeStatus.className = isDirect 
                        ? 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
                }
                const pendingBanner = document.getElementById('partyHostPendingBanner');
                const pendingBadgeNum = document.getElementById('partyPendingBadgeNum');
                const pendingCount = currentRoom.pendingRequests ? currentRoom.pendingRequests.length : 0;
                if (pendingBanner && pendingBadgeNum) {
                    if (pendingCount > 0) {
                        pendingBadgeNum.innerText = pendingCount;
                        pendingBanner.classList.remove('hidden');
                        pendingBanner.style.display = 'flex';
                    } else {
                        pendingBanner.classList.add('hidden');
                        pendingBanner.style.display = 'none';
                    }
                }
            } else {
                hostSettings.classList.add('hidden');
                hostSettings.style.display = 'none';
            }
        }
        const count = currentRoom.participants?.length || 1;
        const countEl = document.getElementById('partyParticipantsCount');
        const floatCount = document.getElementById('floatUserCount');
        if (countEl) countEl.innerText = count;
        if (floatCount) floatCount.innerText = count;

        const listEl = document.getElementById('partyParticipantsList');
        if (listEl) {
            let html = (currentRoom.participants || []).map(p => `
                <div class="flex items-center gap-1.5 bg-black border border-white/10 px-2.5 py-1 rounded-xl text-xs ${p.isHost ? 'border-amber-500/50 text-amber-300 font-bold' : 'text-slate-300'}">
                    <img src="${p.avatar}" alt="${p.name}" class="w-5 h-5 rounded-full" onerror="this.outerHTML='<span>👤</span>'">
                    <span class="truncate max-w-[100px]">${escapeHtml(p.name)}</span>
                    ${p.isHost ? '<span class="text-[9px] text-amber-400 ml-0.5 font-mono">HOST</span>' : ''}
                    ${(isHostUser && !p.isHost) ? `<button onclick="window.removePartyUser('${p.id}')" class="ml-1 text-red-500 hover:text-red-400 transition-colors" title="Kick"><i data-lucide="user-x" class="w-3.5 h-3.5"></i></button>` : ''}
                </div>
            `).join('');
            
            if (isHostUser && currentRoom.pendingRequests && currentRoom.pendingRequests.length > 0) {
                html += `<div class="w-full mt-2 pt-2 border-t border-white/10 flex flex-col gap-2">`;
                html += `<span class="text-[10px] uppercase font-bold text-amber-500">Pending Requests (${currentRoom.pendingRequests.length})</span>`;
                html += currentRoom.pendingRequests.map(p => `
                    <div class="flex items-center justify-between gap-1.5 bg-amber-950/40 border border-amber-500/40 px-2.5 py-1.5 rounded-xl text-xs text-amber-200">
                        <div class="flex items-center gap-1.5">
                            <img src="${p.avatar}" alt="${p.name}" class="w-5 h-5 rounded-full" onerror="this.outerHTML='<span>👤</span>'">
                            <span class="truncate max-w-[100px] font-medium">${escapeHtml(p.name)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="window.approvePartyUser('${p.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-black font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Approve</button>
                            <button onclick="window.rejectPartyUser('${p.id}')" class="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-2 py-1 rounded-lg text-[10px] transition-colors"><i data-lucide="x" class="w-3 h-3"></i></button>
                        </div>
                    </div>
                `).join('');
                html += `</div>`;
            }
            
            listEl.innerHTML = html;
            if (window.lucide) lucide.createIcons();
        }
    }

    window.approvePartyUser = async function(targetId) {
        if (!currentRoom) return;
        const hostToken = localStorage.getItem('party_host_token_' + currentRoom.roomId) || '';
        try {
            await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/participant/${encodeURIComponent(targetId)}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: participantId, hostToken })
            });
            if (window.forcePartySync) window.forcePartySync();
        } catch(e) {}
    };

    window.rejectPartyUser = async function(targetId) {
        if (!currentRoom) return;
        const hostToken = localStorage.getItem('party_host_token_' + currentRoom.roomId) || '';
        try {
            await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/participant/${encodeURIComponent(targetId)}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: participantId, hostToken })
            });
            if (window.forcePartySync) window.forcePartySync();
        } catch(e) {}
    };

    window.removePartyUser = async function(targetId) {
        if (!currentRoom) return;
        if (!confirm('Kick this user?')) return;
        const hostToken = localStorage.getItem('party_host_token_' + currentRoom.roomId) || '';
        try {
            await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/participant/${encodeURIComponent(targetId)}/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: participantId, hostToken })
            });
            if (window.forcePartySync) window.forcePartySync();
        } catch(e) {}
    };

    window.changePartyName = function() {
        if (!currentRoom || !participantId) return;
        
        const existing = document.getElementById('nameChangeModal');
        if (existing) existing.remove();

        const modalHtml = `
        <div id="nameChangeModal" class="fixed inset-0 z-[2147483648] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div class="bg-black border border-amber-500/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-amber-500/20 animate-in zoom-in-95 duration-200">
                <div class="p-5 border-b border-white/10 bg-gradient-to-r from-amber-900/30 to-black">
                    <h3 class="text-amber-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2"><i data-lucide="edit-3" class="w-4 h-4"></i> Change Display Name</h3>
                </div>
                <div class="p-5 space-y-4">
                    <input id="newNameInput" type="text" placeholder="Enter new name..." class="w-full bg-neutral-900 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" />
                    <div class="flex gap-3 justify-end mt-4">
                        <button onclick="document.getElementById('nameChangeModal').remove()" class="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors">Cancel</button>
                        <button onclick="window.submitNameChange()" class="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20">Save</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (window.lucide) lucide.createIcons();
        const input = document.getElementById('newNameInput');
        input.value = localStorage.getItem('party_user_name') || '';
        input.focus();
        input.onkeypress = (e) => { if(e.key === 'Enter') window.submitNameChange(); };
    };

    window.submitNameChange = async function() {
        const input = document.getElementById('newNameInput');
        if(!input) return;
        const newName = input.value.trim();
        if(!newName) return;

        const modal = document.getElementById('nameChangeModal');
        if (modal) modal.remove();
        
        try {
            const res = await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/participant/${encodeURIComponent(participantId)}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: newName })
            });
            if (res.ok) {
                localStorage.setItem('party_user_name', newName);
                if (window.forcePartySync) window.forcePartySync();
            }
        } catch(e) {}
    };

    // High frequency sync loop
    function startSyncLoop() {
        if (syncInterval) clearInterval(syncInterval);

        window.forcePartySync = async () => {
            if (!currentRoom || !participantId) return;

            const video = document.querySelector('video');
            const playhead = getEstimatedPlayhead();
            const currentTime = playhead.currentTime;
            const isPlaying = playhead.isPlaying;
            const embedSelect = getActiveEmbedServerSelect();
            const embedIframe = getActiveEmbedIframe();

            try {
                const res = await fetch('/api/party/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: currentRoom.roomId,
                        participantId,
                        action: isHost ? 'host_update' : 'heartbeat',
                        currentTime,
                        isPlaying,
                        embedServer: isHost && embedSelect ? embedSelect.value : undefined,
                        embedUrl: isHost && embedIframe ? embedIframe.src : undefined
                    })
                });

                const data = await res.json();
                
                // Check if user was removed or rejected
                if (data.participantStatus === 'removed' || data.participantStatus === 'rejected') {
                    clearInterval(syncInterval);
                    syncInterval = null;
                    alert('You have been removed or rejected from the watch party by the host.');
                    window.location.search = '';
                    return;
                }

                if (data.status === 'success' && data.room) {
                    currentRoom = data.room;
                    updateParticipantsUI();
                    updateEmbedHUD();

                    if (data.participantStatus === 'pending') {
                        document.getElementById('partyRoleBadge').innerText = '⏳ Pending Approval';
                        document.getElementById('partyRoleBadge').className = 'text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20';
                    } else {
                        document.getElementById('partyRoleBadge').innerText = isHost ? '👑 Host' : 'Guest';
                        document.getElementById('partyRoleBadge').className = 'text-[10px] uppercase font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20';
                    }

                    // Sync state for approved guests
                    if (!isHost && data.participantStatus === 'approved') {
                        // 1. EMBED SERVER / PROVIDER SYNCHRONIZATION
                        if (currentRoom.embedServer) {
                            const guestEmbedSelect = getActiveEmbedServerSelect();
                            const guestEmbedIframe = getActiveEmbedIframe();
                            
                            if (guestEmbedSelect && guestEmbedSelect.value !== currentRoom.embedServer) {
                                guestEmbedSelect.value = currentRoom.embedServer;
                                partyToast('Provider Synced', `Host changed provider to ${currentRoom.embedServer.toUpperCase()}`, 'info');
                                
                                if (typeof window.switchEmbedServer === 'function') {
                                    window.switchEmbedServer(currentRoom.embedServer, currentRoom.currentTime);
                                } else if (typeof window.changeServerFromFullscreen === 'function') {
                                    window.changeServerFromFullscreen();
                                }
                            } else if (guestEmbedIframe && currentRoom.embedUrl && !guestEmbedIframe.src.includes(currentRoom.embedServer)) {
                                guestEmbedIframe.src = applyTimeToEmbedUrl(currentRoom.embedUrl, currentRoom.currentTime);
                            }
                        }

                        // 2. EMBED TIMELINE SYNCHRONIZATION (CROSS-ORIGIN POSTMESSAGE & DRIFT CORRECTION)
                        const activeEmbed = getActiveEmbedIframe();
                        if (activeEmbed) {
                            const targetTime = currentRoom.currentTime || 0;
                            const guestTime = getEstimatedPlayhead().currentTime;
                            const drift = Math.abs(guestTime - targetTime);

                            // Dispatch cross-origin play / pause commands
                            sendEmbedIframeCommand(activeEmbed, currentRoom.isPlaying ? 'play' : 'pause', targetTime);

                            // If drift exceeds 2.5 seconds, dispatch seek command
                            const now = Date.now();
                            if (drift > 2.5 && (now - embedPlayhead.lastDriftSync > 3500)) {
                                embedPlayhead.lastDriftSync = now;
                                embedPlayhead.currentTime = targetTime;
                                embedPlayhead.isPlaying = currentRoom.isPlaying;
                                embedPlayhead.lastUpdate = now;

                                sendEmbedIframeCommand(activeEmbed, 'seek', targetTime);

                                // For large drift (> 7.0s), re-inject start/t parameter into iframe URL to force video seek
                                if (drift > 7.0) {
                                    try {
                                        activeEmbed.src = applyTimeToEmbedUrl(activeEmbed.src, targetTime);
                                    } catch(e) {}
                                }
                            }
                        }

                        // 3. NATIVE VIDEO STATE SYNCHRONIZATION
                        if (video) {
                            const targetTime = currentRoom.currentTime;
                            const drift = Math.abs(video.currentTime - targetTime);

                            // If drift exceeds 1 second and video is seeking capable, sync it
                            if (drift > 1.0 && !isNaN(targetTime) && video.seekable && video.seekable.length > 0) {
                                video.currentTime = targetTime;
                                const floatStatus = document.getElementById('floatSyncStatus');
                                if (floatStatus) floatStatus.innerText = 'Synchronized with Host';
                            }

                            // Sync play / pause
                            if (currentRoom.isPlaying && video.paused) {
                                video.play().catch(() => {});
                            } else if (!currentRoom.isPlaying && !video.paused) {
                                video.pause();
                            }
                        }
                    }

                    // Check for new chat / reactions
                    if (currentRoom.chat && currentRoom.chat.length > lastChatCount) {
                        const newMsgs = currentRoom.chat.slice(lastChatCount);
                        lastChatCount = currentRoom.chat.length;
                        const chatBox = document.getElementById('partyChatMessages');
                        const sidebarChatBox = document.getElementById('sidebarChatMessages');
                        const myName = localStorage.getItem('party_user_name') || 'You';
                        
                        newMsgs.forEach(msg => {
                            if (msg.isReaction) {
                                spawnFloatingEmoji(msg.text);
                            } else {
                                spawnFloatingChat(msg.sender, msg.text);
                                if (chatBox || sidebarChatBox) {
                                    const msgHtml = renderBubbleHtml(msg, myName);
                                    
                                    if (chatBox) {
                                        const msgEl = document.createElement('div');
                                        msgEl.style.width = '100%';
                                        msgEl.innerHTML = msgHtml;
                                        chatBox.appendChild(msgEl);
                                        chatBox.scrollTop = chatBox.scrollHeight;
                                    }
                                    if (sidebarChatBox) {
                                        const sideMsgEl = document.createElement('div');
                                        sideMsgEl.style.width = '100%';
                                        sideMsgEl.innerHTML = msgHtml;
                                        sidebarChatBox.appendChild(sideMsgEl);
                                        sidebarChatBox.scrollTop = sidebarChatBox.scrollHeight;
                                    }
                                }
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn('[PartySync] Sync ping failed:', err);
            }
        };

        syncInterval = setInterval(window.forcePartySync, 1000);
    }

    window.copyPartyLink = function() {
        const input = document.getElementById('partyShareLink');
        if (!input) return;
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = document.getElementById('btnCopyPartyLink');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied!';
                btn.classList.replace('bg-amber-600', 'bg-emerald-600');
                if (window.lucide) lucide.createIcons();
                setTimeout(() => {
                    btn.innerHTML = orig;
                    btn.classList.replace('bg-emerald-600', 'bg-amber-600');
                    if (window.lucide) lucide.createIcons();
                }, 2000);
            }
        });
    };

    window.sendPartyReaction = async function(emoji) {
        if (!currentRoom) return;
        spawnFloatingEmoji(emoji);
        const name = localStorage.getItem('party_user_name') || 'Friend';
        try {
            await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: name, text: emoji, isReaction: true })
            });
        } catch (e) {}
    };

    

    window.togglePartyOverlay = function() {
        overlayEnabled = !overlayEnabled;
        localStorage.setItem('party_overlay', overlayEnabled);
        const icon = document.getElementById('overlayIcon');
        if (icon) {
            icon.setAttribute('data-lucide', overlayEnabled ? 'eye' : 'eye-off');
            if (window.lucide) lucide.createIcons();
        }
        // Minimal toast notification if available
        if (typeof showNotification === 'function') {
            showNotification(overlayEnabled ? 'Chat Overlay: ON' : 'Chat Overlay: OFF');
        }
    };

    window.toggleChatSidebar = function(show) {
        const sidebar = document.getElementById('partyChatSidebar');
        if (!sidebar) return;
        if (show) {
            sidebar.classList.remove('translate-x-full');
            document.getElementById('partyFloatingBadge')?.classList.add('hidden');
            if (window.lucide) lucide.createIcons();
            const input = document.getElementById('sidebarChatInput');
            if(input) setTimeout(() => input.focus(), 300);
        } else {
            sidebar.classList.add('translate-x-full');
            if (currentRoom) document.getElementById('partyFloatingBadge')?.classList.remove('hidden');
        }
    };

    window.sendSidebarChat = function() {
        const input = document.getElementById('sidebarChatInput');
        if (!input || !input.value.trim()) return;
        const text = input.value.trim();
        input.value = '';
        
        // Actually send it
        const name = localStorage.getItem('party_user_name') || 'Friend';
        fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: name, text, avatar: '' })
        }).then(() => {
            if (window.forcePartySync) window.forcePartySync();
        }).catch(() => {});
    };

    window.sendPartyChat = async function() {
        if (!currentRoom) return;
        const input = document.getElementById('partyChatInput');
        if (!input || !input.value.trim()) return;
        
        const text = input.value.trim();
        input.value = '';
        const name = localStorage.getItem('party_user_name') || 'Friend';
        
        try {
            await fetch(`/api/party/room/${encodeURIComponent(currentRoom.roomId)}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: name, text: text, isReaction: false })
            });
            // Force an immediate sync to show the message instantly
            if (window.forcePartySync) window.forcePartySync();
        } catch (e) {}
    };

    function spawnFloatingChat(sender, text) {
        if (!overlayEnabled) return;
        const canvas = document.getElementById('partyReactionCanvas');
        if (!canvas) return;
        const el = document.createElement('div');
        el.className = 'absolute whitespace-nowrap px-4 py-2 rounded-full bg-black/70 border border-white/20 backdrop-blur-md text-sm text-white font-bold flex items-center gap-2 pointer-events-none transition-transform duration-[12000ms] ease-linear shadow-xl';
        el.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
        
        const leftPos = Math.floor(5 + Math.random() * 25);
        el.style.top = '-60px';
        el.style.left = `${leftPos}%`;
        el.innerHTML = `<span class="text-amber-400 drop-shadow-md">${sender}:</span> <span>${text}</span>`;
        canvas.appendChild(el);
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transform = `translateY(calc(100vh + 120px))`;
            });
        });
        
        setTimeout(() => el.remove(), 12000);
    }

    function spawnFloatingEmoji(emoji) {
        if (!overlayEnabled) return;
        const canvas = document.getElementById('partyReactionCanvas');
        if (!canvas) return;
        const el = document.createElement('div');
        el.innerText = emoji;
        el.className = 'absolute text-4xl animate-float-up pointer-events-none transition-all drop-shadow-xl';
        el.style.left = `${Math.floor(20 + Math.random() * 60)}vw`;
        el.style.bottom = '10px';
        el.style.animation = 'partyFloat 3s ease-out forwards';
        canvas.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    window.leavePartyRoom = function() {
        if (syncInterval) clearInterval(syncInterval);
        currentRoom = null;
        participantId = null;
        localStorage.removeItem('party_participant_id');
        isHost = false;
        document.getElementById('partyActiveView')?.classList.add('hidden');
        document.getElementById('partySetupView')?.classList.remove('hidden');
        document.getElementById('partyFloatingBadge')?.classList.add('hidden');
        window.togglePartyModal(false);
    };

    function showNotification(text) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 z-[2147483645] bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-xl border border-amber-400/40 animate-in fade-in slide-in-from-top';
        toast.innerText = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // Keyframe style injection for float animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes partyFloat {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            20% { opacity: 1; transform: translateY(-40px) scale(1.3); }
            80% { opacity: 0.9; transform: translateY(-160px) scale(1.1); }
            100% { opacity: 0; transform: translateY(-240px) scale(0.8); }
        }
    `;
    document.head.appendChild(style);

    // Initial DOM binding
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPartyUI);
    } else {
        injectPartyUI();
    }
})();
