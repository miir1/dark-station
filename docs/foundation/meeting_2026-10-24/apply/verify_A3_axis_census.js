// verify_A3: 축 효과 전수 비교 (before_data ↔ v4/data). 읽기만 한다.
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const load = (p) => { const j = require(p); return Array.isArray(j) ? j : (j.events || j.rows || Object.values(j)); };
const now = load(path.join(root, 'v4/data/events.json'));
const bef = load(path.join(__dirname, 'data_apply/before_data/events.json'));
function axes(list) {
  const out = {};
  const walk = (o, at) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, at)); return; }
    if (o.verb === 'axis') { (out[at] = out[at] || []).push(`${o.id}${o.n > 0 ? '+' : ''}${o.n}`); return; }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'choices' && Array.isArray(v)) v.forEach((c, i) => walk(c, `${at}#${i}:${c.label}`));
      else if (['ok', 'fail', 'out', 'swap', 'effects', 'then'].includes(k) || Array.isArray(v) || typeof v === 'object') walk(v, `${at}${['ok', 'fail', 'out', 'swap'].includes(k) ? '.' + k : ''}`);
    }
  };
  for (const e of list) walk(e, e.id);
  for (const k of Object.keys(out)) out[k] = out[k].sort().join(',');
  return out;
}
const A = axes(bef), B = axes(now);
const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
const changed = [], added = [], removed = [];
const befIds = new Set(bef.map((e) => e.id));
for (const k of keys) {
  if (A[k] === B[k]) continue;
  const ev = k.split('#')[0].split('.')[0];
  if (A[k] == null) (befIds.has(ev) ? changed : added).push(`${k}: (없음) → ${B[k]}`);
  else if (B[k] == null) (now.some((e) => e.id === ev) ? changed : removed).push(`${k}: ${A[k]} → (없음)`);
  else changed.push(`${k}: ${A[k]} → ${B[k]}`);
}
console.log('events before', bef.length, 'now', now.length);
console.log('axis-bearing paths before', Object.keys(A).length, 'now', Object.keys(B).length);
console.log('\n[기존 사건의 축 효과가 바뀐 곳]'); changed.forEach((x) => console.log(' ', x));
console.log('\n[새 사건의 축 효과]'); added.forEach((x) => console.log(' ', x));
console.log('\n[사라진 사건의 축 효과]'); removed.forEach((x) => console.log(' ', x));
