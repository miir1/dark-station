// node --test v4/test — P1-11 엔진 몫: 물건의 수납 내용(objects.holds) '닫힘→얻음→열림' · 원정 중 inspect: 원정 사건 · trip walk · 봇 원정 지도 뒤지기
// 디렉터 피드백 U4 "아이템은 상자·서랍·드럼통·수납장 안에서 열어 발견" — 원정 지도 m칸을 수납으로 바꾸는(데이터)·걸어서 뒤지는(화면) 일의 엔진 바탕.
// 지금 표(v4/data)에는 holds·inspect: 원정 사건이 없어서 게임은 그대로다(봇 판 해시 같음 — after_shots/engine_p1_11_holds.txt).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { rawTables, clone, T, E } = require('./helpers.js');
const SAVE = require('../engine/save.js');
const B = require('../sim/bots.js');

const errs = (tables) => T.validate(tables).map((e) => e.text);
const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out) => ({ label, out: Object.assign({ text: '' }, out || {}) });

// 픽스처 + 원정 가능 + 배수로 1층(drain_b1)에 수납 셋
//   t_locker: 닫힘/열림, 건빵 둘(배열 꼴 effects — 로더가 객체로) · t_drum: 연 뒤 상태를 'empty' 로 지정 · t_cabinet: inspect: 원정 사건이 쥔 수납
function holdsTables(edit) {
  const t = rawTables();
  t.phases.find((p) => p.id === 'day').actions.push('trip');
  t.objects.push({ id: 't_locker', name: '사물함', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: { text: '건빵 두 봉지가 있었다.', effects: [{ verb: 'number', id: 'food', n: 2 }] } });
  t.objects.push({ id: 't_drum', name: '닫힌 드럼통', states: ['shut', 'pried', 'empty'], solid: 1, resetOn: 'never', holds: { state: 'empty', effects: { water: 1 } } });
  t.objects.push({ id: 't_cabinet', name: '약품 수납장', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: { effects: { meds: 1 } } });
  t.events.push(ev('trip_t_cabinet', 'trip', 'region==B & floor==1 & inspect:t_cabinet & trace:t_cabinet==closed', [
    pass('둔다'),
    pass('비틀어 연다', { text: '약 두 통.', effects: { meds: 2, trace: { t_cabinet: 'open' } } }),
  ]));
  t.maps.find((m) => m.id === 'drain_b1').objects = [{ id: 't_locker', x: 2, y: 1 }, { id: 't_drum', x: 3, y: 1 }, { id: 't_cabinet', x: 4, y: 1 }];
  if (edit) edit(t);
  return t;
}
// D1 낮(걸린 사건 없음)까지
function dayOne(db, seed) {
  const s = E.newGame(db, seed || 1);
  let g = 0;
  while (!(s.day === 1 && s.phase === 'day') && !s.ended && g++ < 60) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  while (s.pending && g++ < 80) E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.deepStrictEqual([s.day, s.phase, s.pending], [1, 'day', null], 'D1 낮 도착');
  return s;
}

test('holds 표 검사: 바른 꼴은 통과(배열 effects → 객체) · 상태 하나·없는 state·첫 상태로 여는 state·모르는 키·kill/permanent 는 오류 · 다시 차는 수납은 경고', () => {
  const t = holdsTables();
  assert.deepStrictEqual(errs(t), [], errs(t).join('\n'));
  const db = T.load(t);
  assert.deepStrictEqual(db.objects.t_locker.holds.effects, { food: 2 }, '배열 꼴 effects 가 객체 꼴로');
  assert.strictEqual(E.openStateOf(db.objects.t_locker), 'open', "기본: 'open'");
  assert.strictEqual(E.openStateOf(db.objects.t_drum), 'empty', 'holds.state 가 먼저');
  assert.ok(!db.warnings.some((w) => w.kind === 'holdsRefill'));
  const bad = (edit, needle) => { const x = holdsTables(edit); const e = errs(x); assert.ok(e.some((m) => m.includes(needle)), `${needle}\n${e.join('\n')}`); };
  bad((x) => { x.objects.find((o) => o.id === 't_locker').states = ['closed']; }, '두 상태 이상');
  bad((x) => { x.objects.find((o) => o.id === 't_drum').holds.state = 'gone'; }, 'holds.state: "gone"');
  bad((x) => { x.objects.find((o) => o.id === 't_drum').holds.state = 'shut'; }, '닫힌 상태(states[0] "shut")와 같다');
  bad((x) => { x.objects.find((o) => o.id === 't_locker').holds.item = 'can'; }, 'holds.item');
  bad((x) => { x.objects.find((o) => o.id === 't_locker').holds.effects = [{ verb: 'kill', who: 'you' }]; }, 'kill·permanent 는 쓸 수 없다');
  bad((x) => { x.objects.find((o) => o.id === 't_locker').holds.effects = { foood: 1 }; }, 'holds.effects.foood');
  bad((x) => { x.objects.find((o) => o.id === 't_locker').holds = [1]; }, 'holds: {열:값} 꼴');
  const w = T.warnings(holdsTables((x) => { x.objects.find((o) => o.id === 't_locker').resetOn = 'morning'; }));
  assert.ok(w.some((x) => x.kind === 'holdsRefill' && x.id === 't_locker'), JSON.stringify(w));
  const r = T.warnings(holdsTables((x) => { x.objects.find((o) => o.id === 't_locker').holds.text = '배고팠기 때문에 열었다.'; }));
  assert.ok(r.some((x) => x.kind === 'reasonWord' && x.id === 't_locker'), '이유 낱말 경고는 holds.text 도 본다');
  // 빈 holds 는 없는 것
  const e2 = holdsTables((x) => { x.objects.find((o) => o.id === 't_locker').holds = {}; });
  assert.deepStrictEqual(errs(e2), []);
  assert.strictEqual(T.load(e2).objects.t_locker.holds, undefined);
});

