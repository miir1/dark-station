// verify_A4 — 못 본 밤(missed)이 남긴 흔적이 다음 아침 화면에 '늦은 흔적(late)'으로 남아 있는가 (v4 파일은 읽기만)
// node latevis.js <정책> <블록들> <판수> <출력.json>
// 아침(trace 단계)에 들어설 때마다: 어젯밤 적용된 ~missed 줄의 흔적들이 지금도 late=1 인가, 같은 밤의 다른 밤 사건이 그 흔적을 덮어 late=0 이 됐나.
// 덮은 사건 id 도 센다. 그리고 그 아침 화면에 먼지(late·어제 날짜·안 봄)가 하나라도 있나 = 토스트가 뜰 수 있는 아침인가.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
B.INSPECT.zero = { objects: 0, talk: 0, rumors: 0 };
B.POLICIES.b_zero = Object.assign({}, B.POLICIES.balanced, { inspect: 'zero' });
const [pol, blocksArg, nArg, out] = process.argv.slice(2);
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const agg = { mornings: 0, missedRows: 0, missedWithTrace: 0, traceSlots: 0, stillLate: 0, overwritten: 0, overwrittenBy: {}, byEvent: {}, morningsWithLate: 0, morningsAfterMissed: 0, morningsAfterMissedNoLate: 0 };
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  const dayBefore = s.day;
  const r = orig.call(this, s, a, d);
  if (a.type === 'next' && r.ok && s.phase === 'trace' && s.day === dayBefore + 1 && !s.ended) {
    agg.mornings++;
    const prev = s.day - 1;
    const rows = s.nightLog.filter((e) => e.day === prev && e.role === 'neglect' && /~missed$/.test(e.id));
    if (rows.length) agg.morningsAfterMissed++;
    let anyLate = false;
    for (const [id, t] of Object.entries(s.traces)) if (t && t.late && t.day === prev && !t.seen) anyLate = true;
    if (anyLate) agg.morningsWithLate++;
    if (rows.length && !anyLate) agg.morningsAfterMissedNoLate++;
    for (const e of rows) {
      agg.missedRows++;
      const ev = e.id.replace(/~missed$/, '');
      const b = (agg.byEvent[ev] = agg.byEvent[ev] || { rows: 0, slots: 0, late: 0, over: 0, noTrace: 0 });
      b.rows++;
      if (!e.traces.length) { b.noTrace++; continue; }
      agg.missedWithTrace++;
      for (const id of e.traces) {
        agg.traceSlots++; b.slots++;
        const t = s.traces[id];
        if (t && t.late) { agg.stillLate++; b.late++; continue; }
        agg.overwritten++; b.over++;
        // 누가 덮었나: 같은 밤(prev)에 enact 된 주민 사건 가운데 그 흔적을 가진 줄
        const by = s.nightLog.filter((x) => x.day === prev && x.role !== 'neglect' && x.traces.includes(id)).map((x) => x.id);
        const k = `${ev}→${by.join('+') || '(다른 것: 아침 지움 등)'} [${id.replace(/_(soonrye|seoha|gicheol|eunji|dongha|mari|you)$/, '_*')}]`;
        agg.overwrittenBy[k] = (agg.overwrittenBy[k] || 0) + 1;
      }
    }
  }
  return r;
};
for (const b0 of blocksArg.split(',').map(Number)) for (let seed = b0; seed < b0 + +nArg; seed++) B.play(db, seed, pol);
fs.writeFileSync(out, JSON.stringify(agg, null, 1));
console.log(pol, JSON.stringify({ missedRows: agg.missedRows, traceSlots: agg.traceSlots, stillLate: agg.stillLate, overwritten: agg.overwritten, morningsAfterMissed: agg.morningsAfterMissed, morningsAfterMissedNoLate: agg.morningsAfterMissedNoLate }));
