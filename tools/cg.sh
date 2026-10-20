#!/bin/sh
# art_src/cg/*.png → v3/img/cg/*.png (384×216) 후 목록 갱신
cd "$(dirname "$0")/.." && mkdir -p v3/img/cg
for f in art_src/cg/*.png; do n=$(basename "$f"); [ "v3/img/cg/$n" -nt "$f" ] && continue; python tools/chunky.py cg "$f" "v3/img/cg/$n" 384 216 >/dev/null && echo "cg $n"; done
python tools/manifest.py
