// verify_A4 — 시뮬 봇이 밤 사건을 알아챈 경로를 물건별로 센다. 화면에서 서서 조사할 수 없는 물건(probe_reach.py·dbg_office.py 실측)으로 알아챈 몫
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const NIGHT = require(path.join(ROOT, 'v4/engine/night.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const UNREACH = new Set(['crate_food', 'parts_crate', 'bottle_seoha', 'bandage_seoha']);
const pol = process.argv[2] || 'balanced';
const hasMissed = new Set(db.nightEvents.filter((n) => n.missed).map((n) => n.id));
let cur = null;
const oI = NIGHT.markInspected, oH = NIGHT.markHeard;
const und = (s) => s.nightLog.filter((e) => !e.discovered && NIGHT.isResidentRow(e) && hasMissed.has(e.id)).map((e) => e);
NIGHT.markInspected = function (s, id) { const b = und(s); oI.call(this, s, id); const got = b.filter((e) => e.discovered); for (const e of got) { const k = (UNREACH.has(id) ? '못 가는 ' : '') + id.replace(/_(soonrye|gicheol|eunji|dongha|mari)$/, '_*'); cur[k] = (cur[k] || 0) + 1; cur.__ev = cur.__ev || {}; if (UNREACH.has(id)) cur.__ev[e.id] = (cur.__ev[e.id] || 0) + 1; } };
NIGHT.markHeard = function (s, r) { const b = und(s); oH.call(this, s, r); const got = b.filter((e) => e.discovered).length; if (got) cur['소문'] = (cur['소문'] || 0) + got; };
const tot = {}, evs = {}; let n = 0, rows = 0, missed = 0;
for (const b0 of [1, 1001, 2001, 3001]) for (let seed = b0; seed < b0 + 200; seed++) {
  cur = {};
  const { s } = B.play(db, seed, pol); n++;
  rows += s.nightLog.filter((e) => NIGHT.isResidentRow(e) && hasMissed.has(e.id)).length;
  missed += s.stats.neglect || 0;
  for (const [k, v] of Object.entries(cur)) if (k !== '__ev') tot[k] = (tot[k] || 0) + v;
  for (const [k, v] of Object.entries(cur.__ev || {})) evs[k] = (evs[k] || 0) + v;
}
const caught = Object.values(tot).reduce((a, b) => a + b, 0), un = Object.entries(tot).filter(([k]) => k.startsWith('못 가는')).reduce((a, [, v]) => a + v, 0);
console.log(`${pol}: 판 ${n} · missed 있는 밤 줄 ${rows} (판당 ${(rows / n).toFixed(2)}) · 알아챔 ${caught} · 그중 화면에서 못 가는 물건으로 ${un} (${(100 * un / caught).toFixed(1)}%, 판당 ${(un / n).toFixed(2)}) · missed 적용 판당 ${(missed / n).toFixed(2)}`);
console.log('  경로:', Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('  못 가는 물건으로 알아챈 사건:', JSON.stringify(evs));
