"""Codex가 그린 시트(분홍 #FF00FF 바탕)를 게임 도트로 자른다.
- 분홍 바탕을 투명하게, 붙어 있는 덩어리마다 하나의 그림으로 잘라 (위→아래, 왼→오 순서)
- 지정한 크기(w×h) 안에 비율을 지켜 맞추고(바닥 정렬), 게임 팔레트로 색을 맞추고, 1px 검은 외곽선을 두른다.

python tools/sheet.py 시트.png 출력폴더 이름1,이름2,... 너비 높이 [--min 2000]
"""
import os
import re
import sys
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = open(os.path.join(HERE, '..', 'v3', 'art3.js'), encoding='utf-8').read()
block = ART[ART.index('const RAMP = {'):ART.index('};', ART.index('const RAMP = {'))]
PAL = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in re.findall(r"'#([0-9a-fA-F]{6})'", block)]
OUT = (5, 4, 4)


def is_bg(p):
    r, g, b = p[:3]
    if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
        return True
    return r - g > 55 and b - g > 55 and abs(r - b) < 70      # 분홍이 섞인 반투명 가장자리


def mask_of(im):
    w, h = im.size
    px = im.load()
    m = Image.new('L', (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            if not is_bg(px[x, y]):
                mp[x, y] = 255
    # 가장자리 분홍 번짐 제거: 한 번 줄였다가 키움
    return m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))


