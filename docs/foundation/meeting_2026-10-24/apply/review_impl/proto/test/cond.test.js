// node --test v4/test — 조건식
const test = require('node:test');
const assert = require('node:assert');
const C = require('../engine/cond.js');

test('비교·논리·깃발·빈칸', () => {
  const ctx = { day: 5, hunger: 7, phase: 'night', flags: { parts_hidden: true } };
  assert.strictEqual(C.test('day==5&phase==night', ctx), true);
  assert.strictEqual(C.test('day==5 & phase==ration', ctx), false);
  assert.strictEqual(C.test('hunger>=7 | day<0', ctx), true);
  assert.strictEqual(C.test('flag:parts_hidden', ctx), true);
  assert.strictEqual(C.test('!flag:parts_hidden', ctx), false);
  assert.strictEqual(C.test('(day==1 | day==5) & hunger>6', ctx), true);
  assert.strictEqual(C.test('share<=-2', { share: -3 }), true);
  assert.strictEqual(C.test('', ctx), true);
  assert.strictEqual(C.test('-', ctx), true);
  assert.strictEqual(C.test(undefined, ctx), true);
  assert.strictEqual(C.test('unknown>=1', ctx), false, '모르는 이름은 0');
  assert.strictEqual(C.test('day', { day: 0 }), false);
});

test('잘못된 식은 어디가 틀렸는지 말하며 던진다', () => {
  assert.throws(() => C.parse('day == & phase'), /비교 값 없음/);
  assert.throws(() => C.parse('== 3'), /이름이 와야 함/);
  assert.throws(() => C.parse('day >='), /비교 값 없음/);
  assert.throws(() => C.parse('(day==1'), /괄호 닫힘 없음/);
  assert.throws(() => C.parse('day==1 ) x'), /남는 토큰/);
  assert.throws(() => C.parse('day @ 1'), /해석 불가/);
});

test('names: 식에 나온 이름 전부', () => {
  assert.deepStrictEqual(C.names(C.parse('hunger>=7 & flag:x | !you_x')).sort(), ['flag:x', 'hunger', 'you_x']);
});
