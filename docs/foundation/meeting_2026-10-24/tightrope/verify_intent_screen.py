# 적대적 검증 (10-24 tightrope) — 화면에서 이기적 플레이를 처음부터 직접 진행한다 (저장 주입·지름길 없음).
# 쓰기 (C:\dev\dark_station 에서): python docs/foundation/meeting_2026-10-24/tightrope/verify_intent_screen.py [시드,시드…]
#   게임의 플레이스루 흐름(?auto=, 걷기·조사·배식·원정·화로)은 그대로 쓰고, 화면이 묻는 '사건 선택'과 '배식'만 이기적 사람으로 바꾼다:
#     - 위험 0(살 확률 1) 선택지가 있으면 그 가운데 가장 이기적인 것(남을 내밀기·빼앗기·금기 — 라벨 뜻)
#     - 없으면(줄타기) 화면의 % 로 가장 살 확률이 높은 것 = 경고를 읽고 버티는 이기적
#     - 배식: 식량·물이 모자라면 남의 그릇부터 뺀다
#   줄타기 선택 창 · 판정 줄 · 죽음 화면에서 멈춰 캡처한다(verify_intent_screen/). 파일·표·엔진은 고치지 않는다.
#   헤드리스 프로필은 tightrope/verify_intent_profile (끝나면 지운다).
import os, sys, json, time, asyncio, subprocess, threading, functools, http.server, socketserver, shutil, urllib.request, base64
import websockets

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTD = os.path.join(HERE, 'verify_intent_screen')
PROF = os.path.join(HERE, 'verify_intent_profile')
PORT, DBG = 18841, 19581
MODE = os.environ.get('VI_MODE', 'selfish')

