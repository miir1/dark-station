# 검수용(2026-10-24, U4 아이템 배치): 소품·흔적 그림의 실제 보이는 크기(투명 아닌 영역)를 잰다. 게임 파일은 건드리지 않는다.
# 실행: python v4/tools/audit_items.py   (C:\dev\dark_station 에서)
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def vis(path):
    im = Image.open(path).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    w, h = (bb[2] - bb[0], bb[3] - bb[1]) if bb else (0, 0)
    return im.size, bb, w, h


def main():
    dirs = sys.argv[1:] or ['v3/img/props', 'v4/img/traces', 'v3/img/walk']
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(ROOT, d, '*.png'))):
            size, bb, w, h = vis(f)
            name = os.path.relpath(f, ROOT).replace(os.sep, '/')
            # 플레이어 보이는 키 대비(사람 32x48 칸, 걷기 그림의 실제 몸 높이는 별도 측정)
            print(f'{name}\t{size[0]}x{size[1]}\tbbox={bb}\tvis={w}x{h}')


if __name__ == '__main__':
    main()


def player_cell():
    # 걷기 그림 3열x4행 중 아래 보기 가운데 칸(서 있음)의 실제 보이는 몸 크기
    im = Image.open(os.path.join(ROOT, 'v3/img/walk/player.png')).convert('RGBA')
    cw, ch = im.width // 3, im.height // 4
    cell = im.crop((cw, 0, cw * 2, ch))
    bb = cell.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    return (cw, ch), bb, bb[2] - bb[0], bb[3] - bb[1]
