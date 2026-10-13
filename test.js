// node --test test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('./data.js');
const E = require('./engine.js');

test('사건 데이터 무결성', () => {
  for (const [did, d] of Object.entries(D.DISTRICTS)) {
    for (const st of d.steps) if (st !== 'R') assert.ok(D.EVENTS[st], `${did}: ${st} 없음`);
    if (d.clear.unlock) assert.ok(D.DISTRICTS[d.clear.unlock], `${did}: unlock 대상 없음`);
  }
  const randoms = Object.values(D.EVENTS).filter((e) => e.random).length;
  const maxR = Math.max(...Object.values(D.DISTRICTS).map((d) => d.steps.filter((x) => x === 'R').length));
  assert.ok(randoms >= maxR, '무작위 사건 수 부족');
  for (const [id, ev] of Object.entries(D.EVENTS)) {
    assert.ok(ev.choices.length >= 2, `${id}: 선택지 2개 미만`);
    // 막다른 사건 금지: 조건 없는 선택지가 하나는 있어야 함 (비용 선택지는 제외)
    assert.ok(ev.choices.some((c) => !c.req && !c.cost), `${id}: 항상 고를 수 있는 선택지 없음`);
    for (const c of ev.choices) {
      if (c.check) {
        assert.ok(c.ok && c.fail, `${id}: 판정 결과 누락`);
        assert.ok(D.SKILLS[c.check.skill], `${id}: 잘못된 기술`);
      } else assert.ok(c.out, `${id}: 결과 누락 (${c.text})`);
      if (c.req && c.req.item) assert.ok(D.ITEMS[c.req.item], `${id}: 잘못된 도구`);
      for (const o of [c.ok, c.fail, c.out].filter(Boolean)) {
        for (const k of Object.keys(Object.assign({}, o.loot, o.pack, c.cost))) assert.ok(D.RES[k], `${id}: 잘못된 자원 ${k}`);
        if (o.ending) assert.ok(D.ENDINGS[o.ending], `${id}: 결말 없음`);
      }
    }
  }
});

test('불 → 노인 도착 → 건설 개방', () => {
  const rng = E.mulberry32(1);
  const s = E.newState();
  assert.ok(E.light(s));
  for (let i = 0; i < 25; i++) { E.tick(s, rng); if (s.fire < 3) E.stoke(s); s.res.fuel = 10; }
  assert.ok(s.flags.strangerArrived);
  for (let i = 0; i < 40; i++) { E.tick(s, rng); E.stoke(s); s.res.fuel = 10; }
  assert.ok(s.flags.builderReady);
  assert.ok(E.buildVisible(s, 'trap'));
});

test('불이 약하면 노인이 회복하지 못함', () => {
  const rng = E.mulberry32(2);
  const s = E.newState();
  E.light(s);
  s.flags.strangerArrived = true; s.builderAt = 1; s.fire = 1;
  E.tick(s, rng);
  assert.ok(!s.flags.builderReady);
});

test('건설 비용 증가와 자원 부족 차단', () => {
  const s = E.newState();
  s.flags.builderReady = true;
  s.res.scrap = 5;
  assert.deepStrictEqual(E.buildCost(s, 'trap'), { scrap: 5 });
  assert.ok(E.build(s, 'trap'));
  assert.deepStrictEqual(E.buildCost(s, 'trap'), { scrap: 7 });
  assert.ok(!E.build(s, 'trap'));
});

test('굶주림으로 생존자 이탈 및 일꾼 정리', () => {
  const rng = () => 0.1;
  const s = E.newState();
  s.pop = 3; s.buildings.trap = 1; s.workers.ratcatcher = 3; s.res.food = 0;
  s.workers.ratcatcher = 3;
  // 쥐잡이 3명 → 식량 +6, 소비 1 → 굶지 않음
  s.time = 9; E.tick(s, rng);
  assert.strictEqual(s.res.food, 5);
  s.workers.ratcatcher = 0; s.res.food = 0;
  s.time = 19; E.tick(s, rng);
  assert.strictEqual(s.pop, 2);
});

test('원정: 보급 소모, 조건 잠금, 비용, 귀환 정산', () => {
  const rng = E.mulberry32(3);
  const s = E.newState();
  s.flags.expeditions = true;
  s.districts.euljiro = { unlocked: true, cleared: false };
  s.res.food = 10; s.res.water = 10;
  assert.ok(E.canStart(s, 'euljiro', { food: 30, water: 0 }));
  assert.ok(E.startExpedition(s, 'euljiro', { food: 5, water: 5 }, rng));
  assert.strictEqual(s.res.food, 5);
  const exp = s.expedition;
  assert.strictEqual(exp.pack.food, 4); // 첫 칸 이동에 1 소모
  // eu_1 의 쇠파이프 선택지는 잠김
  const ev = D.EVENTS[exp.queue[0]];
  assert.ok(E.choiceState(s, ev.choices[1]).locked);
  assert.ok(!E.choose(s, 1, rng));
  assert.ok(E.choose(s, 2, rng)); // 돌아간다: 물 -1
  assert.strictEqual(exp.pack.water, 3);
  assert.ok(E.returnHome(s));
  assert.strictEqual(s.res.food, 9);
  assert.strictEqual(s.res.water, 8);
  assert.strictEqual(s.expedition, null);
});

