// node --test v4/test — 10-22 검증 지적을 고친 것 (위독 유예·미성년 처리 없음·봇 점수·강제 사망·시드 블록 판정)
const test = require('node:test');
const assert = require('node:assert');
const { rawTables, T, E } = require('./helpers.js');
const B = require('../sim/bots.js');
const S = require('../sim/stats.js');

const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out, more) => Object.assign({ label, out: Object.assign({ text: '' }, out || {}) }, more || {});
function setup(edit, seed) {
  const t = rawTables();
  if (edit) edit(t);
  const db = T.load(t);
  const s = E.newGame(db, seed || 1);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  return { db, s };
}
const toPhase = (s, db, day, phase) => { let g = 0; while (!(s.day === day && s.phase === phase) && !s.ended && g++ < 60) { if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db); else E.dispatch(s, { type: 'next' }, db); } };

// ── 1. 위독 유예: 마지막 치료 기회(treat 가 있는 단계) 뒤에 위독이 되면 하루를 받는다 ──
test('위독: 밤 단계의 고정 사건으로 막 위독이 된 사람은 다음 아침에 죽지 않는다(하루를 받는다), 그다음 아침엔 죽는다', () => {
  const { db, s } = setup((t) => t.events.push(ev('n_shutter', 'fixed', 'day==0 & phase==night', [pass('본다', { effects: { injure: { who: 'gicheol', n: 3 } } })])));
  toPhase(s, db, 0, 'night');
  assert.strictEqual(s.pending && s.pending.id, 'n_shutter');
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  assert.strictEqual(s.people.gicheol.n.injury, 3);
  toPhase(s, db, 1, 'trace');
  assert.strictEqual(s.people.gicheol.status, 'home', '치료할 틈이 없었으니 하루를 받았다');
  toPhase(s, db, 2, 'trace');
  assert.strictEqual(s.people.gicheol.status, 'dead', '다음 날 치료하지 않으면 그다음 아침');
  assert.strictEqual(s.people.gicheol.day, 2);
});
test('위독: 치료 단계를 떠날 때 이미 위독이었으면 그 아침에 죽고, 그날 치료했으면 산다', () => {
  const a = setup();
  a.s.people.gicheol.n.injury = 3;
  toPhase(a.s, a.db, 1, 'trace');
  assert.strictEqual(a.s.people.gicheol.status, 'dead');
  const b = setup();
  b.s.people.gicheol.n.injury = 3;
  assert.ok(E.dispatch(b.s, { type: 'treat', who: 'gicheol' }, b.db).ok);
  toPhase(b.s, b.db, 1, 'trace');
  assert.strictEqual(b.s.people.gicheol.status, 'home');
});
test('위독: 치료 단계가 없는 표면 밤 굴림 직전에 명단을 찍는다(옛 규칙)', () => {
  const { db, s } = setup((t) => { for (const p of t.phases) p.actions = p.actions.filter((a) => a !== 'treat'); });
  s.people.gicheol.n.injury = 3;
  toPhase(s, db, 0, 'night');
  assert.strictEqual(s.critical, null, '아직 안 찍었다');
  toPhase(s, db, 1, 'trace');
  assert.strictEqual(s.people.gicheol.status, 'dead');
});

