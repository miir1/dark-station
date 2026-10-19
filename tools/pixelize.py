"""AI가 그린 그림을 게임 도트로: 가운데를 정사각형으로 잘라 size×size로 줄이고, 게임 팔레트(art3.js RAMP)로 색을 맞춘다.
python tools/pixelize.py 입력.png 출력.png [크기=96] [팔레트 색 수 제한 없음]"""
import re, sys
from PIL import Image

import os
ART = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v3', 'art3.js'), encoding='utf-8').read()
ramp_block = ART[ART.index('const RAMP = {'):ART.index('};', ART.index('const RAMP = {'))]
PAL = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in re.findall(r"'#([0-9a-fA-F]{6})'", ramp_block)]


def pixelize(src, dst, size=96):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size, size), Image.BOX)
    pal = Image.new('P', (1, 1))
    flat = [c for rgb in PAL for c in rgb]
    pal.putpalette(flat + [0] * (768 - len(flat)))
    out = im.quantize(palette=pal, dither=Image.Dither.NONE)
    out.convert('RGB').save(dst)
    return dst


if __name__ == '__main__':
    pixelize(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 96)
    print('ok', len(PAL), 'colors')
