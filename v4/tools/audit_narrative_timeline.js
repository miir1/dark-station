// 검수용 (2026-10-24 U2 첫 만남·세계관 전달). 게임 코드는 건드리지 않는다 — 엔진을 읽기만 한다.
// node v4/tools/audit_narrative_timeline.js [seed=7] > docs/foundation/meeting_2026-10-24/audit_shots/narrative_timeline.txt
// 프롤로그(전동차·터널·승강장) → D0 저녁 → D1 → D2 → D3 밤까지, '죽지 않는 첫 선택'으로 걸어가며
//   ① 어느 사건이 저절로 열렸나(AUTO = 지도에 들어서거나 단계가 바뀌자마자) / 조사·말 걸기로 열렸나(ACT)
//   ② 그 단계에 말을 걸면 각 사람이 하는 말 (game.js talkTo 와 같은 규칙: 이름_ 으로 시작하는 줄 중 조건 맞는 '마지막' 줄)
//   ③ 패널(HUD)이 보여 주는 '열차까지 N일'
// 을 시간 순으로 찍는다.
const path = require('path');
const T = require('../engine/tables.js');
const E = require('../engine/engine.js');
const db = T.loadDir(path.join(__dirname, '..', 'data'));
const seed = +(process.argv[2] || 7);
const s = E.newGame(db, seed);
const out = [];
const log = (...a) => out.push(a.join(' '));

// game.js 와 같은 '만난 사람' 깃발 · 잠자리 순서
const MET = { soonrye: 'arrived', mari: 'met_mari', gicheol: 'met_gicheol', eunji: 'met_eunji', dongha: 'met_eunji', seoha: 'met_seoha' };
const ORDER = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari'];
function lineCtx() {
  const ctx = Object.assign({}, s.world, s.axes, { day: s.day });
  ctx.flags = s.flags; ctx.phase = s.phase || ''; ctx.map = s.pos.map || ''; ctx.region = ''; ctx.floor = 0;
  ctx.trace = {}; for (const [id, t] of Object.entries(s.traces)) ctx.trace[id] = t.st;
  ctx.alive = {}; for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' ? 1 : 0; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }
  const c = E.identity(s, db); ctx.identity = c ? c.id : '';
  return ctx;
}
function pick(id, ctx) { const rows = db.lines[id]; if (!rows) return null; const fit = rows.filter((l) => { try { return E.cond.test(l.context, ctx); } catch (e) { return false; } }); return fit.length ? fit[fit.length - 1] : null; }
// talkTo 의 줄 고르기 그대로 (소문 먼저는 생략 — 소문은 밤 사건 뒤에만 생긴다)
function talkLine(id) {
  const ctx = lineCtx();
  let text = '', key = '', all = [];
  for (const k of Object.keys(db.lines).filter((x) => x.startsWith(id + '_'))) { const l = pick(k, ctx); if (l) { text = l.text; key = k; all.push(k); } }
  return { key, text, shadowed: all.slice(0, -1) };
}
const hud = () => `[패널 D${s.day} ${s.phase} · 열차까지 ${Math.max(0, 10 - s.day)}일]`;
const killsMe = (c) => E.killsYou(c);   // 표는 읽을 때 효과를 객체 꼴로 바꾼다 — 엔진의 판정을 그대로 쓴다
function resolve(how) {
  let g = 0;
  while (s.pending && g++ < 10) {
    const v = E.eventView(s, db);
    log(`  ${how} 사건 ${v.id}: ${v.text}`);
    v.choices.forEach((c, i) => log(`      [${i + 1}] ${c.label}${c.warn ? ' (경고: ' + c.warn + ')' : ''}${c.chance != null ? ' ' + c.chance + '%' : ''}${c.locked ? ' (잠김)' : ''}`));
    const rows = db.events[v.id].choices;
    let i = rows.findIndex((c, k) => !v.choices[k].locked && !killsMe(c) && !c.taboo);
    if (i < 0) i = rows.findIndex((c, k) => !v.choices[k].locked);
    E.dispatch(s, { type: 'choose', i }, db);
    const r = s.lastResult || {};
    log(`      → 고름 [${i + 1}] 결과: ${r.text || ''}`);
    how = 'AUTO(이어서)';
  }
}
function talkAll(where) {
  const ids = ORDER.filter((id) => s.people[id].status === 'home' && s.flags[MET[id]]);
  for (const id of ids) { const t = talkLine(id); log(`  말 걸기 ${s.people[id].name}: "${t.text}"  (${t.key}${t.shadowed.length ? ' · 가려진 줄: ' + t.shadowed.join(',') : ''})`); }
  if (!ids.length) log(`  말 걸 수 있는 사람 없음 (${where})`);
}
function move(map) { const m = db.maps[map]; E.dispatch(s, { type: 'move', map, x: m.start[0], y: m.start[1] }, db); log(`\n== 지도 ${m.displayName} ${hud()}`); resolve('AUTO(들어서자마자)'); }
function inspect(obj) { E.dispatch(s, { type: 'inspect', object: obj }, db); if (s.pending) resolve(`ACT(조사 ${obj})`); else { const o = db.objects[obj]; const lid = o.inspectLine && o.inspectLine[s.traces[obj].st]; const l = lid ? pick(lid, lineCtx()) : null; log(`  조사 ${obj}(${o.name}): ${l ? l.text : '(줄 없음: ' + lid + ')'}`); } }
function talk(id) { E.dispatch(s, { type: 'talk', who: id }, db); if (s.pending) resolve(`ACT(말 걸기 ${id})`); else { const t = talkLine(id); log(`  말 걸기 ${id}: "${t.text}" (${t.key})`); } }
function next() { const r = E.dispatch(s, { type: 'next' }, db); if (!r.ok) { log('  next 거절: ' + r.error); return; } log(`\n-- 단계 ${hud()}`); resolve('AUTO(단계 들어서자마자)'); }

