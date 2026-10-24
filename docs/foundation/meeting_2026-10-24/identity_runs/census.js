// 정체 축 전수 집계 (읽기 전용). node census.js [--root=<v4 폴더>]  → 표준 출력
// 사건 표의 선택지마다 축 효과(out·ok·fail), 경고(warn·hint·taboo) 유무, 비용, 판정을 세어
// "아무 성향 없이 안전해 보이는 쪽을 고르는 사람"이 어느 축으로 흘러가는지 본다.
const path = require('path');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROOT = arg('root', path.join('C:/dev/dark_station/v4'));
const T = require(path.join(ROOT, 'engine/tables.js'));
const db = T.loadDir(path.join(ROOT, 'data'));
const B = require(path.join(ROOT, 'sim/bots.js'));
const AX = db.identity.axes;
const ax = (o) => (o && o.effects && o.effects.axis) || {};
const warned = (c) => !!(c.warn || c.hint || c.taboo);
const costly = (c) => !!(c.cost && Object.keys(c.cost).length);
const chance = (c) => (c.check ? (c.check.base != null ? c.check.base : 50) / 100 : null);
// 선택지의 기대 축 이동: 판정이면 기본 확률로 ok/fail 가중
function expAxis(c) {
  const r = {};
  if (c.check) { const p = chance(c); for (const [k, v] of Object.entries(ax(c.ok))) r[k] = (r[k] || 0) + p * v; for (const [k, v] of Object.entries(ax(c.fail))) r[k] = (r[k] || 0) + (1 - p) * v; for (const [k, v] of Object.entries(ax(c.out))) r[k] = (r[k] || 0) + v; }
  else for (const [k, v] of Object.entries(ax(c.out))) r[k] = (r[k] || 0) + v;
  return r;
}
const cnt = {}; for (const a of AX) cnt[a] = { plusW: 0, plusU: 0, minusW: 0, minusU: 0 };
const evRows = []; let nAxisChoices = 0, nChoices = 0;
const drift = { safe: {}, uniform: {}, first: {} }; for (const k of Object.keys(drift)) for (const a of AX) drift[k][a] = 0;
const driftByKind = {};
for (const ev of db.eventsList) {
  const cs = ev.choices || [];
  nChoices += cs.length;
  const rows = cs.map((c, i) => ({ i, label: c.label, w: warned(c), cost: costly(c), taboo: !!c.taboo, deadly: B.deadlyText(c), check: !!c.check, e: expAxis(c), req: !!(c.req && Object.keys(c.req).length) }));
  const anyAxis = rows.some((r) => Object.values(r.e).some((v) => v));
  for (const r of rows) {
    if (Object.values(r.e).some((v) => v)) nAxisChoices++;
    for (const [k, v] of Object.entries(r.e)) { if (!cnt[k]) continue; if (v > 0) cnt[k][r.w ? 'plusW' : 'plusU']++; if (v < 0) cnt[k][r.w ? 'minusW' : 'minusU']++; }
  }
  if (!anyAxis) continue;
  // 안전해 보이는 쪽: 경고·비용·금기 없음 (없으면 경고는 있지만 죽음 글 없는 쪽)
  let safe = rows.filter((r) => !r.w && !r.cost && !r.req);
  if (!safe.length) safe = rows.filter((r) => !r.deadly && !r.taboo && !r.req);
  if (!safe.length) safe = rows;
  const avg = (set) => { const o = {}; for (const a of AX) o[a] = set.reduce((s, r) => s + (r.e[a] || 0), 0) / set.length; return o; };
  const sA = avg(safe), uA = avg(rows.filter((r) => !r.req).length ? rows.filter((r) => !r.req) : rows), fA = avg([rows.find((r) => !r.req) || rows[0]]);
  driftByKind[ev.kind] = driftByKind[ev.kind] || { n: 0, safe: Object.fromEntries(AX.map((a) => [a, 0])) };
  driftByKind[ev.kind].n++;
  for (const a of AX) { drift.safe[a] += sA[a]; drift.uniform[a] += uA[a]; drift.first[a] += fA[a]; driftByKind[ev.kind].safe[a] += sA[a]; }
  evRows.push({ id: ev.id, kind: ev.kind, when: ev.when, safe: sA, uni: uA, rows });
}
const f = (o) => AX.map((a) => `${a} ${(o[a] >= 0 ? '+' : '')}${o[a].toFixed(2)}`).join(' · ');
console.log(`# 정체 축 전수 집계 — root=${ROOT}`);
console.log(`사건 ${db.eventsList.length} · 선택지 ${nChoices} · 축을 움직이는 선택지 ${nAxisChoices} · 축이 걸린 사건 ${evRows.length}`);
console.log(`밤 사건 ${db.nightEvents.length}개 중 축 효과 ${db.nightEvents.filter((n) => n.effects && n.effects.axis).length}개. 배식(그릇)·치료·원정 행동은 축을 움직이지 않는다(engine.js ration/treat 에 axis 없음).`);
console.log(`문턱: ${JSON.stringify(db.raw.identity ? (require(path.join(ROOT, 'data/identity.json')).thresholds) : {})}`);
console.log('\n## 1. 축 · 방향별 선택지 수 (W = 경고·힌트·금기 있음, U = 경고 없음)');
console.log('| 축 | + 경고없음 | + 경고있음 | − 경고없음 | − 경고있음 |'); console.log('|---|---|---|---|---|');
for (const a of AX) console.log(`| ${a} | ${cnt[a].plusU} | ${cnt[a].plusW} | ${cnt[a].minusU} | ${cnt[a].minusW} |`);
console.log('\n## 2. 사건을 하나씩 다 본다고 칠 때 기대 축 이동 합 (판정은 기본 확률 가중)');
console.log(`- 안전해 보이는 쪽(경고·비용·조건 없음) 평균을 고르면: ${f(drift.safe)}`);
console.log(`- 열린 선택지 중 아무거나(고르게): ${f(drift.uniform)}`);
console.log(`- 맨 위 선택지만: ${f(drift.first)}`);
for (const [k, v] of Object.entries(driftByKind)) console.log(`  - kind=${k} (${v.n}사건) 안전 쪽: ${f(v.safe)}`);
console.log('\n## 3. 축이 걸린 사건 전부 — 안전 쪽 기대 이동이 0 이 아닌 것 먼저');
evRows.sort((x, y) => Math.abs(y.safe.hand) + Math.abs(y.safe.share) + Math.abs(y.safe.name) - (Math.abs(x.safe.hand) + Math.abs(x.safe.share) + Math.abs(x.safe.name)));
for (const r of evRows) {
  console.log(`\n### ${r.id} (${r.kind}) when: ${r.when}`);
  console.log(`안전 쪽 기대: ${f(r.safe)}  | 고르게: ${f(r.uni)}`);
  for (const c of r.rows) console.log(`  ${c.i}. ${c.label} ${c.w ? '[경고]' : ''}${c.cost ? '[비용]' : ''}${c.taboo ? '[금기]' : ''}${c.deadly ? '[죽음글]' : ''}${c.check ? '[판정]' : ''}${c.req ? '[조건]' : ''} → ${Object.entries(c.e).filter(([, v]) => v).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${+v.toFixed(2)}`).join(' ') || '축 없음'}`);
}
