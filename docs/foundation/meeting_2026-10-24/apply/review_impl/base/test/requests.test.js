// node --test v4/test — 10-22 데이터·화면 담당 요청을 엔진이 받은 것 (31 §6 "10-22 약속")
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { rawTables, clone, T, E } = require('./helpers.js');
const FX = require('../engine/effects.js');
const N = require('../engine/night.js');
const LEDGER = require('../engine/ledger.js');

const errs = (tables) => T.validate(tables).map((e) => e.text);
const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out) => ({ label, out: Object.assign({ text: '' }, out || {}) });
// 픽스처 + 고친 것 → db. 첫 사건(d0_notebook)을 고른 뒤 낮 단계 상태를 돌려준다
function setup(edit, seed) {
  const t = rawTables();
  if (edit) edit(t);
  const db = T.load(t);
  const s = E.newGame(db, seed || 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  return { db, s };
}
const toPhase = (s, db, day, phase) => { let g = 0; while (!(s.day === day && s.phase === phase) && !s.ended && g++ < 60) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); } };

// ── 1. 치료 ──
test('요청1 치료: treat_meds 만큼 약을 쓰고 부상에 treat_injury, treated 깃발 · 약 없음·두 번·다친 데 없음·표에 규칙 없음은 거절', () => {
  const { db, s } = setup();
  s.people.gicheol.n.injury = 3; s.world.meds = 1;
  assert.ok(E.dispatch(s, { type: 'treat', who: 'gicheol' }, db).ok);
  assert.strictEqual(s.world.meds, 0);
  assert.strictEqual(s.people.gicheol.n.injury, 2);
  assert.strictEqual(s.flags.treated_gicheol, true);
  assert.strictEqual(E.dispatch(s, { type: 'treat', who: 'gicheol' }, db).ok, false, '하루 한 번');
  s.people.mari.n.injury = 1;
  assert.strictEqual(E.dispatch(s, { type: 'treat', who: 'mari' }, db).ok, false, '약이 모자라면 거절');
  s.world.meds = 2;
  assert.strictEqual(E.dispatch(s, { type: 'treat', who: 'soonrye' }, db).ok, false, '다친 데가 없으면 거절');
  assert.ok(E.dispatch(s, { type: 'treat', who: 'mari' }, db).ok);
  assert.strictEqual(s.world.meds, 1);
  const { db: db2, s: s2 } = setup((t) => { t.numbers = t.numbers.filter((n) => n.id !== 'treat_meds'); });
  s2.people.gicheol.n.injury = 2;
  assert.strictEqual(E.dispatch(s2, { type: 'treat', who: 'gicheol' }, db2).ok, false, '표에 치료 규칙이 없으면 엔진이 지어내지 않는다');
});

// ── 2·5·18. 결과 그림 · 결말 안의 죽음 사인 · 되풀이 사건 집계 ──
test('요청2·5·18 결과 그림은 lastResult.image · ended.cause.image 로, 결말 사건 안에서 죽어도 cause 가 남는다', () => {
  const { db, s } = setup((t) => {
    t.events.push(ev('end_x', 'ending', 'day==0 & phase==evening', [
      { label: '운임 없이 탄다', warn: '차장이 당신을 센다', out: { text: '셌다.', image: 'death_counted', effects: { kill: { who: 'you', how: 'ascended' } } } },
      pass('남는다')]));
  });
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending.id, 'end_x');
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.lastResult.image, 'death_counted');
  assert.strictEqual(s.ended.why, 'end_x');
  assert.deepStrictEqual(s.ended.cause, { event: 'end_x', choice: '운임 없이 탄다', warned: true, forced: false, free: { event: 'end_x', choice: '운임 없이 탄다', day: 0 }, image: 'death_counted', night: false });
  assert.strictEqual(s.people.you.status, 'ascended');
});

