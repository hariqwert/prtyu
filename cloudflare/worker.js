/**
 * ===================================================================================
 * CLOUDFLARE WORKER: CITADEL EDGE SECURITY SHIELD
 * ===================================================================================
 * Capabilities:
 *  1. Malicious Bot & Vulnerability Scanner Blocking (CVE probes, sqlmap, bad UAs)
 *  2. Edge-Tier Sliding Window Rate Limiting (Admin, Media Scrapers, Proxy Endpoints)
 *  3. Cross-Site Scraping / Leeching Neutralization (Sec-Fetch-Site checks)
 *  4. Sensitive Path Shielding (.git, .env, wp-login, etc.)
 *  5. Origin Shielding & Header Hardening
 * ===================================================================================
 */

// --- CONFIGURATION ---
const CONFIG = {
    // Upstream Google AI Studio hosting origin
    ORIGIN_HOST: "ellamoonu.ai.studio", 
    ORIGIN_PROTOCOL: "https:",

    // Rate Limits (Requests per minute per client IP)
    RATE_LIMITS: {
        ADMIN: { limit: 20, windowMs: 60 * 1000 },       // /api/admin/*, /hari, /admin
        MEDIA_SCRAPER: { limit: 60, windowMs: 60 * 1000 },// /api/bingr/*
        STREAMS: { limit: 400, windowMs: 60 * 1000 },     // /live.php, /stream_proxy.php
        DEFAULT: { limit: 120, windowMs: 60 * 1000 }      // All other public traffic
    },

    // Known bad user agent patterns
    BLOCKED_USER_AGENTS: [
        /sqlmap/i,
        /nikto/i,
        /masscan/i,
        /acunetix/i,
        /havij/i,
        /zgrab/i,
        /censys/i,
        /shodan/i,
        /nmap/i,
        /dirbuster/i,
        /gobuster/i,
        /wpscan/i
    ],

    // Probed vulnerability paths that should be blocked instantly at the edge
    SHIELDED_PATHS: [
        /\/\.env/i,
        /\/\.git/i,
        /\/\.svn/i,
        /\/wp-admin/i,
        /\/wp-login\.php/i,
        /\/xmlrpc\.php/i,
        /\/phpmyadmin/i,
        /\/pma/i,
        /\/admin\/config\.php/i,
        /\/eval-stdin\.php/i,
        /\/boaform/i,
        /\/HNAP1/i
    ]
};

// In-memory sliding window cache per worker isolate
const rateLimitMap = new Map();

// Periodic cleanup of stale rate-limit records
function cleanupRateLimits() {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}

/**
 * Checks sliding-window rate limit for a client IP and category
 */
function checkRateLimit(ip, category, rule) {
    const now = Date.now();
    const key = `${category}:${ip}`;
    let record = rateLimitMap.get(key);

    if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + rule.windowMs };
        rateLimitMap.set(key, record);
        return { allowed: true, remaining: rule.limit - 1 };
    }

    record.count++;
    if (record.count > rule.limit) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    return { allowed: true, remaining: rule.limit - record.count };
}

