import axios from 'axios';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { getTimLiveEvents, TimLiveEvent } from './timstreamsService';

// Reject unauthorized for maximum stream compatibility and keep-alive
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 10000
});

const httpAgent = new http.Agent({
    keepAlive: true,
    timeout: 10000
});

// ==========================================
// 1. DATA MODELS & SCHEMAS
// ==========================================

export interface ChannelStream {
    quality: string;
    embedUrl: string;
}

export interface BroadcastingStation {
    channelName: string;
    language: string;
    isEnglish: boolean;
    userHasChannel: boolean;
    userChannelUrl: string | null;
    channelSlug: string | null;
    timChannelId: string | null;
    playUrl: string | null;
    streams?: ChannelStream[];
}

export interface ConvertedChannel {
    channelName: string;
    channelSlug: string;
    timChannelId: string;
    url: string;
    playUrl: string;
    matchType: 'DIRECT_MATCH' | 'LEAGUE_CONVERTED';
    reason: string;
}

export interface LiveScoreData {
    hasScore: boolean;
    sport: 'Football' | 'Cricket' | string;
    league?: string;
    isLive: boolean;
    isFinal: boolean;
    clock?: string;
    detail?: string;
    summary?: string;
    homeTeam?: {
        name: string;
        shortName?: string;
        score: string;
        logo?: string;
    };
    awayTeam?: {
        name: string;
        shortName?: string;
        score: string;
        logo?: string;
    };
    teams?: Array<{
        name: string;
        score: string;
        overs?: string;
        logo?: string;
    }>;
}

export interface StreamicSportEvent {
    id: string;
    title: string;
    rawTitle: string;
    category: string;
    sportName: string;
    sportEmoji: string;
    league: string;
    countryCode: string;
    startTime: number;       // Unix epoch seconds
    endTime: number;         // Unix epoch seconds
    durationMinutes: number;
    timeIST: string;         // e.g. "06:30 PM IST"
    dateIST: string;         // e.g. "20 Sep 2026"
    fullIST: string;         // e.g. "20 Sep 2026, 06:30 PM IST"
    endTimeIST: string;
    status: 'UPCOMING' | 'STARTING_SOON' | 'LIVE' | 'ENDED';
    isLive: boolean;
    isStartingSoon: boolean;
    isEnded: boolean;
    canWatch: boolean;
    countdown: string;
    hasEnglish: boolean;
    isFamous: boolean;
    source: 'STREAMIC' | 'SONY_OFFICIAL_EPG' | 'ESPN_CRICKET' | 'ESPN_SOCCER' | 'TIMSTREAMS';
    officialPosterUrl?: string | null;
    thumbnail: string;
    thumbnailSource?: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
    homeTeamName?: string | null;
    awayTeamName?: string | null;
    userHasChannel: boolean;
    primaryPlayUrl: string | null;
    primaryChannelName: string | null;
    channels: BroadcastingStation[];
    myConvertedChannels: ConvertedChannel[];
    liveScore?: LiveScoreData | null;
}

// ==========================================
// 2. TIMSTREAMS USER CHANNELS DIRECTORY
// ==========================================

export interface TimStreamChannelDef {
    name: string;
    slug: string;
    category?: string;
}

export const USER_STREAMABLE_CHANNELS: TimStreamChannelDef[] = [
    { name: 'ABC', slug: 'abc' },
    { name: 'ACC Network', slug: 'acc-network' },
    { name: 'beIN Sports', slug: 'bein-sports' },
    { name: 'beIN Sports Francais 1', slug: 'bein-sports-francais-1' },
    { name: 'beIN Sports Francais 2', slug: 'bein-sports-francais-2' },
    { name: 'beIN Sports Francais 3', slug: 'bein-sports-francais-3' },
    { name: 'Big Ten Network', slug: 'big-ten-network' },
    { name: 'CANAL+ Extra 1', slug: 'canal-extra-1' },
    { name: 'CANAL+ Extra 2', slug: 'canal-extra-2' },
    { name: 'CANAL+ Sport PL', slug: 'canal-sport-pl' },
    { name: 'CANAL+ Sport 2 PL', slug: 'canal-sport-2-pl' },
    { name: 'CANAL+ Sport 3 PL', slug: 'canal-sport-3-pl' },
    { name: 'CANAL+ Sport 4 PL', slug: 'canal-sport-4-pl' },
    { name: 'CANAL+ Sport 5 PL', slug: 'canal-sport-5-pl' },
    { name: 'CANAL+ Sport 6 PL', slug: 'canal-sport-6-pl' },
    { name: 'CBS Sports Network', slug: 'cbs-sports-network' },
    { name: 'DAZN 1 Germany', slug: 'dazn-1-germany' },
    { name: 'DAZN 2 Germany', slug: 'dazn-2-germany' },
    { name: 'DAZN 1 Italia', slug: 'dazn-1-italia' },
    { name: 'DAZN 1 Spain', slug: 'dazn-1-spain' },
    { name: 'DAZN 2 Spain', slug: 'dazn-2-spain' },
    { name: 'DAZN 3 Spain', slug: 'dazn-3-spain' },
    { name: 'DAZN 4 Spain', slug: 'dazn-4-spain' },
    { name: 'DAZN F1', slug: 'dazn-f1' },
    { name: 'DAZN LaLiga', slug: 'dazn-laliga' },
    { name: 'DAZN LaLiga 2', slug: 'dazn-laliga-2' },
    { name: 'Eleven Sports 1 Poland', slug: 'eleven-sports-1-poland' },
    { name: 'Eleven Sports 2 Poland', slug: 'eleven-sports-2-poland' },
    { name: 'Eleven Sports 3 Poland', slug: 'eleven-sports-3-poland' },
    { name: 'Eleven Sports 4 Poland', slug: 'eleven-sports-4-poland' },
    { name: 'ESPN', slug: 'espn' },
    { name: 'ESPN 2', slug: 'espn-2' },
    { name: 'ESPN Deportes', slug: 'espn-deportes' },
    { name: 'ESPNews', slug: 'espnews' },
    { name: 'ESPNU', slug: 'espnu' },
    { name: 'FOX Sports 1', slug: 'fox-sports-1' },
    { name: 'FOX Sports 2', slug: 'fox-sports-2' },
    { name: 'Fox Sports 501 (Cricket)', slug: 'fox-sports-501-cricket' },
    { name: 'Fox Sports 502', slug: 'fox-sports-502' },
    { name: 'Fox Sports 503', slug: 'fox-sports-503' },
    { name: 'Fox Sports 504 (Footy)', slug: 'fox-sports-504-footy' },
    { name: 'Fox Sports 505', slug: 'fox-sports-505' },
    { name: 'Fox Sports 506', slug: 'fox-sports-506' },
    { name: 'Fox Sports 507', slug: 'fox-sports-507' },
    { name: 'GOLF Channel', slug: 'golf-channel' },
    { name: 'MLB Network', slug: 'mlb-network' },
    { name: 'MotoGP Channel', slug: 'motogp-channel' },
    { name: 'Movistar Deportes', slug: 'movistar-deportes' },
    { name: 'Movistar LaLiga', slug: 'movistar-laliga' },
    { name: 'NBA TV', slug: 'nba-tv' },
    { name: 'NFL Network', slug: 'nfl-network' },
    { name: 'NHL Network', slug: 'nhl-network' },
    { name: 'Polsat Sport 1', slug: 'polsat-sport-1' },
    { name: 'Polsat Sport 2', slug: 'polsat-sport-2' },
    { name: 'Polsat Sport 3', slug: 'polsat-sport-3' },
    { name: 'Polsat Sport Fight', slug: 'polsat-sport-fight' },
    { name: 'Premier Sports 1 IE', slug: 'premier-sports-1-ie' },
    { name: 'Premier Sports 2 IE', slug: 'premier-sports-2-ie' },
    { name: 'Sky Sport 1 NZ', slug: 'sky-sport-1-nz' },
    { name: 'Sky Sport 2 NZ', slug: 'sky-sport-2-nz' },
    { name: 'Sky Sport 3 NZ', slug: 'sky-sport-3-nz' },
    { name: 'Sky Sport 4 NZ', slug: 'sky-sport-4-nz' },
    { name: 'Sky Sport 8 NZ', slug: 'sky-sport-8-nz' },
    { name: 'Sky Sport Bundesliga', slug: 'sky-sport-bundesliga' },
    { name: 'Sky Sports+', slug: 'sky-sports-plus' },
    { name: 'Sky Sports Action', slug: 'sky-sports-action' },
    { name: 'Sky Sports Cricket', slug: 'sky-sports-cricket' },
    { name: 'Sky Sports F1', slug: 'sky-sports-f1' },
    { name: 'Sky Sports Football', slug: 'sky-sports-football' },
    { name: 'Sky Sports Golf', slug: 'sky-sports-golf' },
    { name: 'Sky Sports Main Event', slug: 'sky-sports-main-event' },
    { name: 'Sky Sports Mix', slug: 'sky-sports-mix' },
    { name: 'Sky Sports News', slug: 'sky-sports-news' },
    { name: 'Sky Sports Premier League', slug: 'sky-sports-premier-league' },
    { name: 'Sky Sports Racing', slug: 'sky-sports-racing' },
    { name: 'Sky Sports Tennis', slug: 'sky-sports-tennis' },
    { name: 'Sony Sports Network', slug: 'sony-sports-network' },
    { name: 'Sony Sports Network 2', slug: 'sony-sports-network-2' },
    { name: 'Sony Sports Network 3', slug: 'sony-sports-network-3' },
    { name: 'Sony Sports Network 4', slug: 'sony-sports-network-4' },
    { name: 'Sony Sports Network 5', slug: 'sony-sports-network-5' },
    { name: 'SPORTDIGITAL FUSSBALL', slug: 'sportdigital-fussball' },
    { name: 'Sport TV1', slug: 'sport-tv1' },
    { name: 'Sport TV2', slug: 'sport-tv2' },
    { name: 'Sport TV3', slug: 'sport-tv3' },
    { name: 'Tennis Channel', slug: 'tennis-channel' },
    { name: 'TNT Sports 1', slug: 'tnt-sports-1' },
    { name: 'TNT Sports 2', slug: 'tnt-sports-2' },
    { name: 'TNT Sports 3', slug: 'tnt-sports-3' },
    { name: 'TNT Sports 4', slug: 'tnt-sports-4' },
    { name: 'TSN1', slug: 'tsn1' },
    { name: 'TUDN', slug: 'tudn' },
    { name: 'TYC Sports Internacional', slug: 'tyc-sports-internacional' },
    { name: 'UFC Fight Pass 24/7', slug: 'ufc-fight-pass-24-7' },
    { name: 'Willow Cricket', slug: 'willow-cricket' },
    { name: 'Willow Cricket 2', slug: 'willow-cricket-2' },
    { name: 'Asian Games Channel', slug: 'asian-games-channel' },
    { name: 'Asian Sports Network', slug: 'asian-sports-network' },
    { name: 'Star Sports 1', slug: 'star-sports-1' },
    { name: 'Star Sports 2', slug: 'star-sports-2' },
    { name: 'Star Sports Select 1', slug: 'star-sports-select-1' },
    { name: 'DD Sports', slug: 'dd-sports' },
    { name: 'Eurosport 1', slug: 'eurosport-1' },
    { name: 'Eurosport 2', slug: 'eurosport-2' },
    { name: 'Astro SuperSport 1', slug: 'astro-supersport-1' },
    { name: 'Astro Cricket', slug: 'astro-cricket' }
];

/**
 * Build the exact TimStreams player URL with event name as the displayed player title
 */
