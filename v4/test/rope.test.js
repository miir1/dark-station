// node --test v4/test — 10-24 줄타기(tightrope) 엔진 몫 (설계 docs/foundation/meeting_2026-10-24/tightrope/design.md §1-5 R0~R4 · §1-6 · §1-7 · §2-3 · §3)
//   R0 선택지 rope 칸(카르마 구간·눈먼 새벽 → 판정) · R1 강제 = 확정 사망(열린 선택지 전부 살 확률 0)·noExit 새 정의 · R2 firstDeath 에서 줄타기 판정 뺌
//   R3 바닥 ropeFloor · R4 집계(ropeRolls·ropeClose·deathRolls·closeCalls·blindMet) · 봇 사람 흉내 손질 · 아슬함·이른 날·실제 발견율 합격선
const test = require('node:test');
const assert = require('node:assert');
const { rawTables, clone, T, E } = require('./helpers.js');
const S = require('../engine/schema.js');
const B = require('../sim/bots.js');
const ST = require('../sim/stats.js');

const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out, more) => Object.assign({ label, out: Object.assign({ text: '' }, out || {}) }, more || {});
const KILL = { text: '', effects: { kill: { who: 'you' } } };
const errs = (t) => T.validate(t).map((e) => e.text);
const warns = (t) => T.warnings(t);
function withKarma(edit) {
  const t = rawTables();
  t.numbers.push({ id: 'grudge', name: '원한', owner: 'person', min: 0, max: 10, start: 0, perDay: 0, visible: 'never' });
  t.numbers.push({ id: 'karma', owner: 'world', min: 0, max: 30, start: 0, perDay: 0, visible: 'never' });
  if (edit) edit(t);
  return t;
}
const knob = (id, start) => ({ id, owner: 'world', min: 0, max: 100, start, perDay: 0, visible: 'never' });
const toPhase = (s, db, day, phase) => { let g = 0; while (!(s.day === day && s.phase === phase) && !s.ended && g++ < 80) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); } };
// 저녁에 거는 시험 사건 하나 (되풀이 — 같은 상태에서 카르마만 바꿔 본다)
function at(choices, edit, extra) {
  const t = withKarma((x) => { x.events.push(ev('e_rope', 'trial', 'day==0 & phase==evening', choices, Object.assign({ once: 0 }, extra || {}))); if (edit) edit(x); });
  const db = T.load(t);
  const s = E.newGame(db, 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);   // 픽스처 d0_notebook
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'e_rope');
  return { db, s, t };
}
// dawn_strike 꼴: 갚는다(비용) · 버틴다(몸값) · 싸운다(판정) · 가리킨다(금기)
const DAWN = () => [
  pass('그릇 둘을 내민다', { text: '손이 풀렸다.', effects: { karma: -1 } }, { cost: { food: 2 }, rope: { kind: 'pay', fail: { text: '그릇을 받고도 손이 풀리지 않았다.' } } }),
  pass('맞고 버틴다', { effects: { injure: { who: 'you', n: 2 } } }, { warn: '크게 다친다', rope: { kind: 'endure', fail: { text: '갈비뼈가 안으로 꺾였다.' } } }),
  { label: '밀쳐 낸다', warn: '못 밀치면 끝이다', check: { skill: 'str', base: 45 }, ok: { text: '' }, fail: { text: '손목을 떼지 못했다.', effects: { kill: { who: 'you' } } }, rope: { kind: 'fight' } },
  pass('옆 담요를 가리킨다', {}, { taboo: 'give_other', warn: '그 사람이 대신 당한다', rope: { kind: 'point', fail: { text: '아무도 돌아보지 않았다.' } } }),
];
const view = (s, db) => E.eventView(s, db).choices.map((c) => [c.chance, c.warn]);

// ── 손잡이 기본값 = 설계 §1-2 표 ──
test('R0 손잡이 기본값 = 설계 §1-2 (vlo 구간 · fight 깎는 값 0·0·5·10 · 바닥 30 · 눈먼 새벽 85·75·65 · 문턱 5·8·12·16) — numbers 24행 이름', () => {
  const D = S.ROPE_DEFAULTS;
  const row = (k) => [1, 2, 3, 4].map((b) => D[`rope_${k}_${b}`]);
  assert.deepStrictEqual([row('pay'), row('endure'), row('point'), row('fight')], [[92, 90, 85, 78], [88, 85, 78, 70], [82, 70, 55, 40], [0, 0, 5, 10]]);
  assert.deepStrictEqual([1, 2, 3, 4].map((b) => D['rope_k' + b]), [5, 8, 12, 16]);
  assert.deepStrictEqual([D.rope_floor, D.rope_blind_pay, D.rope_blind_endure, D.rope_blind_point], [30, 85, 75, 65]);
  assert.strictEqual(Object.keys(D).length, 24);
  assert.ok(Object.keys(D).every((k) => S.ROPE_KNOB.test(k)));
  for (const k of ['pay', 'endure', 'point']) assert.ok(/끝이다/.test(S.ROPE_TAIL[k]), '꼬리에 끝이다 — 화면을 읽는 사람과 봇(DEADLY)이 같은 뜻으로 읽는다');
  for (const k of ['pay', 'endure', 'point']) assert.ok(B.DEADLY.test(S.ROPE_TAIL[k]));
});

