# verify_A2 (적대적 검증): D2~D6 이른 위기에서 화면으로 직접 죽어 본다. 게임 파일은 고치지 않는다.
# 시뮬 봇 저장(fixtures.json, v4/tools/fixture.js 로 뽑음)에서 rng 만 '판정 실패' 값(fail_rng.json, find_fail.js)으로 바꿔 연다.
# 봇은 첫 창에서 손을 뗀다(?auto=manual). 그 뒤로는 진짜 키(Space·↓)만 눌러 진행한다: 줄 넘기기 → 선택 창(경고·확률·비용 읽기) → ↓ 로 위험한 선택 → Space → 판정 → 결과 → 사망 줄 → 명부.
# 쓰기 (C:\dev\dark_station 에서): python docs/foundation/meeting_2026-10-24/apply/verify_A2_run/die_on_screen.py
import os, sys, json, time, asyncio, subprocess, shutil, urllib.request, copy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC  # noqa: E402
import websockets  # noqa: E402

SC.OUTD = HERE
FX = json.load(open(os.path.join(HERE, 'fixtures.json'), encoding='utf-8'))
FAIL = json.load(open(os.path.join(HERE, 'fail_rng.json'), encoding='utf-8'))
CASES = []
for ev in ('d2_shutter_arm', 'd4_spanner', 'd5_flood', 'd6_shutter'):
    if ev in FX and FAIL.get(ev, {}).get('failRng'):
        s = copy.deepcopy(FX[ev]); s['rng'] = FAIL[ev]['failRng']
        SC.FIXTURES[ev + '_die'] = s
        CASES.append((ev + '_die', FAIL[ev]['choice'], True))
# 흔한 경우: D2 팔 위기 때 식량 0 (검토 지적 18: 값 길이 열린 판은 10.5%) — 선택 창만 본다
if 'd2_shutter_arm' in FX:
    s = copy.deepcopy(FX['d2_shutter_arm']); s['world']['food'] = 0
    SC.FIXTURES['d2_shutter_arm_food0'] = s
    CASES.append(('d2_shutter_arm_food0', None, False))

BOX = SC.SP_BOX_JS
KIND = "(() => { try { return __ds4.UI.openKind() || ''; } catch (e) { return 'ERR'; } })()"


async def press(c, k):
    await c.key(k, 'keyDown')
    await asyncio.sleep(0.05)
    await c.key(k, 'keyUp')


async def run_case(c, name, pick, die):
    r = {'case': name, 'lines_before': [], 'lines_after': [], 'shots': []}
    for attempt in range(4):                                  # 앞 페이지가 끊은 요청 때문에 스크립트가 덜 읽히면 다시 연다 (게임 문제 아님 — 콘솔에 남긴다)
        await c.send('Page.navigate', {'url': 'about:blank'}); await asyncio.sleep(1.2)
        await c.open(f'/v4/index.html?auto=manual&state=/__fixture/{name}.json&sc={int(time.time() * 1000)}')
        try:
            await c.wait("__ds4.state && __ds4.UI.openKind()", 40); break
        except SystemExit:
            r.setdefault('load_retries', []).append(c.errors()[:2])
    # 1 첫 줄들: Space 로 넘긴다 (봇 없음)
    for _ in range(40):
        k = await c.ev(KIND, False)
        if k == 'event':
            break
        if k == 'line':
            b = await c.ev(BOX, False)
            if not r['lines_before'] or r['lines_before'][-1] != b['text']:
                r['lines_before'].append(b['text'])
        await press(c, ' ')
        await asyncio.sleep(0.45)
    await asyncio.sleep(0.6)
    r['box'] = await c.ev(BOX, False)
    p = SC.out(f'verify_A2_{name}_1box.png'); await SC.stage_shot(c, p); r['shots'].append(os.path.basename(p))
    if pick is None:
        return r
    # 2 ↓ 로 커서: 경고가 있으면 커서 없이 열린다 — 첫 ↓ 가 맨 위, 다음부터 한 칸씩
    for _ in range(pick + 1):
        await press(c, 'ArrowDown'); await asyncio.sleep(0.15)
    r['cursor'] = await c.ev("[...document.querySelectorAll('#box .opt')].findIndex((b) => b.classList.contains('sel'))", False)
    p = SC.out(f'verify_A2_{name}_2cursor.png'); await SC.stage_shot(c, p); r['shots'].append(os.path.basename(p))
    await press(c, ' ')
    await asyncio.sleep(0.5)
    # 3 판정·결과·사망 줄·명부: 줄마다 찍고 Space
    seen_kinds = []
    for step in range(30):
        k = await c.ev(KIND, False)
        seen_kinds.append(k)
        if k in ('death_ledger', 'ending', 'title'):
            break
        if k == 'line':
            await asyncio.sleep(0.9)                         # 글자가 다 찍히게
            b = await c.ev(BOX, False)
            if not r['lines_after'] or r['lines_after'][-1]['text'] != b['text']:
                r['lines_after'].append({'text': b['text'], 'cg': b['cg']})
                p = SC.out(f'verify_A2_{name}_3line{len(r["lines_after"])}.png'); await SC.stage_shot(c, p); r['shots'].append(os.path.basename(p))
            await press(c, ' ')
        elif k == 'confirm2':
            b = await c.ev(BOX, False); r['confirm2'] = b
            await press(c, 'ArrowUp'); await asyncio.sleep(0.1); await press(c, ' ')
        await asyncio.sleep(0.5)
    r['kinds'] = seen_kinds
    await asyncio.sleep(0.8)
    r['end_box'] = await c.ev(BOX, False)
    r['state'] = await c.ev("(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, you: s.people.you.status, ended: s.ended ? { why: s.ended.why, cause: s.ended.cause } : null, last: s.lastResult ? { event: s.lastResult.event, choice: s.lastResult.choice, roll: s.lastResult.roll, warned: s.lastResult.warned, forced: s.lastResult.forced } : null }; })()", False)
    r['cg_src'] = await c.ev("(() => { const i = document.querySelector('#cg img'); return i ? i.src.split('/').slice(-3).join('/') : ''; })()", False)
    p = SC.out(f'verify_A2_{name}_4end.png'); await SC.stage_shot(c, p); r['shots'].append(os.path.basename(p))
    # 화면에 숫자(원한·카르마) 금지 확인: 끝 화면 글 전체에 '카르마'·'원한' 낱말·숫자 줄
    r['page_text_has_karma_word'] = await c.ev("/카르마|원한/.test(document.body.innerText)", False)
    r['console_errors'] = c.errors()
    return r


async def amain():
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile')
    shutil.rmtree(prof, ignore_errors=True); os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = []
    try:
        ws_url = None
        for _ in range(60):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{SC.DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']; break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = SC.CDP(ws)
            await c.send('Page.enable'); await c.send('Runtime.enable')
            only = [a for a in sys.argv[1:] if not a.startswith('--')]
            for name, pick, die in CASES:
                if only and name not in only:
                    continue
                try:
                    r = await run_case(c, name, pick, die)
                except BaseException as e:
                    r = {'case': name, 'error': str(e)[:400], 'console_errors': c.errors()}
                res.append(r)
                print(json.dumps(r, ensure_ascii=False)[:1500])
    finally:
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(proc.pid)], capture_output=True); time.sleep(1.5)   # 자식 창(renderer)까지
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)
    tag = next((a[6:] for a in sys.argv[1:] if a.startswith('--tag=')), '')
    with open(os.path.join(HERE, f'die_on_screen{tag}.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(amain())
