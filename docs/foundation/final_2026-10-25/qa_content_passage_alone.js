// 최종 점검(내용) — passage_alone·passage_alone_b 의 '도현은 없다'가 도현을 만나지 않은 판에 뜨는가 (2026-10-25 QA, 읽기만)
// node docs/foundation/final_2026-10-25/qa_content_passage_alone.js > docs/foundation/final_2026-10-25/qa_content_passage_alone.txt
// 도현(dohyeon)은 people.metFlag 빈칸 · 생김새 줄(look_dohyeon) 없음 → game.js maskPeople 가 가리지 않는다(진짜 이름 그대로).
const path = require('path');
const V4 = path.resolve(__dirname, '..', '..', '..', 'v4');
const T = require(path.join(V4, 'engine', 'tables.js')), E = require(path.join(V4, 'engine', 'engine.js')), B = require(path.join(V4, 'sim', 'bots.js'));
const db = T.loadDir(path.join(V4, 'data'));
const orig = E.dispatch; const cnt = {}; let tot = 0, cur = '';
const ex = {};
E.dispatch = function (s, a, d) { const r = orig.call(this, s, a, d); if (s.pending && /^passage_alone/.test(s.pending.id) && s._qaSeen !== s.day) { s._qaSeen = s.day; const k = `${s.pending.id} · 도현 ${s.flags.met_dohyeon ? '만남' : '안 만남'}`; cnt[k] = (cnt[k] || 0) + 1; if (!ex[k]) ex[k] = cur + ' D' + s.day; } return r; };
const games = new Set();
for (const pol of Object.keys(B.POLICIES)) for (let i = 1; i <= 20; i++) { cur = `${pol} 시드 ${i}`; B.play(db, i, pol); tot++; }
console.log(`정책 ${Object.keys(B.POLICIES).length}개 × 20판 = ${tot}판`);
for (const [k, v] of Object.entries(cnt)) console.log(`- ${k}: ${v}번 (예: ${ex[k]})`);
console.log('글: ' + db.events.passage_alone.text + ' / ' + db.events.passage_alone_b.text);
console.log('when: ' + db.events.passage_alone.when);
