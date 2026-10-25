// read-only probe: node probe_deaths.js <policy> [blocks]
// tallies you-death (event · choice · roped · day) and survival per block — same play() as run.js
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const pol = process.argv[2] || 'risky';
const blocks = (process.argv[3] || '1,1001,2001,3001,8001').split(',').map(Number);
const N = 200;
const tally = {}; const perBlock = []; let surv = 0, tot = 0;
const dayTally = {};
const ropeChances = [];
for (const b0 of blocks) {
  let sb = 0;
  for (let seed = b0; seed < b0 + N; seed++) {
    const { s } = play(db, seed, pol);
    tot++;
    const you = s.people.you;
    const alive = you.status !== 'dead' && you.status !== 'ascended';
    if (alive) { surv++; sb++; continue; }
    const c = s.ended && s.ended.cause;
    const r = s.lastResult || {};
    const key = c ? `${c.event} | ${c.choice} | roped=${c.roped ? 1 : 0} | chance=${r.roll && r.roll.chance != null ? r.roll.chance : (r.roll ? JSON.stringify(r.roll).slice(0, 40) : '-')}` : 'nocause';
    tally[key] = (tally[key] || 0) + 1;
    const d = you.day != null ? you.day : s.day;
    dayTally[d] = (dayTally[d] || 0) + 1;
  }
  perBlock.push(`${b0}: ${(sb / N * 100).toFixed(1)}%`);
}
console.log(`${pol}: survival ${(surv / tot * 100).toFixed(1)}% (${surv}/${tot}) · blocks ${perBlock.join(' / ')}`);
console.log('death day:', JSON.stringify(dayTally));
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(String(v).padStart(4), k);
