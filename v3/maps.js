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
    ], deco: [['crate', 4, 4, '#8c6d4a'], ['barrel', 17, 1, '#9b4a3a'], ['web', 11, 1, '#777'], ['shelf', 8, 6, '#7a6650'], ['skull', 18, 8, '#bbb']] },
    A2: { name: '지하상가 창고층', floor: '#25211c', wall: '#4f4237', rows: [
      '####################',
      '#E.......#.........#',
      '#........#..m......#',
      '#..###.......####..#',
      '#..#m#.......#..#..#',
      '#..#.#.......#..#..#',
      '#...........m......#',
      '####################',
    ], deco: [['crate', 6, 1, '#8c6d4a'], ['crate', 7, 1, '#8c6d4a'], ['bones', 15, 6, '#ccc'], ['web', 18, 1, '#777']] },
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
    ], deco: [['pipeV', 9, 1, '#6d7a82'], ['barrel2', 18, 6, '#4a6a5a'], ['bones', 6, 8, '#bbb']] },
    B2: { name: '수문 아래', floor: '#182024', wall: '#36444c', water: true, rows: [
      '####################',
      '#E..ww.....#ww.....#',
      '#..wwww..m.#ww..m..#',
      '#...ww.....#.......#',
      '#wwwwwwwww...wwwww.#',
      '#wwwm.wwww...wwww..#',
      '#wwwwwwww..........#',
      '####################',
    ], deco: [['skull', 18, 6, '#ccc'], ['pipeV', 6, 1, '#6d7a82']] },
  };

  window.MAPS = { STATION, DUNGEONS };
})();
