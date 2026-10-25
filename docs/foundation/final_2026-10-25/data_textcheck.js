// 최종판 새 글 점검 (data 담당, 2026-10-25) — node docs/foundation/final_2026-10-25/data_textcheck.js > docs/foundation/final_2026-10-25/data_textcheck.txt
// data_before 에 없던 글(사건 본문·결과·경고·라벨·줄타기 실패 글·수납 글·조사 글)만 본다. 규칙(31 §3·10-24 tightrope 점검과 같다):
//   문장 ≤ 40자(fixed 사건 ≤ 50) · 실패 글·수납 글 ≤ 2문장 · 경고 ≤ 2문장 · 금지 낱말(성폭력·자해·신 이름·용어·수치 노출·이유 낱말)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const before = new Set();
const walk = (o, f, p) => { if (typeof o === 'string') f(o, p); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, f, p.concat(k)); };
for (const n of ['events', 'objects', 'lines']) walk(JSON.parse(fs.readFileSync(path.join(__dirname, 'data_before', n + '.json'), 'utf8').replace(/\r\n/g, '\n')), (s) => before.add(s), []);
const BAN = [
  ['성폭력', /강간|성폭행|성추행|겁탈|능욕|옷을 벗기|몸을 더듬|추행/], ['자해', /자해|손목을 긋|목을 매|스스로 목숨|자살|약을 털어/],
  ['신 이름', /네레|구르마|세엘|테르미아|오스렌|히스카|(^|[^가-힣])신([^가-힣발]|$)|강림|징조|시선/], ['용어', /연기|천국|티켓|일지|로그|작업|인터랙트|상호작용|가스|(^|[^가-힣])표([^가-힣]|$)/],
  ['수치 노출', /(신뢰|스트레스|호감|카르마|원한)\s*\d|\d+\s*%/], ['이유 낱말', /때문에|왜냐하면/],
];
const TEXT_KEYS = new Set(['text', 'warn', 'label', 'why', 'hint', 'name']);
const sentences = (t) => t.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
const L = ['# 최종판 새 글 점검 (data_before 에 없던 글)', ''];
let n = 0, bad = 0;
for (const name of ['events', 'objects', 'lines']) {
  const data = JSON.parse(fs.readFileSync(path.join(process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'v4/data'), name + '.json'), 'utf8').replace(/\r\n/g, '\n'));   // (2차) 인자 = 다른 표 폴더
  const seen = new Set();
  data.forEach((row) => walk(row, (s, p) => {
    const key = p[p.length - 1];
    if (!TEXT_KEYS.has(key) || before.has(s) || !s || seen.has(s)) return;
    if (name === 'events' && key === 'name') return;
    seen.add(s); n++;
    const fixed = name === 'events' && row.grade === 'fixed' && p.length <= 1;
    const maxLen = fixed ? 50 : 40;
    const maxSent = key === 'text' && p.length <= 1 ? 4 : 2;
    const ss = sentences(s); const prob = [];
    ss.forEach((x) => { if ([...x].length > maxLen) prob.push(`문장 ${[...x].length}자 > ${maxLen}`); });
    if (ss.length > maxSent) prob.push(`${ss.length}문장 > ${maxSent}`);
    for (const [k, re] of BAN) if (re.test(s)) prob.push(`${k}: "${re.exec(s)[0]}"`);
    bad += prob.length;
    L.push(`- ${prob.length ? '✗' : '✓'} ${name}:${row.id} ${p.slice(0, -1).join('.')}.${key} — ${ss.length}문장·최장 ${Math.max(...ss.map((x) => [...x].length))}자: "${s}"${prob.length ? ' · ' + prob.join(' · ') : ''}`);
  }, []));
}
L.splice(1, 0, `새 글 ${n}개 · 문제 ${bad}건`);
console.log(L.join('\n'));
