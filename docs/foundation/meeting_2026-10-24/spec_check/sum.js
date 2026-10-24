// check.js 출력 요약. node sum.js <출력.json> [블록별=1]
const fs = require('fs');
const f = process.argv[2];
const byBlock = process.argv[3] === '1';
const o = JSON.parse(fs.readFileSync(f, 'utf8'));
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '-');
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');
function line(pol, runs) {
  const n = runs.length, d = runs.filter((r) => r.dead);
  const cause = {}; for (const r of d) { const k = r.cause || r.why; cause[k] = (cause[k] || 0) + 1; }
  const top = Object.entries(cause).sort((a, b) => b[1] - a[1]);
  const h9 = runs.filter((r) => r.morning[9]).map((r) => r.morning[9].home);
  const g9 = runs.filter((r) => r.morning[9]).map((r) => r.morning[9].gone);
  const r7 = runs.filter((r) => r.morning[7]).map((r) => r.morning[7].food + r.morning[7].water + r.morning[7].meds);
  const byDay = {}; for (const r of d) byDay[r.day] = (byDay[r.day] || 0) + 1;
  return `${pol.padEnd(12)} n${n} surv ${pct(runs.filter((r) => r.survived).length, n)} dead ${pct(d.length, n)} | D1-4alive ${pct(runs.filter((r) => !r.dead || r.day > 4).length, n)} dead<=D5 ${pct(d.filter((r) => r.day <= 5).length, n)} | top ${top.slice(0, 3).map(([k, v]) => k + ' ' + pct(v, d.length)).join(', ')} | forced ${d.filter((r) => r.forced).length} unwarned ${d.filter((r) => !r.warned).length} | home9 ${avg(h9)} gone9 ${avg(g9)} resGoneEnd ${avg(runs.map((r) => r.resGone))} res7 ${avg(r7)} | karma ${avg(runs.map((r) => r.karma))} neglect ${avg(runs.map((r) => r.neglect))} youSlot ${avg(runs.map((r) => r.youSlot))} | byDay ${Object.keys(byDay).sort((a, b) => a - b).map((k) => k + ':' + byDay[k]).join(' ')}`;
}
for (const [pol, runs] of Object.entries(o.pols)) {
  console.log(line(pol, runs));
  if (byBlock) for (const b of o.seeds) console.log('   ' + line('  b' + b, runs.filter((r) => r.block === b)));
}
