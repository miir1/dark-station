// 어두운 역 v4 — PC 화면. 규칙은 전부 엔진(engine/*.js)과 표(data/*.json)에 있고, 여기서는 지도를 걷고 상자에서 고른다.
// 화면은 DS4.engine.view / eventView 만 읽고, 조작은 dispatch 로만. 수치(신뢰·스트레스·정체 축)는 화면 글에 쓰지 않는다.
(function () {
  'use strict';
  const E = DS4.engine, B = DS4.browser, S4 = DS4.save;
  const T = ART.T;
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc;
  const cv = $('cv'), ctx = cv.getContext('2d');
  const GOAL_DAY = 10;
  const PLACE = { station: '묵현역' };

  let db = null, state = null, store = null;
  let busy = false;                       // 대화 흐름 진행 중
  let bot = null;                         // 플레이스루 봇 정책 (?auto= / __ds4.bot)

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
  const lineOf = (id, extra) => { const l = B.pickLine(db, id, Object.assign(B.lineCtx(state), extra || {})); return l ? l.text : ''; };

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
    evening: { soonrye: [11, 10], seoha: [15, 10], gicheol: [16, 10], eunji: [14, 11], dongha: [11, 11], mari: [15, 11] },
  };
  const MET = { soonrye: 'arrived', mari: 'met_mari', gicheol: 'met_gicheol', eunji: 'met_eunji', dongha: 'met_eunji', seoha: 'met_seoha' };
  const bedOf = (id) => scene.map.beds[BED_ORDER.indexOf(id)] || null;
  // 지도 위 사람: [{id, name, x, y, face, pose, injury, mark, bubble, light, talkable}]
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
      else { pos = (SPOTS[ph] || SPOTS.day)[id]; if (ph === 'evening' && !state.flags['sat_' + id]) mark = '…'; }
      if (!pos) continue;
      const dx = scene.px - pos[0], dy = scene.py - pos[1];
      const face = Math.abs(dx) + Math.abs(dy) <= 3 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down')) : 'down';
      out.push({ id, name: p.name, x: pos[0], y: pos[1], face, pose, injury: p.n.injury || 0, mark, talkable: ph !== 'night' && ph !== 'aftermath' });
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
      if (mo.id === 'rubble' && st === 'crossed') hidden = false;
      out.push({ id: mo.id, x: mo.x, y: mo.y, name: o.name, solid: !!o.solid && !(mo.id === 'rubble' && st === 'crossed'), state: st, stateName: st, overlay: ov, light: mo.id === 'notebook_dash' && st !== 'there' ? 0 : (o.light || 0), hidden });
    }
    return out;
  }
  const objectsAt = (x, y) => objectsOnMap().filter((o) => !o.hidden && o.x === x && o.y === y && !(o.id === 'rubble' ? false : false));
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
  function clickCell(px, py) { if (!scene.cam) return null; return [Math.floor((px - scene.cam.ox) / T), Math.floor((py - scene.cam.oy) / T)]; }
  function walkTo(tx, ty, then) {
    if (busy || UI.isOpen() || scene.moving || !scene.map) return false;
    if (tx < 0 || ty < 0 || tx >= scene.w || ty >= scene.h) return false;
    const here = tx === scene.px && ty === scene.py;
    const thing = peopleOnMap().some((p) => p.x === tx && p.y === ty) || objectsAt(tx, ty).length > 0;
    if (here) { interact(); return true; }
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
  const front = () => { const [dx, dy] = DIRS[scene.face]; return [scene.px + dx, scene.py + dy]; };
  const EXIT_NAMES = { A: '지하상가 통로', B: '배수로 통로', S: '출구 계단', k: '역무실 문', R: '무너진 통로', E: '나가는 길' };
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
    while (state.pending && guard++ < 10) await showEvent();
    if (state.ended) await endingScreen();
  }
  const choiceSub = (c) => [c.chance != null ? `<small class="chance">${c.chance}%</small>` : '', c.warn ? `<small class="warn">${esc(c.warn)}</small>` : c.hint ? `<small>${esc(c.hint)}</small>` : '', c.locked ? `<small>${esc(c.reason)}</small>` : ''].join('');
  async function showEvent() {
    const v = E.eventView(state, db);
    if (!v) return;
    const black = v.id === 'pro_cold';
    if (v.image && !black) UI.cg(ART.cgSrc(v.image), v.image);
    await UI.lines(v.text, { black });
    const i = await UI.open(`<p>${esc(v.text)}</p>`, { kind: 'event', options: v.choices.map((c, k) => ({ label: c.label, sub: choiceSub(c), disabled: c.locked, value: k })), cls: v.choices.length > 3 ? 'wide' : '' });
    if (!act({ type: 'choose', i })) return;
    const r = state.lastResult || {};
    if (r.roll) await UI.line(`판정 ${r.roll.chance}% — ${r.roll.success ? '됐다.' : '안 됐다.'}`, { black });
    if (r.text) await UI.lines(r.text, { black });
    if (v.id === 'pro_notebook' || v.id === 'd1_gicheol_arrive') UI.toast(lineOf('toast_ledger_line') || '명부에 한 줄 — Tab');
    if (!state.pending) UI.cgClear();
  }
  const faceOf = (id) => ART.portraitSrc(id, person(id) ? person(id).n.injury : 0);
  async function talkTo(id) {
    const p = person(id);
    if (!p) return;
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
    if (state.phase === 'evening') { act({ type: 'setFlag', flag: 'sat_' + id, quiet: true }); }
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
  async function useExit(region) {
    if (state.phase !== 'day') { await UI.line(`${EXIT_NAMES[region]}. 낮에 조사하면 나갈 수 있다.`); return; }
    const go = await UI.open(`<p class="who">${esc(EXIT_NAMES[region])}</p><p>${region === 'A' ? '셔터 너머가 어둡다. 발소리가 여럿이다.' : '물소리가 난다. 아래가 젖어 있다.'}</p>`, { kind: 'trip', options: [{ label: '나간다', value: true }, { label: '돌아선다', value: false }], cancel: true, cancelValue: false });
    if (!go) return;
    await UI.card(db.maps[region === 'A' ? 'mall_a1' : 'drain_b1'].displayName, '원정');
    if (!act({ type: 'trip', region, floor: 1, quiet: true })) { await UI.line('아무것도 없었다. 역으로 돌아왔다.'); return; }
    await pendingFlow();
    if (!state.ended) await UI.line('역으로 돌아왔다.');
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
    if (before && state.day !== before.day) {
      await UI.card(`D${state.day}`, `열차까지 ${GOAL_DAY - state.day}일`);
      store.markMorning(state);
      await nightReport(before);
    }
    if (ph === 'trace') { if (scene.map && scene.map.id !== 'station') { act({ type: 'move', map: 'station', x: 13, y: 11, quiet: true }); setScene('station', 13, 11); } }
    if (ph === 'ration') { await pendingFlow(); if (!state.ended) await rationFlow(); return; }
    if (ph === 'seat') { await pendingFlow(); if (!state.ended) { await UI.line('사람들이 제 자리로 흩어진다.'); await nextPhase(); } return; }
    if (ph === 'aftermath') { await pendingFlow(); if (!state.ended) { await UI.line('밤이 지난다.', { black: true }); await nextPhase(); } return; }
    await pendingFlow();
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
  // 밤 보고서: 달라진 것만 + 잃은 것 한 줄 (수치 이름은 식량·물·땔감만)
  async function nightReport(before) {
    const parts = [];
    const NAME = { food: '식량', water: '물', fuel: '땔감' };
    for (const k of ['food', 'water', 'fuel']) { const d = (state.world[k] || 0) - (before.world[k] || 0); if (d) parts.push(`${NAME[k]} ${d > 0 ? '+' : '−'}${Math.abs(d)}`); }
    const gone = Object.values(state.people).filter((p) => before.status[p.id] === 'home' && p.status !== 'home').map((p) => p.name + (p.status === 'ascended' ? '이(가) 올라갔다' : '이(가) 밤에 갔다'));
    const noise = state.nightLog.some((e) => e.day === before.day);
    const text = [gone.join('. '), parts.join(' · '), noise ? '밤에 무슨 소리가 났다. 흔적이 남았을 것이다.' : ''].filter(Boolean).join(' ');
    if (text) await UI.lines(text, { black: true });
  }
  async function endingScreen() {
    const e = state.ended; if (!e) return;
    const why = { you_gone: '당신은 돌아오지 않았다.', all_dead: '아무도 남지 않았다.', train: '열흘이 지났다.' }[e.why] || '';
    const reveal = e.identity ? lineOf('reveal_' + e.identity) : '';
    UI.cg(ART.cgSrc('cg_ledger'), '명부');
    const rows = (e.ledger || []).map((r) => `<div class="row"><span>${esc(r.name)}</span><span>${esc(r.status === 'dead' ? '갔다' : r.status === 'ascended' ? '올라갔다' : r.status === 'boarded' ? '탔다' : '남았다')}${r.day != null && r.day !== '' ? ` · D${esc(r.day)}` : ''} ${r.cause ? esc(r.cause) : '<span class="blank">___</span>'}</span></div>`).join('');
    await UI.open(`<p class="who">명부</p><div class="ledger">${rows}</div><p class="mini">${esc(why)}</p>`, { kind: 'ending', options: [{ label: '덮는다', value: true }] });
    if (reveal) await UI.lines(reveal, { black: true });
    UI.cgClear();
    await titleScreen(true);
  }

  // ── 머리말(패널) ──
  function hud() {
    if (!state) return;
    const v = E.view(state, db);
    const ICON = { food: 'food', water: 'water', fuel: 'gen' };
    const ic = (k) => (ART.iconSrc(ICON[k] || k) ? `<img class="ic" alt="" src="${ART.iconSrc(ICON[k] || k)}">` : '');
    const it = (k, name) => `<div class="it ${(v.world[k] || 0) <= 1 ? 'low' : ''}">${ic(k)}<b>${v.world[k] || 0}</b><span>${name}</span></div>`;
    const PH = { trace: '아침 — 흔적', ration: '아침 — 배식', seat: '아침 — 자리', day: '낮', evening: '저녁', night: '밤', aftermath: '새벽', ended: '끝' };
    const faces = db.peopleOrder.filter((id) => id !== 'you' && flagOn(MET[id] || '__')).map((id) => `<img alt="${esc(person(id).name)}" title="${esc(person(id).name)}" class="${home(id) ? '' : 'gone'}" src="${faceOf(id)}">`).join('');
    $('hud').innerHTML = `<div class="day">D${state.day}<small>열차까지 ${Math.max(0, GOAL_DAY - state.day)}일</small></div>${it('food', '식량')}${it('water', '물')}${it('fuel', '땔감')}<div class="phase">${PH[state.phase] || ''}</div><div class="people">${faces}</div>`;
  }
  function objective() {
    if (!state || !scene.map) return '';
    const m = scene.map.id;
    if (m === 'car') return traceSt('lever') === 'pulled' ? '오른쪽 끝 열린 문으로 나간다' : '전동차 안을 살핀다';
    if (m === 'tunnel') return traceSt('rubble') === 'crossed' ? '터널 끝 승강장으로' : '앞쪽 불빛으로';
    if (state.day === 0) return '승강장을 둘러본다 · 화로를 조사하면 저녁';
    return { trace: '아침 — 흔적을 살피고 말을 건다 · 화로를 조사하면 배식', day: '낮 — 통로를 조사하면 원정 · 화로를 조사하면 저녁', evening: lineOf('toast_fire_night') ? '저녁 — 한 사람과 이야기할 수 있다 · ' + lineOf('toast_fire_night') : '저녁', night: '밤 — 화로를 조사하면 잠든다' }[state.phase] || '';
  }

  // ── 일시정지(Esc)·수첩(Tab)·타이틀 ──
  async function pauseMenu() {
    const a = await UI.open('<p class="title">멈춤</p>', { kind: 'pause', cancel: true, cancelValue: 'go', cls: 'wide', options: [{ label: '계속', value: 'go' }, { label: '전체화면', value: 'full' }, { label: '저장 코드 복사', value: 'export' }, { label: '타이틀로', value: 'title' }] });
    if (a === 'full') toggleFull();
    else if (a === 'export') { try { const code = store.exportCode(state); if (navigator.clipboard) await navigator.clipboard.writeText(code); UI.toast('저장 코드를 복사했다.'); } catch (e) { UI.toast('복사하지 못했다.'); } }
    else if (a === 'title') await titleScreen(false);
  }
  async function notebook() {
    for (;;) {
      const a = await UI.open('<p class="title">수첩</p><p class="mini">명부 · 사실 줄 · 일지</p>', { kind: 'book', cancel: true, cancelValue: null, cls: 'wide', options: [{ label: '명부', value: 'ledger' }, { label: '사실 줄', value: 'facts' }, { label: '일지', value: 'log' }, { label: '덮는다', value: null }] });
      if (!a) return;
      let body = '';
      if (a === 'ledger') body = `<p class="who">승객 명부</p><div class="ledger">${db.peopleOrder.filter((id) => id === 'you' || flagOn(MET[id] || '__')).map((id) => `<div class="row"><span>${esc(person(id).name)}</span><span>${id === 'you' ? '당신 글씨' : home(id) ? '' : person(id).status === 'ascended' ? '올라갔다' : '갔다'}</span></div>`).join('')}</div>`;
      else if (a === 'facts') body = `<p class="who">사실 줄</p><div class="list">${state.ledger.written.length ? state.ledger.written.slice(-7).map((w) => `<p><span class="d">D${w.day}</span>${esc(w.text)}</p>`).join('') : '<p class="mini">아직 아무것도 적지 않았다.</p>'}</div>`;
      else body = `<p class="who">일지</p><div class="list">${state.log.filter((l) => l.kind === 'choice').slice(0, 7).map((l) => `<p><span class="d">D${l.day}</span>${esc(l.text)}</p>`).join('') || '<p class="mini">비어 있다.</p>'}</div>`;
      await UI.open(body, { kind: 'bookpage', cancel: true, cancelValue: null, options: [{ label: '돌아간다', value: null }] });
    }
  }
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }

  function startGame(s) {
    state = s;
    if (!state.pos.map) { setScene('car', db.maps.car.start[0], db.maps.car.start[1]); }
    else setScene(state.pos.map, state.pos.x, state.pos.y);
    hud();
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
      UI.cg(ART.cgSrc('title'), '어두운 역');
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
    if (e.key === 'Tab') { e.preventDefault(); if (state && !UI.isOpen() && !busy) flow(notebook); return; }
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
  $('tabBook').addEventListener('click', () => { if (state && !UI.isOpen() && !busy) flow(notebook); });
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
    RENDER.draw(ctx, cv, scene, state, peopleOnMap(), objectsOnMap(), tick, { target: tg && tg.kind !== 'exit' ? tg : null, doorOpen: traceSt('lever') === 'pulled' });
    overlay();
  }

  // ── 봇·플레이스루 (?auto=car|morning3|night3, ?fast=1) ──
  const safePick = (kind, info) => {
    const opts = info.options;
    if (kind === 'event') { const i = opts.findIndex((o) => !o.disabled && !/warn|chance/.test(String(o.subRaw || ''))); return i >= 0 ? i : opts.findIndex((o) => !o.disabled); }
    if (kind === 'fire') return 0;
    if (kind === 'ration') return opts.length - 1;
    if (kind === 'trip' || kind === 'write') return 1;
    return 0;
  };
  const idle = () => new Promise((res) => { const t = setInterval(() => { if (!busy && !UI.isOpen() && !scene.auto && !scene.moving) { clearInterval(t); res(); } }, 15); });
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
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
  async function autoRun(target) {
    bot = (kind, info) => { if (kind === 'event') { const ev = E.eventView(state, db); if (ev) { const i = ev.choices.findIndex((c) => !c.locked && !c.warn && !c.taboo); return i >= 0 ? i : ev.choices.findIndex((c) => !c.locked); } } return safePick(kind, info); };
    UI.setBot(bot);
    await newGame(7);
    await idle();
    if (target === 'car') { UI.setBot(null); return; }
    await use('lever'); await use('notebook_dash'); await goto(21, 3); await idle();
    await use('gicheol'); await goto(29, 2); await idle();
    await use('speaker'); await use('blanket_mari');
    const passDay = async () => { const d = state.day; let guard = 0; while (!state.ended && state.day === d && guard++ < 12) { await use('fire'); await idle(); } };
    await passDay();                                  // D0 → D1 아침
    while (!state.ended && state.day < 3) { await use('notebook_you'); await passDay(); }
    if (target === 'morning3') { await use('notebook_you'); await goto(13, 11); UI.setBot(null); return; }
    while (!state.ended && state.phase !== 'evening') { await use('fire'); await idle(); }
    UI.setBot(null);
    await idle();
    const fire = objectsOnMap().find((q) => q.id === 'fire');      // 저녁 화로: '잠자리로' 를 봇 없이 고른다 → 밤에 걸린 고정 장면(셈)이 첫 문장까지 나온다
    walkTo(fire.x, fire.y);
    await until(() => UI.isOpen()); UI.pick(0);
    await until(() => state.phase === 'night' && UI.isOpen());
  }

  // ── 시작 ──
  window.__ds4 = { get state() { return state; }, get db() { return db; }, get scene() { return scene; }, dispatch: act, walkTo, pick: UI.pick, interact, frame, flow, use, goto, idle, autoRun, setBot: (fn) => { bot = fn; UI.setBot(fn); }, store: () => store, E, UI };
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
