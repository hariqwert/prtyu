import https from 'https';
import http from 'http';

export const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: Infinity,
    maxFreeSockets: 20,
    rejectUnauthorized: false, 
    timeout: 0
});

export const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: Infinity,
    maxFreeSockets: 20,
    timeout: 0
});

