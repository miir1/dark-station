# 화면 담당 (2026-10-24 검증 #8·#10) 확인 도구 자가시험 — 게임·도구 파일은 고치지 않는다(모듈을 빌려 값만 바꿔 돌린다). 결과는 이 폴더에만.
# 쓰기 (C:\dev\dark_station 에서): python docs/foundation/meeting_2026-10-24/apply/screen_fix/tools_selftest.py
#   A. screen_check.CDP.open: 서버가 처음 두 번 game.js 를 못 주면(붐빌 때 흉내 — 503) 다시 열어 뜨는가 · 계속 못 주면 '뜨지 않았다'로 끝나는가(죽지 않음)
#   B. shot.py: 브라우저 한 번의 시간 제한을 3초로 줄여 → TimeoutExpired 로 죽지 않고 FAIL('시간 초과') + shots.json 이 남는가 (출력 폴더 = 이 폴더 아래)
#   C. shot.py: fixture.js 시간 제한을 1초로 줄여 → 죽지 않고 'fixture.js 시간 초과'를 적고 계속하는가
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request, http.server
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC
import shot as SH
import websockets

SC.PORT, SC.DBG = 18961, 19701
RES = {}
FAILS = {'left': 0}


class Flaky(SC.Quiet):
    def do_GET(self):
        if 'game.js' in self.path and FAILS['left'] > 0:
            FAILS['left'] -= 1
            self.send_error(503)
            return
        super().do_GET()


async def part_a():
    import functools, threading
    httpd = SC.Server(('127.0.0.1', SC.PORT), functools.partial(Flaky, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    prof = os.path.join(HERE, '.profile_selftest')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(80):
            try:
                pg = [t for t in json.loads(urllib.request.urlopen(f'http://127.0.0.1:{SC.DBG}/json/list', timeout=2).read()) if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']
                    break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = SC.CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            FAILS['left'] = 2
            t0 = time.time()
            ok = await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
            RES['A_flaky2'] = {'opened': ok, 'secs': round(time.time() - t0, 1), 'left': FAILS['left'], 'db': await c.ev('!!(window.__ds4 && __ds4.db)', False)}
            FAILS['left'] = 99
            t0 = time.time()
            ok = await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}', tries=2)
            RES['A_dead'] = {'opened': ok, 'secs': round(time.time() - t0, 1)}
            FAILS['left'] = 0
    finally:
        proc.terminate()
        httpd.shutdown()
        time.sleep(1)
        shutil.rmtree(prof, ignore_errors=True)
    print('A', json.dumps({k: RES[k] for k in RES if k.startswith('A')}, ensure_ascii=False))


def part_bc():
    SH.OUT = os.path.join(HERE, 'shots_selftest')
    SH.PORT = 18962
    SH.PROFILE = os.path.join(HERE, '.profile_shot_selftest')
    os.makedirs(SH.OUT, exist_ok=True)
    browser = SH.find_browser()
    httpd = SH.serve()
    log = []
    try:
        SH.SHOT_TIMEOUT, SH.RETRY = 3, 1
        t0 = time.time()
        SH.shot(browser, 'night8', 'zz_timeout', log)       # 3초 안에 D8 밤까지 못 간다 → 시간 초과
        RES['B_timeout'] = {'secs': round(time.time() - t0, 1), 'entry': {k: log[-1][k] for k in ('shot', 'ok', 'why', 'tries')}}
    finally:
        httpd.shutdown()
        shutil.rmtree(SH.PROFILE, ignore_errors=True)
    with open(os.path.join(SH.OUT, 'shots.json'), 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=1)
    print('B', json.dumps(RES['B_timeout'], ensure_ascii=False))
    # C: fixture.js 시간 제한 1초 — main() 의 fixture 부분만 같은 코드로
    SH.FIXTURE_TIMEOUT = 1
    t0 = time.time()
    note = ''
    try:
        r = subprocess.run(['node', os.path.join(ROOT, 'v4', 'tools', 'fixture.js'), 'd10_train', '200', str(SH.FIXTURE_SEC)], capture_output=True, timeout=SH.FIXTURE_TIMEOUT, cwd=ROOT)
        note = 'finished'
    except subprocess.TimeoutExpired:
        note = f'fixture.js 시간 초과 ({SH.FIXTURE_TIMEOUT}초)'
    RES['C_fixture_timeout'] = {'note': note, 'secs': round(time.time() - t0, 1)}
    # C2: fixture.js 자체 시간 상한 (3초) — 표준 오류 한 줄
    t0 = time.time()
    r = subprocess.run(['node', os.path.join(ROOT, 'v4', 'tools', 'fixture.js'), 'd10_train', '200', '3'], capture_output=True, timeout=120, cwd=ROOT)
    RES['C_fixture_cap3'] = {'secs': round(time.time() - t0, 1), 'stderr': r.stderr.decode('utf-8', 'replace').strip()[-200:], 'found': list(json.loads(r.stdout.decode('utf-8') or '{}').keys())}
    print('C', json.dumps({k: RES[k] for k in RES if k.startswith('C')}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(part_a())
    part_bc()
    with open(os.path.join(HERE, 'tools_selftest.json'), 'w', encoding='utf-8') as f:
        json.dump(RES, f, ensure_ascii=False, indent=1)
