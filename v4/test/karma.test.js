// node --test v4/test — 10-24 A1(카르마)·A2(이른 죽음)·A4(게으름 = 처벌) 엔진 몫 (명세 spec_karma_death_neglect §6 E1~E5 + 검토 지적)
//   E1 밤 사건 missed·caught·public·side 칸 · E2 방치 판정 · E3 흔적 late · E4 noExit · E5 신호(cold·호칭·req.why)
//   + swap(카르마에 따라 바뀌는 선택지) · req.cond/target · targetOptional · targetIf · most:<수치> · who:'you' 보존 · 부상 출처 · 봇·합격선
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { rawTables, clone, T, E } = require('./helpers.js');
const N = require('../engine/night.js');
const FX = require('../engine/effects.js');
const B = require('../sim/bots.js');
const S = require('../sim/stats.js');

const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out, more) => Object.assign({ label, out: Object.assign({ text: '' }, out || {}) }, more || {});
const night = (id, o) => Object.assign({ id, role: 'grudge', actor: 'any', target: '-', cond: '', weight: 10, kind: 'malice' }, o);
const errs = (t) => T.validate(t).map((e) => e.text);
const warns = (t) => T.warnings(t);
// 원한(사람)·카르마(세계) 수치를 더한 픽스처
function withKarma(edit) {
  const t = rawTables();
  t.numbers.push({ id: 'grudge', name: '원한', owner: 'person', min: 0, max: 10, start: 0, perDay: 0, visible: 'never' });
  t.numbers.push({ id: 'karma', owner: 'world', min: 0, max: 20, start: 0, perDay: 0, visible: 'never' });
  if (edit) edit(t);
  return t;
}
function setup(edit, seed) {
  const t = withKarma(edit);
  const db = T.load(t);
  const s = E.newGame(db, seed || 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);   // 픽스처 d0_notebook 을 넘긴다
  return { db, s, t };
}
const toPhase = (s, db, day, phase) => { let g = 0; while (!(s.day === day && s.phase === phase) && !s.ended && g++ < 80) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); } };
const logRow = (o) => Object.assign({ day: 0, kind: 'malice', role: 'steal', actor: 'gicheol', target: null, traces: [], rumor: false, lines: [], discovered: false }, o);

// ── E1 표 칸 ──
test('E1 밤 사건 missed·caught·public·side 칸: 받고, 안쪽 effects·trace 를 검사한다 · 배열 effects 는 객체 꼴로', () => {
  const ok = withKarma((t) => { const r = t.nightEvents[0]; r.public = 1; r.missed = { effects: [{ verb: 'number', id: 'grudge', n: 4, who: 'actor' }, { verb: 'flag', id: 'unseen_thief_actor', set: 1 }], trace: { crate_food: 'empty' } }; r.caught = { effects: [{ verb: 'number', id: 'food', n: 1 }] }; r.side = 0; });
  assert.deepStrictEqual(errs(ok), []);
  const db = T.load(ok);
  assert.deepStrictEqual(db.nightEvents[0].missed.effects, { grudge: { who: 'actor', n: 4 }, flag: { unseen_thief_actor: true } });
  assert.deepStrictEqual(db.nightEvents[0].caught.effects, { food: 1 });
  const bad = (edit, want) => { const t = withKarma(edit); assert.ok(errs(t).some((x) => x.includes(want)), `${want}\n${errs(t).join('\n')}`); };
  bad((t) => { t.nightEvents[0].missed = { effects: { nope: 1 } }; }, 'missed.effects.nope: numbers 표에 없는 수치');
  bad((t) => { t.nightEvents[0].caught = { trace: { crate_food: 'gone' } }; }, 'caught.trace.crate_food: 상태 "gone"');
  bad((t) => { t.nightEvents[0].missed = { effects: { food: -1 }, text: 'x' }; }, 'missed.text: missed·caught 는 effects·trace 만');
  bad((t) => { t.nightEvents[0].public = 2; }, 'public: 0/1');
  bad((t) => { t.nightEvents.push(night('c_clock', { role: 'clock', actor: '-', kind: 'neutral', missed: { effects: { fog: 1 } } })); }, '세계 시계(role clock)는 방치 판정이 없다');
  // 빈 칸은 없는 것
  const empty = withKarma((t) => { t.nightEvents[0].missed = {}; t.nightEvents[0].caught = { effects: [], trace: {} }; t.nightEvents[0].public = ''; });
  assert.deepStrictEqual(errs(empty), []);
  const db2 = T.load(empty);
  assert.ok(!('missed' in db2.nightEvents[0]) && !('caught' in db2.nightEvents[0]) && !('public' in db2.nightEvents[0]));
});

test('E1·E5 인물표 addressCold 칸(빈 글 = 부르지 않음, 6자 이내) · 사건 targetIf·targetOptional·most:<사람 수치> · req 칸 검사', () => {
  const t = withKarma((x) => {
    x.people.find((p) => p.id === 'soonrye').addressCold = '이봐'; x.people.find((p) => p.id === 'mari').addressCold = '';
    x.events.push(ev('e_most', 'trial', 'day==0 & phase==evening', [pass('본다'), pass('가리킨다', { effects: { grudge: { who: 'target', n: 1 } } }, { req: { cond: 'karma>=1', why: '아무도 안 돌아본다' } })], { target: 'most:grudge', targetIf: 'self!=gicheol', targetOptional: 1 }));
  });
  assert.deepStrictEqual(errs(t), []);
  const bad = (edit, want) => { const x = withKarma(edit); assert.ok(errs(x).some((m) => m.includes(want)), `${want}\n${errs(x).join('\n')}`); };
  bad((x) => { x.people[1].addressCold = '아주아주긴호칭'; }, 'addressCold: 6자 초과');
  bad((x) => { x.events.push(ev('e1', 'trial', 'day==0', [pass('a')], { target: 'most:food' })); }, 'target: 사람 id 또는');   // food 는 세계 수치
  bad((x) => { x.events.push(ev('e2', 'trial', 'day==0', [pass('a')], { targetIf: 'grudge>=3' })); }, 'targetIf: target 열과 같이');
  bad((x) => { x.events.push(ev('e3', 'trial', 'day==0', [pass('a')], { target: 'any', targetIf: 'grudge>=' })); }, 'targetIf:');
  bad((x) => { x.events.push(ev('e4', 'trial', 'day==0', [pass('a'), pass('b', {}, { req: { flg: 'x' } })])); }, 'req.flg: req 칸은');
  bad((x) => { x.events.push(ev('e5', 'trial', 'day==0', [pass('a'), pass('b', {}, { req: { cond: 'karma>>1' } })])); }, 'req.cond:');
  bad((x) => { x.events.push(ev('e6', 'trial', 'day==0', [pass('a'), pass('b', {}, { req: { notPermanent: 'eye' } })])); }, 'req.notPermanent 종류');
});

