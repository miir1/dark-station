# 어두운 역 v4 — 소리 확인 도구 (v4/sound.js, 디렉터 B6: 효과음·앰비언트만).
# 헤드리스 Chrome 을 DevTools 로 붙잡아 실제 게임을 돌리고, ?snd=log(출력은 0 = 무음, 노드 수·부른 소리를 SND.log 에 남긴다)로
# AudioContext 노드가 실제로 만들어지는지, 사건마다 소리가 붙는지 본다. 게임 파일은 고치지 않는다.
# 쓰기 (C:\dev\dark_station 에서):
#   python v4/tools/sound_check.py                 전부 (gate · walk · run · death · capture · loud)
#   python v4/tools/sound_check.py gate walk       골라서
#   --out=<폴더>  결과 폴더 (기본 docs/foundation/final_2026-10-25/sound)
# 하는 일
#   plain   : 실제로 들리는 길(?snd 없음): 첫 클릭 뒤 소리가 켜지고 콘솔 오류 0
#   gate    : 첫 입력 전에는 AudioContext 가 0개 · Esc 는 입력으로 치지 않는다 · 클릭 한 번에 1개 · 선택 확정 소리 · 수납 열기(구급함·레버·가방) ·
#             M 키 끄기/켜기 · 멈춤 메뉴(소리 끄기·크기 3단) + localStorage 저장 · 탭 숨김 → 줄이고 멈춤 → 다시 보임
#   walk    : (fast 없이) 봇이 전동차→터널→승강장을 걷는다 → 바닥별 발걸음(쇠·자갈·타일·콘크리트·끝선) · 화로 거리·계단 쉿·배수로 물 앰비언트 목표값 · 탭(무음 출력 앞) 크기
#   run     : ?fast=1&auto=run&snd=log — 처음부터 D10 결말까지 봇 판: 사건마다 붙은 소리 종류·횟수 (선택·판정·다침·지직·두드림·말풍선·조사·열기 …) · 밤 앰비언트
#   knock   : (fast 없이) D1 낮 셔터 앞 — 두드림이 지도 위 박자(0·330·660ms / 2.6초)에 맞춰 나는가 · 말풍선 소리
#   death   : ?fast=1&auto=death&snd=log — 죽음 소리 뒤 침묵(앰비언트 0)
#   capture : ?fast=1&auto=car (snd 없음) — 캡처 모드 무음: 입력을 줘도 AudioContext 0개
#   parity  : 같은 시드 봇 판을 sound.js 를 읽고 / 막고 두 번 — 봇 기록·끝 상태가 같다 (소리가 판을 바꾸지 않는다)
#   loud    : 오프라인으로 소리마다 그려 크기를 잰다(dBFS, 작게·보통·크게) + 들어 볼 견본 WAV (sound_samples.wav · ambience_*.wav)
# 결과: <out>/sound_check.json · sound_check.txt · *.wav
import os, re, sys, json, time, asyncio, subprocess, shutil, urllib.request, base64, wave, struct

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import screen_check as S                         # 같은 폴더의 CDP·로컬 서버를 그대로 쓴다

ROOT = S.ROOT
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'final_2026-10-25', 'sound')
DBG = 19587
RES = {}

# 새 문서마다: AudioContext 를 몇 번 만들었는지 센다 (첫 입력 전 0개 확인)
AC_COUNT = r"""
(() => {
  window.__acCount = 0;
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const AC = window[k]; if (typeof AC !== 'function') continue;
    window[k] = class extends AC { constructor(...a) { super(...a); window.__acCount++; } };
  }
})();
"""


def out(name):
    os.makedirs(OUTD, exist_ok=True)
    return os.path.join(OUTD, name)


async def st(c):
    return await c.ev('({ ac: window.__acCount, snd: window.SND ? SND.status() : null })', False)


