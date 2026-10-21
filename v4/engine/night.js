// 어두운 역 v4 — 밤 사건 굴림. 당신이 어디 있었든, 무엇을 골랐든 조건이 아니다 (E1·E9).
// 입력은 세계 시계(world)·날짜·주민 욕구·깃발·시드 난수뿐. state.pos 는 절대 읽지 않는다.
// 결과는 두 가지로만 남는다: 흔적(state.traces) 과 소문(state.rumors). 기록은 state.nightLog (봇·검증용).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode ? require('./cond.js') : root.DS4.cond;
  const R = isNode ? require('./rng.js') : root.DS4.rng;
  const FX = isNode ? require('./effects.js') : root.DS4.effects;

  const MAX_PER_NIGHT = 2;          // 한 밤에 일어나는 사건 상한 [제안]
  const RUMOR_TRUTH = 0.7;          // 소문이 참일 확률 (12_design_v3 §7: 거짓 30%)

  // 조건식에 보이는 값: 세계 수치 + day + 사람의 수치·욕구 (사람 조건일 때)
  function worldCtx(s) {
    const ctx = Object.assign({}, s.world, { day: s.day });
    ctx.flags = s.flags;
    ctx.alive = {}; ctx.trace = {}; ctx.status = {};
    for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' ? 1 : 0; ctx.status[p.id] = p.status; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }
    for (const [id, tr] of Object.entries(s.traces)) ctx.trace[id] = tr.st;
    return ctx;
  }
  function personCtx(s, base, p) {
    const ctx = Object.assign({}, base, p.n, { injury: p.n.injury || 0 });
    ctx.needs = p.n;                                   // needs.hunger 꼴도 받는다
    ctx.secret = p.secretFlag ? 1 : 0; ctx.secretFlag = p.secretFlag || '';
    ctx.bond = p.needs.bond || '';
    ctx.self = p.id;
    for (const k of Object.keys(p.permanent)) ctx[k] = 1;
    return ctx;
  }
  const sleepers = (s) => Object.values(s.people).filter((p) => p.status === 'home' && p.id !== 'you');

  function resolveActors(s, db, n, base) {
    const home = sleepers(s);
    if (db.people[n.actor]) { const p = s.people[n.actor]; return p && p.status === 'home' ? [p] : []; }
    if (n.actor === 'any') return home;
    return home.filter((p) => C.test(n.actor, personCtx(s, base, p)));
  }
  function resolveTarget(s, db, n, actor, base) {
    const t = n.target;
    if (!t || t === '-') return null;
    const others = sleepers(s).filter((p) => p.id !== actor.id);
    if (t === 'bond') { const b = s.people[actor.needs.bond]; return b && b.status === 'home' ? b : null; }
    if (t === 'any' || t === 'randomSleeper' || t === 'nearestSleeper' || t === 'farthestSleeper') return R.pick(s, others) || null;   // 자리 정보가 없으므로 전부 무작위
    if (t === 'mostInjured') { const hurt = others.filter((p) => (p.n.injury || 0) > 0).sort((a, b) => (b.n.injury || 0) - (a.n.injury || 0)); return hurt[0] || null; }
    if (db.people[t]) { const p = s.people[t]; return p && p.status === 'home' && p.id !== actor.id ? p : null; }
    const fit = others.filter((p) => C.test(t, personCtx(s, base, p)));
    return R.pick(s, fit) || null;
  }

  // 밤 하나를 굴린다. 돌려주는 값: 일어난 사건 목록 [{id, actor, target}]
  function rollNight(s, db) {
    const base = worldCtx(s);
    const cands = [];
    for (const n of db.nightEvents) {
      if (n.oncePerRun && Object.prototype.hasOwnProperty.call(s.onceNight, n.id)) continue;
      for (const actor of resolveActors(s, db, n, base)) {
        const ctx = personCtx(s, base, actor);
        if (!C.test(n.cond, ctx)) continue;
        const target = resolveTarget(s, db, n, actor, base);
        if (n.target && n.target !== '-' && !target) continue;      // 대상이 필요한데 없으면 못 일어난다
        cands.push({ n, actor, target, weight: n.weight });
      }
    }
    const happened = [];
    const usedActors = new Set();
    let guard = 0;
    while (happened.length < MAX_PER_NIGHT && cands.length && guard++ < 50) {
      const c = R.pickWeighted(s, cands);
      if (!c) break;
      cands.splice(cands.indexOf(c), 1);
      if (usedActors.has(c.actor.id) || (c.target && usedActors.has(c.target.id))) continue;
      usedActors.add(c.actor.id); if (c.target) usedActors.add(c.target.id);
      happened.push(c);
      enact(s, db, c);
    }
    return happened.map((c) => ({ id: c.n.id, actor: c.actor.id, target: c.target ? c.target.id : null }));
  }

  function enact(s, db, c) {
    const roles = { actor: c.actor.id, target: c.target ? c.target.id : null };
    const n = c.n;
    const traceIds = [];
    for (const [o, st] of Object.entries(n.trace || {})) { const id = FX.fillRole(o, roles); if (FX.setTrace(s, db, id, st, s.day, roles.actor)) traceIds.push(id); }
    const lines = [];
    if (n.effects) FX.apply(s, db, n.effects, roles, lines);
    let rumor = null;
    if (n.rumor && n.rumor.line) {
      let witness = null;
      if (n.rumor.witness && db.people[n.rumor.witness]) witness = n.rumor.witness;
      else if (n.rumor.witness === 'actor') witness = roles.actor;
      else { const w = R.pick(s, sleepers(s).filter((p) => p.id !== roles.actor && p.id !== roles.target)); witness = w ? w.id : null; }
      if (witness) { rumor = { day: s.day, event: n.id, witness, line: n.rumor.line, truth: R.chance(s, RUMOR_TRUTH) ? 1 : 0, heard: false, roles }; s.rumors.push(rumor); }
    }
    if (n.oncePerRun) s.onceNight[n.id] = s.day;
    s.nightLog.push({ day: s.day, id: n.id, kind: n.kind, actor: roles.actor, target: roles.target, traces: traceIds, rumor: !!rumor, lines, discovered: false });
  }

  // 발견 집계(봇·검증용): 흔적을 조사했거나 소문을 들은 사건
  function discovery(s) {
    const total = s.nightLog.length;
    let found = 0;
    for (const e of s.nightLog) {
      const seen = e.traces.some((t) => s.traces[t] && s.traces[t].seen && s.traces[t].day === e.day) || s.rumors.some((r) => r.event === e.id && r.day === e.day && r.heard);
      e.discovered = seen;
      if (seen) found++;
    }
    return { total, found, rate: total ? found / total : 0, unknown: total - found };
  }

  const API = { rollNight, discovery, MAX_PER_NIGHT, RUMOR_TRUTH, worldCtx, personCtx };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).night = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
