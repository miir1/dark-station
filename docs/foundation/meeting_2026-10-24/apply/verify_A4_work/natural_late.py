# verify_A4 — 못 본 밤의 '실제 화면 진행' 확인 (게임 파일은 고치지 않는다 · 결과와 프로필은 이 폴더에만, 프로필은 끝나면 지운다)
# 시뮬 봇(아침 조사 0)이 만든 저장(nat_fix.json: 어젯밤 주민 사건이 있었고 아직 안 본 아침)에서 시작해,
#   ① 그 아침 지도를 찍고 ② 아무것도 조사하지 않고 화로로만 하루를 넘긴다(배식 전부·경고 없는 선택) — 밤 보고 글을 모은다
#   ③ 다음 아침: 엔진 late 흔적·지도 먼지(objectsOnMap().late)·방치 판정 줄을 읽고 찍는다 ④ 먼지 난 물건을 조사 → 토스트·_late 글을 찍는다
# python natural_late.py [이름,…]   (C:\dev\dark_station 에서)
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC  # noqa: E402
import websockets  # noqa: E402

SC.OUTD = HERE
SC.PORT, SC.DBG = 18841, 19581
FIX = json.load(open(os.path.join(HERE, 'nat_fix.json'), encoding='utf-8'))
SC.FIXTURES.update(FIX)

# 게으른 사람 봇: 줄은 넘기며 모은다, 사건 = 경고·판정 없는 첫 열린 선택(없으면 첫 열린 것), 배식 = 전부, 화로 = 넘긴다, 수첩·붕대·원정 = 안 한다
LAZY_BOT = r"""((holdDay) => { window.__seen = []; window.__events = []; __ds4.setBot((k, info) => {
  const st = __ds4.state;
  if (k === 'line') { window.__seen.push({ day: st.day, phase: st.phase, text: info.text, name: info.opts && info.opts.name || '', black: !!(info.opts && info.opts.black) }); return undefined; }
  if (k === 'event') { if (holdDay != null && st.day >= holdDay) { window.__heldEvent = { day: st.day, phase: st.phase, id: st.pending && st.pending.id }; return 'hold'; }
    const o = info.options; let i = o.findIndex((x) => !x.disabled && !/warn|chance/.test(String(x.subRaw || ''))); if (i < 0) i = o.findIndex((x) => !x.disabled);
    window.__events.push({ day: st.day, phase: st.phase, id: st.pending && st.pending.id, pick: o[i] && o[i].label }); return i; }
  if (k === 'confirm2') return 0;
  if (k === 'fire') return 0;
  if (k === 'ration') return info.options.length - 1;
  if (k === 'trip' || k === 'write' || k === 'deeper') return 1;
  if (k === 'tend' || k === 'treat' || k === 'board') return info.options.length - 1;
  if (k === 'title' || k === 'death_ledger' || k === 'ending') return 'hold';
  return undefined; }); return 1; })"""

STATE_JS = r"""(() => { const D = __ds4, s = D.state, prev = s.day - 1;
  return { day: s.day, phase: s.phase, ended: s.ended ? s.ended.why : null, pending: s.pending ? s.pending.id : null, open: D.UI.openKind(),
    world: { food: s.world.food, water: s.world.water, meds: s.world.meds },
    lateTraces: Object.entries(s.traces).filter(([, t]) => t.late).map(([id, t]) => ({ id, st: t.st, day: t.day, seen: t.seen })),
    dust: D.objectsOnMap().filter((o) => o.late).map((o) => ({ id: o.id, x: o.x, y: o.y, name: o.name })),
    neglect: s.nightLog.filter((e) => e.role === 'neglect' && e.day === prev).map((e) => ({ id: e.id, actor: e.actor, target: e.target, traces: e.traces })),
    night: s.nightLog.filter((e) => e.role !== 'neglect' && e.day === prev).map((e) => e.id),
    notice: s.notice || null, noticeDay: s.noticeDay == null ? null : s.noticeDay,
    people: Object.values(s.people).filter((p) => p.id !== 'you').map((p) => ({ id: p.id, status: p.status, grudge: p.n.grudge || 0, hunger: p.n.hunger || 0, thirst: p.n.thirst || 0 })),
    flags: Object.keys(s.flags).filter((f) => /^unseen_|dawn_strike|dawn_mob/.test(f) && s.flags[f]) }; })()"""


async def idle(c, limit=60):
    await SC.until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", limit)


async def safe(coro, r, key):
    try:
        return await coro
    except BaseException as e:
        r.setdefault('shot_errors', []).append(f'{key}: {str(e)[:160]}')
        return None


async def zoom_obj(c, name, x, y, r=3, k=4):
    await SC.ap_zoom(c, name, max(0, x - r), max(0, y - r), x + r + 1, y + r + 1, k)


