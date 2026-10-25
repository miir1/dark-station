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

// ── 10-25 최종판: 원정 수납(P1-11) 데이터가 들어오기 전 엔진 흐름 마무리 ──
const ST = require('../sim/stats.js');
const kill = { text: '사물함 문이 목을 쳤다.', effects: [{ verb: 'kill', who: 'you' }] };
// 픽스처 + 2층 지도(drain_b2) + 1층 위험한 상자(t_crate: holds 없음 — 내용은 사건 결과) + 2층 서랍장(t_drawer: holds)
function tripTables(edit) {
  return holdsTables((t) => {
    t.objects.push({ id: 't_crate', name: '못 박힌 상자', states: ['closed', 'open'], solid: 1, resetOn: 'never' });
    t.objects.push({ id: 't_drawer', name: '서랍장', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: { text: '붕대 한 묶음.', effects: [{ verb: 'number', id: 'meds', n: 1 }] } });
    t.events.push(ev('trip_t_crate', 'trip', 'region==B & floor==1 & inspect:t_crate & trace:t_crate==closed', [
      pass('지나간다'),
      { label: '비틀어 연다', check: { skill: 'tech', base: 50 }, warn: '손을 다칠 수 있다',
        ok: { text: '통조림 셋.', effects: [{ verb: 'number', id: 'food', n: 3 }, { verb: 'trace', id: 't_crate', state: 'open' }] },
        fail: { text: '못에 손바닥이 꿰였다.', effects: [{ verb: 'injure', who: 'you', n: 1 }] } },
    ]));
    t.maps.find((m) => m.id === 'drain_b1').objects.push({ id: 't_crate', x: 1, y: 1 });
    t.maps.push({ id: 'drain_b2', displayName: '배수로 아래', rows: ['######', '#....#', '######'], start: [1, 1], dark: 0.4, objects: [{ id: 't_drawer', x: 3, y: 1 }] });
    if (edit) edit(t);
  });
}
// D<d> 낮(걸린 사건 없음)까지 — 사건은 첫 선택지(지나간다·본다)로 넘긴다
function toDay(s, db, d) {
  let g = 0;
  while (!(s.day === d && s.phase === 'day' && !s.pending) && !s.ended && g++ < 200) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  assert.deepStrictEqual([s.day, s.phase, s.pending, !!s.ended], [d, 'day', null, false], `D${d} 낮 도착`);
  return s;
}
// 원정을 나가 도착 사건(픽스처 trip_a1_stall — day>=1 이라 어느 층에나)을 '지나간다'로 넘긴다
function walkIn(s, db, a) { assert.ok(E.dispatch(s, Object.assign({ type: 'trip', walk: true }, a), db).ok); while (s.pending) E.dispatch(s, { type: 'choose', i: 1 }, db); return s; }
// 판정 사건을 고르는데 결과(성공/실패)를 정해 둔다: 같은 상태를 복사해 난수만 바꿔 본다
function chooseWith(s, db, i, want) {
  for (let k = 0; k < 200; k++) {
    const c = clone(s); c.rng = (s.rng + k * 2654435761) >>> 0;
    assert.ok(E.dispatch(c, { type: 'choose', i }, db).ok);
    if (c.lastResult.roll && c.lastResult.roll.success === want) return c;
  }
  throw new Error('원하는 판정 결과를 못 찾음');
}

