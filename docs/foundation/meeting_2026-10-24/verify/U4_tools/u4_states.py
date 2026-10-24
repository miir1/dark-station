import os, sys, json, time, base64, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import start, OUTD, PORT
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
cdp, proc, httpd = start()
try:
    cdp.nav(f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=car&seed=7')
    for _ in range(300):
        time.sleep(0.2)
        try:
            if cdp.ev("!!(window.__ds4 && __ds4.scene && __ds4.scene.map && __ds4.scene.map.id==='car' && !__ds4.UI.isOpen() && !__ds4.UI.bot)"): break
        except Exception: pass
    time.sleep(0.5)
    r = cdp.ev(open(os.path.join(HERE, 'states.js'), encoding='utf-8').read())
    b = base64.b64decode(r.pop('board').split(',', 1)[1])
    im = Image.open(io.BytesIO(b)); im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    im.save(os.path.join(OUTD, 'U4_states_board_x3.png'))
    json.dump(r, open(os.path.join(OUTD, 'U4_states.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('console errors:', [c for c in cdp.console if c[0] in ('error', 'exception')][:5])
finally:
    try: proc.kill()
    except Exception: pass
    httpd.shutdown()
