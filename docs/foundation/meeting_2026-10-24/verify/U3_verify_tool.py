# U3 adversarial verification (2026-10-24). Does NOT modify game files. Writes only to docs/.../verify/U3_*.
# Runs the real v4 game in headless Chrome via DevTools and measures frames.
import os, sys, json, time, base64, io, asyncio, subprocess, tempfile, threading, functools, http.server, socketserver, shutil, urllib.request
from PIL import Image, ImageDraw
import websockets

ROOT = r'C:\dev\dark_station'
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'verify')
PORT, DBG = 18911, 19611
T = 32
VK = {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, ' ': 32, 'Enter': 13, 'Shift': 16}


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


# Injected before any page script. MODE: real (native rAF) | shim<Hz> (setTimeout clocked like a monitor) | dead (rAF never fires = hidden window)
INIT = r"""
(() => {
  const MODE = '%s';
  const nat = window.requestAnimationFrame.bind(window);
  const R = window.__raf = { req: 0, cb: 0, inCb: false, mode: MODE };
  let impl = nat;
  if (MODE.startsWith('shim')) {
    const HZ = +MODE.slice(4), P = 1000 / HZ; let next = 0, q = [], armed = false;
    const fire = () => { armed = false; const cbs = q; q = []; const t = performance.now(); next = t; for (const f of cbs) { try { f(t); } catch (e) { setTimeout(() => { throw e; }); } } };
    impl = (cb) => { q.push(cb); if (!armed) { armed = true; const now = performance.now(); setTimeout(fire, Math.max(0, next + P - now)); } return q.length; };
  } else if (MODE === 'dead') impl = () => 0;
  R.dur = []; window.requestAnimationFrame = (cb) => { R.req++; return impl((t) => { R.cb++; R.inCb = true; const a = performance.now(); try { cb(t); } finally { R.inCb = false; if (R.dur.length < 5000) R.dur.push(performance.now() - a); } }); };
})();
"""

# Recorder: wraps RENDER.draw, and hooks drawImage/fillRect on the main canvas only while a draw is running.
REC = r"""
(() => {
  if (window.__rec) return 'already';
  const R = window.RENDER, orig = R.draw;
  const main = document.getElementById('cv').getContext('2d');
  const rc = window.__rec = { on: false, snap: false, frames: [], watchFire: null };
  const ids = new WeakMap(); let nid = 1; const idOf = (o) => { if (!ids.has(o)) ids.set(o, nid++); return ids.get(o); };
  rc.idOf = idOf;
  let cur = null;
  const P = CanvasRenderingContext2D.prototype, od = P.drawImage, ofr = P.fillRect;
  P.drawImage = function (src, ...a) {
    if (cur && this === main && src) {
      const n = a.length, dx = n === 2 || n === 4 ? a[0] : a[4], dy = n === 2 || n === 4 ? a[1] : a[5];
      const sy = n === 8 ? a[1] : 0, sh = n === 8 ? a[3] : src.height;
      if (src.width === 10 && src.height === 14) cur.flame.push(idOf(src));
      if (src.height >= 40 && src.height <= 64) {
        const y = cur.you;
        if (Math.abs(dx - (y.X + Math.round((32 - src.width) / 2))) <= 1 && dy >= y.Y + 32 - src.height - 2 && dy <= y.Y + 32 - src.height + 3) cur.youDraw.push({ id: idOf(src), dy: dy - (y.Y + 32 - src.height), sy, sh, h: src.height, n });
        for (const p of cur.ppl) {
          if (Math.abs(dx - (p.X + Math.round((32 - src.width) / 2))) <= 1 && dy >= p.Y + 32 - src.height - 2 && dy <= p.Y + 32 - src.height + 3) p.d.push({ id: idOf(src), off: dy - (p.Y + 32 - src.height), sy, sh, n });
        }
      }
      if (rc.watchFire && dx >= rc.watchFire[0] - 4 && dx <= rc.watchFire[0] + 36 && dy >= rc.watchFire[1] - 40 && dy <= rc.watchFire[1] + 32 && src.width >= 16) cur.fireSrc.push(idOf(src));
      if (n === 8 && a[0] === 10 && a[1] === 13 && a[2] === 12 && a[3] === 14) cur.sleepPatch++;
    }
    return od.call(this, src, ...a);
  };
  P.fillRect = function (x, y, w, h) {
    if (cur && this === main && w === 1 && h === 1 && String(this.fillStyle).replace(/\s/g, '').startsWith('rgba(255,214,140')) cur.spark++;
    return ofr.apply(this, arguments);
  };
  R.draw = function (ctx, cv, sc, state, people, objs, tick, opts) {
    if (!rc.on) return orig.apply(this, arguments);
    const m = sc.moving;
    const mx = m ? sc.px - m.dx * (1 - m.t) : sc.px, my = m ? sc.py - m.dy * (1 - m.t) : sc.py;
    cur = { you: { X: Math.round(mx * 32), Y: Math.round(my * 32) }, youDraw: [], flame: [], spark: 0, fireSrc: [], sleepPatch: 0,
            ppl: people.filter((p) => !p.pose).map((p) => ({ id: p.id, X: Math.round(p.x * 32), Y: Math.round(p.y * 32), d: [] })) };
    const t0 = performance.now();
    let r;
    try { r = orig.apply(this, arguments); } finally {
      const t1 = performance.now();
      const f = { t: t0, drawMs: +(t1 - t0).toFixed(2), inRaf: !!(window.__raf && window.__raf.inCb), tick, px: sc.px, py: sc.py, mt: m ? +m.t.toFixed(4) : null,
        mx: +mx.toFixed(5), my: +my.toFixed(5), X: cur.you.X, Y: cur.you.Y, steps: sc.steps, face: sc.face, wf: sc.walkFrame, wd: +(sc.walkDist || 0).toFixed(3),
        ox: sc.cam ? sc.cam.ox : 0, oy: sc.cam ? sc.cam.oy : 0, youDraw: cur.youDraw, flame: cur.flame, spark: cur.spark, fireSrc: cur.fireSrc, sleepPatch: cur.sleepPatch,
        ppl: cur.ppl.map((p) => [p.id, p.d]), phase: state.phase, nLying: people.filter((p) => p.pose === 'lying').length };
      if (rc.snap) f.img = cv.toDataURL('image/png');
      rc.frames.push(f);
      cur = null;
    }
    return r;
  };
  return 'ok';
})()
"""


