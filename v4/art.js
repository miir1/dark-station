// 어두운 역 v4 — 그림. 프로토타입 자산(../v3/img, 읽기만)과 흔적 덧그림(img/traces)을 읽고, 없는 그림은 색 사각형 + 이름 글자로 대신한다.
// 타일 32, 사람 32×48(걷기 묶음 3열×4행), 소품 32×32, 초상 96, 장면 384×216.
(function () {
  'use strict';
  const T = 32, PH = 48;
  const V3 = '../v3/img/';
  const IMG = {};                                   // 'tiles/floor_0' → Image, 'traces/ash' → Image
  const TRACE_FILES = ['ash', 'bandage', 'blanket_fold', 'blanket_open', 'blood_s', 'blood_smear', 'blood_spray', 'bones', 'bottle_empty', 'bottle_full', 'cloth_body',
    'footprints', 'knife', 'lantern_dead', 'lens', 'lid', 'pillow', 'puddle', 'shoes_pair', 'tally'];

  const loadOne = (key, src) => new Promise((res) => { const im = new Image(); im.onload = () => { IMG[key] = im; res(); }; im.onerror = () => res(); im.src = src; });
  const ready = fetch(V3 + 'manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
    .then((list) => Promise.all(list.filter((n) => !/^(gods|cg\/(affl_|.*_(omen|advent)))/.test(n)).map((n) => loadOne(n, V3 + n + '.png'))
      .concat(TRACE_FILES.map((n) => loadOne('traces/' + n, 'img/traces/' + n + '.png')))));
  const has = (key) => !!IMG[key];
  const src = (key) => (IMG[key] ? IMG[key].src : '');

  const cache = new Map();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const toCanvas = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c; };

  // ── 자리표시: 색 사각형 + 이름 (나중에 그림으로 교체) ──
  function hashColor(name) { let h = 7; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const hue = h % 360; return `hsl(${hue} 35% 38%)`; }
  function placeholder(name, w, h, label) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = hashColor(name); g.fillRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5);
    g.fillStyle = '#efe6d2'; g.font = `${Math.max(7, Math.min(10, Math.floor(w / 3)))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = String(label == null ? name : label);
    const lines = txt.length > 4 && w <= 32 ? [txt.slice(0, 4), txt.slice(4, 8)] : [txt.slice(0, 8)];
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 10));
    return c;
  }

  // ── 타일: tiles/<종류>_<0~3> 중 자리에 따라 하나 ──
  function tile(kind, x, y) {
    const v = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;
    const name = IMG['tiles/' + kind + '_' + v] ? 'tiles/' + kind + '_' + v : IMG['tiles/' + kind + '_0'] ? 'tiles/' + kind + '_0' : null;
    return once('t:' + kind + ':' + v + ':' + !!name, () => (name ? toCanvas(IMG[name]) : flatTile(kind)));
  }
  const FLAT = { wall: '#2a2420', floor: '#3a3029', concourse: '#35302a', edge: '#5a4a1e', track: '#17141a', water: '#1b2d36', carFloor: '#2d2622', carWall: '#241f1c', tunnelWall: '#1b1816', marketFloor: '#2a2520', drainFloor: '#1d2428' };
  function flatTile(kind) { const c = document.createElement('canvas'); c.width = T; c.height = T; const g = c.getContext('2d'); g.fillStyle = FLAT[kind] || '#333'; g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T); return c; }

  // ── 소품: props/<id>. 없으면 자리표시 ──
  function prop(id, label) { return once('p:' + id, () => (IMG['props/' + id] ? toCanvas(IMG['props/' + id]) : placeholder(id, 28, 28, label || id))); }
  const hasProp = (id) => has('props/' + id);
  // ── 흔적 덧그림: traces/<파일>. 없으면 작은 자리표시 ──
  function trace(file, label) { return once('tr:' + file, () => (IMG['traces/' + file] ? toCanvas(IMG['traces/' + file]) : placeholder(file, 20, 14, label || file))); }
  const hasTrace = (file) => has('traces/' + file);

  // ── 사람: walk/<id> 3열(왼발·섬·오른발) × 4행(아래·왼·오른·위). frame 0 섬, 1 왼발, 2 오른발 ──
  const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
  function person(id, frame, hurt, dir) {
    const walk = IMG['walk/' + id], still = IMG['sprites/' + id];
    return once('h:' + id + ':' + (frame || 0) + ':' + (hurt || 0) + ':' + (dir || 'down'), () => {
      const c = document.createElement('canvas'); c.width = T; c.height = PH;
      const g = c.getContext('2d');
      if (walk) { const cw = walk.width / 3, ch = walk.height / 4, col = frame === 1 ? 0 : frame === 2 ? 2 : 1; g.drawImage(walk, col * cw, (DIR_ROW[dir] || 0) * ch, cw, ch, 0, 0, T, PH); }
      else if (still) g.drawImage(still, 0, 0);
      else { g.drawImage(placeholder(id, 24, 40, id.slice(0, 3)), 4, 6); }
      if (hurt) {                                   // 부상: 피를 덧그림 (수치 없이 몸으로 보인다)
        g.globalCompositeOperation = 'source-atop';
        let s = 7 + hurt * 31 + id.length; const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        g.fillStyle = hurt >= 3 ? 'rgba(110,16,20,0.85)' : 'rgba(110,16,20,0.7)';
        for (let i = 0; i < hurt * 6; i++) g.fillRect(T * 0.2 + R() * T * 0.6, PH * 0.18 + R() * PH * 0.66, 2 + R() * 4, 2 + R() * 6);
        g.globalCompositeOperation = 'source-over';
      }
      return c;
    });
  }
  // 사람 id → 그림 파일 이름 (당신 = player)
  const spriteId = (id) => (id === 'you' ? 'player' : id);
  // 초상 96×96. 중상 이상이면 다친 얼굴
  function portraitSrc(id, hurt) { const k = spriteId(id); const h = hurt >= 2 && IMG['portraits_hurt/' + k] ? 'portraits_hurt/' + k : 'portraits/' + k; return src(h); }
  // 장면 그림 id → 주소 (cg/<id>). 없으면 '' (화면은 자리표시 상자를 그린다)
  const CG_ALIAS = { title_dark: '', cg_camp: 'open_camp', cg_stairs: 'open_stairs', cg_speaker: 'open_speaker', cg_gicheol: 'open_gicheol', cg_notebook: '', cg_bottles: '', cg_count: '', cg_notebook_back: '', scene_cannibal: 'corpse', cg_flood: 'flood_break', cg_pharmacy: 'a1_pharmacy', cg_gate: 'b1_gate', cg_dohyeon: 'dohyeon_key', cg_train: 'ending_safe', cg_ledger: 'story_ticket' };
  function cgSrc(id) { if (!id) return ''; const a = CG_ALIAS[id] !== undefined ? CG_ALIAS[id] : id.replace(/^cg_/, ''); return a && IMG['cg/' + a] ? src('cg/' + a) : ''; }
  const iconSrc = (name) => src('icons/' + name);

  window.ART = { T, PH, ready, has, src, tile, prop, hasProp, trace, hasTrace, person, spriteId, portraitSrc, cgSrc, iconSrc, placeholder, hashColor };
})();
