# 어두운 역 v4 — 검수용 조종기 (2026-10-24 회의 검수 전용, 게임 코드와 무관).
# 로컬 서버(8771) + 헤드리스 Chrome(원격 디버깅 9333)을 띄우고, 제어용 http(8772)를 연다.
# 쓰기 (C:\dev\dark_station 에서, 백그라운드로):  python v4/tools/audit_driver.py
#   curl -s localhost:18772/nav?url=/v4/index.html           페이지 열기
#   curl -s --data-binary @x.js localhost:18772/eval          JS 실행(마지막 식의 값, await 가능)
#   curl -s "localhost:18772/shot?name=a01"                    audit_shots/a01.png 로 화면 캡처
#   curl -s "localhost:18772/key?k=ArrowRight&t=down"          키 누르기(down/up/press)
#   curl -s localhost:18772/console                            모인 콘솔 줄
#   curl -s localhost:18772/quit
import os, sys, json, base64, asyncio, threading, subprocess, time, functools, shutil, socketserver, http.server, urllib.request, urllib.parse
import websockets

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'audit_shots')
PROF = os.path.join(os.environ.get('TEMP', ROOT), 'ds4_audit_play_profile')
SITE, DBG, CTL = 18771, 19433, 18772           # 다른 검수 에이전트(9333 등)와 겹치지 않게 드문 번호
KEYS = {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, ' ': 32, 'Enter': 13, 'Escape': 27, 'Tab': 9, 'Shift': 16,
        'h': 72, 'f': 70, 'z': 90, 'x': 88, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, 'w': 87, 'a': 65, 's': 83, 'd': 68}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def find_browser():
    for c in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
        if os.path.exists(c):
            return c
    return shutil.which('chrome') or shutil.which('msedge')


class CDP:
    def __init__(self):
        self.ws = None
        self.n = 0
        self.wait = {}
        self.console = []
        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True).start()

    def run(self, coro, timeout=120):
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    async def connect(self, url):
        self.ws = await websockets.connect(url, max_size=64 * 1024 * 1024)
        asyncio.ensure_future(self.reader())
        await self.send('Runtime.enable')
        await self.send('Page.enable')
        await self.send('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 720, 'deviceScaleFactor': 1, 'mobile': False})

    async def reader(self):
        async for msg in self.ws:
            m = json.loads(msg)
            if 'id' in m and m['id'] in self.wait:
                self.wait.pop(m['id']).set_result(m)
            elif m.get('method') == 'Runtime.consoleAPICalled':
                p = m['params']
                self.console.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args']))
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                self.console.append('EXCEPTION: ' + str(d.get('exception', {}).get('description', d.get('text'))))

    async def send(self, method, params=None):
        self.n += 1
        i = self.n
        fut = self.loop.create_future()
        self.wait[i] = fut
        await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
        return await asyncio.wait_for(fut, 110)


def main():
    os.makedirs(OUT, exist_ok=True)
    try:                                         # 이미 누가 그 디버깅 번호를 쓰면 남의 브라우저에 붙지 않게 멈춘다
        urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json', timeout=1)
        raise SystemExit(f'port {DBG} already in use — stop')
    except OSError:
        pass
    socketserver.TCPServer.allow_reuse_address = True
    site = socketserver.ThreadingTCPServer(('127.0.0.1', SITE), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=site.serve_forever, daemon=True).start()
    br = subprocess.Popen([find_browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                           f'--user-data-dir={PROF}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws = None
    for _ in range(60):
        try:
            tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json').read())
            ws = next(t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page')
            break
        except Exception:
            time.sleep(0.5)
    cdp = CDP()
    cdp.run(cdp.connect(ws))

    class Ctl(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def reply(self, obj, code=200):
            b = json.dumps(obj, ensure_ascii=False).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def handle_cmd(self, body):
            u = urllib.parse.urlparse(self.path)
            q = dict(urllib.parse.parse_qsl(u.query))
            p = u.path
            if p == '/nav':
                cdp.console.clear()
                r = cdp.run(cdp.send('Page.navigate', {'url': f'http://127.0.0.1:{SITE}' + q['url']}))
                return {'ok': True, 'r': r.get('result')}
            if p == '/eval':
                js = body.decode('utf-8') if body else q.get('js', '')
                r = cdp.run(cdp.send('Runtime.evaluate', {'expression': js, 'awaitPromise': True, 'returnByValue': True, 'replMode': True}), timeout=115)
                res = r.get('result', {})
                if 'exceptionDetails' in res:
                    return {'error': res['exceptionDetails'].get('exception', {}).get('description', str(res['exceptionDetails']))}
                return {'value': res.get('result', {}).get('value')}
            if p == '/shot':
                r = cdp.run(cdp.send('Page.captureScreenshot', {'format': 'png'}))
                path = os.path.join(OUT, q.get('name', 'shot') + '.png')
                with open(path, 'wb') as f:
                    f.write(base64.b64decode(r['result']['data']))
                return {'ok': True, 'path': path}
            if p == '/key':
                k = q['k']
                vk = KEYS.get(k, ord(k.upper()[0]) if len(k) == 1 else 0)
                types = ['keyDown', 'keyUp'] if q.get('t', 'press') == 'press' else (['keyDown'] if q['t'] == 'down' else ['keyUp'])
                for t in types:
                    cdp.run(cdp.send('Input.dispatchKeyEvent', {'type': t, 'key': k, 'code': k, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk}))
                return {'ok': True}
            if p == '/inject':                   # 다음에 여는 페이지마다 먼저 도는 검수용 스크립트(본문 = JS)
                r = cdp.run(cdp.send('Page.addScriptToEvaluateOnNewDocument', {'source': body.decode('utf-8')}))
                return {'ok': True, 'r': r.get('result')}
            if p == '/console':
                return {'lines': cdp.console[-int(q.get('n', 80)):]}
            if p == '/quit':
                threading.Thread(target=lambda: (time.sleep(0.3), br.kill(), os._exit(0)), daemon=True).start()
                return {'ok': True}
            return {'error': 'unknown'}

        def do_GET(self):
            try:
                self.reply(self.handle_cmd(b''))
            except Exception as e:
                self.reply({'error': repr(e)}, 500)

        def do_POST(self):
            try:
                n = int(self.headers.get('Content-Length') or 0)
                self.reply(self.handle_cmd(self.rfile.read(n)))
            except Exception as e:
                self.reply({'error': repr(e)}, 500)

    print('audit driver ready', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', CTL), Ctl).serve_forever()


if __name__ == '__main__':
    main()
