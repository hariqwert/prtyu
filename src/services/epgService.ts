import fs from 'fs';
import path from 'path';
import { getChannelsList, getChannelStreamUrl } from './channelJsonService';
import { SportsScraperService } from './sportsScraperService';

export interface EpgProgram {
    id: string;
    title: string;
    description: string;
    category: string;
    start: string;
    end: string;
    startTime: number;
    endTime: number;
    progress: number;
    isLive: boolean;
    rating?: string;
}

export interface ChannelEpgData {
    channelId: string;
    name: string;
    logo: string;
    genre: string;
    streamUrl: string;
    playUrl: string;
    currentProgram: EpgProgram;
    programs: EpgProgram[];
}

let epgCache: ChannelEpgData[] = [];
let lastEpgBuildTime = 0;
const EPG_CACHE_MS = 10 * 60 * 1000; // 10 minutes cache

const GENRE_PROGRAM_TEMPLATES: Record<string, Array<{ title: string; category: string; durationMins: number; desc: string }>> = {
    'CRICKET': [
        { title: 'ICC World Championship: Live Test Match', category: 'Live Sports', durationMins: 120, desc: 'Live ball-by-ball international cricket test match coverage, pitch analysis, and hawk-eye replays.' },
        { title: 'Indian Premier League (IPL) Matchday Live', category: 'Live Sports', durationMins: 180, desc: 'T20 championship showdown with multi-angle ultra-HD 4K streaming.' },
        { title: 'Cricket Masterclass & Tactical Breakdown', category: 'Analysis', durationMins: 45, desc: 'Expert panel analyzes bowling spells, field placements, and batsman form.' },
        { title: 'Classic World Cup Finals Rewind', category: 'Documentary', durationMins: 90, desc: 'Relive the most memorable historic championship victories in cricket history.' }
    ],
    'SPORTS': [
        { title: 'Premier League Matchday Live', category: 'Football', durationMins: 120, desc: 'Live broadcast from the English top flight with studio pre-match analysis.' },
        { title: 'Formula 1 Grand Prix Qualifying & Race', category: 'Motorsport', durationMins: 100, desc: 'Wheel-to-wheel motorsport battle, pit strategy, and live driver telemetry.' },
        { title: 'UEFA Champions League Live', category: 'Football', durationMins: 120, desc: 'European championship clash featuring top elite clubs.' },
        { title: 'NBA Prime Time Shootout', category: 'Basketball', durationMins: 130, desc: 'Live professional basketball featuring top championship contenders.' },
        { title: 'UFC Championship Main Card', category: 'Combat Sports', durationMins: 150, desc: 'Title fight main card and preliminary clashes live in high definition.' }
    ],
    'PREMIUM MOVIES': [
        { title: 'Blockbuster 4K Premiere: Sci-Fi Epic', category: 'Action & Sci-Fi', durationMins: 140, desc: 'Critically acclaimed Hollywood cinema in stunning 4K and multi-channel audio.' },
        { title: 'Hollywood Spotlight & Behind the Scenes', category: 'Movie News', durationMins: 30, desc: 'Exclusive behind-the-scenes interviews with directors and leading cast members.' },
        { title: 'Action Thriller Special: Night Ops', category: 'Action', durationMins: 115, desc: 'Adrenaline-packed cinematic masterclass featuring high-stakes espionage.' }
    ],
    'NEWS': [
        { title: 'Global News Hour & Prime Headlines', category: 'World News', durationMins: 60, desc: 'Live breaking news, diplomatic developments, and global correspondent reports.' },
        { title: 'Financial Markets & Tech Frontier', category: 'Business', durationMins: 30, desc: 'Macroeconomic analysis, Wall Street updates, and tech innovation trends.' }
    ],
    'DEFAULT': [
        { title: 'Live Satellite Broadcast Feature', category: 'Entertainment', durationMins: 60, desc: 'High-definition satellite feed with live programming updates.' },
        { title: 'Prime Time Showcase Series', category: 'Entertainment', durationMins: 90, desc: 'Selected high-definition programming curated for standard broadcast.' }
    ]
};

