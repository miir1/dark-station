// 10-24 줄타기 데이터 몫 확인 (data 담당): 표에 넣은 값(after) ↔ 엔진 담당이 메모리에서 만든 R0 표(engine_r0_check.js 의 B — before 표 + rope 칸 + 같은 표 값)
//   node docs/foundation/meeting_2026-10-24/tightrope/data_verify.js --before=<고치기 전 표 폴더> [--after=v4/data] [--pols=…] [--n=40] [--blocks=1,1001]
//   ① 정규화한 표의 차이(칸 단위) — 바라는 차이: rope.fail(실패 글·그림·명부·효과) · 꼬리 줄 글 · numbers rope_* 24행 · grudge_boils.side 칸 순서
//   ② 봇 판 결과 비교 — 글을 뺀 판의 지문(끝 이유·날·주민 상태·세계 수치(rope_* 뺌)·당신 수치·축·집계·카르마)이 같은가
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const B = require(path.join(root, 'v4/sim/bots.js'));
const P = require(path.join(__dirname, 'patches.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BEFORE = path.resolve(opt('before', '') || process.exit(console.error('--before=<고치기 전 표 폴더> 가 필요하다') || 2));
const AFTER = path.resolve(opt('after', path.join(root, 'v4/data')));
const POLS = opt('pols', 'balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,lazy,diligent,risky,devoted,silent,caller,steward,counter,child,h_random,h_wary,h_first,h_cautious,h_cautious2,h_mixed').split(',');
const N = Number(opt('n', 40));
const BLOCKS = opt('blocks', '1,1001').split(',').map(Number);
const clone = (o) => JSON.parse(JSON.stringify(o));

// engine_r0_check.js tables() 의 B 와 같은 방법
function r0Table(dir) {
  const rawB = clone(T.loadDir(dir).raw);
  const find = (evId, label) => { const e = rawB.events.find((x) => x.id === evId); const c = e && e.choices.find((x) => x.label === label); if (!c) throw new Error(`선택지 없음 ${evId}/${label}`); return c; };
  for (const [e, l, k, minK] of P.LATE.concat(P.EARLY)) find(e, l).rope = Object.assign({ kind: k }, minK ? { from: minK } : {});
  for (const [e, l] of P.FIGHT) find(e, l).rope = { kind: 'fight' };
  for (const l of ['그릇 둘을 내민다', '맞고 버틴다', '옆 담요를 가리킨다']) find('dawn_strike', l).rope.blind = 1;
  const gb = rawB.nightEvents.find((x) => x.id === 'grudge_boils');
  gb.effects.flag = Object.assign({}, gb.effects.flag, { strike_blind: true });
  const kills = (o) => !!(o && o.effects && o.effects.kill && [].concat(o.effects.kill).some((k) => !k.who || ['you', 'self', 'actor', 'party', 'all'].includes(k.who)));
  const clear = (o) => { if (o && o.effects && !kills(o)) o.effects.flag = Object.assign({}, o.effects.flag, { strike_blind: false }); };
  for (const c of rawB.events.find((e) => e.id === 'dawn_strike').choices) for (const v of [c].concat(c.swap ? [].concat(c.swap) : [])) { clear(v.out); clear(v.ok); clear(v.fail); }
  P.apply('a4:b+gsy+boilside:7', rawB);
  for (const k of ['pay', 'endure', 'point']) rawB.lines.push({ id: 'rope_tail_' + k, speaker: 'ui', grade: 'choice', text: '잘못되면 끝이다' });
  return rawB;
}

// ① 칸 차이
function diff(a, b, at, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = [...new Set(Object.keys(a).concat(Object.keys(b)))];
    for (const k of keys) diff(a[k], b[k], `${at}.${k}`, out);
    return out;
  }
  out.push(`${at}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  return out;
}
const rawB = r0Table(BEFORE);
const dbA = T.loadDir(AFTER);
const rawA = clone(dbA.raw);
const keyed = (raw) => { const o = {}; for (const [t, rows] of Object.entries(raw)) o[t] = Array.isArray(rows) ? Object.fromEntries(rows.map((r, i) => [r && r.id ? `${r.id}#${rows.filter((x, j) => j < i && x.id === r.id).length}` : String(i), r])) : rows; return o; };
const d = diff(keyed(rawB), keyed(rawA), 'raw', []);
const L = [`# 데이터 몫 확인 — R0 표(엔진 확인용, 메모리) ↔ 넣은 표`, `before ${path.relative(root, BEFORE) || BEFORE} · after ${path.relative(root, AFTER)}`, '', `## ① 정규화한 표의 차이 ${d.length}칸`];
for (const x of d) L.push('- ' + x.replace(/^raw\./, ''));
L.push('', `표 검사: 오류 0 (읽힘) · 경고 ${dbA.warnings.length}건 ${[...new Set(dbA.warnings.map((w) => w.kind))].join(', ')}`);

// ② 봇 판 지문
const dbB = T.load(rawB);
// 당신이 '죽음(dead)'인가 '올라감(ascended)'인가는 따로 센다 — 메모리 시험은 줄타기 실패를 모두 dead 로 했고, 설계 §1-3 은 called_up·d10_walk_weak 실패를 ascended 로 적었다(바라는 차이)
const gone = (st) => (st === 'dead' || st === 'ascended' ? 'gone' : st);
const fp = (s) => {
  const world = Object.fromEntries(Object.entries(s.world).filter(([k]) => !/^rope_/.test(k)));
  return JSON.stringify({ ended: s.ended && { why: s.ended.why, identity: s.ended.identity, readerId: s.ended.readerId, forced: s.ended.cause && s.ended.cause.forced, roped: s.ended.cause && s.ended.cause.roped, event: s.ended.cause && s.ended.cause.event, choice: s.ended.cause && s.ended.cause.choice },
    day: s.day, phase: s.phase, world, people: Object.fromEntries(Object.entries(s.people).map(([k, p]) => [k, { st: k === 'you' ? gone(p.status) : p.status, n: p.n }])), axes: s.axes, stats: s.stats, flags: s.flags });
};
L.push('', `## ② 봇 판 결과 (글 뺀 지문) — 정책 ${POLS.length} × ${N}판 × 블록 ${BLOCKS.join(',')}`, '| 정책 | 같은 판 | 다른 판 | 첫 차이 시드 | 당신이 죽음↔올라감으로 갈린 판(지문은 같게 본다) |', '|---|---|---|---|---|');
let allSame = true;
for (const pol of POLS) {
  let same = 0, dif = 0, first = '', how = 0;
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) {
    const sa = B.play(dbA, seed, pol).s, sb = B.play(dbB, seed, pol).s;
    const a = fp(sa), b = fp(sb);
    if (sa.people.you.status !== sb.people.you.status) how++;
    if (a === b) same++; else { dif++; if (!first) first = String(seed); }
  }
  if (dif) allSame = false;
  L.push(`| ${pol} | ${same} | ${dif} | ${first || '-'} | ${how} |`);
}
L.push('', allSame ? '결과: 모든 판이 같다 — 넣은 표는 엔진 담당의 R0 확인 표(= 설계 메모리 시험과 판 결과가 같은 표)와 같게 논다. 다른 것은 글·그림·명부 칸과, 줄타기 실패로 죽은 판에서 죽음↔올라감(설계 §1-3 대로 called_up·d10_walk_weak 은 올라감)뿐.' : '결과: 다른 판이 있다 — 위 첫 차이 시드를 본다.');
console.log(L.join('\n'));
if (opt('out')) require('fs').writeFileSync(path.join(__dirname, opt('out')), L.join('\n') + '\n');