test('수납 열기: 닫힌 채 조사 → 내용 적용 → 열린 상태(본 것) · s.found·view.found · 다시 조사하면 아무것도 없음', () => {
  const db = T.load(holdsTables());
  const s = dayOne(db, 2);
  const food = s.world.food, water = s.world.water;
  assert.ok(E.closedHolds(s, db, 't_locker'));
  assert.ok(E.dispatch(s, { type: 'inspect', object: 't_locker' }, db).ok);
  assert.strictEqual(s.pending, null);
  assert.strictEqual(s.world.food, food + 2);
  assert.deepStrictEqual([s.traces.t_locker.st, s.traces.t_locker.seen, s.traces.t_locker.by, s.traces.t_locker.day], ['open', true, 'you', 1]);
  assert.deepStrictEqual(s.found, { object: 't_locker', state: 'open', day: 1, text: '건빵 두 봉지가 있었다.', lines: [{ kind: 'number', id: 'food', who: null, from: food, to: food + 2 }] });
  assert.deepStrictEqual(E.view(s, db).found, s.found, 'view.found');
  assert.ok(!E.closedHolds(s, db, 't_locker'));
  assert.ok(E.dispatch(s, { type: 'inspect', object: 't_locker' }, db).ok);
  assert.strictEqual(s.world.food, food + 2, '연 것은 다시 차지 않는다');
  assert.strictEqual(s.found, null, '다음 조사가 found 를 지운다');
  // 연 뒤 상태 지정
  E.dispatch(s, { type: 'inspect', object: 't_drum' }, db);
  assert.deepStrictEqual([s.traces.t_drum.st, s.world.water, s.found.text], ['empty', water + 1, '']);
  // 연 것은 아침에도 열린 채 (resetOn never)
  let g = 0;
  while (s.day === 1 && !s.ended && g++ < 40) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  E.dispatch(s, { type: 'next' }, db);
  assert.strictEqual(s.traces.t_locker.st, 'open');
  assert.strictEqual(s.found, null, 'next 가 found 를 지운다');
});

test('수납 열기는 사건 뒤: 조사 전에 걸린 사건이 있으면 열지 않는다 · 그 조사에 걸린 사건이 먼저', () => {
  const db = T.load(holdsTables((t) => {
    t.events.push(ev('t_locker_story', 'fixed', 'day==1 & inspect:t_locker & !flag:t_saw', [pass('본다', { effects: { flag: { t_saw: true } } })]));
  }));
  const s = dayOne(db, 3);
  const food = s.world.food;
  s.pending = { id: 'trip_a1_stall', kind: 'trip' };
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  assert.strictEqual(s.traces.t_locker.st, 'closed', '걸린 사건이 있는 동안은 열지 않는다');
  assert.strictEqual(s.pending.id, 'trip_a1_stall');
  s.pending = null;
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  assert.strictEqual(s.pending && s.pending.id, 't_locker_story', '그 조사에 걸린 사건이 먼저');
  assert.deepStrictEqual([s.traces.t_locker.st, s.world.food], ['closed', food]);
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  assert.deepStrictEqual([s.pending, s.traces.t_locker.st, s.world.food], [null, 'open', food + 2], '사건 조건이 더는 안 맞으면 holds 가 기본 흐름');
});

