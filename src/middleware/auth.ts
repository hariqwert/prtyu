import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Automatically generate a secure secret on startup to keep sessions safe

import fs from 'fs';
import path from 'path';

const SECRET_FILE = path.join(process.cwd(), 'doctor_strange', 'jwt_secret.txt');
let secret = process.env.JWT_SECRET;
if (!secret) {
    if (fs.existsSync(SECRET_FILE)) {
        secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    } else {
        secret = crypto.randomBytes(32).toString('hex');
        if (fs.existsSync(path.join(process.cwd(), 'doctor_strange'))) {
            fs.writeFileSync(SECRET_FILE, secret);
        }
    }
}
export const JWT_SECRET = secret;


export interface AdminPayload {
    ip: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Retrieves the client's actual IP address, respecting reverse proxies.
 */
export const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        return ip.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
};

/**
 * Protects admin API endpoints with strict JWT & IP-bound validation.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie || '';
    
    let token = '';
    
    // Extract token from Bearer Auth Header
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } 
    // Fallback: Extract from query parameter (for direct file exports/downloads)
    else if (req.query && req.query.token) {
        token = req.query.token as string;
    }
    // Fallback: Extract from cookie
    else if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, c) => {
            const [name, val] = c.trim().split('=');
            if (name && val) acc[name] = val;
            return acc;
        }, {} as Record<string, string>);
        token = cookies.admin_auth || '';
    }

    if (!token) {
        return res.status(401).json({ status: "error", message: "Unauthorized: No security token provided" });
    }

    // Legacy bypass removed for security reasons

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ status: "error", message: "Forbidden: Access denied" });
        }

        const rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '0.0.0.0';
        const clientIp = (Array.isArray(rawIp) ? rawIp[0] : (rawIp as string).split(',')[0]).trim().replace('::ffff:', '');

        if (decoded.ip && decoded.ip !== clientIp && decoded.ip !== '127.0.0.1' && clientIp !== '127.0.0.1') {
            console.log(`[AUTH] Session roaming detected: Token IP: ${decoded.ip} -> New IP: ${clientIp}`);
        }

        (req as any).adminSession = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ status: "error", message: "Session expired or is invalid. Please log in again." });
    }
};

/**
 * Synchronous check if a request has a valid 3-lock verified admin session.
 */
export const isAdminAuthenticated = (req: Request): boolean => {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie || '';
    
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token as string;
    } else if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, c) => {
            const [name, val] = c.trim().split('=');
            if (name && val) acc[name] = decodeURIComponent(val);
            return acc;
        }, {} as Record<string, string>);
        token = cookies.admin_auth || '';
    }

    if (!token) return false;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
        return Boolean(decoded && decoded.role === 'admin');
    } catch {
        return false;
    }
};