test('who:"you" 는 로더가 {who:"you", n} 로 남긴다 — 밤 사건·방치 판정에서 당신 몫이 행위자에게 가지 않는다 (검토 지적 15, share_bowl.caught)', () => {
  assert.deepStrictEqual(T.effectsToObject([{ verb: 'number', id: 'hunger', n: 1, who: 'you' }, { verb: 'number', id: 'food', n: -1 }, { verb: 'number', id: 'fear', n: 1, who: 'self' }], 'x'), { hunger: { who: 'you', n: 1 }, food: -1, fear: 1 });
  const { db, s } = setup((t) => { t.nightEvents.push(night('n_share', { role: 'share', actor: 'soonrye', target: 'seoha', weight: 1, kind: 'hymn', caught: { effects: [{ verb: 'number', id: 'hunger', n: -2, who: 'actor' }, { verb: 'number', id: 'hunger', n: 1, who: 'you' }] } })); });
  s.people.soonrye.n.hunger = 5; s.people.you.n.hunger = 5;
  s.day = 1; s.nightLog.push(logRow({ id: 'n_share', role: 'share', kind: 'hymn', actor: 'soonrye', target: 'seoha', discovered: true }));
  N.applyNeglect(s, db);
  assert.deepStrictEqual([s.people.soonrye.n.hunger, s.people.you.n.hunger], [3, 6], '준 사람 −2, 당신 +1 (전에는 준 사람 −1, 당신 0)');
});

// ── E2 방치 판정 ──
test('E2 방치 판정: 전날 밤 사건을 못 봤으면 missed, 봤으면 caught — 행위자·대상 그대로, 판정 줄은 role neglect, stats.neglect 는 missed 만', () => {
  const mk = (discovered) => {
    const { db, s } = setup((t) => { const r = t.nightEvents[0]; r.missed = { effects: { flag: { unseen_thief_actor: true }, grudge: { who: 'actor', n: 4 } }, trace: { crate_food: 'empty', bowl_actor: 'empty' } }; r.caught = { effects: { food: 1 } }; });
    s.day = 1; const food0 = s.world.food;
    s.nightLog.push(logRow({ id: 'r1_steal_food', discovered }));
    N.applyNeglect(s, db);
    return { db, s, food0 };
  };
  const a = mk(false);
  assert.strictEqual(a.s.flags.unseen_thief_gicheol, true, '_actor → 행위자 id');
  assert.strictEqual(a.s.people.gicheol.n.grudge, 4);
  assert.deepStrictEqual([a.s.traces.crate_food.st, a.s.traces.crate_food.late, a.s.traces.bowl_gicheol.st, a.s.traces.bowl_gicheol.late], ['empty', 1, 'empty', 1], 'missed 흔적은 late');
  const row = a.s.nightLog[a.s.nightLog.length - 1];
  assert.deepStrictEqual([row.id, row.role, row.discovered, row.day], ['r1_steal_food~missed', 'neglect', true, 1]);
  assert.strictEqual(a.s.stats.neglect, 1);
  assert.strictEqual(a.s.nightLog[0].judged, true);
  N.applyNeglect(a.s, a.db);
  assert.strictEqual(a.s.stats.neglect, 1, '한 번만 판정');
  assert.deepStrictEqual(N.discovery(a.s), { total: 1, found: 0, rate: 0, unknown: 1 }, '판정 줄은 발견 집계에 안 든다');
  const b = mk(true);
  assert.strictEqual(b.s.world.food, b.food0 + 1, 'caught');
  assert.strictEqual(b.s.stats.neglect, 0);
  assert.strictEqual(b.s.nightLog[b.s.nightLog.length - 1].id, 'r1_steal_food~caught');
});

test('E2 방치 판정: 행위자·대상이 역에 없으면 건너뛴다 · 이틀 전 줄은 판정 없이 judged · rollNight 첫머리에서 돈다', () => {
  const { db, s } = setup((t) => { t.nightEvents[0].missed = { effects: { food: -1 } }; });
  s.day = 2; const food0 = s.world.food;
  s.people.gicheol.status = 'dead';
  s.nightLog.push(logRow({ id: 'r1_steal_food', day: 1 }), logRow({ id: 'r1_steal_food', day: 0, actor: 'soonrye' }));
  N.applyNeglect(s, db);
  assert.strictEqual(s.world.food, food0, '행위자가 죽었다 → 건너뜀');
  assert.ok(s.nightLog.slice(0, 2).every((e) => e.judged));
  // rollNight 가 부른다
  const c = setup((t) => { t.nightEvents[0].missed = { effects: { flag: { saw_nothing: true } } }; });
  c.s.nightLog.push(logRow({ id: 'r1_steal_food', day: c.s.day - 1 }));
  N.rollNight(c.s, c.db);
  assert.strictEqual(c.s.flags.saw_nothing, true);
});

test('E2 누구나 아는 밤: public:1 또는 kill 효과가 있는 행은 굴릴 때 바로 발견', () => {
  const { db, s } = setup((t) => { t.nightEvents.length = 0; t.nightEvents.push(night('n_pub', { role: 'kill', actor: 'soonrye', public: 1 }), night('n_kill', { role: 'kill', actor: 'gicheol', effects: { kill: { who: 'actor' } } }), night('n_quiet', { role: 'steal', actor: 'mari' })); });
  s.world.max_per_night = 5;
  N.rollNight(s, db);
  const d = Object.fromEntries(s.nightLog.map((e) => [e.id, e.discovered]));
  assert.deepStrictEqual(d, { n_pub: true, n_kill: true, n_quiet: false });
});

test('곁가지 행 side:1 — 한 밤 상한·행위자 한 번 규칙 밖(weight 10 = 늘), 주민 사건 자리를 뺏지 않는다 (검토 지적 20)', () => {
  const { db, s } = setup((t) => { t.nightEvents.length = 0; t.nightEvents.push(night('n_main', { actor: 'soonrye', target: 'you' }), night('n_side', { actor: 'soonrye', target: 'you', side: 1, trace: { bowl_soonrye: 'empty' } })); });
  s.world.max_per_night = 1;
  const got = N.rollNight(s, db).map((x) => x.id);
  assert.deepStrictEqual(got, ['n_main', 'n_side'], '같은 행위자·같은 대상(당신)이어도 둘 다');
  const w = setup((t) => { t.nightEvents.length = 0; t.nightEvents.push(night('n_side', { actor: 'soonrye', side: 1, weight: 1 })); });
  let hits = 0;
  for (let i = 0; i < 200; i++) { const st = clone(w.s); st.rng = i * 7919 + 1; hits += N.rollNight(st, w.db).length; }
  assert.ok(hits > 5 && hits < 50, `weight 1 = 약 10% (${hits}/200)`);
});

