// 10-26 측정 보조: run.js --json 결과(sim.json)에서 합격선 표에 없는 줄을 블록마다 잰다 (코드·데이터는 안 고친다)
// node docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/extra.js [sim.json]
const fs = require('fs');
const path = require('path');
const f = process.argv[2] || path.join(__dirname, 'sim.json');
const J = JSON.parse(fs.readFileSync(f, 'utf8'));
const { blocks, aggs, byBlock } = J;
const MARGIN = 5;
const SELF = ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0'];
const PERS = ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward', 'counter', 'child'];
const HUM = ['h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'];
const r1 = (v) => Math.round(10 * v) / 10;
const r2 = (v) => Math.round(100 * v) / 100;
const sg = (v) => (v > 0 ? '+' : '') + v;
// 판정: 모든 블록 통과 · %줄은 ±5%p 밖 = ✓ / 모든 블록 미달 = ✗ / 그 밖 = △
const mark = (vals, ok, line, pctLine) => {
  const oks = vals.map(ok);
  const near = pctLine ? vals.some((v) => Math.abs(v - line) <= MARGIN) : false;
  return oks.every(Boolean) && !near ? '✓' : !oks.some(Boolean) ? '✗' : '△';
};
const out = [];
const row = (k, want, vals, all, m) => out.push(`| ${k} | ${want} | ${vals.join(' | ')} | ${all} | ${m} |`);
out.push(`| 항목 | 합격선 | ${blocks.map((b) => `블록 ${b}`).join(' | ')} | 합산 | 판정 |`);
out.push(`|---|---|${blocks.map(() => '---').join('|')}|---|---|`);
// A1 이른 안전 — 이기적 4종 각각
for (const p of SELF) {
  const vs = byBlock.map((a) => r1(a[p].aliveD4 - a.balanced.aliveD4));
  row(`A1 D1~D4 생존 − 균형: ${p}`, '≥ +5%p', vs.map((v, i) => `${sg(v)} (${byBlock[i][p].aliveD4} vs ${byBlock[i].balanced.aliveD4})`), `${sg(r1(aggs[p].aliveD4 - aggs.balanced.aliveD4))}`, mark(vs, (v) => v >= 5, 5, true));
}
for (const p of SELF) {
  const vs = byBlock.map((a) => r1(a[p].survived - a.balanced.survived));
  row(`A1 열흘 생존 − 균형: ${p}`, '< 0', vs.map((v, i) => `${sg(v)} (${byBlock[i][p].survived} vs ${byBlock[i].balanced.survived})`), `${sg(r1(aggs[p].survived - aggs.balanced.survived))}`, mark(vs, (v) => v < 0, 0, true));
}
// 정체 묶음 — 각 후보 ≥3%, 가장 큰 후보 ≤40% (두 묶음 모두)
const cands = Object.keys(Object.assign({}, ...Object.values(aggs).map((a) => a.identity || {})));
const grp = (A, names) => { const o = {}; for (const c of cands) o[c] = r1(names.reduce((t, k) => t + ((A[k].identity || {})[c] || 0), 0) / names.length); return o; };
for (const [lab, names] of [['성향 봇', PERS], ['사람 흉내', HUM]]) {
  const gs = byBlock.map((a) => grp(a, names)); const ga = grp(aggs, names);
  const mins = gs.map((g) => Math.min(...cands.map((c) => g[c])));
  const minK = (g) => cands.slice().sort((x, y) => g[x] - g[y])[0];
  row(`정체 ${lab} 평균: 가장 작은 후보`, '≥ 3% (경계 ±1.5)', gs.map((g) => `${minK(g)} ${g[minK(g)]}`), `${minK(ga)} ${ga[minK(ga)]}`, (() => { const ok = mins.map((v) => v >= 3); const near = mins.some((v) => Math.abs(v - 3) <= 1.5); return ok.every(Boolean) && !near ? '✓' : !ok.some(Boolean) ? '✗' : '△'; })());
  const maxK = (g) => cands.slice().sort((x, y) => g[y] - g[x])[0];
  const maxs = gs.map((g) => g[maxK(g)]);
  row(`정체 ${lab} 평균: 가장 큰 후보`, '≤ 40%', gs.map((g) => `${maxK(g)} ${g[maxK(g)]}`), `${maxK(ga)} ${ga[maxK(ga)]}`, mark(maxs, (v) => v <= 40, 40, true));
  out.push(`|   (${lab} 합산 분포) | | ${cands.map((c) => `${c} ${ga[c]}`).join(' · ')} |`);
}
// A4 — D9 주민·D7 자원 차 > 0
for (const [k, lab] of [['home9', 'D9 아침 주민 수'], ['res7', 'D7 아침 식량+물+약']]) {
  for (const p of ['balanced', 'diligent']) {
    const vs = byBlock.map((a) => r2(a[p][k] - a.lazy[k]));
    row(`A4 ${lab} 차: ${p === 'balanced' ? '보통' : '부지런'}−게으름`, '> 0', vs.map(sg), sg(r2(aggs[p][k] - aggs.lazy[k])), mark(vs, (v) => v > 0, 0, false));
  }
}
for (const p of ['balanced', 'diligent']) {
  const vs = byBlock.map((a) => r1(a[p].survived - a.lazy.survived));
  row(`A4 생존 차: ${p === 'balanced' ? '보통' : '부지런'}−게으름`, '≥ +5%p', vs.map(sg), sg(r1(aggs[p].survived - aggs.lazy.survived)), mark(vs, (v) => v >= 5, 5, true));
}
// 모험 · 균형 사망 · D5 · 열차 · 전멸 · explicit (균형) — 블록 값 그대로
const simple = [
  ['균형 사망', '≥ 50%', (a) => a.balanced.deathRate, (v) => v >= 50, 50, true],
  ['균형 D5까지 사망', '≥ 10%', (a) => a.balanced.deadByD5, (v) => v >= 10, 10, true],
  ['모험 열흘 생존', '≥ 25%', (a) => a.risky.survived, (v) => v >= 25, 25, true],
  ['열차 결말 (모험)', '> 0%', (a) => a.risky.train, (v) => v > 0, 0, false],
  ['전멸 (균형)', '≤ 25%', (a) => a.balanced.allDead, (v) => v <= 25, 25, true],
  ['explicit/판 (균형)', '≥ 7', (a) => a.balanced.explicit, (v) => v >= 7, 7, false],
];
for (const [k, want, f, ok, line, pl] of simple) { const vs = byBlock.map(f); row(k, want, vs, f(aggs), mark(vs, ok, line, pl)); }
// 날별: D2~D6 그날 사건 사망 (정책 합산) 블록마다
const dayEv = (A) => { const o = {}; for (const a of Object.values(A)) for (const [d, v] of Object.entries(a.dayEvent || {})) o[d] = (o[d] || 0) + v; return o; };
for (const d of [2, 3, 4, 5, 6]) { const vs = byBlock.map((A) => dayEv(A)[d] || 0); row(`D${d} 그날 사건으로 죽은 판 (정책 합산)`, '> 0', vs, dayEv(aggs)[d] || 0, mark(vs, (v) => v > 0, 0, false)); }
// 균형만 D2~D6
for (const d of [2, 3, 4, 5, 6]) { const vs = byBlock.map((A) => (A.balanced.dayEvent || {})[d] || 0); row(`  균형만 D${d}`, '측정', vs, (aggs.balanced.dayEvent || {})[d] || 0, '측정'); }
// 균형 사인·원인 상위 3 (합산)
const top3 = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${k} ${v} (${r1((100 * v) / n)}%)`).join(' · ');
out.push('');
for (const p of ['balanced', 'selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0', 'risky', 'devoted', 'lazy', 'diligent', 'h_cautious2', 'h_mixed', 'h_wary', 'h_random']) {
  if (!aggs[p] || !aggs[p].deaths) { out.push(`- ${p}: 사망 0`); continue; }
  out.push(`- ${p} (사망 ${aggs[p].deaths}/${aggs[p].n}): 사인 ${top3(aggs[p].byCause, aggs[p].deaths)} / 원인 ${top3(aggs[p].byRoot, aggs[p].deaths)}`);
}
// 블록별 사인 1위 비중 (균형)
out.push('');
out.push('- 균형 사인 1위 블록별: ' + byBlock.map((a, i) => `블록 ${blocks[i]} ${a.balanced.topCause.k} ${a.balanced.topCause.share}%`).join(' · '));
out.push('- 균형 원인 1위 블록별: ' + byBlock.map((a, i) => `블록 ${blocks[i]} ${a.balanced.topRoot.k} ${a.balanced.topRoot.share}%`).join(' · '));
// 굶주림 사망 비중 (전 정책) — 사인 starve_you
const st = (A) => { let d = 0, s = 0; for (const a of Object.values(A)) { d += a.deaths; s += a.starveDeaths; } return r1((100 * s) / Math.max(1, d)); };
out.push('- 굶주림(starve_you) 사인 비중 (전 정책): ' + byBlock.map((A, i) => `블록 ${blocks[i]} ${st(A)}%`).join(' · ') + ` · 합산 ${st(aggs)}%`);
// 굶주림이 원인(부상 출처 포함)인 균형 사망
out.push('- 균형 원인 starve_you 비중 블록별: ' + byBlock.map((a, i) => `블록 ${blocks[i]} ${r1((100 * (a.balanced.byRoot.starve_you || 0)) / Math.max(1, a.balanced.deaths))}%`).join(' · '));
console.log(out.join('\n'));
