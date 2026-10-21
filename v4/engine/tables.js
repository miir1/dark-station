// 어두운 역 v4 — 표 로더. 아홉 장을 받아 검증하고, 엔진이 쓰기 좋은 꼴(id → 행)로 묶는다.
// 브라우저에서는 data/*.json 을 fetch 해서 load() 에 넘기고, Node 에서는 loadDir(폴더) 로 읽는다.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.DS4.schema;

  const FILES = { phases: 'phases.json', numbers: 'numbers.json', events: 'events.json', people: 'people.json', maps: 'maps.json',
    lines: 'lines.json', nightEvents: 'night_events.json', objects: 'objects.json', identity: 'identity.json' };

  class TableError extends Error {
    constructor(errors) { super(`표 검증 실패 ${errors.length}건:\n` + errors.map((e) => '  ' + e.text).join('\n')); this.errors = errors; }
  }

  // tables: { phases:[], numbers:[], events:[], people:[], maps:[], lines:[], nightEvents:[], objects:[], identity:{} }
  function load(tables) {
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
      const p = path.join(dir, f);
      if (!fs.existsSync(p)) throw new TableError([{ table: k, row: -1, id: '', msg: '파일 없음', text: `${k}: ${p} 파일 없음` }]);
      try { tables[k] = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new TableError([{ table: k, row: -1, id: '', msg: e.message, text: `${k}: JSON 해석 실패 — ${e.message}` }]); }
    }
    return load(tables);
  }

  const API = { FILES, load, loadDir: isNode ? loadDir : null, validate: S.validate, TableError };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).tables = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
