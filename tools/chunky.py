"""모든 게임 그림을 같은 도트 격자로: 절반 크기로 줄여 색 수를 줄이고 외곽선을 두른 뒤 2배로 키운다.
(한 도트 = 화면 2×2. 초상·사람·소품·크리처·질감이 같은 굵기의 도트를 갖는다 — 디테일은 줄고 덩어리는 또렷해진다)

python tools/chunky.py portrait 원본.png 출력.png 128          초상 (128 → 64 도트)
python tools/chunky.py walk     원본.png 출력.png 48 72        걷기 묶음 3×4 (칸 48×72 → 24×36 도트)
python tools/chunky.py sprites  시트.png 출력폴더 이름,.. W H   분홍 시트에서 덩어리마다
python tools/chunky.py cg       원본.png 출력.png 480 270      장면 그림 (240×135 도트)
"""
import os
import sys
from PIL import Image, ImageEnhance, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import mask_of, components, PAL, darkest  # noqa: E402

PX = 1                       # 한 도트의 화면 크기 (설계 v5: 지도·초상·장면 모두 1px)
OUT = (8, 6, 6)              # 외곽선 색 (가장 어두운 잉크)


def palette_img():
    pal = Image.new('P', (1, 1))
    flat = [c for rgb in PAL for c in rgb]
    pal.putpalette(flat + [0] * (768 - len(flat)))
    return pal


PAL_IMG = palette_img()


def tone(im, contrast=1.12, color=0.92, sharp=True, bright=1.0):
    """색 수를 줄이기 전에: 대비는 조금 올리고 채도는 조금 내린다 (게임 전체의 칙칙한 톤)."""
    rgb = im.convert('RGB')
    if bright != 1.0:
        rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = ImageEnhance.Color(rgb).enhance(color)
    if sharp:
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    return rgb


def reduce_colors(rgb, n, pal=True):
    """그림마다 n색으로 먼저 줄이고(뭉개진 잡색 제거) 게임 팔레트에 맞춘다. pal=False면 그림 고유의 n색 (피부색이 틀어지지 않게)."""
    few = rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return few.quantize(palette=PAL_IMG, dither=Image.Dither.NONE).convert('RGB') if pal else few


def outline(im, color=None):
    if color is None:
        color = darkest(im)
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
                    op[x, y] = tuple(color) + (255,)
                    break
    return out


def up(im):
    return im.resize((im.width * PX, im.height * PX), Image.NEAREST)


def chunk_rgba(im, n=24, line=True, pal=True, **kw):
    """투명 배경 그림(이미 도트 크기) → 색 줄이기 + 외곽선."""
    a = im.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    rgb = reduce_colors(tone(im, **kw), n, pal)
    rgb.putalpha(a)
    return outline(rgb) if line else rgb


