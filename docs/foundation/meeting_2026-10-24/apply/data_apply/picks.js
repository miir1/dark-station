// 정책별로 사건·선택 고른 횟수와 그 선택으로 죽은 판을 센다: node picks.js <정책> [판수=100] [사건 id 거르기 정규식]
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const E = require(path.join(R, 'engine', 'engine.js'));
const B = require(path.join(R, 'sim', 'bots.js'));
const db = T.loadDir(process.env.DATA || path.join(R, 'data'));
const pol = process.argv[2] || 'selfish', n = +(process.argv[3] || 100), re = new RegExp(process.argv[4] || '.');
const seed0 = +(process.env.SEED0 || 1);
const tally = {}; let dead = 0; const karmaEnd = []; const deathDay = {};
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  let id = null, label = null, swapped = false, karma = s.world.karma;
  if (a.type === 'choose' && s.pending) { id = s.pending.id; const c0 = d.events[id].choices[a.i]; const c = E.effChoice(s, d, c0); label = c.label + (c !== c0 ? '*' : ''); }
  const wasHome = s.people.you.status === 'home';
  const r = orig.call(this, s, a, d);
  if (id && re.test(id)) { const k = `${id} | ${label}`; const t = (tally[k] = tally[k] || { n: 0, died: 0, k: [] }); t.n++; t.k.push(karma); if (wasHome && s.people.you.status !== 'home') t.died++; }
  return r;
};
for (let seed = seed0; seed < seed0 + n; seed++) { const { s } = B.play(db, seed, pol); if (s.people.you.status === 'dead' || s.people.you.status === 'ascended') { dead++; deathDay[s.people.you.day] = (deathDay[s.people.you.day] || 0) + 1; } karmaEnd.push(s.world.karma || 0); }
E.dispatch = orig;
console.log(`${pol} ${n}판: 사망 ${dead} · 카르마 끝 평균 ${(karmaEnd.reduce((a, b) => a + b, 0) / n).toFixed(1)} · 죽은 날 ${JSON.stringify(deathDay)}`);
for (const [k, t] of Object.entries(tally).sort()) console.log(`  ${k} : ${t.n}${t.died ? ' (죽음 ' + t.died + ')' : ''} · 카르마 평균 ${(t.k.reduce((a, b) => a + b, 0) / t.k.length).toFixed(1)}`);