test('원정 중 조사: inspect: 원정 사건은 도착 때가 아니라 그 물건을 조사할 때 걸린다 · 거절해도 다시 조사해 위험 없이 꺼내지 못한다', () => {
  const db = T.load(holdsTables((t) => {
    t.events = t.events.filter((e) => e.id !== 'trip_a1_stall');
    // inspect: 가 | 로 섞여 있어도 도착 사건이 아니다(도착 때 floor==1 이 맞아도 걸지 않는다)
    t.events.push(ev('trip_t_or', 'trip', 'region==B & (inspect:t_drum | floor==1) & day==99', [pass('지나간다')]));
  }));
  const s = dayOne(db, 4);
  assert.strictEqual(E.dispatch(s, { type: 'inspect', object: 't_cabinet' }, db).ok, true);
  assert.strictEqual(s.pending, null, '원정이 아니면 원정 사건은 안 걸린다');
  // (원정 밖에서는 region 이 비어 그 원정 사건 조건이 안 맞으니 수납을 쥐지 않는다 — 화면에서는 배수로 지도 밖에서 이 물건을 조사할 수 없다)
  const s2 = dayOne(db, 4);
  assert.strictEqual(E.dispatch(s2, { type: 'trip', region: 'B', floor: 1 }, db).ok, false, '도착 사건이 없으면 옛 꼴은 false');
  assert.ok(s2.trip && s2.trip.floor === 1, '그래도 원정은 시작됐다');
  const s3 = dayOne(db, 4);
  assert.strictEqual(E.dispatch(s3, { type: 'trip', region: 'B', floor: 1, walk: true }, db).ok, true, 'walk: 층에 들어섰으면 ok');
  assert.strictEqual(s3.pending, null, 'inspect: 원정 사건은 도착 때 걸지 않는다');
  const meds = s3.world.meds;
  E.dispatch(s3, { type: 'inspect', object: 't_cabinet' }, db);
  assert.strictEqual(s3.pending && s3.pending.id, 'trip_t_cabinet');
  assert.strictEqual(s3.traces.t_cabinet.st, 'closed', '사건이 먼저 — holds 는 안 열렸다');
  E.dispatch(s3, { type: 'choose', i: 0 }, db);                        // 둔다
  E.dispatch(s3, { type: 'inspect', object: 't_cabinet' }, db);
  assert.strictEqual(s3.pending, null, '같은 원정에서 같은 사건은 한 번');
  assert.deepStrictEqual([s3.traces.t_cabinet.st, s3.world.meds, s3.found], ['closed', meds, null], '거절한 뒤 다시 조사해도 holds 가 위험 없이 열리지 않는다(사건이 쥐고 있다)');
  // 아래층에 내려가면 1층 사건 조건(floor==1)이 안 맞는다 — 그 층의 물건이 아니니 화면에서는 조사할 수 없다
  assert.ok(E.dispatch(s3, { type: 'trip', floor: 2, walk: true }, db).ok);
  assert.strictEqual(s3.trip.floor, 2);
  // 다른 판: 사건으로 비틀어 연다 → 사건 결과가 내용(약 2) · 열림. holds 는 다시 주지 않는다
  const s4 = dayOne(db, 5);
  E.dispatch(s4, { type: 'trip', region: 'B', floor: 1, walk: true }, db);
  const m4 = s4.world.meds;
  E.dispatch(s4, { type: 'inspect', object: 't_cabinet' }, db);
  E.dispatch(s4, { type: 'choose', i: 1 }, db);
  assert.deepStrictEqual([s4.traces.t_cabinet.st, s4.world.meds], ['open', m4 + 2]);
  E.dispatch(s4, { type: 'inspect', object: 't_cabinet' }, db);
  assert.deepStrictEqual([s4.pending, s4.world.meds], [null, m4 + 2]);
  // 쥐지 않은 수납은 원정 중에도 holds 로 열린다 (t_drum 의 trip_t_or 는 day==99 라 조건이 안 맞는다)
  E.dispatch(s4, { type: 'inspect', object: 't_drum' }, db);
  assert.deepStrictEqual([s4.pending, s4.traces.t_drum.st], [null, 'empty']);
});

