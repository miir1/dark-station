// 검증용: 시뮬 봇 판에서 사건이 걸릴 때마다(본문·선택지·경고) + 결과 글에, 아직 만나지 않았거나 '오늘 만나 아직 저녁 전'인 사람의 진짜 이름이 들어 있는가.
// 화면은 사건 본문·결과 글을 이름표로 바꾸지 않고 그대로 보인다(game.js showEvent → UI.lines(v.text)). 표·엔진은 읽기만 한다.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(ROOT, 'engine', 'tables.js'));
const E = require(path.join(ROOT, 'engine', 'engine.js'));
const BOTS = require(path.join(ROOT, 'sim', 'bots.js'));
const db = T.loadDir(path.join(ROOT, 'data'));
const people = Object.entries(db.people).filter(([id, p]) => id !== 'you' && (db.lines['testify_' + id] || []).length && (db.lines['look_' + id] || []).length);
const PHASE_ORDER = (db.phases || []).map((p) => p.id);
const hits = {};
let checks = 0;
function secretNow(s) {
  const out = [];
  for (const [id] of people) {
    const p = s.people[id]; if (!p) continue;
    const f = db.people[id].metFlag;
    const met = !f || f === '-' || s.flags[f] === true;
    const md = s.__metDay && s.__metDay[id];
    const before = !met ? 'unmet' : (md === s.day && PHASE_ORDER.indexOf(s.phase) < PHASE_ORDER.indexOf('evening')) ? 'met-today-before-evening' : null;
    if (before) { out.push([id, p.name, before]); if (p.name.length >= 3) out.push([id, p.name.slice(1), before]); }
  }
  return out;
}
const re = (n) => new RegExp('(?<!(?:한|두|세|네|몇|여러|열|[0-9])\s?)' + n);
function scan(s, where, evId, text) {
  if (!text) return; checks++;
  for (const [id, n, why] of secretNow(s)) if (re(n).test(text)) { const k = `${where}|${evId}|${id}|${why}`; (hits[k] = hits[k] || { where, ev: evId, id, why, n, count: 0, day: s.day, phase: s.phase, text: text.slice(0, 120) }).count++; }
}
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  if (!s.__metDay) Object.defineProperty(s, '__metDay', { value: {}, enumerable: false, writable: true });
  const pendBefore = s.pending ? s.pending.id : null;
  const r = orig.call(this, s, a, d);
  for (const [id] of people) { const f = db.people[id].metFlag; if (f && s.flags[f] === true && s.__metDay[id] == null) s.__metDay[id] = s.day; }
  if (s.pending && s.pending.id !== pendBefore) {
    const v = E.eventView(s, d);
    if (v) { scan(s, 'event_text', v.id, v.text); for (const c of v.choices) { scan(s, 'choice', v.id, c.label); scan(s, 'warn', v.id, c.warn || ''); scan(s, 'lock', v.id, c.reason || ''); } }
  }
  if (a.type === 'choose' && s.lastResult && s.lastResult.text) scan(s, 'result_text', s.lastResult.event, s.lastResult.text);
  return r;
};
const pols = (process.argv[2] || 'balanced,risky,diligent,lazy,selfish,devoted').split(',');
const seeds = Number(process.argv[3]) || 60;
for (const pol of pols) for (let seed = 1; seed <= seeds; seed++) { try { BOTS.play(db, seed, pol); } catch (e) { } }
E.dispatch = orig;
const rows = Object.values(hits).sort((a, b) => b.count - a.count);
console.log(JSON.stringify({ checks, policies: pols, seeds, distinct: rows.length, rows }, null, 1));