export function buildTimPlayUrl(slug: string, channelDisplayName: string, eventTitle?: string): string {
    const cleanSlug = slug.replace(/^tim[_-]?/i, '').trim();
    const idParam = `tim_${cleanSlug}`;
    const livePhpUrl = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(idParam)}`;
    const formattedName = eventTitle && eventTitle.trim() ? eventTitle.trim() : `⚡ ${channelDisplayName} (TimStreams)`;
    return `/play_consumet.php?url=${encodeURIComponent(livePhpUrl)}&name=${encodeURIComponent(formattedName)}&source=consumet.html&type=hls`;
}

function cleanStr(s: string): string {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match a channel name string to a TimStreams channel
 */
export function findUserChannelMatch(streamicChannelName: string): TimStreamChannelDef | null {
    if (!streamicChannelName) return null;
    const sClean = cleanStr(streamicChannelName);
    const sNum = streamicChannelName.match(/\d+/)?.[0];

    return USER_STREAMABLE_CHANNELS.find(u => {
        const uClean = cleanStr(u.name);
        const uSlug = cleanStr(u.slug);
        const uNum = u.name.match(/\d+/)?.[0];

        if (sNum && uNum && sNum !== uNum) return false;
        if (uClean === sClean || uSlug === sClean) return true;

        if (sClean === 'beinsportsus' && uSlug === 'beinsports') return true;
        if (sClean.includes('skysport') && sClean.includes('premierleague') && uSlug === 'skysportspremierleague') return true;
        if (sClean.includes('skysport') && sClean.includes('football') && uSlug === 'skysportsfootball') return true;
        if (sClean.includes('skysport') && sClean.includes('cricket') && uSlug === 'skysportscricket') return true;
        if (sClean.includes('skysport') && sClean.includes('mainevent') && uSlug === 'skysportsmainevent') return true;
        if (sClean.includes('skysport') && sClean.includes('f1') && uSlug === 'skysportsf1') return true;
        if (sClean.includes('skysport') && sClean.includes('tennis') && uSlug === 'skysportstennis') return true;
        if (sClean.includes('skysport') && sClean.includes('action') && uSlug === 'skysportsaction') return true;
        if (sClean.includes('skysport') && sClean.includes('golf') && uSlug === 'skysportsgolf') return true;

        // Sony Sports Ten channels
        if ((sClean.includes('sonyten1') || sClean.includes('sonysports1') || sClean.includes('sonysportsten1')) && uSlug === 'sonysportsnetwork') return true;
        if ((sClean.includes('sonyten2') || sClean.includes('sonysports2') || sClean.includes('sonysportsten2')) && uSlug === 'sonysportsnetwork2') return true;
        if ((sClean.includes('sonyten3') || sClean.includes('sonysports3') || sClean.includes('sonysportsten3')) && uSlug === 'sonysportsnetwork3') return true;
        if ((sClean.includes('sonyten4') || sClean.includes('sonysports4') || sClean.includes('sonysportsten4')) && uSlug === 'sonysportsnetwork4') return true;
        if ((sClean.includes('sonyten5') || sClean.includes('sonysports5') || sClean.includes('sonysportsten5')) && uSlug === 'sonysportsnetwork5') return true;
        if (sClean.includes('sonysports') && uSlug.startsWith('sonysportsnetwork')) return true;

        // Cricket channels: Willow vs Sky Sports Cricket vs Fox Cricket
        if (sClean.includes('willow') && sClean.includes('2') && uSlug === 'willowcricket2') return true;
        if (sClean.includes('willow') && uSlug === 'willowcricket') return true;
        if (sClean.includes('foxcricket') && uSlug === 'foxsports501cricket') return true;

        if (sClean.startsWith('tntsport') && sNum && uSlug === `tntsports${sNum}`) return true;
        if (sClean.startsWith('premiersport') && sNum && uSlug === `premiersports${sNum}ie`) return true;
        if (sClean === 'foxsports1' && uSlug === 'foxsports1') return true;
        if (sClean === 'foxsports2' && uSlug === 'foxsports2') return true;
        if (sClean === 'nhlnetwork' && uSlug === 'nhlnetwork') return true;
        if (sClean === 'cbssportsnetwork' && uSlug === 'cbssportsnetwork') return true;
        if (sClean.includes('canalsport') && sNum && (uSlug === `canalsport${sNum}pl` || uSlug === `canalsport${sNum}`)) return true;
        if (sClean.includes('canalsport') && !sNum && uSlug === 'canalsportpl') return true;
        if (sClean.includes('canalextra') && sNum && uSlug === `canalextra${sNum}`) return true;
        if (sClean.startsWith('polsatsport') && sNum && uSlug === `polsatsport${sNum}`) return true;
        if (sClean.startsWith('sporttv') && sNum && uSlug === `sporttv${sNum}`) return true;
        if (sClean.includes('daznlaliga') && uSlug === 'daznlaliga') return true;
        if (sClean === 'espn' && uSlug === 'espn') return true;
        if (sClean === 'espn2' && uSlug === 'espn2') return true;
        if ((sClean.includes('asiangames') || sClean.includes('asiansports') || sClean.includes('asianfeed')) && (uSlug.includes('asian') || uSlug.includes('sonysportsnetwork'))) return true;
        if (sClean.includes('starsport') && sNum && (uSlug === `starsports${sNum}` || uSlug.startsWith('starsports'))) return true;
        if (sClean.includes('starsport') && uSlug.startsWith('starsports')) return true;
        if (sClean.includes('ddsport') && uSlug === 'ddsports') return true;
        if (sClean.includes('eurosport') && sNum && uSlug === `eurosport${sNum}`) return true;
        if (sClean.includes('astrocricket') && uSlug === 'astrocricket') return true;
        if (sClean.includes('astrosupersport') && uSlug === 'astrosupersport1') return true;

        return false;
    }) || null;
}

// ==========================================
// 3. INTELLIGENT RIGHTS ROUTER
// ==========================================

export const RIGHTS_CHANNELS = {
    premierLeague: [
        { name: 'Sky Sports Premier League', slug: 'sky-sports-premier-league' },
        { name: 'Sky Sports Main Event', slug: 'sky-sports-main-event' },
        { name: 'TNT Sports 1', slug: 'tnt-sports-1' }
    ],
    laLiga: [
        { name: 'Premier Sports 1', slug: 'premier-sports-1-ie' },
        { name: 'DAZN LaLiga', slug: 'dazn-laliga' },
        { name: 'ESPN', slug: 'espn' },
        { name: 'Movistar LaLiga', slug: 'movistar-laliga' }
    ],
    serieA: [
        { name: 'TNT Sports 1', slug: 'tnt-sports-1' },
        { name: 'CBS Sports Network', slug: 'cbs-sports-network' },
        { name: 'DAZN 1 Italia', slug: 'dazn-1-italia' }
    ],
    bundesliga: [
        { name: 'Sky Sport Bundesliga', slug: 'sky-sport-bundesliga' },
        { name: 'DAZN 1 Germany', slug: 'dazn-1-germany' },
        { name: 'Sony Sports Network 2', slug: 'sony-sports-network-2' }
    ],
    championsLeague: [
        { name: 'TNT Sports 1', slug: 'tnt-sports-1' },
        { name: 'TNT Sports 2', slug: 'tnt-sports-2' },
        { name: 'CBS Sports Network', slug: 'cbs-sports-network' },
        { name: 'Sony Sports Network', slug: 'sony-sports-network' }
    ],
    generalFootball: [
        { name: 'Sky Sports Football', slug: 'sky-sports-football' },
        { name: 'FOX Sports 1', slug: 'fox-sports-1' },
        { name: 'FOX Sports 2', slug: 'fox-sports-2' },
        { name: 'SPORTDIGITAL FUSSBALL', slug: 'sportdigital-fussball' }
    ],
    portugueseFootball: [
        { name: 'Sport TV1', slug: 'sport-tv1' },
        { name: 'Sport TV2', slug: 'sport-tv2' }
    ],
    asianSports: [
        { name: 'Sony Sports Network (Ten 1)', slug: 'sony-sports-network' },
        { name: 'Sony Sports Network 2 (Ten 2)', slug: 'sony-sports-network-2' },
        { name: 'Sony Sports Network 5 (Ten 5)', slug: 'sony-sports-network-5' }
    ],
    // Differentiated Cricket Broadcast Rights:
    cricketBilateralSony: [
        { name: 'Sony Sports Network (Ten 1)', slug: 'sony-sports-network' },
        { name: 'Sony Sports Network 2 (Ten 2)', slug: 'sony-sports-network-2' },
        { name: 'Sony Sports Network 3 (Hindi)', slug: 'sony-sports-network-3' },
        { name: 'Sony Sports Network 5 (Ten 5)', slug: 'sony-sports-network-5' }
    ],
    cricketEnglandSky: [
        { name: 'Sky Sports Cricket', slug: 'sky-sports-cricket' },
        { name: 'Sky Sports Main Event', slug: 'sky-sports-main-event' }
    ],
    cricketAustraliaFox: [
        { name: 'Fox Sports 501 (Cricket)', slug: 'fox-sports-501-cricket' },
        { name: 'Sky Sports Cricket', slug: 'sky-sports-cricket' }
    ],
    cricketWillowLeague: [
        { name: 'Willow Cricket', slug: 'willow-cricket' },
        { name: 'Willow Cricket 2', slug: 'willow-cricket-2' }
    ],
    cricketGeneral: [
        { name: 'Sky Sports Cricket', slug: 'sky-sports-cricket' },
        { name: 'Sony Sports Network', slug: 'sony-sports-network' },
        { name: 'Willow Cricket', slug: 'willow-cricket' },
        { name: 'Fox Sports 501 (Cricket)', slug: 'fox-sports-501-cricket' }
    ],
    f1Motorsport: [
        { name: 'Sky Sports F1', slug: 'sky-sports-f1' },
        { name: 'DAZN F1', slug: 'dazn-f1' },
        { name: 'MotoGP Channel', slug: 'motogp-channel' }
    ],
    combatMMA: [
        { name: 'UFC Fight Pass 24/7', slug: 'ufc-fight-pass-24-7' },
        { name: 'TNT Sports 1', slug: 'tnt-sports-1' },
        { name: 'Sony Sports Network 2', slug: 'sony-sports-network-2' }
    ],
    tennis: [
        { name: 'Tennis Channel', slug: 'tennis-channel' },
        { name: 'Sky Sports Tennis', slug: 'sky-sports-tennis' },
        { name: 'Sony Sports Network 5', slug: 'sony-sports-network-5' }
    ],
    basketballNBA: [
        { name: 'NBA TV', slug: 'nba-tv' },
        { name: 'ESPN', slug: 'espn' }
    ],
    americanFootballNFL: [
        { name: 'NFL Network', slug: 'nfl-network' },
        { name: 'ESPN', slug: 'espn' }
    ],
    iceHockeyNHL: [
        { name: 'NHL Network', slug: 'nhl-network' },
        { name: 'TNT Sports 1', slug: 'tnt-sports-1' }
    ],
    baseballMLB: [
        { name: 'MLB Network', slug: 'mlb-network' },
        { name: 'ESPN', slug: 'espn' }
    ]
};

/**
 * Channel Rights Router: Matches verified direct broadcast stations ONLY.
 * No speculative dummy channel guessing - untelevised matches must have empty channel lists.
 */
export function convertEventToTimChannels(event: { title: string; league?: string; category?: string; channels?: BroadcastingStation[] }): ConvertedChannel[] {
    const converted: ConvertedChannel[] = [];
    const seenSlugs = new Set<string>();

    function addChannel(ch: { name: string; slug: string }, matchType: 'DIRECT_MATCH' | 'LEAGUE_CONVERTED', reason: string) {
        if (!ch || !ch.slug || seenSlugs.has(ch.slug)) return;
        seenSlugs.add(ch.slug);
        const timId = `tim_${ch.slug}`;
        const playUrl = buildTimPlayUrl(ch.slug, ch.name, event.title);
        converted.push({
            channelName: ch.name,
            channelSlug: ch.slug,
            timChannelId: timId,
            url: `https://timst.cfd/channel/${ch.slug}`,
            playUrl,
            matchType,
            reason
        });
    }

    // Direct channel matches from verified event broadcasters ONLY - NO FAKE / DUMMY GUESSING
    (event.channels || []).forEach(sc => {
        if (sc.userHasChannel && sc.channelSlug && sc.playUrl) {
            addChannel({ name: sc.channelName, slug: sc.channelSlug }, 'DIRECT_MATCH', `Verified broadcast: ${sc.channelName}`);
        }
    });

    return converted;
}

// ==========================================
// 4. SONY SPORTS OFFICIAL EPG INGESTION
// ==========================================

export interface SonyEpgChannel {
    id: number;
    name: string;
    shortName: string;
    slug: string;
    language: string;
}

export const SONY_EPG_CHANNELS: SonyEpgChannel[] = [
    { id: 162, name: 'Sony Sports Network (Ten 1)', shortName: 'Sony Ten 1 HD', slug: 'sony-sports-network', language: 'English' },
    { id: 891, name: 'Sony Sports Network 2 (Ten 2)', shortName: 'Sony Ten 2 HD', slug: 'sony-sports-network-2', language: 'English' },
    { id: 892, name: 'Sony Sports Network 3 (Ten 3 Hindi)', shortName: 'Sony Ten 3 HD', slug: 'sony-sports-network-3', language: 'Hindi' },
    { id: 1774, name: 'Sony Sports Network 4 (Ten 4)', shortName: 'Sony Ten 4', slug: 'sony-sports-network-4', language: 'Tamil/Telugu' },
    { id: 155, name: 'Sony Sports Network 5 (Ten 5)', shortName: 'Sony Ten 5 HD', slug: 'sony-sports-network-5', language: 'English' }
];

