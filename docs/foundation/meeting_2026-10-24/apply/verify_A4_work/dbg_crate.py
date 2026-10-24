# verify_A4 — 창고 상자(8,2) 조사가 화면에서 되는가 (E_food 저장, 게임 파일은 고치지 않는다)
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import natural_late as NL  # noqa
SC = NL.SC
import websockets  # noqa

async def go():
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile2'); shutil.rmtree(prof, ignore_errors=True); os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = {}
    try:
        ws_url = None
        for _ in range(60):
            try:
                pg = [t for t in json.loads(urllib.request.urlopen(f'http://127.0.0.1:{SC.DBG}/json/list', timeout=2).read()) if t.get('type') == 'page']
                if pg: ws_url = pg[0]['webSocketDebuggerUrl']; break
            except Exception: pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = SC.CDP(ws); await c.send('Page.enable'); await c.send('Runtime.enable')
            await c.open(f'/v4/index.html?fast=1&auto=xnatural&state=/__fixture/E_food.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot", 90)
            await c.ev(NL.LAZY_BOT + '(null)', False)
            await NL.idle(c)
            out['crate_on_map'] = await c.ev("__ds4.objectsOnMap().filter((o) => o.id === 'crate_food')", False)
            out['before'] = await c.ev("({ px: __ds4.scene.px, py: __ds4.scene.py, map: __ds4.scene.map.id, phase: __ds4.state.phase, crate: __ds4.state.traces.crate_food })", False)
            # 화면 키로 걸어가기: walkTo 대신 실제 경로 — use 의 반환값
            out['use_ret'] = await c.ev("__ds4.use('crate_food')", True)
            await asyncio.sleep(1.0)
            out['after'] = await c.ev("({ px: __ds4.scene.px, py: __ds4.scene.py, face: __ds4.scene.face, open: __ds4.UI.openKind(), log: __ds4.inspectLog.slice(-3), crate: __ds4.state.traces.crate_food, hint: document.getElementById('hint').textContent, target: (__ds4.target && __ds4.target()) || null })", False)
            await SC.app_shot(c, os.path.join(HERE, 'verify_A4_E_food_dbg_crate.png'))
            # 그 자리에서 Space
            await c.key(' ', 'keyDown'); await asyncio.sleep(0.05); await c.key(' ', 'keyUp'); await asyncio.sleep(1.2)
            out['after_space'] = await c.ev("({ open: __ds4.UI.openKind(), log: __ds4.inspectLog.slice(-3), seen: (window.__seen || []).slice(-4), toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent })", False)
            out['errors'] = c.errors()
    finally:
        proc.terminate(); time.sleep(1); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    print(json.dumps(out, ensure_ascii=False, indent=1))

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
asyncio.run(go())
