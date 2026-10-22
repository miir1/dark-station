// 어두운 역 v4 — 명부. 결말 화면 = 당신 글씨의 명단 한 장. 사인 칸은 빈칸일 수 있다 (디렉터 R6).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const ID = isNode ? require('./identity.js') : root.DS4.identity;

  const BLANK = '___';
  const STATUS_KO = { boarded: '탔다', dead: '죽었다', ascended: '올라갔다', stayed: '남았다', walked: '걸어 나갔다' };
  const ALIVE = ['home', 'stayed', 'walked'];          // 수첩을 주울 수 있는 산 사람 (탄 사람은 그다음)

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
      if (r.status === 'dead' || r.status === 'ascended' || (r.status === 'stayed' && r.day != null)) { bits.push(r.day == null ? '' : 'D' + r.day); if (r.status !== 'stayed') bits.push(r.cause == null ? BLANK : r.cause); }
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
  // 읽는 사람 id: 'you' · 'conductor' · 주민 id · null(읽을 주민이 없다).
  // 주민 = 살아 있는 주민 중 나이(people.age)가 가장 많은 사람 — 역에 남은 사람 먼저, 없으면 탄 사람. 같은 나이면 인물표 순서.
  function readerId(s, db) {
    const r = reader(s, db);
    if (r !== 'resident') return r;
    const res = db.peopleOrder.filter((id) => id !== 'you' && db.people[id] && !db.people[id].outside && s.people[id]);
    const byAge = (ids) => ids.slice().sort((a, b) => (Number(db.people[b].age) || 0) - (Number(db.people[a].age) || 0));
    const here = byAge(res.filter((id) => ALIVE.includes(s.people[id].status)));
    if (here.length) return here[0];
    const gone = byAge(res.filter((id) => s.people[id].status === 'boarded'));
    return gone[0] || null;
  }

  const API = { rows, format, reader, readerId, BLANK, STATUS_KO };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).ledger = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
