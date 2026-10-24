// 검수용 (2026-10-24 U2 첫 만남·세계관 전달 — P0-S5 끝 증거). 게임 코드는 건드리지 않는다 — 엔진·표·화면의 줄 고르기(browser.js talkPick)를 읽기만 한다.
// node v4/tools/audit_narrative_timeline.js [seed=7] > docs/foundation/meeting_2026-10-24/after_shots/screen_narrative_timeline.txt
//
// '꼭 지나는 길'(캡처 봇 game.js autoRun 과 같은 길 + D0 에 계단을 보러 간다)을 시간 순으로 걸으며
//   ① 어느 창이 저절로 열렸나(AUTO = 지도에 들어서거나 단계가 바뀌자마자) / 조사·말 걸기로 열렸나(ACT)
//   ② 말풍선: 만나기 전 사다리(bark_<사람>_<칸수>) · 화제(bark_<사람>_rule_<주제>, 4칸 안을 지날 때 하루 한 번) · 셔터
//   ③ 저녁 증언(testify_*) · 말 걸기(browser.js talkPick: 오늘 안 들은 줄 → 조건 낱말이 많은 줄)
// 을 찍고, 부록 B 의 규칙 4개를 '각 판단 전에' 몇 번 들었는지 센다. 2회 미만이거나 첫 규칙까지 3분이 넘으면 실패.
//
// 시간 모형(어림): 한 칸 0.23초 · 글 한 장 0.5초 + 글자당 0.07초(찍히는 18ms + 읽기) · 선택 2.5초 · 장 전환 카드 2.1초.
// 걷는 길은 승강장 지도에서 막힌 칸(벽·개찰구·단단한 물건·좌석·멈춘 전동차)을 피해 BFS 로 찾고, 지나는 칸마다 말풍선 거리를 잰다.
const path = require('path');
const T = require('../engine/tables.js');
const E = require('../engine/engine.js');
const C = require('../engine/cond.js');
const SP = require('../spots.js');
global.DS4 = Object.assign(global.DS4 || {}, { tables: T, engine: E, cond: C, spots: SP });
require('../engine/browser.js');
const B = global.DS4.browser;
const db = T.loadDir(path.join(__dirname, '..', 'data'));
B.setDb(db);
const seed = +(process.argv[2] || 7);
const s = E.newGame(db, seed);
const out = [];
const log = (...a) => out.push(a.join(' '));

// ── 규칙 4개 (부록 B). ids = 그 규칙을 말하는 줄·사건 (id 에 _rule_·testify_ 가 든 줄 + 표의 사건 문장) ──
const RULES = {
  A: { name: '맨발이면 사람이 아니다 / 계단 줄을 넘으면 재가 된다', judge: ['pro_stairs', 'pro_stairs_b'], judgeName: 'D0 계단(pro_stairs)',
    ids: ['pro_platform', 'pro_gicheol', 'soonrye_meet', 'insp_stairs_line', 'testify_soonrye', 'testify_gicheol', 'testify_eunji'] },
  B: { name: '이름이 불릴 때 대답하면 올라가 안 돌아온다', judge: ['d3_called_you'], judgeName: 'D3 밤 d3_called_you',
    ids: ['d1_names', 'd1_names_quiet', 'testify_mari', 'testify_dongha', 'testify_seoha', /_rule_answer$/] },
  C: { name: '셀 때 소리를 내면 같이 세어진다', judge: ['trial_d3_count', 'trial_d3_count_b', 'trial_d3_count_c'], judgeName: 'D3 밤 trial_d3_count',
    ids: ['d2_night_count', /_rule_count$/] },
  D: { name: '열흘 뒤 정오, 선로(통로)가 이어져야 열차가 선다', judge: ['@d2_day'], judgeName: 'D2 낮(공사·원정 시작)',
    ids: ['pro_speaker', 'pro_radio', /_rule_train$/, /_rule_rail$/] },
};
const ruleOf = (id) => Object.keys(RULES).filter((k) => RULES[k].ids.some((m) => (m instanceof RegExp ? m.test(id) : m === id)));
const heardRules = { A: [], B: [], C: [], D: [] };
const judged = {};
let clock = 0;
let firstRule = null;
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const readT = (text) => { const pages = Math.max(1, String(text || '').split(/(?<=[.!?…])\s+/).length); clock += 0.5 * pages + 0.07 * String(text || '').length; };
function hearRule(id, how, text) {
  for (const k of ruleOf(id)) {
    if (judged[k]) continue;
    heardRules[k].push({ t: clock, day: s.day, phase: s.phase, id, how });
    if (firstRule == null) firstRule = { t: clock, id, rule: k };
    log(`      ★ 규칙 ${k} (${heardRules[k].length}번째) ← ${how} ${id}`);
  }
}
function judge(key) {
  for (const [k, r] of Object.entries(RULES)) if (!judged[k] && r.judge.includes(key)) { judged[k] = { t: clock, day: s.day, before: heardRules[k].length }; log(`      ◆ 판단 ${k}: ${r.judgeName} — 그 전에 ${heardRules[k].length}번 들었다`); }
}

