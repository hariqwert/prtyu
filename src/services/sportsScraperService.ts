import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getChannelsList, getChannelStreamUrl } from './channelJsonService';
import { UrlGenerator } from './siteMap';
import { fetchWillowEvents } from './willowService';

export interface SportsEvent {
    id: string;
    title: string;
    sport: string;
    league: string;
    homeTeam?: string;
    awayTeam?: string;
    homeLogo?: string;
    awayLogo?: string;
    time: string;
    isLive: boolean;
    status: string; // 'LIVE', 'UPCOMING', 'FINISHED'
    channelName?: string;
    channelUrl?: string;
    playUrl?: string;
    channels: Array<{
        name: string;
        url: string;
        playUrl: string;
        logo?: string;
        quality?: string;
    }>;
}

export interface GoogleSportsResult {
    id: string;
    title: string;
    sport: string;
    league: string;
    status: 'LIVE' | 'UPCOMING' | 'FINISHED';
    eventTime: string;
    isSpotlight: boolean;
    homeTeam: {
        name: string;
        logo: string;
        score: string | number;
    };
    awayTeam: {
        name: string;
        logo: string;
        score: string | number;
    };
    scoreCardSummary: string;
    venue?: string;
    broadcasterChannel: string;
    streamUrl: string;
    playUrl: string;
    bgUrl: string;
}

export interface SuperSportChannel {
    name: string;
    channelNumber?: string;
    category: string;
    logo: string;
    streamUrl: string;
    playUrl: string;
    currentShow?: string;
}

// In-memory cache for live scraped sports events
let cachedEvents: SportsEvent[] = [];
let lastEventFetchTime = 0;
const EVENTS_CACHE_MS = 5 * 60 * 1000; // 5 minutes cache