export const SONY_XML_CHANNEL_MAP: Record<string, SonyEpgChannel> = {
    '162': { id: 162, name: 'Sony Sports Network (Ten 1)', shortName: 'Sony Ten 1 HD', slug: 'sony-sports-network', language: 'English' },
    '891': { id: 891, name: 'Sony Sports Network 2 (Ten 2)', shortName: 'Sony Ten 2 HD', slug: 'sony-sports-network-2', language: 'English' },
    '892': { id: 892, name: 'Sony Sports Network 3 (Ten 3 Hindi)', shortName: 'Sony Ten 3 HD', slug: 'sony-sports-network-3', language: 'Hindi' },
    '1774': { id: 1774, name: 'Sony Sports Network 4 (Ten 4)', shortName: 'Sony Ten 4', slug: 'sony-sports-network-4', language: 'Tamil/Telugu' },
    '1772': { id: 1772, name: 'Sony Sports Network 4 (Ten 4 Tamil)', shortName: 'Sony Ten 4 Tamil', slug: 'sony-sports-network-4', language: 'Tamil' },
    '1773': { id: 1773, name: 'Sony Sports Network 4 (Ten 4 Telugu)', shortName: 'Sony Ten 4 Telugu', slug: 'sony-sports-network-4', language: 'Telugu' },
    '155': { id: 155, name: 'Sony Sports Network 5 (Ten 5)', shortName: 'Sony Ten 5 HD', slug: 'sony-sports-network-5', language: 'English' },
    '3510': { id: 3510, name: 'Sony Sports Ten 1 HD', shortName: 'Sony Ten 1 HD', slug: 'sony-sports-network', language: 'English' },
    '3511': { id: 3511, name: 'Sony Sports Ten 2 HD', shortName: 'Sony Ten 2 HD', slug: 'sony-sports-network-2', language: 'English' },
    '3512': { id: 3512, name: 'Sony Sports Ten 3 Hindi HD', shortName: 'Sony Ten 3 HD', slug: 'sony-sports-network-3', language: 'Hindi' },
    '3514': { id: 3514, name: 'Sony Sports Ten 4 Tamil', shortName: 'Sony Ten 4 Tamil', slug: 'sony-sports-network-4', language: 'Tamil' },
    '3515': { id: 3515, name: 'Sony Sports Ten 5 HD', shortName: 'Sony Ten 5 HD', slug: 'sony-sports-network-5', language: 'English' },
    // XMLTV ID mappings for active StrangeDrVN guide
    'SonySportsTen1.in@HD': { id: 162, name: 'Sony Sports Ten 1 HD', shortName: 'Sony Ten 1 HD', slug: 'sony-sports-network', language: 'English' },
    'SonySportsTen1.in@SD': { id: 514, name: 'Sony Sports Ten 1', shortName: 'Sony Ten 1', slug: 'sony-sports-network', language: 'English' },
    'SonySportsTen2.in@HD': { id: 891, name: 'Sony Sports Ten 2 HD', shortName: 'Sony Ten 2 HD', slug: 'sony-sports-network-2', language: 'English' },
    'SonySportsTen2.in@SD': { id: 891, name: 'Sony Sports Ten 2', shortName: 'Sony Ten 2', slug: 'sony-sports-network-2', language: 'English' },
    'SonySportsTen3Hindi.in@HD': { id: 892, name: 'Sony Sports Ten 3 Hindi HD', shortName: 'Sony Ten 3 HD', slug: 'sony-sports-network-3', language: 'Hindi' },
    'SonySportsTen3Hindi.in@SD': { id: 524, name: 'Sony Sports Ten 3 Hindi', shortName: 'Sony Ten 3', slug: 'sony-sports-network-3', language: 'Hindi' },
    'SonySportsTen4.in@Tamil': { id: 1772, name: 'Sony Sports Ten 4 Tamil', shortName: 'Sony Ten 4 Tamil', slug: 'sony-sports-network-4', language: 'Tamil' },
    'SonySportsTen4.in@Telugu': { id: 1773, name: 'Sony Sports Ten 4 Telugu', shortName: 'Sony Ten 4 Telugu', slug: 'sony-sports-network-4', language: 'Telugu' },
    'SonySportsTen5.in@HD': { id: 155, name: 'Sony Sports Ten 5 HD', shortName: 'Sony Ten 5 HD', slug: 'sony-sports-network-5', language: 'English' },
    'SonySportsTen5.in@SD': { id: 525, name: 'Sony Sports Ten 5', shortName: 'Sony Ten 5', slug: 'sony-sports-network-5', language: 'English' }
};

const NON_LIVE_KEYWORDS = [
    'highlight', 'highlights', 'hl', 'h/ls',
    'replay', 'repeat', 'rerun', 're-run',
    'rewind', 'classic', 'classics', 'vault', 'flashback', 'golden moments', 'retro',
    'magazine', 'magazine programme', 'review', 'preview', 'the story of', 'documentary',
    'best of', 'top 10', 'greatest',
    'sports extraaa', 'extraaa innings', 'extraaa', 'fight o\'clock', 'pre-show', 'post-show', 'studio'
];

const GENERIC_FILLER_TITLES = [
    't20 cricket', 'test cricket', 'one-day international cricket',
    'cricket highlights', 'women\'s test cricket', 'cricket classics'
];

/**
 * Strict 6-layer filter for genuine live sports:
 * Rejects repeats, archives, highlights, studio shows, and generic fillers.
 */
export function evaluateSonyShow(show: { showname?: string; title?: string; description?: string; desc?: string; episode_desc?: string; showCategory?: string; category?: string; willRepeat?: boolean }, isCurrentOnAir = false): { isLiveSport: boolean; reason?: string } {
    const name = (show.showname || show.title || '').trim();
    const desc = (show.description || show.desc || show.episode_desc || '').trim();
    const fullText = (name + ' ' + desc).toLowerCase();
    const isExplicitLive = /\blive\b/i.test(name) || /\blive\b/i.test(desc);

    // 1. Check for past years (e.g., 2025, 2024, 2023, 2022, 2021) - today is 2026!
    const pastYearRegex = /\b(19\d\d|20[0-1]\d|202[0-5])\b/;
    const pastYearMatch = fullText.match(pastYearRegex);
    if (pastYearMatch && !isExplicitLive) {
        return { isLiveSport: false, reason: `Archived replay from ${pastYearMatch[0]}` };
    }

    // 2. Check for past match result description (e.g. beat, defeated, collapsed, scored, won by)
    const pastResultRegex = /\b(beat|defeated|collapsed|won by|dismissed|lost by|scored\s+\d+)\b/i;
    if (pastResultRegex.test(desc) && !isExplicitLive) {
        return { isLiveSport: false, reason: 'Past match result in description' };
    }

    // 3. Check for non-live keywords in title or desc (highlights, replays, classic, review, etc.)
    for (const kw of NON_LIVE_KEYWORDS) {
        const regex = new RegExp('\\b' + kw + '\\b', 'i');
        if (regex.test(name) || regex.test(desc)) {
            return { isLiveSport: false, reason: `Non-live show type: ${kw}` };
        }
    }

    // 4. Generic filler titles without fixture
    if (GENERIC_FILLER_TITLES.includes(name.toLowerCase()) && !isExplicitLive) {
        return { isLiveSport: false, reason: `Generic filler replay slot: ${name}` };
    }

    // 5. willRepeat flag
    if (show.willRepeat === true && !isExplicitLive) {
        return { isLiveSport: false, reason: 'willRepeat is true' };
    }

    // 6. Reject historical replays and past tournaments (e.g. U19 Asia Cup, past test matches)
    if (/u-?19|under\s*19|asia\s*cup|acc\s*men|\b\d+(?:st|nd|rd|th)\s*test\b|the\s*ashes|classic|retrospective|vault|rewind/i.test(fullText) && !isExplicitLive) {
        return { isLiveSport: false, reason: 'Historical tournament replay or archive' };
    }

    // 7. On-air linear TV broadcasts on 24/7 channels: MUST have explicit LIVE indicator
    if (isCurrentOnAir) {
        if (!isExplicitLive) {
            return { isLiveSport: false, reason: 'Linear TV repeat/filler without explicit LIVE broadcast tag' };
        }
        return { isLiveSport: true };
    }

    // 8. Upcoming shows: must have explicit LIVE indicator
    if (!isExplicitLive) {
        return { isLiveSport: false, reason: 'Upcoming linear TV filler without explicit LIVE tag' };
    }

    return { isLiveSport: true };
}

function parseXmltvDate(dateStr: string): number {
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
    if (!match) return 0;
    const [_, y, m, d, h, min, s, tz] = match;
    let iso = `${y}-${m}-${d}T${h}:${min}:${s}`;
    if (tz) {
        const tzFormatted = tz.substring(0, 3) + ':' + tz.substring(3);
        iso += tzFormatted;
    } else {
        iso += 'Z';
    }
    return Math.floor(new Date(iso).getTime() / 1000);
}

function formatEpgDateIST(dateObj: Date) {
    const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const istOffsetMs = (5 * 60 + 30) * 60000;
    const istDate = new Date(utcTime + istOffsetMs);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = months[istDate.getMonth()];
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return {
        istTime: `${hoursStr}:${minutes} ${ampm} IST`,
        istDate: `${day} ${month} ${year}`,
        istFull: `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm} IST`
    };
}

function getSportMetadata(name: string, desc?: string) {
    const text = (name + ' ' + (desc || '')).toLowerCase();
    if (text.includes('asian games') || text.includes('asia cup') || text.includes('olympic')) {
        return { emoji: '🌏', category: 'asian_games', name: 'Asian Games / Multi-Sport' };
    }
    if (text.includes('cricket') || text.includes('t20') || text.includes('odi') || text.includes('ashes') || text.includes('ipl') || text.includes('willow') || text.includes('bcci') || text.includes('test match') || text.includes('star sports') || text.includes('astro cricket')) {
        return { emoji: '🏏', category: 'cricket', name: 'Cricket' };
    }
    if (text.includes('football') || text.includes('soccer') || text.includes('ucl') || text.includes('uefa') || text.includes('champions league') || text.includes('nations league') || text.includes('premier league') || text.includes('laliga') || text.includes('serie a') || text.includes('bundesliga') || text.includes('chelsea') || text.includes('arsenal') || text.includes('liverpool') || text.includes('madrid') || text.includes('barca') || text.includes('sportdigital') || text.includes('fa cup')) {
        return { emoji: '⚽', category: 'football', name: 'Football / Soccer' };
    }
    if (text.includes('tennis') || text.includes('wimbledon') || text.includes('atp') || text.includes('wta') || text.includes('us open') || text.includes('australian open') || text.includes('roland garros') || text.includes('french open') || text.includes('tennis channel')) {
        return { emoji: '🎾', category: 'tennis', name: 'Tennis' };
    }
    if (text.includes('wwe') || text.includes('smackdown') || text.includes('raw') || text.includes('nxt') || text.includes('ufc') || text.includes('mma') || text.includes('boxing') || text.includes('fight pass') || text.includes('fight network')) {
        return { emoji: '🥊', category: 'combat', name: 'Combat Sports / UFC' };
    }
    if (text.includes('f1') || text.includes('formula 1') || text.includes('motogp') || text.includes('nascar') || text.includes('indycar') || text.includes('rally') || text.includes('motorsport') || text.includes('dazn f1') || text.includes('sky sports f1')) {
        return { emoji: '🏎️', category: 'f1', name: 'Motorsport / F1' };
    }
    if (text.includes('nba') || text.includes('basketball') || text.includes('euroleague')) {
        return { emoji: '🏀', category: 'basketball', name: 'Basketball / NBA' };
    }
    if (text.includes('nfl') || text.includes('american football') || text.includes('super bowl') || text.includes('redzone')) {
        return { emoji: '🏈', category: 'nfl', name: 'American Football / NFL' };
    }
    if (text.includes('mlb') || text.includes('baseball')) {
        return { emoji: '⚾', category: 'baseball', name: 'Baseball / MLB' };
    }
    if (text.includes('golf') || text.includes('pga tour') || text.includes('liv golf')) {
        return { emoji: '⛳', category: 'golf', name: 'Golf / PGA Tour' };
    }
    if (text.includes('nhl') || text.includes('ice hockey') || text.includes('hockey')) {
        return { emoji: '🏒', category: 'hockey', name: 'Ice Hockey / NHL' };
    }
    return { emoji: '🏆', category: 'live_sports', name: 'Live Sports' };
}

