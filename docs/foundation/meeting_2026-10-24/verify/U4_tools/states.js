(() => {
  const D = window.__ds4, db = D.db, st = D.state, sc0 = D.scene, T = 32;
  const mkScene = (m, px, py) => ({ map: m, rows: m.rows, w: m.rows[0].length, h: m.rows.length, px, py, face: 'down', moving: null, walkDist: 0, steps: 0 });
  function render(m, objs) {
    const sc = mkScene(Object.assign({}, m, { dark: 0.0001 }), -4, -4);
    const cv = document.createElement('canvas'); cv.width = sc.w * T + 64; cv.height = sc.h * T + 64;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    RENDER.draw(ctx, cv, sc, st, [], objs, 0, { now: 0 });
    return { cv, ctx, ox: sc.cam.ox, oy: sc.cam.oy };
  }
  function objsOf(mapId) {
    const save = { map: sc0.map, rows: sc0.rows, w: sc0.w, h: sc0.h };
    const m = db.maps[mapId];
    sc0.map = m; sc0.rows = m.rows; sc0.w = m.rows[0].length; sc0.h = m.rows.length;
    let out; try { out = D.objectsOnMap(); } finally { Object.assign(sc0, save); }
    return out;
  }
  const withState = (o, s) => { const d = db.objects[o.id]; return Object.assign({}, o, { state: s, stateName: s, overlay: d.overlay && d.overlay[s] ? d.overlay[s] : null, hidden: false }); };
  // crop: the object's cell plus one cell up (tall props) and one each side
  function crop(r, o) {
    const x = r.ox + (o.x - 1) * T, y = r.oy + (o.y - 1) * T, w = 3 * T, h = 2 * T;
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(r.cv, x, y, w, h, 0, 0, w, h);
    return { c, data: c.getContext('2d').getImageData(0, 0, w, h).data };
  }
  const ndiff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
  const out = { items: [], sameCrates: null };
  const CONT = [['station', 'crate_food'], ['station', 'parts_crate'], ['car', 'medkit'], ['car', 'bag'], ['car', 'lever'], ['tunnel', 'shelter_box'], ['mall_a1', 'phonebooth'], ['station', 'office_door'], ['car', 'notebook_dash']];
  const strips = [];
  for (const [mapId, id] of CONT) {
    const m = db.maps[mapId];
    const base = objsOf(mapId).find((o) => o.id === id);
    const states = db.objects[id].states;
    const crops = states.map((s) => ({ s, cr: crop(render(m, [withState(base, s)]), base) }));
    const empty = crop(render(m, []), base);
    const rec = { map: mapId, id, name: base.name, states: {} };
    crops.forEach(({ s, cr }) => { rec.states[s] = { vsFirst: ndiff(cr.data, crops[0].cr.data), vsEmpty: ndiff(cr.data, empty.data) }; });
    out.items.push(rec);
    strips.push({ label: `${mapId}:${id}`, crops });
  }
  // crate_food vs parts_crate: same sprite? (draw both alone at the same cell)
  {
    const m = db.maps.station, os = objsOf('station');
    const a = os.find((o) => o.id === 'crate_food'), b = Object.assign({}, os.find((o) => o.id === 'parts_crate'), { x: a.x, y: a.y });
    out.sameCrates = ndiff(crop(render(m, [a]), a).data, crop(render(m, [b]), a).data);
  }
  // compose strip board: each row = one container, columns = its states (3x2 cells each, x2)
  const cols = Math.max(...strips.map((s) => s.crops.length));
  const W = 96, H = 64, LBL = 16;
  const board = document.createElement('canvas'); board.width = cols * (W + 4) + 4; board.height = strips.length * (H + LBL + 4) + 4;
  const g = board.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#111'; g.fillRect(0, 0, board.width, board.height);
  g.font = '10px sans-serif'; g.fillStyle = '#ddd';
  strips.forEach((s, r) => {
    s.crops.forEach(({ s: stn, cr }, c) => {
      const X = 4 + c * (W + 4), Y = 4 + r * (H + LBL + 4);
      g.fillStyle = '#ddd'; g.fillText(`${s.label} · ${stn}`, X, Y + 11);
      g.drawImage(cr.c, X, Y + LBL);
    });
  });
  out.board = board.toDataURL('image/png');
  return out;
})()
