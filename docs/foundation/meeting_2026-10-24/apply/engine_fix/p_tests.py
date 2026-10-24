# engine_fix: 테스트 고침·추가 (10-24 검증 A1·A2·A3·A4-5·REG). 한 번만 돌린다
import io


def load(p):
    raw = open(p, 'rb').read()
    return raw.decode('utf-8').replace('\r\n', '\n'), b'\r\n' in raw


def save(p, s, crlf):
    if crlf:
        s = s.replace('\n', '\r\n')
    open(p, 'wb').write(s.encode('utf-8'))


def rep(s, old, new, cnt=1):
    assert s.count(old) == cnt, (old[:90], s.count(old))
    return s.replace(old, new)


# ── sim.test.js ──
p = 'v4/test/sim.test.js'
s, crlf = load(p)
s = rep(s, """test('봇 아침 조사는 칸 단위: 보통(2칸)은 두 칸만, 칸마다 그 칸 물건 전부 · 부지런은 모든 칸', () => {
  const log = inspected(morning(5), 'balanced');
  const cells = Array.from(new Set(log.map(cellOf)));
  assert.strictEqual(cells.length, B.INSPECT.normal.objects, `보통 = ${B.INSPECT.normal.objects}칸 (${log.join(',')})`);
  for (const c of cells) for (const id of cellIds(c)) assert.ok(log.includes(id), `${c} 의 ${id} 도 보았다`);
  const all = inspected(morning(5), 'diligent');
  const every = Array.from(new Set(db.maps.station.objects.map((o) => `${o.x},${o.y}`)));
  assert.strictEqual(new Set(all.map(cellOf)).size, every.length, '부지런 = 승강장 모든 칸');
});""",
"""test('봇 아침 조사는 칸 단위: 보통(2칸)은 두 칸만, 칸마다 그 칸 물건 전부 · 부지런은 화면에서 닿는 모든 칸', () => {
  const log = inspected(morning(5), 'balanced');
  const cells = Array.from(new Set(log.map(cellOf)));
  assert.strictEqual(cells.length, B.INSPECT.normal.objects, `보통 = ${B.INSPECT.normal.objects}칸 (${log.join(',')})`);
  const s5 = morning(5); const reach = B.screenReach(s5, db, 'station');
  for (const c of cells) for (const id of cellIds(c)) if (reach.has(id)) assert.ok(log.includes(id), `${c} 의 ${id} 도 보았다`);
  const all = inspected(morning(5), 'diligent');
  const every = Array.from(new Set(db.maps.station.objects.filter((o) => reach.has(o.id)).map((o) => `${o.x},${o.y}`)));
  assert.strictEqual(new Set(all.map(cellOf)).size, every.length, '부지런 = 승강장에서 화면으로 닿는 모든 칸');
  assert.ok(all.every((id) => reach.has(id)), '닿지 않는 물건은 조사하지 않는다');
  B.OPT.allObjects = true;
  try { const old = inspected(morning(5), 'diligent'); assert.strictEqual(new Set(old.map(cellOf)).size, new Set(db.maps.station.objects.map((o) => `${o.x},${o.y}`)).size, '--all-objects = 옛 판단(모든 칸)'); } finally { B.OPT.allObjects = false; }
});

// (10-24 검증 A4-5) 봇은 화면에서 걸어가 Space 로 닿는 물건만 아침에 조사한다 — 규칙 자체(지도·표가 바뀌어도 같은 뜻)
test('봇 화면 닿음(screenReach): 막힌 칸·단단한 물건·잠긴 문·숨은 물건·화로', () => {
  const rows = ['#######', '#..k..#', '#.##..#', '#.....#', '#######'];
  const objs = { fire: { id: 'fire', solid: 1, states: ['lit'] }, box: { id: 'box', solid: 1, states: ['closed'] }, door: { id: 'office_door', solid: 0, states: ['locked', 'open'] },
    cup_ann: { id: 'cup_ann', solid: 0, states: ['full'] }, bowl_ann: { id: 'bowl_ann', solid: 0, states: ['full'] }, wall_cup: { id: 'wall_cup', solid: 0, states: ['full'] }, crate: { id: 'crate', solid: 1, states: ['closed'] } };
  objs.office_door = objs.door;
  const fake = { maps: { station: { rows, start: [1, 3], objects: [{ id: 'fire', x: 4, y: 3 }, { id: 'office_door', x: 3, y: 1 }, { id: 'crate', x: 1, y: 1 }, { id: 'box', x: 5, y: 1 }, { id: 'bowl_ann', x: 5, y: 3 }, { id: 'wall_cup', x: 2, y: 2 }] } },
    objects: objs, people: { ann: { id: 'ann', metFlag: 'met_ann' } }, peopleOrder: ['you', 'ann'] };
  const st = (door, annStatus, met) => ({ traces: { office_door: { st: door } }, people: { you: { id: 'you', status: 'home' }, ann: { id: 'ann', status: annStatus } }, flags: met ? { met_ann: true } : {} });
  const r1 = B.screenReach(st('locked', 'home', true), fake, 'station');
  assert.ok(!r1.has('fire'), '화로는 조사가 아니다(단계 넘김)');
  assert.ok(r1.has('crate'), '(1,1) 상자: 아래 칸 (1,2) 에서 닿는다');
  assert.ok(r1.has('box') === false, '(5,1) 상자: 잠긴 문 너머 — 닿지 않는다');
  assert.ok(r1.has('wall_cup'), '(2,2) 벽 칸 위 물건도 옆 칸에서 닿는다');
  assert.ok(r1.has('bowl_ann'), '만난 사람 그릇');
  const r2 = B.screenReach(st('open', 'home', true), fake, 'station');
  assert.ok(r2.has('box'), '문이 열리면 닿는다');
  const r3 = B.screenReach(st('open', 'home', false), fake, 'station');
  assert.ok(!r3.has('bowl_ann'), '만나기 전 사람의 그릇은 화면에 없다');
  const r4 = B.screenReach(st('open', 'away', true), fake, 'station');
  assert.ok(!r4.has('bowl_ann'), '아직 안 온(away) 사람의 그릇은 화면에 없다');
});

// 봇 닿음 규칙이 화면 game.js 와 같은지 글로 맞춰 본다 — 화면이 바꾸면 이 검사가 실패한다(그때 bots.js SCREEN_WALL·screenReach 를 같이 고친다)
test('봇 닿음 규칙 = 화면 game.js (blocked 타일·잠긴 문·단단한 물건 · 화로는 useFire · 숨은 물건)', (t) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const m = /function blocked\\(x, y, noNpc\\) \\{([\\s\\S]*?)\\n {2}\\}/.exec(src);
  if (!m) { t.skip('game.js 에 blocked() 가 없다(화면이 바꿨으면 이 검사를 맞춘다)'); return; }
  const body = m[1];
  const first = body.split('\\n').find((ln) => /return true/.test(ln) && /t === '#'/.test(ln)) || '';
  const tiles = (first.match(/t === '(.)'/g) || []).map((x) => x.slice(7, 8)).sort().join('');
  assert.strictEqual(tiles, B.SCREEN_WALL.split('').sort().join(''), `game.js blocked() 벽 타일 '${tiles}' ↔ bots.SCREEN_WALL '${B.SCREEN_WALL}'`);
  assert.ok(/t === 'k' && traceSt\\('office_door'\\) !== 'open'/.test(body), "잠긴 역무실 문 'k'");
  assert.ok(/objectsAt\\(x, y\\)\\.some\\(\\(o\\) => o\\.solid\\)/.test(body), '단단한 물건이 있는 칸은 막힘');
  assert.ok(/if \\(id === 'fire' && scene\\.map\\.id === 'station'\\)[\\s\\S]{0,200}return useFire\\(\\)/.test(src), "승강장 화로 = useFire(조사 아님) — bots.SCREEN_NOT_INSPECT.station 에 'fire'");
  assert.deepStrictEqual(B.SCREEN_NOT_INSPECT.station, ['fire']);
  for (const [id, st] of [['body_rail', 'none'], ['grave', 'none'], ['shoes_stairs', 'none'], ['notebook_dash', 'taken']]) assert.ok(src.includes(`mo.id === '${id}' && st === '${st}') hidden = true`), `숨은 물건 ${id}==${st}`);
});""")
s = rep(s, """const { T, E } = require('./helpers.js');""", """const fs = require('fs');
const { T, E } = require('./helpers.js');""")
save(p, s, crlf)

