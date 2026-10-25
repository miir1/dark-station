// read-only: node data2_merged.js [dataDir] — run.js 와 같은 봇·5블록(200판씩)에서, 사본 사건(_r2…·_d3·_d6)을 원래 id 로 합쳐
// 사인·원인 사건 쏠림과 굶주림 비중을 다시 센다. stats.js 는 사건 id 그대로 세서 2차 사다리 사본(글만 다른 사본)이 한 사건을 여럿으로 나눠 보인다.
// 정책마다 자식 프로세스 하나(node data2_merged.js <dir> --one <정책>) → 부모가 모아 표를 찍는다.
const path = require('path');
const { execFile } = require('child_process');
const ROOT = 'C:/dev/dark_station';
const args = process.argv.slice(2);
const dir = args[0] && !args[0].startsWith('--') ? args[0] : path.join(ROOT, 'v4/data');
const BLOCKS = [1, 1001, 2001, 3001, 8001];
const base = (k) => String(k).replace(/_(r\d|d[36])$/, '');
if (args.includes('--one')) {
  const pol = args[args.indexOf('--one') + 1];
  const T = require(path.join(ROOT, 'v4/engine/tables.js'));
  const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
  const S = require(path.join(ROOT, 'v4/sim/stats.js'));
  const db = T.loadDir(dir);
  const out = [];
  for (const b0 of BLOCKS) {
    const blk = { b0, n: 0, deaths: 0, starve: 0, starveRaw: 0, cause: {}, root: {}, causeRaw: {}, rootRaw: {} };
    for (let seed = b0; seed < b0 + 200; seed++) {
      const { s, trace } = play(db, seed, pol); const m = S.measure(db, s, trace); blk.n++;
      if (!m.dead) continue;
      blk.deaths++;
      const ck = m.causeKey || 'none', rk = m.root || ck;
      blk.cause[base(ck)] = (blk.cause[base(ck)] || 0) + 1; blk.root[base(rk)] = (blk.root[base(rk)] || 0) + 1;
      blk.causeRaw[ck] = (blk.causeRaw[ck] || 0) + 1; blk.rootRaw[rk] = (blk.rootRaw[rk] || 0) + 1;
      if (m.cause && base(m.cause.event) === 'starve_you') blk.starve++;
      if (m.cause && m.cause.event === 'starve_you') blk.starveRaw++;
    }
    out.push(blk);
  }
  process.stdout.write(JSON.stringify({ pol, out }));
} else {
  const { POLICIES } = require(path.join(ROOT, 'v4/sim/bots.js'));
  const pols = Object.keys(POLICIES);
  const res = {};
  let left = pols.length, running = 0; const queue = pols.slice(); const MAX = 11;
  const top = (o, n) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} ${Math.round(1000 * e[1] / n) / 10}%` : '-'; };
  const next = () => {
    while (running < MAX && queue.length) {
      const p = queue.shift(); running++;
      execFile(process.execPath, [__filename, dir, '--one', p], { maxBuffer: 1 << 26 }, (err, so) => {
        running--; left--;
        if (err) { console.error(p, err.message); } else res[p] = JSON.parse(so).out;
        if (!left) done(); else next();
      });
    }
  };
  const done = () => {
    const L = [`# 사본 합친 사인 쏠림 (data2_merged.js) — 데이터 ${path.relative(ROOT, dir) || dir} · 정책 ${pols.length} × 5블록 × 200판`, ''];
    const row = (lab, pol, key) => { const bs = res[pol] || []; L.push(`| ${lab} | ${bs.map((b) => top(b[key], b.deaths)).join(' | ')} |`); };
    L.push('| 항목 | 시드 1~200 | 1001~1200 | 2001~2200 | 3001~3200 | 8001~8200 |', '|---|---|---|---|---|---|');
    row('A2 균형 사인 사건 (합침)', 'balanced', 'cause'); row('A2 균형 사인 사건 (id 그대로 = run.js)', 'balanced', 'causeRaw');
    row('A2 균형 원인 사건 (합침)', 'balanced', 'root'); row('A2 균형 원인 사건 (id 그대로 = run.js)', 'balanced', 'rootRaw');
    for (const p of ['selfish_nb', 'selfish_rt0', 'selfish', 'selfish_rt']) { row(`A1 ${p} 사인 (합침)`, p, 'cause'); row(`A1 ${p} 사인 (id 그대로)`, p, 'causeRaw'); }
    let st = 0, stRaw = 0, dd = 0; for (const p of pols) for (const b of res[p] || []) { st += b.starve; stRaw += b.starveRaw; dd += b.deaths; }
    const rs = (res.risky || []).reduce((a, b) => [a[0] + b.starve, a[1] + b.deaths], [0, 0]);
    L.push('', `사망 원인 중 굶주림 (전 정책 합산): 합침 ${Math.round(1000 * st / dd) / 10}% (${st}/${dd}) · id 그대로(run.js) ${Math.round(1000 * stRaw / dd) / 10}% (${stRaw}/${dd})`);
    L.push(`모험 봇 사망 중 굶주림: 합침 ${rs[1] ? Math.round(1000 * rs[0] / rs[1]) / 10 : 0}% (${rs[0]}/${rs[1]})`);
    console.log(L.join('\n'));
  };
  next();
}
