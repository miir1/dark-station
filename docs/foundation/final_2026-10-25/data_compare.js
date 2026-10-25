// 봇 200판 전후 비교 (data 담당, 2026-10-25) — node docs/foundation/final_2026-10-25/data_compare.js <전 run.json> <후 run.json> [이름]
// 같은 엔진·봇(그때의 v4/engine·v4/sim 사본)으로 data_before 표(전)와 지금 표(후)를 돌린 run.js --json 두 개를 읽어 합격선·정책별 줄을 나란히 찍는다.
const fs = require('fs');
const [fa, fb, title] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
const L = [];
const p = (s) => L.push(s);
const f1 = (x) => (x == null || Number.isNaN(x) ? '-' : Math.round(x * 10) / 10);
const d = (a, b) => (a == null || b == null ? '' : `${b - a >= 0 ? '+' : ''}${f1(b - a)}`);
const surv = (agg, k) => (agg[k] ? agg[k].survived : null);
p(`# 봇 200판 전후 비교 ${title || ''}`);
p(`블록(기본): 전 ${A.blocks.join(',')} · 후 ${B.blocks.join(',')} · A4 블록: ${B.a4Blocks.join(',')}`);
p('');
p('## 지시 합격선 (전 → 후)');
const bal = (J) => J.aggs.balanced;
const blockVals = (J, pol, key) => (J.byBlock || []).map((b) => (b[pol] ? f1(b[pol][key]) : '-'));
p(`- 균형 사망 ≥ 50%: ${f1(bal(A).deathRate)} → ${f1(bal(B).deathRate)}% (후 블록 ${blockVals(B, 'balanced', 'deathRate').join(' · ')}) ${bal(B).deathRate >= 50 && blockVals(B, 'balanced', 'deathRate').every((x) => x >= 50) ? '✓' : '✗'}`);
const forced = (J) => Object.values(J.aggs).reduce((s, a) => s + (a.forced || 0), 0);
const unwarned = (J) => Object.values(J.aggs).reduce((s, a) => s + (a.unwarned || 0), 0);
p(`- 확정 사망(전 정책 합산): ${forced(A)} → ${forced(B)} 판 ${forced(B) === 0 ? '✓' : '✗'} · 경고 없는 사망 ${unwarned(A)} → ${unwarned(B)}`);
for (const k of ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0']) {
  const a = surv(A.aggs, k) - surv(A.aggs, 'balanced'), b = surv(B.aggs, k) - surv(B.aggs, 'balanced');
  const bb = (B.byBlock || []).map((x) => (x[k] && x.balanced ? f1(x[k].survived - x.balanced.survived) : '-'));
  p(`- ${k} 생존 − 균형 < 0: ${f1(a)} → ${f1(b)}%p (후 블록 ${bb.join(' · ')}) ${b < 0 && bb.every((x) => x < 0) ? '✓' : b < 0 ? '△ (합산 ✓, 블록 하나 이상 ≥ 0)' : '✗'}`);
}
const a4 = (J, k) => J.a4All && J.a4All[k] ? J.a4All[k].survived : surv(J.aggs, k);
const a4b = (J) => (J.a4ByBlock || []).map((x) => (x.balanced && x.lazy ? f1(x.balanced.survived - x.lazy.survived) : '-'));
p(`- 보통 − 게으름 생존 > 0 (A4 블록 ${B.a4Blocks.length}개): ${f1(a4(A, 'balanced') - a4(A, 'lazy'))} → ${f1(a4(B, 'balanced') - a4(B, 'lazy'))}%p (후 블록 ${a4b(B).join(' · ')}) ${a4(B, 'balanced') - a4(B, 'lazy') > 0 ? '✓' : '✗'}${a4b(B).every((x) => x > 0) ? ' · 모든 블록 > 0' : ' · 블록 중 ≤ 0 있음'}`);
p(`  (전 블록 ${a4b(A).join(' · ')})`);
p('');
p('## 정책별 생존% · 사망% (블록 합산, 전 → 후)');
p('| 정책 | 생존 전 | 생존 후 | 차 | 사망 후 | 원정/판 전→후 | 사인 1위 후 |');
p('|---|---|---|---|---|---|---|');
for (const k of Object.keys(B.aggs)) {
  const a = A.aggs[k] || {}, b = B.aggs[k];
  p(`| ${k} | ${f1(a.survived)} | ${f1(b.survived)} | ${d(a.survived, b.survived)} | ${f1(b.deathRate)} | ${f1(a.trips)}→${f1(b.trips)} | ${b.topCause ? b.topCause.k + ' ' + f1(b.topCause.share) + '%' : '-'} |`);
}
p('');
p('## 이른 날 — 그날 사건으로 죽은 판 (조심형 묶음 합산 · 깔때기 사건 뺌) 전 → 후');
const CAREFUL = ['balanced', 'silent', 'lazy', 'diligent', 'steward', 'selfish_nb'];
const dayEv = (J, day) => CAREFUL.reduce((s, k) => s + ((J.aggs[k] && J.aggs[k].dayEvent && J.aggs[k].dayEvent[day]) || 0), 0);
for (const day of [2, 3, 4, 5, 6]) p(`- D${day}: ${dayEv(A, day)} → ${dayEv(B, day)}${day === 3 ? ' (D3 = 배우는 날, 측정)' : day === 6 ? ' (D6 = 값을 치르면 사는 날, 측정)' : ' (> 0 이어야)'}`);
for (const day of [3, 6]) p(`  - D${day} 정책별(후): ${CAREFUL.map((k) => `${k} ${(B.aggs[k].dayEvent || {})[day] || 0}`).join(' · ')}`);
p('');
p('## 합격선 표 (run.js gate, 블록 합침 판정) — 전 표시 → 후 표시 · 후 값');
const rowsA = new Map((A.gate || []).map((r) => [r.k, r]));
for (const r of B.gate || []) {
  const a = rowsA.get(r.k);
  const changed = !a || a.mark !== r.mark;
  p(`- ${changed ? '**' : ''}${a ? a.mark : '(없음)'} → ${r.mark}${changed ? '**' : ''} ${r.k} [${r.want}] 후: ${(r.got || []).join(' | ')}${a ? ' · 전: ' + (a.got || []).join(' | ') : ''}`);
}
p('');
p('## 사인 (balanced · selfish_nb · lazy, 후)');
for (const k of ['balanced', 'selfish_nb', 'lazy']) { const c = B.aggs[k].byCause || {}; p(`- ${k}: ${Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([e, n]) => `${e} ${n}`).join(' · ')}`); }
console.log(L.join('\n'));