test('요청5 once:0 사건도 s.fired 에 세고, 같은 단계에서는 되풀이하지 않는다', () => {
  const { db, s } = setup((t) => {
    t.events.push(ev('again_x', 'trial', 'phase==evening', [pass('본다', { effects: { fear: 1 } })], { once: 0, explicit: 1 }));
  });
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending.id, 'again_x');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.pending, null, '고른 뒤 다시 찾아도 같은 단계에서는 안 걸린다');
  assert.strictEqual(s.fired.again_x, 1);
  assert.ok(!('again_x' in s.done));
  E.dispatch(s, { type: 'talk', who: 'soonrye' }, db);
  assert.strictEqual(s.pending, null, '조사·말 걸기로 다시 깨워도 이번 단계엔 안 걸린다');
  toPhase(s, db, 1, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'again_x', '다음 날 저녁엔 다시 걸린다');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.fired.again_x, 2);
});

// ── 3. 효과 꼴: 같은 키 두 번 ──
test('요청3 같은 수치·injure·kill·permanent 를 한 결과에 두 번 쓰면 목록이 되고 전부 적용된다', () => {
  const o = T.effectsToObject([{ verb: 'injure', who: 'soonrye', n: 1 }, { verb: 'injure', who: 'gicheol', n: 2 },
    { verb: 'permanent', who: 'soonrye', loss: 'finger' }, { verb: 'permanent', who: 'you', loss: 'leg' },
    { verb: 'number', id: 'thirst', who: 'actor', n: -3 }, { verb: 'number', id: 'thirst', who: 'target', n: 2 },
    { verb: 'axis', id: 'share', n: 1 }, { verb: 'axis', id: 'share', n: 1 }, { verb: 'number', id: 'food', n: 1 }], 'x');
  assert.deepStrictEqual(o.injure, [{ who: 'soonrye', n: 1 }, { who: 'gicheol', n: 2 }]);
  assert.deepStrictEqual(o.permanent, [{ who: 'soonrye', kind: 'finger' }, { who: 'you', kind: 'leg' }]);
  assert.deepStrictEqual(o.thirst, [{ who: 'actor', n: -3 }, { who: 'target', n: 2 }]);
  assert.deepStrictEqual(o.axis, { share: 2 }, '같은 축 두 번은 합');
  assert.strictEqual(o.food, 1, '한 번만 쓴 키는 그대로(목록 아님)');
  const t = rawTables();
  t.events[3].choices[0].out.effects = [{ verb: 'injure', who: 'soonrye', n: 1 }, { verb: 'injure', who: 'gicheol', n: 2 }, { verb: 'permanent', who: 'soonrye', loss: 'finger' }, { verb: 'permanent', who: 'you', loss: 'leg' }];
  assert.deepStrictEqual(errs(t), []);
  const db = T.load(t);
  const s = E.newGame(db, 2); E.dispatch(s, { type: 'choose', i: 1 }, db);
  s.pending = { id: 'trip_a1_stall', kind: 'trip' };
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.people.soonrye.n.injury, 1); assert.strictEqual(s.people.gicheol.n.injury, 2);
  assert.ok(s.people.soonrye.permanent.finger !== undefined && s.people.you.permanent.leg !== undefined);
  // 밤 사건: 행위자 목마름 −3 · 대상 +2 둘 다
  const st = E.newGame(db, 3);
  st.people.mari.n.thirst = 6; st.people.gicheol.n.thirst = 3;
  FX.apply(st, db, o, { actor: 'mari', target: 'gicheol' }, null);
  assert.strictEqual(st.people.mari.n.thirst, 3); assert.strictEqual(st.people.gicheol.n.thirst, 5);
  // 목록 꼴 검사: 빈 목록은 오류
  const t2 = rawTables(); t2.events[3].choices[0].out.effects = { injure: [] };
  assert.ok(errs(t2).some((x) => x.includes('effects.injure: 빈 목록')), errs(t2).join('\n'));
});

