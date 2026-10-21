// node --test v4/test — 해석기: 결정성·단계 진행·선택·밤 사건의 당신 위치 무관·명부 빈칸·fast 훅
const test = require('node:test');
const assert = require('node:assert');
const { loadFixtures, autoplay, clone, E } = require('./helpers.js');
const N = require('../engine/night.js');

const db = loadFixtures();
const hash = (s) => JSON.stringify(s);

test('결정성: 같은 시드·같은 선택 = 같은 상태, 다른 시드 = 다른 상태', () => {
  const a = autoplay(E.newGame(db, 7), db, () => 1), b = autoplay(E.newGame(db, 7), db, () => 1);
  assert.strictEqual(hash(a), hash(b));
  const c = autoplay(E.newGame(db, 8), db, () => 1);
  assert.notStrictEqual(hash(a), hash(c));
  assert.ok(a.ended && a.ended.why === 'train');
  assert.strictEqual(a.stats.nights, 4);
});

test('단계 진행: phases 표 순서대로, skipIf 로 D0 은 trace·ration·seat 를 건너뛴다', () => {
  const s = E.newGame(db, 1);
  assert.strictEqual(s.day, 0);
  assert.strictEqual(s.phase, 'day');
  assert.deepStrictEqual(s.pending, { id: 'd0_notebook', kind: 'trial' });
  assert.strictEqual(E.dispatch(s, { type: 'next' }, db).ok, false, '선택이 걸려 있으면 next 불가');
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.axes.name, 1);
  assert.ok(s.flags.notebook);
  const seen = [];
  while (s.day === 0) { seen.push(s.phase); E.dispatch(s, { type: 'next' }, db); }
  assert.deepStrictEqual(seen, ['day', 'evening', 'night', 'aftermath']);
  assert.strictEqual(s.phase, 'trace');
  assert.strictEqual(s.day, 1);
});

test('단계가 허용하지 않는 동작은 거절한다 (표의 actions 열)', () => {
  const s = E.newGame(db, 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.strictEqual(s.phase, 'day');
  const r = E.dispatch(s, { type: 'hear', i: 0 }, db);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /지금\(day\)은 할 수 없는 동작: hear/);
  assert.ok(E.dispatch(s, { type: 'treat', who: 'soonrye' }, db).ok, 'day 단계의 treat 는 허용');
  assert.strictEqual(E.dispatch(s, { type: 'nonsense' }, db).ok, false);
  assert.strictEqual(E.dispatch(s, 'next', db).ok, false);
});

test('선택: 비용·조건으로 잠긴 선택지는 고를 수 없고, 판정 % 는 화면과 같다', () => {
  const s = E.newGame(db, 3);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (!(s.day === 1 && s.phase === 'ration')) E.dispatch(s, { type: 'next' }, db);
  const v = E.eventView(s, db);
  assert.strictEqual(v.id, 'd1_bowls');
  assert.strictEqual(v.choices[2].chance, 65, 'base 60 + talk 1 × 5');
  s.world.meds = 0;
  while (!(s.day === 2 && s.phase === 'night')) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  const v2 = E.eventView(s, db);
  assert.strictEqual(v2.id, 'd2_shutter');
  assert.strictEqual(v2.explicit, true);
  assert.strictEqual(v2.choices[2].locked, true);
  assert.match(v2.choices[2].reason, /약품/);
  assert.strictEqual(E.dispatch(s, { type: 'choose', i: 2 }, db).ok, false);
  assert.ok(E.dispatch(s, { type: 'choose', i: 1 }, db).ok);
  assert.strictEqual(s.done.d2_shutter, 2);
});

test('당신 사망: 경고가 보이는 선택으로 죽으면 그 자리에서 끝, 명부는 주민이 읽는다', () => {
  const s = E.newGame(db, 5);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (!(s.day === 2 && s.phase === 'night')) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  const v = E.eventView(s, db);
  assert.strictEqual(v.choices[0].hint, '낮에 여럿의 발소리가 났다', '죽는 길에는 경고가 붙어 있다');
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.people.you.status, 'dead');
  assert.strictEqual(s.ended.why, 'you_gone');
  assert.strictEqual(s.ended.reader, 'resident');
  assert.strictEqual(E.dispatch(s, { type: 'next' }, db).ok, false);
});

test('밤 사건은 당신 위치와 무관하다: pos 만 다른 두 상태 → 같은 흔적·소문·기록', () => {
  const a = E.newGame(db, 11), b = E.newGame(db, 11);
  E.dispatch(a, { type: 'move', map: 'station', x: 1, y: 1 }, db);
  E.dispatch(b, { type: 'move', map: 'drain_b1', x: 4, y: 1 }, db);
  // 굶주림을 올려 사건이 확실히 일어나게
  for (const s of [a, b]) { s.people.gicheol.n.hunger = 9; s.people.seoha.n.thirst = 9; }
  const pick = () => 1;
  autoplay(a, db, pick); autoplay(b, db, pick);
  assert.ok(a.nightLog.length >= 2, '밤 사건이 일어났다: ' + a.nightLog.length);
  assert.notDeepStrictEqual(a.pos, b.pos);
  assert.deepStrictEqual(a.nightLog, b.nightLog);
  assert.deepStrictEqual(a.traces, b.traces);
  assert.deepStrictEqual(a.rumors, b.rumors);
});

