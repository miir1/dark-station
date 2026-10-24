// 못 본 밤이 바꾼 흔적(late)과 조사 글 _late·토스트가 실제로 나오는지: node late.js [판수]
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const E = require(path.join(R, 'engine', 'engine.js'));
const B = require(path.join(R, 'sim', 'bots.js'));
const db = T.loadDir(path.join(R, 'data'));
const n = +(process.argv[2] || 60);
const lateIds = {}, toast = { n: 0 }, sample = {};
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  const r = orig.call(this, s, a, d);
  if (a.type === 'inspect') {
    const id = E.inspectLineId(s, d, a.object);
    if (id && /_late$/.test(id)) { lateIds[id] = (lateIds[id] || 0) + 1; if (!sample[id]) sample[id] = `${a.object}: ${d.lines[id][0].text}`; }
    if (s.notice === 'toast_late') toast.n++;
  }
  return r;
};
for (let seed = 1; seed <= n; seed++) B.play(db, seed, process.env.POL || 'lazy');
console.log('lazy', n, '판 — 조사에서 나온 _late 줄', JSON.stringify(lateIds), '· toast_late', toast.n);
for (const v of Object.values(sample)) console.log('  ' + v);
