"""걷기 그림 다시 자르기 (2026-10-24 회의 P0-A1). tools/chunky.py walk 를 대신한다.

옛 방식은 원본 시트를 고른 3×4 칸으로 잘라서, 칸 선을 넘은 머리가 잘려 나갔다(위로 걸으면 머리가 없음).
새 방식은 칸 선을 무시하고 '이어진 픽셀 덩어리(사람 하나)' 12개를 찾아 통째로 쓴다.

  python tools/walk_recut.py                 9명 전부 → v4/img/walk/<id>.png (96×192 = 32×48 칸 3열×4행)
  python tools/walk_recut.py player mari     몇 명만
  python tools/walk_recut.py --no-composite  상체 고정 합성 끄기(비교용)

규칙
- 줄(위→아래): 아래·왼·오른·위 보기 / 칸(왼→오른): 왼발·섬·오른발 — 원본 시트 배치 그대로.
- 키: 섬(가운데) 칸의 키를 키 표(tools/art_scale.json people.height)에 맞춘다. 외곽선 포함, 칸 높이 48에서 상한 46.
  원본은 같은 사람도 방향마다 그린 크기가 다르다(최대 15%). 그래서 배율은 '방향 줄마다 하나'로 정해
  네 방향의 섬 칸 키를 똑같이 맞춘다(같은 줄의 세 장은 같은 배율 — 걷는 장의 자연스러운 키 차이는 남긴다).
- 자리: 발바닥 선(가장 아래 불투명 줄, 외곽선 포함)을 칸 y=47 에, 머리 가운데(위 20% 줄의 무게중심)를 칸 x=16 에.
- 색: chunky.py walk 와 같은 처리(tone → 그림 고유 40색 → 알파 120 문턱 → 가장 어두운 색 외곽선).
  색 줄이기는 칸마다가 아니라 사람 한 장 전체로 한 번 한다(장끼리 색이 깜빡이지 않게).
- 몸 폭 출렁임: 같은 줄 이웃 장(섬↔발)의 다른 픽셀이 300 을 넘으면 '상체 고정 합성'(섬 칸 머리 꼭대기부터 22줄을 발 칸에 덮기).
  합성 뒤 몸에서 떨어진 작은 조각(위팔을 잃고 떠 있는 손 ≤24px)은 지우고, 허리 이음매(덮은 마지막 줄과 그 아래 줄의
  좌우 끝 차이 ≤4px, 큰 조각 없음)를 통과한 장에만 합성을 쓴다. 통과 못 한 장은 원래 그림 그대로 둔다. 모두 기록한다.
- 기철: 모자 앞에 헤드램프 2px(밝은 노랑)을 덧칠한다(아래·왼·오른 보기. 위 보기는 뒤통수라 없음).
- 기록: art_src/walk_recut_log.json (사람별 배율·이웃 차이·합성·이음매).
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
from sheet import mask_of  # noqa: E402
from chunky import tone, reduce_colors  # noqa: E402
from sheet import darkest  # noqa: E402

SRC = os.path.join(ROOT, 'art_src', 'walk')
OUT = os.path.join(ROOT, 'v4', 'img', 'walk')
LOG = os.path.join(ROOT, 'art_src', 'walk_recut_log.json')
CW, CH = 32, 48
FOOT_Y = 47                 # 발바닥 선(외곽선 포함 가장 아래 불투명 줄)
HEAD_X = 16                 # 머리 가운데가 올 x
DIFF_MAX = 300              # 이웃 장 다른 픽셀 상한
LOCK_ROWS = 22              # 상체 고정 합성: 섬 칸 머리 꼭대기부터 몇 줄
DIRS = ['down', 'left', 'right', 'up']
COLS = ['L', 'M', 'R']
LAMP = (255, 232, 120, 255)  # 헤드램프 (밝은 노랑)


def scale_table():
    with open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8') as f:
        return json.load(f)['people']['height']


# ── 1. 덩어리 12개 찾기 ──
def figures(im):
    """분홍 바탕을 걷어낸 마스크에서 사람 덩어리 12개의 (마스크, 상자). 작은 조각은 가장 가까운 큰 덩어리에 붙인다.
    두 사람이 붙어 11개가 되면 가장 키 큰 덩어리를 '마스크 폭이 가장 좁은 줄'에서 끊어 본다."""
    m = np.array(mask_of(im)) > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    order = np.argsort(-sizes)
    big = [int(i) + 1 for i in order if sizes[i] >= 0.25 * sizes[order[0]]]
    small = [i for i in range(1, n + 1) if i not in big]
    # 작은 조각 → 가장 가까운 큰 덩어리(무게중심 거리)
    cent = {i: np.array(ndimage.center_of_mass(m, lab, i)) for i in range(1, n + 1)}
    for s in small:
        near = min(big, key=lambda b: np.linalg.norm(cent[s] - cent[b]))
        lab[lab == s] = near
    masks = [lab == b for b in big]
    note = ''
    while len(masks) < 12:                      # 붙은 그림 끊기
        hs = [np.ptp(np.where(mk.any(1))[0]) for mk in masks]
        k = int(np.argmax(hs))
        mk = masks.pop(k)
        ys = np.where(mk.any(1))[0]
        y0, y1 = ys.min(), ys.max()
        mid = (y0 + y1) // 2
        widths = mk.sum(1)
        lo, hi = mid - (y1 - y0) // 6, mid + (y1 - y0) // 6
        cut = lo + int(np.argmin(widths[lo:hi]))
        a, b = mk.copy(), mk.copy()
        a[cut:] = False
        b[:cut] = False
        masks += [a, b]
        note += f'붙은 덩어리 y{y0}-{y1} 를 y{cut}(폭 {int(widths[cut])}px)에서 끊음; '
    if len(masks) != 12:
        raise SystemExit(f'덩어리 {len(masks)}개 — 12개가 아니다')
    boxes = []
    for mk in masks:
        ys, xs = np.where(mk)
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # 위→아래 4줄, 줄 안 왼→오른
    idx = sorted(range(12), key=lambda i: (boxes[i][1] + boxes[i][3]) / 2)
    grid = []
    for r in range(4):
        row = sorted(idx[r * 3:(r + 1) * 3], key=lambda i: (boxes[i][0] + boxes[i][2]) / 2)
        grid.append([(masks[i], boxes[i]) for i in row])
    return grid, note


# ── 2. 한 장 줄이기 ──
def shrink(im, mk, box, s):
    """원본 덩어리(마스크 밖은 투명)를 배율 s 로 줄인 RGBA. 알파는 아직 문턱 전."""
    x0, y0, x1, y1 = box
    crop = im.crop(box).copy()
    a = Image.fromarray((mk[y0:y1, x0:x1] * 255).astype(np.uint8))
    crop.putalpha(a)
    nw, nh = max(1, round(crop.width * s)), max(1, round(crop.height * s))
    return crop.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')


def opaque_rows(small):
    a = np.array(small.getchannel('A')) > 120
    ys = np.where(a.any(1))[0]
    return (ys.min(), ys.max()) if len(ys) else (0, 0)


def fit_scale(im, mk, box, target):
    """문턱(120) 뒤 키가 정확히 target 이 되는 배율 (외곽선 2줄 빼고 target-2)."""
    want = target - 2
    h0 = box[3] - box[1]
    lo, hi = (want - 1.5) / h0, (want + 1.5) / h0
    best = None
    for k in range(41):
        s = lo + (hi - lo) * k / 40
        t, b = opaque_rows(shrink(im, mk, box, s))
        h = b - t + 1
        if h == want and (best is None or abs(s - want / h0) < abs(best - want / h0)):
            best = s
    return best if best is not None else want / h0


def head_cx(alpha):
    """위 20% 줄 불투명 픽셀의 가로 무게중심."""
    ys, xs = np.where(alpha)
    top, bot = ys.min(), ys.max()
    sel = ys <= top + max(2, int((bot - top) * 0.2))
    return float(xs[sel].mean())


def place(small):
    """줄인 그림 → 32×48 칸. 발바닥(외곽선 전 가장 아래 줄)을 y=46, 머리 가운데를 x=16. 넘치면 안쪽으로 민다."""
    a = np.array(small.getchannel('A')) > 120
    ys, xs = np.where(a)
    top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    cx = head_cx(a)
    ox = int(round(HEAD_X - 0.5 - cx))
    oy = (FOOT_Y - 1) - bot
    clamp = 0
    if ox + left < 2:                         # 외곽선까지 칸 안쪽 1px 여백 (x 1~30)
        clamp = 2 - (ox + left)
        ox += clamp
    if ox + right > CW - 3:
        clamp = (CW - 3) - (ox + right)
        ox += clamp
    lost = max(0, 1 - (oy + top))            # 위로 넘쳐 잘리는 줄 수 (외곽선 자리 1줄 포함)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cell.paste(small, (ox, oy))                 # 빈 칸이므로 그대로 복사(마스크로 붙이면 알파가 제곱돼 가장자리가 깎인다)
    return cell, {'clamp_x': int(clamp), 'lost_top': int(lost), 'w': int(right - left + 1), 'h': int(bot - top + 1)}


# ── 3. 색·외곽선 ──
def outline_np(rgba, color):
    a = rgba[:, :, 3] > 0
    nb = np.zeros_like(a)
    nb[1:, :] |= a[:-1, :]
    nb[:-1, :] |= a[1:, :]
    nb[:, 1:] |= a[:, :-1]
    nb[:, :-1] |= a[:, 1:]
    ring = nb & ~a
    out = rgba.copy()
    out[ring] = list(color) + [255]
    return out


def cells_of(atlas):
    return [[atlas[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] for c in range(3)] for r in range(4)]


def diff_px(a, b):
    """다른 픽셀 수: 한쪽만 불투명이거나 둘 다 불투명인데 색이 다름."""
    oa, ob = a[:, :, 3] > 0, b[:, :, 3] > 0
    both = oa & ob
    colour = both & (np.abs(a[:, :, :3].astype(int) - b[:, :, :3].astype(int)).sum(2) > 0)
    return int((oa ^ ob).sum() + colour.sum())


def top_row(cell):
    ys = np.where((cell[:, :, 3] > 0).any(1))[0]
    return int(ys.min()) if len(ys) else -1


def row_extent(cell, y):
    xs = np.where(cell[y, :, 3] > 0)[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None


def lock_upper(stand, step, rows=LOCK_ROWS):
    """섬 칸의 머리 꼭대기부터 rows 줄을 발 칸에 덮는다(그 줄들의 발 칸 픽셀은 지움). 외곽선 전 단계에서 쓴다."""
    t = top_row(stand)
    y = t + rows
    out = step.copy()
    out[:y] = 0
    out[t:y] = stand[t:y]
    return out, y


def seam(cell, y):
    """허리 이음매: y-1 줄(덮은 마지막 줄)과 y 줄의 좌우 끝 차이."""
    a, b = row_extent(cell, y - 1), row_extent(cell, y)
    if not a or not b:
        return None
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]))


SEAM_MAX = 4                # 허리 이음매 좌우 끝 차이 상한
ISLAND_MAX = 24             # 합성 뒤 몸에서 떨어진 조각(떠 있는 손 등)을 지우는 크기 상한


def drop_islands(cell):
    """합성 뒤 몸통과 이어지지 않은 작은 조각(아래로 흔들던 팔뚝이 위팔을 잃고 떠 있는 것)을 지운다. 지운 픽셀 수."""
    a = cell[:, :, 3] > 0
    lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    if n <= 1:
        return cell, 0, 0
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    out = cell.copy()
    gone, big = 0, 0
    for i in range(1, n + 1):
        if i == main:
            continue
        if sizes[i - 1] <= ISLAND_MAX:
            out[lab == i] = 0
            gone += int(sizes[i - 1])
        else:
            big += 1
    return out, gone, big


def try_lock(stand, step):
    """상체 고정 합성을 해 보고 허리 이음매 검사를 통과하면 합성 그림, 아니면 None. (기록용 정보 함께)"""
    out, y = lock_upper(stand, step)
    out, gone, big = drop_islands(out)
    dx = seam(out, y)
    ok = big == 0 and dx is not None and dx <= SEAM_MAX
    return (out if ok else None), {'seam_y': y, 'seam_dx': dx, 'island_px': gone, 'big_islands': big, 'ok': ok}


def lamp(cell, d):
    """기철 헤드램프 2px. 머리 꼭대기 아래 모자 챙 줄에서 앞쪽 끝."""
    t = top_row(cell)
    if d == 'up' or t < 0:
        return cell
    out = cell.copy()
    y = t + 4                                        # 모자 앞 (꼭대기에서 4줄 아래 = 챙 위)
    ext = row_extent(out, y)
    if not ext:
        return out
    if d == 'down':
        x = (ext[0] + ext[1]) // 2
        out[y, x - 1:x + 1] = LAMP
    elif d == 'left':
        x = ext[0] + 1                              # 앞(왼쪽) 끝, 외곽선 안쪽 1px
        out[y:y + 2, x] = LAMP
    else:
        x = ext[1] - 1
        out[y:y + 2, x] = LAMP
    return out


def build(pid, heights, composite=True):
    src = os.path.join(SRC, pid + '.png')
    im = Image.open(src).convert('RGBA')
    grid, note = figures(im)
    target = int(heights[pid])
    atlas = Image.new('RGBA', (CW * 3, CH * 4), (0, 0, 0, 0))
    rec = {'target': target, 'note': note, 'rows': {}}
    for r, row in enumerate(grid):
        mk, box = row[1]
        s = fit_scale(im, mk, box, target)
        info = []
        for c, (mk2, box2) in enumerate(row):
            small = shrink(im, mk2, box2, s)
            cell, meta = place(small)
            atlas.paste(cell, (c * CW, r * CH))
            meta['src_h'] = int(box2[3] - box2[1])
            info.append(meta)
        rec['rows'][DIRS[r]] = {'scale': round(s, 5), 'cells': info}
    # 색: 사람 한 장 전체로 한 번 (chunky.walk 와 같은 값)
    alpha = atlas.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    rgb = reduce_colors(tone(atlas, contrast=1.12, color=1.0, bright=1.08, sharp=False), 40, pal=False)
    rgb.putalpha(alpha)
    arr = np.array(rgb)
    arr[arr[:, :, 3] == 0] = 0
    ink = darkest(rgb)
    cells = cells_of(arr)
    # 몸 폭 출렁임 → 상체 고정 합성 (외곽선 전 비교: 외곽선은 모양을 따라가므로 같은 결론)
    for r in range(4):
        L, M, R = cells[r]
        d0 = {'LM': diff_px(outline_np(L, ink), outline_np(M, ink)), 'MR': diff_px(outline_np(M, ink), outline_np(R, ink))}
        rr = rec['rows'][DIRS[r]]
        rr['diff_before'] = d0
        rr['composite'] = False
        if composite and max(d0.values()) > DIFF_MAX:
            rr['lock'] = {}
            for c, side in ((0, 'L'), (2, 'R')):
                got, info = try_lock(M, cells[r][c])
                rr['lock'][side] = info
                if got is not None:
                    cells[r][c] = got
            rr['composite'] = any(v['ok'] for v in rr['lock'].values())
    # 외곽선 + 기철 램프
    for r in range(4):
        for c in range(3):
            cell = outline_np(cells[r][c], ink)
            if pid == 'gicheol':
                cell = lamp(cell, DIRS[r])
            cells[r][c] = cell
            arr[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = cell
    for r in range(4):
        L, M, R = cells[r]
        rec['rows'][DIRS[r]]['diff_after'] = {'LM': diff_px(L, M), 'MR': diff_px(M, R)}
        rec['rows'][DIRS[r]]['stand_top'] = top_row(M)
        rec['rows'][DIRS[r]]['stand_h'] = CH - top_row(M)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(arr).save(os.path.join(OUT, pid + '.png'))
    return rec


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    composite = '--no-composite' not in sys.argv
    heights = scale_table()
    ids = args or sorted(heights)
    log = {}
    if os.path.exists(LOG):
        try:
            with open(LOG, encoding='utf-8') as f:
                log = json.load(f)
        except Exception:
            log = {}
    for pid in ids:
        rec = build(pid, heights, composite)
        log[pid] = rec
        tops = [rec['rows'][d]['stand_top'] for d in DIRS]
        comp = [d for d in DIRS if rec['rows'][d]['composite']]
        da = max(max(rec['rows'][d]['diff_after'].values()) for d in DIRS)
        lost = sum(c['lost_top'] for d in DIRS for c in rec['rows'][d]['cells'])
        print(f'{pid:8s} 키 {rec["target"]}  섬 머리 꼭대기 {tops}  잘림 {lost}px  합성 {comp or "-"}  이웃 차이 최대 {da}  {rec["note"]}')
    with open(LOG, 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
