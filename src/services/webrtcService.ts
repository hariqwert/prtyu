import { EventEmitter } from 'events';

export interface WebRTCSignal {
    from: string;
    to: string;
    type: 'offer' | 'answer' | 'candidate';
    data: any;
    timestamp: number;
}

export interface StageParticipant {
    id: string;
    name: string;
    role: 'admin' | 'guest';
    isPrivate: boolean; // if true: 1-on-1 with admin, video/audio not broadcast to other viewers
    isMuted: boolean;
    isVideoOff: boolean;
    joinedAt: number;
    lastPing: number;
    latestFrame?: string;
    latestFrameTime?: number;
}

export interface JoinRequest {
    id: string;
    viewerId?: string;
    name: string;
    isPrivate: boolean;
    requestedAt: number;
}

export interface ConferenceChatMessage {
    id: string;
    fromId: string;
    fromName: string;
    toId?: string; // If set or isPrivate, only visible to recipient & admin
    isPrivate: boolean;
    text: string;
    time: number;
    timestamp?: number;
}

export class WebRTCService extends EventEmitter {
    private isLive: boolean = false;
    private broadcasterId: string = 'admin_broadcaster';
    private startedAt: number = 0;
    private lastBroadcasterPing: number = 0;
    
    // Interactive Conference Controls
    private conferenceEnabled: boolean = false;
    private stageParticipants: Map<string, StageParticipant> = new Map();
    private pendingRequests: Map<string, JoinRequest> = new Map();
    private chatMessages: ConferenceChatMessage[] = [];
    
    // Viewer tracking
    private activeViewers: Map<string, number> = new Map(); // viewerId -> lastPing
    private pendingViewers: Set<string> = new Set();
    
    // Signaling queues: recipientId -> signals[]
    private signalQueues: Map<string, WebRTCSignal[]> = new Map();
    
    // Live frame buffer for fallback
    private latestFrameBuffer: Buffer | null = null;
    private latestFrameMime: string = 'image/jpeg';
    private latestFrameTime: number = 0;
    private frameListeners: Set<(frame: Buffer, mime: string) => void> = new Set();

    constructor() {
        super();
        this.setMaxListeners(300);

        // Prune inactive viewers and participants every 8 seconds
        setInterval(() => {
            const now = Date.now();
            for (const [viewerId, lastPing] of this.activeViewers.entries()) {
                if (now - lastPing > 30000) {
                    this.activeViewers.delete(viewerId);
                    this.pendingViewers.delete(viewerId);
                    this.signalQueues.delete(viewerId);
                    if (this.pendingRequests.has(viewerId)) {
                        this.pendingRequests.delete(viewerId);
                        this.emit('conferenceStateChanged');
                    }
                }
            }

            // Prune timed-out stage guests (inactive > 25 seconds)
            for (const [pId, p] of this.stageParticipants.entries()) {
                if (p.role === 'guest' && now - p.lastPing > 25000) {
                    console.log(`[WebRTC Service] Guest ${p.name} (${pId}) timed out. Removing from stage.`);
                    this.stageParticipants.delete(pId);
                    this.emit('conferenceStateChanged');
                }
            }

            // If broadcaster hasn't pinged or sent frames in 45 seconds, auto-mark offline
            if (this.isLive && this.lastBroadcasterPing > 0 && now - this.lastBroadcasterPing > 45000) {
                console.warn('[WebRTC Service] Broadcaster timed out after 45s of inactivity. Setting live status to false.');
                this.stopBroadcast();
            }
        }, 8000);
    }

    public startBroadcast(broadcasterId?: string) {
        this.isLive = true;
        this.startedAt = Date.now();
        this.lastBroadcasterPing = Date.now();
        if (broadcasterId) this.broadcasterId = broadcasterId;

        // Auto-add Admin as primary stage participant
        this.stageParticipants.set(this.broadcasterId, {
            id: this.broadcasterId,
            name: 'Admin Host',
            role: 'admin',
            isPrivate: false,
            isMuted: false,
            isVideoOff: false,
            joinedAt: Date.now(),
            lastPing: Date.now()
        });

        // Auto-queue all currently active viewers so broadcaster can immediately negotiate WebRTC with them
        const now = Date.now();
        for (const [viewerId, lastPing] of this.activeViewers.entries()) {
            if (now - lastPing < 30000) {
                this.pendingViewers.add(viewerId);
            }
        }

        this.emit('broadcastStateChanged', { isLive: true, startedAt: this.startedAt });
        this.emit('conferenceStateChanged');
        console.log('[WebRTC Service] Live WebRTC Broadcast STARTED by', this.broadcasterId, 'Active viewers queued:', this.pendingViewers.size);
    }

