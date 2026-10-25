// 최종판 데이터 확인 (data 담당, 2026-10-25) — node docs/foundation/final_2026-10-25/data_check.js > docs/foundation/final_2026-10-25/data_check.txt
// 표·엔진은 읽기만. ① 줄타기 창: 날 × 카르마 × 눈먼 새벽마다 '실제로 걸리는 사건'(원래·_d3·_d6 사본 중 when 이 맞는 것)과 화면 %·경고
// ② 원정 걸어서 뒤지기: 층마다 도착 사건 + 지도 물건을 차례로 조사했을 때 걸린 사건·연 수납(얻은 것)
// ③ 그림 연결 · 아이콘 낱말 · 수납 물건 배치(지도 칸·벽)
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const C = E.cond;
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const out = [];
const p = (s) => out.push(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
// engine.js phaseCtx 와 같은 낱말(읽기 전용 사본)
function ctxOf(s) {
  const ctx = Object.assign({}, s.world, { day: s.day });
  ctx.flags = s.flags; ctx.phase = s.phase || '';
  ctx.map = s.pos.map || ''; ctx.region = s.trip ? s.trip.region : ''; ctx.floor = s.trip ? s.trip.floor : 0;
  ctx.trace = {}; for (const [id, t] of Object.entries(s.traces)) ctx.trace[id] = t.st;
  ctx.alive = {}; for (const q of Object.values(s.people)) { ctx.alive[q.id] = q.status === 'home' || q.status === 'away' ? 1 : 0; for (const [k, v] of Object.entries(q.n)) ctx[`${k}_${q.id}`] = v; }
  Object.assign(ctx, s.people.you.n);
  ctx.inspect = {}; ctx.talk = {}; ctx.fired = s.fired || {};
  return ctx;
}
const residents = db.peopleOrder.filter((id) => id !== 'you');
function base(day, phase) {
  const s = E.newGame(db, 4242);
  s.day = day; s.world.day = day; s.phase = phase; s.phaseSeen = []; s.pending = null; s.done = {};
  for (const id of db.peopleOrder) { const f = db.people[id].metFlag; if (f) s.flags[f] = true; if (s.people[id].status === 'away') s.people[id].status = 'home'; }
  s.flags.arrived = true;
  for (const w of ['food', 'water', 'fuel', 'meds']) s.world[w] = 9;
  return s;
}
// 이 상태에서 먼저 걸리는 사건(엔진 enterPhase 처럼 표 순서 첫 것) — fam 묶음(원래 id 앞머리) 안에서만 본다
function firing(s, fam) {
  const ctx = ctxOf(s);
  for (const ev of db.eventsList) {
    if (ev.kind === 'trip') continue;
    if (!(ev.id === fam || ev.id.startsWith(fam + '_d'))) continue;
    if (C.test(ev.when, ctx)) return ev;
  }
  return null;
}
const viewLine = (s, ev, tgt) => {
  s.pending = { id: ev.id, kind: ev.kind }; if (tgt) s.pending.target = tgt;
  const v = E.eventView(s, db);
  const meta = E.choiceMeta(s, db);
  return v.choices.map((c, i) => `${i + 1}.${c.label}${c.chance != null ? ' ' + c.chance + '%' : ''}${meta[i].roped ? '[줄]' : ''}${c.warn ? ' ⚠' + c.warn : ''}${c.locked ? ' (잠김: ' + c.reason + ')' : ''}`).join(' | ');
};

p('# 최종판 데이터 확인 (data 담당, 2026-10-25)');
p('');
p('## 1. 줄타기 창 — 날 × 카르마 × 눈먼 새벽 (실제로 걸리는 사건과 화면 %·경고. [줄] = 줄타기 판정, 화면에는 안 보이는 표시)');
const FAM = [
  ['dawn_strike', 'trace', (s) => { s.flags.dawn_strike = true; }],
  ['dawn_mob', 'trace', (s) => { s.flags.dawn_mob = true; }],
  ['called_up', 'night', (s) => { s.flags.named_you = true; }],
  ['fever_night', 'night', (s) => { s.people.you.n.injury = 3; }],
];
for (const [fam, phase, set] of FAM) {
  p(`\n### ${fam}`);
  for (const day of [3, 5, 6]) for (const k of [0, 5, 7, 8, 12, 16]) for (const blind of fam === 'dawn_strike' ? [false, true] : [false]) {
    const s = base(day, phase); set(s); s.world.karma = k; s.flags.strike_blind = blind;
    const ev = firing(s, fam);
    if (!ev) { p(`- D${day} 카르마 ${k}${blind ? ' 눈먼' : ''}: (안 걸림)`); continue; }
    p(`- D${day} 카르마 ${k}${blind ? ' 눈먼' : ''} → **${ev.id}**: ${viewLine(s, ev, residents[0])}`);
  }
}
p('\n### 이기적 위험 0 출구에 단 줄타기 (④) · 꼬리 글 (①)');
const ONE = [
  ['d6_shutter', 6, 'night', (s) => { s.flags.met_eunji = true; }],
  ['d6_shutter_b', 6, 'night', (s) => { s.flags.met_eunji = true; s.people.dongha.status = 'dead'; }],
  ['d10_walk', 10, 'day', () => {}],
  ['d10_walk_other', 10, 'day', (s) => { s.people.dongha.status = 'dead'; }],
  ['d10_grab', 10, 'day', () => {}],
  ['d10_hold', 10, 'day', () => {}],
  ['starve_you', 5, 'night', (s) => { s.people.you.n.hunger = 9; }],
];
for (const [id, day, phase, set] of ONE) for (const k of [0, 5, 8, 12, 16]) {
  const s = base(day, phase); set(s); s.world.karma = k;
  p(`- ${id} D${day} 카르마 ${k}: ${viewLine(s, db.events[id], residents[0])}`);
}
p('\n### 갚는 길: 식량이 모자랄 때 잠김 이유와 꼬리 글이 같이 보이는 꼴 (①의 지적 장면)');
{
  const s = base(5, 'trace'); s.flags.dawn_strike = true; s.world.karma = 12; s.world.food = 0; s.world.water = 0;
  p(`- dawn_strike 카르마 12 식량·물 0: ${viewLine(s, db.events.dawn_strike, residents[0])}`);
  const s2 = base(5, 'trace'); s2.flags.dawn_strike = true; s2.world.karma = 12; s2.world.food = 1; s2.world.water = 3;
  p(`- dawn_strike 카르마 12 식량 1·물 3 (물병 변형): ${viewLine(s2, db.events.dawn_strike, residents[0])}`);
}

// ── 2. 원정 걸어서 뒤지기 ──
p('\n## 2. 원정 걸어서 뒤지기 — 층마다 도착 사건(첫 선택지로 넘김) + 지도 물건 차례로 조사 (봇 tripSearch 와 같은 순서)');
const TRIP_MAPS = { A: ['mall_a1', 'mall_a2'], B: ['drain_b1', 'drain_b2'] };
function settle(s, pickLast) { let g = 0; const got = []; while (s.pending && g++ < 10) { const v = E.eventView(s, db); const open = v.choices.map((c, i) => (!c.locked ? i : -1)).filter((i) => i >= 0); const i = pickLast ? open[open.length - 1] : open[0]; got.push(`${s.pending.id}[${v.choices[i].label}]`); E.dispatch(s, { type: 'choose', i }, db); } return got; }
for (const day of [1, 3, 5, 7]) for (const region of ['A', 'B']) {
  const s = base(day, 'day');
  s.world.karma = 0;
  const lines = [];
  for (const floor of [1, 2]) {
    if (s.ended) break;
    const before = clone(s.world);
    const r = E.dispatch(s, { type: 'trip', region, floor, walk: true }, db);
    if (!r.ok) { lines.push(`  ${floor}층: 못 들어감 (${r.error || ''})`); break; }
    const arrive = s.pending ? s.pending.id : '(도착 사건 없음)';
    const a = settle(s, true);
    const map = db.maps[TRIP_MAPS[region][floor - 1]];
    const found = [];
    for (const o of map.objects) {
      if (s.ended) break;
      const was = s.traces[o.id] ? s.traces[o.id].st : '-';
      E.dispatch(s, { type: 'inspect', object: o.id }, db);
      if (s.pending) { const ev = s.pending.id; const got = settle(s, true); found.push(`${o.id}(${was}) → 사건 ${ev} ${got.join(' ')}`); continue; }
      if (s.found) found.push(`${o.id}(${was}) → 열림 "${s.found.text}" ${s.found.lines.map((l) => `${l.id} ${l.from}→${l.to}`).join(' ')}`);
      else found.push(`${o.id}(${was}) → 조사 글만`);
    }
    const diff = Object.keys(s.world).filter((k) => ['food', 'water', 'fuel', 'meds', 'parts'].includes(k) && s.world[k] !== before[k]).map((k) => `${k} ${before[k]}→${s.world[k]}`).join(' ');
    lines.push(`  ${floor}층 ${map.id}: 도착 ${arrive} ${a.join(' ')}\n    ${found.join('\n    ')}\n    자원: ${diff || '변화 없음'} · 깃발 has_rope ${!!s.flags.has_rope} has_radio ${!!s.flags.has_radio}`);
  }
  p(`- D${day} 지역 ${region} (모든 선택 = 마지막 열린 선택지 — 대개 '지나간다'·'물러난다'):\n${lines.join('\n')}`);
}
// 같은 원정을 두 번 — 위험한 수납은 고른 결과 뒤 다시 안 뜨고, 안 고른(지나간) 것은 다음 원정에 다시 뜬다
p('\n### 두 번째 원정 (첫 원정에서 판정 선택 = 첫 열린 선택지)');
for (const region of ['A', 'B']) {
  const s = base(5, 'day'); s.world.karma = 0;
  const runs = [];
  for (let n = 0; n < 2; n++) {
    s.trip = null; s.phase = 'day'; s.pending = null;
    const got = [];
    for (const floor of [1, 2]) {
      if (s.ended || !E.dispatch(s, { type: 'trip', region, floor, walk: true }, db).ok) break;
      got.push(...settle(s, false));
      for (const o of db.maps[TRIP_MAPS[region][floor - 1]].objects) { if (s.ended) break; E.dispatch(s, { type: 'inspect', object: o.id }, db); if (s.pending) got.push(...settle(s, false)); else if (s.found) got.push(`열림:${o.id}`); }
    }
    runs.push(`  ${n + 1}번째: ${got.join(' · ')}`);
  }
  p(`- 지역 ${region} D5:\n${runs.join('\n')}`);
}

// ── 3. 그림·아이콘·배치 ──
p('\n## 3. 그림 연결 · 아이콘 낱말 · 배치');
for (const id of ['d10_walk', 'd10_walk_other', 'd10_walk_alone']) p(`- ${id}.image = ${db.events[id].image} · 파일 ${fs.existsSync(path.join(ROOT, 'v4/img/cg', db.events[id].image + '.png')) ? '있음' : '없음'}`);
const ICON = [['밧줄', 'has_rope'], ['성냥', 'fuel'], ['퓨즈', 'parts'], ['무전기', 'has_radio']];
for (const [w, k] of ICON) {
  const hits = db.objectsList ? [] : [];
  for (const o of Object.values(db.objects)) if (o.holds && (o.holds.text || '').includes(w)) hits.push(`${o.id} holds "${o.holds.text}" 효과 ${JSON.stringify(o.holds.effects || {})}`);
  p(`- 아이콘 ${w} (${k}): ${hits.join(' / ') || '없음'} · 아이콘 파일 ${fs.existsSync(path.join(ROOT, 'v4/img/icons', { 밧줄: 'rope', 성냥: 'matches', 퓨즈: 'fuse', 무전기: 'radio' }[w] + '.png')) ? '있음' : '없음'}`);
}
p(`- has_rope 를 쓰는 곳: ${db.eventsList.filter((e) => e.choices.some((c) => c.req && c.req.flag === 'has_rope')).map((e) => e.id + '/' + e.choices.find((c) => c.req && c.req.flag === 'has_rope').label).join(', ')}`);
p(`- has_radio 를 쓰는 곳: ${db.eventsList.filter((e) => e.choices.some((c) => c.req && c.req.flag === 'has_radio')).map((e) => e.id + '/' + e.choices.find((c) => c.req && c.req.flag === 'has_radio').label).join(', ')}`);
const PROPS = new Set(fs.readdirSync(path.join(ROOT, 'v4/img/props')).map((f) => f.replace(/\.png$/, '')));
for (const mid of Object.values(TRIP_MAPS).flat()) {
  const m = db.maps[mid];
  p(`- ${mid}: ${m.rows.join(' / ')}`);
  for (const o of m.objects) {
    const d = db.objects[o.id]; const pre = o.id.split('_')[0];
    const t = (m.rows[o.y] || '')[o.x]; const up = (m.rows[o.y - 1] || '')[o.x];
    p(`  - ${o.id} (${d.name}) @ (${o.x},${o.y}) 칸 '${t}' 위 '${up}' · states ${d.states.join('/')}${d.holds ? ' · holds' : ''} · 그림 ${PROPS.has(pre) ? pre : '-'}${PROPS.has(pre + '_open') ? ' + ' + pre + '_open' : ''}${PROPS.has(pre + '_empty') ? ' + ' + pre + '_empty' : ''}`);
  }
}
p(`\n표 경고 ${db.warnings.length}건${db.warnings.length ? ': ' + db.warnings.map((w) => w.kind + ' ' + w.text).join(' / ') : ''}`);
console.log(out.join('\n'));