// ── E3 흔적 late ──
test('E3 late 흔적: 조사 글은 <줄id>_late, 그날 첫 조사 때 toast_late 한 번 (줄이 있을 때) · 저장 왕복·옛 저장은 late 0', () => {
  const { db, s } = setup((t) => {
    t.lines.push({ id: 'insp_crate_open_late', speaker: 'narrator', grade: 'normal', text: '뚜껑이 어제처럼 열려 있다.' }, { id: 'toast_late', speaker: 'ui', grade: 'toast', text: '어제 못 본 자리가 그대로다.' });
    t.nightEvents[0].missed = { trace: { crate_food: 'open' } };
  });
  toPhase(s, db, 1, 'night');
  s.nightLog.push(logRow({ id: 'r1_steal_food', day: 0 }));
  N.applyNeglect(s, db);
  assert.strictEqual(s.traces.crate_food.late, 1);
  assert.strictEqual(E.inspectLineId(s, db, 'crate_food'), 'insp_crate_open', '같은 날(아직 밤) — 늦은 흔적은 어젯밤 것(day == 오늘−1)만 (10-24 검증 A4-6)');
  s.traces.bowl_soonrye.st = 'empty';
  assert.strictEqual(E.inspectLineId(s, db, 'bowl_soonrye'), 'insp_bowl_empty', 'late 아닌 흔적은 그대로');
  s.world.food = 0;   // 그 밤에 도둑질(crate_food 를 다시 바꾸는 행)이 안 일어나게 — 일어나도 late 는 남는다(아래 A4-4 테스트)
  toPhase(s, db, 2, 'trace');
  assert.strictEqual(E.inspectLineId(s, db, 'crate_food'), 'insp_crate_open_late', '다음 아침 = 어젯밤 것');
  assert.ok(E.dispatch(s, { type: 'inspect', object: 'stairs' }, db).ok);
  assert.strictEqual(E.view(s, db).notice, 'toast_late');
  assert.ok(E.view(s, db).traces.find((x) => x.id === 'crate_food').late === 1);
  assert.ok(E.dispatch(s, { type: 'inspect', object: 'crate_food' }, db).ok);
  assert.strictEqual(E.view(s, db).notice, null, '하루 한 번');
  const back = E.normalize(JSON.parse(JSON.stringify(s)), db);
  assert.strictEqual(back.traces.crate_food.late, 1);
  const old = JSON.parse(JSON.stringify(s)); for (const tr of Object.values(old.traces)) delete tr.late; delete old.hurt; delete old.notice; delete old.noticeDay; delete old.stats.neglect;
  const o2 = E.normalize(old, db);
  assert.ok(Object.values(o2.traces).every((tr) => tr.late === 0));
  assert.deepStrictEqual([o2.hurt, o2.notice, o2.stats.neglect], [[], null, 0]);
});

test('E3 late (10-24 검증 A4-4·A4-6): 같은 밤 뒤 사건(주민·세계 시계)이 그 물건을 다시 바꿔도 late 가 남는다 · 며칠 지난 late 는 늦은 흔적이 아니다', () => {
  const { db, s } = setup((t) => {
    t.lines.push({ id: 'insp_crate_open_late', speaker: 'narrator', grade: 'normal', text: '뚜껑이 어제처럼 열려 있다.' }, { id: 'toast_late', speaker: 'ui', grade: 'toast', text: '어제 못 본 자리가 그대로다.' });
    t.nightEvents.length = 0;
    t.nightEvents.push(night('n_miss', { role: 'steal', actor: 'gicheol', cond: 'day>=99', missed: { trace: { crate_food: 'empty', bowl_mari: 'empty' } } }));   // 판정만 (그 밤에 다시 안 일어남)
    t.nightEvents.push(night('n_again', { role: 'steal', actor: 'soonrye', trace: { crate_food: 'open' } }));                                                    // 커져서 돌아온 그 밤에 같은 물건을 다시 바꾼다
    t.nightEvents.push(night('n_clock', { role: 'clock', actor: '-', kind: 'neutral', trace: { bowl_mari: 'empty' } }));                                       // 세계 시계도 같은 물건
  });
  s.day = 1; s.world.max_per_night = 5;
  s.nightLog.push(logRow({ id: 'n_miss', day: 0 }));
  const got = N.rollNight(s, db).map((x) => x.id);
  assert.ok(got.includes('n_again') && got.includes('n_clock'), got.join(','));
  assert.deepStrictEqual([s.traces.crate_food.st, s.traces.crate_food.late, s.traces.bowl_mari.st, s.traces.bowl_mari.late], ['open', 1, 'empty', 1], '뒤 사건의 상태 + late 그대로');
  assert.strictEqual(s.traces.bowl_soonrye.late, 0, 'missed 가 안 건드린 물건은 late 0');
  s.day = 2;   // 다음 아침
  assert.strictEqual(E.lateNow(s, s.traces.crate_food), true);
  assert.strictEqual(E.inspectLineId(s, db, 'crate_food'), 'insp_crate_open_late');
  assert.strictEqual(E.view(s, db).traces.find((x) => x.id === 'crate_food').late, 1);
  s.day = 4;   // 이틀 뒤 — late 칸은 남아 있어도 늦은 흔적이 아니다
  assert.strictEqual(s.traces.crate_food.late, 1);
  assert.strictEqual(E.lateNow(s, s.traces.crate_food), false);
  assert.strictEqual(E.inspectLineId(s, db, 'crate_food'), 'insp_crate_open', "며칠 지난 흔적에 '어제부터' 글을 쓰지 않는다");
  assert.strictEqual(E.view(s, db).traces.find((x) => x.id === 'crate_food').late, 0);
});

