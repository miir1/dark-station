// iso_*.json 요약: 생존·home9·res7·잃은 주민(판 끝)·못 본 일 — 블록별·합산, 균형 대비 차와 표준오차
const fs = require('fs');
const pols = ['diligent', 'balanced', 'b_noinsp', 'b_zero', 'lazy'];
const D = {}; for (const p of pols) if (fs.existsSync(`iso2_${p}.json`)) D[p] = require(`./iso2_${p}.json`);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const blocks = [...new Set(D.balanced.map((r) => r.block))];
const stat = (rs) => {
  const surv = rs.map((r) => (r.survived ? 1 : 0));
  const h9 = rs.filter((r) => r.home9 != null).map((r) => r.home9), r7 = rs.filter((r) => r.res7 != null).map((r) => r.res7);
  const lost = rs.map((r) => r.lostEnd);
  // 생존 편향 없는 주민 지표: D9 아침까지 간 판만이 아니라, '당신이 D9 아침에 살아 있고 그때 역 주민 수' 대신 전체 판에서 판 끝 잃은 주민 수(당신이 일찍 죽으면 적게 셈 — 참고)
  return { n: rs.length, surv: 100 * mean(surv), survSE: 100 * Math.sqrt(mean(surv) * (1 - mean(surv)) / rs.length), home9: mean(h9), home9N: h9.length, home9SE: sd(h9) / Math.sqrt(h9.length || 1), res7: mean(r7), res7N: r7.length, res7SE: sd(r7) / Math.sqrt(r7.length || 1), lost: mean(lost), neglect: mean(rs.map((r) => r.neglect)), dead5: 100 * mean(rs.map((r) => (r.dead && r.deathDay <= 5 ? 1 : 0))) };
};
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1), f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
console.log('[iso2 — 화면에서 조사할 수 없는 물건(화로·역무실 상자·서하 머리맡)을 봇도 못 보게] 정책별 합산 (8블록 × 200판)');
console.log('정책 | 생존% (±SE) | D9 주민(판수) | D7 자원(판수) | 판끝 잃은 주민 | 못 본 일/판 | D5까지 사망%');
const S = {}; for (const p of pols) if (D[p]) { const s = (S[p] = stat(D[p])); console.log(`${p} | ${s.surv.toFixed(1)} (±${s.survSE.toFixed(1)}) | ${s.home9.toFixed(2)} (${s.home9N}) | ${s.res7.toFixed(2)} (${s.res7N}) | ${s.lost.toFixed(2)} | ${s.neglect.toFixed(2)} | ${s.dead5.toFixed(1)}`); }
console.log('\n균형(balanced) − 각 정책: 생존 %p (블록 8개 각각) / 합산 ±2SE · home9 차 · res7 차');
for (const p of pols) if (D[p] && p !== 'balanced') {
  const per = blocks.map((b) => stat(D.balanced.filter((r) => r.block === b)).surv - stat(D[p].filter((r) => r.block === b)).surv);
  const a = S.balanced, q = S[p];
  const se = Math.sqrt(a.survSE ** 2 + q.survSE ** 2);
  const perH = blocks.map((b) => stat(D.balanced.filter((r) => r.block === b)).home9 - stat(D[p].filter((r) => r.block === b)).home9);
  const perR = blocks.map((b) => stat(D.balanced.filter((r) => r.block === b)).res7 - stat(D[p].filter((r) => r.block === b)).res7);
  console.log(`balanced−${p}: 생존 ${per.map(f1).join(' / ')} | 합산 ${f1(a.surv - q.surv)} ±${(2 * se).toFixed(1)} | home9 ${f2(a.home9 - q.home9)} (±${(2 * Math.sqrt(a.home9SE ** 2 + q.home9SE ** 2)).toFixed(2)}) 블록 ${perH.map(f2).join(' ')} | res7 ${f2(a.res7 - q.res7)} (±${(2 * Math.sqrt(a.res7SE ** 2 + q.res7SE ** 2)).toFixed(2)}) 블록 ${perR.map(f2).join(' ')}`);
}
// 조사로 연 사건의 손해: 아침(trace) 조사로 열린 사건에서 자원이 줄어든 선택
console.log('\n아침·낮 조사로 열린 사건에서 자원이 줄어든 선택 (정책별 판당 횟수 · 판당 자원 합계 변화)');
for (const p of pols) if (D[p]) {
  const agg = {};
  for (const r of D[p]) for (const k of r.picks || []) { if (k.day === 0) continue; const loss = k.d.reduce((x, y) => x + y, 0); const key = `${k.ph}:${k.ev}/${k.choice}`; const a = (agg[key] = agg[key] || { n: 0, d: 0, hy: 0 }); a.n++; a.d += loss; a.hy += k.hy; }
  const rows = Object.entries(agg).filter(([, a]) => a.d < 0 || a.hy > 0).sort((x, y) => x[1].d - y[1].d).slice(0, 8);
  console.log(`- ${p}: ` + rows.map(([k, a]) => `${k} ${a.n}회(판당 ${(a.n / D[p].length).toFixed(2)}) 자원 ${a.d}${a.hy ? ' 당신굶주림 +' + a.hy : ''}`).join(' · '));
}
// 사인
console.log('\n사인 상위');
for (const p of pols) if (D[p]) { const c = {}; for (const r of D[p]) if (r.dead) c[r.causeKey] = (c[r.causeKey] || 0) + 1; console.log(`- ${p}: ` + Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(' · ')); }
