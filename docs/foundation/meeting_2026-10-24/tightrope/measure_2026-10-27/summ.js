// 10-27 측정 정리 (엔진 담당, 측정만 — 표·엔진·봇 코드는 읽기만)
//   기본 4블록(+A4 8블록, main.json) · 새 시드 블록 8001(nb.json) · 5블록 판정(A4 9블록) · 10-26(sim.json) · 10-27 커밋본(engine_fix/sim.json) 비교
//   판정 규칙 = 31 §4 · stats.combine 과 같다: 모든 블록 통과 · 합격선 ±5%p 밖 = ✓ / 모든 블록 미달 = ✗ / 그 밖 = △
// node docs/foundation/meeting_2026-10-24/tightrope/measure_2026-10-27/summ.js [main.json] [nb.json]  (C:\dev\dark_station 에서)
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const candIds = db.identity.candidates.map((c) => c.id);
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const MAIN = rd(process.argv[2] || path.join(__dirname, 'main.json'));
const NB = rd(process.argv[3] || path.join(__dirname, 'nb.json'));
const P26 = rd(path.join(ROOT, 'docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/sim.json'));
const P27 = rd(path.join(ROOT, 'docs/foundation/meeting_2026-10-24/apply/engine_fix/sim.json'));
const M = S.MARGIN;
const r1 = (v) => Math.round(10 * v) / 10, r2 = (v) => Math.round(100 * v) / 100;
const sgn = (v) => (v == null ? '-' : (v > 0 ? '+' : '') + r1(v));
const fin = (v) => v != null && Number.isFinite(v);
const sum = (A, k) => Object.values(A).reduce((t, a) => t + (a[k] || 0), 0);
const diff = (A, x, y, k) => (A[x] && A[y] && fin(A[x][k]) && fin(A[y][k]) && A[x][k + 'N'] !== 0 && A[y][k + 'N'] !== 0 ? r2(A[x][k] - A[y][k]) : null);
const CARE = B.CAREFUL;
const dayEv = (A, names) => { const o = {}; for (const k of names) for (const [d, v] of Object.entries((A[k] && A[k].dayEvent) || {})) o[d] = (o[d] || 0) + v; return o; };
const near = (v, line) => fin(v) && Math.abs(v - line) <= M;
const idG = (A) => { const g = S.gate(A, candIds, CARE); const mm = (o) => { const e = Object.entries(o || {}).sort((x, y) => x[1] - y[1]); return e.length ? { lo: e[0], hi: e[e.length - 1] } : null; }; return { P: mm(g.idP), H: mm(g.idH), idH: g.idH }; };

