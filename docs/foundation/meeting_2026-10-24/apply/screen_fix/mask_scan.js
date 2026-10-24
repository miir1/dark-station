// 화면 담당 확인용: 사건 본문·선택지·경고·결과 글에 maskPeople(game.js 와 같은 규칙)을 걸면 어떻게 바뀌나 — 아무도 증언하지 않은 상태 가정
// 쓰기 (C:\dev\dark_station 에서): node docs/foundation/meeting_2026-10-24/apply/screen_fix/mask_scan.js [사건id,...]
'use strict';
const path = require('path');
const V4 = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(V4, 'engine', 'tables.js'));
globalThis.DS4 = { tables: T, engine: require(path.join(V4, 'engine', 'engine.js')) };
require(path.join(V4, 'engine', 'browser.js'));
const B = globalThis.DS4.browser;
const db = T.loadDir(path.join(V4, 'data'));
const PJOSA = { 이가: '이/가', 이: '이/가', 가: '이/가', 이는: '은/는', 은: '은/는', 는: '은/는', 이를: '을/를', 을: '을/를', 를: '을/를', 과: '과/와', 와: '과/와' };
const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lookName = (id) => { const r = db.lines['look_' + id]; return r && r[0] ? r[0].text : ''; };
const lookNoun = (id) => { const w = lookName(id).trim().split(/\s+/); return w[w.length - 1] || '누군가'; };
function mask(t, only) {
  for (const id of db.peopleOrder) {
    const p = db.people[id];
    if (id === 'you' || !p || !p.name || !lookName(id) || !(db.lines['testify_' + id] || []).length) continue;
    if (only && !only.includes(id)) continue;
    const given = p.name.length >= 3 ? p.name.slice(1) : p.name, noun = lookNoun(id);
    const re = new RegExp(`(?<!(?:한|두|세|네|몇|여러|열|[0-9])\\s?)(?:${reEsc(p.name)}|${reEsc(given)})(이가|이는|이를|이|가|은|는|을|를|과|와)?`, 'g');
    t = t.replace(re, (m, j) => (j ? B.fill(`{who:${PJOSA[j]}}`, noun) : noun));
  }
  return t;
}
module.exports = { mask };
if (require.main === module) {
  const want = process.argv[2] ? process.argv[2].split(',') : null;
  let n = 0;
  for (const ev of db.eventsList) {
    if (want && !want.includes(ev.id)) continue;
    const items = [['text', ev.text]];
    ev.choices.forEach((c, i) => {
      items.push(['label' + i, c.label]); if (c.warn) items.push(['warn' + i, c.warn]); if (c.hint) items.push(['hint' + i, c.hint]);
      for (const k of ['out', 'ok', 'fail']) if (c[k] && c[k].text) items.push([k + i, c[k].text]);
    });
    for (const [k, t] of items) { const m = mask(String(t || '')); if (m !== t) { n++; console.log(ev.id, k, '|', t, '\n   =>', m); } }
  }
  console.log('changed', n);
}
