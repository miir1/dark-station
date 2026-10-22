// 어두운 역 v4 — 엔진 봇. 화면 없이 dispatch 만으로 한 판을 끝까지 논다.
// 정책 = 축 성향(share/hand/name ∈ −1·0·+1) + 아침 조사 규칙(부지런/보통/게으름) + 경고 대하는 태도.
// 봇은 선택지의 label·warn·hint·cost·chance 와 (봇 전용 메타) 축 효과·당신 사망 여부를 본다. 정책이 못 정하면 시드 난수.
const E = require('../engine/engine.js');
const R = require('../engine/rng.js');

// avoidDeadly = 경고 글이 죽음을 바로 말하는 선택(DEADLY)을 피하는 정도. 1 = 대안이 있으면 고르지 않는다, 1 미만 = 축이 세게 끌면 고를 수도 있다(헌신의 자기희생, 부르는 사람의 대답).
// 조심형(CAREFUL) = 경고를 꽉 피하는 정책(avoidWarn ≥ 1, 모험 아님) — 합격선에 따로 집계한다(10-22 검증 3).
const POLICIES = {
  balanced: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  devoted: { share: 1, hand: 1, name: 0, inspect: 'normal', avoidWarn: 0.5, avoidDeadly: 0.3 },
  silent: { share: 0, hand: 0, name: -1, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  caller: { share: 0, hand: 0, name: 1, inspect: 'normal', avoidWarn: 0.3, avoidDeadly: 0.5 },
  lazy: { share: 0, hand: 0, name: 0, inspect: 'lazy', avoidWarn: 1, avoidDeadly: 1 },
  diligent: { share: 0, hand: 0, name: 0, inspect: 'diligent', avoidWarn: 1, avoidDeadly: 1 },   // 발견율 상한 보고용
  risky: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 0, avoidDeadly: 1, risky: true },   // 모험: 판정 있고 경고 붙은 선택을 우선(≥35%), 원정 매일·2층 우선, 거래·협정·범람수는 자원 + 최대. 확정 죽음은 위험이 아니라 피한다
};
const CAREFUL = Object.keys(POLICIES).filter((k) => POLICIES[k].avoidWarn >= 1 && !POLICIES[k].risky);
const RESOURCE_EVENTS = ['trade_shutter', 'patrol_pact', 'drink_flood'];
// 경고 글이 죽음을 바로 말한다 — 판정 없는 선택만(판정이 있으면 %가 따로 보인다). 화면에 보이는 글이라 E6 안이다.
// '센다' = 차장·위의 것이 세는 것(이 게임에서 세어진 사람은 올라간다 — d3·d9·명부에서 여러 번 보인다)
const DEADLY = /끝이다|죽는다|올라간다|못 일어난다|센다/;
const DEADLY_PENALTY = 10;
const deadlyText = (c) => !c.check && DEADLY.test(`${c.warn || ''} ${c.hint || ''}`);
// 약으로 몸을 고치는 선택: 비용이 약뿐이고, 원정·거래 사건이 아니고, 봇이 몸이 성치 않음을 알 때(부상 ≥1, 또는 제 손으로 고른 일로 생긴 병 — 범람수를 마심·손을 베임)
const SICK_FLAGS = ['drank_flood', 'flood_sick_days', 'cut_hand'];
const unwell = (s) => (s.people.you.n.injury || 0) >= 1 || SICK_FLAGS.some((f) => s.flags[f]);
const isRecovery = (c, eventId, ctx) => !!(ctx && ctx.unwell && ctx.kind !== 'trip' && c.cost && c.cost.meds && Object.keys(c.cost).every((k) => k === 'meds') && !RESOURCE_EVENTS.includes(eventId));
const OPT = { peek: false };   // run.js --peek: 옛 '바뀐 흔적' 판단으로 비교
const INSPECT = { diligent: { objects: 99, talk: 2, rumors: 99 }, normal: { objects: 2, talk: 1, rumors: 1 }, lazy: { objects: 1, talk: 0, rumors: 0 } };

