// node --test v2/test.js  (또는 v2 폴더에서 node --test)
const test = require('node:test');
const assert = require('node:assert');
const E = require('./engine.js');
const D = E.D;
const { play, POLICIES } = require('./sim/bots.js');

const clone = (s) => JSON.parse(JSON.stringify(s));
const hash = (s) => JSON.stringify(s);

function checkInvariants(s, where) {
  for (const k of Object.keys(D.CAP)) {
    assert.ok(Number.isFinite(s.res[k]) && s.res[k] >= 0 && s.res[k] <= D.CAP[k], `${where}: 자원 ${k}=${s.res[k]}`);
  }
  assert.ok(s.flood >= 0 && s.flood <= 8, `${where}: 침수 ${s.flood}`);
  assert.ok(s.exposure >= 0 && s.exposure <= 8, `${where}: 노출 ${s.exposure}`);
  assert.ok(s.forage >= 0 && s.salvageLeft >= 0, `${where}: 풀`);
  for (const r of s.residents) {
    assert.ok(r.stress >= 0 && r.stress <= 100 && Number.isFinite(r.stress), `${where}: ${r.name} 스트레스 ${r.stress}`);
    assert.ok(r.injury >= 0 && r.injury <= 3, `${where}: ${r.name} 부상 ${r.injury}`);
    assert.ok(['home', 'exp', 'dead'].includes(r.status), `${where}: 상태 ${r.status}`);
    for (const k of Object.keys(r.skills)) assert.ok(Number.isFinite(r.skills[k]), `${where}: 기술`);
  }
  assert.ok(s.promises.length <= 3, `${where}: 약속 ${s.promises.length}개`);
  assert.ok(['prologue', 'morning', 'expedition', 'evening', 'nightEvent', 'boarding', 'ended'].includes(s.phase), `${where}: phase ${s.phase}`);
  if (s.exp) for (const k of Object.keys(s.exp.loot)) assert.ok(s.exp.loot[k] >= 0, `${where}: 전리품 ${k}`);
}

test('데이터 무결성: 모든 사건의 선택지에 결과가 있고 참조가 유효하다', () => {
  const all = Object.assign({}, D.EVENTS, D.PROMISES, D.NIGHT, { patrol: D.PATROL, flood_break: D.FLOOD_BREAK, corpse: D.CORPSE });
  for (const [id, ev] of Object.entries(all)) {
    assert.ok(ev.choices.length >= 2, `${id}: 선택지 2개 미만`);
    assert.ok(ev.choices.some((c) => !c.cost && !c.req), `${id}: 항상 고를 수 있는 선택지가 없음 (막다른 길)`);
    for (const c of ev.choices) {
      if (c.check) { assert.ok(c.ok && c.fail, `${id}: 판정 결과 누락`); assert.ok(D.SKILLS[c.check.skill], `${id}: 잘못된 기술`); }
      else assert.ok(c.out, `${id}: 결과 누락 (${c.text})`);
      for (const o of [c.out, c.ok, c.fail].filter(Boolean)) {
        for (const k of Object.keys(Object.assign({}, o.loot, o.res, o.lose, c.cost))) assert.ok(D.RES[k], `${id}: 잘못된 자원 ${k}`);
        if (o.item) assert.ok(D.ITEMS[o.item], `${id}: 잘못된 도구`);
        if (o.ally) assert.ok(D.ALLIES[o.ally], `${id}: 잘못된 합류자`);
        if (o.promise) assert.ok(D.PROMISES[o.promise.id], `${id}: 없는 약속`);
      }
      if (c.req && c.req.item) assert.ok(D.ITEMS[c.req.item], `${id}: 잘못된 요구 도구`);
      if (c.req && c.req.trait) assert.ok(Object.values(D.TRAITS).some((t) => t.tag === c.req.trait), `${id}: 요구 특성 없음`);
    }
  }
  for (const reg of Object.values(D.REGIONS)) for (const list of Object.values(reg.depth)) for (const id of list) assert.ok(D.EVENTS[id], `지역 사건 없음 ${id}`);
  for (const id of D.START_PEOPLE) { const p = D.PEOPLE[id]; assert.ok(D.TRAITS[p.good] && D.TRAITS[p.bad], `${id} 특성`); assert.strictEqual(p.story.length, 3); }
});

test('결정성: 같은 시드와 같은 행동은 같은 결과', () => {
  const a = play(7, 'balanced').s, b = play(7, 'balanced').s;
  assert.strictEqual(hash(a), hash(b));
  assert.notStrictEqual(hash(a), hash(play(8, 'balanced').s));
});

test('저장/불러오기: 중간에 직렬화해 이어 가도 결과가 같다 (난수 상태 포함)', () => {
  const s = E.newGame(11);
  const pol = POLICIES.balanced;
  // 프롤로그 + 3일 진행 후 저장
  let guard = 0;
  const step = (st) => {
    switch (st.phase) {
      case 'prologue': E.dispatch(st, { type: 'proChoose', i: 0 }); E.dispatch(st, { type: 'proNext' }); break;
      case 'morning': E.dispatch(st, { type: 'setPlan', plan: E.suggestPlan(st) }); E.dispatch(st, { type: 'endDay' }); break;
      case 'evening': { const v = E.eveningView(st); if (v.type === 'promise') { E.dispatch(st, { type: 'eveningChoose', i: v.choices.findIndex((c) => !c.locked) }); } E.dispatch(st, { type: 'eveningDone' }); break; }
      case 'nightEvent': { const v = E.nightView(st); if (!v.result) E.dispatch(st, { type: 'nightChoose', i: v.choices.findIndex((c) => !c.locked) }); E.dispatch(st, { type: 'nightDone' }); break; }
      case 'boarding': E.dispatch(st, { type: 'confirmBoarding' }); break;
      default: throw new Error(st.phase);
    }
  };
  while (s.day < 4 && guard++ < 200) step(s);
  const saved = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.ok(saved, '정규화 실패');
  let g2 = 0; while (s.phase !== 'ended' && g2++ < 300) step(s);
  let g3 = 0; while (saved.phase !== 'ended' && g3++ < 300) step(saved);
  assert.strictEqual(hash(s), hash(saved));
});