// ── R0 표 칸 ──
test('R0 rope 칸 검사: 받는 꼴 · 빈 칸은 없는 것 · fail.effects 두 꼴 · 오류(모르는 칸·kind·from·blind·skill·how·kill·fight 에 판정 없음·swap 에 rope)', () => {
  const ok = withKarma((t) => t.events.push(ev('e1', 'trial', 'day==0', [pass('본다'),
    pass('불을 키운다', {}, { cost: { fuel: 2 }, rope: { kind: 'pay', from: 0, blind: 0, skill: 'talk', fail: { text: '불이 꺼졌다.', how: 'ascended', image: '', effects: [{ verb: 'trace', id: 'crate_food', state: 'empty' }], ledger: '' } } }),
    pass('버틴다', {}, { rope: '' })])));
  assert.deepStrictEqual(errs(ok), []);
  const db = T.load(ok);
  const c = db.events.e1.choices;
  assert.deepStrictEqual(c[1].rope, { kind: 'pay', from: 0, blind: 0, skill: 'talk', fail: { text: '불이 꺼졌다.', how: 'ascended', effects: { trace: { crate_food: 'empty' } } } });
  assert.ok(!('rope' in c[2]), "rope '' = 없는 것");
  const bad = (rope, want, more) => { const t = withKarma((x) => x.events.push(ev('e2', 'trial', 'day==0', [pass('본다'), Object.assign(pass('갚는다', {}, { rope }), more || {})]))); assert.ok(errs(t).some((m) => m.includes(want)), `${want}\n${errs(t).join('\n')}`); };
  bad({ kind: 'pay', nope: 1 }, 'rope.nope: rope 칸은');
  bad({ kind: 'beg' }, 'rope.kind: pay/endure/point/fight');
  bad({ kind: 'pay', from: -1 }, 'rope.from: 0 이상 정수');
  bad({ kind: 'pay', blind: 'Bad Flag' }, 'rope.blind: 0/1 또는 깃발 id');
  bad({ kind: 'pay', skill: 'luck' }, 'rope.skill');
  bad({ kind: 'pay', fail: { how: 'gone' } }, 'rope.fail.how');
  bad({ kind: 'pay', fail: { effects: { kill: { who: 'target' } } } }, 'rope.fail.effects: kill 은 쓰지 않는다');
  bad({ kind: 'pay', fail: { effects: { nope: 1 } } }, 'rope.fail.effects.nope');
  bad({ kind: 'pay', fail: { text: 'x', why: 1 } }, 'rope.fail.why: rope.fail 칸은');
  bad({ kind: 'fight' }, 'rope.kind fight: 판정(check)이 있는 선택지에만');
  bad({ kind: 'fight', blind: 1 }, '눈먼 새벽은 pay·endure·point 만', { check: { skill: 'str', base: 50 }, ok: { text: '' }, fail: KILL });
  const sw = withKarma((x) => x.events.push(ev('e3', 'trial', 'day==0', [pass('본다'), pass('갚는다', {}, { swap: { when: 'karma>=5', rope: { kind: 'pay' } } })])));
  assert.ok(errs(sw).some((m) => m.includes('rope: swap 에 쓸 수 있는 칸은')), '줄타기는 기본 선택지에만 — swap 이 고른 모습 위에 얹힌다');
});

test('R0·R3 손잡이 행 검사: rope_* 는 세계 수치·visible never · 판정 % 0~100 · 구간·눈먼 새벽 % ≥ 바닥(ropeFloor) · 문턱 오름차순', () => {
  const e = (edit) => errs(withKarma(edit));
  assert.deepStrictEqual(e((t) => t.numbers.push(knob('rope_pay_1', 95), knob('rope_floor', 30), knob('rope_k1', 6))), []);
  assert.ok(e((t) => t.numbers.push(Object.assign(knob('rope_pay_1', 95), { owner: 'person' }))).some((m) => m.includes('owner world')));
  assert.ok(e((t) => t.numbers.push(Object.assign(knob('rope_pay_1', 95), { visible: 'always' }))).some((m) => m.includes('visible never')));
  assert.ok(e((t) => t.numbers.push(Object.assign(knob('rope_pay_1', 120), { max: 200 }))).some((m) => m.includes('0~100')));
  const low = e((t) => t.numbers.push(knob('rope_point_4', 25)));
  assert.ok(low.some((m) => m.startsWith('numbers[') && m.includes('rope_point_4') && m.includes('ropeFloor')), low.join('\n'));
  const hiFloor = e((t) => t.numbers.push(knob('rope_floor', 45)));   // 기본 rope_point_4 40 < 45 → 바닥 행이 틀렸다
  assert.ok(hiFloor.some((m) => m.includes('rope_floor') && m.includes('rope_point_4 40%')), hiFloor.join('\n'));
  assert.ok(e((t) => t.numbers.push(knob('rope_k2', 4))).some((m) => m.includes('오름차순')));
});

test('R3 바닥 ropeFloor (오류): 당신을 죽이는 판정(변형 포함)의 base < rope_floor — 확정 죽음·안 죽이는 판정은 상관없다', () => {
  const mk = (base, more, edit) => withKarma((t) => { t.events.push(ev('e_f', 'trial', 'day==0', [pass('본다'), Object.assign({ label: '버틴다', warn: '끝이다', check: { skill: 'str', base }, ok: { text: '' }, fail: KILL }, more || {})])); if (edit) edit(t); });
  assert.ok(errs(mk(29)).some((m) => m.includes('ropeFloor') && m.includes('base 29 < 바닥 30')));
  assert.deepStrictEqual(errs(mk(30)), []);
  assert.ok(errs(mk(35, null, (t) => t.numbers.push(knob('rope_floor', 40)))).some((m) => m.includes('base 35 < 바닥 40')));
  assert.ok(errs(mk(60, { swap: { when: 'karma>=8', check: { skill: 'str', base: 20 } } })).some((m) => m.includes('swap[0]: ropeFloor')), 'swap 변형도');
  assert.deepStrictEqual(errs(withKarma((t) => t.events.push(ev('e_g', 'trial', 'day==0', [pass('본다'), { label: '줍는다', check: { skill: 'obs', base: 10 }, ok: { text: '' }, fail: { text: '', effects: { injure: { who: 'you', n: 1 } } } }])))), [], '당신을 안 죽이는 판정은 바닥 밖');
  // 지금 표(v4/data)는 바닥 위 (최저 35)
  const path = require('path');
  T.loadDir(path.join(__dirname, '..', 'data'));
});

// ── R0 엔진 ──
test('R0 구간마다 판정 % (화면 % = base + 기술×5, 처음 기술 1) · 경고 꼬리 · 카르마 0~4 는 그대로', () => {
  const { db, s } = at(DAWN());
  const base = [[null, ''], [null, '크게 다친다'], [50, '못 밀치면 끝이다'], [null, '그 사람이 대신 당한다']];
  assert.deepStrictEqual(view(s, db), base, 'K0 = 지금 그대로');
  s.world.karma = 4; assert.deepStrictEqual(view(s, db), base);
  const tails = ['안 받으면 끝이다', '크게 다친다. 못 버티면 끝이다', '못 밀치면 끝이다', '그 사람이 대신 당한다. 아무도 안 돌아서면 끝이다'];
  const want = { 5: [97, 93, 50, 87], 7: [97, 93, 50, 87], 8: [95, 90, 50, 75], 12: [90, 83, 45, 60], 16: [83, 75, 40, 45], 30: [83, 75, 40, 45] };
  for (const [k, ps] of Object.entries(want)) { s.world.karma = Number(k); assert.deepStrictEqual(view(s, db), ps.map((p, i) => [p, tails[i]]), `karma ${k}`); }
  const meta = E.choiceMeta(s, db);
  assert.deepStrictEqual(meta.map((m) => [m.roped, m.swapped, m.killYou, m.check]), [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]]);
  assert.ok(E.eventView(s, db).choices.every((c) => !('roped' in c)), '화면 eventView 에는 줄타기 표시가 안 나간다 — % 와 경고만');
  assert.ok(!('karma' in E.view(s, db).world), '카르마 숫자는 화면에 없다');
  assert.deepStrictEqual(E.eventView(s, db).choices.map((c) => [c.taboo, c.cost]), [[false, { food: 2 }], [false, null], [false, null], [true, null]], '비용·금기는 그대로');
});

