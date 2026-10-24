// node --test v4/test — 10-24 P0-E1: 만남 깃발(metFlag)·역 밖에서 시작(startAway)·들은 줄 기록(heard)·안 만난 사람 빼기
// plan.md P0-E1 끝 증거 다섯 가지 + 말 걸기·명부·실데이터 봇 한 판.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { rawTables, clone, T, E } = require('./helpers.js');
const SAVE = require('../engine/save.js');
const LEDGER = require('../engine/ledger.js');
const B = require('../sim/bots.js');

const ev = (id, kind, when, choices, extra) => Object.assign({ id, kind, when, grade: 'normal', explicit: 0, text: '시험용 사건.', choices }, extra || {});
const pass = (label, out) => ({ label, out: Object.assign({ text: '' }, out || {}) });
const person = (id, name, extra) => Object.assign({ id, name, age: 30, skills: { obs: 1, str: 1, tech: 1, talk: 1 }, needs: { hunger: 2, thirst: 2, fear: 2, bond: '-' } }, extra || {});

// 픽스처 + 셔터 너머 두 사람(은지·동하, 역 밖에서 시작, 같은 깃발로 온다) + 만나기 전 서하(역 안, 안 만남)
function meetTables(edit) {
  const t = rawTables();
  t.people.push(person('eunji', '최은지', { metFlag: 'met_eunji', startAway: 1, needs: { hunger: 9, thirst: 9, fear: 9, bond: 'dongha' } }));
  t.people.push(person('dongha', '한동하', { metFlag: 'met_eunji', startAway: 1, needs: { hunger: 9, thirst: 9, fear: 9, bond: 'eunji' } }));
  Object.assign(t.people.find((p) => p.id === 'seoha'), { metFlag: 'met_seoha', startAway: 0 });
  t.objects.push({ id: 'bowl_eunji', name: '은지 그릇', states: ['full', 'empty'] }, { id: 'bowl_dongha', name: '동하 그릇', states: ['full', 'empty'] });
  t.objects.push({ id: 'shutter', name: '셔터', states: ['closed'] }, { id: 'office_door', name: '역무실 문', states: ['closed'] });
  t.events.push(ev('t_shutter', 'fixed', 'day==1 & phase==day & inspect:shutter & !flag:met_eunji', [pass('연다', { effects: { flag: { met_eunji: true } } }), pass('둔다')]));
  t.events.push(ev('t_office', 'fixed', 'day>=1 & inspect:office_door & !flag:met_seoha', [pass('연다', { effects: { flag: { met_seoha: true } } })]));
  // 이름으로 지목된 밤 사건(늘 조건이 맞고 가중치 최대) — away 면 절대 일어나지 않아야 한다
  t.nightEvents.push({ id: 'n_eunji', role: 'pair', actor: 'eunji', target: '-', cond: 'day>=0', weight: 10, kind: 'neutral' });
  t.nightEvents.push({ id: 'n_dongha', role: 'pair', actor: 'dongha', target: '-', cond: 'day>=0', weight: 10, kind: 'neutral' });
  t.nightEvents.push({ id: 'n_to_eunji', role: 'pair', actor: 'soonrye', target: 'eunji', cond: 'day>=0', weight: 10, kind: 'neutral' });
  if (edit) edit(t);
  return T.load(t);
}
// pick 번 선택지가 없거나 잠겼으면 첫 번째로
const toPhase = (s, db, day, phase, pick) => { let g = 0; while (!(s.day === day && s.phase === phase) && !s.ended && g++ < 80) { if (s.pending) { if (!E.dispatch(s, { type: 'choose', i: pick != null ? pick : 0 }, db).ok) E.dispatch(s, { type: 'choose', i: 0 }, db); } else E.dispatch(s, { type: 'next' }, db); } assert.deepStrictEqual([s.day, s.phase], [day, phase], 'toPhase 도착'); };
const viewOf = (s, db, id) => E.view(s, db).people.find((p) => p.id === id);
const nightActors = (s, day) => s.nightLog.filter((e) => e.day === day).flatMap((e) => [e.actor, e.target]).filter(Boolean);