test('안개 구역은 방독면 없으면 피해', () => {
  const rng = E.mulberry32(4);
  const s = E.newState();
  s.flags.expeditions = true;
  s.districts.myeongdong = { unlocked: true, cleared: false };
  s.res.food = 5; s.res.water = 5;
  E.startExpedition(s, 'myeongdong', { food: 5, water: 5 }, rng);
  assert.strictEqual(s.player.hp, 9);
  s.expedition = null; s.player.hp = 10; s.items.mask = true; s.res.food = 5; s.res.water = 5;
  E.startExpedition(s, 'myeongdong', { food: 5, water: 5 }, rng);
  assert.strictEqual(s.player.hp, 10);
});

test('체력 0이면 짐을 잃고 역으로', () => {
  const rng = () => 0.99; // 판정 실패
  const s = E.newState();
  s.flags.expeditions = true;
  s.districts.jongno = { unlocked: true, cleared: false };
  s.res.food = 5; s.res.water = 5;
  E.startExpedition(s, 'jongno', { food: 5, water: 5 }, rng);
  s.player.hp = 2;
  s.expedition.loot.scrap = 9;
  s.expedition.queue[s.expedition.index] = 'jo_2';
  E.choose(s, 0, rng); // 돌진 실패 hp -3
  assert.strictEqual(s.expedition, null);
  assert.strictEqual(s.player.hp, 3);
  assert.strictEqual(s.res.scrap, 0);
  assert.strictEqual(s.res.food, 0);
});

test('저장 데이터 정규화', () => {
  assert.strictEqual(E.normalize(null).time, 0);
  assert.strictEqual(E.normalize({ v: 999 }).time, 0);
  const s = E.newState(); s.res.scrap = 12; s.time = 50;
  const back = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(back.res.scrap, 12);
  const broken = E.normalize({ v: 1, res: { scrap: 'x' }, player: { hp: 4 } });
  assert.strictEqual(broken.res.scrap, 0);
  assert.strictEqual(broken.player.skills.obs, 1);
});

// 단순 자동 플레이로 처음부터 결말까지 도달 가능한지
function autoplay(seed, maxSec) {
  const rng = E.mulberry32(seed);
  const s = E.newState();
  const order = ['bed', 'trap', 'trap', 'cart', 'workbench', 'bed', 'farm', 'purifier', 'barricade', 'radio'];
  const crafts = ['pipe', 'flashlight', 'rope', 'mask', 'backpack'];
  E.light(s);
  let deaths = 0;
  while (s.time < maxSec && !s.ended) {
    if (s.expedition) {
      const exp = s.expedition;
      if (exp.phase === 'event') {
        if (s.player.hp <= 4) E.useMed(s);
        const ev = D.EVENTS[exp.queue[exp.index]];
        // 잠기지 않은 것 중 성공률 높은 선택(결말 사건은 첫 선택)
        let best = -1, bestScore = -1;
        ev.choices.forEach((c, i) => {
          const st = E.choiceState(s, c);
          if (st.locked) return;
          const score = st.chance == null ? 0.8 : st.chance;
          if (score > bestScore) { best = i; bestScore = score; }
        });
        const before = s.player.hp;
        E.choose(s, best, rng);
        if (!s.expedition && !s.ended && s.player.hp === 3 && before > 0) deaths += 0;
      } else {
        if (s.player.hp <= 3 && exp.index + 1 < exp.queue.length) E.returnHome(s);
        else E.proceed(s);
      }
      continue;
    }
    E.tick(s, rng);
    if (s.fire < 3) E.stoke(s);
    E.gather(s, rng);
    E.checkTraps(s, rng);
    for (const b of order) if (E.canBuild(s, b)) { E.build(s, b); break; }
    if (E.canBuild(s, 'bed') && s.pop >= E.popCap(s)) E.build(s, 'bed');
    for (const c of crafts) if (E.canCraft(s, c)) E.craft(s, c);
    // 일꾼: 식량 우선
    for (const j of ['ratcatcher', 'farmer', 'waterman', 'smith']) {
      const want = j === 'ratcatcher' ? 2 : 1;
      while (E.jobVisible(s, j) && (s.workers[j] || 0) < want && E.idle(s) > 0) E.assign(s, j, 1);
    }
    if (s.flags.expeditions && s.player.hp >= 9 && s.player.mind >= 6) {
      const target = E.districtList(s).find((id) => !s.districts[id].cleared);
      if (target) {
        const need = D.DISTRICTS[target].steps.length + 1;
        if (D.DISTRICTS[target].fog && !s.items.mask) continue;
        const pack = { food: Math.min(need, s.res.food), water: Math.min(need, s.res.water), meds: Math.min(2, s.res.meds) };
        if (pack.food >= need && pack.water >= need && !E.canStart(s, target, pack)) E.startExpedition(s, target, pack, rng);
      }
    }
  }
  return s;
}

test('자동 플레이 24회: 모두 결말 도달', () => {
  const results = [];
  for (let seed = 1; seed <= 24; seed++) {
    const s = autoplay(seed, 6 * 3600);
    results.push({ seed, ended: s.ended, min: Math.round(s.time / 60) });
  }
  const unfinished = results.filter((r) => !r.ended);
  console.log('결말 시점(분):', results.map((r) => `${r.seed}:${r.ended || '-'}@${r.min}`).join(' '));
  assert.strictEqual(unfinished.length, 0, JSON.stringify(unfinished));
});