// ── E4 noExit ──
test('E4 noExit 경고 (10-24 tightrope R1 바꿈): 당신이 죽을 수 있는 사건에 늘 열린·살 확률 > 0 인 선택지(판정·금기 포함)가 없으면 경고 — swap 변형·줄타기·targetOptional 까지 본다', () => {
  const kill = { text: '', effects: { kill: { who: 'you' } } };
  const has = (t, id) => warns(t).some((w) => w.kind === 'noExit' && w.id === id);
  const dice = { label: '버틴다', warn: '끝이다', check: { skill: 'str', base: 50 }, ok: { text: '' }, fail: kill };
  const doom = pass('대답한다', kill, { warn: '올라간다' });   // 확정 죽음(살 확률 0)
  assert.ok(!has(withKarma((t) => t.events.push(ev('x1', 'trial', 'day==0', [pass('판다', {}, { cost: { food: 1 } }), dice]))), 'x1'), '죽는 주사위도 살 확률 > 0 이면 출구다 (전에는 경고였다 — R1)');
  assert.ok(has(withKarma((t) => t.events.push(ev('x1b', 'trial', 'day==0', [pass('판다', {}, { cost: { food: 1 } }), doom]))), 'x1b'), '비용 선택과 확정 죽음뿐');
  assert.ok(!has(withKarma((t) => t.events.push(ev('x2', 'trial', 'day==0', [pass('판다', {}, { cost: { food: 1 } }), doom, pass('가리킨다', {}, { taboo: 'give_other', warn: '그 사람이 맞는다' })]))), 'x2'), '금기 출구');
  assert.ok(has(withKarma((t) => t.events.push(ev('x3', 'trial', 'day==0', [doom, pass('가리킨다', {}, { taboo: 'give_other', swap: { when: 'karma>=8', out: { text: '', effects: { kill: { who: 'you' } } } } })]))), 'x3'), '카르마가 높으면 금기가 확정 죽음이 된다 → 출구 아님');
  assert.ok(!has(withKarma((t) => t.events.push(ev('x3b', 'trial', 'day==0', [doom, pass('가리킨다', {}, { taboo: 'give_other', swap: { when: 'karma>=8', check: { skill: 'talk', base: 50 }, ok: { text: '' }, fail: kill } })]))), 'x3b'), '카르마가 높으면 금기가 죽는 판정 — 살 확률 > 0 이라 출구');
  assert.ok(has(withKarma((t) => t.events.push(ev('x4', 'trial', 'day==0', [doom, pass('가리킨다', { effects: { injure: { who: 'target', n: 2 } } }, { taboo: 'give_other' })], { target: 'any', targetOptional: 1 }))), 'x4'), '대상이 없으면 잠기는 금기는 출구가 아니다');
  assert.ok(!has(withKarma((t) => t.events.push(ev('x5', 'trial', 'day==0', [doom, pass('버틴다', { effects: { injure: { who: 'you', n: 2 } } }, { warn: '크게 다친다' })]))), 'x5'), "'버틴다' 몸값");
  assert.ok(!has(withKarma((t) => t.events.push(ev('x6', 'trial', 'day==0', [doom, pass('버틴다', { effects: { injure: { who: 'you', n: 2 } } }, { warn: '크게 다친다', rope: { kind: 'endure' } })]))), 'x6'), '줄타기가 얹힌 몸값도 살 확률 > 0 (위험 0 출구가 없어도 강제가 아니다)');
});
test('E4 지금 표(v4/data)에 noExit 경고 0건 · 오류 0건', () => {
  const db = T.loadDir(path.join(__dirname, '..', 'data'));
  assert.deepStrictEqual(db.warnings.filter((w) => w.kind === 'noExit').map((w) => w.text), []);
});

// ── E5 신호 ──
test('E5 신호: signs.cold = 원한 ≥3 (sign_cold 로 바꿈) · 호칭 = 원한 ≥5 면 addressCold("" = 부르지 않음), 아니면 지금 호칭', () => {
  const { db, s } = setup((t) => { const p = t.people.find((x) => x.id === 'soonrye'); p.addressYou = { default: '자네', driver: '기사 양반' }; p.addressCold = '이봐'; t.people.find((x) => x.id === 'mari').addressCold = ''; });
  s.people.soonrye.n.grudge = 2;
  assert.strictEqual(E.signs(s, db).soonrye.cold, false);
  s.people.soonrye.n.grudge = 3;
  assert.strictEqual(E.signs(s, db).soonrye.cold, true);
  assert.strictEqual(E.signs(s, db).you.cold, false);
  assert.strictEqual(E.address(s, db, 'soonrye'), '자네', '축이 안 기울면 default');
  s.axes = { share: 3, hand: 2, name: 2 };
  assert.strictEqual(E.address(s, db, 'soonrye'), '기사 양반', '기운 후보의 호칭');
  s.people.soonrye.n.grudge = 5;
  assert.strictEqual(E.address(s, db, 'soonrye'), '이봐');
  s.people.mari.n.grudge = 6;
  assert.strictEqual(E.address(s, db, 'mari'), '', '빈 글 = 부르지 않는다');
  assert.strictEqual(E.view(s, db).people.find((p) => p.id === 'soonrye').address, '이봐');
  s.world.sign_cold = 6;
  assert.strictEqual(E.signs(s, db).soonrye.cold, false, '문턱은 numbers 의 sign_cold');
});

test('E5 잠금 이유 = req.why · req.cond (조건식) · 이유가 없으면 지금 글', () => {
  const { db, s } = setup((t) => t.events.push(ev('e_why', 'trial', 'day==0 & phase==evening', [pass('본다'), pass('챙긴 운임으로 탄다', {}, { req: { flag: 'fare_hoard', why: '챙긴 운임이 없다' } }), pass('가리킨다', {}, { req: { cond: 'karma<9', why: '아무도 안 믿는다' } }), pass('잡는다', {}, { req: { flag: 'nope' } })])));
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'e_why');
  let v = E.eventView(s, db).choices;
  assert.deepStrictEqual(v.map((c) => [c.locked, c.reason]), [[false, ''], [true, '챙긴 운임이 없다'], [false, ''], [true, '조건이 맞지 않다']]);
  s.world.karma = 9;
  v = E.eventView(s, db).choices;
  assert.deepStrictEqual([v[2].locked, v[2].reason], [true, '아무도 안 믿는다']);
});

test('signs.starving: 깃발만 보는 행위자 조건(새 도둑 행 flag:unseen_thief_actor)은 굶주림 문턱이 아니다 (검토 지적 23) — sleepless 의 깃발 조건은 그대로', () => {
  const { db, s } = setup((t) => { t.nightEvents.push(night('steal_again', { role: 'steal', actor: 'flag:unseen_thief_actor' }), night('ascend_x', { role: 'ascend', actor: 'flag:stood_stairs_actor', kind: 'neutral' })); });
  s.flags.unseen_thief_gicheol = true; s.flags.stood_stairs_gicheol = true;
  s.people.gicheol.n.hunger = 2;
  const g = E.signs(s, db).gicheol;
  assert.deepStrictEqual([g.starving, g.sleepless], [false, true]);
});

