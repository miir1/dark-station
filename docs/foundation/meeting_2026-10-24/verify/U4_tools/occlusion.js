(() => {
  const D = window.__ds4, db = D.db, st = D.state, sc0 = D.scene, T = 32;
  function render(m, objs, px, py, face) {
    const sc = { map: Object.assign({}, m, { dark: 0.0001 }), rows: m.rows, w: m.rows[0].length, h: m.rows.length, px, py, face, moving: null, walkDist: 0, steps: 0 };
    const cv = document.createElement('canvas'); cv.width = sc.w * T + 64; cv.height = sc.h * T + 64;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    RENDER.draw(ctx, cv, sc, st, [], objs, 0, { now: 0 });
    return { data: ctx.getImageData(0, 0, cv.width, cv.height).data, W: cv.width, ox: sc.cam.ox, oy: sc.cam.oy };
  }
  function objsOf(mapId) {
    const save = { map: sc0.map, rows: sc0.rows, w: sc0.w, h: sc0.h };
    const m = db.maps[mapId];
    sc0.map = m; sc0.rows = m.rows; sc0.w = m.rows[0].length; sc0.h = m.rows.length;
    let out; try { out = D.objectsOnMap(); } finally { Object.assign(sc0, save); }
    return out;
  }
  const withState = (o, s) => { const d = db.objects[o.id]; return Object.assign({}, o, { state: s, stateName: s, overlay: d.overlay && d.overlay[s] ? d.overlay[s] : null, hidden: false }); };
  const mask = (a, b) => { const s = new Set(); for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) s.add(i); return s; };
  // [map, id, closed state, open state, stand cell, face]
  const CASES = [['car', 'medkit', 'closed', 'open', [19, 2], 'up'], ['car', 'lever', 'up', 'pulled', [20, 2], 'up'], ['tunnel', 'shelter_box', 'closed', 'open', [14, 1], 'up'],
    ['station', 'crate_food', 'closed', 'open', [8, 3], 'up'], ['car', 'bag', 'closed', 'open', [10, 3], 'down']];
  const out = [];
  for (const [mapId, id, cs, os, [sx, sy], face] of CASES) {
    const m = db.maps[mapId], base = objsOf(mapId).find((o) => o.id === id);
    const C = withState(base, cs), O = withState(base, os);
    // without player (player off-map)
    const e0 = render(m, [], -4, -4, face), c0 = render(m, [C], -4, -4, face), o0 = render(m, [O], -4, -4, face);
    const closedPx = mask(c0, e0).size, openChange = mask(c0, o0).size;
    // with player standing at the opening cell
    const e1 = render(m, [], sx, sy, face), c1 = render(m, [C], sx, sy, face), o1 = render(m, [O], sx, sy, face);
    const closedVis = mask(c1, e1).size, openChangeVis = mask(c1, o1).size;
    out.push({ map: mapId, id, stand: [sx, sy], face, closedPx, closedVisibleWithPlayer: closedVis, closedVisiblePct: Math.round(100 * closedVis / closedPx),
      openChangePx: openChange, openChangeVisibleWithPlayer: openChangeVis, openChangeVisiblePct: Math.round(100 * openChangeVis / openChange) });
  }
  return out;
})()
