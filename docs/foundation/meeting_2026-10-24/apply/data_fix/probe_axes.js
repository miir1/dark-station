// 읽기 전용: 정책별 판 끝 축(share/hand/name) 분포와 축을 움직인 선택(사건/선택 → 횟수). node probe_axes.js <data폴더> <정책,…> [판수]
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const dataDir = path.resolve(process.argv[2] || path.join(ROOT, 'v4/data'));
const simRoot = /var/.test(dataDir) ? path.join(dataDir, '..') : path.join(ROOT, 'v4');
const T = require(path.join(simRoot, 'engine/tables.js'));
const B = require(path.join(simRoot, 'sim/bots.js'));
const E = require(path.join(simRoot, 'engine/engine.js'));
const db = T.loadDir(dataDir);
const pols = (process.argv[3] || 'h_cautious2').split(',');
const N = +(process.argv[4] || 200);
for (const pol of pols) {
  const dist = {}, picks = {}, ids = {};
  let alive = 0;
  for (let seed = 1; seed <= N; seed++) {
    const { s } = B.play(db, seed, pol);
    const a = s.axes; const k = `${a.share >= 2 ? 'S' : 's'}${a.hand >= 1 ? 'H' : 'h'}${a.name >= 1 ? 'N' : 'n'}`;
    dist[k] = (dist[k] || 0) + 1;
    const id = s.ended && s.ended.identity; ids[id] = (ids[id] || 0) + 1;
    if (s.people.you.status === 'home' || s.people.you.status === 'walked' || s.people.you.status === 'boarded') alive++;
  }
  console.log(`## ${pol} (${N}판) 축 칸(S=몫≥2 H=손≥1 N=이름≥1):`, Object.entries(dist).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('   정체:', Object.entries(ids).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
}
