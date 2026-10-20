/**
 * AETHERIS MASTER SITE MAP & URL GENERATOR ENGINE
 * Centralized registry of all internal routes, external streaming servers,
 * dynamic hash navigation patterns, and API endpoints for Local AI.
 */

export interface PageRoute {
    id: string;
    name: string;
    file: string;
    url: string;
    description: string;
    features?: string[];
    hash_tabs?: Record<string, {
        hash: string;
        url: string;
        name: string;
        description: string;
        query_support?: string;
    }>;
    modals_and_players?: Record<string, {
        url_pattern: string;
        description: string;
    }>;
    url_generator?: Record<string, string>;
}

export interface StreamingServer {
    id: string;
    name: string;
    badge: string;
    movie_url_template: string;
    tv_url_template: string;
    reliability: string;
}

export interface ApiEndpoint {
    route: string;
    method: string;
    params?: string[];
    description: string;
}

export interface SiteMapData {
    site_name: string;
    version: string;
    description: string;
    pages: PageRoute[];
    streaming_servers: StreamingServer[];
    api_endpoints: ApiEndpoint[];
}

export const SITE_MAP: SiteMapData = {
    site_name: "Aetheris & Stalker Pro Quantum Entertainment Matrix",
    version: "3.0.0",
    description: "Master navigation, URL generation schemas, streaming server endpoints, internal routing matrix, and API registry for Aetheris Local AI.",
    pages: [
        {
            id: "hero",
            name: "3D Quantum Continuum Hero",
            file: "/hero.html",
            url: "/hero.html",
            description: "3D immersive rotational continuum showcase with curated Hollywood, Bollywood, South Indian, Anime, and Live TV stream corridors.",
            features: ["3d_carousel", "cinema_spotlight", "quick_stream_launcher", "search_omni", "watchlist_access"],
            url_generator: {
                direct: "/hero.html",
                with_search: "/hero.html?q={query}"
            }
        },
        {
            id: "consumet_main",
            name: "Aetheris Cinema & Multi-Hub Matrix",
            file: "/consumet.html",
            url: "/consumet.html",
            description: "Primary entertainment interface housing movies, TV series, anime, live sports, 5200+ IPTV channels, YouTube hub, and torrent streamer.",
            hash_tabs: {
                home: {
                    hash: "#home",
                    url: "/consumet.html#home",
                    name: "Home Showcase",
                    description: "Hero billboard, trending cinematic releases, upcoming spotlights, and recommendations."
                },
                movies: {
                    hash: "#movies",
                    url: "/consumet.html#movies",
                    name: "4K Movies Hub",
                    description: "Extensive 4K/1080p movie catalog with genre filters, years, and rating sorts.",
                    query_support: "/consumet.html#movies?genre={genre}&year={year}&search={query}"
                },
                tv: {
                    hash: "#tv",
                    url: "/consumet.html#tv",
                    name: "TV Series Hub",
                    description: "Full television series library with season and episode selectors.",
                    query_support: "/consumet.html#tv?search={query}"
                },
                anime: {
                    hash: "#anime",
                    url: "/consumet.html#anime",
                    name: "Anime Matrix",
                    description: "Subbed and dubbed anime episodes, ongoing releases, top-rated anime.",
                    query_support: "/consumet.html#anime?search={query}"
                },
                manga: {
                    hash: "#manga",
                    url: "/consumet.html#manga",
                    name: "Manga Reader",
                    description: "Manga catalog with chapter reader and preload caching.",
                    query_support: "/consumet.html#manga?search={query}"
                },
                sports: {
                    hash: "#sports",
                    url: "/consumet.html#sports",
                    name: "Live Sports Center",
                    description: "Live match feeds for Cricket, Football, F1, Tennis, UFC, and NBA.",
                    query_support: "/consumet.html#sports?sport={sport_type}"
                },
                channels: {
                    hash: "#channels",
                    url: "/consumet.html#channels",
                    name: "5,200+ Live IPTV & Sports Directory",
                    description: "Live channel directory with multi-country filters and direct stream player.",
                    query_support: "/consumet.html#channels?category={category}&country={country}&search={query}"
                },
                youtube: {
                    hash: "#youtube",
                    url: "/consumet.html#youtube",
                    name: "YouTube 4K Hub",
                    description: "YouTube video streaming, trending music videos, and audio extraction.",
                    query_support: "/consumet.html#youtube?v={videoId}&q={query}"
                },
                torrent: {
                    hash: "#torrent",
                    url: "/consumet.html#torrent",
                    name: "4K Torrent & Debrid Engine",
                    description: "Direct torrent search across YTS, Torrentio, and PirateBay.",
                    query_support: "/consumet.html#torrent?q={query}"
                },
                watchlist: {
                    hash: "#watchlist",
                    url: "/consumet.html#watchlist",
                    name: "Watchlist & History",
                    description: "Locally stored bookmarks, watchlist, and resume points."
                },
                settings: {
                    hash: "#settings",
                    url: "/consumet.html#settings",
                    name: "Platform Settings",
                    description: "Server switch, subtitles, audio preference, cache clearance, and UI themes."
                }
            },
            modals_and_players: {
                cinema_player: {
                    url_pattern: "/consumet.html#player?id={tmdb_id}&type={movie|tv}&season={season}&episode={episode}&server={server}",
                    description: "Embeds responsive 4K cinematic player with multi-source failover."
                },
                details_modal: {
                    url_pattern: "/consumet.html#details?id={tmdb_id}&type={movie|tv}",
                    description: "Displays synopsis, cast, trailer, and server picker."
                },
                torrent_player: {
                    url_pattern: "/consumet.html#torrent-player?magnet={encoded_magnet}&title={encoded_title}",
                    description: "Direct WebTorrent stream player."
                }
            }
        },
        {
            id: "books",
            name: "Codex Digital Library & E-Reader",
            file: "/books.html",
            url: "/books.html",
            description: "Universal digital reader with thousands of free classic and modern books, search, dark/sepia themes, and audio narrator.",
            url_generator: {
                direct: "/books.html",
                with_search: "/books.html?search={encoded_query}",
                with_book_id: "/books.html?book={book_id}"
            }
        },
        {
            id: "music",
            name: "Quantum Hi-Fi Music Streamer",
            file: "/music.html",
            url: "/music.html",
            description: "High-fidelity audio player integrating JioSaavn, Audius, and YouTube Music streams with live visualizer.",
            url_generator: {
                direct: "/music.html",
                with_search: "/music.html?q={encoded_query}",
                with_yt_video: "/music.html?yt={video_id}&title={encoded_title}",
                with_track_id: "/music.html?track={track_id}"
            }
        },
        {
            id: "stalker_portal",
            name: "Stalker Pro MAC Portal & M3U Gateway",
            file: "/index.php",
            url: "/index.php",
            description: "Interactive Stalker IPTV Portal dashboard with MAC handshake authentication and M3U loader.",
            url_generator: {
                direct: "/index.php",
                with_genre: "/index.php?genre={genre_id}"
            }
        },
        {
            id: "stalker_player",
            name: "Stalker Pro HLS Player",
            file: "/play.php",
            url: "/play.php",
            description: "HLS / MPEG-TS video player powered by Plyr and Hls.js with CORS bypass.",
            url_generator: {
                direct: "/play.php",
                with_stream: "/play_consumet.php?url={encoded_stream_url}&name={encoded_channel_name}&logo={encoded_logo_url}&source={source}"
            }
        },
        {
            id: "admin_matrix",
            name: "Admin Command Matrix & Monitoring",
            file: "/hari.html",
            url: "/hari.html",
            description: "System administration, live portal status, cache manager, proxy health check.",
            url_generator: {
                direct: "/hari.html"
            }
        },
        {
            id: "login_config",
            name: "Portal Config & Credentials Manager",
            file: "/login.php",
            url: "/login.php",
            description: "Configure external Stalker portal URLs, MAC addresses, timezone, and security tokens.",
            url_generator: {
                direct: "/login.php"
            }
        }
    ],
    streaming_servers: [
        {
                "id": "vidrift",
                "name": "Vidrift Direct (Primary)",
                "badge": "Primary 4K",
                "movie_url_template": "https://embed.vidrift.in/embed/movie/{tmdb_id}",
                "tv_url_template": "https://embed.vidrift.in/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "99.9%"
        },
        {
                "id": "vidlink",
                "name": "VidLink Pro (2nd)",
                "badge": "Clean CDN",
                "movie_url_template": "https://vidlink.pro/movie/{tmdb_id}?autoplay=true",
                "tv_url_template": "https://vidlink.pro/tv/{tmdb_id}/{season}/{episode}?autoplay=true",
                "reliability": "99.5%"
        },
        {
                "id": "vidapi",
                "name": "VidAPI 4K (3rd)",
                "badge": "Ultra Fast",
                "movie_url_template": "https://vidapi.xyz/embed/movie/{tmdb_id}",
                "tv_url_template": "https://vidapi.xyz/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "99.2%"
        },
        {
                "id": "vidsrc",
                "name": "VidSrc 4K",
                "badge": "Ultra HD",
                "movie_url_template": "https://vidsrc.to/embed/movie/{tmdb_id}",
                "tv_url_template": "https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "99.0%"
        },
        {
                "id": "superembed",
                "name": "SuperEmbed VIP",
                "badge": "Auto Subtitles",
                "movie_url_template": "https://multiembed.mov/directstream.php?video_id={tmdb_id}&tmdb=1",
                "tv_url_template": "https://multiembed.mov/directstream.php?video_id={tmdb_id}&tmdb=1&s={season}&e={episode}",
                "reliability": "98.9%"
        },
        {
                "id": "embedsu",
                "name": "Embed.su Global",
                "badge": "Multi-Server",
                "movie_url_template": "https://embed.su/embed/movie/{tmdb_id}",
                "tv_url_template": "https://embed.su/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "98.7%"
        },
        {
                "id": "twoembed",
                "name": "2Embed Cloud",
                "badge": "Global CDN",
                "movie_url_template": "https://www.2embed.cc/embed/{tmdb_id}",
                "tv_url_template": "https://www.2embed.cc/embedtv/{tmdb_id}&s={season}&e={episode}",
                "reliability": "97.5%"
        },
        {
                "id": "autoembed",
                "name": "AutoEmbed Global",
                "badge": "Instant Load",
                "movie_url_template": "https://player.autoembed.cc/embed/movie/{tmdb_id}",
                "tv_url_template": "https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "98.0%"
        },
        {
                "id": "vidbinge",
                "name": "VidBinge Multi",
                "badge": "Lossless Stream",
                "movie_url_template": "https://vidbinge.dev/embed/movie/{tmdb_id}",
                "tv_url_template": "https://vidbinge.dev/embed/tv/{tmdb_id}/{season}/{episode}",
                "reliability": "98.2%"
        },
        {
                "id": "movies4u",
                "name": "Movies4U Indian & Global",
                "badge": "Fast Relay",
                "movie_url_template": "https://moviesapi.club/movie/{tmdb_id}",
                "tv_url_template": "https://moviesapi.club/tv/{tmdb_id}-{season}-{episode}",
                "reliability": "97.9%"
        }
],
    api_endpoints: [
        { route: "/api/local-ai/query", method: "POST", description: "Local AI conversational intelligence engine and intent executor" },
        { route: "/api/local-ai/sitemap", method: "GET", description: "Returns site map and URL generators" },
        { route: "/api/local-ai/channels", method: "GET", params: ["q"], description: "Fuzzy search through 5,200+ Live channels" },
        { route: "/api/local-ai/suggestions", method: "GET", description: "Smart action recommendations" },
        { route: "/api/music/search", method: "GET", params: ["q"], description: "Search music tracks and artists" },
        { route: "/api/music/yt-search-full", method: "GET", params: ["q"], description: "YouTube video search with thumbnails" },
        { route: "/api/music/yt-stream", method: "GET", params: ["id"], description: "Audio stream extractor for YouTube" },
        { route: "/api/sports/matches", method: "GET", description: "Live cricket, football, F1 match schedules and streams" },
        { route: "/api/channels/list", method: "GET", description: "Database of 5,200+ Live channels" },
        { route: "/api/torrent/search", method: "GET", params: ["q"], description: "YTS & Torrentio magnet search" },
        { route: "/api/books/search", method: "GET", params: ["q"], description: "Gutenberg and OpenLibrary book search" },
        { route: "/api/subtitles/search", method: "GET", params: ["tmdb_id", "season", "episode"], description: "Subtitles search and conversion" },
        { route: "/live.php", method: "GET", params: ["url"], description: "Reverse TS/HLS proxy to bypass CORS" },
        { route: "/proxy", method: "GET", params: ["url"], description: "Universal stream and image proxy" }
    ]
};

