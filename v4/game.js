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
  // 자원 이름: numbers 표의 name 칸이 먼저, 없으면 이 표. 패널·선택지 비용·잠김 이유·밤 보고서가 같이 쓴다
  const RES = { food: '식량', water: '물', fuel: '땔감', meds: '약', parts: '부품' };
  const resName = (k) => (db && db.numbers[k] && db.numbers[k].name) || RES[k] || k;
  const RES_ORDER = ['food', 'water', 'fuel', 'meds', 'parts'];
  const RES_ICON = { food: 'food', water: 'water', fuel: 'gen', meds: 'meds', parts: 'parts' };
  const RES_LOW = { food: 1, water: 1, fuel: 1, meds: 0, parts: 0 };     // 이 값 이하면 패널 숫자가 붉다
  const phaseAllows = (a) => { const ph = db.phases.find((p) => p.id === state.phase); return !!(ph && ph.actions.includes(a)); };

  // ── 장면: 지금 지도 ──
  // walkDist = 이어 걸은 픽셀(걷기 그림 4박자를 고른다, 멈추면 0) · queued = 걷는 도중(t>0.6) 짧게 누른 방향(도착하면 한 번 쓴다)
  const scene = { map: null, rows: [], w: 0, h: 0, px: 0, py: 0, face: 'down', moving: null, steps: 0, auto: null, cam: null, walkDist: 0, queued: null };
  function setScene(mapId, x, y) {
    const m = db.maps[mapId];
    scene.map = m; scene.rows = m.rows; scene.w = m.rows[0].length; scene.h = m.rows.length;
    scene.px = x; scene.py = y; scene.moving = null; scene.auto = null; scene.walkDist = 0; scene.queued = null; scene.crouch = false; scene.face = mapId === 'car' ? 'right' : 'down';
    UI.cgClear();
  }
  const tileAt = (x, y) => RENDER.tileAt(scene, x, y);

  // ── 사람 자리 (화면이 정한다 — 표에는 자리가 없다). 자리 표는 v4/spots.js(서는 칸 검사 stand.test 가 같이 읽는다). 잠자리는 maps.beds 순서 = 담요 순서 ──
  const SPOTS = DS4.spots.SPOTS;
  const BED_ORDER = DS4.spots.BED_ORDER;
  const sat = { day: -1, ids: new Set() };   // 오늘 저녁 이야기한 사람 (화면 기억, 저장 안 함) — 아직이면 머리 위 '…'
  const bedOf = (id) => scene.map.beds[BED_ORDER.indexOf(id)] || null;

  // ── 만남·이름표 (2026-10-24 P0-S5, 부록 A) ──
  // 만났나 = 엔진 known (people.metFlag 가 없거나 그 깃발이 섰다 — view.people[].met 과 같은 값). 옛 화면 표(MET)는 지웠다.
  const met = (id) => !!(state && db && state.people[id] && E.known(state, db, id));
  // 명부·얼굴 줄에 보이는 사람: 만났고, 역 밖에서 아직 안 온 사람(away)·바깥사람(outside)이 아니다
  const shown = (id) => met(id) && !['away', 'outside'].includes(person(id).status);
  // 이름표: 증언 줄(testify_<id>)을 듣기 전까지는 생김새(look_<id>), 들은 뒤 진짜 이름. 증언 줄이 없는 사람(바깥사람)은 진짜 이름
  const lookName = (id) => { const r = db.lines['look_' + id]; return r && r[0] ? r[0].text : ''; };
  function testified(id) { const rows = db.lines['testify_' + id]; if (!rows || !rows.length) return true; const h = state.heard || {}; return rows.some((r, i) => h[`testify_${id}#${i}`] != null); }
  function nameOf(id) { const p = person(id); if (!p) return ''; if (id === 'you') return p.name; return !testified(id) && lookName(id) ? lookName(id) : p.name; }
  // 들은 줄을 엔진 heard 에 남긴다 ('<줄id>#<행번호>' → 오늘). hearLog = 화면 기억(검수·캡처용: 언제 무엇을 들었나)
  const hearLog = [];
  function hearLine(id, row, how) {
    const key = E.heardKey(db, id, row);
    if (!key) return;
    act({ type: 'heard', key, quiet: true });
    hearLog.push({ key, day: state.day, phase: state.phase, how: how || 'line', map: scene.map ? scene.map.id : '', steps: scene.steps });
  }

  // ── 첫 만남 말풍선 사다리 (P0-S5): bark_<사람>_<칸수>(6·4·2·1) 행을 거리(맨해튼)로 고른다. 만나기 전에만, 순서대로 한 번씩.
  //   거리를 건너뛰면 다음 단계를 0.8초 간격으로 차례로. 가장 먼 단계보다 멀어지면 지우고(단계는 그대로), 다시 오면 이어서.
  //   사람의 '6칸' 단계에 행이 없으면 글 없이 몸짓만(순례는 돌아보고, 기철은 빛을 당신에게 멈춘다).
  //   물건 말풍선 bark_shutter_<칸수> 는 shutter_gap 칸이 기준 (D1 낮, 셔터 너머 사람을 아직 안 만났을 때).
  // 화제 말풍선 bark_<사람>_rule_<주제>: 조건이 맞는 날, 그 사람 4칸 안을 지날 때 하루 한 번.
  // 대화창은 저절로 열지 않는다 (디렉터 질문 2) — true 로 바꾸면 만나기 전 사람이 2칸 안에 오면 말 걸기를 연다.
  const AUTO_OPEN_AT_2 = false;
  const BARK_GAP = 800;
  const barkHold = (text) => Math.min(5200, 2400 + 70 * String(text || '').length);
  const bark = { subj: {}, topic: {}, live: new Set(), steps: {}, topics: {} };
  const resetBarks = () => { bark.subj = {}; bark.topic = {}; bark.live = new Set(); };
  function barkSteps(who) {
    if (bark.steps[who]) return bark.steps[who];
    const ns = new Set(who === 'shutter' ? [] : [6]);
    const re = new RegExp('^bark_' + who + '_(\\d+)$');
    for (const k of Object.keys(db.lines)) { const m = re.exec(k); if (m) ns.add(Number(m[1])); }
    return (bark.steps[who] = Array.from(ns).sort((a, b) => b - a).map((n) => ({ n, id: db.lines['bark_' + who + '_' + n] ? 'bark_' + who + '_' + n : '' })));
  }
  const topicIds = (who) => bark.topics[who] || (bark.topics[who] = Object.keys(db.lines).filter((k) => k.startsWith('bark_' + who + '_rule_')));
  // 만나기 전 자리: 순례 = 화로 왼쪽(12,10)에 쪼그려 앉아 화로를 본다 · 마리 = 자기 담요에 앉아 있다 (D0)
  function preMeet(id) {
    if (!scene.map || scene.map.id !== 'station' || state.day !== 0 || !home(id) || met(id)) return null;
    if (id === 'soonrye') { const [x, y] = DS4.spots.FIRST.soonrye; return { x, y, face: 'right', pose: 'crouch' }; }
    if (id === 'mari') { const b = bedOf(id); return b ? { x: b[0], y: b[1], face: 'down', pose: 'sitting' } : null; }
    return null;
  }
  function ladderSubjects() {
    const out = [];
    if (!scene.map || !state || state.ended) return out;
    if (scene.map.id === 'tunnel' && state.day === 0 && !flagOn('met_gicheol') && traceSt('rubble') !== 'crossed') out.push({ who: 'gicheol', x: 16, y: 2 });
    if (scene.map.id === 'station') {
      for (const id of ['soonrye', 'mari']) { const pre = preMeet(id); if (pre) out.push({ who: id, x: pre.x, y: pre.y }); }
      const sg = scene.map.objects.find((o) => o.id === 'shutter_gap');
      if (sg && state.day === 1 && state.phase === 'day' && !flagOn('met_eunji') && traceSt('shutter_gap') === 'shut') out.push({ who: 'shutter', x: sg.x, y: sg.y });
    }
    return out;
  }
  const distTo = (x, y) => Math.abs(scene.px - x) + Math.abs(scene.py - y);
  function updateBarks(now) {
    const free = !busy && !UI.isOpen();
    const subs = ladderSubjects();
    bark.live = new Set(subs.map((s) => s.who));
    let ctx = null;
    for (const s of subs) {
      const st = bark.subj[s.who] || (bark.subj[s.who] = { next: 0, at: -1e9, text: '', reached: 99, d: 99 });
      const steps = barkSteps(s.who);
      const outer = steps.length ? steps[0].n : 6;
      const d = distTo(s.x, s.y);
      st.d = d;
      if (d > outer) { st.text = ''; continue; }
      if (st.text && now - st.at > barkHold(st.text)) st.text = '';
      if (!free || st.next >= steps.length || d > steps[st.next].n || now - st.at < BARK_GAP) continue;
      const step = steps[st.next];
      ctx = ctx || B.lineCtx(state);
      const l = step.id ? B.pickLine(db, step.id, ctx) : null;
      st.text = l ? l.text : ''; st.at = now; st.reached = step.n; st.next++;
      if (l) hearLine(step.id, l, 'bark');
    }
    // 화제 말풍선: 만난 사람 4칸 안, 그날 안 들은 줄 하나 (잠든 사람·대화 중에는 없다)
    if (!free || !scene.map || scene.map.id !== 'station') return;
    for (const p of peopleOnMap()) {
      if (!met(p.id) || p.pose === 'lying' || distTo(p.x, p.y) > 4) continue;
      const t = bark.topic[p.id];
      if (t && t.day === state.day && t.phase === state.phase && now - t.at < barkHold(t.text) + BARK_GAP) continue;
      for (const id of topicIds(p.id)) {
        ctx = ctx || B.lineCtx(state);
        const l = B.pickLine(db, id, ctx);
        const key = l ? E.heardKey(db, id, l) : null;
        if (!l || (state.heard && state.heard[key] === state.day)) continue;
        bark.topic[p.id] = { text: l.text, at: now, day: state.day, phase: state.phase };
        hearLine(id, l, 'topic');
        break;
      }
    }
  }
  function bubbleOf(who) {
    const st = bark.subj[who];
    if (st && st.text && bark.live.has(who)) return st.text;
    const t = bark.topic[who];
    if (t && t.day === state.day && t.phase === state.phase && performance.now() - t.at < barkHold(t.text)) return t.text;   // 단계가 바뀌면 지난 말풍선은 지운다
    return '';
  }
  // 기철 헤드램프: 왼쪽(당신이 올 쪽)을 향한 부채꼴 40°. 6칸 밖 = 천천히 훑는다 · 6칸 안 = 당신에게 멈춘다 · 2칸 = 발로 내려간다 · '…신었군.' 뒤 = 제 앞 바닥으로 거둔다
  const beam = { ang: Math.PI, r: 6.5 };
  function updateBeam(now, dt) {
    const st = bark.subj.gicheol;
    const ox = 16.5, oy = 2 - 0.35;
    let tx = null, ty = null, r = 6.5;
    const ym = scene.moving ? scene.py - scene.moving.dy * (1 - scene.moving.t) : scene.py, xm = scene.moving ? scene.px - scene.moving.dx * (1 - scene.moving.t) : scene.px;
    if (st && st.next >= 1 && st.d <= 6) {
      if (st.reached <= 1 && now - st.at > 900) { tx = ox - 1.8; ty = oy + 1.4; r = 2.4; }
      else if (st.reached <= 2) { tx = xm + 0.5; ty = ym + 0.95; r = Math.hypot(tx - ox, ty - oy) + 0.7; }
      else { tx = xm + 0.5; ty = ym + 0.45; r = 6.5; }
    }
    const want = tx == null ? Math.PI + 0.32 * Math.sin(now / 950) : Math.atan2(ty - oy, tx - ox);
    let da = want - beam.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const k = Math.min(1, (dt || 16) / 110);
    beam.ang += da * k; beam.r += (r - beam.r) * k;
  }

  // ── 몸에 보이는 신호 (판단 정보는 친절하게, 수치는 안 보인다) ──
  // eyes  = 오늘 밤 잠들지 않을 사람 (밤 사건표에서 밤에 일어나 움직이는 문턱: needs.fear>=8, 또는 계단에 섰던 사람)
  // mouth = 굶주린 사람(needs.hunger>=7, 남의 것을 훔치는 문턱) · 사람을 먹은 흔적이 있는 사람(ate_flesh_x, dongha_ate_unknowing)
  // 엔진 view.people[].signs(밤 사건표의 문턱으로 정한 값)를 먼저 쓴다. 아래 문턱은 signs 가 없을 때(옛 엔진)만 쓰는 예비.
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

  // 지도 위 사람: [{id, name, x, y, face, pose, injury, mark, react, bubble, light, beam, talkable, stoke}]
  const faceTo = (x, y) => { const dx = scene.px - x, dy = scene.py - y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'); };
  function peopleOnMap() {
    const out = [];
    if (!scene.map) return out;
    const ph = state.phase;
    if (scene.map.id === 'tunnel') {
      if (state.day === 0 && !flagOn('met_gicheol') && traceSt('rubble') !== 'crossed') {
        // 터널의 유일한 빛 = 헤드램프 부채꼴 (lights 에 방향·각). 말풍선은 bark_gicheol_* 사다리 (옛 '거기 서.' 하드코딩은 지웠다)
        out.push({ id: 'gicheol', name: lookName('gicheol'), x: 16, y: 2, face: 'left', pose: null, injury: 0, light: 1.3, beam: { ang: beam.ang, r: beam.r, spread: 40 * Math.PI / 180 }, talkable: true, bubble: bubbleOf('gicheol') });
      }
      return out;
    }
    if (scene.map.id !== 'station') return out;
    for (const id of BED_ORDER) {
      const p = person(id);
      if (!p || p.status !== 'home') continue;
      if (!met(id)) {                                                    // 만나기 전 (D0): 순례는 화로를 보고 장작을 넣다가 6칸 안에 들면 돌아본다 · 마리는 담요에 앉아 있다. 둘 다 말을 걸 수 있다
        const pre = preMeet(id);
        if (!pre) continue;
        const st = bark.subj[id];
        const turned = st && st.next >= 1 && st.d <= 6;
        const face = id === 'soonrye' ? (turned ? faceTo(pre.x, pre.y) : 'right') : (st && st.d <= 3 ? faceTo(pre.x, pre.y) : pre.face);
        out.push({ id, name: nameOf(id), x: pre.x, y: pre.y, face, pose: pre.pose, injury: 0, talkable: ph === 'day', bubble: bubbleOf(id), stoke: id === 'soonrye' && !turned });
        continue;
      }
      let pos, pose = null, mark = '';
      if (ph === 'night' || ph === 'aftermath') { pos = bedOf(id); pose = 'lying'; }
      else if (ph === 'evening') { pos = SPOTS.evening[id]; pose = 'sitting'; if (!(sat.day === state.day && sat.ids.has(id))) mark = '…'; }
      else if (state.day === 0 && DS4.spots.FIRST[id]) { pos = DS4.spots.FIRST[id]; pose = 'crouch'; }   // D0 낮: 만난 뒤에도 순례는 불가를 지킨다 ("불은 저 할머니 거요")
      else if (state.day === 0 && (DS4.spots.FIRST_BED || []).includes(id) && bedOf(id)) { pos = bedOf(id); pose = 'sitting'; }   // D0 낮: 마리는 만난 뒤에도 자기 담요에 앉아 있다 (눈앞에서 사라지지 않게)
      else pos = (SPOTS[ph] || SPOTS.day)[id];
      if (!pos) continue;
      const near3 = Math.abs(scene.px - pos[0]) + Math.abs(scene.py - pos[1]) <= 3;
      const face = near3 ? faceTo(pos[0], pos[1]) : pose === 'crouch' ? 'right' : 'down';
      out.push({ id, name: nameOf(id), x: pos[0], y: pos[1], face, pose, injury: p.n.injury || 0, mark, react: signOf(id), talkable: ph !== 'night' && ph !== 'aftermath', bubble: bubbleOf(id), stoke: pose === 'crouch' && !near3 });
    }
    return out;
  }
  // 물건 주인 (id 끝 _<사람>, 당신 빼고) — 순례 물통·기철 담요·기철 베개…
  const ownerOf = (id) => { const m = /_([a-z]+)$/.exec(id); return m && m[1] !== 'you' && state.people[m[1]] ? m[1] : null; };
  // 물건 이름 (안내줄·마우스·조사 글): 주인을 만나기 전이거나 증언(진짜 이름)을 듣기 전이면 주인 이름을 뗀 낱말만 — '마리 담요' → '담요' (회의 12 '만나기 전까지는 이름도 그릇도 없다')
  function objName(id) {
    const o = db.objects[id]; if (!o) return '';
    const who = ownerOf(id);
    if (!who || (met(who) && testified(who))) return o.name;
    const parts = String(o.name).split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : o.name;
  }
  // 글 속 물건 이름을 화면 이름으로 (수첩 사실 줄 — 엔진이 표의 이름으로 적어 둔 것): '기철 베개' → 증언 전이면 '베개'
  function maskNames(text) {
    let t = String(text || '');
    for (const id of Object.keys(db.objects)) { const o = db.objects[id]; if (ownerOf(id) && o.name && t.includes(o.name)) t = t.split(o.name).join(objName(id)); }
    return t;
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
      if (/^bandage_/.test(mo.id) && st === 'clean' && !ART.v4prop('bandage')) hidden = true;   // 머리맡 묶음(물통+붕대, P0-D2): 작은 v4 붕대 그림이 있으면 깨끗한 붕대도 보인다
      if (mo.id === 'body_rail' && st === 'none') hidden = true;
      if (mo.id === 'grave' && st === 'none') hidden = true;
      if (mo.id === 'shoes_stairs' && st === 'none') hidden = true;
      if (mo.id === 'notebook_dash' && st === 'taken') hidden = true;          // 수첩은 이제 당신 주머니에
      const who = ownerOf(mo.id);
      if (who && /^(bottle|bowl|bandage)_/.test(mo.id) && person(who).status === 'away') hidden = true;   // 주인이 아직 역 밖(away)인 그릇·물통·붕대는 숨긴다 (P0-S5)
      if (who && /^bowl_/.test(mo.id) && !met(who)) hidden = true;            // 만나기 전에는 그 사람 그릇이 없다 (역 안에 숨은 서하, D0 마리)
      out.push({ id: mo.id, x: mo.x, y: mo.y, name: objName(mo.id), solid: !!o.solid && !(mo.id === 'rubble' && st === 'crossed'), state: st, stateName: st, overlay: ov, light: mo.id === 'notebook_dash' && st !== 'there' ? 0 : (o.light || 0), hidden,
        bubble: mo.id === 'shutter_gap' ? bubbleOf('shutter') : '' });
    }
    return out;
  }
  const objectsAt = (x, y) => objectsOnMap().filter((o) => !o.hidden && o.x === x && o.y === y);
  const rubbleBlocks = (x, y) => scene.map.id === 'tunnel' && x === 17 && traceSt('rubble') !== 'crossed';
  // 막힌 열(17열)의 나머지 칸에도 잔해를 그린다 — 보이지 않는 벽이 없게 (잔해 물건이 있는 칸은 물건이 그린다)
  function rubbleCells() {
    if (!scene.map || scene.map.id !== 'tunnel' || traceSt('rubble') === 'crossed') return [];
    const mo = scene.map.objects.find((o) => o.id === 'rubble');
    const out = [];
    for (let y = 0; y < scene.h; y++) if (tileAt(17, y) !== '#' && !(mo && mo.x === 17 && mo.y === y)) out.push([17, y]);
    return out;
  }

  // ── 지나갈 수 있는가 ──
  function blocked(x, y, noNpc) {
    const t = tileAt(x, y);
    if (t === '#' || t === 't' || t === 'R' || t === 'h' || t === 'D' || t === 'C') return true;   // h 전동차 좌석 · D 계기판 · C 선로 위 멈춘 전동차 몸체 (P0-D2)
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
  // 한 칸 = E.DELAYS.step(230ms, 달리면 ×0.55). 칸에 닿을 때 남은 몫(t−1)을 다음 칸으로 들고 가서, 이어 걸을 때 칸 사이에 멈추는 프레임이 없다.
  function update() {
    if (!scene.map) return;
    let carry = 0;
    if (scene.moving) {
      const ms = Math.max(1, E.DELAYS.step);
      const before = scene.moving.t;
      scene.moving.t += frameDt / (running ? ms * 0.55 : ms);
      scene.walkDist += (Math.min(1, scene.moving.t) - before) * ART.T;
      if (scene.moving.t < 1) return;
      carry = scene.moving.t - 1;
      scene.moving = null; arrived();
    }
    const stop = () => { scene.walkDist = 0; scene.queued = null; };
    if (busy || UI.isOpen()) { scene.auto = null; stop(); return; }
    const dir = scene.queued || ['up', 'down', 'left', 'right'].find((d) => held.has(d));   // 예약한 방향(짧게 누른 것)이 먼저
    if (dir) { scene.auto = null; if (!step(dir, carry)) stop(); return; }
    const a = scene.auto;
    if (a) {
      if (a.path.length) {
        const [nx, ny] = a.path[0];
        if (blocked(nx, ny)) {
          const goal = a.path[a.path.length - 1], p = pathTo(scene.px, scene.py, goal[0], goal[1], true);
          stop();
          if (!p) { scene.auto = null; UI.toast('길이 막혀 있다.', 900); return; }
          a.path = p; return;
        }
        a.path.shift(); if (!step(nx > scene.px ? 'right' : nx < scene.px ? 'left' : ny > scene.py ? 'down' : 'up', carry)) stop();
        return;
      }
      scene.auto = null; stop(); if (a.face) { scene.face = a.face; interact(); } else if (a.then) a.then();
      return;
    }
    stop();
  }
  // 한 칸 걷기 시작. carry = 앞 칸에서 남은 몫. 걸었으면 true
  function step(dir, carry) {
    scene.face = dir; scene.queued = null;
    const [dx, dy] = DIRS[dir];
    const nx = scene.px + dx, ny = scene.py + dy;
    if (nx < 0 || ny < 0 || nx >= scene.w || ny >= scene.h) return false;
    if (blocked(nx, ny)) { if (scene.map.id === 'car' && tileAt(nx, ny) === 'E') UI.toast('문이 닫혀 있다. 레버가 있을 것이다.', 1200); return false; }
    scene.px = nx; scene.py = ny; scene.moving = { dx, dy, t: carry || 0 }; scene.steps++;
    scene.walkDist += (carry || 0) * ART.T;
    if (E.DELAYS.step <= 0) { scene.moving = null; scene.walkDist = 0; arrived(); }
    return true;
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
  // 화로 앞 자리: 화로 바로 아래 칸(13,11)에 서 있으면 48px 몸이 화로 칸으로 올라가 드럼·불꽃이 머리에 얹힌 것처럼 보인다.
  // 단계가 바뀌면(화로를 조사해 넘어가므로 대개 그 칸이다 — 아침·저녁·밤) 한 칸 물러서서(승강장 끝 선) 화로를 보고 선다. 비어 있지 않으면 그대로.
  // 화로는 빈 칸 하나 건너서도 조사되므로(target) 그 자리에서 Space 로 바로 다음 단계로 간다.
  function fireStand() {
    const f = scene.map && scene.map.fire;
    if (!f || scene.map.id !== 'station' || scene.moving) return;
    if (scene.px !== f[0] || scene.py !== f[1] + 1) return;
    if (blocked(f[0], f[1] + 2)) return;
    scene.py = f[1] + 2; scene.face = 'up'; scene.auto = null;
  }
  // 화로 앞에서 물러선 칸 (승강장 화로 두 칸 아래) — 원정에서 돌아와 아침을 맞는 자리도 여기
  const fireStandCell = (mapId) => { const f = db.maps[mapId].fire; return [f[0] + DS4.spots.FIRE_STAND[0], f[1] + DS4.spots.FIRE_STAND[1]]; };
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
    const os = objectsAt(tx, ty);
    if (os.length) return os.map((o) => o.name).join(' · ');
    return EXIT_NAMES[tileAt(tx, ty)] || '';
  }

  // ── 걸어서 밟는 곳 ──
  function arrived() {
    const t = tileAt(scene.px, scene.py);
    if (scene.map.id === 'car' && t === 'E') { flow(() => enterMap('tunnel')); return; }
    if (scene.map.id === 'tunnel' && t === 'E') { flow(() => enterMap('station')); return; }
    if (scene.map.id === 'station' && (t === 'A' || t === 'B')) { if (state.phase === 'day') UI.toast(`${EXIT_NAMES[t]} — 조사하면 원정`, 1500); }
  }
  // 지도에 들어선다: move 로 자리를 옮긴다. 그 지도에 걸린 고정 장면(눈을 뜬다·승강장)은 엔진 move 가 바로 건다(checkEvents).
  async function enterMap(mapId) {
    const m = db.maps[mapId];
    const [x, y] = m.start;
    if (mapId === 'station' && !flagOn('arrived')) await UI.card(PLACE.station, '환선 · 지하 2층');
    else if (mapId === 'tunnel') await UI.card('어두운 터널', '');
    act({ type: 'move', map: mapId, x, y });
    setScene(mapId, x, y);
    unstack(); fireStand();                                          // 도착 칸이 사람·화로 앞과 겹치면 비켜 선다 (단계 전환과 같은 규칙)
    await pendingFlow();
  }

  // ── 조사·말 걸기 ──
  // 조사할 것: 앞 칸 사람 → 앞 칸 물건 전부(없으면 내 칸) → 한 칸 건너 화로 → 출구. 안내줄 = 'Space <동사> — <이름>' (P0-S6)
  //   닫힌 수납이면 '열기', 사람이면 '말 걸기 — <이름표>', 그 밖은 '조사'. 한 칸에 물건이 여럿이면 이름을 다 적고 한 번에 차례로 조사한다
  const CLOSED = { crate_food: 'closed', bag: 'closed', medkit: 'closed', shelter_box: 'closed', lever: 'up' };
  const isClosed = (o) => CLOSED[o.id] === o.state;
  const fireVerb = () => (preMeet('soonrye') ? '조사' : fireLabel());          // 순례를 만나기 전의 화로 = 순례에게 말 걸기
  function target() {
    if (scene.moving || !scene.map) return null;
    const [fx, fy] = front();
    const p = peopleOnMap().find((q) => q.x === fx && q.y === fy && q.talkable);
    if (p) return { x: fx, y: fy, kind: 'npc', id: p.id, label: '말 걸기', verb: '말 걸기', name: p.name || '누군가' };
    let os = objectsAt(fx, fy);
    if (!os.length) os = objectsAt(scene.px, scene.py);
    if (os.length) {
      const fire = os.find((q) => q.id === 'fire');
      if (fire) return { x: fire.x, y: fire.y, kind: 'obj', id: 'fire', ids: ['fire'], label: fireVerb(), verb: fireVerb(), name: fire.name };
      const verb = os.length === 1 && isClosed(os[0]) ? '열기' : '조사';
      return { x: os[0].x, y: os[0].y, kind: 'obj', id: os[0].id, ids: os.map((q) => q.id), label: verb, verb, name: os.map((q) => q.name).join(' · ') };
    }
    // 화로는 빈 칸 하나 건너서도 조사된다 (아침 자리 = 화로 두 칸 아래에서 화로를 본다)
    const [ddx, ddy] = DIRS[scene.face];
    const far = !blocked(fx, fy) ? objectsAt(fx + ddx, fy + ddy).find((q) => q.id === 'fire') : null;
    if (far) return { x: far.x, y: far.y, kind: 'obj', id: far.id, ids: [far.id], label: fireVerb(), verb: fireVerb(), name: far.name };
    const ex = exitHere();
    if (ex) { const v = state.phase === 'day' ? '원정' : '통로'; return { x: scene.px, y: scene.py, kind: 'exit', id: ex, label: v, verb: v, name: EXIT_NAMES[ex] }; }
    return null;
  }
  function interact() {
    if (busy || UI.isOpen() || scene.moving) return;
    const tg = target();
    if (!tg) { UI.toast('아무것도 없다.', 900); return; }
    if (tg.kind === 'npc') flow(() => talkTo(tg.id));
    else if (tg.kind === 'obj') flow(() => useCell(tg));
    else flow(() => useExit(tg.id));
  }
  // 한 칸 전부 조사 (P0-S6): 그 칸의 물건을 차례로 — 하나를 조사하고 걸린 사건(pendingFlow)을 마친 뒤 다음 (엔진의 대기 사건은 한 번에 하나)
  const cellLog = [];
  async function useCell(tg) {
    const ids = tg.ids || [tg.id];
    for (const id of ids) {
      if (state.ended || !scene.map) break;
      if (!objectsAt(tg.x, tg.y).some((q) => q.id === id)) continue;           // 앞 물건의 사건으로 사라졌으면 건너뛴다
      cellLog.push({ cell: [tg.x, tg.y], id, day: state.day, phase: state.phase });
      await useObject(id);
      await pendingFlow();
    }
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
  const costText = (cost) => Object.entries(cost || {}).map(([k, v]) => `${resName(k)} −${v}`).join(' · ');
  const reasonKo = (r) => String(r || '').replace(/(\S+)이\(가\) 모자라다/g, (m, k) => `${josa(resName(k), '이가')} 모자라다`);
  const choiceSub = (c) => [c.chance != null ? `<small class="chance">${c.chance}%</small>` : '', c.cost && Object.keys(c.cost).length ? `<small class="cost">${esc(costText(c.cost))}</small>` : '',
    c.warn ? `<small class="warn">${esc(c.warn)}</small>` : c.hint ? `<small>${esc(c.hint)}</small>` : '', c.locked ? `<small class="lock">${esc(reasonKo(c.reason))}</small>` : ''].join('');
  // 장면 그림: v4 cg/<image> → v4 cg/<사건 id> → v3 대체 (art.js). 없으면 그림 층을 열지 않는다
  function eventCg(v) {
    const src = ART.cgSrc(v.image, v.id);
    if (src) UI.cg(src);
    else if (v.image) missing.add(v.image + '@' + v.id);
    return !!src;
  }
  // 수납 열기 (P0-S6): 사건 결과로 이 지도 물건이 닫힘(closed·up) → 열림(open·empty·pulled)이 됐는가
  const OPEN_SHAKE_MS = 400;
  let shake = null;
  const openLog = [];
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const traceStates = () => (scene.map ? Object.fromEntries(scene.map.objects.map((o) => [o.id, traceSt(o.id)])) : {});
  const openedSince = (before) => (scene.map ? scene.map.objects.map((o) => o.id).filter((id, k, a) => a.indexOf(id) === k && ['closed', 'up'].includes(before[id]) && ['open', 'empty', 'pulled'].includes(traceSt(id))) : []);
  // 패널 숫자 두 번 깜빡임: hud() 가 다시 그려도 이어지게 시작 시각을 기억한다
  const blinkAt = {};
  const BLINK_MS = 900;
  const blinkRes = (ks) => { const t = performance.now(); for (const k of ks) blinkAt[k] = t; hud(); };
  // 첫 만남 사건 → 그 사람 (대사창 이름표 = nameOf: 증언 전에는 생김새)
  // 찾은 물건 아이콘 (v4 icons/<이름>, P0-A3): 그 선택의 결과가 당신 손에 쥐여 주는 물건 → 결과 글 얼굴 칸. '<사건 id>#<선택 번호>'. 그림이 없으면 연 수납의 자원 아이콘으로
  const FOUND = { 'pro_bag#0': 'cable', 'pro_notebook#0': 'notebook', 'd0_gicheol_notebook#0': 'notebook', 'd1_gicheol_arrive#0': 'notebook', 'pro_lever#0': 'bottle',
    'pro_gicheol#1': 'crackers', 'pro_gicheol#2': 'glove', 'd2_key#0': 'key', 'd2_key_vest#0': 'key', 'trial_d8_key#0': 'key', 'trial_d8_key_b#0': 'key', 'trip_b2_drowned#1': 'key' };
  const foundLog = [];
  const MEET_EV = { pro_platform: 'soonrye', pro_gicheol: 'gicheol', pro_mari: 'mari', d0_mari_fire: 'mari', d1_shutter_knock: 'eunji', d0_gicheol_notebook: 'gicheol', d1_gicheol_arrive: 'gicheol', d1_gicheol_arrive_b: 'gicheol' };
  async function showEvent() {
    const v = E.eventView(state, db);
    if (!v) return;
    const black = v.id === 'pro_cold';
    if (!black) eventCg(v);
    const who = MEET_EV[v.id] && person(MEET_EV[v.id]) ? nameOf(MEET_EV[v.id]) : '';   // 첫 만남 사건: 대사창에 이름표(생김새) — '헤드램프의 남자' (부록 A)
    await UI.lines(v.text, who ? { black, tag: v.id, name: who, face: faceOf(MEET_EV[v.id]) } : { black, tag: v.id });
    const sentences = UI.splitSentences(v.text);
    let i;
    // 결말에 board:1 이 있으면(열차) 태울 사람을 고르는 줄이 선택지 맨 아래에 붙는다 — 엔진 board 동작(board_<id> 깃발, 다시 누르면 내린다)
    const boardIds = () => (v.board ? db.peopleOrder.filter((id) => id !== 'you' && home(id) && met(id)) : []);
    const boarded = () => boardIds().filter((id) => flagOn('board_' + id));
    for (;;) {                                                       // 되돌릴 수 없는 선택(금기·결말)은 상자 안에서 한 번 더 묻는다 — OS 확인창 없음
      const opts = v.choices.map((c, k) => ({ label: c.label, sub: choiceSub(c), disabled: c.locked, value: k, warn: !!(c.warn || c.taboo) }));   // 경고·금기가 있으면 커서 없이 연다 (ui.js)
      if (boardIds().length) opts.push({ label: `태울 사람 (${boarded().length}/${boardIds().length})`, sub: `<small>${esc(boarded().map((id) => nameOf(id)).join(' · ') || '아직 아무도')}</small>`, value: 'board' });
      const head = who ? `<p class="who">${esc(who)}</p>` : '';
      i = await UI.open(`${head}<p>${esc(v.text)}</p>`, { kind: 'event', fit: sentences, fitHead: head, options: opts, cls: opts.length > 3 ? 'wide' : '' });
      if (i === 'board') { await boardMenu(boardIds()); continue; }
      const c = v.choices[i];
      if (!c || !(c.taboo || v.kind === 'ending')) break;
      const boardWho = boardIds().length ? `<p class="mini">태울 사람: ${esc(boarded().map((id) => nameOf(id)).join(' · ') || '없음')}</p>` : '';
      const sure = await UI.open(`<p class="who">되돌릴 수 없다</p><p>${esc(c.label)}${c.warn ? ` — <span class="warnt">${esc(c.warn)}</span>` : ''}</p>${boardWho}`, { kind: 'confirm2', sel: 1, options: [{ label: '그렇게 한다', value: true }, { label: '다시 고른다', value: false }] });   // 커서는 '다시 고른다'에서 시작
      if (sure) break;
    }
    const trBefore = traceStates(), worldBefore = Object.assign({}, state.world);
    if (!act({ type: 'choose', i })) return;
    const r = state.lastResult || {};
    // 수납 열기 3박자 (P0-S6): 이 지도의 물건이 닫힘 → 열림·빔으로 바뀌었으면 ① 열린 그림으로 즉시 바뀌고(지도가 상태를 그린다)
    //   ② 0.4초 동안 1px 흔들리며 입력을 막고(이 흐름이 busy) ③ 결과 글. 식량·물·약·부품이 늘었으면 대사창 얼굴 칸에 그 아이콘(40px 를 2배 = 80)과 패널 숫자 두 번 깜빡임
    const opened = openedSince(trBefore);
    const gained = RES_ORDER.filter((k) => k !== 'fuel' && (state.world[k] || 0) > (worldBefore[k] || 0));
    if (gained.length) blinkRes(gained);
    // 앞 칸의 바닥 가구(벽에 걸지 않은 것 — 창고 상자·가방)를 열었으면 여는 동안 쪼그려 앉는다: 서 있으면 머리(칸 위로 14px)가 열린 그림 가운데를 가린다.
    //   벽에 거는 것(구급함·레버함·벽감 상자, 물건 칸이 '#')은 render.js 가 벽면 높이로 올려 그려서 서서 연다
    const [fx0, fy0] = front();
    const floorOpen = opened.some((oid) => scene.map.objects.some((mo) => mo.id === oid && mo.x === fx0 && mo.y === fy0) && tileAt(fx0, fy0) !== '#');
    if (opened.length && !black) {
      if (!r.image) UI.cgClear();                                         // 그림 층을 걷어 지도에서 열리는 것을 보인다
      shake = { ids: opened, until: performance.now() + OPEN_SHAKE_MS };
      if (floorOpen) scene.crouch = true;
      openLog.push({ ids: opened, event: v.id, day: state.day, gained, crouch: floorOpen });
      if (!E.isFast || !E.isFast()) await wait(OPEN_SHAKE_MS);
    }
    if (r.image && !black) {                                           // 결과 그림(lastResult.image): 있으면 결과 글 동안 그것으로 바꾼다
      const src = ART.cgSrc(r.image) || (/^death_/.test(r.image) ? ART.deathSrc(r.image) : '');
      if (src) UI.cg(src); else missing.add(r.image + '@' + v.id + ':out');
    }
    if (r.roll) await UI.line(`판정 ${r.roll.chance}% — ${r.roll.success ? '됐다.' : '안 됐다.'}`, { black });
    // 결과 글 얼굴 칸 = 찾은 물건 아이콘(40px 을 2배 = 80): 사건이 손에 쥐여 준 물건(FOUND — 케이블·수첩·건빵·장갑·열쇠…)이 먼저, 없으면 연 수납에서 늘어난 자원
    const fid = FOUND[v.id + '#' + i] || FOUND[v.id];
    const resIcon = opened.length && gained.length ? RES_ICON[gained.slice().sort((a, b) => (state.world[b] - worldBefore[b]) - (state.world[a] - worldBefore[a]))[0]] : '';
    const found = (fid && ART.iconSrc(fid)) || (resIcon && ART.iconSrc(resIcon)) || '';
    if (found) foundLog.push({ event: v.id, choice: i, icon: fid && ART.iconSrc(fid) ? fid : resIcon, day: state.day });
    if (r.text) await UI.lines(r.text, found ? { black, tag: v.id + ':out', face: found, faceCls: 'icon' } : { black, tag: v.id + ':out' });
    scene.crouch = false;
    if (['pro_notebook', 'd1_gicheol_arrive', 'd0_gicheol_notebook'].includes(v.id)) UI.toast(lineOf('toast_ledger_line') || '명부에 한 줄 — Tab');
    if (!state.pending && !state.ended) UI.cgClear();
  }
  // 태울 사람: 배식 그릇처럼 이름을 켜고 끈다 (탄 사람 = 명부 '탔다')
  async function boardMenu(ids) {
    for (;;) {
      const html = `<p class="who">태울 사람</p><div class="bowls">${ids.map((id) => `<span class="${flagOn('board_' + id) ? 'on' : ''}">${esc(nameOf(id))}</span>`).join('')}</div>`;
      const opts = ids.map((id) => ({ label: `${nameOf(id)} ${flagOn('board_' + id) ? '내린다' : '태운다'}`, value: id }));
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
    if (!p || p.status !== 'home' || !met(id)) return '여기 없다';
    if (!((p.n.injury || 0) > 0)) return '다친 데가 없다';
    if (!phaseAllows('treat')) return '낮·저녁에 감는다';
    if (flagOn('treated_' + id)) return '오늘은 이미 감았다';
    if ((state.world.meds || 0) < treatNeed()) return '약이 없다';
    return '';
  }
  const treatOpt = (label, id) => { const why = treatWhy(id); return { label, sub: why ? `<small class="lock">${esc(why)}</small>` : `<small class="cost">${esc(costText({ meds: treatNeed() }))}</small>`, disabled: !!why, value: 'treat' }; };
  const treatable = () => ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && met(id))).filter((id) => !treatWhy(id));
  async function doTreat(id) {
    if (!act({ type: 'treat', who: id })) return false;
    await UI.lines(id === 'you' ? '상처를 씻고 붕대를 새로 감았다.' : `${nameOf(id)}의 상처를 씻고 붕대를 새로 감았다.`, id === 'you' ? {} : { name: nameOf(id), face: faceOf(id) });
    return true;
  }
  async function treatMenu() {
    const ids = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && home(id) && met(id)));
    const hurt = ids.filter((id) => (person(id).n.injury || 0) > 0);
    const head = `<p class="who">치료</p><p class="mini">약 ${state.world.meds || 0} · 한 사람에 ${costText({ meds: treatNeed() })} · 낮·저녁에, 하루 한 번</p>`;
    const opts = hurt.map((id) => Object.assign(treatOpt(`${nameOf(id)} — ${hurtWord(person(id).n.injury)}`, id), { value: id }));
    opts.push({ label: '돌아간다', value: null });
    const a = await UI.open(head + (hurt.length ? '' : '<p>다친 사람이 없다.</p>'), { kind: 'treat', cancel: true, cancelValue: null, options: opts, cls: opts.length > 4 ? 'wide' : '' });
    if (a) await doTreat(a);
  }
  // 말 걸기 (P0-S5): 그 사람의 맞는 줄 전부 가운데 ① 오늘 안 들은 줄 ② 조건 낱말이 많은 줄 순 (browser.js talkPick). 고른 줄은 엔진 heard 에 남긴다.
  //   할 말이 다 떨어지면 <사람>_idle 줄(서술, 얼굴·이름 없음). 바로 앞에도 그 몸짓이었으면 가장 맞는 줄을 다시 한다 — 같은 줄이 연달아 나오지 않게
  const lastTalk = {};
  const talkLog = [];
  async function talkTo(id) {
    const p = person(id);
    if (!p) return;
    const nm = nameOf(id);
    if (met(id) && (p.n.injury || 0) > 0 && phaseAllows('treat')) {          // 다친 사람: 말을 걸지, 상처를 감아 줄지
      const a = await UI.open(`<p class="who">${esc(nm)}</p><p>${esc(HURT_LOOK[Math.min(3, p.n.injury)])}</p>`, { kind: 'tend', cancel: true, cancelValue: null,
        options: [{ label: '말을 건다', value: 'talk' }, treatOpt('상처를 감아 준다', id), { label: '돌아선다', value: null }] });
      if (!a) return;
      if (a === 'treat') { await doTreat(id); return; }
    }
    if (!act({ type: 'talk', who: id })) return;
    if (state.pending) return;
    if (state.phase === 'evening') { if (sat.day !== state.day) { sat.day = state.day; sat.ids = new Set(); } sat.ids.add(id); }
    // 그 사람이 본 소문(안 들은 것)이 있으면 먼저 한 줄
    const ri = state.rumors.findIndex((r) => r.witness === id && !r.heard);
    if (ri >= 0) {
      const r = state.rumors[ri];
      const rows = db.lines[r.line] || [];
      const row = rows.length ? rows[r.truth ? 0 : Math.min(1, rows.length - 1)] : null;
      act({ type: 'hear', i: ri, quiet: true });
      lastTalk[id] = { day: state.day, key: 'rumor:' + r.line };
      talkLog.push({ who: id, day: state.day, phase: state.phase, key: 'rumor:' + r.line });
      if (row) { const who = r.roles && r.roles.actor && person(r.roles.actor) ? nameOf(r.roles.actor) : (r.roles && r.roles.target && person(r.roles.target) ? nameOf(r.roles.target) : ''); await UI.lines(B.fill(row.text, who), { name: nm, face: faceOf(id) }); return; }
    }
    const ctx = B.lineCtx(state);
    const pk = B.talkPick(db, state, id, ctx);
    const prev = lastTalk[id] && lastTalk[id].day === state.day ? lastTalk[id].key : '';
    const idleKey = id + '_idle';
    if (!pk || !pk.fresh) {                                                     // 할 말이 떨어졌다 → 몸짓 한 줄. 오늘 몸짓까지 봤으면 창 없이 안내 한 줄 (들은 말을 번갈아 되풀이하지 않는다)
      const idle = B.pickLine(db, idleKey, ctx);
      if (idle && prev !== idleKey && prev !== '(done)') {
        lastTalk[id] = { day: state.day, key: idleKey };
        talkLog.push({ who: id, day: state.day, phase: state.phase, key: idleKey });
        await UI.lines(idle.text, { tag: idleKey });
        return;
      }
      if (idle) {
        lastTalk[id] = { day: state.day, key: '(done)' };
        talkLog.push({ who: id, day: state.day, phase: state.phase, key: '(done)' });
        UI.toast('더 할 말은 없어 보인다.', 1400);
        return;
      }
    }
    if (pk) {
      hearLine(pk.id, pk.row, 'talk');
      lastTalk[id] = { day: state.day, key: pk.key };
      talkLog.push({ who: id, day: state.day, phase: state.phase, key: pk.key, fresh: pk.fresh });
      await UI.lines(pk.row.text, { name: nm, face: faceOf(id) });
      return;
    }
    lastTalk[id] = { day: state.day, key: '…' };
    talkLog.push({ who: id, day: state.day, phase: state.phase, key: '…' });
    await UI.lines('…', { name: nm, face: faceOf(id) });
  }
  // 저녁 증언 (P0-S5, 부록 A7): 저녁 단계에 들어가 첫 저녁 사건 창을 보이기 직전에, 만난 사람 가운데 증언(testify_<id>)을 아직 안 들은 사람이
  //   잠자리 순서(BED_ORDER)로 얼굴·진짜 이름과 함께 한 줄씩 말한다. 순례 다음에는 수첩이 있으면 testify_soonrye_book. 들은 것은 엔진 heard 에
  async function testimony() {
    const ctx = B.lineCtx(state);
    for (const id of BED_ORDER) {
      if (!home(id) || !met(id) || testified(id)) continue;
      const l = B.pickLine(db, 'testify_' + id, ctx);
      if (!l) continue;
      const opt = { name: person(id).name, face: faceOf(id), tag: 'testify_' + id };
      await UI.lines(l.text, opt);
      hearLine('testify_' + id, l, 'testify');
      if (id === 'soonrye') {
        const b = B.pickLine(db, 'testify_soonrye_book', ctx);
        if (b) { await UI.lines(b.text, Object.assign({}, opt, { tag: 'testify_soonrye_book' })); hearLine('testify_soonrye_book', b, 'testify'); }
      }
    }
  }
  async function useObject(id) {
    if (id === 'fire' && scene.map.id === 'station') {
      if (preMeet('soonrye')) return talkTo('soonrye');                       // 순례를 만나기 전: 화로를 조사하면 순례에게 말 걸기 → pro_platform (P0-S5)
      return useFire();
    }
    if (!act({ type: 'inspect', object: id })) return;
    if (state.pending) return;
    const o = db.objects[id];
    const st = traceSt(id);
    const lid = o.inspectLine && o.inspectLine[st];
    const text = lid ? lineOf(lid) : '';
    const shownName = objName(id);                                              // 주인 증언 전이면 주인 이름을 뗀 낱말 ('담요')
    await UI.lines(text || `${shownName}이다.`);
    // 젖은·썩은 붕대: 그 사람이 다쳤으면 그 자리에서 새로 감을 수 있다
    const bm = /^bandage_(\w+)$/.exec(id);
    if (bm && person(bm[1]) && met(bm[1]) && (person(bm[1]).n.injury || 0) > 0 && phaseAllows('treat')) {
      const who = bm[1];
      const a = await UI.open(`<p class="who">${esc(shownName)}</p><p>${esc(nameOf(who))} — ${esc(hurtWord(person(who).n.injury))}</p>`, { kind: 'tend', cancel: true, cancelValue: null, options: [treatOpt('붕대를 새로 감는다', who), { label: '둔다', value: null }] });
      if (a === 'treat') await doTreat(who);
    }
    // 수첩에 적을 수 있는 사실 줄이 있으면 묻는다 (사실 줄의 물건 이름도 화면 이름으로 — 증언 전에 진짜 이름이 새지 않게)
    const fact = o.ledgerFact && o.ledgerFact[st];
    const phase = db.phases.find((p) => p.id === state.phase);
    if (fact && phase && phase.actions.includes('writeLedger') && !state.ledger.written.some((w) => w.object === id && w.day === state.day)) {
      const t = state.traces[id] || {};
      const txt = String(fact).replace(/\{day\}/g, t.day).replace(/\{by\}/g, t.by && person(t.by) ? nameOf(t.by) : '').split(o.name).join(shownName);
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
    unstack(); fireStand();
    if (before && state.day !== before.day) {
      const left = GOAL_DAY - state.day;
      await UI.card(`D${state.day}`, left > 0 ? `열차까지 ${left}일` : '열차가 오는 날');
      store.markMorning(state);
      await nightReport(before);
    }
    if (ph === 'trace') { if (scene.map && scene.map.id !== 'station') { const [sx, sy] = fireStandCell('station'); act({ type: 'move', map: 'station', x: sx, y: sy, quiet: true }); setScene('station', sx, sy); scene.face = 'up'; unstack(); } }
    if (ph === 'ration') { await pendingFlow(); if (!state.ended) await rationFlow(); return; }
    if (ph === 'seat') { await pendingFlow(); if (!state.ended) { await UI.line('사람들이 제 자리로 흩어진다.'); await nextPhase(); } return; }
    if (ph === 'aftermath') { await pendingFlow(); if (!state.ended) { await dream(); await UI.line('밤이 지난다.', { black: true }); await nextPhase(); } return; }
    if (ph === 'evening' && !state.ended) await testimony();                // 저녁 증언 — 첫 저녁 사건 창(명부 등) 직전 (P0-S5)
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
    const names = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && home(id) && met(id)));   // 당신 그릇이 맨 앞 (엔진은 적힌 순서대로 푼다) · 안 만난 사람은 없다 (P0-S5)
    const bowls = Object.fromEntries(names.map((id) => [id, true]));
    for (;;) {
      const bowlHtml = names.map((id) => `<span class="${bowls[id] ? 'on' : ''}">${esc(nameOf(id))}</span>`).join('');
      const n = names.filter((id) => bowls[id]).length;
      const opts = names.map((id) => ({ label: `${nameOf(id)} ${bowls[id] ? '그릇을 뺀다' : '그릇을 놓는다'}`, value: id }));
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
    for (const k of RES_ORDER) { const d = (state.world[k] || 0) - (before.world[k] || 0); if (d) parts.push(`${resName(k)} ${d > 0 ? '+' : '−'}${Math.abs(d)}`); }
    const gone = Object.values(state.people).filter((p) => before.status[p.id] === 'home' && p.status !== 'home' && p.id !== 'you' && met(p.id))
      .map((p) => josa(nameOf(p.id), '이가') + (p.status === 'ascended' ? ' 올라갔다' : p.status === 'stayed' ? ' 셔터 너머로 갔다' : ' 밤에 갔다'));
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
  // 명부 행 이름 = 화면 이름표(nameOf): 증언(진짜 이름)을 듣기 전에는 생김새 — 엔진 행의 name(진짜 이름)을 그대로 쓰지 않는다 (같은 창 머리말과 같게)
  const rowName = (r) => (r.id && person(r.id) ? nameOf(r.id) : r.name);
  // 명부 한 장 (무대 층): 탄 사람 옆에 구멍, 죽은 줄에 날짜와 줄긋기, 올라간 줄은 옅게, 사인 빈칸은 ___ , 당신 줄은 맨 위
  function ledgerPage(rows, foot) {
    const body = rows.map((r) => `<div class="lrow ${r.status}${r.id === 'you' ? ' you' : ''}"><span class="hole"></span><span class="nm">${esc(rowName(r))}</span><span class="st">${STATUS_KO[r.status] || ''}</span><span class="dd">${rowDay(r)}</span><span class="cs">${rowCause(r)}</span></div>`).join('');
    return `<p class="lhead">승객 명부</p>${body}${foot ? `<p class="ft">${esc(foot)}</p>` : ''}`;
  }
  const ledgerMini = (rows) => `<div class="ledger">${rows.map((r) => `<div class="row ${r.status}"><span>${esc(rowName(r))}</span><span>${STATUS_KO[r.status] || ''}${rowDay(r) ? ' · ' + rowDay(r) : ''} ${rowCause(r)}</span></div>`).join('')}</div>`;
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
  // 사망 한 줄: 올라감(계단·선로·열차 어디서든) · 재가 됨(계단 그림인데 status dead) · 물 · 그 밖
  function deathLine(kind) {
    if (person('you').status === 'ascended') return '당신 신발만 가지런히 남았다.';
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
      const head = rd ? `${josa(nameOf(rd.id), '이가')} 당신 주머니에서 수첩을 꺼내 읽는다.` : '수첩은 승강장 바닥에 남았다. 아무도 줍지 않았다.';
      await UI.open(`<p class="who">${esc(head)}</p>${ledgerMini(rows)}`, { kind: 'death_ledger', options: [{ label: '덮는다', value: true }] });
    } else {
      // 결말: 명부 한 장
      const why = { all_dead: '아무도 남지 않았다.', train: '열흘이 지났다.' }[e.why] || '';
      const rid = Object.prototype.hasOwnProperty.call(e, 'readerId') ? e.readerId : (e.reader === 'resident' ? (pickResident() || {}).id || null : e.reader);
      const reader = rid === 'conductor' ? '차장이 명부를 읽는다.' : rid === 'you' ? '당신이 명부를 읽는다.' : rid && person(rid) ? `${josa(nameOf(rid), '이가')} 수첩을 주워 읽는다.` : '아무도 읽지 않는다.';
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
    const tnow = performance.now();
    const blink = (k) => (blinkAt[k] && tnow - blinkAt[k] < BLINK_MS ? ` blink" style="--bd:-${Math.round(tnow - blinkAt[k])}ms` : '');
    const it = (k) => (v.world[k] == null ? '' : `<div class="it ${(v.world[k] || 0) <= RES_LOW[k] ? 'low' : ''}${blink(k)}">${ic(k)}<b>${v.world[k] || 0}</b><span>${resName(k)}</span></div>`);
    const PH = { trace: '아침 — 흔적', ration: '아침 — 배식', seat: '아침 — 자리', day: '낮', evening: '저녁', night: '밤', aftermath: '새벽', ended: '끝' };
    // 얼굴이 흐려지는 사람: 판 중에는 역을 떠난 사람 전부, 끝난 뒤에는 죽거나 올라간 사람만 (같이 걸어 나갔거나 탄 사람은 그대로)
    const lost = (id) => { const st = person(id).status; return state.ended ? st === 'dead' || st === 'ascended' : st !== 'home'; };
    const faces = db.peopleOrder.filter((id) => id !== 'you' && shown(id)).map((id) => `<img alt="${esc(nameOf(id))}" title="${esc(nameOf(id))}" class="${lost(id) ? 'gone' : ''}" src="${faceOf(id)}">`).join('');
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
    if (state.day === 0 && state.phase === 'day') return '승강장을 둘러본다 · 화로를 조사하면 저녁';   // D0 저녁·밤은 아래 단계 글 그대로
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
    const p = person(id), nm = nameOf(id);
    const base = p.status === 'ascended' ? '올라갔다' : '밤에 갔다';
    const facts = state.ledger.written.filter((w) => w && w.text && w.text.includes(p.name)).slice(-2).map((w) => w.text);
    const short = (t) => (t.length > 22 ? t.slice(0, 22) + '…' : t);
    const opts = [{ label: base, value: base }].concat(facts.map((t) => ({ label: short(t), value: t }))).concat([{ label: '비워 둔다', value: '__blank' }, { label: '아직', value: null }]);
    const c = await UI.open(`<p class="who">${esc(nm)} — 사인 칸</p><p class="mini">적지 않는 것도 적는 것이다. 한 번 적으면 고칠 수 없다.</p>`, { kind: 'cause', cancel: true, cancelValue: null, options: opts, cls: 'wide' });
    if (c == null) return;
    const sure = await UI.open(`<p class="who">되돌릴 수 없다</p><p>${esc(nm)} — ${c === '__blank' ? '___' : esc(c)}</p>`, { kind: 'confirm2', sel: 1, options: [{ label: '그렇게 적는다', value: true }, { label: '다시 고른다', value: false }] });
    if (!sure) return;
    if (!act({ type: 'writeCause', who: id, line: c === '__blank' ? null : c, quiet: true })) UI.toast('지금은 적을 수 없다 — 아침·저녁·새벽에');
  }
  async function notebook() {
    for (;;) {
      const a = await UI.open('<p class="title">수첩</p><p class="mini">명부 · 사실 줄 · 뒷장</p>', { kind: 'book', cancel: true, cancelValue: null, cls: 'wide', options: [{ label: '명부', value: 'ledger' }, { label: '사실 줄', value: 'facts' }, { label: '뒷장', value: 'log' }, { label: '덮는다', value: null }] });
      if (!a) return;
      if (a === 'ledger') {
        const ids = ['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && shown(id)));   // 당신 줄은 맨 위 · 만난 사람만, 이름은 이름표대로
        const rows = ids.map((id) => { const p = person(id); const st = p.status === 'home' ? '' : p.status; return { id, name: nameOf(id), status: st, day: p.day, cause: Object.prototype.hasOwnProperty.call(state.ledger.causes, id) ? state.ledger.causes[id] : null }; });
        const html = `<p class="who">승객 명부</p><div class="ledger">${rows.map((r) => `<div class="row ${r.status}"><span>${esc(r.name)}</span><span>${r.id === 'you' && !r.status ? '당신 글씨' : r.status ? `${STATUS_KO[r.status] || ''}${rowDay(r) ? ' · ' + rowDay(r) : ''} ${rowCause(r)}` : ''}</span></div>`).join('')}</div>`;
        const open = rows.filter((r) => r.id !== 'you' && (r.status === 'dead' || r.status === 'ascended') && !Object.prototype.hasOwnProperty.call(state.ledger.causes, r.id));
        const ph = db.phases.find((x) => x.id === state.phase);
        const canWrite = !!(ph && ph.actions.includes('writeLedger'));
        const b = await UI.open(html, { kind: 'bookpage', cancel: true, cancelValue: null, cls: open.length ? 'wide' : '', options: open.slice(0, 3).map((r) => ({ label: `${r.name} 사인 칸`, sub: canWrite ? '' : '<small>아침·저녁·새벽에 적는다</small>', disabled: !canWrite, value: 'cause:' + r.id })).concat([{ label: '돌아간다', value: null }]) });
        if (b && String(b).startsWith('cause:')) await writeCauseFlow(String(b).slice(6));
        continue;
      }
      let body = '';
      if (a === 'facts') body = `<p class="who">사실 줄</p><div class="list">${state.ledger.written.filter((w) => w && w.text).length ? state.ledger.written.filter((w) => w && w.text).slice(-7).map((w) => `<p><span class="d">D${w.day}</span>${esc(maskNames(w.text))}</p>`).join('') : '<p class="mini">아직 아무것도 적지 않았다.</p>'}</div>`;
      else body = `<p class="who">뒷장 — 당신이 고른 것</p><div class="list">${state.log.filter((l) => l.kind === 'choice').slice(0, 7).map((l) => `<p><span class="d">D${l.day}</span>${esc(l.text)}</p>`).join('') || '<p class="mini">비어 있다.</p>'}</div>`;
      await UI.open(body, { kind: 'bookpage', cancel: true, cancelValue: null, options: [{ label: '돌아간다', value: null }] });
    }
  }
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }

  function startGame(s) {
    state = s; endShown = false;
    resetBarks(); for (const k of Object.keys(lastTalk)) delete lastTalk[k];
    if (!state.pos.map || !db.maps[state.pos.map]) { setScene('car', db.maps.car.start[0], db.maps.car.start[1]); }
    else {
      setScene(state.pos.map, state.pos.x, state.pos.y);
      if (blocked(scene.px, scene.py, true)) { const st = scene.map.start; scene.px = st[0]; scene.py = st[1]; }   // 저장의 자리가 벽 안(옛 저장·시뮬 저장의 0,0)이면 그 지도의 시작 칸
    }
    hud();
    unstack(); fireStand();
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
      const a = await UI.open('<p class="title" style="text-align:center;letter-spacing:.3em">어두운 역</p><p class="mini" style="text-align:center">묵현역 · 열차까지 열흘 · 18+<br>유혈·시체·살해 묘사가 직접 나옵니다</p>', { kind: 'title', options: opts, cls: 'wide' });
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
    if (dir) {
      held.add(dir);
      if (!e.repeat && scene.moving && scene.moving.t > 0.6) scene.queued = dir;   // 걷는 도중 짧게 누른 방향은 도착하면 한 번 걷는다
      e.preventDefault();
    } else if (ok) { interact(); e.preventDefault(); } else if (back) { if (!busy) flow(pauseMenu); e.preventDefault(); }
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

  // ── 배율·화면 갱신 ──
  // 논리 화면 640×320(지도 480×320 + 오른쪽 패널 160)을 정수 배율로 키운다: 1366×768 노트북(창 안 약 650) = 2배, 1920×1080 = 3배
  function fitApp() {
    const W = window.innerWidth || 1280, H = window.innerHeight || 720;
    const k = Math.max(1, Math.floor(Math.min(W / 640, H / 320)));
    $('app').style.transform = `scale(${k})`;
    RENDER.setScale(k);
  }
  window.addEventListener('resize', fitApp);
  // 애니메이션 시계: tick = 33.3ms 마다 1 (불꽃·깜빡임·▾·안개가 모니터 Hz 와 상관없이 같은 빠르기). 움직임은 frameDt(ms)로 간다
  let tick = 0, lastT = 0, lastGoal = null, lastHint = null;
  function overlay() {
    const g = UI.isOpen() || busy ? '' : objective();
    if (g !== lastGoal) { lastGoal = g; $('goal').textContent = g; }
    const tg = !UI.isOpen() && !busy && state ? target() : null;
    const label = UI.isOpen() ? '' : hover ? hover + ' (클릭하면 간다)' : tg ? `Space ${tg.verb || tg.label} — ${tg.name || ''}` : '';   // 'Space 열기 — 구급함' · 'Space 말 걸기 — 헤드램프의 남자' (P0-S6)
    if (label !== lastHint) { lastHint = label; $('hint').textContent = label; }
  }
  function frame() {
    const now = performance.now(); frameDt = lastT ? Math.min(60, now - lastT) : 16; lastT = now; tick = Math.floor(now / 33.3);
    if (!state || !scene.map) return;
    update();
    updateBarks(now); updateBeam(now, frameDt);
    if (AUTO_OPEN_AT_2 && !busy && !UI.isOpen() && !scene.moving) {          // (기본 꺼짐) 만나기 전 사람이 2칸 안이면 말 걸기를 연다
      const s2 = ladderSubjects().find((q) => q.who !== 'shutter' && distTo(q.x, q.y) <= 2);
      if (s2) flow(() => talkTo(s2.who));
    }
    const tg = !UI.isOpen() && !busy ? target() : null;
    const you = person('you');
    RENDER.draw(ctx, cv, scene, state, peopleOnMap(), objectsOnMap(), tick, { now, target: tg && tg.kind !== 'exit' ? tg : null, doorOpen: traceSt('lever') === 'pulled', officeOpen: traceSt('office_door') === 'open', youHurt: you ? you.n.injury || 0 : 0, youReact: scene.map.id === 'station' ? signOf('you') : '', rubble: rubbleCells(),
      knock: bark.live.has('shutter'), shake });
    overlay();
  }

  // ── 봇·플레이스루 (?auto=<지점>, ?fast=1, ?seed=n) — 캡처(v4/tools/shot.py)용. 화면 규칙과 무관 ──
  // 지점: car · morning3 · night3 · night5 · night8 · ending · death · evening5 · reveal · called3 · train · beds
  //   beds = D2 밤 고정 사건이 지나간 뒤의 지도 (잠든 사람이 잠자리 위에 누운 모습 확인용)
  //   night5 = D5 밤 고정 사건(d5_rail_body) · evening5 = D5 저녁 화로 둘레에 앉은 사람과 말하는 창 · night8 = D8 밤 고정 사건(d8_patrol_return/d8_pillow)
  //   called3 = D3 밤 '이름이 불렸다'(d3_called_you) 선택 창 · train = 열차 결말(d10_train) 뒤 명부 한 장
  //   화면 확인용(v4/tools/screen_check.py): tunnel = 터널에서 기철 4칸 앞 · arrive = 승강장에 막 도착한 지도 · eve3 = D3 저녁 화로 앞 지도 · manual = 첫 창에서 봇이 손을 뗀다
  //   (P0-S5) testify = D0 저녁 증언 한 줄(얼굴·진짜 이름) · ration1 = D1 배식 창(안 만난 이름 없음) · shutter1 = D1 낮 셔터 앞(조사 전, 말풍선) · open = 전동차 구급함을 막 연 뒤 지도
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
      called3l: (k) => k === 'line' && pend('d3_called_you'),           // 같은 사건의 첫 줄에서 멈춘다 (연타 검사 — 방향키를 누른 채 선택 창까지 지나가기)
      train: (k) => k === 'ending' && state.ended && state.ended.why === 'd10_train',
      ending: (k) => k === 'ending',
      reveal: (k, info) => k === 'line' && info.opts && info.opts.tag === 'reveal',
      death: (k) => k === 'death_ledger',
      manual: () => true,                                                // 손으로: 첫 창에서 봇이 손을 뗀다 (연타 검사 — v4/tools/screen_check.py space)
      testify: (k, info) => k === 'line' && info.opts && /^testify_/.test(info.opts.tag || ''),
      ration1: (k) => k === 'ration' && state.day === 1,
      open: (k, info) => k === 'line' && info.opts && info.opts.faceCls === 'icon',   // 막 연 구급함의 결과 글 (얼굴 칸 = 찾은 물건 아이콘 80)
    }[target];
    // 지점이 바라는 깃발: 그 깃발을 세우는 선택에 +50 (고정 사건이 걸리는 길)
    const WANT = { called3: ['counted_together'], called3l: ['counted_together'], night8: ['patrol_promised', 'key_you'], train: ['met_dohyeon', 'passage_work', 'passage_half', 'passage_open', 'fare_hoard'] }[target] || [];
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
    if (target === 'car') { UI.setBot(null); report('stop'); return; }
    if (target === 'open') { await use('medkit'); await idle(); UI.setBot(null); report('stop'); return; }
    await use('lever'); await use('notebook_dash'); await goto(21, 3); await idle();
    if (target === 'tunnel') { await goto(12, 2); scene.face = 'right'; UI.setBot(null); report('stop'); return; }
    await use('gicheol'); await goto(29, 2); await idle();
    if (target === 'arrive') { UI.setBot(null); report('stop'); return; }
    await use('soonrye');                                                    // 승강장: 순례에게 걸어가 말을 건다 → pro_platform (P0-S5)
    await use('speaker'); await use('blanket_mari');
    const did = {};
    const once = (k) => (did[k] ? false : (did[k] = true));
    let guard = 0;
    while (!state.ended && !holding && guard++ < 600) {
      await idle();
      if (holding || state.ended) break;
      const ph = state.phase, d = state.day;
      if (once('day' + d)) autoLog.push('[D' + d + ' food' + state.world.food + ' water' + state.world.water + ' hunger' + person('you').n.hunger + ']');
      if (target === 'morning3' && d === 3 && ph === 'trace') { await use('notebook_you'); await goto(13, 12); scene.face = 'up'; UI.setBot(null); report('stop'); return; }
      // 밤 잠자리: 밤 고정 사건이 다 지나간 뒤 지도 — 잠든 사람이 잠자리 위에 누워 있다 (D2 밤)
      if (target === 'beds' && d === 2 && ph === 'night') { await goto(16, 10); scene.face = 'right'; UI.setBot(null); report('stop'); return; }
      if (target === 'eve3' && d === 3 && ph === 'evening') { const [fx, fy] = fireStandCell('station'); if (scene.px !== fx || scene.py !== fy) await goto(fx, fy); scene.face = 'up'; UI.setBot(null); report('stop'); return; }
      if (target === 'night8' && d === 8 && ph === 'night') { await goto(17, 12); scene.face = 'up'; UI.setBot(null); report('stop (D8 밤 고정 사건이 걸리지 않았다)'); return; }
      // 열차 결말: D9 저녁까지 통로가 안 열렸으면 캡처용 지름길(setFlag)로 연다 — 기록에 남긴다
      if (target === 'train' && d === 9 && ph === 'evening' && once('shortcut')) {
        for (const f of ['passage_open', 'fare_hoard']) if (!flagOn(f)) { act({ type: 'setFlag', flag: f, quiet: true }); autoLog.push(`[지름길 ${f}]`); }
      }
      if ((ph === 'day' || ph === 'evening') && once('treat' + ph + d)) await selfTreat();
      // D1 낮: 셔터 두드리는 소리 쪽으로 가서 셔터 틈을 조사한다 → d1_shutter_knock (P0-S5)
      if (ph === 'day' && d === 1 && !flagOn('met_eunji') && once('shutter')) {
        if (target === 'shutter1') { await goto(2, 7); scene.face = 'up'; await until(() => bubbleOf('shutter'), 200); UI.setBot(null); report('stop'); return; }
        await use('shutter_gap'); continue;
      }
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
    hearLog, talkLog, cellLog, openLog, foundLog, bark, nameOf, met, peopleOnMap, objectsOnMap, target, talkTo, objective,
    missing: () => Array.from(missing), setBot: (fn) => { bot = fn; UI.setBot(fn); }, store: () => store, E, UI };
  (async () => {
    try {
      db = await B.loadTables('data/');
      B.setDb(db);
      store = S4.createStore({ db });
      await ART.ready;
      fitApp();
      if (B.fast) $('app').classList.add('fast');
      // 화면 갱신은 모니터 박자(requestAnimationFrame). 숨은 창·헤드리스 캡처에서 rAF 가 멈추면 보조 타이머가 100ms 마다 대신 한 번 부른다
      let lastRaf = 0;
      const loop = () => { lastRaf = performance.now(); frame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      setInterval(() => { if (performance.now() - lastRaf > 100) frame(); }, 100);
      const auto = B.params.get('auto');
      if (auto) await autoRun(auto); else await titleScreen(false);
    } catch (err) {
      console.error(err);
      $('goal').textContent = '시작하지 못했다: ' + (err && err.message ? err.message : err);
    }
  })();
})();