class CDP:
    def __init__(self, ws):
        self.ws, self.n, self.console, self.init = ws, 0, [], None
        self.pending = {}
        self.reader = asyncio.ensure_future(self._read())

    async def _read(self):
        async for msg in self.ws:
            m = json.loads(msg)
            if 'id' in m and m['id'] in self.pending:
                self.pending.pop(m['id']).set_result(m)
            elif m.get('method') == 'Runtime.consoleAPICalled':
                p = m['params']
                self.console.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args']))
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                self.console.append('EXCEPTION: ' + str(d.get('exception', {}).get('description', d.get('text'))))

    async def send(self, method, params=None, sid=None):
        self.n += 1
        i = self.n
        fut = asyncio.get_event_loop().create_future()
        self.pending[i] = fut
        msg = {'id': i, 'method': method, 'params': params or {}}
        await self.ws.send(json.dumps(msg))
        m = await asyncio.wait_for(fut, 180)
        if 'error' in m:
            raise RuntimeError(m['error'])
        return m.get('result', {})

    async def ev(self, expr, await_promise=False):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': await_promise, 'returnByValue': True})
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:800])
        return r.get('result', {}).get('value')

    async def open(self, url, mode='real', w=1280, h=720):
        if self.init:
            await self.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': self.init})
        self.init = (await self.send('Page.addScriptToEvaluateOnNewDocument', {'source': INIT % mode}))['identifier']
        await self.send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': False})
        self.console = []
        await self.send('Page.navigate', {'url': f'http://127.0.0.1:{PORT}' + url})
        await asyncio.sleep(0.8)

    async def wait(self, cond, limit=400):
        t0 = time.time()
        while time.time() - t0 < limit:
            try:
                v = await self.ev(f'(() => {{ try {{ return !!({cond}); }} catch (e) {{ return false; }} }})()')
            except Exception:
                v = False
            if v:
                return True
            await asyncio.sleep(0.15)
        raise SystemExit('timeout waiting: ' + cond)

    async def key(self, k, typ):
        await self.send('Input.dispatchKeyEvent', {'type': typ, 'key': k, 'code': k, 'windowsVirtualKeyCode': VK.get(k, 0), 'nativeVirtualKeyCode': VK.get(k, 0)})

    def errors(self):
        return [ln for ln in self.console if ln.startswith('error') or ln.startswith('EXCEPTION')]


IDLE = "!__ds4.UI.bot && !__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving"


async def goto(c, point, extra='', mode='real'):
    await c.open(f'/v4/index.html?fast=1&auto={point}&seed=7&v={int(time.time()*1000)}', mode=mode)
    await c.wait('__ds4.state && __ds4.scene.map && ' + IDLE + (' && ' + extra if extra else ''))
    await asyncio.sleep(0.3)
    await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return __ds4.E.DELAYS.step; })()")
    r = await c.ev(REC)
    return r


async def place(c, x, y, face):
    await c.ev(f"(() => {{ const s = __ds4.scene; s.moving = null; s.auto = null; s.queued = null; s.px = {x}; s.py = {y}; s.face = '{face}'; s.walkDist = 0; return 1; }})()")
    await asyncio.sleep(0.25)


async def rec(c, on, snap=False):
    if on:
        await c.ev(f"(() => {{ __rec.frames = []; __rec.snap = {str(snap).lower()}; __rec.on = true; return 1; }})()")
        return None
    return await c.ev("(() => { __rec.on = false; const f = __rec.frames; __rec.frames = []; return f; })()")


