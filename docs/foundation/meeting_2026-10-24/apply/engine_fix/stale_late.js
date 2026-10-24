// engine_fix (10-24 검증 A4-6): 봇 판에서 조사할 때 '_late' 글이 나오는 경우를 센다 — 옛 규칙(late 만 봄)과 새 규칙(lateNow = 어젯밤 것만)
// node docs/foundation/meeting_2026-10-24/apply/engine_fix/stale_late.js <정책> <블록들> <판수>
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const [pol, blocksArg, nArg] = process.argv.slice(2);
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const c = { inspects: 0, lateLineNew: 0, lateLineOld: 0, staleOld: 0, staleNew: 0, staleDays: {} };
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  if (a && a.type === 'inspect' && s.traces[a.object]) {
    const t = s.traces[a.object]; const o = d.objects[a.object];
    const id = o && o.inspectLine ? o.inspectLine[t.st] : null;
    if (id) {
      c.inspects++;
      const hasLate = !!d.lines[id + '_late'];
      const oldLate = !!(t.late && hasLate);
      const newLine = E.inspectLineId(s, d, a.object);
      if (oldLate) c.lateLineOld++;
      if (newLine && newLine.endsWith('_late')) c.lateLineNew++;
      if (oldLate && t.day !== s.day - 1) { c.staleOld++; const k = s.day - t.day; c.staleDays[k] = (c.staleDays[k] || 0) + 1; }
      if (newLine && newLine.endsWith('_late') && t.day !== s.day - 1) c.staleNew++;
    }
  }
  return orig.call(this, s, a, d);
};
for (const b0 of blocksArg.split(',').map(Number)) for (let seed = b0; seed < b0 + +nArg; seed++) B.play(db, seed, pol);
console.log(pol, JSON.stringify(c));
