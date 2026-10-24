# U5 적대적 검증 (2026-10-24): 실제 게임(헤드리스 Chrome)에서 당신 + 주민 걷기·돌기 매 프레임 머리가 보이는지 잰다.
# 게임 파일은 고치지 않는다. 페이지 안에서 RENDER.draw 를 감싸, 같은 프레임을 두 번 더 그린다(대상만 투명 / 대상만 자홍색 실루엣).
#   두 그림이 다른 픽셀 = 그 사람 그림이 실제로 화면에 남은 픽셀(가림·캔버스 밖·꼬리표 덮임은 빠진다). 빛 덮개 색과 상관없다.
# 9장 걷기 그림은 '당신' 그림 id 를 바꿔 끼워(ART.spriteId 만 감싼다) 진짜 키 입력·카메라·걷기 4박자로 걷게 한다.
# 주민 돌기: morning3 의 실제 자리에서 당신이 네 방향 옆으로 걸어가(실제 길찾기 goto) 주민이 돌아보게 한다.
#   은채·도현은 지도에 나오는 길이 없어서(BED_ORDER 밖) 빈칸에 끼워 넣어(가짜 사람) 같은 그리기 경로로 잰다 — 결과에 'injected' 로 표시.
import os, sys, json, time, base64, io, asyncio, subprocess, tempfile, threading, functools, http.server, socketserver, shutil, urllib.request
from PIL import Image, ImageDraw
import websockets