# ── karma.test.js ──
p = 'v4/test/karma.test.js'
s, crlf = load(p)
s = rep(s, """test('봇: 정책 묶음(GROUPS)은 모두 POLICIES 에 있고, 조심형에서 사람 흉내·금기 좋아함은 빠진다 · 10·11번째 성향 봇', () => {
  for (const g of Object.values(B.GROUPS)) for (const k of g) assert.ok(B.POLICIES[k], k);
  assert.ok(!B.CAREFUL.some((k) => B.POLICIES[k].pick || B.POLICIES[k].tabooBonus || B.POLICIES[k].risky));""",
"""test('봇: 정책 묶음(GROUPS)은 모두 POLICIES 에 있고, 조심형에서 사람 흉내·금기 좋아함·몸 꺼림은 빠진다 · 10·11번째 성향 봇', () => {
  for (const g of Object.values(B.GROUPS)) for (const k of g) assert.ok(B.POLICIES[k], k);
  assert.ok(!B.CAREFUL.some((k) => B.POLICIES[k].pick || B.POLICIES[k].tabooBonus || B.POLICIES[k].risky || B.POLICIES[k].bodyAverse));
  assert.ok(!B.CAREFUL.includes('selfish') && B.CAREFUL.includes('selfish_nb'), '(10-24 검증) 몸 꺼림 selfish 는 조심형이 아니다');
  assert.deepStrictEqual(B.GROUPS.selfishPlain.slice().sort(), ['selfish_nb', 'selfish_rt0']);
  assert.ok(B.GROUPS.selfishQuirk.every((k) => B.POLICIES[k].bodyAverse) && B.GROUPS.selfishPlain.every((k) => !B.POLICIES[k].bodyAverse));
  assert.deepStrictEqual(B.GROUPS.a4, ['balanced', 'lazy', 'diligent']);""")