// ── 2. 미성년 처리 없음(10-22 디렉터 결정 '미성년 처리 금지') — 서하(17)도 다른 주민과 똑같다 ──
test('미성년 처리 없음: 서하(17)도 밤 악의의 무작위·조건 역할·mostInjured 대상이 된다', () => {
  const rows = (t) => {
    t.nightEvents = [
      { id: 'm_any', role: 'kill', actor: 'any', target: 'randomSleeper', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 },
      { id: 'm_cond', role: 'steal', actor: 'needs.fear>=0', target: 'needs.fear>=0', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 },
      { id: 'm_hurt', role: 'pair', actor: 'mari', target: 'mostInjured', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 }];
  };
  const seen = { actor: 0, target: 0, hurt: 0, hurtAll: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const { db, s } = setup(rows, seed);
    s.people.seoha.n.injury = 2; s.people.gicheol.n.injury = 1;   // 서하가 가장 많이 다쳤다
    toPhase(s, db, 2, 'trace');
    for (const e of s.nightLog) {
      if (e.id === 'm_hurt') { seen.hurtAll++; if (e.target === 'seoha') seen.hurt++; continue; }
      if (e.actor === 'seoha') seen.actor++;
      if (e.target === 'seoha') seen.target++;
    }
  }
  assert.ok(seen.actor > 0 && seen.target > 0, '악의의 무작위·조건 역할에 서하도 든다 ' + JSON.stringify(seen));
  assert.ok(seen.hurtAll > 0 && seen.hurt === seen.hurtAll, '가장 많이 다친 사람이 서하면 mostInjured 는 서하 ' + JSON.stringify(seen));
  assert.strictEqual(E.isMinor, undefined, '엔진에 미성년 판정이 없다');
  assert.strictEqual(E.ADULT_AGE, undefined);
  const N = require('../engine/night.js');
  assert.strictEqual(N.shieldMinors, undefined, '밤 부상 거름이 없다');
});

test('미성년 처리 없음: 밤 사건의 부상·영구 손상(bondOfActor·이름 지목)이 서하에게도 닿는다', () => {
  const rows = (t) => {
    t.nightEvents = [
      { id: 'n_bond', role: 'ascend', actor: 'soonrye', target: '-', cond: 'day==0', weight: 10, kind: 'neutral', effects: { permanent: { who: 'bondOfActor', kind: 'finger' }, fear: { who: 'actor', n: 1 } }, oncePerRun: 1 },
      { id: 'n_named', role: 'pair', actor: 'mari', target: 'seoha', cond: 'day==0', weight: 10, kind: 'malice', effects: { injure: [{ who: 'target', n: 1 }, { who: 'actor', n: 1 }] }, oncePerRun: 1 }];
    t.numbers = t.numbers.filter((r) => r.id !== 'max_per_night').concat([{ id: 'max_per_night', owner: 'world', min: 0, max: 9, start: 5, perDay: 0, visible: 'never' }]);
  };
  const { db, s } = setup(rows, 2);
  toPhase(s, db, 1, 'trace');
  const ids = s.nightLog.map((e) => e.id);
  assert.ok(ids.includes('n_bond') && ids.includes('n_named'), ids.join(','));
  assert.deepStrictEqual(Object.keys(s.people.seoha.permanent), ['finger'], '순례의 bond 서하도 손가락을 잃는다');
  assert.strictEqual(s.people.seoha.n.injury, 1, '이름으로 지목된 밤 부상이 서하에게 닿는다');
  assert.strictEqual(s.people.mari.n.injury, 1);
});

test('미성년 처리 없음: 낮 사건의 무작위 대상에 서하도 든다', () => {
  const targets = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { db, s } = setup((t) => t.events.push(ev('x_pick', 'trial', 'day==0 & phase==evening', [pass('본다', {})], { target: 'randomSleeper' })), seed);
    toPhase(s, db, 0, 'evening');
    if (s.pending && s.pending.id === 'x_pick') targets.add(s.pending.target);
  }
  assert.ok(targets.has('seoha'), [...targets].join(','));
});