interface RawSonyXmlShow {
    channelId: string;
    chInfo: SonyEpgChannel;
    startSec: number;
    endSec: number;
    title: string;
    desc: string;
    icon: string;
    category: string;
}

let cachedSonyShows: RawSonyXmlShow[] = [];
let lastSonyFetchTime = 0;
const SONY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchSonyXmlEpg(): Promise<RawSonyXmlShow[]> {
    const now = Date.now();
    if (cachedSonyShows.length > 0 && (now - lastSonyFetchTime < SONY_CACHE_TTL_MS)) {
        return cachedSonyShows;
    }

    const epgUrls = [
        'https://raw.githubusercontent.com/StrangeDrVN/epg/public/guide.xml.gz',
        'https://mitthu786.github.io/tvepg/jiotv/epg.xml.gz',
        'https://avkb.short.gy/jioepg.xml.gz',
        'https://raw.githubusercontent.com/mitthu786/tvepg/main/epg.xml.gz'
    ];

    for (const url of epgUrls) {
        try {
            const shows = await fetchGzipXmlFromUrl(url);
            if (shows.length > 0) {
                cachedSonyShows = shows;
                lastSonyFetchTime = now;
                return shows;
            }
        } catch (e: any) {
            console.warn(`[SonyEPG] Error fetching from ${url}:`, e?.message || e);
        }
    }

    return cachedSonyShows;
}

function fetchGzipXmlFromUrl(url: string): Promise<RawSonyXmlShow[]> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Encoding': 'gzip, deflate'
            },
            timeout: 15000,
            agent: url.startsWith('https') ? httpsAgent : httpAgent
        }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchGzipXmlFromUrl(res.headers.location));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP status ${res.statusCode}`));
            }

            const gunzip = zlib.createGunzip();
            res.pipe(gunzip);
            let buffer = '';
            const shows: RawSonyXmlShow[] = [];

            gunzip.on('data', chunk => {
                buffer += chunk.toString();
                let pIndex;
                while ((pIndex = buffer.indexOf('</programme>')) !== -1) {
                    const pXml = buffer.substring(0, pIndex + 12);
                    buffer = buffer.substring(pIndex + 12);

                    const chMatch = pXml.match(/channel=\"([^\"]+)\"/);
                    if (chMatch && SONY_XML_CHANNEL_MAP[chMatch[1]]) {
                        const startMatch = pXml.match(/start=\"([^\"]+)\"/);
                        const stopMatch = pXml.match(/stop=\"([^\"]+)\"/);
                        const titleMatch = pXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
                        const descMatch = pXml.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
                        const iconMatch = pXml.match(/<icon src=\"([^\"]+)\"/);
                        const catMatch = pXml.match(/<category[^>]*>([\s\S]*?)<\/category>/);

                        const startSec = parseXmltvDate(startMatch ? startMatch[1] : '');
                        const endSec = parseXmltvDate(stopMatch ? stopMatch[1] : '');

                        if (startSec && endSec) {
                            shows.push({
                                channelId: chMatch[1],
                                chInfo: SONY_XML_CHANNEL_MAP[chMatch[1]],
                                startSec,
                                endSec,
                                title: titleMatch ? titleMatch[1].trim() : '',
                                desc: descMatch ? descMatch[1].trim() : '',
                                icon: iconMatch ? iconMatch[1] : '',
                                category: catMatch ? catMatch[1].trim() : ''
                            });
                        }
                    }
                }
            });

            gunzip.on('end', () => resolve(shows));
            gunzip.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Fetch timeout'));
        });
    });
}

export async function getSonyLiveEvents(options: { onlyActive?: boolean; onlyLive?: boolean } = {}): Promise<StreamicSportEvent[]> {
    const nowMs = Date.now();
    const nowEpochSec = Math.floor(nowMs / 1000);
    const onlyActive = options.onlyActive ?? false;
    const onlyLive = options.onlyLive ?? false;
    const events: StreamicSportEvent[] = [];

    const rawShows = await fetchSonyXmlEpg();
    const seenMap = new Set<string>();

    rawShows.forEach(s => {
        const startSec = s.startSec;
        const endSec = s.endSec;
        const startMs = startSec * 1000;
        const endMs = endSec * 1000;

        if (endMs <= nowMs) return;

        const isCurrentOnAir = nowMs >= startMs && nowMs < endMs;
        const evalRes = evaluateSonyShow(s, isCurrentOnAir);
        if (!evalRes.isLiveSport) return;

        if (onlyLive && !isCurrentOnAir) return;

        if (onlyActive && !isCurrentOnAir) {
            const secUntil = startSec - nowEpochSec;
            if (secUntil > 20 * 60) return;
        }

        const ch = s.chInfo;
        const uniqueKey = `${ch.slug}_${startSec}`;
        if (seenMap.has(uniqueKey)) return;
        seenMap.add(uniqueKey);

        const name = s.title;
        const desc = s.desc;
        const istStart = formatEpgDateIST(new Date(startMs));
        const istEnd = formatEpgDateIST(new Date(endMs));
        const durationMin = Math.round((endMs - startMs) / 60000);
        const secUntilStart = startSec - nowEpochSec;
        const minUntilStart = Math.round(secUntilStart / 60);
        const secElapsed = nowEpochSec - startSec;
        const minElapsed = Math.round(secElapsed / 60);

        let status: 'UPCOMING' | 'STARTING_SOON' | 'LIVE' | 'ENDED' = 'UPCOMING';
        let isLive = false;
        let isStartingSoon = false;
        let canWatch = false;
        let countdown = '';

        if (isCurrentOnAir) {
            status = 'LIVE';
            isLive = true;
            canWatch = true;
            countdown = `🔴 LIVE NOW on ${ch.shortName} (${minElapsed}m in)`;
        } else if (secUntilStart <= 20 * 60) {
            status = 'STARTING_SOON';
            isStartingSoon = true;
            canWatch = true;
            countdown = minUntilStart <= 1 ? 'Starting in < 1 min' : `Starting in ${minUntilStart} mins`;
        } else {
            status = 'UPCOMING';
            canWatch = false;
            const h = Math.floor(minUntilStart / 60);
            const m = minUntilStart % 60;
            countdown = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${minUntilStart}m`;
        }

        const sportMeta = getSportMetadata(name, desc);
        const formattedTitle = isCurrentOnAir && !/^\s*live\b/i.test(name)
            ? `[LIVE] ${name}`
            : name;

        const officialPoster = s.icon || null;
        const timId = `tim_${ch.slug}`;
        const timPlayUrl = buildTimPlayUrl(ch.slug, ch.name, formattedTitle || name);

        const station: BroadcastingStation = {
            channelName: ch.name,
            language: ch.language,
            isEnglish: ch.language.includes('English'),
            userHasChannel: true,
            userChannelUrl: `https://timst.cfd/channel/${ch.slug}`,
            channelSlug: ch.slug,
            timChannelId: timId,
            playUrl: timPlayUrl,
            streams: [{ quality: 'HD 1080p', embedUrl: timPlayUrl }]
        };

        const converted: ConvertedChannel = {
            channelName: ch.name,
            channelSlug: ch.slug,
            timChannelId: timId,
            url: `https://timst.cfd/channel/${ch.slug}`,
            playUrl: timPlayUrl,
            matchType: 'DIRECT_MATCH',
            reason: `Official 24/7 stream on ${ch.shortName}`
        };

        events.push({
            id: `sony_${ch.id}_${startSec}`,
            title: formattedTitle,
            rawTitle: name,
            category: sportMeta.category,
            sportName: sportMeta.name,
            sportEmoji: sportMeta.emoji,
            league: s.category || 'Sony Sports Network India',
            countryCode: 'IN',
            startTime: startSec,
            endTime: endSec,
            durationMinutes: durationMin,
            officialPosterUrl: officialPoster,
            thumbnail: officialPoster || 'https://thumb.wikimedia.org/wikipedia/en/thumb/4/4d/2026_Asian_Games_logo.svg/800px-2026_Asian_Games_logo.svg.png',
            thumbnailSource: 'Sony Broadcaster TMS',
            timeIST: istStart.istTime,
            dateIST: istStart.istDate,
            fullIST: istStart.istFull,
            endTimeIST: istEnd.istTime,
            status,
            isLive,
            isStartingSoon,
            isEnded: false,
            canWatch,
            countdown,
            hasEnglish: ch.language.includes('English'),
            isFamous: true,
            source: 'SONY_OFFICIAL_EPG',
            userHasChannel: true,
            primaryPlayUrl: timPlayUrl,
            primaryChannelName: ch.name,
            channels: [station],
            myConvertedChannels: [converted]
        });
    });

    return events;
}

// ==========================================
// 5. STREAMIC INGESTION & PARSER
// ==========================================

const STREAMIC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://streamic.st/',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'X-SSIG': 'bytmo8xialhem066'
};

const SPORT_DURATIONS: Record<string, number> = {
    pilkanozna: 115,
    pilkanozna_wazne: 120,
    koszykowka: 150,
    tenis: 180,
    hokej: 160,
    americanfootball: 210,
    baseball: 190,
    krykiet: 300,
    dart: 120,
    snooker: 180,
    boks: 210,
    mma: 210,
    motorsport: 130,
    formula1: 130,
    australianfootball: 160,
    asian_games: 210,
    default: 130
};

const SPORT_INFO: Record<string, { name: string; emoji: string }> = {
    pilkanozna: { name: 'Football', emoji: '⚽' },
    pilkanozna_wazne: { name: 'Football (Top Match)', emoji: '⚽' },
    tenis: { name: 'Tennis', emoji: '🎾' },
    koszykowka: { name: 'Basketball', emoji: '🏀' },
    hokej: { name: 'Ice Hockey', emoji: '🏒' },
    americanfootball: { name: 'American Football (NFL)', emoji: '🏈' },
    baseball: { name: 'Baseball (MLB)', emoji: '⚾' },
    krykiet: { name: 'Cricket', emoji: '🏏' },
    dart: { name: 'Darts', emoji: '🎯' },
    snooker: { name: 'Snooker', emoji: '🎱' },
    boks: { name: 'Boxing', emoji: '🥊' },
    mma: { name: 'MMA / UFC', emoji: '🥊' },
    motorsport: { name: 'Motorsport', emoji: '🏎️' },
    formula1: { name: 'Formula 1', emoji: '🏎️' },
    australianfootball: { name: 'Australian Football', emoji: '🏉' },
    asian_games: { name: 'Asian Games', emoji: '🌏' },
    default: { name: 'Live Sports', emoji: '🏆' }
};

const FAMOUS_LEAGUES_KEYWORDS = [
    'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'champions league',
    'europa league', 'ucl', 'uel', 'fa cup', 'carabao', 'copa del rey',
    'ufc', 'ksw', 'bellator', 'boxing', 'formula 1', 'f1', 'motogp',
    'nba', 'nfl', 'nhl', 'mlb', 'atp', 'wta', 'us open', 'wimbledon', 'australian open',
    'ipl', 't20', 'icc', 'cricket', 'ashes', 'asian games', 'asia cup', 'afc', 'saudi pro league', 'isl'
];

function isFamousEvent(raw: any): boolean {
    if (raw.category === 'pilkanozna_wazne' || raw.category === 'formula1' || raw.category === 'mma' || raw.category === 'krykiet') {
        return true;
    }
    const l = (raw.league || '').toLowerCase();
    const t = (typeof raw.title === 'string' ? raw.title : JSON.stringify(raw.title || '')).toLowerCase();
    return FAMOUS_LEAGUES_KEYWORDS.some(k => l.includes(k) || t.includes(k));
}

function parseChannelInfo(rawLangString: string) {
    if (!rawLangString || typeof rawLangString !== 'string') {
        return { channelName: 'Sports Live Feed', language: 'International', isEnglish: false };
    }
    const isEnglish = rawLangString.toLowerCase().includes('english') || rawLangString.toLowerCase().includes('eng');
    const parts = rawLangString.split(/\s*[|:]\s*/).map(s => s.trim()).filter(Boolean);
    let language = parts[0] || 'International';
    let channelName = parts.slice(1).join(' | ').trim();
    if (!channelName) {
        channelName = language;
        language = 'International';
    }
    channelName = channelName.replace(/^([a-z]{2})\s*-\s*/i, '').trim();
    return { channelName, language, isEnglish };
}

function formatToIST(dateObj: Date) {
    const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const istOffsetMs = (5 * 60 + 30) * 60000;
    const istDate = new Date(utcTime + istOffsetMs);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = months[istDate.getMonth()];
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return {
        istTime: `${hoursStr}:${minutes} ${ampm} IST`,
        istDate: `${day} ${month} ${year}`,
        istFull: `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm} IST`
    };
}