s = rep(s, """test('봇 동점: 둘 다 경고인 갈림에서 0.2점 안쪽이면 무작위""",
"""test('봇 점수 (10-24 검증 REG): 조심형은 평범한 대안이 열려 있으면 성향 가점으로 죽음 주사위를 사지 않는다 · 끝까지 금기 정책의 남을 내미는 금기는 그대로', () => {
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
test('봇 동점: 둘 다 경고인 갈림에서 0.2점 안쪽이면 무작위""")
s = rep(s, """  const aggs = { balanced: mk({ identity: { a: 50, b: 50 } }), lazy: mk({ survived: 30, home9: 2.5, res7: 3.5 }), diligent: mk({ survived: 46, home9: 3.2, res7: 4.4 }),
    selfish: mk({ aliveD4: 100, survived: 30, topCause: { k: 'called_up', share: 55 }, identity: { a: 10, b: 90 } }), selfish_nb: mk({ survived: 35 }), selfish_rt: mk({ survived: 20 }), selfish_rt0: mk({ survived: 25 }),
    h_random: mk({ identity: { a: 30, b: 70 } }) };
  const g = S.gate(aggs, ids, ['balanced']);
  const row = (p) => g.rows.find((r) => r[0].startsWith(p));
  assert.deepStrictEqual(row('A1 이른 안전').slice(3), [true, false], '+12%p = 통과·경계 밖');
  assert.deepStrictEqual(S.gate(Object.assign({}, aggs, { selfish: Object.assign({}, aggs.selfish, { aliveD4: 96 }) }), ids, ['balanced']).rows.find((r) => r[0].startsWith('A1 이른 안전')).slice(3), [true, true], '+8%p = 통과지만 경계(31 §4 △)');
  assert.deepStrictEqual(row('A1 이기심의 값').slice(3), [true, false], '−10~−25 = 통과');
  assert.strictEqual(row('A1 이기적 4종 사인 쏠림')[3], true);""",
"""  const aggs = { balanced: mk({ identity: { a: 50, b: 50 } }), lazy: mk({ survived: 30, home9: 2.5, res7: 3.5 }), diligent: mk({ survived: 46, home9: 3.2, res7: 4.4 }),
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
  // 사인 쏠림: 사망이 SIGN_MIN_DEATHS 보다 적은 정책은 판정 안 함 — 판정할 정책이 없으면 △(경계)
  const few = S.gate(Object.assign({}, aggs, { selfish_nb: mk({ survived: 35, deaths: 3, topCause: { k: 'x', share: 100 } }), selfish_rt0: mk({ survived: 25, deaths: 5, topCause: { k: 'y', share: 100 } }) }), ids, ['balanced']).rows.find((r) => r[0].startsWith('A1 이기적 사인 쏠림'));
  assert.deepStrictEqual(few.slice(3), [true, true], few[2]);
  // A2 날마다: 조심형 합산 — 전 정책 합산이면 >0 이어도 조심형이 0 인 날이 있으면 미달 (10-24 검증 A2)
  const a2 = S.gate(Object.assign({}, aggs, { balanced: mk({ dayEvent: { 2: 1, 4: 2, 5: 9 } }), h_random: mk({ dayEvent: { 2: 5, 3: 90, 4: 5, 5: 5, 6: 5 } }) }), ids, ['balanced']).rows;
  assert.strictEqual(a2.find((r) => r[0].startsWith('A2 D2~D6'))[3], false, '균형(조심형)의 D3·D6 0 이 h_random 에 가려지지 않는다');
  assert.ok(a2.find((r) => r[0].startsWith('  참고: 같은 값'))[2].includes('전 D2 6 · D3 90'));""")
save(p, s, crlf)
print('ok')
