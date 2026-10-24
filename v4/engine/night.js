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
    for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' || p.status === 'away' ? 1 : 0; ctx.status[p.id] = p.status; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }   // away(아직 안 온 사람)도 살아 있음 — 행위자·대상은 아래 sleepers·reachable 이 home 만 고른다
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
  // 나이로 거르지 않는다(10-22 디렉터 결정 '미성년 처리 금지') — 서하(17)도 밤 사건의 행위자·대상·피해자가 다른 주민과 똑같이 된다.

  // 이름으로 지목된 행위자·대상은 바깥 사람(outside)이어도 된다 — 역 밖에서 하는 일(은채가 순찰대를 데려온다, 도현이 밸브를 잠근다).
  // any·조건식 행위자와 무작위 대상은 역에서 자는 사람(home)만. 아직 안 온 사람(away)은 어느 쪽도 아니다(10-24 P0-E1).
  const reachable = (p) => p && (p.status === 'home' || p.status === 'outside');
  function resolveActors(s, db, n, base) {
    const home = sleepers(s);
    if (db.people[n.actor]) { const p = s.people[n.actor]; return reachable(p) && p.id !== 'you' ? [p] : []; }
    if (n.actor === 'any') return home;
    return home.filter((p) => C.test(n.actor, roleCtx(s, base, p, null)));
  }
  function resolveTarget(s, db, n, actor, base) {
    const t = n.target;
    if (!t || t === '-') return null;
    const others = sleepers(s).filter((p) => p.id !== actor.id);
    if (t === 'you') return s.people.you.status === 'home' ? s.people.you : null;
    if (t === 'bond') { const b = s.people[actor.needs.bond]; return b && b.status === 'home' ? b : null; }
    if (RANDOM_TARGETS.includes(t)) return R.pick(s, others) || null;
    if (t === 'mostInjured') { const hurt = others.filter((p) => (p.n.injury || 0) > 0).sort((a, b) => (b.n.injury || 0) - (a.n.injury || 0)); return hurt[0] || null; }
    if (db.people[t]) { const p = s.people[t]; return reachable(p) && p.id !== actor.id ? p : null; }
    let fit = [];
    try { fit = others.filter((p) => C.test(t, roleCtx(s, base, actor, p))); } catch (e) { fit = []; }   // 모르는 낱말(intruder 등) = 대상 없음
    return R.pick(s, fit) || null;
  }

  // ── 방치 판정 (10-24 A4 E2) — "못 본 밤의 일은 커져서 돌아온다" ──
  // 밤 굴림 첫머리. 전날 밤(day == s.day−1)에 일어난 주민 사건 가운데 아직 판정하지 않은 것: 그 사이(아침 흔적 조사~저녁 소문)에
  // 발견했으면 caught, 못 봤으면 missed 를 그 사건의 행위자·대상 그대로 적용한다(둘 중 하나가 역에 없으면 건너뜀). 세계 시계·판정 줄은 판정하지 않는다.
  // 결과는 nightLog 에 { id:'<id>~missed'|'<id>~caught', role:'neglect', discovered:true } 한 줄 · missed 를 적용하면 s.stats.neglect++.
  // missed 가 바꾼 흔적은 late:1(조사 글 '<줄id>_late', E3). 더 오래된 줄은 판정 없이 judged 로만 둔다(옛 저장).
  // 돌려주는 값: 이번에 late 로 바꾼 물건 id 목록 — rollNight 가 같은 밤 뒤 사건이 그 물건을 다시 바꿔도 late 를 지킨다(10-24 검증 A4-4).
  function applyNeglect(s, db) {
    const rows = s.nightLog.slice();
    const lateIds = [];
    for (const e of rows) {
      if (e.judged || e.role === 'clock' || e.role === 'neglect') continue;
      if (e.day >= s.day) continue;
      e.judged = true;
      if (e.day !== s.day - 1) continue;
      const row = db.nightEvents.find((n) => n.id === e.id);
      const spec = row ? (e.discovered ? row.caught : row.missed) : null;
      if (!spec) continue;
      const here = (id) => !id || (s.people[id] && s.people[id].status === 'home');
      if (!e.actor || !here(e.actor) || !here(e.target)) continue;
      const roles = { actor: e.actor, target: e.target || null };
      const late = !e.discovered;
      const traceIds = [];
      for (const [o, st] of Object.entries(spec.trace || {})) { const id = FX.fillRole(o, roles); if (FX.setTrace(s, db, id, st, s.day, roles.actor, late)) { traceIds.push(id); if (late && !lateIds.includes(id)) lateIds.push(id); } }
      const lines = [];
      if (spec.effects) FX.apply(s, db, spec.effects, roles, lines);
      FX.noteHurt(s, lines, 'neglect:' + e.id);
      s.nightLog.push({ day: s.day, id: e.id + (e.discovered ? '~caught' : '~missed'), kind: row.kind, role: 'neglect', actor: roles.actor, target: roles.target, traces: traceIds, rumor: false, lines, discovered: true, judged: true });
      if (!e.discovered) s.stats.neglect = (s.stats.neglect || 0) + 1;
    }
    return lateIds;
  }

  // 밤 하나를 굴린다. 돌려주는 값: 일어난 사건 목록 [{id, actor, target}]
  // 순서: ① 방치 판정(applyNeglect) ② 주민 사건(상한 max_per_night, 행위자·대상 한 번씩) ③ 곁가지 행(side:1 — 상한 밖, 행마다 weight/10 확률로 한 번) ④ 세계 시계
  //   ⑤ (10-24 검증 A4-4) ① 이 late 로 바꾼 물건을 ②~④ 가 같은 밤에 다시 바꿨으면(setTrace 는 late 를 0 으로 쓴다) late 를 되살린다.
  //      '커져서 돌아온' 그 밤(grudge_boils·steal_meds_again·안개 등이 같은 물건을 건드린 밤)에 먼지·'_late' 글·토스트가 사라지지 않게. 효과는 그대로다.
  function rollNight(s, db) {
    const lateIds = applyNeglect(s, db);
    const base = worldCtx(s);
    const cands = [];
    const clock = [], side = [];
    const pairs = (n, ctx0) => {
      const out = [];
      for (const actor of resolveActors(s, db, n, ctx0)) {
        const target = resolveTarget(s, db, n, actor, ctx0);
        if (n.target && n.target !== '-' && !target) continue;      // 대상이 필요한데 없으면 못 일어난다
        if (!C.test(n.cond, roleCtx(s, ctx0, actor, target))) continue;
        out.push({ n, actor, target, weight: n.weight });
      }
      return out;
    };
    for (const n of db.nightEvents) {
      if (n.oncePerRun && Object.prototype.hasOwnProperty.call(s.onceNight, n.id)) continue;
      if (n.role === 'clock') { if (C.test(n.cond, base)) clock.push(n); continue; }   // 세계 시계: 조건이 맞으면 전부, 상한 밖
      if (n.side) { side.push(n); continue; }
      cands.push(...pairs(n, base));
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
    if (side.length) {
      const base2 = worldCtx(s);   // 주민 사건이 바꾼 뒤의 세계
      for (const n of side) {
        const ps = pairs(n, base2).filter((c) => c.actor.status === 'home' && (!c.target || c.target.status === 'home'));
        if (!ps.length || !R.chance(s, Math.min(10, n.weight) / 10)) continue;
        const c = R.pick(s, ps);
        happened.push(c); enact(s, db, c);
      }
    }
    for (const n of clock) { const c = { n, actor: null, target: null }; enact(s, db, c); happened.push(c); }
    for (const id of lateIds) { const t = s.traces[id]; if (t && t.day === s.day && !t.late) t.late = 1; }   // ⑤ 같은 밤에 덮인 late 를 되살린다
    return happened.map((c) => ({ id: c.n.id, actor: c.actor ? c.actor.id : null, target: c.target ? c.target.id : null }));
  }

  function enact(s, db, c) {
    const roles = { actor: c.actor ? c.actor.id : null, target: c.target ? c.target.id : null };
    const n = c.n;
    const traceIds = [];
    for (const [o, st] of Object.entries(n.trace || {})) { const id = FX.fillRole(o, roles); if (FX.setTrace(s, db, id, st, s.day, roles.actor)) traceIds.push(id); }
    const lines = [];
    if (n.effects) FX.apply(s, db, n.effects, roles.actor ? roles : { actor: 'world', target: null }, lines);   // 시계 사건의 수치는 세계 것
    FX.noteHurt(s, lines, 'night:' + n.id);
    let rumor = null;
    if (n.rumor && n.rumor.line) {
      let witness = null;
      if (n.rumor.witness && db.people[n.rumor.witness]) witness = s.people[n.rumor.witness] && s.people[n.rumor.witness].status === 'away' ? null : n.rumor.witness;   // 아직 안 온 사람은 본 것이 없다
      else if (n.rumor.witness === 'actor') witness = roles.actor;
      else if (n.rumor.witness === 'target' && roles.target && roles.target !== 'you' && s.people[roles.target] && s.people[roles.target].status === 'home') witness = roles.target;
      else { const w = R.pick(s, sleepers(s).filter((p) => p.id !== roles.actor && p.id !== roles.target)); witness = w ? w.id : null; }
      if (witness) { rumor = { day: s.day, event: n.id, witness, line: n.rumor.line, truth: R.chance(s, RUMOR_TRUTH) ? 1 : 0, heard: false, roles }; s.rumors.push(rumor); }
    }
    if (n.oncePerRun) s.onceNight[n.id] = s.day;
    // 누구나 아는 밤(public:1, 또는 kill 효과가 있는 행 — 사람이 죽거나 사라짐)은 굴릴 때 바로 발견 (10-24 A4)
    const known = !!(n.public || (n.effects && n.effects.kill));
    s.nightLog.push({ day: s.day, id: n.id, kind: n.kind, role: n.role, actor: roles.actor, target: roles.target, traces: traceIds, rumor: !!rumor, lines, discovered: known });
  }
  // 이 밤 줄이 '주민 사건'인가 — 세계 시계·방치 판정 줄은 아니다 (발견 집계·봇 통계·화면 '밤에 무슨 소리'가 같이 쓴다)
  const isResidentRow = (e) => !!e && e.role !== 'clock' && e.role !== 'neglect';

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
  //   cold      = 등을 돌린 사람(10-24 A1 E5): 원한 grudge ≥ 문턱(numbers 세계 수치 sign_cold, 행이 없으면 3). 당신은 늘 false
  //   starving 은 깃발만 보는 행위자 조건(예: steal_food_again 의 flag:unseen_thief_actor)을 문턱으로 쓰지 않는다 — 굶주리지 않은 도둑에게 '굶주림'이 켜지지 않게(검토 지적 23).
  //   sleepless 는 그대로 깃발 조건도 본다(ascend 의 flag:stood_stairs_actor = 계단에 섰던 사람은 안 잔다).
  const SIGN_ROLES = { sleepless: ['fear', 'ascend'], starving: ['steal', 'starve'] };
  const SIGN_COLD_DEFAULT = 3;
  const flagOnly = (src) => { try { const ns = C.names(C.compile(src)); return ns.length > 0 && ns.every((x) => C.prefixOf(x) === 'flag'); } catch (e) { return false; } };
  function signs(s, db) {
    const base = worldCtx(s);
    const condActor = (n) => typeof n.actor === 'string' && n.actor !== '-' && n.actor !== 'any' && !db.people[n.actor];
    const rows = (roles) => db.nightEvents.filter((n) => roles.includes(n.role) && condActor(n));
    const sleepRows = rows(SIGN_ROLES.sleepless), starveRows = rows(SIGN_ROLES.starving).filter((n) => !flagOnly(n.actor));
    const fits = (list, ctx) => list.some((n) => { try { return C.test(n.actor, ctx); } catch (e) { return false; } });
    const coldAt = Number.isFinite(s.world.sign_cold) ? s.world.sign_cold : SIGN_COLD_DEFAULT;
    const out = {};
    for (const p of Object.values(s.people)) {
      if (p.status !== 'home') continue;
      const ctx = roleCtx(s, base, p, null);
      out[p.id] = { sleepless: p.id !== 'you' && fits(sleepRows, ctx), starving: fits(starveRows, ctx),
        ateFlesh: !!s.flags['ate_flesh_' + p.id] || Object.keys(s.flags).some((f) => s.flags[f] && f.startsWith(p.id + '_ate')),
        cold: p.id !== 'you' && (p.n.grudge || 0) >= coldAt };
    }
    return out;
  }

  // 발견 집계(봇·검증용)
  function discovery(s) {
    const rows = s.nightLog.filter(isResidentRow);   // 세계 시계·방치 판정 줄은 '주민 간 사건'이 아니다 (10-24 E2)
    const total = rows.length;
    const found = rows.filter((e) => e.discovered).length;
    return { total, found, rate: total ? found / total : 0, unknown: total - found };
  }

  const API = { rollNight, applyNeglect, discovery, markInspected, markHeard, signs, SIGN_ROLES, SIGN_COLD_DEFAULT, isResidentRow, maxPerNight, RUMOR_TRUTH, worldCtx, roleCtx };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).night = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
