# 어두운 역 v4 — 헤드리스 캡처. 로컬 http 서버를 띄우고 Chrome/Edge headless 로 ?fast=1&auto=<지점> 을 열어 PNG 로 남긴다.
# 쓰기:  python v4/tools/shot.py            (C:\dev\dark_station 에서)   → v4/shots/01_car.png … 13_run.png + shots.json
#        python v4/tools/shot.py car         (하나만)      python v4/tools/shot.py ending --seed=3   (시드 바꿔서)
# 캡처 전에 v4/tools/manifest.py 로 그림 목록(v4/img/manifest.json)을 새로 만든다 — 새 그림이 자동으로 잡힌다.
# shots.json: ok + why(실패 까닭) + tries + console_errors(오류·uncaught) + auto(봇이 남긴 [ds4 …] 줄: 도달한 날·고른 선택·그림 없는 장면)
#   ok = PNG 가 생겼고 + 게임이 떠서 그 지점에 닿았고(봇 기록 '[ds4 auto] <지점> … reached=1' — 게임 안에서 state·지도·단계·붙잡은 창을 보고 찍는다)
#        + PNG 에서 잰 배율(png_scale)이 2 이고 + 시작 오류가 없다. 실패한 지점은 한 번 더 찍는다. 하나라도 실패면 끝 코드 1.
#   --profile=<폴더> : 헤드리스 브라우저 프로필 폴더 (기본 v4/shots/.profile). 회의 검증 때는 회의 폴더 아래를 준다.
#   --out=<폴더>     : PNG·shots.json 을 둘 폴더 (기본 v4/shots). 회의 검증 때는 회의 폴더 아래를 준다 (정본 캡처를 덮지 않게).
#   컴퓨터가 바쁠 때 (2026-10-24 검증 #8·#10): 브라우저 한 번이 SHOT_TIMEOUT(600초)를 넘거나 fixture.js 가 FIXTURE_TIMEOUT 을 넘어도 도구는 죽지 않는다 —
#     그 지점만 FAIL('시간 초과')로 적고 다시 찍고, shots.json 은 늘 남는다. fixture.js 는 FIXTURE_SEC(240초)에 찾은 만큼으로 멈춘다. 로컬 서버 대기열 128.
# 브라우저 쪽 자동 진행은 game.js 의 autoRun(?auto=) 이 맡는다. 화면 갱신은 requestAnimationFrame + 보조 타이머(100ms 넘게 rAF 가 없으면 대신 한 번)라 숨은 창·헤드리스에서도 돈다.
import os, re, sys, subprocess, threading, time, http.server, socketserver, functools, shutil, json, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'v4', 'shots')
PORT = 8765
# 지점 → 파일. night5 = D5 밤 고정 사건(옛 이름 day5) · evening5 = D5 저녁 화로 둘레 대화 · night8 = D8 밤 고정 사건
# called3 = D3 밤 '이름이 불렸다' 선택 창 · train = 열차 결말 뒤 명부 · beds = D2 밤 지도(잠든 사람이 잠자리 위에 눕는다)
# run = D0 차량부터 D10 결말 명부까지 저장 없이 처음부터 끝까지 도는 판 (회귀 검사 — 열흘 전체를 한 판으로 지나가며 오류·멈춤을 잡는다)
SHOTS = [('car', '01_car'), ('morning3', '02_morning3'), ('night3', '03_night3'), ('night5', '04_night5'), ('night8', '05_night8'),
         ('ending', '06_ending'), ('death', '07_death'), ('evening5', '08_evening5'), ('reveal', '09_reveal'),
         ('called3', '10_called3'), ('train', '11_train'), ('beds', '12_beds'), ('run', '13_run')]
BUDGET = {'car': 15000, 'morning3': 120000, 'night3': 150000, 'night5': 300000, 'night8': 450000, 'ending': 700000, 'death': 300000,
          'evening5': 300000, 'reveal': 700000, 'called3': 150000, 'train': 700000, 'beds': 120000, 'run': 700000}