test('R0 손잡이: numbers rope_* 행 · 대사표 rope_tail_<kind> 가 기본값을 덮는다 · fight 는 바닥에서 멈춘다 · from(카르마 문턱)', () => {
  const { db, s } = at([pass('본다'), ...DAWN(), { label: '발을 뺀다', warn: '못 빼면 끝이다', check: { skill: 'str', base: 32 }, ok: { text: '' }, fail: KILL, rope: { kind: 'fight' } },
    { label: '창고를 턴다', warn: '들키면 다친다', check: { skill: 'str', base: 50 }, ok: { text: '', effects: { food: 2 } }, fail: { text: '붙잡혔다.', effects: { injure: { who: 'you', n: 1 } } }, rope: { kind: 'pay', from: 8 } }],
  (t) => { t.numbers.push(knob('rope_pay_1', 60), knob('rope_k2', 9)); t.lines.push({ id: 'rope_tail_pay', speaker: 'ui', grade: 'choice', text: '안 받아 주면 끝이다' }); });
  s.world.karma = 5;
  let v = view(s, db);
  assert.deepStrictEqual(v[1], [65, '안 받아 주면 끝이다'], 'rope_pay_1 60 + 5 · 꼬리 줄');
  assert.deepStrictEqual(v[6], [55, '들키면 다친다'], 'from 8 — 카르마 5 에서는 그대로');
  s.world.karma = 16;
  assert.strictEqual(view(s, db)[5][0], 35, 'fight base 32 − 10 = 22 → 바닥 30 + 5');
  s.world.karma = 8;
  assert.deepStrictEqual(view(s, db)[6], [55, '들키면 다친다. 안 받아 주면 끝이다'], 'rope_k2 9 → 카르마 8 은 K1 (60) · 원래 판정 50 → min(50, 60) = 50 (+5)');
  s.world.karma = 9;
  assert.deepStrictEqual(view(s, db)[1], [95, '안 받아 주면 끝이다'], 'K2 = 기본 90');
});

test('R0 결과: 성공 = 원래 결과(비용은 먼저) · 실패 = 당신 죽음 + rope.fail 글 · 집계 ropeRolls·ropeClose·deathRolls·closeCalls · 사인 roped', () => {
  // 성공
  const a = at(DAWN());
  a.s.world.karma = 5; a.s.people.you.skills.talk = 3;   // 92 + 15 → 100%
  const food0 = a.s.world.food;
  assert.ok(E.dispatch(a.s, { type: 'choose', i: 0 }, a.db).ok);
  assert.deepStrictEqual([a.s.people.you.status, a.s.world.food, a.s.world.karma, a.s.lastResult.text, a.s.lastResult.roll.success], ['home', food0 - 2, 4, '손이 풀렸다.', true]);
  assert.deepStrictEqual(a.s.lastResult.roped, { kind: 'pay', band: 1, blind: false, base: 92 });
  assert.deepStrictEqual(['ropeRolls', 'ropeClose', 'deathRolls', 'closeCalls'].map((k) => a.s.stats[k]), [1, 1, 1, 1]);
  assert.ok(a.s.lastResult.forced === false && a.s.lastResult.noSafe === true && a.s.lastResult.warned === true, '위험 0 출구는 없지만 강제는 아니다(R1)');
  // 실패
  const b = at(DAWN());
  b.s.world.karma = 5; b.s.people.you.skills.talk = -30;
  const f0 = b.s.world.food;
  assert.ok(E.dispatch(b.s, { type: 'choose', i: 0 }, b.db).ok);
  assert.deepStrictEqual([b.s.people.you.status, b.s.world.food, b.s.lastResult.text], ['dead', f0 - 2, '그릇을 받고도 손이 풀리지 않았다.'], '비용을 치르고도 죽는다');
  const c = b.s.ended.cause;
  assert.deepStrictEqual([c.event, c.choice, c.roped, c.blind, c.forced, c.warned, c.noSafe, c.swapped, c.warn], ['e_rope', '그릇 둘을 내민다', true, false, false, true, true, true, '안 받으면 끝이다']);
  assert.deepStrictEqual(['ropeRolls', 'ropeClose', 'deathRolls', 'closeCalls'].map((k) => b.s.stats[k]), [1, 0, 1, 0]);
  const m = ST.measure(b.db, b.s, { trips: 0 });
  assert.deepStrictEqual([m.ropeDeath, m.blindDeath, m.noSafe, m.forced, m.warned, m.ropeRolls, m.ropeClose], [true, false, true, false, true, 1, 0]);
  // how ascended · 판정이던 선택지(실패가 안 죽이던 것)에 죽음을 더한다
  const d = at([pass('불을 키운다', { text: '밤을 샜다.' }, { rope: { kind: 'pay', fail: { text: '입이 먼저 "네" 했다.', how: 'ascended', effects: { trace: { crate_food: 'empty' } } } } }),
    { label: '창고를 턴다', warn: '들키면 다친다', check: { skill: 'str', base: 50 }, ok: { text: '' }, fail: { text: '붙잡혔다.', effects: { injure: { who: 'you', n: 1 } } }, rope: { kind: 'pay', from: 8 } }]);
  d.s.world.karma = 8;
  const st = E.effChoice(d.s, d.db, d.db.events.e_rope.choices[1]);
  assert.deepStrictEqual([st.check, st.fail.text, st.fail.effects], [{ skill: 'str', base: 50 }, '붙잡혔다.', { injure: { who: 'you', n: 1 }, kill: { who: 'you', how: 'dead' } }], 'min(50, 90) · 원래 실패 + 죽음');
  d.s.people.you.skills.talk = -30;
  E.dispatch(d.s, { type: 'choose', i: 0 }, d.db);
  assert.deepStrictEqual([d.s.people.you.status, d.s.traces.crate_food.st, d.s.lastResult.text], ['ascended', 'empty', '입이 먼저 "네" 했다.']);
});

test('R0 swap 뒤에 줄타기: 카르마 ≥8 swap(talk 50)이 있는 가리킨다 = K1 82 · K2 50 · K3 50 · K4 40 (설계 §1-2) · 확정 죽음 모습에는 안 얹는다', () => {
  const point = pass('옆 담요를 가리킨다', {}, { taboo: 'give_other', warn: '그 사람이 대신 당한다', rope: { kind: 'point' },
    swap: { when: 'karma>=8', warn: '아무도 안 돌아서면 끝이다', check: { skill: 'talk', base: 50 }, ok: { text: '' }, fail: { text: '옆 담요가 먼저 일어났다.', effects: { kill: { who: 'you' } } } } });
  const answer = pass('대답한다', { effects: { kill: { who: 'you', how: 'ascended' } } }, { warn: '올라간다', rope: { kind: 'endure' } });
  const { db, s } = at([pass('본다', {}, { warn: '다친다' }), point, answer]);
  const want = { 5: 87, 8: 55, 12: 55, 16: 45 };
  for (const [k, p] of Object.entries(want)) { s.world.karma = Number(k); assert.strictEqual(E.eventView(s, db).choices[1].chance, p, `karma ${k}`); }
  s.world.karma = 8;
  assert.strictEqual(E.eventView(s, db).choices[1].warn, '아무도 안 돌아서면 끝이다', "이미 '끝이다'가 있으면 꼬리를 붙이지 않는다");
  assert.strictEqual(E.effChoice(s, db, db.events.e_rope.choices[1]).fail.text, '옆 담요가 먼저 일어났다.', '원래 실패가 당신을 죽이면 그 글 그대로');
  assert.deepStrictEqual([E.eventView(s, db).choices[2].chance, E.eventView(s, db).choices[2].warn], [null, '올라간다'], '확정 죽음(대답한다)은 줄타기로 바꿀 것이 없다');
});