test('10-25 원정 층에서 수납을 열어 얻는다: 1층 사물함 → 2층 서랍장 · 새 층에 들어서면 found 를 지운다 · 연 수납 수(stats.holds) · 봇 measure·aggregate', () => {
  const db = T.load(tripTables());
  assert.deepStrictEqual(errs(tripTables()), []);
  const s = walkIn(dayOne(db, 11), db, { region: 'B', floor: 1 });
  const food = s.world.food, meds = s.world.meds;
  assert.strictEqual(s.stats.holds, 0, '새 판 0');
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  assert.deepStrictEqual([s.world.food, s.found && s.found.object, s.stats.holds], [food + 2, 't_locker', 1], '1층에서 열어 얻는다');
  walkIn(s, db, { floor: 2 });
  assert.strictEqual(s.trip.floor, 2);
  assert.strictEqual(s.found, null, '새 층에 들어서면 윗층에서 연 수납 결과는 지운다');
  assert.strictEqual(E.view(s, db).found, null);
  assert.ok(E.closedHolds(s, db, 't_drawer'));
  E.dispatch(s, { type: 'inspect', object: 't_drawer' }, db);
  assert.deepStrictEqual([s.world.meds, s.traces.t_drawer.st, s.found.text, s.stats.holds], [meds + 1, 'open', '붕대 한 묶음.', 2], '2층 서랍장');
  // 봇 원정 지도 뒤지기(2층 지도 drain_b2 도) · 집계: 원정 조사 물건 · 연 수납 · 조사로 걸린 원정 사건
  const b = walkIn(dayOne(db, 12), db, { region: 'B', floor: 1 });
  const trace = { choices: 0, trips: 1, known: {}, hunger: [], d3: null };
  assert.strictEqual(B.tripSearch(b, db, B.POLICIES.balanced, trace), 4, '1층: 사물함·드럼통·수납장·상자');
  walkIn(b, db, { floor: 2 });
  assert.strictEqual(B.tripSearch(b, db, B.POLICIES.balanced, trace), 1, '2층: 서랍장');
  assert.strictEqual(b.traces.t_drawer.st, 'open');
  b.ended = { why: 'train', identity: null, ledger: [], cause: null };
  const m = ST.measure(db, b, trace);
  assert.deepStrictEqual([m.searched, m.holdsOpened], [5, 3], '조사 5 · 연 수납 3(사물함·드럼통·서랍장 — 수납장·상자는 사건이 쥔다)');
  assert.strictEqual(m.tripGated, (b.fired.trip_t_cabinet || 0) + (b.fired.trip_t_crate || 0), '조사로 걸린 원정 사건 = 고른 횟수');
  assert.ok(m.tripGated >= 2, '수납장·상자 사건을 골랐다');
  const a = ST.aggregate(db, [m, Object.assign({}, m, { searched: 1, holdsOpened: 1, tripGated: 0 })]);
  assert.deepStrictEqual([a.searched, a.holdsOpened, a.tripGated], [3, 2, m.tripGated / 2]);
  // 옛 저장(stats.holds 없음)은 0
  const old = clone(s); delete old.stats.holds;
  assert.strictEqual(E.normalize(old, db).stats.holds, 0);
});

test('10-25 위험한 수납 판정: 조사하면 원정 사건(비틀어 연다 tech 판정)이 걸린다 — 성공 = 내용·열림 · 실패 = 다침·닫힌 채 · 같은 원정에서 다시 못 함 · 다음 날 원정에서 다시 판정', () => {
  const db = T.load(tripTables());
  const s = walkIn(dayOne(db, 21), db, { region: 'B', floor: 1 });
  E.dispatch(s, { type: 'inspect', object: 't_crate' }, db);
  assert.strictEqual(s.pending && s.pending.id, 'trip_t_crate', '조사로 걸린다(도착 때가 아니다)');
  const v = E.eventView(s, db);
  assert.ok(Number.isFinite(v.choices[1].chance) && v.choices[1].chance > 0 && v.choices[1].chance < 100, `판정 % 가 보인다 (${v.choices[1].chance})`);
  // 성공
  const food = s.world.food;
  const ok = chooseWith(s, db, 1, true);
  assert.deepStrictEqual([ok.world.food, ok.traces.t_crate.st, ok.pending, ok.found], [food + 3, 'open', null, null], '성공: 사건 결과가 내용 — found 는 수납(holds) 몫이라 비어 있다');
  E.dispatch(ok, { type: 'inspect', object: 't_crate' }, db);
  assert.deepStrictEqual([ok.pending, ok.world.food], [null, food + 3], '연 상자는 다시 조사해도 아무것도 없다');
  // 실패
  const inj = s.people.you.n.injury || 0;
  const bad = chooseWith(s, db, 1, false);
  assert.deepStrictEqual([bad.people.you.n.injury, bad.traces.t_crate.st, bad.world.food], [inj + 1, 'closed', food], '실패: 다치고 닫힌 채');
  assert.ok(bad.hurt.some((h) => h.src.includes('trip_t_crate')), '부상 출처 = 그 사건(원인 사건 통계)');
  E.dispatch(bad, { type: 'inspect', object: 't_crate' }, db);
  assert.deepStrictEqual([bad.pending, bad.world.food, bad.traces.t_crate.st], [null, food, 'closed'], '같은 원정에서는 다시 판정하지 못한다');
  // 다음 날 원정에서 다시 판정
  toDay(bad, db, 2);
  walkIn(bad, db, { region: 'B', floor: 1 });
  E.dispatch(bad, { type: 'inspect', object: 't_crate' }, db);
  assert.strictEqual(bad.pending && bad.pending.id, 'trip_t_crate', '다음 원정에서 다시 걸린다');
});