// ── 들은 줄: 엔진 heard 동작으로 남긴다 (화면과 같은 기록) ──
function heard(id, row, how) {
  const key = E.heardKey(db, id, row);
  if (key) E.dispatch(s, { type: 'heard', key }, db);
  readT(row.text);
  log(`  [${mmss(clock)}] ${how} ${id}: "${row.text}"`);
  hearRule(id, how, row.text);
}
const hud = () => `[D${s.day} ${s.phase} · 열차까지 ${Math.max(0, 10 - s.day)}일]`;
const killsMe = (c) => E.killsYou(c);
function resolve(how) {
  let g = 0;
  while (s.pending && g++ < 10) {
    const v = E.eventView(s, db);
    judge(v.id);
    readT(v.text);
    log(`  [${mmss(clock)}] ${how} 사건 ${v.id}: ${v.text}`);
    hearRule(v.id, '사건', v.text);
    v.choices.forEach((c, i) => log(`      [${i + 1}] ${c.label}${c.warn ? ' (경고: ' + c.warn + ')' : ''}${c.chance != null ? ' ' + c.chance + '%' : ''}${c.locked ? ' (잠김)' : ''}`));
    const rows = db.events[v.id].choices;
    let i = rows.findIndex((c, k) => !v.choices[k].locked && !killsMe(c) && !c.taboo);
    if (i < 0) i = rows.findIndex((c, k) => !v.choices[k].locked);
    E.dispatch(s, { type: 'choose', i }, db);
    clock += 2.5;
    const r = s.lastResult || {};
    if (r.text) readT(r.text);
    log(`      → 고름 [${i + 1}] 결과: ${r.text || ''}`);
    if (v.id === 'pro_radio' && r.text) hearRule('pro_radio', '사건 결과', r.text);
    how = 'AUTO(이어서)';
  }
}