// ── swap ──
test('swap: 조건이 맞으면 선택지가 바뀐다 — 카르마 8 이상이면 금기가 판정(talk 50, 실패 죽음)이 되고 경고 글도 바뀐다', () => {
  const { db, s } = setup((t) => t.events.push(ev('e_sw', 'trial', 'day==0 & phase==evening', [
    pass('버틴다', { effects: { injure: { who: 'you', n: 2 } } }, { warn: '크게 다친다' }),
    pass('가리킨다', { effects: { karma: 3 } }, { taboo: 'give_other', warn: '그 사람이 대신 맞는다',
      swap: [{ when: 'karma>=12', label: '가리킨다', out: { text: '', effects: { kill: { who: 'you' } } }, warn: '아무도 안 돌아선다. 끝이다' },
        { when: 'karma>=8', check: { skill: 'talk', base: 50 }, warn: '아무도 안 돌아설 수 있다', ok: { text: '', effects: { karma: 3 } }, fail: { text: '', effects: { kill: { who: 'you' } } } }] })])));
  assert.deepStrictEqual(errs(withKarma((t) => t.events.push(clone(db.raw.events.find((e) => e.id === 'e_sw'))))), []);
  toPhase(s, db, 0, 'evening');
  let c = E.eventView(s, db).choices[1];
  assert.deepStrictEqual([c.warn, c.chance, c.taboo], ['그 사람이 대신 맞는다', null, true]);
  s.world.karma = 8;
  c = E.eventView(s, db).choices[1];
  assert.deepStrictEqual([c.warn, c.chance, c.taboo], ['아무도 안 돌아설 수 있다', 50 + 5 * s.people.you.skills.talk, true]);
  const meta = E.choiceMeta(s, db)[1];
  assert.deepStrictEqual([meta.swapped, meta.killYou, meta.check], [true, true, true]);
  s.world.karma = 12;
  assert.strictEqual(E.eventView(s, db).choices[1].warn, '아무도 안 돌아선다. 끝이다', '목록은 앞에서부터 처음 맞는 것');
  s.world.karma = 8;
  s.people.you.skills.talk = -20;   // 반드시 실패
  assert.ok(E.dispatch(s, { type: 'choose', i: 1 }, db).ok);
  assert.strictEqual(s.people.you.status, 'dead');
  assert.deepStrictEqual([s.ended.cause.event, s.ended.cause.warned, s.ended.cause.forced, s.ended.cause.swapped, s.ended.cause.warn], ['e_sw', true, false, true, '아무도 안 돌아설 수 있다']);
});
test('swap 표 검사: when 필수 · 모르는 칸 · 합친 선택지도 검사(check 만 있고 ok·fail 없음) · 빈 값 칸은 비운다', () => {
  const bad = (sw, want) => { const t = withKarma((x) => x.events.push(ev('e_b', 'trial', 'day==0', [pass('a'), pass('b', {}, { swap: sw })]))); assert.ok(errs(t).some((m) => m.includes(want)), `${want}\n${errs(t).join('\n')}`); };
  bad({ check: { skill: 'str', base: 50 }, ok: { text: '' }, fail: { text: '' } }, 'swap[0]: when: 조건식이 있어야');
  bad({ when: 'karma>=1', nope: 1 }, 'swap[0]: nope: swap 에 쓸 수 있는 칸은');
  bad({ when: 'karma>=1', check: { skill: 'str', base: 50 } }, 'swap[0]: check가 있으면 ok·fail 둘 다 필요');
  const emptyList = withKarma((x) => x.events.push(ev('e_b', 'trial', 'day==0', [pass('a'), pass('b', {}, { swap: [] })])));
  assert.deepStrictEqual(errs(emptyList), [], '빈 목록 = 없는 것(다른 빈 칸과 같다)');
  const S2 = require('../engine/schema.js');
  const m = S2.mergeSwap({ label: 'b', warn: 'x', taboo: 'give_other', out: { text: '' } }, { when: 'k', warn: '', taboo: '' });
  assert.deepStrictEqual(m, { label: 'b', out: { text: '' } }, '변형의 빈 값 = 그 칸을 비움');
});

// ── 대상 ──
test('targetOptional: 대상이 없어도 사건은 걸리고, 대상이 필요한 선택지만 잠긴다(req.why 또는 "댈 이름이 없다") · req.target', () => {
  const { db, s } = setup((t) => t.events.push(ev('e_opt', 'trial', 'day==0 & phase==evening', [pass('버틴다'), pass('다른 이름을 댄다', { effects: { fear: { who: 'target', n: 3 } } }, { taboo: 'name_other' }), pass('가리킨다', {}, { req: { target: 1, why: '가리킬 사람이 없다' } })], { target: 'any', targetOptional: 1 })));
  for (const p of ['soonrye', 'seoha', 'gicheol', 'mari']) s.people[p].status = 'dead';
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'e_opt', '대상이 없어도 걸린다');
  assert.strictEqual(s.pending.target, undefined);
  assert.deepStrictEqual(E.eventView(s, db).choices.map((c) => [c.locked, c.reason]), [[false, ''], [true, E.NO_TARGET_WHY], [true, '가리킬 사람이 없다']]);
  const b = setup((t) => t.events.push(ev('e_opt', 'trial', 'day==0 & phase==evening', [pass('버틴다'), pass('다른 이름을 댄다', { effects: { fear: { who: 'target', n: 3 } } })], { target: 'any', targetOptional: 1 })));
  toPhase(b.s, b.db, 0, 'evening');
  assert.ok(b.s.pending.target);
  assert.ok(E.eventView(b.s, b.db).choices.every((c) => !c.locked), '대상이 있으면 열림');
  // targetOptional 이 없으면 지금처럼 안 걸린다
  const c = setup((t) => t.events.push(ev('e_req', 'trial', 'day==0 & phase==evening', [pass('버틴다')], { target: 'any' })));
  for (const p of ['soonrye', 'seoha', 'gicheol', 'mari']) c.s.people[p].status = 'dead';
  toPhase(c.s, c.db, 0, 'evening');
  assert.notStrictEqual(c.s.pending && c.s.pending.id, 'e_req');
});

test('targetIf · most:<사람 수치>: 사건 대상에서 특정 사람을 뺀다(self!=gicheol) · 원한이 가장 큰 사람(0이면 없음, 같으면 무작위) (검토 지적 6·14)', () => {
  const { db, s } = setup();
  for (let i = 0; i < 40; i++) { const st = clone(s); st.rng = i * 104729 + 3; const who = E.eventTarget(st, db, 'any', 'self!=gicheol'); assert.ok(who && who !== 'gicheol', who); }
  assert.strictEqual(E.eventTarget(s, db, 'most:grudge'), null, '모두 0이면 대상 없음');
  s.people.seoha.n.grudge = 2; s.people.mari.n.grudge = 5; s.people.gicheol.n.grudge = 5;
  const tops = new Set(); for (let i = 0; i < 30; i++) { const st = clone(s); st.rng = i * 7 + 1; tops.add(E.eventTarget(st, db, 'most:grudge')); }
  assert.deepStrictEqual([...tops].sort(), ['gicheol', 'mari'], '같으면 무작위');
  assert.strictEqual(E.eventTarget(s, db, 'most:grudge', 'self!=gicheol'), 'mari');
  assert.strictEqual(E.eventTarget(s, db, 'most:grudge', 'grudge>=6'), null);
  s.flags.share_seen_seoha = true;
  assert.strictEqual(E.eventTarget(s, db, 'any', 'flag:share_seen_target'), 'seoha', '깃발 _<id> → _target');
  s.people.mari.status = 'dead';
  assert.strictEqual(E.eventTarget(s, db, 'most:grudge'), 'gicheol', '역에 있는 사람만');
});

test('fired:<사건> 조건 — 그 사건을 고른 횟수 (swap·req.cond 의 "되풀이할수록")', () => {
  const { db, s } = setup((t) => t.events.push(ev('e_rep', 'trial', 'phase==evening', [pass('버틴다', {}, { warn: '다친다', swap: { when: 'fired:e_rep>=1', warn: '손가락을 잃는다', out: { text: '', effects: { permanent: { who: 'you', kind: 'finger' } } } } })], { once: 0 })));
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(E.eventView(s, db).choices[0].warn, '다친다');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  toPhase(s, db, 1, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'e_rep');
  assert.strictEqual(E.eventView(s, db).choices[0].warn, '손가락을 잃는다');
});

