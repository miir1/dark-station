// 정책별 밤 사건·방치 판정 줄 수와 당신 사인: node nights.js <정책> [판수=100]
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const B = require(path.join(R, 'sim', 'bots.js'));
const db = T.loadDir(process.env.DATA || path.join(R, 'data'));
const pol = process.argv[2] || 'lazy', n = +(process.argv[3] || 100);
const cnt = {}; const cause = {}; let dead = 0, home9 = 0, res7 = 0;
for (let seed = 1; seed <= n; seed++) {
  const { s } = B.play(db, seed, pol);
  for (const e of s.nightLog) cnt[e.id] = (cnt[e.id] || 0) + 1;
  if (s.people.you.status === 'dead' || s.people.you.status === 'ascended') { dead++; const c = s.ended && s.ended.cause ? s.ended.cause.event : '?'; cause[c] = (cause[c] || 0) + 1; }
}
console.log(`${pol} ${n}판 사망 ${dead}`, JSON.stringify(cause));
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(' · '));
