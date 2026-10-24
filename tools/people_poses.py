"""사람마다 앉기·잠 그림 (2026-10-24 회의 plan.md P1-2). Codex 0회.

  python tools/people_poses.py      → v4/img/sit/<id>.png (32×128), v4/img/sleep/<id>.png (32×32)

왜: 저녁 화로 둘레 사람들이 공용 앉기 실루엣(poses/sit) 한 장을 옷 색으로만 물들인 '같은 뒤통수'였고,
    잠든 사람은 머리만 자기 것이고 몸은 납작한 사각 담요였다(verify/U1_evening_d3_zoom·U1_sleepers_x8).

앉기 sit/<id>.png — 32×32 칸 4줄, 줄 순서는 걷기 그림과 같다(아래·왼·오른·위 = art.js DIR_ROW).
  - 윗몸 = 그 사람 걷기 그림(v4/img/walk/<id>, 섬 칸)에서 머리 꼭대기부터 키의 52%(가랑이 선)까지 그대로.
    머리 꼭대기를 자르지 않는다(U5). 얼굴·옷·모자·헤드램프가 걷기 그림과 같은 사람이다.
  - 다리 = 공용 책상다리 틀(방향 4개)에 그 사람 자기 색을 칠한다: 허벅지 = 엉덩이 바로 아래 옷(외투·치마·바지),
    정강이 = 무릎 아래 색, 신발 = 발 색, 손 = 얼굴 살색. 색은 걷기 그림에서 뽑은 것만 쓴다(새 색 없음).
  - 앉은 키 ≈ 선 키의 52~56% (사람 46px → 앉아서 25px 안팎). 칸 바닥(31줄) = 엉덩이·발이 닿는 바닥.
  - 가로는 몸통 가운데를 칸 가운데(16)에 둔다(옆모습은 다리가 앞으로 나오므로 몸통+다리 상자 가운데).
잠 sleep/<id>.png — 32×32, 잠자리(v3 props/bed, 위쪽이 베개) 위에 겹쳐 그린다(art.js sleeper 와 같은 자리).
  - 머리 = 걷기 그림(아래 보기)의 머리를 베개 자리(위 0~11줄)에. 서하·은채처럼 머리가 긴 사람은 베개에 머리카락이 퍼진다.
  - 담요 = 몸 높이 지도(어깨·몸통·두 다리·발끝)를 그려 위왼쪽 빛으로 음영 → 어깨 둥근 턱, 두 다리 사이 골, 발끝 솟음, 가장자리 처짐.
  - 사람마다 담요 천이 다르고(회색 모포·국방색·갈색·남색·자주 체크) 표식 하나: 당신 = 검은 외투를 덮음, 기철 = 헤드램프 모자,
    순례 = 겨자색 조끼를 개어 올림, 서하 = 베개에 퍼진 긴 머리, 은지 = 붉은 재킷을 덮음, 동하 = 흰 줄 초록 체육복을 덮음,
    마리 = 간호모, 은채 = 흰 가운을 덮음, 도현 = 주황 모자 + 멜빵.
  - 숨(화면 sleepBreath)은 담요 가운데(10~22, 13~27)를 1px 올린다 — 몸 높이 지도의 몸통이 그 자리다.
"""
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
WALK = os.path.join(ROOT, 'v4', 'img', 'walk')
OUT_SIT = os.path.join(ROOT, 'v4', 'img', 'sit')
OUT_SLEEP = os.path.join(ROOT, 'v4', 'img', 'sleep')

