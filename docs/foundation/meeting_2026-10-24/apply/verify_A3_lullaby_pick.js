// verify_A3: 둘 다 경고인 갈림(D5 자장가)에서 봇 동점 규칙이 실제로 갈리는지 (읽기만)
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const E = require(path.join(root, 'v4/engine/engine.js'));
const B = require(path.join(root, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(root, 'v4/data'));
const watch = (process.argv[2] || 'd5_lullaby,patrol_pact,starve_you').split(',');
const pols = (process.argv[3] || 'balanced,silent,h_cautious,h_cautious2').split(',');
const orig = E.dispatch;
let tally = {};
E.dispatch = function (s, a, d) {
  if (a && a.type === 'choose' && s.pending && watch.includes(s.pending.id)) {
    const v = E.eventView(s, d); const lab = v && v.choices[a.i] ? v.choices[a.i].label : '#' + a.i;
    const k = s.pending.id + ' > ' + lab; tally[k] = (tally[k] || 0) + 1;
  }
  return orig.apply(this, arguments);
};
for (const p of pols) {
  tally = {};
  for (let seed = 1; seed <= 200; seed++) B.play(db, seed, p);
  console.log('[' + p + ']', JSON.stringify(tally));
}
