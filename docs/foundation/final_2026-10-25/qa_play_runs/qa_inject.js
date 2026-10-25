(() => {
  if (window.__qa) return 'already';
  const g = window.__ds4, UI = g.UI, E = g.E;
  const qa = window.__qa = { log: [], seq: 0, taken: 0 };
  // 관찰용 봇: 창마다 기록만 하고 'hold' (손을 떼고 사람이 키로 넘긴다)
  UI.setBot((kind, info) => {
    const s = g.state;
    qa.seq++;
    const o = info && info.opts ? info.opts : {};
    qa.log.push({ n: qa.seq, kind, tag: o.tag || '', text: info && info.text != null ? String(info.text) : '', black: !!o.black, cls: o.cls || '',
      name: o.name || '', face: o.face || '', faceCls: o.faceCls || '', day: s ? s.day : -1, phase: s ? s.phase : '', pend: s && s.pending ? s.pending.id : '',
      opts: info && info.options ? info.options.map((x) => x.label) : null, t: Date.now(), map: g.scene.map ? g.scene.map.id : '' });
    return 'hold';
  });
  qa.take = () => { const out = qa.log.slice(qa.taken); qa.taken = qa.log.length; return out; };
  const txt = (el) => (el ? el.textContent : '');
  qa.snap = () => {
    const s = g.state, sc = g.scene;
    const box = document.getElementById('box'), fade = document.getElementById('fade'), cg = document.getElementById('cg'), toast = document.getElementById('toast');
    const kind = UI.openKind();
    const opts = box.hidden ? [] : Array.from(box.querySelectorAll('.opt')).map((b) => {
      const ol = b.querySelector('.ol');
      const lab = ol ? Array.from(ol.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') : '';
      return { label: lab, subs: Array.from(b.querySelectorAll('small')).map((x) => [x.className, x.textContent, x.dataset.r || '']), disabled: b.disabled, sel: b.classList.contains('sel') };
    });
    const tw = box.querySelector('.tw'), body = box.querySelector('.body');
    const imgs = cg.hidden ? [] : Array.from(cg.querySelectorAll('img')).map((i) => ({ src: i.getAttribute('src'), cls: i.className, ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, vis: getComputedStyle(i).display !== 'none' }));
    const you = s ? s.people.you : null;
    return {
      kind, boxCls: box.className, boxHidden: box.hidden,
      text: tw ? tw.textContent : body ? body.innerText : '',
      who: txt(box.querySelector('.who')), face: (box.querySelector('img.face') || {}).src || '', faceCls: (box.querySelector('img.face') || {}).className || '',
      more: !!box.querySelector('.more'), blind: txt(box.querySelector('.blind')),
      opts, fade: !fade.hidden, fadeText: fade.hidden ? '' : fade.innerText,
      cg: imgs, cgHidden: cg.hidden, cgPage: !cg.hidden && cg.classList.contains('haspage') ? cg.innerText.slice(0, 800) : '',
      toast: toast.hidden ? '' : toast.textContent, goal: txt(document.getElementById('goal')), hint: txt(document.getElementById('hint')),
      hud: document.getElementById('hud').innerText.replace(/\s+/g, ' '),
      st: s ? { day: s.day, phase: s.phase, ended: s.ended ? s.ended.why : '', you: you.status, pending: s.pending ? s.pending.id : '', seed: s.seed,
        inj: you.n.injury || 0, hunger: you.n.hunger || 0, food: s.world.food, water: s.world.water, fuel: s.world.fuel, meds: s.world.meds, parts: s.world.parts, karma: s.world.karma,
        trip: s.trip ? s.trip.region + s.trip.floor : '', alive: Object.values(s.people).filter((p) => p.id !== 'you' && p.status === 'home').length } : null,
      map: sc.map ? sc.map.id : '', px: sc.px, py: sc.py, face: sc.face, moving: !!sc.moving, auto: !!sc.auto, steps: sc.steps,
      trip: g.trip ? { region: g.trip.region, floor: g.trip.floor, hold: !!g.trip.hold } : null,
      tg: (() => { try { const t = !UI.isOpen() ? g.target() : null; return t ? { kind: t.kind, id: t.id, verb: t.verb, name: t.name } : null; } catch (e) { return null; } })(),
      missing: g.missing(), snd: window.SND ? SND.log.length : -1,
    };
  };
  qa.idle = () => Promise.race([g.idle().then(() => true), new Promise((r) => setTimeout(() => r(false), 120))]);
  // 선택지 평가 (창의 순서 = eventView choices 순서, 열차 결말은 맨 뒤에 '태울 사람' 줄)
  qa.evalChoices = () => {
    const s = g.state, db = g.db; const v = E.eventView(s, db); if (!v) return null;
    const rows = db.events[v.id] ? db.events[v.id].choices : [];
    const meHit = (x) => x && (x.who == null || x.who === 'you' || x.who === 'self');
    return { id: v.id, kind: v.kind, choices: v.choices.map((c, i) => {
      const row = (E.effChoice(s, db, rows[i] || {})) || {};
      const k = (b) => (b && b.effects && typeof b.effects.karma === 'number' ? b.effects.karma : 0);
      const p = c.chance != null ? c.chance / 100 : 1;
      const kd = row.check ? p * k(row.ok) + (1 - p) * k(row.fail) : k(row.out);
      const surv = E.survival ? E.survival(row, c.chance) : 1;
      const out = row.check ? row.ok : row.out; const ef = (out && out.effects) || {};
      const hurt = ef.injure && meHit(ef.injure) ? (ef.injure.n || 1) : 0;
      return { i, label: c.label, locked: !!c.locked, chance: c.chance == null ? null : c.chance, warn: c.warn || '', taboo: !!c.taboo, karma: kd, surv, cost: c.cost || {}, rope: !!row.rope, hurt,
        food: (typeof ef.food === 'number' ? ef.food : 0) + (typeof ef.water === 'number' ? ef.water : 0) };
    }) };
  };
  // 길 찾기 (화면의 막힘 규칙을 흉내): (tx,ty) 옆 칸까지 · 그 칸에서 볼 방향
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  qa.blocked = (x, y) => {
    const sc = g.scene, s = g.state; const row = sc.rows[y]; if (!row) return true; const t = row[x]; if (t == null) return true;
    if ('#tRhDC'.includes(t)) return true;
    const tr = (id) => (s.traces[id] ? s.traces[id].st : (g.db.objects[id] ? g.db.objects[id].states[0] : 'none'));
    if (t === 'k' && tr('office_door') !== 'open') return true;
    if (sc.map.id === 'car' && t === 'E' && tr('lever') !== 'pulled') return true;
    if (sc.map.id === 'tunnel' && x === 17 && tr('rubble') !== 'crossed') return true;
    if (g.objectsOnMap().some((o) => !o.hidden && o.solid && o.x === x && o.y === y)) return true;
    if (g.peopleOnMap().some((p) => p.x === x && p.y === y)) return true;
    return false;
  };
  qa.path = (tx, ty, onto) => {
    const sc = g.scene; const W = sc.w, H = sc.h;
    const goals = new Map();
    if (onto) goals.set(tx + ',' + ty, null);
    else for (const [d, [dx, dy]] of Object.entries(DIRS)) { const ax = tx - dx, ay = ty - dy; if (ax >= 0 && ay >= 0 && ax < W && ay < H && (!qa.blocked(ax, ay) || (ax === sc.px && ay === sc.py))) goals.set(ax + ',' + ay, d); }
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(sc.px, sc.py), null]]); const q = [[sc.px, sc.py]]; let hit = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (goals.has(key(x, y))) { hit = [x, y]; break; }
      for (const [d, [dx, dy]] of Object.entries(DIRS)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue;
        if (qa.blocked(nx, ny) && !(onto && nx === tx && ny === ty)) continue;
        prev.set(k, [x, y, d]); q.push([nx, ny]);
      }
    }
    if (!hit) return null;
    const dirs = []; let c = hit;
    while (true) { const p = prev.get(key(c[0], c[1])); if (!p) break; dirs.unshift(p[2]); c = [p[0], p[1]]; }
    return { dirs, face: onto ? null : goals.get(key(hit[0], hit[1])), at: hit };
  };
  qa.cellXY = (x, y) => { const sc = g.scene, cv = document.getElementById('cv'); if (!sc.cam) return null; const r = cv.getBoundingClientRect(); const px = sc.cam.ox + (x + 0.5) * ART.T, py = sc.cam.oy + (y + 0.5) * ART.T; return [r.left + px / cv.width * r.width, r.top + py / cv.height * r.height]; };
  qa.things = () => ({ objs: g.objectsOnMap().filter((o) => !o.hidden).map((o) => ({ id: o.id, x: o.x, y: o.y, name: o.name, state: o.state, solid: o.solid, closed: g.isClosed(o.id), late: o.late })),
    people: g.peopleOnMap().map((p) => ({ id: p.id, x: p.x, y: p.y, talkable: p.talkable, name: p.name, mark: p.mark || '' })),
    exits: g.scene.map ? g.scene.map.exits || {} : {} });
  qa.sound = () => { if (!window.SND) return null; const st = SND.status ? SND.status() : null; const h = {}; for (const e of SND.log) { const k = e.kind + (e.played === false ? ':no' : '') + (e.why ? ':' + e.why : ''); h[k] = (h[k] || 0) + 1; } return { status: st, n: SND.log.length, hist: h, last: SND.log.slice(-8) }; };
  return 'ok';
})()
