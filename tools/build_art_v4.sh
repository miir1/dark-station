#!/bin/sh
# 어두운 역 v4 그림 다시 뽑기 (2026-10-24 회의 P0-A1~A4). 결과는 v4/img 로만 낸다.
# ※ tools/build_art.sh 는 실행하지 않는다 (6행에서 v3/img 를 통째로 지운다. v3 는 읽기만).
# ※ 이 스크립트는 아무 폴더도 통째로 지우지 않는다. 같은 이름 파일만 덮어쓴다. Codex 를 부르지 않는다(시트가 이미 있을 때 자르기만).
# 쓰기: sh tools/build_art_v4.sh   (C:\dev\dark_station 에서. 어디서 불러도 저장소 뿌리로 옮겨 간다)
cd "$(dirname "$0")/.." || exit 1
export PYTHONIOENCODING=utf-8
set -e
python tools/walk_recut.py                 # P0-A1 걷기 9장 → v4/img/walk (art_src/walk 원본, 덩어리 단위)
python tools/tiny_props.py                 # P0-A2 작은 물건 손찍기·drum_open·반응 아이콘 7×5 (10-24 검증 뒤: 아침 흔적 상태 차 키움)
python tools/place_props.py                # 검증 U1-3·U4-4: 공중전화 부스·약국 셔터·저수조 손찍기 (Codex ③ 오기 전 대체, Codex 0)
python tools/people_poses.py               # P1-2: 사람마다 앉기 4방향(v4/img/sit)·잠(v4/img/sleep) — 자기 윗몸 + 공용 다리, Codex 0
python tools/portrait_cg_v4.py             # P0-A4 초상 80·다친 초상 80·작은 장면 그림 256×144·꿈 그림 48색
python tools/seat_tiles.py                 # P0-A3 전동차 좌석 타일 2종 (기존 seat 이어 붙이기, Codex 0)
python tools/containers.py                 # P0-A3 Codex 시트 ①②(art_src/sheets/containers.png·found_icons.png) 자르기
python v4/tools/manifest.py                # 그림 목록 갱신 (art.js 는 이 목록에 있는 것만 읽는다)
set +e
python tools/check_walk.py; w=$?
python tools/check_scale.py; s=$?
python tools/art_boards.py >/dev/null
python tools/trace_contrast.py             # 아침 흔적 상태가 빛 아래에서 몇 픽셀 갈리는지 (검증 U1-2 재측정)
echo "check_walk exit $w, check_scale exit $s"
[ $w -eq 0 ] && [ $s -eq 0 ]
