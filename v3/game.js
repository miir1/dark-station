// 어두운 역 v3 — 쯔꾸르풍 화면. 규칙은 ../v2/engine.js 그대로, 여기서는 맵을 걷고 대화창으로 고른다.
(function () {
  'use strict';
  const E = window.DS2, D = E.D, T = ART.T, M = window.MAPS;
  const esc = UI.esc, J = E.J;
  const SAVE_KEY = 'darkstation.v3.save';
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const qs = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');

  // ── 저장 ──
  let state = null;
  function load() {
    try { const s = E.normalize(JSON.parse(localStorage.getItem(SAVE_KEY))); if (s) return s; } catch (e) { /* 새 게임 */ }
    return E.newGame((Date.now() & 0x7fffffff) >>> 0);
  }
  function save() { if (devFixture) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 */ } }
  const devFixture = isLocal && qs.get('fixture');
  state = load();
  if (devFixture) {
    try { const x = new XMLHttpRequest(); x.open('GET', '../v2/fixtures/' + devFixture.replace(/[^a-z0-9_]/gi, '') + '.json', false); x.send(); const s = E.normalize(JSON.parse(x.responseText)); if (s) state = s; } catch (e) { /* 무시 */ }
  }
  function act(a) {
    const snap = JSON.stringify(state);
    let r;
    try { r = E.dispatch(state, a); } catch (err) { state = JSON.parse(snap); r = { ok: false, error: '처리 중 문제가 생겨 되돌렸어요.' }; console.error(err); }
    if (r.ok) save(); else UI.toast(r.error || '지금은 할 수 없다');
    hud();
    return r.ok;
  }

  // 사건 그림: 사건 id → 크리처 그림 (그림이 있을 때만 대화창 위에)
  const EVENT_ART = { g2_rats: 'rats', c_twomouth: 'twomouth', c_drowned: 'drowned', c_bonepicker: 'bonepicker', c_counter: 'child', c_conductor: 'conductor', c_echo: 'echo',
    n_leeches: 'leeches', n_moths: 'moth', n_lampimp: 'lampimp', n_ghoul: 'ghoul', 'god:seel': 'eye' };
  function eventArt(key) {
    const id = EVENT_ART[key];
    if (!id || !ART.has('creatures/' + id)) return '';
    return `<p style="text-align:center;margin:0 0 6px"><img alt="" src="${ART.creatureSprite(id).toDataURL()}" style="width:128px;height:128px;image-rendering:pixelated"></p>`;
  }
  // 장면 그림 (img/cg/…) — 있으면 대화창 위에
  const cgSrc = (key) => (ART.has('cg/' + key) ? 'img/cg/' + key + '.png' : '');
  const cgImg = (key) => (cgSrc(key) ? `<img class="cg" alt="" src="${cgSrc(key)}">` : '');
  // ── 공통 문장 ──
  const resText = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${D.RES[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`).join(' · ');
  const reps = (arr) => arr.map((l) => `<p class="rep ${l.kind || ''}">${esc(l.text)}</p>`).join('');
  const fx = (arr) => (arr && arr.length ? `<ul class="fx">${arr.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '');
  const bar = (v, max, hot) => `<span class="bar ${hot ? 'hot' : ''}"><i style="width:${Math.max(0, Math.min(100, Math.round(v / max * 100)))}%"></i></span>`;
  function choiceSub(c) {
    const bits = [];
    if (c.locked) return '🔒 ' + esc(c.reason);
    if (c.choice.cost) bits.push('소모 ' + Object.entries(c.choice.cost).map(([k, v]) => `${D.RES[k]} ${v}`).join('·'));
    if (c.chance != null) bits.push(`${D.SKILLS[c.choice.check.skill]} 판정 ${Math.round(c.chance * 100)}%`);
    const tags = E.choiceTags(c.choice);
    if (tags.length) bits.push(`<span class="risk">⚠ ${esc(tags.join(' · '))}</span>`);
    if (c.choice.req && (c.choice.req.item || c.choice.req.trait)) bits.push(`조건 충족: ${c.choice.req.item ? D.ITEMS[c.choice.req.item] + ' 사용' : '특성'}`);
    if (c.warn) bits.push(`<span class="risk bad">⚠ ${esc(c.warn)}</span>`);
    if (c.choice.hint) bits.push(`<span class="risk bad">⚠ ${esc(c.choice.hint)}</span>`);
    return bits.join('<br>');
  }
  const choiceOpts = (list) => list.map((c, i) => ({ label: c.choice.text, sub: choiceSub(c), disabled: c.locked, value: i,
    confirm: c.choice.taboo ? `${c.choice.text}\n\n되돌릴 수 없다. 정말?` : c.choice.hint ? `${c.choice.text}\n\n${c.choice.hint}\n\n정말 선택할까요?` : '' }));
  function resultHtml(r) {
    return `<p class="mini">▸ ${esc(r.choice)}</p>${r.roll ? `<p class="roll ${r.roll.success ? 'ok' : 'no'}">판정 ${Math.round(r.roll.chance * 100)}% — ${r.roll.success ? '성공' : '실패'}</p>` : ''}${r.text ? `<p>${esc(r.text)}</p>` : ''}${fx(r.lines)}`;
  }
  function badges(r) {
    const b = [];
    if (r.status === 'dead') return '<span class="badge bad">사망</span>';
    if (r.injury === 1) b.push('<span class="badge">경상</span>');
    if (r.injury === 2) b.push('<span class="badge warn">중상</span>');
    if (r.injury >= 3) b.push('<span class="badge bad">위독</span>');
    if (r.breakdown > 0) b.push(`<span class="badge bad">${r.affl && D.AFFLICTIONS[r.affl] ? esc(D.AFFLICTIONS[r.affl].name) : '탈진'}</span>`);
    if (r.virtue) b.push(`<span class="badge good">${esc(D.VIRTUE.name)}</span>`);
    for (const id of r.scars || []) b.push(`<span class="badge warn">${esc(D.SCARS[id].name)}</span>`);
    if (state.possessed === r.id) b.push('<span class="badge bad">허기 들림</span>');
    if (state.flame && state.flame.keeper === r.id) b.push('<span class="badge good">불씨지기</span>');
    return b.join('');
  }

  // ── 머리말 ──
  function hud() {
    const s = state;
    if (s.phase === 'prologue') { $('hud').innerHTML = '<span class="day">프롤로그</span>'; return; }
    const need = Math.ceil((1 + E.alive(s).length) * 0.5);
    const it = (k) => { const low = (k === 'food' || k === 'water') ? s.res[k] < need * 2 : s.res[k] === 0; return `<span class="it ${low ? 'low' : ''}">${D.RES[k]} <b>${s.res[k]}</b></span>`; };
    let h = `<span class="day">D${Math.min(s.day, D.GOAL_DAY)}/${D.GOAL_DAY}</span>${['food', 'water', 'parts', 'meds'].map(it).join('')}<span class="it ${s.flood >= E.FLOOD_POWER_STOP ? 'warn' : ''}">침수 <b>${s.flood}</b>/8</span><span class="it ${s.exposure >= 6 ? 'warn' : ''}">노출 <b>${s.exposure}</b>/8</span>`;
    if (s.phase === 'expedition' && s.exp) { const v = E.expView(s); h += `<span class="hours">${v.hours}/${v.normal}시간 · 보급 ${v.have.food}/${v.need.food}</span>`; }
    $('hud').innerHTML = h;
  }

  // ── 장면 (프롤로그 / 역 / 원정) ──
  const scene = { kind: 'station', map: null, rows: [], w: 0, h: 0, px: 0, py: 0, face: 'down', moving: null, visited: new Set(), key: '' };
  function setMap(kind, key, rows, start, extra) {
    Object.assign(scene, { kind, key, rows, w: rows[0].length, h: rows.length }, extra || {});
    if (start) { scene.px = start[0]; scene.py = start[1]; }
    resize();
  }
  function enterStation(atFire) {
    setMap('station', 'station', M.STATION.rows, atFire || !scene.stationPos ? M.STATION.start : scene.stationPos, { map: M.STATION });
  }
  function enterPrologue(force) {
    if (scene.kind === 'prologue' && !force) return;
    const m = force || (state.pro <= 1 ? M.CAR : M.TUNNEL);
    setMap('prologue', m.id, m.rows, m.start, { map: m });
  }
  function enterDungeon() {
    const e = state.exp;
    const key = e.region + Math.min(2, e.depth);
    const d = M.DUNGEONS[key];
    if (scene.key !== key) {
      scene.visited = new Set();
      let sx = 1, sy = 1;
      d.rows.forEach((row, y) => { const x = row.indexOf('E'); if (x >= 0) { sx = x; sy = y; } });
      setMap('dungeon', key, d.rows, [sx + 1, sy], { dun: d, region: e.region, map: null });
    }
  }
  function syncScene() {
    if (state.phase === 'prologue') enterPrologue();
    else if (state.phase === 'expedition' && state.exp) enterDungeon();
    else if (scene.kind !== 'station') enterStation(false);
  }

  // 사람들이 서 있는 자리 (오늘 배치 그대로). lying: 누워 있음
  function residentsOnMap() {
    const s = state;
    if (scene.kind === 'prologue') {
      if (scene.key === 'car') return M.CAR.npcs.map((n) => ({ r: E.byId(s, n.id) || { id: n.id, name: D.PEOPLE[n.id].name, injury: 0 }, x: n.x, y: n.y, npc: n }));
      if (scene.key === 'tunnel' && s.pro === 2 && !s.proResult) return M.TUNNEL.npcs.map((n) => ({ r: E.byId(s, n.id), x: n.x, y: n.y, npc: n }));
      return [];
    }
    if (scene.kind !== 'station') return [];
    const plan = E.effectivePlan(s);
    const used = {}, out = [];
    const beds = [[16, 2], [18, 2], [16, 4], [19, 3], [15, 2], [15, 4]];
    let bi = 0;
    for (const r of E.alive(s)) {
      if (r.status !== 'home') continue;
      let pos, lying = false;
      if (r.injury >= 2 || r.breakdown > 0) { pos = beds[bi++ % beds.length]; lying = r.injury >= 2; }
      else {
        let task = s.phase === 'morning' ? (plan[r.id] || 'rest') : 'rest';
        const key = task === 'build' && s.project && s.project.id === 'repair' ? 'buildRepair' : task;
        const list = M.STATION.spots[key] || M.STATION.spots.rest;
        used[key] = used[key] || 0;
        pos = used[key] < list.length ? list[used[key]] : M.STATION.spots.rest[(used.restX = (used.restX || 0) + 1) % 8];
        used[key]++;
      }
      out.push({ r, x: pos[0], y: pos[1], lying });
    }
    return out;
  }
  // 조사할 수 있는 물건 (현재 맵)
  function mapObjects() {
    if (scene.kind === 'station') return M.STATION.objects;
    if (scene.kind === 'prologue') return scene.map.objects.filter((o) => !(o.pro < state.pro));
    return [];
  }
  function objectsAt(x, y) { return mapObjects().filter((o) => x >= o.x && x < o.x + (o.w || 1) && y >= o.y && y < o.y + (o.h || 1)); }

  // ── 지나갈 수 있는가 ──
  function tileAt(x, y) { return (scene.rows[y] || '')[x] || '#'; }
  function blocked(x, y) {
    const t = tileAt(x, y);
    if (t === '#' || t === 's' || t === 'i') return true;
    if (scene.kind === 'station') {
      if (t === 'R' && !state.flags.passage_secured) return true;
      if (objectsAt(x, y).some((o) => o.solid && !(o.id.startsWith('repair') && state.flags.passage_secured))) return true;
      if ((M.STATION.decor || []).some((d) => d.solid && d.x === x && d.y === y)) return true;
    }
    if (scene.kind === 'prologue') {
      if (t === 'o' && state.pro < 2) return true;
      if (objectsAt(x, y).length) return true;
    }
    if (residentsOnMap().some((p) => p.x === x && p.y === y)) return true;
    return false;
  }

  // ── 그리기 ──
  let view = { cols: 13, rows: 9, scale: 3 };
  function resize() {
    const st = $('stage');
    const W = st.clientWidth || 375, H = st.clientHeight || 420;
    const mapRows = Math.min(13, scene.h || 13);
    // 맵 높이가 화면에 꽉 차게 (폰에서는 소수 배율도 허용)
    const scale = Math.max(1, Math.min(4, H / (T * mapRows), W / (T * 7)));
    view = { cols: Math.ceil(W / (T * scale)), rows: Math.ceil(H / (T * scale)), scale };
    cv.width = view.cols * T; cv.height = view.rows * T;
    cv.style.width = Math.round(cv.width * scale) + 'px'; cv.style.height = Math.round(cv.height * scale) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($('stage'));

  function tileKind(t) {
    if (scene.kind === 'dungeon') {
      const A = scene.region === 'A';
      if (t === '#') return A ? 'shutter' : 'pipe';
      if (t === 'w') return 'water';
      return A ? 'marketFloor' : 'drainFloor';
    }
    if (scene.kind === 'prologue' && scene.key === 'car') return t === '#' ? 'wall' : 'concourse';
    return { '#': 'wall', '.': 'concourse', d: 'concourse', S: 'concourse', ',': 'floor', R: 'floor', '=': 'edge', '~': 'track', i: 'track', x: 'track', T: null, w: 'water', o: 'concourse' }[t] || 'floor';
  }
  let tick = 0;
  function draw() {
    if (!scene.w || !scene.h) return;               // 맵을 아직 안 불렀다
    tick++;
    const s = state;
    const mx = scene.moving ? scene.px - scene.moving.dx * (1 - scene.moving.t) : scene.px;
    const my = scene.moving ? scene.py - scene.moving.dy * (1 - scene.moving.t) : scene.py;
    const camX = Math.max(0, Math.min(scene.w * T - cv.width, (mx + 0.5) * T - cv.width / 2));
    const camY = Math.max(0, Math.min(scene.h * T - cv.height, (my + 0.5) * T - cv.height / 2));
    const ox = scene.w * T < cv.width ? Math.round((cv.width - scene.w * T) / 2) : -Math.round(camX);
    const oy = scene.h * T < cv.height ? Math.round((cv.height - scene.h * T) / 2) : -Math.round(camY);
    ctx.fillStyle = '#050404'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(ox, oy);
    // 바닥·벽
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) {
      const t = tileAt(x, y), X = x * T, Y = y * T;
      const k = tileKind(t);
      if (k) ctx.drawImage(ART.tile(k, x, y), X, Y); else { ctx.fillStyle = '#000'; ctx.fillRect(X, Y, T, T); }
      if (t === 's') ctx.drawImage(ART.prop('seat'), X, Y);
      if (t === '#' && tileAt(x, y + 1) !== '#' && y + 1 < scene.h) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X, Y + T, T, 3); }
      if (t === 'v') ctx.drawImage(ART.prop('stairsDown'), X, Y);
      if (t === 'E') ctx.drawImage(ART.prop('stairsUp'), X, Y);
      if (t === 'o') ctx.drawImage(ART.prop('door'), X, Y);
      if (t === 'w' && (tick >> 4) % 2) { ctx.fillStyle = 'rgba(134,163,168,0.10)'; ctx.fillRect(X + ((x * 5 + y) % 9) * 2, Y + 14, 10, 2); }
    }
    const sprites = [];   // [y, draw]
    if (scene.kind === 'station') drawStation(s, sprites);
    else if (scene.kind === 'dungeon') drawDungeon(sprites);
    else drawPrologue(s, sprites);
    // 사람 (누워 있는 사람은 눕혀서)
    for (const p of residentsOnMap()) {
      const hurt = Math.min(3, p.r.injury || 0);
      // 주민은 주인공 쪽을 본다 (가까우면)
      const dx = scene.px - p.x, dy = scene.py - p.y;
      const look = Math.abs(dx) + Math.abs(dy) <= 3 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down')) : 'down';
      const img = ART.personSprite(p.r.id, 0, hurt, p.lying ? 'down' : look);
      sprites.push([p.y, () => {
        if (p.lying) { ctx.save(); ctx.translate(p.x * T + T, p.y * T + T / 4); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, img.width * 0.67, img.height * 0.67); ctx.restore(); }
        else ctx.drawImage(img, p.x * T, p.y * T - (ART.PH - T));
        if (p.r.breakdown > 0 && (tick >> 4) % 2) { ctx.fillStyle = '#9c1e1e'; ctx.fillRect(p.x * T + 14, p.y * T - 26, 4, 6); }
      }]);
    }
    // 주인공과 동행
    const frame = scene.moving ? ((tick >> 3) % 2) + 1 : 0;
    const flip = scene.face === 'left';
    sprites.push([my, () => drawPerson('player', mx, my, frame, flip, 0, scene.face)]);
    if (scene.kind === 'dungeon' && state.exp) state.exp.party.forEach((id, i) => {
      const [dx, dy] = DIRS[scene.face]; const fx2 = mx - dx * (i + 1), fy2 = my - dy * (i + 1);
      if (!blocked(Math.round(fx2), Math.round(fy2))) sprites.push([fy2, () => drawPerson(id, fx2, fy2, frame, flip, E.byId(state, id).injury, scene.face)]);
    });
    sprites.sort((a, b) => a[0] - b[0]).forEach((d) => d[1]());
    // 앞에 조사할 것이 있으면 ▾
    const tg = target();
    if (tg && !UI.isOpen() && !busy) { ctx.fillStyle = '#d0a24a'; const bx = tg.x * T + 12, by = tg.y * T - 28 - ((tick >> 4) % 2) * 2; ctx.fillRect(bx, by, 8, 4); ctx.fillRect(bx + 2, by + 4, 4, 2); }
    lighting(mx, my);
    ctx.restore();
    grain();
  }
  function drawPerson(id, x, y, frame, flip, hurt, dir) {
    if (ART.has('walk/' + id)) flip = false;          // 방향별 그림이 있으면 뒤집지 않는다
    const img = ART.personSprite(id, frame, Math.min(3, hurt || 0), dir || scene.face);
    const up = ART.PH - T;
    if (flip) { ctx.save(); ctx.translate(Math.round(x * T) + T, Math.round(y * T) - up); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
    else ctx.drawImage(img, Math.round(x * T), Math.round(y * T) - up);
  }
  // 필름 알갱이·가장자리 어둠
  let vign = null;
  function grain() {
    if (!vign || vign.width !== cv.width || vign.height !== cv.height) {
      vign = document.createElement('canvas'); vign.width = cv.width; vign.height = cv.height;
      const g = vign.getContext('2d');
      const gr = g.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.3, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.drawImage(vign, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 40; i++) ctx.fillRect((Math.random() * cv.width) | 0, (Math.random() * cv.height) | 0, 1, 1);
  }
  let lightCv = null;
  function lighting(pmx, pmy) {
    const s = state;
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== scene.w * T || lightCv.height !== scene.h * T) { lightCv.width = scene.w * T; lightCv.height = scene.h * T; }
    const g = lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, lightCv.width, lightCv.height);
    let dark = 0.88; const lights = [];
    let tintRed = false;
    if (scene.kind === 'station') {
      const pv = s.phase === 'morning' ? E.previewNight(s) : null;
      const lit = pv ? !pv.ev.dark : !s.dark;
      dark = lit ? 0.55 : 0.86;
      lights.push([11.5, 7.5, 4.8 + ((tick >> 3) % 3) * 0.2]);
      if (lit) for (const o of M.STATION.objects) if (o.lamp) lights.push([o.x + 0.5, o.y + 0.5, 5.5]);
      if (s.flags.passage_secured) lights.push([23.5, 6.5, 3]);
    } else if (scene.kind === 'prologue') {
      dark = 0.9; tintRed = scene.key === 'car';
      if (scene.key === 'car' && (tick >> 5) % 3 !== 0) for (const x of [4, 11, 18]) lights.push([x + 0.5, 1, 3.5]);
    }
    lights.push([pmx + 0.5, pmy + 0.3, scene.kind === 'station' ? 2.4 : 3.6]);
    g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, lightCv.width, lightCv.height);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of lights) {
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * T, y * T, r * T, 0, Math.PI * 2); g.fill();
    }
    ctx.drawImage(lightCv, 0, 0);
    if (scene.kind === 'station') { ctx.fillStyle = 'rgba(208,120,50,0.08)'; ctx.beginPath(); ctx.arc(11.5 * T, 7.5 * T, 3.8 * T, 0, Math.PI * 2); ctx.fill(); }
    if (tintRed && (tick >> 5) % 3 !== 0) { ctx.fillStyle = 'rgba(140,20,20,0.16)'; ctx.fillRect(0, 0, scene.w * T, scene.h * T); }
  }
  function drawStation(s, sprites) {
    // 침수: 선로부터 물이 찬다
    const fl = s.flood;
    const rowsW = [];
    if (fl >= 1) rowsW.push([10, fl >= 3 ? 1 : 0.5], [11, fl >= 2 ? 1 : 0.6]);
    if (fl >= 5) rowsW.push([9, fl >= 6 ? 0.9 : 0.5]);
    if (fl >= 7) rowsW.push([8, 0.6]);
    for (const [y, a] of rowsW) { ctx.globalAlpha = 0.75 * a; for (let x = 1; x < 23; x++) ctx.drawImage(ART.tile('water', x, y), x * T, y * T); ctx.globalAlpha = 1; }
    // 멈춘 2호선 전동차
    const tx = 2 * T, ty = 10 * T;
    if (ART.has('props/door')) {             // 2호선 전동차: 출입문 그림을 이어 붙인다
      const door = ART.prop('door');
      for (let k = 0; k < 7; k++) ctx.drawImage(door, tx + k * T, ty, T, 2 * T);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(tx, ty, 7 * T, 2 * T);
    } else {
    ctx.fillStyle = '#5b5049'; ctx.fillRect(tx, ty + 2, 7 * T, 2 * T - 6);
    ctx.fillStyle = '#7d7067'; ctx.fillRect(tx, ty + 2, 7 * T, 4);
    ctx.fillStyle = '#2a6b3c'; ctx.fillRect(tx, ty + 38, 7 * T, 8);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#0d171c'; ctx.fillRect(tx + 12 + k * 36, ty + 12, 22, 18); ctx.fillStyle = 'rgba(134,163,168,0.25)'; ctx.fillRect(tx + 14 + k * 36, ty + 14, 6, 6); }
    }
    ctx.fillStyle = '#050404'; ctx.fillRect(23 * T, 10 * T, T, 2 * T);
    // 바닥 얼룩·꾸밈
    for (const d of M.STATION.decor || []) if (!d.solid) ctx.drawImage(ART.prop(d.prop), d.x * T, d.y * T);
    // 시설 자리
    if (s.facility === 'farm') for (const x of [10, 12]) ctx.drawImage(ART.prop('mush'), x * T, 1 * T);
    if (s.facility === 'clinic') { ctx.drawImage(ART.prop('cross'), 11 * T, 1 * T); ctx.drawImage(ART.prop('bed'), 12 * T, 1 * T); }
    if (s.project && s.project.id !== 'repair') { ctx.drawImage(ART.prop('crate'), 11 * T, 1 * T); ctx.drawImage(ART.prop('rubble'), 12 * T, 1 * T); }
    (s.buried || []).forEach((id, i) => ctx.drawImage(ART.prop('grave'), (19 + i % 3) * T, (3 + Math.floor(i / 3)) * T));
    const P = { fire: 'drum', board: 'board', gen: 'generator', pump: 'tank', drainpump: 'pump', stash: 'crate', stash2: 'sack', bed1: 'bed', bed2: 'bed', bed3: 'bed', repair: 'rubble', repair2: 'rubble', exitA: 'stairsUp', exitA2: 'stairsUp' };
    for (const o of M.STATION.objects) {
      const pr = P[o.id]; if (!pr) continue;
      if (o.id.startsWith('repair') && s.flags.passage_secured) continue;
      sprites.push([o.y - 0.5, () => ctx.drawImage(ART.prop(pr), o.x * T, o.y * T)]);
    }
    for (const d of M.STATION.decor || []) if (d.solid) sprites.push([d.y - 0.5, () => ctx.drawImage(ART.prop(d.prop), d.x * T, d.y * T)]);
    for (const o of M.STATION.objects) if (o.lamp) ctx.drawImage(ART.prop('lamp'), o.x * T, (o.y - 1) * T + 12);
    if (s.project && s.project.id === 'repair') ctx.drawImage(ART.prop('crate'), 22 * T, 8 * T);
    if (!ART.has('props/drum')) sprites.push([7.4, () => ctx.drawImage(ART.flame((tick >> 3) % 2), 11 * T, 6 * T + 4)]);
    if (s.exposure > 0) { ctx.fillStyle = `rgba(150,150,150,${0.05 * s.exposure})`; ctx.fillRect(T, T, 3 * T, 2 * T); }
  }
  function drawDungeon(sprites) {
    const d = scene.dun;
    for (const [spr, x, y] of d.deco || []) { const map = { crate: 'crate', barrel: 'drum', barrel2: 'drum', web: 'bones', shelf: 'crate', skull: 'bones', bones: 'bones', pipeV: 'pump' }; sprites.push([y - 0.5, () => ctx.drawImage(ART.prop(map[spr] || 'bones'), x * T, y * T)]); }
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) if (tileAt(x, y) === 'm' && !scene.visited.has(x + ',' + y)) { const bob = (tick >> 5) % 2; ctx.drawImage(ART.prop('mark'), x * T, y * T - 4 - bob); }
  }
  function drawPrologue(s, sprites) {
    for (const o of mapObjects()) {
      if (o.id === 'collapse') { for (let k = 0; k < 3; k++) sprites.push([o.y + k, () => ctx.drawImage(ART.prop('rubble'), o.x * T, (o.y + k) * T)]); continue; }
      sprites.push([o.y - 0.5, () => ctx.drawImage(ART.prop(o.prop), o.x * T, o.y * T)]);
    }
  }

  // ── 움직임·입력 ──
  const held = new Set();
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let busy = false;           // 대화 흐름 진행 중
  function update() {
    if (scene.moving) {
      scene.moving.t += 0.16;
      if (scene.moving.t >= 1) { scene.moving = null; arrived(); }
      return;
    }
    if (busy || UI.isOpen()) return;
    const dir = ['up', 'down', 'left', 'right'].find((d) => held.has(d));
    if (dir) step(dir);
  }
  function step(dir) {
    scene.face = dir;
    const [dx, dy] = DIRS[dir];
    const nx = scene.px + dx, ny = scene.py + dy;
    if (blocked(nx, ny)) {
      const o = scene.kind === 'prologue' && objectsAt(nx, ny).find((q) => q.walk);
      if (o) flow(() => prologueObject(o));
      return;
    }
    scene.px = nx; scene.py = ny; scene.moving = { dx, dy, t: 0 };
    if (scene.kind === 'station') scene.stationPos = [nx, ny];
  }
  function front() { const [dx, dy] = DIRS[scene.face]; return [scene.px + dx, scene.py + dy]; }

  // ── 걸어서 밟는 곳 ──
  function arrived() {
    const t = tileAt(scene.px, scene.py);
    if (scene.kind === 'prologue') {
      if (t === 'o' && state.pro >= 2) { enterPrologue(M.TUNNEL); flow(() => sceneIntro()); }
      if (t === 'x') flow(() => prologueArrive());
      return;
    }
    if (scene.kind === 'station') {
      const o = objectsAt(scene.px, scene.py).find((x) => x.trigger);
      if (o && state.phase === 'morning') flow(() => exitTo(o.id.startsWith('exitA') ? 'A' : 'B'));
      if (t === 'R' && state.flags.passage_secured) UI.toast('고지대 역으로 이어진 통로. 열차는 D10에 온다.');
    } else {
      if (t === 'm' && !scene.visited.has(scene.px + ',' + scene.py)) flow(() => marker());
      else if (t === 'v') flow(() => stairsDown());
      else if (t === 'E') flow(() => leaveDungeon());
    }
  }

  // 대화 흐름은 하나씩만
  async function flow(fn) {
    if (busy) return;
    busy = true; held.clear();
    try { await fn(); await phaseFlow(); } catch (err) { console.error(err); }
    busy = false;
    syncScene(); hud();
  }

  // ── 조사 (A) ──
  // 바라보는 칸에 무엇이 있나 → { x, y, kind, ref, label }
  function target() {
    if (scene.moving) return null;
    const [fx0, fy0] = front();
    const p = residentsOnMap().find((q) => q.x === fx0 && q.y === fy0);
    if (p && (scene.kind === 'prologue' || state.phase === 'morning')) return { x: fx0, y: fy0, kind: 'npc', ref: p, label: '말 걸기' };
    const o = objectsAt(fx0, fy0).find((q) => q.name) || objectsAt(scene.px, scene.py).find((q) => q.name && !q.trigger);
    if (o && (scene.kind === 'prologue' || state.phase === 'morning')) return { x: o.x, y: o.y, kind: 'obj', ref: o, label: o.id === 'fire' ? '하루 마치기' : '조사' };
    return null;
  }
  function interact() {
    if (busy || UI.isOpen() || scene.moving) return;
    if (scene.kind === 'dungeon') { flow(() => expStatus()); return; }
    const tg = target();
    if (!tg) { UI.toast('아무것도 없다.', 900); return; }
    if (scene.kind === 'prologue') { flow(() => (tg.kind === 'npc' ? prologueNpc(tg.ref.npc) : prologueObject(tg.ref))); return; }
    if (tg.kind === 'npc') flow(() => talkTo(tg.ref.r)); else flow(() => useObject(tg.ref));
  }

  // ── 아침: 사람 ──
  async function talkTo(r) {
    const s = state;
    for (;;) {
      const pv = E.previewNight(s);
      const row = pv.ev.rows.find((x) => x.rid === r.id);
      const task = pv.ev.plan[r.id] || 'rest';
      const P = D.PEOPLE[r.id];
      const body = `<p class="who">${esc(r.name)} <span class="mini">${P.age}세 · ${esc(P.bio)}</span>${badges(r)}</p>
        <p class="mini">스트레스 ${r.stress}${bar(r.stress, 100, r.stress >= 70)} · 신뢰 ${'●'.repeat(r.trust)}${'○'.repeat(4 - r.trust)}</p>
        <p class="mini">관찰 ${r.skills.obs} · 완력 ${r.skills.str} · 기술 ${r.skills.tech} · 말솜씨 ${r.skills.talk} · ${esc(D.TRAITS[r.good].name)}/${esc(D.TRAITS[r.bad].name)}</p>
        <p>오늘: <b>${esc(D.TASKS[task].name)}</b>${row ? ` — ${esc(row.out)}${row.stress != null ? ` · 스트레스 ${row.stress > 0 ? '+' : ''}${row.stress}` : ''}${row.infect ? ` · 곪을 위험 ${Math.round(row.infect * 100)}%` : ''}` : ''}</p>
        ${r.mem.length ? `<p class="mini">${r.mem.slice(-2).reverse().map((m) => `D${m.day} ${esc(m.text)}`).join('<br>')}</p>` : ''}`;
      const a = await UI.open(body, { options: [{ label: '할 일을 정한다', value: 'task', disabled: s.expParty.includes(r.id) }, { label: '그만', value: null }], cancel: true });
      if (a !== 'task') return;
      const opts = E.taskOptions(s, r.id).map((o) => ({ label: o.name + (o.id === task ? ' (지금)' : ''), sub: esc(o.disabled ? o.reason : o.desc), disabled: o.disabled, value: o.id }));
      const t = await UI.open(`<p class="who">${esc(r.name)}의 오늘 할 일</p>`, { options: opts, cancel: true, full: true });
      if (t) act({ type: 'assign', rid: r.id, task: t });
    }
  }

  // ── 아침: 물건 ──
  async function useObject(o) {
    const s = state;
    const id = o.id.replace(/\d$/, '');
    if (id === 'fire') return endDayFlow();
    if (id === 'board') { tutDone('board'); return boardFlow(); }
    if (id === 'stash') {
      const items = Object.keys(D.ITEMS).filter((k) => s.items[k]).map((k) => D.ITEMS[k]);
      return UI.open(`<p class="title">창고</p><div class="grid2">${Object.keys(D.RES).map((k) => `<span>${D.RES[k]}</span><b>${s.res[k]} / ${D.CAP[k]}</b>`).join('')}</div><p class="mini">도구: ${esc(items.join(', ') || '없음')} · 근처 식량 ${s.forage} · 비상 해체 부품 ${s.salvageLeft}</p>`);
    }
    if (id === 'repair') {
      const tr = E.trainInfo(s);
      return UI.open(`<p class="title">무너진 통로</p><p>${s.flags.passage_secured ? '고지대 역으로 길이 이어졌다.' : s.flags.repair_open ? '도현의 열쇠로 열 수 있다. 게시판에서 착공하고 공사 작업에 사람을 넣어야 한다.' : '잔해가 길을 막고 있다. 이 너머로 고지대 역이 있다고 한다. 수문 방면에서 배수 정비공을 찾아야 할 것 같다.'}</p><p class="mini">열차 정원: ${tr.passage ? `${tr.cap}명` : '통로가 이어져야 열차가 닿는다'}</p>`);
    }
    const who = (task) => E.alive(s).filter((r) => (E.effectivePlan(s)[r.id]) === task).map((r) => r.name).join('·') || '없음';
    const txt = {
      gen: `낡은 디젤 발전기. 돌리면 불이 켜지고 물을 길을 수 있지만, 불빛과 소리가 새어 나간다. (담당: ${who('gen')})${s.flood >= E.FLOOD_POWER_STOP ? ' — 지금은 물에 잠겨 돌지 않는다.' : ''}`,
      pump: `물탱크와 손펌프. 전력이 있어야 물을 길을 수 있다. (담당: ${who('pump')})`,
      drainpump: `선로의 물을 퍼내는 배수 펌프. 사람 손으로 돌린다. 침수 ${s.flood}/8 (담당: ${who('drain')})`,
      facility: s.facility ? `${D.PROJECTS[s.facility].name} — ${D.PROJECTS[s.facility].desc}` : s.project ? `${D.PROJECTS[s.project.id].name} 공사 ${s.project.progress}/${D.PROJECTS[s.project.id].work}` : '비어 있는 역무실. 시설을 하나 지을 수 있다 (게시판에서 착공).',
      bed: '얇은 담요가 깔린 잠자리. 다친 사람들이 여기 눕는다.',
    }[id];
    if (txt) return UI.open(`<p class="title">${esc(o.name)}</p><p>${esc(txt)}</p>`);
  }

  // ── 게시판: 배치·예상·공사·예보 ──
  async function boardFlow() {
    const s = state;
    for (;;) {
      const pv = E.previewNight(s), ev = pv.ev, fc = E.forecast(s), tr = E.trainInfo(s);
      const plan = E.alive(s).filter((r) => r.status === 'home').map((r) => { const row = ev.rows.find((x) => x.rid === r.id); const tn = D.TASKS[ev.plan[r.id] || 'rest'].name; return `<span>${esc(r.name)}</span><span>${esc(tn)}${row && row.out !== tn ? ' · ' + esc(row.out) : ''}</span>`; }).join('');
      const body = `<p class="title">게시판 — D${s.day}</p>
        <p class="mini">목표: D${D.GOAL_DAY} 구조열차 · 통로 ${s.flags.passage_secured ? '개통 ✓' : s.project && s.project.id === 'repair' ? `작업 ${s.project.progress}/2` : s.flags.repair_open ? '착공 가능' : '미확보'} · 병원 협정 ${s.flags.hospital_pact ? '✓' : '—'} · 지금 열차 정원 ${tr.passage ? tr.cap : 0}명</p>
        ${fc.length ? `<p class="tag">예보와 약속</p>${reps(fc)}` : ''}
        <p class="tag">오늘의 배치</p><div class="grid2">${plan}</div>
        <p class="tag">내일 아침 예상</p>${reps(pv.warnings)}
        <p class="mini">식량 ${s.res.food}→${pv.res.food} · 물 ${s.res.water}→${pv.res.water} · 부품 ${s.res.parts}→${pv.res.parts} · 약품 ${s.res.meds}→${pv.res.meds} · 전력 ${ev.made}${ev.need ? `(필요 ${ev.need})` : ''} · 침수 ${s.flood}→${pv.flood} · 노출 ${s.exposure}→${pv.exposure}</p>`;
      const av = E.availableProjects(s);
      const opts = [
        { label: '추천 배치로 짠다', sub: esc('추천 기준: ' + (E.suggestWhy(s) || '모두 휴식')), value: 'suggest' },
        { label: '어제와 같이', value: 'repeat', disabled: !Object.keys(s.lastPlan).length },
      ];
      if (!s.project) for (const p of av) opts.push({ label: `공사 시작: ${p.name}`, sub: esc(`부품 ${p.cost.parts || 0}개 · 작업 ${p.work}회분 · ${p.desc}`), value: 'proj:' + p.id, disabled: !p.afford, confirm: `${p.name}: 부품 ${p.cost.parts || 0}개를 내고 착공합니다. 되돌릴 수 없어요.` });
      opts.push({ label: '닫기', value: null });
      const a = await UI.open(body, { options: opts, cancel: true, full: true });
      if (!a) return;
      if (a === 'suggest') act({ type: 'setPlan', plan: E.suggestPlan(s) });
      else if (a === 'repeat') act({ type: 'setPlan', plan: s.lastPlan });
      else if (a.startsWith('proj:')) act({ type: 'startProject', id: a.slice(5) });
    }
  }

  // ── 화로: 하루를 보낸다 ──
  async function endDayFlow() {
    const s = state;
    const pv = E.previewNight(s);
    const body = `<p class="title">화로</p><p>불 앞에 앉으면 하루가 저문다.</p>${reps(pv.warnings)}
      <p class="mini">식량 ${s.res.food}→${pv.res.food} · 물 ${s.res.water}→${pv.res.water} · 침수 ${s.flood}→${pv.flood} · 노출 ${s.exposure}→${pv.exposure}</p>`;
    const deathWarn = pv.deaths.length ? `${pv.deaths.map((n) => J(n, '이/가')).join(', ')} 오늘 밤 사망합니다. 그래도?` : '';
    const a = await UI.open(body, { options: [{ label: '하루를 보낸다 (저녁으로)', value: 'end', confirm: deathWarn }, { label: '아직', value: null }], cancel: true });
    if (a === 'end') { tutDone('ended'); act({ type: 'endDay' }); }
  }

  // ── 출구: 원정 준비 ──
  async function exitTo(region) {
    const s = state;
    const back = () => { scene.px = region === 'A' ? 2 : 22; scene.py = region === 'A' ? 2 : 9; scene.stationPos = [scene.px, scene.py]; };
    if (s.expDone) { await UI.open('<p>오늘은 이미 지상에 다녀왔다.</p>'); back(); return; }
    if (s.closed[region] > 0) { await UI.open(`<p>${esc(D.REGION_NAMES[region])} 길이 막혀 있다. (${s.closed[region]}일)</p>`); back(); return; }
    const R = D.REGIONS[region];
    const go = await UI.open(`<p class="title">${esc(R.name)} — ${esc(R.sub)}</p><p>${esc(R.intro)}</p><p class="mini">두 사람과 함께 나간다. 보급은 가방 칸을 차지하고, 8시간을 넘기면 강행(시간당 둘 다 스트레스 +10).</p>`, { options: [{ label: '나갈 준비를 한다', value: true }, { label: '돌아선다', value: false }], cancel: true, cancelValue: false });
    if (!go) { back(); return; }
    const prep = { party: [], pack: { food: Math.min(2, s.res.food), water: Math.min(2, s.res.water), meds: Math.min(1, s.res.meds), items: [] } };
    for (;;) {
      const why = E.canDepart(s, region, prep.party, prep.pack);
      const cap = E.BASE_LOAD + prep.party.map((id) => E.byId(s, id)).reduce((a2, r) => a2 + E.traitVal(r, 'expLoad'), 0) - (prep.pack.food + prep.pack.water + prep.pack.meds + prep.pack.items.length);
      const opts = E.homeRes(s).map((r) => {
        const no = r.injury >= 2 ? '중상' : r.stress >= E.STRESS_LIMIT_EXP ? `스트레스 ${r.stress}` : r.breakdown > 0 ? '무너짐' : E.noExp(r) ? '다리를 전다' : E.boundToFlame(s, r) ? '불씨지기' : '';
        const on = prep.party.includes(r.id);
        return { label: `${on ? '✓ ' : ''}${r.name}`, sub: esc(no ? '갈 수 없음: ' + no : `관찰 ${r.skills.obs} 완력 ${r.skills.str} 기술 ${r.skills.tech} 말솜씨 ${r.skills.talk} · 스트레스 ${r.stress}`), disabled: !!no && !on, value: 'p:' + r.id };
      });
      const step2 = (k, label) => [{ label: `${label} +1 (지금 ${prep.pack[k]})`, value: `+:${k}`, disabled: prep.pack[k] >= Math.min(k === 'meds' ? 2 : 6, s.res[k]) }, { label: `${label} −1`, value: `-:${k}`, disabled: prep.pack[k] <= 0 }];
      opts.push(...step2('food', '식량'), ...step2('water', '물'), ...step2('meds', '약품'));
      for (const it of Object.keys(D.ITEMS).filter((k) => s.items[k])) opts.push({ label: `${prep.pack.items.includes(it) ? '✓ ' : ''}${D.ITEMS[it]} 챙기기`, value: 'i:' + it });
      opts.push({ label: '출발', value: 'go', disabled: !!why, sub: esc(why || `전리품 자리 ${cap}칸`) }, { label: '그만둔다', value: 'stop' });
      const a = await UI.open(`<p class="title">${esc(R.name)} 준비</p><p class="mini">동행 ${prep.party.length}/2 · 식량 ${prep.pack.food} · 물 ${prep.pack.water} · 약품 ${prep.pack.meds}${prep.pack.items.length ? ' · ' + prep.pack.items.map((k) => D.ITEMS[k]).join('·') : ''}<br>두 사람이 4시간마다 식량·물을 1개씩 쓴다. 첫 사건까지 4시간.</p>`, { options: opts, full: true, cancel: true, cancelValue: 'stop' });
      if (a === 'stop' || a == null) { back(); return; }
      if (a === 'go') { if (act({ type: 'expStart', region, party: prep.party, pack: prep.pack })) { scene.stationPos = region === 'A' ? [2, 2] : [22, 9]; scene.key = ''; syncScene(); UI.toast(`${D.REGIONS[region].name}. 빛나는 표시(!)를 찾아라.`, 2200); } return; }
      const [k, v] = a.split(':');
      if (k === 'p') { const i = prep.party.indexOf(v); if (i >= 0) prep.party.splice(i, 1); else { if (prep.party.length >= 2) prep.party.shift(); prep.party.push(v); } }
      if (k === '+') prep.pack[v] += 1;
      if (k === '-') prep.pack[v] -= 1;
      if (k === 'i') { const i = prep.pack.items.indexOf(v); if (i >= 0) prep.pack.items.splice(i, 1); else prep.pack.items.push(v); }
    }
  }

  // ── 원정: 표시·계단·출구 ──
  async function marker() {
    const s = state;
    const e = s.exp;
    if (e.phase === 'result') {
      const v = E.expView(s);
      if (v.force) { await UI.open('<p class="rep bad">위독한 동료가 있다. 지금 돌아가야 한다.</p>'); return; }
      if (!v.options.more.ok) { await UI.open(`<p>더 머물 시간이 없다. 지금 돌아가도 ${v.options.back.hours}시간이다.</p>`); return; }
      const ok = await UI.open(`<p>무언가 있다.</p><p class="mini">살펴보면 총 ${v.options.more.hours}시간${v.options.more.over ? ` (강행 +${v.options.more.hours - v.normal})` : ''}.</p>`, { options: [{ label: '살펴본다', value: true }, { label: '그냥 간다', value: false }], cancel: true, cancelValue: false });
      if (!ok) return;
      if (!act({ type: 'expNext', mode: 'more' })) return;
    }
    scene.visited.add(scene.px + ',' + scene.py);
    await eventFlow();
  }
  async function eventFlow() {
    const s = state;
    const v = E.expView(s);
    if (!v || v.phase !== 'event') return;
    const F = D.FIGHTS[s.exp.eventId];
    const opts = choiceOpts(v.choices);
    if (F) opts.unshift({ label: '전투를 벌인다 (부위를 노린다)', sub: esc(`${F.enemy.name} — 부위를 노리는 턴제 전투. 이기면 전리품, 부러진 부위는 부상과 상처로 남는다`), value: 'fight' });
    const a = await UI.open(`<p class="tag">${esc(D.REGIONS[s.exp.region].name)} · 깊이 ${s.exp.depth}</p>${eventArt(s.exp.eventId)}<p class="title">${esc(v.event.title)}</p><p>${esc(v.event.text)}</p>`, { options: opts, full: true });
    if (a === 'fight') {
      const party = s.exp.party.map((id) => E.byId(s, id));
      const res = await BATTLE.run(s, F, party, { pipe: s.exp.pack.items.includes('pipe'), id: s.exp.eventId });
      act({ type: 'expFight', result: res.result, wounds: res.wounds });
    } else act({ type: 'expChoose', i: a });
    const v2 = E.expView(s);
    if (v2 && v2.result) await UI.open(resultHtml(v2.result) + (v2.force ? '<p class="rep bad">위독한 동료가 있다. 돌아가야 한다.</p>' : ''));
    if (v2 && v2.force) { act({ type: 'expNext', mode: 'return' }); afterReturn(); }
  }
  async function stairsDown() {
    const s = state, e = s.exp;
    if (e.phase === 'event') { await UI.open('<p>앞의 표시(!)부터 살펴야 한다. 길을 막고 있는 무언가가 있다.</p>'); return; }
    const v = E.expView(s);
    if (!v.options.deeper.ok) { await UI.open(`<p>${e.depth >= 2 ? '더 내려갈 곳이 없다.' : '내려갈 시간이 없다.'}</p>`); return; }
    const ok = await UI.open(`<p>더 깊이 내려가는 계단.</p><p class="mini">내려가면 총 ${v.options.deeper.hours}시간${v.options.deeper.over ? ` (강행 +${v.options.deeper.hours - v.normal})` : ''}${e.region === 'B' ? ` · 시선 「${D.GODS.nereh.alias}」 +1` : ''}.</p>`, { options: [{ label: '내려간다', value: true }, { label: '아직', value: false }], cancel: true, cancelValue: false });
    if (!ok || !act({ type: 'expNext', mode: 'deeper' })) return;
    scene.key = ''; syncScene();
    UI.toast(scene.dun.name, 1600);
  }
  async function leaveDungeon() {
    const s = state, e = s.exp;
    if (e.phase === 'event') { await UI.open('<p>앞의 표시(!)부터 살펴야 한다. 아무것도 못 챙기고 돌아갈 수는 없다.</p>'); return; }
    const v = E.expView(s);
    const ok = await UI.open(`<p>역으로 돌아간다.</p><p class="mini">귀환 ${v.options.back.hours}시간${v.options.back.over ? ` · 강행(스트레스 +${(v.options.back.hours - v.normal) * 10})` : ''} · 둘 다 스트레스 +12 · 보급 식량 ${v.have.food}/${v.need.food} 물 ${v.have.water}/${v.need.water}</p>`, { options: [{ label: '돌아간다', value: true }, { label: '더 둘러본다', value: false }], cancel: true, cancelValue: false });
    if (!ok) return;
    if (act({ type: 'expNext', mode: 'return' })) afterReturn();
  }
  function afterReturn() {
    const last = state.log[0];
    scene.key = ''; enterStation(false);
    scene.px = scene.stationPos ? scene.stationPos[0] : 11; scene.py = scene.stationPos ? scene.stationPos[1] : 8;
    if (last) UI.toast(last.text, 3200);
  }
  async function expStatus() {
    const v = E.expView(state);
    if (!v) return;
    await UI.open(`<p class="title">${esc(D.REGIONS[v.region].name)} · 깊이 ${v.depth}</p><p class="mini">예상 귀환 ${v.hours}시간 (기본 ${v.normal}, 최대 ${v.max}) · 보급 식량 ${v.have.food}/${v.need.food} 물 ${v.have.water}/${v.need.water}<br>전리품 ${v.used}/${v.cap}칸: ${esc(resText(v.loot) || '없음')}</p>${v.party.map((r) => `<p>${esc(r.name)} 스트레스 ${r.stress}${badges(r)}</p>`).join('')}<p class="mini">표시(!)를 밟으면 사건, 계단(▼)은 더 깊이, 출구(E)는 귀환.</p>`);
  }

  // ── 단계 흐름: 프롤로그·저녁·밤·승차·결말 ──
  async function phaseFlow() {
    for (let guard = 0; guard < 50; guard++) {
      const s = state;
      if (s.phase === 'prologue') { await prologueStep(); return; }
      else if (s.phase === 'evening') await eveningStep();
      else if (s.phase === 'nightEvent') await nightStep();
      else if (s.phase === 'boarding') await boardingStep();
      else if (s.phase === 'ended') { await endedStep(); return; }
      else return;
      hud();
    }
  }
  // ── 프롤로그: 직접 걷는다 ──
  const introShown = {};
  async function sceneIntro() {
    const s = state;
    if (s.phase !== 'prologue' || introShown[s.pro]) return;
    introShown[s.pro] = true;
    if (s.pro === 0) await UI.line(D.WARNING, { name: '안내' });
    const cg = cgSrc(['prologue_car', 'prologue_car', 'prologue_tunnel', 'prologue_station'][s.pro]);
    const parts = UI.splitSentences(D.PROLOGUE[s.pro].text);
    for (let i = 0; i < parts.length; i++) await UI.line(parts[i], i === 0 && cg ? { cg } : {});
  }
  async function prologueChoose(i, who) {
    const sc = D.PROLOGUE[state.pro];
    if (state.proResult || !sc.choices[i]) return;
    if (!act({ type: 'proChoose', i })) return;
    const r = state.proResult;
    await UI.lines(r.text, who ? { name: D.PEOPLE[who].name, face: ART.portrait(who).toDataURL() } : {});
    if (r.lines.length) UI.toast(r.lines.join(' · '), 2400);
    act({ type: 'proNext' });
    if (state.phase === 'morning') { enterStation(true); await dayIntro(); return; }
    if (state.pro === 1) await sceneIntro();          // 승객들은 같은 칸에 있다. 터널·역 도착 설명은 그 자리에 갔을 때
  }
  async function prologueObject(o) {
    const s = state;
    if (o.pro === s.pro && o.choice != null) {
      const ch = D.PROLOGUE[s.pro].choices[o.choice];
      const ok = await UI.open(`<p class="title">${esc(o.name)}</p>`, { options: [{ label: ch.text, value: true }, { label: '그만둔다', value: false }], cancel: true, cancelValue: false });
      if (ok) await prologueChoose(o.choice);
      return;
    }
    UI.toast(s.pro === 0 ? '먼저 이 칸을 나갈 방법을 찾아야 한다.' : '지금은 할 게 없다.', 1500);
  }
  async function prologueNpc(n) {
    const s = state;
    const face = ART.portrait(n.id).toDataURL(), name = D.PEOPLE[n.id].name;
    if (s.pro === 1 && n.choice != null) {
      const ch = D.PROLOGUE[1].choices[n.choice];
      if (n.line) await UI.lines(n.line.replace(/^[^:]+:\s*/, ''), { name, face });
      const ok = await UI.open(`<p class="who">${esc(name)}</p>`, { options: [{ label: ch.text, value: true }, { label: '다른 사람에게도 말을 건다', value: false }], cancel: true, cancelValue: false });
      if (ok) await prologueChoose(n.choice, n.id);
      return;
    }
    if (s.pro === 2 && n.choice != null) {
      const ch = D.PROLOGUE[2].choices[n.choice];
      const ok = await UI.open(`<p class="who">${esc(name)}</p><p>“앞이 무너졌소. 어떻게 하겠소?”</p>`, { options: [{ label: ch.text, value: true }, { label: '아니, 내가 알아서 하겠다', value: false }], cancel: true, cancelValue: false });
      if (ok) await prologueChoose(n.choice, n.id);
      return;
    }
    await UI.lines(s.pro === 0 ? '…' : (n.line || '…').replace(/^[^:]+:\s*/, ''), { name, face });
    if (s.pro === 0) UI.toast('승객들이 웅크려 있다. 먼저 이 칸을 나갈 방법을 찾자.', 1800);
  }
  async function prologueArrive() {
    const s = state;
    if (s.pro < 3) { UI.toast('앞이 무너져 막혀 있다.', 1500); return; }
    await sceneIntro();
    await prologueChoose(0);
  }
  async function dayIntro() {
    hud();
    await UI.lines('을지로입구역. 승강장 한가운데 드럼통에 불을 피웠다. 일곱 사람이 지낼 만은 하다.');
    await UI.lines('구조열차는 열흘 뒤 고지대 역에 온다. 그때까지 통로를 잇고, 사람들을 지켜야 한다.');
    UI.toast('게시판(불 왼쪽)에서 오늘 할 일을 확인하자.', 3500);
  }
  async function prologueStep() { await sceneIntro(); }
  async function eveningStep() {
    const s = state, v = E.eveningView(s);
    if (v.type === 'promise') {
      const i = await UI.open(`<p class="tag">저녁 · 약속</p><p class="title">${esc(v.title)}</p><p>${esc(v.text)}</p>`, { options: choiceOpts(v.choices), full: true });
      act({ type: 'eveningChoose', i });
      const r = state.evening.result;
      await UI.open(`<p class="tag">저녁 · 약속</p>${resultHtml(r)}`);
      act({ type: 'eveningDone' });
    } else if (v.type === 'talk') {
      const home = E.homeRes(s).filter((r) => !s.expParty.includes(r.id));
      const opts = home.map((r) => ({ label: r.name, sub: esc(`스트레스 ${r.stress} → −${Math.max(0, 8 - E.traitVal(r, 'talkEase'))} · 신뢰 ${'●'.repeat(r.trust)}${'○'.repeat(4 - r.trust)}${r.talks === 2 ? ' · 세 번째: 기술 +1' : ''} · 시선 「${D.GODS.ho.alias}」 +1`), value: r.id }));
      opts.push({ label: '이야기하지 않고 밤으로', value: '' });
      const rid = await UI.open('<p class="tag">저녁 · 화로 앞</p><p class="title">누구와 이야기할까</p>', { options: opts });
      if (rid) {
        act({ type: 'talk', rid });
        const t = state.evening;
        await UI.open(`<p class="who">${esc(E.byId(state, rid).name)}</p><p>${esc(t.line)}</p>${fx([`스트레스 −${t.delta}`, '신뢰 +1'].concat(t.extra ? [t.extra.trim()] : []))}`, { next: '밤이 된다' });
        act({ type: 'eveningDone' });
      } else act({ type: 'skipTalk' });
    } else act({ type: 'eveningDone' });
  }
  async function nightStep() {
    const s = state, v = E.nightView(s);
    const dead = s.report.filter((l) => l.kind === 'bad' && /숨을 거뒀다|사라졌다/.test(l.text));
    if (!v.result) {
      const tag = s.nightEv.id === 'god' ? ` · ${s.nightEv.kind === 'omen' ? '징조' : '강림'} — ${esc(E.godLabel(s, s.nightEv.god))}` : '';
      if (!s._reportShown) {
        const surgeNight = s.report.some((l) => l.text === D.CALENDAR.surge.text);
        await UI.open(`<p class="tag">밤</p>${surgeNight ? cgImg('surge') : ''}${dead.map((l) => `<p class="rep bad"><b>${esc(l.text)}</b></p>`).join('')}${reps(s.report.filter((l) => !dead.includes(l)))}`, { full: true, next: '그리고…' });
      }
      const i = await UI.open(`<p class="tag">밤${tag}</p>${s.nightEv.id === 'corpse' ? cgImg('corpse') : s.nightEv.id === 'patrol' ? cgImg('patrol') : s.nightEv.id === 'god' && s.nightEv.kind === 'advent' && cgSrc(s.nightEv.god + '_advent') ? cgImg(s.nightEv.god + '_advent') : eventArt(s.nightEv.id === 'god' ? 'god:' + s.nightEv.god : s.nightEv.id)}<p class="title">${esc(v.title)}</p><p>${esc(v.text)}</p>`, { options: choiceOpts(v.choices), full: true });
      act({ type: 'nightChoose', i });
    }
    const r = E.nightView(state).result;
    await UI.open(`<p class="tag">밤</p>${resultHtml(r)}`, { next: state.day >= D.GOAL_DAY ? '아침 — 열차 시간' : '다음 날 아침' });
    act({ type: 'nightDone' });
    if (state.phase === 'morning') { enterStation(true); UI.toast(`D${state.day}의 아침.`, 1500); }
  }
  async function boardingStep() {
    const s = state, b = s.boarding, tr = E.trainInfo(s);
    if (b.cap === 0) {
      await UI.open(`<p class="tag">D${D.GOAL_DAY} · 열차 시간</p><p class="title">구조열차</p><p>${b.passage ? '통로는 이어졌지만 식량과 물이 모자란다. 한 사람도 태울 수 없다.' : '끊긴 통로 앞에서 열차가 속도를 줄이지 못한다.'}</p>`, { next: '열차를 지켜본다' });
      act({ type: 'confirmBoarding' }); return;
    }
    const opts = b.pool.map((p) => { const on = b.picks.includes(p.id); const r = p.kind === 'resident' ? E.byId(s, p.id) : null; return { label: `${on ? '✓ ' : ''}${p.name}`, sub: esc(r ? `${D.PEOPLE[p.id].bio} · 스트레스 ${r.stress}${r.injury ? ' · 부상 ' + r.injury : ''}` : '약속을 지켜 준 사람'), value: p.id, disabled: !on && b.picks.length >= b.cap }; });
    opts.push({ label: `이 사람들을 태운다 (${b.picks.length}/${b.cap})`, value: '__go', disabled: !b.picks.length, confirm: `${b.picks.length}명을 태웁니다. 확정할까요?` });
    const a = await UI.open(`<p class="tag">D${D.GOAL_DAY} · 열차 시간</p><p class="title">구조열차가 들어온다</p><p class="mini">정원 ${b.cap}명 = 식량·물 ${E.BOARD_PER}개씩 ${tr.base}명${tr.hospital ? ` + 병원 ${tr.hospital}` : ''}${tr.litter ? ` + 들것 ${tr.litter}` : ''}${tr.seat ? ` ${tr.seat > 0 ? '+' : '−'} 검표 ${Math.abs(tr.seat)}` : ''}</p>`, { options: opts, full: true });
    if (a === '__go') act({ type: 'confirmBoarding' }); else act({ type: 'board', id: a });
  }
  async function endedStep() {
    const e = state.ending;
    const mark = { boarded: '승차', stayed: '남음', dead: '사망' };
    const kind = { kept: '지킨 약속', broken: '버린 약속', late: '못 지킨 약속' };
    const a = await UI.open(`${cgImg({ safe: 'ending_safe', half: 'ending_thin', thin: 'ending_thin', missed: 'ending_missed', wiped: 'ending_wiped' }[e.tier])}<p class="tag">${e.tier === 'wiped' ? '끝' : 'D' + D.GOAL_DAY + ' · 첫 번째 열차'}</p><p class="title">${esc(e.title)}</p><p>${esc(e.text)}</p>
      <p class="tag">명부</p>${e.rows.map((r) => `<p>${esc(r.name)} <span class="badge ${r.status === 'boarded' ? 'good' : r.status === 'dead' ? 'bad' : ''}">${mark[r.status]}</span> <span class="mini">${esc(r.line)}</span></p>`).join('')}
      ${e.ledger && e.ledger.length ? `<p class="tag">약속</p>${e.ledger.map((l) => `<p class="rep ${l.kind === 'kept' ? 'good' : l.kind === 'broken' ? 'bad' : 'warn'}">${kind[l.kind]} — ${esc(l.text)}</p>`).join('')}` : ''}`,
    { full: true, options: [{ label: '플레이 기록 복사', value: 'copy' }, { label: '처음부터 다시', value: 'restart', confirm: '처음부터 다시 시작할까요?' }] });
    if (a === 'copy') { copyLog(); return endedStep(); }
    if (a === 'restart') restart();
  }
  function copyLog() {
    const s = state;
    const text = JSON.stringify({ v: 'v3', seed: s.seed, day: s.day, ending: s.ending && { tier: s.ending.tier, title: s.ending.title, ledger: s.ending.ledger }, stats: s.stats, flags: s.flags, gods: s.gods, res: s.res,
      residents: s.residents.map((r) => ({ name: r.name, status: r.status, stress: r.stress, injury: r.injury, scars: r.scars, mem: r.mem.map((m) => `D${m.day} ${m.text}`) })), history: s.history.map((h) => `${h.day ? 'D' + h.day : '프롤로그'} ${h.text}`) }, null, 1);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => UI.toast('플레이 기록을 복사했어요.'), () => window.prompt('복사해 주세요', text));
    else window.prompt('복사해 주세요', text);
  }
  function restart() {
    state = E.newGame((Date.now() & 0x7fffffff) >>> 0);
    save(); scene.key = ''; scene.kind = ''; scene.stationPos = null; for (const k in introShown) delete introShown[k]; enterPrologue(); hud();
    flow(async () => {});
  }

  // ── 메뉴 (B) ──
  async function menu() {
    if (busy || UI.isOpen()) return;
    flow(async () => {
      for (;;) {
        const a = await UI.open('<p class="title">메뉴</p>', { options: [{ label: '사람들', value: 'people' }, { label: '시선', value: 'gods' }, { label: '일지', value: 'log' }, { label: '처음부터 다시', value: 'restart', confirm: '저장된 진행이 지워집니다. 정말 처음부터?' }, { label: '닫기', value: null }], cancel: true });
        if (!a) return;
        if (a === 'restart') { restart(); return; }
        if (a === 'people') await UI.open(state.residents.map((r) => `<div class="person"><b>${esc(r.name)}</b>${badges(r)}<br><span class="mini">스트레스 ${r.stress}${bar(r.stress, 100, r.stress >= 70)} · 관찰 ${r.skills.obs} 완력 ${r.skills.str} 기술 ${r.skills.tech} 말솜씨 ${r.skills.talk}${(r.scars || []).length ? ' · ' + r.scars.map((k) => `${D.SCARS[k].name}(${D.SCARS[k].desc})`).join(', ') : ''}</span></div>`).join(''), { full: true, cancel: true });
        if (a === 'gods') {
          const s = state, kn = { hostile: '적대', neutral: '중립', friendly: '우호' };
          const felt = Object.keys(D.GODS).filter((id) => (s.gods[id] || 0) > 0 || (s.godSeen[id] || 0) > 0);
          await UI.open(`<p class="title">시선</p>${felt.length ? felt.map((id) => { const G = D.GODS[id], v = s.gods[id] || 0; return `<div class="person"><b>${esc(E.godLabel(s, id))}</b> <span class="mini">${s.godSeen[id] ? kn[G.kind] : '정체 모름'} · ${esc(G.hint)}</span><br><span class="mini">시선 ${v}/${E.GOD_ADVENT}${bar(v, E.GOD_ADVENT, v >= E.GOD_ADVENT - 1 && G.kind === 'hostile')}</span><br><span class="mini">${esc(G.raise)}</span></div>`; }).join('') : '<p class="mini">아직 아무것도 느끼지 못했다.</p>'}<p class="mini">시선 ${E.GOD_OMEN}에 징조, ${E.GOD_ADVENT}에 강림.</p>`, { full: true, cancel: true });
        }
        if (a === 'log') await UI.open(`<p class="title">일지</p>${state.history.slice(-16).reverse().map((h) => `<p class="mini">${h.day ? 'D' + h.day : '프롤로그'} · ${esc(h.text)}</p>`).join('')}`, { full: true, cancel: true });
      }
    });
  }

  // ── 입력 ──
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  document.addEventListener('keydown', (e) => {
    const dir = KEYS[e.key];
    const ok = ['z', 'Z', 'Enter', ' '].includes(e.key), back = ['x', 'X', 'Escape'].includes(e.key);
    if (UI.isOpen()) {
      if (dir === 'up' || dir === 'down') { UI.key(dir); e.preventDefault(); }
      else if (ok) { UI.key('ok'); e.preventDefault(); } else if (back) { UI.key('back'); e.preventDefault(); }
      return;
    }
    if (dir) { held.add(dir); e.preventDefault(); } else if (ok) { interact(); e.preventDefault(); } else if (back) { menu(); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => { const dir = KEYS[e.key]; if (dir) held.delete(dir); });
  window.addEventListener('blur', () => held.clear());
  for (const b of document.querySelectorAll('[data-dir]')) {
    const d = b.dataset.dir;
    const on = (e) => { e.preventDefault(); if (UI.isOpen()) { if (d === 'up' || d === 'down') UI.key(d); return; } held.add(d); b.classList.add('on'); };
    const off = () => { held.delete(d); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  }
  $('btnA').addEventListener('click', () => { if (UI.isOpen()) UI.key('ok'); else interact(); });
  $('btnB').addEventListener('click', () => { if (UI.isOpen()) UI.key('back'); else menu(); });

  // ── 시작 ──
  // 지금 할 일 (화면 왼쪽 위)
  function objective() {
    const s = state;
    if (s.phase === 'prologue') return ['비상 레버나 좌석 밑 가방을 살펴보자', '승객들에게 말을 걸자', '터널을 지나 역으로 (앞이 무너졌다)', '터널 끝으로'][s.pro] || '';
    if (s.phase === 'expedition') return '빛나는 표시(!)를 살피고, 계단(출구)으로 돌아가자';
    if (s.phase !== 'morning') return '';
    if (s.day === 1 && !tut.board) return '게시판(불 왼쪽)에서 오늘 할 일을 확인하자';
    if (s.day === 1 && !tut.ended) return '사람에게 말을 걸어 일을 바꾸거나, 화로 앞에서 하루를 마치자';
    if (s.flags.repair_open && !s.flags.passage_secured && !s.project) return '게시판에서 통로 수리를 착공하자';
    if (!s.flags.met_dohyeon && !s.flags.skipped_dohyeon && !s.expDone) return '수문 방면(오른쪽 아래 터널)에서 도울 사람을 찾자';
    if (!s.flags.met_eunchae && !s.flags.skipped_eunchae && !s.expDone) return '시장 방면(왼쪽 위 계단)에서 약국을 찾자';
    return `D${D.GOAL_DAY} 열차까지 ${D.GOAL_DAY - s.day}일 — 통로를 잇고 사람을 지키자`;
  }
  let tut = {};
  try { tut = JSON.parse(localStorage.getItem('darkstation.v3.tut')) || {}; } catch (e) { tut = {}; }
  function tutDone(k) { if (tut[k]) return; tut[k] = true; try { localStorage.setItem('darkstation.v3.tut', JSON.stringify(tut)); } catch (e) { /* 무시 */ } }
  let lastGoal = null, lastBtn = null;
  function overlay() {
    const g = UI.isOpen() || busy ? '' : objective();
    if (g !== lastGoal) { lastGoal = g; $('goal').textContent = g ? '◆ ' + g : ''; $('goal').hidden = !g; }
    const tg = !UI.isOpen() && !busy ? target() : null;
    const label = UI.isOpen() ? '선택' : tg ? tg.label : scene.kind === 'dungeon' ? '상태' : '조사';
    if (label !== lastBtn) { lastBtn = label; $('btnA').textContent = label; }
  }
  function loop() { update(); draw(); overlay(); requestAnimationFrame(loop); }
  ART.ready.then(() => {
    resize(); if (state.phase === 'prologue') enterPrologue(); else syncScene(); if (!scene.rows.length) enterStation(true); hud();
    requestAnimationFrame(loop);
    flow(() => (devFixture ? Promise.resolve() : titleScreen()));
  });
  // 타이틀: 진행 중인 판이 있으면 이어하기
  async function titleScreen() {
    const fresh = state.phase === 'prologue' && state.pro === 0 && !state.proResult;
    const opts = fresh ? [{ label: '시작한다', value: 'go' }] : [{ label: `이어서 (${state.phase === 'prologue' ? '프롤로그' : 'D' + Math.min(state.day, D.GOAL_DAY)})`, value: 'go' }, { label: '처음부터', value: 'new', confirm: '저장된 진행이 지워집니다. 처음부터 시작할까요?' }];
    const a = await UI.open(`${cgImg('title')}<p class="title" style="text-align:center;font-size:24px;letter-spacing:.3em;margin-top:6px">어두운 역</p><p class="mini" style="text-align:center">을지로입구역 · 구조열차까지 열흘</p>`, { options: opts, full: true });
    if (a === 'new') restart();
  }
  if (isLocal) window.__ds3 = { get state() { return state; }, act, scene, flow, step, frame: () => { update(); draw(); overlay(); }, interact, menu, target };
})();
