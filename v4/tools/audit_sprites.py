# 검수용(2026-10-24 회의): 걷기 시트·소품·타일·초상·장면 그림의 크기와 칸 안 위치를 잰다. 파일을 고치지 않는다 — 읽기만.
# 쓰기: python v4/tools/audit_sprites.py   (C:\dev\dark_station 에서)  → 표준 출력 + docs/foundation/meeting_2026-10-24/audit_shots/sprites.json
import os, glob, json
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'audit_shots')
V3 = os.path.join(ROOT, 'v3', 'img')
V4 = os.path.join(ROOT, 'v4', 'img')
DIRS = ['down', 'left', 'right', 'up']
COLS = ['L', 'M', 'R']


def bbox(im):
    a = im.convert('RGBA').split()[3]
    return a.getbbox()


def colors(im, alpha_min=128):
    im = im.convert('RGBA')
    return len({p[:3] for p in im.getdata() if p[3] >= alpha_min})


def semi(im):
    im = im.convert('RGBA')
    px = list(im.getdata())
    n = sum(1 for p in px if 0 < p[3] < 255)
    return n, sum(1 for p in px if p[3] > 0)


def walk():
    out = {}
    for f in sorted(glob.glob(os.path.join(V3, 'walk', '*.png'))):
        name = os.path.basename(f)[:-4]
        im = Image.open(f).convert('RGBA')
        cw, ch = im.width // 3, im.height // 4
        rows = {}
        for r in range(4):
            cells = []
            for c in range(3):
                cell = im.crop((c * cw, r * ch, c * cw + cw, r * ch + ch))
                bb = bbox(cell)
                a = cell.split()[3]
                r0 = sum(1 for x in range(cw) if a.getpixel((x, 0)) > 0)              # 맨 윗줄에 닿은 불투명 픽셀 수(= 칸 위에서 잘렸을 가능성)
                l0 = sum(1 for y in range(ch) if a.getpixel((0, y)) > 0) + sum(1 for y in range(ch) if a.getpixel((cw - 1, y)) > 0)
                # 다른 칸과 같은지(걷기 동작이 실제로 다른 그림인지)
                cells.append({'col': COLS[c], 'top': bb[1] if bb else None, 'bottom': bb[3] - 1 if bb else None,
                              'x0': bb[0] if bb else None, 'x1': bb[2] - 1 if bb else None, 'row0_px': r0, 'side_px': l0,
                              'colors': colors(cell), 'hash': hash(cell.tobytes())})
            same = [cells[0]['hash'] == cells[1]['hash'], cells[1]['hash'] == cells[2]['hash'], cells[0]['hash'] == cells[2]['hash']]
            # 칸 사이 픽셀 차이(얼마나 다른 동작인가)
            def diff(a, b):
                A = im.crop((a * cw, r * ch, a * cw + cw, r * ch + ch)).load(); B = im.crop((b * cw, r * ch, b * cw + cw, r * ch + ch)).load()
                return sum(1 for y in range(ch) for x in range(cw) if A[x, y] != B[x, y])
            rows[DIRS[r]] = {'cells': cells, 'same': same, 'diff_LM': diff(0, 1), 'diff_MR': diff(1, 2), 'diff_LR': diff(0, 2)}
        out[name] = {'size': im.size, 'cell': [cw, ch], 'rows': rows}
    return out


def sizes(folder, pat='*.png'):
    out = {}
    for f in sorted(glob.glob(os.path.join(folder, pat))):
        im = Image.open(f)
        bb = bbox(im)
        sp, op = semi(im)
        out[os.path.basename(f)[:-4]] = {'size': im.size, 'bbox': bb, 'bbox_wh': [bb[2] - bb[0], bb[3] - bb[1]] if bb else None,
                                          'colors': colors(im), 'semi_alpha_px': sp, 'opaque_px': op}
    return out


def main():
    os.makedirs(OUTD, exist_ok=True)
    res = {'walk': walk(), 'sprites': sizes(os.path.join(V3, 'sprites')), 'props': sizes(os.path.join(V3, 'props')),
           'tiles': sizes(os.path.join(V3, 'tiles')), 'portraits': sizes(os.path.join(V3, 'portraits')),
           'portraits_hurt': sizes(os.path.join(V3, 'portraits_hurt')), 'cg_v3': sizes(os.path.join(V3, 'cg')),
           'cg_v4': sizes(os.path.join(V4, 'cg')), 'traces': sizes(os.path.join(V4, 'traces')), 'poses': sizes(os.path.join(V4, 'poses')),
           'icons': sizes(os.path.join(V3, 'icons'))}
    for k, w in res['walk'].items():
        print('WALK', k, w['size'], 'cell', w['cell'])
        for d, r in w['rows'].items():
            print('   %-5s' % d, ' | '.join('%s top=%s bot=%s x=%s-%s r0=%d side=%d col=%d' % (c['col'], c['top'], c['bottom'], c['x0'], c['x1'], c['row0_px'], c['side_px'], c['colors']) for c in r['cells']),
                  ' diff L-M %d M-R %d L-R %d' % (r['diff_LM'], r['diff_MR'], r['diff_LR']))
    for grp in ('props', 'traces', 'poses', 'sprites'):
        print('==', grp)
        for k, v in res[grp].items():
            print('   %-12s size=%s bbox_wh=%s colors=%d semi=%d/%d' % (k, v['size'], v['bbox_wh'], v['colors'], v['semi_alpha_px'], v['opaque_px']))
    for grp in ('tiles', 'portraits', 'portraits_hurt', 'cg_v3', 'cg_v4', 'icons'):
        szs = {}
        for k, v in res[grp].items():
            szs.setdefault(tuple(v['size']), []).append(k)
        print('==', grp, {str(s): len(n) for s, n in szs.items()})
        for s, n in szs.items():
            if len(szs) > 1:
                print('     ', s, n[:12])
    for w in res['walk'].values():
        for r in w['rows'].values():
            for c in r['cells']:
                c.pop('hash', None)
    with open(os.path.join(OUTD, 'sprites.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
