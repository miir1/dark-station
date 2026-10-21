// 어두운 역 v4 — 표 아홉 장의 스키마(칸 이름 약속)와 검증. docs/foundation/31_tables_schema.md §1 그대로.
// 위반은 "표[행번호] id.열: 이유" 꼴의 오류 목록으로 돌려준다. 코드는 여기 적힌 열 이름만 안다.
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cond.js') : root.DS4.cond;

  const ID = /^[a-z0-9_]{1,24}$/;
  const EFFECT_VERBS = ['flag', 'trace', 'axis', 'injure', 'kill', 'permanent'];   // 그 밖의 키는 numbers id 여야 한다
  const PERMANENT = ['finger', 'leg', 'ear'];
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
    } },
    people: { key: 'id', cols: {
      id: { type: 'id', req: true }, name: { type: 'str', req: true }, age: { type: 'any' }, bio: { type: 'str' },
      skills: { type: 'obj', req: true }, needs: { type: 'obj' }, secretFlag: { type: 'str' }, malice: { type: 'any' }, hymn: { type: 'any' },
      callsGod: { type: 'str', maxLen: 6 }, addressYou: { type: 'obj' }, outside: { type: 'bool01' },
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
      id: { type: 'id', req: true }, role: { type: 'str', req: true }, actor: { type: 'str', req: true }, target: { type: 'str' },
      cond: { type: 'cond' }, weight: { type: 'int', req: true, min: 1, max: 10 }, kind: { type: 'enum', req: true, enum: ['malice', 'hymn', 'neutral'] },
      trace: { type: 'obj' }, rumor: { type: 'obj' }, effects: { type: 'obj' }, oncePerRun: { type: 'bool01' }, text: { type: 'str' },
    } },
    objects: { key: 'id', cols: {
      id: { type: 'id', req: true }, name: { type: 'str', req: true }, states: { type: 'list', req: true, minLen: 1, maxLen: 4, ofId: true },
      overlay: { type: 'obj' }, inspectLine: { type: 'obj' }, ledgerFact: { type: 'obj' }, solid: { type: 'bool01' }, light: { type: 'int', min: 0, max: 6 },
      resetOn: { type: 'enum', enum: ['never', 'inspect', 'morning'] }, map: { type: 'str' },
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
      else if (k === 'injure') { if (!isObj(v) || !isInt(v.n) || v.n < 1 || v.n > 3) err('effects.injure: {who, n:1~3}'); }
      else if (k === 'kill') { if (!isObj(v) || typeof v.who !== 'string') err('effects.kill: {who}'); }
      else if (k === 'permanent') { if (!isObj(v) || !PERMANENT.includes(v.kind)) err(`effects.permanent.kind: ${PERMANENT.join('/')} 중 하나`); }
      else { const n = ctx.numbers[k]; if (!n) err(`effects.${k}: numbers 표에 없는 수치 (동사는 ${EFFECT_VERBS.join('/')}뿐)`); else if (!(isInt(v) || (isObj(v) && isInt(v.n)))) err(`effects.${k}: ±정수 또는 {who, n}`); }
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

  function validate(tables) {
    const errors = [];
    const push = (table, i, id, msg) => errors.push({ table, row: i, id, msg, text: `${table}[${i}]${id ? ' ' + id : ''}: ${msg}` });
    if (!isObj(tables)) return [{ text: '표 묶음이 객체가 아님' }];
    for (const name of TABLE_NAMES) if (tables[name] === undefined) push(name, -1, '', '표가 없음');
    if (errors.length) return errors;

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
    if (errors.length) return errors;

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
        for (const o of [c.out, c.ok, c.fail].filter(Boolean)) { if (o.effects) checkEffects(o.effects, ctx, (m) => e2(m)); if (o.text != null && typeof o.text !== 'string') e2('결과 text는 글'); }
        if (c.req && isObj(c.req)) { if (c.req.flag && !ID.test(c.req.flag)) e2('req.flag id 꼴 아님'); if (c.req.permanent && !PERMANENT.includes(c.req.permanent)) e2('req.permanent 종류'); }
        if (c.cost && isObj(c.cost)) for (const k of Object.keys(c.cost)) if (!ctx.numbers[k]) e2(`cost.${k}: numbers에 없음`);
      });
      if (!free) err('항상 고를 수 있는 선택지(cost·req 없음)가 하나도 없음 — 막다른 길');
      if (ev.image && ev.image !== '-' && typeof ev.image !== 'string') err('image는 그림 id 글');
    });
    tables.people.forEach((p, i) => {
      const err = (m) => push('people', i, p.id, m);
      for (const k of ['obs', 'str', 'tech', 'talk']) { const v = p.skills[k]; if (!isInt(v) || v < 0 || v > 3) err(`skills.${k}: 0~3 정수`); }
      if (p.needs) { for (const k of ['hunger', 'thirst', 'fear']) { const v = p.needs[k]; if (v !== undefined && (!isInt(v) || v < 0 || v > 10)) err(`needs.${k}: 0~10`); } if (p.needs.bond && p.needs.bond !== '-' && !ctx.people[p.needs.bond]) err(`needs.bond: 없는 사람 "${p.needs.bond}"`); }
      if (p.addressYou) for (const cid of Object.keys(p.addressYou)) if (!idn.candidates.some((c) => c.id === cid)) err(`addressYou.${cid}: identity에 없는 후보`);
    });
    tables.nightEvents.forEach((n, i) => {
      const err = (m) => push('nightEvents', i, n.id, m);
      for (const col of ['cond', 'actor', 'target']) {
        const v = n[col]; if (typeof v !== 'string' || v === '-' || ctx.people[v] || v === 'bond' || v === 'any') continue;
        try { for (const nm of C.names(C.parse(v))) if (FORBIDDEN_NIGHT_NAMES.test(nm)) err(`${col}: "${nm}" — 밤 사건 조건에 당신 위치·선택은 쓸 수 없음`); } catch (e) { err(`${col}: ${e.message}`); }
      }
      if (ctx.people[n.actor] === undefined && n.actor !== 'any') { try { C.parse(n.actor); } catch (e) { err(`actor: 사람 id 또는 조건식이어야 함 ("${n.actor}")`); } }
      if (n.actor === 'you') err('actor: 당신은 밤 사건의 행위자가 될 수 없음');
      if (n.trace) for (const [o, st] of Object.entries(n.trace)) checkTrace(o, st, ctx, (m) => err('trace.' + m));
      if (n.rumor) { if (!isObj(n.rumor) || typeof n.rumor.line !== 'string') err('rumor: {witness, line}'); else if (!ctx.lines[n.rumor.line]) err(`rumor.line: lines에 없음 "${n.rumor.line}"`); }
      if (n.effects) checkEffects(n.effects, ctx, err);
    });
    tables.objects.forEach((o, i) => {
      const err = (m) => push('objects', i, o.id, m);
      for (const col of ['overlay', 'inspectLine', 'ledgerFact']) if (o[col]) for (const st of Object.keys(o[col])) if (!o.states.includes(st)) err(`${col}.${st}: states에 없는 상태`);
      if (o.inspectLine) for (const l of Object.values(o.inspectLine)) if (!ctx.lines[l]) err(`inspectLine: lines에 없음 "${l}"`);
      if (o.map && !ctx.maps[o.map]) err(`map: maps에 없음 "${o.map}"`);
    });
    tables.maps.forEach((m, i) => {
      const err = (x) => push('maps', i, m.id, x);
      const w = m.rows[0] ? m.rows[0].length : 0;
      m.rows.forEach((r, k) => { if (typeof r !== 'string' || r.length !== w) err(`rows[${k}]: 길이가 첫 줄(${w})과 다름`); });
      if (m.objects) m.objects.forEach((ob, k) => { if (!isObj(ob) || !ctx.objects[ob.id]) err(`objects[${k}]: objects 표에 없는 물건`); });
    });
    idn.candidates.forEach((c, i) => { if (c.reveal) c.reveal.forEach((l) => { if (!ctx.lines[l]) push('identity', i, c.id, `reveal: lines에 없음 "${l}"`); }); });
    tables.phases.forEach((p, i) => { if (p.skipIf) { try { C.parse(p.skipIf); } catch (e) { push('phases', i, p.id, 'skipIf: ' + e.message); } } });
    void phaseIds;
    return errors;
  }

  const API = { TABLES: T, IDENTITY_COLS, TABLE_NAMES, EFFECT_VERBS, PERMANENT, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).schema = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
