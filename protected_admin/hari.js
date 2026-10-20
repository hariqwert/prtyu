let analyticsPollingTimer = null;
// Utility Functions
function getCookie(name) {
    if (!document.cookie) return '';
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : '';
}
window.getCookie = getCookie;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Universal Non-Blocking Confirmation Modal (Guaranteed to function in sandboxed iFrames)
let appConfirmResolve = null;

function showAppConfirmModal(options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('appUniversalConfirmModal');
        const titleEl = document.getElementById('appConfirmModalTitle');
        const msgEl = document.getElementById('appConfirmModalMessage');
        const confirmBtn = document.getElementById('appConfirmModalBtnConfirm');

        if (!modal) {
            try {
                const ok = window.confirm(options.message || 'Are you sure?');
                return resolve(ok);
            } catch (e) {
                return resolve(true);
            }
        }

        if (titleEl) titleEl.textContent = options.title || 'Confirm Action';
        if (msgEl) msgEl.textContent = options.message || 'Are you sure you want to proceed?';
        if (confirmBtn) {
            confirmBtn.innerHTML = `<i data-lucide="${options.icon || 'trash-2'}" class="w-4 h-4"></i><span>${escapeHtml(options.confirmText || 'Confirm')}</span>`;
            if (options.isDanger !== false) {
                confirmBtn.className = 'flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/20';
            } else {
                confirmBtn.className = 'flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/20';
            }
        }

        appConfirmResolve = resolve;
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    });
}

function handleAppConfirmModalAction(confirmed) {
    const modal = document.getElementById('appUniversalConfirmModal');
    if (modal) modal.classList.add('hidden');
    if (appConfirmResolve) {
        const res = appConfirmResolve;
        appConfirmResolve = null;
        res(!!confirmed);
    }
}

window.showAppConfirmModal = showAppConfirmModal;
window.handleAppConfirmModalAction = handleAppConfirmModalAction;

// State Variables
let currentTab = 'portals';
let heartbeatInterval = null;
let heartbeatTimeLeft = 60;
// Token is kept in-memory only (NOT localStorage) to prevent XSS theft.
// The server sets an HttpOnly cookie on login that authenticates all API calls.
let token = '';
function getAdminToken() {
    return token || '';
}

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const loginErrorText = document.getElementById('loginErrorText');

const securityIpDisplay = document.getElementById('securityIpDisplay');
const heartbeatTimer = document.getElementById('heartbeatTimer');

// Tabs
const tabContents = {
    harichat: document.getElementById('tabContent-harichat'),
    overview: document.getElementById('tabContent-overview'),
    portals: document.getElementById('tabContent-portals'),
    m3u: document.getElementById('tabContent-m3u'),
    quarantine: document.getElementById('tabContent-quarantine'),
    reorganize: document.getElementById('tabContent-reorganize'),
    monitor: document.getElementById('tabContent-monitor'),
    system: document.getElementById('tabContent-system'),
    sports: document.getElementById('tabContent-sports'),
    embedscraper: document.getElementById('tabContent-embedscraper'),
    channelsjson: document.getElementById('tabContent-channelsjson'),
    liveevents: document.getElementById('tabContent-liveevents'),
    builder: document.getElementById('tabContent-builder'),
    analytics: document.getElementById('tabContent-analytics'),
    scrapers: document.getElementById('tabContent-scrapers')
};

// Dashboard Elements
const statActivePortal = document.getElementById('stat-activePortal');
const statTotalChannels = document.getElementById('stat-totalChannels');
const statActiveSessions = document.getElementById('stat-activeSessions');
const statBlockedIps = document.getElementById('stat-blockedIps');
const dashboardLogs = document.getElementById('dashboard-logs');

// Monitor Elements
const activeSessionsList = document.getElementById('activeSessionsList');
const activeSessionsCount = document.getElementById('activeSessionsCount');
const blacklistList = document.getElementById('blacklistList');
const incidentsList = document.getElementById('incidentsList');
const manualBlockIp = document.getElementById('manualBlockIp');

// Portal Manager Elements
const portalForm = document.getElementById('portalForm');
const portalEditId = document.getElementById('portalEditId');
const portalName = document.getElementById('portalName');
const portalUrl = document.getElementById('portalUrl');
const portalMac = document.getElementById('portalMac');
const portalModel = document.getElementById('portalModel');
const portalSn = document.getElementById('portalSn');
const portalD1 = document.getElementById('portalD1');
const portalD2 = document.getElementById('portalD2');
const portalSig = document.getElementById('portalSig');
const portalImageVersion = document.getElementById('portalImageVersion');
const portalToken = document.getElementById('portalToken');
const portalUserAgent = document.getElementById('portalUserAgent');
const portalsTableBody = document.getElementById('portalsTableBody');
const formTitle = document.getElementById('formTitle');
const savePortalBtnText = document.getElementById('savePortalBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// M3U Vault Elements
const m3uUploadForm = document.getElementById('m3uUploadForm');
const m3uName = document.getElementById('m3uName');
const m3uFileInput = document.getElementById('m3uFileInput');
const dropZone = document.getElementById('dropZone');
const dropZoneText = document.getElementById('dropZoneText');
const uploadStatus = document.getElementById('uploadStatus');
const m3uTableBody = document.getElementById('m3uTableBody');

// Maintenance Elements
const maintenanceForm = document.getElementById('maintenanceForm');
const maintenanceToggle = document.getElementById('maintenanceToggle');
const maintenanceTemplate = document.getElementById('maintenanceTemplate');
if (maintenanceTemplate) {
    maintenanceTemplate.addEventListener('change', () => {
        const t = document.getElementById('maintenanceTitle');
        const d = document.getElementById('maintenanceText');
        if (t) t.value = '';
        if (d) d.value = '';
    });
}

// Feature Toggles
const featureToggles = {
    m3uEnabled: document.getElementById('feat-m3u'),
    stalkerEnabled: document.getElementById('feat-stalker'),
    firewallEnabled: document.getElementById('feat-firewall'),
    publicPlaylistEnabled: document.getElementById('feat-public')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initApp();
    setupKeyboardShortcuts();
});

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only trigger if not typing in an input or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        
        // Tab Navigation
        if (key === '1') switchTab('overview');
        if (key === '2' || key === 't') switchTab('portals');
        if (key === '3' || key === 'm') switchTab('m3u');
        if (key === '4') switchTab('monitor');
        if (key === '5') switchTab('system');

        // Actions
        if (key === 'r') {
            e.preventDefault();
            switchTab(currentTab);
            showToast('Refreshing', `Updating ${currentTab} data...`, 'info');
        }
        if (key === 'l') {
            e.preventDefault();
            handleLogout();
        }
        if (key === 'p' && currentTab === 'monitor') {
            e.preventDefault();
            toggleSystemPower();
        }
    });
}

async function initApp() {
    if (token) {
        showDashboard();
        return;
    }
    try {
        const res = await fetch('/api/admin/session', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                showDashboard();
                return;
            }
        }
    } catch (e) {}
    showLogin();
}

// --- VIEW CONTROLS & TWO-WAY AUTHENTICATION ---
let activeChallengeToken = '';

async function generateDeviceFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("AETHERIS_HW_ID", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("AETHERIS_HW_ID", 4, 17);
        }
        const canvasData = canvas.toDataURL();
        const navData = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            canvasData
        ].join('###');

        const enc = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(navData));
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {
        return 'hw_' + Math.random().toString(36).substring(2, 15);
    }
}
window.generateDeviceFingerprint = generateDeviceFingerprint;

function showStage2View(ip) {
    document.getElementById('loginStage1')?.classList.add('hidden');
    const stage2 = document.getElementById('loginStage2');
    if (stage2) stage2.classList.remove('hidden');
    const boundIpEl = document.getElementById('stage2BoundIp');
    if (boundIpEl) boundIpEl.textContent = ip || 'Local Active IP';
    generateDeviceFingerprint().then(fp => {
        const fpEl = document.getElementById('stage2DeviceFp');
        if (fpEl) fpEl.textContent = fp.substring(0, 16).toUpperCase();
    });
    const pinInput = document.getElementById('pinInput');
    if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 150);
    }
    if (window.lucide) lucide.createIcons();
}
window.showStage2View = showStage2View;

function cancelStage2() {
    activeChallengeToken = '';
    const pinInput = document.getElementById('pinInput');
    if (pinInput) pinInput.value = '';
    hidePinError();
    document.getElementById('loginStage2')?.classList.add('hidden');
    document.getElementById('loginStage1')?.classList.remove('hidden');
    if (typeof turnstile !== 'undefined') turnstile.reset();
    if (window.lucide) lucide.createIcons();
}
window.cancelStage2 = cancelStage2;

function showPinError(msg) {
    const pinErr = document.getElementById('pinError');
    const pinErrText = document.getElementById('pinErrorText');
    if (pinErrText) pinErrText.textContent = msg;
    if (pinErr) pinErr.classList.remove('hidden');
}
window.showPinError = showPinError;

function hidePinError() {
    const pinErr = document.getElementById('pinError');
    if (pinErr) pinErr.classList.add('hidden');
}
window.hidePinError = hidePinError;

function showLogin() {
    stopHeartbeat();
    window.location.reload();
}

function showDashboard() {
    loginView?.classList.add('hidden');
    dashboardView?.classList.remove('hidden');
    
    // Switch to first tab (Overview)
    switchTab('overview');
    startHeartbeat();
}


// --- DASHBOARD & ANALYTICS ---
async function fetchStats() {
    try {
        const res = await secureFetch('/api/admin/stats');
        const data = await res.json();
        
        if (data.status === 'success') {
            const s = data.stats;
            statActivePortal.innerText = s.activePortal;
            statTotalChannels.innerText = (s.m3uChannels).toLocaleString();
            statActiveSessions.innerText = s.activeSessions;
            statBlockedIps.innerText = s.totalBlacklisted;
            
            addDashboardLog(`[STATS] Health check: ${s.activeSessions} active streams, ${s.totalBlacklisted} IPs blocked.`);
        }
    } catch (e) {
        console.error('Failed to fetch stats:', e);
    }
}

function addDashboardLog(msg) {
    if (!dashboardLogs) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'hover:text-white transition-colors cursor-default mb-1';
    entry.innerHTML = `<span class="text-gray-700 mr-2">[${time}]</span> ${msg}`;
    dashboardLogs.prepend(entry);
    
    if (dashboardLogs.children.length > 30) {
        dashboardLogs.removeChild(dashboardLogs.lastChild);
    }
}

async function clearSystemCache() {
    if (!confirm('Optimize System: Purge all temporary API cache files? This will force fresh portal synchronization.')) return;
    
    try {
        const res = await secureFetch('/api/admin/system/clear-cache', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Cache Purged', data.message, 'success');
            addDashboardLog(`[CLEANUP] ${data.message}`);
        }
    } catch (e) {}
}

// --- SECURE AUTHENTICATION ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value || '';

    if (!turnstileResponse) {
        showLoginError('Please complete the CAPTCHA.');
        return;
    }

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, turnstileResponse })
        });
        const data = await res.json();
        
        if (res.ok && data.status === '2fa_required') {
            activeChallengeToken = data.challengeToken;
            showStage2View(data.ip);
        } else if (res.ok && data.status === 'success') {
            token = data.token; // kept in-memory only, not persisted
            passwordInput.value = '';
            showToast('Success', 'IP-bound session activated!', 'success');
            showDashboard();
        } else {
            showLoginError(data.message || 'Authentication failed');
            if (typeof turnstile !== 'undefined') turnstile.reset();
        }
    } catch (err) {
        showLoginError('Network connection failed. Please try again.');
        if (typeof turnstile !== 'undefined') turnstile.reset();
    }
});

// Stage 2 PIN & Hardware Binding Form Listener
document.addEventListener('DOMContentLoaded', () => {
    const pinForm = document.getElementById('pinForm');
    if (pinForm) {
        pinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hidePinError();
            const pinInput = document.getElementById('pinInput');
            const pin = pinInput ? pinInput.value.trim() : '';

            if (!pin) {
                showPinError('Please enter your 6-digit Security PIN.');
                return;
            }

            if (!activeChallengeToken) {
                showPinError('Challenge session expired. Please re-enter credentials.');
                setTimeout(() => cancelStage2(), 1500);
                return;
            }

            try {
                const fingerprint = await generateDeviceFingerprint();
                const res = await fetch('/api/admin/verify-2fa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        challengeToken: activeChallengeToken,
                        pin,
                        deviceFingerprint: fingerprint
                    })
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    token = data.token;
                    passwordInput.value = '';
                    if (pinInput) pinInput.value = '';
                    activeChallengeToken = '';
                    showToast('Authenticated', 'Two-Way IP & Hardware Authentication Verified!', 'success');
                    showDashboard();
                } else {
                    showPinError(data.message || 'Security PIN verification failed.');
                }
            } catch (err) {
                showPinError('Network connection failed during PIN verification.');
            }
        });
    }
});

function showLoginError(msg) {
    loginErrorText.textContent = msg;
    loginError.classList.remove('hidden');
}

async function handleLogout() {
    token = '';
    stopHeartbeat();
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    window.location.reload();
}


// --- 1-MINUTE SECURITY HEARTBEAT LOOP ---
function startHeartbeat() {
    stopHeartbeat();
    
    // Initial immediate ping
    pingHeartbeat();
    
    heartbeatTimeLeft = 60;
    heartbeatInterval = setInterval(() => {
        heartbeatTimeLeft--;
        heartbeatTimer.textContent = `${heartbeatTimeLeft}s`;
        
        if (heartbeatTimeLeft <= 0) {
            pingHeartbeat();
            heartbeatTimeLeft = 60;
        }
    }, 1000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

async function pingHeartbeat() {
    try {
        const res = await fetch('/api/admin/heartbeat', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            // Heartbeat failed (IP mismatch or expired token)
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Session verification failed');
        }
        
        const data = await res.json();
        securityIpDisplay.textContent = data.ip;
    } catch (err) {
        console.error('Security Breach or Session Timeout:', err.message);
        token = '';
        showLogin();
        
        // Show urgent warning modal/alert
        alert(`SESSION TERMINATED:\n${err.message || 'IP mismatch or session expired. Safety gate triggered.'}`);
    }
}

// --- MOBILE NAVIGATION TOGGLE ---
function toggleMobileNav() {
    const sidebar = document.getElementById('sidebarNav');
    if (!sidebar) return;
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
    }
}

// --- TAB ROUTING ---
function switchTab(tabId) {
    currentTab = tabId;
window.switchTab = switchTab;
    
    // On mobile / small screens, auto-close sidebar when tab is switched
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebarNav');
        if (sidebar) sidebar.classList.add('hidden');
    }

    // Scroll main viewport to top on tab switch
    const mainViewport = document.querySelector('main');
    if (mainViewport) mainViewport.scrollTop = 0;
    
    // Update active tab styles
    ['harichat', 'overview', 'portals', 'm3u', 'channelsjson', 'quarantine', 'reorganize', 'monitor', 'system', 'sports', 'embedscraper', 'liveevents', 'builder', 'analytics', 'scrapers'].forEach(id => {
        const btn = document.getElementById(`tabBtn-${id}`);
        if (!btn) return;
        if (id === tabId) {
            if (id === 'harichat') {
                btn.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-900/60');
            } else {
                btn.classList.add('bg-red-500/10', 'text-white', 'border-l-4', 'border-red-500', 'rounded-l-none');
                btn.classList.remove('text-gray-400', 'hover:bg-gray-900/50');
            }
            if (tabContents[id]) tabContents[id].classList.remove('hidden');
        } else {
            if (id === 'harichat') {
                btn.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-900/60');
            } else {
                btn.classList.remove('bg-red-500/10', 'text-white', 'border-l-4', 'border-red-500', 'rounded-l-none');
                btn.classList.add('text-gray-400', 'hover:bg-gray-900/50');
            }
            if (tabContents[id]) tabContents[id].classList.add('hidden');
        }
    });

    // Refresh dynamic data
    if (tabId === 'harichat') initHariChat();
    if (tabId === 'overview') { fetchStats(); fetchSystemStatus(); fetchSiteLockSettings(); }
    if (tabId === 'portals') fetchPortals();
    if (tabId === 'm3u') fetchPlaylists();
    if (tabId === 'scrapers') {
        loadScrapersStatus();
        loadAiStatus();
    }
    if (tabId === 'embedscraper') {
        fetchScrapedChannels();
        populateScrapedContainerOptions();
    }
    if (tabId === 'channelsjson') {
        fetchChannelsJsonStats();
        fetchChannelsJsonList(1);
    }
    if (tabId === 'quarantine') {
        fetchQuarantineList();
        checkQuarantineScanStatus();
    }
    if (tabId === 'reorganize') {
        loadAvailablePlaylistsForOrganizer();
    }
    if (tabId === 'monitor') {
        loadActivity();
        loadBlacklist();
        loadIncidents();
    }
    if (tabId === 'analytics') {
        fetchAnalytics();
        fetchStreamHealthStatus();
        if (!analyticsPollingTimer) {
            analyticsPollingTimer = setInterval(() => {
                fetchAnalytics();
            }, 2500);
        }
    } else {
        if (analyticsPollingTimer) {
            clearInterval(analyticsPollingTimer);
            analyticsPollingTimer = null;
        }
    }
    if (tabId === 'system') { fetchSystemStatus();
        fetchMaintenanceSettings();
        fetchSiteLockSettings();
        fetchDeveloperSettings();
        fetchFeatures();
    }
    if (tabId === 'sports') {
        loadSportsStreams();
        loadSportsM3uFiles();
    }

    lucide.createIcons();
}

async function fetchAnalytics() {
    try {
        const res = await secureFetch('/api/admin/analytics');
        const data = await res.json();
        if (data.status === 'success' && data.analytics) {
            const a = data.analytics;
            
            const activeStreamsEl = document.getElementById('analyticsActiveStreams');
            if (activeStreamsEl) activeStreamsEl.textContent = a.activeStreams || 0;
            
            const bandwidthEl = document.getElementById('analyticsBandwidth');
            if (bandwidthEl) bandwidthEl.textContent = a.bandwidthFormatted || '0 B';
            
            const liveGaugeEl = document.getElementById('liveBandwidthGauge');
            if (liveGaugeEl) liveGaugeEl.textContent = `${a.currentRateMbps || '0.00'} Mbps`;

            // Draw Real-time Bandwidth SVG Chart
            if (typeof renderBandwidthChart === 'function') {
                renderBandwidthChart(a.recentBandwidthSamples || []);
            }

            // Render Active Channel Distribution
            if (typeof renderActiveChannelsDistribution === 'function') {
                renderActiveChannelsDistribution(a.activeChannelViewers || []);
            }
            
            const trackedIpsEl = document.getElementById('analyticsTrackedIps');
            if (trackedIpsEl) trackedIpsEl.textContent = a.totalTrackedIps || 0;
            
            const uptimeEl = document.getElementById('analyticsUptime');
            if (uptimeEl) {
                const uptimeSec = a.uptimeSeconds || 0;
                const hrs = Math.floor(uptimeSec / 3600);
                const mins = Math.floor((uptimeSec % 3600) / 60);
                const secs = uptimeSec % 60;
                uptimeEl.textContent = `${hrs}h ${mins}m ${secs}s`;
            }

            // Render Top Requested Media
            const topReqContainer = document.getElementById('analyticsTopRequested');
            if (topReqContainer) {
                if (!a.topRequested || a.topRequested.length === 0) {
                    topReqContainer.innerHTML = `<p class="text-xs text-gray-500 italic py-2">No media requests recorded yet.</p>`;
                } else {
                    topReqContainer.innerHTML = a.topRequested.map((item, idx) => `
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800/60">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <span class="w-5 h-5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center justify-center shrink-0">#${idx + 1}</span>
                                <span class="text-xs font-bold text-white truncate">${item.title}</span>
                            </div>
                            <span class="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono font-bold shrink-0">${item.count} plays</span>
                        </div>
                    `).join('');
                }
            }

            // Render Client IPs
            const clientIpsContainer = document.getElementById('analyticsClientIps');
            if (clientIpsContainer) {
                if (!a.clientIps || a.clientIps.length === 0) {
                    clientIpsContainer.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-500 italic">No active client IP activity recorded.</td></tr>`;
                } else {
                    clientIpsContainer.innerHTML = a.clientIps.map(item => `
                        <tr class="hover:bg-gray-900/40 transition-colors">
                            <td class="py-2.5 px-3 font-mono font-bold text-white text-xs">${item.ip}</td>
                            <td class="py-2.5 px-3 font-mono text-gray-300 text-xs">${item.totalRequests} reqs</td>
                            <td class="py-2.5 px-3">
                                ${item.activeStreams > 0 
                                    ? `<span class="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Streaming (${item.activeStreams})</span>`
                                    : `<span class="inline-flex items-center gap-1 text-[9px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase">Idle</span>`}
                            </td>
                            <td class="py-2.5 px-3 text-[10px] text-gray-400 font-mono">${new Date(item.lastSeen).toLocaleTimeString()}</td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch analytics:", e);
    }
}

// --- REAL-TIME BANDWIDTH & ACTIVE STREAM ANALYTICS ENGINE ---
function renderBandwidthChart(samples) {
    const svgArea = document.getElementById('bandwidthChartArea');
    const svgLine = document.getElementById('bandwidthChartLine');
    if (!svgArea || !svgLine) return;

    if (!samples || samples.length === 0) {
        svgArea.setAttribute('d', 'M 0 120 L 400 120 Z');
        svgLine.setAttribute('d', 'M 0 120 L 400 120');
        return;
    }

    const maxPoints = 30;
    const points = samples.slice(-maxPoints);
    let maxMbps = Math.max(...points.map(p => Number(p.mbps) || 0), 1.0);
    // Add 25% headroom
    maxMbps = maxMbps * 1.25;

    const width = 400;
    const height = 110;
    const paddingBottom = 10;
    const chartHeight = height - paddingBottom;

    const step = width / Math.max(points.length - 1, 1);
    const coords = points.map((p, i) => {
        const x = Math.round(i * step);
        const val = Number(p.mbps) || 0;
        const y = Math.round(chartHeight - (val / maxMbps) * chartHeight) + 5;
        return { x, y };
    });

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
        linePath += ` L ${coords[i].x} ${coords[i].y}`;
    }

    const areaPath = `${linePath} L ${coords[coords.length - 1].x} 120 L ${coords[0].x} 120 Z`;

    svgLine.setAttribute('d', linePath);
    svgArea.setAttribute('d', areaPath);
}

function renderActiveChannelsDistribution(channels) {
    const container = document.getElementById('activeChannelsDistribution');
    const badge = document.getElementById('totalActiveViewersBadge');
    if (!container) return;

    if (!channels || channels.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 italic py-4 text-center">No active concurrent stream viewers right now.</p>`;
        if (badge) badge.textContent = `0 Viewers`;
        return;
    }

    const totalViewers = channels.reduce((sum, c) => sum + (Number(c.viewers) || 0), 0);
    if (badge) badge.textContent = `${totalViewers} ${totalViewers === 1 ? 'Viewer' : 'Viewers'}`;

    container.innerHTML = channels.map(c => {
        const pct = totalViewers > 0 ? Math.round((c.viewers / totalViewers) * 100) : 0;
        return `
            <div class="space-y-1.5 p-2 rounded-xl bg-gray-900/50 border border-gray-800/60">
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                        <span class="font-bold text-white truncate text-[11px]">${escapeHtml(c.channel)}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="font-mono text-cyan-400 font-bold text-[11px]">${c.viewers} watching</span>
                        <span class="text-[9px] text-gray-400 font-mono">(${pct}%)</span>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-300" style="width: ${Math.max(pct, 5)}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// --- AUTOMATED STREAM HEALTH CHECKER LOGIC ---
let isAutoFailoverActive = true;

async function fetchStreamHealthStatus() {
    try {
        const res = await secureFetch('/api/admin/stream-health/status');
        const data = await res.json();
        if (data.status === 'success') {
            const summary = data.summary || {};
            const streams = data.streams || [];

            isAutoFailoverActive = !!data.autoFailover;
            const badge = document.getElementById('healthAutoFailoverBadge');
            if (badge) {
                badge.className = isAutoFailoverActive
                    ? 'text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700';
                badge.textContent = isAutoFailoverActive ? 'AUTO-FAILOVER ON' : 'AUTO-FAILOVER OFF';
            }

            const totalEl = document.getElementById('healthTotalStreams');
            if (totalEl) totalEl.textContent = summary.totalMonitored || streams.length;

            const onlineEl = document.getElementById('healthOnlineStreams');
            if (onlineEl) onlineEl.textContent = summary.online || 0;

            const degradedEl = document.getElementById('healthDegradedStreams');
            if (degradedEl) degradedEl.textContent = summary.degraded || 0;

            const offlineEl = document.getElementById('healthOfflineStreams');
            if (offlineEl) offlineEl.textContent = summary.offline || 0;

            const tbody = document.getElementById('streamHealthTableBody');
            if (tbody) {
                if (streams.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-gray-500 italic">No stream health records found. Click "Run Health Scan Now" to evaluate channels.</td></tr>`;
                } else {
                    tbody.innerHTML = streams.map(s => {
                        let statusPill = '';
                        if (s.status === 'online') {
                            statusPill = `<span class="inline-flex items-center gap-1.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Healthy</span>`;
                        } else if (s.status === 'degraded') {
                            statusPill = `<span class="inline-flex items-center gap-1.5 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Degraded</span>`;
                        } else {
                            statusPill = `<span class="inline-flex items-center gap-1.5 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> Offline</span>`;
                        }

                        const latencyText = s.latencyMs ? `${s.latencyMs} ms` : (s.status === 'offline' ? 'Timeout' : '--');
                        const httpBadge = s.httpStatus 
                            ? `<span class="font-mono text-[10px] ${s.httpStatus === 200 ? 'text-emerald-400' : 'text-amber-400'} font-bold">${s.httpStatus}</span>` 
                            : `<span class="text-[10px] text-gray-500 font-mono">ERR</span>`;
                        const timeStr = s.lastChecked ? new Date(s.lastChecked).toLocaleTimeString() : '--';
                        const failoverStr = s.failoverUrl 
                            ? `<span class="font-mono text-[10px] text-cyan-400 truncate block max-w-[140px]" title="${s.failoverUrl}">${s.failoverUrl}</span>`
                            : `<span class="text-[10px] text-gray-500 font-mono">None</span>`;

                        return `
                            <tr class="hover:bg-gray-900/40 transition-colors">
                                <td class="py-2.5 px-3">
                                    <span class="font-bold text-white text-xs block">${escapeHtml(s.name || s.id)}</span>
                                    <span class="text-[9px] text-gray-500 font-mono truncate block max-w-[180px]">${escapeHtml(s.url || '')}</span>
                                </td>
                                <td class="py-2.5 px-3">${statusPill}</td>
                                <td class="py-2.5 px-3 font-mono text-xs font-semibold ${s.latencyMs > 2000 ? 'text-amber-400' : 'text-slate-300'}">${latencyText}</td>
                                <td class="py-2.5 px-3">${httpBadge}</td>
                                <td class="py-2.5 px-3 font-mono text-[10px] text-gray-400">${timeStr}</td>
                                <td class="py-2.5 px-3">${failoverStr}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch stream health status:", e);
    }
}

async function triggerStreamHealthScan() {
    const btn = document.getElementById('btnTriggerHealthScan');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Scanning Streams...</span>`;
        if (window.lucide) lucide.createIcons();
    }
    try {
        const res = await secureFetch('/api/admin/stream-health/scan', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Stream Health Scan completed! Tested ${data.testedCount || 0} streams.`, 'success');
            await fetchStreamHealthStatus();
        } else {
            showToast(data.message || 'Stream health scan failed', 'error');
        }
    } catch (e) {
        showToast('Health scan error: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="zap" class="w-4 h-4"></i><span>Run Health Scan Now</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function toggleHealthAutoFailover() {
    try {
        const newState = !isAutoFailoverActive;
        const res = await secureFetch('/api/admin/stream-health/config', {
            method: 'POST',
            body: JSON.stringify({ autoFailover: newState })
        });
        const data = await res.json();
        if (data.status === 'success') {
            isAutoFailoverActive = newState;
            showToast(`Auto-failover ${newState ? 'enabled' : 'disabled'} successfully`, 'success');
            await fetchStreamHealthStatus();
        }
    } catch (e) {
        showToast('Failed to toggle auto failover: ' + e.message, 'error');
    }
}

// --- PUBLIC MAINTENANCE SCHEDULE & COUNTDOWN MANAGER LOGIC ---
let maintenanceScheduleInterval = null;





// --- API HELPER FOR SECURE REQUESTS ---
async function secureFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    if (options.body && typeof options.body === 'string' && !options.headers['Content-Type'] && !options.headers['content-type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 418) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Session expired');
        }
        return res;
    } catch (err) {
        if (err.message.includes('Session expired') || err.message.includes('Session hijacked')) {
            token = '';
            showLogin();
            alert(`Access Revoked: ${err.message}`);
        }
        throw err;
    }
}

// --- LIVE ACTIVITY MONITOR ---

async function fetchSystemStatus() {
    try {
        const res = await secureFetch('/api/admin/system/status');
        const data = await res.json();
        if (data.status === 'success') {
            updatePowerUI(data.systemStatus);
        }
    } catch (e) {}
}

async function toggleSystemPower() {
    const btn = document.getElementById('powerBtn');
    const btnText = document.getElementById('powerBtnText');
    const originalText = btnText.innerText;
    
    if (!confirm("CRITICAL ACTION: Are you sure you want to change the Global System Power State? This affects all users immediately.")) return;
    
    try {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btnText.innerText = 'PROCESSING...';
        
        const res = await secureFetch('/api/admin/system/toggle', { method: 'POST' });
        const data = await res.json();
        
        if (data.status === 'success') {
            updatePowerUI(data.systemStatus);
            const msg = data.systemStatus === 'active' ? 'System restored and online.' : 'System successfully locked down.';
            showToast('System Power Updated', msg, data.systemStatus === 'active' ? 'success' : 'error');
            addDashboardLog(`[SYSTEM] Power state changed to ${data.systemStatus.toUpperCase()}`);
        } else {
            throw new Error(data.message || 'Toggle failed');
        }
    } catch (e) {
        showToast('System Error', e.message || 'Failed to toggle power state.', 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function updatePowerUI(status) {
    const card = document.getElementById('systemPowerCard');
    const iconContainer = document.getElementById('powerIconContainer');
    const statusText = document.getElementById('powerStatusText');
    const btn = document.getElementById('powerBtn');
    const btnText = document.getElementById('powerBtnText');
    
    if (status === 'active') {
        if (card) {
            card.classList.remove('border-red-500/50', 'bg-red-500/5');
            card.classList.add('border-green-500/50', 'bg-green-500/5');
        }
        if (iconContainer) {
            iconContainer.className = 'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg bg-green-500 text-white';
            iconContainer.innerHTML = '<i data-lucide="zap" class="w-8 h-8"></i>';
        }
        if (statusText) {
            statusText.innerText = 'ONLINE';
            statusText.className = 'uppercase tracking-widest text-sm bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20 ml-2';
        }
        if (btn) {
            btn.className = 'px-8 py-4 rounded-2xl font-black text-sm tracking-widest flex items-center gap-3 transition-all active:scale-[0.95] shadow-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer';
        }
        if (btnText) btnText.innerText = 'TURN SYSTEM OFF';
    } else {
        if (card) {
            card.classList.remove('border-green-500/50', 'bg-green-500/5');
            card.classList.add('border-red-500/50', 'bg-red-500/5');
        }
        if (iconContainer) {
            iconContainer.className = 'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg bg-gray-800 text-red-500 border border-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="shield-off" class="w-8 h-8"></i>';
        }
        if (statusText) {
            statusText.innerText = 'OFFLINE';
            statusText.className = 'uppercase tracking-widest text-sm bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20 ml-2';
        }
        if (btn) {
            btn.className = 'px-8 py-4 rounded-2xl font-black text-sm tracking-widest flex items-center gap-3 transition-all active:scale-[0.95] shadow-xl bg-green-600 hover:bg-green-700 text-white cursor-pointer';
        }
        if (btnText) btnText.innerText = 'RESTORE SYSTEM';
    }
    if (window.lucide && window.lucide.createIcons) lucide.createIcons();
}

async function loadActivity() {
    fetchSystemStatus(); // Update power switch state too
    loadServerLogs();    // Update live 36h server console
    loadBoundDevices();  // Update hardware bound devices

    try {
        const res = await secureFetch('/api/admin/sessions');
        const data = await res.json();
        
        if (data.status === 'success') {
            const sessions = data.sessions || [];
            const countEl = document.getElementById('activeSessionsCount');
            if (countEl) countEl.innerText = `${sessions.length} ONLINE`;
            
            const listEl = document.getElementById('activeSessionsList');
            if (!listEl) return;

            if (sessions.length === 0) {
                listEl.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-12 text-center text-gray-500 text-sm">
                            <div class="flex flex-col items-center gap-3 opacity-50">
                                <i data-lucide="wifi-off" class="w-8 h-8"></i>
                                <p>No active stream connections detected.</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                listEl.innerHTML = sessions.map(s => {
                    const isLoopback = s.ip === '127.0.0.1' || s.ip === '::1' || s.ip === 'localhost';
                    const ipBadge = isLoopback 
                        ? '<span class="text-[9px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 uppercase font-black tracking-widest ml-1">Localhost</span>'
                        : '<span class="text-[9px] text-gray-500 uppercase tracking-tighter ml-1">Client</span>';

                    return `
                        <tr class="hover:bg-gray-900/30 transition-colors">
                            <td class="px-6 py-4">
                                <div class="flex flex-col">
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-bold text-white font-mono text-sm">${escapeHtml(s.ip)}</span>
                                        ${ipBadge}
                                    </div>
                                    <span class="text-[10px] text-gray-500">${s.status === 'idle' ? 'Idle / Standby' : 'Streaming Active'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col">
                                    <span class="font-bold text-emerald-400 text-xs">${escapeHtml(s.streamTitle || s.streamId || 'Live Stream')}</span>
                                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">${escapeHtml(s.type || 'HLS')}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-xs text-gray-400 font-mono">
                                ${new Date(s.startTime).toLocaleTimeString()}
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span>${escapeHtml(s.formattedUptime || 'Active')}</span>
                                </span>
                            </td>
                            <td class="px-6 py-4 text-xs text-gray-400 max-w-[160px] truncate" title="${escapeHtml(s.userAgent || '')}">
                                <span class="truncate block">${escapeHtml(s.userAgent || 'External Player')}</span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex items-center justify-end gap-1.5">
                                    <button onclick="terminateSession('${escapeJsString(s.ip)}')" class="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[10px] font-bold transition-all" title="Disconnect Session">
                                        Disconnect
                                    </button>
                                    ${!isLoopback ? `
                                        <button onclick="blockAndTerminateSession('${escapeJsString(s.ip)}')" class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-[10px] font-bold transition-all" title="Blacklist IP & Disconnect">
                                            Block IP
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
            if (window.lucide) lucide.createIcons();
        }
    } catch (e) {
        console.error('Failed to load activity:', e);
    }
}

async function terminateSession(ip) {
    try {
        const res = await secureFetch('/api/admin/sessions/terminate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        const d = await res.json();
        if (res.ok && d.status === 'success') {
            showToast('Session Terminated', d.message, 'success');
            loadActivity();
        }
    } catch (e) {
        showToast('Error', 'Failed to terminate session', 'error');
    }
}
window.terminateSession = terminateSession;

async function blockAndTerminateSession(ip) {
    if (!confirm(`Are you sure you want to drop connection and blacklist IP ${ip}?`)) return;
    try {
        const res = await secureFetch('/api/admin/sessions/block-and-terminate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        const d = await res.json();
        if (res.ok && d.status === 'success') {
            showToast('IP Blacklisted', d.message, 'success');
            loadActivity();
            loadBlacklist();
        }
    } catch (e) {
        showToast('Error', 'Failed to block IP', 'error');
    }
}
window.blockAndTerminateSession = blockAndTerminateSession;

// ==========================================
// 36-HOUR SERVER CONSOLE LOG CONTROLLER
// ==========================================
let isLogPaused = false;
let allServerLogs = [];

async function loadServerLogs() {
    if (isLogPaused) return;
    try {
        const res = await secureFetch('/api/admin/logs/live?limit=150');
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            allServerLogs = data.logs || [];
            renderServerLogs();
            const badge = document.getElementById('logCountBadge');
            if (badge) badge.textContent = `${data.totalEventsInWindow ?? allServerLogs.length} log events (36h window)`;
        }
    } catch (e) {
        console.warn('Failed to load server logs:', e);
    }
}
window.loadServerLogs = loadServerLogs;

function renderServerLogs() {
    const terminal = document.getElementById('serverLogTerminal');
    if (!terminal) return;

    const search = (document.getElementById('logSearchInput')?.value || '').toLowerCase().trim();
    const level = document.getElementById('logLevelSelect')?.value || 'ALL';

    const filtered = allServerLogs.filter(l => {
        if (level !== 'ALL' && l.level !== level) return false;
        if (search) {
            const str = `${l.message} ${l.ip || ''} ${l.stream || ''}`.toLowerCase();
            return str.includes(search);
        }
        return true;
    });

    if (filtered.length === 0) {
        terminal.innerHTML = '<div class="text-gray-500 italic py-4 text-center">No log events match current filter.</div>';
        return;
    }

    terminal.innerHTML = filtered.map(l => {
        let levelColor = 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/40';
        if (l.level === 'STREAM') levelColor = 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40';
        else if (l.level === 'AUTH') levelColor = 'text-purple-400 bg-purple-950/60 border border-purple-800/40';
        else if (l.level === 'WARN') levelColor = 'text-yellow-400 bg-yellow-950/60 border border-yellow-800/40';
        else if (l.level === 'ERROR') levelColor = 'text-red-400 bg-red-950/60 border border-red-800/40';

        const ipBadge = l.ip ? `<span class="text-gray-400 font-mono">[${escapeHtml(l.ip)}]</span>` : '';
        const streamBadge = l.stream ? `<span class="text-emerald-400 font-mono">(${escapeHtml(l.stream)})</span>` : '';

        return `
            <div class="flex items-start gap-2 hover:bg-white/5 px-2 py-0.5 rounded transition-colors font-mono">
                <span class="text-gray-600 shrink-0 select-none">${l.timeFormatted || new Date(l.timestamp).toLocaleTimeString()}</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${levelColor}">${l.level}</span>
                ${ipBadge}
                ${streamBadge}
                <span class="text-gray-300 break-all">${escapeHtml(l.message)}</span>
            </div>
        `;
    }).join('');

    const chk = document.getElementById('chkAutoScrollLogs');
    if (chk && chk.checked) {
        terminal.scrollTop = terminal.scrollHeight;
    }
}
window.renderServerLogs = renderServerLogs;

function filterServerLogs() {
    renderServerLogs();
}
window.filterServerLogs = filterServerLogs;

function toggleLogPause() {
    isLogPaused = !isLogPaused;
    const btn = document.getElementById('btnPauseLogs');
    const icon = document.getElementById('iconPauseLogs');
    if (btn) {
        btn.className = isLogPaused 
            ? 'p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all'
            : 'p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white text-xs font-bold transition-all';
    }
    if (icon) {
        icon.setAttribute('data-lucide', isLogPaused ? 'play' : 'pause');
        if (window.lucide) lucide.createIcons();
    }
    showToast('Log Stream', isLogPaused ? 'Live feed paused' : 'Live feed resumed', 'info');
}
window.toggleLogPause = toggleLogPause;

function export36hLogs() {
    window.open('/api/admin/logs/export?hours=36', '_blank');
    showToast('Log Export', 'Downloading 36-hour server log archive...', 'success');
}
window.export36hLogs = export36hLogs;

async function clearServerLogs() {
    if (!confirm('Are you sure you want to clear in-memory and 36h log archives?')) return;
    try {
        const res = await secureFetch('/api/admin/logs/clear', { method: 'POST' });
        const d = await res.json();
        if (res.ok && d.status === 'success') {
            allServerLogs = [];
            renderServerLogs();
            showToast('Logs Cleared', 'Server log archives cleared successfully', 'success');
        }
    } catch (e) {
        showToast('Error', 'Failed to clear server logs', 'error');
    }
}
window.clearServerLogs = clearServerLogs;

// ==========================================
// BOUND HARDWARE DEVICES CONTROLLER
// ==========================================
async function loadBoundDevices() {
    const list = document.getElementById('boundDevicesList');
    if (!list) return;

    try {
        const res = await secureFetch('/api/system/bound-devices');
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            const devices = data.devices || [];
            if (devices.length === 0) {
                list.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500 text-xs italic">
                            No hardware devices currently bound. Unlock using Master PIN 2325 / 232512 to bind your device.
                        </td>
                    </tr>
                `;
            } else {
                list.innerHTML = devices.map(d => {
                    const isAuth = d.status === 'authorized';
                    return `
                        <tr class="hover:bg-gray-900/30 transition-colors">
                            <td class="px-6 py-4 font-bold text-white text-xs">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="monitor" class="w-4 h-4 text-cyan-400"></i>
                                    <span>${escapeHtml(d.deviceLabel || 'Browser Device')}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 font-mono text-[11px] text-gray-400">
                                <span class="bg-black/60 px-2 py-0.5 rounded border border-gray-800 truncate max-w-[140px] inline-block" title="${d.deviceFingerprint}">
                                    ${d.deviceId?.substring(0, 12)}...
                                </span>
                            </td>
                            <td class="px-6 py-4 font-mono text-xs text-cyan-400">${escapeHtml(d.ip || '127.0.0.1')}</td>
                            <td class="px-6 py-4 text-xs text-gray-500">${new Date(d.firstBoundAt).toLocaleString()}</td>
                            <td class="px-6 py-4 text-xs text-gray-300 font-medium">${new Date(d.lastSeenAt).toLocaleTimeString()}</td>
                            <td class="px-6 py-4">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${isAuth ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                                    ${d.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                ${isAuth ? `
                                    <button onclick="revokeBoundDevice('${d.deviceId}')" class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-[10px] font-bold transition-all">
                                        Revoke
                                    </button>
                                ` : '<span class="text-xs text-gray-600 italic">Revoked</span>'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
            if (window.lucide) lucide.createIcons();
        }
    } catch (e) {
        console.warn('Failed to load bound devices:', e);
    }
}
window.loadBoundDevices = loadBoundDevices;

async function revokeBoundDevice(deviceId) {
    if (!confirm(`Revoke device ${deviceId}?`)) return;
    try {
        const res = await secureFetch('/api/system/revoke-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });
        const d = await res.json();
        if (res.ok && d.status === 'success') {
            showToast('Device Revoked', d.message, 'success');
            loadBoundDevices();
        }
    } catch (e) {
        showToast('Error', 'Failed to revoke device', 'error');
    }
}
window.revokeBoundDevice = revokeBoundDevice;

async function revokeAllBoundDevices() {
    if (!confirm('Are you sure you want to revoke ALL bound hardware devices? Users will need to re-enter Master PIN 2FA.')) return;
    try {
        const res = await secureFetch('/api/system/revoke-all-devices', { method: 'POST' });
        const d = await res.json();
        if (res.ok && d.status === 'success') {
            showToast('All Devices Revoked', d.message, 'success');
            loadBoundDevices();
        }
    } catch (e) {
        showToast('Error', 'Failed to revoke all devices', 'error');
    }
}
window.revokeAllBoundDevices = revokeAllBoundDevices;

async function loadBlacklist() {
    try {
        const res = await secureFetch('/api/admin/blacklist');
        const data = await res.json();
        
        if (data.status === 'success') {
            if (data.blacklist.length === 0) {
                blacklistList.innerHTML = `
                    <tr>
                        <td colspan="2" class="px-6 py-8 text-center text-gray-600 text-xs italic">
                            No blocked IP addresses.
                        </td>
                    </tr>
                `;
            } else {
                blacklistList.innerHTML = data.blacklist.map(ip => `
                    <tr class="hover:bg-red-500/5 transition-colors text-xs">
                        <td class="px-6 py-4 font-mono text-red-400">${ip}</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="unblockIp('${ip}')" class="text-[10px] font-bold text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-1.5 rounded-lg">
                                Unblock
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Failed to load blacklist:', e);
    }
}

async function loadIncidents() {
    try {
        const res = await secureFetch('/api/admin/incidents');
        const data = await res.json();
        
        if (data.status === 'success') {
            if (data.incidents.length === 0) {
                incidentsList.innerHTML = `
                    <tr>
                        <td colspan="3" class="px-6 py-8 text-center text-gray-600 text-[10px] italic">
                            Clean security slate.
                        </td>
                    </tr>
                `;
            } else {
                incidentsList.innerHTML = data.incidents.map(inc => `
                    <tr class="hover:bg-amber-500/5 transition-colors text-[10px]">
                        <td class="px-6 py-3">
                            <div class="flex flex-col">
                                <span class="font-bold text-amber-500 mono">${inc.ip}</span>
                                <span class="text-gray-500">Tried: "${inc.username}"</span>
                            </div>
                        </td>
                        <td class="px-6 py-3 text-gray-500">
                            ${new Date(inc.timestamp).toLocaleString()}
                        </td>
                        <td class="px-6 py-3 text-right">
                            <button onclick="unblockIp('${inc.ip}')" class="text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-[9px] font-bold">
                                Restore
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Failed to load incidents:', e);
    }
}

async function terminateSession(ip) {
    if (!confirm(`Are you sure you want to drop connection for ${ip}?`)) return;
    try {
        const res = await secureFetch('/api/admin/sessions/terminate', {
            method: 'POST',
            body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Session Terminated', `IP ${ip} removed from monitor.`, 'info');
            loadActivity();
        }
    } catch (e) {}
}

async function blockIp(ip) {
    if (!confirm(`PERMANENT BLOCK: Block IP ${ip} and all future access?`)) return;
    try {
        const res = await secureFetch('/api/admin/blacklist', {
            method: 'POST',
            body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('IP Blocked', `Address ${ip} added to firewall blacklist.`, 'error');
            loadActivity();
            loadBlacklist();
        }
    } catch (e) {}
}

async function blockIpManually() {
    const ip = manualBlockIp.value.trim();
    if (!ip) return;
    await blockIp(ip);
    manualBlockIp.value = '';
}

async function unblockIp(ip) {
    try {
        const res = await secureFetch(`/api/admin/blacklist/${ip}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('IP Unblocked', `Address ${ip} restored to access list.`, 'success');
            loadBlacklist();
            loadIncidents();
            loadActivity();
        }
    } catch (e) {}
}

// --- PORTAL MANAGER LOGIC ---
async function fetchPortals() {
    try {
        const res = await secureFetch('/api/admin/portals');
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
            renderPortals(data.portals);
        }
    } catch (err) {
        console.error('Failed to load portals:', err);
    }
}

function renderPortals(portals) {
    window.portalsData = portals;
    portalsTableBody.innerHTML = '';
    
    if (!portals || portals.length === 0) {
        portalsTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-12 text-center text-gray-500 font-medium">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i data-lucide="server-off" class="w-8 h-8 text-gray-600"></i>
                        <span>No portals registered yet. Add one to get started!</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    portals.forEach(portal => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800/40 hover:bg-gray-900/30 transition-colors';
        row.innerHTML = `
            <td class="py-4 pl-2 font-bold text-white max-w-[150px] truncate">
                <div class="flex items-center gap-2">
                    <span>${portal.name}</span>
                    ${portal.isDefault ? `
                        <span class="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Active Default
                        </span>
                    ` : ''}
                </div>
            </td>
            <td class="py-4 max-w-[200px] truncate text-gray-400 mono text-xs">${portal.url}</td>
            <td class="py-4 text-gray-400 mono text-xs">${portal.type === 'xtream' ? `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded-md uppercase text-[10px]">XTREAM</span> <span class="ml-1 text-slate-300 font-bold">${portal.username}</span>` : `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold px-2 py-0.5 rounded-md uppercase text-[10px]">STALKER</span> <span class="ml-1 text-slate-300 font-bold">${portal.mac || ''}</span>`}</td>
            <td class="py-4 text-right pr-2">
                <div class="inline-flex gap-1.5">
                    ${!portal.isDefault ? `
                        <button onclick="setDefaultPortal('${portal.id}')" class="text-xs bg-gray-900 hover:bg-blue-600 hover:text-white border border-gray-800 text-gray-400 px-2.5 py-1.5 rounded-lg transition-all" title="Set Active Default">
                            Set Active
                        </button>
                    ` : ''}
                    <button onclick="editPortal('${portal.id}')" class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Edit Portal">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deletePortal('${portal.id}')" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Portal">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        portalsTableBody.appendChild(row);
    });
    lucide.createIcons();
}

portalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = portalEditId.value;
    const payload = {
        name: portalName.value.trim(),
        url: portalUrl.value.trim(),
        type: document.getElementById('portalType').value,
        username: document.getElementById('portalUsername').value.trim(),
        password: document.getElementById('portalPassword').value.trim(),
        mac: portalMac.value.trim(),
        model: portalModel.value,
        sn: portalSn ? portalSn.value.trim() : "",
        device_id1: portalD1 ? portalD1.value.trim() : "",
        device_id2: portalD2 ? portalD2.value.trim() : "",
        signature: portalSig ? portalSig.value.trim() : "",
        image_version: portalImageVersion ? portalImageVersion.value.trim() : "",
        token: portalToken ? portalToken.value.trim() : "",
        user_agent: portalUserAgent ? portalUserAgent.value.trim() : ""
    };

    const isEdit = !!id;
    const endpoint = isEdit ? `/api/admin/portals/${id}` : '/api/admin/portals';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await secureFetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
            showToast('Success', isEdit ? 'Portal updated!' : 'Portal registered!', 'success');
            resetPortalForm();
            fetchPortals();
        } else {
            showToast('Error', data.message || 'Operation failed', 'error');
        }
    } catch (err) {
        showToast('Error', 'API request failed.', 'error');
    }
});

function editPortal(id) {
    const portal = (window.portalsData || []).find(p => p.id === id);
    if (!portal) return;

    portalEditId.value = id;
    portalName.value = portal.name || '';
    portalUrl.value = portal.url || '';
    
    document.getElementById('portalType').value = portal.type || 'stalker';
    togglePortalTypeFields();

    if (portal.type === 'xtream') {
        document.getElementById('portalUsername').value = portal.username || '';
        document.getElementById('portalPassword').value = portal.password || '';
    } else {
        portalMac.value = portal.mac || '';
    }
    
    portalModel.value = portal.model || 'MAG250';
    
    if (portalSn) portalSn.value = portal.sn || '';
    if (portalD1) portalD1.value = portal.device_id1 || '';
    if (portalD2) portalD2.value = portal.device_id2 || '';
    if (portalSig) portalSig.value = portal.signature || '';
    if (portalImageVersion) portalImageVersion.value = portal.image_version || '';
    if (portalToken) portalToken.value = portal.token || '';
    if (portalUserAgent) portalUserAgent.value = portal.user_agent || '';

    formTitle.textContent = 'Edit Portal Settings';
    savePortalBtnText.textContent = 'Apply Updates';
    cancelEditBtn.classList.remove('hidden');
    portalName.focus();
}

function resetPortalForm() {
    portalEditId.value = '';
    portalForm.reset();
    document.getElementById('portalType').value = 'stalker';
    document.getElementById('portalUsername').value = '';
    document.getElementById('portalPassword').value = '';
    togglePortalTypeFields();
    if(portalSn) portalSn.value = "";
    if(portalD1) portalD1.value = "";
    if(portalD2) portalD2.value = "";
    if(portalSig) portalSig.value = "";
    if(portalImageVersion) portalImageVersion.value = "";
    if(portalToken) portalToken.value = "";
    if(portalUserAgent) portalUserAgent.value = "";
    formTitle.textContent = 'Register Portal';
    savePortalBtnText.textContent = 'Save Portal';
    cancelEditBtn.classList.add('hidden');
}

async function setDefaultPortal(id) {
    try {
        const res = await secureFetch(`/api/admin/portals/${id}/default`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Active Portal Configured', data.message, 'success');
            fetchPortals();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        console.error('Failed to set default portal:', err);
    }
}

async function deletePortal(id) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Portal',
        message: 'Are you absolutely sure you want to delete this portal config from the system database?',
        confirmText: 'Delete Portal',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/portals/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Deleted', 'Portal config unlinked.', 'success');
            fetchPortals();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        console.error('Failed to delete portal:', err);
    }
}


// --- M3U LOCAL VAULT LOGIC ---

// Drag and drop events
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-emerald-500', 'bg-emerald-500/5');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/5');
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
        m3uFileInput.files = files;
        updateDropZoneText(files[0].name);
    }
});

m3uFileInput.addEventListener('change', () => {
    if (m3uFileInput.files.length) {
        updateDropZoneText(m3uFileInput.files[0].name);
    }
});

function updateDropZoneText(filename) {
    dropZoneText.innerHTML = `Selected: <span class="text-emerald-400 font-bold">${filename}</span>`;
}

let currentAdminM3UMethod = 'file';

window.setAdminM3UMethod = function(method) {
    currentAdminM3UMethod = method;
    const btnUrl = document.getElementById('adminMethodUrl');
    const btnFile = document.getElementById('adminMethodFile');
    const urlGroup = document.getElementById('adminM3uUrlGroup');
    const fileGroup = document.getElementById('adminM3uFileGroup');

    if (method === 'url') {
        btnUrl.className = 'flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold transition-all border border-red-500';
        btnFile.className = 'flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-bold transition-all border border-gray-800';
        urlGroup.classList.remove('hidden');
        fileGroup.classList.add('hidden');
    } else {
        btnFile.className = 'flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold transition-all border border-red-500';
        btnUrl.className = 'flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-bold transition-all border border-gray-800';
        fileGroup.classList.remove('hidden');
        urlGroup.classList.add('hidden');
    }
}

m3uUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = m3uName.value.trim();
    const url = document.getElementById('m3uUrlInput') ? document.getElementById('m3uUrlInput').value.trim() : '';
    const file = m3uFileInput.files[0];

    if (currentAdminM3UMethod === 'url') {
        if (!url) {
            showUploadStatus('Please enter a valid M3U URL.', 'error');
            return;
        }
        await submitM3U(name, url, '');
    } else {
        if (!file) {
            showUploadStatus('Please select or drop an M3U file.', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            let base64Data = event.target.result;
            if (base64Data.includes('base64,')) {
                base64Data = base64Data.split('base64,')[1];
            }
            await submitM3U(name, '', base64Data);
        };
        reader.onerror = () => showUploadStatus('Failed to read file locally.', 'error');
        reader.readAsDataURL(file);
    }
});

async function submitM3U(name, url, file_content) {
    showUploadStatus('Processing and security scanning...', 'info');

    try {
        const payload = {
            action: 'm3u_save',
            name: name,
            url: url,
            file_content: file_content,
            password: '2008' // Use the fallback or verify bypass
        };

        const res = await fetch('/stalker_api.php?action=m3u_save', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            showUploadStatus('Playlist parsed and secured in Vault successfully!', 'success');
            m3uUploadForm.reset();
            dropZoneText.innerHTML = `Drag file here or click to browse`;
            fetchPlaylists();
            showToast('Vault Updated', 'Local M3U secured', 'success');
        } else {
            showUploadStatus(data.message || 'File upload rejected.', 'error');
        }
    } catch (err) {
        showUploadStatus('File processing failed due to severe size or server timeout.', 'error');
    }
}

function showUploadStatus(msg, type) {
    uploadStatus.classList.remove('hidden', 'bg-blue-500/10', 'text-blue-400', 'border-blue-500/20', 'bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20', 'bg-red-500/10', 'text-red-400', 'border-red-500/20');
    
    if (type === 'info') {
        uploadStatus.classList.add('bg-blue-500/10', 'text-blue-400', 'border-blue-500/20');
    } else if (type === 'success') {
        uploadStatus.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
    } else if (type === 'error') {
        uploadStatus.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
    }
    uploadStatus.textContent = msg;
    uploadStatus.classList.remove('hidden');
}

async function fetchPlaylists() {
    try {
        const res = await secureFetch('/api/admin/m3u/playlists');
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            renderPlaylists(data.playlists, data.activeId);
        }
    } catch (err) {
        console.error('Failed to load playlists:', err);
    }
}

function renderPlaylists(playlists, activeId) {
    m3uTableBody.innerHTML = '';
    
    if (!playlists || playlists.length === 0) {
        m3uTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-12 text-center text-gray-500 font-medium">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i data-lucide="folder-search" class="w-8 h-8 text-gray-600"></i>
                        <span>No files saved in Local Vault.</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    playlists.forEach(pl => {
        const isSelected = activeId === pl.id;
        const row = document.createElement('tr');
        row.className = `border-b border-gray-800/40 hover:bg-gray-900/30 transition-colors ${isSelected ? 'bg-emerald-500/[0.03]' : ''}`;
        row.innerHTML = `
            <td class="py-4 pl-2 font-bold text-white max-w-[150px] truncate">
                <div class="flex flex-col gap-0.5">
                    <span class="text-white flex items-center gap-2">
                        ${pl.name}
                        ${isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
                    </span>
                    <span class="text-[10px] text-gray-500 font-medium">Uploaded: ${new Date(pl.uploadedAt).toLocaleString()}</span>
                </div>
            </td>
            <td class="py-4 font-mono font-bold text-gray-300 text-xs">${pl.channelsCount} Channels</td>
            <td class="py-4 max-w-[150px] truncate text-gray-400 mono text-xs" title="${pl.filePath}">${pl.filePath}</td>
            <td class="py-4 text-right pr-2">
                <div class="inline-flex items-center gap-3">
                    <!-- Master Toggle -->
                    <div class="flex items-center gap-2 mr-2">
                        <span class="text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-emerald-500' : 'text-gray-600'}">${isSelected ? 'Active' : 'Disabled'}</span>
                        <button onclick="togglePlaylistState('${pl.id}', ${isSelected})" 
                            class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? 'bg-emerald-500' : 'bg-gray-800'}">
                            <span class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${isSelected ? 'translate-x-5' : 'translate-x-1'}"></span>
                        </button>
                    </div>

                    <button onclick="deletePlaylist('${pl.id}')" class="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Delete Playlist Permanent">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        m3uTableBody.appendChild(row);
    });
    lucide.createIcons();
}

async function activatePlaylist(id) {
    try {
        const res = await secureFetch(`/api/admin/m3u/playlists/${id}/activate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Activated', data.message, 'success');
            fetchPlaylists();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        console.error('Failed to activate playlist:', err);
    }
}

async function togglePlaylistState(id, currentlyActive) {
    // If it's active, toggle it off by switching back to Stalker Portal mode
    const targetId = currentlyActive ? 'portal' : id;
    await activatePlaylist(targetId);
}

async function deletePlaylist(id) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Playlist',
        message: 'Are you sure you want to permanently delete this playlist from secure local storage?',
        confirmText: 'Delete Playlist',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/m3u/playlists/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Deleted', 'Playlist completely unlinked and uninstalled.', 'success');
            fetchPlaylists();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        console.error('Failed to delete playlist:', err);
    }
}


// --- SITE LOCK MODE LOGIC ---
let isLockUpdating = false;

window.handleSiteLockToggleInstant = async function(isChecked) {
    if (isLockUpdating) return;
    isLockUpdating = true;

    const toggle = document.getElementById('siteLockToggle');
    const passInput = document.getElementById('siteLockPasswordInput');
    const titleInput = document.getElementById('siteLockTitleInput');
    const msgInput = document.getElementById('siteLockMessageInput');
    const hintInput = document.getElementById('siteLockHintInput');
    const statusBadge = document.getElementById('siteLockStatusBadge');
    const quickBadge = document.getElementById('quickLockBadge');

    // Optimistic UI update
    if (statusBadge) {
        if (isChecked) {
            statusBadge.className = 'px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-black text-cyan-300 uppercase tracking-widest animate-pulse';
            statusBadge.textContent = 'ACTIVE';
        } else {
            statusBadge.className = 'px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-[10px] font-bold text-gray-400 uppercase tracking-widest';
            statusBadge.textContent = 'INACTIVE';
        }
    }
    if (quickBadge) {
        if (isChecked) {
            quickBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
            quickBadge.textContent = 'LOCKED';
        } else {
            quickBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-800 text-gray-400';
            quickBadge.textContent = 'OFF';
        }
    }

    const payload = {
        siteLockMode: isChecked,
        siteLockPassword: passInput && passInput.value ? passInput.value.trim() : undefined,
        siteLockTitle: titleInput && titleInput.value ? titleInput.value.trim() : undefined,
        siteLockMessage: msgInput && msgInput.value ? msgInput.value.trim() : undefined,
        siteLockHint: hintInput && hintInput.value ? hintInput.value.trim() : undefined
    };

    try {
        const res = await secureFetch('/api/admin/lock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Site Lock Updated', isChecked ? 'Site Lock is now ACTIVE. Access is passcode protected.' : 'Site Lock is now INACTIVE. Portal is public.', 'success');
        } else {
            if (toggle) toggle.checked = !isChecked;
            showToast('Error', data.message || 'Failed to update lock mode.', 'error');
            await fetchSiteLockSettings();
        }
    } catch (err) {
        if (toggle) toggle.checked = !isChecked;
        showToast('Error', 'API connection failed while toggling lock mode.', 'error');
        await fetchSiteLockSettings();
    } finally {
        isLockUpdating = false;
    }
};

async function fetchSiteLockSettings() {
    try {
        const res = await secureFetch('/api/admin/lock-mode');
        const data = await res.json();
        
        const toggle = document.getElementById('siteLockToggle');
        const passInput = document.getElementById('siteLockPasswordInput');
        const titleInput = document.getElementById('siteLockTitleInput');
        const msgInput = document.getElementById('siteLockMessageInput');
        const hintInput = document.getElementById('siteLockHintInput');
        const statusBadge = document.getElementById('siteLockStatusBadge');
        const quickBadge = document.getElementById('quickLockBadge');

        if (toggle && !isLockUpdating) toggle.checked = !!data.siteLockMode;
        if (passInput && document.activeElement !== passInput) passInput.value = data.siteLockPassword || '202012';
        if (titleInput && document.activeElement !== titleInput) titleInput.value = data.siteLockTitle || '';
        if (msgInput && document.activeElement !== msgInput) msgInput.value = data.siteLockMessage || '';
        if (hintInput && document.activeElement !== hintInput) hintInput.value = data.siteLockHint || '';

        const isLocked = !!data.siteLockMode;
        if (statusBadge) {
            if (isLocked) {
                statusBadge.className = 'px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-black text-cyan-300 uppercase tracking-widest animate-pulse';
                statusBadge.textContent = 'ACTIVE';
            } else {
                statusBadge.className = 'px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-[10px] font-bold text-gray-400 uppercase tracking-widest';
                statusBadge.textContent = 'INACTIVE';
            }
        }
        if (quickBadge) {
            if (isLocked) {
                quickBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
                quickBadge.textContent = 'LOCKED';
            } else {
                quickBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-800 text-gray-400';
                quickBadge.textContent = 'OFF';
            }
        }
        loadUnlockedIps();
    } catch (err) {
        console.error('Failed to load site lock settings:', err);
    }
}

async function saveSiteLockSettings(event) {
    if (event) event.preventDefault();
    const toggle = document.getElementById('siteLockToggle');
    const passInput = document.getElementById('siteLockPasswordInput');
    const titleInput = document.getElementById('siteLockTitleInput');
    const msgInput = document.getElementById('siteLockMessageInput');
    const hintInput = document.getElementById('siteLockHintInput');

    const password = passInput ? passInput.value.trim() : '202012';
    if (!password) {
        showToast('Password Required', 'Please provide a passcode to enable Site Lock.', 'error');
        return;
    }

    const payload = {
        siteLockMode: toggle ? toggle.checked : false,
        siteLockPassword: password,
        siteLockTitle: titleInput ? titleInput.value.trim() : '',
        siteLockMessage: msgInput ? msgInput.value.trim() : '',
        siteLockHint: hintInput ? hintInput.value.trim() : ''
    };

    try {
        const res = await secureFetch('/api/admin/lock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Lock Mode Updated', payload.siteLockMode ? 'Site Lock ENABLED with Passcode Gate.' : 'Site Lock disabled.', 'success');
            fetchSiteLockSettings();
        } else {
            showToast('Error', data.message || 'Failed to update lock mode.', 'error');
        }
    } catch (err) {
        showToast('Error', 'API connection failed while saving lock mode.', 'error');
    }
}

function setLockPassQuick(val) {
    const passInput = document.getElementById('siteLockPasswordInput');
    if (passInput) {
        passInput.value = val;
        passInput.focus();
        showToast('Passcode Set', 'Passcode input filled with: ' + val + '. Click Save to apply.', 'info');
    }
}

function generateRandomPin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setLockPassQuick(pin);
}

async function loadUnlockedIps() {
    const countEl = document.getElementById('unlockedSessionsCount');
    if (!countEl) return;
    try {
        const res = await secureFetch('/api/admin/unlocked-ips');
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            const count = data.count || 0;
            countEl.textContent = count + (count === 1 ? ' IP whitelisted' : ' IPs whitelisted');
        }
    } catch (e) {}
}

async function relockAllVisitorsNow() {
    if (!confirm('Relock all visitors immediately? This clears active whitelisted IPs and requires all visitors to enter the passcode again.')) return;
    try {
        const res = await secureFetch('/api/admin/unlocked-ips/clear', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Visitors Relocked', 'All visitor access sessions have been cleared.', 'success');
            loadUnlockedIps();
        } else {
            showToast('Error', data.message || 'Failed to clear whitelisted IPs.', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to connect to relock API.', 'error');
    }
}

function toggleAdminLockPassReveal() {
    const passInput = document.getElementById('siteLockPasswordInput');
    const eye = document.getElementById('adminLockPassEye');
    if (!passInput) return;
    if (passInput.type === 'password') {
        passInput.type = 'text';
        if (eye) eye.setAttribute('data-lucide', 'eye-off');
    } else {
        passInput.type = 'password';
        if (eye) eye.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
}

function testLockScreenDirect() {
    window.open('/', '_blank');
}

// Make available globally for inline HTML onclick handlers
window.saveSiteLockSettings = saveSiteLockSettings;
window.fetchSiteLockSettings = fetchSiteLockSettings;
window.toggleAdminLockPassReveal = toggleAdminLockPassReveal;
window.testLockScreenDirect = testLockScreenDirect;
window.setLockPassQuick = setLockPassQuick;
window.generateRandomPin = generateRandomPin;
window.loadUnlockedIps = loadUnlockedIps;
window.relockAllVisitorsNow = relockAllVisitorsNow;


// --- DEVELOPER MODE LOGIC ---
async function fetchDeveloperSettings() {
    try {
        const res = await secureFetch('/api/admin/developer');
        const data = await res.json();
        
        document.getElementById('developerModeToggle').checked = !!data.developerMode;
        renderDevWhitelist(data.allowedDeveloperIps || []);
    } catch (err) {
        console.error('Failed to load developer settings:', err);
    }
}

async function toggleDeveloperMode(enabled) {
    try {
        await secureFetch('/api/admin/developer', {
            method: 'POST',
            body: JSON.stringify({ developerMode: enabled })
        });
        showToast(`Developer mode ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
        showToast('Failed to update developer mode', 'error');
        document.getElementById('developerModeToggle').checked = !enabled;
    }
}

function renderDevWhitelist(ips) {
    const tbody = document.getElementById('devWhitelistTableBody');
    if (!tbody) return;
    
    if (ips.length === 0) {
        tbody.innerHTML = `<tr><td class="p-3 text-center text-xs text-gray-500 italic">No IPs whitelisted. External access is fully blocked.</td></tr>`;
        return;
    }

    tbody.innerHTML = ips.map(ip => `
        <tr class="hover:bg-gray-800/30 transition-colors">
            <td class="p-3 font-mono text-xs text-indigo-400">${ip}</td>
            <td class="p-3 text-right">
                <button onclick="removeDevWhitelistIp('${ip}')" class="text-gray-500 hover:text-red-500 transition-colors" title="Remove IP">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

async function addDevWhitelistIp(event) {
    event.preventDefault();
    const input = document.getElementById('devWhitelistInput');
    const ip = input.value.trim();
    if (!ip) return;

    try {
        const res = await secureFetch('/api/admin/developer/whitelist', {
            method: 'POST',
            body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            renderDevWhitelist(data.allowedDeveloperIps);
            showToast('IP added to whitelist', 'success');
        }
    } catch (err) {
        showToast('Failed to add IP', 'error');
    }
}

async function removeDevWhitelistIp(ip) {
    if (!confirm(`Are you sure you want to remove ${ip} from the developer whitelist?`)) return;
    
    try {
        const res = await secureFetch('/api/admin/developer/whitelist', {
            method: 'DELETE',
            body: JSON.stringify({ ip })
        });
        const data = await res.json();
        if (data.status === 'success') {
            renderDevWhitelist(data.allowedDeveloperIps);
            showToast('IP removed from whitelist', 'success');
        }
    } catch (err) {
        showToast('Failed to remove IP', 'error');
    }
}

// --- SYSTEM MAINTENANCE LOGIC ---
async function fetchMaintenanceSettings() {
    try {
        const res = await secureFetch('/api/admin/maintenance');
        const data = await res.json();
        
        if (document.getElementById("maintenanceAdminBypassToggle")) document.getElementById("maintenanceAdminBypassToggle").checked = !!data.maintenanceAdminBypass;
        maintenanceToggle.checked = !!data.maintenanceMode;
        if (document.getElementById('consumetMaintenanceToggle')) document.getElementById('consumetMaintenanceToggle').checked = !!data.consumetMaintenance;
        if (document.getElementById('playMaintenanceToggle')) document.getElementById('playMaintenanceToggle').checked = !!data.playMaintenance;
        if (document.getElementById('playConsumetMaintenanceToggle')) document.getElementById('playConsumetMaintenanceToggle').checked = !!data.playConsumetMaintenance;
        maintenanceTemplate.value = data.activeTemplate || 'Scheduled Downtime';
        if (document.getElementById('maintenanceTitle')) document.getElementById('maintenanceTitle').value = data.maintenanceTitle || '';
        if (document.getElementById('maintenanceText')) document.getElementById('maintenanceText').value = data.maintenanceText || '';
        
        const musicMode = data.maintenanceMusicMode || 'query';
        const musicQuery = data.maintenanceMusicQuery || 'lofi relax';
        
        document.getElementById('maintenanceMusicMode').value = musicMode;
        document.getElementById('maintenanceMusicQuery').value = musicQuery;
        
        if (document.getElementById('powerMusicMode')) {
            document.getElementById('powerMusicMode').value = musicMode;
            document.getElementById('powerMusicQuery').value = musicQuery;
        }

        window.adminSavedPlaylist = data.maintenanceMusicPlaylist || [];
        window.renderAdminSavedPlaylist();
        if (document.getElementById('powerSavedPlaylist')) {
            window.renderAdminSavedPlaylist('power');
        }
        toggleMusicInputs();

        // Populate Maintenance Video Broadcast Fields
        if (document.getElementById('maintenanceVideoEnabledToggle')) {
            document.getElementById('maintenanceVideoEnabledToggle').checked = !!data.maintenanceVideoEnabled;
        }
        if (document.getElementById('maintenanceVideoType')) {
            document.getElementById('maintenanceVideoType').value = data.maintenanceVideoType || 'auto';
        }
        if (typeof window.handleVideoTypeChange === 'function') {
            window.handleVideoTypeChange();
        }
        if (document.getElementById('maintenanceVideoUrl')) {
            document.getElementById('maintenanceVideoUrl').value = data.maintenanceVideoUrl || '';
        }
        if (document.getElementById('maintenanceVideoTitle')) {
            document.getElementById('maintenanceVideoTitle').value = data.maintenanceVideoTitle || '';
        }
        if (document.getElementById('maintenanceVideoSubtitle')) {
            document.getElementById('maintenanceVideoSubtitle').value = data.maintenanceVideoSubtitle || '';
        }
        if (document.getElementById('maintenanceVideoAutoplay')) {
            document.getElementById('maintenanceVideoAutoplay').checked = data.maintenanceVideoAutoplay !== false;
        }
        if (document.getElementById('maintenanceVideoMuted')) {
            document.getElementById('maintenanceVideoMuted').checked = !!data.maintenanceVideoMuted;
        }
        if (document.getElementById('maintenanceVideoLoop')) {
            document.getElementById('maintenanceVideoLoop').checked = data.maintenanceVideoLoop !== false;
        }
        if (document.getElementById('videoUploadStatus') && data.maintenanceVideoUploadedFile) {
            document.getElementById('videoUploadStatus').innerHTML = `Current Upload: <span class="text-red-400 font-bold">${data.maintenanceVideoUploadedFile}</span>`;
        }

        // Populate Schedule Fields
        if (data.maintenanceSchedule) {
            if (document.getElementById('scheduleEnabledToggle')) {
                document.getElementById('scheduleEnabledToggle').checked = !!data.maintenanceSchedule.enabled;
            }
            if (document.getElementById('scheduleDateTimeInput')) {
                const tzOffset = new Date().getTimezoneOffset() * 60000;
                const localISOTime = data.maintenanceSchedule.scheduledTime ? (new Date(new Date(data.maintenanceSchedule.scheduledTime).getTime() - tzOffset)).toISOString().slice(0, 16) : '';
                document.getElementById('scheduleDateTimeInput').value = localISOTime;
            }
            if (document.getElementById('scheduleNoticeInput')) {
                document.getElementById('scheduleNoticeInput').value = data.maintenanceSchedule.noticeText || '';
            }
            if (document.getElementById('scheduleAutoActivateToggle')) {
                document.getElementById('scheduleAutoActivateToggle').checked = data.maintenanceSchedule.autoActivate !== false;
            }
            
            // Trigger UI update
            const schedToggle = document.getElementById('scheduleEnabledToggle');
            const schedWrapper = document.getElementById('scheduleConfigWrapper');
            if (schedToggle && schedWrapper) {
                if (schedToggle.checked) {
                    schedWrapper.classList.remove('opacity-50', 'pointer-events-none');
                } else {
                    schedWrapper.classList.add('opacity-50', 'pointer-events-none');
                }
            }
        }
    } catch (err) {
        console.error('Failed to fetch maintenance details:', err);
    }
}

// Sync music settings between sections
window.syncMusicSettings = function(source) {
    const isPower = source === 'power';
    const mode = document.getElementById(isPower ? 'powerMusicMode' : 'maintenanceMusicMode')?.value || 'query';
    const query = document.getElementById(isPower ? 'powerMusicQuery' : 'maintenanceMusicQuery')?.value || '';
    
    if (document.getElementById('maintenanceMusicMode')) document.getElementById('maintenanceMusicMode').value = mode;
    if (document.getElementById('maintenanceMusicQuery')) document.getElementById('maintenanceMusicQuery').value = query;
    if (document.getElementById('powerMusicMode')) document.getElementById('powerMusicMode').value = mode;
    if (document.getElementById('powerMusicQuery')) document.getElementById('powerMusicQuery').value = query;
    
    toggleMusicInputs();
};

window.saveMusicOnly = async function(source = 'maintenance') {
    const isPower = source === 'power';
    const mode = document.getElementById(isPower ? 'powerMusicMode' : 'maintenanceMusicMode')?.value || 'query';
    const query = document.getElementById(isPower ? 'powerMusicQuery' : 'maintenanceMusicQuery')?.value?.trim() || 'lofi relax';
    
    if (document.getElementById('maintenanceMusicMode')) document.getElementById('maintenanceMusicMode').value = mode;
    if (document.getElementById('maintenanceMusicQuery')) document.getElementById('maintenanceMusicQuery').value = query;
    if (document.getElementById('powerMusicMode')) document.getElementById('powerMusicMode').value = mode;
    if (document.getElementById('powerMusicQuery')) document.getElementById('powerMusicQuery').value = query;

    const payload = {
        maintenanceMode: maintenanceToggle ? maintenanceToggle.checked : false,
        maintenanceAdminBypass: document.getElementById("maintenanceAdminBypassToggle") ? document.getElementById("maintenanceAdminBypassToggle").checked : false,
        consumetMaintenance: document.getElementById('consumetMaintenanceToggle') ? document.getElementById('consumetMaintenanceToggle').checked : false,
        playMaintenance: document.getElementById('playMaintenanceToggle') ? document.getElementById('playMaintenanceToggle').checked : false,
        playConsumetMaintenance: document.getElementById('playConsumetMaintenanceToggle') ? document.getElementById('playConsumetMaintenanceToggle').checked : false,
        activeTemplate: maintenanceTemplate ? maintenanceTemplate.value : 'Scheduled Downtime',
        maintenanceTitle: document.getElementById('maintenanceTitle') ? document.getElementById('maintenanceTitle').value.trim() : '',
        maintenanceText: document.getElementById('maintenanceText') ? document.getElementById('maintenanceText').value.trim() : '',
        maintenanceMusicMode: mode,
        maintenanceMusicQuery: query,
        maintenanceMusicPlaylist: window.adminSavedPlaylist || [],
        maintenanceVideoEnabled: document.getElementById('maintenanceVideoEnabledToggle') ? document.getElementById('maintenanceVideoEnabledToggle').checked : false,
        maintenanceVideoType: document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto',
        maintenanceVideoUrl: document.getElementById('maintenanceVideoUrl') ? document.getElementById('maintenanceVideoUrl').value.trim() : '',
        maintenanceVideoTitle: document.getElementById('maintenanceVideoTitle') ? document.getElementById('maintenanceVideoTitle').value.trim() : '',
        maintenanceVideoSubtitle: document.getElementById('maintenanceVideoSubtitle') ? document.getElementById('maintenanceVideoSubtitle').value.trim() : '',
        maintenanceVideoAutoplay: document.getElementById('maintenanceVideoAutoplay') ? document.getElementById('maintenanceVideoAutoplay').checked : true,
        maintenanceVideoMuted: document.getElementById('maintenanceVideoMuted') ? document.getElementById('maintenanceVideoMuted').checked : false,
        maintenanceVideoLoop: document.getElementById('maintenanceVideoLoop') ? document.getElementById('maintenanceVideoLoop').checked : true,
        scheduleEnabled: document.getElementById('scheduleEnabledToggle') ? document.getElementById('scheduleEnabledToggle').checked : false,
        scheduledTime: (document.getElementById('scheduleDateTimeInput') && document.getElementById('scheduleDateTimeInput').value) ? new Date(document.getElementById('scheduleDateTimeInput').value).toISOString() : '',
        scheduleNoticeText: document.getElementById('scheduleNoticeInput') ? document.getElementById('scheduleNoticeInput').value.trim() : '',
        scheduleAutoActivate: document.getElementById('scheduleAutoActivateToggle') ? document.getElementById('scheduleAutoActivateToggle').checked : true
    };

    try {
        const res = await secureFetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Success', 'Maintenance music configuration saved successfully!', 'success');
        } else {
            showToast('Error', data.message || 'Failed to save', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to save music settings', 'error');
    }
};

window.startLiveVideoBroadcastNow = async function() {
    const toggle = document.getElementById('maintenanceVideoEnabledToggle');
    if (toggle) toggle.checked = true;
    const urlInput = document.getElementById('maintenanceVideoUrl');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
        showToast('No Video URL', 'Please enter a video URL, select a preset, or upload a video first.', 'error');
        return;
    }
    showToast('🔴 Going Live', 'Broadcasting video live to all connected viewers...', 'info');
    await window.saveVideoBroadcastOnly();
};

window.saveVideoBroadcastOnly = async function() {
    const payload = {
        maintenanceMode: maintenanceToggle ? maintenanceToggle.checked : false,
        maintenanceAdminBypass: document.getElementById("maintenanceAdminBypassToggle") ? document.getElementById("maintenanceAdminBypassToggle").checked : false,
        consumetMaintenance: document.getElementById('consumetMaintenanceToggle') ? document.getElementById('consumetMaintenanceToggle').checked : false,
        playMaintenance: document.getElementById('playMaintenanceToggle') ? document.getElementById('playMaintenanceToggle').checked : false,
        playConsumetMaintenance: document.getElementById('playConsumetMaintenanceToggle') ? document.getElementById('playConsumetMaintenanceToggle').checked : false,
        activeTemplate: maintenanceTemplate ? maintenanceTemplate.value : 'Scheduled Downtime',
        maintenanceTitle: document.getElementById('maintenanceTitle') ? document.getElementById('maintenanceTitle').value.trim() : '',
        maintenanceText: document.getElementById('maintenanceText') ? document.getElementById('maintenanceText').value.trim() : '',
        maintenanceMusicMode: document.getElementById('maintenanceMusicMode') ? document.getElementById('maintenanceMusicMode').value : 'query',
        maintenanceMusicQuery: document.getElementById('maintenanceMusicQuery') ? document.getElementById('maintenanceMusicQuery').value.trim() : '',
        maintenanceMusicPlaylist: window.adminSavedPlaylist || [],
        maintenanceVideoEnabled: document.getElementById('maintenanceVideoEnabledToggle') ? document.getElementById('maintenanceVideoEnabledToggle').checked : false,
        maintenanceVideoType: document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto',
        maintenanceVideoUrl: document.getElementById('maintenanceVideoUrl') ? document.getElementById('maintenanceVideoUrl').value.trim() : '',
        maintenanceVideoTitle: document.getElementById('maintenanceVideoTitle') ? document.getElementById('maintenanceVideoTitle').value.trim() : '',
        maintenanceVideoSubtitle: document.getElementById('maintenanceVideoSubtitle') ? document.getElementById('maintenanceVideoSubtitle').value.trim() : '',
        maintenanceVideoAutoplay: document.getElementById('maintenanceVideoAutoplay') ? document.getElementById('maintenanceVideoAutoplay').checked : true,
        maintenanceVideoMuted: document.getElementById('maintenanceVideoMuted') ? document.getElementById('maintenanceVideoMuted').checked : false,
        maintenanceVideoLoop: document.getElementById('maintenanceVideoLoop') ? document.getElementById('maintenanceVideoLoop').checked : true,
        scheduleEnabled: document.getElementById('scheduleEnabledToggle') ? document.getElementById('scheduleEnabledToggle').checked : false,
        scheduledTime: (document.getElementById('scheduleDateTimeInput') && document.getElementById('scheduleDateTimeInput').value) ? new Date(document.getElementById('scheduleDateTimeInput').value).toISOString() : '',
        scheduleNoticeText: document.getElementById('scheduleNoticeInput') ? document.getElementById('scheduleNoticeInput').value.trim() : '',
        scheduleAutoActivate: document.getElementById('scheduleAutoActivateToggle') ? document.getElementById('scheduleAutoActivateToggle').checked : true
    };

    try {
        const res = await secureFetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            const isLive = payload.maintenanceVideoEnabled && payload.maintenanceVideoUrl;
            showToast(isLive ? '🔴 Stream Live!' : 'Broadcast Saved', isLive ? 'Video broadcast is now updating LIVE across all viewers without reloading!' : 'Maintenance Video Broadcast settings saved successfully!', 'success');
        } else {
            showToast('Error', data.message || 'Failed to save video broadcast settings.', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to save broadcast settings', 'error');
    }
};

function showAdminToast(title, message, type = 'info') {
    if (typeof showToast === 'function') {
        showToast(title, message, type);
    } else {
        console.log(`[AdminToast] [${type}] ${title}: ${message}`);
    }
}
window.showAdminToast = showAdminToast;

window.handleVideoTypeChange = function() {
    const typeSelect = document.getElementById('maintenanceVideoType');
    const standardInput = document.getElementById('standardUrlInputBlock');
    const webrtcStudio = document.getElementById('webrtcStudioBlock');
    
    if (typeSelect && standardInput && webrtcStudio) {
        if (typeSelect.value === 'webrtc') {
            standardInput.classList.add('hidden');
            webrtcStudio.classList.remove('hidden');
        } else {
            standardInput.classList.remove('hidden');
            webrtcStudio.classList.add('hidden');
        }
    }
    if (window.lucide) lucide.createIcons();
};

window.selectWebRTCBroadcast = function() {
    const typeSelect = document.getElementById('maintenanceVideoType');
    if (typeSelect) {
        typeSelect.value = 'webrtc';
        if (typeof window.handleVideoTypeChange === 'function') {
            window.handleVideoTypeChange();
        }
    }
    if (document.getElementById('maintenanceVideoEnabledToggle')) {
        document.getElementById('maintenanceVideoEnabledToggle').checked = true;
    }
    if (typeof window.openWebRTCStudio === 'function') {
        window.openWebRTCStudio();
    }
};

window.openWebRTCStudio = function() {
    const modal = document.getElementById('webrtcStudioModal');
    if(modal) {
        modal.classList.remove('hidden');
        if(window.lucide) lucide.createIcons();
        detectWebRTCDevices(false);
        initWebRTCDevices();
    }
};

// --- WebRTC Professional Studio Engine ---
let localStream = null;
let currentCameraDeviceId = null;
let currentMicDeviceId = null;
let isScreenSharing = false;
let screenStream = null;
let webrtcSelectedQuality = '720p';
let isCamMuted = false;
let isMicMuted = false;
let isMirrored = false;
let audioContext = null;
let audioAnalyser = null;
let audioSourceNode = null;
let vuMeterAnimFrame = null;
let detectedCameras = [];
let detectedMics = [];
let isDeviceChangeListening = false;

const WEBRTC_QUALITY_PRESETS = {
    '1080p': {
        label: '1080p FHD (Crystal • 3.5 Mbps)',
        video: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 60 } },
        maxBitrate: 3500000,
        sdpBitrate: 3500
    },
    '720p': {
        label: '720p HD (Optimal • 2.2 Mbps)',
        video: { width: { ideal: 1280, min: 960 }, height: { ideal: 720, min: 540 }, frameRate: { ideal: 30, max: 60 } },
        maxBitrate: 2200000,
        sdpBitrate: 2200
    },
    '480p': {
        label: '480p SD (Low Bandwidth • 1.0 Mbps)',
        video: { width: { ideal: 854, min: 640 }, height: { ideal: 480, min: 360 }, frameRate: { ideal: 30 } },
        maxBitrate: 1000000,
        sdpBitrate: 1000
    }
};

// Boost WebRTC SDP bandwidth and audio fidelity
function boostSdp(sdp, bitrateKbps = 2500) {
    let modified = sdp;
    if (!modified.includes('b=AS:')) {
        modified = modified.replace(/(m=video [^\r\n]+[\r\n]+)/g, `$1b=AS:${bitrateKbps}\r\nb=TIAS:${bitrateKbps * 1000}\r\n`);
    }
    // Boost Opus audio to 128kbps stereo
    modified = modified.replace(/(a=rtpmap:(\d+) opus\/48000\/2[\r\n]+)/g, `$1a=fmtp:$2 maxaveragebitrate=128000;stereo=1;sprop-stereo=1;cbr=1\r\n`);
    return modified;
}

// Hardware Device Detection
window.detectWebRTCDevices = async function(isAuto = false, requestPermission = false) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        updateDeviceStatusBadges(0, 0, false);
        return;
    }

    try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let cameras = devices.filter(d => d.kind === 'videoinput');
        let mics = devices.filter(d => d.kind === 'audioinput');

        // Check if device labels are blank due to browser privacy policies before user permission
        const hasBlankLabels = (cameras.length > 0 && !cameras[0].label) || (mics.length > 0 && !mics[0].label);
        if ((hasBlankLabels && requestPermission) || (cameras.length === 0 && mics.length === 0 && requestPermission)) {
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                tempStream.getTracks().forEach(t => t.stop());
                devices = await navigator.mediaDevices.enumerateDevices();
                cameras = devices.filter(d => d.kind === 'videoinput');
                mics = devices.filter(d => d.kind === 'audioinput');
            } catch (permErr) {
                console.warn('[WebRTC Device Detect] Hardware permission not granted yet:', permErr);
            }
        }

        detectedCameras = cameras;
        detectedMics = mics;

        updateDeviceStatusBadges(detectedCameras.length, detectedMics.length, true);
        populateDeviceSelects(detectedCameras, detectedMics);

        // Auto-attach device change listener once
        if (!isDeviceChangeListening && navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                console.log('[WebRTC Hardware] Device connection change detected!');
                detectWebRTCDevices(true, false);
            });
            isDeviceChangeListening = true;
        }

        if (isAuto) {
            showAdminToast("Hardware Detected", `Updated: ${detectedCameras.length} Camera(s), ${detectedMics.length} Mic(s)`, "info");
        } else if (requestPermission) {
            showAdminToast("Hardware Scanned", `Detected: ${detectedCameras.length} Camera(s), ${detectedMics.length} Microphone(s)`, "success");
        }
    } catch(e) {
        console.warn('[WebRTC Device Detect] Error:', e);
    }
};

function updateDeviceStatusBadges(camCount, micCount, hasApi) {
    const camNameEl = document.getElementById('webrtcInlineCamDetectName');
    const camModalNameEl = document.getElementById('webrtcModalCamDetectName');
    const camBadgeEl = document.getElementById('webrtcInlineCamDetectBadge');
    const camModalBadgeEl = document.getElementById('webrtcModalCamDetectBadge');
    const camCountEl = document.getElementById('webrtcInlineCamCount');
    const camModalCountEl = document.getElementById('webrtcModalCamCount');

    const micNameEl = document.getElementById('webrtcInlineMicDetectName');
    const micModalNameEl = document.getElementById('webrtcModalMicDetectName');
    const micBadgeEl = document.getElementById('webrtcInlineMicDetectBadge');
    const micModalBadgeEl = document.getElementById('webrtcModalMicDetectBadge');
    const micCountEl = document.getElementById('webrtcInlineMicCount');
    const micModalCountEl = document.getElementById('webrtcModalMicCount');

    // Camera Badges
    if (camCount > 0) {
        const activeCam = detectedCameras[0]?.label || 'Active Camera';
        const camLabel = activeCam.length > 22 ? activeCam.substring(0, 20) + '...' : activeCam;
        if (camNameEl) camNameEl.innerText = `Detected (${camLabel})`;
        if (camModalNameEl) camModalNameEl.innerText = `Detected (${activeCam})`;
        [camBadgeEl, camModalBadgeEl].forEach(b => {
            if (b) {
                b.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                b.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
            }
        });
        if (camCountEl) camCountEl.innerText = `${camCount} available`;
        if (camModalCountEl) camModalCountEl.innerText = `${camCount} available`;
    } else {
        if (camNameEl) camNameEl.innerText = hasApi ? 'No Camera Found' : 'API Unavailable';
        if (camModalNameEl) camModalNameEl.innerText = hasApi ? 'No Camera Found' : 'API Unavailable';
        [camBadgeEl, camModalBadgeEl].forEach(b => {
            if (b) {
                b.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30';
                b.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
            }
        });
        if (camCountEl) camCountEl.innerText = '0 detected';
        if (camModalCountEl) camModalCountEl.innerText = '0 detected';
    }

    // Mic Badges
    if (micCount > 0) {
        const activeMic = detectedMics[0]?.label || 'Active Microphone';
        const micLabel = activeMic.length > 22 ? activeMic.substring(0, 20) + '...' : activeMic;
        if (micNameEl) micNameEl.innerText = `Detected (${micLabel})`;
        if (micModalNameEl) micModalNameEl.innerText = `Detected (${activeMic})`;
        [micBadgeEl, micModalBadgeEl].forEach(b => {
            if (b) {
                b.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                b.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
            }
        });
        if (micCountEl) micCountEl.innerText = `${micCount} available`;
        if (micModalCountEl) micModalCountEl.innerText = `${micCount} available`;
    } else {
        if (micNameEl) micNameEl.innerText = hasApi ? 'No Mic Found' : 'API Unavailable';
        if (micModalNameEl) micModalNameEl.innerText = hasApi ? 'No Mic Found' : 'API Unavailable';
        [micBadgeEl, micModalBadgeEl].forEach(b => {
            if (b) {
                b.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30';
                b.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
            }
        });
        if (micCountEl) micCountEl.innerText = '0 detected';
        if (micModalCountEl) micModalCountEl.innerText = '0 detected';
    }
}

function populateDeviceSelects(cameras, mics) {
    const vSelect = document.getElementById('webrtcVideoSource');
    const aSelect = document.getElementById('webrtcAudioSource');
    const vInlineSelect = document.getElementById('webrtcInlineVideoSource');
    const aInlineSelect = document.getElementById('webrtcInlineAudioSource');

    [vSelect, vInlineSelect].forEach(sel => {
        if (!sel) return;
        const savedVal = sel.value || currentCameraDeviceId;
        sel.innerHTML = '';
        if (cameras.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = 'Default System Camera';
            sel.appendChild(opt);
        } else {
            cameras.forEach((d, idx) => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.text = d.label || `Camera ${idx + 1}`;
                sel.appendChild(opt);
            });
        }
        if (savedVal) sel.value = savedVal;
    });

    [aSelect, aInlineSelect].forEach(sel => {
        if (!sel) return;
        const savedVal = sel.value || currentMicDeviceId;
        sel.innerHTML = '';
        if (mics.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = 'Default System Microphone';
            sel.appendChild(opt);
        } else {
            mics.forEach((d, idx) => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.text = d.label || `Microphone ${idx + 1}`;
                sel.appendChild(opt);
            });
        }
        if (savedVal) sel.value = savedVal;
    });
}

// Live Audio Input VU Meter (Mic Voice Detection)
function startAudioVUMeter(stream) {
    stopAudioVUMeter();
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        audioSourceNode = audioContext.createMediaStreamSource(stream);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256;
        audioAnalyser.smoothingTimeConstant = 0.65;
        audioSourceNode.connect(audioAnalyser);

        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function updateVU() {
            if (!audioAnalyser) return;
            audioAnalyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength; // 0 to 255
            const percent = Math.min(100, Math.round((average / 110) * 100));

            const isTrackMuted = !audioTrack.enabled || isMicMuted;

            const vuBars = [
                document.getElementById('webrtcInlineVUBars'),
                document.getElementById('webrtcModalVUBars')
            ];
            const vuTexts = [
                document.getElementById('webrtcInlineVUText'),
                document.getElementById('webrtcModalVUText')
            ];

            vuBars.forEach(bar => {
                if (!bar) return;
                if (isTrackMuted) {
                    bar.style.width = '0%';
                    bar.className = 'h-full bg-red-500 transition-all duration-75 w-0';
                } else {
                    bar.style.width = percent + '%';
                    if (percent > 75) {
                        bar.className = 'h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75';
                    } else if (percent > 35) {
                        bar.className = 'h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-75';
                    } else {
                        bar.className = 'h-full bg-emerald-400 transition-all duration-75';
                    }
                }
            });

            vuTexts.forEach(txt => {
                if (!txt) return;
                if (isTrackMuted) {
                    txt.innerText = 'MUTED';
                    txt.className = 'text-[10px] font-bold text-red-400 font-mono';
                } else if (percent <= 2) {
                    txt.innerText = 'Silent (0%)';
                    txt.className = 'text-[10px] font-medium text-gray-500 font-mono';
                } else {
                    txt.innerText = `${percent}% Active`;
                    txt.className = 'text-[10px] font-bold text-emerald-400 font-mono';
                }
            });

            vuMeterAnimFrame = requestAnimationFrame(updateVU);
        }

        updateVU();
    } catch(e) {
        console.warn('[WebRTC VU Meter] Init error:', e);
    }
}

function stopAudioVUMeter() {
    if (vuMeterAnimFrame) {
        cancelAnimationFrame(vuMeterAnimFrame);
        vuMeterAnimFrame = null;
    }
    if (audioSourceNode) {
        try { audioSourceNode.disconnect(); } catch(e) {}
        audioSourceNode = null;
    }
}

function updateVideoResolutionBadge() {
    const video = document.getElementById('webrtcInlineVideo') || document.getElementById('webrtcLocalVideo');
    if (!video || !video.videoWidth) return;
    const resText = `${video.videoWidth}x${video.videoHeight}`;
    const badges = [
        document.getElementById('webrtcInlineResBadge'),
        document.getElementById('webrtcModalResBadge')
    ];
    badges.forEach(b => {
        if (b) {
            b.innerText = resText + (isScreenSharing ? ' • Screen' : ' • 30fps');
            b.classList.remove('hidden');
        }
    });
}

// Initialize Local Camera & Microphone Stream
async function initWebRTCDevices(videoDeviceId, audioDeviceId) {
    try {
        if (localStream && !isScreenSharing) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }

        const qualityConfig = WEBRTC_QUALITY_PRESETS[webrtcSelectedQuality] || WEBRTC_QUALITY_PRESETS['720p'];
        
        const videoConstraint = videoDeviceId 
            ? { deviceId: { exact: videoDeviceId }, ...qualityConfig.video } 
            : { ...qualityConfig.video };

        const audioConstraint = audioDeviceId
            ? { deviceId: { exact: audioDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 };

        const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraint,
            audio: audioConstraint
        });
        localStream = stream;

        // Apply audio & video mute states
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) vTrack.enabled = !isCamMuted;
        const aTrack = stream.getAudioTracks()[0];
        if (aTrack) aTrack.enabled = !isMicMuted;

        // Modal video
        const video = document.getElementById('webrtcLocalVideo');
        if (video) {
            video.srcObject = stream;
            video.classList.remove('hidden');
            document.getElementById('webrtcPlaceholder')?.classList.add('hidden');
            video.onloadedmetadata = () => updateVideoResolutionBadge();
        }

        // Inline video
        const inlineVideo = document.getElementById('webrtcInlineVideo');
        if (inlineVideo) {
            inlineVideo.srcObject = stream;
            inlineVideo.classList.remove('hidden');
            document.getElementById('webrtcInlinePlaceholder')?.classList.add('hidden');
            inlineVideo.onloadedmetadata = () => updateVideoResolutionBadge();
        }

        // Start Live VU Meter
        startAudioVUMeter(stream);

        // Populate device lists and update detection badges
        await detectWebRTCDevices(false);

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Camera/Mic access denied or failed", e);
        showAdminToast("Hardware Permission", "Please allow camera & microphone access to stream via WebRTC.", "error");
    }
}

// Seamless Camera Switching (Hot-swap without disconnecting viewers)
window.switchWebRTCCamera = async function(deviceId) {
    if (!deviceId) return;
    currentCameraDeviceId = deviceId;
    if (isScreenSharing) {
        showAdminToast("Notice", "Screen share active. Switch will take effect when screen share ends.", "info");
        return;
    }

    try {
        const qualityConfig = WEBRTC_QUALITY_PRESETS[webrtcSelectedQuality] || WEBRTC_QUALITY_PRESETS['720p'];
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, ...qualityConfig.video },
            audio: false
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) return;
        newVideoTrack.enabled = !isCamMuted;

        if (localStream) {
            const oldTrack = localStream.getVideoTracks()[0];
            if (oldTrack) {
                localStream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            localStream.addTrack(newVideoTrack);
        } else {
            localStream = newStream;
        }

        ['webrtcLocalVideo', 'webrtcInlineVideo'].forEach(id => {
            const v = document.getElementById(id);
            if (v) v.srcObject = localStream;
        });

        // Replace track across all active viewer peer connections
        broadcasterPeerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack).catch(e => console.warn('[WebRTC] replaceTrack error:', e));
            }
        });

        showAdminToast("Camera Switched", "Camera input updated cleanly.", "success");
        setTimeout(updateVideoResolutionBadge, 400);
    } catch(e) {
        console.error('[WebRTC] Camera switch failed:', e);
        showAdminToast("Camera Switch Failed", e.message || "Failed to switch camera", "error");
    }
};

// Seamless Microphone Switching (Hot-swap without disconnecting viewers)
window.switchWebRTCMic = async function(deviceId) {
    if (!deviceId) return;
    currentMicDeviceId = deviceId;

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            },
            video: false
        });
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (!newAudioTrack) return;
        newAudioTrack.enabled = !isMicMuted;

        if (localStream) {
            const oldTrack = localStream.getAudioTracks()[0];
            if (oldTrack) {
                localStream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            localStream.addTrack(newAudioTrack);
        }

        // Replace track across all active viewer peer connections
        broadcasterPeerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender) {
                sender.replaceTrack(newAudioTrack).catch(e => console.warn('[WebRTC] replaceAudioTrack error:', e));
            }
        });

        // Reconnect VU Meter to new mic
        startAudioVUMeter(localStream);
        showAdminToast("Microphone Switched", "Microphone input updated cleanly.", "success");
    } catch(e) {
        console.error('[WebRTC] Mic switch failed:', e);
        showAdminToast("Mic Switch Failed", e.message || "Failed to switch microphone", "error");
    }
};

// Video Quality Selector (HD / Full HD / SD)
window.changeWebRTCQuality = async function(preset) {
    if (!WEBRTC_QUALITY_PRESETS[preset]) return;
    webrtcSelectedQuality = preset;
    const config = WEBRTC_QUALITY_PRESETS[preset];

    ['webrtcQualitySelect', 'webrtcInlineQualitySelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = preset;
    });

    if (localStream && !isScreenSharing) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.applyConstraints) {
            try {
                await videoTrack.applyConstraints(config.video);
            } catch(e) {
                console.warn('[WebRTC] applyConstraints error:', e);
            }
        }
    }

    // Boost RTCRtpSender encoding bitrate
    broadcasterPeerConnections.forEach(async (pc) => {
        const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender && videoSender.getParameters) {
            const params = videoSender.getParameters();
            if (params && params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = config.maxBitrate;
                try { await videoSender.setParameters(params); } catch(e) {}
            }
        }
    });

    const bitrateK = Math.round(config.maxBitrate / 1000) + ' kbps';
    ['webrtcBitrate', 'webrtcInlineBitrate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = `${preset.toUpperCase()} (~${bitrateK})`;
    });

    showAdminToast("Quality Updated", `Video quality set to ${config.label}`, "info");
    setTimeout(updateVideoResolutionBadge, 500);
};

// Screen Sharing / Presentation Mode
window.toggleWebRTCScreenShare = async function() {
    if (isScreenSharing) {
        await revertToCameraStream();
        return;
    }

    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 30, max: 60 } },
            audio: true
        });
        screenStream = displayStream;
        const screenTrack = displayStream.getVideoTracks()[0];
        if (!screenTrack) return;

        isScreenSharing = true;

        screenTrack.onended = () => {
            revertToCameraStream();
        };

        ['webrtcLocalVideo', 'webrtcInlineVideo'].forEach(id => {
            const v = document.getElementById(id);
            if (v) v.srcObject = displayStream;
        });

        // Replace track across viewers
        broadcasterPeerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack).catch(e => console.warn('[WebRTC] Screen replaceTrack error:', e));
            }
        });

        updateScreenShareBadges(true);
        showAdminToast("Screen Share Active", "Streaming screen/window directly to viewers.", "success");
        setTimeout(updateVideoResolutionBadge, 500);
    } catch(e) {
        console.warn('[WebRTC] Screen share canceled or failed:', e);
    }
};

async function revertToCameraStream() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    isScreenSharing = false;
    updateScreenShareBadges(false);

    if (localStream) {
        const camTrack = localStream.getVideoTracks()[0];
        if (camTrack) {
            ['webrtcLocalVideo', 'webrtcInlineVideo'].forEach(id => {
                const v = document.getElementById(id);
                if (v) v.srcObject = localStream;
            });
            broadcasterPeerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(camTrack).catch(e => console.warn('[WebRTC] Cam restore replaceTrack error:', e));
                }
            });
        }
    } else {
        await initWebRTCDevices(currentCameraDeviceId, currentMicDeviceId);
    }
    showAdminToast("Camera Restored", "Switched back to camera video feed.", "info");
    setTimeout(updateVideoResolutionBadge, 500);
}

function updateScreenShareBadges(isSharing) {
    const badges = [
        document.getElementById('webrtcInlineShareBadge'),
        document.getElementById('webrtcModalShareBadge')
    ];
    badges.forEach(b => {
        if (!b) return;
        if (isSharing) b.classList.remove('hidden');
        else b.classList.add('hidden');
    });

    const shareBtns = [
        document.getElementById('btnToggleInlineShare'),
        document.getElementById('btnToggleShare')
    ];
    shareBtns.forEach(btn => {
        if (!btn) return;
        if (isSharing) {
            btn.classList.add('bg-purple-600', 'text-white');
            btn.classList.remove('bg-black/80', 'bg-gray-900/90');
        } else {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('bg-black/80');
        }
    });
}

// Camera Mirror Preview Toggle
window.toggleWebRTCMirror = function() {
    isMirrored = !isMirrored;
    ['webrtcInlineVideo', 'webrtcLocalVideo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.transform = isMirrored ? 'scaleX(-1)' : 'none';
        }
    });
    const btns = [document.getElementById('btnToggleInlineMirror'), document.getElementById('btnToggleMirror')];
    btns.forEach(b => {
        if (b) {
            if (isMirrored) {
                b.classList.add('bg-blue-600', 'text-white');
                b.classList.remove('bg-black/80', 'bg-gray-900/90', 'text-gray-300');
            } else {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-black/80', 'text-gray-300');
            }
        }
    });
    showAdminToast("Preview Mirrored", isMirrored ? "Camera mirror view active" : "Standard view active", "info");
};

// Toggle Camera On/Off
window.toggleWebrtcCam = function() {
    if(!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if(track) {
        isCamMuted = !isCamMuted;
        track.enabled = !isCamMuted;
        const btns = [document.getElementById('btnToggleCam'), document.getElementById('btnToggleInlineCam')];
        const icons = [document.getElementById('iconCam'), document.getElementById('iconInlineCam')];
        
        btns.forEach(btn => {
            if (!btn) return;
            if (track.enabled) {
                btn.classList.remove('bg-red-600/90', 'bg-red-600');
                btn.classList.add('bg-black/80');
            } else {
                btn.classList.add('bg-red-600/90');
                btn.classList.remove('bg-black/80');
            }
        });

        icons.forEach(icon => {
            if (!icon) return;
            icon.setAttribute('data-lucide', track.enabled ? 'video' : 'video-off');
        });

        if(window.lucide) lucide.createIcons();
    }
};

// Toggle Microphone On/Off
window.toggleWebrtcMic = function() {
    if(!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if(track) {
        isMicMuted = !isMicMuted;
        track.enabled = !isMicMuted;
        const btns = [document.getElementById('btnToggleMic'), document.getElementById('btnToggleInlineMic')];
        const icons = [document.getElementById('iconMic'), document.getElementById('iconInlineMic')];
        
        btns.forEach(btn => {
            if (!btn) return;
            if (track.enabled) {
                btn.classList.remove('bg-red-600/90', 'bg-red-600');
                btn.classList.add('bg-black/80');
            } else {
                btn.classList.add('bg-red-600/90');
                btn.classList.remove('bg-black/80');
            }
        });

        icons.forEach(icon => {
            if (!icon) return;
            icon.setAttribute('data-lucide', track.enabled ? 'mic' : 'mic-off');
        });

        if(window.lucide) lucide.createIcons();
    }
};

let broadcasterPeerConnections = new Map();
let broadcasterSignalingTimer = null;
let broadcasterFrameTimer = null;
let broadcasterPingTimer = null;
let broadcasterOffscreenCanvas = null;

window.startWebRTCBroadcast = function() {
    if(!localStream) {
        showAdminToast("Initializing Hardware", "Connecting camera & mic before broadcast...", "info");
        initWebRTCDevices().then(() => {
            if (localStream) window.startWebRTCBroadcast();
        });
        return;
    }

    document.getElementById('btnStartWebRTC')?.classList.add('hidden');
    document.getElementById('btnStopWebRTC')?.classList.remove('hidden');
    document.getElementById('btnStartWebRTCInline')?.classList.add('hidden');
    document.getElementById('btnStopWebRTCInline')?.classList.remove('hidden');
    
    const status = document.getElementById('webrtcStatus');
    const inlineStatus = document.getElementById('webrtcInlineLiveStatus');
    const inlineBadge = document.getElementById('webrtcInlineStatusBadge');
    const modalBadge = document.getElementById('webrtcModalStatusBadge');
    
    if(status) {
        status.innerText = 'LIVE ON AIR';
        status.className = 'text-red-500 font-bold animate-pulse';
    }
    if (inlineStatus) {
        inlineStatus.innerText = 'LIVE NOW';
        inlineStatus.className = 'text-red-400 font-bold animate-pulse';
    }
    if (inlineBadge) {
        inlineBadge.innerText = '🔴 LIVE ON AIR';
        inlineBadge.className = 'text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse';
    }
    if (modalBadge) {
        modalBadge.innerText = '🔴 LIVE ON AIR';
        modalBadge.className = 'text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse';
    }
    showAdminToast("Broadcast Active", "Your WebRTC stream is live on the maintenance screen in HD.", "success");
    
    // 1. Notify server of broadcast start
    fetch('/api/webrtc/broadcaster/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcasterId: 'admin_broadcaster' })
    }).catch(e => console.warn('[WebRTC Admin] Start error:', e));

    // 2. Auto-update maintenance config to enable WebRTC video
    const videoTitleInput = document.getElementById('maintenanceVideoTitle');
    const videoSubtitleInput = document.getElementById('maintenanceVideoSubtitle');
    const titleVal = videoTitleInput ? videoTitleInput.value.trim() : '';
    const subtitleVal = videoSubtitleInput ? videoSubtitleInput.value.trim() : '';

    const payload = {
        maintenanceMode: true,
        maintenanceVideoEnabled: true,
        maintenanceVideoType: 'webrtc',
        maintenanceVideoUrl: 'live_webrtc_stream',
        maintenanceVideoTitle: titleVal || 'ADMIN LIVE STREAM',
        maintenanceVideoSubtitle: subtitleVal || 'Official WebRTC Broadcast',
        maintenanceVideoAutoplay: true,
        maintenanceVideoMuted: false,
        maintenanceVideoLoop: true
    };
    
    secureFetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(() => refreshAdminData()).catch(() => {});

    // 3. Start Broadcaster PeerConnection Signaling Loop
    if (broadcasterSignalingTimer) clearInterval(broadcasterSignalingTimer);
    broadcasterSignalingTimer = setInterval(async () => {
        try {
            // Check for new viewers requesting connection
            const vRes = await fetch('/api/webrtc/broadcaster/viewers');
            if (vRes.ok) {
                const vData = await vRes.json();
                if (vData.viewers && Array.isArray(vData.viewers)) {
                    for (const viewerId of vData.viewers) {
                        if (!broadcasterPeerConnections.has(viewerId)) {
                            console.log('[WebRTC Admin] Initiating HD peer connection for viewer:', viewerId);
                            const pc = new RTCPeerConnection({
                                iceServers: [
                                    { urls: 'stun:stun.l.google.com:19302' },
                                    { urls: 'stun:stun1.l.google.com:19302' },
                                    { urls: 'stun:stun2.l.google.com:19302' },
                                    { urls: 'stun:stun.cloudflare.com:3478' }
                                ]
                            });

                            const activeStream = (isScreenSharing && screenStream) ? screenStream : localStream;
                            if (activeStream) {
                                activeStream.getTracks().forEach(track => pc.addTrack(track, activeStream));
                            }

                            pc.onicecandidate = (event) => {
                                if (event.candidate) {
                                    fetch('/api/webrtc/signal', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            from: 'admin_broadcaster',
                                            to: viewerId,
                                            type: 'candidate',
                                            data: event.candidate
                                        })
                                    }).catch(() => {});
                                }
                            };

                            pc.ontrack = (event) => {
                                console.log('[WebRTC Admin] Received remote track from participant:', viewerId, event.track.kind);
                                
                                if (event.track.kind === 'audio') {
                                    let guestAudio = document.getElementById('audio_guest_' + viewerId);
                                    if (!guestAudio) {
                                        guestAudio = document.createElement('audio');
                                        guestAudio.id = 'audio_guest_' + viewerId;
                                        guestAudio.autoplay = true;
                                        document.body.appendChild(guestAudio);
                                    }
                                    if (event.streams && event.streams[0]) {
                                        guestAudio.srcObject = event.streams[0];
                                    }
                                } else if (event.track.kind === 'video') {
                                    const guestVideo = document.getElementById('video_guest_' + viewerId);
                                    const guestImg = document.getElementById('guestFrame_' + viewerId);
                                    if (guestVideo) {
                                        guestVideo.srcObject = event.streams[0];
                                        guestVideo.classList.remove('hidden');
                                        if (guestImg) guestImg.classList.add('hidden');
                                        guestVideo.play().catch(e => console.warn('Guest video play error:', e));
                                    } else {
                                        // If the DOM element isn't ready yet, retry after a short delay
                                        setTimeout(() => {
                                            const retryVideo = document.getElementById('video_guest_' + viewerId);
                                            const retryImg = document.getElementById('guestFrame_' + viewerId);
                                            if (retryVideo) {
                                                retryVideo.srcObject = event.streams[0];
                                                retryVideo.classList.remove('hidden');
                                                if (retryImg) retryImg.classList.add('hidden');
                                                retryVideo.play().catch(() => {});
                                            }
                                        }, 1000);
                                    }
                                }
                            };

                            broadcasterPeerConnections.set(viewerId, pc);

                            try {
                                const offer = await pc.createOffer({
                                    offerToReceiveAudio: true,
                                    offerToReceiveVideo: true
                                });
                                
                                // Boost SDP bitrate & opus audio fidelity
                                const currentQuality = WEBRTC_QUALITY_PRESETS[webrtcSelectedQuality] || WEBRTC_QUALITY_PRESETS['720p'];
                                offer.sdp = boostSdp(offer.sdp, currentQuality.sdpBitrate);

                                await pc.setLocalDescription(offer);

                                // Boost sender bitrates directly
                                const senders = pc.getSenders();
                                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                                if (videoSender && videoSender.getParameters) {
                                    const params = videoSender.getParameters();
                                    if (params && params.encodings && params.encodings.length > 0) {
                                        params.encodings[0].maxBitrate = currentQuality.maxBitrate;
                                        params.encodings[0].maxFramerate = 30;
                                        params.encodings[0].priority = 'high';
                                        params.encodings[0].networkPriority = 'high';
                                        try { await videoSender.setParameters(params); } catch(e) {}
                                    }
                                }

                                await fetch('/api/webrtc/signal', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        from: 'admin_broadcaster',
                                        to: viewerId,
                                        type: 'offer',
                                        data: offer
                                    })
                                });
                            } catch (offerErr) {
                                console.warn('[WebRTC Admin] Error creating offer for', viewerId, offerErr);
                            }
                        }
                    }
                }
            }

            // Check incoming signals (answers and candidates from viewers)
            const sigRes = await fetch('/api/webrtc/signal/admin_broadcaster');
            if (sigRes.ok) {
                const sigData = await sigRes.json();
                if (sigData.signals && Array.isArray(sigData.signals)) {
                    for (const sig of sigData.signals) {
                        const pc = broadcasterPeerConnections.get(sig.from);
                        if (!pc) continue;
                        if (sig.type === 'answer') {
                            console.log('[WebRTC Admin] Received answer from viewer:', sig.from);
                            await pc.setRemoteDescription(new RTCSessionDescription(sig.data));
                        } else if (sig.type === 'offer') {
                            console.log('[WebRTC Admin] Received renegotiation offer from viewer:', sig.from);
                            await pc.setRemoteDescription(new RTCSessionDescription(sig.data));
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            fetch('/api/webrtc/signal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    from: 'admin_broadcaster',
                                    to: sig.from,
                                    type: 'answer',
                                    data: answer
                                })
                            }).catch(() => {});
                        } else if (sig.type === 'candidate') {
                            await pc.addIceCandidate(new RTCIceCandidate(sig.data));
                        }
                    }
                }
            }

            // Update viewer count on UI
            const stRes = await fetch('/api/webrtc/status');
            if (stRes.ok) {
                const stData = await stRes.json();
                const count = stData.viewerCount || 0;
                if (inlineStatus) inlineStatus.innerText = 'LIVE (' + count + ' viewer' + (count === 1 ? '' : 's') + ')';
                const vText = document.getElementById('webrtcViewers');
                if (vText) vText.innerText = count.toString();
            }
        } catch (e) {
            console.warn('[WebRTC Admin] Signaling loop error:', e);
        }
    }, 1200);

    // 4. Start Fallback Lightweight Frame Publisher (Guarantees immediate visual frame while P2P negotiates)
    if (!broadcasterOffscreenCanvas) {
        broadcasterOffscreenCanvas = document.createElement('canvas');
    }
    if (broadcasterFrameTimer) clearInterval(broadcasterFrameTimer);
    let isBroadcasterFrameUploading = false;
    broadcasterFrameTimer = setInterval(async () => {
        if (isBroadcasterFrameUploading) return;
        try {
            const videoEl = document.getElementById('webrtcLocalVideo') || document.getElementById('webrtcInlineVideo');
            if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0 && !isCamMuted) {
                isBroadcasterFrameUploading = true;
                // Scale to crisp, lightweight 640x360 to eliminate network choking and thread blocking
                const maxW = 640;
                const maxH = 360;
                const targetW = Math.min(maxW, videoEl.videoWidth);
                const targetH = Math.min(maxH, videoEl.videoHeight);
                broadcasterOffscreenCanvas.width = targetW;
                broadcasterOffscreenCanvas.height = targetH;
                const ctx = broadcasterOffscreenCanvas.getContext('2d');
                if (ctx) {
                    if (isMirrored) {
                        ctx.save();
                        ctx.translate(targetW, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(videoEl, 0, 0, targetW, targetH);
                        ctx.restore();
                    } else {
                        ctx.drawImage(videoEl, 0, 0, targetW, targetH);
                    }
                    const base64Data = broadcasterOffscreenCanvas.toDataURL('image/jpeg', 0.60);
                    await fetch('/api/webrtc/broadcaster/frame', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ frame: base64Data, mime: 'image/jpeg' })
                    });
                }
            }
        } catch (e) {
        } finally {
            isBroadcasterFrameUploading = false;
        }
    }, 160);

    // 5. Ping Broadcaster Liveness
    if (broadcasterPingTimer) clearInterval(broadcasterPingTimer);
    broadcasterPingTimer = setInterval(() => {
        fetch('/api/webrtc/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isBroadcaster: true })
        }).catch(() => {});
    }, 4000);
};

window.closeWebRTCStudio = function() {
    const modal = document.getElementById('webrtcStudioModal');
    if (modal) modal.classList.add('hidden');
};

window.stopWebRTCBroadcast = function() {
    if (broadcasterSignalingTimer) {
        clearInterval(broadcasterSignalingTimer);
        broadcasterSignalingTimer = null;
    }
    if (broadcasterFrameTimer) {
        clearInterval(broadcasterFrameTimer);
        broadcasterFrameTimer = null;
    }
    if (broadcasterPingTimer) {
        clearInterval(broadcasterPingTimer);
        broadcasterPingTimer = null;
    }

    broadcasterPeerConnections.forEach(pc => {
        try { pc.close(); } catch(e) {}
    });
    broadcasterPeerConnections.clear();

    fetch('/api/webrtc/broadcaster/stop', { method: 'POST' }).catch(() => {});

    document.getElementById('btnStopWebRTC')?.classList.add('hidden');
    document.getElementById('btnStartWebRTC')?.classList.remove('hidden');
    document.getElementById('btnStopWebRTCInline')?.classList.add('hidden');
    document.getElementById('btnStartWebRTCInline')?.classList.remove('hidden');
    
    const status = document.getElementById('webrtcStatus');
    const inlineStatus = document.getElementById('webrtcInlineLiveStatus');
    const inlineBadge = document.getElementById('webrtcInlineStatusBadge');
    const modalBadge = document.getElementById('webrtcModalStatusBadge');
    
    if(status) {
        status.innerText = 'Offline';
        status.className = 'text-yellow-400 font-bold';
    }
    if (inlineStatus) {
        inlineStatus.innerText = 'Standby';
        inlineStatus.className = 'text-yellow-400 font-bold';
    }
    if (inlineBadge) {
        inlineBadge.innerText = 'Ready to Go Live';
        inlineBadge.className = 'text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    }
    if (modalBadge) {
        modalBadge.innerText = 'Offline';
        modalBadge.className = 'text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    }
    showAdminToast("Broadcast Ended", "WebRTC live broadcast stopped.", "info");
};

// ==========================================
// INTERACTIVE VIDEO CONFERENCE & CO-HOSTS
// ==========================================

let adminConferencePollTimer = null;
let adminChatActiveTab = 'all';
let cachedConferenceState = null;

window.toggleAdminConference = async function(enabled) {
    try {
        const res = await fetch('/api/webrtc/conference/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !!enabled })
        });
        const data = await res.json();
        const isEnabled = !!data.conferenceEnabled;

        const badges = [document.getElementById('adminConferenceBadge'), document.getElementById('modalAdminConferenceBadge')];
        const toggles = [document.getElementById('adminConferenceToggle'), document.getElementById('modalAdminConferenceToggle')];
        const labels = [document.getElementById('adminConferenceToggleLabel'), document.getElementById('modalAdminConferenceToggleLabel')];

        badges.forEach(b => {
            if (b) {
                b.innerText = isEnabled ? 'Active' : 'Disabled';
                b.className = isEnabled
                    ? 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-800 text-gray-400 border border-gray-700';
            }
        });
        toggles.forEach(t => { if (t) t.checked = isEnabled; });
        labels.forEach(l => { if (l) l.innerText = isEnabled ? 'Requests Open' : 'Allow Requests'; });

        if (isEnabled) {
            showAdminToast("Conference Enabled", "Viewers can now request to join stage (face-to-face or private consultation).", "success");
            window.startAdminConferencePolling();
        } else {
            showAdminToast("Conference Disabled", "Viewer stage requests are now closed.", "info");
        }
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Could not toggle conference mode", "error");
    }
};

window.refreshAdminConferenceState = async function() {
    try {
        const res = await fetch('/api/webrtc/conference/state?isAdmin=true&t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        cachedConferenceState = data;

        const isEnabled = !!data.conferenceEnabled;
        const badges = [document.getElementById('adminConferenceBadge'), document.getElementById('modalAdminConferenceBadge')];
        const toggles = [document.getElementById('adminConferenceToggle'), document.getElementById('modalAdminConferenceToggle')];
        const labels = [document.getElementById('adminConferenceToggleLabel'), document.getElementById('modalAdminConferenceToggleLabel')];

        toggles.forEach(t => {
            if (t && t.checked !== isEnabled) t.checked = isEnabled;
        });
        badges.forEach(b => {
            if (b) {
                b.innerText = isEnabled ? 'Active' : 'Disabled';
                b.className = isEnabled
                    ? 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-800 text-gray-400 border border-gray-700';
            }
        });
        labels.forEach(l => {
            if (l) l.innerText = isEnabled ? 'Requests Open' : 'Allow Requests';
        });

        // 1. Render Pending Requests
        const pendingBadges = [document.getElementById('adminPendingCountBadge'), document.getElementById('modalAdminPendingCountBadge')];
        const pendingLists = [document.getElementById('adminPendingRequestsList'), document.getElementById('modalAdminPendingRequestsList')];
        const pending = data.pendingRequests || [];
        pendingBadges.forEach(pb => { if (pb) pb.innerText = pending.length.toString(); });

        let pendingHtml = '';
        if (pending.length === 0) {
            pendingHtml = '<div class="p-3 rounded-lg bg-black/40 border border-dashed border-gray-800 text-center text-gray-500 text-xs">No pending join requests from viewers right now.</div>';
        } else {
            for (const req of pending) {
                const modeHtml = req.isPrivate
                    ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">🔒 Private 1-on-1</span>'
                    : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">🌐 Public Stage</span>';
                
                pendingHtml += `
                    <div class="p-2 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-between gap-2 shadow-sm">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0">
                                ${escapeHtml((req.name || 'V')[0].toUpperCase())}
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-white text-xs font-bold truncate">${escapeHtml(req.name || 'Viewer')}</span>
                                    ${modeHtml}
                                </div>
                                <span class="text-[9px] text-gray-400">Waiting to join conference</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button type="button" onclick="window.approveStageRequest('${escapeHtml(req.id || req.viewerId)}')" class="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm">
                                Approve
                            </button>
                            <button type="button" onclick="window.rejectStageRequest('${escapeHtml(req.id || req.viewerId)}')" class="px-2 py-1 rounded-md bg-gray-800 hover:bg-red-600/30 text-gray-400 hover:text-red-300 text-xs font-bold transition-all border border-gray-700">
                                Decline
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        pendingLists.forEach(pl => { if (pl) pl.innerHTML = pendingHtml; });

        // 2. Render Active Stage Participants
        const activeBadges = [document.getElementById('adminActiveCountBadge'), document.getElementById('modalAdminActiveCountBadge')];
        const activeLists = [document.getElementById('adminActiveParticipantsList'), document.getElementById('modalAdminActiveParticipantsList')];
        const participants = data.participants || [];
        const guests = participants.filter(p => p.role !== 'host');
        activeBadges.forEach(ab => { if (ab) ab.innerText = guests.length.toString(); });

        const newAdminGuestsHash = guests.map(g => g.id + ':' + (g.isPrivate ? '1' : '0') + ':' + (g.isMuted ? '1' : '0') + ':' + (g.isVideoOff ? '1' : '0') + ':' + (g.name || '')).join('|');

        if (window._adminGuestsHash !== newAdminGuestsHash) {
            window._adminGuestsHash = newAdminGuestsHash;
            let activeHtml = '';
            if (guests.length === 0) {
                activeHtml = '<div class="col-span-full p-3 rounded-lg bg-black/40 border border-dashed border-gray-800 text-center text-gray-500 text-xs">Only Admin is currently on stage. Approved guests will appear here with live video & mute controls.</div>';
            } else {
                for (const g of guests) {
                    const isMuted = !!g.isMuted;
                    const isVideoOff = !!g.isVideoOff;
                    const isPrivate = !!g.isPrivate;
                    const modeBadge = isPrivate
                        ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">🔒 Private</span>'
                        : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">🌐 Public</span>';

                    activeHtml += `
                        <div class="p-2.5 rounded-xl bg-gray-900/90 border border-gray-700 flex flex-col justify-between gap-2 relative group overflow-hidden shadow-md">
                            <div class="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center">
                                <video id="video_guest_${escapeHtml(g.id)}" autoplay playsinline class="w-full h-full object-cover hidden"></video>
                                ${!isVideoOff ? `
                                <img id="guestFrame_${escapeHtml(g.id)}" data-guest-id="${escapeHtml(g.id)}" src="/api/webrtc/conference/guest-frame/${escapeHtml(g.id)}?isAdmin=true&t=${Date.now()}" onload="window.handleAdminGuestFrameLoad(this)" onerror="window.handleAdminGuestFrameError(this)" class="w-full h-full object-cover" />
                                ` : ''}
                                <div id="guestIcon_${escapeHtml(g.id)}" class="${!isVideoOff ? 'hidden' : 'flex'} flex-col items-center justify-center text-gray-400 p-2 text-center">
                                    <div class="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-xs">
                                        ${escapeHtml((g.name || 'G')[0].toUpperCase())}
                                    </div>
                                    <span class="text-[9px] text-gray-300 mt-1 font-semibold">${escapeHtml(g.name || 'Guest')}</span>
                                    <span class="text-[8px] text-amber-400/90">${isVideoOff ? '📹 Video Off' : 'No Frame'}</span>
                                </div>
                                <div class="absolute top-1.5 left-1.5">
                                    ${modeBadge}
                                </div>
                            </div>

                            <div class="flex items-center justify-between gap-1">
                                <div class="min-w-0">
                                    <div class="text-white text-xs font-bold truncate">${escapeHtml(g.name || 'Guest')}</div>
                                    <div class="text-[9px] text-gray-400 font-mono">${isMuted ? '🔇 Muted' : '🔊 Live'}</div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button type="button" onclick="window.toggleGuestMute('${escapeHtml(g.id)}', ${isMuted})" class="px-2 py-1 rounded-md ${isMuted ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40' : 'bg-gray-800 text-gray-300 hover:text-white'} text-[10px] font-semibold transition-all">
                                        ${isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    <button type="button" onclick="window.kickStageParticipant('${escapeHtml(g.id)}')" class="px-2 py-1 rounded-md bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white text-[10px] font-semibold transition-all border border-red-500/40">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            activeLists.forEach(al => { if (al) al.innerHTML = activeHtml; });
        } else {
            // Smoothly refresh guest frames without re-rendering the DOM
            for (const g of guests) {
                if (!g.isVideoOff) {
                    const img = document.getElementById('guestFrame_' + g.id);
                    if (img) {
                        img.src = '/api/webrtc/conference/guest-frame/' + g.id + '?isAdmin=true&t=' + Date.now();
                    }
                }
            }
        }

        // 3. Render Chat Messages
        window.renderAdminChatFeed(data.chatMessages || []);
    } catch (e) {
        console.warn('[Admin Conference] State poll error:', e);
    }
};

window.renderAdminChatFeed = function(messages) {
    const feeds = [document.getElementById('adminChatFeed'), document.getElementById('modalAdminChatFeed')];

    const filtered = (messages || []).filter(m => {
        if (adminChatActiveTab === 'private') return !!m.isPrivate;
        return true;
    });

    let html = '';
    if (filtered.length === 0) {
        html = `<div class="text-xs text-gray-500 text-center py-4">No ${adminChatActiveTab === 'private' ? 'private' : ''} chat messages yet.</div>`;
    } else {
        for (const msg of filtered) {
            const isFromAdmin = msg.fromId === 'admin_broadcaster';
            const isPrivate = !!msg.isPrivate;
            const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            html += `
                <div class="p-2 rounded-lg ${isFromAdmin ? 'bg-blue-900/30 border border-blue-500/30 ml-3' : (isPrivate ? 'bg-purple-900/30 border border-purple-500/30 mr-3' : 'bg-gray-900/80 border border-gray-800 mr-3')}">
                    <div class="flex items-center justify-between gap-1 text-[10px] mb-0.5">
                        <span class="font-bold ${isFromAdmin ? 'text-blue-300' : (isPrivate ? 'text-purple-300' : 'text-gray-300')}">
                            ${escapeHtml(msg.fromName || 'User')} ${isPrivate ? '🔒 (Private 1-on-1)' : ''}
                        </span>
                        <span class="text-gray-500 text-[9px] font-mono">${timeStr}</span>
                    </div>
                    <div class="text-xs text-white break-words">${escapeHtml(msg.text || '')}</div>
                </div>
            `;
        }
    }
    feeds.forEach(f => {
        if (f) {
            f.innerHTML = html;
            f.scrollTop = f.scrollHeight;
        }
    });
};

window.switchAdminChatTab = function(tab) {
    adminChatActiveTab = tab;
    const btnAllList = [document.getElementById('btnAdminChatTabAll'), document.getElementById('btnModalAdminChatTabAll')];
    const btnPrivateList = [document.getElementById('btnAdminChatTabPrivate'), document.getElementById('btnModalAdminChatTabPrivate')];

    btnAllList.forEach(b => {
        if (b) {
            b.className = tab === 'all'
                ? 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-600 text-white transition-all'
                : 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-800 text-gray-400 hover:text-white transition-all';
        }
    });
    btnPrivateList.forEach(b => {
        if (b) {
            b.className = tab === 'private'
                ? 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white transition-all flex items-center gap-1'
                : 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-800 text-gray-400 hover:text-white transition-all flex items-center gap-1';
        }
    });

    if (cachedConferenceState && cachedConferenceState.chatMessages) {
        window.renderAdminChatFeed(cachedConferenceState.chatMessages);
    }
};

window.sendAdminChatMessage = async function() {
    const input1 = document.getElementById('adminChatInput');
    const input2 = document.getElementById('modalAdminChatInput');
    const text = (input1 && input1.value.trim()) || (input2 && input2.value.trim()) || '';
    if (!text) return;

    try {
        await fetch('/api/webrtc/conference/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromId: 'admin_broadcaster',
                fromName: 'Host (Admin)',
                isPrivate: adminChatActiveTab === 'private',
                text
            })
        });
        if (input1) input1.value = '';
        if (input2) input2.value = '';
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Could not send chat message", "error");
    }
};

window.handleAdminGuestFrameLoad = function(img) {
    if (!img) return;
    img.style.display = 'block';
    const id = img.getAttribute('data-guest-id');
    const ic = id ? document.getElementById('guestIcon_' + id) : null;
    if (ic) ic.style.display = 'none';
};

window.handleAdminGuestFrameError = function(img) {
    if (!img) return;
    img.style.display = 'none';
    const id = img.getAttribute('data-guest-id');
    const ic = id ? document.getElementById('guestIcon_' + id) : null;
    if (ic) ic.style.display = 'flex';
};

window.approveStageRequest = async function(viewerId) {
    if (!viewerId) {
        showAdminToast("Error", "Invalid viewer ID for approval", "error");
        return;
    }
    try {
        const res = await fetch('/api/webrtc/conference/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viewerId, id: viewerId, participantId: viewerId })
        });
        const data = await res.json();
        if (data.status === 'success' || data.approved) {
            showAdminToast("Stage Approved", "Guest successfully added to live conference stage!", "success");
        } else {
            showAdminToast("Error", data.message || "Failed to approve request", "error");
        }
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Failed to approve request", "error");
    }
};

window.rejectStageRequest = async function(viewerId) {
    if (!viewerId) return;
    try {
        await fetch('/api/webrtc/conference/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viewerId, id: viewerId, participantId: viewerId })
        });
        showAdminToast("Request Declined", "Viewer join request rejected", "info");
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Failed to reject request", "error");
    }
};

window.kickStageParticipant = async function(participantId) {
    if (!confirm("Are you sure you want to remove this participant from the conference stage?")) return;
    try {
        await fetch('/api/webrtc/conference/kick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId })
        });
        showAdminToast("Removed", "Participant removed from stage", "info");
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Failed to remove participant", "error");
    }
};

window.toggleGuestMute = async function(participantId, currentMuted) {
    try {
        await fetch('/api/webrtc/conference/media-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId, isMuted: !currentMuted })
        });
        showAdminToast("Updated", !currentMuted ? "Guest audio muted" : "Guest audio unmuted", "info");
        window.refreshAdminConferenceState();
    } catch (e) {
        showAdminToast("Error", "Failed to update mute state", "error");
    }
};

window.startAdminConferencePolling = function() {
    if (adminConferencePollTimer) clearInterval(adminConferencePollTimer);
    adminConferencePollTimer = setInterval(window.refreshAdminConferenceState, 1500);
    window.refreshAdminConferenceState();
};

// Initial state fetch on load
setTimeout(() => {
    window.refreshAdminConferenceState();
    window.startAdminConferencePolling();
}, 2000);

window.handleVideoUrlInput = function(val) {
    if (!val) return;
    const typeSelect = document.getElementById('maintenanceVideoType');
    if (!typeSelect) return;
    const lower = val.toLowerCase().trim();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        typeSelect.value = 'youtube';
    } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
        typeSelect.value = 'twitter';
    } else if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
        typeSelect.value = 'facebook';
    } else if (lower.includes('.m3u8') || lower.includes('.m3u')) {
        typeSelect.value = 'm3u';
    } else if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mkv') || lower.includes('.mov') || lower.includes('.ts')) {
        typeSelect.value = 'direct';
    }
};

window.setVideoPreset = function(url, type, title, subtitle) {
    if (document.getElementById('maintenanceVideoUrl')) document.getElementById('maintenanceVideoUrl').value = url;
    if (document.getElementById('maintenanceVideoType')) document.getElementById('maintenanceVideoType').value = type;
    if (document.getElementById('maintenanceVideoTitle') && title) document.getElementById('maintenanceVideoTitle').value = title;
    if (document.getElementById('maintenanceVideoSubtitle') && subtitle) document.getElementById('maintenanceVideoSubtitle').value = subtitle;
    if (document.getElementById('maintenanceVideoEnabledToggle')) document.getElementById('maintenanceVideoEnabledToggle').checked = true;
    showToast('Preset Selected', `Loaded ${title}. Click Preview or Save Video.`, 'info');
    previewAdminBroadcastVideo();
};

window.handleAdminVideoFileUpload = async function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('videoUploadStatus');
    const updateStatus = (html) => {
        if (statusEl) statusEl.innerHTML = html;
    };

    const currentToken = getAdminToken() || getCookie('admin_auth') || localStorage.getItem('admin_token') || '';
    const headers = {};
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB safe chunk size
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    try {
        let finalData = null;

        if (totalChunks <= 1 && file.size < 10 * 1024 * 1024) {
            // Direct single-request upload for small files
            updateStatus(`<span class="text-yellow-400 font-bold flex items-center gap-1"><span class="animate-spin inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full"></span> Uploading ${file.name} (${(file.size / (1024*1024)).toFixed(1)}MB)...</span>`);
            const formData = new FormData();
            formData.append('videoFile', file);

            const res = await fetch('/api/admin/maintenance/upload-video', {
                method: 'POST',
                credentials: 'same-origin',
                headers: headers,
                body: formData
            });

            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (jsonErr) {
                throw new Error(`Server returned HTTP ${res.status}: ${rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 100) || res.statusText}`);
            }

            if (!res.ok || data.status !== 'success') {
                throw new Error(data.message || `Upload failed with HTTP ${res.status}`);
            }
            finalData = data;
        } else {
            // Chunked upload for medium to large video files (bypasses all proxy & nginx body limits)
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunkBlob = file.slice(start, end);

                const percent = Math.round((chunkIndex / totalChunks) * 100);
                updateStatus(`<span class="text-cyan-400 font-bold flex items-center gap-1"><span class="animate-spin inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full"></span> Uploading ${file.name}: ${percent}% (${(start / (1024*1024)).toFixed(1)}MB / ${(file.size / (1024*1024)).toFixed(1)}MB, chunk ${chunkIndex + 1}/${totalChunks})...</span>`);

                const chunkFormData = new FormData();
                chunkFormData.append('uploadId', uploadId);
                chunkFormData.append('chunkIndex', chunkIndex.toString());
                chunkFormData.append('totalChunks', totalChunks.toString());
                chunkFormData.append('fileName', file.name);
                chunkFormData.append('chunk', chunkBlob, file.name);

                let attempts = 0;
                let chunkSuccess = false;
                let lastError = null;

                while (attempts < 3 && !chunkSuccess) {
                    try {
                        attempts++;
                        const res = await fetch('/api/admin/maintenance/upload-video-chunk', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: headers,
                            body: chunkFormData
                        });

                        const rawText = await res.text();
                        let chunkRes;
                        try {
                            chunkRes = JSON.parse(rawText);
                        } catch (e) {
                            throw new Error(`Server returned HTTP ${res.status}: ${rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 100) || res.statusText}`);
                        }

                        if (!res.ok || (chunkRes.status !== 'chunk_received' && chunkRes.status !== 'success')) {
                            throw new Error(chunkRes.message || `Chunk ${chunkIndex + 1} failed`);
                        }

                        if (chunkIndex === totalChunks - 1) {
                            finalData = chunkRes;
                        }
                        chunkSuccess = true;
                    } catch (attemptErr) {
                        lastError = attemptErr;
                        if (attempts < 3) {
                            await new Promise(r => setTimeout(r, 1000 * attempts));
                        }
                    }
                }

                if (!chunkSuccess) {
                    throw lastError || new Error(`Failed to upload chunk ${chunkIndex + 1} after 3 attempts`);
                }
            }
        }

        if (finalData && finalData.status === 'success') {
            if (document.getElementById('maintenanceVideoUrl')) document.getElementById('maintenanceVideoUrl').value = finalData.fileUrl;
            if (document.getElementById('maintenanceVideoType')) document.getElementById('maintenanceVideoType').value = finalData.detectedType || 'direct';
            if (document.getElementById('maintenanceVideoEnabledToggle')) document.getElementById('maintenanceVideoEnabledToggle').checked = true;
            updateStatus(`Uploaded: <span class="text-emerald-400 font-bold">${finalData.fileName}</span> <span class="text-[9px] text-gray-500 font-mono">(${finalData.fileUrl})</span>`);
            showToast('Video Uploaded', 'Video file uploaded and linked to Maintenance Broadcast.', 'success');
            previewAdminBroadcastVideo();
        } else {
            throw new Error(finalData?.message || 'Upload failed');
        }
    } catch (err) {
        updateStatus(`<span class="text-red-400 font-bold">Upload error: ${err.message}</span>`);
        showToast('Error', 'Failed to upload video file: ' + err.message, 'error');
    }
};

window.previewAdminBroadcastVideo = function() {
    const rawUrl = document.getElementById('maintenanceVideoUrl')?.value?.trim();
    if (!rawUrl) {
        showToast('No URL', 'Please enter a stream URL or upload a file first.', 'warning');
        return;
    }

    // Mutual exclusivity: When video is playing, pause music
    // Mutual exclusivity removed
    // const adminAudio = typeof getAdminAudio === 'function' ? getAdminAudio() : document.getElementById('adminMusicPlayer');
    // if (adminAudio && !adminAudio.paused) adminAudio.pause();

    const type = document.getElementById('maintenanceVideoType')?.value || 'auto';
    const isAutoplay = document.getElementById('maintenanceVideoAutoplay')?.checked !== false;
    const isMuted = !!document.getElementById('maintenanceVideoMuted')?.checked;
    const isLoop = document.getElementById('maintenanceVideoLoop')?.checked !== false;

    const previewBox = document.getElementById('adminVideoPreviewBox');
    const frame = document.getElementById('adminVideoPlayerFrame');
    if (!previewBox || !frame) return;

    previewBox.classList.remove('hidden');
    frame.innerHTML = '';

    // Smart resolver
    let effectiveType = type;
    const lower = rawUrl.toLowerCase();
    if (effectiveType === 'auto') {
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) effectiveType = 'youtube';
        else if (lower.includes('twitter.com') || lower.includes('x.com')) effectiveType = 'twitter';
        else if (lower.includes('facebook.com') || lower.includes('fb.watch')) effectiveType = 'facebook';
        else if (lower.includes('.m3u8') || lower.includes('.m3u')) effectiveType = 'm3u';
        else if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mkv') || lower.includes('.mov') || lower.includes('.ts') || rawUrl.startsWith('/uploads/')) effectiveType = 'direct';
        else effectiveType = 'website';
    }

    if (effectiveType === 'youtube') {
        let videoId = '';
        if (rawUrl.includes('youtu.be/')) {
            videoId = rawUrl.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
        } else if (rawUrl.includes('youtube.com/watch')) {
            videoId = new URL(rawUrl).searchParams.get('v') || '';
        } else if (rawUrl.includes('youtube.com/live/')) {
            videoId = rawUrl.split('youtube.com/live/')[1]?.split('?')[0];
        } else if (rawUrl.includes('youtube.com/shorts/')) {
            videoId = rawUrl.split('youtube.com/shorts/')[1]?.split('?')[0];
        } else if (rawUrl.length === 11) {
            videoId = rawUrl;
        }

        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${isAutoplay ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=${isLoop ? 1 : 0}&playlist=${videoId}&controls=1&playsinline=1&enablejsapi=1`;
        frame.innerHTML = `<iframe src="${embedUrl}" class="w-full h-full border-0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else if (effectiveType === 'facebook') {
        const fbEmbed = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(rawUrl)}&show_text=false&autoplay=${isAutoplay ? 'true' : 'false'}`;
        frame.innerHTML = `<iframe src="${fbEmbed}" class="w-full h-full border-0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else if (effectiveType === 'twitter') {
        frame.innerHTML = `<iframe src="https://twitframe.com/show?url=${encodeURIComponent(rawUrl)}" class="w-full h-full border-0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>`;
    } else if (effectiveType === 'm3u') {
        const video = document.createElement('video');
        video.className = 'w-full h-full object-contain';
        video.controls = true;
        video.autoplay = isAutoplay;
        video.muted = isMuted;
        video.loop = isLoop;
        video.playsInline = true;
        // video.addEventListener('play', () => { const a = typeof getAdminAudio === 'function' ? getAdminAudio() : null; if (a && !a.paused) a.pause(); });
        frame.appendChild(video);

        if (window.Hls && Hls.isSupported() && rawUrl.includes('.m3u8')) {
            const hls = new Hls();
            hls.loadSource(rawUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (isAutoplay) video.play().catch(() => {});
            });
        } else {
            video.src = rawUrl;
            if (isAutoplay) video.play().catch(() => {});
        }
    } else if (effectiveType === 'direct') {
        const video = document.createElement('video');
        video.className = 'w-full h-full object-contain';
        video.controls = true;
        video.autoplay = isAutoplay;
        video.muted = isMuted;
        video.loop = isLoop;
        video.playsInline = true;
        video.src = rawUrl;
        // video.addEventListener('play', () => { const a = typeof getAdminAudio === 'function' ? getAdminAudio() : null; if (a && !a.paused) a.pause(); });
        frame.appendChild(video);
        if (isAutoplay) video.play().catch(() => {});
    } else {
        // Website / External URL
        frame.innerHTML = `<iframe src="${rawUrl}" class="w-full h-full border-0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }
};

window.closeAdminVideoPreview = function() {
    const previewBox = document.getElementById('adminVideoPreviewBox');
    const frame = document.getElementById('adminVideoPlayerFrame');
    if (frame) frame.innerHTML = '';
    if (previewBox) previewBox.classList.add('hidden');
};

maintenanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        maintenanceMode: maintenanceToggle.checked,
        maintenanceAdminBypass: document.getElementById("maintenanceAdminBypassToggle") ? document.getElementById("maintenanceAdminBypassToggle").checked : false,
        consumetMaintenance: document.getElementById('consumetMaintenanceToggle') ? document.getElementById('consumetMaintenanceToggle').checked : false,
        playMaintenance: document.getElementById('playMaintenanceToggle') ? document.getElementById('playMaintenanceToggle').checked : false,
        playConsumetMaintenance: document.getElementById('playConsumetMaintenanceToggle') ? document.getElementById('playConsumetMaintenanceToggle').checked : false,
        activeTemplate: maintenanceTemplate.value,
        maintenanceTitle: document.getElementById('maintenanceTitle') ? document.getElementById('maintenanceTitle').value.trim() : '',
        maintenanceText: document.getElementById('maintenanceText') ? document.getElementById('maintenanceText').value.trim() : '',
        maintenanceMusicMode: document.getElementById('maintenanceMusicMode').value,
        maintenanceMusicQuery: document.getElementById('maintenanceMusicQuery').value.trim(),
        maintenanceMusicPlaylist: window.adminSavedPlaylist || [],
        maintenanceVideoEnabled: document.getElementById('maintenanceVideoEnabledToggle') ? document.getElementById('maintenanceVideoEnabledToggle').checked : false,
        maintenanceVideoType: document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto',
        maintenanceVideoUrl: (function() {
            const t = document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto';
            const u = document.getElementById('maintenanceVideoUrl') ? document.getElementById('maintenanceVideoUrl').value.trim() : '';
            return (t === 'webrtc' && !u) ? 'live_webrtc_stream' : u;
        })(),
        maintenanceVideoTitle: document.getElementById('maintenanceVideoTitle') ? document.getElementById('maintenanceVideoTitle').value.trim() : '',
        maintenanceVideoSubtitle: document.getElementById('maintenanceVideoSubtitle') ? document.getElementById('maintenanceVideoSubtitle').value.trim() : '',
        maintenanceVideoAutoplay: document.getElementById('maintenanceVideoAutoplay') ? document.getElementById('maintenanceVideoAutoplay').checked : true,
        maintenanceVideoMuted: document.getElementById('maintenanceVideoMuted') ? document.getElementById('maintenanceVideoMuted').checked : false,
        maintenanceVideoLoop: document.getElementById('maintenanceVideoLoop') ? document.getElementById('maintenanceVideoLoop').checked : true,
        scheduleEnabled: document.getElementById('scheduleEnabledToggle') ? document.getElementById('scheduleEnabledToggle').checked : false,
        scheduledTime: (document.getElementById('scheduleDateTimeInput') && document.getElementById('scheduleDateTimeInput').value) ? new Date(document.getElementById('scheduleDateTimeInput').value).toISOString() : '',
        scheduleNoticeText: document.getElementById('scheduleNoticeInput') ? document.getElementById('scheduleNoticeInput').value.trim() : '',
        scheduleAutoActivate: document.getElementById('scheduleAutoActivateToggle') ? document.getElementById('scheduleAutoActivateToggle').checked : true
    };

    try {
        const res = await secureFetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
            showToast('System Updated', 'Maintenance Mode configurations saved!', 'success');
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        showToast('Error', 'API save failed.', 'error');
    }
});

async function triggerCleanup(type) {
    const typesLabels = {
        cache: 'Clear Server Cache files',
        history: 'Clear Play History Logs',
        favorites: 'Clear Favorites alignment'
    };
    
    if (!confirm(`Are you sure you want to run cleanup action: "${typesLabels[type]}"?`)) return;

    try {
        const res = await secureFetch('/api/admin/system/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
            showToast('Purge Successful', data.message, 'success');
        } else {
            showToast('Cleanup Rejected', data.message, 'error');
        }
    } catch (err) {
        showToast('Error', 'Cleanup command execution failed.', 'error');
    }
}

// --- FEATURE MANAGEMENT ---
async function fetchFeatures() {
    try {
        const res = await secureFetch('/api/admin/features');
        const data = await res.json();
        if (data.status === 'success') {
            const f = data.features;
            featureToggles.m3uEnabled.checked = f.m3uEnabled;
            featureToggles.stalkerEnabled.checked = f.stalkerEnabled;
            featureToggles.firewallEnabled.checked = f.firewallEnabled;
            featureToggles.publicPlaylistEnabled.checked = f.publicPlaylistEnabled;
        }
    } catch (e) {
        console.error('Failed to fetch features:', e);
    }
}

async function updateFeature(name, value) {
    try {
        const res = await secureFetch('/api/admin/features', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [name]: value })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Security Update', `Module ${name} state changed.`, 'info');
            addDashboardLog(`[SECURITY] Feature ${name} updated to ${value}`);
        }
    } catch (e) {
        showToast('Update Failed', 'Could not sync feature state to server.', 'error');
    }
}


// --- DYNAMIC UI TOAST ---
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIconBg = document.getElementById('toastIconBg');
    const toastIcon = document.getElementById('toastIcon');

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    // Reset styles
    toastIconBg.className = 'p-2 rounded-xl';
    toastIcon.className = 'w-4 h-4';

    if (type === 'success') {
        toastIconBg.classList.add('bg-emerald-500/10', 'text-emerald-400');
        toastIcon.setAttribute('data-lucide', 'check');
    } else if (type === 'error') {
        toastIconBg.classList.add('bg-red-500/10', 'text-red-400');
        toastIcon.setAttribute('data-lucide', 'shield-x');
    } else {
        toastIconBg.classList.add('bg-blue-500/10', 'text-blue-400');
        toastIcon.setAttribute('data-lucide', 'info');
    }

    lucide.createIcons();

    // Slide up and fade in
    toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        // Slide down and fade out
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
    }, 4000);
}

function togglePortalTypeFields() {
    const type = document.getElementById('portalType').value;
    const stalkerFields = document.getElementById('stalkerFields');
    const xtreamFields = document.getElementById('xtreamFields');
    
    if (type === 'xtream') {
        stalkerFields.classList.add('hidden');
        xtreamFields.classList.remove('hidden');
        document.getElementById('portalMac').removeAttribute('required');
        document.getElementById('portalUsername').setAttribute('required', 'true');
        document.getElementById('portalPassword').setAttribute('required', 'true');
    } else {
        stalkerFields.classList.remove('hidden');
        xtreamFields.classList.add('hidden');
        document.getElementById('portalMac').setAttribute('required', 'true');
        document.getElementById('portalUsername').removeAttribute('required');
        document.getElementById('portalPassword').removeAttribute('required');
    }
}

function toggleMusicInputs() {
    const modeEl = document.getElementById('maintenanceMusicMode');
    if (!modeEl) return;
    const mode = modeEl.value;
    const queryInput = document.getElementById('maintenanceMusicQuery');
    if (queryInput) {
        if (mode === 'query') {
            queryInput.placeholder = "Search JioSaavn / iTunes or paste direct audio stream URL...";
        } else if (mode === 'random') {
            queryInput.placeholder = "Random Mode: Auto-picks chill lounge tracks (search still works)";
        } else if (mode === 'playlist') {
            queryInput.placeholder = "Playlist Mode: Search songs above to add to your saved queue...";
        }
    }
}

// Initial binding
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('portalType')) togglePortalTypeFields();
    if (document.getElementById('maintenanceMusicMode')) toggleMusicInputs();
    
    // Start drawing static admin visualizer wave
    drawAdminWaveform();
});

let adminAnimationId = null;
let adminTracksQueue = [];
window.adminSavedPlaylist = [];

window.drawAdminWaveform = function() {
    const canvas = document.getElementById('adminVisualizer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const audio = document.getElementById('adminMusicPlayer');
    const isPlaying = audio && !audio.paused && audio.currentTime > 0;

    ctx.lineWidth = 3.5;
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
            amplitude = 4 + (Math.sin(i * 0.2 + time) * Math.cos(i * 0.08 - time * 0.6) * 14 * centerFactor);
        } else {
            amplitude = Math.sin(i * 0.1 + time * 0.2) * 2.5;
        }
        const y = centerY + amplitude;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
    }

    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    adminAnimationId = requestAnimationFrame(window.drawAdminWaveform);
};

window.addTrackToAdminPlaylist = function(idx, target = 'maintenance') {
    const track = adminTracksQueue[idx];
    if (!track) return;

    if (window.adminSavedPlaylist.length >= 10) {
        showToast('Error', 'Saved playlist limit is 10 tracks!', 'error');
        return;
    }

    if (window.adminSavedPlaylist.some(t => t.url === track.url)) {
        showToast('Info', 'Track is already in the playlist!', 'info');
        return;
    }

    window.adminSavedPlaylist.push(track);
    window.renderAdminSavedPlaylist();
    showToast('Success', 'Track added to saved playlist', 'success');
};

window.removeTrackFromAdminPlaylist = function(idx) {
    window.adminSavedPlaylist.splice(idx, 1);
    window.renderAdminSavedPlaylist();
};

window.renderAdminSavedPlaylist = function() {
    const containers = [
        document.getElementById('adminSavedPlaylist'),
        document.getElementById('powerSavedPlaylist')
    ];
    
    const countBadge = document.getElementById('adminPlaylistCountBadge');
    if (countBadge) {
        countBadge.textContent = `${window.adminSavedPlaylist.length} Track${window.adminSavedPlaylist.length === 1 ? '' : 's'}`;
    }

    containers.forEach(container => {
        if (!container) return;
        if (window.adminSavedPlaylist.length === 0) {
            container.innerHTML = '<div class="text-slate-500 text-center py-2 text-[10px]">No saved tracks in queue. Search and click + to add tracks.</div>';
            return;
        }

        container.innerHTML = window.adminSavedPlaylist.map((track, idx) => `
            <div class="flex items-center justify-between p-1.5 hover:bg-white/5 rounded-lg border border-white/5 transition-all">
                <div onclick="playAdminSavedTrack(${idx})" class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <img src="${track.img || 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100'}" class="w-7 h-7 rounded object-cover flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100'">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold truncate text-[10px] text-slate-100">${escapeHtml(track.title || 'Track')}</div>
                        <div class="text-[8px] text-slate-400 truncate">${escapeHtml(track.artist || 'Artist')}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="playAdminSavedTrack(${idx})" class="bg-pink-600/30 hover:bg-pink-600 text-pink-300 hover:text-white font-bold p-1 rounded text-[8px] cursor-pointer flex items-center justify-center" title="Play Track">
                        <svg class="w-3 h-3 fill-currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button type="button" onclick="removeTrackFromAdminPlaylist(${idx})" class="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-bold px-2 py-1 rounded text-[8px] cursor-pointer" title="Delete">
                        ✕
                    </button>
                </div>
            </div>
        `).join('');
    });
};

function getAdminAudio() {
    let audio = document.getElementById('adminMusicPlayer');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'adminMusicPlayer';
        audio.preload = 'auto';
        audio.className = 'hidden';
        audio.addEventListener('play', () => {
            const frame = document.getElementById('adminVideoPlayerFrame');
            if (frame) {
                const vid = frame.querySelector('video');
                if (vid && !vid.paused) vid.pause();
                const ifr = frame.querySelector('iframe');
                if (ifr) {
                    try {
                        ifr.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    } catch(e) {}
                }
            }
        });
        document.body.appendChild(audio);
    }
    return audio;
}

window.playAdminSavedTrack = function(idx, target = 'maintenance') {
    const track = window.adminSavedPlaylist[idx];
    if (!track) return;

    const audio = getAdminAudio();
    const isPower = target === 'power';
    
    ['admin', 'power'].forEach(t => {
        const titleEl = document.getElementById(t === 'power' ? 'powerMusicTitle' : 'adminMusicTitle');
        const artistEl = document.getElementById(t === 'power' ? 'powerMusicArtist' : 'adminMusicArtist');
        if (titleEl) titleEl.textContent = track.title || 'Track Loaded';
        if (artistEl) artistEl.textContent = track.artist || 'Artist';
    });

    if (audio) {
        audio.crossOrigin = 'anonymous';
        const finalUrl = track.url && track.url.startsWith('http') ? '/api/music/proxy?url=' + encodeURIComponent(track.url) : track.url;
        audio.src = finalUrl;
        audio.load();
        
        audio.play().then(() => {
            ['admin', 'power'].forEach(t => {
                const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
                const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
                if (playIcon) playIcon.classList.add('hidden');
                if (pauseIcon) pauseIcon.classList.remove('hidden');
            });
        }).catch(err => {
            console.warn("Auto preview play blocked:", err);
            ['admin', 'power'].forEach(t => {
                const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
                const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
                if (playIcon) playIcon.classList.remove('hidden');
                if (pauseIcon) pauseIcon.classList.add('hidden');
            });
        });
    }
};

window.toggleAdminMusic = function(target = 'maintenance') {
    const audio = getAdminAudio();
    if (!audio) return;

    if (audio.paused) {
        if (!audio.src || audio.src === window.location.href) {
            if (window.adminSavedPlaylist && window.adminSavedPlaylist.length > 0) {
                window.playAdminSavedTrack(0, target);
                return;
            } else if (adminTracksQueue && adminTracksQueue.length > 0) {
                window.selectAdminTrack(0, target);
                return;
            } else {
                // Auto-load curated lofi music
                setAdminSearchSource('curated', target);
                const queryInput = document.getElementById(target === 'power' ? 'powerMusicQuery' : 'maintenanceMusicQuery');
                if (queryInput) queryInput.value = 'Lofi Girl Chill';
                searchAdminMusic(target).then(() => {
                    if (adminTracksQueue && adminTracksQueue.length > 0) {
                        window.selectAdminTrack(0, target);
                    }
                });
                return;
            }
        }
        audio.play().then(() => {
            ['admin', 'power'].forEach(t => {
                const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
                const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
                if (playIcon) playIcon.classList.add('hidden');
                if (pauseIcon) pauseIcon.classList.remove('hidden');
            });
        }).catch(err => console.warn("Play blocked", err));
    } else {
        audio.pause();
        ['admin', 'power'].forEach(t => {
            const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
            const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        });
    }
};

window._adminActiveMusicSource = 'saavn';
let adminAudioCtx = null;
let adminEqBass = null;
let adminEqMid = null;
let adminEqTreble = null;
let adminSourceNode = null;

function initAdminAudioNodes(audio) {
    if (adminAudioCtx || !audio) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        adminAudioCtx = new AudioContext();
        adminSourceNode = adminAudioCtx.createMediaElementSource(audio);
        
        adminEqBass = adminAudioCtx.createBiquadFilter();
        adminEqBass.type = 'lowshelf';
        adminEqBass.frequency.value = 60;
        adminEqBass.gain.value = 0;

        adminEqMid = adminAudioCtx.createBiquadFilter();
        adminEqMid.type = 'peaking';
        adminEqMid.frequency.value = 1000;
        adminEqMid.Q.value = 1;
        adminEqMid.gain.value = 0;

        adminEqTreble = adminAudioCtx.createBiquadFilter();
        adminEqTreble.type = 'highshelf';
        adminEqTreble.frequency.value = 10000;
        adminEqTreble.gain.value = 0;

        adminSourceNode.connect(adminEqBass);
        adminEqBass.connect(adminEqMid);
        adminEqMid.connect(adminEqTreble);
        adminEqTreble.connect(adminAudioCtx.destination);
    } catch(e) {
        console.warn("Admin Web Audio API setup failed:", e);
    }
}

window.setAdminSearchSource = function(src, target = 'maintenance') {
    window._adminActiveMusicSource = src;
    const isMaintenance = target === 'maintenance';
    ['saavn', 'archive', 'itunes', 'curated', 'youtube', 'upload'].forEach(s => {
        ['maintenance', 'power'].forEach(t => {
            const btn = document.getElementById(`btn_src_${t}_${s}`);
            if (btn) {
                if (s === src) {
                    btn.className = `flex-1 py-1.5 rounded-lg text-white ${t === 'maintenance' ? 'bg-pink-600' : 'bg-teal-600'} font-bold transition-all shadow-md`;
                } else {
                    btn.className = "flex-1 py-1.5 rounded-lg text-gray-400 hover:text-white transition-all";
                }
            }
        });
    });
    const badges = [
        document.getElementById('maintenanceActiveSourceBadge'),
        document.getElementById('powerActiveSourceBadge')
    ];
    badges.forEach(badge => {
        if (badge) badge.textContent = src.toUpperCase();
    });
    const inputs = [
        document.getElementById('maintenanceMusicQuery'),
        document.getElementById('powerMusicQuery')
    ];
    inputs.forEach(input => {
        if (input && !input.value.trim()) {
            if (src === 'saavn') input.placeholder = "Search millions of songs on JioSaavn...";
            else if (src === 'archive') input.placeholder = "Search Archive.org audio collection...";
            else if (src === 'itunes') input.placeholder = "Search Apple iTunes Store tracks...";
            else if (src === 'curated') input.placeholder = "Enter station or lofi stream...";
            else if (src === 'youtube') input.placeholder = "Search YouTube for audio...";
            else if (src === 'upload') input.placeholder = "Click 'Search' to browse and upload a file...";
        }
    });
};

window.clickAdminTag = function(tag, target = 'power') {
    const input = document.getElementById(target === 'power' ? 'powerMusicQuery' : 'maintenanceMusicQuery');
    if (input) {
        input.value = tag;
        searchAdminMusic(target);
    }
};

window.seekAdminAudio = function(event, target = 'power') {
    const audio = getAdminAudio();
    if (!audio || !audio.duration || !event || !event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const pos = (event.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
};

window.setAdminVolume = function(val, target = 'power') {
    const audio = getAdminAudio();
    if (audio) audio.volume = parseFloat(val);
    const icon = document.getElementById(target === 'power' ? 'powerVolIcon' : 'adminVolIcon');
    if (icon) {
        if (parseFloat(val) === 0) icon.setAttribute('data-lucide', 'volume-x');
        else icon.setAttribute('data-lucide', 'volume-2');
        try { lucide.createIcons(); } catch(e) {}
    }
};

window.toggleAdminMute = function(target = 'power') {
    const audio = getAdminAudio();
    const slider = document.getElementById(target === 'power' ? 'powerVolSlider' : 'adminVolSlider');
    if (!audio) return;
    if (audio.volume > 0) {
        audio.dataset.prevVol = audio.volume;
        audio.volume = 0;
        if (slider) slider.value = 0;
    } else {
        const prev = audio.dataset.prevVol ? parseFloat(audio.dataset.prevVol) : 1;
        audio.volume = prev;
        if (slider) slider.value = prev;
    }
    setAdminVolume(audio.volume, target);
};

window.applyAdminEQ = function(preset, target = 'power') {
    const audio = getAdminAudio();
    initAdminAudioNodes(audio);
    if (!adminEqBass || !adminEqMid || !adminEqTreble) return;
    
    if (preset === 'flat') {
        adminEqBass.gain.value = 0;
        adminEqMid.gain.value = 0;
        adminEqTreble.gain.value = 0;
    } else if (preset === 'bass') {
        adminEqBass.gain.value = 7;
        adminEqMid.gain.value = 1;
        adminEqTreble.gain.value = -2;
    } else if (preset === 'vocal') {
        adminEqBass.gain.value = -3;
        adminEqMid.gain.value = 6;
        adminEqTreble.gain.value = 3;
    }
    
    const bassVal = document.getElementById(`${target}EqBassVal`);
    const midVal = document.getElementById(`${target}EqMidVal`);
    const trebleVal = document.getElementById(`${target}EqTrebleVal`);
    if (bassVal) bassVal.textContent = adminEqBass.gain.value + 'dB';
    if (midVal) midVal.textContent = adminEqMid.gain.value + 'dB';
    if (trebleVal) trebleVal.textContent = adminEqTreble.gain.value + 'dB';
};

window.setAdminEQBand = function(band, val, target = 'power') {
    const audio = getAdminAudio();
    initAdminAudioNodes(audio);
    const num = parseFloat(val);
    if (band === 'bass' && adminEqBass) adminEqBass.gain.value = num;
    if (band === 'mid' && adminEqMid) adminEqMid.gain.value = num;
    if (band === 'treble' && adminEqTreble) adminEqTreble.gain.value = num;
    
    const valEl = document.getElementById(`${target}Eq${band.charAt(0).toUpperCase() + band.slice(1)}Val`);
    if (valEl) valEl.textContent = num + 'dB';
};

// Auto-bind audio timeupdate & durationupdate for seeker bar sync
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const audio = getAdminAudio();
        if (!audio) return;
        audio.addEventListener('timeupdate', () => {
            if (!audio.duration) return;
            const pct = (audio.currentTime / audio.duration) * 100;
            ['power', 'admin'].forEach(t => {
                const bar = document.getElementById(`${t}ProgressBar`);
                if (bar) bar.style.width = pct + '%';
                const cur = document.getElementById(`${t}CurTime`);
                if (cur) {
                    const m = Math.floor(audio.currentTime / 60);
                    const s = Math.floor(audio.currentTime % 60);
                    cur.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            });
        });
        audio.addEventListener('loadedmetadata', () => {
            if (!audio.duration) return;
            ['power', 'admin'].forEach(t => {
                const dur = document.getElementById(`${t}TotDur`);
                if (dur) {
                    const m = Math.floor(audio.duration / 60);
                    const s = Math.floor(audio.duration % 60);
                    dur.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            });
        });
        audio.addEventListener('ended', () => {
            // Auto advance in playlist if available
            if (window.adminSavedPlaylist && window.adminSavedPlaylist.length > 1) {
                const curSrc = audio.src;
                let curIdx = window.adminSavedPlaylist.findIndex(t => curSrc.includes(encodeURIComponent(t.url)) || curSrc === t.url);
                if (curIdx >= 0 && curIdx < window.adminSavedPlaylist.length - 1) {
                    window.playAdminSavedTrack(curIdx + 1);
                } else if (curIdx >= 0) {
                    window.playAdminSavedTrack(0); // loop
                }
            }
        });
    }, 500);
});

// Curated Ambient & Lofi Channels Catalog
const CURATED_MUSIC_CATALOG = [
    {
        id: 'curated_lofi_girl',
        title: 'Lofi Girl - Relax & Study Beats',
        artist: 'Lofi Records / ChilledCow',
        img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
        url: 'https://play.streamafrica.net/lofiradio'
    },
    {
        id: 'curated_synthwave_80s',
        title: 'Retro Synthwave & Cyberpunk Chill',
        artist: 'Synthwave Radio 24/7',
        img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300',
        url: 'https://stream.zeno.fm/f3wvbbqmdg8uv'
    },
    {
        id: 'curated_chillhop_cafe',
        title: 'Chillhop Cafe Lounge & Coffee',
        artist: 'Chillhop Music Collection',
        img: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300',
        url: 'https://stream.zeno.fm/fvr Westinghouse'
    },
    {
        id: 'curated_night_jazz',
        title: 'Midnight Jazz & Rain Ambience',
        artist: 'Smooth Jazz Radio',
        img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300',
        url: 'https://stream.zeno.fm/0r0xa792kwzuv'
    },
    {
        id: 'curated_ambient_study',
        title: 'Deep Focus Alpha Waves Ambient',
        artist: 'Ambient Sleep & Meditation',
        img: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300',
        url: 'https://stream.zeno.fm/7x48b62k9h8uv'
    },
    {
        id: 'curated_acoustic_warm',
        title: 'Acoustic Guitar Calm Sunshine',
        artist: 'Peaceful Acoustic Strings',
        img: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300',
        url: 'https://stream.zeno.fm/v22nng packaging'
    }
];

window.searchAdminMusic = async function(target = 'maintenance') {
    if (window._adminActiveMusicSource === 'upload') {
        const fileInput = document.getElementById(target === 'power' ? 'powerAudioUpload' : 'maintenanceAudioUpload');
        if (fileInput) fileInput.click();
        return;
    }
    const queryInput = document.getElementById(target === 'power' ? 'powerMusicQuery' : 'maintenanceMusicQuery');
    const query = queryInput ? queryInput.value.trim() : '';
    const resultsDiv = document.getElementById(target === 'power' ? 'powerMusicResults' : 'adminMusicResults');
    if (!resultsDiv) return;

    if (!query && window._adminActiveMusicSource !== 'curated') {
        showToast('Info', 'Please enter a search query or track URL first', 'info');
        return;
    }

    resultsDiv.innerHTML = '<div class="text-center py-2 text-slate-400 animate-pulse text-xs font-semibold">Searching high-fidelity audio streams...</div>';
    resultsDiv.classList.remove('hidden');

    try {
        let tracks = [];
        let fetchedSuccess = false;
        const source = window._adminActiveMusicSource || 'saavn';

        // Check if direct audio stream URL or service link was provided
        if (query.startsWith('http://') || query.startsWith('https://')) {
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                let vid = '';
                if (query.includes('v=')) vid = query.split('v=')[1].split('&')[0];
                else if (query.includes('youtu.be/')) vid = query.split('youtu.be/')[1].split('?')[0].split('&')[0];
                else if (query.includes('embed/')) vid = query.split('embed/')[1].split('?')[0].split('&')[0];
                adminTracksQueue = [{
                    id: 'youtube_' + (vid || Math.random().toString(36).substr(2, 9)),
                    title: 'YouTube Audio Stream',
                    artist: 'YouTube',
                    img: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                    url: `/api/v1/youtube/stream?v=${encodeURIComponent(vid || query)}&type=audio`
                }];
                fetchedSuccess = true;
            } else if (query.includes('jiosaavn.com') || query.includes('audius.co') || query.includes('spotify.com')) {
                // Forward to server link resolver to fetch full 320kbps lossless stream & metadata
                try {
                    const searchRes = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        const list = Array.isArray(searchData) ? searchData : (searchData.tracks || searchData.results || []);
                        if (Array.isArray(list) && list.length > 0) {
                            adminTracksQueue = list.map(t => ({
                                id: t.id || ('saavn_' + Math.random().toString(36).substr(2, 9)),
                                title: t.title || 'JioSaavn Track',
                                artist: t.artist || 'JioSaavn Artist',
                                img: t.artwork || t.img || t.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100',
                                url: t.streamUrl || t.url
                            })).filter(t => t.url);
                            if (adminTracksQueue.length > 0) fetchedSuccess = true;
                        }
                    }
                } catch(e) {
                    console.warn('[JioSaavn URL resolve error]', e);
                }
            } else if (query.match(/\.(mp3|aac|m4a|wav|flac|ogg|opus)(\?.*)?$/i)) {
                adminTracksQueue = [{
                    id: 'direct_stream_' + Math.random().toString(36).substr(2, 9),
                    title: query.split('/').pop().split('?')[0] || 'Custom Stream URL',
                    artist: 'Direct Stream Feed',
                    img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                    url: query
                }];
                fetchedSuccess = true;
            } else {
                // Any other URL - attempt server resolution first
                try {
                    const searchRes = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        const list = Array.isArray(searchData) ? searchData : (searchData.tracks || searchData.results || []);
                        if (Array.isArray(list) && list.length > 0) {
                            adminTracksQueue = list.map(t => ({
                                id: t.id || ('track_' + Math.random().toString(36).substr(2, 9)),
                                title: t.title || 'Audio Stream',
                                artist: t.artist || 'Streaming Audio',
                                img: t.artwork || t.img || t.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100',
                                url: t.streamUrl || t.url
                            })).filter(t => t.url);
                            if (adminTracksQueue.length > 0) fetchedSuccess = true;
                        }
                    }
                } catch(e) {}

                if (!fetchedSuccess) {
                    adminTracksQueue = [{
                        id: 'direct_stream_' + Math.random().toString(36).substr(2, 9),
                        title: query.split('/').pop().split('?')[0] || 'Custom Stream URL',
                        artist: 'Direct Stream Feed',
                        img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                        url: query
                    }];
                    fetchedSuccess = true;
                }
            }
        }

        // Source 1: Curated preset catalog
        if (!fetchedSuccess && source === 'curated') {
            const filterQ = query.toLowerCase();
            const curatedMatches = CURATED_MUSIC_CATALOG.filter(c => 
                !filterQ || c.title.toLowerCase().includes(filterQ) || c.artist.toLowerCase().includes(filterQ)
            );
            adminTracksQueue = curatedMatches.length > 0 ? curatedMatches : CURATED_MUSIC_CATALOG;
            fetchedSuccess = true;
        }

        // Source 2: Archive.org
        if (!fetchedSuccess && source === 'archive') {
            try {
                const searchRes = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:audio&fl[]=identifier,title,creator,downloads&sort[]=downloads+desc&rows=15&output=json`);
                const json = await searchRes.json();
                if (json?.response?.docs?.length > 0) {
                    adminTracksQueue = json.response.docs.map(item => ({
                        id: 'archive_' + item.identifier,
                        title: item.title || 'Archive Audio',
                        artist: item.creator || 'Archive.org',
                        img: 'https://archive.org/services/img/' + item.identifier,
                        url: `https://archive.org/download/${item.identifier}/${item.identifier}.mp3`
                    }));
                    fetchedSuccess = true;
                }
            } catch (e) { console.warn("Archive.org search error:", e); }
        }

        // Source 3: iTunes API
        if (!fetchedSuccess && source === 'itunes') {
            try {
                const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
                const responseJson = await searchRes.json();
                if (responseJson && responseJson.results && responseJson.results.length > 0) {
                    adminTracksQueue = responseJson.results.map(item => ({
                        id: 'itunes_' + item.trackId,
                        title: item.trackName || 'iTunes Song',
                        artist: item.artistName || 'iTunes Artist',
                        img: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100',
                        url: item.previewUrl
                    })).filter(t => t.url);
                    if (adminTracksQueue.length > 0) fetchedSuccess = true;
                }
            } catch (e) { console.warn("iTunes search error:", e); }
        }

        // Source 4: Local Multi-Provider API /api/music/search
        
        // Source 5: YouTube API
        if (!fetchedSuccess && source === 'youtube') {
            try {
                const searchRes = await fetch(`/api/v1/youtube/search?q=${encodeURIComponent(query)}`);
                const responseJson = await searchRes.json();
                if (responseJson && responseJson.results && responseJson.results.length > 0) {
                    adminTracksQueue = responseJson.results.map(item => ({
                        id: 'youtube_' + item.videoId,
                        title: item.title || 'YouTube Audio',
                        artist: item.author || 'YouTube Channel',
                        img: item.thumbnail || 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100',
                        url: '/api/v1/youtube/stream?v=' + encodeURIComponent(item.videoId) + '&type=audio&title=' + encodeURIComponent(item.title || '') + '&artist=' + encodeURIComponent(item.author || '')
                    }));
                    fetchedSuccess = true;
                }
            } catch (e) { console.warn("YouTube search error:", e); }
        }

        if (!fetchedSuccess) {
            try {
                const searchRes = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const list = Array.isArray(searchData) ? searchData : (searchData.tracks || searchData.results || searchData.data || []);
                    if (Array.isArray(list) && list.length > 0) {
                        adminTracksQueue = list.map(t => {
                            let streamUrl = t.streamUrl || t.url || t.downloadUrl;
                            if (!streamUrl && Array.isArray(t.download_url) && t.download_url.length > 0) {
                                const dlObj = t.download_url.find(d => d.quality === '320kbps' || d.quality === '160kbps') || t.download_url[t.download_url.length - 1];
                                streamUrl = dlObj ? (dlObj.link || dlObj.url) : '';
                            } else if (!streamUrl && Array.isArray(t.downloadUrl) && t.downloadUrl.length > 0) {
                                const dlObj = t.downloadUrl.find(d => d.quality === '320kbps' || d.quality === '160kbps') || t.downloadUrl[t.downloadUrl.length - 1];
                                streamUrl = dlObj ? (dlObj.url || dlObj.link) : '';
                            }
                            let imgUrl = t.img || t.image || 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100';
                            if (Array.isArray(imgUrl) && imgUrl.length > 0) {
                                const imgObj = imgUrl.find(i => i.quality === '150x150' || i.quality === '500x500') || imgUrl[0];
                                imgUrl = imgObj ? (imgObj.link || imgObj.url || imgUrl) : imgUrl;
                            }
                            return {
                                id: t.id || ('track_' + Math.random().toString(36).substr(2, 9)),
                                title: t.title || t.name || t.song || 'Audio Track',
                                artist: t.artist || t.subtitle || (t.artist_map?.primary_artists ? t.artist_map.primary_artists.map(a => a.name).join(', ') : 'Music Artist'),
                                img: imgUrl,
                                url: streamUrl
                            };
                        }).filter(t => t.url);
                        if (adminTracksQueue.length > 0) fetchedSuccess = true;
                    }
                }
            } catch (e) {
                console.warn("Local search failed, trying public JioSaavn...", e);
            }
        }

        // Source 5: Public JioSaavn API Fallback
        if (!fetchedSuccess) {
            try {
                const searchRes = await fetch(`https://jiosaavn-api-private.vercel.app/search/songs?q=${encodeURIComponent(query)}`);
                const searchData = await searchRes.json();
                if (searchData && searchData.data && Array.isArray(searchData.data.results) && searchData.data.results.length > 0) {
                    adminTracksQueue = searchData.data.results.map(track => {
                        let img = 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100';
                        if (track.image && Array.isArray(track.image)) {
                            const imgObj = track.image.find(i => i.quality === '150x150') || track.image[0];
                            img = imgObj ? (imgObj.link || imgObj.url || img) : img;
                        }
                        let downloadUrl = '';
                        if (track.download_url && track.download_url.length > 0) {
                            const dlObj = track.download_url.find(d => d.quality === '160kbps' || d.quality === '320kbps');
                            downloadUrl = dlObj ? (dlObj.link || dlObj.url) : track.download_url[track.download_url.length - 1].link;
                        } else if (track.downloadUrl && track.downloadUrl.length > 0) {
                            const dlObj = track.downloadUrl.find(d => d.quality === '160kbps' || d.quality === '320kbps');
                            downloadUrl = dlObj ? (dlObj.url || dlObj.link) : track.downloadUrl[track.downloadUrl.length - 1].url;
                        }
                        let artistName = track.subtitle || (track.artist_map?.primary_artists ? track.artist_map.primary_artists.map(a => a.name).join(', ') : 'Unknown Artist');
                        return {
                            id: track.id,
                            title: track.name || track.song || 'Unknown Track',
                            artist: artistName,
                            img: img,
                            url: downloadUrl
                        };
                    }).filter(t => t.url);
                    if (adminTracksQueue.length > 0) fetchedSuccess = true;
                }
            } catch (e) {
                console.warn("JioSaavn fallback failed...", e);
            }
        }

        // Source 6: Public iTunes API Fallback
        if (!fetchedSuccess) {
            try {
                const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
                const responseJson = await searchRes.json();
                if (responseJson && responseJson.results && responseJson.results.length > 0) {
                    adminTracksQueue = responseJson.results.map(item => ({
                        id: 'itunes_' + item.trackId,
                        title: item.trackName || 'iTunes Song',
                        artist: item.artistName || 'iTunes Artist',
                        img: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100',
                        url: item.previewUrl
                    })).filter(t => t.url);
                    if (adminTracksQueue.length > 0) fetchedSuccess = true;
                }
            } catch (e) {
                console.warn("iTunes fallback failed...", e);
            }
        }

        // Fallback: If still nothing found, present curated catalog
        if (!adminTracksQueue || adminTracksQueue.length === 0) {
            adminTracksQueue = CURATED_MUSIC_CATALOG;
        }

        resultsDiv.innerHTML = adminTracksQueue.map((track, idx) => `
            <div class="flex items-center justify-between p-2 hover:bg-white/10 rounded-xl border border-transparent hover:border-pink-500/30 transition-all">
                <div onclick="selectAdminTrack(${idx}, '${target}')" class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <img src="${track.img}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow" onerror="this.src='https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100'">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold truncate text-xs text-slate-100">${escapeHtml(track.title)}</div>
                        <div class="text-[10px] text-slate-400 truncate">${escapeHtml(track.artist)}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onclick="selectAdminTrack(${idx}, '${target}')" class="bg-pink-600/30 hover:bg-pink-600 text-pink-300 hover:text-white font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer flex items-center gap-1 transition-all" title="Preview Play">
                        <svg class="w-3 h-3 fill-currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <span>Play</span>
                    </button>
                    <button type="button" onclick="addTrackToAdminPlaylist(${idx}, '${target}')" class="bg-teal-600 hover:bg-teal-500 text-black font-bold p-1.5 rounded-lg text-[9px] cursor-pointer flex items-center justify-center transition-all shadow" title="Add to Playlist">
                        <svg class="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.warn(err);
        resultsDiv.innerHTML = '<div class="text-center py-2 text-red-400 text-xs">Failed to connect to music service. Showing curated list below.</div>';
        adminTracksQueue = CURATED_MUSIC_CATALOG;
        resultsDiv.innerHTML += adminTracksQueue.map((track, idx) => `
            <div class="flex items-center justify-between p-2 hover:bg-white/10 rounded-xl border border-white/5 transition-all">
                <div onclick="selectAdminTrack(${idx}, '${target}')" class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <img src="${track.img}" class="w-8 h-8 rounded-lg object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold truncate text-xs text-slate-100">${escapeHtml(track.title)}</div>
                        <div class="text-[10px] text-slate-400 truncate">${escapeHtml(track.artist)}</div>
                    </div>
                </div>
                <button type="button" onclick="selectAdminTrack(${idx}, '${target}')" class="bg-pink-600 hover:bg-pink-500 text-white font-bold px-2 py-1 rounded-lg text-[10px]">Play</button>
            </div>
        `).join('');
    }
};

window.selectAdminTrack = function(idx, target = 'maintenance') {
    if(target === 'bgAudio') {
        const track = adminTracksQueue[idx];
        if(!track) return;
        document.getElementById('bgAudioUrl').value = track.url;
        document.getElementById('bgAudioType').value = 'audio';
        document.getElementById('bgAudioSelectedTitle').innerText = track.title;
        document.getElementById('bgAudioSelectedArtist').innerText = track.artist;
        document.getElementById('bgAudioSelectedImg').src = track.img || '/assets/vinyl_placeholder.png';
        const preview = document.getElementById('bgAudioPreview');
        preview.src = track.url;
        preview.classList.remove('hidden');
        document.getElementById('bgAudioResults').classList.add('hidden');
        return;
    }
    const track = adminTracksQueue[idx];
    if (!track) return;

    const audio = getAdminAudio();
    
    ['admin', 'power'].forEach(t => {
        const titleEl = document.getElementById(t === 'power' ? 'powerMusicTitle' : 'adminMusicTitle');
        const artistEl = document.getElementById(t === 'power' ? 'powerMusicArtist' : 'adminMusicArtist');
        if (titleEl) titleEl.textContent = track.title;
        if (artistEl) artistEl.textContent = track.artist;
    });

    if (document.getElementById('maintenanceMusicQuery')) {
        document.getElementById('maintenanceMusicQuery').value = track.url;
    }
    if (document.getElementById('powerMusicQuery')) {
        document.getElementById('powerMusicQuery').value = track.url;
    }

    if (audio) {
        audio.crossOrigin = 'anonymous';
        const finalUrl = track.url && track.url.startsWith('http') ? '/api/music/proxy?url=' + encodeURIComponent(track.url) : track.url;
        audio.src = finalUrl;
        audio.load();
        
        audio.play().then(() => {
            ['admin', 'power'].forEach(t => {
                const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
                const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
                if (playIcon) playIcon.classList.add('hidden');
                if (pauseIcon) pauseIcon.classList.remove('hidden');
            });
        }).catch(err => {
            console.warn("Auto preview play blocked:", err);
            ['admin', 'power'].forEach(t => {
                const playIcon = document.getElementById(t === 'power' ? 'powerPlayIcon' : 'adminPlayIcon');
                const pauseIcon = document.getElementById(t === 'power' ? 'powerPauseIcon' : 'adminPauseIcon');
                if (playIcon) playIcon.classList.remove('hidden');
                if (pauseIcon) pauseIcon.classList.add('hidden');
            });
        });
    }

    const resultsDiv = document.getElementById(target === 'power' ? 'powerMusicResults' : 'adminMusicResults');
    if (resultsDiv) resultsDiv.classList.add('hidden');
};

// --- SPORTS SECTION MANAGEMENT ---
async function loadSportsM3uFiles() {
    const list = document.getElementById('adminSportsM3uList');
    if (!list) return;
    list.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-xs text-gray-500">Loading Sports M3U Files...</td></tr>`;
    try {
        const res = await secureFetch('/api/admin/sports/m3u');
        const data = await res.json();
        if (data.status === 'success' && data.m3uFiles) {
            renderSportsM3uFiles(data.m3uFiles);
        } else {
            list.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-xs text-red-500">Error loading files</td></tr>`;
        }
    } catch (e) {
        list.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-xs text-red-500">Error loading files</td></tr>`;
    }
}

function renderSportsM3uFiles(files) {
    const list = document.getElementById('adminSportsM3uList');
    if (!list) return;
    if (!files || files.length === 0) {
        list.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-xs text-gray-500 italic">No Sports M3U files added yet.</td></tr>`;
        return;
    }
    list.innerHTML = files.map(file => `
        <tr class="hover:bg-gray-800/20 transition-colors">
            <td class="p-4 font-bold text-white text-xs">${file.name}</td>
            <td class="p-4 text-xs text-gray-400">${new Date(file.addedAt).toLocaleString()}</td>
            <td class="p-4 text-right">
                <button onclick="deleteSportsM3uFile('${file.id}')" class="text-red-500 hover:text-red-400 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

async function deleteSportsM3uFile(id) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Sports M3U',
        message: 'Are you sure you want to delete this Sports M3U file?',
        confirmText: 'Delete M3U',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/sports/m3u/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Deleted', 'Sports M3U file removed', 'success');
            loadSportsM3uFiles();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to delete M3U', 'error');
    }
}

function toggleSportsM3uModal(show) {
    const modal = document.getElementById('sportsM3uModal');
    if (show) {
        document.getElementById('sportsM3uForm').reset();
        const dropText = document.getElementById('sportsM3uDropZoneText');
        if (dropText) dropText.textContent = 'Drag file here or click to browse';
        const fileInput = document.getElementById('sportsM3uFileInput');
        if (fileInput && !fileInput._bound) {
            fileInput._bound = true;
            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files[0]) {
                    const f = fileInput.files[0];
                    if (dropText) dropText.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
                }
            });
        }
        setSportsM3uMethod('file');
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

let currentSportsM3uMethod = 'file';
function setSportsM3uMethod(method) {
    currentSportsM3uMethod = method;
    const btnFile = document.getElementById('sportsM3uMethodFile');
    const btnUrl = document.getElementById('sportsM3uMethodUrl');
    const groupFile = document.getElementById('sportsM3uFileGroup');
    const groupUrl = document.getElementById('sportsM3uUrlGroup');

    if (method === 'file') {
        btnFile.classList.replace('bg-white/5', 'bg-emerald-600');
        btnFile.classList.replace('text-gray-400', 'text-white');
        btnFile.classList.replace('border-gray-800', 'border-emerald-500');
        btnUrl.classList.replace('bg-emerald-600', 'bg-white/5');
        btnUrl.classList.replace('text-white', 'text-gray-400');
        btnUrl.classList.replace('border-emerald-500', 'border-gray-800');
        groupFile.classList.remove('hidden');
        groupUrl.classList.add('hidden');
    } else {
        btnUrl.classList.replace('bg-white/5', 'bg-emerald-600');
        btnUrl.classList.replace('text-gray-400', 'text-white');
        btnUrl.classList.replace('border-gray-800', 'border-emerald-500');
        btnFile.classList.replace('bg-emerald-600', 'bg-white/5');
        btnFile.classList.replace('text-white', 'text-gray-400');
        btnFile.classList.replace('border-emerald-500', 'border-gray-800');
        groupUrl.classList.remove('hidden');
        groupFile.classList.add('hidden');
    }
}

async function saveSportsM3u(e) {
    e.preventDefault();
    const name = document.getElementById('sportsM3uName').value;
    const url = document.getElementById('sportsM3uUrlInput').value;
    const file = document.getElementById('sportsM3uFileInput').files[0];

    const payload = { name };
    if (currentSportsM3uMethod === 'url') {
        if (!url) return showToast('Error', 'Please enter a URL', 'error');
        payload.url = url;
        submitSportsM3uPayload(payload);
    } else {
        if (!file) return showToast('Error', 'Please select a file', 'error');
        const reader = new FileReader();
        reader.onload = (event) => {
            payload.file_content = event.target.result;
            submitSportsM3uPayload(payload);
        };
        reader.readAsDataURL(file);
    }
}

async function submitSportsM3uPayload(payload) {
    try {
        showToast('Saving...', 'Uploading M3U file', 'info');
        const res = await secureFetch('/api/admin/sports/m3u', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Success', 'Sports M3U saved', 'success');
            toggleSportsM3uModal(false);
            loadSportsM3uFiles();
        } else {
            showToast('Error', data.message, 'error');
        }
    } catch (err) {
        showToast('Error', 'Failed to save Sports M3U', 'error');
    }
}

window.toggleSportsM3uModal = toggleSportsM3uModal;
window.setSportsM3uMethod = setSportsM3uMethod;
window.saveSportsM3u = saveSportsM3u;
window.deleteSportsM3uFile = deleteSportsM3uFile;

// --- MULTI-CONTAINER SHOWCASE STUDIO & SPORTS STREAMS ---
let adminSportsContainers = [];
let adminSelectedContainerId = 'default_showcase';
let adminFilterContainerId = 'all';
let allAdminSportsList = [];

async function loadSportsContainers() {
    try {
        const res = await secureFetch(`/api/admin/sports/containers?_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.containers)) {
            adminSportsContainers = data.containers;
        } else {
            adminSportsContainers = [];
        }
    } catch (e) {
        console.warn('Failed to load sports containers', e);
        adminSportsContainers = [];
    }

    // If active selected ID is not in list, select the first one
    if (adminSportsContainers.length > 0 && !adminSportsContainers.some(c => c.id === adminSelectedContainerId)) {
        adminSelectedContainerId = adminSportsContainers[0].id;
    }

    renderContainerChips();
    populateContainerDropdowns();
    if (adminSportsContainers.length > 0) {
        selectActiveContainer(adminSelectedContainerId);
    }
}
window.loadSportsContainers = loadSportsContainers;

function renderContainerChips() {
    const chipsContainer = document.getElementById('adminContainersChips');
    const countEl = document.getElementById('adminContainersCount');
    if (countEl) countEl.innerText = adminSportsContainers.length;
    if (!chipsContainer) return;

    if (adminSportsContainers.length === 0) {
        chipsContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No showcase containers created yet. Click "New Container" or use an AI Preset.</p>';
        return;
    }

    chipsContainer.innerHTML = adminSportsContainers.map(c => {
        const isActive = c.id === adminSelectedContainerId;
        const channelCount = allAdminSportsList.filter(s => (s.containerId || 'default_showcase') === c.id).length;
        
        let styleIcon = 'layout-grid';
        if (c.gridStyle === 'shelf') styleIcon = 'sliders-horizontal';
        if (c.gridStyle === 'glass_cards') styleIcon = 'sparkles';
        if (c.gridStyle === 'compact_chips') styleIcon = 'zap';
        if (c.gridStyle === 'spotlight') styleIcon = 'star';

        const activeClasses = isActive 
            ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 scale-[1.02]' 
            : 'bg-gray-900/90 text-gray-300 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80';

        return `
            <button type="button" onclick="selectActiveContainer('${c.id}')" class="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${activeClasses}">
                <i data-lucide="${styleIcon}" class="w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-red-400'}"></i>
                <div class="text-left">
                    <span class="block text-xs font-black truncate max-w-[140px]">${c.title || 'Untitled'}</span>
                    <span class="block text-[9px] ${isActive ? 'text-red-100' : 'text-gray-500'} font-semibold">${c.badge || 'CONTAINER'} · ${channelCount} channels</span>
                </div>
            </button>
        `;
    }).join('');

    lucide.createIcons();
}
window.renderContainerChips = renderContainerChips;

function populateContainerDropdowns() {
    // 1. Modal Container Dropdown
    const modalSelect = document.getElementById('sportsContainerSelect');
    if (modalSelect) {
        modalSelect.innerHTML = adminSportsContainers.map(c => 
            `<option value="${c.id}">${c.title} (${c.badge || 'Container'})</option>`
        ).join('');
    }

    // 2. Filter Dropdown
    const filterSelect = document.getElementById('adminFilterChannelContainer');
    if (filterSelect) {
        const currentVal = filterSelect.value || 'all';
        filterSelect.innerHTML = `
            <option value="all">All Containers (${allAdminSportsList.length} channels)</option>
            ${adminSportsContainers.map(c => {
                const count = allAdminSportsList.filter(s => (s.containerId || 'default_showcase') === c.id).length;
                return `<option value="${c.id}">${c.title} (${count})</option>`;
            }).join('')}
        `;
        filterSelect.value = currentVal;
    }
}

function selectActiveContainer(id) {
    adminSelectedContainerId = id;
    const c = adminSportsContainers.find(item => item.id === id);
    if (!c) return;

    const idInp = document.getElementById('adminContainerId');
    const titleInp = document.getElementById('adminHubTitle');
    const badgeInp = document.getElementById('adminHubBadge');
    const subInp = document.getElementById('adminHubSubtitle');
    const bgInp = document.getElementById('adminHubBgUrl');
    const playerPngInp = document.getElementById('adminHubPlayerPng');
    const gridBgInp = document.getElementById('adminHubGridBgUrl');
    const gridStyleInp = document.getElementById('adminHubGridStyle');

    if (idInp) idInp.value = c.id;
    if (titleInp) titleInp.value = c.title || '';
    if (badgeInp) badgeInp.value = c.badge || '';
    if (subInp) subInp.value = c.subtitle || '';
    if (bgInp) bgInp.value = c.bgUrl || '';
    if (playerPngInp) playerPngInp.value = c.playerPng || '';
    if (gridBgInp) gridBgInp.value = c.gridBgUrl || '';
    if (gridStyleInp) gridStyleInp.value = c.gridStyle || 'shelf';

    updateContainerPreviewThumbnails();
    renderContainerChips();
}
window.selectActiveContainer = selectActiveContainer;

function updateContainerPreviewThumbnails() {
    const title = document.getElementById('adminHubTitle')?.value || 'Showcase Container';
    const gridStyle = document.getElementById('adminHubGridStyle')?.value || 'shelf';
    const bgUrl = document.getElementById('adminHubBgUrl')?.value || '';
    const playerPng = document.getElementById('adminHubPlayerPng')?.value || '';

    const titleEl = document.getElementById('adminContainerPreviewTitle');
    const styleEl = document.getElementById('adminContainerPreviewStyle');
    const bgThumb = document.getElementById('adminContainerBgThumb');
    const playerThumb = document.getElementById('adminContainerPlayerThumb');
    const playerBox = document.getElementById('adminContainerPlayerThumbBox');

    if (titleEl) titleEl.innerText = title;
    if (styleEl) {
        const styleLabels = {
            shelf: 'Horizontal Carousel Shelf',
            grid: 'Bento Multi-Card Grid',
            glass_cards: 'Cyberpunk Glass Neon',
            compact_chips: 'Compact Action Chips',
            spotlight: 'Spotlight Showcase'
        };
        styleEl.innerText = `Grid Style: ${styleLabels[gridStyle] || gridStyle}`;
    }

    if (bgThumb) {
        if (bgUrl && bgUrl.trim()) {
            bgThumb.style.backgroundImage = `url('${bgUrl}')`;
        } else {
            bgThumb.style.backgroundImage = `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80')`;
        }
    }

    if (playerThumb && playerBox) {
        if (playerPng && playerPng.trim()) {
            playerThumb.src = playerPng;
            playerBox.classList.remove('opacity-40');
        } else {
            playerThumb.src = 'https://pngimg.com/d/cricket_PNG10.png';
            playerBox.classList.add('opacity-40');
        }
    }
}
window.updateContainerPreviewThumbnails = updateContainerPreviewThumbnails;

function openNewContainerForm() {
    const newId = `container_${Date.now()}`;
    adminSelectedContainerId = newId;

    const idInp = document.getElementById('adminContainerId');
    const titleInp = document.getElementById('adminHubTitle');
    const badgeInp = document.getElementById('adminHubBadge');
    const subInp = document.getElementById('adminHubSubtitle');
    const bgInp = document.getElementById('adminHubBgUrl');
    const playerPngInp = document.getElementById('adminHubPlayerPng');
    const gridBgInp = document.getElementById('adminHubGridBgUrl');
    const gridStyleInp = document.getElementById('adminHubGridStyle');

    if (idInp) idInp.value = newId;
    if (titleInp) titleInp.value = 'NEW SHOWCASE CONTAINER';
    if (badgeInp) badgeInp.value = 'SPECIAL EVENT';
    if (subInp) subInp.value = 'Live high-speed broadcasts and featured multi-camera streams.';
    if (bgInp) bgInp.value = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&auto=format&fit=crop&q=80';
    if (playerPngInp) playerPngInp.value = 'https://pngimg.com/d/football_player_PNG11.png';
    if (gridBgInp) gridBgInp.value = '';
    if (gridStyleInp) gridStyleInp.value = 'grid';

    updateContainerPreviewThumbnails();
    showToast("Info", "Configuring new container. Click 'Save Container Settings' when ready.", "info");
}
window.openNewContainerForm = openNewContainerForm;

async function createContainerFromPreset(presetType) {
    try {
        const res = await secureFetch(`/api/admin/sports/containers/presets/${presetType}`, {
            method: 'POST',
            body: JSON.stringify({ presetType })
        });
        const data = await res.json();
        if (data.status === 'success' && data.container) {
            showToast("Success", `Created ${data.container.title} Container!`, "success");
            adminSelectedContainerId = data.container.id;
            await loadSportsContainers();
            await loadSportsStreams();
        } else {
            showToast("Error", data.message || "Failed to create preset container", "error");
        }
    } catch (e) {
        showToast("Error", "Error generating preset container", "error");
    }
}
window.createContainerFromPreset = createContainerFromPreset;

async function generateAiChannelContainer() {
    const input = document.getElementById('adminAiContainerPrompt');
    const btn = document.getElementById('btnGenerateAiContainer');
    const prompt = (input ? input.value : '').trim();
    if (!prompt) {
        showToast("Notice", "Please enter a prompt for the AI container (e.g. 'Champions League Final')", "info");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Generating...';
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await secureFetch('/api/admin/sports/containers/ai-generate', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (data.status === 'success' && data.container) {
            showToast("Success", data.message || `AI Created ${data.container.title}!`, "success");
            if (input) input.value = '';
            adminSelectedContainerId = data.container.id;
            await loadSportsContainers();
            await loadSportsStreams();
        } else {
            showToast("Error", data.message || "Failed to create AI container", "error");
        }
    } catch (e) {
        showToast("Error", "AI Container generation failed", "error");
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i> Generate with AI';
        if (window.lucide) lucide.createIcons();
    }
}
window.generateAiChannelContainer = generateAiChannelContainer;

async function saveActiveContainer(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('adminContainerId')?.value || adminSelectedContainerId;
    const title = (document.getElementById('adminHubTitle')?.value || '').trim();
    const badge = (document.getElementById('adminHubBadge')?.value || '').trim();
    const subtitle = (document.getElementById('adminHubSubtitle')?.value || '').trim();
    const bgUrl = (document.getElementById('adminHubBgUrl')?.value || '').trim();
    const playerPng = (document.getElementById('adminHubPlayerPng')?.value || '').trim();
    const gridBgUrl = (document.getElementById('adminHubGridBgUrl')?.value || '').trim();
    const gridStyle = document.getElementById('adminHubGridStyle')?.value || 'shelf';

    const saveBtn = document.getElementById('btnSaveSportsHubConfig');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    }

    const payload = { id, title, badge, subtitle, bgUrl, playerPng, gridBgUrl, gridStyle };
    const exists = adminSportsContainers.some(c => c.id === id);
    const endpoint = exists ? `/api/admin/sports/containers/${id}` : '/api/admin/sports/containers';
    const method = exists ? 'PUT' : 'POST';

    try {
        const res = await secureFetch(endpoint, {
            method: method,
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.status === 'success') {
            showToast("Success", "Showcase Container Saved Successfully!", "success");
            adminSelectedContainerId = id;
            await loadSportsContainers();
            await loadSportsStreams();
        } else {
            showToast("Error", result.message || "Failed to save container", "error");
        }
    } catch (err) {
        showToast("Error", "Error saving container settings", "error");
    }

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Container Settings';
    }
    lucide.createIcons();
}
window.saveActiveContainer = saveActiveContainer;
window.saveSportsHubConfig = saveActiveContainer; // backward compatibility

async function deleteActiveContainer() {
    const id = document.getElementById('adminContainerId')?.value || adminSelectedContainerId;
    if (!id) return;
    
    if (adminSportsContainers.length <= 1) {
        showToast("Notice", "Cannot delete the only container. Create another first.", "error");
        return;
    }

    const confirmed = await showAppConfirmModal({
        title: 'Delete Showcase Container',
        message: `Are you sure you want to delete this container? Channels in this container will be reassigned to the default container.`,
        confirmText: 'Delete Container',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/sports/containers/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.status === 'success') {
            showToast("Success", "Container Deleted", "success");
            adminSelectedContainerId = adminSportsContainers.find(c => c.id !== id)?.id || 'default_showcase';
            await loadSportsContainers();
            await loadSportsStreams();
        } else {
            showToast("Error", result.message || "Delete failed", "error");
        }
    } catch (err) {
        showToast("Error", "Error deleting container", "error");
    }
}
window.deleteActiveContainer = deleteActiveContainer;

function filterChannelsByContainer(containerId) {
    adminFilterContainerId = containerId;
    if (containerId === 'all') {
        renderSportsStreams(allAdminSportsList);
    } else {
        const filtered = allAdminSportsList.filter(s => (s.containerId || 'default_showcase') === containerId);
        renderSportsStreams(filtered);
    }
}
window.filterChannelsByContainer = filterChannelsByContainer;

async function changeChannelContainer(channelId, newContainerId) {
    try {
        const res = await secureFetch(`/api/admin/sports/${channelId}/container`, {
            method: 'PUT',
            body: JSON.stringify({ containerId: newContainerId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            showToast("Success", "Channel Reassigned to Container", "success");
            await loadSportsStreams();
        } else {
            showToast("Error", result.message || "Failed to reassign channel", "error");
        }
    } catch (e) {
        showToast("Error", "Failed to update channel container", "error");
    }
}
window.changeChannelContainer = changeChannelContainer;

let allLive1736Channels = [];

async function loadLive1736Catalog(force = false) {
    const grid = document.getElementById('grid1736Channels');
    const badge = document.getElementById('badge1736Count');
    if (!grid) return;

    if (force || allLive1736Channels.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full p-8 text-center text-cyan-400 text-xs animate-pulse font-mono">
                Scanning and resolving Live 1736 channels...
            </div>
        `;
    }

    try {
        const res = await secureFetch('/api/admin/sports/live-1736-channels');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.channels)) {
            allLive1736Channels = data.channels;
            if (badge) badge.innerText = `${allLive1736Channels.length} Streams Active`;
            filter1736Grid();
        } else {
            grid.innerHTML = `<div class="col-span-full p-6 text-center text-red-400 text-xs">${data.message || 'Failed to load 1736 channels'}</div>`;
        }
    } catch (e) {
        console.error('Failed to load live 1736 catalog:', e);
        grid.innerHTML = `<div class="col-span-full p-6 text-center text-red-400 text-xs">Error connecting to 1736 stream service</div>`;
    }
}
window.loadLive1736Catalog = loadLive1736Catalog;

function filter1736Grid() {
    const grid = document.getElementById('grid1736Channels');
    if (!grid) return;

    const query = (document.getElementById('search1736Input')?.value || '').toLowerCase().trim();
    const genreFilter = document.getElementById('filter1736Genre')?.value || 'ALL';

    const filtered = allLive1736Channels.filter(ch => {
        const matchQuery = !query || (ch.name || '').toLowerCase().includes(query) || (ch.category || '').toLowerCase().includes(query) || (ch.streamUrl || '').toLowerCase().includes(query);
        
        let matchGenre = true;
        if (genreFilter === '1736') {
            matchGenre = !!ch.is1736;
        } else if (genreFilter !== 'ALL') {
            matchGenre = (ch.category || '').toLowerCase().includes(genreFilter.toLowerCase());
        }
        return matchQuery && matchGenre;
    });

    renderLive1736Grid(filtered);
}
window.filter1736Grid = filter1736Grid;

function renderLive1736Grid(channels) {
    const grid = document.getElementById('grid1736Channels');
    if (!grid) return;

    if (channels.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full p-8 border border-dashed border-gray-800 rounded-xl text-center text-gray-500 text-xs">
                No matching Live 1736 channels found.
            </div>
        `;
        return;
    }

    grid.innerHTML = channels.map((ch, idx) => {
        const isAdded = ch.isAdded || (allAdminSportsList && allAdminSportsList.some(s => s.title?.toLowerCase() === ch.name?.toLowerCase() || s.url === ch.streamUrl));
        const safeName = (ch.name || '').replace(/'/g, "\\'");
        const safeLogo = (ch.logo || '').replace(/'/g, "\\'");
        const safeUrl = (ch.streamUrl || '').replace(/'/g, "\\'");

        return `
            <div class="p-3.5 rounded-xl border ${ch.is1736 ? 'border-cyan-500/50 bg-cyan-950/20' : 'border-gray-800 bg-gray-950/70'} hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3 text-left">
                <div class="flex items-start justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${ch.logo}" class="w-8 h-8 rounded-lg object-contain bg-black/60 p-1 border border-white/10 shrink-0" onerror="this.src='https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg'">
                        <div class="min-w-0">
                            <h4 class="text-xs font-bold text-white truncate" title="${ch.name}">${ch.name}</h4>
                            <span class="text-[9px] font-mono text-cyan-400/80 block truncate">${ch.category || 'Live Sports'}</span>
                        </div>
                    </div>
                    ${ch.is1736 ? '<span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500 text-black shrink-0">1736</span>' : ''}
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-gray-800/60 text-[10px]">
                    <span class="text-gray-500 font-mono truncate max-w-[120px]" title="${ch.streamUrl}">${ch.url || 'Live Stream'}</span>
                    ${isAdded ? `
                        <span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold text-[9px] flex items-center gap-1">
                            <i data-lucide="check" class="w-3 h-3"></i> Listed
                        </span>
                    ` : `
                        <button type="button" onclick="importSingle1736Channel('${safeName}', '${safeLogo}', '${safeUrl}')" class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all flex items-center gap-1 text-[9px] shadow-sm shadow-cyan-600/20 active:scale-95">
                            <i data-lucide="plus" class="w-3 h-3"></i> Add Stream
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function syncAll1736Channels() {
    const btn = document.getElementById('btnSyncAll1736');
    if (btn) {
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Syncing All Streams...';
        btn.disabled = true;
    }

    try {
        const targetContainer = (adminFilterContainerId !== 'all' ? adminFilterContainerId : adminSelectedContainerId) || 'default_showcase';
        const res = await secureFetch('/api/admin/sports/sync-1736', {
            method: 'POST',
            body: JSON.stringify({ targetContainerId: targetContainer })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Sync Completed', data.message || 'All Live 1736 channels synchronized to Sports Manager and Live Now!', 'success');
            await loadSportsStreams();
            await loadLive1736Catalog(true);
        } else {
            showToast('Sync Failed', data.message || 'Error syncing channels', 'error');
        }
    } catch (err) {
        showToast('Sync Error', 'Failed to connect to sync endpoint', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = '<i data-lucide="download-cloud" class="w-4 h-4"></i> <span>Sync All to Sports & Live Now</span>';
            btn.disabled = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}
window.syncAll1736Channels = syncAll1736Channels;

async function importSingle1736Channel(name, logo, streamUrl) {
    try {
        const targetContainer = (adminFilterContainerId !== 'all' ? adminFilterContainerId : adminSelectedContainerId) || 'default_showcase';
        const res = await secureFetch('/api/admin/sports/import-channel-1736', {
            method: 'POST',
            body: JSON.stringify({ name, logo, streamUrl, containerId: targetContainer })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Channel Added', `"${name}" added to Sports Manager and Live Now!`, 'success');
            await loadSportsStreams();
            await loadLive1736Catalog(false);
        } else {
            showToast('Import Failed', data.message || 'Error importing channel', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to import channel', 'error');
    }
}
window.importSingle1736Channel = importSingle1736Channel;

window.clearAll1736Channels = async function() {
    if (!confirm('Are you sure you want to clear all imported 1736 / TimStreams channels from Sports Manager and Live Now?')) return;
    try {
        const res = await secureFetch('/api/admin/sports/clear-1736', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Cleared', data.message || '1736 channels cleared successfully', 'success');
            await loadSportsStreams();
            await loadLive1736Catalog(false);
        } else {
            showToast('Error', data.message || 'Failed to clear channels', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to clear 1736 channels', 'error');
    }
};

async function loadSportsStreams() {
    await loadSportsContainers();
    loadLive1736Catalog(false);
    const list = document.getElementById('adminSportsList');
    if (!list) return;
    list.innerHTML = `
        <div class="col-span-full text-center py-12 animate-pulse text-gray-500 text-xs uppercase tracking-widest">
            Loading Showcase Channels...
        </div>
    `;
    try {
        const res = await secureFetch('/api/admin/sports');
        const data = await res.json();
        if (data.status === 'success' && data.sports) {
            allAdminSportsList = data.sports;
            populateContainerDropdowns();
            renderContainerChips();
            filterChannelsByContainer(adminFilterContainerId);
        } else {
            list.innerHTML = `<p class="col-span-full text-center text-red-400 text-xs py-4">Failed to fetch: ${data.message || 'unknown error'}</p>`;
        }
    } catch (err) {
        list.innerHTML = `<p class="col-span-full text-center text-red-400 text-xs py-4">Error loading sports section</p>`;
    }
}
window.loadSportsStreams = loadSportsStreams;

function renderSportsStreams(sports) {
    const list = document.getElementById('adminSportsList');
    if (!list) return;

    if (sports.length === 0) {
        list.innerHTML = `
            <div class="col-span-full p-12 border border-dashed border-gray-800 rounded-2xl text-center text-gray-500 text-xs">
                <i data-lucide="tv" class="w-8 h-8 mx-auto text-gray-700 mb-2"></i>
                <p class="font-bold text-gray-400">No Channels Found in this View</p>
                <p class="text-gray-600 mt-0.5">Click "Add Channel" to add a new live stream to your showcase container.</p>
                <button onclick="openNewSportsModal()" class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-lg shadow-red-600/20">
                    <i data-lucide="plus" class="w-4 h-4"></i> Add Channel
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = sports.map((s, idx) => {
        const isUrl = s.icon && (s.icon.startsWith('http://') || s.icon.startsWith('https://') || s.icon.startsWith('/') || s.icon.includes('.'));
        const iconHtml = isUrl 
            ? `<img src="${s.icon}" class="w-6 h-6 object-contain rounded-md" onerror="this.onerror=null; this.src='https://img.icons8.com/color/120/sports.png';" />` 
            : `<i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5"></i>`;
        const hasBg = s.bgUrl && s.bgUrl.trim();
        const currentContainer = adminSportsContainers.find(c => c.id === (s.containerId || 'default_showcase'));
        const containerName = currentContainer ? currentContainer.title : 'Showcase Container';
        
        return `
        <div class="p-5 rounded-2xl border border-gray-800 bg-gray-950/60 hover:bg-gray-900/50 transition-all flex flex-col justify-between gap-4 text-left relative overflow-hidden group shadow-lg">
            ${hasBg ? `
                <div class="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none" style="background-image: url('${s.bgUrl}');"></div>
            ` : ''}
            
            <div class="flex items-start justify-between gap-3 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 w-11 h-11 shrink-0 rounded-xl bg-gray-900 border border-gray-800 text-red-500 flex items-center justify-center shadow-inner">
                        ${iconHtml}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[9px] font-black uppercase text-red-400">#${idx + 1}</span>
                            <h4 class="text-xs font-bold text-white tracking-wide truncate max-w-[170px]" title="${s.title}">${s.title}</h4>
                        </div>
                        <p class="text-[9px] font-mono text-gray-500 mt-0.5 truncate max-w-[190px]" title="${s.url}">${s.url}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <span id="badge_${s.id}" class="px-2 py-0.5 rounded bg-gray-900 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-800">UNCHECKED</span>
                    <span class="px-1.5 py-0.5 rounded bg-red-600/10 text-red-400 text-[8px] font-bold border border-red-500/20 max-w-[120px] truncate" title="${containerName}">
                        ${containerName}
                    </span>
                </div>
            </div>
            
            <!-- Container Reassignment Selector -->
            <div class="relative z-10 flex items-center justify-between gap-2 bg-black/40 p-2 rounded-xl border border-gray-800/80">
                <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Container:</span>
                <select onchange="changeChannelContainer('${s.id}', this.value)" class="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-[10px] text-gray-200 outline-none w-full truncate">
                    ${adminSportsContainers.map(c => `
                        <option value="${c.id}" ${(s.containerId || 'default_showcase') === c.id ? 'selected' : ''}>${c.title}</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="flex items-center justify-between border-t border-gray-800/60 pt-3 mt-0.5 relative z-10">
                <div class="flex items-center gap-2">
                    <button onclick="checkSportsStream('${s.id}', '${s.url}')" class="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-[9px] font-bold uppercase tracking-wider text-gray-300 rounded-lg transition-all flex items-center gap-1">
                        <i data-lucide="refresh-cw" class="w-3 h-3"></i> Test
                    </button>
                    <button onclick="playSportsStream('${s.url}', '${(s.title || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-[9px] font-bold uppercase tracking-wider text-red-400 rounded-lg transition-all flex items-center gap-1">
                        <i data-lucide="play" class="w-3 h-3"></i> Play
                    </button>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="openEditSportsModal('${s.id}', '${(s.title || '').replace(/'/g, "\\'")}', '${(s.icon || '').replace(/'/g, "\\'")}', '${(s.url || '').replace(/'/g, "\\'")}', '${(s.bgUrl || '').replace(/'/g, "\\'")}', '${s.containerId || 'default_showcase'}')" class="p-1.5 hover:bg-gray-900 rounded-lg text-gray-400 hover:text-white transition-colors" title="Edit Stream">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteSportsStream('${s.id}')" class="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors" title="Delete Stream">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    lucide.createIcons();
}
window.renderSportsStreams = renderSportsStreams;

function toggleSportsModal(show) {
    document.getElementById('sportsModal').classList.toggle('hidden', !show);
}
window.toggleSportsModal = toggleSportsModal;

async function extractSportsM3u() {
    const btn = document.getElementById('extractSportsBtn');
    if(btn) {
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Extracting...';
        btn.disabled = true;
    }
    
    try {
        const res = await secureFetch('/api/admin/sports/extract', { method: 'POST' });
        if (res.status === 'success') {
            pushToast('Sports M3U extracted successfully', 'success');
        } else {
            pushToast('Failed to extract: ' + res.message, 'error');
        }
    } catch (e) {
        pushToast('Error connecting to extraction API', 'error');
    }
    
    if(btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Extract Sports M3U';
        btn.disabled = false;
    }
    lucide.createIcons();
}
window.extractSportsM3u = extractSportsM3u;

function openNewSportsModal() {
    const searchInp = document.getElementById('sportsQuickSearchInput');
    if (searchInp) searchInp.value = '';
    const clearBtn = document.getElementById('btnClearSportsQuickSearch');
    if (clearBtn) clearBtn.classList.add('hidden');
    const matchInfo = document.getElementById('sportsQuickSelectMatchInfo');
    if (matchInfo) matchInfo.classList.add('hidden');
    
    populateSportsQuickSelect();
    populateContainerDropdowns();

    document.getElementById('sportsModalTitle').innerText = "Add Sports Stream";
    document.getElementById('sportsId').value = "";
    document.getElementById('sportsTitle').value = "";
    document.getElementById('sportsIcon').value = "trophy";
    document.getElementById('sportsUrl').value = "";
    if (document.getElementById('sportsBgUrl')) document.getElementById('sportsBgUrl').value = "";
    
    const containerSelect = document.getElementById('sportsContainerSelect');
    if (containerSelect) {
        containerSelect.value = (adminFilterContainerId !== 'all' ? adminFilterContainerId : adminSelectedContainerId) || 'default_showcase';
    }

    toggleSportsModal(true);
}
window.openNewSportsModal = openNewSportsModal;

function openEditSportsModal(id, title, icon, url, bgUrl, containerId) {
    const searchInp = document.getElementById('sportsQuickSearchInput');
    if (searchInp) searchInp.value = '';
    const clearBtn = document.getElementById('btnClearSportsQuickSearch');
    if (clearBtn) clearBtn.classList.add('hidden');
    const matchInfo = document.getElementById('sportsQuickSelectMatchInfo');
    if (matchInfo) matchInfo.classList.add('hidden');

    populateSportsQuickSelect();
    populateContainerDropdowns();

    document.getElementById('sportsModalTitle').innerText = "Edit Sports Stream";
    document.getElementById('sportsId').value = id;
    document.getElementById('sportsTitle').value = title;
    document.getElementById('sportsIcon').value = icon;
    document.getElementById('sportsUrl').value = url;
    if (document.getElementById('sportsBgUrl')) {
        document.getElementById('sportsBgUrl').value = bgUrl || '';
    }
    const containerSelect = document.getElementById('sportsContainerSelect');
    if (containerSelect) {
        containerSelect.value = containerId || 'default_showcase';
    }

    toggleSportsModal(true);
}
window.openEditSportsModal = openEditSportsModal;

async function saveSportsStream(e) {
    e.preventDefault();
    const id = document.getElementById('sportsId').value;
    const title = document.getElementById('sportsTitle').value;
    const icon = document.getElementById('sportsIcon').value;
    const url = document.getElementById('sportsUrl').value;
    const bgUrl = (document.getElementById('sportsBgUrl') ? document.getElementById('sportsBgUrl').value : '');
    const containerId = (document.getElementById('sportsContainerSelect') ? document.getElementById('sportsContainerSelect').value : 'default_showcase');

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/sports/${id}` : '/api/admin/sports';

    try {
        const res = await secureFetch(endpoint, {
            method: method,
            body: JSON.stringify({ title, icon, url, bgUrl, containerId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            showToast("Success", id ? "Stream Updated" : "Stream Added", "success");
            toggleSportsModal(false);
            loadSportsStreams();
        } else {
            showToast("Error", result.message || "Failed to save", "error");
        }
    } catch (err) {
        showToast("Error", "Error saving sports stream", "error");
    }
}
window.saveSportsStream = saveSportsStream;

window.deleteSportsStream = async function(id) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Sports Stream',
        message: 'Are you sure you want to delete this sports stream?',
        confirmText: 'Delete Stream',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/sports/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.status === 'success') {
            showToast("Success", "Stream Deleted", "success");
            loadSportsStreams();
        } else {
            showToast("Error", result.message || "Delete failed", "error");
        }
    } catch (err) {
        showToast("Error", "Error deleting stream", "error");
        console.error(err);
    }
}

async function checkSportsStream(id, url) {
    const badge = document.getElementById(`badge_${id}`);
    if (badge) {
        badge.className = "px-2 py-0.5 rounded bg-gray-900 text-yellow-400 text-[8px] font-black uppercase tracking-widest animate-pulse border border-gray-800";
        badge.innerText = "CHECKING";
    }

    try {
        const res = await secureFetch(`/api/admin/sports/check?url=${encodeURIComponent(url)}`);
        const result = await res.json();
        
        if (badge) {
            if (result.status === 'active') {
                badge.className = "px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest";
                badge.innerText = "ACTIVE";
            } else {
                badge.className = "px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-black uppercase tracking-widest";
                badge.innerText = "DAMAGED";
            }
        }
    } catch (err) {
        if (badge) {
            badge.className = "px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-black uppercase tracking-widest";
            badge.innerText = "DAMAGED";
        }
    }
}

// Inline video preview logic
let hlsInstance = null;

function playSportsStream(url, title) {
    const container = document.getElementById('dummyPlayContainer');
    const video = document.getElementById('dummyVideoPlayer');
    const info = document.getElementById('dummyVideoInfo');
    
    container.classList.remove('hidden');
    info.innerText = `Stream Target: ${url}`;
    container.scrollIntoView({ behavior: 'smooth' });

    // Stop existing Hls instance
    if (hlsInstance) {
        try { hlsInstance.destroy(); } catch(e){}
        hlsInstance = null;
    }

    // Play stream using HLS
    let streamUrl = url;
    if ((streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) && !streamUrl.includes('live.php') && !streamUrl.includes('xtream.php')) {
        streamUrl = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(streamUrl)}&m3u=1&type=hls`;
    }

    if (Hls.isSupported()) {
        hlsInstance = new Hls({
            maxBufferLength: 20,
            maxMaxBufferLength: 60,
            enableWorker: true,
            lowLatencyMode: false,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 5
        });
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play().catch(err => console.warn("Hls.js autoplay blocked:", err));
        });
        hlsInstance.on(Hls.Events.ERROR, function(event, data) {
            console.warn("Hls.js error:", data);
            if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hlsInstance.startLoad();
            } else if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hlsInstance.recoverMediaError();
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(err => console.warn("Native HLS failed:", err));
    } else {
        video.src = streamUrl;
        video.play().catch(err => console.warn("Direct video load failed:", err));
    }
}

function closeDummyPlayer() {
    const container = document.getElementById('dummyPlayContainer');
    const video = document.getElementById('dummyVideoPlayer');
    
    container.classList.add('hidden');
    video.pause();
    video.src = "";
    
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
}

// Expose to window globally
window.loadSportsStreams = loadSportsStreams;
window.renderSportsStreams = renderSportsStreams;
window.toggleSportsModal = toggleSportsModal;
window.openNewSportsModal = openNewSportsModal;
window.openEditSportsModal = openEditSportsModal;
window.saveSportsStream = saveSportsStream;

window.checkSportsStream = checkSportsStream;
window.playSportsStream = playSportsStream;
window.closeDummyPlayer = closeDummyPlayer;


// --- LIVE EVENTS MANAGER ---
let adminLiveEvents = [];

async function fetchLiveEvents() {
    try {
        const res = await secureFetch(`/api/admin/live_events?_t=${Date.now()}`);
        const data = await res.json();
        adminLiveEvents = data.liveEvents || [];
        renderLiveEventsList();
    } catch (err) {
        showToast('Error', 'Failed to fetch Live Events', 'error');
    }
}

function renderLiveEventsList() {
    const list = document.getElementById('adminLiveEventsList');
    if (!list) return;
    list.innerHTML = '';
    
    if (adminLiveEvents.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500 col-span-full">No live events available. Add one.</p>';
        return;
    }
    
    adminLiveEvents.forEach(evt => {
        const isUrl = evt.icon && (evt.icon.startsWith('http://') || evt.icon.startsWith('https://') || evt.icon.startsWith('/') || evt.icon.includes('.'));
        const iconHtml = isUrl 
            ? `<img src="${evt.icon}" class="w-12 h-12 rounded-2xl border border-red-500/40 shadow-xl object-cover z-10 shrink-0">`
            : `<div class="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/40 shadow-xl z-10 shrink-0"><i data-lucide="${evt.icon || 'zap'}" class="w-6 h-6"></i></div>`;
            
        const card = document.createElement('div');
        const hasBg = evt.bgUrl && evt.bgUrl.trim();
        const bgStyle = hasBg 
            ? `background-image: url('${evt.bgUrl}'); background-size: cover; background-position: center;` 
            : 'background: #09090b;';
        
        card.className = "relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all hover:scale-[1.02] hover:border-red-500/40 flex flex-col justify-between group h-64 bg-zinc-950 text-left";
        card.innerHTML = `
            <!-- Pure Background Image (No Blue Embed) -->
            <div class="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-105" style="${bgStyle}"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent z-0 pointer-events-none"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/40 to-transparent z-0 pointer-events-none"></div>
            
            <div class="relative z-10 p-6 flex flex-col h-full justify-between">
                <div class="flex items-center gap-4">
                    ${iconHtml}
                    <div class="min-w-0">
                        <h4 class="text-white font-black text-xl drop-shadow-md truncate" title="${evt.title}">${evt.title}</h4>
                        <p class="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5 drop-shadow">
                            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span>LIVE EVENT</span>
                        </p>
                    </div>
                </div>
                
                <div class="my-auto">
                    <div class="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 overflow-hidden relative group/url">
                        <p class="text-xs text-gray-300 font-mono truncate cursor-pointer hover:text-white transition-colors" title="${evt.url}" onclick="copyText('${evt.url}')">${evt.url}</p>
                        <div class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/url:opacity-100 transition-opacity">
                            <i data-lucide="copy" class="w-3.5 h-3.5 text-emerald-400"></i>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 pt-2">
                    <button onclick="playSportsStream('${evt.url}', '${encodeURIComponent(evt.title)}')" class="flex-1 py-2.5 bg-red-600/30 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-500/40 shadow-lg">
                        <i data-lucide="play" class="w-4 h-4 text-white fill-white"></i> Preview
                    </button>
                    <button onclick="editLiveEvent('${evt.id}')" class="px-4 py-2.5 bg-zinc-900/80 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 rounded-xl transition-colors border border-white/10 hover:border-amber-500/40 backdrop-blur-sm" title="Edit Event">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteLiveEvent('${evt.id}')" class="px-4 py-2.5 bg-zinc-900/80 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-xl transition-colors border border-white/10 hover:border-red-500/40 backdrop-blur-sm" title="Delete Event">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

window.toggleLiveEventsModal = toggleLiveEventsModal;
window.openNewLiveEventModal = openNewLiveEventModal;
window.editLiveEvent = editLiveEvent;
window.saveLiveEventStream = saveLiveEventStream;

function toggleLiveEventsModal(show) {
    const modal = document.getElementById('liveEventsModal');
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function openNewLiveEventModal() {
    document.getElementById('liveEventsModalTitle').innerHTML = '<i data-lucide="zap" class="w-5 h-5 text-red-500"></i> Add Live Event';
    document.getElementById('liveEventsId').value = '';
    document.getElementById('liveEventsTitle').value = '';
    document.getElementById('liveEventsIcon').value = '';
    document.getElementById('liveEventsUrl').value = '';
    if(document.getElementById('liveEventsBgUrl')) document.getElementById('liveEventsBgUrl').value = '';
    toggleLiveEventsModal(true);
    lucide.createIcons();
}

function editLiveEvent(id) {
    const evt = adminLiveEvents.find(s => s.id === id);
    if (!evt) return;
    document.getElementById('liveEventsModalTitle').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-amber-500"></i> Edit Live Event';
    document.getElementById('liveEventsId').value = evt.id;
    document.getElementById('liveEventsTitle').value = evt.title || '';
    document.getElementById('liveEventsIcon').value = evt.icon || '';
    document.getElementById('liveEventsUrl').value = evt.url || '';
    if (document.getElementById('liveEventsBgUrl')) {
        document.getElementById('liveEventsBgUrl').value = evt.bgUrl || '';
    }
    toggleLiveEventsModal(true);
    lucide.createIcons();
}

async function saveLiveEventStream(e) {
    e.preventDefault();
    const id = document.getElementById('liveEventsId').value;
    const title = document.getElementById('liveEventsTitle').value;
    const icon = document.getElementById('liveEventsIcon').value;
    const url = document.getElementById('liveEventsUrl').value;
    const bgUrl = document.getElementById('liveEventsBgUrl') ? document.getElementById('liveEventsBgUrl').value : '';
    
    const payload = { title, icon, url, bgUrl };
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/live_events/${id}` : '/api/admin/live_events';
    
    try {
        const res = await secureFetch(endpoint, {
            method: method,
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast('Success', id ? 'Live Event updated.' : 'Live Event added.', 'success');
            toggleLiveEventsModal(false);
            fetchLiveEvents();
        } else {
            showToast('Error', data.message || 'Failed to save', 'error');
        }
    } catch (err) {
        showToast('Error', 'API request failed.', 'error');
    }
}

window.deleteLiveEvent = async function(id) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Live Event',
        message: 'Are you sure you want to delete this live event?',
        confirmText: 'Delete Event',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch(`/api/admin/live_events/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Deleted', 'Live Event has been removed.', 'success');
            fetchLiveEvents();
        } else {
            showToast('Error', data.message || 'Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Error', 'API request failed.', 'error');
        console.error(err);
    }
}


// Consumet Builder Logic
const builderForm = document.getElementById('builderForm');
const builderAction = document.getElementById('builderAction');
const builderGridIdContainer = document.getElementById('builderGridIdContainer');
const builderHtmlContainer = document.getElementById('builderHtmlContainer');
const builderResetBtn = document.getElementById('builderResetBtn');

if(builderAction) {
    builderAction.addEventListener('change', (e) => {
        if(e.target.value === 'add_button') {
            builderGridIdContainer.style.display = 'none';
            builderHtmlContainer.style.display = 'none';
            if(document.getElementById('builderBgContainer')) document.getElementById('builderBgContainer').style.display = 'none';
        } else {
            builderGridIdContainer.style.display = 'block';
            builderHtmlContainer.style.display = 'block';
            if(document.getElementById('builderBgContainer')) document.getElementById('builderBgContainer').style.display = 'block';
        }
    });
}

if(builderForm) {
    builderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const action = document.getElementById('builderAction').value;
        const title = document.getElementById('builderTitle').value;
        const gridId = document.getElementById('builderGridId').value;
        const bgUrl = document.getElementById('builderBgUrl')?.value || '';
        const htmlContent = document.getElementById('builderHtml').value;
        
        try {
            const res = await fetch('/api/admin/consumet/builder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                body: JSON.stringify({ action, title, gridId, htmlContent, bgUrl })
            });
            const data = await res.json();
            if(data.status === 'success') {
                alert('Success: ' + data.message);
                document.getElementById('builderTitle').value = '';
            } else {
                alert('Error: ' + data.message);
            }
        } catch(err) {
            alert('Failed to apply builder changes: ' + err);
        }
    });
}

if(builderResetBtn) {
    builderResetBtn.addEventListener('click', async () => {
        if(confirm('Are you sure you want to reset consumet.html to backup? All injected sections will be lost.')) {
            try {
                const res = await fetch('/api/admin/consumet/builder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
                    body: JSON.stringify({ action: 'reset' })
                });
                const data = await res.json();
                alert(data.message);
            } catch(err) {
                alert('Reset failed: ' + err);
            }
        }
    });
}


let cachedSportsCatalog = [];
let sportsPickerActiveCategory = 'ALL';

async function fetchSportsChannelsCatalog() {
    if (cachedSportsCatalog && cachedSportsCatalog.length > 0) {
        return cachedSportsCatalog;
    }
    try {
        const res = await fetch('/api/sports/channels');
        const channels = await res.json();
        if (Array.isArray(channels)) {
            cachedSportsCatalog = channels;
        }
    } catch(e) {
        console.warn('Failed to load sports channels catalog', e);
    }
    return cachedSportsCatalog || [];
}

async function populateSportsQuickSelect(filterQuery = '') {
    try {
        const channels = await fetchSportsChannelsCatalog();
        const select = document.getElementById('sportsQuickSelect');
        if (!select) return;

        const q = (filterQuery || '').trim().toLowerCase();
        let filtered = channels;
        if (q) {
            filtered = channels.filter(ch => {
                const name = (ch.name || '').toLowerCase();
                const group = (ch.group || ch.genre || '').toLowerCase();
                const src = (ch.source || '').toLowerCase();
                return name.includes(q) || group.includes(q) || src.includes(q);
            });
        }

        const matchInfo = document.getElementById('sportsQuickSelectMatchInfo');
        const matchCount = document.getElementById('sportsQuickSelectMatchCount');
        if (matchInfo && matchCount) {
            if (q) {
                matchInfo.classList.remove('hidden');
                matchCount.textContent = `${filtered.length.toLocaleString()} matching channel${filtered.length === 1 ? '' : 's'}`;
            } else {
                matchInfo.classList.add('hidden');
            }
        }

        select.innerHTML = '<option value="">-- Custom (Enter manually below) --</option>';
        
        // Show top 300 to maintain silky fast rendering
        const maxOptions = 300;
        const toRender = filtered.slice(0, maxOptions);
        
        toRender.forEach(ch => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(ch);
            opt.textContent = `${ch.name} (${ch.source || ch.group || 'Catalog'})`;
            select.appendChild(opt);
        });

        if (filtered.length > maxOptions) {
            const moreOpt = document.createElement('option');
            moreOpt.disabled = true;
            moreOpt.textContent = `... and ${(filtered.length - maxOptions).toLocaleString()} more (use Search button for full search)`;
            select.appendChild(moreOpt);
        }
    } catch(e) {
        console.warn('Failed to populate sports quick select', e);
    }
}

window.filterSportsQuickSelect = function(val) {
    const clearBtn = document.getElementById('btnClearSportsQuickSearch');
    if (clearBtn) {
        if (val && val.trim().length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    populateSportsQuickSelect(val);
};

window.clearSportsQuickSearch = function() {
    const inp = document.getElementById('sportsQuickSearchInput');
    if (inp) inp.value = '';
    const clearBtn = document.getElementById('btnClearSportsQuickSearch');
    if (clearBtn) clearBtn.classList.add('hidden');
    populateSportsQuickSelect('');
};

window.autoFillSportsForm = function(selectEl) {
    if (!selectEl.value) {
        document.getElementById('sportsTitle').value = "";
        document.getElementById('sportsIcon').value = "trophy";
        document.getElementById('sportsUrl').value = "";
        return;
    }
    try {
        const ch = JSON.parse(selectEl.value);
        applyChannelToSportsForm(ch);
    } catch(e) {}
};

function applyChannelToSportsForm(ch) {
    if (!ch) return;
    if (ch.name) document.getElementById('sportsTitle').value = ch.name;
    if (ch.logo) document.getElementById('sportsIcon').value = ch.logo;
    
    let streamUrl = ch.stream_url || ch.url || '';
    const isMdtv = ch.source === 'mdtv' || ch.source === 'jtv' || (ch.channel_id && (ch.channel_id.startsWith('mdtv-') || ch.channel_id.startsWith('jtv-'))) || !!ch.drm;
    
    if (isMdtv) {
        const cleanId = (ch.channel_id || ch.id || '').replace(/^(?:jtv|mdtv)[-_]/, '');
        streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=mdtv-${cleanId}&m3u=1`;
    } else if (ch.source === 'airtel' || (ch.channel_id && ch.channel_id.startsWith('airtel_'))) {
        streamUrl = ch.stream_url || `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id || ch.id)}&m3u=1`;
    } else if (ch.source === 'sonyliv' || (ch.channel_id && ch.channel_id.startsWith('sonyliv_'))) {
        if (ch.stream_url && ch.stream_url.startsWith('http')) {
            streamUrl = `${window.location.origin}/stream_proxy.php?url=${encodeURIComponent(ch.stream_url)}`;
        } else {
            streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id || ch.id)}&m3u=1`;
        }
    } else if (ch.source === 'timstreams' || ch.source === 'tim_events' || (ch.channel_id && ch.channel_id.startsWith('tim_'))) {
        const timId = ch.channel_id || ch.id || ch.stream_url || '';
        streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(timId.startsWith('tim_') ? timId : 'tim_' + timId)}&m3u=1`;
    } else if (ch.source === 'fancode' || (ch.channel_id && ch.channel_id.startsWith('fancode'))) {
        if (ch.stream_url && ch.stream_url.startsWith('http')) {
            streamUrl = `${window.location.origin}/stream_proxy.php?url=${encodeURIComponent(ch.stream_url)}`;
        } else {
            streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id || ch.id)}&m3u=1`;
        }
    } else if (ch.channel_id && (ch.channel_id.startsWith('http://') || ch.channel_id.startsWith('https://') || ch.source === 'custom')) {
        streamUrl = ch.channel_id;
    } else if (ch.stream_url && (ch.stream_url.startsWith('http://') || ch.stream_url.startsWith('https://') || ch.source === 'custom')) {
        streamUrl = ch.stream_url;
    } else if (ch.channel_id) {
        streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
    } else if (ch.stream_url && ch.stream_url.includes('.m3u8')) {
        streamUrl = `${window.location.origin}/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.stream_url)}&m3u=1`;
    }
    
    if (streamUrl) document.getElementById('sportsUrl').value = streamUrl;
}

/**
 * 🔍 Visual Channel Search Picker Modal Handlers
 */
window.openSportsChannelPicker = async function() {
    const modal = document.getElementById('sportsChannelPickerModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Sync search input from quick search if any
    const quickInp = document.getElementById('sportsQuickSearchInput');
    const pickerInp = document.getElementById('sportsPickerSearchInput');
    if (pickerInp) {
        pickerInp.value = quickInp ? quickInp.value : '';
        setTimeout(() => pickerInp.focus(), 50);
    }

    await fetchSportsChannelsCatalog();
    filterSportsPickerList();
    if (window.lucide) lucide.createIcons();
};

window.closeSportsChannelPicker = function() {
    const modal = document.getElementById('sportsChannelPickerModal');
    if (modal) modal.classList.add('hidden');
};

window.clearSportsPickerSearch = function() {
    const pickerInp = document.getElementById('sportsPickerSearchInput');
    if (pickerInp) pickerInp.value = '';
    const clearBtn = document.getElementById('btnClearSportsPickerSearch');
    if (clearBtn) clearBtn.classList.add('hidden');
    filterSportsPickerList();
};

window.setSportsPickerCategory = function(cat) {
    sportsPickerActiveCategory = cat;
    const pills = document.querySelectorAll('.sports-picker-pill');
    pills.forEach(p => {
        if (p.getAttribute('data-cat') === cat) {
            p.className = "sports-picker-pill px-3 py-1 rounded-lg font-bold bg-red-600 text-white shadow-sm shrink-0";
        } else {
            p.className = "sports-picker-pill px-3 py-1 rounded-lg font-bold bg-gray-900 text-gray-400 hover:text-white border border-gray-800 shrink-0";
        }
    });
    filterSportsPickerList();
};

window.filterSportsPickerList = function() {
    const container = document.getElementById('sportsPickerResultsList');
    const countDisplay = document.getElementById('sportsPickerResultCount');
    const clearBtn = document.getElementById('btnClearSportsPickerSearch');
    const searchInp = document.getElementById('sportsPickerSearchInput');
    
    if (!container) return;
    
    const query = searchInp ? searchInp.value.trim().toLowerCase() : '';
    if (clearBtn) {
        if (query) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    const channels = cachedSportsCatalog || [];
    let filtered = channels;

    // Filter by category pill
    if (sportsPickerActiveCategory !== 'ALL') {
        const cat = sportsPickerActiveCategory.toLowerCase();
        if (cat === 'events') {
            filtered = filtered.filter(c => c.isEvent || c.source === 'jtv_events' || c.source === 'tim_events' || c.source === 'sonyliv' || c.source === 'fancode' || (c.genre || '').toLowerCase().includes('event') || (c.group || '').toLowerCase().includes('event'));
        } else if (cat === 'sony') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('sony') || (c.name || '').toLowerCase().includes('sony') || (c.group || '').toLowerCase().includes('sony') || (c.genre || '').toLowerCase().includes('sony'));
        } else if (cat === 'jio') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('jtv') || (c.source || '').toLowerCase().includes('jio') || (c.name || '').toLowerCase().includes('jio') || (c.group || '').toLowerCase().includes('jio') || (c.genre || '').toLowerCase().includes('jio') || (c.id || '').startsWith('mdtv-'));
        } else if (cat === 'airtel') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('airtel') || (c.name || '').toLowerCase().includes('airtel') || (c.group || '').toLowerCase().includes('airtel'));
        } else if (cat === 'timstreams') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('tim') || (c.name || '').toLowerCase().includes('timstreams') || (c.id || '').startsWith('tim_'));
        } else if (cat === 'fancode') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('fancode') || (c.name || '').toLowerCase().includes('fancode'));
        } else if (cat === 'zee') {
            filtered = filtered.filter(c => (c.source || '').toLowerCase().includes('zee') || (c.name || '').toLowerCase().includes('zee'));
        } else if (cat === 'star') {
            filtered = filtered.filter(c => (c.name || '').toLowerCase().includes('star') || (c.group || '').toLowerCase().includes('star') || (c.genre || '').toLowerCase().includes('star') || (c.name || '').toLowerCase().includes('hotstar'));
        } else {
            filtered = filtered.filter(c => {
                const name = (c.name || '').toLowerCase();
                const group = (c.group || c.genre || '').toLowerCase();
                const src = (c.source || '').toLowerCase();
                return name.includes(cat) || group.includes(cat) || src.includes(cat);
            });
        }
    }

    // Filter by search query
    if (query) {
        const tokens = query.split(/\s+/).filter(Boolean);
        filtered = filtered.filter(c => {
            const name = (c.name || '').toLowerCase();
            const group = (c.group || c.genre || '').toLowerCase();
            const src = (c.source || '').toLowerCase();
            const id = (c.id || c.channel_id || '').toLowerCase();
            return tokens.every(tok => name.includes(tok) || group.includes(tok) || src.includes(tok) || id.includes(tok));
        });
    }

    if (countDisplay) {
        countDisplay.textContent = `Found ${filtered.length.toLocaleString()} matching channel${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-gray-500">
                <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 text-gray-600 opacity-50"></i>
                <p class="text-xs font-bold text-gray-400">No matching channels found</p>
                <p class="text-[11px] text-gray-600 mt-1">Try another keyword or category filter.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const fallbackLogo = "https://raw.githubusercontent.com/fonghor/image/main/tv.png";
    const toRender = filtered.slice(0, 100);

    container.innerHTML = toRender.map((ch, idx) => {
        const logoSrc = ch.logo && ch.logo.startsWith('http') ? ch.logo : fallbackLogo;
        const chName = ch.name || 'Unnamed Channel';
        const chGroup = ch.group || ch.genre || 'General';
        const chSource = ch.source || 'Catalog';
        const rawJson = JSON.stringify(ch).replace(/'/g, "&#39;");

        return `
            <div onclick="selectSportsChannelFromPicker('${encodeURIComponent(JSON.stringify(ch))}')" class="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-red-500/50 cursor-pointer transition-all group">
                <div class="flex items-center gap-3 min-w-0 pr-2">
                    <img src="${logoSrc}" alt="" class="w-9 h-9 rounded-lg object-contain bg-black/60 p-1 border border-gray-800 shrink-0" onerror="this.onerror=null; this.src='${fallbackLogo}';">
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">${chName}</p>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[9px] font-medium uppercase truncate">${chGroup}</span>
                            <span class="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 text-[9px] font-bold">${chSource}</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-red-600 group-hover:bg-red-500 text-white text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 shadow-sm">
                    <span>Select</span>
                    <i data-lucide="check" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
};

window.selectSportsChannelFromPicker = function(encodedCh) {
    try {
        const ch = JSON.parse(decodeURIComponent(encodedCh));
        applyChannelToSportsForm(ch);

        // Also sync the quick search bar & dropdown
        const quickInp = document.getElementById('sportsQuickSearchInput');
        if (quickInp) quickInp.value = ch.name;
        const clearBtn = document.getElementById('btnClearSportsQuickSearch');
        if (clearBtn) clearBtn.classList.remove('hidden');

        populateSportsQuickSelect(ch.name);

        closeSportsChannelPicker();
        showToast('Channel Selected', `Loaded '${ch.name}' into stream details`, 'success');
    } catch(e) {
        console.error('Failed to select channel from picker', e);
    }
};

/**
 * =========================================================================
 * 🛡️ STREAM HEALTH & QUARANTINE MANAGER (EXCLUDING sportsM3u.ts)
 * =========================================================================
 */
let quarantineScanPollingTimer = null;
let allQuarantinedItems = [];

async function fetchQuarantineList() {
    try {
        const res = await secureFetch('/api/admin/m3u/quarantine/list');
        const data = await res.json();
        if (data.status === 'success') {
            allQuarantinedItems = data.quarantined || [];
            updateQuarantineBadges(allQuarantinedItems.length);
            renderQuarantineTable(allQuarantinedItems);
        }
    } catch (e) {
        console.error('Failed to fetch quarantine list:', e);
    }
}

function updateQuarantineBadges(count) {
    const navBadge = document.getElementById('navQuarantineBadge');
    if (navBadge) navBadge.textContent = `${count} DEAD`;
    const countDisplay = document.getElementById('quarantineCountDisplay');
    if (countDisplay) countDisplay.textContent = count;
    const cjBadge = document.getElementById('cjSubBadgeQuarantine');
    if (cjBadge) cjBadge.textContent = `${count} DEAD`;
    const cjStat = document.getElementById('cjStatQuarantined');
    if (cjStat) cjStat.textContent = count.toLocaleString();
}

function renderQuarantineTable(items) {
    const tbody = document.getElementById('quarantineTableBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500 italic">No quarantined streams detected in channels.json. Click "Scan channels.json Dead Links" to run diagnostics.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const fallbackLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name.substring(0, 2))}&background=ef4444&color=fff&size=64`;
        const logoSrc = item.logo || fallbackLogo;
        const safeUrl = (item.stream_url || '').replace(/'/g, "\\'");
        const safeId = (item.id || '').replace(/'/g, "\\'");
        const safeName = (item.name || '').replace(/'/g, "\\'");

        return `
            <tr class="hover:bg-rose-950/20 transition-colors">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <img src="${logoSrc}" alt="" class="w-8 h-8 rounded-lg object-contain bg-black/50 p-1 border border-gray-800" onerror="this.onerror=null; this.src='${fallbackLogo}';">
                        <div>
                            <p class="font-bold text-white tracking-tight">${item.name}</p>
                            <span class="text-[9px] text-gray-500 font-mono">${item.id}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 font-semibold text-[10px] uppercase border border-gray-700">
                        ${item.group || 'General'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <span class="text-[11px] text-amber-400 font-semibold">${item.playlist_name || item.playlist_id || 'channels.json'}</span>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold text-[10px]">
                        ${item.error_reason || 'Inaccessible'} ${item.http_status ? `(HTTP ${item.http_status})` : ''}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="max-w-[200px] truncate text-[10px] text-gray-500 font-mono" title="${item.stream_url}">
                        ${item.stream_url}
                    </div>
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="recheckStream('${safeUrl}')" class="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all" title="Re-probe link">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                            <span>Test</span>
                        </button>
                        <button onclick="deleteSingleQuarantined('${safeId}', '${safeName}')" class="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all" title="Delete from channels.json">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                            <span>Delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function filterQuarantineTable() {
    const q = (document.getElementById('quarantineSearchInput')?.value || '').toLowerCase().trim();
    if (!q) {
        renderQuarantineTable(allQuarantinedItems);
        return;
    }
    const filtered = allQuarantinedItems.filter(item => 
        (item.name || '').toLowerCase().includes(q) ||
        (item.stream_url || '').toLowerCase().includes(q) ||
        (item.group || '').toLowerCase().includes(q) ||
        (item.playlist_name || '').toLowerCase().includes(q)
    );
    renderQuarantineTable(filtered);
}

async function startQuarantineScan(target = 'channels_json') {
    try {
        const btn = document.getElementById('btnStartScanCj') || document.getElementById('btnStartScan');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Starting scan...</span>`;
            if (window.lucide) lucide.createIcons();
        }

        const res = await secureFetch('/api/admin/m3u/quarantine/scan', { 
            method: 'POST',
            body: JSON.stringify({ target })
        });
        const data = await res.json();
        showToast('Scanner Started', `Background health scan in progress (${target === 'channels_json' ? 'assets/channels.json' : 'all playlists'}).`, 'info');
        
        pollQuarantineScan();
    } catch (e) {
        showToast('Scan Error', e.message || 'Failed to start scan', 'error');
    }
}

async function checkQuarantineScanStatus() {
    try {
        const res = await secureFetch('/api/admin/m3u/quarantine/status');
        const data = await res.json();
        if (data.status === 'success') {
            updateQuarantineBadges(data.quarantinedCount || 0);
            if (data.scan?.is_scanning) {
                pollQuarantineScan();
            }
        }
    } catch (e) {}
}

function pollQuarantineScan() {
    const box = document.getElementById('quarantineProgressBox');
    if (box) box.classList.remove('hidden');

    if (quarantineScanPollingTimer) clearInterval(quarantineScanPollingTimer);

    quarantineScanPollingTimer = setInterval(async () => {
        try {
            const res = await secureFetch('/api/admin/m3u/quarantine/status');
            const data = await res.json();
            if (data.status === 'success') {
                const s = data.scan;
                const total = s.total || 1;
                const checked = s.checked || 0;
                const pct = Math.min(100, Math.round((checked / total) * 100));

                const pctText = document.getElementById('scanPercentText');
                if (pctText) pctText.textContent = `${pct}%`;
                const bar = document.getElementById('scanProgressBar');
                if (bar) bar.style.width = `${pct}%`;
                const checkedEl = document.getElementById('scanCheckedCount');
                if (checkedEl) checkedEl.textContent = checked;
                const totalEl = document.getElementById('scanTotalCount');
                if (totalEl) totalEl.textContent = total;
                const deadEl = document.getElementById('scanDeadCount');
                if (deadEl) deadEl.textContent = s.dead || 0;
                const liveEl = document.getElementById('scanLiveCount');
                if (liveEl) liveEl.textContent = s.active || 0;
                const chEl = document.getElementById('scanCurrentChannel');
                if (chEl) chEl.textContent = s.current_channel ? `Scanning: ${s.current_channel}` : 'Probing links...';

                updateQuarantineBadges(data.quarantinedCount || 0);

                if (!s.is_scanning) {
                    clearInterval(quarantineScanPollingTimer);
                    quarantineScanPollingTimer = null;
                    setTimeout(() => {
                        if (box) box.classList.add('hidden');
                    }, 4000);
                    const btn = document.getElementById('btnStartScanCj') || document.getElementById('btnStartScan');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<i data-lucide="scan-line" class="w-4 h-4"></i><span>Scan channels.json Dead Links</span>`;
                        if (window.lucide) lucide.createIcons();
                    }
                    showToast('Scan Completed', `Finished scanning ${checked} channels. Found ${s.dead || 0} dead streams.`, 'success');
                    fetchQuarantineList();
                }
            }
        } catch (e) {
            clearInterval(quarantineScanPollingTimer);
        }
    }, 1500);
}

async function deleteSingleQuarantined(id, name) {
    const confirmed = await showAppConfirmModal({
        title: 'Delete Quarantined Stream',
        message: `Are you sure you want to permanently delete '${name}' from channels.json?`,
        confirmText: 'Delete Channel',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch('/api/admin/m3u/quarantine/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Channel Deleted', data.message || `Deleted ${name}`, 'success');
            fetchQuarantineList();
            fetchChannelsJsonStats();
            fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('Error', data.message || 'Deletion failed', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

async function purgeAllQuarantined() {
    const confirmed = await showAppConfirmModal({
        title: 'Purge Quarantined Channels',
        message: 'This will permanently delete ALL quarantined dead channels directly from channels.json. Are you sure you want to proceed?',
        confirmText: 'Purge All Quarantined',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await secureFetch('/api/admin/m3u/quarantine/purge-all', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Purge Complete', data.message || `Deleted ${data.deletedCount} dead channels from channels.json.`, 'success');
            fetchQuarantineList();
            fetchChannelsJsonStats();
            fetchChannelsJsonList(cjCurrentPage);
        }
    } catch (e) {
        showToast('Purge Error', e.message, 'error');
    }
}

window.switchCjSubTab = function(subTab) {
    const tabs = ['catalog', 'quarantine', 'converter'];
    tabs.forEach(t => {
        const sec = document.getElementById(`cjSection-${t}`);
        const btn = document.getElementById(`cjSubTabBtn-${t}`);
        if (sec) {
            if (t === subTab) {
                sec.classList.remove('hidden');
            } else {
                sec.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === subTab) {
                btn.className = "flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 bg-amber-600 text-white shadow-lg shadow-amber-600/30";
            } else {
                btn.className = "flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-gray-900/60";
            }
        }
    });

    if (subTab === 'catalog') {
        fetchChannelsJsonStats();
        fetchChannelsJsonList(cjCurrentPage || 1);
    } else if (subTab === 'quarantine') {
        fetchQuarantineList();
    }
    if (window.lucide) lucide.createIcons();
};

async function clearScannedDiagnosticsData() {
    if (!confirm('🧹 Clear scanned diagnostic data?\n\nThis will safely wipe the scanned dead streams list and reset diagnostic reports WITHOUT modifying or deleting any channels in your M3U playlist files.')) return;
    try {
        if (quarantineScanPollingTimer) {
            clearInterval(quarantineScanPollingTimer);
            quarantineScanPollingTimer = null;
        }

        const box = document.getElementById('quarantineProgressBox');
        if (box) box.classList.add('hidden');
        const btn = document.getElementById('btnStartScan');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="scan-line" class="w-4 h-4"></i><span>Scan All M3Us for Dead Links</span>`;
            if (window.lucide) lucide.createIcons();
        }

        const res = await secureFetch('/api/admin/m3u/quarantine/clear-data', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Scan Data Cleared', data.message || 'Scanned data cleared safely.', 'success');
            allQuarantinedItems = [];
            updateQuarantineBadges(0);
            renderQuarantineTable([]);
            fetchQuarantineList();
        } else {
            showToast('Error', data.message || 'Failed to clear scanned data.', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

async function recheckStream(url) {
    try {
        showToast('Probing Stream', 'Testing connectivity to stream URL...', 'info');
        const res = await secureFetch('/api/admin/m3u/quarantine/check-single', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.probe?.live) {
            showToast('Stream is Online!', `Server returned HTTP ${data.probe.status || 200}. Stream is LIVE.`, 'success');
            fetchQuarantineList();
        } else {
            showToast('Stream is Still Dead', `Reason: ${data.probe?.reason || 'Connection failed'}`, 'error');
        }
    } catch (e) {
        showToast('Test Error', e.message, 'error');
    }
}

async function triggerFixAllLogos() {
    try {
        showToast('Resolving Logos', 'Auto-matching and updating channels with authentic IPTV-ORG logos...', 'info');
        const res = await secureFetch('/api/admin/logos/fix-all', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Logos Updated!', data.message || `Assigned ${data.totalFixed} official logos!`, 'success');
            if (currentTab === 'quarantine') fetchQuarantineList();
            if (currentTab === 'reorganize') loadPlaylistChannelsForOrganizer();
        }
    } catch (e) {
        showToast('Logo Fix Error', e.message, 'error');
    }
}

/**
 * =========================================================================
 * 📂 MANUAL SUB-SECTION & CHANNEL ORGANIZER
 * =========================================================================
 */
let organizerChannels = [];
let organizerSubsections = [];
let organizerCurrentSubFilter = 'ALL';
let organizerSelectedIds = new Set();
let activeEditingChannelId = null;

async function loadAvailablePlaylistsForOrganizer() {
    try {
        const res = await secureFetch('/api/admin/m3u/playlists-list');
        const data = await res.json();
        if (data.status === 'success' && data.playlists) {
            const select = document.getElementById('organizerPlaylistSelect');
            if (select) {
                select.innerHTML = data.playlists.map(p => `
                    <option value="${p.id}">${p.name} (${p.channelCount} channels)</option>
                `).join('');
            }
            loadPlaylistChannelsForOrganizer();
        }
    } catch (e) {
        console.error('Failed to load organizer playlists:', e);
    }
}

async function loadPlaylistChannelsForOrganizer() {
    const select = document.getElementById('organizerPlaylistSelect');
    const playlistId = select ? select.value : 'kliv_zob';
    
    try {
        const tbody = document.getElementById('organizerChannelsTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500 italic"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400"></i>Loading channels...</td></tr>`;
        if (window.lucide) lucide.createIcons();

        const res = await secureFetch(`/api/admin/m3u/channels?playlist_id=${encodeURIComponent(playlistId)}`);
        const data = await res.json();
        if (data.status === 'success') {
            organizerChannels = data.channels || [];
            organizerSubsections = data.subsections || [];
            organizerSelectedIds.clear();
            updateOrganizerSelectionCount();

            const badge = document.getElementById('organizerTotalBadge');
            if (badge) badge.textContent = `${organizerChannels.length} channels loaded`;

            renderOrganizerSubsectionPills();
            renderOrganizerChannelsList();
        }
    } catch (e) {
        showToast('Error', e.message || 'Failed to load channels', 'error');
    }
}

function renderOrganizerSubsectionPills() {
    const container = document.getElementById('organizerSubsectionPills');
    if (!container) return;

    // Calculate count per sub-section
    const counts = { ALL: organizerChannels.length };
    organizerChannels.forEach(c => {
        const g = (c.group || 'General').trim();
        counts[g] = (counts[g] || 0) + 1;
    });

    // Make sure all unique groups in channels are in organizerSubsections
    const uniqueGroups = Array.from(new Set([
        ...organizerSubsections,
        ...organizerChannels.map(c => (c.group || 'General').trim())
    ])).filter(Boolean).sort();
    organizerSubsections = uniqueGroups;

    const subCountBadge = document.getElementById('organizerSubCountBadge');
    if (subCountBadge) {
        subCountBadge.textContent = `${uniqueGroups.length} categories`;
    }

    const pills = ['ALL', ...organizerSubsections];

    container.innerHTML = pills.map(sub => {
        const isActive = sub === organizerCurrentSubFilter;
        const count = counts[sub] || 0;
        return `
            <button onclick="setOrganizerSubFilter('${sub.replace(/'/g, "\\'")}')" 
                class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400' : 'bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800'}">
                <span>${sub}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/40 text-cyan-200' : 'bg-gray-800 text-gray-400'} font-mono">${count}</span>
            </button>
        `;
    }).join('');

    // Update active sub-section toolbar strip
    const activeSubToolbar = document.getElementById('activeSubToolbar');
    const activeSubNameDisplay = document.getElementById('activeSubNameDisplay');
    const activeSubCountDisplay = document.getElementById('activeSubCountDisplay');
    
    if (activeSubToolbar) {
        if (organizerCurrentSubFilter !== 'ALL') {
            activeSubToolbar.classList.remove('hidden');
            if (activeSubNameDisplay) activeSubNameDisplay.textContent = organizerCurrentSubFilter;
            if (activeSubCountDisplay) activeSubCountDisplay.textContent = `${counts[organizerCurrentSubFilter] || 0} channels`;
        } else {
            activeSubToolbar.classList.add('hidden');
        }
    }

    // Populate modal group dropdown if exists
    populateModalGroupDropdown();
}

function populateModalGroupDropdown() {
    const groupSelect = document.getElementById('modalChannelGroupSelect');
    if (groupSelect) {
        const groups = Array.from(new Set(['General', ...organizerSubsections])).filter(Boolean);
        groupSelect.innerHTML = groups.map(g => `
            <option value="${g.replace(/"/g, '&quot;')}">${g}</option>
        `).join('');
    }
}

function setOrganizerSubFilter(sub) {
    organizerCurrentSubFilter = sub;
    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
}

function promptAddSubsection() {
    toggleOrganizerSubModal(true, 'create');
}

function handleQuickAddSubsection() {
    const input = document.getElementById('quickSubsectionInput');
    const name = input ? input.value.trim() : '';
    if (!name) {
        showToast('Missing Name', 'Please enter a sub-section name in the box.', 'error');
        return;
    }
    if (!organizerSubsections.includes(name)) {
        organizerSubsections.push(name);
        organizerSubsections.sort();
    }
    if (input) input.value = '';
    setOrganizerSubFilter(name);
    showToast('Sub-section Created', `Created sub-section '${name}'! You can now add channels to it.`, 'success');
}

function toggleOrganizerSubModal(show, mode = 'create', oldName = '') {
    const modal = document.getElementById('organizerSubsectionModal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        const modeInput = document.getElementById('modalSubMode');
        const oldNameInput = document.getElementById('modalSubOldName');
        const nameInput = document.getElementById('modalSubName');
        const titleEl = document.getElementById('organizerSubModalTitle');
        const submitBtnText = document.getElementById('btnSubmitSubModalText');

        if (modeInput) modeInput.value = mode;
        if (oldNameInput) oldNameInput.value = oldName;

        if (mode === 'rename') {
            if (titleEl) titleEl.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-purple-400"></i><span>Rename Sub-Section</span>`;
            if (nameInput) nameInput.value = oldName;
            if (submitBtnText) submitBtnText.textContent = 'Save New Name';
        } else {
            if (titleEl) titleEl.innerHTML = `<i data-lucide="folder-plus" class="w-5 h-5 text-indigo-400"></i><span>New Sub-Section</span>`;
            if (nameInput) nameInput.value = '';
            if (submitBtnText) submitBtnText.textContent = 'Create Sub-Section';
        }

        if (nameInput) setTimeout(() => nameInput.focus(), 100);
        if (window.lucide) lucide.createIcons();
    } else {
        modal.classList.add('hidden');
    }
}

function promptRenameActiveSub() {
    if (organizerCurrentSubFilter === 'ALL') {
        showToast('Select Filter', 'Please select a specific sub-section to rename.', 'info');
        return;
    }
    toggleOrganizerSubModal(true, 'rename', organizerCurrentSubFilter);
}

function saveOrganizerSubForm(event) {
    event.preventDefault();
    const mode = document.getElementById('modalSubMode')?.value || 'create';
    const oldName = document.getElementById('modalSubOldName')?.value || '';
    const newName = document.getElementById('modalSubName')?.value.trim() || '';

    if (!newName) {
        showToast('Missing Name', 'Please enter a valid sub-section name.', 'error');
        return;
    }

    if (mode === 'rename') {
        let count = 0;
        organizerChannels.forEach(c => {
            if (c.group === oldName) {
                c.group = newName;
                count++;
            }
        });
        organizerSubsections = organizerSubsections.map(s => s === oldName ? newName : s);
        organizerCurrentSubFilter = newName;
        showToast('Sub-section Renamed', `Renamed '${oldName}' to '${newName}' (${count} channels updated). Remember to Save.`, 'success');
    } else {
        if (!organizerSubsections.includes(newName)) {
            organizerSubsections.push(newName);
            organizerSubsections.sort();
        }
        organizerCurrentSubFilter = newName;
        showToast('Sub-section Created', `Created sub-section '${newName}'!`, 'success');
    }

    toggleOrganizerSubModal(false);
    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
}

function deleteActiveSubsection() {
    if (organizerCurrentSubFilter === 'ALL') return;
    const subToDelete = organizerCurrentSubFilter;
    if (!confirm(`Are you sure you want to delete category '${subToDelete}'?\n\nAll channels in this category will be safely reassigned to 'General'.`)) return;

    let count = 0;
    organizerChannels.forEach(c => {
        if (c.group === subToDelete) {
            c.group = 'General';
            count++;
        }
    });

    organizerSubsections = organizerSubsections.filter(s => s !== subToDelete);
    organizerCurrentSubFilter = 'ALL';

    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
    showToast('Category Deleted', `Sub-section '${subToDelete}' deleted. Reassigned ${count} channels to 'General'. Click Save to commit.`, 'info');
}

// Library Channels State for "Select from Our Channels"
let libAllChannels = [];
let libPlaylists = [];
let libGroups = [];
let libLoaded = false;
let libIsLoading = false;

function switchChannelModalTab(tab) {
    const tabLib = document.getElementById('tabBtnLibrary');
    const tabManual = document.getElementById('tabBtnManual');
    const pickerSec = document.getElementById('channelLibraryPickerSection');
    const formSec = document.getElementById('organizerChannelForm');

    if (!tabLib || !tabManual || !pickerSec || !formSec) return;

    if (tab === 'library') {
        tabLib.className = "py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all bg-cyan-600 text-white shadow-md shadow-cyan-600/20";
        tabManual.className = "py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all text-gray-400 hover:text-white";
        pickerSec.classList.remove('hidden');
        formSec.classList.add('hidden');
        if (!libLoaded) {
            loadLibraryChannels();
        }
    } else {
        tabManual.className = "py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all bg-cyan-600 text-white shadow-md shadow-cyan-600/20";
        tabLib.className = "py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all text-gray-400 hover:text-white";
        pickerSec.classList.add('hidden');
        formSec.classList.remove('hidden');
        setTimeout(() => document.getElementById('modalChannelName')?.focus(), 100);
    }
    if (window.lucide) lucide.createIcons();
}

async function loadLibraryChannels(force = false) {
    if (libIsLoading) return;
    if (libLoaded && !force) return;

    libIsLoading = true;
    const countBadge = document.getElementById('libResultCountBadge');
    const container = document.getElementById('libChannelsContainer');
    if (countBadge) countBadge.textContent = 'Loading library...';
    if (container) container.innerHTML = `<div class="py-10 text-center text-gray-400 text-xs italic"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400"></i>Fetching channels across all our playlists & portals...</div>`;
    if (window.lucide) lucide.createIcons();

    try {
        const res = await secureFetch('/api/admin/m3u/library-channels?limit=2500');
        const data = await res.json();

        if (data.status === 'success') {
            libAllChannels = data.channels || [];
            libPlaylists = data.playlists || [];
            libGroups = data.groups || [];
            libLoaded = true;

            // Populate source playlist dropdown
            const plSelect = document.getElementById('libSourcePlaylistFilter');
            if (plSelect) {
                plSelect.innerHTML = `<option value="ALL">All Playlists & Portals (${data.total || libAllChannels.length})</option>` +
                    libPlaylists.map(p => `<option value="${p.id}">${p.name} (${p.count})</option>`).join('');
            }

            // Populate source group dropdown
            const grpSelect = document.getElementById('libSourceGroupFilter');
            if (grpSelect) {
                grpSelect.innerHTML = `<option value="ALL">All Categories (${libGroups.length})</option>` +
                    libGroups.map(g => `<option value="${g.replace(/"/g, '&quot;')}">${g}</option>`).join('');
            }

            filterLibraryChannels();
        } else {
            if (container) container.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">${data.message || 'Failed to load library channels'}</div>`;
        }
    } catch (e) {
        if (container) container.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">Error loading channel library: ${e.message}</div>`;
    } finally {
        libIsLoading = false;
    }
}

function refreshLibraryChannels(force = true) {
    libLoaded = false;
    loadLibraryChannels(force);
    showToast('Refreshing Library', 'Reloading channel library from disk and portals...', 'info');
}

function clearLibrarySearch() {
    const input = document.getElementById('libChannelSearchInput');
    if (input) input.value = '';
    const btn = document.getElementById('btnClearLibSearch');
    if (btn) btn.classList.add('hidden');
    filterLibraryChannels();
}

function filterLibraryChannels() {
    const search = (document.getElementById('libChannelSearchInput')?.value || '').toLowerCase().trim();
    const plFilter = document.getElementById('libSourcePlaylistFilter')?.value || 'ALL';
    const grpFilter = document.getElementById('libSourceGroupFilter')?.value || 'ALL';
    const clearBtn = document.getElementById('btnClearLibSearch');
    if (clearBtn) {
        if (search) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    const filtered = libAllChannels.filter(c => {
        if (plFilter !== 'ALL' && c.playlist_id !== plFilter) return false;
        if (grpFilter !== 'ALL' && c.group.toLowerCase() !== grpFilter.toLowerCase()) return false;
        if (search) {
            const nameMatch = (c.name || '').toLowerCase().includes(search);
            const grpMatch = (c.group || '').toLowerCase().includes(search);
            const plMatch = (c.playlist_name || '').toLowerCase().includes(search);
            if (!nameMatch && !grpMatch && !plMatch) return false;
        }
        return true;
    });

    const countBadge = document.getElementById('libResultCountBadge');
    if (countBadge) {
        countBadge.textContent = `${filtered.length} of ${libAllChannels.length} channels`;
    }

    const container = document.getElementById('libChannelsContainer');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center text-gray-500 text-xs">
                <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-400"></i>
                <p>No channels found matching "${search || grpFilter || plFilter}".</p>
                <button onclick="clearLibrarySearch()" class="mt-2 text-cyan-400 hover:underline font-bold text-[11px]">Clear search filter</button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Limit rendered items in DOM for fast silky rendering
    const displayList = filtered.slice(0, 150);
    container.innerHTML = displayList.map(ch => {
        const fallbackLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent((ch.name || 'TV').substring(0, 2))}&background=0284c7&color=fff&size=64`;
        const logoSrc = ch.logo || fallbackLogo;
        const safeId = (ch.id || '').replace(/'/g, "\\'");
        const isPortal = ch.source_type === 'portal';

        return `
            <div class="flex items-center justify-between p-2.5 rounded-xl hover:bg-cyan-950/20 transition-all border border-transparent hover:border-cyan-500/20 group/item">
                <div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div class="w-9 h-9 rounded-xl bg-black/70 border border-gray-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src="${logoSrc}" alt="" class="w-full h-full object-contain" onerror="this.onerror=null; this.src='${fallbackLogo}';">
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-white truncate">${ch.name.replace(/</g, '&lt;')}</span>
                            ${isPortal ? '<span class="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">PORTAL</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span class="text-cyan-400 font-medium truncate max-w-[120px]">${ch.group || 'General'}</span>
                            <span class="text-gray-600">•</span>
                            <span class="text-gray-400 truncate max-w-[140px]">${ch.playlist_name || 'Library'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="selectLibraryChannelForCustomization('${safeId}')" class="px-2.5 py-1.5 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        <span>Select</span>
                    </button>
                    <button type="button" onclick="addLibraryChannelDirectly('${safeId}')" class="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all" title="Add directly to active sub-section">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>+ Add</span>
                    </button>
                </div>
            </div>
        `;
    }).join('') + (filtered.length > 150 ? `<div class="p-2 text-center text-[10px] text-gray-500 italic">Showing top 150 matching channels. Refine search to narrow down.</div>` : '');

    if (window.lucide) lucide.createIcons();
}

function selectLibraryChannelForCustomization(channelId) {
    const ch = libAllChannels.find(c => c.id === channelId);
    if (!ch) return;

    // Fill the manual form
    document.getElementById('modalChannelName').value = ch.name || '';
    document.getElementById('modalChannelStreamUrl').value = ch.stream_url || '';
    document.getElementById('modalChannelLogo').value = ch.logo || '';
    document.getElementById('modalChannelUA').value = ch.user_agent || '';
    document.getElementById('modalChannelXmltv').value = ch.xmltv_id || '';

    // Sub-section selection
    const targetGroup = (organizerCurrentSubFilter !== 'ALL' ? organizerCurrentSubFilter : ch.group) || 'General';
    const groupSelect = document.getElementById('modalChannelGroupSelect');
    const customGroupInput = document.getElementById('modalChannelGroupCustom');
    if (groupSelect) {
        if (Array.from(groupSelect.options).some(o => o.value === targetGroup)) {
            groupSelect.value = targetGroup;
            if (customGroupInput) customGroupInput.value = '';
        } else {
            groupSelect.value = 'General';
            if (customGroupInput) customGroupInput.value = targetGroup;
        }
    }

    updateModalLogoPreview(ch.logo || '');

    // Show source banner
    const banner = document.getElementById('selectedChannelSourceBanner');
    const sourceText = document.getElementById('selectedChannelSourceText');
    if (banner && sourceText) {
        sourceText.textContent = `${ch.name} (${ch.playlist_name || 'Library'})`;
        banner.classList.remove('hidden');
    }

    // Switch to manual tab for review/saving
    switchChannelModalTab('manual');
    showToast('Channel Selected', `Loaded '${ch.name}'. You can customize details or click Save Channel.`, 'success');
}

function addLibraryChannelDirectly(channelId) {
    const ch = libAllChannels.find(c => c.id === channelId);
    if (!ch) return;

    const targetGroup = (organizerCurrentSubFilter !== 'ALL' ? organizerCurrentSubFilter : ch.group) || 'General';
    const newId = 'ch_' + Math.random().toString(36).substring(2, 12);
    const fallbackLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent((ch.name || 'TV').substring(0, 2))}&background=0284c7&color=fff&size=64`;

    const newChannel = {
        id: newId,
        name: ch.name,
        stream_url: ch.stream_url,
        group: targetGroup,
        logo: ch.logo || fallbackLogo,
        user_agent: ch.user_agent || undefined,
        xmltv_id: ch.xmltv_id || undefined,
        order: organizerChannels.length + 1
    };

    organizerChannels.push(newChannel);

    if (!organizerSubsections.includes(targetGroup)) {
        organizerSubsections.push(targetGroup);
        organizerSubsections.sort();
    }

    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();

    showToast('Channel Added!', `Added '${ch.name}' into sub-section '${targetGroup}'. Click "Save & Apply to Playlist" to commit.`, 'success');
}

function openAddChannelModal(initialGroup = null) {
    activeEditingChannelId = null;
    const modal = document.getElementById('organizerChannelModal');
    if (!modal) return;

    populateModalGroupDropdown();

    document.getElementById('organizerChannelModalTitle').textContent = 'Add New Channel';
    document.getElementById('organizerChannelModalSubtitle').textContent = 'Choose from our existing channel library or enter a custom stream.';
    document.getElementById('modalChannelId').value = '';
    document.getElementById('modalChannelMode').value = 'add';
    document.getElementById('modalChannelName').value = '';
    document.getElementById('modalChannelStreamUrl').value = '';
    document.getElementById('modalChannelLogo').value = '';
    document.getElementById('modalChannelUA').value = '';
    document.getElementById('modalChannelXmltv').value = '';
    document.getElementById('btnSubmitChannelModalText').textContent = 'Add Channel to Playlist';

    const banner = document.getElementById('selectedChannelSourceBanner');
    if (banner) banner.classList.add('hidden');

    const targetGroup = initialGroup || (organizerCurrentSubFilter !== 'ALL' ? organizerCurrentSubFilter : 'General');
    const groupSelect = document.getElementById('modalChannelGroupSelect');
    if (groupSelect) groupSelect.value = targetGroup;
    const customGroupInput = document.getElementById('modalChannelGroupCustom');
    if (customGroupInput) customGroupInput.value = '';

    updateModalLogoPreview('');

    // Show source tabs for Add Mode
    const tabs = document.getElementById('channelModalSourceTabs');
    if (tabs) tabs.classList.remove('hidden');

    // Default to library tab so admin can immediately select our own channels!
    switchChannelModalTab('library');

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function openAddChannelToCurrentSubModal() {
    openAddChannelModal(organizerCurrentSubFilter);
}

function openEditChannelModal(channelId) {
    const ch = organizerChannels.find(c => c.id === channelId);
    if (!ch) return;

    activeEditingChannelId = channelId;
    const modal = document.getElementById('organizerChannelModal');
    if (!modal) return;

    populateModalGroupDropdown();

    document.getElementById('organizerChannelModalTitle').textContent = `Edit Channel: ${ch.name}`;
    document.getElementById('organizerChannelModalSubtitle').textContent = 'Update channel name, logo, stream URL, or sub-section assignment.';
    document.getElementById('modalChannelId').value = ch.id;
    document.getElementById('modalChannelMode').value = 'edit';
    document.getElementById('modalChannelName').value = ch.name || '';
    document.getElementById('modalChannelStreamUrl').value = ch.stream_url || '';
    document.getElementById('modalChannelLogo').value = ch.logo || '';
    document.getElementById('modalChannelUA').value = ch.user_agent || '';
    document.getElementById('modalChannelXmltv').value = ch.xmltv_id || '';
    document.getElementById('btnSubmitChannelModalText').textContent = 'Save Changes';

    const banner = document.getElementById('selectedChannelSourceBanner');
    if (banner) banner.classList.add('hidden');

    // In Edit Mode, hide the top tabs and directly show the form
    const tabs = document.getElementById('channelModalSourceTabs');
    if (tabs) tabs.classList.add('hidden');

    const pickerSec = document.getElementById('channelLibraryPickerSection');
    const formSec = document.getElementById('organizerChannelForm');
    if (pickerSec) pickerSec.classList.add('hidden');
    if (formSec) formSec.classList.remove('hidden');

    const groupSelect = document.getElementById('modalChannelGroupSelect');
    const customGroupInput = document.getElementById('modalChannelGroupCustom');
    if (groupSelect) {
        if (Array.from(groupSelect.options).some(o => o.value === ch.group)) {
            groupSelect.value = ch.group;
            if (customGroupInput) customGroupInput.value = '';
        } else {
            groupSelect.value = 'General';
            if (customGroupInput) customGroupInput.value = ch.group;
        }
    }

    updateModalLogoPreview(ch.logo || '');

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => document.getElementById('modalChannelName')?.focus(), 100);
}

function toggleOrganizerChannelModal(show) {
    const modal = document.getElementById('organizerChannelModal');
    if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
}

function updateModalLogoPreview(url) {
    const img = document.getElementById('modalLogoPreview');
    if (!img) return;
    const channelName = document.getElementById('modalChannelName')?.value || 'TV';
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName.substring(0, 2))}&background=0284c7&color=fff&size=64`;
    img.src = url && url.trim() ? url.trim() : fallback;
}

function onModalChannelNameChange(val) {
    const logoInput = document.getElementById('modalChannelLogo');
    if (!logoInput || !logoInput.value) {
        updateModalLogoPreview('');
    }
}

function onModalGroupSelectChange(val) {
    const customInput = document.getElementById('modalChannelGroupCustom');
    if (customInput && val !== 'Custom') {
        customInput.value = '';
    }
}

async function autoResolveModalLogo() {
    const nameInput = document.getElementById('modalChannelName');
    const xmltvInput = document.getElementById('modalChannelXmltv');
    const name = nameInput ? nameInput.value.trim() : '';
    const xmltv = xmltvInput ? xmltvInput.value.trim() : '';

    if (!name) {
        showToast('Missing Channel Name', 'Enter a channel name to search for its logo.', 'info');
        return;
    }

    try {
        showToast('Finding Logo', `Searching IPTV-ORG database for '${name}' logo...`, 'info');
        const res = await secureFetch('/api/admin/logos/resolve', {
            method: 'POST',
            body: JSON.stringify({ name, xmltv_id: xmltv })
        });
        const data = await res.json();
        if (data.logo) {
            const logoInput = document.getElementById('modalChannelLogo');
            if (logoInput) logoInput.value = data.logo;
            updateModalLogoPreview(data.logo);
            showToast('Logo Found!', `Found official logo (${data.matchType || 'exact'})`, 'success');
        } else {
            showToast('No Logo Found', 'No exact match in IPTV-org database. You can paste a custom URL.', 'info');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

async function testModalStreamUrl() {
    const urlInput = document.getElementById('modalChannelStreamUrl');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
        showToast('Missing Stream URL', 'Please enter a stream URL to test.', 'error');
        return;
    }

    try {
        showToast('Probing Stream', 'Testing connectivity to stream server...', 'info');
        const res = await secureFetch('/api/admin/m3u/quarantine/check-single', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.probe?.live) {
            showToast('Stream is Online!', `HTTP ${data.probe.status || 200} OK. Playback stream is active!`, 'success');
        } else {
            showToast('Stream Probe Failed', data.probe?.reason || 'Cannot reach stream server.', 'error');
        }
    } catch (e) {
        showToast('Test Error', e.message, 'error');
    }
}

function saveOrganizerChannelForm(event) {
    event.preventDefault();
    const mode = document.getElementById('modalChannelMode')?.value || 'edit';
    const channelId = document.getElementById('modalChannelId')?.value || '';
    const name = document.getElementById('modalChannelName')?.value.trim() || '';
    const stream_url = document.getElementById('modalChannelStreamUrl')?.value.trim() || '';
    const logo = document.getElementById('modalChannelLogo')?.value.trim() || '';
    const user_agent = document.getElementById('modalChannelUA')?.value.trim() || '';
    const xmltv_id = document.getElementById('modalChannelXmltv')?.value.trim() || '';

    const groupSelect = document.getElementById('modalChannelGroupSelect');
    const customGroup = document.getElementById('modalChannelGroupCustom')?.value.trim() || '';
    const group = customGroup || (groupSelect ? groupSelect.value : 'General') || 'General';

    if (!name || !stream_url) {
        showToast('Missing Fields', 'Channel name and stream URL are required.', 'error');
        return;
    }

    if (mode === 'add') {
        const newId = 'ch_' + Math.random().toString(36).substring(2, 12);
        const fallbackLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.substring(0, 2))}&background=0284c7&color=fff&size=64`;
        const newCh = {
            id: newId,
            name,
            stream_url,
            group,
            logo: logo || fallbackLogo,
            user_agent: user_agent || undefined,
            xmltv_id: xmltv_id || undefined,
            order: organizerChannels.length + 1
        };

        organizerChannels.push(newCh);
        if (!organizerSubsections.includes(group)) {
            organizerSubsections.push(group);
            organizerSubsections.sort();
        }

        showToast('Channel Added', `Added '${name}' to '${group}'. Click "Save & Apply to Playlist" to commit.`, 'success');
    } else {
        const ch = organizerChannels.find(c => c.id === channelId);
        if (ch) {
            ch.name = name;
            ch.stream_url = stream_url;
            ch.group = group;
            ch.logo = logo || ch.logo;
            ch.user_agent = user_agent || undefined;
            ch.xmltv_id = xmltv_id || undefined;

            if (!organizerSubsections.includes(group)) {
                organizerSubsections.push(group);
                organizerSubsections.sort();
            }
            showToast('Channel Updated', `Updated '${name}'. Remember to click "Save & Apply to Playlist".`, 'success');
        }
    }

    toggleOrganizerChannelModal(false);
    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
}

function renderOrganizerChannelsList() {
    const tbody = document.getElementById('organizerChannelsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('organizerSearchInput')?.value || '').toLowerCase().trim();

    const filtered = organizerChannels.filter(c => {
        if (organizerCurrentSubFilter !== 'ALL' && c.group !== organizerCurrentSubFilter) {
            return false;
        }
        if (search && !c.name.toLowerCase().includes(search) && !c.stream_url.toLowerCase().includes(search) && !(c.group || '').toLowerCase().includes(search)) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500 italic">No channels found matching the current sub-section or search filter.</td></tr>`;
        return;
    }

    const subOptionsHtml = Array.from(new Set(['General', ...organizerSubsections])).map(s => `
        <option value="${s.replace(/"/g, '&quot;')}">${s}</option>
    `).join('');

    tbody.innerHTML = filtered.map((ch, idx) => {
        const isChecked = organizerSelectedIds.has(ch.id);
        const fallbackLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(ch.name.substring(0, 2))}&background=0284c7&color=fff&size=64`;
        const logoSrc = ch.logo || fallbackLogo;
        const safeId = (ch.id || '').replace(/'/g, "\\'");
        const cleanStreamUrl = (ch.stream_url || '').length > 35 ? (ch.stream_url.substring(0, 32) + '...') : ch.stream_url;

        return `
            <tr class="hover:bg-cyan-950/20 transition-colors ${isChecked ? 'bg-cyan-950/30' : ''}">
                <td class="py-2.5 px-4 text-center">
                    <input type="checkbox" onchange="toggleOrganizerChannelSelect('${safeId}', this.checked)" ${isChecked ? 'checked' : ''} class="rounded bg-gray-800 border-gray-700 text-cyan-600 focus:ring-cyan-500">
                </td>
                <td class="py-2.5 px-4">
                    <div class="relative group/logo w-9 h-9 cursor-pointer" onclick="openEditChannelModal('${safeId}')" title="Click to edit logo / channel">
                        <img src="${logoSrc}" alt="" class="w-9 h-9 rounded-xl object-contain bg-black/60 p-1 border border-gray-800 hover:border-cyan-500 transition-colors" onerror="this.onerror=null; this.src='${fallbackLogo}';">
                        <div class="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5 text-white"></i>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-4">
                    <div class="flex items-center gap-2">
                        <input type="text" value="${ch.name.replace(/"/g, '&quot;')}" onchange="updateOrganizerChannelName('${safeId}', this.value)" class="bg-transparent hover:bg-gray-900 focus:bg-gray-900 border border-transparent focus:border-cyan-500 rounded-lg px-2 py-1 text-xs text-white font-bold tracking-tight w-full max-w-xs transition-colors">
                        <button onclick="openEditChannelModal('${safeId}')" class="text-gray-500 hover:text-cyan-400 transition-colors" title="Full Channel Editor">
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
                <td class="py-2.5 px-4">
                    <select onchange="updateOrganizerChannelGroup('${safeId}', this.value)" class="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500">
                        <option value="${(ch.group || 'General').replace(/"/g, '&quot;')}" selected>${ch.group || 'General'}</option>
                        ${subOptionsHtml}
                    </select>
                </td>
                <td class="py-2.5 px-4">
                    <div class="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
                        <span title="${ch.stream_url}">${cleanStreamUrl}</span>
                        <button onclick="recheckStream('${encodeURIComponent(ch.stream_url)}')" class="p-1 bg-gray-900 hover:bg-emerald-600/30 text-gray-400 hover:text-emerald-300 rounded transition-colors" title="Probe stream live">
                            <i data-lucide="zap" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
                <td class="py-2.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="moveOrganizerChannel('${safeId}', -1)" class="p-1 bg-gray-900 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Move Up">
                            <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="moveOrganizerChannel('${safeId}', 1)" class="p-1 bg-gray-900 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Move Down">
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
                <td class="py-2.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="fixSingleChannelLogo('${safeId}')" class="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg transition-colors" title="Resolve IPTV-Org Logo">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="openEditChannelModal('${safeId}')" class="p-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg transition-colors" title="Edit Channel">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteSingleOrganizerChannel('${safeId}')" class="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-colors" title="Delete Channel">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function toggleOrganizerChannelSelect(id, checked) {
    if (checked) organizerSelectedIds.add(id);
    else organizerSelectedIds.delete(id);
    updateOrganizerSelectionCount();
}

function toggleSelectAllOrganizer(checkbox) {
    const search = (document.getElementById('organizerSearchInput')?.value || '').toLowerCase().trim();
    const filtered = organizerChannels.filter(c => {
        if (organizerCurrentSubFilter !== 'ALL' && c.group !== organizerCurrentSubFilter) return false;
        if (search && !c.name.toLowerCase().includes(search) && !c.stream_url.toLowerCase().includes(search) && !(c.group || '').toLowerCase().includes(search)) return false;
        return true;
    });

    if (checkbox.checked) {
        filtered.forEach(c => organizerSelectedIds.add(c.id));
    } else {
        filtered.forEach(c => organizerSelectedIds.delete(c.id));
    }
    updateOrganizerSelectionCount();
    renderOrganizerChannelsList();
}

function updateOrganizerSelectionCount() {
    const badge = document.getElementById('organizerSelectedCount');
    if (badge) badge.textContent = `${organizerSelectedIds.size} selected`;
}

function updateOrganizerChannelName(id, newName) {
    const ch = organizerChannels.find(c => c.id === id);
    if (ch && newName.trim()) {
        ch.name = newName.trim();
    }
}

function updateOrganizerChannelGroup(id, newGroup) {
    const ch = organizerChannels.find(c => c.id === id);
    if (ch && newGroup.trim()) {
        ch.group = newGroup.trim();
        if (!organizerSubsections.includes(ch.group)) {
            organizerSubsections.push(ch.group);
            organizerSubsections.sort();
            renderOrganizerSubsectionPills();
        }
    }
}

function moveOrganizerChannel(id, direction) {
    const idx = organizerChannels.findIndex(c => c.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= organizerChannels.length) return;

    const temp = organizerChannels[idx];
    organizerChannels[idx] = organizerChannels[targetIdx];
    organizerChannels[targetIdx] = temp;

    renderOrganizerChannelsList();
}

function deleteSingleOrganizerChannel(id) {
    organizerChannels = organizerChannels.filter(c => c.id !== id);
    organizerSelectedIds.delete(id);
    updateOrganizerSelectionCount();
    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
    showToast('Channel Removed', 'Click "Save & Apply to Playlist" to commit changes.', 'info');
}

function deleteSelectedOrganizerChannels() {
    if (organizerSelectedIds.size === 0) {
        showToast('None Selected', 'Please select channels with the checkboxes first.', 'info');
        return;
    }
    if (!confirm(`Are you sure you want to remove ${organizerSelectedIds.size} selected channels?`)) return;

    organizerChannels = organizerChannels.filter(c => !organizerSelectedIds.has(c.id));
    organizerSelectedIds.clear();
    updateOrganizerSelectionCount();
    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
    showToast('Channels Removed', 'Click "Save & Apply to Playlist" to commit changes.', 'info');
}

async function fixSingleChannelLogo(id) {
    const ch = organizerChannels.find(c => c.id === id);
    if (!ch) return;

    try {
        const res = await secureFetch('/api/admin/logos/resolve', {
            method: 'POST',
            body: JSON.stringify({ name: ch.name, xmltv_id: ch.xmltv_id })
        });
        const data = await res.json();
        if (data.logo) {
            ch.logo = data.logo;
            renderOrganizerChannelsList();
            showToast('Logo Updated', `Resolved logo for '${ch.name}'`, 'success');
        } else {
            showToast('No Logo Found', `Could not find official logo for '${ch.name}'`, 'info');
        }
    } catch (e) {}
}

async function fixSelectedLogos() {
    if (organizerSelectedIds.size === 0) {
        showToast('None Selected', 'Please select channels first.', 'info');
        return;
    }

    showToast('Resolving Logos', `Auto-resolving official logos for ${organizerSelectedIds.size} selected channels...`, 'info');
    for (const id of organizerSelectedIds) {
        const ch = organizerChannels.find(c => c.id === id);
        if (ch) {
            try {
                const res = await secureFetch('/api/admin/logos/resolve', {
                    method: 'POST',
                    body: JSON.stringify({ name: ch.name, xmltv_id: ch.xmltv_id })
                });
                const data = await res.json();
                if (data.logo) ch.logo = data.logo;
            } catch (e) {}
        }
    }
    renderOrganizerChannelsList();
    showToast('Logos Updated', 'Logos resolved for selected channels. Remember to Save.', 'success');
}

async function triggerFixAllLogos() {
    if (!organizerChannels || organizerChannels.length === 0) {
        showToast('No Channels', 'No channels loaded to resolve logos for.', 'info');
        return;
    }

    const missing = organizerChannels.filter(c => !c.logo || c.logo.includes('ui-avatars.com'));
    if (missing.length === 0) {
        showToast('Logos Up-to-date', 'All channels currently have logos assigned.', 'info');
        return;
    }

    showToast('Auto-Assigning Logos', `Searching official logos for ${missing.length} channels...`, 'info');
    let fixed = 0;
    for (const ch of missing) {
        try {
            const res = await secureFetch('/api/admin/logos/resolve', {
                method: 'POST',
                body: JSON.stringify({ name: ch.name, xmltv_id: ch.xmltv_id })
            });
            const data = await res.json();
            if (data.logo) {
                ch.logo = data.logo;
                fixed++;
            }
        } catch (e) {}
    }
    renderOrganizerChannelsList();
    showToast('Logos Updated', `Auto-assigned ${fixed} logos from IPTV-ORG. Click "Save & Apply to Playlist" to commit.`, 'success');
}

function executeBatchMove() {
    const input = document.getElementById('batchMoveTargetInput');
    const target = input ? input.value.trim() : '';
    if (!target) {
        showToast('Missing Sub-section', 'Please enter a target sub-section name.', 'error');
        return;
    }
    if (organizerSelectedIds.size === 0) {
        showToast('None Selected', 'Please select one or more channels to move.', 'error');
        return;
    }

    let moved = 0;
    organizerChannels.forEach(c => {
        if (organizerSelectedIds.has(c.id)) {
            c.group = target;
            moved++;
        }
    });

    if (!organizerSubsections.includes(target)) {
        organizerSubsections.push(target);
        organizerSubsections.sort();
    }

    organizerSelectedIds.clear();
    updateOrganizerSelectionCount();
    if (input) input.value = '';

    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
    showToast('Batch Move Ready', `Moved ${moved} channels to '${target}'. Click "Save & Apply to Playlist" to commit.`, 'success');
}

function executeRenameSubsection() {
    const input = document.getElementById('quickSubsectionInput') || document.getElementById('renameSubsectionNewInput');
    const newName = input ? input.value.trim() : '';
    if (!newName) {
        showToast('Missing Name', 'Please enter a new name for the sub-section.', 'error');
        return;
    }
    if (organizerCurrentSubFilter === 'ALL') {
        showToast('Select Filter', 'Please select a specific sub-section from the filter pills above to rename.', 'error');
        return;
    }

    const oldName = organizerCurrentSubFilter;
    let count = 0;
    organizerChannels.forEach(c => {
        if (c.group === oldName) {
            c.group = newName;
            count++;
        }
    });

    organizerSubsections = organizerSubsections.map(s => s === oldName ? newName : s);
    organizerCurrentSubFilter = newName;
    if (input) input.value = '';

    renderOrganizerSubsectionPills();
    renderOrganizerChannelsList();
    showToast('Sub-section Renamed', `Renamed '${oldName}' to '${newName}' across ${count} channels. Click "Save & Apply to Playlist" to commit.`, 'success');
}

async function saveReorganizedChannels() {
    const select = document.getElementById('organizerPlaylistSelect');
    const playlistId = select ? select.value : 'kliv_zob';

    try {
        const btn = document.getElementById('btnSaveReorganize');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Saving...</span>`;
            if (window.lucide) lucide.createIcons();
        }

        const res = await secureFetch('/api/admin/m3u/channels/save', {
            method: 'POST',
            body: JSON.stringify({
                playlistId,
                channels: organizerChannels
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Saved Successfully!', data.message || `Saved ${organizerChannels.length} channels to live playlist!`, 'success');
        } else {
            showToast('Save Error', data.message || 'Failed to save', 'error');
        }
    } catch (e) {
        showToast('Save Error', e.message, 'error');
    } finally {
        const btn = document.getElementById('btnSaveReorganize');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Save & Apply to Playlist</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// ==========================================
// CHANNELS JSON STUDIO & M3U CONVERTER
// ==========================================

let cjCurrentPage = 1;
let cjPageLimit = 50;
let cjSearchQuery = '';
let cjSelectedGenre = '';
let cjSelectedSource = '';
let cjCurrentChannelsList = [];
let cjSearchTimeout = null;
let cjHlsInstance = null;
let cjActiveStreamUrl = '';

// 1. Fetch Stats & Metadata
async function fetchChannelsJsonStats() {
    try {
        const res = await secureFetch('/api/admin/channels-json/stats');
        const data = await res.json();
        if (data.status === 'success' && data.stats) {
            const s = data.stats;
            const elTotal = document.getElementById('cjStatTotalChannels');
            const elGenres = document.getElementById('cjStatTotalGenres');
            const elSize = document.getElementById('cjStatFileSize');
            const elModified = document.getElementById('cjStatLastModified');

            if (elTotal) elTotal.textContent = s.totalChannels.toLocaleString();
            if (elGenres) elGenres.textContent = s.totalGenres.toLocaleString();
            if (elSize) elSize.textContent = s.fileSizeFormatted || '0 KB';
            if (elModified) {
                const date = s.lastModified && s.lastModified !== 'N/A' ? new Date(s.lastModified).toLocaleString() : 'N/A';
                elModified.textContent = date;
            }

            // Populate Genre Filter Dropdown
            const genreFilter = document.getElementById('cjGenreFilter');
            const purgeSelect = document.getElementById('cjPurgeGenreSelect');
            const genreDataList = document.getElementById('cjGenreDataList');

            if (genreFilter) {
                const currentVal = genreFilter.value;
                genreFilter.innerHTML = '<option value="">All Categories / Genres (' + s.totalChannels + ')</option>';
                s.genres.forEach(g => {
                    genreFilter.innerHTML += `<option value="${escapeHtml(g.name)}" ${currentVal === g.name ? 'selected' : ''}>${escapeHtml(g.name)} (${g.count})</option>`;
                });
            }

            if (purgeSelect) {
                purgeSelect.innerHTML = '<option value="">-- Choose Category to Delete --</option>';
                s.genres.forEach(g => {
                    purgeSelect.innerHTML += `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)} (${g.count} channels)</option>`;
                });
            }

            if (genreDataList) {
                genreDataList.innerHTML = '';
                s.genres.forEach(g => {
                    genreDataList.innerHTML += `<option value="${escapeHtml(g.name)}">`;
                });
            }

            // Populate Source Filter Dropdown
            const sourceFilter = document.getElementById('cjSourceFilter');
            if (sourceFilter) {
                const currentVal = sourceFilter.value;
                sourceFilter.innerHTML = '<option value="">All Sources</option>';
                s.sources.forEach(src => {
                    sourceFilter.innerHTML += `<option value="${escapeHtml(src.name)}" ${currentVal === src.name ? 'selected' : ''}>${escapeHtml(src.name)} (${src.count})</option>`;
                });
            }
        }
    } catch (e) {
        console.error('Failed to fetch channels.json stats:', e);
    }
}

// 2. Fetch Paginated Channels List
async function fetchChannelsJsonList(page = cjCurrentPage) {
    cjCurrentPage = page;
    const tableBody = document.getElementById('cjChannelsTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-gray-500 italic"><div class="flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-500"></i><span>Loading channels catalog...</span></div></td></tr>`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const url = `/api/admin/channels-json/list?page=${page}&limit=${cjPageLimit}&search=${encodeURIComponent(cjSearchQuery)}&genre=${encodeURIComponent(cjSelectedGenre)}&source=${encodeURIComponent(cjSelectedSource)}`;
        const res = await secureFetch(url);
        const data = await res.json();

        if (data.status === 'success') {
            cjCurrentChannelsList = data.channels || [];
            renderChannelsJsonTable(data.channels, data.total, data.page, data.totalPages);
        } else {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-400">Failed to load channels: ${data.message || 'Unknown error'}</td></tr>`;
        }
    } catch (e) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-400">Error connecting to server: ${e.message}</td></tr>`;
    }
}

// 3. Render Channels Table
function renderChannelsJsonTable(channels, total, page, totalPages) {
    const tableBody = document.getElementById('cjChannelsTableBody');
    if (!tableBody) return;

    if (!channels || channels.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i data-lucide="inbox" class="w-8 h-8 text-gray-600"></i>
                        <p class="text-xs font-bold text-gray-400">No channels found matching your criteria</p>
                        <p class="text-[11px] text-gray-600">Try adjusting your search query, genre filter, or convert an M3U playlist.</p>
                    </div>
                </td>
            </tr>`;
        if (window.lucide) lucide.createIcons();
        updateCjPagination(0, 0, 0, 1, 1);
        return;
    }

    let html = '';
    const startIndex = (page - 1) * cjPageLimit;

    channels.forEach((ch, idx) => {
        const globalIdx = startIndex + idx + 1;
        const name = escapeHtml(ch.name || 'Unnamed Channel');
        const genre = escapeHtml(ch.genre || 'Uncategorized');
        const source = escapeHtml(ch.source || 'default');
        const logo = ch.logo ? escapeHtml(ch.logo) : '';
        const url = escapeHtml(ch.channel_id || '');
        const truncatedUrl = url.length > 55 ? url.substring(0, 52) + '...' : url;

        html += `
            <tr class="hover:bg-white/[0.02] transition-colors group">
                <td class="py-3 px-3 text-center text-gray-500 font-mono text-[11px]">${globalIdx}</td>
                <td class="py-3 px-3 text-center">
                    <div class="w-9 h-9 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden mx-auto">
                        ${logo ? `<img src="${logo}" alt="" class="w-full h-full object-contain p-1" onerror="this.onerror=null; this.src='/assets/default_channel.png';">` : `<i data-lucide="tv" class="w-4 h-4 text-gray-600"></i>`}
                    </div>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white text-xs tracking-tight">${name}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 max-w-[150px] truncate">
                        ${genre}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono text-gray-400 bg-gray-900 border border-gray-800">
                        ${source}
                    </span>
                </td>
                <td class="py-3 px-4 max-w-xs">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono text-[11px] text-gray-400 truncate max-w-[240px]" title="${url}">${truncatedUrl}</span>
                        <button onclick="copyCjChannelUrl('${escapeJsString(ch.channel_id)}')" class="p-1 text-gray-500 hover:text-white transition-colors" title="Copy stream URL">
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="searchCjChannelLogoWeb(${idx})" class="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg transition-colors" title="Auto-search TV network logo (DuckDuckGo / Yahoo / Wikipedia)">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="openCjStreamModal('${escapeJsString(ch.channel_id)}', '${escapeJsString(ch.name)}', '${escapeJsString(ch.genre)}')" class="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg transition-colors" title="Test stream playback">
                            <i data-lucide="play" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="openEditChannelJsonModal(${idx})" class="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg transition-colors" title="Edit channel">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteCjChannel(${idx})" class="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg transition-colors" title="Delete channel">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tableBody.innerHTML = html;
    if (window.lucide) lucide.createIcons();

    const start = startIndex + 1;
    const end = Math.min(startIndex + channels.length, total);
    updateCjPagination(start, end, total, page, totalPages);
}

function updateCjPagination(start, end, total, page, totalPages) {
    const elStart = document.getElementById('cjPageStart');
    const elEnd = document.getElementById('cjPageEnd');
    const elTotal = document.getElementById('cjTotalFiltered');
    const elIndicator = document.getElementById('cjPageIndicator');
    const btnPrev = document.getElementById('btnCjPrevPage');
    const btnNext = document.getElementById('btnCjNextPage');

    if (elStart) elStart.textContent = start.toLocaleString();
    if (elEnd) elEnd.textContent = end.toLocaleString();
    if (elTotal) elTotal.textContent = total.toLocaleString();
    if (elIndicator) elIndicator.textContent = `Page ${page} / ${totalPages || 1}`;

    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= totalPages;
}

// 4. Input Method Switcher
function setCjInputMethod(method) {
    ['file', 'paste', 'url'].forEach(m => {
        const btn = document.getElementById(`cjMethodBtn-${m}`);
        const group = document.getElementById(`cjInputGroup-${m}`);
        if (btn) {
            if (m === method) {
                btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white transition-all';
            } else {
                btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all';
            }
        }
        if (group) {
            if (m === method) group.classList.remove('hidden');
            else group.classList.add('hidden');
        }
    });
}

function handleCjFileSelected(input) {
    const label = document.getElementById('cjDropZoneFileName');
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (label) label.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
}

function loadSampleM3uIntoPaste() {
    const textarea = document.getElementById('cjPasteTextarea');
    if (textarea) {
        textarea.value = `#EXTM3U
#EXTINF:-1 tvg-name="Sony Ten 1 HD" tvg-logo="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100" group-title="Sports",Sony Ten 1 HD
https://stream.kliv.in/nex/jiobe_7745.m3u8
#EXTINF:-1 tvg-name="Star Sports Select 1 HD" tvg-logo="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=100" group-title="Sports",Star Sports Select 1 HD
https://stream.kliv.in/nex/jiobe_7852.m3u8
#EXTINF:-1 tvg-name="HBO Premier HD" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/960px-HBO_logo.svg.png" group-title="Movies",HBO Premier HD
https://stream.kliv.in/nex/jiobe_7775.m3u8`;
        showToast('Sample Loaded', 'Sample M3U template loaded into editor.', 'info');
    }
}

// 5. Preview Conversion
async function previewCjConversion() {
    const btn = document.getElementById('btnCjPreview');
    const container = document.getElementById('cjPreviewResultContainer');
    const fileInput = document.getElementById('cjFileInput');
    const pasteText = document.getElementById('cjPasteTextarea')?.value || '';
    const urlInput = document.getElementById('cjUrlInput')?.value || '';
    const defaultGenre = document.getElementById('cjDefaultGenre')?.value || 'Custom M3U';
    const defaultSource = document.getElementById('cjSourceTag')?.value || 'm3u_converter';

    let hasInput = false;
    if (fileInput && fileInput.files && fileInput.files[0]) hasInput = true;
    if (pasteText.trim()) hasInput = true;
    if (urlInput.trim()) hasInput = true;

    if (!hasInput) {
        showToast('Input Required', 'Please choose an M3U file, paste playlist text, or enter an M3U URL.', 'warning');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-400"></i><span>Parsing M3U...</span>`;
            if (window.lucide) lucide.createIcons();
        }

        const formData = new FormData();
        formData.append('mode', 'preview');
        formData.append('defaultGenre', defaultGenre);
        formData.append('defaultSource', defaultSource);

        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        } else if (pasteText.trim()) {
            formData.append('m3uContent', pasteText);
        } else if (urlInput.trim()) {
            formData.append('m3uUrl', urlInput);
        }

        const res = await fetch('/api/admin/channels-json/convert', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: formData
        });

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error(res.ok ? 'Invalid response from server' : `Server responded with error (${res.status})`);
        }

        if (data.status === 'success') {
            if (container) container.classList.remove('hidden');

            const elTotal = document.getElementById('cjPrevTotalParsed');
            const elNew = document.getElementById('cjPrevNewUnique');
            const elExisting = document.getElementById('cjPrevExisting');
            const elGenres = document.getElementById('cjPrevGenresCount');
            const tableBody = document.getElementById('cjPrevTableBody');

            if (elTotal) elTotal.textContent = data.totalParsed.toLocaleString();
            if (elNew) elNew.textContent = (data.newUniqueCount || 0).toLocaleString();
            if (elExisting) elExisting.textContent = (data.existingCount || 0).toLocaleString();
            if (elGenres) elGenres.textContent = (data.genresFound ? data.genresFound.length : 0).toLocaleString();

            if (tableBody && data.sampleChannels) {
                let sampleHtml = '';
                data.sampleChannels.slice(0, 10).forEach((ch, idx) => {
                    const name = escapeHtml(ch.name || '');
                    const genre = escapeHtml(ch.genre || '');
                    const url = escapeHtml(ch.channel_id || '');
                    sampleHtml += `
                        <tr class="hover:bg-white/[0.02]">
                            <td class="py-2 px-3 text-center text-gray-500 font-mono text-[10px]">${idx + 1}</td>
                            <td class="py-2 px-3 font-bold text-white">${name}</td>
                            <td class="py-2 px-3 text-amber-400 text-[10px]">${genre}</td>
                            <td class="py-2 px-3 font-mono text-gray-400 text-[10px] truncate max-w-[200px]">${url}</td>
                        </tr>`;
                });
                tableBody.innerHTML = sampleHtml;
            }

            showToast('Preview Ready', data.message || `Parsed ${data.totalParsed} channels successfully!`, 'success');
        } else {
            showToast('Conversion Preview Failed', data.message || 'Error parsing M3U', 'error');
        }
    } catch (e) {
        showToast('Preview Error', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="eye" class="w-4 h-4 text-amber-400"></i><span>Preview Conversion</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// 6. Handle M3U Conversion & Save
async function handleCjConvertSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnCjConvertSubmit');
    const fileInput = document.getElementById('cjFileInput');
    const pasteText = document.getElementById('cjPasteTextarea')?.value || '';
    const urlInput = document.getElementById('cjUrlInput')?.value || '';
    const mode = document.getElementById('cjImportMode')?.value || 'append';
    const defaultGenre = document.getElementById('cjDefaultGenre')?.value || 'Custom M3U';
    const defaultSource = document.getElementById('cjSourceTag')?.value || 'm3u_converter';
    const deduplicate = document.getElementById('cjDeduplicateCheck')?.checked !== false;

    let hasInput = false;
    if (fileInput && fileInput.files && fileInput.files[0]) hasInput = true;
    if (pasteText.trim()) hasInput = true;
    if (urlInput.trim()) hasInput = true;

    if (!hasInput) {
        showToast('Input Required', 'Please provide an M3U file, paste playlist text, or enter an M3U URL.', 'warning');
        return;
    }

    if (mode === 'replace') {
        if (!confirm('⚠️ WARNING: You selected REPLACE MODE.\n\nThis will overwrite all existing channels in channels.json with the new M3U channels.\n(A backup will be automatically saved to doctor_strange/backups/).\n\nDo you want to continue?')) {
            return;
        }
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Converting & Saving channels.json...</span>`;
            if (window.lucide) lucide.createIcons();
        }

        const formData = new FormData();
        formData.append('mode', mode);
        formData.append('defaultGenre', defaultGenre);
        formData.append('defaultSource', defaultSource);
        formData.append('deduplicate', deduplicate ? 'true' : 'false');

        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        } else if (pasteText.trim()) {
            formData.append('m3uContent', pasteText);
        } else if (urlInput.trim()) {
            formData.append('m3uUrl', urlInput);
        }

        const res = await fetch('/api/admin/channels-json/convert', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: formData
        });

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error(res.ok ? 'Invalid response from server' : `Server responded with error (${res.status})`);
        }

        if (data.status === 'success') {
            showToast('Catalog Updated!', data.message || 'Successfully updated channels.json!', 'success');
            // Refresh stats and catalog table
            fetchChannelsJsonStats();
            fetchChannelsJsonList(1);
            // Hide preview
            const container = document.getElementById('cjPreviewResultContainer');
            if (container) container.classList.add('hidden');
        } else {
            showToast('Conversion Error', data.message || 'Failed to update channels.json', 'error');
        }
    } catch (e) {
        showToast('Server Error', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="file-check" class="w-4 h-4"></i><span>Convert & Save to channels.json</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function resetCjConverterForm() {
    const form = document.getElementById('cjConverterForm');
    if (form) form.reset();
    const dropName = document.getElementById('cjDropZoneFileName');
    if (dropName) dropName.textContent = 'Drag & drop your M3U playlist file here';
    const container = document.getElementById('cjPreviewResultContainer');
    if (container) container.classList.add('hidden');
    setCjInputMethod('file');
}

// 7. Search & Filtering Handlers
function debounceCjSearch() {
    clearTimeout(cjSearchTimeout);
    cjSearchTimeout = setTimeout(() => {
        cjSearchQuery = document.getElementById('cjSearchInput')?.value || '';
        fetchChannelsJsonList(1);
    }, 300);
}

function handleCjFilterChange() {
    cjSelectedGenre = document.getElementById('cjGenreFilter')?.value || '';
    cjSelectedSource = document.getElementById('cjSourceFilter')?.value || '';
    fetchChannelsJsonList(1);
}

function handleCjLimitChange(val) {
    cjPageLimit = parseInt(val, 10) || 50;
    fetchChannelsJsonList(1);
}

function changeCjPage(delta) {
    fetchChannelsJsonList(cjCurrentPage + delta);
}

// 8. Add / Edit Single Channel Modals
function updateCjFormLogoPreview(url) {
    const box = document.getElementById('cjFormLogoPreviewBox');
    if (!box) return;
    if (url && url.trim()) {
        box.innerHTML = `<img src="${escapeHtml(url.trim())}" alt="logo" class="w-full h-full object-contain" onerror="this.onerror=null; if (this && this.parentElement) { this.parentElement.innerHTML='<i data-lucide=\\'image-off\\' class=\\'w-5 h-5 text-rose-500\\'></i>'; if(window.lucide) lucide.createIcons(); }">`;
    } else {
        box.innerHTML = `<i data-lucide="image" class="w-5 h-5 text-gray-600"></i>`;
    }
    if (window.lucide) lucide.createIcons();
}

async function searchCjModalLogoWeb() {
    const nameInput = document.getElementById('cjFormName');
    const name = nameInput ? nameInput.value.trim() : '';
    const btn = document.getElementById('btnCjSearchLogoWeb');
    const note = document.getElementById('cjLogoSearchResultNote');

    if (!name) {
        showToast('Channel Name Required', 'Please enter a channel name first before searching for a logo.', 'warning');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Searching DDG / Yahoo...</span>`;
            if (window.lucide) lucide.createIcons();
        }
        if (note) {
            note.classList.remove('hidden');
            note.innerHTML = `<span class="text-amber-400">Searching DuckDuckGo, Yahoo & Wikimedia Commons for '${escapeHtml(name)}'...</span>`;
        }

        const res = await secureFetch('/api/admin/channels-json/search-logo', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        const data = await res.json();

        if (data.status === 'success' && data.logo) {
            const logoInput = document.getElementById('cjFormLogo');
            if (logoInput) logoInput.value = data.logo;
            updateCjFormLogoPreview(data.logo);

            const engineName = (data.engine || 'Web Scraper').replace(/_/g, ' ').toUpperCase();
            if (note) {
                note.innerHTML = `<span class="text-emerald-400 font-bold">✓ Found official logo via ${escapeHtml(engineName)}</span>`;
            }
            showToast('Logo Discovered!', `Found TV logo for '${name}' via ${engineName}`, 'success');
        } else {
            if (note) {
                note.innerHTML = `<span class="text-gray-400">No exact match found online. Generated fallback broadcast SVG badge.</span>`;
            }
            showToast('Fallback Logo', 'Could not locate transparent PNG online. You can enter a custom image URL.', 'info');
        }
    } catch (e) {
        showToast('Logo Search Error', e.message, 'error');
        if (note) note.innerHTML = `<span class="text-rose-400">Error: ${escapeHtml(e.message)}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i><span>Search Web Logo (DDG / Yahoo)</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function searchCjChannelLogoWeb(index) {
    const ch = cjCurrentChannelsList[index];
    if (!ch || !ch.name) {
        showToast('Error', 'Invalid channel selected.', 'error');
        return;
    }

    try {
        showToast('Searching Web Logo', `Searching DuckDuckGo & Yahoo for '${ch.name}' logo...`, 'info');
        const res = await secureFetch('/api/admin/channels-json/search-logo', {
            method: 'POST',
            body: JSON.stringify({ name: ch.name, channel_id: ch.channel_id, currentLogo: ch.logo })
        });
        const data = await res.json();

        if (data.status === 'success' && data.logo) {
            ch.logo = data.logo;
            // Update channel in database
            await secureFetch('/api/admin/channels-json/channel', {
                method: 'PUT',
                body: JSON.stringify({
                    originalChannelId: ch.channel_id,
                    name: ch.name,
                    channel_id: ch.channel_id,
                    genre: ch.genre || 'General',
                    source: ch.source || 'admin_manual',
                    logo: data.logo
                })
            });

            const engineName = (data.engine || 'Web Scraper').replace(/_/g, ' ').toUpperCase();
            showToast('Logo Updated', `Resolved logo for '${ch.name}' via ${engineName}`, 'success');
            fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('No Logo Found', `Could not find transparent logo for '${ch.name}'`, 'info');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

function openAddChannelJsonModal() {
    const form = document.getElementById('cjChannelForm');
    if (form) form.reset();
    document.getElementById('cjFormMode').value = 'add';
    document.getElementById('cjFormOriginalUrl').value = '';
    document.getElementById('cjChannelModalTitle').textContent = 'Add Channel to JSON';
    document.getElementById('cjFormSubmitBtnText').textContent = 'Add Channel';
    const note = document.getElementById('cjLogoSearchResultNote');
    if (note) note.classList.add('hidden');
    updateCjFormLogoPreview('');
    toggleCjChannelModal(true);
}

function openEditChannelJsonModal(index) {
    const ch = cjCurrentChannelsList[index];
    if (!ch) return;

    document.getElementById('cjFormMode').value = 'edit';
    document.getElementById('cjFormOriginalUrl').value = ch.channel_id || '';
    document.getElementById('cjFormName').value = ch.name || '';
    document.getElementById('cjFormUrl').value = ch.channel_id || '';
    document.getElementById('cjFormGenre').value = ch.genre || '';
    document.getElementById('cjFormSource').value = ch.source || 'admin_manual';
    document.getElementById('cjFormLogo').value = ch.logo || '';
    document.getElementById('cjChannelModalTitle').textContent = 'Edit Channel';
    document.getElementById('cjFormSubmitBtnText').textContent = 'Save Changes';
    const note = document.getElementById('cjLogoSearchResultNote');
    if (note) note.classList.add('hidden');
    updateCjFormLogoPreview(ch.logo || '');

    toggleCjChannelModal(true);
}

function toggleCjChannelModal(show) {
    const modal = document.getElementById('cjChannelModal');
    if (!modal) return;
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

async function saveCjChannelForm(e) {
    e.preventDefault();
    const mode = document.getElementById('cjFormMode').value;
    const originalChannelId = document.getElementById('cjFormOriginalUrl').value;
    const name = document.getElementById('cjFormName').value.trim();
    const channel_id = document.getElementById('cjFormUrl').value.trim();
    const genre = document.getElementById('cjFormGenre').value.trim() || 'General';
    const source = document.getElementById('cjFormSource').value.trim() || 'admin_manual';
    const logo = document.getElementById('cjFormLogo').value.trim();

    try {
        let endpoint = '/api/admin/channels-json/channel';
        let method = 'POST';
        let payload = { name, channel_id, genre, source, logo };

        if (mode === 'edit') {
            method = 'PUT';
            payload.originalChannelId = originalChannelId;
        }

        const res = await secureFetch(endpoint, {
            method,
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('Channel Saved', data.message || 'Channel updated successfully!', 'success');
            toggleCjChannelModal(false);
            fetchChannelsJsonStats();
            fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('Save Error', data.message || 'Failed to save channel', 'error');
        }
    } catch (err) {
        showToast('Error', err.message, 'error');
    }
}

// 9. Delete Single Channel
async function deleteCjChannel(param1, param2) {
    let channelId = '';
    let name = '';

    if (typeof param1 === 'number') {
        const ch = cjCurrentChannelsList[param1];
        if (!ch) {
            showToast('Error', 'Channel not found in current view.', 'error');
            return;
        }
        channelId = ch.channel_id || '';
        name = ch.name || '';
    } else {
        channelId = param1 || '';
        name = param2 || '';
    }

    const confirmed = await showAppConfirmModal({
        title: 'Delete Channel',
        message: `Are you sure you want to permanently delete "${name || channelId}" from channels.json?`,
        confirmText: 'Delete Channel',
        isDanger: true
    });

    if (!confirmed) return;

    try {
        const res = await secureFetch('/api/admin/channels-json/channel', {
            method: 'DELETE',
            body: JSON.stringify({ channel_id: channelId, name: name })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('Channel Deleted', `Channel "${name || channelId}" removed from database.`, 'success');
            fetchChannelsJsonStats();
            fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('Delete Error', data.message || 'Failed to delete channel', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

// 9b. Full Deletion of All Channels
async function confirmClearAllChannelsJson() {
    const confirmed = await showAppConfirmModal({
        title: '⚠️ Clear All Channels (Full Wipe)',
        message: 'Are you sure you want to delete ALL channels in channels.json? A safety backup will be created automatically in doctor_strange/backups/.',
        confirmText: 'Yes, Delete All Channels',
        isDanger: true
    });

    if (!confirmed) return;

    try {
        showToast('Clearing Database', 'Deleting all channels and creating backup...', 'info');
        const res = await secureFetch('/api/admin/channels-json/clear-all', {
            method: 'POST'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Database Cleared', data.message || 'All channels deleted successfully.', 'success');
            fetchChannelsJsonStats();
            fetchChannelsJsonList(1);
        } else {
            showToast('Error', data.message || 'Failed to clear channels', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

// 9c. Fix All Logos in Channels JSON with Logopedia, DuckDuckGo, Yahoo & Wikimedia Backup
let cjLogoAbortController = null;

function toggleCjLogoProgressModal(show) {
    const modal = document.getElementById('cjLogoProgressModal');
    if (!modal) return;
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function finishCjLogoFixModal() {
    toggleCjLogoProgressModal(false);
    fetchChannelsJsonStats();
    fetchChannelsJsonList(cjCurrentPage);
}

function abortCjLogoFix() {
    if (cjLogoAbortController) {
        cjLogoAbortController.abort();
        cjLogoAbortController = null;
    }
    toggleCjLogoProgressModal(false);
    showToast('Scraper Stopped', 'Logo search operation was stopped by user.', 'info');
    fetchChannelsJsonStats();
    fetchChannelsJsonList(cjCurrentPage);
}

async function fixAllChannelsJsonLogosUi() {
    const modal = document.getElementById('cjLogoProgressModal');
    const barFill = document.getElementById('cjLogoProgressBarFill');
    const percentText = document.getElementById('cjLogoProgressPercent');
    const currentChannelText = document.getElementById('cjLogoProgressCurrentChannel');
    const statProcessed = document.getElementById('cjLogoStatProcessed');
    const statResolved = document.getElementById('cjLogoStatResolved');
    const statEngine = document.getElementById('cjLogoStatEngine');
    const activePreviewBox = document.getElementById('cjLogoActivePreviewBox');
    const activeTitle = document.getElementById('cjLogoActiveTitle');
    const activeBadge = document.getElementById('cjLogoActiveBadge');
    const activeUrl = document.getElementById('cjLogoActiveUrl');
    const btnStop = document.getElementById('btnStopCjLogoFix');
    const btnDone = document.getElementById('btnDoneCjLogoFix');

    // Reset UI
    if (barFill) barFill.style.width = '0%';
    if (percentText) percentText.textContent = '0%';
    if (currentChannelText) currentChannelText.textContent = 'Connecting to multi-engine scraper...';
    if (statProcessed) statProcessed.textContent = '0 / 0';
    if (statResolved) statResolved.textContent = '0';
    if (statEngine) statEngine.textContent = 'LOGOPEDIA';
    if (activeTitle) activeTitle.textContent = 'Initializing stream...';
    if (activeBadge) {
        activeBadge.textContent = 'CONNECTING';
        activeBadge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase';
    }
    if (activePreviewBox) activePreviewBox.innerHTML = `<i data-lucide="image" class="w-5 h-5 text-gray-600"></i>`;
    if (btnStop) btnStop.classList.remove('hidden');
    if (btnDone) btnDone.classList.add('hidden');
    if (window.lucide) lucide.createIcons();

    toggleCjLogoProgressModal(true);

    cjLogoAbortController = new AbortController();
    let totalChannels = 0;
    let resolvedCount = 0;

    try {
        const token = getAdminToken();
        const response = await fetch('/api/admin/channels-json/fix-logos-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ forceRescrape: false, batchSize: 6 }),
            signal: cjLogoAbortController.signal
        });

        if (!response.ok || !response.body) {
            throw new Error(`Stream connection failed with HTTP status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const jsonStr = trimmed.replace(/^data:\s*/, '');
                try {
                    const data = JSON.parse(jsonStr);

                    if (data.type === 'start') {
                        if (currentChannelText) currentChannelText.textContent = 'Starting multi-engine search...';
                        if (activeUrl) activeUrl.textContent = 'Logopedia (logos.fandom.com) → DuckDuckGo → Yahoo → Wikimedia (Backup)';
                    } else if (data.type === 'progress') {
                        totalChannels = data.total || totalChannels;
                        const current = data.current || 0;
                        const percent = data.percent || Math.round((current / (totalChannels || 1)) * 100);

                        if (barFill) barFill.style.width = `${Math.min(percent, 100)}%`;
                        if (percentText) percentText.textContent = `${Math.min(percent, 100)}%`;
                        if (currentChannelText) currentChannelText.textContent = `Processing: ${data.channelName || 'Channel'}`;
                        if (statProcessed) statProcessed.textContent = `${current} / ${totalChannels}`;

                        if (data.status === 'fixed') {
                            resolvedCount++;
                            if (statResolved) statResolved.textContent = `${resolvedCount}`;
                        }

                        const engineRaw = (data.engine || 'logopedia').replace(/^web_search_/, '');
                        const engineClean = engineRaw.toUpperCase();
                        if (statEngine) statEngine.textContent = engineClean;

                        if (activeTitle) activeTitle.textContent = data.channelName || 'Channel';
                        if (activeUrl) activeUrl.textContent = data.logo || 'Resolving broadcast asset...';

                        if (activeBadge) {
                            if (data.status === 'fixed') {
                                activeBadge.textContent = `FOUND VIA ${engineClean}`;
                                activeBadge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase';
                            } else if (data.status === 'valid') {
                                activeBadge.textContent = 'VALID LOGO';
                                activeBadge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase';
                            } else {
                                activeBadge.textContent = 'FALLBACK SVG';
                                activeBadge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 uppercase';
                            }
                        }

                        if (activePreviewBox && data.logo) {
                            activePreviewBox.innerHTML = `<img src="${escapeHtml(data.logo)}" alt="logo" class="w-full h-full object-contain" onerror="this.onerror=null; if (this && this.parentElement) { this.parentElement.innerHTML='<i data-lucide=\\'image-off\\' class=\\'w-5 h-5 text-gray-500\\'></i>'; if(window.lucide) lucide.createIcons(); }">`;
                        }
                    } else if (data.type === 'complete') {
                        if (barFill) barFill.style.width = '100%';
                        if (percentText) percentText.textContent = '100%';
                        if (currentChannelText) currentChannelText.textContent = '✓ All channel logos search complete!';
                        if (statResolved) statResolved.textContent = `${data.fixedCount || resolvedCount}`;
                        if (activeBadge) {
                            activeBadge.textContent = 'COMPLETED';
                            activeBadge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase';
                        }
                        if (btnStop) btnStop.classList.add('hidden');
                        if (btnDone) btnDone.classList.remove('hidden');

                        showToast('Logo Search Complete!', `Resolved ${data.fixedCount || resolvedCount} TV network logos using Logopedia & search engines.`, 'success');
                    } else if (data.type === 'error') {
                        showToast('Error', data.message, 'error');
                    }
                } catch (e) {
                    console.warn('Error parsing SSE line:', e);
                }
            }
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            showToast('Logo Scraper Error', e.message, 'error');
            if (currentChannelText) currentChannelText.textContent = `Error: ${e.message}`;
        }
    } finally {
        cjLogoAbortController = null;
        if (btnDone) btnDone.classList.remove('hidden');
        if (btnStop) btnStop.classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    }
}

// 10. Deduplicate Database
async function triggerDeduplicateJson() {
    if (!confirm('Deduplicate channels.json?\n\nThis will scan all channels and remove any duplicate stream URLs across the entire database.')) {
        return;
    }

    try {
        const res = await secureFetch('/api/admin/channels-json/deduplicate', {
            method: 'POST'
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('Deduplication Complete', `Removed ${data.removed} duplicate streams. Total unique channels: ${data.after}.`, 'success');
            fetchChannelsJsonStats();
            fetchChannelsJsonList(1);
        } else {
            showToast('Deduplicate Error', data.message || 'Failed to deduplicate', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

// 11. Export & Download
function exportChannelsAsM3u() {
    window.open('/api/admin/channels-json/export-m3u?token=' + encodeURIComponent(getAdminToken() || ''), '_blank');
}

function downloadChannelsJsonRaw() {
    window.open('/api/admin/channels-json/download?token=' + encodeURIComponent(getAdminToken() || ''), '_blank');
}


// Sync Channels JSON with All M3U Storage
async function syncAllM3uStorage() {
    try {
        showToast('Syncing...', 'Rebuilding master M3U feeds and updating storage...', 'info');
        const res = await secureFetch('/api/admin/channels-json/sync-all', {
            method: 'POST'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('M3U Storage Synchronized', data.message, 'success');
            await fetchChannelsJsonStats();
            await fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('Sync Failed', data.message || 'Error syncing M3U storage', 'error');
        }
    } catch (err) {
        showToast('Sync Error', err.message, 'error');
    }
}

// Import all M3U Storage files into Channels JSON
async function importAllM3uStorageToStudio() {
    if (!confirm("📥 Scan and Import All M3U Storage into channels.json?\n\nThis will scan doctor_strange/m3u_playlists, Admin M3U files, and sports entries, merge them into channels.json with automatic deduplication, and rebuild the master /sports.m3u feed.")) {
        return;
    }
    try {
        showToast('Scanning Storage...', 'Importing channels from all M3U files...', 'info');
        const res = await secureFetch('/api/admin/channels-json/import-m3u-vault', {
            method: 'POST',
            body: JSON.stringify({ mode: 'append', deduplicate: true })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Storage Imported', data.message, 'success');
            await fetchChannelsJsonStats();
            await fetchChannelsJsonList(1);
        } else {
            showToast('Import Error', data.message, 'error');
        }
    } catch (err) {
        showToast('Import Error', err.message, 'error');
    }
}

async function syncChannelsJsonCache() {
    try {
        const res = await secureFetch('/api/admin/channels-json/sync-cache', {
            method: 'POST'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Cache Synced', 'Live sports & channels catalog cache rebuilt!', 'success');
        } else {
            showToast('Sync Warning', data.message, 'warning');
        }
    } catch (e) {
        showToast('Sync Error', e.message, 'error');
    }
}

// 12. Genre Purge Modal
function promptDeleteByGenre() {
    toggleCjPurgeModal(true);
}

function toggleCjPurgeModal(show) {
    const modal = document.getElementById('cjPurgeModal');
    if (!modal) return;
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

async function executeGenrePurge() {
    const genre = document.getElementById('cjPurgeGenreSelect')?.value;
    if (!genre) {
        showToast('Select Genre', 'Please select a category to purge.', 'warning');
        return;
    }

    const confirmed = await showAppConfirmModal({
        title: 'Purge Category',
        message: `Are you sure you want to permanently delete ALL channels in category "${genre}"? This will save a safety backup.`,
        confirmText: 'Purge Category',
        isDanger: true
    });

    if (!confirmed) return;

    try {
        const res = await secureFetch('/api/admin/channels-json/batch-delete', {
            method: 'POST',
            body: JSON.stringify({ genre })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('Genre Purged', `Deleted ${data.deletedCount} channels from genre "${genre}".`, 'success');
            toggleCjPurgeModal(false);
            fetchChannelsJsonStats();
            fetchChannelsJsonList(1);
        } else {
            showToast('Purge Error', data.message || 'Failed to purge genre', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

// 13. Stream Preview Modal
function openCjStreamModal(url, name, genre) {
    const modal = document.getElementById('cjStreamModal');
    const video = document.getElementById('cjVideoPlayer');
    const status = document.getElementById('cjVideoStatus');
    const title = document.getElementById('cjPlayerTitle');
    const gen = document.getElementById('cjPlayerGenre');
    const urlSpan = document.getElementById('cjPlayerUrl');

    if (!modal || !video) return;

    cjActiveStreamUrl = url;
    if (title) title.textContent = name || 'Stream Preview';
    if (gen) gen.textContent = genre || 'Live Stream';
    if (urlSpan) urlSpan.textContent = url;

    modal.classList.remove('hidden');

    if (status) {
        status.classList.remove('hidden');
        status.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-400"></i><span>Connecting to stream...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    // Clean up previous HLS instance
    if (cjHlsInstance) {
        try { cjHlsInstance.destroy(); } catch(e){}
        cjHlsInstance = null;
    }

    // Always route external / remote streams through the backend proxy so CORS and headers are handled!
    let streamSrc = url;
    if ((streamSrc.startsWith('http://') || streamSrc.startsWith('https://')) && !streamSrc.includes('live.php') && !streamSrc.includes('xtream.php')) {
        streamSrc = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(streamSrc)}&m3u=1&type=hls`;
    } else if (!streamSrc.startsWith('http') && !streamSrc.startsWith('/')) {
        streamSrc = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(streamSrc)}&m3u=1&type=hls`;
    }

    if (window.Hls && Hls.isSupported()) {
        cjHlsInstance = new Hls({
            maxBufferLength: 20,
            maxMaxBufferLength: 60,
            enableWorker: true,
            lowLatencyMode: false,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 4
        });
        cjHlsInstance.loadSource(streamSrc);
        cjHlsInstance.attachMedia(video);
        cjHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(err => console.warn("Autoplay blocked:", err));
            if (status) status.classList.add('hidden');
        });
        cjHlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.warn("HLS error:", data);
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    cjHlsInstance.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    cjHlsInstance.recoverMediaError();
                } else {
                    // Try direct stream fallback
                    video.src = url;
                    video.play().then(() => {
                        if (status) status.classList.add('hidden');
                    }).catch(() => {
                        if (status) {
                            status.classList.remove('hidden');
                            status.innerHTML = `<span class="text-rose-400 font-bold">Stream error: ${data.details || 'Playback failed'}</span>`;
                        }
                    });
                }
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamSrc;
        video.play().catch(() => {});
        video.onloadeddata = () => {
            if (status) status.classList.add('hidden');
        };
        video.onerror = () => {
            video.src = url;
            video.play().catch(() => {
                if (status) {
                    status.classList.remove('hidden');
                    status.innerHTML = `<span class="text-rose-400 font-bold">Unable to play stream format</span>`;
                }
            });
        };
    } else {
        video.src = streamSrc;
        video.play().catch(() => {});
        video.onloadeddata = () => {
            if (status) status.classList.add('hidden');
        };
        video.onerror = () => {
            if (status) {
                status.classList.remove('hidden');
                status.innerHTML = `<span class="text-rose-400 font-bold">Unable to play stream format</span>`;
            }
        };
    }
}

function closeCjStreamModal() {
    const modal = document.getElementById('cjStreamModal');
    const video = document.getElementById('cjVideoPlayer');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
    if (cjHlsInstance) {
        cjHlsInstance.destroy();
        cjHlsInstance = null;
    }
    if (modal) modal.classList.add('hidden');
}

function copyCjPlayerUrl() {
    if (cjActiveStreamUrl) {
        navigator.clipboard.writeText(cjActiveStreamUrl);
        showToast('Copied', 'Stream URL copied to clipboard.', 'info');
    }
}

function copyCjChannelUrl(url) {
    if (url) {
        navigator.clipboard.writeText(url);
        showToast('Copied', 'Stream URL copied to clipboard.', 'info');
    }
}

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// 9c. Deduplicate Channels
async function confirmDeduplicateChannels() {
    if (!confirm('Are you sure you want to scan for and remove all duplicate channels based on their URLs?')) {
        return;
    }
    
    try {
        showToast('Deduplicating', 'Scanning for duplicates...', 'info');
        const res = await secureFetch('/api/admin/channels-json/deduplicate', {
            method: 'POST'
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast('Deduplication Complete', data.message, 'success');
            fetchChannelsJsonStats();
            fetchChannelsJsonList(cjCurrentPage);
        } else {
            showToast('Error', data.message || 'Failed to deduplicate channels', 'error');
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

// Global window bindings for Channels JSON Studio
window.confirmClearAllChannelsJson = confirmClearAllChannelsJson;
window.confirmDeduplicateChannels = confirmDeduplicateChannels;
window.fixAllChannelsJsonLogosUi = fixAllChannelsJsonLogosUi;
window.abortCjLogoFix = abortCjLogoFix;
window.finishCjLogoFixModal = finishCjLogoFixModal;
window.searchCjModalLogoWeb = searchCjModalLogoWeb;
window.searchCjChannelLogoWeb = searchCjChannelLogoWeb;
window.updateCjFormLogoPreview = updateCjFormLogoPreview;
window.deleteCjChannel = deleteCjChannel;
window.openCjStreamModal = openCjStreamModal;
window.closeCjStreamModal = closeCjStreamModal;
window.copyCjPlayerUrl = copyCjPlayerUrl;
window.copyCjChannelUrl = copyCjChannelUrl;



document.addEventListener('DOMContentLoaded', () => {
    const schedToggle = document.getElementById('scheduleEnabledToggle');
    const schedWrapper = document.getElementById('scheduleConfigWrapper');
    if (schedToggle && schedWrapper) {
        const updateWrapper = () => {
            if (schedToggle.checked) {
                schedWrapper.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                schedWrapper.classList.add('opacity-50', 'pointer-events-none');
            }
        };
        schedToggle.addEventListener('change', updateWrapper);
        setTimeout(updateWrapper, 1000); // trigger on load
    }
});

window.saveScheduleOnly = async function() {
    const mode = document.getElementById('maintenanceMusicMode')?.value || 'query';
    const query = document.getElementById('maintenanceMusicQuery')?.value?.trim() || 'lofi relax';
    const payload = {
        maintenanceMode: maintenanceToggle ? maintenanceToggle.checked : false,
        maintenanceAdminBypass: document.getElementById("maintenanceAdminBypassToggle") ? document.getElementById("maintenanceAdminBypassToggle").checked : false,
        consumetMaintenance: document.getElementById('consumetMaintenanceToggle') ? document.getElementById('consumetMaintenanceToggle').checked : false,
        playMaintenance: document.getElementById('playMaintenanceToggle') ? document.getElementById('playMaintenanceToggle').checked : false,
        playConsumetMaintenance: document.getElementById('playConsumetMaintenanceToggle') ? document.getElementById('playConsumetMaintenanceToggle').checked : false,
        activeTemplate: maintenanceTemplate ? maintenanceTemplate.value : 'Scheduled Downtime',
        maintenanceTitle: document.getElementById('maintenanceTitle') ? document.getElementById('maintenanceTitle').value.trim() : '',
        maintenanceText: document.getElementById('maintenanceText') ? document.getElementById('maintenanceText').value.trim() : '',
        maintenanceMusicMode: mode,
        maintenanceMusicQuery: query,
        maintenanceMusicPlaylist: window.adminSavedPlaylist || [],
        maintenanceVideoEnabled: document.getElementById('maintenanceVideoEnabledToggle') ? document.getElementById('maintenanceVideoEnabledToggle').checked : false,
        maintenanceVideoType: document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto',
        maintenanceVideoUrl: (function() {
            const t = document.getElementById('maintenanceVideoType') ? document.getElementById('maintenanceVideoType').value : 'auto';
            const u = document.getElementById('maintenanceVideoUrl') ? document.getElementById('maintenanceVideoUrl').value.trim() : '';
            return (t === 'webrtc' && !u) ? 'live_webrtc_stream' : u;
        })(),
        maintenanceVideoTitle: document.getElementById('maintenanceVideoTitle') ? document.getElementById('maintenanceVideoTitle').value.trim() : '',
        maintenanceVideoSubtitle: document.getElementById('maintenanceVideoSubtitle') ? document.getElementById('maintenanceVideoSubtitle').value.trim() : '',
        maintenanceVideoAutoplay: document.getElementById('maintenanceVideoAutoplay') ? document.getElementById('maintenanceVideoAutoplay').checked : true,
        maintenanceVideoMuted: document.getElementById('maintenanceVideoMuted') ? document.getElementById('maintenanceVideoMuted').checked : false,
        maintenanceVideoLoop: document.getElementById('maintenanceVideoLoop') ? document.getElementById('maintenanceVideoLoop').checked : true,
        scheduleEnabled: document.getElementById('scheduleEnabledToggle') ? document.getElementById('scheduleEnabledToggle').checked : false,
        scheduledTime: (document.getElementById('scheduleDateTimeInput') && document.getElementById('scheduleDateTimeInput').value) ? new Date(document.getElementById('scheduleDateTimeInput').value).toISOString() : '',
        scheduleNoticeText: document.getElementById('scheduleNoticeInput') ? document.getElementById('scheduleNoticeInput').value.trim() : '',
        scheduleAutoActivate: document.getElementById('scheduleAutoActivateToggle') ? document.getElementById('scheduleAutoActivateToggle').checked : true
    };

    try {
        const res = await secureFetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Success', payload.scheduleEnabled ? 'Maintenance schedule published & active!' : 'Maintenance schedule configuration saved (Inactive).', 'success');
        } else {
            showToast('Error', data.message || 'Failed to save', 'error');
        }
    } catch (e) {
        showToast('Error', 'Failed to save schedule settings', 'error');
    }
};


// --- BACKGROUND CONFIGURATION (Injected) ---
async function loadGlobalBackgroundConfig() {
    try {
        const res = await fetch('/api/admin/backgrounds', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.status === 'success' && data.backgrounds) {
            if (data.backgrounds.index && document.getElementById('bgIndexType')) {
                document.getElementById('bgIndexType').value = typeof data.backgrounds.index === 'object' ? (data.backgrounds.index.type || 'auto') : 'auto';
                document.getElementById('bgIndex').value = typeof data.backgrounds.index === 'object' ? (data.backgrounds.index.url || '') : data.backgrounds.index;
            }
            if (data.backgrounds.consumet && document.getElementById('bgConsumetType')) {
                document.getElementById('bgConsumetType').value = typeof data.backgrounds.consumet === 'object' ? (data.backgrounds.consumet.type || 'auto') : 'auto';
                document.getElementById('bgConsumet').value = typeof data.backgrounds.consumet === 'object' ? (data.backgrounds.consumet.url || '') : data.backgrounds.consumet;
            }
            if (data.backgrounds.music && document.getElementById('bgMusicType')) {
                document.getElementById('bgMusicType').value = typeof data.backgrounds.music === 'object' ? (data.backgrounds.music.type || 'auto') : 'auto';
                document.getElementById('bgMusic').value = typeof data.backgrounds.music === 'object' ? (data.backgrounds.music.url || '') : data.backgrounds.music;
            }
            if (data.backgrounds.hero && document.getElementById('bgHeroType')) {
                document.getElementById('bgHeroType').value = typeof data.backgrounds.hero === 'object' ? (data.backgrounds.hero.type || 'auto') : 'auto';
                document.getElementById('bgHero').value = typeof data.backgrounds.hero === 'object' ? (data.backgrounds.hero.url || '') : data.backgrounds.hero;
            }
            
            if (data.backgrounds.globalAudio && data.backgrounds.globalAudio.url) {
                if(document.getElementById('bgAudioUrl')) {
                    document.getElementById('bgAudioUrl').value = data.backgrounds.globalAudio.url;
                    document.getElementById('bgAudioType').value = data.backgrounds.globalAudio.type || 'audio';
                    document.getElementById('bgAudioSelectedTitle').innerText = data.backgrounds.globalAudio.title || 'Selected Audio';
                    document.getElementById('bgAudioSelectedArtist').innerText = data.backgrounds.globalAudio.artist || '';
                    if(data.backgrounds.globalAudio.thumbnail) document.getElementById('bgAudioSelectedImg').src = data.backgrounds.globalAudio.thumbnail;
                    if(document.getElementById('bgAudioTarget') && data.backgrounds.globalAudio.target) {
                        document.getElementById('bgAudioTarget').value = data.backgrounds.globalAudio.target;
                    }
                    const preview = document.getElementById('bgAudioPreview');
                    preview.src = data.backgrounds.globalAudio.url;
                    preview.classList.remove('hidden');
                }
            }
            if (document.getElementById('bgMusicUseSongVideo')) {

                document.getElementById('bgMusicUseSongVideo').checked = data.backgrounds.musicUseSongVideo !== false;
            }
        }
    } catch (err) {
        console.error("Failed to load backgrounds", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(typeof token !== 'undefined' && token) loadGlobalBackgroundConfig();
    }, 1000);
});

document.getElementById('backgroundConfigForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        index: { type: document.getElementById('bgIndexType').value, url: document.getElementById('bgIndex').value },
        consumet: { type: document.getElementById('bgConsumetType').value, url: document.getElementById('bgConsumet').value },
        music: { type: document.getElementById('bgMusicType').value, url: document.getElementById('bgMusic').value },
        hero: { type: document.getElementById('bgHeroType').value, url: document.getElementById('bgHero').value },
        musicUseSongVideo: document.getElementById('bgMusicUseSongVideo').checked
    };
    
    try {
        const res = await fetch('/api/admin/backgrounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message || 'Backgrounds updated successfully', 'success');
        } else {
            showToast(data.message || 'Failed to save backgrounds', 'error');
        }
    } catch (err) {
        showToast('Failed to save backgrounds', 'error');
    }
});


window.clearBgAudio = function() {
    document.getElementById('bgAudioUrl').value = '';
    document.getElementById('bgAudioType').value = 'auto';
    document.getElementById('bgAudioSelectedTitle').innerText = 'No Audio Selected';
    document.getElementById('bgAudioSelectedArtist').innerText = 'Search above to set';
    document.getElementById('bgAudioSelectedImg').src = '/assets/vinyl_placeholder.png';
    document.getElementById('bgAudioPreview').src = '';
    document.getElementById('bgAudioPreview').classList.add('hidden');
};

window.saveBgAudio = async function() {
    const payload = {
        globalAudio: {
            type: document.getElementById('bgAudioType').value || 'auto',
            url: document.getElementById('bgAudioUrl').value || '',
            title: document.getElementById('bgAudioSelectedTitle').innerText,
            artist: document.getElementById('bgAudioSelectedArtist').innerText,
            thumbnail: document.getElementById('bgAudioSelectedImg').src,
            target: document.getElementById('bgAudioTarget') ? document.getElementById('bgAudioTarget').value : 'global'
        }
    };
    try {
        const res = await fetch('/api/admin/backgrounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message || 'Global audio updated successfully', 'success');
        } else {
            showToast(data.message || 'Failed to save global audio', 'error');
        }
    } catch (err) {
        showToast('Failed to save global audio', 'error');
    }
};

window.handleAdminAudioUpload = async function(event, target = 'maintenance') {
    const file = event.target.files[0];
    if (!file) return;
    
    const resultsDiv = document.getElementById(target === 'power' ? 'powerMusicResults' : 'adminMusicResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="text-center py-2 text-slate-400 animate-pulse text-xs font-semibold">Uploading audio file...</div>';
        resultsDiv.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('audioFile', file);

    try {
        const token = localStorage.getItem('adminToken') || '';
        const response = await fetch('/api/admin/maintenance/upload-audio', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            adminTracksQueue = [{
                id: 'upload_' + Math.random().toString(36).substr(2, 9),
                title: result.fileName || 'Uploaded Audio',
                artist: 'Local Upload',
                img: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100',
                url: result.fileUrl
            }];
            window.selectAdminTrack(0, target);
            if (resultsDiv) {
                resultsDiv.innerHTML = '<div class="text-center py-2 text-emerald-400 text-xs font-semibold">Upload complete! Track loaded.</div>';
            }
            const queryInput = document.getElementById(target === 'power' ? 'powerMusicQuery' : 'maintenanceMusicQuery');
            if (queryInput) queryInput.value = result.fileUrl;
        } else {
            showToast('Error', result.message || 'Upload failed', 'error');
            if (resultsDiv) resultsDiv.innerHTML = '';
        }
    } catch (err) {
        console.error("Upload error:", err);
        showToast('Error', 'Failed to upload audio', 'error');
        if (resultsDiv) resultsDiv.innerHTML = '';
    }
    
    // Clear input
    event.target.value = '';
};


async function loadAnalytics() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Analytics from Firestore...</div>';
    
    try {
        const res = await fetch('/api/admin/analytics', { headers: { 'Authorization': 'Bearer ' + window.adminToken }});
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            let html = '';
            for (const [date, logs] of Object.entries(data.data)) {
                if (!logs || !logs.length) continue;
                html += `
                    <div class="bg-black/40 rounded-xl border border-gray-800 p-4">
                        <h3 class="text-sm font-bold text-indigo-400 mb-3">${date} <span class="text-xs text-gray-500 font-normal ml-2">(${logs.length} hits)</span></h3>
                        <div class="space-y-1">
                            ${logs.reverse().slice(0, 50).map(l => `
                                <div class="flex items-center gap-3 text-[11px] py-1 border-b border-gray-800/50 last:border-0">
                                    <span class="text-gray-500 w-16">${new Date(l.time).toLocaleTimeString()}</span>
                                    <span class="text-cyan-400 font-mono w-28 truncate">${l.ip}</span>
                                    <span class="text-white truncate flex-1">${l.path}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html || '<div class="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest">No traffic logged yet.</div>';
        } else {
            container.innerHTML = '<div class="text-center py-10 text-red-400 text-xs font-bold uppercase tracking-widest">Failed to load analytics</div>';
        }
    } catch(e) {
        container.innerHTML = '<div class="text-center py-10 text-red-400 text-xs font-bold uppercase tracking-widest">Error fetching analytics</div>';
    }
}

// Hook it into switchTab
const prevSwitchTab = typeof switchTab === 'function' ? switchTab : window.switchTab;
window.switchTab = function(tabId) {
    if (typeof prevSwitchTab === 'function') {
        prevSwitchTab(tabId);
    }
    if (tabId === 'analytics' && typeof loadAnalytics === 'function') {
        loadAnalytics();
    }
};

/* ==========================================================================
   UNIVERSAL EMBED SCRAPER & CHANNEL STUDIO FRONTEND LOGIC
   ========================================================================== */
let activeExtractedData = null;
let scrapedHlsInstance = null;
let currentScrapedChannelsList = [];

function quickFillEmbedUrl(type) {
    const input = document.getElementById('embedScraperUrlInput');
    const refInput = document.getElementById('embedHeaderReferer');
    const originInput = document.getElementById('embedHeaderOrigin');
    if (!input) return;

    if (type === 'timstreams') {
        input.value = 'https://timst.cfd/channel/willow-cricket-1';
        if (refInput) refInput.value = 'https://timst.cfd/';
        if (originInput) originInput.value = 'https://timst.cfd';
    } else if (type === 'epiembeds') {
        input.value = 'https://epiembeds.online/embed/star-sports-1-hd';
        if (refInput) refInput.value = 'https://epiembeds.online/';
        if (originInput) originInput.value = 'https://epiembeds.online';
    } else if (type === 'daddylive') {
        input.value = 'https://daddylive.sx/embed/stream-123.php';
        if (refInput) refInput.value = 'https://hamis.romponalis.st/';
        if (originInput) originInput.value = 'https://hamis.romponalis.st/';
    } else if (type === 'vidhide') {
        input.value = 'https://vidhide.com/v/sample123';
        if (refInput) refInput.value = 'https://morencius.com/';
        if (originInput) originInput.value = 'https://morencius.com';
    }
}
window.quickFillEmbedUrl = quickFillEmbedUrl;

async function populateScrapedContainerOptions() {
    const select = document.getElementById('scrapedChContainer');
    if (!select) return;

    try {
        const res = await fetch('/api/admin/sports/containers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const containers = data.containers || [];
        
        let html = '<option value="default_showcase">Default Showcase Grid</option>';
        containers.forEach(c => {
            if (c.id !== 'default_showcase') {
                html += `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title || c.id)}</option>`;
            }
        });
        select.innerHTML = html;
    } catch(e) {
        select.innerHTML = '<option value="default_showcase">Default Showcase Grid</option>';
    }
}
window.populateScrapedContainerOptions = populateScrapedContainerOptions;

async function analyzeEmbedUrl() {
    const urlInput = document.getElementById('embedScraperUrlInput');
    const targetUrl = (urlInput ? urlInput.value : '').trim();
    if (!targetUrl) {
        alert('Please enter an embed or stream URL to scrape.');
        return;
    }

    const refVal = (document.getElementById('embedHeaderReferer')?.value || '').trim();
    const originVal = (document.getElementById('embedHeaderOrigin')?.value || '').trim();
    const uaVal = (document.getElementById('embedHeaderUserAgent')?.value || '').trim();

    const headers = {};
    if (refVal) headers['Referer'] = refVal;
    if (originVal) headers['Origin'] = originVal;
    if (uaVal) headers['User-Agent'] = uaVal;

    const loadingEl = document.getElementById('embedScraperLoading');
    const resultsEl = document.getElementById('embedScraperResults');
    const btn = document.getElementById('btnScrapeEmbedAnalyze');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (resultsEl) resultsEl.classList.add('hidden');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/admin/embed-scraper/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: targetUrl, headers })
        });

        const json = await res.json();
        if (loadingEl) loadingEl.classList.add('hidden');
        if (btn) btn.disabled = false;

        if (json.status === 'error' || !json.data) {
            alert(json.message || 'Failed to extract stream from embed.');
            return;
        }

        const data = json.data;
        activeExtractedData = data;

        if (resultsEl) resultsEl.classList.remove('hidden');

        const directM3u8 = data.resolvedM3u8 || data.m3u8Url || '';
        const playUrl = data.proxyUrl || data.playbackUrl || directM3u8 || targetUrl;
        const channelName = data.inferredChannelName || data.suggestedName || 'Live Sports Stream';
        const channelCat = data.inferredCategory || data.suggestedCategory || 'Live Sports';
        const channelLogo = data.inferredLogo || data.suggestedLogo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg';
        const attachedReferer = data.referer || data.detectedReferer || '';

        // Populate badges
        const statusBadge = document.getElementById('scraperStatusBadge');
        if (statusBadge) {
            if (data.success && (directM3u8 || playUrl)) {
                statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5';
                statusBadge.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>M3U8 RESOLVED</span>';
            } else {
                statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5';
                statusBadge.innerHTML = '<i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i><span>PARTIAL MATCH</span>';
            }
        }

        const cdnBadge = document.getElementById('scraperCdnBadge');
        if (cdnBadge) {
            cdnBadge.textContent = `PROVIDER: ${(data.detectedCdn || 'DYNAMIC STREAM').toUpperCase()}`;
        }

        const tokenBadge = document.getElementById('scraperTokenBadge');
        if (tokenBadge) {
            if (data.isTokenBased || data.requiresProxy) {
                tokenBadge.className = 'px-3 py-1 rounded-full text-xs font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/40';
                tokenBadge.textContent = 'Token-Protected (Proxy Active)';
            } else {
                tokenBadge.className = 'px-3 py-1 rounded-full text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40';
                tokenBadge.textContent = 'Direct Master Stream';
            }
        }

        // Display stream info
        const displayEl = document.getElementById('extractedM3u8Display');
        if (displayEl) displayEl.textContent = directM3u8 || playUrl;

        const refDisplay = document.getElementById('extractedRefererDisplay');
        if (refDisplay) refDisplay.textContent = attachedReferer || 'Auto-Managed by Stalker Proxy';

        const qualDisplay = document.getElementById('extractedQualitiesDisplay');
        if (qualDisplay) {
            if (data.qualities && Array.isArray(data.qualities) && data.qualities.length > 0) {
                qualDisplay.textContent = data.qualities.map(q => q.resolution || (q.bandwidth ? `${Math.round(q.bandwidth/1000)}k` : 'Master')).join(', ');
            } else {
                qualDisplay.textContent = '1080p Master HLS (Adaptive)';
            }
        }

        // Auto-fill form fields
        const nameInput = document.getElementById('scrapedChName');
        if (nameInput) nameInput.value = channelName;

        const catSelect = document.getElementById('scrapedChCategory');
        if (catSelect && channelCat) {
            const target = channelCat.toLowerCase();
            for (let i = 0; i < catSelect.options.length; i++) {
                if (catSelect.options[i].value.toLowerCase().includes(target)) {
                    catSelect.selectedIndex = i;
                    break;
                }
            }
        }

        const logoInput = document.getElementById('scrapedChLogo');
        if (logoInput) logoInput.value = channelLogo;

        const proxyToggle = document.getElementById('scrapedChProxyToggle');
        if (proxyToggle) proxyToggle.checked = true;

        await populateScrapedContainerOptions();

        // Setup Iframe element source
        const iframeEl = document.getElementById('scrapedPreviewIframe');
        if (iframeEl) {
            iframeEl.src = targetUrl;
        }

        // Initialize Live HLS Preview Player with proxied playback URL
        switchScraperPlayerMode('hls');
        initScrapedHlsPlayer(playUrl);

        if (window.lucide) lucide.createIcons();
    } catch(err) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (btn) btn.disabled = false;
        alert('Network error while analyzing embed: ' + err.message);
    }
}
window.analyzeEmbedUrl = analyzeEmbedUrl;

let currentScraperPlayerMode = 'hls';

function switchScraperPlayerMode(mode) {
    currentScraperPlayerMode = mode;
    const video = document.getElementById('scrapedPreviewVideo');
    const iframe = document.getElementById('scrapedPreviewIframe');
    const btnHls = document.getElementById('btnModeHls');
    const btnIframe = document.getElementById('btnModeIframe');
    const errorOverlay = document.getElementById('scrapedPreviewErrorOverlay');

    if (mode === 'hls') {
        if (video) video.classList.remove('hidden');
        if (iframe) iframe.classList.add('hidden');
        if (btnHls) {
            btnHls.className = 'px-3 py-1.5 rounded-lg font-bold transition-all bg-cyan-600 text-white text-[11px] flex items-center gap-1.5 shadow-sm';
        }
        if (btnIframe) {
            btnIframe.className = 'px-3 py-1.5 rounded-lg font-bold transition-all text-gray-400 hover:text-white text-[11px] flex items-center gap-1.5';
        }
    } else {
        if (video) video.classList.add('hidden');
        if (iframe) {
            iframe.classList.remove('hidden');
            const targetUrl = (document.getElementById('embedScraperUrlInput')?.value || '').trim();
            if (targetUrl && (!iframe.src || iframe.src === 'about:blank')) {
                iframe.src = targetUrl;
            }
        }
        if (errorOverlay) errorOverlay.classList.add('hidden');
        if (btnHls) {
            btnHls.className = 'px-3 py-1.5 rounded-lg font-bold transition-all text-gray-400 hover:text-white text-[11px] flex items-center gap-1.5';
        }
        if (btnIframe) {
            btnIframe.className = 'px-3 py-1.5 rounded-lg font-bold transition-all bg-blue-600 text-white text-[11px] flex items-center gap-1.5 shadow-sm';
        }
    }
    if (window.lucide) lucide.createIcons();
}
window.switchScraperPlayerMode = switchScraperPlayerMode;

function initScrapedHlsPlayer(streamUrl) {
    const video = document.getElementById('scrapedPreviewVideo');
    const statusEl = document.getElementById('playerStreamStatus');
    const errorOverlay = document.getElementById('scrapedPreviewErrorOverlay');
    const ph = document.getElementById('scrapedPreviewPlaceholder');
    
    if (errorOverlay) errorOverlay.classList.add('hidden');
    if (ph) ph.classList.add('hidden');
    if (!video || !streamUrl) return;

    video.muted = true;
    video.volume = 0;
    video.playsInline = true;

    if (scrapedHlsInstance) {
        scrapedHlsInstance.destroy();
        scrapedHlsInstance = null;
    }

    if (statusEl) {
        statusEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded text-cyan-400 bg-cyan-500/10 border border-cyan-500/20';
        statusEl.textContent = 'CONNECTING...';
    }

    if (Hls.isSupported()) {
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 60,
            maxBufferLength: 30,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (statusEl) {
                statusEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                statusEl.textContent = 'STREAM LIVE';
            }
            video.play().catch(e => {
                console.warn('Autoplay prevented:', e);
            });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.warn('Scraper HLS Event:', data);
            if (data.fatal) {
                if (statusEl) {
                    statusEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded text-rose-400 bg-rose-500/10 border border-rose-500/20';
                    statusEl.textContent = 'OFFLINE / 404';
                }
                if (errorOverlay) {
                    errorOverlay.classList.remove('hidden');
                    const errTitle = document.getElementById('scrapedErrorTitle');
                    const errMsg = document.getElementById('scrapedErrorMsg');
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        if (errTitle) errTitle.textContent = 'Stream Offline (Provider 404 / 403)';
                        if (errMsg) errMsg.textContent = 'The upstream stream server is not broadcasting at this moment or token expired. Switch to Iframe mode or retry.';
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    }
                    if (window.lucide) lucide.createIcons();
                }
            }
        });
        scrapedHlsInstance = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(() => {});
    }
}
window.initScrapedHlsPlayer = initScrapedHlsPlayer;

function retryScrapedHlsPlay() {
    const errorOverlay = document.getElementById('scrapedPreviewErrorOverlay');
    if (errorOverlay) errorOverlay.classList.add('hidden');
    if (activeExtractedData) {
        const directM3u8 = activeExtractedData.resolvedM3u8 || activeExtractedData.m3u8Url || '';
        const playUrl = activeExtractedData.proxyUrl || activeExtractedData.playbackUrl || directM3u8;
        initScrapedHlsPlayer(playUrl);
    }
}
window.retryScrapedHlsPlay = retryScrapedHlsPlay;

function playScrapedPreviewNow() {
    const ph = document.getElementById('scrapedPreviewPlaceholder');
    if (ph) ph.classList.add('hidden');
    if (activeExtractedData) {
        const directM3u8 = activeExtractedData.resolvedM3u8 || activeExtractedData.m3u8Url || '';
        const playUrl = activeExtractedData.proxyUrl || activeExtractedData.playbackUrl || directM3u8;
        initScrapedHlsPlayer(playUrl);
    }
}
window.playScrapedPreviewNow = playScrapedPreviewNow;

function copyExtractedM3u8Url() {
    const directM3u8 = activeExtractedData?.resolvedM3u8 || activeExtractedData?.m3u8Url || '';
    const playUrl = activeExtractedData?.proxyUrl || activeExtractedData?.playbackUrl || directM3u8;
    const url = directM3u8 || playUrl || '';
    if (url) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Stream playback URL copied to clipboard!');
        }).catch(() => {
            prompt('Stream URL:', url);
        });
    }
}
window.copyExtractedM3u8Url = copyExtractedM3u8Url;

async function testCurrentExtractedStream() {
    const stream = activeExtractedData?.playbackUrl || activeExtractedData?.m3u8Url;
    if (!stream) {
        alert('No extracted stream to test.');
        return;
    }

    try {
        const res = await fetch('/api/admin/embed-scraper/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: stream })
        });
        const data = await res.json();
        if (data.result && data.result.active) {
            alert(`Stream is ONLINE and verified!\nStatus: ${data.result.status} | Content-Type: ${data.result.contentType || 'HLS'} | Speed: ${data.result.latencyMs}ms`);
        } else {
            alert(`Stream probe returned: ${data.result ? data.result.error || data.result.status : 'Offline'}`);
        }
    } catch(e) {
        alert('Test probe failed: ' + e.message);
    }
}
window.testCurrentExtractedStream = testCurrentExtractedStream;

async function autoFindLogoForScraped() {
    const name = (document.getElementById('scrapedChName')?.value || '').trim();
    if (!name) {
        alert('Enter a channel name first.');
        return;
    }

    try {
        const res = await fetch(`/api/admin/channels-json/lookup-logo?name=${encodeURIComponent(name)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.logoUrl) {
            const logoInput = document.getElementById('scrapedChLogo');
            if (logoInput) logoInput.value = data.logoUrl;
            alert(`Logo discovered: ${data.source || 'Online Catalog'}`);
        } else {
            alert('No specific logo found in catalog for this name.');
        }
    } catch(e) {
        alert('Logo search failed.');
    }
}
window.autoFindLogoForScraped = autoFindLogoForScraped;

async function saveScrapedChannelAsSportsChannel(event) {
    if (event) event.preventDefault();

    const name = (document.getElementById('scrapedChName')?.value || '').trim();
    if (!name) {
        alert('Please provide a channel name.');
        return;
    }

    const cdnApprovalChecked = document.getElementById('scrapedChCdnApproval')?.checked;
    if (!cdnApprovalChecked) {
        alert('Please check Admin Approval to verify CDN before publishing.');
        return;
    }

    const category = document.getElementById('scrapedChCategory')?.value || 'Live Sports';
    const containerId = document.getElementById('scrapedChContainer')?.value || 'default_showcase';
    const logo = document.getElementById('scrapedChLogo')?.value || '';
    const bgUrl = document.getElementById('scrapedChBgUrl')?.value || '';
    const proxyMode = document.getElementById('scrapedChProxyToggle')?.checked ? 'stalker_proxy' : 'direct';

    const embedUrl = (document.getElementById('embedScraperUrlInput')?.value || '').trim();
    const streamUrl = activeExtractedData?.resolvedM3u8 || activeExtractedData?.m3u8Url || activeExtractedData?.proxyUrl || activeExtractedData?.playbackUrl || embedUrl;
    const playUrl = activeExtractedData?.proxyUrl || activeExtractedData?.playbackUrl || streamUrl;
    const referer = activeExtractedData?.referer || activeExtractedData?.detectedReferer || document.getElementById('embedHeaderReferer')?.value || '';
    const origin = activeExtractedData?.origin || activeExtractedData?.detectedOrigin || document.getElementById('embedHeaderOrigin')?.value || '';
    const isTokenBased = activeExtractedData?.isTokenBased || false;

    const btn = document.getElementById('btnPublishScrapedChannel');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/admin/embed-scraper/save-channel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                embedUrl,
                streamUrl,
                proxyMode,
                referer,
                origin,
                category,
                logo,
                bgUrl,
                containerId,
                isTokenBased
            })
        });

        const json = await res.json();
        if (btn) btn.disabled = false;

        if (json.status === 'success') {
            alert(`SUCCESS: Channel "${name}" published to Sports Consumet!`);
            fetchScrapedChannels();
        } else {
            alert(json.message || 'Failed to save channel.');
        }
    } catch(err) {
        if (btn) btn.disabled = false;
        alert('Error saving channel: ' + err.message);
    }
}
window.saveScrapedChannelAsSportsChannel = saveScrapedChannelAsSportsChannel;

async function fetchScrapedChannels() {
    const tbody = document.getElementById('scrapedChannelsTableBody');
    const badge = document.getElementById('scrapedChannelsCountBadge');
    if (!tbody) return;

    try {
        const res = await fetch('/api/admin/embed-scraper/channels', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const channels = data.channels || [];
        currentScrapedChannelsList = channels;

        if (badge) badge.textContent = `${channels.length} Hosted Channels`;

        if (channels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-gray-500 italic">No custom scraped channels registered yet. Paste an embed link above to extract and broadcast.</td></tr>';
            return;
        }

        let html = '';
        channels.forEach((ch, idx) => {
            const logoSrc = ch.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg';
            const isProxy = ch.proxyMode === 'stalker_proxy' || ch.isTokenBased;
            html += `
                <tr class="hover:bg-gray-900/40 transition-colors">
                    <td class="py-3 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                    <td class="py-3 px-4">
                        <img src="${escapeHtml(logoSrc)}" alt="Logo" class="w-8 h-8 rounded-lg object-contain bg-black/50 p-1 border border-gray-800" onerror="this.src='https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg'">
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-white">${escapeHtml(ch.name)}</div>
                        <div class="text-[10px] text-gray-500 font-mono truncate max-w-xs">${escapeHtml(ch.playUrl || ch.streamUrl)}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            ${escapeHtml(ch.category || 'Live Sports')}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full ${isProxy ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}"></span>
                            <span class="text-[11px] font-mono text-gray-300">${isProxy ? 'Stalker Proxy' : 'Direct M3U8'}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-gray-400 text-[11px]">
                        ${escapeHtml(ch.containerId || 'default_showcase')}
                    </td>
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="previewScrapedHlsStream('${escapeJsString(ch.playUrl || ch.streamUrl)}')" class="p-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded-lg transition-colors" title="Play Preview">
                                <i data-lucide="play" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="copyExtractedDirectUrl('${escapeJsString(ch.playUrl || ch.streamUrl)}')" class="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors" title="Copy URL">
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteScrapedChannel('${escapeJsString(ch.id)}', '${escapeJsString(ch.name)}')" class="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 rounded-lg transition-colors" title="Delete Channel">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-400">Failed to load channels: ${err.message}</td></tr>`;
    }
}
window.fetchScrapedChannels = fetchScrapedChannels;

function previewScrapedHlsStream(streamUrl) {
    initScrapedHlsPlayer(streamUrl);
    const resultsEl = document.getElementById('embedScraperResults');
    if (resultsEl) {
        resultsEl.classList.remove('hidden');
        resultsEl.scrollIntoView({ behavior: 'smooth' });
    }
}
window.previewScrapedHlsStream = previewScrapedHlsStream;

function copyExtractedDirectUrl(url) {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        alert('Playback URL copied to clipboard!');
    }).catch(() => {
        prompt('Stream URL:', url);
    });
}
window.copyExtractedDirectUrl = copyExtractedDirectUrl;

async function deleteScrapedChannel(id, name) {
    const ok = await showAppConfirmModal({
        title: 'Delete Scraped Channel',
        message: `Are you sure you want to delete "${name}" from Sports Consumet and M3U playlists?`,
        confirmText: 'Delete Channel',
        isDanger: true
    });
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/embed-scraper/channels/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.status === 'success') {
            fetchScrapedChannels();
        } else {
            alert(json.message || 'Failed to delete channel.');
        }
    } catch(e) {
        alert('Delete failed: ' + e.message);
    }
}
window.deleteScrapedChannel = deleteScrapedChannel;

async function openChange2faPinModal() {
    const newPin = prompt("Enter new 6-Digit Master Security PIN (min 4 digits):");
    if (!newPin || !newPin.trim()) return;
    const clean = newPin.trim();
    if (clean.length < 4) {
        showToast('Error', 'Security PIN must be at least 4 digits.', 'error');
        return;
    }
    try {
        const res = await secureFetch('/api/admin/update-2fa-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPin: clean })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('PIN Updated', data.message, 'success');
        } else {
            showToast('Error', data.message || 'Failed to update PIN', 'error');
        }
    } catch (e) {
        showToast('Error', 'Network error updating PIN', 'error');
    }
}
window.openChange2faPinModal = openChange2faPinModal;

// ========================================================
// SCRAPER LIVE INDICATOR & AI COMMAND HUB (CLIENT LOGIC)
// ========================================================
let currentAiTestMode = 'assistant';
let scraperPreviewHls = null;
let lastScrapersCache = null;

async function loadScrapersStatus(forceRefresh = false) {
    const movieGrid = document.getElementById('movieScrapersGrid');
    const sportsGrid = document.getElementById('sportsScrapersGrid');
    updateGitHubFeedsCounts();
    if (!movieGrid || !sportsGrid) return;

    if (!lastScrapersCache || forceRefresh) {
        movieGrid.innerHTML = `
            <div class="col-span-full p-8 text-center bg-gray-950 rounded-2xl border border-gray-800 text-gray-400">
                <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2"></i>
                <p class="text-xs font-bold">Scanning scraper clusters and probing live feeds...</p>
            </div>
        `;
    }

    try {
        const res = await secureFetch('/api/admin/scrapers/status');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            lastScrapersCache = data;
            renderScrapersList(data);
        } else {
            showToast('Warning', data.message || 'Failed to load scrapers status', 'warning');
        }
    } catch (e) {
        console.warn('Scraper status fetch error:', e);
        showToast('Error', 'Network error fetching scraper telemetry', 'error');
    }
}
window.loadScrapersStatus = loadScrapersStatus;

function renderScrapersList(data) {
    const movieGrid = document.getElementById('movieScrapersGrid');
    const sportsGrid = document.getElementById('sportsScrapersGrid');
    const statMovieCount = document.getElementById('statMovieScrapersCount');
    const statSportsCount = document.getElementById('statSportsScrapersCount');
    const statFancodeCount = document.getElementById('statFancodeLiveCount');

    if (!movieGrid || !sportsGrid || !data.scrapers) return;

    const movies = data.scrapers.movies || [];
    const sports = data.scrapers.sports || [];

    if (statMovieCount) statMovieCount.textContent = `${movies.length} Clusters`;
    if (statSportsCount) statSportsCount.textContent = `${sports.length} Resolvers`;
    if (statFancodeCount) statFancodeCount.textContent = `${data.counts?.fancodeLiveCount ?? 0} Ongoing`;

    // Render Movie Scrapers
    movieGrid.innerHTML = movies.map(srv => {
        const isAphelion = srv.id === 's40';
        const priorityBadge = isAphelion 
            ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">#1 Priority</span>'
            : `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gray-800 text-gray-400">Priority ${srv.priority}</span>`;

        return `
            <div id="card-scraper-${srv.id}" class="p-4 rounded-2xl bg-gray-950 border ${isAphelion ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'border-gray-800/80'} hover:border-gray-700 transition-all flex flex-col justify-between space-y-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                        <div class="w-2.5 h-2.5 rounded-full ${isAphelion ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse' : 'bg-emerald-500'}"></div>
                        <div>
                            <h4 class="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>${escapeHtml(srv.name)}</span>
                            </h4>
                            <p class="text-[10px] text-gray-500 font-mono">Cluster ID: <span class="text-cyan-400 font-bold">${srv.id}</span> · Region: ${srv.region}</p>
                        </div>
                    </div>
                    ${priorityBadge}
                </div>

                <div class="bg-black/50 p-2.5 rounded-xl border border-gray-800/60 flex items-center justify-between text-[11px]">
                    <span class="text-gray-400 font-mono">${escapeHtml(srv.protocol)}</span>
                    <span id="badge-lat-${srv.id}" class="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800/80 text-gray-300 font-bold">Ready</span>
                </div>

                <div class="text-[10px] text-gray-400 leading-tight">
                    ${escapeHtml(srv.note || '')}
                </div>

                <div class="pt-1 flex items-center justify-between border-t border-gray-800/60">
                    <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <i data-lucide="check-circle" class="w-3 h-3 text-emerald-400"></i>
                        <span>Active</span>
                    </span>
                    <button type="button" onclick="selectScraperForTest('${srv.id}', '${escapeJsString(srv.name)}')" class="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-[10px] font-bold transition-all flex items-center gap-1">
                        <i data-lucide="play" class="w-3 h-3"></i>
                        <span>Test Cluster</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Render Sports Scrapers
    sportsGrid.innerHTML = sports.map(sp => {
        const isLive = sp.status === 'online';
        const isFancode = sp.id === 'fancode';
        const eventsBadge = sp.activeChannels !== undefined 
            ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isFancode ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">${sp.activeChannels} Active</span>`
            : '';

        return `
            <div id="card-scraper-${sp.id}" class="p-4 rounded-2xl bg-gray-950 border ${isFancode ? 'border-red-500/40 shadow-lg shadow-red-500/5' : 'border-gray-800/80'} hover:border-gray-700 transition-all flex flex-col justify-between space-y-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                        <div class="w-2.5 h-2.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}"></div>
                        <div>
                            <h4 class="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>${escapeHtml(sp.name)}</span>
                            </h4>
                            <p class="text-[10px] text-gray-500 font-mono">Engine: <span class="text-red-400 font-bold">${sp.id}</span> · Priority ${sp.priority}</p>
                        </div>
                    </div>
                    ${eventsBadge}
                </div>

                <div class="bg-black/50 p-2.5 rounded-xl border border-gray-800/60 flex items-center justify-between text-[11px]">
                    <span class="text-gray-400 font-mono">${escapeHtml(sp.protocol)}</span>
                    <span id="badge-lat-${sp.id}" class="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800/80 text-gray-300 font-bold">Ready</span>
                </div>

                <div class="text-[10px] text-gray-400 leading-tight">
                    ${escapeHtml(sp.note || '')}
                </div>

                <div class="pt-1 flex items-center justify-between border-t border-gray-800/60">
                    <span class="text-[10px] ${isLive ? 'text-emerald-400' : 'text-yellow-400'} font-bold flex items-center gap-1">
                        <i data-lucide="${isLive ? 'check-circle' : 'clock'}" class="w-3 h-3"></i>
                        <span>${isLive ? 'Online / Auto-Update' : 'Standby'}</span>
                    </span>
                    <button type="button" onclick="selectScraperForTest('${sp.id}', '${escapeJsString(sp.name)}')" class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-[10px] font-bold transition-all flex items-center gap-1">
                        <i data-lucide="play" class="w-3 h-3"></i>
                        <span>Test Stream</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Render Anime Scrapers
    const animeGrid = document.getElementById('animeScrapersGrid');
    const statAnimeCount = document.getElementById('statAnimeScrapersCount');
    const anime = data.scrapers.anime || [];
    if (statAnimeCount) statAnimeCount.textContent = `${anime.length} Engines`;

    if (animeGrid) {
        animeGrid.innerHTML = anime.map(an => {
            const isOnline = an.status === 'online';
            return `
                <div id="card-scraper-${an.id}" class="p-4 rounded-2xl bg-gray-950 border border-amber-500/20 hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                            <div class="w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-amber-400 shadow-md shadow-amber-400/50 animate-pulse' : 'bg-gray-500'}"></div>
                            <div>
                                <h4 class="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span>${escapeHtml(an.name)}</span>
                                </h4>
                                <p class="text-[10px] text-gray-500 font-mono">ID: <span class="text-amber-400 font-bold">${an.id}</span> · Region: ${an.region || 'Global'}</p>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Priority ${an.priority}</span>
                    </div>

                    <div class="bg-black/50 p-2.5 rounded-xl border border-gray-800/60 flex items-center justify-between text-[11px]">
                        <span class="text-gray-400 font-mono">${escapeHtml(an.protocol)}</span>
                        <span id="badge-lat-${an.id}" class="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800/80 text-gray-300 font-bold">Ready</span>
                    </div>

                    <div class="text-[10px] text-gray-400 leading-tight">
                        ${escapeHtml(an.note || '')}
                    </div>

                    <div class="pt-1 flex items-center justify-between border-t border-gray-800/60">
                        <span class="text-[10px] ${isOnline ? 'text-amber-400' : 'text-gray-400'} font-bold flex items-center gap-1">
                            <i data-lucide="${isOnline ? 'check-circle' : 'clock'}" class="w-3 h-3 text-amber-400"></i>
                            <span>${isOnline ? 'Online / Auto-Dub' : 'Standby'}</span>
                        </span>
                        <button type="button" onclick="selectScraperForTest('${an.id}', '${escapeJsString(an.name)}')" class="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 border border-amber-500/30 text-amber-300 hover:text-white text-[10px] font-bold transition-all flex items-center gap-1">
                            <i data-lucide="play" class="w-3 h-3"></i>
                            <span>Test Stream</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (window.lucide) lucide.createIcons();
}

function setScraperCategoryFilter(category) {
    const secSports = document.getElementById('section_sportsScrapers');
    const secMovies = document.getElementById('section_movieScrapers');
    const secAnime = document.getElementById('section_animeScrapers');

    const btnAll = document.getElementById('btnFilter_all');
    const btnSports = document.getElementById('btnFilter_sports');
    const btnMovies = document.getElementById('btnFilter_movies');
    const btnAnime = document.getElementById('btnFilter_anime');

    const buttons = [
        { id: 'all', el: btnAll },
        { id: 'sports', el: btnSports },
        { id: 'movies', el: btnMovies },
        { id: 'anime', el: btnAnime }
    ];

    buttons.forEach(b => {
        if (!b.el) return;
        if (b.id === category) {
            b.el.className = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white/10 text-white transition-all shadow-sm';
        } else {
            b.el.className = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all';
        }
    });

    if (category === 'all') {
        if (secSports) secSports.classList.remove('hidden');
        if (secMovies) secMovies.classList.remove('hidden');
        if (secAnime) secAnime.classList.remove('hidden');
    } else if (category === 'sports') {
        if (secSports) secSports.classList.remove('hidden');
        if (secMovies) secMovies.classList.add('hidden');
        if (secAnime) secAnime.classList.add('hidden');
    } else if (category === 'movies') {
        if (secSports) secSports.classList.add('hidden');
        if (secMovies) secMovies.classList.remove('hidden');
        if (secAnime) secAnime.classList.add('hidden');
    } else if (category === 'anime') {
        if (secSports) secSports.classList.add('hidden');
        if (secMovies) secMovies.classList.add('hidden');
        if (secAnime) secAnime.classList.remove('hidden');
    }
}
window.setScraperCategoryFilter = setScraperCategoryFilter;

async function benchmarkAllScrapers() {
    const btn = document.getElementById('btnBenchmarkAll');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Benchmarking All Clusters...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    showToast('Benchmarking', 'Probing latencies across all movie clusters and live sports engines...', 'info');

    try {
        const res = await secureFetch('/api/admin/scrapers/benchmark-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (res.ok && data.status === 'success' && data.results) {
            data.results.forEach(r => {
                const badge = document.getElementById(`badge-lat-${r.id}`);
                if (badge) {
                    badge.textContent = `${r.latencyMs}ms`;
                    if (r.status === 'online' && r.latencyMs < 500) {
                        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30';
                    } else if (r.status === 'online') {
                        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30';
                    } else if (r.status === 'degraded') {
                        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/30';
                    } else {
                        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30';
                    }
                }
            });
            showToast('Benchmark Complete', `Benchmarked ${data.results.length} engines successfully.`, 'success');
        } else {
            showToast('Warning', data.message || 'Benchmark completed with warnings', 'warning');
        }
    } catch (e) {
        showToast('Error', 'Failed to run full benchmark suite', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="gauge" class="w-4 h-4"></i><span>Benchmark All Scrapers</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.benchmarkAllScrapers = benchmarkAllScrapers;

function selectScraperForTest(scraperId, name) {
    const sel = document.getElementById('testScraperId');
    if (sel) {
        sel.value = scraperId;
    }
    const formEl = document.getElementById('scraperTestForm');
    if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast('Scraper Selected', `Target set to ${name} (${scraperId}). Click Execute to test.`, 'info');
}
window.selectScraperForTest = selectScraperForTest;

function toggleTestSeasonFields() {
    const mediaType = document.getElementById('testMediaType')?.value;
    const tvBox = document.getElementById('testTvFields');
    if (tvBox) {
        if (mediaType === 'tv') tvBox.classList.remove('hidden');
        else tvBox.classList.add('hidden');
    }
}
window.toggleTestSeasonFields = toggleTestSeasonFields;

async function executeScraperTest(event) {
    if (event) event.preventDefault();

    const scraperId = document.getElementById('testScraperId')?.value || 's40';
    const mediaType = document.getElementById('testMediaType')?.value || 'movie';
    const title = document.getElementById('testMediaTitle')?.value || 'The Matrix';
    const tmdbId = document.getElementById('testTmdbId')?.value || 603;
    const season = document.getElementById('testSeason')?.value || 1;
    const episode = document.getElementById('testEpisode')?.value || 1;

    const btn = document.getElementById('btnRunScraperTest');
    const outBox = document.getElementById('scraperTestOutputBox');
    const latBadge = document.getElementById('testLatencyBadge');
    const detailsBox = document.getElementById('testResultDetails');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Scraping Stream...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    if (outBox) outBox.classList.remove('hidden');
    if (detailsBox) detailsBox.innerHTML = `<p class="text-cyan-400 animate-pulse">Querying upstream cluster ${scraperId} for ${escapeHtml(title)}...</p>`;

    try {
        const res = await secureFetch('/api/admin/scrapers/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scraperId, mediaType, tmdbId, title, season, episode })
        });
        const data = await res.json();

        if (latBadge) latBadge.textContent = `${data.latencyMs || 0}ms`;

        if (res.ok && data.status === 'success') {
            const audioCount = Array.isArray(data.audioTracks) ? data.audioTracks.length : 0;
            const subCount = Array.isArray(data.subtitles) ? data.subtitles.length : 0;

            if (detailsBox) {
                detailsBox.innerHTML = `
                    <div class="text-emerald-400 font-bold">✓ Success: Resolved valid playback manifest (${data.latencyMs}ms)</div>
                    <div class="text-gray-300">Cluster: <span class="text-white font-bold">${escapeHtml(data.scraperId)}</span> · Quality: <span class="text-amber-300 font-bold">${escapeHtml(data.quality || '1080p')}</span></div>
                    <div class="text-gray-400">Title: <span class="text-white">${escapeHtml(data.title || title)}</span></div>
                    <div class="text-gray-400 truncate">Stream URL: <span class="text-cyan-400 select-all font-mono">${escapeHtml(data.streamUrl || '')}</span></div>
                    ${audioCount > 0 ? `<div class="text-emerald-300">Audio Tracks: ${audioCount} detected</div>` : ''}
                    ${subCount > 0 ? `<div class="text-indigo-300">Subtitles: ${subCount} available</div>` : ''}
                `;
            }

            if (data.streamUrl) {
                loadScraperPreviewStream(data.streamUrl, data.title || title, data.quality || '1080p');
            }
            showToast('Scraper Online', `Resolved ${escapeHtml(data.title || title)} in ${data.latencyMs}ms!`, 'success');
        } else {
            if (detailsBox) {
                detailsBox.innerHTML = `
                    <div class="text-rose-400 font-bold">✗ Cluster Response Failed (${data.latencyMs || 0}ms)</div>
                    <div class="text-gray-400 mt-1">${escapeHtml(data.error || data.message || 'No stream returned')}</div>
                `;
            }
            showToast('Warning', data.error || 'Scraper test returned no stream', 'warning');
        }
    } catch (err) {
        if (detailsBox) {
            detailsBox.innerHTML = `<div class="text-rose-400 font-bold">✗ Network exception: ${escapeHtml(err.message)}</div>`;
        }
        showToast('Error', 'Network error during scraper test', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i><span>Execute Live Scrape Test</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.executeScraperTest = executeScraperTest;

function loadScraperPreviewStream(url, title, quality) {
    const video = document.getElementById('scraperPreviewVideo');
    const placeholder = document.getElementById('previewPlaceholder');
    const metaBox = document.getElementById('previewStreamMeta');
    const titleEl = document.getElementById('previewStreamTitle');
    const qualityEl = document.getElementById('previewQualityBadge');
    const linkEl = document.getElementById('previewDirectLink');

    if (!video || !url) return;

    if (scraperPreviewHls) {
        scraperPreviewHls.destroy();
        scraperPreviewHls = null;
    }

    if (placeholder) placeholder.classList.add('hidden');
    video.classList.remove('hidden');
    if (metaBox) metaBox.classList.remove('hidden');
    if (titleEl) titleEl.textContent = title || 'Active Stream';
    if (qualityEl) {
        qualityEl.textContent = quality || '1080p';
        qualityEl.classList.remove('hidden');
    }
    if (linkEl) linkEl.href = url;

    if (url.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
        scraperPreviewHls = new Hls({
            capLevelToPlayerSize: false,
            maxBufferLength: 10,
            maxMaxBufferLength: 20
        });
        scraperPreviewHls.loadSource(url);
        scraperPreviewHls.attachMedia(video);
        scraperPreviewHls.on(Hls.Events.MANIFEST_PARSED, (ev, data) => {
            if (data.levels && data.levels.length > 0) {
                scraperPreviewHls.startLevel = data.levels.length - 1;
            }
            video.play().catch(() => {
                video.muted = true;
                video.play().catch(() => {});
            });
        });
    } else {
        video.src = url;
        video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
        });
    }
}
window.loadScraperPreviewStream = loadScraperPreviewStream;

// AI Hub Methods
async function loadAiStatus() {
    const badge = document.getElementById('aiEngineStatusBadge');
    const statBadge = document.getElementById('statAiStatusBadge');

    try {
        const res = await secureFetch('/api/admin/ai/status');
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const isGeminiActive = !!data.gemini?.configured;
            if (badge) {
                if (isGeminiActive) {
                    badge.className = 'px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5';
                    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Gemini 3.5 Active (${data.gemini.provider})</span>`;
                } else {
                    badge.className = 'px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5';
                    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>Local AI Active (Configure GEMINI_API_KEY for Search)</span>`;
                }
            }
            if (statBadge) {
                statBadge.textContent = isGeminiActive ? 'Online' : 'Local Mode';
            }
        }
    } catch (e) {
        console.warn('AI status load error:', e);
    }
}
window.loadAiStatus = loadAiStatus;

function setAiTestMode(mode) {
    currentAiTestMode = mode;
    const btnAssistant = document.getElementById('btnAiModeAssistant');
    const btnShowcase = document.getElementById('btnAiModeShowcase');

    if (mode === 'assistant') {
        if (btnAssistant) btnAssistant.className = 'py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-600 text-white transition-all';
        if (btnShowcase) btnShowcase.className = 'py-2.5 px-3 rounded-xl text-xs font-bold bg-gray-900 border border-gray-800 text-gray-400 transition-all';
    } else {
        if (btnShowcase) btnShowcase.className = 'py-2.5 px-3 rounded-xl text-xs font-bold bg-purple-600 text-white transition-all';
        if (btnAssistant) btnAssistant.className = 'py-2.5 px-3 rounded-xl text-xs font-bold bg-gray-900 border border-gray-800 text-gray-400 transition-all';
    }
}
window.setAiTestMode = setAiTestMode;

function fillAiPrompt(text) {
    const input = document.getElementById('aiPromptInput');
    if (input) {
        input.value = text;
        input.focus();
    }
}
window.fillAiPrompt = fillAiPrompt;

let currentAiPersona = 'copilot';

function selectAiPersona(personaId) {
    currentAiPersona = personaId;
    const personas = ['copilot', 'pro_polymath', 'fast_assistant', 'scraper_healer'];
    
    personas.forEach(pid => {
        const btn = document.getElementById(`btnPersona_${pid}`);
        if (!btn) return;
        if (pid === personaId) {
            btn.className = 'p-3.5 rounded-xl border border-indigo-500/50 bg-indigo-500/10 text-left transition-all shadow-sm';
        } else {
            btn.className = 'p-3.5 rounded-xl border border-gray-800 bg-gray-900/40 text-left hover:border-gray-700 transition-all';
        }
    });

    const badge = document.getElementById('aiPersonaResponseBadge');
    if (badge) {
        const titles = {
            copilot: 'Entertainment Copilot Response',
            pro_polymath: 'Quantum Polymath Response',
            fast_assistant: 'Lightning Assistant Response',
            scraper_healer: 'Scraper Auto-Healer Response'
        };
        badge.textContent = titles[personaId] || 'AI Assistant Response';
    }
}
window.selectAiPersona = selectAiPersona;

async function runAiTest() {
    const promptInput = document.getElementById('aiPromptInput');
    const prompt = promptInput?.value?.trim();
    if (!prompt) return;

    const btn = document.getElementById('btnExecuteAiPrompt');
    const feed = document.getElementById('aiResponseFeed');
    const latBadge = document.getElementById('aiLatencyBadge');
    const metaBox = document.getElementById('aiGroundingMetadata');
    const queriesList = document.getElementById('aiSearchQueriesList');
    const chkGrounding = document.getElementById('chkWebSearchGrounding');
    const grounding = chkGrounding ? chkGrounding.checked : true;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Querying AI Engine (${currentAiPersona})...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    if (feed) {
        feed.innerHTML = `<p class="text-indigo-400 animate-pulse font-mono">Synthesizing live response with persona [${currentAiPersona}]...</p>`;
    }
    if (latBadge) latBadge.textContent = 'Executing...';
    if (metaBox) metaBox.classList.add('hidden');

    try {
        const res = await secureFetch('/api/admin/ai/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, mode: currentAiTestMode, persona: currentAiPersona, grounding })
        });
        const data = await res.json();

        if (latBadge) latBadge.textContent = `${data.latencyMs || 0}ms`;

        if (res.ok && data.status === 'success') {
            if (currentAiTestMode === 'showcase' && data.result) {
                const r = data.result;
                feed.innerHTML = `
                    <div class="space-y-2 bg-gray-900/60 p-3 rounded-xl border border-gray-800">
                        <div class="flex items-center justify-between">
                            <span class="text-white font-extrabold text-sm">${escapeHtml(r.title)}</span>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">${escapeHtml(r.badge)}</span>
                        </div>
                        <p class="text-gray-300 text-xs">${escapeHtml(r.subtitle)}</p>
                        <div class="flex items-center gap-2 pt-1">
                            <span class="text-[10px] text-gray-500">Layout: <b class="text-white font-mono">${r.gridStyle}</b></span>
                            <span class="text-[10px] text-gray-500">Keywords: <b class="text-cyan-400">${(r.keywords || []).join(', ')}</b></span>
                        </div>
                    </div>
                `;
            } else {
                // Assistant response
                feed.innerHTML = `
                    <div class="whitespace-pre-line text-gray-200 leading-relaxed text-xs">
                        ${escapeHtml(data.answer || 'No response')}
                    </div>
                `;
            }

            // Web search grounding metadata
            if (data.webSearchQueries && data.webSearchQueries.length > 0 && metaBox && queriesList) {
                metaBox.classList.remove('hidden');
                queriesList.innerHTML = data.webSearchQueries.map(q => `
                    <span class="px-2 py-0.5 rounded-md bg-gray-900 text-indigo-300 border border-gray-800 text-[10px] font-mono">${escapeHtml(q)}</span>
                `).join('');
            }

            showToast('AI Query Complete', `Response received in ${data.latencyMs}ms`, 'success');
        } else {
            if (feed) feed.innerHTML = `<p class="text-rose-400 font-bold">Failed: ${escapeHtml(data.message || 'Execution error')}</p>`;
            showToast('Warning', data.message || 'AI request failed', 'warning');
        }
    } catch (e) {
        if (feed) feed.innerHTML = `<p class="text-rose-400 font-bold">Network exception: ${escapeHtml(e.message)}</p>`;
        showToast('Error', 'Network error querying AI engine', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Execute AI Persona Query</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.runAiTest = runAiTest;

async function triggerGithubFeedsRefreshManual() {
    const btn = document.getElementById('btnManualGithubSync');
    const icon = document.getElementById('btnManualGithubSyncIcon');
    if (icon) icon.classList.add('animate-spin');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/admin/github-sources/refresh', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken || ''}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('GitHub Feeds Sync Complete', `Updated all feeds in ${data.latencyMs || 0}ms`, 'success');
            const countEl = document.getElementById('ghFeedLiveM3uCount');
            if (countEl && data.stats) countEl.textContent = `${data.stats.liveMatchEvents || 0} Matches`;
            const airtelEl = document.getElementById('ghFeedAirtelCount');
            if (airtelEl && data.stats) airtelEl.textContent = `${(data.stats.airtelChannels || 0).toLocaleString()} Channels`;
            const jtvEl = document.getElementById('ghFeedJtvCount');
            if (jtvEl && data.stats) jtvEl.textContent = `${(data.stats.jioTvChannels || 0).toLocaleString()} Channels`;
        } else {
            showToast('Sync Warning', data.message || 'Failed to refresh GitHub feeds', 'warning');
        }
    } catch(err) {
        showToast('Sync Error', 'Network error triggering GitHub feeds refresh', 'error');
    } finally {
        if (icon) icon.classList.remove('animate-spin');
        if (btn) btn.disabled = false;
    }
}
window.triggerGithubFeedsRefreshManual = triggerGithubFeedsRefreshManual;

async function updateGitHubFeedsCounts() {
    try {
        const [liveRes, airtelRes, jtvRes] = await Promise.all([
            fetch('/api/livem3u/channels?limit=1'),
            fetch('/api/airtel/channels?limit=1'),
            fetch('/api/jtv/channels')
        ]);
        const liveData = await liveRes.json();
        const airtelData = await airtelRes.json();
        const jtvData = await jtvRes.json();

        const elLive = document.getElementById('githubLiveM3uCount');
        const elAirtel = document.getElementById('githubAirtelCount');
        const elJio = document.getElementById('githubJioCount');

        if (elLive) elLive.textContent = `${liveData.count || 47} Active Channels`;
        if (elAirtel) elAirtel.textContent = `${(airtelData.count || 9966).toLocaleString()} Active Channels`;
        if (elJio) elJio.textContent = `${(jtvData.length || 1365).toLocaleString()} Active Channels`;
    } catch (e) {
        console.warn('[GitHub Feeds] Error loading counts:', e);
    }
}
window.updateGitHubFeedsCounts = updateGitHubFeedsCounts;

async function triggerGitHubSync(type) {
    const btnMap = {
        'livem3u': 'btnSyncLiveM3u',
        'airtel': 'btnSyncAirtel',
        'jtv': 'btnSyncJtv'
    };
    const btn = document.getElementById(btnMap[type]);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Syncing...`;
    }

    try {
        let endpoint = '/api/livem3u/refresh';
        if (type === 'airtel') endpoint = '/api/airtel/channels?refresh=1';
        if (type === 'jtv') endpoint = '/api/jtv/channels?refresh=1';

        const res = await fetch(endpoint);
        const data = await res.json();

        if (res.ok) {
            showToast('Success', `Successfully refreshed ${type} feed!`, 'success');
            await updateGitHubFeedsCounts();
        } else {
            showToast('Error', data.error || `Failed to refresh ${type} feed`, 'error');
        }
    } catch (e) {
        showToast('Error', `Network error syncing ${type} feed`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sync ${type} Now`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.triggerGitHubSync = triggerGitHubSync;

// ============================================================================
// 🤖 HARI AI AUTONOMOUS CONSOLE CONTROLLER (100% Native, In-House, Offline)
// ============================================================================

let hariChatHistory = [];
let hariIsStreaming = false;
let hariAbortController = null;
let hariTtsEnabled = localStorage.getItem('hari_tts_enabled') === 'true';
let hariSpeechRecognition = null;
let hariIsListening = false;

// 1. Initialize HARI Chat
function initHariChat() {
    const feed = document.getElementById('hariChatFeed');
    if (!feed) return;

    // Load saved history if available and not already loaded
    try {
        const saved = localStorage.getItem('hari_admin_chat_history');
        if (saved && hariChatHistory.length === 0) {
            hariChatHistory = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('[HARI] Failed to restore chat history:', e);
    }

    // Render feed
    if (feed.children.length === 0) {
        if (hariChatHistory.length === 0) {
            renderHariWelcomeMessage();
        } else {
            renderHariChatHistory();
        }
    }

    // Update TTS UI
    updateHariTtsButtonState();

    // Auto-resize input & focus
    const input = document.getElementById('hariChatInput');
    if (input) {
        autoResizeHariTextarea(input);
        setTimeout(() => input.focus(), 150);
    }

    scrollHariChatToBottom();
    if (window.lucide) lucide.createIcons();
}
window.initHariChat = initHariChat;

// 2. Render Initial Welcome Screen
function renderHariWelcomeMessage() {
    const feed = document.getElementById('hariChatFeed');
    if (!feed) return;

    const timeStr = new Date().toLocaleTimeString();
    feed.innerHTML = `
        <div class="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-gray-900/60 border border-indigo-500/30 shadow-xl">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                <i data-lucide="bot" class="w-6 h-6"></i>
            </div>
            <div class="flex-1 min-w-0 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="font-black text-white text-sm tracking-tight">HARI AI Assistant</span>
                        <span class="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">ONLINE</span>
                    </div>
                    <span class="text-[10px] text-gray-500 mono">${timeStr}</span>
                </div>

                <!-- Boot Reasoning Trace -->
                <details class="hari-thought bg-black/40 border border-indigo-500/20 rounded-xl p-3">
                    <summary class="cursor-pointer text-xs font-mono text-indigo-400 flex items-center justify-between hover:text-indigo-300">
                        <span class="flex items-center gap-2">
                            <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-indigo-400"></i>
                            <span>Neural Core Boot &amp; Topology Inspection</span>
                        </span>
                        <span class="text-[10px] text-emerald-400 font-bold">READY</span>
                    </summary>
                    <div class="mt-2.5 pt-2 border-t border-gray-800 text-xs font-mono text-gray-400 space-y-1.5 pl-2 leading-relaxed">
                        <div class="text-indigo-300">✓ In-house neural reasoning engine initialized (zero cloud/API overhead)</div>
                        <div>✓ Connected to Doctor Strange AI Stream Doctor (real-time stream health analyzer)</div>
                        <div>✓ Catalog indexed: channels.json (700+ channels) + MDTV (34 JioTV DASH) + TimStreams</div>
                        <div>✓ Media hub indexed: SM Movie Hub (36,000+ movies) + Movies4u + FrameX scraper</div>
                        <div>✓ Security gateway: Quantum Site Lock &amp; IP Blacklist connected</div>
                    </div>
                </details>

                <div class="text-xs text-gray-200 leading-relaxed hari-prose">
                    <p>Welcome, Admin! I am <strong>HARI</strong> — your autonomous AI assistant built specifically for Stalker Pro &amp; Aetheris Core.</p>
                    <p>I operate <strong>100% in-house and offline</strong> right on your server. You can ask me to diagnose broken streams, inspect W3C ClearKey DRM manifests, check real-time system performance, query live sports schedules, or search movies.</p>
                </div>

                <!-- Quick Action Buttons -->
                <div class="pt-2 flex flex-wrap gap-2">
                    <button type="button" onclick="sendHariQuickPrompt('Show live server health, CPU load, and active streaming sockets')" class="px-3 py-1.5 rounded-xl bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5">
                        <i data-lucide="gauge" class="w-3.5 h-3.5 text-indigo-400"></i>
                        <span>Check System Telemetry</span>
                    </button>
                    <button type="button" onclick="sendHariQuickPrompt('Run Doctor Strange AI Stream Doctor to diagnose all streaming issues')" class="px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5">
                        <i data-lucide="stethoscope" class="w-3.5 h-3.5 text-purple-400"></i>
                        <span>Diagnose All Streams</span>
                    </button>
                    <button type="button" onclick="sendHariQuickPrompt('What live cricket matches and sports events are streaming today?')" class="px-3 py-1.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5">
                        <i data-lucide="trophy" class="w-3.5 h-3.5 text-emerald-400"></i>
                        <span>Live Cricket &amp; Sports</span>
                    </button>
                    <button type="button" onclick="sendHariQuickPrompt('Search SM Movie Hub and Movies4u for trending movies')" class="px-3 py-1.5 rounded-xl bg-pink-900/40 hover:bg-pink-900/60 border border-pink-500/30 text-pink-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5">
                        <i data-lucide="film" class="w-3.5 h-3.5 text-pink-400"></i>
                        <span>Search Movie Hub</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

// 3. Render Historical Messages
function renderHariChatHistory() {
    const feed = document.getElementById('hariChatFeed');
    if (!feed) return;
    feed.innerHTML = '';

    for (const msg of hariChatHistory) {
        if (msg.role === 'user') {
            appendHariUserBubble(msg.content, msg.timestamp);
        } else if (msg.role === 'assistant') {
            appendHariAssistantBubble(msg);
        }
    }
    scrollHariChatToBottom();
    if (window.lucide) lucide.createIcons();
}

// 4. Append User Bubble
function appendHariUserBubble(content, timestamp) {
    const feed = document.getElementById('hariChatFeed');
    if (!feed) return;
    const ts = timestamp || Date.now();

    const div = document.createElement('div');
    div.className = 'flex items-start justify-end gap-3 max-w-3xl ml-auto';
    div.innerHTML = `
        <div class="space-y-1 text-right">
            <div class="inline-block p-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white text-xs leading-relaxed shadow-lg shadow-indigo-950/60 text-left border border-indigo-400/20">
                ${escapeHariHtml(content).replace(/\n/g, '<br/>')}
            </div>
            <div class="text-[10px] text-gray-500 mono px-1">${new Date(ts).toLocaleTimeString()}</div>
        </div>
        <div class="w-8 h-8 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 shadow shrink-0">
            <i data-lucide="user" class="w-4 h-4"></i>
        </div>
    `;
    feed.appendChild(div);
    if (window.lucide) lucide.createIcons();
    scrollHariChatToBottom();
}

// 5. Append Assistant Bubble
function appendHariAssistantBubble(data) {
    const feed = document.getElementById('hariChatFeed');
    if (!feed) return;

    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 max-w-4xl mr-auto w-full';

    let thoughtHtml = '';
    if (data.thought) {
        const timeText = data.executionTimeMs ? (data.executionTimeMs + 'ms') : 'COMPLETE';
        thoughtHtml = `
            <details class="hari-thought bg-black/40 border border-indigo-500/20 rounded-xl p-3 mb-2.5">
                <summary class="cursor-pointer text-xs font-mono text-indigo-400 flex items-center justify-between hover:text-indigo-300">
                    <span class="flex items-center gap-2">
                        <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-indigo-400"></i>
                        <span>Reasoning Trace &amp; Intent Analysis</span>
                    </span>
                    <span class="text-[10px] text-gray-400 font-mono">${timeText}</span>
                </summary>
                <div class="mt-2.5 pt-2 border-t border-gray-800 text-xs font-mono text-gray-400 whitespace-pre-wrap pl-2 leading-relaxed">
                    ${escapeHariHtml(data.thought)}
                </div>
            </details>
        `;
    }

    let widgetHtml = '';
    if (data.widget) {
        widgetHtml = renderHariWidget(data.widget);
    }

    let followupsHtml = '';
    if (data.suggestedFollowups && data.suggestedFollowups.length > 0) {
        const chips = data.suggestedFollowups.map(f => `
            <button type="button" onclick="sendHariQuickPrompt('${escapeHariAttr(f)}')" class="px-2.5 py-1 rounded-lg bg-gray-900/90 hover:bg-gray-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-[11px] transition-all flex items-center gap-1">
                <span>${escapeHariHtml(f)}</span>
            </button>
        `).join('');

        followupsHtml = `
            <div class="pt-3 border-t border-gray-800/80 flex flex-wrap gap-2">
                <span class="text-[10px] text-gray-500 mono uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <i data-lucide="corner-down-right" class="w-3 h-3 text-indigo-400"></i> Next:
                </span>
                ${chips}
            </div>
        `;
    }

    div.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <i data-lucide="bot" class="w-4.5 h-4.5"></i>
        </div>
        <div class="flex-1 min-w-0 space-y-2 p-4 rounded-2xl bg-gray-900/70 border border-gray-800/80 shadow-lg">
            <div class="flex items-center justify-between pb-1 border-b border-gray-800/50">
                <span class="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>HARI AI</span>
                    <span class="text-[9px] text-indigo-400 mono">[Local Engine]</span>
                </span>
                <span class="text-[10px] text-gray-500 mono">${new Date(data.timestamp || Date.now()).toLocaleTimeString()}</span>
            </div>
            ${thoughtHtml}
            <div class="text-xs text-gray-200 leading-relaxed hari-prose">
                ${renderMarkdownSafely(data.content || data.answer || '')}
            </div>
            ${widgetHtml}
            ${followupsHtml}
        </div>
    `;

    feed.appendChild(div);
    if (window.lucide) lucide.createIcons();
    scrollHariChatToBottom();
}

// 6. Interactive Widget Renderer
function renderHariWidget(widget) {
    if (!widget || !widget.type || !widget.data) return '';
    const type = widget.type;
    const data = widget.data;

    if (type === 'channel_card') {
        const ch = data;
        const logoHtml = ch.logo ? `<img src="${ch.logo}" alt="${escapeHariAttr(ch.name)}" class="w-full h-full object-contain" onerror="this.remove()">` : `<i data-lucide="tv" class="w-5 h-5 text-indigo-400"></i>`;
        const groupHtml = ch.group ? `<span class="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono">${escapeHariHtml(ch.group)}</span>` : '';
        const drmHtml = (ch.key_id && ch.key) ? `<div class="text-[9px] text-amber-300/80 mono mt-0.5 truncate max-w-md">DRM ClearKey: ${escapeHariHtml(ch.key_id)}:${escapeHariHtml(ch.key)}</div>` : '';

        return `
            <div class="p-3.5 my-3 rounded-xl bg-gray-950/80 border border-indigo-500/30 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-white font-black text-sm overflow-hidden shrink-0">
                        ${logoHtml}
                    </div>
                    <div>
                        <div class="font-bold text-white text-xs flex items-center gap-2">
                            <span>${escapeHariHtml(ch.name || 'Stream Channel')}</span>
                            ${groupHtml}
                        </div>
                        <div class="text-[10px] text-gray-400 mono mt-0.5">
                            ID: <span class="text-gray-300 font-bold">${escapeHariHtml(ch.id || 'N/A')}</span> • Protocol: <span class="text-emerald-400">${escapeHariHtml(ch.type || 'm3u8')}</span>
                        </div>
                        ${drmHtml}
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                    <button type="button" onclick="playHariChannel('${escapeHariAttr(ch.id)}', '${escapeHariAttr(ch.streamUrl)}', '${escapeHariAttr(ch.key_id || '')}', '${escapeHariAttr(ch.key || '')}', '${escapeHariAttr(ch.name || '')}', '${escapeHariAttr(ch.type || 'm3u8')}')" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950">
                        <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                        <span>Play Stream</span>
                    </button>
                    <button type="button" onclick="copyHariStreamUrl('${escapeHariAttr(ch.streamUrl)}')" class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-xs font-medium flex items-center gap-1 transition-all">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        <span>Copy Link</span>
                    </button>
                </div>
            </div>
        `;
    }

    if (type === 'media_card') {
        const items = Array.isArray(data) ? data : [data];
        const cardsHtml = items.slice(0, 4).map(item => {
            const yearStr = item.year ? (' • ' + escapeHariHtml(String(item.year))) : '';
            const watchBtn = item.streamUrl ? `
                <button type="button" onclick="playHariChannel('movie', '${escapeHariAttr(item.streamUrl)}', '', '', '${escapeHariAttr(item.title || 'Movie')}', 'm3u8')" class="px-2.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition-all">
                    <i data-lucide="play" class="w-3 h-3 fill-current"></i>
                    <span>Watch</span>
                </button>
            ` : '';

            return `
                <div class="p-3 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-pink-500/40 transition-all flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="font-bold text-white text-xs truncate">${escapeHariHtml(item.title || item.name || 'Untitled')}</div>
                        <div class="text-[10px] text-gray-400 mono mt-0.5">
                            Source: <span class="text-pink-400 font-bold">${escapeHariHtml(item.source || 'Cinema Hub')}</span>
                            ${yearStr}
                        </div>
                    </div>
                    ${watchBtn}
                </div>
            `;
        }).join('');

        return `
            <div class="my-3 space-y-2">
                <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <i data-lucide="film" class="w-3.5 h-3.5 text-pink-400"></i> Media Vault Matches
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    if (type === 'stats_card') {
        const s = data;
        return `
            <div class="my-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div class="p-3 rounded-xl bg-gray-950/90 border border-indigo-500/30">
                    <div class="text-[10px] text-gray-400 uppercase font-mono">RAM Used</div>
                    <div class="text-sm font-black text-white mt-1">${escapeHariHtml(s.ramUsedMb || 0)} MB / ${escapeHariHtml(s.ramTotalMb || 0)} MB</div>
                </div>
                <div class="p-3 rounded-xl bg-gray-950/90 border border-purple-500/30">
                    <div class="text-[10px] text-gray-400 uppercase font-mono">Active Streams</div>
                    <div class="text-sm font-black text-purple-400 mt-1">${escapeHariHtml(s.activeSockets || 0)} sockets</div>
                </div>
                <div class="p-3 rounded-xl bg-gray-950/90 border border-emerald-500/30">
                    <div class="text-[10px] text-gray-400 uppercase font-mono">Channels Catalog</div>
                    <div class="text-sm font-black text-emerald-400 mt-1">${escapeHariHtml(s.channelCount || 0)} live</div>
                </div>
                <div class="p-3 rounded-xl bg-gray-950/90 border border-rose-500/30">
                    <div class="text-[10px] text-gray-400 uppercase font-mono">Firewall Status</div>
                    <div class="text-sm font-black text-rose-400 mt-1">${escapeHariHtml(s.blacklistedIps || 0)} blocked</div>
                </div>
            </div>
        `;
    }

    if (type === 'diagnostic_card') {
        const d = data;
        const testBtn = d.streamUrl ? `
            <div class="mt-2 flex items-center gap-2">
                <button type="button" onclick="playHariChannel('diag', '${escapeHariAttr(d.streamUrl)}', '', '', 'Diagnosed Stream', 'm3u8')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1">
                    <i data-lucide="play" class="w-3 h-3 fill-current"></i> Test Stream
                </button>
            </div>
        ` : '';

        return `
            <div class="p-3.5 my-3 rounded-xl bg-gray-950/90 border border-emerald-500/30 flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-xs flex items-center gap-2">
                        <span>AI Diagnostic Scan Complete</span>
                        <span class="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.2 rounded font-mono">HEALTHY</span>
                    </div>
                    <div class="text-xs text-gray-300 mt-1">${escapeHariHtml(d.actionTaken || d.message || 'Stream headers and manifests validated with zero buffer gaps.')}</div>
                    ${testBtn}
                </div>
            </div>
        `;
    }

    return '';
}

// 7. Handle Submit & Streaming Response
async function handleHariSubmit() {
    const input = document.getElementById('hariChatInput');
    if (!input || hariIsStreaming) return;

    const query = (input.value || '').trim();
    if (!query) return;

    // Reset input
    input.value = '';
    autoResizeHariTextarea(input);

    // Toggle Send/Stop buttons
    setHariStreamingState(true);

    // Append user bubble to UI
    appendHariUserBubble(query);

    // Add to history
    hariChatHistory.push({ role: 'user', content: query, timestamp: Date.now() });

    // Prepare assistant placeholder element
    const placeholder = createHariAssistantPlaceholder();

    hariAbortController = new AbortController();

    try {
        const response = await secureFetch('/api/admin/hari/chat/stream', {
            method: 'POST',
            signal: hariAbortController.signal,
            body: JSON.stringify({
                message: query,
                history: hariChatHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || ('HTTP ' + response.status + ' from HARI Engine'));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulatedThought = '';
        let accumulatedAnswer = '';
        let finalDonePayload = null;

        while (true) {
            const chunkResult = await reader.read();
            if (chunkResult.done) break;

            buffer += decoder.decode(chunkResult.value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const jsonStr = trimmed.replace(/^data:\s*/, '');
                if (!jsonStr) continue;

                try {
                    const chunk = JSON.parse(jsonStr);

                    if (chunk.type === 'thought') {
                        accumulatedThought += chunk.token;
                        updateHariThoughtBox(placeholder, accumulatedThought);
                    } else if (chunk.type === 'token') {
                        accumulatedAnswer += chunk.token;
                        updateHariAnswerBox(placeholder, accumulatedAnswer);
                    } else if (chunk.type === 'done') {
                        finalDonePayload = chunk;
                    } else if (chunk.type === 'error') {
                        throw new Error(chunk.error || 'Unknown error occurred in HARI core');
                    }
                } catch (pe) {
                    console.warn('[HARI SSE Parse Warn]:', pe);
                }
            }
        }

        // Finalize
        finalizeHariMessage(placeholder, finalDonePayload || {
            thought: accumulatedThought,
            answer: accumulatedAnswer
        });

    } catch (err) {
        if (err.name === 'AbortError') {
            finalizeHariMessage(placeholder, {
                thought: placeholder.rawThought,
                answer: (placeholder.rawAnswer || '') + '\n\n*(Generation stopped by user)*'
            });
        } else {
            console.error('[HARI Chat Error]:', err);
            placeholder.contentEl.innerHTML = `
                <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0 mt-0.5"></i>
                    <div>
                        <div class="font-bold">Error communicating with HARI core</div>
                        <div class="text-[11px] text-rose-400/80 mt-0.5">${escapeHariHtml(err.message)}</div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    } finally {
        setHariStreamingState(false);
        hariAbortController = null;
    }
}
window.handleHariSubmit = handleHariSubmit;

// 8. Create Assistant Placeholder DOM Node
function createHariAssistantPlaceholder() {
    const feed = document.getElementById('hariChatFeed');
    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 max-w-4xl mr-auto w-full';

    div.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <i data-lucide="bot" class="w-4.5 h-4.5 animate-pulse"></i>
        </div>
        <div class="flex-1 min-w-0 space-y-2 p-4 rounded-2xl bg-gray-900/70 border border-gray-800/80 shadow-lg">
            <div class="flex items-center justify-between pb-1 border-b border-gray-800/50">
                <span class="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>HARI AI</span>
                    <span class="text-[9px] text-indigo-400 mono animate-pulse">[Thinking &amp; Generating...]</span>
                </span>
                <span class="text-[10px] text-gray-500 mono">${new Date().toLocaleTimeString()}</span>
            </div>

            <!-- Thinking details accordion -->
            <details class="hari-thought bg-black/40 border border-indigo-500/30 rounded-xl p-3 mb-2.5" open>
                <summary class="cursor-pointer text-xs font-mono text-indigo-400 flex items-center justify-between hover:text-indigo-300">
                    <span class="flex items-center gap-2">
                        <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-indigo-400 animate-spin"></i>
                        <span>Neural Reasoning Trace</span>
                    </span>
                    <span class="text-[10px] text-indigo-400 font-mono animate-pulse">REASONING...</span>
                </summary>
                <div class="hari-thought-content mt-2.5 pt-2 border-t border-gray-800 text-xs font-mono text-gray-400 whitespace-pre-wrap pl-2 leading-relaxed">
                    Analyzing intent and platform telemetry...
                </div>
            </details>

            <!-- Answer Prose Container -->
            <div class="hari-answer-content text-xs text-gray-200 leading-relaxed hari-prose">
                <span class="hari-cursor"></span>
            </div>

            <!-- Widget Container -->
            <div class="hari-widget-container"></div>

            <!-- Suggested Follow-ups -->
            <div class="hari-followups-container"></div>
        </div>
    `;

    feed.appendChild(div);
    if (window.lucide) lucide.createIcons();
    scrollHariChatToBottom();

    return {
        rootEl: div,
        thoughtDetailsEl: div.querySelector('.hari-thought'),
        thoughtContentEl: div.querySelector('.hari-thought-content'),
        contentEl: div.querySelector('.hari-answer-content'),
        widgetContainer: div.querySelector('.hari-widget-container'),
        followupsContainer: div.querySelector('.hari-followups-container'),
        statusBadge: div.querySelector('.mono.animate-pulse'),
        rawThought: '',
        rawAnswer: ''
    };
}

// 9. Update Thought Box during stream
function updateHariThoughtBox(placeholder, thought) {
    placeholder.rawThought = thought;
    if (placeholder.thoughtContentEl) {
        placeholder.thoughtContentEl.textContent = thought;
        scrollHariChatToBottom();
    }
}

// 10. Update Answer Box during stream
function updateHariAnswerBox(placeholder, answer) {
    placeholder.rawAnswer = answer;
    if (placeholder.contentEl) {
        placeholder.contentEl.innerHTML = renderMarkdownSafely(answer) + '<span class="hari-cursor"></span>';
        scrollHariChatToBottom();
    }
}

// 11. Finalize Assistant Message
function finalizeHariMessage(placeholder, donePayload) {
    const thought = donePayload.thought || placeholder.rawThought || '';
    const answer = donePayload.answer || placeholder.rawAnswer || '';
    const widget = donePayload.widget;
    const suggestedFollowups = donePayload.suggestedFollowups;

    // Remove cursor & render complete markdown
    if (placeholder.contentEl) {
        placeholder.contentEl.innerHTML = renderMarkdownSafely(answer);
    }

    // Collapse thought accordion once answer is complete
    if (placeholder.thoughtDetailsEl) {
        placeholder.thoughtDetailsEl.removeAttribute('open');
        const summaryStatus = placeholder.thoughtDetailsEl.querySelector('summary span:last-child');
        if (summaryStatus) {
            summaryStatus.className = 'text-[10px] text-emerald-400 font-mono';
            summaryStatus.textContent = donePayload.executionTimeMs ? (donePayload.executionTimeMs + 'ms') : 'COMPLETE';
        }
        const brainIcon = placeholder.thoughtDetailsEl.querySelector('i[data-lucide="brain-circuit"]');
        if (brainIcon) brainIcon.classList.remove('animate-spin');
    }

    // Update status badge
    if (placeholder.statusBadge) {
        placeholder.statusBadge.classList.remove('animate-pulse');
        placeholder.statusBadge.textContent = '[Local Engine]';
    }

    // Render Widget if present
    if (widget && placeholder.widgetContainer) {
        placeholder.widgetContainer.innerHTML = renderHariWidget(widget);
    }

    // Render Followups if present
    if (suggestedFollowups && suggestedFollowups.length > 0 && placeholder.followupsContainer) {
        const chipsHtml = suggestedFollowups.map(f => `
            <button type="button" onclick="sendHariQuickPrompt('${escapeHariAttr(f)}')" class="px-2.5 py-1 rounded-lg bg-gray-900/90 hover:bg-gray-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-[11px] transition-all flex items-center gap-1">
                <span>${escapeHariHtml(f)}</span>
            </button>
        `).join('');

        placeholder.followupsContainer.innerHTML = `
            <div class="pt-3 border-t border-gray-800/80 flex flex-wrap gap-2">
                <span class="text-[10px] text-gray-500 mono uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <i data-lucide="corner-down-right" class="w-3 h-3 text-indigo-400"></i> Next:
                </span>
                ${chipsHtml}
            </div>
        `;
    }

    // Push to history & persist
    const assistantMsg = {
        role: 'assistant',
        content: answer,
        thought: thought,
        widget: widget,
        suggestedFollowups: suggestedFollowups,
        executionTimeMs: donePayload.executionTimeMs,
        timestamp: Date.now()
    };
    hariChatHistory.push(assistantMsg);

    try {
        localStorage.setItem('hari_admin_chat_history', JSON.stringify(hariChatHistory.slice(-50)));
    } catch (e) {
        console.warn('[HARI] Failed to persist chat history:', e);
    }

    // Speak text if TTS is enabled
    if (hariTtsEnabled && answer) {
        speakHariText(answer);
    }

    if (window.lucide) lucide.createIcons();
    scrollHariChatToBottom();
}

// 12. Stop Active Streaming
function stopHariStreaming() {
    if (hariAbortController) {
        hariAbortController.abort();
    }
}
window.stopHariStreaming = stopHariStreaming;

// 13. UI Streaming State Toggle
function setHariStreamingState(isStreaming) {
    hariIsStreaming = isStreaming;
    const btnSend = document.getElementById('btnHariSend');
    const btnStop = document.getElementById('btnHariStop');
    if (btnSend && btnStop) {
        if (isStreaming) {
            btnSend.classList.add('hidden');
            btnStop.classList.remove('hidden');
        } else {
            btnSend.classList.remove('hidden');
            btnStop.classList.add('hidden');
        }
    }
}

// 14. Quick Prompt Dispatcher
function sendHariQuickPrompt(promptText) {
    const input = document.getElementById('hariChatInput');
    if (!input) return;
    input.value = promptText;
    autoResizeHariTextarea(input);
    handleHariSubmit();
}
window.sendHariQuickPrompt = sendHariQuickPrompt;

// 15. Keydown Handler
function handleHariChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleHariSubmit();
    }
}
window.handleHariChatKeydown = handleHariChatKeydown;

// 16. Auto Resize Textarea
function autoResizeHariTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 144) + 'px';
}
window.autoResizeHariTextarea = autoResizeHariTextarea;

// 17. Scroll Feed to Bottom
function scrollHariChatToBottom() {
    const feed = document.getElementById('hariChatFeed');
    if (feed) {
        feed.scrollTop = feed.scrollHeight;
    }
}

// 18. Clear History
function clearHariChatHistory() {
    if (!confirm('Are you sure you want to clear your HARI conversation history?')) return;
    hariChatHistory = [];
    try {
        localStorage.removeItem('hari_admin_chat_history');
    } catch(e) {}
    renderHariWelcomeMessage();
    showToast('HARI AI', 'Conversation history cleared', 'info');
}
window.clearHariChatHistory = clearHariChatHistory;

// 19. Export as Markdown
function exportHariChatMarkdown() {
    if (hariChatHistory.length === 0) {
        showToast('HARI AI', 'No chat history to export', 'warning');
        return;
    }

    let md = '# 🤖 HARI AI Session Export\n';
    md += '*Exported on ' + new Date().toLocaleString() + ' from Stalker Pro Aetheris Console*\n\n---\n\n';

    for (const msg of hariChatHistory) {
        if (msg.role === 'user') {
            md += '### 👤 Admin (' + new Date(msg.timestamp || Date.now()).toLocaleTimeString() + ')\n\n' + msg.content + '\n\n';
        } else if (msg.role === 'assistant') {
            md += '### 🤖 HARI AI\n\n';
            if (msg.thought) {
                md += '> **Thinking Trace:**\n> ' + msg.thought.replace(/\n/g, '\n> ') + '\n\n';
            }
            md += msg.content + '\n\n---\n\n';
        }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HARI_Session_' + new Date().toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(a);
    showToast('Export', 'Conversation exported to Markdown', 'success');
}
window.exportHariChatMarkdown = exportHariChatMarkdown;

// 20. Code Block Copy Utility
function copyHariCodeBlock(button) {
    const pre = button.closest('.relative')?.querySelector('pre code');
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText).then(() => {
        const span = button.querySelector('span');
        if (span) {
            const original = span.textContent;
            span.textContent = 'Copied!';
            setTimeout(() => { span.textContent = original; }, 2000);
        }
    });
}
window.copyHariCodeBlock = copyHariCodeBlock;

// 21. Stream Player Launcher
function playHariChannel(channelId, streamUrl, keyId, key, name, type) {
    let finalUrl = streamUrl;
    if (channelId && !streamUrl) {
        finalUrl = '/live.php?token=STALKER_PRO&id=' + encodeURIComponent(channelId) + '&m3u=1';
    }
    const playerUrl = '/play_consumet.php?channel_id=' + encodeURIComponent(channelId || '') + '&url=' + encodeURIComponent(finalUrl) + '&key_id=' + encodeURIComponent(keyId || '') + '&key=' + encodeURIComponent(key || '') + '&type=' + encodeURIComponent(type || 'm3u8') + '&name=' + encodeURIComponent(name || 'HARI Stream') + '&source=hari';
    window.open(playerUrl, '_blank');
}
window.playHariChannel = playHariChannel;

// 22. Copy Stream URL
function copyHariStreamUrl(url) {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Clipboard', 'Stream URL copied to clipboard!', 'success');
    });
}
window.copyHariStreamUrl = copyHariStreamUrl;

// 23. Doctor Strange Trigger from HARI
function runDoctorStrangeFullCheck() {
    switchTab('harichat');
    sendHariQuickPrompt("Run Doctor Strange AI Stream Doctor to diagnose all streaming issues and heal broken streams");
}
window.runDoctorStrangeFullCheck = runDoctorStrangeFullCheck;

// 24. Web Speech Recognition (Voice Input)
function toggleHariSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        showToast('Voice Input', 'Speech recognition is not supported in this browser.', 'warning');
        return;
    }

    const btn = document.getElementById('btnHariVoice');

    if (hariIsListening && hariSpeechRecognition) {
        hariSpeechRecognition.stop();
        hariIsListening = false;
        if (btn) btn.classList.remove('bg-rose-600', 'text-white', 'animate-pulse');
        return;
    }

    try {
        hariSpeechRecognition = new SpeechRec();
        hariSpeechRecognition.continuous = false;
        hariSpeechRecognition.interimResults = false;
        hariSpeechRecognition.lang = 'en-US';

        hariSpeechRecognition.onstart = () => {
            hariIsListening = true;
            if (btn) btn.classList.add('bg-rose-600', 'text-white', 'animate-pulse');
            showToast('Voice Input', 'Listening... Speak your request to HARI', 'info');
        };

        hariSpeechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                const input = document.getElementById('hariChatInput');
                if (input) {
                    input.value = transcript;
                    autoResizeHariTextarea(input);
                    handleHariSubmit();
                }
            }
        };

        hariSpeechRecognition.onerror = (event) => {
            console.warn('[HARI Speech Error]:', event.error);
            hariIsListening = false;
            if (btn) btn.classList.remove('bg-rose-600', 'text-white', 'animate-pulse');
        };

        hariSpeechRecognition.onend = () => {
            hariIsListening = false;
            if (btn) btn.classList.remove('bg-rose-600', 'text-white', 'animate-pulse');
        };

        hariSpeechRecognition.start();
    } catch (e) {
        console.error('[HARI Speech Exception]:', e);
        hariIsListening = false;
        if (btn) btn.classList.remove('bg-rose-600', 'text-white', 'animate-pulse');
    }
}
window.toggleHariSpeechRecognition = toggleHariSpeechRecognition;

// 25. Text-To-Speech (TTS Voice Output)
function toggleHariTts() {
    hariTtsEnabled = !hariTtsEnabled;
    try {
        localStorage.setItem('hari_tts_enabled', hariTtsEnabled ? 'true' : 'false');
    } catch(e) {}
    updateHariTtsButtonState();
    if (hariTtsEnabled) {
        showToast('Voice Output', 'HARI voice audio enabled', 'success');
        speakHariText('HARI voice synthesizer enabled.');
    } else {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        showToast('Voice Output', 'HARI voice audio disabled', 'info');
    }
}
window.toggleHariTts = toggleHariTts;

function updateHariTtsButtonState() {
    const btn = document.getElementById('btnHariTtsToggle');
    const label = document.getElementById('labelHariTts');
    if (!btn) return;
    if (hariTtsEnabled) {
        btn.classList.add('bg-indigo-600/30', 'text-indigo-300', 'border-indigo-500/50');
        btn.classList.remove('bg-gray-900/80', 'text-gray-300');
        if (label) label.textContent = 'Voice: On';
    } else {
        btn.classList.remove('bg-indigo-600/30', 'text-indigo-300', 'border-indigo-500/50');
        btn.classList.add('bg-gray-900/80', 'text-gray-300');
        if (label) label.textContent = 'Voice: Off';
    }
}

function speakHariText(text) {
    if (!window.speechSynthesis || !hariTtsEnabled) return;
    window.speechSynthesis.cancel();

    // Strip code blocks and markdown symbols for clean speech
    const cleanSpeech = text
        .replace(/```[\s\S]*?```/g, 'Code snippet omitted.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*#_~>\[\]]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .slice(0, 400); // limit speech length

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

// 26. Markdown & String Helpers
function escapeHariHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeHariAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/"/g, '&quot;')
        .replace(/'/g, "\\'")
        .replace(/[\n\r]/g, ' ');
}

function renderMarkdownSafely(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        try {
            return marked.parse(text);
        } catch(e) {
            console.warn('[HARI] Marked error, using fallback parser:', e);
        }
    }

    // High-Fidelity Custom Markdown Parser (Fallback)
    let escaped = escapeHariHtml(text);

    // Code blocks with syntax copy header
    escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return '<div class="relative my-3 rounded-xl overflow-hidden border border-indigo-500/30 bg-gray-950 font-mono text-xs">' +
            '<div class="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-gray-400 text-[10px]">' +
                '<span class="font-bold text-indigo-400 uppercase">' + (lang || 'code') + '</span>' +
                '<button type="button" onclick="copyHariCodeBlock(this)" class="hover:text-white flex items-center gap-1 transition-colors">' +
                    '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
                    '<span>Copy</span>' +
                '</button>' +
            '</div>' +
            '<pre class="p-3 overflow-x-auto text-emerald-400 leading-relaxed"><code>' + code.trim() + '</code></pre>' +
        '</div>';
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-pink-400 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
    // Bold
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    // Italic
    escaped = escaped.replace(/\*(.*?)\*/g, '<em class="text-indigo-200">$1</em>');
    // Headers
    escaped = escaped.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-indigo-300 mt-3 mb-1">$1</h3>');
    escaped = escaped.replace(/^## (.*$)/gim, '<h2 class="text-base font-extrabold text-white mt-4 mb-2 pb-1 border-b border-gray-800">$1</h2>');
    escaped = escaped.replace(/^# (.*$)/gim, '<h1 class="text-lg font-black text-white mt-4 mb-2 pb-1 border-b border-indigo-500/40">$1</h1>');
    // Lists
    escaped = escaped.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-gray-300 my-0.5">$1</li>');
    escaped = escaped.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-gray-300 my-0.5">$1</li>');
    // Blockquote
    escaped = escaped.replace(/^>\s+(.*$)/gim, '<blockquote class="border-l-2 border-indigo-500 pl-3 py-1 my-2 text-gray-400 italic bg-indigo-950/20 rounded-r">$1</blockquote>');
    // Newlines
    escaped = escaped.replace(/\n/g, '<br/>');

    return escaped;
}
