// 위협·부상·약속 흐름 상세 측정: node sim/probe.js [정책] [판수]
const { play } = require('./bots.js');
const E = require('../engine.js');
const pol = process.argv[2] || 'balanced'; const N = +(process.argv[3] || 300);
let injEvents = 0, maxInj = [0, 0, 0, 0], deaths = 0, nightEv = {}, patrolOutcomes = {}, breaks = 0, expInjury = 0;
const hist = { promiseAccept: 0, promiseSeen: 0 };
for (let seed = 1; seed <= N; seed++) {
  const { s } = play(seed, pol);
  let m = 0; for (const r of s.residents) { m = Math.max(m, r.injury); }
  maxInj[m]++;
  deaths += s.stats.deaths;
  if (s.flags.hospital_pact) hist.promiseAccept++;
  for (const h of s.history) if (h.text.includes('순찰')) patrolOutcomes[h.text] = (patrolOutcomes[h.text] || 0) + 1;
}
console.log(pol, N, '판 / 최종 최고 부상 단계 분포(0/1/2/3):', maxInj.join('/'), '/ 사망', deaths);