function transformStreamicEvent(raw: any, nowEpochSec: number): StreamicSportEvent {
    const startTime = Number(raw.startTime || raw.time || Math.floor(Date.now() / 1000));
    const startDate = new Date(startTime * 1000);
    const ist = formatToIST(startDate);
    let categoryKey = raw.category || raw.cat || 'default';
    const rawLeague = (raw.league || '').toLowerCase();
    const rawTitleStr = (typeof raw.title === 'string' ? raw.title : JSON.stringify(raw.title || '')).toLowerCase();
    if (rawLeague.includes('asian games') || rawTitleStr.includes('asian games') || rawLeague.includes('asia games') || rawTitleStr.includes('asia games') || categoryKey === 'asian_games' || categoryKey === 'asiangames') {
        categoryKey = 'asian_games';
    }
    const durationMin = SPORT_DURATIONS[categoryKey] || SPORT_DURATIONS.default;
    const durationSec = durationMin * 60;
    const endTime = startTime + durationSec;
    const endDate = new Date(endTime * 1000);
    const istEnd = formatToIST(endDate);
    const secUntilStart = startTime - nowEpochSec;
    const minUntilStart = Math.round(secUntilStart / 60);
    const secElapsed = nowEpochSec - startTime;
    const minElapsed = Math.round(secElapsed / 60);

    let status: 'UPCOMING' | 'STARTING_SOON' | 'LIVE' | 'ENDED' = 'UPCOMING';
    let isStartingSoon = false;
    let isLive = false;
    let isEnded = false;
    let canWatch = false;
    let countdownText = '';

    if (nowEpochSec >= endTime) {
        status = 'ENDED';
        isEnded = true;
        canWatch = false;
        const minSinceEnd = Math.round((nowEpochSec - endTime) / 60);
        countdownText = minSinceEnd > 60
            ? `Ended ${Math.round(minSinceEnd / 60)}h ago`
            : `Ended ${minSinceEnd}m ago`;
    } else if (nowEpochSec >= startTime) {
        status = 'LIVE';
        isLive = true;
        canWatch = true;
        countdownText = `🔴 LIVE now (${minElapsed}m in)`;
    } else if (secUntilStart <= 20 * 60) {
        status = 'STARTING_SOON';
        isStartingSoon = true;
        canWatch = true;
        countdownText = minUntilStart <= 1 ? 'Starting in < 1 min' : `Starting in ${minUntilStart} mins`;
    } else {
        status = 'UPCOMING';
        canWatch = false;
        const hoursUntil = Math.floor(minUntilStart / 60);
        const remMin = minUntilStart % 60;
        countdownText = hoursUntil > 0
            ? `Starts in ${hoursUntil}h ${remMin}m`
            : `Starts in ${minUntilStart}m`;
    }

    let title = raw.title;
    if (typeof title === 'object' && title !== null) {
        if (title.pl) {
            title = `${title.pl.home || ''} vs ${title.pl.away || ''}`.trim();
        } else {
            title = Object.values(title).join(' vs ');
        }
    }
    if (!title || typeof title !== 'string') {
        title = 'Live Sports Event';
    }

    const stations: BroadcastingStation[] = [];
    let hasEnglish = false;

    // Streamic embeds array
    const embedsArr = raw._embeds || raw.channels || raw.streams || [];
    embedsArr.forEach((block: any) => {
        const rawName = block.channel_name || block.channel || block.name || block.language || '';
        const rawLang = block.language || block.lang || '';
        const { channelName: parsedName, language: parsedLang, isEnglish: isEng } = parseChannelInfo(rawName || rawLang);

        const channelName = block.channel_name || parsedName;
        const language = block.lang || rawLang || parsedLang;

        // Parse direct streams from block.embeds or block.streams
        const streams: ChannelStream[] = [];
        if (block.embeds && typeof block.embeds === 'object') {
            Object.values(block.embeds).forEach((em: any) => {
                if (em && typeof em === 'object' && em.embed) {
                    streams.push({
                        quality: em.label || 'HD',
                        embedUrl: em.embed
                    });
                } else if (typeof em === 'string') {
                    streams.push({ quality: 'HD', embedUrl: em });
                }
            });
        } else if (Array.isArray(block.streams)) {
            block.streams.forEach((st: any) => {
                if (typeof st === 'string') streams.push({ quality: 'HD', embedUrl: st });
                else if (st && st.embed) streams.push({ quality: st.label || 'HD', embedUrl: st.embed });
            });
        } else if (block.embed) {
            streams.push({ quality: block.label || 'HD', embedUrl: block.embed });
        }

        if (isEng || (language && language.toLowerCase().includes('english'))) {
            hasEnglish = true;
        }

        const userMatch = findUserChannelMatch(channelName);
        const channelSlug = userMatch ? userMatch.slug : null;
        const timId = channelSlug ? `tim_${channelSlug}` : null;
        const playUrl = channelSlug ? buildTimPlayUrl(channelSlug, userMatch?.name || channelName, title) : null;

        stations.push({
            channelName,
            language,
            isEnglish: isEng || (language && language.toLowerCase().includes('english')),
            userHasChannel: !!userMatch,
            userChannelUrl: channelSlug ? `https://timst.cfd/channel/${channelSlug}` : null,
            channelSlug,
            timChannelId: timId,
            playUrl,
            streams: []
        });
    });

    const sport = SPORT_INFO[categoryKey] || SPORT_INFO.default;
    const famous = isFamousEvent({ ...raw, title, category: categoryKey });

    const converted = convertEventToTimChannels({
        title,
        league: raw.league || '',
        category: categoryKey,
        channels: stations
    });

    const userHasChannel = stations.some(s => s.userHasChannel) || converted.length > 0;
    const firstWithPlay = stations.find(s => s.playUrl);
    const primaryConverted = converted[0] || null;
    const primaryPlayUrl = (primaryConverted?.playUrl) || (firstWithPlay?.playUrl) || null;
    const primaryChannelName = (primaryConverted?.channelName) || (firstWithPlay?.channelName) || (stations[0]?.channelName) || null;

    let t1Name = '';
    let t2Name = '';
    const cleanTitle = title.replace(/\b(live|highlights|replay)\b/gi, '').trim();
    const titleParts = cleanTitle.split(/\s+(?:vs\.?|v|[-–—]|at|@)\s+/i);
    if (titleParts.length >= 2) {
        t1Name = titleParts[0].trim();
        t2Name = titleParts[1].trim();
    }
    const t1Logo = t1Name ? findKnownTeamLogo(t1Name) || '' : '';
    const t2Logo = t2Name ? findKnownTeamLogo(t2Name) || '' : '';

    // Only allow canWatch if event is live or starting soon, AND has verified user channel and working playUrl
    const canWatchPlayable = (isLive || isStartingSoon) && (userHasChannel && !!primaryPlayUrl);

    return {
        id: `streamic_${raw.id || Math.random().toString(36).substring(2, 9)}`,
        title,
        rawTitle: title,
        category: categoryKey,
        sportName: sport.name,
        sportEmoji: sport.emoji,
        league: raw.league || '',
        countryCode: (raw.countryCode || '').toUpperCase(),
        startTime,
        endTime,
        durationMinutes: durationMin,
        timeIST: ist.istTime,
        dateIST: ist.istDate,
        fullIST: ist.istFull,
        endTimeIST: istEnd.istTime,
        status,
        isLive,
        isStartingSoon,
        isEnded,
        canWatch: canWatchPlayable,
        countdown: countdownText,
        hasEnglish,
        isFamous: famous,
        source: 'STREAMIC',
        thumbnail: '',
        homeTeamName: t1Name || undefined,
        awayTeamName: t2Name || undefined,
        homeTeamLogo: t1Logo || undefined,
        awayTeamLogo: t2Logo || undefined,
        userHasChannel,
        primaryPlayUrl,
        primaryChannelName,
        channels: stations,
        myConvertedChannels: converted
    };
}

// ==========================================
// 6. ESPN REAL-TIME LIVE SCORES TELEMETRY
// ==========================================

const FOOTBALL_LEAGUES = [
    { code: 'eng.1', name: 'English Premier League' },
    { code: 'esp.1', name: 'Spanish La Liga' },
    { code: 'ita.1', name: 'Italian Serie A' },
    { code: 'ger.1', name: 'German Bundesliga' },
    { code: 'uefa.champions', name: 'UEFA Champions League' },
    { code: 'uefa.europa', name: 'UEFA Europa League' },
    { code: 'fra.1', name: 'French Ligue 1' },
    { code: 'usa.1', name: 'Major League Soccer' }
];

let cachedScores: LiveScoreData[] = [];
let lastScoresFetch = 0;
const SCORES_CACHE_TTL_MS = 30 * 1000;

async function fetchLiveScores(): Promise<LiveScoreData[]> {
    const now = Date.now();
    if (cachedScores.length > 0 && (now - lastScoresFetch < SCORES_CACHE_TTL_MS)) {
        return cachedScores;
    }

    const scoresList: LiveScoreData[] = [];

    // 1. Football Scoreboards
    const fbPromises = FOOTBALL_LEAGUES.map(l =>
        axios.get(`http://site.api.espn.com/apis/site/v2/sports/soccer/${l.code}/scoreboard`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 5000,
            httpAgent
        }).then(res => ({ league: l.name, data: res.data })).catch(() => null)
    );

    // 2. Cricket Scorepanel
    const cricketPromise = axios.get('http://site.api.espn.com/apis/site/v2/sports/cricket/scorepanel', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 5000,
        httpAgent
    }).then(res => res.data).catch(() => null);

    const [fbResults, cricketData] = await Promise.all([
        Promise.all(fbPromises),
        cricketPromise
    ]);

    // Parse Football
    fbResults.forEach(item => {
        if (!item || !item.data || !item.data.events) return;
        item.data.events.forEach((ev: any) => {
            const comp = ev.competitions?.[0];
            if (!comp) return;
            const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
            if (!home || !away) return;

            const homeName = home.team?.displayName || home.team?.name || '';
            const awayName = away.team?.displayName || away.team?.name || '';
            const homeScore = home.score !== undefined ? String(home.score) : '0';
            const awayScore = away.score !== undefined ? String(away.score) : '0';
            const state = ev.status?.type?.state;
            const isLive = state === 'in';
            const isFinal = state === 'post';
            const clock = ev.status?.displayClock || '';
            const detail = ev.status?.type?.detail || '';

            scoresList.push({
                hasScore: true,
                sport: 'Football',
                league: item.league,
                isLive,
                isFinal,
                clock,
                detail,
                summary: `${homeName} ${homeScore} - ${awayScore} ${awayName} ${clock ? '(' + clock + ')' : ''}`.trim(),
                homeTeam: {
                    name: homeName,
                    shortName: home.team?.shortDisplayName || homeName,
                    score: homeScore,
                    logo: home.team?.logo
                },
                awayTeam: {
                    name: awayName,
                    shortName: away.team?.shortDisplayName || awayName,
                    score: awayScore,
                    logo: away.team?.logo
                }
            });
        });
    });

    // Parse Cricket
    if (cricketData && cricketData.events) {
        cricketData.events.forEach((ev: any) => {
            const comp = ev.competitions?.[0];
            if (!comp) return;
            const teams = (comp.competitors || []).map((c: any) => ({
                name: c.team?.displayName || c.team?.name || '',
                score: c.score || '',
                overs: c.currentOvers || '',
                logo: c.team?.logo
            }));
            const state = ev.status?.type?.state;
            const isLive = state === 'in';
            const isFinal = state === 'post';
            const detail = ev.status?.type?.detail || '';

            scoresList.push({
                hasScore: true,
                sport: 'Cricket',
                league: ev.league?.name || 'International Cricket',
                isLive,
                isFinal,
                detail,
                summary: teams.map((t: any) => `${t.name} ${t.score}`).join(' vs '),
                teams
            });
        });
    }

    cachedScores = scoresList;
    lastScoresFetch = now;
    return scoresList;
}

