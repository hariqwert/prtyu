import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface Participant {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
    status: 'approved' | 'pending' | 'rejected' | 'removed';
    lastPing: number;
    currentTime: number;
    isPlaying: boolean;
}

export interface ChatMessage {
    id: string;
    sender: string;
    avatar: string;
    text: string;
    time: string;
    isReaction?: boolean;
}

export interface PartyRoom {
    roomId: string;
    title: string;
    mediaUrl: string;
    mediaName: string;
    currentTime: number;
    isPlaying: boolean;
    lastUpdated: number;
    hostId: string;
    hostToken: string;
    hostIp?: string;
    createdAt: number;
    requireApproval: boolean;
    participants: Map<string, Participant>;
    chat: ChatMessage[];
    embedServer?: string;
    embedUrl?: string;
    season?: string | number;
    episode?: string | number;
}

class PartySyncService {
    private rooms: Map<string, PartyRoom> = new Map();
    private roomsFilePath = path.join(process.cwd(), 'doctor_strange', 'party_rooms.json');
    public events: EventEmitter = new EventEmitter();

    constructor() {
        this.events.setMaxListeners(200);
        this.loadRoomsFromDisk();

        // Periodically purge truly inactive rooms or dead participants (every 60s)
        setInterval(() => {
            const now = Date.now();
            let changed = false;
            for (const [roomId, room] of this.rooms.entries()) {
                // Purge participants inactive for > 5 minutes (300,000 ms)
                for (const [pId, p] of room.participants.entries()) {
                    if (now - p.lastPing > 300000) {
                        room.participants.delete(pId);
                        changed = true;
                        this.addChatMessage(roomId, {
                            id: crypto.randomUUID(),
                            sender: 'System',
                            avatar: '',
                            text: `${p.name} left the room.`,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                }

                // If host disconnected and others remain, assign new host
                if (!room.participants.has(room.hostId) && room.participants.size > 0) {
                    const firstP = Array.from(room.participants.values())[0];
                    firstP.isHost = true;
                    room.hostId = firstP.id;
                    changed = true;
                    this.addChatMessage(roomId, {
                        id: crypto.randomUUID(),
                        sender: 'System',
                        avatar: '',
                        text: `${firstP.name} is now the room host.`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                }

                // Purge empty rooms older than 60 minutes
                if (room.participants.size === 0 && now - room.createdAt > 3600000) {
                    this.rooms.delete(roomId);
                    changed = true;
                }
            }
            if (changed) {
                this.saveRoomsToDisk();
            }
        }, 60000);
    }

    private loadRoomsFromDisk() {
        try {
            if (fs.existsSync(this.roomsFilePath)) {
                const raw = fs.readFileSync(this.roomsFilePath, 'utf8');
                const data = JSON.parse(raw);
                if (Array.isArray(data)) {
                    const now = Date.now();
                    for (const item of data) {
                        // Restore rooms created within the last 24 hours
                        if (item && item.roomId && (now - (item.createdAt || 0) < 24 * 60 * 60 * 1000)) {
                            const participants = new Map<string, Participant>();
                            if (Array.isArray(item.participants)) {
                                for (const p of item.participants) {
                                    if (p && p.id) {
                                        participants.set(p.id, p);
                                    }
                                }
                            }
                            const room: PartyRoom = {
                                ...item,
                                participants,
                                chat: Array.isArray(item.chat) ? item.chat : []
                            };
                            this.rooms.set(room.roomId.toUpperCase(), room);
                        }
                    }
                    console.log(`[PartySync] Restored ${this.rooms.size} active party rooms from storage`);
                }
            }
        } catch (e) {
            console.error('[PartySync] Error loading rooms from storage:', e);
        }
    }

    private saveRoomsToDisk() {
        try {
            const data: any[] = [];
            for (const room of this.rooms.values()) {
                data.push({
                    roomId: room.roomId,
                    title: room.title,
                    mediaUrl: room.mediaUrl,
                    mediaName: room.mediaName,
                    currentTime: room.currentTime,
                    isPlaying: room.isPlaying,
                    lastUpdated: room.lastUpdated,
                    hostId: room.hostId,
                    hostToken: room.hostToken,
                    hostIp: room.hostIp,
                    createdAt: room.createdAt,
                    requireApproval: room.requireApproval,
                    embedServer: room.embedServer || '',
                    embedUrl: room.embedUrl || '',
                    season: room.season || '',
                    episode: room.episode || '',
                    participants: Array.from(room.participants.values()),
                    chat: (room.chat || []).slice(-60)
                });
            }
            const dir = path.dirname(this.roomsFilePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.roomsFilePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[PartySync] Error saving rooms to storage:', e);
        }
    }

    /**
     * Flexible Room Lookup
     * Handles exact code ('PARTY-1234'), numeric only ('1234'), full URL ('?party=PARTY-1234'),
     * case-insensitivity, and hashes.
     */
    public findRoom(code: string): PartyRoom | undefined {
        if (!code || typeof code !== 'string') return undefined;
        let clean = code.trim();

        // Extract if full URL or query parameter passed
        if (clean.includes('party=')) {
            const match = clean.match(/[?&]party=([^&#\s]+)/i);
            if (match && match[1]) {
                clean = match[1];
            }
        }

        clean = clean.replace(/^[#\s]+/, '').trim().toUpperCase();

        // 1. Exact match
        if (this.rooms.has(clean)) {
            return this.rooms.get(clean);
        }

        // 2. Numeric only like 1234 -> PARTY-1234
        if (/^\d{3,6}$/.test(clean)) {
            if (this.rooms.has('PARTY-' + clean)) {
                return this.rooms.get('PARTY-' + clean);
            }
        }

        // 3. Try with/without 'PARTY-' prefix
        const withoutPrefix = clean.replace(/^PARTY[-\s]*/i, '');
        if (this.rooms.has('PARTY-' + withoutPrefix)) {
            return this.rooms.get('PARTY-' + withoutPrefix);
        }

        // 4. Scan existing rooms
        for (const [rId, room] of this.rooms.entries()) {
            if (rId.toUpperCase() === clean) return room;
            const suffix = rId.replace(/^PARTY-/, '');
            if (suffix === clean || suffix === withoutPrefix) return room;
        }

        return undefined;
    }

    /**
     * Create a new party room
     */
    public createRoom(params: {
        hostName: string;
        mediaUrl: string;
        mediaName: string;
        currentTime?: number;
        requireApproval?: boolean;
        ip?: string;
        embedServer?: string;
        embedUrl?: string;
        season?: string | number;
        episode?: string | number;
    }): { room: PartyRoom; participantId: string; hostToken: string } {
        const roomId = 'PARTY-' + Math.floor(1000 + Math.random() * 9000);
        const participantId = 'usr_' + crypto.randomUUID().slice(0, 8);
        const hostToken = 'ht_' + crypto.randomUUID();
        const hostName = params.hostName?.trim() || 'Host User';

        const host: Participant = {
            id: participantId,
            name: hostName,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(hostName)}`,
            isHost: true,
            status: 'approved',
            lastPing: Date.now(),
            currentTime: params.currentTime || 0,
            isPlaying: true
        };

        const participants = new Map<string, Participant>();
        participants.set(participantId, host);

        const room: PartyRoom = {
            roomId,
            title: `${hostName}'s Watch Party`,
            mediaUrl: params.mediaUrl,
            mediaName: params.mediaName || 'Live Stream',
            currentTime: params.currentTime || 0,
            isPlaying: true,
            lastUpdated: Date.now(),
            hostIp: params.ip,
            hostId: participantId,
            hostToken,
            createdAt: Date.now(),
            requireApproval: params.requireApproval === true, // Default to FALSE (anyone can join instantly) unless explicitly requested!
            participants,
            embedServer: params.embedServer || '',
            embedUrl: params.embedUrl || '',
            season: params.season || '',
            episode: params.episode || '',
            chat: [
                {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `Watch Party room created! Share this link with friends to watch together.`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]
        };

        this.rooms.set(roomId.toUpperCase(), room);
        this.saveRoomsToDisk();
        return { room, participantId, hostToken };
    }

    /**
     * Join an existing party room
     */
    public joinRoom(roomId: string, userName: string, existingId?: string, hostToken?: string, ip?: string): { room: PartyRoom; participantId: string; status: 'approved' | 'pending' | 'rejected' | 'removed'; isHost: boolean } | null {
        const room = this.findRoom(roomId);
        if (!room) return null;

        const isAuthorizedHost = !!(hostToken && room.hostToken === hostToken);

        if (existingId && room.participants.has(existingId)) {
            const existing = room.participants.get(existingId)!;
            if (userName && userName.trim() && userName.trim() !== existing.name) {
                existing.name = userName.trim();
                existing.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(existing.name)}`;
            }
            existing.lastPing = Date.now();
            if (isAuthorizedHost) {
                existing.isHost = true;
                existing.status = 'approved';
                room.hostId = existingId;
            }
            this.saveRoomsToDisk();
            return { room, participantId: existingId, status: existing.status, isHost: existing.isHost };
        }

        const participantId = 'usr_' + crypto.randomUUID().slice(0, 8);
        const cleanName = userName?.trim() || `Friend ${room.participants.size + 1}`;
        const isHost = isAuthorizedHost || room.participants.size === 0;
        const status = isHost || !room.requireApproval ? 'approved' : 'pending';

        const participant: Participant = {
            id: participantId,
            name: cleanName,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
            isHost,
            status,
            lastPing: Date.now(),
            currentTime: room.currentTime,
            isPlaying: room.isPlaying
        };

        if (participant.isHost) {
            room.hostId = participantId;
        }

        room.participants.set(participantId, participant);

        if (status === 'approved') {
            this.addChatMessage(room.roomId, {
                id: crypto.randomUUID(),
                sender: 'System',
                avatar: '',
                text: `${cleanName} joined the watch party! 🎉`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } else {
            this.addChatMessage(room.roomId, {
                id: crypto.randomUUID(),
                sender: 'System',
                avatar: '',
                text: `🔔 ${cleanName} requested to join. Waiting for host approval...`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return { room, participantId, status, isHost };
    }

    /**
     * Host accepts a pending participant
     */
    public approveParticipant(roomId: string, hostId: string, targetId: string, hostToken?: string): boolean {
        const room = this.findRoom(roomId);
        if (!room) return false;
        const isAuthorized = (room.hostId === hostId) || (room.hostToken === hostId) || (!!hostToken && room.hostToken === hostToken);
        if (!isAuthorized) return false;

        const target = room.participants.get(targetId);
        if (!target) return false;

        target.status = 'approved';
        this.addChatMessage(room.roomId, {
            id: crypto.randomUUID(),
            sender: 'System',
            avatar: '',
            text: `✅ ${target.name} was approved by the host and joined the party!`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return true;
    }

    /**
     * Host rejects a pending participant
     */
    public rejectParticipant(roomId: string, hostId: string, targetId: string, hostToken?: string): boolean {
        const room = this.findRoom(roomId);
        if (!room) return false;
        const isAuthorized = (room.hostId === hostId) || (room.hostToken === hostId) || (!!hostToken && room.hostToken === hostToken);
        if (!isAuthorized) return false;

        const target = room.participants.get(targetId);
        if (!target) return false;

        target.status = 'rejected';
        this.addChatMessage(room.roomId, {
            id: crypto.randomUUID(),
            sender: 'System',
            avatar: '',
            text: `❌ ${target.name}'s request to join was declined by the host.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return true;
    }

    /**
     * Host removes/kicks an existing participant
     */
    public removeParticipant(roomId: string, hostId: string, targetId: string, hostToken?: string): boolean {
        const room = this.findRoom(roomId);
        if (!room) return false;
        const isAuthorized = (room.hostId === hostId) || (room.hostToken === hostId) || (!!hostToken && room.hostToken === hostToken);
        if (!isAuthorized) return false;
        if (room.hostId === targetId) return false; // Host cannot remove self

        const target = room.participants.get(targetId);
        if (!target) return false;

        const targetName = target.name;
        target.status = 'removed';
        room.participants.delete(targetId);

        this.addChatMessage(room.roomId, {
            id: crypto.randomUUID(),
            sender: 'System',
            avatar: '',
            text: `🚫 ${targetName} was removed from the party by the host.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return true;
    }

    /**
     * Rename participant (give custom names in chat/party)
     */
    public renameParticipant(roomId: string, participantId: string, newName: string): boolean {
        const room = this.findRoom(roomId);
        if (!room) return false;

        const participant = room.participants.get(participantId);
        if (!participant) return false;

        const cleanName = (newName || '').trim().slice(0, 30);
        if (!cleanName || cleanName === participant.name) return false;

        const oldName = participant.name;
        participant.name = cleanName;
        participant.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;

        this.addChatMessage(room.roomId, {
            id: crypto.randomUUID(),
            sender: 'System',
            avatar: '',
            text: `✏️ ${oldName} changed their name to "${cleanName}".`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return true;
    }

    /**
     * Toggle require approval setting
     */
    public setApprovalMode(roomId: string, hostId: string, requireApproval: boolean, hostToken?: string): boolean {
        const room = this.findRoom(roomId);
        if (!room) return false;
        const isAuthorized = (room.hostId === hostId) || (room.hostToken === hostId) || (!!hostToken && room.hostToken === hostToken);
        if (!isAuthorized) return false;

        room.requireApproval = !!requireApproval;

        // If approval mode is turned off, immediately approve all currently pending guests!
        if (!room.requireApproval) {
            let approvedAny = false;
            for (const [, p] of room.participants.entries()) {
                if (p.status === 'pending') {
                    p.status = 'approved';
                    approvedAny = true;
                }
            }
            if (approvedAny) {
                this.addChatMessage(room.roomId, {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `🔓 Host enabled direct join for all! All waiting guests have been approved.`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }

        this.saveRoomsToDisk();
        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return true;
    }

    /**
     * Sync state: play, pause, seek, embed service change, host timeline update
     */
    public syncState(params: {
        roomId: string;
        participantId: string;
        action: 'play' | 'pause' | 'seek' | 'heartbeat' | 'host_update' | 'embed_change';
        currentTime: number;
        isPlaying: boolean;
        embedServer?: string;
        embedUrl?: string;
        mediaUrl?: string;
        mediaName?: string;
        season?: string | number;
        episode?: string | number;
    }): PartyRoom | null {
        const room = this.findRoom(params.roomId);
        if (!room) return null;

        const participant = room.participants.get(params.participantId);
        const isHostUser = (participant && participant.isHost) || (room.hostId === params.participantId);

        if (participant) {
            participant.lastPing = Date.now();
            participant.currentTime = params.currentTime;
            participant.isPlaying = params.isPlaying;
        }

        let needsSave = false;

        // If action is from host, or host changed embed service/stream/timeline:
        if (isHostUser) {
            // 1. Host changed embed server (e.g. vidlink -> twoembed -> smashystream)
            if (params.embedServer && params.embedServer !== room.embedServer) {
                const oldServer = room.embedServer;
                room.embedServer = params.embedServer;
                needsSave = true;
                this.addChatMessage(room.roomId, {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `🔀 Host switched embed provider to: ${params.embedServer.toUpperCase()}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }

            // 2. Host changed embed URL
            if (params.embedUrl && params.embedUrl !== room.embedUrl) {
                room.embedUrl = params.embedUrl;
                needsSave = true;
            }

            // 3. Host changed media URL or Name
            if (params.mediaUrl && params.mediaUrl !== room.mediaUrl) {
                room.mediaUrl = params.mediaUrl;
                needsSave = true;
            }
            if (params.mediaName && params.mediaName !== room.mediaName) {
                room.mediaName = params.mediaName;
                needsSave = true;
            }
            if (params.season) room.season = params.season;
            if (params.episode) room.episode = params.episode;
        }

        // If action is play, pause, seek, host_update, or embed_change:
        if (params.action !== 'heartbeat' && (isHostUser || params.action === 'seek' || params.action === 'play' || params.action === 'pause')) {
            room.currentTime = params.currentTime;
            room.isPlaying = params.isPlaying;
            room.lastUpdated = Date.now();
            needsSave = true;

            if (params.action === 'seek') {
                const senderName = participant ? participant.name : 'Someone';
                const mins = Math.floor(params.currentTime / 60);
                const secs = Math.floor(params.currentTime % 60).toString().padStart(2, '0');
                this.addChatMessage(room.roomId, {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `${senderName} jumped to ${mins}:${secs}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } else if (params.action === 'pause') {
                const senderName = participant ? participant.name : 'Someone';
                this.addChatMessage(room.roomId, {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `${senderName} paused playback ⏸️`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } else if (params.action === 'play') {
                const senderName = participant ? participant.name : 'Someone';
                this.addChatMessage(room.roomId, {
                    id: crypto.randomUUID(),
                    sender: 'System',
                    avatar: '',
                    text: `${senderName} resumed playback ▶️`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }

        if (needsSave) {
            this.saveRoomsToDisk();
        }

        this.events.emit(`sync:${room.roomId}`, this.formatRoomResponse(room));
        return room;
    }

    /**
     * Add chat message or reaction
     */
    public addChatMessage(roomId: string, message: ChatMessage): ChatMessage | null {
        const room = this.findRoom(roomId);
        if (!room) return null;

        room.chat.push(message);
        if (room.chat.length > 80) {
            room.chat.shift();
        }

        this.events.emit(`chat:${room.roomId}`, message);
        return message;
    }

    /**
     * Get room public state
     */
    public getRoom(roomId: string): any | null {
        const room = this.findRoom(roomId);
        if (!room) return null;
        return this.formatRoomResponse(room);
    }

    /**
     * Format room for JSON transmission (Map converted to array)
     */
    public formatRoomResponse(room: PartyRoom) {
        // Calculate estimated current time if playing
        let estimatedCurrentTime = room.currentTime;
        if (room.isPlaying) {
            const elapsedSeconds = (Date.now() - room.lastUpdated) / 1000;
            estimatedCurrentTime = room.currentTime + elapsedSeconds;
        }

        const allParticipants = Array.from(room.participants.values());
        const approvedParticipants = allParticipants.filter(p => p.status === 'approved');
        const pendingParticipants = allParticipants.filter(p => p.status === 'pending');

        return {
            roomId: room.roomId,
            title: room.title,
            mediaUrl: room.mediaUrl,
            mediaName: room.mediaName,
            currentTime: estimatedCurrentTime,
            rawCurrentTime: room.currentTime,
            isPlaying: room.isPlaying,
            lastUpdated: room.lastUpdated,
            hostId: room.hostId,
            requireApproval: room.requireApproval,
            embedServer: room.embedServer || '',
            embedUrl: room.embedUrl || '',
            season: room.season || '',
            episode: room.episode || '',
            participantsCount: approvedParticipants.length,
            participants: allParticipants.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                isHost: p.isHost,
                status: p.status,
                isPlaying: p.isPlaying,
                currentTime: p.currentTime
            })),
            pendingRequests: pendingParticipants.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar
            })),
            chat: room.chat.slice(-40)
        };
    }

    public cleanupOldRooms() {
        const now = Date.now();
        let changed = false;
        for (const [roomId, room] of this.rooms.entries()) {
            // Only kill room if completely empty for > 2 hours OR older than 24 hours
            const isEmpty = room.participants.size === 0;
            if ((isEmpty && (now - room.createdAt > 2 * 60 * 60 * 1000)) || (now - room.createdAt > 24 * 60 * 60 * 1000)) {
                this.rooms.delete(roomId);
                changed = true;
                console.log(`[PartySync] Cleaned up expired watch party ${roomId}`);
            }
        }
        if (changed) this.saveRoomsToDisk();
    }
}

export const partySyncService = new PartySyncService();

