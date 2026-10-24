# 검수용(2026-10-24 회의): 걷기 원본 시트(art_src/walk, Codex 생성 1086×1448)를 tools/chunky.py walk 와 같은 '고른 칸'으로 나눴을 때
# 사람 그림이 칸 경계(위/아래)를 넘는지 잰다. 넘으면 chunky.walk 가 칸 밖 조각을 지우므로 머리·발이 잘린다.
# 읽기만 한다. 쓰기: python v4/tools/audit_walk_src.py  → 표준 출력 + audit_shots/walk_src_<id>.png(원본 축소 + 칸 경계 빨간 선 + 넘은 곳 노란 표시)
#                                                         + audit_shots/walk_final_x4.png(게임이 쓰는 v3/img/walk 4배, 칸 맨 윗줄 빨간 선)
import os, sys, glob
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from sheet import mask_of  # noqa: E402

OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'audit_shots')
DIRS = ['down', 'left', 'right', 'up']
COLS = ['L', 'M', 'R']


def main():
    os.makedirs(OUTD, exist_ok=True)
    only = sys.argv[1:]
    for f in sorted(glob.glob(os.path.join(ROOT, 'art_src', 'walk', '*.png'))):
        name = os.path.basename(f)[:-4]
        if only and name not in only:
            continue
        im = Image.open(f).convert('RGBA')
        m = mask_of(im)
        w0, h0 = im.size
        mp = m.load()
        rep = []
        vis = im.convert('RGB').copy()
        d = ImageDraw.Draw(vis)
        for r in range(4):
            for c in range(3):
                x0, y0, x1, y1 = c * w0 // 3, r * h0 // 4, (c + 1) * w0 // 3, (r + 1) * h0 // 4
                # 칸 위 경계: 경계 바로 위·아래 줄 모두 그림이면 '넘음'
                top_cross = [x for x in range(x0, x1) if y0 > 0 and mp[x, y0] and mp[x, y0 - 1]]
                bot_cross = [x for x in range(x0, x1) if y1 < h0 and mp[x, y1 - 1] and mp[x, y1]]
                # 그림이 칸 위로 얼마나 넘었나(같은 열에서 경계 위로 이어지는 픽셀 수, 최대)
                over = 0
                for x in top_cross:
                    k = 0
                    while y0 - 1 - k >= 0 and mp[x, y0 - 1 - k]:
                        k += 1
                    over = max(over, k)
                rep.append((DIRS[r], COLS[c], len(top_cross), over, len(bot_cross)))
                for x in top_cross:
                    d.point((x, y0), fill=(255, 255, 0))
            d.line([(0, r * h0 // 4), (w0, r * h0 // 4)], fill=(255, 0, 0), width=3)
        for c in range(1, 3):
            d.line([(c * w0 // 3, 0), (c * w0 // 3, h0)], fill=(255, 0, 0), width=3)
        vis.resize((w0 // 2, h0 // 2), Image.LANCZOS).save(os.path.join(OUTD, f'walk_src_{name}.png'))
        bad = [x for x in rep if x[2] or x[4]]
        print(name, 'cells crossing grid:', len(bad))
        for dr, cl, n, over, nb in bad:
            print(f'   {dr:5s} {cl}  top-cross px={n:3d} (over by {over:3d}px src)  bottom-cross px={nb}')
    # 게임이 쓰는 최종 시트 4배 + 칸 맨 윗줄 표시 — v4/img/walk(덩어리 단위로 다시 자른 것, P0-A1)가 있으면 그것(끝 증거는 after_shots), 없으면 v3
    v4w = sorted(glob.glob(os.path.join(ROOT, 'v4', 'img', 'walk', '*.png')))
    fs = v4w or sorted(glob.glob(os.path.join(ROOT, 'v3', 'img', 'walk', '*.png')))
    final = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots', 'screen_walk_final_x4.png') if v4w else os.path.join(OUTD, 'walk_final_x4.png')
    touching = 0
    K = 4
    sheet = Image.new('RGB', (len(fs) * (96 * K + 16), 192 * K + 30), (40, 40, 40))
    dd = ImageDraw.Draw(sheet)
    for i, f in enumerate(fs):
        w = Image.open(f).convert('RGBA')
        bg = Image.new('RGBA', w.size, (90, 90, 90, 255))
        bg.alpha_composite(w)
        big = bg.resize((96 * K, 192 * K), Image.NEAREST)
        ox = i * (96 * K + 16)
        sheet.paste(big.convert('RGB'), (ox, 30))
        a = w.split()[3]
        for r in range(4):
            for c in range(3):
                hit = sum(1 for x in range(32) if a.getpixel((c * 32 + x, r * 48)) > 0)
                touching += 1 if hit else 0
                col = (255, 40, 40) if hit else (60, 160, 60)
                dd.line([(ox + c * 32 * K, 30 + r * 48 * K), (ox + (c + 1) * 32 * K - 1, 30 + r * 48 * K)], fill=col, width=2)
        dd.text((ox + 4, 8), os.path.basename(f)[:-4], fill=(255, 255, 255))
    os.makedirs(os.path.dirname(final), exist_ok=True)
    sheet.save(final)
    print('final sheets:', 'v4/img/walk' if v4w else 'v3/img/walk', len(fs), '· cells whose top row is opaque (head cut):', touching)
    print('saved', final)


if __name__ == '__main__':
    main()
