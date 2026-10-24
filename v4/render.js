// 어두운 역 v4 — 지도 그리기. 480×320 캔버스(15×10칸), 타일·소품·흔적 덧그림·사람·빛. 수치는 그리지 않는다 — 흔적과 자세만.
// 그리는 층: 바닥 타일 → 물건·사람(아래 줄일수록 앞) → 빛 덮개 → 반응 꼬리표(눈·입·'…') → 안개(지도 안쪽만) → 말풍선(HTML 층 #bubbles, 화면 글씨)
(function () {
  'use strict';
  const T = ART.T, PH = ART.PH;
  // 밤·새벽에 잠든 사람이 숨 쉬는 것(담요 1px)을 보일까 — 디렉터 질문 4의 추천 기본값 '안 보임'(아침에 발견하기 전에 죽음을 먼저 알려 주지 않는다)
  const BREATH_AT_NIGHT = false;

  // 지도 물건 id → 밑그림 소품. 'drum' = v3 props, 'tr:knife' = v4 흔적 덧그림, 'pr:pipe' = 손으로 찍은 작은 그림(art.js PROC). null = 소품 없음(덧그림만)
  // (2026-10-24 P0-S6) 아래 V4P 표에 있는 물건은 v4 소품 그림(props/<이름>)이 먼저다. 이 표는 v4 그림이 없을 때의 대체 그림이다.
  const PROP = { fire: 'drum', board: 'board', bench1: 'seat', bench2: 'seat', crate_food: 'crate', parts_crate: 'crate', office_door: 'door', chalk_wall: 'mark', stairs_ash: 'stairsUp',
    shoes_stairs: null, shutter_gap: null, speaker: 'lamp', train_seat: 'seat', cab_window: null, radio: 'radio', body_rail: null, grave: null, pipe: 'pr:pipe', scissors: 'tr:knife',
    pillow_gicheol: 'tr:pillow', notebook_you: 'pr:notebook', repair_rubble: 'rubble', lever: 'lever', bag: 'sack', cab_door: null, radio_cab: 'radio', medkit: 'medkit', notebook_dash: 'pr:notebook',
    shoe_cab: 'heel', shelter_box: 'crate', vent_shaft: 'pr:vent', rubble: 'rubble', pharmacy_shutter: 'kiosk', phonebooth: 'phone', stall_cart: 'cart', bone_pile: 'bones', bodybag_a2: 'bodybag',
    valve: 'valve', pump_room: 'chaindoor', worker_pipe: 'sludge', cistern: 'tank', ladder_b2: 'ladder', car_shoes: 'shoes', stairs_line: 'pr:chalk' };
  const propFor = (id) => { if (/^blanket_/.test(id)) return 'bed'; if (/^(bottle|bowl|bandage)_/.test(id)) return null; return PROP[id] === undefined ? id : PROP[id]; };
  // ── v4 소품 그림 (P0-A2·A3, 원래 크기): 물건 id(또는 bottle_·bowl_·bandage_ 앞머리) → { 상태: 그림 이름, _: 기본 } ──
  // 상태가 표에 적혀 있으면 그 그림이 그 상태를 보여 준다 → 그 상태의 덧그림(OVERLAY)은 얹지 않는다. 열린 상태는 '<이름>_open' 바꿔치기.
  const V4P = {
    bottle: { _: 'bottle', empty: 'bottle_empty', wet: 'bottle_wet' },
    bowl: { _: 'bowl', empty: 'bowl_empty', meat: 'bowl_meat' },
    bandage: { _: 'bandage', wet: 'bandage_wet', rot: 'bandage_rot', blood: 'bandage_blood' },
    notebook_you: { _: 'notebook', moved: 'notebook_moved' }, notebook_dash: { _: 'notebook' },
    scissors: { _: 'scissors', blood: 'scissors_blood' },
    pipe: { _: 'pipe_stand', blood: 'pipe_stand_blood' },
    shoes_stairs: { _: 'shoe_one', one: 'shoe_one', pair: 'shoe_pair' }, shoe_cab: { _: 'shoe_one' }, car_shoes: { _: 'shoe_pair' },
    crate_food: { _: 'crate', open: 'crate_open', empty: 'crate_empty' },
    parts_crate: { _: 'toolbox', hidden: 'toolbox_open' },                     // 부품 상자 = 공구함 (창고 상자와 다른 그림 — 검수 #9). 그림이 없으면 옛 crate

    shelter_box: { _: 'shelter_box', open: 'shelter_box_open' },
    medkit: { _: 'medkit', open: 'medkit_open' },
    lever: { _: 'lever_box', pulled: 'lever_box_open' },
    bag: { _: 'bag', open: 'bag_open' },
    stairs_line: { _: 'chalk_line' },
  };
  const v4Table = (id) => V4P[id] || V4P[String(id).split('_')[0]] || null;
  // 손 물건: v4 그림이 없으면 옛 32px 그림을 정확히 ½ 로 그린다 (원래 크기로는 절대 그리지 않는다)
  const HAND = /^(bottle|bowl|bandage)_|^(notebook_you|notebook_dash|scissors|knife|shoes_stairs|shoe_cab|car_shoes|radio|radio_cab|medkit)$/;
  // 연 상태(열린 그림이 없으면 닫힌 그림을 30% 어둡게 + 위쪽 2px 검은 틈 — art.js opened)
  const OPEN_ST = { crate_food: ['open', 'empty'], parts_crate: ['hidden'], shelter_box: ['open'], medkit: ['open'], lever: ['pulled'], bag: ['open'], phonebooth: ['taken'] };
  // 물건 하나의 그림: { im(v4 그림 또는 연 수납 대체), absorb(그 상태 덧그림을 안 얹는다), small(손 물건 — 바닥 줄·자리 표), openSt, v4 }
  function lookOf(o) {
    const tb = v4Table(o.id);
    const want = tb ? (tb[o.state] !== undefined ? tb[o.state] : tb._) : null;
    let im = want ? ART.v4prop(want) : null, absorb = !!(im && tb && tb[o.state] !== undefined), small = false;
    const openSt = !!(OPEN_ST[o.id] && OPEN_ST[o.id].includes(o.state));
    if (!im && tb && openSt) { const closed = ART.v4prop(tb._); if (closed) { im = ART.opened(closed); absorb = true; } }   // 열린 그림이 없다 → 닫힌 v4 그림을 어둡게
    if (im) small = HAND.test(o.id) || (im.width <= 14 && im.height <= 12);
    return { im, absorb, small, openSt, v4: !!im };
  }
  // 검수용: 그 물건을 지도에 그리는 그림(크기 비교판 screen_props_scale.png) — v4 가 없으면 손 물건은 ½ 대체
  function artFor(o) {
    const L = lookOf(o);
    if (L.v4) return L.im;
    const pid = propFor(o.id);
    if (pid) return HAND.test(o.id) ? ART.half(ART.prop(pid)) : ART.prop(pid);
    return null;
  }
  // 한 칸에 작은 물건이 여럿이면 칸 안 자리(왼 6 · 가운데 14 · 오른 22px, 폭 8)에 나란히 — 둘이면 왼·오른
  const SLOT_X = [6, 14, 22], SLOT_W = 8;
  // 흔적 상태 → 덧그림 (objects.overlay 의 id → v4 img/traces 파일, 'pr:x' = 손으로 찍은 것, 'v4p:x' = v4 소품 그림). null = 덧그림 없음
  // (2026-10-24 P0-S6) 판자 덧그림 대용을 모두 걷었다 — 열린 상태는 '<소품>_open' 그림을 바꿔치기한다(V4P). 빈 그릇·고기 그릇·신발 한 짝도 v4 작은 그림(bowl_empty·bowl_meat·shoe_one)이 보인다.
  const OVERLAY = { bottle_empty_ov: 'bottle_empty', bottle_wet_ov: 'puddle', bowl_empty_ov: null, bowl_meat_ov: null, blanket_rolled_ov: 'blanket_fold', blanket_paired_ov: 'blanket_open', blanket_empty_ov: 'blanket_open',
    pillow_moved_ov: null, pillow_blood_ov: 'blood_s', ash1_ov: 'ash', ash2_ov: 'ash', ash3_ov: 'ash', shoe_one_ov: 'shoes_pair', shoe_pair_ov: 'shoes_pair', bandage_wet_ov: 'bandage', bandage_rot_ov: 'bandage',
    pipe_blood_ov: 'blood_smear', scissors_blood_ov: 'blood_s', body_whole_ov: 'cloth_body', body_cut_ov: 'cloth_body', body_buried_ov: 'bones', bones_scat_ov: 'bones', shutter_blood_ov: 'blood_spray', shutter_can_ov: 'v4p:can',
    crate_open_ov: null, crate_empty_ov: null, chalk_lines_ov: 'tally', chalk_names_ov: 'tally', speaker_cut_ov: 'lantern_dead', notebook_moved_ov: null, fire_low_ov: 'ash', fire_out_ov: 'lantern_dead',
    grave1_ov: 'bones', grave2_ov: 'bones', grave3_ov: 'bones', lever_pulled_ov: null, bag_open_ov: null, medkit_open_ov: null, notebook_gone_ov: null, box_open_ov: null, door_open_ov: null, footprints: 'footprints',
    fire_wet_ov: 'puddle', board_torn_ov: 'pr:slash', bench_torn_ov: 'pr:slash', seat_torn_ov: 'pr:slash', crate_moved_ov: 'footprints', parts_office_ov: 'footprints', parts_gone_ov: null,
    shutter_open_ov: 'pr:gap', radio_on_ov: 'pr:glow', rubble_work_ov: 'footprints', rubble_open_ov: 'pr:gap', pharm_half_ov: 'pr:gap', pharm_open_ov: 'pr:gap', pharm_dark_ov: 'lantern_dead',
    booth_taken_ov: null, valve_open_ov: 'puddle', pump_open_ov: 'pr:gap', pipe_stripped_ov: 'bones' };
  // 화로 상태 → 빛 세기 (땔감이 떨어지면 승강장이 어두워진다 — 숫자 대신 빛으로)
  const FIRE_K = { lit: 1, low: 0.65, out: 0.25, wet: 0.25 };
  // 덧그림을 물건 그림 아래(바닥)로 내려 그릴 것 (화로가 젖었다 = 드럼통 앞 물웅덩이) — 옛 v3 drum(31줄) 일 때만
  const OV_SHIFT = { fire: [6, 12] };
  // 불 없는 드럼통(props/drum_open, 19줄) 위에서는 화로 덧그림을 드럼통 '밑'(바닥 층)에 먼저 깔고 드럼통을 그 위에 그린다 — 웅덩이·발자국이 통을 가리지 않는다.
  //   사위었다(low)는 덧그림 없이 작은 불꽃·옅은 연기·좁아진 빛으로만 (옛 'ash' 덧그림은 사람 모양 재라 드럼통을 통째로 덮었다)
  const FIRE_UNDER = [0, 6];
  const FIRE_SKIP_OV = { fire_low_ov: true };
  // 벽에 거는 수납(구급함·레버함·벽감 상자 — 물건 칸이 벽 '#')은 벽면 높이로 올려 그린다: 바로 아래 칸에 선 사람의 머리(칸 위로 14px)에 가리지 않게,
  //   머리와 4px 띄운다(붙어 있으면 빨간 구급함이 모자·두건처럼 보였다 — 검증). 지도 위 끝(0행)은 지도 밖으로 나가지 않을 만큼만 올린다 →
  //   덜 올라간 것(터널 벽감 상자)은 game.js 가 여는 동안 쪼그려 앉힌다(wallClear)
  const WALL_LIFT = 18;
  function wallLift(sc, o, im) {
    if (!im || tileAt(sc, o.x, o.y) !== '#') return 0;
    return Math.max(0, Math.min(WALL_LIFT, o.y * T + T - im.height));
  }
  // 벽걸이가 머리 위로 다 올라갔나 (벽 칸이 아니면 false = 바닥 가구)
  function wallClear(sc, o) {
    if (!o || tileAt(sc, o.x, o.y) !== '#') return false;
    const L = lookOf(o);                                                          // 올려 그리는 것은 v4 그림일 때만 (대체 그림은 칸 바닥에 그대로 → 쪼그려 앉는다)
    return !!L.v4 && wallLift(sc, o, L.im) >= WALL_LIFT;
  }
  // 누가 손댄 물건은 제자리에서 비켜 그린다 (베개가 밀렸다, 수첩이 옮겨졌다)
  const MOVED = { pillow_gicheol: { moved: [9, -3], blood: [9, -3] }, notebook_you: { moved: [-8, 5] } };
  // 기본 상태인데도 늘 보이는 흔적 (물통은 찬 채로 보인다)
  const BASE_TRACE = { bottle: 'bottle_full' };

  // 새 타일 글자(P0-D2): 전동차 h = 좌석(위 벽에 붙은 줄 seatTop · 아래 벽 seatBottom, v4 타일이 없으면 바닥 + 옛 seat 소품) · D = 계기판(없으면 carWall) ·
  //   승강장 C = 선로 위 멈춘 전동차 몸체(carWall). 셋 다 막힌 칸 (game.js blocked)
  function tileKind(map, t, x, y) {
    if (map.id === 'car') {
      if (t === 'h') return ART.hasTile('seatTop') ? ((map.rows[y - 1] || '')[x] === '#' ? 'seatTop' : 'seatBottom') : 'carFloor';
      if (t === 'D') return ART.hasTile('dash') ? 'dash' : 'carWall';
      return t === '#' ? 'carWall' : 'carFloor';
    }
    if (map.id === 'tunnel') return t === '#' ? 'tunnelWall' : 'track';
    if (/^mall/.test(map.id)) return t === '#' ? 'shutter' : 'marketFloor';
    if (/^drain/.test(map.id)) return t === '#' ? 'pipe' : t === 'w' ? 'water' : 'drainFloor';
    return { '#': 'wall', '.': 'concourse', d: 'concourse', S: 'concourse', ',': 'floor', R: 'floor', '=': 'edge', '~': 'track', B: 'track', w: 'water', A: 'concourse', t: 'concourse', k: 'concourse', E: 'concourse', v: 'concourse', m: 'concourse', C: 'carWall' }[t] || 'floor';
  }
  const tileAt = (sc, x, y) => (sc.rows[y] || '')[x] || '#';

  // ── 안개·잡음: 지도 안쪽(rect)에만. 잡음 점은 tick 이 바뀔 때만 새로 뽑는다(tick 이 씨앗 — 모니터 Hz 와 상관없이 같은 빠르기) ──
  let vign = null, fogCv = null, lightCv = null, spriteCv = null;
  function grain(ctx, cv, tick, rect) {
    if (!vign) { vign = document.createElement('canvas'); vign.width = cv.width; vign.height = cv.height; const g = vign.getContext('2d'); const gr = g.createRadialGradient(cv.width / 2, cv.height / 2, 140, cv.width / 2, cv.height / 2, 380); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); }
    ctx.drawImage(vign, 0, 0);
    if (!fogCv) {
      fogCv = document.createElement('canvas'); fogCv.width = 64; fogCv.height = 64;
      const g = fogCv.getContext('2d'); let s = 7; const R = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      const n = []; for (let i = 0; i < 16; i++) n.push(R());
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const fx = x / 16, fy = y / 16, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0; const v = (ix, iy) => n[((iy & 3) * 4 + (ix & 3))]; const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx, b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx; g.fillStyle = `rgba(170,170,165,${(a * (1 - ty) + b * ty) * 0.16})`; g.fillRect(x, y, 1, 1); }
    }
    const rx = Math.max(0, rect.x), ry = Math.max(0, rect.y), rw = Math.min(cv.width, rect.x + rect.w) - rx, rh = Math.min(cv.height, rect.y + rect.h) - ry;
    if (rw <= 0 || rh <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    const off = (tick * 0.25) % 64;
    for (let y = -64; y < cv.height; y += 64) for (let x = -64; x < cv.width; x += 64) ctx.drawImage(fogCv, x + off, y + (off / 2) % 64);
    let s = (Math.imul(tick | 0, 2654435761) ^ 0x5bd1e995) >>> 0; const R = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 12; i++) ctx.fillRect(rx + ((R() * rw) | 0), ry + ((R() * rh) | 0), 1, 1);
    ctx.restore();
  }

  // 화로 불빛이 떤다(사인 두 개를 겹친다). 반경에 곱하는 값 0.94~1.06
  const fireWobble = (now) => 1 + 0.045 * Math.sin(now / 170) + 0.018 * Math.sin(now / 61);

  // 밝기 안 (P1-1, 디렉터 질문 5 — 고치기 전·후 캡처를 보고 정한다. 기본은 꺼짐 = 지금 그대로): 주소에 ?light=p1 이면
  //   바닥 → 빛 덮개 → 사람·가구(따로 그린 층에 빛 덮개 ×0.5) 순서 — 바닥은 지금 어둠 그대로, 사람·물건은 어둠을 반만 받는다 · 당신 둘레 빛을 넓혀 3칸 안 최소 밝기를 지킨다
  const LIGHT_P1 = typeof location !== 'undefined' && /[?&]light=p1(&|$)/.test(location.search || '');
  // 빛: 지도 기본 어둠(maps.dark) + 광원(objects.light, 화로, 당신). 밤은 더 어둡다
  function lighting(ctx, sc, state, lights, tick, now, applied) {
    if (!applied) ctx.drawImage(darkLayer(sc, state, lights), 0, 0);            // 밝기 안은 덮개를 이미 나눠 깔았다 (바닥 전부 · 사람·가구 층 반)
    glows(ctx, sc, state, lights, tick, now);
  }
  function darkLayer(sc, state, lights) {
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== sc.w * T || lightCv.height !== sc.h * T) { lightCv.width = sc.w * T; lightCv.height = sc.h * T; }
    const g = lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, lightCv.width, lightCv.height);
    const night = state.phase === 'night' || state.phase === 'aftermath';
    const dark = Math.min(0.9, (sc.map.dark || 0.4) + (night ? 0.2 : 0));
    g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, lightCv.width, lightCv.height);
    g.globalCompositeOperation = 'destination-out';
    // 광원: [x, y, r] = 둥근 빛 · [x, y, r, 방향(라디안), 폭] = 부채꼴 빛(기철 헤드램프 40°, P0-S5) — 빛 뿌리 둘레는 작게 둥글게 밝혀 얼굴이 보인다
    for (const [x, y, r, dir, spread] of lights) {
      if (dir != null) {
        const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x * T, y * T); g.arc(x * T, y * T, r * T, dir - spread / 2, dir + spread / 2); g.closePath(); g.fill();
        const gs = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, 0.95 * T);
        gs.addColorStop(0, 'rgba(0,0,0,0.8)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gs; g.beginPath(); g.arc(x * T, y * T, 0.95 * T, 0, Math.PI * 2); g.fill();
        continue;
      }
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * T, y * T, r * T, 0, Math.PI * 2); g.fill();
    }
    return lightCv;
  }
  function glows(ctx, sc, state, lights, tick, now) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, c) => { const gr = ctx.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect((x - r) * T, (y - r) * T, 2 * r * T, 2 * r * T); };
    if (sc.map.id === 'car' && (tick >> 5) % 3 !== 0) for (const x of [4, 11, 18]) glow(x + 0.5, 1, 3.2, 'rgba(120,10,10,0.35)');
    const fk = state.traces && state.traces.fire ? FIRE_K[state.traces.fire.st] || 1 : 1;
    if (sc.map.fire && sc.map.fire[0] >= 0 && fk > 0.3) glow(sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 4.4 * fk * fireWobble(now), 'rgba(110,50,10,0.22)');
    // 헤드램프 부채꼴에 옅은 누런 빛 (손전등 색)
    for (const [x, y, r, dir, spread] of lights) {
      if (dir == null) continue;
      const gr = ctx.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(120,105,60,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x * T, y * T); ctx.arc(x * T, y * T, r * T, dir - spread / 2, dir + spread / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (sc.map.id === 'car' && (tick >> 5) % 3 !== 0) { ctx.fillStyle = 'rgba(140,20,20,0.16)'; ctx.fillRect(0, 0, sc.w * T, sc.h * T); }
    // 전동차 운전실 문틈 빛 (P0-S6): x=18 에서 3행 바닥을 따라 x=12 까지 흰 빛 띠 — 객실의 붉은 비상등과 대비
    if (sc.map.id === 'car') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const x1 = 19 * T, x0 = 12 * T, yb = 3 * T + 18;                          // 바닥 쪽(칸 아래 절반)을 따라 — 가운데가 밝고 위아래로 옅어지는 띠
      const gr = ctx.createLinearGradient(x1, 0, x0, 0);
      const a = 0.24 + 0.03 * Math.sin(now / 410);
      gr.addColorStop(0, `rgba(215,225,240,${a.toFixed(3)})`); gr.addColorStop(0.3, `rgba(200,210,228,${(a * 0.6).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      const PROFILE = [0.12, 0.3, 0.55, 0.8, 1, 1, 0.8, 0.55, 0.3, 0.12];
      PROFILE.forEach((k, i) => { ctx.globalAlpha = k; ctx.fillRect(x0, yb - 5 + i, x1 - x0, 1); });
      ctx.restore();
    }
  }

  // ── 불꽃: 손으로 찍은 5장(10×14, 4색)을 초당 10장으로 돌리고 불티 1~2점. 불 없는 드럼통(props/drum_open) 위에만 그린다 ──
  const FLAME_COL = { a: '#7a2410', b: '#c85a1e', c: '#eea040', d: '#fde7a0' };
  const FLAME_BASE = ['..abccba..', '.abccccba.', '.abcddcba.', 'abccddccba', 'abcddddcba', 'abcddddcba', '.abccccba.', '..abbbba..'];   // 아래 8줄(6~13행)
  const FLAME_TOP = [
    ['....a.....', '....ab....', '....aba...', '...abba...', '...abba...', '..abcba...'],
    ['.....a....', '.....ab...', '....aba...', '....abba..', '...abba...', '...abcba..'],
    ['..........', '...a......', '...ab.....', '..aba..a..', '..abba.a..', '..abccba..'],
    ['......a...', '.....ab...', '....abba..', '....abba..', '...abcba..', '..abccba..'],
    ['......a...', '...a.a....', '...ab.....', '...aba....', '..abba....', '..abcba...'],
  ];
  let flameCv = null;
  function flameFrames() {
    if (flameCv) return flameCv;
    flameCv = FLAME_TOP.map((top) => {
      const c = document.createElement('canvas'); c.width = 10; c.height = 14; const g = c.getContext('2d');
      top.concat(FLAME_BASE).forEach((row, y) => { for (let x = 0; x < 10; x++) { const ch = row[x]; if (ch !== '.') { g.fillStyle = FLAME_COL[ch]; g.fillRect(x, y, 1, 1); } } });
      return c;
    });
    return flameCv;
  }
  // x0 = 불꽃 왼쪽, yb = 불꽃 바닥(드럼통 아가리). low = 사위어 간다(아래 8줄만)
  function drawFlame(ctx, x0, yb, now, low) {
    const fr = flameFrames()[Math.floor(now / 100) % 5];
    const skip = low ? 6 : 0;
    ctx.drawImage(fr, 0, skip, 10, 14 - skip, x0, yb - 14 + skip, 10, 14 - skip);
    for (let i = 0; i < 2; i++) {                                                // 불티: 하나는 늘, 하나는 가끔
      const ph = (now / 900 + i * 0.47) % 1;
      if (i === 1 && ph > 0.55) continue;
      const sx = x0 + 5 + Math.round(Math.sin(now / 230 + i * 2.1) * 3), sy = yb - 14 + skip - 1 - Math.round(ph * 9);
      ctx.fillStyle = `rgba(255,214,140,${(1 - ph).toFixed(2)})`; ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // ── 젖은 화로 (props/drum_open: 몸통 8~23열, 아가리 = 맨 윗줄): 불꽃 없이 흰 김 두 줄기가 아가리에서 엇갈려 오르고,
  //   통 옆으로 물줄기 세 가닥이 흘러내리며 한 방울이 떨어진다. 웅덩이(덧그림)는 통 밑 바닥에 따로 깔린다 ──
  function drawSteam(ctx, X, mouth, now) {
    for (let i = 0; i < 2; i++) {
      const ph = (now / 1400 + i * 0.5) % 1;
      for (let k = 0; k < 5; k++) {
        const q = (ph + k * 0.2) % 1;                                             // 이 김 점이 오른 몫 (0 아가리 → 1 13px 위)
        const x = X + 13 + i * 5 + Math.round(Math.sin(now / 300 + k * 1.3 + i * 2) * (1 + q * 2));
        const y = mouth - 1 - Math.round(q * 14), w = q > 0.35 ? 2 : 1;
        ctx.fillStyle = `rgba(220,220,214,${(0.7 * (1 - q * 0.85)).toFixed(3)})`; ctx.fillRect(x, y, w, w);
      }
    }
    ctx.fillStyle = 'rgba(110,150,165,0.55)';
    for (const [dx, len] of [[9, 7], [12, 4], [20, 9]]) ctx.fillRect(X + dx, mouth + 1, 1, len);
    ctx.fillStyle = 'rgba(190,215,225,0.75)';
    ctx.fillRect(X + 20, mouth + 1 + (Math.floor(now / 90) % 14), 1, 1);
  }

  // ── 걷기 4박자: 걸은 거리 16px 마다 왼발 → 섬 → 오른발 → 섬. 이어 걸으면 칸 경계에서 섬으로 돌아가지 않고, 멈추면 섬 (주민이 걸을 때도 이것) ──
  const WALK_BEAT = [1, 0, 2, 0];
  const walkFrame = (dist, moving) => (moving ? WALK_BEAT[Math.floor(Math.max(0, dist) / 16) % 4] : 0);
  // 서 있는 사람의 숨: 2.4초에 한 번 윗몸(위 28줄)이 1px 내려갔다 돌아온다. 사람마다 시작이 다르다
  const phaseOf = (id) => { let h = 17; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; };
  const breathOf = (now, id, period) => (((now / period + phaseOf(id)) % 1) < 0.5 ? 1 : 0);

  function shadow(ctx, x, y) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x * T + T / 2, y * T + T - 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  // 사람 하나. pose: null(서 있음) · 'sitting'(저녁 화로 둘레, 앉기 실루엣) · 'lying'(밤 잠자리, 눕기 실루엣).
  // fx: { breath: 0|1 서 있는 윗몸 1px · sleepBreath: 0|1 담요 가운데 1px }. 돌려주는 값 = 그림에서 읽은 머리 꼭대기 y(반응 꼬리표·말풍선 자리)
  function drawPerson(ctx, id, x, y, frame, hurt, dir, pose, fx) {
    hurt = Math.min(3, hurt || 0); fx = fx || {};
    const X = Math.round(x * T), Y = Math.round(y * T);
    if (pose === 'lying') {                                                      // 밤: 잠자리(같은 칸의 bed 소품) 위에 머리 + 담요를 겹친다 — 바닥에 쓰러진 몸으로 안 보이게
      const sl = ART.sleeper && ART.sleeper(id, hurt);
      if (sl) {                                                                  // 사람마다 잠 그림(sleep/<id>)이 먼저, 없으면 만든 것 (art.js)
        ctx.drawImage(sl, X, Y);
        if (fx.sleepBreath) ctx.drawImage(sl, 10, 13, 12, 14, X + 10, Y + 12, 12, 14);   // 담요 가운데가 1px 솟는다
        return Y + ART.opaqueTop(sl);
      }
      const im = ART.pose('lie', id, hurt);
      if (im) { ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - im.height - 3); return Y + T - im.height - 3 + ART.opaqueTop(im); }
      const img = ART.person(ART.spriteId(id), 0, hurt, 'down');
      ctx.save(); ctx.translate(X + T, Y + T / 4); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, img.width * 0.67, img.height * 0.67); ctx.restore(); return Y;
    }
    shadow(ctx, x, y);
    if (pose === 'crouch') {                                                     // 쪼그려 앉음 (만나기 전 순례: 화로를 보고 장작을 넣는다, P0-S5) — 걷기 그림의 아래 12줄을 접어 방향이 보이게
      const sid0 = ART.spriteId(id), img = ART.person(sid0, 0, hurt, dir || 'down');
      const reach = fx.stoke ? 1 : 0;                                            // 장작을 넣는 손짓: 화로 쪽으로 1px
      const X0 = X + Math.round((T - img.width) / 2) + (dir === 'right' ? reach : dir === 'left' ? -reach : 0), top = Y + T - img.height + 12;
      ctx.drawImage(img, 0, 0, img.width, img.height - 12, X0, top, img.width, img.height - 12);
      return top + ART.headTop(sid0, 0, dir || 'down');
    }
    if (pose === 'sitting') {                                                    // 사람마다 앉기 그림(sit/<id>, 4방향) → 공용 실루엣 물들이기 → 걷기 그림 아래를 접는다
      const own = ART.sitPose && ART.sitPose(id, dir || 'down', hurt);
      if (own) { const top = Y + T - own.height; ctx.drawImage(own, X + Math.round((T - own.width) / 2), top); return top + ART.opaqueTop(own); }
      const im = ART.pose('sit', id, hurt);
      if (im) { const top = Y + T - im.height; ctx.drawImage(im, X + Math.round((T - im.width) / 2), top); return top + ART.opaqueTop(im); }
      const img = ART.person(ART.spriteId(id), 0, hurt, dir || 'down');
      const top = Y + T - img.height + 12;
      ctx.drawImage(img, 0, 0, img.width, img.height - 12, X + Math.round((T - img.width) / 2), top, img.width, img.height - 12);
      return top + ART.headTop(ART.spriteId(id), 0, dir || 'down');
    }
    const sid = ART.spriteId(id);
    const img = ART.person(sid, frame, hurt, dir || 'down');
    const X0 = X + Math.round((T - img.width) / 2), Y0 = Y + T - img.height + (frame ? 1 : 0);   // 발 칸(왼발·오른발)은 1px 아래 = 걸음마다 몸이 출렁인다
    const b = fx.breath ? 1 : 0;
    if (b) {
      const cut = img.height - (PH - 28);                                        // 위 28줄(48 기준) = 윗몸
      ctx.drawImage(img, 0, cut, img.width, img.height - cut, X0, Y0 + cut, img.width, img.height - cut);
      ctx.drawImage(img, 0, 0, img.width, cut, X0, Y0 + b, img.width, cut);
    } else ctx.drawImage(img, X0, Y0);
    return Y0 + b + ART.headTop(sid, frame, dir || 'down');
  }

  // ── 반응 꼬리표: 1px 테두리 어두운 11×11 안에 눈(안 잠)·입(굶주림·먹은 흔적)·'…'(아직 이야기 안 함). 빛 덮개 뒤에 그려 늘 보인다 ──
  const TAG = 11;
  function tagBox(ctx, x0, y0) {
    ctx.fillStyle = 'rgba(12,10,9,0.92)'; ctx.fillRect(x0, y0, TAG, TAG);
    ctx.strokeStyle = '#7d7262'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, TAG - 1, TAG - 1);
  }
  function drawTag(ctx, t, tick) {
    tagBox(ctx, t.x0, t.y0);
    if (t.kind === 'mark') {                                                     // '…' = 점 셋 (글꼴 없이 점으로)
      const dy = (tick >> 4) % 2;
      ctx.fillStyle = '#e4ddd0'; for (const dx of [3, 5, 7]) ctx.fillRect(t.x0 + dx, t.y0 + 6 - dy, 1, 1);
      return;
    }
    const im = ART.reactIcon(t.kind);
    if (!im) return;
    const ix = t.x0 + Math.floor((TAG - im.width) / 2), iy = t.y0 + Math.floor((TAG - im.height) / 2);
    if (t.kind === 'eyes' && (tick + t.phase) % 48 < 5) { ctx.fillStyle = '#c9c0b0'; ctx.fillRect(ix, iy + (im.height >> 1), im.width, 1); return; }   // 깜빡 = 감은 눈 한 줄
    const bob = t.kind === 'mouth' && im.height < TAG - 2 ? ((tick + t.phase) >> 3) % 2 : 0;
    ctx.drawImage(im, ix, iy + bob);
  }
  const drawProp = (ctx, id, X, Y, label) => { const im = ART.prop(id, label); ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y - (im.height - T)); return Y - (im.height - T); };
  const drawImg = (ctx, im, X, Y) => { ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - im.height); return Y + T - im.height; };

  // ── 말풍선 HTML 층(#bubbles): 카메라·배율을 따라 자리를 잡고, 글씨는 화면 기준 12px · 최대 폭 논리 120px. 빛 덮개와 상관없다 ──
  // 층은 #app 배율(k)을 1/k 로 되돌려 화면 픽셀로 쓴다 → 글씨가 배율과 상관없이 또렷하다
  let scaleK = 1, bubLayer = null;
  const bubEls = new Map();
  function layer() { if (!bubLayer) bubLayer = document.getElementById('bubbles'); return bubLayer; }
  function setScale(k) {
    scaleK = k;
    const L = layer(); if (!L) return;
    L.style.width = 480 * k + 'px'; L.style.height = 320 * k + 'px'; L.style.transform = `scale(${1 / k})`;
    for (const el of bubEls.values()) { el.style.maxWidth = 120 * k + 'px'; el._w = 0; }
  }
  function syncBubbles(list, ox, oy) {
    const L = layer(); if (!L) return;
    const k = scaleK, seen = new Set();
    for (const b of list) {
      let el = bubEls.get(b.key);
      if (!el) { el = document.createElement('div'); el.className = 'bub'; el.style.maxWidth = 120 * k + 'px'; L.appendChild(el); bubEls.set(b.key, el); }
      if (el.textContent !== b.text) { el.textContent = b.text; el._w = 0; }
      if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; }
      const left = Math.max(2, Math.min(480 * k - el._w - 2, Math.round((b.x + ox) * k - el._w / 2)));
      const top = Math.max(2, Math.round((b.y + oy) * k - el._h));
      const tf = `translate(${left}px,${top}px)`;
      if (el._tf !== tf) { el._tf = tf; el.style.transform = tf; }
      seen.add(b.key);
    }
    for (const [key, el] of bubEls) if (!seen.has(key)) { el.remove(); bubEls.delete(key); }
  }
  const clearBubbles = () => syncBubbles([], 0, 0);

  // sc: { map, rows, w, h, px, py, face, moving:{dx,dy,t}|null, steps, walkDist }, people: [{id, x, y, face, pose, walkDist, moving, frame, injury, mark, react, bubble, light}]
  // objs: [{id, x, y, name, solid, state, overlay, light, hidden, bubble}]
  // opts: { now(ms), target, doorOpen, officeOpen, youHurt, youReact, rubble:[[x,y]…] 잔해를 더 그릴 칸 }
  function draw(ctx, cv, sc, state, people, objs, tick, opts) {
    opts = opts || {};
    const now = opts.now != null ? opts.now : tick * 33.3;
    // 셔터 두드림(D1 낮, 셔터 너머 사람을 아직 안 만났을 때): 2.6초마다 쿵·쿵·쿵 — 그때만 1px
    const knock = opts.knock ? (((now % 2600) < 110 || ((now % 2600) > 330 && (now % 2600) < 440) || ((now % 2600) > 660 && (now % 2600) < 770)) ? 1 : 0) : 0;
    // 막 연 수납 가구: 0.4초 동안 1px 흔들린다 (opts.shake = { ids:[…], until })
    const shakeOf = (id) => (opts.shake && now < opts.shake.until && opts.shake.ids.includes(id) ? (Math.floor(now / 45) % 2 ? 1 : -1) : 0);
    // 위치는 논리 픽셀 정수로 (사람과 카메라가 같은 픽셀에 선다)
    const mx = Math.round((sc.moving ? sc.px - sc.moving.dx * (1 - sc.moving.t) : sc.px) * T) / T;
    const my = Math.round((sc.moving ? sc.py - sc.moving.dy * (1 - sc.moving.t) : sc.py) * T) / T;
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
      if (t === 'A') { const k = knock; ctx.fillStyle = '#1a1714'; ctx.fillRect(X, Y, T, T); ctx.fillStyle = '#4a423a'; for (let i = 2; i < T; i += 6) ctx.fillRect(X + k, Y + i, T - Math.abs(k), 2); }   // 셔터: 두드리면 1px 흔들린다
      if (t === 'h' && !ART.hasTile('seatTop')) drawProp(ctx, 'seat', X, Y);   // 새 좌석 타일이 없으면 옛 seat 소품
      if (t === 'R') drawProp(ctx, 'rubble', X, Y);
      if (t === 'w' && (tick >> 4) % 2) { ctx.fillStyle = 'rgba(134,163,168,0.10)'; ctx.fillRect(X + ((x * 5 + y) % 9) * 2, Y + 14, 10, 2); }
    }
    // 침수: 수위에 따라 물이 찬다
    const flood = state.world.flood || 0;
    for (const [row, from] of sc.map.floodRows || []) if (flood >= from) { ctx.fillStyle = 'rgba(40,70,90,0.55)'; ctx.fillRect(0, row * T, sc.w * T, T); }
    const night = state.phase === 'night' || state.phase === 'aftermath';
    // 빛을 먼저 모은다 (서 있는 사람의 숨은 빛 반경 안에서만)
    const lights = [];
    for (const o of objs) if (!o.hidden && o.light > 0) lights.push([o.x + 0.5, o.y + 0.5, (1 + o.light * 1.2) * (o.id === 'fire' ? (FIRE_K[o.state] || 1) * fireWobble(now) : 1)]);
    for (const p of people) if (p.light) lights.push([p.x + 0.5, p.y + 0.3, p.light]);
    for (const p of people) if (p.beam) lights.push([p.x + 0.5 + (p.beam.ox || 0), p.y + (p.beam.oy != null ? p.beam.oy : -0.35), p.beam.r, p.beam.ang, p.beam.spread]);
    lights.push([mx + 0.5, my + 0.3, sc.map.id === 'tunnel' ? (LIGHT_P1 ? 2.8 : 2.2) : (LIGHT_P1 ? 4.6 : 3.5)]);
    if (sc.map.fire && sc.map.fire[0] >= 0 && !objs.some((o) => o.id === 'fire')) lights.push([sc.map.fire[0] + 0.5, sc.map.fire[1] + 0.5, 6]);
    const lit = (x, y) => lights.some(([lx, ly, r]) => Math.hypot(x + 0.5 - lx, y + 0.5 - ly) < r * 0.85);
    // 밝기 안: 바닥은 어둠을 다 받고, 사람·가구는 따로 그린 층에 어둠을 반만 얹어 붙인다
    const mainCtx = ctx;
    let sctx = null;
    if (LIGHT_P1) {
      ctx.drawImage(darkLayer(sc, state, lights), 0, 0);
      if (!spriteCv) spriteCv = document.createElement('canvas');
      if (spriteCv.width !== cv.width || spriteCv.height !== cv.height) { spriteCv.width = cv.width; spriteCv.height = cv.height; }
      sctx = spriteCv.getContext('2d'); sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, spriteCv.width, spriteCv.height); sctx.imageSmoothingEnabled = false; sctx.translate(ox, oy);
    }

    const sprites = [], tags = [], bubbles = [];
    const drumOpen = ART.v4prop('drum_open');                                    // 불을 지운 드럼통 그림이 있을 때만 코드 불꽃 (불이 둘이 되지 않게)
    // 물건마다 그릴 그림 (P0-S6): v4 소품(원래 크기) → 대체(손 물건 = 옛 그림 ½ · 연 수납 = 닫힌 그림 어둡게 + 틈) → 옛 소품
    const look = new Map();
    for (const o of objs) if (!o.hidden) look.set(o, lookOf(o));
    // 한 칸에 작은 물건이 여럿이면 자리 표대로 나란히 (왼 6 · 가운데 14 · 오른 22, 폭 8)
    const cellSmall = new Map();
    for (const o of objs) { const L = look.get(o); if (!L || !L.small) continue; const k = o.x + ',' + o.y; if (!cellSmall.has(k)) cellSmall.set(k, []); cellSmall.get(k).push(o); }
    const smallX = (o, im) => {
      const list = cellSmall.get(o.x + ',' + o.y) || [o], n = list.length, i = list.indexOf(o);
      if (n <= 1) return Math.round((T - im.width) / 2);
      const slot = n === 2 ? [0, 2][i] : Math.min(SLOT_X.length - 1, i);
      return SLOT_X[slot] + Math.round((SLOT_W - im.width) / 2);
    };
    // 물건과 흔적
    for (const o of objs) {
      if (o.hidden) continue;
      const X = o.x * T + shakeOf(o.id), Y = o.y * T;
      const pid = propFor(o.id);
      const L = look.get(o) || {};
      sprites.push([o.y - 0.4, () => {
        const mv = MOVED[o.id] && MOVED[o.id][o.state];
        const mx0 = mv ? mv[0] : 0, my0 = mv ? mv[1] : 0;
        let top = Y;
        const ovFile = () => {                                                    // 이 상태의 덧그림 파일 (모르는 덧그림 id 는 그리지 않는다 — 자리표시 없음)
          if (o.overlay === undefined || o.overlay === null || L.absorb) return null;
          const guess = o.overlay.replace(/_ov$/, '');
          return OVERLAY[o.overlay] === undefined ? (ART.hasTrace(guess) ? guess : null) : OVERLAY[o.overlay];
        };
        const fireUnder = o.id === 'fire' && drumOpen;
        if (fireUnder) {                                                          // 화로 덧그림(웅덩이·발자국)은 드럼통 밑 바닥에 먼저
          const file = FIRE_SKIP_OV[o.overlay] ? null : ovFile();
          if (file && !file.startsWith('v4p:')) { const im = ART.trace(file, o.stateName); ctx.drawImage(im, X + Math.round((T - im.width) / 2) + FIRE_UNDER[0], Y + T - im.height + FIRE_UNDER[1]); }
          top = drawImg(ctx, drumOpen, X, Y);
        } else if (L.v4) {
          const im = L.im;
          if (o.id === 'stairs_line') { top = Y + 2; ctx.drawImage(im, X + Math.round((T - im.width) / 2), top); }   // 분필 줄: 계단 발치(칸 위쪽)를 가로지른다
          else if ((L.small && tileAt(sc, o.x, o.y) !== '#') || o.id === 'pipe') { top = Y + T - 3 - im.height + my0; ctx.drawImage(im, X + smallX(o, im) + mx0, top); }   // 손 물건·세운 파이프: 바닥 줄(Y+T−3)에 원래 크기 (벽 칸 '#' 의 것은 벽걸이 — 아래 가구 줄)
          else { top = Y + T - im.height - wallLift(sc, o, im); ctx.drawImage(im, X + Math.round((T - im.width) / 2), top); }   // 가구: 칸 아래 가운데 (벽에 거는 것은 벽면 높이로) · 옆으로 열리는 짝은 캔버스가 넓다 — 가운데에 두면 몸통이 칸 가운데
        } else if (pid && HAND.test(o.id)) {                                     // 손 물건 대체: 옛 32px 그림을 정확히 ½
          const im = ART.half(L.openSt ? ART.opened(ART.prop(pid)) : ART.prop(pid));
          top = Y + T - 3 - im.height; ctx.drawImage(im, X + Math.round((T - im.width) / 2) + mx0, top + my0);
        } else if (pid) {
          if (L.openSt) { const im = ART.opened(ART.prop(pid)); top = drawImg(ctx, im, X + mx0, Y + my0); }
          else top = drawProp(ctx, pid, X + mx0, Y + my0);
        } else if (o.id === 'shutter_gap') { ctx.fillStyle = 'rgba(80,70,60,0.5)'; ctx.fillRect(X + knock, Y + 20, T - knock, 12); }
        const base = Object.keys(BASE_TRACE).find((k) => o.id.startsWith(k + '_'));
        if (base && !o.overlay && !L.v4) { const im = ART.half(ART.trace(BASE_TRACE[base])); ctx.drawImage(im, X + Math.round((T - im.width) / 2), Y + T - 3 - im.height); }   // 찬 물통 대체(½)
        if (!fireUnder && o.overlay !== undefined && o.overlay !== null && !L.absorb) {
          const file = ovFile();
          const sh = OV_SHIFT[o.id] || [0, 0];
          if (file && file.startsWith('v4p:')) { const im = ART.v4prop(file.slice(4)); if (im) ctx.drawImage(im, X + Math.round((T - im.width) / 2) + sh[0], Y + T - 3 - im.height + sh[1]); }   // 셔터 앞 깡통 등: v4 작은 그림
          else if (file) { let im = ART.trace(file, o.stateName); if (HAND.test(o.id) && !L.v4) im = ART.half(im); ctx.drawImage(im, X + Math.round((T - im.width) / 2) + mx0 + sh[0], Y + T - im.height + my0 + sh[1]); }
        }
        // 화로 상태는 드럼통 '위'의 불꽃·연기·물기로 보인다 (덧그림이 드럼통을 덮지 않는다): 탄다(lit)·누가 지켰다(kept, 발자국은 밑에) = 불꽃 ·
        //   사위었다(low) = 작은 불꽃 + 옅은 연기 한 줄기 · 젖었다(wet) = 불꽃 없이 흰 김 두 줄기 + 아가리에서 흘러내린 물줄기 (웅덩이는 밑에)
        if (o.id === 'fire' && drumOpen) {
          const mouth = top + ART.opaqueTop(drumOpen);
          if (o.state === 'lit' || o.state === 'low' || o.state === 'kept') drawFlame(ctx, X + 11, mouth + 3, now, o.state === 'low');
          if (o.state === 'low') {
            const sy = mouth - 8;
            ctx.fillStyle = `rgba(150,150,145,${(0.18 + 0.08 * Math.sin(tick / 7)).toFixed(3)})`; ctx.fillRect(X + 15, sy - ((tick >> 3) % 4), 2, 2); ctx.fillRect(X + 17, sy - 4 - ((tick >> 3) % 5), 1, 1);
          }
          if (o.state === 'wet') drawSteam(ctx, X, mouth, now);
        } else if (o.id === 'fire' && o.state !== 'lit' && o.state !== 'kept') { ctx.fillStyle = `rgba(150,150,145,${0.25 + 0.1 * Math.sin(tick / 7)})`; ctx.fillRect(X + 13, Y - 6 - ((tick >> 3) % 4), 3, 3); ctx.fillRect(X + 17, Y - 10 - ((tick >> 3) % 5), 2, 2); }
        if (o.id === 'notebook_dash' && o.state === 'there') {                   // 계기판 위 수첩이 은은히 빛난다 (작은 수첩 둘레 1px)
          ctx.fillStyle = `rgba(255,240,200,${(0.35 + 0.25 * Math.sin(tick / 9)).toFixed(3)})`;
          if (L.v4) { const im = L.im; const nx = X + Math.round((T - im.width) / 2) - 1, ny = Y + T - 3 - im.height - 1; ctx.fillRect(nx, ny, im.width + 2, 1); ctx.fillRect(nx, ny + im.height + 1, im.width + 2, 1); ctx.fillRect(nx, ny, 1, im.height + 2); ctx.fillRect(nx + im.width + 1, ny, 1, im.height + 2); }
          else ctx.fillRect(X + 12, Y + 18, 8, 6);
        }
        if (o.bubble) bubbles.push({ key: 'o:' + o.id, text: o.bubble, x: X + T / 2, y: top - 2 });
      }]);
    }
    // 터널 잔해: 막힌 열의 나머지 칸에도 (보이지 않는 벽 없음)
    for (const [rx, ry] of opts.rubble || []) sprites.push([ry - 0.4, () => drawProp(ctx, 'rubble', rx * T, ry * T)]);
    // 사람
    const near = (x, y) => Math.abs(x - sc.px) + Math.abs(y - sc.py) <= 4;
    for (const p of people) {
      sprites.push([p.y + (p.pose === 'lying' ? -0.2 : 0), () => {
        const frame = p.walkDist != null ? walkFrame(p.walkDist, !!p.moving) : (p.frame || 0);
        const fx = {
          breath: !p.pose && !p.moving && !frame && lit(p.x, p.y) ? breathOf(now, p.id, 2400) : 0,
          sleepBreath: p.pose === 'lying' && (BREATH_AT_NIGHT || !night) ? breathOf(now, p.id, 3000) : 0,
          stoke: p.stoke ? ((now + phaseOf(p.id) * 1600) % 1600) < 320 : false,   // 장작을 넣는 손짓 (1.6초에 한 번)
        };
        const top = drawPerson(ctx, p.id, p.x, p.y, frame, p.injury, p.face, p.pose, fx);
        const cx = Math.round(p.x * T + T / 2);
        if (near(p.x, p.y) || state.phase === 'evening') {
          const list = (p.react ? [p.react] : []).concat(p.mark ? ['mark'] : []);
          list.forEach((kind, i) => tags.push({ kind, x0: cx + 4 + i * (TAG + 1), y0: top - 10, phase: p.x * 7 + p.y * 13, who: p.id }));
        }
        if (p.bubble) bubbles.push({ key: 'p:' + p.id, text: p.bubble, x: cx, y: top - 2 });
      }]);
    }
    // 당신
    const yFrame = walkFrame(sc.walkDist || 0, !!sc.moving);
    sc.walkFrame = yFrame;
    let youBox = null;                                                            // 당신 몸이 차지한 픽셀 상자 (주민 꼬리표가 당신 몸 위에 얹히지 않게)
    sprites.push([my, () => {
      const crouch = !!sc.crouch && !sc.moving;                                   // 수납을 여는 동안 쪼그려 앉는다 (game.js — 앞 칸 바닥 가구의 열린 그림이 머리에 가리지 않게)
      const top = drawPerson(ctx, 'you', mx, my, crouch ? 0 : yFrame, opts.youHurt || 0, sc.face, crouch ? 'crouch' : null);
      const im = ART.person(ART.spriteId('you'), crouch ? 0 : yFrame, opts.youHurt || 0, sc.face || 'down'), bb = ART.opaqueBox(im);
      const X0 = Math.round(mx * T) + Math.round((T - im.width) / 2);
      youBox = { x0: X0 + bb.x0, x1: X0 + bb.x1, y0: top, y1: Math.round(my * T) + T };
      if (opts.youReact) tags.push({ kind: opts.youReact, x0: Math.round(mx * T + T / 2) + 4, y0: top - 10, phase: 3, who: 'you' });
    }]);
    if (sctx) ctx = sctx;                                                         // (밝기 안) 아래 그리기 묶음이 사람·가구 층에 그린다 — 묶음들은 ctx 이름을 그대로 쓴다
    sprites.sort((a, b) => a[0] - b[0]).forEach((d) => d[1]());
    if (sctx) {
      ctx = mainCtx;
      sctx.save(); sctx.globalCompositeOperation = 'source-atop'; sctx.globalAlpha = 0.5; sctx.drawImage(lightCv, 0, 0); sctx.restore();
      ctx.drawImage(spriteCv, -ox, -oy);
    }
    // 주민 꼬리표가 당신 몸과 겹치면(앉은 사람 바로 위 칸에 섰을 때) 그 사람 꼬리표 묶음을 당신 몸 옆으로 비킨다 — 머리 쪽이 가까운 옆으로
    if (youBox) {
      const hit = (t) => t.x0 < youBox.x1 + 1 && t.x0 + TAG > youBox.x0 && t.y0 < youBox.y1 && t.y0 + TAG > youBox.y0;
      const groups = new Map();
      for (const t of tags) if (t.who !== 'you') { if (!groups.has(t.who)) groups.set(t.who, []); groups.get(t.who).push(t); }
      for (const g of groups.values()) {
        if (!g.some(hit)) continue;
        const gx0 = Math.min(...g.map((t) => t.x0)), gx1 = Math.max(...g.map((t) => t.x0 + TAG));
        const right = youBox.x1 + 2 - gx0, left = youBox.x0 - 2 - gx1;
        const dx = Math.abs(right) <= Math.abs(left) ? right : left;
        for (const t of g) t.x0 += dx;
      }
    }
    // 앞에 조사할 것이 있으면 ▾
    if (opts.target) { const tg = opts.target; ctx.fillStyle = '#d0a24a'; const bx = tg.x * T + 12, by = tg.y * T - 28 - ((tick >> 4) % 2) * 2; ctx.fillRect(bx, by, 8, 4); ctx.fillRect(bx + 2, by + 4, 4, 2); }
    lighting(ctx, sc, state, lights, tick, now, LIGHT_P1);                       // 밝기 안이면 사람·가구 위에는 덮개를 반만
    for (const t of tags) drawTag(ctx, t, tick);                                 // 빛 덮개 뒤 = 어두워도 보인다
    RENDER.last = { tags, youBox };                                              // 검수용 (screen_check recheck: 꼬리표가 당신 몸에 겹치나)
    ctx.restore();
    grain(ctx, cv, tick, { x: ox, y: oy, w: sc.w * T, h: sc.h * T });
    syncBubbles(bubbles, ox, oy);
  }

  window.RENDER = { draw, tileAt, propFor, artFor, wallClear, OVERLAY, PROP, V4P, HAND, MOVED, walkFrame, setScale, clearBubbles, BREATH_AT_NIGHT, LIGHT_P1, last: null };
})();
