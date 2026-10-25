// node --test v4/test — 봇 아침 조사 칸 단위 · 재측정 집계 (2026-10-24 회의 P0-E2)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { T, E } = require('./helpers.js');
const B = require('../sim/bots.js');
const S = require('../sim/stats.js');

const db = T.loadDir(path.join(__dirname, '..', 'data'));
// 아침(trace) 단계의 판을 만든다: 흔적은 첫 상태, 만난 사람 깃발은 다 선 것으로
function morning(seed) {
  const s = E.newGame(db, seed || 1);
  s.day = 1; s.phase = 'trace'; s.phaseSeen = []; s.pending = null;
  for (const p of db.peopleOrder) { const f = db.people[p].metFlag; if (f) s.flags[f] = true; if (s.people[p].status === 'away') s.people[p].status = 'home'; }
  s.flags.arrived = true;
  return s;
}
// 아침 조사 동안 inspect 한 물건 id (차례대로) — 아침을 끝내는 화로(FIRE_ON_ADVANCE, 조사 칸 수에 안 듦)는 빼고, 마지막에 봤는지 따로 돌려준다
let lastFire = null;
function inspected(s, pol) {
  const raw = E.dispatch, log = [];
  E.dispatch = (st, a, d) => { if (a && a.type === 'inspect' && st.phase === 'trace') log.push(a.object); return raw(st, a, d); };
  try { B.morningInspect(s, db, B.POLICIES[pol], { choices: 0, trips: 0, known: {}, hunger: [], d3: null }); } finally { E.dispatch = raw; }
  lastFire = B.FIRE_ON_ADVANCE && log[log.length - 1] === 'fire';
  return lastFire ? log.slice(0, -1) : log;
}
const cellOf = (id) => { const o = db.maps.station.objects.find((x) => x.id === id); return o ? `${o.x},${o.y}` : null; };
const cellIds = (key) => db.maps.station.objects.filter((o) => `${o.x},${o.y}` === key).map((o) => o.id);

test('봇 아침 조사는 칸 단위: 게으름(1칸)이 바뀐 흔적이 있는 머리맡 묶음 칸을 고르면 그 칸 물건 전부를 본다', () => {
  const s = morning(3);
  const bundle = cellOf('bottle_mari');
  assert.ok(cellIds(bundle).length >= 2, `마리 머리맡 (${bundle}) 에 물건이 여럿 (P0-D2)`);
  s.traces.bottle_mari.st = 'empty';                         // 밤에 빈 물통 = 바뀐 흔적(봇이 아는 모습은 첫 상태 full)
  const log = inspected(s, 'lazy');
  assert.deepStrictEqual(log, cellIds(bundle).filter((id) => s.traces[id]), '그 칸 물건 전부, 다른 칸은 없음');
  assert.strictEqual(lastFire, B.FIRE_ON_ADVANCE, '아침을 끝낼 때 화로를 본다(게으름도 — 화면에서 아침을 떠나는 길이 화로뿐)');
});

