// 검토용 러너 (읽기만 — v4 사본에서만 돈다). node runner.js <사본> <판수> <정책,…> <시드0> <출력.json> [--nobody] [--knobs=json]
//   --nobody : 이기적 봇의 bodyAverse 를 끈다(명세 §6-2 없이 재기)
const path = require('path'); const fs = require('fs');
const [dirArg, nArg, polArg, seedArg, outArg] = process.argv.slice(2);
const V = path.resolve(dirArg); const N = +nArg; const SEED0 = +seedArg;
const E = require(path.join(V, 'engine/engine.js'));
const T = require(path.join(V, 'engine/tables.js'));
const B = require(path.join(V, 'sim/bots.js'));
const S = require(path.join(V, 'sim/stats.js'));
const db = T.loadDir(path.join(V, 'data'));
if (process.argv.includes('--nobody') && B.POLICIES.selfish) delete B.POLICIES.selfish.bodyAverse;
const ENDURE = /버틴다/;
let cur = null;
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  let info = null;
  if (a && a.type === 'choose' && s.pending && cur) {
    const ev = d.events[s.pending.id]; const c = ev && ev.choices[a.i];
    info = { ev: s.pending.id, label: c ? c.label : '?', target: s.pending.target || null, day: s.day, phase: s.phase, food: s.world.food, inj: s.people.you.n.injury };
  }
  const r = orig.call(this, s, a, d);
  if (info && r.ok) { info.roll = s.lastResult && s.lastResult.roll ? s.lastResult.roll.success : null; info.outTarget = s.lastResult ? s.lastResult.target : null; cur.picks.push(info); }
  if (a && a.type === 'next' && cur && s.phase === 'trace' && !s.ended && s.day === 9) cur.home9 = Object.values(s.people).filter((p) => p.id !== 'you' && p.status === 'home').length;
  if (a && a.type === 'next' && cur && s.phase === 'trace' && !s.ended && s.day === 7) cur.res7 = (s.world.food || 0) + (s.world.water || 0) + (s.world.meds || 0);
  return r;
};
const pols = polArg.split(',');
const out = {};
for (const pol of pols) {
  const runs = [];
  for (let seed = SEED0; seed < SEED0 + N; seed++) {
    cur = { picks: [], home9: null, res7: null };
    const { s, trace } = B.play(db, seed, pol);
    const m = S.measure(db, s, trace);
    const dead = m.dead;
    const cause = s.ended && s.ended.cause ? s.ended.cause : null;
    const neglectRows = s.nightLog.filter((e) => e.role === 'neglect').length;
    const realNights = s.nightLog.filter((e) => e.role !== 'clock' && e.role !== 'neglect').length;
    const endured = cur.picks.filter((p) => ENDURE.test(p.label)).map((p) => `${p.ev}/D${p.day}`);
    runs.push({ seed, dead, deathDay: dead ? (s.people.you.day != null ? s.people.you.day : s.day) : null, cause: cause ? cause.event : (dead ? m.why : null), choice: cause ? cause.choice : null,
      warned: m.warned, forced: m.forced, identity: m.identity, survived: m.survived, allDead: m.allDead, karma: s.world.karma || 0, neglect: (s.stats && s.stats.neglect) || 0,
      nightsStat: m.nights, maliceStat: m.malice, realNights, neglectRows, home9: cur.home9, res7: cur.res7, endured,
      picks: cur.picks.filter((p) => /^(d2_shutter_arm|d4_spanner|d5_flood|dawn_mob|dawn_strike|called_up|d10_hold|trial_d4_gicheol|trial_d1_bowls|d2_night_shutter|fever_night|d6_shutter|d6_shutter_b|d10_walk_weak)$/.test(p.ev)),
      axes: Object.assign({}, s.axes) });
  }
  out[pol] = runs;
}
fs.writeFileSync(outArg, JSON.stringify(out));
console.log('done', Object.keys(out).map((k) => k + ':' + out[k].length).join(' '));
