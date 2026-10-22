// 어두운 역 v4 — PC 화면. 규칙은 전부 엔진(engine/*.js)과 표(data/*.json)에 있고, 여기서는 지도를 걷고 상자에서 고른다.
// 화면은 DS4.engine.view / eventView 를 읽고, 조작은 dispatch 로만. 수치(신뢰·스트레스·공포·정체 축)는 화면 글에 쓰지 않는다 — 몸(자세·반응·피)과 흔적으로만.
(function () {
  'use strict';
  const E = DS4.engine, B = DS4.browser, S4 = DS4.save;
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc;
  const cv = $('cv'), ctx = cv.getContext('2d');
  const GOAL_DAY = 10;
  const PLACE = { station: '묵현역' };

  let db = null, state = null, store = null;
  let busy = false;                       // 대화 흐름 진행 중
  let bot = null;                         // 플레이스루 봇 정책 (?auto= / __ds4.bot)
  let viewPeople = {};                    // 마지막 view 의 사람 행 (엔진이 signs 를 주면 그것을 쓴다)
  let endShown = false;                   // 결말 화면은 판마다 한 번
  const missing = new Set();              // 그림이 없어 글만 나간 장면 (캡처 보고용, 화면에는 안 나온다)

  // ── 조작: dispatch 한 줄 + 저장 ──
  function act(a) {
    const snap = JSON.stringify(state);
    let r;
    try { r = E.dispatch(state, a, db); } catch (err) { state = JSON.parse(snap); r = { ok: false, error: '처리 중 문제가 생겨 되돌렸다.' }; console.error(err); }
    if (r.ok) store.save(state); else if (!a.quiet) UI.toast(r.error || '지금은 할 수 없다');
    hud();
    return r.ok;
  }
  const flagOn = (f) => !!state.flags[f];
  const traceSt = (id) => (state.traces[id] ? state.traces[id].st : (db.objects[id] ? db.objects[id].states[0] : 'none'));
  const person = (id) => state.people[id];
  const home = (id) => person(id) && person(id).status === 'home';
  const youGone = () => { const s = person('you').status; return s === 'dead' || s === 'ascended'; };
  const lineOf = (id, extra) => { const l = B.pickLine(db, id, Object.assign(B.lineCtx(state), extra || {})); return l ? l.text : ''; };
  const josa = (name, pair) => B.fill('{who:' + pair + '}', name);       // 순례가 / 기철이
  // 자원 이름 (numbers 표에 이름 칸이 없다 → 화면이 붙인다). 패널·선택지 비용·잠김 이유·밤 보고서가 같이 쓴다
  const RES = { food: '식량', water: '물', fuel: '땔감', meds: '약', parts: '부품' };
  const RES_ORDER = ['food', 'water', 'fuel', 'meds', 'parts'];
  const RES_ICON = { food: 'food', water: 'water', fuel: 'gen', meds: 'meds', parts: 'parts' };
  const RES_LOW = { food: 1, water: 1, fuel: 1, meds: 0, parts: 0 };     // 이 값 이하면 패널 숫자가 붉다
  const phaseAllows = (a) => { const ph = db.phases.find((p) => p.id === state.phase); return !!(ph && ph.actions.includes(a)); };

  // ── 장면: 지금 지도 ──
  const scene = { map: null, rows: [], w: 0, h: 0, px: 0, py: 0, face: 'down', moving: null, steps: 0, auto: null, cam: null };
  function setScene(mapId, x, y) {
    const m = db.maps[mapId];
    scene.map = m; scene.rows = m.rows; scene.w = m.rows[0].length; scene.h = m.rows.length;
    scene.px = x; scene.py = y; scene.moving = null; scene.auto = null; scene.face = mapId === 'car' ? 'right' : 'down';
    UI.cgClear();
  }
  const tileAt = (x, y) => RENDER.tileAt(scene, x, y);

  // ── 사람 자리 (화면이 정한다 — 표에는 자리가 없다). 잠자리는 maps.beds 순서 = 담요 순서 ──
  const BED_ORDER = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari'];
  const SPOTS = {
    trace: { soonrye: [10, 10], seoha: [16, 10], gicheol: [20, 10], eunji: [18, 10], dongha: [22, 11], mari: [22, 10] },
    ration: { soonrye: [10, 10], seoha: [16, 10], gicheol: [20, 10], eunji: [18, 10], dongha: [22, 11], mari: [22, 10] },
    seat: { soonrye: [10, 10], seoha: [16, 10], gicheol: [20, 10], eunji: [18, 10], dongha: [22, 11], mari: [22, 10] },
    day: { soonrye: [9, 9], seoha: [14, 3], gicheol: [25, 10], eunji: [2, 5], dongha: [3, 5], mari: [22, 11] },
    evening: { soonrye: [12, 10], seoha: [11, 10], gicheol: [14, 10], mari: [15, 10], eunji: [14, 11], dongha: [15, 11] },   // 화로(13,10) 둘레에 앉는다
  };
  const sat = { day: -1, ids: new Set() };   // 오늘 저녁 이야기한 사람 (화면 기억, 저장 안 함) — 아직이면 머리 위 '…'
  const MET = { soonrye: 'arrived', mari: 'met_mari', gicheol: 'met_gicheol', eunji: 'met_eunji', dongha: 'met_eunji', seoha: 'met_seoha' };
  const bedOf = (id) => scene.map.beds[BED_ORDER.indexOf(id)] || null;

  // ── 몸에 보이는 신호 (판단 정보는 친절하게, 수치는 안 보인다) ──
  // eyes  = 오늘 밤 잠들지 않을 사람 (밤 사건표에서 밤에 일어나 움직이는 문턱: needs.fear>=8, 또는 계단에 섰던 사람)
  // mouth = 굶주린 사람(needs.hunger>=7, 남의 것을 훔치는 문턱) · 사람을 먹은 흔적이 있는 사람(ate_flesh_x, dongha_ate_unknowing)
  // [엔진 메모] view.people[].signs 가 생기면 그 값을 먼저 쓴다 — 문턱을 표가 갖게 하려는 것.
  const SIGN = { sleeplessFear: 8, hungry: 7 };
  function signOf(id) {
    const p = person(id);
    if (!p || p.status !== 'home') return '';
    const night = state.phase === 'night' || state.phase === 'aftermath';
    const vs = viewPeople[id] && viewPeople[id].signs;
    if (vs) return night ? (vs.sleepless ? 'eyes' : vs.ateFlesh ? 'mouth' : '') : (vs.ateFlesh || vs.starving ? 'mouth' : '');
    const n = p.n || {};
    const flesh = flagOn('ate_flesh_' + id) || (id === 'dongha' && flagOn('dongha_ate_unknowing'));
    if (night) { if (id !== 'you' && ((n.fear || 0) >= SIGN.sleeplessFear || flagOn('stood_stairs_' + id))) return 'eyes'; return flesh ? 'mouth' : ''; }
    return flesh || (n.hunger || 0) >= SIGN.hungry ? 'mouth' : '';
  }

  // 지도 위 사람: [{id, name, x, y, face, pose, injury, mark, react, bubble, light, talkable}]
  function peopleOnMap() {
    const out = [];
    if (!scene.map) return out;
    const ph = state.phase;
    if (scene.map.id === 'tunnel') {
      if (state.day === 0 && !flagOn('met_gicheol') && traceSt('rubble') !== 'crossed') {
        const near = Math.abs(scene.px - 16) + Math.abs(scene.py - 2) <= 4;
        out.push({ id: 'gicheol', name: '', x: 16, y: 2, face: 'left', pose: null, injury: 0, light: 3.5, talkable: true, bubble: near ? '거기 서.' : '' });
      }
      return out;
    }
    if (scene.map.id !== 'station') return out;
    for (const id of BED_ORDER) {
      const p = person(id);
      if (!p || p.status !== 'home') continue;
      const met = flagOn(MET[id]);
      if (!met) {
        if (id === 'mari' && state.day === 0) { const b = bedOf(id); out.push({ id, name: '', x: b[0], y: b[1], face: 'down', pose: 'sitting', injury: 0, talkable: false }); }
        continue;
      }
      let pos, pose = null, mark = '';
      if (ph === 'night' || ph === 'aftermath') { pos = bedOf(id); pose = 'lying'; }
      else if (ph === 'evening') { pos = SPOTS.evening[id]; pose = 'sitting'; if (!(sat.day === state.day && sat.ids.has(id))) mark = '…'; }
      else pos = (SPOTS[ph] || SPOTS.day)[id];
      if (!pos) continue;
      const dx = scene.px - pos[0], dy = scene.py - pos[1];
      const face = Math.abs(dx) + Math.abs(dy) <= 3 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down')) : 'down';
      out.push({ id, name: p.name, x: pos[0], y: pos[1], face, pose, injury: p.n.injury || 0, mark, react: signOf(id), talkable: ph !== 'night' && ph !== 'aftermath' });
    }
    return out;
  }
  // 지도 위 물건: 표의 자리 + 흔적 상태 → 덧그림
  function objectsOnMap() {
    if (!scene.map) return [];
    const out = [];
    for (const mo of scene.map.objects) {
      const o = db.objects[mo.id]; if (!o) continue;
      const st = traceSt(mo.id);
      const ov = o.overlay && o.overlay[st] ? o.overlay[st] : null;
      let hidden = false;
      if (/^bandage_/.test(mo.id) && st === 'clean') hidden = true;
      if (mo.id === 'body_rail' && st === 'none') hidden = true;
      if (mo.id === 'grave' && st === 'none') hidden = true;
      if (mo.id === 'shoes_stairs' && st === 'none') hidden = true;
      if (mo.id === 'notebook_dash' && st === 'taken') hidden = true;          // 수첩은 이제 당신 주머니에
      out.push({ id: mo.id, x: mo.x, y: mo.y, name: o.name, solid: !!o.solid && !(mo.id === 'rubble' && st === 'crossed'), state: st, stateName: st, overlay: ov, light: mo.id === 'notebook_dash' && st !== 'there' ? 0 : (o.light || 0), hidden });
    }
    return out;
  }
  const objectsAt = (x, y) => objectsOnMap().filter((o) => !o.hidden && o.x === x && o.y === y);
  const rubbleBlocks = (x, y) => scene.map.id === 'tunnel' && x === 17 && traceSt('rubble') !== 'crossed';

  // ── 지나갈 수 있는가 ──
  function blocked(x, y, noNpc) {
    const t = tileAt(x, y);
    if (t === '#' || t === 't' || t === 'R') return true;
    if (t === 'k' && traceSt('office_door') !== 'open') return true;
    if (scene.map.id === 'car' && t === 'E' && traceSt('lever') !== 'pulled') return true;
    if (rubbleBlocks(x, y)) return true;
    if (objectsAt(x, y).some((o) => o.solid)) return true;
    if (!noNpc && peopleOnMap().some((p) => p.x === x && p.y === y)) return true;
    return false;
  }
  function pathTo(sx, sy, tx, ty, avoidNpc) {
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(sx, sy), null]]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) continue;
        if (prev.has(k) || (blocked(nx, ny, !avoidNpc) && !(nx === tx && ny === ty))) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const out = []; let c = [tx, ty];
    while (c && !(c[0] === sx && c[1] === sy)) { out.unshift(c); c = prev.get(key(c[0], c[1])); }
    return out;
  }

  // ── 움직임 ──
  const held = new Set();
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let running = false, frameDt = 16;
  function update() {
    if (!scene.map) return;
    if (scene.moving) {
      const ms = Math.max(1, E.DELAYS.step);
      scene.moving.t += frameDt / (running ? ms * 0.55 : ms);
      if (scene.moving.t >= 1) { scene.moving = null; arrived(); }
      return;
    }
    if (busy || UI.isOpen()) { scene.auto = null; return; }
    const dir = ['up', 'down', 'left', 'right'].find((d) => held.has(d));
    if (dir) { scene.auto = null; step(dir); return; }
    const a = scene.auto;
    if (a) {
      if (a.path.length) {
        const [nx, ny] = a.path[0];
        if (blocked(nx, ny)) {
          const goal = a.path[a.path.length - 1], p = pathTo(scene.px, scene.py, goal[0], goal[1], true);
          if (!p) { scene.auto = null; UI.toast('길이 막혀 있다.', 900); return; }
          a.path = p; return;
        }
        a.path.shift(); step(nx > scene.px ? 'right' : nx < scene.px ? 'left' : ny > scene.py ? 'down' : 'up');
      } else { scene.auto = null; if (a.face) { scene.face = a.face; interact(); } else if (a.then) a.then(); }
    }
  }
  function step(dir) {
    scene.face = dir;
    const [dx, dy] = DIRS[dir];
    const nx = scene.px + dx, ny = scene.py + dy;
    if (nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) return;
    if (blocked(nx, ny)) { if (scene.map.id === 'car' && tileAt(nx, ny) === 'E') UI.toast('문이 닫혀 있다. 레버가 있을 것이다.', 1200); return; }
    scene.px = nx; scene.py = ny; scene.moving = { dx, dy, t: 0 }; scene.steps++;
    if (E.DELAYS.step <= 0) { scene.moving = null; arrived(); }
  }
  function clickCell(px, py) { if (!scene.cam) return null; return [Math.floor((px - scene.cam.ox) / ART.T), Math.floor((py - scene.cam.oy) / ART.T)]; }
  function walkTo(tx, ty, then) {
    if (busy || UI.isOpen() || scene.moving || !scene.map) return false;
    if (tx < 0 || ty < 0 || tx >= scene.w || ty >= scene.h) return false;
    const here = tx === scene.px && ty === scene.py;
    const thing = peopleOnMap().some((p) => p.x === tx && p.y === ty) || objectsAt(tx, ty).length > 0;
    if (here) {                                                     // 제자리: 같은 칸에 사람이 겹쳐 있으면 그 사람과 말한다 (앞 칸 물건이 아니라)
      const p = peopleOnMap().find((q) => q.x === tx && q.y === ty && q.talkable);
      if (p) flow(() => talkTo(p.id)); else interact();
      return true;
    }
    if (thing || blocked(tx, ty)) {
      let best = null;
      for (const [dx, dy, face] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
        const ax = tx + dx, ay = ty + dy;
        if (ax === scene.px && ay === scene.py) { best = { path: [], face }; break; }
        if (blocked(ax, ay)) continue;
        const p = pathTo(scene.px, scene.py, ax, ay, true) || pathTo(scene.px, scene.py, ax, ay);
        if (p && (!best || p.length < best.path.length)) best = { path: p, face };
      }
      if (!best) { UI.toast('갈 수 없는 곳이다.', 900); return false; }
      scene.auto = best; return true;
    }
    const p = pathTo(scene.px, scene.py, tx, ty, true) || pathTo(scene.px, scene.py, tx, ty);
    if (!p) { UI.toast('갈 수 없는 곳이다.', 900); return false; }
    scene.auto = { path: p, face: null, then: then || null };
    return true;
  }
  // 단계가 바뀌어 사람이 제자리로 오면 당신 칸과 겹칠 수 있다(저녁 화로 둘레 = 낮에 화로를 조사하던 칸).
  // 겹치면 당신을 화로 곁 빈칸(아래·위·왼·오른) → 그다음 가까운 빈칸으로 옮긴다. 화로 쪽을 본다.
  function unstack() {
    if (!scene.map || scene.moving) return;
    const ppl = peopleOnMap();
    if (!ppl.some((p) => p.x === scene.px && p.y === scene.py)) return;
    const f = scene.map.fire;
    const near = f ? [[f[0], f[1] + 1, 'up'], [f[0], f[1] - 1, 'down'], [f[0] - 1, f[1], 'right'], [f[0] + 1, f[1], 'left']] : [];
    for (const [x, y, face] of near) if (!blocked(x, y)) { scene.px = x; scene.py = y; scene.face = face; scene.auto = null; return; }
    const seen = new Set([scene.px + ',' + scene.py]); const q = [[scene.px, scene.py]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) continue;
        seen.add(k);
        if (!blocked(nx, ny)) { scene.px = nx; scene.py = ny; scene.auto = null; return; }
        if (!blocked(nx, ny, true)) q.push([nx, ny]);
      }
    }
  }
  const front = () => { const [dx, dy] = DIRS[scene.face]; return [scene.px + dx, scene.py + dy]; };
  const EXIT_NAMES = { A: '지하상가 통로', B: '배수로 통로', S: '출구 계단', k: '역무실 문', R: '무너진 통로', E: '나가는 길' };
  const EXIT_AT = { A: [0, 6], B: [27, 13] };
  function exitHere() {
    const t = tileAt(scene.px, scene.py);
    if (scene.map.id === 'station' && (t === 'A' || t === 'B')) return t;
    return null;
  }
  function hoverName(tx, ty) {
    if (tx == null) return '';
    const p = peopleOnMap().find((q) => q.x === tx && q.y === ty);
    if (p) return p.name || '누군가';
    const o = objectsAt(tx, ty)[0];
    if (o) return o.name;
    return EXIT_NAMES[tileAt(tx, ty)] || '';
  }

  // ── 걸어서 밟는 곳 ──
  function arrived() {
    const t = tileAt(scene.px, scene.py);
    if (scene.map.id === 'car' && t === 'E') { flow(() => enterMap('tunnel')); return; }
    if (scene.map.id === 'tunnel' && t === 'E') { flow(() => enterMap('station')); return; }
    if (scene.map.id === 'station' && (t === 'A' || t === 'B')) { if (state.phase === 'day') UI.toast(`${EXIT_NAMES[t]} — 조사하면 원정`, 1500); }
  }
  // 지도에 들어선다: move 로 자리를 옮기고, 그 지도에 걸린 고정 장면(눈을 뜬다·승강장)이 있으면 건다.
  // [엔진 메모] move 는 사건을 걸지 않으므로, 사건이 없는 물건 하나를 조사해 enterPhase 를 깨운다 (car: shoe_cab, station: board).
  const POKE = { car: 'shoe_cab', station: 'board', tunnel: null };
  async function enterMap(mapId) {
    const m = db.maps[mapId];
    const [x, y] = m.start;
    if (mapId === 'station' && !flagOn('arrived')) await UI.card(PLACE.station, '환선 · 지하 2층');
    else if (mapId === 'tunnel') await UI.card('어두운 터널', '');
    act({ type: 'move', map: mapId, x, y });
    setScene(mapId, x, y);
    if (POKE[mapId] && !state.pending) act({ type: 'inspect', object: POKE[mapId], quiet: true });
    await pendingFlow();
  }

  // ── 조사·말 걸기 ──
  function target() {
    if (scene.moving || !scene.map) return null;
    const [fx, fy] = front();
    const p = peopleOnMap().find((q) => q.x === fx && q.y === fy && q.talkable);
    if (p) return { x: fx, y: fy, kind: 'npc', id: p.id, label: '말 걸기' };
    const o = objectsAt(fx, fy)[0] || objectsAt(scene.px, scene.py)[0];
    if (o) return { x: o.x, y: o.y, kind: 'obj', id: o.id, label: o.id === 'fire' ? fireLabel() : '조사' };
    const ex = exitHere();
    if (ex) return { x: scene.px, y: scene.py, kind: 'exit', id: ex, label: state.phase === 'day' ? '원정' : '통로' };
    return null;
  }
  function interact() {
    if (busy || UI.isOpen() || scene.moving) return;
    const tg = target();
    if (!tg) { UI.toast('아무것도 없다.', 900); return; }
    if (tg.kind === 'npc') flow(() => talkTo(tg.id));
    else if (tg.kind === 'obj') flow(() => useObject(tg.id));
    else flow(() => useExit(tg.id));
  }
  async function flow(fn) {
    if (busy) return;
    busy = true; held.clear();
    try { await fn(); await pendingFlow(); } catch (err) { console.error(err); }
    busy = false;
    hud();
  }

  // 걸린 사건이 있으면 전부 보여 준다 (하나가 끝나고 또 걸릴 수 있다)
  async function pendingFlow() {
    let guard = 0;
    while (state.pending && !state.ended && guard++ < 10) await showEvent();
    if (state.ended) await endingScreen();
  }
  // 선택지 부제: 확률 · 비용(늘 보인다, '약 −1') · 경고 · 잠김 이유. 엔진의 잠김 이유에 남은 영문 id(meds이(가) 모자라다)는 한국어로 바꾼다
  const costText = (cost) => Object.entries(cost || {}).map(([k, v]) => `${RES[k] || k} −${v}`).join(' · ');
  const reasonKo = (r) => String(r || '').replace(/(\S+)이\(가\) 모자라다/g, (m, k) => `${josa(RES[k] || k, '이가')} 모자라다`);
  const choiceSub = (c) => [c.chance != null ? `<small class="chance">${c.chance}%</small>` : '', c.cost && Object.keys(c.cost).length ? `<small class="cost">${esc(costText(c.cost))}</small>` : '',
    c.warn ? `<small class="warn">${esc(c.warn)}</small>` : c.hint ? `<small>${esc(c.hint)}</small>` : '', c.locked ? `<small class="lock">${esc(reasonKo(c.reason))}</small>` : ''].join('');
  // 장면 그림: v4 cg/<image> → v4 cg/<사건 id> → v3 대체 (art.js). 없으면 그림 층을 열지 않는다
  function eventCg(v) {
    const src = ART.cgSrc(v.image, v.id);
    if (src) UI.cg(src);
    else if (v.image) missing.add(v.image + '@' + v.id);
    return !!src;
  }
  async function showEvent() {
    const v = E.eventView(state, db);
    if (!v) return;
    const black = v.id === 'pro_cold';
    if (!black) eventCg(v);
    await UI.lines(v.text, { black, tag: v.id });
    const sentences = UI.splitSentences(v.text);
    let i;
    // 결말에 board:1 이 있으면(열차) 태울 사람을 고르는 줄이 선택지 맨 아래에 붙는다 — 엔진 board 동작(board_<id> 깃발, 다시 누르면 내린다)
    const boardIds = () => (v.board ? db.peopleOrder.filter((id) => id !== 'you' && home(id)) : []);
    const boarded = () => boardIds().filter((id) => flagOn('board_' + id));
    for (;;) {                                                       // 되돌릴 수 없는 선택(금기·결말)은 상자 안에서 한 번 더 묻는다 — OS 확인창 없음
      const opts = v.choices.map((c, k) => ({ label: c.label, sub: choiceSub(c), disabled: c.locked, value: k }));
      if (boardIds().length) opts.push({ label: `태울 사람 (${boarded().length}/${boardIds().length})`, sub: `<small>${esc(boarded().map((id) => person(id).name).join(' · ') || '아직 아무도')}</small>`, value: 'board' });
      i = await UI.open(`<p>${esc(v.text)}</p>`, { kind: 'event', fit: sentences, options: opts, cls: opts.length > 3 ? 'wide' : '' });
      if (i === 'board') { await boardMenu(boardIds()); continue; }
      const c = v.choices[i];
      if (!c || !(c.taboo || v.kind === 'ending')) break;
      const who = boardIds().length ? `<p class="mini">태울 사람: ${esc(boarded().map((id) => person(id).name).join(' · ') || '없음')}</p>` : '';
      const sure = await UI.open(`<p class="who">되돌릴 수 없다</p><p>${esc(c.label)}${c.warn ? ` — <span class="warnt">${esc(c.warn)}</span>` : ''}</p>${who}`, { kind: 'confirm2', options: [{ label: '그렇게 한다', value: true }, { label: '다시 고른다', value: false }] });
      if (sure) break;
    }
    if (!act({ type: 'choose', i })) return;
    const r = state.lastResult || {};
    if (r.image && !black) {                                           // 결과 그림(lastResult.image): 있으면 결과 글 동안 그것으로 바꾼다
      const src = ART.cgSrc(r.image) || (/^death_/.test(r.image) ? ART.deathSrc(r.image) : '');
      if (src) UI.cg(src); else missing.add(r.image + '@' + v.id + ':out');
    }
    if (r.roll) await UI.line(`판정 ${r.roll.chance}% — ${r.roll.success ? '됐다.' : '안 됐다.'}`, { black });
    if (r.text) await UI.lines(r.text, { black, tag: v.id + ':out' });
    if (v.id === 'pro_notebook' || v.id === 'd1_gicheol_arrive') UI.toast(lineOf('toast_ledger_line') || '명부에 한 줄 — Tab');
    if (!state.pending && !state.ended) UI.cgClear();
  }
  // 태울 사람: 배식 그릇처럼 이름을 켜고 끈다 (탄 사람 = 명부 '탔다')
  async function boardMenu(ids) {
    for (;;) {
      const html = `<p class="who">태울 사람</p><div class="bowls">${ids.map((id) => `<span class="${flagOn('board_' + id) ? 'on' : ''}">${esc(person(id).name)}</span>`).join('')}</div>`;
      const opts = ids.map((id) => ({ label: `${person(id).name} ${flagOn('board_' + id) ? '내린다' : '태운다'}`, value: id }));
      opts.push({ label: '됐다', value: null });
      const a = await UI.open(html, { kind: 'board', cancel: true, cancelValue: null, options: opts, cls: 'wide' });
      if (!a) return;
      act({ type: 'board', who: a });
    }
  }
  const faceOf = (id) => { const p = person(id); return ART.portraitSrc(id, p ? p.n.injury : 0, !!(p && p.permanent && p.permanent.ear)); };
  // ── 치료 (엔진 treat: 낮·저녁, 다친 사람 하나에 약 treat_meds, 하루 한 번). 길: 수첩 옆 '치료' 단추(H) · 다친 사람에게 말 걸기 · 젖은 붕대 조사 ──
  // 고를 수 없으면 이유를 보여 준다 (엔진 규칙을 화면에서 미리 본다: 단계 · 다친 데 · 오늘 이미 · 약)
  const treatNeed = () => (Number.isFinite(state.world.treat_meds) ? state.world.treat_meds : 1);
  const HURT_WORD = ['', '다쳤다', '깊이 다쳤다', '위독하다'];
  const hurtWord = (n) => HURT_WORD[Math.max(0, Math.min(HURT_WORD.length - 1, n || 0))];
  const HURT_LOOK = ['', '상처에 피가 배어 있다.', '상처가 깊다. 얼굴이 하얗다.', '열이 오른다. 붕대 밑이 검게 부었다.'];
  function treatWhy(id) {
    const p = person(id);
    if (!p || p.status !== 'home') return '여기 없다';
    if (!((p.n.injury || 0) > 0)) return '다친 데가 없다';
    if (!phaseAllows('treat')) return '낮·저녁에 감는다';
    if (flagOn('treated_' + id)) return '오늘은 이미 감았다';
    if ((state.world.meds || 0) < treatNeed()) return '약이 없다';
    return '';
  }
  const treatOpt = (label, id) => { const why = treatWhy(id); return { label, sub: why ? `<small class="lock">${esc(why)}</small>` : `<small class="cost">${esc(costText({ meds: treatNeed() }))}</small>`, disabled: !!why, value: 'treat' }; };
  const treatable = () => ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && flagOn(MET[id] || '__'))).filter((id) => !treatWhy(id));
  async function doTreat(id) {
    const p = person(id);
    if (!act({ type: 'treat', who: id })) return false;
    await UI.lines(id === 'you' ? '상처를 씻고 붕대를 새로 감았다.' : `${p.name}의 상처를 씻고 붕대를 새로 감았다.`, id === 'you' ? {} : { name: p.name, face: faceOf(id) });
    return true;
  }
  async function treatMenu() {
    const ids = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && home(id) && flagOn(MET[id] || '__')));
    const hurt = ids.filter((id) => (person(id).n.injury || 0) > 0);
    const head = `<p class="who">치료</p><p class="mini">약 ${state.world.meds || 0} · 한 사람에 ${costText({ meds: treatNeed() })} · 낮·저녁에, 하루 한 번</p>`;
    const opts = hurt.map((id) => Object.assign(treatOpt(`${person(id).name} — ${hurtWord(person(id).n.injury)}`, id), { value: id }));
    opts.push({ label: '돌아간다', value: null });
    const a = await UI.open(head + (hurt.length ? '' : '<p>다친 사람이 없다.</p>'), { kind: 'treat', cancel: true, cancelValue: null, options: opts, cls: opts.length > 4 ? 'wide' : '' });
    if (a) await doTreat(a);
  }
  async function talkTo(id) {
    const p = person(id);
    if (!p) return;
    if ((p.n.injury || 0) > 0 && phaseAllows('treat')) {          // 다친 사람: 말을 걸지, 상처를 감아 줄지
      const a = await UI.open(`<p class="who">${esc(p.name)}</p><p>${esc(HURT_LOOK[Math.min(3, p.n.injury)])}</p>`, { kind: 'tend', cancel: true, cancelValue: null,
        options: [{ label: '말을 건다', value: 'talk' }, treatOpt('상처를 감아 준다', id), { label: '돌아선다', value: null }] });
      if (!a) return;
      if (a === 'treat') { await doTreat(id); return; }
    }
    if (!act({ type: 'talk', who: id })) return;
    if (state.pending) return;
    // 그 사람이 본 소문(안 들은 것)이 있으면 먼저 한 줄
    const ri = state.rumors.findIndex((r) => r.witness === id && !r.heard);
    if (ri >= 0) {
      const r = state.rumors[ri];
      const rows = db.lines[r.line] || [];
      const row = rows.length ? rows[r.truth ? 0 : Math.min(1, rows.length - 1)] : null;
      act({ type: 'hear', i: ri, quiet: true });
      if (row) { const who = r.roles && r.roles.actor && person(r.roles.actor) ? person(r.roles.actor).name : (r.roles && r.roles.target && person(r.roles.target) ? person(r.roles.target).name : ''); await UI.lines(B.fill(row.text, who), { name: p.name, face: faceOf(id) }); return; }
    }
    const ctx = B.lineCtx(state);
    const ids = Object.keys(db.lines).filter((k) => k.startsWith(id + '_'));
    let text = '';
    for (const k of ids) { const l = B.pickLine(db, k, ctx); if (l) text = l.text; }     // 뒤에 오는 행이 더 구체적
    if (state.phase === 'evening') { if (sat.day !== state.day) { sat.day = state.day; sat.ids = new Set(); } sat.ids.add(id); }
    await UI.lines(text || '…', { name: p.name, face: faceOf(id) });
  }
  async function useObject(id) {
    if (id === 'fire' && scene.map.id === 'station') return useFire();
    if (!act({ type: 'inspect', object: id })) return;
    if (state.pending) return;
    const o = db.objects[id];
    const st = traceSt(id);
    const lid = o.inspectLine && o.inspectLine[st];
    const text = lid ? lineOf(lid) : '';
    await UI.lines(text || `${o.name}이다.`);
    // 젖은·썩은 붕대: 그 사람이 다쳤으면 그 자리에서 새로 감을 수 있다
    const bm = /^bandage_(\w+)$/.exec(id);
    if (bm && person(bm[1]) && (person(bm[1]).n.injury || 0) > 0 && phaseAllows('treat')) {
      const who = bm[1];
      const a = await UI.open(`<p class="who">${esc(o.name)}</p><p>${esc(person(who).name)} — ${esc(hurtWord(person(who).n.injury))}</p>`, { kind: 'tend', cancel: true, cancelValue: null, options: [treatOpt('붕대를 새로 감는다', who), { label: '둔다', value: null }] });
      if (a === 'treat') await doTreat(who);
    }
    // 수첩에 적을 수 있는 사실 줄이 있으면 묻는다
    const fact = o.ledgerFact && o.ledgerFact[st];
    const phase = db.phases.find((p) => p.id === state.phase);
    if (fact && phase && phase.actions.includes('writeLedger') && !state.ledger.written.some((w) => w.object === id && w.day === state.day)) {
      const t = state.traces[id] || {};
      const txt = String(fact).replace(/\{day\}/g, t.day).replace(/\{by\}/g, t.by && person(t.by) ? person(t.by).name : '');
      const w = await UI.open(`<p class="who">수첩</p><p>${esc(txt)}</p>`, { kind: 'write', options: [{ label: '수첩에 적는다', value: true }, { label: '둔다', value: false }], cancel: true, cancelValue: false });
      if (w && act({ type: 'writeFact', object: id })) UI.toast(lineOf('toast_ledger_line') || '명부에 한 줄 — Tab');
    }
  }
  function fireLabel() { return { trace: '배식으로', ration: '배식', seat: '자리', day: '저녁으로', evening: '밤으로', night: '잠든다', aftermath: '아침으로' }[state.phase] || '조사'; }
  async function useFire() {
    const ph = state.phase;
    const NEXT = { trace: ['불 앞에 앉으면 배식이다.', '그릇을 꺼낸다'], day: ['불 앞에 앉으면 저녁이 된다.', '앉는다'], evening: ['불을 돋우면 밤이다. 더 이야기할 사람이 없나.', '잠자리로'], night: ['잠든다. 아침까지 누구도 깨우지 않는다.', '잠든다'] };
    if (!NEXT[ph]) { await UI.lines(lineOf('insp_fire_' + traceSt('fire')) || '드럼통 안에서 불이 탄다.'); return; }
    const fireText = lineOf('insp_fire_' + traceSt('fire'));
    const go = await UI.open(`<p class="who">화로</p><p>${esc(fireText)}</p><p>${esc(NEXT[ph][0])}</p>`, { kind: 'fire', options: [{ label: NEXT[ph][1], value: true }, { label: '아직', value: false }], cancel: true, cancelValue: false });
    if (!go) return;
    await nextPhase();
  }

  // ── 원정: 통로 → 1층 사건 → (더 내려가거나 돌아온다) → 역. 지도는 그 층으로 바뀌고, 그림은 그 위에 ──
  const TRIP_MAPS = { A: ['mall_a1', 'mall_a2'], B: ['drain_b1', 'drain_b2'] };
  function tripScene(mapId) { const m = db.maps[mapId]; if (m) setScene(mapId, m.start[0], m.start[1]); }
  async function useExit(region) {
    if (state.phase !== 'day') { await UI.line(`${EXIT_NAMES[region]}. 낮에 조사하면 나갈 수 있다.`); return; }
    if (state.trip) { await UI.line('오늘은 이미 다녀왔다. 다리가 말을 듣지 않는다.'); return; }
    const go = await UI.open(`<p class="who">${esc(EXIT_NAMES[region])}</p><p>${region === 'A' ? '셔터 너머가 어둡다. 발소리가 여럿이다.' : '물소리가 난다. 아래가 젖어 있다.'}</p>`, { kind: 'trip', options: [{ label: '나간다', value: true }, { label: '돌아선다', value: false }], cancel: true, cancelValue: false });
    if (!go) return;
    const back = [scene.px, scene.py];
    const [m1, m2] = TRIP_MAPS[region];
    await UI.card(db.maps[m1].displayName, '원정');
    tripScene(m1);
    if (!act({ type: 'trip', region, floor: 1, quiet: true })) await UI.line('아무것도 없었다. 누가 먼저 다녀갔다.');
    await pendingFlow();
    if (!state.ended && db.maps[m2]) {
      const deeper = await UI.open(`<p class="who">${esc(db.maps[m1].displayName)}</p><p>계단이 아래로 이어진다. 아래는 덜 뒤져졌다. 돌아오는 길은 멀다.</p>`,
        { kind: 'deeper', options: [{ label: '아래층으로 내려간다', sub: '<small class="warn">더 많고, 더 다친다</small>', value: true }, { label: '역으로 돌아간다', value: false }] });
      if (deeper) {
        await UI.card(db.maps[m2].displayName, '원정 · 아래층');
        tripScene(m2);
        if (!act({ type: 'trip', floor: 2, quiet: true })) await UI.line('아무것도 없었다. 물이 발목까지 찼다.');
        await pendingFlow();
      }
    }
    if (state.ended) return;
    await UI.card(PLACE.station, '');
    setScene('station', back[0], back[1]);
    await UI.line('역으로 돌아왔다.');
  }

  // ── 하루 7단계 ──
  async function nextPhase() {
    const before = { day: state.day, world: Object.assign({}, state.world), status: Object.fromEntries(Object.values(state.people).map((p) => [p.id, p.status])) };
    if (!act({ type: 'next' })) return;
    await phaseEnter(before);
  }
  async function phaseEnter(before) {
    const ph = state.phase;
    if (state.ended) { await endingScreen(); return; }
    unstack();
    if (before && state.day !== before.day) {
      const left = GOAL_DAY - state.day;
      await UI.card(`D${state.day}`, left > 0 ? `열차까지 ${left}일` : '열차가 오는 날');
      store.markMorning(state);
      await nightReport(before);
    }
    if (ph === 'trace') { if (scene.map && scene.map.id !== 'station') { act({ type: 'move', map: 'station', x: 13, y: 11, quiet: true }); setScene('station', 13, 11); } }
    if (ph === 'ration') { await pendingFlow(); if (!state.ended) await rationFlow(); return; }
    if (ph === 'seat') { await pendingFlow(); if (!state.ended) { await UI.line('사람들이 제 자리로 흩어진다.'); await nextPhase(); } return; }
    if (ph === 'aftermath') { await pendingFlow(); if (!state.ended) { await dream(); await UI.line('밤이 지난다.', { black: true }); await nextPhase(); } return; }
    await pendingFlow();
  }
  // 꿈 한 컷 (D4·D6·D8 밤): 지금 기운 정체의 꿈 줄 + 그림. 정체 단어는 안 나온다
  const DREAM_DAYS = { 4: 0, 6: 1, 8: 2 };
  async function dream() {
    const k = DREAM_DAYS[state.day];
    if (k == null) return;
    const c = E.identity(state, db);
    if (!c || !c.dreams || !c.dreams[k]) return;
    const text = lineOf(c.dreams[k]);
    if (!text) return;
    const src = ART.identSrc(c.id);
    if (src) UI.cg(src);
    if (UI.bot) autoLog.push(`[꿈 D${state.day}]`);
    await UI.lines(text, { tag: 'dream' });
    UI.cgClear();
  }
  // 배식: 사람마다 그릇을 켜고 끈다 → ration 동작
  async function rationFlow() {
    const names = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && home(id)));   // 당신 그릇이 맨 앞 (엔진은 적힌 순서대로 푼다)
    const bowls = Object.fromEntries(names.map((id) => [id, true]));
    for (;;) {
      const bowlHtml = names.map((id) => `<span class="${bowls[id] ? 'on' : ''}">${esc(person(id).name)}</span>`).join('');
      const n = names.filter((id) => bowls[id]).length;
      const opts = names.map((id) => ({ label: `${person(id).name} ${bowls[id] ? '그릇을 뺀다' : '그릇을 놓는다'}`, value: id }));
      opts.push({ label: `배식한다 (그릇 ${n})`, value: '__go' });
      const a = await UI.open(`<p class="who">배식</p><div class="bowls">${bowlHtml}</div>`, { kind: 'ration', options: opts, cls: 'wide' });
      if (a === '__go') break;
      bowls[a] = !bowls[a];
    }
    act({ type: 'ration', bowls, quiet: true });
    await nextPhase();
  }
  // 밤 보고서: 달라진 것만 + 잃은 것 한 줄 (수치 이름은 패널에 있는 자원 — 식량·물·땔감·약·부품 — 만)
  async function nightReport(before) {
    const parts = [];
    for (const k of RES_ORDER) { const d = (state.world[k] || 0) - (before.world[k] || 0); if (d) parts.push(`${RES[k]} ${d > 0 ? '+' : '−'}${Math.abs(d)}`); }
    const gone = Object.values(state.people).filter((p) => before.status[p.id] === 'home' && p.status !== 'home' && p.id !== 'you')
      .map((p) => josa(p.name, '이가') + (p.status === 'ascended' ? ' 올라갔다' : p.status === 'stayed' ? ' 셔터 너머로 갔다' : ' 밤에 갔다'));
    const noise = state.nightLog.some((e) => e.day === before.day && e.role !== 'clock');
    const text = [gone.length ? gone.join('. ') + '.' : '', parts.join(' · '), noise ? '밤에 무슨 소리가 났다. 흔적이 남았을 것이다.' : ''].filter(Boolean).join(' ');
    if (text) await UI.lines(text, { black: true });
  }

  // ── 명부·결말 ──
  const STATUS_KO = { boarded: '탔다', dead: '갔다', ascended: '올라갔다', stayed: '남았다', walked: '걸어 나갔다' };
  // 명부 행 = 엔진 값 그대로(ended.ledger: 결과의 ledger 칸 · 결말의 endStatus·board 가 정한 status). 데이터가 d10_walk endStatus:walked · d10_train '챙긴 운임으로 탄다' ledger boarded 를 채워서 화면의 임시 변환(walked_out·you_boarded 깃발)은 지웠다
  const ledgerRows = () => (state.ended && state.ended.ledger) || E.ledger.rows(state, db);
  const rowDay = (r) => (r.day != null && r.day !== '' && (r.status === 'dead' || r.status === 'ascended') ? `D${r.day}` : '');
  const rowCause = (r) => (r.status === 'dead' || r.status === 'ascended' ? (r.cause ? esc(r.cause) : '<span class="blank">___</span>') : '');
  // 명부 한 장 (무대 층): 탄 사람 옆에 구멍, 죽은 줄에 날짜와 줄긋기, 올라간 줄은 옅게, 사인 빈칸은 ___ , 당신 줄은 맨 위
  function ledgerPage(rows, foot) {
    const body = rows.map((r) => `<div class="lrow ${r.status}${r.id === 'you' ? ' you' : ''}"><span class="hole"></span><span class="nm">${esc(r.name)}</span><span class="st">${STATUS_KO[r.status] || ''}</span><span class="dd">${rowDay(r)}</span><span class="cs">${rowCause(r)}</span></div>`).join('');
    return `<p class="lhead">승객 명부</p>${body}${foot ? `<p class="ft">${esc(foot)}</p>` : ''}`;
  }
  const ledgerMini = (rows) => `<div class="ledger">${rows.map((r) => `<div class="row ${r.status}"><span>${esc(r.name)}</span><span>${STATUS_KO[r.status] || ''}${rowDay(r) ? ' · ' + rowDay(r) : ''} ${rowCause(r)}</span></div>`).join('')}</div>`;
  // 수첩을 줍는 사람: 엔진의 ended.readerId(나이 많은 산 주민 · 'you' · 'conductor' · null). 옛 저장(readerId 없음)만 화면 순서로 고른다
  const READER_ORDER = ['soonrye', 'mari', 'gicheol', 'eunji', 'dongha', 'seoha'];
  const pickResident = () => {
    const e = state.ended;
    if (e && Object.prototype.hasOwnProperty.call(e, 'readerId')) return e.readerId && e.readerId !== 'you' && e.readerId !== 'conductor' && person(e.readerId) ? person(e.readerId) : null;
    for (const id of READER_ORDER) if (home(id)) return person(id);
    return null;
  };
  // 당신 사망 그림: 데이터가 단 그림(ended.cause.image — 결과의 image)이 먼저. 비어 있을 때만 사인 사건 id 로 고른다.
  //   담요 아래에서 죽은 그림(death_starve: 누운 손, 수첩을 가져가는 손)은 굶주림·열·곪은 상처·밤에 당한 죽음이 같이 쓴다
  const DEATH_BED = 'death_starve';
  function deathKind() {
    const e = state.ended || {};
    const c = e.cause || {};
    if (/^death_/.test(c.image || '')) return c.image;
    const ev = c.event || (state.lastResult && state.lastResult.event) || '';
    if (person('you').status === 'ascended') return 'death_counted';
    if (/starve/.test(ev)) return 'death_starve';
    if (/flood_sick|flux/.test(ev)) return 'death_flux';
    if (/drown|flood|surge/.test(ev)) return 'death_drown';
    if (/rot|fever|injury_untreated|wound|pillow/.test(ev) || c.night) return DEATH_BED;
    return 'death_beaten';
  }
  function deathSrc() {
    const c = (state.ended && state.ended.cause) || {};
    if (c.image && !/^death_/.test(c.image)) { const s = ART.cgSrc(c.image, c.event); if (s) return s; }   // 데이터가 사망 그림 대신 장면 그림을 달았으면 그것
    return ART.deathSrc(deathKind());
  }
  // 사망 한 줄: 올라감 · 재가 됨(계단 그림인데 status dead) · 물 · 그 밖
  function deathLine(kind) {
    if (person('you').status === 'ascended') return '당신 신발이 계단 아래 가지런히 남았다.';
    if (kind === 'death_counted') return '계단 위에 당신 구두만 남았다.';
    if (kind === 'death_drown') return '당신은 떠오르지 않았다.';
    return '당신은 일어나지 않았다.';
  }
  function queueTitle() { const t = setInterval(() => { if (!busy && !UI.isOpen()) { clearInterval(t); titleScreen(true); } }, 40); }
  async function endingScreen() {
    const e = state.ended;
    if (!e || endShown) return;
    endShown = true;
    const rows = ledgerRows();
    const cand = e.identity ? db.identity.candidates.find((c) => c.id === e.identity) : null;
    if (youGone()) {
      // 당신 사망: 사망 그림 + 한 줄 → 수첩을 주운 사람이 명부를 읽는다
      UI.cg(deathSrc());
      await UI.line(deathLine(deathKind()), { tag: 'death' });
      const rd = pickResident();
      const head = rd ? `${josa(rd.name, '이가')} 당신 주머니에서 수첩을 꺼내 읽는다.` : '수첩은 승강장 바닥에 남았다. 아무도 줍지 않았다.';
      await UI.open(`<p class="who">${esc(head)}</p>${ledgerMini(rows)}`, { kind: 'death_ledger', options: [{ label: '덮는다', value: true }] });
    } else {
      // 결말: 명부 한 장
      const why = { all_dead: '아무도 남지 않았다.', train: '열흘이 지났다.' }[e.why] || '';
      const rid = Object.prototype.hasOwnProperty.call(e, 'readerId') ? e.readerId : (e.reader === 'resident' ? (pickResident() || {}).id || null : e.reader);
      const reader = rid === 'conductor' ? '차장이 명부를 읽는다.' : rid === 'you' ? '당신이 명부를 읽는다.' : rid && person(rid) ? `${josa(person(rid).name, '이가')} 수첩을 주워 읽는다.` : '아무도 읽지 않는다.';
      UI.page(ledgerPage(rows, why), 'ledger-page');
      const cap = db.events.ending_ledger ? db.events.ending_ledger.text : '';
      await UI.open(`<p class="who">${esc(reader)}</p>${cap ? `<p class="mini">${esc(cap)}</p>` : ''}`, { kind: 'ending', cls: 'short', options: [{ label: '덮는다', value: true }] });
    }
    // 정체: 그림 한 장 + 한 줄 (정체 단어는 화면에 안 나온다)
    if (cand) {
      const src = ART.identSrc(cand.id);
      if (src) UI.cg(src); else UI.cgClear();
      for (const lid of cand.reveal || []) { const t = lineOf(lid); if (t) await UI.lines(t, { tag: 'reveal' }); }
    }
    UI.cgClear();
    queueTitle();
  }

  // ── 머리말(패널) ──
  function hud() {
    if (!state) return;
    const v = E.view(state, db);
    viewPeople = Object.fromEntries(v.people.map((p) => [p.id, p]));
    const ic = (k) => (ART.iconSrc(RES_ICON[k] || k) ? `<img class="ic" alt="" src="${ART.iconSrc(RES_ICON[k] || k)}">` : '');
    // 자원 다섯: 식량·물·땔감(always) + 약·부품(선택지 비용·치료에 드는 것 — 판단 정보). view.world 에 없는 것(표가 never 로 숨긴 것)은 그리지 않는다
    const it = (k) => (v.world[k] == null ? '' : `<div class="it ${(v.world[k] || 0) <= RES_LOW[k] ? 'low' : ''}">${ic(k)}<b>${v.world[k] || 0}</b><span>${RES[k]}</span></div>`);
    const PH = { trace: '아침 — 흔적', ration: '아침 — 배식', seat: '아침 — 자리', day: '낮', evening: '저녁', night: '밤', aftermath: '새벽', ended: '끝' };
    const faces = db.peopleOrder.filter((id) => id !== 'you' && flagOn(MET[id] || '__')).map((id) => `<img alt="${esc(person(id).name)}" title="${esc(person(id).name)}" class="${home(id) ? '' : 'gone'}" src="${faceOf(id)}">`).join('');
    const left = Math.max(0, GOAL_DAY - state.day);
    $('hud').innerHTML = `<div class="day">D${state.day}<small>${left > 0 ? `열차까지 ${left}일` : '열차가 오는 날'}</small></div>${RES_ORDER.map(it).join('')}<div class="phase">${PH[state.phase] || ''}</div><div class="people">${faces}</div>`;
    // 치료 단추: 지금 감을 수 있는 사람이 있으면 밝힌다
    const tb = $('tabTreat');
    if (tb) tb.classList.toggle('urgent', !state.ended && treatable().length > 0);
  }
  function objective() {
    if (!state || !scene.map) return '';
    const m = scene.map.id;
    if (m === 'car') return traceSt('lever') === 'pulled' ? '오른쪽 끝 열린 문으로 나간다' : '전동차 안을 살핀다';
    if (m === 'tunnel') return traceSt('rubble') === 'crossed' ? '터널 끝 승강장으로' : '앞쪽 불빛으로';
    if (m !== 'station') return '';
    if (state.day === 0) return '승강장을 둘러본다 · 화로를 조사하면 저녁';
    return { trace: '아침 — 흔적을 살피고 말을 건다 · 화로를 조사하면 배식', day: state.trip ? '낮 — 다녀왔다 · 화로를 조사하면 저녁' : '낮 — 통로를 조사하면 원정 · 화로를 조사하면 저녁', evening: lineOf('toast_fire_night') ? '저녁 — 한 사람과 이야기할 수 있다 · ' + lineOf('toast_fire_night') : '저녁', night: '밤 — 화로를 조사하면 잠든다' }[state.phase] || '';
  }

  // ── 일시정지(Esc)·수첩(Tab)·타이틀 ──
  async function pauseMenu() {
    const a = await UI.open('<p class="title">멈춤</p>', { kind: 'pause', cancel: true, cancelValue: 'go', cls: 'wide', options: [{ label: '계속', value: 'go' }, { label: '전체화면', value: 'full' }, { label: '저장 코드 복사', value: 'export' }, { label: '타이틀로', value: 'title' }] });
    if (a === 'full') toggleFull();
    else if (a === 'export') { try { const code = store.exportCode(state); if (navigator.clipboard) await navigator.clipboard.writeText(code); UI.toast('저장 코드를 복사했다.'); } catch (e) { UI.toast('복사하지 못했다.'); } }
    else if (a === 'title') await titleScreen(false);
  }
  // 사인 칸: 적거나, 비워 두거나. 한 번 적으면 고칠 수 없다 (상자 안 2단 선택)
  async function writeCauseFlow(id) {
    const p = person(id);
    const base = p.status === 'ascended' ? '올라갔다' : '밤에 갔다';
    const facts = state.ledger.written.filter((w) => w && w.text && w.text.includes(p.name)).slice(-2).map((w) => w.text);
    const short = (t) => (t.length > 22 ? t.slice(0, 22) + '…' : t);
    const opts = [{ label: base, value: base }].concat(facts.map((t) => ({ label: short(t), value: t }))).concat([{ label: '비워 둔다', value: '__blank' }, { label: '아직', value: null }]);
    const c = await UI.open(`<p class="who">${esc(p.name)} — 사인 칸</p><p class="mini">적지 않는 것도 적는 것이다. 한 번 적으면 고칠 수 없다.</p>`, { kind: 'cause', cancel: true, cancelValue: null, options: opts, cls: 'wide' });
    if (c == null) return;
    const sure = await UI.open(`<p class="who">되돌릴 수 없다</p><p>${esc(p.name)} — ${c === '__blank' ? '___' : esc(c)}</p>`, { kind: 'confirm2', options: [{ label: '그렇게 적는다', value: true }, { label: '다시 고른다', value: false }] });
    if (!sure) return;
    if (!act({ type: 'writeCause', who: id, line: c === '__blank' ? null : c, quiet: true })) UI.toast('지금은 적을 수 없다 — 아침·저녁·새벽에');
  }
  async function notebook() {
    for (;;) {
      const a = await UI.open('<p class="title">수첩</p><p class="mini">명부 · 사실 줄 · 일지</p>', { kind: 'book', cancel: true, cancelValue: null, cls: 'wide', options: [{ label: '명부', value: 'ledger' }, { label: '사실 줄', value: 'facts' }, { label: '일지', value: 'log' }, { label: '덮는다', value: null }] });
      if (!a) return;
      if (a === 'ledger') {
        const ids = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && flagOn(MET[id] || '__')));   // 당신 줄은 맨 위
        const rows = ids.map((id) => { const p = person(id); const st = p.status === 'home' ? '' : p.status; return { id, name: p.name, status: st, day: p.day, cause: Object.prototype.hasOwnProperty.call(state.ledger.causes, id) ? state.ledger.causes[id] : null }; });
        const html = `<p class="who">승객 명부</p><div class="ledger">${rows.map((r) => `<div class="row ${r.status}"><span>${esc(r.name)}</span><span>${r.id === 'you' && !r.status ? '당신 글씨' : r.status ? `${STATUS_KO[r.status] || ''}${rowDay(r) ? ' · ' + rowDay(r) : ''} ${rowCause(r)}` : ''}</span></div>`).join('')}</div>`;
        const open = rows.filter((r) => r.id !== 'you' && (r.status === 'dead' || r.status === 'ascended') && !Object.prototype.hasOwnProperty.call(state.ledger.causes, r.id));
        const ph = db.phases.find((x) => x.id === state.phase);
        const canWrite = !!(ph && ph.actions.includes('writeLedger'));
        const b = await UI.open(html, { kind: 'bookpage', cancel: true, cancelValue: null, cls: open.length ? 'wide' : '', options: open.slice(0, 3).map((r) => ({ label: `${r.name} 사인 칸`, sub: canWrite ? '' : '<small>아침·저녁·새벽에 적는다</small>', disabled: !canWrite, value: 'cause:' + r.id })).concat([{ label: '돌아간다', value: null }]) });
        if (b && String(b).startsWith('cause:')) await writeCauseFlow(String(b).slice(6));
        continue;
      }
      let body = '';
      if (a === 'facts') body = `<p class="who">사실 줄</p><div class="list">${state.ledger.written.filter((w) => w && w.text).length ? state.ledger.written.filter((w) => w && w.text).slice(-7).map((w) => `<p><span class="d">D${w.day}</span>${esc(w.text)}</p>`).join('') : '<p class="mini">아직 아무것도 적지 않았다.</p>'}</div>`;
      else body = `<p class="who">일지</p><div class="list">${state.log.filter((l) => l.kind === 'choice').slice(0, 7).map((l) => `<p><span class="d">D${l.day}</span>${esc(l.text)}</p>`).join('') || '<p class="mini">비어 있다.</p>'}</div>`;
      await UI.open(body, { kind: 'bookpage', cancel: true, cancelValue: null, options: [{ label: '돌아간다', value: null }] });
    }
  }
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }

  function startGame(s) {
    state = s; endShown = false;
    if (!state.pos.map) { setScene('car', db.maps.car.start[0], db.maps.car.start[1]); }
    else setScene(state.pos.map, state.pos.x, state.pos.y);
    hud();
    unstack();
  }
  async function newGame(seed) {
    const s = E.newGame(db, seed == null ? ((Date.now() & 0x7fffffff) >>> 0) : seed);
    startGame(s);
    store.clear(); store.save(state);
    await enterMap('car');
  }
  async function titleScreen(fromEnd) {
    const loaded = fromEnd ? { state: null } : store.load();
    if (loaded.message) UI.toast(loaded.message, 3000);
    for (;;) {
      const opts = [];
      if (loaded.state && !loaded.state.ended) opts.push({ label: `계속 (D${loaded.state.day})`, value: 'go' });
      opts.push({ label: '새로 시작', value: 'new' }, { label: '저장 코드 불러오기', value: 'import' }, { label: '전체화면', value: 'full' });
      UI.cg(ART.cgSrc('title'));
      const a = await UI.open('<p class="title" style="text-align:center;letter-spacing:.3em">어두운 역</p><p class="mini" style="text-align:center">묵현역 · 열차까지 열흘 · 18+</p>', { kind: 'title', options: opts, cls: 'wide' });
      if (a === 'full') { toggleFull(); continue; }
      if (a === 'import') {
        await UI.open('<p class="title">저장 코드</p><p><input type="text" id="codeIn" placeholder="코드를 붙여 넣는다"></p>', { kind: 'import', cancel: true, options: [{ label: '불러온다', value: true }] });
        const el = $('codeIn'); const s = el ? store.importCode(el.value) : null;
        if (s) { UI.cgClear(); startGame(s); store.save(state); await pendingFlow(); return; }
        UI.toast('알 수 없는 저장 코드다.'); continue;
      }
      if (a === 'new') {
        if (loaded.state && !loaded.state.ended) { const ok = await UI.open('<p>진행 중인 판이 지워진다.</p>', { kind: 'confirm', options: [{ label: '그래도 새로 시작한다', value: true }, { label: '돌아간다', value: false }] }); if (!ok) continue; }
        UI.cgClear(); await newGame(); return;
      }
      UI.cgClear(); startGame(loaded.state); await pendingFlow(); return;
    }
  }

  // ── 입력 ──
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') { UI.key('ok'); e.preventDefault(); } return; }
    const dir = KEYS[e.key];
    const ok = ['z', 'Z', 'Enter', ' '].includes(e.key), back = ['x', 'X', 'Escape'].includes(e.key);
    if (e.key === 'Shift') { running = true; return; }
    if (e.key === 'f' || e.key === 'F') { toggleFull(); e.preventDefault(); return; }
    if (e.key === 'Tab') { e.preventDefault(); if (state && !state.ended && !UI.isOpen() && !busy) flow(notebook); return; }
    if ((e.key === 'h' || e.key === 'H') && !UI.isOpen()) { e.preventDefault(); if (state && !state.ended && !busy) flow(treatMenu); return; }
    if (UI.isOpen()) {
      if (dir === 'up' || dir === 'down') { UI.key(dir); e.preventDefault(); }
      else if (ok) { UI.key('ok'); e.preventDefault(); } else if (back) { UI.key('back'); e.preventDefault(); }
      else if (/^[1-9]$/.test(e.key)) { UI.pick(Number(e.key) - 1); e.preventDefault(); }
      return;
    }
    if (!state) return;
    if (dir) { held.add(dir); e.preventDefault(); } else if (ok) { interact(); e.preventDefault(); } else if (back) { if (!busy) flow(pauseMenu); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => { const dir = KEYS[e.key]; if (dir) held.delete(dir); if (e.key === 'Shift') running = false; });
  window.addEventListener('blur', () => { held.clear(); running = false; });
  const stageXY = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
  cv.addEventListener('click', (e) => { if (!state || UI.isOpen() || busy) return; const [px, py] = stageXY(e); const c = clickCell(px, py); if (c) walkTo(c[0], c[1]); });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (UI.isOpen()) UI.key('back'); else { scene.auto = null; held.clear(); } });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('#box')) { e.preventDefault(); UI.key('back'); } });
  let hover = '';
  cv.addEventListener('mousemove', (e) => { if (!state) return; const [px, py] = stageXY(e); const c = clickCell(px, py); hover = c ? hoverName(c[0], c[1]) : ''; });
  cv.addEventListener('mouseleave', () => { hover = ''; });
  $('tabBook').addEventListener('click', () => { if (state && !state.ended && !UI.isOpen() && !busy) flow(notebook); });
  $('tabTreat').addEventListener('click', () => { if (state && !state.ended && !UI.isOpen() && !busy) flow(treatMenu); });
  $('tabPause').addEventListener('click', () => { if (UI.isOpen()) UI.key('back'); else if (state && !busy) flow(pauseMenu); });
  $('tabFull').addEventListener('click', toggleFull);

  // ── 배율·화면 갱신 (숨은 창에서도 돌게 setInterval) ──
  function fitApp() { const W = window.innerWidth || 1280, H = window.innerHeight || 720; const k = Math.max(1, Math.floor(Math.min(W / 640, H / 360))); $('app').style.transform = `scale(${k})`; }
  window.addEventListener('resize', fitApp);
  let tick = 0, lastT = 0, lastGoal = null, lastHint = null;
  function overlay() {
    const g = UI.isOpen() || busy ? '' : objective();
    if (g !== lastGoal) { lastGoal = g; $('goal').textContent = g; }
    const tg = !UI.isOpen() && !busy && state ? target() : null;
    const label = UI.isOpen() ? '' : hover ? hover + ' (클릭하면 간다)' : tg ? tg.label + ' — Space' : '';
    if (label !== lastHint) { lastHint = label; $('hint').textContent = label; }
  }
  function frame() {
    const now = performance.now(); frameDt = lastT ? Math.min(60, now - lastT) : 16; lastT = now; tick++;
    if (!state || !scene.map) return;
    update();
    const tg = !UI.isOpen() && !busy ? target() : null;
    const you = person('you');
    RENDER.draw(ctx, cv, scene, state, peopleOnMap(), objectsOnMap(), tick, { target: tg && tg.kind !== 'exit' ? tg : null, doorOpen: traceSt('lever') === 'pulled', officeOpen: traceSt('office_door') === 'open', youHurt: you ? you.n.injury || 0 : 0, youReact: scene.map.id === 'station' ? signOf('you') : '' });
    overlay();
  }

  // ── 봇·플레이스루 (?auto=<지점>, ?fast=1, ?seed=n) — 캡처(v4/tools/shot.py)용. 화면 규칙과 무관 ──
  // 지점: car · morning3 · night3 · night5 · night8 · ending · death · evening5 · reveal · called3 · train
  //   night5 = D5 밤 고정 사건(d5_rail_body) · evening5 = D5 저녁 화로 둘레에 앉은 사람과 말하는 창 · night8 = D8 밤 고정 사건(d8_patrol_return/d8_pillow)
  //   called3 = D3 밤 '이름이 불렸다'(d3_called_you) 선택 창 · train = 열차 결말(d10_train) 뒤 명부 한 장
