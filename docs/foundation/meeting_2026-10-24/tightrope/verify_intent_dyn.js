// 적대적 검증 (10-24 tightrope) — 실제 봇 판에서 매 선택을 엿본다(표·엔진·봇 파일은 안 고친다. E.dispatch 를 이 프로세스 메모리에서만 감싼다).
// node docs/foundation/meeting_2026-10-24/tightrope/verify_intent_dyn.js [판수=200] [--blocks=9001,11001] [정책,…]
//  - 확정 사망(열린 선택지 전부 살 확률 0) 결정 · 경고 없는 사망
//  - 카르마 ≥ 5 에서 '당신이 죽을 수 있는 사건'에 위험 0 출구가 열려 있던 결정(사건별) · 그 출구를 골랐나
//  - selfish_nb 산 판의 아슬함: 줄타기 넘김, 모든 죽음 판정 넘김, 누적 살 확률
//  - 그날 사망 D2~D6 (특히 D3: 조심형, 그날 카르마)
const path = require('path');
const { fork } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : ''; };
const blocks = (opt('blocks') || '9001,11001').split(',').map(Number);
const only = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || '').split(',').filter(Boolean);
const db = T.loadDir(path.join(ROOT, 'v4/data'));

function runPolicy(pol) {
  const orig = E.dispatch;
  let G = null;
  E.dispatch = function (s, a, d) {
    if (!(a && a.type === 'choose' && s.pending && G)) return orig.call(this, s, a, d);
    const ev = d.events[s.pending.id];
    const view = E.eventView(s, d);
    const open = [];
    ev.choices.forEach((c0, i) => { const st = view.choices[i]; if (st.locked) return; const c = E.effChoice(s, d, c0); open.push({ i, p: E.survival(c, st.chance), roped: !!c.roped, kills: E.killsYou(c), chance: st.chance, label: c.label, warn: !!(st.warn || st.hint || st.taboo) }); });
    const karma = s.world.karma || 0, day = s.day, evId = ev.id;
    const r = orig.call(this, s, a, d);
    if (!r.ok) return r;
    const lr = s.lastResult || {};
    const me = open.find((o) => o.i === lr.i) || null;
    const danger = open.some((o) => o.kills);
    G.decisions++;
    if (open.length && open.every((o) => o.p === 0)) G.forcedDec.push(`${evId} D${day} k${karma}`);
    if (danger && karma >= 5) {
      const z = open.filter((o) => o.p === 1);
      G.k5Danger++;
      if (z.length) { G.k5Risk0++; G.k5Risk0Ev[evId] = (G.k5Risk0Ev[evId] || 0) + 1; if (me && me.p === 1) { G.k5Risk0Took++; G.k5Risk0TookEv[`${evId}/${me.label}`] = (G.k5Risk0TookEv[`${evId}/${me.label}`] || 0) + 1; } }
      else G.k5Rope++;
    }
    if (me && me.p > 0 && me.p < 1 && lr.roll) { G.deathRolls.push({ ev: evId, day, karma, chance: lr.roll.chance, ok: lr.roll.success, roped: !!me.roped }); }
    if (me) G.last = { ev: evId, day, karma, p: me.p, label: me.label, roped: me.roped, warn: me.warn, best: Math.max(...open.map((o) => o.p)), alts: open.map((o) => `${o.label}:${o.p}`).join(' / ') };
    return r;
  };
  const out = { pol, runs: [], games: [] };
  for (const b0 of blocks) for (let seed = b0; seed < b0 + N; seed++) {
    G = { decisions: 0, forcedDec: [], k5Danger: 0, k5Risk0: 0, k5Rope: 0, k5Risk0Took: 0, k5Risk0Ev: {}, k5Risk0TookEv: {}, deathRolls: [], last: null };
    const { s, trace } = B.play(db, seed, pol);
    const m = S.measure(db, s, trace);
    out.runs.push(m);
    const passed = G.deathRolls.filter((x) => x.ok);
    out.games.push({ seed, block: b0, dead: m.dead, survived: m.survived, deathDay: m.deathDay, causeKey: m.causeKey, dayEvent: m.dayEvent, warned: m.warned, forced: m.forced,
      karmaEnd: s.world.karma || 0, ropeClose: m.ropeClose, ropeRolls: m.ropeRolls, closeCalls: m.closeCalls, deathRollsN: m.deathRolls,
      passedRoped: passed.filter((x) => x.roped).length, passedAll: passed.length, survProd: passed.reduce((p, x) => p * (x.chance / 100), 1), minPassed: passed.length ? Math.min(...passed.map((x) => x.chance)) : null,
      forcedDec: G.forcedDec, k5Danger: G.k5Danger, k5Risk0: G.k5Risk0, k5Rope: G.k5Rope, k5Risk0Took: G.k5Risk0Took, k5Risk0Ev: G.k5Risk0Ev, k5Risk0TookEv: G.k5Risk0TookEv, last: m.dead ? G.last : null });
  }
  E.dispatch = orig;
  out.agg = S.aggregate(db, out.runs);
  delete out.runs;
  return out;
}

