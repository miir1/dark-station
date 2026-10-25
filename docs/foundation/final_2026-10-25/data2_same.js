// read-only: node data2_same.js <dirA> <dirB> [n] — 두 표로 같은 봇·같은 시드를 돌려 판이 똑같이 가는지 본다(사다리 사본 확인용).
// 비교: 고른 사건(사본 _r2… 은 원래 id 로)·선택 번호·날·단계의 차례 + 끝 상태(날·끝난 까닭·정체·사람 상태·세계 수치(lock_* 뺌)·정체 축·카르마).
// 다른 판이 있으면 첫 갈림을 찍는다. 글(본문)은 비교하지 않는다 — 사다리는 글만 바꾼다.
const path = require('path');
const crypto = require('crypto');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const { play, POLICIES } = require(path.join(ROOT, 'v4/sim/bots.js'));
const [dirA, dirB, n0] = process.argv.slice(2);
const N = +(n0 || 40);
const base = (id) => String(id || '').replace(/_r\d$/, '');
const orig = E.dispatch;
let seq = null;
E.dispatch = function (s, a) {
  const pend = a && a.type === 'choose' && s.pending ? base(s.pending.id) : null;
  if (pend) seq.push(`${s.day}/${s.phase}/${pend}#${a.i}`);
  else if (a && a.type) seq.push(a.type + (a.who ? ':' + a.who : '') + (a.id ? ':' + a.id : '') + (a.region ? ':' + a.region + a.floor : ''));
  return orig.apply(this, arguments);
};
function runAll(dir) {
  const db = T.loadDir(dir);
  const out = {};
  for (const pol of Object.keys(POLICIES)) for (let seed = 1; seed <= N; seed++) {
    seq = [];
    const { s } = play(db, seed, pol);
    const world = Object.fromEntries(Object.entries(s.world).filter(([k]) => !/^lock_/.test(k)));
    const people = Object.fromEntries(Object.values(s.people).map((p) => [p.id, [p.status, p.n.injury || 0, p.n.hunger || 0]]));
    const end = JSON.stringify({ day: s.day, why: s.ended && s.ended.why, idn: s.ended && s.ended.identity, cause: s.ended && s.ended.cause ? base(s.ended.cause.event) + '/' + s.ended.cause.choice : null, world, people, axes: s.axes });
    out[`${pol}#${seed}`] = { seq: seq.slice(), end, h: crypto.createHash('md5').update(seq.join('|') + end).digest('hex') };
  }
  return out;
}
const A = runAll(dirA), B = runAll(dirB);
let same = 0, diff = 0; const shown = [];
for (const k of Object.keys(A)) {
  if (A[k].h === B[k].h) { same++; continue; }
  diff++;
  if (shown.length < 5) { let i = 0; while (i < A[k].seq.length && A[k].seq[i] === B[k].seq[i]) i++; shown.push(`${k}: ${i}번째 조작에서 갈림 — A ${A[k].seq.slice(i, i + 3).join(' , ')} | B ${B[k].seq.slice(i, i + 3).join(' , ')}${i >= A[k].seq.length ? ' (끝 상태만 다름) A ' + A[k].end + ' B ' + B[k].end : ''}`); }
}
console.log(`A ${path.relative(ROOT, dirA) || dirA} · B ${path.relative(ROOT, dirB) || dirB} · 정책 ${Object.keys(POLICIES).length}개 × 시드 1~${N} = ${same + diff}판`);
console.log(`같은 판 ${same} · 다른 판 ${diff}`);
for (const x of shown) console.log('  ' + x);