// ── 부상 출처 · 원인 사건 ──
test('부상 출처 s.hurt 와 원인 사건: 깔때기 사건(when 이 당신 부상을 봄)으로 죽으면 원인 = 그 자리까지 다치게 한 사건', () => {
  const { db, s } = setup((t) => {
    t.events.push(ev('e_hurt', 'trial', 'day==0 & phase==evening', [pass('맞선다', { effects: { injure: { who: 'you', n: 2 } } }, { warn: '다친다' })]));
    t.events.push(ev('e_fever', 'trial', 'phase==night & injury_you>=3', [pass('약을 쓴다', {}, { cost: { meds: 99 } }), pass('남의 담요', {}, { taboo: 'take_blanket' }), { label: '땀을 뺀다', warn: '끝이다', check: { skill: 'str', base: 30 }, ok: { text: '' }, fail: { text: '', effects: { kill: { who: 'you' } } } }]));   // base 30 = 바닥(ropeFloor, 10-24 tightrope) — 아래에서 기술을 깎아 반드시 실패
  });
  toPhase(s, db, 0, 'evening');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.deepStrictEqual(s.hurt, [{ day: 0, src: 'ev:e_hurt/맞선다', n: 2 }]);
  s.people.you.n.injury = 3; s.hurt.push({ day: 0, src: 'night:r12_swing', n: 1 });
  toPhase(s, db, 0, 'night');
  assert.strictEqual(s.pending && s.pending.id, 'e_fever');
  s.people.you.skills.str = -30;
  E.dispatch(s, { type: 'choose', i: 2 }, db);
  const m = S.measure(db, s, { trips: 0 });
  assert.deepStrictEqual([m.causeKey, m.root, m.dayEvent, m.deathDay, m.deadByD5, m.aliveD4], ['e_fever', 'e_hurt', false, 0, true, false]);
  const a = S.aggregate(db, [m]);
  assert.deepStrictEqual([a.topCause, a.topRoot, a.byDay, a.dayEvent], [{ k: 'e_fever', share: 100 }, { k: 'e_hurt', share: 100 }, { 0: 1 }, {}]);
});

// ── 봇 ──
test('봇: 정책 묶음(GROUPS)은 모두 POLICIES 에 있고, 조심형에서 사람 흉내·금기 좋아함·몸 꺼림은 빠진다 · 10·11번째 성향 봇', () => {
  for (const g of Object.values(B.GROUPS)) for (const k of g) assert.ok(B.POLICIES[k], k);
  assert.ok(!B.CAREFUL.some((k) => B.POLICIES[k].pick || B.POLICIES[k].tabooBonus || B.POLICIES[k].risky || B.POLICIES[k].bodyAverse));
  assert.ok(!B.CAREFUL.includes('selfish') && B.CAREFUL.includes('selfish_nb'), '(10-24 검증) 몸 꺼림 selfish 는 조심형이 아니다');
  assert.deepStrictEqual(B.GROUPS.selfishPlain.slice().sort(), ['selfish_nb', 'selfish_rt0']);
  assert.ok(B.GROUPS.selfishQuirk.every((k) => B.POLICIES[k].bodyAverse) && B.GROUPS.selfishPlain.every((k) => !B.POLICIES[k].bodyAverse));
  assert.deepStrictEqual(B.GROUPS.a4, ['balanced', 'lazy', 'diligent']);
  assert.deepStrictEqual([B.POLICIES.counter.share, B.POLICIES.counter.hand, B.POLICIES.counter.name], [-1, 1, 1]);
  assert.deepStrictEqual([B.POLICIES.child.share, B.POLICIES.child.hand, B.POLICIES.child.name], [-1, -1, 1]);
  assert.strictEqual(B.POLICIES.selfish.bodyAverse, 3);
  assert.ok(!B.POLICIES.selfish_nb.bodyAverse && !B.POLICIES.selfish_rt0.bodyAverse && B.POLICIES.selfish_rt.bodyAverse === 3);
  for (const k of B.GROUPS.human) assert.ok(B.HUMAN_PICK[B.POLICIES[k].pick], k);
});
test('봇 점수: bodyAverse(다친다·잃는다·상한다 −3) · tabooBonus(남을 내미는 금기 −3 → +3)', () => {
  const hold = { label: '맞고 버틴다', warn: '크게 다친다', locked: false, chance: null };
  const point = { label: '옆 담요를 가리킨다', warn: '그 사람이 대신 당한다', taboo: true, locked: false, chance: null };
  const sc = (pol, c) => B.scoreChoice(c, B.POLICIES[pol], 'x', {});
  assert.strictEqual(sc('selfish_nb', hold) - sc('selfish', hold), 3);
  assert.strictEqual(sc('selfish_rt0', point) - sc('selfish_nb', point), 6);
  assert.ok(sc('selfish_rt0', point) > sc('selfish_rt0', hold), '끝까지 금기를 고른다');
  assert.ok(sc('selfish_nb', hold) > sc('selfish_nb', point), '버릇 없는 이기적 봇은 버틴다');
});
test('봇 점수 (10-24 검증 REG): 조심형은 평범한 대안이 열려 있으면 성향 가점으로 죽음 주사위를 사지 않는다 · 끝까지 금기 정책의 남을 내미는 금기는 그대로', () => {
  // dawn_strike 꼴: '축 늘어진다'(손 −1, 85%, 실패 = 끝) vs '맞고 버틴다'(크게 다친다) vs '옆 담요를 가리킨다'(금기, 카르마 8 이상이면 talk 50 · 끝)
  const limp = { label: '축 늘어진다', warn: '안 놓으면 끝이다', check: true, chance: 85, locked: false, axis: { hand: -1 } };
  const hold = { label: '맞고 버틴다', warn: '크게 다친다', check: false, chance: null, locked: false, axis: {} };
  const point = { label: '옆 담요를 가리킨다', warn: '아무도 안 돌아서면 끝이다', taboo: true, check: true, chance: 50, locked: false, axis: { hand: -1, share: -1 } };
  const ms = [limp, hold, point];
  const plainAlt = ms.some(B.isPlain);
  assert.strictEqual(plainAlt, true, '맞고 버틴다 = 평범한 대안(죽음 글 아님·금기 아님)');
  const sc = (pol, c, alt) => B.scoreChoice(c, B.POLICIES[pol], 'dawn_strike', { kind: 'trial', unwell: false, plainAlt: alt });
  assert.ok(sc('selfish_nb', hold, true) > sc('selfish_nb', limp, true), '버릇 없는 이기적: 버틴다 > 축 늘어진다 (가점 +2 가 15% 죽음을 사지 못한다)');
  assert.ok(sc('selfish_nb', limp, false) > sc('selfish_nb', limp, true), '평범한 대안이 없으면 가점은 그대로');
  assert.ok(sc('selfish_rt0', point, true) > sc('selfish_rt0', hold, true), '끝까지 금기(selfish_rt0): 판정이 된 금기도 끝까지 고른다');
  assert.strictEqual(sc('devoted', limp, true) - sc('devoted', limp, false), 0, '헌신(avoidDeadly < 1)은 그대로 — 축이 세게 끌면 죽음 주사위도 고른다');
  assert.strictEqual(sc('balanced', limp, true), sc('balanced', limp, false), '균형(축 0)은 바뀌지 않는다');
});
test('봇 동점: 둘 다 경고인 갈림에서 0.2점 안쪽이면 무작위 — 판정 % 몇 점 차로 늘 같은 쪽을 받지 않는다 (A3 분석 §5)', () => {
  const metas = [{ i: 0, label: '붙잡는다', warn: '놓치면 다친다', check: true, chance: 55, locked: false, axis: {} }, { i: 1, label: '놓친다', warn: '아이가 떠내려간다', check: false, chance: null, locked: false, axis: {} }, { i: 2, label: '본다', locked: false, axis: {} }];
  const db = { events: { x: { kind: 'trial' } } };
  const pol = B.POLICIES.balanced;
  const sc = metas.map((c) => B.scoreChoice(c, pol, 'x', {}));
  assert.ok(Math.abs(sc[0] - sc[1]) < B.TIE_WARN && sc[0] !== sc[1], sc.join(' '));
  const mk = (rng, ms) => ({ rng, pending: { id: 'x' }, people: { you: { n: { injury: 0 } } }, flags: {} });
  const two = metas.slice(0, 2);
  const picks = new Set(); for (let i = 0; i < 40; i++) picks.add(B.pickChoice(mk(i * 31 + 7), db, pol, two));
  assert.deepStrictEqual([...picks].sort(), [0, 1]);
  // 경고 없는 쪽이 가장 높으면 그것 하나 (동점 폭은 둘 다 경고일 때만)
  const p3 = new Set(); for (let i = 0; i < 20; i++) p3.add(B.pickChoice(mk(i * 31 + 7), db, pol, metas));
  assert.deepStrictEqual([...p3], [2]);
});
test('봇 한 판: 모든 정책이 끝까지 돌고 trace 에 home9·res7·crisis 가 남는다', () => {
  const db = T.loadDir(path.join(__dirname, '..', 'data'));
  for (const pol of Object.keys(B.POLICIES)) {
    const { s, trace } = B.play(db, 11, pol);
    assert.ok(s.ended, pol);
    const m = S.measure(db, s, trace);
    assert.ok(m.home9 === null || Number.isInteger(m.home9), pol);
    assert.ok(m.res7 === null || Number.isFinite(m.res7), pol);
    assert.ok(trace.crisis && typeof trace.crisis === 'object');
  }
});

