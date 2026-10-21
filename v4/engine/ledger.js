// 어두운 역 v4 — 명부. 결말 화면 = 당신 글씨의 명단 한 장. 사인 칸은 빈칸일 수 있다 (디렉터 R6).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const ID = isNode ? require('./identity.js') : root.DS4.identity;

  const BLANK = '___';
  const STATUS_KO = { boarded: '탔다', dead: '죽었다', ascended: '올라갔다', stayed: '남았다' };

  // 행: { line, id, name, status, day, cause(줄 글 또는 null), written[] }
  function rows(s, db) {
    const order = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you'));
    const out = [];
    let line = 0;
    for (const id of order) {
      const p = s.people[id];
      if (!p || p.status === 'outside') continue;
      const status = p.status === 'home' ? 'stayed' : p.status;
      const causeId = Object.prototype.hasOwnProperty.call(s.ledger.causes, id) ? s.ledger.causes[id] : null;
      out.push({ line: line++, id, name: p.name, status, day: p.day == null ? null : p.day, cause: causeId, written: s.ledger.written.filter((w) => w.who === id).map((w) => w.text) });
    }
    return out;
  }
  // 글로. "0 당신 — 남았다" / "3 박기철 — 죽었다 D8 ___"
  function format(s, db) {
    return rows(s, db).map((r) => {
      const bits = [String(r.line), r.name, '—', STATUS_KO[r.status] || r.status];
      if (r.status === 'dead' || r.status === 'ascended') { bits.push(r.day == null ? '' : 'D' + r.day); bits.push(r.cause == null ? BLANK : r.cause); }
      return bits.filter((b) => b !== '').join(' ');
    });
  }
  // 누가 읽나: 정체 결정표의 ledgerReader. 당신이 죽었거나 올라갔으면 수첩을 주운 주민.
  function reader(s, db) {
    const you = s.people.you;
    if (you.status === 'dead' || you.status === 'ascended') return 'resident';
    const c = ID.identity(s.axes, db.identity);
    return c ? c.ledgerReader : 'you';
  }

  const API = { rows, format, reader, BLANK };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).ledger = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
