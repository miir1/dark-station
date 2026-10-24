// verify_A2: 각 위기 저장에서 '판정' 선택지를 골랐을 때 실패(죽음)하는 rng 값을 찾는다. 표·엔진은 읽기만.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(ROOT, 'engine', 'tables.js'));
const E = require(path.join(ROOT, 'engine', 'engine.js'));
const R = require(path.join(ROOT, 'engine', 'rng.js'));
const db = T.loadDir(path.join(ROOT, 'data'));
const fx = require('./fixtures.json');
const out = {};
for (const [id, s0] of Object.entries(fx)) {
  const v = E.eventView(s0, db);
  const ci = v.choices.findIndex((c) => c.chance != null && !c.locked && /끝이다/.test(c.warn));
  console.log('==', id, 'D' + s0.day, s0.phase, 'food', s0.world.food, '| choices:');
  v.choices.forEach((c, i) => console.log('   ', i, c.label, '| locked', c.locked, c.reason, '| chance', c.chance, '| warn', c.warn, '| taboo', c.taboo, '| cost', JSON.stringify(c.cost)));
  if (ci < 0) { console.log('   (판정 죽음 선택지 없음)'); continue; }
  let found = null, tried = 0, fails = 0;
  for (let k = 0; k < 400; k++) {
    const s = JSON.parse(JSON.stringify(s0));
    s.rng = (s0.rng + k * 7919) >>> 0;
    const ok = E.dispatch(s, { type: 'choose', i: ci }, db);
    tried++;
    if (s.people.you.status !== 'home') { fails++; if (!found) found = { rng: (s0.rng + k * 7919) >>> 0, ended: s.ended, last: s.lastResult && s.lastResult.text }; }
  }
  console.log('   판정 선택', ci, v.choices[ci].label, '실패율', (fails / tried * 100).toFixed(1) + '%', '(표시 확률', v.choices[ci].chance + ')', 'first fail rng', found && found.rng, JSON.stringify(found && found.ended));
  out[id] = { choice: ci, label: v.choices[ci].label, failRng: found && found.rng };
}
require('fs').writeFileSync(path.join(__dirname, 'fail_rng.json'), JSON.stringify(out, null, 1));
