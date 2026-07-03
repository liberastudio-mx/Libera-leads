@echo off
cd /d "%~dp0"
start "API Server" cmd /k "node dashboard-server.js"
timeout /t 2 >nul
start "React Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul
start "" "http://localhost:5174"
