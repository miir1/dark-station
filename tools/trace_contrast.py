"""아침 흔적 상태가 화면에서 얼마나 갈리는가 (2026-10-24 검증 U1 항목 2 재현·재측정). 그림만으로 잰다.

  python tools/trace_contrast.py [옛 그림 폴더]   → 표 출력 + docs/foundation/meeting_2026-10-24/after_shots/art_trace_states.png

- 그 물건을 바닥 타일(v3 tiles/floor_0) 위 화면과 같은 자리(칸 아래 3px 위, 가운데)에 얹고, 빛 덮개를 흉내 내 밝기를 곱한다
  (밝음 1.0 · 보통 0.6 · 어두움 0.45 — 머리맡 묶음은 화로에서 떨어져 0.45~0.6 쯤이다).
- 기본 상태와 바뀐 상태를 견줘 밝기 차가 12 이상인 픽셀 수를 센다(검증 U1_trace_states.json 과 같은 문턱).
- 옛 그림 폴더를 주면 같은 방법으로 옛 그림도 재서 나란히 적는다.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
PROPS = os.path.join(ROOT, 'v4', 'img', 'props')
OUT = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots', 'art_trace_states.png')
PAIRS = [('bandage', 'bandage_wet'), ('bandage', 'bandage_rot'), ('bandage', 'bandage_blood'), ('bowl', 'bowl_empty'), ('bowl', 'bowl_meat'),
         ('bowl_empty', 'bowl_meat'), ('scissors', 'scissors_blood'), ('bottle', 'bottle_empty'), ('bottle', 'bottle_wet')]
LIGHTS = (1.0, 0.6, 0.45)


def cell(name, folder):
    p = os.path.join(folder, name + '.png')
    if not os.path.exists(p):
        return None
    floor = Image.open(os.path.join(ROOT, 'v3', 'img', 'tiles', 'floor_0.png')).convert('RGBA')
    im = Image.open(p).convert('RGBA')
    c = floor.copy()
    c.alpha_composite(im, ((32 - im.width) // 2, 32 - 3 - im.height))
    return np.array(c)[:, :, :3].astype(float)


def lum(a):
    return 0.3 * a[:, :, 0] + 0.59 * a[:, :, 1] + 0.11 * a[:, :, 2]


def count(a, b, k):
    return int((np.abs(lum(a) - lum(b)) * k >= 12).sum())


def measure(folder):
    r = {}
    for a, b in PAIRS:
        A, B = cell(a, folder), cell(b, folder)
        r[(a, b)] = None if A is None or B is None else [count(A, B, k) for k in LIGHTS]
    return r


def board(folders):
    names = ['bandage', 'bandage_wet', 'bandage_rot', 'bandage_blood', 'bowl', 'bowl_empty', 'bowl_meat', 'scissors', 'scissors_blood']
    Z = 4
    rows = []
    for f in folders:
        for k in (1.0, 0.5):
            row = Image.new('RGB', (len(names) * 34 * Z, 32 * Z), (0, 0, 0))
            for i, n in enumerate(names):
                c = cell(n, f)
                if c is None:
                    continue
                im = Image.fromarray(np.clip(c * k, 0, 255).astype(np.uint8))
                row.paste(im.resize((32 * Z, 32 * Z), Image.NEAREST), (i * 34 * Z, 0))
            rows.append(row)
    out = Image.new('RGB', (rows[0].width, sum(r.height + 6 for r in rows)), (40, 30, 30))
    y = 0
    for r in rows:
        out.paste(r, (0, y))
        y += r.height + 6
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT)


def main():
    old = sys.argv[1] if len(sys.argv) > 1 else None
    now = measure(PROPS)
    was = measure(old) if old else {}
    print('밝기 차 12 이상 픽셀 수 (빛 1.0 / 0.6 / 0.45)' + ('   ← 옛 그림' if old else ''))
    for k, v in now.items():
        w = was.get(k)
        print(f'  {k[0]:>11s} → {k[1]:<15s} {v}' + (f'   ← {w}' if w else ''))
    board([old, PROPS] if old else [PROPS])
    print('비교판 →', os.path.relpath(OUT, ROOT), '(위: 옛 그림 빛 1.0·0.5, 아래: 새 그림)' if old else '')


if __name__ == '__main__':
    main()