// ── 합격선 ──
test('합격선 새 줄: A1 이기심(이른 안전 +5%p·열흘 생존 < 균형 4종·사인 쏠림 ≤60%) · A2(D5 ≥10%·한 사건 ≤40%·D2~D6) · A4(보통·부지런 − 게으름) · 정체 묶음', () => {
  const base = { n: 200, deaths: 100, deathRate: 50, warnedRate: 100, allDead: 0, nights: 9, malice: 3, hymn: 2, discovery: 60, explicit: 9, decisions: 9, blank: 0, forced: 0, forcedTraced: 0, starveDeaths: 0, unwarned: 0, train: 1, survived: 45, aliveD4: 88, deadByD5: 16, topCause: { k: 'fever_night', share: 35 }, topRoot: { k: 'd5_flood', share: 30 }, dayEvent: { 2: 1, 3: 1, 4: 2, 5: 9, 6: 1 }, home9: 3, home9N: 100, res7: 4, res7N: 120, neglect: 1, karma: 2, identity: {} };
  const ids = ['a', 'b'];
  const mk = (o) => Object.assign({}, base, o);
  const aggs = { balanced: mk({ identity: { a: 50, b: 50 } }), lazy: mk({ survived: 30, home9: 2.5, res7: 3.5 }), diligent: mk({ survived: 46, home9: 3.2, res7: 4.4 }),
    selfish: mk({ aliveD4: 100, survived: 60, topCause: { k: 'called_up', share: 95 }, identity: { a: 10, b: 90 } }), selfish_nb: mk({ aliveD4: 100, survived: 35 }), selfish_rt: mk({ survived: 20 }), selfish_rt0: mk({ aliveD4: 100, survived: 25 }),
    h_random: mk({ identity: { a: 30, b: 70 }, identityNP: { a: 60, b: 40 }, prologueDeaths: 100 }) };
  const g = S.gate(aggs, ids, ['balanced']);
  const row = (p) => g.rows.find((r) => r[0].startsWith(p));
  assert.deepStrictEqual(row('A1 이른 안전').slice(3), [true, false], '+12%p = 통과·경계 밖 (버릇 없는 이기적 각각)');
  assert.deepStrictEqual(S.gate(Object.assign({}, aggs, { selfish_nb: Object.assign({}, aggs.selfish_nb, { aliveD4: 96 }) }), ids, ['balanced']).rows.find((r) => r[0].startsWith('A1 이른 안전')).slice(3), [true, true], '+8%p = 통과지만 경계(31 §4 △)');
  assert.deepStrictEqual(row('A1 이기심의 값').slice(3), [true, false], '버릇 없는 이기적 −10·−20 = 통과 (몸 꺼림 selfish +15 는 참고 줄)');
  assert.ok(row('A1 이기심의 값')[2].includes('selfish_nb') && !/(^|[^_])selfish [+-]/.test(row('A1 이기심의 값')[2]), row('A1 이기심의 값')[2]);
  assert.ok(row('  참고: 몸 꺼림 버릇').slice(2, 4)[0].includes('selfish +15'), '몸 꺼림 정책은 측정 줄');
  assert.strictEqual(row('A1 이기적 사인 쏠림')[3], true, '몸 꺼림 selfish 의 95% 쏠림은 판정에 안 든다');
  assert.ok(row('정체 — 사람 흉내 평균, 가장 큰 후보')[2] === 'a 60%', '사람 흉내 정체 = 프롤로그 사망 판을 뺀 분포');
  assert.ok(row('  참고: 사람 흉내 평균 (옛 방식')[2].includes('b 70') && row('  참고: 사람 흉내 평균 (옛 방식')[2].includes('h_random 50%'), row('  참고: 사람 흉내 평균 (옛 방식')[2]);
  // 사인 쏠림: 사망률이 SIGN_MIN_RATE % 보다 낮은 정책은 판정 안 함 — 판정할 정책이 없으면 △(경계)
  const few = S.gate(Object.assign({}, aggs, { selfish_nb: mk({ survived: 35, deaths: 3, deathRate: 1.5, topCause: { k: 'x', share: 100 } }), selfish_rt0: mk({ survived: 25, deaths: 5, deathRate: 2.5, topCause: { k: 'y', share: 100 } }) }), ids, ['balanced']).rows.find((r) => r[0].startsWith('A1 이기적 사인 쏠림'));
  assert.deepStrictEqual(few.slice(3), [true, true], few[2]);
  // A2 날마다 (10-24 tightrope §3 바꿈): 합격선은 D2·D4·D5 만 — D3(규칙을 배우는 날)·D6(값을 치르면 사는 날)은 측정 줄.
  //   조심형 합산 — 전 정책 합산이면 >0 이어도 조심형이 0 인 날이 있으면 미달 (10-24 검증 A2)
  const a2 = S.gate(Object.assign({}, aggs, { balanced: mk({ dayEvent: { 2: 1, 4: 2, 5: 9 } }), h_random: mk({ dayEvent: { 2: 5, 3: 90, 4: 5, 5: 5, 6: 5 } }) }), ids, ['balanced']).rows;
  assert.strictEqual(a2.find((r) => r[0].startsWith('A2 D2·D4·D5'))[3], true, 'D3·D6 이 0 이어도 D2·D4·D5 > 0 이면 통과');
  assert.deepStrictEqual(a2.find((r) => r[0].startsWith('  A2 D3·D6')).slice(2, 4), ['D3 0 · D6 0', true], 'D3·D6 은 측정');
  const a2b = S.gate(Object.assign({}, aggs, { balanced: mk({ dayEvent: { 2: 1, 3: 4, 5: 9, 6: 2 } }), h_random: mk({ dayEvent: { 2: 5, 3: 90, 4: 5, 5: 5, 6: 5 } }) }), ids, ['balanced']).rows;
  assert.strictEqual(a2b.find((r) => r[0].startsWith('A2 D2·D4·D5'))[3], false, '균형(조심형)의 D4 0 이 h_random 에 가려지지 않는다');
  assert.ok(a2.find((r) => r[0].startsWith('  참고: 같은 값'))[2].includes('전 D2 12 · D3 96'));
  assert.deepStrictEqual(row('A2 D5까지').slice(3), [true, false]);
  assert.deepStrictEqual(row('A2 균형 사망 중 한 사건 비중 (사인').slice(3), [true, true], '35% = 통과지만 ±5 안');
  assert.strictEqual(row('A2 D2·D4·D5')[3], true);
  assert.deepStrictEqual(row('A4 게으름의 값 — 생존').slice(3), [true, false], '+15·+16');
  assert.strictEqual(row('A4 게으름의 값 — D9')[3], true);
  assert.strictEqual(row('A4 게으름의 값 — D7')[3], true);
  assert.strictEqual(row('정체 — 성향 봇 평균, 가장 큰 후보')[2], 'b 70%');
  assert.strictEqual(row('정체 — 사람 흉내 평균, 각 후보')[3], true);
  // 하나라도 균형보다 오래 살면 미달
  const g2 = S.gate(Object.assign({}, aggs, { selfish_nb: mk({ survived: 60 }) }), ids, ['balanced']);
  assert.strictEqual(g2.rows.find((r) => r[0].startsWith('A1 이기심의 값'))[3], false);
  // 차이가 5%p 안이면 경계(△)
  const g3 = S.gate(Object.assign({}, aggs, { lazy: mk({ survived: 41 }) }), ids, ['balanced']);
  assert.deepStrictEqual(g3.rows.find((r) => r[0].startsWith('A4 게으름의 값 — 생존')).slice(3), [false, true]);
  // 발견율 하한은 측정만
  assert.strictEqual(row('발견율 (게으름)')[3], true);
  assert.strictEqual(row('찬가 발견율 (게으름)')[3], true);
  assert.strictEqual(row('강제 사망 = 확정 사망')[1].startsWith('0 판'), true);
});