// SuperSport Channel List definition with logos & standard matching
const SUPER_SPORT_FEEDS = [
    { name: 'SuperSport Grandstand', category: 'Multi-Sport', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Premier League', category: 'Football', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Football', category: 'Football', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport LaLiga', category: 'Football', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Variety 1', category: 'Multi-Sport', logo: '/assets/logos/supersport_variety_1.svg' },
    { name: 'SuperSport Variety 2', category: 'Multi-Sport', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Variety 3', category: 'Multi-Sport', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Variety 4', category: 'Multi-Sport', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Action', category: 'Action & Combat', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Rugby', category: 'Rugby', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Cricket', category: 'Cricket', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Golf', category: 'Golf', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Tennis', category: 'Tennis', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' },
    { name: 'SuperSport Motorsport', category: 'Motorsport', logo: 'https://i.imgur.com/gCjaY0F.png' },
    { name: 'SuperSport Blitz', category: 'News & Highlights', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png' }
];

export class SportsScraperService {
    /**
     * Get all active SuperSport channel streams resolved from channels.json
     */
    static getSuperSportChannels(): SuperSportChannel[] {
        const allChannels = getChannelsList();
        const results: SuperSportChannel[] = [];

        for (const feed of SUPER_SPORT_FEEDS) {
            // Find in channels catalog
            const matched = allChannels.find((c: any) => {
                const name = (c.name || c.title || '').toLowerCase();
                const feedName = feed.name.toLowerCase();
                return name === feedName || name.includes(feedName) || (name.includes('supersport') && name.includes(feed.name.replace('SuperSport ', '').toLowerCase()));
            });

            if (matched) {
                const streamUrl = getChannelStreamUrl(matched);
                results.push({
                    name: matched.name || feed.name,
                    category: feed.category,
                    logo: matched.logo || feed.logo,
                    streamUrl: streamUrl,
                    playUrl: UrlGenerator.generateChannelStreamUrl(streamUrl, matched.name || feed.name, matched.logo || feed.logo, 'supersport')
                });
            } else {
                // Fallback direct stream endpoint
                const fallbackUrl = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(feed.name)}&m3u=1`;
                results.push({
                    name: feed.name,
                    category: feed.category,
                    logo: feed.logo,
                    streamUrl: fallbackUrl,
                    playUrl: `/play_consumet.php?name=${encodeURIComponent(feed.name)}&logo=${encodeURIComponent(feed.logo)}&source=supersport`
                });
            }
        }

        return results;
    }

    /**
     * Scrape live sports event schedules and map to IPTV streams
     */
    static async scrapeLiveSportsEvents(force: boolean = false): Promise<SportsEvent[]> {
        const now = Date.now();
        if (!force && cachedEvents.length > 0 && (now - lastEventFetchTime < EVENTS_CACHE_MS)) {
            return cachedEvents;
        }

        const events: SportsEvent[] = [];
        const allChannels = getChannelsList();

        // Helper to find best channel streams for a given channel name
        const findChannelStreams = (chNames: string[]) => {
            const list: Array<{ name: string; url: string; playUrl: string; logo?: string; quality?: string }> = [];
            for (const chName of chNames) {
                if (!chName) continue;
                const clean = chName.trim().toLowerCase();
                const matched = allChannels.filter((c: any) => {
                    const n = (c.name || c.title || '').toLowerCase();
                    return n.includes(clean) || clean.includes(n);
                }).slice(0, 3);

                for (const m of matched) {
                    const streamUrl = getChannelStreamUrl(m);
                    list.push({
                        name: m.name || chName,
                        url: streamUrl,
                        playUrl: UrlGenerator.generateChannelStreamUrl(streamUrl, m.name || chName, m.logo, 'sports_scraper'),
                        logo: m.logo,
                        quality: (m.name || '').includes('HD') ? '1080P' : '720P'
                    });
                }
            }
            return list;
        };

        // 1. Try scraping from live schedule JSON aggregators (DLHD, TimStreams, SportSurge feeds)
        try {
            const scheduleUrls = [
                'https://hamis.romponalis.st/schedule.json',
                'https://dlhd.st/schedule/schedule-generated.json'
            ];

            for (const schedUrl of scheduleUrls) {
                try {
                    const resp = await axios.get(schedUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://dlhd.st/'
                        },
                        timeout: 3500
                    });

                    if (resp.data) {
                        const rawData = resp.data;
                        // Parse schedule structure
                        const categories = Array.isArray(rawData) ? rawData : (rawData.events || rawData.schedule || Object.values(rawData));
                        
                        for (const cat of categories) {
                            if (!cat) continue;
                            const catName = cat.category || cat.sport || 'Sports';
                            const items = Array.isArray(cat.events || cat.matches || cat) ? (cat.events || cat.matches || cat) : [];

                            for (const item of items) {
                                if (!item || typeof item !== 'object') continue;
                                const title = item.event || item.title || item.name || `${item.homeTeam || ''} vs ${item.awayTeam || ''}`.trim();
                                if (!title || title.length < 3) continue;

                                const timeStr = item.time || item.startTime || item.date || 'LIVE NOW';
                                const isLive = timeStr.toLowerCase().includes('live') || timeStr.toLowerCase().includes('now') || (item.status === 'live');
                                
                                const channelNames: string[] = [];
                                if (item.channels && Array.isArray(item.channels)) {
                                    for (const c of item.channels) {
                                        if (typeof c === 'string') channelNames.push(c);
                                        else if (c && c.name) channelNames.push(c.name);
                                    }
                                } else if (item.channel) {
                                    channelNames.push(item.channel);
                                }

                                const streamChannels = findChannelStreams(channelNames);
                                const defaultStream = streamChannels[0] || {
                                    name: channelNames[0] || 'Live Sports Stream',
                                    url: `/play_consumet.php?name=${encodeURIComponent(title)}&source=sports_scraper`,
                                    playUrl: `/play_consumet.php?name=${encodeURIComponent(title)}&source=sports_scraper`
                                };

                                events.push({
                                    id: `evt-${events.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
                                    title: title,
                                    sport: catName,
                                    league: item.league || catName,
                                    homeTeam: item.homeTeam || (title.includes(' vs ') ? title.split(' vs ')[0].trim() : undefined),
                                    awayTeam: item.awayTeam || (title.includes(' vs ') ? title.split(' vs ')[1].trim() : undefined),
                                    time: timeStr,
                                    isLive: isLive,
                                    status: isLive ? 'LIVE' : 'UPCOMING',
                                    channelName: defaultStream.name,
                                    channelUrl: defaultStream.url,
                                    playUrl: defaultStream.playUrl,
                                    channels: streamChannels
                                });
                            }
                        }
                    }
                    if (events.length > 0) break; // Successfully parsed
                } catch (e) {
                    // Try next source
                }
            }
        } catch (err: any) {
            console.warn('[SportsScraper] Live feed query notice:', err.message);
        }

        cachedEvents = events;
        lastEventFetchTime = Date.now();
        console.log(`[SportsScraper] Cataloged ${events.length} real live & upcoming sports fixtures.`);
        return events;
    }

    /**
     * Search sports events by team, tournament, sport, or keyword
     */
    static async searchSports(query: string): Promise<{
        events: SportsEvent[];
        supersport: SuperSportChannel[];
        channels: any[];
    }> {
        const q = (query || '').trim().toLowerCase();
        const allEvents = await this.scrapeLiveSportsEvents();
        const superSportChannels = this.getSuperSportChannels();
        const allChannels = getChannelsList();

        // 1. Filter events matching query
        let matchedEvents = allEvents;
        if (q && q !== 'sports' && q !== 'live' && q !== 'all') {
            matchedEvents = allEvents.filter(e => {
                const t = e.title.toLowerCase();
                const s = e.sport.toLowerCase();
                const l = e.league.toLowerCase();
                const ch = (e.channelName || '').toLowerCase();
                return t.includes(q) || s.includes(q) || l.includes(q) || ch.includes(q);
            });
        }

        // 2. Filter matching SuperSport channels
        let matchedSuperSport = superSportChannels;
        if (q && q.includes('super')) {
            matchedSuperSport = superSportChannels.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
        }

        // 3. Filter direct sports TV channels
        const sportsChannels = allChannels.filter((c: any) => {
            const name = (c.name || c.title || '').toLowerCase();
            const genre = (c.genre || c.group || '').toLowerCase();
            const isSports = genre.includes('sport') || name.includes('sport') || name.includes('espn') || name.includes('f1') || name.includes('cricket') || name.includes('football') || name.includes('ten') || name.includes('star');
            if (!isSports) return false;
            if (!q || q === 'sports' || q === 'live') return true;
            return name.includes(q) || genre.includes(q);
        }).slice(0, 12).map((c: any) => {
            const streamUrl = getChannelStreamUrl(c);
            return {
                ...c,
                streamUrl,
                playUrl: UrlGenerator.generateChannelStreamUrl(streamUrl, c.name, c.logo, 'sports_search')
            };
        });

        return {
            events: matchedEvents.slice(0, 10),
            supersport: matchedSuperSport,
            channels: sportsChannels
        };
    }
}


