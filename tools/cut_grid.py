"""격자 시트(5x2 등 칸이 고른 시트)를 칸 단위로 자른다. 칸마다 가장 큰 덩어리와 그 근처(70px) 조각만 합쳐 쓰므로 옆 칸 번짐·흩어진 조각(뼈·유리)에 강하다. 외곽선 없음.
python tools/cut_grid.py 시트.png 출력폴더 이름:WxH,... 열수 행수
"""
import sys, os
sys.path.insert(0, r'C:\dev\dark_station\tools')
import sheet
from PIL import Image
src, outdir, names, cols, rows = sys.argv[1], sys.argv[2], sys.argv[3].split(','), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGBA'); m = sheet.mask_of(im); im.putalpha(m)
W, H = im.size; cw, ch = W / cols, H / rows
os.makedirs(outdir, exist_ok=True)
for i, spec in enumerate(names):
    c, r = i % cols, i // cols
    cell = im.crop((int(c*cw), int(r*ch), int((c+1)*cw), int((r+1)*ch)))
    boxes = sheet.components(cell.getchannel('A'), 300)
    boxes.sort(key=lambda b: (b[2]-b[0])*(b[3]-b[1]), reverse=True)
    main = list(boxes[0])
    def near(a,b,g=70): return a[0]-g < b[2] and b[0]-g < a[2] and a[1]-g < b[3] and b[1]-g < a[3]
    changed=True
    while changed:
        changed=False
        for b in boxes[1:]:
            if near(main,b) and not (b[0]>=main[0] and b[1]>=main[1] and b[2]<=main[2] and b[3]<=main[3]):
                main=[min(main[0],b[0]),min(main[1],b[1]),max(main[2],b[2]),max(main[3],b[3])]; changed=True
    bb = tuple(main)
    name, w, h, CW, CH = sheet.parse_name(spec, 32, 32)
    inner = sheet.quantize_rgba(sheet.fit(cell.crop(bb), w, h, pad=0))
    sp = Image.new('RGBA', (CW, CH), (0,0,0,0)); sp.paste(inner, ((CW-w)//2, CH-h), inner)
    sp.save(os.path.join(outdir, name + '.png')); print(name, bb, sp.size)
