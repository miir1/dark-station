// node --test v4/test — 코디네이터 결정 ①②③ (2026-10-21): 조건식 접두 토큰 · effects 배열 꼴 정규화 · 정체 규칙은 축만
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { rawTables, loadFixtures, clone, T, E } = require('./helpers.js');
const C = require('../engine/cond.js');

test('① 접두 토큰: inspect: trace:x==v talk: alive: 와 map== region== floor== needs.x', () => {
  const ctx = { day: 2, map: 'car', region: 'A', floor: 1, needs: { hunger: 8 }, flags: { met: true },
    inspect: { lever: 1 }, trace: { lever: 'up', bag: 'closed' }, talk: { gicheol: 1 }, alive: { soonrye: 1, mari: 0 } };
  assert.strictEqual(C.test('day==2 & map==car & inspect:lever & trace:lever==up', ctx), true);
  assert.strictEqual(C.test('inspect:bag', ctx), false);
  assert.strictEqual(C.test('trace:bag==closed & trace:bag!=open', ctx), true);
  assert.strictEqual(C.test('trace:nothing==none', ctx), true, '없는 흔적은 none');
  assert.strictEqual(C.test('talk:gicheol & !talk:mari', ctx), true);
  assert.strictEqual(C.test('alive:soonrye & !alive:mari', ctx), true);
  assert.strictEqual(C.test('region==A & floor==1', ctx), true);
  assert.strictEqual(C.test('needs.hunger>=7', ctx), true);
  assert.strictEqual(C.test('flag:met & !flag:gone', ctx), true);
  assert.deepStrictEqual(C.names(C.parse('inspect:bag & trace:x==up | flag:y')), ['inspect:bag', 'trace:x', 'flag:y']);
});

