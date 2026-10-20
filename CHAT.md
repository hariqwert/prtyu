# Session History: Stalker Pro Development

## Session Date: July 14, 2026

### 1. Issue: Stream Playback Failure (401 Errors)
- **User Request**: Reported that the player was not loading and showing errors.
- **Diagnostic**: Identified `401 Unauthorized` errors from the upstream IPTV provider in the backend logs.
- **Action**: 
    - Modified `src/xtream/xtreamProxy.ts` to use `IPTVSmartersPro` User-Agent.
    - Injected `Referer` and `Origin` headers matching the portal URL.
    - This fixed the strict header checks implemented by the provider.

### 2. Issue: "TAP TO PLAY" UI
- **User Request**: Requested the removal of the blue "TAP TO PLAY" button/overlay.
- **Action**:
    - Located the `play-nudge` element creation logic in `play.php`.
    - Removed the manual interaction requirement, allowing the player to attempt background autoplay and recovery more aggressively.

### 3. Issue: JavaScript Console Errors (null classList)
- **User Request**: Logs showed `Cannot read properties of null (reading 'classList')`.
- **Diagnostic**: Found that certain DOM elements like `loading-fallback` or `topControls` were being accessed before being rendered or after being destroyed.
- **Action**: Added defensive checks (`if (element && element.classList)`) throughout `play.php` to prevent script crashes during channel switching.

### 4. Playback Engine Tuning
- **Action**: 
    - Adjusted `mpegts.js` configuration in `play.php`.
    - Increased `stashInitialSize` to 512KB for better initial buffering.
    - Enabled `liveBufferLatencyChasing` with a max latency of 10s and min of 2s to prevent the stream from falling too far behind real-time.

### 5. Documentation & Architecture
- **User Request**: Provide a map of the project structure.
- **Action**: 
    - Created `ARCHITECTURE.md` detailing the relationship between `stalkerAPI.ts`, `xtreamProxy.ts`, and the frontend `play.php` templates.
    - Detailed the Binary Pass-through proxy logic and MIME correction.

---
*End of Summary*
