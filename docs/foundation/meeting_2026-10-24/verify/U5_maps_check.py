# U5 추가 확인: 첫 장면(전동차)·터널에서 9장 걷기 그림을 '당신'으로 걷게 하고, 터널 기철(헤드램프)의 머리도 잰다.
import os, sys, json, time, asyncio, subprocess, tempfile, shutil, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import U5_ingame_check as U
from PIL import Image, ImageDraw
import websockets

OUT = U.OUTD
POINTS = {
    'car': [('right', (1, 3, 'right'), 'ArrowRight', 5), ('left', (17, 3, 'left'), 'ArrowLeft', 5), ('up', (7, 3, 'up'), 'ArrowUp', 2),
            ('down', (14, 3, 'down'), 'ArrowDown', 2), ('right_cab', (15, 3, 'right'), 'ArrowRight', 5), ('up_cab', (19, 3, 'up'), 'ArrowUp', 1)],
    'tunnel': [('right', (2, 2, 'right'), 'ArrowRight', 9), ('up', (5, 3, 'up'), 'ArrowUp', 2), ('down', (8, 1, 'down'), 'ArrowDown', 2),
               ('left', (15, 2, 'left'), 'ArrowLeft', 4), ('right_to_gicheol', (12, 2, 'right'), 'ArrowRight', 3)],
}


async def run_point(c, point, res, bad):
    await c.send('Page.navigate', {'url': f'http://127.0.0.1:{U.PORT}/v4/index.html?fast=1&auto={point}&seed=7&u5m={int(time.time())}'})
    t0 = time.time()
    v = None
    while time.time() - t0 < 300:
        try:
            v = await c.ev("(() => { const d = window.__ds4; if (!d || !d.state || !d.scene || !d.scene.map) return null; return { day: d.state.day, ph: d.state.phase, map: d.scene.map.id, bot: !!d.UI.bot, open: d.UI.isOpen(), auto: !!d.scene.auto, mv: !!d.scene.moving, px: d.scene.px, py: d.scene.py }; })()", False)
        except Exception:
            v = None
        if v and v['map'] == point and not v['bot'] and not v['open'] and not v['auto'] and not v['mv']:
            break
        await asyncio.sleep(0.4)
    print(point, 'ready', v)
    await asyncio.sleep(0.5)
    await c.ev(U.SETUP, False)
    await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return 1; })()", False)
    ppl = await c.ev("__ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.face, p.pose || ''])", False)
    res[point] = {'ready': v, 'people': ppl, 'lanes': {}}
    await c.ev("__u5.setNpcAlias(true); __u5.only = ['you', 'gicheol']", False)
    keep = {}
    for sheet in U.SHEETS:
        await c.ev(f"__u5.setYou('{sheet}')", False)
        for name, (x, y, face), key, n in POINTS[point]:
            await U.place(c, x, y, face)
            fr, moved = await U.walk(c, key, n)
            rows = [(f, r) for f in fr for r in f.get('res', [])]
            you = [r for f, r in rows if r['who'] == 'you']
            gi = [r for f, r in rows if r['who'] == 'gicheol']
            b = [(f, r) for f, r in rows if U.bad(r)]
            res[point]['lanes'][f'{sheet}/{name}'] = {'frames': len(you), 'moved': moved, 'seq': ''.join('SLR'[r['frame']] for r in you),
                                                      'you_head_min': round(min((r['headVis'] / r['head'] for r in you), default=-1), 4),
                                                      'gicheol_frames': len(gi), 'gicheol_head_min': round(min((r['headVis'] / r['head'] for r in gi), default=-1), 4),
                                                      'stray_max': max((r['stray'] for f, r in rows), default=0), 'bad': len(b), 'err': [f['err'] for f in fr if f.get('err')][:1]}
            for f, r in b:
                bad.append({'point': point, 'sheet': sheet, 'lane': name, 'px': f['px'], 'py': f['py'], 'mt': f['mt'], **{k: v for k, v in r.items() if k != 'img'}})
            if sheet == 'player':
                mids = [r for r in you if r['frame'] in (1, 2)]
                if mids:
                    keep[name] = mids[len(mids) // 2]
                if gi:
                    keep['gicheol@' + name] = gi[-1]
            print(point, sheet, name, json.dumps(res[point]['lanes'][f'{sheet}/{name}'], ensure_ascii=False)[:300])
    await c.ev("__u5.setYou(null); __u5.setNpcAlias(false); __u5.only = null", False)
    # 보기용 띠: 당신(player) 걷는 중간 프레임 + 기철
    if keep:
        im = Image.new('RGB', (len(keep) * 148 + 4, 250), (22, 22, 22))
        d = ImageDraw.Draw(im)
        for i, (k, r) in enumerate(keep.items()):
            im.paste(U.crop_of(r).resize((144, 216), Image.NEAREST), (4 + i * 148, 30))
            d.text((4 + i * 148, 4), k, fill=(255, 230, 120))
            d.text((4 + i * 148, 16), f"{r['dir']}{r['frame']} head {r['headVis']}/{r['head']}", fill=(120, 230, 120) if not U.bad(r) else (255, 80, 80))
        im.save(os.path.join(OUT, f'U5_ingame_{point}_player.png'))
    await U.place(c, *POINTS[point][0][1])
    await c.key(POINTS[point][0][2], 'keyDown')
    await asyncio.sleep(0.34)
    await c.shot(os.path.join(OUT, f'U5_full_{point}_walk.png'))
    await c.key(POINTS[point][0][2], 'keyUp')


async def main():
    httpd = U.serve()
    prof = tempfile.mkdtemp(prefix='ds_u5m_')
    proc = subprocess.Popen([U.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={U.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res, bad = {}, []
    try:
        ws_url = None
        for _ in range(60):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{U.DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']; break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = U.CDP(ws)
            await c.send('Page.enable'); await c.send('Runtime.enable')
            await c.send('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 720, 'deviceScaleFactor': 1, 'mobile': False})
            for point in ('car', 'tunnel'):
                await run_point(c, point, res, bad)
            res['console_errors'] = [x for x in c.console if x.startswith('error') or x.startswith('EXCEPTION')][:10]
    finally:
        proc.terminate(); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    res['bad_total'] = len(bad)
    res['bad'] = bad[:200]
    with open(os.path.join(OUT, 'U5_ingame_car_tunnel.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print('BAD', len(bad))


if __name__ == '__main__':
    asyncio.run(main())