async def run_one(c, name, res):
    r = {'name': name}
    d0 = FIX[name]['day']
    await c.open(f'/v4/index.html?fast=1&auto=xnatural&state=/__fixture/{name}.json&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot", 90)
    await c.ev(LAZY_BOT + '(null)', False)
    await idle(c)
    await asyncio.sleep(0.4)
    r['morning0'] = await c.ev(STATE_JS, False)
    await safe(SC.app_shot(c, SC.out(f'verify_A4_{name}_1_morning_D{d0}.png')), r, 'm0')
    # 하루를 조사 없이 넘긴다: 화로만
    guard = 0
    while guard < 30:
        guard += 1
        st = await c.ev("({ day: __ds4.state.day, phase: __ds4.state.phase, ended: !!__ds4.state.ended, open: __ds4.UI.openKind() })", False)
        if st['ended'] or (st['day'] == d0 + 1 and st['phase'] == 'trace' and not st['open']):
            break
        if st['open']:
            await asyncio.sleep(0.3)
            continue
        await c.ev("__ds4.use('fire')", True)
        await asyncio.sleep(0.2)
    await idle(c)
    await asyncio.sleep(0.5)
    r['lines_during_day'] = await c.ev('window.__seen', False)
    r['events_during_day'] = await c.ev('window.__events', False)
    r['morning1'] = await c.ev(STATE_JS, False)
    m1 = r['morning1']
    await safe(SC.app_shot(c, SC.out(f'verify_A4_{name}_2_morning_D{m1["day"]}_app.png')), r, 'm1')
    await safe(SC.stage_shot(c, SC.out(f'verify_A4_{name}_2b_morning_D{m1["day"]}_stage.png')), r, 'm1s')
    for i, dd in enumerate(m1['dust'][:3]):
        await safe(zoom_obj(c, f'verify_A4_{name}_3_dust_{dd["id"]}.png', dd['x'], dd['y']), r, 'zoom')
    # 먼지 난 물건 하나를 조사 → 첫 줄에서 멈춰 토스트·글을 찍는다
    tgt = os.environ.get('A4_TARGET') or (m1['dust'][0]['id'] if m1['dust'] else None)
    if tgt:
        await c.ev(r"""(() => { window.__seen2 = []; window.__held = 0; __ds4.setBot((k, info) => {
          if (k === 'line') { window.__seen2.push(info.text); if (!window.__held) { window.__held = 1; return 'hold'; } return undefined; }
          if (k === 'tend' || k === 'write') return info.options.length - 1; if (k === 'event') return 'hold'; return undefined; }); return 1; })()""", False)
        await c.ev(f"__ds4.use('{tgt}'); 1", False)
        try:
            await SC.until(c, "window.__held === 1 && __ds4.UI.openKind() === 'line'", 20)
        except BaseException as e:
            r['inspect_error'] = str(e)[:200]
        await asyncio.sleep(0.3)
        r['inspect_box'] = await c.ev(SC.SP_BOX_JS, False)
        await safe(SC.stage_shot(c, SC.out(f'verify_A4_{name}_4_inspect_{tgt}.png')), r, 'insp')
        await c.ev(SC.PASS_BOT + "; __ds4.UI.key('ok'); 1", False)
        await SC.drive_lines(c, 20)
        r['inspect_lines'] = await c.ev('window.__seen2', False)
        r['inspect_log'] = await c.ev('__ds4.inspectLog', False)
        r['after_inspect'] = await c.ev(STATE_JS, False)
        await safe(SC.app_shot(c, SC.out(f'verify_A4_{name}_5_after_inspect.png')), r, 'after')
    r['console_errors'] = c.errors()
    key = name + ('_' + os.environ['A4_TARGET'] if os.environ.get('A4_TARGET') else '')
    res[key] = r
    print(key, 'D', d0, '→', m1['day'], m1['phase'], 'ended', m1['ended'], '| neglect', [n['id'] for n in m1['neglect']], '| late', m1['lateTraces'], '| dust', [d['id'] for d in m1['dust']],
          '| toast', (r.get('inspect_box') or {}).get('toast'), '| text', (r.get('inspect_box') or {}).get('text'), '| errs', r['console_errors'])


async def main(names):
    httpd = SC.serve()
    prof = os.path.join(HERE, '.profile')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = {}
    try:
        ws_url = None
        for _ in range(60):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{SC.DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
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
            for n in names:
                try:
                    await run_one(c, n, res)
                except BaseException as e:
                    res[n] = {'error': str(e)[:400], 'console_errors': c.errors()}
                    print(n, 'ERROR', str(e)[:300])
    finally:
        proc.terminate()
        time.sleep(1.0)
        httpd.shutdown()
        shutil.rmtree(prof, ignore_errors=True)
        jp = os.path.join(HERE, 'verify_A4_natural.json')
        old = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
        old.update(res)
        with open(jp, 'w', encoding='utf-8') as f:
            json.dump(old, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    names = sys.argv[1].split(',') if len(sys.argv) > 1 else list(FIX.keys())
    asyncio.run(main(names))