// 항목: { k, want, a4?, v(A) → { ok, near, s } }  (A = 한 블록의 {정책: 집계})
const I = [];
const add = (k, want, f, o) => I.push(Object.assign({ k, want, f }, o || {}));
add('균형 사망 (올라감 포함)', '≥ 50%', (A) => { const v = A.balanced.deathRate; return { ok: v >= 50, near: near(v, 50), s: `${v}` }; });
add('강제 사망 = 확정 사망 (전 정책)', '0 판', (A) => { const v = sum(A, 'forced'); return { ok: v === 0, near: false, s: `${v}/${sum(A, 'deaths')}` }; });
add('경고 없는 사망 (전 정책)', '0 판', (A) => { const v = sum(A, 'unwarned'); return { ok: v === 0, near: false, s: `${v}` }; });
add('  참고: 위험 0 출구가 없던 죽음 (옛 강제) · 그중 줄타기 판정', '측정', (A) => ({ ok: true, near: false, s: `${sum(A, 'noSafeDeaths')} · ${sum(A, 'ropeDeaths')}` }), { meas: 1 });
add('균형 D5까지 사망', '≥ 10% (§8: > 25% 면 손잡이)', (A) => { const v = A.balanced.deadByD5; return { ok: v >= 10, near: near(v, 10), s: `${v}` }; });
add('그날 사건 사망 D2·D4·D5 (조심형 합산)', '날마다 > 0', (A) => { const o = dayEv(A, CARE.filter((k) => A[k])); return { ok: [2, 4, 5].every((d) => (o[d] || 0) > 0), near: false, s: [2, 4, 5].map((d) => o[d] || 0).join('·') }; });
add('  D3·D6 그날 사건 사망 (조심형 합산, 괄호 = 균형만)', '측정', (A) => { const o = dayEv(A, CARE.filter((k) => A[k])), b = A.balanced.dayEvent || {}; return { ok: true, near: false, s: `${o[3] || 0}·${o[6] || 0} (${b[3] || 0}·${b[6] || 0})` }; }, { meas: 1 });
add('균형 사망 중 한 사건 비중 — 사인', '≤ 40%', (A) => { const t = A.balanced.topCause; return { ok: t.share <= 40, near: near(t.share, 40), s: `${t.k.replace(/_night$|_you$/, '')} ${t.share}` }; });
add('균형 사망 중 한 사건 비중 — 원인(부상 출처)', '≤ 40%', (A) => { const t = A.balanced.topRoot; return { ok: t.share <= 40, near: near(t.share, 40), s: `${t.k.replace(/_night$|_you$/, '')} ${t.share}` }; });
for (const p of ['selfish_nb', 'selfish_rt0', 'selfish', 'selfish_rt']) add(`이기심의 값: ${p} 열흘 생존 − 균형${B.GROUPS.selfishPlain.includes(p) ? '' : ' (표 줄은 참고)'}`, '< 0', (A) => { const v = diff(A, p, 'balanced', 'survived'); return { ok: v != null && v < 0, near: near(v, 0), s: sgn(v) }; });
add('이른 안전: D1~D4 생존 − 균형 (selfish_nb · selfish_rt0)', '≥ +5%p', (A) => { const vs = B.GROUPS.selfishPlain.map((p) => diff(A, p, 'balanced', 'aliveD4')); return { ok: vs.every((v) => v != null && v >= 5), near: vs.some((v) => near(v, 5)), s: vs.map(sgn).join('·') }; });
add('  참고: 이른 안전 selfish · selfish_rt', '측정', (A) => ({ ok: true, near: false, s: B.GROUPS.selfishQuirk.map((p) => sgn(diff(A, p, 'balanced', 'aliveD4'))).join('·') }), { meas: 1 });
add('이기적 사인 쏠림 (버릇 없는 둘, 사망 ≥ 10% 만)', '≤ 60%', (A) => { const xs = B.GROUPS.selfishPlain.map((p) => [p, A[p].deaths ? A[p].topCause : { k: '-', share: 0 }, A[p].deathRate >= S.SIGN_MIN_RATE]); const j = xs.filter((x) => x[2]); return { ok: j.every((x) => x[1].share <= 60), near: !j.length || j.some((x) => near(x[1].share, 60)), s: xs.map((x) => `${x[1].k} ${x[1].share}`).join(' · ') }; });
add('아슬함: selfish_nb 줄타기 넘김/판 (열흘 산 판)', '≥ 2', (A) => { const a = A.selfish_nb; const v = a.survN ? a.ropeCloseSurv : null; return { ok: fin(v) && v >= 2, near: false, s: fin(v) ? `${v}` : '-' }; });
add('아슬함: selfish_nb 산 판 중 줄타기 ≥ 2번 넘김', '≥ 60%', (A) => { const a = A.selfish_nb; const v = a.survN ? a.ropeClose2 : null; return { ok: fin(v) && v >= 60, near: near(v, 60), s: fin(v) ? `${v}` : '-' }; });
add('  죽음 판정 넘김/판, 산 판 (균형 · 게으름 · selfish_nb)', '측정', (A) => ({ ok: true, near: false, s: ['balanced', 'lazy', 'selfish_nb'].map((p) => (A[p] && fin(A[p].closeCallsSurv) ? A[p].closeCallsSurv : '-')).join(' · ') }), { meas: 1 });
add('  줄타기 굴림/판 · 줄타기 사망 판 (selfish_nb)', '측정', (A) => ({ ok: true, near: false, s: fin(A.selfish_nb.ropeRolls) ? `${A.selfish_nb.ropeRolls} · ${A.selfish_nb.ropeDeaths}` : '-' }), { meas: 1 });
add('조심형 봇 사망 (' + CARE.join('·') + ')', '측정', (A) => { const c = CARE.filter((k) => A[k]); const n = c.reduce((t, k) => t + A[k].n, 0), d = c.reduce((t, k) => t + A[k].deaths, 0); return { ok: true, near: false, s: `${S.pct(d, n)}` }; }, { meas: 1 });
add('조심형 사람 흉내 사망: h_cautious · h_first', '측정 (설계: 0 은 아니게)', (A) => { const vs = ['h_cautious', 'h_first'].map((p) => A[p].deathRate); return { ok: vs.every((v) => v > 0), near: false, s: vs.join(' · ') }; });
add('  사람 흉내 사망: h_cautious2 · h_mixed · h_wary · h_random', '측정', (A) => ({ ok: true, near: false, s: ['h_cautious2', 'h_mixed', 'h_wary', 'h_random'].map((p) => A[p].deathRate).join(' · ') }), { meas: 1 });
add('봇 버릇 점검 (조심형이 평범한 대안을 두고 죽음 글로 죽음)', '0 판', (A) => { const v = CARE.filter((k) => A[k]).reduce((t, k) => t + (A[k].deadlyPick || 0), 0); return { ok: v === 0, near: false, s: `${v}` }; });
add('A4 보통 − 게으름 생존 (주 지표)', '≥ +5%p (설계: 모든 블록 > 0)', (A) => { const v = diff(A, 'balanced', 'lazy', 'survived'); return { ok: v != null && v >= 5, near: near(v, 5), s: sgn(v), pos: v != null && v > 0 }; }, { a4: 1 });
add('A4 부지런 − 게으름 생존', '≥ +5%p (표 줄은 위와 한 줄)', (A) => { const v = diff(A, 'diligent', 'lazy', 'survived'); return { ok: v != null && v >= 5, near: near(v, 5), s: sgn(v), pos: v != null && v > 0 }; }, { a4: 1 });
add('A4 D9 아침 주민 차 (보통 · 부지런 − 게으름)', '> 0', (A) => { const vs = [diff(A, 'balanced', 'lazy', 'home9'), diff(A, 'diligent', 'lazy', 'home9')]; return { ok: vs.every((v) => v != null && v > 0), near: false, s: vs.map((v) => (v == null ? '-' : (v > 0 ? '+' : '') + r2(v))).join(' · ') }; }, { a4: 1 });
add('A4 D7 아침 식량+물+약 차 (보통 · 부지런 − 게으름)', '≥ +0.2', (A) => { const vs = [diff(A, 'balanced', 'lazy', 'res7'), diff(A, 'diligent', 'lazy', 'res7')]; return { ok: vs.every((v) => v != null && v >= 0.2), near: false, s: vs.map((v) => (v == null ? '-' : (v > 0 ? '+' : '') + r2(v))).join(' · ') }; }, { a4: 1 });
add('  A4 실제 발견율 % (게으름 · 보통 · 부지런)', '측정', (A) => ({ ok: true, near: false, s: ['lazy', 'balanced', 'diligent'].map((p) => (fin(A[p].discReal) && A[p].privNights != null ? A[p].discReal : '-')).join(' · ') }), { a4: 1, meas: 1 });
add('  A4 눈먼 새벽/판 (괄호 = 그 죽음 판) — 게으름 · 보통 · 부지런', '측정', (A) => ({ ok: true, near: false, s: ['lazy', 'balanced', 'diligent'].map((p) => (fin(A[p].blindMet) ? `${A[p].blindMet}(${A[p].blindDeaths})` : '-')).join(' · ') }), { a4: 1, meas: 1 });
add('  A4 못 본 일/판 (게으름 · 보통 · 부지런)', '측정', (A) => ({ ok: true, near: false, s: ['lazy', 'balanced', 'diligent'].map((p) => A[p].neglect).join(' · ') }), { a4: 1, meas: 1 });
add('정체 성향 봇 평균: 가장 작은 · 가장 큰 후보', '≥ 3% · ≤ 40%', (A) => { const g = idG(A).P; return { ok: !!g && g.lo[1] >= 3 && g.hi[1] <= 40, near: !!g && (Math.abs(g.lo[1] - 3) <= 1.5 || near(g.hi[1], 40)), s: g ? `${g.lo[0]} ${g.lo[1]} · ${g.hi[0]} ${g.hi[1]}` : '-' }; });
add('정체 사람 흉내 평균: 가장 작은 · 가장 큰 후보 (D0 사망 뺌)', '각 ≥ 3% · 가장 큰 = 측정(승객 수용)', (A) => { const g = idG(A).H; return { ok: !!g && g.lo[1] >= 3, near: !!g && Math.abs(g.lo[1] - 3) <= 1.5, s: g ? `${g.lo[0]} ${g.lo[1]} · ${g.hi[0]} ${g.hi[1]}` : '-' }; });
add('열차 결말 (모험 / 균형)', '> 0%', (A) => ({ ok: A.risky.train > 0, near: false, s: `${A.risky.train} / ${A.balanced.train}` }));
add('모험 봇 열흘 생존', '≥ 25%', (A) => { const v = A.risky.survived; return { ok: v >= 25, near: near(v, 25), s: `${v}` }; });
add('explicit / 판 (균형)', '≥ 7', (A) => { const v = A.balanced.explicit; return { ok: v >= 7, near: false, s: `${v}` }; });
add('전멸 (균형)', '≤ 25%', (A) => { const v = A.balanced.allDead; return { ok: v <= 25, near: near(v, 25), s: `${v}` }; });
add('헌신 봇 생존', '측정 (> 0%)', (A) => { const v = A.devoted.survived; return { ok: v > 0, near: false, s: `${v}` }; });

