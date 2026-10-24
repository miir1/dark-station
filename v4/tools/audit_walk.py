# 검수용(2026-10-24 회의, U3 프레임 · U5 머리 잘림): 헤드리스 Chrome 을 DevTools 로 붙잡고 실제 게임에서 걷는 중간 프레임을 모두 찍는다.
# 게임 파일은 고치지 않는다 — 페이지 안에서 RENDER.draw 를 감싸 프레임마다 캔버스·위치·카메라를 기록할 뿐이다.
# 쓰기: python v4/tools/audit_walk.py   (C:\dev\dark_station 에서)
#   → docs/foundation/meeting_2026-10-24/audit_shots/  walk_<장면>_strip.png(당신 둘레를 프레임마다 4배로 잘라 이은 띠)
#                                                     walk_<장면>_full_<n>.png(그 순간 전체 화면 1280×720) · npc_face_*.png · walk_timing.json
#       python v4/tools/audit_walk.py --after   → 고친 뒤 다시 잰 것을 after_shots/screen_audit_walk_* 로 (검수 원본 audit_shots 는 그대로 둔다)
# 걷기 그림 번호: 화면이 scene.walkFrame(걸은 거리 4박자)을 남기면 그것, 없으면(고치기 전 코드) 예전 공식
import os, sys, json, time, base64, io, asyncio, subprocess, tempfile, threading, functools, http.server, socketserver, shutil, urllib.request
from PIL import Image, ImageDraw
import websockets

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
AFTER = '--after' in sys.argv
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots' if AFTER else 'audit_shots')
PFX = 'screen_audit_' if AFTER else ''
PORT, DBG = 8766, 9333
T, PH = 32, 48


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
        self.ws, self.n = ws, 0

    async def send(self, method, params=None):
        self.n += 1
        mid = self.n
        await self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError(msg['error'])
                return msg.get('result', {})

    async def ev(self, expr, await_promise=True):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': await_promise, 'returnByValue': True})
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:600])
        return r.get('result', {}).get('value')

    async def shot(self, path):
        r = await self.send('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))


# 페이지 안 기록기: RENDER.draw 를 감싸 프레임마다 기록. snap 이면 캔버스 그림도.
REC = r"""
(() => {
  if (window.__rec) return 'already';
  const R = window.RENDER, orig = R.draw;
  window.__rec = { on: false, snap: false, frames: [] };
  R.draw = function (ctx, cv, sc, state, people, objs, tick, opts) {
    const t0 = performance.now();
    orig.apply(this, arguments);
    const t1 = performance.now();
    const rc = window.__rec;
    if (!rc.on) return;
    const m = sc.moving;
    const mx = m ? sc.px - m.dx * (1 - m.t) : sc.px, my = m ? sc.py - m.dy * (1 - m.t) : sc.py;
    const fr = sc.walkFrame != null ? sc.walkFrame : (m && m.t > 0.15 && m.t < 0.85 ? (sc.steps % 2 ? 1 : 2) : 0);
    const f = { t: t0, drawMs: +(t1 - t0).toFixed(2), tick, px: sc.px, py: sc.py, mt: m ? +m.t.toFixed(3) : null, mx: +mx.toFixed(4), my: +my.toFixed(4),
      sx: Math.round(mx * 32) + sc.cam.ox, sy: Math.round(my * 32) + sc.cam.oy, frame: fr, face: sc.face, ox: sc.cam.ox, oy: sc.cam.oy, steps: sc.steps,
      people: people.map((p) => [p.id, p.x, p.y, p.face, p.pose || '']) };
    if (rc.snap) f.img = cv.toDataURL('image/png');
    rc.frames.push(f);
  };
  return 'ok';
})()
"""


async def wait_ready(c, limit=240):
    t0 = time.time()
    while time.time() - t0 < limit:
        try:
            v = await c.ev("(() => { const d = window.__ds4; if (!d || !d.state || !d.scene || !d.scene.map) return null; return { day: d.state.day, ph: d.state.phase, map: d.scene.map.id, px: d.scene.px, py: d.scene.py, open: d.UI.isOpen(), auto: !!d.scene.auto, mv: !!d.scene.moving }; })()", False)
        except Exception:
            v = None
        if v and v['day'] == 3 and v['ph'] == 'trace' and v['map'] == 'station' and not v['open'] and not v['auto'] and not v['mv'] and v['px'] == 13 and v['py'] == 12:
            return v
        await asyncio.sleep(0.5)
    raise SystemExit('morning3 지점에 닿지 못했다')


async def place(c, x, y, face):
    await c.ev(f"(() => {{ const s = __ds4.scene; s.moving = null; s.auto = null; s.px = {x}; s.py = {y}; s.face = '{face}'; if ('walkDist' in s) s.walkDist = 0; return 1; }})()", False)
    await asyncio.sleep(0.15)


async def hold(c, key, ms, snap=True):
    await c.ev(f"(() => {{ __rec.frames = []; __rec.snap = {str(snap).lower()}; __rec.on = true; return 1; }})()", False)
    await asyncio.sleep(0.12)
    await c.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': key, 'code': key, 'windowsVirtualKeyCode': {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39}[key]})
    await asyncio.sleep(ms / 1000)
    await c.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': key, 'code': key, 'windowsVirtualKeyCode': {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39}[key]})
    await asyncio.sleep(0.45)
    fr = await c.ev("(() => { __rec.on = false; const f = __rec.frames; __rec.frames = []; return f; })()", False)
    return fr


def strip(frames, path, K=4, max_n=40):
    """당신 둘레(가로 48 · 세로 80, 머리 위 여백 16)를 프레임마다 잘라 K배로 이은 띠. 빨간 선 = 캔버스 맨 윗줄(y=0)."""
    fs = [f for f in frames if 'img' in f][:max_n]
    if not fs:
        return
    W, H = 48, 84
    out = Image.new('RGB', (len(fs) * (W * K + 4), H * K + 28), (30, 30, 30))
    d = ImageDraw.Draw(out)
    for i, f in enumerate(fs):
        im = Image.open(io.BytesIO(base64.b64decode(f['img'].split(',')[1]))).convert('RGB')
        x0, y0 = f['sx'] - 8, f['sy'] - (PH - T) - 20
        canvas = Image.new('RGB', (W, H), (255, 0, 255))                    # 캔버스 밖 = 분홍
        canvas.paste(im.crop((max(0, x0), max(0, y0), max(0, x0) + W, max(0, y0) + H)), (max(0, -x0), max(0, -y0)))
        big = canvas.resize((W * K, H * K), Image.NEAREST)
        ox = i * (W * K + 4)
        out.paste(big, (ox, 28))
        d.text((ox + 2, 2), f"#{i} {f['face'][0]}{f['frame']} t={f['mt'] if f['mt'] is not None else '-'}", fill=(255, 255, 255))
        d.text((ox + 2, 14), f"sy={f['sy']} head={f['sy'] - 16}", fill=(200, 200, 120))
    out.save(path)


def timing(frames):
    """프레임 간격·한 프레임 이동 픽셀·멈춤 프레임 수·걷기 그림 순서."""
    if len(frames) < 3:
        return {}
    dts = [round(frames[i]['t'] - frames[i - 1]['t'], 1) for i in range(1, len(frames))]
    moving = [f for f in frames]
    dpx = []
    for i in range(1, len(moving)):
        a, b = moving[i - 1], moving[i]
        dpx.append(round(abs(b['mx'] - a['mx']) * 32 + abs(b['my'] - a['my']) * 32, 1))
    # 걷는 동안(처음 움직임 ~ 마지막 움직임) 0px 프레임 = 멈춤
    first = next((i for i, v in enumerate(dpx) if v > 0), None)
    last = max((i for i, v in enumerate(dpx) if v > 0), default=None)
    inner = dpx[first:last + 1] if first is not None else []
    seq = ''.join('MLR'[f['frame']] for f in frames)
    hist = {}
    for v in inner:
        hist[v] = hist.get(v, 0) + 1
    draw = [f['drawMs'] for f in frames]
    return {'n': len(frames), 'dt_ms_min': min(dts), 'dt_ms_max': max(dts), 'dt_ms_avg': round(sum(dts) / len(dts), 1),
            'px_per_frame_hist': dict(sorted(hist.items())), 'stall_frames_while_walking': sum(1 for v in inner if v == 0),
            'tiles': (frames[-1]['steps'] - frames[0]['steps']), 'walk_seq': seq, 'draw_ms_avg': round(sum(draw) / len(draw), 2), 'draw_ms_max': max(draw),
            'head_top_min': min(f['sy'] - 16 for f in frames), 'cam_oy': sorted({f['oy'] for f in frames})}


async def main():
    os.makedirs(OUTD, exist_ok=True)
    httpd = serve()
    prof = tempfile.mkdtemp(prefix='ds_audit_')
    proc = subprocess.Popen([browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = {}
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
            await c.send('Page.navigate', {'url': f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=morning3&seed=7&audit={int(time.time())}'})
            st = await wait_ready(c)
            print('ready', st)
            print('rec', await c.ev(REC, False))
            # 보통 속도로 (걷기 한 칸 230ms, 글자 18ms). 'fast' 모양도 뗀다
            await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return __ds4.E.DELAYS.step; })()", False)
            info = await c.ev("(() => ({ dpr: devicePixelRatio, iw: innerWidth, ih: innerHeight, app: getComputedStyle(document.getElementById('app')).transform, smooth: document.getElementById('cv').getContext('2d').imageSmoothingEnabled }))()", False)
            result['env'] = info
            print('env', info)
            # ── A. 위로 걷기: 승강장 위 대합실 (24,7) → 맨 윗줄 (24,1). 카메라가 세로로 따라 움직인다
            scen = [('up', (24, 7, 'up'), 'ArrowUp', 1700), ('down', (24, 1, 'down'), 'ArrowDown', 1700),
                    ('right', (17, 5, 'right'), 'ArrowRight', 1400), ('left', (26, 5, 'left'), 'ArrowLeft', 1400),
                    ('up_platform', (23, 11, 'up'), 'ArrowUp', 700)]
            for name, (x, y, face), key, ms in scen:
                await place(c, x, y, face)
                fr = await hold(c, key, ms)
                strip(fr, os.path.join(OUTD, f'{PFX}walk_{name}_strip.png'))
                tm = timing(fr)
                result[name] = tm
                print(name, json.dumps(tm, ensure_ascii=False))
                # 같은 걷기를 다시 하며 중간에 전체 화면을 찍는다 (HTML 띠·패널까지)
                await place(c, x, y, face)
                await c.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': key, 'code': key, 'windowsVirtualKeyCode': {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39}[key]})
                await asyncio.sleep(0.33)
                await c.shot(os.path.join(OUTD, f'{PFX}walk_{name}_full.png'))
                await asyncio.sleep(0.1)
                await c.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': key, 'code': key, 'windowsVirtualKeyCode': {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39}[key]})
                await asyncio.sleep(0.5)
            # ── 시간 측정만 (그림 없이, 3초 연속 걷기) — toDataURL 이 프레임을 늦추지 않게
            await place(c, 1, 5, 'right')
            fr = await hold(c, 'ArrowRight', 3000, snap=False)
            result['timing_nosnap_right'] = timing(fr)
            result['timing_nosnap_right']['first40'] = [(round(f['t'] - fr[0]['t']), f['mt'], f['frame'], round(f['mx'] * 32, 1)) for f in fr[:40]]
            print('nosnap', json.dumps({k: v for k, v in result['timing_nosnap_right'].items() if k != 'first40'}, ensure_ascii=False))
            # ── NPC 가 당신을 보는 방향(위·왼·오른)일 때 그림: 당신을 사람 둘레에 세우고 한 장씩
            for name, (x, y, face) in [('npc_face_up', (20, 7, 'down')), ('npc_face_left', (18, 10, 'right')), ('npc_face_right', (23, 10, 'left'))]:
                await place(c, x, y, face)
                await c.ev("(() => { __rec.frames = []; __rec.snap = true; __rec.on = true; return 1; })()", False)
                await asyncio.sleep(0.2)
                fr = await c.ev("(() => { __rec.on = false; const f = __rec.frames.slice(-1); __rec.frames = []; return f; })()", False)
                if fr:
                    f = fr[0]
                    im = Image.open(io.BytesIO(base64.b64decode(f['img'].split(',')[1]))).convert('RGB')
                    # 당신 둘레 7×5칸을 3배로
                    cx, cy = f['sx'] + 16, f['sy'] + 16
                    box = (max(0, cx - 112), max(0, cy - 96), min(480, cx + 112), min(320, cy + 64))
                    im.crop(box).resize(((box[2] - box[0]) * 3, (box[3] - box[1]) * 3), Image.NEAREST).save(os.path.join(OUTD, f'{PFX}{name}.png'))
                    result[name] = {'you': [x, y], 'people': f['people']}
                    print(name, f['people'])
            # ── 지도 맨 위 가장자리에서 서 있을 때 / 화로 앞
            await place(c, 20, 1, 'up')
            await asyncio.sleep(0.2)
            await c.shot(os.path.join(OUTD, f'{PFX}edge_top_full.png'))
    finally:
        proc.terminate()
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)
        with open(os.path.join(OUTD, f'{PFX}walk_timing.json'), 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    asyncio.run(main())
