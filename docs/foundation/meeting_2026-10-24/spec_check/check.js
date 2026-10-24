// 명세 검토용 측정기 (v4 파일은 읽기만 — 사본 폴더를 가리켜 돌린다).
// node check.js <v4사본> <판수> <정책,...> <시드0[,시드0…]> <출력.json> [knobs-json]
//   knobs: {"tabooBonus":{"selfish_rt":6}, "extraPolicies":{...}} — 봇 변형(사본 bots.js 에 tabooBonus 패치가 있어야 함)
const path = require('path');
const fs = require('fs');
const V4 = path.resolve(process.argv[2]);
const N = +(process.argv[3] || 200);
const pols = (process.argv[4] || 'balanced').split(',');
const SEEDS = (process.argv[5] || '1').split(',').map(Number);
const OUT = process.argv[6] || 'check_out.json';
const KN = JSON.parse(process.argv[7] || '{}');
const E = require(path.join(V4, 'engine/engine.js'));
const T = require(path.join(V4, 'engine/tables.js'));
const B = require(path.join(V4, 'sim/bots.js'));
const db = T.loadDir(path.join(V4, 'data'));
for (const [k, v] of Object.entries(KN.extraPolicies || {})) B.POLICIES[k] = Object.assign({}, B.POLICIES[v.base || 'selfish'], v);

const GONE = ['dead', 'ascended', 'stayed'];
let cur = null;
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  let pend = null, label = null;
  if (a && a.type === 'choose' && s.pending) { pend = s.pending.id; const v = E.eventView(s, d); const c = v && v.choices[a.i]; label = c ? c.label : '?'; }
  const before = s.people && s.people.you ? s.people.you.status : null;
  const r = orig.call(this, s, a, d);
  if (cur && pend && r.ok) {
    const died = before === 'home' && s.people.you.status !== 'home';
    const k = pend + '|' + label;
    cur.picks[k] = (cur.picks[k] || 0) + 1;
    if (died) cur.diedAt = k;
  }
  if (cur && a && a.type === 'next' && s.phase === 'trace' && !s.ended) {
    const res = Object.values(s.people).filter((p) => p.id !== 'you' && db.people[p.id] && !db.people[p.id].outside);
    cur.morning[s.day] = { home: res.filter((p) => p.status === 'home').length, gone: res.filter((p) => GONE.includes(p.status)).length,
      food: s.world.food, water: s.world.water, meds: s.world.meds, karma: s.world.karma || 0, inj: s.people.you.n.injury || 0 };
  }
  return r;
};

const out = { v4: V4, N, seeds: SEEDS, pols: {} };
for (const pol of pols) {
  const runs = [];
  for (const s0 of SEEDS) for (let seed = s0; seed < s0 + N; seed++) {
    cur = { picks: {}, morning: {}, diedAt: null };
    const { s } = B.play(db, seed, pol);
    const you = s.people.you;
    const dead = you.status === 'dead' || you.status === 'ascended';
    const res = Object.values(s.people).filter((p) => p.id !== 'you' && db.people[p.id] && !db.people[p.id].outside);
    const night = {}; let youSlot = 0; const youNights = new Set();
    for (const e of s.nightLog) { night[e.id] = (night[e.id] || 0) + 1; if (e.target === 'you' && e.role !== 'neglect') youNights.add(e.day); }
    youSlot = youNights.size;
    runs.push({ seed, block: s0, dead, day: dead ? (you.day != null ? you.day : s.day) : null, why: s.ended ? s.ended.why : 'none',
      cause: s.ended && s.ended.cause ? s.ended.cause.event : null, forced: !!(dead && s.ended && s.ended.cause && s.ended.cause.forced),
      warned: !!(dead && s.ended && s.ended.cause && s.ended.cause.warned), survived: !!(s.ended && s.ended.why !== 'you_gone' && !dead),
      karma: s.world.karma || 0, neglect: (s.stats && s.stats.neglect) || 0, resGone: res.filter((p) => GONE.includes(p.status)).length,
      resMet: res.filter((p) => E.known(s, db, p.id)).length, morning: cur.morning, picks: cur.picks, diedAt: cur.diedAt, night, youSlot, nights: s.stats.nights,
      identity: s.ended ? s.ended.identity : null });
  }
  out.pols[pol] = runs;
}
cur = null;
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('done', OUT, pols.map((p) => p + ':' + out.pols[p].length).join(' '));