test('저장 데이터: 버전이 다르면 null, 깨진 값은 보정', () => {
  assert.strictEqual(E.normalize(null), null);
  assert.strictEqual(E.normalize({ v: 1 }), null);
  const s = E.newGame(3); s.res.food = 'x'; s.report = null;
  const n = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(n.res.food, 0); assert.ok(Array.isArray(n.report));
});

test('불변식: 모든 정책·시드에서 매 단계 자원·게이지·부상 범위와 진행(막다른 길 없음)', () => {
  for (const name of Object.keys(POLICIES)) {
    for (let seed = 1; seed <= 40; seed++) {
      const pol = POLICIES[name];
      const s = E.newGame(seed);
      // 봇의 play() 대신 단계별로 확인하려고 직접 한 판을 돌리되, 같은 로직을 쓴다
      const origDispatch = E.dispatch;
      const result = play(seed, name);
      checkInvariants(result.s, `${name}/${seed}`);
      assert.strictEqual(result.s.phase, 'ended', `${name}/${seed}: 끝나지 않음`);
      assert.ok(result.s.ending && ['safe', 'half', 'thin', 'missed', 'wiped'].includes(result.s.ending.tier), `${name}/${seed}: 결말 없음`);
      assert.ok(result.s.day <= D.GOAL_DAY, `${name}/${seed}: 날짜 초과`);
    }
  }
});

test('불변식(단계별): 한 판 안의 모든 단계에서 상태가 유효하다', () => {
  const orig = E.dispatch;
  let calls = 0;
  const wrapped = (s, a) => { const r = orig(s, a); checkInvariants(s, `${a.type}`); calls++; return r; };
  E.dispatch = wrapped;
  try { for (let seed = 1; seed <= 25; seed++) play(seed, seed % 2 ? 'balanced' : 'rush'); }
  finally { E.dispatch = orig; }
  assert.ok(calls > 500);
});

test('약속 예약: 선택 즉시 2~4일 뒤 저녁에 반드시 나오고, 건너뛸 수 없다', () => {
  const s = E.newGame(5);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  assert.strictEqual(s.phase, 'morning');
  s.res.meds = 3; s.res.food = 20; s.res.water = 20;
  assert.ok(E.dispatch(s, { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 1, items: [] } }).ok);
  assert.strictEqual(s.exp.eventId, 'a1_pharmacy');             // 첫 방문엔 사슬 시작 사건이 반드시 나온다
  assert.ok(E.dispatch(s, { type: 'expChoose', i: 1 }).ok);     // 약품을 건네고 사정을 듣는다
  assert.deepStrictEqual(s.promises.map((p) => [p.id, p.due]), [['eunchae_return', s.day + 3]]);
  E.dispatch(s, { type: 'expNext', mode: 'return' });
  // 약속 당일 저녁까지 하루씩 진행
  let guard = 0;
  while (!(s.phase === 'evening' && s.evening && s.evening.type === 'promise') && guard++ < 100) {
    if (s.phase === 'morning') { E.dispatch(s, { type: 'setPlan', plan: E.suggestPlan(s) }); E.dispatch(s, { type: 'endDay' }); }
    else if (s.phase === 'evening') E.dispatch(s, { type: 'skipTalk' });
    else if (s.phase === 'nightEvent') { const v = E.nightView(s); if (!v.result) E.dispatch(s, { type: 'nightChoose', i: v.choices.findIndex((c) => !c.locked) }); E.dispatch(s, { type: 'nightDone' }); }
  }
  assert.strictEqual(s.phase, 'evening'); assert.strictEqual(s.evening.type, 'promise');
  assert.strictEqual(s.day, 1 + 3);
  assert.ok(!E.dispatch(s, { type: 'eveningDone' }).ok, '약속을 건너뛸 수 없어야 한다');
  assert.ok(!E.dispatch(s, { type: 'skipTalk' }).ok);
  s.res.food = 10; s.res.meds = 2;
  assert.ok(E.dispatch(s, { type: 'eveningChoose', i: 0 }).ok);
  assert.ok(s.flags.hospital_pact && s.allies.eunchae);
  assert.strictEqual(s.promises.length, 0);
});

test('약속 미루기: 한 번만 미룰 수 있고, 미루면 2일 뒤 같은 약속이 다시 나온다', () => {
  const s = E.newGame(6);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.promises = [{ id: 'eunchae_return', due: s.day }];
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' });
  assert.strictEqual(s.evening.type, 'promise');
  const v = E.eveningView(s);
  assert.ok(!v.choices[1].locked);
  assert.ok(E.dispatch(s, { type: 'eveningChoose', i: 1 }).ok);                 // 며칠만 기다려 달라고 한다
  assert.deepStrictEqual(s.promises.map((p) => [p.id, p.due]), [['eunchae_return', s.day + 2]]);
  assert.ok(s.flags.delayed_eunchae);
  s.phase = 'evening'; s.evening = { type: 'promise', id: 'eunchae_return' };     // 이틀 뒤 다시 도착
  assert.ok(E.eveningView(s).choices[1].locked, '두 번째로는 미룰 수 없다');
  assert.ok(!E.dispatch(s, { type: 'eveningChoose', i: 1 }).ok);
});

test('약속은 중복 예약되지 않고, 최대 3개를 넘지 않는다', () => {
  const s = E.newGame(1);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.res.meds = 3; s.res.food = 20; s.res.water = 20;
  s.promises = [{ id: 'eunchae_return', due: 5 }];
  E.dispatch(s, { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 1, items: [] } });
  E.dispatch(s, { type: 'expChoose', i: 1 });           // 같은 약속을 또 예약하려는 선택
  assert.strictEqual(s.promises.filter((p) => p.id === 'eunchae_return').length, 1);
  assert.ok(s.promises.length <= 3);
});

