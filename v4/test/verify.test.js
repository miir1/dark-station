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

// ── 4. 강제 사망: 그 순간 당신이 죽지 않는 열린 선택지가 0개 ──
test('집계: 강제 사망과 그 전 마지막 자유 경고 선택을 남긴다', () => {
  const t = rawTables();
  t.events.push(ev('x_fork', 'trial', 'day==0 & phase==evening', [pass('간다', { effects: { flag: { went: true } } }, { warn: '돌아오기 어렵다' }), pass('안 간다', {})]));
  t.events.push(ev('x_end', 'trial', 'day==0 & phase==night & flag:went', [pass('눈을 감는다', { effects: { kill: { who: 'you' } } }, { warn: '끝이다' })]));
  const db = T.load(t);
  const s = E.newGame(db, 3);
  const trace = { choices: 0, trips: 0, known: {}, lastFree: null, death: null };
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  toPhase(s, db, 0, 'evening');
  assert.strictEqual(s.pending && s.pending.id, 'x_fork');
  B.noteChoice(s, trace, 'x_fork', E.choiceMeta(s, db), 0, true);
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  toPhase(s, db, 0, 'night');
  assert.strictEqual(s.pending && s.pending.id, 'x_end');
  const m = E.choiceMeta(s, db);
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  B.noteChoice(s, trace, 'x_end', m, 0, true);
  assert.deepStrictEqual({ ev: trace.death.event, forced: trace.death.forced, free: trace.death.lastFree.event }, { ev: 'x_end', forced: true, free: 'x_fork' });
  const r = S.measure(db, s, trace);
  assert.strictEqual(r.forced, true);
  assert.strictEqual(r.freeBefore, 'x_fork/간다');
  const a = S.aggregate(db, [r]);
  assert.strictEqual(a.forced, 1); assert.strictEqual(a.forcedRate, 100); assert.strictEqual(a.forcedTraced, 1);
  assert.deepStrictEqual(Object.keys(a.byForced), ['x_end ← x_fork/간다']);
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
