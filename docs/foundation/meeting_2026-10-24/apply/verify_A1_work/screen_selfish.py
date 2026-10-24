# verify_A1 (적대적 검증, 읽기 전용): 실제 게임 화면에서 '이기적으로' 한 판을 진행하며 쌓이는 신호를 찍는다.
# 게임 파일은 고치지 않는다 — v4/tools/screen_check.py 의 CDP·서버·브라우저 도구를 빌려 쓰고(포트만 다르게), 페이지 안에서 봇만 바꾼다.
# 실행 (C:\dev\dark_station 에서): python docs/foundation/meeting_2026-10-24/apply/verify_A1_work/screen_selfish.py --seed=7 [--mode=safe|gamble]
#   safe   = 남을 내미는 금기는 그 순간 위험이 없을 때 늘 고르고, '끝이다' 글이 붙으면 버틴다(사람다운 이기적 플레이)
#   gamble = 카르마로 판정이 된 금기도 고른다(늦은 값이 실제로 죽이는지 화면에서 본다)
# 결과: verify_A1_work/shots_<mode>_<seed>/*.png · log_<mode>_<seed>.json
import os, sys, json, time, asyncio, shutil, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC   # noqa: E402
import websockets            # noqa: E402

opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
SEED = int(opts.get('seed', '7'))
MODE = opts.get('mode', 'safe')
SC.PORT, SC.DBG = int(opts.get('port', '18877')), int(opts.get('dbg', '19677'))
OUT = os.path.join(HERE, f'shots_{MODE}_{SEED}')
SC.OUTD = OUT

BOT_JS = r"""((mode) => {
  const D = __ds4, E = D.E, db = D.db, UI = D.UI;
  const DEADLY = /끝이다|죽는다|올라간다|못 일어난다|센다|세어진다|아침이 안 올/;
  const OTHER = /그 사람|남의|옆 |다른|대신/;
  const LADDER = ['dawn_strike', 'dawn_mob', 'called_up', 'd10_hold', 'd10_grab', 'repay_bowl', 'share_back', 'fever_night'];
  const A = window.__a1 = { log: [], pause: null, phaseSeen: {}, picks: [] };
  const orig = UI.bot;
  function info() {
    const s = D.state, v = E.view(s, db);
    return { day: s.day, phase: s.phase, karma: s.world.karma || 0, injury: s.people.you.n.injury || 0, you: s.people.you.status,
      food: s.world.food, water: s.world.water, meds: s.world.meds,
      people: v.people.filter((p) => p.id !== 'you' && p.status === 'home').map((p) => ({ id: p.id, met: p.met, grudge: s.people[p.id].n.grudge || 0, cold: !!(p.signs && p.signs.cold), address: p.address, call: D.callOf ? D.callOf(p.id) : null })),
      bowl: s.traces.bowl_you ? s.traces.bowl_you.st : '', map: D.peopleOnMap().map((p) => ({ id: p.id, x: p.x, y: p.y, pose: p.pose, face: p.face, cold: !!p.cold })) };
  }
  function pickEvent() {
    const s = D.state, ev = E.eventView(s, db); if (!ev) return 0;
    const rows = db.events[ev.id].choices;
    const cs = ev.choices.map((c, i) => { const r = E.effChoice(s, db, rows[i]); return { i, label: c.label, warn: `${c.warn || ''} ${c.hint || ''}`, taboo: !!c.taboo, chance: c.chance, locked: c.locked, cost: c.cost, check: !!(r && r.check), swapped: r !== rows[i] }; }).filter((c) => !c.locked);
    if (!cs.length) return 0;
    const deadly = (c) => DEADLY.test(c.warn);
    const pushOther = (c) => (c.taboo || /남의 그릇/.test(c.label)) && OTHER.test(c.label + ' ' + c.warn);
    let pick = null, why = '';
    // 1) 남을 내미는 선택: 그 순간 위험이 없으면 늘 고른다 (gamble 이면 판정이 붙어도 고른다)
    const po = cs.filter((c) => pushOther(c) && (mode === 'gamble' || !deadly(c)));
    if (po.length) { pick = po[0]; why = 'push_other'; }
    // 2) 갚는 길은 고르지 않는다(이기적) — 죽음 글 없는 것 중 비용 없는 것('버틴다'·'지나간다') → 비용 있는 것
    if (!pick) { const nd = cs.filter((c) => !deadly(c)); const free = nd.filter((c) => !c.cost || !Object.keys(c.cost).length); const tb = free.filter((c) => c.taboo);
      if (tb.length) { pick = tb[0]; why = 'taboo_free'; } else if (free.length) { pick = free.find((c) => !c.warn.trim()) || free[0]; why = 'no_cost'; } else if (nd.length) { pick = nd[0]; why = 'cost'; } }
    // 3) 다 죽음 글이면 % 가 가장 높은 것
    if (!pick) { pick = cs.slice().sort((a, b) => (b.chance == null ? 100 : b.chance) - (a.chance == null ? 100 : a.chance))[0]; why = 'best_chance'; }
    A.picks.push({ day: s.day, phase: s.phase, ev: ev.id, target: ev.target, karma: s.world.karma || 0, label: pick.label, warn: pick.warn.trim(), why, swapped: pick.swapped, all: cs.map((c) => `${c.label}${c.warn.trim() ? ' [' + c.warn.trim() + ']' : ''}${c.chance != null ? ' ' + c.chance + '%' : ''}${c.taboo ? ' (금기)' : ''}${c.swapped ? ' (swap)' : ''}`) });
    return pick.i;
  }
  const bot = (kind, inf) => {
    const s = D.state;
    if (kind === 'line') {
      const t = String(inf.text || ''); A.log.push({ k: 'line', day: s.day, phase: s.phase, name: inf.opts && inf.opts.name || '', tag: inf.opts && inf.opts.tag || '', text: t });
      const key = `${s.day}:${s.phase}`;
      // 각 날·단계 첫 줄 · 사람의 말(이름표 있는 줄) 에서 잠깐 멈춰 찍는다
      if ((!A.phaseSeen[key] && ['trace', 'evening', 'night', 'aftermath'].includes(s.phase)) || (inf.opts && inf.opts.name && s.day >= 2)) { A.phaseSeen[key] = 1; A.pause = { kind, key: `${key}:line`, text: t, name: inf.opts && inf.opts.name || '', info: info() }; return 'hold'; }
      return undefined;
    }
    if (kind === 'event') {
      const ev = s.pending ? s.pending.id : '';
      const bi = inf.options.findIndex((o) => o.value === 'board'); if (bi >= 0 && false) return bi;
      const i = pickEvent();
      if (LADDER.includes(ev) || (A.picks[A.picks.length - 1] || {}).why === 'push_other') { A.pause = { kind, key: `${s.day}:${s.phase}:ev:${ev}`, choose: i, ev, info: info(), opts: inf.options.map((o) => ({ label: o.label, disabled: o.disabled })) }; return 'hold'; }
      return i;
    }
    if (kind === 'confirm2') return 0;
    if (kind === 'death_ledger' || kind === 'ending' || kind === 'title') { A.pause = { kind, key: `end:${kind}`, info: info(), terminal: 1 }; return 'hold'; }
    return orig(kind, inf);
  };
  D.setBot(bot);
  A.resume = () => { const p = A.pause; A.pause = null; if (!p) return 0; if (p.kind === 'line') UI.key('ok'); else if (p.kind === 'event') UI.pick(p.choose); return 1; };
  return 'ok';
})"""