    public stopBroadcast() {
        this.isLive = false;
        this.startedAt = 0;
        this.pendingViewers.clear();
        this.signalQueues.clear();
        this.stageParticipants.clear();
        this.pendingRequests.clear();
        this.latestFrameBuffer = null;
        this.emit('broadcastStateChanged', { isLive: false, startedAt: 0 });
        this.emit('conferenceStateChanged');
        console.log('[WebRTC Service] Live WebRTC Broadcast STOPPED');
    }

    public pingBroadcaster() {
        this.lastBroadcasterPing = Date.now();
        const adminPart = this.stageParticipants.get(this.broadcasterId);
        if (adminPart) adminPart.lastPing = Date.now();
    }

    public getStatus() {
        const now = Date.now();
        const activeCount = Array.from(this.activeViewers.values()).filter(t => now - t < 20000).length;
        return {
            isLive: this.isLive,
            startedAt: this.startedAt,
            viewerCount: activeCount,
            hasLiveFrame: !!this.latestFrameBuffer && (now - this.latestFrameTime < 15000),
            latestFrameTime: this.latestFrameTime,
            conferenceEnabled: this.conferenceEnabled,
            stageCount: this.stageParticipants.size,
            pendingRequestCount: this.pendingRequests.size
        };
    }

    // --- CONFERENCE & MULTI-GUEST INTERACTION CONTROLS ---

    public setConferenceEnabled(enabled: boolean) {
        this.conferenceEnabled = enabled;
        if (!enabled) {
            // When conference disabled, reject all pending requests and clear guests
            this.pendingRequests.clear();
            for (const [pId, p] of this.stageParticipants.entries()) {
                if (p.role === 'guest') {
                    this.stageParticipants.delete(pId);
                }
            }
        }
        this.emit('conferenceStateChanged');
        return this.conferenceEnabled;
    }

    public requestJoinStage(viewerId: string, name: string, isPrivate: boolean = false): { success: boolean; message: string } {
        if (!this.isLive) {
            return { success: false, message: "Stream is not currently live." };
        }
        if (!this.conferenceEnabled) {
            return { success: false, message: "Host has disabled live stage requests." };
        }
        if (this.stageParticipants.has(viewerId)) {
            return { success: true, message: "You are already on stage!" };
        }

        this.pendingRequests.set(viewerId, {
            id: viewerId,
            viewerId: viewerId,
            name: (name || 'Guest').trim().substring(0, 30),
            isPrivate: !!isPrivate,
            requestedAt: Date.now()
        });

        this.emit('conferenceStateChanged');
        return { success: true, message: "Request sent to Host for approval." };
    }

    public cancelJoinRequest(viewerId: string): boolean {
        const deleted = this.pendingRequests.delete(viewerId);
        if (deleted) this.emit('conferenceStateChanged');
        return deleted;
    }

    public approveJoinRequest(viewerId: string): boolean {
        const req = this.pendingRequests.get(viewerId);
        if (!req) return false;

        this.pendingRequests.delete(viewerId);
        this.stageParticipants.set(viewerId, {
            id: viewerId,
            name: req.name,
            role: 'guest',
            isPrivate: req.isPrivate,
            isMuted: false,
            isVideoOff: false,
            joinedAt: Date.now(),
            lastPing: Date.now()
        });

        // Notify all participants so WebRTC peer connections can be initiated
        this.sendSignal({
            from: 'system',
            to: viewerId,
            type: 'answer' as any,
            data: { action: 'stage_approved', isPrivate: req.isPrivate }
        });

        this.emit('conferenceStateChanged');
        return true;
    }

    public rejectJoinRequest(viewerId: string): boolean {
        const deleted = this.pendingRequests.delete(viewerId);
        if (deleted) {
            this.sendSignal({
                from: 'system',
                to: viewerId,
                type: 'answer' as any,
                data: { action: 'stage_rejected' }
            });
            this.emit('conferenceStateChanged');
        }
        return deleted;
    }

    public removeParticipant(participantId: string): boolean {
        if (participantId === this.broadcasterId) return false; // Cannot kick host
        const deleted = this.stageParticipants.delete(participantId);
        if (deleted) {
            this.sendSignal({
                from: 'system',
                to: participantId,
                type: 'answer' as any,
                data: { action: 'stage_removed' }
            });
            this.emit('conferenceStateChanged');
        }
        return deleted;
    }

