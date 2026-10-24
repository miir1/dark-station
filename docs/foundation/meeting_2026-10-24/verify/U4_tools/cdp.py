# U4 verifier harness: static server + headless Chrome + CDP (read-only on the game; writes only to verify/U4_*)
import os, sys, json, time, base64, asyncio, threading, subprocess, functools, http.server, socketserver, urllib.request, shutil
import websockets

ROOT = r'C:\dev\dark_station'
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'meeting_2026-10-24', 'verify')
PORT, DBG = 18893, 19733
PROF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chrome_profile')


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


class CDP:
    def __init__(self):
        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self.loop.run_forever, daemon=True).start()
        self.n = 0
        self.wait = {}
        self.console = []

    def run(self, coro, timeout=180):
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    async def _connect(self, url, w, h):
        self.ws = await websockets.connect(url, max_size=128 * 1024 * 1024)
        asyncio.ensure_future(self._reader())
        await self._send('Runtime.enable')
        await self._send('Page.enable')
        await self._send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': False})

    async def _reader(self):
        async for msg in self.ws:
            m = json.loads(msg)
            if 'id' in m and m['id'] in self.wait:
                self.wait.pop(m['id']).set_result(m)
            elif m.get('method') == 'Runtime.consoleAPICalled':
                p = m['params']
                self.console.append((p.get('type'), ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', []))))
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params'].get('exceptionDetails', {})
                self.console.append(('exception', str(d.get('exception', {}).get('description', d.get('text')))))

    async def _send(self, method, params=None):
        self.n += 1
        i = self.n
        fut = self.loop.create_future()
        self.wait[i] = fut
        await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
        return await fut

    def connect(self, url, w=1280, h=720):
        self.run(self._connect(url, w, h))

    def send(self, method, params=None, timeout=180):
        return self.run(self._send(method, params), timeout)

    def ev(self, js, timeout=180):
        r = self.send('Runtime.evaluate', {'expression': js, 'awaitPromise': True, 'returnByValue': True, 'timeout': timeout * 1000}, timeout + 5)
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            raise RuntimeError(json.dumps(res['exceptionDetails'], ensure_ascii=False)[:2000])
        return res.get('result', {}).get('value')

    def nav(self, url):
        self.send('Page.navigate', {'url': url})

    def shot(self, path):
        r = self.send('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['result']['data']))


def start(w=1280, h=720):
    httpd = serve()
    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    os.makedirs(PROF, exist_ok=True)
    proc = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
                             f'--user-data-dir={PROF}', f'--window-size={w},{h}', f'--remote-debugging-port={DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws = None
    for _ in range(100):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json'))
            ws = next(t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page')
            break
        except Exception:
            time.sleep(0.2)
    cdp = CDP()
    cdp.connect(ws, w, h)
    return cdp, proc, httpd


def save_dataurl(durl, name):
    b = base64.b64decode(durl.split(',', 1)[1])
    p = os.path.join(OUTD, name)
    with open(p, 'wb') as f:
        f.write(b)
    return p
