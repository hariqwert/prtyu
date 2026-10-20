import crypto from 'crypto';
import axios from 'axios';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, getClientIp } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');

interface AttemptRecord {
    count: number;
    firstAttemptAt: number;
    lastAttemptAt: number;
    lockedUntil?: number;
}

// In-memory sliding window failure tracking
const ipAttempts = new Map<string, AttemptRecord>();

// Max failed attempts before lockout
const MAX_ATTEMPTS = 5;
// Window for failed attempts (15 minutes)
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
// Lockout duration (15 minutes)
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export class SecurityGateKeeper {
    /**
     * Checks if an IP is currently locked out
     */
    static isIpLockedOut(ip: string): { locked: boolean; remainingSeconds: number } {
        const cleanIp = (ip || '').replace('::ffff:', '').trim();
        const record = ipAttempts.get(cleanIp);
        if (!record) return { locked: false, remainingSeconds: 0 };

        const now = Date.now();
        if (record.lockedUntil && record.lockedUntil > now) {
            const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            return { locked: true, remainingSeconds };
        }

        // If lockout expired, reset
        if (record.lockedUntil && record.lockedUntil <= now) {
            ipAttempts.delete(cleanIp);
            return { locked: false, remainingSeconds: 0 };
        }

        // Check if window has expired
        if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
            ipAttempts.delete(cleanIp);
            return { locked: false, remainingSeconds: 0 };
        }

        return { locked: false, remainingSeconds: 0 };
    }

    /**
     * Records a failed attempt for an IP across any gate
     */
    static recordFailure(ip: string, action: string, identifier?: string): { attempts: number; isLockedOut: boolean; lockoutSeconds: number } {
        const cleanIp = (ip || '').replace('::ffff:', '').trim();
        const now = Date.now();
        let record = ipAttempts.get(cleanIp);

        if (!record || (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && !record.lockedUntil)) {
            record = {
                count: 1,
                firstAttemptAt: now,
                lastAttemptAt: now
            };
        } else {
            record.count += 1;
            record.lastAttemptAt = now;
        }

        if (record.count >= MAX_ATTEMPTS) {
            record.lockedUntil = now + LOCKOUT_DURATION_MS;
            ipAttempts.set(cleanIp, record);

            // Persist security incident in DB
            try {
                if (fs.existsSync(DB_FILE)) {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    if (!db.incidents) db.incidents = [];
                    db.incidents.unshift({
                        ip: cleanIp,
                        username: identifier || action,
                        timestamp: now,
                        reason: `Brute Force: ${record.count} Failed Attempts on ${action} (Locked out for 15 min)`
                    });
                    if (db.incidents.length > 50) db.incidents = db.incidents.slice(0, 50);
                    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4), 'utf8');
                }
            } catch (err) {
                console.error('[GATE-KEEPER] Failed to save incident to DB:', err);
            }

            console.error(`[CITADEL SECURITY] IP ${cleanIp} has exceeded ${MAX_ATTEMPTS} failed attempts on ${action}. LOCKED OUT for 15 minutes.`);
            return { attempts: record.count, isLockedOut: true, lockoutSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
        }

        ipAttempts.set(cleanIp, record);
        return { attempts: record.count, isLockedOut: false, lockoutSeconds: 0 };
    }

    /**
     * Clears failure count on successful authentication
     */
    static recordSuccess(ip: string): void {
        const cleanIp = (ip || '').replace('::ffff:', '').trim();
        ipAttempts.delete(cleanIp);
    }

    /**
     * Enforces artificial progressive delay to throttle brute-force attacks
     */
    static async applyProgressiveDelay(attempts: number): Promise<void> {
        if (attempts <= 0) return;
        const delayMs = Math.min(attempts * 400, 3000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    /**
     * Constant-time comparison to protect against timing attacks
     */
    static constantTimeCompare(a: string, b: string): boolean {
        if (!a || !b) return false;
        try {
            const bufA = crypto.createHash('sha256').update(String(a)).digest();
            const bufB = crypto.createHash('sha256').update(String(b)).digest();
            return crypto.timingSafeEqual(bufA, bufB);
        } catch {
            return false;
        }
    }

    /**
     * Checks if Cloudflare Turnstile secret key is configured
     */
    static isTurnstileConfigured(): boolean {
        let turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
        if (!turnstileSecret) {
            try {
                if (fs.existsSync(DB_FILE)) {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    turnstileSecret = db.turnstileSecretKey || '';
                }
            } catch (e) {}
        }
        return Boolean(turnstileSecret);
    }

    /**
     * Retrieves the Cloudflare Turnstile site key
     */
    static getTurnstileSiteKey(): string {
        let turnstileSite = process.env.TURNSTILE_SITE_KEY || '';
        if (!turnstileSite) {
            try {
                if (fs.existsSync(DB_FILE)) {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    turnstileSite = db.turnstileSiteKey || '';
                }
            } catch (e) {}
        }
        return turnstileSite || '0x4AAAAAAFaGaW8aie8qWpaS';
    }

    /**
     * Verifies Turnstile CAPTCHA response with Cloudflare siteverify endpoint
     */
    static async verifyTurnstile(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
        let turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
        if (!turnstileSecret) {
            try {
                if (fs.existsSync(DB_FILE)) {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    turnstileSecret = db.turnstileSecretKey || '';
                }
            } catch (e) {}
        }

        // If Turnstile secret key is not configured, pass without requiring dummy test key
        if (!turnstileSecret) {
            return { success: true };
        }

        if (!token) {
            return { success: false, error: 'CAPTCHA response token is required.' };
        }

        try {
            const formData = new URLSearchParams();
            formData.append('secret', turnstileSecret);
            formData.append('response', token);
            if (remoteIp) formData.append('remoteip', remoteIp);

            const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000
            });

            if (verifyRes.data && verifyRes.data.success === true) {
                return { success: true };
            }

            console.warn('[SECURITY] Turnstile verification failed from Cloudflare:', verifyRes.data);
            return { success: false, error: 'Cloudflare CAPTCHA verification failed. Please complete the challenge again.' };
        } catch (e: any) {
            console.error('[SECURITY] Turnstile siteverify network error:', e.message);
            // In development offline fallback only
            if (process.env.NODE_ENV !== 'production' && (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT')) {
                console.log('[AUTH-INFO] Permitting Turnstile check in offline local dev mode');
                return { success: true };
            }
            return { success: false, error: 'Could not reach Cloudflare verification server. Please try again.' };
        }
    }

    /**
     * Strictly verifies Gate 1 authorization (Perimeter Clearance)
     */
    static verifyGate1(req: Request): { valid: boolean; ip?: string } {
        const clientIp = getClientIp(req);
        const cookieHeader = req.headers.cookie || '';
        let token = '';

        // Check header first
        const headerToken = req.headers['x-gate-token'] as string;
        if (headerToken) {
            token = headerToken;
        } else if (cookieHeader) {
            const cookies = cookieHeader.split(';').reduce((acc, c) => {
                const idx = c.indexOf('=');
                if (idx > -1) {
                    const name = c.substring(0, idx).trim();
                    const val = c.substring(idx + 1).trim();
                    acc[name] = decodeURIComponent(val);
                }
                return acc;
            }, {} as Record<string, string>);
            token = cookies.admin_gate_auth || '';
        }

        if (!token) return { valid: false };

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            if (decoded && decoded.role === 'perimeter_cleared') {
                if (!decoded.ip || decoded.ip === clientIp || clientIp === '127.0.0.1' || decoded.ip === '127.0.0.1') {
                    return { valid: true, ip: decoded.ip };
                }
            }
            return { valid: false };
        } catch {
            return { valid: false };
        }
    }
}