export class SportsMatchBroadcasterResolver {
    // Official Real-World Sports Broadcasting Rights Mapping
    static resolveBroadcasters(query: string): string[] {
        const q = (query || '').toLowerCase();
        
        // 1. Sri Lanka Cricket (SLC) Bilateral Matches (India vs Sri Lanka, SL vs Any team)
        // Official Rights Holder: Sony Pictures Networks India (Sony Sports Ten 1, 3, 5, Sony LIV)
        if (q.includes('sri lanka') || q.includes('srilanka') || q.includes('slc') || (q.includes('india') && q.includes('lanka'))) {
            return [
                'Sony Sports Ten 5 HD',
                'Sony Sports Ten 1 HD',
                'Sony Sports Ten 3 HD',
                'Sony Ten 5 HD',
                'Sony Ten 1 HD',
                'Sony Ten 3 HD Hindi',
                'SONY TEN 5 4K',
                'SONY TEN 3 4K',
                'Willow HD',
                'Sky Sports Cricket'
            ];
        }

        // 2. England Home Series (ECB - England vs India, Ashes in UK, England vs Pakistan)
        // Official Rights: Sony Sports Network in India, Sky Sports in UK
        if (q.includes('england') && (q.includes('india') || q.includes('pakistan') || q.includes('test') || q.includes('ashes'))) {
            return [
                'Sony Sports Ten 1 HD',
                'Sony Sports Ten 5 HD',
                'Sony Ten 1 HD',
                'Sony Ten 5 HD',
                'Sky Sports Cricket',
                'Sky Sports Main Event'
            ];
        }

        // 3. Indian Premier League (IPL) & BCCI Home Matches in India
        // Official Rights: Star Sports Network (Star Sports 1 Hindi 4K, Star Sports 1 HD)
        if (q.includes('ipl') || q.includes('indian premier league') || q.includes('csk') || q.includes('mi') || q.includes('rcb') || q.includes('kkr')) {
            return [
                'STAR SPORTS 1 HINDI 4K',
                'Star Sports 1 HD',
                'Star Sports 1 Hindi',
                'Star Sports Select 1 HD',
                'Willow HD',
                'SuperSport Cricket',
                'Sky Sports Cricket'
            ];
        }

        // 4. Australia Home Series (Cricket Australia - BGT in Australia, Big Bash)
        // Official Rights: Star Sports in India, Fox Cricket in Australia
        if (q.includes('australia') && (q.includes('india') || q.includes('bgt') || q.includes('bbl') || q.includes('test'))) {
            return [
                'STAR SPORTS 1 HINDI 4K',
                'Star Sports 1 HD',
                'Star Sports 1 Hindi',
                'Fox Cricket',
                'Willow HD',
                'Sky Sports Cricket'
            ];
        }

        // 5. General International Cricket / World Cups (ICC Events)
        if (q.includes('cricket') || q.includes('icc') || q.includes('world cup') || q.includes('t20')) {
            return [
                'STAR SPORTS 1 HINDI 4K',
                'Star Sports 1 HD',
                'Sony Sports Ten 5 HD',
                'Sony Sports Ten 1 HD',
                'Willow HD',
                'Sky Sports Cricket',
                'Astro Cricket'
            ];
        }

        // 6. UEFA Champions League & Europa League
        // Official Rights: Sony Sports Network (Sony Sports Ten 2, Ten 3) & TNT Sports
        if (q.includes('champions league') || q.includes('ucl') || q.includes('europa') || q.includes('real madrid') || q.includes('barcelona') || q.includes('bayern') || q.includes('psg')) {
            return [
                'Sony Sports Ten 2 HD',
                'Sony Sports Ten 3 HD',
                'Sony Ten 2 HD',
                'TNT Sports 1',
                'TNT Sports 2',
                'SuperSport Football'
            ];
        }

        // 7. English Premier League (EPL)
        // Official Rights: Star Sports Select HD in India, Sky Sports & TNT in UK, SuperSport in SA
        if (q.includes('premier league') || q.includes('arsenal') || q.includes('chelsea') || q.includes('liverpool') || q.includes('manchester') || q.includes('tottenham') || q.includes('epl')) {
            return [
                'SuperSport Premier League',
                'Sky Sports Main Event',
                'Sky Sports Premier League',
                'TNT Sports 1',
                'Star Sports Select 1 HD',
                'USA Network'
            ];
        }

        // 8. Formula 1 Motorsport
        if (q.includes('f1') || q.includes('formula 1') || q.includes('grand prix') || q.includes('verstappen') || q.includes('hamilton') || q.includes('ferrari') || q.includes('qualifying')) {
            return [
                'Sky Sports F1',
                'DAZN F1',
                'ESPN HD',
                'SuperSport Motorsport'
            ];
        }

        // 9. UFC / MMA / WWE / Boxing
        // Official Rights: Sony Sports Ten 2 HD & SuperSport Action / TNT Sports
        if (q.includes('ufc') || q.includes('mma') || q.includes('wwe') || q.includes('boxing') || q.includes('fight')) {
            return [
                'Sony Sports Ten 2 HD',
                'Sony Ten 2 HD',
                'Sony Sports Ten 1 HD',
                'SuperSport Action',
                'TNT Sports 1'
            ];
        }

        // 10. NBA Basketball
        if (q.includes('nba') || q.includes('lakers') || q.includes('warriors') || q.includes('celtics')) {
            return [
                'ESPN',
                'TNT Sports 3',
                'SuperSport Variety 1',
                'Sony Sports Ten 3'
            ];
        }
        
        return [
            'Sony Sports Ten 5 HD',
            'STAR SPORTS 1 HINDI 4K',
            'Sky Sports Main Event',
            'SuperSport Premier League',
            'Willow HD'
        ];
    }
}

