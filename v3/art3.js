// 어두운 역 v3 — 직접 그리는 도트 (외부 그림 없음). 한 벌의 어두운 팔레트, 자동 명암·외곽선.
// 사람 16×24, 크리처 32×32, 타일 16×16. 모두 캔버스로 만들어 캐시한다.
(function () {
  'use strict';
  const T = 16;
  // 팔레트: 이름 → [어둠, 바탕, 밝음]
  const RAMP = {
    ink: ['#050404', '#0a0807', '#14100e'],
    soot: ['#120e0c', '#1c1613', '#2a221d'],
    stone: ['#231d19', '#352d28', '#4a3f38'],
    ash: ['#3e3631', '#5b5049', '#7d7067'],
    bone: ['#8f8170', '#c4b49c', '#ece0c8'],
    blood: ['#3a0709', '#6e1014', '#9c1e1e'],
    rust: ['#4a1f12', '#7d3a1e', '#b0592c'],
    gold: ['#5e4516', '#9a7428', '#d0a24a'],
    sea: ['#0d171c', '#1b2d36', '#2f4b57'],
    cold: ['#2e434c', '#4f6f7a', '#86a3a8'],
    moss: ['#1c2416', '#2f3b22', '#4c5c33'],
    rot: ['#3a3a1e', '#5d5c2c', '#8a8642'],
    skin: ['#6e4232', '#a26f55', '#cf9a7a'],
    pale: ['#6c7276', '#9ba3a5', '#c9cfcc'],
    green: ['#173a22', '#2a6b3c', '#4f9c5c'],
    navy: ['#11151f', '#1f2636', '#333d55'],
    olive: ['#262819', '#3f4228', '#5e623b'],
    wine: ['#2c0f16', '#4d1a26', '#73283a'],
    white: ['#7b7a75', '#b9b6ad', '#e5e1d6'],
    hairB: ['#0d0a09', '#1d1714', '#30261f'],
    hairG: ['#57524d', '#8a847c', '#b8b1a6'],
    hairR: ['#2a120c', '#4a2316', '#6e3a22'],
  };
  const OUT = '#050404';

  // ── 픽셀 버퍼: 칸마다 [램프 이름, 단계 0~2] ──
  function buf(w, h) {
    const px = new Array(w * h).fill(null);
    const B = {
      w, h, px,
      set(x, y, ramp, lv) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; px[y * w + x] = ramp ? [ramp, lv == null ? 1 : lv] : null; },
      get(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? null : px[y * w + x]; },
      rect(x, y, rw, rh, ramp, lv) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) B.set(x + i, y + j, ramp, lv); },
      ell(cx, cy, rx, ry, ramp, lv) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) B.set(x, y, ramp, lv); } },
      line(x0, y0, x1, y1, ramp, lv) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) B.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), ramp, lv); },
      // 왼쪽 위에서 빛: 위·왼쪽 가장자리는 밝게, 아래·오른쪽 가장자리는 어둡게 (단계 1인 칸만)
      shade() {
        const src = px.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const c = src[y * w + x]; if (!c || c[1] !== 1) continue;
          const same = (xx, yy) => { const o = xx < 0 || yy < 0 || xx >= w || yy >= h ? null : src[yy * w + xx]; return o && o[0] === c[0]; };
          if (!same(x, y - 1) || !same(x - 1, y)) px[y * w + x] = [c[0], 2];
          else if (!same(x, y + 1) || !same(x + 1, y)) px[y * w + x] = [c[0], 0];
        }
        return B;
      },
      outline() {
        const src = px.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (src[y * w + x]) continue;
          const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] && src[yy * w + xx][0] !== 'ink'; });
          if (n) px[y * w + x] = ['ink', 0];
        }
        return B;
      },
      canvas() {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); const img = g.createImageData(w, h);
        for (let i = 0; i < px.length; i++) {
          const p = px[i]; if (!p) continue;
          const hex = p[0] === '#' ? p[1] : RAMP[p[0]][p[1]];
          const n = parseInt(hex.slice(1), 16);
          img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return c;
      },
    };
    return B;
  }
  // 작은 결정적 난수
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ── 사람 (16×24) — 부위를 조합해 그린다 ──
  // o: { skin, hair, hairStyle: short|long|bun|bald|scarf, hat: cap|nurse|null, coat, coatStyle: coat|jacket|uniform|apron|overall, pants, build: slim|broad|hunched, glasses, beard, blood }
  const PEOPLE = {
    player: { skin: 'skin', hair: 'hairB', hairStyle: 'short', coat: 'soot', pants: 'ink', coatStyle: 'coat', collar: 'white', build: 'slim' },
    soonrye: { skin: 'skin', hair: 'hairG', hairStyle: 'bun', coat: 'gold', coatStyle: 'vest', inner: 'ash', pants: 'stone', build: 'hunched', glasses: true },
    seoha: { skin: 'skin', hair: 'hairB', hairStyle: 'long', coat: 'navy', coatStyle: 'uniform', collar: 'white', pants: 'navy', skirt: true, build: 'slim' },
    gicheol: { skin: 'skin', hair: 'hairB', hairStyle: 'short', hat: 'cap', hatRamp: 'navy', coat: 'olive', coatStyle: 'overall', pants: 'olive', build: 'broad', beard: true },
    eunji: { skin: 'skin', hair: 'hairR', hairStyle: 'long', coat: 'wine', coatStyle: 'apron', inner: 'bone', pants: 'stone', build: 'slim' },
    dongha: { skin: 'skin', hair: 'hairB', hairStyle: 'short', coat: 'green', coatStyle: 'jacket', pants: 'navy', build: 'broad' },
    mari: { skin: 'skin', hair: 'hairB', hairStyle: 'bun', hat: 'nurse', coat: 'white', coatStyle: 'coat', pants: 'white', build: 'slim' },
    eunchae: { skin: 'skin', hair: 'hairB', hairStyle: 'long', coat: 'white', coatStyle: 'coat', pants: 'navy', build: 'slim', glasses: true },
    dohyeon: { skin: 'skin', hair: 'hairB', hairStyle: 'short', hat: 'cap', hatRamp: 'rust', coat: 'cold', coatStyle: 'overall', pants: 'cold', build: 'broad', beard: true },
    stranger: { skin: 'pale', hair: 'hairB', hairStyle: 'long', coat: 'soot', coatStyle: 'coat', pants: 'ink', build: 'slim' },
  };
  function person(o, frame, hurt) {
    const B = buf(16, 24);
    const hunch = o.build === 'hunched' ? 1 : 0;
    const wide = o.build === 'broad' ? 1 : 0;
    const top = 2 + hunch;
    // 다리 (걷기: 두 프레임)
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    if (o.skirt) { B.rect(5, top + 14, 6, 3, o.pants); }
    B.rect(5, top + 15, 2, 5 + Math.max(0, step), o.skirt ? 'skin' : o.pants); B.rect(9, top + 15, 2, 5 + Math.max(0, -step), o.skirt ? 'skin' : o.pants);
    B.rect(4, top + 20 + Math.max(0, step), 3, 1, 'ink', 1); B.rect(9, top + 20 + Math.max(0, -step), 3, 1, 'ink', 1);
    // 몸통
    const bx = 4 - wide, bw = 8 + wide * 2;
    B.rect(bx, top + 7, bw, 9 - (o.coatStyle === 'coat' ? -1 : 0), o.coat);
    if (o.coatStyle === 'coat') { B.rect(bx, top + 15, bw, 2, o.coat); B.line(8, top + 8, 8, top + 16, o.coat, 0); }
    if (o.coatStyle === 'apron' || o.coatStyle === 'vest') { B.rect(bx + 2, top + 8, bw - 4, 8, o.inner || 'bone'); }
    if (o.coatStyle === 'overall') { B.rect(bx + 2, top + 9, bw - 4, 7, o.coat, 0); B.set(bx + 2, top + 8, 'gold', 2); B.set(bx + bw - 3, top + 8, 'gold', 2); }
    if (o.coatStyle === 'uniform') { B.rect(bx + 3, top + 7, bw - 6, 2, o.collar || 'white'); B.set(8, top + 9, 'blood', 2); B.set(7, top + 9, 'blood', 2); }
    if (o.collar && o.coatStyle === 'coat') { B.set(7, top + 7, o.collar, 2); B.set(8, top + 7, o.collar, 2); }
    // 팔과 손
    B.rect(bx - 1, top + 8, 1, 6, o.coat); B.rect(bx + bw, top + 8, 1, 6, o.coat);
    B.set(bx - 1, top + 14, o.skin, 1); B.set(bx + bw, top + 14, o.skin, 1);
    // 목·머리
    B.rect(7, top + 6, 2, 1, o.skin, 0);
    B.ell(8, top + 3.2, 3.2, 3.4, o.skin);
    // 머리카락
    const H = o.hair;
    if (o.hairStyle !== 'bald') { B.rect(5, top - 1, 6, 2, H); B.set(4, top + 1, H); B.set(11, top + 1, H); B.rect(5, top + 1, 1, 1, H); B.rect(10, top + 1, 1, 1, H); }
    if (o.hairStyle === 'long') { B.rect(4, top + 1, 1, 7, H); B.rect(11, top + 1, 1, 7, H); B.rect(5, top + 6, 1, 2, H); B.rect(10, top + 6, 1, 2, H); }
    if (o.hairStyle === 'bun') { B.ell(8, top - 1.5, 2, 1.5, H); }
    if (o.hat === 'cap') { B.rect(4, top - 1, 8, 2, o.hatRamp || 'navy'); B.rect(3, top + 1, 10, 1, o.hatRamp || 'navy', 0); }
    if (o.hat === 'nurse') { B.rect(5, top - 2, 6, 2, 'white'); B.set(8, top - 2, 'blood', 2); }
    // 얼굴
    B.set(6, top + 3, 'ink', 1); B.set(9, top + 3, 'ink', 1);
    if (o.glasses) { B.set(5, top + 3, 'gold', 0); B.set(7, top + 3, 'gold', 0); B.set(8, top + 3, 'gold', 0); B.set(10, top + 3, 'gold', 0); }
    if (o.beard) { B.rect(6, top + 5, 4, 1, 'hairB', 2); }
    B.set(7, top + 5, o.skin, 0); B.set(8, top + 5, o.skin, 0);
    B.shade().outline();
    // 상처·피 (그림자 처리 뒤에 얹는다)
    if (hurt >= 1) { B.set(6, top + 2, 'blood', 2); B.set(10, top + 10, 'blood', 1); B.set(10, top + 11, 'blood', 1); }
    if (hurt >= 2) { B.rect(5, top + 12, 3, 2, 'blood', 1); B.set(9, top + 4, 'blood', 1); B.rect(4, top + 18, 2, 1, 'blood', 0); }
    if (hurt >= 3) { B.rect(6, top + 9, 4, 4, 'blood', 0); B.set(6, top + 3, 'blood', 2); B.set(9, top + 3, 'blood', 2); }
    return B.canvas();
  }

  // ── 크리처 (32×32) ──
  const CREATURES = {
    rats(B, r) {
      for (const [cx, cy, s] of [[9, 22, 1], [20, 24, 1.1], [14, 17, 0.9], [24, 16, 0.8], [6, 14, 0.7]]) {
        B.ell(cx, cy, 5 * s, 3 * s, 'ash'); B.ell(cx + 5 * s, cy - 1, 2.5 * s, 2 * s, 'ash');
        B.line(cx - 5 * s, cy, cx - 9 * s, cy + 2 * s, 'skin', 0); B.set(cx + 6 * s, cy - 2, 'blood', 2); B.set(cx + 4 * s, cy - 3 * s, 'skin', 1);
      }
    },
    twomouth(B) {
      // 털이 빠진 분홍빛 잿빛 살갗, 진물, 아래턱에 사람 이빨이 박힌 두 번째 입
      B.ell(14, 19, 11, 7.5, 'skin', 0); B.ell(12, 17, 8, 5, 'pale');
      for (const [x, y] of [[8, 15], [12, 13], [17, 14], [6, 19]]) B.ell(x, y, 2, 1.2, 'ash');
      B.ell(25, 15, 5.5, 4.5, 'pale'); B.ell(27, 13, 1.2, 1.2, 'blood', 2); B.set(24, 12, 'blood', 2); B.set(25, 12, 'blood', 2);
      B.line(3, 21, 0, 30, 'skin', 0); B.line(2, 22, 0, 26, 'skin', 1);
      for (const [x, y] of [[10, 21], [16, 23], [19, 18]]) { B.ell(x, y, 1.5, 1, 'blood', 1); B.set(x, y + 1, 'rot', 2); }
      B.ell(24, 24, 5.5, 4, 'blood', 0); B.ell(24, 24, 4, 2.5, 'ink', 1);
      for (let x = 20; x <= 28; x += 2) { B.set(x, 22, 'bone', 2); B.set(x + 1, 26, 'bone', 2); B.set(x, 23, 'bone', 1); }
      B.rect(29, 15, 3, 1, 'blood', 1); B.set(30, 16, 'bone', 2);
      for (const x of [7, 13, 19]) { B.rect(x, 25, 2, 4, 'skin', 0); B.set(x - 1, 29, 'bone', 1); }
    },
    drowned(B) {
      // 물에 불어 터질 듯한 몸, 얼굴을 덮은 젖은 머리칼, 아래로 벌어진 검은 입, 무릎까지 늘어진 팔
      B.ell(16, 20, 10, 10, 'pale'); B.ell(16, 19, 6, 5, 'rot', 0);
      B.ell(15, 7, 5.5, 6, 'pale');
      B.rect(9, 2, 13, 3, 'hairB'); for (const x of [9, 11, 13, 18, 20, 21]) B.line(x, 3, x + (x < 15 ? -1 : 1), 14 + (x % 3), 'hairB');
      B.ell(15, 10, 2, 3.5, 'ink', 1); B.set(15, 13, 'sea', 2); B.set(14, 14, 'sea', 2);
      B.set(12, 7, 'ink', 1); B.set(18, 7, 'ink', 1);
      B.line(7, 14, 3, 27, 'pale'); B.line(6, 14, 2, 27, 'pale', 0); B.line(25, 14, 29, 27, 'pale'); B.line(26, 14, 30, 27, 'pale', 0);
      B.set(3, 28, 'pale', 2); B.set(29, 28, 'pale', 2); B.set(2, 28, 'ink', 1);
      B.rect(10, 28, 4, 4, 'pale', 0); B.rect(18, 28, 4, 4, 'pale', 0);
      for (const [x, y] of [[11, 22], [20, 24], [17, 16], [9, 18]]) B.ell(x, y, 1.6, 1, 'moss', 1);
      for (const [x, y] of [[14, 25], [22, 19]]) { B.set(x, y, 'sea', 2); B.set(x, y + 1, 'sea', 1); }
      B.line(12, 22, 20, 22, 'rot', 2);
    },
    bonepicker(B) {
      B.ell(15, 19, 10, 11, 'soot'); B.ell(14, 8, 5, 5, 'soot'); B.ell(14, 9, 3, 3, 'skin', 0);
      B.set(13, 9, 'gold', 2); B.set(16, 9, 'ink', 1); B.rect(13, 11, 3, 1, 'bone', 1);
      B.ell(25, 22, 6, 7, 'olive'); for (const [x, y] of [[23, 17], [26, 18], [24, 20], [28, 21], [22, 23]]) { B.rect(x, y, 3, 1, 'bone', 2); B.set(x, y - 1, 'bone', 2); }
      B.line(6, 15, 3, 23, 'soot'); B.line(3, 23, 5, 26, 'ash', 2); B.line(4, 23, 7, 25, 'ash', 2);
      B.rect(9, 29, 4, 2, 'ink', 1); B.rect(17, 29, 4, 2, 'ink', 1);
    },
  };
  function creature(id) {
    const B = buf(32, 32);
    CREATURES[id](B);
    B.shade().outline();
    return B.canvas();
  }

  // ── 타일 (16×16) — 절차 질감, 변형 4가지 ──
  function noiseTile(seed, base, opts) {
    const R = rng(seed); const B = buf(T, T);
    B.rect(0, 0, T, T, base, 1);
    for (let i = 0; i < 26; i++) B.set(R() * T, R() * T, base, R() < 0.5 ? 0 : 2);
    if (opts && opts.grout) { for (let i = 0; i < T; i++) { B.set(i, 0, base, 0); B.set(0, i, base, 0); B.set(i, 8, base, 0); B.set(8, i, base, 0); } }
    if (opts && opts.crack && R() < 0.5) { let x = R() * T, y = R() * T; for (let i = 0; i < 7; i++) { B.set(x, y, 'ink', 2); x += R() < 0.5 ? 1 : 0; y += 1; } }
    if (opts && opts.grime && R() < 0.4) B.ell(R() * T, R() * T, 2 + R() * 2, 1.5, opts.grime, 0);
    return B.canvas();
  }
  const TILES = {
    floor: (v) => noiseTile(11 + v, 'stone', { grout: true, crack: true, grime: 'soot' }),
    concourse: (v) => noiseTile(21 + v, 'soot', { grout: true, crack: true, grime: 'ink' }),
    wall: (v) => {
      const R = rng(31 + v); const B = buf(T, T);
      B.rect(0, 0, T, T, 'ash', 1);
      for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) { B.rect(x, y, 4, 1, 'ash', 0); B.rect(x, y, 1, 4, 'ash', 0); if (R() < 0.18) B.rect(x + 1, y + 1, 3, 3, 'stone', 1); }
      B.rect(0, 12, T, 4, 'soot', 1);
      if (R() < 0.5) B.line(R() * T, 0, R() * T, 11, 'rot', 0);
      if (R() < 0.3) B.rect(R() * 10, 6, 3, 5, 'blood', 0);
      return B.canvas();
    },
    edge: () => { const B = buf(T, T); B.rect(0, 0, T, T, 'stone', 1); B.rect(0, 10, T, 4, 'gold', 1); for (let x = 1; x < T; x += 3) { B.set(x, 11, 'gold', 2); B.set(x + 1, 12, 'gold', 0); } B.rect(0, 14, T, 2, 'ink', 1); return B.canvas(); },
    track: (v) => {
      const R = rng(41 + v); const B = buf(T, T);
      B.rect(0, 0, T, T, 'soot', 1);
      for (let i = 0; i < 40; i++) B.set(R() * T, R() * T, R() < 0.5 ? 'stone' : 'ash', R() < 0.5 ? 0 : 1);
      for (let x = 2; x < T; x += 6) B.rect(x, 1, 3, 14, 'rust', 0);
      B.rect(0, 3, T, 2, 'ash', 2); B.rect(0, 11, T, 2, 'ash', 2); B.rect(0, 5, T, 1, 'ink', 1); B.rect(0, 13, T, 1, 'ink', 1);
      return B.canvas();
    },
    water: (v) => { const R = rng(51 + v); const B = buf(T, T); B.rect(0, 0, T, T, 'sea', 1); for (let i = 0; i < 5; i++) { const x = R() * 12, y = R() * T; B.rect(x, y, 3 + R() * 3, 1, 'sea', 2); } return B.canvas(); },
    shutter: (v) => { const B = buf(T, T); B.rect(0, 0, T, T, 'ash', 0); for (let y = 0; y < T; y += 2) B.rect(0, y, T, 1, 'ash', 1); if (v % 2) B.rect(3, 4, 4, 6, 'rust', 1); return B.canvas(); },
    pipe: (v) => { const B = buf(T, T); B.rect(0, 0, T, T, 'sea', 0); B.rect(0, 2, T, 5, 'cold', 1); B.rect(0, 9, T, 5, 'cold', 1); B.rect(0, 3, T, 1, 'cold', 2); B.rect(0, 10, T, 1, 'cold', 2); if (v % 2) B.rect(6, 6, 3, 9, 'rust', 1); return B.canvas(); },
    drainFloor: (v) => noiseTile(61 + v, 'sea', { grout: false, crack: true, grime: 'moss' }),
    marketFloor: (v) => noiseTile(71 + v, 'stone', { grout: true, crack: true, grime: 'blood' }),
  };
  const tileCache = new Map();
  function tile(kind, x, y) {
    const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const key = kind + (v % 4);
    if (!tileCache.has(key)) tileCache.set(key, TILES[kind](v % 4));
    return tileCache.get(key);
  }

  // ── 소품 (16×16 또는 16×32) ──
  const PROPS = {
    drum(B) { B.rect(3, 6, 10, 10, 'rust'); B.rect(3, 9, 10, 1, 'rust', 0); B.rect(3, 13, 10, 1, 'rust', 0); B.rect(4, 5, 8, 1, 'ink', 1); },
    board(B) { B.rect(1, 2, 14, 10, 'rust', 0); B.rect(2, 3, 12, 8, 'gold', 0); B.rect(3, 4, 4, 3, 'bone'); B.rect(8, 4, 5, 2, 'bone'); B.rect(8, 7, 4, 3, 'white'); B.set(4, 8, 'blood', 2); B.rect(3, 12, 1, 4, 'rust', 0); B.rect(12, 12, 1, 4, 'rust', 0); },
    generator(B) { B.rect(1, 5, 14, 10, 'olive'); B.rect(2, 7, 5, 5, 'ink', 1); B.ell(4.5, 9.5, 2, 2, 'ash'); B.rect(9, 7, 5, 2, 'gold'); B.rect(9, 10, 2, 2, 'blood', 2); B.rect(12, 2, 2, 3, 'ash'); },
    tank(B) { B.ell(8, 9, 6, 7, 'cold'); B.rect(2, 9, 12, 6, 'cold'); B.rect(6, 1, 4, 2, 'ash'); B.rect(12, 10, 3, 1, 'ash', 2); B.rect(3, 12, 10, 1, 'rust', 0); },
    pump(B) { B.rect(4, 6, 8, 9, 'cold', 0); B.rect(3, 4, 10, 2, 'ash'); B.ell(8, 9, 2.5, 2.5, 'ash', 2); B.rect(12, 7, 3, 2, 'rust'); },
    crate(B) { B.rect(1, 5, 14, 10, 'rust'); B.line(1, 5, 14, 14, 'rust', 0); B.line(14, 5, 1, 14, 'rust', 0); B.rect(1, 5, 14, 1, 'rust', 2); },
    sack(B) { B.ell(8, 11, 6, 5, 'olive'); B.rect(6, 4, 4, 3, 'olive', 0); B.set(7, 9, 'bone', 2); },
    bed(B) { B.rect(1, 6, 14, 8, 'olive'); B.rect(1, 6, 4, 8, 'bone', 0); B.rect(6, 7, 8, 6, 'wine', 0); B.set(10, 9, 'blood', 1); B.set(11, 10, 'blood', 1); },
    rubble(B) { B.ell(5, 12, 5, 4, 'ash'); B.ell(11, 11, 5, 5, 'stone'); B.ell(8, 7, 4, 3, 'ash'); B.line(2, 4, 13, 9, 'rust', 1); B.set(12, 13, 'bone', 2); },
    turnstile(B) { B.rect(2, 4, 4, 11, 'ash'); B.rect(10, 4, 4, 11, 'ash'); B.rect(6, 8, 4, 1, 'gold', 2); B.rect(3, 5, 2, 2, 'green', 2); },
    pillar(B) { B.rect(4, 0, 8, 16, 'ash'); B.rect(4, 0, 2, 16, 'ash', 2); B.rect(3, 13, 10, 3, 'stone'); B.rect(5, 6, 6, 2, 'green', 1); },
    grave(B) { B.rect(5, 6, 6, 9, 'stone'); B.ell(8, 6, 3, 3, 'stone'); B.rect(7, 7, 2, 5, 'bone', 0); B.rect(6, 8, 4, 1, 'bone', 0); B.rect(2, 14, 12, 2, 'soot'); },
    bones(B) { B.ell(6, 11, 2.5, 2, 'bone'); B.set(5, 11, 'ink', 1); B.set(7, 11, 'ink', 1); B.line(9, 12, 14, 10, 'bone'); B.line(3, 14, 10, 15, 'bone'); },
    corpse(B) { B.rect(2, 9, 11, 4, 'soot'); B.ell(13, 10, 2.5, 2.5, 'pale'); B.rect(4, 13, 6, 2, 'blood', 0); B.set(13, 10, 'ink', 1); },
    stairsUp(B) { for (let i = 0; i < 5; i++) B.rect(1 + i, 13 - i * 3, 14 - i * 2, 3, 'ash', i % 2 ? 1 : 2); B.rect(0, 0, 16, 2, 'ink', 1); },
    stairsDown(B) { B.rect(0, 0, 16, 16, 'ink', 1); for (let i = 0; i < 5; i++) B.rect(1 + i, 1 + i * 3, 14 - i * 2, 2, 'stone', i % 2 ? 1 : 2); },
    lamp(B) { B.rect(7, 0, 2, 5, 'ink', 1); B.ell(8, 7, 3, 2.5, 'gold', 2); },
    mark(B) { B.rect(7, 2, 2, 8, 'gold', 2); B.rect(7, 12, 2, 2, 'gold', 2); },
    blood(B) { const R = rng(9); B.ell(8, 9, 5, 3, 'blood', 0); for (let i = 0; i < 6; i++) B.set(2 + R() * 12, 5 + R() * 8, 'blood', 1); },
    mush(B) { for (const [x, y] of [[4, 10], [9, 8], [12, 11]]) { B.ell(x, y, 2.5, 1.5, 'rot', 2); B.rect(x - 0.5, y + 1, 1, 3, 'bone'); } },
    lever(B) { B.rect(4, 2, 8, 12, 'blood', 0); B.rect(5, 3, 6, 10, 'ash', 0); B.rect(7, 4, 2, 7, 'gold', 2); B.ell(8, 4, 2, 1.5, 'blood', 2); },
    seat(B) { B.rect(0, 3, 16, 10, 'green', 0); B.rect(0, 3, 16, 3, 'green', 1); B.rect(0, 13, 16, 3, 'ash', 0); },
    door(B) { B.rect(1, 0, 14, 16, 'ash', 1); B.rect(3, 2, 4, 7, 'sea', 2); B.rect(9, 2, 4, 7, 'sea', 2); B.rect(7, 0, 2, 16, 'ink', 1); },
    cross(B) { B.rect(6, 3, 4, 11, 'white'); B.rect(3, 6, 10, 4, 'white'); B.rect(7, 4, 2, 9, 'blood', 2); B.rect(4, 7, 8, 2, 'blood', 2); },
  };
  const propCache = new Map();
  function prop(id) {
    if (!propCache.has(id)) { const B = buf(16, 16); PROPS[id](B); if (id !== 'blood') B.shade().outline(); propCache.set(id, B.canvas()); }
    return propCache.get(id);
  }
  // 불꽃 (프레임마다 다름)
  function flame(frame) {
    const R = rng(77 + frame * 13); const B = buf(16, 16);
    // 아래는 넓고 위로 갈수록 가늘다: 바깥 녹빛 → 금빛 → 뼈빛 심지
    for (let x = 3; x <= 12; x++) {
      const mid = 1 - Math.abs(x - 7.5) / 5;
      const hgt = Math.round(3 + mid * 9 + (R() - 0.5) * 3);
      for (let k = 0; k < hgt; k++) { const y = 15 - k; const f = k / hgt; B.set(x, y, f > 0.75 ? 'blood' : f > 0.45 ? 'rust' : 'gold', f > 0.75 ? 1 : 2); }
    }
    for (let k = 0; k < 4; k++) B.set(6 + R() * 4, 12 - k, 'bone', 2);
    for (let i = 0; i < 3; i++) B.set(4 + R() * 8, R() * 4, 'gold', 2);
    return B.canvas();
  }
  const personCache = new Map();
  function personSprite(id, frame, hurt) {
    const key = id + ':' + (frame || 0) + ':' + (hurt || 0);
    if (!personCache.has(key)) personCache.set(key, person(PEOPLE[id] || PEOPLE.stranger, frame || 0, hurt || 0));
    return personCache.get(key);
  }
  const creatureCache = new Map();
  function creatureSprite(id) { if (!creatureCache.has(id)) creatureCache.set(id, creature(id)); return creatureCache.get(id); }
  // 초상: 사람 그림의 윗부분을 크게
  function portrait(id, hurt) {
    const src = personSprite(id, 0, hurt);
    const c = document.createElement('canvas'); c.width = 16; c.height = 14;
    c.getContext('2d').drawImage(src, 0, 0, 16, 14, 0, 0, 16, 14);
    return c;
  }

  // ── 32px 시대: Codex가 그린 그림(img/…)이 있으면 그것을, 없으면 위의 코드 그림을 2배로 ──
  const S = 2, TT = T * S;
  const up = (c) => { const o = document.createElement('canvas'); o.width = c.width * S; o.height = c.height * S; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, o.width, o.height); return o; };
  const IMG = {};                           // 'sprites/gicheol' → Image
  const ready = fetch('img/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list) => Promise.all(list.map((name) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[name] = im; res(); }; im.onerror = () => res(); im.src = 'img/' + name + '.png';
  }))));
  const toCanvas = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c; };
  const big = new Map();
  const once = (key, make) => { if (!big.has(key)) big.set(key, make()); return big.get(key); };
  function tile2(kind, x, y) {
    const v = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;
    const name = IMG['tiles/' + kind + '_' + v] ? 'tiles/' + kind + '_' + v : IMG['tiles/' + kind + '_0'] ? 'tiles/' + kind + '_0' : null;
    return once('t:' + kind + ':' + v + ':' + !!name, () => (name ? toCanvas(IMG[name]) : up(tile(kind, x, y))));
  }
  function prop2(id) { return once('p:' + id, () => (IMG['props/' + id] ? toCanvas(IMG['props/' + id]) : up(prop(id)))); }
  function flame2(frame) { return once('f:' + frame, () => up(flame(frame))); }
  // 사람 32×48: 걷기는 1px 출렁임, 부상은 피를 덧그림
  // dir: down|left|right|up — 걷기 묶음(walk/…: 3열 왼발·섬·오른발 × 4행 아래·왼·오른·위)이 있으면 방향별 그림
  const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
  function person2(id, frame, hurt, dir) {
    const walk = IMG['walk/' + id];
    return once('h:' + id + ':' + (frame || 0) + ':' + (hurt || 0) + ':' + (walk ? dir || 'down' : ''), () => {
      const im = IMG['sprites/' + id];
      if (!im && !walk) return up(personSprite(id, frame, hurt));
      const c = document.createElement('canvas'); c.width = 32; c.height = 48;
      const g = c.getContext('2d');
      if (walk) { const col = frame === 1 ? 0 : frame === 2 ? 2 : 1; g.drawImage(walk, col * 32, (DIR_ROW[dir] || 0) * 48, 32, 48, 0, 0, 32, 48); }
      else g.drawImage(im, 0, frame ? (frame === 1 ? -1 : 0) : 0);
      if (hurt) {
        g.globalCompositeOperation = 'source-atop';
        const R = rng(7 + hurt * 31 + id.length);
        g.fillStyle = hurt >= 3 ? 'rgba(110,16,20,0.85)' : 'rgba(110,16,20,0.7)';
        for (let i = 0; i < hurt * 5; i++) g.fillRect(6 + R() * 20, 8 + R() * 32, 2 + R() * 3, 2 + R() * 4);
        g.globalCompositeOperation = 'source-over';
      }
      return c;
    });
  }
  function creature2(id) { return once('c:' + id, () => (IMG['creatures/' + id] ? toCanvas(IMG['creatures/' + id]) : up(creatureSprite(id)))); }
  // 중상 이상이면 다친 얼굴 (portraits_hurt/…)
  function portrait2(id, hurt) {
    const h = hurt >= 2 && IMG['portraits_hurt/' + id] ? 'portraits_hurt/' + id : 'portraits/' + id;
    return once('o:' + h, () => (IMG[h] ? toCanvas(IMG[h]) : up(up(portrait(id, hurt)))));
  }
  const has = (name) => !!IMG[name];

  window.ART = { T: TT, PH: 48, RAMP, tile: tile2, prop: prop2, flame: flame2, personSprite: person2, creatureSprite: creature2, portrait: portrait2, PEOPLE, ready, has,
    raw: { tile, prop, flame, personSprite, creatureSprite, portrait } };
})();
