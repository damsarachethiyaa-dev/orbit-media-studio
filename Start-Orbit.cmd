@echo off
setlocal
cd /d "%~dp0"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
echo Starting Orbit. Open http://localhost:3000 when ready.
echo Keep this window open while using the app. Press Ctrl+C to stop.
set "ORBIT_ALLOWED_ORIGINS=https://orbit-media-studio.chethiya-730.chatgpt.site"
call npm run dev:full
pause
