// 어두운 역 v4 — 표 아홉 장의 스키마(칸 이름 약속)와 검증. docs/foundation/31_tables_schema.md §1 그대로.
// 위반은 "표[행번호] id.열: 이유" 꼴의 오류 목록으로 돌려준다. 코드는 여기 적힌 열 이름만 안다.
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cond.js') : root.DS4.cond;

  const ID = /^[a-z0-9_]{1,24}$/;
  const EFFECT_VERBS = ['flag', 'trace', 'axis', 'injure', 'kill', 'permanent'];   // 그 밖의 키는 numbers id 여야 한다
  const PERMANENT = ['finger', 'leg', 'ear'];
  const EVENT_TARGETS = ['any', 'randomSleeper', 'nearestSleeper', 'farthestSleeper', 'mostInjured', 'bond'];   // 사건 대상 낱말 (자리 정보가 없어 앞의 넷은 무작위, bond = 당신의 bond)
  const MOST_TARGET = /^most:([a-z0-9_]{1,24})$/;   // (10-24 A1) most:<사람 수치> = 그 수치가 가장 큰 주민(0보다 클 때, 같으면 무작위) — 예 most:grudge
  const REQ_KEYS = ['flag', 'permanent', 'notPermanent', 'cond', 'why', 'target'];   // 선택지 req 의 칸 (10-24: cond = 조건식 · why = 잠금 이유 글 · target = 사건 대상이 있어야 열림)
  const SWAP_KEYS = ['when', 'label', 'check', 'cost', 'req', 'taboo', 'warn', 'hint', 'out', 'ok', 'fail'];   // (10-24 A1) 선택지 swap 변형의 칸
  const FORBIDDEN_NIGHT_NAMES = /^(you|pos|player|map|x|y|where|at)(_|$)|^(inspect|talk|choice|chose):/;   // 밤 사건 조건에 당신 위치·선택(조사·말 걸기) 금지

  // 열 정의: type(id|str|int|num|bool|enum|list|obj|cond|any), req(필수), enum, min, max, of(목록 원소 검사 함수 이름)
  const T = {
    phases: { key: 'id', cols: {
      id: { type: 'id', req: true }, order: { type: 'int', req: true, min: 1, max: 20 },
      actions: { type: 'list', req: true, ofAction: true }, skipIf: { type: 'cond' }, timeBudgetSec: { type: 'int', min: 0, max: 600 },
      hook: { type: 'enum', enum: ['rollNight'] },   // 이 단계를 떠날 때 엔진이 하는 일 (rollNight = 밤 사건 굴림)
    } },
    numbers: { key: 'id', cols: {
      id: { type: 'id', req: true }, owner: { type: 'enum', req: true, enum: ['world', 'person'] },
      min: { type: 'int', req: true }, max: { type: 'int', req: true }, start: { type: 'int', req: true }, perDay: { type: 'int' },
      visible: { type: 'enum', req: true, enum: ['always', 'inspect', 'never'] }, name: { type: 'str' },
    } },
    events: { key: 'id', cols: {
      id: { type: 'id', req: true }, kind: { type: 'enum', req: true, enum: ['trip', 'trial', 'fixed', 'ending'] }, when: { type: 'cond' },
      grade: { type: 'enum', req: true, enum: ['normal', 'fixed'] }, explicit: { type: 'bool01' }, text: { type: 'str', req: true },
      image: { type: 'str' }, choices: { type: 'list', req: true, minLen: 1 }, once: { type: 'bool01' },
      target: { type: 'str' },                                // 사건의 대상(사람 id 또는 any·randomSleeper·mostInjured·most:<수치> 등). 걸릴 때 정해지고, 결과의 who:'target' 이 된다
      targetIf: { type: 'cond' },                             // (10-24) 대상 후보가 맞아야 하는 조건식 — 그 사람 수치(grudge·injury…)·self(그 사람 id)·flag:x_target. 예 "self!=gicheol" · "grudge>=3"
      targetOptional: { type: 'bool01' },                     // (10-24) 1 = 대상을 못 정해도 사건은 걸린다. 대상이 필요한 선택지(결과가 who:'target' 을 쓰거나 req.target)만 잠긴다(req.why 또는 '댈 이름이 없다')
      board: { type: 'bool01' },                              // kind ending 전용: 1 = 이 결말이 걸려 있는 동안 board 동작으로 태울 사람을 고른다
      endStatus: { type: 'enum', enum: ['stayed', 'walked'] }, // kind ending 전용: 결말 뒤 역에 남은 산 사람의 명부 status (기본 stayed)
    } },
    people: { key: 'id', cols: {
      id: { type: 'id', req: true }, name: { type: 'str', req: true }, age: { type: 'any' }, bio: { type: 'str' },
      skills: { type: 'obj', req: true }, needs: { type: 'obj' }, secretFlag: { type: 'str' }, malice: { type: 'any' }, hymn: { type: 'any' },
      callsGod: { type: 'str', maxLen: 6 }, addressYou: { type: 'obj' }, outside: { type: 'bool01' },
      metFlag: { type: 'id' },        // 만남 깃발(id 꼴 또는 빈칸). 비었으면 처음부터 아는 사람. 있으면 그 깃발이 서기 전까지 '안 만난 사람'(배식·무작위 대상·명부에서 빠진다)
      startAway: { type: 'bool01' },  // 1 = 처음엔 역 밖(status away). metFlag 깃발이 서면 역에 온다(home). 밤 사건·배식·새 날 수치에서 빠진다
      addressCold: { type: 'str', maxLen: 6 },   // (10-24 A1 E5) 원한이 높을 때(numbers sign_cold_call, 기본 5) 당신을 부르는 말. 빈 글 "" = 부르지 않는다. 칸이 없으면 늘 addressYou
    } },
    maps: { key: 'id', cols: {
      id: { type: 'id', req: true }, displayName: { type: 'str', req: true }, rows: { type: 'list', req: true, minLen: 1 },
      start: { type: 'list', req: true }, fire: { type: 'list' }, beds: { type: 'list' }, exits: { type: 'obj' }, objects: { type: 'list' },
      floodRows: { type: 'list' }, dark: { type: 'num', min: 0, max: 1 },
    } },
    lines: { key: 'id', unique: false, cols: {
      id: { type: 'id', req: true }, speaker: { type: 'str', req: true }, context: { type: 'cond' },
      grade: { type: 'enum', req: true, enum: ['normal', 'fixed', 'toast', 'choice'] }, text: { type: 'str', req: true },
      rumor: { type: 'bool01' }, truth: { type: 'bool01' },
    } },
    nightEvents: { key: 'id', cols: {
      id: { type: 'id', req: true }, role: { type: 'str', req: true }, actor: { type: 'str' }, target: { type: 'str' },   // actor 는 role:clock 이 아니면 필수(아래 검사)
      cond: { type: 'cond' }, weight: { type: 'int', req: true, min: 1, max: 10 }, kind: { type: 'enum', req: true, enum: ['malice', 'hymn', 'neutral'] },
      trace: { type: 'obj' }, rumor: { type: 'obj' }, effects: { type: 'obj' }, oncePerRun: { type: 'bool01' }, text: { type: 'str' },
      missed: { type: 'obj' }, caught: { type: 'obj' },   // (10-24 A4 E1) 방치 판정: 다음 밤 굴림 첫머리에 못 봤으면 missed, 봤으면 caught = { effects, trace } 를 같은 행위자·대상으로
      public: { type: 'bool01' },                          // (10-24 A4) 1 = 누구나 아는 밤 — 굴릴 때 바로 발견(kill 효과가 있는 행은 안 적어도 그렇다)
      side: { type: 'bool01' },                            // (10-24) 1 = 곁가지 행: 한 밤 상한(max_per_night)·행위자 한 번 규칙 밖에서 따로 굴린다(weight/10 확률, 한 밤에 한 번) — 신호용 흔적 행이 다른 사건 자리를 뺏지 않게
    } },
    objects: { key: 'id', cols: {
      id: { type: 'id', req: true }, name: { type: 'str', req: true }, states: { type: 'list', req: true, minLen: 1, maxLen: 4, ofId: true },
      overlay: { type: 'obj' }, inspectLine: { type: 'obj' }, ledgerFact: { type: 'obj' }, solid: { type: 'bool01' }, light: { type: 'int', min: 0, max: 6 },
      resetOn: { type: 'enum', enum: ['never', 'inspect', 'morning'] }, map: { type: 'str' },
      owner: { type: 'id' },          // (10-24 P0-E2) 주인 사람 id. 비면 id 끝 '_<사람 id>'(bottle_mari → mari)가 주인, 그것도 없으면 주인 없는 물건. 배치 검사(같은 칸 = 같은 주인)만 쓴다
      holds: { type: 'obj' },         // (P1-11 엔진 몫) 수납 내용 { text, effects, state }. 닫힌(states[0]) 채로 조사하고 그 조사에 걸린 사건이 없으면 '닫힘→얻음→열림': effects 적용 → state(기본 open, 없으면 states[1]) → 결과는 s.found
    } },
  };
  // 정체 결정표는 행 목록이 아니라 { axes:[...], candidates:[...] } 한 덩어리
  const IDENTITY_COLS = {
    id: { type: 'id', req: true }, rule: { type: 'cond', req: true }, priority: { type: 'int', req: true, min: 1, max: 9 },
    fallback: { type: 'bool01' }, reveal: { type: 'list', req: true }, dreams: { type: 'list' }, callName: { type: 'str' },
    ledgerReader: { type: 'enum', req: true, enum: ['you', 'conductor', 'resident'] }, name: { type: 'str' },
  };
  const TABLE_NAMES = Object.keys(T).concat(['identity']);

  const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  function checkCell(col, def, v, err) {
    if (v === undefined || v === null || v === '' || v === '-') { if (def.req) err(`${col}: 필수 열이 비었음`); return; }
    switch (def.type) {
      case 'id': if (typeof v !== 'string' || !ID.test(v)) err(`${col}: id는 소문자·숫자·밑줄 24자 이내 ("${v}")`); break;
      case 'str': if (typeof v !== 'string') err(`${col}: 글이어야 함`); else if (def.maxLen && Array.from(v).length > def.maxLen) err(`${col}: ${def.maxLen}자 초과`); break;
      case 'int': if (!isInt(v)) err(`${col}: 정수여야 함 ("${v}")`); else { if (def.min != null && v < def.min) err(`${col}: ${def.min} 미만 (${v})`); if (def.max != null && v > def.max) err(`${col}: ${def.max} 초과 (${v})`); } break;
      case 'num': if (typeof v !== 'number') err(`${col}: 숫자여야 함`); else { if (def.min != null && v < def.min) err(`${col}: ${def.min} 미만`); if (def.max != null && v > def.max) err(`${col}: ${def.max} 초과`); } break;
      case 'bool01': if (!(v === 0 || v === 1 || v === true || v === false)) err(`${col}: 0/1 이어야 함 ("${v}")`); break;
      case 'enum': if (!def.enum.includes(v)) err(`${col}: ${def.enum.join('/')} 중 하나여야 함 ("${v}")`); break;
      case 'list': if (!Array.isArray(v)) err(`${col}: 목록이어야 함`); else { if (def.minLen && v.length < def.minLen) err(`${col}: 최소 ${def.minLen}개`); if (def.maxLen && v.length > def.maxLen) err(`${col}: 최대 ${def.maxLen}개`); if (def.ofId) v.forEach((x, i) => { if (typeof x !== 'string' || !ID.test(x)) err(`${col}[${i}]: id 꼴이 아님 ("${x}")`); }); if (def.ofAction) v.forEach((x, i) => { if (typeof x !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,23}$/.test(x)) err(`${col}[${i}]: 동작 이름 꼴이 아님 ("${x}")`); }); } break;
      case 'obj': if (!isObj(v)) err(`${col}: {열:값} 꼴이어야 함`); break;
      case 'cond': if (typeof v !== 'string') err(`${col}: 조건식은 글이어야 함`); else { try { C.parse(v); } catch (e) { err(`${col}: ${e.message}`); } } break;
      default: break;
    }
  }

  // 효과 동사 검사: { food:-1, flag:{x:true}, trace:{obj:'state'}, axis:{share:1}, injure:{who,n}, kill:{who}, permanent:{who,kind} }
  function checkEffects(eff, ctx, err) {
    if (!isObj(eff)) { err('effects: {동사:값} 꼴이어야 함'); return; }
    for (const [k, v] of Object.entries(eff)) {
      if (k === 'flag') { if (!isObj(v)) err('effects.flag: {이름:true/false}'); else for (const f of Object.keys(v)) if (!ID.test(f)) err(`effects.flag.${f}: id 꼴이 아님`); }
      else if (k === 'trace') { if (!isObj(v)) err('effects.trace: {물건:상태}'); else for (const [o, st] of Object.entries(v)) checkTrace(o, st, ctx, (m) => err('effects.trace.' + m)); }
      else if (k === 'axis') { if (!isObj(v)) err('effects.axis: {축:±정수}'); else for (const [a, n] of Object.entries(v)) { if (!ctx.axes.includes(a)) err(`effects.axis.${a}: identity.axes에 없는 축`); if (!isInt(n) || Math.abs(n) > 3) err(`effects.axis.${a}: −3~+3 정수`); } }
      else if (k === 'injure') { for (const x of many(v, err, k)) { if (!isObj(x) || !isInt(x.n) || x.n === 0 || x.n < -3 || x.n > 3) err('effects.injure: {who, n:±1~3} (음수 = 부상 회복)'); else checkWho(x.who, ctx, (m) => err('effects.injure.' + m)); } }
      else if (k === 'kill') { for (const x of many(v, err, k)) { if (!isObj(x) || typeof x.who !== 'string') err('effects.kill: {who}'); else checkWho(x.who, ctx, (m) => err('effects.kill.' + m)); } }
      else if (k === 'permanent') { for (const x of many(v, err, k)) { if (!isObj(x) || !PERMANENT.includes(x.kind)) err(`effects.permanent.kind: ${PERMANENT.join('/')} 중 하나`); else checkWho(x.who, ctx, (m) => err('effects.permanent.' + m)); } }
      else { const n = ctx.numbers[k]; if (!n) err(`effects.${k}: numbers 표에 없는 수치 (동사는 ${EFFECT_VERBS.join('/')}뿐)`); else for (const x of many(v, err, k)) { if (!(isInt(x) || (isObj(x) && isInt(x.n)))) err(`effects.${k}: ±정수 또는 {who, n}`); else if (isObj(x)) checkWho(x.who, ctx, (m) => err(`effects.${k}.` + m)); } }
    }
  }
  // 한 결과에서 같은 동사·수치를 여러 번 쓰면 목록(전부 적용). 빈 목록은 오류
  function many(v, err, k) { if (!Array.isArray(v)) return [v]; if (!v.length) err(`effects.${k}: 빈 목록`); return v; }
  // who: 낱말(you·self·actor·target·companion·party·all·bondOfActor·world) 또는 사람 id. 빈칸 = 행위자
  const WHO_WORDS = ['you', 'self', 'actor', 'target', 'companion', 'party', 'all', 'bondOfActor', 'world'];
  function checkWho(who, ctx, err) { if (who == null || who === '') return; if (typeof who !== 'string' || !(WHO_WORDS.includes(who) || ctx.people[who])) err(`who: "${who}" — ${WHO_WORDS.join('·')} 또는 사람 id`); }
  // 결과의 명부 줄: { who, status, day, cause, text } 또는 그 목록. status 는 명부 status, day 는 "{day}"·정수, cause 는 글 또는 "물건:상태"(그 물건의 ledgerFact 줄)
  const LEDGER_STATUS = ['dead', 'ascended', 'boarded', 'stayed', 'walked'];
  function checkLedger(L, ctx, err) {
    for (const x of Array.isArray(L) ? L : [L]) {
      if (typeof x === 'string') continue;                                 // 글 한 줄 = 당신의 사실 줄
      if (!isObj(x)) { err('ledger: {who, status, day, cause, text} 또는 그 목록'); continue; }
      checkWho(x.who, ctx, (m) => err('ledger.' + m));
      if (x.status != null && x.status !== '' && !LEDGER_STATUS.includes(x.status)) err(`ledger.status: ${LEDGER_STATUS.join('/')} 중 하나 ("${x.status}")`);
      if (x.day != null && x.day !== '' && !(isInt(x.day) || /^(\{day\}|\d+)$/.test(String(x.day)))) err(`ledger.day: "{day}" 또는 정수 ("${x.day}")`);
      if (x.text != null && typeof x.text !== 'string') err('ledger.text: 글');
      if (typeof x.cause === 'string' && /^[a-z0-9_]+:[a-z0-9_]+$/.test(x.cause)) { const [o, st] = x.cause.split(':'); const ob = ctx.objects[o]; if (!ob || !ob.ledgerFact || !ob.ledgerFact[st]) err(`ledger.cause: "${x.cause}" — objects 의 ledgerFact 에 그 상태 줄이 없음`); }
      else if (x.cause != null && typeof x.cause !== 'string') err('ledger.cause: 글 또는 "물건:상태"');
    }
  }
  // 'bowl_{actor}' 같은 자리표시: 사람 id 를 넣어 만들어지는 물건이 하나라도 있어야 하고, 전부 그 상태를 가져야 한다
  const ROLE_PH = /\{(actor|target)\}|_(actor|target)$/;   // bowl_{actor} 또는 bowl_actor
  function traceTargets(o, ctx) {
    if (!ROLE_PH.test(o)) return ctx.objects[o] ? [ctx.objects[o]] : [];
    const out = [];
    for (const pid of Object.keys(ctx.people)) { const id = o.replace(new RegExp(ROLE_PH.source, 'g'), (m, a) => (a ? pid : '_' + pid)); if (ctx.objects[id]) out.push(ctx.objects[id]); }
    return out;
  }
  function checkTrace(o, st, ctx, err) {
    const obs = traceTargets(o, ctx);
    if (!obs.length) { err(`${o}: objects 표에 없는 물건`); return; }
    for (const ob of obs) if (!ob.states.includes(st)) err(`${o}: 상태 "${st}"는 ${ob.id}의 ${ob.states.join('/')} 중 하나여야 함`);
  }

  // ── 수납 내용 holds (P1-11 엔진 몫 · U4 '걸어가서 수납을 연다') ──
  // { text: 열 때 한 번 보이는 글, effects: 사건 결과와 같은 효과, state: 연 뒤 상태 } — 셋 다 선택.
  // 연 뒤 상태 = state > 'open'(states 에 있고 첫 상태가 아니면) > states[1]. engine.js openStateOf 와 같은 규칙.
  const HOLDS_KEYS = ['text', 'effects', 'state'];
  const holdsOpenState = (o) => (o.holds && typeof o.holds.state === 'string' && o.holds.state ? o.holds.state : o.states.includes('open') && o.states[0] !== 'open' ? 'open' : o.states[1]);
  function checkHolds(o, ctx, err) {
    const h = o.holds;
    if (!isObj(h)) return;                                                  // 꼴 오류는 열 검사가 말했다
    for (const k of Object.keys(h)) if (!HOLDS_KEYS.includes(k)) err(`holds.${k}: holds 는 ${HOLDS_KEYS.join('·')} 만 쓴다`);
    if (!Array.isArray(o.states) || o.states.length < 2) { err('holds: 닫힘·열림 두 상태 이상이 있어야 한다 (states[0] = 닫힌 상태)'); return; }
    if (h.state != null && (typeof h.state !== 'string' || !o.states.includes(h.state))) err(`holds.state: "${h.state}" — states(${o.states.join('/')}) 가운데 하나`);
    else if (holdsOpenState(o) === o.states[0]) err(`holds.state: 연 뒤 상태가 닫힌 상태(states[0] "${o.states[0]}")와 같다`);
    if (h.text != null && typeof h.text !== 'string') err('holds.text: 글');
    if (h.effects != null) {
      checkEffects(h.effects, ctx, (m) => err('holds.' + m));
      if (isObj(h.effects) && (h.effects.kill || h.effects.permanent)) err('holds.effects: kill·permanent 는 쓸 수 없다 — 여는 것만으로 죽거나 몸을 잃지 않는다. 위험은 선택지가 있는 사건(when 에 inspect:물건)으로');
    }
  }

  // ── 배치·경고 도우미 (10-24 P0-E2) ──
  const isSolid = (o) => !!o && (o.solid === 1 || o.solid === true);
  // 물건의 주인: owner 칸(사람 id) > id 끝 '_<사람 id>'(가장 긴 것) > null(주인 없음)
  function ownerOf(ctx, id) {
    const o = ctx.objects[id];
    if (o && typeof o.owner === 'string' && o.owner && o.owner !== '-') return o.owner;
    return suffixOwner(ctx, id);
  }
  function suffixOwner(ctx, id) {
    let best = null;
    for (const p of Object.keys(ctx.people)) if (id.length > p.length + 1 && id.endsWith('_' + p) && (!best || p.length > best.length)) best = p;
    return best;
  }
  // 선택지 결과의 kill 대상(who) 목록 — out·ok·fail 전부
  function killWhos(c) {
    const out = [];
    for (const o of [c.out, c.ok, c.fail]) if (isObj(o) && isObj(o.effects) && o.effects.kill) for (const k of Array.isArray(o.effects.kill) ? o.effects.kill : [o.effects.kill]) if (isObj(k)) out.push(k.who || 'you');
    return out;
  }
  const ME_WHO = ['you', 'self', 'actor', 'party', 'all'];   // engine.js meWho 와 같은 낱말 (빈칸 = 행위자 = 당신)
  const REASON_WORDS = /때문에|왜냐하면/;                   // 문장 규칙(plan P0-D1): 이유를 대는 낱말은 쓰지 않는다
  const SOFT_FLOOR_BAN = ['#', '='];                       // 단단하지 않은 물건(바닥에 놓인 것)을 둘 수 없는 칸: 벽 · 승강장 끝선

  // ── 선택지 본문 검사 (기본 선택지와 swap 을 합친 선택지가 같이 쓴다) ──
  function checkChoiceBody(c, ctx, e2) {
    if (typeof c.label !== 'string' || !c.label) e2('label 필요');
    else if (Array.from(c.label).length > 18) e2(`label 18자 초과 ("${c.label}")`);
    if (c.check) {
      if (!isObj(c.check) || !['obs', 'str', 'tech', 'talk'].includes(c.check.skill) || !isInt(c.check.base) || c.check.base < 0 || c.check.base > 100) e2('check: {skill: obs/str/tech/talk, base: 0~100}');
      if (!isObj(c.ok) || !isObj(c.fail)) e2('check가 있으면 ok·fail 둘 다 필요');
    } else if (!isObj(c.out)) e2('out 필요');
    for (const o of [c.out, c.ok, c.fail].filter(Boolean)) {
      if (o.effects) checkEffects(o.effects, ctx, (m) => e2(m)); if (o.text != null && typeof o.text !== 'string') e2('결과 text는 글');
      if (o.image != null && typeof o.image !== 'string') e2('결과 image는 그림 id 글');
      if (o.ledger != null) checkLedger(o.ledger, ctx, (m) => e2(m));
      if (o.target != null && !validTarget(o.target, ctx)) e2(`target: 사람 id 또는 ${EVENT_TARGETS.join('·')}·most:<사람 수치> ("${o.target}")`);
    }
    if (c.req != null) {
      if (!isObj(c.req)) e2(`req: {${REQ_KEYS.join(', ')}} 꼴`);
      else {
        for (const k of Object.keys(c.req)) if (!REQ_KEYS.includes(k)) e2(`req.${k}: req 칸은 ${REQ_KEYS.join('·')}`);
        if (c.req.flag && !ID.test(c.req.flag)) e2('req.flag id 꼴 아님');
        if (c.req.permanent && !PERMANENT.includes(c.req.permanent)) e2('req.permanent 종류');
        if (c.req.notPermanent && !PERMANENT.includes(c.req.notPermanent)) e2('req.notPermanent 종류');
        if (c.req.cond != null && c.req.cond !== '') { if (typeof c.req.cond !== 'string') e2('req.cond: 조건식은 글'); else { try { C.parse(c.req.cond); } catch (e) { e2(`req.cond: ${e.message}`); } } }
        if (c.req.why != null && (typeof c.req.why !== 'string' || Array.from(c.req.why).length > 24)) e2('req.why: 잠금 이유는 글 24자 이내');
        if (c.req.target != null && ![0, 1, true, false].includes(c.req.target)) e2('req.target: 0/1');
      }
    }
    if (c.cost && isObj(c.cost)) for (const k of Object.keys(c.cost)) if (!ctx.numbers[k]) e2(`cost.${k}: numbers에 없음`);
  }
  // 줄타기 칸 rope 검사 (10-24 tightrope R0) — c = 기본 선택지
  function checkRope(c, ctx, e2) {
    const r = c.rope;
    if (!isObj(r)) { e2(`rope: {${ROPE_KEYS.join(', ')}} 꼴`); return; }
    for (const k of Object.keys(r)) if (!ROPE_KEYS.includes(k)) e2(`rope.${k}: rope 칸은 ${ROPE_KEYS.join('·')}`);
    if (!ROPE_KINDS.includes(r.kind)) e2(`rope.kind: ${ROPE_KINDS.join('/')} 중 하나 ("${r.kind}")`);
    if (r.from != null && (!isInt(r.from) || r.from < 0)) e2(`rope.from: 0 이상 정수 — 카르마 문턱 ("${r.from}")`);
    if (r.blind != null && ![0, 1, true, false].includes(r.blind) && !(typeof r.blind === 'string' && ID.test(r.blind))) e2(`rope.blind: 0/1 또는 깃발 id ("${r.blind}")`);
    if (r.blind && r.kind === 'fight') e2('rope.blind: 눈먼 새벽은 pay·endure·point 만 (fight 는 원래 판정을 깎는다)');
    if (r.skill != null && !['obs', 'str', 'tech', 'talk'].includes(r.skill)) e2('rope.skill: obs/str/tech/talk');
    if (r.fail != null) {
      if (!isObj(r.fail)) e2(`rope.fail: {${ROPE_FAIL_KEYS.join(', ')}} 꼴`);
      else {
        const f = r.fail;
        for (const k of Object.keys(f)) if (!ROPE_FAIL_KEYS.includes(k)) e2(`rope.fail.${k}: rope.fail 칸은 ${ROPE_FAIL_KEYS.join('·')}`);
        if (f.text != null && typeof f.text !== 'string') e2('rope.fail.text: 글');
        if (f.image != null && typeof f.image !== 'string') e2('rope.fail.image: 그림 id 글');
        if (f.how != null && !ROPE_HOW.includes(f.how)) e2(`rope.fail.how: ${ROPE_HOW.join('/')} 중 하나 ("${f.how}")`);
        if (f.effects != null) { checkEffects(f.effects, ctx, (m) => e2('rope.fail.' + m)); if (isObj(f.effects) && f.effects.kill) e2('rope.fail.effects: kill 은 쓰지 않는다 — 줄타기 실패는 늘 당신을 죽인다 (어떻게 = how 칸)'); }
        if (f.ledger != null) checkLedger(f.ledger, ctx, (m) => e2('rope.fail.' + m));
      }
    }
    if (r.kind === 'fight') variantsOf(c).forEach((x, j) => { if (!isObj(x.check)) e2(`rope.kind fight: 판정(check)이 있는 선택지에만 — ${j ? `swap[${j - 1}]` : '기본 선택지'}에 check 가 없다`); });
  }
  // 사건·결과 대상: 사람 id · 대상 낱말 · most:<사람 수치>
  function validTarget(v, ctx) {
    if (typeof v !== 'string') return false;
    if (ctx.people[v] || EVENT_TARGETS.includes(v)) return true;
    const m = MOST_TARGET.exec(v);
    return !!(m && ctx.numbers[m[1]] && ctx.numbers[m[1]].owner === 'person');
  }
  // ── swap (10-24 A1): 조건(when)이 맞으면 그 변형의 칸이 기본 선택지의 칸을 덮는다. engine.js 가 같은 함수를 쓴다 ──
  //  · 변형에 적힌 칸은 빈 값이어도 덮는다(빈 값 = 그 칸을 비움: warn:'' → 경고 없음, cost:{} → 비용 없음, taboo:'' → 금기 아님)
  //  · 변형에 out 이 있고 check 가 없으면 판정이 사라진다(check·ok·fail 지움). 변형에 check 가 있으면 out 이 사라진다(ok·fail 은 변형 것, 없으면 기본 것)
  const blankV = (v) => v == null || v === '' || v === '-' || (isObj(v) && !Object.keys(v).length);
  const hasK = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function mergeSwap(base, v) {
    const m = Object.assign({}, base); delete m.swap;
    for (const k of Object.keys(v)) if (k !== 'when') m[k] = v[k];
    if (hasK(v, 'out') && !hasK(v, 'check')) { delete m.check; delete m.ok; delete m.fail; }
    if (hasK(v, 'check')) { if (blankV(v.check)) { delete m.ok; delete m.fail; } else delete m.out; }
    for (const k of ['check', 'cost', 'req', 'taboo', 'warn', 'hint', 'out', 'ok', 'fail']) if (blankV(m[k])) delete m[k];
    return m;
  }
  const swapsOf = (c) => (!isObj(c) || c.swap == null ? [] : (Array.isArray(c.swap) ? c.swap : [c.swap]).filter(isObj));
  const variantsOf = (c) => [c].concat(swapsOf(c).map((v) => mergeSwap(c, v)));
  // 선택지가 사건 대상(who:'target'·흔적/깃발의 _target·명부 줄 who target)을 쓰는가 — 결과에 제 target 열이 있으면 그 결과는 사건 대상을 안 쓴다
  function usesTarget(c) {
    for (const o of [c.out, c.ok, c.fail]) {
      if (!isObj(o) || (typeof o.target === 'string' && o.target)) continue;
      const e = o.effects;
      if (isObj(e)) for (const [k, v] of Object.entries(e)) {
        if ((k === 'trace' || k === 'flag') && isObj(v)) { if (Object.keys(v).some((x) => /\{target\}|_target$/.test(x))) return true; continue; }
        if (k === 'axis') continue;
        for (const x of Array.isArray(v) ? v : [v]) if (isObj(x) && x.who === 'target') return true;
      }
      for (const L of o.ledger == null ? [] : Array.isArray(o.ledger) ? o.ledger : [o.ledger]) if (isObj(L) && L.who === 'target') return true;
    }
    return false;
  }
  const needsTarget = (c) => !!(isObj(c) && ((isObj(c.req) && (c.req.target === 1 || c.req.target === true)) || usesTarget(c)));

  // ── 줄타기 rope (10-24 tightrope 설계 §1 R0) — 카르마가 쌓인 판에서 위험 0 출구를 '판정'으로 바꾼다. engine.js effChoice 가 swap 을 고른 뒤 같은 함수로 얹는다 ──
  //  선택지 칸 rope = { kind, from, blind, skill, fail } (기본 선택지에만 — swap 변형에는 못 쓴다. swap 이 고른 모습 위에 얹힌다)
  //   kind  pay(갚는다, talk) · endure(버틴다, str) · point(가리킨다, talk) · fight(싸운다 — 원래 판정의 base 를 깎는다)
  //   from  카르마 문턱(정수, 없으면 0 = 구간만 본다). 예 starve_you 는 8 (K2 부터)
  //   blind 1(깃발 strike_blind) 또는 깃발 id — 그 깃발이 서 있으면 카르마와 상관없이 눈먼 새벽 % (pay·endure·point 만)
  //   skill 판정 기술(없으면 kind 기본) · fail { text, how(dead|ascended|ashed, 기본 dead), image, effects(kill 은 안 쓴다 — 늘 당신을 죽인다), ledger }
  //  구간 = 그 순간의 karma: K1 ≥ rope_k1(5) · K2 ≥ rope_k2(8) · K3 ≥ rope_k3(12) · K4 ≥ rope_k4(16). 구간 0 이거나 karma < from 이면(눈먼 새벽도 아니면) 그대로.
  //  base: pay·endure·point = numbers rope_<kind>_<구간> (눈먼 새벽 rope_blind_<kind>, 둘 다면 낮은 쪽 · 원래 판정이면 min(원래, 표)) · fight = 원래 − rope_fight_<구간>.
  //        어느 쪽이든 rope_floor(30) 아래로는 안 간다 (화면 % = base + 기술 × 5, 기술은 0 밑으로 안 내려간다 = 바닥)
  //  판정 없던 선택지: 성공 = 원래 out (비용은 그대로 먼저 낸다) · 실패 = 당신 죽음 + fail 글. 판정이던 선택지: 실패가 당신을 안 죽였으면 죽음을 더한다(글은 fail.text, 없으면 원래 글).
  //  경고 = 원래 경고 + 꼬리(대사표 rope_tail_<kind>, 없으면 아래 기본 글 — '끝이다'가 꼭 든다). 원래 경고에 이미 '끝이다'가 있으면 그대로. fight 는 원래 경고 그대로.
  //  손잡이(numbers 세계 수치, owner world · visible never)가 표에 없으면 아래 기본값 [제안] 을 쓴다 — 표 한 곳에서 돌린다.
  const ROPE_KINDS = ['pay', 'endure', 'point', 'fight'];
  const ROPE_KEYS = ['kind', 'from', 'blind', 'skill', 'fail'];
  const ROPE_FAIL_KEYS = ['text', 'how', 'image', 'effects', 'ledger'];
  const ROPE_HOW = ['dead', 'ascended', 'ashed'];
  const ROPE_SKILL = { pay: 'talk', endure: 'str', point: 'talk' };
  const ROPE_BLIND_FLAG = 'strike_blind';
  const ROPE_BANDS = 4;
  const ROPE_DEFAULTS = {
    rope_k1: 5, rope_k2: 8, rope_k3: 12, rope_k4: 16,
    rope_pay_1: 92, rope_pay_2: 90, rope_pay_3: 85, rope_pay_4: 78,
    rope_endure_1: 88, rope_endure_2: 85, rope_endure_3: 78, rope_endure_4: 70,
    rope_point_1: 82, rope_point_2: 70, rope_point_3: 55, rope_point_4: 40,
    rope_fight_1: 0, rope_fight_2: 0, rope_fight_3: 5, rope_fight_4: 10,
    rope_floor: 30, rope_blind_pay: 85, rope_blind_endure: 75, rope_blind_point: 65,
  };
  const ROPE_KNOB = /^rope_(k[1-4]|(pay|endure|point|fight)_[1-4]|floor|blind_(pay|endure|point))$/;
  const ROPE_TAIL = { pay: '안 받으면 끝이다', endure: '못 버티면 끝이다', point: '아무도 안 돌아서면 끝이다' };     // 대사표 rope_tail_<kind> 가 없을 때
  const ROPE_FAIL_TEXT = { pay: '받아 들고도 손이 풀리지 않았다.', endure: '버티던 몸이 먼저 꺾였다.', point: '아무도 손끝을 따라 돌아보지 않았다.' };   // rope.fail.text 가 없을 때
  // get(id) = 세계 수치 값(없으면 undefined) → 손잡이 값
  const ropeKnob = (get, id) => { const v = get ? get(id) : undefined; return Number.isFinite(v) ? v : ROPE_DEFAULTS[id]; };
  const ropeBlindFlag = (spec) => (isObj(spec) && typeof spec.blind === 'string' && ID.test(spec.blind) ? spec.blind : ROPE_BLIND_FLAG);
  function ropeBand(karma, get) { let b = 0; for (let i = 1; i <= ROPE_BANDS; i++) if ((karma || 0) >= ropeKnob(get, 'rope_k' + i)) b = i; return b; }
  // 지금 줄타기가 걸리나: { band(걸린 구간, 0 = 구간 아님), bandOn, blind(눈먼 새벽), active }
  function ropeState(spec, karma, flags, get) {
    const k = karma || 0;
    const band = ropeBand(k, get);
    const bandOn = band >= 1 && k >= (isInt(spec.from) ? spec.from : 0);
    const blind = !!(spec.blind && spec.kind !== 'fight' && flags && flags[ropeBlindFlag(spec)] === true);
    return { band: bandOn ? band : 0, bandOn, blind, active: bandOn || blind };
  }
  // 줄타기 판정 { skill, base(바닥 적용), pct(표 값 — fight 는 null), floor } · 걸리지 않거나 fight 인데 판정이 없으면 null. form = swap 을 고른 뒤의 선택지
  function ropeCheck(spec, form, st, get) {
    if (!st || !st.active || !isObj(spec) || !ROPE_KINDS.includes(spec.kind)) return null;
    const floor = ropeKnob(get, 'rope_floor');
    const has = isObj(form.check) && isInt(form.check.base);
    if (spec.kind === 'fight') {
      if (!has || !st.bandOn) return null;
      const pen = ropeKnob(get, `rope_fight_${st.band}`);
      return { skill: form.check.skill, base: Math.max(floor, Math.min(form.check.base, form.check.base - pen)), pct: null, floor };
    }
    const vals = [];
    if (st.bandOn) vals.push(ropeKnob(get, `rope_${spec.kind}_${st.band}`));
    if (st.blind) vals.push(ropeKnob(get, `rope_blind_${spec.kind}`));
    if (!vals.length) return null;
    const pct = Math.min(...vals);
    return { skill: has ? form.check.skill : spec.skill || ROPE_SKILL[spec.kind], base: Math.max(floor, has ? Math.min(form.check.base, pct) : pct), pct, floor };
  }
  const outKillsMe = (o) => isObj(o) && isObj(o.effects) && !!o.effects.kill && (Array.isArray(o.effects.kill) ? o.effects.kill : [o.effects.kill]).some((k) => isObj(k) && ME_WHO.includes(k.who || 'you'));
  // 살 길이 있나(표 검사용 — 실제 % 는 기술에 달렸다): 판정이면 성공이 안 죽이거나 실패가 안 죽인다 · 판정 없으면 결과가 안 죽인다 (engine.js survival 의 표 꼴)
  const canLive = (x) => (isObj(x.check) ? (!outKillsMe(x.ok) && !(isInt(x.check.base) && x.check.base <= 0)) || (!outKillsMe(x.fail) && !(isInt(x.check.base) && x.check.base >= 100)) : !outKillsMe(x.out));
  // 실패 결과 effects 합치기: flag·trace 는 칸별로, axis 는 더하고, 그 밖의 같은 키는 목록(전부 적용)
  function mergeEffects(a, b) {
    const out = Object.assign({}, isObj(a) ? a : {});
    for (const [k, v] of Object.entries(isObj(b) ? b : {})) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) { out[k] = v; continue; }
      if ((k === 'flag' || k === 'trace') && isObj(out[k]) && isObj(v)) out[k] = Object.assign({}, out[k], v);
      else if (k === 'axis' && isObj(out[k]) && isObj(v)) { const sum = Object.assign({}, out[k]); for (const [x, n] of Object.entries(v)) sum[x] = (sum[x] || 0) + n; out[k] = sum; }
      else out[k] = [].concat(out[k], v);
    }
    return out;
  }
  // 줄타기 실패 결과: orig = 원래 실패(판정이던 선택지) 또는 null(판정 없던 선택지)
  function ropeFail(orig, spec) {
    const f = isObj(spec.fail) ? spec.fail : {};
    const o = { text: typeof f.text === 'string' && f.text ? f.text : isObj(orig) && typeof orig.text === 'string' && orig.text ? orig.text : ROPE_FAIL_TEXT[spec.kind] || '' };
    const img = typeof f.image === 'string' && f.image ? f.image : isObj(orig) && typeof orig.image === 'string' ? orig.image : '';
    if (img) o.image = img;
    const eff = mergeEffects(isObj(orig) ? orig.effects : null, f.effects);
    const kill = { who: 'you', how: ROPE_HOW.includes(f.how) ? f.how : 'dead' };
    eff.kill = eff.kill ? [].concat(eff.kill, kill) : kill;
    o.effects = eff;
    const led = f.ledger != null && f.ledger !== '' ? f.ledger : isObj(orig) && orig.ledger != null && orig.ledger !== '' ? orig.ledger : null;
    if (led != null) o.ledger = led;
    if (isObj(orig) && typeof orig.target === 'string' && orig.target) o.target = orig.target;
    return o;
  }
  // 경고 + 꼬리 (원래 경고에 '끝이다'·꼬리가 이미 있으면 그대로)
  function ropeWarn(w, tail) {
    const s = typeof w === 'string' ? w : '';
    if (s && (/끝이다/.test(s) || (tail && s.includes(tail)))) return s;
    if (!tail) return s;
    const b = s.replace(/[.\s]+$/, '');
    return b ? `${b}. ${tail}` : tail;
  }
  // swap 을 고른 뒤의 선택지 form 에 줄타기를 얹은 선택지. rc = ropeCheck 결과(null 이면 그대로), tail = 경고 꼬리 글
  function applyRope(form, spec, rc, tail) {
    if (!rc || !isObj(form)) return form;
    const m = Object.assign({}, form);
    if (isObj(form.check)) {
      m.check = { skill: rc.skill, base: rc.base };
      if (!outKillsMe(form.fail)) m.fail = ropeFail(form.fail, spec);
    } else {
      if (!isObj(form.out) || outKillsMe(form.out)) return form;   // 이미 확정 죽음(대답한다 등) — 줄타기로 바꿀 것이 없다
      m.check = { skill: rc.skill, base: rc.base };
      m.ok = form.out; delete m.out;
      m.fail = ropeFail(null, spec);
    }
    if (spec.kind !== 'fight') m.warn = ropeWarn(form.warn, tail);
    return m;
  }
  // 표 검사용: 선택지의 모든 줄타기 모습 [{ form, band, blind, pct }] — 변형(swap)마다 × (닿을 수 있는 구간 1~4 · 눈먼 새벽 · 눈먼 새벽 × 구간). get = 세계 수치 첫 값
  function ropeFormsOf(c, get, tailOf) {
    const spec = isObj(c) ? c.rope : null;
    if (!isObj(spec) || !ROPE_KINDS.includes(spec.kind)) return [];
    const ks = []; for (let i = 1; i <= ROPE_BANDS; i++) ks.push(ropeKnob(get, 'rope_k' + i)); ks.push(Infinity);
    const from = isInt(spec.from) ? spec.from : 0;
    const states = [];
    for (let b = 1; b <= ROPE_BANDS; b++) if (ks[b] > ks[b - 1] && ks[b] > from) states.push({ band: b, bandOn: true, blind: false, active: true });
    if (spec.blind && spec.kind !== 'fight') { states.push({ band: 0, bandOn: false, blind: true, active: true }); for (const st of states.slice()) if (st.bandOn) states.push(Object.assign({}, st, { blind: true })); }
    const tail = tailOf ? tailOf(spec.kind) : ROPE_TAIL[spec.kind] || '';
    const out = [];
    for (const x of variantsOf(c)) for (const st of states) { const rc = ropeCheck(spec, x, st, get); if (!rc) continue; const form = applyRope(x, spec, rc, spec.kind === 'fight' ? '' : tail); if (form !== x) out.push({ form, band: st.band, blind: st.blind, pct: rc.pct }); }
    return out;
  }
  // 줄타기처럼 쓴 swap 변형(R2): when 에 karma·flag:strike_blind 가 들고, 살 길이 있는 판정 — 1번 자리 '당신이 죽을 수 있다'에서 뺀다
  function ropeLikeSwap(v, x) {
    if (!isObj(v) || typeof v.when !== 'string' || !isObj(x.check) || !canLive(x)) return false;
    let ns = []; try { ns = C.names(C.parse(v.when)); } catch (e) { return false; }
    return ns.some((n) => n === 'karma' || n === 'flag:' + ROPE_BLIND_FLAG);
  }

  // 검사 = { errors, warnings }. errors 가 하나라도 있으면 표를 읽지 않는다(load 가 던진다). warnings 는 읽되 알린다.
  //   warnings[].kind: firstDeath(1번 자리 죽음) · reasonWord(이유 낱말) · owner(주인 없는 물건이 남의 머리맡 묶음에) · holdsRefill(다시 차는 수납, P1-11) · unknownRef(조건식의 없는 물건·사람·상태, 10-25) · unplaced(지도에 없는 수납·원정 조사 물건, 10-25) · noExit(확정 사망 길, E4 10-24 · R1) · ropeFail(줄타기 실패 글 없음, 10-24 tightrope)
  function validate(tables) { return check(tables).errors; }
  function warnings(tables) { return check(tables).warnings; }
  function check(tables) {
    const errors = [], warns = [];
    const push = (table, i, id, msg) => errors.push({ table, row: i, id, msg, text: `${table}[${i}]${id ? ' ' + id : ''}: ${msg}` });
    const warn = (table, i, id, kind, msg) => warns.push({ table, row: i, id, kind, msg, text: `${table}[${i}]${id ? ' ' + id : ''}: [${kind}] ${msg}` });
    const done = () => ({ errors, warnings: warns });
    if (!isObj(tables)) return { errors: [{ text: '표 묶음이 객체가 아님' }], warnings: [] };
    for (const name of TABLE_NAMES) if (tables[name] === undefined) push(name, -1, '', '표가 없음');
    if (errors.length) return done();

    // 1) 열 검사
    for (const [name, spec] of Object.entries(T)) {
      const rows = tables[name];
      if (!Array.isArray(rows)) { push(name, -1, '', '행 목록(배열)이어야 함'); continue; }
      const seen = new Set();
      rows.forEach((row, i) => {
        if (!isObj(row)) { push(name, i, '', '행이 객체가 아님'); return; }
        const id = row[spec.key];
        const err = (m) => push(name, i, typeof id === 'string' ? id : '', m);
        for (const [col, def] of Object.entries(spec.cols)) checkCell(col, def, row[col], err);
        for (const col of Object.keys(row)) if (!spec.cols[col]) err(`${col}: 스키마에 없는 열`);
        if (spec.unique !== false && typeof id === 'string') { if (seen.has(id)) err('id 중복'); seen.add(id); }
      });
    }
    const idn = tables.identity;
    if (!isObj(idn) || !Array.isArray(idn.axes) || !Array.isArray(idn.candidates)) push('identity', -1, '', '{ axes:[...], candidates:[...] } 꼴이어야 함');
    else {
      idn.axes.forEach((a, i) => { if (typeof a !== 'string' || !ID.test(a)) push('identity', -1, '', `axes[${i}]: id 꼴이 아님`); });
      if (idn.candidates.length < 4 || idn.candidates.length > 7) push('identity', -1, '', `후보는 4~7개 (지금 ${idn.candidates.length})`);
      let fb = 0; const seen = new Set();
      idn.candidates.forEach((c, i) => {
        if (!isObj(c)) { push('identity', i, '', '후보가 객체가 아님'); return; }
        const err = (m) => push('identity', i, c.id, m);
        for (const [col, def] of Object.entries(IDENTITY_COLS)) checkCell(col, def, c[col], err);
        for (const col of Object.keys(c)) if (!IDENTITY_COLS[col]) err(`${col}: 스키마에 없는 열`);
        if (c.fallback === 1 || c.fallback === true) fb++;
        if (seen.has(c.id)) err('id 중복'); seen.add(c.id);
        if (typeof c.rule === 'string') { try { for (const n of C.names(C.parse(c.rule))) if (!idn.axes.includes(n)) err(`rule: "${n}" — 정체 규칙은 축(${idn.axes.join('·')})만 쓸 수 있다`); } catch (e) { /* 위에서 보고됨 */ } }
      });
      if (fb !== 1) push('identity', -1, '', `fallback=1 인 후보가 정확히 1개여야 함 (지금 ${fb})`);
    }
    if (errors.length) return done();

    // 2) 표 사이 참조 검사
    const by = (name) => Object.fromEntries(tables[name].map((r) => [r.id, r]));
    const ctx = { numbers: by('numbers'), objects: by('objects'), people: by('people'), events: by('events'), lines: by('lines'), maps: by('maps'), axes: idn.axes };
    const phaseIds = tables.phases.map((p) => p.id);
    const orders = tables.phases.map((p) => p.order);
    if (new Set(orders).size !== orders.length) push('phases', -1, '', 'order 중복');
    // (10-24 tightrope) 줄타기 손잡이: numbers 의 rope_* 세계 수치 첫 값(없으면 기본값) · 경고 꼬리: 대사표 rope_tail_<kind>(없으면 기본 글)
    const knobGet = (id) => (ctx.numbers[id] && ctx.numbers[id].owner === 'world' && isInt(ctx.numbers[id].start) ? ctx.numbers[id].start : undefined);
    const tailOf = (kind) => (kind === 'fight' ? '' : ctx.lines['rope_tail_' + kind] && typeof ctx.lines['rope_tail_' + kind].text === 'string' && ctx.lines['rope_tail_' + kind].text ? ctx.lines['rope_tail_' + kind].text : ROPE_TAIL[kind] || '');
    const ropeFloorV = ropeKnob(knobGet, 'rope_floor');
    const numIdx = (id) => tables.numbers.findIndex((n) => n.id === id);
    tables.numbers.forEach((n, i) => {
      if (!ROPE_KNOB.test(n.id)) return;
      const err = (m) => push('numbers', i, n.id, m);
      if (n.owner !== 'world') err('rope_*: 줄타기 손잡이는 owner world');
      if (n.visible !== 'never') err('rope_*: 줄타기 손잡이는 visible never — 화면에 카르마 쪽 숫자를 보이지 않는다');
      if (/^rope_(pay|endure|point|blind)_/.test(n.id) && isInt(n.start) && (n.start < 0 || n.start > 100)) err(`rope_*: 판정 % 는 0~100 (${n.start})`);
    });
    // 바닥: pay·endure·point 의 구간 % 와 눈먼 새벽 % 는 rope_floor 이상 (fight 는 엔진이 바닥에서 멈춘다). 값이 표에 없으면(기본값) 바닥 행이 틀린 것
    for (const id of Object.keys(ROPE_DEFAULTS)) {
      if (!/^rope_(pay|endure|point)_\d$|^rope_blind_/.test(id)) continue;
      const v = ropeKnob(knobGet, id);
      if (v < ropeFloorV) { const at = numIdx(id) >= 0 ? numIdx(id) : numIdx('rope_floor'); push('numbers', at, at >= 0 ? tables.numbers[at].id : id, `ropeFloor — ${id} ${v}% < 바닥 rope_floor ${ropeFloorV}% (당신을 죽이는 판정은 바닥 아래로 내려가지 않는다)`); }
    }
    for (let k = 2; k <= ROPE_BANDS; k++) {
      const lo = ropeKnob(knobGet, 'rope_k' + (k - 1)), hi = ropeKnob(knobGet, 'rope_k' + k);
      if (hi < lo) { const at = numIdx('rope_k' + k) >= 0 ? numIdx('rope_k' + k) : numIdx('rope_k' + (k - 1)); push('numbers', at, at >= 0 ? tables.numbers[at].id : 'rope_k' + k, `rope_k${k} ${hi} < rope_k${k - 1} ${lo} — 카르마 구간 문턱은 오름차순`); }
    }
    tables.events.forEach((ev, i) => {
      const err = (m) => push('events', i, ev.id, m);
      let free = 0;
      ev.choices.forEach((c, k) => {
        const e2 = (m) => err(`choices[${k}]: ${m}`);
        if (!isObj(c)) { e2('선택지가 객체가 아님'); return; }
        checkChoiceBody(c, ctx, e2);
        if (!c.cost && !c.req) free++;
        // (10-24 A1) swap: 조건이 맞으면 바뀌는 선택지. 객체 하나 또는 목록(앞에서부터 처음 맞는 것). 합친 선택지도 같은 검사를 받는다
        if (c.swap !== undefined) {
          const list = Array.isArray(c.swap) ? c.swap : [c.swap];
          if (!list.length) e2('swap: 빈 목록');
          list.forEach((v, j) => {
            const e3 = (m) => e2(`swap[${j}]: ${m}`);
            if (!isObj(v)) { e3('{when, …선택지 칸} 꼴이어야 함'); return; }
            for (const key of Object.keys(v)) if (!SWAP_KEYS.includes(key)) e3(`${key}: swap 에 쓸 수 있는 칸은 ${SWAP_KEYS.join('·')}`);
            if (typeof v.when !== 'string' || !v.when.trim()) e3('when: 조건식이 있어야 한다');
            else { try { C.parse(v.when); } catch (e) { e3(`when: ${e.message}`); } }
            checkChoiceBody(mergeSwap(c, v), ctx, e3);
          });
        }
        // (10-24 tightrope R0) 줄타기 칸 rope — 기본 선택지에만
        if (c.rope !== undefined) checkRope(c, ctx, e2);
        // (R3) 바닥 ropeFloor: 당신을 죽이는 판정(변형 포함)의 base < rope_floor(없으면 30) — 오류. 줄타기가 깎은 값은 엔진이 바닥에서 멈춘다(손잡이 값은 numbers 검사)
        variantsOf(c).forEach((x, j) => { if (isObj(x.check) && isInt(x.check.base) && (outKillsMe(x.fail) || outKillsMe(x.ok)) && x.check.base < ropeFloorV) e2(`${j ? `swap[${j - 1}]: ` : ''}ropeFloor — 당신을 죽이는 판정 base ${x.check.base} < 바닥 ${ropeFloorV} (numbers rope_floor, 없으면 ${ROPE_DEFAULTS.rope_floor}) — 확정 죽음이 아니면 살 확률이 바닥 아래로 내려가지 않는다`); });
      });
      if (!free) err('항상 고를 수 있는 선택지(cost·req 없음)가 하나도 없음 — 막다른 길');
      if (ev.target != null && !validTarget(ev.target, ctx)) err(`target: 사람 id 또는 ${EVENT_TARGETS.join('·')}·most:<사람 수치> ("${ev.target}")`);
      if (ev.targetIf != null && ev.target == null) err('targetIf: target 열과 같이 쓴다');
      if (ev.targetOptional && ev.target == null) err('targetOptional: target 열과 같이 쓴다');
      if ((ev.board || ev.endStatus) && ev.kind !== 'ending') err('board·endStatus 는 kind ending 사건에만');
      if (ev.image && ev.image !== '-' && typeof ev.image !== 'string') err('image는 그림 id 글');
    });
    // 사건·밤 사건 결과가 세우는 깃발 전부 (metFlag 가 영영 안 서는 오타를 잡는다)
    const setFlags = new Set();
    const addFlags = (eff) => { if (isObj(eff) && isObj(eff.flag)) for (const [f, on] of Object.entries(eff.flag)) if (on) setFlags.add(f); };
    tables.events.forEach((ev) => (Array.isArray(ev.choices) ? ev.choices : []).forEach((c) => { if (isObj(c)) { for (const x of variantsOf(c)) for (const o of [x.out, x.ok, x.fail]) if (isObj(o)) addFlags(o.effects); if (isObj(c.rope) && isObj(c.rope.fail)) addFlags(c.rope.fail.effects); } }));
    tables.nightEvents.forEach((n) => { addFlags(n.effects); for (const key of ['missed', 'caught']) if (isObj(n[key])) addFlags(n[key].effects); });
    tables.people.forEach((p, i) => {
      const err = (m) => push('people', i, p.id, m);
      const metFlag = typeof p.metFlag === 'string' && p.metFlag !== '-' ? p.metFlag : '';
      const away = p.startAway === 1 || p.startAway === true, out = p.outside === 1 || p.outside === true;
      if (away && !metFlag) err('startAway: 1 이면 metFlag 가 있어야 한다 (만남 깃발이 없으면 영영 역에 오지 않는다)');
      if (away && out) err('startAway: outside(바깥 사람)와 같이 쓸 수 없다');
      if (metFlag && p.id === 'you') err('metFlag: 당신(you)에게는 쓸 수 없다');
      if (metFlag && !setFlags.has(metFlag)) err(`metFlag: "${metFlag}" 깃발을 세우는 사건 효과(effects.flag)가 없다 — 영영 만나지 못한다`);
      for (const k of ['obs', 'str', 'tech', 'talk']) { const v = p.skills[k]; if (!isInt(v) || v < 0 || v > 3) err(`skills.${k}: 0~3 정수`); }
      if (p.needs) { for (const k of ['hunger', 'thirst', 'fear']) { const v = p.needs[k]; if (v !== undefined && (!isInt(v) || v < 0 || v > 10)) err(`needs.${k}: 0~10`); } if (p.needs.bond && p.needs.bond !== '-' && !ctx.people[p.needs.bond]) err(`needs.bond: 없는 사람 "${p.needs.bond}"`); }
      if (p.addressYou) for (const cid of Object.keys(p.addressYou)) if (cid !== 'default' && !idn.candidates.some((c) => c.id === cid)) err(`addressYou.${cid}: identity에 없는 후보 (기본 호칭은 default)`);
    });
    tables.nightEvents.forEach((n, i) => {
      const err = (m) => push('nightEvents', i, n.id, m);
      for (const col of ['cond', 'actor', 'target']) {
        const v = n[col]; if (typeof v !== 'string' || v === '-' || ctx.people[v] || v === 'bond' || v === 'any') continue;
        try { for (const nm of C.names(C.parse(v))) if (FORBIDDEN_NIGHT_NAMES.test(nm)) err(`${col}: "${nm}" — 밤 사건 조건에 당신 위치·선택은 쓸 수 없음`); } catch (e) { err(`${col}: ${e.message}`); }
      }
      const clock = n.role === 'clock';
      if (!clock && (!n.actor || n.actor === '-')) err('actor: 필수 열이 비었음 (세계 시계 사건은 role: clock)');
      if (clock && n.actor && n.actor !== '-') err('actor: role:clock 사건은 행위자가 없다');
      if (!clock && n.actor && ctx.people[n.actor] === undefined && n.actor !== 'any') { try { C.parse(n.actor); } catch (e) { err(`actor: 사람 id 또는 조건식이어야 함 ("${n.actor}")`); } }
      if (n.actor === 'you') err('actor: 당신은 밤 사건의 행위자가 될 수 없음');
      if (clock && n.kind !== 'neutral') err('kind: 세계 시계 사건은 neutral');
      if (n.trace) for (const [o, st] of Object.entries(n.trace)) checkTrace(o, st, ctx, (m) => err('trace.' + m));
      if (n.rumor) { if (!isObj(n.rumor) || typeof n.rumor.line !== 'string') err('rumor: {witness, line}'); else if (!ctx.lines[n.rumor.line]) err(`rumor.line: lines에 없음 "${n.rumor.line}"`); }
      if (n.effects) checkEffects(n.effects, ctx, err);
      for (const key of ['missed', 'caught']) {   // (10-24 A4 E1) { effects, trace } — 검사는 밤 사건 effects·trace 와 같다
        const v = n[key]; if (v === undefined) continue;
        const e2 = (m) => err(`${key}.${m}`);
        if (!isObj(v)) { e2('{effects, trace} 꼴이어야 함'); continue; }
        for (const k of Object.keys(v)) if (k !== 'effects' && k !== 'trace') e2(`${k}: missed·caught 는 effects·trace 만 쓴다`);
        if (v.effects !== undefined) checkEffects(v.effects, ctx, e2);
        if (v.trace !== undefined) { if (!isObj(v.trace)) e2('trace: {물건:상태}'); else for (const [o, st] of Object.entries(v.trace)) checkTrace(o, st, ctx, (m) => e2('trace.' + m)); }
      }
      if ((n.missed || n.caught) && n.role === 'clock') err('missed·caught: 세계 시계(role clock)는 방치 판정이 없다 — 행위자가 있는 행에만');
      if (n.side && n.role === 'clock') err('side: 세계 시계 행은 이미 상한 밖이다');
    });
    tables.objects.forEach((o, i) => {
      const err = (m) => push('objects', i, o.id, m);
      for (const col of ['overlay', 'inspectLine', 'ledgerFact']) if (o[col]) for (const st of Object.keys(o[col])) if (!o.states.includes(st)) err(`${col}.${st}: states에 없는 상태`);
      if (o.inspectLine) for (const l of Object.values(o.inspectLine)) if (!ctx.lines[l]) err(`inspectLine: lines에 없음 "${l}"`);
      if (o.map && !ctx.maps[o.map]) err(`map: maps에 없음 "${o.map}"`);
      if (typeof o.owner === 'string' && o.owner && o.owner !== '-') {
        if (!ctx.people[o.owner]) err(`owner: people 에 없는 사람 "${o.owner}"`);
        else { const sfx = suffixOwner(ctx, o.id); if (sfx && sfx !== o.owner) err(`owner: "${o.owner}" — id 끝(_${sfx})이 가리키는 주인과 다르다`); }
      }
      if (o.holds !== undefined) checkHolds(o, ctx, err);
    });
    tables.maps.forEach((m, i) => {
      const err = (x) => push('maps', i, m.id, x);
      const w = m.rows[0] ? m.rows[0].length : 0;
      m.rows.forEach((r, k) => { if (typeof r !== 'string' || r.length !== w) err(`rows[${k}]: 길이가 첫 줄(${w})과 다름`); });
      if (m.objects) m.objects.forEach((ob, k) => { if (!isObj(ob) || !ctx.objects[ob.id]) err(`objects[${k}]: objects 표에 없는 물건`); });
      // 배치 검사 (10-24 P0-E2 · U4): 단단한 물건은 한 칸에 하나 · 단단하지 않은 물건이 한 칸에 여럿이면 같은 주인 것만 · 단단하지 않은 물건은 벽(#)·끝선(=) 칸에 두지 않는다
      const cells = new Map();
      (m.objects || []).forEach((ob, k) => {
        if (!isObj(ob) || !ctx.objects[ob.id]) return;                                         // 위에서 보고함
        const row = m.rows[ob.y];
        if (!isInt(ob.x) || !isInt(ob.y) || typeof row !== 'string' || ob.x < 0 || ob.x >= row.length) { err(`objects[${k}] ${ob.id}: 자리 (${ob.x},${ob.y})가 지도 밖`); return; }
        const key = `${ob.x},${ob.y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(ob.id);
        const tile = row[ob.x];
        if (!isSolid(ctx.objects[ob.id]) && SOFT_FLOOR_BAN.includes(tile)) err(`objects[${k}] ${ob.id}: 단단하지 않은 물건이 '${tile}' 칸 (${key})에 있다 — 바닥 칸으로 옮긴다`);
      });
      for (const [key, ids] of cells) {
        const solid = ids.filter((id) => isSolid(ctx.objects[id]));
        if (solid.length > 1) err(`(${key}) 한 칸에 단단한 물건 ${solid.length}개: ${solid.join('·')} — 단단한 물건은 한 칸에 하나`);
        const soft = ids.filter((id) => !isSolid(ctx.objects[id]));
        if (soft.length < 2) continue;
        const owners = soft.map((id) => ownerOf(ctx, id));
        const named = Array.from(new Set(owners.filter(Boolean)));
        const anon = soft.filter((id, j) => !owners[j]);
        const list = soft.map((id, j) => `${id}(${owners[j] || '주인 없음'})`).join('·');
        if (named.length > 1) err(`(${key}) 다른 주인의 물건이 한 칸에: ${list} — 같은 칸은 같은 주인 흔적만`);
        else if (anon.length > 1) err(`(${key}) 주인 없는 물건이 한 칸에 둘 이상: ${list} — 같은 칸은 같은 주인 흔적만`);
        else if (anon.length === 1) warn('maps', i, m.id, 'owner', `(${key}) ${anon[0]}: 주인이 없는 물건(id 끝 _<사람>·owner 칸 없음)이 ${named[0]}의 물건과 한 칸에 있다 — objects 의 ${anon[0]} 에 owner:"${named[0]}" 를 적거나 칸을 옮긴다`);
      }
    });
    idn.candidates.forEach((c, i) => { if (c.reveal) c.reveal.forEach((l) => { if (!ctx.lines[l]) push('identity', i, c.id, `reveal: lines에 없음 "${l}"`); }); });
    tables.phases.forEach((p, i) => { if (p.skipIf) { try { C.parse(p.skipIf); } catch (e) { push('phases', i, p.id, 'skipIf: ' + e.message); } } });
    void phaseIds;

    // 3) 경고 (10-24 P0-E2) — 표는 읽히지만 고칠 것
    //  firstDeath: 선택지 [0](Space 를 누른 채 지나가면 골리는 자리, P0-S7)에 금기가 있거나, 당신이 죽을 수 있거나,
    //              다른 사람이 죽을 수 있는데 뒤에 아무도 안 죽는 선택지가 있다. (모든 선택지가 같은 사람을 죽이는 장면 — d8_pillow 등 — 은 자리를 바꿔도 같아 빼고 센다)
    //  (10-24 tightrope R2) 줄타기 판정(살 확률 > 0)은 '당신이 죽을 수 있다'에서 뺀다 — rope 칸(줄타기 모습은 변형 목록에 안 든다) · 줄타기처럼 쓴 swap 변형
    //              (when 에 karma·flag:strike_blind 가 든 살 길 있는 판정, ropeLikeSwap). 줄타기 구간에서 1번 = 갚는다(가장 높은 %). 금기·확정 죽음은 그대로 경고
    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices) || ev.choices.length < 2 || !isObj(ev.choices[0])) return;
      const c0 = ev.choices[0], v0 = variantsOf(c0), sw0 = swapsOf(c0);
      const k0 = [].concat(...v0.filter((x, j) => !(j > 0 && ropeLikeSwap(sw0[j - 1], x))).map(killWhos));   // swap 변형이 죽일 수 있어도 1번 자리 죽음이다 (줄타기 판정은 뺀다)
      const tab0 = v0.find((x) => x.taboo);
      const why = tab0 ? `금기("${tab0.taboo}")가 있다`
        : k0.some((w) => ME_WHO.includes(w)) ? '당신이 죽을 수 있다'
          : k0.length && ev.choices.slice(1).some((c) => isObj(c) && !killWhos(c).length) ? `${k0.join('·')} 이(가) 죽을 수 있는데 아무도 안 죽는 선택지가 뒤에 있다` : '';
      if (why) warn('events', i, ev.id, 'firstDeath', `choices[0] "${c0.label}": 1번 자리에 ${why} — 죽는 선택·금기는 1번에 두지 않는다`);
    });
    //  noExit (E4, 10-24 A1 · **10-24 tightrope R1 바꿈**): 당신을 죽일 수 있는 선택(swap 변형·줄타기 모습 포함)이 있는 사건에, 비용·req 없고 **살 확률 > 0** 인
    //          (변형·줄타기 모습까지 — 판정이면 성공이나 실패 한쪽이 안 죽인다) 선택지가 하나도 없다 — 확정 사망 길.
    //          금기도 출구로 센다. targetOptional 사건에서 대상이 필요한 선택지는 대상이 없으면 잠기므로 출구가 아니다.
    //          (전에는 '당신을 죽일 수 없는' 선택지만 출구로 셌다 — 줄타기 판은 일부러 위험 0 출구가 없다. 03 '어느 선택지에도 살 확률이 있다' = 살 확률 > 0 인 길이 늘 하나 이상)
    //          경고로 둔다(브라우저 로더가 틀린 행을 빼고 읽지 않게) — 지금 표에 0건인지는 테스트(karma.test.js)가 막는다.
    const killsMe = (c) => killWhos(c).some((w) => ME_WHO.includes(w));
    const formsAll = (c) => variantsOf(c).concat(ropeFormsOf(c, knobGet, tailOf).map((f) => f.form));
    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices)) return;
      const cs = ev.choices.filter(isObj);
      if (!cs.some((c) => formsAll(c).some(killsMe))) return;
      const exit = cs.some((c) => { const fs = formsAll(c); return fs.every((x) => !x.cost && !x.req && canLive(x)) && !(ev.targetOptional && fs.some(needsTarget)); });
      if (!exit) warn('events', i, ev.id, 'noExit', '당신이 죽을 수 있는 사건인데 늘 고를 수 있고(비용·req 없음) 살 확률이 있는(판정이면 한쪽은 안 죽는) 선택지가 없다 — 확정 사망 길. 몸값(버틴다 등)·판정·금기 출구를 하나 둔다');
    });
    //  ropeFail (10-24 tightrope): 판정 없던 모습에 줄타기(pay·endure·point)를 얹는데 실패 글(rope.fail.text)이 없다 — 엔진 기본 글이 나간다. 사건마다 새 글을 쓴다(40자 1문장 ≤ 2개)
    tables.events.forEach((ev, i) => (Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => {
      if (!isObj(c) || !isObj(c.rope) || c.rope.kind === 'fight' || !ROPE_KINDS.includes(c.rope.kind)) return;
      if (isObj(c.rope.fail) && typeof c.rope.fail.text === 'string' && c.rope.fail.text) return;
      if (variantsOf(c).some((x) => !isObj(x.check) && isObj(x.out) && !outKillsMe(x.out))) warn('events', i, ev.id, 'ropeFail', `choices[${k}] "${c.label}": rope.fail.text 가 없다 — 실패하면 기본 글("${ROPE_FAIL_TEXT[c.rope.kind]}")이 나간다`);
    }));
    //  reasonWord: 화면 글에 '때문에·왜냐하면' (문장 규칙 — 이유는 말하지 않는다)
    const reason = (table, i, id, col, v) => { if (typeof v === 'string' && REASON_WORDS.test(v)) warn(table, i, id, 'reasonWord', `${col}: '${REASON_WORDS.exec(v)[0]}' — 이유를 대는 낱말은 쓰지 않는다 ("${v.slice(0, 30)}…")`); };
    tables.events.forEach((ev, i) => {
      reason('events', i, ev.id, 'text', ev.text);
      (Array.isArray(ev.choices) ? ev.choices : []).forEach((c0, k) => { if (!isObj(c0)) return; variantsOf(c0).forEach((c, j) => { const at = j ? `choices[${k}].swap[${j - 1}]` : `choices[${k}]`; for (const col of ['label', 'warn', 'hint']) reason('events', i, ev.id, `${at}.${col}`, c[col]); if (isObj(c.req)) reason('events', i, ev.id, `${at}.req.why`, c.req.why); for (const r of ['out', 'ok', 'fail']) if (isObj(c[r])) reason('events', i, ev.id, `${at}.${r}.text`, c[r].text); }); if (isObj(c0.rope) && isObj(c0.rope.fail)) reason('events', i, ev.id, `choices[${k}].rope.fail.text`, c0.rope.fail.text); });
    });
    tables.lines.forEach((l, i) => reason('lines', i, l.id, 'text', l.text));
    tables.nightEvents.forEach((n, i) => reason('nightEvents', i, n.id, 'text', n.text));
    //  holdsRefill (P1-11): 수납 내용이 있는 물건이 resetOn morning·inspect — 첫 상태(닫힘)로 돌아가 매번 다시 찬다(위험 없는 샘, 10-21 '생존은 위험 대 보상')
    tables.objects.forEach((o, i) => {
      if (!isObj(o.holds)) return;
      reason('objects', i, o.id, 'holds.text', o.holds.text);
      if (o.resetOn === 'morning' || o.resetOn === 'inspect') warn('objects', i, o.id, 'holdsRefill', `resetOn "${o.resetOn}": 연 수납이 닫힌 상태로 돌아가 다시 찬다 — 위험 없이 매일 얻는 샘이 된다. 한 번 연 것은 열린 채 두려면 never`);
    });
    //  unknownRef (10-25 최종판 · P1-11): 사건 when·req.cond·swap.when · 단계 skipIf 의 inspect:/trace: 가 물건표에 없는 물건, talk:/alive: 가 인물표에 없는 사람,
    //              또는 trace:물건==값(!=값)의 값이 그 물건 states 에 없다 — 그 조건은 늘 같은 값이라 사건이 영영 안 걸리거나 늘 걸린다(이름 오타 하나로 원정 수납 사건이 조용히 사라진다)
    const condRefs = (src, at, w) => {
      if (typeof src !== 'string' || !src.trim()) return;
      let tree; try { tree = C.parse(src); } catch (e) { return; }   // 문법 오류는 위에서 오류로 보고됨
      const seen = new Set();
      const walk = (t) => {
        if (!t || typeof t !== 'object') return;
        if ((t.op === 'cmp' || t.op === 'truthy') && typeof t.name === 'string') {
          const p = C.prefixOf(t.name), id = t.name.slice(p.length + 1);
          const o = ctx.objects[id];
          let msg = '';
          if ((p === 'inspect' || p === 'trace') && !o) msg = `"${t.name}" — objects 표에 없는 물건`;
          else if ((p === 'talk' || p === 'alive') && !ctx.people[id]) msg = `"${t.name}" — people 표에 없는 사람`;
          else if (p === 'trace' && t.op === 'cmp' && (t.cmp === '==' || t.cmp === '!=') && typeof t.value === 'string' && Array.isArray(o.states) && !o.states.includes(t.value)) msg = `"${t.name}${t.cmp}${t.value}" — ${id} 의 states(${o.states.join('/')})에 없는 상태`;
          if (msg && !seen.has(msg)) { seen.add(msg); w(`${at}: ${msg}`); }
        }
        walk(t.a); walk(t.b);
      };
      walk(tree);
    };
    tables.events.forEach((ev, i) => {
      const w = (m) => warn('events', i, ev.id, 'unknownRef', m);
      condRefs(ev.when, 'when', w);
      (Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => {
        if (!isObj(c)) return;
        if (isObj(c.req)) condRefs(c.req.cond, `choices[${k}].req.cond`, w);
        swapsOf(c).forEach((sw, j) => { if (isObj(sw)) condRefs(sw.when, `choices[${k}].swap[${j}].when`, w); });
      });
    });
    tables.phases.forEach((p, i) => condRefs(p.skipIf, 'skipIf', (m) => warn('phases', i, p.id, 'unknownRef', m)));
    //  unplaced (10-25 · P1-11): 수납(holds)이 있는 물건, 또는 조사로 걸리는 원정 사건(kind trip · when 에 inspect:물건)이 가리키는 물건이 어느 지도(maps[].objects)에도 없다 — 걸어가 열 수 없다
    const placed = new Set();
    tables.maps.forEach((m) => (Array.isArray(m.objects) ? m.objects : []).forEach((ob) => { if (isObj(ob)) placed.add(ob.id); }));
    const tripGated = new Set();
    tables.events.forEach((ev) => { if (ev.kind !== 'trip' || typeof ev.when !== 'string') return; try { for (const n of C.names(C.parse(ev.when))) if (C.prefixOf(n) === 'inspect') tripGated.add(n.slice(8)); } catch (e) { /* 위에서 보고됨 */ } });
    tables.objects.forEach((o, i) => {
      const holds = isObj(o.holds) && Object.keys(o.holds).length > 0;   // 빈 {} 는 없는 것
      if (placed.has(o.id) || !(holds || tripGated.has(o.id))) return;
      warn('objects', i, o.id, 'unplaced', `${holds ? '수납 내용(holds)이 있는' : '조사로 걸리는 원정 사건이 가리키는'} 물건인데 어느 지도에도 없다 — 걸어가 열 수 없다 (maps[].objects 에 놓는다)`);
    });
    return done();
  }

  const API = { TABLES: T, IDENTITY_COLS, TABLE_NAMES, EFFECT_VERBS, PERMANENT, EVENT_TARGETS, MOST_TARGET, REQ_KEYS, SWAP_KEYS, WHO_WORDS, LEDGER_STATUS, validate, warnings, check, holdsOpenState, mergeSwap, swapsOf, variantsOf, usesTarget, needsTarget,
    ROPE_KINDS, ROPE_KEYS, ROPE_FAIL_KEYS, ROPE_HOW, ROPE_SKILL, ROPE_BLIND_FLAG, ROPE_BANDS, ROPE_DEFAULTS, ROPE_KNOB, ROPE_TAIL, ROPE_FAIL_TEXT,
    ropeKnob, ropeBand, ropeState, ropeCheck, applyRope, ropeWarn, ropeFail, ropeFormsOf, ropeLikeSwap, ropeBlindFlag, canLive, outKillsMe, mergeEffects, ownerOf: (tables, id) => ownerOf({ objects: Object.fromEntries((tables.objects || []).map((o) => [o.id, o])), people: Object.fromEntries((tables.people || []).map((p) => [p.id, p])) }, id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).schema = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
