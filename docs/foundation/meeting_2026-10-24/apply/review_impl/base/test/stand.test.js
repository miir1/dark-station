// node --test v4/test — 서는 칸 검사 (2026-10-24 회의 P0-E2 · U5 '움직이면 머리가 잘려 보인다')
// v4/spots.js(화면 P0-S3 — 사람이 서는 자리)와 maps 표를 읽는다. 사람 그림은 48px 이라 윗칸으로 16px 올라간다.
// 그래서 서는 칸의 윗칸에 키 큰 단단한 물건(spots.TALL)이 있으면 물건이 머리에 얹힌 것처럼 보이고(화로 불꽃 = 모자),
// 같은 단계에 두 사람이 위아래로 붙으면 아랫사람의 머리·반응 꼬리표가 윗사람 몸에 겹친다.
// 검사하는 칸: 지도 7장의 start · 화로가 있는 지도의 fireStand(화로 + spots.FIRE_STAND) · 단계별 SPOTS(승강장).
// 대체 규칙: v4/spots.js 가 아직 없으면(화면 P0-S3 머지 전) 이 파일의 검사는 건너뛴다(skip) — 다른 테스트는 그대로 돈다.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { T } = require('./helpers.js');

const SPOTS_FILE = path.join(__dirname, '..', 'spots.js');
const HAS_SPOTS = fs.existsSync(SPOTS_FILE);
const SP = HAS_SPOTS ? require(SPOTS_FILE) : null;
const db = T.loadDir(path.join(__dirname, '..', 'data'));
const skip = HAS_SPOTS ? false : 'v4/spots.js 없음 (화면 P0-S3 전) — 서는 칸 검사 건너뜀';

// 지나갈 수 없는 타일: game.js blocked() 의 # t R + 화면 P0-S6 의 새 타일 h(좌석)·D(계기판)·C(선로 위 멈춘 전동차). k(역무실 문)·E(전동차 문)는 상태에 따라 열리므로 뺀다
const BLOCK_TILES = ['#', 't', 'R', 'h', 'D', 'C'];
const tile = (m, x, y) => (y >= 0 && y < m.rows.length && x >= 0 && x < m.rows[y].length ? m.rows[y][x] : null);
const objsAt = (m, x, y) => (m.objects || []).filter((o) => o.x === x && o.y === y).map((o) => o.id);
const solid = (id) => !!db.objects[id] && (db.objects[id].solid === 1 || db.objects[id].solid === true);
// 키 큰 단단한 물건: spots.TALL 에 있고 objects 표에서 solid. (TALL 이 없으면 단단한 물건 전부를 키 큰 것으로 — 더 엄격하게)
const tall = (id) => solid(id) && (!SP || !Array.isArray(SP.TALL) || SP.TALL.includes(id));

// 칸 하나의 문제 목록. who = 그 칸에 서는 사람(글에 쓸 이름), others = 같은 단계의 다른 사람 { id: [x,y] }, vertical = 아래 칸 사람도 볼지(당신 자리)
function standProblems(m, x, y, who, others, vertical) {
  const out = [];
  const t = tile(m, x, y);
  if (t === null) return [`${who} (${x},${y}) 지도 밖`];
  if (BLOCK_TILES.includes(t)) out.push(`${who} (${x},${y}) 지나갈 수 없는 타일 '${t}' 위`);
  const here = objsAt(m, x, y).filter(solid);
  if (here.length) out.push(`${who} (${x},${y}) 단단한 물건 위: ${here.join('·')}`);
  const up = objsAt(m, x, y - 1).filter(tall);
  if (up.length) out.push(`${who} (${x},${y}) 윗칸 (${x},${y - 1})에 키 큰 단단한 물건: ${up.join('·')}`);
  for (const [id, p] of Object.entries(others || {})) {
    if (!Array.isArray(p)) continue;
    if (p[0] === x && p[1] === y) out.push(`${who} (${x},${y}) 같은 칸에 ${id}`);
    if (p[0] === x && p[1] === y - 1) out.push(`${who} (${x},${y}) 윗칸에 ${id} — 위아래로 붙었다`);
    if (vertical && p[0] === x && p[1] === y + 1) out.push(`${who} (${x},${y}) 아랫칸에 ${id} — 위아래로 붙었다`);
  }
  return out;
}
const others = (spots, me) => Object.fromEntries(Object.entries(spots).filter(([id]) => id !== me));
const fireOf = (m) => (Array.isArray(m.fire) && m.fire.length === 2 && m.fire[0] >= 0 && m.fire[1] >= 0 ? m.fire : null);