STAGE_TXT = r"""(() => { const b = document.getElementById('box'); const hud = document.getElementById('hud'); const goal = document.getElementById('goal');
  const all = document.body.innerText; return { box: b && !b.hidden ? b.innerText : '', hud: hud ? hud.innerText : '', goal: goal ? goal.innerText : '',
  forbidden: (all.match(/카르마|원한|karma|grudge|이기심|축/g) || []), digits_in_box: b && !b.hidden ? (b.innerText.match(/\d+/g) || []) : [] }; })()"""


async def run():
    httpd = SC.serve()
    prof = os.path.join(OUT, '.profile')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log = {'seed': SEED, 'mode': MODE, 'pauses': []}
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
            # auto=selfplay: 붙잡을 지점이 없는 이름 → 캡처 봇이 판 끝까지 간다. 곧바로 봇을 이기적 봇으로 바꾼다
            await c.open(f'/v4/index.html?fast=1&auto=selfplay&seed={SEED}&sc={int(time.time())}')
            await c.wait('window.__ds4 && __ds4.state && __ds4.UI.bot', 60)
            print('bot', await c.ev(BOT_JS + f"('{MODE}')", False))
            n = 0
            t0 = time.time()
            idle_since = time.time()
            while time.time() - t0 < 1500:
                p = await c.ev('window.__a1 && window.__a1.pause', False)
                if not p:
                    st = await c.ev("({ ended: !!__ds4.state.ended, why: __ds4.state.ended ? __ds4.state.ended.why : '', open: __ds4.UI.openKind(), day: __ds4.state.day, phase: __ds4.state.phase })", False)
                    if st and st.get('ended') and not st.get('open') and time.time() - idle_since > 8:
                        print('ended without hold', st)
                        break
                    if st and st.get('open'):
                        idle_since = time.time()
                    await asyncio.sleep(0.12)
                    continue
                idle_since = time.time()
                n += 1
                await asyncio.sleep(0.5)                  # 선택 창 입력 막힘(0.4초)·그림이 다 그려지게
                name = f"{n:03d}_{p['key'].replace(':', '_')}.png"
                await SC.stage_shot(c, os.path.join(OUT, name))
                txt = await c.ev(STAGE_TXT, False)
                rec = {'n': n, 'shot': name, 'pause': p, 'screen': txt}
                log['pauses'].append(rec)
                inf = p.get('info') or {}
                cold = [x['id'] for x in inf.get('people', []) if x.get('cold')]
                print(n, p['key'], 'k', inf.get('karma'), 'inj', inf.get('injury'), 'cold', cold, 'bowl', inf.get('bowl'), '|', (p.get('name') or '') + ' ' + (p.get('text') or p.get('ev') or '')[:60])
                if p.get('terminal'):
                    break
                await c.ev('window.__a1.resume()', False)
                await asyncio.sleep(0.05)
            log['picks'] = await c.ev('window.__a1.picks', False)
            log['lines'] = await c.ev('window.__a1.log', False)
            log['autoLog'] = await c.ev('__ds4.autoLog', False)
            log['end'] = await c.ev("(() => { const s = __ds4.state; return { ended: s.ended ? { why: s.ended.why, cause: s.ended.cause } : null, day: s.day, phase: s.phase, karma: s.world.karma, you: s.people.you.status, permanent: Object.keys(s.people.you.permanent), injury: s.people.you.n.injury, hurt: s.hurt }; })()", False)
            log['errors'] = c.errors()
    finally:
        proc.terminate()
        httpd.shutdown()
        time.sleep(0.5)
        shutil.rmtree(prof, ignore_errors=True)
        with open(os.path.join(HERE, f'log_{MODE}_{SEED}.json'), 'w', encoding='utf-8') as f:
            json.dump(log, f, ensure_ascii=False, indent=1)
    print('end', json.dumps(log.get('end'), ensure_ascii=False)[:500], 'errors', log.get('errors'))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    os.makedirs(OUT, exist_ok=True)
    asyncio.run(run())
