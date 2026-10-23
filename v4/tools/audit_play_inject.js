// 어두운 역 v4 — 검수(2026-10-24 audit_play) 전용 주입 스크립트. 게임 코드와 무관. audit_driver.py 의 /inject 로 페이지보다 먼저 넣는다.
// 1) UI.setBot 을 감싸 봇이 본 모든 창(글·선택지)을 window.__audit.log 에 남긴다 (한 판 글 기록 = audit_shots/c00_run_seed7_textlog.txt)
(() => {
  window.__audit = { log: [], holdIf: null, held: null, n: 0 };
  let _ui = null;
  const ctx = () => { const d = window.__ds4; const s = d && d.state; return s ? { d: s.day, ph: s.phase, ev: s.pending ? s.pending.id : '', map: d.scene.map && d.scene.map.id } : {}; };
  Object.defineProperty(window, 'UI', { configurable: true, get() { return _ui; }, set(v) {
    _ui = v;
    const origSetBot = v.setBot;
    v.setBot = (fn) => origSetBot(fn ? (kind, info) => {
      const A = window.__audit; A.n++;
      const box = document.getElementById('box');
      const e = Object.assign({ k: kind, t: (box && !box.hidden ? box.innerText.replace(/\s*\n+\s*/g, ' / ') : (info && info.text) || '') }, ctx());
      if (kind === 'line' && info && info.opts && info.opts.name) e.who = info.opts.name;
      A.log.push(e);
      if (A.holdIf && A.holdIf(kind, info, e)) { A.held = e; return 'hold'; }
      return fn(kind, info);
    } : null);
  } });
})();
// 2) ?auditmap=<지도 id> 면 그 지도의 첫 글 창에서 멈춘다(원정 지도 캡처용)
(() => { const want = (new URLSearchParams(location.search)).get('auditmap'); if (want) { const t = setInterval(() => { if (window.__audit) { window.__audit.holdIf = (k, info, e) => e.map === want && k === 'line'; clearInterval(t); } }, 5); } })();
// 3) 걷기 프레임 기록기 (페이지가 뜬 뒤 /eval 로 넣는다): RENDER.draw 를 감싸 프레임마다 시각·위치를 남긴다
/*
(() => {
  if (window.__rec) return 'already';
  const R = window.RENDER, orig = R.draw;
  window.__rec = { on: false, frames: [], times: [] };
  R.draw = function (ctx, cv, sc) {
    const r = orig.apply(this, arguments);
    const rec = window.__rec;
    if (rec.on) {
      const mx = sc.moving ? sc.px - sc.moving.dx * (1 - sc.moving.t) : sc.px;
      const my = sc.moving ? sc.py - sc.moving.dy * (1 - sc.moving.t) : sc.py;
      rec.times.push({ t: performance.now(), mx: +mx.toFixed(3), my: +my.toFixed(3), mv: !!sc.moving, mt: sc.moving ? +sc.moving.t.toFixed(3) : null, ox: sc.cam && sc.cam.ox, oy: sc.cam && sc.cam.oy });
      if (rec.grab && rec.frames.length < rec.grab) rec.frames.push(cv.toDataURL());
    }
    return r;
  };
  return 'installed';
})()
*/