test('밤 사건 결과는 흔적과 소문으로만 남고, 조사·들음이 발견으로 집계된다', () => {
  const s = E.newGame(db, 2);
  s.people.gicheol.n.hunger = 9;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (!(s.day === 1 && s.phase === 'trace')) E.dispatch(s, { type: 'next' }, db);
  assert.ok(s.nightLog.length >= 1);
  const ev = s.nightLog[0];
  assert.strictEqual(ev.actor === 'you', false);
  assert.strictEqual(N.discovery(s).found, 0);
  if (ev.traces.length) { assert.ok(E.dispatch(s, { type: 'inspect', object: ev.traces[0] }, db).ok); assert.ok(s.traces[ev.traces[0]].seen); }
  else if (ev.rumor) { assert.ok(E.dispatch(s, { type: 'hear', i: 0 }, db).ok); }
  assert.strictEqual(N.discovery(s).found, 1);
  assert.strictEqual(s.nightLog[0].discovered, true);
});

test('oncePerRun 밤 사건은 한 판에 한 번만', () => {
  const s = E.newGame(db, 4);
  s.world.water = 2;
  autoplay(s, db, () => 1);
  const p1 = s.nightLog.filter((e) => e.id === 'p1_soonrye_water');
  assert.strictEqual(p1.length, 1);
  assert.strictEqual(s.onceNight.p1_soonrye_water, p1[0].day);
});

test('명부: 죽은 사람의 사인 칸은 빈칸(___)일 수 있고, 적으면 그 줄이 나온다', () => {
  const s = E.newGame(db, 6);
  s.people.gicheol.n.injury = 3; s.world.meds = 0;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (s.day < 1) E.dispatch(s, { type: 'next' }, db);
  assert.strictEqual(s.people.gicheol.status, 'dead', '위독 + 치료 없음 → 밤에 죽는다');
  assert.strictEqual(s.phase, 'trace');
  assert.ok(E.dispatch(s, { type: 'writeCause', who: 'gicheol' }, db).ok, '빈칸으로 둔다');
  let rows = E.ledger.rows(s, db);
  const g = rows.find((r) => r.id === 'gicheol');
  // 죽은 날: 밤 사건(마리의 베개, D0 밤)이면 0, 아침의 위독 판정이면 1 — 어느 쪽이든 명부에 그 날짜
  const d = s.people.gicheol.day;
  assert.ok(d === 0 || d === 1, '죽은 날 ' + d);
  assert.strictEqual(g.status, 'dead'); assert.strictEqual(g.day, d); assert.strictEqual(g.cause, null);
  assert.ok(E.ledger.format(s, db).some((l) => l === `3 박기철 — 죽었다 D${d} ___`), E.ledger.format(s, db).join('\n'));
  assert.ok(E.dispatch(s, { type: 'writeCause', who: 'gicheol', line: '밤에 갔다' }, db).ok);
  assert.ok(E.ledger.format(s, db).some((l) => l === `3 박기철 — 죽었다 D${d} 밤에 갔다`));
  assert.strictEqual(E.dispatch(s, { type: 'writeCause', who: 'soonrye' }, db).ok, false, '산 사람에겐 사인 칸이 없다');
  assert.strictEqual(E.ledger.rows(s, db)[0].id, 'you', '첫 줄은 당신');
  assert.ok(!E.ledger.rows(s, db).some((r) => r.id === 'eunchae'), '바깥 사람은 명부에 없다');
});

test('수첩 사실 줄: 조사한 흔적만 적을 수 있고 {day} 가 채워진다', () => {
  const s = E.newGame(db, 2);
  s.people.gicheol.n.hunger = 9; s.world.water = 1;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (!(s.day === 1 && s.phase === 'trace')) E.dispatch(s, { type: 'next' }, db);
  const id = Object.keys(s.traces).find((k) => db.objects[k].ledgerFact && db.objects[k].ledgerFact[s.traces[k].st]);
  assert.ok(id, '사실 줄이 있는 흔적이 남았다: ' + JSON.stringify(s.traces));
  assert.strictEqual(E.dispatch(s, { type: 'writeFact', object: id }, db).ok, false, '조사 전엔 못 적는다');
  E.dispatch(s, { type: 'inspect', object: id }, db);
  assert.ok(E.dispatch(s, { type: 'writeFact', object: id }, db).ok);
  assert.match(s.ledger.written[0].text, /^D0 밤\./);
});

test('정체는 축 값이 정한다: 결말에 후보 id 가 붙고 화면 view 에는 축이 없다', () => {
  const s = E.newGame(db, 9);
  s.axes = { share: 3, hand: 2, name: 2 };
  autoplay(s, db, () => 1);
  assert.strictEqual(typeof s.ended.identity, 'string');
  const v = E.view(s, db);
  assert.ok(!('axes' in v) && !('share' in v.world) && !('hunger' in v.world), 'visible=never 수치는 view 에 없다');
});

test('fast 훅: setFast(true) 면 지연 상수가 전부 0, 끄면 원래 값', () => {
  assert.strictEqual(E.DELAYS.step, 230);
  E.setFast(true);
  assert.ok(Object.values(E.DELAYS).every((v) => v === 0));
  assert.strictEqual(E.isFast(), true);
  E.setFast(false);
  assert.strictEqual(E.DELAYS.step, 230);
  assert.strictEqual(E.DELAYS.card, 1400);
});

test('상태는 함수 없는 순수 JSON 이다', () => {
  const s = autoplay(E.newGame(db, 12), db, () => 0);
  const back = JSON.parse(JSON.stringify(s));
  assert.deepStrictEqual(back, s);
  assert.deepStrictEqual(clone(E.normalize(clone(s), db)), s);
});
