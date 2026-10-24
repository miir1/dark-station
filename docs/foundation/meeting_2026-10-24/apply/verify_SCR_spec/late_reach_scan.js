// 검증용: 시뮬 판에서 아침(trace)마다 '어젯밤 못 본 흔적(late)' 이 생긴 물건 가운데, 당신이 걸어가 조사할 수 없는 자리(잠긴 역무실 안)에 있는 것의 비율.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(ROOT, 'engine', 'tables.js'));
const E = require(path.join(ROOT, 'engine', 'engine.js'));
const BOTS = require(path.join(ROOT, 'sim', 'bots.js'));
const db = T.loadDir(path.join(ROOT, 'data'));
const st = db.maps.station;
const pos = Object.fromEntries(st.objects.map((o) => [o.id, [o.x, o.y]]));
const inOffice = (id) => { const p = pos[id]; return p && p[1] >= 1 && p[1] <= 3 && p[0] >= 5 && p[0] <= 14; };
const cnt = { mornings: 0, lateMornings: 0, lateObjs: 0, lockedOffice: 0, byObj: {} };
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  const ph0 = s.phase, day0 = s.day;
  const r = orig.call(this, s, a, d);
  if (s.phase === 'trace' && (ph0 !== 'trace' || day0 !== s.day)) {
    cnt.mornings++;
    const late = Object.entries(s.traces).filter(([k, t]) => t.late && t.day === s.day - 1 && !t.seen).map(([k]) => k);
    if (late.length) cnt.lateMornings++;
    for (const k of late) {
      cnt.lateObjs++;
      const locked = inOffice(k) && s.traces.office_door && s.traces.office_door.st !== 'open';
      const b = cnt.byObj[k] = cnt.byObj[k] || { n: 0, lockedOffice: 0 };
      b.n++; if (locked) { b.lockedOffice++; cnt.lockedOffice++; }
    }
  }
  return r;
};
for (const pol of ['balanced', 'lazy', 'diligent', 'selfish']) for (let seed = 1; seed <= 50; seed++) { try { BOTS.play(db, seed, pol); } catch (e) {} }
E.dispatch = orig;
console.log(JSON.stringify({ office: Object.keys(pos).filter(inOffice), ...cnt }, null, 1));
