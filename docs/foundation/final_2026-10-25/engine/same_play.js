// 엔진 담당 10-25 최종판 — 고치기 전(커밋 HEAD)·후 엔진이 같은 표에서 봇 판을 똑같이 두는지 본다.
// node same_play.js <전 v4 폴더> <후 v4 폴더> [판수=30] — 두 폴더에 같은 data 사본을 둔다. 끝 상태 JSON 을 비교하되 새 집계 칸 stats.holds 는 뺀다.
// 지금 표에는 holds·inspect: 원정 사건이 없어서(데이터 담당이 동시에 넣는 중) 판이 같아야 한다.
const path = require('path');
const [rootA, rootB] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const N = +(process.argv[4] || 30);
function load(root) {
  const T = require(path.join(root, 'engine', 'tables.js'));
  const B = require(path.join(root, 'sim', 'bots.js'));
  return { db: T.loadDir(path.join(root, 'data')), B };
}
const a = load(rootA), b = load(rootB);
const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); if (c.stats) delete c.stats.holds; return JSON.stringify(c); };
let same = 0, diff = 0; const bad = [];
for (const pol of Object.keys(b.B.POLICIES)) {
  for (let seed = 1; seed <= N; seed++) {
    const x = a.B.play(a.db, seed, pol), y = b.B.play(b.db, seed, pol);
    if (strip(x.s) === strip(y.s) && JSON.stringify(x.trace) === JSON.stringify(y.trace)) same++; else { diff++; if (bad.length < 10) bad.push(`${pol}#${seed}`); }
  }
}
console.log(`정책 ${Object.keys(b.B.POLICIES).length} × ${N}판: 같음 ${same} · 다름 ${diff}${bad.length ? ' — ' + bad.join(', ') : ''}`);
process.exit(diff ? 1 : 0);