test('① 사건은 조사·말 걸기 직후에 when 의 inspect:/talk: 로 걸린다', () => {
  const t = rawTables();
  t.events.push({ id: 'pro_stairs', kind: 'trial', when: 'day==0 & inspect:stairs', grade: 'normal', text: '계단 한가운데 재가 멈춰 있다.',
    choices: [{ label: '오른다', hint: '순례: 줄 넘지 마', out: { text: '발목부터 재가 됐다.', effects: { kill: { who: 'you' } } } }, { label: '물러선다', out: { text: '' } }] });
  t.events.push({ id: 'talk_soonrye', kind: 'trial', when: 'day==0 & talk:soonrye', grade: 'normal', text: '"대답하지 마."',
    choices: [{ label: '끄덕인다', out: { text: '', effects: { flag: { warned: true } } } }] });
  const db = T.load(t);
  const s = E.newGame(db, 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.strictEqual(s.pending, null);
  assert.ok(E.dispatch(s, { type: 'inspect', object: 'stairs' }, db).ok);
  assert.deepStrictEqual(s.pending, { id: 'pro_stairs', kind: 'trial' });
  assert.strictEqual(E.dispatch(s, { type: 'inspect', object: 'stairs' }, db).ok, true, '조사 중에도 조사는 되지만');
  assert.strictEqual(s.pending.id, 'pro_stairs', '걸린 사건은 그대로');
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.strictEqual(s.pending, null);
  E.dispatch(s, { type: 'next' }, db);                   // evening: talk 허용
  assert.ok(E.dispatch(s, { type: 'talk', who: 'soonrye' }, db).ok);
  assert.strictEqual(s.pending.id, 'talk_soonrye');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.ok(s.flags.warned);
  E.dispatch(s, { type: 'inspect', object: 'stairs' }, db);
  assert.strictEqual(s.pending, null, '한 번 끝난 시험은 다시 안 걸린다');
});

test('② effects 배열 꼴은 로더가 객체 꼴로 바꾼다 (number/flag/trace/axis/injure/kill/permanent, who 포함)', () => {
  const arr = [{ verb: 'number', id: 'food', n: -1 }, { verb: 'number', id: 'hunger', who: 'actor', n: -3 }, { verb: 'flag', id: 'x', set: true },
    { verb: 'flag', id: 'y', set: false }, { verb: 'trace', id: 'crate_food', state: 'open' }, { verb: 'axis', id: 'share', n: 1 },
    { verb: 'injure', who: 'target', n: 1 }, { verb: 'kill', who: 'target', how: 'pillow' }, { verb: 'permanent', who: 'you', loss: 'finger' }];
  assert.deepStrictEqual(T.effectsToObject(arr, 'x'), { food: -1, hunger: { who: 'actor', n: -3 }, flag: { x: true, y: false }, trace: { crate_food: 'open' },
    axis: { share: 1 }, injure: { who: 'target', n: 1 }, kill: { who: 'target', how: 'pillow' }, permanent: { who: 'you', kind: 'finger' } });
  assert.throws(() => T.effectsToObject([{ verb: 'teleport' }], 'nightEvents[0] z'), /nightEvents\[0\] z: 모르는 효과 동사 "teleport"/);
  // 표에 배열 꼴 + 빈 check/cost/req + target '' + candidate 열이 섞여 있어도 읽힌다
  const t = rawTables();
  t.nightEvents[0].effects = [{ verb: 'number', id: 'food', n: -1 }, { verb: 'number', id: 'hunger', who: 'actor', n: -3 }];
  t.nightEvents[0].target = '';
  t.nightEvents[0].trace = { crate_food: 'open', bowl_actor: 'full' };
  t.events[3].choices[1] = { label: '지나간다', check: null, cost: {}, req: {}, taboo: '', warn: '', out: { text: '', effects: [], ledger: '' } };
  t.identity.candidates = t.identity.candidates.map((c) => { c = clone(c); c.candidate = c.id; delete c.id; return c; });
  t.identity.thresholds = { share: 3 }; t.identity.note = '메모';
  assert.deepStrictEqual(T.validate(t), []);
  const db = T.load(t);
  assert.deepStrictEqual(db.nightEvents[0].effects, { food: -1, hunger: { who: 'actor', n: -3 } });
  assert.strictEqual(db.identity.candidates[0].id, 'driver');
  assert.strictEqual(db.identity.thresholds, undefined);
  // 돌려 보면 who 가 붙은 수치가 행위자에게 간다
  const s = E.newGame(db, 2); s.people.gicheol.n.hunger = 9;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (s.day < 1) E.dispatch(s, { type: 'next' }, db);
  const ev = s.nightLog.find((e) => e.id === 'r1_steal_food');
  assert.ok(ev, JSON.stringify(s.nightLog));
  assert.ok(s.traces.bowl_gicheol && s.traces.bowl_gicheol.st === 'full', 'bowl_actor → bowl_gicheol: ' + JSON.stringify(s.traces));
  assert.ok(s.people.gicheol.n.hunger < 9 + 1, '행위자 굶주림이 줄었다');
});

test('③ 정체 규칙에 축 밖 이름(fog·flag)이 오면 오류', () => {
  const t = rawTables();
  t.identity.candidates[2].rule = 'share>=3 & fog>=4';
  t.identity.candidates[3].rule = 'flag:x';
  const e = T.validate(t).map((x) => x.text);
  assert.ok(e.some((x) => x.includes('identity[2] inspector: rule: "fog" — 정체 규칙은 축(share·hand·name)만')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('identity[3] passenger: rule: "flag:x" — 정체 규칙은 축')), e.join('\n'));
});

test('밤 사건 조건에 inspect:/talk: (당신의 조작) 이 오면 오류', () => {
  const t = rawTables();
  t.nightEvents[0].cond = 'food>=1 & inspect:crate_food';
  t.nightEvents[1].cond = '!talk:soonrye';
  const e = T.validate(t).map((x) => x.text);
  assert.ok(e.some((x) => x.includes('r1_steal_food: cond: "inspect:crate_food" — 밤 사건 조건에 당신 위치·선택')), e.join('\n'));
  assert.ok(e.some((x) => x.includes('r2_drink: cond: "talk:soonrye"')), e.join('\n'));
});

test('밤 사건 조건 어휘: needs.x · 수치_사람 · alive: · trace: · mostInjured 대상', () => {
  const t = rawTables();
  t.nightEvents.push({ id: 'p4b', role: 'pair', actor: 'mari', target: 'mostInjured', cond: 'meds==0 & injury_gicheol>=2 & alive:gicheol & trace:pillow_gicheol!=blood', weight: 10, kind: 'malice',
    trace: { pillow_gicheol: 'blood' }, effects: { kill: { who: 'target' } }, oncePerRun: 1 });
  t.nightEvents[0].actor = 'needs.hunger>=7';
  assert.deepStrictEqual(T.validate(t), []);
  const db = T.load(t);
  const s = E.newGame(db, 3); s.world.meds = 0; s.people.gicheol.n.injury = 2;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  while (s.day < 1) E.dispatch(s, { type: 'next' }, db);
  assert.ok(s.nightLog.some((e) => e.id === 'p4b' && e.target === 'gicheol'), JSON.stringify(s.nightLog));
});

test('로더는 nightEvents.json 과 night_events.json 둘 다 읽는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds4-'));
  for (const [k, f] of Object.entries(T.FILES)) fs.copyFileSync(path.join(__dirname, 'fixtures', f), path.join(dir, k === 'nightEvents' ? 'nightEvents.json' : f));
  const db = T.loadDir(dir);
  assert.strictEqual(db.nightEvents.length, loadFixtures().nightEvents.length);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('추가 약속: injure 음수(회복) · addressYou.default · 빈 글 비교 · rumor.line 빈칸', () => {
  assert.strictEqual(C.test("needs.bond!=''", { needs: { bond: 'seoha' } }), true);
  assert.strictEqual(C.test("needs.bond!=''", { needs: { bond: '' } }), false);
  assert.strictEqual(C.test("secretFlag!='' & needs.fear>=6", { secretFlag: 'x', needs: { fear: 7 } }), true);
  assert.strictEqual(C.test("secretFlag==''", {}), true, '없는 값도 빈 글');
  assert.strictEqual(C.test('bond!=""', { bond: 'a' }), true);
  assert.throws(() => C.parse("fear>=''"), /빈 글은/);
  const t = rawTables();
  t.people[1].addressYou.default = '자네';
  t.nightEvents[0].rumor = { witness: 'nearestSleeper', line: '' };
  t.nightEvents[2].actor = "needs.bond!='' & self==soonrye";
  t.events[3].choices[0].out.effects = { injure: { who: 'you', n: -1 } };
  assert.deepStrictEqual(T.validate(t), []);
  const db = T.load(t);
  assert.strictEqual(db.nightEvents[0].rumor, undefined, '빈 줄 = 소문 없음');
  const t2 = rawTables(); t2.events[3].choices[0].out.effects = { injure: { who: 'you', n: 0 } };
  assert.ok(T.validate(t2).some((e) => e.text.includes('effects.injure: {who, n:±1~3}')));
  const t3 = rawTables(); t3.people[1].addressYou.ghost = 'x';
  assert.ok(T.validate(t3).some((e) => e.text.includes('addressYou.ghost: identity에 없는 후보 (기본 호칭은 default)')));
  // 음수 injure 는 부상을 줄인다
  const s = E.newGame(db, 2); s.people.you.n.injury = 2;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  s.pending = { id: 'trip_a1_stall', kind: 'trip' };
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.people.you.n.injury, 1);
});
