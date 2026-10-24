# (화면 담당 2026-10-24 검증 잔여 10건 고친 뒤 다시 재기) probe.py(verify_SCR_spec 사본)에 더하는 일: fire·spanner·office2·call·deliberate·tapmore
# probe.py 가 import 한다 — 따로 돌리지 않는다.
import os, json, time, asyncio

FIRE_Q = r"""(() => { const s = __ds4.state; return { day: s.day, phase: s.phase, fire: s.traces.fire, notice: s.notice, noticeDay: s.noticeDay,
  night: s.nightLog.filter((e) => e.day === s.day - 1 && e.role !== 'clock' && e.role !== 'neglect').map((e) => ({ id: e.id, traces: e.traces, discovered: e.discovered })) }; })()"""

TRACE_JS = r"""(() => { const b = document.querySelector('#box'); return [__ds4.UI.openKind(), (document.querySelector('#box .opt.sel .ol') || {}).textContent || '', ((b && b.querySelector('.body')) || {}).textContent ? b.querySelector('.body').textContent.slice(0, 30) : '', __ds4.state.people.you.status]; })()"""


def install(P):
    SC, HERE, RES = P.SC, P.HERE, P.RES

    async def t_fire(c, opts):
        """#2 화로: 단계만 넘기는 창은 흔적 글을 보이지 않고 조사로도 안 친다 · '화로를 살핀다'를 고르면 조사(흔적 seen · 그 밤 사건 discovered)하고 글을 보인다."""
        r = {}
        await c.open(f'/v4/index.html?fast=1&auto=xnatural&state=/__fixture/A_water.json&sc={int(time.time())}')
        await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot", 90)
        await SC.until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", 60)
        r['before'] = await c.ev(FIRE_Q, False)
        # ① 창만 연다 (붙잡음)
        await c.ev("(() => { window.__fireN = 0; window.__lines = []; __ds4.setBot((k, info) => { if (k === 'line') { window.__lines.push(info.text); return undefined; } if (k === 'fire') { window.__fireN++; window.__fireOpts = info.options.map((o) => o.label); return 'hold'; } return undefined; }); return 1; })()", False)
        await c.ev("__ds4.use('fire'); 1", False)
        await SC.until(c, "window.__fireN === 1", 30)
        await asyncio.sleep(0.4)
        r['box1'] = await c.ev("(() => { const b = document.getElementById('box'); return b ? b.textContent : ''; })()", False)
        r['opts1'] = await c.ev('window.__fireOpts', False)
        r['mid'] = await c.ev(FIRE_Q, False)
        await SC.stage_shot(c, os.path.join(HERE, 'fix_fire_window_D5.png'))
        # ② '화로를 살핀다'
        i = r['opts1'].index('화로를 살핀다') if '화로를 살핀다' in (r['opts1'] or []) else -1
        r['look_index'] = i
        if i >= 0:
            await c.ev(f"__ds4.pick({i}); 1", False)
            await SC.until(c, "window.__fireN === 2", 30)
            await asyncio.sleep(0.4)
            r['lines'] = await c.ev('window.__lines', False)
            r['opts2'] = await c.ev('window.__fireOpts', False)
            r['after'] = await c.ev(FIRE_Q, False)
            r['inspectLog'] = await c.ev('__ds4.inspectLog.slice(-3)', False)
            await SC.stage_shot(c, os.path.join(HERE, 'fix_fire_looked_D5.png'))
        r['errors'] = c.errors()
        sw = [e for e in (r.get('after') or {}).get('night', []) if 'fire' in (e.get('traces') or [])]
        r['fire_rows'] = sw
        mid_sw = [e for e in r['mid']['night'] if 'fire' in (e.get('traces') or [])]
        r['ok_window_only'] = (not (r['mid']['fire'] or {}).get('seen')) and not any(e.get('discovered') for e in mid_sw) and '젖어' not in r['box1']
        r['ok_look'] = bool(r.get('after') and (r['after']['fire'] or {}).get('seen')) and bool(sw) and all(e.get('discovered') for e in sw) and any('젖어' in t for t in r.get('lines') or [])
        print('fire', json.dumps(r, ensure_ascii=False)[:2400])
        RES['fire'] = r

    async def t_spanner(c, opts):
        """#1 d4_spanner 선택 창: 이름표(헤드램프의 남자)와 본문이 같은 이름표를 쓴다 (증언 전 저장)."""
        r = {}
        if 'd4_spanner' not in SC.FIXTURES:
            RES['spanner'] = {'error': 'fixture 없음'}
            return
        await c.open(f'/v4/index.html?fast=1&auto=manual&state=/__fixture/d4_spanner.json&sc={int(time.time())}')
        await c.wait("__ds4.state && __ds4.state.pending && __ds4.UI.openKind() === 'line'", 90)
        r['heard_gicheol'] = await c.ev("Object.keys(__ds4.state.heard || {}).filter((k) => /^testify_gicheol/.test(k))", False)
        r['line1'] = await c.ev("(() => { const b = document.getElementById('box'); return { who: (b.querySelector('.who') || {}).textContent || '', text: b.textContent }; })()", False)
        await c.ev("(() => { __ds4.setBot((k) => (k === 'event' ? 'hold' : undefined)); return 1; })()", False)
        await c.ev("__ds4.UI.key('ok'); 1", False)
        await SC.until(c, "__ds4.UI.openKind() === 'event'", 30)
        await asyncio.sleep(0.3)
        r['box'] = await c.ev("(() => { const b = document.getElementById('box'); return { who: (b.querySelector('.who') || {}).textContent || '', text: (b.querySelector('.body') || {}).textContent || '', opts: Array.from(b.querySelectorAll('.opt')).map((x) => x.textContent) }; })()", False)
        await SC.stage_shot(c, os.path.join(HERE, 'fix_spanner_box.png'))
        secret = ['박기철', '기철']
        r['leak'] = [n for n in secret if n in (r['box']['text'] + ' '.join(r['box']['opts']))]
        r['ok'] = not r['leak'] and r['box']['who'] == '헤드램프의 남자' and '남자가 머리맡에' in r['box']['text']
        r['errors'] = c.errors()
        print('spanner', json.dumps(r, ensure_ascii=False))
        RES['spanner'] = r

    async def t_office2(c, opts):
        """#3·#6 역무실 문이 열린 뒤: 문 칸을 지나 창고 상자·부품 상자까지 걸어가 조사할 수 있다."""
        await SC.goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
        await SC.normal_speed(c)
        r = {'office': await c.ev("__ds4.state.traces.office_door.st", False)}
        r['door_obj'] = await c.ev("(() => { const o = __ds4.objectsOnMap().find((q) => q.id === 'office_door'); return o ? { x: o.x, y: o.y, solid: o.solid, state: o.state } : null; })()", False)
        # 줄 창은 저절로 넘기고(봇이 있으면 줄 창이 넘어간다) 사건 창은 붙잡는다 — 걸어가 닿으면 그 물건을 조사하는 흐름이 줄 창을 열어 둔 채 멈추지 않게
        await c.ev("(() => { window.__crate = []; __ds4.setBot((k, info) => { window.__crate.push([k, ((info && info.options) || []).map((o) => o.label), (info && info.text) || '']); return k === 'event' ? 'hold' : undefined; }); return 1; })()", False)
        for tgt in ('parts_crate', 'crate_food'):
            await SC.place(c, 17, 2, 'left')
            await asyncio.sleep(0.2)
            await SC.until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", 30)
            r['busy_' + tgt] = await c.ev("({ open: __ds4.UI.openKind(), moving: !!__ds4.scene.moving, auto: !!__ds4.scene.auto })", False)
            r['walk_' + tgt] = await c.ev(f"(() => {{ const o = __ds4.objectsOnMap().find((q) => q.id === '{tgt}'); const w = __ds4.walkTo(o.x, o.y); return {{ w, auto: !!__ds4.scene.auto, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }}; }})()", False)
            await SC.until(c, "!__ds4.scene.auto && !__ds4.scene.moving", 30)
            await asyncio.sleep(0.3)
            r['pos_' + tgt] = await c.ev("[__ds4.scene.px, __ds4.scene.py, __ds4.scene.face]", False)
            r['target_' + tgt] = await c.ev("(() => { const t = __ds4.target(); return t ? t.id + ':' + t.verb : null; })()", False)
        await SC.place(c, 16, 2, 'left')
        await asyncio.sleep(0.2)
        await SC.until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", 30)
        await c.key('ArrowLeft', 'keyDown'); await asyncio.sleep(0.12); await c.key('ArrowLeft', 'keyUp')   # 방향키 한 번 = 문 칸으로 한 걸음
        await SC.until(c, "!__ds4.scene.auto && !__ds4.scene.moving", 20)
        await asyncio.sleep(0.4)
        r['pos_door'] = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
        await SC.ap_zoom(c, 'fix_office_door_on.png', 4, 0, 19, 5, 3)
        await SC.place(c, 8, 3, 'up')
        await asyncio.sleep(0.3)
        await SC.until(c, "!__ds4.UI.isOpen() && !__ds4.scene.auto && !__ds4.scene.moving", 30)
        r['crate_log_walk'] = await c.ev('window.__crate', False)
        await c.ev("window.__crate = []; __ds4.interact(); 1", False)
        await asyncio.sleep(1.5)
        r['crate_inspect'] = await c.ev("({ pending: __ds4.state.pending ? __ds4.state.pending.id : null, seen: !!(__ds4.state.traces.crate_food && __ds4.state.traces.crate_food.seen), log: __ds4.inspectLog.slice(-2), bot: window.__crate, open: __ds4.UI.openKind() })", False)
        await SC.ap_zoom(c, 'fix_office_crate_inspect.png', 4, 0, 19, 5, 3)
        r['errors'] = c.errors()
        tc, tp = r.get('target_crate_food') or '', r.get('target_parts_crate') or ''
        r['ok'] = (not r['door_obj']['solid']) and r['pos_door'] == [15, 2] and tc.startswith('crate_food') and tp.startswith('parts_crate')
        print('office2', json.dumps(r, ensure_ascii=False))
        RES['office2'] = r

    async def t_call(c, opts):
        """#9 호칭: 원한이 깊을 때만 차가운 호칭을 붙이고, 줄 안에 따뜻한 호칭(형·손님…)이 있으면 건너뛴다."""
        await SC.goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
        r = await c.ev(r"""(() => { const D = __ds4, s = D.state, out = {};
          const cases = [['soonrye', '역무실 열쇠야. 자네가 열어.'], ['soonrye', '저 소리가 열흘이래. 사람은 자네가 세.'], ['soonrye', '손님, 아들이 남주에 있어.'], ['dongha', '은지 누나가 저를 거둬 줬어요. 형이 그랬어요.'], ['dongha', '은지 누나가 저를 거둬 줬어요.'], ['gicheol', '통로는 이틀이면 되오.'], ['eunji', '너 뭘 봐.'], ['seoha', '물 좀 주세요.']];
          for (const n of [0, 6]) for (const [id, t] of cases) { const keep = s.people[id].n.grudge; s.people[id].n.grudge = n; (out['grudge' + n] = out['grudge' + n] || []).push([id, D.withCall(id, t, null)]); s.people[id].n.grudge = keep; }
          return out; })()""", False)
        print('call', json.dumps(r, ensure_ascii=False))
        RES['call'] = r

    async def press(c, k, gap=0.6):
        await c.key(k, 'keyDown')
        await asyncio.sleep(0.03)
        await c.key(k, 'keyUp')
        await asyncio.sleep(gap)

    async def t_deliberate(c, opts):
        """#4 대조: 일부러 고르는 사람은 여전히 고를 수 있다 — ↓(첫 방향키 = 경고 없는 선택지) → ↓(금기) → 쉼 → Space → 확인창 ↑ → 쉼 → Space."""
        out = []
        for ev in [e for e in opts.get('evs2', 'pro_stairs,d3_called_you').split(',') if e in SC.FIXTURES]:
            r = {'ev': ev}
            await c.open(f'/v4/index.html?fast=1&auto=evline&state=/__fixture/{ev}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && !__ds4.UI.bot", 120)
            await asyncio.sleep(0.3)
            for _ in range(8):                       # 본문 줄을 넘겨 선택 창까지
                if await c.ev("__ds4.UI.openKind()", False) == 'event':
                    break
                await press(c, ' ', 0.25)
            await asyncio.sleep(0.6)
            await press(c, 'ArrowDown')
            r['first_arrow'] = await c.ev(TRACE_JS, False)
            await press(c, 'ArrowDown')
            r['on_taboo'] = await c.ev(TRACE_JS, False)
            await press(c, ' ', 0.8)
            r['after_space'] = await c.ev(TRACE_JS, False)
            if r['after_space'][0] == 'confirm2':
                await press(c, 'ArrowUp')
                r['confirm_cursor'] = await c.ev(TRACE_JS, False)
                await press(c, ' ', 1.2)
            await asyncio.sleep(0.5)
            r['end'] = await c.ev(TRACE_JS, False)
            r['died'] = r['end'][3] != 'home'
            r['errors'] = c.errors()[:5]
            out.append(r)
            print('deliberate', ev, json.dumps(r, ensure_ascii=False))
        RES['deliberate'] = out

    async def t_tapmore(c, opts):
        """#4 두드림 여러 박자: ↑/↓ 를 160·250·400·600ms 로 두드리며 Space 를 80·150ms 로 연타 — 죽음 0 이어야 한다."""
        out = []
        plans = []
        for k in ('ArrowUp', 'ArrowDown'):
            for tdt in (0.16, 0.25, 0.40, 0.60):
                for mdt in (0.08, 0.15):
                    plans.append((k, tdt, mdt))
        reps = int(opts.get('reps', '1'))
        for ev in [e for e in opts.get('evs2', 'pro_stairs,d3_called_you').split(',') if e in SC.FIXTURES]:
            for (k, tdt, mdt) in plans:
                for rep in range(reps):
                    r = {'ev': ev, 'plan': f'{k}{int(tdt * 1000)}+space{int(mdt * 1000)}', 'rep': rep, 'trace': []}
                    try:
                        await c.open(f'/v4/index.html?fast=1&auto=evline&state=/__fixture/{ev}.json&sc={int(time.time())}')
                        await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && !__ds4.UI.bot", 300)
                        await asyncio.sleep(0.3)
                        before = await c.ev(P.CHOICES_JS + f"('{ev}')", False)
                        t0 = time.time(); nt = nm = 0; last = None
                        while time.time() - t0 < float(opts.get('secs', '6')):
                            now = time.time() - t0
                            if now >= nt:
                                await c.key(k, 'keyDown'); await asyncio.sleep(0.03); await c.key(k, 'keyUp'); nt = now + tdt
                            if now >= nm:
                                await c.key(' ', 'keyDown'); await c.key(' ', 'keyUp'); nm = now + mdt
                            st = await c.ev(TRACE_JS, False)
                            if st != last:
                                r['trace'].append([round(now, 2)] + st); last = st
                            if st[3] != 'home':
                                break
                            await asyncio.sleep(0.01)
                        await asyncio.sleep(0.6)
                        after = await c.ev(P.CHOICES_JS + f"('{ev}')", False)
                        r['picked'] = after['lastChoice'] if (after['fired'] > before['fired'] and after['lastEv'] == ev) else ''
                        r['died'] = after['you'] != 'home'
                    except BaseException as e:
                        r['error'] = repr(e)[:300]
                    out.append(r)
                    print('tap', ev, r['plan'], rep, '| picked', r.get('picked') or '-', '| died', r.get('died'), '|', r.get('error', ''))
        RES['tapmore'] = out
        RES['tapmore_sum'] = {'runs': len(out), 'died': sum(1 for r in out if r.get('died')), 'picked': sum(1 for r in out if r.get('picked')), 'errors': sum(1 for r in out if r.get('error'))}
        print('tapmore', RES['tapmore_sum'])

    for f in (t_fire, t_spanner, t_office2, t_call, t_deliberate, t_tapmore):
        setattr(P, f.__name__, f)
