// 어두운 역 v4 — 해석기 뼈대. 규칙은 표에 있고, 여기는 표를 읽어 "지금 할 수 있는 일"과 "한 뒤의 결과"만 계산한다.
// 모든 조작은 dispatch(state, action) 하나. 상태는 함수 없는 순수 JSON (난수 포함). 화면·DOM·타이머 없음.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const D4 = isNode ? null : root.DS4;
  const C = isNode ? require('./cond.js') : D4.cond;
  const R = isNode ? require('./rng.js') : D4.rng;
  const FX = isNode ? require('./effects.js') : D4.effects;
  const NIGHT = isNode ? require('./night.js') : D4.night;
  const ID = isNode ? require('./identity.js') : D4.identity;
  const LEDGER = isNode ? require('./ledger.js') : D4.ledger;

  const SAVE_V = 1;
  const MAX_LOG = 80;
  const SKILL_PCT = 5;                      // 판정: base% + 기술 × 5%p (화면의 % = 실제 %)
  const ADULT_AGE = NIGHT.ADULT_AGE;        // 디렉터 결정: 미성년(people.age < 19)은 잔혹 장면 프레임 밖 — 사건의 무작위 대상·원정 동행·밤 악의의 무작위/조건 역할이 되지 않는다 (night.js 가 한 곳에서 정한다)
  const EVENT_RANDOM = ['any', 'randomSleeper', 'nearestSleeper', 'farthestSleeper'];   // 사건 대상 낱말(자리 정보 없음 = 무작위)
  const isMinor = NIGHT.isMinor;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const injuryMax = (db) => (db.numbers.injury ? db.numbers.injury.max : Infinity);   // 위독 = injury 의 최대값 (numbers 표)

  // ── 연출 지연 (화면이 읽는다). ?fast=1 이면 전부 0 ──
  const DELAYS_DEFAULT = { step: 230, type: 18, card: 1400, fade: 700, toast: 2000 };
  const DELAYS = Object.assign({}, DELAYS_DEFAULT);
  let fast = false;
  function setFast(on) { fast = !!on; for (const k of Object.keys(DELAYS)) DELAYS[k] = fast ? 0 : DELAYS_DEFAULT[k]; return fast; }
  const isFast = () => fast;

  // ── 새 판 ──
  function makePerson(db, id) {
    const p = db.people[id];
    const n = {};
    const needs = p.needs || {};
    // 사람 수치의 첫 값: numbers.start, 단 people.needs 에 적힌 값(hunger·thirst·fear)이 있으면 그것
    for (const def of db.numbersList) if (def.owner === 'person') n[def.id] = Number.isInteger(needs[def.id]) ? needs[def.id] : def.start;
    return { id, name: p.name, skills: Object.assign({}, p.skills), n, needs: { bond: needs.bond && needs.bond !== '-' ? needs.bond : '' },
      status: p.outside ? 'outside' : 'home', day: null, permanent: {}, secretFlag: p.secretFlag || null };
  }
  function newGame(db, seed) {
    seed = (seed == null ? 1 : seed) >>> 0;
    const world = {};
    for (const def of db.numbersList) if (def.owner === 'world') world[def.id] = def.start;
    const axes = {};
    for (const a of db.identity.axes) axes[a] = 0;
    const s = {
      v: SAVE_V, seed, rng: seed, day: world.day != null ? world.day : 0, phase: null, ended: null,
      world, people: {}, pos: { map: null, x: 0, y: 0 },
      flags: {}, traces: {}, axes, nightLog: [], rumors: [], onceNight: {}, done: {}, fired: {}, phaseSeen: [], critical: null, trip: null,
      pending: null, lastResult: null, ledger: { causes: {}, written: [] }, log: [], stats: { decisions: 0, nights: 0, deaths: 0 },
    };   // fired = 고른 적 있는 사건 id → 횟수(once:0 포함, 집계용) · phaseSeen = 이번 단계에 이미 고른 사건(되풀이 사건도 한 단계에 한 번) · critical = 그날 마지막 치료 기회 때의 위독자(아침 판정용)
    if (!db.people.you) throw new Error('people 표에 you 가 없음');
    for (const o of Object.values(db.objects)) s.traces[o.id] = { st: o.states[0], day: 0, by: null, seen: false };   // 물건의 첫 상태 = states[0]
    for (const id of db.peopleOrder) s.people[id] = makePerson(db, id);
    s.phase = firstPhase(s, db);
    enterPhase(s, db);
    return s;
  }

  // ── 단계 ──
  // 조건식에서 단계는 phase==night 처럼 쓴다 (phase id 'day' 와 수치 'day' 가 겹치므로 단계 이름을 키로 두지 않는다)
  function phaseCtx(s, extra) {
    const ctx = Object.assign({}, s.world, { day: s.day });
    ctx.flags = s.flags; ctx.phase = s.phase || '';
    ctx.map = s.pos.map || ''; ctx.region = s.trip ? s.trip.region : ''; ctx.floor = s.trip ? s.trip.floor : 0;
    ctx.trace = {}; for (const [id, t] of Object.entries(s.traces)) ctx.trace[id] = t.st;
    ctx.alive = {}; for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' ? 1 : 0; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }   // hunger_you, injury_gicheol (밤 사건 조건과 같은 어휘)
    Object.assign(ctx, s.people.you.n);                                                                     // 사건 when 에서 hunger·injury 는 당신 것
    ctx.inspect = {}; ctx.talk = {};
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }   // s.day 가 진실, world.day 는 따라간다. inspect:x / talk:x 는 그 조작 직후에만 참
  function phaseOf(db, id) { return db.phases.find((p) => p.id === id) || null; }
  function skipped(s, db, p) { return p.skipIf ? C.test(p.skipIf, phaseCtx(s)) : false; }
  function firstPhase(s, db) { for (const p of db.phases) if (!skipped(s, db, p)) return p.id; return db.phases[0].id; }
  function nextPhase(s, db) {
    const i = db.phases.findIndex((p) => p.id === s.phase);
    for (let k = i + 1; k < db.phases.length; k++) if (!skipped(s, db, db.phases[k])) return db.phases[k].id;
    return null;   // 하루 끝
  }
  function say(s, text, kind) { if (!text) return; s.log.unshift({ day: s.day, phase: s.phase, text, kind: kind || '' }); if (s.log.length > MAX_LOG) s.log.length = MAX_LOG; }

  // 단계에 들어설 때: 그 단계에 걸린 사건(시험·고정 장면·결말)이 있으면 pending 에 건다
  // 같은 단계에서 이미 고른 사건(phaseSeen)은 다시 걸지 않는다 — once:0(되풀이) 사건도 단계마다 한 번.
  // 사건에 target 열이 있으면 걸 때 대상을 정한다(못 정하면 그 사건은 지금 안 걸린다).
  function enterPhase(s, db, extra) {
    const ctx = phaseCtx(s, extra);
    s.pending = null;
    for (const ev of db.eventsList) {
      if (ev.kind === 'trip') continue;                     // 원정 사건은 원정 흐름이 따로 건다
      if (has(s.done, ev.id)) continue;                     // 값은 날짜(0 포함)라 in 으로 본다
      if (s.phaseSeen.includes(ev.id)) continue;
      if (!C.test(ev.when, ctx)) continue;
      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target); if (!target) continue; }
      s.pending = { id: ev.id, kind: ev.kind };
      if (target) s.pending.target = target;
      break;
    }
  }
  // 사건 대상: 사람 id(역에 있어야) · any/randomSleeper/… = 역에 있는 성인 주민 중 무작위 · mostInjured = 가장 많이 다친 주민 · bond = 당신의 bond
  function eventTarget(s, db, spec) {
    if (!spec) return null;
    if (db.people[spec]) return s.people[spec] && s.people[spec].status === 'home' ? spec : null;
    const res = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home' && !isMinor(db, id));
    if (EVENT_RANDOM.includes(spec)) return R.pick(s, res) || null;
    if (spec === 'mostInjured') { const hurt = res.filter((id) => (s.people[id].n.injury || 0) > 0).sort((a, b) => (s.people[b].n.injury || 0) - (s.people[a].n.injury || 0)); return hurt[0] || null; }
    if (spec === 'bond') { const b = s.people.you.needs.bond; return b && s.people[b] && s.people[b].status === 'home' ? b : null; }
    return null;
  }
  const newPhase = (s, id) => { s.phase = id; s.phaseSeen = []; };
  // 조사·말 걸기 직후: 그 조작에 걸린 사건이 있으면 건다 (when 에 inspect:x / talk:x)
  const checkEvents = (s, db, extra) => { if (!s.pending) enterPhase(s, db, extra); return !!s.pending; };

  // 하루 끝 → 새 날
  // 위독(injury 최대값) + 치료 깃발 없음 → 아침에 죽는다. 단 그날 마지막 치료 기회(treat 가 있는 단계)를 떠날 때 이미 위독이던 사람만(s.critical) —
  // 그 뒤(밤 단계 사건·밤 굴림)에 막 위독이 된 사람은 하루를 받는다(다음 날 경고·치료 기회). 명단이 없는 날은 지금 위독이면 판정.
  function newDay(s, db) {
    const crit = s.critical && s.critical.day === s.day ? s.critical.ids : null;
    s.day += 1;
    if (db.numbers.day) s.world.day = s.day;
    for (const def of db.numbersList) if (def.owner === 'world' && def.perDay) s.world[def.id] = Math.max(def.min, Math.min(def.max, s.world[def.id] + def.perDay));
    const injMax = injuryMax(db);
    for (const p of Object.values(s.people)) {
      if (p.status !== 'home') continue;
      for (const def of db.numbersList) if (def.owner === 'person' && def.perDay) p.n[def.id] = Math.max(def.min, Math.min(def.max, (p.n[def.id] || 0) + def.perDay));
      const wasCrit = crit ? crit.includes(p.id) : true;
      if ((p.n.injury || 0) >= injMax && wasCrit && s.flags[`treated_${p.id}`] !== true) { FX.kill(s, p.id, s.day, null, 'dead'); s.stats.deaths++; say(s, `${p.name} — 밤에 갔다.`, 'dead'); if (p.id === 'you') s.lastResult = { event: 'injury_untreated', choice: '위독을 치료하지 않음', warned: false, roll: null, text: '', lines: [], image: '' }; }
      delete s.flags[`treated_${p.id}`];
    }
    s.critical = null;
    // 아침에 지워지는 흔적: 그날 첫 단계(아침 흔적 조사)를 떠날 때 지운다 — 밤에 남은 것을 볼 기회를 준 뒤
    s.morningReset = true;
    if (!Object.values(s.people).some((p) => p.status === 'home' && p.id !== 'you')) { endGame(s, db, 'all_dead'); return; }
    const dayDef = db.numbers.day;
    if (dayDef && s.day > dayDef.max) { endGame(s, db, 'train'); return; }
    if (s.people.you.status !== 'home') { endGame(s, db, 'you_gone'); return; }
    newPhase(s, firstPhase(s, db));
    enterPhase(s, db);
  }
  // 끝: ev = 결말 사건 행(kind ending)이면 그 열을 읽는다.
  //   board:1 → board_<id> 깃발이 선 주민은 'boarded' · endStatus → 역에 남은 산 사람(당신 포함)의 status (walked 등, 기본 그대로 = 명부 '남았다')
  //   열차가 그냥 온 끝(why train)도 board 깃발을 태운다.
  // cause: 당신이 죽었거나 올라갔거나 떠났으면 마지막 결과(사건 id·선택·경고 여부·결과 그림·밤 사건 여부). 결말 사건 안의 죽음도 여기 남는다.
  function endGame(s, db, why, ev) {
    const endEv = ev && ev.kind === 'ending' ? ev : null;
    const boarding = (endEv && endEv.board) || why === 'train';
    for (const p of Object.values(s.people)) {
      if (p.status !== 'home') continue;
      if (boarding && p.id !== 'you' && s.flags[`board_${p.id}`]) { p.status = 'boarded'; continue; }
      if (endEv && endEv.endStatus && endEv.endStatus !== 'stayed') p.status = endEv.endStatus;
    }
    const c = ID.identity(s.axes, db.identity);
    const you = s.people.you;
    const youGone = why === 'you_gone' || you.status === 'dead' || you.status === 'ascended';
    const r = s.lastResult;
    s.ended = { why, identity: c ? c.id : null, reader: LEDGER.reader(s, db), readerId: LEDGER.readerId(s, db), ledger: LEDGER.rows(s, db),
      cause: youGone && r ? { event: r.event, choice: r.choice, warned: !!r.warned, image: r.image || '', night: !!r.night } : null };
    s.phase = 'ended'; s.pending = null;
  }

  // ── 선택 ──
  function choiceState(s, db, ev, c) {
    const you = s.people.you;
    const locked = [];
    if (c.req) {
      if (c.req.flag && !s.flags[c.req.flag]) locked.push('조건이 맞지 않다');
      if (c.req.permanent && !you.permanent[c.req.permanent]) locked.push('조건이 맞지 않다');
      if (c.req.notPermanent && you.permanent[c.req.notPermanent]) locked.push(`${c.req.notPermanent === 'finger' ? '손가락' : c.req.notPermanent === 'leg' ? '다리' : '귀'}가 성치 않다`);
    }
    if (c.cost) for (const [k, v] of Object.entries(c.cost)) { const have = db.numbers[k].owner === 'world' ? s.world[k] : you.n[k]; if ((have || 0) < v) locked.push(`${db.numbers[k].name || k}이(가) 모자라다`); }
    const chance = c.check ? Math.max(0, Math.min(100, c.check.base + SKILL_PCT * (you.skills[c.check.skill] || 0))) : null;
    return { label: c.label, locked: locked.length > 0, reason: locked.join(', '), chance, hint: c.hint || '', warn: c.warn || '', cost: c.cost || null, taboo: !!c.taboo };
  }
  function eventView(s, db) {
    if (!s.pending) return null;
    const ev = db.events[s.pending.id];
    const t = s.pending.target || null;
    return { id: ev.id, kind: ev.kind, grade: ev.grade, explicit: !!ev.explicit, text: ev.text, image: ev.image || '', target: t, targetName: t && s.people[t] ? s.people[t].name : '', board: !!ev.board,
      choices: ev.choices.map((c) => choiceState(s, db, ev, c)) };
  }
  function choose(s, db, i) {
    if (!s.pending) return false;
    const ev = db.events[s.pending.id];
    const c = ev.choices[i];
    if (!c) return false;
    const st = choiceState(s, db, ev, c);
    if (st.locked) return false;
    const lines = [];
    if (c.cost) for (const [k, v] of Object.entries(c.cost)) FX.setNumber(s, db, k, 'you', -v, lines);
    let roll = null, out = c.out;
    if (c.check) { const ok = R.rand(s) * 100 < st.chance; roll = { chance: st.chance, success: ok }; out = ok ? c.ok : c.fail; }
    const roles = rolesFor(s, db, out);
    if (out && out.effects) FX.apply(s, db, out.effects, roles, lines);
    if (out && out.ledger) applyLedger(s, db, out.ledger, roles);
    s.lastResult = { event: ev.id, choice: c.label, i, warned: !!(c.warn || c.hint || c.taboo), roll, text: (out && out.text) || '', lines, image: (out && out.image) || '', target: roles.target, companion: roles.companion };
    if (ev.once === 0 ? false : (ev.once || ev.kind === 'fixed' || ev.kind === 'trial' || ev.kind === 'ending')) s.done[ev.id] = s.day;   // once:0 이면 되풀이(미룬다 류)
    s.fired[ev.id] = (s.fired[ev.id] || 0) + 1;
    if (!s.phaseSeen.includes(ev.id)) s.phaseSeen.push(ev.id);
    s.stats.decisions++;
    say(s, c.label, 'choice');
    s.pending = null;
    if (ev.kind === 'ending') { endGame(s, db, ev.id, ev); return true; }
    if (s.people.you.status !== 'home') { endGame(s, db, 'you_gone'); return true; }
    enterPhase(s, db);                 // 사건 연쇄: 고른 뒤 같은 단계에 걸릴 사건을 다시 찾는다 (끝난 once 사건·이번 단계에 고른 사건은 빠진다)
    return true;
  }
  // 선택 결과의 역할: actor 당신 · target(결과의 target 열 > 사건이 걸릴 때 정한 대상) · 원정 중이면 party(당신 + 동행)·companion(살아 있는 첫 동행)
  function rolesFor(s, db, out) {
    let target = null;
    if (out && out.target) target = db.people[out.target] ? (s.people[out.target].status === 'home' ? out.target : null) : eventTarget(s, db, out.target);
    else if (s.pending && s.pending.target) target = s.pending.target;
    const mates = s.trip && Array.isArray(s.trip.party) ? s.trip.party.filter((id) => s.people[id] && s.people[id].status === 'home') : [];
    return { actor: 'you', target, companion: mates[0] || null, party: ['you'].concat(mates) };
  }
  // 결과의 명부 줄: { who, status, day, cause, text } 또는 그 목록, 또는 글 한 줄(당신의 사실 줄).
  //   status boarded/stayed/walked → 아직 역에 있는(home) 사람의 status 를 바꾼다 (dead/ascended 는 kill 효과가 정한다 — 여기선 기록만)
  //   cause → 죽었거나 올라간 사람의 사인 칸 (글, 또는 "물건:상태" = 그 물건의 ledgerFact 줄) · text → 사실 줄(written) · 비어 있으면 아무것도 쌓지 않는다
  function applyLedger(s, db, spec, roles) {
    for (const L of Array.isArray(spec) ? spec : [spec]) {
      if (typeof L === 'string') { if (L) s.ledger.written.push({ day: s.day, who: 'you', text: L }); continue; }
      if (!L || typeof L !== 'object') continue;
      for (const who of FX.resolveWhos(L.who || 'you', roles, s)) {
        const p = s.people[who]; if (!p) continue;
        const day = L.day === '{day}' ? s.day : L.day !== '' && L.day != null && Number.isFinite(Number(L.day)) ? Number(L.day) : null;
        if ((L.status === 'boarded' || L.status === 'stayed' || L.status === 'walked') && p.status === 'home') { p.status = L.status; if (p.day == null && day != null) p.day = day; }
        if (typeof L.cause === 'string' && L.cause && (p.status === 'dead' || p.status === 'ascended')) { const t = causeText(s, db, L.cause); if (t) s.ledger.causes[who] = t; }
        if (typeof L.text === 'string' && L.text) s.ledger.written.push({ day: s.day, who, text: L.text });
      }
    }
  }
  function causeText(s, db, cause) {
    const m = /^([a-z0-9_]+):([a-z0-9_]+)$/.exec(cause);
    if (!m) return cause;
    const o = db.objects[m[1]]; if (!o || !o.ledgerFact || !o.ledgerFact[m[2]]) return null;
    const t = s.traces[m[1]]; const same = t && t.st === m[2];
    return String(o.ledgerFact[m[2]]).replace(/\{day\}/g, same ? t.day : s.day).replace(/\{by\}/g, same && t.by && s.people[t.by] ? s.people[t.by].name : '');
  }

  // ── 조사·소문·명부 ──
  function inspect(s, db, objId) {
    if (!db.objects[objId]) return false;
    const t = s.traces[objId];
    if (t) { t.seen = true; NIGHT.markInspected(s, objId); }
    s.stats.decisions++;
    checkEvents(s, db, { inspect: { [objId]: 1 } });
    return true;
  }
  function hear(s, i) { const r = s.rumors[i]; if (!r) return false; r.heard = true; NIGHT.markHeard(s, r); return true; }
  // 원정: 지금 지역·층에 맞는 원정 사건 하나를 건다 (같은 원정에서 같은 사건은 한 번)
  function startTripEvent(s, db) {
    const ctx = phaseCtx(s);
    const fit = db.eventsList.filter((ev) => ev.kind === 'trip' && !(s.trip.done || []).includes(ev.id) && !(ev.once && Object.prototype.hasOwnProperty.call(s.done, ev.id)) && C.test(ev.when, ctx));
    if (!fit.length) return false;
    const ev = R.pick(s, fit);
    s.pending = { id: ev.id, kind: 'trip' };
    (s.trip.done = s.trip.done || []).push(ev.id);
    return true;
  }
  // 배식: numbers 표의 ration_food · ration_water · ration_hunger · ration_thirst (없으면 1·1·−4·−4)
  function rationOf(s) { const w = s.world; return { food: Number.isFinite(w.ration_food) ? w.ration_food : 1, water: Number.isFinite(w.ration_water) ? w.ration_water : 1, hunger: Number.isFinite(w.ration_hunger) ? w.ration_hunger : -4, thirst: Number.isFinite(w.ration_thirst) ? w.ration_thirst : -4 }; }
  // 받은 그릇은 full, 못 받은 그릇(bowls 에 0 이거나 식량·물이 모자람)은 empty — 둘 다 당신이 한 일이라 본 것(seen)으로 둔다.
  // 그래서 밤에 그릇이 바뀌면(빈 그릇이 찼다·찬 그릇이 비었다) 아침 흔적으로 구별된다.
  function ration(s, db, bowls) {
    if (!bowls || typeof bowls !== 'object') return false;
    const RATION = rationOf(s);
    for (const [who, on] of Object.entries(bowls)) {
      const p = s.people[who]; if (!p || p.status !== 'home') continue;
      let fed = false;
      if (on && (s.world.food || 0) >= RATION.food && (s.world.water || 0) >= RATION.water) {
        FX.setNumber(s, db, 'food', who, -RATION.food); FX.setNumber(s, db, 'water', who, -RATION.water);
        FX.setNumber(s, db, 'hunger', who, RATION.hunger); FX.setNumber(s, db, 'thirst', who, RATION.thirst);
        fed = true;
      }
      const bowl = db.objects['bowl_' + who];
      if (bowl) { const st = fed ? (bowl.states.includes('full') ? 'full' : bowl.states[0]) : bowl.states.includes('empty') ? 'empty' : null; if (st && FX.setTrace(s, db, 'bowl_' + who, st, s.day, 'you')) s.traces['bowl_' + who].seen = true; }
    }
    s.stats.decisions++;
    return true;
  }
  // 치료: numbers 표의 treat_meds 만큼 약을 쓰고(모자라면 거절) 대상 부상에 treat_injury 를 더한 뒤 treated_<who> 깃발.
  // 다친 데가 없거나 오늘 이미 치료했거나 표에 치료 규칙(두 행)이 없으면 거절.
  function treat(s, db, who) {
    const p = s.people[who];
    if (!p || p.status !== 'home' || (p.n.injury || 0) <= 0 || s.flags[`treated_${who}`]) return false;
    if (!db.numbers.treat_meds || !db.numbers.treat_injury || !db.numbers.meds) return false;
    const need = s.world.treat_meds, heal = s.world.treat_injury;
    if (!Number.isFinite(need) || !Number.isFinite(heal) || (s.world.meds || 0) < need) return false;
    const lines = [];
    FX.setNumber(s, db, 'meds', 'world', -need, lines);
    FX.setNumber(s, db, 'injury', who, heal, lines);
    s.flags[`treated_${who}`] = true;
    s.stats.decisions++;
    say(s, `${p.name} — 치료`, 'treat');
    return true;
  }
  // 원정 편성: numbers 표의 trip_party(동행 수, 없으면 0 = 혼자). with:[id] 로 고르거나, 안 주면 시드 난수로 고른다.
  // 동행이 될 수 있는 사람 = 역에 있는 주민 중 위독이 아니고 미성년이 아닌 사람. 고를 수 없는 사람이 있으면 null(거절).
  function pickParty(s, db, want) {
    const size = Number.isFinite(s.world.trip_party) ? Math.max(0, s.world.trip_party) : 0;
    const injMax = injuryMax(db);
    const ok = (id) => typeof id === 'string' && id !== 'you' && s.people[id] && s.people[id].status === 'home' && (s.people[id].n.injury || 0) < injMax && !isMinor(db, id);
    if (Array.isArray(want)) { const u = Array.from(new Set(want)); return u.length <= size && u.every(ok) ? u : null; }
    const pool = db.peopleOrder.filter(ok), out = [];
    while (out.length < size && pool.length) out.push(pool.splice(Math.floor(R.rand(s) * pool.length), 1)[0]);
    return out;
  }
  // 원정 동작: 낮에 한 번(지역 하나). 첫 동작은 1층, 그다음은 바로 아래층만(층마다 한 번). 걸린 사건이 있으면 못 간다.
  function trip(s, db, a) {
    if (s.pending) return false;
    if (!s.trip) {
      if (typeof a.region !== 'string' || !a.region) return false;
      const floor = Number.isInteger(a.floor) ? a.floor : 1;
      if (floor !== 1) return false;
      const party = pickParty(s, db, a.with);
      if (party === null) return false;
      s.trip = { region: a.region, floor: 1, floors: [1], party, done: [] };
    } else {
      if (!Number.isInteger(a.floor) || (a.region && a.region !== s.trip.region)) return false;
      const floors = s.trip.floors || [s.trip.floor];
      if (floors.includes(a.floor) || !floors.includes(a.floor - 1)) return false;
      s.trip.floor = a.floor; s.trip.floors = floors.concat([a.floor]);
    }
    return startTripEvent(s, db);
  }
  function writeCause(s, db, who, line) {
    const p = s.people[who];
    if (!p || (p.status !== 'dead' && p.status !== 'ascended')) return false;
    if (line != null && typeof line !== 'string') return false;
    s.ledger.causes[who] = line == null ? null : line;      // null = 빈칸 ("___")
    return true;
  }
  function writeFact(s, db, objId) {
    const t = s.traces[objId], o = db.objects[objId];
    if (!t || !t.seen || !o || !o.ledgerFact || !o.ledgerFact[t.st]) return false;
    const text = String(o.ledgerFact[t.st]).replace(/\{day\}/g, t.day).replace(/\{by\}/g, t.by && s.people[t.by] ? s.people[t.by].name : '');
    s.ledger.written.push({ day: s.day, who: t.by || 'you', object: objId, text });
    return true;
  }

  // ── dispatch ──
  const isIdx = (v) => Number.isInteger(v) && v >= 0;
  const criticalNow = (s, db) => { const injMax = injuryMax(db); return { day: s.day, ids: Object.values(s.people).filter((p) => p.status === 'home' && (p.n.injury || 0) >= injMax).map((p) => p.id) }; };
  function dispatch(s, a, db) {
    if (!db) return { ok: false, error: '표(db)가 없다' };
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') return { ok: false, error: '잘못된 동작' };
    if (s.ended) return { ok: false, error: '끝난 판' };
    const phase = phaseOf(db, s.phase);
    const ALIAS = { writeCause: 'writeLedger', writeFact: 'writeLedger', hear: 'talk', ration: 'setBowl' };   // 표의 동작 이름 ↔ 엔진 동작
    const pend = s.pending ? db.events[s.pending.id] : null;
    const allowed = (t) => t === 'next' || t === 'choose' || t === 'move' || t === 'setFlag' || (phase && (phase.actions.includes(t) || phase.actions.includes(ALIAS[t])))
      || (t === 'board' && !!(pend && pend.board));          // board:1 결말이 걸려 있으면 태울 사람을 고를 수 있다
    if (!allowed(a.type)) return { ok: false, error: `지금(${s.phase})은 할 수 없는 동작: ${a.type}` };
    let ok = false;
    switch (a.type) {
      case 'next': {
        if (s.pending) return { ok: false, error: '먼저 골라야 한다' };
        // 위독 명단: 치료할 수 있는 단계(actions 에 treat)를 떠날 때 찍는다 — 마지막 치료 기회 뒤에 위독이 된 사람
        // (밤 단계의 고정·시험 사건, 밤 굴림)은 하루를 받는다. 치료 단계가 없는 표면 밤 굴림 직전에 찍는다.
        if (phase && phase.actions.includes('treat')) s.critical = criticalNow(s, db);
        if (phase && (phase.hook === 'rollNight' || phase.actions.includes('rollNight'))) {
          if (!(s.critical && s.critical.day === s.day)) s.critical = criticalNow(s, db);
          const youWere = s.people.you.status;
          const n0 = s.nightLog.length;
          const got = NIGHT.rollNight(s, db); s.stats.nights++; for (const g of got) say(s, `[밤] ${g.id}`, 'night');
          if (youWere === 'home' && s.people.you.status !== 'home') {        // 밤 사건이 당신을 데려갔다 → 사인은 그 밤 사건 (그 전 선택이 아니다)
            const e = s.nightLog.slice(n0).find((x) => (x.lines || []).some((l) => l.who === 'you' && l.kind !== 'number' && l.kind !== 'permanent'));
            const row = e ? db.nightEvents.find((n) => n.id === e.id) : null;
            s.lastResult = { event: e ? e.id : 'night', choice: null, i: null, warned: false, night: true, roll: null, text: (row && row.text) || '', lines: e ? e.lines : [], image: '' };
          }
        }
        s.trip = null;
        if (s.morningReset) { s.morningReset = false; for (const [id, t] of Object.entries(s.traces)) { const o = db.objects[id]; if (!o) continue; if (o.resetOn === 'morning' || (o.resetOn === 'inspect' && t.seen && t.day < s.day)) s.traces[id] = { st: o.states[0], day: s.day, by: null, seen: false }; } }   // 지워짐 = 첫 상태로
        const nx = nextPhase(s, db);
        if (nx === null) newDay(s, db); else { newPhase(s, nx); enterPhase(s, db); }
        ok = true; break;
      }
      case 'choose': if (!isIdx(a.i)) break; ok = choose(s, db, a.i); break;
      case 'inspect': if (typeof a.object !== 'string') break; ok = inspect(s, db, a.object); break;
      case 'hear': if (!isIdx(a.i)) break; ok = hear(s, a.i); break;
      case 'writeCause': if (typeof a.who !== 'string') break; ok = writeCause(s, db, a.who, a.line === undefined ? null : a.line); break;
      case 'writeFact': if (typeof a.object !== 'string') break; ok = writeFact(s, db, a.object); break;
      case 'trip': ok = trip(s, db, a); break;
      case 'ration': ok = ration(s, db, a.bowls); break;
      case 'talk': { const p = s.people[a.who]; if (!p || p.status !== 'home' || a.who === 'you') break; s.stats.decisions++; checkEvents(s, db, { talk: { [a.who]: 1 } }); ok = true; break; }
      case 'treat': if (typeof a.who !== 'string') break; ok = treat(s, db, a.who); break;
      case 'board': { const p = s.people[a.who]; if (!p || p.status !== 'home' || a.who === 'you') break; if (s.flags[`board_${a.who}`]) delete s.flags[`board_${a.who}`]; else s.flags[`board_${a.who}`] = true; ok = true; break; }   // 다시 누르면 내린다
      case 'move': if (!a.map || !db.maps[a.map] || !Number.isInteger(a.x) || !Number.isInteger(a.y)) break; s.pos = { map: a.map, x: a.x, y: a.y }; checkEvents(s, db); ok = true; break;   // 지도에 들어서면 그 지도에 걸린 사건을 찾는다
      case 'setFlag': if (typeof a.flag !== 'string' || !/^[a-z_]{1,24}$/.test(a.flag)) break; s.flags[a.flag] = true; ok = true; break;
      default: return { ok: false, error: '알 수 없는 동작' };
    }
    return { ok, error: ok ? '' : '지금은 할 수 없는 동작' };
  }

  // ── 저장 데이터 정규화 (마이그레이션은 save.js 가 먼저 돌린다) ──
  function normalize(raw, db) {
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_V) return null;
    if (!raw.people || typeof raw.people !== 'object' || !raw.people.you || !raw.world || typeof raw.world !== 'object') return null;   // 사람·세계가 없으면 저장이 아니다
    const base = newGame(db, raw.seed || 1);
    const s = Object.assign(base, raw);
    for (const k of ['world', 'flags', 'traces', 'axes', 'onceNight', 'done', 'fired', 'stats']) s[k] = Object.assign({}, base[k], raw[k] || {});
    if (!Array.isArray(s.phaseSeen)) s.phaseSeen = [];
    if (!s.critical || typeof s.critical !== 'object' || !Array.isArray(s.critical.ids)) s.critical = null;
    for (const def of db.numbersList) if (def.owner === 'world' && !Number.isFinite(s.world[def.id])) s.world[def.id] = def.start;
    for (const k of ['nightLog', 'rumors', 'log']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.ledger || typeof s.ledger !== 'object') s.ledger = { causes: {}, written: [] };
    if (!s.ledger.causes) s.ledger.causes = {}; if (!Array.isArray(s.ledger.written)) s.ledger.written = [];
    for (const id of db.peopleOrder) {
      const bp = makePerson(db, id), p = s.people[id];
      if (!p || typeof p !== 'object') { s.people[id] = bp; continue; }
      p.n = Object.assign({}, bp.n, p.n || {}); p.needs = Object.assign({}, bp.needs, p.needs || {}); p.skills = Object.assign({}, bp.skills, p.skills || {});
      if (!p.permanent || typeof p.permanent !== 'object') p.permanent = {};
      if (!['home', 'dead', 'ascended', 'boarded', 'outside', 'stayed', 'walked'].includes(p.status)) p.status = 'home';
      for (const def of db.numbersList) if (def.owner === 'person' && !Number.isFinite(p.n[def.id])) p.n[def.id] = def.start;
    }
    if (typeof s.rng !== 'number') s.rng = s.seed >>> 0;
    if (!Number.isInteger(s.day)) s.day = 0;
    if (s.trip !== null && typeof s.trip !== 'object') s.trip = null;
    if (s.trip) { if (!Array.isArray(s.trip.floors)) s.trip.floors = [s.trip.floor || 1]; if (!Array.isArray(s.trip.party)) s.trip.party = []; if (!Array.isArray(s.trip.done)) s.trip.done = []; }
    if (!s.pos || typeof s.pos !== 'object') s.pos = { map: null, x: 0, y: 0 };
    s.morningReset = !!s.morningReset;
    if (!s.ended && !phaseOf(db, s.phase)) return null;          // 모르는 단계 = 구조가 어긋난 저장
    if (s.pending && !db.events[s.pending.id]) s.pending = null;
    return s;
  }

  // ── 화면·봇이 보는 것 ──
  // people[].signs = { sleepless, starving, ateFlesh } — 몸에 보이는 신호(참/거짓만, 문턱은 밤 사건표). 역에 없는 사람은 null.
  // trip = { region, floor, floors, party } (원정 중일 때) — party 는 동행 id 목록(당신 제외)
  function view(s, db) {
    const phase = phaseOf(db, s.phase);
    const sg = NIGHT.signs(s, db);
    return {
      day: s.day, phase: s.phase, ended: s.ended, actions: phase ? phase.actions.slice() : [],
      world: Object.fromEntries(db.numbersList.filter((d) => d.owner === 'world' && d.visible !== 'never').map((d) => [d.id, s.world[d.id]])),
      people: db.peopleOrder.map((id) => { const p = s.people[id]; return { id, name: p.name, status: p.status, injury: p.n.injury || 0, permanent: Object.keys(p.permanent), signs: sg[id] || null }; }),
      trip: s.trip ? { region: s.trip.region, floor: s.trip.floor, floors: (s.trip.floors || []).slice(), party: (s.trip.party || []).slice() } : null,
      traces: Object.entries(s.traces).map(([id, t]) => ({ id, state: t.st, seen: t.seen })),
      rumors: s.rumors.filter((r) => !r.heard).length,
      event: eventView(s, db),
    };
  }

  // 봇 전용 메타: 선택지마다 축 효과·당신 사망 여부·비용. 화면은 이걸 보면 안 된다 (E6).
  function choiceMeta(s, db) {
    if (!s.pending) return null;
    const ev = db.events[s.pending.id];
    return ev.choices.map((c, i) => { const outs = [c.out, c.ok, c.fail].filter(Boolean); const axis = {}; let kill = false, killOther = false;
      let gain = 0;
      const meWho = (w) => !w || w === 'you' || w === 'self' || w === 'actor' || w === 'party' || w === 'all';
      for (const o of outs) { const e = o.effects || {}; for (const [k, v] of Object.entries(e.axis || {})) axis[k] = (axis[k] || 0) + v;
        if (e.kill) for (const kv of FX.list(e.kill)) { if (meWho(kv.who)) kill = true; else killOther = true; }
        for (const [k, v] of Object.entries(e)) { const d = db.numbers[k]; if (d && d.owner === 'world' && d.visible === 'always') for (const x of FX.list(v)) gain += typeof x === 'number' ? x : (x && x.n) || 0; } }
      return Object.assign(choiceState(s, db, ev, c), { i, axis, killYou: kill, killOther, check: !!c.check, gain }); });   // gain = 화면에 보이는 자원 변화 합(봇의 '자원 + 가장 큰 label')
  }
  const API = { SAVE_V, DELAYS, setFast, isFast, newGame, dispatch, normalize, view, eventView, choiceState, choiceMeta, rationOf, rand: R.rand, ADULT_AGE, isMinor,
    identity: (s, db) => ID.identity(s.axes, db.identity), signs: (s, db) => NIGHT.signs(s, db), readerId: (s, db) => LEDGER.readerId(s, db), ledger: LEDGER, night: NIGHT, cond: C };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).engine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