// ── 선택 ──
// ctx(선택) = { kind: 사건 kind, unwell: 몸이 성치 않음 } — 없으면 회복 예외 없이 옛 점수
function scoreChoice(c, pol, eventId, ctx) {
  if (c.locked) return -Infinity;
  let sc = 0;
  if (pol.risky) {
    if (RESOURCE_EVENTS.includes(eventId)) return (c.gain || 0) * 10 + (c.cost ? -0.5 : 0);
    if (c.check && (c.warn || c.hint)) sc += c.chance >= 35 ? 4 : -2;   // 모험이 즐기는 위험 = 판정(%)이 있는 것. 판정 없는 경고에 주던 +1 은 뺐다(10-22 검증 3)
  }
  for (const [k, v] of Object.entries(c.axis || {})) sc += (pol[k] || 0) * v * 2;
  // 봇은 메타의 killYou 를 안 본다 — 화면처럼 warn·hint·cost·% 와 경고 글만 본다. (killYou 는 통계용으로만 메타에 남긴다)
  if (c.warn || c.hint) sc -= 2 * pol.avoidWarn;
  if (c.cost && !isRecovery(c, eventId, ctx)) sc -= 0.5;      // 아플 때 약을 쓰는 건 비용 감점 없음
  if (c.chance != null) sc += (c.chance - 50) / 50;            // 판정 % 가 낮으면 감점
  if (c.taboo) sc -= 3;
  if (deadlyText(c)) sc -= DEADLY_PENALTY * (pol.avoidDeadly != null ? pol.avoidDeadly : 1);
  return sc;
}
function pickChoice(s, db, pol, metas) {
  metas = metas || E.choiceMeta(s, db);
  if (!metas) return -1;
  const ev = db.events[s.pending.id];
  const ctx = { kind: ev ? ev.kind : '', unwell: unwell(s) };
  let best = -Infinity; let cands = [];
  for (const c of metas) { const sc = scoreChoice(c, pol, s.pending.id, ctx); if (sc > best + 1e-9) { best = sc; cands = [c]; } else if (Math.abs(sc - best) < 1e-9) cands.push(c); }
  if (!cands.length) return metas.findIndex((c) => !c.locked);
  return (cands.length === 1 ? cands[0] : R.pick(s, cands)).i;
}
// 고른 순간을 적어 둔다(집계용): 자유 경고 선택 = 다른 열린 선택지가 있는데 고른 경고(warn·hint·taboo) 선택.
// 당신이 이 선택으로 끝났으면 trace.death = { event, choice, forced(그 순간 당신 kill 이 없는 열린 선택지 0개), lastFree(그때까지 마지막 자유 경고 선택) }
function noteChoice(s, trace, eventId, metas, i, wasHome) {
  const c = metas && metas[i];
  if (!c) return;
  const open = metas.filter((m) => !m.locked);
  const before = trace.lastFree || null;
  if ((c.warn || c.hint || c.taboo) && open.length > 1) trace.lastFree = { event: eventId, choice: c.label, day: s.day };
  const gone = s.people.you.status === 'dead' || s.people.you.status === 'ascended';
  if (wasHome && gone && !trace.death) {
    const forced = open.filter((m) => !m.killYou).length === 0;
    // 강제 사망이면 갈림길은 이 선택 '전'의 마지막 자유 경고 선택, 아니면 이 선택 자신(대안이 있었는데 골랐다)
    trace.death = { event: eventId, choice: c.label, forced, lastFree: forced ? before : trace.lastFree || null };
  }
}
function settle(s, db, pol, trace) {
  let g = 0;
  while (s.pending && !s.ended && g++ < 20) {
    const metas = E.choiceMeta(s, db);
    const eventId = s.pending.id, wasHome = s.people.you.status === 'home';
    let i = pickChoice(s, db, pol, metas);
    const r = E.dispatch(s, { type: 'choose', i }, db);
    if (!r.ok) { const v = E.eventView(s, db); const j = v.choices.findIndex((c) => !c.locked); if (j < 0 || !E.dispatch(s, { type: 'choose', i: j }, db).ok) break; i = j; }
    if (trace) { trace.choices++; noteChoice(s, trace, eventId, metas, i, wasHome); }
  }
}
const act = (s, db, a) => E.dispatch(s, a, db).ok;

