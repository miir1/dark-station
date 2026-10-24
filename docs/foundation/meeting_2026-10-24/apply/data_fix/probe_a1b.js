// verify_A1 2차 (읽기 전용): ① 새벽 습격·둘러섬이 '할 사람' 없이 오는가 ② 신호가 '전날까지' 보였나(같은 아침은 빼고) ③ 카르마 8 이후 갚을 기회
// node docs/foundation/meeting_2026-10-24/apply/verify_A1_work/probe_a1b.js [판수=200] [정책,…] [--seed0=1]
const path = require('path');
const ROOT = path.resolve(process.env.DS_ROOT || path.resolve(__dirname, '../../../../..'));
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'selfish,selfish_nb,selfish_rt0').split(',');
const s0 = +((args.find((a) => a.startsWith('--seed0=')) || '--seed0=1').slice(8));
const meWho = (w) => w == null || w === 'you' || w === 'self';
const killsYou = (c) => [c.out, c.ok, c.fail].some((o) => o && o.effects && o.effects.kill && (Array.isArray(o.effects.kill) ? o.effects.kill : [o.effects.kill]).some((kv) => meWho(kv && kv.who)));
const kd = (o) => { if (!o || !o.effects || o.effects.karma == null) return 0; const k = o.effects.karma; return (Array.isArray(k) ? k : [k]).reduce((a, x) => a + (typeof x === 'number' ? x : (x && x.n) || 0), 0); };
let cur = null;
const orig = E.dispatch;
E.dispatch = function (s, a, dbx) {
  if (cur && a && a.type === 'choose' && s.pending) {
    const ev = dbx.events[s.pending.id];
    const open = ev.choices.map((x) => ({ x, st: E.choiceState(s, dbx, ev, x), e: E.effChoice(s, dbx, x) })).filter((o) => !o.st.locked);
    const home = dbx.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home');
    const g = home.map((id) => s.people[id].n.grudge || 0);
    const c0 = ev.choices[a.i]; const c = c0 ? E.effChoice(s, dbx, c0) : null;
    cur.w.push({ day: s.day, phase: s.phase, ev: ev.id, karma: s.world.karma || 0, home: home.length, maxG: Math.max(0, ...g), repay: open.some((o) => [o.e.out, o.e.ok].some((q) => kd(q) < 0)), repayFree: open.some((o) => [o.e.out, o.e.ok].some((q) => kd(q) < 0) && !killsYou(o.e) && (!o.e.cost || !Object.keys(o.e.cost).length)), label: c0 && c0.label, swapped: c !== c0, taboo: !!(c && c.taboo), deadly: c ? killsYou(c) : false });
  }
  const r = orig.apply(this, arguments);
  if (cur && a && a.type === 'next' && r.ok && s.phase === 'trace' && !s.ended) {
    const v = E.view(s, dbx);
    cur.m.push({ day: s.day, karma: s.world.karma || 0, cold: v.people.filter((p) => p.id !== 'you' && p.status === 'home' && p.met && p.signs && p.signs.cold).length, home: v.people.filter((p) => p.id !== 'you' && p.status === 'home').length });
  }
  return r;
};
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
for (const pol of pols) {
  const runs = [];
  for (let seed = s0; seed < s0 + N; seed++) { cur = { w: [], m: [] }; const { s } = B.play(db, seed, pol); cur.end = { you: s.people.you.status, day: s.day, karma: s.world.karma || 0 }; runs.push(cur); cur = null; }
  const W = runs.flatMap((r) => r.w);
  const dawn = W.filter((w) => ['dawn_strike', 'dawn_mob'].includes(w.ev));
  console.log(`\n## ${pol} (${N}판, 시드 ${s0}~)`);
  console.log(`- 새벽 습격·둘러섬 창 ${dawn.length} · 역에 주민 0명일 때 ${dawn.filter((w) => !w.home).length} · 원한 2 이상인 주민이 없을 때(할 사람 없음) ${dawn.filter((w) => w.maxG < 2).length} (${pct(dawn.filter((w) => w.maxG < 2).length, dawn.length)}%) · 원한 3 이상(등 돌림) 없을 때 ${dawn.filter((w) => w.maxG < 3).length} (${pct(dawn.filter((w) => w.maxG < 3).length, dawn.length)}%)`);
  const byEv = {}; for (const w of dawn.filter((x) => x.maxG < 2)) byEv[w.ev] = (byEv[w.ev] || 0) + 1;
  console.log(`  · 할 사람 없이 온 창: ${JSON.stringify(byEv)}`);
  // 신호가 전날까지 보였나: 카르마 판정이 된 금기로 죽은 판 · 돌아온 사건 첫 창
  let dK = 0, dKsign = 0, dKprev = 0;
  for (const r of runs) {
    const last = r.w[r.w.length - 1];
    if (!(r.end.you === 'dead' || r.end.you === 'ascended') || !last || !(last.swapped && last.taboo)) continue;
    dK++;
    if (r.m.some((m) => m.day < last.day && m.cold)) dKsign++;
    if (r.m.some((m) => m.day === last.day - 1 && m.cold)) dKprev++;
  }
  console.log(`- 카르마로 판정이 된 금기에서 죽은 판 ${dK} · 그 전날까지 아침에 등 돌림이 보인 판 ${dKsign} (${pct(dKsign, dK)}%) · 바로 전날 아침에 보인 판 ${dKprev} (${pct(dKprev, dK)}%)`);
  let fl = 0, flPrev = 0;
  for (const r of runs) { const f = r.w.find((w) => ['dawn_strike', 'dawn_mob', 'd10_hold'].includes(w.ev) || (w.ev === 'called_up' && w.karma >= 5)); if (!f) continue; fl++; if (r.m.some((m) => m.day < f.day && m.cold)) flPrev++; }
  console.log(`- 돌아온 사건 첫 창 ${fl} · 그 전날까지 아침에 등 돌림이 보인 판 ${flPrev} (${pct(flPrev, fl)}%)`);
  // 카르마 8 이후 갚을 기회
  let r8 = 0, r8none = 0, r8free = 0, down = 0, opp = 0;
  for (const r of runs) {
    const i8 = r.w.findIndex((w) => w.karma >= 8); if (i8 < 0) continue; r8++;
    const after = r.w.slice(i8);
    const o = after.filter((w) => w.repay).length; opp += o;
    if (!o) r8none++;
    if (after.some((w) => w.repayFree)) r8free++;
    if (after.some((w, k) => k > 0 && w.karma < after[k - 1].karma)) down++;
  }
  console.log(`- 카르마 8 닿은 판 ${r8} · 그 뒤 카르마를 줄일 선택이 한 번도 안 열린 판 ${r8none} (${pct(r8none, r8)}%) · 판당 갚을 기회 ${(opp / (r8 || 1)).toFixed(2)} · 비용 없이 갚을 기회가 한 번이라도 있던 판 ${pct(r8free, r8)}% · 실제로 카르마가 내려간 판 ${pct(down, r8)}%`);
}