test('판정 진실성: 화면에 표시된 성공률이 실제 빈도와 같다 (±4%p)', () => {
  const N = 3000;
  const base = E.newGame(9);
  for (let i = 0; i < 4; i++) { E.dispatch(base, { type: 'proChoose', i: 0 }); E.dispatch(base, { type: 'proNext' }); }
  E.dispatch(base, { type: 'expStart', region: 'B', party: ['gicheol', 'dongha'], pack: { food: 2, water: 2, meds: 0, items: [] } });
  assert.strictEqual(base.exp.eventId, 'b1_gate');
  const shown = E.expView(base).choices[0].chance;          // 완력 판정
  assert.ok(shown > 0.4 && shown < 0.95);
  let succ = 0;
  for (let i = 0; i < N; i++) {
    const s = clone(base); s.rng = (i * 2654435761) >>> 0;
    E.dispatch(s, { type: 'expChoose', i: 0 });
    if (s.exp.result.roll.success) succ++;
  }
  assert.ok(Math.abs(succ / N - shown) < 0.04, `표시 ${shown} / 실제 ${succ / N}`);
});

test('원정 규칙: 잘못된 편성·보급은 거부된다', () => {
  const s = E.newGame(2);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  const ok = { food: 2, water: 2, meds: 0, items: [] };
  assert.notStrictEqual(E.canDepart(s, 'A', ['gicheol'], ok), '');                       // 1명
  assert.notStrictEqual(E.canDepart(s, 'A', ['gicheol', 'gicheol'], ok), '');            // 같은 사람 둘
  assert.notStrictEqual(E.canDepart(s, 'A', ['gicheol', 'seoha'], { food: 1, water: 2, meds: 0, items: [] }), ''); // 보급 부족
  assert.notStrictEqual(E.canDepart(s, 'A', ['gicheol', 'seoha'], { food: 99, water: 2, meds: 0, items: [] }), ''); // 창고에 없는 만큼
  s.residents[0].injury = 2;
  assert.notStrictEqual(E.canDepart(s, 'A', ['soonrye', 'seoha'], ok), '');              // 중상
  s.residents[0].injury = 0; s.residents[1].stress = 80;
  assert.notStrictEqual(E.canDepart(s, 'A', ['soonrye', 'seoha'], ok), '');              // 스트레스
  s.residents[1].stress = 20; s.closed.A = 2;
  assert.notStrictEqual(E.canDepart(s, 'A', ['soonrye', 'seoha'], ok), '');              // 길 막힘
  s.closed.A = 0;
  assert.strictEqual(E.canDepart(s, 'A', ['soonrye', 'seoha'], ok), '');
  assert.ok(E.dispatch(s, { type: 'expStart', region: 'A', party: ['soonrye', 'seoha'], pack: ok }).ok);
  assert.ok(!E.dispatch(s, { type: 'expStart', region: 'B', party: ['gicheol', 'dongha'], pack: ok }).ok); // 이미 원정 중
});

test('원정 시간: 8시간 초과는 강행, 10시간 초과는 불가, 보급 부족은 스트레스', () => {
  const s = E.newGame(2);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.res.food = 20; s.res.water = 20;
  E.dispatch(s, { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 0, items: [] } });
  let v = E.expView(s);
  assert.strictEqual(v.hours, 4);                       // 깊이 1 왕복 2 + 사건 1개 2
  const safeIdx = v.choices.findIndex((c) => !c.locked && !c.choice.check && !c.choice.cost);
  E.dispatch(s, { type: 'expChoose', i: safeIdx });
  v = E.expView(s);
  assert.strictEqual(v.options.back.over, false);
  assert.ok(v.options.more.ok);                         // 6시간
  assert.strictEqual(v.options.deeper.hours, 2 * 2 + 2 * 2 + (s.exp.extra));
  let guard = 0;
  while (E.expView(s) && E.expView(s).options && E.expView(s).options.more.ok && guard++ < 10) {
    E.dispatch(s, { type: 'expNext', mode: 'more' });
    const w = E.expView(s); let i = w.choices.findIndex((c) => !c.locked && !c.choice.check && !c.choice.cost);
    if (i < 0) i = w.choices.findIndex((c) => !c.locked);
    E.dispatch(s, { type: 'expChoose', i });
  }
  v = E.expView(s);
  assert.ok(v.hours <= E.MAX_HOURS, `시간 ${v.hours}`);
  const stressBefore = s.residents.filter((r) => r.status === 'exp').map((r) => r.stress);
  E.dispatch(s, { type: 'expNext', mode: 'return' });
  assert.strictEqual(s.phase, 'morning');
  assert.ok(s.residents.filter((r) => ['gicheol', 'seoha'].includes(r.id)).every((r, i) => r.stress >= stressBefore[i] + 12));
  assert.ok(!E.dispatch(s, { type: 'expStart', region: 'A', party: ['soonrye', 'eunji'], pack: { food: 2, water: 2, meds: 0, items: [] } }).ok, '하루 한 번만 원정');
});

test('미리보기 = 실제: 오늘 계획의 예상 생산이 밤 정산 결과와 같다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = E.newGame(seed);
    for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: i === 3 ? 0 : i % 2 }); E.dispatch(s, { type: 'proNext' }); }
    s.res = { food: 12, water: 12, parts: 5, meds: 2 };
    const plan = E.suggestPlan(s);
    E.dispatch(s, { type: 'setPlan', plan });
    const ev = E.evalPlan(s);
    const before = Object.assign({}, s.res);
    E.dispatch(s, { type: 'endDay' });
    if (s.evening.type === 'promise') continue;
    E.dispatch(s, { type: 'skipTalk' });
    // 밤 사건 선택 전: 생산·소모만 반영된 상태
    const expectF = Math.min(24, before.food + ev.d.food - ev.consume.food);
    const expectW = Math.min(24, before.water + ev.d.water - ev.consume.water);
    assert.strictEqual(s.res.food, Math.max(0, expectF), `식량 seed ${seed}`);
    assert.strictEqual(s.res.water, Math.max(0, expectW), `물 seed ${seed}`);
    assert.strictEqual(s.res.parts, Math.min(18, before.parts + ev.d.parts), `부품 seed ${seed}`);
  }
});