test('E1-1 은지·동하: D1 셔터 전에는 away · 배식 0 · 밤 행위자·대상이 아니다 → 셔터를 열면 같이 역에 온다', () => {
  const db = meetTables();
  for (let seed = 1; seed <= 30; seed++) {
    const s = E.newGame(db, seed);
    assert.strictEqual(s.people.eunji.status, 'away'); assert.strictEqual(s.people.dongha.status, 'away');
    assert.deepStrictEqual([viewOf(s, db, 'eunji').status, viewOf(s, db, 'eunji').met], ['away', 0]);
    assert.strictEqual(viewOf(s, db, 'soonrye').met, 1, 'metFlag 없는 사람은 처음부터 안다');
    toPhase(s, db, 1, 'ration', 1);
    for (const id of ['eunji', 'dongha']) assert.ok(!nightActors(s, 0).includes(id), `D0 밤 ${id} 행위자/대상 아님 (시드 ${seed}): ${JSON.stringify(s.nightLog)}`);
    // 배식: 그릇을 켜도 away 는 받지 않는다 — 식량·물·굶주림·그릇 그대로
    const food = s.world.food, water = s.world.water, h = s.people.eunji.n.hunger, bowl = clone(s.traces.bowl_eunji);
    assert.ok(E.dispatch(s, { type: 'ration', bowls: { you: 1, eunji: 1, dongha: 1 } }, db).ok);
    assert.strictEqual(s.world.food, food - 1, '당신 그릇 하나만');
    assert.strictEqual(s.world.water, water - 1);
    assert.strictEqual(s.people.eunji.n.hunger, h);
    assert.deepStrictEqual(s.traces.bowl_eunji, bowl, '그릇 흔적도 그대로');
  }
  // 셔터를 열면(만남 깃발) 둘 다 역에 온다 · 온 날이 남는다(p.day 는 명부 날짜 칸이라 건드리지 않는다)
  const s = E.newGame(db, 3);
  toPhase(s, db, 1, 'day', 1);
  if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.ok(E.dispatch(s, { type: 'inspect', object: 'shutter' }, db).ok);
  assert.strictEqual(s.pending && s.pending.id, 't_shutter');
  assert.ok(E.dispatch(s, { type: 'choose', i: 0 }, db).ok);
  for (const id of ['eunji', 'dongha']) {
    assert.deepStrictEqual([s.people[id].status, s.people[id].arrived, s.people[id].day], ['home', 1, null], id);
    assert.strictEqual(viewOf(s, db, id).met, 1);
  }
  // 온 뒤에는 밤 행위자가 될 수 있다(위에서 빠진 이유가 away 였다는 대조)
  let seen = false;
  for (let seed = 1; seed <= 20 && !seen; seed++) {
    const x = E.newGame(db, seed); toPhase(x, db, 1, 'day', 1); if (x.pending) E.dispatch(x, { type: 'choose', i: 0 }, db);
    E.dispatch(x, { type: 'inspect', object: 'shutter' }, db); E.dispatch(x, { type: 'choose', i: 0 }, db);
    toPhase(x, db, 2, 'day', 1);
    seen = nightActors(x, 1).some((id) => id === 'eunji' || id === 'dongha');
  }
  assert.ok(seen, '온 뒤 밤에는 은지·동하도 행위자');
});

