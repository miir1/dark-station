// verify_A4 — 화면 진행 캡처용 저장 찾기 (v4 파일은 읽기만, 저장은 이 폴더에만)
// 아침 조사를 하지 않는 봇(b_zero)으로 돌려, "어젯밤 주민 사건(못 보면 missed 가 있는 행)이 있었고 아직 안 본" 아침(trace 단계 시작)의 상태를 뽑는다.
// 그 상태에서 화면 봇과 같은 규칙(조사 없음·배식 전부·경고 없는 첫 선택)으로 하루를 더 굴려, 다음 아침에 late 흔적이 남는지 미리 본다.
// node mkfix.js <사건id,…> <최대 시드> <출력.json>
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
B.INSPECT.zero = { objects: 0, talk: 0, rumors: 0 };
B.POLICIES.b_zero = Object.assign({}, B.POLICIES.balanced, { inspect: 'zero' });
const want = process.argv[2].split(',');
const maxSeed = +process.argv[3];
const outP = process.argv[4];
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const stationObj = new Set((db.maps.station.objects || []).map((o) => o.id));
const clone = (s) => JSON.parse(JSON.stringify(s));
// 화면 봇 흉내: 한 줄 넘기기 = 없음, 사건 = 경고 없는 첫 열린 선택(없으면 첫 열린 것), 배식 = 전부
function choose(s) {
  let g = 0;
  while (s.pending && !s.ended && g++ < 20) {
    const v = E.eventView(s, db);
    let i = v.choices.findIndex((c) => !c.locked && !c.warn && !c.hint && c.chance == null);
    if (i < 0) i = v.choices.findIndex((c) => !c.locked);
    if (!E.dispatch(s, { type: 'choose', i }, db).ok) break;
  }
}
function oneDay(s0) {
  const s = clone(s0);
  const d0 = s.day;
  let g = 0;
  while (!s.ended && g++ < 40 && !(s.day === d0 + 1 && s.phase === 'trace')) {
    choose(s);
    if (s.ended) break;
    if (s.phase === 'ration') { const bowls = {}; for (const id of db.peopleOrder) if (s.people[id].status === 'home' && E.known(s, db, id)) bowls[id] = 1; E.dispatch(s, { type: 'ration', bowls }, db); }
    choose(s);
    if (!E.dispatch(s, { type: 'next' }, db).ok) { choose(s); E.dispatch(s, { type: 'next' }, db); }
  }
  return s;
}
const found = [];
const orig = E.dispatch;
let busy = false;
E.dispatch = function (s, a, d) {
  const dayBefore = s.day;
  const r = orig.call(this, s, a, d);
  if (busy || !(a.type === 'next' && r.ok && s.phase === 'trace' && s.day === dayBefore + 1 && !s.ended && s.day >= 2)) return r;
  const prev = s.day - 1;
  for (const e of s.nightLog) {
    if (e.day !== prev || e.role === 'clock' || e.role === 'neglect' || e.discovered || !want.includes(e.id)) continue;
    const row = db.nightEvents.find((n) => n.id === e.id);
    if (!row || !row.missed || !row.missed.trace) continue;
    if (!e.traces.some((id) => stationObj.has(id))) continue;
    busy = true;
    const snap = clone(s);
    const after = oneDay(snap);
    busy = false;
    const lates = Object.entries(after.traces).filter(([, t]) => t.late && t.day === after.day - 1 && !t.seen).map(([id, t]) => `${id}:${t.st}`);
    const missed = after.nightLog.filter((x) => x.day === after.day - 1 && x.role === 'neglect').map((x) => x.id);
    const nightNext = after.nightLog.filter((x) => x.day === after.day - 1 && x.role !== 'neglect').map((x) => x.id);
    found.push({ seed: s.seed, day: s.day, ev: e.id, actor: e.actor, target: e.target, traces: e.traces, predicted: { day: after.day, phase: after.phase, ended: after.ended ? after.ended.why : null, lates, missed, nightNext, pending: after.pending ? after.pending.id : null, you: after.people.you.status }, state: snap });
  }
  return r;
};
for (let seed = 1; seed <= maxSeed && found.length < 400; seed++) { try { B.play(db, seed, 'b_zero'); } catch (err) { /* 다음 판 */ } }
E.dispatch = orig;
fs.writeFileSync(outP, JSON.stringify(found));
for (const f of found.slice(0, 400)) if (f.predicted.lates.length || /grudge_boils|steal_.*again|ascend_unseen/.test(f.predicted.nightNext.join(' '))) console.log(f.seed, 'D' + f.day, f.ev, f.actor, '->', f.target, '| next:', f.predicted.day, f.predicted.phase, f.predicted.ended || '', f.predicted.pending || '', '| late', f.predicted.lates.join(','), '| missed', f.predicted.missed.join(','), '| night', f.predicted.nightNext.join(','));
console.log('found', found.length);
