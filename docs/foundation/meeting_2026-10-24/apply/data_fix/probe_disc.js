// 읽기 전용: 정책 하나로 밤 행별 일어난 수·발견 수 (발견율이 왜 바뀌었나). node probe_disc.js <v4 폴더> <정책> [판수]
const path = require('path');
const root = path.resolve(process.argv[2]);
const T = require(path.join(root, 'engine/tables.js')), B = require(path.join(root, 'sim/bots.js')), N = require(path.join(root, 'engine/night.js'));
const db = T.loadDir(path.join(root, 'data'));
const pol = process.argv[3] || 'diligent', n = +(process.argv[4] || 100);
const rows = {};
for (let seed = 1; seed <= n; seed++) { const { s } = B.play(db, seed, pol); for (const e of s.nightLog.filter(N.isResidentRow)) { const r = (rows[e.id] = rows[e.id] || { n: 0, d: 0 }); r.n++; if (e.discovered) r.d++; } }
console.log(Object.entries(rows).sort((a, b) => (b[1].n - b[1].d) - (a[1].n - a[1].d)).slice(0, 40).map(([k, v]) => `${k} ${v.d}/${v.n}`).join(' · '));
{ let t = 0, d = 0; for (const v of Object.values(rows)) { t += v.n; d += v.d; } console.log('total', t, 'found', d, (100 * d / t).toFixed(1) + '%'); }
