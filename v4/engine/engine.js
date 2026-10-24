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
  const S = isNode ? require('./schema.js') : D4.schema;   // swap 합치기·대상이 필요한 선택지(10-24) — 표 검사와 같은 규칙을 쓴다

  const SAVE_V = 1;
  const MAX_LOG = 80;
  const SKILL_PCT = 5;                      // 판정: base% + 기술 × 5%p (화면의 % = 실제 %)
  const ROPE_FELT_MAX = 85;                 // (10-24 tightrope 검증) '느껴지는 아슬함' — 화면 % 가 이 값 이하(죽을 확률 ≥ 15%)인 줄타기 판정만 따로 센다(측정용, 규칙은 안 바꾼다)
  const EVENT_RANDOM = ['any', 'randomSleeper', 'nearestSleeper', 'farthestSleeper'];   // 사건 대상 낱말(자리 정보 없음 = 무작위)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // 선택지가 당신을 죽일 수 있는가(결과 out·ok·fail 중 하나라도 kill 이 당신에게 닿는다) — 강제 사망 판정과 봇 메타가 같이 쓴다
  const meWho = (w) => !w || w === 'you' || w === 'self' || w === 'actor' || w === 'party' || w === 'all';
  const outKills = (o) => !!(o && o.effects && o.effects.kill && FX.list(o.effects.kill).some((kv) => meWho(kv.who)));
  const killsYou = (c) => [c.out, c.ok, c.fail].some(outKills);
  // (10-24 tightrope R1) 살 확률 0~1: 판정 없으면 결과가 당신을 죽이지 않을 때 1 · 판정이면 %×(성공이 안 죽임) + (1−%)×(실패가 안 죽임). chance = 화면의 % (choiceState)
  function survival(c, chance) {
    if (!c) return 0;
    if (c.check) { const p = Math.max(0, Math.min(100, Number.isFinite(chance) ? chance : 0)) / 100; return Math.round(10000 * (p * (outKills(c.ok) ? 0 : 1) + (1 - p) * (outKills(c.fail) ? 0 : 1))) / 10000; }
    return outKills(c.out) ? 0 : 1;
  }
  const injuryMax = (db) => (db.numbers.injury ? db.numbers.injury.max : Infinity);   // 위독 = injury 의 최대값 (numbers 표)
  const SIGN_COLD_CALL_DEFAULT = 5;          // 호칭이 차가워지는 원한 문턱 (numbers 세계 수치 sign_cold_call 이 있으면 그것, 10-24 E5)
  const NO_TARGET_WHY = '댈 이름이 없다';     // targetOptional 사건에서 대상이 없어 잠긴 선택지의 기본 이유 (10-24)

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
      status: p.outside ? 'outside' : p.startAway ? 'away' : 'home', day: null, permanent: {}, secretFlag: p.secretFlag || null };
  }
  // ── 만남 (10-24 P0-E1) ──
  // metFlag = people 표의 만남 깃발. 비었으면 처음부터 아는 사람. known = 깃발이 없거나 그 깃발이 섬.
  // away = 아직 역에 안 온 사람(startAway:1). 만남 깃발이 서면 역에 온다(home) — 온 날은 p.arrived(명부의 날짜 칸 p.day 와 따로).
  const metFlagOf = (db, id) => { const row = db.people[id]; const f = row && typeof row.metFlag === 'string' ? row.metFlag : ''; return f && f !== '-' ? f : ''; };
  function known(s, db, id) { const f = metFlagOf(db, id); return !f || s.flags[f] === true; }
  // 효과(깃발)를 적용한 뒤 부른다: away 이면서 만남 깃발이 선 사람 → home
  function arrive(s, db) {
    for (const id of db.peopleOrder) {
      const p = s.people[id];
      if (!p || p.status !== 'away') continue;
      const f = metFlagOf(db, id);
      if (f && s.flags[f] === true) { p.status = 'home'; p.arrived = s.day; }
    }
  }
  // 들은 줄 기록 열쇠: '<줄id>#<행번호>' — 행번호 = lines 표에서 그 id 의 행들 가운데 몇 번째인가(0부터, 파일에 적힌 순서 = db.lines[id] 의 순서)
  const HEARD_KEY = /^([a-z0-9_]{1,24})#(\d{1,4})$/;
  function heardKey(db, id, row) { const rows = db.lines[id]; if (!rows) return null; const i = typeof row === 'number' ? row : rows.indexOf(row); return i >= 0 && i < rows.length ? `${id}#${i}` : null; }
  function heard(s, db, key) {
    const m = typeof key === 'string' ? HEARD_KEY.exec(key) : null;
    if (!m || !db.lines[m[1]] || Number(m[2]) >= db.lines[m[1]].length) return false;
    if (!s.heard || typeof s.heard !== 'object') s.heard = {};
    s.heard[key] = s.day;
    return true;
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
      flags: {}, traces: {}, axes, nightLog: [], rumors: [], onceNight: {}, done: {}, fired: {}, phaseSeen: [], critical: null, trip: null, lastFree: null, heard: {}, found: null,
      pending: null, lastResult: null, ledger: { causes: {}, written: [] }, log: [], stats: { decisions: 0, nights: 0, deaths: 0, neglect: 0, ropeRolls: 0, ropeClose: 0, ropeFeltRolls: 0, ropeFelt: 0, deathRolls: 0, closeCalls: 0, blindMet: 0 },
      hurt: [], notice: null, noticeDay: null,
    };   // (10-24 tightrope R4) stats.ropeRolls·ropeClose = 줄타기 판정을 굴림·넘김 · ropeFeltRolls·ropeFelt = 그중 화면 % ≤ ROPE_FELT_MAX(85) 인 판정(느껴지는 아슬함)을 굴림·넘김 · deathRolls·closeCalls = 당신을 죽이는 모든 판정을 굴림·넘김 · blindMet = 눈먼 새벽(rope.blind 깃발이 선 사건)을 만남
    // (10-24) hurt = 당신 부상의 출처 [{day, src, n}](통계용) · notice = 방금 조작에 붙은 토스트 줄 id(toast_late) · noticeDay = 그 토스트를 띄운 날 · stats.neglect = 적용한 missed 수   // fired = 고른 적 있는 사건 id → 횟수(once:0 포함, 집계용) · phaseSeen = 이번 단계에 이미 고른 사건(되풀이 사건도 한 단계에 한 번) · critical = 그날 마지막 치료 기회 때의 위독자(아침 판정용) · lastFree = 마지막 자유 경고 선택 {event, choice, day}(사인 기록용) · heard = 들은 줄 '<줄id>#<행번호>' → 마지막으로 들은 날 · found = 방금 연 수납의 결과(P1-11, 다음 조사·next 에 지워진다)
    if (!db.people.you) throw new Error('people 표에 you 가 없음');
    for (const o of Object.values(db.objects)) s.traces[o.id] = { st: o.states[0], day: 0, by: null, seen: false, late: 0 };   // 물건의 첫 상태 = states[0]
    for (const id of db.peopleOrder) s.people[id] = makePerson(db, id);
    arrive(s, db);
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
    ctx.alive = {}; for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' || p.status === 'away' ? 1 : 0; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }   // hunger_you, injury_gicheol (밤 사건 조건과 같은 어휘) · away(아직 안 온 사람)도 살아 있음 — 도착 사건 조건(alive:x)을 지킨다
    Object.assign(ctx, s.people.you.n);                                                                     // 사건 when 에서 hunger·injury 는 당신 것
    ctx.inspect = {}; ctx.talk = {};
    ctx.fired = s.fired || {};                                                                              // (10-24) fired:called_up>=2 = 그 사건을 고른 횟수 (swap·req.cond 에서 '되풀이할수록')
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
      if (ev.target) { target = eventTarget(s, db, ev.target, ev.targetIf); if (!target && !ev.targetOptional) continue; }   // targetOptional: 대상 없이도 걸린다(대상이 필요한 선택지만 잠김)
      s.pending = { id: ev.id, kind: ev.kind };
      if (target) s.pending.target = target;
      break;
    }
  }
  // 사건 대상: 사람 id(역에 있어야) · any/randomSleeper/… = 역에 있는 주민 중 무작위 · mostInjured = 가장 많이 다친 주민 · bond = 당신의 bond
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
  function targetFits(s, db, id, cond) { try { return C.test(cond, targetCtx(s, db, id)); } catch (e) { return false; } }
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
      if ((p.n.injury || 0) >= injMax && wasCrit && s.flags[`treated_${p.id}`] !== true) { FX.kill(s, p.id, s.day, null, 'dead'); s.stats.deaths++; say(s, `${p.name} — 밤에 갔다.`, 'dead'); if (p.id === 'you') s.lastResult = { event: 'injury_untreated', choice: '위독을 치료하지 않음', warned: false, forced: false, free: s.lastFree || null, roll: null, text: '', lines: [], image: '' }; }
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
  // cause: 당신이 죽었거나 올라갔거나 떠났으면 마지막 결과(사건 id·선택·경고 여부·강제 여부·앞선 자유 경고 선택·결과 그림·밤 사건 여부). 결말 사건 안의 죽음도 여기 남는다.
  //   warned = 실질 경고: 고른 선택지에 경고 글(warn·hint·taboo)이 있고 강제가 아니다 (10-22 리드 결정 — 선택지 하나뿐·나머지가 잠긴 주사위는 '경고 있음'이 아니다)
  //   forced = (10-24 tightrope R1) 확정 사망 — 그 순간 열린 선택지 전부 살 확률 0 (살 확률 > 0 인 주사위가 하나라도 열려 있으면 강제가 아니다)
  //            · noSafe = 옛 정의(당신이 죽지 않는 열린 선택지 0개 — 줄타기 판은 일부러 그렇다, 측정용)
  //   free = 갈림길: 강제면 그 전 마지막 자유 경고 선택, 아니면 이 선택까지의 마지막 자유 경고 선택 (없으면 null)
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
      cause: youGone && r ? { event: r.event, choice: r.choice, warned: !!r.warned, forced: !!r.forced, free: r.free || null, image: r.image || '', night: !!r.night, warn: r.warn || '', swapped: !!r.swapped, roped: !!r.roped, blind: !!r.blind, noSafe: !!r.noSafe } : null };   // (10-24) warn = 고른 선택지의 화면 경고 글 · swapped = swap 변형으로 골랐다 · (tightrope) roped = 줄타기 판정으로 골랐다 · blind = 눈먼 새벽이었다 · noSafe = 위험 0 출구가 없었다(옛 강제 정의 — 측정용)
    s.phase = 'ended'; s.pending = null;
  }

  // ── 선택 ──
  // swap (10-24 A1): 선택지의 swap 변형 가운데 when 이 지금 맞는 첫 것으로 바꾼 선택지. 없으면 그대로. 합치는 규칙은 schema.js mergeSwap(표 검사와 같다)
  //   (10-24 tightrope R0) 그다음 rope(줄타기) 칸이 있으면 그 모습 위에 얹는다 — ropeChoice. 화면·봇·강제 판정·집계가 모두 이 모습을 본다
  const SWAP_CACHE = new WeakMap();
  function effChoice(s, db, c, ctx) {
    if (!c) return c;
    let m = c;
    if (c.swap != null) {
      ctx = ctx || phaseCtx(s);
      for (const v of S.swapsOf(c)) {
        let ok = false; try { ok = C.test(v.when, ctx); } catch (e) { ok = false; }
        if (!ok) continue;
        m = SWAP_CACHE.get(v); if (!m) { m = S.mergeSwap(c, v); SWAP_CACHE.set(v, m); }
        break;
      }
    }
    return m.rope ? ropeChoice(s, db, m) : m;
  }
  // ── 줄타기 (10-24 tightrope R0) — 규칙은 schema.js ropeState·ropeCheck·applyRope (표 검사와 같은 함수) ──
  //   구간 = 지금 world.karma · 손잡이 = numbers 세계 수치 rope_*(없으면 schema ROPE_DEFAULTS) · 눈먼 새벽 = rope.blind 깃발(기본 strike_blind)이 섬
  //   돌려주는 선택지에 roped = { kind, band(0 = 구간 아님), blind, base } (봇 메타·집계용 — 화면 eventView 에는 안 나간다)
  const ROPE_CACHE = new WeakMap();
  const worldGet = (s) => (id) => (Number.isFinite(s.world[id]) ? s.world[id] : undefined);
  function ropeTail(db, kind) {
    if (kind === 'fight') return '';
    const L = db.lines['rope_tail_' + kind];
    const t = L && L[0] && typeof L[0].text === 'string' ? L[0].text : '';
    return t || S.ROPE_TAIL[kind] || '';
  }
  function ropeChoice(s, db, m) {
    const spec = m.rope;
    if (!spec || !S.ROPE_KINDS.includes(spec.kind)) return m;
    const get = worldGet(s);
    const st = S.ropeState(spec, s.world.karma || 0, s.flags, get);
    if (!st.active) return m;
    const rc = S.ropeCheck(spec, m, st, get);
    if (!rc) return m;
    const key = `${st.band}|${st.blind ? 1 : 0}|${rc.skill}|${rc.base}`;
    let byKey = ROPE_CACHE.get(m); if (!byKey) { byKey = new Map(); ROPE_CACHE.set(m, byKey); }
    let r = byKey.get(key);
    if (!r) { r = S.applyRope(m, spec, rc, ropeTail(db, spec.kind)); if (r !== m) r.roped = { kind: spec.kind, band: st.band, blind: st.blind, base: rc.base }; byKey.set(key, r); }
    return r;
  }
  // 잠금 이유: req.why 가 있으면 그 글(10-24 E5), 없으면 지금까지의 글. req.cond = 조건식(사건 when 과 같은 환경)이 맞아야 열림.
  //   대상이 필요한 선택지는 사건 대상이 없으면 잠긴다: targetOptional 사건(대상 없이 걸린 경우)에서 결과가 who:'target' 등을 쓰는 선택지 · req.target:1 인 선택지
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
    if (!tgt && ((ev.targetOptional && S.usesTarget(c)) || (c.req && (c.req.target === 1 || c.req.target === true)))) locked.push(why || NO_TARGET_WHY);
    if (c.cost) for (const [k, v] of Object.entries(c.cost)) { const have = db.numbers[k].owner === 'world' ? s.world[k] : you.n[k]; if ((have || 0) < v) locked.push(`${db.numbers[k].name || k}이(가) 모자라다`); }
    const chance = c.check ? Math.max(0, Math.min(100, c.check.base + SKILL_PCT * (you.skills[c.check.skill] || 0))) : null;
    return { label: c.label, locked: locked.length > 0, reason: Array.from(new Set(locked)).join(', '), chance, hint: c.hint || '', warn: c.warn || '', cost: c.cost || null, taboo: !!c.taboo };
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
    const c0 = ev.choices[i];
    if (!c0) return false;
    const states = ev.choices.map((x) => choiceState(s, db, ev, x));
    const st = states[i];
    if (st.locked) return false;
    const c = effChoice(s, db, c0);                 // swap 이 맞으면 바뀐 선택지 (10-24) · 줄타기가 걸리면 그 판정 (tightrope)
    // 강제(확정 사망, tightrope R1) = 지금 열린 선택지(이것 포함) 전부 살 확률 0. 자유 경고 선택 = 경고 글이 있고 다른 열린 선택지가 있던 선택.
    // 비용을 치르기 전에 잰다(비용이 잠금 상태를 바꾸므로). swap·줄타기도 비용 전의 모습으로 본다. 살 확률은 화면의 % 로 잰다.
    const openIdx = ev.choices.map((x, k) => k).filter((k) => !states[k].locked);
    const open = openIdx.map((k) => ev.choices[k]);
    const openEff = open.map((x) => effChoice(s, db, x));
    const ps = openEff.map((x, k) => survival(x, states[openIdx[k]].chance));
    const forced = ps.every((p) => p === 0);
    const noSafe = !openEff.some((x) => !killsYou(x));                  // 옛 강제 정의(위험 0 출구 없음) — 측정용
    const alts = open.map((x, k) => ({ i: openIdx[k], kill: killsYou(openEff[k]), taboo: !!openEff[k].taboo, warn: `${openEff[k].warn || ''} ${openEff[k].hint || ''}`.trim(), p: ps[k] }));   // 집계용(봇 버릇 점검): 고를 때 열린 선택지의 모습 · p = 살 확률
    const blind = ev.choices.some((x) => x.rope && x.rope.blind && x.rope.kind !== 'fight' && s.flags[S.ropeBlindFlag(x.rope)] === true);   // 눈먼 새벽 — 결과가 깃발을 지우기 전에 잰다
    if (blind) s.stats.blindMet = (s.stats.blindMet || 0) + 1;
    const warnText = !!(c.warn || c.hint || c.taboo);
    const freeBefore = s.lastFree || null;
    if (warnText && open.length > 1) s.lastFree = { event: ev.id, choice: c.label, day: s.day };
    const lines = [];
    if (c.cost) for (const [k, v] of Object.entries(c.cost)) FX.setNumber(s, db, k, 'you', -v, lines);
    let roll = null, out = c.out;
    if (c.check) {
      const ok = R.rand(s) * 100 < st.chance; roll = { chance: st.chance, success: ok }; out = ok ? c.ok : c.fail;
      if (outKills(c.fail)) { s.stats.deathRolls = (s.stats.deathRolls || 0) + 1; if (ok) s.stats.closeCalls = (s.stats.closeCalls || 0) + 1; }   // (tightrope R4) 죽을 뻔한 판정
      if (c.roped) { s.stats.ropeRolls = (s.stats.ropeRolls || 0) + 1; if (ok) s.stats.ropeClose = (s.stats.ropeClose || 0) + 1; }            // 줄타기 판정
      if (c.roped && st.chance <= ROPE_FELT_MAX) { s.stats.ropeFeltRolls = (s.stats.ropeFeltRolls || 0) + 1; if (ok) s.stats.ropeFelt = (s.stats.ropeFelt || 0) + 1; }   // 느껴지는 줄타기(화면 ≤ 85%)
    }
    const roles = rolesFor(s, db, out);
    if (out && out.effects) FX.apply(s, db, out.effects, roles, lines);
    FX.noteHurt(s, lines, `ev:${ev.id}/${c0.label}`);
    arrive(s, db);                     // 만남 깃발이 섰으면 역에 온다 — 이어지는 사건(연쇄)이 그 사람을 본다
    if (out && out.ledger) applyLedger(s, db, out.ledger, roles);
    s.lastResult = { event: ev.id, choice: c.label, i, open: open.map((x) => ev.choices.indexOf(x)), alts, warned: warnText && !forced, forced, free: forced ? freeBefore : s.lastFree || null, roll, text: (out && out.text) || '', lines, image: (out && out.image) || '', target: roles.target, companion: roles.companion,
      warn: `${c.warn || ''} ${c.hint || ''}`.trim(), swapped: c !== c0, roped: c.roped ? Object.assign({}, c.roped) : null, blind, noSafe, p: survival(c, st.chance) };   // open = 고를 때 열려 있던 선택지 번호 · alts = 그 선택지들의 모습(swap·줄타기 뒤) · warn = 고른 선택지의 화면 경고 글 · swapped = swap 변형(또는 줄타기)으로 골랐다 · roped = 줄타기 {kind, band, blind, base} · blind = 눈먼 새벽 · noSafe = 위험 0 출구 없음 · p = 고른 선택지의 살 확률 (봇 집계용)
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
  // 조사 한 번의 순서 (P1-11 엔진 몫): ① 그 조사에 걸린 사건(when 에 inspect:x — 원정 아닌 사건) → ② 원정 중이면 inspect:x 가 걸린 원정 사건
  //   → ③ 둘 다 없고 물건에 수납 내용(holds)이 있고 닫혀(states[0]) 있고 사건이 쥐고 있지 않으면(claimedByEvent) '닫힘→얻음→열림'.
  //   조사 전에 걸린 사건이 있었으면 ②③ 은 하지 않는다.
  // (10-24 A4 E3) 그날 아침에 '못 본 밤'이 바꾼 흔적(late)이 하나라도 있으면, 그날 첫 조사 때 s.notice = 'toast_late'(대사표에 그 줄이 있을 때) 한 번.
  // 지금 '늦은 흔적'인가 = late 이고 어젯밤 굴림에서 생긴 것(day == 오늘−1). 며칠 지난 late 는 늦은 흔적이 아니다 — 조사 글·토스트·view 가 같은 규칙을 쓴다
  //   (10-24 검증 A4-6: 조사 글만 날을 안 봐서, 며칠 지난 흔적에도 '이틀째 빈 채다'·'어제부터'가 나왔다. 화면 먼지 game.js lateOf 도 같은 규칙 + 아직 안 봄)
  const lateNow = (s, t) => !!(t && t.late && t.day === s.day - 1);
  const lateToday = (s) => Object.values(s.traces).some((t) => lateNow(s, t));
  function inspect(s, db, objId) {
    if (!db.objects[objId]) return false;
    const t = s.traces[objId];
    const waiting = !!s.pending;
    s.found = null; s.notice = null;
    if (s.noticeDay !== s.day && db.lines.toast_late && lateToday(s)) { s.notice = 'toast_late'; s.noticeDay = s.day; }
    if (t) { t.seen = true; NIGHT.markInspected(s, objId); }
    s.stats.decisions++;
    checkEvents(s, db, { inspect: { [objId]: 1 } });
    if (!waiting && !s.pending && s.trip) tripInspect(s, db, objId);
    if (!waiting && !s.pending) openHolds(s, db, objId);
    return true;
  }
  // 수납 열기: 닫힘(states[0]) → 내용(effects) 적용 → 연 뒤 상태. 결과는 s.found = { object, state, day, text, lines } (화면의 '열기 3박자'·찾은 물건 아이콘이 읽는다)
  //   lines = 바뀐 수치 [{kind:'number', id, who, from, to}] (사건 결과의 lastResult.lines 와 같은 꼴). 연 것은 열린 채 남는다(resetOn never 일 때).
  const openStateOf = (o) => (o.holds && typeof o.holds.state === 'string' && o.holds.state ? o.holds.state : o.states.includes('open') && o.states[0] !== 'open' ? 'open' : o.states[1]);   // schema.js holdsOpenState 와 같은 규칙
  const closedHolds = (s, db, objId) => { const o = db.objects[objId], t = s.traces[objId]; return !!(o && o.holds && t && t.st === o.states[0] && o.states.length > 1); };
  // 사건이 쥔 물건: when 에 inspect:<그 물건> 이 나오는 사건(어느 kind 든) 가운데 지금 조건이 맞는 것이 있다 — 이미 고른 사건(done·phaseSeen·trip.done)도 센다.
  //   그 동안은 holds 를 열지 않는다. 위험한 수납 사건('비틀어 연다 / 지나간다')을 거절하고 다시 조사해서 내용을 위험 없이 꺼내지 못하게(10-21 위험 대 보상).
  //   사건 조건이 더는 맞지 않으면(그날이 지났다·깃발이 섰다) holds 가 기본 흐름이 된다.
  function claimedByEvent(s, db, objId) {
    const ctx = phaseCtx(s, { inspect: { [objId]: 1 } });
    const name = 'inspect:' + objId;
    return db.eventsList.some((ev) => inspectGated(ev) && C.names(C.compile(ev.when)).includes(name) && C.test(ev.when, ctx));
  }
  function openHolds(s, db, objId) {
    if (!closedHolds(s, db, objId) || claimedByEvent(s, db, objId)) return false;
    const o = db.objects[objId];
    const lines = [];
    const roles = rolesFor(s, db, null);
    if (o.holds.effects) FX.apply(s, db, o.holds.effects, roles, lines);
    FX.noteHurt(s, lines, 'holds:' + objId);
    const st = openStateOf(o);
    FX.setTrace(s, db, objId, st, s.day, 'you');
    s.traces[objId].seen = true;                                             // 당신이 한 일이라 본 것(배식 그릇과 같다)
    arrive(s, db);                                                           // 내용에 만남 깃발이 있으면 역에 온다
    s.found = { object: objId, state: st, day: s.day, text: o.holds.text || '', lines };
    say(s, o.name, 'found');
    return true;
  }
  // when 에 inspect: 가 나오는 원정 사건 = 그 물건을 조사해야 걸리는 사건(도착하자마자 걸지 않는다)
  const GATED = new Map();
  function inspectGated(ev) {
    const key = ev.when == null ? '' : String(ev.when);
    if (!GATED.has(key)) GATED.set(key, C.names(C.compile(key)).some((n) => C.prefixOf(n) === 'inspect'));
    return GATED.get(key);
  }
  // 원정 중 조사: inspect:x 가 걸린 원정 사건 중 표 순서로 첫 것 (같은 원정에서 같은 사건은 한 번 · once 사건은 한 판에 한 번 · target 이 있으면 걸 때 정한다)
  function tripInspect(s, db, objId) {
    const ctx = phaseCtx(s, { inspect: { [objId]: 1 } });
    for (const ev of db.eventsList) {
      if (ev.kind !== 'trip' || !inspectGated(ev)) continue;
      if ((s.trip.done || []).includes(ev.id) || (ev.once && has(s.done, ev.id))) continue;
      if (!C.test(ev.when, ctx)) continue;
      let target = null;
      if (ev.target) { target = eventTarget(s, db, ev.target, ev.targetIf); if (!target && !ev.targetOptional) continue; }
      s.pending = { id: ev.id, kind: 'trip' };
      if (target) s.pending.target = target;
      (s.trip.done = s.trip.done || []).push(ev.id);
      return true;
    }
    return false;
  }
  function hear(s, i) { const r = s.rumors[i]; if (!r) return false; r.heard = true; NIGHT.markHeard(s, r); return true; }
  // 원정: 지금 지역·층에 맞는 원정 사건 하나를 건다 (같은 원정에서 같은 사건은 한 번)
  // 도착 사건 = when 에 inspect: 가 없는 원정 사건. inspect: 가 있는 원정 사건은 그 물건을 조사할 때 건다(tripInspect, P1-11).
  function startTripEvent(s, db) {
    const ctx = phaseCtx(s);
    const fit = db.eventsList.filter((ev) => ev.kind === 'trip' && !inspectGated(ev) && !(s.trip.done || []).includes(ev.id) && !(ev.once && Object.prototype.hasOwnProperty.call(s.done, ev.id)) && C.test(ev.when, ctx));
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
  // 역에 있고(home) 만난(known) 사람만 받는다 — 역 밖(away)·안 만난 사람은 bowls 에 있어도 건너뛴다(식량·물·그릇 그대로).
  function ration(s, db, bowls) {
    if (!bowls || typeof bowls !== 'object') return false;
    const RATION = rationOf(s);
    for (const [who, on] of Object.entries(bowls)) {
      const p = s.people[who]; if (!p || p.status !== 'home' || !known(s, db, who)) continue;
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
  // 동행이 될 수 있는 사람 = 역에 있는 만난(known) 주민 중 위독이 아닌 사람(나이 무관). 고를 수 없는 사람이 있으면 null(거절).
  function pickParty(s, db, want) {
    const size = Number.isFinite(s.world.trip_party) ? Math.max(0, s.world.trip_party) : 0;
    const injMax = injuryMax(db);
    const ok = (id) => typeof id === 'string' && id !== 'you' && s.people[id] && s.people[id].status === 'home' && known(s, db, id) && (s.people[id].n.injury || 0) < injMax;
    if (Array.isArray(want)) { const u = Array.from(new Set(want)); return u.length <= size && u.every(ok) ? u : null; }
    const pool = db.peopleOrder.filter(ok), out = [];
    while (out.length < size && pool.length) out.push(pool.splice(Math.floor(R.rand(s) * pool.length), 1)[0]);
    return out;
  }
  // 원정 동작: 낮에 한 번(지역 하나). 첫 동작은 1층, 그다음은 바로 아래층만(층마다 한 번). 걸린 사건이 있으면 못 간다.
  // 돌려주는 값: 도착 사건이 걸렸으면 true. walk:true(원정 지도를 걸어서 뒤지는 화면·봇, P1-11)면 그 층에 들어섰으면 true — 도착 사건이 없어도.
  //   어느 쪽이든 층에 들어서면 s.trip 은 바뀐다(옛 화면은 false 를 '아무것도 없었다'로 읽는다).
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
    const got = startTripEvent(s, db);
    return a.walk === true ? true : got;
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
    const allowed = (t) => t === 'next' || t === 'choose' || t === 'move' || t === 'setFlag' || t === 'heard' || (phase && (phase.actions.includes(t) || phase.actions.includes(ALIAS[t])))
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
          arrive(s, db);                                                     // 밤 사건 효과가 만남 깃발을 세웠으면 역에 온다
          if (youWere === 'home' && s.people.you.status !== 'home') {        // 밤 사건이 당신을 데려갔다 → 사인은 그 밤 사건 (그 전 선택이 아니다)
            const e = s.nightLog.slice(n0).find((x) => (x.lines || []).some((l) => l.who === 'you' && l.kind !== 'number' && l.kind !== 'permanent'));
            const row = e ? db.nightEvents.find((n) => n.id === e.id) : null;
            s.lastResult = { event: e ? e.id : 'night', choice: null, i: null, warned: false, forced: false, free: s.lastFree || null, night: true, roll: null, text: (row && row.text) || '', lines: e ? e.lines : [], image: '' };
          }
        }
        s.trip = null; s.found = null; s.notice = null;
        if (s.morningReset) { s.morningReset = false; for (const [id, t] of Object.entries(s.traces)) { const o = db.objects[id]; if (!o) continue; if (o.resetOn === 'morning' || (o.resetOn === 'inspect' && t.seen && t.day < s.day)) s.traces[id] = { st: o.states[0], day: s.day, by: null, seen: false, late: 0 }; } }   // 지워짐 = 첫 상태로
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
      case 'talk': { const p = s.people[a.who]; if (!p || (p.status !== 'home' && p.status !== 'away') || a.who === 'you') break; s.stats.decisions++; checkEvents(s, db, { talk: { [a.who]: 1 } }); ok = true; break; }   // away = 역 밖에서 마주친 사람(터널의 기철)에게도 말을 건다
      case 'treat': if (typeof a.who !== 'string') break; ok = treat(s, db, a.who); break;
      case 'board': { const p = s.people[a.who]; if (!p || p.status !== 'home' || a.who === 'you') break; if (s.flags[`board_${a.who}`]) delete s.flags[`board_${a.who}`]; else s.flags[`board_${a.who}`] = true; ok = true; break; }   // 다시 누르면 내린다
      case 'move': if (!a.map || !db.maps[a.map] || !Number.isInteger(a.x) || !Number.isInteger(a.y)) break; s.pos = { map: a.map, x: a.x, y: a.y }; checkEvents(s, db); ok = true; break;   // 지도에 들어서면 그 지도에 걸린 사건을 찾는다
      case 'setFlag': if (typeof a.flag !== 'string' || !/^[a-z_]{1,24}$/.test(a.flag)) break; s.flags[a.flag] = true; arrive(s, db); ok = true; break;
      case 'heard': ok = heard(s, db, a.key); break;          // {type:'heard', key:'<줄id>#<행번호>'} → heard[key] = 오늘 (화면이 고른 대사 줄을 남긴다, 어느 단계에서나)
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
    s.heard = raw.heard && typeof raw.heard === 'object' && !Array.isArray(raw.heard) ? Object.assign({}, raw.heard) : {};   // 옛 저장(heard 없음)은 빈 기록
    for (const tr of Object.values(s.traces)) if (tr && typeof tr === 'object') tr.late = tr.late ? 1 : 0;                      // (10-24 E3) 옛 저장 흔적은 late 0
    s.hurt = Array.isArray(raw.hurt) ? raw.hurt.filter((h) => h && typeof h === 'object' && typeof h.src === 'string').slice(-FX.HURT_MAX) : [];
    s.notice = typeof raw.notice === 'string' && db.lines[raw.notice] ? raw.notice : null;
    s.noticeDay = Number.isInteger(raw.noticeDay) ? raw.noticeDay : null;
    if (!Number.isFinite(s.stats.neglect)) s.stats.neglect = 0;
    for (const k of ['ropeRolls', 'ropeClose', 'ropeFeltRolls', 'ropeFelt', 'deathRolls', 'closeCalls', 'blindMet']) if (!Number.isFinite(s.stats[k])) s.stats[k] = 0;   // (10-24 tightrope R4 · 검증 ropeFelt) 옛 저장은 0
    if (!Array.isArray(s.phaseSeen)) s.phaseSeen = [];
    if (!s.critical || typeof s.critical !== 'object' || !Array.isArray(s.critical.ids)) s.critical = null;
    if (!s.lastFree || typeof s.lastFree !== 'object' || typeof s.lastFree.event !== 'string') s.lastFree = null;
    if (!s.found || typeof s.found !== 'object' || typeof s.found.object !== 'string' || !db.objects[s.found.object]) s.found = null;   // 옛 저장(found 없음)·깨진 값
    for (const def of db.numbersList) if (def.owner === 'world' && !Number.isFinite(s.world[def.id])) s.world[def.id] = def.start;
    for (const k of ['nightLog', 'rumors', 'log']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.ledger || typeof s.ledger !== 'object') s.ledger = { causes: {}, written: [] };
    if (!s.ledger.causes) s.ledger.causes = {}; if (!Array.isArray(s.ledger.written)) s.ledger.written = [];
    for (const id of db.peopleOrder) {
      const bp = makePerson(db, id), p = s.people[id];
      if (!p || typeof p !== 'object') { s.people[id] = bp; continue; }
      p.n = Object.assign({}, bp.n, p.n || {}); p.needs = Object.assign({}, bp.needs, p.needs || {}); p.skills = Object.assign({}, bp.skills, p.skills || {});
      if (!p.permanent || typeof p.permanent !== 'object') p.permanent = {};
      if (!['home', 'away', 'dead', 'ascended', 'boarded', 'outside', 'stayed', 'walked'].includes(p.status)) p.status = 'home';
      for (const def of db.numbersList) if (def.owner === 'person' && !Number.isFinite(p.n[def.id])) p.n[def.id] = def.start;
    }
    arrive(s, db);                                               // 깃발은 섰는데 away 로 남은 저장(손으로 고친 것 등)을 맞춘다
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
  // people[].met = 1 이면 만난 사람(metFlag 가 없거나 그 깃발이 섬), 0 이면 아직 안 만난 사람 — 화면은 met:0 인 사람의 이름·그릇을 보이지 않는다.
  //   status 'away' = 아직 역에 안 온 사람(지도에 그 사람 물건을 그리지 않는다)
  // trip = { region, floor, floors, party } (원정 중일 때) — party 는 동행 id 목록(당신 제외)
  // found = 방금 조사로 연 수납 { object, state, day, text, lines } 또는 null (P1-11 — 화면의 열기 3박자·찾은 물건 아이콘)
  function view(s, db) {
    const phase = phaseOf(db, s.phase);
    const sg = NIGHT.signs(s, db);
    return {
      day: s.day, phase: s.phase, ended: s.ended, actions: phase ? phase.actions.slice() : [],
      world: Object.fromEntries(db.numbersList.filter((d) => d.owner === 'world' && d.visible !== 'never').map((d) => [d.id, s.world[d.id]])),
      people: db.peopleOrder.map((id) => { const p = s.people[id]; return { id, name: p.name, status: p.status, met: known(s, db, id) ? 1 : 0, injury: p.n.injury || 0, permanent: Object.keys(p.permanent), signs: sg[id] || null, address: p.status === 'home' ? address(s, db, id) : null }; }),
      trip: s.trip ? { region: s.trip.region, floor: s.trip.floor, floors: (s.trip.floors || []).slice(), party: (s.trip.party || []).slice() } : null,
      traces: Object.entries(s.traces).map(([id, t]) => ({ id, state: t.st, seen: t.seen, late: lateNow(s, t) ? 1 : 0 })),   // late = 지금 늦은 흔적(어젯밤 것)만
      rumors: s.rumors.filter((r) => !r.heard).length,
      found: s.found ? { object: s.found.object, state: s.found.state, day: s.found.day, text: s.found.text || '', lines: (s.found.lines || []).slice() } : null,
      event: eventView(s, db),
      notice: s.notice || null,                  // (10-24 E3) 방금 조사에 붙은 토스트 줄 id ('toast_late') 또는 null
    };
  }
  // (10-24 E3) 조사 글 줄 id: 물건 inspectLine[지금 상태], 그 흔적이 지금 늦은 흔적(lateNow — 어젯밤 못 본 일이 바꿈)이고 '<줄id>_late' 줄이 대사표에 있으면 그것. 없으면 null
  function inspectLineId(s, db, objId) {
    const o = db.objects[objId], t = s.traces[objId];
    if (!o || !t || !o.inspectLine) return null;
    const id = o.inspectLine[t.st];
    if (!id) return null;
    return lateNow(s, t) && db.lines[id + '_late'] ? id + '_late' : id;
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
  }

  // 봇 전용 메타: 선택지마다 축 효과·당신 사망 여부·비용. 화면은 이걸 보면 안 된다 (E6).
  function choiceMeta(s, db) {
    if (!s.pending) return null;
    const ev = db.events[s.pending.id];
    return ev.choices.map((c0, i) => { const c = effChoice(s, db, c0); const outs = [c.out, c.ok, c.fail].filter(Boolean); const axis = {}; let kill = false, killOther = false;
      let gain = 0;
      for (const o of outs) { const e = o.effects || {}; for (const [k, v] of Object.entries(e.axis || {})) axis[k] = (axis[k] || 0) + v;
        if (e.kill) for (const kv of FX.list(e.kill)) { if (meWho(kv.who)) kill = true; else killOther = true; }
        for (const [k, v] of Object.entries(e)) { const d = db.numbers[k]; if (d && d.owner === 'world' && d.visible === 'always') for (const x of FX.list(v)) gain += typeof x === 'number' ? x : (x && x.n) || 0; } }
      return Object.assign(choiceState(s, db, ev, c0), { i, axis, killYou: kill, killOther, check: !!c.check, gain, swapped: c !== c0, roped: !!c.roped }); });   // gain = 화면에 보이는 자원 변화 합(봇의 '자원 + 가장 큰 label') · swapped = swap 변형이 맞았다 · roped = 줄타기 판정(집계용 — 봇 점수는 안 본다)
  }
  const API = { SAVE_V, ROPE_FELT_MAX, DELAYS, setFast, isFast, newGame, dispatch, normalize, view, eventView, choiceState, choiceMeta, effChoice, eventTarget, inspectLineId, lateNow, address, rationOf, rand: R.rand, killsYou, survival, ropeChoice, known, heardKey, closedHolds, openStateOf, inspectGated, NO_TARGET_WHY, SIGN_COLD_CALL_DEFAULT,
    identity: (s, db) => ID.identity(s.axes, db.identity), signs: (s, db) => NIGHT.signs(s, db), readerId: (s, db) => LEDGER.readerId(s, db), ledger: LEDGER, night: NIGHT, cond: C };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).engine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
