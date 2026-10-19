// 어두운 역 v3 — 도트 그림 (Kenney 1-Bit Pack, CC0). 16×16 타일 시트에서 잘라 색을 입혀 그린다.
(function () {
  'use strict';
  const T = 16;
  const SHEET = new Image();
  const ready = new Promise((res) => { SHEET.onload = res; SHEET.onerror = res; });
  SHEET.src = 'assets/tiles.png';

  const cache = new Map();
  // [열, 행] 타일을 color로 칠한 16×16 캔버스 (color 없으면 원래 색)
  function tile(spr, color) {
    const key = spr[0] + ',' + spr[1] + ',' + (color || '');
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = T; c.height = T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(SHEET, spr[0] * T, spr[1] * T, T, T, 0, 0, T, T);
    if (color) { g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, T, T); }
    cache.set(key, c);
    return c;
  }
  function draw(ctx, spr, x, y, color, flip) {
    if (!spr) return;
    const c = tile(spr, color);
    if (flip) { ctx.save(); ctx.translate(x + T, y); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore(); }
    else ctx.drawImage(c, x, y);
  }

  // 쓸 타일 이름표 ([열, 행])
  const SPR = {
    wall: [0, 13], wallTop: [10, 17], brickRed: [6, 13],
    stairs: [2, 6], stairsDown: [1, 11], door: [6, 9], doorOpen: [8, 9],
    fire: [14, 10], fire2: [15, 10], candle: [3, 15],
    board: [1, 7], sign: [0, 7], crate: [8, 6], chest: [9, 6], barrel: [9, 19], barrel2: [10, 19],
    bed: [5, 8], bed2: [6, 8], table: [4, 7], shelf: [3, 7], cabinet: [11, 7], machine: [12, 8], machine2: [11, 8],
    pump: [10, 10], pipeV: [13, 3], rubble: [2, 11], rubble2: [1, 11], bones: [32, 12], skull: [36, 11], web: [2, 15],
    plant: [15, 6], mush: [17, 6], cross: [12, 14], grave: [1, 14],
    mark: [35, 13], ask: [37, 13], heart: [38, 10],
    // 사람
    player: [25, 0],
    soonrye: [26, 1], seoha: [30, 4], gicheol: [26, 4], eunji: [24, 4], dongha: [27, 3], mari: [30, 1],
    eunchae: [24, 2], dohyeon: [25, 4],
    // 크리처
    rat: [31, 8], ghost: [27, 8], shade: [24, 8], bat: [26, 8], snake: [28, 8], spider: [25, 5], octo: [25, 8], skel: [29, 6], hooded: [24, 6],
  };
  // 사람마다 옷 색
  const TINT = {
    player: '#e8dcc0', soonrye: '#b9b2a6', seoha: '#9fb7d6', gicheol: '#d39a5b', eunji: '#d68fa0', dongha: '#9bc28a', mari: '#e6e6e6',
    eunchae: '#c7b3e6', dohyeon: '#8fa7a0',
  };
  window.SP = { T, SHEET, ready, tile, draw, SPR, TINT };
})();
