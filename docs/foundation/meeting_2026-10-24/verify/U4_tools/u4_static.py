import os, sys, json, time, base64, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import start, OUTD, PORT, save_dataurl
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
cdp, proc, httpd = start()
try:
    cdp.nav(f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=car&seed=7')
    ok = False
    for _ in range(300):
        time.sleep(0.2)
        try:
            v = cdp.ev("!!(window.__ds4 && __ds4.scene && __ds4.scene.map && __ds4.scene.map.id==='car' && !__ds4.UI.isOpen() && !__ds4.UI.bot)")
        except Exception:
            v = False
        if v:
            ok = True
            break
    print('ready', ok)
    time.sleep(0.5)
    res = cdp.ev(open(os.path.join(HERE, 'measure.js'), encoding='utf-8').read())
    PH = res['player']['h'] if res['player'] else None
    print('player bbox', res['player'])
    rows = []
    for mid, mm in res['maps'].items():
        for nm, key in (('lit', 'boardLit'), ('real', 'boardReal')):
            b = base64.b64decode(mm[key].split(',', 1)[1])
            im = Image.open(io.BytesIO(b))
            im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
            im.save(os.path.join(OUTD, f'U4_map_{mid}_{nm}_x2.png'))
            del mm[key]
        for o in mm['objects']:
            bb = o['bbox']
            o['ratio'] = round(bb['h'] / PH, 3) if bb and PH else None
            rows.append((mid, o))
    json.dump(res, open(os.path.join(OUTD, 'U4_measure.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUTD, 'U4_measure.txt'), 'w', encoding='utf-8') as f:
        f.write(f'player visible bbox (station (5,6), lit): {res["player"]}\n')
        f.write('map | id | name | cell | tile | state | solid | hiddenD0 | v4name | hand | prop | drawn w x h | height/player | inCell\n')
        for mid, o in rows:
            bb = o['bbox']
            f.write(f"{mid} | {o['id']} | {o['name']} | ({o['x']},{o['y']}) | {o['tile']} | {o['state']} | {int(bool(o['solid']))} | {int(bool(o['hiddenD0']))} | {o['v4name']} | {int(o['hand'])} | {o['prop']} | "
                    f"{(str(bb['w']) + 'x' + str(bb['h'])) if bb else 'NOT DRAWN'} | {('%.0f%%' % (o['ratio'] * 100)) if o['ratio'] is not None else '-'} | {o['inCell']}\n")
    print(open(os.path.join(OUTD, 'U4_measure.txt'), encoding='utf-8').read())
    errs = [c for c in cdp.console if c[0] in ('error', 'exception')]
    print('console errors:', errs[:10])
finally:
    try:
        proc.kill()
    except Exception:
        pass
    httpd.shutdown()
