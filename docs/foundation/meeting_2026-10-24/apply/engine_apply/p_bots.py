p = r'C:\dev\dark_station\v4\sim\bots.js'
t = open(p, encoding='utf8').read()


def rep(a, b, cnt=1):
    global t
    assert t.count(a) == cnt, (a[:90], t.count(a))
    t = t.replace(a, b)


rep("""const POLICIES = {
  balanced: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },""",
"""// (10-24 A1 명세 §6-2 · 검토 지적 1·11) 이기적 봇 넷 — 늦게 오는 값(카르마)이 봇 버릇이 아니라 구조로 오는지 본다:
//   selfish     = 명세 그대로: 몫−·손−, 금기 감점 −3, bodyAverse 3(경고 글에 '다친다·잃는다·상한다'면 −3 — 제 몸으로 치르기를 꺼린다)
//   selfish_nb  = bodyAverse 없음 — 화면을 읽고 '버틴다'를 고르는 이기적 플레이어(버릇 없는 이기적 봇)
//   selfish_rt  = 끝까지 남을 내미는 사람: 남을 내미는 금기(OTHER_TABOO)에 −3 대신 +3(tabooBonus 6) + bodyAverse 3
//   selfish_rt0 = 같은데 bodyAverse 없음
// (10-23 리드 승인 · A3 분석 §6) counter = 몫−·손+·이름+ (센 자 쪽) · child = 몫−·손−·이름+ (세는 아이 쪽). 이름+ 정책이라 부름 봇처럼 경고를 덜 피한다.
// (A3 분석 identity_runs/runs.js 를 정식으로) 사람 흉내 h_* = 선택지 고르는 법(pick)만 다르고 배식·조사·원정은 균형 봇과 같다 — 아래 HUMAN_PICK.
const POLICIES = {
  balanced: { share: 0, hand: 0, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },
  selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, bodyAverse: 3 },""")

rep("""  steward: { share: 1, hand: -1, name: 1, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },   // 몫+·손−·이름+ (10-23 리드 지적 A2: 이 조합이 없어 정체 후보 inspector 가 거의 안 나왔다). 나누고, 손대지 않고, 이름을 부른다
};
const CAREFUL = Object.keys(POLICIES).filter((k) => POLICIES[k].avoidWarn >= 1 && !POLICIES[k].risky);""",
"""  steward: { share: 1, hand: -1, name: 1, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },   // 몫+·손−·이름+ (10-23 리드 지적 A2: 이 조합이 없어 정체 후보 inspector 가 거의 안 나왔다). 나누고, 손대지 않고, 이름을 부른다
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
};""")

rep("""const OPT = { peek: false, perObject: false };   // run.js --peek: 옛 '바뀐 흔적' 판단으로 비교 · --per-object: 옛 아침 조사(물건 하나씩, 10-24 전)로 비교""",
"""const OPT = { peek: false, perObject: false };   // run.js --peek: 옛 '바뀐 흔적' 판단으로 비교 · --per-object: 옛 아침 조사(물건 하나씩, 10-24 전)로 비교
// (10-24) 제 몸으로 치르는 경고 글 · 남을 내미는 금기(화면 글: label·warn) · 둘 다 경고인 갈림의 동점 폭(A3 분석 §5 — 판정 % 몇 점 차로 매판 같은 쪽을 받는 버릇을 없앤다)
const BODY = /다친다|잃는다|상한다/;
const OTHER_TABOO = /그 사람|남의|옆 |다른/;
const TIE_WARN = 0.2;
// 위기 사건(명세 §3-2 '①값 ②금기 ③판정'): 걸렸을 때 값 길(비용 있는 금기 아닌 선택)이 열려 있었나를 센다(검토 지적 18)
const CRISIS = ['d2_shutter_arm', 'd4_spanner', 'd5_flood'];""")

rep("""  if (c.taboo) sc -= 3;
  sc -= DEADLY_PENALTY * (pol.avoidDeadly != null ? pol.avoidDeadly : 1) * deadlyRisk(c);
  return sc;
}""", """  if (c.taboo) sc -= 3 - (pol.tabooBonus && OTHER_TABOO.test(`${c.label || ''} ${c.warn || ''}`) ? pol.tabooBonus : 0);   // tabooBonus: 남을 내미는 금기를 좋아한다(selfish_rt)
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
};""")