// ── 하루 단계별 행동 ──
function morningInspect(s, db, pol, trace) {
  const rule = INSPECT[pol.inspect];
  const map = db.maps.station;
  // 바뀐 흔적부터, 그다음 아무 물건. '바뀐' = 아직 안 본 흔적 중 봇이 아는 모습과 다른 것.
  // 아는 모습(trace.known) = 마지막으로 본 상태(조사했거나 배식처럼 제 손으로 한 것). 모르면 첫 상태(states[0]).
  // → 배식에서 비워 둔 그릇이 밤에 차 있으면 '바뀐 흔적'이다(10-22 배식 규칙). 누가 했는지는 모른다.
  // 보통·게으름은 화로 반경 8칸 안의 물건만 본다(12_design_v3 §7 봇 조사 규칙). 부지런은 전부.
  const near = (o) => !map.fire || Math.max(Math.abs(o.x - map.fire[0]), Math.abs(o.y - map.fire[1])) <= 8;
  const objs = (map.objects || []).filter((o) => pol.inspect === 'diligent' || near(o)).map((o) => o.id).filter((id) => s.traces[id]);
  const known = trace.known;
  const changed = OPT.peek ? objs.filter((id) => s.traces[id].st !== db.objects[id].states[0] && !s.traces[id].seen)   // 옛 판단(10-21b): 숨은 seen 깃발로 '밤에 손댄 것'을 안다
    : objs.filter((id) => !s.traces[id].seen && s.traces[id].st !== (known[id] !== undefined ? known[id] : db.objects[id].states[0]));
  const rest = objs.filter((id) => !changed.includes(id));
  const order = changed.concat(R.pick(s, [rest]) ? shuffle(s, rest) : rest);
  let n = 0;
  for (const id of order) { if (n >= rule.objects) break; if (act(s, db, { type: 'inspect', object: id })) { n++; settle(s, db, pol, trace); } if (s.ended) return; }
  let heard = 0;
  for (let i = 0; i < s.rumors.length && heard < rule.rumors; i++) if (!s.rumors[i].heard && act(s, db, { type: 'hear', i })) heard++;
  let talked = 0;
  for (const id of shuffle(s, db.peopleOrder.filter((p) => p !== 'you' && s.people[p].status === 'home'))) { if (talked >= rule.talk) break; if (act(s, db, { type: 'talk', who: id })) { talked++; settle(s, db, pol, trace); } if (s.ended) return; }
}
function shuffle(s, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function rationStep(s, db, pol) {
  const home = db.peopleOrder.filter((id) => s.people[id].status === 'home');
  const canFeed = Math.min(s.world.food || 0, s.world.water || 0);
  let order = home.slice();
  if (pol.share < 0) order = ['you'].concat(home.filter((i) => i !== 'you'));                       // 이기적: 내 그릇 먼저
  else if (pol.share > 0) order = (s.people.you.n.hunger || 0) >= 7 ? ['you'].concat(home.filter((i) => i !== 'you')) : home.filter((i) => i !== 'you').concat(['you']);   // 헌신: 내 그릇 마지막 (굶어 죽기 직전엔 먹는다)
  else order = shuffle(s, home);
  const bowls = {};
  order.forEach((id, k) => { bowls[id] = k < canFeed ? 1 : 0; });
  act(s, db, { type: 'ration', bowls });
}
function dayStep(s, db, pol, trace) {
  settle(s, db, pol, trace);
  if ((s.people.you.n.injury || 0) >= 2) act(s, db, { type: 'treat', who: 'you' });
  if (s.ended || s.day < 1) return;
  const low = (s.world.food || 0) <= 5 || (s.world.water || 0) <= 5;
  const hurt = (s.people.you.n.injury || 0) >= 2;
  if (pol.risky) {
    // 모험: 거래·범람수 사건이 걸리는 물건을 낮에 조사하고, 매일 원정 2층 → 1층
    for (const id of ['shutter_gap', 'body_rail']) if (act(s, db, { type: 'inspect', object: id })) settle(s, db, pol, trace);
    if (s.ended) return;
    const region = s.day % 2 === 0 ? 'A' : 'B';
    if (act(s, db, { type: 'trip', region, floor: 1 })) { trace.trips++; settle(s, db, pol, trace); }   // 원정은 1층부터, 그다음 바로 아래층 (엔진 규칙 10-22)
    if (s.ended) return;
    if (s.trip && act(s, db, { type: 'trip', region, floor: 2 })) settle(s, db, pol, trace);
    return;
  }
  if (!low || hurt) return;
  const region = s.day % 2 === 0 ? 'A' : 'B';
  if (act(s, db, { type: 'trip', region, floor: 1 })) { trace.trips++; settle(s, db, pol, trace); }
  if (s.ended) return;
  if (s.day >= 4 && !hurt && act(s, db, { type: 'trip', region, floor: 2 })) settle(s, db, pol, trace);
}
function eveningStep(s, db, pol, trace) {
  settle(s, db, pol, trace);
  if ((s.people.you.n.injury || 0) >= 2) act(s, db, { type: 'treat', who: 'you' });   // 원정에서 다친 뒤 저녁에 치료
  const rule = INSPECT[pol.inspect];
  const home = shuffle(s, db.peopleOrder.filter((p) => p !== 'you' && s.people[p].status === 'home'));
  if (home.length && rule.talk > 0 && act(s, db, { type: 'talk', who: home[0] })) settle(s, db, pol, trace);
  for (let i = 0; i < s.rumors.length; i++) if (!s.rumors[i].heard && rule.rumors > 0) { act(s, db, { type: 'hear', i }); break; }
  writeCauses(s, db, pol);
}
function writeCauses(s, db, pol) {
  for (const id of db.peopleOrder) {
    const p = s.people[id];
    if (id === 'you' || (p.status !== 'dead' && p.status !== 'ascended')) continue;
    if (Object.prototype.hasOwnProperty.call(s.ledger.causes, id)) continue;
    // 정책: 헌신·부지런은 적는다, 게으름은 빈칸, 나머지는 반반(시드)
    const write = pol.inspect === 'lazy' ? false : (pol.share > 0 || pol.inspect === 'diligent') ? true : R.chance(s, 0.5);
    act(s, db, { type: 'writeCause', who: id, line: write ? (p.status === 'ascended' ? '올라갔다' : '밤에 갔다') : null });
  }
}
function prologue(s, db, pol, trace) {
  for (const map of ['car', 'tunnel', 'station']) {
    act(s, db, { type: 'move', map, x: 0, y: 0 });
    settle(s, db, pol, trace);
    if (map === 'tunnel') { act(s, db, { type: 'talk', who: 'gicheol' }); settle(s, db, pol, trace); }
    for (const o of db.maps[map].objects || []) { if (s.ended) return; if (act(s, db, { type: 'inspect', object: o.id })) settle(s, db, pol, trace); }
    if (s.ended) return;
  }
}

// ── 한 판 ──
function play(db, seed, policyName) {
  const pol = POLICIES[policyName];
  const s = E.newGame(db, seed);
  const trace = { choices: 0, trips: 0, known: {}, lastFree: null, death: null };
  let guard = 0;
  while (!s.ended && guard++ < 400) {
    const ph = s.phase;
    if (s.day === 0 && ph === 'day' && !s.flags.arrived) prologue(s, db, pol, trace);
    else if (ph === 'trace') morningInspect(s, db, pol, trace);
    else if (ph === 'ration') rationStep(s, db, pol);
    else if (ph === 'day') { if (!s.pos.map || s.pos.map !== 'station') act(s, db, { type: 'move', map: 'station', x: 0, y: 0 }); dayStep(s, db, pol, trace); }
    else if (ph === 'evening') eveningStep(s, db, pol, trace);
    settle(s, db, pol, trace);
    if (s.ended) break;
    for (const [id, t] of Object.entries(s.traces)) if (t.seen) trace.known[id] = t.st;   // 본 것은 기억한다
    if (!E.dispatch(s, { type: 'next' }, db).ok) { settle(s, db, pol, trace); if (!s.ended && !E.dispatch(s, { type: 'next' }, db).ok) break; }
  }
  if (!s.ended) writeCauses(s, db, pol);
  return { s, trace };
}

module.exports = { POLICIES, CAREFUL, INSPECT, OPT, DEADLY, play, pickChoice, scoreChoice, deadlyText, isRecovery, noteChoice };
