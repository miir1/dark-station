// 10-26 측정 보조: '생존%'(run.js) 안에 전멸로 일찍 끝난 판이 얼마나 들었나 — 열흘(D10)까지 간 생존과 나눠 본다
// node docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/side_alldead.js [정책,정책] [판수=200]
// 코드·데이터는 안 고친다. run.js 와 같은 시드 블록(1·1001·2001·3001)·같은 play()·같은 S.measure() 를 쓴다.
const path = require('path');
const { fork } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const { play } = require(path.join(root, 'v4/sim/bots.js'));
const S = require(path.join(root, 'v4/sim/stats.js'));
const BLOCKS = [1, 1001, 2001, 3001];
const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,lazy,diligent,risky').split(',');
const w = args.find((a) => a.startsWith('--worker='));
if (w) {
  const name = w.slice(9);
  const db = T.loadDir(path.join(root, 'v4/data'));
  const per = BLOCKS.map((b0) => {
    const o = { n: 0, surv: 0, survAllDead: 0, survD10: 0, train: 0 };
    for (let seed = b0; seed < b0 + N; seed++) {
      const { s, trace } = play(db, seed, name); const m = S.measure(db, s, trace);
      o.n++; if (m.survived) { o.surv++; if (m.why === 'all_dead') o.survAllDead++; else o.survD10++; } if (m.train) o.train++;
    }
    return o;
  });
  process.send({ name, per }, () => process.exit(0));
} else {
  const out = {}; let live = 0; const q = pols.slice();
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
  const done = () => {
    console.log('| 정책 | 생존% (run.js 정의) | 그중 전멸로 일찍 끝난 생존% | 열흘 끝까지 간 생존% | 블록별 열흘 끝 생존% |');
    console.log('|---|---|---|---|---|');
    for (const p of pols) {
      const t = out[p].reduce((a, o) => ({ n: a.n + o.n, surv: a.surv + o.surv, survAllDead: a.survAllDead + o.survAllDead, survD10: a.survD10 + o.survD10 }), { n: 0, surv: 0, survAllDead: 0, survD10: 0 });
      console.log(`| ${p} | ${pct(t.surv, t.n)} | ${pct(t.survAllDead, t.n)} | ${pct(t.survD10, t.n)} | ${out[p].map((o) => pct(o.survD10, o.n)).join(' / ')} |`);
    }
  };
  const next = () => {
    if (!q.length && !live) { done(); return; }
    while (live < 8 && q.length) {
      const p = q.shift(); live++;
      const ch = fork(__filename, [String(N), `--worker=${p}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      ch.on('message', (m) => { out[m.name] = m.per; });
      ch.on('exit', () => { live--; next(); });
    }
  };
  next();
}
