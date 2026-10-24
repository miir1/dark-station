// verify_A2: D2~D6 위기에서 정책별로 무엇을 골랐고 몇 판이 죽었나 (봇 4블록 800판). 표·엔진은 읽기만.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(ROOT, 'engine', 'tables.js'));
const E = require(path.join(ROOT, 'engine', 'engine.js'));
const BOTS = require(path.join(ROOT, 'sim', 'bots.js'));
const db = T.loadDir(path.join(ROOT, 'data'));
const pols = (process.argv[2] || 'balanced,devoted,risky,h_cautious2,h_cautious,h_first').split(',');
const WATCH = new Set(['d2_shutter_arm', 'trial_d4_gicheol', 'd4_spanner', 'd5_flood', 'd6_shutter', 'd6_shutter_b', 'd3_called_you', 'trial_d3_count', 'trial_d3_count_b', 'trial_d3_count_c', 'd2_night_shutter', 'fever_night', 'starve_you']);
const blocks = [1, 1001, 2001, 3001], N = 200;
const orig = E.dispatch;
let cur = null;
E.dispatch = function (s, a, d) {
  const pend = s.pending ? s.pending.id : null;
  const day = s.day;
  const r = orig.call(this, s, a, d);
  if (a && a.type === 'choose' && pend && WATCH.has(pend) && cur && s.lastResult && s.lastResult.event === pend) {
    const key = `D${day} ${pend} → ${s.lastResult.choice}${s.lastResult.roll ? (s.lastResult.roll.success ? ' [성공]' : ' [실패]') : ''}${s.people.you.status !== 'home' ? ' ✝' : ''}`;
    cur[key] = (cur[key] || 0) + 1;
  }
  return r;
};
const out = {};
for (const p of pols) {
  cur = {}; let runs = 0, deadByDay = {};
  for (const b0 of blocks) for (let seed = b0; seed < b0 + N; seed++) {
    const { s } = BOTS.play(db, seed, p); runs++;
    if (s.people.you.status === 'dead' || s.people.you.status === 'ascended') { const c = s.ended && s.ended.cause; const k = `D${s.people.you.died || s.day} ${(c && c.event) || '?'}`; deadByDay[k] = (deadByDay[k] || 0) + 1; }
  }
  out[p] = { runs, picks: cur, deaths: deadByDay };
  console.log('###', p, runs);
  for (const [k, v] of Object.entries(cur).sort()) console.log('  ', k, v);
  console.log('  deaths(D≤6):', Object.entries(deadByDay).filter(([k]) => +k.split(' ')[0].slice(1) <= 6).sort().map(([k, v]) => k + ' ' + v).join(' · '));
}
require('fs').writeFileSync(path.join(__dirname, 'picks_early_' + pols.join('_') + '.json'), JSON.stringify(out, null, 1));