ROOT = r'C:/dev/dark_station'
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'verify')
PORT, DBG = 18877, 19477
SHEETS = ['player', 'soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon']
VK = {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def browser():
    for c in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
        if os.path.exists(c):
            return c
    return shutil.which('chrome') or shutil.which('msedge')


class CDP:
    def __init__(self, ws):
        self.ws, self.n, self.pending, self.console = ws, 0, {}, []
        self.reader = asyncio.ensure_future(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if 'id' in msg and msg['id'] in self.pending:
                self.pending.pop(msg['id']).set_result(msg)
            elif msg.get('method') == 'Runtime.consoleAPICalled':
                a = msg['params']
                self.console.append(a['type'] + ': ' + ' '.join(str(x.get('value', x.get('description', ''))) for x in a.get('args', [])))
            elif msg.get('method') == 'Runtime.exceptionThrown':
                self.console.append('EXCEPTION ' + json.dumps(msg['params'].get('exceptionDetails', {}))[:400])

    async def send(self, method, params=None):
        self.n += 1
        mid = self.n
        fut = asyncio.get_event_loop().create_future()
        self.pending[mid] = fut
        await self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        msg = await fut
        if 'error' in msg:
            raise RuntimeError(msg['error'])
        return msg.get('result', {})

    async def ev(self, expr, await_promise=True):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': await_promise, 'returnByValue': True})
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:900])
        return r.get('result', {}).get('value')

    async def key(self, k, typ):
        await self.send('Input.dispatchKeyEvent', {'type': typ, 'key': k, 'code': k, 'windowsVirtualKeyCode': VK[k], 'nativeVirtualKeyCode': VK[k]})

    async def shot(self, path):
        r = await self.send('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))


SETUP = r"""
(() => {
  if (window.__u5) return 'already';
  const T = 32, R = window.RENDER, orig = R.draw;
  const origSid = ART.spriteId, origPerson = ART.person;
  const BL = document.createElement('canvas'); BL.width = 32; BL.height = 48;
  const offA = document.createElement('canvas'), offB = document.createElement('canvas');
  const U = window.__u5 = { on: false, frames: [], youSheet: null, npcAlias: false, inject: [], crop: true, lastPeople: [] };
  const magCache = new Map();
  const magenta = (im) => { if (magCache.has(im)) return magCache.get(im); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height); magCache.set(im, c); return c; };
  const alphaCache = new Map();
  const alphaOf = (key, im) => { if (alphaCache.has(key)) return alphaCache.get(key); const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data; const a = new Uint8Array(im.width * im.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0; const r = { a, w: im.width, h: im.height }; alphaCache.set(key, r); return r; };
  // 별칭: 당신 = '__y_<그림>' · 주민 = '__n_<id>' (그림 시트는 같은 것을 가리킨다)
  U.setYou = (sheet) => { U.youSheet = sheet; if (sheet) ART.IMG['v4/walk/__y_' + sheet] = ART.IMG['v4/walk/' + sheet] || ART.IMG['walk/' + sheet]; };
  U.setNpcAlias = (on) => { U.npcAlias = on; if (on) for (const id of ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon', 'player']) ART.IMG['v4/walk/__n_' + id] = ART.IMG['v4/walk/' + id] || ART.IMG['walk/' + id]; };
  ART.spriteId = (id) => { if (id === 'you') return U.youSheet ? '__y_' + U.youSheet : origSid(id); if (U.npcAlias) return '__n_' + origSid(id); return origSid(id); };
  const faceTo = (sc, x, y) => { const dx = sc.px - x, dy = sc.py - y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'); };
  // 대상 목록: [{who, sid, X, Y, frame, hurt, dir, breathOk}]
  function targetsOf(sc, people, opts) {
    const out = [];
    const mx = Math.round((sc.moving ? sc.px - sc.moving.dx * (1 - sc.moving.t) : sc.px) * T) / T;
    const my = Math.round((sc.moving ? sc.py - sc.moving.dy * (1 - sc.moving.t) : sc.py) * T) / T;
    out.push({ who: 'you', sid: ART.spriteId('you'), X: Math.round(mx * T), Y: Math.round(my * T), frame: sc.walkFrame || 0, hurt: Math.min(3, opts.youHurt || 0), dir: sc.face || 'down', breathOk: false });
    for (const p of people) {
      if (p.pose) continue;
      const frame = p.walkDist != null ? R.walkFrame(p.walkDist, !!p.moving) : (p.frame || 0);
      out.push({ who: p.id + (p.injected ? '*' : ''), sid: ART.spriteId(p.id), X: Math.round(p.x * T), Y: Math.round(p.y * T), frame, hurt: Math.min(3, p.injury || 0), dir: p.face || 'down', breathOk: true });
    }
    return out;
  }
  function overlays(stageRect, k) {
    const out = [];
    const add = (el, kind) => { if (!el) return; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return; out.push({ kind, x0: (r.left - stageRect.left) / k, y0: (r.top - stageRect.top) / k, x1: (r.right - stageRect.left) / k, y1: (r.bottom - stageRect.top) / k }); };
    document.querySelectorAll('#bubbles .bub').forEach((el) => add(el, 'bubble'));
    for (const id of ['toast', 'box', 'cg', 'fade']) { const el = document.getElementById(id); if (el && !el.hidden && getComputedStyle(el).display !== 'none' && (id !== 'fade' || +getComputedStyle(el).opacity > 0.01)) add(el, id); }
    return out;
  }
  function analyse(ctx, cv, sc, state, people, objs, tick, opts, self) {
    const W = cv.width, H = cv.height;
    for (const c of [offA, offB]) { if (c.width !== W) c.width = W; if (c.height !== H) c.height = H; }
    const tg = targetsOf(sc, people, opts);
    const want = U.only ? tg.filter((t) => U.only.includes(t.who.replace('*', ''))) : tg;
    const st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 480;
    const ov = overlays(st, k);
    const res = [];
    for (const t of want) {
      // 패스 A: 이 대상만 투명 · 패스 B: 이 대상만 자홍색
      ART.person = (id, ...a) => (id === t.sid ? BL : origPerson(id, ...a));
      try { orig.call(self, offA.getContext('2d'), offA, sc, state, people, objs, tick, opts); } finally { ART.person = origPerson; }
      ART.person = (id, ...a) => (id === t.sid ? magenta(origPerson(id, ...a)) : origPerson(id, ...a));
      try { orig.call(self, offB.getContext('2d'), offB, sc, state, people, objs, tick, opts); } finally { ART.person = origPerson; }
      const A = offA.getContext('2d').getImageData(0, 0, W, H).data, B = offB.getContext('2d').getImageData(0, 0, W, H).data;
      const im = origPerson(t.sid, t.frame, t.hurt, t.dir);
      const al = alphaOf(t.sid + ':' + t.frame + ':' + t.dir + ':' + im.width + 'x' + im.height, im);
      const X0 = t.X + Math.round((T - al.w) / 2) + sc.cam.ox, Y0 = t.Y + T - al.h + (t.frame ? 1 : 0) + sc.cam.oy;
      const headTop = ART.headTop(t.sid, t.frame, t.dir);
      const cut = al.h - (ART.PH - 28);
      let best = null;
      for (const b of t.breathOk ? [0, 1] : [0]) {
        let head = 0, headVis = 0, body = 0, bodyVis = 0, outC = 0; const rowsCut = [], rowsPart = [];
        const covered = new Uint8Array(W * H);
        for (let sy = 0; sy < al.h; sy++) {
          let rowN = 0, rowV = 0;
          for (let sx = 0; sx < al.w; sx++) {
            if (!al.a[sy * al.w + sx]) continue;
            const cx = X0 + sx, cy = Y0 + sy + (b && sy < cut ? b : 0);
            let v = false;
            if (cx >= 0 && cy >= 0 && cx < W && cy < H) { const i = (cy * W + cx) * 4; v = A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]; covered[cy * W + cx] = 1; } else outC++;
            body++; if (v) bodyVis++;
            if (sy >= headTop && sy < headTop + 14) { head++; rowN++; if (v) { headVis++; rowV++; } }
          }
          if (rowN && rowV === 0) rowsCut.push(sy); else if (rowN && rowV < rowN) rowsPart.push([sy, rowN - rowV]);
        }
        // 설명되지 않는 차이 픽셀(예상 자리 밖에 그 사람이 그려졌나) — 0 이어야 측정이 맞다
        let stray = 0;
        const yA = Math.max(0, Y0 - 20), yB = Math.min(H, Y0 + al.h + 6), xA = Math.max(0, X0 - 20), xB = Math.min(W, X0 + al.w + 20);
        for (let y = yA; y < yB; y++) for (let x = xA; x < xB; x++) { const i = (y * W + x) * 4; if ((A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) && !covered[y * W + x]) stray++; }
        const r = { b, head, headVis, body, bodyVis, outC, rowsCut, rowsPart: rowsPart.slice(0, 6), stray };
        if (!best || r.bodyVis - r.stray > best.bodyVis - best.stray) best = r;
      }
      // HTML 층이 머리 칸(머리 꼭대기~14줄, 그림 폭)을 덮는가
      const hx0 = X0, hx1 = X0 + al.w, hy0 = Y0 + headTop, hy1 = Y0 + headTop + 14;
      const ovHit = ov.filter((o) => o.x0 < hx1 && o.x1 > hx0 && o.y0 < hy1 && o.y1 > hy0).map((o) => o.kind + '@' + [o.x0, o.y0, o.x1, o.y1].map((v) => Math.round(v)).join(','));
      const r = { who: t.who, sid: t.sid, dir: t.dir, frame: t.frame, X0, Y0, headTop, ...best, ov: ovHit };
      if (U.crop) {
        const c = document.createElement('canvas'); c.width = 48; c.height = 72;
        c.getContext('2d').drawImage(cv, X0 - 8, Y0 - 20, 48, 72, 0, 0, 48, 72);
        r.img = c.toDataURL('image/png');
      }
      res.push(r);
    }
    return res;
  }
  R.draw = function (ctx, cv, sc, state, people, objs, tick, opts) {
    if (U.inject && U.inject.length) people = people.concat(U.inject.map((p) => Object.assign({ injected: true, pose: null, injury: 0, talkable: false }, p, { face: Math.abs(sc.px - p.x) + Math.abs(sc.py - p.y) <= 3 ? faceTo(sc, p.x, p.y) : 'down' })));
    const r = orig.call(this, ctx, cv, sc, state, people, objs, tick, opts);
    U.lastPeople = people.map((p) => [p.id, p.x, p.y, p.face, p.pose || '']);
    if (!U.on) return r;
    const m = sc.moving;
    const f = { t: performance.now(), tick, px: sc.px, py: sc.py, mt: m ? +m.t.toFixed(3) : null, face: sc.face, wf: sc.walkFrame, ox: sc.cam.ox, oy: sc.cam.oy, steps: sc.steps };
    try { f.res = analyse(ctx, cv, sc, state, people, objs, tick, opts || {}, this); } catch (e) { f.err = String(e && e.stack || e); }
    U.frames.push(f);
    return r;
  };
  return 'ok';
})()
"""

FREE_JS = r"""
((x, y) => {
  const s = __ds4.scene; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const t = s.rows[y][x];
  if ('#tRhDCk~'.includes(t)) return false;
  if (__ds4.objectsOnMap().some((o) => o.x === x && o.y === y && o.solid)) return false;
  if (__ds4.peopleOnMap().some((p) => p.x === x && p.y === y)) return false;
  if ((__u5.inject || []).some((p) => p.x === x && p.y === y)) return false;
  return true;
})"""


async def wait_idle(c, limit=30):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await c.ev("!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", False):
            return True
        await asyncio.sleep(0.05)
    return False


async def place(c, x, y, face):
    await c.ev(f"(() => {{ const s = __ds4.scene; s.moving = null; s.auto = null; s.queued = null; s.px = {x}; s.py = {y}; s.face = '{face}'; s.walkDist = 0; return 1; }})()", False)
    await asyncio.sleep(0.12)


async def rec(c, on):
    if on:
        await c.ev("(() => { __u5.frames = []; __u5.on = true; return 1; })()", False)
        return None
    return await c.ev("(() => { __u5.on = false; const f = __u5.frames; __u5.frames = []; return f; })()", False)


async def walk(c, key, tiles, limit=3.5):
    s0 = await c.ev('__ds4.scene.steps', False)
    await rec(c, True)
    await asyncio.sleep(0.12)
    await c.key(key, 'keyDown')
    t0 = time.time()
    while time.time() - t0 < limit:
        if await c.ev('__ds4.scene.steps', False) - s0 >= tiles:
            break
        await asyncio.sleep(0.01)
    await c.key(key, 'keyUp')
    await wait_idle(c, 3)
    await asyncio.sleep(0.25)
    fr = await rec(c, False)
    return fr, (await c.ev('__ds4.scene.steps', False)) - s0


def crop_of(r):
    return Image.open(io.BytesIO(base64.b64decode(r['img'].split(',')[1]))).convert('RGB')


def bad(r):
    return r['headVis'] < r['head'] or r['outC'] > 0 or bool(r['ov']) or r['stray'] > 0


async def main():
    os.makedirs(OUTD, exist_ok=True)
    httpd = serve()
    prof = tempfile.mkdtemp(prefix='ds_u5v_')
    proc = subprocess.Popen([browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    summary = {'walk': {}, 'turn': {}, 'notes': []}
    allbad = []
    picks = {}          # (sheet, dir) → {'S': crop, 'L': crop, 'R': crop}
    turn_crops = {}     # (npc, dir) → crop
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
            await c.send('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 720, 'deviceScaleFactor': 1, 'mobile': False})
            await c.send('Page.navigate', {'url': f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=morning3&seed=7&u5={int(time.time())}'})
            t0 = time.time()
            while time.time() - t0 < 300:
                try:
                    v = await c.ev("(() => { const d = window.__ds4; if (!d || !d.state || !d.scene || !d.scene.map) return null; return { day: d.state.day, ph: d.state.phase, map: d.scene.map.id, bot: !!d.UI.bot, open: d.UI.isOpen(), auto: !!d.scene.auto, mv: !!d.scene.moving, px: d.scene.px, py: d.scene.py }; })()", False)
                except Exception:
                    v = None
                if v and v['day'] == 3 and v['ph'] == 'trace' and v['map'] == 'station' and not v['bot'] and not v['open'] and not v['auto'] and not v['mv']:
                    break
                await asyncio.sleep(0.4)
            print('ready', v)
            print('setup', await c.ev(SETUP, False))
            await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return __ds4.E.DELAYS.step; })()", False)
            env = await c.ev("(() => ({ iw: innerWidth, ih: innerHeight, app: getComputedStyle(document.getElementById('app')).transform, walkSrc: Object.fromEntries(['player','soonrye','seoha','gicheol','eunji','dongha','mari','eunchae','dohyeon'].map((n) => [n, ART.IMG['v4/walk/' + n] ? 'v4' : (ART.IMG['walk/' + n] ? 'v3' : 'none')])), people: __ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.face, p.pose]) }))()", False)
            print('env', env)
            summary['env'] = env

            # ── A. 9장 걷기 그림을 '당신'으로 끼워 실제 키 입력으로 걷는다 ──
            LANES = [('up', (24, 7, 'up'), 'ArrowUp', 4), ('down', (24, 1, 'down'), 'ArrowDown', 4),
                     ('right', (17, 5, 'right'), 'ArrowRight', 4), ('left', (26, 5, 'left'), 'ArrowLeft', 4),
                     ('up_topedge', (25, 3, 'up'), 'ArrowUp', 3),                     # 지도 맨 윗줄까지 (카메라 위 끝)
                     ('left_under_npcs', (26, 12, 'left'), 'ArrowLeft', 6),            # 승강장 끝선: 동하(23,11)·은지(21,11) 바로 아래를 지난다
                     ('up_platform', (25, 12, 'up'), 'ArrowUp', 3),                    # 무덤(24,11)·잔해(26,9) 옆으로 올라간다
                     ('down_door', (19, 6, 'down'), 'ArrowDown', 3),                   # 문(19,8)을 지나 승강장으로
                     ('right_fire', (10, 12, 'right'), 'ArrowRight', 5)]               # 화로(13,10) 앞 끝선을 지난다
            await c.ev("__u5.only = ['you']", False)
            for sheet in SHEETS:
                await c.ev(f"__u5.setYou('{sheet}')", False)
                sres = {}
                for name, (x, y, face), key, n in LANES:
                    await place(c, x, y, face)
                    fr, moved = await walk(c, key, n)
                    rows = [(f, r) for f in fr for r in f.get('res', [])]
                    errs = [f['err'] for f in fr if f.get('err')]
                    b = [(f, r) for f, r in rows if bad(r)]
                    frames_seq = ''.join('SLR'[r['frame']] for f, r in rows)
                    sres[name] = {'frames': len(rows), 'tiles_moved': moved, 'walk_seq': frames_seq, 'bad_frames': len(b),
                                  'head_px_min_ratio': round(min((r['headVis'] / r['head']) for f, r in rows), 4) if rows else None,
                                  'stray_max': max((r['stray'] for f, r in rows), default=None), 'errors': errs[:2],
                                  'dirs_seen': sorted({r['dir'] for f, r in rows})}
                    for f, r in b:
                        allbad.append({'part': 'walk', 'sheet': sheet, 'lane': name, 'mt': f['mt'], 'px': f['px'], 'py': f['py'], **{k: v for k, v in r.items() if k != 'img'}})
                    if name in ('up', 'down', 'left', 'right'):
                        d = {'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right'}[name]
                        slot = picks.setdefault((sheet, d), {})
                        # 서 있는 칸(시작) · 왼발 한가운데 · 오른발 한가운데 (프레임 번호가 이어지는 구간의 가운데)
                        for want, lab in ((0, 'S'), (1, 'L'), (2, 'R')):
                            run = [r for f, r in rows if r['frame'] == want and r['dir'] == d]
                            if run:
                                slot[lab] = run[len(run) // 2] if want else run[0]
                    if b:
                        slot = picks.setdefault((sheet, 'BAD'), {})
                        for f, r in b[:3]:
                            slot[f'{name}#{len(slot)}'] = r
                    print(sheet, name, json.dumps(sres[name], ensure_ascii=False))
                summary['walk'][sheet] = sres
                # 걷는 도중 전체 화면 한 장 (HTML 층 포함) — 위로 걷기
                if sheet in ('player', 'seoha'):
                    await place(c, 24, 7, 'up')
                    await c.key('ArrowUp', 'keyDown')
                    await asyncio.sleep(0.34)
                    await c.shot(os.path.join(OUTD, f'U5_full_walkup_{sheet}.png'))
                    await c.key('ArrowUp', 'keyUp')
                    await wait_idle(c, 3)
            await c.ev("__u5.setYou(null)", False)

            # ── B. 주민 돌기: 당신이 실제로 걸어가(goto) 네 방향 옆에 서면 주민이 돌아본다 ──
            await c.ev("__u5.setNpcAlias(true)", False)
            await c.ev("__u5.inject = [{ id: 'eunchae', x: 24, y: 6 }, { id: 'dohyeon', x: 6, y: 5 }]", False)
            await place(c, 13, 12, 'up')
            ppl = await c.ev("__ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose || ''])", False)
            ppl = [p for p in ppl if not p[3]] + [['eunchae', 24, 6, 'injected'], ['dohyeon', 6, 5, 'injected']]
            free = FREE_JS
            for pid, nx, ny, how in ppl:
                tres = {}
                for d, (dx, dy) in (('up', (0, -1)), ('down', (0, 1)), ('left', (-1, 0)), ('right', (1, 0))):
                    spot = None
                    for k in (1, 2, 3):
                        tx, ty = nx + dx * k, ny + dy * k
                        if await c.ev(f"{free}({tx}, {ty})", False):
                            spot = (tx, ty)
                            break
                    if not spot:
                        tres[d] = {'skip': 'no free tile within 3'}
                        continue
                    ok = await c.ev(f"__ds4.walkTo({spot[0]}, {spot[1]})", False)
                    how_reach = 'walk'
                    await c.ev(f"__u5.only = ['{pid}']", False)
                    await rec(c, True)
                    if ok:
                        await wait_idle(c, 12)
                    pos = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
                    if not ok or pos != list(spot):
                        await place(c, spot[0], spot[1], 'down')
                        how_reach = 'placed'
                    await asyncio.sleep(0.35)
                    fr = await rec(c, False)
                    rows = [(f, r) for f in fr for r in f.get('res', [])]
                    fin = [r for f, r in rows if r['dir'] == d]
                    b = [(f, r) for f, r in rows if bad(r)]
                    tres[d] = {'you_at': spot, 'reach': how_reach, 'frames': len(rows), 'frames_facing_dir': len(fin), 'bad_frames': len(b),
                               'dirs_seen': sorted({r['dir'] for f, r in rows}),
                               'head_px_min_ratio': round(min((r['headVis'] / r['head']) for f, r in rows), 4) if rows else None,
                               'stray_max': max((r['stray'] for f, r in rows), default=None), 'breath_seen': sorted({r['b'] for f, r in rows}),
                               'errors': [f['err'] for f in fr if f.get('err')][:2]}
                    for f, r in b:
                        allbad.append({'part': 'turn', 'npc': pid, 'how': how, 'want_dir': d, 'you': [f['px'], f['py']], **{k: v for k, v in r.items() if k != 'img'}})
                    if fin:
                        turn_crops[(pid, d)] = fin[-1]
                    print('turn', pid, how, d, json.dumps(tres[d], ensure_ascii=False))
                summary['turn'][pid + ('*' if how == 'injected' else '')] = tres
            await c.ev("__u5.inject = []; __u5.setNpcAlias(false); __u5.only = null", False)
            # 주민 돌기 장면 전체 화면 (마리·동하 둘레)
            await place(c, 22, 12, 'up')
            await asyncio.sleep(0.3)
            await c.shot(os.path.join(OUTD, 'U5_full_npc_turn_platform.png'))
            summary['console'] = [x for x in c.console if x.startswith('error') or x.startswith('EXCEPTION')][:20]
    finally:
        proc.terminate()
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)

    # ── 그림: 9명 × 4방향 × (서기·왼발·오른발) 실제 게임 화면 잘라 3배 ──
    K = 3
    CW, CH = 48 * K, 72 * K
    dirs = ['down', 'left', 'right', 'up']
    sheet_im = Image.new('RGB', (90 + len(dirs) * 3 * (CW + 4), 40 + len(SHEETS) * (CH + 8)), (22, 22, 22))
    d = ImageDraw.Draw(sheet_im)
    for j, dr in enumerate(dirs):
        for k2, lab in enumerate('SLR'):
            d.text((90 + (j * 3 + k2) * (CW + 4) + 4, 6), f'{dr} {"stand" if lab == "S" else lab + "-foot"}', fill=(255, 230, 120))
    for i, s in enumerate(SHEETS):
        y0 = 40 + i * (CH + 8)
        d.text((6, y0 + CH // 2), s, fill=(255, 255, 255))
        for j, dr in enumerate(dirs):
            slot = picks.get((s, dr), {})
            for k2, lab in enumerate('SLR'):
                x0 = 90 + (j * 3 + k2) * (CW + 4)
                r = slot.get(lab)
                if not r:
                    d.rectangle([x0, y0, x0 + CW, y0 + CH], outline=(255, 0, 0))
                    d.text((x0 + 4, y0 + 4), 'missing', fill=(255, 0, 0))
                    continue
                sheet_im.paste(crop_of(r).resize((CW, CH), Image.NEAREST), (x0, y0))
                col = (60, 200, 90) if not bad(r) else (255, 40, 40)
                d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], outline=col)
                d.text((x0 + 3, y0 + CH - 12), f"head {r['headVis']}/{r['head']}", fill=col)
    sheet_im.save(os.path.join(OUTD, 'U5_ingame_4dir.png'))

    # 주민 돌기 그림
    npcs = list(summary['turn'].keys())
    t_im = Image.new('RGB', (90 + 4 * (CW + 4), 30 + len(npcs) * (CH + 8)), (22, 22, 22))
    d = ImageDraw.Draw(t_im)
    for j, dr in enumerate(dirs):
        d.text((90 + j * (CW + 4) + 4, 8), 'faces ' + dr, fill=(255, 230, 120))
    for i, n in enumerate(npcs):
        y0 = 30 + i * (CH + 8)
        d.text((6, y0 + CH // 2), n, fill=(255, 255, 255))
        for j, dr in enumerate(dirs):
            x0 = 90 + j * (CW + 4)
            r = turn_crops.get((n.rstrip('*'), dr))
            if not r:
                d.rectangle([x0, y0, x0 + CW, y0 + CH], outline=(255, 0, 0)); d.text((x0 + 4, y0 + 4), 'missing', fill=(255, 0, 0)); continue
            t_im.paste(crop_of(r).resize((CW, CH), Image.NEAREST), (x0, y0))
            col = (60, 200, 90) if not bad(r) else (255, 40, 40)
            d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], outline=col)
            d.text((x0 + 3, y0 + CH - 12), f"head {r['headVis']}/{r['head']}", fill=col)
    t_im.save(os.path.join(OUTD, 'U5_ingame_npc_turn.png'))

    # 나쁜 프레임 모음
    badlist = [(k, r) for k, v in picks.items() if k[1] == 'BAD' for r in v.values()]
    if badlist:
        b_im = Image.new('RGB', (min(12, len(badlist)) * (CW + 4) + 4, ((len(badlist) + 11) // 12) * (CH + 30) + 4), (22, 22, 22))
        d = ImageDraw.Draw(b_im)
        for i, (k, r) in enumerate(badlist):
            x0, y0 = 4 + (i % 12) * (CW + 4), 4 + (i // 12) * (CH + 30)
            b_im.paste(crop_of(r).resize((CW, CH), Image.NEAREST), (x0, y0 + 26))
            d.text((x0, y0), f"{k[0]} {r['dir']}{r['frame']}", fill=(255, 120, 120))
            d.text((x0, y0 + 12), f"h{r['headVis']}/{r['head']} o{r['outC']} ov{len(r['ov'])}", fill=(255, 120, 120))
        b_im.save(os.path.join(OUTD, 'U5_bad_frames.png'))
    summary['bad_total'] = len(allbad)
    summary['bad'] = allbad[:400]
    with open(os.path.join(OUTD, 'U5_ingame_result.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    print('BAD TOTAL', len(allbad))


if __name__ == '__main__':
    asyncio.run(main())
