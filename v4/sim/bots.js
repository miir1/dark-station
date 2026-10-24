// 어두운 역 v4 — 엔진 봇. 화면 없이 dispatch 만으로 한 판을 끝까지 논다.
// 정책 = 축 성향(share/hand/name ∈ −1·0·+1) + 아침 조사 규칙(부지런/보통/게으름) + 경고 대하는 태도.
// 봇은 선택지의 label·warn·hint·cost·chance 와 (봇 전용 메타) 축 효과·당신 사망 여부를 본다. 정책이 못 정하면 시드 난수.
const E = require('../engine/engine.js');
const R = require('../engine/rng.js');

// avoidDeadly = 경고 글이 죽음을 바로 말하는 선택(DEADLY)을 피하는 정도. 1 = 대안이 있으면 고르지 않는다, 1 미만 = 축이 세게 끌면 고를 수도 있다(헌신의 자기희생, 부르는 사람의 대답).
//   판정 있는 선택은 화면의 실패 % 만큼만 깎는다(deadlyRisk) — 95% 사는 주사위는 손가락보다 낫고, 45% 죽는 주사위는 무릎 꿇기보다 못하다.
// 조심형(CAREFUL) = 경고를 꽉 피하는 정책(avoidWarn ≥ 1, 모험 아님) — 합격선에 따로 집계한다(10-22 검증 3).
// (10-24 A1 명세 §6-2 · 검토 지적 1·11) 이기적 봇 넷 — 늦게 오는 값(카르마)이 봇 버릇이 아니라 구조로 오는지 본다:
//   selfish     = 명세 그대로: 몫−·손−, 금기 감점 −3, bodyAverse 3(경고 글에 '다친다·잃는다·상한다'면 −3 — 제 몸으로 치르기를 꺼린다)
//   selfish_nb  = bodyAverse 없음 — 화면을 읽고 '버틴다'를 고르는 이기적 플레이어(버릇 없는 이기적 봇)
//   selfish_rt  = 끝까지 남을 내미는 사람: 남을 내미는 금기(OTHER_TABOO)에 −3 대신 +3(tabooBonus 6) + bodyAverse 3
//   selfish_rt0 = 같은데 bodyAverse 없음
// (10-23 리드 승인 · A3 분석 §6) counter = 몫−·손+·이름+ (센 자 쪽) · child = 몫−·손−·이름+ (세는 아이 쪽). 이름+ 정책이라 부름 봇처럼 경고를 덜 피한다.
// (A3 분석 identity_runs/runs.js 를 정식으로) 사람 흉내 h_* = 선택지 고르는 법(pick)만 다르고 배식·조사·원정은 균형 봇과 같다 — 아래 HUMAN_PICK.
const POLICIES = {
  balanced: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, bodyAverse: 3 },
  devoted: { share: 1, hand: 1, name: 0, inspect: 'normal', avoidWarn: 0.5, avoidDeadly: 0.3 },
  silent: { share: 0, hand: 0, name: -1, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  caller: { share: 0, hand: 0, name: 1, inspect: 'normal', avoidWarn: 0.3, avoidDeadly: 0.5 },
  lazy: { share: 0, hand: 0, name: 0, inspect: 'lazy', avoidWarn: 1, avoidDeadly: 1 },
  diligent: { share: 0, hand: 0, name: 0, inspect: 'diligent', avoidWarn: 1, avoidDeadly: 1 },   // 발견율 상한 보고용
  risky: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 0, avoidDeadly: 1, risky: true },   // 모험: 판정 있고 경고 붙은 선택을 우선(≥35%), 원정 매일·2층 우선, 거래·협정·범람수는 자원 + 최대. 확정 죽음은 위험이 아니라 피한다
  steward: { share: 1, hand: -1, name: 1, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },   // 몫+·손−·이름+ (10-23 리드 지적 A2: 이 조합이 없어 정체 후보 inspector 가 거의 안 나왔다). 나누고, 손대지 않고, 이름을 부른다
  counter: { share: -1, hand: 1, name: 1, inspect: 'normal', avoidWarn: 0.3, avoidDeadly: 0.5 },   // 10번째: 몫−·손+·이름+ (센 자 쪽)
  child: { share: -1, hand: -1, name: 1, inspect: 'normal', avoidWarn: 0.3, avoidDeadly: 0.5 },    // 11번째: 몫−·손−·이름+ (세는 아이 쪽)
  selfish_nb: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  selfish_rt: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, bodyAverse: 3, tabooBonus: 6 },
  selfish_rt0: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, tabooBonus: 6 },
  h_random: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'random' },        // 정말 아무거나
  h_wary: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'wary' },            // 아무거나, 단 죽음 글은 피함
  h_first: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'first' },          // 맨 위부터 읽고 죽음 글 아니면 그것 (극단 모형 — 사람 흉내 합격선 묶음에서 뺀다)
  h_cautious: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'cautious' },    // 안전해 보이는 쪽, 다 경고면 성공 % 가 가장 높은 쪽
  h_cautious2: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'cautious2' },  // 안전해 보이는 쪽, 다 경고면 죽음 글·금기 빼고 아무거나
  h_mixed: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, pick: 'mixed' },          // 열에 여섯은 안전한 쪽, 넷은 궁금한 쪽
};
// 조심형 = 경고를 꽉 피하는 점수 정책(모험·사람 흉내·남을 내미는 금기를 좋아하는 정책은 뺀다)
const CAREFUL = Object.keys(POLICIES).filter((k) => POLICIES[k].avoidWarn >= 1 && !POLICIES[k].risky && !POLICIES[k].pick && !POLICIES[k].tabooBonus);
// 합격선 묶음 (stats.gate) — 정체는 성향 봇 평균과 사람 흉내 평균을 따로 낸다(A3 분석 §5: 성향 0 봇 다섯이 같은 결말을 다섯 번 세지 않게)
const GROUPS = {
  personality: ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward', 'counter', 'child'],
  human: ['h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'],
  selfish: ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0'],
};
const RESOURCE_EVENTS = ['trade_shutter', 'patrol_pact', 'drink_flood'];
const isResource = (id) => RESOURCE_EVENTS.some((r) => id === r || String(id || '').startsWith(r + '_'));   // 변형 행(trade_shutter_b·patrol_pact_b)도 같은 거래·협정
// 경고 글이 죽음을 바로 말한다. 화면에 보이는 글이라 E6 안이다.
// '센다' = 차장·위의 것이 세는 것(이 게임에서 세어진 사람은 올라간다 — d3·d9·명부에서 여러 번 보인다) · '아침이 안 올' = 밤을 못 넘긴다
const DEADLY = /끝이다|죽는다|올라간다|못 일어난다|센다|세어진다|아침이 안 올/;   // '세어진다' = 10-24 trial_d3_count warn '소리를 내면 같이 세어진다'
const DEADLY_PENALTY = 10;
const deadlyText = (c) => DEADLY.test(`${c.warn || ''} ${c.hint || ''}`);
// 죽음 위험의 크기: 판정 없는 선택 = 1(그대로 일어난다), 판정 있는 선택 = 화면의 실패 %(10-23: 판정이면 빼 주던 것을 실패 % 만큼 감점으로 —
// 모든 선택지에 경고가 붙으면 낮은 % 감점(±1)만으로 갈려서, 조심형도 45% 죽는 주사위를 무릎 꿇기·손가락보다 먼저 골랐다)
const deadlyRisk = (c) => (!deadlyText(c) ? 0 : c.check && c.chance != null ? Math.max(0, 100 - c.chance) / 100 : 1);
// 모험이 판정 없는 경고에 주는 감점: 굴릴 것 없이 손해만 확정이라 동점이면 경고 없는 쪽(10-23: d8_patrol_return '내주지 않는다' 확정 사망이 0점 동점으로 반반이었다)
const RISKY_FLAT_WARN = 0.5;
// 약으로 몸을 고치는 선택: 비용이 약뿐이고, 원정·거래 사건이 아니고, 봇이 몸이 성치 않음을 알 때(부상 ≥1, 또는 제 손으로 고른 일로 생긴 병 — 범람수를 마심·손을 베임)
const SICK_FLAGS = ['drank_flood', 'flood_sick_days', 'cut_hand'];
const unwell = (s) => (s.people.you.n.injury || 0) >= 1 || SICK_FLAGS.some((f) => s.flags[f]);
const isRecovery = (c, eventId, ctx) => !!(ctx && ctx.unwell && ctx.kind !== 'trip' && c.cost && c.cost.meds && Object.keys(c.cost).every((k) => k === 'meds') && !isResource(eventId));
// 몸이 성치 않을 때 약으로 고치는 선택은 먼저 고른다(모든 정책). 모험의 판정 가점(+4)보다 크다 — 약을 손에 두고 열 주사위에 목숨을 거는 건
// 모험(위험 ↔ 보상)이 아니라 봇의 버릇이다(10-22 검증 3: verify_risky3 — 아플 때 약을 쓰면 모험 생존이 약 두 배). 회복 선택의 경고 글('약이 준다')은 비용을 다시 말할 뿐이다.
const RECOVERY_BONUS = 5;
const OPT = { peek: false, perObject: false };   // run.js --peek: 옛 '바뀐 흔적' 판단으로 비교 · --per-object: 옛 아침 조사(물건 하나씩, 10-24 전)로 비교
// (10-24) 제 몸으로 치르는 경고 글 · 남을 내미는 금기(화면 글: label·warn) · 둘 다 경고인 갈림의 동점 폭(A3 분석 §5 — 판정 % 몇 점 차로 매판 같은 쪽을 받는 버릇을 없앤다)
const BODY = /다친다|잃는다|상한다/;
const OTHER_TABOO = /그 사람|남의|옆 |다른/;
const TIE_WARN = 0.2;
// 위기 사건(명세 §3-2 '①값 ②금기 ③판정'): 걸렸을 때 값 길(비용 있는 금기 아닌 선택)이 열려 있었나를 센다(검토 지적 18)
const CRISIS = ['d2_shutter_arm', 'd4_spanner', 'd5_flood'];
const D3_COUNT = /^trial_d3_count(_|$)/;   // D3 밤 셈(trial_d3_count·_b·_c) — '함께 센다' 비율 집계용
const INSPECT = { diligent: { objects: 99, talk: 2, rumors: 99 }, normal: { objects: 2, talk: 1, rumors: 1 }, lazy: { objects: 1, talk: 0, rumors: 0 } };

