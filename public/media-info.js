// Movie & Stream Enriched Intelligence Modal Engine with Bingr Scraper & Character Explorer
(function() {
    let currentMediaData = {
        id: '',
        title: '',
        streamUrl: '',
        type: 'movie',
        tmdbId: null,
        year: ''
    };

    function injectMediaInfoModal() {
        if (document.getElementById('mediaInfoModal')) return;

        const modal = document.createElement('div');
        modal.id = 'mediaInfoModal';
        modal.className = 'hidden fixed inset-0 z-[2147483641] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in select-none';
        modal.innerHTML = `
            <div class="w-full max-w-2xl rounded-3xl p-6 sm:p-8 border border-white/10 bg-[#0d1117] text-white shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <!-- Ambient Backdrop Glow -->
                <div class="absolute -top-32 -right-32 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

                <!-- Modal Header -->
                <div class="flex justify-between items-start mb-4 shrink-0 z-10">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                CINEMA & STREAM INTELLIGENCE
                            </span>
                            <span id="mediaInfoTypeBadge" class="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                                VOD MOVIE
                            </span>
                        </div>
                        <h2 id="mediaInfoTitle" class="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Movie Title</h2>
                        <div class="flex items-center gap-3 text-xs text-slate-400">
                            <span id="mediaInfoYear" class="font-bold text-white">2024</span>
                            <span>•</span>
                            <span id="mediaInfoDuration" class="text-slate-300">2h 14m</span>
                            <span>•</span>
                            <span id="mediaInfoRating" class="font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">★ 8.5 / 10</span>
                        </div>
                    </div>
                    <button onclick="window.closeMediaInfoModal()" class="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Modal Body (Scrollable) -->
                <div class="overflow-y-auto space-y-4 pr-1 custom-scrollbar z-10 flex-1">
                    <!-- Synopsis / Overview -->
                    <div class="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <h4 class="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <i data-lucide="align-left" class="w-3.5 h-3.5"></i>
                            <span>Overview & Plot Synopsis</span>
                        </h4>
                        <p id="mediaInfoOverview" class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            Loading cinematic overview and stream metadata...
                        </p>
                    </div>

                    <!-- Cast & Characters Section -->
                    <div id="mediaInfoCharactersContainer" class="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <i data-lucide="users" class="w-3.5 h-3.5 text-red-500"></i>
                                <span>Cast & Characters</span>
                            </h4>
                            <span id="mediaInfoCharacterCount" class="text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">Loading...</span>
                        </div>
                        <div id="mediaInfoCharactersList" class="flex gap-4 overflow-x-auto pb-2 custom-scrollbar snap-x">
                            <div class="text-xs text-slate-500 italic py-2">Loading character information...</div>
                        </div>
                    </div>

                    <!-- Metadata Grid: Director & Genres -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-white/5 border border-white/5 rounded-2xl p-4">
                            <span class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Genres</span>
                            <div id="mediaInfoGenres" class="flex flex-wrap gap-1.5">
                                <span class="text-[10px] px-2 py-0.5 rounded-lg bg-red-600/20 text-red-300 font-bold">Action</span>
                            </div>
                        </div>

                        <div class="bg-white/5 border border-white/5 rounded-2xl p-4">
                            <span class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Curated Directing</span>
                            <p id="mediaInfoDirector" class="text-xs font-bold text-white">Christopher Nolan</p>
                        </div>
                    </div>

                    <!-- Technical Stream Specifications -->
                    <div class="bg-gradient-to-br from-slate-900/60 to-black/60 border border-white/10 rounded-2xl p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <i data-lucide="cpu" class="w-3.5 h-3.5 text-red-500"></i>
                                <span>Stream Transmission Specs</span>
                            </h4>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Resolution</span>
                                <span id="specResolution" class="text-xs font-black text-white">1080p FHD</span>
                            </div>
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Video Bitrate</span>
                                <span id="specBitrate" class="text-xs font-black text-white">5.8 Mbps</span>
                            </div>
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Video Codec</span>
                                <span id="specVideoCodec" class="text-xs font-black text-white">H.264 AVC</span>
                            </div>
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Audio Codec</span>
                                <span id="specAudioCodec" class="text-xs font-black text-white">Dolby Digital+</span>
                            </div>
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Protocol</span>
                                <span id="specProtocol" class="text-xs font-black text-white">HLS / MPEG-TS</span>
                            </div>
                            <div class="p-2 bg-white/5 rounded-xl border border-white/5">
                                <span class="block text-[8px] uppercase text-slate-400">Aspect Ratio</span>
                                <span id="specAspect" class="text-xs font-black text-white">16:9 Scope</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center gap-2.5 pt-4 mt-2 border-t border-white/10 shrink-0 z-10">
                    <!-- Play by Bing Button -->
                    <button id="mediaInfoBingrBtn" class="flex-1 min-w-[140px] py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 group">
                        <i data-lucide="play" class="w-4 h-4 fill-white"></i>
                        <span id="mediaInfoBingrBtnText">Play Bing</span>
                    </button>

                    <!-- Standard Portal Play Stream Button -->
                    <button id="mediaInfoPlayBtn" class="flex-1 min-w-[120px] py-3 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95">
                        <i data-lucide="tv" class="w-4 h-4 text-slate-300"></i>
                        <span>Portal Play</span>
                    </button>

                    <!-- Watch Together Button -->
                    <button id="mediaInfoPartyBtn" class="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95" title="Watch Together">
                        <i data-lucide="users" class="w-4 h-4 text-pink-400"></i>
                        <span class="hidden sm:inline">Party</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();
    }

    function renderCharacters(cast) {
        const container = document.getElementById('mediaInfoCharactersList');
        if (!container) return;
        if (!cast || cast.length === 0) {
            container.innerHTML = `<span class="text-xs text-slate-500 italic py-2">No character information available.</span>`;
            return;
        }

        const countEl = document.getElementById('mediaInfoCharacterCount');
        if (countEl) countEl.innerText = `${cast.length} Characters`;

        container.innerHTML = cast.slice(0, 20).map((c) => {
            const charName = typeof c === 'string' ? 'Starring' : (c.character || 'Character');
            const actorName = typeof c === 'string' ? c : (c.name || 'Actor');
            const photoUrl = typeof c === 'object' && c.photo ? c.photo : '';
            const initials = actorName.split(' ').map(n => n[0]).slice(0, 2).join('');
            const fallbackAvatar = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#1e293b"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="36">${initials}</text></svg>`)}`;

            return `
                <div class="snap-start shrink-0 w-20 sm:w-24 flex flex-col items-center text-center group cursor-pointer transition-transform hover:-translate-y-1">
                    <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2 bg-zinc-900 ring-2 ring-white/10 group-hover:ring-red-500 transition-all shadow-md">
                        <img src="${photoUrl || fallbackAvatar}"
                             alt="${actorName}"
                             class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                             onerror="this.onerror=null; this.src='${fallbackAvatar}';">
                    </div>
                    <div class="w-full px-0.5">
                        <div class="text-xs font-semibold text-white truncate group-hover:text-red-400 transition-colors leading-tight" title="${charName}">
                            ${charName}
                        </div>
                        <div class="text-[10px] text-slate-400 truncate mt-0.5 leading-tight" title="${actorName}">
                            ${actorName}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.closeMediaInfoModal = function() {
        const modal = document.getElementById('mediaInfoModal');
        if (modal) modal.classList.add('hidden');
    };

    window.openMediaInfoModal = async function(e, id, title, streamUrl = '', type = 'movie') {
        if (e && e.stopPropagation) e.stopPropagation();
        injectMediaInfoModal();

        currentMediaData = {
            id,
            title: title || 'Presentation',
            streamUrl,
            type: (type || 'movie').toLowerCase(),
            tmdbId: null,
            year: ''
        };

        const modal = document.getElementById('mediaInfoModal');
        modal.classList.remove('hidden');

        // Reset immediate visual state
        document.getElementById('mediaInfoTitle').innerText = currentMediaData.title;
        document.getElementById('mediaInfoTypeBadge').innerText = currentMediaData.type.toUpperCase();
        document.getElementById('mediaInfoOverview').innerText = 'Retrieving enriched film synopsis, characters, and stream metadata...';
        document.getElementById('mediaInfoCharactersList').innerHTML = `<div class="text-xs text-slate-500 italic py-2">Loading character details...</div>`;

        const bingrBtnText = document.getElementById('mediaInfoBingrBtnText');
        if (bingrBtnText) bingrBtnText.innerText = 'Play Bing';

        // Play and Party Button Handlers
        const playBtn = document.getElementById('mediaInfoPlayBtn');
        const bingrBtn = document.getElementById('mediaInfoBingrBtn');
        const partyBtn = document.getElementById('mediaInfoPartyBtn');

        playBtn.onclick = () => {
            window.closeMediaInfoModal();
            if (typeof window.playChannel === 'function') {
                window.playChannel(id, streamUrl, currentMediaData.title);
            } else {
                const targetUrl = streamUrl || id;
                window.location.href = `play.php?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(currentMediaData.title)}&source=index.php`;
            }
        };

        bingrBtn.onclick = async () => {
            bingrBtn.disabled = true;
            if (bingrBtnText) bingrBtnText.innerHTML = `<span class="inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 animate-spin text-white inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Connecting...</span>`;

            try {
                const payload = {
                    type: (currentMediaData.type === 'series' || currentMediaData.type === 'anime') ? 'tv' : 'movie',
                    title: currentMediaData.title,
                    id: currentMediaData.tmdbId,
                    year: currentMediaData.year,
                    srv: 's40'
                };

                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.status === 'success' && data.primaryM3u8) {
                    window.closeMediaInfoModal();
                    const streamUrl = data.primaryM3u8;
                    const cleanName = currentMediaData.title + (currentMediaData.year ? ` (${currentMediaData.year})` : '');
                    const srv = data.serverId || data.server || 's40';
                    const tmdbParam = currentMediaData.tmdbId ? `&id=${currentMediaData.tmdbId}&tmdbId=${currentMediaData.tmdbId}` : '';
                    window.location.href = `/play_bingr.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(cleanName)}&title=${encodeURIComponent(currentMediaData.title)}&type=${payload.type}&media_type=${payload.type}&srv=${srv}${tmdbParam}&year=${encodeURIComponent(currentMediaData.year || '')}&source=index.php`;
                } else {
                    // Fallback to dynamic on-demand player route
                    window.closeMediaInfoModal();
                    const tmdbParam = currentMediaData.tmdbId ? `&id=${currentMediaData.tmdbId}&tmdbId=${currentMediaData.tmdbId}` : '';
                    window.location.href = `/play_bingr.php?type=${payload.type}&media_type=${payload.type}&id=${currentMediaData.tmdbId}&tmdbId=${currentMediaData.tmdbId}&title=${encodeURIComponent(currentMediaData.title)}&name=${encodeURIComponent(currentMediaData.title)}&srv=s40${tmdbParam}&source=index.php`;
                }
            } catch (err) {
                console.error('[BingrScraper] Failed to scrape stream:', err);
                window.closeMediaInfoModal();
                const tmdbParam = currentMediaData.tmdbId ? `&id=${currentMediaData.tmdbId}&tmdbId=${currentMediaData.tmdbId}` : '';
                window.location.href = `/play_bingr.php?type=${currentMediaData.type === 'series' ? 'tv' : 'movie'}&id=${currentMediaData.tmdbId}&tmdbId=${currentMediaData.tmdbId}&title=${encodeURIComponent(currentMediaData.title)}&name=${encodeURIComponent(currentMediaData.title)}&srv=s40${tmdbParam}&source=index.php`;
            } finally {
                bingrBtn.disabled = false;
                if (bingrBtnText) bingrBtnText.innerText = 'Play Bing';
            }
        };

        partyBtn.onclick = () => {
            window.closeMediaInfoModal();
            if (typeof window.togglePartyModal === 'function') {
                window.togglePartyModal(true);
            } else {
                const targetUrl = streamUrl || id;
                window.location.href = `play.php?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(currentMediaData.title)}&party_auto=1&source=index.php`;
            }
        };

        try {
            const res = await fetch(`/api/media/info?title=${encodeURIComponent(title)}&id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
            const data = await res.json();
            if (data.status === 'success' && data.info) {
                const info = data.info;
                currentMediaData.tmdbId = info.tmdbId || null;
                currentMediaData.year = info.year || '';

                document.getElementById('mediaInfoTitle').innerText = info.title;
                document.getElementById('mediaInfoYear').innerText = info.year;
                document.getElementById('mediaInfoDuration').innerText = info.duration;
                document.getElementById('mediaInfoRating').innerText = `★ ${info.rating}`;
                document.getElementById('mediaInfoOverview').innerText = info.overview;
                let directorHtml = info.director;
                if (info.malId) {
                    directorHtml += ` &nbsp;|&nbsp; <a href="https://myanimelist.net/anime/${info.malId}" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline font-bold">MyAnimeList</a>`;
                }
                if (info.anilistId) {
                    directorHtml += ` &nbsp;|&nbsp; <a href="https://anilist.co/anime/${info.anilistId}" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline font-bold">AniList</a>`;
                }
                document.getElementById('mediaInfoDirector').innerHTML = directorHtml;

                // Genres
                const genresEl = document.getElementById('mediaInfoGenres');
                genresEl.innerHTML = (info.genres || []).map(g => `<span class="text-[10px] px-2.5 py-0.5 rounded-lg bg-red-600/20 text-red-300 font-bold border border-red-500/20">${g}</span>`).join('');

                // Render Characters and Cast
                renderCharacters(info.cast || []);

                // Specs
                if (info.streamSpecs) {
                    document.getElementById('specResolution').innerText = info.streamSpecs.resolution || '1080p';
                    document.getElementById('specBitrate').innerText = info.streamSpecs.bitrate || '5.8 Mbps';
                    document.getElementById('specVideoCodec').innerText = info.streamSpecs.videoCodec || 'H.264 AVC';
                    document.getElementById('specAudioCodec').innerText = info.streamSpecs.audioCodec || 'Dolby Digital';
                    document.getElementById('specProtocol').innerText = info.streamSpecs.protocol || 'HLS';
                    document.getElementById('specAspect').innerText = info.streamSpecs.aspectRatio || '16:9';
                }
            }
        } catch (err) {
            console.warn('[MediaInfo] Failed to fetch enriched metadata:', err);
        }

        if (window.lucide) lucide.createIcons();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectMediaInfoModal);
    } else {
        injectMediaInfoModal();
    }
})();