function matchLiveScore(event: StreamicSportEvent, scores: LiveScoreData[]): LiveScoreData | null {
    if (!scores || scores.length === 0) return null;
    const t = (event.title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');

    for (const sc of scores) {
        if (sc.sport === 'Football' && sc.homeTeam && sc.awayTeam) {
            const h = sc.homeTeam.name.toLowerCase();
            const a = sc.awayTeam.name.toLowerCase();
            const hClean = h.split(' ')[0];
            const aClean = a.split(' ')[0];
            if ((t.includes(h) || (hClean.length >= 4 && t.includes(hClean))) &&
                (t.includes(a) || (aClean.length >= 4 && t.includes(aClean)))) {
                return sc;
            }
        } else if (sc.sport === 'Cricket' && sc.teams && sc.teams.length >= 2) {
            const t1 = sc.teams[0].name.toLowerCase();
            const t2 = sc.teams[1].name.toLowerCase();
            const t1Word = t1.split(' ')[0];
            const t2Word = t2.split(' ')[0];
            if ((t.includes(t1) || (t1Word.length >= 4 && t.includes(t1Word))) &&
                (t.includes(t2) || (t2Word.length >= 4 && t.includes(t2Word)))) {
                return sc;
            }
        }
    }
    return null;
}

// ==========================================
// 7. 100% OFFICIAL ARTWORK HIERARCHY
// ==========================================

// ==========================================
// 7. 100% OFFICIAL ARTWORK & TEAM BADGES HIERARCHY
// ==========================================

export const KNOWN_TEAM_LOGOS: Record<string, string> = {
    // International Cricket & Nations (100% Reliable FlagCDN)
    'australia': 'https://flagcdn.com/w160/au.png',
    'zimbabwe': 'https://flagcdn.com/w160/zw.png',
    'india': 'https://flagcdn.com/w160/in.png',
    'england': 'https://flagcdn.com/w160/gb-eng.png',
    'pakistan': 'https://flagcdn.com/w160/pk.png',
    'south africa': 'https://flagcdn.com/w160/za.png',
    'new zealand': 'https://flagcdn.com/w160/nz.png',
    'west indies': 'https://flagcdn.com/w160/jm.png',
    'sri lanka': 'https://flagcdn.com/w160/lk.png',
    'bangladesh': 'https://flagcdn.com/w160/bd.png',
    'afghanistan': 'https://flagcdn.com/w160/af.png',
    'ireland': 'https://flagcdn.com/w160/ie.png',
    'scotland': 'https://flagcdn.com/w160/gb-sct.png',
    'netherlands': 'https://flagcdn.com/w160/nl.png',
    'usa': 'https://flagcdn.com/w160/us.png',
    'united states': 'https://flagcdn.com/w160/us.png',
    'nepal': 'https://flagcdn.com/w160/np.png',
    'canada': 'https://flagcdn.com/w160/ca.png',
    'namibia': 'https://flagcdn.com/w160/na.png',
    'uae': 'https://flagcdn.com/w160/ae.png',
    
    // Football Clubs
    'liverpool': 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    'manchester city': 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
    'man city': 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
    'manchester united': 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png',
    'man united': 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png',
    'arsenal': 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
    'chelsea': 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png',
    'tottenham': 'https://a.espncdn.com/i/teamlogos/soccer/500/367.png',
    'real madrid': 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    'barcelona': 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    'atletico madrid': 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
    'bayern munich': 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png',
    'borussia dortmund': 'https://a.espncdn.com/i/teamlogos/soccer/500/124.png',
    'psg': 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png',
    'paris saint-germain': 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png',
    'juventus': 'https://a.espncdn.com/i/teamlogos/soccer/500/111.png',
    'ac milan': 'https://a.espncdn.com/i/teamlogos/soccer/500/103.png',
    'inter milan': 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png'
};

export function findKnownTeamLogo(nameOrTitle: string): string | null {
    if (!nameOrTitle) return null;
    const clean = nameOrTitle.toLowerCase().trim();
    for (const [team, logo] of Object.entries(KNOWN_TEAM_LOGOS)) {
        if (clean.includes(team)) {
            return logo;
        }
    }
    return null;
}

const OFFICIAL_LEAGUE_COVERS: Record<string, string> = {
    asian_games: 'https://thumb.wikimedia.org/wikipedia/en/thumb/4/4d/2026_Asian_Games_logo.svg/800px-2026_Asian_Games_logo.svg.png',
    premier_league: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    champions_league: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&auto=format&fit=crop&q=80',
    la_liga: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80',
    serie_a: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=1200&auto=format&fit=crop&q=80',
    bundesliga: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&auto=format&fit=crop&q=80',
    cricket: 'https://images.unsplash.com/photo-1531415074868-036b1c575351?w=1200&auto=format&fit=crop&q=80',
    f1: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&auto=format&fit=crop&q=80',
    ufc: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200&auto=format&fit=crop&q=80',
    tennis: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200&auto=format&fit=crop&q=80',
    basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&auto=format&fit=crop&q=80'
};

function resolveOfficialThumbnail(event: StreamicSportEvent): string {
    // 1. Broadcaster TMS artwork
    if (event.officialPosterUrl) {
        return event.officialPosterUrl;
    }
    // 2. Event Attached Team Logos
    if (event.homeTeamLogo) {
        return event.homeTeamLogo;
    }
    if (event.awayTeamLogo) {
        return event.awayTeamLogo;
    }
    // 3. Attached live score club logos
    if (event.liveScore?.homeTeam?.logo) {
        return event.liveScore.homeTeam.logo;
    }
    if (event.liveScore?.teams?.[0]?.logo) {
        return event.liveScore.teams[0].logo;
    }

    // 4. Team Logo Dictionary from title
    const teamLogo = findKnownTeamLogo(event.title);
    if (teamLogo) {
        return teamLogo;
    }

    // 5. Official league backdrops
    const l = (event.league || '').toLowerCase();
    const t = (event.title || '').toLowerCase();
    const cat = (event.category || '').toLowerCase();

    if (l.includes('asian games') || t.includes('asian games') || cat === 'asian_games') {
        return OFFICIAL_LEAGUE_COVERS.asian_games;
    }
    if (l.includes('premier league') || t.includes('premier league')) {
        return OFFICIAL_LEAGUE_COVERS.premier_league;
    }
    if (l.includes('champions league') || t.includes('champions league') || l.includes('ucl')) {
        return OFFICIAL_LEAGUE_COVERS.champions_league;
    }
    if (l.includes('la liga') || t.includes('la liga') || l.includes('laliga')) {
        return OFFICIAL_LEAGUE_COVERS.la_liga;
    }
    if (l.includes('serie a') || t.includes('serie a')) {
        return OFFICIAL_LEAGUE_COVERS.serie_a;
    }
    if (l.includes('bundesliga') || t.includes('bundesliga')) {
        return OFFICIAL_LEAGUE_COVERS.bundesliga;
    }
    if (cat === 'krykiet' || l.includes('cricket') || t.includes('cricket') || l.includes('ipl') || l.includes('bbl') || l.includes('ashes') || l.includes('zimbabwe') || l.includes('australia')) {
        return OFFICIAL_LEAGUE_COVERS.cricket;
    }
    if (cat === 'formula1' || cat === 'motorsport' || l.includes('f1')) {
        return OFFICIAL_LEAGUE_COVERS.f1;
    }
    if (cat === 'mma' || cat === 'boks' || l.includes('ufc')) {
        return OFFICIAL_LEAGUE_COVERS.ufc;
    }
    if (cat === 'tenis' || l.includes('tennis') || l.includes('open')) {
        return OFFICIAL_LEAGUE_COVERS.tennis;
    }
    if (cat === 'koszykowka' || l.includes('nba')) {
        return OFFICIAL_LEAGUE_COVERS.basketball;
    }

    return OFFICIAL_LEAGUE_COVERS.premier_league;
}

// ==========================================
// 7.5 ESPN REAL-TIME CRICKET & SOCCER SCHEDULER
// ==========================================

export async function fetchEspnCricketEvents(): Promise<StreamicSportEvent[]> {
    const events: StreamicSportEvent[] = [];
    try {
        const res = await axios.get('http://site.api.espn.com/apis/site/v2/sports/cricket/scorepanel', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 6000,
            httpAgent
        });

        const data = res.data;
        if (!data || !data.scores || !Array.isArray(data.scores)) return events;

        const nowEpochSec = Math.floor(Date.now() / 1000);

        data.scores.forEach((s: any) => {
            const leagueName = s.leagues?.[0]?.name || 'International Cricket';
            (s.events || []).forEach((ev: any) => {
                const comp = ev.competitions?.[0];
                if (!comp) return;

                const t1 = comp.competitors?.[0];
                const t2 = comp.competitors?.[1];
                const t1Name = t1?.team?.displayName || t1?.team?.name || '';
                const t2Name = t2?.team?.displayName || t2?.team?.name || '';
                const t1Logo = findKnownTeamLogo(t1Name) || (t1?.team?.logo && !t1.team.logo.includes('cricket/500/3') ? t1.team.logo : '') || '';
                const t2Logo = findKnownTeamLogo(t2Name) || (t2?.team?.logo && !t2.team.logo.includes('cricket/500/3') ? t2.team.logo : '') || '';

                const matchTitle = ev.name || `${t1Name} vs ${t2Name}`;
                const startDateStr = ev.date || ev.startDate;
                const startTimeEpoch = startDateStr ? Math.floor(new Date(startDateStr).getTime() / 1000) : nowEpochSec;
                const durationMin = 360; // 6 hours for cricket ODI/T20/Test
                const endTimeEpoch = startTimeEpoch + (durationMin * 60);

                const state = ev.status?.type?.state;
                const isLive = state === 'in';
                const isEnded = state === 'post' || ev.status?.type?.completed === true || (nowEpochSec >= endTimeEpoch);
                // Completely skip ended cricket matches - automatic display must not show ended games
                if (isEnded) return;
                const isStartingSoon = !isLive && (startTimeEpoch - nowEpochSec <= 30 * 60);

                let status: 'UPCOMING' | 'STARTING_SOON' | 'LIVE' | 'ENDED' = 'UPCOMING';
                let countdown = '';
                if (isLive) {
                    status = 'LIVE';
                    const elapsedMin = Math.max(0, Math.round((nowEpochSec - startTimeEpoch) / 60));
                    countdown = `🔴 LIVE now (${elapsedMin}m in)`;
                } else if (isStartingSoon) {
                    status = 'STARTING_SOON';
                    const mins = Math.max(1, Math.round((startTimeEpoch - nowEpochSec) / 60));
                    countdown = `Starting in ${mins} mins`;
                } else {
                    const hours = Math.round((startTimeEpoch - nowEpochSec) / 3600);
                    countdown = hours > 0 ? `Starts in ${hours}h` : 'Scheduled Today';
                }

                const ist = formatToIST(new Date(startTimeEpoch * 1000));
                const istEnd = formatToIST(new Date(endTimeEpoch * 1000));

                // Extract verified broadcasters only from ESPN competition metadata - NO FAKE GUESSING
                const broadcasterNames: string[] = [];
                if (Array.isArray(comp.broadcasts)) {
                    for (const b of comp.broadcasts) {
                        if (Array.isArray(b?.names)) {
                            broadcasterNames.push(...b.names);
                        } else if (typeof b?.name === 'string') {
                            broadcasterNames.push(b.name);
                        }
                    }
                }
                if (Array.isArray(comp.geoBroadcasts)) {
                    for (const b of comp.geoBroadcasts) {
                        const mName = b?.media?.shortName || b?.media?.name;
                        if (mName) broadcasterNames.push(mName);
                    }
                }

                const stations: BroadcastingStation[] = [];
                for (const bName of broadcasterNames) {
                    const match = findUserChannelMatch(bName);
                    if (match) {
                        const timId = `tim_${match.slug}`;
                        stations.push({
                            channelName: match.name,
                            language: 'English',
                            isEnglish: true,
                            userHasChannel: true,
                            userChannelUrl: `https://timst.cfd/channel/${match.slug}`,
                            channelSlug: match.slug,
                            timChannelId: timId,
                            playUrl: buildTimPlayUrl(match.slug, match.name, matchTitle)
                        });
                    }
                }

                const converted = convertEventToTimChannels({
                    title: matchTitle,
                    league: leagueName,
                    category: 'krykiet',
                    channels: stations
                });

                const hasBroadcaster = stations.length > 0 || converted.length > 0;
                const primaryConverted = converted[0] || stations[0] || null;
                const primaryPlayUrl = primaryConverted ? primaryConverted.playUrl : null;
                const primaryChannelName = primaryConverted ? primaryConverted.channelName : (broadcasterNames[0] || 'No Broadcast Available');

                const teamsScores = (comp.competitors || []).map((c: any) => ({
                    name: c.team?.displayName || c.team?.name || '',
                    score: c.score || '',
                    overs: c.currentOvers || '',
                    logo: c.team?.logo
                }));

                const liveScore: LiveScoreData = {
                    hasScore: true,
                    sport: 'Cricket',
                    league: leagueName,
                    isLive,
                    isFinal: isEnded,
                    detail: ev.status?.type?.detail || '',
                    summary: teamsScores.map((t: any) => `${t.name} ${t.score}`).filter(Boolean).join(' vs ') || ev.status?.summary || '',
                    teams: teamsScores
                };

                const thumbnail = t1Logo || t2Logo || OFFICIAL_LEAGUE_COVERS.cricket;

                events.push({
                    id: `espn_cricket_${ev.id || Math.random().toString(36).substring(2, 9)}`,
                    title: matchTitle,
                    rawTitle: matchTitle,
                    category: 'krykiet',
                    sportName: 'Cricket',
                    sportEmoji: '🏏',
                    league: leagueName,
                    countryCode: 'INT',
                    startTime: startTimeEpoch,
                    endTime: endTimeEpoch,
                    durationMinutes: durationMin,
                    timeIST: ist.istTime,
                    dateIST: ist.istDate,
                    fullIST: ist.istFull,
                    endTimeIST: istEnd.istTime,
                    status,
                    isLive,
                    isStartingSoon,
                    isEnded,
                    canWatch: hasBroadcaster && (isLive || isStartingSoon || (!isEnded && startTimeEpoch - nowEpochSec < 7200)),
                    countdown,
                    hasEnglish: hasBroadcaster,
                    isFamous: true,
                    source: 'ESPN_CRICKET',
                    thumbnail,
                    homeTeamLogo: t1Logo,
                    awayTeamLogo: t2Logo,
                    homeTeamName: t1Name,
                    awayTeamName: t2Name,
                    userHasChannel: hasBroadcaster,
                    primaryPlayUrl,
                    primaryChannelName,
                    channels: stations,
                    myConvertedChannels: converted,
                    liveScore
                });
            });
        });
    } catch (e: any) {
        console.warn('[EspnCricket] Failed fetching cricket events:', e?.message || e);
    }
    return events;
}

