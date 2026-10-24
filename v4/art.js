// 어두운 역 v4 — 그림. 새 그림(img/, 목록 = img/manifest.json)을 먼저 보고, 없으면 프로토타입 자산(../v3/img, 읽기만), 그래도 없으면 자리표시.
// 타일 32, 사람 32×48(걷기 묶음 3열×4행 — v4/img/walk 가 있으면 그것, 칸 크기는 시트에서 계산), 소품 32×32, 자세 앉기 32×32·눕기 48×24,
// 반응 아이콘(꼬리표 안 ≤9px), 초상 80(v4 portraits80, 없으면 v3 96 — 귀 패치), 장면 384×216(선택 창에서는 v4 cg_s 256×144).
// 목록은 python v4/tools/manifest.py 가 만든다 (그림을 넣고 그것만 다시 돌리면 화면이 잡는다. 없는 파일을 찔러 보지 않으므로 콘솔 404 가 없다).
(function () {
  'use strict';
  const T = 32, PH = 48;
  const V3 = '../v3/img/';
  const V4 = 'img/';
  const IMG = {};                                   // v3: 'tiles/floor_0' · 'cg/corpse'   v4: 'v4/cg/d5_rail' · 'v4/traces/ash' · 'v4/poses/sit'
  // v4 목록이 없을 때만 쓰는 예비 목록 (manifest.py 를 아직 안 돌린 판)
  const V4_FALLBACK = ['ash', 'bandage', 'blanket_fold', 'blanket_open', 'blood_s', 'blood_smear', 'blood_spray', 'bones', 'bottle_empty', 'bottle_full', 'cloth_body',
    'footprints', 'knife', 'lantern_dead', 'lens', 'lid', 'pillow', 'puddle', 'shoes_pair', 'tally'].map((n) => 'traces/' + n).concat(['poses/sit', 'poses/lie', 'poses/eyes', 'poses/mouth', 'portrait_patch/ear_patch']);

  const loadOne = (key, url) => new Promise((res) => { const im = new Image(); im.onload = () => { IMG[key] = im; res(); }; im.onerror = () => res(); im.src = url; });
  const listOf = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ready = Promise.all([listOf(V3 + 'manifest.json'), listOf(V4 + 'manifest.json')]).then(([v3, v4]) => {
    v3 = Array.isArray(v3) ? v3 : [];
    v4 = Array.isArray(v4) ? v4 : V4_FALLBACK;
    return Promise.all(v3.filter((n) => !/^(gods|cg\/(affl_|.*_(omen|advent)))/.test(n)).map((n) => loadOne(n, V3 + n + '.png'))
      .concat(v4.map((n) => loadOne('v4/' + n, V4 + n + '.png'))));
  });
  const has = (key) => !!IMG[key];
  const src = (key) => (IMG[key] ? IMG[key].src : '');

  const cache = new Map();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const toCanvas = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c; };
  const blank = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // 그림의 처음 불투명한 줄 (머리 꼭대기·드럼통 아가리 자리를 그림에서 읽는다 — 그림이 바뀌어도 맞는다)
  const topCache = new WeakMap();
  function opaqueTop(im) {
    if (!im) return 0;
    if (topCache.has(im)) return topCache.get(im);
    let r = 0;
    try {
      const c = im.getContext ? im : toCanvas(im);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      r = -1;
      for (let y = 0; y < c.height && r < 0; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { r = y; break; }
      if (r < 0) r = 0;
    } catch (e) { r = 0; }
    topCache.set(im, r);
    return r;
  }
  // 그림의 불투명한 상자 { x0, y0, x1, y1 } (끝 포함). 다 투명하면 캔버스 전체. 꼬리표가 당신 몸을 피할 때 쓴다
  const boxCache = new WeakMap();
  function opaqueBox(im) {
    if (!im) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    if (boxCache.has(im)) return boxCache.get(im);
    let b = { x0: 0, y0: 0, x1: im.width - 1, y1: im.height - 1 };
    try {
      const c = im.getContext ? im : toCanvas(im);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) b = { x0, y0, x1, y1 };
    } catch (e) { /* 읽을 수 없으면 캔버스 전체 */ }
    boxCache.set(im, b);
    return b;
  }

  // ── 자리표시: 색 사각형 + 이름 (그림이 정말 없을 때만) ──
  function hashColor(name) { let h = 7; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const hue = h % 360; return `hsl(${hue} 35% 38%)`; }
  function placeholder(name, w, h, label) {
    const c = blank(w, h);
    const g = c.getContext('2d');
    g.fillStyle = hashColor(name); g.fillRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5);
    g.fillStyle = '#efe6d2'; g.font = `${Math.max(7, Math.min(10, Math.floor(w / 3)))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = String(label == null ? name : label);
    const lines = txt.length > 4 && w <= 32 ? [txt.slice(0, 4), txt.slice(4, 8)] : [txt.slice(0, 8)];
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 10));
    c.isPlaceholder = true;
    return c;
  }

  // ── 타일: v4 tiles/<종류>_<0~3>(P0-A3 전동차 좌석·계기판) → v3 tiles/<종류>_<0~3> 중 자리에 따라 하나 ──
  function tile(kind, x, y) {
    const v = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;
    const name = ['v4/tiles/', 'tiles/'].map((p) => (IMG[p + kind + '_' + v] ? p + kind + '_' + v : IMG[p + kind + '_0'] ? p + kind + '_0' : null)).find(Boolean) || null;
    return once('t:' + kind + ':' + v + ':' + (name || ''), () => (name ? toCanvas(IMG[name]) : flatTile(kind)));
  }
  const hasTile = (kind) => !!(IMG['v4/tiles/' + kind + '_0'] || IMG['tiles/' + kind + '_0']);
  const FLAT = { wall: '#2a2420', floor: '#3a3029', concourse: '#35302a', edge: '#5a4a1e', track: '#17141a', water: '#1b2d36', carFloor: '#2d2622', carWall: '#241f1c', tunnelWall: '#1b1816', marketFloor: '#2a2520', drainFloor: '#1d2428' };
  function flatTile(kind) { const c = blank(T, T); const g = c.getContext('2d'); g.fillStyle = FLAT[kind] || '#333'; g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T); return c; }

  // ── 손으로 찍은 작은 소품 (v3 에도 v4 에도 그림이 없는 것). 32×32, 바닥 정렬 ──
  const PROC = {
    pipe(g) {                                       // 쇠파이프: 바닥에 비스듬히 누운 녹슨 관
      for (let i = 0; i < 22; i++) { const x = 5 + i, y = 25 - Math.round(i * 0.42); g.fillStyle = '#2a2622'; g.fillRect(x, y, 1, 4); g.fillStyle = i % 5 === 2 ? '#7a5236' : '#6e6a63'; g.fillRect(x, y, 1, 2); g.fillStyle = '#a49d92'; g.fillRect(x, y, 1, 1); }
      g.fillStyle = '#1a1714'; g.fillRect(4, 25, 2, 4); g.fillRect(26, 16, 2, 4);
    },
    notebook(g) {                                   // 수첩: 검은 표지, 흰 종이 귀퉁이, 고무줄
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(9, 26, 16, 2);
      g.fillStyle = '#1c1916'; g.fillRect(9, 15, 15, 11);
      g.fillStyle = '#d9cfbd'; g.fillRect(10, 25, 13, 1); g.fillRect(23, 16, 1, 9);
      g.fillStyle = '#3a332c'; g.fillRect(9, 15, 15, 1); g.fillRect(9, 15, 1, 11);
      g.fillStyle = '#7a2c22'; g.fillRect(18, 15, 1, 11);
    },
    vent(g) {                                       // 환기구: 벽 아래 쇠 격자, 안이 회색으로 밝다
      g.fillStyle = '#141210'; g.fillRect(6, 10, 20, 18);
      g.fillStyle = '#5c5a55'; g.fillRect(7, 11, 18, 16);
      for (let y = 12; y < 27; y += 3) { g.fillStyle = '#1e1c19'; g.fillRect(7, y, 18, 2); }
      g.fillStyle = 'rgba(190,190,180,.35)'; g.fillRect(9, 13, 14, 1);
      g.fillStyle = '#8c8880'; g.fillRect(6, 10, 20, 1);
    },
    chalk(g) {                                      // 계단 분필 줄 (props/chalk_line 이 없을 때): 칸 위쪽을 가로지르는 흰 점선 — 노란 안전선과 다른 색·모양
      for (let x = 2; x < 30; x += 4) { g.fillStyle = '#d8d4c8'; g.fillRect(x, 3, 2, 1); g.fillStyle = 'rgba(216,212,200,.45)'; g.fillRect(x + 2, 4, 1, 1); }
    },
  };
  // ── 손으로 찍은 작은 덧그림 (흔적 상태 중 그림 파일이 없는 것) ──
  const PROC_TRACE = {
    slash(g) { g.fillStyle = 'rgba(20,14,12,.85)'; for (let i = 0; i < 12; i++) { g.fillRect(9 + i, 12 + i, 2, 1); g.fillRect(14 + i, 10 + i, 1, 1); } g.fillStyle = 'rgba(200,190,170,.5)'; g.fillRect(12, 16, 3, 1); g.fillRect(19, 19, 2, 1); },
    glow(g) { const gr = g.createRadialGradient(16, 18, 0, 16, 18, 10); gr.addColorStop(0, 'rgba(120,220,140,.75)'); gr.addColorStop(1, 'rgba(120,220,140,0)'); g.fillStyle = gr; g.fillRect(4, 6, 24, 24); g.fillStyle = '#c8ffd0'; g.fillRect(15, 17, 2, 2); },
    gap(g) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(4, 18, 24, 12); g.fillStyle = 'rgba(160,120,60,.35)'; g.fillRect(4, 29, 24, 1); },
  };
  function procCanvas(table, id, w, h) { const c = blank(w, h); table[id](c.getContext('2d')); return c; }

  // ── 소품. id 꼴: 'drum'(v3 props) · 'tr:knife'(v4 흔적 덧그림) · 'pr:pipe'(손으로 찍음). 없으면 자리표시 ──
  function prop(id, label) {
    return once('p:' + id, () => {
      if (id.startsWith('tr:')) { const f = id.slice(3); return IMG['v4/traces/' + f] ? toCanvas(IMG['v4/traces/' + f]) : placeholder(f, 28, 28, label || f); }
      if (id.startsWith('pr:')) { const f = id.slice(3); return PROC[f] ? procCanvas(PROC, f, T, T) : placeholder(f, 28, 28, label || f); }
      return IMG['props/' + id] ? toCanvas(IMG['props/' + id]) : placeholder(id, 28, 28, label || id);
    });
  }
  const hasProp = (id) => (id.startsWith('tr:') ? has('v4/traces/' + id.slice(3)) : id.startsWith('pr:') ? !!PROC[id.slice(3)] : has('props/' + id));
  // ── 흔적 덧그림: v4 traces/<파일> 또는 손으로 찍은 것('pr:slash'). 없으면 작은 자리표시 ──
  function trace(file, label) {
    return once('tr:' + file, () => {
      if (file.startsWith('pr:')) { const f = file.slice(3); return PROC_TRACE[f] ? procCanvas(PROC_TRACE, f, T, T) : placeholder(f, 20, 14, label || f); }
      return IMG['v4/traces/' + file] ? toCanvas(IMG['v4/traces/' + file]) : placeholder(file, 20, 14, label || file);
    });
  }
  const hasTrace = (file) => (file.startsWith('pr:') ? !!PROC_TRACE[file.slice(3)] : has('v4/traces/' + file));

  // ── 사람: walk/<id> 3열(왼발·섬·오른발) × 4행(아래·왼·오른·위). frame 0 섬, 1 왼발, 2 오른발 ──
  const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
  function bloodOver(g, id, hurt, w, h) {                  // 부상: 피를 덧그림 (수치 없이 몸으로 보인다)
    if (!hurt) return;
    g.globalCompositeOperation = 'source-atop';
    let s = 7 + hurt * 31 + id.length; const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    g.fillStyle = hurt >= 3 ? 'rgba(110,16,20,0.85)' : 'rgba(110,16,20,0.7)';
    for (let i = 0; i < hurt * 6; i++) g.fillRect(w * 0.2 + R() * w * 0.6, h * 0.18 + R() * h * 0.66, 2 + R() * 4, 2 + R() * 6);
    g.globalCompositeOperation = 'source-over';
  }
  // 걷기 시트: v4/img/walk/<id>(덩어리 단위로 다시 자른 것, P0-A1)가 먼저, 없으면 v3 walk/<id>
  const walkSheet = (id) => IMG['v4/walk/' + id] || IMG['walk/' + id] || null;
  function person(id, frame, hurt, dir) {
    const v4w = IMG['v4/walk/' + id], walk = IMG['walk/' + id], still = IMG['sprites/' + id];
    return once('h:' + id + ':' + (frame || 0) + ':' + (hurt || 0) + ':' + (dir || 'down'), () => {
      const col = frame === 1 ? 0 : frame === 2 ? 2 : 1, row = DIR_ROW[dir] || 0;
      if (v4w) {                                                   // 칸 크기는 시트에서, 칸 바닥 = 타일 바닥 (화면이 캔버스 아래를 타일 아래에 맞춘다), 원래 크기 그대로
        const cw = Math.floor(v4w.width / 3), ch = Math.floor(v4w.height / 4);
        const c = blank(Math.max(T, cw), Math.max(PH, ch)); const g = c.getContext('2d');
        g.drawImage(v4w, col * cw, row * ch, cw, ch, Math.round((c.width - cw) / 2), c.height - ch, cw, ch);
        bloodOver(g, id, hurt, c.width, c.height);
        return c;
      }
      const c = blank(T, PH);
      const g = c.getContext('2d');
      if (walk) { const cw = walk.width / 3, ch = walk.height / 4; g.drawImage(walk, col * cw, row * ch, cw, ch, 0, 0, T, PH); }
      else if (still) g.drawImage(still, 0, 0);
      else { g.drawImage(placeholder(id, 24, 40, id.slice(0, 3)), 4, 6); }
      bloodOver(g, id, hurt, T, PH);
      return c;
    });
  }
  // 머리 꼭대기: 그 사람·방향·걸음 그림에서 처음 불투명한 줄 (사람 캔버스 위에서 몇 줄 아래인가)
  const headTop = (id, frame, dir) => once('head:' + id + ':' + (frame || 0) + ':' + (dir || 'down'), () => opaqueTop(person(id, frame, 0, dir)));
  // 사람 id → 그림 파일 이름 (당신 = player)
  const spriteId = (id) => (id === 'you' ? 'player' : id);

  // ── 자세: 공용 실루엣(앉기·눕기)을 그 사람 옷 색으로 물들인다. 옷 색 = 걷기 그림 몸통 평균 ──
  function tintOf(id) {
    return once('tint:' + id, () => {
      const walk = walkSheet(id);
      if (!walk) return [120, 110, 100];
      try {
        const cw = walk.width / 3, ch = walk.height / 4;
        const c = blank(cw, ch); const g = c.getContext('2d'); g.drawImage(walk, cw, 0, cw, ch, 0, 0, cw, ch);
        const d = g.getImageData(Math.floor(cw * 0.25), Math.floor(ch * 0.42), Math.ceil(cw * 0.5), Math.ceil(ch * 0.3)).data;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
        return n ? [r / n, gg / n, b / n] : [120, 110, 100];
      } catch (e) { return [120, 110, 100]; }
    });
  }
  // kind: 'sit' | 'lie'. 그림이 없으면 null (화면은 걷기 그림을 잘라 쓴다)
  function pose(kind, id, hurt) {
    const im = IMG['v4/poses/' + kind];
    if (!im) return null;
    const k = spriteId(id);
    return once('pose:' + kind + ':' + k + ':' + (hurt || 0), () => {
      const c = toCanvas(im); const g = c.getContext('2d');
      try {
        const data = g.getImageData(0, 0, c.width, c.height); const d = data.data; const [tr, tg, tb] = tintOf(k);
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          const l = Math.min(1.35, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 112);
          const mix = l < 0.42 ? 0.35 : 0.85;                 // 머리카락·그림자는 덜 물든다
          d[i] = Math.min(255, (d[i] * (1 - mix) + tr * l * mix)); d[i + 1] = Math.min(255, (d[i + 1] * (1 - mix) + tg * l * mix)); d[i + 2] = Math.min(255, (d[i + 2] * (1 - mix) + tb * l * mix));
        }
        g.putImageData(data, 0, 0);
      } catch (e) { /* 물들이기 실패 = 회색 실루엣 그대로 */ }
      bloodOver(g, k, hurt, c.width, c.height);
      return c;
    });
  }
  // 잠든 사람 32×32: 잠자리 그림(props/bed, 위에서 본 깔개 — 위쪽이 베개) 위에 겹쳐 그린다.
  // 머리 = 그 사람 걷기 그림(아래 보기)의 머리를 그대로 잘라 베개 자리에, 몸 = 옷 색 담요가 턱 밑부터 덮는다.
  // 옆으로 누운 실루엣(poses/lie)을 잠자리 옆에 두면 바닥에 쓰러진 시체처럼 보여서 바꿨다.
  function sleeper(id, hurt) {
    const k = spriteId(id);
    return once('sleep:' + k + ':' + (hurt || 0), () => {
      const c = blank(T, T); const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const pc = person(k, 0, 0, 'down'), headY = opaqueTop(pc);                         // 머리 = 아래 줄 섬 칸에서 처음 불투명한 줄부터 13줄 (그림이 바뀌어도 맞는다)
      g.drawImage(pc, Math.round((pc.width - 16) / 2), headY, 16, 13, 8, 0, 16, 13);
      const [r0, g0, b0] = tintOf(k);
      const col = (m, a) => `rgba(${Math.round(Math.min(255, r0 * m))},${Math.round(Math.min(255, g0 * m))},${Math.round(Math.min(255, b0 * m))},${a == null ? 1 : a})`;
      const blanket = (x, y, w, h) => { g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + w - 3, y); g.quadraticCurveTo(x + w, y, x + w, y + 3); g.lineTo(x + w, y + h - 3); g.quadraticCurveTo(x + w, y + h, x + w - 3, y + h); g.lineTo(x + 3, y + h); g.quadraticCurveTo(x, y + h, x, y + h - 3); g.lineTo(x, y + 3); g.quadraticCurveTo(x, y, x + 3, y); g.closePath(); };
      blanket(4, 10, 24, 19); g.fillStyle = col(0.42); g.fill();                         // 담요 테두리(그늘)
      blanket(5, 10, 22, 18); g.fillStyle = col(0.78); g.fill();                         // 담요
      g.fillStyle = col(0.95); g.fillRect(10, 13, 12, 14);                                // 몸이 솟은 자리 (어깨~발)
      g.fillStyle = col(1.08); g.fillRect(12, 14, 7, 12);
      g.fillStyle = col(1.25); g.fillRect(5, 10, 22, 2);                                 // 접힌 윗단
      g.fillStyle = col(0.55); g.fillRect(5, 12, 22, 1);
      let s = 11 + k.length * 7; const R = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
      g.fillStyle = col(0.6);
      for (let i = 0; i < 3; i++) { const y = 16 + Math.floor(R() * 10), x = 6 + Math.floor(R() * 6); g.fillRect(x, y, 4 + Math.floor(R() * 5), 1); g.fillRect(x + 12 + Math.floor(R() * 3), y + 1, 3 + Math.floor(R() * 4), 1); }
      bloodOver(g, k, hurt, T, T);
      return c;
    });
  }
  // 머리 위 반응 아이콘 16×16: 'eyes'(안 잠) · 'mouth'(입이 움직인다). 없으면 null
  const react = (kind) => (IMG['v4/poses/' + kind] ? once('re:' + kind, () => toCanvas(IMG['v4/poses/' + kind])) : null);
  // 꼬리표(11×11) 안에 넣는 아이콘: 불투명한 곳만 잘라, 9px 를 넘으면 정확히 ½(2×2 칸에서 가장 진하고 밝은 점) — 새 7×5 그림(P0-A2)이 오면 원래 크기 그대로
  function reactIcon(kind) {
    const im = IMG['v4/poses/' + kind];
    if (!im) return null;
    return once('ri:' + kind, () => {
      const c = toCanvas(im); const g = c.getContext('2d');
      let d; try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return c; }
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x1 < 0) return blank(1, 1);
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const n = w > 9 || h > 9 ? 2 : 1;
      const ow = Math.ceil(w / n), oh = Math.ceil(h / n);
      const o = blank(ow, oh); const og = o.getContext('2d'); const od = og.createImageData(ow, oh);
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
        let best = -1, bi = -1;
        for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
          const sx = x0 + x * n + dx, sy = y0 + y * n + dy;
          if (sx > x1 || sy > y1) continue;
          const i = (sy * c.width + sx) * 4, sc = d[i + 3] * 4 + (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (sc > best) { best = sc; bi = i; }
        }
        if (bi >= 0) { const j = (y * ow + x) * 4; od.data[j] = d[bi]; od.data[j + 1] = d[bi + 1]; od.data[j + 2] = d[bi + 2]; od.data[j + 3] = d[bi + 3]; }
      }
      og.putImageData(od, 0, 0);
      return o;
    });
  }
  // v4 소품 그림(img/props/<이름>, P0-A2·A3)이 있으면 캔버스, 없으면 null — 화면은 대체 규칙으로 간다
  const v4prop = (name) => (IMG['v4/props/' + name] ? once('v4p:' + name, () => toCanvas(IMG['v4/props/' + name])) : null);
  // 정확히 ½ (손 물건의 대체 규칙: 옛 32px 그림을 16px 로 — 원래 크기로는 그리지 않는다). 2×2 칸에서 가장 진하고 밝은 점을 남긴다(가는 선이 사라지지 않게)
  function half(im) {
    if (!im) return null;
    if (!half.cache) half.cache = new WeakMap();
    if (half.cache.has(im)) return half.cache.get(im);
    const c = im.getContext ? im : toCanvas(im);
    const w = Math.ceil(c.width / 2), h = Math.ceil(c.height / 2), o = blank(w, h);
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, og = o.getContext('2d'), od = og.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let best = -1, bi = -1;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = x * 2 + dx, sy = y * 2 + dy; if (sx >= c.width || sy >= c.height) continue; const i = (sy * c.width + sx) * 4, sc = d[i + 3] * 4 + (d[i] + d[i + 1] + d[i + 2]) / 3; if (sc > best) { best = sc; bi = i; } }
        if (bi >= 0) { const j = (y * w + x) * 4; od.data[j] = d[bi]; od.data[j + 1] = d[bi + 1]; od.data[j + 2] = d[bi + 2]; od.data[j + 3] = d[bi + 3]; }
      }
      og.putImageData(od, 0, 0);
    } catch (e) { const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, w, h); }
    half.cache.set(im, o);
    return o;
  }
  // 연 수납의 대체 그림(열린 그림이 없을 때): 닫힌 그림을 30% 어둡게 + 위쪽에 2px 검은 틈 (바닥에 판자를 더 얹지 않는다)
  function opened(im) {
    if (!im) return null;
    if (!opened.cache) opened.cache = new WeakMap();
    if (opened.cache.has(im)) return opened.cache.get(im);
    const c = toCanvas(im); const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    const top = opaqueTop(im), w = Math.max(4, Math.round(c.width * 0.6));
    g.fillStyle = '#050404'; g.fillRect(Math.round((c.width - w) / 2), top + 1, w, 2);
    opened.cache.set(im, c);
    return c;
  }

  // ── 초상: v4 portraits80/<id>(원본에서 80px 로 다시 뽑은 것, P0-A4)이 있으면 그것을 원래 크기로(대사창 얼굴 칸 = 80), 없으면 v3 96 ──
  // 중상 이상이면 다친 얼굴, 귀를 잃었으면 귀 패치를 덧칠. 귀 자리(패치 왼쪽 위): 96 기준 표, 80 기준은 ×5/6 반올림
  const EAR_AT = { player: [14, 36], gicheol: [13, 37], soonrye: [12, 38], seoha: [16, 38], eunji: [16, 38], dongha: [15, 36], mari: [15, 38], eunchae: [16, 38], dohyeon: [13, 37] };
  const EAR_AT80 = Object.fromEntries(Object.entries(EAR_AT).map(([k, [x, y]]) => [k, [Math.round(x * 5 / 6), Math.round(y * 5 / 6)]]));
  function portraitKey(k, hurt) {
    if (hurt >= 2) {
      if (IMG['v4/portraits80_hurt/' + k]) return 'v4/portraits80_hurt/' + k;
      if (IMG['portraits_hurt/' + k]) return 'portraits_hurt/' + k;
    }
    return IMG['v4/portraits80/' + k] ? 'v4/portraits80/' + k : 'portraits/' + k;
  }
  function portraitSrc(id, hurt, ear) {
    const k = spriteId(id);
    const key = portraitKey(k, hurt);
    const is80 = key.startsWith('v4/portraits80');
    const patch = (is80 && IMG['v4/portrait_patch/ear_patch80']) || IMG['v4/portrait_patch/ear_patch'];
    if (!ear || !patch || !IMG[key]) return src(key);
    return once('ear:' + key, () => { const c = toCanvas(IMG[key]); const [x, y] = (is80 ? EAR_AT80[k] || [12, 31] : EAR_AT[k] || [14, 37]); c.getContext('2d').drawImage(patch, x, y); try { return c.toDataURL(); } catch (e) { return src(key); } });
  }

  // ── 장면 그림 ──
  // 찾는 순서: v4 cg/<image> → v4 cg/<사건 id> → V4_ALIAS(옛 image 이름 → v4 파일) → EV_V3(사건별 v3) → CG_ALIAS(v3 대체) → v3 cg/<image 에서 cg_ 뗀 것> → ''(그림 층을 안 연다, 자리표시 없음)
  // 데이터의 image 칸이 v4 파일 이름이나 사건 id 로 바뀌면 위 두 단계에서 바로 잡힌다.
  const V4_ALIAS = { scene_cannibal: 'd5_rail', scene_shutter: 'd6_shutter', cg_scissors: 'd7_fingers', scene_pillow: 'd8_pillow', cg_conductor: 'd9_inspection', cg_rot: 'd7_rot' };
  const CG_ALIAS = { title_dark: '', cg_stairs: 'open_stairs', cg_speaker: 'open_speaker', cg_gicheol: 'open_gicheol', cg_notebook: 'open_cab', cg_bottles: 'n_thief',
    cg_count: 'story_voice', cg_notebook_back: 'story_ticket', scene_cannibal: 'corpse', cg_flood: 'flood_break', cg_pharmacy: 'a1_pharmacy', cg_gate: 'b1_gate', cg_dohyeon: 'dohyeon_key',
    cg_train: 'story_ticket', cg_ledger: '', cg_speaker_night: 'open_speaker', cg_bonepicker: 'a3_traces', cg_drowned: 'b4_tank', cg_walk: 'open_tunnel', scene_shutter: 'patrol', scene_pillow: 'n_fever',
    cg_scissors: 'n_rot', cg_conductor: 'story_ticket', title: 'title' };
  // 같은 image 이름을 여러 사건이 나눠 쓸 때, 사건마다 더 맞는 v3 대체 (v4 그림이 생기면 위에서 먼저 잡힌다)
  // d0_ledger 는 2026-10-24 P0-D1 에서 image 를 비웠다(그림 없이 글로) — 대체 항목도 지웠다
  const EV_V3 = {};
  function cgKey(id, evId) {
    if (id && IMG['v4/cg/' + id]) return 'v4/cg/' + id;
    if (evId && IMG['v4/cg/' + evId]) return 'v4/cg/' + evId;
    if (id && V4_ALIAS[id] && IMG['v4/cg/' + V4_ALIAS[id]]) return 'v4/cg/' + V4_ALIAS[id];
    if (!id) return '';
    if (evId && EV_V3[evId] && IMG['cg/' + EV_V3[evId]]) return 'cg/' + EV_V3[evId];
    const a = CG_ALIAS[id] !== undefined ? CG_ALIAS[id] : id.replace(/^(cg|scene)_/, '');
    return a && IMG['cg/' + a] ? 'cg/' + a : '';
  }
  const cgSrc = (id, evId) => src(cgKey(id, evId));
  // 당신 사망: 사인 → death_* (그림이 없으면 v3 대체)
  const DEATH_V3 = { death_counted: 'open_stairs', death_starve: 'n_fever', death_beaten: 'battle_market', death_drown: 'flood_break', death_flux: 'n_rot' };
  const deathSrc = (kind) => src(IMG['v4/cg/' + kind] ? 'v4/cg/' + kind : 'cg/' + (DEATH_V3[kind] || 'n_dark'));
  // 정체 → 꿈·밝혀짐 그림 (정체 단어는 화면에 안 나온다 — 그림 한 장 + 한 줄)
  const IDENT_CG = { driver: 'dream_cab', conductor: 'story_ticket', inspector: 'dream_punch', passenger: 'dream_seat', counted: 'dream_stairs', platform_one: 'open_tunnel', counting_child: 'story_fog' };
  const identSrc = (cand) => { const f = IDENT_CG[cand]; if (!f) return ''; return src(IMG['v4/cg/' + f] ? 'v4/cg/' + f : IMG['cg/' + f] ? 'cg/' + f : ''); };
  // 아이콘 40×40: v4 icons/<이름>(찾은 물건, P0-A3) → v3 icons/<이름>(패널 자원)
  const iconSrc = (name) => src(IMG['v4/icons/' + name] ? 'v4/icons/' + name : 'icons/' + name);
  // 선택 창의 작은 장면 그림: 큰 그림(v4 cg/<이름> 또는 v3 cg/<이름>)과 같은 이름의 v4 cg_s/<이름>(256×144, P0-A4). 없으면 '' (큰 그림을 줄여 보인다)
  let smallMap = null;
  function cgSmall(full) {
    if (!full) return '';
    if (!smallMap) {
      smallMap = new Map();
      for (const k of Object.keys(IMG)) { const m = /^(?:v4\/)?cg\/(.+)$/.exec(k); if (m && IMG['v4/cg_s/' + m[1]]) smallMap.set(IMG[k].src, IMG['v4/cg_s/' + m[1]].src); }
    }
    return smallMap.get(full) || '';
  }

  window.ART = { T, PH, ready, has, src, tile, hasTile, prop, hasProp, trace, hasTrace, person, headTop, opaqueTop, opaqueBox, pose, sleeper, react, reactIcon, v4prop, half, opened, spriteId, portraitSrc, cgSrc, cgSmall, cgKey, deathSrc, identSrc, iconSrc, placeholder, hashColor, IMG };
})();