STALE = ['04_day5']                              # 이름이 바뀐 옛 캡처 — 전부 찍을 때 지운다
# 처음부터 봇으로 가면 닿지 않는 지점은 시뮬 봇이 만든 저장에서 시작한다 (v4/tools/fixture.js → 메모리 → /__fixture/<사건 id>.json → ?state=)
#   train: 열차 결말(d10_train)은 통로가 열리고 주민이 살아 있어야 걸린다 — 캡처 봇(시드 7)은 D10 전에 주민이 다 죽어 all_dead 로 끝난다
#   ending: (10-24 줄타기) 카르마가 쌓인 판에는 위험 0 출구가 없어(모든 출구가 판정) 처음부터 가는 캡처 봇도 D7~D9 습격에서 3~10% 로 죽는다 —
#           시드 하나의 운에 걸리지 않게 걷는 결말(d10_walk)이 걸린 저장에서 시작한다. 처음부터 끝까지 가는 판은 run(13) 이 맡는다
FIXTURE = {'train': 'd10_train', 'ending': 'd10_walk'}
# 처음부터 D10 결말까지 가야 하는 지점은 시드를 차례로 바꿔 가며 찍는다 — 줄타기 판에서 캡처 봇은 시드에 따라 D4~D10 에 죽는다(게임의 정상 결과).
#   죽은 시드도 D0 부터 죽은 날까지 돈 판이라 그 판의 오류는 그대로 센다. 모든 시드가 D10 전에 죽으면 FAIL ('처음부터 끝까지 간 판이 없다').
#   (10-25 확인, 판마다 같은 결과: 3·21·6·8 = D10 걷는 결말, 1 = D10 all_dead 결말 / 7 D9 · 11 D6 · 5 D4 · 13 D8 · 2 D7 · 4 D10 · 9 D9 사망 —
#    tightrope/screen_run13/) 닿는 시드를 앞에 둬 보통은 한 판(약 40초)으로 끝난다. 표가 바뀌어 앞 시드가 죽으면 다음 시드로 · --seed=N 을 주면 그 시드만
SEEDS = {'run': [3, 21, 6, 8, 1, 7, 11, 5, 13, 2, 4, 9]}
FIXTURES = {}
PROFILE = None                                   # --profile=<폴더> (없으면 v4/shots/.profile)


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


class Server(socketserver.ThreadingTCPServer):
    # 기본 대기열 5 는 붐빌 때 스크립트 요청을 버린다 (2026-10-24 검증 #10 — screen_check.py 와 같게)
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