test('원정 도착 사건 고르기는 그대로: inspect: 가 없는 원정 사건만, 같은 시드면 같은 사건', () => {
  const plain = T.load(holdsTables((t) => { t.events = t.events.filter((e) => e.id !== 'trip_t_cabinet'); }));
  const gated = T.load(holdsTables());
  for (let seed = 1; seed <= 8; seed++) {
    const a = dayOne(plain, seed), b = dayOne(gated, seed);
    assert.ok(E.dispatch(a, { type: 'trip', region: 'B', floor: 1 }, plain).ok);
    assert.ok(E.dispatch(b, { type: 'trip', region: 'B', floor: 1, walk: true }, gated).ok);
    assert.strictEqual(a.pending.id, 'trip_a1_stall');
    assert.deepStrictEqual([b.pending.id, b.rng], [a.pending.id, a.rng], `시드 ${seed}: inspect: 원정 사건이 있어도 도착 사건·난수 쓰임이 같다`);
  }
});

test('저장: 연 수납·found 가 왕복하고 · 깨진 found·옛 저장(found 없음)은 null', () => {
  const db = T.load(holdsTables());
  const s = dayOne(db, 6);
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  const back = E.normalize(JSON.parse(JSON.stringify(s)), db);
  assert.deepStrictEqual([back.traces.t_locker.st, back.found && back.found.object], ['open', 't_locker']);
  const raw = JSON.parse(JSON.stringify(s)); delete raw.found;
  assert.strictEqual(E.normalize(raw, db).found, null);
  const raw2 = JSON.parse(JSON.stringify(s)); raw2.found = { object: 'nope' };
  assert.strictEqual(E.normalize(raw2, db).found, null);
  const store = SAVE.createStore({ storage: SAVE.memoryStorage(), db });
  assert.ok(store.save(s));
  const r = store.load();
  assert.deepStrictEqual([r.state.traces.t_locker.st, r.state.traces.t_locker.seen, r.state.found.object], ['open', true, 't_locker'], '저장소 왕복');
});

test('봇 원정 지도 뒤지기: 그 층 지도의 닫힌 수납·inspect: 원정 사건 물건을 지도 순서대로 조사한다', () => {
  const db = T.load(holdsTables());
  for (let seed = 1; seed <= 6; seed++) {
    const s = dayOne(db, seed);
    const trace = { choices: 0, trips: 0, known: {}, hunger: [], d3: null };
    assert.ok(E.dispatch(s, { type: 'trip', region: 'B', floor: 1, walk: true }, db).ok);
    while (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db);      // 도착 사건(trip_a1_stall)
    const food = s.world.food, water = s.world.water;
    const log = [];
    const raw = E.dispatch;
    E.dispatch = (st, a, d) => { if (a && a.type === 'inspect') log.push(a.object); return raw(st, a, d); };
    let n;
    try { n = B.tripSearch(s, db, B.POLICIES.balanced, trace); } finally { E.dispatch = raw; }
    assert.deepStrictEqual(log, ['t_locker', 't_drum', 't_cabinet'], `시드 ${seed}`);
    assert.strictEqual(n, 3);
    assert.strictEqual(trace.searched, 3);
    assert.deepStrictEqual([s.traces.t_locker.st, s.traces.t_drum.st, s.world.food, s.world.water], ['open', 'empty', food + 2, water + 1]);
    assert.strictEqual(s.pending, null, '수납장 사건은 봇이 골랐다');
    assert.ok(s.done.trip_t_cabinet === undefined && s.trip.done.includes('trip_t_cabinet'));
  }
  // 1층에 없는 지도(2층 mall/drain 지도가 픽스처에 없음)는 건너뛴다
  const s = dayOne(db, 7);
  E.dispatch(s, { type: 'trip', region: 'A', floor: 1, walk: true }, db);
  while (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(B.tripSearch(s, db, B.POLICIES.balanced, {}), 0);
});

test('봇의 원정 지도 이름(TRIP_MAPS)이 화면 game.js 의 TRIP_MAPS 와 같다', (t) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const m = /const TRIP_MAPS\s*=\s*(\{[^}]*\})/.exec(src);
  if (!m) { t.skip('game.js 에 TRIP_MAPS 줄이 없다(화면이 바꿨으면 이 검사를 맞춘다)'); return; }
  const screen = Function(`return (${m[1]});`)();
  assert.deepStrictEqual(screen, B.TRIP_MAPS);
  const db = T.loadDir(path.join(__dirname, '..', 'data'));
  for (const ids of Object.values(B.TRIP_MAPS)) for (const id of ids) assert.ok(db.maps[id], `maps 에 ${id}`);
});
