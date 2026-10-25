// 최종 점검(내용) — 소문 줄의 안 만난 사람 이름 (2026-10-25 QA). 게임 파일은 읽기만 한다.
// node docs/foundation/final_2026-10-25/qa_content_rumor_sim.js [판 수/정책=40] > docs/foundation/final_2026-10-25/qa_content_rumor_sim.txt
// 소문 줄(rum_*)과 말 걸기 줄은 화면에서 가리지 않는다(game.js talkTo → UI.lines, maskPeople 없음).
// 봇 판을 돌리며 밤마다 새로 생긴 소문을 보고, 그 소문의 글(참/거짓 행)에 적힌 이름이 그때 '안 만난 사람'(E.known 거짓)이거나
// 아직 역에 안 온 사람(away)인지 센다. 같은 판에서 그 소문을 실제로 들을 수 있는 첫 때(다음 아침)도 적는다.
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const V4 = path.join(ROOT, 'v4');
const T = require(path.join(V4, 'engine', 'tables.js'));
const E = require(path.join(V4, 'engine', 'engine.js'));
const BOTS = require(path.join(V4, 'sim', 'bots.js'));
const db = T.loadDir(path.join(V4, 'data'));
const N = +(process.argv[2] || 40);
const PEOPLE = Object.values(db.people).filter((p) => p.id !== 'you');
const nameRe = (p) => { const given = p.name.length >= 3 ? p.name.slice(1) : p.name; return new RegExp(`(?<!(?:한|두|세|네|몇|여러|열|[0-9])\\s?)(?:${p.name}|${given})`); };
const orig = E.dispatch;
const found = {};   // key → { n, ex }
let games = 0, rumorsSeen = 0;
let cur = null;
E.dispatch = function (s, a, d) {
  const before = s.rumors ? s.rumors.length : 0;
  const r = orig.call(this, s, a, d);
  if (s.rumors && s.rumors.length > before) {
    for (const ru of s.rumors.slice(before)) {
      rumorsSeen++;
      const rows = db.lines[ru.line] || [];
      const row = rows.length ? rows[ru.truth ? 0 : Math.min(1, rows.length - 1)] : null;
      if (!row) continue;
      for (const p of PEOPLE) {
        if (!nameRe(p).test(row.text)) continue;
        const known = E.known(s, db, p.id);
        const st = s.people[p.id].status;
        if (known && st !== 'away') continue;
        const k = `${ru.line}#${ru.truth ? 0 : 1} → ${p.name}(${p.id}) ${known ? '' : '안 만남'}${st === 'away' ? ' 역에 없음(away)' : ''}`;
        const f = found[k] || (found[k] = { n: 0, days: {}, ex: null, text: row.text, event: ru.event });
        f.n++; f.days['D' + ru.day] = (f.days['D' + ru.day] || 0) + 1;
        if (!f.ex) f.ex = `${cur} 밤 사건 ${ru.event} · 목격자 ${ru.witness}`;
      }
    }
  }
  return r;
};
const pols = Object.keys(BOTS.POLICIES);
for (const pol of pols) for (let i = 0; i < N; i++) { cur = `${pol} 시드 ${1 + i}`; BOTS.play(db, 1 + i, pol); games++; }
const out = ['# 소문 줄의 안 만난 사람 이름 — 봇 판 실측 (qa_content_rumor_sim.js)', `정책 ${pols.length}개 × ${N}판 = ${games}판 · 생긴 소문 ${rumorsSeen}개`, ''];
const keys = Object.keys(found);
out.push(`## 소문이 생길 때 그 글의 이름이 안 만난 사람/역에 없는 사람: ${keys.length}종`);
for (const k of keys) { const f = found[k]; out.push(`- ${k} · ${f.n}번 (${Object.entries(f.days).map(([d, n]) => d + ' ' + n).join(', ')}) · 밤 사건 ${f.event} · 예: ${f.ex}\n    "${f.text}"`); }
console.log(out.join('\n'));
