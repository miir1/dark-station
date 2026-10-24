// 화면에 열린 '죽을 수 있는 판정' 가운데 화면 % ≤ 34 인 것이 무엇인지 (바닥 30 확인용)
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const killMe = (o) => !!(o && o.effects && o.effects.kill && [].concat(o.effects.kill).some((k) => !k.who || ['you','self','actor','party','all'].includes(k.who)));
const orig = E.dispatch; const low = {};
E.dispatch = function (s, a, dbx) {
  if (a && a.type === 'choose' && s.pending && !s.ended) {
    const ev = dbx.events[s.pending.id]; const v = E.eventView(s, dbx);
    v.choices.forEach((cv, j) => { if (cv.locked) return; const c = E.effChoice(s, dbx, ev.choices[j]); if (c.check && killMe(c.fail) && cv.chance <= 34) { const k = `${ev.id}/${cv.label} ${cv.chance}% (base ${c.check.base}, ${c.check.skill}=${s.people.you.skills[c.check.skill] || 0}, karma ${s.world.karma}, roped ${c.roped ? c.roped.kind + ' K' + c.roped.band : '-'})`; low[k] = (low[k] || 0) + 1; } });
  }
  return orig.call(this, s, a, dbx);
};
for (const p of ['selfish_rt0', 'selfish_rt', 'counter', 'child', 'h_wary', 'balanced']) for (let seed = 130001; seed < 130101; seed++) B.play(db, seed, p);
console.log(Object.entries(low).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join('\n') || '없음');
