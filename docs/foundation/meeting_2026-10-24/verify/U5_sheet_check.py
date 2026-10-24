# U5 verify: pixel analysis of v4/img/walk sheets (read only)
import os, sys, glob, json
from PIL import Image, ImageDraw
ROOT = r'C:\dev\dark_station'
OUT = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'verify')
DIRS = ['down', 'left', 'right', 'up']; COLS = ['L', 'M', 'R']
A = 40
def comps(px, w, h):
    seen = set(); out = []
    for y in range(h):
        for x in range(w):
            if px[x][y] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); pts = []
                while st:
                    a, b = st.pop(); pts.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            u, v = a + dx, b + dy
                            if 0 <= u < w and 0 <= v < h and px[u][v] and (u, v) not in seen:
                                seen.add((u, v)); st.append((u, v))
                out.append(pts)
    return out
rep = {}
K = 6
files = sorted(glob.glob(os.path.join(ROOT, 'v4', 'img', 'walk', '*.png')))
sheet = Image.new('RGB', (len(files) * (96 * K + 12), 192 * K + 24), (25, 25, 25))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    name = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGBA'); W, H = im.size; cw, ch = W // 3, H // 4
    a = im.split()[3].load()
    cells = {}
    for r in range(4):
        for c in range(3):
            px = [[a[c * cw + x, r * ch + y] > A for y in range(ch)] for x in range(cw)]
            cs = comps(px, cw, ch)
            cs.sort(key=len, reverse=True)
            ys = [y for x in range(cw) for y in range(ch) if px[x][y]]
            xs = [x for x in range(cw) for y in range(ch) if px[x][y]]
            top = min(ys) if ys else None; bot = max(ys) if ys else None
            # semi-transparent pixels count (antialias leftovers)
            semi = sum(1 for x in range(cw) for y in range(ch) if 0 < a[c * cw + x, r * ch + y] < 255)
            cells[f'{DIRS[r]}/{COLS[c]}'] = {
                'top': top, 'bottom': bot, 'height': (bot - top + 1) if ys else 0,
                'xmin': min(xs) if xs else None, 'xmax': max(xs) if xs else None,
                'row0_opaque': sum(1 for x in range(cw) if px[x][0]),
                'col0_opaque': sum(1 for y in range(ch) if px[0][y]), 'col31_opaque': sum(1 for y in range(ch) if px[cw - 1][y]),
                'row47_opaque': sum(1 for x in range(cw) if px[x][ch - 1]),
                'n_components': len(cs), 'comp_sizes': [len(x) for x in cs[:6]],
                'stray': [{'size': len(x), 'bbox': [min(p[0] for p in x), min(p[1] for p in x), max(p[0] for p in x), max(p[1] for p in x)]} for x in cs[1:] if len(x) >= 1][:8],
                'semi_alpha_px': semi,
            }
    rep[name] = cells
    bg = Image.new('RGBA', im.size, (110, 110, 110, 255)); bg.alpha_composite(im)
    big = bg.convert('RGB').resize((W * K, H * K), Image.NEAREST)
    ox = i * (96 * K + 12)
    sheet.paste(big, (ox, 24))
    for r in range(5):
        d.line([(ox, 24 + r * ch * K), (ox + W * K, 24 + r * ch * K)], fill=(255, 0, 0), width=1)
    for c in range(4):
        d.line([(ox + c * cw * K, 24), (ox + c * cw * K, 24 + H * K)], fill=(255, 0, 0), width=1)
    d.text((ox + 4, 4), name, fill=(255, 255, 255))
sheet.save(os.path.join(OUT, 'U5_sheets_x6.png'))
json.dump(rep, open(os.path.join(OUT, 'U5_sheet_cells.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# summary
for n, cells in rep.items():
    probs = []
    for k, v in cells.items():
        if v['row0_opaque'] or v['col0_opaque'] or v['col31_opaque']: probs.append(f"{k} edge r0={v['row0_opaque']} c0={v['col0_opaque']} c31={v['col31_opaque']}")
        if v['n_components'] > 1: probs.append(f"{k} comps={v['comp_sizes']} stray={v['stray']}")
    tops = {k: v['top'] for k, v in cells.items()}
    bots = {k: v['bottom'] for k, v in cells.items()}
    print(n, 'tops', tops)
    print('   bottoms', bots)
    for p in probs: print('   !', p)
