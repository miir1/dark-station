"""초상 80·작은 장면 그림 256×144를 원본에서 다시 뽑고, 꿈 그림 4장을 48색으로 (2026-10-24 회의 P0-A4). Codex 0회.

  python tools/portrait_cg_v4.py            전부
  python tools/portrait_cg_v4.py --list     장면 그림 목록만 보기

- 초상: art_src/portraits·portraits_hurt → v4/img/portraits80/·portraits80_hurt/ (chunky.py portrait … 80, 28색)
  CSS 로 96→80 줄이지 않도록 80px 원본을 따로 만든다.
- 작은 장면 그림: 게임이 실제로 띄우는 장면 그림 전부 → v4/img/cg_s/<파일 이름>.png (chunky.py cg … 256 144, 48색)
  '쓰이는 그림'은 v4/art.js 의 찾는 순서(cgKey)를 그대로 따라 events.json 의 image·사건 id, 사망 그림(DEATH_V3),
  정체 그림(IDENT_CG), 타이틀을 풀어서 정한다. v4/img/cg/X 와 v3 cg/X 는 모두 cg_s/X 가 된다(이름이 겹치지 않음).
  원본: v4 그림은 art_src/cg_v3, v3 그림은 art_src/cg, 꿈 그림은 art_src/cg_dream(차가운 색조판).
- 꿈 그림: v4/img/cg/dream_* 4장은 원본(art_src/cg_v3, 따뜻한 색)에 차가운 색조를 따로 입힌 판이라 400~750색이었다.
  처음 한 번 그 판을 art_src/cg_dream 에 보관하고, 그것을 chunky cg 48색으로 다시 거쳐 v4/img/cg 에 덮어쓴다(색조 유지).
"""
import json
import os
import re
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
import chunky  # noqa: E402

V4IMG = os.path.join(ROOT, 'v4', 'img')
SRC = os.path.join(ROOT, 'art_src')
DREAMS = ['dream_cab', 'dream_punch', 'dream_seat', 'dream_stairs']


def js_table(text, name):
    m = re.search(r'const ' + name + r' = \{(.*?)\};', text, re.S)
    return dict(re.findall(r"(\w+): '([^']*)'", m.group(1))) if m else {}


def used_cgs():
    art = open(os.path.join(ROOT, 'v4', 'art.js'), encoding='utf-8').read()
    V4_ALIAS, CG_ALIAS, EV_V3 = js_table(art, 'V4_ALIAS'), js_table(art, 'CG_ALIAS'), js_table(art, 'EV_V3')
    DEATH_V3, IDENT_CG = js_table(art, 'DEATH_V3'), js_table(art, 'IDENT_CG')
    v4 = set(json.load(open(os.path.join(V4IMG, 'manifest.json'), encoding='utf-8')))
    v3 = set(json.load(open(os.path.join(ROOT, 'v3', 'img', 'manifest.json'), encoding='utf-8')))
    v3 = {n for n in v3 if not re.match(r'^(gods|cg/(affl_|.*_(omen|advent)))', n)}     # art.js 가 v3 에서 안 읽는 것

    def key(i, ev=None):
        if i and 'cg/' + i in v4:
            return ('v4', i)
        if ev and 'cg/' + ev in v4:
            return ('v4', ev)
        if i and i in V4_ALIAS and 'cg/' + V4_ALIAS[i] in v4:
            return ('v4', V4_ALIAS[i])
        if not i:
            return None
        if ev and ev in EV_V3 and 'cg/' + EV_V3[ev] in v3:
            return ('v3', EV_V3[ev])
        a = CG_ALIAS[i] if i in CG_ALIAS else re.sub(r'^(cg|scene)_', '', i)
        return ('v3', a) if a and 'cg/' + a in v3 else None

    found = {}
    for e in json.load(open(os.path.join(ROOT, 'v4', 'data', 'events.json'), encoding='utf-8')):
        k = key(e.get('image') or '', e['id'])
        if k:
            found.setdefault(k, []).append(e['id'])
    for kind, alt in DEATH_V3.items():                                  # 당신 사망 그림
        k = ('v4', kind) if 'cg/' + kind in v4 else ('v3', alt) if 'cg/' + alt in v3 else None
        if k:
            found.setdefault(k, []).append('death:' + kind)
    if 'cg/n_dark' in v3:
        found.setdefault(('v3', 'n_dark'), []).append('death:기타')
    for cand, f in IDENT_CG.items():                                    # 정체 → 꿈·밝혀짐 그림
        k = ('v4', f) if 'cg/' + f in v4 else ('v3', f) if 'cg/' + f in v3 else None
        if k:
            found.setdefault(k, []).append('ident:' + cand)
    k = key('title')
    if k:
        found.setdefault(k, []).append('title')
    return found


def src_of(where, name):
    if where == 'v4':
        if name in DREAMS:
            return os.path.join(SRC, 'cg_dream', name + '.png')
        return os.path.join(SRC, 'cg_v3', name + '.png')
    return os.path.join(SRC, 'cg', name + '.png')


def colors(path):
    return len(np.unique(np.array(Image.open(path).convert('RGB')).reshape(-1, 3), axis=0))


def main():
    found = used_cgs()
    if '--list' in sys.argv:
        for (w, n), evs in sorted(found.items()):
            print(f'{w} {n:22s} ← {", ".join(evs)}')
        print(len(found), '장')
        return
    # 1. 꿈 그림: 차가운 색조판 보관(처음 한 번) → 48색으로 다시
    os.makedirs(os.path.join(SRC, 'cg_dream'), exist_ok=True)
    for n in DREAMS:
        keep = os.path.join(SRC, 'cg_dream', n + '.png')
        cur = os.path.join(V4IMG, 'cg', n + '.png')
        if not os.path.exists(keep):
            shutil.copyfile(cur, keep)
        chunky.cg(keep, cur, 384, 216)
        print(f'꿈 {n}: {colors(cur)}색 (≤48)')
    # 2. 초상 80
    n80 = 0
    for sub in ('portraits', 'portraits_hurt'):
        od = os.path.join(V4IMG, sub.replace('portraits', 'portraits80'))
        os.makedirs(od, exist_ok=True)
        for f in sorted(os.listdir(os.path.join(SRC, sub))):
            if f.endswith('.png'):
                chunky.portrait(os.path.join(SRC, sub, f), os.path.join(od, f), 80)
                n80 += 1
    print('초상 80:', len(os.listdir(os.path.join(V4IMG, 'portraits80'))), '+ 다친 초상 80:', len(os.listdir(os.path.join(V4IMG, 'portraits80_hurt'))))
    # 3. 작은 장면 그림
    od = os.path.join(V4IMG, 'cg_s')
    os.makedirs(od, exist_ok=True)
    want = {n for (_, n) in found}
    for f in os.listdir(od):                         # 더 이상 안 쓰는 판은 치운다(cg_s 안에서만)
        if f.endswith('.png') and f[:-4] not in want:
            os.remove(os.path.join(od, f))
    miss = []
    for (w, n), evs in sorted(found.items()):
        s = src_of(w, n)
        if not os.path.exists(s):
            miss.append(n)
            continue
        chunky.cg(s, os.path.join(od, n + '.png'), 256, 144)
    got = len([f for f in os.listdir(od) if f.endswith('.png')])
    print(f'작은 장면 그림 256×144: {got}장 / 쓰이는 장면 {len(found)}장' + (f'  원본 없음 {miss}' if miss else ''))


if __name__ == '__main__':
    main()
