const fs = require('fs');
const files = process.argv.slice(2);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '-');
const pub = new Set(['starve_resident','ascend','ascend_unseen','mari_pillow','eunji_goes_instead','grudge_strike_you','dongha_pipe_you','dongha_end_you','steal_you','mob_you','grudge_boils','dohyeon_valve']);
for (const f of files) {
  const out = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('## ' + f);
  for (const pol of Object.keys(out)) {
    const runs = out[pol]; const n = runs.length; const d = runs.filter((r) => r.youDead);
    const cause = {}; for (const r of d) cause[r.cause] = (cause[r.cause] || 0) + 1; const top = Object.entries(cause).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
    const d9 = runs.flatMap((r) => r.grudge.filter((x) => x.day === 9).map((x) => Object.keys(x.g).length)); const rs7 = runs.flatMap((r) => r.grudge.filter((x) => x.day === 7).map((x) => x.food + x.water + x.meds));
    let t = 0, fd = 0; for (const r of runs) for (const x of r.nightLog) { if (x.role === 'clock' || x.role === 'neglect') continue; t++; if (x.disc) fd++; }
    const days = runs.reduce((a, r) => a + (r.youDead ? Math.max(0, r.deathDay - 1) + 0.5 : 10), 0) / n;
    console.log(`${pol.padEnd(9)} surv ${pct(n - d.length, n)} | D1-4 alive ${pct(runs.filter((r) => !r.youDead || r.deathDay > 4).length, n)} | dead<=D5 ${pct(d.filter((r) => r.deathDay <= 5).length, n)} | days ${days.toFixed(2)} | top ${top[0]} ${pct(top[1], d.length)} | forced ${d.filter((r) => r.forced).length} unwarned ${d.filter((r) => !r.warned).length} | resD9 ${(d9.reduce((a, b) => a + b, 0) / (d9.length || 1)).toFixed(2)} | resrcD7 ${(rs7.reduce((a, b) => a + b, 0) / (rs7.length || 1)).toFixed(2)} | disc ${pct(fd, t)} | neglect ${(runs.reduce((a, r) => a + (r.neglect || 0), 0) / n).toFixed(2)} | karmaD10 ${(runs.reduce((a, r) => a + ((r.grudge[r.grudge.length - 1] || {}).karma || 0), 0) / n).toFixed(1)}`);
  }
}