INJECT = r"""
(() => {
  const vi = window.__vi = { log: [], holding: null, resume: null, n: 0, ropes: [], ended: null, karmaSeen: [] };
  const t = setInterval(() => {
    if (!window.UI || !window.UI.setBot) return;
    clearInterval(t);
    const UI = window.UI, orig = UI.setBot;
    UI.setBot = (fn) => orig(fn ? wrap(fn) : null);
    const MODE = new URLSearchParams(location.search).get('vimode') || 'selfish';
    const SELFISH = /가리킨다|내민다|뺏는다|끌어온다|비운다|턴다|다른 이름|다른 사람|남의|옆 사람|아무것도 하지/;
    function hold(name, info, resume) { vi.n++; vi.holding = Object.assign({ name: `${String(vi.n).padStart(3, '0')}_${name}` }, info); vi.resume = () => { vi.holding = null; vi.resume = null; resume(); }; return 'hold'; }
    function screenText() { const b = document.getElementById('app') || document.body; return (b.innerText || '').replace(/\s+/g, ' ').slice(0, 1500); }
    function wrap(fn) {
      return (kind, info) => {
        const ds = window.__ds4; if (!ds) return fn(kind, info);
        const st = ds.state, db = ds.db, E = ds.E;
        if (kind === 'event' && st.pending) {
          const v = E.eventView(st, db); const ev = db.events[v.id];
          const metas = E.choiceMeta(st, db);
          const rows = v.choices.map((c, i) => { const row = E.effChoice(st, db, ev.choices[i]); const m = metas[i] || {}; const ax = m.axis || {};
            const lab = c.label; const self0 = (SELFISH.test(lab) ? 2 : 0) + (c.taboo ? 1 : 0) - (ax.share || 0) - (ax.hand || 0); const self = MODE === 'careful' ? -self0 : self0;
            return { i, label: lab, locked: c.locked, chance: c.chance, warn: c.warn || c.hint || '', p: E.survival(row, c.chance), roped: !!row.roped, self, gain: m.gain || 0 }; });
          const open = rows.filter((r) => !r.locked);
          if (!open.length) return fn(kind, info);
          const safe = open.filter((r) => r.p === 1);
          let best;
          if (safe.length) best = safe.reduce((a, b) => (b.self > a.self || (b.self === a.self && b.gain > a.gain) ? b : a));
          else best = open.reduce((a, b) => (b.p > a.p || (b.p === a.p && b.self > a.self) ? b : a));
          const k = info.options.findIndex((o) => o.label === best.label && !o.disabled);
          const idx = k >= 0 ? k : best.i;
          const roped = open.some((r) => r.roped);
          const rec = { day: st.day, phase: st.phase, ev: v.id, karma: st.world.karma || 0, blind: !!st.flags.strike_blind, choices: rows.map((r) => `${r.label}${r.locked ? '(잠김)' : ''} p=${r.p}${r.chance != null ? ' ' + r.chance + '%' : ''}${r.roped ? ' 줄' : ''}`), pick: best.label, pickP: best.p, safeOpen: safe.length };
          vi.log.push(rec);
          if (roped || (best.p < 1)) { vi.ropes.push(rec); return hold(`D${st.day}_${v.id}_choice`, { rec, text: screenText() }, () => { const go = () => { if (UI.isOpen() && UI.openKind() === 'event') { UI.pick(idx); setTimeout(go, 450); } }; go(); }); }
          return idx;
        }
        if (kind === 'line' && info && info.opts && info.opts.tag === 'roll') {
          vi.log.push({ day: st.day, roll: info.text });
          return hold(`D${st.day}_roll`, { roll: info.text, text: screenText() }, () => UI.pick(0));
        }
        if (kind === 'death' || kind === 'death_ledger') { vi.ended = st.ended; return hold(`D${st.day}_${kind}`, { text: screenText() }, () => { const r = fn(kind, info); UI.pick(Number.isInteger(r) ? r : 0); }); }
        if (kind === 'ration' && info && info.options && MODE !== 'careful') {
          const on = info.options.filter((o) => /뺀다$/.test(o.label)).length;
          const can = Math.min(st.world.food || 0, st.world.water || 0);
          if (on > Math.max(1, can)) { for (let j = info.options.length - 2; j >= 1; j--) if (/뺀다$/.test(info.options[j].label)) return j; }
          return info.options.length - 1;
        }
        return fn(kind, info);
      };
    }
  }, 1);
})();
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    request_queue_size = 128
    daemon_threads = True
    allow_reuse_address = os.name != 'nt'


def serve():
    global PORT
    for p in range(PORT, PORT + 20):
        try:
            httpd = Server(('127.0.0.1', p), functools.partial(Quiet, directory=ROOT))
        except OSError:
            continue
        PORT = p
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        return httpd
    raise SystemExit('빈 포트 없음')


def browser():
    for c in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
        if os.path.exists(c):
            return c
    return shutil.which('chrome') or shutil.which('msedge')


class CDP:
    def __init__(self, ws):
        self.ws, self.n, self.pending, self.console = ws, 0, {}, []
        self.reader = asyncio.ensure_future(self._read())

    async def _read(self):
        async for msg in self.ws:
            m = json.loads(msg)
            if 'id' in m and m['id'] in self.pending:
                self.pending.pop(m['id']).set_result(m)
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                self.console.append('EXCEPTION: ' + str(d.get('exception', {}).get('description', d.get('text'))))
            elif m.get('method') == 'Runtime.consoleAPICalled':
                p = m['params']
                if p['type'] in ('error', 'log'):
                    self.console.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args'])[:600])

    async def send(self, method, params=None):
        self.n += 1
        i = self.n
        fut = asyncio.get_event_loop().create_future()
        self.pending[i] = fut
        await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
        m = await asyncio.wait_for(fut, 120)
        if 'error' in m:
            raise RuntimeError(m['error'])
        return m.get('result', {})

    async def ev(self, expr):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        return r.get('result', {}).get('value')

    async def shot(self, path):
        r = await self.send('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))


async def play(c, seed, limit_s=900):
    c.console.clear()
    await c.send('Page.navigate', {'url': f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=verify_selfish&seed={seed}&vimode={MODE}&vi={int(time.time())}'})
    t0 = time.time()
    shots, holds = [], []
    while time.time() - t0 < limit_s:
        await asyncio.sleep(0.15)
        try:
            h = await c.ev('window.__vi ? JSON.stringify(window.__vi.holding) : "null"')
        except Exception:
            continue
        h = json.loads(h or 'null')
        if h:
            await asyncio.sleep(0.25)
            fn = os.path.join(OUTD, f'{MODE}_s{seed}_{h["name"]}.png')
            await c.shot(fn)
            shots.append(os.path.basename(fn))
            holds.append(h)
            await c.ev('window.__vi && window.__vi.resume && window.__vi.resume()')
            continue
        done = await c.ev('window.__ds4 && window.__ds4.state ? JSON.stringify({ended: window.__ds4.state.ended ? window.__ds4.state.ended.why : null, day: window.__ds4.state.day, open: window.UI.isOpen()}) : "null"')
        d = json.loads(done or 'null')
        if d and d['ended'] and not d['open']:
            await asyncio.sleep(1.0)
            h = json.loads(await c.ev('JSON.stringify(window.__vi.holding)') or 'null')
            if not h:
                break
        if any('[ds4 auto]' in x and ' end' in x for x in c.console):
            break
    st = json.loads(await c.ev('JSON.stringify({ended: __ds4.state.ended, day: __ds4.state.day, you: __ds4.state.people.you.status, karma: __ds4.state.world.karma, stats: __ds4.state.stats, log: __vi.log, ropes: __vi.ropes})') or '{}')
    return {'seed': seed, 'secs': round(time.time() - t0, 1), 'shots': shots, 'holds': holds, 'final': st, 'console': [x for x in c.console if 'EXCEPTION' in x or 'error' in x or '[ds4 auto]' in x][:20]}


async def amain(seeds):
    os.makedirs(OUTD, exist_ok=True)
    httpd = serve()
    shutil.rmtree(PROF, ignore_errors=True)
    os.makedirs(PROF, exist_ok=True)
    proc = subprocess.Popen([browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={PROF}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = []
    try:
        ws_url = None
        for _ in range(60):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']
                    break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': INJECT})
            await c.send('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 720, 'deviceScaleFactor': 2, 'mobile': False})
            for sd in seeds:
                r = await play(c, sd)
                out.append(r)
                f = r['final']
                print(f"seed {sd}: {r['secs']}s · 끝 {(f.get('ended') or {}).get('why')} D{f.get('day')} you={f.get('you')} karma={f.get('karma')} · 줄타기 굴림 {(f.get('stats') or {}).get('ropeRolls')} 넘김 {(f.get('stats') or {}).get('ropeClose')} · 캡처 {len(r['shots'])}", flush=True)
                with open(os.path.join(HERE, os.environ.get('VI_JSON', 'verify_intent_screen.json')), 'w', encoding='utf-8') as fp:
                    json.dump(out, fp, ensure_ascii=False, indent=1)
    finally:
        proc.terminate()
        time.sleep(1)
        httpd.shutdown()
        shutil.rmtree(PROF, ignore_errors=True)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    seeds = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '7').split(',')]
    asyncio.run(amain(seeds))
