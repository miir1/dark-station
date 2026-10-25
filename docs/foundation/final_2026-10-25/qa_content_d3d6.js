// 최종 점검(내용) — D3·D6 결정과 화면 글 (2026-10-25 QA). 게임 파일은 읽기만 한다.
// node docs/foundation/final_2026-10-25/qa_content_d3d6.js > docs/foundation/final_2026-10-25/qa_content_d3d6.txt
// 03 결정 10-24: D3 = 규칙을 배우는 날(신중하면 그날 안 죽음) · D6 = 값을 치르면 사는 날. 카르마 8 미만(신중한 판)에서
//   D3·D6 에 걸릴 수 있는 사건마다 '살 확률 100%(판정·줄타기 없음)' 인 열린 선택지가 하나라도 있는가, 그리고 그 판의 경고 글에 '끝이다'가 남아 있는가를 본다.
// 대상 사건 = when 의 day 조건이 그날을 허용하는 사건(조건식은 엔진 cond 로 day·karma 만 바꿔 평가하지 않고, day 비교만 읽는다).
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const V4 = path.join(ROOT, 'v4');
const T = require(path.join(V4, 'engine', 'tables.js'));
const E = require(path.join(V4, 'engine', 'engine.js'));
const db = T.loadDir(path.join(V4, 'data'));
const out = [];
const log = (...a) => out.push(a.join(' '));
function dayOk(when, d) {
  const re = /day\s*(==|>=|<=|>|<|!=)\s*(\d+)/g; let m; const conds = [];
  while ((m = re.exec(when))) conds.push([m[1], +m[2]]);
  if (!conds.length) return true;
  // or 로 묶인 day==3 | day==6 같은 꼴은 '어느 하나라도'
  const eqs = conds.filter((c) => c[0] === '==');
  if (eqs.length) { if (/!\s*\(\s*\(?\s*day\s*==/.test(when) && eqs.every((c) => new RegExp(`!\\s*\\(\\s*\\(?[^)]*day\\s*==\\s*${c[1]}`).test(when))) { /* 부정 안의 day== 는 허용 조건이 아님 */ } else return eqs.some((c) => c[1] === d) && conds.filter((c) => c[0] !== '==').every((c) => test(c, d)); }
  return conds.filter((c) => c[0] !== '==').every((c) => test(c, d));
}
function test([op, v], d) { return op === '>=' ? d >= v : op === '<=' ? d <= v : op === '>' ? d > v : op === '<' ? d < v : op === '!=' ? d !== v : d === v; }
for (const D of [3, 6]) {
  log(`## D${D} — 카르마 0~7 · 깃발 strike_blind 없음`);
  const s0 = E.newGame(db, 1);
  const bad = [], tailed = [];
  for (const ev of Object.values(db.events)) {
    if (!dayOk(ev.when || '', D)) continue;
    // 그날 이 사건을 막는 karma 조건(예: !((day==3|day==6) & karma<8)) 이면 건너뜀
    if (/!\s*\(\s*\(day\s*==\s*3\s*\|\s*day\s*==\s*6\)\s*&\s*karma<8\)/.test(ev.when) || (D === 3 && /!\s*\(day\s*==\s*3\s*&\s*karma<8\)/.test(ev.when))) continue;
    for (const k of [0, 4, 5, 7]) {
      const s = JSON.parse(JSON.stringify(s0));
      s.day = D; s.world.karma = k; s.world.food = 6; s.world.water = 6; s.world.meds = 1; s.world.fuel = 6; s.world.parts = 4;
      s.pending = { id: ev.id, target: null };
      const states = ev.choices.map((c) => E.choiceState(s, db, ev, c));
      const effs = ev.choices.map((c) => E.effChoice(s, db, c));
      const ps = effs.map((c, i) => E.survival(c, states[i].chance));
      const anyDeath = ps.some((p) => p < 1);
      if (!anyDeath) continue;
      (global.QA = global.QA || new Set()).add(D + ":" + ev.id);
      const safe = ps.some((p, i) => p === 1 && !states[i].locked);
      if (!safe) bad.push(`${ev.id} (karma ${k}) [${ev.when}] — 살 확률: ${ps.map((p, i) => `${effs[i].label} ${Math.round(p * 100)}%${states[i].locked ? '(잠김)' : ''}`).join(' · ')}`);
      effs.forEach((c, i) => { if (ps[i] === 1 && /끝이다/.test(c.warn || '')) tailed.push(`${ev.id} (karma ${k}) '${c.label}' — 살 확률 100% 인데 경고 "${c.warn}"`); });
    }
  }
  log(`- 살 확률 100% 인 열린 선택지가 없는 사건(그날·카르마 <8): ${bad.length}건`);
  for (const b of Array.from(new Set(bad))) log('  - ' + b);
  log(`- 살 확률 100% 인데 '끝이다' 경고가 붙은 선택지: ${new Set(tailed).size}건`);
  for (const t of Array.from(new Set(tailed))) log('  - ' + t);
  log('');
}
out.push("검사한 (죽음 길이 있는) 사건: " + Array.from(global.QA || []).join(", "));
console.log(out.join('\n'));
