const fs = require('fs');
const path = require('path');

const channelsPath = path.join(process.cwd(), 'assets', 'channels.json');
const logoMapPath = path.join(process.cwd(), 'doctor_strange', 'iptv_logo_map.json');

let logoMap = { ids: {}, names: {} };
if (fs.existsSync(logoMapPath)) {
    try {
        logoMap = JSON.parse(fs.readFileSync(logoMapPath, 'utf8'));
    } catch (e) {
        console.error('Error reading logoMap:', e);
    }
}

// Famous TV Shows & Franchises (High Res Official Badges / Logos)
const showLogos = [
    { p: /2\s*broke\s*girls/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/2_Broke_Girls_Logo.svg/512px-2_Broke_Girls_Logo.svg.png' },
    { p: /30\s*rock/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/30_Rock_Logo.svg/512px-30_Rock_Logo.svg.png' },
    { p: /ancient\s*aliens/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/512px-History_Logo.svg.png' },
    { p: /friends/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Friends_logo.svg/512px-Friends_logo.svg.png' },
    { p: /breaking\s*bad/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Breaking_Bad_logo.svg/512px-Breaking_Bad_logo.svg.png' },
    { p: /game\s*of\s*thrones/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Game_of_Thrones_title_card.svg/512px-Game_of_Thrones_title_card.svg.png' },
    { p: /the\s*office|office\s*us/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/The_Office_US_logo.svg/512px-The_Office_US_logo.svg.png' },
    { p: /stranger\s*things/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Stranger_Things_logo.png/512px-Stranger_Things_logo.png' },
    { p: /south\s*park/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/South_Park_logo.svg/512px-South_Park_logo.svg.png' },
    { p: /simpsons/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/The_Simpsons_Logo.svg/512px-The_Simpsons_Logo.svg.png' },
    { p: /family\s*guy/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Family_Guy_Logo.svg/512px-Family_Guy_Logo.svg.png' },
    { p: /big\s*bang\s*theory/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/The_Big_Bang_Theory_Logo.svg/512px-The_Big_Bang_Theory_Logo.svg.png' },
    { p: /brooklyn\s*nine/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Brooklyn_Nine-Nine_logo.svg/512px-Brooklyn_Nine-Nine_logo.svg.png' },
    { p: /modern\s*family/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Modern_Family_logo.svg/512px-Modern_Family_logo.svg.png' },
    { p: /suits/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Suits_logo.svg/512px-Suits_logo.svg.png' },
    { p: /peaky\s*blinders/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Peaky_Blinders_logo.png/512px-Peaky_Blinders_logo.png' },
    { p: /how\s*i\s*met\s*your\s*mother|himym/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/How_I_Met_Your_Mother_title_card.svg/512px-How_I_Met_Your_Mother_title_card.svg.png' },
    { p: /two\s*and\s*a\s*half\s*men/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Two_and_a_Half_Men_Logo.svg/512px-Two_and_a_Half_Men_Logo.svg.png' },
    { p: /seinfeld/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Seinfeld_logo.svg/512px-Seinfeld_logo.svg.png' },
    { p: /prison\s*break/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Prison_Break_logo.svg/512px-Prison_Break_logo.svg.png' },
    { p: /supernatural/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Supernatural_logo.svg/512px-Supernatural_logo.svg.png' },
    { p: /walking\s*dead/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/The_Walking_Dead_2010_logo.svg/512px-The_Walking_Dead_2010_logo.svg.png' },
    { p: /greys\s*anatomy|grey\'s\s*anatomy/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Grey%27s_Anatomy_Logo.svg/512px-Grey%27s_Anatomy_Logo.svg.png' },
    { p: /house\s*m\.?d/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/House_logo.svg/512px-House_logo.svg.png' },
    { p: /sherlock/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Sherlock_title.svg/512px-Sherlock_title.svg.png' },
    { p: /rick\s*and\s*morty/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Rick_and_Morty.svg/512px-Rick_and_Morty.svg.png' },
    { p: /dexter/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Dexter_logo.svg/512px-Dexter_logo.svg.png' },
    { p: /criminal\s*minds/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Criminal_Minds_logo.svg/512px-Criminal_Minds_logo.svg.png' },
    { p: /dr\s*who|doctor\s*who/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Doctor_Who_2018_logo.svg/512px-Doctor_Who_2018_logo.svg.png' },
    { p: /top\s*gear/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Top_Gear_%282016%29.svg/512px-Top_Gear_%282016%29.svg.png' },
    { p: /lucifer/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Lucifer_title_card.png/512px-Lucifer_title_card.png' },
    { p: /mr\s*bean/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Mr_Bean_logo.svg/512px-Mr_Bean_logo.svg.png' },
    { p: /law\s*&\s*order|law\s*and\s*order/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Law_%26_Order_logo.svg/512px-Law_%26_Order_logo.svg.png' },
    { p: /charmed/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Charmed_logo.svg/512px-Charmed_logo.svg.png' },
    { p: /buffy/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Buffy_the_Vampire_Slayer_logo.svg/512px-Buffy_the_Vampire_Slayer_logo.svg.png' },
    { p: /burn\s*notice/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Burn_Notice_logo.svg/512px-Burn_Notice_logo.svg.png' },
    { p: /csi/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/CSI_Crime_Scene_Investigation_logo.svg/512px-CSI_Crime_Scene_Investigation_logo.svg.png' },
    { p: /ncis/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/NCIS_logo.svg/512px-NCIS_logo.svg.png' },
    { p: /naruto/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Naruto_logo.svg/512px-Naruto_logo.svg.png' },
    { p: /dragon\s*ball/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Dragon_Ball_Super.png/512px-Dragon_Ball_Super.png' },
    { p: /one\s*piece/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/One_Piece_Logo.svg/512px-One_Piece_Logo.svg.png' },
    { p: /bleach/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Bleach_logo.svg/512px-Bleach_logo.svg.png' },
    { p: /attack\s*on\s*titan/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Shingeki_no_Kyojin_logo.svg/512px-Shingeki_no_Kyojin_logo.svg.png' },
    { p: /death\s*note/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Death_Note_logo.svg/512px-Death_Note_logo.svg.png' },
    { p: /pokemon|pokémon/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/512px-International_Pok%C3%A9mon_logo.svg.png' },
    { p: /tom\s*(&|and)\s*jerry/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tom_and_Jerry_logo.svg/512px-Tom_and_Jerry_logo.svg.png' },
    { p: /looney\s*tunes/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Looney_tunes_logo.svg/512px-Looney_tunes_logo.svg.png' },
    { p: /scooby\s*doo/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Scooby-Doo_logo.svg/512px-Scooby-Doo_logo.svg.png' },
    { p: /doraemon/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Doraemon_character.png/512px-Doraemon_character.png' },
    { p: /shinchan|shin\s*chan/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Crayon_Shin-chan_logo.png/512px-Crayon_Shin-chan_logo.png' },
    { p: /ben\s*10/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Ben_10_logo.svg/512px-Ben_10_logo.svg.png' },
    { p: /oggy/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Oggy_and_the_Cockroaches_logo.png/512px-Oggy_and_the_Cockroaches_logo.png' },
    { p: /mr\s*maker|mister\s*maker/i, url: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Mister_Maker_Logo.png/512px-Mister_Maker_Logo.png' },
    { p: /chhota\s*bheem/i, url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Chhota_Bheem_logo.png/512px-Chhota_Bheem_logo.png' },
    { p: /motu\s*patlu/i, url: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b3/Motu_Patlu_Logo.png/512px-Motu_Patlu_Logo.png' },

    // Indian & OTT FAST Networks
    { p: /netflix/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/512px-Netflix_2015_logo.svg.png' },
    { p: /amazon\s*prime|amazon/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Prime_Video.png/512px-Prime_Video.png' },
    { p: /hotstar/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Disney%2B_Hotstar_logo.svg/512px-Disney%2B_Hotstar_logo.svg.png' },
    { p: /zee5/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/ZEE5_logo.svg/512px-ZEE5_logo.svg.png' },
    { p: /voot/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Voot_Logo.svg/512px-Voot_Logo.svg.png' },
    { p: /alt\s*balaji|altbalaji/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ALTBalaji_logo.svg/512px-ALTBalaji_logo.svg.png' },
    { p: /mx\s*player|cinemania\s*mx/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/MX_Player_logo.png/512px-MX_Player_logo.png' },
    { p: /jio\s*cinema/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/JioCinema_Logo.svg/512px-JioCinema_Logo.svg.png' },
    { p: /tata\s*play|tata\s*sky/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tata_Play_2022_logo.svg/512px-Tata_Play_2022_logo.svg.png' },
    { p: /dangal/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Dangal_TV_logo.svg/512px-Dangal_TV_logo.svg.png' },
    { p: /goldmines/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Goldmines_Telefilms_logo.png/512px-Goldmines_Telefilms_logo.png' },
    { p: /b4u\s*movies/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png' },
    { p: /b4u\s*music/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/B4U_Music_logo.svg/512px-B4U_Music_logo.svg.png' },
    { p: /b4u\s*kadak/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png' },
    { p: /b4u\s*bhojpuri/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png' },
    { p: /b4u\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png' },
    { p: /mastiii/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Mastiii_logo.png/512px-Mastiii_logo.png' },
    { p: /9x\s*music|9xm/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/9XM_logo.svg/512px-9XM_logo.svg.png' },
    { p: /9x\s*jhakaas/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/9X_Jhakaas_logo.png/512px-9X_Jhakaas_logo.png' },
    { p: /9x\s*tashan/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/9X_Tashan_logo.png/512px-9X_Tashan_logo.png' },
    { p: /9x\s*jalwa/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/9X_Jalwa_logo.png/512px-9X_Jalwa_logo.png' },
    { p: /9x\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/9XM_logo.svg/512px-9XM_logo.svg.png' },
    { p: /zing/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Zing_logo.svg/512px-Zing_logo.svg.png' },
    { p: /mtv\s*beats/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/MTV_logo_2021.svg/512px-MTV_logo_2021.svg.png' },
    { p: /mtv\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/MTV_logo_2021.svg/512px-MTV_logo_2021.svg.png' },
    { p: /zoom\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Zoom_TV_logo.png/512px-Zoom_TV_logo.png' },
    { p: /ishaara/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Ishara_TV_logo.png/512px-Ishara_TV_logo.png' },
    { p: /shemaroo/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Shemaroo_Entertainment_Logo.svg/512px-Shemaroo_Entertainment_Logo.svg.png' },
    { p: /cinemania/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Star_Movies_2023.svg/512px-Star_Movies_2023.svg.png' },
    { p: /bollywood/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Zee_Cinema_2017.svg/512px-Zee_Cinema_2017.svg.png' },
    { p: /hollywood/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Star_Movies_2023.svg/512px-Star_Movies_2023.svg.png' },
    { p: /miniplex/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tata_Play_2022_logo.svg/512px-Tata_Play_2022_logo.svg.png' },
    { p: /sadabahar/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/B4U_Movies_Logo.svg/512px-B4U_Movies_Logo.svg.png' },

    // Devotional / Spiritual Channels
    { p: /mandir|temple|chintpurni|hanuman|shri|sri\s*sankara|aastha|sanskar|sadhna|arihant|peace\s*tv|jothi|divya|bhakti|satsang|gurdwara|darbar\s*sahib/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Om_symbol.svg/512px-Om_symbol.svg.png' },

    // Motorsports & Racing
    { p: /sky\s*sports\s*f1/i, url: 'https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1306.png' },
    { p: /sky\s*sports\s*racing/i, url: 'https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1354.png' },
    { p: /dazn\s*f1/i, url: 'https://i.imgur.com/yFCr5XX.png' },
    { p: /super\s*sport\s*motorsport|supersport\s*motorsport/i, url: 'https://i.imgur.com/gCjaY0F.png' },
    { p: /motor\s*trend|motortrend/i, url: 'https://i.imgur.com/hKDccCL.png' },
    { p: /fox\s*racing|fox\s*sports\s*racing/i, url: 'https://i.imgur.com/U5al8V3.png' },
    { p: /f1\b|formula\s*1|formula\s*one/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png' },
    { p: /motogp|moto\s*gp/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/MotoGP_Logo.svg/512px-MotoGP_Logo.svg.png' },
    { p: /nascar/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/NASCAR_logo.svg/512px-NASCAR_logo.svg.png' },
    { p: /mavtv/i, url: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBD47000010L_20240327T014526_SSTL.png' },
    { p: /speed\s*news/i, url: 'https://jiotvimages.cdn.jio.com/dare_images/images/Speed_News.png' },

    // Regional Networks
    { p: /mh1/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/MH_One_logo.png/512px-MH_One_logo.png' },
    { p: /ptc\s*punjabi|ptc\s*news|ptc\s*simran|ptc\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/PTC_Punjabi_logo.png/512px-PTC_Punjabi_logo.png' },
    { p: /charda\s*punjab|chardikla/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Chardikla_Time_TV_logo.png/512px-Chardikla_Time_TV_logo.png' },
    { p: /tv9\s*telugu|tv9\s*kannada|tv9\s*marathi|tv9\s*gujarati|tv9\s*bangla|tv9\s*bharatvarsh|tv9\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/TV9_Logo.svg/512px-TV9_Logo.svg.png' },
    { p: /ntv\s*telugu|ntv\b/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/NTV_Telugu_logo.png/512px-NTV_Telugu_logo.png' },
    { p: /sakshi/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Sakshi_TV_logo.png/512px-Sakshi_TV_logo.png' },
    { p: /abn\s*andhra/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/ABN_Andhra_Jyothi_logo.png/512px-ABN_Andhra_Jyothi_logo.png' },
    { p: /polimer/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Polimer_TV_logo.png/512px-Polimer_TV_logo.png' },
    { p: /thanthi/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Thanthi_TV_logo.png/512px-Thanthi_TV_logo.png' },
    { p: /puthiyathalaimurai/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Puthiya_Thalaimurai_TV_logo.png/512px-Puthiya_Thalaimurai_TV_logo.png' },
    { p: /kalaignar/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Kalaignar_TV_logo.png/512px-Kalaignar_TV_logo.png' },
    { p: /jaya\s*tv|jaya\s*plus|jaya\s*max/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Jaya_TV_logo.png/512px-Jaya_TV_logo.png' },
    { p: /raj\s*tv|raj\s*digital|raj\s*news/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Raj_TV_logo.png/512px-Raj_TV_logo.png' },
    { p: /suvarna\s*news/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Asianet_Suvarna_News_logo.png/512px-Asianet_Suvarna_News_logo.png' },
    { p: /public\s*tv/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Public_TV_logo.png/512px-Public_TV_logo.png' },
    { p: /otv|odisha\s*tv/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Odisha_TV_logo.png/512px-Odisha_TV_logo.png' },
    { p: /kanak\s*news/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Kanak_News_logo.png/512px-Kanak_News_logo.png' },
    { p: /prag\s*news/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Prag_News_logo.png/512px-Prag_News_logo.png' },
    { p: /news\s*live\s*assam/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/News_Live_logo.png/512px-News_Live_logo.png' },
    { p: /dy365/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/DY365_logo.png/512px-DY365_logo.png' },
    { p: /sandesh\s*news/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Sandesh_News_logo.png/512px-Sandesh_News_logo.png' },
    { p: /vtv\s*gujarati/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/VTV_Gujarati_logo.png/512px-VTV_Gujarati_logo.png' },
    { p: /abp\s*asmita/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png' },
    { p: /abp\s*ananda/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png' },
    { p: /abp\s*majha/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png' },
    { p: /abp\s*ganga/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png' },
    { p: /abp\s*sanjha/i, url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/ABP_News_2020.svg/512px-ABP_News_2020.svg.png' }
];

// Clean text for normalization
function normalize(str) {
    return (str || '').toLowerCase()
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/^[A-Z]{2,3}\s*:\s*/i, '')
        .replace(/^[\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\s•☆|💎⭐️]+/, '')
        .replace(/\b(?:4k|uhd|fhd|hd|sd|1080p|720p|hevc|h264|h265|ca|usa|uk|us|in|india|canada|vip|backup|east|west|latino|multiaudio|cc|24\/7|24x7|live|tv|channel)\b/gi, '')
        .replace(/[^a-z0-9]/g, '');
}

// Generate an ultra high quality modern SVG glass broadcast badge for any residual channel
function generateBroadcastBadge(title, genre) {
    const cleanTitle = (title || 'Live TV').replace(/[💎⭐️]/g, '').trim();
    const shortTitle = cleanTitle.length > 20 ? cleanTitle.substring(0, 18) + '...' : cleanTitle;
    const tag = (genre || 'LIVE').toUpperCase().replace(/[^A-Z0-9 ]/g, '').substring(0, 10);
    
    // Pick vibrant gradient based on title hash
    let hash = 0;
    for (let i = 0; i < cleanTitle.length; i++) hash = (hash << 5) - hash + cleanTitle.charCodeAt(i);
    const hues = [
        ['#ef4444', '#b91c1c'], // red
        ['#3b82f6', '#1d4ed8'], // blue
        ['#10b981', '#047857'], // emerald
        ['#8b5cf6', '#6d28d9'], // violet
        ['#f59e0b', '#d97706'], // amber
        ['#ec4899', '#be185d'], // pink
        ['#06b6d4', '#0e7490'], // cyan
        ['#6366f1', '#4338ca']  // indigo
    ];
    const pair = hues[Math.abs(hash) % hues.length];

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

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function isBadLogo(l) {
    if (!l || typeof l !== 'string') return true;
    const s = l.toLowerCase();
    return s.length < 10 || 
           s.includes('alphacoders') || 
           s.includes('865013') || 
           s.includes('generic.png') || 
           s.includes('placeholder') || 
           s.includes('/portal/picon') || 
           s.includes('portal.png') || 
           s.includes('ui-avatars.com');
}

function resolveChannelLogo(name, currentLogo, genre) {
    if (!isBadLogo(currentLogo)) {
        return currentLogo;
    }

    // 1. Check direct curated shows & networks
    for (const item of showLogos) {
        if (item.p.test(name)) return item.url;
    }

    // 2. Check iptv_logo_map exact or fuzzy slug
    const norm = normalize(name);
    if (norm && logoMap.names && logoMap.names[norm]) {
        return logoMap.names[norm];
    }
    
    // Check partial slug match in logoMap
    if (norm.length >= 4 && logoMap.names) {
        const keys = Object.keys(logoMap.names);
        const matchKey = keys.find(k => k === norm || (k.length > 4 && norm.includes(k)));
        if (matchKey) {
            return logoMap.names[matchKey];
        }
    }

    // 3. High quality SVG broadcast badge fallback
    return generateBroadcastBadge(name, genre);
}

// Process assets/channels.json
if (fs.existsSync(channelsPath)) {
    const raw = fs.readFileSync(channelsPath, 'utf8');
    const channels = JSON.parse(raw);
    let updatedCount = 0;

    for (const ch of channels) {
        const name = ch.name || ch.Name || '';
        const curLogo = ch.logo || ch.Logo || '';
        const genre = ch.genre || ch.genre_title || ch.group || '';

        const newLogo = resolveChannelLogo(name, curLogo, genre);
        if (newLogo !== curLogo) {
            ch.logo = newLogo;
            updatedCount++;
        }
    }

    fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 4), 'utf8');
    console.log(`Updated ${updatedCount} / ${channels.length} channels in assets/channels.json`);
}

// Process public M3U files
function updateM3uFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    let updated = 0;
    const out = [];

    for (let line of lines) {
        if (line.startsWith('#EXTINF:')) {
            const commaIdx = line.lastIndexOf(',');
            const name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : '';
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/tvg-logo=([^ ]+)/i);
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            const genre = groupMatch ? groupMatch[1] : '';
            const curLogo = logoMatch ? logoMatch[1] : '';

            if (isBadLogo(curLogo)) {
                const newLogo = resolveChannelLogo(name, curLogo, genre);
                if (logoMatch) {
                    line = line.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${newLogo}"`);
                }
                updated++;
            }
        }
        out.push(line);
    }
    fs.writeFileSync(filePath, out.join('\n'), 'utf8');
    console.log(`Updated ${updated} entries in ${path.basename(filePath)}`);
}

updateM3uFile(path.join(process.cwd(), 'public', 'kliv_jozo.txt'));
updateM3uFile(path.join(process.cwd(), 'public', 'kliv_jozo.m3u'));
updateM3uFile(path.join(process.cwd(), 'public', 'kliv_zob.m3u'));
