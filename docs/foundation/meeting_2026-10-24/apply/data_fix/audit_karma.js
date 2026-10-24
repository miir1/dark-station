// 읽기 전용: 카르마를 올리는 선택지 목록과 swap 유무 · 비용+결과 같은 자원 이중 차감 목록
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const S = require(path.join(ROOT, 'v4/engine/schema.js'));
const db = T.loadDir(path.join(ROOT, process.argv[2] || 'v4/data'));
const L = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const karmaOf = (o) => { if (!o || !o.effects) return 0; let k = 0; for (const x of L(o.effects.karma)) k += typeof x === 'number' ? x : (x && x.n) || 0; return k; };
let up = 0, sw = 0;
console.log('## 카르마를 올리는 선택지');
for (const ev of db.eventsList) ev.choices.forEach((c, i) => {
  const ks = [c.out, c.ok, c.fail].map(karmaOf); const k = Math.max(...ks);
  if (k <= 0) return; up++;
  const sws = S.swapsOf(c).filter((v) => /karma/.test(v.when || ''));
  if (sws.length) sw++;
  console.log(`${ev.id} #${i} '${c.label}' karma+${k} taboo=${c.taboo || ''} warn=${c.warn || ''} cost=${JSON.stringify(c.cost || {})} check=${c.check ? c.check.skill + c.check.base : ''} | karma swap: ${sws.length ? sws.map((v) => v.when).join(' / ') : 'NONE'} | when=${ev.when}`);
});
console.log(`합계 ${up} · karma swap 있음 ${sw}`);
console.log('\n## 비용과 결과가 같은 자원을 따로 깎는 선택지 (화면 비용 < 실제)');
const WORLD = db.numbersList.filter((d) => d.owner === 'world' && d.visible === 'always').map((d) => d.id);
for (const ev of db.eventsList) ev.choices.forEach((c0, i) => {
  for (const c of S.variantsOf(c0)) {
    for (const o of [c.out, c.ok, c.fail]) { if (!o || !o.effects) continue;
      for (const k of WORLD) { let d = 0; for (const x of L(o.effects[k])) d += typeof x === 'number' ? x : (x && x.who && x.who !== 'world' && x.who !== 'you' ? 0 : (x && x.n) || 0); if (d < 0) console.log(`${ev.id} #${i} '${c.label}' cost=${JSON.stringify(c.cost || {})} 결과 ${k}${d} warn=${c.warn || ''} ${c === c0 ? '' : '(swap)'}`); }
    }
  }
});