if (opt('worker')) { const r = runPolicy(opt('worker')); process.send(r, () => process.exit(0)); return; }   // eslint-disable-line

const names = Object.keys(B.POLICIES).filter((p) => !only.length || only.includes(p));
const results = {};
let running = 0, idx = 0;
const MAXW = Math.max(1, require('os').cpus().length - 2);
function next(done) {
  while (running < MAXW && idx < names.length) {
    const pol = names[idx++]; running++;
    const ch = fork(__filename, [String(N), `--blocks=${blocks.join(',')}`, `--worker=${pol}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', (m) => { results[m.pol] = m; });
    ch.on('exit', () => { running--; if (Object.keys(results).length === names.length && running === 0) done(); else next(done); });
  }
}
next(() => {
  const L = [];
  const p = (a, b) => (b ? (100 * a / b).toFixed(1) : '-');
  L.push(`# 동적 검증 — 시드 블록 ${blocks.join(',')} × ${N}판`);
  L.push('\n## 정책별: 생존 · 사망 · 확정 사망 결정 · 경고 없는 사망 · k≥5 위험 사건 결정(위험0 열림/줄타기만)/판 · 위험0 고름/판');
  for (const n of names) {
    const r = results[n]; const g = r.games; const ng = g.length;
    const surv = g.filter((x) => x.survived).length, dead = g.filter((x) => x.dead).length;
    const fd = g.reduce((t, x) => t + x.forcedDec.length, 0);
    const k5D = g.reduce((t, x) => t + x.k5Danger, 0), k5Z = g.reduce((t, x) => t + x.k5Risk0, 0), k5R = g.reduce((t, x) => t + x.k5Rope, 0), k5T = g.reduce((t, x) => t + x.k5Risk0Took, 0);
    L.push(`- ${n.padEnd(12)} 생존 ${p(surv, ng)}% · 사망 ${p(dead, ng)}% · 확정사망결정 ${fd} · 경고없는사망 ${r.agg.unwarned} · 강제사망 ${r.agg.forced} · k≥5위험결정/판 ${(k5D / ng).toFixed(2)} (위험0 열림 ${(k5Z / ng).toFixed(2)} · 줄타기만 ${(k5R / ng).toFixed(2)}) · 위험0 고름/판 ${(k5T / ng).toFixed(2)}`);
  }
  for (const n of ['selfish_nb', 'selfish_rt0', 'balanced', 'lazy']) {
    const r = results[n]; if (!r) continue; const g = r.games;
    const ev = {}, took = {};
    for (const x of g) { for (const [k, v] of Object.entries(x.k5Risk0Ev)) ev[k] = (ev[k] || 0) + v; for (const [k, v] of Object.entries(x.k5Risk0TookEv)) took[k] = (took[k] || 0) + v; }
    L.push(`\n## ${n}: k≥5 위험 사건에서 위험0 출구가 열려 있던 사건(횟수/${g.length}판)`);
    Object.entries(ev).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    L.push(`  — 그중 위험0 출구를 고른 것:`);
    Object.entries(took).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    const sv = g.filter((x) => x.survived);
    if (sv.length) {
      const avg = (f) => (sv.reduce((t, x) => t + f(x), 0) / sv.length).toFixed(2);
      L.push(`  산 판 ${sv.length}: 줄타기 넘김 평균 ${avg((x) => x.ropeClose)} · ≥2 ${p(sv.filter((x) => x.ropeClose >= 2).length, sv.length)}% · 0번 ${p(sv.filter((x) => x.ropeClose === 0).length, sv.length)}% · 모든 죽음 판정 넘김 ${avg((x) => x.closeCalls)} · 누적 살 확률 평균 ${avg((x) => x.survProd)} · 누적 ≤ 50% 인 산 판 ${p(sv.filter((x) => x.survProd <= 0.5).length, sv.length)}% · 넘긴 가장 낮은 % 평균 ${avg((x) => x.minPassed == null ? 100 : x.minPassed)}`);
      const hist = {}; for (const x of sv) hist[x.ropeClose] = (hist[x.ropeClose] || 0) + 1;
      L.push(`  산 판 줄타기 넘김 분포: ${Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`);
    }
    const dd = g.filter((x) => x.dead); const dc = {}; for (const x of dd) dc[x.causeKey] = (dc[x.causeKey] || 0) + 1;
    L.push(`  사인: ${Object.entries(dc).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  }
  // 그날 사망 D2~D6
  L.push('\n## 그날 사건 사망 (dayEvent) D2·D3·D4·D5·D6 — 정책별 (조심형 = bots.CAREFUL)');
  L.push('CAREFUL = ' + B.CAREFUL.join(','));
  for (const n of names) {
    const g = results[n].games; const c = {}; for (const x of g) if (x.dead && x.dayEvent) c[x.deathDay] = (c[x.deathDay] || 0) + 1;
    L.push(`- ${n.padEnd(12)} ${[2, 3, 4, 5, 6].map((d) => `D${d} ${c[d] || 0}`).join(' · ')}`);
  }
  L.push('\n## D3 에 죽은 판 전부 (정책 · 시드 · 사인 · 그때 카르마 · 고른 것 · 열린 선택지 살 확률)');
  for (const n of names) for (const x of results[n].games) if (x.dead && x.deathDay === 3) L.push(`- ${n} seed${x.seed} ${x.causeKey} dayEvent${+x.dayEvent} | ${x.last ? `${x.last.ev} k${x.last.karma} '${x.last.label}' p=${x.last.p} best=${x.last.best} [${x.last.alts}]` : '(선택 아님)'}`);
  L.push('\n## D6 에 그날 사건으로 죽은 판 — 사인별');
  for (const n of names) { const c = {}; for (const x of results[n].games) if (x.dead && x.deathDay === 6 && x.dayEvent) { const k = x.last ? `${x.last.ev}/${x.last.label} (best ${x.last.best})` : x.causeKey; c[k] = (c[k] || 0) + 1; } if (Object.keys(c).length) L.push(`- ${n}: ${Object.entries(c).map(([k, v]) => `${k} ×${v}`).join(' · ')}`); }
  L.push('\n## 확정 사망 결정(있으면)');
  for (const n of names) for (const x of results[n].games) if (x.forcedDec.length) L.push(`- ${n} seed${x.seed}: ${x.forcedDec.join(', ')}`);
  L.push('\n## 죽은 판에서 고른 선택이 best 보다 낮았던 비율 (경고를 읽고도 더 낮은 % 를 고른 죽음)');
  for (const n of names) { const dd = results[n].games.filter((x) => x.dead && x.last); const low = dd.filter((x) => x.last.p < x.last.best - 1e-9); L.push(`- ${n.padEnd(12)} ${low.length}/${dd.length}`); }
  const txt = L.join('\n');
  require('fs').writeFileSync(path.join(__dirname, 'verify_intent_dyn.txt'), txt);
  require('fs').writeFileSync(path.join(__dirname, 'verify_intent_dyn.json'), JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { agg: { n: v.agg.n, deathRate: v.agg.deathRate, unwarned: v.agg.unwarned, forced: v.agg.forced }, games: v.games }]))));
  console.log(txt);
});
