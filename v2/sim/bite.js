// 위협이 실제로 결과를 바꾸는가: 배수·경계를 금지한 봇, 위협 대응을 안 하는 봇과 비교. node sim/bite.js [판수]
const E = require('../engine.js');
const bots = require('./bots.js');
const D = E.D;
const N = +(process.argv[2] || 300);
const score = { safe: 3, half: 2, thin: 1, missed: 0, wiped: 0 };
function run(name, mod) {
  const orig = E.suggestPlan; const origDispatch = E.dispatch;
  if (mod) E.suggestPlan = (s) => { const p = orig(s); return mod(p, s); };
  let sum = 0, deaths = 0, breaks = 0, patrols = 0, stops = 0, thieves = 0;
  for (let seed = 1; seed <= N; seed++) {
    const { s } = bots.play(seed, name);
    sum += score[s.ending.tier]; deaths += s.stats.deaths;
    for (const h of s.history) { if (h.text.includes('수위 경보')) breaks++; if (h.text.includes('순찰대 방문')) patrols++; if (h.text.includes('창고를 뒤지는')) thieves++; }
  }
  E.suggestPlan = orig; E.dispatch = origDispatch;
  return { score: (sum / N).toFixed(2), deaths: (deaths / N).toFixed(2), breaks: (breaks / N).toFixed(2), patrols: (patrols / N).toFixed(2), thieves: (thieves / N).toFixed(2) };
}
const ban = (tasks) => (p) => { for (const k of Object.keys(p)) if (tasks.includes(p[k])) p[k] = 'rest'; return p; };
console.log('기준       ', JSON.stringify(run('balanced')));
console.log('배수 금지  ', JSON.stringify(run('balanced', ban(['drain']))));
console.log('경계 금지  ', JSON.stringify(run('balanced', ban(['guard']))));
console.log('치료 금지  ', JSON.stringify(run('balanced', ban(['tend']))));
console.log('배수·경계 금지', JSON.stringify(run('balanced', ban(['drain', 'guard']))));