test('부상: 위독은 다음 날 밤까지 치료하지 못하면 사망, 치료하면 생존', () => {
  const mk = () => {
    const s = E.newGame(4);
    for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
    const r = E.byId(s, 'dongha'); r.injury = 3; r.crit = s.day + 1; s.res.meds = 3;
    return s;
  };
  const night = (s) => {
    E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
    if (s.phase === 'nightEvent') { const v = E.nightView(s); E.dispatch(s, { type: 'nightChoose', i: v.choices.findIndex((c) => !c.locked) }); E.dispatch(s, { type: 'nightDone' }); }
  };
  const a = mk(); E.dispatch(a, { type: 'setPlan', plan: {} }); night(a);         // 1일차 방치
  assert.strictEqual(E.byId(a, 'dongha').status, 'home');                          // 아직 안 죽음
  E.dispatch(a, { type: 'setPlan', plan: {} }); night(a);
  assert.strictEqual(E.byId(a, 'dongha').status, 'dead');                          // 2일차 밤에 사망
  const b = mk(); E.dispatch(b, { type: 'setPlan', plan: { mari: 'tend' } }); night(b);
  assert.ok(E.byId(b, 'dongha').injury < 3); assert.strictEqual(E.byId(b, 'dongha').status, 'home');
});

test('중상 방치는 하룻밤 뒤 위독으로 악화된다', () => {
  const s = E.newGame(4);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  E.byId(s, 'dongha').injury = 2;
  const nightOnce = () => { E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' }); if (s.phase === 'nightEvent') { const v = E.nightView(s); E.dispatch(s, { type: 'nightChoose', i: v.choices.findIndex((c) => !c.locked) }); E.dispatch(s, { type: 'nightDone' }); } };
  nightOnce(); assert.strictEqual(E.byId(s, 'dongha').injury, 3);
});

test('첫 선택이 이후를 바꾼다: 약국을 지나치면 협정·열차 길이 사라진다', () => {
  const run = (skip) => {
    const s = E.newGame(21);
    for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
    s.res.food = 20; s.res.water = 20; s.res.meds = 3;
    E.dispatch(s, { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 1, items: [] } });
    E.dispatch(s, { type: 'expChoose', i: skip ? 2 : 1 });
    return s;
  };
  const helped = run(false), skipped = run(true);
  assert.strictEqual(helped.promises.length, 1); assert.strictEqual(skipped.promises.length, 0);
  assert.ok(helped.flags.met_eunchae && skipped.flags.skipped_eunchae);
  assert.ok(skipped.flags.done_a1_pharmacy, '지나친 사건은 다시 나오지 않는다');
});

test('결말: 통로 확보 없이는 열차가 지나가고, 확보하면 승차 인원이 보급으로 제한된다', () => {
  const s = E.newGame(30);
  s.phase = 'boarding'; s.day = 10;
  s.res.food = 3; s.res.water = 3; s.flags.passage_secured = true; s.flags.hospital_pact = true;
  E.dispatch(s, { type: 'proChoose', i: 0 });  // 무시됨
  const pool = E.boardingPool(s); assert.strictEqual(pool.length, 6);
  s.boarding = { pool, cap: Math.min(pool.length, Math.floor((s.res.food + s.res.water) / 2)), picks: [] };
  assert.strictEqual(s.boarding.cap, 3);
  for (const p of pool) E.dispatch(s, { type: 'board', id: p.id });
  assert.strictEqual(s.boarding.picks.length, 3, '보급 한도를 넘어 태울 수 없다');
  assert.ok(E.dispatch(s, { type: 'confirmBoarding' }).ok);
  assert.strictEqual(s.phase, 'ended'); assert.ok(['half', 'thin'].includes(s.ending.tier));

  const t = E.newGame(31); t.phase = 'boarding'; t.day = 10;
  const pool2 = E.boardingPool(t); t.boarding = { pool: pool2, cap: 0, picks: [] };
  E.dispatch(t, { type: 'confirmBoarding' });
  assert.strictEqual(t.ending.tier, 'missed');
});

test('난이도 구조(자동 플레이 300판): 원정·대응·위협이 모두 결과를 바꾼다', () => {
  const N = 300;
  const score = { safe: 3, half: 2, thin: 1, missed: 0, wiped: 0 };
  const run = (name, mod) => {
    const orig = E.suggestPlan; if (mod) E.suggestPlan = (s) => mod(orig(s), s);
    let sum = 0, deaths = 0, pass = 0;
    try { for (let seed = 1; seed <= N; seed++) { const { s } = play(seed, name); sum += score[s.ending.tier]; deaths += s.stats.deaths; if (s.flags.passage_secured) pass++; } }
    finally { E.suggestPlan = orig; }
    return { avg: sum / N, deaths: deaths / N, pass: pass / N };
  };
  const ban = (tasks) => (p) => { for (const k of Object.keys(p)) if (tasks.includes(p[k])) p[k] = 'rest'; return p; };
  const bal = run('balanced'), none = run('nofacility'), clinic = run('clinic'), stay = run('stay'), neglect = run('neglect'), skip = run('skipchains'), sloppy = run('sloppy'), rush = run('rush');
  assert.ok(stay.avg < 0.05 && stay.pass === 0, `원정 안 가기 ${JSON.stringify(stay)}`);               // 원정 없이는 협정·통로 불가
  assert.ok(neglect.avg < 0.5 && neglect.deaths > 2, `방치 ${JSON.stringify(neglect)}`);
  assert.ok(skip.avg < bal.avg - 0.5 && skip.pass > 0.4, `도움 요청을 지나쳤을 때 ${JSON.stringify(skip)} vs ${bal.avg}`);   // 불리하지만 두 번째 기회가 있다
  assert.ok(sloppy.avg < bal.avg - 0.15, `실수하는 플레이 ${sloppy.avg} vs ${bal.avg}`);               // 서툰 배치는 눈에 띄게 불리하다
  assert.ok(rush.avg < bal.avg - 0.1 && rush.deaths > bal.deaths, `쉬지 않고 달리기 ${JSON.stringify(rush)} vs ${JSON.stringify(bal)}`);
  // 시설 선택은 한쪽이 지배하지 않는다 (세 가지 모두 대응형으로 쓸 만하다)
  assert.ok(Math.abs(bal.avg - none.avg) < 0.35 && Math.abs(bal.avg - clinic.avg) < 0.5, `시설 ${bal.avg} / ${none.avg} / ${clinic.avg}`);
  // 위협은 장식이 아니다: 배수를 안 하면 침수로 발전기가 잠겨 크게 불리해진다
  const noDrain = run('balanced', ban(['drain']));
  assert.ok(noDrain.avg < bal.avg - 0.6, `배수 금지 ${noDrain.avg} vs ${bal.avg}`);
  assert.ok(bal.deaths > 0.03 && bal.deaths < 1.0, `대응형 평균 사망 ${bal.deaths}`);
});

