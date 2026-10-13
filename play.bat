@echo off
chcp 65001 >nul
rem 어두운 역: 게임 서버를 켜고 앱 창으로 연다. (서버가 이미 켜져 있으면 그대로 사용)
cd /d "%~dp0"
start "dark-station-server" /min python -m http.server 8512 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" chrome --app=http://localhost:8512/ || start "" msedge --app=http://localhost:8512/
