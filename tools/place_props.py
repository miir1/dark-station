"""큰 장소 물건 손찍기 (2026-10-24 검증 U1 항목 3·U4 항목 4 — plan.md P1-10 의 Codex ③ 앞당김 대체). Codex 0회.

  python tools/place_props.py      → v4/img/props/phonebooth{,_taken}.png (32×64)
                                     v4/img/props/pharmacy_shutter{,_half,_open,_dark}.png (96×48)
                                     v4/img/props/cistern.png (64×64)

왜: 지하상가 1층 공중전화가 바닥에 떨어진 휴대폰(v3 phone 14×12)으로 그려져 '반환구에서 카드를 찾는다'가 화면에서 안 읽혔다.
    약국 셔터(v3 kiosk)·저수조(v3 tank)도 1칸짜리 옛 그림이었다. 오늘 Codex 몫(하루 5회)은 앞 단계에서 다 썼으므로 점 단위로 찍는다.
    10/26 Codex ③이 더 나은 그림을 주면 같은 이름으로 덮어쓰면 된다(화면 연결은 그대로).

- 크기: tools/art_scale.json place (부스 32×64, 약국 셔터 96×48, 물탱크 64×64). 사람 46px = 170cm.
- 색: tiny_props.py 의 공용 PAL 색표(C)만 쓴다. 외곽선 1px, 위가 밝은 면, 녹·때 점.
- 상태 짝은 캔버스·바닥 줄이 같다(check_scale.py pairs.states 에 넣음).
  공중전화: card(반환구에 흰 카드가 걸려 있고 수화기가 줄에 매달려 늘어짐) / taken(반환구가 비고 수화기가 제자리에)
  약국 셔터: closed(셔터 내림, 오른쪽 유리문 안에 내다보는 흰 얼굴) / half(셔터 반쯤 — 아래로 어두운 안과 빈 선반) /
            open(셔터 다 올림 — 거의 빈 선반·계산대) / dark(셔터가 유리문까지 끝까지 내려오고 간판 불이 꺼짐)
  저수조: normal(콘크리트 물통, 검은 물에 물결 고리, 물 밑의 흐린 흰 형체 — 무엇인지는 그리지 않는다)
- 글자·숫자·간판 글씨 없음(약국은 알약 그림 하나로).
"""
import os
import random

from PIL import Image

import tiny_props as TP

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
PROPS = os.path.join(ROOT, 'v4', 'img', 'props')
C = TP.C


def rgb(ch):
    v = C[ch]
    return (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)


