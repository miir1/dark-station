// 마지막 날 재고·정원 분포: node sim/ending_stats.js [판수]
const { play, POLICIES } = require('./bots.js');
const E = require('../engine.js');
const N = +(process.argv[2] || 200);
const avg = (a) => Math.round((10 * a.reduce((x, y) => x + y, 0)) / a.length) / 10;
for (const name of ['balanced', 'clinic', 'nofacility', 'rush', 'stay']) {
  const f = [], w = [], cap = [], pool = [], deaths = [], parts = [];
  for (let seed = 1; seed <= N; seed++) {
    const { s } = play(seed, name);
    if (!s.boarding) continue;
    f.push(s.res.food); w.push(s.res.water); parts.push(s.res.parts);
    cap.push(s.boarding.cap); pool.push(s.boarding.pool.length); deaths.push(s.stats.deaths);
  }
  const dist = {}; cap.forEach((c) => { dist[c] = (dist[c] || 0) + 1; });
  console.log(name.padEnd(11), `D10 식량 ${avg(f)} 물 ${avg(w)} 부품 ${avg(parts)} | 정원 평균 ${avg(cap)} (분포 ${Object.entries(dist).map(([k, v]) => k + ':' + v).join(' ')}) | 대상 ${avg(pool)}명 | 사망 ${avg(deaths)}`);
}