    public updateParticipantMedia(participantId: string, isMuted?: boolean, isVideoOff?: boolean): boolean {
        const p = this.stageParticipants.get(participantId);
        if (!p) return false;
        if (typeof isMuted === 'boolean') p.isMuted = isMuted;
        if (typeof isVideoOff === 'boolean') p.isVideoOff = isVideoOff;
        p.lastPing = Date.now();
        this.emit('conferenceStateChanged');
        return true;
    }

    public updateGuestFrame(guestId: string, base64Frame: string) {
        const p = this.stageParticipants.get(guestId);
        if (p) {
            p.latestFrame = base64Frame;
            p.latestFrameTime = Date.now();
            p.lastPing = Date.now();
        }
    }

    public getGuestFrame(guestId: string, requesterId?: string, isAdmin: boolean = false): string | null {
        const p = this.stageParticipants.get(guestId);
        if (!p || !p.latestFrame || p.isVideoOff) return null;
        // PRIVACY ENFORCEMENT: If participant is in private consultation, ONLY Admin or that specific participant can view it!
        if (p.isPrivate && !isAdmin && requesterId !== guestId) {
            return null;
        }
        return p.latestFrame;
    }

    public pingParticipant(participantId: string) {
        const p = this.stageParticipants.get(participantId);
        if (p) p.lastPing = Date.now();
    }

    // Filtered state ensuring private guests' identities/feeds are NOT leaked to public viewers
    public getConferenceState(requesterId?: string, isAdmin: boolean = false) {
        const rawParticipants = Array.from(this.stageParticipants.values());
        
        // Find if there is an active private guest
        const activePrivateGuest = rawParticipants.find(p => p.role === 'guest' && p.isPrivate);

        const safeParticipants = rawParticipants.map(p => {
            const isSelf = requesterId === p.id;
            // If participant is private and requester is neither Admin nor the participant themselves:
            if (p.isPrivate && !isAdmin && !isSelf) {
                return {
                    id: p.id,
                    name: 'Private Guest',
                    role: p.role,
                    isPrivate: true,
                    isMuted: true,
                    isVideoOff: true,
                    joinedAt: p.joinedAt,
                    hasFrame: false,
                    isMaskedForPrivacy: true
                };
            }
            return {
                id: p.id,
                name: p.name,
                role: p.role,
                isPrivate: p.isPrivate,
                isMuted: p.isMuted,
                isVideoOff: p.isVideoOff,
                joinedAt: p.joinedAt,
                hasFrame: !p.isVideoOff && !!p.latestFrame && (Date.now() - (p.latestFrameTime || 0) < 10000),
                isMaskedForPrivacy: false
            };
        });

        // Pending requests only visible to Admin or to the specific requester for their own request status
        let requestsToSend: JoinRequest[] = [];
        if (isAdmin) {
            requestsToSend = Array.from(this.pendingRequests.values()).map(r => ({
                ...r,
                viewerId: r.id
            }));
        } else if (requesterId && this.pendingRequests.has(requesterId)) {
            const myReq = this.pendingRequests.get(requesterId)!;
            requestsToSend = [{
                ...myReq,
                viewerId: myReq.id
            }];
        }

        const myParticipant = requesterId ? this.stageParticipants.get(requesterId) : undefined;
        const isPending = !!requesterId && this.pendingRequests.has(requesterId);

        return {
            conferenceEnabled: this.conferenceEnabled,
            isLive: this.isLive,
            participants: safeParticipants,
            pendingRequests: requestsToSend,
            myStatus: {
                isOnStage: !!myParticipant,
                role: myParticipant?.role || 'viewer',
                isPrivate: myParticipant?.isPrivate || false,
                isMuted: myParticipant?.isMuted || false,
                isVideoOff: myParticipant?.isVideoOff || false,
                isRequested: isPending,
                isPending: isPending
            },
            isPrivateSessionActive: !!activePrivateGuest,
            publicParticipantsCount: rawParticipants.filter(p => !p.isPrivate || isAdmin).length,
            chatMessages: this.getChatMessages(requesterId, isAdmin)
        };
    }

    // --- CHAT SYSTEM (PUBLIC & PRIVATE) ---

