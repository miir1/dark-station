// node --test v4/test — 저장: 왕복·직전 아침 사본 복구·둘 다 깨짐·마이그레이션·저장 코드
const test = require('node:test');
const assert = require('node:assert');
const { loadFixtures, autoplay, clone, E } = require('./helpers.js');
const SAVE = require('../engine/save.js');

const db = loadFixtures();
const mk = () => { const storage = SAVE.memoryStorage(); return { storage, store: SAVE.createStore({ storage, db }) }; };

test('저장 왕복: 중간에 저장하고 이어 가도 결과가 같다 (난수 포함)', () => {
  const { store } = mk();
  const a = E.newGame(db, 21);
  E.dispatch(a, { type: 'choose', i: 0 }, db);
  for (let i = 0; i < 5; i++) E.dispatch(a, { type: 'next' }, db);
  store.save(a);
  const b = store.load().state;
  assert.strictEqual(JSON.stringify(b), JSON.stringify(a));
  autoplay(a, db, () => 1); autoplay(b, db, () => 1);
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
});

test('저장 키: ds4.save / ds4.save.prev / ds4.save.broken', () => {
  const { store } = mk();
  assert.deepStrictEqual(store.keys, { main: 'ds4.save', prev: 'ds4.save.prev', broken: 'ds4.save.broken' });
});

test('첫 실행: 저장이 없으면 fresh, 복구도 깨짐도 아니다', () => {
  const { store } = mk();
  const r = store.load();
  assert.deepStrictEqual(r, { state: null, recovered: false, broken: false, fresh: true, message: '' });
});

test('복구: 현재 저장이 깨지면 직전 아침 사본으로 돌아가고 한 줄 안내가 붙는다', () => {
  const { storage, store } = mk();
  const s = E.newGame(db, 31);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (s.day < 1) E.dispatch(s, { type: 'next' }, db);
  store.markMorning(s);                                 // 아침 진입 때 사본
  const morning = JSON.stringify(s);
  for (let i = 0; i < 3; i++) E.dispatch(s, { type: 'next' }, db);
  store.save(s);
  storage.setItem('ds4.save', '{"v":1,"seed":31,"people":');   // 깨진 JSON
  const r = store.load();
  assert.strictEqual(r.recovered, true);
  assert.strictEqual(r.message, '저장이 깨져 직전 아침으로 돌아갔다.');
  assert.strictEqual(JSON.stringify(r.state), morning);
  assert.strictEqual(storage.getItem('ds4.save'), morning, '복구한 사본이 현재 저장으로 다시 써진다');
});

test('복구: 구조가 어긋난 저장(모르는 단계)도 깨진 것으로 본다', () => {
  const { storage, store } = mk();
  const s = E.newGame(db, 32);
  store.markMorning(s);
  const bad = clone(s); bad.phase = 'teatime';
  storage.setItem('ds4.save', JSON.stringify(bad));
  const r = store.load();
  assert.strictEqual(r.recovered, true);
  assert.strictEqual(r.state.phase, 'day');
});

test('둘 다 깨지면: 새 게임 + 깨진 원본을 ds4.save.broken 에 보관', () => {
  const { storage, store } = mk();
  storage.setItem('ds4.save', 'garbage');
  storage.setItem('ds4.save.prev', '{"v":1}');
  const r = store.load();
  assert.strictEqual(r.state, null);
  assert.strictEqual(r.broken, true);
  assert.strictEqual(r.fresh, true);
  assert.strictEqual(storage.getItem('ds4.save.broken'), 'garbage');
  assert.strictEqual(storage.getItem('ds4.save'), null);
  store.clearBroken();
  assert.strictEqual(storage.getItem('ds4.save.broken'), null);
});

test('마이그레이션: v 가 없는 옛 저장은 체인을 거쳐 현재 버전으로 올라온다', () => {
  const { storage, store } = mk();
  const old = clone(E.newGame(db, 33));
  delete old.v; delete old.ledger;                      // v0 꼴
  storage.setItem('ds4.save', JSON.stringify(old));
  const r = store.load();
  assert.ok(r.state, '옛 저장을 읽었다');
  assert.strictEqual(r.state.v, E.SAVE_V);
  assert.deepStrictEqual(r.state.ledger, { causes: {}, written: [] });
  assert.strictEqual(SAVE.migrate({ v: 99 }), null, '미래 버전은 못 읽는다');
  assert.strictEqual(SAVE.migrate(null), null);
});

test('저장 코드 내보내기/불러오기', () => {
  const { store } = mk();
  const s = autoplay(E.newGame(db, 34), db, () => 0);
  const code = store.exportCode(s);
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(code));
  assert.strictEqual(JSON.stringify(store.importCode(code)), JSON.stringify(s));
  assert.strictEqual(store.importCode('not a code'), null);
});

test('저장 실패(용량 등)는 예외 없이 false', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  const store = SAVE.createStore({ storage: broken, db });
  assert.strictEqual(store.save(E.newGame(db, 1)), false);
  assert.strictEqual(store.load().fresh, true);
});
