// 읽기 전용: 축(share/name/hand)을 주는 선택지 목록 — 경고(warn/hint/taboo) 여부·판정·비용과 함께
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const db = T.loadDir(path.join(ROOT, process.argv[2] || 'v4/data'));
const want = process.argv[3] || '';
for (const ev of db.eventsList) ev.choices.forEach((c, i) => {
  for (const [r, o] of [['out', c.out], ['ok', c.ok], ['fail', c.fail]]) {
    if (!o || !o.effects || !o.effects.axis) continue;
    const ax = o.effects.axis; const s = Object.entries(ax).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(',');
    if (want && !want.split(',').every((w) => { const m = /^(\w+)([+-])$/.exec(w); return m && (m[2] === '+' ? (ax[m[1]] || 0) > 0 : (ax[m[1]] || 0) < 0); })) continue;
    console.log(`${ev.id}#${i} '${c.label}'.${r} ${s} | warn=${c.warn || ''}${c.hint ? ' hint=' + c.hint : ''}${c.taboo ? ' TABOO' : ''} cost=${JSON.stringify(c.cost || {})} chk=${c.check ? c.check.skill + c.check.base : ''} | when=${ev.when}`);
  }
});