test('spots.js 꼴: 단계 = phases 표의 id, 사람 = people 표의 id, 자리 = 정수 [x,y] · TALL 은 objects 표의 단단한 물건', { skip }, () => {
  const phaseIds = db.phases.map((p) => p.id);
  assert.ok(SP.SPOTS && typeof SP.SPOTS === 'object', 'SPOTS 가 있다');
  for (const [ph, spots] of Object.entries(SP.SPOTS)) {
    assert.ok(phaseIds.includes(ph), `SPOTS.${ph}: phases 표에 없는 단계`);
    for (const [id, p] of Object.entries(spots)) {
      assert.ok(db.people[id] && id !== 'you', `SPOTS.${ph}.${id}: 주민이 아니다`);
      assert.ok(Array.isArray(p) && p.length === 2 && p.every(Number.isInteger), `SPOTS.${ph}.${id}: [x,y] 정수`);
    }
  }
  assert.ok(Array.isArray(SP.FIRE_STAND) && SP.FIRE_STAND.length === 2 && SP.FIRE_STAND.every(Number.isInteger), 'FIRE_STAND = [dx,dy]');
  for (const id of SP.TALL || []) assert.ok(solid(id), `TALL ${id}: objects 표에 없거나 단단하지 않다`);
});

test('지도 7장의 start 칸: 지도 안 · 지나갈 수 있는 바닥 · 단단한 물건 없음 · 윗칸에 키 큰 단단한 물건 없음', { skip }, () => {
  const maps = Object.values(db.maps);
  assert.ok(maps.length >= 7, `지도 ${maps.length}장`);
  const bad = [];
  for (const m of maps) bad.push(...standProblems(m, m.start[0], m.start[1], `${m.id}.start`, {}, false));
  assert.deepStrictEqual(bad, []);
});

test('fireStand 칸(화로 + FIRE_STAND)과 승강장 start: 단계마다 같은 칸·윗칸·아랫칸에 다른 사람이 없다', { skip }, () => {
  const bad = [];
  const withFire = Object.values(db.maps).filter(fireOf);
  assert.ok(withFire.length >= 1, '화로가 있는 지도가 하나는 있다(승강장)');
  for (const m of withFire) {
    const f = fireOf(m);
    const fx = f[0] + SP.FIRE_STAND[0], fy = f[1] + SP.FIRE_STAND[1];
    const cells = [[`${m.id}.fireStand`, fx, fy]].concat(m.id === 'station' ? [[`${m.id}.start`, m.start[0], m.start[1]]] : []);
    for (const [name, x, y] of cells) {
      bad.push(...standProblems(m, x, y, name, {}, false));
      if (m.id === 'station') for (const [ph, spots] of Object.entries(SP.SPOTS)) bad.push(...standProblems(m, x, y, `${name}@${ph}`, spots, true).filter((s) => !/타일|단단한 물건/.test(s)));
    }
  }
  assert.deepStrictEqual(bad, []);
});

test('단계별 SPOTS 칸(승강장): 지나갈 수 있는 바닥 · 윗칸에 키 큰 단단한 물건 없음 · 같은 단계 다른 사람이 같은 칸·윗칸에 없음', { skip }, () => {
  const m = db.maps.station;
  const bad = [];
  for (const [ph, spots] of Object.entries(SP.SPOTS)) for (const [id, p] of Object.entries(spots)) bad.push(...standProblems(m, p[0], p[1], `${ph}.${id}`, others(spots, id), false));
  assert.deepStrictEqual(bad, []);
});

test('검사가 잡는다: 게시판 아래 · 위아래로 붙은 두 사람 · 화로 앞(13,11) · 좌석 타일 위 (만든 자리로 확인)', { skip }, () => {
  const m = db.maps.station;
  const board = m.objects.find((o) => o.id === 'board');
  assert.ok(board, '승강장에 게시판이 있다');
  assert.ok(standProblems(m, board.x, board.y + 1, 't', {}, false).some((s) => s.includes('키 큰 단단한 물건: board')), '게시판 바로 아래');
  assert.ok(standProblems(m, 22, 11, 'dongha', { mari: [22, 10] }, false).some((s) => s.includes('윗칸에 mari')), '마리 바로 아래 동하(옛 자리)');
  const f = fireOf(m);
  assert.ok(standProblems(m, f[0], f[1] + 1, 'you', {}, false).some((s) => s.includes('키 큰 단단한 물건: fire')), '화로 바로 아래 칸 = 불꽃이 머리에');
  const car = db.maps.car;
  const hy = car.rows.findIndex((r) => r.includes('h'));
  if (hy >= 0) assert.ok(standProblems(car, car.rows[hy].indexOf('h'), hy, 'x', {}, false).some((s) => s.includes("타일 'h'")), '전동차 좌석 타일 위');
  assert.ok(standProblems(m, 5, 9, 'you', { a: [5, 10] }, true).some((s) => s.includes('아랫칸에 a')), '당신 자리는 아랫칸 사람도 본다');
});