// URL Generator Helper Methods
export class UrlGenerator {
    static generateCinemaUrl(tmdbIdOrParams: number | string | { tmdbId: number | string; type?: 'movie' | 'tv'; season?: number; episode?: number; server?: string }, type: 'movie' | 'tv' = 'movie', season: number = 1, episode: number = 1, server: string = 'vidrift'): string {
        if (typeof tmdbIdOrParams === 'object' && tmdbIdOrParams !== null) {
            const actualId = tmdbIdOrParams.tmdbId;
            const actualType = tmdbIdOrParams.type || 'movie';
            const actualSeason = tmdbIdOrParams.season || 1;
            const actualEpisode = tmdbIdOrParams.episode || 1;
            const actualServer = tmdbIdOrParams.server || 'vidrift';
            return `/consumet.html?player=true&id=${actualId}&type=${actualType}&s=${actualSeason}&e=${actualEpisode}&server=${actualServer}`;
        }
        return `/consumet.html?player=true&id=${tmdbIdOrParams}&type=${type}&s=${season}&e=${episode}&server=${server}`;
    }

    static generateTorrentUrl(queryOrTmdb: string | number, type: 'movie' | 'tv' = 'movie', season: number = 1, episode: number = 1): string {
        return `/consumet.html#torrent?q=${encodeURIComponent(String(queryOrTmdb))}&type=${type}&s=${season}&e=${episode}`;
    }

