const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Master Multi-Engine Live Sources Configuration
// Each network/event features a Primary best source + redundant Fallback sources
const SOURCE_CONFIG = {
  jio: {
    name: 'JioTV Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/sportlive18/sportlink-update/main/zio.m3u',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/main/jio_tv.m3u',
        'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/main/jio_hotstar.m3u',
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/jtv.m3u',
        'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/Combined.m3u'
      ]
    },
    json: {
      primary: 'https://jjtvxweb.pages.dev/jstr4web.json',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/jtv.json'
      ]
    }
  },

  sony: {
    name: 'SonyLIV Sports Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.m3u',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/SonyLiv_Event_Playlist/main/sonyLiv.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/SonyLiv_Event_Playlist/main/sonyLiv_data.json'
      ]
    }
  },

  fancode: {
    name: 'FanCode Sports Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u',
      backups: [
        'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.m3u',
        'https://raw.githubusercontent.com/sm-monirulislam/Fancode_Auto_Update_Playlist/main/fancode_bd.m3u',
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/fancode.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json',
      backups: [
        'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json',
        'https://allinonereborn2.online/fctest/json/fancode_latest.json',
        'https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/refs/heads/main/fancode.json'
      ]
    }
  },

  icc: {
    name: 'ICC Cricket Tournaments',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/doctor-8trange/nexphi0/refs/heads/main/data/icc.m3u',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/willow.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/doctor-8trange/nexphi0/refs/heads/main/data/icc.json',
      backups: [
        'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.json',
        'https://raw.githubusercontent.com/drmlive/willow-live-events/main/willow.json'
      ]
    }
  },

  fifa: {
    name: 'FIFA & Football Events',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/srhady/fifaplus/refs/heads/main/fifa_live.m3u',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/srhady/fifaplus/refs/heads/main/match_data.json',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json'
      ]
    }
  },

  willow: {
    name: 'Willow Cricket Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/willow.m3u',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/willow.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.json',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/willow.json',
        'https://raw.githubusercontent.com/drmlive/willow-live-events/main/willow.json'
      ]
    }
  },

  zee5: {
    name: 'Zee & Zee5 Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/doctor-8trange/quarnex/refs/heads/main/data/zee5.m3u',
      backups: [
        'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/main/Zee5.m3u',
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/zee.m3u',
        'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/zee2.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/doctor-8trange/quarnex/refs/heads/main/data/zee5.json',
      backups: [
        'https://allinonereborn2.online/zee5/channels199.json'
      ]
    }
  },

  prime: {
    name: 'Prime Video Sports Network',
    type: 'both',
    m3u: {
      primary: 'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/primesport.m3u',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/primesport.m3u'
      ]
    },
    json: {
      primary: 'https://raw.githubusercontent.com/sportlive18/Sportlink-wtf/main/primesport.json',
      backups: [
        'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/primesport.json'
      ]
    }
  }
};

async function fetchUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        timeout: 10000
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300 && data.trim().length > 10) {
            resolve({ ok: true, statusCode: res.statusCode, data, url });
          } else {
            resolve({ ok: false, statusCode: res.statusCode, url });
          }
        });
      });
      req.on('error', err => resolve({ ok: false, error: err.message, url }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout', url }); });
    } catch (e) {
      resolve({ ok: false, error: e.message, url });
    }
  });
}

async function resolveSource(sourceType, config) {
  console.log(`\n--- Fetching ${config.name} (${sourceType.toUpperCase()}) ---`);
  const cand = config[sourceType];
  if (!cand) return null;

  // Try Primary first
  console.log(`[PRIMARY] Checking: ${cand.primary}`);
  const primRes = await fetchUrl(cand.primary);
  if (primRes.ok) {
    console.log(` -> Primary SUCCESS (${primRes.data.length} bytes)`);
    return { data: primRes.data, url: cand.primary, role: 'primary' };
  }
  console.log(` -> Primary failed (${primRes.statusCode || primRes.error}), attempting backups...`);

  // Fallback to Backups sequentially
  for (let i = 0; i < cand.backups.length; i++) {
    const backupUrl = cand.backups[i];
    console.log(`[BACKUP ${i + 1}] Checking: ${backupUrl}`);
    const bRes = await fetchUrl(backupUrl);
    if (bRes.ok) {
      console.log(` -> Backup ${i + 1} SUCCESS (${bRes.data.length} bytes)`);
      return { data: bRes.data, url: backupUrl, role: `backup-${i + 1}` };
    }
  }

  console.log(` -> ALL sources failed for ${config.name} (${sourceType})`);
  return null;
}

async function syncTarget(targetKey) {
  const cfg = SOURCE_CONFIG[targetKey];
  if (!cfg) {
    console.error(`Unknown target: ${targetKey}`);
    return;
  }

  const outDir = path.join(__dirname, '..', 'data', targetKey);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Sync M3U
  if (cfg.m3u) {
    const m3uRes = await resolveSource('m3u', cfg);
    if (m3uRes) {
      const outPath = path.join(outDir, `${targetKey}.m3u`);
      fs.writeFileSync(outPath, m3uRes.data);
      console.log(`Saved: ${outPath} [Source: ${m3uRes.role}]`);
    }
  }

  // 2. Sync JSON
  if (cfg.json) {
    const jsonRes = await resolveSource('json', cfg);
    if (jsonRes) {
      const outPath = path.join(outDir, `${targetKey}.json`);
      fs.writeFileSync(outPath, jsonRes.data);
      console.log(`Saved: ${outPath} [Source: ${jsonRes.role}]`);
    }
  }
}

async function run() {
  const targetArg = process.argv[2]; // e.g. "icc", "fifa", or "all"
  if (targetArg && targetArg !== 'all') {
    await syncTarget(targetArg);
  } else {
    for (const key of Object.keys(SOURCE_CONFIG)) {
      await syncTarget(key);
    }
  }
  console.log('\n[SYNC COMPLETE] All configured live sources verified and written to /data');
}

run();
