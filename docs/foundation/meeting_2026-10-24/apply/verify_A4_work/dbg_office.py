# verify_A4 — 역무실(창고 상자 8,2) 들어가기: 열린 역무실 저장(A_water D5)에서 문 앞(16,2)까지 간 뒤 왼쪽 키로 걸어 본다 · 신발(3,2)은 아래 칸에서 위를 보고 Space
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import natural_late as NL  # noqa
SC = NL.SC
import websockets  # noqa

async def go():
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile4'); shutil.rmtree(prof, ignore_errors=True); os.makedirs(prof, exist_ok=True)
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
            await c.open(f'/v4/index.html?fast=1&auto=xnatural&state=/__fixture/A_water.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot", 60)
            await c.ev(NL.LAZY_BOT + '(null)', False)
            await NL.idle(c)
            out['office'] = await c.ev("({ st: __ds4.state.traces.office_door, obj: __ds4.objectsOnMap().find((o) => o.id === 'office_door') })", False)
            await c.ev("__ds4.goto(16, 2)", True)
            await NL.idle(c)
            out['at_door'] = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
            await SC.app_shot(c, os.path.join(HERE, 'verify_A4_office_door_open_D5.png'))
            for i in range(3):
                await c.key('ArrowLeft', 'keyDown'); await asyncio.sleep(0.25); await c.key('ArrowLeft', 'keyUp'); await asyncio.sleep(0.5)
            out['after_left'] = await c.ev("[__ds4.scene.px, __ds4.scene.py, __ds4.scene.face]", False)
            out['hint'] = await c.ev("document.getElementById('hint').textContent", False)
            await c.ev("__ds4.goto(9, 2)", True)
            await NL.idle(c)
            out['goto_9_2'] = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
            # 신발: (3,3) 에 서서 위를 본다 → Space
            await SC.place(c, 3, 3, 'up')
            await asyncio.sleep(0.3)
            out['shoes_hint'] = await c.ev("document.getElementById('hint').textContent", False)
            await c.key(' ', 'keyDown'); await asyncio.sleep(0.05); await c.key(' ', 'keyUp'); await asyncio.sleep(1.5)
            out['shoes_log'] = await c.ev("__ds4.inspectLog.map((x) => x.id || 'toast')", False)
            out['errors'] = c.errors()
    finally:
        proc.terminate(); time.sleep(1); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    print(json.dumps(out, ensure_ascii=False, indent=1))

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
asyncio.run(go())