    static generateInfoUrl(tmdbId: number | string, type: 'movie' | 'tv' = 'movie'): string {
        return `/info.html?id=${encodeURIComponent(String(tmdbId))}&type=${encodeURIComponent(type)}`;
    }

    static generateDetailsUrl(tmdbId: number | string, type: 'movie' | 'tv' = 'movie'): string {
        return `/consumet.html#details?id=${tmdbId}&type=${type}`;
    }

    static generateExternalServerUrl(serverKey: string, tmdbId: number | string, type: 'movie' | 'tv' = 'movie', season: number = 1, episode: number = 1): string {
        const server = SITE_MAP.streaming_servers.find(s => s.id === serverKey) || SITE_MAP.streaming_servers[0];
        if (type === 'tv') {
            return server.tv_url_template
                .replace('{tmdb_id}', String(tmdbId))
                .replace('{season}', String(season))
                .replace('{episode}', String(episode));
        } else {
            return server.movie_url_template.replace('{tmdb_id}', String(tmdbId));
        }
    }

    static generateChannelStreamUrl(streamUrl: string, channelName: string = '', logoUrl: string = '', source: string = 'local_ai'): string {
        return `/play_consumet.php?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(channelName)}&logo=${encodeURIComponent(logoUrl)}&source=${encodeURIComponent(source)}`;
    }

