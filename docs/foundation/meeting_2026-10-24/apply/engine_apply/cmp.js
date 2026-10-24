const path = require('path');
const [a, b] = process.argv.slice(2);
const load = (root) => ({ T: require(path.join(root, 'engine/tables.js')), B: require(path.join(root, 'sim/bots.js')) });
const A = load(a), Bb = load(b);
const dbA = A.T.loadDir(path.join(a, 'data')), dbB = Bb.T.loadDir(path.join(b, 'data'));
let diff = 0, n = 0;
for (const pol of ['balanced', 'selfish', 'devoted', 'lazy', 'risky']) for (let seed = 1; seed <= 40; seed++) {
  const x = A.B.play(dbA, seed, pol).s, y = Bb.B.play(dbB, seed, pol).s;
  const sig = (s) => JSON.stringify([s.day, s.ended && s.ended.why, s.world, s.axes, s.nightLog.map((e) => e.id + e.actor + e.target), Object.values(s.people).map((p) => p.status + p.n.injury)]);
  n++; if (sig(x) !== sig(y)) { diff++; if (diff < 4) console.log('diff', pol, seed); }
}
console.log('games', n, 'diff', diff);
