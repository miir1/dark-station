#!/bin/sh
# art_src/cg/*.png → v3/img/cg/*.png (480×270, 게임 팔레트) 후 목록 갱신
cd "$(dirname "$0")/.." && mkdir -p v3/img/cg
for f in art_src/cg/*.png; do n=$(basename "$f"); [ "v3/img/cg/$n" -nt "$f" ] && continue; python tools/pixelize.py "$f" "v3/img/cg/$n" 480 270 >/dev/null && echo "cg $n"; done
python tools/manifest.py
