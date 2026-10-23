import axios from 'axios';
import http from 'http';
import https from 'https';
import { ChannelJsonService, ChannelItem } from './channelJsonService';
import { SportsScraperService, SportsEvent } from './sportsScraperService';
import { getRotatingTmdbKey, ROTATING_TMDB_KEYS } from './bingrScraperService';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

export interface FastChannelMatch {
    id: string;
    name: string;
    genre: string;
    group: string;
    logo: string;
    playUrl: string;
    score: number;
}

export interface FastEventMatch {
    id: string;
    title: string;
    sportName: string;
    category: string;
    time: string;
    isLive: boolean;
    thumbnail: string;
    primaryChannelName: string;
    playUrl: string;
    score: number;
}

export interface FastMediaMatch {
    id: number | string;
    title: string;
    name?: string;
    media_type: 'movie' | 'tv' | 'anime';
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
    overview: string;
    original_language?: string;
    score?: number;
}

export interface ConsumetSearchResults {
    query: string;
    source: string;
    timing_ms: number;
    cached: boolean;
    total: number;
    results: {
        events: FastEventMatch[];
        channels: FastChannelMatch[];
        movies: FastMediaMatch[];
        anime: FastMediaMatch[];
    };
}

interface LruCacheEntry<T> {
    data: T;
    timestamp: number;
    ttlMs: number;
}

// In-memory LRU cache for query results
const queryCache = new Map<string, LruCacheEntry<ConsumetSearchResults>>();
const MAX_QUERY_CACHE = 1500;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

