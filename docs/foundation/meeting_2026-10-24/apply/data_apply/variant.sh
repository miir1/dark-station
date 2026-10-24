#!/bin/sh
# 손잡이 변형을 복사본(var/v4)에서만 잰다: sh variant.sh '<손잡이 JSON>' <이름> [판수] [정책들]
D=/c/dev/dark_station/docs/foundation/meeting_2026-10-24/apply/data_apply
node $D/apply_data.js $D/before_data $D/var/v4/data "$1" > /dev/null || exit 1
node $D/var/v4/sim/run.js ${3:-100} ${4:-balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,lazy} > $D/var_$2.md 2>&1
grep -E '^\| (A1 이기심의 값|A1 이른|A4 게으름의 값 — 생존|당신 사망|A2)' $D/var_$2.md | cut -c1-330
grep -E '^\| (balanced|selfish|selfish_nb|selfish_rt|selfish_rt0|lazy|diligent) \|' $D/var_$2.md | head -7 | cut -c1-40
