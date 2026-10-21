// 어두운 역 v3 — 쯔꾸르풍 화면. 규칙은 ../v2/engine.js 그대로, 여기서는 맵을 걷고 대화창으로 고른다.
(function () {
  'use strict';
  const E = window.DS2, D = E.D, T = ART.T, M = window.MAPS;
  const K = T / 32;                               // 32px 기준으로 적은 값을 타일 크기에 맞춘다
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
  // ── 아이콘: img/icons/<이름> 이 있으면 그림, 없으면 글자 ──
  const IC_ALT = { food: '식', water: '물', parts: '부', meds: '약', power: '전', flood: '침', exposure: '노', stress: '스', injury: '상', trust: '신', obs: '관', str: '완', tech: '기', talk: '말', day: '日', train: '열', people: '사', gods: '시', log: '일', sound: '소', restart: '↺', board: '판', rest: '휴', forage: '수', pump: '물', salvage: '해', gen: '발', drain: '배', guard: '경', build: '공', tend: '치', farm: '재' };
  const IC_SRC = { tend: 'meds' };   // 따로 그리지 않은 일은 비슷한 아이콘으로
  const ic = (name, cls) => { const n = ART.has('icons/' + name) ? name : IC_SRC[name] || name; return ART.has('icons/' + n) ? `<img class="ic ${cls || ''}" alt="" src="img/icons/${n}.png">` : `<i class="ic ic-t ${cls || ''}">${IC_ALT[name] || '·'}</i>`; };
  const IC_NAME = { food: '식량', water: '물', parts: '부품', meds: '약품', power: '전력', flood: '침수 (5 이상이면 발전 정지, 8이면 역이 잠긴다)', exposure: '노출 (높으면 밤에 무언가 찾아온다)', stress: '스트레스 (80부터 무너질 수 있다)', injury: '부상', trust: '신뢰', obs: '관찰', str: '완력', tech: '기술', talk: '말솜씨', train: '구조열차까지 남은 날' };
  const face = (id, hurt, px) => `<img class="pf" alt="" src="${ART.portrait(id, hurt).toDataURL()}" style="width:${px || 48}px;height:${px || 48}px">`;
  // 숫자 변화: 아이콘 6→4 (줄면 붉게)
  const delta = (k, a, b) => `<span class="dl ${b < a ? 'down' : b > a ? 'up' : ''}">${ic(k)}${a}${a !== b ? `→<b>${b}</b>` : ''}</span>`;
  const skillsRow = (r) => `<span class="sk">${['obs', 'str', 'tech', 'talk'].map((k) => `<span title="${D.SKILLS[k]}">${ic(k)}${r.skills[k]}</span>`).join('')}</span>`;
  // ── 공통 문장 ──
  const resText = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${D.RES[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`).join(' · ');
  const reps = (arr) => arr.map((l) => `<p class="rep ${l.kind || ''}">${esc(l.text)}</p>`).join('');
  // 결과 줄의 '식량 +3' 같은 변화는 아이콘 + 숫자로
  const WORD_IC = { 식량: 'food', 물: 'water', 부품: 'parts', 약품: 'meds', 스트레스: 'stress', 침수: 'flood', 노출: 'exposure', 전력: 'power' };
  const iconize = (t) => esc(t).replace(/(식량|물|부품|약품|스트레스|침수|노출|전력) ([+−-]\d+)/g, (m, w, n) => `<span class="dl ${/^[−-]/.test(n) === (w === '스트레스' || w === '침수' || w === '노출') ? 'up' : 'down'}">${ic(WORD_IC[w])}<b>${n}</b></span>`);
  const fx = (arr) => (arr && arr.length ? `<ul class="fx">${arr.map((l) => `<li>${iconize(l)}</li>`).join('')}</ul>` : '');
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
    const it = (k) => { const low = (k === 'food' || k === 'water') ? s.res[k] < need * 2 : s.res[k] === 0; return `<span class="it ${low ? 'low' : ''}">${ic(k)}<b>${s.res[k]}</b></span>`; };
    const left = Math.max(0, D.GOAL_DAY - s.day);
    let h = `<span class="day">D${Math.min(s.day, D.GOAL_DAY)}</span><span class="it train">${ic('train')}<b>${left ? left + '일' : '오늘'}</b></span>${['food', 'water', 'parts', 'meds'].map(it).join('')}<span class="it ${s.flood >= E.FLOOD_POWER_STOP ? 'warn' : ''}">${ic('flood')}<b>${s.flood}</b>/8</span><span class="it ${s.exposure >= 6 ? 'warn' : ''}">${ic('exposure')}<b>${s.exposure}</b>/8</span><span class="it help">?</span>`;
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
    // 원정마다 새 지도 (날·지역·깊이로 정해지므로 새로고침해도 같다)
    const key = e.region + Math.min(2, e.depth) + ':' + state.day;
    if (scene.key !== key) {
      const seed = (state.seed * 31 + state.day * 977 + (e.region === 'A' ? 13 : 29) * e.depth) >>> 0;
      const d = M.genDungeon(e.region, e.depth, seed);
      scene.visited = new Set();
      setMap('dungeon', key, d.rows, d.start, { dun: d, region: e.region, map: null });
      // 시작 칸이 벽이면 근처 바닥으로
      if (blocked(scene.px, scene.py)) for (const [dx, dy] of [[0, 1], [1, 1], [0, -1], [-1, 0]]) if (!blocked(scene.px + dx - 1, scene.py + dy)) { scene.px += dx - 1; scene.py += dy; break; }
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
      if (scene.key === 'tunnel' && s.pro === 2) return M.TUNNEL.npcs.map((n) => ({ r: E.byId(s, n.id), x: n.x, y: n.y, npc: n }));
      return [];
    }
    if (scene.kind !== 'station') return [];
    const plan = E.effectivePlan(s);
    const used = {}, out = [];
    const beds = M.STATION.beds;
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
  const blockedRaw = (x, y) => tileAt(x, y) === '#';
  function blocked(x, y, noNpc) {
    const t = tileAt(x, y);
    if (t === '#' || t === 's' || t === 'i') return true;
    if (scene.kind === 'station') {
      if (t === 'R' && !state.flags.passage_secured) return true;
      if (t === 't') return true;                                   // 개찰구
      if (t === 'k' && !state.flags.office_open) return true;        // 잠긴 역무실 문
      if (objectsAt(x, y).some((o) => o.solid && !(o.id.startsWith('repair') && state.flags.passage_secured))) return true;
      if ((M.STATION.decor || []).some((d) => d.solid && d.x === x && d.y === y)) return true;
    }
    if (scene.kind === 'prologue') {
      if (t === 'o' && state.pro < 2) return true;
      if (objectsAt(x, y).length) return true;
    }
    if (!noNpc && residentsOnMap().some((p) => p.x === x && p.y === y)) return true;
    return false;
  }
  // ── 주민이 일터까지 걸어간다: 보이는 위치는 따로, 길은 BFS ──
  const walkers = {};                 // id → { x, y, path: [[x,y]...], face, steps }
  const NPC_MS = 320;
  function pathTo(sx, sy, tx, ty) {
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(sx, sy), null]]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || (blocked(nx, ny, true) && !(nx === tx && ny === ty))) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const out = []; let c = [tx, ty];
    while (c && !(c[0] === sx && c[1] === sy)) { out.unshift(c); c = prev.get(key(c[0], c[1])); }
    return out;
  }
  function updateWalkers() {
    if (scene.kind !== 'station') return;
    for (const p of residentsOnMap()) {
      let w = walkers[p.r.id];
      if (!w || p.lying) { walkers[p.r.id] = { x: p.x, y: p.y, path: [], tx: p.x, ty: p.y, face: 'down', steps: 0 }; continue; }
      if (w.tx !== p.x || w.ty !== p.y) {
        w.tx = p.x; w.ty = p.y;
        const path = pathTo(Math.round(w.x), Math.round(w.y), p.x, p.y);
        if (path) w.path = path; else { w.x = p.x; w.y = p.y; w.path = []; }       // 길이 없으면 벽을 뚫지 않고 그 자리에 나타난다
      }
      if (!w.path.length) continue;
      const [nx, ny] = w.path[0];
      const dx = nx - w.x, dy = ny - w.y, dist = Math.hypot(dx, dy);
      const stepLen = frameDt / NPC_MS;
      w.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (dist <= stepLen) { w.x = nx; w.y = ny; w.path.shift(); w.steps++; }
      else { w.x += dx / dist * stepLen; w.y += dy / dist * stepLen; }
    }
  }

  // ── 그리기 ──
  let view = { cols: 13, rows: 9, scale: 3 };
  function resize() {
    const st = $('stage');
    const W = st.clientWidth || 375, H = st.clientHeight || 420;
    // 설계 v5: 한 도트 = 화면 1px. 폰은 배율 1(가로 12칸), 태블릿·PC는 2
    const scale = W >= 768 ? 2 : 1;
    // 캔버스는 무대를 정확히 채운다 (칸 배수로 키우면 위아래가 잘려 맨 윗줄 사람의 머리가 잘렸다)
    view = { cols: W / (T * scale), rows: H / (T * scale), scale };
    cv.width = Math.ceil(W / scale); cv.height = Math.ceil(H / scale);
    cv.style.width = Math.round(cv.width * scale) + 'px'; cv.style.height = Math.round(cv.height * scale) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($('stage'));

  function tileKind(t, x, y) {
    if (scene.kind === 'dungeon') {
      const A = scene.region === 'A';
      // 몇 칸씩 덩어리로 다른 질감을 섞는다 (같은 지도면 늘 같게)
      const h = ((((x >> 2) * 73856093) ^ ((y >> 2) * 19349663) ^ (scene.key.length * 83492791)) >>> 0) % 10;
      if (t === '#') return A ? (h < 3 && ART.has('tiles/whiteTile_0') ? 'whiteTile' : 'shutter') : (h < 4 && ART.has('tiles/brick_0') ? 'brick' : 'pipe');
      if (t === 'w') return 'water';
      if (A) return h === 9 && ART.has('tiles/concrete_0') ? 'concrete' : h === 8 && ART.has('tiles/ash_0') ? 'ash' : 'marketFloor';
      return h === 9 && ART.has('tiles/grate_0') ? 'grate' : h === 8 && ART.has('tiles/puddle_0') ? 'puddle' : 'drainFloor';
    }
    if (scene.kind === 'prologue' && scene.key === 'car') return t === '#' ? (ART.has('tiles/carWall_0') ? 'carWall' : 'wall') : (ART.has('tiles/carFloor_0') ? 'carFloor' : 'concourse');
    if (scene.kind === 'prologue' && scene.key === 'tunnel' && t === '#' && ART.has('tiles/tunnelWall_0')) return 'tunnelWall';
    return { '#': 'wall', '.': 'concourse', d: 'concourse', S: 'concourse', ',': 'floor', R: 'floor', '=': 'edge', '~': 'track', i: 'track', x: 'track', T: null, B: null, w: 'water', o: 'concourse', A: 'concourse', t: 'concourse', k: 'concourse' }[t] || 'floor';
  }
  let tick = 0;
  function draw() {
    if (!scene.w || !scene.h) return;               // 맵을 아직 안 불렀다
    tick++;
    const s = state;
    const mx = scene.moving ? scene.px - scene.moving.dx * (1 - scene.moving.t) : scene.px;
    const my = scene.moving ? scene.py - scene.moving.dy * (1 - scene.moving.t) : scene.py;
    const camX = Math.max(0, Math.min(scene.w * T - cv.width, (mx + 0.5) * T - cv.width / 2));
    // 맨 윗줄에 서도 머리(칸 위로 솟은 부분)가 보이게 카메라가 지도 위로 조금 더 올라갈 수 있다
    const camY = Math.min(Math.max(0, Math.min(scene.h * T - cv.height, (my + 0.5) * T - cv.height / 2)), my * T - (ART.PH - T) - 4 * K);
    const ox = scene.w * T < cv.width ? Math.round((cv.width - scene.w * T) / 2) : -Math.round(camX);
    const oy = scene.h * T < cv.height ? Math.round((cv.height - scene.h * T) / 2) : -Math.round(camY);
    ctx.fillStyle = '#050404'; ctx.fillRect(0, 0, cv.width, cv.height);
    scene.head = { x: (mx * T + ox) * view.scale, y: (my * T - (ART.PH - T) + oy) * view.scale, w: T * view.scale };   // 주인공 머리의 화면 위치 (목표 상자가 가리지 않게)
    ctx.save(); ctx.translate(ox, oy);
    // 바닥·벽
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) {
      const t = tileAt(x, y), X = x * T, Y = y * T;
      const k = tileKind(t, x, y);
      if (k) ctx.drawImage(ART.tile(k, x, y), X, Y); else { ctx.fillStyle = '#000'; ctx.fillRect(X, Y, T, T); }
      if (t === 's') drawProp('seat', X, Y);
      if (t === '#' && tileAt(x, y + 1) !== '#' && y + 1 < scene.h) {
        // 바닥과 맞닿은 벽: 아래쪽 벽면을 밝게, 모서리에 선, 바닥에 그림자
        ctx.fillStyle = 'rgba(220,200,170,0.10)'; ctx.fillRect(X, Y + T * 0.45, T, T * 0.55);
        ctx.fillStyle = 'rgba(230,210,180,0.22)'; ctx.fillRect(X, Y + T * 0.45, T, Math.max(1, K));
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X, Y + T, T, 4 * K);
      }
      if (t === '#' && tileAt(x, y + 1) === '#' && [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => { const n = tileAt(x + dx, y + dy); return n !== '#' && n !== undefined; })) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X, Y, T, T); }
      if (t === 'v') drawProp('stairsDown', X, Y);
      if (t === 'E') drawProp('stairsUp', X, Y);
      if (t === 'o') drawProp('door', X, Y);
      if (t === 'w' && (tick >> 4) % 2) { ctx.fillStyle = 'rgba(134,163,168,0.10)'; ctx.fillRect(X + ((x * 5 + y) % 9) * K * 2, Y + 14 * K, 10 * K, 2 * K); }
    }
    const sprites = [];   // [y, draw]
    if (scene.kind === 'station') drawStation(s, sprites);
    else if (scene.kind === 'dungeon') drawDungeon(sprites);
    else drawPrologue(s, sprites);
    // 사람 (누워 있는 사람은 눕혀서)
    for (const p0 of residentsOnMap()) {
      const w = walkers[p0.r.id];
      const moving = !!(w && w.path.length);
      const p = w && !p0.lying ? Object.assign({}, p0, { x: w.x, y: w.y }) : p0;
      const hurt = Math.min(3, p.r.injury || 0);
      // 주민은 주인공 쪽을 본다 (가까우면)
      const dx = scene.px - p.x, dy = scene.py - p.y;
      const look = Math.abs(dx) + Math.abs(dy) <= 3 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down')) : 'down';
      const img = ART.personSprite(p.r.id, moving ? (w.steps % 2 ? 1 : 2) : 0, hurt, p.lying ? 'down' : moving ? w.face : look);
      sprites.push([p.y, () => {
        ctx.save(); ctx.translate(Math.round(p.x * T) - p.x * T, Math.round(p.y * T) - p.y * T);
        if (!p.lying) shadow(p.x, p.y);
        if (p.lying) { ctx.save(); ctx.translate(p.x * T + T, p.y * T + T / 4); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, img.width * 0.67, img.height * 0.67); ctx.restore(); }
        else ctx.drawImage(img, p.x * T, p.y * T - (ART.PH - T) - (Math.sin((tick + p.r.id.length * 37) / 45) > 0.55 ? K : 0));
        if (p.r.breakdown > 0 && (tick >> 4) % 2) { ctx.fillStyle = '#9c1e1e'; ctx.fillRect(p.x * T + 14 * K, p.y * T - 26 * K, 4 * K, 6 * K); }
        ctx.restore();
      }]);
    }
    // 주인공과 동행
    // 걸음마다 왼발·오른발을 번갈아, 걸음 가운데에서만 발을 뗀다
    const frame = scene.moving && scene.moving.t > 0.15 && scene.moving.t < 0.85 ? (scene.steps % 2 ? 1 : 2) : 0;
    const flip = scene.face === 'left';
    sprites.push([my, () => drawPerson('player', mx, my, frame, flip, 0, scene.face)]);
    if (scene.kind === 'dungeon' && state.exp) state.exp.party.forEach((id, i) => {
      const [dx, dy] = DIRS[scene.face]; const fx2 = mx - dx * (i + 1), fy2 = my - dy * (i + 1);
      if (!blocked(Math.round(fx2), Math.round(fy2))) sprites.push([fy2, () => drawPerson(id, fx2, fy2, frame, flip, E.byId(state, id).injury, scene.face)]);
    });
    sprites.sort((a, b) => a[0] - b[0]).forEach((d) => d[1]());
    // 앞에 조사할 것이 있으면 ▾
    const tg = target();
    if (tg && !UI.isOpen() && !busy) { ctx.fillStyle = '#d0a24a'; const bx = tg.x * T + 12 * K, by = tg.y * T - 28 * K - ((tick >> 4) % 2) * 2 * K; ctx.fillRect(bx, by, 8 * K, 4 * K); ctx.fillRect(bx + 2 * K, by + 4 * K, 4 * K, 2 * K); }
    FX.particles(ctx, T, scene.w, scene.h, scene.kind === 'dungeon' && scene.region === 'B' ? 'drain' : 'dust', tick);
    if (scene.kind === 'station') FX.setFire(1 - Math.min(1, Math.hypot(mx - M.STATION.fire[0], my - M.STATION.fire[1]) / 8));
    lighting(mx, my);
    ctx.restore();
    grain();
  }
  // 소품 그리기: 칸보다 높은 그림(기둥·문·자판기)은 그 칸 위로 솟게
  function drawProp(id, X, Y) { const im = ART.prop(id); ctx.drawImage(im, X, Y - (im.height - T)); }
  function shadow(x, y) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x * T + T / 2, y * T + T - 4 * K, 11 * K, 4 * K, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawPerson(id, x, y, frame, flip, hurt, dir) {
    shadow(x, y);
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
      const gr = g.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.45, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.drawImage(vign, 0, 0);
    fogLayer();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 12; i++) ctx.fillRect((Math.random() * cv.width) | 0, (Math.random() * cv.height) | 0, 1, 1);
  }
  // 잿빛 안개 겹: 64×64 무늬를 느리게 흘려 보낸다 (세계관의 안개 — 화면 전체에 얇게)
  let fogCv = null;
  function fogLayer() {
    if (!fogCv) {
      fogCv = document.createElement('canvas'); fogCv.width = 64; fogCv.height = 64;
      const g = fogCv.getContext('2d'), R = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
      const n = []; for (let i = 0; i < 16; i++) n.push(R());
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const fx = x / 16, fy = y / 16, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
        const v = (ix, iy) => n[((iy & 3) * 4 + (ix & 3))];
        const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx, b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
        g.fillStyle = `rgba(170,170,165,${(a * (1 - ty) + b * ty) * 0.16})`; g.fillRect(x, y, 1, 1);
      }
    }
    const off = (tick * 0.25) % 64;
    for (let y = -64; y < cv.height; y += 64) for (let x = -64; x < cv.width; x += 64) ctx.drawImage(fogCv, x + off, y + (off / 2) % 64);
  }
  let lightCv = null;
  function lighting(pmx, pmy) {
    const s = state;
    if (!lightCv) lightCv = document.createElement('canvas');
    if (lightCv.width !== scene.w * T || lightCv.height !== scene.h * T) { lightCv.width = scene.w * T; lightCv.height = scene.h * T; }
    const g = lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, lightCv.width, lightCv.height);
    let dark = 0.88; const lights = [];
    let tintRed = false; const cones = [];
    if (scene.kind === 'station') {
      const pv = s.phase === 'morning' ? E.previewNight(s) : null;
      const lit = pv ? !pv.ev.dark : !s.dark;
      dark = lit ? 0.40 : 0.70;
      lights.push([M.STATION.fire[0] + 0.5, M.STATION.fire[1] + 0.5, 6 + ((tick >> 3) % 3) * 0.2]);
      if (lit) for (const o of M.STATION.objects) if (o.lamp) lights.push([o.x + 0.5, o.y + 0.5, 5]);
      if (s.flags.passage_secured) lights.push([M.STATION.passageLight[0], M.STATION.passageLight[1], 3]);
    } else if (scene.kind === 'prologue') {
      dark = scene.key === 'car' ? 0.75 : 0.85; tintRed = scene.key === 'car';
      if (scene.key === 'car' && (tick >> 5) % 3 !== 0) for (const x of [4, 11, 18]) lights.push([x + 0.5, 1, 3.5]);
      const L = LEFT[scene.key];
      if (L) for (const [x, y] of L.phones) lights.push([x + 0.55, y + 0.5, 0.9]);
      if (L && L.shaft) lights.push([L.shaft[0] + 0.5, L.shaft[1] + 0.8, 1.8]);
    }
    if (scene.kind === 'prologue' && scene.key === 'tunnel') {
      // 휴대폰 손전등: 보는 쪽으로 원뿔, 발밑은 조금만
      const [dx, dy] = DIRS[scene.face]; cones.push([pmx + 0.5, pmy + 0.4, Math.atan2(dy, dx), 6.5]);
      lights.push([pmx + 0.5, pmy + 0.4, 2]);
    } else lights.push([pmx + 0.5, pmy + 0.3, scene.kind === 'station' ? 3.5 : scene.kind === 'dungeon' ? 5 : 4]);
    if (scene.kind === 'dungeon') { dark = 0.70; for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) if (tileAt(x, y) === 'm' && !scene.visited.has(x + ',' + y)) lights.push([x + 0.5, y + 0.5, 1.6]); }
    g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, lightCv.width, lightCv.height);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of lights) {
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * T, y * T, r * T, 0, Math.PI * 2); g.fill();
    }
    for (const [x, y, ang, r] of cones) {
      const gr = g.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x * T, y * T); g.arc(x * T, y * T, r * T, ang - 0.45, ang + 0.45); g.closePath(); g.fill();
    }
    ctx.drawImage(lightCv, 0, 0);
    // 빛의 색: 비상등은 빨강, 휴대폰은 푸른 기, 환기 통로는 잿빛
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, c) => { const gr = ctx.createRadialGradient(x * T, y * T, 0, x * T, y * T, r * T); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect((x - r) * T, (y - r) * T, 2 * r * T, 2 * r * T); };
    if (scene.kind === 'prologue') {
      const L = LEFT[scene.key];
      if (scene.key === 'car' && (tick >> 5) % 3 !== 0) for (const x of [4, 11, 18]) glow(x + 0.5, 1, 3.2, 'rgba(120,10,10,0.35)');
      if (L) for (const [x, y] of L.phones) glow(x + 0.55, y + 0.5, 1, 'rgba(60,110,130,0.25)');
      if (L && L.shaft) glow(L.shaft[0] + 0.5, L.shaft[1] + 0.8, 2.2, `rgba(90,90,85,${0.25 + 0.08 * Math.sin(tick / 40)})`);
    }
    if (scene.kind === 'station') glow(M.STATION.fire[0] + 0.5, M.STATION.fire[1] + 0.5, 4.4, 'rgba(110,50,10,0.22)');
    ctx.restore();
    if (scene.kind === 'station') { ctx.fillStyle = 'rgba(208,120,50,0.08)'; ctx.beginPath(); ctx.arc(11.5 * T, 7.5 * T, 3.8 * T, 0, Math.PI * 2); ctx.fill(); }
    if (tintRed && (tick >> 5) % 3 !== 0) { ctx.fillStyle = 'rgba(140,20,20,0.16)'; ctx.fillRect(0, 0, scene.w * T, scene.h * T); }
  }
  function drawStation(s, sprites) {
    // 침수: 선로부터 물이 찬다
    const fl = s.flood;
    const rowsW = M.STATION.floodRows.filter(([, from]) => fl >= from).map(([y, from, a]) => [y, fl >= from + 1 ? a : a * 0.5]);
    for (const [y, a] of rowsW) { ctx.globalAlpha = 0.75 * a; for (let x = 1; x < scene.w - 1; x++) ctx.drawImage(ART.tile('water', x, y), x * T, y * T); ctx.globalAlpha = 1; }
    // 멈춘 2호선 전동차
    const tx = M.STATION.train[0] * T, ty = M.STATION.train[1] * T, tn = M.STATION.train[2];
    if (ART.has('props/door')) {             // 2호선 전동차: 출입문 그림을 이어 붙인다
      const door = ART.prop('door');
      for (let k = 0; k < tn; k++) ctx.drawImage(door, tx + k * T, ty, T, 2 * T);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(tx, ty, tn * T, 2 * T);
    } else {
    ctx.fillStyle = '#5b5049'; ctx.fillRect(tx, ty + 2, 7 * T, 2 * T - 6);
    ctx.fillStyle = '#7d7067'; ctx.fillRect(tx, ty + 2, 7 * T, 4);
    ctx.fillStyle = '#2a6b3c'; ctx.fillRect(tx, ty + 38, 7 * T, 8);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#0d171c'; ctx.fillRect(tx + 12 + k * 36, ty + 12, 22, 18); ctx.fillStyle = 'rgba(134,163,168,0.25)'; ctx.fillRect(tx + 14 + k * 36, ty + 14, 6, 6); }
    }
    for (const o of M.STATION.objects) if (o.id.startsWith('exitB')) { ctx.fillStyle = '#050404'; ctx.fillRect(o.x * T, o.y * T, T, T); }
    // 바닥 얼룩·꾸밈
    for (const d of M.STATION.decor || []) if (!d.solid) drawProp(d.prop, d.x * T, d.y * T);
    // 시설 자리
    const [fx, fy] = M.STATION.facilityAt;
    if (s.facility === 'farm') for (const x of [fx, fx + 1]) drawProp('mush', x * T, fy * T);
    if (s.facility === 'clinic') { drawProp('cross', fx * T, fy * T); drawProp('bed', (fx + 1) * T, fy * T); }
    if (s.project && s.project.id !== 'repair') { drawProp('crate', fx * T, fy * T); drawProp('rubble', (fx + 1) * T, fy * T); }
    (s.buried || []).forEach((id, i) => drawProp('grave', (M.STATION.graves[0] + i % 3) * T, (M.STATION.graves[1] - Math.floor(i / 3)) * T));
    // 잠긴 역무실 문, 안개에 잠긴 출구 계단
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) {
      const t = tileAt(x, y);
      if (t === 'k' && !s.flags.office_open) sprites.push([y - 0.5, () => drawProp('chaindoor', x * T, y * T)]);
      if (t === 'S') { drawProp('stairsUp', x * T, y * T); ctx.fillStyle = `rgba(170,170,165,${0.35 + 0.08 * Math.sin(tick / 30)})`; ctx.fillRect(x * T, y * T, T, T); }
    }
    const P = { fire: 'drum', board: 'board', gen: 'generator', pump: 'tank', drainpump: 'pump', stash: 'crate', stash2: 'sack', bed1: 'bed', bed2: 'bed', bed3: 'bed', repair: 'rubble', repair2: 'rubble', exitA: 'stairsUp', exitA2: 'stairsUp' };
    for (const o of M.STATION.objects) {
      const pr = P[o.id]; if (!pr) continue;
      if (o.id.startsWith('repair') && s.flags.passage_secured) continue;
      sprites.push([o.y - 0.5, () => drawProp(pr, o.x * T, o.y * T)]);
    }
    for (const d of M.STATION.decor || []) if (d.solid) sprites.push([d.y - 0.5, () => drawProp(d.prop, d.x * T, d.y * T)]);
    for (const o of M.STATION.objects) if (o.lamp) drawProp('lamp', o.x * T + 6 * K, (o.y - 1) * T + 8 * K);
    if (s.project && s.project.id === 'repair') drawProp('crate', M.STATION.projectCrate[0] * T, M.STATION.projectCrate[1] * T);
    if (!ART.has('props/drum')) sprites.push([7.4, () => ctx.drawImage(ART.flame((tick >> 3) % 2), 11 * T, 6 * T + 4 * K)]);
    if (s.exposure > 0) { ctx.fillStyle = `rgba(150,150,150,${0.05 * s.exposure})`; ctx.fillRect(M.STATION.smoke[0] * T, M.STATION.smoke[1] * T, 3 * T, 2 * T); }
  }
  function drawDungeon(sprites) {
    const d = scene.dun;
    // 꾸밈: 그 이름의 그림이 있으면 그것, 없으면 비슷한 예전 소품
    const FALL = { stall: 'crate', kiosk: 'crate', webs: 'bones', mannequin: 'corpse', cart: 'crate', hooks: 'bones', shrine: 'grave', vending: 'crate', tires: 'crate', bodybag: 'corpse', backpack: 'sack', slab: 'rubble', valve: 'pump', leakbarrel: 'drum', ratnest: 'bones', sludge: 'blood', ladder: 'rubble', chaindoor: 'door' };
    for (const [spr, x, y] of d.deco || []) {
      if (blockedRaw(x, y)) continue;
      const name = ART.has('props/' + spr) ? spr : FALL[spr] || spr;
      if (spr === 'sludge') drawProp(name, x * T, y * T); else sprites.push([y - 0.5, () => drawProp(name, x * T, y * T)]);
    }
    for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) if (tileAt(x, y) === 'm' && !scene.visited.has(x + ',' + y)) { const bob = (tick >> 5) % 2; drawProp('mark', x * T, y * T - 4 - bob); }
  }
  // 프롤로그 바닥: 사람들이 사라진 흔적 (위치는 고정)
  const LEFT = {
    car: { shoes: [[2, 2], [5, 4], [6, 2], [9, 3], [11, 2], [12, 4], [7, 3], [3, 3], [14, 4], [16, 2], [19, 4]], phones: [[4, 2], [8, 4], [13, 2]], bags: [[3, 4], [11, 3]], feet: [[8, 3], [10, 3], [12, 3], [14, 3], [16, 3], [18, 3], [20, 3]] },
    tunnel: { shoes: [[4, 3], [7, 2], [11, 2], [20, 3], [24, 2]], phones: [[6, 3]], bags: [[22, 3]], feet: [[2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [11, 1]], shaft: [12, 0] },
  };
  const SHOE = ['#c9bfae', '#7a2620', '#6e5a44', '#b8a27a', '#4a5866', '#a33a2a'];
  function drawLeftovers(key) {
    const L = LEFT[key]; if (!L) return;
    // 맨발 자국: 발바닥·뒤꿈치·발가락. 오른쪽(앞)으로 걸어간다
    ctx.fillStyle = 'rgba(205,195,175,0.42)';
    const foot = (fx, fy) => {
      ctx.beginPath(); ctx.ellipse(fx, fy, 4 * K, 2.2 * K, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx - 6 * K, fy, 2.2 * K, 1.8 * K, 0, 0, Math.PI * 2); ctx.fill();
      for (let t = 0; t < 4; t++) ctx.fillRect(fx + 4.5 * K, fy - 2.5 * K + t * 1.5 * K, 1.4 * K, 1.2 * K);
    };
    for (const [x, y] of L.feet) { foot(x * T + 12 * K, y * T + 22 * K); foot(x * T + 28 * K, y * T + 13 * K); }
    // 벗겨진 신발·가방·휴대폰 (그림이 있으면 그림, 작게)
    const small = (id, X, Y, sc, alpha) => { const im = ART.prop(id); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.drawImage(im, X, Y, im.width * sc, im.height * sc); ctx.globalAlpha = 1; };
    const SH = ['shoes', 'heel', 'sneaker'];
    L.shoes.forEach(([x, y], i) => {
      const X = x * T + ((i * 13) % 20) * K, Y = y * T + ((i * 7) % 14 + 4) * K;
      if (ART.has('props/' + SH[i % 3])) { small(SH[i % 3], X, Y, 1); return; }
      ctx.fillStyle = SHOE[i % SHOE.length]; ctx.fillRect(X, Y + 8 * K, 10 * K, 4 * K);
    });
    L.bags.forEach(([x, y], i) => drawProp(i % 2 && ART.has('props/briefcase') ? 'briefcase' : ART.has('props/backpack') ? 'backpack' : 'sack', x * T, y * T));
    L.phones.forEach(([x, y], i) => {
      const on = (tick >> 6) % 7 !== i;                              // 가끔 꺼졌다 켜진다
      if (ART.has('props/phone')) { small('phone', x * T + 10 * K, y * T + 6 * K, 1, on ? 1 : 0.45); return; }
      ctx.fillStyle = on ? '#9fd2e0' : '#0b0b0d'; ctx.fillRect(x * T + 18 * K, y * T + 16 * K, 6 * K, 10 * K);
    });
    if (L.shaft) {                                                   // 환기 통로: 잿빛이 새어 나온다
      const [x, y] = L.shaft;
      ctx.fillStyle = '#020202'; ctx.fillRect(x * T + 6 * K, y * T + 8 * K, 20 * K, T - 8 * K);
      ctx.fillStyle = `rgba(170,170,165,${0.18 + 0.06 * Math.sin(tick / 40)})`; ctx.fillRect(x * T + 8 * K, y * T + 12 * K, 16 * K, T - 12 * K);
    }
  }
  function drawPrologue(s, sprites) {
    drawLeftovers(scene.key);
    for (const o of mapObjects()) {
      if (o.id === 'collapse') { for (let k = 0; k < 3; k++) sprites.push([o.y + k, () => drawProp('rubble', o.x * T, (o.y + k) * T)]); continue; }
      sprites.push([o.y - 0.5, () => drawProp(o.prop, o.x * T, o.y * T)]);
    }
  }

  // ── 움직임·입력 ──
  const held = new Set();
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let busy = false;           // 대화 흐름 진행 중
  function update() {
    if (scene.moving) {
      scene.moving.t += frameDt / STEP_MS;
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
    scene.px = nx; scene.py = ny; scene.moving = { dx, dy, t: 0 }; scene.steps = (scene.steps || 0) + 1;
    FX.blip('step');
    if (scene.kind === 'station') scene.stationPos = [nx, ny];
  }
  function front() { const [dx, dy] = DIRS[scene.face]; return [scene.px + dx, scene.py + dy]; }

  // ── 걸어서 밟는 곳 ──
  function arrived() {
    const t = tileAt(scene.px, scene.py);
    if (scene.kind === 'prologue') {
      if (t === 'o' && state.pro >= 2) { enterPrologue(M.TUNNEL); flow(() => sceneIntro()); }
      if (scene.key === 'tunnel' && state.pro === 2 && !introShown.meet && scene.px >= M.TUNNEL.meetX) flow(() => meetGicheol());
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
      const body = personCard(r, `<p class="mini">${P.age}세 · <span class="good">${esc(D.TRAITS[r.good].name)}</span>(${esc(D.TRAITS[r.good].desc)}) · <span class="bad">${esc(D.TRAITS[r.bad].name)}</span>(${esc(D.TRAITS[r.bad].desc)})</p>`, true)
        + `<p class="today">${ic(task)}<b>${esc(D.TASKS[task].name)}</b>${row ? ` — ${esc(row.out)}${row.stress != null ? ` · ${ic('stress')}${row.stress > 0 ? '+' : ''}${row.stress}` : ''}${row.infect ? ` · <span class="bad">곪을 위험 ${Math.round(row.infect * 100)}%</span>` : ''}` : ''}</p>
        ${r.mem.length ? `<p class="mini">${r.mem.slice(-2).reverse().map((m) => `D${m.day} ${esc(m.text)}`).join('<br>')}</p>` : ''}`;
      const a = await UI.open(body, { options: [{ label: '할 일을 바꾼다', icon: ic(task), value: 'task', disabled: s.expParty.includes(r.id) }, { label: '그만', value: null }], cancel: true });
      if (a !== 'task') return;
      const opts = E.taskOptions(s, r.id).map((o) => ({ label: o.name + (o.id === task ? ' (지금)' : ''), icon: ic(o.id), sub: esc(o.disabled ? o.reason : o.desc), disabled: o.disabled, value: o.id }));
      const t = await UI.open(`<p class="who">${face(r.id, r.injury, 32)} ${esc(r.name)}의 오늘 할 일</p>`, { options: opts, cancel: true, full: true });
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
      return UI.open(`<p class="title">창고</p><div class="grid2">${Object.keys(D.RES).map((k) => `<span>${D.RES[k]}</span><b>${s.res[k]} / ${D.CAP[k]}</b>`).join('')}</div><p class="mini">도구: ${esc(items.join(', ') || '없음')} · 근처 식량 ${s.forage}</p>`);
    }
    if (id === 'office') {
      if (s.flags.office_open) return UI.open('<p class="title">역무실</p><p>창고와 서류가 있다. 순례의 열쇠로 열었다.</p>');
      if (s.day >= 2) { act({ type: 'setFlag', flag: 'office_open' }); return UI.lines('순례가 조끼 주머니에서 열쇠를 꺼낸다. “삼십 년 닦은 역이야. 열쇠 하나쯤은 있지.” 역무실 문이 열렸다.', { name: '김순례', face: ART.portrait('soonrye').toDataURL() }); }
      return UI.open('<p class="title">역무실 문</p><p>잠겨 있다. 안에 창고가 보인다. 순례가 열쇠를 찾아보겠다고 한다. (내일)</p>');
    }
    if (id === 'exitC') return UI.open('<p class="title">출구 계단</p><p>잿빛 안개가 계단 한가운데에서 벽처럼 멈춰 있다. 가장자리에 재가 쌓였다. 올라갈 수 없다.</p>');
    if (id === 'chalk') return UI.open(`<p class="title">분필 벽</p><p>누군가 벽에 세로줄을 그어 두었다.</p><p style="letter-spacing:.3em;font-size:22px">${'|'.repeat(Math.max(1, s.gods.seel || 0))}</p><p class="mini">시선 「${esc(D.GODS.seel.alias)}」 ${s.gods.seel || 0}</p>`);
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
      const plan = E.alive(s).filter((r) => r.status === 'home').map((r) => { const row = ev.rows.find((x) => x.rid === r.id); const tk = ev.plan[r.id] || 'rest', tn = D.TASKS[tk].name; return `<div class="chip">${face(r.id, r.injury, 32)}<span class="cn2">${esc(r.name.slice(1))}</span>${ic(tk)}<span class="co">${esc(tn)}${row && row.out !== tn ? `<small>${esc(row.out)}</small>` : ''}</span></div>`; }).join('');
      const body = `<p class="title">게시판 — D${s.day}</p>
        <p class="goals">${ic('train')}<b>D${D.GOAL_DAY}</b><span class="badge ${s.flags.passage_secured ? 'good' : s.flags.repair_open ? 'warn' : 'bad'}">통로 ${s.flags.passage_secured ? '개통' : s.project && s.project.id === 'repair' ? `작업 ${s.project.progress}/2` : s.flags.repair_open ? '착공 가능' : '없음'}</span><span class="badge ${s.flags.hospital_pact ? 'good' : ''}">병원 협정 ${s.flags.hospital_pact ? '있음' : '없음'}</span><span class="badge ${tr.passage && tr.cap ? 'good' : 'bad'}">열차 정원 ${tr.passage ? tr.cap : 0}명</span></p>
        ${fc.length ? `<p class="tag">예보와 약속</p>${reps(fc)}` : ''}
        <p class="tag">오늘의 배치 <span class="mini">— 사람에게 말을 걸어 바꾼다</span></p><div class="chips">${plan}</div>
        <p class="tag">내일 아침 예상</p><p class="deltas">${['food', 'water', 'parts', 'meds'].map((k) => delta(k, s.res[k], pv.res[k])).join('')}${delta('flood', s.flood, pv.flood)}${delta('exposure', s.exposure, pv.exposure)}<span class="dl">${ic('power')}${ev.made}${ev.need ? `/${ev.need}` : ''}</span></p>${reps(pv.warnings)}`;
      const av = E.availableProjects(s);
      const opts = [
        { label: '추천 배치로 짠다', icon: ic('board'), sub: esc('추천 기준: ' + (E.suggestWhy(s) || '모두 휴식')), value: 'suggest' },
        { label: '어제와 같이', icon: ic('restart'), value: 'repeat', disabled: !Object.keys(s.lastPlan).length },
      ];
      if (!s.project) for (const p of av) opts.push({ label: `공사 시작: ${p.name}`, icon: ic('build'), sub: esc(`부품 ${p.cost.parts || 0}개 · 작업 ${p.work}회분 · ${p.desc}`), value: 'proj:' + p.id, disabled: !p.afford, confirm: `${p.name}: 부품 ${p.cost.parts || 0}개를 내고 착공합니다. 되돌릴 수 없어요.` });
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
      <p class="deltas">${delta('food', s.res.food, pv.res.food)}${delta('water', s.res.water, pv.res.water)}${delta('flood', s.flood, pv.flood)}${delta('exposure', s.exposure, pv.exposure)}</p>`;
    const deathWarn = pv.deaths.length ? `${pv.deaths.map((n) => J(n, '이/가')).join(', ')} 오늘 밤 사망합니다. 그래도?` : '';
    const a = await UI.open(body, { options: [{ label: '하루를 보낸다 (저녁으로)', value: 'end', confirm: deathWarn }, { label: '아직', value: null }], cancel: true });
    if (a === 'end') { tutDone('ended'); if (act({ type: 'endDay' })) await FX.card(`D${state.day} · 저녁`, '화로 앞에 모인다', 1000); }
  }

  // ── 출구: 원정 준비 ──
  async function exitTo(region) {
    const s = state;
    const back = () => { [scene.px, scene.py] = M.STATION.exitBack[region]; scene.stationPos = [scene.px, scene.py]; };
    if (s.expDone) { await UI.open('<p>오늘은 이미 지상에 다녀왔다.</p>'); back(); return; }
    if (s.closed[region] > 0) { await UI.open(`<p>${esc(D.REGION_NAMES[region])} 길이 막혀 있다. (${s.closed[region]}일)</p>`); back(); return; }
    const R = D.REGIONS[region];
    const go = await UI.open(`<p class="title">${esc(R.name)} — ${esc(R.sub)}</p><p>${esc(R.intro)}</p><p class="mini">두 사람과 함께 나간다. 보급은 가방 칸을 차지하고, 8시간을 넘기면 강행(시간당 둘 다 스트레스 +10).</p>`, { options: [{ label: '나갈 준비를 한다', value: true }, { label: '돌아선다', value: false }], cancel: true, cancelValue: false });
    if (!go) { back(); return; }
    const prep = { party: [], pack: { food: Math.min(4, s.res.food), water: Math.min(4, s.res.water), meds: Math.min(1, s.res.meds), items: [] } };   // 사건 두 장(6시간)이면 둘이 4·4를 쓴다
    for (;;) {
      const why = E.canDepart(s, region, prep.party, prep.pack);
      const cap = E.BASE_LOAD + prep.party.map((id) => E.byId(s, id)).reduce((a2, r) => a2 + E.traitVal(r, 'expLoad'), 0) - (prep.pack.food + prep.pack.water + prep.pack.meds + prep.pack.items.length);
      const opts = E.homeRes(s).map((r) => {
        const no = r.injury >= 2 ? '중상' : r.stress >= E.STRESS_LIMIT_EXP ? `스트레스 ${r.stress}` : r.breakdown > 0 ? '무너짐' : E.noExp(r) ? '다리를 전다' : E.boundToFlame(s, r) ? '불씨지기' : '';
        const on = prep.party.includes(r.id);
        return { label: `${on ? '✓ ' : ''}${r.name}`, icon: face(r.id, r.injury, 36), sub: no ? esc('갈 수 없음: ' + no) : `${skillsRow(r)} · ${ic('stress')}${r.stress}`, disabled: !!no && !on, value: 'p:' + r.id };
      });
      const step2 = (k, label) => [{ label: `${label} +1 (지금 ${prep.pack[k]})`, icon: ic(k), value: `+:${k}`, disabled: prep.pack[k] >= Math.min(k === 'meds' ? 2 : 6, s.res[k]) }, { label: `${label} −1`, icon: ic(k), value: `-:${k}`, disabled: prep.pack[k] <= 0 }];
      opts.push(...step2('food', '식량'), ...step2('water', '물'), ...step2('meds', '약품'));
      for (const it of Object.keys(D.ITEMS).filter((k) => s.items[k])) opts.push({ label: `${prep.pack.items.includes(it) ? '✓ ' : ''}${D.ITEMS[it]} 챙기기`, value: 'i:' + it });
      opts.push({ label: '출발', value: 'go', disabled: !!why, sub: esc(why || `전리품 자리 ${cap}칸`) }, { label: '그만둔다', value: 'stop' });
      const a = await UI.open(`<p class="title">${esc(R.name)} 준비</p><p class="deltas">${ic('people')}${prep.party.length}/2 ${ic('food')}${prep.pack.food} ${ic('water')}${prep.pack.water} ${ic('meds')}${prep.pack.meds}</p><p class="mini">${prep.pack.items.length ? '도구: ' + prep.pack.items.map((k) => D.ITEMS[k]).join('·') + '<br>' : ''}한 사람이 4시간마다 식량·물 1개씩 — 둘이면 4시간에 2개. 사건 두 장이면 6시간(각 4개).</p>`, { options: opts, full: true, cancel: true, cancelValue: 'stop' });
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
    const a = await UI.open(`<p class="tag">${esc(D.REGIONS[s.exp.region].name)} · 깊이 ${s.exp.depth}</p>${cgImg(s.exp.eventId) || eventArt(s.exp.eventId)}<p class="title">${esc(v.event.title)}</p><p>${esc(v.event.text)}</p>`, { options: opts, full: true });
    if (a === 'fight') {
      const party = s.exp.party.map((id) => E.byId(s, id));
      const res = await BATTLE.run(s, F, party, { pipe: s.exp.pack.items.includes('pipe'), id: s.exp.eventId, region: s.exp.region });
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
    scene.px = scene.stationPos ? scene.stationPos[0] : M.STATION.start[0]; scene.py = scene.stationPos ? scene.stationPos[1] : M.STATION.start[1];
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
    const P = D.PROLOGUE[s.pro];
    if (s.pro === 0) {
      await UI.line(D.WARNING, { name: '안내', black: true });
      // 검은 화면: 급제동, 끊긴 방송, 이름을 부르는 소리
      for (let i = 0; i < P.cold.length; i++) { if (i === 0) FX.blip('brake'); await UI.line(P.cold[i], { black: true }); }
    }
    const cg = cgSrc(['open_empty', 'open_cab', 'open_tunnel', 'prologue_station'][s.pro]) || cgSrc(['prologue_car', 'prologue_car', 'prologue_tunnel', 'prologue_station'][s.pro]);
    const parts = UI.splitSentences(P.text);
    for (let i = 0; i < parts.length; i++) await UI.line(parts[i], i === 0 && cg ? { cg } : {});
  }
  // 장면 속 대사 (말하는 사람 얼굴, 첫 문장에 그림)
  async function playBeats(beats) {
    for (const b of beats || []) {
      const who = b.who ? { name: D.PEOPLE[b.who].name, face: ART.portrait(b.who).toDataURL() } : {};
      const ps = UI.splitSentences(b.text);
      for (let i = 0; i < ps.length; i++) await UI.line(ps[i], Object.assign({}, who, i === 0 && b.cg && cgSrc(b.cg) ? { cg: cgSrc(b.cg) } : {}));
    }
  }
  // 그 장의 선택지를 한 번에 (취소 없음)
  async function prologueMenu(who, title) {
    const sc = D.PROLOGUE[state.pro];
    const head = who ? `<p class="who">${esc(D.PEOPLE[who].name)}</p>` : `<p class="title">${esc(title || sc.title)}</p>`;
    const i = await UI.open(head, { options: sc.choices.map((c, k) => ({ label: c.text, sub: esc(E.describeOutcome(c.out).concat(c.out.item ? [D.ITEMS[c.out.item] + ' 획득'] : [], Object.keys(c.out.trust || {}).map((id) => D.PEOPLE[id].name.slice(1) + ' 신뢰 +1')).join(' · ')), value: k })) });
    await prologueChoose(i, who);
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
    if (state.pro === 1) await sceneIntro();          // 같은 칸의 맨 앞 운전실. 터널·역 설명은 그 자리에 갔을 때
  }
  async function prologueObject(o) {
    const s = state;
    if (o.pro === s.pro && o.choice != null) {
      const ch = D.PROLOGUE[s.pro].choices[o.choice];
      const ok = await UI.open(`<p class="title">${esc(o.name)}</p>`, { options: [{ label: ch.text, value: true }, { label: '그만둔다', value: false }], cancel: true, cancelValue: false });
      if (ok) await prologueChoose(o.choice);
      return;
    }
    if (o.id === 'shelter') { UI.toast('작업자용 비상 상자. 혼자서는 열 수 없게 녹슬었다.', 1800); return; }
    if (o.id === 'collapse') { UI.toast(s.pro === 2 ? '잔해 앞에 누군가 있다.' : '무너진 잔해.', 1500); return; }
    UI.toast(s.pro === 0 ? '먼저 이 칸을 나갈 방법을 찾아야 한다.' : s.pro === 1 && (o.id === 'lever' || o.id === 'bag') ? '맨 앞 운전실도 살펴보자.' : '지금은 할 게 없다.', 1500);
  }
  // 터널: 잔해 앞의 기철 (가까이 가거나 말을 걸면)
  async function meetGicheol() {
    const s = state;
    if (s.pro !== 2 || s.proResult || introShown.meet) return;
    introShown.meet = true;
    await playBeats(D.PROLOGUE[2].beats);
    await prologueMenu('gicheol');
  }
  async function prologueNpc(n) {
    if (state.pro === 2 && n.id === 'gicheol') { if (introShown.meet) await prologueMenu('gicheol'); else await meetGicheol(); }
  }
  async function prologueArrive() {
    const s = state;
    if (s.pro < 3) { UI.toast('앞이 무너져 막혀 있다.', 1500); return; }
    await FX.card('을지로입구역', '2호선', 1200);
    enterStation(true);
    await sceneIntro();
    await playBeats(D.PROLOGUE[3].beats);
    await prologueMenu(null, '불가에서');
  }
  async function dayIntro() {
    hud();
    await FX.card('자리 잡기', '1막', 1600);
    await FX.card('D1', `을지로입구역 · 열차까지 ${D.GOAL_DAY - 1}일`, 1600);
    UI.toast('게시판(불 왼쪽)에서 오늘 할 일을 확인하자.', 3500);
  }
  // 그 장소에 있을 때만 그 장의 설명을 띄운다 (전동차에서 터널 설명이 먼저 나오지 않게)
  async function prologueStep() { const p = state.pro; if ((p <= 1 && scene.key === 'car') || (p === 2 && scene.key === 'tunnel')) await sceneIntro(); }
  async function eveningStep() {
    const s = state, v = E.eveningView(s);
    if (v.type === 'promise') {
      const story = D.PROMISES[s.evening.id] && D.PROMISES[s.evening.id].story;
      const art = cgImg(s.evening.id) || cgImg({ story_fog: 'open_stairs', story_voice: 'open_speaker', story_ticket: 'termia_omen' }[s.evening.id] || '');
      const i = await UI.open(`<p class="tag">${story ? '저녁 · 이야기' : '저녁 · 약속'}</p>${art}<p class="title">${esc(v.title)}</p><p>${esc(v.text)}</p>`, { options: choiceOpts(v.choices), full: true });
      act({ type: 'eveningChoose', i });
      const r = state.evening.result;
      await UI.open(`<p class="tag">${story ? '저녁 · 이야기' : '저녁 · 약속'}</p>${resultHtml(r)}`);
      act({ type: 'eveningDone' });
    } else if (v.type === 'talk') {
      const home = E.homeRes(s).filter((r) => !s.expParty.includes(r.id));
      const opts = home.map((r) => ({ label: r.name, sub: esc(`스트레스 ${r.stress} → −${Math.max(0, 8 - E.traitVal(r, 'talkEase'))} · 신뢰 ${'●'.repeat(r.trust)}${'○'.repeat(4 - r.trust)}${r.talks === 2 ? ' · 세 번째: 기술 +1' : ''} · 시선 「${D.GODS.ho.alias}」 +1`), value: r.id }));
      opts.push({ label: '이야기하지 않고 밤으로', value: '' });
      const rid = await UI.open('<p class="tag">저녁 · 화로 앞</p><p class="title">누구와 이야기할까</p>', { options: opts });
      if (rid) {
        act({ type: 'talk', rid });
        const t = state.evening, who = E.byId(state, rid);
        await UI.lines(t.line, { name: who.name, face: ART.portrait(rid, who.injury).toDataURL() });
        UI.toast([`스트레스 −${t.delta}`, '신뢰 +1'].concat(t.extra ? [t.extra.trim()] : []).join(' · '), 2400);
        act({ type: 'eveningDone' });
      } else act({ type: 'skipTalk' });
    } else act({ type: 'eveningDone' });
  }
  async function nightStep() {
    const s = state, v = E.nightView(s);
    const dead = s.report.filter((l) => l.kind === 'bad' && /숨을 거뒀다|사라졌다/.test(l.text));
    if (!v.result) {
      const tag = s.nightEv.id === 'god' ? ` · ${s.nightEv.kind === 'omen' ? '징조' : '강림'} — ${esc(E.godLabel(s, s.nightEv.god))}${ART.has('gods/' + s.nightEv.god) ? ` <img alt="" src="img/gods/${s.nightEv.god}.png" style="width:24px;height:24px;vertical-align:middle;image-rendering:pixelated">` : ''}` : '';
      if (!s._reportShown) {
        const surgeNight = s.report.some((l) => l.text === D.CALENDAR.surge.text);
        const AFF = { 편집증: 'affl_hoard', 자포자기: 'affl_despair', 폭력: 'affl_violent', 도주: 'affl_flee' };
        const crackLine = s.report.find((l) => /— 붕괴: |— 각성: /.test(l.text));
        const crackCg = crackLine ? (/각성/.test(crackLine.text) ? 'virtue' : AFF[(crackLine.text.match(/붕괴: (\S+)/) || [])[1]]) : '';
        await UI.open(`<p class="tag">밤</p>${(crackCg && cgImg(crackCg)) || (surgeNight ? cgImg('surge') : '')}${dead.map((l) => `<p class="rep bad"><b>${esc(l.text)}</b></p>`).join('')}${reps(s.report.filter((l) => !dead.includes(l)))}`, { full: true, next: '그리고…' });
      }
      const i = await UI.open(`<p class="tag">밤${tag}</p>${(s.nightEv.id === 'god' ? cgImg(s.nightEv.god + '_' + s.nightEv.kind) : cgImg(s.nightEv.id)) || eventArt(s.nightEv.id === 'god' ? 'god:' + s.nightEv.god : s.nightEv.id)}<p class="title">${esc(v.title)}</p><p>${esc(v.text)}</p>`, { options: choiceOpts(v.choices), full: true });
      act({ type: 'nightChoose', i });
    }
    const r = E.nightView(state).result;
    await UI.open(`<p class="tag">밤</p>${resultHtml(r)}`, { next: state.day >= D.GOAL_DAY ? '아침 — 열차 시간' : '다음 날 아침' });
    act({ type: 'nightDone' });
    if (state.phase === 'morning') {
      enterStation(true);
      const actNow = D.STORY.acts.find((a) => a.from === state.day);
      if (actNow) await FX.card(actNow.title.split(' · ')[1], actNow.title.split(' · ')[0], 1600);
      await FX.card(`D${state.day}`, D.GOAL_DAY - state.day > 0 ? `열차까지 ${D.GOAL_DAY - state.day}일` : '열차가 오는 날', 1300);
    }
    else if (state.phase === 'boarding') await FX.card(`D${D.GOAL_DAY}`, '열차가 오는 날', 1300);
  }
  async function boardingStep() {
    const s = state, b = s.boarding, tr = E.trainInfo(s);
    if (b.cap === 0) {
      await UI.open(`<p class="tag">D${D.GOAL_DAY} · 열차 시간</p><p class="title">구조열차</p><p>${b.passage ? '통로는 이어졌지만 식량과 물이 모자란다. 한 사람도 태울 수 없다.' : '끊긴 통로 앞에서 열차가 속도를 줄이지 못한다.'}</p>`, { next: '열차를 지켜본다' });
      act({ type: 'confirmBoarding' }); return;
    }
    if (!b.asked) {                                       // 검표원이 먼저 묻는다
      b.asked = true;
      await UI.line('열차의 문이 열린다. 제복의 차장이 수첩을 펼친다. 당신 것과 똑같은 수첩이다.', { cg: cgSrc('board_self') || cgSrc('termia_omen') || undefined });
      await UI.line('“명부의 첫 이름은 당신입니다. 타시겠습니까?”', { name: '검표원' });
    }
    const used = b.picks.length + (b.self ? 1 : 0);
    const opts = [{ label: `${b.self ? '✓ ' : ''}당신 — 명부의 첫 줄`, icon: face('player', 0, 36), sub: esc(b.self ? '탄다 — 자리 하나를 쓴다' : used >= b.cap ? '남는다 — 타려면 한 사람을 내려야 한다' : '남는다 — 누르면 탄다'), value: '__self', disabled: !b.self && used >= b.cap }];
    opts.push(...b.pool.map((p) => { const on = b.picks.includes(p.id); const r = p.kind === 'resident' ? E.byId(s, p.id) : null; return { label: `${on ? '✓ ' : ''}${p.name}`, icon: face(p.id, r ? r.injury : 0, 36), sub: esc(r ? `${D.PEOPLE[p.id].bio} · 스트레스 ${r.stress}${r.injury ? ' · 부상 ' + r.injury : ''}` : '약속을 지켜 준 사람'), value: p.id, disabled: !on && used >= b.cap }; }));
    opts.push({ label: `이 사람들을 태운다 (${used}/${b.cap})`, value: '__go', disabled: !used, confirm: `${used}명을 태웁니다${b.self ? ' (당신 포함)' : ' — 당신은 남는다'}. 확정할까요?` });
    const a = await UI.open(`<p class="tag">D${D.GOAL_DAY} · 열차 시간</p><p class="title">구조열차가 들어온다</p><p class="mini">정원 ${b.cap}명 = 식량·물 ${E.BOARD_PER}개씩 ${tr.base}명${tr.hospital ? ` + 병원 ${tr.hospital}` : ''}${tr.litter ? ` + 들것 ${tr.litter}` : ''}${tr.seat ? ` ${tr.seat > 0 ? '+' : '−'} 검표 ${Math.abs(tr.seat)}` : ''}</p>`, { options: opts, full: true });
    if (a === '__go') act({ type: 'confirmBoarding' }); else if (a === '__self') act({ type: 'boardSelf' }); else act({ type: 'board', id: a });
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
        const a = await UI.open('', { grid: true, cancel: true, options: [
          { label: '수첩', icon: ic('log'), value: 'book' }, { label: '사람들', icon: ic('people'), value: 'people' }, { label: '시선', icon: ic('gods'), value: 'gods' }, { label: '일지', icon: ic('day'), value: 'log' },
          { label: FX.soundOn ? '소리 끄기' : '소리 켜기', icon: ic('sound', FX.soundOn ? '' : 'off'), value: 'sound' }, { label: '처음부터', icon: ic('restart'), value: 'restart', confirm: '저장된 진행이 지워집니다. 정말 처음부터?' }, { label: '닫기', icon: '<i class="ic ic-t">✕</i>', value: null }] });
        if (!a) return;
        if (a === 'restart') { restart(); return; }
        if (a === 'sound') { UI.toast(FX.toggle() ? '소리를 켰다' : '소리를 껐다'); continue; }
        if (a === 'book') await notebook();
        if (a === 'people') await UI.open(`<p class="title">사람들</p>${state.residents.map((r) => personCard(r)).join('')}`, { full: true, cancel: true, next: '닫기' });
        if (a === 'gods') {
          const s = state, kn = { hostile: '적대', neutral: '중립', friendly: '우호' };
          const felt = Object.keys(D.GODS).filter((id) => (s.gods[id] || 0) > 0 || (s.godSeen[id] || 0) > 0);
          await UI.open(`<p class="title">시선</p>${felt.length ? felt.map((id) => { const G = D.GODS[id], v = s.gods[id] || 0; return `<div class="person">${ART.has('gods/' + id) && s.godSeen[id] ? `<img alt="" src="img/gods/${id}.png" style="float:left;width:48px;height:48px;image-rendering:pixelated;margin:0 8px 4px 0">` : ''}<b>${esc(E.godLabel(s, id))}</b> <span class="mini">${s.godSeen[id] ? kn[G.kind] : '정체 모름'} · ${esc(G.hint)}</span><br><span class="mini">시선 ${v}/${E.GOD_ADVENT}${bar(v, E.GOD_ADVENT, v >= E.GOD_ADVENT - 1 && G.kind === 'hostile')}</span><br><span class="mini">${esc(G.raise)}</span></div>`; }).join('') : '<p class="mini">아직 아무것도 느끼지 못했다.</p>'}<p class="mini">시선 ${E.GOD_OMEN}에 징조, ${E.GOD_ADVENT}에 강림.</p>`, { full: true, cancel: true });
        }
        if (a === 'log') await UI.open(`<p class="title">일지</p>${state.history.slice(-16).reverse().map((h) => `<p class="mini">${h.day ? 'D' + h.day : '프롤로그'} · ${esc(h.text)}</p>`).join('')}`, { full: true, cancel: true });
      }
    });
  }

  // 명부 수첩: 첫 장(당신과 이름들) · 들은 것 · 신의 규칙 · 지금의 막
  async function notebook() {
    const s = state;
    const act = D.STORY.acts.slice().reverse().find((a) => s.day >= a.from) || D.STORY.acts[0];
    const names = [`<p><b>1.</b> 당신 <span class="mini">— 기억에 없는 승차</span></p>`].concat(s.residents.map((r, i) => `<p><b>${i + 2}.</b> ${r.status === 'dead' ? `<s>${esc(r.name)}</s>` : esc(r.name)} <span class="mini">${r.status === 'dead' ? '— 줄이 그어졌다' : esc(D.PEOPLE[r.id].wish)}</span></p>`));
    for (const [id, a] of Object.entries(D.ALLIES)) if (s.allies[id]) names.push(`<p><b>+</b> ${esc(a.name)} <span class="mini">— ${esc(a.bio)}, 약속한 사람</span></p>`);
    const heard = [['notebook', '기관사의 수첩. 첫 줄에 당신 이름이 있었다.'], ['fare_known', '운임은 빵과 물, 그리고 지킨 약속.'], ['passage_secured', '고지대 역으로 가는 통로가 이어졌다.'], ['hospital_pact', '병원 팀이 고지대 역에서 기다린다.']].filter(([f]) => s.flags[f]).map(([, t]) => `<p class="mini">· ${esc(t)}</p>`);
    const rules = Object.keys(D.GODS).filter((id) => (s.godSeen[id] || 0) > 0).map((id) => `<p class="mini"><b>${esc(E.godLabel(s, id))}</b> — ${esc(D.GODS[id].rule)}</p>`);
    const prom = s.promises.map((p) => `<p class="mini">· ${esc((D.PROMISES[p.id] || {}).title || p.id)} — D${p.due}</p>`);
    await UI.open(`<p class="tag">명부 수첩 · ${esc(act.title)}</p><p class="title">승객 명부</p>${names.join('')}
      <p class="tag">기다리는 약속</p>${prom.join('') || '<p class="mini">없다.</p>'}
      <p class="tag">들은 것</p>${heard.join('') || '<p class="mini">아직 아무것도.</p>'}
      <p class="tag">뒷장 — 규칙</p>${rules.join('') || '<p class="mini">빈 장. 징조를 겪으면 누군가의 글씨로 한 줄씩 채워진다.</p>'}`, { full: true, cancel: true, next: '덮는다' });
  }
  // 사람 카드: 얼굴 · 이름 · 상태 · 스트레스 막대 · 기술 · 오늘 할 일
  function personCard(r, extra, noTask) {
    const dead = r.status === 'dead' || r.status === 'gone';
    const task = state.phase === 'morning' && !dead && !noTask ? (E.effectivePlan(state)[r.id] || 'rest') : '';
    return `<div class="card ${dead ? 'dead' : ''}">${face(r.id, r.injury, 56)}<div class="cb">
      <p class="cn"><b>${esc(r.name)}</b> <span class="mini">${esc(D.PEOPLE[r.id] ? D.PEOPLE[r.id].bio : '')}</span>${badges(r)}</p>
      ${dead ? '' : `<p class="cs">${ic('stress')}${bar(r.stress, 100, r.stress >= 70)}<b class="${r.stress >= 70 ? 'hot' : ''}">${r.stress}</b>${ic('trust')}<span class="tr">${'●'.repeat(r.trust)}${'○'.repeat(4 - r.trust)}</span></p>
      <p class="cs">${skillsRow(r)}${task ? `<span class="task">${ic(task)}${esc(D.TASKS[task].name)}</span>` : ''}</p>`}
      ${(r.scars || []).length ? `<p class="mini">${r.scars.map((k) => `${esc(D.SCARS[k].name)}: ${esc(D.SCARS[k].desc)}`).join(' · ')}</p>` : ''}${extra || ''}</div></div>`;
  }
  // 머리말을 누르면 아이콘 뜻
  $('hud').addEventListener('click', () => {
    if (busy || UI.isOpen() || state.phase === 'prologue') return;
    flow(() => UI.open(`<p class="title">아이콘</p><div class="legend">${Object.keys(IC_NAME).map((k) => `<p>${ic(k)}<span>${esc(IC_NAME[k])}</span></p>`).join('')}</div>`, { cancel: true, next: '닫기' }));
  });
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
    if (s.phase === 'prologue') return s.pro === 2 && scene.key === 'car' ? '오른쪽 끝 열린 문으로 터널에 나가자' : ['비상 레버나 좌석 밑 가방을 살펴보자', '맨 앞(오른쪽 끝) 운전실을 살펴보자', '터널 앞쪽 불빛으로', '터널 끝 승강장으로'][s.pro] || '';
    if (s.phase === 'expedition') return '빛나는 표시(!)를 살피고, 계단(출구)으로 돌아가자';
    if (s.phase !== 'morning') return '';
    if (s.day === 1 && !tut.board) return '게시판(불 왼쪽)에서 오늘 할 일을 확인하자';
    if (s.day === 1 && !tut.ended) return '사람에게 말을 걸어 일을 바꾸거나, 화로 앞에서 하루를 마치자';
    if (s.flags.repair_open && !s.flags.passage_secured && !s.project) return '게시판에서 통로 수리를 착공하자';
    if (!s.flags.met_dohyeon && !s.flags.skipped_dohyeon && !s.expDone) return '열차는 통로가 있어야 선다 — 수문 방면(오른쪽 아래 터널)에서 도울 사람을 찾자';
    if (!s.flags.met_eunchae && !s.flags.skipped_eunchae && !s.expDone) return '시장 방면(왼쪽 개찰구 밖 통로)에서 약국을 찾자';
    return `D${D.GOAL_DAY} 열차까지 ${D.GOAL_DAY - s.day}일 — 통로를 잇고 사람을 지키자`;
  }
  let tut = {};
  try { tut = JSON.parse(localStorage.getItem('darkstation.v3.tut')) || {}; } catch (e) { tut = {}; }
  function tutDone(k) { if (tut[k]) return; tut[k] = true; try { localStorage.setItem('darkstation.v3.tut', JSON.stringify(tut)); } catch (e) { /* 무시 */ } }
  let lastGoal = null, lastBtn = null;
  function overlay() {
    const g = UI.isOpen() || busy ? '' : objective();
    if (g !== lastGoal) { lastGoal = g; $('goal').textContent = g ? '◆ ' + g : ''; $('goal').hidden = !g; }
    if (g && scene.head) {                                  // 목표 상자가 주인공 머리를 가리면 흐리게
      const el = $('goal'), h = scene.head;
      const over = h.x < el.offsetLeft + el.offsetWidth && h.x + h.w > el.offsetLeft && h.y < el.offsetTop + el.offsetHeight + 4;
      el.classList.toggle('dim', over);
    }
    const tg = !UI.isOpen() && !busy ? target() : null;
    const label = UI.isOpen() ? '선택' : tg ? tg.label : scene.kind === 'dungeon' ? '상태' : '조사';
    if (label !== lastBtn) { lastBtn = label; $('btnA').textContent = label; }
  }
  // 한 칸 걷는 데 걸리는 시간 (ms). 화면 갱신 속도와 상관없이 같다
  const STEP_MS = 230;
  let frameDt = 16, lastT = 0;
  function loop(now) { frameDt = lastT ? Math.min(60, now - lastT) : 16; lastT = now; update(); updateWalkers(); draw(); overlay(); requestAnimationFrame(loop); }
  ART.ready.then(() => {
    resize(); if (state.phase === 'prologue') enterPrologue(); else syncScene(); if (!scene.rows.length) enterStation(true); hud();
    requestAnimationFrame(loop);
    flow(() => (devFixture ? Promise.resolve() : titleScreen()));
  });
  // 타이틀: 진행 중인 판이 있으면 이어하기
  async function titleScreen() {
    const fresh = state.phase === 'prologue' && state.pro === 0 && !state.proResult;
    const opts = fresh ? [{ label: '시작한다', value: 'go' }] : [{ label: `이어서 (${state.phase === 'prologue' ? '프롤로그' : 'D' + Math.min(state.day, D.GOAL_DAY)})`, value: 'go' }, { label: '처음부터', value: 'new', confirm: '저장된 진행이 지워집니다. 처음부터 시작할까요?' }];
    const a = await UI.open(`${cgImg('title')}<p class="title" style="text-align:center;font-size:24px;letter-spacing:.3em;margin-top:6px">어두운 역</p><p class="mini" style="text-align:center">을지로입구역 · 구조열차까지 열흘</p>`, { options: opts, center: true });
    FX.start();
    if (a === 'new') restart();
  }
  if (isLocal) window.__ds3 = { get state() { return state; }, act, scene, flow, step, frame: () => { update(); updateWalkers(); draw(); overlay(); }, interact, menu, target, blocked, residentsOnMap, walkers, pathTo };
})();