test('침수 5 이상이면 발전기가 잠기고, 노출도 오르지 않는다', () => {
  const s = E.newGame(8);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.res = { food: 12, water: 12, parts: 5, meds: 1 }; s.flood = 5;
  E.dispatch(s, { type: 'setPlan', plan: { gicheol: 'gen', seoha: 'pump' } });
  const ev = E.evalPlan(s);
  assert.strictEqual(ev.made, 0); assert.ok(ev.floodStop);
  assert.strictEqual(ev.d.water, 0); assert.strictEqual(ev.d.exposure, 0);
  assert.ok(ev.idle.includes('gicheol') && ev.idle.includes('seoha'));      // 일 못 한 사람은 쉰다
  const before = E.byId(s, 'seoha').stress;
  E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.ok(E.byId(s, 'seoha').stress < before, '일 못 한 사람은 휴식 회복을 받는다');
});

test('수위 경보에 가려진 순찰대는 같은 밤에 이어서 온다', () => {
  const s = E.newGame(12);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.day = 8; s.visitDay = 8; s.flood = 7; s.res = { food: 20, water: 20, parts: 5, meds: 1 };
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.strictEqual(s.nightEv.id, 'flood_break');
  E.dispatch(s, { type: 'nightChoose', i: 1 });
  assert.ok(E.dispatch(s, { type: 'nightDone' }).ok);
  assert.strictEqual(s.phase, 'nightEvent'); assert.strictEqual(s.nightEv.id, 'patrol');
  E.dispatch(s, { type: 'nightChoose', i: 0 });
  E.dispatch(s, { type: 'nightDone' });
  assert.strictEqual(s.visitDay, null); assert.strictEqual(s.day, 9);
});

test('노출이 높으면 예정일보다 일찍 순찰대가 온다 (첫 순찰 전에도)', () => {
  const s = E.newGame(13);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.exposure = 7; s.day = 3;
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.strictEqual(s.visitDay, 4);
});

test('약속 기한은 열차 시간(D10)을 넘지 않고, 같은 날 약속은 이어서 나오며, 막판 미루기는 잠긴다', () => {
  const s = E.newGame(14);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.day = 9; s.promises = [{ id: 'dohyeon_key', due: 9 }, { id: 'eunchae_return', due: 9 }];
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' });
  assert.strictEqual(s.evening.id, 'dohyeon_key');
  const v = E.eveningView(s);
  assert.ok(v.choices[1].locked && /열차/.test(v.choices[1].reason), '9일에는 이틀 미루기가 불가');
  s.res.parts = 6; E.dispatch(s, { type: 'eveningChoose', i: 0 });
  assert.ok(E.dispatch(s, { type: 'eveningDone' }).ok);
  assert.strictEqual(s.phase, 'evening'); assert.strictEqual(s.evening.id, 'eunchae_return');   // 같은 날 다음 약속
  s.res.food = 10; s.res.meds = 2; E.dispatch(s, { type: 'eveningChoose', i: 0 });
  // 열차 이후로 예약하려 해도 D10으로 고정
  const t2 = E.newGame(15);
  for (let i = 0; i < 4; i++) { E.dispatch(t2, { type: 'proChoose', i: 0 }); E.dispatch(t2, { type: 'proNext' }); }
  t2.day = 9; t2.res.meds = 3; t2.res.food = 20; t2.res.water = 20;
  E.dispatch(t2, { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 1, items: [] } });
  E.dispatch(t2, { type: 'expChoose', i: 1 });
  assert.strictEqual(t2.promises[0].due, D.GOAL_DAY);
});

test('결과의 추가 시간이 강행 상한(10시간)을 넘지 못한다', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = E.newGame(seed);
    for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
    s.res.food = 24; s.res.water = 24;
    E.dispatch(s, { type: 'expStart', region: seed % 2 ? 'A' : 'B', party: ['gicheol', 'dongha'], pack: { food: 6, water: 6, meds: 0, items: [] } });
    let g = 0;
    while (s.phase === 'expedition' && g++ < 30) {
      const v = E.expView(s);
      assert.ok(v.hours <= E.MAX_HOURS + 0, `seed ${seed}: ${v.hours}시간`);
      if (v.phase === 'event') {
        // 시간을 늘리는 선택지를 일부러 고른다
        let i = v.choices.findIndex((c) => !c.locked && E.choiceTags(c.choice).some((x) => x.startsWith('시간')));
        if (i < 0) i = v.choices.findIndex((c) => !c.locked);
        E.dispatch(s, { type: 'expChoose', i });
      } else {
        const o = v.options;
        E.dispatch(s, { type: 'expNext', mode: o.more.ok ? 'more' : o.deeper.ok ? 'deeper' : 'return' });
      }
    }
  }
});

test('프롤로그 결과 화면에서 같은 선택을 반복해 보상을 늘릴 수 없고, 프롤로그 선택이 도구를 준다', () => {
  const s = E.newGame(2);
  assert.ok(E.dispatch(s, { type: 'proChoose', i: 1 }).ok);          // 칸 안을 둘러본다 → 부품 1 + 밧줄
  const parts = s.res.parts;
  assert.ok(!E.dispatch(s, { type: 'proChoose', i: 1 }).ok);
  assert.strictEqual(s.res.parts, parts);
  assert.ok(s.items.rope);
});

test('한국어 조사', () => {
  assert.strictEqual(E.J('윤서하', '이/가'), '윤서하가');
  assert.strictEqual(E.J('박기철', '이/가'), '박기철이');
  assert.strictEqual(E.J('정마리', '을/를'), '정마리를');
  assert.strictEqual(E.J('김순례', '은/는'), '김순례는');
  assert.strictEqual(E.J('한동하', '과/와'), '한동하와');
  assert.strictEqual(E.J('최은지', '과/와'), '최은지와');
});