const markOf = (rs) => { const okAll = rs.every((r) => r.ok), okAny = rs.some((r) => r.ok), nr = rs.some((r) => r.near); return okAll && !nr ? '✓' : !okAny ? '✗' : '△'; };
const blocksOf = (J, it) => (it.a4 && J.a4ByBlock && J.a4ByBlock.length ? J.a4ByBlock : J.byBlock);
const pooled = (J, it) => (it.a4 && J.a4All ? Object.assign({}, J.aggs, J.a4All) : J.aggs);
const safe = (f, A) => { try { return f(A); } catch (e) { return { ok: false, near: false, s: '-' }; } };
const lines = [];
lines.push(`| 항목 | 합격선 | 지금: 블록 ${MAIN.blocks.join(' / ')} (A4 줄은 블록 ${MAIN.a4Blocks.join('·')}) | 합산 | 판정 | 새 블록 ${NB.blocks[0]} | 5블록 판정 (A4 9블록) | 10-26 합산 [판정] | 10-27 커밋본 합산 [판정] |`);
lines.push('|---|---|---|---|---|---|---|---|---|');
const notes = [];
for (const it of I) {
  const bs = blocksOf(MAIN, it).map((A) => safe(it.f, A));
  const nb = safe(it.f, NB.byBlock[0]);
  const pool = safe(it.f, pooled(MAIN, it));
  const m4 = it.meas ? '측정' : markOf(bs), m1 = it.meas ? '측정' : markOf([nb]), m5 = it.meas ? '측정' : markOf(bs.concat([nb]));
  const old = (J) => { const p = safe(it.f, pooled(J, it)); const ob = blocksOf(J, it).map((A) => safe(it.f, A)); return `${p.s}${it.meas ? '' : ` [${markOf(ob)}]`}`; };
  let extra = '';
  if (it.a4) { const pos = bs.concat([nb]).filter((r) => r.pos === false).length; if (bs[0].pos !== undefined) extra = ` (≤ 0 인 블록 ${pos}/${bs.length + 1})`; }
  lines.push(`| ${it.k} | ${it.want} | ${it.meas && it.a4 ? '(블록별은 run.js §2 표)' : bs.map((r) => r.s).join(' / ')} | ${pool.s} | ${m4} | ${nb.s} (${m1}) | ${m5}${extra} | ${old(P26)} | ${old(P27)} |`);
}
// 정책별 생존: 지금 4블록 합산 · 블록 범위 · 새 블록 · 10-26 · 10-27 커밋본
const pol = [];
pol.push(`| 정책 | 지금 4블록 합산 생존% | 블록별 | 새 블록 ${NB.blocks[0]} | 10-26 | 10-27 커밋본 | 지금 사망% · D5까지 사망% · 카르마(끝) |`);
pol.push('|---|---|---|---|---|---|---|');
for (const p of Object.keys(MAIN.aggs)) {
  const a = MAIN.aggs[p];
  pol.push(`| ${p} | ${a.survived} | ${MAIN.byBlock.map((A) => A[p].survived).join(' / ')} | ${NB.aggs[p] ? NB.aggs[p].survived : '-'} | ${P26.aggs[p] ? P26.aggs[p].survived : '-'} | ${P27.aggs[p] ? P27.aggs[p].survived : '-'} | ${a.deathRate} · ${a.deadByD5} · ${a.karma} |`);
}
const a4 = [];
if (MAIN.a4All) {
  a4.push(`| A4 정책 (블록 ${MAIN.a4Blocks.length}개 합산) | 생존% | 블록별 생존% | 새 블록 ${NB.blocks[0]} | 10-27 커밋본 (8블록) |`);
  a4.push('|---|---|---|---|---|');
  for (const p of B.GROUPS.a4) a4.push(`| ${p} | ${MAIN.a4All[p].survived} | ${MAIN.a4ByBlock.map((A) => A[p].survived).join(' / ')} | ${NB.aggs[p].survived} | ${P27.a4All ? P27.a4All[p].survived : '-'} |`);
}
// 사인·원인 1위 (새 블록 포함 비교용)
const cz = [];
for (const p of ['balanced', 'selfish_nb', 'selfish_rt0', 'selfish', 'selfish_rt', 'lazy', 'h_cautious', 'h_first']) {
  const top3 = (o, n) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${S.pct(v, n)}%`).join(' · ');
  cz.push(`- ${p}: 사인 ${top3(MAIN.aggs[p].byCause, MAIN.aggs[p].deaths)} | 원인 ${top3(MAIN.aggs[p].byRoot, MAIN.aggs[p].deaths)} | 새 블록 사인 ${top3(NB.aggs[p].byCause, NB.aggs[p].deaths)}`);
}
console.log('## 합격선 요약\n' + lines.join('\n') + '\n\n## 정책별 생존\n' + pol.join('\n') + '\n\n## A4\n' + a4.join('\n') + '\n\n## 사인\n' + cz.join('\n'));
// 공식 판정(stats.gate + combine)과 같은 줄을 맞춰 본다 — 이 정리의 판정 규칙이 run.js 와 같은지 확인
const g4 = S.combine(MAIN.byBlock.map((A) => S.gate(A, candIds, CARE)));
const ga4 = S.combine(MAIN.a4ByBlock.map((A) => S.gate(A, candIds, CARE)));
const pick = (G, pre) => (G.find((r) => r.k.startsWith(pre)) || {}).mark;
const chk = [['균형 사망 (올라감 포함)', pick(g4, '당신 사망')], ['강제 사망 = 확정 사망 (전 정책)', pick(g4, '강제 사망 =')], ['경고 없는 사망 (전 정책)', pick(g4, '경고 없는 사망')], ['균형 D5까지 사망', pick(g4, 'A2 D5까지')], ['그날 사건 사망 D2·D4·D5 (조심형 합산)', pick(g4, 'A2 D2·D4·D5')], ['균형 사망 중 한 사건 비중 — 사인', pick(g4, 'A2 균형 사망 중 한 사건 비중 (사인')], ['균형 사망 중 한 사건 비중 — 원인(부상 출처)', pick(g4, 'A2 균형 사망 중 한 사건 비중 (원인')], ['이른 안전: D1~D4 생존 − 균형 (selfish_nb · selfish_rt0)', pick(g4, 'A1 이른 안전')], ['이기적 사인 쏠림 (버릇 없는 둘, 사망 ≥ 10% 만)', pick(g4, 'A1 이기적 사인 쏠림')], ['아슬함: selfish_nb 줄타기 넘김/판 (열흘 산 판)', pick(g4, 'A1 아슬함: 줄타기')], ['아슬함: selfish_nb 산 판 중 줄타기 ≥ 2번 넘김', pick(g4, 'A1 아슬함: 산 판')], ['봇 버릇 점검 (조심형이 평범한 대안을 두고 죽음 글로 죽음)', pick(g4, '  봇 버릇 점검')], ['A4 D9 아침 주민 차 (보통 · 부지런 − 게으름)', pick(ga4, 'A4 게으름의 값 — D9')], ['A4 D7 아침 식량+물+약 차 (보통 · 부지런 − 게으름)', pick(ga4, 'A4 게으름의 값 — D7')], ['열차 결말 (모험 / 균형)', pick(g4, '열차 결말')], ['모험 봇 열흘 생존', pick(g4, '모험 봇 열흘 생존')], ['explicit / 판 (균형)', pick(g4, 'explicit')], ['전멸 (균형)', pick(g4, '전멸')]];
const mine = Object.fromEntries(I.map((it) => [it.k, markOf(blocksOf(MAIN, it).map((A) => safe(it.f, A)))]));
const bad = chk.filter(([k, m]) => mine[k] !== m);
console.log('\n## 판정 맞춤 (이 정리 vs stats.gate+combine): ' + (bad.length ? '다름 ' + bad.map(([k, m]) => `${k}: 정리 ${mine[k]} / gate ${m}`).join(' ; ') : `같음 ${chk.length}줄`));
const sel = [pick(g4, 'A1 이기심의 값'), pick(ga4, 'A4 게으름의 값 — 생존')];
console.log(`gate 묶음 줄: 이기심의 값(nb·rt0) ${sel[0]} · A4 생존(보통·부지런 한 줄, 8블록) ${sel[1]}`);
