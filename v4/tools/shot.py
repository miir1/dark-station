# 어두운 역 v4 — 헤드리스 캡처. 로컬 http 서버를 띄우고 Chrome/Edge headless 로 ?fast=1&auto=<지점> 을 열어 PNG 로 남긴다.
# 쓰기:  python v4/tools/shot.py            (C:\dev\dark_station 에서)   → v4/shots/01_car.png 02_morning3.png 03_night3.png
#        python v4/tools/shot.py car         (하나만)
# 브라우저 쪽 자동 진행은 game.js 의 autoRun(?auto=) 이 맡는다. 화면 갱신은 setInterval 이라 숨은 창에서도 돈다.
import os, sys, subprocess, threading, time, http.server, socketserver, functools, shutil, json, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'v4', 'shots')
PORT = 8765
SHOTS = [('car', '01_car'), ('morning3', '02_morning3'), ('night3', '03_night3')]
BUDGET = {'car': 15000, 'morning3': 90000, 'night3': 120000}


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


def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def shot(browser, key, name, log):
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + '.png')
    url = f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto={key}&shot=1'
    prof = os.path.join(OUT, '.profile')
    args = [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
            f'--user-data-dir={prof}', '--window-size=1280,720', f'--virtual-time-budget={BUDGET.get(key, 60000)}',
            '--enable-logging=stderr', '--v=0', f'--screenshot={out}', url]
    r = subprocess.run(args, capture_output=True, text=True, timeout=300)
    errs = [ln for ln in (r.stderr or '').splitlines() if 'CONSOLE' in ln and ('error' in ln.lower() or 'uncaught' in ln.lower())]
    log.append({'shot': name, 'ok': os.path.exists(out), 'console_errors': errs})
    print(('OK  ' if os.path.exists(out) else 'FAIL'), out, f'(콘솔 오류 {len(errs)})')
    for e in errs:
        print('   ', e)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    browser = find_browser()
    httpd = serve()
    log = []
    try:
        for key, name in SHOTS:
            if only and key != only:
                continue
            shot(browser, key, name, log)
    finally:
        httpd.shutdown()
    with open(os.path.join(OUT, 'shots.json'), 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
