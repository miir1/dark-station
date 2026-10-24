"""Codex 시트 ①(수납 가구 짝)·②(찾은 물건 아이콘·선반·가방) 후처리 (2026-10-24 회의 P0-A3).

  python tools/containers.py             두 시트 다 (있는 것만)
  python tools/containers.py containers  ① art_src/sheets/containers.png  → v4/img/props/<이름>(_open|_empty).png, v4/img/tiles/dash_0.png
  python tools/containers.py found       ② art_src/sheets/found_icons.png → v4/img/icons/<이름>.png, v4/img/props/shelf*·bag*.png

후처리 규칙
- 칸: 시트를 고른 격자(① 6×3, ② 5×3)로 나누고, 칸 안의 분홍 아닌 덩어리 가운데 큰 것들(가장 큰 것의 3% 이상)을 감싸는 상자를 쓴다.
- 크기: tools/art_scale.json furniture/carry 의 [가로, 세로](외곽선 포함) 안에 맞춘다. 짝(닫힘·열림·빔)은 '닫힘' 그림으로 정한
  배율 하나를 같이 쓴다(몸통 크기가 같게).
- 짝 맞추기: 바닥 줄을 같게 놓고, 닫힘 그림과 몸통이 가장 많이 겹치는 가로 자리를 찾아 맞춘다. 캔버스는 짝 모두를 담는 같은 크기로,
  닫힘 그림 몸통이 가운데 오게 좌우를 똑같이 넓힌다(열린 문이 옆으로 나와도 몸통 자리는 그대로) → check_scale.py '기준점 차이 0'.
- 색: chunky 와 같은 처리(tone → 48색 → 게임 팔레트 PAL), 짝은 한 번에 줄여 색이 같게. 외곽선은 그림의 가장 어두운 색 1px.
- 손잡이: 열 수 있는 것(닫힘 그림)에 같은 놋쇠색 2px(art_scale.json handle.rgb) + 밑/오른쪽 그늘 1줄. 열린 그림에는 찍지 않는다(이미 뒤진 것은 표시가 없다).
- 아이콘: 40×40, 가운데, 여백 2 (icons.py 와 같은 맞춤) + 48색 + 외곽선.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from sheet import is_bg, darkest  # noqa: E402
from chunky import tone, reduce_colors  # noqa: E402
from PIL import ImageFilter  # noqa: E402

SRC = os.path.join(ROOT, 'art_src', 'sheets')
IMG = os.path.join(ROOT, 'v4', 'img')
S = json.load(open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8'))
BRASS = tuple(S['handle']['rgb']) + (255,)

# ① 6열×3행. (이름, 짝 이름) — 짝 이름이 같으면 한 짝
CONTAINERS = ['dash', 'medkit', 'medkit_open', 'lever_box', 'lever_box_open', 'toolbox',
              'toolbox_open', 'crate', 'crate_open', 'crate_empty', 'locker', 'locker_open',
              'drawer', 'drawer_open', 'barrel', 'barrel_open', 'shelter_box', 'shelter_box_open']
# ② 5열×3행. 'i:' = 아이콘
FOUND = ['i:notebook', 'i:cable', 'i:radio', 'i:key', 'i:phonecard',
         'i:crackers', 'i:bottle', 'i:rope', 'i:glove', 'i:fuse',
         'i:matches', 'shelf', 'shelf_empty', 'bag', 'bag_open']

# 손잡이 자리: 닫힘 그림 몸통 상자 안의 비율 (x, y, 'h' 가로 2px | 'v' 세로 2px)
HANDLE = {
    'medkit': (0.84, 0.50, 'v'), 'lever_box': (0.84, 0.42, 'v'), 'toolbox': (0.5, 0.62, 'h'), 'crate': (0.5, 0.55, 'h'),
    'locker': (0.24, 0.50, 'v'), 'drawer': (0.5, 0.36, 'h'), 'barrel': (0.5, 0.10, 'h'), 'shelter_box': (0.5, 0.52, 'h'),
    'bag': (0.5, 0.55, 'h'),
}


def size_of(base):
    for sec in ('furniture', 'carry', 'hand'):
        it = S[sec].get('items', {})
        if base in it:
            return it[base]
    raise KeyError(base)


def base_of(n):
    for t in ('_open', '_empty'):
        if n.endswith(t):
            return n[: -len(t)]
    return n


def mask(im):
    """분홍 바탕 = 0. 그림 도구가 바탕을 투명으로 낸 경우도 투명 = 0."""
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    bg = ((r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)) | ((r - g > 55) & (b - g > 55) & (np.abs(r - b) < 70))
    m = ~bg & (a[:, :, 3] > 40)
    mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return np.array(mi) > 0


def cell_crop(im, m, box):
    x0, y0, x1, y1 = box
    sub = m[y0:y1, x0:x1]
    lab, n = ndimage.label(sub, structure=np.ones((3, 3)))
    if not n:
        return None
    sizes = ndimage.sum(sub, lab, range(1, n + 1))
    keep = [i + 1 for i in range(n) if sizes[i] >= 0.03 * sizes.max()]
    km = np.isin(lab, keep)
    ys, xs = np.where(km)
    bx = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    crop = im.crop((x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3])).convert('RGBA')
    a = (km[bx[1]:bx[3], bx[0]:bx[2]] * 255).astype(np.uint8)
    crop.putalpha(Image.fromarray(a))
    return crop


def shrink(crop, s):
    nw, nh = max(1, round(crop.width * s)), max(1, round(crop.height * s))
    out = crop.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    a = np.array(out)
    a[:, :, 3] = np.where(a[:, :, 3] > 120, 255, 0)
    a[a[:, :, 3] == 0] = 0
    ys, xs = np.where(a[:, :, 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def best_dx(ref, mov, r=8):
    """둘 다 바닥 줄을 맞춘 뒤, mov 를 가로로 얼마나 밀면 ref 와 가장 많이 겹치나 (ref 왼쪽 끝 기준 mov 왼쪽 끝 자리)."""
    H = max(ref.shape[0], mov.shape[0])
    W = ref.shape[1] + 2 * (mov.shape[1] + r)
    ra = np.zeros((H, W), bool)
    ox = mov.shape[1] + r
    ra[H - ref.shape[0]:, ox:ox + ref.shape[1]] = ref[:, :, 3] > 0
    best, bx = -1, 0
    mm = mov[:, :, 3] > 0
    for x in range(0, W - mov.shape[1] + 1):
        ma = np.zeros((H, W), bool)
        ma[H - mov.shape[0]:, x:x + mov.shape[1]] = mm
        v = int((ra & ma).sum())
        if v > best or (v == best and abs(x - ox) < abs(bx - ox)):
            best, bx = v, x
    return bx - ox


def outline(a, color):
    m = a[:, :, 3] > 0
    nb = np.zeros_like(m)
    nb[1:] |= m[:-1]
    nb[:-1] |= m[1:]
    nb[:, 1:] |= m[:, :-1]
    nb[:, :-1] |= m[:, 1:]
    out = a.copy()
    out[nb & ~m] = list(color) + [255]
    return out


def colour(parts, n=48):
    """여러 장을 한 번에 48색 + 게임 팔레트로 (짝끼리 색이 같게). 알파는 그대로."""
    H = max(p.shape[0] for p in parts)
    W = sum(p.shape[1] for p in parts)
    sheet = np.zeros((H, W, 4), np.uint8)
    x = 0
    for p in parts:
        sheet[:p.shape[0], x:x + p.shape[1]] = p
        x += p.shape[1]
    im = Image.fromarray(sheet)
    rgb = np.array(reduce_colors(tone(im, contrast=1.1, color=0.95, sharp=False), n, pal=True))
    out, x = [], 0
    for p in parts:
        q = np.concatenate([rgb[:p.shape[0], x:x + p.shape[1]], p[:, :, 3:4]], axis=2)
        q[q[:, :, 3] == 0] = 0
        out.append(q)
        x += p.shape[1]
    return out


def handle(a, name, box):
    if name not in HANDLE:
        return a
    fx, fy, o = HANDLE[name]
    x0, y0, x1, y1 = box
    x = x0 + int(round((x1 - x0 - 1) * fx))
    y = y0 + int(round((y1 - y0 - 1) * fy))
    out = a.copy()
    shadow = (12, 9, 8, 255)                 # 손잡이 밑(가로)·오른쪽(세로) 그늘 1줄 — 어떤 바탕색에서도 놋쇠가 떠 보이게
    if o == 'h':
        out[y + 1, x - 1:x + 1] = shadow
        out[y, x - 1:x + 1] = BRASS
    else:
        out[y:y + 2, x + 1] = shadow
        out[y:y + 2, x] = BRASS
    return out


def group_pairs(names):
    groups = []
    for n in names:
        if n.startswith('i:'):
            groups.append([n])
            continue
        b = base_of(n)
        if groups and not groups[-1][0].startswith('i:') and base_of(groups[-1][0]) == b:
            groups[-1].append(n)
        else:
            groups.append([n])
    return groups


def run(sheet, names, cols, rows):
    p = os.path.join(SRC, sheet)
    if not os.path.exists(p):
        print('시트 없음', p)
        return []
    im = Image.open(p).convert('RGBA')
    m = mask(im)
    w, h = im.size
    crops = {}
    for i, n in enumerate(names):
        c, r = i % cols, i // cols
        crops[n] = cell_crop(im, m, (c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows))
        if crops[n] is None:
            print('빈 칸', n)
    made = []
    for grp in group_pairs(names):
        if any(crops[n] is None for n in grp):
            continue
        if grp[0].startswith('i:'):                         # 아이콘 40×40
            n = grp[0][2:]
            c = crops[grp[0]]
            s = min(36 / c.width, 36 / c.height)
            a = shrink(c, s)
            a = colour([a])[0]
            ink = darkest(Image.fromarray(a))
            canvas = np.zeros((40, 40, 4), np.uint8)
            y, x = (40 - a.shape[0]) // 2, (40 - a.shape[1]) // 2
            canvas[y:y + a.shape[0], x:x + a.shape[1]] = a
            os.makedirs(os.path.join(IMG, 'icons'), exist_ok=True)
            Image.fromarray(outline(canvas, ink)).save(os.path.join(IMG, 'icons', n + '.png'))
            made.append('icons/' + n)
            continue
        W, H = size_of(base_of(grp[0]))
        c0 = crops[grp[0]]
        s = min((W - 2) / c0.width, (H - 2) / c0.height)
        smalls = [shrink(crops[n], s) for n in grp]
        smalls = colour(smalls)
        ref = smalls[0]
        # 자리: 바닥 줄 같게, 가로는 가장 많이 겹치는 자리. 닫힘 몸통 가운데 기준 좌우 대칭 캔버스
        xs = [0] + [best_dx(ref, a) for a in smalls[1:]]
        cx = ref.shape[1] / 2
        half = max(max(cx - x, x + a.shape[1] - cx) for a, x in zip(smalls, xs))
        CWd = int(np.ceil(half)) * 2 + 2
        CWd = max(CWd, W)
        CHd = max(max(a.shape[0] for a in smalls) + 2, H)
        ox0 = int(round(CWd / 2 - cx))
        ink = darkest(Image.fromarray(np.concatenate([a.reshape(-1, 4) for a in smalls])[None]))
        for n, a, x in zip(grp, smalls, xs):
            canvas = np.zeros((CHd, CWd, 4), np.uint8)
            top = CHd - 1 - a.shape[0]
            canvas[top:top + a.shape[0], ox0 + x:ox0 + x + a.shape[1]] = a
            canvas = outline(canvas, ink)
            if n == grp[0]:
                canvas = handle(canvas, base_of(n), (ox0 + 1, top, ox0 + a.shape[1] - 1, top + a.shape[0]))
            os.makedirs(os.path.join(IMG, 'props'), exist_ok=True)
            Image.fromarray(canvas).save(os.path.join(IMG, 'props', n + '.png'))
            made.append(f'props/{n} {CWd}x{CHd}')
    return made


def dash_tile():
    p = os.path.join(IMG, 'props', 'dash.png')
    if not os.path.exists(p):
        return None
    fl = Image.open(os.path.join(ROOT, 'v3', 'img', 'tiles', 'carFloor_0.png')).convert('RGBA')
    d = Image.open(p).convert('RGBA')
    t = fl.copy()
    t.alpha_composite(d, ((32 - d.width) // 2, 32 - d.height))
    os.makedirs(os.path.join(IMG, 'tiles'), exist_ok=True)
    t.save(os.path.join(IMG, 'tiles', 'dash_0.png'))
    return 'tiles/dash_0'


def main():
    what = sys.argv[1:] or ['containers', 'found']
    if 'containers' in what:
        for x in run('containers.png', CONTAINERS, 6, 3):
            print(x)
        print(dash_tile())
    if 'found' in what:
        for x in run('found_icons.png', FOUND, 5, 3):
            print(x)


if __name__ == '__main__':
    main()
