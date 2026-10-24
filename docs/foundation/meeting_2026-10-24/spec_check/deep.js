// 깊은 비교: node deep.js <기준.json> <시제품.json> [정책]
const fs = require('fs');
const [fa, fb, pol0] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
const pols = pol0 ? [pol0] : Object.keys(B.pols).filter((p) => A.pols[p]);
const per = (runs, f) => runs.reduce((a, r) => a + f(r), 0) / (runs.length || 1);
for (const pol of pols) {
  const a = A.pols[pol] || [], b = B.pols[pol];
  console.log(`\n### ${pol}  (기준 ${a.length}판 / 시제품 ${b.length}판)`);
  // 밤 행 빈도 (판당)
  const ids = new Set(); for (const r of a.concat(b)) for (const k of Object.keys(r.night)) ids.add(k);
  const rows = [...ids].map((k) => [k, per(a, (r) => r.night[k] || 0), per(b, (r) => r.night[k] || 0)]).filter(([, x, y]) => x >= 0.05 || y >= 0.05).sort((p, q) => Math.abs(q[2] - q[1]) - Math.abs(p[2] - p[1]));
  console.log('밤 행 판당 (기준 → 시제품, 차이 큰 순):');
  for (const [k, x, y] of rows.slice(0, 26)) console.log(`  ${k.padEnd(26)} ${x.toFixed(2)} → ${y.toFixed(2)}`);
  const resident = (r) => Object.entries(r.night).filter(([k]) => !/~/.test(k)).reduce((s, [, v]) => s + v, 0);
  console.log(`  (모든 밤 행 합 판당 ${per(a, resident).toFixed(2)} → ${per(b, resident).toFixed(2)} · 당신 대상 밤이 있던 날 수 ${per(a, (r) => r.youSlot).toFixed(2)} → ${per(b, (r) => r.youSlot).toFixed(2)} · 굴린 밤 ${per(a, (r) => r.nights).toFixed(2)} → ${per(b, (r) => r.nights).toFixed(2)})`);
  // 새·바뀐 사건의 선택 (판당 횟수) 와 그 선택으로 죽은 판
  const WATCH = /^(d2_night_shutter|d2_shutter_arm|trial_d4_gicheol|d4_spanner|d5_flood|d6_shutter|d6_shutter_b|dawn_mob|dawn_strike|called_up|d10_hold|d10_walk_weak|fever_night)\|/;
  const picks = {}; const died = {};
  for (const r of b) { for (const [k, v] of Object.entries(r.picks)) if (WATCH.test(k)) picks[k] = (picks[k] || 0) + v; if (r.diedAt && WATCH.test(r.diedAt)) died[r.diedAt] = (died[r.diedAt] || 0) + 1; }
  console.log('시제품 선택 (전체 횟수 / 그 선택으로 죽은 판):');
  for (const k of Object.keys(picks).sort()) console.log(`  ${k.padEnd(40)} ${String(picks[k]).padStart(5)} / ${died[k] || 0}`);
  // 정체 분포
  const idd = (runs) => { const o = {}; for (const r of runs) if (r.identity) o[r.identity] = (o[r.identity] || 0) + 1; return Object.entries(o).sort().map(([k, v]) => `${k} ${(100 * v / runs.length).toFixed(1)}`).join(' · '); };
  console.log('정체 기준: ' + idd(a)); console.log('정체 시제품: ' + idd(b));
}
