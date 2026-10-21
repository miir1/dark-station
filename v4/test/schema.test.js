// node --test v4/test  — 표 스키마 검증: 위반한 표·행·열을 집어내는지
const test = require('node:test');
const assert = require('node:assert');
const { rawTables, clone, T } = require('./helpers.js');

const errs = (tables) => T.validate(tables).map((e) => e.text);

test('픽스처 아홉 장은 오류 없이 읽힌다', () => {
  assert.deepStrictEqual(errs(rawTables()), []);
  const db = T.load(rawTables());
  assert.strictEqual(db.phases[0].id, 'trace');
  assert.ok(Object.isFrozen(db.events));
});

test('표가 하나라도 빠지면 어느 표인지 말한다', () => {
  const t = rawTables(); delete t.objects;
  const e = errs(t);
  assert.strictEqual(e.length, 1);
  assert.match(e[0], /^objects\[-1\]: 표가 없음/);
});

test('값 범위 위반: 표 이름·행 번호·id·열 이름이 오류 글에 있다', () => {
  const t = rawTables();
  t.numbers[3].max = 'eight';                 // fog
  t.nightEvents[0].weight = 11;               // r1_steal_food
  t.objects[0].states = ['a', 'b', 'c', 'd', 'e'];
  const e = errs(t);
  assert.ok(e.some((x) => x.startsWith('numbers[3] fog: max: 정수여야')), e.join('\n'));
  const t2 = rawTables(); t2.people[1].skills.str = 7;   // 열 검사를 통과한 뒤 2차(참조·범위) 검사에서 잡힌다
  assert.ok(errs(t2).some((x) => x.startsWith('people[1] soonrye: skills.str: 0~3')), errs(t2).join('\n'));
  assert.ok(e.some((x) => x.startsWith('nightEvents[0] r1_steal_food: weight: 10 초과')), e.join('\n'));
  assert.ok(e.some((x) => x.startsWith('objects[0] crate_food: states: 최대 4개')), e.join('\n'));
});

test('열 이름 위반: 스키마에 없는 열·필수 열 누락·id 꼴', () => {
  const t = rawTables();
  t.events[0].colour = 'red';
  delete t.lines[0].text;
  t.people[2].id = 'Seo-Ha';
  const e = errs(t);
  assert.ok(e.some((x) => x.includes('events[0] d0_notebook: colour: 스키마에 없는 열')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('lines[0] saw_shadow: text: 필수 열이 비었음')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('people[2] Seo-Ha: id: id는 소문자')), e.join('\n'));
});

test('참조 위반: 없는 물건·없는 상태·없는 수치·없는 대사', () => {
  const t = rawTables();
  t.nightEvents[2].trace = { bowl_soonrye: 'cracked', ghost: 'empty' };
  t.events[3].choices[0].out.effects = { gold: 2 };
  t.nightEvents[0].rumor.line = 'no_such_line';
  const e = errs(t);
  assert.ok(e.some((x) => x.includes('p1_soonrye_water: trace.bowl_soonrye: 상태 "cracked"')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('p1_soonrye_water: trace.ghost: objects 표에 없는 물건')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('trip_a1_stall: choices[0]: effects.gold: numbers 표에 없는 수치')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('r1_steal_food: rumor.line: lines에 없음')), e.join('\n'));
});

test('막다른 길: 항상 고를 수 있는 선택지가 없으면 오류', () => {
  const t = rawTables();
  for (const c of t.events[3].choices) c.cost = { food: 1 };
  assert.ok(errs(t).some((x) => x.includes('trip_a1_stall: 항상 고를 수 있는 선택지')));
});

test('조건식 오류는 어느 행인지 말한다', () => {
  const t = rawTables();
  t.events[1].when = 'day == & phase';
  t.identity.candidates[0].rule = 'share>=3 & luck>=1';
  const e = errs(t);
  assert.ok(e.some((x) => x.startsWith('events[1] d1_bowls: when:')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('identity[0] driver: rule: "luck"는 axes에 없는 축')), e.join('\n'));
});

test('밤 사건 조건에 당신 위치·선택이 들어가면 오류', () => {
  const t = rawTables();
  t.nightEvents[0].cond = 'food>=1 & you_x>3';
  t.nightEvents[1].actor = 'thirst>=7 & !pos_near';
  const e = errs(t);
  assert.ok(e.some((x) => x.includes('r1_steal_food: cond: "you_x" — 밤 사건 조건에 당신 위치')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('r2_drink: actor: "pos_near"')), e.join('\n'));
  const t2 = rawTables(); t2.nightEvents[0].actor = 'you';
  assert.ok(errs(t2).some((x) => x.includes('당신은 밤 사건의 행위자가 될 수 없음')));
});

test('정체 결정표: 후보 수 4~7, fallback 정확히 1', () => {
  const t = rawTables();
  t.identity.candidates = t.identity.candidates.slice(0, 3);
  assert.ok(errs(t).some((x) => x.includes('후보는 4~7개 (지금 3)')));
  const t2 = rawTables();
  t2.identity.candidates[0].fallback = 1;
  assert.ok(errs(t2).some((x) => x.includes('fallback=1 인 후보가 정확히 1개여야 함 (지금 2)')));
  const t3 = rawTables();
  t3.identity.candidates.push(clone(t3.identity.candidates[0]), clone(t3.identity.candidates[1]));
  t3.identity.candidates[7].id = 'eight'; t3.identity.candidates[8].id = 'nine';
  assert.ok(errs(t3).some((x) => x.includes('후보는 4~7개 (지금 9)')));
});

test('지도: 줄 길이가 다르면 오류, displayName 만 바꾸면 통과', () => {
  const t = rawTables();
  t.maps[0].rows[2] = '#..k....#';
  assert.ok(errs(t).some((x) => x.includes('maps[0] station: rows[2]: 길이가 첫 줄(10)과 다름')));
  const t2 = rawTables(); t2.maps[0].displayName = '회현삼거리역';
  assert.deepStrictEqual(errs(t2), []);
});
