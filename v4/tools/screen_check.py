# 어두운 역 v4 — 화면 담당 확인 도구 (2026-10-24 회의 P0-S1·S2·S3·S4·S7 끝 증거).
# 헤드리스 Chrome 을 DevTools 로 붙잡아 실제 게임을 움직이고, 재고, 찍는다. 게임 파일은 고치지 않는다(페이지 안에서 RENDER.draw 를 감쌀 뿐).
# 쓰기 (C:\dev\dark_station 에서):
#   python v4/tools/screen_check.py timing [--tag=before]   걷기 6칸 박자·멈춤·불꽃 박자 (60Hz·144Hz 두 조건, rAF 를 setTimeout 으로 흉내)
#   python v4/tools/screen_check.py walk                    네 방향 2칸 걷기 프레임 띠 (왼발·섬·오른발·섬, 발 칸 1px 내림)
#   python v4/tools/screen_check.py stills                  화로 확대·서 있는 주민 숨쉬기 픽셀 비교·도착·잠자리·터널·저녁 확대·지도 밖
#   python v4/tools/screen_check.py dialog                  대화 초상 naturalWidth·선택 창 장면 그림·터널 말풍선
#   python v4/tools/screen_check.py screens                 1366×650 노트북·1920×1080·1920×950 배율
#   python v4/tools/screen_check.py space [--n=20]          Space 를 누른 채/연타/↑ 를 누른 채 연타(arrowhold)로 pro_stairs·d3_called_you·trial_d3_count 창 지나가기 → 죽는 선택 횟수
#   python v4/tools/screen_check.py recheck                 (2026-10-24 검증 남은 문제 14건) 화로 상태·밝기 안·물건 이름·사망 명부·마리 자리·되풀이 말·목표 줄·공구함·벽걸이 가림·찾은 물건 아이콘·꼬리표
#   python v4/tools/screen_check.py heads                   9명 × 4방향 걷기 그림(게임이 그리는 캔버스) — 머리 잘림·머리 꼭대기 높이
#   python v4/tools/screen_check.py fallback                새 그림(v4 walk·props·portraits80·cg_s)을 숨기고 — 대체 규칙으로 깨지지 않는가
#   python v4/tools/screen_check.py meet                    (P0-S5) 터널 4·2·1칸 말풍선·헤드램프 / 도착 때 창 없음 / 순례 6·4·2칸 / 이름표 / D0 저녁 증언 / D1 배식 / 셔터 / 3번 말 걸기
#   python v4/tools/screen_check.py props                   (P0-S6) 물건 크기 비교판 / 머리맡 묶음 / 한 칸 전부 조사 / 구급함·가방·벽감 상자 열기(3박자 흔들림·아이콘) / 전동차
#   python v4/tools/screen_check.py apply [--n=9]           (2026-10-24 검증 남은 화면 몫 12건) 이름 새기·사망 명부·마리 자리·목표 줄·연타 보호·공구함·찾은 물건 아이콘·벽걸이 가림·
#                                                           화로 상태·사람마다 앉기/잠·꼬리표 비킴 — 결과는 screen_apply_*.png · screen_apply.json
#   python v4/tools/screen_check.py spec --out=docs/foundation/meeting_2026-10-24/apply
#                                                           (2026-10-24 명세 A1·A2·A4 화면 몫) 새 사건 10개를 시뮬 저장에서 열고 골라 흐름 끝까지 · 잠긴 이유 ·
#                                                           등 돌림(아침·저녁·밤)·호칭·밀린 그릇 · 못 본 밤 먼지·_late 글·토스트 · 그림 없을 때 · 표 행이 빠질 때 — screen_spec_*.png · screen_spec.json
#   python v4/tools/screen_check.py rope --out=docs/foundation/meeting_2026-10-24/tightrope
#                                                           (2026-10-24 줄타기·게으름 처벌 화면 몫) 카르마 구간별 선택 창(%·경고·비용·위험 단계 색·심장 박동) · 눈먼 새벽 한 줄 ·
#                                                           죽을 뻔한 판정 '살았다' · 실패 글·사망 화면 · 못 본 도둑이 당신에게 온 아침 밤 보고·조사 글 — screen_rope_*.png · screen_rope.json
#   공통 --out=<폴더> : 결과와 헤드리스 프로필(.profile, 끝나면 지움)을 그 폴더에 (기본 after_shots)
#   컴퓨터가 바쁠 때 (2026-10-24 검증 #8·#10): 페이지가 덜 뜨면(스크립트·표를 못 받음) 세 번까지 다시 연다(CDP.open → booted) · 로컬 서버 대기열 128 ·
#     fixture.js 는 FIXTURE_SEC(240초)에 찾은 만큼으로 멈추고, FIXTURE_TIMEOUT 을 넘으면 저장 없이 간다(그 검사는 'fixture 없음'으로 결과에 남는다)
#   (아무것도 안 주면 전부)
# 결과: docs/foundation/meeting_2026-10-24/after_shots/screen_*.png|json|txt
import os, sys, json, time, base64, io, asyncio, subprocess, tempfile, threading, functools, http.server, socketserver, shutil, urllib.request
from PIL import Image, ImageDraw
import websockets

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'after_shots')
PORT, DBG = 18791, 19533
T, PH = 32, 48
FIXTURES = {}
OPEN_TRIES, BOOT_LIMIT = 3, 90                   # 페이지 열기: 세 번까지 · 한 번에 90초까지 기다린다 (붐빌 때)
FIXTURE_SEC, FIXTURE_TIMEOUT = 240, 1500         # fixture.js: 찾을 만큼 찾았으면 240초에 멈춘다 · 그래도 1500초가 넘으면 버리고 저장 없이 간다
VK = {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, ' ': 32, 'Enter': 13}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):                            # /__fixture/<사건 id>.json = fixture.js 가 만든 저장 (shot.py 와 같은 방식)
        if self.path.startswith('/__fixture/'):
            fid = self.path.split('/')[-1].split('?')[0].replace('.json', '')
            if fid not in FIXTURES:
                self.send_error(404)
                return
            body = json.dumps(FIXTURES[fid], ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


class Server(socketserver.ThreadingTCPServer):
    # (2026-10-24 검증 #10) 기본 대기열 5 — 컴퓨터가 붐비면 index.html 이 스크립트 17개를 한꺼번에 달라고 할 때 연결이 버려져
    #   'ART is not defined'·'Failed to fetch' 로 게임이 시작조차 못 했다 → 대기열을 넉넉히, 일꾼 실은 데몬으로(끝날 때 매달리지 않게)
    request_queue_size = 128
    daemon_threads = True
    allow_reuse_address = os.name != 'nt'       # Windows 의 SO_REUSEADDR 는 이미 쓰는 포트에도 또 붙어 두 도구가 요청을 나눠 가진다 → 붙지 않게 하고 빈 포트로 옮긴다(serve)

    def handle_error(self, request, client_address):   # 브라우저가 페이지를 바꾸며 끊은 연결(10053·끊긴 파이프)은 조용히 — 그 밖의 오류만 찍는다
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def serve():
    # 다른 담당이 같은 도구를 동시에 돌려 포트가 차 있으면 다음 빈 포트로 (페이지 주소는 전역 PORT 를 읽는다)
    global PORT
    err = None
    for p in range(PORT, PORT + 20):
        try:
            httpd = Server(('127.0.0.1', p), functools.partial(Quiet, directory=ROOT))
        except OSError as e:
            err = e
            continue
        if p != PORT:
            print(f'   포트 {PORT} 사용 중 - {p} 로')
        PORT = p
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        return httpd
    raise err


def browser():
    for c in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
        if os.path.exists(c):
            return c
    return shutil.which('chrome') or shutil.which('msedge')


# rAF 를 정해진 Hz 의 setTimeout 으로 바꾼다 (헤드리스는 모니터가 없다 — 60Hz·144Hz 모니터를 흉내)
RAF_SHIM = r"""
(() => {
  const HZ = %d, P = 1000 / HZ; let next = 0, q = [], armed = false;
  const fire = () => { armed = false; const cbs = q; q = []; const t = performance.now(); next = t; for (const f of cbs) { try { f(t); } catch (e) { setTimeout(() => { throw e; }); } } };
  window.requestAnimationFrame = (cb) => { q.push(cb); if (!armed) { armed = true; const now = performance.now(); setTimeout(fire, Math.max(0, next + P - now)); } return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__hz = HZ;
})();
"""

# 프레임 기록기: RENDER.draw 를 감싸 프레임마다 시각·위치·tick 을 남긴다. snap 이면 캔버스 그림도
REC = r"""
(() => {
  if (window.__rec) return 'already';
  const R = window.RENDER, orig = R.draw;
  window.__rec = { on: false, snap: false, frames: [] };
  R.draw = function (ctx, cv, sc, state, people, objs, tick, opts) {
    const r = orig.apply(this, arguments);
    const rc = window.__rec;
    if (!rc.on) return r;
    const m = sc.moving;
    const mx = m ? sc.px - m.dx * (1 - m.t) : sc.px, my = m ? sc.py - m.dy * (1 - m.t) : sc.py;
    const f = { t: performance.now(), tick, px: sc.px, py: sc.py, mt: m ? +m.t.toFixed(4) : null, mx: +mx.toFixed(5), my: +my.toFixed(5),
      X: Math.round(mx * 32), Y: Math.round(my * 32), steps: sc.steps, face: sc.face, wf: sc.walkFrame == null ? null : sc.walkFrame, wd: sc.walkDist == null ? null : +sc.walkDist.toFixed(2),
      ox: sc.cam ? sc.cam.ox : 0, oy: sc.cam ? sc.cam.oy : 0 };
    if (rc.snap) f.img = cv.toDataURL('image/png');
    rc.frames.push(f);
    return r;
  };
  return 'ok';
})()
"""


class CDP:
    def __init__(self, ws):
        self.ws, self.n, self.console, self.shim = ws, 0, [], None
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

    async def ev(self, expr, await_promise=True):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': await_promise, 'returnByValue': True})
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:800])
        return r.get('result', {}).get('value')

    async def size(self, w, h):
        await self.send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': False})

    async def open(self, url, hz=None, w=1280, h=720, tries=OPEN_TRIES):
        if self.shim:
            await self.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': self.shim})
            self.shim = None
        if hz:
            self.shim = (await self.send('Page.addScriptToEvaluateOnNewDocument', {'source': RAF_SHIM % hz}))['identifier']
        await self.size(w, h)
        # (2026-10-24 검증 #10) 페이지가 덜 뜨면(스크립트·표를 못 받음 — 컴퓨터가 붐빌 때) 다시 연다. 게임이 표를 다 읽었으면(__ds4.db) 뜬 것
        for attempt in range(tries):
            self.console = []
            await self.send('Page.navigate', {'url': f'http://127.0.0.1:{PORT}' + url})
            await asyncio.sleep(0.6)
            st = await self.booted()
            if st == 'ok':
                return True
            print(f'   페이지 다시 열기 {attempt + 1}/{tries - 1}: {st} ({url[:70]})' if attempt < tries - 1 else f'   페이지가 뜨지 않았다: {st} ({url[:70]})')
        return False

    async def booted(self, limit=BOOT_LIMIT):
        """게임이 떴나: 'ok'(표를 다 읽음) · 'fail:<까닭>'(시작 실패 글 · 스크립트가 안 읽힘 · 표를 못 받음) · 'timeout'."""
        t0 = time.time()
        done_at = None
        while time.time() - t0 < limit:
            try:
                st = await self.ev("""(() => { const g = document.getElementById('goal');
                  if (g && /시작하지 못했다/.test(g.textContent)) return 'fail:' + g.textContent.slice(0, 80);
                  if (window.__ds4 && window.__ds4.db) return 'ok';
                  return document.readyState === 'complete' ? (typeof window.__ds4 === 'undefined' ? 'noscript' : 'loading') : 'loading'; })()""", False)
            except Exception:
                st = 'loading'                       # 막 바뀌는 중(실행 문맥이 없어짐)
            if st == 'ok' or str(st).startswith('fail:'):
                return st
            if st == 'noscript':                     # 문서는 다 읽었는데 game.js 가 돌지 않았다 — 잠깐 더 보고(늦은 스크립트) 실패로
                done_at = done_at or time.time()
                if time.time() - done_at > 3:
                    bad = [x for x in self.console if 'is not defined' in x or 'Failed to fetch' in x or 'EXCEPTION' in x]
                    return 'fail:스크립트가 읽히지 않았다' + (' - ' + bad[0][:80] if bad else '')
            await asyncio.sleep(0.2)
        return 'timeout'

    async def wait(self, cond, limit=180):
        t0 = time.time()
        while time.time() - t0 < limit:
            try:
                v = await self.ev(f'(() => {{ try {{ return !!({cond}); }} catch (e) {{ return false; }} }})()', False)
            except Exception:
                v = False
            if v:
                return True
            await asyncio.sleep(0.15)
        raise SystemExit('기다리다 지쳤다: ' + cond)

    async def key(self, k, typ, repeat=False):
        await self.send('Input.dispatchKeyEvent', {'type': typ, 'key': k, 'code': 'Space' if k == ' ' else k, 'windowsVirtualKeyCode': VK.get(k, 0),
                                                   'nativeVirtualKeyCode': VK.get(k, 0), 'autoRepeat': repeat, 'text': ' ' if (k == ' ' and typ == 'keyDown') else ''})

    async def shot(self, path, clip=None):
        p = {'format': 'png'}
        if clip:
            p['clip'] = dict(clip, scale=1)
        r = await self.send('Page.captureScreenshot', p)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))
        return path

    def errors(self):
        return [ln for ln in self.console if ln.startswith('error') or ln.startswith('EXCEPTION')]


def out(name):
    os.makedirs(OUTD, exist_ok=True)
    return os.path.join(OUTD, name)


def img_of(f):
    return Image.open(io.BytesIO(base64.b64decode(f['img'].split(',')[1]))).convert('RGBA')


READY_CAR = "__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.bot && !__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving"


async def normal_speed(c):
    await c.ev("(() => { __ds4.E.setFast(false); document.getElementById('app').classList.remove('fast'); return __ds4.E.DELAYS.step; })()", False)


async def place(c, x, y, face, mp=None):
    js = f"(() => {{ const s = __ds4.scene; s.moving = null; s.auto = null; s.px = {x}; s.py = {y}; s.face = '{face}'; if ('walkDist' in s) s.walkDist = 0; return 1; }})()"
    await c.ev(js, False)
    await asyncio.sleep(0.2)


async def record(c, on, snap=False):
    if on:
        await c.ev(f"(() => {{ __rec.frames = []; __rec.snap = {str(snap).lower()}; __rec.on = true; return 1; }})()", False)
        return None
    return await c.ev("(() => { __rec.on = false; const f = __rec.frames; __rec.frames = []; return f; })()", False)


async def walk_tiles(c, key, tiles, snap=False, limit=4.0):
    """방향키를 누른 채 tiles 칸을 걸은 뒤 뗀다. 프레임 기록을 돌려준다."""
    s0 = await c.ev('__ds4.scene.steps', False)
    await record(c, True, snap)
    await asyncio.sleep(0.1)
    await c.key(key, 'keyDown')
    t0 = time.time()
    while time.time() - t0 < limit:
        s = await c.ev('__ds4.scene.steps', False)
        if s - s0 >= tiles:
            break
        await asyncio.sleep(0.01)
    await c.key(key, 'keyUp')
    await asyncio.sleep(0.45)
    return await record(c, False)


def analyse_walk(fr, axis='mx', sign=1, tiles=6):
    """걷기 기록 → 칸마다 걸린 시간·멈춤 프레임(같은 자리 연속 2프레임)."""
    if not fr:
        return {}
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
    # 걷는 구간: 처음 움직인 프레임 ~ tiles 칸에 닿은 프레임
    first = next((i for i, (_, p) in enumerate(pos) if p > 1e-6), None)
    last = next((i for i, (_, p) in enumerate(pos) if p >= tiles - 1e-6), None)
    seg = fr[first - 1:last + 1] if first is not None and last is not None else []
    stall_f = sum(1 for i in range(1, len(seg)) if abs(seg[i][axis] - seg[i - 1][axis]) < 1e-6)
    ia = 'X' if axis == 'mx' else 'Y'
    stall_px = sum(1 for i in range(1, len(seg)) if seg[i][ia] == seg[i - 1][ia])
    dts = [seg[i]['t'] - seg[i - 1]['t'] for i in range(1, len(seg))]
    return {'tiles_crossed': len(cross), 'ms_per_tile': durs, 'ms_per_tile_avg': round(sum(durs) / len(durs), 1) if durs else None,
            'frames_walking': len(seg), 'stall_frames_same_pos': stall_f, 'same_int_pixel_frames': stall_px,
            'frame_dt_avg': round(sum(dts) / len(dts), 2) if dts else None, 'walk_frames': ''.join('-' if f['wf'] is None else 'SLR'[f['wf']] for f in seg)}