// ── 지도와 걷기 ──
let pos = null;                               // { map, x, y }
const isMet = (id) => E.known(s, db, id);
const home = (id) => s.people[id] && s.people[id].status === 'home';
function solidAt(mapId, x, y) {
  const m = db.maps[mapId], t = (m.rows[y] || '')[x] || '#';
  if ('#tRhDC'.includes(t)) return true;
  if (t === 'k' && !(s.traces.office_door && s.traces.office_door.st === 'open')) return true;
  return m.objects.some((o) => o.x === x && o.y === y && db.objects[o.id] && db.objects[o.id].solid && !(o.id === 'rubble' && s.traces.rubble && s.traces.rubble.st === 'crossed'));
}
function bfs(mapId, sx, sy, tx, ty) {
  const m = db.maps[mapId], W = m.rows[0].length, H = m.rows.length, key = (x, y) => x + ',' + y, prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue; if (solidAt(mapId, nx, ny) && !(nx === tx && ny === ty)) continue; prev.set(k, [x, y]); q.push([nx, ny]); } }
  if (!prev.has(key(tx, ty))) return [];
  const p = []; let c = [tx, ty]; while (c && !(c[0] === sx && c[1] === sy)) { p.unshift(c); c = prev.get(key(c[0], c[1])); } return p;
}
// 사다리 (만나기 전): who → { next } (화면 game.js updateBarks 와 같은 단계: 6(몸짓)·4·2·1, 셔터 8·3)
const ladder = {};
function steps(who) { const ns = new Set(who === 'shutter' ? [] : [6]); for (const k of Object.keys(db.lines)) { const m = new RegExp('^bark_' + who + '_(\\d+)$').exec(k); if (m) ns.add(+m[1]); } return [...ns].sort((a, b) => b - a); }
function subjects() {
  const outS = [];
  if (pos.map === 'tunnel' && s.day === 0 && !s.flags.met_gicheol) outS.push({ who: 'gicheol', x: 16, y: 2 });
  if (pos.map === 'station') {
    if (s.day === 0 && home('soonrye') && !isMet('soonrye')) outS.push({ who: 'soonrye', x: SP.FIRST.soonrye[0], y: SP.FIRST.soonrye[1] });
    if (s.day === 0 && home('mari') && !isMet('mari')) { const b = db.maps.station.beds[SP.BED_ORDER.indexOf('mari')]; outS.push({ who: 'mari', x: b[0], y: b[1] }); }
    const sg = db.maps.station.objects.find((o) => o.id === 'shutter_gap');
    if (s.day === 1 && s.phase === 'day' && !s.flags.met_eunji) outS.push({ who: 'shutter', x: sg.x, y: sg.y });
  }
  return outS;
}
// 지금 단계에 사람이 서 있는 자리 (화면 peopleOnMap 과 같은 표)
function spotsNow() {
  const ph = s.phase, outP = [];
  if (pos.map !== 'station' || ph === 'night' || ph === 'aftermath') return outP;
  for (const id of SP.BED_ORDER) {
    if (!home(id) || !isMet(id)) continue;
    const bed = s.day === 0 && ph === 'day' && (SP.FIRST_BED || []).includes(id) ? db.maps.station.beds[SP.BED_ORDER.indexOf(id)] : null;
    const p = ph === 'evening' ? SP.SPOTS.evening[id] : s.day === 0 && SP.FIRST[id] ? SP.FIRST[id] : bed || (SP.SPOTS[ph] || SP.SPOTS.day)[id];
    if (p) outP.push({ id, x: p[0], y: p[1] });
  }
  return outP;
}
function barksHere() {
  const ctx = B.lineCtx(s);
  for (const sb of subjects()) {
    const st = ladder[sb.who] || (ladder[sb.who] = { next: 0 });
    const ns = steps(sb.who), d = Math.abs(pos.x - sb.x) + Math.abs(pos.y - sb.y);
    while (st.next < ns.length && d <= ns[st.next]) {
      const id = 'bark_' + sb.who + '_' + ns[st.next]; st.next++;
      clock += 0.8;
      const row = db.lines[id] ? B.pickLine(db, id, ctx) : null;
      if (row) heard(id, row, '말풍선'); else log(`  [${mmss(clock)}] 몸짓 ${sb.who} ${ns[st.next - 1]}칸 (글 없음)`);
    }
  }
  for (const p of spotsNow()) {
    if (Math.abs(pos.x - p.x) + Math.abs(pos.y - p.y) > 4) continue;
    for (const id of Object.keys(db.lines).filter((k) => k.startsWith('bark_' + p.id + '_rule_'))) {
      const row = B.pickLine(db, id, ctx); if (!row) continue;
      const key = E.heardKey(db, id, row);
      if (s.heard && s.heard[key] === s.day) continue;
      heard(id, row, '화제 말풍선'); break;
    }
  }
}
function walk(tx, ty) {
  const p = bfs(pos.map, pos.x, pos.y, tx, ty);
  for (const [x, y] of p) { if (solidAt(pos.map, x, y)) break; pos.x = x; pos.y = y; clock += 0.23; barksHere(); }
}
// 물건·사람 옆 칸까지 걸어간다 (화면 walkTo 처럼 가장 가까운 옆 칸)
function walkNext(tx, ty) {
  let best = null;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const ax = tx + dx, ay = ty + dy; if (solidAt(pos.map, ax, ay)) continue; const p = bfs(pos.map, pos.x, pos.y, ax, ay); if ((p.length || (ax === pos.x && ay === pos.y)) && (!best || p.length < best.n)) best = { x: ax, y: ay, n: p.length }; }
  if (best) walk(best.x, best.y);
}
function move(map) {
  const m = db.maps[map];
  clock += 2.1;
  E.dispatch(s, { type: 'move', map, x: m.start[0], y: m.start[1] }, db);
  pos = { map, x: m.start[0], y: m.start[1] };
  log(`\n== 지도 ${m.displayName} ${hud()} [${mmss(clock)}]`);
  resolve('AUTO(들어서자마자)');
}
const objAt = (id) => db.maps[pos.map].objects.find((o) => o.id === id);
function inspect(id) {
  const mo = objAt(id); if (mo) walkNext(mo.x, mo.y);
  E.dispatch(s, { type: 'inspect', object: id }, db);
  if (s.pending) { resolve(`ACT(조사 ${id})`); return; }
  const o = db.objects[id], lid = o.inspectLine && o.inspectLine[s.traces[id] ? s.traces[id].st : o.states[0]];
  const row = lid ? B.pickLine(db, lid, B.lineCtx(s)) : null;
  if (row) heard(lid, row, `조사 ${id}`);
}
function talk(id, at) {
  if (at) walkNext(at[0], at[1]);
  E.dispatch(s, { type: 'talk', who: id }, db);
  if (s.pending) { resolve(`ACT(말 걸기 ${id})`); return; }
  const pk = B.talkPick(db, s, id);
  if (pk && pk.fresh) heard(pk.id, pk.row, `말 걸기 ${id}`);
  else { const idle = B.pickLine(db, id + '_idle', B.lineCtx(s)); if (idle) { readT(idle.text); log(`  [${mmss(clock)}] 말 걸기 ${id}: (몸짓) ${idle.text}`); } }
}
function testimony() {
  const ctx = B.lineCtx(s);
  for (const id of SP.BED_ORDER) {
    if (!home(id) || !isMet(id)) continue;
    const rows = db.lines['testify_' + id] || [];
    if (rows.some((r, i) => s.heard && s.heard[`testify_${id}#${i}`] != null)) continue;
    const row = B.pickLine(db, 'testify_' + id, ctx); if (!row) continue;
    heard('testify_' + id, row, '저녁 증언');
    if (id === 'soonrye') { const b = B.pickLine(db, 'testify_soonrye_book', ctx); if (b) heard('testify_soonrye_book', b, '저녁 증언'); }
  }
}
function next() {
  const d0 = s.day;
  const r = E.dispatch(s, { type: 'next' }, db);
  if (!r.ok) { log('  next 거절: ' + r.error); return false; }
  if (s.day !== d0) clock += 2.1;
  log(`\n-- 단계 ${hud()} [${mmss(clock)}]`);
  if (pos.map === 'station' && ['trace', 'evening', 'night'].includes(s.phase)) { const f = db.maps.station.fire; pos.x = f[0] + SP.FIRE_STAND[0]; pos.y = f[1] + SP.FIRE_STAND[1]; }
  if (s.day === 2 && s.phase === 'day') judge('@d2_day');
  if (s.phase === 'evening') testimony();
  resolve('AUTO(단계 들어서자마자)');
  return true;
}