export class EpgService {
    static async getChannelEpg(channelId: string): Promise<ChannelEpgData | undefined> {
        const epg = await this.getFullEpg();
        return epg.find(c => c.channelId === channelId || c.name === channelId);
    }
    static async getFullEpg(forceRefresh: boolean = false): Promise<ChannelEpgData[]> {
        const now = Date.now();
        if (!forceRefresh && epgCache.length > 0 && (now - lastEpgBuildTime < EPG_CACHE_MS)) {
            return epgCache;
        }

        const allChannels = getChannelsList();
        const sportsEvents = await SportsScraperService.scrapeLiveSportsEvents().catch(() => []);
        const results: ChannelEpgData[] = [];

        const dateObj = new Date();
        const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();

        for (let i = 0; i < allChannels.length; i++) {
            const ch = allChannels[i];
            const name = ch.name || ch.title || `Channel ${i + 1}`;
            const genre = (ch.genre || ch.group || 'General').toUpperCase();
            const streamUrl = getChannelStreamUrl(ch);
            const playUrl = `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(name)}&logo=${encodeURIComponent(ch.logo || '')}&type=hls&source=epg`;

            let template = GENRE_PROGRAM_TEMPLATES['DEFAULT'];
            if (genre.includes('CRICKET') || name.toLowerCase().includes('cricket') || name.toLowerCase().includes('star sports')) {
                template = GENRE_PROGRAM_TEMPLATES['CRICKET'];
            } else if (genre.includes('SPORT') || name.toLowerCase().includes('sport') || name.toLowerCase().includes('f1') || name.toLowerCase().includes('espn') || name.toLowerCase().includes('sony ten')) {
                template = GENRE_PROGRAM_TEMPLATES['SPORTS'];
            } else if (genre.includes('MOVIE') || genre.includes('CINEMA') || name.toLowerCase().includes('hbo') || name.toLowerCase().includes('cinema')) {
                template = GENRE_PROGRAM_TEMPLATES['PREMIUM MOVIES'];
            } else if (genre.includes('NEWS') || name.toLowerCase().includes('news') || name.toLowerCase().includes('cnn') || name.toLowerCase().includes('bbc')) {
                template = GENRE_PROGRAM_TEMPLATES['NEWS'];
            }

            const matchingSportsEvent = sportsEvents.find(e => {
                const cn = (e.channelName || '').toLowerCase();
                const curName = name.toLowerCase();
                return cn && (curName.includes(cn) || cn.includes(curName));
            });

            const programs: EpgProgram[] = [];
            let cursorTime = startOfDay;
            const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
            let pIndex = (i * 3) % template.length;

            while (cursorTime < endOfDay) {
                const tpl = template[pIndex % template.length];
                const durationMs = tpl.durationMins * 60 * 1000;
                const pStartTime = cursorTime;
                const pEndTime = cursorTime + durationMs;

                const isCurrentlyPlaying = now >= pStartTime && now < pEndTime;
                let progTitle = tpl.title;
                let progDesc = tpl.desc;
                let progCat = tpl.category;

                if (isCurrentlyPlaying && matchingSportsEvent) {
                    progTitle = `🔴 LIVE: ${matchingSportsEvent.title}`;
                    progDesc = `Live satellite broadcast of ${matchingSportsEvent.league} (${matchingSportsEvent.sport}) on ${name}.`;
                    progCat = 'Live Sports Match';
                }

                const elapsedMs = Math.max(0, now - pStartTime);
                const progressPct = isCurrentlyPlaying ? Math.min(100, Math.round((elapsedMs / durationMs) * 100)) : (now >= pEndTime ? 100 : 0);

                const formatTimeStr = (t: number) => {
                    const d = new Date(t);
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                };

                programs.push({
                    id: `epg-${ch.channel_id || i}-${programs.length}`,
                    title: progTitle,
                    description: progDesc,
                    category: progCat,
                    start: formatTimeStr(pStartTime),
                    end: formatTimeStr(pEndTime),
                    startTime: pStartTime,
                    endTime: pEndTime,
                    progress: progressPct,
                    isLive: isCurrentlyPlaying
                });

                cursorTime = pEndTime;
                pIndex++;
            }

            const currentProg = programs.find(p => p.isLive) || programs[0];

            results.push({
                channelId: ch.channel_id || `ch_${i}`,
                name: name,
                logo: ch.logo || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=150',
                genre: ch.genre || 'Live TV',
                streamUrl: streamUrl,
                playUrl: playUrl,
                currentProgram: currentProg,
                programs: programs
            });
        }

        epgCache = results;
        lastEpgBuildTime = Date.now();
        return results;
    }

    static async getEpgContextForAi(userQuery: string): Promise<string> {
        const epg = await this.getFullEpg();
        const sportsEvents = await SportsScraperService.scrapeLiveSportsEvents().catch(() => []);
        const q = (userQuery || '').toLowerCase();

        const matched = epg.filter(c => {
            const cn = c.name.toLowerCase();
            return q.includes(cn) || cn.includes(q) || (q.includes('sports') && cn.includes('sport'));
        }).slice(0, 5);

        let context = `=== LIVE EPG PROGRAM DATA (Current Time: ${new Date().toLocaleTimeString()}) ===\n`;

        if (sportsEvents.length > 0) {
            context += `\n[LIVE SPORTS BROADCASTS RIGHT NOW]:\n`;
            sportsEvents.slice(0, 6).forEach(evt => {
                context += `- ${evt.title} (${evt.league}): Broadcaster "${evt.channelName || 'Live Feed'}" [${evt.time}]\n`;
            });
        }

        if (matched.length > 0) {
            context += `\n[SCHEDULED CHANNELS & ON-AIR SHOWS]:\n`;
            matched.forEach(ch => {
                context += `\nChannel: "${ch.name}" (${ch.genre})\n`;
                context += `  NOW PLAYING: "${ch.currentProgram.title}" (${ch.currentProgram.start} - ${ch.currentProgram.end}) [${ch.currentProgram.progress}% completed]\n`;
                context += `  UPCOMING SHOWS:\n`;
                ch.programs.filter(p => p.startTime > Date.now()).slice(0, 3).forEach(up => {
                    context += `    - ${up.start} to ${up.end}: "${up.title}" (${up.category})\n`;
                });
            });
        } else {
            context += `\n[TOP ON-AIR SHOWS]:\n`;
            epg.slice(0, 8).forEach(ch => {
                context += `- "${ch.name}": Playing "${ch.currentProgram.title}" (${ch.currentProgram.start} - ${ch.currentProgram.end})\n`;
            });
        }

        return context;
    }
}
