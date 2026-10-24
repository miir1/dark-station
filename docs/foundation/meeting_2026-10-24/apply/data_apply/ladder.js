// 사다리 행이 '걸릴 수 있던 밤' 대비 실제로 걸린 밤: node ladder.js <정책> [판수]
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const NIGHT = require(path.join(R, 'engine', 'night.js'));
const B = require(path.join(R, 'sim', 'bots.js'));
const db = T.loadDir(path.join(R, 'data'));
const pol = process.argv[2] || 'selfish', n = +(process.argv[3] || 100);
const st = { nights: 0, eligible: 0, fired: 0, other: {}, gr: [] };
const orig = NIGHT.rollNight;
NIGHT.rollNight = function (s, d) {
  const k = s.world.karma || 0, fog = s.world.fog || 0;
  const home = Object.values(s.people).filter((p) => p.status === 'home' && p.id !== 'you');
  const holders = home.filter((p) => (p.n.grudge || 0) >= 2);
  if (s.day >= 6) { st.nights++; st.gr.push(home.map((p) => p.n.grudge || 0).join(',')); }
  const elig = k >= 8 && fog >= 3 && !s.flags.named_you && holders.length;
  const out = orig.call(this, s, d);
  if (elig) { st.eligible++; if (out.some((e) => e.id === 'grudge_names_you')) st.fired++; else for (const e of out) st.other[e.id] = (st.other[e.id] || 0) + 1; }
  return out;
};
for (let seed = 1; seed <= n; seed++) B.play(db, seed, pol);
console.log(pol, 'D6+ 밤', st.nights, '| names 걸릴 수 있던 밤', st.eligible, '| 걸림', st.fired);
console.log(' 대신 걸린 것', JSON.stringify(Object.entries(st.other).sort((a, b) => b[1] - a[1]).slice(0, 15)));
console.log(' 원한 표본', st.gr.slice(0, 12).join(' | '));