// ── 선택 ──
// ctx(선택) = { kind: 사건 kind, unwell: 몸이 성치 않음 } — 없으면 회복 예외 없이 옛 점수
function scoreChoice(c, pol, eventId, ctx) {
  if (c.locked) return -Infinity;
  let sc = 0;
  if (pol.risky) {
    if (isResource(eventId)) return (c.gain || 0) * 10 + (c.cost ? -0.5 : 0);
    if (c.check && (c.warn || c.hint)) sc += c.chance >= 35 ? 4 : -2;   // 모험이 즐기는 위험 = 판정(%)이 있는 것. 판정 없는 경고에 주던 +1 은 뺐다(10-22 검증 3)
    else if (c.warn || c.hint) sc -= RISKY_FLAT_WARN;
  }
  for (const [k, v] of Object.entries(c.axis || {})) sc += (pol[k] || 0) * v * 2;
  // 봇은 메타의 killYou 를 안 본다 — 화면처럼 warn·hint·cost·% 와 경고 글만 본다. (killYou 는 통계용으로만 메타에 남긴다)
  if (c.warn || c.hint) sc -= 2 * pol.avoidWarn;
  if (isRecovery(c, eventId, ctx)) sc += RECOVERY_BONUS;      // 아플 때 약을 쓰는 건 비용 감점 없이 먼저
  else if (c.cost) sc -= 0.5;
  if (c.chance != null) sc += (c.chance - 50) / 50;            // 판정 % 가 낮으면 감점
  if (c.taboo) sc -= 3 - (pol.tabooBonus && OTHER_TABOO.test(`${c.label || ''} ${c.warn || ''}`) ? pol.tabooBonus : 0);   // tabooBonus: 남을 내미는 금기를 좋아한다(selfish_rt)
  if (pol.bodyAverse && BODY.test(c.warn || '')) sc -= pol.bodyAverse;                                                       // 제 몸으로 치르기를 꺼린다(selfish·selfish_rt)
  sc -= DEADLY_PENALTY * (pol.avoidDeadly != null ? pol.avoidDeadly : 1) * deadlyRisk(c);
  return sc;
}
// ── 사람 흉내 (A3 분석 identity_runs/runs.js 그대로) — 화면 글(label·warn·hint·taboo·cost·%)만 본다 ──
const openOf = (ms) => ms.filter((c) => !c.locked);
const warnedC = (c) => !!(c.warn || c.hint || c.taboo);
const pickUniform = (s, set) => set[Math.floor(R.rand(s) * set.length)].i;
function cautiousPick(s, ms, dice) {
  const o = openOf(ms); if (!o.length) return ms[0].i;
  let set = o.filter((c) => !warnedC(c));
  if (set.length) { const nc = set.filter((c) => !c.cost); return pickUniform(s, nc.length ? nc : set); }
  set = o.filter((c) => !deadlyText(c) && !c.taboo); if (!set.length) set = o;
  if (!dice) return pickUniform(s, set);
  const best = Math.max(...set.map((c) => (c.chance != null ? c.chance : 100)));
  return pickUniform(s, set.filter((c) => (c.chance != null ? c.chance : 100) === best));
}
const waryPick = (s, ms) => { const o = openOf(ms); if (!o.length) return ms[0].i; const nd = o.filter((c) => !deadlyText(c)); return pickUniform(s, nd.length ? nd : o); };
const HUMAN_PICK = {
  random: (s, ms) => { const o = openOf(ms); return o.length ? pickUniform(s, o) : ms[0].i; },
  wary: (s, ms) => waryPick(s, ms),
  first: (s, ms) => { const o = openOf(ms).filter((c) => !deadlyText(c)); return (o[0] || openOf(ms)[0] || ms[0]).i; },
  cautious: (s, ms) => cautiousPick(s, ms, true),
  cautious2: (s, ms) => cautiousPick(s, ms, false),
  mixed: (s, ms) => (R.rand(s) < 0.6 ? cautiousPick(s, ms, true) : waryPick(s, ms)),
};
// 동점: 점수가 같으면 시드 난수. (10-24 A3) 가장 높은 쪽이 경고 선택이면, 경고 붙은 다른 선택 가운데 TIE_WARN(0.2점) 안쪽도 동점으로 본다.
function pickChoice(s, db, pol, metas) {
  metas = metas || E.choiceMeta(s, db);
  if (!metas) return -1;
  if (pol.pick && HUMAN_PICK[pol.pick]) return HUMAN_PICK[pol.pick](s, metas);
  const ev = db.events[s.pending.id];
  const ctx = { kind: ev ? ev.kind : '', unwell: unwell(s) };
  const scored = metas.map((c) => ({ c, sc: scoreChoice(c, pol, s.pending.id, ctx) }));
  const best = scored.reduce((m, x) => Math.max(m, x.sc), -Infinity);
  if (best === -Infinity) return metas.findIndex((c) => !c.locked);
  let cands = scored.filter((x) => Math.abs(x.sc - best) < 1e-9);
  if (cands.every((x) => warnedC(x.c))) cands = scored.filter((x) => x.sc > -Infinity && best - x.sc < TIE_WARN && (Math.abs(x.sc - best) < 1e-9 || warnedC(x.c)));
  return (cands.length === 1 ? cands[0] : R.pick(s, cands)).c.i;
}
// 강제 사망·앞선 자유 경고 선택은 엔진이 사인 기록(s.ended.cause.forced·free)에 남긴다 — 봇은 따로 적지 않는다(10-22).
function settle(s, db, pol, trace) {
  let g = 0;
  while (s.pending && !s.ended && g++ < 20) {
    const metas = E.choiceMeta(s, db);
    if (trace && CRISIS.includes(s.pending.id)) { const k = s.pending.id; const cr = (trace.crisis = trace.crisis || {}); cr[k] = cr[k] || { reached: 0, costOpen: 0 }; cr[k].reached++; if (metas.some((c) => c.cost && !c.taboo && !c.locked)) cr[k].costOpen++; }   // 위기 때 값 길이 열려 있었나
    const i = pickChoice(s, db, pol, metas);
    const evId = s.pending.id;
    const r = E.dispatch(s, { type: 'choose', i }, db);
    if (!r.ok) { const v = E.eventView(s, db); const j = v.choices.findIndex((c) => !c.locked); if (j < 0 || !E.dispatch(s, { type: 'choose', i: j }, db).ok) break; }
    if (trace) trace.choices++;
    if (trace && D3_COUNT.test(evId) && s.lastResult && s.lastResult.event === evId) trace.d3 = s.lastResult.choice;   // 집계(10-24 P0-E2 재측정): D3 셈에서 고른 선택 — 난수를 쓰지 않는다
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
  // 칸 단위(10-24 P0-E2): 화면은 Space 한 번에 그 칸의 물건 전부를 차례로 조사한다(P0-S6 — 머리맡 묶음 = 물통·붕대가 한 칸).
  //   봇도 칸을 고르고 그 칸의 물건 전부를 inspect 한다. 조사 수(INSPECT.objects) = 칸 수. 칸에 바뀐 흔적이 하나라도 있으면 '바뀐 칸'.
  const near = (o) => !map.fire || Math.max(Math.abs(o.x - map.fire[0]), Math.abs(o.y - map.fire[1])) <= 8;
  const cells = []; const at = {};
  for (const o of map.objects || []) {
    if (!(pol.inspect === 'diligent' || near(o)) || !s.traces[o.id]) continue;
    const k = OPT.perObject ? o.id : `${o.x},${o.y}`;   // perObject = 옛 판단(물건 하나 = 한 번) — 난수 쓰임까지 10-24 전과 같다
    if (!at[k]) { at[k] = []; cells.push(k); }
    if (!at[k].includes(o.id)) at[k].push(o.id);
  }
  const known = trace.known;
  const isChanged = OPT.peek ? (id) => s.traces[id].st !== db.objects[id].states[0] && !s.traces[id].seen   // 옛 판단(10-21b): 숨은 seen 깃발로 '밤에 손댄 것'을 안다
    : (id) => !s.traces[id].seen && s.traces[id].st !== (known[id] !== undefined ? known[id] : db.objects[id].states[0]);
  const changed = cells.filter((k) => at[k].some(isChanged));
  const rest = cells.filter((k) => !changed.includes(k));
  const order = changed.concat(R.pick(s, [rest]) ? shuffle(s, rest) : rest);
  let n = 0;
  for (const k of order) {
    if (n >= rule.objects) break;
    let any = false;
    for (const id of at[k]) { if (act(s, db, { type: 'inspect', object: id })) { any = true; settle(s, db, pol, trace); } if (s.ended) return; }
    if (any) n++;
  }
  let heard = 0;
  for (let i = 0; i < s.rumors.length && heard < rule.rumors; i++) if (!s.rumors[i].heard && act(s, db, { type: 'hear', i })) heard++;
  let talked = 0;
  for (const id of shuffle(s, db.peopleOrder.filter((p) => p !== 'you' && s.people[p].status === 'home' && E.known(s, db, p)))) { if (talked >= rule.talk) break; if (act(s, db, { type: 'talk', who: id })) { talked++; settle(s, db, pol, trace); } if (s.ended) return; }
}
// ── 원정 지도 뒤지기 (P1-11 엔진 몫 · U4 '걸어가서 수납을 연다') ──
// 원정 지도: 지역 → [1층, 2층]. 화면 game.js 의 TRIP_MAPS 와 같아야 한다(sim.test 가 맞춰 본다).
const TRIP_MAPS = { A: ['mall_a1', 'mall_a2'], B: ['drain_b1', 'drain_b2'] };
// 원정 사건 when 의 inspect:물건 이 가리키는 물건 id 전부(표마다 한 번 셈)
const GATED_OBJECTS = new WeakMap();
function gatedObjects(db) {
  if (GATED_OBJECTS.has(db)) return GATED_OBJECTS.get(db);
  const out = new Set();
  for (const ev of db.eventsList) if (ev.kind === 'trip' && E.inspectGated(ev)) for (const n of E.cond.names(E.cond.compile(ev.when))) if (E.cond.prefixOf(n) === 'inspect') out.add(n.slice(n.indexOf(':') + 1));
  GATED_OBJECTS.set(db, out);
  return out;
}
// 지금 층 지도의 물건 가운데 '열 것' — 닫힌 수납(holds) 또는 inspect:물건 이 걸린 원정 사건이 있는 물건 — 을 지도에 적힌 순서대로 조사한다.
// 화면에서 걸어가 Space 를 누르는 것과 같다. 표에 그런 물건이 없으면 아무것도 하지 않는다(도착 사건만 있는 표 = 10-24 전과 같은 판).
function tripSearch(s, db, pol, trace) {
  if (!s.trip || s.ended) return 0;
  const maps = TRIP_MAPS[s.trip.region];
  const map = maps ? db.maps[maps[s.trip.floor - 1]] : null;
  if (!map) return 0;
  const gated = gatedObjects(db);
  let n = 0;
  for (const o of map.objects || []) {
    if (s.ended || !s.trip) break;
    if (s.pending) settle(s, db, pol, trace);
    if (!(E.closedHolds(s, db, o.id) || gated.has(o.id))) continue;
    if (act(s, db, { type: 'inspect', object: o.id })) { n++; settle(s, db, pol, trace); }
  }
  if (trace && n) trace.searched = (trace.searched || 0) + n;   // 집계용: 원정에서 조사한 물건 수
  return n;
}
function shuffle(s, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function rationStep(s, db, pol) {
  const home = db.peopleOrder.filter((id) => s.people[id].status === 'home' && E.known(s, db, id));   // 배식 창에는 역에 있는 만난 사람만(10-24 P0-E1)
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
    if (act(s, db, { type: 'trip', region, floor: 1, walk: true })) { trace.trips++; settle(s, db, pol, trace); tripSearch(s, db, pol, trace); }   // 원정은 1층부터, 그다음 바로 아래층 (엔진 규칙 10-22) · walk = 도착 사건이 없어도 그 층에 들어섰으면 ok(P1-11)
    if (s.ended) return;
    if (s.trip && act(s, db, { type: 'trip', region, floor: 2, walk: true })) { settle(s, db, pol, trace); tripSearch(s, db, pol, trace); }
    return;
  }
  if (!low || hurt) return;
  const region = s.day % 2 === 0 ? 'A' : 'B';
  if (act(s, db, { type: 'trip', region, floor: 1, walk: true })) { trace.trips++; settle(s, db, pol, trace); tripSearch(s, db, pol, trace); }
  if (s.ended) return;
  if (s.day >= 4 && !hurt && act(s, db, { type: 'trip', region, floor: 2, walk: true })) { settle(s, db, pol, trace); tripSearch(s, db, pol, trace); }
}
function eveningStep(s, db, pol, trace) {
  settle(s, db, pol, trace);
  if ((s.people.you.n.injury || 0) >= 2) act(s, db, { type: 'treat', who: 'you' });   // 원정에서 다친 뒤 저녁에 치료
  treatResidents(s, db, pol);
  const rule = INSPECT[pol.inspect];
  const home = shuffle(s, db.peopleOrder.filter((p) => p !== 'you' && s.people[p].status === 'home' && E.known(s, db, p)));   // 말 걸 수 있는 사람 = 만난 사람(안 만난 서하는 잠긴 역무실 안)
  if (home.length && rule.talk > 0 && act(s, db, { type: 'talk', who: home[0] })) settle(s, db, pol, trace);
  for (let i = 0; i < s.rumors.length; i++) if (!s.rumors[i].heard && rule.rumors > 0) { act(s, db, { type: 'hear', i }); break; }
  writeCauses(s, db, pol);
}
// 위독한 주민 치료(10-23): 저녁 = 그날 마지막 치료 기회. 화면에도 '상처를 감아 준다'(game.js treat)가 있고, 주민의 다친 정도는 화면에 보인다.
// 몫이 0 이상인 정책만 — 헌신형(몫+)은 약을 다 쓰고, 중립은 자기 몫 1을 남긴다. 이기적(몫−)은 남을 치료하지 않는다.
// (전에는 봇이 자기만 치료해서, 밤 사건으로 위독해진 기철이 하루 유예 뒤에도 거의 늘 죽었다 — 10-22 검증 지적 25의 나머지)
function treatResidents(s, db, pol) {
  if (pol.share < 0) return;
  const max = db.numbers.injury ? db.numbers.injury.max : 3;
  const need = Number.isFinite(s.world.treat_meds) ? s.world.treat_meds : 1;
  const reserve = pol.share > 0 ? 0 : 1;
  const crit = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home' && E.known(s, db, id) && (s.people[id].n.injury || 0) >= max && !s.flags[`treated_${id}`]);
  for (const id of crit) { if ((s.world.meds || 0) < need + reserve) break; act(s, db, { type: 'treat', who: id }); }
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
    // 승강장: 물건 조사(화로가 첫 물건이라 pro_platform 이 열린다) 뒤에 순례에게도 말을 건다 — 화면에서 걸어가 Space 를 누르는 것(10-24 P0-E1)
    if (map === 'station') { if (act(s, db, { type: 'talk', who: 'soonrye' })) settle(s, db, pol, trace); if (s.ended) return; }
  }
}