test('요청3 실제 표: 로더가 효과를 하나도 잃지 않는다 (배열 원소 수 = 정규화 뒤 적용 단위 수)', () => {
  const fs = require('fs');
  const dir = path.join(__dirname, '..', 'data');
  const raw = { events: JSON.parse(fs.readFileSync(path.join(dir, 'events.json'), 'utf8')), nightEvents: JSON.parse(fs.readFileSync(path.join(dir, 'nightEvents.json'), 'utf8')) };
  const units = (o) => Object.entries(o || {}).reduce((a, [k, v]) => a + (['flag', 'trace', 'axis'].includes(k) ? Object.keys(v).length : Array.isArray(v) ? v.length : 1), 0);
  const uniqSub = (arr) => { const seen = new Set(); let n = 0; for (const e of arr) { if (['flag', 'trace', 'axis'].includes(e.verb)) { const k = e.verb + ':' + e.id; if (seen.has(k)) continue; seen.add(k); } n++; } return n; };
  let checked = 0;
  for (const e of raw.events) for (const c of e.choices) for (const k of ['out', 'ok', 'fail']) if (c[k] && Array.isArray(c[k].effects) && c[k].effects.length) { assert.strictEqual(units(T.effectsToObject(c[k].effects, e.id)), uniqSub(c[k].effects), `${e.id}[${c.label}].${k}`); checked++; }
  for (const n of raw.nightEvents) if (Array.isArray(n.effects) && n.effects.length) { assert.strictEqual(units(T.effectsToObject(n.effects, n.id)), uniqSub(n.effects), n.id); checked++; }
  assert.ok(checked > 100, '검사한 결과 ' + checked);
});

// ── 4·16. who 낱말 ──
test('요청4·16 who 낱말: all(역에 있는 사람 전부) · bondOfActor · 모르는 who 는 표 검사 오류', () => {
  const { db, s } = setup();
  s.people.mari.status = 'dead';
  const before = Object.fromEntries(Object.values(s.people).map((p) => [p.id, p.n.fear]));
  FX.apply(s, db, { fear: { who: 'all', n: 1 } }, { actor: 'you' }, null);
  for (const p of Object.values(s.people)) assert.strictEqual(p.n.fear, before[p.id] + (p.status === 'home' ? 1 : 0), p.id);
  s.people.mari.status = 'home';
  FX.apply(s, db, { permanent: { who: 'bondOfActor', kind: 'finger' } }, { actor: 'mari' }, null);
  assert.ok(s.people.gicheol.permanent.finger !== undefined, '마리의 bond = 기철');
  assert.deepStrictEqual(FX.resolveWhos('companion', { actor: 'you' }, s), [], '동행이 없으면 아무도 아니다');
  const t = rawTables(); t.events[3].choices[0].out.effects = { injure: { who: 'compnion', n: 1 } };
  assert.ok(errs(t).some((x) => x.includes('effects.injure.who: "compnion"')), errs(t).join('\n'));
});

