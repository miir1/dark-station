// verify_A4 — 시뮬 봇이 '화면에서 갈 수 없는' 창고 상자(역무실 안, 8,2)를 조사해 도둑질을 알아챈 횟수 vs 소문으로 알아챈 횟수
// (화면: office_door 가 solid 라 열려도 못 들어간다 — dbg_office.py · probe_reach.py)
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const NIGHT = require(path.join(ROOT, 'v4/engine/night.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const THEFT = /^(steal_food|steal_food_seoha|steal_food_again|steal_meds_again|take_back_you)$/;
const pol = process.argv[2] || 'balanced';
let cur = null;
const oI = NIGHT.markInspected, oH = NIGHT.markHeard;
NIGHT.markInspected = function (s, id) { const before = s.nightLog.filter((e) => !e.discovered && THEFT.test(e.id)).length; oI.call(this, s, id); const after = s.nightLog.filter((e) => !e.discovered && THEFT.test(e.id)).length; if (before > after) { const k = id + (s.traces.office_door && s.traces.office_door.st === 'open' ? ' (역무실 열림)' : ' (역무실 잠김)'); cur[k] = (cur[k] || 0) + (before - after); } };
NIGHT.markHeard = function (s, r) { const before = s.nightLog.filter((e) => !e.discovered && THEFT.test(e.id)).length; oH.call(this, s, r); const after = s.nightLog.filter((e) => !e.discovered && THEFT.test(e.id)).length; if (before > after) cur['소문'] = (cur['소문'] || 0) + (before - after); };
const tot = {}; let thefts = 0, n = 0;
for (const b0 of [1, 1001, 2001, 3001]) for (let seed = b0; seed < b0 + 200; seed++) {
  cur = {};
  const { s } = B.play(db, seed, pol); n++;
  thefts += s.nightLog.filter((e) => THEFT.test(e.id) && e.role !== 'neglect').length;
  for (const [k, v] of Object.entries(cur)) tot[k] = (tot[k] || 0) + v;
}
console.log(pol, '판', n, '도둑질 밤 줄', thefts, '알아챈 경로', JSON.stringify(tot));