// ── 3. 봇 점수: 판정 없는 경고에 모험 +1 없음 · 아플 때 약은 비용 감점 없음 · 죽음을 말하는 경고는 피한다 ──
const meta = (o) => Object.assign({ label: 'x', locked: false, chance: null, warn: '', hint: '', cost: null, taboo: false, axis: {}, killYou: false, check: false, gain: 0 }, o);
test('봇 점수: 죽음을 바로 말하는 경고(판정 없음)는 조심형·모험 모두 대안이 있으면 고르지 않는다', () => {
  const rot = [meta({ label: '보인다', warn: '약이 준다', cost: { meds: 1 } }), meta({ label: '짜낸다', warn: '잘못 짜면 번진다', check: true, chance: 45 }), meta({ label: '둔다', warn: '곪으면 끝이다', killYou: true })];
  const ctx = { kind: 'trial', unwell: true };
  for (const pol of ['balanced', 'risky', 'lazy']) {
    const sc = rot.map((c) => B.scoreChoice(c, B.POLICIES[pol], 'd7_rot', ctx));
    assert.ok(sc[2] < Math.max(sc[0], sc[1]) - 5, pol + ' ' + sc.join(','));
  }
  const bal = rot.map((c) => B.scoreChoice(c, B.POLICIES.balanced, 'd7_rot', ctx));
  assert.ok(bal[0] > bal[1], '균형: 약이 있으면 마리에게 보인다 ' + bal.join(','));
  assert.strictEqual(B.deadlyText(meta({ warn: '아침이 안 올 수 있다', check: true, chance: 40 })), true, '판정 있어도 죽음을 말하는 글은 죽음 글');
  assert.strictEqual(Math.round(B.deadlyRisk(meta({ warn: '아침이 안 올 수 있다', check: true, chance: 40 })) * 100), 60, '판정 있는 선택은 화면의 실패 % 만큼');
  assert.strictEqual(B.deadlyRisk(meta({ warn: '차장이 당신을 센다' })), 1, '판정 없는 죽음 글은 그대로');
  assert.strictEqual(B.deadlyRisk(meta({ warn: '잘못 짜면 번진다', check: true, chance: 40 })), 0);
  assert.strictEqual(B.deadlyText(meta({ warn: '차장이 당신을 센다' })), true);
  assert.ok(B.CAREFUL.includes('balanced') && !B.CAREFUL.includes('risky') && !B.CAREFUL.includes('devoted'));
});
test('봇 점수: 모험은 판정 없는 경고에 가점이 없고, 아플 때 약(비용이 약뿐·원정·거래 아님)은 비용 감점 없이 먼저 고른다', () => {
  const risky = B.POLICIES.risky;
  assert.strictEqual(B.scoreChoice(meta({ warn: '열차는 기관사 없이 간다' }), risky, 'd10_train'), -B.RISKY_FLAT_WARN, '판정 없는 경고 = 굴릴 것 없는 손해, 모험도 작게 감점');
  const med = meta({ warn: '약이 준다', cost: { meds: 1 } });
  assert.strictEqual(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: true }), B.RECOVERY_BONUS - B.RISKY_FLAT_WARN, '회복 가점(비용 감점 없음) − 판정 없는 경고 글의 작은 감점');
  assert.strictEqual(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: false }), -0.5 - B.RISKY_FLAT_WARN, '멀쩡하면 비용 감점');
  assert.strictEqual(B.isRecovery(med, 'trip_a1_pharmacy', { kind: 'trip', unwell: true }), false, '원정에서 약을 내주는 건 회복이 아니다');
  assert.strictEqual(B.isRecovery(med, 'trade_shutter', { kind: 'trial', unwell: true }), false, '거래는 회복이 아니다');
  assert.strictEqual(B.isRecovery(med, 'trade_shutter_b', { kind: 'trial', unwell: true }), false, '거래 변형 행도 회복이 아니다');
  assert.ok(B.isResource('patrol_pact_b') && !B.isResource('trade_shutterx'));
  const gamble = meta({ label: '눈을 감는다', warn: '아침이 안 올 수 있다', check: true, chance: 40 });
  for (const pol of ['risky', 'balanced', 'devoted']) assert.ok(B.scoreChoice(med, B.POLICIES[pol], 'fever_night', { kind: 'trial', unwell: true }) > B.scoreChoice(gamble, B.POLICIES[pol], 'fever_night', { kind: 'trial', unwell: true }), pol + ': 약이 있으면 열 주사위를 굴리지 않는다');
  const hold = meta({ warn: '사흘 뒤 끝이다' });
  assert.ok(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: true }) > B.scoreChoice(hold, risky, 'flood_sick', { kind: 'trial', unwell: true }), '모험: 약이 있으면 버티지 않는다');
});

