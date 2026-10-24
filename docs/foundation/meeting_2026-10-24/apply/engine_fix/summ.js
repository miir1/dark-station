// engine_fix: 고치기 전(measure_2026-10-26/sim.json)과 뒤(engine_fix/sim.json)의 항목별 숫자 (10-24 검증 1~7)
// node docs/foundation/meeting_2026-10-24/apply/engine_fix/summ.js
const path = require('path');
const A = require(path.join(__dirname, '..', 'measure_2026-10-26', 'sim.json'));
const B = require(path.join(__dirname, 'sim.json'));
const D26 = [2, 3, 4, 5, 6];
const days = (a) => D26.map((d) => `D${d} ${(a.dayEvent || {})[d] || 0}`).join(' · ');
const sumDays = (aggs, names) => { const o = {}; for (const k of names) for (const [d, v] of Object.entries((aggs[k] || {}).dayEvent || {})) o[d] = (o[d] || 0) + v; return D26.map((d) => `D${d} ${o[d] || 0}`).join(' · '); };
const CAREFUL_OLD = ['balanced', 'selfish', 'silent', 'lazy', 'diligent', 'steward', 'selfish_nb'];
const CAREFUL_NEW = ['balanced', 'silent', 'lazy', 'diligent', 'steward', 'selfish_nb'];
for (const [lab, J, care] of [['전 (10-26)', A, CAREFUL_OLD], ['뒤 (engine_fix)', B, CAREFUL_NEW]]) {
  const g = J.aggs;
  console.log(`\n## ${lab}`);
  console.log('생존%: ' + Object.keys(g).map((k) => `${k} ${g[k].survived}`).join(' · '));
  console.log('봇 버릇(deadlyPick): ' + Object.keys(g).filter((k) => g[k].deadlyPick).map((k) => `${k} ${g[k].deadlyPick}`).join(' · ') + ` | 조심형 합 ${care.reduce((t, k) => t + (g[k] ? g[k].deadlyPick || 0 : 0), 0)}`);
  console.log('이기적 사인 1위: ' + ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0'].map((k) => `${k} ${g[k].topCause.k} ${g[k].topCause.share}% (사망 ${g[k].deaths})`).join(' / '));
  console.log('A1 생존 − 균형: ' + ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0'].map((k) => `${k} ${Math.round(10 * (g[k].survived - g.balanced.survived)) / 10}`).join(' · '));
  console.log('A2 날마다 그날 사건 사망: 조심형 ' + sumDays(g, care) + ' | 균형 ' + days(g.balanced) + ' | 전 정책 ' + sumDays(g, Object.keys(g)));
  const hum = ['h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'];
  const idAvg = (key) => { const o = {}; for (const k of hum) for (const [c, v] of Object.entries(g[k][key] || g[k].identity || {})) o[c] = (o[c] || 0) + v / hum.length; return Object.entries(o).sort((x, y) => y[1] - x[1]).map(([c, v]) => `${c} ${Math.round(10 * v) / 10}`).join(' · '); };
  console.log('A3 사람 흉내 정체(프롤로그 포함): ' + idAvg('identity'));
  if (g.h_random.identityNP) console.log('A3 사람 흉내 정체(프롤로그 사망 뺌): ' + idAvg('identityNP') + ' | D0 사망 ' + hum.map((k) => `${k} ${g[k].prologueDeaths}`).join(' · '));
  const a4 = J.a4All || g;
  console.log(`A4 (${J.a4Blocks ? J.a4Blocks.length : J.blocks.length}블록): ` + ['balanced', 'lazy', 'diligent'].map((k) => `${k} 생존 ${a4[k].survived} · D9 ${a4[k].home9} · D7 ${a4[k].res7} · 못 본 일 ${a4[k].neglect} · 발견 ${a4[k].discovery}% · 모름≥1 ${a4[k].unknownOk}%`).join(' / '));
  const bb = J.a4ByBlock || J.byBlock;
  console.log('A4 블록별 생존 보통−게으름: ' + bb.map((x) => Math.round(10 * (x.balanced.survived - x.lazy.survived)) / 10).join(' / ') + ' | D9: ' + bb.map((x) => Math.round(100 * (x.balanced.home9 - x.lazy.home9)) / 100).join(' / ') + ' | D7: ' + bb.map((x) => Math.round(100 * (x.balanced.res7 - x.lazy.res7)) / 100).join(' / '));
}
const gt = B.gate.filter((r) => /^A[124]|봇 버릇|정체 — 사람|강제 사망 \(|경고 없는 사망|당신 사망/.test(r.k.trim()));
console.log('\n## 뒤 판정');
for (const r of gt) console.log(`${r.mark} ${r.k}`);