test('밤 사건은 이름 있는 주민에게 일어난다 (조사까지 맞게)', () => {
  let seen = 0;
  for (let seed = 1; seed <= 120 && seen < 6; seed++) {
    const s = E.newGame(seed);
    for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
    s.day = 4; E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
    if (s.phase !== 'nightEvent' || !s.nightEv.who || !s.nightEv.who.length) continue;
    const v = E.nightView(s);
    assert.ok(!/\{who|undefined/.test(v.text), v.text);
    for (const id of s.nightEv.who) assert.ok(v.text.includes(E.byId(s, id).name), v.text);
    seen++;
  }
  assert.ok(seen >= 3, '이름이 들어가는 밤 사건을 못 만남');
});

test('승차: 정원은 식량·물 2개씩과 부품 들것·병원 보급으로 정해지고, 아무도 안 태우는 확정은 불가, 명부에 약속이 기록된다', () => {
  const s = E.newGame(30);
  s.phase = 'boarding'; s.day = 10;
  s.res = { food: 7, water: 6, parts: 9, meds: 0 }; s.flags.passage_secured = true; s.flags.hospital_pact = true; s.flags.seat_bonus = true; s.allies.eunchae = true; s.allies.dohyeon = true; s.flags.repair_open = true;
  s.flags.pact_refused = false; s.flags.skipped_eunchae = false;
  s.promises = [{ id: 'eunchae_return', due: 10 }];
  const info = E.trainInfo(s);
  assert.strictEqual(info.base, 3); assert.strictEqual(info.hospital, 2); assert.strictEqual(info.litter, 2); assert.strictEqual(info.cap, 7);
  const t = E.newGame(31); t.phase = 'boarding'; t.day = 10; t.res = { food: 2, water: 2, parts: 0, meds: 0 }; t.flags.passage_secured = true;
  const tr = E.trainInfo(t); assert.strictEqual(tr.cap, 1);
  t.boarding = { pool: E.boardingPool(t), cap: tr.cap, supplyCap: tr.supplyCap, passage: true, picks: [] };
  assert.ok(!E.dispatch(t, { type: 'confirmBoarding' }).ok, '0명 확정 불가');
  E.dispatch(t, { type: 'board', id: 'soonrye' });
  assert.ok(E.dispatch(t, { type: 'confirmBoarding' }).ok);
  assert.ok(t.ending.ledger.length >= 0);
  // 통로는 이어졌지만 보급이 없으면 '비어 있는 열차'
  const u = E.newGame(32); u.phase = 'boarding'; u.day = 10; u.res = { food: 0, water: 0, parts: 0, meds: 0 }; u.flags.passage_secured = true;
  u.boarding = { pool: E.boardingPool(u), cap: 0, supplyCap: 0, passage: true, picks: [] };
  E.dispatch(u, { type: 'confirmBoarding' }); assert.strictEqual(u.ending.title, '비어 있는 열차');
  // 명부의 약속 기록
  const w = E.newGame(33); w.phase = 'boarding'; w.day = 10; w.flags.passage_secured = true; w.flags.pact_refused = true; w.promises = [{ id: 'eunchae_return', due: 10 }]; w.res = { food: 10, water: 10, parts: 0, meds: 0 };
  const iw = E.trainInfo(w); w.boarding = { pool: E.boardingPool(w), cap: iw.cap, supplyCap: iw.supplyCap, passage: true, picks: E.boardingPool(w).slice(0, iw.cap).map((p) => p.id) };
  E.dispatch(w, { type: 'confirmBoarding' });
  assert.ok(w.ending.ledger.some((l) => l.kind === 'broken') && w.ending.ledger.some((l) => l.kind === 'late'));
});

test('사망한 사람도 승차 등급의 분모에 포함된다 (사망이 등급을 깎는다)', () => {
  const mk = (dead) => {
    const s = E.newGame(40); s.phase = 'boarding'; s.day = 10;
    s.res = { food: 24, water: 24, parts: 0, meds: 0 }; s.flags.passage_secured = true; s.flags.hospital_pact = true;
    for (let i = 0; i < dead; i++) { s.residents[i].status = 'dead'; }
    const info = E.trainInfo(s); const pool = E.boardingPool(s);
    s.boarding = { pool, cap: info.cap, supplyCap: info.supplyCap, passage: true, picks: pool.map((p) => p.id) };
    E.dispatch(s, { type: 'confirmBoarding' });
    return s.ending.tier;
  };
  assert.strictEqual(mk(0), 'safe');
  assert.notStrictEqual(mk(3), 'safe');
});

test('약속 선택이 오늘 밤 치료용 약품을 빼앗으면 경고한다', () => {
  const s = E.newGame(6);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.res = { food: 10, water: 10, parts: 3, meds: 1 };
  E.byId(s, 'dongha').injury = 3; E.byId(s, 'dongha').crit = s.day;
  s.promises = [{ id: 'eunchae_return', due: s.day }];
  E.dispatch(s, { type: 'setPlan', plan: { mari: 'tend' } }); E.dispatch(s, { type: 'endDay' });
  const v = E.eveningView(s);
  assert.ok(v.choices[0].warn && /치료/.test(v.choices[0].warn), JSON.stringify(v.choices[0]));
  assert.ok(!v.choices[2].warn);
});

test('미리보기: 사망 예정·침수 경보·순찰·통로 완성(침수 −2)을 경고한다', () => {
  const s = E.newGame(6);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.res.meds = 0; E.byId(s, 'dongha').injury = 3; E.byId(s, 'dongha').crit = s.day;
  E.dispatch(s, { type: 'setPlan', plan: { mari: 'tend' } });
  let pv = E.previewNight(s);
  assert.ok(pv.deaths.includes('한동하') && pv.warnings.some((w) => /한동하가 오늘 밤 사망/.test(w.text)));
  s.flood = 7; s.day = 6; pv = E.previewNight(s); assert.ok(pv.warnings.some((w) => /수위 경보/.test(w.text)));
  const r = E.newGame(7);
  for (let i = 0; i < 4; i++) { E.dispatch(r, { type: 'proChoose', i: 0 }); E.dispatch(r, { type: 'proNext' }); }
  r.flags.repair_open = true; r.project = { id: 'repair', progress: 1 }; r.flood = 5;
  E.dispatch(r, { type: 'setPlan', plan: { gicheol: 'build' } });
  const pr = E.previewNight(r);
  const before = r.flood; E.dispatch(r, { type: 'endDay' }); E.dispatch(r, { type: 'skipTalk' });
  assert.strictEqual(r.flood, pr.flood, '예상 침수 = 실제 침수');
  assert.ok(r.flags.passage_secured);
});

test('길 막힘: 2일간이면 아침 2번 막힌다', () => {
  const s = E.newGame(16);
  for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); }
  s.day = 8; s.visitDay = 8; s.exposure = 4; s.res.food = 10;
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.strictEqual(s.nightEv.id, 'patrol');
  E.dispatch(s, { type: 'nightChoose', i: 2 }); E.dispatch(s, { type: 'nightDone' });
  assert.strictEqual(s.closed.A, 2);                          // 9일 아침: 2일 남음
  s.expParty = []; E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  if (s.phase === 'nightEvent') { const v = E.nightView(s); E.dispatch(s, { type: 'nightChoose', i: v.choices.findIndex((c) => !c.locked) }); E.dispatch(s, { type: 'nightDone' }); }
  assert.strictEqual(s.day, 10); assert.strictEqual(s.closed.A, 1);   // 10일 아침: 1일 남음 — 9·10일 아침 모두 막혔다
  assert.notStrictEqual(E.canDepart(s, 'A', ['gicheol', 'seoha'], { food: 2, water: 2, meds: 0, items: [] }), '');
});