// ── 4·20. 원정 편성 · 하루 한 번 · 층 순서 ──
function tripTables(t, size) {
  t.phases.find((p) => p.id === 'day').actions.push('trip');
  if (size != null) t.numbers.push({ id: 'trip_party', owner: 'world', min: 0, max: 4, start: size, visible: 'never' });
  t.events = t.events.filter((e) => e.id !== 'trip_a1_stall');
  t.events.push(ev('trip_f1', 'trip', 'day>=1 & floor==1', [pass('함께 맞선다', { effects: { injure: { who: 'companion', n: 1 }, fear: { who: 'party', n: 2 } } })]));
  t.events.push(ev('trip_f2', 'trip', 'day>=1 & floor==2', [pass('내려간다', { effects: { kill: { who: 'companion' } }, ledger: { who: 'companion', status: 'dead', day: '{day}', cause: '' } })]));
}
test('요청4·20 원정: trip_party 만큼 동행(위독 제외, 나이 무관), companion·party 효과, 낮에 한 번·1층→2층 순서', () => {
  const { db, s } = setup((t) => tripTables(t, 2), 5);
  toPhase(s, db, 1, 'day');
  s.people.gicheol.n.injury = 3;                        // 위독은 못 따라간다
  assert.strictEqual(E.dispatch(s, { type: 'trip', region: 'A', floor: 2 }, db).ok, false, '첫 동작은 1층');
  assert.strictEqual(s.trip, null);
  const fear0 = s.people.you.n.fear;
  assert.ok(E.dispatch(s, { type: 'trip', region: 'A', floor: 1 }, db).ok);
  assert.strictEqual(s.trip.party.length, 2);
  assert.ok(!s.trip.party.includes('gicheol'), '위독은 동행이 아니다');
  assert.deepStrictEqual(E.view(s, db).trip.party, s.trip.party);
  const comp = s.trip.party[0];
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.people[comp].n.injury, 1, 'companion = 첫 동행');
  assert.strictEqual(s.people.you.n.fear, fear0 + 2, 'party 에 당신도 든다');
  for (const id of s.trip.party) assert.ok(s.people[id].n.fear >= 2, id);
  assert.strictEqual(E.dispatch(s, { type: 'trip', region: 'A', floor: 1 }, db).ok, false, '같은 층 두 번 없음');
  assert.strictEqual(E.dispatch(s, { type: 'trip', region: 'B', floor: 2 }, db).ok, false, '지역은 하나');
  assert.strictEqual(E.dispatch(s, { type: 'trip', floor: 3 }, db).ok, false, '2층을 거쳐야 3층');
  assert.ok(E.dispatch(s, { type: 'trip', floor: 2 }, db).ok);
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.people[comp].status, 'dead', '2층에서 동행이 죽었다');
  assert.strictEqual(s.lastResult.companion, comp);
  // with 로 고르기: 바깥 사람·정원 초과는 거절, 서하(17)는 다른 주민과 똑같이 고를 수 있다(10-22 미성년 처리 금지)
  const { db: db2, s: s2 } = setup((t) => tripTables(t, 1), 6);
  toPhase(s2, db2, 1, 'day');
  assert.strictEqual(E.dispatch(s2, { type: 'trip', region: 'A', floor: 1, with: ['eunchae'] }, db2).ok, false, '바깥 사람은 동행이 아니다');
  assert.strictEqual(E.dispatch(s2, { type: 'trip', region: 'A', floor: 1, with: ['soonrye', 'mari'] }, db2).ok, false);
  assert.ok(E.dispatch(s2, { type: 'trip', region: 'A', floor: 1, with: ['mari'] }, db2).ok);
  assert.deepStrictEqual(s2.trip.party, ['mari']);
  const { db: db4, s: s4 } = setup((t) => tripTables(t, 1), 6);
  toPhase(s4, db4, 1, 'day');
  assert.ok(E.dispatch(s4, { type: 'trip', region: 'A', floor: 1, with: ['seoha'] }, db4).ok, '서하(17)도 동행이 될 수 있다');
  assert.deepStrictEqual(s4.trip.party, ['seoha']);
  // trip_party 행이 없으면 혼자 (companion 효과는 아무 일도 없다)
  const { db: db3, s: s3 } = setup((t) => tripTables(t, null), 7);
  toPhase(s3, db3, 1, 'day');
  assert.ok(E.dispatch(s3, { type: 'trip', region: 'A', floor: 1 }, db3).ok);
  assert.deepStrictEqual(s3.trip.party, []);
  assert.ok(E.dispatch(s3, { type: 'choose', i: 0 }, db3).ok);
});

