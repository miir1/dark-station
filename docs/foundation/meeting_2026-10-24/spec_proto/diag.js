// 진단 전용 (v4 파일은 읽기만). node diag.js <v4폴더> <판수> <정책,...> <seed0>
const path = require('path');
const V4 = path.resolve(process.argv[2]);
const N = +(process.argv[3] || 200);
const pols = (process.argv[4] || 'balanced,selfish,lazy,diligent,risky,devoted,steward').split(',');
const SEED0 = +(process.argv[5] || 1);
const E = require(path.join(V4, 'engine/engine.js'));
const T = require(path.join(V4, 'engine/tables.js'));
const B = require(path.join(V4, 'sim/bots.js'));
const db = T.loadDir(path.join(V4, 'data'));

const NIGHT = require(path.join(V4, 'engine/night.js'));
const GONE = ['dead', 'ascended', 'stayed'];
const snap = (s) => Object.fromEntries(Object.values(s.people).filter((p) => p.id !== 'you').map((p) => [p.id, p.status]));
const diffKill = (s, before, tag) => { if (!cur) return; for (const p of Object.values(s.people)) if (p.id !== 'you' && before[p.id] !== undefined && !GONE.includes(before[p.id]) && GONE.includes(p.status)) { const k = typeof tag === 'function' ? tag(p.id) : tag; cur.resKills[k] = (cur.resKills[k] || 0) + 1; cur.marked[p.id] = 1; } };
const rn0 = NIGHT.rollNight; NIGHT.rollNight = function (s, db) { const b = snap(s); const n0 = s.nightLog.length; try { return rn0.call(this, s, db); } finally { diffKill(s, b, (id) => { const e = s.nightLog.slice(n0).find((x) => (x.lines || []).some((l) => l.who === id && GONE.includes(l.kind))); return 'night:' + (e ? e.id : '?'); }); } };
const orig = E.dispatch;
let cur = null;
E.dispatch = function (s, a, d) {
  let pend = null, label = null, chance = null;
  if (a && a.type === 'choose' && s.pending) {
    pend = s.pending.id; const v = E.eventView(s, d); const c = v && v.choices[a.i]; label = c ? c.label : '?'; chance = c ? c.chance : null;
    if (cur) { const k = pend; (cur.reached[k] = cur.reached[k] || 0); cur.reached[k]++; }
  }
  const before = s.people && s.people.you ? s.people.you.status : null;
  const b0 = s.people ? snap(s) : null; const pend0 = s.pending ? s.pending.id : null;
  const r = orig.call(this, s, a, d);
  if (b0 && cur) { for (const id of Object.keys(cur.marked)) b0[id] = 'dead'; diffKill(s, b0, a.type === 'choose' ? 'ev:' + pend0 : 'dawn_injury'); }
  if (pend && r.ok && cur) {
    const died = before === 'home' && s.people.you.status !== 'home';
    cur.picks.push({ ev: pend, label, chance, day: s.day, died, ok: s.lastResult && s.lastResult.roll ? s.lastResult.roll.success : null });
  }
  if (a && a.type === 'next' && cur && s.phase === 'trace' && !s.ended) {
    // 새 아침: 주민 원한 기록
    const g = {}; for (const p of Object.values(s.people)) if (p.id !== 'you' && p.status === 'home') g[p.id] = p.n.grudge || 0;
    cur.grudge.push({ day: s.day, g, karma: s.world.karma || 0, food: s.world.food, water: s.world.water, meds: s.world.meds, hunger: s.people.you.n.hunger, inj: s.people.you.n.injury });
  }
  return r;
};

const out = {};
for (const pol of pols) {
  const runs = [];
  for (let seed = SEED0; seed < SEED0 + N; seed++) {
    cur = { picks: [], reached: {}, grudge: [], resKills: {}, marked: {} };
    const { s, trace } = B.play(db, seed, pol);
    const res = Object.values(s.people).filter((p) => p.id !== 'you' && db.people[p.id] && !db.people[p.id].outside);
    const aliveRes = Object.values(s.people).filter((p) => p.id !== 'you' && ['home', 'boarded', 'walked'].includes(p.status) && !(db.people[p.id].outside)).length;
    const youDead = ['dead', 'ascended'].includes(s.people.you.status);
    const deathDay = youDead ? (s.people.you.day != null ? s.people.you.day : s.day) : null;
    const disc = E.night.discovery(s);
    runs.push({ seed, youDead, deathDay, cause: s.ended && s.ended.cause ? s.ended.cause.event : null, forced: !!(s.ended && s.ended.cause && s.ended.cause.forced), warned: !!(s.ended && s.ended.cause && s.ended.cause.warned), picks: cur.picks, reached: cur.reached, grudge: cur.grudge,
      nightLog: s.nightLog.map((e) => ({ day: e.day, id: e.id, actor: e.actor, target: e.target, disc: e.discovered, role: e.role })), aliveRes, world: Object.assign({}, s.world), disc, neglect: (s.stats && s.stats.neglect) || 0, resDead: res.filter((p) => ['dead','ascended'].includes(p.status)).length, lastDay: s.day, resKills: cur.resKills, maxG: Math.max(0, ...cur.grudge.map((x) => Math.max(0, ...Object.values(x.g)))) });
  }
  out[pol] = runs;
}
cur = null;
require('fs').writeFileSync(process.argv[6] || 'diag_out.json', JSON.stringify(out));
console.log('done', Object.keys(out).map((k) => k + ':' + out[k].length).join(' '));