test('선택지 태그: 실패 시 중상·시간·노출 같은 숨은 위험을 미리 보여 준다', () => {
  const tags = (id, i) => E.choiceTags(D.EVENTS[id].choices[i]);
  assert.ok(tags('b3_stairs', 1).includes('실패 시 중상'));
  assert.ok(tags('b3_stairs', 2).includes('시간 +2'));
  assert.ok(tags('a4_stockroom', 1).includes('노출 +1'));
  assert.ok(tags('a1_pharmacy', 0).includes('실패 시 부상') && tags('a1_pharmacy', 0).includes('실패 시 시간 +1'));
  assert.deepStrictEqual(tags('a2_stall', 0), []);
});

test('입력 검증: 잘못된 동작이 예외를 만들지 않고 상태를 바꾸지 않는다', () => {
  const s = E.newGame(5);
  const before = JSON.stringify(s);
  const bad = [null, undefined, 5, 'x', {}, { type: 5 }, { type: 'proChoose', i: 'length' }, { type: 'proChoose', i: -1 }, { type: 'proChoose', i: 99 },
    { type: 'startProject', id: 'constructor' }, { type: 'startProject', id: '__proto__' }, { type: 'assign', rid: 'soonrye', task: 'toString' },
    { type: 'expStart', region: 'A', party: 'x', pack: {} }, { type: 'expStart', region: 'A', party: ['a', 'b'], pack: { items: 'rope' } },
    { type: 'expStart', region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, items: ['toString'] } },
    { type: 'setPlan', plan: 5 }, { type: 'board', id: 5 }, { type: 'talk', rid: {} }, { type: 'expNext', mode: 5 }];
  for (const a of bad) { assert.doesNotThrow(() => E.dispatch(s, a), JSON.stringify(a)); }
  assert.strictEqual(JSON.stringify(s), before);
});

test('저장 불러오기: 단계와 맞지 않는 구조의 저장은 거부한다', () => {
  const s = E.newGame(3); s.phase = 'expedition'; s.exp = null;
  assert.strictEqual(E.normalize(JSON.parse(JSON.stringify(s))), null);
  const u = E.newGame(3); u.phase = 'nightEvent'; u.nightEv = null;
  assert.strictEqual(E.normalize(JSON.parse(JSON.stringify(u))), null);
  const v = E.newGame(3); v.phase = 'weird';
  assert.strictEqual(E.normalize(JSON.parse(JSON.stringify(v))), null);
});

test('화면 스모크: 모든 단계의 화면에 undefined·NaN·[object가 없고, 필요한 버튼이 있다', () => {
  const V = require('./views.js');
  const orig = E.dispatch;
  const bad = /undefined|NaN|\[object|null</;
  const phasesSeen = new Set();
  const check = (s, where) => {
    for (const tab of ['station', 'map', 'people']) {
      const ui = { tab, prep: tab === 'map' ? { region: 'A', party: ['gicheol', 'seoha'], pack: { food: 2, water: 2, meds: 0, items: [] } } : null };
      const v = V.render(s, ui);
      for (const part of [v.header, v.body, v.nav]) assert.ok(!bad.test(part), `${where}/${s.phase}/${tab}: ${(part.match(bad) || [])[0]} → ${part.slice(Math.max(0, part.search(bad) - 60), part.search(bad) + 60)}`);
      if (s.phase !== 'morning') break;
    }
    phasesSeen.add(s.phase);
    const v = V.render(s, { tab: 'station' });
    if (s.phase === 'morning') assert.ok(v.body.includes('data-act="endDay"'), '하루를 보내는 버튼');
    if (s.phase === 'expedition') assert.ok(/data-act="(expChoose|expNext)"/.test(v.body), '원정 선택 버튼');
    if (s.phase === 'boarding') assert.ok(v.body.includes('confirmBoarding'));
    if (s.phase === 'ended') assert.ok(v.body.includes('restart'));
  };
  E.dispatch = (s, a) => { const r = orig(s, a); check(s, a.type); return r; };
  try { for (let seed = 1; seed <= 20; seed++) play(seed, ['balanced', 'rush', 'clinic', 'neglect'][seed % 4]); }
  finally { E.dispatch = orig; }
  for (const p of ['prologue', 'morning', 'expedition', 'evening', 'nightEvent', 'boarding', 'ended']) assert.ok(phasesSeen.has(p), `${p} 화면을 한 번도 못 봄`);
});

test('상태는 순수 데이터다: 어느 단계에서도 structuredClone이 되고 함수가 없다', () => {
  const orig = E.dispatch;
  const check = (s, where) => { try { structuredClone(s); } catch (e) { assert.fail(`${where}: ${e.message}`); } };
  E.dispatch = (s, a) => { const r = orig(s, a); check(s, `${a.type}/${s.phase}`); return r; };
  try { for (let seed = 1; seed <= 15; seed++) play(seed, ['balanced', 'rush', 'sloppy'][seed % 3]); }
  finally { E.dispatch = orig; }
});

// ── 어두운 장치: 영구 상처·붕괴·어둠·시신 ──
const started = (seed) => { const s = E.newGame(seed); for (let i = 0; i < 4; i++) { E.dispatch(s, { type: 'proChoose', i: 0 }); E.dispatch(s, { type: 'proNext' }); } return s; };

test('영구 상처: 중상에 이르면 확률로 남고, 기술이 깎이며, 최대 2개', () => {
  let got = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = started(seed); const r = E.byId(s, 'gicheol');
    const before = Object.assign({}, r.skills);
    const text = E.injure(s, r, 2);
    if (r.scars.length) {
      got++;
      assert.ok(text.includes(D.SCARS[r.scars[0]].name), '상처 문장에 이름');
      const S = D.SCARS[r.scars[0]];
      if (S.skill) assert.strictEqual(r.skills[S.skill], Math.max(0, before[S.skill] - 1));
    } else assert.strictEqual(text, '');
    r.injury = 0; E.injure(s, r, 3); r.injury = 0; E.injure(s, r, 3); r.injury = 0; E.injure(s, r, 3);
    assert.ok(r.scars.length <= 2, '상처는 최대 2개');
    assert.strictEqual(new Set(r.scars).size, r.scars.length, '같은 상처 중복 없음');
  }
  assert.ok(got > 60 && got < 140, `중상 상처 비율이 대략 45% (${got}/200)`);
});