// ── 6. 소문 발견 ──
test('요청6 거짓 소문(truth 0)은 들어도 발견이 아니다, 참 소문만', () => {
  for (const truth of [0, 1]) {
    const { db, s } = setup(null, 2);
    s.people.gicheol.n.hunger = 9;
    toPhase(s, db, 1, 'trace');
    const i = s.rumors.findIndex((r) => r.event === 'r1_steal_food');
    assert.ok(i >= 0, JSON.stringify(s.rumors));
    s.rumors[i].truth = truth;
    assert.ok(E.dispatch(s, { type: 'hear', i }, db).ok);
    assert.strictEqual(s.nightLog.find((e) => e.id === 'r1_steal_food').discovered, truth === 1);
  }
});

// ── 7. 배식 흔적 ──
test('요청7 배식: 받은 그릇 full, 못 받은 그릇 empty (둘 다 본 것) — 밤에 바뀌면 구별된다', () => {
  const { db, s } = setup();
  toPhase(s, db, 1, 'ration');
  if (s.pending) E.dispatch(s, { type: 'choose', i: 1 }, db);
  s.world.food = 1; s.world.water = 5;
  assert.ok(E.dispatch(s, { type: 'ration', bowls: { soonrye: 1, seoha: 0, gicheol: 1 } }, db).ok);
  assert.deepStrictEqual([s.traces.bowl_soonrye.st, s.traces.bowl_seoha.st, s.traces.bowl_gicheol.st], ['full', 'empty', 'empty'], '식량이 모자라 기철은 못 받았다');
  assert.ok(s.traces.bowl_seoha.seen && s.traces.bowl_seoha.by === 'you');
});

// ── 8·11. 사건 연쇄 · move 가 사건을 깨운다 ──
test('요청11 사건 연쇄: 고른 뒤 같은 단계의 다음 사건이 걸린다 (함께 센다 → 이름이 불린다)', () => {
  const { db, s } = setup((t) => {
    t.events.push(ev('count_x', 'fixed', 'day==0 & phase==evening', [pass('숨을 죽인다'), pass('함께 센다', { effects: { flag: { counted_together: true } } })]));
    t.events.push(ev('called_x', 'fixed', 'day==0 & phase==evening & flag:counted_together', [pass('대답하지 않는다')]));
  });
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending.id, 'count_x');
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.strictEqual(s.pending && s.pending.id, 'called_x');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.pending, null);
});

test('요청19 move 는 그 지도에 걸린 사건을 깨운다', () => {
  const { db, s } = setup((t) => { t.events.push(ev('drain_x', 'fixed', 'map==drain_b1', [pass('본다')])); });
  assert.strictEqual(s.pending, null);
  assert.ok(E.dispatch(s, { type: 'move', map: 'drain_b1', x: 1, y: 1 }, db).ok);
  assert.strictEqual(s.pending && s.pending.id, 'drain_x');
});

// ── 12. 몸 신호 ──
test('요청12 view.people[].signs: 문턱은 밤 사건표의 행위자 조건 (fear·ascend → 안 잔다, steal·starve → 굶주림)', () => {
  const { db, s } = setup((t) => {
    t.nightEvents.push({ id: 'n_fear', role: 'fear', actor: 'needs.fear>=8', target: '-', cond: 'fuel==0', weight: 3, kind: 'neutral' });
    t.nightEvents.push({ id: 'n_ascend', role: 'ascend', actor: 'flag:stood_actor', target: '-', cond: 'fog<=1', weight: 3, kind: 'neutral' });
  });
  s.people.gicheol.n.fear = 9; s.people.you.n.fear = 9; s.people.mari.n.hunger = 7; s.flags.stood_soonrye = true; s.flags.ate_flesh_seoha = true;
  const sg = Object.fromEntries(E.view(s, db).people.map((p) => [p.id, p.signs]));
  assert.deepStrictEqual(sg.gicheol, { sleepless: true, starving: false, ateFlesh: false });
  assert.strictEqual(sg.soonrye.sleepless, true, '계단에 섰던 사람');
  assert.strictEqual(sg.mari.starving, true, 'steal 행 actor hunger>=7');
  assert.strictEqual(sg.seoha.ateFlesh, true);
  assert.strictEqual(sg.you.sleepless, false, '당신은 안 잔다 표시 없음');
  assert.strictEqual(sg.eunchae, null, '역에 없는 사람은 null');
  s.people.mari.n.hunger = 6;
  assert.strictEqual(E.signs(s, db).mari.starving, false);
});

