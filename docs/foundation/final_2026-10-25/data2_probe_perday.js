// read-only: node data2_probe_perday.js [dataDir] [n] — 되풀이 사건이 하루에 두 번 이상 뜨는 일이 있나(같은 날 다른 단계), 고른 뒤 조건이 그대로 참인 일이 있나
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const C = require(path.join(ROOT, 'v4/engine/cond.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const dir = process.argv[2] || path.join(ROOT, 'v4/data'); const N = +(process.argv[3] || 100);
const db = T.loadDir(dir);
const base = (id) => id.replace(/_(d[36]|r\d)$/, '');
const WATCH = new Set(['starve_you', 'fever_night', 'wound_critical', 'dawn_strike', 'dawn_mob', 'called_up']);
const orig = E.dispatch;
let log = [];
E.dispatch = function (s, a) {
  const pend = a && a.type === 'choose' && s.pending ? s.pending.id : null;
  const ph = s.phase, day = s.day;
  const r = orig.apply(this, arguments);
  if (pend && WATCH.has(base(pend))) {
    // 고른 뒤 같은 단계에서 그 사건(원래 조건)이 다시 참인가
    const ev = db.events[base(pend)];
    let again = false; try { again = s.phase === ph && s.day === day && C.test(ev.when, Object.assign({}, s.world, { day: s.day, flags: s.flags, phase: s.phase, fired: s.fired, trace: Object.fromEntries(Object.entries(s.traces).map(([k, t]) => [k, t.st])) }, s.people.you.n, Object.fromEntries(Object.values(s.people).flatMap((p) => Object.entries(p.n).map(([k, v]) => [`${k}_${p.id}`, v]))), { alive: Object.fromEntries(Object.values(s.people).map((p) => [p.id, p.status === 'home' || p.status === 'away' ? 1 : 0])) })); } catch (e) { again = 'err'; }
    log.push({ id: base(pend), day, ph, again });
  }
  return r;
};
const pols = ['balanced', 'risky', 'selfish_nb', 'lazy', 'h_cautious', 'counter', 'child'];
const out = {};
for (const pol of pols) for (let seed = 1; seed <= N; seed++) {
  log = [];
  play(db, seed, pol);
  const perDay = {};
  for (const x of log) { const k = x.id + '@' + x.day; perDay[k] = (perDay[k] || []).concat(x.ph); const o = out[x.id] = out[x.id] || { fires: 0, again: 0, twiceDay: 0, phases: {} }; o.fires++; if (x.again === true) o.again++; o.phases[x.ph] = (o.phases[x.ph] || 0) + 1; }
  for (const [k, phs] of Object.entries(perDay)) if (phs.length > 1) out[k.split('@')[0]].twiceDay++;
}
console.log(`데이터 ${path.relative(ROOT, dir) || dir} · ${pols.join(',')} × ${N}판`);
console.log('사건 | 고른 횟수 | 고른 뒤 같은 단계에서 조건이 또 참 | 같은 날 두 번 이상 뜬 (판·날) | 단계별');
for (const [id, o] of Object.entries(out)) console.log(`${id} | ${o.fires} | ${o.again} | ${o.twiceDay} | ${JSON.stringify(o.phases)}`);
