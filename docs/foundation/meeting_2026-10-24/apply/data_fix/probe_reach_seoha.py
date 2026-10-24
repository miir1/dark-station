# 데이터 담당(10-24 검증 잔여 13): 의자1을 옮긴 뒤 서하 물통·붕대(17,9)와 이웃 물건을 화면에서 걸어가 조사할 수 있는가.
# verify_A4_work/probe_reach.py 와 같은 방법(저장 D_share·A_water 에서 __ds4.use(id) → inspectLog). 프로필은 이 폴더 안, 끝나면 지운다.
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
A4 = os.path.join(HERE, '..', 'verify_A4_work')
sys.path.insert(0, A4)
import natural_late as NL  # noqa
SC = NL.SC
import websockets  # noqa
OBJS = ['bottle_seoha', 'bandage_seoha', 'blanket_soonrye', 'blanket_seoha', 'blanket_eunji', 'bowl_gicheol', 'bottle_soonrye', 'bandage_soonrye', 'bottle_eunji', 'bench1', 'bench2', 'fire']
BOT = r"""(() => { __ds4.setBot((k, info) => { if (k === 'line') return undefined; if (k === 'event') { const o = info.options; let i = o.findIndex((x) => !x.disabled && !/warn|chance/.test(String(x.subRaw || ''))); return i < 0 ? o.findIndex((x) => !x.disabled) : i; }
  if (k === 'tend' || k === 'write' || k === 'treat') return info.options.length - 1; if (k === 'confirm2') return 0; return undefined; }); return 1; })()"""

async def go(fixes):
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile_reach'); shutil.rmtree(prof, ignore_errors=True); os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {}
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
            for fx in fixes:
                rr = {}
                for oid in OBJS:
                    await c.open(f'/v4/index.html?fast=1&auto=xnatural&state=/__fixture/{fx}.json&sc={int(time.time())}')
                    try:
                        await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot", 60)
                    except BaseException as e:
                        rr[oid] = {'error': 'load ' + str(e)[:80]}; continue
                    await c.ev(BOT, False)
                    await NL.idle(c)
                    info = await c.ev(f"(() => {{ const o = __ds4.objectsOnMap().find((q) => q.id === '{oid}'); return o ? {{ x: o.x, y: o.y, hidden: o.hidden }} : null; }})()", False)
                    if not info:
                        rr[oid] = {'onMap': False}; print(fx, oid, 'not on map', flush=True); continue
                    p0 = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
                    try:
                        await asyncio.wait_for(c.ev(f"__ds4.use('{oid}')", True), 20)
                        await NL.idle(c, 20)
                    except BaseException:
                        pass
                    await asyncio.sleep(0.3)
                    p1 = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
                    log = await c.ev("__ds4.inspectLog.map((x) => x.id || ('toast:' + x.toast))", False)
                    errs = await c.ev("(window.__errs || []).length", False)
                    rr[oid] = {'at': [info['x'], info['y']], 'from': p0, 'to': p1, 'inspected': oid in (log or []), 'log': log}
                    print(fx, oid, rr[oid]['at'], '→ stood', p1, 'inspected', rr[oid]['inspected'], flush=True)
                res[fx] = rr
    finally:
        proc.terminate(); time.sleep(1); httpd.shutdown(); shutil.rmtree(prof, ignore_errors=True)
        with open(os.path.join(HERE, 'reach_seoha.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
asyncio.run(go(sys.argv[1].split(',') if len(sys.argv) > 1 else ['D_share', 'A_water']))
