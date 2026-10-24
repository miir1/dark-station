// 적대적 검증 (10-24 tightrope) — ① 산 판이 넘긴 줄타기 판정의 화면 % 분포(아슬함이 '느껴지는' 판정인가)
//  ② D3 에 위험 0 출구가 없는 결정(가장 좋은 길도 살 확률 < 1)을 만난 횟수 — 'D3 신중하면 그날 안 죽음'
//  ③ D6 에 위험 0 출구가 없는 결정 — 'D6 값을 치르면 사는 날'
// node .../verify_intent_hist.js [판수=200] [--blocks=9001,11001] [정책,…]   (표·엔진·봇은 메모리에서 E.dispatch 만 감싼다)
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
  const orig = E.dispatch; let G = null;
  E.dispatch = function (s, a, d) {
    if (!(a && a.type === 'choose' && s.pending && G)) return orig.call(this, s, a, d);
    const ev = d.events[s.pending.id]; const view = E.eventView(s, d); const open = [];
    ev.choices.forEach((c0, i) => { const st = view.choices[i]; if (st.locked) return; const c = E.effChoice(s, d, c0); open.push({ i, p: E.survival(c, st.chance), roped: !!c.roped, label: c.label, chance: st.chance }); });
    const day = s.day, phase = s.phase, karma = s.world.karma || 0;
    const r = orig.call(this, s, a, d); if (!r.ok) return r;
    const lr = s.lastResult || {}; const me = open.find((o) => o.i === lr.i);
    const best = open.length ? Math.max(...open.map((o) => o.p)) : 1;
    if (best < 1 && (day === 3 || day === 6)) G.noSafe.push({ day, phase, ev: ev.id, karma, best, took: me ? me.p : null, label: me ? me.label : '', blind: !!lr.blind });
    if (me && me.roped && lr.roll) G.rope.push({ chance: lr.roll.chance, ok: lr.roll.success, ev: ev.id, day });
    return r;
  };
  const games = [];
  for (const b0 of blocks) for (let seed = b0; seed < b0 + N; seed++) { G = { rope: [], noSafe: [] }; const { s, trace } = B.play(db, seed, pol); const m = S.measure(db, s, trace); games.push({ seed, survived: m.survived, dead: m.dead, rope: G.rope, noSafe: G.noSafe }); }
  E.dispatch = orig;
  return { pol, games };
}
if (opt('worker')) { const r = runPolicy(opt('worker')); process.send(r, () => process.exit(0)); return; }   // eslint-disable-line
const names = only.length ? only : ['selfish_nb', 'selfish_rt0', 'balanced', 'lazy', 'h_cautious', 'h_first', 'silent', 'steward', 'diligent'];
const results = {}; let running = 0, idx = 0; const MAXW = Math.max(1, require('os').cpus().length - 2);
function next(done) { while (running < MAXW && idx < names.length) { const pol = names[idx++]; running++; const ch = fork(__filename, [String(N), `--blocks=${blocks.join(',')}`, `--worker=${pol}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); ch.on('message', (m) => { results[m.pol] = m; }); ch.on('exit', () => { running--; if (Object.keys(results).length === names.length && running === 0) done(); else next(done); }); } }
next(() => {
  const L = [`# 줄타기 % 분포 · D3/D6 위험0 없는 결정 — 블록 ${blocks.join(',')} × ${N}`];
  const bucket = (c) => (c >= 95 ? '95~' : c >= 90 ? '90~94' : c >= 85 ? '85~89' : c >= 75 ? '75~84' : c >= 60 ? '60~74' : c >= 45 ? '45~59' : '30~44');
  const ORDER = ['95~', '90~94', '85~89', '75~84', '60~74', '45~59', '30~44'];
  for (const n of names) {
    const g = results[n].games; const sv = g.filter((x) => x.survived);
    const h = {}; let tot = 0; for (const x of sv) for (const r of x.rope) if (r.ok) { h[bucket(r.chance)] = (h[bucket(r.chance)] || 0) + 1; tot++; }
    const hard = sv.map((x) => x.rope.filter((r) => r.ok && r.chance <= 85).length);
    const hard2 = sv.filter((x, k) => hard[k] >= 2).length;
    L.push(`\n## ${n} — 산 판 ${sv.length}/${g.length}: 넘긴 줄타기 화면 % 분포 (넘김 ${tot}): ${ORDER.map((k) => `${k} ${h[k] || 0} (${tot ? (100 * (h[k] || 0) / tot).toFixed(0) : 0}%)`).join(' · ')}`);
    L.push(`  산 판의 '≤85% 줄타기'(죽을 확률 ≥15%) 넘김 평균 ${(hard.reduce((a, b) => a + b, 0) / Math.max(1, sv.length)).toFixed(2)} · 그것을 2번 이상 넘긴 산 판 ${(100 * hard2 / Math.max(1, sv.length)).toFixed(1)}%`);
    const all = {}; let at = 0, af = 0; for (const x of g) for (const r of x.rope) { all[bucket(r.chance)] = (all[bucket(r.chance)] || 0) + 1; at++; if (!r.ok) af++; }
    L.push(`  모든 판의 줄타기 굴림 ${at} (실패 ${af}, ${(100 * af / Math.max(1, at)).toFixed(1)}%): ${ORDER.map((k) => `${k} ${all[k] || 0}`).join(' · ')}`);
    for (const d of [3, 6]) {
      const ns = []; for (const x of g) for (const r of x.noSafe) if (r.day === d) ns.push(r);
      const byEv = {}; for (const r of ns) { const k = `${r.ev}${r.blind ? '(눈먼)' : ''} k${r.karma >= 5 ? '≥5' : '<5'} best ${r.best}`; byEv[k] = (byEv[k] || 0) + 1; }
      L.push(`  D${d} 위험0 없는 결정 ${ns.length}회 (판 ${g.filter((x) => x.noSafe.some((r) => r.day === d)).length}/${g.length}) · 최저 best ${ns.length ? Math.min(...ns.map((r) => r.best)) : '-'} · ${Object.entries(byEv).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ×${v}`).join(' | ')}`);
    }
  }
  const txt = L.join('\n'); require('fs').writeFileSync(path.join(__dirname, 'verify_intent_hist.txt'), txt); console.log(txt);
});
