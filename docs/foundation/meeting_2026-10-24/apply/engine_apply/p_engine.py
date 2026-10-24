p = r'C:\dev\dark_station\v4\engine\engine.js'
t = open(p, encoding='utf8').read()


def rep(a, b, cnt=1):
    global t
    assert t.count(a) == cnt, (a[:90], t.count(a))
    t = t.replace(a, b)


rep("""  const LEDGER = isNode ? require('./ledger.js') : D4.ledger;
""", """  const LEDGER = isNode ? require('./ledger.js') : D4.ledger;
  const S = isNode ? require('./schema.js') : D4.schema;   // swap 합치기·대상이 필요한 선택지(10-24) — 표 검사와 같은 규칙을 쓴다
""")

rep("""  const injuryMax = (db) => (db.numbers.injury ? db.numbers.injury.max : Infinity);   // 위독 = injury 의 최대값 (numbers 표)
""", """  const injuryMax = (db) => (db.numbers.injury ? db.numbers.injury.max : Infinity);   // 위독 = injury 의 최대값 (numbers 표)
  const SIGN_COLD_CALL_DEFAULT = 5;          // 호칭이 차가워지는 원한 문턱 (numbers 세계 수치 sign_cold_call 이 있으면 그것, 10-24 E5)
  const NO_TARGET_WHY = '댈 이름이 없다';     // targetOptional 사건에서 대상이 없어 잠긴 선택지의 기본 이유 (10-24)
""")

rep("""      pending: null, lastResult: null, ledger: { causes: {}, written: [] }, log: [], stats: { decisions: 0, nights: 0, deaths: 0 },
    };""", """      pending: null, lastResult: null, ledger: { causes: {}, written: [] }, log: [], stats: { decisions: 0, nights: 0, deaths: 0, neglect: 0 },
      hurt: [], notice: null, noticeDay: null,
    };   // (10-24) hurt = 당신 부상의 출처 [{day, src, n}](통계용) · notice = 방금 조작에 붙은 토스트 줄 id(toast_late) · noticeDay = 그 토스트를 띄운 날 · stats.neglect = 적용한 missed 수""")

rep("""    ctx.inspect = {}; ctx.talk = {};
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }""", """    ctx.inspect = {}; ctx.talk = {};
    ctx.fired = s.fired || {};                                                                              // (10-24) fired:called_up>=2 = 그 사건을 고른 횟수 (swap·req.cond 에서 '되풀이할수록')
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }""")

# enterPhase target
rep("""      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target); if (!target) continue; }
      s.pending = { id: ev.id, kind: ev.kind };
      if (target) s.pending.target = target;
      break;""", """      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target, ev.targetIf); if (!target && !ev.targetOptional) continue; }   // targetOptional: 대상 없이도 걸린다(대상이 필요한 선택지만 잠김)
      s.pending = { id: ev.id, kind: ev.kind };
      if (target) s.pending.target = target;
      break;""")

