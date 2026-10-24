// 어두운 역 v4 — 표 아홉 장의 스키마(칸 이름 약속)와 검증. docs/foundation/31_tables_schema.md §1 그대로.
// 위반은 "표[행번호] id.열: 이유" 꼴의 오류 목록으로 돌려준다. 코드는 여기 적힌 열 이름만 안다.
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cond.js') : root.DS4.cond;

  const ID = /^[a-z0-9_]{1,24}$/;
  const EFFECT_VERBS = ['flag', 'trace', 'axis', 'injure', 'kill', 'permanent'];   // 그 밖의 키는 numbers id 여야 한다
  const PERMANENT = ['finger', 'leg', 'ear'];
  const EVENT_TARGETS = ['any', 'randomSleeper', 'nearestSleeper', 'farthestSleeper', 'mostInjured', 'bond'];   // 사건 대상 낱말 (자리 정보가 없어 앞의 넷은 무작위, bond = 당신의 bond)
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
      target: { type: 'str' },                                // 사건의 대상(사람 id 또는 any·randomSleeper·mostInjured 등). 걸릴 때 정해지고, 결과의 who:'target' 이 된다
      board: { type: 'bool01' },                              // kind ending 전용: 1 = 이 결말이 걸려 있는 동안 board 동작으로 태울 사람을 고른다
      endStatus: { type: 'enum', enum: ['stayed', 'walked'] }, // kind ending 전용: 결말 뒤 역에 남은 산 사람의 명부 status (기본 stayed)
    } },
    people: { key: 'id', cols: {
      id: { type: 'id', req: true }, name: { type: 'str', req: true }, age: { type: 'any' }, bio: { type: 'str' },
      skills: { type: 'obj', req: true }, needs: { type: 'obj' }, secretFlag: { type: 'str' }, malice: { type: 'any' }, hymn: { type: 'any' },
      callsGod: { type: 'str', maxLen: 6 }, addressYou: { type: 'obj' }, outside: { type: 'bool01' },
      metFlag: { type: 'id' },        // 만남 깃발(id 꼴 또는 빈칸). 비었으면 처음부터 아는 사람. 있으면 그 깃발이 서기 전까지 '안 만난 사람'(배식·무작위 대상·명부에서 빠진다)
      startAway: { type: 'bool01' },  // 1 = 처음엔 역 밖(status away). metFlag 깃발이 서면 역에 온다(home). 밤 사건·배식·새 날 수치에서 빠진다
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
      trace: { type: 'obj' }, rumor: { type: 'obj' }, effects: { type: 'obj' }, oncePerRun: { type: 'bool01' }, text: { type: 'str' }, missed: { type: 'obj' }, caught: { type: 'obj' }, public: { type: 'bool01' },
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

  // 검사 = { errors, warnings }. errors 가 하나라도 있으면 표를 읽지 않는다(load 가 던진다). warnings 는 읽되 알린다.
  //   warnings[].kind: firstDeath(1번 자리 죽음) · reasonWord(이유 낱말) · owner(주인 없는 물건이 남의 머리맡 묶음에) · holdsRefill(다시 차는 수납, P1-11)
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
    tables.events.forEach((ev, i) => {
      const err = (m) => push('events', i, ev.id, m);
      let free = 0;
      ev.choices.forEach((c, k) => {
        const e2 = (m) => err(`choices[${k}]: ${m}`);
        if (!isObj(c)) { e2('선택지가 객체가 아님'); return; }
        if (typeof c.label !== 'string' || !c.label) e2('label 필요');
        else if (Array.from(c.label).length > 18) e2(`label 18자 초과 ("${c.label}")`);
        if (!c.cost && !c.req) free++;
        if (c.check) {
          if (!isObj(c.check) || !['obs', 'str', 'tech', 'talk'].includes(c.check.skill) || !isInt(c.check.base) || c.check.base < 0 || c.check.base > 100) e2('check: {skill: obs/str/tech/talk, base: 0~100}');
          if (!isObj(c.ok) || !isObj(c.fail)) e2('check가 있으면 ok·fail 둘 다 필요');
        } else if (!isObj(c.out)) e2('out 필요');
        for (const o of [c.out, c.ok, c.fail].filter(Boolean)) {
          if (o.effects) checkEffects(o.effects, ctx, (m) => e2(m)); if (o.text != null && typeof o.text !== 'string') e2('결과 text는 글');
          if (o.image != null && typeof o.image !== 'string') e2('결과 image는 그림 id 글');
          if (o.ledger != null) checkLedger(o.ledger, ctx, (m) => e2(m));
          if (o.target != null && !(typeof o.target === 'string' && (ctx.people[o.target] || EVENT_TARGETS.includes(o.target)))) e2(`target: 사람 id 또는 ${EVENT_TARGETS.join('·')} ("${o.target}")`);
        }
        if (c.req && isObj(c.req)) { if (c.req.flag && !ID.test(c.req.flag)) e2('req.flag id 꼴 아님'); if (c.req.permanent && !PERMANENT.includes(c.req.permanent)) e2('req.permanent 종류'); }
        if (c.cost && isObj(c.cost)) for (const k of Object.keys(c.cost)) if (!ctx.numbers[k]) e2(`cost.${k}: numbers에 없음`);
      });
      if (!free) err('항상 고를 수 있는 선택지(cost·req 없음)가 하나도 없음 — 막다른 길');
      if (ev.target != null && !(typeof ev.target === 'string' && (ctx.people[ev.target] || EVENT_TARGETS.includes(ev.target)))) err(`target: 사람 id 또는 ${EVENT_TARGETS.join('·')} ("${ev.target}")`);
      if ((ev.board || ev.endStatus) && ev.kind !== 'ending') err('board·endStatus 는 kind ending 사건에만');
      if (ev.image && ev.image !== '-' && typeof ev.image !== 'string') err('image는 그림 id 글');
    });
    // 사건·밤 사건 결과가 세우는 깃발 전부 (metFlag 가 영영 안 서는 오타를 잡는다)
    const setFlags = new Set();
    const addFlags = (eff) => { if (isObj(eff) && isObj(eff.flag)) for (const [f, on] of Object.entries(eff.flag)) if (on) setFlags.add(f); };
    tables.events.forEach((ev) => (Array.isArray(ev.choices) ? ev.choices : []).forEach((c) => { if (isObj(c)) for (const o of [c.out, c.ok, c.fail]) if (isObj(o)) addFlags(o.effects); }));
    tables.nightEvents.forEach((n) => addFlags(n.effects));
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
    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices) || ev.choices.length < 2 || !isObj(ev.choices[0])) return;
      const c0 = ev.choices[0], k0 = killWhos(c0);
      const why = c0.taboo ? `금기("${c0.taboo}")가 있다`
        : k0.some((w) => ME_WHO.includes(w)) ? '당신이 죽을 수 있다'
          : k0.length && ev.choices.slice(1).some((c) => isObj(c) && !killWhos(c).length) ? `${k0.join('·')} 이(가) 죽을 수 있는데 아무도 안 죽는 선택지가 뒤에 있다` : '';
      if (why) warn('events', i, ev.id, 'firstDeath', `choices[0] "${c0.label}": 1번 자리에 ${why} — 죽는 선택·금기는 1번에 두지 않는다`);
    });
    //  reasonWord: 화면 글에 '때문에·왜냐하면' (문장 규칙 — 이유는 말하지 않는다)
    const reason = (table, i, id, col, v) => { if (typeof v === 'string' && REASON_WORDS.test(v)) warn(table, i, id, 'reasonWord', `${col}: '${REASON_WORDS.exec(v)[0]}' — 이유를 대는 낱말은 쓰지 않는다 ("${v.slice(0, 30)}…")`); };
    tables.events.forEach((ev, i) => {
      reason('events', i, ev.id, 'text', ev.text);
      (Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => { if (!isObj(c)) return; for (const col of ['label', 'warn', 'hint']) reason('events', i, ev.id, `choices[${k}].${col}`, c[col]); for (const r of ['out', 'ok', 'fail']) if (isObj(c[r])) reason('events', i, ev.id, `choices[${k}].${r}.text`, c[r].text); });
    });
    tables.lines.forEach((l, i) => reason('lines', i, l.id, 'text', l.text));
    tables.nightEvents.forEach((n, i) => reason('nightEvents', i, n.id, 'text', n.text));
    //  holdsRefill (P1-11): 수납 내용이 있는 물건이 resetOn morning·inspect — 첫 상태(닫힘)로 돌아가 매번 다시 찬다(위험 없는 샘, 10-21 '생존은 위험 대 보상')
    tables.objects.forEach((o, i) => {
      if (!isObj(o.holds)) return;
      reason('objects', i, o.id, 'holds.text', o.holds.text);
      if (o.resetOn === 'morning' || o.resetOn === 'inspect') warn('objects', i, o.id, 'holdsRefill', `resetOn "${o.resetOn}": 연 수납이 닫힌 상태로 돌아가 다시 찬다 — 위험 없이 매일 얻는 샘이 된다. 한 번 연 것은 열린 채 두려면 never`);
    });
    return done();
  }

  const API = { TABLES: T, IDENTITY_COLS, TABLE_NAMES, EFFECT_VERBS, PERMANENT, EVENT_TARGETS, WHO_WORDS, LEDGER_STATUS, validate, warnings, check, holdsOpenState, ownerOf: (tables, id) => ownerOf({ objects: Object.fromEntries((tables.objects || []).map((o) => [o.id, o])), people: Object.fromEntries((tables.people || []).map((p) => [p.id, p])) }, id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).schema = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