log(`시드 ${seed}. AUTO = 플레이어가 부르지 않았는데 열린 창 / ACT = 조사·말 걸기로 연 창 / ★ = 규칙 줄 / ◆ = 판단. 시각은 어림(머리말 참고).`);
// 전동차 (캡처 봇과 같은 길: 수첩 → 레버 → 문)
move('car');
inspect('notebook_dash'); inspect('lever');
walk(21, 3);
// 터널: 잔해 앞 헤드램프의 남자에게 걸어가 말을 건다
move('tunnel');
walkNext(16, 2);
talk('gicheol');
walk(28, 2);
// 승강장: 도착(창 없음) → 화로 곁 할머니에게 걸어가 말을 건다 → 스피커 → 계단(분필 줄·계단) → 담요의 여자 → 화로
move('station');
talk('soonrye', SP.FIRST.soonrye);
talk('soonrye');
inspect('speaker');
inspect('stairs_line');
inspect('stairs_ash');
inspect('blanket_mari');
walkNext(13, 10);
for (let k = 0; k < 60 && !s.ended && !(s.day === 3 && s.phase === 'aftermath'); k++) {
  if (!next()) break;
  if (s.phase === 'ration' && !s.pending) {             // 화면 배식 창 기본값 = 만난 사람 그릇 전부 켬
    const bowls = Object.fromEntries(['you'].concat(db.peopleOrder.filter((id) => id !== 'you' && home(id) && isMet(id))).map((id) => [id, true]));
    E.dispatch(s, { type: 'ration', bowls }, db); clock += 4; log(`  배식(만난 사람 그릇 전부 ${Object.keys(bowls).length}): 식량 ${s.world.food} 물 ${s.world.water}`);
  }
  if (s.phase === 'trace') { barksHere(); if (s.day > 0) inspect('notebook_you'); walkNext(13, 10); }
  if (s.phase === 'day') {
    barksHere();
    if (s.day === 1 && !s.flags.met_eunji) { walk(2, 7); inspect('shutter_gap'); }        // D1 낮: 셔터 두드리는 소리 쪽으로
    if (s.phase === 'day') walkNext(13, 10);
  }
  if (s.phase === 'evening') {
    barksHere();
    const first = SP.BED_ORDER.find((id) => home(id) && isMet(id));                          // 캡처 봇: 저녁에 첫 번째 사람과 이야기
    if (first) talk(first, SP.SPOTS.evening[first]);
    walkNext(13, 10);
  }
}

