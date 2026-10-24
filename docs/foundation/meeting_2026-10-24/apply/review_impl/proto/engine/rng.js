// 어두운 역 v4 — 시드 난수. 상태 안의 정수 하나(s.rng)만 바꾼다 → 저장·복원해도 같은 결과.
// 브라우저: window.DS4.rng / Node: require('./rng.js')
(function (root) {
  'use strict';

  // mulberry32 변형(v2와 같은 수열). s는 { rng: uint32 } 를 가진 객체.
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => (arr.length ? arr[Math.floor(rand(s) * arr.length)] : undefined);
  // 가중치로 하나 고른다. items: [{weight,...}]
  function pickWeighted(s, items) {
    const total = items.reduce((a, it) => a + Math.max(0, it.weight || 0), 0);
    if (total <= 0) return undefined;
    let r = rand(s) * total;
    for (const it of items) { r -= Math.max(0, it.weight || 0); if (r < 0) return it; }
    return items[items.length - 1];
  }
  const chance = (s, p) => rand(s) < p;

  const API = { rand, pick, pickWeighted, chance };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).rng = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
