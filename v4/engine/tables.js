// 어두운 역 v4 — 표 로더. 아홉 장을 받아 검증하고, 엔진이 쓰기 좋은 꼴(id → 행)로 묶는다.
// 브라우저에서는 data/*.json 을 fetch 해서 load() 에 넘기고, Node 에서는 loadDir(폴더) 로 읽는다.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.DS4.schema;

  const FILES = { phases: 'phases.json', numbers: 'numbers.json', events: 'events.json', people: 'people.json', maps: 'maps.json',
    lines: 'lines.json', nightEvents: 'night_events.json', objects: 'objects.json', identity: 'identity.json' };
  const ALT_FILES = { nightEvents: 'nightEvents.json' };     // 같은 표의 다른 파일 이름도 받는다

  // ── 표를 정식 꼴로 정규화 (문서 31 §1 이 정식, 아래 변형도 받는다) ──
  //  · effects 배열 [{verb:'number', id, n, who}, {verb:'flag', id, set}, {verb:'trace', id, state}, {verb:'axis', id, n},
  //                 {verb:'injure', who, n}, {verb:'kill', who}, {verb:'permanent', who, loss|kind}]  → 객체 꼴
  //  · 선택지의 빈 check:null · cost:{} · req:{} · taboo:'' · warn:'' · ledger:'' 는 없는 것으로
  //  · identity 후보의 candidate 열 → id,  표 머리의 thresholds·note 는 메모로 두고 무시
  //  · nightEvents 의 target '' → '-',  rumor.line '' → 소문 없음
  //  · injure 의 n 은 ±1~3 (음수 = 부상 회복)
  //  · objects 의 holds(수납 내용, P1-11) 안 effects 도 같은 두 꼴을 받는다. holds 의 빈 text·state·effects 는 없는 것으로
  //  · 같은 수치 id · injure · kill · permanent 가 두 번 이상 나오면 값이 목록이 된다(순서 유지, 전부 적용) — 마지막 것만 남던 문제(10-22)
  //  · (10-24) nightEvents 의 missed·caught({effects, trace}) 안 effects 도 두 꼴 · public·side 빈 칸은 없는 것 · events 의 targetIf·targetOptional 빈 칸은 없는 것
  //    선택지 swap(객체 또는 목록) 안의 결과 effects 도 두 꼴 — swap 변형의 빈 값 칸은 '그 칸을 비운다'는 뜻이라 지우지 않는다
  //  · (10-24 A1·A4) who:'you' 는 {who:'you', n} 그대로 둔다 — 밤 사건·방치 판정(missed·caught)에서 맨숫자는 행위자(주민)의 것이라,
  //    '당신 +1' 이 행위자에게 가던 오류(share_bowl.caught)를 막는다. 선택 결과에서는 행위자가 당신이라 결과가 같다. who 없음·self = 맨숫자(행위자)
  function effectsToObject(arr, where) {
    if (!Array.isArray(arr)) return arr;
    const o = {};
    const setWho = (who, n) => (who && who !== 'self' ? { who, n } : n);
    const add = (key, val) => { if (!Object.prototype.hasOwnProperty.call(o, key)) o[key] = val; else if (Array.isArray(o[key])) o[key].push(val); else o[key] = [o[key], val]; };
    for (const e of arr) {
      if (!e || typeof e !== 'object') throw new TableError([{ text: `${where}: effects 배열 원소가 객체가 아님` }]);
      switch (e.verb) {
        case 'number': add(e.id, setWho(e.who, e.n)); break;
        case 'flag': (o.flag = o.flag || {})[e.id] = e.set === undefined ? true : !!e.set; break;
        case 'trace': (o.trace = o.trace || {})[e.id] = e.state; break;
        case 'axis': (o.axis = o.axis || {})[e.id] = (o.axis[e.id] || 0) + e.n; break;   // 같은 축 두 번 = 합
        case 'injure': add('injure', { who: e.who, n: e.n }); break;
        case 'kill': add('kill', { who: e.who, how: e.how }); break;
        case 'permanent': add('permanent', { who: e.who, kind: e.kind || e.loss }); break;
        default: throw new TableError([{ text: `${where}: 모르는 효과 동사 "${e.verb}"` }]);
      }
    }
    return o;
  }
  const blank = (v) => v == null || v === '' || v === '-' || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  // 선택지 한 개의 빈 칸 지우기 + 결과 effects 배열 → 객체.
  // variant = swap 변형: 적힌 칸은 빈 값이어도 '그 칸을 비운다'는 뜻이라 지우지 않는다(엔진 swapChoice 가 합친 뒤 빈 칸을 지운다). 결과 effects 만 바꾼다
  function normChoice(c, where, variant) {
    if (!variant) for (const key of ['check', 'cost', 'req', 'taboo', 'warn', 'hint']) if (blank(c[key])) delete c[key];
    for (const key of ['out', 'ok', 'fail']) { const o = c[key]; if (!o || typeof o !== 'object') continue; if (blank(o.ledger)) delete o.ledger; if (blank(o.image)) delete o.image; if (blank(o.target)) delete o.target; if (o.effects !== undefined) { if (blank(o.effects)) delete o.effects; else o.effects = effectsToObject(o.effects, `${where}.${key}`); } }
  }
  // 밤 사건의 방치 판정 칸 missed·caught = { effects, trace } (10-24 A4 E1) — effects 는 두 꼴, 빈 칸은 없는 것
  function normJudge(n, key, where) {
    const v = n[key];
    if (blank(v) || typeof v !== 'object' || Array.isArray(v)) { if (blank(v)) delete n[key]; return; }
    if (v.effects !== undefined) { if (blank(v.effects) || (Array.isArray(v.effects) && !v.effects.length)) delete v.effects; else v.effects = effectsToObject(v.effects, `${where}.${key}`); }
    if (blank(v.trace)) delete v.trace;
    if (blank(v)) delete n[key];
  }
  function normalizeTables(raw) {
    const t = JSON.parse(JSON.stringify(raw));
    if (Array.isArray(t.events)) t.events.forEach((ev) => { if (ev && typeof ev === 'object') for (const key of ['target', 'endStatus', 'board', 'targetIf', 'targetOptional']) if (blank(ev[key])) delete ev[key]; });
    if (Array.isArray(t.events)) t.events.forEach((ev, i) => (ev && Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => {
      if (!c || typeof c !== 'object') return;
      normChoice(c, `events[${i}] ${ev.id} choices[${k}]`);
      // (10-24 A1) swap = 조건이 맞을 때 바뀌는 선택지 — 객체 하나 또는 목록(앞에서부터 처음 맞는 것). 빈 칸은 없는 것
      if (blank(c.swap) || (Array.isArray(c.swap) && !c.swap.length)) delete c.swap;
      else (Array.isArray(c.swap) ? c.swap : [c.swap]).forEach((v, j) => { if (v && typeof v === 'object' && !Array.isArray(v)) normChoice(v, `events[${i}] ${ev.id} choices[${k}].swap[${j}]`, true); });
    }));
    // (P1-11 엔진 몫) 물건의 수납 내용 holds = { text, effects, state } — effects 는 사건 결과와 같은 두 꼴(배열이면 객체 꼴로). 빈 holds 는 없는 것
    if (Array.isArray(t.objects)) t.objects.forEach((o, i) => { if (!o || typeof o !== 'object') return; if (blank(o.holds)) { delete o.holds; return; } const h = o.holds; if (!h || typeof h !== 'object' || Array.isArray(h)) return; if (blank(h.text)) delete h.text; if (blank(h.state)) delete h.state; if (h.effects !== undefined) { if (blank(h.effects)) delete h.effects; else h.effects = effectsToObject(h.effects, `objects[${i}] ${o.id} holds`); } });
    if (Array.isArray(t.nightEvents)) t.nightEvents.forEach((n, i) => { if (!n || typeof n !== 'object') return; if (blank(n.target)) n.target = '-'; if (blank(n.actor)) n.actor = '-'; if (n.effects !== undefined) { if (blank(n.effects)) delete n.effects; else n.effects = effectsToObject(n.effects, `nightEvents[${i}] ${n.id}`); } if (blank(n.rumor) || blank(n.rumor.line)) delete n.rumor; if (blank(n.trace)) delete n.trace;
      for (const key of ['missed', 'caught']) normJudge(n, key, `nightEvents[${i}] ${n.id}`);
      for (const key of ['public', 'side']) if (blank(n[key])) delete n[key]; });
    if (Array.isArray(t.people)) t.people.forEach((p) => { if (p && typeof p === 'object' && p.addressCold === null) delete p.addressCold; });   // addressCold '' = 부르지 않는다(빈 글을 지우지 않는다)
    if (t.identity && typeof t.identity === 'object' && !Array.isArray(t.identity)) { const { axes, candidates } = t.identity; t.identity = { axes, candidates: Array.isArray(candidates) ? candidates.map((c) => { if (c && typeof c === 'object' && c.id === undefined && c.candidate !== undefined) { c = Object.assign({ id: c.candidate }, c); delete c.candidate; } return c; }) : candidates }; }
    return t;
  }

  class TableError extends Error {
    constructor(errors) { super(`표 검증 실패 ${errors.length}건:\n` + errors.map((e) => '  ' + e.text).join('\n')); this.errors = errors; }
  }

  // tables: { phases:[], numbers:[], events:[], people:[], maps:[], lines:[], nightEvents:[], objects:[], identity:{} }
  function load(tables) {
    tables = normalizeTables(tables);
    const { errors, warnings } = S.check(tables);
    if (errors.length) throw new TableError(errors);
    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const linesById = {};
    for (const l of tables.lines) (linesById[l.id] = linesById[l.id] || []).push(l);
    const db = {
      raw: tables,
      phases: tables.phases.slice().sort((a, b) => a.order - b.order),
      numbers: byId(tables.numbers), numbersList: tables.numbers,
      events: byId(tables.events), eventsList: tables.events,
      people: byId(tables.people), peopleOrder: tables.people.map((p) => p.id),
      maps: byId(tables.maps),
      lines: linesById,
      nightEvents: tables.nightEvents,
      objects: byId(tables.objects),
      identity: tables.identity,
      warnings,                                // (10-24 P0-E2) 읽히지만 고칠 것: [{table,row,id,kind,msg,text}] — firstDeath·reasonWord·owner
    };
    deepFreeze(db);
    return db;
  }
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; }

  // Node 전용: 폴더에서 아홉 장 읽기
  function loadDir(dir) {
    const fs = require('fs'), path = require('path');
    const tables = {};
    for (const [k, f] of Object.entries(FILES)) {
      let p = path.join(dir, f);
      if (!fs.existsSync(p) && ALT_FILES[k]) p = path.join(dir, ALT_FILES[k]);
      if (!fs.existsSync(p)) throw new TableError([{ table: k, row: -1, id: '', msg: '파일 없음', text: `${k}: ${p} 파일 없음` }]);
      try { tables[k] = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new TableError([{ table: k, row: -1, id: '', msg: e.message, text: `${k}: JSON 해석 실패 — ${e.message}` }]); }
    }
    return load(tables);
  }

  const validate = (tables) => { try { return S.validate(normalizeTables(tables)); } catch (e) { return e.errors || [{ text: e.message }]; } };
  // 경고만 (표는 읽히지만 고칠 것). 정규화가 실패하면 빈 목록 — 그때는 validate 가 오류를 말한다
  const warnings = (tables) => { try { return S.warnings(normalizeTables(tables)); } catch (e) { return []; } };
  const API = { FILES, ALT_FILES, load, loadDir: isNode ? loadDir : null, validate, warnings, normalizeTables, effectsToObject, TableError };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).tables = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