// ── 13·15. 결말 status · board ──
test('요청13·15 결말: ledger status boarded → 당신이 탔다 · board:1 결말이 걸리면 태울 사람을 고른다 · endStatus walked', () => {
  const train = (t) => { t.phases.find((p) => p.id === 'day').actions = t.phases.find((p) => p.id === 'day').actions.filter((x) => x !== 'board');
    t.events.push(ev('end_train', 'ending', 'day==0 & phase==evening', [
      pass('탄다', { ledger: { who: 'you', status: 'boarded', day: '10', cause: '' } }), pass('남는다')], { board: 1 })); };
  const { db, s } = setup(train);
  assert.strictEqual(E.dispatch(s, { type: 'board', who: 'soonrye' }, db).ok, false, '단계 actions 에 board 가 없고 열차(board:1 결말)도 없으면 거절');
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(E.eventView(s, db).board, true);
  assert.ok(E.dispatch(s, { type: 'board', who: 'soonrye' }, db).ok, 'board:1 결말이 걸려 있으면 board 를 받는다');
  assert.ok(E.dispatch(s, { type: 'board', who: 'mari' }, db).ok);
  assert.ok(E.dispatch(s, { type: 'board', who: 'mari' }, db).ok, '다시 누르면 내린다');
  assert.strictEqual(E.dispatch(s, { type: 'board', who: 'you' }, db).ok, false, '당신은 선택지로 탄다');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  const st = Object.fromEntries(s.ended.ledger.map((r) => [r.id, r.status]));
  assert.deepStrictEqual([st.you, st.soonrye, st.mari, st.gicheol], ['boarded', 'boarded', 'stayed', 'stayed']);
  assert.strictEqual(s.ended.cause, null, '탄 사람은 사인이 없다');
  // board:0 결말에서는 board 동작이 열리지 않는다 (evening actions 에 없음)
  const { db: db2, s: s2 } = setup((t) => { train(t); t.events[t.events.length - 1].board = 0; });
  toPhase(s2, db2, 0, 'evening');
  assert.strictEqual(E.dispatch(s2, { type: 'board', who: 'soonrye' }, db2).ok, false);
  // endStatus walked: 남은 산 사람 전부 '걸어 나갔다'
  const { db: db3, s: s3 } = setup((t) => t.events.push(ev('end_walk', 'ending', 'day==0 & phase==evening', [pass('걷는다', { effects: { kill: { who: 'mari', how: 'ascended' } } })], { endStatus: 'walked' })));
  toPhase(s3, db3, 0, 'evening');
  E.dispatch(s3, { type: 'choose', i: 0 }, db3);
  const st3 = Object.fromEntries(s3.ended.ledger.map((r) => [r.id, r.status]));
  assert.deepStrictEqual([st3.you, st3.soonrye, st3.mari], ['walked', 'walked', 'ascended']);
  assert.ok(LEDGER.format(s3, db3).some((l) => l === '1 김순례 — 걸어 나갔다'), LEDGER.format(s3, db3).join('\n'));
  // 표 검사: board·endStatus 는 결말에만
  const t4 = rawTables(); t4.events[0].board = 1;
  assert.ok(errs(t4).some((x) => x.includes('board·endStatus 는 kind ending')));
});

