// 나눠 돌린 runs.js 결과를 하나로 합친다. node merge.js 출력.json 입력1.json 입력2.json ...
// 같은 정책이 여럿이면 뒤의 파일이 이긴다. 패치·판수가 다르면 멈춘다.
const fs = require('fs');
const [outFile, ...ins] = process.argv.slice(2);
let res = null;
for (const f of ins) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!res) { res = Object.assign({}, r, { policies: {}, merged: [] }); }
  if (JSON.stringify(r.patches) !== JSON.stringify(res.patches) || r.n !== res.n || JSON.stringify(r.blocks) !== JSON.stringify(res.blocks)) throw new Error(`패치·판수·시드가 다르다: ${f}`);
  Object.assign(res.policies, r.policies); res.merged.push(f);
}
delete res.partial;
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log(`${outFile}: ${Object.keys(res.policies).join(',')}`);
