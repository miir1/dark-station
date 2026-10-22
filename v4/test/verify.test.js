// node --test v4/test — 10-22 검증 지적 5건을 고친 것 (위독 유예·밤 악의의 미성년·봇 점수·강제 사망·시드 블록 판정)
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

// ── 2. 밤 악의(malice)의 무작위·조건식 역할에 미성년은 들지 않는다 ──
test('밤 악의: any 행위자·randomSleeper·mostInjured·조건식 대상에 미성년(서하 17)이 없다 — 이름 지목·hymn 행은 그대로', () => {
  const rows = (t) => {
    t.nightEvents = t.nightEvents.filter((n) => n.role === 'pair' && n.kind === 'hymn');   // p1_soonrye_water(이름 지목 hymn)만 남긴다
    t.nightEvents.push(
      { id: 'm_any', role: 'kill', actor: 'any', target: 'randomSleeper', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 },
      { id: 'm_hurt', role: 'pair', actor: 'mari', target: 'mostInjured', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 },
      { id: 'm_cond', role: 'steal', actor: 'needs.fear>=0', target: 'needs.fear>=0', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'target', n: 1 } }, oncePerRun: 0 },
      { id: 'm_named', role: 'pair', actor: 'seoha', target: '-', cond: 'day>=0', weight: 10, kind: 'malice', effects: { fear: { who: 'actor', n: 1 } }, oncePerRun: 0 },
      { id: 'h_any', role: 'share', actor: 'any', target: 'randomSleeper', cond: 'day>=0', weight: 10, kind: 'hymn', effects: { fear: { who: 'target', n: -1 } }, oncePerRun: 0 });
  };
  const roles = { malice: [], named: 0, hymnSeoha: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const { db, s } = setup(rows, seed);
    s.people.seoha.n.injury = 2; s.people.gicheol.n.injury = 1;   // 서하가 가장 많이 다쳤다
    toPhase(s, db, 2, 'trace');
    for (const e of s.nightLog) {
      if (e.id === 'm_named') roles.named++;
      else if (e.kind === 'malice') roles.malice.push(e.actor, e.target);
      else if (e.id === 'h_any' && (e.actor === 'seoha' || e.target === 'seoha')) roles.hymnSeoha++;
    }
  }
  assert.ok(roles.malice.length > 20, '악의 사건이 일어났다 ' + roles.malice.length);
  assert.ok(!roles.malice.includes('seoha'), '악의의 무작위·조건 역할에 서하가 없다');
  assert.ok(roles.named > 0, '이름으로 지목한 행은 그대로 일어난다');
  assert.ok(roles.hymnSeoha > 0, 'hymn 행은 거르지 않는다');
  assert.strictEqual(E.isMinor({ people: { a: { age: 17 } } }, 'a'), true);
  assert.strictEqual(E.ADULT_AGE, 19);
});

test('밤 사건의 부상(+)·영구 손상은 어느 행이든 미성년에게 닿지 않는다(bondOfActor·이름 지목 포함), 회복은 닿는다', () => {
  const rows = (t) => {
    t.nightEvents = [
      { id: 'n_bond', role: 'ascend', actor: 'soonrye', target: '-', cond: 'day==0', weight: 10, kind: 'neutral', effects: { permanent: { who: 'bondOfActor', kind: 'finger' }, fear: { who: 'actor', n: 1 } }, oncePerRun: 1 },
      { id: 'n_named', role: 'pair', actor: 'mari', target: 'seoha', cond: 'day==0', weight: 10, kind: 'hymn', effects: { injure: [{ who: 'target', n: 1 }, { who: 'actor', n: 1 }] }, oncePerRun: 1 },
      { id: 'n_heal', role: 'pair', actor: 'gicheol', target: '-', cond: 'day==1', weight: 10, kind: 'hymn', effects: { injure: { who: 'seoha', n: -1 } }, oncePerRun: 1 }];
    t.numbers = t.numbers.filter((r) => r.id !== 'max_per_night').concat([{ id: 'max_per_night', owner: 'world', min: 0, max: 9, start: 5, perDay: 0, visible: 'never' }]);
  };
  const { db, s } = setup(rows, 2);
  toPhase(s, db, 1, 'trace');
  const ids = s.nightLog.map((e) => e.id);
  assert.ok(ids.includes('n_bond') && ids.includes('n_named'), ids.join(','));
  assert.deepStrictEqual(Object.keys(s.people.seoha.permanent), [], '순례의 bond 서하는 손가락을 잃지 않는다');
  assert.strictEqual(s.people.seoha.n.injury || 0, 0, '이름으로 지목돼도 밤 부상은 서하에게 닿지 않는다');
  assert.strictEqual(s.people.mari.n.injury, 1, '같은 행의 어른 부상은 그대로');
  assert.strictEqual(s.people.soonrye.n.fear, 5, '다른 수치는 그대로');
  s.people.seoha.n.injury = 2;
  toPhase(s, db, 2, 'trace');
  assert.strictEqual(s.people.seoha.n.injury, 1, '회복(음수)은 닿는다');
  const N = require('../engine/night.js');
  assert.deepStrictEqual(N.shieldMinors(s, db, { food: -1 }, { actor: 'mari' }), { food: -1 }, '부상·손상이 없으면 그대로');
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
  assert.strictEqual(B.deadlyText(meta({ warn: '아침이 안 올 수 있다', check: true, chance: 40 })), false, '판정 있는 선택은 % 가 따로 보인다');
  assert.strictEqual(B.deadlyText(meta({ warn: '차장이 당신을 센다' })), true);
  assert.ok(B.CAREFUL.includes('balanced') && !B.CAREFUL.includes('risky') && !B.CAREFUL.includes('devoted'));
});
test('봇 점수: 모험은 판정 없는 경고에 가점이 없고, 아플 때 약(비용이 약뿐·원정·거래 아님)은 비용 감점이 없다', () => {
  const risky = B.POLICIES.risky;
  assert.strictEqual(B.scoreChoice(meta({ warn: '열차는 기관사 없이 간다' }), risky, 'd10_train'), 0);
  const med = meta({ warn: '약이 준다', cost: { meds: 1 } });
  assert.strictEqual(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: true }), 0);
  assert.strictEqual(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: false }), -0.5, '멀쩡하면 비용 감점');
  assert.strictEqual(B.isRecovery(med, 'trip_a1_pharmacy', { kind: 'trip', unwell: true }), false, '원정에서 약을 내주는 건 회복이 아니다');
  assert.strictEqual(B.isRecovery(med, 'trade_shutter', { kind: 'trial', unwell: true }), false, '거래는 회복이 아니다');
  const hold = meta({ warn: '사흘 뒤 끝이다' });
  assert.ok(B.scoreChoice(med, risky, 'flood_sick', { kind: 'trial', unwell: true }) > B.scoreChoice(hold, risky, 'flood_sick', { kind: 'trial', unwell: true }), '모험: 약이 있으면 버티지 않는다');
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
    return s;
  };
  const a = mk(0);
  assert.strictEqual(a.people.you.status, 'dead');
  assert.deepStrictEqual([a.ended.cause.forced, a.ended.cause.warned], [true, false]);
  const b = mk(1);
  assert.deepStrictEqual([b.ended.cause.forced, b.ended.cause.warned, b.ended.cause.free.event], [false, true, 'x_fever'], '약이 있었는데 버텼다 = 경고가 보인 결정');
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
