// 어두운 역 v3 — 맵. 글자 한 칸 = 타일 한 칸.
// # 벽  . 바닥  , 승강장  = 승강장 끝(노란 선)  ~ 선로  w 얕은 물  d 문  S 출구 계단(시장)  T 터널(수문)  R 무너진 통로
// 원정 맵: E 나가는 곳  v 내려가는 계단  m 사건 자리
(function () {
  'use strict';
  const STATION = {
    id: 'station',
    rows: [
      '########################',
      '#SS.....#.....#........#',
      '#.......#.....#........#',
      '#.......d.....d........#',
      '#.......#.....#........#',
      '####d########d######d###',
      '#,,,,,,,,,,,,,,,,,,,,,,R',
      '#,,,,,,,,,,,,,,,,,,,,,,R',
      '#,,,,,,,,,,,,,,,,,,,,,,#',
      '#======================#',
      '#~~~~~~~~~~~~~~~~~~~~~~T',
      '#~~~~~~~~~~~~~~~~~~~~~~T',
      '########################',
    ],
    start: [11, 8],
    // 조사할 수 있는 것 (solid: 지나갈 수 없음)
    objects: [
      { id: 'fire', x: 11, y: 7, spr: 'fire', solid: true, light: 4.5, name: '화로' },
      { id: 'board', x: 9, y: 6, spr: 'board', tint: '#c9a57a', solid: true, name: '게시판' },
      { id: 'gen', x: 4, y: 6, spr: 'machine', tint: '#9aa3a8', solid: true, name: '발전기' },
      { id: 'pump', x: 18, y: 8, spr: 'pump', tint: '#7f9fbd', solid: true, name: '물탱크' },
      { id: 'drainpump', x: 13, y: 9, spr: 'machine2', tint: '#6d8fb3', solid: true, name: '배수 펌프' },
      { id: 'stash', x: 21, y: 1, spr: 'crate', tint: '#b08a5a', solid: true, name: '창고' },
      { id: 'stash2', x: 22, y: 1, spr: 'chest', tint: '#b08a5a', solid: true, name: '창고' },
      { id: 'facility', x: 11, y: 2, spr: null, solid: false, name: '시설 자리' },
      { id: 'bed1', x: 16, y: 1, spr: 'bed', tint: '#8c7b65', solid: true, name: '잠자리' },
      { id: 'bed2', x: 18, y: 1, spr: 'bed', tint: '#8c7b65', solid: true, name: '잠자리' },
      { id: 'bed3', x: 16, y: 3, spr: 'bed2', tint: '#8c7b65', solid: true, name: '잠자리' },
      { id: 'repair', x: 23, y: 6, spr: 'rubble', tint: '#8b8172', solid: true, name: '무너진 통로' },
      { id: 'repair2', x: 23, y: 7, spr: 'rubble2', tint: '#8b8172', solid: true, name: '무너진 통로' },
      { id: 'exitA', x: 1, y: 1, spr: 'stairs', tint: '#8f8678', solid: false, trigger: true, name: '출구 계단 (시장 방면)' },
      { id: 'exitA2', x: 2, y: 1, spr: 'stairs', tint: '#8f8678', solid: false, trigger: true, name: '출구 계단 (시장 방면)' },
      { id: 'exitB', x: 23, y: 10, spr: null, solid: false, trigger: true, name: '배수 터널 (수문 방면)' },
      { id: 'exitB2', x: 23, y: 11, spr: null, solid: false, trigger: true, name: '배수 터널 (수문 방면)' },
      { id: 'train', x: 2, y: 10, w: 7, h: 2, spr: null, solid: true, name: '멈춘 전동차' },
      { id: 'lamp1', x: 6, y: 6, spr: null, lamp: true }, { id: 'lamp2', x: 16, y: 6, spr: null, lamp: true }, { id: 'lamp3', x: 11, y: 3, spr: null, lamp: true }, { id: 'lamp4', x: 19, y: 2, spr: null, lamp: true },
    ],
    // 오늘 할 일마다 사람이 서는 자리 (차례대로 채움)
    spots: {
      rest: [[10, 6], [12, 6], [10, 8], [12, 8], [11, 6], [13, 7], [9, 7], [13, 8]],
      forage: [[3, 2], [5, 2]], pump: [[17, 7], [19, 7]], gen: [[5, 7]], drain: [[12, 9], [14, 9]],
      guard: [[2, 3], [4, 3]], salvage: [[6, 9], [8, 9]], build: [[10, 2], [12, 2], [10, 3], [12, 3]], buildRepair: [[22, 6], [22, 7], [21, 6], [21, 7]],
      farm: [[10, 2], [12, 2]], tend: [[17, 2], [19, 3]],
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
    { prop: 'pillar', x: 7, y: 6, solid: true }, { prop: 'pillar', x: 16, y: 6, solid: true },
    { prop: 'turnstile', x: 4, y: 3, solid: true }, { prop: 'turnstile', x: 5, y: 3, solid: true }, { prop: 'turnstile', x: 7, y: 3, solid: true },
    { prop: 'blood', x: 14, y: 8 }, { prop: 'blood', x: 3, y: 2 }, { prop: 'bones', x: 21, y: 4 }, { prop: 'corpse', x: 20, y: 11 },
    { prop: 'sack', x: 22, y: 2, solid: true }, { prop: 'crate', x: 20, y: 1, solid: true },
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
    ],
    // 승객들: 프롤로그 2장에서 말을 걸면 선택이 된다
    npcs: [
      { id: 'gicheol', x: 16, y: 2, choice: 0, line: '박기철: “앞쪽이 을지로입구역이오. 걸어서 십 분.”' },
      { id: 'soonrye', x: 17, y: 4, choice: 1, line: '김순례가 떨리는 손으로 손잡이를 붙잡고 있다.' },
      { id: 'mari', x: 18, y: 3, choice: 2, line: '정마리: “다친 사람 있어요? 붕대는 조금 있어요.”' },
      { id: 'seoha', x: 15, y: 4, line: '윤서하가 꺼진 휴대폰 화면만 들여다본다. “신호가 안 잡혀요.”' },
      { id: 'eunji', x: 14, y: 2, line: '최은지: “시장 사람들은 이런 거 익숙해요. …아마도요.”' },
      { id: 'dongha', x: 13, y: 3, line: '한동하가 은지 곁을 떠나지 않는다. “짐은 제가 들게요.”' },
    ],
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
      { id: 'shelter', x: 9, y: 1, prop: 'crate', name: '대피 공간의 비상 상자', pro: 2, choice: 1 },
      { id: 'collapse', x: 17, y: 1, h: 3, prop: 'rubble', name: '무너진 구간', pro: 2, choice: 2, walk: true },
    ],
    npcs: [{ id: 'gicheol', x: 3, y: 1, choice: 0, line: '' }],
  };

  window.MAPS = { STATION, DUNGEONS, CAR, TUNNEL };
})();
