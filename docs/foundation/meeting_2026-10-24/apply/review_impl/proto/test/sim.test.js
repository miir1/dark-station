// node --test v4/test — 봇 아침 조사 칸 단위 · 재측정 집계 (2026-10-24 회의 P0-E2)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { T, E } = require('./helpers.js');
const B = require('../sim/bots.js');
const S = require('../sim/stats.js');

const db = T.loadDir(path.join(__dirname, '..', 'data'));
// 아침(trace) 단계의 판을 만든다: 흔적은 첫 상태, 만난 사람 깃발은 다 선 것으로
function morning(seed) {
  const s = E.newGame(db, seed || 1);
  s.day = 1; s.phase = 'trace'; s.phaseSeen = []; s.pending = null;
  for (const p of db.peopleOrder) { const f = db.people[p].metFlag; if (f) s.flags[f] = true; if (s.people[p].status === 'away') s.people[p].status = 'home'; }
  s.flags.arrived = true;
  return s;
}
// 아침 조사 동안 inspect 한 물건 id (차례대로)
function inspected(s, pol) {
  const raw = E.dispatch, log = [];
  E.dispatch = (st, a, d) => { if (a && a.type === 'inspect' && st.phase === 'trace') log.push(a.object); return raw(st, a, d); };
  try { B.morningInspect(s, db, B.POLICIES[pol], { choices: 0, trips: 0, known: {}, hunger: [], d3: null }); } finally { E.dispatch = raw; }
  return log;
}
const cellOf = (id) => { const o = db.maps.station.objects.find((x) => x.id === id); return o ? `${o.x},${o.y}` : null; };
const cellIds = (key) => db.maps.station.objects.filter((o) => `${o.x},${o.y}` === key).map((o) => o.id);

test('봇 아침 조사는 칸 단위: 게으름(1칸)이 바뀐 흔적이 있는 머리맡 묶음 칸을 고르면 그 칸 물건 전부를 본다', () => {
  const s = morning(3);
  const bundle = cellOf('bottle_mari');
  assert.ok(cellIds(bundle).length >= 2, `마리 머리맡 (${bundle}) 에 물건이 여럿 (P0-D2)`);
  s.traces.bottle_mari.st = 'empty';                         // 밤에 빈 물통 = 바뀐 흔적(봇이 아는 모습은 첫 상태 full)
  const log = inspected(s, 'lazy');
  assert.deepStrictEqual(log, cellIds(bundle).filter((id) => s.traces[id]), '그 칸 물건 전부, 다른 칸은 없음');
});

test('봇 아침 조사는 칸 단위: 보통(2칸)은 두 칸만, 칸마다 그 칸 물건 전부 · 부지런은 모든 칸', () => {
  const log = inspected(morning(5), 'balanced');
  const cells = Array.from(new Set(log.map(cellOf)));
  assert.strictEqual(cells.length, B.INSPECT.normal.objects, `보통 = ${B.INSPECT.normal.objects}칸 (${log.join(',')})`);
  for (const c of cells) for (const id of cellIds(c)) assert.ok(log.includes(id), `${c} 의 ${id} 도 보았다`);
  const all = inspected(morning(5), 'diligent');
  const every = Array.from(new Set(db.maps.station.objects.map((o) => `${o.x},${o.y}`)));
  assert.strictEqual(new Set(all.map(cellOf)).size, every.length, '부지런 = 승강장 모든 칸');
});

test("재측정 집계: 아침 굶주림 표본·D3 셈 선택이 trace 에 남고 stats 가 평균·'함께 센다' 비율을 낸다", () => {
  const runs = [];
  for (let seed = 1; seed <= 6; seed++) {
    const { s, trace } = B.play(db, seed, 'balanced');
    assert.ok(trace.hunger.length >= 1, '아침마다 표본');
    const d3 = Object.keys(s.done).find((id) => B.D3_COUNT.test(id));
    if (d3) assert.ok(db.events[d3].choices.some((c) => c.label === trace.d3), `D3 셈 선택 = 그 사건의 선택지 (${trace.d3})`);
    else assert.strictEqual(trace.d3, null);
    runs.push(S.measure(db, s, trace));
  }
  const a = S.aggregate(db, runs);
  assert.ok(Number.isFinite(a.hunger) && a.hunger >= 0, '평균 굶주림');
  assert.ok(a.d3Reached >= 0 && a.d3Reached <= 100 && a.d3Together >= 0 && a.d3Together <= 100);
  assert.strictEqual(S.D3_TOGETHER, '함께 센다');
  for (const id of ['trial_d3_count', 'trial_d3_count_b', 'trial_d3_count_c']) if (db.events[id]) assert.ok(db.events[id].choices.some((c) => c.label === S.D3_TOGETHER), `${id} 에 '함께 센다'`);
});