test('봇 점수(10-23): 모든 선택지에 경고가 붙어도 조심형은 45% 죽는 주사위보다 무릎 꿇기·손가락을 고른다 · 모험은 동점이면 확정 사망을 고르지 않는다', () => {
  // dawn_dongha2 꼴(그릇 둘이 없을 때): 막는다 45% / 부른다 40% / 도망친다 55% (실패 = 죽음) · 손으로 받는다(손가락) · 무릎을 꿇는다(그릇)
  const dawn = [
    meta({ label: '막는다', warn: '못 막으면 죽는다', check: true, chance: 45 }),
    meta({ label: '부른다', warn: '못 들으면 끝이다', check: true, chance: 40 }),
    meta({ label: '도망친다', warn: '넘어지면 끝이다', check: true, chance: 55 }),
    meta({ label: '손으로 받는다', warn: '손가락을 잃는다' }),
    meta({ label: '무릎을 꿇는다', warn: '그릇을 내놓는다' })];
  for (const pol of B.CAREFUL) {
    const sc = dawn.map((c) => B.scoreChoice(c, B.POLICIES[pol], 'dawn_dongha2', { kind: 'trial', unwell: false }));
    assert.ok(Math.max(sc[3], sc[4]) > Math.max(sc[0], sc[1], sc[2]), pol + ' ' + sc.map((x) => x.toFixed(2)).join(','));
  }
  // 거의 확실히 사는 주사위(95%)는 손가락보다 낫다(죽음 글이어도 실패 % 만큼만)
  const safeRoll = meta({ label: '도망친다', warn: '넘어지면 끝이다', check: true, chance: 95 });
  assert.ok(B.scoreChoice(safeRoll, B.POLICIES.balanced, 'x') > B.scoreChoice(dawn[3], B.POLICIES.balanced, 'x'));
  // d8_patrol_return 꼴: 경고 없는 손해 vs 판정 없는 경고(확정 사망) — 모험이 반반으로 고르지 않는다
  const give = meta({ label: '열쇠를 내준다' }), refuse = meta({ label: '내주지 않는다', warn: '넷이다. 파이프가 턱에 있다', killYou: true });
  assert.ok(B.scoreChoice(give, B.POLICIES.risky, 'd8_patrol_return') > B.scoreChoice(refuse, B.POLICIES.risky, 'd8_patrol_return'));
  // 모험은 여전히 판정 있는 위험을 좋아한다: 60% 판정(실패 = 죽음)은 판정 없는 경고보다 높다, 45% 는 아니다
  const roll = (ch) => B.scoreChoice(meta({ warn: '못 달래면 죽는다', check: true, chance: ch }), B.POLICIES.risky, 'd2_night_shutter');
  const flat = B.scoreChoice(meta({ warn: '아무도 못 잔다' }), B.POLICIES.risky, 'd2_night_shutter');
  assert.ok(roll(60) > flat && roll(45) < flat, [roll(60), roll(45), flat].join(','));
});
test('봇 정책(10-23): 9번째 steward(몫+·손−·이름+)는 조심형이고, 정체 후보 inspector 에 닿는다', () => {
  const p = B.POLICIES.steward;
  assert.deepStrictEqual([p.share, p.hand, p.name], [1, -1, 1]);
  assert.ok(B.CAREFUL.includes('steward'));
  const db = T.loadDir(require('path').join(__dirname, '..', 'data'));
  const ids = {};
  for (let seed = 1; seed <= 12; seed++) { const { s } = B.play(db, seed, 'steward'); const id = s.ended && s.ended.identity; ids[id] = (ids[id] || 0) + 1; }
  assert.ok((ids.inspector || 0) >= 4, JSON.stringify(ids));
});
test('봇 치료(10-23): 저녁에 위독한 주민을 치료한다 — 중립은 약 1을 남기고, 헌신은 다 쓰고, 이기적은 안 한다', () => {
  const run = (pol, meds) => {
    const { db, s } = setup((t) => { const ev = t.phases.find((p) => p.id === 'evening'); if (!ev.actions.includes('treat')) ev.actions.push('treat'); });   // 실제 표처럼 저녁에 치료
    toPhase(s, db, 0, 'evening');
    s.pending = null;
    s.people.gicheol.n.injury = 3; s.world.meds = meds;
    B.treatResidents(s, db, B.POLICIES[pol]);
    return [!!s.flags.treated_gicheol, s.world.meds];
  };
  assert.deepStrictEqual(run('balanced', 2), [true, 1]);
  assert.deepStrictEqual(run('balanced', 1), [false, 1], '중립은 자기 몫 하나를 남긴다');
  assert.deepStrictEqual(run('devoted', 1), [true, 0]);
  assert.deepStrictEqual(run('selfish', 3), [false, 3]);
});