rep("""  // 사건 대상: 사람 id(역에 있어야) · any/randomSleeper/… = 역에 있는 주민 중 무작위 · mostInjured = 가장 많이 다친 주민 · bond = 당신의 bond
  // (나이로 거르지 않는다 — 10-22 디렉터 결정 '미성년 처리 금지': 서하(17)도 다른 주민과 똑같다)
  // 무작위·mostInjured 는 만난 사람(known)만 — 안 만난 사람의 이름이 사건에 나오지 않게(10-24 P0-E1)
  function eventTarget(s, db, spec) {
    if (!spec) return null;
    if (db.people[spec]) return s.people[spec] && s.people[spec].status === 'home' ? spec : null;
    const res = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home' && known(s, db, id));
    if (EVENT_RANDOM.includes(spec)) return R.pick(s, res) || null;
    if (spec === 'mostInjured') { const hurt = res.filter((id) => (s.people[id].n.injury || 0) > 0).sort((a, b) => (s.people[b].n.injury || 0) - (s.people[a].n.injury || 0)); return hurt[0] || null; }
    if (spec === 'bond') { const b = s.people.you.needs.bond; return b && s.people[b] && s.people[b].status === 'home' ? b : null; }
    return null;
  }""", """  // 사건 대상: 사람 id(역에 있어야) · any/randomSleeper/… = 역에 있는 주민 중 무작위 · mostInjured = 가장 많이 다친 주민 · bond = 당신의 bond
  //   · most:<사람 수치> (10-24) = 그 수치가 가장 큰 주민(0보다 클 때만, 같으면 무작위) — 예 most:grudge = 원한이 가장 높은 사람
  // (나이로 거르지 않는다 — 10-22 디렉터 결정 '미성년 처리 금지': 서하(17)도 다른 주민과 똑같다)
  // 무작위·mostInjured·most: 는 만난 사람(known)만 — 안 만난 사람의 이름이 사건에 나오지 않게(10-24 P0-E1)
  // ifCond (사건 targetIf 열, 10-24) = 후보가 맞아야 하는 조건식. 그 사람의 수치(grudge·injury…·grudge_target)·self(그 사람 id)·bond·flag:x_target·물건 x_target
  function eventTarget(s, db, spec, ifCond) {
    if (!spec) return null;
    const fits = (id) => !ifCond || targetFits(s, db, id, ifCond);
    if (db.people[spec]) return s.people[spec] && s.people[spec].status === 'home' && fits(spec) ? spec : null;
    const res = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home' && known(s, db, id) && fits(id));
    if (EVENT_RANDOM.includes(spec)) return R.pick(s, res) || null;
    if (spec === 'mostInjured') { const hurt = res.filter((id) => (s.people[id].n.injury || 0) > 0).sort((a, b) => (s.people[b].n.injury || 0) - (s.people[a].n.injury || 0)); return hurt[0] || null; }
    const most = S.MOST_TARGET.exec(spec);
    if (most) { const v = (id) => s.people[id].n[most[1]] || 0; const top = res.reduce((m, id) => Math.max(m, v(id)), 0); if (top <= 0) return null; const tied = res.filter((id) => v(id) === top); return tied.length === 1 ? tied[0] : R.pick(s, tied); }
    if (spec === 'bond') { const b = s.people.you.needs.bond; return b && s.people[b] && s.people[b].status === 'home' && fits(b) ? b : null; }
    return null;
  }
  // targetIf 조건식 환경: 사건 when 의 환경 + 후보의 수치(맨이름·_target) + self + 깃발·물건의 _<id> → _target (밤 사건 roleCtx 와 같은 낱말)
  function targetCtx(s, db, id) {
    const p = s.people[id];
    const ctx = phaseCtx(s);
    Object.assign(ctx, p.n);
    for (const [k, v] of Object.entries(p.n)) ctx[`${k}_target`] = v;
    ctx.self = id; ctx.bond = (p.needs && p.needs.bond) || '';
    const flags = Object.assign({}, s.flags);
    for (const f of Object.keys(s.flags)) if (f.endsWith('_' + id)) flags[f.slice(0, -id.length) + 'target'] = s.flags[f];
    ctx.flags = flags;
    for (const [tid, tr] of Object.entries(s.traces)) if (tid.endsWith('_' + id)) ctx[tid.slice(0, -id.length) + 'target'] = tr.st;
    return ctx;
  }
  function targetFits(s, db, id, cond) { try { return C.test(cond, targetCtx(s, db, id)); } catch (e) { return false; } }""")

# choiceState
rep("""  // ── 선택 ──
  function choiceState(s, db, ev, c) {
    const you = s.people.you;
    const locked = [];
    if (c.req) {
      if (c.req.flag && !s.flags[c.req.flag]) locked.push('조건이 맞지 않다');
      if (c.req.permanent && !you.permanent[c.req.permanent]) locked.push('조건이 맞지 않다');
      if (c.req.notPermanent && you.permanent[c.req.notPermanent]) locked.push(`${c.req.notPermanent === 'finger' ? '손가락' : c.req.notPermanent === 'leg' ? '다리' : '귀'}가 성치 않다`);
    }""", """  // ── 선택 ──
  // swap (10-24 A1): 선택지의 swap 변형 가운데 when 이 지금 맞는 첫 것으로 바꾼 선택지. 없으면 그대로. 합치는 규칙은 schema.js mergeSwap(표 검사와 같다)
  const SWAP_CACHE = new WeakMap();
  function effChoice(s, db, c, ctx) {
    if (!c || c.swap == null) return c;
    ctx = ctx || phaseCtx(s);
    for (const v of S.swapsOf(c)) {
      let ok = false; try { ok = C.test(v.when, ctx); } catch (e) { ok = false; }
      if (!ok) continue;
      let m = SWAP_CACHE.get(v); if (!m) { m = S.mergeSwap(c, v); SWAP_CACHE.set(v, m); }
      return m;
    }
    return c;
  }
  // 잠금 이유: req.why 가 있으면 그 글(10-24 E5), 없으면 지금까지의 글. req.cond = 조건식(사건 when 과 같은 환경)이 맞아야 열림.
  //   대상이 필요한 선택지(결과가 who:'target' 등을 쓰거나 req.target:1)는 사건 대상이 없으면 잠긴다 — 사건에 target 열이 있을 때(targetOptional 로 대상 없이 걸린 경우)·req.target 일 때
  function choiceState(s, db, ev, c0) {
    const you = s.people.you;
    const c = effChoice(s, db, c0);
    const locked = [];
    const why = c.req && typeof c.req.why === 'string' && c.req.why ? c.req.why : '';
    if (c.req) {
      if (c.req.flag && !s.flags[c.req.flag]) locked.push(why || '조건이 맞지 않다');
      if (c.req.permanent && !you.permanent[c.req.permanent]) locked.push(why || '조건이 맞지 않다');
      if (c.req.notPermanent && you.permanent[c.req.notPermanent]) locked.push(why || `${c.req.notPermanent === 'finger' ? '손가락' : c.req.notPermanent === 'leg' ? '다리' : '귀'}가 성치 않다`);
      if (c.req.cond) { let ok = false; try { ok = C.test(c.req.cond, phaseCtx(s)); } catch (e) { ok = false; } if (!ok) locked.push(why || '조건이 맞지 않다'); }
    }
    const tgt = s.pending && s.pending.id === ev.id ? s.pending.target || null : null;
    if (!tgt && ((ev.target != null && S.usesTarget(c)) || (c.req && (c.req.target === 1 || c.req.target === true)))) locked.push(why || NO_TARGET_WHY);""")