export async function fetchEspnSoccerEvents(): Promise<StreamicSportEvent[]> {
    const events: StreamicSportEvent[] = [];
    const nowEpochSec = Math.floor(Date.now() / 1000);

    const soccerLeagues = [
        { code: 'eng.1', name: 'English Premier League' },
        { code: 'esp.1', name: 'Spanish La Liga' },
        { code: 'ita.1', name: 'Italian Serie A' },
        { code: 'ger.1', name: 'German Bundesliga' },
        { code: 'uefa.champions', name: 'UEFA Champions League' }
    ];

    try {
        const promises = soccerLeagues.map(l =>
            axios.get(`http://site.api.espn.com/apis/site/v2/sports/soccer/${l.code}/scoreboard`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 5000,
                httpAgent
            }).then(r => ({ league: l.name, data: r.data })).catch(() => null)
        );

        const results = await Promise.all(promises);
        results.forEach(res => {
            if (!res || !res.data || !Array.isArray(res.data.events)) return;
            const leagueName = res.league;

            res.data.events.forEach((ev: any) => {
                const comp = ev.competitions?.[0];
                if (!comp) return;

                const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
                const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
                if (!home || !away) return;

                const homeName = home.team?.displayName || home.team?.name || '';
                const awayName = away.team?.displayName || away.team?.name || '';
                const homeLogo = home.team?.logo || findKnownTeamLogo(homeName) || '';
                const awayLogo = away.team?.logo || findKnownTeamLogo(awayName) || '';

                const matchTitle = `${homeName} vs ${awayName}`;
                const startDateStr = ev.date;
                const startTimeEpoch = startDateStr ? Math.floor(new Date(startDateStr).getTime() / 1000) : nowEpochSec;
                const durationMin = 120;
                const endTimeEpoch = startTimeEpoch + (durationMin * 60);

                const state = ev.status?.type?.state;
                const isLive = state === 'in';
                const isEnded = state === 'post' || ev.status?.type?.completed === true || (nowEpochSec >= endTimeEpoch);
                // Completely skip ended soccer matches - automatic display must not show ended games
                if (isEnded) return;
                const isStartingSoon = !isLive && (startTimeEpoch - nowEpochSec <= 30 * 60);

                let status: 'UPCOMING' | 'STARTING_SOON' | 'LIVE' | 'ENDED' = 'UPCOMING';
                let countdown = '';
                if (isLive) {
                    status = 'LIVE';
                    countdown = `🔴 LIVE (${ev.status?.displayClock || 'In Progress'})`;
                } else if (isStartingSoon) {
                    status = 'STARTING_SOON';
                    const mins = Math.max(1, Math.round((startTimeEpoch - nowEpochSec) / 60));
                    countdown = `Starting in ${mins} mins`;
                } else {
                    const hours = Math.round((startTimeEpoch - nowEpochSec) / 3600);
                    countdown = hours > 0 ? `Starts in ${hours}h` : 'Today';
                }

                const ist = formatToIST(new Date(startTimeEpoch * 1000));
                const istEnd = formatToIST(new Date(endTimeEpoch * 1000));

                // Extract verified broadcasters only from ESPN competition metadata - NO FAKE GUESSING
                const broadcasterNames: string[] = [];
                if (Array.isArray(comp.broadcasts)) {
                    for (const b of comp.broadcasts) {
                        if (Array.isArray(b?.names)) {
                            broadcasterNames.push(...b.names);
                        } else if (typeof b?.name === 'string') {
                            broadcasterNames.push(b.name);
                        }
                    }
                }
                if (Array.isArray(comp.geoBroadcasts)) {
                    for (const b of comp.geoBroadcasts) {
                        const mName = b?.media?.shortName || b?.media?.name;
                        if (mName) broadcasterNames.push(mName);
                    }
                }

                const stations: BroadcastingStation[] = [];
                for (const bName of broadcasterNames) {
                    const match = findUserChannelMatch(bName);
                    if (match) {
                        const timId = `tim_${match.slug}`;
                        stations.push({
                            channelName: match.name,
                            language: 'English',
                            isEnglish: true,
                            userHasChannel: true,
                            userChannelUrl: `https://timst.cfd/channel/${match.slug}`,
                            channelSlug: match.slug,
                            timChannelId: timId,
                            playUrl: buildTimPlayUrl(match.slug, match.name, matchTitle)
                        });
                    }
                }

                const converted = convertEventToTimChannels({
                    title: matchTitle,
                    league: leagueName,
                    category: 'pilkanozna',
                    channels: stations
                });

                const hasBroadcaster = stations.length > 0 || converted.length > 0;
                const primaryConverted = converted[0] || stations[0] || null;
                const primaryPlayUrl = primaryConverted ? primaryConverted.playUrl : null;
                const primaryChannelName = primaryConverted ? primaryConverted.channelName : (broadcasterNames[0] || 'No Broadcast Available');

                const liveScore: LiveScoreData = {
                    hasScore: true,
                    sport: 'Football',
                    league: leagueName,
                    isLive,
                    isFinal: isEnded,
                    clock: ev.status?.displayClock || '',
                    detail: ev.status?.type?.detail || '',
                    summary: `${homeName} ${home.score || 0} - ${away.score || 0} ${awayName}`,
                    homeTeam: { name: homeName, shortName: home.team?.shortDisplayName, score: String(home.score || 0), logo: homeLogo },
                    awayTeam: { name: awayName, shortName: away.team?.shortDisplayName, score: String(away.score || 0), logo: awayLogo }
                };

                const thumbnail = homeLogo || awayLogo || OFFICIAL_LEAGUE_COVERS.premier_league;

                events.push({
                    id: `espn_soccer_${ev.id || Math.random().toString(36).substring(2, 9)}`,
                    title: matchTitle,
                    rawTitle: matchTitle,
                    category: 'pilkanozna',
                    sportName: 'Football',
                    sportEmoji: '⚽',
                    league: leagueName,
                    countryCode: 'INT',
                    startTime: startTimeEpoch,
                    endTime: endTimeEpoch,
                    durationMinutes: durationMin,
                    timeIST: ist.istTime,
                    dateIST: ist.istDate,
                    fullIST: ist.istFull,
                    endTimeIST: istEnd.istTime,
                    status,
                    isLive,
                    isStartingSoon,
                    isEnded,
                    canWatch: hasBroadcaster && (isLive || isStartingSoon || (!isEnded && startTimeEpoch - nowEpochSec < 7200)),
                    countdown,
                    hasEnglish: hasBroadcaster,
                    isFamous: true,
                    source: 'ESPN_SOCCER',
                    thumbnail,
                    homeTeamLogo: homeLogo,
                    awayTeamLogo: awayLogo,
                    homeTeamName: homeName,
                    awayTeamName: awayName,
                    userHasChannel: hasBroadcaster,
                    primaryPlayUrl,
                    primaryChannelName,
                    channels: stations,
                    myConvertedChannels: converted,
                    liveScore
                });
            });
        });
    } catch (e: any) {
        console.warn('[EspnSoccer] Failed fetching soccer events:', e?.message || e);
    }
    return events;
}

// ==========================================
// 8. MASTER SCHEDULE FETCHER
// ==========================================

export interface ScheduleOptions {
    onlyEnglishAndFamous?: boolean;
    onlyMyChannels?: boolean;
    activeOnly?: boolean;
    onlyLive?: boolean;
    hideEnded?: boolean;
    category?: string;
    search?: string;
}

function transformTimLiveEvent(ev: TimLiveEvent, nowEpochSec: number): StreamicSportEvent {
    let startEpoch = nowEpochSec;
    if (ev.time) {
        try {
            if (typeof ev.time === 'number') {
                startEpoch = ev.time < 1e11 ? Math.floor(ev.time) : Math.floor(ev.time / 1000);
            } else if (typeof ev.time === 'string') {
                if (/^\d+$/.test(ev.time.trim())) {
                    const num = Number(ev.time.trim());
                    startEpoch = num < 1e11 ? num : Math.floor(num / 1000);
                } else {
                    const parsed = new Date(ev.time).getTime();
                    if (!isNaN(parsed)) startEpoch = Math.floor(parsed / 1000);
                }
            }
        } catch(e) {}
    }
    const durationMinutes = 180;
    const endEpoch = startEpoch + (durationMinutes * 60);
    // Live window is startEpoch - 15m to startEpoch + 3h
    const isLive = nowEpochSec >= (startEpoch - 900) && nowEpochSec <= endEpoch;
    const isStartingSoon = !isLive && nowEpochSec < startEpoch && (startEpoch - nowEpochSec) <= 3600;
    const isEnded = nowEpochSec > endEpoch;

    const channels: BroadcastingStation[] = (ev.streams || []).map((s, idx) => {
        const streamSlug = s.embedSlug || ev.url || 'stream';
        const pUrl = buildTimPlayUrl(streamSlug, s.name || `Stream ${idx + 1}`, ev.name);
        return {
            channelName: s.name || `Stream ${idx + 1}`,
            language: 'English',
            isEnglish: true,
            userHasChannel: true,
            userChannelUrl: `https://timst.cfd/channel/${streamSlug}`,
            channelSlug: streamSlug,
            timChannelId: `tim_${streamSlug}`,
            playUrl: pUrl,
            streams: []
        };
    });

    const converted: ConvertedChannel[] = (ev.streams || []).map(s => {
        const streamSlug = s.embedSlug || ev.url || 'stream';
        const pUrl = buildTimPlayUrl(streamSlug, s.name || 'Stream', ev.name);
        return {
            channelName: s.name || 'Stream',
            channelSlug: streamSlug,
            timChannelId: `tim_${streamSlug}`,
            url: `https://timst.cfd/channel/${streamSlug}`,
            playUrl: pUrl,
            matchType: 'DIRECT_MATCH',
            reason: 'TimStreams Official Live Event Stream'
        };
    });

    const istInfo = formatEpgDateIST(new Date(startEpoch * 1000));
    const endIstInfo = formatEpgDateIST(new Date(endEpoch * 1000));
    const sportMeta = getSportMetadata(ev.name, ev.category);
    const primaryUrl = channels[0]?.playUrl || (ev.url ? buildTimPlayUrl(ev.url, ev.name, ev.name) : null);

    return {
        id: `tim_ev_${ev.url}`,
        title: ev.name,
        rawTitle: ev.name,
        sportName: sportMeta.name || ev.category || 'Live Sports',
        sportEmoji: sportMeta.emoji || '🏆',
        category: sportMeta.category || 'sports',
        league: ev.category || 'Tim Live Event',
        countryCode: 'US',
        startTime: startEpoch,
        endTime: endEpoch,
        durationMinutes,
        timeIST: istInfo.istTime,
        dateIST: istInfo.istDate,
        fullIST: istInfo.istFull,
        endTimeIST: endIstInfo.istTime,
        status: isLive ? 'LIVE' : (isEnded ? 'ENDED' : 'UPCOMING'),
        isLive,
        isStartingSoon,
        isEnded,
        canWatch: isLive || isStartingSoon,
        countdown: isLive ? 'LIVE NOW' : (isStartingSoon ? 'Starting soon' : istInfo.istTime),
        hasEnglish: true,
        isFamous: !!ev.featured,
        source: 'TIMSTREAMS',
        channels,
        myConvertedChannels: converted,
        userHasChannel: true,
        primaryPlayUrl: primaryUrl,
        primaryChannelName: channels[0]?.channelName || 'Stream 1',
        thumbnail: ev.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80'
    };
}