test('R0 눈먼 새벽(rope.blind): 깃발 strike_blind 가 서면 카르마와 상관없이 85·75·65, 구간과 겹치면 낮은 쪽 · blindMet · 사인 blind · 깃발 id 지정', () => {
  const choices = () => [
    pass('그릇 둘을 내민다', { effects: { flag: { strike_blind: false } } }, { cost: { food: 2 }, rope: { kind: 'pay', blind: 1 } }),
    pass('맞고 버틴다', { effects: { injure: { who: 'you', n: 2 }, flag: { strike_blind: false } } }, { warn: '크게 다친다', rope: { kind: 'endure', blind: 1 } }),
    pass('옆 담요를 가리킨다', {}, { taboo: 'give_other', warn: '그 사람이 대신 당한다', rope: { kind: 'point', blind: 'my_blind' } }),
  ];
  const { db, s } = at(choices());
  assert.deepStrictEqual(view(s, db).map((x) => x[0]), [null, null, null], '깃발 없음 · 카르마 0');
  s.flags.strike_blind = true;
  assert.deepStrictEqual(view(s, db).map((x) => x[0]), [90, 80, null], '눈먼 새벽 85·75 (+5) · 다른 깃발을 보는 선택지는 그대로');
  s.flags.my_blind = true;
  assert.strictEqual(view(s, db)[2][0], 70);
  s.world.karma = 5;
  assert.deepStrictEqual(view(s, db).map((x) => x[0]), [90, 80, 70], 'K1 92·88·82 와 겹치면 낮은 쪽');
  s.world.karma = 16;
  assert.deepStrictEqual(view(s, db).map((x) => x[0]), [83, 75, 45], 'K4 78·70·40 이 더 낮다');
  assert.deepStrictEqual(E.effChoice(s, db, db.events.e_rope.choices[1]).roped, { kind: 'endure', band: 4, blind: true, base: 70 });
  s.world.karma = 0; s.people.you.skills.str = -30;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.deepStrictEqual([s.people.you.status, s.stats.blindMet, s.ended.cause.blind, s.ended.cause.roped], ['dead', 1, true, true]);
  assert.strictEqual(ST.measure(db, s, { trips: 0 }).blindDeath, true);
  // 깃발이 없으면 blindMet 은 그대로
  const b = at(choices());
  E.dispatch(b.s, { type: 'choose', i: 1 }, b.db);
  assert.deepStrictEqual([b.s.stats.blindMet, b.s.lastResult.blind, b.s.lastResult.roped], [0, false, null]);
});

// ── R0 = swap 판 (설계 §1-5 '결과는 swap 판과 같다') ──
// 메모리 시험(tightrope/patches.js)이 쓴 swap 펼침과 같은 규칙을 여기 따로 적고, 줄타기 칸과 화면·결과가 같은지 본다
const TABLE = { pay: [92, 90, 85, 78], endure: [88, 85, 78, 70], point: [82, 70, 55, 40] }, FIGHT_PEN = [0, 0, 5, 10], BLIND = { pay: 85, endure: 75, point: 65 };
const BANDS = [['karma>=16', 3], ['karma>=12', 2], ['karma>=8', 1], ['karma>=5', 0]];
const SKILL = { pay: 'talk', endure: 'str', point: 'talk' };
const killsMe = (o) => !!(o && o.effects && o.effects.kill && [].concat(o.effects.kill).some((k) => !k.who || k.who === 'you'));
function expandRope(c) {
  const spec = c.rope; const kind = spec.kind;
  const base = clone(c); delete base.rope; delete base.swap;
  const olds = c.swap ? [].concat(c.swap) : [];
  const merged = (v) => S.mergeSwap(base, v);
  const failText = spec.fail && spec.fail.text;
  const variant = (when, m, pct) => {
    const v = { when, label: m.label, cost: m.cost || {}, req: m.req || {}, taboo: m.taboo || '', hint: m.hint || '' };
    const w = m.warn || '';
    v.warn = kind === 'fight' || /끝이다/.test(w) ? w : w ? `${w}. ${S.ROPE_TAIL[kind]}` : S.ROPE_TAIL[kind];
    if (m.check) {
      v.check = { skill: m.check.skill, base: kind === 'fight' ? Math.max(30, m.check.base - pct) : Math.min(m.check.base, pct) };
      v.ok = m.ok;
      v.fail = killsMe(m.fail) ? m.fail : Object.assign({}, m.fail, { text: failText || m.fail.text, effects: Object.assign({}, m.fail.effects, { kill: { who: 'you', how: 'dead' } }) });
    } else { v.check = { skill: SKILL[kind], base: pct }; v.ok = m.out; v.fail = { text: failText || S.ROPE_FAIL_TEXT[kind], effects: { kill: { who: 'you', how: 'dead' } } }; }
    return v;
  };
  const pctOf = (bi) => (kind === 'fight' ? FIGHT_PEN[bi] : TABLE[kind][bi]);
  const vs = [];
  const from = spec.from || 0;
  if (spec.blind) for (const [cond, bi] of BANDS) { if (Number(cond.slice(7)) < from) continue; const p = Math.min(TABLE[kind][bi], BLIND[kind]); for (const v of olds) vs.push(variant(`(${v.when}) & flag:strike_blind & ${cond}`, merged(v), p)); vs.push(variant(`flag:strike_blind & ${cond}`, base, p)); }
  for (const [cond, bi] of BANDS) { if (Number(cond.slice(7)) < from && from > 5) continue; for (const v of olds) vs.push(variant(`(${v.when}) & ${cond}`, merged(v), pctOf(bi))); vs.push(variant(cond, base, pctOf(bi))); }
  if (spec.blind) { for (const v of olds) vs.push(variant(`(${v.when}) & flag:strike_blind`, merged(v), BLIND[kind])); vs.push(variant('flag:strike_blind', base, BLIND[kind])); }
  const out = clone(base); out.swap = vs.concat(olds); return out;
}
test('R0 = swap 판: 줄타기 칸과 같은 규칙으로 펼친 swap 이 화면(%·경고·잠금)과 결과(굴림·상태)가 같다 — 카르마 0~20 · 눈먼 새벽 · 시드 12', () => {
  const choices = [
    ...DAWN().map((c, i) => (i === 3 ? Object.assign(c, { rope: { kind: 'point', blind: 1, fail: { text: '아무도 돌아보지 않았다.' } }, swap: { when: 'karma>=8', warn: '아무도 안 돌아서면 끝이다', check: { skill: 'talk', base: 50 }, ok: { text: '' }, fail: { text: '', effects: { kill: { who: 'you' } } } } }) : i === 1 ? Object.assign(c, { rope: { kind: 'endure', blind: 1, fail: { text: '갈비뼈가 안으로 꺾였다.' } } }) : c)),
    { label: '창고를 턴다', warn: '들키면 다친다', check: { skill: 'str', base: 50 }, ok: { text: '', effects: { food: 2 } }, fail: { text: '붙잡혔다.', effects: { injure: { who: 'you', n: 1 } } }, rope: { kind: 'pay', from: 8, fail: { text: '창고 앞에 누가 앉아 있었다.' } } },
  ];
  const a = at(clone(choices));
  const b = at(choices.map((c) => (c.rope ? expandRope(c) : clone(c))));
  const pick = (c) => [c.label, c.locked, c.reason, c.chance, c.warn, c.hint, c.cost, c.taboo];
  for (const blind of [false, true]) for (let k = 0; k <= 20; k++) {
    for (const x of [a, b]) { x.s.world.karma = k; if (blind) x.s.flags.strike_blind = true; else delete x.s.flags.strike_blind; }
    assert.deepStrictEqual(E.eventView(b.s, b.db).choices.map(pick), E.eventView(a.s, a.db).choices.map(pick), `화면 karma ${k} blind ${blind}`);
    if (k % 3 !== 0 && k !== 5 && k !== 8 && k !== 16) continue;
    for (let i = 0; i < choices.length; i++) for (const seed of [1, 7, 12]) {
      const sa = clone(a.s), sb = clone(b.s); sa.rng = sb.rng = seed * 7919;
      E.dispatch(sa, { type: 'choose', i }, a.db); E.dispatch(sb, { type: 'choose', i }, b.db);
      const keyOf = (s) => JSON.stringify([s.people.you.status, s.people.you.n, s.world, s.flags, s.traces.crate_food, s.lastResult.text, s.lastResult.roll, s.lastResult.forced, s.lastResult.warned, s.ended && s.ended.why]);
      assert.strictEqual(keyOf(sb), keyOf(sa), `결과 karma ${k} blind ${blind} 선택 ${i} 시드 ${seed}`);
    }
  }
});

