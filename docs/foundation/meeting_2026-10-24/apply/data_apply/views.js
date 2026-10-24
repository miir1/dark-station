// 새·바뀐 사건이 화면에 어떻게 보이는지(eventView) 처음 걸린 모습을 찍는다: node views.js <정책> <판수> <사건,사건…>
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const E = require(path.join(R, 'engine', 'engine.js'));
const B = require(path.join(R, 'sim', 'bots.js'));
const db = T.loadDir(path.join(R, 'data'));
const pol = process.argv[2] || 'selfish', n = +(process.argv[3] || 60);
const want = (process.argv[4] || '').split(',');
const variant = process.env.VARIANT || '';   // 'swapped' = swap 이 맞은 모습만
const seen = {};
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  if (a.type === 'choose' && s.pending && want.includes(s.pending.id)) {
    const v = E.eventView(s, d);
    const metas = E.choiceMeta(s, d);
    const key = s.pending.id + (variant && metas.some((m) => m.swapped) ? '*' : '');
    if (!seen[key] && (!variant || metas.some((m) => m.swapped))) {
      seen[key] = 1;
      console.log(`\n== ${v.id} D${s.day} ${s.phase} karma ${s.world.karma} 대상 ${v.target || '-'} (${v.targetName || ''}) 부상 ${s.people.you.n.injury}`);
      console.log('  ' + v.text);
      v.choices.forEach((c, i) => console.log(`  [${i}] ${c.label}${c.locked ? ' (잠김: ' + c.reason + ')' : ''}${c.chance != null ? ' ' + c.chance + '%' : ''}${c.warn ? ' — ' + c.warn : ''}${c.taboo ? ' [금기]' : ''}${metas[i].swapped ? ' {swap}' : ''}`));
      const r = orig.call(this, s, a, d);
      const L = s.lastResult; if (L) console.log(`  → 고름 [${a.i}] ${L.choice}: ${L.text}`);
      return r;
    }
  }
  return orig.call(this, s, a, d);
};
for (let seed = 1; seed <= n; seed++) B.play(db, seed, pol);
