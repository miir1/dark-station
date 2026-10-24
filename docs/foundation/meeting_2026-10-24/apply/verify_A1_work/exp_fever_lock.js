// verify_A1 실험(메모리에서만, 표 파일은 그대로): fever_night '남의 담요를 끌어온다'(금기, 카르마 swap 없음)를 카르마 8 이상에서 잠그면 어떻게 되나
// node docs/foundation/meeting_2026-10-24/apply/verify_A1_work/exp_fever_lock.js [판수] [정책,…]
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'balanced,selfish_nb,h_cautious').split(',');
const base = T.loadDir(path.join(ROOT, 'v4/data'));
const raw = JSON.parse(JSON.stringify(base.raw));
const fe = raw.events.find((e) => e.id === 'fever_night');
const ci = fe.choices.findIndex((c) => c.taboo === 'take_blanket');
fe.choices[ci].req = Object.assign({}, fe.choices[ci].req, { cond: 'karma<8', why: '덮을 담요가 없다' });
let lockedDb; try { lockedDb = T.load(raw); } catch (e) { console.log('load fail', e.message); process.exit(1); }
for (const [name, db] of [['지금 표', base], ['담요 금기를 카르마 8+ 에서 잠금', lockedDb]]) {
  for (const pol of pols) {
    let surv = 0, forced = 0, dead = 0; const cause = {};
    for (let seed = 1; seed <= N; seed++) { const { s, trace } = B.play(db, seed, pol); const m = S.measure(db, s, trace); if (m.survived) surv++; const c = s.ended && s.ended.cause; if (c) { dead++; if (c.forced) forced++; cause[c.event] = (cause[c.event] || 0) + 1; } }
    console.log(`${name} | ${pol}: 생존 ${(100 * surv / N).toFixed(1)}% · 강제 사망 ${forced} · 사인 ${Object.entries(cause).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' · ')}`);
  }
}
