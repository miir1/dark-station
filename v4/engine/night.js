// 어두운 역 v4 — 밤 사건 굴림. 당신이 어디 있었든, 무엇을 골랐든 조건이 아니다 (E1·E9).
// 입력은 세계 시계(world)·날짜·주민 욕구·깃발·흔적 상태·시드 난수뿐. state.pos 는 절대 읽지 않는다.
// 결과는 두 가지로만 남는다: 흔적(state.traces) 과 소문(state.rumors). 기록은 state.nightLog (봇·검증용).
// 조건식에서 보이는 이름: 세계 수치 · day · 사람 수치(hunger, needs.hunger, injury) · 수치_사람(thirst_seoha) · 수치_target/_actor ·
//   물건 상태(body_rail==whole, bowl_target==empty, trace:x==v) · alive:x · flag:x (flag:x_actor / x_target 은 행위자·대상 id 로 치환) · secretFlag · bond · self
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode ? require('./cond.js') : root.DS4.cond;
  const R = isNode ? require('./rng.js') : root.DS4.rng;
  const FX = isNode ? require('./effects.js') : root.DS4.effects;

  const MAX_PER_NIGHT_DEFAULT = 2;  // numbers 표에 max_per_night 가 없을 때만
  const maxPerNight = (s) => (Number.isFinite(s.world.max_per_night) ? s.world.max_per_night : MAX_PER_NIGHT_DEFAULT);
  const RUMOR_TRUTH = 0.7;          // 소문이 참일 확률 (12_design_v3 §7: 거짓 30%)
  const RANDOM_TARGETS = ['any', 'randomSleeper', 'nearestSleeper', 'farthestSleeper'];   // 자리 정보가 없으므로 전부 무작위

  function worldCtx(s) {
    const ctx = Object.assign({}, s.world, { day: s.day });
    ctx.flags = s.flags;
    ctx.alive = {}; ctx.trace = {}; ctx.status = {};
    for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' ? 1 : 0; ctx.status[p.id] = p.status; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }
    for (const [id, tr] of Object.entries(s.traces)) { ctx.trace[id] = tr.st; if (ctx[id] === undefined) ctx[id] = tr.st; }
    return ctx;
  }
  // 역할(actor/target) 이 정해진 뒤의 조건식 환경
  function roleCtx(s, base, actor, target) {
    const ctx = Object.assign({}, base, actor.n, { injury: actor.n.injury || 0 });
    ctx.needs = actor.n;
    ctx.secret = actor.secretFlag ? 1 : 0; ctx.secretFlag = actor.secretFlag || '';
    ctx.bond = actor.needs.bond || '';
    ctx.self = actor.id;
    const flags = Object.assign({}, s.flags);
    const roles = { actor, target };
    for (const [role, p] of Object.entries(roles)) {
      if (!p) continue;
      for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${role}`] = v;
      for (const [id, tr] of Object.entries(s.traces)) if (id.endsWith('_' + p.id)) ctx[id.slice(0, -p.id.length) + role] = tr.st;
      for (const f of Object.keys(s.flags)) if (f.endsWith('_' + p.id)) flags[f.slice(0, -p.id.length) + role] = s.flags[f];
    }
    ctx.flags = flags;
    return ctx;
  }
  const sleepers = (s) => Object.values(s.people).filter((p) => p.status === 'home' && p.id !== 'you');
  // 디렉터 결정: 미성년(people.age < 19)은 잔혹 장면 프레임 밖. 낮 사건의 무작위 대상·원정 동행과 같은 규칙을 밤 악의에도 —
  // kind malice 행의 '표가 사람을 지목하지 않은' 역할(any·조건식 행위자, 무작위·mostInjured·조건식 대상)에 미성년은 들지 않는다.
  // 이름 지목·bond·you 는 표가 일부러 정한 것이라 그대로 둔다(steal_food_seoha·soonrye_water 등). neutral·hymn 행(굶어 죽음·상처 곪음·올라감·돌봄)도 그대로.
  const ADULT_AGE = 19;
  const isMinor = (db, id) => { const a = db.people[id] ? Number(db.people[id].age) : 0; return a > 0 && a < ADULT_AGE; };
  const adultOnly = (db, n, list) => (n.kind === 'malice' ? list.filter((p) => !isMinor(db, p.id)) : list);

  // 이름으로 지목된 행위자·대상은 바깥 사람(outside)이어도 된다 — 역 밖에서 하는 일(은채가 순찰대를 데려온다, 도현이 밸브를 잠근다).
  // any·조건식 행위자와 무작위 대상은 역에서 자는 사람(home)만.
  const reachable = (p) => p && (p.status === 'home' || p.status === 'outside');
  function resolveActors(s, db, n, base) {
    const home = adultOnly(db, n, sleepers(s));
    if (db.people[n.actor]) { const p = s.people[n.actor]; return reachable(p) && p.id !== 'you' ? [p] : []; }
    if (n.actor === 'any') return home;
    return home.filter((p) => C.test(n.actor, roleCtx(s, base, p, null)));
  }
  function resolveTarget(s, db, n, actor, base) {
    const t = n.target;
    if (!t || t === '-') return null;
    const others = adultOnly(db, n, sleepers(s).filter((p) => p.id !== actor.id));
    if (t === 'you') return s.people.you.status === 'home' ? s.people.you : null;
    if (t === 'bond') { const b = s.people[actor.needs.bond]; return b && b.status === 'home' ? b : null; }
    if (RANDOM_TARGETS.includes(t)) return R.pick(s, others) || null;
    if (t === 'mostInjured') { const hurt = others.filter((p) => (p.n.injury || 0) > 0).sort((a, b) => (b.n.injury || 0) - (a.n.injury || 0)); return hurt[0] || null; }
    if (db.people[t]) { const p = s.people[t]; return reachable(p) && p.id !== actor.id ? p : null; }
    let fit = [];
    try { fit = others.filter((p) => C.test(t, roleCtx(s, base, actor, p))); } catch (e) { fit = []; }   // 모르는 낱말(intruder 등) = 대상 없음
    return R.pick(s, fit) || null;
  }

  // 밤 하나를 굴린다. 돌려주는 값: 일어난 사건 목록 [{id, actor, target}]
  function rollNight(s, db) {
    const base = worldCtx(s);
    const cands = [];
    const clock = [];
    for (const n of db.nightEvents) {
      if (n.oncePerRun && Object.prototype.hasOwnProperty.call(s.onceNight, n.id)) continue;
      if (n.role === 'clock') { if (C.test(n.cond, base)) clock.push(n); continue; }   // 세계 시계: 조건이 맞으면 전부, 상한 밖
      for (const actor of resolveActors(s, db, n, base)) {
        const target = resolveTarget(s, db, n, actor, base);
        if (n.target && n.target !== '-' && !target) continue;      // 대상이 필요한데 없으면 못 일어난다
        if (!C.test(n.cond, roleCtx(s, base, actor, target))) continue;
        cands.push({ n, actor, target, weight: n.weight });
      }
    }
    const happened = [];
    const usedActors = new Set();
    let guard = 0;
    const cap = maxPerNight(s);
    while (happened.length < cap && cands.length && guard++ < 80) {
      const c = R.pickWeighted(s, cands);
      if (!c) break;
      cands.splice(cands.indexOf(c), 1);
      if (usedActors.has(c.actor.id) || (c.target && usedActors.has(c.target.id))) continue;
      usedActors.add(c.actor.id); if (c.target) usedActors.add(c.target.id);
      happened.push(c);
      enact(s, db, c);
    }
    for (const n of clock) { const c = { n, actor: null, target: null }; enact(s, db, c); happened.push(c); }
    return happened.map((c) => ({ id: c.n.id, actor: c.actor ? c.actor.id : null, target: c.target ? c.target.id : null }));
  }

  function enact(s, db, c) {
    const roles = { actor: c.actor ? c.actor.id : null, target: c.target ? c.target.id : null };
    const n = c.n;
    const traceIds = [];
    for (const [o, st] of Object.entries(n.trace || {})) { const id = FX.fillRole(o, roles); if (FX.setTrace(s, db, id, st, s.day, roles.actor)) traceIds.push(id); }
    const lines = [];
    if (n.effects) FX.apply(s, db, n.effects, roles.actor ? roles : { actor: 'world', target: null }, lines);   // 시계 사건의 수치는 세계 것
    let rumor = null;
    if (n.rumor && n.rumor.line) {
      let witness = null;
      if (n.rumor.witness && db.people[n.rumor.witness]) witness = n.rumor.witness;
      else if (n.rumor.witness === 'actor') witness = roles.actor;
      else if (n.rumor.witness === 'target' && roles.target && roles.target !== 'you' && s.people[roles.target] && s.people[roles.target].status === 'home') witness = roles.target;
      else { const w = R.pick(s, sleepers(s).filter((p) => p.id !== roles.actor && p.id !== roles.target)); witness = w ? w.id : null; }
      if (witness) { rumor = { day: s.day, event: n.id, witness, line: n.rumor.line, truth: R.chance(s, RUMOR_TRUTH) ? 1 : 0, heard: false, roles }; s.rumors.push(rumor); }
    }
    if (n.oncePerRun) s.onceNight[n.id] = s.day;
    s.nightLog.push({ day: s.day, id: n.id, kind: n.kind, role: n.role, actor: roles.actor, target: roles.target, traces: traceIds, rumor: !!rumor, lines, discovered: false });
  }

  // 조사·들음이 발견으로 이어진다 (엔진의 inspect/hear 가 부른다)
  function markInspected(s, objId) {
    const t = s.traces[objId];
    if (!t) return;
    for (const e of s.nightLog) if (e.day === t.day && e.traces.includes(objId)) e.discovered = true;
  }
  // 들은 소문은 참(truth 1)일 때만 발견이다 — 거짓 소문은 다른 일을 믿게 할 뿐 (10-22 결정)
  function markHeard(s, rumor) { if (!rumor || rumor.truth !== 1) return; for (const e of s.nightLog) if (e.day === rumor.day && e.id === rumor.event) e.discovered = true; }

  // 몸에 보이는 신호 (화면용, 수치 없이 참/거짓만). 문턱은 밤 사건표의 행위자 조건(actor 열의 조건식)을 그대로 쓴다.
  //   sleepless = 오늘 밤 안 잘 사람: role fear·ascend 사건의 행위자 조건이 맞는 사람 (당신 제외)
  //   starving  = 굶주린 사람: role steal·starve 사건의 행위자 조건이 맞는 사람 (any·이름 지목 행은 문턱이 아니라 뺀다)
  //   ateFlesh  = 사람을 먹은 사람: 깃발 ate_flesh_<id> 또는 <id>_ate… (예: dongha_ate_unknowing)
  const SIGN_ROLES = { sleepless: ['fear', 'ascend'], starving: ['steal', 'starve'] };
  function signs(s, db) {
    const base = worldCtx(s);
    const condActor = (n) => typeof n.actor === 'string' && n.actor !== '-' && n.actor !== 'any' && !db.people[n.actor];
    const rows = (roles) => db.nightEvents.filter((n) => roles.includes(n.role) && condActor(n));
    const sleepRows = rows(SIGN_ROLES.sleepless), starveRows = rows(SIGN_ROLES.starving);
    const fits = (list, ctx) => list.some((n) => { try { return C.test(n.actor, ctx); } catch (e) { return false; } });
    const out = {};
    for (const p of Object.values(s.people)) {
      if (p.status !== 'home') continue;
      const ctx = roleCtx(s, base, p, null);
      out[p.id] = { sleepless: p.id !== 'you' && fits(sleepRows, ctx), starving: fits(starveRows, ctx),
        ateFlesh: !!s.flags['ate_flesh_' + p.id] || Object.keys(s.flags).some((f) => s.flags[f] && f.startsWith(p.id + '_ate')) };
    }
    return out;
  }

  // 발견 집계(봇·검증용)
  function discovery(s) {
    const rows = s.nightLog.filter((e) => e.role !== 'clock');   // 세계 시계는 '주민 간 사건'이 아니다
    const total = rows.length;
    const found = rows.filter((e) => e.discovered).length;
    return { total, found, rate: total ? found / total : 0, unknown: total - found };
  }

  const API = { rollNight, discovery, markInspected, markHeard, signs, SIGN_ROLES, maxPerNight, RUMOR_TRUTH, worldCtx, roleCtx, ADULT_AGE, isMinor };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).night = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
