// 어두운 역 v4 — 지도 그리기. 480×320 캔버스(15×10칸), 타일·소품·흔적 덧그림·사람·빛. 수치는 그리지 않는다 — 흔적과 자세만.
(function () {
  'use strict';
  const T = ART.T, PH = ART.PH;

  // 지도 물건 id → 밑그림 소품. 'drum' = v3 props, 'tr:knife' = v4 흔적 덧그림, 'pr:pipe' = 손으로 찍은 작은 그림(art.js PROC). null = 소품 없음(덧그림만)
  const PROP = { fire: 'drum', board: 'board', bench1: 'seat', bench2: 'seat', crate_food: 'crate', parts_crate: 'crate', office_door: 'door', chalk_wall: 'mark', stairs_ash: 'stairsUp',
    shoes_stairs: null, shutter_gap: null, speaker: 'lamp', train_seat: 'seat', cab_window: null, radio: 'radio', body_rail: null, grave: null, pipe: 'pr:pipe', scissors: 'tr:knife',
    pillow_gicheol: 'tr:pillow', notebook_you: 'pr:notebook', repair_rubble: 'rubble', lever: 'lever', bag: 'sack', cab_door: null, radio_cab: 'radio', medkit: 'medkit', notebook_dash: 'pr:notebook',
    shoe_cab: 'heel', shelter_box: 'crate', vent_shaft: 'pr:vent', rubble: 'rubble', pharmacy_shutter: 'kiosk', phonebooth: 'phone', stall_cart: 'cart', bone_pile: 'bones', bodybag_a2: 'bodybag',
    valve: 'valve', pump_room: 'chaindoor', worker_pipe: 'sludge', cistern: 'tank', ladder_b2: 'ladder' };
  const propFor = (id) => { if (/^blanket_/.test(id)) return 'bed'; if (/^(bottle|bowl|bandage)_/.test(id)) return null; return PROP[id] === undefined ? id : PROP[id]; };
  // 흔적 상태 → 덧그림 (objects.overlay 의 id → v4 img/traces 파일, 'pr:x' = 손으로 찍은 것). null = 덧그림 없음(MOVED 로 소품을 비켜 그리거나 아무것도 안 함)
  const OVERLAY = { bottle_empty_ov: 'bottle_empty', bottle_wet_ov: 'puddle', bowl_empty_ov: 'lid', bowl_meat_ov: 'knife', blanket_rolled_ov: 'blanket_fold', blanket_paired_ov: 'blanket_open', blanket_empty_ov: 'blanket_open',
    pillow_moved_ov: null, pillow_blood_ov: 'blood_s', ash1_ov: 'ash', ash2_ov: 'ash', ash3_ov: 'ash', shoe_one_ov: 'shoes_pair', shoe_pair_ov: 'shoes_pair', bandage_wet_ov: 'bandage', bandage_rot_ov: 'bandage',
    pipe_blood_ov: 'blood_smear', scissors_blood_ov: 'blood_s', body_whole_ov: 'cloth_body', body_cut_ov: 'cloth_body', body_buried_ov: 'bones', bones_scat_ov: 'bones', shutter_blood_ov: 'blood_spray', shutter_can_ov: 'lid',
    crate_open_ov: 'lid', crate_empty_ov: 'lid', chalk_lines_ov: 'tally', chalk_names_ov: 'tally', speaker_cut_ov: 'lantern_dead', notebook_moved_ov: null, fire_low_ov: 'ash', fire_out_ov: 'lantern_dead',
    grave1_ov: 'bones', grave2_ov: 'bones', grave3_ov: 'bones', lever_pulled_ov: null, bag_open_ov: 'lid', medkit_open_ov: 'lid', notebook_gone_ov: null, box_open_ov: 'lid', door_open_ov: null, footprints: 'footprints',
    fire_wet_ov: 'puddle', board_torn_ov: 'pr:slash', bench_torn_ov: 'pr:slash', seat_torn_ov: 'pr:slash', crate_moved_ov: 'footprints', parts_office_ov: 'footprints', parts_gone_ov: 'pr:gap',
    shutter_open_ov: 'pr:gap', radio_on_ov: 'pr:glow', rubble_work_ov: 'footprints', rubble_open_ov: 'pr:gap', pharm_half_ov: 'pr:gap', pharm_open_ov: 'pr:gap', pharm_dark_ov: 'lantern_dead',
    booth_taken_ov: 'lid', valve_open_ov: 'puddle', pump_open_ov: 'pr:gap', pipe_stripped_ov: 'bones' };
  // 화로 상태 → 빛 세기 (땔감이 떨어지면 승강장이 어두워진다 — 숫자 대신 빛으로)
  const FIRE_K = { lit: 1, low: 0.65, out: 0.25, wet: 0.25 };
  // 덧그림을 물건 그림 아래(바닥)로 내려 그릴 것 (화로가 젖었다 = 드럼통 앞 물웅덩이)
  const OV_SHIFT = { fire: [6, 12] };
  // 누가 손댄 물건은 제자리에서 비켜 그린다 (베개가 밀렸다, 수첩이 옮겨졌다)
  const MOVED = { pillow_gicheol: { moved: [9, -3], blood: [9, -3] }, notebook_you: { moved: [-8, 5] } };
  // 기본 상태인데도 늘 보이는 흔적 (물통은 찬 채로 보인다)
  const BASE_TRACE = { bottle: 'bottle_full' };

  function tileKind(map, t, x, y) {
    if (map.id === 'car') return t === '#' ? 'carWall' : 'carFloor';
    if (map.id === 'tunnel') return t === '#' ? 'tunnelWall' : 'track';
    if (/^mall/.test(map.id)) return t === '#' ? 'shutter' : 'marketFloor';
    if (/^drain/.test(map.id)) return t === '#' ? 'pipe' : t === 'w' ? 'water' : 'drainFloor';
    return { '#': 'wall', '.': 'concourse', d: 'concourse', S: 'concourse', ',': 'floor', R: 'floor', '=': 'edge', '~': 'track', B: 'track', w: 'water', A: 'concourse', t: 'concourse', k: 'concourse', E: 'concourse', v: 'concourse', m: 'concourse' }[t] || 'floor';
  }
  const tileAt = (sc, x, y) => (sc.rows[y] || '')[x] || '#';

  let vign = null, fogCv = null, lightCv = null;
  function grain(ctx, cv, tick) {
    if (!vign) { vign = document.createElement('canvas'); vign.width = cv.width; vign.height = cv.height; const g = vign.getContext('2d'); const gr = g.createRadialGradient(cv.width / 2, cv.height / 2, 140, cv.width / 2, cv.height / 2, 380); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); }
    ctx.drawImage(vign, 0, 0);
    if (!fogCv) {
      fogCv = document.createElement('canvas'); fogCv.width = 64; fogCv.height = 64;
      const g = fogCv.getContext('2d'); let s = 7; const R = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      const n = []; for (let i = 0; i < 16; i++) n.push(R());
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const fx = x / 16, fy = y / 16, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0; const v = (ix, iy) => n[((iy & 3) * 4 + (ix & 3))]; const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx, b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx; g.fillStyle = `rgba(170,170,165,${(a * (1 - ty) + b * ty) * 0.16})`; g.fillRect(x, y, 1, 1); }
    }
    const off = (tick * 0.25) % 64;
    for (let y = -64; y < cv.height; y += 64) for (let x = -64; x < cv.width; x += 64) ctx.drawImage(fogCv, x + off, y + (off / 2) % 64);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 12; i++) ctx.fillRect((Math.random() * cv.width) | 0, (Math.random() * cv.height) | 0, 1, 1);
  }

  // 빛: 지도 기본 어둠(maps.dark) + 광원(objects.light, 화로, 당신). 밤은 더 어둡다
  function lighting(ctx, sc, state, lights, tick) {
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== sc.w * T || lightCv.height !== sc.h * T) { lightCv.width = sc.w * T; lightCv.height = sc.h * T; }
    const g = lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, lightCv.width, lightCv.height);
    const night = state.phase === 'night' || state.phase === 'aftermath';
    const dark = Math.min(0.9, (sc.map.dark || 0.4) + (night ? 0.2 : 0));
    g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, lightCv.width, lightCv.height);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of lights) {
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * T, y * T, r * T, 0, Math.PI * 2); g.fill();
    }
    ctx.drawImage(lightCv, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, c) => { const gr = ctx.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect((x - r) * T, (y - r) * T, 2 * r * T, 2 * r * T); };
    if (sc.map.id === 'car' && (tick >> 5) % 3 !== 0) for (const x of [4, 11, 18]) glow(x + 0.5, 1, 3.2, 'rgba(120,10,10,0.35)');
    const fk = state.traces && state.traces.fire ? FIRE_K[state.traces.fire.st] || 1 : 1;
    if (sc.map.fire && sc.map.fire[0] >= 0 && fk > 0.3) glow(sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 4.4 * fk, 'rgba(110,50,10,0.22)');
    ctx.restore();
    if (sc.map.id === 'car' && (tick >> 5) % 3 !== 0) { ctx.fillStyle = 'rgba(140,20,20,0.16)'; ctx.fillRect(0, 0, sc.w * T, sc.h * T); }
  }

  function shadow(ctx, x, y) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x * T + T / 2, y * T + T - 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  // 사람 하나. pose: null(서 있음) · 'sitting'(저녁 화로 둘레, 앉기 실루엣) · 'lying'(밤 잠자리, 눕기 실루엣). 돌려주는 값 = 머리 위 y(반응 아이콘 자리)
  function drawPerson(ctx, id, x, y, frame, hurt, dir, pose) {
    hurt = Math.min(3, hurt || 0);
    const X = Math.round(x * T), Y = Math.round(y * T);
    if (pose === 'lying') {                                                      // 밤: 잠자리(같은 칸의 bed 소품) 위에 머리 + 담요를 겹친다 — 바닥에 쓰러진 몸으로 안 보이게
      const sl = ART.sleeper && ART.sleeper(id, hurt);
      if (sl) { ctx.drawImage(sl, X, Y); return Y + 1; }
      const im = ART.pose('lie', id, hurt);
      if (im) { ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - im.height - 3); return Y + T - im.height - 3; }
      const img = ART.person(ART.spriteId(id), 0, hurt, 'down');
      ctx.save(); ctx.translate(X + T, Y + T / 4); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, img.width * 0.67, img.height * 0.67); ctx.restore(); return Y;
    }
    shadow(ctx, x, y);
    if (pose === 'sitting') {
      const im = ART.pose('sit', id, hurt);
      if (im) { ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - im.height); return Y + T - im.height; }
      const img = ART.person(ART.spriteId(id), 0, hurt, dir || 'down');
      ctx.drawImage(img, 0, 0, T, PH - 12, X, Y - (PH - T) + 12, T, PH - 12); return Y - (PH - T) + 12;
    }
    const img = ART.person(ART.spriteId(id), frame, hurt, dir || 'down');
    ctx.drawImage(img, X, Y - (PH - T));
    return Y - (PH - T);
  }
  // 머리 위 반응: 'eyes' 안 잔다(깜빡임) · 'mouth' 입이 움직인다(굶주림·먹은 흔적). 수치는 그리지 않는다
  function drawReact(ctx, kind, cx, top, tick, phase) {
    const im = ART.react(kind);
    if (!im) return;
    if (kind === 'eyes' && (tick + phase) % 48 < 5) return;                 // 깜빡
    const bob = kind === 'mouth' ? ((tick + phase) >> 3) % 2 : 0;
    ctx.globalAlpha = 0.92; ctx.drawImage(im, Math.round(cx - im.width / 2), top - im.height - 1 + bob); ctx.globalAlpha = 1;
  }
  const drawProp = (ctx, id, X, Y, label) => { const im = ART.prop(id, label); ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y - (im.height - T)); };

  // sc: { map, rows, w, h, px, py, face, moving:{dx,dy,t}|null, steps }, people: [{id, x, y, face, pose, moving, frame, injury, mark}]
  // objs: [{id, x, y, name, solid, state, overlay, light, hidden}]
  function draw(ctx, cv, sc, state, people, objs, tick, opts) {
    opts = opts || {};
    const mx = sc.moving ? sc.px - sc.moving.dx * (1 - sc.moving.t) : sc.px;
    const my = sc.moving ? sc.py - sc.moving.dy * (1 - sc.moving.t) : sc.py;
    const camX = Math.max(0, Math.min(sc.w * T - cv.width, (mx + 0.5) * T - cv.width / 2));
    const camY = Math.min(Math.max(0, Math.min(sc.h * T - cv.height, (my + 0.5) * T - cv.height / 2)), my * T - (PH - T) - 4);
    const ox = sc.w * T < cv.width ? Math.round((cv.width - sc.w * T) / 2) : -Math.round(camX);
    const oy = sc.h * T < cv.height ? Math.round((cv.height - sc.h * T) / 2) : -Math.round(camY);
    ctx.fillStyle = '#050404'; ctx.fillRect(0, 0, cv.width, cv.height);
    sc.cam = { ox, oy };
    ctx.save(); ctx.translate(ox, oy);
    for (let y = 0; y < sc.h; y++) for (let x = 0; x < sc.w; x++) {
      const t = tileAt(sc, x, y), X = x * T, Y = y * T;
      ctx.drawImage(ART.tile(tileKind(sc.map, t, x, y), x, y), X, Y);
      if (t === '#' && tileAt(sc, x, y + 1) !== '#' && y + 1 < sc.h) { ctx.fillStyle = 'rgba(220,200,170,0.10)'; ctx.fillRect(X, Y + T * 0.45, T, T * 0.55); ctx.fillStyle = 'rgba(230,210,180,0.22)'; ctx.fillRect(X, Y + T * 0.45, T, 1); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X, Y + T, T, 4); }
      if (t === 't') drawProp(ctx, 'turnstile', X, Y);
      if (t === 'k') { if (opts.officeOpen) { ctx.fillStyle = '#0c0a09'; ctx.fillRect(X + 4, Y + 2, T - 8, T - 2); ctx.fillStyle = 'rgba(200,170,110,.18)'; ctx.fillRect(X + 4, Y + T - 3, T - 8, 3); } else drawProp(ctx, 'door', X, Y); }
      if (t === 'v') drawProp(ctx, 'stairsDown', X, Y);
      if (t === 'E' && sc.map.id !== 'car') drawProp(ctx, 'stairsUp', X, Y);
      if (t === 'E' && sc.map.id === 'car') { ctx.fillStyle = opts.doorOpen ? '#0a0c10' : '#3a3330'; ctx.fillRect(X, Y, T, T); if (!opts.doorOpen) { ctx.fillStyle = '#56504c'; ctx.fillRect(X + 14, Y, 2, T); } }
      if (t === 'S') { ctx.fillStyle = 'rgba(150,150,145,0.18)'; ctx.fillRect(X, Y, T, T); }
      if (t === 'A') { ctx.fillStyle = '#1a1714'; ctx.fillRect(X, Y, T, T); ctx.fillStyle = '#4a423a'; for (let i = 2; i < T; i += 6) ctx.fillRect(X, Y + i, T, 2); }
      if (t === 'R') drawProp(ctx, 'rubble', X, Y);
      if (t === 'w' && (tick >> 4) % 2) { ctx.fillStyle = 'rgba(134,163,168,0.10)'; ctx.fillRect(X + ((x * 5 + y) % 9) * 2, Y + 14, 10, 2); }
    }
    // 침수: 수위에 따라 물이 찬다
    const flood = state.world.flood || 0;
    for (const [row, from] of sc.map.floodRows || []) if (flood >= from) { ctx.fillStyle = 'rgba(40,70,90,0.55)'; ctx.fillRect(0, row * T, sc.w * T, T); }
    const sprites = [];
    const lights = [];
    // 물건과 흔적
    for (const o of objs) {
      if (o.hidden) continue;
      const X = o.x * T, Y = o.y * T;
      const pid = propFor(o.id);
      sprites.push([o.y - 0.4, () => {
        const mv = MOVED[o.id] && MOVED[o.id][o.state];
        if (pid) drawProp(ctx, pid, X + (mv ? mv[0] : 0), Y + (mv ? mv[1] : 0));
        else if (o.id === 'shutter_gap') { ctx.fillStyle = 'rgba(80,70,60,0.5)'; ctx.fillRect(X, Y + 20, T, 12); }
        const base = Object.keys(BASE_TRACE).find((k) => o.id.startsWith(k + '_'));
        if (base && !o.overlay) ctx.drawImage(ART.trace(BASE_TRACE[base]), X, Y);
        if (o.overlay !== undefined && o.overlay !== null) {
          const guess = o.overlay.replace(/_ov$/, '');
          const file = OVERLAY[o.overlay] === undefined ? (ART.hasTrace(guess) ? guess : null) : OVERLAY[o.overlay];   // 모르는 덧그림 id 는 그리지 않는다(자리표시 없음)
          const sh = OV_SHIFT[o.id] || [0, 0];
          if (file) { const im = ART.trace(file, o.stateName); ctx.drawImage(im, X + Math.round((T - im.width) / 2) + (mv ? mv[0] : 0) + sh[0], Y + T - im.height + (mv ? mv[1] : 0) + sh[1]); }
        }
        if (o.id === 'fire' && (o.state === 'lit' || o.state === 'low')) {          // 불꽃: 꺼지거나 젖으면 없다, 사위면 작다
          const f = (tick >> 2) % 3, k = o.state === 'low' ? 0.5 : 1;
          ctx.fillStyle = ['#e0a24a', '#f0c060', '#d07a2a'][f]; ctx.fillRect(X + 16 - Math.round(5 * k), Y - Math.round(10 * k) + f, Math.round(10 * k), Math.max(2, Math.round((8 - f) * k)));
          ctx.fillStyle = '#fff2c0'; ctx.fillRect(X + 14, Y - Math.round(6 * k) + f, 4, Math.max(2, Math.round(4 * k)));
        } else if (o.id === 'fire') { ctx.fillStyle = `rgba(150,150,145,${0.25 + 0.1 * Math.sin(tick / 7)})`; ctx.fillRect(X + 13, Y - 6 - ((tick >> 3) % 4), 3, 3); ctx.fillRect(X + 17, Y - 10 - ((tick >> 3) % 5), 2, 2); }
        if (o.id === 'notebook_dash' && o.state === 'there') { ctx.fillStyle = `rgba(255,240,200,${0.5 + 0.3 * Math.sin(tick / 9)})`; ctx.fillRect(X + 12, Y + 10, 8, 6); }
      }]);
      if (o.light > 0) lights.push([o.x + 0.5, o.y + 0.5, (1 + o.light * 1.2 + (o.id === 'fire' ? ((tick >> 3) % 3) * 0.2 : 0)) * (o.id === 'fire' ? FIRE_K[o.state] || 1 : 1)]);
    }
    // 사람
    for (const p of people) {
      sprites.push([p.y + (p.pose === 'lying' ? -0.2 : 0), () => {
        const top = drawPerson(ctx, p.id, p.x, p.y, p.frame || 0, p.injury, p.face, p.pose);
        const cx = p.x * T + T / 2;
        if (p.react) drawReact(ctx, p.react, cx, top, tick, p.x * 7 + p.y * 13);
        if (p.mark) { ctx.fillStyle = '#e4ddd0'; ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillText(p.mark, cx + (p.react ? 13 : 0), top - 4 - ((tick >> 4) % 2)); }
        if (p.bubble) { ctx.font = '9px serif'; const w = ctx.measureText(p.bubble).width + 8; const bx = cx - w / 2, by = top - 20; ctx.fillStyle = 'rgba(14,12,10,0.92)'; ctx.fillRect(bx, by, w, 14); ctx.strokeStyle = '#8a7d66'; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 13); ctx.fillStyle = '#e4ddd0'; ctx.textAlign = 'center'; ctx.fillText(p.bubble, cx, by + 10); }
      }]);
      if (p.light) lights.push([p.x + 0.5, p.y + 0.3, p.light]);
    }
    // 당신
    const frame = sc.moving && sc.moving.t > 0.15 && sc.moving.t < 0.85 ? (sc.steps % 2 ? 1 : 2) : 0;
    sprites.push([my, () => { const top = drawPerson(ctx, 'you', mx, my, frame, opts.youHurt || 0, sc.face, null); if (opts.youReact) drawReact(ctx, opts.youReact, mx * T + T / 2, top, tick, 3); }]);
    sprites.sort((a, b) => a[0] - b[0]).forEach((d) => d[1]());
    // 앞에 조사할 것이 있으면 ▾
    if (opts.target) { const tg = opts.target; ctx.fillStyle = '#d0a24a'; const bx = tg.x * T + 12, by = tg.y * T - 28 - ((tick >> 4) % 2) * 2; ctx.fillRect(bx, by, 8, 4); ctx.fillRect(bx + 2, by + 4, 4, 2); }
    lights.push([mx + 0.5, my + 0.3, sc.map.id === 'tunnel' ? 2.2 : 3.5]);
    if (sc.map.fire && sc.map.fire[0] >= 0 && !objs.some((o) => o.id === 'fire')) lights.push([sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 6]);
    lighting(ctx, sc, state, lights, tick);
    ctx.restore();
    grain(ctx, cv, tick);
  }

  window.RENDER = { draw, tileAt, propFor, OVERLAY, PROP, MOVED };
})();