export default {
    async fetch(request, env, ctx) {
        // Trigger lazy cleanup periodically
        if (Math.random() < 0.05) {
            cleanupRateLimits();
        }

        const url = new URL(request.url);
        const path = url.pathname.toLowerCase();
        const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
        const userAgent = request.headers.get('User-Agent') || '';
        const fetchSite = request.headers.get('Sec-Fetch-Site') || '';

        // 1. SENSITIVE PATH PROBE SHIELD
        for (const regex of CONFIG.SHIELDED_PATHS) {
            if (regex.test(path)) {
                return new Response(JSON.stringify({
                    status: 'error',
                    message: 'Forbidden: Security Probe Blocked by Cloudflare Edge'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 2. BAD BOT & SCANNER USER-AGENT CHECK
        for (const uaRegex of CONFIG.BLOCKED_USER_AGENTS) {
            if (uaRegex.test(userAgent)) {
                return new Response(JSON.stringify({
                    status: 'error',
                    message: 'Access Denied: Malicious Automated User-Agent Blocked'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 3. CROSS-SITE MEDIA SCRAPER PROTECTION (CSRF / Anti-Leech)
        if (path.startsWith('/api/bingr/stream') || path.startsWith('/api/bingr/scrape')) {
            if (fetchSite === 'cross-site') {
                const origin = request.headers.get('Origin') || '';
                const referer = request.headers.get('Referer') || '';
                const host = url.host;
                const isSelf = (origin && origin.includes(host)) || (referer && referer.includes(host));
                if (!isSelf) {
                    return new Response(JSON.stringify({
                        status: 'error',
                        message: 'Forbidden: Cross-site API leeching blocked by Cloudflare Edge'
                    }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        // 4. EDGE RATE LIMITING
        let category = 'DEFAULT';
        let rule = CONFIG.RATE_LIMITS.DEFAULT;

        if (path.startsWith('/api/admin') || path === '/hari' || path === '/admin') {
            category = 'ADMIN';
            rule = CONFIG.RATE_LIMITS.ADMIN;
        } else if (path.startsWith('/api/bingr')) {
            category = 'MEDIA_SCRAPER';
            rule = CONFIG.RATE_LIMITS.MEDIA_SCRAPER;
        } else if (path === '/live.php' || path === '/stream_proxy.php') {
            category = 'STREAMS';
            rule = CONFIG.RATE_LIMITS.STREAMS;
        }

        const rateCheck = checkRateLimit(clientIp, category, rule);
        if (!rateCheck.allowed) {
            return new Response(JSON.stringify({
                status: 'error',
                message: `Too Many Requests: Rate limit exceeded on ${category}. Please retry after ${rateCheck.retryAfter} seconds.`,
                retryAfter: rateCheck.retryAfter
            }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(rateCheck.retryAfter),
                    'X-RateLimit-Limit': String(rule.limit),
                    'X-RateLimit-Remaining': '0'
                }
            });
        }

        // 5. CONSTRUCT ORIGIN REQUEST
        let targetUrl = new URL(request.url);
        if (CONFIG.ORIGIN_HOST) {
            targetUrl.hostname = CONFIG.ORIGIN_HOST;
            targetUrl.protocol = CONFIG.ORIGIN_PROTOCOL || 'https:';
            targetUrl.port = '';
        }

        // Clone and sanitize headers to send to origin
        const forwardHeaders = new Headers(request.headers);
        if (CONFIG.ORIGIN_HOST) {
            forwardHeaders.set('Host', CONFIG.ORIGIN_HOST);
        }
        forwardHeaders.set('X-Forwarded-Host', url.host);
        forwardHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
        forwardHeaders.set('X-Forwarded-For', clientIp);
        forwardHeaders.set('X-Real-IP', clientIp);
        forwardHeaders.set('CF-Edge-Protected', 'true');

        const newRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: forwardHeaders,
            body: request.body,
            redirect: 'manual'
        });

        // 6. FETCH FROM ORIGIN & INJECT SECURITY RESPONSE HEADERS
        try {
            const originResponse = await fetch(newRequest);
            const responseHeaders = new Headers(originResponse.headers);

            // Rewrite Location header in redirects so visitor stays on Cloudflare domain/Worker
            if (responseHeaders.has('Location')) {
                let loc = responseHeaders.get('Location');
                if (loc && loc.includes(CONFIG.ORIGIN_HOST)) {
                    loc = loc.replace(new RegExp(`https?://${CONFIG.ORIGIN_HOST}`, 'g'), `${url.protocol}//${url.host}`);
                    responseHeaders.set('Location', loc);
                }
            }

            // Hardened Edge Security Headers
            responseHeaders.set('X-Edge-Firewall', 'Cloudflare-Citadel-v2');
            responseHeaders.set('X-Content-Type-Options', 'nosniff');
            responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

            // Set rate limit info header
            responseHeaders.set('X-RateLimit-Limit', String(rule.limit));
            responseHeaders.set('X-RateLimit-Remaining', String(rateCheck.remaining));

            return new Response(originResponse.body, {
                status: originResponse.status,
                statusText: originResponse.statusText,
                headers: responseHeaders
            });
        } catch (err) {
            return new Response(JSON.stringify({
                status: 'error',
                message: 'Origin Gateway Error: Unable to reach upstream server.',
                detail: err.message
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};
