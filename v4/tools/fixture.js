// 어두운 역 v4 — 캡처용 저장 만들기. 시뮬 봇(v4/sim/bots.js)을 정책 × 시드로 돌려, 그 사건이 걸린 순간의 상태를 저장 JSON 으로 뽑는다.
// 쓰기: node v4/tools/fixture.js d10_train            → 표준 출력에 {"d10_train": {...상태...}} (못 찾으면 그 id 는 빠진다)
//       node v4/tools/fixture.js d10_train,d10_walk 300 (정책마다 시드 1~300)
//       node v4/tools/fixture.js d10_train 200 240     (240초 = 찾을 만큼 찾았으면 거기서 멈춘다 · 기본 240, 0 = 끝까지)
// 시간 제한 (2026-10-24 검증 #8): 컴퓨터가 바쁘면 같은 일이 19분 걸려 shot.py·screen_check.py 의 시간 제한(600·900초)에 걸려 죽었다 →
//   제한 시간이 지나면 '모든 지점에 저장이 하나라도 있으면' 가장 나은 것으로 멈춘다. 하나도 못 찾은 지점이 있으면 제한의 세 배까지 더 찾고 멈춘다.
//   표준 오류에 한 줄 보고(판 수·걸린 초·멈춘 까닭).
// 화면은 ?auto=<지점>&state=<이 JSON 주소> 로 받아 그 상태에서 시작한다 (shot.py 가 메모리에서 /__fixture/<id>.json 으로 내준다 — 파일을 남기지 않는다).
// 표·엔진은 읽기만 한다. 데이터가 바뀌면 캡처할 때마다 새로 뽑으므로 저장이 낡지 않는다.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'engine', 'tables.js'));
const E = require(path.join(ROOT, 'engine', 'engine.js'));
const BOTS = require(path.join(ROOT, 'sim', 'bots.js'));

const want = String(process.argv[2] || 'd10_train').split(',').filter(Boolean);
const maxSeed = Math.max(1, Number(process.argv[3]) || 200);
const db = T.loadDir(path.join(ROOT, 'data'));
const pols = Object.keys(BOTS.POLICIES).sort((a, b) => (b === 'risky') - (a === 'risky'));   // 통로를 여는 판(열차 결말)은 모험 봇에서 잘 나온다
const got = {};
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  const r = orig.call(this, s, a, d);
  // 걸린 순간: 당신이 살아 있고, 열린 선택지가 많고(열차 결말이면 '탄다'가 잠기지 않게), 주민이 많이 남은 판을 고른다 (결말 캡처가 명부를 채우게)
  if (s.pending && want.includes(s.pending.id) && s.people.you.status === 'home') {
    const alive = Object.values(s.people).filter((p) => p.status === 'home' && p.id !== 'you').length;
    const v = E.eventView(s, d);
    const open = v ? v.choices.filter((c) => !c.locked).length : 0;
    const score = open * 10 + alive;
    const g = got[s.pending.id];
    if (!g || score > g.score) got[s.pending.id] = { alive, open, all: v ? v.choices.length : 0, score, state: JSON.parse(JSON.stringify(s)) };
  }
  return r;
};
const capSec = process.argv[4] != null && process.argv[4] !== '' ? Math.max(0, Number(process.argv[4]) || 0) : 240;
const t0 = Date.now();
let games = 0, why = 'all policies done';
outer: for (const pol of pols) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    try { BOTS.play(db, seed, pol); } catch (e) { /* 한 판이 깨져도 다음 판 */ }
    games++;
    if (want.every((w) => got[w] && got[w].alive >= 3 && got[w].open >= got[w].all - 1)) { why = 'good enough'; break outer; }   // 잠긴 선택지 하나까지는 괜찮다
    const sec = (Date.now() - t0) / 1000;
    if (capSec && sec > capSec && want.every((w) => got[w])) { why = `time cap ${capSec}s (best so far)`; break outer; }
    if (capSec && sec > capSec * 3) { why = `hard cap ${capSec * 3}s`; break outer; }
  }
}
E.dispatch = orig;
process.stderr.write(`[fixture] ${games} games, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${why}; found ${want.filter((w) => got[w]).join(',') || '-'}; missing ${want.filter((w) => !got[w]).join(',') || '-'}\n`);
const out = {};
for (const w of want) if (got[w]) { const s = got[w].state; s.pos = { map: 'station', x: db.maps.station.start[0], y: db.maps.station.start[1] }; out[w] = s; }
process.stdout.write(JSON.stringify(out));