async def task_timing(c, tag):
    res = {}
    for hz in (60, 144):
        await c.open('/v4/index.html?fast=1&auto=car&seed=7&sc=' + str(int(time.time())), hz=hz)
        await c.wait(READY_CAR)
        await normal_speed(c)
        await c.ev(REC, False)
        await place(c, 3, 3, 'right')
        fr = await walk_tiles(c, 'ArrowRight', 7)
        a = analyse_walk(fr, 'mx', 1, 6)
        # 불꽃 박자: 3초 동안 서서 tick 기반 그림 번호((tick>>2)%3 — 고치기 전 불꽃 공식)가 바뀐 횟수
        await record(c, True)
        await asyncio.sleep(3.0)
        st = await record(c, False)
        ticks = [f['tick'] for f in st]
        fire = sum(1 for i in range(1, len(ticks)) if (ticks[i] >> 2) % 3 != (ticks[i - 1] >> 2) % 3)
        span = (st[-1]['t'] - st[0]['t']) / 1000 if len(st) > 1 else 0
        a.update({'stand_3s_frames': len(st), 'stand_fps': round(len(st) / span, 1) if span else 0, 'tick_span': ticks[-1] - ticks[0] if ticks else 0,
                  'fire_frame_changes_3s': fire, 'console_errors': c.errors()})
        res[f'{hz}Hz'] = a
        print(tag, hz, json.dumps(a, ensure_ascii=False))
    with open(out(f'screen_walk_timing_{tag}.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


async def canvas(c):
    d = await c.ev("document.getElementById('cv').toDataURL('image/png')", False)
    return Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')


async def cam(c):
    return await c.ev('({ ox: __ds4.scene.cam.ox, oy: __ds4.scene.cam.oy, px: __ds4.scene.px, py: __ds4.scene.py })', False)


def zoom(im, box, k, path):
    im.crop(box).resize(((box[2] - box[0]) * k, (box[3] - box[1]) * k), Image.NEAREST).save(path)
    return path


async def stage_shot(c, path, k_hint=None):
    """페이지 화면 캡처를 무대(#stage) 크기로 잘라서 (HTML 말풍선 층·대사창까지 보이게)."""
    r = await c.ev("(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()", False)
    return await c.shot(path, {'x': r['x'], 'y': r['y'], 'width': r['w'], 'height': r['h']})


IDLE = "!__ds4.UI.bot && !__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving"


async def goto_point(c, point, extra='', fast=True, w=1280, h=720, hz=None):
    await c.open(f'/v4/index.html?{"fast=1&" if fast else ""}auto={point}&seed=7&sc={int(time.time())}', hz=hz, w=w, h=h)
    await c.wait('__ds4.state && __ds4.scene.map && ' + IDLE + (' && ' + extra if extra else ''), limit=400)
    await asyncio.sleep(0.4)


def strip_img(frames, path, K=4):
    """당신 둘레(가로 48 · 세로 72)를 프레임마다 잘라 K배로 이은 띠. 빨간 눈금 = 타일 바닥 줄(발이 닿는 줄), 발 칸은 그보다 1px 아래."""
    W, H = 48, 72
    out_im = Image.new('RGB', (len(frames) * (W * K + 6), H * K + 30), (24, 24, 24))
    d = ImageDraw.Draw(out_im)
    for i, f in enumerate(frames):
        im = img_of(f).convert('RGB')
        sx, sy = f['X'] + f['ox'], f['Y'] + f['oy']
        x0, y0 = sx - 8, sy - 36
        cv = Image.new('RGB', (W, H), (255, 0, 255))
        cv.paste(im.crop((max(0, x0), max(0, y0), max(0, x0) + W, max(0, y0) + H)), (max(0, -x0), max(0, -y0)))
        big = cv.resize((W * K, H * K), Image.NEAREST)
        dd = ImageDraw.Draw(big)
        foot = (36 + 31) * K                                                 # 타일 마지막 줄(y=31)의 위쪽 = 섬 칸 발바닥
        for yy in (foot, foot + K):
            dd.line([(0, yy), (6, yy)], fill=(255, 40, 40) if yy == foot else (255, 160, 40))
            dd.line([(W * K - 7, yy), (W * K - 1, yy)], fill=(255, 40, 40) if yy == foot else (255, 160, 40))
        ox = i * (W * K + 6)
        out_im.paste(big, (ox, 30))
        wf = 'SLR'[f['wf']] if f['wf'] is not None else '-'
        d.text((ox + 2, 2), f"#{i} {wf} {'(foot +1px)' if wf in 'LR' else ''}", fill=(255, 255, 255))
        d.text((ox + 2, 15), f"t={f['mt'] if f['mt'] is not None else '-'} dist={f['wd']}", fill=(200, 200, 120))
    out_im.save(path)


async def task_walk(c, opts):
    """네 방향 2칸 걷기 — 걷기 그림이 바뀌는 프레임만 골라 띠로 (왼발·섬·오른발·섬, 발 칸 1px 내림)."""
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    await normal_speed(c)
    await c.ev(REC, False)
    res = {}
    for name, (x, y, face), key in [('up', (24, 7, 'up'), 'ArrowUp'), ('down', (24, 5, 'down'), 'ArrowDown'), ('right', (17, 5, 'right'), 'ArrowRight'), ('left', (26, 5, 'left'), 'ArrowLeft')]:
        await place(c, x, y, face)
        fr = await walk_tiles(c, key, 2, snap=True)
        pick = []
        for i, f in enumerate(fr):
            if i == 0 or f['wf'] != fr[i - 1]['wf']:
                pick.append(f)
        if fr and pick[-1] is not fr[-1]:
            pick.append(fr[-1])
        strip_img(pick, out(f'screen_walk_strip_{name}.png'))
        seq = ''.join('SLR'[f['wf']] for f in fr if f['wf'] is not None)
        # 같은 그림이 이어진 덩어리로 줄인 순서
        comp = ''.join(ch for i, ch in enumerate(seq) if i == 0 or ch != seq[i - 1])
        res[name] = {'frames': len(fr), 'beats': comp}
        print('walk', name, res[name])
    res['console_errors'] = c.errors()
    with open(out('screen_walk_strip.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


def best_shift(a, b):
    """b 를 위아래로 −1·0·+1 옮겨 a 와 가장 비슷한 값 (픽셀 차 합)."""
    import numpy as np
    A, B = np.asarray(a, dtype=np.int32), np.asarray(b, dtype=np.int32)
    sc = {}
    for s in (-1, 0, 1):
        if s == 0:
            sc[s] = np.abs(A[1:-1] - B[1:-1]).sum()
        elif s == 1:                                  # b 가 1px 아래로 내려갔다 = b[y+1] ≈ a[y]
            sc[s] = np.abs(A[1:-1] - B[2:]).sum()
        else:
            sc[s] = np.abs(A[1:-1] - B[:-2]).sum()
    return min(sc, key=sc.get), {k: int(v) for k, v in sc.items()}


async def task_stills(c, opts):
    res = {}
    # 1) 승강장 아침(D3): 화로 확대 · 서 있는 주민 숨쉬기
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    await normal_speed(c)
    await place(c, 13, 12, 'up')
    await asyncio.sleep(0.3)
    im = await canvas(c)
    cm = await cam(c)
    fx, fy = 13 * T + cm['ox'], 10 * T + cm['oy']
    zoom(im, (fx - 32, fy - 32, fx + 64, fy + 48), 5, out('screen_fire_zoom.png'))
    res['fire_zoom'] = {'fire_tile_on_canvas': [fx, fy]}
    # 숨쉬기: 순례(아침 자리 10,10)를 3초 동안 150ms 마다 찍어 윗몸(위 28줄)·아랫몸이 0번 장보다 몇 px 내려갔는지
    ppl = await c.ev("(() => { const out = {}; for (const id of Object.keys(DS4.spots.SPOTS.trace)) { const p = __ds4.state.people[id]; out[id] = p ? p.status : '?'; } return out; })()", False)
    res['people_status'] = ppl
    target = next((k for k in ['soonrye', 'gicheol', 'mari', 'seoha', 'eunji', 'dongha'] if ppl.get(k) == 'home'), None)
    bx, by = (await c.ev(f"DS4.spots.SPOTS.trace['{target}']", False)) if target else (None, None)
    if target:
        await place(c, bx + 1, by + 2 if by + 2 < 13 else by + 1, 'up')
        await asyncio.sleep(0.3)
        samples = []
        for i in range(21):
            samples.append(await canvas(c))
            await asyncio.sleep(0.15)
        cm = await cam(c)
        X, Y = bx * T + cm['ox'], by * T + cm['oy']
        box = (X, Y - 16, X + T, Y + T)
        crops = [s.crop(box).convert('L') for s in samples]
        up = [best_shift(crops[0].crop((0, 0, T, 28)), cc.crop((0, 0, T, 28)))[0] for cc in crops]
        lo = [best_shift(crops[0].crop((0, 28, T, 48)), cc.crop((0, 28, T, 48)))[0] for cc in crops]
        res['breath'] = {'who': target, 'at': [bx, by], 'upper_shift_vs_first': up, 'lower_shift_vs_first': lo,
                         'upper_changes': sum(1 for i in range(1, len(up)) if up[i] != up[i - 1]), 'lower_nonzero': sum(1 for v in lo if v != 0)}
        print('breath', res['breath'])
        a = next((i for i, v in enumerate(up) if v == up[0]), 0)
        b = next((i for i, v in enumerate(up) if v != up[0]), None)
        if b is not None:
            pair = Image.new('RGBA', (T * 2 * 6 + 12, 48 * 6), (20, 20, 20, 255))
            pair.paste(samples[a].crop(box).resize((T * 6, 48 * 6), Image.NEAREST), (0, 0))
            pair.paste(samples[b].crop(box).resize((T * 6, 48 * 6), Image.NEAREST), (T * 6 + 12, 0))
            dd = ImageDraw.Draw(pair)
            dd.line([(0, 28 * 6), (pair.width, 28 * 6)], fill=(255, 60, 60, 255))
            pair.save(out('screen_breath_compare.png'))
    # 2) 지도 밖 위아래 (전동차: 지도 7줄 = 224px < 캔버스 320px)
    await goto_point(c, 'car')
    im = await canvas(c)
    cm = await cam(c)
    import numpy as np
    a = np.asarray(im.convert('RGB'), dtype=np.int32)
    band_top, band_bot = a[:max(0, cm['oy'])], a[cm['oy'] + 7 * T:]
    res['outside_map'] = {'oy': cm['oy'], 'top_band_rows': int(band_top.shape[0]), 'top_band_std': float(band_top.std()) if band_top.size else 0,
                          'top_band_colors': int(len(np.unique(band_top.reshape(-1, 3), axis=0))) if band_top.size else 0,
                          'bottom_band_std': float(band_bot.std()) if band_bot.size else 0}
    zoom(im, (0, 0, 480, 320), 2, out('screen_outside_car.png'))
    print('outside', res['outside_map'])
    # 3) 승강장 도착 (불꽃이 머리에 얹히지 않는다)
    await goto_point(c, 'arrive', "__ds4.scene.map.id === 'station'")
    im = await canvas(c)
    cm = await cam(c)
    sx, sy = cm['px'] * T + cm['ox'], cm['py'] * T + cm['oy']
    zoom(im, (max(0, sx - 64), max(0, sy - 80), min(480, sx + 96), min(320, sy + 48)), 4, out('screen_arrival.png'))
    res['arrival'] = {'you': [cm['px'], cm['py']], 'start': await c.ev("__ds4.db.maps.station.start", False), 'fire': await c.ev("__ds4.db.maps.station.fire", False)}
    print('arrival', res['arrival'])
    # 4) 잠든 사람 (D2 밤) — 머리가 있다
    await goto_point(c, 'beds', "__ds4.state.phase === 'night'")
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 15 * T + cm['ox'] - 8), max(0, 8 * T + cm['oy']), min(480, 21 * T + cm['ox'] + 8), min(320, 12 * T + cm['oy'])), 3, out('screen_sleepers.png'))
    # 5) 터널: 잔해 3칸 + 기철 4칸 말풍선(HTML 층)
    await goto_point(c, 'tunnel', "__ds4.scene.map.id === 'tunnel'")
    await asyncio.sleep(0.3)
    await stage_shot(c, out('screen_tunnel_full.png'))
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 9 * T + cm['ox']), max(0, cm['oy']), min(480, 19 * T + cm['ox']), min(320, 5 * T + cm['oy'])), 3, out('screen_tunnel_zoom.png'))
    bub = await c.ev("(() => { const b = document.querySelector('#bubbles .bub'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.textContent, font: getComputedStyle(b).fontSize, x: r.left, y: r.top, w: r.width, h: r.height }; })()", False)
    res['tunnel'] = {'rubble_state': await c.ev("__ds4.state.traces.rubble ? __ds4.state.traces.rubble.st : 'blocked'", False), 'you': [cm['px'], cm['py']], 'bubble': bub}
    if bub:
        await c.shot(out('screen_tunnel_bubble.png'), {'x': max(0, bub['x'] - 40), 'y': max(0, bub['y'] - 20), 'width': bub['w'] + 80, 'height': bub['h'] + 120})
    print('tunnel', res['tunnel'])
    # 6) D3 저녁 화로 둘레 — 반응 꼬리표가 윗사람 몸에 겹치지 않는다 (같은 단계에 위아래로 붙은 사람이 없다)
    await goto_point(c, 'eve3', "__ds4.state.phase === 'evening'")
    await asyncio.sleep(0.3)
    await stage_shot(c, out('screen_evening_full.png'))
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 9 * T + cm['ox']), max(0, 8 * T + cm['oy']), min(480, 18 * T + cm['ox']), min(320, 13 * T + cm['oy'])), 3, out('screen_evening_zoom.png'))
    res['evening'] = await c.ev("(() => { const sp = DS4.spots.SPOTS.evening; const ids = Object.keys(sp); const bad = []; for (const a of ids) for (const b of ids) if (a !== b && sp[a][0] === sp[b][0] && sp[a][1] === sp[b][1] + 1) bad.push(a + ' under ' + b); return { spots: sp, vertical_pairs: bad }; })()", False)
    print('evening', res['evening'])
    res['console_errors'] = c.errors()
    with open(out('screen_stills.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


async def task_dialog(c, opts):
    res = {}
    # 대화 초상: D3 저녁에 앉은 사람에게 말을 건다 → 대사창 얼굴 칸
    await goto_point(c, 'eve3', "__ds4.state.phase === 'evening'")
    who = await c.ev("(() => { const sp = DS4.spots.SPOTS.evening; for (const id of ['soonrye','mari','gicheol','eunji','dongha','seoha']) { const p = __ds4.state.people[id]; if (p && p.status === 'home') return id; } return null; })()", False)
    if who:
        await c.ev(f"(() => {{ __ds4.use('{who}'); return 1; }})()", False)
        await c.wait("__ds4.UI.openKind() === 'line' || __ds4.UI.openKind() === 'tend'", limit=30)
        if await c.ev("__ds4.UI.openKind()", False) == 'tend':
            await c.ev("__ds4.pick(0)", False)
            await asyncio.sleep(0.6)
            await c.ev("__ds4.pick(0)", False)
            await c.wait("__ds4.UI.openKind() === 'line'", limit=30)
        await asyncio.sleep(1.2)
        face = await c.ev("(() => { const f = document.querySelector('#box .face'); if (!f) return null; const r = f.getBoundingClientRect(); const k = parseFloat((getComputedStyle(document.getElementById('app')).transform.match(/matrix\\(([^,]+)/) || [0, 1])[1]); return { tag: f.tagName, src: (f.src || '').split('/').slice(-2).join('/'), naturalWidth: f.naturalWidth, naturalHeight: f.naturalHeight, shownW: r.width, shownH: r.height, scale: k, contentW: f.clientWidth }; })()", False)
        res['portrait'] = face
        if face:
            res['portrait']['integer_scale'] = bool(face['naturalWidth'] and abs(face['contentW'] - face['naturalWidth']) < 0.01)
        await stage_shot(c, out('screen_dialog_portrait.png'))
        print('portrait', face)
    # 선택 창 장면 그림: pro_stairs 저장에서 손으로 → 글을 넘겨 선택 창까지
    if 'pro_stairs' in FIXTURES:
        await c.open(f'/v4/index.html?auto=manual&seed=7&state=/__fixture/pro_stairs.json&sc={int(time.time())}')
        await c.wait("__ds4.UI && __ds4.UI.openKind() === 'line'", limit=60)
        for _ in range(30):
            if await c.ev("__ds4.UI.openKind()", False) == 'event':
                break
            await c.key(' ', 'keyDown')
            await c.key(' ', 'keyUp')
            await asyncio.sleep(0.35)
        await asyncio.sleep(0.6)
        cgi = await c.ev("(() => { const out = {}; for (const cls of ['big', 'small']) { const im = document.querySelector('#cg img.' + cls); if (!im) { out[cls] = null; continue; } const r = im.getBoundingClientRect(); out[cls] = { src: im.src.split('/').slice(-2).join('/'), naturalWidth: im.naturalWidth, shown: getComputedStyle(im).display !== 'none', w: r.width, contentW: im.clientWidth }; } out.kind = __ds4.UI.openKind(); return out; })()", False)
        res['choice_cg'] = cgi
        await stage_shot(c, out('screen_choice_cg.png'))
        print('choice cg', cgi)
    res['console_errors'] = c.errors()
    with open(out('screen_dialog.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


async def task_screens(c, opts):
    res = {}
    for name, (w, h) in [('d01_laptop_1366x650', (1366, 650)), ('d02_fhd_1920x1080', (1920, 1080)), ('d02b_fhd_window_1920x950', (1920, 950))]:
        await goto_point(c, 'car', w=w, h=h)
        tf = await c.ev("getComputedStyle(document.getElementById('app')).transform", False)
        await c.shot(out(f'screen_{name}.png'))
        res[name] = {'transform': tf, 'scale': float(tf.split('(')[1].split(',')[0]) if '(' in tf else 1}
        print(name, res[name])
    await c.size(1280, 720)
    with open(out('screen_screens.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


SPACE_EVENTS = ['pro_stairs', 'd3_called_you', 'trial_d3_count']


async def space_run(c, ev, mode):
    """저장에서 그 사건을 걸고(봇 없음), Space 를 연타(mash)하거나 연타 뒤 누른 채(hold, 반복 입력) 지나간다 → 결과."""
    await c.open(f'/v4/index.html?auto=manual&seed=7&state=/__fixture/{ev}.json&sc={int(time.time() * 1000)}')
    await c.wait("__ds4.UI && __ds4.state && __ds4.state.pending && __ds4.UI.openKind() === 'line'", limit=60)
    before = await c.ev("__ds4.state.log.filter((l) => l.kind === 'choice').length", False)
    mash_s = 2.8 if mode in ('mash', 'arrowhold') else 1.4
    if mode == 'arrowhold':                     # 계단 쪽으로 ↑ 를 누른 채(자동 반복) Space 를 연타 — 검증 #12 의 흔한 조작
        await c.key('ArrowUp', 'keyDown')
    t0 = time.time()
    while time.time() - t0 < mash_s:
        await c.key(' ', 'keyDown')
        await asyncio.sleep(0.03)
        await c.key(' ', 'keyUp')
        if mode == 'arrowhold':
            await c.key('ArrowUp', 'keyDown', repeat=True)
        await asyncio.sleep(0.04)
    if mode == 'arrowhold':
        for _ in range(12):                     # Space 를 멈춘 뒤에도 ↑ 는 한동안 누른 채
            await c.key('ArrowUp', 'keyDown', repeat=True)
            await asyncio.sleep(0.035)
        await c.key(' ', 'keyDown')
        await c.key(' ', 'keyUp')
        await asyncio.sleep(0.1)
        await c.key('ArrowUp', 'keyUp')
    if mode == 'hold':
        await c.key(' ', 'keyDown')
        for _ in range(40):
            await asyncio.sleep(0.035)
            await c.key(' ', 'keyDown', repeat=True)
        await c.key(' ', 'keyUp')
    await asyncio.sleep(0.6)
    r = await c.ev(f"""(() => {{ const s = __ds4.state; const ch = s.log.filter((l) => l.kind === 'choice'); return {{ chosen: ch.length - {before}, last: ch.length > {before} ? ch[ch.length - 1].text : '', you: s.people.you.status,
        ended: !!s.ended, open: __ds4.UI.openKind(), pending: s.pending ? s.pending.id : '' }}; }})()""", False)
    r['died'] = r['you'] in ('dead', 'ascended') or (r['ended'] and r['you'] != 'home')
    return r


async def task_space(c, opts):
    n = int(opts.get('n', 20))
    res = {}
    if 'd3_called_you' not in FIXTURES:      # 시뮬 봇 저장이 없으면 캡처 봇으로 D3 밤 그 사건의 첫 줄까지 가서(?auto=called3l) 그 상태를 저장으로 쓴다
        await c.open(f'/v4/index.html?fast=1&auto=called3l&seed=7&sc={int(time.time() * 1000)}')
        if await until(c, "__ds4.state && __ds4.state.pending && __ds4.state.pending.id === 'd3_called_you' && __ds4.UI.openKind() === 'line' && !__ds4.UI.bot", 400):
            FIXTURES['d3_called_you'] = await c.ev("JSON.parse(JSON.stringify(__ds4.state))", False)
            print('d3_called_you: 캡처 봇 저장으로 시작')
    for ev in SPACE_EVENTS:
        if ev not in FIXTURES:
            res[ev] = {'error': 'fixture 없음'}
            print(ev, 'fixture 없음')
            continue
        runs = []
        modes = opts.get('modes', 'mash,hold,arrowhold').split(',')
        for i in range(n):
            mode = modes[i % len(modes)]
            r = await space_run(c, ev, mode)
            r['mode'] = mode
            runs.append(r)
        deaths = sum(1 for r in runs if r['died'])
        chosen = sum(1 for r in runs if r['chosen'] > 0)
        by_mode = {m: {'runs': sum(1 for r in runs if r['mode'] == m), 'deaths': sum(1 for r in runs if r['mode'] == m and r['died']),
                       'choices_made': sum(1 for r in runs if r['mode'] == m and r['chosen'] > 0)} for m in modes}
        # 대조: 연타가 끝난 뒤 ↓ 한 번 + Space → 고를 수 있다 (금기면 확인창이 '다시 고른다'에 커서를 두고 열린다)
        await space_run(c, ev, 'mash')
        await c.key('ArrowDown', 'keyDown')
        await c.key('ArrowDown', 'keyUp')
        await asyncio.sleep(0.2)
        await c.key(' ', 'keyDown')
        await c.key(' ', 'keyUp')
        await asyncio.sleep(0.7)
        ctl = await c.ev("(() => { const b = document.querySelector('#box .opt.sel'); return { open: __ds4.UI.openKind(), cursor: b ? b.textContent : null, you: __ds4.state.people.you.status }; })()", False)
        res[ev] = {'runs': n, 'deaths': deaths, 'choices_made': chosen, 'modes': '/'.join(modes) + ' 번갈아', 'by_mode': by_mode, 'samples': runs[:3], 'control_down_then_space': ctl}
        print(ev, json.dumps(res[ev], ensure_ascii=False))
    res['console_errors'] = c.errors()
    with open(out('screen_space_guard.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


HEADS_JS = r"""
(() => {
  const ids = ['player', 'soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon'];
  const dirs = ['down', 'left', 'right', 'up'];
  const CW = 40, CH = 60;
  const c = document.createElement('canvas'); c.width = ids.length * CW; c.height = dirs.length * CH;
  const g = c.getContext('2d'); g.fillStyle = '#3a3029'; g.fillRect(0, 0, c.width, c.height);
  const rows = [];
  ids.forEach((id, i) => dirs.forEach((dir, j) => {
    const src = ART.IMG['v4/walk/' + id] ? 'v4' : ART.IMG['walk/' + id] ? 'v3' : 'none';
    for (const fr of [0, 1, 2]) {
      const im = ART.person(id, fr, 0, dir);
      const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
      let row0 = 0; for (let x = 0; x < im.width; x++) if (d[x * 4 + 3] > 40) row0++;
      let bottom = -1; for (let y = im.height - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 40) { bottom = y; break; }
      rows.push({ id, dir, frame: fr, src, w: im.width, h: im.height, headTop: ART.headTop(id, fr, dir), height: bottom - ART.headTop(id, fr, dir) + 1, opaqueOnTopRow: row0 });
      if (fr === 0) {
        const x0 = i * CW + Math.round((CW - im.width) / 2), y0 = j * CH + CH - 4 - im.height;
        g.drawImage(im, x0, y0);
        g.fillStyle = 'rgba(255,60,60,.9)'; g.fillRect(i * CW, j * CH + CH - 4, CW, 1);                        // 타일 바닥
        g.fillStyle = 'rgba(80,200,255,.9)'; g.fillRect(i * CW, y0 + ART.headTop(id, fr, dir), 3, 1);       // 그림에서 읽은 머리 꼭대기
      }
    }
  }));
  return { img: c.toDataURL('image/png'), rows };
})()
"""


async def task_heads(c, opts):
    """9명 × 4방향 걷기 그림(게임이 그리는 그 캔버스) — 머리 꼭대기가 칸 위 끝에 닿아 잘렸는가(맨 윗줄 불투명 수), 키."""
    await goto_point(c, 'car')
    r = await c.ev(HEADS_JS, False)
    im = Image.open(io.BytesIO(base64.b64decode(r['img'].split(',')[1]))).convert('RGBA')
    big = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for i, n in enumerate(['player', 'soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon']):
        d.text((i * 120 + 3, 2), n, fill=(255, 255, 255, 255))
    for j, n in enumerate(['down', 'left', 'right', 'up']):
        d.text((2, j * 180 + 14), n, fill=(255, 230, 120, 255))
    big.save(out('screen_u5_ingame_4dir.png'))
    rows = r['rows']
    cut = [x for x in rows if x['opaqueOnTopRow'] > 0]
    per = {}
    for x in rows:
        if x['frame'] == 0:
            per.setdefault(x['id'], {})[x['dir']] = x['headTop']
    spread = {k: max(v.values()) - min(v.values()) for k, v in per.items()}
    heights = {x['id']: x['height'] for x in rows if x['frame'] == 0 and x['dir'] == 'down'}
    res = {'sources': sorted({x['id'] + ':' + x['src'] for x in rows}), 'cells_touching_top_edge': len(cut), 'touching': [f"{x['id']}/{x['dir']}/{x['frame']}" for x in cut],
           'head_top_by_dir_stand': per, 'head_top_spread_px': spread, 'stand_height_down': heights}
    print('heads', json.dumps({k: v for k, v in res.items() if k != 'head_top_by_dir_stand'}, ensure_ascii=False))
    with open(out('screen_u5_heads.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


# 새 그림을 숨긴다 (v4 manifest 에서 walk·props·portraits80·cg_s 를 뺀다) — 그림이 오기 전 대체 규칙으로 도는지
NOART_JS = r"""
(() => {
  const of = window.fetch.bind(window);
  window.fetch = (u, o) => of(u, o).then((r) => {
    if (!/img\/manifest\.json/.test(String(u)) || /v3\//.test(String(u))) return r;
    return r.json().then((list) => new Response(JSON.stringify(list.filter((n) => !/^(walk|props|portraits80|portraits80_hurt|cg_s|icons|tiles|sit|sleep)\//.test(n))), { headers: { 'Content-Type': 'application/json' } }));
  });
})();
"""


async def task_fallback(c, opts):
    """새 그림 없이(대체 규칙) — 화로(불은 드럼통 그림 하나), 걷기(v3 그림), 대화 초상(v3 96)."""
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': NOART_JS}))['identifier']
    res = {}
    try:
        await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
        res['v4_walk_loaded'] = await c.ev("Object.keys(ART.IMG).filter((k) => /^v4\\/(walk|props)\\//.test(k)).length", False)
        await normal_speed(c)
        await place(c, 13, 12, 'up')
        await asyncio.sleep(0.3)
        im = await canvas(c)
        cm = await cam(c)
        fx, fy = 13 * T + cm['ox'], 10 * T + cm['oy']
        zoom(im, (fx - 32, fy - 32, fx + 64, fy + 48), 5, out('screen_fallback_fire_zoom.png'))
        await stage_shot(c, out('screen_fallback_morning3.png'))
        await c.ev(REC, False)
        await place(c, 17, 5, 'right')
        fr = await walk_tiles(c, 'ArrowRight', 2, snap=True)
        pick = [f for i, f in enumerate(fr) if i == 0 or f['wf'] != fr[i - 1]['wf']]
        strip_img(pick, out('screen_fallback_walk_strip_right.png'))
        res['console_errors'] = c.errors()
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    print('fallback', res)
    with open(out('screen_fallback.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


# ── P0-S5 첫 만남 · P0-S6 물건 (2026-10-24) ──────────────────────────────────────────────

async def until(c, expr, limit=15):
    """식이 참이 될 때까지 (참이면 True, 시간이 다 되면 False — 멈추지 않는다)."""
    t0 = time.time()
    while time.time() - t0 < limit:
        try:
            if await c.ev(f'(() => {{ try {{ return !!({expr}); }} catch (e) {{ return false; }} }})()', False):
                return True
        except Exception:
            pass
        await asyncio.sleep(0.1)
    return False


async def bubbles(c):
    return await c.ev("[...document.querySelectorAll('#bubbles .bub')].map((b) => b.textContent)", False)


async def clip_cells(c, path, x0, y0, x1, y1):
    """지도 칸 사각형(x0..x1, y0..y1 포함)을 페이지 화면에서 잘라 찍는다 — HTML 말풍선 층까지 보인다."""
    r = await c.ev("""(() => { const b = document.getElementById('stage').getBoundingClientRect(); const cm = __ds4.scene.cam;
      return { x: b.left, y: b.top, k: b.width / 480, ox: cm.ox, oy: cm.oy }; })()""", False)
    k = r['k']
    X0 = r['x'] + (x0 * T + r['ox']) * k
    Y0 = r['y'] + (y0 * T + r['oy']) * k
    W = (x1 - x0 + 1) * T * k
    H = (y1 - y0 + 1) * T * k
    sx, sy = max(r['x'], X0), max(r['y'], Y0)
    return await c.shot(path, {'x': sx, 'y': sy, 'width': min(W, r['x'] + 480 * k - sx), 'height': min(H, r['y'] + 320 * k - sy)})


def line_of(lid):
    return f"((__ds4.db.lines['{lid}'] || [])[0] || {{}}).text || ''"


# 줄을 넘기는 봇: 한 줄 창은 넘기고, 다친 사람 창은 '말을 건다'·붕대 창은 '둔다', 수첩 적기는 취소. 본 줄은 window.__seen 에
PASS_BOT = r"""(() => { window.__seen = []; __ds4.setBot((k, info) => {
  if (k === 'line') { window.__seen.push({ text: info.text, name: info.opts && info.opts.name || '', tag: info.opts && info.opts.tag || '' }); return undefined; }
  if (k === 'tend') { const i = info.options.findIndex((o) => o.label === '말을 건다'); return i >= 0 ? i : info.options.length - 1; }
  if (k === 'write') return 1;
  return undefined; }); return 1; })()"""


async def task_meet(c, opts):
    """P0-S5 끝 증거: 터널 4·2·1칸 말풍선 / 승강장 도착 때 창 없음 / 순례 6·4·2칸 반응 / D0 저녁 증언 / D1 배식 창 / 셔터 말풍선 / 같은 날 3번 말 걸기."""
    res = {}
    # n01~n03 터널: 기철 사다리 (헤드램프 빛: 6칸 안 = 당신에게 멈춤 · 2칸 = 발 · '…신었군.' 뒤 = 제 앞으로 거둠)
    await goto_point(c, 'tunnel', "__ds4.scene.map.id === 'tunnel'")
    tun = []
    for i, (n, x) in enumerate(((4, 12), (2, 14), (1, 15))):
        want = await c.ev(line_of(f'bark_gicheol_{n}'), False)
        await place(c, x, 2, 'right')
        ok = await until(c, f"[...document.querySelectorAll('#bubbles .bub')].some((b) => b.textContent === {json.dumps(want)})", 8)
        await asyncio.sleep(0.5)
        beam = await c.ev("(() => { const g = __ds4.peopleOnMap().find((p) => p.id === 'gicheol'); return g && g.beam ? { deg: Math.round(g.beam.ang * 180 / Math.PI), r: +g.beam.r.toFixed(2), spread: Math.round(g.beam.spread * 180 / Math.PI) } : null; })()", False)
        p = out(f'screen_n0{i + 1}_tunnel_{n}.png')
        await clip_cells(c, p, 8, 0, 18, 4)
        tun.append({'distance': n, 'you': [x, 2], 'want': want, 'shown': ok, 'bubbles': await bubbles(c), 'beam': beam, 'shot': os.path.basename(p)})
        print('tunnel', tun[-1])
    await asyncio.sleep(1.4)
    tun.append({'after_1': True, 'beam': await c.ev("(() => { const g = __ds4.peopleOnMap().find((p) => p.id === 'gicheol'); return g && g.beam ? { deg: Math.round(g.beam.ang * 180 / Math.PI), r: +g.beam.r.toFixed(2) } : null; })()", False)})
    res['tunnel'] = tun
    # n04 승강장 도착: 창이 저절로 열리지 않는다
    await goto_point(c, 'arrive', "__ds4.scene.map.id === 'station'")
    await asyncio.sleep(0.8)
    res['arrival'] = await c.ev("({ open: __ds4.UI.isOpen(), kind: __ds4.UI.openKind(), pending: __ds4.state.pending ? __ds4.state.pending.id : '', you: [__ds4.scene.px, __ds4.scene.py], flags: Object.keys(__ds4.state.flags).filter((f) => /^met_|arrived/.test(f)) })", False)
    await stage_shot(c, out('screen_n04_arrive_no_window.png'))
    print('arrival', res['arrival'])
    # n05 순례 6·4·2칸 (만나기 전, 화로 왼쪽 12,10): 6 = 돌아본다(글 없음) · 4 = '멈춰.' · 2 = '…발.'
    sr = []
    for n, x in ((6, 7), (4, 9), (2, 11)):
        want = await c.ev(line_of(f'bark_soonrye_{n}'), False) if n != 6 else ''
        await place(c, x, 11, 'right')
        if n == 6:
            ok = await until(c, "(__ds4.peopleOnMap().find((p) => p.id === 'soonrye') || {}).face !== 'right'", 6)
        else:
            ok = await until(c, f"[...document.querySelectorAll('#bubbles .bub')].some((b) => b.textContent === {json.dumps(want)})", 8)
        await asyncio.sleep(0.3)
        p = out(f'screen_n05_soonrye_{n}.png')
        await clip_cells(c, p, 5, 8, 15, 13)
        who = await c.ev("(() => { const s = __ds4.peopleOnMap().find((p) => p.id === 'soonrye'); return s ? { face: s.face, pose: s.pose, at: [s.x, s.y], talkable: s.talkable } : null; })()", False)
        sr.append({'distance': n, 'you': [x, 11], 'want': want or '(몸만 돌린다)', 'shown': ok, 'soonrye': who, 'bubbles': await bubbles(c), 'shot': os.path.basename(p)})
        print('soonrye', sr[-1])
    res['soonrye'] = sr
    # 마리 6칸 (담요에 앉아 이름을 왼다)
    want = await c.ev(line_of('bark_mari_6'), False)
    await place(c, 15, 12, 'right')
    ok = await until(c, f"[...document.querySelectorAll('#bubbles .bub')].some((b) => b.textContent === {json.dumps(want)})", 8)
    await clip_cells(c, out('screen_n05_mari_6.png'), 13, 8, 22, 13)
    res['mari_6'] = {'want': want, 'shown': ok}
    # 같은 화면: 안내줄 (사람 = 이름표, 화로 = 순례를 만나기 전엔 '조사')
    await place(c, 11, 10, 'right')
    await asyncio.sleep(0.3)
    res['hint_soonrye'] = await c.ev("document.getElementById('hint').textContent", False)
    print('hint', res['hint_soonrye'])
    # 말을 건다 → pro_platform: 대사창 이름표 = 생김새('청소원 조끼의 할머니'), 진짜 이름 없음
    await c.ev("""(() => { __ds4.setBot((k, info) => (k === 'line' && info.opts && info.opts.tag === 'pro_platform' ? 'hold' : undefined)); __ds4.interact(); return 1; })()""", False)
    await until(c, "__ds4.UI.openKind() === 'line' && document.querySelector('#box .who')", 10)
    await asyncio.sleep(0.4)
    res['platform_tag'] = await c.ev("({ who: (document.querySelector('#box .who') || {}).textContent || '', text: (document.querySelector('#box .tw') || {}).textContent || '', pending: __ds4.state.pending ? __ds4.state.pending.id : '' })", False)
    await stage_shot(c, out('screen_n05_platform_nametag.png'))
    print('platform', res['platform_tag'])
    # n06 D0 저녁 증언 (얼굴·진짜 이름)
    await c.open(f'/v4/index.html?fast=1&auto=testify&seed=7&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && document.querySelector('#box .who')", limit=300)
    await asyncio.sleep(0.6)
    res['testify'] = await c.ev("""(() => { const f = document.querySelector('#box .face'); return { day: __ds4.state.day, phase: __ds4.state.phase, who: document.querySelector('#box .who').textContent,
      text: document.querySelector('#box .tw').textContent, face: f ? (f.src || '').split('/').slice(-2).join('/') : '', faceNatural: f ? f.naturalWidth : 0, pending: __ds4.state.pending ? __ds4.state.pending.id : '' }; })()""", False)
    await stage_shot(c, out('screen_n06_testify_d0.png'))
    print('testify', res['testify'])
    # n07 D1 배식 창: 안 만난 사람의 이름(진짜 이름·이름표)이 없다
    await c.open(f'/v4/index.html?fast=1&auto=ration1&seed=7&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.UI.openKind() === 'ration'", limit=300)
    await asyncio.sleep(0.4)
    res['ration_d1'] = await c.ev("""(() => { const s = __ds4.state, db = __ds4.db; const txt = document.getElementById('box').textContent;
      const unmet = db.peopleOrder.filter((id) => id !== 'you' && !__ds4.met(id));
      const leaks = []; for (const id of unmet) { const look = ((db.lines['look_' + id] || [])[0] || {}).text; if (txt.includes(s.people[id].name)) leaks.push(s.people[id].name); if (look && txt.includes(look)) leaks.push(look); }
      return { day: s.day, bowls: [...document.querySelectorAll('#box .bowls span')].map((b) => b.textContent), unmet, unmet_status: Object.fromEntries(unmet.map((id) => [id, s.people[id].status])), leaks }; })()""", False)
    await stage_shot(c, out('screen_n07_ration_d1.png'))
    print('ration', res['ration_d1'])
    # n08 D1 낮 셔터: 물건 말풍선 (8칸 '쿵. 쿵. 쿵.' → 3칸 '열어. 사람이야. 신발 신었어.')
    await goto_point(c, 'shutter1', "__ds4.state.day === 1 && __ds4.state.phase === 'day'")
    want = await c.ev(line_of('bark_shutter_3'), False)
    ok = await until(c, f"[...document.querySelectorAll('#bubbles .bub')].some((b) => b.textContent === {json.dumps(want)})", 8)
    await clip_cells(c, out('screen_n08_shutter_d1.png'), 0, 3, 8, 9)
    res['shutter'] = {'want': want, 'shown': ok, 'bubbles': await bubbles(c), 'heard': await c.ev("__ds4.hearLog.filter((h) => /bark_shutter/.test(h.key)).map((h) => h.key)", False)}
    print('shutter', res['shutter'])
    # 같은 날 같은 사람에게 3번 말 걸기 (D3 아침) — 같은 줄이 연달아 나오지 않는다
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    await c.ev(PASS_BOT, False)
    talk = {}
    for who in ['soonrye', 'gicheol', 'mari', 'eunji', 'dongha']:
        if not await c.ev(f"__ds4.state.people['{who}'].status === 'home' && __ds4.met('{who}')", False):
            continue
        seq = []
        for _ in range(3):
            await c.ev("window.__seen = []", False)
            await c.ev(f"__ds4.flow(() => __ds4.talkTo('{who}'))", True)
            await until(c, "!__ds4.UI.isOpen()", 10)
            last = await c.ev(f"(() => {{ const l = __ds4.talkLog.filter((t) => t.who === '{who}'); return l.length ? l[l.length - 1] : null; }})()", False)
            seen = await c.ev("window.__seen", False)
            seq.append({'key': last['key'] if last else None, 'lines': [x['text'] for x in seen], 'name': seen[0]['name'] if seen else ''})
        keys = [x['key'] for x in seq]
        talk[who] = {'seq': seq, 'consecutive_repeat': any(keys[i] == keys[i - 1] for i in range(1, len(keys)))}
        print('talk', who, keys)
    res['talk3'] = talk
    res['talk3_any_repeat'] = any(v['consecutive_repeat'] for v in talk.values())
    res['console_errors'] = c.errors()
    with open(out('screen_meet.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


# 크기 비교판: 게임이 지도에 그리는 바로 그 그림(RENDER.artFor)을 46px 사람 옆에 1배로 놓는다
BOARD_JS = r"""
(() => {
  const db = __ds4.db, R = window.RENDER;
  const HAND_IDS = /^(bottle|bowl|bandage)_(soonrye|you)$|^(notebook_you|notebook_dash|scissors|shoe_cab|car_shoes|radio|radio_cab)$/;
  const rows = [];
  const seen = new Set();
  for (const mid of ['station', 'car', 'tunnel']) for (const mo of db.maps[mid].objects) {
    const o = db.objects[mo.id]; if (!o) continue;
    for (const st of o.states) {
      const hand = HAND_IDS.test(mo.id) || (mo.id === 'shoes_stairs' && st !== 'none');
      const furn = ['medkit', 'lever', 'shelter_box', 'crate_food', 'bag', 'pipe', 'stairs_line'].includes(mo.id);
      if (!hand && !furn) continue;
      const key = mo.id.replace(/_(soonrye|you)$/, '_*') + ':' + st; if (seen.has(key)) continue; seen.add(key);
      const im = R.artFor({ id: mo.id, state: st }); if (!im) continue;
      const c = im.getContext ? im : null; let bb = [im.width, im.height, -1, -1];
      try { const d = c.getContext('2d').getImageData(0, 0, im.width, im.height).data; for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 40) { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); } } catch (e) {}
      const w = bb[2] - bb[0] + 1, h = bb[3] - bb[1] + 1;
      rows.push({ key, group: hand ? 'hand' : 'furniture', w, h, long: Math.max(w, h), img: (c || im).toDataURL('image/png') });
    }
  }
  const you = ART.person('player', 0, 0, 'down');
  let top = you.height; try { const d = you.getContext('2d').getImageData(0, 0, you.width, you.height).data; top = -1; for (let y = 0; y < you.height && top < 0; y++) for (let x = 0; x < you.width; x++) if (d[(y * you.width + x) * 4 + 3] > 40) { top = y; break; } } catch (e) {}
  let bot = -1; try { const d = you.getContext('2d').getImageData(0, 0, you.width, you.height).data; for (let y = you.height - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < you.width; x++) if (d[(y * you.width + x) * 4 + 3] > 40) { bot = y; break; } } catch (e) {}
  return { person: { img: you.toDataURL('image/png'), height: bot - top + 1 }, rows };
})()
"""


async def task_props(c, opts):
    """P0-S6 끝 증거: 크기 비교판(46px 사람 옆 손 물건 ≤ 키 25%) · 지도 위 머리맡 묶음 · 연 구급함·가방·벽감 상자 · 한 칸 전부 조사 · 전동차 좌석·계기판·문틈 빛."""
    from PIL import ImageFont
    res = {}
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    b = await c.ev(BOARD_JS, False)
    ph = b['person']['height']
    K = 5
    person = Image.open(io.BytesIO(base64.b64decode(b['person']['img'].split(',')[1]))).convert('RGBA')
    rows = b['rows']
    hand = [r for r in rows if r['group'] == 'hand']
    furn = [r for r in rows if r['group'] == 'furniture']
    cellw = 34
    W = (person.width + 8 + max(len(hand), len(furn)) * cellw + 8) * K
    H = (48 + 18) * 2 * K + 40
    board = Image.new('RGBA', (W, H), (40, 34, 29, 255))
    d = ImageDraw.Draw(board)
    try:
        font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 13)
    except Exception:
        font = None
    for gi, grp in enumerate((hand, furn)):
        y0 = gi * (48 + 18) * K + 20
        floor = y0 + 48 * K
        board.alpha_composite(person.resize((person.width * K, person.height * K), Image.NEAREST), (4 * K, floor - person.height * K))
        d.line([(0, floor), (W, floor)], fill=(200, 60, 60, 255))
        d.line([(0, floor - int(ph * 0.25 * K)), (W, floor - int(ph * 0.25 * K))], fill=(90, 160, 220, 255))
        d.text((6, y0 - 16), ('손 물건 (파란 줄 = 키의 25%)' if gi == 0 else '가구·긴 물건 (참고)'), fill=(255, 230, 160, 255), font=font)
        x = (person.width + 8) * K
        for r in grp:
            im = Image.open(io.BytesIO(base64.b64decode(r['img'].split(',')[1]))).convert('RGBA')
            board.alpha_composite(im.resize((im.width * K, im.height * K), Image.NEAREST), (x, floor - im.height * K))
            d.text((x, floor + 4), r['key'].replace(':', '\n'), fill=(230, 230, 230, 255), font=font)
            x += cellw * K
    board.save(out('screen_props_scale.png'))
    over = [r['key'] for r in hand if r['long'] > ph * 0.25]
    res['scale'] = {'person_height': ph, 'limit_25pct': round(ph * 0.25, 2), 'hand': {r['key']: [r['w'], r['h']] for r in hand}, 'hand_over_25pct': over,
                    'furniture': {r['key']: [r['w'], r['h']] for r in furn}}
    print('scale', json.dumps(res['scale'], ensure_ascii=False)[:600])
    # 지도 위 그대로: 머리맡 묶음(물통·붕대)·마리 가위·당신 수첩 옆에 선 당신 (4배)
    await place(c, 18, 12, 'up')
    await asyncio.sleep(0.4)
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 10 * T + cm['ox']), max(0, 8 * T + cm['oy']), min(480, 22 * T + cm['ox']), min(320, 13 * T + cm['oy'])), 4, out('screen_props_map_beds.png'))
    # 한 칸 전부 조사: 예전에 겹쳤던 두 칸 (15,11 = 은지 물통·붕대 · 19,11 = 마리 물통·붕대·가위)
    await c.ev(PASS_BOT, False)
    cells = []
    for (cx, cy) in ((15, 11), (19, 11)):
        await place(c, cx, cy + 1, 'up')
        await asyncio.sleep(0.2)
        tg = await c.ev("(() => { const t = __ds4.target(); return t ? { verb: t.verb, name: t.name, ids: t.ids } : null; })()", False)
        hint = await c.ev("document.getElementById('hint').textContent", False)
        n0 = await c.ev('__ds4.cellLog.length', False)
        await c.ev("window.__seen = []; __ds4.interact(); 1", False)
        await asyncio.sleep(0.3)
        await until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto", 15)
        await asyncio.sleep(0.3)
        log = await c.ev(f'__ds4.cellLog.slice({n0})', False)
        seen = await c.ev('window.__seen', False)
        cells.append({'cell': [cx, cy], 'target': tg, 'hint': hint, 'inspected': [x['id'] for x in log], 'lines': [x['text'] for x in seen], 'one_press': True})
        print('cell', cells[-1])
    res['cells'] = cells
    # 전동차: 좌석·계기판·문틈 빛 + 구급함을 연다 (결과 글 얼굴 칸 = 찾은 물건 아이콘 80)
    await c.open(f'/v4/index.html?fast=1&auto=open&seed=7&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && document.querySelector('#box .face.icon')", limit=120)
    await asyncio.sleep(0.5)
    res['open_medkit_line'] = await c.ev("""(() => { const f = document.querySelector('#box .face.icon'); const r = f.getBoundingClientRect(); const k = document.getElementById('stage').getBoundingClientRect().width / 480;
      return { face: f.src.split('/').slice(-2).join('/'), natural: f.naturalWidth, shownLogical: Math.round(r.width / k), text: document.querySelector('#box .tw').textContent, medkit: __ds4.state.traces.medkit ? __ds4.state.traces.medkit.st : '', openLog: __ds4.openLog }; })()""", False)
    await stage_shot(c, out('screen_open_medkit_line.png'))
    print('open line', res['open_medkit_line'])
    for _ in range(4):
        if not await c.ev("__ds4.UI.isOpen()", False):
            break
        await c.ev("__ds4.pick(0); 1", False)
        await asyncio.sleep(0.25)
    await until(c, "!__ds4.UI.isOpen()", 10)
    await c.ev(PASS_BOT, False)
    await c.ev("__ds4.use('bag')", True)
    await until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto", 20)
    await c.ev("__ds4.setBot(null); 1", False)
    await place(c, 15, 3, 'right')
    await asyncio.sleep(0.4)
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (8 * T + cm['ox'], 0 * T + cm['oy'], 22 * T + cm['ox'], 6 * T + cm['oy']), 3, out('screen_open_car.png'))
    await stage_shot(c, out('screen_car_full.png'))
    res['car'] = await c.ev("({ medkit: __ds4.state.traces.medkit.st, bag: __ds4.state.traces.bag.st, tiles: { h: __ds4.db.maps.car.rows[2], D: __ds4.db.maps.car.rows[4] }, blocked_h: __ds4.objectsOnMap ? 1 : 0, opened: __ds4.openLog })", False)
    print('car', res['car'])
    # 3박자 시간 재기 (보통 빠르기): 구급함 — 고른 뒤 결과 글까지 ≥ 0.4초, 그 사이 구급함이 1px 흔들린다
    await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
    await c.wait(READY_CAR)
    await normal_speed(c)
    await c.ev("__ds4.E.DELAYS.type = 0; 1", False)
    await place(c, 19, 2, 'up')
    # 프레임마다 구급함 그림을 그린 가로 자리(ctx.drawImage 의 x)를 남긴다 — 흔들림(0.4초) 동안 ±1px, 그 뒤 제자리
    await c.ev("""(() => { const R = window.RENDER, orig = R.__drawOrig || R.draw; R.__drawOrig = orig; window.__sk = [];
      const arts = [ART.v4prop('medkit'), ART.v4prop('medkit_open')].filter(Boolean);
      R.draw = function (ctx, cv, sc, state, people, objs, tick, opts) {
        const od = ctx.drawImage, xs = [];
        ctx.drawImage = function (im, ...a) { if (arts.includes(im)) xs.push(a.length >= 8 ? a[4] : a[0]); return od.call(this, im, ...a); };
        let r; try { r = orig.apply(this, arguments); } finally { ctx.drawImage = od; }
        const now = opts && opts.now;
        window.__sk.push({ t: now, on: !!(opts && opts.shake && now < opts.shake.until), x: xs.length ? xs[0] : null });
        if (window.__sk.length > 200) window.__sk.shift(); return r; }; return 1; })()""", False)
    await c.ev("""(() => { window.__t = {}; __ds4.setBot((k, info) => { if (k === 'event') { window.__t.choose = performance.now(); return 0; } if (k === 'line' && info.opts && info.opts.faceCls === 'icon') { window.__t.line = performance.now(); return 'hold'; } return undefined; }); __ds4.interact(); return 1; })()""", False)
    await until(c, "window.__t.line", 10)
    await asyncio.sleep(0.3)
    t = await c.ev("window.__t", False)
    sk = await c.ev("""(() => { const f = (window.__sk || []).filter((x) => x.x != null); const on = f.filter((x) => x.on), off = f.filter((x) => !x.on);
      const rest = off.length ? off[off.length - 1].x : null;
      return { frames_on: on.length, x_during_shake: on.map((x) => x.x), x_at_rest: rest, span_ms: on.length ? Math.round(on[on.length - 1].t - on[0].t) : 0 }; })()""", False)
    res['three_beat'] = {'choose_to_line_ms': round(t.get('line', 0) - t.get('choose', 0)) if t.get('line') else None, 'shake': sk,
                         'shifted_frames': sum(1 for x in (sk or {}).get('x_during_shake', []) if sk and x != sk.get('x_at_rest'))}
    print('three_beat', res['three_beat'])
    # 터널 벽감 상자: 기철 첫 만남에서 '벽감 상자부터 연다'
    await goto_point(c, 'tunnel', "__ds4.scene.map.id === 'tunnel'")
    await c.ev("""(() => { __ds4.setBot((k, info) => { if (k === 'event') return info.options.findIndex((o) => /벽감/.test(o.label)); return undefined; }); __ds4.use('gicheol'); return 1; })()""", False)
    await until(c, "__ds4.state.traces.shelter_box && __ds4.state.traces.shelter_box.st === 'open' && !__ds4.UI.isOpen()", 30)
    await c.ev("__ds4.setBot(null); 1", False)
    await place(c, 14, 2, 'up')
    await asyncio.sleep(0.4)
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (11 * T + cm['ox'], 0 * T + cm['oy'], 18 * T + cm['ox'], 4 * T + cm['oy']), 4, out('screen_open_shelter_box.png'))
    res['shelter_box'] = await c.ev("__ds4.state.traces.shelter_box.st", False)
    res['console_errors'] = c.errors()
    with open(out('screen_props.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


# ── 2026-10-24 검증에서 남은 문제 다시 보기 (recheck) ──
RC_FIRE_JS = r"""
(() => {
  const D = window.__ds4, db = D.db, st = D.state, T = 32;
  const m = db.maps.station, fo = m.objects.find((o) => o.id === 'fire');
  const drum = ART.v4prop('drum_open');
  const base = D.objectsOnMap().find((o) => o.id === 'fire') || { id: 'fire', x: fo.x, y: fo.y, name: '화로', solid: true, light: 4 };
  const withSt = (s, noOv) => { const d = db.objects.fire; return Object.assign({}, base, { state: s, stateName: s, overlay: noOv ? null : (d.overlay && d.overlay[s] ? d.overlay[s] : null), hidden: false }); };
  function render(objs, dark) {
    const sc = { map: dark ? m : Object.assign({}, m, { dark: 0.0001 }), rows: m.rows, w: m.rows[0].length, h: m.rows.length, px: fo.x, py: fo.y + 3, face: 'up', moving: null, walkDist: 0, steps: 0 };
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 320;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    RENDER.draw(ctx, cv, sc, st, [], objs, 0, { now: 250 });
    return { ctx, cv, ox: sc.cam.ox, oy: sc.cam.oy };
  }
  const saved = st.traces.fire ? JSON.parse(JSON.stringify(st.traces.fire)) : undefined;
  const out = { drum: !!drum, states: {}, imgs: {} };
  try {
    for (const s of db.objects.fire.states) {
      st.traces.fire = Object.assign({}, saved || {}, { st: s });
      const A = render([withSt(s, false)], false), B = render([withSt(s, true)], false);
      let px = 0, cov = 0;
      if (drum) {
        const dd = drum.getContext('2d').getImageData(0, 0, drum.width, drum.height).data;
        const X = fo.x * T + Math.round((T - drum.width) / 2) + A.ox, Y = fo.y * T + T - drum.height + A.oy;
        const a = A.ctx.getImageData(X, Y, drum.width, drum.height).data, b = B.ctx.getImageData(X, Y, drum.width, drum.height).data;
        for (let i = 0; i < dd.length; i += 4) if (dd[i + 3] > 40) { px++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) cov++; }
      }
      out.states[s] = { overlay: db.objects.fire.overlay[s] || null, drumPx: px, coveredByOverlay: cov, coveredPct: px ? Math.round(100 * cov / px) : null };
      const V = render([withSt(s, false)], true);
      const c2 = document.createElement('canvas'); c2.width = 3 * T; c2.height = 3 * T;
      c2.getContext('2d').drawImage(V.cv, (fo.x - 1) * T + V.ox, (fo.y - 1) * T + V.oy, 3 * T, 3 * T, 0, 0, 3 * T, 3 * T);
      out.imgs[s] = c2.toDataURL('image/png');
    }
  } finally { if (saved === undefined) delete st.traces.fire; else st.traces.fire = saved; }
  return out;
})()
"""

RC_OCC_JS = r"""
(() => {
  const D = window.__ds4, db = D.db, st = D.state, sc0 = D.scene, T = 32;
  function render(m, objs, px, py, face, crouch) {
    const sc = { map: Object.assign({}, m, { dark: 0.0001 }), rows: m.rows, w: m.rows[0].length, h: m.rows.length, px, py, face, moving: null, walkDist: 0, steps: 0, crouch: !!crouch };
    const cv = document.createElement('canvas'); cv.width = sc.w * T + 64; cv.height = sc.h * T + 64;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    RENDER.draw(ctx, cv, sc, st, [], objs, 0, { now: 0 });
    return { data: ctx.getImageData(0, 0, cv.width, cv.height).data, cv };
  }
  function objsOf(mapId) {
    const save = { map: sc0.map, rows: sc0.rows, w: sc0.w, h: sc0.h };
    const m = db.maps[mapId];
    sc0.map = m; sc0.rows = m.rows; sc0.w = m.rows[0].length; sc0.h = m.rows.length;
    let out; try { out = D.objectsOnMap(); } finally { Object.assign(sc0, save); }
    return out;
  }
  const withState = (o, s) => { const d = db.objects[o.id]; return Object.assign({}, o, { state: s, stateName: s, overlay: d.overlay && d.overlay[s] ? d.overlay[s] : null, hidden: false }); };
  const mask = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++; return n; };
  // [map, id, 닫힘, 열림, 여는 칸, 방향, 여는 동안 쪼그려 앉나(바닥 가구 · 맨 윗줄이라 덜 올라간 벽감 상자)]
  const CASES = [['car', 'medkit', 'closed', 'open', [19, 2], 'up', false], ['car', 'lever', 'up', 'pulled', [20, 2], 'up', false], ['tunnel', 'shelter_box', 'closed', 'open', [14, 1], 'up', true],
    ['station', 'crate_food', 'closed', 'open', [8, 3], 'up', true], ['car', 'bag', 'closed', 'open', [10, 3], 'down', true]];
  const out = [];
  for (const [mapId, id, cs, os, [sx, sy], face, floor] of CASES) {
    const m = db.maps[mapId], base = objsOf(mapId).find((o) => o.id === id);
    if (!base) { out.push({ map: mapId, id, error: 'no object' }); continue; }
    const C = withState(base, cs), O = withState(base, os);
    const e0 = render(m, [], -4, -4, face), c0 = render(m, [C], -4, -4, face), o0 = render(m, [O], -4, -4, face);
    const closedPx = mask(c0, e0), openChange = mask(c0, o0);
    const e1 = render(m, [], sx, sy, face), c1 = render(m, [C], sx, sy, face), o1 = render(m, [O], sx, sy, face);
    const closedVis = mask(c1, e1), openVis = mask(c1, o1);
    const row = { map: mapId, id, stand: [sx, sy], face, closedVisiblePct: Math.round(100 * closedVis / closedPx), openChangeVisiblePct: Math.round(100 * openVis / openChange), onWall: (m.rows[base.y] || '')[base.x] === '#' };
    if (floor) {                                                       // 여는 순간(3박자 동안) 당신이 쪼그려 앉는다
      const e2 = render(m, [], sx, sy, face, true), c2 = render(m, [C], sx, sy, face, true), o2 = render(m, [O], sx, sy, face, true);
      row.openChangeVisiblePct_crouch = Math.round(100 * mask(c2, o2) / openChange);
      row.closedVisiblePct_crouch = Math.round(100 * mask(c2, e2) / closedPx);
    }
    out.push(row);
  }
  return out;
})()
"""

RC_LEAK_JS = r"""
(() => { const st = __ds4.state, db = __ds4.db;
  const told = (id) => { const rows = db.lines['testify_' + id] || []; return rows.some((r, i) => st.heard && st.heard['testify_' + id + '#' + i] != null); };
  const byGiven = {}; for (const [id, o] of Object.entries(db.objects)) { const m = /_([a-z]+)$/.exec(id); if (m && m[1] !== 'you' && st.people[m[1]]) byGiven[o.name.split(' ')[0]] = m[1]; }
  const secret = Object.keys(byGiven).filter((g) => !(__ds4.met(byGiven[g]) && told(byGiven[g])));
  const objs = __ds4.objectsOnMap().filter((o) => !o.hidden);
  return { day: st.day, phase: st.phase, secret, leaks: objs.filter((o) => secret.some((g) => o.name.includes(g))).map((o) => o.id + ':' + o.name),
    bowls_shown: objs.filter((o) => /^bowl_/.test(o.id)).map((o) => o.id + ':' + o.name), owned_names: objs.filter((o) => /_(soonrye|seoha|gicheol|eunji|dongha|mari)$/.test(o.id)).map((o) => o.id + ':' + o.name) }; })()
"""


def luma_stats(im):
    g = im.convert('L')
    px = list(g.getdata())
    return {'mean': round(sum(px) / len(px), 1), 'pct_below_40': round(100 * sum(1 for v in px if v < 40) / len(px), 1)}


async def drive_lines(c, limit=12):
    """봇이 한 줄 창을 넘기는 동안, 창이 다 닫힐 때까지 기다린다."""
    await asyncio.sleep(0.2)
    await until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", limit)


async def task_recheck(c, opts):
    res = {}
    # ── #1 화로 low·wet 덧그림이 드럼통을 덮나 (같은 칸·같은 프레임, 상태 4개) + #2 밝기 (아침 D3, 지금 / ?light=p1) ──
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    f = await c.ev(RC_FIRE_JS, False)
    res['fire_states'] = f['states']
    sts = list(f['imgs'].keys())
    K = 4
    board = Image.new('RGB', (len(sts) * (96 * K + 8), 96 * K + 24), (20, 20, 20))
    d = ImageDraw.Draw(board)
    for i, s_ in enumerate(sts):
        im = Image.open(io.BytesIO(base64.b64decode(f['imgs'][s_].split(',')[1]))).convert('RGB').resize((96 * K, 96 * K), Image.NEAREST)
        board.paste(im, (i * (96 * K + 8), 24))
        d.text((i * (96 * K + 8) + 4, 4), f"fire:{s_} covered {f['states'][s_]['coveredPct']}%", fill=(240, 220, 160))
    board.save(out('screen_recheck_fire_states.png'))
    print('fire', json.dumps(f['states'], ensure_ascii=False))
    im = await canvas(c)
    res['brightness_now'] = luma_stats(im)
    im.save(out('screen_recheck_bright_now.png'))
    await c.open(f'/v4/index.html?fast=1&auto=morning3&seed=7&light=p1&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.scene.map && __ds4.state.day === 3 && __ds4.state.phase === 'trace' && " + IDLE, limit=400)
    await asyncio.sleep(0.4)
    im2 = await canvas(c)
    res['brightness_p1'] = luma_stats(im2)
    im2.save(out('screen_recheck_bright_p1.png'))
    both = Image.new('RGB', (im.width * 2 + 8, im.height), (20, 20, 20))
    both.paste(im.convert('RGB'), (0, 0))
    both.paste(im2.convert('RGB'), (im.width + 8, 0))
    both.resize((both.width * 2, both.height * 2), Image.NEAREST).save(out('screen_recheck_bright_now_vs_p1.png'))
    res['brightness_p1_mode_on'] = await c.ev('RENDER.LIGHT_P1', False)
    print('bright', res['brightness_now'], res['brightness_p1'])
    # ── #9 부품 상자(공구함) != 창고 상자 · #10·#14 벽걸이·바닥 가구 가림 ──
    res['crates'] = await c.ev("""(() => { const R = RENDER; const a = R.artFor({ id: 'parts_crate', state: 'storage' }), b = R.artFor({ id: 'crate_food', state: 'closed' }), h = R.artFor({ id: 'parts_crate', state: 'hidden' });
      const px = (im) => (im && im.getContext ? im.toDataURL() : '');
      return { parts: [a.width, a.height], crate: [b.width, b.height], same: px(a) === px(b), parts_is_toolbox: a === ART.v4prop('toolbox'), parts_hidden_is_open_toolbox: h === ART.v4prop('toolbox_open') }; })()""", False)
    print('crates', res['crates'])
    res['occlusion'] = await c.ev(RC_OCC_JS, False)
    for r in res['occlusion']:
        print('occ', json.dumps(r, ensure_ascii=False))
    # ── #13 저녁: 앉은 사람 바로 위 칸에 선 당신 — 그 사람 꼬리표가 당신 몸에 겹치나 ──
    await c.open(f'/v4/index.html?fast=1&auto=evening5&seed=7&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.state.day === 5 && __ds4.state.phase === 'evening' && __ds4.UI.openKind() === 'line'", limit=400)
    await asyncio.sleep(0.5)
    TAGS = """(() => { const L = RENDER.last || {}; const yb = L.youBox; const hit = (t) => yb && t.x0 < yb.x1 + 1 && t.x0 + 11 > yb.x0 && t.y0 < yb.y1 && t.y0 + 11 > yb.y0;
      const below = __ds4.peopleOnMap().find((p) => p.x === __ds4.scene.px && p.y === __ds4.scene.py + 1);
      return { you: [__ds4.scene.px, __ds4.scene.py], below: below ? below.id : null, youBox: yb, tags: (L.tags || []).map((t) => ({ who: t.who, kind: t.kind, x0: t.x0, y0: t.y0, onYou: t.who !== 'you' && !!hit(t) })) }; })()"""
    tg = await c.ev(TAGS, False)
    tg['tags_on_you'] = sum(1 for t in tg['tags'] if t['onYou'])
    res['evening_tags'] = tg
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 10 * T + cm['ox']), max(0, 8 * T + cm['oy']), min(480, 19 * T + cm['ox']), min(320, 14 * T + cm['oy'])), 3, out('screen_recheck_evening5_tags.png'))
    print('evening tags', tg['you'], tg['below'], 'on you', tg['tags_on_you'])
    # 같은 배치를 일부러 만든다: 당신 (14,11) — 바로 아래 (14,12)에 앉은 사람 (저녁 자리표 그대로), 대화창은 닫고
    await c.ev(PASS_BOT, False)
    for _ in range(8):
        if not await c.ev("__ds4.UI.isOpen()", False):
            break
        await c.ev("__ds4.pick(0); 1", False)
        await asyncio.sleep(0.3)
    await drive_lines(c, 10)
    await c.ev("__ds4.setBot(null); 1", False)
    await place(c, 14, 11, 'up')
    await asyncio.sleep(0.3)
    tg2 = await c.ev(TAGS, False)
    tg2['tags_on_you'] = sum(1 for t in tg2['tags'] if t['onYou'])
    res['evening_tags_forced_14_11'] = tg2
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, 10 * T + cm['ox']), max(0, 8 * T + cm['oy']), min(480, 19 * T + cm['ox']), min(320, 14 * T + cm['oy'])), 3, out('screen_recheck_evening5_tags_14_11.png'))
    print('evening tags forced', tg2['you'], tg2['below'], 'on you', tg2['tags_on_you'])
    # ── #3 #5 #6 #7 D0: 안 만난 사람의 물건 이름·그릇 / 마리 자리 / 되풀이 말 / 목표 줄 ──
    await goto_point(c, 'arrive', "__ds4.scene.map.id === 'station'")
    await c.ev(PASS_BOT, False)
    res['names_d0_before'] = await c.ev(RC_LEAK_JS, False)
    print('names before', json.dumps(res['names_d0_before'], ensure_ascii=False)[:600])
    hints = {}
    for (x, y, face, lab) in ((20, 10, 'up', 'gicheol_blanket'), (21, 10, 'up', 'gicheol_pillow'), (18, 10, 'up', 'seoha_blanket'), (17, 10, 'up', 'seoha_bottle'), (14, 11, 'up', 'seoha_bowl_cell'), (10, 12, 'up', 'mari_bowl_cell')):
        await place(c, x, y, face)
        await asyncio.sleep(0.25)
        hints[lab] = await c.ev("document.getElementById('hint').textContent", False)
    res['hints_d0_before'] = hints
    res['hint_leaks_before'] = [v for v in hints.values() if any(g in v for g in res['names_d0_before']['secret'])]
    print('hints', hints)
    # 마리를 만난다 (말 걸기 → pro_mari 첫 선택 '손을 내민다') → 그 자리에 그대로 앉아 있나 · 이름표 · 담요 이름
    await place(c, 20, 12, 'up')
    await asyncio.sleep(0.3)
    res['mari_before'] = await c.ev("(() => { const m = __ds4.peopleOnMap().find((p) => p.id === 'mari'); return { mari: m ? [m.x, m.y, m.pose] : null, hint: document.getElementById('hint').textContent }; })()", False)
    await c.ev("__ds4.interact(); 1", False)
    await drive_lines(c, 20)
    await asyncio.sleep(0.3)
    res['mari_after'] = await c.ev("""(() => { const m = __ds4.peopleOnMap().find((p) => p.id === 'mari'); const t = __ds4.target();
      return { met: __ds4.met('mari'), mari: m ? [m.x, m.y, m.pose] : null, target: t ? t.kind + ':' + t.name : null, hint: document.getElementById('hint').textContent,
        blanket: (__ds4.objectsOnMap().find((o) => o.id === 'blanket_mari') || {}).name, bowl: (() => { const b = __ds4.objectsOnMap().find((o) => o.id === 'bowl_mari'); return b ? { name: b.name, hidden: b.hidden } : null; })() }; })()""", False)
    print('mari', res['mari_before'], res['mari_after'])
    await clip_cells(c, out('screen_recheck_mari_stays.png'), 16, 8, 23, 13)
    talk = {}
    for who in ('mari', 'soonrye'):
        if who == 'soonrye':                                            # 순례는 먼저 만난다 (pro_platform)
            await c.ev("__ds4.flow(() => __ds4.talkTo('soonrye'))", True)
            await drive_lines(c, 20)
        seq = []
        for _ in range(4):
            await c.ev("window.__seen = []", False)
            await c.ev(f"__ds4.flow(() => __ds4.talkTo('{who}'))", True)
            await drive_lines(c, 10)
            last = await c.ev(f"(() => {{ const l = __ds4.talkLog.filter((t) => t.who === '{who}'); return l.length ? l[l.length - 1].key : null; }})()", False)
            seen = await c.ev("window.__seen", False)
            toast = await c.ev("(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; })()", False)
            seq.append({'key': last, 'lines': [x['text'] for x in seen], 'toast': toast})
        keys = [x['key'] for x in seq]
        texts = [' '.join(x['lines']) for x in seq if x['lines']]
        talk[who] = {'seq': seq, 'same_line_twice': len(texts) != len(set(texts))}
        print('talk', who, keys)
    res['retalk_d0'] = talk
    res['names_d0_after_meet'] = await c.ev(RC_LEAK_JS, False)
    print('names after', json.dumps(res['names_d0_after_meet'], ensure_ascii=False)[:600])
    obj = {}
    for ph in ('day', 'evening', 'night'):
        obj[ph] = await c.ev(f"(() => {{ const s = __ds4.state, was = s.phase; s.phase = '{ph}'; try {{ return __ds4.objective(); }} finally {{ s.phase = was; }} }})()", False)
    res['objective_d0'] = obj
    print('objective', obj)
    # ── #11 찾은 물건 아이콘 (가방 = 케이블 · 수첩 · 구급함 = 약 · 레버 = 생수) ──
    await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
    await c.wait(READY_CAR)
    await c.ev(r"""(() => { window.__faces = []; __ds4.setBot((k, info) => { if (k === 'line' && info.opts && /:out$/.test(info.opts.tag || '')) window.__faces.push({ tag: info.opts.tag, face: (info.opts.face || '').split('/').slice(-2).join('/'), cls: info.opts.faceCls || '' }); return undefined; }); return 1; })()""", False)
    for oid in ('bag', 'notebook_dash', 'medkit', 'lever'):
        await c.ev(f"__ds4.use('{oid}')", True)
        await drive_lines(c, 20)
    res['found_icons'] = {'faces': await c.ev('window.__faces', False), 'foundLog': await c.ev('__ds4.foundLog', False)}
    print('found', json.dumps(res['found_icons'], ensure_ascii=False)[:700])
    # ── #14 연 구급함 자리에 선 당신 (벽면 높이) ──
    await c.ev("__ds4.setBot(null); 1", False)
    await place(c, 19, 2, 'up')
    await asyncio.sleep(0.4)
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (17 * T + cm['ox'], 0 * T + cm['oy'], 22 * T + cm['ox'], 4 * T + cm['oy']), 4, out('screen_recheck_open_medkit_wall.png'))
    # ── #4 D0 계단에서 죽었을 때 명부 (증언 전 → 이름표) ──
    if 'pro_stairs' in FIXTURES:
        await c.open(f'/v4/index.html?fast=1&auto=manual&seed=7&state=/__fixture/pro_stairs.json&sc={int(time.time() * 1000)}')
        await c.wait("__ds4.UI && __ds4.state && __ds4.state.pending && __ds4.UI.openKind() === 'line'", limit=60)
        await c.ev(r"""(() => { __ds4.setBot((k, info) => { if (k === 'event') return info.options.findIndex((o) => /구두|오른다/.test(o.label)); if (k === 'confirm2') return 0; if (k === 'death_ledger') return 'hold'; return undefined; }); return 1; })()""", False)
        for _ in range(3):                      # 첫 줄은 봇이 붙기 전에 열렸다 — 손으로 넘긴다 (글자가 찍히는 중이면 한 번 더)
            await c.ev("__ds4.pick(0); 1", False)
            await asyncio.sleep(0.25)
            if await c.ev("__ds4.UI.openKind() !== 'line' || __ds4.state.people.you.status !== 'home'", False):
                break
        await until(c, "__ds4.UI.openKind() === 'death_ledger'", 30)
        await asyncio.sleep(0.4)
        res['death_ledger'] = await c.ev("""(() => { const st = __ds4.state, db = __ds4.db; const box = document.getElementById('box'); const txt = box ? box.textContent : '';
          const told = (id) => (db.lines['testify_' + id] || []).some((r, i) => st.heard && st.heard['testify_' + id + '#' + i] != null);
          const secret = db.peopleOrder.filter((id) => id !== 'you' && !told(id)).map((id) => st.people[id].name);
          return { reached: __ds4.UI.openKind(), day: st.day, head: (box.querySelector('.who') || {}).textContent || '', rows: [...box.querySelectorAll('.ledger .row')].map((r) => r.textContent), leaks: secret.filter((n) => txt.includes(n)) }; })()""", False)
        await stage_shot(c, out('screen_recheck_death_ledger_d0.png'))
        print('death ledger', res['death_ledger'])
    else:
        res['death_ledger'] = {'error': 'pro_stairs fixture 없음'}
    res['console_errors'] = c.errors()
    with open(out('screen_recheck.json'), 'w', encoding='utf-8') as fp:
        json.dump(res, fp, ensure_ascii=False, indent=1)


# ── 2026-10-24 검증 남은 화면 몫 12건 (apply) ─────────────────────────────────────────────
# 결과: screen_apply.json + screen_apply_*.png (--out 폴더). 항목 번호는 화면 담당 일감 목록 순서.

async def app_shot(c, path):
    """게임 틀 전체(#app: 지도 + 오른쪽 패널의 목표 줄·안내줄)를 찍는다."""
    r = await c.ev("(() => { const b = document.getElementById('app').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()", False)
    return await c.shot(path, {'x': r['x'], 'y': r['y'], 'width': r['w'], 'height': r['h']})


# 증언 전인 사람의 진짜 이름(성까지 · 이름만) — 화면 글에 나오면 새는 것
AP_SECRET_JS = r"""(() => { const st = __ds4.state, db = __ds4.db;
  const told = (id) => { const rows = db.lines['testify_' + id] || []; return !rows.length || rows.some((r, i) => st.heard && st.heard['testify_' + id + '#' + i] != null); };
  const out = []; for (const id of db.peopleOrder) { if (id === 'you' || told(id) || !(db.lines['look_' + id] || []).length) continue; const n = st.people[id].name; out.push(n); if (n.length >= 3) out.push(n.slice(1)); }
  return out; })()"""

# 주인 있는 물건(안 만난·증언 전 사람의 것)마다: 이름·마우스 글·서서 조사할 칸
AP_OWNED_JS = r"""(() => { const D = __ds4, sc = D.scene, ppl = D.peopleOnMap(), objs = D.objectsOnMap();
  const solidAt = (x, y) => objs.some((o) => !o.hidden && o.solid && o.x === x && o.y === y) || ppl.some((p) => p.x === x && p.y === y) || '#tRhDCk'.includes((sc.rows[y] || '')[x] || '#');
  const out = [];
  for (const o of objs) {
    const m = /_(soonrye|seoha|gicheol|eunji|dongha|mari)$/.exec(o.id); if (!m || o.hidden) continue;
    let stand = null; for (const [dx, dy, face] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) { const x = o.x + dx, y = o.y + dy; if (!solidAt(x, y)) { stand = [x, y, face]; break; } }
    out.push({ id: o.id, owner: m[1], met: D.met(m[1]), name: o.name, hover: D.hoverName(o.x, o.y), x: o.x, y: o.y, stand });
  }
  return out; })()"""

AP_TAGS_JS = """(() => { const L = RENDER.last || {}; const yb = L.youBox; const hit = (t) => yb && t.x0 < yb.x1 + 1 && t.x0 + 11 > yb.x0 && t.y0 < yb.y1 && t.y0 + 11 > yb.y0;
  const below = __ds4.peopleOnMap().find((p) => p.x === __ds4.scene.px && p.y === __ds4.scene.py + 1);
  return { you: [__ds4.scene.px, __ds4.scene.py], below: below ? below.id : null, youBox: yb, tags: (L.tags || []).map((t) => ({ who: t.who, kind: t.kind, x0: t.x0, y0: t.y0, onYou: t.who !== 'you' && !!hit(t) })) }; })()"""

# 찾은 물건 아이콘 표: 모든 사건 × 선택 × 결과(out·ok·fail)에 대해, 그 결과가 세우는 깃발·늘리는 자원으로 foundIcon 을 돌린다
AP_FOUND_TABLE_JS = r"""(() => { const D = __ds4, db = D.db, out = [], used = {};
  for (const ev of Object.values(db.events)) (ev.choices || []).forEach((c, i) => {
    for (const br of ['out', 'ok', 'fail']) {
      const o = c[br]; if (!o) continue;
      const eff = Array.isArray(o.effects) ? o.effects : [];
      const flags = eff.filter((e) => e.verb === 'flag' && (e.set === 1 || e.set === true)).map((e) => e.id);
      const res = eff.filter((e) => e.verb === 'number' && ['food', 'water', 'fuel', 'meds', 'parts'].includes(e.id) && (e.n || 0) > 0 && (e.who == null || e.who === 'you')).map((e) => e.id);
      const r = { text: o.text || '', roll: br === 'out' ? null : { success: br === 'ok' } };
      const icon = D.foundIcon(ev.id, i, r, flags, res);
      if (icon) { out.push({ key: ev.id + '#' + i + ':' + br, icon, text: (o.text || '').slice(0, 40) }); used[icon] = (used[icon] || 0) + 1; }
    }
  });
  const all = Object.keys(ART.IMG).filter((k) => /^v4\/icons\//.test(k)).map((k) => k.slice(9));
  return { rows: out, used, icons: all, unused: all.filter((k) => !used[k]) }; })()"""

AP_POSE_JS = r"""(() => { const ids = ['you', 'soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon']; const out = {};
  for (const id of ids) { const k = ART.spriteId(id); const s = ART.sitPose(id, 'down', 0), sl = ART.sleeper(id, 0);
    out[id] = { sitOwn: !!ART.IMG['v4/sit/' + k], sitW: s ? s.width : null, sitH: s ? s.height : null, sleepOwn: !!ART.IMG['v4/sleep/' + k], sleepW: sl ? sl.width : null }; }
  return out; })()"""


async def ap_place_read(c, x, y, face):
    await place(c, x, y, face)
    await asyncio.sleep(0.25)
    return await c.ev("document.getElementById('hint').textContent", False)


async def ap_hover(c, x, y):
    """마우스를 그 칸 위로 (실제 mousemove) → 안내줄 글."""
    r = await c.ev("""(() => { const b = document.getElementById('cv').getBoundingClientRect(); const cm = __ds4.scene.cam; return { x: b.left, y: b.top, k: b.width / 480, ox: cm.ox, oy: cm.oy }; })()""", False)
    mx = r['x'] + (x * T + 16 + r['ox']) * r['k']
    my = r['y'] + (y * T + 16 + r['oy']) * r['k']
    await c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': mx, 'y': my})
    await asyncio.sleep(0.25)
    return await c.ev("document.getElementById('hint').textContent", False)


async def ap_inspect(c, oid):
    """그 물건까지 걸어가 조사 → 나온 글들 (PASS_BOT 이 window.__seen 에 모은다)."""
    await c.ev("window.__seen = []; 1", False)
    await c.ev(f"__ds4.use('{oid}')", True)
    await drive_lines(c, 20)
    return [x['text'] for x in (await c.ev('window.__seen', False) or [])]


async def ap_zoom(c, path, x0, y0, x1, y1, k):
    im = await canvas(c)
    cm = await cam(c)
    zoom(im, (max(0, x0 * T + cm['ox']), max(0, y0 * T + cm['oy']), min(480, x1 * T + cm['ox']), min(320, y1 * T + cm['oy'])), k, out(path))


async def task_apply(c, opts):
    res = {}
    leak = lambda texts, secret: sorted({n for t in texts for n in secret if n and n in str(t)})
    # ── 1·3·4 D0 승강장: 안 만난 사람 물건 이름 / 조사 글 / 마리 자리 / 목표 줄 ──
    await goto_point(c, 'arrive', "__ds4.scene.map.id === 'station'")
    await c.ev(PASS_BOT, False)
    await normal_speed(c)
    secret = await c.ev(AP_SECRET_JS, False)
    owned = await c.ev(AP_OWNED_JS, False)
    for o in owned:
        if o['stand']:
            sx, sy, face = o['stand']
            o['hint'] = await ap_place_read(c, sx, sy, face)
    res['1_names_d0'] = {'secret': secret, 'owned': owned, 'leaks': leak([o['name'] for o in owned] + [o['hover'] for o in owned] + [o.get('hint', '') for o in owned], secret)}
    await ap_place_read(c, 21, 10, 'up')                             # 안내줄 캡처: 기철 베개 앞
    await app_shot(c, out('screen_apply_01_hint_pillow.png'))
    res['1_hover_mari_bottle'] = await ap_hover(c, 19, 11)            # 마우스를 마리 물통 위에
    await app_shot(c, out('screen_apply_01_hover_mari_bottle.png'))
    await c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 2, 'y': 2})
    await c.ev("document.getElementById('cv').dispatchEvent(new MouseEvent('mouseleave')); 1", False)
    insp = {}
    for oid in ('pillow_gicheol', 'bottle_seoha', 'stairs_line', 'chalk_wall'):
        insp[oid] = await ap_inspect(c, oid)
    res['1_inspect_texts'] = {'texts': insp, 'leaks': leak([t for v in insp.values() for t in v], secret)}
    print('1 names leaks', res['1_names_d0']['leaks'], '| inspect leaks', res['1_inspect_texts']['leaks'], '| hover', res['1_hover_mari_bottle'])
    # ── 3 마리: 만나기 전 담요(20,11)에 앉아 있다 → 말 걸기(pro_mari) → 그 자리 그대로 (D0 낮 내내) ──
    await place(c, 20, 12, 'up')
    await asyncio.sleep(0.3)
    MARI = "(() => { const m = __ds4.peopleOnMap().find((p) => p.id === 'mari'); return { met: __ds4.met('mari'), at: m ? [m.x, m.y, m.pose, m.face] : null, hint: document.getElementById('hint').textContent }; })()"
    before = await c.ev(MARI, False)
    await clip_cells(c, out('screen_apply_03_mari_before.png'), 17, 8, 23, 13)
    await c.ev("__ds4.interact(); 1", False)
    await drive_lines(c, 20)
    await asyncio.sleep(0.4)
    after = await c.ev(MARI, False)
    await clip_cells(c, out('screen_apply_03_mari_after.png'), 17, 8, 23, 13)
    await place(c, 5, 10, 'right')                                  # 멀리 갔다 와도 그대로
    await asyncio.sleep(0.5)
    away = await c.ev(MARI, False)
    res['3_mari'] = {'before': before, 'after_meet': after, 'after_walk_away': away, 'stayed': bool(before['at'] and after['at'] and away['at'] and before['at'][:2] == after['at'][:2] == away['at'][:2])}
    print('3 mari', res['3_mari'])
    # ── 4 목표 줄: D0 낮 → (순례를 만나고) 화로 → 저녁 → 화로 → 밤 (실제 흐름에서 패널 글) ──
    goals = {'day': await c.ev("document.getElementById('goal').textContent", False)}
    await c.ev(PASS_BOT.replace("  if (k === 'write') return 1;", "  if (k === 'write') return 1; if (k === 'fire') return 0;"), False)   # 화로 창 = '앉는다'·'잠자리로'
    await c.ev("__ds4.flow(() => __ds4.talkTo('soonrye'))", True)
    await drive_lines(c, 20)
    await c.ev("__ds4.use('fire')", True)
    await drive_lines(c, 40)
    await until(c, "__ds4.state.phase === 'evening' && !__ds4.UI.isOpen()", 30)
    await asyncio.sleep(0.3)
    goals['evening'] = {'phase': await c.ev('__ds4.state.phase', False), 'goal': await c.ev("document.getElementById('goal').textContent", False)}
    await app_shot(c, out('screen_apply_04_goal_d0_evening.png'))
    await c.ev("__ds4.use('fire')", True)
    await drive_lines(c, 40)
    await until(c, "__ds4.state.phase === 'night' && !__ds4.UI.isOpen()", 30)
    await asyncio.sleep(0.3)
    goals['night'] = {'phase': await c.ev('__ds4.state.phase', False), 'goal': await c.ev("document.getElementById('goal').textContent", False)}
    await app_shot(c, out('screen_apply_04_goal_d0_night.png'))
    res['4_goal_d0'] = goals
    print('4 goals', goals)
    # ── 9 화로 상태 (덧그림이 드럼통을 덮나 + 드럼통 위 불꽃·연기·김) ──
    f = await c.ev(RC_FIRE_JS, False)
    res['9_fire_states'] = f['states']
    sts = list(f['imgs'].keys())
    K = 4
    board = Image.new('RGB', (len(sts) * (96 * K + 8), 96 * K + 24), (20, 20, 20))
    d = ImageDraw.Draw(board)
    for i, s_ in enumerate(sts):
        im = Image.open(io.BytesIO(base64.b64decode(f['imgs'][s_].split(',')[1]))).convert('RGB').resize((96 * K, 96 * K), Image.NEAREST)
        board.paste(im, (i * (96 * K + 8), 24))
        d.text((i * (96 * K + 8) + 4, 4), f"fire:{s_} overlay over drum {f['states'][s_]['coveredPct']}%", fill=(240, 220, 160))
    board.save(out('screen_apply_09_fire_states.png'))
    print('9 fire', json.dumps(f['states'], ensure_ascii=False))
    # ── 6 공구함 ≠ 창고 상자 ──
    res['6_crates'] = await c.ev("""(() => { const R = RENDER; const a = R.artFor({ id: 'parts_crate', state: 'storage' }), b = R.artFor({ id: 'crate_food', state: 'closed' }), h = R.artFor({ id: 'parts_crate', state: 'hidden' });
      const px = (im) => (im && im.getContext ? im.toDataURL() : '');
      return { parts: [a.width, a.height], crate: [b.width, b.height], same: px(a) === px(b), parts_is_toolbox: a === ART.v4prop('toolbox'), parts_hidden_is_open_toolbox: h === ART.v4prop('toolbox_open') }; })()""", False)
    await place(c, 9, 3, 'up')
    await asyncio.sleep(0.4)
    await ap_zoom(c, 'screen_apply_06_toolbox_vs_crate.png', 6, 0, 12, 4, 4)
    print('6 crates', res['6_crates'])
    # ── 2 D0 계단에서 죽는다 (순례를 만나고, 증언 전) → 사망 명부: 이름표(생김새)로, 진짜 이름 없음 ──
    await goto_point(c, 'arrive', "__ds4.scene.map.id === 'station'")
    await c.ev(PASS_BOT, False)
    await c.ev("__ds4.flow(() => __ds4.talkTo('soonrye'))", True)
    await drive_lines(c, 20)
    secret2 = await c.ev(AP_SECRET_JS, False)
    await c.ev(r"""(() => { __ds4.setBot((k, info) => { if (k === 'event') { const i = info.options.findIndex((o) => /오른다/.test(o.label)); return i >= 0 ? i : undefined; } if (k === 'confirm2') return 0; if (k === 'death_ledger') return 'hold'; return undefined; }); return 1; })()""", False)
    await c.ev("__ds4.use('stairs_ash'); 1", False)
    ok = await until(c, "__ds4.UI.openKind() === 'death_ledger'", 40)
    await asyncio.sleep(0.5)
    dl = await c.ev("""(() => { const box = document.getElementById('box'); return { reached: __ds4.UI.openKind(), you: __ds4.state.people.you.status, day: __ds4.state.day,
      head: ((box && box.querySelector('.who')) || {}).textContent || '', rows: [...(box ? box.querySelectorAll('.ledger .row') : [])].map((r) => r.textContent), text: box ? box.textContent : '' }; })()""", False)
    dl['secret'] = secret2
    dl['leaks'] = leak([dl['text']], secret2)
    dl['ok'] = bool(ok)
    res['2_death_ledger_d0'] = dl
    await stage_shot(c, out('screen_apply_02_death_ledger_d0.png'))
    print('2 death ledger', json.dumps(dl, ensure_ascii=False)[:500])
    # ── 7 찾은 물건 아이콘: 표 전체 + 전동차(가방·수첩·구급함·레버) 실제 흐름 ──
    await goto_point(c, 'car')
    res['7_found_table'] = await c.ev(AP_FOUND_TABLE_JS, False)
    FACES = r"""if (k === 'line' && info.opts && /:out$/.test(info.opts.tag || '')) window.__faces.push({ tag: info.opts.tag, face: (info.opts.face || '').split('/').slice(-2).join('/'), cls: info.opts.faceCls || '' });"""
    await c.ev("(() => { window.__faces = []; __ds4.setBot((k, info) => { " + FACES + " return undefined; }); return 1; })()", False)
    for oid in ('bag', 'notebook_dash', 'medkit'):
        await c.ev(f"__ds4.use('{oid}')", True)
        await drive_lines(c, 20)
    await c.ev("(() => { __ds4.setBot((k, info) => { " + FACES + " if (k === 'line' && info.opts && info.opts.tag === 'pro_lever:out') return 'hold'; return undefined; }); return 1; })()", False)
    await c.ev("__ds4.use('lever'); 1", False)
    await until(c, "__ds4.UI.openKind() === 'line' && /icons\\/bottle/.test((document.querySelector('#box img.face') || {}).src || '')", 20)
    await asyncio.sleep(0.4)
    await stage_shot(c, out('screen_apply_07_found_bottle_lever.png'))
    lever_face = await c.ev("(document.querySelector('#box img.face') || {}).src || ''", False)
    res['7_found_flow'] = {'faces': await c.ev('window.__faces', False), 'lever_face': '/'.join(lever_face.split('/')[-2:]), 'foundLog': await c.ev('__ds4.foundLog', False)}
    print('7 found used', res['7_found_table']['used'], 'unused', res['7_found_table']['unused'], '| flow', [x['face'] for x in res['7_found_flow']['faces']], res['7_found_flow']['lever_face'])
    # ── 8 벽걸이 수납: 여는 칸에 선 당신이 가구를 가리나 (닫힘·열림 변화가 보이는 몫) + 캡처 ──
    await c.ev("__ds4.setBot(null); __ds4.UI.key('ok'); 1", False)
    await drive_lines(c, 10)
    res['8_occlusion'] = await c.ev(RC_OCC_JS, False)
    for r in res['8_occlusion']:
        print('8 occ', json.dumps(r, ensure_ascii=False))
    await normal_speed(c)
    await place(c, 19, 2, 'up')
    await asyncio.sleep(0.4)
    await ap_zoom(c, 'screen_apply_08_car_medkit_lever_open_wall.png', 17, 0, 22, 4, 4)
    await goto_point(c, 'tunnel', "__ds4.scene.map.id === 'tunnel'")
    await normal_speed(c)
    await place(c, 14, 1, 'up')
    await asyncio.sleep(0.4)
    await ap_zoom(c, 'screen_apply_08_tunnel_shelter_box_wall.png', 11, 0, 18, 3, 4)
    # 터널 벽감 상자(맨 윗줄이라 덜 올라간 벽걸이): 클릭해 걸어가면 옆 칸에서 위를 보고 조사 → 여는 결과 동안 상자가 몸에 안 가린다
    await place(c, 10, 2, 'right')
    plan = await c.ev("(() => { __ds4.walkTo(14, 0); const a = __ds4.scene.auto; const end = a && a.path.length ? a.path[a.path.length - 1] : [__ds4.scene.px, __ds4.scene.py]; __ds4.scene.auto = null; return { end, face: a ? a.face : null }; })()", False)
    await place(c, plan['end'][0], plan['end'][1], plan['face'] or 'up')
    await asyncio.sleep(0.3)
    side = {'walk_end': plan['end'], 'face': plan['face'], 'target': await c.ev("(() => { const t = __ds4.target(); return t ? t.id + ':' + t.verb + ':' + t.name : null; })()", False),
            'hint': await c.ev("document.getElementById('hint').textContent", False)}
    await ap_zoom(c, 'screen_apply_08_tunnel_shelter_side_closed.png', 11, 0, 18, 3, 4)
    await c.ev("(() => { __ds4.setBot((k, info) => { if (k === 'event') return 0; if (k === 'line' && info.opts && info.opts.tag === 'tunnel_box:out') return 'hold'; return undefined; }); return 1; })()", False)
    await c.ev("__ds4.interact(); 1", False)
    await until(c, "__ds4.UI.openKind() === 'line' && __ds4.state.traces.shelter_box && __ds4.state.traces.shelter_box.st === 'open'", 20)
    await asyncio.sleep(0.5)
    side['opened'] = await c.ev("(__ds4.state.traces.shelter_box || {}).st || ''", False)
    side['crouch'] = await c.ev("!!__ds4.scene.crouch", False)
    await ap_zoom(c, 'screen_apply_08_tunnel_shelter_side_open.png', 11, 0, 18, 3, 4)
    res['8_tunnel_side'] = side
    print('8 tunnel side', side)
    await c.ev("__ds4.setBot(null); 1", False)
    # ── 10·11 저녁 화로 둘레 (D3 저녁): 사람마다 앉기 그림 4방향 · 화로를 본다 / 앉은 사람 바로 위 칸에 선 당신 — 꼬리표 ──
    await goto_point(c, 'eve3', "__ds4.state.day === 3 && __ds4.state.phase === 'evening'")
    await normal_speed(c)
    res['10_pose_art'] = await c.ev(AP_POSE_JS, False)
    await place(c, 13, 13, 'up')
    await asyncio.sleep(0.4)
    res['10_evening_people'] = await c.ev("__ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose, p.face])", False)
    await ap_zoom(c, 'screen_apply_10_evening_sitting.png', 9, 8, 18, 14, 3)
    tagres = {}
    for (x, y) in ((14, 11), (12, 11)):
        await place(c, x, y, 'up')
        await asyncio.sleep(0.35)
        tg = await c.ev(AP_TAGS_JS, False)
        tg['tags_on_you'] = sum(1 for t in tg['tags'] if t['onYou'])
        tagres[f'{x},{y}'] = tg
        await ap_zoom(c, f'screen_apply_11_tags_you_{x}_{y}.png', 9, 8, 18, 14, 3)
    res['11_tags'] = tagres
    print('11 tags', {k: (v['below'], v['tags_on_you']) for k, v in tagres.items()})
    await goto_point(c, 'beds', "__ds4.state.day === 2 && __ds4.state.phase === 'night'")
    await normal_speed(c)
    res['10_night_people'] = await c.ev("__ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose])", False)
    await ap_zoom(c, 'screen_apply_10_night_sleepers.png', 14, 8, 23, 12, 4)
    # 대체: sit·sleep(그리고 다른 새 그림)이 없을 때도 깨지지 않는가
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': NOART_JS}))['identifier']
    try:
        await goto_point(c, 'eve3', "__ds4.state.day === 3 && __ds4.state.phase === 'evening'")
        await normal_speed(c)
        await place(c, 13, 13, 'up')
        await asyncio.sleep(0.4)
        res['10_fallback'] = {'sit_sleep_loaded': await c.ev("Object.keys(ART.IMG).filter((k) => /^v4\\/(sit|sleep)\\//.test(k)).length", False), 'pose': await c.ev(AP_POSE_JS, False), 'errors': c.errors()}
        await ap_zoom(c, 'screen_apply_10_fallback_evening.png', 9, 8, 18, 14, 3)
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    print('10 pose', json.dumps(res['10_pose_art'], ensure_ascii=False)[:300], '| fallback loaded', res['10_fallback']['sit_sleep_loaded'])
    res['console_errors'] = c.errors()
    with open(out('screen_apply.json'), 'w', encoding='utf-8') as fp:
        json.dump(res, fp, ensure_ascii=False, indent=1)
    # ── 5 연타 보호 (Space 연타 · 누른 채 · ↑ 를 누른 채 연타) → screen_space_guard.json (--n=0 이면 건너뛴다) ──
    if opts.get('n', '9') != '0':
        await task_space(c, {'n': opts.get('n', '9')})


# ── spec (2026-10-24 명세 A1·A2·A4 화면 몫): 새 사건이 화면 흐름에서 열리고 닫히는가 · 잠긴 이유 · 쌓이는 신호(등 돌림·호칭·밀린 그릇) · 못 본 밤(먼지·_late 글·토스트) ──
SPEC_PICK = {'crate_lid': 1, 'dawn_strike': 1}       # crate_lid '봉지 하나를 꺼낸다'(금기) · dawn_strike '맞고 버틴다'(늘 열린 몸값)
SPEC_EVENTS = ['dawn_mob', 'd10_hold', 'd10_grab', 'repay_bowl', 'share_back', 'crate_lid', 'd2_shutter_arm', 'd4_spanner', 'called_up', 'dawn_strike']

SP_BOX_JS = r"""(() => { const D = __ds4, box = document.getElementById('box'), st = D.state, v = D.E.eventView(st, D.db);
  const q = (sel) => (box && box.querySelector(sel)) || null;
  return { open: D.UI.openKind(), day: st.day, phase: st.phase, pending: st.pending ? st.pending.id : null, target: st.pending ? st.pending.target || null : null,
    who: (q('.body .who') || q('.lt .who') || {}).textContent || '', face: ((q('img.face') || {}).src || '').split('/').slice(-2).join('/'),
    text: (q('.body') || q('.tw') || {}).textContent || '', toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent,
    opts: [...(box ? box.querySelectorAll('.opt') : [])].map((b) => ({ text: b.textContent, disabled: b.disabled, lock: (b.querySelector('small.lock') || {}).textContent || '' })),
    tight: !!(box && box.classList.contains('tight')), overflow: box ? box.scrollHeight > box.clientHeight + 1 : null, cg: !document.getElementById('cg').hidden,
    choices: v ? v.choices.map((c) => ({ label: c.label, locked: c.locked, reason: c.reason, warn: c.warn, taboo: c.taboo, chance: c.chance })) : [] }; })()"""

# 흐름을 끝까지 보내는 봇: 한 줄은 넘기고, 이어 걸린 사건은 열린 첫 선택(금기·판정이 아닌 것 먼저), 배식은 '배식한다', 끝·타이틀은 그대로 둔다
SP_FLOW_BOT = r"""(() => { window.__seen = []; __ds4.setBot((k, info) => {
  if (k === 'line') { window.__seen.push({ text: info.text, name: info.opts && info.opts.name || '', tag: info.opts && info.opts.tag || '' }); return undefined; }
  if (k === 'event') { const o = info.options; let i = o.findIndex((x) => !x.disabled && !x.warn); if (i < 0) i = o.findIndex((x) => !x.disabled); return i; }
  if (k === 'confirm2') return 0;
  if (k === 'ration' || k === 'board' || k === 'tend' || k === 'treat') return info.options.length - 1;
  if (k === 'trip' || k === 'write' || k === 'deeper' || k === 'fire') return 1;
  if (k === 'title' || k === 'death_ledger' || k === 'ending') return 'hold';
  return undefined; }); return 1; })()"""

SP_STATE_JS = r"""(() => { const s = __ds4.state; const r = s.lastResult || {}; return { day: s.day, phase: s.phase, pending: s.pending ? s.pending.id : null, ended: s.ended ? s.ended.why : null,
  you: s.people.you.status, open: __ds4.UI.openKind(), last: { event: r.event || '', choice: r.choice || '', text: r.text || '' }, seen: (window.__seen || []).map((x) => (x.name ? x.name + ': ' : '') + x.text) }; })()"""

# 신호 꾸미기: 원한(signs.cold 문턱 3 · 호칭 문턱 5) · 못 본 밤 흔적(late, 어제 날짜) · 당신 그릇 pushed. 그다음 hud() 로 view 를 새로 읽는다
SP_SIGNS_JS = r"""((g, traces) => { const D = __ds4, s = D.state;
  for (const [id, v] of Object.entries(g)) if (s.people[id]) s.people[id].n.grudge = v;
  for (const [id, st, late] of traces) if (s.traces[id]) s.traces[id] = { st, day: late ? s.day - 1 : s.day, by: null, seen: false, late: late ? 1 : 0 };
  s.noticeDay = null; D.hud();
  const vp = D.E.view(s, D.db).people.filter((p) => p.status === 'home' && p.id !== 'you').map((p) => ({ id: p.id, cold: !!(p.signs && p.signs.cold), address: p.address }));
  return { view: vp, map: D.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose, p.face, !!p.cold]), late: D.objectsOnMap().filter((o) => o.late).map((o) => o.id) }; })"""


async def sp_shot_events(c, res):
    for ev in SPEC_EVENTS:
        if ev not in FIXTURES:
            res[ev] = {'skip': 'fixture 없음'}
            print('spec', ev, 'fixture 없음')
            continue
        r = {}
        try:
            await c.open(f'/v4/index.html?fast=1&auto=evline&state=/__fixture/{ev}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.openKind() === 'line'", 60)
            await asyncio.sleep(0.35)
            r['line'] = await c.ev(SP_BOX_JS, False)
            await stage_shot(c, out(f'screen_spec_ev_{ev}_line.png'))
            await c.ev("(() => { __ds4.setBot((k) => (k === 'event' ? 'hold' : undefined)); __ds4.UI.key('ok'); return 1; })()", False)
            await c.wait("__ds4.UI.openKind() === 'event'", 30)
            await asyncio.sleep(0.5)
            r['box'] = await c.ev(SP_BOX_JS, False)
            await stage_shot(c, out(f'screen_spec_ev_{ev}.png'))
            ch = r['box']['choices']
            pick = SPEC_PICK.get(ev)                 # 금기 길도 하나는 끝까지 (되돌릴 수 없다 확인창 → 그렇게 한다)
            if pick is None or pick >= len(ch) or ch[pick]['locked']:
                pick = next((i for i, x in enumerate(ch) if not x['locked'] and not x['taboo'] and x['chance'] is None), None)
            if pick is None:
                pick = next((i for i, x in enumerate(ch) if not x['locked']), 0)
            r['picked'] = ch[pick]['label'] if ch else None
            await c.ev(SP_FLOW_BOT, False)
            await c.ev(f"__ds4.UI.pick({pick}); 1", False)
            await until(c, "(__ds4.state.ended || !__ds4.state.pending) && !__ds4.UI.isOpen() && !__ds4.scene.auto || ['title', 'death_ledger', 'ending'].includes(__ds4.UI.openKind())", 40)
            await asyncio.sleep(0.4)
            r['after'] = await c.ev(SP_STATE_JS, False)
        except BaseException as e:            # SystemExit(기다리다 지침)도 기록만 하고 다음 사건으로
            r['error'] = str(e)[:300]
        r['console_errors'] = c.errors()
        res[ev] = r
        b = r.get('box') or {}
        print('spec', ev, '| who', (r.get('line') or {}).get('who'), (r.get('line') or {}).get('face'), '| opts', len(b.get('opts') or []), 'overflow', b.get('overflow'),
              '| locks', [o['lock'] for o in (b.get('opts') or []) if o['lock']], '| picked', r.get('picked'), '| after', (r.get('after') or {}).get('phase'), (r.get('after') or {}).get('pending'),
              (r.get('after') or {}).get('ended'), '| err', r.get('error'), r['console_errors'])


async def task_spec(c, opts):
    res = {}
    # ── 1 새 사건 10개: 저장(시뮬 봇이 그 사건이 걸린 순간)에서 시작 → 첫 줄(누가 하는 사건은 얼굴·이름표) → 선택 창 → 하나 골라 흐름 끝까지 ──
    await sp_shot_events(c, res)
    # ── 2 잠긴 이유: 대상이 없는 사건(targetOptional)의 '댈 이름이 없다' · 손가락을 잃은 뒤 '손가락이 성치 않다'(조사) ──
    for name, ev in (('called_up_notarget', 'called_up'), ('dawn_mob_notarget_finger', 'dawn_mob')):
        if ev not in FIXTURES:
            continue
        r = {}
        try:
            await c.open(f'/v4/index.html?fast=1&auto=evhold&state=/__fixture/{name}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.openKind() === 'event'", 60)
            await asyncio.sleep(0.5)
            r = await c.ev(SP_BOX_JS, False)
            await stage_shot(c, out(f'screen_spec_lock_{name}.png'))
        except BaseException as e:
            r = {'error': str(e)[:300]}
        r['console_errors'] = c.errors()
        res['lock_' + name] = r
        print('spec lock', name, [(o['text'][:30], o['lock']) for o in r.get('opts', []) if o['disabled']], r.get('error'))
    # ── 3 아침(D3 흔적): 등 돌림·밀린 그릇·못 본 밤 먼지 → 조사(_late 글 + 토스트) → 말 걸기(호칭) ──
    await goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    await normal_speed(c)
    await c.ev(PASS_BOT, False)
    await place(c, 17, 12, 'up')
    await asyncio.sleep(0.4)
    res['3_before'] = await c.ev("__ds4.peopleOnMap().map((p) => [p.id, p.x, p.y, p.pose, p.face, !!p.cold])", False)
    await ap_zoom(c, 'screen_spec_signs_morning_before.png', 10, 8, 25, 13, 3)
    G = {'gicheol': 6, 'eunji': 3, 'mari': 6, 'soonrye': 0, 'seoha': 0, 'dongha': 0}
    TR = [['bowl_eunji', 'empty', 1], ['blanket_gicheol', 'rolled', 1], ['bottle_soonrye', 'empty', 1], ['crate_food', 'open', 1], ['bowl_you', 'pushed', 0]]
    res['3_signs'] = await c.ev(SP_SIGNS_JS + f'({json.dumps(G)}, {json.dumps(TR)})', False)
    await asyncio.sleep(0.5)
    await ap_zoom(c, 'screen_spec_signs_morning_after.png', 10, 8, 25, 13, 3)
    await place(c, 12, 12, 'up')
    await asyncio.sleep(0.5)
    await ap_zoom(c, 'screen_spec_late_dust_bowls.png', 9, 8, 16, 12, 5)
    await app_shot(c, out('screen_spec_signs_morning_app.png'))
    print('spec 3 signs', json.dumps(res['3_signs'], ensure_ascii=False)[:600])
    # 조사: 늦은 그릇(은지) — 첫 조사 = 토스트 + _late 글. 그 줄에서 멈춰 찍는다
    LATE_HOLD = r"""(() => { window.__seen = []; __ds4.setBot((k, info) => {
      if (k === 'line') { window.__seen.push({ text: info.text, name: info.opts && info.opts.name || '' }); if (!window.__held) { window.__held = 1; return 'hold'; } return undefined; }
      if (k === 'tend') { const i = info.options.findIndex((o) => o.label === '말을 건다'); return i >= 0 ? i : info.options.length - 1; }
      if (k === 'write') return 1; return undefined; }); window.__held = 0; return 1; })()"""
    await c.ev(LATE_HOLD, False)
    await c.ev("__ds4.use('bowl_eunji'); 1", False)
    await until(c, "window.__held === 1 && __ds4.UI.openKind() === 'line'", 20)
    await asyncio.sleep(0.3)
    res['3_late_inspect'] = await c.ev(SP_BOX_JS, False)
    await stage_shot(c, out('screen_spec_late_inspect_toast.png'))
    await c.ev(PASS_BOT + "; __ds4.UI.key('ok'); 1", False)
    await drive_lines(c, 20)
    insp = {}
    for oid in ('bowl_you', 'blanket_gicheol', 'bottle_soonrye'):
        insp[oid] = await ap_inspect(c, oid)
    res['3_inspect_texts'] = insp
    res['3_inspect_log'] = await c.ev('__ds4.inspectLog', False)
    print('spec 3 late', res['3_late_inspect'].get('text'), '| toast', res['3_late_inspect'].get('toast'), '|', json.dumps(insp, ensure_ascii=False))
    # 말 걸기: 호칭 (원한 6 기철 '어이' · 원한 6 마리 '' 부르지 않음 · 원한 3 은지 기본 · 순례 기본). 기철은 그날 첫 말에서 멈춰 찍는다
    await c.ev(r"""(() => { window.__seen = []; __ds4.setBot((k, info) => { if (k === 'line') { window.__seen.push({ text: info.text, name: info.opts && info.opts.name || '' }); return window.__seen.length === 1 ? 'hold' : undefined; }
      if (k === 'tend') { const i = info.options.findIndex((o) => o.label === '말을 건다'); return i >= 0 ? i : info.options.length - 1; } return undefined; }); return 1; })()""", False)
    await c.ev("__ds4.flow(() => __ds4.talkTo('gicheol')); 1", False)
    await until(c, "__ds4.UI.openKind() === 'line'", 10)
    await asyncio.sleep(0.3)
    res['3_talk_box'] = await c.ev(SP_BOX_JS, False)
    await stage_shot(c, out('screen_spec_address_cold.png'))
    talks = {'gicheol': {'call': await c.ev("__ds4.callOf('gicheol')", False), 'seen': await c.ev('window.__seen', False)}}
    await c.ev(PASS_BOT + "; __ds4.UI.key('ok'); 1", False)
    await drive_lines(c, 20)
    for who in ('mari', 'eunji', 'soonrye', 'seoha', 'dongha'):
        await c.ev("window.__seen = []; 1", False)
        await c.ev(f"__ds4.flow(() => __ds4.talkTo('{who}'))", True)
        await drive_lines(c, 20)
        talks[who] = {'call': await c.ev(f"__ds4.callOf('{who}')", False), 'seen': await c.ev('window.__seen', False)}
    res['3_talk'] = talks
    res['3_talk_log'] = await c.ev('__ds4.talkLog.slice(-8)', False)
    print('spec 3 talk', json.dumps({k: (v['call'], [x['text'] for x in v['seen']][:1]) for k, v in talks.items()}, ensure_ascii=False))
    # 엔진 줄 셈: 방치 판정 줄은 '밤에 무슨 소리' 에서 빠진다
    res['3_noise_rule'] = await c.ev("({ neglect: __ds4.E.night.isResidentRow({ role: 'neglect' }), clock: __ds4.E.night.isResidentRow({ role: 'clock' }), steal: __ds4.E.night.isResidentRow({ role: 'steal' }) })", False)
    res['3_reason_josa'] = await c.ev("[__ds4.reasonKo('손가락가 성치 않다'), __ds4.reasonKo('다리가 성치 않다'), __ds4.reasonKo('귀가 성치 않다'), __ds4.reasonKo('meds이(가) 모자라다')]", False)
    print('spec 3 noise', res['3_noise_rule'], '| josa', res['3_reason_josa'])
    # ── 4 저녁(D3): 화로 둘레에 앉은 사람 — 등 돌림(고개 숙임) ──
    await goto_point(c, 'eve3', "__ds4.state.day === 3 && __ds4.state.phase === 'evening'")
    await normal_speed(c)
    await place(c, 13, 13, 'up')
    await asyncio.sleep(0.4)
    await ap_zoom(c, 'screen_spec_signs_evening_before.png', 9, 8, 18, 14, 3)
    res['4_evening'] = await c.ev(SP_SIGNS_JS + f"({json.dumps({'gicheol': 6, 'eunji': 3, 'soonrye': 4})}, [])", False)
    await asyncio.sleep(0.5)
    await ap_zoom(c, 'screen_spec_signs_evening_after.png', 9, 8, 18, 14, 3)
    print('spec 4 evening', res['4_evening']['map'])
    # ── 5 밤(D2): 잠자리 — 등지고 누움(뒤통수) ──
    await goto_point(c, 'beds', "__ds4.state.day === 2 && __ds4.state.phase === 'night'")
    await normal_speed(c)
    await ap_zoom(c, 'screen_spec_signs_night_before.png', 14, 8, 23, 12, 4)
    res['5_night'] = await c.ev(SP_SIGNS_JS + f"({json.dumps({'soonrye': 5, 'gicheol': 4, 'mari': 3, 'eunji': 3, 'dongha': 3, 'seoha': 3})}, [])", False)
    await asyncio.sleep(0.5)
    await ap_zoom(c, 'screen_spec_signs_night_after.png', 14, 8, 23, 12, 4)
    print('spec 5 night', res['5_night']['map'])
    # ── 6 그림이 없을 때(새 그림 숨김): 등 돌림·잠·먼지가 깨지지 않는가 ──
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': NOART_JS}))['identifier']
    try:
        await goto_point(c, 'beds', "__ds4.state.day === 2 && __ds4.state.phase === 'night'")
        await normal_speed(c)
        res['6_noart_night'] = await c.ev(SP_SIGNS_JS + f"({json.dumps({'soonrye': 5, 'gicheol': 4, 'mari': 3})}, [['bowl_you', 'pushed', 0], ['blanket_gicheol', 'rolled', 1]])", False)
        await asyncio.sleep(0.5)
        await ap_zoom(c, 'screen_spec_noart_night.png', 9, 8, 23, 12, 3)
        res['6_noart_errors'] = c.errors()
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    print('spec 6 noart errors', res['6_noart_errors'])
    # ── 7 표 행이 빠지면 화면에 보인다 (events.json 에 틀린 행 하나를 끼워 넣는다) ──
    BAD = r"""(() => { const of = window.fetch.bind(window); window.fetch = (u, o) => of(u, o).then((r) => {
      if (!/data\/events\.json/.test(String(u))) return r;
      return r.json().then((list) => new Response(JSON.stringify(list.concat([{ id: 'zz_bad_row', kind: 'trial', when: 'day==99', text: 'x', choices: [] }])), { headers: { 'Content-Type': 'application/json' } })); }); })();"""
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': BAD}))['identifier']
    try:
        await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
        await c.wait('__ds4.state && __ds4.scene.map', 60)
        await asyncio.sleep(0.3)
        res['7_dropped'] = {'dropped': await c.ev('DS4.browser.dropped', False), 'toast': await c.ev("document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent", False),
                            'console': [x[:160] for x in c.console if '표 검증' in x]}
        await app_shot(c, out('screen_spec_dropped_toast.png'))
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    print('spec 7 dropped', json.dumps(res['7_dropped'], ensure_ascii=False)[:300])
    with open(out('screen_spec.json'), 'w', encoding='utf-8') as fp:
        json.dump(res, fp, ensure_ascii=False, indent=1)


# ── rope (2026-10-24 줄타기 · 게으름 처벌 화면 몫, tightrope/design.md §1·§2): 카르마 구간마다 바뀐 선택지의 %·경고·비용이 보이는가 ·
#    살 확률이 내려가는 것이 숫자 없이(위험 단계 색 · 상자 심장 박동) 느껴지는가 · 죽을 뻔한 판정을 넘긴 줄 · 실패 글과 사망 화면 ·
#    눈먼 새벽 한 줄 · 못 본 도둑이 당신 그릇·붕대에 온 아침 '밤 보고' 줄과 조사 글. 결과 screen_rope_*.png · screen_rope.json (--out 폴더)
ROPE_EVENTS = ['dawn_strike', 'dawn_mob', 'called_up', 'd10_hold', 'starve_you', 'd2_shutter_arm', 'night:steal_food_again', 'night:steal_meds_again']
# (이름, 사건, 카르마, 눈먼 새벽) — 저장(시뮬 봇이 그 사건이 걸린 순간)의 카르마·깃발만 바꾼다. 습격은 그릇 둘이 열리게 식량 3
ROPE_WINDOWS = [('dawn_k0', 'dawn_strike', 0, False), ('dawn_k5', 'dawn_strike', 5, False), ('dawn_k12', 'dawn_strike', 12, False), ('dawn_k16', 'dawn_strike', 16, False),
                ('dawn_blind', 'dawn_strike', 0, True), ('mob_k8', 'dawn_mob', 8, False), ('called_k12', 'called_up', 12, False), ('hold_k16', 'd10_hold', 16, False),
                ('starve_k8', 'starve_you', 8, False), ('arm_k12', 'd2_shutter_arm', 12, False)]
# (이름, 창 저장, 고를 선택 label, 판정 난수 강제값) — 0.01 = 넘김 · 0.995 = 실패
ROPE_ROLLS = [('ok', 'dawn_k12', '맞고 버틴다', 0.01), ('fail', 'dawn_k12', '그릇 둘을 내민다', 0.995), ('starve_fail', 'starve_k8', '남의 그릇을 뺏는다', 0.995),
              ('blind_ok', 'dawn_blind', '옆 담요를 가리킨다', 0.01)]

ROPE_BOX_JS = r"""(() => { const D = __ds4, box = document.getElementById('box'), st = D.state, db = D.db, v = D.E.eventView(st, db);
  const cs = box ? getComputedStyle(box) : null, ev = v ? db.events[v.id] : null;
  const opts = [...(box ? box.querySelectorAll('.opt') : [])].map((b) => { const w = b.querySelector('small.warn'), ch = b.querySelector('small.chance');
    return { text: b.textContent, disabled: b.disabled, r: (w && w.dataset.r) || (ch && ch.dataset.r) || '', warn: w ? w.textContent : '', warnColor: w ? getComputedStyle(w).color : '',
      chance: ch ? ch.textContent : '', chanceColor: ch ? getComputedStyle(ch).color : '', cost: (b.querySelector('small.cost') || {}).textContent || '',
      cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 }; });
  const all = [(box.querySelector('.body') || {}).textContent || ''].concat([...box.querySelectorAll('.opt .ol')].map((x) => x.textContent)).join(' ');   // 선택지 번호(1~9)는 빼고 본다
  const leak = all.replace(/\d+%/g, '').replace(/−\d+/g, '').match(/\d+/g);   // % 와 비용(−2) 밖의 숫자 = 새는 수치 (카르마·원한 등)
  return { open: D.UI.openKind(), day: st.day, phase: st.phase, karma: st.world.karma, blindFlag: !!st.flags.strike_blind, pending: st.pending ? st.pending.id : null,
    cls: box ? box.className : '', anim: cs ? cs.animationName + ' ' + cs.animationDuration : '', body: (box.querySelector('.body') || {}).textContent || '',
    blind: (box.querySelector('.body .blind') || {}).textContent || '', tight: box.classList.contains('tight'), overflow: box.scrollHeight > box.clientHeight + 1, opts, leak,
    engine: v ? v.choices.map((c, i) => ({ label: c.label, chance: c.chance, warn: c.warn, locked: c.locked, p: D.E.survival(D.E.effChoice(st, db, ev.choices[i]), c.chance) })) : [] }; })()"""

# 판정 흐름 봇: 줄은 모으고, 판정 줄('roll')·결과 글(':out')·사망 한 줄('death')·사망 명부 창에서 한 번씩 멈춘다(window.__hold = 멈춘 곳)
ROPE_ROLL_BOT = r"""(() => { window.__seen = []; window.__hold = ''; window.__held = {}; __ds4.setBot((k, info) => {
  const tag = (info.opts && info.opts.tag) || '';
  if (k === 'line') { window.__seen.push({ text: info.text, tag, cls: (document.getElementById('box') || {}).className || '' });
    const h = tag === 'roll' ? 'roll' : /:out$/.test(tag) ? 'out' : tag === 'death' ? 'death' : '';
    if (h && !window.__held[h]) { window.__held[h] = 1; window.__hold = h; return 'hold'; } return undefined; }
  if (k === 'confirm2') return 0;
  if (k === 'death_ledger' || k === 'ending' || k === 'title') { window.__hold = k; return 'hold'; }
  if (k === 'event') { const o = info.options; let i = o.findIndex((x) => !x.disabled && !x.warn); if (i < 0) i = o.findIndex((x) => !x.disabled); return i; }
  if (k === 'ration' || k === 'board' || k === 'tend' || k === 'treat') return info.options.length - 1;
  if (k === 'trip' || k === 'write' || k === 'deeper' || k === 'fire') return 1;
  return undefined; }); return 1; })()"""
# 판정 난수를 한 번만 정한다 (엔진 choose 는 판정에 R.rand 를 한 번 쓴다 — 화면 파일은 안 고치고 페이지 안에서만 감싼다)
ROPE_FORCE_JS = r"""((v) => { const R = DS4.rng; if (!R.__orig) { R.__orig = R.rand; R.rand = (s) => { const x = R.__orig(s); if (window.__force != null) { const f = window.__force; window.__force = null; return f; } return x; }; } window.__force = v; return 1; })"""
# 아침 밤 보고: 못 본 일 줄('night_unseen')에서 멈춘다. 그 밖의 창은 흐름을 이어 간다
ROPE_NIGHT_BOT = r"""(() => { window.__seen = []; window.__hold = ''; __ds4.setBot((k, info) => {
  const tag = (info.opts && info.opts.tag) || '';
  if (k === 'line') { window.__seen.push({ text: info.text, tag }); if (tag === 'night_unseen' && window.__hold !== 'unseen') { window.__hold = 'unseen'; return 'hold'; } return undefined; }
  if (k === 'event') { const o = info.options; let i = o.findIndex((x) => !x.disabled && !x.warn); if (i < 0) i = o.findIndex((x) => !x.disabled); return i; }
  if (k === 'confirm2') return 0;
  if (k === 'ration' || k === 'board' || k === 'tend' || k === 'treat') return info.options.length - 1;
  if (k === 'trip' || k === 'write' || k === 'deeper' || k === 'fire') return 1;
  if (k === 'title' || k === 'death_ledger' || k === 'ending') return 'hold';
  return undefined; }); return 1; })()"""


async def rope_window(c, name):
    await c.open(f'/v4/index.html?fast=1&auto=evhold&state=/__fixture/rope_{name}.json&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.UI.openKind() === 'event'", 60)
    await asyncio.sleep(0.6)


async def task_rope(c, opts):
    res = {'windows': {}, 'rolls': {}, 'night': {}}
    # ── 1 선택 창: 카르마 구간마다 (지금 → K1 → K3 → K4 · 눈먼 새벽 · 긴 경고 · 남을 내미는 길) ──
    for name, ev, k, blind in ROPE_WINDOWS:
        if 'rope_' + name not in FIXTURES:
            res['windows'][name] = {'skip': 'fixture 없음'}
            print('rope', name, 'fixture 없음')
            continue
        r = {}
        try:
            await rope_window(c, name)
            r = await c.ev(ROPE_BOX_JS, False)
            await stage_shot(c, out(f'screen_rope_{name}.png'))
        except BaseException as e:
            r = {'error': str(e)[:300]}
        r['console_errors'] = c.errors()
        res['windows'][name] = r
        print('rope', name, 'K', r.get('karma'), '| cls', r.get('cls'), '| anim', r.get('anim'), '| tight', r.get('tight'), 'overflow', r.get('overflow'), '| leak', r.get('leak'),
              '| blind', r.get('blind'), '|', [(o['text'][:44], o['r']) for o in r.get('opts', [])], r.get('error') or '', r['console_errors'])
    # ── 2 판정: 죽을 뻔한 판정을 넘김('살았다' + 상자 한 번 뜀) · 실패 → 실패 글 → 사망 화면 ──
    for name, win, label, force in ROPE_ROLLS:
        if 'rope_' + win not in FIXTURES:
            res['rolls'][name] = {'skip': 'fixture 없음'}
            continue
        r = {'window': win, 'pick': label, 'force': force, 'holds': {}}
        try:
            await rope_window(c, win)
            ch = await c.ev("__ds4.E.eventView(__ds4.state, __ds4.db).choices.map((c) => ({ label: c.label, locked: c.locked, chance: c.chance }))", False)
            i = next((k for k, x in enumerate(ch) if x['label'] == label and not x['locked']), None)
            if i is None:
                raise RuntimeError('고를 선택이 없다: ' + label + ' / ' + json.dumps(ch, ensure_ascii=False)[:200])
            r['chance'] = ch[i]['chance']
            await c.ev(ROPE_ROLL_BOT, False)
            await c.ev(ROPE_FORCE_JS + f'({force})', False)
            await c.ev(f"__ds4.UI.pick({i}); 1", False)
            for _ in range(4):
                if not await until(c, "window.__hold !== ''", 25):
                    break
                h = await c.ev("window.__hold", False)
                await asyncio.sleep(0.25)
                info = await c.ev("(() => { const b = document.getElementById('box'); const cg = document.getElementById('cg'); return { cls: b.className, text: (b.querySelector('.tw') || b.querySelector('.body') || b).textContent, anim: getComputedStyle(b).animationName, cg: cg.hidden ? '' : ((cg.querySelector('img') || {}).src || '').split('/').slice(-2).join('/') }; })()", False)
                r['holds'][h] = info
                await stage_shot(c, out(f'screen_rope_roll_{name}_{h}.png'))
                if h in ('death_ledger', 'ending', 'title'):
                    break
                await c.ev("window.__hold = ''; __ds4.UI.key('ok'); 1", False)
            r['last'] = await c.ev("(() => { const s = __ds4.state, x = s.lastResult || {}; return { roll: x.roll || null, roped: x.roped || null, blind: !!x.blind, p: x.p, you: s.people.you.status, ended: s.ended ? s.ended.why : null,"
                                   " cause: s.ended && s.ended.cause ? { event: s.ended.cause.event, warned: s.ended.cause.warned, forced: s.ended.cause.forced, roped: s.ended.cause.roped, image: s.ended.cause.image } : null }; })()", False)
            r['seen'] = await c.ev("window.__seen", False)
        except BaseException as e:
            r['error'] = str(e)[:300]
        r['console_errors'] = c.errors()
        res['rolls'][name] = r
        print('rope roll', name, label, r.get('chance'), '| holds', {k: (v['text'][:40], v['anim'], v['cg']) for k, v in r['holds'].items()}, '| last', json.dumps(r.get('last'), ensure_ascii=False)[:200], r.get('error') or '', r['console_errors'])
    # ── 3 못 본 도둑이 당신에게 온 아침: 밤 보고의 '못 본' 줄 → 흔적 단계에서 당신 그릇·붕대 조사 · 당신 몸(부상) ──
    for name, oid in (('unseen_food', 'bowl_you'), ('unseen_meds', 'bandage_you')):
        if 'rope_' + name not in FIXTURES:
            res['night'][name] = {'skip': 'fixture 없음'}
            print('rope night', name, 'fixture 없음')
            continue
        r = {}
        try:
            await c.open(f'/v4/index.html?fast=1&auto=manual&state=/__fixture/rope_{name}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.isOpen()", 60)
            r['before'] = await c.ev("(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, you: Object.assign({}, s.people.you.n), food: s.world.food, meds: s.world.meds }; })()", False)
            await c.ev(ROPE_NIGHT_BOT, False)
            await c.ev("__ds4.UI.key('ok'); 1", False)
            r['held'] = await until(c, "window.__hold === 'unseen'", 40)
            await asyncio.sleep(0.3)
            r['line'] = await c.ev("(document.getElementById('box').querySelector('.tw') || {}).textContent || ''", False)
            await app_shot(c, out(f'screen_rope_{name}_report.png'))
            await c.ev("__ds4.UI.key('ok'); 1", False)               # 같은 봇이 흐름을 잇는다 (못 본 줄에서는 한 번만 멈춘다)
            await until(c, "__ds4.state.phase === 'trace' && !__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving && !__ds4.state.pending", 40)
            r['report'] = [x['text'] for x in (await c.ev("window.__seen", False) or [])]
            r['after'] = await c.ev("(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, you: Object.assign({}, s.people.you.n), food: s.world.food, meds: s.world.meds, trace: s.traces['" + oid + "'] }; })()", False)
            r['map_you'] = await c.ev("(() => { const s = __ds4.scene; return [s.px, s.py]; })()", False)
            px, py = r['map_you']
            await ap_zoom(c, f'screen_rope_{name}_you.png', max(0, px - 4), max(0, py - 3), px + 5, py + 2, 3)
            r['inspect'] = await ap_inspect(c, oid)
            r['toast'] = await c.ev("document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent", False)
            await stage_shot(c, out(f'screen_rope_{name}_inspect.png'))
        except BaseException as e:
            r['error'] = str(e)[:300]
        r['console_errors'] = c.errors()
        res['night'][name] = r
        print('rope night', name, '| held', r.get('held'), '|', r.get('line'), '| report', r.get('report'), '| inspect', r.get('inspect'), '| you', (r.get('before') or {}).get('you', {}).get('hunger'), '→', (r.get('after') or {}).get('you', {}).get('hunger'),
              'inj', (r.get('before') or {}).get('you', {}).get('injury'), '→', (r.get('after') or {}).get('you', {}).get('injury'), r.get('error') or '', r['console_errors'])
    with open(out('screen_rope.json'), 'w', encoding='utf-8') as fp:
        json.dump(res, fp, ensure_ascii=False, indent=1)


def rope_variants():
    """줄타기 창 저장: 사건이 걸린 순간의 저장에서 카르마·눈먼 새벽 깃발만 바꾼다 · 밤 저장(night:<행>)은 rope_unseen_* 이름으로."""
    import copy
    for name, ev, k, blind in ROPE_WINDOWS:
        if ev not in FIXTURES:
            continue
        s = copy.deepcopy(FIXTURES[ev])
        s['world']['karma'] = k
        if ev == 'dawn_strike':
            s['world']['food'] = max(3, s['world'].get('food', 0))
        if blind:
            s['flags']['strike_blind'] = True
        else:
            s['flags'].pop('strike_blind', None)
        FIXTURES['rope_' + name] = s
    for key, name in (('night:steal_food_again', 'unseen_food'), ('night:steal_meds_again', 'unseen_meds')):
        if key in FIXTURES:
            FIXTURES['rope_' + name] = FIXTURES[key]


def spec_variants():
    """저장 변형: 대상이 없는 사건(잠긴 이유 '댈 이름이 없다') · 손가락을 잃은 당신(잠긴 이유 '손가락이 성치 않다')."""
    import copy
    if 'called_up' in FIXTURES:
        s = copy.deepcopy(FIXTURES['called_up'])
        s['pending'].pop('target', None)
        FIXTURES['called_up_notarget'] = s
    if 'dawn_mob' in FIXTURES:
        s = copy.deepcopy(FIXTURES['dawn_mob'])
        s['pending'].pop('target', None)
        s['people']['you']['permanent'] = dict(s['people']['you'].get('permanent') or {}, finger=max(1, s.get('day', 1)))
        s['flags']['you_finger'] = True
        FIXTURES['dawn_mob_notarget_finger'] = s


def load_fixtures(ids):
    # (2026-10-24 검증 #8) 컴퓨터가 바쁘면 fixture.js 가 시간 제한에 걸려 TimeoutExpired 로 도구 전체가 죽고 결과 json 도 안 남았다
    #   → fixture.js 는 FIXTURE_SEC 초에 찾은 만큼으로 멈추고, 그래도 넘으면 저장 없이 간다(그 사건 검사는 'fixture 없음'으로 결과에 남는다)
    try:
        r = subprocess.run(['node', os.path.join(ROOT, 'v4', 'tools', 'fixture.js'), ','.join(ids), '300', str(FIXTURE_SEC)], capture_output=True, timeout=FIXTURE_TIMEOUT, cwd=ROOT)
    except subprocess.TimeoutExpired:
        print(f'fixture 시간 초과 ({FIXTURE_TIMEOUT}초) - 저장 없이 간다:', ','.join(ids))
        return
    try:
        FIXTURES.update(json.loads(r.stdout.decode('utf-8') or '{}'))
    except ValueError:
        print('fixture 실패', r.stderr.decode('utf-8', 'replace')[:400])
    note = r.stderr.decode('utf-8', 'replace').strip().splitlines()
    print('fixture', {k: k in FIXTURES for k in ids}, note[-1][:160] if note else '')


async def amain(tasks, opts):
    if 'space' in tasks or 'dialog' in tasks or 'recheck' in tasks or ('apply' in tasks and opts.get('n', '9') != '0'):   # apply --n=0 = 연타 검사를 건너뛴다
        load_fixtures(SPACE_EVENTS)
    if 'spec' in tasks:
        load_fixtures(SPEC_EVENTS)
        spec_variants()
    if 'rope' in tasks:
        load_fixtures(ROPE_EVENTS)
        rope_variants()
    httpd = serve()
    prof = os.path.join(OUTD, '.profile')            # 헤드리스 프로필 = 결과 폴더 아래 (.profile 은 git 제외 · 끝나면 지운다) — 프로젝트 밖에 만들지 않는다
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            for t in tasks:
                fn = globals().get('task_' + t)
                if not fn:
                    print('모르는 일:', t)
                    continue
                await fn(c, opts.get('tag', 'after')) if t == 'timing' else await fn(c, opts)
    finally:
        proc.terminate()
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if opts.get('out'):                                  # --out=<폴더> : 결과(캡처·json)와 헤드리스 프로필을 그 폴더에 (프로젝트 기준 상대 경로)
        global OUTD
        OUTD = opts['out'] if os.path.isabs(opts['out']) else os.path.join(ROOT, opts['out'])
    tasks = args or ['timing', 'walk', 'heads', 'stills', 'dialog', 'screens', 'space', 'fallback', 'meet', 'props']
    asyncio.run(amain(tasks, opts))


if __name__ == '__main__':
    main()
