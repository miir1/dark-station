// 어두운 역 v4 — 지도 그리기. 480×320 캔버스(15×10칸), 타일·소품·흔적 덧그림·사람·빛. 수치는 그리지 않는다 — 흔적과 자세만.
(function () {
  'use strict';
  const T = ART.T, PH = ART.PH;

  // 지도 물건 id → 밑그림 소품 (v3 props). 없으면 자리표시
  const PROP = { fire: 'drum', board: 'board', bench1: 'seat', bench2: 'seat', crate_food: 'crate', parts_crate: 'crate', office_door: 'door', chalk_wall: 'mark', stairs_ash: 'stairsUp',
    shoes_stairs: null, shutter_gap: null, speaker: 'lamp', train_seat: 'seat', cab_window: null, radio: 'radio', body_rail: null, grave: null, pipe: 'pipe_ph', scissors: 'scissors_ph',
    pillow_gicheol: 'pillow_ph', notebook_you: 'notebook_ph', repair_rubble: 'rubble', lever: 'lever', bag: 'sack', cab_door: null, radio_cab: 'radio', medkit: 'medkit', notebook_dash: 'notebook_ph',
    shoe_cab: 'heel', shelter_box: 'crate', vent_shaft: 'vent_ph', rubble: 'rubble', pharmacy_shutter: 'kiosk', phonebooth: 'phone', stall_cart: 'cart', bone_pile: 'bones', bodybag_a2: 'bodybag',
    valve: 'valve', pump_room: 'chaindoor', worker_pipe: 'sludge', cistern: 'tank', ladder_b2: 'ladder' };
  const PROP_LABEL = { pipe_ph: '파이프', scissors_ph: '가위', pillow_ph: '베개', notebook_ph: '수첩', vent_ph: '환기구' };
  const propFor = (id) => { if (/^blanket_/.test(id)) return 'bed'; if (/^(bottle|bowl|bandage)_/.test(id)) return null; return PROP[id] === undefined ? id : PROP[id]; };
  // 흔적 상태 → 덧그림 파일 (objects.overlay 의 id → img/traces 파일). 없으면 상태 이름 자리표시
  const OVERLAY = { bottle_empty_ov: 'bottle_empty', bottle_wet_ov: 'puddle', bowl_empty_ov: 'lid', bowl_meat_ov: 'knife', blanket_rolled_ov: 'blanket_fold', blanket_paired_ov: 'blanket_open', blanket_empty_ov: 'blanket_open',
    pillow_moved_ov: 'pillow', pillow_blood_ov: 'blood_s', ash1_ov: 'ash', ash2_ov: 'ash', ash3_ov: 'ash', shoe_one_ov: 'shoes_pair', shoe_pair_ov: 'shoes_pair', bandage_wet_ov: 'bandage', bandage_rot_ov: 'bandage',
    pipe_blood_ov: 'blood_smear', scissors_blood_ov: 'knife', body_whole_ov: 'cloth_body', body_cut_ov: 'cloth_body', body_buried_ov: 'bones', bones_scat_ov: 'bones', shutter_blood_ov: 'blood_spray', shutter_can_ov: 'lid',
    crate_open_ov: 'lid', crate_empty_ov: 'lid', chalk_lines_ov: 'tally', chalk_names_ov: 'tally', speaker_cut_ov: 'lantern_dead', notebook_moved_ov: 'lens', fire_low_ov: 'ash', fire_out_ov: 'lantern_dead',
    grave1_ov: 'bones', grave2_ov: 'bones', grave3_ov: 'bones', lever_pulled_ov: null, bag_open_ov: 'lid', medkit_open_ov: 'lid', notebook_gone_ov: null, box_open_ov: 'lid', door_open_ov: null, footprints: 'footprints' };
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
    const dark = Math.min(0.92, (sc.map.dark || 0.4) + 0.25 + (night ? 0.15 : 0));
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
    if (sc.map.fire && sc.map.fire[0] >= 0) glow(sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 4.4, 'rgba(110,50,10,0.22)');
    ctx.restore();
    if (sc.map.id === 'car' && (tick >> 5) % 3 !== 0) { ctx.fillStyle = 'rgba(140,20,20,0.16)'; ctx.fillRect(0, 0, sc.w * T, sc.h * T); }
  }

  function shadow(ctx, x, y) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x * T + T / 2, y * T + T - 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawPerson(ctx, id, x, y, frame, hurt, dir, pose) {
    const img = ART.person(ART.spriteId(id), frame, Math.min(3, hurt || 0), dir || 'down');
    if (pose === 'lying') { ctx.save(); ctx.translate(x * T + T, y * T + T / 4); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, img.width * 0.67, img.height * 0.67); ctx.restore(); return; }
    shadow(ctx, x, y);
    if (pose === 'sitting') { ctx.drawImage(img, 0, 0, T, PH - 12, Math.round(x * T), Math.round(y * T) - (PH - T) + 12, T, PH - 12); return; }
    ctx.drawImage(img, Math.round(x * T), Math.round(y * T) - (PH - T));
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
      if (t === 'k') drawProp(ctx, 'door', X, Y);
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
        if (pid) drawProp(ctx, pid, X, Y, PROP_LABEL[pid]);
        else if (o.id === 'shutter_gap') { ctx.fillStyle = 'rgba(80,70,60,0.5)'; ctx.fillRect(X, Y + 20, T, 12); }
        const base = Object.keys(BASE_TRACE).find((k) => o.id.startsWith(k + '_'));
        if (base && !o.overlay) ctx.drawImage(ART.trace(BASE_TRACE[base]), X, Y);
        if (o.overlay !== undefined && o.overlay !== null) {
          const file = OVERLAY[o.overlay] === undefined ? o.overlay.replace(/_ov$/, '') : OVERLAY[o.overlay];
          if (file) { const im = ART.trace(file, o.stateName); ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - im.height); }
        }
        if (o.id === 'fire') { const f = (tick >> 2) % 3; ctx.fillStyle = ['#e0a24a', '#f0c060', '#d07a2a'][f]; ctx.fillRect(X + 11, Y - 10 + f, 10, 8 - f); ctx.fillStyle = '#fff2c0'; ctx.fillRect(X + 14, Y - 6 + f, 4, 4); }
        if (o.id === 'notebook_dash' && o.state === 'there') { ctx.fillStyle = `rgba(255,240,200,${0.5 + 0.3 * Math.sin(tick / 9)})`; ctx.fillRect(X + 12, Y + 10, 8, 6); }
      }]);
      if (o.light > 0) lights.push([o.x + 0.5, o.y + 0.5, 1 + o.light * 1.2 + (o.id === 'fire' ? ((tick >> 3) % 3) * 0.2 : 0)]);
    }
    // 사람
    for (const p of people) {
      sprites.push([p.y, () => {
        drawPerson(ctx, p.id, p.x, p.y, p.frame || 0, p.injury, p.face, p.pose);
        if (p.mark) { ctx.fillStyle = '#e4ddd0'; ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillText(p.mark, p.x * T + T / 2, p.y * T - (PH - T) - 4 - ((tick >> 4) % 2)); }
        if (p.bubble) { ctx.font = '9px serif'; const w = ctx.measureText(p.bubble).width + 8; const bx = p.x * T + T / 2 - w / 2, by = p.y * T - (PH - T) - 20; ctx.fillStyle = 'rgba(14,12,10,0.92)'; ctx.fillRect(bx, by, w, 14); ctx.strokeStyle = '#8a7d66'; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 13); ctx.fillStyle = '#e4ddd0'; ctx.textAlign = 'center'; ctx.fillText(p.bubble, p.x * T + T / 2, by + 10); }
      }]);
      if (p.light) lights.push([p.x + 0.5, p.y + 0.3, p.light]);
    }
    // 당신
    const frame = sc.moving && sc.moving.t > 0.15 && sc.moving.t < 0.85 ? (sc.steps % 2 ? 1 : 2) : 0;
    sprites.push([my, () => drawPerson(ctx, 'you', mx, my, frame, 0, sc.face, null)]);
    sprites.sort((a, b) => a[0] - b[0]).forEach((d) => d[1]());
    // 앞에 조사할 것이 있으면 ▾
    if (opts.target) { const tg = opts.target; ctx.fillStyle = '#d0a24a'; const bx = tg.x * T + 12, by = tg.y * T - 28 - ((tick >> 4) % 2) * 2; ctx.fillRect(bx, by, 8, 4); ctx.fillRect(bx + 2, by + 4, 4, 2); }
    lights.push([mx + 0.5, my + 0.3, sc.map.id === 'tunnel' ? 2.2 : 3.5]);
    if (sc.map.fire && sc.map.fire[0] >= 0 && !objs.some((o) => o.id === 'fire')) lights.push([sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 6]);
    lighting(ctx, sc, state, lights, tick);
    ctx.restore();
    grain(ctx, cv, tick);
  }

  window.RENDER = { draw, tileAt, propFor, OVERLAY };
})();
