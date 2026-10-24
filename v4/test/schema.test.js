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
  assert.ok(e.some((x) => x.includes('identity[0] driver: rule: "luck" — 정체 규칙은 축')), e.join('\n'));
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

// ── 배치 검사·경고 (10-24 P0-E2 · U4) ──
// 픽스처 승강장: crate_food(2,2) 단단 · bowl_soonrye(6,5) · bowl_seoha(7,5) · pillow_gicheol(6,6) · stairs(1,1) 단단. 바닥 ',' 은 5~6행, 끝선이 없어 '=' 줄을 따로 만든다
const at = (t, id) => t.maps[0].objects.find((o) => o.id === id);
const warnsOf = (t) => T.warnings(t);
test('배치: 한 칸에 단단한 물건이 둘이면 오류', () => {
  const t = rawTables();
  Object.assign(at(t, 'stairs'), { x: 2, y: 2 });              // crate_food 와 같은 칸
  assert.ok(errs(t).some((x) => x.startsWith('maps[0] station: (2,2) 한 칸에 단단한 물건 2개: crate_food·stairs')), errs(t).join('\n'));
  const t2 = rawTables(); Object.assign(at(t2, 'bowl_soonrye'), { x: 2, y: 2 });   // 단단한 물건 + 단단하지 않은 물건 하나는 된다
  assert.deepStrictEqual(errs(t2), []);
});
test('배치: 단단하지 않은 물건이 한 칸에 여럿이면 같은 주인(id 끝 _<사람>)만 — 다른 주인·주인 없는 둘은 오류', () => {
  const t = rawTables();
  Object.assign(at(t, 'bowl_seoha'), { x: 6, y: 5 });          // 순례 그릇 + 서하 그릇
  assert.ok(errs(t).some((x) => x.includes('(6,5) 다른 주인의 물건이 한 칸에: bowl_soonrye(soonrye)·bowl_seoha(seoha)')), errs(t).join('\n'));
  const t2 = rawTables();
  t2.objects.push({ id: 'cup', name: '컵', states: ['full'], solid: 0 }, { id: 'rag', name: '걸레', states: ['wet'], solid: 0 });
  t2.maps[0].objects.push({ id: 'cup', x: 3, y: 5 }, { id: 'rag', x: 3, y: 5 });
  assert.ok(errs(t2).some((x) => x.includes('(3,5) 주인 없는 물건이 한 칸에 둘 이상: cup(주인 없음)·rag(주인 없음)')), errs(t2).join('\n'));
  const t3 = rawTables();                                      // 같은 주인 = 머리맡 묶음: 기철 베개 + 기철 그릇
  Object.assign(at(t3, 'pillow_gicheol'), { x: 6, y: 5 }); Object.assign(at(t3, 'bowl_soonrye'), { x: 1, y: 5 });
  t3.maps[0].objects.push({ id: 'bowl_gicheol', x: 6, y: 5 });
  assert.deepStrictEqual(errs(t3), []);
});
test('배치: 주인 없는 물건이 한 사람 묶음에 끼면 경고(오류 아님), owner 칸을 적으면 사라지고 틀린 owner 는 오류', () => {
  const t = rawTables();
  t.objects.push({ id: 'scissors', name: '가위', states: ['clean'], solid: 0 });
  t.maps[0].objects.push({ id: 'scissors', x: 6, y: 6 });      // 기철 베개 칸
  assert.deepStrictEqual(errs(t), []);
  const w = warnsOf(t).filter((x) => x.kind === 'owner');
  assert.strictEqual(w.length, 1);
  assert.match(w[0].text, /^maps\[0\] station: \[owner\] \(6,6\) scissors: .*gicheol의 물건과 한 칸.*owner:"gicheol"/);
  t.objects[t.objects.length - 1].owner = 'gicheol';
  assert.deepStrictEqual(errs(t), []);
  assert.strictEqual(warnsOf(t).filter((x) => x.kind === 'owner').length, 0, 'owner 칸 = 주인');
  t.objects[t.objects.length - 1].owner = 'mari';              // 기철 베개와 다른 주인
  assert.ok(errs(t).some((x) => x.includes('(6,6) 다른 주인의 물건이 한 칸에: pillow_gicheol(gicheol)·scissors(mari)')), errs(t).join('\n'));
  const t2 = rawTables(); t2.objects.find((o) => o.id === 'bowl_mari').owner = 'soonrye';
  assert.ok(errs(t2).some((x) => x.includes('bowl_mari: owner: "soonrye" — id 끝(_mari)이 가리키는 주인과 다르다')), errs(t2).join('\n'));
  const t3 = rawTables(); t3.objects.find((o) => o.id === 'stairs').owner = 'ghost';
  assert.ok(errs(t3).some((x) => x.includes('stairs: owner: people 에 없는 사람 "ghost"')), errs(t3).join('\n'));
});
test('배치: 단단하지 않은 물건이 벽(#)·끝선(=) 칸에 있으면 오류, 지도 밖이면 오류 · 단단한 물건은 벽에 둘 수 있다(벽걸이)', () => {
  const t = rawTables();
  Object.assign(at(t, 'bowl_soonrye'), { x: 0, y: 5 });       // '#'
  assert.ok(errs(t).some((x) => x.includes("bowl_soonrye: 단단하지 않은 물건이 '#' 칸 (0,5)에 있다")), errs(t).join('\n'));
  const t2 = rawTables(); t2.maps[0].rows[6] = '#,,===,,,#'; Object.assign(at(t2, 'pillow_gicheol'), { x: 4, y: 6 });
  assert.ok(errs(t2).some((x) => x.includes("pillow_gicheol: 단단하지 않은 물건이 '=' 칸 (4,6)에 있다")), errs(t2).join('\n'));
  const t3 = rawTables(); Object.assign(at(t3, 'bowl_seoha'), { x: 10, y: 5 });
  assert.ok(errs(t3).some((x) => x.includes('bowl_seoha: 자리 (10,5)가 지도 밖')), errs(t3).join('\n'));
  const t4 = rawTables(); Object.assign(at(t4, 'stairs'), { x: 0, y: 1 });
  assert.deepStrictEqual(errs(t4), []);
});
test('경고: 선택지 [0]에 당신 죽음·금기·(아무도 안 죽는 길을 두고) 남의 죽음 → firstDeath, 모든 길이 같은 죽음이면 경고 없음', () => {
  const kinds = (t) => warnsOf(t).filter((x) => x.kind === 'firstDeath').map((x) => x.id);
  const t = rawTables();
  assert.deepStrictEqual(kinds(t), ['d2_shutter'], '픽스처 d2_shutter 1번 "연다" = 당신 죽음');
  const [a, b, c] = t.events[2].choices; t.events[2].choices = [b, a, c];
  assert.deepStrictEqual(kinds(t), [], '죽는 선택을 뒤로 옮기면 사라진다');
  t.events[0].choices[0].taboo = 'take_bowl';
  assert.deepStrictEqual(kinds(t), ['d0_notebook']);
  const t2 = rawTables(); const ev = t2.events[0];             // 남의 죽음: 아무도 안 죽는 '덮는다' 가 뒤에 있으면 경고, 모든 길이 그 사람을 죽이면 경고 없음
  ev.choices[0].out.effects = Object.assign({}, ev.choices[0].out.effects, { kill: { who: 'gicheol' } });
  assert.deepStrictEqual(kinds(t2).filter((x) => x === 'd0_notebook'), ['d0_notebook']);
  ev.choices[1].out.effects = Object.assign({}, ev.choices[1].out.effects, { kill: { who: 'gicheol' } });
  assert.deepStrictEqual(kinds(t2).filter((x) => x === 'd0_notebook'), []);
  assert.deepStrictEqual(errs(t2), [], '경고는 오류가 아니다 — 표는 읽힌다');
  assert.ok(Array.isArray(T.load(t2).warnings), 'db.warnings 로도 읽는다');
});
test("경고: 글에 '때문에·왜냐하면' → reasonWord (사건 본문·선택 결과·대사·밤 사건)", () => {
  const t = rawTables();
  t.events[1].text = '그릇이 모자라기 때문에 다툰다.';
  t.events[3].choices[0].out.text = '왜냐하면 비어 있었다.';
  t.lines[0].text = '배고프기 때문에 갔어.';
  const w = warnsOf(t).filter((x) => x.kind === 'reasonWord').map((x) => `${x.table}:${x.id}`);
  assert.deepStrictEqual(w, ['events:d1_bowls', 'events:trip_a1_stall', 'lines:saw_shadow']);
  assert.deepStrictEqual(errs(t), []);
});
test('실제 표(v4/data): 배치 오류 0 · 1번 자리 죽음 경고 0 · 이유 낱말 경고 0 (남은 경고는 목록으로 보인다)', (t) => {
  const path = require('path');
  const db = T.loadDir(path.join(__dirname, '..', 'data'));     // 배치 오류가 있으면 여기서 던진다
  const byKind = (k) => db.warnings.filter((w) => w.kind === k).map((w) => w.text);
  assert.deepStrictEqual(byKind('firstDeath'), []);
  assert.deepStrictEqual(byKind('reasonWord'), []);
  for (const w of db.warnings) t.diagnostic(w.text);
});

test('지도: 줄 길이가 다르면 오류, displayName 만 바꾸면 통과', () => {
  const t = rawTables();
  t.maps[0].rows[2] = '#..k....#';
  assert.ok(errs(t).some((x) => x.includes('maps[0] station: rows[2]: 길이가 첫 줄(10)과 다름')));
  const t2 = rawTables(); t2.maps[0].displayName = '회현삼거리역';
  assert.deepStrictEqual(errs(t2), []);
});
