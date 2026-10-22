# 어두운 역 v4 — 헤드리스 캡처. 로컬 http 서버를 띄우고 Chrome/Edge headless 로 ?fast=1&auto=<지점> 을 열어 PNG 로 남긴다.
# 쓰기:  python v4/tools/shot.py            (C:\dev\dark_station 에서)   → v4/shots/01_car.png … 11_train.png + shots.json
#        python v4/tools/shot.py car         (하나만)      python v4/tools/shot.py ending --seed=3   (시드 바꿔서)
# 캡처 전에 v4/tools/manifest.py 로 그림 목록(v4/img/manifest.json)을 새로 만든다 — 새 그림이 자동으로 잡힌다.
# shots.json: console_errors(오류·uncaught) + auto(봇이 남긴 [ds4 …] 줄: 도달한 날·고른 선택·그림 없는 장면)
# 브라우저 쪽 자동 진행은 game.js 의 autoRun(?auto=) 이 맡는다. 화면 갱신은 setInterval 이라 숨은 창에서도 돈다.
import os, sys, subprocess, threading, time, http.server, socketserver, functools, shutil, json, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'v4', 'shots')
PORT = 8765
# 지점 → 파일. night5 = D5 밤 고정 사건(옛 이름 day5) · evening5 = D5 저녁 화로 둘레 대화 · night8 = D8 밤 고정 사건
# called3 = D3 밤 '이름이 불렸다' 선택 창 · train = 열차 결말 뒤 명부
SHOTS = [('car', '01_car'), ('morning3', '02_morning3'), ('night3', '03_night3'), ('night5', '04_night5'), ('night8', '05_night8'),
         ('ending', '06_ending'), ('death', '07_death'), ('evening5', '08_evening5'), ('reveal', '09_reveal'),
         ('called3', '10_called3'), ('train', '11_train')]
BUDGET = {'car': 15000, 'morning3': 120000, 'night3': 150000, 'night5': 300000, 'night8': 450000, 'ending': 700000, 'death': 300000,
          'evening5': 300000, 'reveal': 700000, 'called3': 150000, 'train': 700000}
STALE = ['04_day5']                              # 이름이 바뀐 옛 캡처 — 전부 찍을 때 지운다
# 처음부터 봇으로 가면 닿지 않는 지점은 시뮬 봇이 만든 저장에서 시작한다 (v4/tools/fixture.js → 메모리 → /__fixture/<사건 id>.json → ?state=)
#   train: 열차 결말(d10_train)은 통로가 열리고 주민이 살아 있어야 걸린다 — 캡처 봇(시드 7)은 D10 전에 주민이 다 죽어 all_dead 로 끝난다
FIXTURE = {'train': 'd10_train'}
FIXTURES = {}


def find_browser():
    cands = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    ]
    for c in cands:
        if os.path.exists(c):
            return c
    for name in ('chrome', 'msedge', 'chromium'):
        p = shutil.which(name)
        if p:
            return p
    raise SystemExit('Chrome/Edge 를 찾지 못했다')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):                       # 캡처마다 새 코드를 읽게 (헤드리스 프로필이 옛 game.js 를 캐시하지 않도록)
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):                            # /__fixture/<사건 id>.json = fixture.js 가 만든 저장 (파일로 남기지 않는다)
        if self.path.startswith('/__fixture/'):
            fid = self.path.split('/')[-1].split('?')[0].replace('.json', '')
            body = json.dumps(FIXTURES.get(fid), ensure_ascii=False).encode('utf-8') if fid in FIXTURES else None
            if body is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def decode(b):
    # Chrome 의 stderr 로그 줄은 UTF-8 이 아닐 때가 있다(Windows 코드 페이지 cp949) → 줄마다 UTF-8 먼저, 안 되면 cp949
    for enc in ('utf-8', 'cp949'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('utf-8', errors='replace')


def shot(browser, key, name, log, seed=None):
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + '.png')
    url = f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto={key}&shot={int(time.time())}' + (f'&seed={seed}' if seed else '')
    if key in FIXTURE:
        url += f'&state=/__fixture/{FIXTURE[key]}.json' if FIXTURE[key] in FIXTURES else ''
    prof = os.path.join(OUT, '.profile')
    args = [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
            f'--user-data-dir={prof}', '--window-size=1280,720', f'--virtual-time-budget={BUDGET.get(key, 60000)}',
            '--enable-logging=stderr', '--v=0', f'--screenshot={out}', url]
    r = subprocess.run(args, capture_output=True, timeout=600)
    lines = [decode(b) for b in (r.stderr or b'').splitlines()]
    errs = [ln for ln in lines if 'CONSOLE' in ln and ('error' in ln.lower() or 'uncaught' in ln.lower())]
    auto = [ln[ln.index('[ds4'):].split('", source')[0] for ln in lines if 'CONSOLE' in ln and '[ds4' in ln]
    log.append({'shot': name, 'ok': os.path.exists(out), 'console_errors': errs, 'auto': auto})
    print(('OK  ' if os.path.exists(out) else 'FAIL'), name, f'(console errors {len(errs)})')
    for e in errs + auto:
        print('   ', e.encode('ascii', 'backslashreplace').decode('ascii')[:300])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    seed = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--seed=')), None)
    only = set(args)
    sys.path.insert(0, os.path.dirname(__file__))
    import manifest
    print('manifest', len(manifest.build()))
    browser = find_browser()
    need = sorted({FIXTURE[k] for k, _ in SHOTS if k in FIXTURE and (not only or k in only)})
    if need:
        r = subprocess.run(['node', os.path.join(ROOT, 'v4', 'tools', 'fixture.js'), ','.join(need)], capture_output=True, timeout=600, cwd=ROOT)
        try:
            FIXTURES.update(json.loads(decode(r.stdout) or '{}'))
        except ValueError:
            pass
        print('fixture', ', '.join(f'{k}={"OK" if k in FIXTURES else "missing (bot from start)"}' for k in need))
    httpd = serve()
    log = []
    try:
        for key, name in SHOTS:
            if only and key not in only:
                continue
            shot(browser, key, name, log, seed)
    finally:
        httpd.shutdown()
    if not only:
        for n in STALE:
            f = os.path.join(OUT, n + '.png')
            if os.path.exists(f):
                os.remove(f)
    path = os.path.join(OUT, 'shots.json')
    if only and os.path.exists(path):            # 일부만 찍었으면 나머지 기록은 둔다
        try:
            with open(path, encoding='utf-8') as f:
                old = {x['shot']: x for x in json.load(f)}
        except Exception:
            old = {}
        for x in log:
            old[x['shot']] = x
        log = [old[n] for _, n in SHOTS if n in old]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