def components(mask, min_area):
    """붙어 있는 덩어리의 경계 상자 (작은 점은 버림). 줄여서 빠르게 센다."""
    w, h = mask.size
    sc = 4
    small = mask.resize((w // sc, h // sc), Image.NEAREST)
    sw, sh = small.size
    sp = small.load()
    seen = [[False] * sw for _ in range(sh)]
    boxes = []
    for y in range(sh):
        for x in range(sw):
            if sp[x, y] and not seen[y][x]:
                stack = [(x, y)]
                seen[y][x] = True
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while stack:
                    cx, cy = stack.pop()
                    n += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < sw and 0 <= ny < sh and sp[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                if n * sc * sc >= min_area:
                    boxes.append([x0 * sc, y0 * sc, (x1 + 1) * sc, (y1 + 1) * sc])
    # 가까운 덩어리 합치기 (떨어진 소품 조각)
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                gap = 12
                if a[0] - gap < b[2] and b[0] - gap < a[2] and a[1] - gap < b[3] and b[1] - gap < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    boxes.pop(j)
                    merged = True
                    break
            if merged:
                break
    # 줄 단위로 정렬: 위→아래, 같은 줄은 왼→오
    boxes.sort(key=lambda b: b[1])
    rows, cur = [], []
    for b in boxes:
        if cur and b[1] > max(c[3] for c in cur) - (b[3] - b[1]) * 0.5:
            rows.append(cur)
            cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def quantize_rgba(im):
    pal = Image.new('P', (1, 1))
    flat = [c for rgb in PAL for c in rgb]
    pal.putpalette(flat + [0] * (768 - len(flat)))
    rgb = im.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    a = im.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    rgb.putalpha(a)
    return rgb


def outline(im):
    w, h = im.size
    px = im.load()
    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3]:
                    op[x, y] = OUT + (255,)
                    break
    return out


def fit(crop, W, H, pad=1):
    cw, ch = crop.size
    s = min((W - 2 * pad) / cw, (H - 2 * pad) / ch)
    nw, nh = max(1, round(cw * s)), max(1, round(ch * s))
    small = crop.resize((nw, nh), Image.BOX)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.paste(small, ((W - nw) // 2, H - pad - nh), small)
    return canvas


def run(src, outdir, names, W, H, min_area=2000):
    im = Image.open(src).convert('RGBA')
    m = mask_of(im)
    im.putalpha(m)
    boxes = components(m, min_area)
    os.makedirs(outdir, exist_ok=True)
    made = []
    for name, b in zip(names, boxes):
        crop = im.crop(b)
        sprite = outline(quantize_rgba(fit(crop, W, H)))
        path = os.path.join(outdir, name + '.png')
        sprite.save(path)
        made.append(path)
    return boxes, made


if __name__ == '__main__' and '--tiles' not in sys.argv and '--walk' not in sys.argv:
    src, outdir, names, W, H = sys.argv[1], sys.argv[2], sys.argv[3].split(','), int(sys.argv[4]), int(sys.argv[5])
    mn = int(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 2000
    boxes, made = run(src, outdir, names, W, H, mn)
    print(f'덩어리 {len(boxes)}개, 이름 {len(names)}개 → {len(made)}장 저장')
    if len(boxes) != len(names):
        print('주의: 덩어리 수와 이름 수가 다르다', boxes)


def run_tiles(src, outdir, names, size=32):
    """질감 시트: 분홍 선으로 나뉜 칸마다 안쪽을 64×64로 줄이고 네 조각(32×32)을 변형 0~3으로 저장."""
    im = Image.open(src).convert('RGBA')
    W0, H0 = im.size
    cols, rows = 5, 2                                       # 질감 시트는 5×2 칸
    boxes = [[c * W0 // cols, r * H0 // rows, (c + 1) * W0 // cols, (r + 1) * H0 // rows] for r in range(rows) for c in range(cols)]
    os.makedirs(outdir, exist_ok=True)
    pal = Image.new('P', (1, 1))
    flat = [c for rgb in PAL for c in rgb]
    pal.putpalette(flat + [0] * (768 - len(flat)))
    for name, b in zip(names, boxes):
        x0, y0, x1, y1 = b
        mx, my = (x1 - x0) // 25, (y1 - y0) // 25          # 가장자리 4% 버림
        whole = name.endswith('!')                         # 방향이 있는 무늬: 통째로 한 칸
        name = name.rstrip('!')
        crop = im.convert('RGB').crop((x0 + mx, y0 + my, x1 - mx, y1 - my)).resize((size, size) if whole else (size * 2, size * 2), Image.BOX)
        # 칸마다 밝기를 맞추고(체크무늬 방지) 조금 어둡게 (사람이 묻히지 않게)
        from PIL import ImageStat, ImageEnhance
        if not whole:
            parts = [crop.crop((qx, qy, qx + size, qy + size)) for qx, qy in ((0, 0), (size, 0), (0, size), (size, size))]
            means = [sum(ImageStat.Stat(pp).mean) / 3 for pp in parts]
            avg = sum(means) / 4
            for pp, mv, (qx, qy) in zip(parts, means, ((0, 0), (size, 0), (0, size), (size, size))):
                crop.paste(ImageEnhance.Brightness(pp).enhance(avg / max(1, mv)), (qx, qy))
        crop = ImageEnhance.Brightness(crop).enhance(0.8)
        q = crop.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
        if whole:
            q.save(os.path.join(outdir, f'{name}_0.png'))
            continue
        for v, (qx, qy) in enumerate(((0, 0), (size, 0), (0, size), (size, size))):
            q.crop((qx, qy, qx + size, qy + size)).save(os.path.join(outdir, f'{name}_{v}.png'))
    return boxes


if __name__ == '__main__' and '--tiles' in sys.argv:
    sz = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 32
    bx = run_tiles(sys.argv[1], sys.argv[2], sys.argv[3].split(','), sz)
    print(f'칸 {len(bx)}개')


def run_walk(src, dst, W=32, H=48):
    """걷기 시트(3열×4행, 분홍 바탕) → 같은 배율로 잘라 W×H 칸 3×4 묶음 한 장 (아래·왼·오른·위 / 왼발·섬·오른발)."""
    im = Image.open(src).convert('RGBA')
    m = mask_of(im)
    im.putalpha(m)
    boxes = components(m, 1500)
    if len(boxes) != 12:
        # 덩어리가 12개가 아니면 칸을 고르게 나눠서 각 칸 안의 그림만 잡는다
        w0, h0 = im.size
        boxes = []
        for r in range(4):
            for c in range(3):
                cell = (c * w0 // 3, r * h0 // 4, (c + 1) * w0 // 3, (r + 1) * h0 // 4)
                bb = m.crop(cell).getbbox()
                boxes.append([cell[0] + bb[0], cell[1] + bb[1], cell[0] + bb[2], cell[1] + bb[3]] if bb else list(cell))
    hmax = max(b[3] - b[1] for b in boxes)
    wmax = max(b[2] - b[0] for b in boxes)
    s = min((H - 2) / hmax, (W - 2) / wmax)
    atlas = Image.new('RGBA', (W * 3, H * 4), (0, 0, 0, 0))
    for i, b in enumerate(boxes[:12]):
        crop = im.crop(b)
        nw, nh = max(1, round(crop.width * s)), max(1, round(crop.height * s))
        small = crop.resize((nw, nh), Image.BOX)
        cell = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cell.paste(small, ((W - nw) // 2, H - 1 - nh), small)
        atlas.paste(outline(quantize_rgba(cell)), ((i % 3) * W, (i // 3) * H))
    atlas.save(dst)
    return len(boxes)


if __name__ == '__main__' and '--walk' in sys.argv:
    args = [x for x in sys.argv[3:] if x != '--walk']
    n = run_walk(sys.argv[1], sys.argv[2], *(int(x) for x in args[:2]))
    print('덩어리', n)
