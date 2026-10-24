"""전동차 좌석 타일 2종을 기존 좌석 그림을 이어 붙여 만든다 (2026-10-24 회의 P0-A3 '좌석은 먼저 기존 seat 둘을 이어 붙여 본다'). Codex 0회.

  python tools/seat_tiles.py   → v4/img/tiles/seatTop_0.png (위 벽에 붙은 줄, 등받이가 위)
                                  v4/img/tiles/seatBottom_0.png (아래 벽에 붙은 줄, 등받이 뒷면이 아래)
                                  docs/.../after_shots/art_seat_row.png (6칸 이어 붙인 확인판)

- 원본: v3/img/props/seat.png (읽기만, 32×32 초록 3인 좌석). 가운데 쿠션 한 칸(칸막이 + 쿠션 8px)을 잘라
  11·10·11px 세 칸으로 늘려(쿠션 안쪽 세로줄을 하나 더 찍음) 32px 를 채운다 → 왼쪽 끝과 오른쪽 끝이 같은 칸막이라 옆 타일과 이어진다.
  팔걸이·다리는 빼고, 좌석 밑은 어둡게(가방이 밀려 들어가는 자리).
- 바닥: v3/img/tiles/carFloor_0 (읽기만). 타일은 막힘 칸이라 32×32 를 꽉 채운다.
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
V3 = os.path.join(ROOT, 'v3', 'img')
OUT = os.path.join(ROOT, 'v4', 'img', 'tiles')
SHOTS = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots')


def strip():
    """좌석 몸통(10~27줄)을 이어지는 32px 띠로."""
    s = np.array(Image.open(os.path.join(V3, 'props', 'seat.png')).convert('RGBA'))[10:28]
    div = s[:, 11:12]                     # 칸막이 세로줄
    cush = s[:, 12:20]                    # 쿠션 8px

    def widen(c, w):
        cols = list(range(c.shape[1]))
        while len(cols) < w:
            mid = len(cols) // 2
            cols.insert(mid, cols[mid])
        return c[:, cols]
    parts = []
    for w in (11, 10, 11):
        parts += [div, widen(cush, w - 1)]
    band = np.concatenate(parts, axis=1)
    assert band.shape[1] == 32
    # 맨 윗줄(10줄)의 외곽선 빈틈 메우기: 칸막이 자리 위쪽은 원본에서 투명이었다
    top = band[0]
    top[top[:, 3] == 0] = [10, 8, 7, 255]
    return band


def floor():
    return np.array(Image.open(os.path.join(V3, 'tiles', 'carFloor_0.png')).convert('RGBA'))


def over(dst, src, y):
    a = src[:, :, 3:4] / 255.0
    h = src.shape[0]
    dst[y:y + h, :, :3] = (src[:, :, :3] * a + dst[y:y + h, :, :3] * (1 - a)).astype(np.uint8)


def shade(dst, y0, y1, k):
    dst[y0:y1, :, :3] = (dst[y0:y1, :, :3] * k).astype(np.uint8)


def seat_top():
    t = floor().copy()
    shade(t, 0, 4, 0.55)                   # 벽 밑 그늘
    b = strip()
    over(t, b, 3)                           # 등받이 위 끝 y=3, 쿠션 앞 끝 y=20
    shade(t, 21, 28, 0.28)                 # 좌석 밑 어둠
    shade(t, 28, 30, 0.6)
    return t


def seat_bottom():
    t = floor().copy()
    b = strip()[::-1].copy()                # 위아래 뒤집기: 쿠션 면이 위(통로 쪽), 등받이가 아래(벽 쪽)
    back = b[9:].copy()                     # 뒤집힌 뒤 아래 9줄 = 등받이 → 뒷면이라 어둡게
    back[:, :, :3] = (back[:, :, :3] * 0.62).astype(np.uint8)
    b[9:] = back
    shade(t, 0, 6, 0.5)                    # 앞쪽(통로 쪽) 그늘: 쿠션 밑이 보이는 자리
    over(t, b, 12)                          # 아래 벽에 붙는다 (12~29줄)
    shade(t, 30, 32, 0.5)
    return t


def main():
    os.makedirs(OUT, exist_ok=True)
    a, b = seat_top(), seat_bottom()
    Image.fromarray(a).save(os.path.join(OUT, 'seatTop_0.png'))
    Image.fromarray(b).save(os.path.join(OUT, 'seatBottom_0.png'))
    # 확인판: 6칸씩 이어 붙인 두 줄 + 통로 바닥, 4배
    fl = floor()
    rows = [np.concatenate([a] * 6, 1), np.concatenate([fl] * 6, 1), np.concatenate([b] * 6, 1)]
    board = Image.fromarray(np.concatenate(rows, 0))
    os.makedirs(SHOTS, exist_ok=True)
    board.resize((board.width * 4, board.height * 4), Image.NEAREST).save(os.path.join(SHOTS, 'art_seat_row.png'))
    print('좌석 타일 2장 → v4/img/tiles, 확인판 after_shots/art_seat_row.png')


if __name__ == '__main__':
    main()