test('E1-2 서하: 만나기 전에는 home 이지만 배식·무작위 대상·mostInjured·동행에서 빠진다 → 만나면 들어간다', () => {
  const db = meetTables((t) => {
    t.events.push(ev('t_pick', 'fixed', 'day==0 & phase==evening', [pass('본다')], { target: 'randomSleeper' }));
    t.events.push(ev('t_hurt', 'fixed', 'day==0 & phase==night', [pass('본다')], { target: 'mostInjured' }));
    t.numbers.push({ id: 'trip_party', owner: 'world', min: 0, max: 3, start: 1, visible: 'never' });
    t.phases.find((p) => p.id === 'day').actions.push('trip');
    t.events.push(ev('t_trip', 'trip', 'day>=1 & region==A', [pass('지나간다')]));
  });
  const picked = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const s = E.newGame(db, seed);
    assert.deepStrictEqual([s.people.seoha.status, viewOf(s, db, 'seoha').met], ['home', 0]);
    toPhase(s, db, 0, 'evening', 1);
    assert.strictEqual(s.pending && s.pending.id, 't_pick');
    picked.add(s.pending.target);
    E.dispatch(s, { type: 'choose', i: 0 }, db);
    s.people.seoha.n.injury = 2;                         // 가장 많이 다친 사람이 서하뿐 → 안 만났으니 대상 없음 = 사건이 안 걸린다
    E.dispatch(s, { type: 'next' }, db);
    assert.strictEqual(s.phase, 'night');
    assert.notStrictEqual(s.pending && s.pending.id, 't_hurt', 'mostInjured 도 안 만난 사람은 고르지 않는다');
  }
  for (const id of ['seoha', 'eunji', 'dongha']) assert.ok(!picked.has(id), `무작위 대상에 ${id} 없음: ${Array.from(picked)}`);
  assert.ok(picked.size >= 2, Array.from(picked).join(','));
  // 배식·동행
  const s = E.newGame(db, 5);
  toPhase(s, db, 1, 'ration', 1);
  const food = s.world.food, bowl = clone(s.traces.bowl_seoha), h = s.people.seoha.n.hunger;
  assert.ok(E.dispatch(s, { type: 'ration', bowls: { seoha: 1, soonrye: 1 } }, db).ok);
  assert.strictEqual(s.world.food, food - 1, '순례 그릇만');
  assert.deepStrictEqual([s.people.seoha.n.hunger, s.traces.bowl_seoha], [h, bowl]);
  toPhase(s, db, 1, 'day', 1);
  if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.strictEqual(E.dispatch(s, { type: 'trip', region: 'A', floor: 1, with: ['seoha'] }, db).ok, false, '안 만난 사람은 동행으로 못 고른다');
  // 만나면(역무실 문) 무작위 대상에 들어간다
  assert.ok(E.dispatch(s, { type: 'inspect', object: 'office_door' }, db).ok);
  assert.strictEqual(s.pending && s.pending.id, 't_office');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.deepStrictEqual([s.people.seoha.status, viewOf(s, db, 'seoha').met, s.people.seoha.arrived], ['home', 1, undefined], 'home 에서 시작한 사람은 온 날이 없다');
  assert.ok(E.dispatch(s, { type: 'trip', region: 'A', floor: 1, with: ['seoha'] }, db).ok, '만난 뒤에는 동행');
  let hit = false;
  const db2 = meetTables((t) => t.events.push(ev('t_pick', 'fixed', 'day==0 & phase==evening', [pass('본다')], { target: 'randomSleeper' })));
  for (let seed = 1; seed <= 40 && !hit; seed++) {
    const x = E.newGame(db2, seed); x.flags.met_seoha = true;
    toPhase(x, db2, 0, 'evening', 1);
    hit = x.pending && x.pending.target === 'seoha';
  }
  assert.ok(hit, '만난 서하는 무작위 대상이 될 수 있다');
});

test('E1-3 alive: 아직 안 온 사람(away)·안 만난 사람도 살아 있음 — alive:x 사건이 만나기 전에도 걸린다 (사건·밤 시계)', () => {
  const db = meetTables((t) => {
    t.events.push(ev('t_alive', 'fixed', 'day==0 & phase==evening & alive:seoha & alive:eunji & alive:dongha & !flag:met_seoha & !flag:met_eunji', [pass('본다')]));
    t.nightEvents.push({ id: 'n_clock_alive', role: 'clock', cond: 'alive:eunji & day==0', weight: 1, kind: 'neutral' });
  });
  const s = E.newGame(db, 2);
  toPhase(s, db, 0, 'evening', 1);
  assert.strictEqual(s.pending && s.pending.id, 't_alive');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  toPhase(s, db, 1, 'day', 1);
  assert.ok(s.nightLog.some((e) => e.id === 'n_clock_alive' && e.day === 0), '밤 조건의 alive:eunji 도 참');
  assert.strictEqual(s.people.eunji.status, 'away');
});