test('10-25 위험한 수납 판정 — 실패가 당신을 죽이면: 사인 = 그 원정 사건 · 경고 있음 · 확정 사망 아님 · 죽음 판정 집계', () => {
  const db = T.load(tripTables((t) => {
    const c = t.events.find((e) => e.id === 'trip_t_crate').choices[1];
    c.warn = '못 열면 끝이다'; c.fail = kill;
  }));
  assert.deepStrictEqual(T.warnings(tripTables((t) => { t.events.find((e) => e.id === 'trip_t_crate').choices[1].fail = kill; })).filter((w) => w.id === 'trip_t_crate').map((w) => w.kind), [], '지나간다가 1번 · 출구가 있다 — firstDeath·noExit 없음');
  const s = walkIn(dayOne(db, 31), db, { region: 'B', floor: 1 });
  E.dispatch(s, { type: 'inspect', object: 't_crate' }, db);
  const dead = chooseWith(s, db, 1, false);
  assert.strictEqual(dead.people.you.status, 'dead');
  assert.ok(dead.ended, '판이 끝난다');
  assert.deepStrictEqual([dead.ended.cause.event, dead.ended.cause.warned, dead.ended.cause.forced], ['trip_t_crate', true, false]);
  assert.deepStrictEqual([dead.stats.deathRolls, dead.stats.closeCalls], [1, 0]);
  const m = ST.measure(db, dead, { trips: 1 });
  assert.deepStrictEqual([m.dead, m.causeKey, m.warned, m.forced], [true, 'trip_t_crate', true, false]);
});

test('10-25 같은 수납 두 번 열기: 같은 원정 · 다음 날 원정 · 저장 왕복 뒤에도 한 번만 얻는다', () => {
  const db = T.load(tripTables());
  const s = walkIn(dayOne(db, 41), db, { region: 'B', floor: 1 });
  const food = s.world.food;
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  E.dispatch(s, { type: 'inspect', object: 't_locker' }, db);
  assert.deepStrictEqual([s.world.food, s.stats.holds, s.found], [food + 2, 1, null], '같은 원정에서 두 번째는 아무것도 없다');
  const back = E.normalize(JSON.parse(JSON.stringify(s)), db);
  E.dispatch(back, { type: 'inspect', object: 't_locker' }, db);
  assert.deepStrictEqual([back.world.food, back.stats.holds, back.traces.t_locker.st], [food + 2, 1, 'open'], '저장 왕복 뒤에도 열린 채');
  toDay(back, db, 2);
  walkIn(back, db, { region: 'B', floor: 1 });
  const f2 = back.world.food;
  E.dispatch(back, { type: 'inspect', object: 't_locker' }, db);
  assert.deepStrictEqual([back.world.food, back.stats.holds, back.traces.t_locker.st, back.found], [f2, 1, 'open', null], '다음 날 원정에서도 다시 차지 않는다');
  assert.ok(!E.closedHolds(back, db, 't_locker'), '봇 원정 뒤지기도 연 수납은 건너뛴다');
});