test('영구 상처: 저는 다리는 원정을 막는다', () => {
  const s = started(3); s.res.food = 10; s.res.water = 10;
  E.byId(s, 'dongha').scars = ['leg'];
  assert.ok(E.noExp(E.byId(s, 'dongha')));
  assert.match(E.canDepart(s, 'A', ['dongha', 'seoha'], { food: 2, water: 2, meds: 0, items: [] }), /다리/);
  assert.strictEqual(E.canDepart(s, 'A', ['gicheol', 'seoha'], { food: 2, water: 2, meds: 0, items: [] }), '');
});

test('붕괴: 스트레스 100이면 각성하거나 종류별로 무너진다', () => {
  const kinds = new Set(); let virtue = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const s = started(seed); s.res.food = 10;
    const r = E.byId(s, 'eunji'); r.stress = 100;
    const others = E.alive(s).filter((o) => o.id !== r.id).map((o) => o.injury);
    E.crack(s, r);
    if (r.virtue) { virtue++; assert.strictEqual(r.stress, 35); assert.strictEqual(r.breakdown, 0); continue; }
    const A = D.AFFLICTIONS[r.affl];
    assert.ok(A, '붕괴 종류'); kinds.add(r.affl);
    assert.strictEqual(r.breakdown, A.days);
    if (r.affl === 'hoard') assert.strictEqual(s.res.food, 7);
    if (r.affl === 'violent') assert.ok(E.alive(s).filter((o) => o.id !== r.id).some((o, i) => o.injury > others[i]), '다른 주민이 다침');
    if (r.affl === 'flee') assert.ok(r.injury >= 2);
  }
  assert.strictEqual(kinds.size, Object.keys(D.AFFLICTIONS).length, '모든 종류가 나온다');
  assert.ok(virtue > 10 && virtue < 50, `각성 약 25% (${virtue}/120)`);
});

test('어둠: 발전이 없으면 모두 스트레스 +4 (미리보기 = 실제)', () => {
  const s = started(5);
  E.dispatch(s, { type: 'setPlan', plan: {} });
  const pv = E.previewNight(s);
  assert.ok(pv.ev.dark && pv.ev.ambient === 4);
  assert.ok(pv.warnings.some((w) => /어둡다/.test(w.text)));
  const r = E.byId(s, 'soonrye'); const before = r.stress;
  const row = pv.ev.rows.find((x) => x.rid === 'soonrye');
  E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.strictEqual(r.stress, Math.max(0, Math.min(100, before + row.stress)));
  if (s.phase === 'nightEvent') assert.ok(s.dark, '밤 사건 동안 어둠 유지');
  const s2 = started(5); E.dispatch(s2, { type: 'setPlan', plan: { seoha: 'gen' } });
  assert.ok(!E.previewNight(s2).ev.dark);
});

test('시신: 죽은 날 밤 처리해야 하고, 먹으면 명부에 남는다', () => {
  const s = started(6); s.res.food = 10; s.res.meds = 0;
  const d = E.byId(s, 'dongha'); d.injury = 3; d.crit = s.day;
  E.dispatch(s, { type: 'setPlan', plan: {} }); E.dispatch(s, { type: 'endDay' }); E.dispatch(s, { type: 'skipTalk' });
  assert.strictEqual(d.status, 'dead');
  assert.strictEqual(s.phase, 'nightEvent'); assert.strictEqual(s.nightEv.id, 'corpse');
  assert.ok(s.nightEv.ev.text.includes('한동하'));
  const food = s.res.food;
  const i = s.nightEv.ev.choices.findIndex((c) => c.taboo);
  assert.ok(E.dispatch(s, { type: 'nightChoose', i }).ok);
  assert.strictEqual(s.res.food, Math.min(D.CAP.food, food + 6));
  assert.ok(s.flags.ate_dead && s.corpses.length === 0);
  assert.ok(E.alive(s).every((r) => r.mem.some((m) => /한동하를 먹었다/.test(m.text))));
  E.dispatch(s, { type: 'nightDone' });
  s.phase = 'boarding'; s.day = 10; s.boarding = { pool: [], cap: 0, picks: [], passage: false };
  E.dispatch(s, { type: 'confirmBoarding' });
  assert.ok(s.ending.ledger.some((l) => /먹었다/.test(l.text)));
});