async def hold_tiles(c, key, tiles, limit=6.0, shift=False):
    s0 = await c.ev('__ds4.scene.steps')
    await rec(c, True)
    await asyncio.sleep(0.12)
    if shift:
        await c.key('Shift', 'keyDown')
    await c.key(key, 'keyDown')
    t0 = time.time()
    while time.time() - t0 < limit:
        s = await c.ev('__ds4.scene.steps')
        if s - s0 >= tiles:
            break
        await asyncio.sleep(0.005)
    await c.key(key, 'keyUp')
    if shift:
        await c.key('Shift', 'keyUp')
    await asyncio.sleep(0.5)
    return await rec(c, False)


def analyse(fr, axis='mx', sign=1, tiles=6, step_ms=230.0):
    """Per-tile time, stall frames (same logical position in 2 consecutive frames while walking), integer-pixel repeats,
    deviation from ideal straight line, frame dt, walk-beat check vs distance, foot +1px check, sprite ids per beat."""
    if not fr:
        return {'error': 'no frames'}
    v0 = fr[0][axis]
    pos = [(f['t'], (f[axis] - v0) * sign) for f in fr]
    cross = []
    for k in range(1, tiles + 1):
        for i in range(1, len(pos)):
            (ta, a), (tb, b) = pos[i - 1], pos[i]
            if a < k <= b:
                cross.append(ta + (tb - ta) * (k - a) / (b - a) if b != a else tb)
                break
    durs = [round(cross[i] - cross[i - 1], 1) for i in range(1, len(cross))]
    first = next((i for i, (_, p) in enumerate(pos) if p > 1e-6), None)
    last = next((i for i, (_, p) in enumerate(pos) if p >= tiles - 1e-6), None)
    if first is None or last is None:
        return {'error': 'did not walk %d tiles' % tiles, 'max_pos': max(p for _, p in pos)}
    seg = fr[first - 1:last + 1]
    stall = [i for i in range(1, len(seg)) if abs(seg[i][axis] - seg[i - 1][axis]) < 1e-6]
    ia = 'X' if axis == 'mx' else 'Y'
    intrep = [i for i in range(1, len(seg)) if seg[i][ia] == seg[i - 1][ia]]
    intrep2 = [i for i in range(2, len(seg)) if seg[i][ia] == seg[i - 1][ia] == seg[i - 2][ia]]   # same pixel 3 frames in a row
    dts = [seg[i]['t'] - seg[i - 1]['t'] for i in range(1, len(seg))]
    # deviation from ideal line: position(px) vs time since first movement, slope from per-tile avg
    t_first = seg[0]['t']
    avg = (sum(durs) / len(durs)) if durs else step_ms
    devs = []
    for f in seg[1:]:
        p = (f[axis] - v0) * sign * 32
        devs.append(p)
    # fit: p = a + b t (least squares)
    ts = [f['t'] - t_first for f in seg[1:]]
    n = len(ts)
    mt, mp = sum(ts) / n, sum(devs) / n
    b = sum((ts[i] - mt) * (devs[i] - mp) for i in range(n)) / max(1e-9, sum((x - mt) ** 2 for x in ts))
    a = mp - b * mt
    resid = [devs[i] - (a + b * ts[i]) for i in range(n)]
    # px moved per frame around tile boundaries (frame where steps increments) vs elsewhere
    bnd = []
    for i in range(1, len(seg)):
        if seg[i]['steps'] != seg[i - 1]['steps']:
            bnd.append(round(abs(seg[i][axis] - seg[i - 1][axis]) * 32, 2))
    allpx = [round(abs(seg[i][axis] - seg[i - 1][axis]) * 32, 2) for i in range(1, len(seg))]
    # walk beat check: while moving, wf must equal [1,0,2,0][floor(wd/16)%4]
    BEAT = [1, 0, 2, 0]
    beat_bad = [i for i, f in enumerate(seg) if f['mt'] is not None and f['wf'] != BEAT[int(max(0, f['wd']) // 16) % 4]]
    seq = ''.join('-' if f['wf'] is None else 'SLR'[f['wf']] for f in seg)
    # compress runs
    runs = []
    for ch in seq:
        if runs and runs[-1][0] == ch:
            runs[-1][1] += 1
        else:
            runs.append([ch, 1])
    order = ''.join(r[0] for r in runs)
    # foot offset & sprite identity per beat (from the actual drawImage call of 'you')
    foot = {'S': set(), 'L': set(), 'R': set()}
    ids = {'S': set(), 'L': set(), 'R': set()}
    nodraw = 0
    for f in seg:
        if f['wf'] is None:
            continue
        k = 'SLR'[f['wf']]
        if not f['youDraw']:
            nodraw += 1
            continue
        d = f['youDraw'][0]
        foot[k].add(d['dy'])
        ids[k].add(d['id'])
    inraf = sum(1 for f in fr if f['inRaf'])
    return {'tiles_crossed': len(cross), 'ms_per_tile': durs, 'ms_per_tile_avg': round(avg, 1),
            'frames_walking': len(seg), 'stall_frames_same_logical_pos': len(stall), 'same_int_pixel_consecutive': len(intrep), 'same_int_pixel_3_in_row': len(intrep2),
            'frame_dt_avg': round(sum(dts) / len(dts), 2), 'frame_dt_min': round(min(dts), 2), 'frame_dt_max': round(max(dts), 2),
            'px_per_frame_avg': round(sum(allpx) / len(allpx), 3), 'px_per_frame_max': max(allpx), 'px_at_tile_boundary': bnd,
            'line_fit_px_per_ms': round(b, 5), 'max_abs_deviation_from_line_px': round(max(abs(r) for r in resid), 2),
            'walk_beat_mismatch_frames': len(beat_bad), 'walk_beat_mismatch_detail': [(seg[i]['wd'], seg[i]['wf'], seg[i]['mt'], seg[i]['steps']) for i in beat_bad][:5], 'walk_beat_order': order, 'walk_beat_runs': [f'{r[0]}{r[1]}' for r in runs],
            'you_draw_dy_offset_by_beat': {k: sorted(v) for k, v in foot.items()}, 'you_sprite_ids_by_beat': {k: sorted(v) for k, v in ids.items()}, 'frames_without_you_draw': nodraw,
            'frames_from_rAF': inraf, 'frames_total': len(fr), 'draw_ms_avg': round(sum(f['drawMs'] for f in fr) / len(fr), 2), 'draw_ms_max': max(f['drawMs'] for f in fr)}


def img_of(f):
    return Image.open(io.BytesIO(base64.b64decode(f['img'].split(',')[1]))).convert('RGB')


def strip(frames, path, K=4, title=''):
    W, H = 48, 72
    out = Image.new('RGB', (len(frames) * (W * K + 6), H * K + 34), (24, 24, 24))
    d = ImageDraw.Draw(out)
    for i, f in enumerate(frames):
        im = img_of(f)
        sx, sy = f['X'] + f['ox'], f['Y'] + f['oy']
        x0, y0 = sx - 8, sy - 36
        cv = Image.new('RGB', (W, H), (255, 0, 255))
        cv.paste(im.crop((max(0, x0), max(0, y0), max(0, x0) + W, max(0, y0) + H)), (max(0, -x0), max(0, -y0)))
        big = cv.resize((W * K, H * K), Image.NEAREST)
        dd = ImageDraw.Draw(big)
        foot = (36 + 31) * K
        dd.line([(0, foot), (8, foot)], fill=(255, 40, 40))
        dd.line([(W * K - 9, foot), (W * K - 1, foot)], fill=(255, 40, 40))
        ox = i * (W * K + 6)
        out.paste(big, (ox, 34))
        wf = 'SLR'[f['wf']] if f['wf'] is not None else '-'
        dy = f['youDraw'][0]['dy'] if f['youDraw'] else '?'
        d.text((ox + 2, 2), f"#{i} {wf} dy+{dy}", fill=(255, 255, 255))
        d.text((ox + 2, 16), f"t={f['mt']} d={f['wd']}", fill=(200, 200, 120))
    out.save(path)


async def main():
    which = set(a for a in sys.argv[1:] if not a.startswith('--'))
    os.makedirs(OUTD, exist_ok=True)
    httpd = serve()
    prof = tempfile.mkdtemp(prefix='u3v_')
    br = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    proc = subprocess.Popen([br, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {}
    outfile = os.path.join(OUTD, 'U3_verify_' + ('_'.join(sorted(which)) if which else 'all') + '.json')
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
            READY_CAR = "__ds4.scene.map.id === 'car'"

            # ── 1. walking: 6+ tiles held, three clock conditions ──
            if not which or 'walk' in which:
                MODES = next((a.split('=', 1)[1].split(',') for a in sys.argv[1:] if a.startswith('--modes=')), ['real', 'shim60', 'shim144'])
                for mode in MODES:
                    await goto(c, 'car', READY_CAR, mode)
                    await place(c, 3, 3, 'right')
                    fr = await hold_tiles(c, 'ArrowRight', 7)
                    a = analyse(fr, 'mx', 1, 6)
                    a['raf_counters'] = await c.ev('({ req: __raf.req, cb: __raf.cb })')
                    a['console_errors'] = c.errors()
                    res[f'walk_hold_{mode}'] = a
                    print('walk', mode, json.dumps({k: v for k, v in a.items() if k not in ('px_at_tile_boundary',)}, ensure_ascii=False))
                    # running (Shift) 6 tiles: 230*0.55 = 126.5 ms per tile
                    await place(c, 3, 3, 'right')
                    fr = await hold_tiles(c, 'ArrowRight', 7, shift=True)
                    a = analyse(fr, 'mx', 1, 6, 126.5)
                    res[f'run_hold_{mode}'] = {k: a.get(k) for k in ('tiles_crossed', 'ms_per_tile', 'ms_per_tile_avg', 'stall_frames_same_logical_pos', 'max_abs_deviation_from_line_px', 'walk_beat_mismatch_frames', 'walk_beat_order', 'error')}
                    print('run', mode, json.dumps(res[f'run_hold_{mode}'], ensure_ascii=False))
                    # click-to-walk (auto path) 7 tiles: (3,3) -> (10,3)
                    await place(c, 3, 3, 'right')
                    await rec(c, True)
                    pt = await c.ev("(() => { const cv = document.getElementById('cv'), r = cv.getBoundingClientRect(), cam = __ds4.scene.cam; const lx = 10 * 32 + 16 + cam.ox, ly = 3 * 32 + 16 + cam.oy; return { x: r.left + lx / cv.width * r.width, y: r.top + ly / cv.height * r.height }; })()")
                    await c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pt['x'], 'y': pt['y']})
                    await c.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': pt['x'], 'y': pt['y'], 'button': 'left', 'clickCount': 1})
                    await c.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': pt['x'], 'y': pt['y'], 'button': 'left', 'clickCount': 1})
                    await asyncio.sleep(2.3)
                    fr = await rec(c, False)
                    a = analyse(fr, 'mx', 1, 6)
                    a['end'] = await c.ev('[__ds4.scene.px, __ds4.scene.py]')
                    res[f'click_walk_{mode}'] = {k: a.get(k) for k in ('tiles_crossed', 'ms_per_tile', 'ms_per_tile_avg', 'stall_frames_same_logical_pos', 'max_abs_deviation_from_line_px', 'walk_beat_order', 'end', 'error')}
                    print('click', mode, json.dumps(res[f'click_walk_{mode}'], ensure_ascii=False))

            # ── 2. short tap reservation (t>0.6) and tap too early (t<0.6), shim60 ──
            if not which or 'tap' in which:
                await goto(c, 'car', READY_CAR, 'shim60')
                out = {}
                for name, delay in (('late_tap_t~0.75', 0.172), ('early_tap_t~0.2', 0.045)):
                    await place(c, 6, 3, 'right')
                    await rec(c, True)
                    await c.key('ArrowRight', 'keyDown')
                    await asyncio.sleep(0.03)
                    await c.key('ArrowRight', 'keyUp')
                    await asyncio.sleep(delay)
                    mt = await c.ev('__ds4.scene.moving ? __ds4.scene.moving.t : null')
                    await c.key('ArrowDown', 'keyDown')
                    await asyncio.sleep(0.02)
                    await c.key('ArrowDown', 'keyUp')
                    await asyncio.sleep(0.9)
                    fr = await rec(c, False)
                    end = await c.ev('[__ds4.scene.px, __ds4.scene.py]')
                    # gap between the two tiles: frames with no movement between step 1 arrival and step 2 start
                    st = [(round(f['t'] - fr[0]['t']), f['steps'], f['mt'], f['px'], f['py']) for f in fr]
                    stall = 0
                    for i in range(1, len(fr)):
                        a_, b_ = fr[i - 1], fr[i]
                        if b_['steps'] == fr[0]['steps'] + 2 and a_['steps'] == fr[0]['steps'] + 1 and a_['mt'] is None:
                            stall += 1
                    # frames drawn standing still on the middle tile (7,3) between the two steps (0 = next step began in the same frame)
                    idx_down = next((i for i, f in enumerate(fr) if f['py'] == 4), None)
                    moving_none_between = sum(1 for f in fr[:idx_down] if f['px'] == 7 and f['py'] == 3 and f['mt'] is None) if idx_down is not None else None
                    around = [(round(f['t'] - fr[0]['t']), f['px'], f['py'], f['mt'], f['face']) for f in fr[max(0, (idx_down or 0) - 3):(idx_down or 0) + 3]]
                    out[name] = {'moving_t_when_tapped': mt, 'end': end, 'steps_taken': fr[-1]['steps'] - fr[0]['steps'] if fr else None,
                                 'frames_standing_on_(7,3)_between_steps': moving_none_between, 'frames_around_turn(t_ms,px,py,mt,face)': around}
                    print('tap', name, out[name])
                res['tap_reserve_shim60'] = out

            # ── 3. walk strip (snapshots) 2 tiles each direction, real rAF ──
            if not which or 'strip' in which:
                await goto(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'", 'real')
                out = {}
                for name, (x, y, face), key, axis, sign in [('right', (17, 5, 'right'), 'ArrowRight', 'mx', 1), ('left', (26, 5, 'left'), 'ArrowLeft', 'mx', -1),
                                                            ('down', (24, 1, 'down'), 'ArrowDown', 'my', 1), ('up', (24, 7, 'up'), 'ArrowUp', 'my', -1)]:
                    await place(c, x, y, face)
                    s0 = await c.ev('__ds4.scene.steps')
                    await rec(c, True, snap=True)
                    await asyncio.sleep(0.08)
                    await c.key(key, 'keyDown')
                    t0 = time.time()
                    while time.time() - t0 < 3:
                        if (await c.ev('__ds4.scene.steps')) - s0 >= 2:
                            break
                        await asyncio.sleep(0.005)
                    await c.key(key, 'keyUp')
                    await asyncio.sleep(0.4)
                    fr = await rec(c, False)
                    a = analyse(fr, axis, sign, 2)
                    out[name] = {k: a.get(k) for k in ('tiles_crossed', 'ms_per_tile', 'stall_frames_same_logical_pos', 'walk_beat_order', 'walk_beat_runs', 'walk_beat_mismatch_frames', 'you_draw_dy_offset_by_beat', 'you_sprite_ids_by_beat', 'frames_without_you_draw', 'error')}
                    # strip: frames where moving, sample every ~2nd frame, max 30
                    mv = [f for f in fr if f['mt'] is not None]
                    pick = mv[::max(1, len(mv) // 24)][:26]
                    if pick:
                        strip(pick + [fr[-1]], os.path.join(OUTD, f'U3_walk_strip_{name}.png'))
                    print('strip', name, json.dumps(out[name], ensure_ascii=False))
                res['walk_strip_real'] = out
                res['walk_strip_console_errors'] = c.errors()

            # ── 4. fire + breath at station (D3 morning), real rAF ──
            if not which or 'fire' in which:
                FP = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--firepoint=')), 'arrive')
                await goto(c, FP, "__ds4.scene.map.id === 'station'", 'real')
                info = await c.ev("(() => { const f = __ds4.db.maps.station.fire; const o = __ds4.objectsOnMap().find((o) => o.id === 'fire'); return { fire: f, obj: o ? { x: o.x, y: o.y, state: o.state } : null, drumOpen: !!ART.v4prop('drum_open'), people: __ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose || '']) }; })()")
                print('fire info', info)
                fx, fy = (info['obj']['x'], info['obj']['y']) if info['obj'] else tuple(info['fire'])
                await c.ev(f"(() => {{ __rec.watchFire = [{fx * 32}, {fy * 32}]; return 1; }})()")
                await place(c, fx, fy + 2, 'up')
                await rec(c, True)
                await asyncio.sleep(3.0)
                fr = await rec(c, False)
                seq = [f['flame'][0] if f['flame'] else None for f in fr]
                changes = sum(1 for i in range(1, len(seq)) if seq[i] != seq[i - 1])
                span = (fr[-1]['t'] - fr[0]['t']) / 1000
                # order of distinct ids
                order = []
                for s in seq:
                    if not order or order[-1] != s:
                        order.append(s)
                flames_per_frame = sorted(set(len(f['flame']) for f in fr))
                drum_id = await c.ev("__rec.idOf(ART.v4prop('drum_open'))")
                drum3 = await c.ev("(() => { try { return __rec.idOf(ART.prop('drum')); } catch (e) { return null; } })()")
                fire_src = sorted(set(i for f in fr for i in f['fireSrc']))
                ticks = [f['tick'] for f in fr]
                tick_changes = sum(1 for i in range(1, len(ticks)) if ticks[i] != ticks[i - 1])
                res['fire_real'] = {'info': info, 'frames': len(fr), 'span_s': round(span, 3), 'fps': round(len(fr) / span, 1),
                                    'flame_frame_changes': changes, 'flame_changes_per_s': round(changes / span, 2), 'distinct_flame_frames': len(set(s for s in seq if s is not None)),
                                    'flame_order_first25': order[:25], 'flame_draws_per_frame': flames_per_frame, 'sparks_per_frame': sorted(set(f['spark'] for f in fr)),
                                    'drum_open_id': drum_id, 'v3_drum_id': drum3, 'imgs_drawn_at_fire_cell_w>=16': fire_src,
                                    'tick_changes_3s': tick_changes, 'tick_span': ticks[-1] - ticks[0]}
                print('fire', json.dumps(res['fire_real'], ensure_ascii=False))
                # visual: 6 snapshots at 100ms apart of the fire cell, 6x
                await rec(c, True, snap=True)
                await asyncio.sleep(0.75)
                fr = await rec(c, False)
                keep, last = [], None
                for f in fr:
                    s = f['flame'][0] if f['flame'] else None
                    if s != last:
                        keep.append(f)
                        last = s
                keep = keep[:6]
                if keep:
                    K = 6
                    box_w, box_h = 48, 64
                    out = Image.new('RGB', (len(keep) * (box_w * K + 8), box_h * K + 24), (20, 20, 20))
                    d = ImageDraw.Draw(out)
                    for i, f in enumerate(keep):
                        im = img_of(f)
                        X, Y = fx * 32 + f['ox'] - 8, fy * 32 + f['oy'] - 32
                        out.paste(im.crop((X, Y, X + box_w, Y + box_h)).resize((box_w * K, box_h * K), Image.NEAREST), (i * (box_w * K + 8), 24))
                        d.text((i * (box_w * K + 8) + 4, 4), f"flame id {f['flame'][0] if f['flame'] else '-'}  t+{round(f['t'] - keep[0]['t'])}ms", fill=(255, 255, 255))
                    out.save(os.path.join(OUTD, 'U3_fire_frames.png'))
                # breath: go to morning3 (6 people standing), stand beside each person in turn (inside your light), 3 s each
                await goto(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'", 'real')
                ppl0 = await c.ev("(() => __ds4.peopleOnMap().filter((p) => !p.pose).map((p) => [p.id, p.x, p.y]))()")
                fr = []
                for pid0, x0, y0 in ppl0:
                    spot = None
                    for dx, dy in ((0, 1), (1, 1), (-1, 1), (1, 0), (-1, 0)):
                        ok = await c.ev(f"(() => {{ const d = __ds4; const t = d.scene.rows[{y0 + dy}] && d.scene.rows[{y0 + dy}][{x0 + dx}]; return !!t && !'#~=CB'.includes(t) && !d.peopleOnMap().some((p) => p.x === {x0 + dx} && p.y === {y0 + dy}); }})()")
                        if ok:
                            spot = (x0 + dx, y0 + dy)
                            break
                    if not spot:
                        continue
                    await place(c, spot[0], spot[1], 'up')
                    await rec(c, True)
                    await asyncio.sleep(3.0)
                    part = await rec(c, False)
                    for f in part:
                        f['ppl'] = [q for q in f['ppl'] if q[0] == pid0]
                    fr += part
                per = {}
                for f in fr:
                    for pid, ds in f['ppl']:
                        e = per.setdefault(pid, {'frames': 0, 'split': 0, 'offs': set(), 'changes': 0, 'last': None, 'nodraw': 0})
                        e['frames'] += 1
                        if not ds:
                            e['nodraw'] += 1
                            continue
                        b = 1 if any(x['sy'] == 0 and x['off'] == 1 and x['n'] == 8 for x in ds) else 0
                        e['split'] += b
                        for x in ds:
                            e['offs'].add((x['sy'], x['off'], x['n']))
                        if e['last'] is not None and e['last'] != b:
                            e['changes'] += 1
                            e.setdefault('tt', []).append(round(f['t']))
                        e['last'] = b
                lit = await c.ev("(() => __ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose || '']))()")
                res['breath_real'] = {'method': 'player stands next to each person 3 s (inside player light)', 'people': lit,
                                      'per_person': {k: {'frames': v['frames'], 'frames_upper_down_1px': v['split'], 'toggles': v['changes'], 'toggle_gaps_ms': [b - a for a, b in zip(v.get('tt', []), v.get('tt', [])[1:])], 'no_draw_frames': v['nodraw'], 'draw_variants(sy,offset,nargs)': sorted(v['offs'])} for k, v in per.items()}}
                print('breath', json.dumps(res['breath_real'], ensure_ascii=False))
                # breath visual: one person, frame with and without offset
                res['fire_breath_console_errors'] = c.errors()

            # ── 5. sleepers at night: no blanket breathing (BREATH_AT_NIGHT=false) ──
            if not which or 'night' in which:
                await goto(c, 'beds', "__ds4.state.phase === 'night'", 'real')
                await rec(c, True)
                await asyncio.sleep(3.5)
                fr = await rec(c, False)
                # detector sanity check: draw the same lying people with a fake daytime phase -> blanket patch must appear in about half the samples
                ctl = await c.ev("(() => { const d = __ds4; const cv = document.getElementById('cv'), ctx = cv.getContext('2d'); __rec.frames = []; __rec.on = true; const st = Object.assign({}, d.state, { phase: 'day' }); const ppl = d.peopleOnMap(); const base = performance.now(); for (let k = 0; k < 20; k++) RENDER.draw(ctx, cv, d.scene, st, ppl, d.objectsOnMap(), Math.floor((base + k * 150) / 33.3), { now: base + k * 150 }); __rec.on = false; const f = __rec.frames; __rec.frames = []; return f.map((x) => x.sleepPatch); })()")
                res['sleep_detector_control_fake_day'] = {'samples': len(ctl), 'samples_with_patch': sum(1 for v in ctl if v), 'patch_counts': ctl}
                res['sleep_night_real'] = {'frames': len(fr), 'lying_people': sorted(set(f['nLying'] for f in fr)), 'blanket_patch_draws': sum(f['sleepPatch'] for f in fr),
                                           'BREATH_AT_NIGHT': await c.ev('RENDER.BREATH_AT_NIGHT'), 'phase': fr[0]['phase'] if fr else None, 'console_errors': c.errors()}
                print('night', res['sleep_night_real'], res['sleep_detector_control_fake_day'])

            # ── 5b. walk sheets: are L / S / R really different pictures? (pixel diff of what the game draws) ──
            if not which or 'sprites' in which:
                await goto(c, 'car', READY_CAR, 'real')
                sp = await c.ev("""(() => { const ids = ['you','soonrye','gicheol','mari','seoha','eunji','dongha','dohyeon','eunchae']; const out = {};
                  const px = (cv) => { const g = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return { w: cv.width, h: cv.height, d: g }; };
                  const diff = (a, b) => { if (a.w !== b.w || a.h !== b.h) return 'size ' + a.w + 'x' + a.h + ' vs ' + b.w + 'x' + b.h; let n = 0; for (let i = 0; i < a.d.length; i += 4) { const oa = a.d[i + 3] > 0, ob = b.d[i + 3] > 0; if (oa !== ob || (oa && (a.d[i] !== b.d[i] || a.d[i + 1] !== b.d[i + 1] || a.d[i + 2] !== b.d[i + 2]))) n++; } return n; };
                  const opaque = (a) => { let n = 0; for (let i = 3; i < a.d.length; i += 4) if (a.d[i] > 0) n++; return n; };
                  for (const id of ids) { const sid = ART.spriteId(id); out[id] = { sid };
                    for (const dir of ['down','up','left','right']) { const f = [0, 1, 2].map((k) => px(ART.person(sid, k, 0, dir)));
                      out[id][dir] = { size: f[0].w + 'x' + f[0].h, opaqueS: opaque(f[0]), S_L: diff(f[0], f[1]), S_R: diff(f[0], f[2]), L_R: diff(f[1], f[2]) }; } }
                  return out; })()""")
                res['walk_sheet_frame_diffs'] = sp
                print('sprites', json.dumps(sp, ensure_ascii=False)[:1500])

            # ── 5c. whole frame() cost per rAF callback (update + draw + bubbles + panel), walking, in 3 scenes ──
            if not which or 'cost' in which:
                out = {}
                for point, cond, start, key in (('tunnel', "__ds4.scene.map.id === 'tunnel'", None, 'ArrowLeft'), ('morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'", (17, 5, 'right'), 'ArrowRight'), ('eve3', "__ds4.state.phase === 'evening'", None, 'ArrowLeft')):
                    await goto(c, point, cond, 'real')
                    if start:
                        await place(c, *start)
                    await c.ev('(() => { __raf.dur = []; return 1; })()')
                    await c.key(key, 'keyDown')
                    await asyncio.sleep(1.2)
                    await c.key(key, 'keyUp')
                    await asyncio.sleep(1.8)
                    d = await c.ev('__raf.dur')
                    d = sorted(d)
                    out[point] = {'callbacks': len(d), 'avg_ms': round(sum(d) / len(d), 2), 'p95_ms': round(d[int(len(d) * 0.95)], 2), 'max_ms': round(d[-1], 2), 'over_6.9ms(144Hz budget)': sum(1 for v in d if v > 6.9),
                                  'bubbles_in_dom': await c.ev("document.querySelectorAll('#bubbles .bub').length")}
                    print('cost', point, out[point])
                res['frame_cost_real'] = out
                res['frame_cost_console_errors'] = c.errors()

            # ── 6. hidden window: rAF never fires → fallback timer must keep the game going ──
            if not which or 'hidden' in which:
                t0 = time.time()
                await goto(c, 'car', READY_CAR, 'dead')
                reach = round(time.time() - t0, 1)
                await place(c, 3, 3, 'right')
                fr = await hold_tiles(c, 'ArrowRight', 3, limit=6.0)
                a = analyse(fr, 'mx', 1, 2)
                a['raf_counters'] = await c.ev('({ req: __raf.req, cb: __raf.cb })')
                res['hidden_dead_raf'] = {'reached_car_point_s': reach, **{k: a.get(k) for k in ('tiles_crossed', 'ms_per_tile', 'frame_dt_avg', 'frame_dt_max', 'frames_from_rAF', 'frames_total', 'stall_frames_same_logical_pos', 'walk_beat_order', 'raf_counters', 'error')}}
                # does the auto bot still reach a deeper point with rAF dead?
                t0 = time.time()
                await goto(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'", 'dead')
                res['hidden_dead_raf']['reached_morning3_s'] = round(time.time() - t0, 1)
                res['hidden_dead_raf']['console_errors'] = c.errors()
                print('hidden', json.dumps(res['hidden_dead_raf'], ensure_ascii=False))
                # real background tab: open another tab in front, check first tab visibility + frames
                await goto(c, 'car', READY_CAR, 'real')
                await rec(c, True)
                tgt = await c.send('Target.createTarget', {'url': 'about:blank'})
                await asyncio.sleep(0.3)
                vis = await c.ev('document.visibilityState')
                await asyncio.sleep(2.0)
                fr = await rec(c, False)
                await c.send('Target.closeTarget', {'targetId': tgt['targetId']})
                dts = [fr[i]['t'] - fr[i - 1]['t'] for i in range(1, len(fr))]
                res['background_tab_real'] = {'visibility': vis, 'frames_2s': len(fr), 'from_rAF': sum(1 for f in fr if f['inRaf']), 'dt_max': round(max(dts), 1) if dts else None}
                print('bgtab', res['background_tab_real'])
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)
        with open(outfile, 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1, default=lambda o: sorted(o) if isinstance(o, set) else str(o))
        print('wrote', outfile)


if __name__ == '__main__':
    asyncio.run(main())
