// 어두운 역 v3 — 쯔꾸르풍 화면. 규칙은 ../v2/engine.js 그대로, 여기서는 맵을 걷고 대화창으로 고른다.
(function () {
  'use strict';
  const E = window.DS2, D = E.D, T = SP.T, M = window.MAPS;
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

  // ── 장면 (역 / 원정) ──
  const scene = { kind: 'station', map: null, rows: [], w: 0, h: 0, px: 0, py: 0, face: 'down', moving: null, visited: new Set(), key: '' };
  function stationMap() { return { rows: M.STATION.rows, w: M.STATION.rows[0].length, h: M.STATION.rows.length }; }
  function enterStation(atFire) {
    const m = stationMap();
    Object.assign(scene, { kind: 'station', rows: m.rows, w: m.w, h: m.h, key: 'station' }); resize();
    if (atFire || !scene.stationPos) { scene.px = M.STATION.start[0]; scene.py = M.STATION.start[1]; } else { [scene.px, scene.py] = scene.stationPos; }
  }
  function enterDungeon() {
    const e = state.exp;
    const key = e.region + Math.min(2, e.depth);
    const d = M.DUNGEONS[key];
    if (scene.key !== key) {
      scene.visited = new Set();
      const rows = d.rows;
      let sx = 1, sy = 1;
      rows.forEach((row, y) => { const x = row.indexOf('E'); if (x >= 0) { sx = x; sy = y; } });
      Object.assign(scene, { kind: 'dungeon', rows, w: rows[0].length, h: rows.length, key, px: sx + 1, py: sy, dun: d }); resize();
    }
  }
  function syncScene() {
    if (state.phase === 'expedition' && state.exp) enterDungeon();
    else if (scene.kind !== 'station') enterStation(false);
    else if (!scene.rows.length) enterStation(true);
  }

  // 사람들이 서 있는 자리 (오늘 배치 그대로)
  function residentsOnMap() {
    const s = state;
    const out = [];
    if (scene.kind !== 'station') {
      if (s.exp) s.exp.party.forEach((id, i) => { if (i > 0) return; });
      return out;
    }
    const plan = E.effectivePlan(s);
    const used = {};
    const beds = [[17, 2], [19, 1], [17, 3], [20, 3], [15, 2], [15, 4]];
    let bi = 0;
    for (const r of E.alive(s)) {
      if (r.status !== 'home') continue;
      if (s.phase === 'morning' && s.expParty.includes(r.id) && false) continue;
      let pos;
      if (r.injury >= 2 || r.breakdown > 0) pos = beds[bi++ % beds.length];
      else {
        let task = plan[r.id] || 'rest';
        if (s.phase !== 'morning') task = 'rest';
        let key = task === 'build' && s.project && s.project.id === 'repair' ? 'buildRepair' : task;
        const list = M.STATION.spots[key] || M.STATION.spots.rest;
        used[key] = (used[key] || 0);
        pos = list[used[key] % list.length]; used[key]++;
        if (used[key] > list.length) pos = M.STATION.spots.rest[(used.rest = (used.rest || 0) + 1) % 8];
      }
      out.push({ r, x: pos[0], y: pos[1] });
    }
    return out;
  }

  // ── 지나갈 수 있는가 ──
  function tileAt(x, y) { return (scene.rows[y] || '')[x] || '#'; }
  function objectsAt(x, y) {
    if (scene.kind !== 'station') return [];
    return M.STATION.objects.filter((o) => x >= o.x && x < o.x + (o.w || 1) && y >= o.y && y < o.y + (o.h || 1));
  }
  function blocked(x, y) {
    const t = tileAt(x, y);
    if (t === '#') return true;
    if (scene.kind === 'station') {
      if (t === 'R' && !state.flags.passage_secured) return true;
      if (objectsAt(x, y).some((o) => o.solid && !(o.id.startsWith('repair') && state.flags.passage_secured))) return true;
      if (residentsOnMap().some((p) => p.x === x && p.y === y)) return true;
    }
    return false;
  }

  // ── 그리기 ──
  let view = { cols: 13, rows: 9, scale: 3 };
  function resize() {
    const st = $('stage');
    const W = st.clientWidth || 375, H = st.clientHeight || 420;
    // 맵 높이(최대 13칸)가 화면 높이에 꽉 차게, 가로는 최소 7칸
    const mapRows = Math.min(13, scene.h || 13);
    const scale = Math.max(2, Math.min(5, Math.floor(H / (T * mapRows)), Math.floor(W / (T * 7))));
    view = { cols: Math.ceil(W / (T * scale)), rows: Math.ceil(H / (T * scale)), scale };
    cv.width = view.cols * T; cv.height = view.rows * T;
    cv.style.width = cv.width * scale + 'px'; cv.style.height = cv.height * scale + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($('stage'));

  const COLORS = { '.': '#2b2621', ',': '#332e28', '=': '#332e28', '~': '#1c1a17', d: '#2b2621', S: '#2b2621', T: '#050505', R: '#2b2621', w: '#1e3442', E: '#2a2520', v: '#2a2520', m: '#2a2520' };
  let tick = 0;
  function draw() {
    tick++;
    const s = state;
    const camX = Math.max(0, Math.min(scene.w * T - cv.width, (scene.px + 0.5) * T - cv.width / 2 + (scene.moving ? scene.moving.dx * scene.moving.t * T - scene.moving.dx * T : 0)));
    const camY = Math.max(0, Math.min(scene.h * T - cv.height, (scene.py + 0.5) * T - cv.height / 2 + (scene.moving ? scene.moving.dy * scene.moving.t * T - scene.moving.dy * T : 0)));
    const ox = scene.w * T < cv.width ? (cv.width - scene.w * T) / 2 : -Math.round(camX);
    const oy = scene.h * T < cv.height ? (cv.height - scene.h * T) / 2 : -Math.round(camY);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(ox, oy);
    const dun = scene.kind === 'dungeon' ? scene.dun : null;
    // 바닥·벽
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) {
      const t = tileAt(x, y), X = x * T, Y = y * T;
      if (t === '#') { ctx.fillStyle = dun ? dun.wall : '#3a332b'; ctx.fillRect(X, Y, T, T); SP.draw(ctx, SP.SPR.wall, X, Y, dun ? shade(dun.wall, 18) : '#4d453a'); continue; }
      ctx.fillStyle = dun && '.EvmS'.includes(t) ? dun.floor : (COLORS[t] || '#2b2621'); ctx.fillRect(X, Y, T, T);
      if (t === '.' || t === ',') { if ((x * 7 + y * 13) % 11 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(X + 3, Y + 9, 2, 1); } }
      if (t === '=') { ctx.fillStyle = '#b8932f'; ctx.fillRect(X, Y + T - 4, T, 2); }
      if (t === '~') { ctx.fillStyle = '#3b342c'; for (let k = 2; k < T; k += 5) ctx.fillRect(X, Y + k, T, 2); ctx.fillStyle = '#77706a'; ctx.fillRect(X, Y + 3, T, 1); ctx.fillRect(X, Y + 12, T, 1); }
      if (t === 'w') { ctx.fillStyle = (tick >> 4) % 2 ? '#2b4a5e' : '#284558'; ctx.fillRect(X + ((x + y) % 3) * 4, Y + 6, 5, 1); }
      if (t === 'v') SP.draw(ctx, SP.SPR.stairsDown, X, Y, '#9a8f80');
      if (t === 'E') SP.draw(ctx, SP.SPR.stairs, X, Y, '#9a8f80');
      if (t === 'm' && !scene.visited.has(x + ',' + y)) { const bob = (tick >> 5) % 2; SP.draw(ctx, SP.SPR.mark, X, Y - bob, '#e0a24a'); }
    }
    if (scene.kind === 'station') drawStation(s); else drawDungeon(s);
    // 주인공
    const pmx = scene.moving ? (scene.px - scene.moving.dx * (1 - scene.moving.t)) : scene.px;
    const pmy = scene.moving ? (scene.py - scene.moving.dy * (1 - scene.moving.t)) : scene.py;
    SP.draw(ctx, SP.SPR.player, Math.round(pmx * T), Math.round(pmy * T) - (scene.moving && (tick >> 2) % 2 ? 1 : 0), SP.TINT.player, scene.face === 'left');
    if (scene.kind === 'dungeon' && state.exp) state.exp.party.forEach((id, i) => {
      const r = E.byId(state, id); const fx2 = pmx - (scene.face === 'right' ? 1 + i : scene.face === 'left' ? -1 - i : 0); const fy2 = pmy - (scene.face === 'down' ? 1 + i : scene.face === 'up' ? -1 - i : 0);
      if (!blocked(Math.round(fx2), Math.round(fy2))) SP.draw(ctx, SP.SPR[id] || SP.SPR.player, Math.round(fx2 * T), Math.round(fy2 * T), SP.TINT[id], scene.face === 'left');
    });
    lighting(pmx, pmy);
    ctx.restore();
  }
  function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, v + d)); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
  let lightCv = null;
  function lighting(pmx, pmy) {
    const s = state;
    if (!lightCv) lightCv = document.createElement('canvas');
    lightCv.width = scene.w * T; lightCv.height = scene.h * T;
    const g = lightCv.getContext('2d');
    let dark = 0.86, lights = [];
    if (scene.kind === 'station') {
      const pv = s.phase === 'morning' ? E.previewNight(s) : null;
      const lit = pv ? !pv.ev.dark : !s.dark;
      dark = lit ? 0.5 : 0.84;
      lights.push([11.5, 7.5, 4.6 + ((tick >> 3) % 3) * 0.15]);
      if (lit) for (const o of M.STATION.objects) if (o.lamp) lights.push([o.x + 0.5, o.y + 0.5, 5.5]);
      if (s.flags.passage_secured) lights.push([23.5, 6.5, 3]);
    }
    lights.push([pmx + 0.5, pmy + 0.5, scene.kind === 'dungeon' ? 3.6 : 2.2]);
    g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, lightCv.width, lightCv.height);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of lights) {
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * T, y * T, r * T, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCv, 0, 0);
    // 화로 빛
    if (scene.kind === 'station') { ctx.fillStyle = 'rgba(224,140,60,0.07)'; ctx.beginPath(); ctx.arc(11.5 * T, 7.5 * T, 3.5 * T, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawStation(s) {
    // 침수: 선로부터 물이 찬다
    const fl = s.flood;
    const waterRows = [];
    if (fl >= 1) waterRows.push([10, fl >= 3 ? 1 : 0.5], [11, fl >= 2 ? 1 : 0.6]);
    if (fl >= 5) waterRows.push([9, fl >= 6 ? 0.9 : 0.5]);
    if (fl >= 7) waterRows.push([8, 0.6]);
    for (const [y, a] of waterRows) { ctx.fillStyle = `rgba(52,92,120,${0.55 * a})`; ctx.fillRect(T, y * T + (a < 1 ? 8 : 0), 22 * T, a < 1 ? 8 : T); }
    // 전동차
    ctx.fillStyle = '#545b60'; ctx.fillRect(2 * T, 10 * T + 1, 7 * T, 2 * T - 2); ctx.fillStyle = '#2d3236'; for (let k = 0; k < 6; k++) ctx.fillRect(2 * T + 6 + k * 18, 10 * T + 5, 10, 8);
    ctx.fillStyle = '#7a2e26'; ctx.fillRect(2 * T, 11 * T + 6, 7 * T, 2);
    // 터널
    ctx.fillStyle = '#000'; ctx.fillRect(23 * T, 10 * T, T, 2 * T);
    // 시설 자리
    if (s.facility === 'farm') for (const x of [10, 12]) SP.draw(ctx, SP.SPR.mush, x * T, 1 * T, '#9bbf7a');
    if (s.facility === 'clinic') { SP.draw(ctx, SP.SPR.cross, 11 * T, 1 * T, '#d06a5a'); SP.draw(ctx, SP.SPR.bed, 12 * T, 1 * T, '#cfcfcf'); }
    if (s.project && s.project.id !== 'repair') { SP.draw(ctx, SP.SPR.crate, 11 * T, 1 * T, '#8c6d4a'); SP.draw(ctx, SP.SPR.rubble2, 12 * T, 1 * T, '#7a705f'); }
    // 무덤
    (s.buried || []).forEach((id, i) => SP.draw(ctx, SP.SPR.grave, (16 + i) * T, 4 * T, '#8d8578'));
    // 물건
    for (const o of M.STATION.objects) {
      if (!o.spr) continue;
      if (o.id.startsWith('repair') && s.flags.passage_secured) continue;
      SP.draw(ctx, SP.SPR[o.spr], o.x * T, o.y * T, o.tint);
    }
    if (s.project && s.project.id === 'repair') SP.draw(ctx, SP.SPR.crate, 22 * T, 8 * T, '#8c6d4a');
    // 화로 불꽃
    SP.draw(ctx, (tick >> 3) % 2 ? SP.SPR.fire : SP.SPR.fire2, 11 * T, 7 * T, null);
    // 노출: 계단 위 안개
    if (s.exposure > 0) { ctx.fillStyle = `rgba(150,150,150,${0.06 * s.exposure})`; ctx.fillRect(T, T, 3 * T, 2 * T); }
    // 사람
    for (const p of residentsOnMap()) {
      const tint = p.r.injury >= 3 ? '#d0574a' : p.r.injury >= 2 ? '#c99a5a' : SP.TINT[p.r.id];
      SP.draw(ctx, SP.SPR[p.r.id], p.x * T, p.y * T, tint);
      if (p.r.breakdown > 0 && (tick >> 4) % 2) SP.draw(ctx, SP.SPR.ask, p.x * T, (p.y - 1) * T, '#e07a6b');
    }
  }
  function drawDungeon() {
    const d = scene.dun;
    for (const [spr, x, y, tint] of d.deco || []) SP.draw(ctx, SP.SPR[spr], x * T, y * T, tint);
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
    if (blocked(nx, ny)) return;
    scene.px = nx; scene.py = ny; scene.moving = { dx, dy, t: 0 };
    if (scene.kind === 'station') scene.stationPos = [nx, ny];
  }
  function front() { const [dx, dy] = DIRS[scene.face]; return [scene.px + dx, scene.py + dy]; }

  // ── 걸어서 밟는 곳 ──
  function arrived() {
    const t = tileAt(scene.px, scene.py);
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
  function interact() {
    if (busy || UI.isOpen() || scene.moving) return;
    if (scene.kind === 'dungeon') { flow(() => expStatus()); return; }
    if (state.phase !== 'morning') return;
    const [fx0, fy0] = front();
    const p = residentsOnMap().find((q) => q.x === fx0 && q.y === fy0);
    if (p) { flow(() => talkTo(p.r)); return; }
    const o = objectsAt(fx0, fy0)[0] || objectsAt(scene.px, scene.py)[0];
    if (o) { flow(() => useObject(o)); return; }
    UI.toast('아무것도 없다.', 900);
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
    if (id === 'board') return boardFlow();
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
    if (a === 'end') act({ type: 'endDay' });
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
    const a = await UI.open(`<p class="tag">${esc(D.REGIONS[s.exp.region].name)} · 깊이 ${s.exp.depth}</p><p class="title">${esc(v.event.title)}</p><p>${esc(v.event.text)}</p>`, { options: opts, full: true });
    if (a === 'fight') {
      const party = s.exp.party.map((id) => E.byId(s, id));
      const res = await BATTLE.run(s, F, party, { pipe: s.exp.pack.items.includes('pipe') });
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
      if (s.phase === 'prologue') await prologueStep();
      else if (s.phase === 'evening') await eveningStep();
      else if (s.phase === 'nightEvent') await nightStep();
      else if (s.phase === 'boarding') await boardingStep();
      else if (s.phase === 'ended') { await endedStep(); return; }
      else return;
      hud();
    }
  }
  async function prologueStep() {
    const s = state, sc = D.PROLOGUE[s.pro];
    if (!s.proResult) {
      const i = await UI.open(`${s.pro === 0 ? `<p class="rep warn">${esc(D.WARNING)}</p>` : ''}<p class="title">${esc(sc.title)}</p><p>${esc(sc.text)}</p>`, { options: sc.choices.map((c, k) => ({ label: c.text, value: k })), full: true });
      act({ type: 'proChoose', i });
    }
    const r = state.proResult;
    await UI.open(`<p class="title">${esc(sc.title)}</p><p class="mini">▸ ${esc(r.choice)}</p><p>${esc(r.text)}</p>${fx(r.lines)}`, { next: state.pro + 1 >= D.PROLOGUE.length ? '역에서의 첫날' : '계속' });
    act({ type: 'proNext' });
    if (state.phase === 'morning') { enterStation(true); UI.toast('게시판에서 오늘 할 일을, 사람에게 말을 걸어 배치를. 화로에서 하루를 보낸다.', 4200); }
  }
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
        await UI.open(`<p class="tag">밤</p>${dead.map((l) => `<p class="rep bad"><b>${esc(l.text)}</b></p>`).join('')}${reps(s.report.filter((l) => !dead.includes(l)))}`, { full: true, next: '그리고…' });
      }
      const i = await UI.open(`<p class="tag">밤${tag}</p><p class="title">${esc(v.title)}</p><p>${esc(v.text)}</p>`, { options: choiceOpts(v.choices), full: true });
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
    const a = await UI.open(`<p class="tag">${e.tier === 'wiped' ? '끝' : 'D' + D.GOAL_DAY + ' · 첫 번째 열차'}</p><p class="title">${esc(e.title)}</p><p>${esc(e.text)}</p>
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
    save(); scene.key = ''; scene.stationPos = null; enterStation(true); hud();
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
  function loop() { update(); draw(); requestAnimationFrame(loop); }
  SP.ready.then(() => {
    resize(); syncScene(); if (!scene.rows.length) enterStation(true); hud();
    requestAnimationFrame(loop);
    flow(async () => {});
  });
  if (isLocal) window.__ds3 = { get state() { return state; }, act, scene, flow, step, frame: () => { update(); draw(); }, interact, menu };
})();
