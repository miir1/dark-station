// 시제품 엔진 패치 (스크래치 사본만). node patch_engine.js <proto/engine>
const fs = require('fs'); const path = require('path');
const dir = process.argv[2];
const rep = (file, a, b) => { const p = path.join(dir, file); const t = fs.readFileSync(p, 'utf8'); if (!t.includes(a)) throw new Error('anchor not found in ' + file + ': ' + a.slice(0, 60)); fs.writeFileSync(p, t.replace(a, b)); };

// 1) req.cond + req.why
rep('engine.js', "if (c.req.flag && !s.flags[c.req.flag]) locked.push('조건이 맞지 않다');",
  "if (c.req.flag && !s.flags[c.req.flag]) locked.push(c.req.why || '조건이 맞지 않다');\n      if (c.req.cond) { let okc = false; try { okc = C.test(c.req.cond, phaseCtx(s)); } catch (e) { okc = false; } if (!okc) locked.push(c.req.why || '조건이 맞지 않다'); }");

// 2) 방치(neglect) 판정: 밤 굴림 첫머리에서 '전날 밤' 사건 중 못 본 것은 missed, 본 것은 caught 를 적용
rep('night.js', 'function rollNight(s, db) {',
  `function applyNeglect(s, db) {
    for (const e of s.nightLog) {
      if (e.judged || e.role === 'clock' || e.role === 'neglect') continue;
      if (e.day !== s.day - 1) { if (e.day < s.day - 1) e.judged = true; continue; }
      e.judged = true;
      const row = db.nightEvents.find((n) => n.id === e.id);
      if (!row) continue;
      const spec = e.discovered ? row.caught : row.missed;
      if (!spec) continue;
      const ok = (id) => !id || id === 'you' ? s.people.you.status === 'home' : s.people[id] && s.people[id].status === 'home';
      if (!ok(e.actor) || (e.target && !ok(e.target))) continue;
      const roles = { actor: e.actor, target: e.target };
      const traceIds = [];
      for (const [o, st] of Object.entries(spec.trace || {})) { const id = FX.fillRole(o, roles); if (FX.setTrace(s, db, id, st, s.day, roles.actor)) traceIds.push(id); }
      const lines = [];
      if (spec.effects) FX.apply(s, db, spec.effects, roles.actor ? roles : { actor: 'world', target: null }, lines);
      s.nightLog.push({ day: s.day, id: e.id + (e.discovered ? '~caught' : '~missed'), kind: row.kind, role: 'neglect', actor: roles.actor, target: roles.target, traces: traceIds, rumor: false, lines, discovered: true });
      s.stats.neglect = (s.stats.neglect || 0) + (e.discovered ? 0 : 1);
    }
  }
  function rollNight(s, db) {
    applyNeglect(s, db);`);
// 3) 누구나 아는 밤(사람이 죽거나 사라짐, 당신이 대상) = 발견
rep('night.js', "s.nightLog.push({ day: s.day, id: n.id, kind: n.kind, role: n.role, actor: roles.actor, target: roles.target, traces: traceIds, rumor: !!rumor, lines, discovered: false });",
  "s.nightLog.push({ day: s.day, id: n.id, kind: n.kind, role: n.role, actor: roles.actor, target: roles.target, traces: traceIds, rumor: !!rumor, lines, discovered: !!(n.public || (n.effects && n.effects.kill)) });");
// 4) 스키마: nightEvents 새 열
rep('schema.js', "trace: { type: 'obj' }, rumor: { type: 'obj' }, effects: { type: 'obj' }, oncePerRun: { type: 'bool01' }, text: { type: 'str' },",
  "trace: { type: 'obj' }, rumor: { type: 'obj' }, effects: { type: 'obj' }, oncePerRun: { type: 'bool01' }, text: { type: 'str' }, missed: { type: 'obj' }, caught: { type: 'obj' }, public: { type: 'bool01' },");
// 5) 로더: missed/caught 의 effects 배열도 객체 꼴로
rep('tables.js', "if (blank(n.rumor) || blank(n.rumor.line)) delete n.rumor;",
  "for (const k of ['missed', 'caught']) if (n[k] && Array.isArray(n[k].effects)) n[k].effects = effectsToObject(n[k].effects, `nightEvents[${i}] ${n.id}.${k}`); if (blank(n.rumor) || blank(n.rumor.line)) delete n.rumor;");
console.log('engine patched');