class P:
    def __init__(self, w, h, seed):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.px = self.im.load()
        self.w, self.h = w, h
        self.r = random.Random(seed)

    def put(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = rgb(ch) if isinstance(ch, str) else ch

    def get(self, x, y):
        return self.px[x, y] if 0 <= x < self.w and 0 <= y < self.h else (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, ch)

    def hl(self, x0, x1, y, ch):
        self.rect(x0, y, x1, y, ch)

    def vl(self, x, y0, y1, ch):
        self.rect(x, y0, x, y1, ch)

    def speck(self, x0, y0, x1, y1, chs, n):
        for _ in range(n):
            x, y = self.r.randint(x0, x1), self.r.randint(y0, y1)
            if self.get(x, y)[3]:
                self.put(x, y, self.r.choice(chs))

    def outline(self):
        """불투명 덩어리 바깥 둘레 1px 를 외곽선으로(덩어리 안쪽 가장자리 픽셀을 바꾼다)."""
        op = [[self.px[x, y][3] > 0 for x in range(self.w)] for y in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if not op[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if not (0 <= X < self.w and 0 <= Y < self.h) or not op[Y][X]:
                        self.put(x, y, 'o')
                        break


# ── 공중전화 부스 32×64 ──
def phonebooth(card):
    p = P(32, 64, 7)
    # 바닥 판
    p.rect(4, 59, 27, 63, 'S')
    p.hl(5, 26, 59, 'a')
    # 안쪽 뒷벽(어두운 유리 너머)
    p.rect(6, 12, 25, 59, 'n')
    for y in range(12, 59, 3):
        p.hl(7, 24, y, 'N')
    # 옆 유리(좁은 띠, 비스듬한 빛줄)
    for x0 in (6, 24):
        p.rect(x0, 12, x0 + 1, 58, 'c')
        for y in range(14, 57, 9):
            p.put(x0 + (0 if x0 == 6 else 1), y, 'e')
            p.put(x0 + (1 if x0 == 6 else 0), y + 1, 'C')
    # 기둥
    for x0 in (4, 26):
        p.rect(x0, 10, x0 + 1, 62, 'p')
        p.vl(x0, 10, 62, 'P')
    p.speck(4, 20, 5, 60, 'Tt', 6)
    p.speck(26, 20, 27, 60, 'Tt', 6)
    # 지붕: 윗면(밝음) + 앞 가장자리 띠(푸른 회색)
    p.rect(3, 4, 28, 6, 'P')
    p.hl(4, 27, 4, 'q')
    p.rect(3, 7, 28, 10, 'C')
    p.hl(3, 28, 10, 'c')
    p.speck(3, 7, 28, 10, 'Ucy', 7)
    # 전화기 몸통 (뒷벽에 붙음) x 10~21, y 19~38
    p.rect(10, 19, 21, 38, 'x')
    p.rect(11, 20, 20, 37, 'w')
    p.hl(11, 20, 20, 'v')
    p.vl(20, 21, 37, 'x')
    p.rect(13, 22, 18, 24, 'u')          # 꺼진 작은 창
    p.hl(14, 17, 23, 'U')
    p.hl(19, 20, 23, 'k')                # 카드 넣는 틈
    for yy in (27, 29, 31, 33):          # 단추 3×4
        for xx in (14, 16, 18):
            p.put(xx, yy, 'a')
    p.rect(13, 35, 18, 37, 'k')          # 반환구
    p.hl(13, 18, 35, 'n')
    # 걸이 고리(수화기 왼쪽)
    p.rect(10, 21, 10, 33, 'p')
    # 선반
    p.rect(8, 40, 23, 41, 'P')
    p.hl(8, 23, 42, 'p')
    if not card:
        # 수화기가 제자리에: 몸통 왼쪽에 세로로 걸림
        p.rect(7, 21, 9, 34, 'S')
        p.vl(7, 22, 33, 'A')
        p.rect(7, 21, 9, 23, 'a')
        p.rect(7, 32, 9, 34, 'a')
        p.hl(7, 9, 21, 'A')
    else:
        # 수화기가 줄에 매달려 선반 아래로 늘어짐 (걸이는 비었다)
        for i, (x, y) in enumerate([(9, 34), (8, 36), (9, 38), (8, 40), (9, 42), (8, 44), (9, 46)]):
            p.put(x, y, 'a' if i % 2 else 'A')
            p.put(x, y + 1, 'S')
        p.rect(7, 48, 10, 50, 'S')
        p.rect(8, 51, 9, 55, 'S')
        p.vl(8, 49, 54, 'A')
        p.rect(7, 55, 10, 57, 'S')
        p.hl(7, 10, 55, 'a')
        # 반환구에 걸린 전화카드: 흰 카드 + 노란 칩, 빛 한 점
        p.rect(14, 35, 17, 38, 'W')
        p.hl(14, 17, 38, 'B')
        p.put(15, 36, 'Y')
        p.put(16, 36, 'G')
        p.put(14, 35, 'v')
    p.speck(6, 44, 25, 58, 'Ns', 10)
    p.outline()
    # 외곽선 위로 반환구 카드가 덮이지 않게(카드는 안쪽이라 그대로)
    return p.im


# ── 약국 셔터 96×48 ──
def pharmacy(state):
    p = P(96, 48, 11)
    lit = state != 'dark'
    # 벽틀(위·양옆)
    p.rect(0, 0, 95, 47, 's')
    p.rect(0, 0, 95, 2, 'S')
    # 간판 상자(글씨 없음, 알약 그림 하나)
    p.rect(3, 3, 92, 10, 'P' if lit else 'a')
    p.hl(3, 92, 3, 'q' if lit else 'A')
    p.hl(3, 92, 10, 'p' if lit else 'S')
    p.speck(4, 4, 91, 9, 'xp' if lit else 'sS', 60)
    # 알약(반 붉음·반 흼) 가운데
    cx = 47
    p.rect(cx - 5, 5, cx, 8, 'd' if lit else 'R')
    p.rect(cx + 1, 5, cx + 6, 8, 'v' if lit else 'b')
    p.hl(cx - 4, cx + 5, 4, 'o')
    p.hl(cx - 4, cx + 5, 9, 'o')
    p.vl(cx - 6, 5, 8, 'o')
    p.vl(cx + 7, 5, 8, 'o')
    p.put(cx - 3, 5, 'Y' if lit else 'T')
    # 셔터 말이 상자
    p.rect(2, 11, 93, 14, 'p')
    p.hl(2, 93, 11, 'P')
    p.hl(2, 93, 14, 'S')
    p.speck(2, 11, 93, 14, 'Tt', 18)

    def slats(x0, x1, y0, y1):
        for y in range(y0, y1 + 1):
            ch = 'P' if (y - y0) % 3 == 0 else 'p' if (y - y0) % 3 == 1 else 'a'
            p.hl(x0, x1, y, ch)
        p.speck(x0, y0, x1, y1, 'TtyN', (x1 - x0) * (y1 - y0) // 28)
        for x in range(x0 + 3, x1, 11):              # 녹물 줄
            for y in range(y0 + 1, y1, 2):
                if p.r.random() < 0.6:
                    p.put(x, y, 't')
        p.hl(x0, x1, y1, 'N')                        # 아래 쇠대
        p.hl(x0, x1, y1 - 1, 'x')
        p.put(x0 + (x1 - x0) // 2, y1 - 2, 'k')     # 자물쇠 고리

    def inside(x0, x1, y0, y1, shelves_full):
        p.rect(x0, y0, x1, y1, 'k')
        for sy in range(y0 + 4, y1 - 4, 7):          # 선반
            p.hl(x0 + 2, x1 - 2, sy, 'N')
            p.hl(x0 + 2, x1 - 2, sy + 1, 'n')
            for x in range(x0 + 4, x1 - 3, 4):            # 거의 빈 선반: 약병이 드문드문
                if shelves_full or p.r.random() < 0.22:
                    p.rect(x, sy - 3, x + 1, sy - 1, 'B' if (x // 4) % 2 else 'e')
                    p.put(x, sy - 3, 'v')
        p.rect(x0 + 6, y1 - 6, x1 - 6, y1 - 1, 'N')  # 계산대
        p.hl(x0 + 6, x1 - 6, y1 - 6, 'S')

    def glass_door(face):
        p.rect(64, 15, 93, 46, 'x')                  # 문틀
        p.rect(66, 17, 91, 45, 'u')                  # 유리 안(어둠)
        p.rect(67, 18, 90, 44, 'n')
        for y in range(19, 44, 6):                   # 유리에 비친 빛줄
            p.put(68 + (y % 5), y, 'c')
            p.put(69 + (y % 5), y + 1, 'C')
        p.vl(78, 17, 45, 'x')                        # 문 가운데
        p.rect(76, 30, 77, 32, 'G')                  # 손잡이(놋쇠)
        p.rect(79, 30, 80, 32, 'G')
        if face:                                     # 안쪽에서 내다보는 흰 얼굴 — 이목구비 없이 두 눈 그늘만
            p.rect(84, 24, 87, 28, 'P')
            p.rect(85, 23, 86, 29, 'P')
            p.put(84, 25, 'q')
            p.put(85, 26, 'k')
            p.put(87, 26, 'k')
            p.rect(84, 29, 87, 33, 'N')              # 어깨(어둠 속)
    if state == 'closed':
        slats(2, 62, 15, 46)
        glass_door(True)
    elif state == 'half':
        inside(2, 62, 15, 46, False)
        p.rect(30, 16, 40, 30, 'N')                  # 뒷방 문(닫힘)
        p.vl(38, 22, 24, 'G')
        slats(2, 62, 15, 30)
        glass_door(False)
    elif state == 'open':
        inside(2, 62, 15, 46, False)
        p.rect(30, 16, 40, 30, 'N')
        p.vl(38, 22, 24, 'G')
        p.rect(2, 15, 62, 16, 'p')                   # 다 올라간 셔터 끝
        p.hl(2, 62, 16, 'N')
        glass_door(False)
    else:   # dark: 셔터가 유리문까지 끝까지
        slats(2, 93, 15, 46)
    p.hl(0, 95, 47, 'N')
    p.outline()
    return p.im


# ── 저수조 64×64 ──
def cistern():
    p = P(64, 64, 23)
    # 앞면(콘크리트)
    p.rect(2, 30, 61, 62, 'S')
    for y in range(30, 62, 6):
        p.hl(2, 61, y, 's')
    for x in range(2, 62, 15):
        p.vl(x, 30, 62, 's')
    p.speck(2, 30, 61, 62, 'aANs', 160)
    p.speck(2, 52, 61, 62, 'MmM', 40)               # 아래 이끼
    for x in range(6, 60, 7):                        # 물때 줄(물이 넘친 자국)
        for y in range(31, 31 + p.r.randint(4, 12)):
            p.put(x, y, 'U' if y % 2 else 's')
    # 윗테(밝은 콘크리트) + 안쪽 벽
    p.rect(2, 12, 61, 29, 'A')
    p.hl(2, 61, 12, 'b')
    p.rect(5, 15, 58, 27, 's')                       # 안쪽 벽 그늘
    # 물면
    p.rect(6, 17, 57, 27, 'u')
    p.hl(6, 57, 17, 'N')
    # 물 밑 흐린 흰 형체 (무엇인지 그리지 않는다)
    p.rect(6, 18, 57, 20, 'c')                       # 먼 쪽 물면은 조금 밝다(천장 빛)
    p.hl(6, 57, 18, 'U')
    for x0, y0, x1, y1 in ((22, 22, 31, 24), (24, 21, 29, 25), (31, 23, 34, 24)):   # 물 밑 흐린 흰 형체
        p.rect(x0, y0, x1, y1, 'U')
    p.rect(25, 22, 28, 23, 'C')
    p.put(26, 22, 'p')
    import math
    for i in range(200, 340, 9):                     # 물결 고리 하나(앞쪽 반원이 빛을 받는다)
        x = int(round(36 + 12 * math.cos(math.radians(i))))
        y = int(round(23 - 3 * math.sin(math.radians(i))))
        p.put(x, y, 'e' if i % 27 == 0 else 'C')
    for i in range(20, 160, 12):
        x = int(round(36 + 12 * math.cos(math.radians(i))))
        y = int(round(23 - 3 * math.sin(math.radians(i))))
        p.put(x, y, 'U')
    # 옆 사다리(쇠, 녹)
    for y in range(14, 60, 4):
        p.hl(55, 59, y, 'T')
    p.vl(55, 12, 61, 'p')
    p.vl(59, 12, 61, 'p')
    # 아래 배수관과 녹물
    p.rect(8, 54, 13, 57, 'p')
    p.hl(8, 13, 54, 'P')
    for y in range(58, 63):
        p.put(10, y, 'T')
    p.hl(0, 63, 63, 'N')
    p.outline()
    return p.im


def main():
    os.makedirs(PROPS, exist_ok=True)
    out = {
        'phonebooth': phonebooth(True), 'phonebooth_taken': phonebooth(False),
        'pharmacy_shutter': pharmacy('closed'), 'pharmacy_shutter_half': pharmacy('half'),
        'pharmacy_shutter_open': pharmacy('open'), 'pharmacy_shutter_dark': pharmacy('dark'),
        'cistern': cistern(),
    }
    for n, im in out.items():
        im.save(os.path.join(PROPS, n + '.png'))
    print('큰 장소 물건', len(out), '장 → v4/img/props:', ', '.join(f'{n} {im.width}×{im.height}' for n, im in out.items()))


if __name__ == '__main__':
    main()