test('봇 아침 조사는 칸 단위: 보통(2칸)은 두 칸만, 칸마다 그 칸 물건 전부 · 부지런은 화면에서 닿는 모든 칸', () => {
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
  const rows = ['########', '#..k..##', '#..#####', '#......#', '########'];   // 오른쪽 방(4~5,1)은 문 칸 k(3,1)로만 들어간다
  const objs = { fire: { id: 'fire', solid: 1, states: ['lit'] }, box: { id: 'box', solid: 1, states: ['closed'] }, door: { id: 'office_door', solid: 0, states: ['locked', 'open'] },
    cup_ann: { id: 'cup_ann', solid: 0, states: ['full'] }, bowl_ann: { id: 'bowl_ann', solid: 0, states: ['full'] }, wall_cup: { id: 'wall_cup', solid: 0, states: ['full'] }, crate: { id: 'crate', solid: 1, states: ['closed'] } };
  objs.office_door = objs.door;
  const fake = { maps: { station: { rows, start: [1, 3], objects: [{ id: 'fire', x: 6, y: 3 }, { id: 'office_door', x: 3, y: 1 }, { id: 'crate', x: 1, y: 1 }, { id: 'box', x: 5, y: 1 }, { id: 'bowl_ann', x: 4, y: 3 }, { id: 'wall_cup', x: 3, y: 2 }] } },
    objects: objs, people: { ann: { id: 'ann', metFlag: 'met_ann' } }, peopleOrder: ['you', 'ann'] };
  const st = (door, annStatus, met) => ({ traces: { office_door: { st: door } }, people: { you: { id: 'you', status: 'home' }, ann: { id: 'ann', status: annStatus } }, flags: met ? { met_ann: true } : {} });
  const r1 = B.screenReach(st('locked', 'home', true), fake, 'station');
  assert.strictEqual(r1.has('fire'), !B.SCREEN_NOT_INSPECT.station.includes('fire'), '화로: 화면에 살필 길이 있으면 다른 물건과 같다(SCREEN_NOT_INSPECT)');
  B.SCREEN_NOT_INSPECT.station.push('fire');
  try { assert.ok(!B.screenReach(st('locked', 'home', true), fake, 'station').has('fire'), 'SCREEN_NOT_INSPECT 에 든 물건은 조사 칸이 아니다'); } finally { B.SCREEN_NOT_INSPECT.station.pop(); }
  assert.ok(r1.has('crate'), '(1,1) 상자: 옆·아래 칸에서 닿는다');
  assert.ok(r1.has('box') === false, '(5,1) 상자: 잠긴 문 너머 — 닿지 않는다');
  assert.ok(r1.has('wall_cup'), '(3,2) 벽 칸 위 물건도 옆 칸에서 닿는다');
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
  const m = /function blocked\(x, y, noNpc\) \{([\s\S]*?)\n {2}\}/.exec(src);
  if (!m) { t.skip('game.js 에 blocked() 가 없다(화면이 바꿨으면 이 검사를 맞춘다)'); return; }
  const body = m[1];
  const first = body.split('\n').find((ln) => /return true/.test(ln) && /t === '#'/.test(ln)) || '';
  const tiles = (first.match(/t === '(.)'/g) || []).map((x) => x.slice(7, 8)).sort().join('');
  assert.strictEqual(tiles, B.SCREEN_WALL.split('').sort().join(''), `game.js blocked() 벽 타일 '${tiles}' ↔ bots.SCREEN_WALL '${B.SCREEN_WALL}'`);
  assert.ok(/t === 'k' && traceSt\('office_door'\) !== 'open'/.test(body), "잠긴 역무실 문 'k'");
  assert.ok(/objectsAt\(x, y\)\.some\(\(o\) => o\.solid\)/.test(body), '단단한 물건이 있는 칸은 막힘');
  assert.ok(/if \(id === 'fire' && scene\.map\.id === 'station'\)[\s\S]{0,200}return useFire\(\)/.test(src), '승강장 화로 = useFire');
  // 화로: ① useFire 가 넘길 때 저절로 조사 → FIRE_ON_ADVANCE ② useFire 가 '살핀다'(lookFire = 조사)를 고르게 한다 → 다른 칸과 같은 조사 한 칸 ③ 둘 다 아니면 조사할 수 없는 물건
  const fire = /async function useFire\(\) \{([\s\S]*?)\n {2}\}/.exec(src);
  assert.ok(fire, 'game.js 에 useFire');
  const look = /async function lookFire\(\) \{([\s\S]*?)\n {2}\}/.exec(src);
  const auto = /type: 'inspect', object: 'fire'/.test(fire[1]);
  const lookable = !!look && /type: 'inspect', object: 'fire'/.test(look[1]) && /lookFire\(\)/.test(fire[1]);
  assert.strictEqual(B.FIRE_ON_ADVANCE, auto, "화면 useFire 가 넘길 때 저절로 엔진 inspect('fire') 를 부르는지 ↔ bots.FIRE_ON_ADVANCE");
  assert.strictEqual(B.SCREEN_NOT_INSPECT.station.includes('fire'), !auto && !lookable, "화면에서 화로를 살필 길(lookFire)이 있는지 ↔ bots.SCREEN_NOT_INSPECT.station 의 'fire'");
  for (const [id, st] of [['body_rail', 'none'], ['grave', 'none'], ['shoes_stairs', 'none'], ['notebook_dash', 'taken']]) assert.ok(src.includes(`mo.id === '${id}' && st === '${st}') hidden = true`), `숨은 물건 ${id}==${st}`);
});