export class GoogleSportsResultsEngine {
    private static cache: GoogleSportsResult[] = [];
    private static lastFetch = 0;
    private static CACHE_MS = 2 * 60 * 1000; // 2 min live cache

    /**
     * Fetch Google Sports Results for world sports events and live scorecards
     */
    static async fetchGoogleSportsResults(force: boolean = false): Promise<GoogleSportsResult[]> {
        const now = Date.now();
        if (!force && this.cache.length > 0 && (now - this.lastFetch < this.CACHE_MS)) {
            return this.cache;
        }

        const worldEvents: GoogleSportsResult[] = [];

        try {
            const feedUrls = [
                'https://hamis.romponalis.st/schedule.json',
                'https://dlhd.st/schedule/schedule-generated.json'
            ];

            for (const url of feedUrls) {
                try {
                    const resp = await axios.get(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GoogleSportsResultsAPI/2.0',
                            'Referer': 'https://google.com/'
                        },
                        timeout: 3500
                    });

                    if (resp.data) {
                        const raw = resp.data;
                        const categories = Array.isArray(raw) ? raw : (raw.events || raw.schedule || Object.values(raw));
                        
                        for (const cat of categories) {
                            if (!cat) continue;
                            const sport = cat.category || cat.sport || 'World Sports';
                            const matches = Array.isArray(cat.events || cat.matches || cat) ? (cat.events || cat.matches || cat) : [];

                            for (const m of matches) {
                                if (!m || typeof m !== 'object') continue;
                                const title = m.event || m.title || m.name || `${m.homeTeam || m.home || ''} vs ${m.awayTeam || m.away || ''}`.trim();
                                if (!title || title.length < 3) continue;

                                const homeName = m.homeTeam || m.home || (title.includes(' vs ') ? title.split(' vs ')[0].trim() : 'Home Team');
                                const awayName = m.awayTeam || m.away || (title.includes(' vs ') ? title.split(' vs ')[1].trim() : 'Away Team');
                                const homeScore = m.homeScore !== undefined ? m.homeScore : (m.score ? m.score.split('-')[0]?.trim() || '0' : '0');
                                const awayScore = m.awayScore !== undefined ? m.awayScore : (m.score ? m.score.split('-')[1]?.trim() || '0' : '0');
                                const timeStr = m.time || m.startTime || 'LIVE';
                                const isLive = timeStr.toLowerCase().includes('live') || timeStr.toLowerCase().includes('now') || m.status === 'live';

                                const broadcasters = SportsMatchBroadcasterResolver.resolveBroadcasters(title + ' ' + sport);
                                const primaryChannel = broadcasters[0] || 'Sony Sports Ten 2 HD';
                                const playUrl = `/play_consumet.php?name=${encodeURIComponent(title)}&source=google_sports`;
                                const streamUrl = `/live.php?token=STALKER_PRO&id=${encodeURIComponent(primaryChannel)}&m3u=1`;

                                let bgUrl = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2560';
                                const sportLower = sport.toLowerCase();
                                if (sportLower.includes('cricket')) {
                                    bgUrl = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2560';
                                } else if (sportLower.includes('foot') || sportLower.includes('soccer')) {
                                    bgUrl = 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2560';
                                } else if (sportLower.includes('basket') || sportLower.includes('nba')) {
                                    bgUrl = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2560';
                                } else if (sportLower.includes('f1') || sportLower.includes('motor')) {
                                    bgUrl = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=2560';
                                }

                                worldEvents.push({
                                    id: `gsp-${worldEvents.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
                                    title: title,
                                    sport: sport,
                                    league: m.league || cat.league || sport,
                                    status: isLive ? 'LIVE' : 'UPCOMING',
                                    eventTime: timeStr,
                                    isSpotlight: true,
                                    homeTeam: {
                                        name: homeName,
                                        logo: m.homeLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(homeName)}&background=1e293b&color=fff&bold=true`,
                                        score: homeScore
                                    },
                                    awayTeam: {
                                        name: awayName,
                                        logo: m.awayLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(awayName)}&background=1e293b&color=fff&bold=true`,
                                        score: awayScore
                                    },
                                    scoreCardSummary: `${homeName} ${homeScore} - ${awayScore} ${awayName} (${timeStr})`,
                                    venue: m.venue || 'International Stadium',
                                    broadcasterChannel: primaryChannel,
                                    streamUrl: streamUrl,
                                    playUrl: playUrl,
                                    bgUrl: bgUrl
                                });
                            }
                        }
                    }
                    if (worldEvents.length > 0) break;
                } catch(e) {}
            }
        } catch (e) {}

        this.cache = worldEvents;
        this.lastFetch = Date.now();
        return worldEvents;
    }

    static async getSpotlightEvents(force: boolean = false): Promise<GoogleSportsResult[]> {
        const [all, willowEvents] = await Promise.all([
            this.fetchGoogleSportsResults(force).catch(() => []),
            fetchWillowEvents(force).catch(() => [])
        ]);

        const spotlightResults: GoogleSportsResult[] = [];

        // 1. Convert Live & Featured Willow Events into high-priority spotlight results
        for (const w of (willowEvents || [])) {
            if (!w || !w.title) continue;
            const isLive = w.isLive || w.status === 'LIVE' || w.isWillowActiveBroadcast;
            const home = w.title.includes(' vs ') ? w.title.split(' vs ')[0].trim() : w.name || 'Team 1';
            const away = w.title.includes(' vs ') ? w.title.split(' vs ')[1].trim() : 'Team 2';

            spotlightResults.push({
                id: `willow-spot-${w.id || w.matchId || Math.random().toString(36).substring(2, 7)}`,
                title: w.title || w.name,
                sport: 'Cricket',
                league: w.league || 'Willow Cricket',
                status: isLive ? 'LIVE' : 'UPCOMING',
                eventTime: w.timeIST || w.time || (isLive ? 'LIVE' : 'TODAY'),
                isSpotlight: true,
                homeTeam: {
                    name: home,
                    logo: w.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(home)}&background=1e293b&color=fff&bold=true`,
                    score: '0'
                },
                awayTeam: {
                    name: away,
                    logo: w.cover_image || w.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(away)}&background=1e293b&color=fff&bold=true`,
                    score: '0'
                },
                scoreCardSummary: `${w.title} (${isLive ? 'LIVE' : (w.timeIST || 'TODAY')})`,
                venue: 'International Cricket Ground',
                broadcasterChannel: 'Willow HD',
                streamUrl: w.streamUrl || '/api/live/willow',
                playUrl: w.playUrl || `/play_consumet.php?name=${encodeURIComponent(w.title)}&source=willow`,
                bgUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2560'
            });
        }

        // 2. Add scraped spotlight events from Google sports engine
        const filtered = all.filter(e => e.isSpotlight);
        spotlightResults.push(...filtered);

        // 3. Priority scoring algorithm: Give highest priority to India, Test cricket, Willow, IPL & Major Leagues
        const getPriorityScore = (event: GoogleSportsResult): number => {
            let score = 0;
            const title = (event.title || '').toLowerCase();
            const sport = (event.sport || '').toLowerCase();
            const league = (event.league || '').toLowerCase();
            const isLive = event.status === 'LIVE';

            // Base Live bonus
            if (isLive) score += 500;

            // Direct Willow Cricket broadcast bonus
            if (event.broadcasterChannel && event.broadcasterChannel.toLowerCase().includes('willow')) {
                score += 400;
            }

            // India Match / Test Cricket / ICC
            if (title.includes('india') || title.includes('ind vs') || title.includes('vs ind') || title.includes('bcci')) {
                score += 1000; // Peak priority
            }
            if (title.includes('test') || league.includes('test') || title.includes('ashes') || title.includes('border-gavaskar') || title.includes('bgt')) {
                score += 800; // Test matches get huge priority
            }
            if (title.includes('ipl') || league.includes('ipl') || title.includes('premier league') && sport.includes('cricket')) {
                score += 700;
            }
            if (sport.includes('cricket') || league.includes('icc') || league.includes('world cup')) {
                score += 600;
            }

            // Major Football Leagues
            if (title.includes('real madrid') || title.includes('barcelona') || title.includes('manchester') || title.includes('arsenal') || title.includes('liverpool') || title.includes('champions league') || title.includes('ucl')) {
                score += 350;
            }
            if (league.includes('premier league') || league.includes('la liga') || league.includes('serie a')) {
                score += 250;
            }

            // F1 & Major sports
            if (sport.includes('f1') || sport.includes('formula') || title.includes('grand prix')) {
                score += 200;
            }

            return score;
        };

        // Sort descending by priority score
        return spotlightResults.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    }
}
