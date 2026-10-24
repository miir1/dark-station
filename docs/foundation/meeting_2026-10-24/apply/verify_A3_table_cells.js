// verify_A3: 정체 결정표 8칸 전수 확인 (엔진 identity 로 −9~+9 모든 축 조합을 넣어 본다). 읽기만 한다.
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const ID = require(path.join(root, 'v4/engine/identity.js'));
const C = require(path.join(root, 'v4/engine/cond.js'));
const db = T.loadDir(path.join(root, 'v4/data'));
const tb = db.identity;
const cell = {}; let multi = 0, none = 0, total = 0;
for (let s = -9; s <= 9; s++) for (let h = -9; h <= 9; h++) for (let n = -9; n <= 9; n++) {
  total++;
  const ctx = { share: s, hand: h, name: n };
  const hits = tb.candidates.filter((c) => C.test(c.rule, ctx)).map((c) => c.id);
  if (hits.length > 1) multi++;
  if (!hits.length) none++;
  const got = ID.identity(ctx, tb).id;
  const key = (s >= 2 ? '+' : '-') + (h >= 1 ? '+' : '-') + (n >= 1 ? '+' : '-');
  (cell[key] = cell[key] || new Set()).add(got);
}
console.log('axis combos', total, '| overlap', multi, '| no rule (fallback)', none);
for (const k of Object.keys(cell).sort()) console.log('  share/hand/name ' + k + ' -> ' + [...cell[k]].join(','));
console.log('candidates', tb.candidates.map((c) => c.id + '(p' + c.priority + ',fb' + c.fallback + ')').join(' '));
for (const c of tb.candidates) {
  const miss = [...(c.reveal || []), ...(c.dreams || [])].filter((l) => !db.lines[l]);
  console.log('  ' + c.id + ': reveal ' + c.reveal.length + ' dreams ' + c.dreams.length + ' missing lines ' + (miss.length ? miss.join(',') : '0') + ' callName ' + c.callName + ' rule "' + c.rule + '"');
}
