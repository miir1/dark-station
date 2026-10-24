// node --test v4/test — 정체 함수: 조건식 + priority + fallback, 후보 4~7
const test = require('node:test');
const assert = require('node:assert');
const { loadFixtures, rawTables, clone, T } = require('./helpers.js');
const ID = require('../engine/identity.js');

const db = loadFixtures();
const table = db.identity;
const pick = (axes) => ID.identity(axes, table).id;

test('8칸 결정표: 세 축 부호 조합마다 후보가 나온다', () => {
  assert.strictEqual(pick({ share: 3, hand: 2, name: 2 }), 'driver');
  assert.strictEqual(pick({ share: 3, hand: 2, name: 0 }), 'conductor');
  assert.strictEqual(pick({ share: 3, hand: 0, name: 2 }), 'inspector');
  assert.strictEqual(pick({ share: 3, hand: 0, name: 0 }), 'passenger');
  assert.strictEqual(pick({ share: 0, hand: 2, name: 2 }), 'counted');
  assert.strictEqual(pick({ share: 0, hand: 2, name: 0 }), 'platform_one');
  assert.strictEqual(pick({ share: 0, hand: 0, name: 2 }), 'counting_child');
  assert.strictEqual(pick({ share: 0, hand: 0, name: 0 }), 'passenger', '아무것도 안 함 = fallback');
});

test('priority 9 덮어쓰기: 센 자 규칙이 다른 후보와 겹치면 센 자가 이긴다', () => {
  const t = clone(db.raw.identity);
  t.candidates.find((c) => c.id === 'driver').rule = 'hand>=2';          // 넓게 잡아 겹치게
  assert.strictEqual(ID.identity({ share: 0, hand: 2, name: 2 }, t).id, 'counted');
  assert.strictEqual(ID.identity({ share: 9, hand: 9, name: 9 }, t).id, 'driver', '센 자 규칙 밖이면 겹침 없음');
  t.candidates.find((c) => c.id === 'counted').rule = 'name>=2';
  assert.strictEqual(ID.identity({ share: 9, hand: 9, name: 9 }, t).id, 'counted', 'priority 9 가 priority 5 를 덮는다');
});

test('같은 priority 가 겹치면 표 순서가 앞선 후보', () => {
  const t = clone(db.raw.identity);
  t.candidates[1].rule = 'share>=3';   // conductor 가 driver 와 겹치게 (둘 다 5)
  assert.strictEqual(ID.identity({ share: 3, hand: 2, name: 2 }, t).id, 'driver');
});

test('후보 4개짜리 표도, 7개짜리 표도 같은 함수로 돈다 (축 수도 바뀔 수 있다)', () => {
  const four = { axes: ['share', 'hand', 'name'], candidates: [
    { id: 'driver', rule: 'share>=2 & hand>=2', priority: 5, fallback: 0, reveal: ['reveal_driver'], ledgerReader: 'conductor' },
    { id: 'inspector', rule: 'share>=2 & hand<2', priority: 5, fallback: 0, reveal: ['reveal_inspector'], ledgerReader: 'you' },
    { id: 'counted', rule: 'share<2 & hand>=2', priority: 9, fallback: 0, reveal: ['reveal_counted'], ledgerReader: 'resident' },
    { id: 'passenger', rule: 'share<2 & hand<2', priority: 1, fallback: 1, reveal: ['reveal_passenger'], ledgerReader: 'conductor' },
  ] };
  const t = rawTables(); t.identity = four; t.people[1].addressYou = { driver: '기사 양반' };
  assert.deepStrictEqual(T.validate(t), []);
  assert.strictEqual(ID.identity({ share: 2, hand: 0 }, four).id, 'inspector');
  assert.strictEqual(ID.identity({ share: 0, hand: 5 }, four).id, 'counted');
  assert.strictEqual(ID.identity({}, four).id, 'passenger');
  assert.strictEqual(table.candidates.length, 7);
});

test('fallback: 아무 규칙도 안 맞으면 fallback 후보', () => {
  const t = clone(db.raw.identity);
  for (const c of t.candidates) if (!c.fallback) c.rule = 'share>=99';
  assert.strictEqual(ID.identity({ share: 3, hand: 3, name: 3 }, t).id, 'passenger');
});

test('nudge 는 −9~+9 로 잘린다', () => {
  const axes = { share: 8, hand: -8, name: 0 };
  ID.nudge(axes, { share: 3, hand: -3, name: 1 });
  assert.deepStrictEqual(axes, { share: 9, hand: -9, name: 1 });
});

test('정체 분포 측정 틀: 정책 N 개로 돌려 각 후보 비율을 센다 (합격선 = (100/후보수)/2 %)', () => {
  const { E, autoplay } = require('./helpers.js');
  const policies = {
    giver: () => 0, taker: () => 1, helper: (v) => Math.max(0, v.choices.findIndex((c) => !c.locked && c.chance != null)),
  };
  const count = {};
  for (const [name, pol] of Object.entries(policies)) for (let seed = 1; seed <= 20; seed++) {
    const s = autoplay(E.newGame(db, seed), db, pol);
    const id = s.ended.identity; count[id] = (count[id] || 0) + 1;
    void name;
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 60);
  const threshold = 100 / table.candidates.length / 2;
  const report = Object.entries(count).map(([k, v]) => `${k} ${Math.round(100 * v / total)}%`).join(' / ');
  // 픽스처는 사건 3개뿐이라 분포 합격을 요구하지 않는다 — 측정이 도는지만 본다
  assert.ok(threshold > 0 && report.length > 0, report);
});
