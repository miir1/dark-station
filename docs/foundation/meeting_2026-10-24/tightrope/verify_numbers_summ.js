// 적대적 검증 요약 — run.js --json 결과(들)를 읽어 블록마다 다시 잰다 (run.js 의 판정 줄을 믿지 않고 원래 집계에서 직접 계산)
// node verify_numbers_summ.js a.json [b.json …]
const fs = require('fs');
const files = process.argv.slice(2);
const r1 = (v) => Math.round(10 * v) / 10;
const out = [];
const allB = [], allA4 = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.blocks.forEach((b0, i) => allB.push({ b0, a: j.byBlock[i] }));
  j.a4Blocks.forEach((b0, i) => allA4.push({ b0, a: j.a4ByBlock[i] }));
}
const pols = [...new Set(allB.flatMap((x) => Object.keys(x.a)))];
const sumN = (rows, name, k) => rows.reduce((t, r) => t + (r.a[name] ? r.a[name][k] : 0), 0);
// 블록을 합친 생존%: 판 수 가중
const pooled = (rows, name, k) => { const n = sumN(rows, name, 'n'); return n ? rows.reduce((t, r) => t + r.a[name][k] * r.a[name].n, 0) / n : NaN; };
out.push(`블록 ${allB.length}개 (${allB.map((x) => x.b0).join(',')}) · A4 블록 ${allA4.length}개 (${allA4.map((x) => x.b0).join(',')})`);
out.push('');
// 1) 균형 사망
out.push('1) 균형 사망% (블록별): ' + allB.map((x) => x.a.balanced.deathRate).join(' · ') + ` → 합산 ${r1(pooled(allB, 'balanced', 'deathRate'))} · 최저 ${Math.min(...allB.map((x) => x.a.balanced.deathRate))}`);
// 2) 강제 · 경고 없는 사망 (전 정책)
const pols2 = pols;
const forced = allB.map((x) => pols.reduce((t, p) => t + (x.a[p] ? x.a[p].forced : 0), 0));
const unw = allB.map((x) => pols.reduce((t, p) => t + (x.a[p] ? x.a[p].unwarned : 0), 0));
const deaths = allB.map((x) => pols.reduce((t, p) => t + (x.a[p] ? x.a[p].deaths : 0), 0));
const noSafe = allB.map((x) => pols.reduce((t, p) => t + ((x.a[p] && x.a[p].noSafeDeaths) || 0), 0));
out.push(`2) 강제(확정) 사망 블록별: ${forced.join(' · ')} · 경고 없는 사망: ${unw.join(' · ')} · 사망 합 ${deaths.reduce((a, b) => a + b, 0)} · 옛 정의(위험 0 출구 없음) 죽음 ${noSafe.join(' · ')}`);
// 3) selfish 4종 − 균형
for (const p of ['selfish_nb', 'selfish_rt0', 'selfish', 'selfish_rt']) {
  if (!allB.every((x) => x.a[p])) continue;
  const d = allB.map((x) => r1(x.a[p].survived - x.a.balanced.survived));
  out.push(`3) ${p} 생존 − 균형 (블록별): ${d.join(' · ')} → 합산 ${r1(pooled(allB, p, 'survived') - pooled(allB, 'balanced', 'survived'))} · < 0 블록 ${d.filter((v) => v < 0).length}/${d.length} · 최대 ${Math.max(...d)}`);
}
// 4) 게으름 차 (A4 블록 전부)
for (const [hi, lab] of [['balanced', '보통−게으름'], ['diligent', '부지런−게으름']]) {
  const d = allA4.map((x) => r1(x.a[hi].survived - x.a.lazy.survived));
  out.push(`4) ${lab} 생존 (A4 블록별): ${d.join(' · ')} → 합산 ${r1(pooled(allA4, hi, 'survived') - pooled(allA4, 'lazy', 'survived'))} · > 0 블록 ${d.filter((v) => v > 0).length}/${d.length} · ≥ 5 블록 ${d.filter((v) => v >= 5).length}/${d.length} · 최저 ${Math.min(...d)}`);
}
// 표준오차 감 (블록 하나 200판에서 두 생존율 차)
const sB = pooled(allA4, 'balanced', 'survived') / 100, sL = pooled(allA4, 'lazy', 'survived') / 100, nb = allA4[0].a.balanced.n;
out.push(`   참고: 블록 하나(${nb}판)의 보통−게으름 차 표준오차 ≈ ${r1(100 * Math.sqrt((sB * (1 - sB) + sL * (1 - sL)) / nb))}%p`);
// 5) 한 사건 비중 (균형)
out.push('5) 균형 사망 중 한 사건 비중 — 사인 (블록별): ' + allB.map((x) => `${x.a.balanced.topCause.k} ${x.a.balanced.topCause.share}`).join(' · '));
out.push('   원인 (블록별): ' + allB.map((x) => `${x.a.balanced.topRoot.k} ${x.a.balanced.topRoot.share}`).join(' · '));
// 합산 사인 비중
const poolCause = (key) => { const o = {}; let n = 0; for (const x of allB) { for (const [k, v] of Object.entries(x.a.balanced[key])) o[k] = (o[k] || 0) + v; n += x.a.balanced.deaths; } const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3); return e.map(([k, v]) => `${k} ${r1(100 * v / n)}%`).join(' · '); };
out.push(`   합산 사인 상위: ${poolCause('byCause')} ‖ 합산 원인 상위: ${poolCause('byRoot')}`);
// 6) 조심형 사람 흉내 사망
for (const p of ['h_cautious', 'h_first', 'h_cautious2', 'h_mixed', 'h_wary']) if (allB.every((x) => x.a[p])) out.push(`6) ${p} 사망% (블록별): ${allB.map((x) => x.a[p].deathRate).join(' · ')} → 합산 ${r1(pooled(allB, p, 'deathRate'))}`);
// 7) 그 밖 (보고된 표와 대조)
if (allB.every((x) => x.a.risky)) out.push(`7) 모험 생존 (블록별): ${allB.map((x) => x.a.risky.survived).join(' · ')} → 합산 ${r1(pooled(allB, 'risky', 'survived'))}`);
if (allB.every((x) => x.a.selfish_nb)) out.push(`   selfish_nb 산 판 줄타기 넘김/판 (블록별): ${allB.map((x) => x.a.selfish_nb.ropeCloseSurv).join(' · ')} · ≥2번% ${allB.map((x) => x.a.selfish_nb.ropeClose2).join(' · ')}`);
out.push(`   균형 D5까지 사망% (블록별): ${allB.map((x) => x.a.balanced.deadByD5).join(' · ')}`);
const CARE = require(require('path').resolve(__dirname, '..', '..', '..', '..', 'v4/sim/bots.js')).CAREFUL;
out.push(`   조심형 = ${CARE.join('·')}`);
for (const d of [2, 3, 4, 5, 6]) out.push(`   그날 사건 사망 D${d} (블록별, 정책 ${CARE.filter((p) => allB[0].a[p]).length}종 합): ` + allB.map((x) => CARE.reduce((t, p) => t + ((x.a[p] && x.a[p].dayEvent[d]) || 0), 0)).join(' · '));
if (allB.every((x) => x.a.counter && x.a.child && x.a.h_wary)) out.push(`   부작용: counter·child·h_wary 생존 (블록별): ` + ['counter', 'child', 'h_wary'].map((p) => `${p} ${allB.map((x) => x.a[p].survived).join('/')}`).join(' ‖ '));
console.log(out.join('\n'));