IDS = ['player', 'gicheol', 'soonrye', 'seoha', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon']
DIRS = ['down', 'left', 'right', 'up']
CW, CH = 32, 48          # 걷기 칸
SW = 32                  # 앉기 칸 32×32
OUTLINE = (10, 8, 7, 255)


def hexc(v):
    return (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def frame(sheet, row, col=1):
    return sheet[row * CH:(row + 1) * CH, col * CW:(col + 1) * CW].copy()


def opaque_rows(a):
    ys = np.where((a[:, :, 3] > 40).any(1))[0]
    return int(ys.min()), int(ys.max())


def cols_at(a, y):
    xs = np.where(a[y, :, 3] > 40)[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else (None, None)


def ramp_of(px, n=3):
    """픽셀 목록 → 어둠·가운데·밝음(·깊음) 색. 외곽선(아주 어두운 것)은 뺀다. 그 사람 그림에 있는 색만 고른다."""
    px = [tuple(int(v) for v in p[:3]) for p in px if p[3] > 200 and lum(p) > 26]
    if not px:
        return [(60, 52, 46, 255), (90, 80, 70, 255), (120, 108, 96, 255), (40, 34, 30, 255)]
    px.sort(key=lum)
    pick = lambda q: px[min(len(px) - 1, int(q * (len(px) - 1)))] + (255,)
    dark, mid, light = pick(0.18), pick(0.5), pick(0.86)
    deep = tuple(int(v * 0.62) for v in dark[:3]) + (255,)
    return [dark, mid, light, deep]


def region(a, y0, y1, x0, x1):
    y0, y1 = max(0, y0), min(a.shape[0], y1)
    x0, x1 = max(0, x0), min(a.shape[1], x1)
    return [a[y, x] for y in range(y0, y1) for x in range(x0, x1)]


def skin_of(a, top, H):
    """얼굴 살색: 머리 줄(키의 10~24%)에서 붉은기가 있는 밝은 색."""
    px = region(a, top + int(H * 0.10), top + int(H * 0.24), 8, 24)
    sk = [p for p in px if p[3] > 200 and p[0] > 110 and p[0] > p[1] > p[2] - 10 and p[0] - p[2] > 25]
    if not sk:
        return [(150, 110, 90, 255), (190, 150, 120, 255)]
    sk.sort(key=lambda p: lum(p))
    return [tuple(int(v) for v in sk[len(sk) // 4][:3]) + (255,), tuple(int(v) for v in sk[(len(sk) * 3) // 4][:3]) + (255,)]


def colors(sheet):
    """그 사람 색표: 허벅지(엉덩이 아래 옷)·정강이·신발·살색. 아래 보기 섬 칸에서 뽑는다."""
    a = frame(sheet, 0)
    top, bot = opaque_rows(a)
    H = bot - top + 1
    cut = top + round(H * 0.52)
    c0, c1 = cols_at(a, cut)
    cx = (c0 + c1) // 2
    thigh = ramp_of(region(a, cut, cut + max(3, int(H * 0.16)), cx - 5, cx + 6))
    shin = ramp_of(region(a, top + int(H * 0.74), top + int(H * 0.9), cx - 5, cx + 6))
    shoe = ramp_of(region(a, bot - 2, bot + 1, 0, CW))
    return {'thigh': thigh, 'shin': shin, 'shoe': shoe, 'skin': skin_of(a, top, H), 'H': H}


class Canvas:
    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)
        self.base = np.zeros((h, w), bool)        # 다리(공용 틀)로 칠한 자리 — 외곽선을 여기에만 두른다

    def put(self, x, y, c, base=True):
        h, w = self.a.shape[:2]
        if 0 <= x < w and 0 <= y < h:
            self.a[y, x] = c
            self.base[y, x] = base

    def paste(self, src, ox, oy):
        h, w = self.a.shape[:2]
        for y in range(src.shape[0]):
            for x in range(src.shape[1]):
                if src[y, x, 3] > 40:
                    X, Y = x + ox, y + oy
                    if 0 <= X < w and 0 <= Y < h:
                        self.a[Y, X] = src[y, x]
                        self.base[Y, X] = False

    def outline_base(self):
        h, w = self.a.shape[:2]
        op = self.a[:, :, 3] > 40
        ring = []
        for y in range(h):
            for x in range(w):
                if not (op[y, x] and self.base[y, x]):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if not (0 <= X < w and 0 <= Y < h) or not op[Y, X]:
                        ring.append((x, y))
                        break
        for x, y in ring:
            self.a[y, x] = OUTLINE


# 공용 다리 틀 (무릎을 세우고 앉음). 글자 = 색 자리, 그 사람 색으로 칠한다.
#   o 외곽선 · K/k/d 허벅지(밝음·가운데·어둠, 무릎 머리) · S/s/z 정강이 · F/f 신발 · '.' 비움(몸통이 보임)
# 앞모습: 가슴 앞에 두 무릎, 정강이 둘이 바닥까지, 신발 코. 가운데 열 = 두 다리 사이 금. 맨 아래 줄 = 바닥.
LEGS_FRONT = [
    '.oooo.oooo.',
    'oKKKKoKKKKo',
    'okKKkokKKko',
    'odkkdodkkdo',
    'oSsszoSsszo',
    'oSsszoSsszo',
    'oSsszoSsszo',
    'oSsszoSsszo',
    'oSsszoSsszo',
    'oFFffoFFffo',
    'oFFffoFFffo',
    'ooooooooooo',
]
# 옆모습(오른쪽 보기, 왼쪽은 거울): 왼쪽 끝 열이 엉덩이 쪽(몸통에 이어짐), 무릎이 가슴 앞에서 가장 높고, 정강이가 바닥으로, 신발이 앞으로.
# 첫 열 x = 몸통 앞 가장자리 − 4
LEGS_SIDE = [
    '......ooo....',
    '.....oKKKo...',
    '....oKKkkdo..',
    '...oKkkkdSo..',
    '..oKkkkdoSzo.',
    '.oKkkkdo.Sszo',
    'oKkkkdo..Sszo',
    'kkkkdo...Sszo',
    'kkkdo....Sszo',
    'kkdo.....Sszo',
    'kdo......SFFFo',
    'oo.......ooooo',
]
# 뒷모습: 엉덩이가 바닥에 닿아 아래 두 줄이 몸통보다 조금 넓다(무릎은 몸 앞이라 안 보임). 가운데 열 기준, 몸통 반폭 + 2
LEGS_BACK_ROWS = 2


def _stamp(cv, rows, x0, y0, P, mirror=False):
    th, sh, so = P['thigh'], P['shin'], P['shoe']
    M = {'K': th[2], 'k': th[1], 'd': th[0], 'S': sh[2], 's': sh[1], 'z': sh[0], 'F': so[2], 'f': so[0], 'o': OUTLINE}
    w = max(len(r) for r in rows)
    for y, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in M:
                x = x0 + (w - 1 - i if mirror else i)
                cv.put(x, y0 + y, M[ch])


def sit_cell(sheet, row, P):
    a = frame(sheet, row)
    top, bot = opaque_rows(a)
    H = bot - top + 1
    cut = top + round(H * 0.52)
    upper = a[top:cut + 1].copy()
    U = upper.shape[0]
    floor = SW - 1
    cv = Canvas(48, SW)                      # 넓게 그린 뒤 가운데로 잘라 32 칸에
    ox = 8                                    # 걷기 칸 x → 넓은 캔버스 x
    uy = floor - U + 1                        # 앉으면 가랑이 선 = 바닥
    d = DIRS[row]
    chest = [cols_at(upper, y) for y in range(int(U * 0.55), int(U * 0.75))]
    c0 = min(c[0] for c in chest if c[0] is not None)
    c1 = max(c[1] for c in chest if c[1] is not None)
    cx = (c0 + c1) // 2 + ox
    hw = max(3, (c1 - c0) // 2)
    P = dict(P)
    P['sleeve'] = ramp_of([upper[y, x] for y in range(int(U * 0.45), int(U * 0.75)) for x in (c0, c0 + 1, c0 + 2, c1 - 2, c1 - 1, c1)])
    if d == 'up':
        th = P['thigh']
        for k in range(LEGS_BACK_ROWS):
            y = floor - k
            r = hw + 1 - k
            for x in range(cx - r, cx + r + 1):
                cv.put(x, y, OUTLINE if (k == 0 or abs(x - cx) == r) else th[0])
        cv.paste(upper, ox, uy)
        for x in range(cx - hw - 1, cx + hw + 2):     # 바닥 줄 외곽선
            if cv.a[floor, x, 3]:
                cv.a[floor, x] = OUTLINE
    elif d == 'down':
        w = len(LEGS_FRONT[0])
        ktop = floor - len(LEGS_FRONT) + 1
        # 무릎 아래로는 몸통이 다리 뒤에 숨는다: 다리 폭 바깥의 엉덩이·늘어진 팔을 지운다(팔은 아래에서 다시 그린다)
        for y in range(U):
            if uy + y >= ktop + 2:
                for x in range(upper.shape[1]):
                    if abs(x + ox - cx) > w // 2:
                        upper[y, x, 3] = 0
        cv.paste(upper, ox, uy)
        _stamp(cv, LEGS_FRONT, cx - w // 2, ktop, P)
        # 엉덩이: 바닥 두 줄이 다리보다 1px 넓다
        for s_ in (-1, 1):
            for y in (floor - 1, floor):
                cv.put(cx + s_ * (w // 2 + 1), y, OUTLINE)
            cv.put(cx + s_ * (w // 2), floor - 1, P['thigh'][3])
        # 팔: 어깨 옆에서 정강이 앞으로 감싼다(소매 2px + 외곽선), 손이 정강이 앞에서 만난다
        sl = P['sleeve']
        for s_ in (-1, 1):
            x0 = cx + s_ * (hw - 2)
            for i in range(7):
                y = ktop - 1 + i
                x = int(round(x0 + (cx + s_ * 3 - x0) * i / 6))
                cv.put(x, y, sl[1])
                cv.put(x - s_, y, sl[2] if i < 5 else sl[1])
                if i >= 2:
                    cv.put(x + s_, y, OUTLINE)
        for x in range(cx - 3, cx + 4):
            cv.put(x, ktop + 6, P['skin'][1] if abs(x - cx) <= 1 else P['skin'][0])
            cv.put(x, ktop + 7, OUTLINE if abs(x - cx) >= 3 else P['skin'][0])
        cv.put(cx - 4, ktop + 6, OUTLINE)
        cv.put(cx + 4, ktop + 6, OUTLINE)
    else:
        f = -1 if d == 'left' else 1
        cv.paste(upper, ox, uy)
        mid = [cols_at(upper, y) for y in range(max(0, U - 10), U - 2)]
        m0 = min(c[0] for c in mid if c[0] is not None) + ox
        m1 = max(c[1] for c in mid if c[1] is not None) + ox
        w = max(len(r) for r in LEGS_SIDE)
        y0 = floor - len(LEGS_SIDE) + 1
        if f > 0:
            _stamp(cv, LEGS_SIDE, m1 - 4, y0, P)
        else:
            _stamp(cv, LEGS_SIDE, m0 + 4 - (w - 1), y0, P, mirror=True)
    for x in range(cv.a.shape[1]):               # 바닥 줄은 늘 외곽선(바닥에 닿은 선)
        if cv.a[floor, x, 3] and not cv.base[floor, x]:
            pass
    # 가운데 맞추기: 앞·뒤 = 몸통 가운데, 옆 = 불투명 상자 가운데
    op = cv.a[:, :, 3] > 40
    xs = np.where(op.any(0))[0]
    centre = (xs.min() + xs.max()) / 2 if d in ('left', 'right') else cx
    sx = int(round(centre - SW / 2 + 0.5))
    sx = max(int(xs.max()) - SW + 1, min(int(xs.min()), sx))
    return cv.a[:, sx:sx + SW]


# ── 잠 ──
BLANKETS = {   # 천 4단: 깊음(주름·골) · 그늘 · 가운데 · 빛 받는 면. 어두운 역의 빛에 맞춰 밝음을 낮게 둔다
    'wool': ['#1c1613', '#352d28', '#4a3f38', '#5b5049'],
    'army': ['#1c1613', '#2e2e18', '#3a3a1e', '#4d4c25'],
    'brown': ['#1c1613', '#3a1a10', '#4a1f12', '#5e3420'],
    'navy': ['#0a0807', '#16242c', '#1b2d36', '#2a4250'],
    'wine': ['#14100e', '#3a1520', '#4d1a26', '#5f2130'],
    'grey': ['#1c1613', '#3f4245', '#55595b', '#6c7276'],
}
SLEEP = {   # 천 · 발치에 개어 둔 옷(걷기 그림 몸통 색) · 표식
    'player': ('wool', 'coat', None),
    'gicheol': ('army', None, 'lamp'),
    'soonrye': ('brown', 'vest', None),
    'seoha': ('navy', None, 'hair'),
    'eunji': ('grey', 'jacket', None),
    'dongha': ('wool', 'track', None),
    'mari': ('wine', None, 'cap'),
    'eunchae': ('navy', 'gown', 'hair'),
    'dohyeon': ('army', None, 'straps'),
}


def body_height(x, y):
    """누운 몸 높이 지도(0 = 깔개). 담요는 10줄부터, 어깨 11~13, 몸통 ~20, 다리 20~27(가운데 얕은 골), 발끝 26~28."""
    cx = 16.0
    h = 0.0
    if 10.0 <= y <= 21.0:                                   # 어깨·몸통
        t = (y - 10.0) / 11.0
        half = 8.0 - 1.6 * t
        if t < 0.15:
            half *= 0.8 + 1.3 * t
        u = (x - cx) / half
        if abs(u) < 1:
            h = max(h, 3.4 * math.sqrt(1 - u * u))
    if 19.0 <= y <= 28.5:                                   # 다리 한 덩어리 + 가운데 얕은 골
        half = 5.6 - 1.4 * (y - 19.0) / 9.5
        u = (x - cx) / half
        if abs(u) < 1:
            v = 2.4 * math.sqrt(1 - u * u)
            v -= 0.7 * max(0.0, 1 - abs(x - cx) / 1.2) * min(1.0, (y - 20.0) / 3.0) if y > 20 else 0
            if y > 26.0:                                    # 발끝 둘이 담요를 들어 올림
                for fx in (13.6, 18.4):
                    v = max(v, 2.9 * max(0.0, 1 - ((x - fx) / 1.8) ** 2 - ((y - 27.2) / 1.3) ** 2) + 1.0)
            h = max(h, v)
    return h


def blanket_mask(x, y):
    """담요 테두리: 위 10줄(턱 밑) ~ 아래 29줄, 양옆 4~27 (모서리가 처져 둥글다)."""
    if y < 10 or y > 29:
        return False
    if y in (10, 29):
        return 6 <= x <= 25
    if y in (11, 28):
        return 5 <= x <= 26
    return 4 <= x <= 27


def sleep_img(sheet, pid):
    kind, cover, mark = SLEEP[pid]
    pal = [hexc(c) for c in BLANKETS[kind]]
    a = frame(sheet, 0)
    top, bot = opaque_rows(a)
    H = bot - top + 1
    cv = np.zeros((32, 32, 4), np.uint8)

    def put(x, y, c):
        if 0 <= x < 32 and 0 <= y < 32:
            cv[y, x] = c
    head = a[top:top + 12, 8:24]
    if mark == 'hair':                      # 베개 위로 퍼진 긴 머리 (머리 둘레에 머리색)
        hp = [head[y, x] for y in range(0, 4) for x in range(16) if head[y, x, 3] > 200]
        hc = ramp_of(hp)
        for y in range(2, 11):
            for x in range(5, 27):
                d = ((x - 16) / 10.0) ** 2 + ((y - 6.5) / 5.0) ** 2
                if d < 1:
                    put(x, y, hc[0] if (x * 3 + y) % 4 else hc[1])
                elif d < 1.25:
                    put(x, y, OUTLINE)
    for y in range(head.shape[0]):
        for x in range(16):
            if head[y, x, 3] > 40:
                put(8 + x, y, head[y, x])
    # 담요
    hm = np.zeros((34, 34))
    for y in range(34):
        for x in range(34):
            hm[y, x] = body_height(x + 0.5, y + 0.5)
    for y in range(32):
        for x in range(32):
            if not blanket_mask(x, y):
                continue
            h = hm[y, x]
            gx = hm[y, x + 1] - hm[y, max(0, x - 1)]
            gy = hm[y + 1, x] - hm[max(0, y - 1), x]
            if h < 0.05:                                    # 깔개 위로 처진 천
                edge = min(x - 4, 27 - x, 29 - y)
                lvl = 1 if edge < 2 else 2
            else:
                sh = -0.55 * gx - 0.75 * gy + 0.12 * h      # 빛은 위왼쪽
                lvl = 3 if sh > 0.55 else 2 if sh > -0.25 else 1
            put(x, y, pal[lvl])
    # 주름: 몸 덩어리에서 가장자리로 흘러내리는 짧은 대각선, 다리 사이 골
    for (x0, y0, dx, n) in ((5, 14, 1, 3), (26, 15, -1, 3), (6, 22, 1, 3), (25, 21, -1, 3), (9, 26, 1, 2), (23, 26, -1, 2)):
        for i in range(n):
            put(x0 + dx * i, y0 + i, pal[0] if i else pal[1])
    for y in range(22, 27):
        put(16, y, pal[1])
    # 턱 밑 접어 올린 윗단
    for x in range(6, 26):
        put(x, 10, pal[3])
        put(x, 11, pal[1])
    # 외곽선 (위 테두리 = 접은 단이라 양끝만)
    for y in range(32):
        for x in range(32):
            if blanket_mask(x, y) and any(not blanket_mask(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                if y == 10 and 8 <= x <= 23:
                    continue
                put(x, y, OUTLINE)
    # 발치에 개어 둔 옷 (사람마다 다른 표식): 걷기 그림 몸통 색으로 22×4 띠 + 깃·줄·단추
    if cover:
        tr = ramp_of(region(a, top + int(H * 0.3), top + int(H * 0.5), 8, 24))
        if cover in ('coat',):
            tr = ramp_of([p for p in region(a, top + int(H * 0.3), top + int(H * 0.6), 6, 26) if lum(p) < 90])
        y0, y1 = 24, 27
        for y in range(y0, y1 + 1):
            for x in range(7, 25):
                c = tr[2] if y == y0 else tr[0] if y == y1 else tr[1]
                put(x, y, c)
        for x in range(7, 25):
            put(x, y0 - 1, OUTLINE)
            put(x, y1 + 1, OUTLINE)
        for y in range(y0, y1 + 1):
            put(6, y, OUTLINE)
            put(25, y, OUTLINE)
        for y in range(y0, y1 + 1):                 # 접힌 금
            put(15, y, tr[3])
        if cover == 'coat':
            put(11, 25, hexc('#9a7428'))
            put(20, 25, hexc('#9a7428'))
        if cover == 'track':
            for x in range(7, 25):
                put(x, 25, hexc('#e5e1d6'))
        if cover == 'vest':
            put(10, 25, hexc('#5e4516'))
            put(13, 25, hexc('#5e4516'))
        if cover == 'jacket':
            for y in range(y0, y1 + 1):
                put(22, y, tr[3])
        if cover == 'gown':
            for x in range(8, 24, 3):
                put(x, 26, tr[0])
    if mark == 'lamp':                      # 모자 앞 헤드램프
        put(15, 2, hexc('#d0a24a'))
        put(16, 2, hexc('#9a7428'))
    if mark == 'straps':                    # 멜빵 두 줄이 담요 윗단 위로
        for y in range(10, 14):
            put(12, y, hexc('#2e434c'))
            put(20, y, hexc('#2e434c'))
    sk = skin_of(a, top, H)                 # 담요 위로 나온 손 하나
    put(21, 14, sk[1])
    put(22, 14, sk[0])
    put(21, 15, OUTLINE)
    put(22, 15, OUTLINE)
    return cv


def main():
    os.makedirs(OUT_SIT, exist_ok=True)
    os.makedirs(OUT_SLEEP, exist_ok=True)
    rep = []
    for pid in IDS:
        sheet = np.array(Image.open(os.path.join(WALK, pid + '.png')).convert('RGBA'))
        P = colors(sheet)
        cells = [sit_cell(sheet, r, P) for r in range(4)]
        sit = np.concatenate(cells, 0)
        Image.fromarray(sit).save(os.path.join(OUT_SIT, pid + '.png'))
        hs = []
        for c in cells:
            t, b = opaque_rows(c)
            hs.append(b - t + 1)
        sl = sleep_img(sheet, pid)
        Image.fromarray(sl).save(os.path.join(OUT_SLEEP, pid + '.png'))
        rep.append(f'{pid:8s} 선 키 {P["H"]:2d}px → 앉은 키(아래·왼·오른·위) {hs} = {min(hs) / P["H"]:.0%}~{max(hs) / P["H"]:.0%}, 잠 32×32 ({SLEEP[pid][0]}, {SLEEP[pid][1] or SLEEP[pid][2]})')
    print('\n'.join(rep))
    print(f'앉기 {len(IDS)}장(32×128) → v4/img/sit, 잠 {len(IDS)}장(32×32) → v4/img/sleep')


if __name__ == '__main__':
    main()
