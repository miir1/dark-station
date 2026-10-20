"""Codex 아이콘 시트(분홍 바탕, 5열×3행 고정 칸) → v3/img/icons/<이름>.png (40×40, 게임 팔레트, 외곽선)

python tools/icons.py 시트.png 이름1,이름2,...(15개)
"""
import os
import sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import mask_of, quantize_rgba, outline, components  # noqa: E402

SIZE = 40
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v3', 'img', 'icons')


def fit_center(crop, W, pad=2):
    cw, ch = crop.size
    s = min((W - 2 * pad) / cw, (W - 2 * pad) / ch)
    nw, nh = max(1, round(cw * s)), max(1, round(ch * s))
    small = crop.resize((nw, nh), Image.BOX)
    c = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    c.paste(small, ((W - nw) // 2, (W - nh) // 2), small)
    return c


def run(src, names, cols=5, rows=3):
    im = Image.open(src).convert('RGBA')
    m = mask_of(im)
    im.putalpha(m)
    w, h = im.size
    os.makedirs(out, exist_ok=True)
    for i, name in enumerate(names):
        cx, cy = i % cols, i // cols
        box = (cx * w // cols, cy * h // rows, (cx + 1) * w // cols, (cy + 1) * h // rows)
        cell = im.crop(box)
        # 작은 얼룩은 빼고, 큰 덩어리들만 감싸는 상자
        boxes = components(cell.getchannel('A'), (cell.size[0] * cell.size[1]) // 60)
        bb = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)) if boxes else None
        if not bb:
            print('빈 칸', name)
            continue
        icon = outline(quantize_rgba(fit_center(cell.crop(bb), SIZE)))
        icon.save(os.path.join(out, name + '.png'))
        print('icon', name)


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2].split(','))
