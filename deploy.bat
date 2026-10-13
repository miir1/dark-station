@echo off
chcp 65001 >nul
rem 커밋된 dark_station 폴더 내용만 GitHub Pages(miir1/dark-station)로 올린다.
rem 먼저 C:\dev 에서 변경사항을 커밋하고, sw.js의 CACHE 버전을 올린 뒤 실행할 것.
cd /d "%~dp0.."
git subtree split --prefix=dark_station -b dark-station-deploy
git push https://github.com/miir1/dark-station.git dark-station-deploy:main
echo.
echo 1~2분 뒤 https://miir1.github.io/dark-station/ 에 반영됩니다.
pause
