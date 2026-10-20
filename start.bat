@echo off
title Stalker Pro OTT Player
cd /d "%~dp0"
echo ========================================================
echo   Starting Stalker Pro OTT Server on http://localhost:3000
echo ========================================================
node ./node_modules/tsx/dist/cli.mjs server.ts
pause
