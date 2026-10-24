# verify_A4 — 아침에 화로를 쓰면(배식으로 가는 창) 화로 흔적 글은 보이는데, 엔진은 그 밤 사건을 '본 것'으로 치는가
# A_water 저장(D5 아침, 어젯밤 steal_water 의 흔적 = 기철 물통 · 화로 wet)
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import natural_late as NL  # noqa
SC = NL.SC
import websockets  # noqa
Q = r"""(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, fire: s.traces.fire, night: s.nightLog.filter((e) => e.day === s.day - 1 && e.role !== 'clock' && e.role !== 'neglect').map((e) => ({ id: e.id, traces: e.traces, discovered: e.discovered })) }; })()"""

async def go():
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile5'); shutil.rmtree(prof, ignore_errors=True); os.makedirs(prof, exist_ok=True)
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
            await NL.idle(c)
            out['before'] = await c.ev(Q, False)
            await c.ev("(() => { window.__fireHeld = 0; __ds4.setBot((k, info) => { if (k === 'fire') { window.__fireHeld = 1; return 'hold'; } return undefined; }); return 1; })()", False)
            await c.ev("__ds4.use('fire'); 1", False)
            await SC.until(c, "window.__fireHeld === 1", 20)
            await asyncio.sleep(0.4)
            out['fire_box'] = await c.ev("(() => { const b = document.getElementById('box'); return b ? b.textContent : ''; })()", False)
            await SC.stage_shot(c, os.path.join(HERE, 'verify_A4_fire_dialog_D5.png'))
            out['after_fire_view'] = await c.ev(Q, False)
            out['errors'] = c.errors()
    finally:
        proc.terminate(); time.sleep(1); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(os.path.join(HERE, 'verify_A4_fire.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
asyncio.run(go())
