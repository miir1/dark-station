"""크기 기준표 검사 (2026-10-24 회의 P0-A2·A3). tools/art_scale.json 을 읽어 v4/img 를 잰다. 실패가 있으면 종료 코드 1.

  python tools/check_scale.py

1. 손 물건: v4/img/props 에서 이름(상태 꼬리 _empty·_wet·_blood… 를 뗀 것)이 hand.items 에 있는 그림의 불투명 상자 긴 변 ≤ hand.max_long(12).
2. 수납 짝(pairs.props): 같은 줄의 그림끼리 캔버스 크기·바닥 줄(가장 아래 불투명 줄)이 같고,
   몸통 겹침이 가장 큰 가로 어긋남이 0 이어야 한다(±6px 안에서 찾음) → '기준점 차이 0'. 닫힘·열림이 1배에서 갈리도록 다른 픽셀 ≥8.
3. 상태 짝(pairs.states): 캔버스·바닥 줄이 같고, 서로 다른 픽셀이 state_min_diff(8) 이상(1배 화면에서 갈림).
4. drum_open 은 v3 props/drum 과 캔버스가 같다(화면이 그대로 바꿔 끼움).
5. 아이콘 v4/img/icons/*.png 는 40×40, 타일 v4/img/tiles/*.png 는 32×32(이어 붙는 좌석은 32×32).
6. 사람마다 앉기(v4/img/sit 32×128)·잠(v4/img/sleep 32×32): 머리 안 잘림·바닥 줄 31·사람끼리 다른 그림.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
IMG = os.path.join(ROOT, 'v4', 'img')
STATE_TAILS = ('_open', '_empty', '_wet', '_rot', '_blood', '_meat', '_moved')


def load(name, sub='props'):
    p = os.path.join(IMG, sub, name + '.png')
    return np.array(Image.open(p).convert('RGBA')) if os.path.exists(p) else None


def bottom(a):
    ys = np.where((a[:, :, 3] > 0).any(1))[0]
    return int(ys.max()) if len(ys) else -1


def bbox(a):
    ys, xs = np.where(a[:, :, 3] > 0)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else (0, 0, 0, 0)


def best_shift(a, b, r=6):
    """b 를 가로로 몇 px 밀어야 a 와 불투명 겹침이 가장 큰가 (같으면 0 을 고른다)."""
    ma, mb = a[:, :, 3] > 0, b[:, :, 3] > 0
    best, bs = -1, 0
    for s in sorted(range(-r, r + 1), key=abs):
        sh = np.roll(mb, s, axis=1)
        if s > 0:
            sh[:, :s] = False
        elif s < 0:
            sh[:, s:] = False
        v = int((ma & sh).sum())
        if v > best:
            best, bs = v, s
    return bs


def diff_px(a, b):
    oa, ob = a[:, :, 3] > 0, b[:, :, 3] > 0
    col = oa & ob & (np.abs(a[:, :, :3].astype(int) - b[:, :, :3].astype(int)).sum(2) > 0)
    return int((oa ^ ob).sum() + col.sum())


def main():
    S = json.load(open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8'))
    out, bad = [], 0
    # 1. 손 물건
    hand, lim = S['hand']['items'], S['hand']['max_long']
    pdir = os.path.join(IMG, 'props')
    names = sorted(f[:-4] for f in os.listdir(pdir) if f.endswith('.png')) if os.path.isdir(pdir) else []
    for n in names:
        base = n
        for t in STATE_TAILS:
            if base.endswith(t):
                base = base[: -len(t)]
        if base not in hand:
            continue
        x0, y0, x1, y1 = bbox(load(n))
        long_ = max(x1 - x0, y1 - y0)
        ok = long_ <= lim
        bad += 0 if ok else 1
        out.append(f'{"OK  " if ok else "FAIL"} 손 물건 {n:16s} {x1 - x0}×{y1 - y0} (긴 변 {long_} ≤ {lim})')
    # 2. 수납 짝
    for grp in S['pairs']['props']:
        have = [(n, load(n)) for n in grp if load(n) is not None]
        if len(have) < 2:
            out.append(f'--   짝 {"/".join(grp)}: 그림 {len(have)}장 (아직 없음)')
            continue
        n0, a0 = have[0]
        for n, a in have[1:]:
            same = a.shape == a0.shape
            by = (bottom(a0), bottom(a)) if same else None
            sh = best_shift(a0, a) if same else None
            dp = diff_px(a0, a) if same else -1
            ok = same and by[0] == by[1] and sh == 0 and dp >= S['pairs']['state_min_diff']
            bad += 0 if ok else 1
            out.append(f'{"OK  " if ok else "FAIL"} 짝 {n0}↔{n}: 캔버스 {a0.shape[1]}×{a0.shape[0]}/{a.shape[1]}×{a.shape[0]} 바닥 줄 {by} 가로 어긋남 {sh} 다른 픽셀 {dp}')
    # 3. 상태 짝
    need = S['pairs']['state_min_diff']
    for grp in S['pairs']['states']:
        have = [(n, load(n)) for n in grp if load(n) is not None]
        if len(have) < 2:
            out.append(f'--   상태 {"/".join(grp)}: 그림 {len(have)}장')
            continue
        for i in range(len(have)):
            for j in range(i + 1, len(have)):
                (na, a), (nb, b) = have[i], have[j]
                same = a.shape == b.shape
                d = diff_px(a, b) if same else -1
                ok = same and bottom(a) == bottom(b) and d >= need
                bad += 0 if ok else 1
                out.append(f'{"OK  " if ok else "FAIL"} 상태 {na}↔{nb}: 캔버스 같음 {same}, 바닥 줄 {bottom(a)}/{bottom(b)}, 다른 픽셀 {d} (≥{need})')
    # 4. drum_open
    d = load('drum_open')
    if d is not None:
        v3 = np.array(Image.open(os.path.join(ROOT, 'v3', 'img', 'props', 'drum.png')).convert('RGBA'))
        ok = d.shape == v3.shape and bottom(d) == bottom(v3)
        bad += 0 if ok else 1
        out.append(f'{"OK  " if ok else "FAIL"} drum_open: 캔버스 {d.shape[1]}×{d.shape[0]} = v3 drum {v3.shape[1]}×{v3.shape[0]}, 바닥 줄 {bottom(d)}/{bottom(v3)}')
    # 5. 아이콘·타일
    for sub, size in (('icons', (40, 40)), ('tiles', (32, 32))):
        dd = os.path.join(IMG, sub)
        if not os.path.isdir(dd):
            continue
        for f in sorted(os.listdir(dd)):
            if f.endswith('.png'):
                sz = Image.open(os.path.join(dd, f)).size
                ok = sz == size
                bad += 0 if ok else 1
                out.append(f'{"OK  " if ok else "FAIL"} {sub}/{f[:-4]} {sz[0]}×{sz[1]}')
    # 6. 사람마다 앉기·잠 (P1-2, tools/people_poses.py): 앉기 32×128(4칸), 칸마다 머리 꼭대기가 잘리지 않고(첫 불투명 줄 ≥1) 바닥 줄 31,
    #    잠 32×32. 서로 다른 사람의 같은 방향 칸이 같은 그림이 아니어야 한다(공용 실루엣 물들이기로 돌아가지 않게: 다른 픽셀 ≥ 60)
    P = S.get('poses')
    if P:
        cells = {}
        for sub, size in (('sit', (32, 128)), ('sleep', (32, 32))):
            dd = os.path.join(IMG, sub)
            if not os.path.isdir(dd):
                out.append(f'--   {sub}: 폴더 없음')
                continue
            for f in sorted(os.listdir(dd)):
                if not f.endswith('.png'):
                    continue
                a = np.array(Image.open(os.path.join(dd, f)).convert('RGBA'))
                ok = (a.shape[1], a.shape[0]) == size
                msg = f'{sub}/{f[:-4]} {a.shape[1]}×{a.shape[0]}'
                if ok and sub == 'sit':
                    tops, bots = [], []
                    for r in range(4):
                        c = a[r * 32:(r + 1) * 32]
                        ys = np.where((c[:, :, 3] > 40).any(1))[0]
                        tops.append(int(ys.min()))
                        bots.append(int(ys.max()))
                        cells.setdefault(r, []).append((f[:-4], c))
                    ok = min(tops) >= 1 and all(b == 31 for b in bots)
                    msg += f' 머리 꼭대기 줄 {tops} 바닥 줄 {bots}'
                bad += 0 if ok else 1
                out.append(f'{"OK  " if ok else "FAIL"} {msg}')
        for r, lst in cells.items():
            worst = min((diff_px(lst[i][1], lst[j][1]), lst[i][0], lst[j][0]) for i in range(len(lst)) for j in range(i + 1, len(lst))) if len(lst) > 1 else None
            if worst:
                ok = worst[0] >= 60
                bad += 0 if ok else 1
                out.append(f'{"OK  " if ok else "FAIL"} 앉기 {P["sit_rows"][r]} 칸: 가장 닮은 두 사람 {worst[1]}·{worst[2]} 다른 픽셀 {worst[0]} (≥60)')
    out.append(f'check_scale: 실패 {bad}')
    print('\n'.join(out))
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
