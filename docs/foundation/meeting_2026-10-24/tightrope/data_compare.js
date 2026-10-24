// 10-24 줄타기 데이터 몫 — run.js 전후 비교 (data 담당)
//   node docs/foundation/meeting_2026-10-24/tightrope/data_compare.js [--before=data_before.json] [--after=data_after.json] [--out=data_compare.md]
//   run.js --json 결과 둘을 읽어 설계 §0 표 줄 · 정책별 생존 · 합격선 판정을 전/후/설계 예상으로 나란히 싣는다.
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const rd = (f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8'));
const A = rd(opt('before', 'data_before.json')), Z = rd(opt('after', 'data_after.json'));
const r1 = (x) => Math.round(10 * x) / 10;
const pol = (j, p) => j.aggs[p] || {};
const a4 = (j, p) => (j.a4All && j.a4All[p]) || pol(j, p);
const blk = (j, p) => (j.byBlock || []).map((b) => (b[p] ? b[p].survived : null));
const a4blk = (j, p) => (j.a4ByBlock || []).map((b) => (b[p] ? b[p].survived : null));
const minus = (xs, ys) => xs.map((x, i) => (x == null || ys[i] == null ? '-' : r1(x - ys[i])));
const sum = (j, k) => Object.values(j.aggs).reduce((s, a) => s + (a[k] || 0), 0);
const de = (j) => [2, 3, 4, 5, 6].map((d) => (pol(j, 'balanced').dayEvent || {})[d] || 0).join(' · ');
const top = (t) => (t ? `${t.k} ${t.share}%` : '-');

const rows = [
  ['균형 사망 (4블록)', (j) => `${pol(j, 'balanced').deathRate}%`, '61.9%', '≥ 50%'],
  ['확정 사망 · 경고 없는 사망 (20정책 합)', (j) => `${sum(j, 'forced')} · ${sum(j, 'unwarned')}`, '0 · 0', '0 · 0'],
  ['selfish_nb 생존 − 균형 (블록별)', (j) => `${r1(pol(j, 'selfish_nb').survived - pol(j, 'balanced').survived)}%p (${pol(j, 'selfish_nb').survived} vs ${pol(j, 'balanced').survived}; 블록 ${minus(blk(j, 'selfish_nb'), blk(j, 'balanced')).join('/')})`, '−9.2%p (28.9 vs 38.1)', '모든 블록 < 0'],
  ['selfish · selfish_rt · selfish_rt0 − 균형', (j) => ['selfish', 'selfish_rt', 'selfish_rt0'].map((p) => r1(pol(j, p).survived - pol(j, 'balanced').survived)).join(' · '), '−10.0 · −31.5 · −32.1', '< 0'],
  ['이른 안전: selfish_nb D1~D4 생존 − 균형', (j) => `${r1(pol(j, 'selfish_nb').aliveD4 - pol(j, 'balanced').aliveD4)}%p`, '+8.7%p', '≥ +5%p'],
  ['아슬함: selfish_nb 산 판의 줄타기 넘김/판 · ≥2번', (j) => `${pol(j, 'selfish_nb').ropeCloseSurv} · ${pol(j, 'selfish_nb').ropeClose2}%`, '5.0 · 87%', '≥ 2 · ≥ 60%'],
  ['죽음 판정 넘김/판(산 판): 균형 · selfish_nb', (j) => `${pol(j, 'balanced').closeCallsSurv} · ${pol(j, 'selfish_nb').closeCallsSurv}`, '3.8 · 5.4', '측정'],
  ['조심형 사람 흉내 사망 h_cautious · h_first', (j) => `${pol(j, 'h_cautious').deathRate}% · ${pol(j, 'h_first').deathRate}%`, '35.9% · 33.1%', '측정 (0은 아니게)'],
  ['모험(risky) 생존 (블록별)', (j) => `${pol(j, 'risky').survived}% (${blk(j, 'risky').join('/')})`, '29.0%', '≥ 25%'],
  ['보통 − 게으름 생존 (A4 블록, 블록별)', (j) => `${r1(a4(j, 'balanced').survived - a4(j, 'lazy').survived)}%p (${minus(a4blk(j, 'balanced'), a4blk(j, 'lazy')).join('/')})`, '+10.0%p (8/8 > 0)', '≥ +5%p · 모든 블록 > 0'],
  ['부지런 − 게으름 생존 (A4 블록)', (j) => `${r1(a4(j, 'diligent').survived - a4(j, 'lazy').survived)}%p`, '+14.3%p', '측정'],
  ['게으름 · 보통 · 부지런 생존 (A4 블록)', (j) => ['lazy', 'balanced', 'diligent'].map((p) => a4(j, p).survived).join(' · '), '26.6 · 36.6 · 40.9', '-'],
  ['D9 주민 · D7 식량+물+약: 보통 − 게으름', (j) => `${r1((a4(j, 'balanced').home9 - a4(j, 'lazy').home9) * 100) / 100} · ${r1((a4(j, 'balanced').res7 - a4(j, 'lazy').res7) * 100) / 100}`, '+0.11 · +0.45', '> 0 · ≥ +0.2'],
  ['균형 사망 중 한 사건 비중 (사인 · 원인)', (j) => `${top(pol(j, 'balanced').topCause)} · ${top(pol(j, 'balanced').topRoot)}`, '열병 30.0 · 굶는 밤 29.8%', '≤ 40%'],
  ['실제 발견율: 게으름 · 보통 · 부지런 (A4 블록)', (j) => ['lazy', 'balanced', 'diligent'].map((p) => `${a4(j, p).discReal}%`).join(' · '), '32.0 · 60.5 · 94.5%', '측정 (소문은 안 늘린다)'],
  ['눈먼 새벽/판 · 그 죽음: 게으름 · 보통 · 부지런 (A4 블록)', (j) => ['lazy', 'balanced', 'diligent'].map((p) => `${a4(j, p).blindMet} · ${a4(j, p).blindDeaths}`).join(' / '), '1.02 · 286 / 0.31 · 94 / 0 (1600판)', '측정'],
  ['균형 그날 사건 사망 D2 · D3 · D4 · D5 · D6 (판)', de, '(엔진 4블록) 33 · 0 · 42 · 107 · –', 'D2·D4·D5 > 0'],
  ['카르마(끝) 균형 · selfish_nb', (j) => `${pol(j, 'balanced').karma} · ${pol(j, 'selfish_nb').karma}`, '– · 10.3', '측정'],
];
const L = ['# 줄타기 데이터 넣기 전후 — node v4/sim/run.js 200 (20정책 × 4블록 1·1001·2001·3001, A4 셋은 8블록)', '',
  `전 = data_before.json (표 고치기 전, 엔진 R0~R4 는 들어간 상태) · 후 = data_after.json (데이터 넣은 뒤) · 설계 예상 = design.md §0 '설계안 (시험)' 열 (메모리 시험)`, '',
  '## 1. 설계 §0 줄', '| 무엇 | 전 | 후 | 설계 예상 | 목표 [제안] |', '|---|---|---|---|---|'];
for (const [k, f, d, t] of rows) L.push(`| ${k} | ${f(A)} | ${f(Z)} | ${d} | ${t} |`);
L.push('', '## 2. 정책별 생존% (4블록 · 게으름 셋은 A4 블록 합산도 괄호)', '| 정책 | 전 | 후 | 차 | 후 사망% | 후 사인 1위 | 후 카르마(끝) |', '|---|---|---|---|---|---|---|');
for (const p of Object.keys(Z.aggs)) {
  const b = pol(A, p), a = pol(Z, p);
  const x = A.a4All && A.a4All[p] ? ` (${A.a4All[p].survived})` : '', y = Z.a4All && Z.a4All[p] ? ` (${Z.a4All[p].survived})` : '';
  L.push(`| ${p} | ${b.survived}${x} | ${a.survived}${y} | ${r1(a.survived - b.survived)} | ${a.deathRate} | ${top(a.topCause)} | ${a.karma} |`);
}
L.push('', '## 3. 합격선 판정 (run.js 합격선 표 — ✓ 모든 블록 통과 / △ 블록마다 다름·±5%p 안 / ✗ 모든 블록 미달)', '| 항목 | 합격선 | 전 판정 | 후 판정 | 후 실측 (블록별) |', '|---|---|---|---|---|');
const gA = Object.fromEntries((A.gate || []).map((g) => [g.k, g]));
for (const g of Z.gate || []) { const b = gA[g.k]; L.push(`| ${g.k.trim()} | ${g.want} | ${b ? b.mark : '—'} | ${g.mark}${b && b.mark !== g.mark ? ' ←' : ''} | ${(g.got || []).join(' ; ').slice(0, 260)} |`); }
const txt = L.join('\n') + '\n';
fs.writeFileSync(path.resolve(__dirname, opt('out', 'data_compare.md')), txt);
console.log(txt);