log(`시드 ${seed}. AUTO = 플레이어가 부르지 않았는데 열린 창 / ACT = 조사·말 걸기로 연 창`);
move('car');
for (const o of ['bag', 'shoe_cab', 'cab_door', 'radio_cab', 'medkit', 'notebook_dash', 'lever']) inspect(o);
move('tunnel');
inspect('vent_shaft'); inspect('shelter_box');
talk('gicheol');
move('station');
log('  D0 낮 승강장 — 말 걸기:'); talkAll('D0 낮');
for (const o of ['speaker', 'stairs_ash', 'shoes_stairs', 'blanket_mari', 'board', 'chalk_wall', 'shutter_gap', 'office_door', 'repair_rubble', 'train_seat', 'cab_window', 'radio', 'crate_food', 'parts_crate', 'notebook_you', 'body_rail', 'grave']) inspect(o);
log('  D0 낮(둘러본 뒤) — 말 걸기:'); talkAll('D0 낮 뒤');
for (let k = 0; k < 40 && !s.ended && !(s.day === 3 && s.phase === 'aftermath'); k++) {
  next();
  if (s.phase === 'ration' && !s.pending) {             // 화면의 배식 창 기본값 = 모든 그릇 켬 (game.js rationFlow)
    const bowls = Object.fromEntries(['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home')).map((id) => [id, true]));
    E.dispatch(s, { type: 'ration', bowls }, db); log(`  배식(그릇 전부): 식량 ${s.world.food} 물 ${s.world.water}`);
  }
  if (['trace', 'day', 'evening'].includes(s.phase)) { log(`  ${s.phase} — 말 걸기:`); talkAll(s.phase); }
  if (s.day === 1 && s.phase === 'day') inspect('stairs_ash');
  if (s.phase === 'trace' && s.day >= 2 && s.flags.has_office_key && !s.flags.met_seoha) inspect('office_door');
}
console.log(out.join('\n'));
