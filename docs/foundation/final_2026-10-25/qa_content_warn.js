// 최종 점검(내용) — 경고 글과 결과가 맞는가 (2026-10-25 QA, 읽기만). node docs/foundation/final_2026-10-25/qa_content_warn.js
// ① '끝이다'·'올라간다'처럼 죽음을 말하는 경고인데 어느 결과도 당신을 죽이지 않는 선택지(카르마 0·5·8·12·16, 눈먼 새벽 없음)
// ② 당신을 죽일 수 있는데 경고·힌트·금기가 없는 선택지
const path = require('path');
const V4 = path.resolve(__dirname, '..', '..', '..', 'v4');
const T = require(path.join(V4, 'engine', 'tables.js'));
const E = require(path.join(V4, 'engine', 'engine.js'));
const db = T.loadDir(path.join(V4, 'data'));
const DEATH = /끝이다|올라간다|죽는다|돌아오지 않는다|아침이 안 올/;
const a = new Set(), b = new Set();
const s0 = E.newGame(db, 1);
for (const ev of Object.values(db.events)) for (const k of [0, 5, 8, 12, 16]) {
  const s = JSON.parse(JSON.stringify(s0)); s.world.karma = k; s.world.food = 6; s.world.water = 6; s.world.meds = 1; s.pending = { id: ev.id, target: null };
  ev.choices.forEach((c0) => {
    const st = E.choiceState(s, db, ev, c0); const c = E.effChoice(s, db, c0); const p = E.survival(c, st.chance);
    const w = `${c.warn || ''} ${c.hint || ''}`.trim();
    if (DEATH.test(w) && p === 1) a.add(`${ev.id} '${c.label}' 경고 "${w}" — 어느 결과도 당신을 죽이지 않음`);
    if (p < 1 && !w && !c.taboo) b.add(`${ev.id} '${c.label}' (karma ${k}) 살 확률 ${Math.round(p * 100)}% — 경고 없음`);
  });
}
console.log(`① 죽음을 말하는 경고인데 죽지 않음: ${a.size}건\n` + [...a].map((x) => '- ' + x).join('\n'));
console.log(`② 죽을 수 있는데 경고 없음: ${b.size}건\n` + [...b].map((x) => '- ' + x).join('\n'));
