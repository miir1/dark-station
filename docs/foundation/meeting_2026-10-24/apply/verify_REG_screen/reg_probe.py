# 검증용 탐침 (화면 명세 단계 적대적 검증): screen_check.py 의 CDP·도우미를 그대로 빌려, 주장 몇 가지를 실제 게임에서 따로 확인한다.
# 쓰기 (C:\dev\dark_station 에서): python -B docs/foundation/meeting_2026-10-24/apply/verify_REG_screen/reg_probe.py
# 결과: 이 폴더의 probe.json · probe_*.png. 게임 파일은 고치지 않는다.
import os, sys, json, asyncio, time, base64, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
_orig = subprocess.run
def _run(*a, **k):
    if a and isinstance(a[0], list) and any('fixture.js' in str(x) for x in a[0]):
        k['timeout'] = 3600
    return _orig(*a, **k)
subprocess.run = _run
import screen_check as sc
sc.PORT = int(os.environ.get('SC_PORT', '18991'))
sc.DBG = int(os.environ.get('SC_DBG', '19733'))
sc.OUTD = os.path.join(HERE, 'probe')

ADDR_JS = r"""((g) => { const D = __ds4, s = D.state, db = D.db, out = {};
  const ids = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari', 'eunchae', 'dohyeon'];
  if (g != null) for (const id of ids) if (s.people[id]) s.people[id].n.grudge = g;
  for (const id of ids) { const rows = [];
    for (const lid of Object.keys(db.lines)) { if (!lid.startsWith(id + '_') || lid === id + '_idle') continue;
      db.lines[lid].forEach((row) => rows.push([lid, row.speaker, D.withCall(id, row.text, row)])); }
    out[id] = { call: D.callOf(id), rows }; }
  return out; })"""

SPRITE_JS = r"""(() => { const ids = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari'], K = 4, cells = [];
  for (const id of ids) { const sid = ART.spriteId(id);
    const row = [ART.sitPose(id, 'up', 0), ART.bowed(ART.sitPose(id, 'up', 0), 2), ART.sitPose(id, 'left', 0), ART.bowed(ART.sitPose(id, 'left', 0), 2),
      ART.person(sid, 0, 0, 'up'), ART.bowed(ART.person(sid, 0, 0, 'up'), 3), ART.person(sid, 0, 0, 'right'), ART.bowed(ART.person(sid, 0, 0, 'right'), 3),
      ART.sleeper(id, 0), ART.sleeperBack(id, 0)];
    cells.push(row); }
  const cw = 48, ch = 64, cv = document.createElement('canvas'); cv.width = cw * 10 * K; cv.height = ch * ids.length * K;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#5a5248'; g.fillRect(0, 0, cv.width, cv.height);
  cells.forEach((row, r) => row.forEach((im, c) => { if (!im) return; g.drawImage(im, 0, 0, im.width, im.height, c * cw * K, r * ch * K + (ch - im.height) * K, im.width * K, im.height * K); }));
  return cv.toDataURL('image/png'); })()"""


