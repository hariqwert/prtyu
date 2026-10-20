import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface BoundDevice {
    deviceId: string;
    deviceLabel: string;
    deviceFingerprint: string;
    publicKey?: string;
    ip: string;
    userAgent: string;
    firstBoundAt: number;
    lastSeenAt: number;
    status: 'authorized' | 'revoked';
}

const BOUND_DEVICES_FILE = path.join(process.cwd(), 'doctor_strange', 'bound_devices.json');

// In-memory cache of bound devices
let boundDevicesMap = new Map<string, BoundDevice>();

function loadBoundDevices(): void {
    try {
        if (!fs.existsSync(BOUND_DEVICES_FILE)) {
            const dir = path.dirname(BOUND_DEVICES_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(BOUND_DEVICES_FILE, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const data = JSON.parse(fs.readFileSync(BOUND_DEVICES_FILE, 'utf8'));
        if (Array.isArray(data)) {
            boundDevicesMap.clear();
            for (const d of data) {
                if (d && d.deviceId) {
                    boundDevicesMap.set(d.deviceId, d);
                }
            }
        }
    } catch (e) {
        boundDevicesMap = new Map();
    }
}

function persistBoundDevices(): void {
    try {
        const arr = Array.from(boundDevicesMap.values());
        fs.writeFileSync(BOUND_DEVICES_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {}
}

loadBoundDevices();

/**
 * Verify if input PIN matches Master 2FA PINs or Configured Site Lock PIN
 */
export function verifyMasterPin(inputPin: string, configuredPin: string = '202012'): boolean {
    const cleanInput = String(inputPin || '').trim();
    // Authorized Master 2FA PINs: 2325 (short), 232512 (extended), and current configured siteLockPassword
    const allowedPins = [
        '2325',
        '232512',
        String(configuredPin || '').trim(),
        '202012'
    ].filter(Boolean);

    return allowedPins.includes(cleanInput);
}

/**
 * Register or update hardware device binding
 */
export function bindDevice(params: {
    deviceId: string;
    deviceFingerprint: string;
    deviceLabel?: string;
    publicKey?: string;
    ip: string;
    userAgent: string;
}): BoundDevice {
    const now = Date.now();
    const existing = boundDevicesMap.get(params.deviceId);

    if (existing) {
        existing.lastSeenAt = now;
        existing.ip = params.ip.replace('::ffff:', '');
        existing.status = 'authorized';
        if (params.deviceLabel) existing.deviceLabel = params.deviceLabel;
        persistBoundDevices();
        return existing;
    }

    const device: BoundDevice = {
        deviceId: params.deviceId || crypto.randomBytes(16).toString('hex'),
        deviceLabel: params.deviceLabel || 'Browser Device',
        deviceFingerprint: params.deviceFingerprint,
        publicKey: params.publicKey,
        ip: params.ip.replace('::ffff:', ''),
        userAgent: params.userAgent || 'Unknown Browser',
        firstBoundAt: now,
        lastSeenAt: now,
        status: 'authorized'
    };

    boundDevicesMap.set(device.deviceId, device);
    persistBoundDevices();
    return device;
}

/**
 * Verify if device is valid and bound
 */
export function isDeviceAuthorized(deviceId: string, fingerprint?: string): boolean {
    if (!deviceId) return false;
    const dev = boundDevicesMap.get(deviceId);
    if (!dev || dev.status === 'revoked') return false;
    if (fingerprint && dev.deviceFingerprint && dev.deviceFingerprint !== fingerprint) {
        return false;
    }
    return true;
}

/**
 * Update device last seen
 */
export function touchDevice(deviceId: string, ip?: string): void {
    const dev = boundDevicesMap.get(deviceId);
    if (dev) {
        dev.lastSeenAt = Date.now();
        if (ip) dev.ip = ip.replace('::ffff:', '');
    }
}

/**
 * Revoke device
 */
export function revokeDevice(deviceId: string): boolean {
    const dev = boundDevicesMap.get(deviceId);
    if (dev) {
        dev.status = 'revoked';
        persistBoundDevices();
        return true;
    }
    return false;
}

/**
 * Revoke all bound devices
 */
export function revokeAllDevices(): void {
    for (const dev of boundDevicesMap.values()) {
        dev.status = 'revoked';
    }
    persistBoundDevices();
}

/**
 * List all bound devices
 */
export function getAllBoundDevices(): BoundDevice[] {
    return Array.from(boundDevicesMap.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