rep("""    return { label: c.label, locked: locked.length > 0, reason: locked.join(', '), chance, hint: c.hint || '', warn: c.warn || '', cost: c.cost || null, taboo: !!c.taboo };
  }""", """    return { label: c.label, locked: locked.length > 0, reason: Array.from(new Set(locked)).join(', '), chance, hint: c.hint || '', warn: c.warn || '', cost: c.cost || null, taboo: !!c.taboo };
  }""")

# choose
rep("""  function choose(s, db, i) {
    if (!s.pending) return false;
    const ev = db.events[s.pending.id];
    const c = ev.choices[i];
    if (!c) return false;
    const st = choiceState(s, db, ev, c);
    if (st.locked) return false;
    // 강제 = 지금 열린 선택지(이것 포함) 가운데 당신이 죽지 않는 것이 0개. 자유 경고 선택 = 경고 글이 있고 다른 열린 선택지가 있던 선택.
    // 비용을 치르기 전에 잰다(비용이 잠금 상태를 바꾸므로).
    const open = ev.choices.filter((x) => !choiceState(s, db, ev, x).locked);
    const forced = !open.some((x) => !killsYou(x));""", """  function choose(s, db, i) {
    if (!s.pending) return false;
    const ev = db.events[s.pending.id];
    const c0 = ev.choices[i];
    if (!c0) return false;
    const st = choiceState(s, db, ev, c0);
    if (st.locked) return false;
    const c = effChoice(s, db, c0);                 // swap 이 맞으면 바뀐 선택지 (10-24)
    // 강제 = 지금 열린 선택지(이것 포함) 가운데 당신이 죽지 않는 것이 0개. 자유 경고 선택 = 경고 글이 있고 다른 열린 선택지가 있던 선택.
    // 비용을 치르기 전에 잰다(비용이 잠금 상태를 바꾸므로). swap 도 비용 전의 모습으로 본다.
    const open = ev.choices.filter((x) => !choiceState(s, db, ev, x).locked);
    const openEff = open.map((x) => effChoice(s, db, x));
    const forced = !openEff.some((x) => !killsYou(x));
    const alts = open.map((x, k) => ({ i: ev.choices.indexOf(x), kill: killsYou(openEff[k]), taboo: !!openEff[k].taboo, warn: `${openEff[k].warn || ''} ${openEff[k].hint || ''}`.trim() }));   // 집계용(봇 버릇 점검): 고를 때 열린 선택지의 모습""")

rep("""    const roles = rolesFor(s, db, out);
    if (out && out.effects) FX.apply(s, db, out.effects, roles, lines);
    arrive(s, db);                     // 만남 깃발이 섰으면 역에 온다 — 이어지는 사건(연쇄)이 그 사람을 본다""", """    const roles = rolesFor(s, db, out);
    if (out && out.effects) FX.apply(s, db, out.effects, roles, lines);
    FX.noteHurt(s, lines, `ev:${ev.id}/${c0.label}`);
    arrive(s, db);                     // 만남 깃발이 섰으면 역에 온다 — 이어지는 사건(연쇄)이 그 사람을 본다""")