def decode(b):
    # Chrome 의 stderr 로그 줄은 UTF-8 이 아닐 때가 있다(Windows 코드 페이지 cp949) → 줄마다 UTF-8 먼저, 안 되면 cp949
    for enc in ('utf-8', 'cp949'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('utf-8', errors='replace')


EXPECT_K = 2                                     # 창 1280×720 → 논리 640×320 의 정수 배율 2 (game.js fitApp)
RETRY = 1                                        # 실패한 지점은 한 번 더 찍는다 (다른 Chrome 이 동시에 돌 때 페이지가 아예 안 뜨는 경우)
SHOT_TIMEOUT = 600                               # 한 장을 찍는 브라우저 한 번의 시간 제한(초) — 넘으면 그 시도는 실패(도구는 계속)
FIXTURE_SEC, FIXTURE_TIMEOUT = 240, 1500         # fixture.js: 찾을 만큼 찾았으면 240초에 멈춘다 · 그래도 1500초가 넘으면 저장 없이 봇이 처음부터


def png_scale(out):
    """캡처 PNG 에서 배율을 잰다: 게임 화면(논리 640 폭)이 차지한 가로 폭 / 640. 헤드리스는 캡처 직전에 창 크기를 바꾸므로
    게임 안에서 잰 배율은 캡처 때 배율이 아닐 수 있다 — 그림이 진짜 증거다. PIL 이 없으면 None."""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        im = Image.open(out).convert('L')
        bb = im.point(lambda v: 255 if v > 12 else 0).getbbox()
        return 0 if not bb else round((bb[2] - bb[0]) / 640, 2)
    except Exception:
        return None


def judge(out, lines, key=None):
    """캡처가 진짜 게임 화면인가: PNG 가 있고, 봇 기록([ds4 auto] 줄)이 있고, 그림의 배율이 2 이고, 시작 실패·엔진 순서 오류가 없다.
    PNG 만 보면 게임이 시작조차 안 된 검은 화면(배율 1, 빈 패널)도 성공으로 잡힌다 (2026-10-24 검증 #8)."""
    why = []
    if not os.path.exists(out):
        return ['PNG 없음'], None
    auto = [ln for ln in lines if 'CONSOLE' in ln and '[ds4 auto]' in ln]
    if not auto:
        why.append('봇 기록([ds4 auto]) 없음 - 게임이 시작되지 않았거나 끝까지 돌지 않았다')
    elif key is not None and not any(re.search(r'\[ds4 auto\] ' + re.escape(key) + r' .*reached=1', ln) for ln in auto):
        last = auto[-1][auto[-1].index('[ds4 auto]'):].split('", source')[0][:140]
        why.append('지점에 닿지 못했다 (reached=1 없음): ' + last)
    elif key in SEEDS and not any(re.search(r'\[ds4 auto\] ' + re.escape(key) + r' .*reached=1 D10 ', ln) for ln in auto):
        why.append('D10 결말에 닿지 못했다')                 # 처음부터 끝까지 가는 판(run)은 D10 결말 창이어야 한다 (게임 쪽 HOLD 가 바뀌어도 여기서 잡는다)
    k = png_scale(out)
    if k is not None and k < EXPECT_K - 0.1:
        why.append(f'그림 배율 {k} (기대 {EXPECT_K}) - 화면이 1배이거나 비었다')
    bad = [ln for ln in lines if '시작하지 못했다' in ln or 'DS4 엔진이 먼저 읽혀야 한다' in ln or 'Uncaught' in ln or '표 검증 실패' in ln]   # 표 행이 빠진 채 뜬 게임도 실패 (10-24 지적 13)
    if bad:
        why.append('시작 오류: ' + bad[0][:120])
    return why, k


def where(auto):
    """봇의 마지막 기록 줄에서 판이 어디서 멈췄는지: 'D9 you_gone' · 'D10 d10_walk_other' (시드를 바꿔 찍는 판의 시도 기록용)"""
    last = next((a for a in reversed(auto) if a.startswith('[ds4 auto]')), '')
    m = re.search(r'reached=\d (D\d+)', last)
    e = re.search(r' ended=(\S+)', last)
    return ' '.join(x for x in ((m.group(1) if m else '?'), (e.group(1) if e else '')) if x)


def shot(browser, key, name, log, seed=None):
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + '.png')
    tries, errs_all = [], []
    # 처음부터 끝까지 가는 판(SEEDS)은 시드를 바꿔 가며 한 판씩 — 그 밖의 지점(또는 --seed 를 준 경우)은 같은 시드로 1+RETRY 번
    plan = SEEDS[key] if key in SEEDS and not seed else [seed] * (1 + RETRY)
    for attempt, sd in enumerate(plan):
        if os.path.exists(out):
            os.remove(out)                       # 옛 캡처가 남아 있으면 '파일이 생겼다'로 오판한다
        url = f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto={key}&shot={int(time.time())}{attempt}' + (f'&seed={sd}' if sd else '')
        if key in FIXTURE:
            url += f'&state=/__fixture/{FIXTURE[key]}.json' if FIXTURE[key] in FIXTURES else ''
        prof = PROFILE or os.path.join(OUT, '.profile')
        args = [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                f'--user-data-dir={prof}', '--window-size=1280,720', f'--virtual-time-budget={BUDGET.get(key, 60000)}',
                '--enable-logging=stderr', '--v=0', f'--screenshot={out}', url]
        try:
            r = subprocess.run(args, capture_output=True, timeout=SHOT_TIMEOUT)
            raw, timed_out = r.stderr or b'', False
        except subprocess.TimeoutExpired as te:   # 컴퓨터가 바쁠 때 (2026-10-24 검증 #8): 도구가 죽지 않고 그 지점만 실패로 적고 다시 찍는다
            raw, timed_out = te.stderr or b'', True
        lines = [decode(b) for b in raw.splitlines()]
        errs = [ln for ln in lines if 'CONSOLE' in ln and ('error' in ln.lower() or 'uncaught' in ln.lower())]
        auto = [ln[ln.index('[ds4'):].split('", source')[0] for ln in lines if 'CONSOLE' in ln and '[ds4' in ln]
        why, k = judge(out, lines, key)
        if timed_out:
            why = [f'시간 초과 ({SHOT_TIMEOUT}초) - 컴퓨터가 바쁘다'] + why
        errs_all += errs                         # 실패한 시도의 오류도 센다 (죽은 시드도 D0 부터 죽은 날까지 돈 진짜 판이다)
        t = {'attempt': attempt + 1, 'ok': not why, 'why': why, 'png_scale': k, 'console_errors': len(errs)}
        if key in SEEDS:
            t.update(seed=sd, end=where(auto))
            print(f'    {name} seed {sd}: {t["end"]}' + (' - OK' if not why else ''))
        tries.append(t)
        if not why:
            break
    if why and key in SEEDS and not seed:
        why = [f'처음부터 끝까지 간 판이 없다 (시드 {len(tries)}개 모두 D10 결말 전에 멈췄다: ' + ', '.join(f'{t["seed"]}={t["end"]}' for t in tries) + ')'] + why
    log.append({'shot': name, 'ok': not why, 'why': why, 'png_scale': k, 'tries': tries, 'console_errors': errs_all, 'auto': auto})
    print(('OK  ' if not why else 'FAIL'), name, f'(console errors {len(errs_all)}{", try " + str(len(tries)) if len(tries) > 1 else ""})' + (' - ' + ' / '.join(why) if why else ''))
    for e in errs_all + auto:
        print('   ', e.encode('ascii', 'backslashreplace').decode('ascii')[:300])


