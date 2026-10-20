import axios from 'axios';
import { SportsMatchBroadcasterResolver } from './sportsScraperService';
import { getChannelsList, getChannelStreamUrl } from './channelJsonService';

export interface WeatherData {
    city: string;
    country: string;
    temperatureC: number;
    temperatureF: number;
    condition: string;
    icon: string;
    windSpeed: number;
    humidity?: number;
    time: string;
}

export interface NewsArticle {
    title: string;
    source: string;
    url: string;
    publishedAt: string;
    category: string;
    snippet?: string;
}

export interface SportsScore {
    id: string;
    match: string;
    sport: string;
    league: string;
    status: string;
    score: string;
    details: string;
    summary: string;
    channel?: string;
    streamUrl?: string;
    playUrl?: string;
}

const WEATHER_CODES: Record<number, { text: string; icon: string }> = {
    0: { text: 'Clear Sky ☀️', icon: 'sun' },
    1: { text: 'Mainly Clear 🌤️', icon: 'sun-medium' },
    2: { text: 'Partly Cloudy ⛅', icon: 'cloud-sun' },
    3: { text: 'Overcast ☁️', icon: 'cloud' },
    45: { text: 'Foggy 🌫️', icon: 'cloud-fog' },
    48: { text: 'Depositing Rime Fog 🌫️', icon: 'cloud-fog' },
    51: { text: 'Light Drizzle 🌦️', icon: 'cloud-drizzle' },
    53: { text: 'Moderate Drizzle 🌧️', icon: 'cloud-drizzle' },
    55: { text: 'Dense Drizzle 🌧️', icon: 'cloud-rain' },
    61: { text: 'Slight Rain 🌧️', icon: 'cloud-rain' },
    63: { text: 'Moderate Rain 🌧️', icon: 'cloud-rain' },
    65: { text: 'Heavy Rain ⛈️', icon: 'cloud-rain' },
    71: { text: 'Slight Snow 🌨️', icon: 'cloud-snow' },
    73: { text: 'Moderate Snow ❄️', icon: 'snowflake' },
    75: { text: 'Heavy Snow ❄️', icon: 'snowflake' },
    80: { text: 'Slight Rain Showers 🌦️', icon: 'cloud-rain' },
    81: { text: 'Moderate Showers 🌧️', icon: 'cloud-rain' },
    82: { text: 'Violent Showers ⛈️', icon: 'cloud-lightning' },
    95: { text: 'Thunderstorm ⚡', icon: 'cloud-lightning' },
    96: { text: 'Thunderstorm with Hail ⛈️', icon: 'cloud-lightning' }
};

export class WeatherService {
    static async getWeather(cityQuery: string = 'London'): Promise<WeatherData | null> {
        try {
            let cleanCity = cityQuery
                .replace(/weather in|weather of|temperature in|forecast for|weather/i, '')
                .replace(/(?:right now|today|currently|please|tell me).*/i, '')
                .trim() || 'London';

            const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`, { timeout: 4000 });
            if (!geoRes.data?.results?.length) return null;

            const loc = geoRes.data.results[0];
            const wRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`, { timeout: 4000 });
            
            const curr = wRes.data?.current_weather;
            if (!curr) return null;

            const tempC = Math.round(curr.temperature * 10) / 10;
            const tempF = Math.round(tempC * 9/5 + 32);
            const wInfo = WEATHER_CODES[curr.weathercode] || { text: 'Partly Cloudy ⛅', icon: 'cloud' };

            return {
                city: loc.name,
                country: loc.country || '',
                temperatureC: tempC,
                temperatureF: tempF,
                condition: wInfo.text,
                icon: wInfo.icon,
                windSpeed: curr.windspeed,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
        } catch (e: any) {
            console.warn('[WeatherService] Notice:', e.message);
            return null;
        }
    }
}

