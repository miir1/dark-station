// 어두운 역 v3 — 맵. 글자 한 칸 = 타일 한 칸.
// # 벽  . 바닥  , 승강장  = 승강장 끝(노란 선)  ~ 선로  w 얕은 물  d 문  S 출구 계단(시장)  T 터널(수문)  R 무너진 통로
// 원정 맵: E 나가는 곳  v 내려가는 계단  m 사건 자리
(function () {
  'use strict';
  // 설계 v5 역: 손으로 만든 한 장. 위 = 대합실(역무실·출구 계단·개찰구), 아래 = 승강장·선로.
  // t 개찰구(막힘)  k 역무실 문(D2 순례의 열쇠)  S 출구 계단(안개, D6부터 원정 C)  A 지하상가 통로(원정 A)  B 배수 터널(원정 B)  R 무너진 통로(공사)
  const STATION = {
    id: 'station',
    rows: [
      '############################',
      '#SS.#..........#...........#',
      '#S..#..........k...........#',
      '#...#..........#...........#',
      '#...############...........#',
      '#..........................#',
      'A....tt.tt.tt..............#',
      '#..........................#',
      '########dd#########dd#######',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,R',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,R',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#==========================#',
      '#~~~~~~~~~~~~~~~~~~~~~~~~~~B',
      '#~~~~~~~~~~~~~~~~~~~~~~~~~~B',
      '############################',
    ],
    start: [13, 11],
    fire: [13, 10],                       // 화로 (불빛·소리의 중심)
    train: [1, 13, 7],                    // 멈춘 전동차 x, y, 칸 수
    beds: [[16, 9], [18, 9], [20, 9], [16, 11], [18, 11], [20, 11]],
    graves: [24, 11],                     // 승강장 끝 — 죽은 사람 수만큼 돌이 는다 (3개씩 한 줄, 위로)
    facilityAt: [20, 4],                  // 시설 자리 (진료소)
    projectCrate: [26, 9],                // 통로 공사 중 자재
    passageLight: [27.5, 9.5],
    smoke: [1, 5],                        // 발전기 연기가 새어 나가는 곳 (노출)
    exitBack: { A: [1, 6], B: [26, 13] }, // 원정에서 돌아서면 서는 자리
    // 침수 수치에 따라 물이 차는 줄: [행, 침수 몇부터, 진하기]
    floodRows: [[14, 1, 1], [13, 3, 1], [11, 5, 0.6], [10, 7, 0.6]],
    // 조사할 수 있는 것 (solid: 지나갈 수 없음)
    objects: [
      { id: 'fire', x: 13, y: 10, solid: true, name: '화로' },
      { id: 'board', x: 12, y: 9, solid: true, name: '게시판' },
      { id: 'gen', x: 3, y: 9, solid: true, name: '발전기' },
      { id: 'pump', x: 21, y: 10, solid: true, name: '물탱크' },
      { id: 'drainpump', x: 22, y: 11, solid: true, name: '배수 펌프' },
      { id: 'stash', x: 8, y: 2, solid: true, name: '창고' },
      { id: 'facility', x: 20, y: 4, solid: false, name: '시설 자리' },
      { id: 'bed1', x: 16, y: 9, solid: true, name: '잠자리' }, { id: 'bed2', x: 18, y: 9, solid: true, name: '잠자리' }, { id: 'bed3', x: 20, y: 9, solid: true, name: '잠자리' },
      { id: 'bed4', x: 16, y: 11, solid: true, name: '잠자리' }, { id: 'bed5', x: 18, y: 11, solid: true, name: '잠자리' }, { id: 'bed6', x: 20, y: 11, solid: true, name: '잠자리' },
      { id: 'repair', x: 27, y: 9, solid: true, name: '무너진 통로' }, { id: 'repair2', x: 27, y: 10, solid: true, name: '무너진 통로' },
      { id: 'exitA', x: 0, y: 6, solid: false, trigger: true, name: '지하상가 통로 (시장 방면)' },
      { id: 'exitB', x: 27, y: 13, solid: false, trigger: true, name: '배수 터널 (수문 방면)' }, { id: 'exitB2', x: 27, y: 14, solid: false, trigger: true, name: '배수 터널 (수문 방면)' },
      { id: 'exitC', x: 1, y: 1, solid: true, name: '출구 계단 (안개)' }, { id: 'exitC2', x: 2, y: 1, solid: true, name: '출구 계단 (안개)' }, { id: 'exitC3', x: 1, y: 2, solid: true, name: '출구 계단 (안개)' },
      { id: 'office', x: 15, y: 2, solid: false, name: '역무실 문' },
      { id: 'chalk', x: 21, y: 0, solid: true, name: '분필 벽' },
      { id: 'train', x: 1, y: 13, w: 7, h: 2, solid: true, name: '멈춘 전동차' },
      { id: 'lamp1', x: 6, y: 10, lamp: true }, { id: 'lamp2', x: 19, y: 10, lamp: true }, { id: 'lamp3', x: 11, y: 6, lamp: true }, { id: 'lamp4', x: 22, y: 2, lamp: true },
    ],
    // 오늘 할 일마다 사람이 서는 자리 (차례대로 채움)
    spots: {
      rest: [[12, 11], [14, 11], [12, 10], [14, 10], [11, 10], [15, 10], [11, 11], [15, 11]],
      forage: [[2, 5], [3, 5]], pump: [[20, 10], [21, 11]], gen: [[4, 9]], drain: [[23, 11], [23, 10]],
      guard: [[7, 6], [10, 6]], salvage: [[8, 12], [9, 12]], build: [[19, 5], [21, 5]], buildRepair: [[26, 9], [26, 10], [25, 9], [25, 10]],
      farm: [[19, 5], [21, 5]], tend: [[17, 10], [19, 11]],
    },
  };

  // 원정 맵: 지역 × 깊이
  const DUNGEONS = {
    A1: { name: '을지로 지하상가', floor: '#2a2520', wall: '#5e4f41', rows: [
      '####################',
      '#E....#.....#......#',
      '#.....#..m..#......#',
      '#..........###..m..#',
      '#.....#............#',
      '###.###.....##.##.##',
      '#........#.........#',
      '#..m.....#....v....#',
      '#........#.........#',
      '####################',
    ], deco: [['stall', 4, 4], ['kiosk', 17, 1], ['webs', 11, 1], ['mannequin', 8, 6], ['bones', 18, 8], ['cart', 2, 8], ['hooks', 15, 6], ['shrine', 5, 1], ['vending', 18, 4]] },
    A2: { name: '지하상가 창고층', floor: '#25211c', wall: '#4f4237', rows: [
      '####################',
      '#E.......#.........#',
      '#........#..m......#',
      '#..###.......####..#',
      '#..#m#.......#..#..#',
      '#..#.#.......#..#..#',
      '#...........m......#',
      '####################',
    ], deco: [['crate', 6, 1], ['tires', 7, 1], ['bodybag', 15, 6], ['webs', 18, 1], ['backpack', 9, 5], ['slab', 2, 6], ['hooks', 11, 1]] },
    B1: { name: '배수로', floor: '#1d2428', wall: '#3f4d55', water: true, rows: [
      '####################',
      '#E.wwww#....#ww....#',
      '#..wwww#..m.#ww..m.#',
      '#...ww......#ww....#',
      '#....w.##.......w..#',
      '##.###.##.###.####.#',
      '#wwww....#.........#',
      '#wmww....#....v....#',
      '#wwww....#.........#',
      '####################',
    ], deco: [['valve', 9, 1], ['leakbarrel', 18, 6], ['ratnest', 6, 8], ['sludge', 11, 3], ['ladder', 17, 1], ['chaindoor', 12, 6]] },
    B2: { name: '수문 아래', floor: '#182024', wall: '#36444c', water: true, rows: [
      '####################',
      '#E..ww.....#ww.....#',
      '#..wwww..m.#ww..m..#',
      '#...ww.....#.......#',
      '#wwwwwwwww...wwwww.#',
      '#wwwm.wwww...wwww..#',
      '#wwwwwwww..........#',
      '####################',
    ], deco: [['bones', 18, 6], ['valve', 6, 1], ['bodybag', 17, 2], ['sludge', 8, 6], ['slab', 14, 3], ['leakbarrel', 1, 1]] },
  };

  // 역 꾸밈 (지나갈 수 없는 것은 solid)
  STATION.decor = [
    { prop: 'pillar', x: 10, y: 5, solid: true }, { prop: 'pillar', x: 17, y: 5, solid: true }, { prop: 'pillar', x: 5, y: 11, solid: true }, { prop: 'pillar', x: 24, y: 9, solid: true },
    { prop: 'turnstile', x: 5, y: 6, solid: true }, { prop: 'turnstile', x: 6, y: 6, solid: true }, { prop: 'turnstile', x: 8, y: 6, solid: true }, { prop: 'turnstile', x: 9, y: 6, solid: true }, { prop: 'turnstile', x: 11, y: 6, solid: true }, { prop: 'turnstile', x: 12, y: 6, solid: true },
    { prop: 'seat', x: 17, y: 3, solid: true }, { prop: 'seat', x: 18, y: 3, solid: true }, { prop: 'seat', x: 24, y: 3, solid: true }, { prop: 'seat', x: 25, y: 3, solid: true },
    { prop: 'vending', x: 16, y: 1, solid: true }, { prop: 'kiosk', x: 26, y: 1, solid: true }, { prop: 'tires', x: 26, y: 5, solid: true }, { prop: 'shrine', x: 3, y: 7, solid: true },
    { prop: 'crate', x: 9, y: 1, solid: true }, { prop: 'sack', x: 13, y: 1, solid: true }, { prop: 'crate', x: 13, y: 3, solid: true },
    { prop: 'blood', x: 14, y: 11 }, { prop: 'blood', x: 2, y: 3 }, { prop: 'blood', x: 20, y: 7 }, { prop: 'bones', x: 23, y: 5 }, { prop: 'corpse', x: 23, y: 14 },
    { prop: 'wheel', x: 10, y: 14 }, { prop: 'bones', x: 25, y: 14 }, { prop: 'backpack', x: 7, y: 11 }, { prop: 'webs', x: 1, y: 4 }, { prop: 'webs', x: 26, y: 7 },
    { prop: 'heel', x: 4, y: 7 }, { prop: 'phone', x: 14, y: 7 }, { prop: 'briefcase', x: 3, y: 2 }, { prop: 'shoes', x: 2, y: 1 },
  ];

  // ── 프롤로그: 멈춘 전동차 → 어두운 터널 ──
  // s 좌석(지나갈 수 없음)  D 문  o 열린 문(터널로)
  const CAR = {
    id: 'car', rows: [
      '######################',
      '#ssssss#ssssss#ssssss#',
      '#....................#',
      '#....................o',
      '#....................#',
      '#ssssss#ssssss#ssssss#',
      '######################',
    ],
    start: [3, 3],
    objects: [
      { id: 'lever', x: 20, y: 2, prop: 'lever', name: '비상 레버', pro: 0, choice: 0 },
      { id: 'bag', x: 10, y: 4, prop: 'sack', name: '좌석 밑 가방', pro: 0, choice: 1 },
      // 맨 앞 운전실 (2장)
      { id: 'radio', x: 20, y: 4, prop: 'radio', name: '운전실 무전기', pro: 1, choice: 0 },
      { id: 'medkit', x: 19, y: 4, prop: 'medkit', name: '운전실 구급함', pro: 1, choice: 1 },
    ],
    npcs: [],              // 혼자 깨어난다
  };
  const TUNNEL = {
    id: 'tunnel', rows: [
      '##############################',
      '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
      'i~~~~~~~~~~~~~~~~~~~~~~~~~~~~x',
      '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '##############################',
    ],
    start: [1, 2],
    objects: [
      { id: 'shelter', x: 9, y: 1, prop: 'crate', name: '대피 공간의 비상 상자' },
      { id: 'collapse', x: 17, y: 1, h: 3, prop: 'rubble', name: '무너진 구간', pro: 2, walk: true },
    ],
    // 무너진 잔해 앞에서 정비사 기철을 만난다 (가까이 가면 저절로)
    npcs: [{ id: 'gicheol', x: 16, y: 1 }],
    meetX: 12,
  };

  // ── 원정 던전 생성기: 같은 씨앗이면 같은 지도. 방을 흩고 통로로 잇는다 ──
  const DECO = {
    A: ['stall', 'mannequin', 'hooks', 'cart', 'kiosk', 'tires', 'shrine', 'vending', 'backpack', 'bodybag', 'webs', 'bones', 'crate', 'blood'],
    B: ['valve', 'sludge', 'ladder', 'leakbarrel', 'ratnest', 'chaindoor', 'slab', 'bodybag', 'webs', 'bones', 'blood'],
  };
  const NAMES = { A1: '을지로 지하상가', A2: '지하상가 창고층', B1: '배수로', B2: '수문 아래' };
  function genDungeon(region, depth, seed) {
    let s = (seed >>> 0) || 1;
    const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const W = 28, H = 18;
    const g = Array.from({ length: H }, () => Array(W).fill('#'));
    const rooms = [];
    for (let tries = 0; tries < 80 && rooms.length < 7; tries++) {
      const w = ri(4, 7), h = ri(3, 5), x = ri(1, W - w - 2), y = ri(1, H - h - 2);
      if (rooms.some((r) => x < r.x + r.w + 1 && r.x < x + w + 1 && y < r.y + r.h + 1 && r.y < y + h + 1)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    rooms.sort((a, b) => a.cx - b.cx);                       // 왼쪽 방부터 차례로 잇는다
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = '.';
    const dig = (x, y) => { if (g[y][x] === '#') g[y][x] = '.'; };
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      if (R() < 0.5) { for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) dig(x, a.cy); for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) dig(b.cx, y); }
      else { for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) dig(a.cx, y); for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) dig(x, b.cy); }
    }
    // 고리 하나 더 (막다른 길만 있지 않게)
    if (rooms.length > 3) { const a = rooms[0], b = rooms[rooms.length - 2]; for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) dig(x, b.cy); for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) dig(a.cx, y); }
    const used = new Set();
    const put = (r, ch) => { for (let k = 0; k < 30; k++) { const x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1); if (!used.has(x + ',' + y)) { used.add(x + ',' + y); g[y][x] = ch; return [x, y]; } } return null; };
    const entry = rooms[0];
    const e = [entry.x, entry.y]; g[e[1]][e[0]] = 'E'; used.add(e.join(',')); used.add((e[0] + 1) + ',' + e[1]);
    const far = rooms[rooms.length - 1];
    if (depth < 2) put(far, 'v');
    const others = rooms.slice(1);
    for (let k = 0; k < 3; k++) put(others[(k * 2 + 1) % others.length], 'm');
    // 물 (수문 방면): 몇 군데 웅덩이
    if (region === 'B') for (let k = 0; k < 5; k++) { const r = rooms[ri(1, rooms.length - 1)], cx = ri(r.x, r.x + r.w - 1), cy = ri(r.y, r.y + r.h - 1), rr = ri(1, 2); for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) if (g[y] && g[y][x] === '.' && Math.hypot(x - cx, y - cy) <= rr + 0.3) g[y][x] = 'w'; }
    // 꾸밈: 방 가장자리에
    const deco = [];
    for (const r of others) for (let k = 0; k < ri(1, 3); k++) {
      const x = R() < 0.5 ? r.x : r.x + r.w - 1, y = ri(r.y, r.y + r.h - 1);
      if (g[y][x] === '.' && !used.has(x + ',' + y)) { used.add(x + ',' + y); deco.push([DECO[region][ri(0, DECO[region].length - 1)], x, y]); }
    }
    return { name: NAMES[region + Math.min(2, depth)], rows: g.map((row) => row.join('')), deco, start: [e[0] + 1, e[1]] };
  }

  window.MAPS = { STATION, DUNGEONS, CAR, TUNNEL, genDungeon };
})();