rep("""    s.lastResult = { event: ev.id, choice: c.label, i, open: open.map((x) => ev.choices.indexOf(x)), warned: warnText && !forced, forced, free: forced ? freeBefore : s.lastFree || null, roll, text: (out && out.text) || '', lines, image: (out && out.image) || '', target: roles.target, companion: roles.companion };   // open = 고를 때 열려 있던 선택지 번호(봇 집계용)""",
"""    s.lastResult = { event: ev.id, choice: c.label, i, open: open.map((x) => ev.choices.indexOf(x)), alts, warned: warnText && !forced, forced, free: forced ? freeBefore : s.lastFree || null, roll, text: (out && out.text) || '', lines, image: (out && out.image) || '', target: roles.target, companion: roles.companion,
      warn: `${c.warn || ''} ${c.hint || ''}`.trim(), swapped: c !== c0 };   // open = 고를 때 열려 있던 선택지 번호 · alts = 그 선택지들의 모습(swap 뒤) · warn = 고른 선택지의 화면 경고 글 · swapped = swap 변형으로 골랐다 (봇 집계용)""")

rep("""      cause: youGone && r ? { event: r.event, choice: r.choice, warned: !!r.warned, forced: !!r.forced, free: r.free || null, image: r.image || '', night: !!r.night } : null };""",
"""      cause: youGone && r ? { event: r.event, choice: r.choice, warned: !!r.warned, forced: !!r.forced, free: r.free || null, image: r.image || '', night: !!r.night, warn: r.warn || '', swapped: !!r.swapped, alts: Array.isArray(r.alts) ? r.alts : null } : null };""")

rep("""  function inspect(s, db, objId) {
    if (!db.objects[objId]) return false;
    const t = s.traces[objId];
    const waiting = !!s.pending;
    s.found = null;
    if (t) { t.seen = true; NIGHT.markInspected(s, objId); }""", """  // (10-24 A4 E3) 그날 아침에 '못 본 밤'이 바꾼 흔적(late)이 하나라도 있으면, 그날 첫 조사 때 s.notice = 'toast_late'(대사표에 그 줄이 있을 때) 한 번.
  const lateToday = (s) => Object.values(s.traces).some((t) => t && t.late && t.day === s.day - 1);
  function inspect(s, db, objId) {
    if (!db.objects[objId]) return false;
    const t = s.traces[objId];
    const waiting = !!s.pending;
    s.found = null; s.notice = null;
    if (s.noticeDay !== s.day && db.lines.toast_late && lateToday(s)) { s.notice = 'toast_late'; s.noticeDay = s.day; }
    if (t) { t.seen = true; NIGHT.markInspected(s, objId); }""")

rep("""    const roles = rolesFor(s, db, null);
    if (o.holds.effects) FX.apply(s, db, o.holds.effects, roles, lines);""", """    const roles = rolesFor(s, db, null);
    if (o.holds.effects) FX.apply(s, db, o.holds.effects, roles, lines);
    FX.noteHurt(s, lines, 'holds:' + objId);""")

rep("""      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target); if (!target) continue; }
      s.pending = { id: ev.id, kind: 'trip' };""", """      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target, ev.targetIf); if (!target && !ev.targetOptional) continue; }
      s.pending = { id: ev.id, kind: 'trip' };""")

rep("""        s.trip = null; s.found = null;""", """        s.trip = null; s.found = null; s.notice = null;""")

rep("""    s.heard = raw.heard && typeof raw.heard === 'object' && !Array.isArray(raw.heard) ? Object.assign({}, raw.heard) : {};   // 옛 저장(heard 없음)은 빈 기록""",
"""    s.heard = raw.heard && typeof raw.heard === 'object' && !Array.isArray(raw.heard) ? Object.assign({}, raw.heard) : {};   // 옛 저장(heard 없음)은 빈 기록
    for (const tr of Object.values(s.traces)) if (tr && typeof tr === 'object') tr.late = tr.late ? 1 : 0;                      // (10-24 E3) 옛 저장 흔적은 late 0
    s.hurt = Array.isArray(raw.hurt) ? raw.hurt.filter((h) => h && typeof h === 'object' && typeof h.src === 'string').slice(-FX.HURT_MAX) : [];
    s.notice = typeof raw.notice === 'string' && db.lines[raw.notice] ? raw.notice : null;
    s.noticeDay = Number.isInteger(raw.noticeDay) ? raw.noticeDay : null;
    if (!Number.isFinite(s.stats.neglect)) s.stats.neglect = 0;""")

