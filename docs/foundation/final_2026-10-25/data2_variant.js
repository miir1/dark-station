// read-only: node data2_variant.js <dataDir> <policy> [blocks] — 그 표로 run.js 와 같은 봇·같은 5블록(200판씩)을 돌려 한 줄 JSON
// (qa_numbers_variant.js 와 같은 집계를, 메모리 변형 대신 data_apply.js 로 만든 표 폴더에서)
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const [dir, pol, blk] = process.argv.slice(2);
const blocks = (blk || '1,1001,2001,3001,8001').split(',').map(Number);
const db = T.loadDir(dir);
const runs = [], perBlock = [];
for (const b0 of blocks) {
  const br = [];
  for (let seed = b0; seed < b0 + 200; seed++) { const { s, trace } = play(db, seed, pol); const m = S.measure(db, s, trace); runs.push(m); br.push(m); }
  perBlock.push(S.aggregate(db, br).survived);
}
const a = S.aggregate(db, runs);
// 사본(_r2…·_d3·_d6)을 원래 id 로 합친 사인·원인 사건 (stats.js 는 id 그대로 센다 — 사다리 사본이 나뉘어 보이지 않게)
const mergeIds = (o) => { const m = {}; for (const [k, v] of Object.entries(o || {})) { const b = k.replace(/_(r\d|d[36])$/, ''); m[b] = (m[b] || 0) + v; } return m; };
const topOf = (m, n) => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(' · ');
const mc = mergeIds(a.byCause), mr = mergeIds(a.byRoot);
const share = (m) => { const e = Object.entries(m).sort((x, y) => y[1] - x[1])[0]; return e && a.deaths ? `${e[0]} ${Math.round(1000 * e[1] / a.deaths) / 10}%` : '-'; };
const starve = runs.filter((r) => r.dead && r.cause && /^starve_you(_r\d)?$/.test(r.cause.event)).length;
console.log(JSON.stringify({ dir: path.basename(dir), pol, survived: a.survived, perBlock, aliveD4: a.aliveD4, deadByD5: a.deadByD5, dayEvent: a.dayEvent, karma: a.karma, ropeFelt2: a.ropeFelt2, ropeFeltSurv: a.ropeFeltSurv, identity: a.identity,
  topCauseMerged: share(mc), topRootMerged: share(mr), starveShareMerged: a.deaths ? Math.round(1000 * starve / a.deaths) / 10 : 0, causes: topOf(mc, 6), roots: topOf(mr, 6) }));