// ── R1 ──
test('R1 살 확률 E.survival · 강제 = 열린 선택지 전부 살 확률 0 · lastResult.alts[].p', () => {
  const k = KILL, safe = { text: '' };
  assert.strictEqual(E.survival({ out: safe }, null), 1);
  assert.strictEqual(E.survival({ out: k }, null), 0);
  assert.strictEqual(E.survival({ check: { skill: 'str', base: 50 }, ok: safe, fail: k }, 70), 0.7);
  assert.strictEqual(E.survival({ check: { skill: 'str', base: 50 }, ok: k, fail: safe }, 70), 0.3);
  assert.strictEqual(E.survival({ check: { skill: 'str', base: 50 }, ok: k, fail: k }, 70), 0);
  assert.strictEqual(E.survival({ check: { skill: 'str', base: 50 }, ok: safe, fail: { text: '', effects: { kill: { who: 'target' } } } }, 10), 1, '남이 죽는 것은 당신의 살 확률이 아니다');
  const { db, s } = at([pass('판다', {}, { cost: { food: 99 } }), ...DAWN().slice(1, 3)]);
  s.world.karma = 5; s.people.you.skills.str = -30;
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.deepStrictEqual(s.lastResult.alts.map((x) => [x.i, x.p]), [[1, 0], [2, 0]], '비용 선택은 잠김 · 판정 % 0 = 살 확률 0');
  assert.deepStrictEqual([s.lastResult.forced, s.lastResult.warned, s.ended.cause.forced], [true, false, true], '살 확률이 모두 0 이면 확정 사망 — 경고 글이 있어도 경고 있음이 아니다');
});

test('R2 firstDeath: 1번 자리의 줄타기(rope 칸·카르마/눈먼 새벽 swap 판정)는 "당신이 죽을 수 있다"가 아니다 — 금기·확정 죽음·다른 조건의 죽는 판정은 그대로', () => {
  const kinds = (choice0) => warns(withKarma((t) => t.events.push(ev('e_fd', 'trial', 'day==0', [choice0, pass('본다')])))).filter((w) => w.kind === 'firstDeath' && w.id === 'e_fd').map((w) => w.msg);
  const dice = (when, base) => ({ when, check: { skill: 'talk', base: base || 90 }, ok: { text: '' }, fail: KILL });
  assert.deepStrictEqual(kinds(pass('그릇 둘을 내민다', {}, { cost: { food: 2 }, rope: { kind: 'pay' } })), [], 'rope 칸');
  assert.deepStrictEqual(kinds(pass('그릇 둘을 내민다', {}, { swap: dice('karma>=5') })), [], '카르마 swap 판정');
  assert.deepStrictEqual(kinds(pass('그릇 둘을 내민다', {}, { swap: dice('flag:strike_blind & food>=2') })), [], '눈먼 새벽 swap 판정');
  assert.strictEqual(kinds(pass('그릇 둘을 내민다', {}, { swap: dice('fired:e_fd>=1') })).length, 1, '카르마와 상관없는 죽는 판정은 그대로');
  assert.strictEqual(kinds(pass('그릇 둘을 내민다', {}, { swap: { when: 'karma>=5', out: KILL } })).length, 1, '확정 죽음은 그대로');
  assert.strictEqual(kinds(pass('가리킨다', {}, { taboo: 'give_other', rope: { kind: 'point' } })).length, 1, '금기는 그대로');
});

test('noExit (R1) · ropeFail: 줄타기만 남은 사건도 살 확률 > 0 인 늘 열린 길이 있으면 경고 없음 · 확정 죽음뿐이면 경고 · 판정 없던 모습에 실패 글이 없으면 ropeFail 경고', () => {
  const w = (choices) => warns(withKarma((t) => t.events.push(ev('e_nx', 'trial', 'day==0', choices))));
  const dawn = w(DAWN());
  assert.deepStrictEqual(dawn.filter((x) => x.kind === 'noExit' || x.kind === 'ropeFail'), [], '위험 0 출구가 없어져도 버틴다·밀쳐 낸다·가리킨다가 늘 열린 살 길');
  const doom = w([pass('갚는다', {}, { cost: { food: 2 }, rope: { kind: 'pay', fail: { text: 'x' } } }), pass('대답한다', KILL, { warn: '올라간다', rope: { kind: 'endure', fail: { text: 'x' } } })]);
  assert.ok(doom.some((x) => x.kind === 'noExit'), '비용 길 + 확정 죽음뿐');
  const nf = w([pass('버틴다', {}, { warn: '다친다', rope: { kind: 'endure' } }), pass('본다')]);
  assert.deepStrictEqual(nf.filter((x) => x.kind === 'ropeFail').map((x) => x.msg), ['choices[0] "버틴다": rope.fail.text 가 없다 — 실패하면 기본 글("버티던 몸이 먼저 꺾였다.")이 나간다']);
  assert.deepStrictEqual(w([{ label: '밀쳐 낸다', warn: '끝이다', check: { skill: 'str', base: 45 }, ok: { text: '' }, fail: KILL, rope: { kind: 'fight' } }, pass('본다')]).filter((x) => x.kind === 'ropeFail'), [], 'fight 는 원래 실패 글');
});