// Pre-seeded popular titles catalog for 0ms instant movie/series response
const POPULAR_MEDIA_SEED: FastMediaMatch[] = [
    {
        id: 533535,
        title: "Deadpool & Wolverine",
        media_type: "movie",
        poster_path: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
        backdrop_path: "/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg",
        vote_average: 7.7,
        release_date: "2024-07-24",
        overview: "A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him.",
        original_language: "en"
    },
    {
        id: 1022789,
        title: "Inside Out 2",
        media_type: "movie",
        poster_path: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
        backdrop_path: "/stKGOmPAneQ6ky7cb7vB2IeZ3Z7.jpg",
        vote_average: 7.6,
        release_date: "2024-06-11",
        overview: "Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for unexpected new Emotions!",
        original_language: "en"
    },
    {
        id: 693134,
        title: "Dune: Part Two",
        media_type: "movie",
        poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        backdrop_path: "/xOMo8BRK7PfcJv9JCnx7s520DRq.jpg",
        vote_average: 8.2,
        release_date: "2024-02-27",
        overview: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge.",
        original_language: "en"
    },
    {
        id: 299534,
        title: "Avengers: Endgame",
        media_type: "movie",
        poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
        backdrop_path: "/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
        vote_average: 8.3,
        release_date: "2019-04-24",
        overview: "After the devastating events of Avengers: Infinity War, the universe is in ruins due to the efforts of the Mad Titan, Thanos.",
        original_language: "en"
    },
    {
        id: 299536,
        title: "Avengers: Infinity War",
        media_type: "movie",
        poster_path: "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
        backdrop_path: "/mDfJG3LC3Dqb67AZ52x3Z0jOS0c.jpg",
        vote_average: 8.2,
        release_date: "2018-04-25",
        overview: "As the Avengers and their allies have continued to protect the world, a new danger has emerged from the cosmic shadows: Thanos.",
        original_language: "en"
    },
    {
        id: 66732,
        title: "Stranger Things",
        name: "Stranger Things",
        media_type: "tv",
        poster_path: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
        backdrop_path: "/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
        vote_average: 8.6,
        first_air_date: "2016-07-15",
        overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
        original_language: "en"
    },
    {
        id: 94605,
        title: "Arcane",
        name: "Arcane",
        media_type: "tv",
        poster_path: "/fqldf2t8ztc9aiwn397rDit3QgM.jpg",
        backdrop_path: "/27Wv16q7LqLz0zUf44yQ963q59c.jpg",
        vote_average: 8.7,
        first_air_date: "2021-11-06",
        overview: "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and incompatible convictions.",
        original_language: "en"
    },
    {
        id: 1399,
        title: "Game of Thrones",
        name: "Game of Thrones",
        media_type: "tv",
        poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
        backdrop_path: "/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
        vote_average: 8.4,
        first_air_date: "2011-04-17",
        overview: "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.",
        original_language: "en"
    },
    {
        id: 1396,
        title: "Breaking Bad",
        name: "Breaking Bad",
        media_type: "tv",
        poster_path: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
        backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
        vote_average: 8.9,
        first_air_date: "2008-01-20",
        overview: "Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and decides to enter the methamphetamine business to provide for his family.",
        original_language: "en"
    },
    {
        id: 37854,
        title: "One Piece",
        name: "One Piece",
        media_type: "tv",
        poster_path: "/cMD9Ygz11yjJnzEiURXdfxY8coF.jpg",
        backdrop_path: "/4Mt7iqFc9crehtIiyKOkVe0stv0.jpg",
        vote_average: 8.7,
        first_air_date: "1999-10-20",
        overview: "Years ago, the fearsome Pirate King, Gol D. Roger was executed leaving behind a huge cache of riches and the legendary One Piece.",
        original_language: "ja"
    },
    {
        id: 85937,
        title: "Demon Slayer: Kimetsu no Yaiba",
        name: "Demon Slayer: Kimetsu no Yaiba",
        media_type: "tv",
        poster_path: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
        backdrop_path: "/nTvM4mhqZlHIvUkIvdiknW697zL.jpg",
        vote_average: 8.7,
        first_air_date: "2019-04-06",
        overview: "It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon.",
        original_language: "ja"
    },
    {
        id: 119051,
        title: "Wednesday",
        name: "Wednesday",
        media_type: "tv",
        poster_path: "/9PFonQhy4cQy7Jz20NpMygczOkv.jpg",
        backdrop_path: "/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg",
        vote_average: 8.5,
        first_air_date: "2022-11-23",
        overview: "Wednesday Addams attempts to master her emerging psychic ability, thwart a monstrous killing spree and solve the supernatural mystery.",
        original_language: "en"
    },
    {
        id: 93405,
        title: "Squid Game",
        name: "Squid Game",
        media_type: "tv",
        poster_path: "/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg",
        backdrop_path: "/2meX1nMdScFOoV4370rqHWFDxsu.jpg",
        vote_average: 8.3,
        first_air_date: "2021-09-17",
        overview: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits with deadly high stakes.",
        original_language: "ko"
    },
    {
        id: 155,
        title: "The Dark Knight",
        media_type: "movie",
        poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        backdrop_path: "/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",
        vote_average: 8.5,
        release_date: "2008-07-16",
        overview: "Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and District Attorney Harvey Dent to dismantle the remaining criminal organizations.",
        original_language: "en"
    },
    {
        id: 27205,
        title: "Inception",
        media_type: "movie",
        poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        backdrop_path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
        vote_average: 8.4,
        release_date: "2010-07-15",
        overview: "Cobb, a skilled thief who steals corporate secrets through the use of dream-sharing technology, is given the inverse task of planting an idea into the mind of a C.E.O.",
        original_language: "en"
    },
    {
        id: 603,
        title: "The Matrix",
        media_type: "movie",
        poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        backdrop_path: "/pquF7Qh1jQn8Y4k91iG7aFqL2Lh.jpg",
        vote_average: 8.2,
        release_date: "1999-03-30",
        overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers.",
        original_language: "en"
    },
    {
        id: 414906,
        title: "The Batman",
        media_type: "movie",
        poster_path: "/74xTEgt7R36Fpooo50r9T25onhq.jpg",
        backdrop_path: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
        vote_average: 7.7,
        release_date: "2022-03-01",
        overview: "In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.",
        original_language: "en"
    },
    {
        id: 569094,
        title: "Spider-Man: Across the Spider-Verse",
        media_type: "movie",
        poster_path: "/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
        backdrop_path: "/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg",
        vote_average: 8.4,
        release_date: "2023-05-31",
        overview: "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse.",
        original_language: "en"
    },
    {
        id: 671,
        title: "Harry Potter and the Philosopher's Stone",
        media_type: "movie",
        poster_path: "/wuMc08IPKEatv9rnMNXvIDxqP4W.jpg",
        backdrop_path: "/hziiv146OpD7qDoBtSoTe4G8xne.jpg",
        vote_average: 7.9,
        release_date: "2001-11-16",
        overview: "Harry Potter has lived under the stairs at his aunt and uncle's house his whole life. But on his 11th birthday, he learns he's a powerful wizard.",
        original_language: "en"
    },
    {
        id: 19995,
        title: "Avatar",
        media_type: "movie",
        poster_path: "/kyeqWdyUXW608qlYkRqosgbbJyK.jpg",
        backdrop_path: "/vL5LR6WdxWPjC2tK4qQh9Fv42s0.jpg",
        vote_average: 7.6,
        release_date: "2009-12-15",
        overview: "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following orders and protecting an alien civilization.",
        original_language: "en"
    },
    {
        id: 76600,
        title: "Avatar: The Way of Water",
        media_type: "movie",
        poster_path: "/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
        backdrop_path: "/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg",
        vote_average: 7.7,
        release_date: "2022-12-14",
        overview: "Set more than a decade after the events of the first film, learn the story of the Sully family, the trouble that follows them, the lengths they go to keep each other safe.",
        original_language: "en"
    }
];