test("재측정 집계: 아침 굶주림 표본·D3 셈 선택이 trace 에 남고 stats 가 평균·'함께 센다' 비율을 낸다", () => {
  const runs = [];
  for (let seed = 1; seed <= 6; seed++) {
    const { s, trace } = B.play(db, seed, 'balanced');
    assert.ok(trace.hunger.length >= 1, '아침마다 표본');
    const d3 = Object.keys(s.done).find((id) => B.D3_COUNT.test(id));
    if (d3) assert.ok(db.events[d3].choices.some((c) => c.label === trace.d3), `D3 셈 선택 = 그 사건의 선택지 (${trace.d3})`);
    else assert.strictEqual(trace.d3, null);
    runs.push(S.measure(db, s, trace));
  }
  const a = S.aggregate(db, runs);
  assert.ok(Number.isFinite(a.hunger) && a.hunger >= 0, '평균 굶주림');
  assert.ok(a.d3Reached >= 0 && a.d3Reached <= 100 && a.d3Together >= 0 && a.d3Together <= 100);
  assert.strictEqual(S.D3_TOGETHER, '함께 센다');
  for (const id of ['trial_d3_count', 'trial_d3_count_b', 'trial_d3_count_c']) if (db.events[id]) assert.ok(db.events[id].choices.some((c) => c.label === S.D3_TOGETHER), `${id} 에 '함께 센다'`);
});

// (10-25 최종판) run.js 기본 시드 블록: 5블록(1·1001·2001·3001·8001) · A4 정책은 9블록(그 다섯 + 4001~7001 — 10-24~27 의 8블록에 8001 을 더한 것)
test('run.js 기본 블록 5개 · A4 9개(첫 블록 + 1000씩 빈 시작값) · --blocks 를 주면 옛 규칙과 같다 · 보고서에 원정 수납 표 · A1 아슬함 = 화면 ≤ 85%', () => {
  const os = require('os');
  const { spawnSync } = require('child_process');
  const run = (extra) => {
    const out = path.join(os.tmpdir(), `ds4_runjs_${process.pid}_${Math.random().toString(36).slice(2)}.json`);
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'sim', 'run.js'), '1', 'balanced,lazy,diligent,selfish_nb', '--workers=1', `--json=${out}`].concat(extra), { encoding: 'utf8', timeout: 120000 });
    assert.strictEqual(r.status, 0, r.stderr);
    const j = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
    return { j, md: r.stdout };
  };
  const a = run([]);
  assert.deepStrictEqual(a.j.blocks, [1, 1001, 2001, 3001, 8001]);
  assert.deepStrictEqual(a.j.a4Blocks, [1, 1001, 2001, 3001, 8001, 4001, 5001, 6001, 7001]);
  assert.strictEqual(a.j.byBlock.length, 5);
  assert.ok(a.md.includes('시드 블록: 시드 1~1, 시드 1001~1001, 시드 2001~2001, 시드 3001~3001, 시드 8001~8001'));
  assert.ok(a.md.includes('### A4 (블록 9개'), 'A4 표는 9블록');
  assert.ok(a.md.includes('### 원정 수납 (P1-11'), '원정 수납 표');
  assert.ok(a.md.includes('| A1 아슬함: 화면 ≤ 85% (죽을 확률 ≥ 15%) 줄타기 넘김/판 (열흘 산 판, selfish_nb) | ≥ 2 |'), 'A1 아슬함 합격선 줄');
  assert.ok(a.md.includes('|   참고: 줄타기 판정 전부(90% 넘는 판정 포함'), '옛 값은 참고 줄');
  const b = run(['--blocks=1,1001', '--a4blocks=4']);
  assert.deepStrictEqual([b.j.blocks, b.j.a4Blocks], [[1, 1001], [1, 1001, 2001, 3001]], '--blocks 를 주면 전처럼 이어서');
  const c = run(['--seed0=2001', '--a4blocks=3']);
  assert.deepStrictEqual([c.j.blocks, c.j.a4Blocks], [[2001], [2001, 3001, 4001]]);
});
