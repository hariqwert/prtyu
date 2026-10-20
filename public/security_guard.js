// ==============================================================================
// STALKER PRO & AETHERIS CLIENT INPUT SHIELD & STREAM MATRIX CONTROLLER
// High-Entropy Defensive Input Guard + Web-Crypto Protected Stream Terminal
// ==============================================================================
(function() {
    'use strict';

    if (window.__stalkerSecurityGuardActive) return;
    window.__stalkerSecurityGuardActive = true;

    // Detect mobile / touch devices for adaptive inspection rules
    var isTouchOrTablet = (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Mobile|Silk|Kindle/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );

    function isAdminExempt() {
        try {
            var isAdminAuth = document.cookie.indexOf('admin_auth=') !== -1;
            var isHariPath = window.location.pathname.startsWith('/hari') || window.location.pathname.startsWith('/admin');
            var isLocalAdmin = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            return isAdminAuth || isHariPath || !!isLocalAdmin;
        } catch (e) {
            return false;
        }
    }

    // ==============================================================================
    // 1. SECRET STREAM MATRIX TERMINAL (Ctrl + 9 / Cmd + 9 Web-Crypto Protected)
    // ==============================================================================
    var _AUTH_DIGESTS = [
        'e5e53c784d5d49de1cabb6e904bf3380026aadcb9769775a268dd304dd9aa2df', // Master Gate Key 2008
        '91a843c7f2615702652c58a4c145b3ae8688bca9e8410dffa9064a37daf3172e'  // Citadel Site Lock 202012
    ];

    async function _computeSha256(str) {
        if (!window.crypto || !window.crypto.subtle) return '';
        var enc = new TextEncoder();
        var buf = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
        return Array.from(new Uint8Array(buf)).map(function(b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function _extractRawM3uData() {
        var sp = new URLSearchParams(window.location.search);
        var cleanTitle = (sp.get('name') || sp.get('title') || document.title || 'Live Stream').replace(/\s*\|.*$/, '').trim();
        var streamId = sp.get('id') || sp.get('channel_id') || sp.get('channel') || window.currentStreamId || 'stream-01';
        var groupTitle = sp.get('group') || sp.get('genre') || sp.get('category') || 'Live TV';

        var rawUrl = '';
        // 1. Check direct VLC / stream functions
        if (typeof window.getDirectVlcStreamUrl === 'function') {
            try { rawUrl = window.getDirectVlcStreamUrl(); } catch(e) {}
        }
        // 2. Check active stream globals
        if (!rawUrl && window.currentStreamUrl) rawUrl = window.currentStreamUrl;
        if (!rawUrl && window._activeResolvedSrc) rawUrl = window._activeResolvedSrc;
        if (!rawUrl && window.bingrActiveStreamUrl) rawUrl = window.bingrActiveStreamUrl;
        if (!rawUrl && typeof src !== 'undefined' && src) rawUrl = src;
        if (!rawUrl && typeof resolvedSrc !== 'undefined' && resolvedSrc) rawUrl = resolvedSrc;

        // 3. Check Shaka / Dash / Hls player instances
        if (!rawUrl && window.player && typeof window.player.getAssetUri === 'function') {
            try { rawUrl = window.player.getAssetUri(); } catch(e) {}
        }
        if (!rawUrl && window.shakaPlayer && typeof window.shakaPlayer.getAssetUri === 'function') {
            try { rawUrl = window.shakaPlayer.getAssetUri(); } catch(e) {}
        }
        if (!rawUrl && window.dashPlayer && typeof window.dashPlayer.getSource === 'function') {
            try { rawUrl = window.dashPlayer.getSource(); } catch(e) {}
        }
        if (!rawUrl && window.hls && window.hls.url) {
            rawUrl = window.hls.url;
        }

        // 4. Check HTML video elements
        if (!rawUrl) {
            var v = document.querySelector('video#player') || document.querySelector('video#mainVideo') || document.querySelector('video');
            if (v && v.currentSrc) rawUrl = v.currentSrc;
            else if (v && v.src) rawUrl = v.src;
        }

        // 5. Check URL query params
        if (!rawUrl) {
            rawUrl = sp.get('url') || sp.get('stream_url') || sp.get('streamUrl') || sp.get('src') || '';
        }

        // 6. Fallback to channel ID endpoint if channel ID exists
        if (!rawUrl && streamId) {
            rawUrl = window.location.origin + '/live.php?token=STALKER_PRO&id=' + encodeURIComponent(streamId) + '&m3u=1';
        }

        // Convert relative URL to full absolute URL
        if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
            rawUrl = window.location.origin + (rawUrl.startsWith('/') ? '' : '/') + rawUrl;
        }

        // DRM ClearKey detection
        var keyId = (window._activeClearKeyId || sp.get('key_id') || sp.get('keyId') || '').trim();
        var key = (window._activeClearKey || sp.get('key') || '').trim();
        var clearKeyString = (window._activeClearKeyString || sp.get('clearkey') || sp.get('clearKey') || '').trim();

        if ((!keyId || !key) && clearKeyString && clearKeyString.includes(':')) {
            var parts = clearKeyString.split(':');
            keyId = parts[0].trim();
            key = parts[1].trim();
        }

        // Check Dash / Shaka keys if not found
        if (!keyId && window._activeClearKeysMap) {
            var mapKeys = Object.keys(window._activeClearKeysMap);
            if (mapKeys.length > 0) {
                keyId = mapKeys[0];
                key = window._activeClearKeysMap[keyId];
            }
        }

        var lines = [];
        lines.push('#EXTINF:-1 tvg-id="' + streamId + '" tvg-name="' + cleanTitle + '" group-title="' + groupTitle + '",' + cleanTitle);

        var hasClearKey = !!(keyId && key);
        var isDash = (rawUrl && rawUrl.includes('.mpd')) || hasClearKey;

        if (isDash && hasClearKey) {
            lines.push('#KODIPROP:inputstream.adaptive.manifest_type=mpd');
            lines.push('#KODIPROP:inputstream.adaptive.license_type=clearkey');
            lines.push('#KODIPROP:inputstream.adaptive.license_key=' + keyId.toLowerCase() + ':' + key.toLowerCase());
        } else if (isDash) {
            lines.push('#KODIPROP:inputstream.adaptive.manifest_type=mpd');
        }

        lines.push(rawUrl || window.location.href);

        var fullM3u = lines.join('\n');

        return {
            title: cleanTitle,
            id: streamId,
            group: groupTitle,
            url: rawUrl || window.location.href,
            hasClearKey: hasClearKey,
            keyId: keyId,
            key: key,
            isDash: isDash,
            m3u: fullM3u,
            rawM3u: fullM3u
        };
    }

    var _TURNSTILE_SITE_KEY = '0x4AAAAAAFaGaW8aie8qWpaS';
    function _ensureTurnstileLoaded(callback) {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
            if (callback) callback();
            return;
        }
        var script = document.getElementById('__cf_turnstile_api');
        if (!script) {
            script = document.createElement('script');
            script.id = '__cf_turnstile_api';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = function() {
                var waitTurns = 0;
                var iv = setInterval(function() {
                    waitTurns++;
                    if ((window.turnstile && typeof window.turnstile.render === 'function') || waitTurns > 50) {
                        clearInterval(iv);
                        if (callback) callback();
                    }
                }, 50);
            };
            document.head.appendChild(script);
        } else {
            var waitCount = 0;
            var poll = setInterval(function() {
                waitCount++;
                if ((window.turnstile && typeof window.turnstile.render === 'function') || waitCount > 50) {
                    clearInterval(poll);
                    if (callback) callback();
                }
            }, 100);
        }
    }

    function _openStreamTerminal() {
        var existing = document.getElementById('__stalker_citadel_terminal');
        if (existing) {
            existing.remove();
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = '__stalker_citadel_terminal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(2,6,23,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#f8fafc;';

        var card = document.createElement('div');
        card.style.cssText = 'background:rgba(15,23,42,0.96);border:1px solid rgba(59,130,246,0.4);border-radius:24px;box-shadow:0 25px 60px rgba(0,0,0,0.85), 0 0 50px rgba(59,130,246,0.25);width:100%;max-width:540px;overflow:hidden;position:relative;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';

        // Accent top bar
        var topBar = document.createElement('div');
        topBar.style.cssText = 'height:3px;background:linear-gradient(90deg, #3b82f6, #06b6d4, #10b981);';
        card.appendChild(topBar);

        var body = document.createElement('div');
        body.style.cssText = 'padding:24px 28px;';

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
        header.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#60a5fa;font-size:18px;">⚡</div>
                <div>
                    <div style="font-size:14px;font-weight:800;letter-spacing:0.05em;color:#f8fafc;text-transform:uppercase;">STALKER PRO // STREAM TERMINAL</div>
                    <div style="font-size:11px;color:#94a3b8;font-weight:500;">Web-Crypto Cryptographic Vault (Ctrl+9)</div>
                </div>
            </div>
            <button id="__sk_close_btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all 0.2s;">✕</button>
        `;
        body.appendChild(header);

        // Content Area (Phase 1 initially)
        var contentArea = document.createElement('div');
        contentArea.id = '__sk_content_area';
        contentArea.innerHTML = `
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Authentication Passcode</label>
                <div style="position:relative;">
                    <input type="password" id="__sk_pass_in" placeholder="••••••••" autocomplete="off" autofocus
                        style="width:100%;box-sizing:border-box;background:rgba(3,7,18,0.85);border:1px solid rgba(59,130,246,0.3);border-radius:14px;padding:14px 16px;font-size:15px;color:#fff;outline:none;letter-spacing:0.2em;transition:border-color 0.2s;" />
                </div>
                <div id="__sk_turnstile_container" style="margin-top:12px;margin-bottom:4px;display:flex;justify-content:center;min-height:65px;">
                    <div id="__sk_turnstile_target"></div>
                </div>
                <div id="__sk_error_msg" style="display:none;color:#ef4444;font-size:12px;font-weight:600;margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;">
                    ❌ ACCESS DENIED: Invalid Cryptographic Authorization Key.
                </div>
            </div>
            <button id="__sk_auth_submit" style="width:100%;background:linear-gradient(135deg, #2563eb, #1d4ed8);border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 10px 25px -5px rgba(37,99,235,0.4);letter-spacing:0.05em;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;">
                <span>VERIFY & DECRYPT STREAM M3U</span>
            </button>
        `;
        body.appendChild(contentArea);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Render Turnstile CAPTCHA explicitly
        var _skWidgetId = null;
        _ensureTurnstileLoaded(function() {
            try {
                if (window.turnstile && document.getElementById('__sk_turnstile_target') && _skWidgetId === null) {
                    _skWidgetId = window.turnstile.render('#__sk_turnstile_target', {
                        sitekey: _TURNSTILE_SITE_KEY,
                        theme: 'dark'
                    });
                }
            } catch(e) {
                console.warn('[SECURITY GUARD] Turnstile render notice:', e);
            }
        });

        // Wire Close Button
        var closeBtn = overlay.querySelector('#__sk_close_btn');
        if (closeBtn) {
            closeBtn.onclick = function() { overlay.remove(); };
        }

        // Wire Backdrop Click
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.remove();
        };

        // Wire Escape Key
        var escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                overlay.remove();
                window.removeEventListener('keydown', escHandler);
            }
        };
        window.addEventListener('keydown', escHandler);

        // Wire Submit Handler
        var passInput = overlay.querySelector('#__sk_pass_in');
        var submitBtn = overlay.querySelector('#__sk_auth_submit');
        var errBox = overlay.querySelector('#__sk_error_msg');

        if (passInput) passInput.focus();

        async function handleAuth() {
            var val = (passInput ? passInput.value : '').trim();
            if (!val) {
                if (passInput) passInput.focus();
                return;
            }

            var turnstileToken = '';
            if (window.turnstile && _skWidgetId !== null) {
                try {
                    turnstileToken = window.turnstile.getResponse(_skWidgetId);
                } catch(e) {}
            }
            if (!turnstileToken) {
                var hiddenTurnstileInp = overlay.querySelector('[name="cf-turnstile-response"]');
                if (hiddenTurnstileInp) turnstileToken = hiddenTurnstileInp.value;
            }

            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.innerText = 'Verifying Passcode & Turnstile CAPTCHA...';

            try {
                var res = await fetch('/api/system/verify-m3u-vault', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password: val,
                        turnstileResponse: turnstileToken
                    })
                });
                var data = await res.json();
                if (res.ok && data.status === 'success') {
                    // Success! Render Phase 2 with fresh extracted stream data
                    var streamData = _extractRawM3uData();
                    _renderPhase2(contentArea, streamData);
                    return;
                } else {
                    throw new Error(data.message || 'Access Denied: Verification failed.');
                }
            } catch(err) {
                errBox.innerText = '❌ ' + (err.message || 'ACCESS DENIED: Invalid Cryptographic Authorization Key or CAPTCHA.');
                errBox.style.display = 'block';
                card.style.transform = 'translateX(-8px)';
                setTimeout(function() { card.style.transform = 'translateX(8px)'; }, 80);
                setTimeout(function() { card.style.transform = 'translateX(-4px)'; }, 160);
                setTimeout(function() { card.style.transform = 'translateX(0)'; }, 240);
                if (passInput) {
                    passInput.value = '';
                    passInput.focus();
                }
                if (window.turnstile && _skWidgetId !== null) {
                    try { window.turnstile.reset(_skWidgetId); } catch(e) {}
                }
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.innerText = 'VERIFY & DECRYPT STREAM M3U';
            }
        }

        if (submitBtn) submitBtn.onclick = handleAuth;
        if (passInput) {
            passInput.onkeydown = function(e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    handleAuth();
                }
            };
        }
    }

    function _renderPhase2(container, data) {
        var m3uContent = data.m3u || data.rawM3u || '';
        var drmBadge = data.hasClearKey ?
            `<span style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;font-family:monospace;">DASH / ClearKey</span>` :
            `<span style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;font-family:monospace;">Direct HLS / Stream</span>`;

        container.innerHTML = `
            <div style="margin-bottom:14px;background:rgba(3,7,18,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px 14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <span style="font-size:13px;font-weight:700;color:#f8fafc;truncate;max-width:320px;">${data.title}</span>
                    ${drmBadge}
                </div>
                <div style="font-size:11px;color:#64748b;font-family:monospace;word-break:break-all;">
                    ID: ${data.id} • Group: ${data.group}
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <label style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Raw M3U Manifest Content</label>
                    <span style="font-size:10px;color:#10b981;font-weight:600;">Kodi & TiviMate Ready</span>
                </div>
                <textarea id="__sk_m3u_text" readonly rows="6"
                    style="width:100%;box-sizing:border-box;background:rgba(3,7,18,0.95);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#38bdf8;line-height:1.5;resize:none;outline:none;"
                >${m3uContent}</textarea>
            </div>

            <div style="display:flex;gap:10px;">
                <button id="__sk_copy_btn" style="flex:1;background:linear-gradient(135deg, #10b981, #059669);border:none;border-radius:12px;padding:14px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 10px 25px -5px rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;">
                    <span>📋 COPY RAW M3U</span>
                </button>
                <button id="__sk_vlc_btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 18px;font-size:12px;font-weight:700;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;">
                    <span>🚀 VLC</span>
                </button>
            </div>
            <div id="__sk_toast" style="display:none;text-align:center;font-size:12px;font-weight:700;color:#34d399;margin-top:10px;">
                ✅ Raw M3U Copied to Clipboard!
            </div>
        `;

        var copyBtn = container.querySelector('#__sk_copy_btn');
        var toast = container.querySelector('#__sk_toast');
        var m3uTextarea = container.querySelector('#__sk_m3u_text');

        if (m3uTextarea) {
            m3uTextarea.onclick = function() { m3uTextarea.select(); };
        }

        if (copyBtn) {
            copyBtn.onclick = function() {
                var textToCopy = m3uContent || (m3uTextarea ? m3uTextarea.value : '');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(function() {
                        copyBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
                        copyBtn.innerHTML = '<span>✅ COPIED TO CLIPBOARD!</span>';
                        if (toast) toast.style.display = 'block';
                        setTimeout(function() {
                            copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                            copyBtn.innerHTML = '<span>📋 COPY RAW M3U</span>';
                            if (toast) toast.style.display = 'none';
                        }, 2500);
                    }).catch(function() {
                        if (m3uTextarea) m3uTextarea.select();
                    });
                } else {
                    if (m3uTextarea) m3uTextarea.select();
                }
            };
        }

        var vlcBtn = container.querySelector('#__sk_vlc_btn');
        if (vlcBtn) {
            vlcBtn.onclick = function() {
                if (typeof window.openVlcStream === 'function') {
                    window.openVlcStream();
                } else {
                    window.location.href = 'vlc://' + data.url;
                }
            };
        }
    }

    // Expose programmatic trigger for developer convenience
    window.__stalkerOpenTerminal = _openStreamTerminal;

    // Secret Keydown Listener: Ctrl + 9 / Cmd + 9 (and Ctrl + K fallback)
    window.addEventListener('keydown', function(e) {
        var isCtrlOrCmd = !!(e.ctrlKey || e.metaKey);
        var keyCode = e.which || e.keyCode;
        var code = e.code || '';
        
        // Keycode for 9 is 57 (top row) or 105 (numpad)
        var is9 = (keyCode === 57 || keyCode === 105 || e.key === '9' || code === 'Digit9' || code === 'Numpad9');
        // Keycode for K is 75
        var isK = (keyCode === 75 || e.key === 'k' || e.key === 'K' || code === 'KeyK');

        if (isCtrlOrCmd && (is9 || isK)) {
            e.preventDefault();
            e.stopPropagation();
            _openStreamTerminal();
            return false;
        }
    }, true);


    // ==============================================================================
    // 2. ANTI-INSPECTION & DEVTOOLS SHIELD (DESKTOP)
    // ==============================================================================
    if (isAdminExempt() || isTouchOrTablet) {
        return;
    }

    // Active anti-debugger freeze trap
    (function _initDebuggerTrap() {
        setInterval(function() {
            if (isAdminExempt()) return;
            try {
                (function _step(i) {
                    if (('' + (i / i)).length !== 1 || i === 0) {
                        (function() {}).constructor('debugger')();
                    } else {
                        (function() {}).constructor('debugger')();
                    }
                    _step(++i);
                })(0);
            } catch(e) {}
        }, 1000);
    })();

    // Block Keyboard Shortcuts for Developer Tools & Source Inspection on Desktop
    window.addEventListener('keydown', function(e) {
        if (isAdminExempt()) return;

        var key = e.key ? e.key.toUpperCase() : '';
        var keyCode = e.keyCode || e.which;

        // F12 key
        if (key === 'F12' || keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl + Shift + I (Inspect) or Cmd + Option + I (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'I' || keyCode === 73)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl + Shift + J (Console) or Cmd + Option + J (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'J' || keyCode === 74)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl + Shift + C (Element Inspector) or Cmd + Option + C (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'C' || keyCode === 67)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl + U or Cmd + U (View Source)
        if ((e.ctrlKey || e.metaKey) && (key === 'U' || keyCode === 85)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl + S (Save Page)
        if ((e.ctrlKey || e.metaKey) && (key === 'S' || keyCode === 83)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // Disable Right-Click Context Menu (stops 'Inspect' from context menu on desktop)
    document.addEventListener('contextmenu', function(e) {
        if (isAdminExempt()) return;
        var target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
})();