rep("""      people: db.peopleOrder.map((id) => { const p = s.people[id]; return { id, name: p.name, status: p.status, met: known(s, db, id) ? 1 : 0, injury: p.n.injury || 0, permanent: Object.keys(p.permanent), signs: sg[id] || null }; }),""",
"""      people: db.peopleOrder.map((id) => { const p = s.people[id]; return { id, name: p.name, status: p.status, met: known(s, db, id) ? 1 : 0, injury: p.n.injury || 0, permanent: Object.keys(p.permanent), signs: sg[id] || null, address: p.status === 'home' ? address(s, db, id) : null }; }),""")
rep("""      traces: Object.entries(s.traces).map(([id, t]) => ({ id, state: t.st, seen: t.seen })),""",
"""      traces: Object.entries(s.traces).map(([id, t]) => ({ id, state: t.st, seen: t.seen, late: t.late ? 1 : 0 })),""")
rep("""      event: eventView(s, db),
    };
  }""", """      event: eventView(s, db),
      notice: s.notice || null,                  // (10-24 E3) 방금 조사에 붙은 토스트 줄 id ('toast_late') 또는 null
    };
  }
  // (10-24 E3) 조사 글 줄 id: 물건 inspectLine[지금 상태], 그 흔적이 late(못 본 밤이 바꿈)이고 '<줄id>_late' 줄이 대사표에 있으면 그것. 없으면 null
  function inspectLineId(s, db, objId) {
    const o = db.objects[objId], t = s.traces[objId];
    if (!o || !t || !o.inspectLine) return null;
    const id = o.inspectLine[t.st];
    if (!id) return null;
    return t.late && db.lines[id + '_late'] ? id + '_late' : id;
  }
  // (10-24 E5) 그 주민이 지금 당신을 부르는 말: 원한 ≥ sign_cold_call(기본 5)이고 people.addressCold 칸이 있으면 그것('' = 부르지 않는다).
  //   아니면 정체가 기운 때(축 하나라도 0 이 아님) addressYou[기운 후보], 그다음 addressYou.default. 칸이 없으면 null
  function address(s, db, id) {
    const row = db.people[id], p = s.people[id];
    if (!row || !p || id === 'you') return null;
    const at = Number.isFinite(s.world.sign_cold_call) ? s.world.sign_cold_call : SIGN_COLD_CALL_DEFAULT;
    if (typeof row.addressCold === 'string' && (p.n.grudge || 0) >= at) return row.addressCold;
    const a = row.addressYou || {};
    const c = Object.values(s.axes || {}).some((v) => v) ? ID.identity(s.axes, db.identity) : null;
    if (c && typeof a[c.id] === 'string') return a[c.id];
    return typeof a.default === 'string' ? a.default : null;
  }""")

rep("""    return ev.choices.map((c, i) => { const outs = [c.out, c.ok, c.fail].filter(Boolean); const axis = {}; let kill = false, killOther = false;""",
"""    return ev.choices.map((c0, i) => { const c = effChoice(s, db, c0); const outs = [c.out, c.ok, c.fail].filter(Boolean); const axis = {}; let kill = false, killOther = false;""")
rep("""      return Object.assign(choiceState(s, db, ev, c), { i, axis, killYou: kill, killOther, check: !!c.check, gain }); });   // gain = 화면에 보이는 자원 변화 합(봇의 '자원 + 가장 큰 label')""",
"""      return Object.assign(choiceState(s, db, ev, c0), { i, axis, killYou: kill, killOther, check: !!c.check, gain, swapped: c !== c0 }); });   // gain = 화면에 보이는 자원 변화 합(봇의 '자원 + 가장 큰 label') · swapped = swap 변형이 맞았다""")

rep("""  const API = { SAVE_V, DELAYS, setFast, isFast, newGame, dispatch, normalize, view, eventView, choiceState, choiceMeta, rationOf, rand: R.rand, killsYou, known, heardKey, closedHolds, openStateOf, inspectGated,""",
"""  const API = { SAVE_V, DELAYS, setFast, isFast, newGame, dispatch, normalize, view, eventView, choiceState, choiceMeta, effChoice, eventTarget, inspectLineId, address, rationOf, rand: R.rand, killsYou, known, heardKey, closedHolds, openStateOf, inspectGated, NO_TARGET_WHY, SIGN_COLD_CALL_DEFAULT,""")
open(p, 'w', encoding='utf8').write(t)
print('ok')