// ── 14. 명부 줄 ──
test('요청14 결과의 명부 줄: text 없는 기록은 쌓지 않고, text 는 사실 줄, cause "물건:상태" 는 그 ledgerFact 줄', () => {
  const { db, s } = setup((t) => t.events.push(ev('pillow_x', 'fixed', 'day==0 & phase==evening', [
    pass('수첩을 꺼낸다', { effects: { kill: { who: 'gicheol' }, trace: { pillow_gicheol: 'blood' } }, ledger: [{ who: 'gicheol', status: 'dead', day: '{day}', cause: 'pillow_gicheol:blood' }, { who: 'gicheol', text: '기철이 밤에 갔다.' }] }),
    pass('눈을 감는다', { effects: { kill: { who: 'gicheol' } }, ledger: { who: 'gicheol', status: 'dead', day: '{day}', cause: '' } })])));
  toPhase(s, db, 0, 'evening');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(s.ledger.causes.gicheol, 'D0 밤. 베개 자리 옮겨짐.');
  assert.deepStrictEqual(s.ledger.written.map((w) => w.text), ['기철이 밤에 갔다.']);
  const { db: db2, s: s2 } = setup((t) => t.events.push(clone(db.events.pillow_x)));
  toPhase(s2, db2, 0, 'evening');
  E.dispatch(s2, { type: 'choose', i: 1 }, db2);
  assert.deepStrictEqual(s2.ledger.written, [], 'text 없는 줄은 쌓지 않는다');
  assert.ok(!('gicheol' in s2.ledger.causes), '사인 칸은 빈칸(___) 그대로');
  const t3 = rawTables(); t3.events[1].choices[0].out.ledger = { who: 'you', status: 'gone' };
  t3.events[1].choices[1].out.ledger = { who: 'gicheol', cause: 'pillow_gicheol:nope' };
  const e3 = errs(t3);
  assert.ok(e3.some((x) => x.includes('ledger.status: dead/ascended/boarded/stayed/walked')), e3.join('\n'));
  assert.ok(e3.some((x) => x.includes('ledger.cause: "pillow_gicheol:nope"')), e3.join('\n'));
});

// ── 17. 수첩을 줍는 사람 ──
test('요청17 readerId: 당신이 죽으면 살아 있는 주민 중 가장 나이 많은 사람(people.age)이 수첩을 줍는다', () => {
  const { db, s } = setup();
  s.people.you.status = 'dead';
  assert.strictEqual(LEDGER.readerId(s, db), 'soonrye');
  s.people.soonrye.status = 'dead';
  assert.strictEqual(E.readerId(s, db), 'mari');
  s.people.mari.status = 'boarded';
  assert.strictEqual(LEDGER.readerId(s, db), 'gicheol', '역에 남은 사람이 먼저');
  s.people.gicheol.status = 'dead'; s.people.seoha.status = 'ascended';
  assert.strictEqual(LEDGER.readerId(s, db), 'mari', '남은 사람이 없으면 탄 사람');
  s.people.mari.status = 'dead';
  assert.strictEqual(LEDGER.readerId(s, db), null, '읽을 사람이 없다');
});

// ── 9. 밤 사건이 당신을 데려가면 ──
test('요청9 밤 사건으로 당신이 죽으면 사인은 그 밤 사건 (전의 상관없는 선택이 아니다)', () => {
  const { db, s } = setup((t) => t.nightEvents.push({ id: 'n_take_you', role: 'kill', actor: 'gicheol', target: 'you', cond: 'day==0', weight: 10, kind: 'malice', effects: { kill: { who: 'target' } } }));
  while (s.day === 0 && !s.ended) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); }
  assert.strictEqual(s.ended.why, 'you_gone');
  const { free, ...rest } = s.ended.cause;
  assert.deepStrictEqual(rest, { event: 'n_take_you', choice: null, warned: false, forced: false, image: '', night: true });
  assert.ok(free === null || typeof free.event === 'string', '앞선 자유 경고 선택(있으면)도 함께 남는다');
});

