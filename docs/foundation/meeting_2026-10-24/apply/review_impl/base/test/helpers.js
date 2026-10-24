// 테스트 공용: 픽스처 표 읽기, 깊은 복사, 자동 진행
const path = require('path');
const fs = require('fs');
const T = require('../engine/tables.js');
const E = require('../engine/engine.js');

const FIX = path.join(__dirname, 'fixtures');
function rawTables() {
  const t = {};
  for (const [k, f] of Object.entries(T.FILES)) t[k] = JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
  return t;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const loadFixtures = () => T.loadDir(FIX);

// 선택지는 pick(i) 규칙으로, 그 밖엔 next. 끝나거나 maxSteps 까지.
function autoplay(s, db, pick, maxSteps) {
  pick = pick || (() => 0);
  let guard = 0;
  const trace = [];
  while (!s.ended && guard++ < (maxSteps || 500)) {
    let r;
    if (s.pending) { const v = E.eventView(s, db); const i = pick(v, s); r = E.dispatch(s, { type: 'choose', i }, db); if (!r.ok) r = E.dispatch(s, { type: 'choose', i: v.choices.findIndex((c) => !c.locked) }, db); }
    else r = E.dispatch(s, { type: 'next' }, db);
    trace.push(r.ok);
    if (!r.ok) throw new Error('진행 실패: ' + r.error);
  }
  return s;
}

module.exports = { FIX, rawTables, clone, loadFixtures, autoplay, T, E };