// ── 요약 ──
const sum = [];
sum.push(`\n==== 규칙 4개 — 판단 전에 들은 횟수 (기준: 2회 이상) · 첫 규칙까지 (기준: 3분 안) ====`);
let fail = 0;
for (const [k, r] of Object.entries(RULES)) {
  const j = judged[k];
  const n = j ? j.before : heardRules[k].length;
  const ok = n >= 2;
  if (!ok) fail++;
  sum.push(`${ok ? 'PASS' : 'FAIL'} 규칙 ${k} "${r.name}" — 판단 ${r.judgeName}${j ? ` (D${j.day}, ${mmss(j.t)})` : ' (이 길에서 판단에 닿지 않음 — 끝까지 센 값)'} 전 ${n}회: ${heardRules[k].slice(0, j ? j.before : undefined).map((h) => `${h.id}@D${h.day}${h.phase[0]}`).join(', ')}`);
}
const fr = firstRule ? firstRule.t : Infinity;
if (fr > 180) fail++;
sum.push(`${fr <= 180 ? 'PASS' : 'FAIL'} 첫 규칙까지 ${firstRule ? mmss(fr) + ` (${firstRule.id}, 규칙 ${firstRule.rule})` : '없음'} — 기준 3:00`);
sum.push(fail ? `결과: 실패 ${fail}건` : '결과: 통과');
console.log(sum.join('\n') + '\n' + out.join('\n') + '\n' + sum.join('\n'));
process.exitCode = fail ? 1 : 0;
