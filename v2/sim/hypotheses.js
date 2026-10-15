// 재미 가설 1 검증: 같은 상태에서 "오늘 원정을 간다"와 "남아서 정비한다"를 갈라 이후 결과를 비교한다.
// node sim/hypotheses.js [기준 상태 수=150] [상태당 반복=40]
const E = require('../engine.js');
const { run, POLICIES, mulberry32 } = require('./bots.js');
const score = { safe: 3, half: 2, thin: 1, missed: 0, wiped: 0 };
const NB = +(process.argv[2] || 150), R = +(process.argv[3] || 40);
const clone = (s) => JSON.parse(JSON.stringify(s));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

function branch(state, mode) {
  const out = [];
  for (let k = 0; k < R; k++) {
    const s = clone(state); s.rng = (state.rng + k * 2654435761) >>> 0;
    const br = mulberry32(1000 + k);
    const r = run(s, POLICIES.balanced, br, { firstMorning: mode });
    out.push(score[r.s.ending.tier] - 0.5 * r.s.stats.deaths);
  }
  return out;
}
console.log(`기준 상태 ${NB}개 × 반복 ${R}, 점수 = 결말(0~3) − 0.5×사망`);
for (const day of [2, 3, 4, 5, 6, 7, 8]) {
  let n = 0, go = 0, stay = 0, goSig = 0, staySig = 0; const dl = [];
  const byChain = { open: [], closed: [] };
  for (let seed = 1; seed <= NB; seed++) {
    const base = run(E.newGame(seed), POLICIES.balanced, mulberry32((seed * 7919 + 13) >>> 0), { stopAt: (s) => s.day === day });
    if (!base.stopped) continue;
    const st = base.s;
    const g = branch(st, 'go'), t = branch(st, 'stay');
    const d = mean(g) - mean(t), se = Math.sqrt(sd(g) ** 2 / R + sd(t) ** 2 / R) || 1;
    n++; dl.push(d); if (d / se > 2) goSig++; if (d / se < -2) staySig++;
    (st.flags.passage_secured || st.flags.repair_open ? byChain.open : byChain.closed).push(d);
  }
  console.log(`D${day}: 상태 ${n}개 | 평균 Δ(출정−잔류) ${mean(dl).toFixed(2)} | 출정이 유의하게 낫다 ${Math.round(100 * goSig / n)}% · 잔류가 낫다 ${Math.round(100 * staySig / n)}% | 사슬 진행 전 Δ ${byChain.closed.length ? mean(byChain.closed).toFixed(2) : '-'} (${byChain.closed.length}) · 통로 수리 시작 후 Δ ${byChain.open.length ? mean(byChain.open).toFixed(2) : '-'} (${byChain.open.length})`);
}
