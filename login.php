<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AETHERIS | Quantum Handshake Nexus</title>
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
        * { -webkit-tap-highlight-color: transparent !important; }
        :root {
            font-family: 'Plus Jakarta Sans', sans-serif;
            --theme-color: #ef4444;
            --theme-glow: rgba(239, 68, 68, 0.15);
            --btn-bg: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
            --btn-shadow: rgba(239, 68, 68, 0.4);
        }
        .unlocked {
            --theme-color: #3b82f6;
            --theme-glow: rgba(59, 130, 246, 0.15);
            --btn-bg: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            --btn-shadow: rgba(37, 99, 235, 0.4);
        }
        body, html {
            background: #000000 !important;
            background-color: #000000 !important;
            min-height: 100vh;
            color: #ffffff;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        /* Premium Black Panels */
        .glass-panel {
            background: #000000;
            border: 1px solid #27272a;
        }
        .input-premium {
            background: #09090b;
            border: 1px solid #27272a;
            transition: all 0.2s ease;
        }
        .input-premium:focus {
            border-color: var(--theme-color);
            box-shadow: 0 0 0 4px var(--theme-glow);
            outline: none;
        }
        .btn-gradient {
            background: var(--btn-bg);
            box-shadow: 0 10px 20px -5px var(--btn-shadow);
        }
        /* Typography */
        .data-label {
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #64748b;
        }
        .status-badge {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #10b981;
        }
        /* Custom UI Components */
        .portal-scroll::-webkit-scrollbar {
            width: 5px;
        }
        .portal-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .portal-scroll::-webkit-scrollbar-thumb {
            background: #3b82f6;
            border-radius: 10px;
        }
        .animate-flicker {
            animation: flicker 2s linear infinite;
        }
        @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
</style>
    <link rel="icon" type="image/png" href="stalker_pro_infinity.svg">
</head>
<body class="p-4 md:p-10 unlocked">
    <!-- HANDSHAKE ENGINE UI -->
    <div id="engineUI" class="w-full">
        <div class="w-full flex flex-col items-center">
            <div id="toast-container" class="fixed top-6 right-6 z-[100] space-y-3"></div>
    <div id="portalModal" class="hidden fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
        <div class="glass-panel w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl p-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-black text-white flex items-center gap-3">
                    <i data-lucide="layers" class="text-red-500"></i> Portal Vault
                </h2>
                <div class="flex items-center gap-2">
                    <button onclick="startAddNewPortal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 hover:text-white text-red-400 text-xs font-bold transition-all border border-red-500/20">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add New
                    </button>
                    <button onclick="togglePortalModal(false)" class="text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="x-circle"></i>
                    </button>
                </div>
            </div>
            <div id="portalList" class="portal-scroll space-y-3 max-h-[400px] overflow-y-auto pr-2"></div>
            <button onclick="togglePortalModal(false)" class="w-full mt-6 py-4 rounded-2xl border border-white/10 text-slate-400 font-bold hover:bg-white/5 transition-all">
                Close Vault
            </button>
        </div>
    </div>
    <div id="login-container" class="glass-panel w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div class="p-8 pb-4 text-center">
            <div class="inline-flex p-3 rounded-2xl bg-red-500/10 text-red-400 mb-4">
                <i data-lucide="shield-check" class="w-8 h-8"></i>
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight text-white">Handshake Engine</h1>
            <p class="text-slate-400 text-sm mt-2 font-medium uppercase tracking-[0.2em]">Authorized Access Portal</p>
        </div>
        <form id="handshakeForm" class="p-8 pt-4 space-y-6" autocomplete="off">
            <!-- PORTAL TYPE TABS -->
            <div class="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 mb-6">
                <button type="button" onclick="setPortalType('stalker')" id="tab-stalker" class="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-red-600 text-white flex items-center justify-center gap-2">
                    <i data-lucide="server" class="w-3.5 h-3.5"></i> Stalker Portal
                </button>
                <button type="button" onclick="setPortalType('xtream')" id="tab-xtream" class="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-400 hover:text-white flex items-center justify-center gap-2">
                    <i data-lucide="shield" class="w-3.5 h-3.5"></i> Xtream Codes
                </button>
            </div>
            <input type="hidden" name="type" id="portalTypeInput" value="stalker">
            <!-- STALKER FIELDS CONTAINER -->
            <div id="stalkerFields" class="space-y-6">
                <div class="space-y-4 text-left">
                    <div class="relative">
                        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Portal URL <span class="text-red-500">*</span></label>
                        <input type="url" id="stalkerUrl" name="URL" required placeholder="http://example.com/c/" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                        <i data-lucide="globe" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="relative">
                            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">MAC Address <span class="text-red-500">*</span></label>
                            <input type="text" id="stalkerMac" name="MAC" required placeholder="00:1A:79:XX:XX:XX" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                            <i data-lucide="monitor" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                        </div>
                        <div class="relative">
                            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Serial Number (Optional)</label>
                            <input type="text" name="SN" placeholder="Enter Device SN" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                            <i data-lucide="fingerprint" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-900/30 rounded-3xl border border-white/5 text-left">
                    <div>
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Device ID 1</label>
                        <input type="text" name="D1" placeholder="Auto-generated if empty" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Device ID 2</label>
                        <input type="text" name="D2" placeholder="Auto-generated if empty" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Signature (SG)</label>
                        <input type="text" name="SG" placeholder="Optional" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-900/30 rounded-3xl border border-white/5 text-left">
                    <div>
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Software / Image Version</label>
                        <input type="text" name="image_version" placeholder="e.g. 218" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Token / Auth Token (Optional)</label>
                        <input type="text" name="Token" placeholder="Leave empty to auto-fetch" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                    <div class="md:col-span-2">
                        <label class="text-[10px] font-bold text-slate-600 uppercase">Custom User-Agent (Optional)</label>
                        <input type="text" name="user_agent" placeholder="Default MAG User-Agent" class="bg-transparent border-b border-slate-700 w-full p-2 text-sm focus:border-red-500 outline-none transition-colors text-white">
                    </div>
                </div>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <select name="Model" class="input-premium p-3 rounded-xl text-xs font-bold text-slate-300">
                        <option value="MAG250" selected>MAG250</option>
                        <option value="MAG254">MAG254</option>
                        <option value="MAG270">MAG270</option>
                        <option value="MAG322">MAG322</option>
                        <option value="MAG420">MAG420</option>
                    </select>
                    <select name="Proxy" class="input-premium p-3 rounded-xl text-xs font-bold text-slate-300">
                        <option value="AUTO" selected>PROXY: AUTO</option>
                        <option value="DIRECT">DIRECT</option>
                        <option value="PROXY">PROXY</option>
                    </select>
                    <select name="API" class="input-premium p-3 rounded-xl text-xs font-bold text-slate-300">
                        <option value="263" selected>API: 263</option>
                        <option value="262">262</option>
                    </select>
                    <select name="Share" class="input-premium p-3 rounded-xl text-xs font-bold text-slate-300">
                        <option value="OFF" selected>SHARING: OFF</option>
                        <option value="ON">ON</option>
                    </select>
                </div>
            </div>
            <!-- XTREAM FIELDS CONTAINER -->
            <div id="xtreamFields" class="hidden space-y-4 text-left">
                <div class="relative">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Xtream Portal URL <span class="text-red-500">*</span></label>
                    <input type="url" id="xtreamUrl" name="xtream_URL" placeholder="http://example.com:8080" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                    <i data-lucide="globe" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="relative">
                        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username <span class="text-red-500">*</span></label>
                        <input type="text" id="xtreamUser" name="username" placeholder="Enter Username" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                        <i data-lucide="user" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                    </div>
                    <div class="relative">
                        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password <span class="text-red-500">*</span></label>
                        <input type="password" id="xtreamPass" name="password" placeholder="Enter Password" class="input-premium w-full p-4 rounded-2xl mt-1 text-sm pl-11 text-white">
                        <i data-lucide="key-round" class="w-4 h-4 absolute left-4 top-[43px] text-slate-500"></i>
                    </div>
                </div>
            </div>
            <button type="submit" id="submitBtn" class="btn-gradient w-full py-5 rounded-[1.5rem] font-bold text-white text-lg flex items-center justify-center gap-3 transition-all">
                <i data-lucide="zap" class="w-6 h-6"></i>
                <span>Initialize Handshake</span>
            </button>
        </form>
        <div class="pb-8 text-center border-t border-white/5 pt-6">
            <button onclick="fetchSavedPortals()" class="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-white transition-all">
                <i data-lucide="archive" class="inline w-3 h-3 mr-1 mb-1"></i> Browse Saved Vault
            </button>
        </div>
    </div>
    <div id="successDisplay" class="hidden w-full max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-5">
        <div class="glass-panel rounded-[2.5rem] p-8">
            <div class="flex flex-col md:flex-row items-start justify-between gap-6 mb-10 pb-6 border-b border-white/5 text-left">
                <div class="flex items-center gap-5">
                    <div class="relative">
                        <div class="p-4 bg-emerald-500/20 rounded-3xl border border-emerald-500/30">
                            <i data-lucide="verified" class="w-8 h-8 text-emerald-400"></i>
                        </div>
                        <span class="absolute -top-1 -right-1 flex h-4 w-4">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-4 border-slate-900"></span>
                        </span>
                    </div>
                    <div>
                        <h2 class="text-white text-2xl font-black uppercase tracking-tight">Handshake Success</h2>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="status-badge px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter">Verified Link</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 w-full md:w-auto">
                    <button onclick="fetchSavedPortals()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 rounded-2xl text-xs font-bold transition-all border border-white/5">
                        <i data-lucide="layers" class="w-4 h-4"></i><span>Switch Vault</span>
                    </button>
                    <a href="index.php" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-2xl text-xs font-bold transition-all shadow-lg">
                        <i data-lucide="layout-grid" class="w-4 h-4"></i><span>Open Grid</span>
                    </a>
                </div>
            </div>
            <div id="resultsContent" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left"></div>
            <div class="mt-8 p-5 bg-black/30 rounded-3xl border border-white/5 flex flex-wrap gap-8 items-center justify-center">
                <div class="flex items-center gap-3 text-left">
                    <i data-lucide="server" class="w-4 h-4 text-slate-500"></i>
                    <div class="leading-none">
                        <p class="data-label mb-1">Portal URL</p>
                        <p id="portalUrl" class="text-[10px] font-bold text-slate-300"></p>
                    </div>
                </div>
                <div class="flex items-center gap-3 text-left">
                    <i data-lucide="hard-drive" class="w-4 h-4 text-slate-500"></i>
                    <div class="leading-none">
                        <p class="data-label mb-1">STB Version</p>
                        <p id="stbVersion" class="text-[10px] font-bold text-slate-300"></p>
                    </div>
                </div>
                <div class="flex items-center gap-3 text-left">
                    <i data-lucide="clock" class="w-4 h-4 text-slate-500"></i>
                    <div class="leading-none">
                        <p class="data-label mb-1">Handshake Date</p>
                        <p id="lastActive" class="text-[10px] font-bold text-slate-300"></p>
                    </div>
                </div>
            </div>
            <div class="mt-8 pt-8 border-t border-white/5 text-left">
                <h3 class="data-label text-red-400 mb-6 flex items-center gap-2"><i data-lucide="cpu" class="w-4 h-4"></i> Hardware Fingerprint</h3>
                <div id="metaGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8"></div>
            </div>
        </div>
        <button onclick="logoutAdmin()" class="mt-10 text-[10px] font-black text-slate-500 uppercase hover:text-rose-400 transition-colors flex items-center gap-2 mx-auto tracking-widest">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Exit Secure Session
        </button>
    </div>
    <script>
        lucide.createIcons();
        function setPortalType(type) {
            const portalTypeInput = document.getElementById('portalTypeInput');
            if (!portalTypeInput) return;
            portalTypeInput.value = type;
            const tabStalker = document.getElementById('tab-stalker');
            const tabXtream = document.getElementById('tab-xtream');
            const stalkerFields = document.getElementById('stalkerFields');
            const xtreamFields = document.getElementById('xtreamFields');
            const stalkerUrl = document.getElementById('stalkerUrl');
            const stalkerMac = document.getElementById('stalkerMac');
            const xtreamUrl = document.getElementById('xtreamUrl');
            const xtreamUser = document.getElementById('xtreamUser');
            const xtreamPass = document.getElementById('xtreamPass');
            if (type === 'stalker') {
                tabStalker.className = "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-red-600 text-white flex items-center justify-center gap-2";
                tabXtream.className = "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-400 hover:text-white flex items-center justify-center gap-2";
                stalkerFields.classList.remove('hidden');
                xtreamFields.classList.add('hidden');
                stalkerUrl.required = true;
                stalkerMac.required = true;
                xtreamUrl.required = false;
                xtreamUser.required = false;
                xtreamPass.required = false;
            } else {
                tabStalker.className = "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-400 hover:text-white flex items-center justify-center gap-2";
                tabXtream.className = "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-red-600 text-white flex items-center justify-center gap-2";
                stalkerFields.classList.add('hidden');
                xtreamFields.classList.remove('hidden');
                stalkerUrl.required = false;
                stalkerMac.required = false;
                xtreamUrl.required = true;
                xtreamUser.required = true;
                xtreamPass.required = true;
            }
        }
        const pushToast = (message, type = 'success') => {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const el = document.createElement('div');
            const styles = type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/50 text-rose-400 bg-rose-500/10';
            el.className = `p-4 px-6 rounded-2xl backdrop-blur-xl border ${styles} shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-full duration-300`;
            el.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i><span class="text-sm font-semibold">${message}</span>`;
            container.appendChild(el);
            lucide.createIcons();
            setTimeout(() => {
                el.classList.add('animate-out', 'fade-out', 'slide-out-to-right-full');
                setTimeout(() => el.remove(), 500);
            }, 4000);
        };
        function togglePortalModal(show) {
            document.getElementById('portalModal').classList.toggle('hidden', !show);
        }
        function logoutAdmin() {
            document.cookie = "admin_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.reload();
        }
        function startAddNewPortal() {
            togglePortalModal(false);
            const form = document.getElementById('handshakeForm');
            if (form) {
                const stalkerUrl = document.getElementById('stalkerUrl');
                const stalkerMac = document.getElementById('stalkerMac');
                const xtreamUrl = document.getElementById('xtreamUrl');
                const xtreamUser = document.getElementById('xtreamUser');
                const xtreamPass = document.getElementById('xtreamPass');
                if (stalkerUrl) stalkerUrl.value = "";
                if (stalkerMac) stalkerMac.value = "00:1A:79:";
                if (form.querySelector('[name="SN"]')) form.querySelector('[name="SN"]').value = "";
                if (form.querySelector('[name="D1"]')) form.querySelector('[name="D1"]').value = "";
                if (form.querySelector('[name="D2"]')) form.querySelector('[name="D2"]').value = "";
                if (form.querySelector('[name="SG"]')) form.querySelector('[name="SG"]').value = "";
                if (xtreamUrl) xtreamUrl.value = "";
                if (xtreamUser) xtreamUser.value = "";
                if (xtreamPass) xtreamPass.value = "";
                const activeType = document.getElementById('portalTypeInput').value;
                if (activeType === 'xtream') {
                    if (xtreamUrl) setTimeout(() => xtreamUrl.focus(), 100);
                } else {
                    if (stalkerUrl) setTimeout(() => stalkerUrl.focus(), 100);
                }
            }
        }
        async function fetchSavedPortals() {
            togglePortalModal(true);
            const list = document.getElementById('portalList');
            list.innerHTML = '<div class="text-center py-20 animate-pulse text-slate-500 uppercase text-[10px] font-black tracking-widest">Scanning Secure Vault...</div>';
            try {
                const response = await fetch('stalker_api.php?action=all_portals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                const activeId = data.active_portal_id;
                let html = '';
                if (data.portals) {
                    html = data.portals.map(p => {
                        const isActive = activeId === p.id;
                        const labelText = p.type === 'xtream' ? 'XTREAM' : 'STALKER';
                        const infoText = p.type === 'xtream' ? ('USER: ' + p.username) : p.MAC;
                        return `
                        <div onclick="selectSavedPortal('${p.id}')" class="group flex items-center justify-between p-5 rounded-3xl ${isActive ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-900/50 border border-white/5 hover:border-red-500/40 hover:bg-red-600/5'} transition-all cursor-pointer">
                            <div class="flex items-center gap-4 text-left">
                                <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-600 group-hover:text-red-400 transition-colors"><i data-lucide="server"></i></div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <p class="text-[12px] font-bold text-white group-hover:text-red-400">${p.URL.replace('http://', '').replace('https://', '').split('/')[0]}</p>
                                        <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[8px] font-black uppercase text-slate-400 border border-white/5">${labelText}</span>
                                        ${isActive ? '<span class="px-2 py-0.5 rounded-md bg-green-500 text-white text-[8px] font-black uppercase tracking-widest">ACTIVE</span>' : ''}
                                    </div>
                                    <p class="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">${infoText}</p>
                                </div>
                            </div>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-800 group-hover:text-red-400 group-hover:translate-x-1 transition-all"></i>
                        </div>
                    `}).join('');
                }
                list.innerHTML = html || '<p class="text-center py-10 text-slate-500 text-xs">No portals found in vault</p>';
                lucide.createIcons();
            } catch (e) {
                pushToast("Vault connection failed", "error");
            }
        }
        async function selectSavedPortal(portalId) {
            try {
                const response = await fetch('stalker_api.php?action=switch_portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: portalId })
                });
                const res = await response.json();
                if (res.statusCode === 200) {
                    pushToast("Portal Switched", "success");
                    togglePortalModal(false);
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    pushToast(res.message || "Switch failed", "error");
                }
            } catch (e) {
                pushToast("Portal switch failed", "error");
            }
        }
        function showResults(data) {
            document.getElementById('login-container').classList.add('hidden');
            document.getElementById('successDisplay').classList.remove('hidden');
            const js = data.data?.js || {};
            document.getElementById('portalUrl').innerText = data.URL || "N/A";
            document.getElementById('stbVersion').innerText = data.type === 'xtream' ? 'Xtream API' : ((js.stb_type || "MAG") + " | " + (js.image_version || "N/A"));
            document.getElementById('lastActive').innerText = data.Date || "N/A";
            let items = [];
            if (data.type === 'xtream') {
                items = [
                    { label: 'Max Connections', val: js.max_connections || '1', icon: 'zap', color: 'text-amber-400' },
                    { label: 'Active Connections', val: js.active_cons || '0', icon: 'activity', color: 'text-cyan-400' },
                    { label: 'Expiry Date', val: data.expirydate || 'Unlimited', icon: 'clock', color: 'text-emerald-400' },
                    { label: 'Account Status', val: js.status || 'Active', icon: 'shield-check', color: 'text-slate-400' }
                ];
            } else {
                items = [
                    { label: 'Parent PIN', val: data.parent_password || js.parent_password || '0000', icon: 'shield-alert', color: 'text-amber-400' },
                    { label: 'Country', val: js.country || 'Global', icon: 'map-pin', color: 'text-cyan-400' },
                    { label: 'Expiry Date', val: data.expirydate === "0000-00-00 00:00:00" ? "Unlimited" : data.expirydate, icon: 'zap', color: 'text-emerald-400' },
                    { label: 'Hardware ID', val: js.hw_version || 'N/A', icon: 'cpu', color: 'text-slate-400' }
                ];
            }
            document.getElementById('resultsContent').innerHTML = items.map(item => `
                <div class="p-6 rounded-[2rem] border border-white/5 bg-slate-900/40 relative overflow-hidden text-left">
                    <div class="flex flex-col gap-4">
                        <div class="p-3 w-fit rounded-2xl bg-white/5 ${item.color}"><i data-lucide="${item.icon}" class="w-5 h-5"></i></div>
                        <div><p class="data-label mb-1">${item.label}</p><h3 class="text-sm font-bold truncate ${item.color}">${item.val}</h3></div>
                    </div>
                </div>
            `).join('');
            let metaItems = [];
            if (data.type === 'xtream') {
                metaItems = [
                    { label: 'Portal Type', val: 'Xtream API Connection' },
                    { label: 'User Agent', val: 'Xtream API Client' },
                    { label: 'Server Version', val: js.image_version || 'v1.0' },
                    { label: 'Default PIN', val: '0000' }
                ];
            } else {
                metaItems = [
                    { label: 'Device ID 1', val: data.device_id || 'N/A' },
                    { label: 'Device ID 2', val: data.device_id2 || 'N/A' },
                    { label: 'Signature', val: data.sig || 'N/A' },
                    { label: 'Settings Pass', val: data.settings_password || '0000' }
                ];
            }
            document.getElementById('metaGrid').innerHTML = metaItems.map(i => `
            <div class="flex flex-col border-l-2 border-white/10 pl-4 text-left">
                <span class="data-label mb-1">${i.label}</span>
                <span class="text-xs font-mono text-slate-400 break-all">${i.val}</span>
            </div>
            `).join('');
            lucide.createIcons();
        }
        window.addEventListener('DOMContentLoaded', async () => {
            try {
                const response = await fetch('stalker_api.php?action=login_details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                // Pre-populate the form with active_portal details if available!
                if (data.active_portal) {
                    const ap = data.active_portal;
                    setPortalType(ap.type || 'stalker');
                    if (ap.type === 'xtream') {
                        const xtreamUrl = document.getElementById('xtreamUrl');
                        const xtreamUser = document.getElementById('xtreamUser');
                        const xtreamPass = document.getElementById('xtreamPass');
                        if (xtreamUrl) xtreamUrl.value = ap.URL || '';
                        if (xtreamUser) xtreamUser.value = ap.username || '';
                        if (xtreamPass) xtreamPass.value = ap.password || '';
                    } else {
                        const stalkerUrl = document.getElementById('stalkerUrl');
                        const stalkerMac = document.getElementById('stalkerMac');
                        if (stalkerUrl) stalkerUrl.value = ap.URL || '';
                        if (stalkerMac) stalkerMac.value = ap.MAC || '';
                        const form = document.getElementById('handshakeForm');
                        if (form) {
                            if (form.querySelector('[name="SN"]')) form.querySelector('[name="SN"]').value = ap.SN || '';
                            if (form.querySelector('[name="D1"]')) form.querySelector('[name="D1"]').value = ap.D1 || '';
                            if (form.querySelector('[name="D2"]')) form.querySelector('[name="D2"]').value = ap.D2 || '';
                            if (form.querySelector('[name="SG"]')) form.querySelector('[name="SG"]').value = ap.SG || '';
                            if (form.querySelector('[name="Model"]')) form.querySelector('[name="Model"]').value = ap.Model || 'MAG250';
                            if (form.querySelector('[name="Proxy"]')) form.querySelector('[name="Proxy"]').value = ap.Proxy || 'AUTO';
                            if (form.querySelector('[name="API"]')) form.querySelector('[name="API"]').value = ap.API || '263';
                            if (form.querySelector('[name="Share"]')) form.querySelector('[name="Share"]').value = ap.Share || 'OFF';
                        }
                    }
                }
                if (data.STALKER && data.STALKER.statusCode === 200) {
                    showResults(data.STALKER);
                }
            } catch (e) { }
        });
        document.getElementById('handshakeForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.querySelector('span').innerText = "Connecting...";
            try {
                const response = await fetch('stalker_api.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(new FormData(this)))
                });
                const result = await response.json();
                if (result.STALKER?.statusCode === 200) {
                    showResults(result.STALKER);
                    pushToast("Handshake Established", "success");
                } else {
                    pushToast(result.STALKER?.message || "Handshake Failed", "error");
                }
            } catch (err) {
                pushToast("Connection Error", "error");
            } finally {
                btn.disabled = false;
                btn.querySelector('span').innerText = "Initialize Handshake";
            }
        });
    </script>
    </div>
    </div>
    <script src="/watchdog.js" id="maintenance-watchdog"></script>
    <link rel="stylesheet" href="/local-ai.css?v=gemini-3.5-v3">
    <script src="/local-ai.js?v=gemini-3.5-v3"></script>
</body>
</html>