// ── 4. 강제 사망: 그 순간 당신이 죽지 않는 열린 선택지가 0개 — 엔진이 사인 기록(ended.cause)에 남기고, 실질 경고로 세지 않는다 ──
test('사인 기록: 선택지 하나뿐인 죽음은 강제 — warned 거짓, 갈림길은 그 전 자유 경고 선택', () => {
  const t = rawTables();
  t.events.push(ev('x_fork', 'trial', 'day==0 & phase==evening', [pass('간다', { effects: { flag: { went: true } } }, { warn: '돌아오기 어렵다' }), pass('안 간다', {})]));
  t.events.push(ev('x_end', 'trial', 'day==0 & phase==night & flag:went', [pass('눈을 감는다', { effects: { kill: { who: 'you' } } }, { warn: '끝이다' })]));
  const db = T.load(t);
  const s = E.newGame(db, 3);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'x_fork');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.deepStrictEqual(s.lastFree, { event: 'x_fork', choice: '간다', day: 0 });
  toPhase(s, db, 0, 'night');
  assert.strictEqual(s.pending && s.pending.id, 'x_end');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  const c = s.ended.cause;
  assert.deepStrictEqual({ ev: c.event, warned: c.warned, forced: c.forced, free: c.free && c.free.event }, { ev: 'x_end', warned: false, forced: true, free: 'x_fork' }, '경고 글("끝이다")이 있어도 고를 것이 없었으니 경고 있음이 아니다');
  assert.deepStrictEqual(s.lastFree, { event: 'x_fork', choice: '간다', day: 0 }, '하나뿐인 선택은 자유 선택이 아니다');
  const r = S.measure(db, s, { trips: 0 });
  assert.deepStrictEqual([r.forced, r.warned, r.warnText, r.freeBefore], [true, false, true, 'x_fork/간다']);
  const a = S.aggregate(db, [r]);
  assert.deepStrictEqual([a.forced, a.forcedRate, a.forcedTraced, a.warnedRate, a.warnTextRate, a.unwarned], [1, 100, 1, 0, 100, 1]);
  assert.deepStrictEqual(Object.keys(a.byForced), ['x_end ← x_fork/간다']);
});
test('사인 기록: 다른 길이 모두 잠긴 주사위(약 0)는 강제, 약이 있으면 자유 선택 — 저장 왕복에도 lastFree 가 남는다', () => {
  const mk = (meds) => {
    const t = rawTables();
    t.events.push(ev('x_fever', 'trial', 'day==0 & phase==night', [
      { label: '약을 쓴다', cost: { meds: 1 }, out: { text: '' } },
      { label: '버틴다', warn: '아침이 안 올 수 있다', check: { skill: 'str', base: 0 }, ok: { text: '' }, fail: { text: '', effects: { kill: { who: 'you' } } } }]));
    const db = T.load(t);
    const s = E.newGame(db, 5);
    E.dispatch(s, { type: 'choose', i: 1 }, db);
    toPhase(s, db, 0, 'night');
    s.world.meds = meds;
    assert.strictEqual(s.pending && s.pending.id, 'x_fever');
    E.dispatch(s, { type: 'choose', i: 1 }, db);
    s._db = db;
    return s;
  };
  const a = mk(0);
  assert.strictEqual(S.measure(a._db, a, { trips: 0 }).deadlyPick, false, '강제 죽음은 봇 버릇이 아니다');
  assert.strictEqual(a.people.you.status, 'dead');
  assert.deepStrictEqual([a.ended.cause.forced, a.ended.cause.warned], [true, false]);
  const b = mk(1);
  assert.deepStrictEqual([b.ended.cause.forced, b.ended.cause.warned, b.ended.cause.free.event], [false, true, 'x_fever'], '약이 있었는데 버텼다 = 경고가 보인 결정');
  const rb = S.measure(b._db, b, { trips: 0 });
  assert.strictEqual(rb.deadlyPick, true, '대안(약)이 있는데 죽음 글("아침이 안 올") 선택으로 죽음 = 봇 버릇 점검 줄에 잡힌다');
  assert.strictEqual(S.aggregate(b._db, [rb]).deadlyPick, 1);
  assert.deepStrictEqual(b.lastResult.open, [0, 1], '엔진이 고를 때 열려 있던 선택지 번호를 남긴다');
  // 다른 길이 금기뿐이면(남의 담요) 죽음 주사위를 고른 건 버릇이 아니다
  const t3 = rawTables();
  t3.events.push(ev('x_cold', 'trial', 'day==0 & phase==night', [
    { label: '담요를 뺏는다', warn: '그 사람이 떤다', taboo: true, out: { text: '' } },
    { label: '버틴다', warn: '아침이 안 올 수 있다', check: { skill: 'str', base: 0 }, ok: { text: '' }, fail: { text: '', effects: { kill: { who: 'you' } } } }]));
  const db3 = T.load(t3); const s3 = E.newGame(db3, 5);
  E.dispatch(s3, { type: 'choose', i: 1 }, db3); toPhase(s3, db3, 0, 'night');
  assert.strictEqual(s3.pending && s3.pending.id, 'x_cold');
  E.dispatch(s3, { type: 'choose', i: 1 }, db3);
  assert.deepStrictEqual([s3.people.you.status, s3.ended.cause.forced, S.measure(db3, s3, { trips: 0 }).deadlyPick], ['dead', false, false]);
  const t2 = rawTables(); const db2 = T.load(t2); const s2 = E.newGame(db2, 1);
  s2.lastFree = { event: 'x', choice: 'y', day: 1 };
  assert.deepStrictEqual(E.normalize(JSON.parse(JSON.stringify(s2)), db2).lastFree, { event: 'x', choice: 'y', day: 1 });
  const old = JSON.parse(JSON.stringify(s2)); delete old.lastFree;
  assert.strictEqual(E.normalize(old, db2).lastFree, null, '옛 저장은 빈 값');
});

