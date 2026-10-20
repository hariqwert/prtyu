/**
 * AETHERIS QUANTUM AI 2.0 - Autonomous Neural Entertainment Engine
 * Groq Llama 3 Intelligence | 4K Cinema Matrix | Live Sports Scraper | 5,200+ IPTV Channels
 */

(function () {
  "use strict";

  if (window.__AETHERIS_LOCAL_AI_LOADED__) return;
  window.__AETHERIS_LOCAL_AI_LOADED__ = true;

  const TMDB_KEY = "9d83476d2e27f56748167514c69cd2b4";
  let isAiModalOpen = false;
    const l = document.getElementById("aetheris-ai-launcher");
    if (l) l.classList.remove("ai-idle-hidden");
    setTimeout(() => { if (typeof resetIdleTimer === 'function') resetIdleTimer(); }, 500);
  let isSpeechSynthesisActive = false;
  let activeGeminiModel = localStorage.getItem('aetheris_gemini_model') || 'gemini-3.5-flash';
  let activeChatbotRole = localStorage.getItem('aetheris_chatbot_role') || 'copilot';
  let activeSearchGrounding = localStorage.getItem('aetheris_gemini_search') !== 'false';
  let clientChatHistory = [];
  try {
    const savedHist = localStorage.getItem('aetheris_gemini_history');
    if (savedHist) clientChatHistory = JSON.parse(savedHist);
  } catch(e) {}

  // Dynamically load Puter.js SDK for Primary Claude 3.5 Sonnet / GPT-4o access
  try {
    if (!window.puter && !document.getElementById('puter-js-sdk')) {
      const pScript = document.createElement('script');
      pScript.id = 'puter-js-sdk';
      window.PUTER_QUIET = true; pScript.src = 'https://js.puter.com/v2/'; window.puter = window.puter || {}; window.puter.quiet = true;
      pScript.async = true;
      document.head.appendChild(pScript);
    }
  } catch (err) {}

  // Primary Tier 1: Puter.js Query Engine (Claude 3.5 Sonnet & GPT-4o)
  async function queryPuterAI(userText) {
    if (!window.puter || !window.puter.ai || typeof window.puter.ai.chat !== 'function') {
      throw new Error('Puter SDK not loaded');
    }
    
    // Ensure the token is set right before querying
    window.puter.setAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYyIn0.eyJ0IjoidCIsInYiOiIyIiwidG9rZW5fdWlkIjoiZmY3MmQwOWMtMzg1OC00NDEzLWFjODAtYzQ5YTBlYjUzNDM4IiwidXUiOiI3YlNxR0ZFT1JrUzZlOFdWLzZidkVRPT0iLCJzdSI6IlU4eUVyTjg1VEJpOFVXZ3RZaUVFb3c9PSIsImFpIjoiN2JTcUdGRU9Sa1M2ZThXVi82YnZFUT09IiwiZnVsbF9hY2Nlc3MiOnRydWUsImlhdCI6MTc4NzgzNjM3NH0.PawVZSmmuziAQzhJvwHfyXmLnjxoxFBMkPsoMJpKX1Y');


    const systemPrompt = `You are Aetheris Quantum AI powered by Puter.js (Perplexity Sonar & GPT-4o). You are the central intelligence of Stalker Pro, an advanced streaming platform supporting Live TV, Movies, Series, YouTube 4K, and 320kbps Music. You have full access to our massive multimedia catalog.


Analyze the user request and respond in pure JSON format ONLY (do not include markdown code block quotes):
{
  "chatResponse": "Your helpful, detailed markdown response.",
  "intent": "CHAT" | "PLAY_MOVIE" | "PLAY_MUSIC" | "PLAY_YOUTUBE" | "PLAY_CHANNEL" | "PLAY_SPORTS_EVENT" | "WEATHER_REPORT" | "NEWS_HEADLINES" | "CREATE_PLAYLIST",
  "target": "extracted query or media title"
}
Intents guide:
- "ADMIN_SWITCH_MODEL": User issues secret command to switch AI model providers.
- "ADMIN_OPEN_GRID": User issues secret command to open system grids directly.
- "PLAY_MOVIE": User asks to play/watch a movie or TV show.
- "PLAY_MUSIC": User asks to play/listen to a song or music.
- "CREATE_PLAYLIST": User asks to create a playlist with a specific name and list of songs. For this, set "playlistName" to the requested name, and "playlistSongs" to an array of song title strings.
- "PLAY_YOUTUBE": User asks for YouTube videos, music videos, or trailers.
- "PLAY_CHANNEL": User asks for a live TV channel (e.g., HBO, ESPN, BBC, Star Sports).
- "PLAY_SPORTS_EVENT": User asks for live sports, cricket, football matches.
- "CHAT": Conversational query or general info.

CRITICAL INSTRUCTION FOR SPORTS: You have real-time web access via Perplexity Sonar. If the user asks to watch or play a live sports match (e.g., "play India vs Sri Lanka test"), you MUST search the web to find the exact TV channel broadcasting it today (e.g., "Star Sports 1", "Sony Sports Network", "Willow TV", "Sky Sports Cricket", "SuperSport"). Then, return the "PLAY_CHANNEL" intent with that specific channel name as the "target", so our IPTV engine can automatically tune into it.

User request: "${userText}"`;

    let res = null;
    try {
      res = await window.puter.ai.chat(systemPrompt, { model: 'sonar' });
    } catch (e1) {
      console.warn('[Puter.js Perplexity Sonar fail, trying GPT-4o]:', e1);
      res = await window.puter.ai.chat(systemPrompt, { model: 'gpt-4o' });
    }

    const raw = res ? (typeof res === 'string' ? res : res.toString ? res.toString() : (res.message?.content || JSON.stringify(res))) : '';
    if (!raw) throw new Error('Empty Puter response');

    let clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(clean);
    } catch (err) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw err;
    }
  }


  

  
  // Clean media query helper
  function cleanQuery(str) {
    if (!str) return '';
    return str
      .replace(/^(?:play|watch|stream|put on|start|tune into|show me|find|search|tell me about|info about|details on|what is the movie|movie|film|tv show|series|anime)\s+/i, '')
      .replace(/\s+(?:movie|film|series|show|in 4k|in hindi|in english|with subtitles|full movie|season\s*\d+|episode\s*\d+|s\d+\s*e\d+|via\s+\w+|on\s+\w+)$/i, '')
      .trim();
  }

  // Dynamic URL Generators adhering strictly to play_consumet.php and info.html
  const UrlGenerators = {
    generateCinemaUrl: (id, type = "movie", season = 1, episode = 1, server = "vidsrc") => {
      return `/consumet.html?player=true&id=${encodeURIComponent(id)}&type=${type}&s=${season}&e=${episode}&server=${server}`;
    },
    generateInfoUrl: (id, type = "movie", season = 1, episode = 1) => {
      return `/info.html?id=${encodeURIComponent(id)}&type=${type}&s=${season}&e=${episode}`;
    },
    generateDetailsUrl: (id, type = "movie") => {
      return `/info.html?id=${encodeURIComponent(id)}&type=${type}`;
    },
    generateChannelUrl: (streamUrl, name, logo, useHlsEngine = false) => {
      if (useHlsEngine) {
        return `/play_hls.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(name || "Live Channel")}&logo=${encodeURIComponent(logo || "")}`;
      }
      return `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(name || "Live Channel")}&logo=${encodeURIComponent(logo || "")}&source=local_ai`;
    },
    generateMusicSearchUrl: (query) => {
      return `/music.html?q=${encodeURIComponent(query)}`;
    },
    generateBookSearchUrl: (query) => {
      return `/books.html?search=${encodeURIComponent(query)}`;
    },
    generateTorrentUrl: (query, type = "movie", season = 1, episode = 1) => {
      return `/consumet.html#torrent?q=${encodeURIComponent(query)}&type=${type}&s=${season}&e=${episode}`;
    }
  };

  // ----------------------------------------------------
  // Chat Widget UI Injection
  // ----------------------------------------------------
  function createAIChatWidget() {
    if (document.getElementById("aetheris-ai-root")) return;

    

    const root = document.createElement("div");
    root.id = "aetheris-ai-root";
    root.innerHTML = `
      <!-- AI Floating Quantum Launcher -->
      <div id="ai-launcher-wrapper" style="position: fixed; bottom: 22px; right: 22px; z-index: 2147483647;">
        <button id="aetheris-ai-launcher" aria-label="AI" class="ai-launcher-btn relative group overflow-hidden" title="AI Assistant (Ctrl+Space)" onclick="window.__AETHERIS_AI__ && window.__AETHERIS_AI__.open ? window.__AETHERIS_AI__.open() : null">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span onclick="event.stopPropagation(); document.getElementById('aetheris-ai-root').style.display='none';" class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-zinc-900/90 border border-white/20 text-zinc-300 hover:text-white hover:bg-rose-600 hover:border-rose-500 flex items-center justify-center text-[8px] font-bold shadow-md transition-all cursor-pointer z-10" title="Hide AI Widget">✕</span>
        </button>
      </div>

      <!-- AI Glassmorphic Command Center Modal -->
      <div id="aetheris-ai-modal" class="ai-modal-container hidden" role="dialog" aria-modal="true">
        <div class="ai-modal-backdrop" id="ai-modal-backdrop"></div>
        
        <div class="ai-modal-window">
          <!-- Cyberpunk Quantum Border Effect -->
          <div class="ai-modal-edge-glow"></div>

          <!-- Header -->
          <div class="ai-modal-header">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-md">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-white tracking-wide truncate">Aetheris Gemini AI</h3>
                  <span id="ai-active-model-badge" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Gemini 3.5 Flash</span>
                </div>
                <p id="ai-active-role-title" class="text-[11px] text-zinc-400 truncate">Entertainment Copilot • Multi-Turn Chat</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5 shrink-0">
              <button id="ai-voice-toggle-btn" class="ai-header-btn" title="Toggle AI Voice Response">
                <svg class="w-4 h-4 text-zinc-400 hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
              <button id="ai-clear-btn" class="ai-header-btn" title="Clear Chat History">
                <svg class="w-4 h-4 text-zinc-400 hover:text-rose-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button id="ai-close-btn" class="ai-header-btn" title="Close (Esc)">
                <svg class="w-4 h-4 text-zinc-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Role & Model Selection Strip -->
          <div class="px-3 py-2 bg-black/40 border-b border-white/5 flex flex-col gap-1.5 text-xs">
            <!-- Roles Selector -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" id="ai-roles-bar">
              <button class="ai-cat-pill active" data-role="copilot" title="Cinema, TV, Music & IPTV Navigator">✨ Copilot</button>
              <button class="ai-cat-pill" data-role="pro_polymath" title="Complex Reasoning, Math, Coding & Deep Analysis">🧠 Polymath</button>
              <button class="ai-cat-pill" data-role="fast_assistant" title="Lightning Speed & Ultra-Concise Answers">⚡ Lightning</button>
              <button class="ai-cat-pill" data-role="movie_critic" title="Film Critic, Directing & Screenplay Review">🎬 Film Critic</button>
              <button class="ai-cat-pill" data-role="audiophile" title="Lossless Sound, Production & Acoustics">🎧 Audiophile</button>
            </div>
            <!-- Model Selector & Google Search Grounding -->
            <div class="flex items-center justify-between gap-2 pt-0.5">
              <div class="flex items-center gap-1" id="ai-model-selector-bar">
                <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-1">Model:</span>
                <button class="ai-model-pill tier-fast" data-model="gemini-3.1-flash-lite" title="Fast Tasks (Ultra-low latency)">⚡ Fast</button>
                <button class="ai-model-pill active" data-model="gemini-3.5-flash" title="General Tasks (Balanced Multimodal Intelligence)">🌟 General</button>
                
              </div>
              <button id="ai-search-toggle-btn" class="ai-model-pill flex items-center gap-1 text-[10px]" title="Google Search Grounding (Live Web Knowledge)">
                <span>🌐</span>
                <span>Web Search</span>
              </button>
            </div>
          </div>

          <!-- Chat Stream Container -->
          <div class="ai-modal-stream" id="ai-chat-stream">
            <!-- Greeting Message -->
            <div class="ai-msg-bubble ai-msg-bot">
              <div class="ai-msg-avatar">
                <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="ai-msg-content space-y-2.5">
                <div class="flex items-center justify-between gap-2 pb-1 border-b border-white/5 text-[10px]">
                  <span class="font-bold text-cyan-400 flex items-center gap-1">
                    <span>✨</span>
                    <span id="ai-greeting-model-tag">Gemini 3.5 Flash</span>
                  </span>
                  <span class="text-zinc-500">Multi-Turn Session Active</span>
                </div>
                <p class="text-xs text-zinc-200 leading-relaxed">
                  Welcome to <strong class="text-white font-black">Aetheris Quantum AI</strong> powered by <strong class="text-cyan-400">Google Gemini</strong>. I remember full conversation context across your questions. You can ask me to launch 4K movies, analyze plots, write code, research live web data, or tune into 5,200+ IPTV channels directly in this thread!
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button onclick="window.__AETHERIS_AI__.sendPrompt('Play Inception in 4K')" class="ai-quick-btn">
                    <span class="text-cyan-400">🎬</span>
                    <span>Play Inception in 4K</span>
                  </button>
                  <button onclick="window.__AETHERIS_AI__.sendPrompt('Explain the ending of Interstellar in deep detail')" class="ai-quick-btn">
                    <span class="text-purple-400">🧠</span>
                    <span>Interstellar Plot Analysis</span>
                  </button>
                  <button onclick="window.__AETHERIS_AI__.sendPrompt('Play song Believer Imagine Dragons')" class="ai-quick-btn">
                    <span class="text-amber-400">🎵</span>
                    <span>Play Song: Believer</span>
                  </button>
                  <button onclick="window.__AETHERIS_AI__.sendPrompt('Play Star Sports 1 Hindi')" class="ai-quick-btn">
                    <span class="text-rose-400">🏏</span>
                    <span>Star Sports 1 Cricket HD</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer / Input Form -->
          <div class="ai-modal-footer">
            <form id="ai-chat-form" class="flex items-center gap-2">
              <div class="relative flex-1 flex items-center bg-zinc-900/90 border border-white/10 rounded-[16px] px-1.5 py-1.5 focus-within:border-cyan-500/50 transition-all shadow-inner">
                <button type="button" id="ai-mic-btn" class="p-2 text-zinc-400 hover:text-cyan-300 flex-shrink-0 transition-colors rounded-xl hover:bg-white/5" title="Voice Search (Speech API)">
                  <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <input 
                  type="text" 
                  id="ai-user-input" 
                  autocomplete="off" 
                  placeholder="Ask Gemini: 'Recommend 4K thriller', 'Dissect Inception plot', 'Star Sports 1'..." 
                  class="flex-1 bg-transparent border-none text-white text-[13px] px-2 outline-none placeholder:text-zinc-500 min-w-0" 
                />
              </div>
              <button type="submit" id="ai-send-btn" class="w-[44px] h-[44px] rounded-[16px] bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-all shadow-lg" aria-label="Send Query">
                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    // Force launcher button always visible via inline style (defeat any CSS conflicts)
    const _launcher = document.getElementById('aetheris-ai-launcher');
    if (_launcher) {
      // Allow CSS transitions for idle auto-hide
    }
    setupEventListeners();
  }

  // ----------------------------------------------------
  // Event Listeners & Shortcuts
  // ----------------------------------------------------
  function setupEventListeners() {
    const launcher = document.getElementById("aetheris-ai-launcher");
    const modal = document.getElementById("aetheris-ai-modal");
    const backdrop = document.getElementById("ai-modal-backdrop");
    const closeBtn = document.getElementById("ai-close-btn");
    const clearBtn = document.getElementById("ai-clear-btn");
    const voiceBtn = document.getElementById("ai-voice-toggle-btn");
    const micBtn = document.getElementById("ai-mic-btn");
    const form = document.getElementById("ai-chat-form");
    const input = document.getElementById("ai-user-input");

    launcher?.addEventListener("click", openAIModal);
    backdrop?.addEventListener("click", closeAIModal);
    closeBtn?.addEventListener("click", closeAIModal);

    clearBtn?.addEventListener("click", () => {
      const stream = document.getElementById("ai-chat-stream");
      if (stream) {
        clientChatHistory = [];
        try { localStorage.removeItem('aetheris_gemini_history'); } catch(e) {}
        stream.innerHTML = `
          <div class="ai-msg-bubble ai-msg-bot">
            <div class="ai-msg-avatar">
              <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div class="ai-msg-content text-xs text-zinc-300">Conversation thread and memory reset. What would you like to explore next?</div>
          </div>
        `;
      }
    });

    // Role Selection Listener
    const rolesBar = document.getElementById("ai-roles-bar");
    const roleTitleElem = document.getElementById("ai-active-role-title");
    const roleDescriptors = {
      copilot: "Entertainment Copilot • Cinema, TV, IPTV & Music Navigator",
      pro_polymath: "Quantum Polymath • Complex Reasoning, Deep Math & Script Analysis",
      fast_assistant: "Lightning Assistant • Ultra-Fast Concise Responses",
      movie_critic: "Film Critic & Screenplay Analyst • Directing & Auteur Cinema",
      audiophile: "Audiophile & Music Curator • Lossless Acoustics & Sound Engineering"
    };

    function updateRoleUI(role) {
      if (!rolesBar) return;
      activeChatbotRole = role;
      try { localStorage.setItem('aetheris_chatbot_role', role); } catch(e) {}
      rolesBar.querySelectorAll(".ai-cat-pill").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.role === role);
      });
      if (roleTitleElem) {
        roleTitleElem.textContent = roleDescriptors[role] || "Multi-Turn Gemini Session";
      }
    }

    rolesBar?.addEventListener("click", (e) => {
      const btn = e.target.closest(".ai-cat-pill");
      if (!btn || !btn.dataset.role) return;
      const role = btn.dataset.role;
      updateRoleUI(role);

      // Auto-adapt model for specific roles if user hasn't explicitly locked one
      if (role === 'pro_polymath') {
        updateModelUI('gemini-3.5-flash');
      } else if (role === 'fast_assistant') {
        updateModelUI('gemini-3.1-flash-lite');
      }
    });

    // Model Selection Listener
    const modelBar = document.getElementById("ai-model-selector-bar");
    const modelBadge = document.getElementById("ai-active-model-badge");
    const greetingTag = document.getElementById("ai-greeting-model-tag");
    const modelLabels = {
      'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
      'gemini-3.5-flash': 'Gemini 3.5 Flash',
      };

    function updateModelUI(modelId) {
      if (!modelBar) return;
      activeGeminiModel = modelId;
      try { localStorage.setItem('aetheris_gemini_model', modelId); } catch(e) {}
      modelBar.querySelectorAll(".ai-model-pill").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.model === modelId);
      });
      const lbl = modelLabels[modelId] || 'Gemini 3.5 Flash';
      if (modelBadge) modelBadge.textContent = lbl;
      if (greetingTag) greetingTag.textContent = lbl;
    }

    modelBar?.addEventListener("click", (e) => {
      const btn = e.target.closest(".ai-model-pill");
      if (!btn || !btn.dataset.model) return;
      updateModelUI(btn.dataset.model);
    });

    // Google Search Grounding Toggle
    const searchBtn = document.getElementById("ai-search-toggle-btn");
    function updateSearchUI(active) {
      activeSearchGrounding = active;
      try { localStorage.setItem('aetheris_gemini_search', active ? 'true' : 'false'); } catch(e) {}
      searchBtn?.classList.toggle("active", active);
      if (searchBtn) {
        searchBtn.style.background = active ? 'rgba(59,130,246,0.25)' : '';
        searchBtn.style.borderColor = active ? 'rgba(59,130,246,0.6)' : '';
        searchBtn.style.color = active ? '#93c5fd' : '';
      }
    }
    searchBtn?.addEventListener("click", () => {
      updateSearchUI(!activeSearchGrounding);
    });

    // Initial state restore
    updateRoleUI(activeChatbotRole);
    updateModelUI(activeGeminiModel);
    updateSearchUI(activeSearchGrounding);

    // ----------------------------------------------------
    // Draggable AI Launcher Icon (Touch + Mouse, Any Screen Part)
    // ----------------------------------------------------
    const launcherWrapper = document.getElementById("ai-launcher-wrapper");
    const launcherBtn = document.getElementById("aetheris-ai-launcher");
    if (launcherWrapper && launcherBtn) {
      let isDragging = false;
      let hasMoved = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      // Restore saved coordinates if any
      try {
        const savedPos = JSON.parse(localStorage.getItem('aetheris_ai_pos') || 'null');
        if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
          const clampedX = Math.max(8, Math.min(window.innerWidth - 60, savedPos.x));
          const clampedY = Math.max(8, Math.min(window.innerHeight - 60, savedPos.y));
          launcherWrapper.style.left = clampedX + 'px';
          launcherWrapper.style.top = clampedY + 'px';
          launcherWrapper.style.right = 'auto';
          launcherWrapper.style.bottom = 'auto';
        }
      } catch(e) {}

      const onDragStart = (clientX, clientY) => {
        isDragging = true;
        hasMoved = false;
        startX = clientX;
        startY = clientY;
        const rect = launcherWrapper.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        launcherWrapper.style.transition = 'none';
      };

      const onDragMove = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (Math.hypot(dx, dy) > 4) {
          hasMoved = true;
        }
        const newLeft = Math.max(4, Math.min(window.innerWidth - 56, initialLeft + dx));
        const newTop = Math.max(4, Math.min(window.innerHeight - 56, initialTop + dy));
        launcherWrapper.style.left = newLeft + 'px';
        launcherWrapper.style.top = newTop + 'px';
        launcherWrapper.style.right = 'auto';
        launcherWrapper.style.bottom = 'auto';
      };

      const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        launcherWrapper.style.transition = '';
        if (hasMoved) {
          try {
            const rect = launcherWrapper.getBoundingClientRect();
            localStorage.setItem('aetheris_ai_pos', JSON.stringify({ x: rect.left, y: rect.top }));
          } catch(e) {}
        }
      };

      // Mouse events
      launcherWrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('[title="Hide AI Widget"]')) return;
        onDragStart(e.clientX, e.clientY);
        const onMouseMove = (ev) => onDragMove(ev.clientX, ev.clientY);
        const onMouseUp = () => {
          onDragEnd();
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      // Touch events (mobile)
      launcherWrapper.addEventListener('touchstart', (e) => {
        if (e.target.closest('[title="Hide AI Widget"]')) return;
        const touch = e.touches[0];
        if (!touch) return;
        onDragStart(touch.clientX, touch.clientY);
      }, { passive: true });

      launcherWrapper.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        onDragMove(touch.clientX, touch.clientY);
      }, { passive: true });

      launcherWrapper.addEventListener('touchend', onDragEnd, { passive: true });

      // Prevent opening modal if drag was performed
      launcherBtn.addEventListener('click', (e) => {
        if (hasMoved) {
          e.stopImmediatePropagation();
          e.preventDefault();
          hasMoved = false;
        }
      }, true);
    }

    voiceBtn?.addEventListener("click", () => {
      isSpeechSynthesisActive = !isSpeechSynthesisActive;
      voiceBtn.classList.toggle("text-cyan-400", isSpeechSynthesisActive);
      if (isSpeechSynthesisActive) {
        speakText("Quantum voice response active.");
      }
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      handleUserChatInput(val);
      input.value = "";
    });

            // ----------------------------------------------------
    // Fast, Zero-Lag Voice Recognition Engine
    // ----------------------------------------------------
    let recognition = null;
    let isRecognizing = false;

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecClass();
      recognition.continuous = false; // Single-shot: zero CPU lag, instant stop
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        isRecognizing = true;
        micBtn?.classList.add("ai-mic-active");
        const waveHud = document.getElementById("ai-voice-wave-hud");
        if (waveHud) waveHud.classList.remove("hidden");
        input.placeholder = "Listening... Speak now";
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          input.value = transcript.trim();
        }
      };

      recognition.onerror = () => {
        stopVoiceSearch();
      };

      recognition.onend = () => {
        const val = input.value.trim();
        stopVoiceSearch();
        if (val) {
          handleUserChatInput(val);
          input.value = "";
        }
      };

      function startVoiceSearch() {
        if (isRecognizing) return;
        try {
          recognition.start();
        } catch (e) {}
      }

      function stopVoiceSearch() {
        isRecognizing = false;
        micBtn?.classList.remove("ai-mic-active");
        const waveHud = document.getElementById("ai-voice-wave-hud");
        if (waveHud) waveHud.classList.add("hidden");
        input.placeholder = "Ask: 'Play Deadpool in 4K', 'Sky Sports 1', 'Believer song'...";
        try { recognition.stop(); } catch (e) {}
      }

      micBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        if (isRecognizing) {
          stopVoiceSearch();
        } else {
          startVoiceSearch();
        }
      });
    } else {
      if (micBtn) micBtn.style.display = "none";
    }

    // Keybind: Ctrl+Space or Cmd+Space
    document.addEventListener("keydown", (e) => {
      wakeLauncher();
      if ((e.ctrlKey || e.metaKey) && (e.code === "Space" || e.key === "j" || e.key === "J")) {
        e.preventDefault();
        toggleAIModal();
      }
      if (e.key === "Escape" && isAiModalOpen) {
        closeAIModal();
      }
    });

    // ----------------------------------------------------
    // Auto-Hide Idle Inactivity Detection (4s timer)
    // ----------------------------------------------------
    let idleTimer = null;

    function wakeLauncher() {
      if (launcher) {
        launcher.classList.remove("ai-idle-hidden");
      }
      resetIdleTimer();
    }

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      if (isAiModalOpen) return;

      // Disappear after 4 seconds of no user interaction
      idleTimer = setTimeout(() => {
        if (!isAiModalOpen && launcher && !launcher.matches(":hover")) {
          launcher.classList.add("ai-idle-hidden");
        }
      }, 4000);
    }

    // Wake up on mouse move, touch tap, scroll, or keypress
    ["mousemove", "mousedown", "touchstart", "touchmove", "scroll", "keydown"].forEach((evt) => {
      window.addEventListener(evt, wakeLauncher, { passive: true });
    });

    launcher?.addEventListener("mouseenter", () => {
      if (idleTimer) clearTimeout(idleTimer);
      launcher.classList.remove("ai-idle-hidden");
    });

    launcher?.addEventListener("mouseleave", () => {
      resetIdleTimer();
    });

    // Start initial timer
    resetIdleTimer();
  }

  let hasRestoredHistory = false;
  function restoreChatHistoryUI() {
    if (hasRestoredHistory) return;
    hasRestoredHistory = true;
    const chatStream = document.getElementById("ai-chat-stream");
    if (!chatStream || !clientChatHistory || !clientChatHistory.length) return;

    // Render historical turns into the scrollable thread
    clientChatHistory.forEach(item => {
      if (item.role === 'user') {
        const userNode = document.createElement("div");
        userNode.className = "ai-msg-bubble ai-msg-user";
        userNode.innerHTML = `<div class="ai-msg-content text-xs text-white leading-relaxed">${escapeHtml(item.content)}</div>`;
        chatStream.appendChild(userNode);
      } else if (item.role === 'assistant' || item.role === 'model') {
        const botNode = document.createElement("div");
        botNode.className = "ai-msg-bubble ai-msg-bot";
        botNode.innerHTML = `
          <div class="ai-msg-avatar">
            <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="ai-msg-content space-y-2.5 w-full">
            <div class="flex items-center justify-between text-[10px] pb-1 border-b border-white/5">
              <span class="font-bold text-cyan-300 flex items-center gap-1">
                <span>✨</span>
                <span>Gemini Memory</span>
              </span>
              <span class="text-zinc-500 font-medium">Prior Turn</span>
            </div>
            <div class="text-xs text-zinc-200 leading-relaxed">${formatMarkdown(item.content || "")}</div>
          </div>
        `;
        chatStream.appendChild(botNode);
      }
    });
    scrollToBottom();
  }

  function openAIModal() {
    const launcher = document.getElementById("ai-launcher-wrapper");
    if (launcher) launcher.style.display = "none";
    const modal = document.getElementById("aetheris-ai-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    isAiModalOpen = true;
    restoreChatHistoryUI();
    setTimeout(() => {
      document.getElementById("ai-user-input")?.focus();
    }, 100);
  }

  function closeAIModal() {
    const launcher = document.getElementById("ai-launcher-wrapper");
    if (launcher) launcher.style.display = "block";
    const waveHud = document.getElementById('ai-voice-wave-hud');
    if (waveHud) waveHud.classList.add('hidden');
    const modal = document.getElementById("aetheris-ai-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    isAiModalOpen = false;
  }

  function toggleAIModal() {
    if (isAiModalOpen) closeAIModal();
    else openAIModal();
  }

  // ----------------------------------------------------
  // Chat Communication & Execution Engine
  // ----------------------------------------------------
  async function handleUserChatInput(text) {
    const chatStream = document.getElementById("ai-chat-stream");
    if (!chatStream) return;

    // 1. Render User Bubble
    const userNode = document.createElement("div");
    userNode.className = "ai-msg-bubble ai-msg-user";
    userNode.innerHTML = `<div class="ai-msg-content text-xs text-white leading-relaxed">${escapeHtml(text)}</div>`;
    chatStream.appendChild(userNode);
    scrollToBottom();

    // Dynamic model selection based on prompt complexity
    let selectedModel = activeGeminiModel || 'gemini-3.5-flash';
    let taskComplexity = 'general';

    const isComplex = text.length > 220 || /analyze|deep|reason|math|equation|code|algorithm|script|critique|compare|proof|theory|dissect|cinematography|auteur/i.test(text);
    const isFast = (text.length < 45 && !isComplex && !activeSearchGrounding) || /^(?:hi|hello|hey|status|ping|help)\b/i.test(text.trim());

    if (activeChatbotRole === 'fast_assistant' || isFast) {
      taskComplexity = 'fast';
      selectedModel = 'gemini-3.1-flash-lite';
    } else {
      taskComplexity = 'general';
      selectedModel = 'gemini-3.5-flash';
    }

    // 2. Typing Indicator with Active Model Details
    const typingNode = document.createElement("div");
    typingNode.className = "ai-msg-bubble ai-msg-bot ai-typing-indicator";
    typingNode.id = "ai-typing-node";
    const modelFriendlyName = selectedModel.includes('pro') ? 'Gemini 3.1 Pro' : (selectedModel.includes('lite') ? 'Gemini 3.1 Flash Lite' : 'Gemini 3.5 Flash');
    typingNode.innerHTML = `
      <div class="ai-msg-avatar">
        <svg class="w-4 h-4 text-cyan-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      </div>
      <div class="ai-msg-content text-xs text-cyan-300/90 italic flex items-center gap-2">
        <span>✨ ${modelFriendlyName} is thinking (${activeChatbotRole.replace('_', ' ')} role)...</span>
      </div>
    `;
    chatStream.appendChild(typingNode);
    scrollToBottom();

    // Update conversation history (excluding current user message for the prior history payload)
    const priorHistory = [...clientChatHistory];
    clientChatHistory.push({ role: 'user', content: text });
    if (clientChatHistory.length > 20) clientChatHistory = clientChatHistory.slice(-20);

    let data = null;

    // TIER 1 PRIMARY: Server-Side Google Gemini Chat API (/api/gemini/chat)
    try {
      console.log(`[Aetheris Gemini] Sending multi-turn request (${selectedModel}, role: ${activeChatbotRole})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch(e) {}
      }, 30000);

      const geminiPayload = {
        message: text,
        history: priorHistory,
        role: activeChatbotRole,
        model: selectedModel,
        complexity: taskComplexity,
        enableSearch: Boolean(activeSearchGrounding)
      };

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const geminiJson = await res.json();
        if (geminiJson && geminiJson.text) {
          data = {
            status: "success",
            chatResponse: geminiJson.text,
            model: geminiJson.model || selectedModel,
            role: geminiJson.role || activeChatbotRole,
            groundingMetadata: geminiJson.groundingMetadata,
            speechText: geminiJson.text.replace(/[*_#`]/g, '').slice(0, 160)
          };
          console.log('[Aetheris Gemini] Chat Success:', data);
        }
      }
    } catch (geminiErr) {
      console.warn('[Aetheris Gemini] Chat request note:', geminiErr?.message || geminiErr);
      data = null;
    }

    // TIER 2 SECONDARY: LocalAI Chat Route Fallback
    if (!data) {
      try {
        console.log('[Aetheris Gemini] Trying /api/local-ai/chat fallback...');
        const res = await fetch("/api/local-ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: priorHistory,
            role: activeChatbotRole,
            model: selectedModel,
            complexity: taskComplexity,
            enableSearch: Boolean(activeSearchGrounding)
          })
        });
        if (res.ok) {
          const fallbackJson = await res.json();
          if (fallbackJson && (fallbackJson.text || fallbackJson.chatResponse)) {
            data = {
              status: "success",
              chatResponse: fallbackJson.text || fallbackJson.chatResponse,
              model: fallbackJson.model || selectedModel,
              role: fallbackJson.role || activeChatbotRole,
              groundingMetadata: fallbackJson.groundingMetadata
            };
          }
        }
      } catch (fbErr) {
        console.warn('[Aetheris Gemini] Fallback note:', fbErr?.message || fbErr);
      }
    }

    // TIER 3: Local-AI Query Multi-Tier Pipeline
    if (!data) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          try { controller.abort(); } catch(e) {}
        }, 20000);
        const res = await fetch("/api/local-ai/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, history: clientChatHistory }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {}
    }

    // Remove typing indicator
    typingNode.remove();

    // Zero-failure fallback
    if (!data) {
      const cleanT = cleanQuery(text) || text;
      data = {
        status: "success",
        intent: "CHAT",
        chatResponse: `I received your message **"${escapeHtml(cleanT)}"**. I'm here to stream 4K movies, analyze cinema, research live data, or play lossless music and IPTV channels. How can I help?`,
        speechText: `Processing ${cleanT}.`,
        model: selectedModel,
        role: activeChatbotRole,
        data: {}
      };
    }

    // Check if media augmentation should be fetched to attach rich action cards
    const qLower = (text + ' ' + (data?.chatResponse || '')).toLowerCase();
    const needsMediaCard = (!data.intent || data.intent === 'CHAT') && !data.data?.movies && !data.data?.channels && !data.data?.youtubeVideos && !data.data?.musicTracks && !data.data?.sportsEvents;

    if (needsMediaCard) {
      // Extract bold entities from AI response (e.g. **Sony Sports Ten 1 HD**, **Inception**)
      const boldMatches = (data?.chatResponse || '').match(/\*\*([^*]+)\*\*/g);
      let candidateEntity = '';
      if (boldMatches && boldMatches.length > 0) {
        // Pick the most relevant bold entity that is not the bot's own name
        for (const bm of boldMatches) {
          const cleanBm = bm.replace(/\*\*/g, '').trim();
          if (!cleanBm.toLowerCase().includes('aetheris') && !cleanBm.toLowerCase().includes('quantum') && cleanBm.length > 2) {
            candidateEntity = cleanBm;
            break;
          }
        }
      }

      const isChannelOrSports = /sony|star sports|ten 1|ten 2|ten 3|ten 4|ten 5|sky sports|willow|bein|eurosport|dd sports|supersport|sports|cricket|football|f1|formula 1|wwe|raw|smackdown|ipl|channel|broadcast|match|stream/i.test(qLower);
      const isMovieOrTv = /movie|cinema|film|series|season|episode|watch|blockbuster|trailer|show/i.test(qLower);
      const isMusic = /music|song|track|album|artist|audio|320kbps|playlist|lossless/i.test(qLower);
      const isYouTube = /youtube|video|highlight|clip/i.test(qLower);

      const queryForAug = candidateEntity || text;

      if (isChannelOrSports || isMovieOrTv || isMusic || isYouTube) {
        try {
          const augRes = await fetch("/api/local-ai/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: queryForAug, history: clientChatHistory })
          });
          if (augRes.ok) {
            const augData = await augRes.json();
            if (augData && (augData.intent !== 'CHAT' || augData.data?.movies || augData.data?.channels || augData.data?.youtubeVideos || augData.data?.musicTracks || augData.data?.sportsEvents)) {
              data.intent = augData.intent !== 'CHAT' ? augData.intent : (isChannelOrSports ? 'PLAY_CHANNEL' : (isMusic ? 'PLAY_MUSIC' : 'PLAY_MOVIE'));
              data.target = augData.target || candidateEntity;
              data.data = augData.data || {};
              data.actions = augData.actions;
            }
          }
        } catch(e) {}

        // Fallback channel lookup if still empty but channel name detected
        if (isChannelOrSports && (!data.data?.channels || data.data.channels.length === 0)) {
          try {
            const chRes = await fetch(`/api/local-ai/channels?q=${encodeURIComponent(candidateEntity || text)}`);
            if (chRes.ok) {
              const chList = await chRes.json();
              if (chList && chList.length > 0) {
                if (!data.data) data.data = {};
                data.data.channels = chList;
                data.intent = 'PLAY_CHANNEL';
                data.target = candidateEntity || text;
              }
            }
          } catch(e) {}
        }
      }
    }

    // Push bot response to persistent conversation history
    if (data.chatResponse) {
      clientChatHistory.push({ role: 'assistant', content: data.chatResponse });
      try {
        localStorage.setItem('aetheris_gemini_history', JSON.stringify(clientChatHistory.slice(-20)));
      } catch(e) {}
    }

    await renderBotResponse(data, text);

    if (isSpeechSynthesisActive && data.speechText) {
      speakText(data.speechText);
    }
  }

  function scrollToBottom() {
    const stream = document.getElementById("ai-chat-stream");
    if (stream) stream.scrollTop = stream.scrollHeight;
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatMarkdown(str) {
    if (!str) return '';

    // 1. Extract triple-backtick code blocks before escaping
    const codeBlocks = [];
    let processed = str.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const token = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang.trim(), code });
      return token;
    });

    let html = escapeHtml(processed);
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="text-xs font-black text-cyan-300 uppercase tracking-wider mt-2.5 mb-1">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="text-sm font-black text-white uppercase tracking-wider mt-3 mb-1.5">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="text-base font-black text-amber-400 uppercase tracking-wide mt-3.5 mb-2">$1</h2>');

    // Bold & Italics
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="text-amber-300 font-extrabold"><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="text-cyan-200">$1</em>');

    // Inline code
    html = html.replace(/`([^\`]+)`/g, '<code class="bg-black/60 text-emerald-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-white/10">$1</code>');

    // Bullet points & numbered lists
    html = html.replace(/^[\*\-] (.*$)/gim, '<div class="flex items-start gap-1.5 my-1 ml-1"><span class="text-cyan-400 font-bold shrink-0">&bull;</span><span>$1</span></div>');
    html = html.replace(/^\d+\. (.*$)/gim, '<div class="flex items-start gap-1.5 my-1 ml-1"><span class="text-amber-400 font-mono text-[10px] font-bold shrink-0">&bull;</span><span>$1</span></div>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-cyan-400/80 pl-2.5 my-1.5 text-zinc-400 italic">$1</blockquote>');

    // Horizontal divider
    html = html.replace(/---/g, '<div class="my-2.5 border-t border-white/10"></div>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');
    html = html.replace(/(<br\/>\s*){3,}/g, '<br/><br/>');

    // Restore formatted code blocks
    codeBlocks.forEach((block, idx) => {
      const codeHtml = `<pre class="my-2.5 p-3 bg-zinc-950 border border-white/10 rounded-xl overflow-x-auto text-[11px] font-mono text-emerald-300 shadow-inner"><div class="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 font-sans font-bold flex justify-between"><span>${escapeHtml(block.lang || 'code')}</span><span>Gemini</span></div><code>${escapeHtml(block.code)}</code></pre>`;
      html = html.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
    });

    return html;
  }

    // ----------------------------------------------------
  // Dynamic Bot Widget Renderers
  // ----------------------------------------------------
  async function renderBotResponse(data, userQuery) {
    const chatStream = document.getElementById("ai-chat-stream");
    if (!chatStream) return;

    const botNode = document.createElement("div");
    botNode.className = "ai-msg-bubble ai-msg-bot";

    let widgetHtml = "";

    // 1. YOUTUBE VIDEO IN-CHAT PLAYER & DOWNLOAD
    if (data.intent === "PLAY_YOUTUBE" || (data.data?.youtubeVideos && data.data.youtubeVideos.length > 0)) {
      if (!data.data?.youtubeVideos || data.data.youtubeVideos.length === 0) {
        try {
          const ytQ = data.target || userQuery || 'YouTube';
          const ytRes = await fetch(`/api/local-ai/youtube-search?q=${encodeURIComponent(ytQ)}`);
          if (ytRes.ok) {
            const ytJson = await ytRes.json();
            if (ytJson.videos && ytJson.videos.length > 0) {
              if (!data.data) data.data = {};
              data.data.youtubeVideos = ytJson.videos;
            }
          }
        } catch(e) {}
      }
      widgetHtml = buildYouTubeCard(data);
    }
    // 2. LOSSLESS MUSIC IN-CHAT PLAYER & 320kbps MP3 DOWNLOAD
    else if (data.intent === "PLAY_MUSIC" || (data.data?.musicTracks && data.data.musicTracks.length > 0)) {
      widgetHtml = buildMusicCard(data);
    }
    // 3. LIVE SPORTS EVENT & BROADCASTER CHANNELS
    else if (data.intent === "PLAY_SPORTS_EVENT" || (data.data?.sportsEvents && data.data.sportsEvents.length > 0) || (data.data?.sportsChannels && data.data.sportsChannels.length > 0)) {
      widgetHtml = buildSportsEventsCard(data);
    }
    // 4. LIVE SCORES WIDGET
    else if (data.intent === "LIVE_SCORES" || data.data?.liveScores) {
      widgetHtml = buildLiveScoresCard(data);
    }
    // 5. WEATHER REPORT WIDGET
    else if (data.intent === "WEATHER_REPORT" || data.data?.weather) {
      widgetHtml = buildWeatherCard(data);
    }
    // 6. NEWS HEADLINES WIDGET
    else if (data.intent === "NEWS_HEADLINES" || data.data?.news) {
      widgetHtml = buildNewsCard(data);
    }
    // 7. MOVIE / TV SHOW INTENT (PLAY or GET_INFO)
    else if (data.intent === "ADMIN_SWITCH_MODEL") {
      widgetHtml = `<div class="p-4 bg-emerald-900/40 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-black uppercase tracking-widest"><i data-lucide="cpu" class="w-4 h-4 inline-block mr-2"></i> Model provider switched successfully to requested node.</div>`;
    }
    else if (data.intent === "ADMIN_OPEN_GRID") {
      widgetHtml = `<div class="p-4 bg-blue-900/40 border border-blue-500/30 rounded-2xl text-blue-300 text-xs font-black uppercase tracking-widest"><i data-lucide="layout-grid" class="w-4 h-4 inline-block mr-2"></i> Secure Grid Unlocked & Opened.</div>`;
      if (typeof fetchChannels === 'function') {
         setTimeout(() => fetchChannels(), 500);
      }
    }
    else if (data.intent === "PLAY_MOVIE" || data.intent === "PLAY_TV" || data.intent === "GET_INFO" || (data.data?.movies && data.data.movies.length > 0) || data.data?.movie) {
      widgetHtml = await buildMovieTvCard(data, userQuery);
      if (data.data?.subtitles?.length) {
        widgetHtml += buildSubtitlesCard(data);
      }
    }
    // 8. RECOMMENDATIONS
    else if (data.intent === "RECOMMENDATION") {
      widgetHtml = await buildRecommendationCarousel(data);
    }
    // 9. LIVE TV & SPORTS CHANNELS (5,200+ IPTV)
    else if (data.intent === "PLAY_CHANNEL" || (data.data?.channels && data.data.channels.length > 0)) {
      widgetHtml = await buildChannelsCard(data);
    }
    // 10. BOOKS
    else if (data.intent === "READ_BOOK") {
      widgetHtml = buildBookCard(data);
    }
    // 11. NAVIGATION
    else if (data.intent === "NAVIGATE") {
      widgetHtml = buildNavCard(data);
    }
    


      // 13. PLAYLIST CREATION
    else if (data.intent === "CREATE_PLAYLIST") {
      widgetHtml = buildCreatePlaylistCard(data);
    }
    // 12. UNIFIED SEARCH ALL
    else if (data.intent === "SEARCH_ALL") {
      widgetHtml = buildSearchAllCard(data);
    }

    // Build Grounding Metadata UI if present
    let groundingHtml = "";
    if (data.groundingMetadata) {
      const searchQueries = data.groundingMetadata.webSearchQueries || [];
      const sources = data.groundingMetadata.groundingChunks || [];
      if (searchQueries.length || sources.length) {
        groundingHtml = `
          <div class="mt-2 pt-2 border-t border-white/5 space-y-1 text-[10px]">
            ${searchQueries.length ? `
              <div class="flex items-center gap-1.5 text-zinc-400">
                <span class="text-blue-400">🔍</span>
                <span>Web Search: <em>${escapeHtml(searchQueries.join(', '))}</em></span>
              </div>
            ` : ''}
            ${sources.length ? `
              <div class="flex flex-wrap items-center gap-1 pt-0.5">
                <span class="text-zinc-500 font-bold uppercase text-[9px] mr-1">Sources:</span>
                ${sources.slice(0, 4).map((chunk, idx) => {
                  const title = chunk.web?.title || `Source ${idx + 1}`;
                  const uri = chunk.web?.uri || '#';
                  return `<a href="${escapeHtml(uri)}" target="_blank" rel="noopener noreferrer" class="ai-grounding-chip inline-flex items-center gap-1 hover:underline truncate max-w-[200px]" title="${escapeHtml(title)}">🌐 ${escapeHtml(title)}</a>`;
                }).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    const modelName = (data.model || activeGeminiModel || 'gemini-3.5-flash').includes('pro') ? 'Gemini 3.1 Pro' : ((data.model || activeGeminiModel).includes('lite') ? 'Gemini 3.1 Flash Lite' : 'Gemini 3.5 Flash');
    const roleTag = (data.role || activeChatbotRole || 'copilot').replace('_', ' ');

    botNode.innerHTML = `
      <div class="ai-msg-avatar">
        <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="ai-msg-content space-y-2.5 w-full">
        <div class="flex items-center justify-between text-[10px] pb-1 border-b border-white/5">
          <span class="font-bold text-cyan-300 flex items-center gap-1">
            <span>✨</span>
            <span>${escapeHtml(modelName)}</span>
          </span>
          <span class="text-zinc-500 font-medium capitalize">${escapeHtml(roleTag)}</span>
        </div>
        <div class="text-xs text-zinc-200 leading-relaxed">${formatMarkdown(data.chatResponse || "")}</div>
        ${groundingHtml}
        ${widgetHtml}
      </div>
    `;

    chatStream.appendChild(botNode);
    if (window.MathJax) {
      try {
        window.MathJax.typesetPromise([botNode]);
      } catch (e) {}
    }
    scrollToBottom();
  }

  // 1. YouTube In-Chat Video Player & Download Card Builder
  
  window.openFullScreenYouTube = function(videoId) {
      let overlay = document.getElementById('yt-fullscreen-overlay');
      if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'yt-fullscreen-overlay';
          overlay.className = 'fixed inset-0 z-[2147483647] bg-black flex flex-col';
          document.body.appendChild(overlay);
      }
      
      overlay.innerHTML = `
          <div class="absolute top-4 right-4 z-50">
              <button onclick="document.getElementById('yt-fullscreen-overlay').style.display='none'; document.getElementById('yt-fullscreen-iframe').src=''" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-all backdrop-blur-md">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
          </div>
          <iframe 
            id="yt-fullscreen-iframe"
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&fs=1&modestbranding=1" 
            class="w-full h-full border-0 flex-1" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
      `;
      overlay.style.display = 'flex';
      
      // Stop underlying audio if playing
      if (typeof audio !== 'undefined' && audio && typeof audio.pause === 'function') {
          audio.pause();
      }
      if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
          ytPlayer.pauseVideo();
      }
  };

  function buildYouTubeCard(data) {
    const videos = data.data?.youtubeVideos || [];
    if (!videos.length) return '';

    const topVid = videos[0];
    const otherVids = videos.slice(1, 4);

    return `
      <div class="ai-card space-y-3 p-3.5 bg-black/80 border border-red-500/40 rounded-2xl shadow-2xl">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span> 🎬 YOUTUBE 4K CINEMA PLAYER
          </span>
          <span class="text-[9px] text-zinc-400 font-mono">1080p MP4 / 320k MP3</span>
        </div>

        <!-- In-Chat Responsive YouTube Player Frame -->
        <div class="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/15 shadow-inner">
          <iframe 
            src="${topVid.embedUrl || 'https://www.youtube-nocookie.com/embed/' + topVid.id + '?autoplay=1'}" 
            class="w-full h-full border-0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>

        <!-- Video Title & Author -->
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="truncate flex-1 min-w-0">
            <h4 class="text-xs font-black text-white truncate">${topVid.title}</h4>
            <p class="text-[10px] text-zinc-400 truncate">${topVid.uploader || 'YouTube Video'}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="openFullScreenYouTube('${topVid.id}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase rounded-xl flex items-center gap-1 shadow-lg transition-transform active:scale-95">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
              <span>FULLSCREEN</span>
            </button>
            <a href="${topVid.downloadAudioUrl || '/api/v1/youtube/stream?v=' + topVid.id + '&type=mp3'}" download class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white border border-white/20 font-black text-[10px] uppercase rounded-xl flex items-center gap-1 transition-all">
              <span>⬇️ MP3</span>
            </a>
          </div>
        </div>

        ${otherVids.length > 0 ? `
          <div class="pt-2 border-t border-white/10 space-y-1.5">
            <span class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Related Videos:</span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              ${otherVids.map(v => `
                <button onclick="window.__AETHERIS_AI__.playYouTubeTrailer('', '${encodeURIComponent(v.title)}')" class="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 rounded-xl text-left flex items-center gap-2 transition-all group">
                  <img src="${v.thumbnail}" class="w-10 h-8 object-cover rounded-lg shrink-0 border border-white/10" />
                  <div class="truncate">
                    <div class="text-[10px] font-bold text-white group-hover:text-red-400 truncate">${v.title}</div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }


  // ----------------------------------------------------
  // Widget Builders
  // ----------------------------------------------------

    // 1. Live Sports Broadcaster & Scraper Card Builder
  function buildLiveScoresCard(data) {
    const scores = data.data?.liveScores || [];
    if (!scores || !scores.length) return '';
    return `
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span> ⚽ LIVE SPORTS SCORES & TELEMETRY
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
          ${scores.map(s => `
            <div class="p-3 bg-zinc-900/80 border border-white/10 rounded-2xl hover:border-amber-500/40 transition-all space-y-1.5">
              <div class="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                <span class="truncate max-w-[120px]">${escapeHtml(s.league || s.sport || 'Match')}</span>
                <span class="text-amber-400 font-black">${escapeHtml(s.status || 'LIVE')}</span>
              </div>
              <div class="text-xs font-extrabold text-white tracking-wide">${escapeHtml(s.match)}</div>
              <div class="text-sm font-black text-cyan-300 bg-black/40 py-1 px-2 rounded-lg border border-white/5 text-center">${escapeHtml(s.score)}</div>
              ${s.details ? `<div class="text-[10px] text-zinc-400 truncate">${escapeHtml(s.details)}</div>` : ''}
              ${s.playUrl ? `
                <a href="${s.playUrl}" class="mt-1 w-full py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black text-[11px] font-black rounded-xl text-center flex items-center justify-center gap-1 shadow-md">
                  ▶ Tune Broadcaster (${escapeHtml(s.channel || 'Live Stream')})
                </a>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function buildWeatherCard(data) {
    const w = data.data?.weather;
    if (!w) return '';
    return `
      <div class="p-4 bg-gradient-to-br from-blue-950/60 to-cyan-950/60 border border-cyan-500/30 rounded-2xl space-y-2 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-base font-black tracking-wide text-cyan-200">${escapeHtml(w.city)}, ${escapeHtml(w.country)}</h4>
            <p class="text-xs text-cyan-300/80 font-bold">${escapeHtml(w.condition)}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-white">${w.temperatureC}°C <span class="text-xs font-normal text-zinc-400">/ ${w.temperatureF}°F</span></div>
            <div class="text-[10px] text-zinc-400 font-bold">Updated: ${escapeHtml(w.time)}</div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-xs font-bold text-zinc-300 pt-1 border-t border-white/10">
          <span>💨 Wind: ${w.windSpeed} km/h</span>
        </div>
      </div>
    `;
  }

  function buildNewsCard(data) {
    const articles = data.data?.news || [];
    if (!articles || !articles.length) return '';
    return `
      <div class="space-y-2 pt-1">
        <div class="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span> 📰 BREAKING NEWS HEADLINES
        </div>
        <div class="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
          ${articles.map(a => `
            <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="block p-3 bg-zinc-900/80 border border-white/10 hover:border-red-500/40 rounded-2xl transition-all group">
              <div class="flex items-center justify-between text-[10px] text-zinc-400 font-bold mb-1">
                <span class="text-red-400 font-black">${escapeHtml(a.source)}</span>
                <span>${escapeHtml(a.publishedAt)}</span>
              </div>
              <div class="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">${escapeHtml(a.title)}</div>
              ${a.snippet ? `<div class="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-normal">${escapeHtml(a.snippet)}</div>` : ''}
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  function buildSubtitlesCard(data) {
    return ``;
  }
  function buildSportsEventsCard(data) {
    const events = data.data?.sportsEvents || [];
    const sportsChannels = data.data?.sportsChannels || [];
    const actions = (data.actions || []).filter(a => a.type === 'PLAY_CHANNEL');
    
    // Aggregate all target broadcaster channels
    const channelsToRender = [...actions, ...sportsChannels].filter((c, idx, self) => 
        idx === self.findIndex(t => (t.name === c.name || (t.url && t.url === c.url)))
    );

    if (!channelsToRender.length && !events.length) {
      return `
        <div class="ai-card p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-center">
          <p class="text-xs font-bold text-white">No active matches found. Browse 5,200+ Live IPTV channels below:</p>
          <a href="/consumet.html#sports" class="ai-btn-primary text-xs py-1.5 px-3 inline-block">Open Sports Arena Hub</a>
        </div>
      `;
    }

    let broadcasterHtml = "";
    if (channelsToRender.length > 0) {
      broadcasterHtml = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> 🔴 MATCH BROADCASTER CHANNELS (${channelsToRender.length})
            </span>
          </div>
          <div class="space-y-2">
            ${channelsToRender.slice(0, 4).map(ch => {
              const chName = ch.name || ch.title || ch.channel_name || 'Live Sports Broadcast';
              const chGenre = ch.genre || 'Live Sports Broadcast';
              const chLogo = ch.logo || '/stalker_pro_infinity.svg';
              const chStream = ch.streamUrl || ch.url || ch.playUrl || '';
              return `
              <div class="p-3 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black hover:border-emerald-500/50 border border-white/15 rounded-2xl transition-all space-y-2 shadow-xl">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <img src="${escapeHtml(chLogo)}" class="w-8 h-8 object-contain rounded-xl bg-black/60 p-1 border border-white/10 shrink-0" onerror="this.src='/stalker_pro_infinity.svg'" />
                    <div class="min-w-0 flex-1">
                      <h4 class="text-xs font-black text-white truncate leading-snug" title="${escapeHtml(chName)}">${escapeHtml(chName)}</h4>
                      <span class="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block truncate mt-0.5">${escapeHtml(chGenre)}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.__AETHERIS_AI__.tuneLiveChannel('${encodeURIComponent(chStream)}', '${encodeURIComponent(chName)}', '${encodeURIComponent(chLogo)}', true)" class="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/40 font-black text-[9px] uppercase rounded-xl flex items-center gap-1 transition-all" title="Stream directly via HLS.js engine">
                      <span>⚡ HLS</span>
                    </button>
                    <button onclick="window.__AETHERIS_AI__.tuneLiveChannel('${encodeURIComponent(chStream)}', '${encodeURIComponent(chName)}', '${encodeURIComponent(chLogo)}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1 shadow-lg transition-transform active:scale-95">
                      <span>Watch Live</span>
                      <svg class="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `}).join("")}
          </div>
        </div>
      `;
    }

    let eventsHtml = "";
    if (events.length > 0) {
      eventsHtml = `
        <div class="space-y-2 pt-2 border-t border-white/10">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span> SCHEDULED SATELLITE FIXTURES (${events.length})
            </span>
          </div>
          <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            ${events.slice(0, 4).map(evt => `
              <div class="p-2.5 bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 hover:border-amber-500/50 rounded-xl transition-all space-y-1.5 shadow-lg">
                <div class="flex items-center justify-between text-[9px] font-bold">
                  <span class="text-amber-400 uppercase tracking-wide bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">${evt.league || evt.sport || "Live Sports"}</span>
                  <span class="${evt.isLive ? 'text-emerald-400 font-black flex items-center gap-1' : 'text-zinc-400'}">
                    ${evt.isLive ? '● LIVE' : evt.time}
                  </span>
                </div>
                <h5 class="text-xs font-black text-white leading-tight">${evt.title}</h5>
                <div class="flex items-center justify-between pt-1 border-t border-white/10">
                  <span class="text-[10px] text-zinc-400 truncate max-w-[50%] flex items-center gap-1">
                    <span class="text-zinc-500">Feed:</span> ${evt.channelName || "Satellite Feed"}
                  </span>
                  <button onclick="window.__AETHERIS_AI__.tuneLiveChannel('${encodeURIComponent(evt.channelUrl || evt.playUrl)}', '${encodeURIComponent(evt.title)}', '')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md transition-transform active:scale-95">
                    <span>Watch Feed</span>
                    <svg class="w-3 h-3 fill-black" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="ai-card space-y-3 p-3 bg-black/60 border border-white/15 rounded-2xl">
        ${broadcasterHtml}
        ${eventsHtml}
      </div>
    `;
  }

  // 2. Movie / TV Show Card Builder with Info.html Redirection & Bingr Integration
  async function buildMovieTvCard(data, userQuery = "") {
    let rawQ = data.params?.title || data.target || data.targetQuery || data.title || data.query;
    if (!rawQ && userQuery) {
      rawQ = cleanQuery(userQuery);
    }
    const query = cleanQuery(rawQ || '') || rawQ || '';
    const isTv = data.intent === "PLAY_TV" || data.params?.mediaType === "tv" || data.data?.media?.media_type === "tv";
    const season = data.params?.season || data.data?.media?.season || 1;
    const episode = data.params?.episode || data.data?.media?.episode || 1;

    let media = data.data?.media || (data.data?.movies && data.data.movies.length > 0 ? data.data.movies[0] : null);

    // 1. Search via local backend search endpoint
    if (!media && query) {
      try {
        const localRes = await fetch(`/api/local-ai/search-media?q=${encodeURIComponent(query)}&type=${isTv ? 'tv' : 'multi'}`);
        const localJson = await localRes.json();
        if (localJson?.results?.length > 0) {
          media = localJson.results[0];
        }
      } catch (e) {}
    }

    // 2. Fallback search via Bingr Gateway
    if (!media && query) {
      try {
        const bingrRes = await fetch(`/api/bingr/search?q=${encodeURIComponent(query)}`);
        const bingrJson = await bingrRes.json();
        if (bingrJson?.results?.length > 0) {
          media = bingrJson.results[0];
        }
      } catch (e) {}
    }

    // 3. Fallback search direct TMDB
    if (!media && query) {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
        const tmdbData = await res.json();
        if (tmdbData?.results?.length > 0) {
          media = tmdbData.results.find(m => isTv ? m.media_type === "tv" : true) || tmdbData.results[0];
        }
      } catch (e) {}
    }

    if (!media) {
      return `
        <div class="ai-card p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-center">
          <p class="text-xs font-bold text-white">No exact title match for "${escapeHtml(query || 'your movie request')}".</p>
          <div class="flex justify-center gap-2">
            <a href="/consumet.html#movies?search=${encodeURIComponent(query)}" class="ai-btn-secondary text-[11px] py-1.5 px-3">Search Movies Hub</a>
            <a href="/info.html?q=${encodeURIComponent(query)}" class="ai-btn-primary text-[11px] py-1.5 px-3">Open Info Search</a>
          </div>
        </div>
      `;
    }

    const id = media.id || media.tmdbId || 99999;
    const title = media.title || media.name || query;
    const type = media.media_type || (media.name ? "tv" : (isTv ? "tv" : "movie"));
    const poster = media.poster || (media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500");
    const rating = media.rating || (media.vote_average ? Number(media.vote_average).toFixed(1) : "8.2");
    const year = media.year || (media.release_date || media.first_air_date || "").substring(0, 4) || "2024";
    const overview = media.overview || `High-definition 4K cinematic stream of ${title} ready with multiple instant servers.`;
    const cardId = "card-" + Math.random().toString(36).substr(2, 9);

    return `
      <div id="${cardId}" class="ai-card space-y-3 p-3.5 bg-black/60 border border-white/15 rounded-2xl shadow-2xl">
        <div class="flex gap-3">
          <img src="${poster}" class="w-20 h-28 object-cover rounded-xl border border-white/15 shadow-xl flex-shrink-0" alt="${escapeHtml(title)}" />
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 bg-red-600 text-white font-black text-[9px] rounded uppercase tracking-wider">${type.toUpperCase()}</span>
              <span class="text-xs font-bold text-amber-400 flex items-center gap-0.5">★ ${rating}</span>
              <span class="text-[11px] text-zinc-400 font-bold">${year}</span>
              ${type === 'tv' ? `<span class="px-1.5 py-0.5 bg-indigo-600/40 text-indigo-300 font-bold text-[9px] rounded border border-indigo-500/30">S${season} E${episode}</span>` : ""}
            </div>
            <h4 class="text-xs font-black text-white leading-tight line-clamp-1">${escapeHtml(title)}</h4>
            <p class="text-[10px] text-zinc-300 line-clamp-2 leading-relaxed">${escapeHtml(overview)}</p>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <button onclick="window.__AETHERIS_AI__.launchCinemaPlayer('${id}', '${type}', ${season}, ${episode}, document.getElementById('srv-${cardId}')?.value || 'vidsrc')" class="ai-btn-primary text-xs py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <span>Play Cinema (4K)</span>
          </button>
          
          <a href="/api/bingr/play?type=${type === 'tv' || type === 'series' ? 'tv' : 'movie'}&id=${id}&title=${encodeURIComponent(title)}&year=${year || ''}&season=${season}&episode=${episode}&mode=player" class="ai-btn-primary text-xs py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 border border-indigo-500/50">
            <span class="text-[14px]">🔥</span>
            <span>Play Bing</span>
          </a>

          <a href="/info.html?id=${id}&type=${type}&s=${season}&e=${episode}" class="ai-btn-secondary text-xs py-1.5 px-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold rounded-xl flex items-center gap-1 transition-all">
            <span>ℹ️ Movie Info & Cast</span>
          </a>

          <select id="srv-${cardId}" class="bg-black/80 border border-white/15 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 outline-none">
            <option value="hls">⚡ Direct HLS (Hls.js)</option>
            <option value="vidsrc">VidSrc 4K</option>
            <option value="superembed">SuperEmbed</option>
            <option value="vidlink">VidLink Pro</option>
            <option value="twoembed">2Embed</option>
            <option value="vidrift">VidRift</option>
            <option value="cinezo">Cinezo</option>
            <option value="vidbinge">VidBinge</option>
            <option value="torrent">4K Torrentio</option>
          </select>
        </div>
      </div>
    `;
  }

  // 3. Recommendation Carousel Builder
  async function buildRecommendationCarousel(data) {
    const movies = data.data?.movies || [];
    if (!movies.length) {
      return `
        <div class="text-xs text-zinc-300">
          <a href="/consumet.html#movies" class="text-cyan-400 font-bold underline">Explore all trending 4K titles in Movies Hub</a>
        </div>
      `;
    }

    return `
      <div class="space-y-2">
        <div class="flex gap-2 overflow-x-auto pb-2">
          ${movies.slice(0, 6).map(m => `
            <div class="w-24 shrink-0 bg-white/5 border border-white/10 hover:border-cyan-500/50 rounded-xl p-1.5 space-y-1.5 transition-all text-center group">
              <a href="/info.html?id=${m.id}&type=${m.media_type || 'movie'}">
                <img src="${m.poster}" class="w-full h-28 object-cover rounded-lg group-hover:scale-105 transition-transform" />
              </a>
              <div class="text-[10px] font-bold text-white truncate">${m.title}</div>
              <a href="/info.html?id=${m.id}&type=${m.media_type || 'movie'}" class="block w-full py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded text-[9px] font-black uppercase transition-colors">
                Watch 4K
              </a>
              <a href="/api/bingr/play?type=${m.media_type === 'tv' || m.media_type === 'series' ? 'tv' : 'movie'}&title=${encodeURIComponent(m.title)}&mode=player" class="block w-full py-1 mt-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-black uppercase transition-colors">
                Play Bing
              </a>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // 4. Live Channels Card (Using play_consumet.php)
  async function buildChannelsCard(data) {
    let channels = data.data?.channels || [];
    
    if (!channels.length) {
      const q = data.target || data.targetQuery || data.query || "";
      if (q) {
        try {
          const res = await fetch(`/api/local-ai/channels?q=${encodeURIComponent(q)}`);
          const json = await res.json();
          if (json && Array.isArray(json)) {
            channels = json;
          }
        } catch (e) {}
      }
    }
    
    if (!channels.length) {
      return `
        <div class="ai-card p-3 bg-white/5 border border-white/10 rounded-xl text-center">
          <p class="text-xs font-bold text-white">Channel matching query not found in database.</p>
          <a href="/consumet.html#channels" class="text-xs text-cyan-400 underline font-bold mt-1 inline-block">Browse 5,200+ Live Channels</a>
        </div>
      `;
    }

    return `
      <div class="ai-card space-y-2.5 p-3.5 bg-black/70 border border-white/15 rounded-2xl shadow-xl">
        <div class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-between">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> 5,200+ LIVE IPTV MATCHES (${channels.length})
          </span>
          <span class="text-[9px] text-zinc-400 font-mono">HLS • ULTRA LOW LATENCY</span>
        </div>
        <div class="space-y-2">
          ${channels.slice(0, 6).map(ch => {
            const chName = ch.name || ch.title || ch.channel_name || 'Live Channel';
            const chGenre = ch.genre || ch.group || ch.category || 'Live TV';
            const chLogo = ch.logo || ch.icon || '/stalker_pro_infinity.svg';
            const chStream = ch.streamUrl || ch.stream_url || ch.url || ch.channel_id || ch.playUrl || '';
            return `
            <div class="p-2.5 bg-zinc-950/80 hover:bg-zinc-900/90 border border-white/10 hover:border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 transition-all">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <img src="${escapeHtml(chLogo)}" class="w-8 h-8 object-contain rounded-lg bg-black/60 p-0.5 border border-white/10 shrink-0" onerror="this.src='/stalker_pro_infinity.svg'" />
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white truncate leading-snug" title="${escapeHtml(chName)}">${escapeHtml(chName)}</div>
                  <div class="text-[10px] text-emerald-400 font-medium truncate mt-0.5">${escapeHtml(chGenre)}</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="window.__AETHERIS_AI__.tuneLiveChannel('${encodeURIComponent(chStream)}', '${encodeURIComponent(chName)}', '${encodeURIComponent(chLogo)}', true)" class="px-2 py-1.5 bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/30 font-bold text-[10px] uppercase rounded-lg flex items-center gap-1 transition-all" title="Stream directly via HLS.js engine">
                  <span>⚡ HLS</span>
                </button>
                <button onclick="window.__AETHERIS_AI__.tuneLiveChannel('${encodeURIComponent(chStream)}', '${encodeURIComponent(chName)}', '${encodeURIComponent(chLogo)}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-md transition-transform active:scale-95">
                  <span>PLAY</span>
                  <svg class="w-3 h-3 fill-black" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </div>
            </div>
          `}).join("")}
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // Lossless Music Audio Player & Downloader
  // ----------------------------------------------------
  function buildMusicCard(data) {
    const tracks = data.data?.musicTracks || [];
    if (!tracks.length) {
      return `
        <div class="ai-card p-3 bg-white/5 border border-white/10 rounded-2xl text-center space-y-2">
          <p class="text-xs font-bold text-white">Audio stream ready in Quantum Music Matrix.</p>
          <a href="/music.html?q=${encodeURIComponent(data.targetQuery || '')}" class="ai-btn-primary text-xs py-1.5 px-3 inline-block">Open Music Hub</a>
        </div>
      `;
    }

    return `
      <div class="ai-card space-y-3 p-3.5 bg-black/85 border border-violet-500/40 rounded-2xl shadow-2xl">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse"></span> 🎵 LOSSLESS AUDIO STREAMER (${tracks.length})
          </span>
          <div class="flex items-center gap-2">
            <a href="/music.html?q=${encodeURIComponent(data.targetQuery || (tracks[0] ? tracks[0].title : ''))}" class="text-[9px] font-bold text-violet-400 hover:text-white underline">Open Music Studio ↗</a>
            <span class="text-[9px] text-zinc-400 font-mono">320kbps</span>
          </div>
        </div>
        <div class="space-y-2.5">
          ${tracks.slice(0, 4).map((t, idx) => `
            <div class="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 rounded-xl space-y-2 transition-all">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 truncate flex-1">
                  <img src="${t.artwork}" class="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0" onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150'" />
                  <div class="truncate">
                    <h5 class="text-xs font-black text-white truncate">${t.title}</h5>
                    <p class="text-[10px] text-violet-300 font-medium truncate">${t.artist}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <a href="${t.downloadUrl}" download class="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shadow-lg transition-transform active:scale-95" title="Download 320kbps MP3">
                    ⬇️ MP3 (320k)
                  </a>
                </div>
              </div>
              <!-- Native Embedded HTML5 Audio Controls -->
              <audio controls class="w-full h-8 accent-violet-500 outline-none" preload="none" src="${t.streamUrl}"></audio>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 6. Book Card Builder
  function buildBookCard(data) {
    const q = data.params?.query || "Classic Literature";
    return `
      <div class="ai-card p-3 bg-black/60 border border-white/15 rounded-2xl flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <div>
            <h5 class="text-xs font-bold text-white">Codex Digital Library</h5>
            <p class="text-[10px] text-zinc-400">Reading reader ready for "${q}"</p>
          </div>
        </div>
        <a href="/books.html?search=${encodeURIComponent(q)}" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase transition-all">
          Read Book
        </a>
      </div>
    `;
  }

  // 7. Navigation Card Builder
  function buildNavCard(data) {
    const dest = data.params?.destination || { name: "Home", url: "/consumet.html" };
    return `
      <div class="ai-card p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
        <div>
          <h5 class="text-xs font-bold text-white">Destination: ${dest.name}</h5>
          <p class="text-[10px] text-zinc-400">${dest.url}</p>
        </div>
        <a href="${dest.url}" class="px-3 py-1.5 bg-cyan-500 text-black font-black text-xs rounded-xl transition-all">
          Go Now
        </a>
      </div>
    `;
  }


  // 13. Create Playlist Card
  function buildCreatePlaylistCard(data) {
    const tracks = data.data?.playlistTracks || [];
    const name = data.data?.playlistName || 'My Mixtape';
    if (!tracks.length) {
      return `
        <div class="ai-card p-3 bg-white/5 border border-white/10 rounded-2xl text-center space-y-2">
          <p class="text-xs font-bold text-white">Could not find tracks for playlist.</p>
        </div>
      `;
    }
    
    // Add global function to load this playlist to deck
    window.loadAiPlaylistToDeck = function() {
        if (typeof window.activePlaybackQueue !== 'undefined') {
            window.activePlaybackQueue = JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(tracks))}'));
            if (typeof window.currentQueueIndex !== 'undefined') window.currentQueueIndex = 0;
            if (typeof window.loadAndPlayTrack === 'function') {
                window.loadAndPlayTrack(window.activePlaybackQueue[0]);
                if (typeof window.showStatusNotification === 'function') {
                    window.showStatusNotification('Loaded AI Playlist: ' + name);
                } else if (typeof window.showDeckNotification === 'function') {
                    window.showDeckNotification('Loaded AI Playlist: ' + name, 'success');
                }
            } else {
                window.location.href = '/music.html';
            }
        } else {
            window.location.href = '/music.html';
        }
    };

    return `
      <div class="ai-card space-y-3 p-3.5 bg-black/85 border border-pink-500/40 rounded-2xl shadow-2xl">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse"></span> 🎵 AI GENERATED PLAYLIST
          </span>
          <div class="flex items-center gap-2">
             <button onclick="loadAiPlaylistToDeck()" class="text-[9px] font-bold text-white bg-pink-600 hover:bg-pink-500 px-2 py-1 rounded shadow-lg transition-transform active:scale-95">PLAY ALL</button>
             <button onclick="if(typeof downloadQueueAsZip === 'function') { loadAiPlaylistToDeck(); setTimeout(downloadQueueAsZip, 500); } else { window.location.href='/music.html'; }" class="text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded shadow-lg transition-transform active:scale-95">ZIP DOWNLOAD</button>
          </div>
        </div>
        <h4 class="text-white font-bold text-sm truncate">${name}</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          ${tracks.map((t, idx) => `
            <div class="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <img src="${t.artwork}" class="w-8 h-8 object-cover rounded border border-white/10 shrink-0" onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150'" />
              <div class="truncate flex-1">
                <h5 class="text-xs font-black text-white truncate">${t.title}</h5>
                <p class="text-[10px] text-pink-300 font-medium truncate">${t.artist}</p>
              </div>
              <a href="${t.downloadUrl}" download class="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors" title="Download Single">
                 ⬇️
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }


  // 8. Search All Fallback
  function buildSearchAllCard(data) {
    const q = data.targetQuery || data.query || "";
    return `
      <div class="grid grid-cols-2 gap-2 pt-1">
        <a href="/info.html?q=${encodeURIComponent(q)}" class="p-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 rounded-xl text-center transition-all">
          <span class="text-xs font-bold text-white block">🎬 Movie Info & Stream</span>
          <span class="text-[9px] text-cyan-300">Search TMDB & 4K</span>
        </a>
        <a href="/consumet.html#sports" class="p-2 bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 rounded-xl text-center transition-all">
          <span class="text-xs font-bold text-white block">🏆 Sports Arena</span>
          <span class="text-[9px] text-amber-300">Live matches today</span>
        </a>
      </div>
    `;
  }

  // ----------------------------------------------------
  // Global Window API & Inbuilt Container Handlers
  // ----------------------------------------------------
  let aiAudioCtx = null, aiEqBass = null, aiEqMid = null, aiEqTreble = null, aiSourceNode = null;

  function initAiAudioNodes(audioEl) {
    if (aiAudioCtx || !audioEl) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      aiAudioCtx = new AudioCtx();
      aiSourceNode = aiAudioCtx.createMediaElementSource(audioEl);

      aiEqBass = aiAudioCtx.createBiquadFilter();
      aiEqBass.type = 'lowshelf';
      aiEqBass.frequency.value = 60;

      aiEqMid = aiAudioCtx.createBiquadFilter();
      aiEqMid.type = 'peaking';
      aiEqMid.frequency.value = 1000;
      aiEqMid.Q.value = 1;

      aiEqTreble = aiAudioCtx.createBiquadFilter();
      aiEqTreble.type = 'highshelf';
      aiEqTreble.frequency.value = 10000;

      aiSourceNode.connect(aiEqBass);
      aiEqBass.connect(aiEqMid);
      aiEqMid.connect(aiEqTreble);
      aiEqTreble.connect(aiAudioCtx.destination);
    } catch(e) {
      console.warn('[AI Audio EQ Context Init Error]:', e);
    }
  }

  window.__AETHERIS_AI__ = {
    open: openAIModal,
    close: closeAIModal,
    toggle: toggleAIModal,
    openModal: openAIModal,
    closeModal: closeAIModal,
    toggleModal: toggleAIModal,
    switchTab: (tabName) => {
      const views = { chat: 'ai-view-chat', youtube: 'ai-view-youtube', music: 'ai-view-music' };
      const tabs = { chat: 'ai-tab-chat', youtube: 'ai-tab-youtube', music: 'ai-tab-music' };

      Object.keys(views).forEach(k => {
        const v = document.getElementById(views[k]);
        const t = document.getElementById(tabs[k]);
        if (v && t) {
          if (k === tabName) {
            v.classList.remove('hidden');
            t.className = 'flex-1 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-lg';
          } else {
            v.classList.add('hidden');
            t.className = 'flex-1 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-white/10 uppercase transition-all';
          }
        }
      });
    },
    searchYouTubeInbuilt: async (customQuery) => {
      const input = document.getElementById('ai-yt-search-input');
      const q = customQuery || (input ? input.value.trim() : '4K Trailers');
      if (!q) return;

      const grid = document.getElementById('ai-yt-results-grid');
      if (grid) grid.innerHTML = `<div class="col-span-2 text-center py-4 text-xs font-bold text-red-400 animate-pulse">Searching YouTube 4K Network for "${escapeHtml(q)}"...</div>`;

      try {
        let vids = [];
        try {
          const directRes = await fetch(`/api/local-ai/youtube-search?q=${encodeURIComponent(q)}`);
          if (directRes.ok) {
            const dJson = await directRes.json();
            vids = dJson.videos || [];
          }
        } catch(err) {}

        if (!vids.length) {
          const res = await fetch(`/api/local-ai/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `search youtube ${q}`, history: [] })
          });
          const data = await res.json();
          vids = data.data?.youtubeVideos || [];
        }

        if (grid) {
          if (!vids.length) {
            grid.innerHTML = `<div class="col-span-2 text-center py-4 text-xs text-zinc-400">No videos found. Try another query.</div>`;
            return;
          }

          // Auto-load top video in player
          const top = vids[0];
          window.__AETHERIS_AI__.playYouTubeTrackInbuilt(top.id, top.title, top.uploader);

          grid.innerHTML = vids.map(v => `
            <div class="p-2 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-red-500/50 rounded-xl space-y-1.5 transition-all">
              <div class="relative aspect-video rounded-lg overflow-hidden bg-black group cursor-pointer" onclick="window.__AETHERIS_AI__.playYouTubeTrackInbuilt('${v.id}', '${escapeHtml(v.title)}', '${escapeHtml(v.uploader)}')">
                <img src="${v.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black shadow-xl">▶</span>
                </div>
              </div>
              <div class="truncate">
                <h5 class="text-[11px] font-bold text-white truncate leading-tight">${escapeHtml(v.title)}</h5>
                <p class="text-[9px] text-zinc-400 truncate">${escapeHtml(v.uploader || 'YouTube Creator')}</p>
              </div>
              <div class="flex items-center gap-1 pt-1">
                <button onclick="window.__AETHERIS_AI__.playYouTubeTrackInbuilt('${v.id}', '${escapeHtml(v.title)}', '${escapeHtml(v.uploader)}')" class="flex-1 py-1 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white font-black text-[9px] uppercase rounded-lg">Play</button>
                <a href="/api/v1/youtube/stream?v=${v.id}&type=mp4&quality=1080" download class="px-2 py-1 bg-white/10 hover:bg-white/20 text-zinc-200 text-[9px] font-bold rounded-lg">MP4</a>
                <a href="/api/v1/youtube/stream?v=${v.id}&type=mp3" download class="px-2 py-1 bg-white/10 hover:bg-white/20 text-zinc-200 text-[9px] font-bold rounded-lg">MP3</a>
              </div>
            </div>
          `).join('');
        }
      } catch (e) {
        if (grid) grid.innerHTML = `<div class="col-span-2 text-center py-4 text-xs text-rose-400">Error connecting to YouTube network.</div>`;
      }
    },
    playYouTubeTrackInbuilt: (id, title, uploader) => {
      const iframe = document.getElementById('ai-yt-iframe');
      const titleEl = document.getElementById('ai-yt-active-title');
      const uploaderEl = document.getElementById('ai-yt-active-uploader');
      const dlMp4 = document.getElementById('ai-yt-dl-mp4');
      const dlMp3 = document.getElementById('ai-yt-dl-mp3');

      if (iframe) iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&rel=0`;
      if (titleEl) titleEl.textContent = title;
      if (uploaderEl) uploaderEl.textContent = uploader || 'YouTube Creator';
      if (dlMp4) dlMp4.href = `/api/v1/youtube/stream?v=${id}&type=mp4&quality=1080`;
      if (dlMp3) dlMp3.href = `/api/v1/youtube/stream?v=${id}&type=mp3`;
    },
    searchMusicInbuilt: async (customQuery) => {
      const input = document.getElementById('ai-music-search-input');
      const q = customQuery || (input ? input.value.trim() : 'Top Hits');
      if (!q) return;

      const grid = document.getElementById('ai-music-results-grid');
      if (grid) grid.innerHTML = `<div class="text-center py-4 text-xs font-bold text-violet-400 animate-pulse">Searching 100M+ Lossless Audio Network for "${escapeHtml(q)}"...</div>`;

      try {
        const res = await fetch(`/api/local-ai/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `play song ${q}`, history: [] })
        });
        const data = await res.json();
        const tracks = data.data?.musicTracks || [];

        if (grid) {
          if (!tracks.length) {
            grid.innerHTML = `<div class="text-center py-4 text-xs text-zinc-400">No tracks found. Try searching another song.</div>`;
            return;
          }

          // Auto-load top track
          const top = tracks[0];
          window.__AETHERIS_AI__.playMusicTrackInbuilt(top.streamUrl, top.title, top.artist, top.artwork, top.downloadUrl);

          grid.innerHTML = tracks.map(t => `
            <div class="p-2.5 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-violet-500/50 rounded-xl flex items-center justify-between gap-3 transition-all">
              <div class="flex items-center gap-2.5 truncate flex-1">
                <img src="${t.artwork}" class="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0" />
                <div class="truncate">
                  <h5 class="text-xs font-bold text-white truncate leading-tight">${escapeHtml(t.title)}</h5>
                  <p class="text-[10px] text-zinc-400 truncate">${escapeHtml(t.artist)} ${t.album ? '• ' + escapeHtml(t.album) : ''}</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="window.__AETHERIS_AI__.playMusicTrackInbuilt('${escapeHtml(t.streamUrl)}', '${escapeHtml(t.title)}', '${escapeHtml(t.artist)}', '${escapeHtml(t.artwork)}', '${escapeHtml(t.downloadUrl)}')" class="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-black text-[10px] uppercase rounded-xl shadow-md transition-transform active:scale-95">
                  ▶ Play
                </button>
                <a href="${t.downloadUrl || t.streamUrl}" download class="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-200 text-[10px] font-bold rounded-xl">
                  ⬇️ MP3
                </a>
              </div>
            </div>
          `).join('');
        }
      } catch (e) {
        if (grid) grid.innerHTML = `<div class="text-center py-4 text-xs text-rose-400">Error fetching audio stream.</div>`;
      }
    },
    playMusicTrackInbuilt: (streamUrl, title, artist, artwork, downloadUrl) => {
      const audioEl = document.getElementById('ai-music-audio-el');
      const titleEl = document.getElementById('ai-music-active-title');
      const artistEl = document.getElementById('ai-music-active-artist');
      const imgEl = document.getElementById('ai-music-active-img');
      const dlBtn = document.getElementById('ai-music-dl-btn');
      const playToggle = document.getElementById('ai-music-play-toggle');

      if (titleEl) titleEl.textContent = title;
      if (artistEl) artistEl.textContent = artist || 'Artist';
      if (imgEl) imgEl.src = artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150';
      if (dlBtn) dlBtn.href = downloadUrl || streamUrl;

      if (audioEl) {
        initAiAudioNodes(audioEl);
        if (aiAudioCtx && aiAudioCtx.state === 'suspended') aiAudioCtx.resume();

        audioEl.src = streamUrl;
        audioEl.play().then(() => {
          if (playToggle) playToggle.textContent = '⏸';
        }).catch(() => {
          if (playToggle) playToggle.textContent = '▶';
        });

        audioEl.ontimeupdate = () => {
          const cur = audioEl.currentTime || 0;
          const dur = audioEl.duration || 1;
          const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

          const prog = document.getElementById('ai-music-progress');
          const curTime = document.getElementById('ai-music-cur-time');
          const durTime = document.getElementById('ai-music-dur-time');

          if (prog) prog.style.width = pct + '%';
          if (curTime) curTime.textContent = Math.floor(cur / 60) + ':' + Math.floor(cur % 60).toString().padStart(2, '0');
          if (durTime && !isNaN(dur)) durTime.textContent = Math.floor(dur / 60) + ':' + Math.floor(dur % 60).toString().padStart(2, '0');
        };

        audioEl.onended = () => {
          if (playToggle) playToggle.textContent = '▶';
        };
      }
    },
    toggleMusicPlay: () => {
      const audioEl = document.getElementById('ai-music-audio-el');
      const playToggle = document.getElementById('ai-music-play-toggle');
      if (!audioEl) return;
      if (audioEl.paused) {
        if (aiAudioCtx && aiAudioCtx.state === 'suspended') aiAudioCtx.resume();
        audioEl.play();
        if (playToggle) playToggle.textContent = '⏸';
      } else {
        audioEl.pause();
        if (playToggle) playToggle.textContent = '▶';
      }
    },
    seekMusicInbuilt: (e) => {
      const audioEl = document.getElementById('ai-music-audio-el');
      if (!audioEl || !audioEl.duration || !e || !e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      audioEl.currentTime = pct * audioEl.duration;
    },
    setMusicEqPreset: (preset) => {
      const bassInput = document.getElementById('ai-eq-bass');
      const midInput = document.getElementById('ai-eq-mid');
      const trebleInput = document.getElementById('ai-eq-treble');

      if (preset === 'bass') {
        if (bassInput) bassInput.value = 8;
        if (midInput) midInput.value = 0;
        if (trebleInput) trebleInput.value = 2;
      } else if (preset === 'vocal') {
        if (bassInput) bassInput.value = -2;
        if (midInput) midInput.value = 6;
        if (trebleInput) trebleInput.value = 4;
      } else {
        if (bassInput) bassInput.value = 0;
        if (midInput) midInput.value = 0;
        if (trebleInput) trebleInput.value = 0;
      }

      window.__AETHERIS_AI__.setMusicEqBand('bass', bassInput ? bassInput.value : 0);
      window.__AETHERIS_AI__.setMusicEqBand('mid', midInput ? midInput.value : 0);
      window.__AETHERIS_AI__.setMusicEqBand('treble', trebleInput ? trebleInput.value : 0);
    },
    setMusicEqBand: (band, val) => {
      const numVal = parseFloat(val) || 0;
      const label = document.getElementById(`ai-eq-${band}-val`);
      if (label) label.textContent = `${numVal > 0 ? '+' : ''}${numVal}dB`;

      if (band === 'bass' && aiEqBass) aiEqBass.gain.value = numVal;
      if (band === 'mid' && aiEqMid) aiEqMid.gain.value = numVal;
      if (band === 'treble' && aiEqTreble) aiEqTreble.gain.value = numVal;
    },
    sendPrompt: (prompt) => {
      openAIModal();
      const input = document.getElementById("ai-user-input");
      if (input) input.value = prompt;
      handleUserChatInput(prompt);
    },
    launchCinemaPlayer: (id, type = "movie", season = 1, episode = 1, server = "vidsrc") => {
      window.location.href = UrlGenerators.generateCinemaUrl(id, type, season, episode, server);
    },
    tuneLiveChannel: (streamUrl, name, logo, useHlsEngine = false) => {
      const decodedUrl = decodeURIComponent(streamUrl);
      const decodedName = decodeURIComponent(name || "Live Channel");
      const decodedLogo = decodeURIComponent(logo || "");
      window.location.href = UrlGenerators.generateChannelUrl(decodedUrl, decodedName, decodedLogo, !!useHlsEngine);
    },
    openInfoPage: (id, type = "movie") => {
      window.location.href = UrlGenerators.generateInfoUrl(id, type);
    },
    openYouTubeModal: (videoId, rawTitle) => {
      const title = decodeURIComponent(rawTitle || 'YouTube Video');
      let trailerModal = document.getElementById('ai-youtube-trailer-modal');
      if (!trailerModal) {
        trailerModal = document.createElement('div');
        trailerModal.id = 'ai-youtube-trailer-modal';
        trailerModal.className = 'fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4';
        trailerModal.style.zIndex = '2147483647';
        document.body.appendChild(trailerModal);
      }

      trailerModal.innerHTML = `
        <div class="relative w-full max-w-4xl bg-zinc-950 border border-white/20 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4">
          <div class="flex items-center justify-between pb-2 border-b border-white/10">
            <div class="flex items-center gap-2 truncate pr-2">
              <span class="w-3 h-3 rounded-full bg-red-600 animate-ping shrink-0"></span>
              <h3 class="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">${title}</h3>
            </div>
            <button onclick="document.getElementById('ai-youtube-trailer-modal').remove()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 text-white font-bold flex items-center justify-center transition-all shrink-0">✕</button>
          </div>
          <div class="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
            <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
          </div>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] text-zinc-400">Playing in 4K / HD via Quantum Player</span>
            <div class="flex items-center gap-2">
              <a href="/api/v1/youtube/stream?v=${videoId}&type=mp4&quality=1080" download class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase rounded-xl flex items-center gap-1 transition-all">
                ⬇️ Download MP4
              </a>
              <a href="/api/v1/youtube/stream?v=${videoId}&type=mp3" download class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-black text-[10px] uppercase rounded-xl flex items-center gap-1 transition-all">
                ⬇️ Download MP3
              </a>
            </div>
          </div>
        </div>
      `;
    },
    playYouTubeTrailer: async (tmdbId, query) => {
      try {
        const res = await fetch(`/api/youtube/trailer?tmdbId=${tmdbId || ''}&q=${encodeURIComponent(query || '')}`);
        const data = await res.json();
        if (data.youtubeKey) {
          window.__AETHERIS_AI__.openYouTubeModal(data.youtubeKey, query || 'Official Trailer');
        } else {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent((query || 'movie') + ' official trailer')}`, '_blank');
        }
      } catch (e) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent((query || 'movie') + ' official trailer')}`, '_blank');
      }
    }
  };

  // Auto-initialize once DOM is ready with multi-stage fallback
  function initAiSafe() {
    if (!document.getElementById("mathjax-script")) {
      const mj = document.createElement("script");
      mj.id = "mathjax-script";
      mj.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      mj.async = true;
      document.head.appendChild(mj);
    }
    
    if (document.body) {
      createAIChatWidget();
    } else {
      window.addEventListener('DOMContentLoaded', createAIChatWidget);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiSafe);
  } else {
    initAiSafe();
  }
  // Double-check after 500ms in case of dynamic SPA rendering
  setTimeout(initAiSafe, 500);

})();


// ============================================================
// TV REMOTE D-PAD + TOUCH NAVIGATION ENGINE
// ============================================================
(function initTVNavigation() {
    let focusables = [];
    let currentFocusIndex = -1;

    function getFocusables() {
        return Array.from(document.querySelectorAll(
            'button:not([disabled]):not(.ai-launcher-btn), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"]), .tv-focusable'
        )).filter(el => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r && r.width > 0 && r.height > 0 && el.offsetParent !== null;
        });
    }

    function focusIndex(idx) {
        focusables = getFocusables();
        if (!focusables.length) return;
        currentFocusIndex = Math.max(0, Math.min(idx, focusables.length - 1));
        const el = focusables[currentFocusIndex];
        el.focus({ preventScroll: false });
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    function findClosest(dir) {
        focusables = getFocusables();
        if (!focusables.length) return;
        const current = document.activeElement;
        let currentRect = current ? current.getBoundingClientRect() : null;
        
        if (!currentRect || !focusables.includes(current)) {
            focusIndex(0);
            return;
        }

        const cx = currentRect.left + currentRect.width / 2;
        const cy = currentRect.top + currentRect.height / 2;
        
        let best = null;
        let bestScore = Infinity;

        focusables.forEach((el, i) => {
            if (el === current) return;
            const r = el.getBoundingClientRect();
            const ex = r.left + r.width / 2;
            const ey = r.top + r.height / 2;
            const dx = ex - cx;
            const dy = ey - cy;

            let valid = false;
            if (dir === 'right' && dx > 10) valid = true;
            if (dir === 'left' && dx < -10) valid = true;
            if (dir === 'down' && dy > 10) valid = true;
            if (dir === 'up' && dy < -10) valid = true;

            if (!valid) return;

            // Score: primary direction wins, penalize perpendicular
            const primary = (dir === 'right' || dir === 'left') ? Math.abs(dx) : Math.abs(dy);
            const perp = (dir === 'right' || dir === 'left') ? Math.abs(dy) : Math.abs(dx);
            const score = primary + perp * 3;

            if (score < bestScore) {
                bestScore = score;
                best = { el, i };
            }
        });

        if (best) {
            currentFocusIndex = best.i;
            best.el.focus({ preventScroll: false });
            best.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    document.addEventListener('keydown', function(e) {
        // Skip if typing in input
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        switch(e.key) {
            case 'ArrowRight': e.preventDefault(); findClosest('right'); break;
            case 'ArrowLeft': e.preventDefault(); findClosest('left'); break;
            case 'ArrowDown': e.preventDefault(); findClosest('down'); break;
            case 'ArrowUp': e.preventDefault(); findClosest('up'); break;
            case 'Enter': case ' ':
                if (document.activeElement && document.activeElement !== document.body) {
                    if (e.key === 'Enter') document.activeElement.click();
                }
                break;
            case 'Backspace': case 'Escape':
                // Close any open modal or go back
                const closeBtn = document.querySelector('[id*="close"]:not(.hidden), .ai-header-btn[id*="close"]');
                if (closeBtn) { e.preventDefault(); closeBtn.click(); }
                break;
        }
    });

    // Touch swipe detection for mobile
    let touchStartX = 0, touchStartY = 0;
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    console.log('[TV Nav] D-pad navigation engine ready');
})();

