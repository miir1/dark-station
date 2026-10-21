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
  //  · nightEvents 의 target '' → '-'
  function effectsToObject(arr, where) {
    if (!Array.isArray(arr)) return arr;
    const o = {};
    const setWho = (who, n) => (who && who !== 'you' && who !== 'self' ? { who, n } : n);
    for (const e of arr) {
      if (!e || typeof e !== 'object') throw new TableError([{ text: `${where}: effects 배열 원소가 객체가 아님` }]);
      switch (e.verb) {
        case 'number': o[e.id] = setWho(e.who, e.n); break;
        case 'flag': (o.flag = o.flag || {})[e.id] = e.set === undefined ? true : !!e.set; break;
        case 'trace': (o.trace = o.trace || {})[e.id] = e.state; break;
        case 'axis': (o.axis = o.axis || {})[e.id] = e.n; break;
        case 'injure': o.injure = { who: e.who, n: e.n }; break;
        case 'kill': o.kill = { who: e.who, how: e.how }; break;
        case 'permanent': o.permanent = { who: e.who, kind: e.kind || e.loss }; break;
        default: throw new TableError([{ text: `${where}: 모르는 효과 동사 "${e.verb}"` }]);
      }
    }
    return o;
  }
  const blank = (v) => v == null || v === '' || v === '-' || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  function normalizeTables(raw) {
    const t = JSON.parse(JSON.stringify(raw));
    if (Array.isArray(t.events)) t.events.forEach((ev, i) => (ev && Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => {
      if (!c || typeof c !== 'object') return;
      for (const key of ['check', 'cost', 'req', 'taboo', 'warn', 'hint']) if (blank(c[key])) delete c[key];
      for (const key of ['out', 'ok', 'fail']) { const o = c[key]; if (!o || typeof o !== 'object') continue; if (blank(o.ledger)) delete o.ledger; if (o.effects !== undefined) { if (blank(o.effects)) delete o.effects; else o.effects = effectsToObject(o.effects, `events[${i}] ${ev.id} choices[${k}].${key}`); } }
    }));
    if (Array.isArray(t.nightEvents)) t.nightEvents.forEach((n, i) => { if (!n || typeof n !== 'object') return; if (blank(n.target)) n.target = '-'; if (n.effects !== undefined) { if (blank(n.effects)) delete n.effects; else n.effects = effectsToObject(n.effects, `nightEvents[${i}] ${n.id}`); } if (blank(n.rumor)) delete n.rumor; if (blank(n.trace)) delete n.trace; });
    if (t.identity && typeof t.identity === 'object' && !Array.isArray(t.identity)) { const { axes, candidates } = t.identity; t.identity = { axes, candidates: Array.isArray(candidates) ? candidates.map((c) => { if (c && typeof c === 'object' && c.id === undefined && c.candidate !== undefined) { c = Object.assign({ id: c.candidate }, c); delete c.candidate; } return c; }) : candidates }; }
    return t;
  }

  class TableError extends Error {
    constructor(errors) { super(`표 검증 실패 ${errors.length}건:\n` + errors.map((e) => '  ' + e.text).join('\n')); this.errors = errors; }
  }

  // tables: { phases:[], numbers:[], events:[], people:[], maps:[], lines:[], nightEvents:[], objects:[], identity:{} }
  function load(tables) {
    tables = normalizeTables(tables);
    const errors = S.validate(tables);
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
  const API = { FILES, ALT_FILES, load, loadDir: isNode ? loadDir : null, validate, normalizeTables, effectsToObject, TableError };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).tables = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
