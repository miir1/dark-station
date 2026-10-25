// read-only: node probe_axis.js <dataDir> <policy> — which choices move the hand axis, and final identity
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const dir = process.argv[2]; const pol = process.argv[3] || 'balanced';
const db = T.loadDir(dir);
const orig = E.dispatch;
const tally = {}; let cur = null;
E.dispatch = function (s, a, d) {
  let before = null, evId = null, label = null;
  if (a && a.type === 'choose' && s.pending) { before = Object.assign({}, s.axes); evId = s.pending.event || (s.pending.ev && s.pending.ev.id) || '?'; }
  const r = orig.apply(this, arguments);
  if (before && r && r.ok) {
    const lr = s.lastResult || {}; evId = lr.event || evId; label = lr.choice;
    for (const k of ['share', 'hand', 'name']) { const dlt = (s.axes[k] || 0) - (before[k] || 0); if (dlt) { const key = `${k}${dlt > 0 ? '+' : ''}${dlt} ${evId} | ${label}`; tally[key] = (tally[key] || 0) + 1; } }
  }
  return r;
};
const ids = {}; let n = 0; const ax = { share: 0, hand: 0, name: 0 };
for (const b0 of [1, 1001, 2001, 3001, 8001]) for (let seed = b0; seed < b0 + 200; seed++) {
  const { s } = play(db, seed, pol); n++;
  const id = s.ended ? s.ended.identity : 'none'; ids[id] = (ids[id] || 0) + 1;
  for (const k in ax) ax[k] += (s.axes[k] || 0);
}
console.log(pol, dir.replace(ROOT, ''), 'n', n, 'identity', JSON.stringify(ids), 'mean axes', JSON.stringify(Object.fromEntries(Object.entries(ax).map(([k, v]) => [k, +(v / n).toFixed(2)]))));
for (const [k, v] of Object.entries(tally).filter(([k]) => k.startsWith('hand')).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(v).padStart(5), k);
