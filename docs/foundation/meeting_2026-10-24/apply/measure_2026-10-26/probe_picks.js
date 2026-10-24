// 10-26 측정 보조: 몇 사건에서 정책이 무엇을 골랐나 (그때 열린 선택지와 함께) — 원인 추정용. 코드·데이터는 안 고친다.
// E.dispatch 를 이 프로세스 안에서만 감싸 '고르기' 순간의 열린 선택지(E.choiceMeta)와 고른 것을 센다.
// node docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/probe_picks.js [정책,정책] [판수=200]   (시드 블록 1·1001·2001·3001)
const path = require('path');
const { fork } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const EVS = ['starve_you', 'called_up', 'dawn_strike', 'dawn_mob', 'fever_night', 'd10_hold', 'd10_walk_weak', 'd5_flood', 'd2_shutter_arm', 'd4_spanner', 'd6_shutter', 'd6_shutter_b'];
const BLOCKS = [1, 1001, 2001, 3001];
const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'balanced,selfish,selfish_nb,h_cautious,h_first,h_cautious2').split(',');
const w = args.find((a) => a.startsWith('--worker='));
if (w) {
  const name = w.slice(9);
  const E = require(path.join(root, 'v4/engine/engine.js'));
  const T = require(path.join(root, 'v4/engine/tables.js'));
  const db = T.loadDir(path.join(root, 'v4/data'));
  const orig = E.dispatch;
  const rec = {};   // ev -> { reached, picks: {label: n}, openSets: {sorted open labels: n} }
  E.dispatch = function (s, a, d) {
    if (a && a.type === 'choose' && s.pending && EVS.includes(s.pending.id)) {
      const id = s.pending.id;
      const metas = E.choiceMeta(s, d) || [];
      const ch = metas.find((c) => c.i === a.i);
      const r = (rec[id] = rec[id] || { reached: 0, picks: {}, open: {} });
      r.reached++;
      const lab = ch ? ch.label : `#${a.i}`;
      r.picks[lab] = (r.picks[lab] || 0) + 1;
      for (const c of metas) if (!c.locked) r.open[c.label] = (r.open[c.label] || 0) + 1;
    }
    return orig.apply(this, arguments);
  };
  const { play } = require(path.join(root, 'v4/sim/bots.js'));
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) play(db, seed, name);
  process.send({ name, rec }, () => process.exit(0));
} else {
  const out = {}; let live = 0; const q = pols.slice();
  const done = () => {
    for (const p of pols) {
      console.log(`\n## ${p} (${N * BLOCKS.length}판)`);
      for (const ev of EVS) {
        const r = out[p] && out[p][ev]; if (!r) continue;
        const picks = Object.entries(r.picks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
        const open = Object.entries(r.open).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
        console.log(`- ${ev}: 고르기 ${r.reached}회 — 고른 것: ${picks}\n    열려 있던 횟수: ${open}`);
      }
    }
  };
  const next = () => {
    if (!q.length && !live) { done(); return; }
    while (live < 8 && q.length) {
      const p = q.shift(); live++;
      const ch = fork(__filename, [String(N), `--worker=${p}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      ch.on('message', (m) => { out[m.name] = m.rec; });
      ch.on('exit', () => { live--; next(); });
    }
  };
  next();
}
