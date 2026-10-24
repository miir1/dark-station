// 10-24 줄타기 데이터 몫 — 새 글 점검 + 화면에 보일 줄타기 모습 (data 담당)
//   node docs/foundation/meeting_2026-10-24/tightrope/data_textcheck.js [--dir=v4/data] [--out=파일]
//   ① 문장 규칙(31 §3): 문장 ≤ 40자(fixed ≤ 50) · 새 실패 글 ≤ 2문장('swap 글 그대로' 셋은 원래 글 3문장) · 꼬리 ≤ 18자 · 금지 낱말 · 이유 낱말 · 수치 노출
//   ② 줄타기 모습: 선택지마다 (변형 × 구간 K1~K4 · 눈먼 새벽) 경고 글 · 판정 % (화면 = base + 기술 1 × 5)
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const S = require(path.join(root, 'v4/engine/schema.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DIR = path.resolve(opt('dir', path.join(root, 'v4/data')));
const db = T.loadDir(DIR);
const raw = db.raw;
const REUSED = new Set(['dawn_strike/옆 담요를 가리킨다', 'dawn_mob/다른 사람을 가리킨다', 'called_up/다른 이름을 댄다']);   // 지금 K≥8 swap 실패 글 그대로
const BAN = [
  ['성폭력', /강간|성폭행|성추행|겁탈|능욕|옷을 벗기|몸을 더듬|추행/], ['자해', /자해|손목을 긋|목을 매|스스로 목숨|자살|약을 털어/],
  ['신 이름', /네레|구르마|세엘|테르미아|오스렌|히스카|(^|[^가-힣])신([^가-힣발]|$)|강림|징조|시선/], ['용어', /연기|천국|티켓|일지|로그|작업|인터랙트|상호작용|가스|(^|[^가-힣])표([^가-힣]|$)/],
  ['수치 노출', /(신뢰|스트레스|호감|카르마)\s*\d/], ['이유 낱말', /때문에|왜냐하면/],
];
const sentences = (t) => t.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
const L = [`# 줄타기 데이터 — 새 글 점검 · 화면 모습 (${path.relative(root, DIR) || DIR})`, '', '## ① 문장 규칙'];
let bad = 0;
const check = (where, text, { maxLen = 40, maxSent = 4, explicit = 1 } = {}) => {
  const ss = sentences(text); const prob = [];
  ss.forEach((s) => { if ([...s].length > maxLen) prob.push(`문장 ${[...s].length}자 > ${maxLen}: "${s}"`); });
  if (ss.length > maxSent) prob.push(`${ss.length}문장 > ${maxSent}`);
  for (const [k, re] of BAN) if (re.test(text)) prob.push(`${k}: "${re.exec(text)[0]}"`);
  if (!explicit) { const n = (text.match(/피|시체|칼/g) || []).length; if (n >= 3) prob.push(`explicit 0 인데 피·시체·칼 ${n}개`); }
  bad += prob.length;
  L.push(`- ${prob.length ? '✗' : '✓'} ${where} — ${ss.length}문장, 가장 긴 문장 ${Math.max(...ss.map((s) => [...s].length))}자: "${text}"${prob.length ? ' · ' + prob.join(' · ') : ''}`);
};
let nFail = 0;
for (const ev of raw.events) (ev.choices || []).forEach((c, i) => {
  if (!c.rope || !c.rope.fail || !c.rope.fail.text) return;
  nFail++;
  const key = `${ev.id}/${c.label}`;
  check(`${ev.id} [${i}] ${c.label} (${c.rope.kind}${REUSED.has(key) ? ', swap 글 그대로' : ''}, ${c.rope.fail.how || 'dead'})`, c.rope.fail.text, { maxLen: ev.grade === 'fixed' ? 50 : 40, maxSent: REUSED.has(key) ? 4 : 2, explicit: ev.explicit });
});
for (const k of ['pay', 'endure', 'point']) { const l = raw.lines.find((x) => x.id === 'rope_tail_' + k); if (l) check(`lines rope_tail_${k}`, l.text, { maxLen: 18, maxSent: 1 }); }
L.push('', `실패 글 ${nFail}개 · 문제 ${bad}건`);

// ② 화면 모습 — schema ropeFormsOf (엔진 effChoice 와 같은 함수)
const get = (id) => (db.numbers[id] && db.numbers[id].owner === 'world' && Number.isInteger(db.numbers[id].start) ? db.numbers[id].start : undefined);
const tailOf = (kind) => { const l = raw.lines.find((x) => x.id === 'rope_tail_' + kind); return kind === 'fight' ? '' : (l && l.text) || S.ROPE_TAIL[kind] || ''; };
L.push('', '## ② 화면에 보일 줄타기 모습 (화면 % = base + 기술 1 × 5 · 구간 = 고를 때의 카르마 — 화면에 카르마 숫자는 안 나간다 · '-' = 그 구간에서 이 모습이 안 나온다(from · 변형 when 의 karma 문턱) · 눈먼 새벽 칸 = 카르마 구간 밖일 때)', '| 사건 [자리] 선택 | 종류 | 변형 | K1 5~7 | K2 8~11 | K3 12~15 | K4 16+ | 눈먼 새벽 | 경고 글 (줄타기 뒤) |', '|---|---|---|---|---|---|---|---|---|');
for (const ev of raw.events) (ev.choices || []).forEach((c, i) => {
  if (!c.rope) return;
  const vs = S.variantsOf(c); const sw = S.swapsOf(c);
  vs.forEach((x, j) => {
    const pick = (band, blind) => { const st = { band, bandOn: band > 0, blind, active: true }; const km = j > 0 && /karma>=(\d+)/.exec(sw[j - 1].when || ''); const from = Math.max(Number.isInteger(c.rope.from) ? c.rope.from : 0, km ? Number(km[1]) : 0); const ks = [0, get('rope_k1'), get('rope_k2'), get('rope_k3'), get('rope_k4'), Infinity]; if (band > 0 && !(ks[band + 1] > from)) return '-'; if (band === 0 && km && Number(km[1]) >= ks[1]) return '-'; const rc = S.ropeCheck(c.rope, x, st, get); if (!rc) return '-'; const f = S.applyRope(x, c.rope, rc, tailOf(c.rope.kind)); return f === x ? '-' : `${rc.base + 5}%`; };
    const blindCell = c.rope.blind ? pick(0, true) : '-';
    const anyBand = [1, 2, 3, 4].map((b) => pick(b, false));
    const rc = S.ropeCheck(c.rope, x, { band: 1, bandOn: true, blind: false, active: true }, get) || S.ropeCheck(c.rope, x, { band: 4, bandOn: true, blind: false, active: true }, get);
    const w = rc ? S.applyRope(x, c.rope, rc, tailOf(c.rope.kind)).warn || '' : x.warn || '';
    L.push(`| ${ev.id} [${i}] ${c.label} | ${c.rope.kind}${c.rope.from ? ' from ' + c.rope.from : ''} | ${j === 0 ? '기본' : 'swap ' + sw[j - 1].when}${x.label && x.label !== c.label ? ` (${x.label})` : ''} | ${anyBand.join(' | ')} | ${blindCell} | ${w} |`);
  });
});
console.log(L.join('\n'));
if (opt('out')) require('fs').writeFileSync(path.join(__dirname, opt('out')), L.join('\n') + '\n');
process.exitCode = bad ? 1 : 0;