//   ?state=<주소> 가 있으면 그 저장에서 시작한다 (shot.py 가 train 에 시뮬 봇 저장을 붙인다 — 캡처 봇은 D10 전에 주민이 다 죽는다)
  //   봇은 화면처럼 경고·%·비용을 보고, 캡처가 끝까지 가도록 '당신 사망'만 표의 효과로 피한다(death 지점은 반대로 고른다).
  //   지점마다 바라는 깃발(WANT)이 있으면 그 깃발을 세우는 선택을 먼저 고른다 — 그 고정 사건이 걸리게.
  //   다치면(부상 2+) 낮·저녁에 치료 창(H)으로 자기 상처를 감는다 — 봇(sim)과 같은 규칙.
  //   캡처 지점에 닿으면 봇이 'hold' 를 돌려 그 창을 그대로 둔다 → 헤드리스가 그 화면을 찍는다.
  const safePick = (kind, info) => {
    const opts = info.options;
    if (kind === 'event') { const i = opts.findIndex((o) => !o.disabled && !/warn|chance/.test(String(o.subRaw || ''))); return i >= 0 ? i : opts.findIndex((o) => !o.disabled); }
    if (kind === 'fire') return 0;
    if (kind === 'ration') return opts.length - 1;
    if (kind === 'trip' || kind === 'write' || kind === 'deeper') return 1;
    return 0;
  };
  const idle = () => new Promise((res) => { const t = setInterval(() => { if (!busy && !UI.isOpen() && !scene.auto && !scene.moving) { clearInterval(t); res(); } }, 15); });
  const until = (fn, limit) => new Promise((res) => { let n = 0; const t = setInterval(() => { if (fn() || n++ > (limit || 2000)) { clearInterval(t); res(fn()); } }, 15); });
  async function use(id) {                 // 물건·사람 옆까지 걸어가 조사한다
    await idle();
    const p = peopleOnMap().find((q) => q.id === id);
    const o = objectsOnMap().find((q) => q.id === id);
    const at = p ? [p.x, p.y] : o ? [o.x, o.y] : null;
    if (!at) return false;
    walkTo(at[0], at[1]);
    await idle();
    return true;
  }
  async function goto(x, y) { await idle(); walkTo(x, y); await idle(); }
  const autoLog = [];
  async function autoRun(target) {
    const wantDeath = target === 'death';
    let holding = false, boardTried = false;
    const report = (why) => { console.log(`[ds4 auto] ${target} ${why} D${state.day} ${state.phase}${state.ended ? ' ended=' + state.ended.why : ''} you=${person('you').status} food=${state.world.food} | ${autoLog.slice(-16).join(' / ')}`); if (missing.size) console.log('[ds4 missing] ' + Array.from(missing).join(' ')); };
    const pend = (...ids) => !!(state.pending && ids.includes(state.pending.id));
    const HOLD = {
      night3: (k) => k === 'line' && state.day === 3 && state.phase === 'night' && pend('trial_d3_count'),
      night5: (k) => k === 'line' && state.day === 5 && state.phase === 'night' && pend('d5_rail_body'),
      evening5: (k, info) => k === 'line' && state.day === 5 && state.phase === 'evening' && !state.pending && info.opts && !!info.opts.name,
      night8: (k) => k === 'event' && state.day === 8 && state.phase === 'night' && pend('d8_patrol_return', 'd8_pillow'),
      called3: (k) => k === 'event' && pend('d3_called_you'),
      train: (k) => k === 'ending' && state.ended && state.ended.why === 'd10_train',
      ending: (k) => k === 'ending',
      reveal: (k, info) => k === 'line' && info.opts && info.opts.tag === 'reveal',
      death: (k) => k === 'death_ledger',
    }[target];
    // 지점이 바라는 깃발: 그 깃발을 세우는 선택에 +50 (고정 사건이 걸리는 길)
    const WANT = { called3: ['counted_together'], night8: ['patrol_promised', 'key_you'], train: ['met_dohyeon', 'passage_work', 'passage_half', 'passage_open', 'fare_hoard'] }[target] || [];
    const setsWanted = (o) => !!(o && o.effects && o.effects.flag && WANT.some((f) => o.effects.flag[f]));
    // 결과 하나의 값 (캡처 봇 전용 — 표의 효과를 직접 읽는다): 당신이 죽음 −100 · 다침 −6/칸 · 손상 −4 · 식량·물·약 +1.5 · 배고픔 −0.5
    const meHit = (v) => v && (v.who == null || v.who === 'you' || v.who === 'self');
    function outValue(o) {
      if (!o || !o.effects) return 0;
      const e = o.effects; let sc = 0;
      if (e.kill && meHit(e.kill)) sc += wantDeath ? 100 : -100;
      if (e.injure && meHit(e.injure)) sc -= 6 * (e.injure.n || 1);
      if (e.permanent && meHit(e.permanent)) sc -= 4;
      for (const k of ['food', 'water', 'meds']) if (typeof e[k] === 'number') sc += 1.5 * e[k];
      if (typeof e.hunger === 'number') sc -= 0.5 * e.hunger; else if (e.hunger && meHit(e.hunger)) sc -= 0.5 * (e.hunger.n || 0);
      return sc;
    }
    function pickEvent() {
      const ev = E.eventView(state, db); if (!ev) return 0;
      const rows = db.events[ev.id] ? db.events[ev.id].choices : [];
      let best = -1, bs = -Infinity;
      ev.choices.forEach((c, i) => {
        if (c.locked) return;
        const row = rows[i] || {};
        const p = c.chance != null ? c.chance / 100 : 1;
        let sc = row.check ? p * outValue(row.ok) + (1 - p) * outValue(row.fail) : outValue(row.out);
        if (c.taboo) sc += wantDeath ? 3 : -3;
        if (!wantDeath && (c.warn || c.hint)) sc -= 0.5;
        if (c.cost) sc -= 0.3;
        if (setsWanted(row.out) || setsWanted(row.ok)) sc += 50;
        if (target === 'train' && ev.id === 'd10_train' && /탄다/.test(c.label) && !(row.out && row.out.effects && row.out.effects.kill)) sc += 60;   // 열차 결말: 타는 쪽
        if (sc > bs) { bs = sc; best = i; }
      });
      autoLog.push(`D${state.day} ${state.phase} ${ev.id} → ${ev.choices[best] ? ev.choices[best].label : '?'}`);
      return best;
    }
    bot = (kind, info) => {
      if (HOLD && HOLD(kind, info)) { holding = true; UI.setBot(null); report('hold'); return 'hold'; }
      if (kind === 'line') return undefined;
      if (kind === 'event') {                                         // 열차 결말 캡처: 먼저 태울 사람 창을 한 번 연다 (명부에 '탔다'가 보이게)
        const bi = info.options.findIndex((o) => o.value === 'board');
        if (target === 'train' && bi >= 0 && !boardTried) { boardTried = true; return bi; }
        return pickEvent();
      }
      if (kind === 'board') { const bi = info.options.findIndex((o) => / 태운다$/.test(o.label)); return target === 'train' && bi >= 0 ? bi : info.options.length - 1; }
      if (kind === 'trip') return wantDeath ? 1 : 0;
      if (kind === 'deeper') return !wantDeath && state.day >= 4 && (person('you').n.injury || 0) === 0 && (state.world.food || 0) <= 3 ? 0 : 1;
      if (kind === 'ration') { const you = person('you'); return wantDeath && info.options[0] && /뺀다/.test(info.options[0].label) && (you.n.hunger || 0) < 8 ? 0 : info.options.length - 1; }
      if (kind === 'confirm2') return 0;
      if (kind === 'treat') { const i = info.options.findIndex((o) => o.value === 'you' && !o.disabled); return i >= 0 && (person('you').n.injury || 0) >= 2 ? i : info.options.length - 1; }
      if (kind === 'tend') return 0;
      return safePick(kind, info);
    };
    // 다쳤으면(부상 2+) 치료 창으로 자기 상처를 감는다 — 화면 길(H)을 그대로 탄다
    async function selfTreat() {
      if ((person('you').n.injury || 0) < 2 || treatWhy('you')) return;
      await idle(); await new Promise((res) => { flow(treatMenu).then(res); }); await idle();
      autoLog.push(`D${state.day} ${state.phase} 치료 → ${flagOn('treated_you') ? '감았다' : '못 감았다'}`);
    }
    UI.setBot(bot);
    // ?state=<주소>: 시뮬 봇이 만든 저장(v4/tools/fixture.js)에서 시작 — 처음부터 가면 닿지 않는 지점(열차 결말)용. 못 읽으면 처음부터 간다
    const fx = B.params.get('state');
    if (fx) {
      const raw = await fetch(fx, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      let s = null;
      try { s = raw ? E.normalize(S4.migrate(raw), db) : null; } catch (err) { s = null; }
      if (s) {
        autoLog.push(`[저장에서 시작 D${s.day} ${s.phase}${s.pending ? ' ' + s.pending.id : ''} seed${s.seed}]`);
        startGame(s); store.save(state);
        // 열차 결말: 시뮬 판은 물이 0 이라 '탄다'(식량·물 1)가 잠긴다 → 캡처용 지름길로 운임 깃발을 세워 '챙긴 운임으로 탄다'를 연다 (기록에 남긴다)
        if (target === 'train' && !flagOn('fare_hoard') && ((state.world.food || 0) < 1 || (state.world.water || 0) < 1)) { act({ type: 'setFlag', flag: 'fare_hoard', quiet: true }); autoLog.push('[지름길 fare_hoard]'); }
        await pendingFlow();
        if (!holding) { UI.setBot(null); report('end (저장에서 시작)'); }
        return;
      }
      autoLog.push('[저장을 못 읽었다 — 처음부터]');
    }
    const seed = Number(B.params.get('seed')) || 7;
    await newGame(seed);
    await idle();
    if (target === 'car') { UI.setBot(null); return; }
    await use('lever'); await use('notebook_dash'); await goto(21, 3); await idle();
    await use('gicheol'); await goto(29, 2); await idle();
    await use('speaker'); await use('blanket_mari');
    const did = {};
    const once = (k) => (did[k] ? false : (did[k] = true));
    let guard = 0;
    while (!state.ended && !holding && guard++ < 600) {
      await idle();
      if (holding || state.ended) break;
      const ph = state.phase, d = state.day;
      if (once('day' + d)) autoLog.push('[D' + d + ' food' + state.world.food + ' water' + state.world.water + ' hunger' + person('you').n.hunger + ']');
      if (target === 'morning3' && d === 3 && ph === 'trace') { await use('notebook_you'); await goto(13, 11); UI.setBot(null); report('stop'); return; }
      if (target === 'night8' && d === 8 && ph === 'night') { await goto(17, 12); scene.face = 'up'; UI.setBot(null); report('stop (D8 밤 고정 사건이 걸리지 않았다)'); return; }
      // 열차 결말: D9 저녁까지 통로가 안 열렸으면 캡처용 지름길(setFlag)로 연다 — 기록에 남긴다
      if (target === 'train' && d === 9 && ph === 'evening' && once('shortcut')) {
        for (const f of ['passage_open', 'fare_hoard']) if (!flagOn(f)) { act({ type: 'setFlag', flag: f, quiet: true }); autoLog.push(`[지름길 ${f}]`); }
      }
      if ((ph === 'day' || ph === 'evening') && once('treat' + ph + d)) await selfTreat();
      if (ph === 'trace' && d > 0 && once('trace' + d)) { await use('notebook_you'); continue; }
      if (ph === 'day' && d >= 1 && !wantDeath && !state.trip && once('trip' + d) && (person('you').n.injury || 0) === 0 && ((state.world.food || 0) <= 5 || (state.world.water || 0) <= 5)) {
        const region = d % 2 === 0 ? 'A' : 'B';
        await goto(EXIT_AT[region][0], EXIT_AT[region][1]);
        if (exitHere()) { interact(); await idle(); }
        continue;
      }
      if (ph === 'evening' && d > 0 && once('talk' + d)) { const p = peopleOnMap().find((q) => q.talkable); if (p) { await use(p.id); continue; } }
      await use('fire');
    }
    if (!holding) { UI.setBot(null); report('end'); }
  }

  // ── 시작 ──
  window.__ds4 = { get state() { return state; }, get db() { return db; }, get scene() { return scene; }, dispatch: act, walkTo, pick: UI.pick, interact, frame, flow, use, goto, idle, autoRun, autoLog,
    missing: () => Array.from(missing), setBot: (fn) => { bot = fn; UI.setBot(fn); }, store: () => store, E, UI };
  (async () => {
    try {
      db = await B.loadTables('data/');
      B.setDb(db);
      store = S4.createStore({ db });
      await ART.ready;
      fitApp();
      if (B.fast) $('app').classList.add('fast');
      setInterval(frame, 1000 / 30);
      const auto = B.params.get('auto');
      if (auto) await autoRun(auto); else await titleScreen(false);
    } catch (err) {
      console.error(err);
      $('goal').textContent = '시작하지 못했다: ' + (err && err.message ? err.message : err);
    }
  })();
})();
