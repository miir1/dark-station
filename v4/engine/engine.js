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
      flags: {}, traces: {}, axes, nightLog: [], rumors: [], onceNight: {}, done: {}, trip: null,
      pending: null, lastResult: null, ledger: { causes: {}, written: [] }, log: [], stats: { decisions: 0, nights: 0, deaths: 0 },
    };
    if (!db.people.you) throw new Error('people 표에 you 가 없음');
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
    ctx.alive = {}; for (const p of Object.values(s.people)) ctx.alive[p.id] = p.status === 'home' ? 1 : 0;
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
  function enterPhase(s, db, extra) {
    const ctx = phaseCtx(s, extra);
    s.pending = null;
    for (const ev of db.eventsList) {
      if (ev.kind === 'trip') continue;                     // 원정 사건은 원정 흐름이 따로 건다
      if (Object.prototype.hasOwnProperty.call(s.done, ev.id)) continue;      // 값은 날짜(0 포함)라 in 으로 본다
      if (!C.test(ev.when, ctx)) continue;
      s.pending = { id: ev.id, kind: ev.kind };
      break;
    }
  }
  // 조사·말 걸기 직후: 그 조작에 걸린 사건이 있으면 건다 (when 에 inspect:x / talk:x)
  const checkEvents = (s, db, extra) => { if (!s.pending) enterPhase(s, db, extra); return !!s.pending; };

  // 하루 끝 → 새 날
  function newDay(s, db) {
    s.day += 1;
    if (db.numbers.day) s.world.day = s.day;
    for (const def of db.numbersList) if (def.owner === 'world' && def.perDay) s.world[def.id] = Math.max(def.min, Math.min(def.max, s.world[def.id] + def.perDay));
    for (const p of Object.values(s.people)) {
      if (p.status !== 'home') continue;
      for (const def of db.numbersList) if (def.owner === 'person' && def.perDay) p.n[def.id] = Math.max(def.min, Math.min(def.max, (p.n[def.id] || 0) + def.perDay));
      if ((p.n.injury || 0) >= 3 && s.flags[`treated_${p.id}`] !== true) { FX.kill(s, p.id, s.day); s.stats.deaths++; say(s, `${p.name} — 밤에 갔다.`, 'dead'); }
      delete s.flags[`treated_${p.id}`];
    }
    // 아침에 지워지는 흔적
    for (const [id, t] of Object.entries(s.traces)) { const o = db.objects[id]; if (!o) continue; if (o.resetOn === 'morning' || (o.resetOn === 'inspect' && t.seen && t.day < s.day)) delete s.traces[id]; }
    const dayDef = db.numbers.day;
    if (dayDef && s.day > dayDef.max) { endGame(s, db, 'train'); return; }
    if (s.people.you.status !== 'home') { endGame(s, db, 'you_gone'); return; }
    s.phase = firstPhase(s, db);
    enterPhase(s, db);
  }
  function endGame(s, db, why) {
    for (const p of Object.values(s.people)) if (p.status === 'home' && s.flags[`board_${p.id}`]) p.status = 'boarded';
    const c = ID.identity(s.axes, db.identity);
    s.ended = { why, identity: c ? c.id : null, reader: LEDGER.reader(s, db), ledger: LEDGER.rows(s, db) };
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
    return { label: c.label, locked: locked.length > 0, reason: locked.join(', '), chance, hint: c.hint || '', taboo: !!c.taboo };
  }
  function eventView(s, db) {
    if (!s.pending) return null;
    const ev = db.events[s.pending.id];
    return { id: ev.id, kind: ev.kind, grade: ev.grade, explicit: !!ev.explicit, text: ev.text, image: ev.image || '', choices: ev.choices.map((c) => choiceState(s, db, ev, c)) };
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
    if (out && out.effects) FX.apply(s, db, out.effects, { actor: 'you', target: out.target || null }, lines);
    if (out && out.ledger) s.ledger.written.push({ day: s.day, who: out.ledger.who || 'you', text: out.ledger.text });
    s.lastResult = { event: ev.id, choice: c.label, roll, text: (out && out.text) || '', lines };
    if (ev.once || ev.kind === 'fixed' || ev.kind === 'trial' || ev.kind === 'ending') s.done[ev.id] = s.day;
    s.stats.decisions++;
    say(s, c.label, 'choice');
    s.pending = null;
    if (ev.kind === 'ending') { endGame(s, db, ev.id); return true; }
    if (s.people.you.status !== 'home') { endGame(s, db, 'you_gone'); return true; }
    return true;
  }

  // ── 조사·소문·명부 ──
  function inspect(s, db, objId) {
    if (!db.objects[objId]) return false;
    const t = s.traces[objId];
    if (t) t.seen = true;
    s.stats.decisions++;
    checkEvents(s, db, { inspect: { [objId]: 1 } });
    return true;
  }
  function hear(s, i) { const r = s.rumors[i]; if (!r) return false; r.heard = true; return true; }
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
  function dispatch(s, a, db) {
    if (!db) return { ok: false, error: '표(db)가 없다' };
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') return { ok: false, error: '잘못된 동작' };
    if (s.ended) return { ok: false, error: '끝난 판' };
    const phase = phaseOf(db, s.phase);
    const allowed = (t) => t === 'next' || t === 'choose' || t === 'move' || t === 'setFlag' || (phase && phase.actions.includes(t));
    if (!allowed(a.type)) return { ok: false, error: `지금(${s.phase})은 할 수 없는 동작: ${a.type}` };
    let ok = false;
    switch (a.type) {
      case 'next': {
        if (s.pending) return { ok: false, error: '먼저 골라야 한다' };
        if (phase && phase.hook === 'rollNight') { const got = NIGHT.rollNight(s, db); s.stats.nights++; for (const g of got) say(s, `[밤] ${g.id}`, 'night'); }
        const nx = nextPhase(s, db);
        if (nx === null) newDay(s, db); else { s.phase = nx; enterPhase(s, db); }
        ok = true; break;
      }
      case 'choose': if (!isIdx(a.i)) break; ok = choose(s, db, a.i); break;
      case 'inspect': if (typeof a.object !== 'string') break; ok = inspect(s, db, a.object); break;
      case 'hear': if (!isIdx(a.i)) break; ok = hear(s, a.i); break;
      case 'writeCause': if (typeof a.who !== 'string') break; ok = writeCause(s, db, a.who, a.line === undefined ? null : a.line); break;
      case 'writeFact': if (typeof a.object !== 'string') break; ok = writeFact(s, db, a.object); break;
      case 'talk': { const p = s.people[a.who]; if (!p || p.status !== 'home' || a.who === 'you') break; s.stats.decisions++; checkEvents(s, db, { talk: { [a.who]: 1 } }); ok = true; break; }
      case 'treat': { const p = s.people[a.who]; if (!p || p.status !== 'home') break; s.flags[`treated_${a.who}`] = true; ok = true; break; }
      case 'board': { const p = s.people[a.who]; if (!p || p.status !== 'home') break; if (s.flags[`board_${a.who}`]) delete s.flags[`board_${a.who}`]; else s.flags[`board_${a.who}`] = true; ok = true; break; }
      case 'move': if (!a.map || !db.maps[a.map] || !Number.isInteger(a.x) || !Number.isInteger(a.y)) break; s.pos = { map: a.map, x: a.x, y: a.y }; ok = true; break;
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
    for (const k of ['world', 'flags', 'traces', 'axes', 'onceNight', 'done', 'stats']) s[k] = Object.assign({}, base[k], raw[k] || {});
    for (const def of db.numbersList) if (def.owner === 'world' && !Number.isFinite(s.world[def.id])) s.world[def.id] = def.start;
    for (const k of ['nightLog', 'rumors', 'log']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.ledger || typeof s.ledger !== 'object') s.ledger = { causes: {}, written: [] };
    if (!s.ledger.causes) s.ledger.causes = {}; if (!Array.isArray(s.ledger.written)) s.ledger.written = [];
    for (const id of db.peopleOrder) {
      const bp = makePerson(db, id), p = s.people[id];
      if (!p || typeof p !== 'object') { s.people[id] = bp; continue; }
      p.n = Object.assign({}, bp.n, p.n || {}); p.needs = Object.assign({}, bp.needs, p.needs || {}); p.skills = Object.assign({}, bp.skills, p.skills || {});
      if (!p.permanent || typeof p.permanent !== 'object') p.permanent = {};
      if (!['home', 'dead', 'ascended', 'boarded', 'outside'].includes(p.status)) p.status = 'home';
      for (const def of db.numbersList) if (def.owner === 'person' && !Number.isFinite(p.n[def.id])) p.n[def.id] = def.start;
    }
    if (typeof s.rng !== 'number') s.rng = s.seed >>> 0;
    if (!Number.isInteger(s.day)) s.day = 0;
    if (s.trip !== null && typeof s.trip !== 'object') s.trip = null;
    if (!s.pos || typeof s.pos !== 'object') s.pos = { map: null, x: 0, y: 0 };
    if (!s.ended && !phaseOf(db, s.phase)) return null;          // 모르는 단계 = 구조가 어긋난 저장
    if (s.pending && !db.events[s.pending.id]) s.pending = null;
    return s;
  }

  // ── 화면·봇이 보는 것 ──
  function view(s, db) {
    const phase = phaseOf(db, s.phase);
    return {
      day: s.day, phase: s.phase, ended: s.ended, actions: phase ? phase.actions.slice() : [],
      world: Object.fromEntries(db.numbersList.filter((d) => d.owner === 'world' && d.visible !== 'never').map((d) => [d.id, s.world[d.id]])),
      people: db.peopleOrder.map((id) => { const p = s.people[id]; return { id, name: p.name, status: p.status, injury: p.n.injury || 0, permanent: Object.keys(p.permanent) }; }),
      traces: Object.entries(s.traces).map(([id, t]) => ({ id, state: t.st, seen: t.seen })),
      rumors: s.rumors.filter((r) => !r.heard).length,
      event: eventView(s, db),
    };
  }

  const API = { SAVE_V, DELAYS, setFast, isFast, newGame, dispatch, normalize, view, eventView, choiceState, rand: R.rand,
    identity: (s, db) => ID.identity(s.axes, db.identity), ledger: LEDGER, night: NIGHT, cond: C };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).engine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