    public sendChatMessage(msg: { fromId: string; fromName: string; toId?: string; isPrivate: boolean; text: string }): ConferenceChatMessage {
        const now = Date.now();
        const newMsg: ConferenceChatMessage = {
            id: 'msg_' + Math.random().toString(36).substring(2, 9) + '_' + now,
            fromId: msg.fromId || 'anonymous',
            fromName: (msg.fromName || 'User').trim().substring(0, 25),
            toId: msg.toId,
            isPrivate: Boolean(msg.isPrivate),
            text: (msg.text || '').trim().substring(0, 500),
            time: now,
            timestamp: now
        };

        this.chatMessages.push(newMsg);
        if (this.chatMessages.length > 200) {
            this.chatMessages.shift();
        }

        this.emit('newChatMessage', newMsg);
        return newMsg;
    }

    public getChatMessages(requesterId?: string, isAdmin: boolean = false): ConferenceChatMessage[] {
        return this.chatMessages.filter(m => {
            if (!m.isPrivate) return true; // Public chat visible to all
            // Private chat visible only to Admin, sender, or direct recipient
            if (isAdmin) return true;
            if (requesterId && (m.fromId === requesterId || m.toId === requesterId)) return true;
            return false;
        });
    }

    public registerViewer(viewerId: string): boolean {
        this.activeViewers.set(viewerId, Date.now());
        if (this.isLive) {
            this.pendingViewers.add(viewerId);
            this.emit('viewerJoined', viewerId);
        }
        return this.isLive;
    }

    public pingViewer(viewerId: string) {
        this.activeViewers.set(viewerId, Date.now());
        if (this.stageParticipants.has(viewerId)) {
            this.stageParticipants.get(viewerId)!.lastPing = Date.now();
        }
    }

    public getPendingViewers(): string[] {
        const list = Array.from(this.pendingViewers);
        this.pendingViewers.clear();
        return list;
    }

    public sendSignal(signal: Omit<WebRTCSignal, 'timestamp'>) {
        // Enforce privacy on signals: If sender or receiver is a private guest, only route to/from admin!
        const sender = this.stageParticipants.get(signal.from);
        const recipient = this.stageParticipants.get(signal.to);

        if (sender?.isPrivate && signal.to !== this.broadcasterId && signal.to !== 'system') {
            console.warn(`[WebRTC Privacy] Blocked signal from private guest ${signal.from} to non-admin ${signal.to}`);
            return;
        }

        if (recipient?.isPrivate && signal.from !== this.broadcasterId && signal.from !== 'system') {
            console.warn(`[WebRTC Privacy] Blocked signal to private guest ${signal.to} from non-admin ${signal.from}`);
            return;
        }

        const fullSignal: WebRTCSignal = {
            ...signal,
            timestamp: Date.now()
        };

        const target = signal.to;
        if (!this.signalQueues.has(target)) {
            this.signalQueues.set(target, []);
        }

        const queue = this.signalQueues.get(target)!;
        queue.push(fullSignal);

        // Cap queue size to prevent memory leaks
        if (queue.length > 50) {
            queue.shift();
        }

        this.emit(`signal:${target}`, fullSignal);
    }

    public getSignals(recipientId: string): WebRTCSignal[] {
        const signals = this.signalQueues.get(recipientId) || [];
        this.signalQueues.set(recipientId, []);
        return signals;
    }

    public updateFrame(base64OrBuffer: string | Buffer, mime: string = 'image/jpeg') {
        this.lastBroadcasterPing = Date.now();
        if (typeof base64OrBuffer === 'string') {
            const cleanBase64 = base64OrBuffer.replace(/^data:image\/\w+;base64,/, '');
            this.latestFrameBuffer = Buffer.from(cleanBase64, 'base64');
        } else {
            this.latestFrameBuffer = base64OrBuffer;
        }
        this.latestFrameMime = mime;
        this.latestFrameTime = Date.now();

        // Notify active MJPEG/SSE listeners
        for (const listener of this.frameListeners) {
            try {
                listener(this.latestFrameBuffer, this.latestFrameMime);
            } catch(e) {}
        }
    }

    public getLatestFrame(): { buffer: Buffer | null; mime: string; time: number } {
        return {
            buffer: this.latestFrameBuffer,
            mime: this.latestFrameMime,
            time: this.latestFrameTime
        };
    }

    public addFrameListener(listener: (frame: Buffer, mime: string) => void) {
        this.frameListeners.add(listener);
    }

    public removeFrameListener(listener: (frame: Buffer, mime: string) => void) {
        this.frameListeners.delete(listener);
    }
}

export const webrtcService = new WebRTCService();

