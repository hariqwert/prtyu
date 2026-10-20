import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, disableNetwork, enableNetwork } from 'firebase/firestore';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;
let quotaExceeded = false;
let quotaResetTime = 0;

if (fs.existsSync(configPath)) {
    try {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        console.log('[Firestore] Initialized Successfully.');
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error('[Firestore] Failed to initialize:', e);
    }
}

const ADMIN_DB_PATH = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');

export async function syncFromFirestore() {
    if (!db) return;
    try {
        const docRef = doc(db, 'system_config', 'admin_db');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Automatically clean any mass-imported 1736 non-sports channels from sports and liveEvents
            if (Array.isArray(data.sports)) {
                data.sports = data.sports.filter((s: any) => !s.id?.startsWith('sports_1736_') && !(s.url || '').includes('exmxbxe.cfd'));
            }
            if (Array.isArray(data.liveEvents)) {
                data.liveEvents = data.liveEvents.filter((s: any) => !s.id?.startsWith('sports_1736_') && !(s.url || '').includes('exmxbxe.cfd'));
            }
            const tmpFile = ADMIN_DB_PATH + '.tmp';
            fs.writeFileSync(tmpFile, JSON.stringify(data, null, 4), 'utf8');
            fs.renameSync(tmpFile, ADMIN_DB_PATH);
            console.log('[Firestore] Successfully downloaded, sanitized and applied config to admin_db.json');
            // Persist the clean config back to Firestore
            setDoc(docRef, data).catch(() => {});
        } else {
            console.log('[Firestore] No existing config found in Firestore. Awaiting first local save.');
        }
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error('[Firestore] Error syncing from Firestore:', e);
    }
}

export async function syncToFirestore(dbData: any) {
    if (!db) return;
    try {
        const docRef = doc(db, 'system_config', 'admin_db');
        // Filter out any huge or unnecessary fields if needed, but for now we sync it entirely.
        await setDoc(docRef, dbData);
        console.log('[Firestore] Successfully uploaded admin_db.json to Firestore.');
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error('[Firestore] Error syncing to Firestore:', e);
    }
}

const MAX_CHUNK_SIZE = 900000;

export async function syncM3uFromFirestore() {
    if (!db) return;
    try {
        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

        const m3uRef = collection(db, 'm3u_playlists');
        const qSnap = await getDocs(m3uRef);
        
        const fileChunks: { [filename: string]: { [index: number]: { content: string, total: number } } } = {};
        
        qSnap.forEach(docSnap => {
            const data = docSnap.data();
            const filename = data.filename;
            const index = data.index || 0;
            const content = data.content || '';
            const total = data.totalChunks || 1;
            
            if (filename) {
                if (!fileChunks[filename]) fileChunks[filename] = {};
                fileChunks[filename][index] = { content, total };
            }
        });
        
        for (const filename of Object.keys(fileChunks)) {
            const chunksMap = fileChunks[filename];
            const maxIndex = Math.max(...Object.keys(chunksMap).map(Number));
            // Ensure we use the totalChunks from the chunk to know how many valid chunks there are
            let totalChunks = 0;
            if (chunksMap[0]) totalChunks = chunksMap[0].total;
            else if (chunksMap[maxIndex]) totalChunks = chunksMap[maxIndex].total;
            
            let fullContent = '';
            for (let i = 0; i < totalChunks; i++) {
                if (chunksMap[i]) {
                    fullContent += chunksMap[i].content;
                }
            }
            
            if (fullContent.length > 0) {
                const filePath = path.join(vaultDir, filename);
                fs.writeFileSync(filePath, fullContent, 'utf8');
            }
        }
        console.log(`[Firestore] Successfully downloaded ${Object.keys(fileChunks).length} M3U playlists from Firestore.`);
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error('[Firestore] Error syncing M3U from Firestore:', e);
    }
}

export async function syncM3uToFirestore(filename: string, content: string) {
    if (!db) return;
    try {
        const chunks = [];
        for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
            chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
        }
        
        for (let i = 0; i < chunks.length; i++) {
            const docRef = doc(db, 'm3u_playlists', `${filename}_chunk_${i}`);
            await setDoc(docRef, {
                filename,
                index: i,
                content: chunks[i],
                totalChunks: chunks.length,
                updatedAt: Date.now()
            });
        }
        
        for (let i = chunks.length; i < chunks.length + 50; i++) {
            const docRef = doc(db, 'm3u_playlists', `${filename}_chunk_${i}`);
            await deleteDoc(docRef).catch(() => {});
        }
        
        console.log(`[Firestore] Successfully uploaded M3U ${filename} to Firestore in ${chunks.length} chunks.`);
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error(`[Firestore] Error syncing M3U ${filename} to Firestore:`, e);
    }
}

export async function deleteM3uFromFirestore(filename: string) {
    if (!db) return;
    try {
        for (let i = 0; i < 50; i++) {
            const docRef = doc(db, 'm3u_playlists', `${filename}_chunk_${i}`);
            await deleteDoc(docRef).catch(() => {});
        }
        console.log(`[Firestore] Successfully deleted M3U ${filename} from Firestore.`);
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error(`[Firestore] Error deleting M3U ${filename} from Firestore:`, e);
    }
}

let logQueue: any[] = [];
let isFlushingLogs = false;

export async function logIpToFirestore(ip: string, reqPath: string) {
    if (!db) return;
    // Only log real IPs
    if (ip === '127.0.0.1' || ip === '::1') return;
    
    logQueue.push({
        ip: ip,
        path: reqPath,
        time: Date.now()
    });
}

// Background task to flush logs to Firestore
setInterval(async () => {
    if (!db || logQueue.length === 0 || isFlushingLogs) return;
    if (quotaExceeded) {
        if (Date.now() > quotaResetTime) {
            quotaExceeded = false;
            enableNetwork(db).catch(() => {});
        } else {
            return;
        }
    }
    isFlushingLogs = true;
    
    try {
        const logsToFlush = [...logQueue];
        logQueue = [];
        
        const today = new Date().toISOString().split('T')[0];
        const docRef = doc(db, 'analytics', today);
        const docSnap = await getDoc(docRef);
        
        let data: any = { logs: [] };
        if (docSnap.exists()) {
            data = docSnap.data();
            if (!data.logs) data.logs = [];
        }
        
        data.logs.push(...logsToFlush);
        
        // Trim to last 1000 logs per day to avoid huge docs
        if (data.logs.length > 1000) data.logs = data.logs.slice(-1000);
        
        await setDoc(docRef, data);
    } catch(e: any) {
        if (e.message && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded. Pausing analytics logs for 1 hour.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000; // 1 hour
        } else if (e.message && e.message.includes('permission')) {
            // Handled silently
        } else {
            console.warn('[Firestore Analytics] Log notice:', e?.message || e);
        }
    } finally {
        isFlushingLogs = false;
    }
}, 60000); // Flush every 60 seconds



export async function getAnalyticsFromFirestore(days = 7) {
    if (!db) return { error: "Firestore not initialized" };
    try {
        const results: any = {};
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const docRef = doc(db, 'analytics', dateStr);
            const docSnap = await getDoc(docRef).catch(()=>null);
            if (docSnap && docSnap.exists()) {
                results[dateStr] = docSnap.data().logs || [];
            }
        }
        return results;
    } catch (e: any) {
        if (e && e.message && e.message.includes && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    
        console.error("Failed to fetch analytics:", e);
        return { error: e.message };
    }
}
