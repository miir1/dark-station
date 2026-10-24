# U5 재확인: 서하 '위 보기'(앞 실행에서 대사창이 떠 있었다) + 그 창이 무엇이었나 + 걷는 동안 당신 꼬리표/▾ 표시가 머리에 닿는가
import os, sys, json, time, asyncio, subprocess, tempfile, shutil, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import U5_ingame_check as U
from PIL import Image
import websockets

OUT = U.OUTD


async def main():
    httpd = U.serve()
    prof = tempfile.mkdtemp(prefix='ds_u5r_')
    proc = subprocess.Popen([U.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={U.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {}
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
            await c.send('Page.navigate', {'url': f'http://127.0.0.1:{U.PORT}/v4/index.html?fast=1&auto=morning3&seed=7&u5r={int(time.time())}'})
            t0 = time.time()
            while time.time() - t0 < 300:
                try:
                    v = await c.ev("(() => { const d = window.__ds4; if (!d || !d.state || !d.scene || !d.scene.map) return null; return { day: d.state.day, ph: d.state.phase, map: d.scene.map.id, bot: !!d.UI.bot, open: d.UI.isOpen(), auto: !!d.scene.auto }; })()", False)
                except Exception:
                    v = None
                if v and v['day'] == 3 and v['ph'] == 'trace' and v['map'] == 'station' and not v['bot'] and not v['open'] and not v['auto']:
                    break
                await asyncio.sleep(0.4)
            print('ready', v)
            await c.ev(U.SETUP, False)
            await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return 1; })()", False)
            res['you_react'] = await c.ev("(() => { try { return __ds4.peopleOnMap().map((p) => [p.id, p.react || '', p.mark || '']); } catch (e) { return String(e); } })()", False)
            # 1) 앞 실행과 같은 길: (13,12) 에서 walkTo(16,7) — 무엇이 열리나
            await U.place(c, 13, 12, 'up')
            ok = await c.ev("__ds4.walkTo(16, 7)", False)
            await asyncio.sleep(6)
            res['walkTo_16_7'] = await c.ev("(() => ({ ok: %s, pos: [__ds4.scene.px, __ds4.scene.py], open: __ds4.UI.isOpen(), kind: __ds4.UI.openKind ? __ds4.UI.openKind() : null, box: (document.getElementById('box').textContent || '').slice(0, 160), auto: !!__ds4.scene.auto }))()" % ('true' if ok else 'false'), False)
            print('walkTo', res['walkTo_16_7'])
            await c.shot(os.path.join(OUT, 'U5_recheck_walkTo_16_7_box.png'))
            # 창 닫기: Escape / Space 몇 번
            for _ in range(8):
                if not await c.ev("__ds4.UI.isOpen()", False):
                    break
                await c.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': ' ', 'code': 'Space', 'windowsVirtualKeyCode': 32, 'text': ' '})
                await c.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': ' ', 'code': 'Space', 'windowsVirtualKeyCode': 32})
                await asyncio.sleep(0.8)
            res['after_close_open'] = await c.ev("__ds4.UI.isOpen()", False)
            # 2) 서하 위 보기: 창 없이 다시 — 당신 (16,7)·(16,9)
            await c.ev("__u5.setNpcAlias(true); __u5.only = ['seoha']", False)
            out = {}
            for spot in ((16, 7), (16, 9)):
                await U.place(c, spot[0], spot[1], 'down')
                await asyncio.sleep(0.3)
                await U.rec(c, True)
                await asyncio.sleep(0.6)
                fr = await U.rec(c, False)
                rows = [r for f in fr for r in f.get('res', [])]
                out[str(spot)] = {'open': await c.ev("__ds4.UI.isOpen()", False), 'frames': len(rows), 'dirs': sorted({r['dir'] for r in rows}),
                                  'head_min': min(r['headVis'] / r['head'] for r in rows), 'ov': sorted({o for r in rows for o in r['ov']}), 'stray_max': max(r['stray'] for r in rows),
                                  'outC': max(r['outC'] for r in rows), 'breath': sorted({r['b'] for r in rows})}
                if rows:
                    U.crop_of(rows[-1]).resize((144, 216), Image.NEAREST).save(os.path.join(OUT, f'U5_recheck_seoha_up_{spot[0]}_{spot[1]}.png'))
                print('seoha up', spot, out[str(spot)])
            res['seoha_up'] = out
            await c.ev("__u5.setNpcAlias(false); __u5.only = null", False)
            res['console_errors'] = [x for x in c.console if x.startswith('error') or x.startswith('EXCEPTION')][:10]
    finally:
        proc.terminate(); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    with open(os.path.join(OUT, 'U5_recheck_result.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False)[:2000])


if __name__ == '__main__':
    asyncio.run(main())
