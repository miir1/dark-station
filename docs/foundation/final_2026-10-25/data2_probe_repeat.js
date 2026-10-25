// read-only: node data2_probe_repeat.js [dataDir] [n] — 되풀이 사건(once:0)이 한 판에 몇 번 뜨나 (같은 글이 되풀이되는지)
// 사본(_d3·_d6·_r2…)은 원래 id 로 합쳐 센다. '같은 글' = 그 판에서 같은 사건 글(event text)을 본 횟수의 최대.
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const dir = process.argv[2] || path.join(ROOT, 'v4/data'); const N = +(process.argv[3] || 100);
const db = T.loadDir(dir);
const base = (id) => id.replace(/_(d[36]|r\d)$/, '');
const pols = ['balanced', 'risky', 'selfish_nb', 'lazy', 'h_cautious', 'h_first', 'devoted'];
const rep = {};
for (const pol of pols) for (let seed = 1; seed <= N; seed++) {
  const { s } = play(db, seed, pol);
  const cnt = {}, texts = {};
  for (const [id, k] of Object.entries(s.fired || {})) { const e = db.events[id]; if (!e || e.once !== 0) continue; const b = base(id); cnt[b] = (cnt[b] || 0) + k; (texts[b] = texts[b] || {})[e.text] = (texts[b][e.text] || 0) + k; }
  for (const [b, k] of Object.entries(cnt)) {
    const r = rep[b] = rep[b] || { runs: 0, sum: 0, max: 0, ge3: 0, sameMax: 0, same3: 0 };
    r.runs++; r.sum += k; r.max = Math.max(r.max, k); if (k >= 3) r.ge3++;
    const sm = Math.max(...Object.values(texts[b])); r.sameMax = Math.max(r.sameMax, sm); if (sm >= 3) r.same3++;
  }
}
console.log(`데이터 ${path.relative(ROOT, dir) || dir} · 정책 ${pols.join(',')} × ${N}판 = ${pols.length * N}판`);
console.log('사건(사본 합침) | 뜬 판 | 판당 평균 | 최대 | 3번 이상 뜬 판 | 같은 글 최대 | 같은 글 3번 이상 판');
for (const [b, r] of Object.entries(rep).sort((a, b) => b[1].ge3 - a[1].ge3)) console.log(`${b} | ${r.runs} | ${(r.sum / r.runs).toFixed(2)} | ${r.max} | ${r.ge3} | ${r.sameMax} | ${r.same3}`);