export class NewsService {
    static async getBreakingNews(category: string = 'top'): Promise<NewsArticle[]> {
        try {
            let feedUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
            const catLower = category.toLowerCase();
            
            if (catLower.includes('sport') || catLower.includes('cricket') || catLower.includes('football')) {
                feedUrl = 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en';
            } else if (catLower.includes('tech') || catLower.includes('ai') || catLower.includes('software')) {
                feedUrl = 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en';
            } else if (catLower.includes('movie') || catLower.includes('cinema') || catLower.includes('entertainment')) {
                feedUrl = 'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en';
            } else if (catLower.includes('business') || catLower.includes('finance')) {
                feedUrl = 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en';
            }

            const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`, { timeout: 5000 });
            if (res.data?.items?.length) {
                return res.data.items.slice(0, 8).map((item: any) => ({
                    title: item.title?.replace(/ - [^-]+$/, '') || item.title,
                    source: item.author || (item.title?.match(/ - ([^-]+)$/)?.[1]) || 'Google News',
                    url: item.link || item.guid,
                    publishedAt: item.pubDate ? new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
                    category: category.toUpperCase(),
                    snippet: (item.description || '').replace(/<[^>]*>/g, '').slice(0, 140) + '...'
                }));
            }
        } catch (e: any) {
            console.warn('[NewsService] Notice:', e.message);
        }

        return [];
    }
}

// -------------------------------------------------------------------
// ACTIVE WEB TELEMETRY ENGINE (ESPN REAL-TIME LIVE SCORES & SATELLITE)
// -------------------------------------------------------------------
export class SportsScoreService {
    private static cachedScores: SportsScore[] = [];
    private static lastFetchTime: number = 0;
    private static readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds live cache

    static async fetchLiveWebTelemetry(): Promise<SportsScore[]> {
        const now = Date.now();
        if (this.cachedScores.length > 0 && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
            return this.cachedScores;
        }

        const liveScores: SportsScore[] = [];
        const channels = getChannelsList();

        const findChannelForMatch = (matchTitle: string, leagueName: string) => {
            const broadcasters = SportsMatchBroadcasterResolver.resolveBroadcasters(`${matchTitle} ${leagueName}`);
            for (const bc of broadcasters) {
                const found = channels.find(c => (c.name || '').toLowerCase().includes(bc.toLowerCase()));
                if (found) {
                    const streamUrl = getChannelStreamUrl(found);
                    return {
                        channelName: found.name,
                        streamUrl: streamUrl,
                        playUrl: `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(found.name)}&logo=${encodeURIComponent(found.logo || '')}&type=hls&source=live_telemetry`
                    };
                }
            }
            return {
                channelName: 'STAR SPORTS 1 HINDI 4K',
                streamUrl: 'https://stream.kliv.in/nex/jiobe_18386.m3u8',
                playUrl: '/play_consumet.php?url=https%3A%2F%2Fstream.kliv.in%2Fnex%2Fjiobe_18386.m3u8&name=STAR%20SPORTS%201%20HINDI%204K&type=hls&source=live_telemetry'
            };
        };

        // 1. Fetch ESPN Football (Premier League, Champions League, La Liga)
        const soccerEndpoints = [
            { league: 'Premier League', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard' },
            { league: 'UEFA Champions League', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard' },
            { league: 'La Liga', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard' },
            { league: 'Serie A', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard' }
        ];

        for (const ep of soccerEndpoints) {
            try {
                const res = await axios.get(ep.url, { timeout: 3500 });
                const events = res.data?.events || [];
                for (const evt of events) {
                    const comp = evt.competitions?.[0];
                    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
                    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
                    const status = evt.status?.type?.detail || evt.status?.type?.description || 'Scheduled';
                    const isLive = evt.status?.type?.state === 'in';
                    const matchName = `${home?.team?.displayName || 'Home'} vs ${away?.team?.displayName || 'Away'}`;
                    const chInfo = findChannelForMatch(matchName, ep.league);

                    liveScores.push({
                        id: `espn-soc-${evt.id || Math.random()}`,
                        match: matchName,
                        sport: 'Football',
                        league: ep.league,
                        status: isLive ? `🔴 LIVE - ${status}` : status,
                        score: `${home?.team?.shortDisplayName || 'H'} ${home?.score || 0} - ${away?.score || 0} ${away?.team?.shortDisplayName || 'A'}`,
                        details: `Venue: ${comp?.venue?.fullName || 'Stadium'} | Clock: ${evt.status?.displayClock || status}`,
                        summary: `${matchName} in ${ep.league}. Current state: ${status}.`,
                        channel: chInfo.channelName,
                        streamUrl: chInfo.streamUrl,
                        playUrl: chInfo.playUrl
                    });
                }
            } catch (err: any) {
                // Ignore individual league timeout
            }
        }

        // 2. Fetch ESPN Cricket Live Telemetry
        try {
            const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/cricket/8048/scoreboard', { timeout: 3500 });
            const events = res.data?.events || [];
            for (const evt of events) {
                const comp = evt.competitions?.[0];
                const t1 = comp?.competitors?.[0];
                const t2 = comp?.competitors?.[1];
                const status = evt.status?.type?.detail || evt.status?.type?.description || 'In Progress';
                const isLive = evt.status?.type?.state === 'in';
                const matchName = `${t1?.team?.displayName || 'Team 1'} vs ${t2?.team?.displayName || 'Team 2'}`;
                const chInfo = findChannelForMatch(matchName, 'Cricket');

                liveScores.push({
                    id: `espn-cric-${evt.id || Math.random()}`,
                    match: matchName,
                    sport: 'Cricket',
                    league: comp?.notes?.[0]?.headline || 'ICC International Cricket',
                    status: isLive ? `🔴 LIVE - ${status}` : status,
                    score: `${t1?.team?.abbreviation || 'T1'}: ${t1?.score || 'Yet to bat'} | ${t2?.team?.abbreviation || 'T2'}: ${t2?.score || 'Yet to bat'}`,
                    details: `Status: ${status}`,
                    summary: `Live match: ${matchName}. ${status}`,
                    channel: chInfo.channelName,
                    streamUrl: chInfo.streamUrl,
                    playUrl: chInfo.playUrl
                });
            }
        } catch (err: any) {}

        // 3. Fetch ESPN F1 Motorsport Live Telemetry
        try {
            const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard', { timeout: 3500 });
            const events = res.data?.events || [];
            for (const evt of events) {
                const status = evt.status?.type?.detail || evt.status?.type?.description || 'Championship Race';
                const isLive = evt.status?.type?.state === 'in';
                const chInfo = findChannelForMatch(evt.name, 'Formula 1');

                liveScores.push({
                    id: `espn-f1-${evt.id || Math.random()}`,
                    match: evt.name || 'Formula 1 Grand Prix',
                    sport: 'Motorsport',
                    league: 'FIA Formula One World Championship',
                    status: isLive ? `🔴 LIVE - ${status}` : status,
                    score: `Session: ${status}`,
                    details: `Circuit: ${evt.circuit?.name || 'F1 Grand Prix Circuit'}`,
                    summary: `${evt.name} live telemetry and race updates.`,
                    channel: 'SKY SPORTS F1 HD',
                    streamUrl: chInfo.streamUrl,
                    playUrl: chInfo.playUrl
                });
            }
        } catch (err: any) {}

        if (liveScores.length > 0) {
            this.cachedScores = liveScores;
            this.lastFetchTime = now;
        }

        return this.cachedScores;
    }

    static async getLiveScores(sportFilter?: string): Promise<SportsScore[]> {
        const scores = await this.fetchLiveWebTelemetry();
        if (!sportFilter || sportFilter === 'all') return scores;
        const sf = sportFilter.toLowerCase();
        return scores.filter(s => 
            s.sport.toLowerCase().includes(sf) || 
            s.league.toLowerCase().includes(sf) || 
            s.match.toLowerCase().includes(sf)
        );
    }
}

export class LiveDataAggregator {
    static async getLiveContextForAi(userPrompt: string): Promise<string> {
        const p = userPrompt.toLowerCase();
        let context = '';

        // 1. Weather Telemetry
        if (/weather|temperature|forecast|rain|sunny|celsius|fahrenheit/i.test(p)) {
            let cityName = p
                .replace(/.*(?:in|for|at|of)\s+([a-zA-Z\s]+).*/i, '$1')
                .replace(/(?:right now|today|currently|please|tell me|like|forecast|weather).*/i, '')
                .trim() || 'London';
            const wData = await WeatherService.getWeather(cityName);
            if (wData) {
                context += `\n[REAL-TIME LIVE WEB WEATHER TELEMETRY FOR ${wData.city.toUpperCase()}, ${wData.country.toUpperCase()}]:\n`;
                context += `- Condition: ${wData.condition}\n`;
                context += `- Temperature: ${wData.temperatureC}°C (${wData.temperatureF}°F)\n`;
                context += `- Wind Speed: ${wData.windSpeed} km/h\n`;
                context += `- Local Time: ${wData.time}\n`;
            }
        }

        // 2. Real-Time Active Web Sports Telemetry
        if (/score|live score|cricket score|football score|match score|who is winning|runs|wickets|goals|standings|f1 standings|ipl score|premier league/i.test(p)) {
            const scores = await SportsScoreService.getLiveScores();
            if (scores.length > 0) {
                context += `\n[REAL-TIME ACTIVE WEB SPORTS TELEMETRY (ESPN LIVE FEED)]:\n`;
                scores.forEach(s => {
                    context += `\n- Event: "${s.match}" (${s.league}) [${s.status}]\n`;
                    context += `  Score / Telemetry: ${s.score}\n`;
                    context += `  Details: ${s.details}\n`;
                    context += `  Broadcasting Satellite Channel: "${s.channel}"\n`;
                });
            }
        }

        // 3. Real-Time Breaking News RSS Telemetry
        if (/news|breaking news|headlines|latest news|world news|tech news|entertainment news/i.test(p)) {
            let cat = 'top';
            if (p.includes('sport')) cat = 'sports';
            else if (p.includes('tech')) cat = 'tech';
            else if (p.includes('movie') || p.includes('cinema')) cat = 'entertainment';

            const news = await NewsService.getBreakingNews(cat);
            if (news.length > 0) {
                context += `\n[LATEST REAL-TIME VERIFIED BREAKING NEWS HEADLINES (LIVE WIRE)]:\n`;
                news.slice(0, 5).forEach((n, i) => {
                    context += `${i + 1}. "${n.title}" (${n.source}) - ${n.snippet}\n`;
                });
            }
        }

        return context;
    }
}
