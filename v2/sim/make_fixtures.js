// 화면 점검용 상태 파일 생성: node sim/make_fixtures.js  → v2/fixtures/*.json (개발 전용)
const fs = require('fs'); const path = require('path');
const E = require('../engine.js');
const { play } = require('./bots.js');
const out = path.join(__dirname, '..', 'fixtures');
const want = {
  prologue: (s) => s.phase === 'prologue' && s.pro === 1 && !s.proResult,
  prologue_result: (s) => s.phase === 'prologue' && s.proResult && s.pro === 2,
  morning1: (s) => s.phase === 'morning' && s.day === 1,
  morning_mid: (s) => s.phase === 'morning' && s.day === 5 && s.project,
  morning_injured: (s) => s.phase === 'morning' && s.day >= 4 && s.residents.some((r) => r.injury >= 2),
  exp_event: (s) => s.phase === 'expedition' && s.exp.phase === 'event' && s.exp.steps === 0 && s.exp.region === 'A',
  exp_result: (s) => s.phase === 'expedition' && s.exp.phase === 'result' && s.exp.steps === 1,
  evening_promise: (s) => s.phase === 'evening' && s.evening && s.evening.type === 'promise',
  evening_talk: (s) => s.phase === 'evening' && s.evening && s.evening.type === 'talk',
  night_event: (s) => s.phase === 'nightEvent' && !s.nightEv.result && s.nightEv.id === 'patrol',
  night_event2: (s) => s.phase === 'nightEvent' && !s.nightEv.result && s.nightEv.id !== 'patrol',
  boarding: (s) => s.phase === 'boarding' && s.boarding.cap > 0,
  ended: (s) => s.phase === 'ended' && s.ending.tier === 'safe',
  ended_missed: (s) => s.phase === 'ended' && s.ending.tier === 'missed',
};
const got = new Set();
const orig = E.dispatch;
E.dispatch = (s, a) => { const r = orig(s, a); for (const [k, f] of Object.entries(want)) if (!got.has(k) && f(s)) { got.add(k); fs.writeFileSync(path.join(out, k + '.json'), JSON.stringify(s)); } return r; };
for (let seed = 1; seed <= 400 && got.size < Object.keys(want).length; seed++) play(seed, ['balanced', 'rush', 'nofacility', 'clinic'][seed % 4]);
E.dispatch = orig;
console.log('생성', [...got].join(', '), '/ 누락', Object.keys(want).filter((k) => !got.has(k)).join(', ') || '없음');
