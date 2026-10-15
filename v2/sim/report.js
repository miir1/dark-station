// node sim/report.js [판수=200] — 정책별 결말·사망·자원 곡선 요약
const { play, POLICIES } = require('./bots.js');
const N = +(process.argv[2] || 200);
const pct = (n) => Math.round((100 * n) / N) + '%';
const avg = (a) => (a.length ? Math.round((10 * a.reduce((x, y) => x + y, 0)) / a.length) / 10 : 0);

for (const name of Object.keys(POLICIES)) {
  const tiers = {}; const deaths = []; const flags = { pact: 0, secured: 0, eun: 0, doh: 0 }; const mins = []; const surplus = []; const exps = []; const nights = [];
  const curve = {};
  for (let seed = 1; seed <= N; seed++) {
    const { s, trace } = play(seed, name);
    const key = s.ending ? s.ending.tier : 'none';
    tiers[key] = (tiers[key] || 0) + 1;
    deaths.push(s.stats.deaths); exps.push(s.stats.expeditions);
    if (s.flags.hospital_pact) flags.pact++; if (s.flags.passage_secured) flags.secured++;
    mins.push(Math.min(trace.minFood, trace.minWater)); surplus.push(trace.surplusDays);
    for (const p of trace.series) { (curve[p.day] = curve[p.day] || []).push(p); }
  }
  console.log(`\n== ${name} (${N}판) ==`);
  console.log('결말', Object.entries(tiers).map(([k, v]) => `${k} ${pct(v)}`).join(' / '));
  console.log(`평균 사망 ${avg(deaths)} / 평균 원정 ${avg(exps)} / 협정 ${pct(flags.pact)} / 통로 확보 ${pct(flags.secured)} / 식량·물 최저 평균 ${avg(mins)} / 여유일(잉여) 평균 ${avg(surplus)}일`);
  const days = [1, 3, 5, 7, 9];
  console.log('일차별 평균(식/물/부품/약/침수/노출/스트레스/생존):');
  for (const d of days) { const c = curve[d] || []; if (!c.length) continue; const f = (k) => avg(c.map((x) => x[k])); console.log(`  D${d}: ${f('food')}/${f('water')}/${f('parts')}/${f('meds')}/${f('flood')}/${f('exposure')}/${f('stress')}/${f('alive')}`); }
}
