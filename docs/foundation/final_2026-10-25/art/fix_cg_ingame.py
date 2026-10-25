# 최종 점검 그림 담당(2026-10-25 아침) 증거 — 새로 넣은 장면 그림 14장(16사건)이 실제 게임 화면에서 그 사건에 뜨는가.
# 게임·도구 파일은 고치지 않는다: v4/tools/screen_check.py 를 모듈로 불러 그 도구의 fn_event(시뮬 저장 → 사건 첫 줄·선택 창)를 그대로 쓴다.
# 쓰기 (C:\dev\dark_station 에서):  python docs/foundation/final_2026-10-25/art/fix_cg_ingame.py
# 결과: docs/foundation/final_2026-10-25/art/screen_final_<사건>_line.png · _box.png · fix_cg_ingame.json
#   ① fixture(시뮬 봇 저장)를 찾은 사건: 첫 줄에 뜬 큰 그림 = img/cg/<기대 이름>.png 인가(cg_ok), 선택 창 작은 그림
#   ② 모든 사건(저장 없이): 게임 안 ART.cgKey 가 v4/cg/<기대 이름> 을 고르고, 그 큰·작은 그림이 실제로 읽히는가(naturalWidth 384·256)
import asyncio, json, os, sys, time, shutil, subprocess, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as S  # noqa: E402
import websockets  # noqa: E402

S.OUTD = os.path.dirname(os.path.abspath(__file__))
WANT = {'pro_notebook': 'cg_notebook', 'pro_gicheol': 'cg_gicheol', 'pro_speaker': 'cg_speaker', 'd3_guess': 'cg_notebook_back',
        'd4_dohyeon_key': 'cg_dohyeon', 'd6_dohyeon_back': 'cg_dohyeon', 'd6_dohyeon_price': 'cg_dohyeon',
        'trip_a1_pharmacy': 'cg_pharmacy', 'trip_a1_backroom': 'trip_a1_backroom', 'trip_b1_gate': 'cg_gate', 'd10_train': 'cg_train',
        'flood_sick': 'flood_sick', 'd3_rat_fever': 'd3_rat_fever', 'd7_fingers_dead': 'd7_fingers_dead',
        'trial_d3_count': 'trial_d3_count', 'trip_b1_workers': 'trip_b1_workers'}

TABLE_JS = r"""(async () => { const db = __ds4.db, want = %s, out = {};
  const load = (src) => new Promise((ok) => { if (!src) return ok(0); const im = new Image(); im.onload = () => ok(im.naturalWidth); im.onerror = () => ok(-1); im.src = src; });
  for (const id of Object.keys(want)) { const e = db.events[id]; if (!e) { out[id] = { error: '사건 없음' }; continue; }
    const key = ART.cgKey(e.image, e.id), big = ART.cgSrc(e.image, e.id), small = ART.cgSmall(big);
    out[id] = { image: e.image, key, ok: key === 'v4/cg/' + want[id], bigW: await load(big), smallW: await load(small) }; }
  return out; })()"""


async def run():
    S.load_fixtures(sorted(WANT))
    httpd = S.serve()
    prof = os.path.join(S.OUTD, '.profile_ingame')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([S.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={S.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {'events': {}, 'table': None}
    try:
        ws_url = None
        for _ in range(60):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{S.DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']
                    break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = S.CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            for ev, name in WANT.items():
                if ev not in S.FIXTURES:
                    res['events'][ev] = {'skip': 'fixture 없음'}
                    print('ingame', ev, 'fixture 없음')
                    continue
                await S.fn_event(c, ev, ev, res['events'], name)
            await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
            await S.until(c, "__ds4.state && __ds4.db", 60)
            res['table'] = await c.ev(TABLE_JS % json.dumps(WANT), True)
            res['table_console_errors'] = c.errors()
    finally:
        proc.terminate()
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)
    t = res['table'] or {}
    res['summary'] = {
        'fixture_cg_ok': {k: v.get('cg_ok') for k, v in res['events'].items() if 'skip' not in v},
        'fixture_skip': [k for k, v in res['events'].items() if 'skip' in v],
        'table_ok': all(v.get('ok') and v.get('bigW') == 384 and v.get('smallW') == 256 for v in t.values()) and len(t) == len(WANT),
        'table_bad': {k: v for k, v in t.items() if not (v.get('ok') and v.get('bigW') == 384 and v.get('smallW') == 256)},
        'console_errors': sum(len(v.get('console_errors') or []) for v in res['events'].values()) + len(res.get('table_console_errors') or []),
    }
    with open(os.path.join(S.OUTD, 'fix_cg_ingame.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print('summary', json.dumps(res['summary'], ensure_ascii=False))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(run())
