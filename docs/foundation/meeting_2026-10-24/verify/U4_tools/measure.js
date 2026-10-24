(() => {
  const D = window.__ds4, db = D.db, st = D.state, sc0 = D.scene, T = 32;
  const litMap = (m) => Object.assign({}, m, { dark: 0.0001 });
  const mkScene = (m, px, py) => ({ map: m, rows: m.rows, w: m.rows[0].length, h: m.rows.length, px, py, face: 'down', moving: null, walkDist: 0, steps: 0 });
  function render(m, objs, px, py, lit) {
    const mm = lit ? litMap(m) : m;
    const sc = mkScene(mm, px, py);
    const cv = document.createElement('canvas'); cv.width = sc.w * T + 64; cv.height = sc.h * T + 64;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    RENDER.draw(ctx, cv, sc, st, [], objs, 0, { now: 0 });
    return { cv, data: ctx.getImageData(0, 0, cv.width, cv.height).data, W: cv.width, H: cv.height, ox: sc.cam.ox, oy: sc.cam.oy };
  }
  function diff(a, b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
        const p = i / 4, x = p % a.W, y = (p / a.W) | 0; n++;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
    }
    return n ? { x0: x0 - a.ox, y0: y0 - a.oy, x1: x1 - a.ox, y1: y1 - a.oy, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
  }
  // objects of a map as the game builds them (swap scene.map for one synchronous call)
  function objsOf(mapId) {
    const save = { map: sc0.map, rows: sc0.rows, w: sc0.w, h: sc0.h };
    const m = db.maps[mapId];
    sc0.map = m; sc0.rows = m.rows; sc0.w = m.rows[0].length; sc0.h = m.rows.length;
    let out;
    try { out = D.objectsOnMap(); } finally { Object.assign(sc0, save); }
    return out;
  }
  const res = { maps: {}, player: null };
  // player height: station, open floor (5,6) vs off map
  {
    const m = db.maps.station;
    const a = render(m, [], 5, 6, true), b = render(m, [], -4, -4, true);
    res.player = diff(a, b);
  }
  for (const mapId of Object.keys(db.maps)) {
    const m = db.maps[mapId];
    const objs = objsOf(mapId);
    const vis = objs.map((o) => Object.assign({}, o, { hidden: false }));     // force visible for size measurement
    const empty = render(m, [], -4, -4, true);
    const list = [];
    vis.forEach((o, k) => {
      const d = diff(render(m, [o], -4, -4, true), empty);   // that object alone vs empty map (no slot shifting)
      const tb = RENDER.V4P[o.id] || RENDER.V4P[String(o.id).split('_')[0]] || null;
      list.push({ id: o.id, name: o.name, x: o.x, y: o.y, tile: m.rows[o.y][o.x], state: o.state, solid: o.solid, hiddenD0: objs[k].hidden,
        v4name: tb ? (tb[o.state] !== undefined ? tb[o.state] : tb._) : null, hand: RENDER.HAND.test(o.id), prop: RENDER.propFor(o.id), bbox: d,
        inCell: d ? { dx0: d.x0 - o.x * T, dy0: d.y0 - o.y * T, dx1: d.x1 - o.x * T, dy1: d.y1 - o.y * T } : null });
    });
    // boards: real lighting (as at D0) and lit
    const realD0 = render(m, objs, m.start[0], m.start[1], false);
    const litD0 = render(m, objs, -4, -4, true);
    res.maps[mapId] = { objects: list, boardLit: litD0.cv.toDataURL('image/png'), boardReal: realD0.cv.toDataURL('image/png'), ox: litD0.ox, oy: litD0.oy };
  }
  return res;
})()