def fit_box(crop, W, H, bottom=True, pad=1):
    cw, ch = crop.size
    s = min((W - 2 * pad) / cw, (H - 2 * pad) / ch)
    nw, nh = max(1, round(cw * s)), max(1, round(ch * s))
    small = crop.resize((nw, nh), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.paste(small, ((W - nw) // 2, (H - pad - nh) if bottom else (H - nh) // 2), small)
    return c


# ── 초상: 정사각형으로 잘라 64도트, 28색 ──
def portrait(src, dst, size=96):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    d = size // PX
    small = tone(im.resize((d, d), Image.LANCZOS), contrast=1.15, color=0.9)
    up(reduce_colors(small, 28, pal=False)).save(dst)


# ── 장면 그림: 240×135 도트, 40색 ──
def cg(src, dst, W=384, H=216):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w / h > W / H:
        cw, ch = round(h * W / H), h
    else:
        cw, ch = w, round(w * H / W)
    im = im.crop(((w - cw) // 2, (h - ch) // 2, (w - cw) // 2 + cw, (h - ch) // 2 + ch))
    small = tone(im.resize((W // PX, H // PX), Image.LANCZOS), contrast=1.08, color=0.95, sharp=False)
    up(reduce_colors(small, 48, pal=False)).save(dst)


# ── 분홍 시트 → 덩어리마다 (사람·크리처·소품·상징) ──
def sprites(src, outdir, names, W, H, n=20, bottom=True, min_area=2000):
    im = Image.open(src).convert('RGBA')
    m = mask_of(im)
    im.putalpha(m)
    boxes = components(m, min_area)
    os.makedirs(outdir, exist_ok=True)
    for name, b in zip(names, boxes):
        cell = fit_box(im.crop(b), W // PX, H // PX, bottom)
        up(chunk_rgba(cell, n)).save(os.path.join(outdir, name + '.png'))
    if len(boxes) != len(names):
        print('주의: 덩어리', len(boxes), '이름', len(names))
    return len(boxes)


# ── 걷기 묶음: 3열×4행. 칸마다 가장 큰 덩어리만(옆 칸에서 넘어온 머리 조각 제거) ──
def cell_box(m, cell):
    sub = m.crop(cell)
    bs = components(sub, 300)
    if not bs:
        return None
    big = max(bs, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    keep = [b for b in bs if b is big or ((b[2] - b[0]) * (b[3] - b[1]) > 0.04 * (big[2] - big[0]) * (big[3] - big[1])
                                          and b[1] > 2 and b[3] < sub.height - 2)]
    return [cell[0] + min(b[0] for b in keep), cell[1] + min(b[1] for b in keep), cell[0] + max(b[2] for b in keep), cell[1] + max(b[3] for b in keep)]


def walk(src, dst, W=48, H=72, n=22, px=1):
    im = Image.open(src).convert('RGBA')
    m = mask_of(im)
    w0, h0 = im.size
    boxes = []
    for r in range(4):
        for c in range(3):
            cell = (c * w0 // 3, r * h0 // 4, (c + 1) * w0 // 3, (r + 1) * h0 // 4)
            boxes.append(cell_box(m, cell) or list(cell))
    # 칸 밖 덩어리를 지운 마스크로 다시 (칸 경계에 걸친 조각 제거)
    keep = Image.new('L', m.size, 0)
    for b in boxes:
        keep.paste(m.crop(b), (b[0], b[1]))
    im.putalpha(keep)
    w, h = W // px, H // px
    hmax = max(b[3] - b[1] for b in boxes)
    wmax = max(b[2] - b[0] for b in boxes)
    s = min((h - 2) / hmax, (w - 2) / wmax)
    atlas = Image.new('RGBA', (w * 3, h * 4), (0, 0, 0, 0))
    for i, b in enumerate(boxes):
        crop = im.crop(b)
        nw, nh = max(1, round(crop.width * s)), max(1, round(crop.height * s))
        small = crop.resize((nw, nh), Image.LANCZOS)
        cell = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        cell.paste(small, ((w - nw) // 2, h - 1 - nh), small)
        atlas.paste(chunk_rgba(cell, 40, pal=False, contrast=1.12, color=1.0, bright=1.08, sharp=False), ((i % 3) * w, (i // 3) * h))
    (atlas.resize((atlas.width * px, atlas.height * px), Image.NEAREST) if px > 1 else atlas).save(dst)


if __name__ == '__main__':
    mode, a = sys.argv[1], sys.argv[2:]
    if mode == 'portrait':
        portrait(a[0], a[1], int(a[2]) if len(a) > 2 else 96)
    elif mode == 'cg':
        cg(a[0], a[1], int(a[2]), int(a[3]))
    elif mode == 'walk':
        walk(a[0], a[1], int(a[2]), int(a[3]))
    elif mode == 'sprites':
        extra = a[5:]
        print('덩어리', sprites(a[0], a[1], a[2].split(','), int(a[3]), int(a[4]), bottom='--center' not in extra))