// Deduplication & Merging Helpers
function normalizeMatchKey(title: string, startTime: number): string {
    const t = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
    const day = Math.floor((startTime || Math.floor(Date.now() / 1000)) / 86400);
    return `${t}_${day}`;
}

function mergeEvents(existing: StreamicSportEvent, incoming: StreamicSportEvent): StreamicSportEvent {
    if (incoming.channels && incoming.channels.length) {
        existing.channels.push(...incoming.channels.filter(sc => !existing.channels.some(c => c.channelSlug === sc.channelSlug)));
    }
    if (incoming.myConvertedChannels && incoming.myConvertedChannels.length) {
        existing.myConvertedChannels.push(...incoming.myConvertedChannels.filter(mc => !existing.myConvertedChannels.some(c => c.channelSlug === mc.channelSlug)));
    }
    if (!existing.primaryPlayUrl && incoming.primaryPlayUrl) {
        existing.primaryPlayUrl = incoming.primaryPlayUrl;
        existing.primaryChannelName = incoming.primaryChannelName;
        existing.userHasChannel = true;
        existing.canWatch = existing.isLive || existing.isStartingSoon;
    }
    if (!existing.homeTeamLogo && incoming.homeTeamLogo) existing.homeTeamLogo = incoming.homeTeamLogo;
    if (!existing.awayTeamLogo && incoming.awayTeamLogo) existing.awayTeamLogo = incoming.awayTeamLogo;
    if (!existing.officialPosterUrl && incoming.officialPosterUrl) existing.officialPosterUrl = incoming.officialPosterUrl;
    return existing;
}

let cachedSchedule: StreamicSportEvent[] = [];
let lastScheduleFetch = 0;
let isScheduleFetching = false;
const SCHEDULE_CACHE_TTL_MS = 90 * 1000; // 90 seconds cache

async function refreshScheduleInternal(): Promise<StreamicSportEvent[]> {
    if (isScheduleFetching) return cachedSchedule;
    isScheduleFetching = true;
    const nowEpochSec = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    try {
        let streamicEvents: StreamicSportEvent[] = [];
        let sonyEvents: StreamicSportEvent[] = [];
        let espnCricketEvents: StreamicSportEvent[] = [];
        let espnSoccerEvents: StreamicSportEvent[] = [];
        let timLiveEvents: StreamicSportEvent[] = [];
        let liveScores: LiveScoreData[] = [];

        // Parallel Fetch with 6s timeout
        const [streamicRes, sonyRes, cricketRes, soccerRes, scoresRes, timRes] = await Promise.allSettled([
            axios.get('https://streamic.st/api/getEvents.php', {
                headers: STREAMIC_HEADERS,
                timeout: 6000,
                httpsAgent
            }),
            getSonyLiveEvents(),
            fetchEspnCricketEvents(),
            fetchEspnSoccerEvents(),
            fetchLiveScores(),
            getTimLiveEvents()
        ]);

        if (scoresRes.status === 'fulfilled' && scoresRes.value) {
            liveScores = scoresRes.value;
        }
        if (cricketRes.status === 'fulfilled' && Array.isArray(cricketRes.value)) {
            espnCricketEvents = cricketRes.value;
        }
        if (soccerRes.status === 'fulfilled' && Array.isArray(soccerRes.value)) {
            espnSoccerEvents = soccerRes.value;
        }
        if (timRes.status === 'fulfilled' && Array.isArray(timRes.value)) {
            timLiveEvents = timRes.value.map(ev => transformTimLiveEvent(ev, nowEpochSec));
        }

        // Process Streamic
        if (streamicRes.status === 'fulfilled' && streamicRes.value?.data) {
            try {
                const rawBody = streamicRes.value.data;
                let decodedJson = rawBody;
                if (typeof rawBody === 'string') {
                    try {
                        decodedJson = Buffer.from(rawBody.trim(), 'base64').toString('utf8');
                    } catch (e) {
                        decodedJson = rawBody;
                    }
                }
                const parsed = typeof decodedJson === 'string' ? JSON.parse(decodedJson) : decodedJson;
                if (Array.isArray(parsed)) {
                    streamicEvents = parsed.map((raw: any) => transformStreamicEvent(raw, nowEpochSec));
                }
            } catch (e: any) {
                console.warn('[Streamic] Failed parsing primary getEvents:', e?.message || e);
            }
        }

        // Fallback to /api/J.php if getEvents is empty
        if (streamicEvents.length === 0) {
            try {
                const popRes = await axios.get('https://streamic.st/api/J.php', {
                    headers: STREAMIC_HEADERS,
                    timeout: 5000,
                    httpsAgent
                });
                if (popRes.data) {
                    const parsed = typeof popRes.data === 'string' ? JSON.parse(popRes.data) : popRes.data;
                    if (Array.isArray(parsed)) {
                        streamicEvents = parsed.map((raw: any) => transformStreamicEvent(raw, nowEpochSec));
                    }
                }
            } catch (e) {}
        }

        // Process Sony
        if (sonyRes.status === 'fulfilled' && Array.isArray(sonyRes.value)) {
            sonyEvents = sonyRes.value;
        }

        // Aggregate All Events
        const masterMap = new Map<string, StreamicSportEvent>();

        // 1. Sony Official EPG Events
        sonyEvents.forEach(e => {
            const key = normalizeMatchKey(e.title, e.startTime);
            masterMap.set(key, e);
        });

        // 2. Streamic Events
        streamicEvents.forEach(e => {
            const key = normalizeMatchKey(e.title, e.startTime);
            const existing = masterMap.get(key);
            if (existing) {
                const merged = mergeEvents(existing, e);
                masterMap.set(key, merged);
            } else {
                masterMap.set(key, e);
            }
        });

        // 3. ESPN Cricket Events
        espnCricketEvents.forEach(e => {
            const key = normalizeMatchKey(e.title, e.startTime);
            const existing = masterMap.get(key);
            if (existing) {
                const merged = mergeEvents(existing, e);
                masterMap.set(key, merged);
            } else {
                masterMap.set(key, e);
            }
        });

        // 4. ESPN Soccer Events
        espnSoccerEvents.forEach(e => {
            const key = normalizeMatchKey(e.title, e.startTime);
            const existing = masterMap.get(key);
            if (existing) {
                const merged = mergeEvents(existing, e);
                masterMap.set(key, merged);
            } else {
                masterMap.set(key, e);
            }
        });

        // 5. TimStreams Live Events
        timLiveEvents.forEach(e => {
            const key = normalizeMatchKey(e.title, e.startTime);
            const existing = masterMap.get(key);
            if (existing) {
                const merged = mergeEvents(existing, e);
                masterMap.set(key, merged);
            } else {
                masterMap.set(key, e);
            }
        });

        let allEvents = Array.from(masterMap.values());

        // Attach Live Scores & Thumbnails
        allEvents = allEvents.map(ev => {
            const score = matchLiveScore(ev, liveScores);
            if (score) ev.liveScore = score;
            ev.thumbnail = resolveOfficialThumbnail(ev);
            return ev;
        });

        // Sort: LIVE first, then STARTING_SOON, then UPCOMING by startTime
        allEvents.sort((a, b) => {
            const priority: Record<string, number> = {
                LIVE: 1,
                STARTING_SOON: 2,
                UPCOMING: 3,
                ENDED: 4
            };
            const pA = priority[a.status] || 99;
            const pB = priority[b.status] || 99;
            if (pA !== pB) return pA - pB;
            return a.startTime - b.startTime;
        });

        if (allEvents.length > 0) {
            cachedSchedule = allEvents;
            lastScheduleFetch = nowMs;
        }
    } catch (e: any) {
        console.warn('[StreamicSportsService] Background refresh error:', e?.message || e);
    } finally {
        isScheduleFetching = false;
    }
    return cachedSchedule;
}

// Background auto-refresh every 75s
setInterval(() => {
    refreshScheduleInternal().catch(() => {});
}, 75 * 1000);

export async function getLiveSportsSchedule(options: ScheduleOptions = {}, force = false): Promise<StreamicSportEvent[]> {
    const nowEpochSec = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    // Instant return if cache is present (sub-1ms)
    if (cachedSchedule.length > 0) {
        if ((force && nowMs - lastScheduleFetch > 15000) || (nowMs - lastScheduleFetch > SCHEDULE_CACHE_TTL_MS)) {
            // Trigger background refresh without blocking response
            refreshScheduleInternal().catch(() => {});
        }
        return filterEvents(cachedSchedule, options, nowEpochSec);
    }

    // Cold start - do initial fetch
    const events = await refreshScheduleInternal();
    return filterEvents(events, options, nowEpochSec);
}

function filterEvents(events: StreamicSportEvent[], options: ScheduleOptions, nowEpochSec: number): StreamicSportEvent[] {
    let list = [...events];

    // Re-evaluate live state based on current epoch
    list.forEach(e => {
        const secUntilStart = e.startTime - nowEpochSec;
        const minUntilStart = Math.round(secUntilStart / 60);
        const secElapsed = nowEpochSec - e.startTime;
        const minElapsed = Math.round(secElapsed / 60);
        const hasLiveStreams = Boolean((e.channels && e.channels.length > 0 && e.userHasChannel) || e.primaryPlayUrl);

        if (nowEpochSec >= e.endTime) {
            e.status = 'ENDED';
            e.isEnded = true;
            e.isLive = false;
            e.isStartingSoon = false;
            e.canWatch = false;
        } else if (nowEpochSec >= e.startTime) {
            e.status = 'LIVE';
            e.isLive = true;
            e.isStartingSoon = false;
            e.canWatch = hasLiveStreams;
            e.countdown = `🔴 LIVE now (${minElapsed}m in)`;
        } else if (secUntilStart <= 20 * 60) {
            e.status = 'STARTING_SOON';
            e.isStartingSoon = true;
            e.isLive = false;
            e.canWatch = hasLiveStreams;
            e.countdown = minUntilStart <= 1 ? 'Starting in < 1 min' : `Starting in ${minUntilStart} mins`;
        } else {
            e.status = 'UPCOMING';
            e.isLive = false;
            e.isStartingSoon = false;
            e.canWatch = false;
            const h = Math.floor(minUntilStart / 60);
            const m = minUntilStart % 60;
            e.countdown = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${minUntilStart}m`;
        }
    });

    if (options.onlyEnglishAndFamous) {
        list = list.filter(e => e.hasEnglish || e.isFamous || e.category === 'asian_games');
    }
    if (options.onlyMyChannels) {
        list = list.filter(e => e.userHasChannel);
    }
    // Strict automatic filter: ended matches will NOT be shown
    list = list.filter(e => {
        if (e.isEnded || e.status === 'ENDED') return false;
        if (e.endTime && e.endTime <= nowEpochSec) return false;
        if (e.liveScore && (e.liveScore.isFinal || e.liveScore.detail === 'Final' || e.liveScore.detail === 'FT' || e.liveScore.detail === 'Full Time')) return false;
        return true;
    });
    if (options.onlyLive) {
        list = list.filter(e => e.isLive);
    } else if (options.activeOnly) {
        list = list.filter(e => e.canWatch);
    }
    if (options.category) {
        const cat = options.category.toLowerCase().replace(/[-_]/g, ' ').trim();
        list = list.filter(e =>
            e.category.toLowerCase().replace(/[-_]/g, ' ').includes(cat) ||
            e.sportName.toLowerCase().replace(/[-_]/g, ' ').includes(cat) ||
            e.title.toLowerCase().includes(cat) ||
            e.league.toLowerCase().includes(cat)
        );
    }
    if (options.search) {
        const q = options.search.toLowerCase();
        list = list.filter(e =>
            e.title.toLowerCase().includes(q) ||
            e.league.toLowerCase().includes(q) ||
            e.channels.some(c => c.channelName.toLowerCase().includes(q)) ||
            e.myConvertedChannels.some(c => c.channelName.toLowerCase().includes(q))
        );
    }

    return list;
}