// ── 5. 시드 블록 판정: 모든 블록 통과·±5%p 밖 = ✓, 블록마다 다르거나 ±5%p 안 = △, 모두 미달 = ✗ ──
test('합격선: 블록 판정 합치기와 ±5%p 경계', () => {
  const g = (ok, near) => ({ rows: [['항목', '≥ 50%', 'x', ok, near]] });
  assert.strictEqual(S.combine([g(true, false), g(true, false)])[0].mark, '✓');
  assert.strictEqual(S.combine([g(true, false), g(true, true)])[0].mark, '△', '한 블록이라도 경계면 확정 안 함');
  assert.strictEqual(S.combine([g(true, false), g(false, false)])[0].mark, '△', '블록마다 다르면 확정 안 함');
  assert.strictEqual(S.combine([g(false, false), g(false, true)])[0].mark, '✗');
  const agg = (death) => ({ balanced: { n: 100, deaths: death, deathRate: death, warnedRate: 100, allDead: 0, nights: 9, malice: 3, hymn: 2, discovery: 60, explicit: 9, decisions: 9, blank: 0, identity: {}, forced: 0, forcedTraced: 0, starveDeaths: 0, unwarned: 0, train: 0 } });
  const row = (death) => S.gate(agg(death), 7, ['balanced']).rows.find((r) => r[0].startsWith('당신 사망'));
  assert.deepStrictEqual([row(53)[3], row(53)[4]], [true, true], '53% = 통과지만 경계');
  assert.deepStrictEqual([row(56)[3], row(56)[4]], [true, false]);
  assert.deepStrictEqual([row(30)[3], row(30)[4]], [false, false]);
});
