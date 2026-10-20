#!/bin/sh
# 배포 전에: sw.js 캐시 버전과 v3/index.html의 ?v= 를 함께 올린다 (폰이 옛 파일과 새 파일을 섞어 쓰지 않게)
cd "$(dirname "$0")/.." || exit 1
n=$(grep -o "dark-station-v[0-9]*" sw.js | grep -o "[0-9]*$"); n=$((n + 1))
sed -i "s/dark-station-v[0-9]*/dark-station-v$n/" sw.js
sed -i -E "s/(src|href)=\"([^\"?]+\.(js|css))(\?v=[0-9]+)?\"/\1=\"\2?v=$n\"/g" v3/index.html
echo "버전 $n"
