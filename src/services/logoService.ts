import fs from 'fs';
import path from 'path';
import { LogoScraperService } from './logoScraperService';

export class LogoService {
    private static logoMapCache: { ids: Record<string, string>; names: Record<string, string> } | null = null;
    private static lastLoadTime = 0;

    private static curatedBrands: Array<{ pattern: RegExp; logo: string }> = [
        // Kids & Cartoons
        { pattern: /nick\s*jr|nickjr/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Nick_Jr._logo_2023.svg/960px-Nick_Jr._logo_2023.svg.png" },
        { pattern: /nicktoons/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Nicktoons_2023_logo.svg/960px-Nicktoons_2023_logo.svg.png" },
        { pattern: /nick\s*(?:ca|usa|uk|us|hd|4k|east|west|cc)?\b|nickelodeon/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nickelodeon_2023.svg/960px-Nickelodeon_2023.svg.png" },
        { pattern: /cartoon\s*network/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/960px-Cartoon_Network_2010_logo.svg.png" },
        { pattern: /cartoonito/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Cartoonito_-_Logo_2021.svg/960px-Cartoonito_-_Logo_2021.svg.png" },
        { pattern: /boomerang/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Boomerang_2014_logo.svg/960px-Boomerang_2014_logo.svg.png" },
        { pattern: /disney\s*xd/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Disney_XD_2015_logo.svg/960px-Disney_XD_2015_logo.svg.png" },
        { pattern: /disney\s*(?:jr|junior)/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Disney_Junior_2024.svg/960px-Disney_Junior_2024.svg.png" },
        { pattern: /disney\s*chan|disney\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/2024_Disney_Channel_text_logo.svg/960px-2024_Disney_Channel_text_logo.svg.png" },
        { pattern: /peppa\s*pig/i, logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Peppa_Pig_logo.svg/960px-Peppa_Pig_logo.svg.png" },
        { pattern: /oddbods/i, logo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a4/Oddbods_Logo.png/800px-Oddbods_Logo.png" },
        { pattern: /pj\s*mask/i, logo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/PJ_Masks_logo.png/800px-PJ_Masks_logo.png" },
        { pattern: /chu\s*chu\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/fe/ChuChu_TV_logo.svg/800px-ChuChu_TV_logo.svg.png" },
        { pattern: /baby\s*bus/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/BabyBus_Logo.png/800px-BabyBus_Logo.png" },
        { pattern: /baby\s*rhymes|cocomelon/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/CoComelon_logo.svg/800px-CoComelon_logo.svg.png" },
        { pattern: /paw\s*patrol/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/PAW_Patrol_Logo.svg/800px-PAW_Patrol_Logo.svg.png" },
        { pattern: /spongebob/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/SpongeBob_SquarePants_logo.svg/800px-SpongeBob_SquarePants_logo.svg.png" },

        // Movies & Premium
        { pattern: /hbo\s*2|hbo2/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/HBO2_logo_2014.svg/960px-HBO2_logo_2014.svg.png" },
        { pattern: /hbo\s*sig/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/HBO_Signature_logo_2014.svg/960px-HBO_Signature_logo_2014.svg.png" },
        { pattern: /hbo\s*fam/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/HBO_Family_logo_2014.svg/960px-HBO_Family_logo_2014.svg.png" },
        { pattern: /hbo\s*com/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/HBO_Comedy_logo_2014.svg/960px-HBO_Comedy_logo_2014.svg.png" },
        { pattern: /hbo\s*zone/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/HBO_Zone_logo_2014.svg/960px-HBO_Zone_logo_2014.svg.png" },
        { pattern: /hbo\s*lat/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/HBO_Latino_logo_2014.svg/960px-HBO_Latino_logo_2014.svg.png" },
        { pattern: /hbo\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/960px-HBO_logo.svg.png" },
        { pattern: /cinemax/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Cinemax_2020.svg/960px-Cinemax_2020.svg.png" },
        { pattern: /starz\s*encore/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Starz_Encore_2016_logo.svg/960px-Starz_Encore_2016_logo.svg.png" },
        { pattern: /starz\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Starz_2022_logo.svg/960px-Starz_2022_logo.svg.png" },
        { pattern: /showtime\s*showcase/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Showtime_Showcase_logo_2024.svg/960px-Showtime_Showcase_logo_2024.svg.png" },
        { pattern: /showtime/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Showtime.svg/960px-Showtime.svg.png" },
        { pattern: /mgm\+|epix/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/MGM%2B_logo.svg/960px-MGM%2B_logo.svg.png" },

        // Entertainment & Docu
        { pattern: /discovery\s*life/i, logo: "https://i.imgur.com/ObPFgT8.png" },
        { pattern: /discovery\s*sci/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Science_Channel_2017.svg/960px-Science_Channel_2017.svg.png" },
        { pattern: /discovery\s*chan|discovery\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Discovery_Channel_2019.svg/960px-Discovery_Channel_2019.svg.png" },
        { pattern: /animal\s*planet/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/2018_Animal_Planet_logo.svg/960px-2018_Animal_Planet_logo.svg.png" },
        { pattern: /nat\s*geo\s*wild/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Nat_Geo_Wild_2018.svg/960px-Nat_Geo_Wild_2018.svg.png" },
        { pattern: /nat.*geo|national\s*geographic/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/National_Geographic_Logo.svg/960px-National_Geographic_Logo.svg.png" },
        { pattern: /history\s*2|h2\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/History_2_logo_2021.svg/960px-History_2_logo_2021.svg.png" },
        { pattern: /history\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/960px-History_Logo.svg.png" },
        { pattern: /tlc\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/TLC_Logo_2020.svg/960px-TLC_Logo_2020.svg.png" },
        { pattern: /hgtv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/HGTV_2015_logo.svg/960px-HGTV_2015_logo.svg.png" },
        { pattern: /food\s*network/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Food_Network_logo_2016.svg/960px-Food_Network_logo_2016.svg.png" },
        { pattern: /travel\s*chan/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Travel_Channel_2018.svg/960px-Travel_Channel_2018.svg.png" },
        { pattern: /investigation\s*discovery|id\s*hd/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Investigation_Discovery_logo_2020.svg/960px-Investigation_Discovery_logo_2020.svg.png" },
        { pattern: /paramount\s*net/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Paramount_Network_2020_logo.svg/960px-Paramount_Network_2020_logo.svg.png" },
        { pattern: /comedy\s*central/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Comedy_Central_2018.svg/960px-Comedy_Central_2018.svg.png" },
        { pattern: /hallmark\s*mov/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Hallmark_Movies_%26_Mysteries_2014_logo.svg/960px-Hallmark_Movies_%26_Mysteries_2014_logo.svg.png" },
        { pattern: /hallmark\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Hallmark_Channel_2012_logo.svg/960px-Hallmark_Channel_2012_logo.svg.png" },
        { pattern: /a&e|a\s*&\s*e/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/A%26E_Network_logo_2017.svg/960px-A%26E_Network_logo_2017.svg.png" },
        { pattern: /amc\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/AMC_logo_2019.svg/960px-AMC_logo_2019.svg.png" },
        { pattern: /fx\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/FX_2013_logo.svg/960px-FX_2013_logo.svg.png" },
        { pattern: /fxx\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/FXX_2013_logo.svg/960px-FXX_2013_logo.svg.png" },
        { pattern: /tnt\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/TNT_2016_logo.svg/960px-TNT_2016_logo.svg.png" },
        { pattern: /tbs\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/TBS_2016_logo.svg/960px-TBS_2016_logo.svg.png" },
        { pattern: /usa\s*net/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/USA_Network_logo_2016.svg/960px-USA_Network_logo_2016.svg.png" },
        { pattern: /syfy/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Syfy_2017.svg/960px-Syfy_2017.svg.png" },
        { pattern: /bravo/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Bravo_2017_logo.svg/960px-Bravo_2017_logo.svg.png" },
        { pattern: /lifetime/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Lifetime_2020_logo.svg/960px-Lifetime_2020_logo.svg.png" },
        { pattern: /e!\b|e\s*entertain/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/E%21_2012_logo.svg/960px-E%21_2012_logo.svg.png" },

        // News & Weather
        { pattern: /cnn\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/960px-CNN.svg.png" },
        { pattern: /msnbc/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/MSNBC_2021.svg/960px-MSNBC_2021.svg.png" },
        { pattern: /fox\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Fox_News_Channel_logo.svg/960px-Fox_News_Channel_logo.svg.png" },
        { pattern: /fox\s*business/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Fox_Business_Network_logo.svg/960px-Fox_Business_Network_logo.svg.png" },
        { pattern: /cnbc/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CNBC_logo.svg/960px-CNBC_logo.svg.png" },
        { pattern: /bbc\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_News_2022.svg/960px-BBC_News_2022.svg.png" },
        { pattern: /bbc\s*one/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/BBC_One_2021.svg/960px-BBC_One_2021.svg.png" },
        { pattern: /bbc\s*two/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/BBC_Two_2021.svg/960px-BBC_Two_2021.svg.png" },
        { pattern: /bbc\s*amer/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/BBC_America_2021.svg/960px-BBC_America_2021.svg.png" },
        { pattern: /weather\s*chan/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/The_Weather_Channel_logo_2005-present.svg/960px-The_Weather_Channel_logo_2005-present.svg.png" },

        // Indian Movies, Entertainment & Regional
        { pattern: /star\s*gold\s*select/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Star_Gold_Select_logo.png/512px-Star_Gold_Select_logo.png" },
        { pattern: /star\s*gold\s*2/i, logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_2/images/LOGO_HD/image.png" },
        { pattern: /star\s*gold\s*romance/i, logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_ROMANCE/images/LOGO_HD/image.png" },
        { pattern: /star\s*gold\s*thrills/i, logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_STAR_GOLD_THRILLS/images/LOGO_HD/image.png" },
        { pattern: /star\s*gold/i, logo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Star_Gold_2023.svg/512px-Star_Gold_2023.svg.png" },
        { pattern: /star\s*movies/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Star_Movies_2023.svg/512px-Star_Movies_2023.svg.png" },
        { pattern: /star\s*plus/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Star_Plus_2018.svg/960px-Star_Plus_2018.svg.png" },
        { pattern: /star\s*bharat/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Star_Bharat_logo_2017.svg/960px-Star_Bharat_logo_2017.svg.png" },
        { pattern: /star\s*world/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Star_World_2019.svg/512px-Star_World_2019.svg.png" },
        { pattern: /star\s*pravah/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Star_Pravah_logo_2021.svg/512px-Star_Pravah_logo_2021.svg.png" },
        { pattern: /star\s*maa/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Star_Maa_logo_2020.svg/512px-Star_Maa_logo_2020.svg.png" },
        { pattern: /star\s*vijay/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Star_Vijay_logo_2017.svg/512px-Star_Vijay_logo_2017.svg.png" },
        { pattern: /star\s*suvarna/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Star_Suvarna_logo.svg/512px-Star_Suvarna_logo.svg.png" },
        { pattern: /star\s*jalsha/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Star_Jalsha_logo_2019.svg/512px-Star_Jalsha_logo_2019.svg.png" },
        { pattern: /star\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Star_Sports_logo.png" },
        
        { pattern: /&pictures|and\s*pictures/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/%26pictures_logo_2017.svg/512px-%26pictures_logo_2017.svg.png" },
        { pattern: /&tv|and\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/%26TV_logo_2017.svg/512px-%26TV_logo_2017.svg.png" },
        { pattern: /&flix|and\s*flix/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/%26flix_logo_2018.svg/512px-%26flix_logo_2018.svg.png" },
        { pattern: /&prive|and\s*prive/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/%26prive_HD_logo.svg/512px-%26prive_HD_logo.svg.png" },
        { pattern: /&xplor|and\s*xplor/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/%26xplor_HD_logo.svg/512px-%26xplor_HD_logo.svg.png" },

        { pattern: /zee\s*cinema/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Zee_Cinema_2017.svg/960px-Zee_Cinema_2017.svg.png" },
        { pattern: /zee\s*cinemalu/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Zee_Telugu_2017.svg/512px-Zee_Telugu_2017.svg.png" },
        { pattern: /zee\s*classic/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Zee_Classic_2017.svg/512px-Zee_Classic_2017.svg.png" },
        { pattern: /zee\s*action/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Zee_Action_2017.svg/512px-Zee_Action_2017.svg.png" },
        { pattern: /zee\s*bollywood/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Zee_Bollywood_logo.svg/512px-Zee_Bollywood_logo.svg.png" },
        { pattern: /zee\s*keralam/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Zee_Keralam_2018.svg/512px-Zee_Keralam_2018.svg.png" },
        { pattern: /zee\s*tamil/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Zee_Tamil_2017.svg/512px-Zee_Tamil_2017.svg.png" },
        { pattern: /zee\s*telugu/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Zee_Telugu_2017.svg/512px-Zee_Telugu_2017.svg.png" },
        { pattern: /zee\s*kannada/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Zee_Kannada_2017.svg/512px-Zee_Kannada_2017.svg.png" },
        { pattern: /zee\s*bangla/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Zee_Bangla_2017.svg/512px-Zee_Bangla_2017.svg.png" },
        { pattern: /zee\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Zee_News_2022.svg/512px-Zee_News_2022.svg.png" },
        { pattern: /zee\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Zee_TV_2017.svg/960px-Zee_TV_2017.svg.png" },

        { pattern: /sony\s*sab/i, logo: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Sony_SAB_logo.png" },
        { pattern: /sony\s*max\s*2/i, logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Sony_Max_logo.png" },
        { pattern: /sony\s*max/i, logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Sony_Max_logo.png" },
        { pattern: /sony\s*marathi/i, logo: "https://www.sonypicturesnetworks.com/images/logos/Sony_MARATHI.png" },
        { pattern: /sony\s*yay|son\s*yay/i, logo: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Sony_Yay%21_logo.png" },
        { pattern: /sony\s*pal/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Sony_Pal_logo_2022.svg/512px-Sony_Pal_logo_2022.svg.png" },
        { pattern: /sony\s*wah/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Sony_Wah_logo_2022.svg/512px-Sony_Wah_logo_2022.svg.png" },
        { pattern: /sony\s*aath/i, logo: "https://www.sonypicturesnetworks.com/images/logos/SONY%20AATH.png" },
        { pattern: /sony\s*pix/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Sony_Pix_logo_2022.svg/512px-Sony_Pix_logo_2022.svg.png" },
        { pattern: /sony\s*earth|sony\s*bbc/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Sony_BBC_Earth_logo_2022.svg/512px-Sony_BBC_Earth_logo_2022.svg.png" },
        { pattern: /sony\s*ten|sony\s*six|sony\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/9/90/Sony_Sports_Network_logo.png" },
        { pattern: /sony\b|set\s*hd/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Sony_Entertainment_Television_logo_2022.svg/512px-Sony_Entertainment_Television_logo_2022.svg.png" },

        { pattern: /colors\s*cineplex/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Colors_Cineplex_logo.svg/512px-Colors_Cineplex_logo.svg.png" },
        { pattern: /colors\s*rishtey/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Colors_Rishtey_logo.svg/512px-Colors_Rishtey_logo.svg.png" },
        { pattern: /colors\s*bangla/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Colors_TV_logo.svg/512px-Colors_TV_logo.svg.png" },
        { pattern: /colors\s*kannada/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Colors_TV_logo.svg/512px-Colors_TV_logo.svg.png" },
        { pattern: /colors\s*marathi/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Colors_TV_logo.svg/512px-Colors_TV_logo.svg.png" },
        { pattern: /colors\s*infinity/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Colors_Infinity_logo.svg/512px-Colors_Infinity_logo.svg.png" },
        { pattern: /colors\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Colors_TV_logo.svg/960px-Colors_TV_logo.svg.png" },

        { pattern: /asianet\s*movies/i, logo: "https://upload.wikimedia.org/wikipedia/commons/7/77/Asianet_logo.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original" },
        { pattern: /asianet\s*plus/i, logo: "https://upload.wikimedia.org/wikipedia/commons/6/66/Asianet_Plus_Logo.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original" },
        { pattern: /asianet\s*(?:fhd|4k)|asianet/i, logo: "https://upload.wikimedia.org/wikipedia/commons/7/77/Asianet_logo.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original" },
        { pattern: /mazhavil/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Mazhavil_Manorama_logo.svg/512px-Mazhavil_Manorama_logo.svg.png" },
        { pattern: /manorama\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Manorama_News_logo.svg/512px-Manorama_News_logo.svg.png" },
        { pattern: /mathrubhumi/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Mathrubhumi_News_logo.svg/512px-Mathrubhumi_News_logo.svg.png" },
        { pattern: /flowers/i, logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Flowers_TV_logo.png" },
        { pattern: /kairali/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kairali_TV_logo.svg/512px-Kairali_TV_logo.svg.png" },
        { pattern: /amrita/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Amrita_TV_logo.svg/512px-Amrita_TV_logo.svg.png" },
        { pattern: /news\s*24|24\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/24_News_logo.svg/512px-24_News_logo.svg.png" },
        { pattern: /media\s*one/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Media_One_TV_logo.svg/512px-Media_One_TV_logo.svg.png" },
        { pattern: /reporter\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Reporter_TV_logo.svg/512px-Reporter_TV_logo.svg.png" },

        { pattern: /sun\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Sun_TV_logo.svg/960px-Sun_TV_logo.svg.png" },
        { pattern: /sun\s*music/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Sun_Music_logo.svg/512px-Sun_Music_logo.svg.png" },
        { pattern: /sun\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Sun_News_logo.svg/512px-Sun_News_logo.svg.png" },
        { pattern: /ktv\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/KTV_logo_2018.svg/512px-KTV_logo_2018.svg.png" },
        { pattern: /surya\s*tv|surya\s*movies|surya\s*music|surya\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Surya_TV_logo.svg/512px-Surya_TV_logo.svg.png" },
        { pattern: /gemini\s*tv|gemini\s*movies|gemini\s*music|gemini\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Gemini_TV_logo.svg/512px-Gemini_TV_logo.svg.png" },
        { pattern: /udaya\s*tv|udaya\s*movies|udaya\s*music|udaya\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Udaya_TV_logo.svg/512px-Udaya_TV_logo.svg.png" },

        { pattern: /aaj\s*tak/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Aaj_Tak_logo.svg/512px-Aaj_Tak_logo.svg.png" },
        { pattern: /india\s*tv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/India_TV_logo.svg/512px-India_TV_logo.svg.png" },
        { pattern: /abp\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png" },
        { pattern: /ndtv/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/NDTV_logo.svg/512px-NDTV_logo.svg.png" },
        { pattern: /republic\s*tv|republic\s*bharat|republic\s*bangla/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Republic_TV_logo.svg/512px-Republic_TV_logo.svg.png" },
        { pattern: /times\s*now/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Times_Now_logo.svg/512px-Times_Now_logo.svg.png" },
        { pattern: /sports\s*18/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Sports18_1_logo.svg/512px-Sports18_1_logo.svg.png" },
        { pattern: /willow/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Willow_Cricket_logo.svg/512px-Willow_Cricket_logo.svg.png" },
        { pattern: /sky\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Sky_Sports_logo_2020.svg/512px-Sky_Sports_logo_2020.svg.png" },
        { pattern: /tnt\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/TNT_Sports_logo.svg/512px-TNT_Sports_logo.svg.png" },
        { pattern: /supersport/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SuperSport_logo_2020.svg/512px-SuperSport_logo_2020.svg.png" },

        // Sports
        { pattern: /espn\s*2/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/ESPN2_logo.svg/960px-ESPN2_logo.svg.png" },
        { pattern: /espnu/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/ESPNU_logo.svg/960px-ESPNU_logo.svg.png" },
        { pattern: /espn\s*news/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/ESPNews_2019_logo.svg/960px-ESPNews_2019_logo.svg.png" },
        { pattern: /espn\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/960px-ESPN_wordmark.svg.png" },
        { pattern: /fox\s*sports\s*1|fs1/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Fox_Sports_1_logo.svg/960px-Fox_Sports_1_logo.svg.png" },
        { pattern: /fox\s*sports\s*2|fs2/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Fox_Sports_2_logo.svg/960px-Fox_Sports_2_logo.svg.png" },
        { pattern: /fox\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fox_Sports_logo.svg/960px-Fox_Sports_logo.svg.png" },
        { pattern: /nbc\s*sports/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/NBC_Sports_logo.svg/960px-NBC_Sports_logo.svg.png" },
        { pattern: /bein\s*sports\s*1\s*fr/i, logo: "/assets/logos/bein_sports_1_france.svg" },
        { pattern: /bein\s*sports\s*2\s*fr/i, logo: "/assets/logos/bein_sports_2_france.svg" },
        { pattern: /bein\s*sports\s*3\s*fr/i, logo: "/assets/logos/bein_sports_3_france.svg" },
        { pattern: /bein\s*sports/i, logo: "/assets/logos/bein_sports_mena_english_2.svg" },
        { pattern: /dazn/i, logo: "/assets/logos/dazn_2_spain.svg" },
        { pattern: /astro\s*supersport\s*3/i, logo: "/assets/logos/astro_supersport_3.svg" },
        { pattern: /astro\s*supersport\s*4/i, logo: "/assets/logos/astro_supersport_4.svg" },
        { pattern: /astro\s*cricket/i, logo: "/assets/logos/astro_cricket.svg" },
        { pattern: /sportsnet\s*one/i, logo: "/assets/logos/sportsnet_one.svg" },
        { pattern: /sportsnet\s*360/i, logo: "/assets/logos/sportsnet_360.svg" },
        { pattern: /tsn\s*5/i, logo: "/assets/logos/tsn5.svg" },

        // Famous TV Series 24/7 & Franchises
        { pattern: /friends/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Friends_logo.svg/512px-Friends_logo.svg.png" },
        { pattern: /breaking\s*bad/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Breaking_Bad_logo.svg/512px-Breaking_Bad_logo.svg.png" },
        { pattern: /game\s*of\s*thrones/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Game_of_Thrones_title_card.svg/512px-Game_of_Thrones_title_card.svg.png" },
        { pattern: /the\s*office|office\s*us/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/The_Office_US_logo.svg/512px-The_Office_US_logo.svg.png" },
        { pattern: /stranger\s*things/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Stranger_Things_logo.png/512px-Stranger_Things_logo.png" },
        { pattern: /south\s*park/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/South_Park_logo.svg/512px-South_Park_logo.svg.png" },
        { pattern: /simpsons/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/The_Simpsons_Logo.svg/512px-The_Simpsons_Logo.svg.png" },
        { pattern: /family\s*guy/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Family_Guy_Logo.svg/512px-Family_Guy_Logo.svg.png" },
        { pattern: /big\s*bang\s*theory/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/The_Big_Bang_Theory_Logo.svg/512px-The_Big_Bang_Theory_Logo.svg.png" },
        { pattern: /brooklyn\s*nine/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Brooklyn_Nine-Nine_logo.svg/512px-Brooklyn_Nine-Nine_logo.svg.png" },
        { pattern: /modern\s*family/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Modern_Family_logo.svg/512px-Modern_Family_logo.svg.png" },
        { pattern: /suits/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Suits_logo.svg/512px-Suits_logo.svg.png" },
        { pattern: /peaky\s*blinders/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Peaky_Blinders_logo.png/512px-Peaky_Blinders_logo.png" },
        { pattern: /rick\s*and\s*morty/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Rick_and_Morty.svg/512px-Rick_and_Morty.svg.png" },
        { pattern: /pokemon|pokémon/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/512px-International_Pok%C3%A9mon_logo.svg.png" },
        { pattern: /tom\s*(&|and)\s*jerry/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tom_and_Jerry_logo.svg/512px-Tom_and_Jerry_logo.svg.png" },
        { pattern: /looney\s*tunes/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Looney_tunes_logo.svg/512px-Looney_tunes_logo.svg.png" },
        { pattern: /doraemon/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Doraemon_character.png/512px-Doraemon_character.png" },
        { pattern: /shinchan|shin\s*chan/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Crayon_Shin-chan_logo.png/512px-Crayon_Shin-chan_logo.png" },
        { pattern: /ben\s*10/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Ben_10_logo.svg/512px-Ben_10_logo.svg.png" },
        { pattern: /oggy/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Oggy_and_the_Cockroaches_logo.png/512px-Oggy_and_the_Cockroaches_logo.png" },

        // OTT & FAST Channels
        { pattern: /netflix/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/512px-Netflix_2015_logo.svg.png" },
        { pattern: /amazon\s*prime|amazon/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Prime_Video.png/512px-Prime_Video.png" },
        { pattern: /hotstar/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Disney%2B_Hotstar_logo.svg/512px-Disney%2B_Hotstar_logo.svg.png" },
        { pattern: /zee5/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/ZEE5_logo.svg/512px-ZEE5_logo.svg.png" },
        { pattern: /voot/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Voot_Logo.svg/512px-Voot_Logo.svg.png" },
        { pattern: /tata\s*play|tata\s*sky/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tata_Play_2022_logo.svg/512px-Tata_Play_2022_logo.svg.png" },
        { pattern: /dangal/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Dangal_TV_logo.svg/512px-Dangal_TV_logo.svg.png" },
        { pattern: /goldmines/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Goldmines_Telefilms_logo.png/512px-Goldmines_Telefilms_logo.png" },
        { pattern: /b4u/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png" },
        { pattern: /mastiii/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Mastiii_logo.png/512px-Mastiii_logo.png" },
        { pattern: /9x/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/9XM_logo.svg/512px-9XM_logo.svg.png" },
        { pattern: /shemaroo/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Shemaroo_Entertainment_Logo.svg/512px-Shemaroo_Entertainment_Logo.svg.png" },
        { pattern: /mandir|temple|chintpurni|hanuman|shri|sri\s*sankara|aastha|sanskar|sadhna|arihant|peace\s*tv|jothi|divya|bhakti/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Om_symbol.svg/512px-Om_symbol.svg.png" },
        { pattern: /ptc\b/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/PTC_Punjabi_logo.png/512px-PTC_Punjabi_logo.png" },
        { pattern: /tv9/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/TV9_Logo.svg/512px-TV9_Logo.svg.png" },

        // Motorsports & Racing
        { pattern: /sky\s*sports\s*f1/i, logo: "https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1306.png" },
        { pattern: /sky\s*sports\s*racing/i, logo: "https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1354.png" },
        { pattern: /dazn\s*f1/i, logo: "https://i.imgur.com/yFCr5XX.png" },
        { pattern: /super\s*sport\s*motorsport|supersport\s*motorsport/i, logo: "https://i.imgur.com/gCjaY0F.png" },
        { pattern: /motor\s*trend|motortrend/i, logo: "https://i.imgur.com/hKDccCL.png" },
        { pattern: /fox\s*racing|fox\s*sports\s*racing/i, logo: "https://i.imgur.com/U5al8V3.png" },
        { pattern: /f1\b|formula\s*1|formula\s*one/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png" },
        { pattern: /motogp|moto\s*gp/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/MotoGP_Logo.svg/512px-MotoGP_Logo.svg.png" },
        { pattern: /nascar/i, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/NASCAR_logo.svg/512px-NASCAR_logo.svg.png" },
        { pattern: /mavtv/i, logo: "https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBD47000010L_20240327T014526_SSTL.png" },
        { pattern: /speed\s*news/i, logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Speed_News.png" }
    ];

    public static generateBroadcastBadge(title: string, genre?: string): string {
        const cleanTitle = (title || 'Live TV').replace(/[💎⭐️]/g, '').trim();
        const shortTitle = cleanTitle.length > 20 ? cleanTitle.substring(0, 18) + '...' : cleanTitle;
        const tag = (genre || 'LIVE').toUpperCase().replace(/[^A-Z0-9 ]/g, '').substring(0, 10);
        
        let hash = 0;
        for (let i = 0; i < cleanTitle.length; i++) hash = (hash << 5) - hash + cleanTitle.charCodeAt(i);
        const hues = [
            ['#ef4444', '#b91c1c'],
            ['#3b82f6', '#1d4ed8'],
            ['#10b981', '#047857'],
            ['#8b5cf6', '#6d28d9'],
            ['#f59e0b', '#d97706'],
            ['#ec4899', '#be185d'],
            ['#06b6d4', '#0e7490'],
            ['#6366f1', '#4338ca']
        ];
        const pair = hues[Math.abs(hash) % hues.length];

        const escapeXml = (str: string) => str.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pair[0]}"/>
      <stop offset="100%" stop-color="${pair[1]}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="16" fill="url(#bg)" stroke="#1e293b" stroke-width="2"/>
  <circle cx="160" cy="80" r="44" fill="url(#accent)" opacity="0.18" />
  <g transform="translate(140, 60)" fill="url(#accent)">
    <rect x="2" y="7" width="36" height="26" rx="4" fill="none" stroke="url(#accent)" stroke-width="3"/>
    <polyline points="12 1 20 7 28 1" fill="none" stroke="url(#accent)" stroke-width="3" stroke-linecap="round"/>
  </g>
  <text x="160" y="145" text-anchor="middle" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="17" font-weight="700" letter-spacing="0.5">${escapeXml(shortTitle)}</text>
  <rect x="120" y="162" width="80" height="20" rx="10" fill="url(#accent)" opacity="0.9"/>
  <text x="160" y="176" text-anchor="middle" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="800" letter-spacing="1">${escapeXml(tag)}</text>
</svg>`;

        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    public static loadLogoMap(): { ids: Record<string, string>; names: Record<string, string> } {
        const now = Date.now();
        if (this.logoMapCache && (now - this.lastLoadTime < 600000)) {
            return this.logoMapCache;
        }

        const mapPath = path.join(process.cwd(), 'doctor_strange', 'iptv_logo_map.json');
        try {
            if (fs.existsSync(mapPath)) {
                this.logoMapCache = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                this.lastLoadTime = now;
                return this.logoMapCache!;
            }
        } catch (e) {
            console.error('Failed to load iptv_logo_map.json:', e);
        }

        this.logoMapCache = { ids: {}, names: {} };
        return this.logoMapCache;
    }

    public static isBrokenLogo(logo?: string | null): boolean {
        if (!logo || typeof logo !== 'string') return true;
        const l = logo.trim().toLowerCase();
        if (l.length < 10) return true;
        if (l.includes('alphacoders') || l.includes('865013')) return true;
        if (l.includes('generic.png') || l.includes('placeholder') || l.includes('default_logo') || l.includes('default-logo') || l.includes('default_channel') || l.includes('default.png')) return true;
        if (l.includes('screenshot-2026') || l.includes('localhost') || l.includes('example.com') || l.includes('127.0.0.1')) return true;
        if (l.includes('portal.png') || l.includes('/portal/picon') || l.includes('wallpaper') || l.includes('/misc/logos/320/') || l.includes('/stalker_portal/') || l.includes('/c/picon/') || l.includes('picon/')) return true;
        if (l.includes('ui-avatars.com') || l.includes('i.ibb.co/3sbb43x')) return true;
        if (l.includes('images.unsplash.com') && !l.includes('logo')) return true;
        return false;
    }

    public static cleanChannelName(rawName: string): string {
        if (!rawName) return '';
        let cl = rawName.trim();
        // Remove stream details inside brackets like [Codecs: H.264 / AVC ...]
        cl = cl.replace(/\[.*?\]|\(.*?\)/g, '');
        // Remove country prefixes like "US: ", "CA: ", "IN: ", "UK: ", "1▁...▁"
        cl = cl.replace(/^[A-Z]{2,3}\s*:\s*/i, '');
        cl = cl.replace(/^[\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\s•☆|💎⭐️]+/, '');
        // Remove common resolution & tag suffixes
        cl = cl.replace(/\b(?:4k|uhd|fhd|hd|sd|1080p|720p|hevc|h264|h265|ca|usa|uk|us|in|india|canada|vip|backup|east|west|latino|multiaudio|cc|24\/7|24x7)\b/gi, '');
        // Clean special characters
        return cl.trim();
    }

    public static getLogoForChannel(name: string, xmltvId?: string, currentLogo?: string): string {
        // 1. Check curated network brands pattern FIRST to ensure authentic broadcast logo
        for (const brand of this.curatedBrands) {
            if (brand.pattern.test(name)) {
                return brand.logo;
            }
        }

        // 2. If current logo is valid, authentic and not a broken/portal placeholder, keep it
        if (!this.isBrokenLogo(currentLogo)) {
            return currentLogo!.trim();
        }

        const map = this.loadLogoMap();

        // 3. Check XMLTV ID directly
        if (xmltvId) {
            const cleanXmlId = xmltvId.trim().toLowerCase();
            if (map.ids && map.ids[cleanXmlId]) {
                return map.ids[cleanXmlId];
            }
        }

        // 4. Check normalized channel name in iptv_logo_map.json
        const cleanedName = this.cleanChannelName(name);
        const nameSlug = cleanedName.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (nameSlug && map.names && map.names[nameSlug]) {
            return map.names[nameSlug];
        }

        // 5. High quality dynamic SVG broadcast badge fallback
        return this.generateBroadcastBadge(name);
    }

    public static fixM3uLogos(m3uContent: string): { updatedContent: string; fixedCount: number; total: number } {
        const lines = m3uContent.split(/\r?\n/);
        let fixedCount = 0;
        let total = 0;
        const newLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#EXTINF:')) {
                total++;
                const commaIdx = line.lastIndexOf(',');
                const name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';
                
                // Extract current logo
                let currentLogo = '';
                const logoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/tvg-logo=([^ ]+)/i);
                if (logoMatch) currentLogo = logoMatch[1].trim();

                // Extract xmltv id
                let xmltvId = '';
                const idMatch = line.match(/tvg-id="([^"]+)"/i) || line.match(/tvg-id=([^ ]+)/i);
                if (idMatch) xmltvId = idMatch[1].trim();

                let isCurated = false;
                for (const brand of this.curatedBrands) {
                    if (brand.pattern.test(name)) {
                        isCurated = true;
                        break;
                    }
                }

                if (this.isBrokenLogo(currentLogo) || isCurated) {
                    const resolvedLogo = this.getLogoForChannel(name, xmltvId, isCurated ? undefined : currentLogo);
                    let updatedLine = line;
                    if (logoMatch) {
                        updatedLine = updatedLine.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${resolvedLogo}"`);
                        updatedLine = updatedLine.replace(/tvg-logo=[^ ]+/i, `tvg-logo="${resolvedLogo}"`);
                    } else {
                        // Insert tvg-logo before the last comma
                        if (commaIdx !== -1) {
                            updatedLine = line.substring(0, commaIdx) + ` tvg-logo="${resolvedLogo}"` + line.substring(commaIdx);
                        } else {
                            updatedLine = line + ` tvg-logo="${resolvedLogo}"`;
                        }
                    }
                    newLines.push(updatedLine);
                    fixedCount++;
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        return {
            updatedContent: newLines.join('\n'),
            fixedCount,
            total
        };
    }

    public static fixAllProjectM3uFiles(): { filesUpdated: string[]; totalFixed: number } {
        const filesToProcess = [
            path.join(process.cwd(), 'public', 'kliv_zob.m3u'),
            path.join(process.cwd(), 'public', 'kliv_jozo.m3u'),
            path.join(process.cwd(), 'assets', 'sports.m3u')
        ];

        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(vaultDir)) {
            const vaultFiles = fs.readdirSync(vaultDir).filter(f => f.endsWith('.m3u') || f.endsWith('.m3u8'));
            for (const vf of vaultFiles) {
                filesToProcess.push(path.join(vaultDir, vf));
            }
        }

        const filesUpdated: string[] = [];
        let totalFixed = 0;

        for (const filePath of filesToProcess) {
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const { updatedContent, fixedCount } = this.fixM3uLogos(content);
                    if (fixedCount > 0) {
                        fs.writeFileSync(filePath, updatedContent, 'utf8');
                        filesUpdated.push(path.basename(filePath));
                        totalFixed += fixedCount;
                    }
                } catch (e) {
                    console.error(`Error fixing logos for ${filePath}:`, e);
                }
            }
        }

        return { filesUpdated, totalFixed };
    }

    public static fixAllChannelsJsonLogos(): { totalChannels: number; fixedCount: number } {
        const channelsPath = path.join(process.cwd(), 'assets', 'channels.json');
        if (!fs.existsSync(channelsPath)) {
            return { totalChannels: 0, fixedCount: 0 };
        }

        try {
            const raw = fs.readFileSync(channelsPath, 'utf8');
            const channels = JSON.parse(raw);
            if (!Array.isArray(channels)) {
                return { totalChannels: 0, fixedCount: 0 };
            }

            let fixedCount = 0;
            for (const ch of channels) {
                const oldLogo = ch.logo || '';
                const newLogo = this.getLogoForChannel(ch.name || '', undefined, oldLogo);
                if (newLogo && newLogo !== oldLogo) {
                    ch.logo = newLogo;
                    fixedCount++;
                }
            }

            if (fixedCount > 0) {
                fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 4), 'utf8');
            }

            return { totalChannels: channels.length, fixedCount };
        } catch (e) {
            console.error('Error fixing channels.json logos:', e);
            return { totalChannels: 0, fixedCount: 0 };
        }
    }

    /**
     * Search and resolve a channel logo online using DuckDuckGo, Yahoo, Wikipedia, and IPTV-ORG
     */
    public static async searchAndResolveLogo(name: string, xmltvId?: string, currentLogo?: string): Promise<{ logo: string; engine: string; verified: boolean }> {
        // 1. Curated Broadcast Brand Regex (Highest priority authentic assets)
        for (const brand of this.curatedBrands) {
            if (brand.pattern.test(name)) {
                return { logo: brand.logo, engine: 'curated_network', verified: true };
            }
        }

        // 2. Existing valid logo (if authentic and not broken)
        if (!this.isBrokenLogo(currentLogo)) {
            return { logo: currentLogo!.trim(), engine: 'existing_valid', verified: true };
        }

        // 3. Local IPTV-ORG Logo Map Cache
        const map = this.loadLogoMap();
        if (xmltvId) {
            const cleanXmlId = xmltvId.trim().toLowerCase();
            if (map.ids && map.ids[cleanXmlId]) {
                return { logo: map.ids[cleanXmlId], engine: 'iptv_org_xmltv', verified: true };
            }
        }

        const cleanedName = this.cleanChannelName(name);
        const nameSlug = cleanedName.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (nameSlug && map.names && map.names[nameSlug]) {
            return { logo: map.names[nameSlug], engine: 'iptv_org_database', verified: true };
        }

        // 4. Live Web Scraper Search (DuckDuckGo / Yahoo / Wikipedia / Wikimedia / Wikidata)
        try {
            const scraped = await LogoScraperService.searchChannelLogoOnline(name);
            if (scraped && scraped.logo && !this.isBrokenLogo(scraped.logo)) {
                // Cache into iptv_logo_map.json for future instant access
                this.cacheResolvedLogo(nameSlug, scraped.logo);
                return { logo: scraped.logo, engine: `web_search_${scraped.engine}`, verified: true };
            }
        } catch (e: any) {
            console.warn(`[LogoService] Web search scraper warning for "${name}":`, e.message);
        }

        // 5. Fallback High-Quality Broadcast Badge SVG
        const badge = this.generateBroadcastBadge(name);
        return { logo: badge, engine: 'broadcast_badge_svg', verified: false };
    }

    /**
     * Cache newly discovered logo to doctor_strange/iptv_logo_map.json
     */
    private static cacheResolvedLogo(nameSlug: string, logoUrl: string) {
        if (!nameSlug || !logoUrl) return;
        try {
            const map = this.loadLogoMap();
            if (!map.names) map.names = {};
            map.names[nameSlug] = logoUrl;
            const mapPath = path.join(process.cwd(), 'doctor_strange', 'iptv_logo_map.json');
            fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
        } catch (e) {}
    }

    /**
     * Scrapes and fixes logos for all channels in assets/channels.json using Logopedia (logos.fandom.com), DuckDuckGo, Yahoo & Wikimedia backup
     */
    public static async fixAllChannelsJsonLogosWithWebSearch(options?: {
        forceRescrape?: boolean;
        batchSize?: number;
        onProgress?: (info: { current: number; total: number; percent: number; channelName: string; status: 'fixed' | 'valid' | 'fallback'; logo?: string; engine?: string }) => void;
    }): Promise<{ totalChannels: number; fixedCount: number; alreadyValidCount: number; details: Array<{ name: string; logo: string; engine: string }> }> {
        const channelsPath = path.join(process.cwd(), 'assets', 'channels.json');
        if (!fs.existsSync(channelsPath)) {
            return { totalChannels: 0, fixedCount: 0, alreadyValidCount: 0, details: [] };
        }

        try {
            const raw = fs.readFileSync(channelsPath, 'utf8');
            const channels = JSON.parse(raw);
            if (!Array.isArray(channels)) {
                return { totalChannels: 0, fixedCount: 0, alreadyValidCount: 0, details: [] };
            }

            let fixedCount = 0;
            let alreadyValidCount = 0;
            let processedCount = 0;
            const total = channels.length;
            const details: Array<{ name: string; logo: string; engine: string }> = [];
            const force = options?.forceRescrape === true;
            const batchSize = Math.min(options?.batchSize || 6, 12);

            // Process channels in concurrent chunks to keep scraping fast without hitting rate limits
            for (let i = 0; i < channels.length; i += batchSize) {
                const chunk = channels.slice(i, i + batchSize);
                const promises = chunk.map(async (ch) => {
                    const oldLogo = ch.logo || '';
                    const isBroken = this.isBrokenLogo(oldLogo);

                    if (!isBroken && !force) {
                        alreadyValidCount++;
                        processedCount++;
                        if (options?.onProgress) {
                            options.onProgress({
                                current: processedCount,
                                total,
                                percent: Math.round((processedCount / total) * 100),
                                channelName: ch.name || 'Unknown',
                                status: 'valid',
                                logo: oldLogo,
                                engine: 'existing_valid'
                            });
                        }
                        return;
                    }

                    const resolved = await this.searchAndResolveLogo(ch.name || '', undefined, force ? undefined : oldLogo);
                    processedCount++;

                    if (resolved.logo && (resolved.logo !== oldLogo || isBroken)) {
                        ch.logo = resolved.logo;
                        fixedCount++;
                        details.push({
                            name: ch.name,
                            logo: resolved.logo,
                            engine: resolved.engine
                        });
                        if (options?.onProgress) {
                            options.onProgress({
                                current: processedCount,
                                total,
                                percent: Math.round((processedCount / total) * 100),
                                channelName: ch.name || 'Unknown',
                                status: 'fixed',
                                logo: resolved.logo,
                                engine: resolved.engine
                            });
                        }
                    } else {
                        if (options?.onProgress) {
                            options.onProgress({
                                current: processedCount,
                                total,
                                percent: Math.round((processedCount / total) * 100),
                                channelName: ch.name || 'Unknown',
                                status: 'fallback',
                                logo: resolved.logo,
                                engine: resolved.engine
                            });
                        }
                    }
                });

                await Promise.all(promises);
            }

            if (fixedCount > 0) {
                fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 4), 'utf8');
            }

            return {
                totalChannels: channels.length,
                fixedCount,
                alreadyValidCount,
                details
            };
        } catch (e: any) {
            console.error('Error fixing channels.json logos with web search:', e);
            return { totalChannels: 0, fixedCount: 0, alreadyValidCount: 0, details: [] };
        }
    }
}