test('10-25 사건이 쥐는 수납 손질: 원정 아닐 때 원정 사건은 쥐지 않는다 · 아직 안 고른 사건이 대상을 못 정하면 쥐지 않는다(고른 뒤엔 쥔다)', () => {
  // t_box: 수납(holds) + 지역·층 조건이 없는 원정 사건(조사로 걸림) · t_note: 수납 + 대상이 기철인 원정 사건
  const db = T.load(tripTables((t) => {
    t.objects.push({ id: 't_box', name: '철제 함', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: { effects: { food: 1 } } });
    t.objects.push({ id: 't_note', name: '젖은 공책', states: ['closed', 'open'], solid: 0, resetOn: 'never', holds: { effects: { water: 1 } } });
    t.events.push(ev('trip_t_box', 'trip', 'inspect:t_box & trace:t_box==closed', [pass('둔다'), pass('연다', { effects: { food: 2, trace: { t_box: 'open' } } })]));
    t.events.push(ev('trip_t_note', 'trip', 'region==B & inspect:t_note & trace:t_note==closed', [pass('둔다'), pass('이름을 읽는다', { effects: { water: 2, trace: { t_note: 'open' } } })], { target: 'gicheol' }));
    t.maps.find((m) => m.id === 'drain_b2').objects.push({ id: 't_box', x: 1, y: 1 }, { id: 't_note', x: 2, y: 1 });   // 놓는 자리만(배치 검사) — 엔진은 원정 중 자리를 보지 않는다
  }));
  // 원정이 아니면(역에서 조사) 원정 사건은 안 걸리고 수납이 열린다 — 전에는 사건이 '쥐고' 있어 아무 일도 없었다
  const a = dayOne(db, 51);
  const food = a.world.food;
  E.dispatch(a, { type: 'inspect', object: 't_box' }, db);
  assert.deepStrictEqual([a.pending, a.world.food, a.traces.t_box.st], [null, food + 1, 'open']);
  // 원정 중이면 원정 사건이 먼저 · 거절하면 그 원정 동안 수납은 쥔 채
  const b = walkIn(dayOne(db, 52), db, { region: 'B', floor: 1 });
  E.dispatch(b, { type: 'inspect', object: 't_box' }, db);
  assert.strictEqual(b.pending && b.pending.id, 'trip_t_box');
  E.dispatch(b, { type: 'choose', i: 0 }, db);
  const fb = b.world.food;
  E.dispatch(b, { type: 'inspect', object: 't_box' }, db);
  assert.deepStrictEqual([b.pending, b.world.food, b.traces.t_box.st], [null, fb, 'closed'], '거절한 뒤 다시 조사해도 위험 없이 꺼내지 못한다');
  // 대상(기철)이 역에 있으면 사건이 걸린다
  const c = walkIn(dayOne(db, 53), db, { region: 'B', floor: 1 });
  assert.strictEqual(c.people.gicheol.status, 'home');
  E.dispatch(c, { type: 'inspect', object: 't_note' }, db);
  assert.deepStrictEqual([c.pending && c.pending.id, c.pending && c.pending.target], ['trip_t_note', 'gicheol']);
  E.dispatch(c, { type: 'choose', i: 0 }, db);
  c.people.gicheol.status = 'dead';
  const wc = c.world.water;
  E.dispatch(c, { type: 'inspect', object: 't_note' }, db);
  assert.deepStrictEqual([c.pending, c.world.water, c.traces.t_note.st], [null, wc, 'closed'], '이미 고른 사건은 대상이 사라져도 쥔다(거절한 뒤 새지 않는다)');
  // 대상이 없으면(기철이 죽었다) 아직 안 고른 사건은 걸 수 없으니 쥐지 않는다 — 수납이 기본 흐름 (난수도 쓰지 않는다)
  const d = walkIn(dayOne(db, 54), db, { region: 'B', floor: 1 });
  d.people.gicheol.status = 'dead';
  const wd = d.world.water, rng = d.rng;
  E.dispatch(d, { type: 'inspect', object: 't_note' }, db);
  assert.deepStrictEqual([d.pending, d.world.water, d.traces.t_note.st, d.rng], [null, wd + 1, 'open', rng]);
});

