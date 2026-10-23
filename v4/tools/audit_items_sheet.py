# 검수용(2026-10-24, U4 아이템 배치): 지도 위 아이템 그림을 '당신' 걷기 그림 옆에 게임과 같은 크기(1:1, 바닥 맞춤)로 세워 비교 시트를 만든다.
# 게임 파일은 건드리지 않는다. 결과: docs/foundation/meeting_2026-10-24/audit_shots/items_vs_player.png · containers_available.png
# 실행: python v4/tools/audit_items_sheet.py   (C:\dev\dark_station 에서)
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'audit_shots')
T, PH, S = 32, 48, 3          # 칸, 사람 높이, 확대 배율
FONT = None
for f in (r'C:\Windows\Fonts\malgun.ttf', r'C:\Windows\Fonts\gulim.ttc'):
    if os.path.exists(f):
        FONT = ImageFont.truetype(f, 13)
        break
FONT = FONT or ImageFont.load_default()


def player():
    im = Image.open(os.path.join(ROOT, 'v3/img/walk/player.png')).convert('RGBA')
    cw, ch = im.width // 3, im.height // 4
    return im.crop((cw, 0, cw * 2, ch)).resize((T, PH), Image.NEAREST)


def png(rel):
    return Image.open(os.path.join(ROOT, rel)).convert('RGBA')


def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


def pr_pipe():                  # art.js PROC.pipe 를 그대로 옮김
    c = Image.new('RGBA', (T, T)); d = ImageDraw.Draw(c)
    for i in range(22):
        x, y = 5 + i, 25 - round(i * 0.42)
        rect(d, x, y, 1, 4, '#2a2622'); rect(d, x, y, 1, 2, '#7a5236' if i % 5 == 2 else '#6e6a63'); rect(d, x, y, 1, 1, '#a49d92')
    rect(d, 4, 25, 2, 4, '#1a1714'); rect(d, 26, 16, 2, 4, '#1a1714')
    return c


def pr_notebook():              # art.js PROC.notebook
    c = Image.new('RGBA', (T, T)); d = ImageDraw.Draw(c)
    rect(d, 9, 26, 16, 2, (0, 0, 0, 90)); rect(d, 9, 15, 15, 11, '#1c1916'); rect(d, 10, 25, 13, 1, '#d9cfbd'); rect(d, 23, 16, 1, 9, '#d9cfbd')
    rect(d, 9, 15, 15, 1, '#3a332c'); rect(d, 9, 15, 1, 11, '#3a332c'); rect(d, 18, 15, 1, 11, '#7a2c22')
    return c


def bbox(im):
    bb = im.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    return (bb[2] - bb[0], bb[3] - bb[1]) if bb else (0, 0)


def sheet(items, name, cols=5):
    pl = player()
    pw, ph = bbox(pl)
    cell_w, cell_h = 80, 64 + 34
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell_w * S, rows * cell_h * S
    out = Image.new('RGBA', (W, H), (34, 30, 27, 255))
    d = ImageDraw.Draw(out)
    for k, (label, im) in enumerate(items):
        cx, cy = (k % cols) * cell_w, (k // cols) * cell_h
        cell = Image.new('RGBA', (cell_w, 64), (52, 46, 41, 255))
        cd = ImageDraw.Draw(cell)
        base = 60                                   # 바닥 줄(타일 아래 끝)
        cd.line([(0, base), (cell_w, base)], fill=(90, 80, 70, 255))
        cell.alpha_composite(pl, (6, base - PH))      # 사람: 칸 아래에 발, 위로 48
        x = 6 + T + 4                               # 물건: drawProp 처럼 칸 바닥에 맞춘다
        cell.alpha_composite(im, (x + (T - im.width) // 2, base - im.height))
        out.alpha_composite(cell.resize((cell_w * S, 64 * S), Image.NEAREST), (cx * S, cy * S))
        w, h = bbox(im)
        d.text((cx * S + 8, (cy + 64) * S + 4), label, font=FONT, fill=(235, 225, 205, 255))
        d.text((cx * S + 8, (cy + 64) * S + 24), f'보이는 크기 {w}x{h}px · 키의 {round(h / ph * 100)}%', font=FONT, fill=(200, 170, 120, 255))
        d.text((cx * S + 8, (cy + 64) * S + 44), f'(당신 {pw}x{ph}px)', font=FONT, fill=(150, 140, 125, 255))
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, name))
    print('saved', os.path.join(OUT, name), out.size)


def main():
    P, TR = 'v3/img/props/', 'v4/img/traces/'
    items = [
        ('물통 bottle_* (찬 것)', png(TR + 'bottle_full.png')),
        ('물통 (빈 것)', png(TR + 'bottle_empty.png')),
        ('그릇 bowl_* 빈 것=lid', png(TR + 'lid.png')),
        ('그릇 고기·가위=knife', png(TR + 'knife.png')),
        ('붕대 bandage_*', png(TR + 'bandage.png')),
        ('당신 수첩 pr:notebook', pr_notebook()),
        ('쇠파이프 pr:pipe', pr_pipe()),
        ('기철 베개 pillow', png(TR + 'pillow.png')),
        ('계단 신발 shoes_pair', png(TR + 'shoes_pair.png')),
        ('구두 한 짝 heel', png(P + 'heel.png')),
        ('좌석 밑 가방 sack', png(P + 'sack.png')),
        ('구급함 medkit', png(P + 'medkit.png')),
        ('무전기 radio', png(P + 'radio.png')),
        ('공중전화 phone', png(P + 'phone.png')),
        ('창고·부품·비상 상자 crate', png(P + 'crate.png')),
    ]
    sheet(items, 'items_vs_player.png')
    cont = [('crate 상자', png(P + 'crate.png')), ('drum 드럼통(=화로)', png(P + 'drum.png')), ('leakbarrel 샌 통', png(P + 'leakbarrel.png')),
            ('kiosk 매대', png(P + 'kiosk.png')), ('vending 자판기', png(P + 'vending.png')), ('backpack 배낭', png(P + 'backpack.png')),
            ('sack 자루', png(P + 'sack.png')), ('briefcase 서류가방', png(P + 'briefcase.png')), ('medkit 구급함', png(P + 'medkit.png')),
            ('stall 좌판', png(P + 'stall.png')), ('cart 수레', png(P + 'cart.png')), ('tank 탱크', png(P + 'tank.png')),
            ('generator 발전기', png(P + 'generator.png')), ('bodybag 시체 자루', png(P + 'bodybag.png')), ('lid (열림 덧그림)', png(TR + 'lid.png'))]
    sheet(cont, 'containers_available.png')


if __name__ == '__main__':
    main()