// ── 한 판 ──
function play(db, seed, policyName) {
  const pol = POLICIES[policyName];
  const s = E.newGame(db, seed);
  const trace = { choices: 0, trips: 0, known: {}, hunger: [], d3: null, home9: null, res7: null, crisis: {} };   // hunger = 아침(trace 단계)마다 잰 당신의 굶주림 · d3 = D3 셈에서 고른 선택 label (10-24 재측정)
  // home9 = D9 아침 역에 있는 주민 수(당신이 산 판) · res7 = D7 아침 식량+물+약 (10-24 A4 게으름의 값) · crisis = 위기 사건별 {reached, costOpen}
  let guard = 0;
  while (!s.ended && guard++ < 400) {
    const ph = s.phase;
    if (ph === 'trace') trace.hunger.push(s.people.you.n.hunger || 0);
    if (ph === 'trace' && s.day === 9 && trace.home9 == null) trace.home9 = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home').length;
    if (ph === 'trace' && s.day === 7 && trace.res7 == null) trace.res7 = (s.world.food || 0) + (s.world.water || 0) + (s.world.meds || 0);
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

module.exports = { POLICIES, CAREFUL, GROUPS, INSPECT, OPT, D3_COUNT, TRIP_MAPS, tripSearch, DEADLY, DEADLY_PENALTY, RECOVERY_BONUS, RISKY_FLAT_WARN, BODY, OTHER_TABOO, TIE_WARN, CRISIS, HUMAN_PICK, play, morningInspect, pickChoice, scoreChoice, deadlyText, deadlyRisk, isRecovery, isResource, treatResidents };
