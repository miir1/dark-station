"""새 걷기 그림(v4/img/walk) 검사 + 확대판 (2026-10-24 회의 P0-A1 끝 증거).

  python tools/check_walk.py      → 표준 출력 + docs/foundation/meeting_2026-10-24/after_shots/art_walk_x4.png (+ art_walk_check.txt)

검사 (v4/tools/audit_walk_src.py 의 '칸 선을 넘는가'를 새 시트 기준으로 다시 잰다):
  1. 잘림: 칸 맨 윗줄·맨 왼/오른 줄에 불투명 픽셀이 있으면 그 칸 그림이 칸 밖으로 넘친 것(=잘림). 그리고 walk_recut 기록의 lost_top 합. 0 이어야 한다.
  2. 방향마다 섬 칸 머리 꼭대기 차이 ≤1px.
  3. 발바닥 선: 모든 칸의 가장 아래 불투명 줄이 y=47.
  4. 섬 칸 키 = art_scale.json 키 표.
  5. 같은 줄 이웃 장 다른 픽셀 ≤300, 또는 상체 고정 합성 기록(art_src/walk_recut_log.json).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
WALK = os.path.join(ROOT, 'v4', 'img', 'walk')
SHOTS = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots')
DIRS = ['down', 'left', 'right', 'up']
CW, CH = 32, 48
K = 4


def main():
    heights = json.load(open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8'))['people']['height']
    log = json.load(open(os.path.join(ROOT, 'art_src', 'walk_recut_log.json'), encoding='utf-8'))
    ids = sorted(heights)
    lines, fails = [], 0
    sheet = Image.new('RGB', (len(ids) * (96 * K + 12) + 12, 192 * K + 44), (34, 32, 30))
    dd = ImageDraw.Draw(sheet)
    for i, pid in enumerate(ids):
        p = os.path.join(WALK, pid + '.png')
        if not os.path.exists(p):
            lines.append(f'{pid}: 그림 없음')
            fails += 1
            continue
        im = Image.open(p).convert('RGBA')
        a = np.array(im)[:, :, 3] > 0
        if im.size != (96, 192):
            lines.append(f'{pid}: 크기 {im.size} (96×192 이어야 함)')
            fails += 1
        clip, feet, tops = 0, set(), []
        for r in range(4):
            for c in range(3):
                cell = a[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW]
                clip += int(cell[0].sum() + cell[:, 0].sum() + cell[:, -1].sum())
                ys = np.where(cell.any(1))[0]
                feet.add(int(ys.max()))
                if c == 1:
                    tops.append(int(ys.min()))
        rec = log.get(pid, {})
        lost = sum(cc.get('lost_top', 0) for d in DIRS for cc in rec.get('rows', {}).get(d, {}).get('cells', []))
        tdiff = max(tops) - min(tops)
        stand_h = [CH - t for t in tops]
        rows = rec.get('rows', {})
        comp = [d for d in DIRS if rows.get(d, {}).get('composite')]
        dmax = max((max(rows[d]['diff_after'].values()) for d in DIRS), default=0) if rows else -1
        dbefore = max((max(rows[d]['diff_before'].values()) for d in DIRS), default=0) if rows else -1
        # 이웃 차이 300 초과 줄은 합성 시도 기록(장마다 이음매 통과/불통과)이 있어야 한다
        unrec = [d for d in DIRS if max(rows[d]['diff_after'].values()) > 300 and 'lock' not in rows[d]] if rows else DIRS
        seams = {d: ''.join(f"{k}{'+' if v['ok'] else '-'}{v['seam_dx']}" + (f"(조각{v['island_px']})" if v['island_px'] else '') for k, v in rows[d]['lock'].items())
                 for d in DIRS if 'lock' in rows.get(d, {})}
        ok = clip == 0 and lost == 0 and tdiff <= 1 and feet == {47} and all(h == heights[pid] for h in stand_h) and not unrec
        fails += 0 if ok else 1
        lines.append(f'{pid:8s} {"OK " if ok else "FAIL"} 잘림 {clip + lost}px | 섬 머리 꼭대기 {tops} (차이 {tdiff}) | 섬 키 {stand_h[0]} (표 {heights[pid]}) | '
                     f'발바닥 y {sorted(feet)} | 이웃 차이 {dbefore}→{dmax} | 합성 줄 {",".join(comp) or "-"} | 장별 합성(+적용/-원본 유지, 이음매 좌우차) {seams}')
        # 확대판: 회색 바탕, 칸 경계 초록(넘치면 빨강), 섬 칸 머리 꼭대기 노란 점
        bg = Image.new('RGBA', im.size, (88, 86, 82, 255))
        bg.alpha_composite(im)
        big = bg.resize((96 * K, 192 * K), Image.NEAREST).convert('RGB')
        ox = 12 + i * (96 * K + 12)
        sheet.paste(big, (ox, 36))
        for r in range(4):
            for c in range(3):
                x0, y0 = ox + c * CW * K, 36 + r * CH * K
                dd.rectangle([x0, y0, x0 + CW * K - 1, y0 + CH * K - 1], outline=(60, 140, 60))
            dd.line([(ox + CW * K, 36 + r * CH * K + tops[r] * K), (ox + 2 * CW * K - 1, 36 + r * CH * K + tops[r] * K)], fill=(230, 200, 60))
        dd.text((ox + 4, 8), f'{pid}  {heights[pid]}px  {"OK" if ok else "FAIL"}', fill=(240, 236, 220))
    os.makedirs(SHOTS, exist_ok=True)
    out = os.path.join(SHOTS, 'art_walk_x4.png')
    sheet.save(out)
    lines.append(f'합계: {len(ids)}명 중 실패 {fails}. 확대판 {out}')
    txt = '\n'.join(lines)
    with open(os.path.join(SHOTS, 'art_walk_check.txt'), 'w', encoding='utf-8') as f:
        f.write(txt + '\n')
    print(txt)
    return fails


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
