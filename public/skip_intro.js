(function() {
  let skipData = null;
  let skipButton = null;
  let skipChecked = false;
  
  const style = document.createElement('style');
  style.innerHTML = `
    .skip-intro-btn {
      position: absolute;
      bottom: 80px;
      right: 30px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      z-index: 100;
      display: none;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .skip-intro-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.8);
      transform: scale(1.05);
    }
    .plyr--hide-controls .skip-intro-btn {
      opacity: 0;
      pointer-events: none;
    }
    .skip-intro-btn svg {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      margin-right: 6px;
      display: inline-block;
    }
  `;
  document.head.appendChild(style);

  async function fetchSkipTimes(overrideMalId) {
    if (skipChecked && !overrideMalId) return;
    
    const ep = (typeof activeMediaData !== 'undefined' && (activeMediaData.episode || activeMediaData.ep)) || 
               window.MEDIA_EPISODE || 
               parseInt(new URLSearchParams(window.location.search).get('e') || new URLSearchParams(window.location.search).get('episode') || '1', 10) || 1;

    let malId = overrideMalId || 
                (typeof activeMediaData !== 'undefined' && (activeMediaData.malId || activeMediaData.mal_id)) || 
                window.MAL_ID || 
                new URLSearchParams(window.location.search).get('malId') || 
                new URLSearchParams(window.location.search).get('mal_id') || 
                new URLSearchParams(window.location.search).get('mal');

    let title = (typeof activeMediaData !== 'undefined' && (activeMediaData.title || activeMediaData.name)) || 
                window.MEDIA_TITLE || 
                new URLSearchParams(window.location.search).get('title') || 
                new URLSearchParams(window.location.search).get('name') || '';

    const cleanTitle = title.replace(/\(.*\)/g, '').replace(/\s*-\s*Episode\s*\d+/i, '').replace(/\s*Season\s*\d+/i, '').trim();

    skipChecked = true;
    console.log("[AniSkip] Checking skip times for MAL ID:", malId, "Title:", cleanTitle, "EP:", ep);

    // 1. Direct AniSkip Query via MAL ID (Fastest & Most Reliable)
    if (malId) {
      try {
        // Query through our internal proxy or directly to AniSkip (strictly pure intro and outro)
        let aniskipRes = await fetch(`/api/anime/skip-times?malId=${encodeURIComponent(malId)}&episode=${ep}&episodeLength=0&types=op,ed`);
        if (!aniskipRes.ok) {
          // Direct fallback to AniSkip official v2 API
          aniskipRes = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types=op&types=ed&episodeLength=0`);
        }
        if (aniskipRes.ok) {
          const aniskipData = await aniskipRes.json();
          if (aniskipData.found && aniskipData.results && aniskipData.results.length > 0) {
            // Strictly exclude mixed-op and mixed-ed
            skipData = aniskipData.results.filter(r => r.skipType === 'op' || r.skipType === 'ed');
            console.log("[AniSkip] Direct MAL ID skip data found:", skipData);
            return;
          }
        }
      } catch (e) {
        console.warn("[AniSkip] Direct MAL fetch failed:", e);
      }
    }

    // 2. Server-side title resolver (AniList GraphQL -> idMal)
    if (cleanTitle) {
      try {
        const resolveRes = await fetch(`/api/anime/skip-times?title=${encodeURIComponent(cleanTitle)}&episode=${ep}&episodeLength=0&types=op,ed`);
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.found && resolveData.results && resolveData.results.length > 0) {
            skipData = resolveData.results.filter(r => r.skipType === 'op' || r.skipType === 'ed');
            if (resolveData.malId) window.MAL_ID = resolveData.malId;
            console.log("[AniSkip] Title-resolved skip data found:", skipData);
            return;
          }
        }
      } catch (e) {
        console.warn("[AniSkip] Server resolver failed:", e);
      }
    }

    // 3. Fallback to Jikan API (if MAL ID wasn't provided directly)
    if (cleanTitle && !malId) {
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
        const jikanData = await jikanRes.json();
        
        if (jikanData && jikanData.data && jikanData.data.length > 0) {
          const fetchedMalId = jikanData.data[0].mal_id;
          if (fetchedMalId) {
            window.MAL_ID = fetchedMalId;
            const aniskipRes = await fetch(`https://api.aniskip.com/v2/skip-times/${fetchedMalId}/${ep}?types=op&types=ed&episodeLength=0`);
            if (aniskipRes.ok) {
              const aniskipData = await aniskipRes.json();
              if (aniskipData.found && aniskipData.results && aniskipData.results.length > 0) {
                skipData = aniskipData.results.filter(r => r.skipType === 'op' || r.skipType === 'ed');
                console.log("[AniSkip] Jikan-resolved skip data found:", skipData);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[AniSkip] Jikan fallback error:", e);
      }
    }

    // 4. Default heuristic fallback for episodic TV (Starts right from 00)
    skipData = [
      {
        skipType: "op",
        interval: {
          startTime: 0,
          endTime: 90
        }
      }
    ];
    console.log("[AniSkip] Using standard heuristic skip data:", skipData);
  }

  // Expose global controller functions
  window.setAnimeMalId = function(newMalId, newEpisode) {
    window.MAL_ID = newMalId;
    if (newEpisode) window.MEDIA_EPISODE = newEpisode;
    skipChecked = false;
    fetchSkipTimes(newMalId);
  };

  function setupSkipButton() {
    if (!window.plyrInstance) return;
    
    if (!skipButton) {
      const container = document.querySelector('.plyr');
      if (!container) return;
      
      skipButton = document.createElement('button');
      skipButton.className = 'skip-intro-btn';
      skipButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg> Skip Intro`;
      skipButton.onclick = () => {
        if (!skipData || skipData.length === 0) return;
        const current = window.plyrInstance.currentTime;
        const activeSkip = skipData.find(s => {
          const t = (s.skipType || '').toLowerCase().trim();
          if (t !== 'op' && t !== 'ed') return false;
          const start = Math.max(0, s.interval.startTime - 5);
          return current >= start && current <= s.interval.endTime;
        });
        if (activeSkip) {
          window.plyrInstance.currentTime = activeSkip.interval.endTime;
        } else if (skipData[0] && (skipData[0].skipType === 'op' || skipData[0].skipType === 'ed')) {
          window.plyrInstance.currentTime = skipData[0].interval.endTime;
        }
        skipButton.style.display = 'none';
      };
      container.appendChild(skipButton);
    }
  }

  function monitorPlayback() {
    if (!window.plyrInstance) {
      setTimeout(monitorPlayback, 1000);
      return;
    }
    
    setupSkipButton();
    
    setInterval(() => {
        if (!skipChecked) fetchSkipTimes();
    }, 2000);
    
    window.plyrInstance.on('timeupdate', () => {
      if (!skipData || !skipButton) return;
      const current = window.plyrInstance.currentTime;
      let shouldShow = false;
      let label = 'Skip Intro';
      
      for (const skip of skipData) {
        const t = (skip.skipType || '').toLowerCase().trim();
        if (t !== 'op' && t !== 'ed') continue;
        const start = Math.max(0, skip.interval.startTime);
        if (current >= start && current <= skip.interval.endTime) {
          shouldShow = true;
          if (t === 'ed') label = 'Skip Ending';
          else label = 'Skip Intro';
          break;
        }
      }
      
      if (shouldShow) {
          skipButton.style.display = 'block';
          skipButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg> ` + label;
      } else {
          skipButton.style.display = 'none';
      }
    });
  }
  
  setTimeout(monitorPlayback, 1500);
})();