test('검증: 느껴지는 아슬함 ropeFeltRolls·ropeFelt = 화면 % ≤ ROPE_FELT_MAX(85) 인 줄타기 판정만 굴림·넘김 (경계 85 포함 · 90 은 안 셈 · 줄타기 아닌 판정은 안 셈)', () => {
  assert.strictEqual(E.ROPE_FELT_MAX, 85);
  // 카르마 12 = K3: 갚는다 base 85 + 말 기술×5 → 기술 0 이면 85(셈), 기술 1 이면 90(안 셈). 굴림 결과와 상관없이 굴림은 세고, 넘김은 성공일 때만
  const seen = { ok: 0, fail: 0 };
  for (let k = 0; k < 40 && !(seen.ok && seen.fail); k++) {
    const a = at(DAWN());
    a.s.world.karma = 12; a.s.people.you.skills.talk = 0; a.s.rng = (a.s.rng + k * 2654435761) >>> 0;
    assert.strictEqual(view(a.s, a.db)[0][0], 85);
    assert.ok(E.dispatch(a.s, { type: 'choose', i: 0 }, a.db).ok);
    const ok = a.s.lastResult.roll.success; seen[ok ? 'ok' : 'fail']++;
    assert.deepStrictEqual(['ropeRolls', 'ropeClose', 'ropeFeltRolls', 'ropeFelt'].map((x) => a.s.stats[x]), [1, ok ? 1 : 0, 1, ok ? 1 : 0], `85% 판정 ${ok ? '넘김' : '실패'}`);
  }
  assert.ok(seen.ok && seen.fail, '85% 판정에서 넘김·실패를 둘 다 본다');
  const b = at(DAWN());
  b.s.world.karma = 12; b.s.people.you.skills.talk = 1;
  assert.strictEqual(view(b.s, b.db)[0][0], 90);
  assert.ok(E.dispatch(b.s, { type: 'choose', i: 0 }, b.db).ok);
  assert.deepStrictEqual(['ropeRolls', 'ropeFeltRolls', 'ropeFelt'].map((x) => b.s.stats[x]), [1, 0, 0], '90% 줄타기는 굴림만 센다');
  // 줄타기 아닌 죽음 판정(카르마 0 의 밀쳐 낸다 50%)은 느껴지는 줄타기로 세지 않는다
  const c = at(DAWN());
  assert.ok(E.dispatch(c.s, { type: 'choose', i: 2 }, c.db).ok);
  assert.deepStrictEqual(['deathRolls', 'ropeRolls', 'ropeFeltRolls', 'ropeFelt'].map((x) => c.s.stats[x]), [1, 0, 0, 0]);
  // 새 판 0 · 옛 저장(칸 없음)은 정규화가 0 · measure 가 옮긴다
  assert.deepStrictEqual([c.s.stats.ropeFeltRolls, at(DAWN()).s.stats.ropeFelt], [0, 0]);
  const old = JSON.parse(JSON.stringify(at(DAWN()).s)); delete old.stats.ropeFeltRolls; delete old.stats.ropeFelt;
  const o2 = E.normalize(old, c.db);
  assert.deepStrictEqual([o2.stats.ropeFeltRolls, o2.stats.ropeFelt], [0, 0]);
  o2.stats.ropeFeltRolls = 3; o2.stats.ropeFelt = 2; o2.ended = { why: 'train', identity: null, ledger: [], cause: null };
  const m = ST.measure(c.db, o2, { trips: 0 });
  assert.deepStrictEqual([m.ropeFeltRolls, m.ropeFelt], [3, 2]);
});

test('R4 저장: 새 집계 칸(ropeRolls·ropeClose·deathRolls·closeCalls·blindMet)은 새 판 0 · 옛 저장은 정규화가 0 으로 채운다 · 왕복', () => {
  const { db, s } = at(DAWN());
  assert.deepStrictEqual(['ropeRolls', 'ropeClose', 'deathRolls', 'closeCalls', 'blindMet'].map((k) => s.stats[k]), [0, 0, 0, 0, 0]);
  s.stats.ropeRolls = 3; s.stats.closeCalls = 2;
  const back = E.normalize(JSON.parse(JSON.stringify(s)), db);
  assert.deepStrictEqual([back.stats.ropeRolls, back.stats.closeCalls, back.stats.blindMet], [3, 2, 0]);
  const old = JSON.parse(JSON.stringify(s)); for (const k of ['ropeRolls', 'ropeClose', 'deathRolls', 'closeCalls', 'blindMet']) delete old.stats[k];
  const o2 = E.normalize(old, db);
  assert.deepStrictEqual(['ropeRolls', 'ropeClose', 'deathRolls', 'closeCalls', 'blindMet'].map((k) => o2.stats[k]), [0, 0, 0, 0, 0]);
});

// ── 봇 · 통계 ──
test('§1-6 사람 흉내: 모든 선택이 죽음 글이면 판정 없는 죽음 글(대답한다)은 성공 0% 로 본다 — cautious·cautious2·mixed·wary', () => {
  const metas = [{ i: 0, label: '대답한다', warn: '올라간다', chance: null, locked: false }, { i: 1, label: '손등을 깨문다', warn: '못 버티면 끝이다', chance: 90, check: true, locked: false }, { i: 2, label: '귀를 막는다', warn: '못 막으면 끝이다', chance: 65, check: true, locked: false }];
  const st = (i) => ({ rng: i * 7919 + 1 });
  assert.deepStrictEqual([B.humanChance(metas[0]), B.humanChance(metas[1]), B.humanChance({ label: '본다' })], [0, 90, 100]);
  for (const k of ['cautious', 'cautious2', 'mixed', 'wary']) { const got = new Set(); for (let i = 0; i < 40; i++) got.add(B.HUMAN_PICK[k](st(i), metas)); assert.ok(!got.has(0), `${k}: ${[...got]}`); }
  const c = new Set(); for (let i = 0; i < 20; i++) c.add(B.HUMAN_PICK.cautious(st(i), metas)); assert.deepStrictEqual([...c], [1], 'cautious = 가장 높은 %');
  const only = [metas[0], Object.assign({}, metas[1], { locked: true })];
  assert.strictEqual(B.HUMAN_PICK.cautious(st(1), only), 0, '다른 길이 없으면 그것');
  assert.strictEqual(B.HUMAN_PICK.wary(st(1), only), 0);
  assert.deepStrictEqual(B.GROUPS.rope, ['selfish_nb']);
});