    static generateLiveProxyUrl(streamUrl: string): string {
        return `/live.php?url=${encodeURIComponent(streamUrl)}`;
    }

    static generateYouTubeVideoUrl(videoId: string): string {
        return `/consumet.html#youtube?v=${encodeURIComponent(videoId)}`;
    }

    static generateYouTubeAudioUrl(videoId: string, title: string = ''): string {
        return `/music.html?yt=${encodeURIComponent(videoId)}&title=${encodeURIComponent(title)}`;
    }

    static generateMusicSearchUrl(query: string): string {
        return `/music.html?q=${encodeURIComponent(query)}`;
    }

    static generateBookSearchUrl(query: string): string {
        return `/books.html?search=${encodeURIComponent(query)}`;
    }

    static generateTabUrl(tabId: string): string {
        const validTabs = ['home', 'movies', 'tv', 'anime', 'manga', 'sports', 'channels', 'youtube', 'torrent', 'watchlist', 'settings'];
        if (validTabs.includes(tabId)) {
            return `/consumet.html#${tabId}`;
        }
        if (tabId === 'hero') return '/hero.html';
        if (tabId === 'books') return '/books.html';
        if (tabId === 'music') return '/music.html';
        if (tabId === 'portal' || tabId === 'm3u') return '/index.php';
        if (tabId === 'admin') return '/hari.html';
        if (tabId === 'login') return '/login.php';
        return '/consumet.html';
    }
}