export class ConsumetSearchService {
    private static indexedChannels: Array<ChannelItem & { cleanName: string; tokens: string[] }> = [];
    private static channelsIndexedAt: number = 0;
    private static INDEX_TTL = 10 * 60 * 1000; // 10 minutes

    /**
     * Build or refresh in-memory channel index
     */
    private static ensureChannelsIndex(): void {
        const now = Date.now();
        if (this.indexedChannels.length > 0 && (now - this.channelsIndexedAt < this.INDEX_TTL)) {
            return;
        }

        try {
            const rawChannels = ChannelJsonService.getChannels() || [];
            this.indexedChannels = rawChannels.map(ch => {
                const name = String(ch.name || ch.title || '').trim();
                const cleanName = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
                const tokens = cleanName.split(/\s+/).filter(t => t.length > 0);
                return {
                    ...ch,
                    cleanName,
                    tokens
                };
            });
            this.channelsIndexedAt = now;
        } catch (e: any) {
            console.error('[ConsumetSearch] Failed to index channels:', e?.message || e);
        }
    }

    /**
     * Lightning Fast In-Memory Channel Matching (<1ms)
     */
    public static searchChannelsFast(query: string, limit: number = 24): FastChannelMatch[] {
        this.ensureChannelsIndex();
        if (!query || !this.indexedChannels.length) return [];

        const cleanQ = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
        if (!cleanQ) return [];

        const qTokens = cleanQ.split(/\s+/).filter(t => t.length > 0);
        const matches: FastChannelMatch[] = [];

        for (let i = 0; i < this.indexedChannels.length; i++) {
            const ch = this.indexedChannels[i];
            const nameLower = ch.cleanName;
            let score = 0;

            // Exact match
            if (nameLower === cleanQ) {
                score = 1000;
            } else if (nameLower.startsWith(cleanQ)) {
                score = 500 + (cleanQ.length / nameLower.length) * 100;
            } else if (nameLower.includes(cleanQ)) {
                score = 300 + (cleanQ.length / nameLower.length) * 50;
            } else {
                // Check token matches
                let matchedTokens = 0;
                for (let q = 0; q < qTokens.length; q++) {
                    const token = qTokens[q];
                    if (ch.tokens.some(t => t.startsWith(token) || t.includes(token))) {
                        matchedTokens++;
                    }
                }
                if (matchedTokens === qTokens.length) {
                    score = 200 + (matchedTokens * 20);
                } else if (matchedTokens > 0 && qTokens.length > 1) {
                    score = 100 + (matchedTokens * 15);
                }
            }

            // Boost sports channels if search contains sport terms
            const isSports = (ch.genre || '').toLowerCase().includes('sport') || (ch.group || '').toLowerCase().includes('sport');
            if (isSports && (cleanQ.includes('sport') || cleanQ.includes('ten') || cleanQ.includes('cricket') || cleanQ.includes('star') || cleanQ.includes('willow') || cleanQ.includes('sony'))) {
                score += 150;
            }

            if (score > 80) {
                const name = ch.name || ch.title || 'Channel';
                const chId = String(ch.channel_id || (ch as any).id || '');
                const cleanId = chId.replace(/^(?:mdtv|jtv)[-_]/i, '');
                const isMdtv = ch.source === 'mdtv' || chId.startsWith('mdtv') || chId.startsWith('jtv') || !!(ch as any).drm || !!((ch as any).key_id && (ch as any).key);
                const streamUrl = ch.stream_url || ch.streamUrl || ch.url || chId;

                let playUrl = ch.playUrl || '';
                if (!playUrl) {
                    if (isMdtv && cleanId) {
                        const keyId = (ch as any).key_id || (ch as any).drm?.key_id || '';
                        const key = (ch as any).key || (ch as any).drm?.key || '';
                        const drmParams = (keyId && key) ? `&key_id=${encodeURIComponent(keyId)}&key=${encodeURIComponent(key)}` : '';
                        playUrl = `/play_consumet.php?channel_id=mdtv-${encodeURIComponent(cleanId)}&url=%2Fapi%2Fmdtv%2Fmanifest%2F${encodeURIComponent(cleanId)}.mpd${drmParams}&name=${encodeURIComponent(name)}&source=consumet.html&type=dash&from_tab=livetv`;
                    } else if (streamUrl) {
                        playUrl = `/play_consumet.php?channel_id=${encodeURIComponent(chId || name)}&url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(name)}&source=consumet.html&type=hls&from_tab=livetv`;
                    }
                }
                const logo = ch.logo || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=0f172a&color=f59e0b&bold=true');

                matches.push({
                    id: chId || String(name || i),
                    name: name,
                    genre: ch.genre || 'Live TV',
                    group: ch.group || ch.genre || 'Live TV',
                    logo: logo,
                    playUrl: playUrl,
                    score: score
                });
            }
        }

        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);
        return matches.slice(0, limit);
    }

    private static cachedSportsEvents: SportsEvent[] = [];
    private static lastSportsEventsFetch: number = 0;
    private static isFetchingSportsEvents: boolean = false;

    /**
     * Non-blocking background warmer for sports events
     */
    public static async warmSportsEvents(): Promise<void> {
        if (this.isFetchingSportsEvents) return;
        const now = Date.now();
        if (this.cachedSportsEvents.length > 0 && (now - this.lastSportsEventsFetch < 5 * 60 * 1000)) {
            return;
        }
        this.isFetchingSportsEvents = true;
        try {
            const events = await SportsScraperService.scrapeLiveSportsEvents(false);
            if (events && events.length > 0) {
                this.cachedSportsEvents = events;
                this.lastSportsEventsFetch = Date.now();
            }
        } catch (e: any) {
            // Ignore background error
        } finally {
            this.isFetchingSportsEvents = false;
        }
    }

    /**
     * Lightning Fast Sports Events Search (<1ms from in-memory index)
     */
    public static async searchSportsEventsFast(query: string, limit: number = 18): Promise<FastEventMatch[]> {
        if (!query) return [];
        const cleanQ = query.toLowerCase().trim();

        // Trigger background warmer if stale or empty without blocking search
        if (!this.cachedSportsEvents.length || Date.now() - this.lastSportsEventsFetch > 5 * 60 * 1000) {
            this.warmSportsEvents().catch(() => {});
        }

        const rawEvents = this.cachedSportsEvents;
        if (!rawEvents.length) return [];

        const matches: FastEventMatch[] = [];

        for (const ev of rawEvents) {
            const titleLower = (ev.title || '').toLowerCase();
            const sportLower = (ev.sport || ev.league || '').toLowerCase();
            const team1 = (ev.homeTeam || '').toLowerCase();
            const team2 = (ev.awayTeam || '').toLowerCase();

            let score = 0;
            if (titleLower.includes(cleanQ) || team1.includes(cleanQ) || team2.includes(cleanQ)) {
                score = 400;
                if (titleLower.startsWith(cleanQ)) score += 100;
            } else if (sportLower.includes(cleanQ)) {
                score = 250;
            }

            if (ev.isLive) score += 150;

            if (score > 100) {
                const playUrl = ev.playUrl || (ev.channels && ev.channels[0]?.playUrl) || `/play_consumet.php?name=${encodeURIComponent(ev.title)}&source=sports_scraper`;
                const channelName = ev.channelName || (ev.channels && ev.channels[0]?.name) || 'Live Sports';
                const thumb = ev.homeLogo || ev.channels?.[0]?.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80';

                matches.push({
                    id: ev.id || ev.title,
                    title: ev.title,
                    sportName: ev.sport || 'Sports',
                    category: ev.league || ev.sport || 'Live Sports',
                    time: ev.time || 'LIVE',
                    isLive: ev.isLive,
                    thumbnail: thumb,
                    primaryChannelName: channelName,
                    playUrl: playUrl,
                    score: score
                });
            }
        }

        matches.sort((a, b) => b.score - a.score);
        return matches.slice(0, limit);
    }

    /**
     * Lightning Fast Movies & Series Search with TMDB Multi-Key Rotation + Pre-Seed Fallback
     */
    public static async searchMoviesAndSeriesFast(query: string, limit: number = 24): Promise<FastMediaMatch[]> {
        if (!query) return [];
        const cleanQ = query.toLowerCase().trim();

        // 1. Instant check against pre-seeded popular titles (<0.1ms)
        const preseededMatches: FastMediaMatch[] = [];
        for (const item of POPULAR_MEDIA_SEED) {
            const title = (item.title || item.name || '').toLowerCase();
            if (title.includes(cleanQ)) {
                let score = 300;
                if (title === cleanQ) score = 1000;
                else if (title.startsWith(cleanQ)) score = 600;
                preseededMatches.push({ ...item, score });
            }
        }

        // 2. Query TMDB with rotating API keys and 3000ms timeout
        let tmdbResults: FastMediaMatch[] = [];
        const keys = ROTATING_TMDB_KEYS;

        for (let attempt = 0; attempt < Math.min(keys.length, 3); attempt++) {
            const apiKey = getRotatingTmdbKey();
            try {
                const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
                const resp = await axios.get(url, {
                    timeout: 3000,
                    httpAgent,
                    httpsAgent,
                    headers: { 'Accept': 'application/json' }
                });

                if (resp.status === 200 && resp.data?.results) {
                    const rawList = resp.data.results as any[];
                    tmdbResults = rawList
                        .filter(item => item && (item.media_type === 'movie' || item.media_type === 'tv'))
                        .map(item => ({
                            id: item.id,
                            title: item.title || item.name || 'Untitled',
                            name: item.name || item.title,
                            media_type: (item.media_type || (item.name ? 'tv' : 'movie')) as 'movie' | 'tv',
                            poster_path: item.poster_path,
                            backdrop_path: item.backdrop_path,
                            vote_average: Number(item.vote_average || 0),
                            release_date: item.release_date || item.first_air_date,
                            first_air_date: item.first_air_date,
                            overview: item.overview || '',
                            original_language: item.original_language
                        }));
                    break;
                }
            } catch (err: any) {
                // If timed out or rate limited, rotate to next key
                continue;
            }
        }

        // Combine pre-seeded matches with TMDB results, avoiding duplicates
        const seenIds = new Set<string | number>();
        const combined: FastMediaMatch[] = [];

        // Put preseeded matches with high score first if they exactly match
        for (const item of preseededMatches) {
            if (item.score && item.score >= 500) {
                seenIds.add(item.id);
                combined.push(item);
            }
        }

        for (const item of tmdbResults) {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                combined.push(item);
            }
        }

        for (const item of preseededMatches) {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                combined.push(item);
            }
        }

        return combined.slice(0, limit);
    }

    /**
     * Fast AniList Anime Search
     */
    public static async searchAnimeFast(query: string, limit: number = 20): Promise<FastMediaMatch[]> {
        if (!query) return [];
        try {
            const gql = `
                query ($search: String, $perPage: Int) {
                    Page(page: 1, perPage: $perPage) {
                        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                            id
                            idMal
                            title { romaji english native }
                            coverImage { large }
                            bannerImage
                            averageScore
                            episodes
                            format
                            status
                            description
                            genres
                        }
                    }
                }
            `;
            const resp = await axios.post('https://graphql.anilist.co', {
                query: gql,
                variables: { search: query, perPage: limit }
            }, {
                timeout: 3500,
                httpAgent,
                httpsAgent,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            const media = resp.data?.data?.Page?.media || [];
            return media.map((item: any) => ({
                id: item.id,
                malId: item.idMal || item.id,
                title: item.title?.english || item.title?.romaji || 'Anime',
                name: item.title?.english || item.title?.romaji || 'Anime',
                media_type: 'anime',
                poster_path: item.coverImage?.large || null,
                backdrop_path: item.bannerImage || null,
                vote_average: item.averageScore ? Number((item.averageScore / 10).toFixed(1)) : 8.0,
                overview: item.description ? item.description.replace(/<[^>]*>/g, '') : '',
                original_language: 'ja'
            }));
        } catch {
            return [];
        }
    }

    /**
     * Master Lightning Unified Search
     */
    public static async search(query: string, source: string = 'all', limit: number = 24): Promise<ConsumetSearchResults> {
        const startTime = Date.now();
        const cleanQ = (query || '').trim();
        const normSource = (source || 'all').toLowerCase();
        const cacheKey = `${normSource}:${cleanQ.toLowerCase()}`;

        // 1. Check LRU Memory Cache (<0.5ms)
        const cached = queryCache.get(cacheKey);
        const now = Date.now();
        if (cached && (now - cached.timestamp < cached.ttlMs)) {
            return {
                ...cached.data,
                timing_ms: Date.now() - startTime,
                cached: true
            };
        }

        const results: ConsumetSearchResults['results'] = {
            events: [],
            channels: [],
            movies: [],
            anime: []
        };

        if (normSource === 'channels') {
            results.channels = this.searchChannelsFast(cleanQ, limit);
        } else if (normSource === 'events') {
            results.events = await this.searchSportsEventsFast(cleanQ, limit);
        } else if (normSource === 'tmdb') {
            results.movies = await this.searchMoviesAndSeriesFast(cleanQ, limit);
        } else if (normSource === 'anime' || normSource === 'anilist') {
            results.anime = await this.searchAnimeFast(cleanQ, limit);
        } else {
            // UNIFIED SEARCH: Run all engines concurrently with Promise.allSettled
            const [channelsSettled, eventsSettled, moviesSettled, animeSettled] = await Promise.allSettled([
                Promise.resolve(this.searchChannelsFast(cleanQ, 12)),
                this.searchSportsEventsFast(cleanQ, 9),
                this.searchMoviesAndSeriesFast(cleanQ, 18),
                this.searchAnimeFast(cleanQ, 8)
            ]);

            if (channelsSettled.status === 'fulfilled') results.channels = channelsSettled.value;
            if (eventsSettled.status === 'fulfilled') results.events = eventsSettled.value;
            if (moviesSettled.status === 'fulfilled') results.movies = moviesSettled.value;
            if (animeSettled.status === 'fulfilled') results.anime = animeSettled.value;
        }

        const total = results.events.length + results.channels.length + results.movies.length + results.anime.length;
        const finalResult: ConsumetSearchResults = {
            query: cleanQ,
            source: normSource,
            timing_ms: Date.now() - startTime,
            cached: false,
            total,
            results
        };

        // Store in LRU cache
        if (queryCache.size >= MAX_QUERY_CACHE) {
            const oldest = queryCache.keys().next().value;
            if (oldest) queryCache.delete(oldest);
        }
        queryCache.set(cacheKey, {
            data: finalResult,
            timestamp: now,
            ttlMs: CACHE_TTL_MS
        });

        return finalResult;
    }

    /**
     * Auto-suggestions for instant typeahead (<1ms)
     */
    public static getSuggestions(query: string, limit: number = 8): string[] {
        const cleanQ = (query || '').toLowerCase().trim();
        if (!cleanQ || cleanQ.length < 2) return [];

        const suggestions: string[] = [];
        const seen = new Set<string>();

        // Check preseeded titles
        for (const item of POPULAR_MEDIA_SEED) {
            const title = (item.title || item.name || '').trim();
            if (title.toLowerCase().includes(cleanQ)) {
                if (!seen.has(title)) {
                    seen.add(title);
                    suggestions.push(title);
                    if (suggestions.length >= limit) return suggestions;
                }
            }
        }

        // Check channel names
        this.ensureChannelsIndex();
        for (const ch of this.indexedChannels) {
            const name = (ch.name || ch.title || '').trim();
            if (name.toLowerCase().includes(cleanQ)) {
                if (!seen.has(name)) {
                    seen.add(name);
                    suggestions.push(name);
                    if (suggestions.length >= limit) return suggestions;
                }
            }
        }

        return suggestions;
    }
}
