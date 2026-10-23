# 검수용(2026-10-24 회의, U1·U4): 지도에 놓이는 물건 그림을 '당신'(서 있는 그림) 옆에 실제 픽셀 크기 그대로 세워 3배로 찍는다.
# 사람 키 47px ≈ 170cm 로 잡으면 1px ≈ 3.6cm. 그림 파일은 읽기만 한다.
# 쓰기: python v4/tools/audit_props.py  → docs/foundation/meeting_2026-10-24/audit_shots/u1_props_scale.png + 표준 출력(표)
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'audit_shots')
V3P = os.path.join(ROOT, 'v3', 'img', 'props')
V4T = os.path.join(ROOT, 'v4', 'img', 'traces')
CM = 170 / 47
# (지도 물건 id, 그림, 실제 대략 크기 cm — 가장 긴 변)
ITEMS = [('medkit(구급상자)', 'p:medkit', 35), ('radio_cab(무전기)', 'p:radio', 25), ('shoe_cab(구두 한 짝)', 'p:heel', 26),
         ('scissors(가위)→knife', 't:knife', 20), ('bowl_meat(칼)', 't:knife', 25), ('bottle(물병)', 't:bottle_full', 33),
         ('pillow(베개)', 't:pillow', 50), ('lid(뚜껑·열린 상자 표시)', 't:lid', 15), ('shoes(신발 한 켤레)', 't:shoes_pair', 28),
         ('lantern(꺼진 등)', 't:lantern_dead', 30), ('bag(가방)', 'p:sack', 60), ('crate(상자)', 'p:crate', 80),
         ('fire(드럼통)', 'p:drum', 88), ('phonebooth(공중전화 부스)', 'p:phone', 220), ('cistern(물탱크)', 'p:tank', 200),
         ('pharmacy(약국 셔터)', 'p:kiosk', 300), ('speaker(스피커)', 'p:lamp', 40), ('lever(레버)', 'p:lever', 60), ('bones(뼈 무더기)', 'p:bones', 60)]


def load(ref):
    kind, name = ref.split(':')
    f = os.path.join(V3P if kind == 'p' else V4T, name + '.png')
    return Image.open(f).convert('RGBA')


def main():
    os.makedirs(OUTD, exist_ok=True)
    walk = Image.open(os.path.join(ROOT, 'v3', 'img', 'walk', 'player.png')).convert('RGBA')
    you = walk.crop((32, 0, 64, 48))                                   # 아래 보기 · 섬
    K = 3
    cellw = 56
    out = Image.new('RGB', ((len(ITEMS) + 1) * cellw * K, 100 * K), (58, 54, 50))
    d = ImageDraw.Draw(out)
    base = 70 * K                                                      # 바닥 선
    def put(im, i, label, sub):
        bb = im.split()[3].getbbox()
        crop = im.crop(bb)
        big = crop.resize((crop.width * K, crop.height * K), Image.NEAREST)
        x = i * cellw * K + (cellw * K - big.width) // 2
        out.paste(big, (x, base - big.height), big)
        d.text((i * cellw * K + 4, base + 6), label[:16], fill=(255, 255, 255))
        d.text((i * cellw * K + 4, base + 20), sub, fill=(240, 210, 120))
        return bb
    put(you, 0, 'YOU 당신', '21x47px=170cm')
    print('| 물건 | 그림 | 픽셀(w×h) | 그림이 뜻하는 크기 | 실제 대략 | 배율 |')
    for i, (label, ref, real) in enumerate(ITEMS, 1):
        im = load(ref)
        bb = im.split()[3].getbbox()
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        cm = round(max(w, h) * CM)
        put(im, i, label.split('(')[0], f'{w}x{h}={cm}cm')
        print(f'| {label} | {ref} | {w}×{h} | {cm}cm | {real}cm | {cm / real:.1f}× |')
    d.line([(0, base), (out.width, base)], fill=(20, 20, 20), width=2)
    out.save(os.path.join(OUTD, 'u1_props_scale.png'))


if __name__ == '__main__':
    main()