test('E1-4 away 는 저장을 불러온 뒤에도 유지된다 · 온 뒤의 home·온 날도 · 옛 저장(heard 없음)은 빈 기록', () => {
  const db = meetTables();
  const storage = SAVE.memoryStorage(); const store = SAVE.createStore({ storage, db });
  const s = E.newGame(db, 7);
  toPhase(s, db, 1, 'ration', 1);
  E.dispatch(s, { type: 'heard', key: 'cab_window#1' }, db);
  store.save(s);
  const b = store.load().state;
  assert.deepStrictEqual([b.people.eunji.status, b.people.dongha.status], ['away', 'away']);
  assert.strictEqual(JSON.stringify(b), JSON.stringify(s), '왕복이 같다');
  assert.deepStrictEqual(b.heard, { 'cab_window#1': 1 });
  // 깃발이 선 뒤 away 로 남은 저장(손으로 고친 것)은 불러올 때 맞춘다
  const odd = clone(s); odd.flags.met_eunji = true;
  const n = E.normalize(odd, db);
  assert.deepStrictEqual([n.people.eunji.status, n.people.dongha.status], ['home', 'home']);
  // 온 뒤 저장 왕복
  const back = E.normalize(clone(n), db);
  assert.deepStrictEqual([back.people.eunji.status, back.people.eunji.arrived], ['home', 1]);
  // 옛 저장: heard 없음 → {} · 깨진 heard(배열) → {} · SAVE_V 그대로
  const old = clone(s); delete old.heard;
  assert.deepStrictEqual(E.normalize(old, db).heard, {});
  const broken = clone(s); broken.heard = ['x'];
  assert.deepStrictEqual(E.normalize(broken, db).heard, {});
  assert.strictEqual(E.SAVE_V, 1);
});

test('E1-5 heard: {type:heard, key:"<줄id>#<행번호>"} → heard[key] = 그날 · 어느 단계에서나 · 없는 줄·행은 거절', () => {
  const db = meetTables();
  const s = E.newGame(db, 1);
  assert.deepStrictEqual(s.heard, {});
  const dec = s.stats.decisions;
  assert.ok(E.dispatch(s, { type: 'heard', key: 'cab_window#1' }, db).ok);
  assert.ok(E.dispatch(s, { type: 'heard', key: 'saw_shadow#0' }, db).ok);
  assert.deepStrictEqual(s.heard, { 'cab_window#1': 0, 'saw_shadow#0': 0 });
  assert.strictEqual(s.stats.decisions, dec, '결정 수에 안 든다');
  for (const key of ['cab_window#2', 'nope#0', 'cab_window', 'cab_window#-1', '', 7, null]) assert.strictEqual(E.dispatch(s, { type: 'heard', key }, db).ok, false, String(key));
  // 행번호 = 그 id 의 행들 가운데 몇 번째(파일 순서)
  assert.strictEqual(E.heardKey(db, 'cab_window', db.lines.cab_window[1]), 'cab_window#1');
  assert.strictEqual(E.heardKey(db, 'cab_window', 0), 'cab_window#0');
  assert.strictEqual(E.heardKey(db, 'nope', 0), null);
  // 밤 단계(actions 비어 있음)에서도 되고, 다시 들으면 날짜가 새로 적힌다
  toPhase(s, db, 1, 'night', 1);
  assert.strictEqual(s.phase, 'night');
  assert.ok(E.dispatch(s, { type: 'heard', key: 'cab_window#1' }, db).ok);
  assert.strictEqual(s.heard['cab_window#1'], 1);
  assert.strictEqual(s.heard['saw_shadow#0'], 0);
});