rep("""function pickChoice(s, db, pol, metas) {
  metas = metas || E.choiceMeta(s, db);
  if (!metas) return -1;
  const ev = db.events[s.pending.id];
  const ctx = { kind: ev ? ev.kind : '', unwell: unwell(s) };
  let best = -Infinity; let cands = [];
  for (const c of metas) { const sc = scoreChoice(c, pol, s.pending.id, ctx); if (sc > best + 1e-9) { best = sc; cands = [c]; } else if (Math.abs(sc - best) < 1e-9) cands.push(c); }
  if (!cands.length) return metas.findIndex((c) => !c.locked);
  return (cands.length === 1 ? cands[0] : R.pick(s, cands)).i;
}""", """// 동점: 점수가 같으면 시드 난수. (10-24 A3) 가장 높은 쪽이 경고 선택이면, 경고 붙은 다른 선택 가운데 TIE_WARN(0.2점) 안쪽도 동점으로 본다.
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
}""")

rep("""function settle(s, db, pol, trace) {
  let g = 0;
  while (s.pending && !s.ended && g++ < 20) {
    const metas = E.choiceMeta(s, db);""", """function settle(s, db, pol, trace) {
  let g = 0;
  while (s.pending && !s.ended && g++ < 20) {
    const metas = E.choiceMeta(s, db);
    if (trace && CRISIS.includes(s.pending.id)) { const k = s.pending.id; const cr = (trace.crisis = trace.crisis || {}); cr[k] = cr[k] || { reached: 0, costOpen: 0 }; cr[k].reached++; if (metas.some((c) => c.cost && !c.taboo && !c.locked)) cr[k].costOpen++; }   // 위기 때 값 길이 열려 있었나""")

rep("""  const trace = { choices: 0, trips: 0, known: {}, hunger: [], d3: null };   // hunger = 아침(trace 단계)마다 잰 당신의 굶주림 · d3 = D3 셈에서 고른 선택 label (10-24 재측정)
  let guard = 0;
  while (!s.ended && guard++ < 400) {
    const ph = s.phase;
    if (ph === 'trace') trace.hunger.push(s.people.you.n.hunger || 0);""", """  const trace = { choices: 0, trips: 0, known: {}, hunger: [], d3: null, home9: null, res7: null, crisis: {} };   // hunger = 아침(trace 단계)마다 잰 당신의 굶주림 · d3 = D3 셈에서 고른 선택 label (10-24 재측정)
  // home9 = D9 아침 역에 있는 주민 수(당신이 산 판) · res7 = D7 아침 식량+물+약 (10-24 A4 게으름의 값) · crisis = 위기 사건별 {reached, costOpen}
  let guard = 0;
  while (!s.ended && guard++ < 400) {
    const ph = s.phase;
    if (ph === 'trace') trace.hunger.push(s.people.you.n.hunger || 0);
    if (ph === 'trace' && s.day === 9 && trace.home9 == null) trace.home9 = db.peopleOrder.filter((id) => id !== 'you' && s.people[id].status === 'home').length;
    if (ph === 'trace' && s.day === 7 && trace.res7 == null) trace.res7 = (s.world.food || 0) + (s.world.water || 0) + (s.world.meds || 0);""")

rep("""module.exports = { POLICIES, CAREFUL, INSPECT, OPT, D3_COUNT, TRIP_MAPS, tripSearch, DEADLY, DEADLY_PENALTY, RECOVERY_BONUS, RISKY_FLAT_WARN, play, morningInspect, pickChoice, scoreChoice, deadlyText, deadlyRisk, isRecovery, isResource, treatResidents };""",
"""module.exports = { POLICIES, CAREFUL, GROUPS, INSPECT, OPT, D3_COUNT, TRIP_MAPS, tripSearch, DEADLY, DEADLY_PENALTY, RECOVERY_BONUS, RISKY_FLAT_WARN, BODY, OTHER_TABOO, TIE_WARN, CRISIS, HUMAN_PICK, play, morningInspect, pickChoice, scoreChoice, deadlyText, deadlyRisk, isRecovery, isResource, treatResidents };""")
open(p, 'w', encoding='utf8').write(t)
print('ok')