// ── 10. 바깥 사람 ──
test('요청10 바깥 사람(outside)은 이름으로 지목된 밤 사건의 행위자가 될 수 있고, 죽을 수도 있다', () => {
  const { db, s } = setup((t) => t.nightEvents.push({ id: 'n_valve', role: 'pair', actor: 'eunchae', target: '-', cond: 'day==0', weight: 10, kind: 'hymn', effects: { flood: -1, kill: { who: 'eunchae' } }, oncePerRun: 1 }));
  assert.strictEqual(s.people.eunchae.status, 'outside');
  toPhase(s, db, 1, 'trace');
  assert.ok(s.nightLog.some((e) => e.id === 'n_valve' && e.actor === 'eunchae'), JSON.stringify(s.nightLog));
  assert.strictEqual(s.people.eunchae.status, 'dead');
});

// ── 위독 유예 ──
test('위독: 밤 굴림 직전에 이미 위독이던 사람만 아침에 죽는다 — 밤 사건으로 막 위독이 되면 하루를 받는다', () => {
  const { db, s } = setup((t) => t.nightEvents.push({ id: 'n_hurt', role: 'hurt', actor: 'mari', target: 'gicheol', cond: 'day==0', weight: 10, kind: 'malice', effects: { injure: { who: 'target', n: 1 } }, oncePerRun: 1 }));
  s.people.gicheol.n.injury = 2;
  toPhase(s, db, 1, 'trace');
  assert.ok(s.nightLog.some((e) => e.id === 'n_hurt'));
  assert.strictEqual(s.people.gicheol.n.injury, 3);
  assert.strictEqual(s.people.gicheol.status, 'home', '하루를 받았다');
  toPhase(s, db, 2, 'trace');
  assert.strictEqual(s.people.gicheol.status, 'dead', '치료하지 않으면 다음 아침');
  assert.strictEqual(s.people.gicheol.day, 2);
});

// ── 사건 대상 열 ──
test('사건 target 열: 걸릴 때 대상을 정한다(무작위는 역의 주민, 나이 무관), 결과의 who:target 과 명부가 같은 사람', () => {
  const lull = (t) => t.events.push(ev('lull_x', 'fixed', 'day==0 & phase==evening', [pass('놓친다', { effects: { kill: { who: 'target' } }, ledger: { who: 'target', status: 'dead', day: '{day}', cause: '물에 들어갔다' } })], { target: 'randomSleeper' }));
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const { db, s } = setup(lull, seed);
    toPhase(s, db, 0, 'evening');
    const v = E.eventView(s, db);
    assert.ok(v.target && v.target !== 'you' && s.people[v.target].status === 'home', v.target);
    assert.strictEqual(v.targetName, s.people[v.target].name);
    E.dispatch(s, { type: 'choose', i: 0 }, db);
    assert.strictEqual(s.people[v.target].status, 'dead');
    assert.strictEqual(s.ledger.causes[v.target], '물에 들어갔다');
    seen.add(v.target);
  }
  assert.ok(seen.size >= 2, '무작위: ' + Array.from(seen).join(','));
  const t = rawTables(); t.events[0].target = 'nobody';
  assert.ok(errs(t).some((x) => x.includes('target: 사람 id 또는')));
});

// ── 저장 ──
test('새 상태 칸(fired·phaseSeen·critical·trip.floors/party)은 저장 왕복과 옛 저장 정규화를 견딘다', () => {
  const { db, s } = setup((t) => tripTables(t, 2), 9);
  toPhase(s, db, 1, 'day');
  E.dispatch(s, { type: 'trip', region: 'A', floor: 1 }, db);
  const back = E.normalize(clone(s), db);
  assert.deepStrictEqual(back, s);
  const old = clone(s); delete old.fired; delete old.phaseSeen; delete old.critical; delete old.trip.floors; delete old.trip.party;
  const n = E.normalize(old, db);
  assert.deepStrictEqual(n.fired, {}); assert.deepStrictEqual(n.phaseSeen, []); assert.strictEqual(n.critical, null);
  assert.deepStrictEqual(n.trip.floors, [1]); assert.deepStrictEqual(n.trip.party, []);
});