test('§1-7·§2-3 통계: 아슬함(산 판만) · 실제 발견율(누구나 아는 밤 뺌) · 눈먼 새벽 · 줄타기 사망 · 옛 강제', () => {
  const t = withKarma((x) => { x.nightEvents.push({ id: 'n_pub', role: 'kill', actor: 'soonrye', target: '-', cond: 'day==99', weight: 1, kind: 'malice', public: 1 }); });
  const db = T.load(t);
  const s = E.newGame(db, 1);
  s.nightLog.push({ day: 1, id: 'n_pub', kind: 'malice', role: 'kill', actor: 'soonrye', target: null, traces: [], discovered: true },
    { day: 1, id: 'r1_steal_food', kind: 'malice', role: 'steal', actor: 'gicheol', target: null, traces: [], discovered: true },
    { day: 2, id: 'r1_steal_food', kind: 'malice', role: 'steal', actor: 'gicheol', target: null, traces: [], discovered: false },
    { day: 2, id: 'r1_steal_food~missed', kind: 'malice', role: 'neglect', actor: 'gicheol', target: null, traces: [], discovered: true });
  s.stats.ropeRolls = 4; s.stats.ropeClose = 3; s.stats.deathRolls = 6; s.stats.closeCalls = 5; s.stats.blindMet = 1;
  s.ended = { why: 'train', identity: null, ledger: [], cause: null };
  const m = ST.measure(db, s, { trips: 0 });
  assert.deepStrictEqual([m.privTotal, m.privFound, m.pubTotal, m.ropeRolls, m.ropeClose, m.deathRolls, m.closeCalls, m.blindMet, m.survived], [2, 1, 1, 4, 3, 6, 5, 1, true]);
  const dead = Object.assign({}, m, { survived: false, dead: true, ropeClose: 9, closeCalls: 9, ropeDeath: true, blindDeath: true, noSafe: true });
  const few = Object.assign({}, m, { ropeClose: 1 });
  const a = ST.aggregate(db, [m, few, dead]);
  assert.deepStrictEqual([a.survN, a.ropeCloseSurv, a.ropeClose2, a.closeCallsSurv, a.ropeDeaths, a.blindDeaths, a.noSafeDeaths], [2, 2, 50, 5, 1, 1, 1], '산 판 = 열흘을 산 판만 (죽은 판 9번은 안 든다)');
  assert.deepStrictEqual([a.discReal, a.pubNights, a.privNights, a.discovery], [50, 1, 2, 66.7], '실제 발견율 = 숨은 밤 2 중 1 · 옛 발견율은 누구나 아는 밤 포함 3 중 2');
  assert.strictEqual(ST.aggregate(db, [dead]).ropeCloseSurv, null, '산 판이 없으면 없음');
});

test('10-25 A1 아슬함 합격선 = 화면 ≤ 85% 줄타기만(검증 지적): 집계(산 판만 · ≥2번% · 넘김 중 비중) · 판정 줄 둘 · 옛 값(줄타기 전부)은 참고 줄', () => {
  const db = T.load(withKarma());
  const sv = (ropeClose, ropeFelt) => ({ survived: true, dead: false, ropeRolls: ropeClose, ropeClose, ropeFeltRolls: ropeFelt, ropeFelt });
  const dead = { survived: false, dead: true, ropeRolls: 9, ropeClose: 8, ropeFeltRolls: 9, ropeFelt: 8, ropeDeath: true };
  const a = ST.aggregate(db, [sv(5, 3), sv(4, 1), sv(1, 0), sv(6, 2), dead]);
  assert.deepStrictEqual([a.survN, a.ropeCloseSurv, a.ropeFeltSurv, a.ropeFelt2, a.ropeFeltShare, a.ropeFelt, a.ropeFeltRolls], [4, 4, 1.5, 50, 37.5, 2.8, 3], '산 판 4: 느껴지는 넘김 3·1·0·2 → 평균 1.5 · ≥2 는 둘 = 50% · 넘김 16 중 6 = 37.5% · 전체 판 (3+1+0+2+8)/5 = 2.8');
  assert.deepStrictEqual([ST.aggregate(db, [dead]).ropeFeltSurv, ST.aggregate(db, [dead]).ropeFelt2, ST.aggregate(db, [dead]).ropeFeltShare], [null, null, null], '산 판이 없으면 없음');
  assert.strictEqual(ST.aggregate(db, [sv(0, 0)]).ropeFeltShare, null, '넘김이 0 이면 비중 없음');
  // 합격선 표: 'A1 아슬함' 판정 줄 둘 = 화면 ≤ 85% 줄타기 · 바로 밑에 옛 값(줄타기 전부) 참고 줄 하나
  const base = { n: 200, deaths: 100, deathRate: 50, warnedRate: 100, identity: {}, topCause: { k: 'x', share: 30 }, topRoot: { k: 'x', share: 30 }, survN: 121, ropeClose: 3.3, ropeCloseSurv: 5.06, ropeClose2: 87, ropeFelt: 1.4, ropeFeltSurv: 2.48, ropeFelt2: 58.7, ropeFeltShare: 49 };
  const aggs = { balanced: Object.assign({}, base), selfish_nb: Object.assign({}, base) };
  const g = ST.gate(aggs, ['a'], ['balanced']);
  const i0 = g.rows.findIndex((r) => r[0].startsWith('A1 아슬함: 화면 ≤ 85%'));
  assert.ok(i0 > 0);
  assert.deepStrictEqual(g.rows.slice(i0, i0 + 3).map((r) => r[0]), [
    'A1 아슬함: 화면 ≤ 85% (죽을 확률 ≥ 15%) 줄타기 넘김/판 (열흘 산 판, selfish_nb)', 'A1 아슬함: 산 판 중 화면 ≤ 85% 줄타기 ≥ 2번 넘김 (selfish_nb)',
    '  참고: 줄타기 판정 전부(90% 넘는 판정 포함 — 10-24 옛 A1 아슬함) 넘김/판 · 산 판 중 ≥ 2번 (selfish_nb)']);
  assert.deepStrictEqual(g.rows.slice(i0, i0 + 3).map((r) => r.slice(1, 5)), [
    ['≥ 2', '2.48 (산 판 121 · 산 판 줄타기 넘김 중 49% · 전체 판 1.4)', true, false],
    ['≥ 60%', '58.7%', false, true],
    ['측정 (옛 합격선 ≥ 2 · ≥ 60%)', '5.06 · 87% (산 판 121 · 전체 판 3.3)', true, false]], '58.7% 는 합격선 밑 · ±5 안 — 옛 값(87%)이 넘어도 판정은 화면 ≤ 85% 값으로');
  const g62 = ST.gate(Object.assign({}, aggs, { selfish_nb: Object.assign({}, base, { ropeFelt2: 62 }) }), ['a'], ['balanced']);
  const g70 = ST.gate(Object.assign({}, aggs, { selfish_nb: Object.assign({}, base, { ropeFelt2: 70 }) }), ['a'], ['balanced']);
  assert.deepStrictEqual([ST.combine([g])[i0 + 1].mark, ST.combine([g, g62])[i0 + 1].mark, ST.combine([g62])[i0 + 1].mark, ST.combine([g70])[i0 + 1].mark, ST.combine([g])[i0].mark], ['✗', '△', '△', '✓', '✓'],
    '모든 블록 합격선 밑 = ✗ · 블록마다 다름 = △ · 62% 는 통과지만 ±5 안 = △ · 70% = ✓ · 2.48 ≥ 2 = ✓');
  const g19 = ST.gate(Object.assign({}, aggs, { selfish_nb: Object.assign({}, base, { ropeFeltSurv: 1.9 }) }), ['a'], ['balanced']);
  assert.deepStrictEqual(g19.rows[i0].slice(3, 5), [false, false], '1.9 < 2 = 미달 (옛 값 5.06 이 넘어도)');
  assert.strictEqual(g.rows.filter((r) => r[0].startsWith('A1 아슬함')).length, 2, '판정 줄은 둘');
  assert.ok(!g.rows.some((r) => r[0].includes('느껴지는 아슬함')), '옛 측정 줄(느껴지는 아슬함)은 판정 줄이 되어 없어졌다');
  // 옛 집계(화면 ≤ 85% 칸 없음)는 판정 줄 '-' (미달) · 참고 줄은 옛 값을 그대로 보인다 · selfish_nb 가 없으면 셋 다 '-'
  const old = ST.gate({ balanced: aggs.balanced, selfish_nb: Object.assign({}, base, { ropeFeltSurv: undefined, ropeFelt2: undefined }) }, ['a'], ['balanced']);
  assert.deepStrictEqual(old.rows.slice(i0, i0 + 3).map((r) => r.slice(2, 4)), [['-', false], ['-', false], ['5.06 · 87% (산 판 121 · 전체 판 3.3)', true]]);
  const none = ST.gate({ balanced: aggs.balanced }, ['a'], ['balanced']);
  assert.deepStrictEqual(none.rows.slice(i0, i0 + 3).map((r) => r[2]), ['-', '-', '-']);
});