test('10-25 옛 저장 정규화: 표에 없는 물건의 흔적은 버리고 · 지금 states 에 없는 상태는 첫 상태로 — 닫힌 수납으로 다시 열 수 있다', () => {
  const db = T.load(tripTables());
  const s = dayOne(db, 61);
  const raw = JSON.parse(JSON.stringify(s));
  raw.traces.t_locker = { st: 'normal', day: 1, by: null, seen: true, late: 0 };   // 옛 표: 사물함이 'normal' 하나뿐이던 때
  raw.traces.gone_thing = { st: 'x', day: 0, by: null, seen: false, late: 0 };
  raw.traces.t_drum = 'broken';
  const o = E.normalize(raw, db);
  assert.deepStrictEqual(o.traces.t_locker, { st: 'closed', day: 0, by: null, seen: false, late: 0 });
  assert.strictEqual(o.traces.gone_thing, undefined);
  assert.strictEqual(o.traces.t_drum.st, 'shut');
  assert.ok(!E.view(o, db).traces.some((t) => t.id === 'gone_thing'));
  assert.ok(E.closedHolds(o, db, 't_locker'));
  const food = o.world.food;
  E.dispatch(o, { type: 'inspect', object: 't_locker' }, db);
  assert.strictEqual(o.world.food, food + 2);
  // 바른 흔적은 그대로
  assert.deepStrictEqual(E.normalize(JSON.parse(JSON.stringify(o)), db).traces.t_locker.st, 'open');
});

test('10-25 표 경고 unknownRef(조건식의 없는 물건·사람·상태) · unplaced(지도에 없는 수납·원정 조사 물건) — 실제 표에는 0', () => {
  const w = (edit) => T.warnings(tripTables(edit)).filter((x) => x.kind === 'unknownRef' || x.kind === 'unplaced').map((x) => `${x.kind} ${x.table}:${x.id} ${x.msg}`);
  assert.deepStrictEqual(w(), [], '바른 픽스처는 경고 없음');
  const got = w((t) => {
    const e = t.events.find((x) => x.id === 'trip_t_crate');
    e.when = 'region==B & floor==1 & inspect:t_crat & trace:t_crate==shut & alive:nobody';
    e.choices[0].req = { cond: 'talk:nobody' };
    e.choices[1].swap = { when: 'trace:t_locker!=opened', warn: '' };
    t.phases.find((p) => p.id === 'evening').skipIf = 'trace:nothing==x';
    t.objects.push({ id: 't_far', name: '먼 함', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: { effects: { food: 1 } } });
    t.objects.push({ id: 't_far2', name: '먼 상자', states: ['closed', 'open'], solid: 1, resetOn: 'never' });
    t.objects.push({ id: 't_empty', name: '빈 함', states: ['closed', 'open'], solid: 1, resetOn: 'never', holds: {} });
    t.events.push(ev('trip_t_far2', 'trip', 'region==A & inspect:t_far2', [pass('둔다')]));
  });
  assert.deepStrictEqual(got, [
    'unknownRef events:trip_t_crate when: "inspect:t_crat" — objects 표에 없는 물건',
    'unknownRef events:trip_t_crate when: "trace:t_crate==shut" — t_crate 의 states(closed/open)에 없는 상태',
    'unknownRef events:trip_t_crate when: "alive:nobody" — people 표에 없는 사람',
    'unknownRef events:trip_t_crate choices[0].req.cond: "talk:nobody" — people 표에 없는 사람',
    'unknownRef events:trip_t_crate choices[1].swap[0].when: "trace:t_locker!=opened" — t_locker 의 states(closed/open)에 없는 상태',
    'unknownRef phases:evening skipIf: "trace:nothing" — objects 표에 없는 물건',
    'unplaced objects:t_far 수납 내용(holds)이 있는 물건인데 어느 지도에도 없다 — 걸어가 열 수 없다 (maps[].objects 에 놓는다)',
    'unplaced objects:t_far2 조사로 걸리는 원정 사건이 가리키는 물건인데 어느 지도에도 없다 — 걸어가 열 수 없다 (maps[].objects 에 놓는다)',
  ]);
  assert.deepStrictEqual(errs(tripTables((t) => { t.events.find((x) => x.id === 'trip_t_crate').when = 'inspect:t_crat'; })), [], '경고일 뿐 — 표는 읽힌다');
  const real = T.loadDir(path.join(__dirname, '..', 'data'));
  assert.deepStrictEqual(real.warnings.filter((x) => x.kind === 'unknownRef' || x.kind === 'unplaced').map((x) => x.text), [], '실제 표(v4/data) — 원정 수납 데이터의 이름·상태 오타');
});