def main():
    try:
        sys.stdout.reconfigure(errors='replace')   # Windows 콘솔(cp949)에서 못 찍는 글자가 있어도 멈추지 않게
    except Exception:
        pass
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    seed = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--seed=')), None)
    global PROFILE, OUT
    prof = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--profile=')), None)
    if prof:
        PROFILE = os.path.abspath(os.path.join(ROOT, prof)) if not os.path.isabs(prof) else prof
    outd = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--out=')), None)
    if outd:
        OUT = os.path.abspath(os.path.join(ROOT, outd)) if not os.path.isabs(outd) else outd
    only = set(args)
    sys.path.insert(0, os.path.dirname(__file__))
    import manifest
    print('manifest', len(manifest.build()))
    browser = find_browser()
    need = sorted({FIXTURE[k] for k, _ in SHOTS if k in FIXTURE and (not only or k in only)})
    if need:
        note = ''
        try:                                     # (2026-10-24 검증 #8) 시간 초과로 도구가 죽지 않게 — 저장이 없으면 그 지점은 봇이 처음부터 간다(닿지 못하면 FAIL 로 남는다)
            r = subprocess.run(['node', os.path.join(ROOT, 'v4', 'tools', 'fixture.js'), ','.join(need), '200', str(FIXTURE_SEC)], capture_output=True, timeout=FIXTURE_TIMEOUT, cwd=ROOT)
            try:
                FIXTURES.update(json.loads(decode(r.stdout) or '{}'))
            except ValueError:
                pass
            note = (decode(r.stderr or b'').strip().splitlines() or [''])[-1][:160]
        except subprocess.TimeoutExpired:
            note = f'fixture.js 시간 초과 ({FIXTURE_TIMEOUT}초)'
        print('fixture', ', '.join(f'{k}={"OK" if k in FIXTURES else "missing (bot from start)"}' for k in need), note)
    httpd = serve()
    log = []
    try:
        for key, name in SHOTS:
            if only and key not in only:
                continue
            try:
                shot(browser, key, name, log, seed)
            except Exception as e:               # 한 지점에서 도구가 넘어져도 나머지를 찍고 shots.json 을 남긴다
                log.append({'shot': name, 'ok': False, 'why': ['도구 오류: ' + repr(e)[:200]], 'png_scale': None, 'tries': [], 'console_errors': [], 'auto': []})
                print('FAIL', name, '- 도구 오류:', repr(e)[:200])
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
    bad = [x['shot'] for x in log if not x.get('ok')]
    errs = sum(len(x.get('console_errors') or []) for x in log)
    print(f'shots {len(log) - len(bad)}/{len(log)} ok · console errors {errs}' + (' · FAIL ' + ', '.join(bad) if bad else ''))
    if bad:
        sys.exit(1)


if __name__ == '__main__':
    main()