test('합격선 새 줄 (tightrope): 아슬함 selfish_nb ≥2·≥60% · 확정 사망 줄 이름 · 옛 강제 참고 줄 · A4 측정 줄(실제 발견율·누구나 아는 밤·눈먼 새벽)', () => {
  const base = { n: 200, deaths: 100, deathRate: 50, warnedRate: 100, allDead: 0, nights: 9, malice: 3, hymn: 2, discovery: 60, explicit: 9, decisions: 9, blank: 0, forced: 0, forcedTraced: 0, starveDeaths: 0, unwarned: 0, train: 1, survived: 45, aliveD4: 88, deadByD5: 16,
    topCause: { k: 'x', share: 30 }, topRoot: { k: 'x', share: 30 }, dayEvent: { 2: 1, 4: 1, 5: 1 }, home9: 3, home9N: 100, res7: 4, res7N: 100, neglect: 1, karma: 2, identity: {},
    survN: 90, ropeRolls: 0.8, ropeClose: 0.7, ropeCloseSurv: 0.76, ropeClose2: 20, closeCalls: 3, closeCallsSurv: 3.8, blindMet: 0.31, blindDeaths: 94, ropeDeaths: 10, noSafeDeaths: 40, discReal: 60.5, pubNights: 2.6, privNights: 7 };
  const mk = (o) => Object.assign({}, base, o);
  const aggs = { balanced: mk({}), lazy: mk({ discReal: 32, blindMet: 1.02, blindDeaths: 286 }), diligent: mk({ discReal: 94.5, blindMet: 0 }), selfish_nb: mk({ survN: 58, ropeCloseSurv: 5, ropeClose2: 87.4, ropeFelt: 2.1, ropeFeltSurv: 3.1, ropeFelt2: 71.2, ropeFeltShare: 62 }) };
  const g = ST.gate(aggs, ['a'], ['balanced']);
  const row = (p) => g.rows.find((r) => r[0].startsWith(p));
  assert.deepStrictEqual(row('A1 아슬함: 화면 ≤ 85%').slice(1, 5), ['≥ 2', '3.1 (산 판 58 · 산 판 줄타기 넘김 중 62% · 전체 판 2.1)', true, false]);
  assert.deepStrictEqual(row('A1 아슬함: 산 판 중').slice(2, 5), ['71.2%', true, false]);
  assert.strictEqual(row('  참고: 줄타기 판정 전부')[2], '5 · 87.4% (산 판 58 · 전체 판 0.7)');
  const g2 = ST.gate(Object.assign({}, aggs, { selfish_nb: mk({ ropeCloseSurv: 9, ropeClose2: 99, ropeFelt: 1, ropeFeltSurv: 1.9, ropeFelt2: 62 }) }), ['a'], ['balanced']);
  assert.deepStrictEqual(g2.rows.filter((r) => r[0].startsWith('A1 아슬함')).map((r) => r.slice(3, 5)), [[false, false], [true, true]], '1.9 < 2 · 62% = 통과지만 ±5 안 (옛 값 9번 · 99% 는 판정에 안 든다)');
  const g3 = ST.gate({ balanced: aggs.balanced }, ['a'], ['balanced']);
  assert.deepStrictEqual(g3.rows.filter((r) => r[0].startsWith('A1 아슬함')).map((r) => r.slice(2, 4)), [['-', false], ['-', false]], 'selfish_nb 가 없으면 미달');
  assert.strictEqual(row('강제 사망 = 확정 사망')[2].startsWith('0 판'), true);
  assert.strictEqual(row('  참고: 위험 0 출구가 없던 죽음')[2], '160 판 (그중 줄타기 판정 40)');
  assert.strictEqual(row('  A4 측정: 실제 발견율')[2], '32% / 60.5% / 94.5% (옛 발견율 60% / 60% / 60%)');
  assert.strictEqual(row('  A4 측정: 눈먼 새벽')[2], '1.02 / 0.31 / 0 · 286 / 94 / 94');
  assert.ok(row('  죽음 판정 넘김/판')[2].includes('selfish_nb 3.8'));
  // 옛 집계(새 칸 없음)도 깨지지 않는다
  const old = ST.gate({ balanced: { n: 1, deaths: 0, identity: {} } }, ['a'], ['balanced']);
  assert.ok(old.rows.every((r) => typeof r[2] === 'string'));
});
