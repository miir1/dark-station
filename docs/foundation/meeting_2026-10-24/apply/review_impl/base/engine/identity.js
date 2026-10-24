// 어두운 역 v4 — 숨은 정체. 축 값(정수, 표시 없음)과 정체 결정표로 후보 하나를 고른다.
// 규칙: rule 조건식이 맞는 후보 중 priority 가 가장 높은 것(같으면 표 순서). 아무것도 안 맞으면 fallback=1 인 후보.
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cond.js') : root.DS4.cond;

  // axes: { share: -2, hand: 3, name: 0 }   table: { axes:[...], candidates:[...] }
  function identity(axes, table) {
    const ctx = {};
    for (const a of table.axes) ctx[a] = Number(axes && axes[a]) || 0;
    let best = null;
    for (const c of table.candidates) {
      if (!C.test(c.rule, ctx)) continue;
      if (!best || c.priority > best.priority) best = c;
    }
    if (!best) best = table.candidates.find((c) => c.fallback === 1 || c.fallback === true) || null;
    return best;
  }
  // 축을 움직인다 (−9~+9 로 잘라 둔다)
  function nudge(axes, delta) {
    for (const [k, v] of Object.entries(delta || {})) axes[k] = Math.max(-9, Math.min(9, (axes[k] || 0) + v));
    return axes;
  }
  // 중간 신호용: 지금 기울어진 후보 (결말 전엔 화면에 글자로 안 나오고 호칭·꿈 고르기에만 쓴다)
  const lean = (axes, table) => { const c = identity(axes, table); return c ? c.id : null; };

  const API = { identity, nudge, lean };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).identity = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