async def click(c, x=1150, y=300):
    for t in ('mousePressed', 'mouseReleased'):
        await c.send('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})


async def tap(c, k, code=None, vk=0, text=''):
    for t in ('keyDown', 'keyUp'):
        await c.send('Input.dispatchKeyEvent', {'type': t, 'key': k, 'code': code or k, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk, 'text': text if t == 'keyDown' else ''})


async def log_since(c, n0=0):
    return await c.ev(f'SND.log.slice({n0})', False)


def kinds(log):
    out_ = {}
    for e in log:
        k = e['kind']
        d = out_.setdefault(k, {'calls': 0, 'played': 0})
        d['calls'] += 1
        if e.get('played'):
            d['played'] += 1
    return out_


AUTO_BOT = "(k, info) => (k === 'line' ? undefined : 0)"


async def task_gate(c):
    r = {}
    await c.open(f'/v4/index.html?snd=log&seed=7&sc={int(time.time())}')
    await asyncio.sleep(1.5)
    r['before_input'] = await st(c)                                      # 타이틀 — 아직 입력 없음
    await c.key('Escape', 'keyDown'); await c.key('Escape', 'keyUp')    # Esc 는 사용자 활성화가 아니다
    await asyncio.sleep(0.3)
    r['after_esc'] = await st(c)
    await click(c)                                                       # 패널 빈 곳 클릭 = 첫 입력
    await asyncio.sleep(0.8)
    r['after_click'] = await st(c)
    await c.ev(f'__ds4.setBot({AUTO_BOT})', False)
    n0 = len(await c.ev('SND.log', False))
    await c.key(' ', 'keyDown'); await c.key(' ', 'keyUp')              # 타이틀 '새로 시작' — 선택 확정 소리
    await c.wait("window.__ds4 && __ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.isOpen()", 60)
    await asyncio.sleep(0.5)
    # 걷기 (전동차 쇠 바닥): → 를 1.2초 누른다
    await c.key('ArrowRight', 'keyDown'); await asyncio.sleep(1.2); await c.key('ArrowRight', 'keyUp')
    await asyncio.sleep(0.6)
    for oid in ('medkit', 'bag', 'lever'):                                # 조사 → 사건 → 열기(덜컥·지퍼·레버)
        await c.ev(f'__ds4.use({json.dumps(oid)}).then(() => __ds4.idle())', True)
        await asyncio.sleep(0.6)
    lg = await log_since(c, n0)
    r['kinds_play'] = kinds(lg)
    r['open_ids'] = [e.get('ids') for e in lg if e['kind'] == 'open']
    r['inspect_ids'] = [e.get('id') for e in lg if e['kind'] == 'inspect']
    r['steps'] = [e.get('surface') for e in lg if e['kind'] == 'step']
    # M 키: 끄기 → 켜기
    await tap(c, 'm', 'KeyM', 77, 'm'); await asyncio.sleep(1.0)
    r['after_m_off'] = await st(c)
    await tap(c, 'm', 'KeyM', 77, 'm'); await asyncio.sleep(0.8)
    r['after_m_on'] = await st(c)
    # 멈춤 메뉴(Esc): 크기 보통 → 크게, 끄기 → 켜기 — 고를 때마다 메뉴로 돌아온다 · 옵션 글을 남긴다
    await c.ev("""(() => { window.__pause = []; let n = 0; __ds4.setBot((k, info) => {
        if (k !== 'pause') return k === 'line' ? undefined : 0;
        window.__pause.push(info.options.map((o) => o.label)); n++;
        if (n === 1) return info.options.findIndex((o) => o.value === 'snd:level');
        if (n === 2 || n === 3) return info.options.findIndex((o) => o.value === 'snd:onoff');
        return info.options.findIndex((o) => o.value === 'go'); }); })()""", False)
    await c.key('Escape', 'keyDown'); await c.key('Escape', 'keyUp')
    await asyncio.sleep(2.0)
    r['pause_menus'] = await c.ev('window.__pause', False)
    r['stored'] = await c.ev("localStorage.getItem('darkstation.v4.sound')", False)
    r['after_menu'] = await st(c)
    await c.ev(f'__ds4.setBot({AUTO_BOT})', False)
    # 탭 숨김 → 줄이고 멈춘다 → 다시 보이면 이어서 (visibilityState 를 흉내 낸다)
    await c.ev("Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))", False)
    await asyncio.sleep(1.3)
    r['hidden'] = await st(c)
    await c.ev("Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))", False)
    await asyncio.sleep(1.5)
    r['visible_again'] = await st(c)
    # 멈춤 메뉴 그림 (소리 두 줄이 붙은 모습): 봇을 떼고 Esc → 찍고 → Esc
    await c.ev('__ds4.setBot(null)', False)
    await c.key('Escape', 'keyDown'); await c.key('Escape', 'keyUp')
    await asyncio.sleep(0.8)
    await c.shot(out('sound_pause_menu.png'))
    r['pause_menu_png'] = os.path.relpath(out('sound_pause_menu.png'), ROOT)
    await asyncio.sleep(0.5)
    await c.key('Escape', 'keyDown'); await c.key('Escape', 'keyUp')
    await asyncio.sleep(0.5)
    r['console_errors'] = c.errors()
    b, a = r['before_input'], r['after_click']
    kp = r['kinds_play']
    r['checks'] = {
        'no_context_before_input': b['ac'] == 0 and b['snd']['ctx'] is None,
        'esc_is_not_input': r['after_esc']['ac'] == 0,
        'one_context_after_click': a['ac'] == 1 and a['snd']['ctx'] == 'running',
        'nodes_created': a['snd']['nodes'] > 20,
        'pick_sound': kp.get('pick', {}).get('played', 0) >= 1,
        'metal_steps': r['steps'].count('metal') >= 2,
        'open_sounds': sum(kp.get('open', {}).values()) > 0 and kp['open']['played'] >= 2,
        'm_toggles': (not r['after_m_off']['snd']['on']) and r['after_m_on']['snd']['on'],
        'menu_level_and_onoff': bool(r['pause_menus']) and any('소리 크기 — 크게' in x for m in r['pause_menus'] for x in m) and r['after_menu']['snd']['on'] and r['after_menu']['snd']['level'] == 2,
        'saved_to_localStorage': bool(r['stored']) and json.loads(r['stored']).get('level') == 2,
        'hidden_quiets': r['hidden']['snd']['hidden'] and r['hidden']['snd']['ctx'] == 'suspended',
        'visible_resumes': (not r['visible_again']['snd']['hidden']) and r['visible_again']['snd']['ctx'] == 'running',
        'console_errors_0': not r['console_errors'],
    }
    RES['gate'] = r


async def task_plain(c):
    # 실제로 들리는 길(?snd 없음 — 출력 1, 기록 없음): 첫 클릭 → 새로 시작 → 걷기·조사·열기 → 소리 켜짐·크기·콘솔 오류 0
    r = {}
    await c.open(f'/v4/index.html?seed=7&nocache={int(time.time())}')   # sc= 는 캡처 표시라 쓰지 않는다
    await asyncio.sleep(1.2)
    r['before'] = await st(c)
    await click(c)
    await c.ev(f'__ds4.setBot({AUTO_BOT})', False)
    await c.key(' ', 'keyDown'); await c.key(' ', 'keyUp')
    await c.wait("window.__ds4 && __ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.isOpen()", 60)
    await c.key('ArrowRight', 'keyDown'); await asyncio.sleep(1.0); await c.key('ArrowRight', 'keyUp')
    for oid in ('medkit', 'lever'):
        await c.ev(f'__ds4.use({json.dumps(oid)}).then(() => __ds4.idle())', True)
    await asyncio.sleep(1.5)
    r['after'] = await st(c)
    r['console_errors'] = c.errors()
    r['console_warnings'] = [x for x in c.console if x.startswith('warning')][:5]
    a = r['after']['snd']
    r['checks'] = {'no_context_before': r['before']['ac'] == 0, 'running_after': r['after']['ac'] == 1 and a['ctx'] == 'running' and a['master'] > 0.4 and not a['broken'],
                   'console_errors_0': not r['console_errors']}
    RES['plain'] = r


async def drive(c, x, y):
    await c.ev(f'__ds4.goto({x}, {y})', True)
    await asyncio.sleep(0.4)


async def meter(c, secs=1.2):
    vals = []
    t0 = time.time()
    while time.time() - t0 < secs:
        m = await c.ev('SND.meter()', False)
        if m:
            vals.append(m)
        await asyncio.sleep(0.05)
    if not vals:
        return None
    return {'rms_max': max(v['rms'] for v in vals), 'rms_med': sorted(v['rms'] for v in vals)[len(vals) // 2], 'peak_max': max(v['peak'] for v in vals)}


async def task_walk(c):
    r = {}
    await c.open(f'/v4/index.html?snd=log&auto=arrive&seed=7&sc={int(time.time())}')   # fast 없이: 진짜 걷기 박자
    await c.wait("window.SND && SND.log.some((e) => e.kind === 'start')", 30)
    for _ in range(600):
        if any('[ds4 auto] arrive' in x for x in c.console):
            break
        await asyncio.sleep(0.3)
    await c.ev(f'__ds4.setBot({AUTO_BOT})', False)
    await c.ev('__ds4.idle()', True)
    await asyncio.sleep(0.5)
    pts = {}
    # 승강장: 콘크리트(,) → 끝선(=) → 선로 자갈(~) → 개찰 통로(d) → 대합실 타일(.) → 화로 앞 → 계단 곁 → 배수로 통로 곁
    route = [('platform', 3, 11), ('edge', 3, 12), ('track', 6, 13), ('gate', 8, 8), ('concourse', 7, 5), ('far', 25, 5), ('stairs', 3, 3), ('fire', 13, 12), ('drain_exit', 26, 12)]
    for name, x, y in route:
        await drive(c, x, y)
        pts[name] = {'pos': await c.ev('[__ds4.scene.px, __ds4.scene.py]', False), 'amb': (await st(c))['snd']['amb'], 'meter': await meter(c, 1.0)}
    lg = await c.ev('SND.log', False)
    steps = [e.get('surface') for e in lg if e['kind'] == 'step']
    r['steps_by_surface'] = {s: steps.count(s) for s in sorted(set(steps))}
    r['points'] = pts
    r['status'] = (await st(c))['snd']
    r['amb_changes'] = [e for e in lg if e['kind'] == 'amb']
    r['console_errors'] = c.errors()
    # 걸음 박자: 이어 걸은 걸음 사이 간격 (한 칸 230ms 에 한 걸음)
    ts = [e['t'] for e in lg if e['kind'] == 'step']
    gaps = [b - a for a, b in zip(ts, ts[1:]) if 150 < b - a < 400]
    r['step_gap_ms'] = {'n': len(gaps), 'median': sorted(gaps)[len(gaps) // 2] if gaps else None}
    p = pts
    r['checks'] = {
        'surfaces': all(r['steps_by_surface'].get(s, 0) > 0 for s in ('metal', 'gravel', 'tile', 'concrete', 'edge')),
        'step_per_tile': bool(gaps) and 200 <= r['step_gap_ms']['median'] <= 260,
        'fire_by_distance': p['fire']['amb']['fire'] > 0.5 and p['far']['amb']['fire'] < 0.05,
        'stairs_hiss_near': p['stairs']['amb']['hiss'] > 0.2 and p['far']['amb']['hiss'] == 0,
        'drain_water_near': p['drain_exit']['amb']['water'] > 0.05 and p['fire']['amb']['water'] == 0,
        'signal_present': bool(p['fire']['meter']) and p['fire']['meter']['rms_max'] > -70,
        'console_errors_0': not r['console_errors'],
    }
    RES['walk'] = r


async def wait_report(c, key, limit=900):
    t0 = time.time()
    while time.time() - t0 < limit:
        hit = [x for x in c.console if f'[ds4 auto] {key} ' in x]
        if hit:
            return hit[-1]
        await asyncio.sleep(0.5)
    return None


async def task_run(c):
    r = {}
    seeds = [3, 21, 6, 8]
    for sd in seeds:                                                      # shot.py run 과 같은 시드 순서 — D10 결말에 닿는 판을 쓴다 (줄타기 판이라 봇이 D10 전에 죽을 수도 있다 — 그래도 D9 넘게 간 판이면 소리 확인에는 충분)
        await c.open(f'/v4/index.html?fast=1&auto=run&seed={sd}&snd=log&sc={int(time.time())}')
        rep = await wait_report(c, 'run', 900)
        m = re.search(r' D(\d+) ', rep or '')
        r.setdefault('tries', []).append({'seed': sd, 'day': int(m.group(1)) if m else -1, 'report': (rep or '')[:240]})
        if r['tries'][-1]['day'] >= 9:
            break
    lg = await c.ev('SND.log', False)
    r['seed'] = sd
    r['kinds'] = kinds(lg)
    r['event_hook_ids'] = sorted({e.get('id') for e in lg if e['kind'] == 'event'})
    r['event_sounds'] = [{'id': e.get('id'), 'sound': e.get('sound')} for e in lg if e['kind'] == 'event_sound']
    r['open_ids'] = sorted({e.get('ids') for e in lg if e['kind'] == 'open'})
    r['inspect_ids'] = sorted({e.get('id') for e in lg if e['kind'] == 'inspect'})
    r['amb_changes'] = [{k: e[k] for k in ('map', 'night', 'amb', 'fire', 'water')} for e in lg if e['kind'] == 'amb']
    r['status'] = (await st(c))['snd']
    r['console_errors'] = c.errors()
    # 사건 창에 붙은 소리: 본문이 지직·두드림을 말하는 사건 (SND.play('event') 가 부른 사건 id — 소리가 실제로 난 것은 played)
    k = r['kinds']
    r['checks'] = {
        'ran_to_D9_or_more': r['tries'][-1]['day'] >= 9,
        'nodes_created': r['status']['nodes'] > 500,
        'pick': k.get('pick', {}).get('played', 0) > 20,
        'roll_ok_or_fail': k.get('ok', {}).get('played', 0) + k.get('fail', {}).get('played', 0) > 0,
        'inspect': k.get('inspect', {}).get('played', 0) > 5,
        'open': k.get('open', {}).get('played', 0) > 0,
        'event_hook': k.get('event', {}).get('calls', 0) > 10,
        'broadcast_static': any(e['sound'].startswith('radio') for e in r['event_sounds']),
        'hurt': k.get('hurt', {}).get('played', 0) > 0,
        'bubble': k.get('bubble', {}).get('played', 0) > 0,
        'night_ambience': any(a['night'] for a in r['amb_changes']) and any(not a['night'] and a['map'] == 'station' for a in r['amb_changes']),
        'trip_water': any(a['water'] > 0.1 for a in r['amb_changes'] if a['map'] != 'station'),
        'trip_furniture_open': any(re.match(r'(locker|drawer|barrel|toolbox|shelf|crate|bag)_', i or '') for i in r['open_ids']),   # (10-25 P1-11) 원정 지도 수납을 열 때 여는 소리        'console_errors_0': not r['console_errors'],
    }
    RES['run'] = r


async def task_death(c):
    r = {}
    await c.open(f'/v4/index.html?fast=1&auto=death&seed=7&snd=log&sc={int(time.time())}')
    rep = await wait_report(c, 'death', 600)
    r['report'] = (rep or '')[:240]
    await asyncio.sleep(3.0)
    lg = await c.ev('SND.log', False)
    r['death_calls'] = [e for e in lg if e['kind'] == 'death']
    r['after_death_blocked'] = kinds([e for e in lg if e['t'] > (r['death_calls'][0]['t'] if r['death_calls'] else 1e18)])
    r['status'] = (await st(c))['snd']
    r['meter_after'] = await meter(c, 1.0)
    r['console_errors'] = c.errors()
    r['checks'] = {
        'reached': bool(rep and 'reached=1' in rep),
        'death_played': any(e.get('played') for e in r['death_calls']),
        'hush_on': r['status']['deathHush'] and r['status']['amb'] and r['status']['amb']['amb'] == 0,
        'console_errors_0': not r['console_errors'],
    }
    RES['death'] = r


async def task_knock(c):
    # D1 낮 셔터 너머 두드림 (fast 없이 — 지도 위 두드림 박자 2.6초에 세 번): 봇이 셔터 앞 (2,7)에 서서 말풍선을 기다린 뒤 손을 뗀다 → 몇 초 더 듣는다
    r = {}
    await c.open(f'/v4/index.html?auto=shutter1&seed=7&snd=log&sc={int(time.time())}')
    rep = await wait_report(c, 'shutter1', 900)
    r['report'] = (rep or '')[:240]
    await asyncio.sleep(6.0)
    lg = await c.ev('SND.log', False)
    kn = [e for e in lg if e['kind'] == 'knock' and e.get('one')]
    r['frame_knocks'] = {'n': len(kn), 'played': sum(1 for e in kn if e.get('played')), 'v': sorted({e.get('v') for e in kn})}
    ts = [e['t'] for e in kn]
    r['knock_gaps_ms'] = [b - a for a, b in zip(ts, ts[1:])][:12]
    r['bubbles'] = sum(1 for e in lg if e['kind'] == 'bubble' and e.get('played'))
    r['console_errors'] = c.errors()
    r['checks'] = {
        'reached': bool(rep and 'reached=1' in rep),
        'knocks_on_beat': r['frame_knocks']['played'] >= 6 and all(any(abs(g - x) < 60 for x in (330, 1940)) for g in r['knock_gaps_ms']),
        'bubble_tick': r['bubbles'] > 0,
        'console_errors_0': not r['console_errors'],
    }
    RES['knock'] = r


async def task_parity(c):
    # 소리가 판을 바꾸지 않는가: 같은 시드의 봇 판(?fast=1&auto=run — 캡처 모드라 소리는 무음)을 sound.js 를 읽은 판 / 막은 판으로 두 번 돌려 봇 기록·끝 상태를 비교한다
    r = {}
    runs = {}
    for name, blocked in (('with_sound_js', []), ('without_sound_js', ['*sound.js*'])):
        await c.send('Network.enable')
        await c.send('Network.setBlockedURLs', {'urls': blocked})
        await c.open(f'/v4/index.html?fast=1&auto=run&seed=3&sc={int(time.time())}')
        rep = await wait_report(c, 'run', 900)
        runs[name] = {'report': (rep or '')[:200], 'snd': await c.ev('typeof window.SND', False),
                      'autoLog': await c.ev('__ds4.autoLog.slice()', False),
                      'end': await c.ev('(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, ended: s.ended && s.ended.why, world: s.world, people: Object.fromEntries(Object.values(s.people).map((p) => [p.id, p.status])), flags: Object.keys(s.flags).filter((k) => s.flags[k] === true).length, log: s.log.length }; })()', False)}
    await c.send('Network.setBlockedURLs', {'urls': []})
    a, b = runs['with_sound_js'], runs['without_sound_js']
    r['with'] = {k: a[k] for k in ('report', 'snd', 'end')}
    r['without'] = {k: b[k] for k in ('report', 'snd', 'end')}
    r['autolog_len'] = [len(a['autoLog']), len(b['autoLog'])]
    r['checks'] = {'sound_js_loaded_vs_blocked': a['snd'] == 'object' and b['snd'] == 'undefined',
                   'same_bot_log': a['autoLog'] == b['autoLog'] and len(a['autoLog']) > 20, 'same_end_state': a['end'] == b['end']}
    RES['parity'] = r


async def task_capture(c):
    r = {}
    await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
    await wait_report(c, 'car', 120)
    await click(c); await tap(c, 'z', 'KeyZ', 90, 'z')
    await asyncio.sleep(1.0)
    r['status'] = await st(c)
    r['console_errors'] = c.errors()
    r['checks'] = {'silent_no_context': r['status']['ac'] == 0 and r['status']['snd']['off'] and r['status']['snd']['ctx'] is None, 'console_errors_0': not r['console_errors']}
    RES['capture'] = r


SFX = [('step', {'surface': 'tile'}), ('step', {'surface': 'concrete'}), ('step', {'surface': 'edge'}), ('step', {'surface': 'metal'}), ('step', {'surface': 'gravel'}),
       ('step', {'surface': 'water'}), ('step', {'surface': 'wet'}), ('inspect', {'id': 'blanket_mari'}), ('inspect', {'id': 'crate_food'}), ('inspect', {'id': 'medkit'}),
       ('inspect', {'id': 'notebook_you'}), ('inspect', {'id': 'bottle_you'}), ('inspect', {'id': 'bowl_you'}), ('inspect', {'id': 'stairs_ash'}), ('inspect', {'id': 'fire'}),
       ('inspect', {'id': 'speaker', 'st': 'on'}), ('open', {'ids': ['crate_food']}), ('open', {'ids': ['bag']}), ('open', {'ids': ['medkit']}), ('open', {'ids': ['lever']}),
       ('open', {'ids': ['pharmacy_shutter']}), ('open', {'ids': ['valve']}),
       ('open', {'ids': ['locker_a1']}), ('open', {'ids': ['drawer_a1']}), ('open', {'ids': ['barrel_b1']}), ('open', {'ids': ['shelf_a1']}), ('open', {'ids': ['toolbox_b2']}),   # (10-25) 원정 수납 가구
       ('inspect', {'id': 'locker_a1'}), ('inspect', {'id': 'drawer_a1'}), ('pick', {}), ('pick', {'danger': True}), ('ok', {}), ('ok', {'close': True}), ('fail', {}),
       ('hurt', {}), ('death', {}), ('bubble', {}), ('knock', {}), ('knock', {'one': True, 'v': 0.4}), ('radio', {}), ('radio', {'long': True}), ('event', {'id': 'd7_broadcast'})]
SEC = {'death': 3.4, 'radio': 3.4, 'event': 3.4, 'ok': 1.6, 'fail': 1.5, 'hurt': 1.7, 'open': 1.4}


def wav(path, pcm16_bytes, sr):
    # 들어 보기용 견본: 스테레오 48kHz 를 모노 24kHz 로 줄여 쓴다 (두 채널 평균 → 이웃 두 샘플 평균 → 하나 걸러) — 파일 크기 1/4
    n = len(pcm16_bytes) // 4
    st_ = struct.unpack(f'<{n * 2}h', pcm16_bytes[:n * 4])
    mono = [(st_[2 * i] + st_[2 * i + 1]) / 2 for i in range(n)]
    half = [int(max(-32768, min(32767, (mono[i] + mono[i + 1]) / 2))) for i in range(0, n - 1, 2)]
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr // 2); w.writeframes(struct.pack(f'<{len(half)}h', *half))


async def task_loud(c):
    r = {'sfx': [], 'amb': []}
    await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')   # 캡처 모드(무음)여도 오프라인 그리기는 된다
    await wait_report(c, 'car', 120)
    sheet, sr = [], 48000
    for kind, o in SFX:
        sec = SEC.get(kind, 1.0)
        row = {'kind': kind, 'o': o}
        for lv in (0, 1, 2):
            v = await c.ev(f'SND._offline({json.dumps(kind)}, {json.dumps(o)}, {sec}, {lv}, {"true" if lv == 1 else "false"})', True)
            row[['small', 'normal', 'large'][lv]] = {k: v[k] for k in ('peakDb', 'rmsDb', 'loudest50msDb')}
            if lv == 1:
                sheet.append(base64.b64decode(v['pcm']))
                sheet.append(b'\x00' * int(sr * 0.45) * 4)
        r['sfx'].append(row)
    wav(out('sound_samples.wav'), b''.join(sheet), sr)
    # 앰비언트 장면: 지도·자리·밤 (보통 크기, 8초)
    scen = [('station_fire_day', 'station', 13, 12, 'trace', 'lit'), ('station_fire_night', 'station', 13, 12, 'night', 'lit'), ('station_far_day', 'station', 25, 5, 'day', 'lit'),
            ('station_stairs_night', 'station', 3, 3, 'night', 'low'), ('car', 'car', 5, 3, 'day', 'lit'), ('tunnel', 'tunnel', 8, 2, 'day', 'lit'), ('drain_b1', 'drain_b1', 4, 3, 'day', 'lit'),
            ('mall_a1', 'mall_a1', 5, 4, 'day', 'lit')]
    for name, mp, x, y, ph, fst in scen:
        expr = f"""(async () => {{ const m = __ds4.db.maps[{json.dumps(mp)}];
            return SND._offline('amb', {{ scene: {{ map: m, rows: m.rows, px: {x}, py: {y} }}, state: {{ phase: {json.dumps(ph)}, traces: {{ fire: {{ st: {json.dumps(fst)} }} }}, people: {{}} }} }}, 8, 1, {'true' if name in ('station_fire_day', 'station_fire_night', 'drain_b1') else 'false'}); }})()"""
        v = await c.ev(expr, True)
        r['amb'].append({'scene': name, **{k: v[k] for k in ('peakDb', 'rmsDb', 'loudest50msDb')}})
        if v.get('pcm'):
            wav(out(f'ambience_{name}.wav'), base64.b64decode(v['pcm']), sr)
    # 층별 (승강장 화로 앞 낮 · 보통): 웅웅거림 · 공기 · 화로 · 물(배수로) · 물방울 · 쉿(계단 밤)
    for layer, mp, x, y, ph in (('hum', 'station', 13, 12, 'day'), ('air', 'station', 13, 12, 'day'), ('fire', 'station', 13, 12, 'day'), ('water', 'drain_b1', 4, 3, 'day'),
                                ('drip', 'station', 13, 12, 'day'), ('hiss', 'station', 3, 3, 'night')):
        expr = f"""(async () => {{ const m = __ds4.db.maps[{json.dumps(mp)}];
            return SND._offline('amb', {{ only: {json.dumps(layer)}, scene: {{ map: m, rows: m.rows, px: {x}, py: {y} }}, state: {{ phase: {json.dumps(ph)}, traces: {{ fire: {{ st: 'lit' }} }}, people: {{}} }} }}, 12, 1, false); }})()"""
        v = await c.ev(expr, True)
        r.setdefault('layers', []).append({'layer': layer, **{k: v[k] for k in ('peakDb', 'rmsDb', 'loudest50msDb')}})
    r['console_errors'] = c.errors()
    pk = [x['normal']['peakDb'] for x in r['sfx']]
    pk_large = [x['large']['peakDb'] for x in r['sfx']]
    am = [a['rmsDb'] for a in r['amb']]
    r['summary'] = {'sfx_peak_normal_max': max(pk), 'sfx_peak_large_max': max(pk_large), 'amb_rms_normal_range': [min(am), max(am)]}
    r['checks'] = {
        'sfx_not_loud': max(pk) <= -10 and max(pk_large) <= -6,                    # 보통에서 가장 큰 소리(죽음)도 −10 dBFS 아래 · 크게에서도 −6 아래
        'amb_quiet': max(am) <= -30 and min(am) >= -60,                            # 앰비언트는 들리되 작게 (RMS −60 ~ −30 dBFS)
        'all_render': all(x['normal']['peakDb'] > -80 for x in r['sfx']),
        'console_errors_0': not r['console_errors'],
    }
    RES['loud'] = r


async def amain(tasks):
    httpd = S.serve()
    prof = out('.profile')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([S.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             '--autoplay-policy=no-user-gesture-required', f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'],
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
        async with S.websockets.connect(ws_url, max_size=None) as ws:
            c = S.CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': AC_COUNT})
            for t in tasks:
                t0 = time.time()
                try:
                    await globals()['task_' + t](c)
                except BaseException as e:
                    RES[t] = {'error': repr(e)[:400], 'console': c.console[-20:]}
                print(f'{t}: {time.time() - t0:.0f}s', json.dumps(RES.get(t, {}).get('checks', RES.get(t, {}).get('error')), ensure_ascii=False))
    finally:
        proc.terminate()
        httpd.shutdown()
        time.sleep(1)
        shutil.rmtree(prof, ignore_errors=True)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    global OUTD
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if opts.get('out'):
        OUTD = opts['out'] if os.path.isabs(opts['out']) else os.path.join(ROOT, opts['out'])
    tasks = args or ['gate', 'plain', 'walk', 'knock', 'run', 'death', 'capture', 'parity', 'loud']
    asyncio.run(amain(tasks))
    path = out('sound_check.json')
    old = {}
    if os.path.exists(path) and args:
        try:
            old = json.load(open(path, encoding='utf-8'))
        except ValueError:
            old = {}
    old.update(RES)
    json.dump(old, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    lines = []
    for t, r in old.items():
        ch = r.get('checks') or {}
        bad = [k for k, v in ch.items() if not v]
        lines.append(f'{t:8s} {"OK  " if ch and not bad else "FAIL"} {len(ch) - len(bad)}/{len(ch)}' + (' - ' + ', '.join(bad) if bad else '') + (f' ERROR {r["error"]}' if r.get('error') else ''))
    open(out('sound_check.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
