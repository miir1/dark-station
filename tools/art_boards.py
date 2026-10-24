"""그림 담당 끝 증거 판 만들기 (2026-10-24 회의). 읽기만 하고 docs/foundation/meeting_2026-10-24/after_shots/art_*.png 를 쓴다.

  python tools/art_boards.py            세 장 다
  python tools/art_boards.py props      art_props_scale.png  (46px 사람 옆에 작은 물건·가구 전부, 같은 바닥 줄, 1배 + 4배)
  python tools/art_boards.py containers art_containers.png   (닫힘·열림 짝 나란히, 4배)
  python tools/art_boards.py portrait   art_portrait80.png   (초상 80 원본·다친 초상 80, 1배·2배 + 장면 그림 256×144 몇 장 + 꿈 그림 48색)
  python tools/art_boards.py poses      art_poses.png        (사람마다 앉기 4방향·잠, 4배 + 화로 둘레 모의 배치 3배) — 검증 U1-1 뒤
  python tools/art_boards.py place      art_place_props.png  (공중전화 card/taken · 약국 셔터 4상태 · 저수조, 46px 사람 옆 1배 + 3배) — 검증 U1-3·U4-4 뒤
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
IMG = os.path.join(ROOT, 'v4', 'img')
SHOTS = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots')
FLOOR = (46, 40, 35, 255)
BG = (24, 21, 19, 255)
INK = (236, 226, 204)


def rgba(p):
    return Image.open(p).convert('RGBA')


def person():
    w = rgba(os.path.join(IMG, 'walk', 'player.png'))
    return w.crop((32, 0, 64, 48))


def props_board():
    S = json.load(open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8'))
    hand = ['bottle', 'bottle_empty', 'bottle_wet', 'bowl', 'bowl_empty', 'bowl_meat', 'bandage', 'bandage_wet', 'bandage_rot', 'bandage_blood',
            'notebook', 'notebook_moved', 'scissors', 'scissors_blood', 'shoe_one', 'shoe_pair', 'can', 'knife']
    long_ = ['pipe_stand', 'pipe_stand_blood', 'chalk_line', 'bag', 'bag_open']
    furn = ['drum_open'] + [n for g in S['pairs']['props'] for n in g if n not in ('bag', 'bag_open')] + ['dash', 'shelf']
    groups = [('hand <=12px', hand), ('long / carry', long_), ('furniture', furn)]
    me = person()
    items = []
    for title, names in groups:
        for n in names:
            p = os.path.join(IMG, 'props', n + '.png')
            if os.path.exists(p):
                items.append((title, n, rgba(p)))
    gap = 4
    width = 40 + sum(max(im.width, 10) + gap for _, _, im in items) + 40
    H1 = 64
    one = Image.new('RGBA', (width, H1), BG)
    d1 = ImageDraw.Draw(one)
    base = 54                                           # 바닥 줄 y
    d1.rectangle([0, base, width, H1], fill=FLOOR)
    one.alpha_composite(me, (4, base - 48 + 1))
    x = 40
    marks = []
    for title, n, im in items:
        b = im.getbbox() or (0, 0, im.width, im.height)
        one.alpha_composite(im, (x, base + 1 - b[3]))
        marks.append((x, n, im, title))
        x += max(im.width, 10) + gap
    K = 4
    big = one.resize((width * K, H1 * K), Image.NEAREST)
    out = Image.new('RGBA', (width * K, H1 * K + H1 + 120), BG)
    out.alpha_composite(one, (0, 0))
    out.alpha_composite(big, (0, H1 + 8))
    d = ImageDraw.Draw(out)
    d.text((4, H1 * K + H1 + 14), 'art_props_scale: player 46px (=170cm) | hand items long side <=12px | 1x top, 4x below | same floor line', fill=INK)
    for i, (x0, n, im, title) in enumerate(marks):
        b = im.getbbox() or (0, 0, 0, 0)
        d.text((x0 * K, H1 * K + H1 + 30 + (i % 4) * 16), f'{n} {b[2] - b[0]}x{b[3] - b[1]}', fill=INK)
    p = os.path.join(SHOTS, 'art_props_scale.png')
    out.save(p)
    return p, len(items)


def containers_board():
    S = json.load(open(os.path.join(HERE, 'art_scale.json'), encoding='utf-8'))
    rows = [g for g in S['pairs']['props']] + [['dash'], ['drum_open']]
    K = 4
    have = [[(n, rgba(os.path.join(IMG, 'props', n + '.png'))) for n in g if os.path.exists(os.path.join(IMG, 'props', n + '.png'))] for g in rows]
    have = [h for h in have if h]
    if not have:
        return None, 0
    colw = 36 * K
    rowh = [max(im.height for _, im in h) * K + 28 for h in have]
    out = Image.new('RGBA', (colw * 3 * 2 + 40, sum(rowh) + 40), BG)
    d = ImageDraw.Draw(out)
    y = 30
    d.text((8, 8), 'art_containers: closed / open (/ empty) pairs, 4x, same canvas + same floor line; brass handle 2px', fill=INK)
    half = len(have) // 2 + len(have) % 2
    cols = [have[:half], have[half:]]
    for ci, col in enumerate(cols):
        y = 30
        for h in col:
            hh = max(im.height for _, im in h)
            for j, (n, im) in enumerate(h):
                tile = Image.new('RGBA', (im.width, hh), FLOOR)
                tile.alpha_composite(im, (0, hh - im.height))
                x = 8 + ci * (colw * 3 + 20) + j * colw
                out.alpha_composite(tile.resize((im.width * K, hh * K), Image.NEAREST), (x, y))
                d.text((x, y + hh * K + 4), f'{n} {im.width}x{im.height}', fill=INK)
            y += hh * K + 28
    p = os.path.join(SHOTS, 'art_containers.png')
    out.crop((0, 0, out.width, max(y, 200) + 10)).save(p)
    return p, sum(len(h) for h in have)


def portrait_board():
    ids = ['player', 'soonrye', 'gicheol', 'mari', 'seoha', 'eunji', 'dongha', 'eunchae', 'dohyeon']
    out = Image.new('RGBA', (9 * 172 + 20, 820), BG)
    d = ImageDraw.Draw(out)
    d.text((8, 6), 'art_portrait80: portraits80 (1x, 2x) / portraits80_hurt (2x) / cg_s 256x144 (1x) / dream 48 colors', fill=INK)
    for i, pid in enumerate(ids):
        x = 10 + i * 172
        a = rgba(os.path.join(IMG, 'portraits80', pid + '.png'))
        h = rgba(os.path.join(IMG, 'portraits80_hurt', pid + '.png'))
        out.alpha_composite(a, (x, 24))
        out.alpha_composite(a.resize((160, 160), Image.NEAREST), (x, 110))
        out.alpha_composite(h.resize((160, 160), Image.NEAREST), (x, 276))
        d.text((x, 440), f'{pid} {a.width}x{a.height}', fill=INK)
    cgs = ['pro_stairs', 'd5_rail', 'open_gicheol', 'trial_d3_count', 'dream_cab', 'dream_stairs']
    for j, n in enumerate(cgs):
        p = os.path.join(IMG, 'cg_s', n + '.png')
        if os.path.exists(p):
            im = rgba(p)
            x, y = 10 + (j % 6) * 262, 460
            out.alpha_composite(im, (x, y))
            d.text((x, y + 148), f'cg_s/{n} {im.width}x{im.height}', fill=INK)
    for j, n in enumerate(['dream_cab', 'dream_punch', 'dream_seat', 'dream_stairs']):
        p = os.path.join(IMG, 'cg', n + '.png')
        im = rgba(p)
        ncol = len(im.convert('RGB').getcolors(1 << 16) or [])
        small = im.resize((192, 108), Image.NEAREST)
        x, y = 10 + j * 262, 630
        out.alpha_composite(small, (x, y))
        d.text((x, y + 112), f'cg/{n} {im.width}x{im.height} {ncol} colors (shown 1/2)', fill=INK)
    p = os.path.join(SHOTS, 'art_portrait80.png')
    out.save(p)
    return p


IDS = ['player', 'gicheol', 'soonrye', 'seoha', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon']


def _floor(w, h):
    fl = rgba(os.path.join(ROOT, 'v3', 'img', 'tiles', 'floor_0.png'))
    out = Image.new('RGBA', (w, h))
    for x in range(0, w, 32):
        for y in range(0, h, 32):
            out.alpha_composite(fl, (x, y))
    return out


def poses_board():
    K = 4
    sit = {n: rgba(os.path.join(IMG, 'sit', n + '.png')) for n in IDS}
    sl = {n: rgba(os.path.join(IMG, 'sleep', n + '.png')) for n in IDS}
    bed = rgba(os.path.join(ROOT, 'v3', 'img', 'props', 'bed.png'))
    W = len(IDS) * 34
    top = Image.new('RGBA', (W, 5 * 34), BG)
    for i, n in enumerate(IDS):
        for r in range(4):
            c = _floor(32, 32)
            c.alpha_composite(sit[n].crop((0, r * 32, 32, r * 32 + 32)))
            top.alpha_composite(c, (i * 34, r * 34))
        c = _floor(32, 32)
        c.alpha_composite(bed)
        c.alpha_composite(sl[n])
        top.alpha_composite(c, (i * 34, 4 * 34))
    big = top.resize((top.width * K, top.height * K), Image.NEAREST)
    # 화로 둘레 모의 배치 (화면 연결 뒤 모습): 가운데 화로, 둘레 6명이 화로를 본다
    scene = _floor(7 * 32, 5 * 32)
    drum = rgba(os.path.join(ROOT, 'v3', 'img', 'props', 'drum.png'))
    seats = [((3, 1), 'dongha', 'down'), ((2, 2), 'gicheol', 'right'), ((4, 2), 'soonrye', 'left'),
             ((2, 3), 'mari', 'up'), ((3, 3), 'player', 'up'), ((4, 3), 'eunji', 'up')]
    order = sorted(seats + [((3, 2), None, None)], key=lambda t: t[0][1])
    rows = {'down': 0, 'left': 1, 'right': 2, 'up': 3}
    for (x, y), n, d in order:
        if n is None:
            scene.alpha_composite(drum, (x * 32, y * 32))
        else:
            scene.alpha_composite(sit[n].crop((0, rows[d] * 32, 32, rows[d] * 32 + 32)), (x * 32, y * 32))
    sc = scene.resize((scene.width * 3, scene.height * 3), Image.NEAREST)
    out = Image.new('RGBA', (max(big.width, sc.width), big.height + sc.height + 60), BG)
    out.alpha_composite(big, (0, 0))
    out.alpha_composite(sc, (0, big.height + 40))
    d = ImageDraw.Draw(out)
    d.text((4, big.height + 8), 'art_poses: sit/<id> rows down,left,right,up (own upper body + shared knees-up legs) | sleep/<id> on bed | 4x', fill=INK)
    d.text((4, big.height + 22), 'mock fire circle 3x (how the evening looks once art.js uses sit/<id> by facing)', fill=INK)
    pth = os.path.join(SHOTS, 'art_poses.png')
    out.save(pth)
    return pth


def place_board():
    names = ['phonebooth', 'phonebooth_taken', 'cistern', 'pharmacy_shutter', 'pharmacy_shutter_half', 'pharmacy_shutter_open', 'pharmacy_shutter_dark']
    ims = [(n, rgba(os.path.join(IMG, 'props', n + '.png'))) for n in names]
    me = person()
    gap = 8
    W = 40 + sum(im.width + gap for _, im in ims)
    H = 72
    one = _floor(((W + 31) // 32) * 32, 96).crop((0, 0, W, H))
    one.alpha_composite(me, (4, H - 48))
    x = 40
    for n, im in ims:
        one.alpha_composite(im, (x, H - im.height))
        x += im.width + gap
    K = 3
    big = one.resize((W * K, H * K), Image.NEAREST)
    out = Image.new('RGBA', (W * K, H + 8 + H * K + 40), BG)
    out.alpha_composite(one, (0, 0))
    out.alpha_composite(big, (0, H + 8))
    d = ImageDraw.Draw(out)
    d.text((4, H + 8 + H * K + 8), 'art_place_props: player 46px | phonebooth 32x64 card/taken | cistern 64x64 | pharmacy_shutter 96x48 closed/half/open/dark | 1x top, 3x below', fill=INK)
    pth = os.path.join(SHOTS, 'art_place_props.png')
    out.save(pth)
    return pth


def main():
    os.makedirs(SHOTS, exist_ok=True)
    what = sys.argv[1:] or ['props', 'containers', 'portrait', 'poses', 'place']
    if 'props' in what:
        print('props', *props_board())
    if 'containers' in what:
        print('containers', *containers_board())
    if 'portrait' in what:
        print('portrait', portrait_board())
    if 'poses' in what:
        print('poses', poses_board())
    if 'place' in what:
        print('place', place_board())


if __name__ == '__main__':
    main()
