// 데이터 담당 (10-25) — 손잡이 시험 비교: 지금 값(검증 부장의 run.js --json 셋) vs 변형(run.js --inject … --json) 을 같은 시드 블록끼리 맞춰 본다.
// node compare.js <변형.json> [이름] — 지금 값은 verify_numbers_default/newseed/extra8.json (같은 엔진·데이터로 블록 1 을 다시 돌려 같음을 확인: check_base_b1.json)
const fs = require('fs');
const path = require('path');
const T = path.resolve(__dirname, '..');
const r1 = (v) => Math.round(10 * v) / 10;
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// 블록 시작 → { 정책: 집계 } (기본 블록 + A4 블록)
function index(files) {
  const by = {};
  for (const f of files) {
    const j = load(f);
    j.blocks.forEach((b0, i) => { by[b0] = Object.assign(by[b0] || {}, j.byBlock[i]); });
    (j.a4Blocks || []).forEach((b0, i) => { if (j.a4ByBlock && j.a4ByBlock[i]) by[b0] = Object.assign({}, j.a4ByBlock[i], by[b0] || {}); });
  }
  return by;
}
const baseArg = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7);
const base = index(baseArg ? baseArg.split(',').map((f) => path.resolve(f)) : ['verify_numbers_default.json', 'verify_numbers_newseed.json', 'verify_numbers_extra8.json'].map((f) => path.join(T, f)));
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const vfs = pos[0].split(',');
const vf = vfs[0];
const vname = pos[1] || path.basename(vf, '.json');
const vj = load(vf);
const vari = index(vfs);
const blocks = [...new Set(vfs.flatMap((f) => load(f).blocks))].filter((b) => base[b]);
const has = (by, b, p) => by[b] && by[b][p];
const pooled = (by, p, k, bs) => { const rows = bs.filter((b) => has(by, b, p)); const n = rows.reduce((t, b) => t + by[b][p].n, 0); return n ? rows.reduce((t, b) => t + by[b][p][k] * by[b][p].n, 0) / n : NaN; };
const out = [];
out.push(`# 손잡이 시험 비교 — ${vname} (블록 ${blocks.length}개: ${blocks.join(',')})`);
out.push('');
out.push('| 정책 | 지금 생존% (블록 합산) | 변형 생존% | 차 | 변형 블록별 |');
out.push('|---|---|---|---|---|');
const pols = Object.keys(vari[blocks[0]]);
for (const p of pols) {
  const bs = blocks.filter((b) => has(base, b, p) && has(vari, b, p));
  if (!bs.length) continue;
  const a = pooled(base, p, 'survived', bs), v = pooled(vari, p, 'survived', bs);
  out.push(`| ${p} | ${r1(a)} (${bs.length}블록) | ${r1(v)} | ${r1(v - a) > 0 ? '+' : ''}${r1(v - a)} | ${bs.map((b) => vari[b][p].survived).join(' / ')} |`);
}
out.push('');
const diffLine = (by, hi, lo, bs) => bs.map((b) => r1(by[b][hi].survived - by[b][lo].survived));
const stat = (d) => `합산 평균 ${r1(d.reduce((a, b) => a + b, 0) / d.length)} · < 0 블록 ${d.filter((x) => x < 0).length}/${d.length} · 최대 ${Math.max(...d)}`;
for (const [hi, lo, lab] of [['selfish_nb', 'balanced', 'A1 selfish_nb − 균형'], ['selfish', 'balanced', 'A1 selfish − 균형'], ['selfish_rt0', 'balanced', 'A1 selfish_rt0 − 균형']]) {
  const bs = blocks.filter((b) => has(base, b, hi) && has(base, b, lo) && has(vari, b, hi) && has(vari, b, lo));
  if (!bs.length) continue;
  const d0 = diffLine(base, hi, lo, bs), d1 = diffLine(vari, hi, lo, bs);
  out.push(`- ${lab} — 지금: ${d0.join(' · ')} (${stat(d0)})`);
  out.push(`  ${' '.repeat(lab.length)}   변형: ${d1.join(' · ')} (${stat(d1)})`);
}
for (const [hi, lab] of [['balanced', 'A4 보통 − 게으름'], ['diligent', 'A4 부지런 − 게으름']]) {
  const bs = blocks.filter((b) => has(base, b, hi) && has(base, b, 'lazy') && has(vari, b, hi) && has(vari, b, 'lazy'));
  if (!bs.length) continue;
  const d0 = diffLine(base, hi, 'lazy', bs), d1 = diffLine(vari, hi, 'lazy', bs);
  const s = (d) => `합산 평균 ${r1(d.reduce((a, b) => a + b, 0) / d.length)} · > 0 블록 ${d.filter((x) => x > 0).length}/${d.length} · ≥ 5 블록 ${d.filter((x) => x >= 5).length}/${d.length} · 최저 ${Math.min(...d)}`;
  out.push(`- ${lab} — 지금: ${d0.join(' · ')} (${s(d0)})`);
  out.push(`  ${' '.repeat(lab.length)}   변형: ${d1.join(' · ')} (${s(d1)})`);
}
if (blocks.every((b) => has(vari, b, 'risky'))) {
  const bs = blocks.filter((b) => has(base, b, 'risky'));
  out.push(`- 모험 생존 — 지금: ${bs.map((b) => base[b].risky.survived).join(' · ')} → ${r1(pooled(base, 'risky', 'survived', bs))} · 변형: ${bs.map((b) => vari[b].risky.survived).join(' · ')} → ${r1(pooled(vari, 'risky', 'survived', bs))} (블록 < 25: ${bs.filter((b) => vari[b].risky.survived < 25).length}/${bs.length})`);
}
if (blocks.every((b) => has(vari, b, 'balanced'))) {
  const bs = blocks;
  out.push(`- 균형 사망 — 지금 ${r1(pooled(base, 'balanced', 'deathRate', bs))} · 변형 ${r1(pooled(vari, 'balanced', 'deathRate', bs))} (최저 블록 ${Math.min(...bs.map((b) => vari[b].balanced.deathRate))})`);
  out.push(`- 균형 사인 1위 블록별 (변형): ${bs.map((b) => `${vari[b].balanced.topCause.k} ${vari[b].balanced.topCause.share}`).join(' · ')}`);
  out.push(`- 균형 원인 1위 블록별 (변형): ${bs.map((b) => `${vari[b].balanced.topRoot.k} ${vari[b].balanced.topRoot.share}`).join(' · ')}`);
}
if (blocks.every((b) => has(vari, b, 'selfish_nb'))) {
  out.push(`- 아슬함 selfish_nb 산 판 줄타기 넘김/판 (변형): ${blocks.map((b) => vari[b].selfish_nb.ropeCloseSurv).join(' · ')} · ≥2번% ${blocks.map((b) => vari[b].selfish_nb.ropeClose2).join(' · ')}`);
  const e0 = blocks.filter((b) => has(base, b, 'selfish_nb')).map((b) => r1(base[b].selfish_nb.aliveD4 != null ? base[b].selfish_nb.aliveD4 - base[b].balanced.aliveD4 : NaN));
  if (vari[blocks[0]].selfish_nb.aliveD4 != null) out.push(`- 이른 안전 selfish_nb D1~D4 생존 − 균형 (변형): ${blocks.map((b) => r1(vari[b].selfish_nb.aliveD4 - vari[b].balanced.aliveD4)).join(' · ')}`);
}
const fz = blocks.reduce((t, b) => t + Object.values(vari[b]).reduce((s, a) => s + (a.forced || 0), 0), 0);
const uw = blocks.reduce((t, b) => t + Object.values(vari[b]).reduce((s, a) => s + (a.unwarned || 0), 0), 0);
out.push(`- 확정 사망 · 경고 없는 사망 (변형, 돈 정책 전부): ${fz} · ${uw}`);
const txt = out.join('\n');
console.log(txt);
if (pos[2]) fs.writeFileSync(pos[2], txt + '\n', 'utf8');
