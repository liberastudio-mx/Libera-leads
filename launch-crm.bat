@echo off
cd /d "%~dp0"
start "" node dashboard.js
timeout /t 1 /nobreak >nul
start "" http://localhost:3000