test('run.js: 밑줄 정책 이름·여러 일꾼으로 끝까지 돈다 (보고서 표에 날별 사망·A1·A2·A4 지표·정체 묶음)', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'sim', 'run.js'), '2', 'balanced,selfish_rt0,h_cautious', '--blocks=1', '--workers=2'], { encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const want of ['selfish_rt0', 'h_cautious', '### 날별 당신 사망', '### A1·A2·A4 지표', '### 줄타기·발견 지표', '### 정체 묶음 평균', 'A4 게으름의 값 — 생존', 'A1 아슬함', 'A2 D2·D4·D5']) assert.ok(r.stdout.includes(want), want);
  const bad = spawnSync(process.execPath, [path.join(__dirname, '..', 'sim', 'run.js'), '1', 'nobody_here', '--blocks=1', '--workers=1'], { encoding: 'utf8', timeout: 60000 });
  assert.notStrictEqual(bad.status, 0, '모르는 정책은 멈춘다');
});

test('브라우저 갈래: 엔진 파일을 index.html 순서대로 (module 없이) 읽어도 표를 싣고 한 판이 돈다 — engine.js 가 DS4.schema 를 쓴다', () => {
  const vm = require('vm');
  const fs = require('fs');
  const ctx = { console, URLSearchParams, location: { search: '' }, fetch: () => Promise.reject(new Error('no fetch')) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['rng', 'cond', 'schema', 'tables', 'identity', 'effects', 'night', 'ledger', 'engine', 'save', 'browser']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'engine', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  const D4 = ctx.DS4;
  const dir = path.join(__dirname, '..', 'data');
  const raw = {};
  for (const [k, f] of Object.entries(D4.tables.FILES)) { let p = path.join(dir, f); if (!fs.existsSync(p) && D4.tables.ALT_FILES[k]) p = path.join(dir, D4.tables.ALT_FILES[k]); raw[k] = JSON.parse(fs.readFileSync(p, 'utf8')); }
  const db = D4.tables.load(raw);
  const s = D4.engine.newGame(db, 3);
  let g = 0;
  while (!s.ended && g++ < 300) { if (s.pending) { const v = D4.engine.eventView(s, db); const i = v.choices.findIndex((c) => !c.locked); D4.engine.dispatch(s, { type: 'choose', i }, db); } else D4.engine.dispatch(s, { type: 'next' }, db); }
  assert.ok(s.day >= 1, `하루 이상 돈다 (day ${s.day})`);
  const v = D4.engine.view(s, db);
  assert.ok(Array.isArray(v.traces) && v.traces.every((t) => t.late === 0 || t.late === 1));
  assert.ok(v.people.every((p) => p.status !== 'home' || !p.signs || typeof p.signs.cold === 'boolean'));
});

test('noteHurt: 당신 부상 증가만, 최근 HURT_MAX 개', () => {
  const s = { day: 3, hurt: [] };
  FX.noteHurt(s, [{ kind: 'number', id: 'injury', who: 'you', from: 0, to: 2 }, { kind: 'number', id: 'injury', who: 'mari', from: 0, to: 1 }, { kind: 'number', id: 'injury', who: 'you', from: 2, to: 1 }], 'ev:x/y');
  assert.deepStrictEqual(s.hurt, [{ day: 3, src: 'ev:x/y', n: 2 }]);
  for (let i = 0; i < FX.HURT_MAX + 5; i++) FX.noteHurt(s, [{ kind: 'number', id: 'injury', who: 'you', from: 0, to: 1 }], 'n' + i);
  assert.strictEqual(s.hurt.length, FX.HURT_MAX);
});
