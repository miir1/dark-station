import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import start, OUTD, PORT
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
    r = cdp.ev(open(os.path.join(HERE, 'occlusion.js'), encoding='utf-8').read())
    with open(os.path.join(OUTD, 'U4_occlusion.txt'), 'w', encoding='utf-8') as f:
        f.write('container visibility while the player stands at the opening cell (lit render, tick 0)\n')
        f.write('closedPx = container pixels with no player; closedVisiblePct = share still visible with player there; openChange = pixels that change closed->open; openChangeVisiblePct = share of that change visible with player there\n')
        for x in r: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print(open(os.path.join(OUTD, 'U4_occlusion.txt'), encoding='utf-8').read())
finally:
    try: proc.kill()
    except Exception: pass
    httpd.shutdown()