async def task_probe(c, opts):
    res = {}
    def save():
        with open(os.path.join(HERE, 'probe.json'), 'w', encoding='utf-8') as fp:
            json.dump(res, fp, ensure_ascii=False, indent=1)
    # ── 1 호칭: D3 아침 판에서 사람마다 말 걸기 줄 전부 — 지금 원한 / 원한 6 (차가운 호칭) ──
    for attempt in range(3):
        try:
            await sc.goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
            break
        except BaseException as e:
            res.setdefault('goto_errors', []).append([str(e)[:200], c.errors()[:5]])
    try:
        res['addr_now'] = await c.ev(ADDR_JS + '(null)', False)
        res['addr_cold'] = await c.ev(ADDR_JS + '(6)', False)
        # ── 2 등 돌림 그림: 앉기(위·왼)·서기(위·오른) 원래 / 숙임, 잠 / 뒤통수 ──
        url = await c.ev(SPRITE_JS, False)
        with open(os.path.join(HERE, 'probe_sprites.png'), 'wb') as f:
            f.write(base64.b64decode(url.split(',')[1]))
    except BaseException as e:
        res['addr_error'] = str(e)[:300]
    save()
    # ── 3 토스트는 그날 한 번: 못 본 흔적 둘을 만들고 두 번 조사 ──
    try:
        await sc.normal_speed(c)
        await c.ev(sc.PASS_BOT, False)
        await c.ev(sc.SP_SIGNS_JS + "({}, [['bowl_eunji', 'empty', 1], ['blanket_gicheol', 'rolled', 1]])", False)
        res['late_before'] = await c.ev("__ds4.objectsOnMap().filter((o) => o.late).map((o) => o.id)", False)
        t1 = await sc.ap_inspect(c, 'bowl_eunji')
        t2 = await sc.ap_inspect(c, 'blanket_gicheol')
        await asyncio.sleep(0.3)
        res['late_inspect'] = {'bowl': t1, 'blanket': t2, 'log': await c.ev('__ds4.inspectLog', False),
                               'late_after': await c.ev("__ds4.objectsOnMap().filter((o) => o.late).map((o) => o.id)", False),
                               'dust_after': await c.ev("(RENDER.last && RENDER.last.dust || []).map((d) => d.id)", False)}
    except BaseException as e:
        res['late_error'] = str(e)[:300]
    save()
    # ── 4 진짜 '이어 하기': 배식 단계 저장(repay_bowl·share_back 이 걸린 순간)을 localStorage 에 두고 새로 열어 타이틀의 '계속' ──
    for ev in ('repay_bowl', 'share_back'):
        r = {}
        try:
            await c.open(f'/v4/index.html?fast=1&sc={int(time.time())}')
            await c.wait("__ds4.db && __ds4.UI.openKind() === 'title'", 60)
            await c.ev(f"(async () => {{ const s = await (await fetch('/__fixture/{ev}.json')).json(); __ds4.store().save(s); return 1; }})()", True)
            await c.open(f'/v4/index.html?fast=1&sc={int(time.time())}r')
            await c.wait("__ds4.db && __ds4.UI.openKind() === 'title'", 60)
            r['title_opts'] = await c.ev("[...document.querySelectorAll('#box .opt')].map((b) => b.textContent)", False)
            await c.ev(r"""(() => { window.__seen = []; window.__kinds = []; __ds4.setBot((k, info) => { window.__kinds.push(k);
              if (k === 'line') { window.__seen.push(info.text); return undefined; }
              if (k === 'event') return 0;
              if (k === 'ration') return 'hold';
              return undefined; }); return 1; })()""", False)
            await c.ev("__ds4.UI.pick(0); 1", False)
            ok = await sc.until(c, "__ds4.UI.openKind() === 'ration'", 40)
            r['reached_ration_window'] = ok
            r['kinds'] = await c.ev('window.__kinds', False)
            r['seen'] = await c.ev('window.__seen', False)
            r['state'] = await c.ev("({ day: __ds4.state.day, phase: __ds4.state.phase, pending: __ds4.state.pending && __ds4.state.pending.id, open: __ds4.UI.openKind() })", False)
            await sc.stage_shot(c, os.path.join(HERE, f'probe_resume_{ev}.png'))
        except BaseException as e:
            r['error'] = str(e)[:300]
        r['console_errors'] = c.errors()
        res['resume_' + ev] = r
    save()
    # ── 5 내 spec 돌림에서 CPU 혼잡으로 기다리다 끊긴 사건(dawn_mob·d10_grab·repay_bowl)을 다시 — screen_check 의 sp_shot_events 그대로 ──
    sc.SPEC_EVENTS = ['dawn_mob', 'd10_grab', 'repay_bowl']
    evres = {}
    try:
        await sc.sp_shot_events(c, evres)
    except BaseException as e:
        evres['error'] = str(e)[:300]
    res['events_rerun'] = evres
    save()
    # ── 6 그림 숨김(NOART) 밤 + 등 돌림·먼지 / 7 표 행 빠짐 토스트 — screen_check spec 6·7 과 같은 방식 (내 spec 돌림이 CPU 혼잡으로 6에서 끊겼다) ──
    try:
        ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': sc.NOART_JS}))['identifier']
        try:
            await sc.goto_point(c, 'beds', "__ds4.state.day === 2 && __ds4.state.phase === 'night'")
            await sc.normal_speed(c)
            res['6_noart_night'] = await c.ev(sc.SP_SIGNS_JS + "({'soonrye': 5, 'gicheol': 4, 'mari': 3}, [['bowl_you', 'pushed', 0], ['blanket_gicheol', 'rolled', 1]])", False)
            await asyncio.sleep(0.5)
            await sc.ap_zoom(c, 'probe_noart_night.png', 9, 8, 23, 12, 3)
            res['6_noart_errors'] = c.errors()
        finally:
            await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    except BaseException as e:
        res['6_error'] = str(e)[:300]
    save()
    try:
        BAD = r'''(() => { const of = window.fetch.bind(window); window.fetch = (u, o) => of(u, o).then((r) => {
          if (!/data\/events\.json/.test(String(u))) return r;
          return r.json().then((list) => new Response(JSON.stringify(list.concat([{ id: 'zz_bad_row', kind: 'trial', when: 'day==99', text: 'x', choices: [] }])), { headers: { 'Content-Type': 'application/json' } })); }); })();'''
        ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': BAD}))['identifier']
        try:
            await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
            await c.wait('__ds4.state && __ds4.scene.map', 120)
            await asyncio.sleep(0.3)
            res['7_dropped'] = {'dropped': await c.ev('DS4.browser.dropped', False), 'toast': await c.ev("document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent", False),
                                'console': [x[:160] for x in c.console if '표 검증' in x], 'events_has_bad': await c.ev("!!__ds4.db.events.zz_bad_row", False)}
            await sc.app_shot(c, os.path.join(HERE, 'probe_dropped_toast.png'))
        finally:
            await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    except BaseException as e:
        res['7_error'] = str(e)[:300]
    save()
    print('probe done')


sc.task_probe = task_probe


async def amain():
    sc.load_fixtures(['repay_bowl', 'share_back', 'dawn_mob', 'd10_grab'])
    await sc.amain(['probe'], {})

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    os.makedirs(sc.OUTD, exist_ok=True)
    asyncio.run(amain())