test('E1 말 걸기: 역 밖(away)에서 마주친 사람에게도 말을 건다(터널의 기철) — 만남 깃발이 서면 역에 온다', () => {
  const db = meetTables((t) => {
    Object.assign(t.people.find((p) => p.id === 'gicheol'), { metFlag: 'met_gicheol', startAway: 1 });
    t.phases.find((p) => p.id === 'day').actions.push('talk');
    t.events.push(ev('t_gicheol', 'fixed', 'day==0 & talk:gicheol', [pass('따라간다', { effects: { flag: { met_gicheol: true } } })]));
  });
  const s = E.newGame(db, 4);
  E.dispatch(s, { type: 'choose', i: 1 }, db);
  assert.strictEqual(s.people.gicheol.status, 'away');
  assert.ok(E.dispatch(s, { type: 'talk', who: 'gicheol' }, db).ok);
  assert.strictEqual(s.pending && s.pending.id, 't_gicheol');
  E.dispatch(s, { type: 'choose', i: 0 }, db);
  assert.deepStrictEqual([s.people.gicheol.status, s.people.gicheol.arrived], ['home', 0]);
  assert.strictEqual(E.dispatch(s, { type: 'talk', who: 'eunchae' }, db).ok, false, '바깥 사람(outside)은 그대로 못 건다');
});

test('E1 명부: 아직 안 온 사람·안 만난 사람은 명부에 없다(모르는 이름은 못 적는다)', () => {
  const db = meetTables();
  const s = E.newGame(db, 6);
  const ids = () => LEDGER.rows(s, db).map((r) => r.id);
  assert.ok(!ids().includes('eunji') && !ids().includes('dongha') && !ids().includes('seoha'), ids().join(','));
  assert.ok(ids().includes('soonrye'));
  s.flags.met_seoha = true;
  assert.ok(ids().includes('seoha'));
  assert.ok(!LEDGER.format(s, db).some((l) => /away/.test(l)));
});

test('E1 실데이터 + 계획 값(plan P0-D1 people 칸): 봇이 끝까지 돈다 · 은지·동하는 D2 아침까지 온다 · 배식은 만난 사람만', () => {
  const t = {};
  for (const [k, f] of Object.entries(T.FILES)) { const fs = require('fs'); const dir = path.join(__dirname, '..', 'data'); let p = path.join(dir, f); if (!fs.existsSync(p) && T.ALT_FILES[k]) p = path.join(dir, T.ALT_FILES[k]); t[k] = JSON.parse(fs.readFileSync(p, 'utf8')); }
  const PLAN = { soonrye: ['met_soonrye', 0], mari: ['met_mari', 0], seoha: ['met_seoha', 0], gicheol: ['met_gicheol', 1], eunji: ['met_eunji', 1], dongha: ['met_eunji', 1], eunchae: ['', 0], dohyeon: ['', 0], you: ['', 0] };
  for (const p of t.people) if (PLAN[p.id]) { p.metFlag = PLAN[p.id][0]; p.startAway = PLAN[p.id][1]; }
  const db = T.load(t);
  for (const pol of ['balanced', 'lazy', 'risky']) for (let seed = 1; seed <= 12; seed++) {
    const { s } = B.play(db, seed, pol);
    assert.ok(s.ended, `${pol} ${seed} 끝남`);
    if (s.day >= 3) for (const id of ['eunji', 'dongha', 'gicheol']) assert.notStrictEqual(s.people[id].status, 'away', `${pol} ${seed} ${id} D${s.day}`);
    for (const e of s.nightLog) for (const id of [e.actor, e.target]) if (id === 'eunji' || id === 'dongha') assert.ok(s.people[id].arrived != null && s.people[id].arrived <= e.day, `${pol} ${seed} ${e.id} D${e.day}: 온 뒤에만 밤 사건`);
  }
});
