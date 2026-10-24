"""작은 물건 손찍기 (2026-10-24 회의 P0-A2). Codex 0회.

  python tools/tiny_props.py      → v4/img/props/<이름>.png, v4/img/props/drum_open.png, v4/img/poses/{eyes,mouth}.png

- 10px 이하 물건은 큰 그림을 줄이면 외곽선 덩어리가 되므로 점 단위로 찍는다. 색은 공용 PAL 66색 안에서만(아래 C 표).
- 크기는 tools/art_scale.json (사람 46px = 170cm). 손 물건 긴 변 ≤12px.
- 상태 그림(가득·빔·젖음 등)은 같은 캔버스·같은 바닥 줄·같은 가운데에 그리고, 1배 화면에서 갈리도록 서로 8픽셀 이상 다르게 한다.
- drum_open: 기존 화로 드럼통(v3/img/props/drum, 읽기만)에서 불 픽셀을 지우고 아가리를 다시 찍은 판. 캔버스 32×32 그대로
  (화면이 drum 자리에 그대로 바꿔 끼우고, 아가리 위에 코드 불꽃을 그린다. 아가리 자리 = art_scale.json anchors.drum_open).
- 반응 아이콘: mouth = 이가 보이는 입 7×5, eyes = 뜬 눈 하나 7×5 (머리 위 꼬리표 11×11 안에 들어가는 크기).
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
PROPS = os.path.join(ROOT, 'v4', 'img', 'props')
POSES = os.path.join(ROOT, 'v4', 'img', 'poses')

# 공용 PAL(v3/art3.js RAMP) 에서 고른 색. 글자 하나 = 색 하나. '.' = 투명
C = {
    'o': '#0a0807',   # ink 외곽선
    'k': '#14100e',   # ink 3
    'n': '#1c1613',   # soot 2
    'N': '#2a221d',   # soot 3
    's': '#352d28',   # stone 2
    'S': '#4a3f38',   # stone 3
    'a': '#5b5049',   # ash 2
    'A': '#7d7067',   # ash 3
    'b': '#8f8170',   # bone 1
    'B': '#c4b49c',   # bone 2
    'W': '#ece0c8',   # bone 3
    'w': '#b9b6ad',   # white 2
    'v': '#e5e1d6',   # white 3
    'x': '#7b7a75',   # white 1
    'p': '#6c7276',   # pale 1
    'P': '#9ba3a5',   # pale 2
    'q': '#c9cfcc',   # pale 3
    'c': '#2e434c',   # cold 1
    'C': '#4f6f7a',   # cold 2
    'e': '#86a3a8',   # cold 3
    'u': '#1b2d36',   # sea 2
    'U': '#2f4b57',   # sea 3
    'r': '#3a0709',   # blood 1
    'R': '#6e1014',   # blood 2
    'd': '#9c1e1e',   # blood 3
    't': '#4a1f12',   # rust 1
    'T': '#7d3a1e',   # rust 2
    'y': '#b0592c',   # rust 3
    'g': '#5e4516',   # gold 1
    'G': '#9a7428',   # gold 2
    'Y': '#d0a24a',   # gold 3
    'm': '#3a3a1e',   # rot 1
    'M': '#5d5c2c',   # rot 2
    'z': '#8a8642',   # rot 3
    'h': '#4d1a26',   # wine 2
    'H': '#73283a',   # wine 3
}


def img(rows):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.' and ch != ' ':
                v = C[ch]
                im.putpixel((x, y), (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255))
    return im


# ── 물통 (서 있는 페트병 4×10. 빈 것은 쓰러져 있고, 젖음은 쓰러진 병 + 웅덩이). 캔버스 10×10 ──
BOTTLE = [
    '...oo.....',
    '...CC.....',
    '..oPqo....',
    '..oPPo....',
    '..oeCo....',
    '..oeCo....',
    '..oeCo....',
    '..oeCo....',
    '..oCuo....',
    '...oo.....',
]
BOTTLE = ['.' + r[:-1] for r in BOTTLE]          # 가운데(x 3~6)로
BOTTLE_EMPTY = [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.oooooooo.',
    'oqPPPPPPxo',
    'oPppppPPxo',
    '.oooooooo.',
]
BOTTLE_WET = [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '.oooooooo.',
    'oqPPPPPPxo',
    'oPppppPPxo',
    'uoooooooouU',
    '.uUuuCuuuu',
]
BOTTLE_WET = [r[:10] for r in BOTTLE_WET]

# ── 그릇 (몸통 8×4, 캔버스 10×6). 2026-10-24 검증 후 고침: 실제 크기로 줄인 뒤 아침 흔적이 1배에서 8~14px 만 바뀌어
#    '판단 정보 친절'에 모자랐다 → 상태마다 바뀌는 픽셀을 늘리고(≥18) 밝기 차를 크게 했다. 그릇 크기는 그대로.
#    가득 = 그릇 위로 솟은 흰 죽 더미(밝음), 빔 = 안이 검고 숟가락이 걸쳐 있음·바닥에 부스러기, 고기 = 검붉은 덩어리가 솟고 국물이 흘러 바닥에 고임
BOWL = [
    '...BWWB...',
    '..BWWWWB..',
    '.oWBWBBWo.',
    'oAAAAAAAAo',
    '.oaAAAAao.',
    '..oooooo..',
]
BOWL_EMPTY = [
    '..........',
    '.......q..',
    '.okkkkxko.',
    'oANnnnNAAo',
    '.oaAAAAao.',
    'B.oooooo.b',
]
BOWL_MEAT = [
    '...rRRk...',
    '..rdRdRr..',
    '.oRdrRdRo.',
    'oARAAAARAo',
    'RoaRAAAaoR',
    'dRoooooodR',
]

# ── 붕대 (말린 붕대 5×4 + 풀린 끝, 캔버스 12×6 — 바닥 자국을 포함한 긴 변 12 = 손 물건 상한 안).
#    깨끗 = 흰 두루마리와 바닥에 늘어진 끝, 젖음 = 회청색으로 젖고 둘레에 물웅덩이(물빛이 반짝), 썩음 = 누렇게 썩고 바닥에 진물 자국·파리 둘,
#    피 = 붉게 젖고 둘레에 핏방울. 바닥 줄(5)과 캔버스는 모두 같다
BANDAGE = [
    '............',
    '............',
    '...oooo.....',
    '..oWvvWo....',
    '..ovWWvWvwo.',
    '...oooo.owwo',
]
BANDAGE_WET = [
    '............',
    '............',
    '...oooo.....',
    '.CoPeePoC...',
    'CuoeCCeCeCuC',
    'uCeoooouoCeu',
]
BANDAGE_ROT = [
    '..k......k..',
    '.k..........',
    '...oooo.....',
    '.MozMmzoM...',
    'MmomzzmzmMmM',
    'mMmoooomoMzm',
]
BANDAGE_BLOOD = [
    '............',
    '............',
    '...oooo.....',
    '.doRdRdod...',
    '.RodRWdRdRo.',
    'dR.ooooRoddR',
]

# ── 수첩 (검은 표지 6×5 + 연필). 옮겨짐 = 연필이 표지 위에서 옆 바닥으로. 캔버스 9×5 ──
NOTEBOOK = [
    'oooooo...',
    'oNnRvo...',
    'kYYYYGt..',
    'oNnRvo...',
    'ovvvvo...',
]
NOTEBOOK_MOVED = [
    'oooooo..k',
    'oNnRvo..Y',
    'oNnRvo..Y',
    'oNnRvo..G',
    'ovvvvo..t',
]

# ── 가위 (벌어진 가위 8×7, 캔버스 10×7). 피 = 날 전체가 붉고, 손잡이 둘레 바닥에 피가 고임(밝은 쇠 → 검붉음, 바뀌는 픽셀 ≥18) ──
SCISSORS = [
    'q......q..',
    'xq....qx..',
    '.xq..qx...',
    '..xqqx....',
    '...kk.....',
    '.HHk.kHH..',
    '.HHH.HHH..',
]
SCISSORS_BLOOD = [
    'd......d..',
    'Rd....dR..',
    '.Rd..dR...',
    '..RdRx..d.',
    '...kk...R.',
    'dHHk.kHHd.',
    'RHHHdHHHRd',
]

# ── 구두 한 짝 (옆으로 누운 검은 구두 8×5) / 한 켤레 (가지런히, 위에서 10×5) ──
SHOE_ONE = [
    '....oooo',
    '...oBbNo',
    '.ooNSNNo',
    'oNASNNNo',
    'oooooooo',
]
SHOE_PAIR = [
    '.oo....oo.',
    'oSAo..oASo',
    'oNSo..oSNo',
    'obBo..oBbo',
    '.oo....oo.',
]

# ── 쇠파이프 (세워 둔 3×24). 피 = 위쪽 3분의 1에 붉은 자국 ──
def pipe(blood=False):
    rows = []
    for y in range(24):
        if y == 0:
            rows.append('oSo')
        elif y == 23:
            rows.append('oso')
        else:
            mid = 'P' if y % 7 not in (3, 4) else 'A'
            if y in (9, 15):
                mid = 'T'                  # 녹
            if y in (5, 18):
                mid = 'q'                  # 빛
            rows.append('s' + mid + 'n')
    if blood:
        for y, m in ((2, 'd'), (3, 'R'), (4, 'd'), (5, 'd'), (6, 'R'), (7, 'r'), (9, 'R'), (11, 'r')):
            rows[y] = rows[y][0] + m + rows[y][2]
        for y in (3, 6):
            rows[y] = 'R' + rows[y][1:]
    return rows


# ── 분필 줄 (흰 점선 28×4, 노란 안전선과 다른 색·모양: 손으로 그어 흔들리고 가루가 날림) ──
CHALK = [
    '..x......x.........x....x...',
    'vvw.wvvw..vwvv.wvvw..vwwv.wv',
    '.wvvw..vwvw..wvvw..wvvw..vvw',
    '....x.......x.......x.......',
]

# ── 깡통 5×6 / 칼 9×3 ──
CAN = [
    '.ooo.',
    'oqPqo',
    'oyTyo',
    'oTtTo',
    'oPpPo',
    '.ooo.',
]
KNIFE = [
    '...qqqqq.',
    'kNkPPPPPq',
    '...xxxx..',
]

# ── 반응 아이콘 7×5 ──
MOUTH = [
    '.RRRRR.',
    'RWBWBWR',
    'RrrkrrR',
    'RBWBWBR',
    '.RRRRR.',
]
EYES = [
    '..ooo..',
    '.oWWWo.',
    'odWkWWo',
    '.oBWBo.',
    '..ooo..',
]

ITEMS = {
    'bottle': BOTTLE, 'bottle_empty': BOTTLE_EMPTY, 'bottle_wet': BOTTLE_WET,
    'bowl': BOWL, 'bowl_empty': BOWL_EMPTY, 'bowl_meat': BOWL_MEAT,
    'bandage': BANDAGE, 'bandage_wet': BANDAGE_WET, 'bandage_rot': BANDAGE_ROT, 'bandage_blood': BANDAGE_BLOOD,
    'notebook': NOTEBOOK, 'notebook_moved': NOTEBOOK_MOVED,
    'scissors': SCISSORS, 'scissors_blood': SCISSORS_BLOOD,
    'shoe_one': SHOE_ONE, 'shoe_pair': SHOE_PAIR,
    'pipe_stand': pipe(), 'pipe_stand_blood': pipe(True),
    'chalk_line': CHALK, 'can': CAN, 'knife': KNIFE,
}


def drum_open():
    """v3 화로 드럼통에서 불을 지우고 아가리를 찍는다. 13줄 위(불꽃)는 지우고, 13~15줄을 테두리·안쪽 숯으로."""
    src = Image.open(os.path.join(ROOT, 'v3', 'img', 'props', 'drum.png')).convert('RGBA')
    im = src.copy()
    px = im.load()
    for y in range(0, 13):
        for x in range(32):
            px[x, y] = (0, 0, 0, 0)
    rim = [
        # y, 문자열(x=9 부터)
        (13, '..ooooooooooo..'),
        (14, '.oSkrnRrknrkSo.'),
        (15, 'oaAnkrdRkrnkAao'),
    ]
    for y, s in rim:
        for i, ch in enumerate(s):
            x = 9 + i
            if ch == '.':
                px[x, y] = (0, 0, 0, 0)
            else:
                v = C[ch]
                px[x, y] = (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)
    # 16줄 양끝 외곽선 이어 붙이기
    for x in (9, 23):
        px[x, 16] = (0, 0, 0, 255) if px[x, 16][3] == 0 else px[x, 16]
    return im


def main():
    os.makedirs(PROPS, exist_ok=True)
    for name, rows in ITEMS.items():
        img(rows).save(os.path.join(PROPS, name + '.png'))
    drum_open().save(os.path.join(PROPS, 'drum_open.png'))
    os.makedirs(POSES, exist_ok=True)
    img(MOUTH).save(os.path.join(POSES, 'mouth.png'))
    img(EYES).save(os.path.join(POSES, 'eyes.png'))
    print('작은 물건', len(ITEMS), '장 + drum_open → v4/img/props, 반응 아이콘 2장(7×5) → v4/img/poses')


if __name__ == '__main__':
    main()
