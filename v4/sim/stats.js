// 어두운 역 v4 — 정책별 통계와 합격선 판정 (docs/foundation/31_tables_schema.md §4 · §6-6)
const N = require('../engine/night.js');
const E = require('../engine/engine.js');
const C = require('../engine/cond.js');
const { DEADLY, GROUPS, CRISIS } = require('./bots.js');
const D3_TOGETHER = '함께 센다';   // trial_d3_count·_b·_c 의 소리 내는 선택

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const avg = (a) => (a.length ? Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length) / 100 : 0);
const r1 = (v) => Math.round(10 * v) / 10;

// 사인 선택지에 경고 글(warn·hint·taboo)이 있었나 — 옛 '형식' 기준(비교 열)
const causeChoice = (db, cause) => { const ev = cause.choice != null && !cause.night ? db.events[cause.event] : null; return ev ? ev.choices.find((x) => x.label === cause.choice) || null : null; };   // 밤 사건·새벽 위독은 선택이 아니다
function lastHadWarnText(db, cause) { const c = causeChoice(db, cause); return !!((c && (c.warn || c.hint || c.taboo)) || (cause.swapped && cause.warned)); }
// 봇 버릇 점검(10-23): '죽음을 말하는 경고 글'(bots.DEADLY) 선택지를 골라 죽었는데, 그때 열려 있던 다른 선택지 가운데
// '평범한 대안'(당신을 죽일 수 없고, 금기 아니고, 죽음 글 없음 — 예: 무릎을 꿇는다)이 있었나. 조심형 봇에선 0이어야 한다.
// 다른 길이 모두 죽음 주사위거나 금기(남의 물병·담요)뿐이면 버릇이 아니라 그 사건이 낸 선택이다.
// 열린 선택지 = 엔진 lastResult.alts(고를 때의 모습, swap 뒤 — 10-24) · 없으면(옛 상태) lastResult.open + 표의 선택지
const deathText = (c) => DEADLY.test(`${c.warn || ''} ${c.hint || ''}`);
function deadlyPicked(db, s, cause) {
  if (!cause || cause.forced || cause.night || cause.choice == null) return false;
  const r = s.lastResult;
  if (!r || r.event !== cause.event) return false;
  if (Array.isArray(r.alts) && typeof cause.warn === 'string') {
    if (!DEADLY.test(cause.warn)) return false;
    return r.alts.some((a) => a.i !== r.i && !a.kill && !a.taboo && !DEADLY.test(a.warn || ''));
  }
  const c = causeChoice(db, cause); if (!c || !deathText(c)) return false;
  const ev = db.events[cause.event];
  if (!Array.isArray(r.open)) return false;
  return r.open.some((j) => j !== r.i && ev.choices[j] && !E.killsYou(ev.choices[j]) && !ev.choices[j].taboo && !deathText(ev.choices[j]));
}

// ── 사인의 '원인 사건' (10-24 검토 지적 17) ──
// 깔때기 사건 = 부상이 모이는 곳(when 이 당신 부상을 본다: fever_night·wound_critical·d10_walk_weak …) + 새벽 위독(injury_untreated).
// 그 사건으로 죽었으면 '원인' = 당신을 그 자리까지 다치게 한 출처 — s.hurt 를 뒤에서부터 부상 최대값만큼 거슬러 모아, 가장 많이 다치게 한 사건(같으면 나중 것).
// 출처 이름: 사건 id · night:<밤 사건> · neglect:<밤 사건> · holds:<물건>. 깔때기가 아니면 원인 = 사인 사건 그대로.
const FUNNEL = new WeakMap();
function funnelOf(db) {
  if (FUNNEL.has(db)) return FUNNEL.get(db);
  const out = new Set(['injury_untreated']);
  for (const ev of db.eventsList) { let ns = []; try { ns = C.names(C.compile(ev.when)); } catch (e) { ns = []; } if (ns.some((n) => n === 'injury' || n === 'injury_you' || n === 'needs.injury')) out.add(ev.id); }
  FUNNEL.set(db, out);
  return out;
}
const srcKey = (src) => { const k = String(src || '').split('/')[0]; return k.startsWith('ev:') ? k.slice(3) : k; };
//   거슬러 모으는 양 = 죽을 때의 당신 부상(치료로 나은 옛 상처는 세지 않는다). 부상 0 이면(굶주림으로 약해진 d10_walk_weak 등) 원인 = 사인 사건.
function rootCause(db, s, causeKey) {
  if (!causeKey || !funnelOf(db).has(causeKey)) return causeKey;
  const hurt = Array.isArray(s.hurt) ? s.hurt : [];
  const need = (s.people && s.people.you && s.people.you.n.injury) || 0;
  if (need <= 0) return causeKey;
  const sums = {}, last = {}; let acc = 0;
  for (let i = hurt.length - 1; i >= 0 && acc < need; i--) { const k = srcKey(hurt[i].src); sums[k] = (sums[k] || 0) + hurt[i].n; if (last[k] === undefined) last[k] = i; acc += hurt[i].n; }
  const ks = Object.keys(sums);
  if (!ks.length) return causeKey;
  ks.sort((a, b) => (sums[b] - sums[a]) || (last[b] - last[a]));
  return ks[0];
}

// 한 판에서 뽑는 값
function measure(db, s, trace) {
  trace = trace || {};
  const you = s.people.you;
  const dead = you.status === 'dead' || you.status === 'ascended';
  const residents = db.peopleOrder.filter((id) => id !== 'you' && db.people[id] && !db.people[id].outside);
  const allDead = residents.every((id) => !['home', 'away', 'boarded', 'walked'].includes(s.people[id].status));   // away = 아직 안 온 사람(살아 있다)
  // explicit = 고른 적 있는 적나라 사건 수(서로 다른 id). s.fired 는 once:0(되풀이) 사건도 센다 — s.done 만 보면 빠졌다
  const explicit = Object.keys(s.fired || s.done).filter((id) => db.events[id] && db.events[id].explicit).length;
  const disc = N.discovery(s);
  // (10-24 E2·검토 지적 16) 밤 사건 = 주민 사건만 — 세계 시계·방치 판정 줄(role neglect)은 뺀다
  const resident = s.nightLog.filter(N.isResidentRow);
  const malice = resident.filter((e) => e.kind === 'malice').length, hymn = resident.filter((e) => e.kind === 'hymn').length;
  const hymnFound = resident.filter((e) => e.kind === 'hymn' && e.discovered).length;
  const neglectRows = s.nightLog.filter((e) => e.role === 'neglect').length;
  const clock = s.nightLog.filter((e) => e.role === 'clock').length;
  const deadRows = s.ended ? s.ended.ledger.filter((r) => r.id !== 'you' && (r.status === 'dead' || r.status === 'ascended')) : [];
  const blank = deadRows.filter((r) => r.cause == null).length;
  const days = Math.max(1, Math.min(s.day, 10));
  const cause = s.ended && s.ended.cause ? s.ended.cause : null;
  const causeKey = dead ? (cause ? cause.event : (s.ended && s.ended.why === 'all_dead' ? '전멸' : s.ended ? s.ended.why : 'none')) : null;
  const deathDay = dead ? (you.day != null ? you.day : s.day) : null;
  const root = dead ? rootCause(db, s, causeKey) : null;
  return {
    seed: s.seed, days: s.day, dead, why: s.ended ? s.ended.why : 'none', cause,
    allDead, identity: s.ended ? s.ended.identity : null, nights: resident.length, clock, malice, hymn, found: disc.found, unknown: disc.unknown, hymnFound,
    train: !!(s.ended && s.ended.why === 'd10_train'), survived: !!(s.ended && s.ended.why !== 'you_gone' && !dead),
    explicit, decisionsPerDay: s.stats.decisions / days, deadRows: deadRows.length, blank, trips: trace.trips || 0, nightsRolled: s.stats.nights,
    // 엔진의 사인 기록(s.ended.cause)에서: 강제 사망 = 그 순간 당신이 죽지 않는 열린 선택지가 0개(선택지 하나뿐인 죽음, 다른 길이 모두 잠긴 주사위).
    // freeBefore = 갈림길 — 강제면 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택), 아니면 마지막 자유 경고 선택 "사건/선택"
    // warned = 실질 경고(경고 글 있고 강제 아님, 10-22 리드 결정) · warnText = 마지막 선택지에 경고 글이 있었는지(옛 형식 기준, 비교용)
    forced: dead && !!(cause && cause.forced),
    freeBefore: dead && cause && cause.free ? `${cause.free.event}/${cause.free.choice}` : null,
    warned: dead && !!(cause && cause.warned),
    warnText: dead && !!(cause && lastHadWarnText(db, cause)),
    deadlyPick: dead && !!(cause && deadlyPicked(db, s, cause)),
    // 10-24 재측정(P0-E2): 아침마다 잰 당신 굶주림의 판 평균 · D3 셈(trial_d3_count*)에서 고른 선택 label(못 갔으면 null)
    hunger: Array.isArray(trace.hunger) && trace.hunger.length ? trace.hunger.reduce((a, b) => a + b, 0) / trace.hunger.length : null,
    d3: trace.d3 != null ? trace.d3 : null,
    // 10-24 A1·A2·A4 (명세 §6-2): 죽은 날 · D1~D4 생존 · D5까지 사망 · 사인 사건 · 원인 사건(부상 출처) · 그날 사건으로 죽음(깔때기 아님)
    deathDay, causeKey, root, aliveD4: !dead || deathDay > 4, deadByD5: dead && deathDay <= 5,
    dayEvent: dead && !funnelOf(db).has(causeKey),
    daysLived: dead ? Math.max(0, deathDay) : Math.min(s.day, 10),
    karma: s.world.karma || 0, neglect: (s.stats && s.stats.neglect) || 0, neglectRows,
    home9: trace.home9 != null ? trace.home9 : null, res7: trace.res7 != null ? trace.res7 : null,
    crisis: trace.crisis || {}, swapped: dead && !!(cause && cause.swapped),
  };
}

// 정책별 집계
function aggregate(db, runs) {
  const n = runs.length;
  const deaths = runs.filter((r) => r.dead);
  const byCause = {}, byRoot = {}, byDay = {}, dayEvent = {};
  for (const r of deaths) {
    const k = r.causeKey || (r.cause ? r.cause.event : (r.why === 'all_dead' ? '전멸' : r.why)); byCause[k] = (byCause[k] || 0) + 1;
    const rt = r.root || k; byRoot[rt] = (byRoot[rt] || 0) + 1;
    if (r.deathDay != null) { byDay[r.deathDay] = (byDay[r.deathDay] || 0) + 1; if (r.dayEvent) dayEvent[r.deathDay] = (dayEvent[r.deathDay] || 0) + 1; }
  }
  const top = (o) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e ? { k: e[0], share: pct(e[1], deaths.length) } : { k: '-', share: 0 }; };
  const warned = deaths.filter((r) => r.warned).length;                        // 실질 경고(강제 사망은 들지 않는다)
  const warnText = deaths.filter((r) => r.warnText).length;                    // 형식 기준(옛 줄, 비교용)
  const forced = deaths.filter((r) => r.forced);
  const byForced = {};   // 강제 사망: "죽은 사건 ← 앞선 자유 경고 선택"
  for (const r of forced) { const k = `${r.cause ? r.cause.event : r.why} ← ${r.freeBefore || '(앞선 자유 선택 없음)'}`; byForced[k] = (byForced[k] || 0) + 1; }
  const unwarned = deaths.length - warned;   // 실질 경고 없는 죽음 = 강제 사망 + 경고 글 없는 선택 + 밤 사건 + 새벽 위독 + 사인 없음
  const ids = {};
  for (const r of runs) if (r.identity) ids[r.identity] = (ids[r.identity] || 0) + 1;
  const totalNights = runs.reduce((a, r) => a + r.nights, 0);
  const vals = (k) => runs.map((r) => r[k]).filter((v) => v != null && Number.isFinite(v));
  const crisis = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.crisis || {})) { const c = (crisis[k] = crisis[k] || { reached: 0, costOpen: 0 }); c.reached += v.reached; c.costOpen += v.costOpen; }
  for (const c of Object.values(crisis)) c.rate = pct(c.costOpen, c.reached);
  return {
    n, deathRate: pct(deaths.length, n), warnedRate: pct(warned, deaths.length), warnTextRate: pct(warnText, deaths.length), unwarned, deaths: deaths.length, starveDeaths: deaths.filter((r) => r.cause && r.cause.event === 'starve_you').length, byCause,
    allDead: pct(runs.filter((r) => r.allDead).length, n),
    nights: avg(runs.map((r) => r.nights)), malice: avg(runs.map((r) => r.malice)), hymn: avg(runs.map((r) => r.hymn)),
    discovery: pct(runs.reduce((a, r) => a + r.found, 0), totalNights),
    unknownOk: pct(runs.filter((r) => r.unknown >= 1).length, n),
    hymnDiscovery: pct(runs.reduce((a, r) => a + r.hymnFound, 0), runs.reduce((a, r) => a + r.hymn, 0)),
    explicit: avg(runs.map((r) => r.explicit)), decisions: avg(runs.map((r) => r.decisionsPerDay)),
    blank: pct(runs.reduce((a, r) => a + r.blank, 0), runs.reduce((a, r) => a + r.deadRows, 0)),
    identity: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, pct(v, n)])),
    days: avg(runs.map((r) => r.days)), trips: avg(runs.map((r) => r.trips)), train: pct(runs.filter((r) => r.train).length, n), survived: pct(runs.filter((r) => r.survived).length, n), clock: avg(runs.map((r) => r.clock)),
    starveShare: pct(deaths.filter((r) => r.cause && r.cause.event === 'starve_you').length, deaths.length),
    forced: forced.length, forcedRate: pct(forced.length, deaths.length), forcedTraced: forced.filter((r) => r.freeBefore).length, byForced,
    deadlyPick: deaths.filter((r) => r.deadlyPick).length,
    hunger: avg(runs.filter((r) => r.hunger != null).map((r) => r.hunger)),                       // 당신 굶주림(아침) 평균
    d3Reached: pct(runs.filter((r) => r.d3 != null).length, n),                                 // D3 셈 사건까지 간 판
    d3Together: pct(runs.filter((r) => r.d3 === D3_TOGETHER).length, runs.filter((r) => r.d3 != null).length),   // 그중 '함께 센다'
    // 10-24 A1·A2·A4
    aliveD4: pct(runs.filter((r) => r.aliveD4 !== false).length, n),                           // D1~D4 생존(D5 아침까지 산 판)
    deadByD5: pct(runs.filter((r) => r.deadByD5).length, n),                                    // D5까지 당신 사망
    byDay, dayEvent, byRoot, topCause: top(byCause), topRoot: top(byRoot),
    karma: avg(vals('karma')), neglect: avg(vals('neglect')), neglectRows: avg(vals('neglectRows')),
    home9: avg(vals('home9')), home9N: vals('home9').length, res7: avg(vals('res7')), res7N: vals('res7').length,
    daysLived: avg(vals('daysLived')), crisis, swappedDeaths: deaths.filter((r) => r.swapped).length,
  };
}

// 합격선 판정 (31 §4 · §6-6). aggs: {policy: aggregate}, candidates: 후보 수(또는 후보 id 목록), careful: 조심형 정책 이름 목록(bots.CAREFUL)
// rows = [항목, 합격선, 실측, 통과, 경계]. 경계 = %로 재는 줄의 실측이 합격선에서 margin(기본 5%p) 안 — 표본이 바뀌면 뒤집힐 수 있어 ✓로 확정하지 않는다
// opts.groups = { personality, human, selfish } (기본 bots.GROUPS) — 없는 정책은 건너뛰고, 묶음이 비면 그 줄은 '-'(미달)
const MARGIN = 5;
const nearAny = (pairs, margin) => pairs.some(([v, line]) => Number.isFinite(v) && Number.isFinite(line) && Math.abs(v - line) <= (margin == null ? MARGIN : margin));
const sgn = (v) => (v > 0 ? '+' : '') + r1(v);
function gate(aggs, candidates, careful, opts) {
  opts = opts || {};
  const G = Object.assign({}, GROUPS, opts.groups || {});
  const first = aggs[Object.keys(aggs)[0]];
  const b = aggs.balanced || first, lazy = aggs.lazy || b, dil = aggs.diligent || b;
  const candIds = Array.isArray(candidates) ? candidates : null;
  const nCand = candIds ? candIds.length : candidates;
  const idAll = {};
  for (const a of Object.values(aggs)) for (const [k, v] of Object.entries(a.identity || {})) idAll[k] = (idAll[k] || 0) + v;
  const npol = Object.keys(aggs).length;
  for (const k of Object.keys(idAll)) idAll[k] = Math.round((10 * idAll[k]) / npol) / 10;
  const thr = Math.round((1000 / nCand / 2)) / 10;
  const sum = (k) => Object.values(aggs).reduce((t, a) => t + (a[k] || 0), 0);
  const risky = aggs.risky;
  const starveAll = pct(sum('starveDeaths'), sum('deaths'));
  const forcedAll = pct(sum('forced'), sum('deaths'));
  const care = (careful || []).filter((k) => aggs[k]);
  const careN = care.reduce((t, k) => t + aggs[k].n, 0), careD = care.reduce((t, k) => t + aggs[k].deaths, 0), careF = care.reduce((t, k) => t + aggs[k].forced, 0);
  const careRate = pct(careD, careN), careForced = pct(careF, careD);
  const careDeadly = care.reduce((t, k) => t + (aggs[k].deadlyPick || 0), 0);
  const idOk = Object.values(idAll).filter((v) => v >= 7).length;
  // 정체 묶음 평균 (A3 분석 §5 추천: 성향 봇 평균과 사람 흉내 평균을 따로)
  const groupId = (names) => {
    const ps = names.filter((k) => aggs[k]);
    const out = {};
    for (const k of ps) for (const [c, v] of Object.entries(aggs[k].identity || {})) out[c] = (out[c] || 0) + v;
    for (const c of candIds || Object.keys(out)) out[c] = ps.length ? r1((out[c] || 0) / ps.length) : 0;
    return { ps, out };
  };
  const idP = groupId(G.personality), idH = groupId(G.human);
  const ID_MIN = 3, ID_MAX = 40;
  const idRow = (label, g, line) => {
    const vs = Object.values(g.out);
    const full = candIds ? candIds.every((c) => g.out[c] != null) : vs.length >= nCand;
    return [label, `각 ≥ ${line}%`, g.ps.length ? Object.entries(g.out).map(([k, v]) => `${k} ${v}`).join(' · ') + ` (${g.ps.length}종)` : '-', g.ps.length > 0 && full && vs.length >= nCand && vs.every((v) => v >= line), nearAny(vs.map((v) => [v, line]), line / 2)];
  };
  const maxOf = (g) => { const e = Object.entries(g.out).sort((x, y) => y[1] - x[1])[0]; return e ? { k: e[0], v: e[1] } : { k: '-', v: 0 }; };
  const mP = maxOf(idP), mH = maxOf(idH);
  // 정책 사이 차이 (%p 또는 평균 차)
  const has = (a, k) => !!a && Number.isFinite(a[k]) && !(a[k + 'N'] === 0);   // home9N·res7N = 그 아침까지 간 판 수 — 0 이면 값이 없다
  const diff = (x, y, k) => (has(aggs[x], k) && has(aggs[y], k) ? Math.round(100 * (aggs[x][k] - aggs[y][k])) / 100 : null);
  const fmtDiff = (pairs) => pairs.map(([lab, v]) => `${lab} ${v == null ? '-' : sgn(v)}`).join(' / ');
  // A1: 이기적 묶음
  const selfs = G.selfish.filter((k) => aggs[k]);
  const sDiff = selfs.map((k) => [k, diff(k, 'balanced', 'survived')]);
  const sTop = selfs.map((k) => [k, aggs[k].deaths ? aggs[k].topCause : { k: '-', share: 0 }]);
  // A2: D2~D6 날마다 그날 사건으로 죽은 판(정책 합산)
  const dayEv = {}; for (const a of Object.values(aggs)) for (const [d, v] of Object.entries(a.dayEvent || {})) dayEv[d] = (dayEv[d] || 0) + v;
  const D26 = [2, 3, 4, 5, 6];
  // A4: 게으름의 값 (보통 = balanced 가 주 지표, 부지런 = 상한 봇)
  const lzS = [['보통−게으름', diff('balanced', 'lazy', 'survived')], ['부지런−게으름', diff('diligent', 'lazy', 'survived')]];
  const lzH = [['보통−게으름', diff('balanced', 'lazy', 'home9')], ['부지런−게으름', diff('diligent', 'lazy', 'home9')]];
  const lzR = [['보통−게으름', diff('balanced', 'lazy', 'res7')], ['부지런−게으름', diff('diligent', 'lazy', 'res7')]];
  const okAll = (pairs, f) => pairs.every(([, v]) => v != null && f(v));
  const cr = (b && b.crisis) || {};
  const rows = [
    ['당신 사망(올라감 포함)', '≥ 50%', `${b.deathRate}%`, b.deathRate >= 50, nearAny([[b.deathRate, 50]])],
    ['사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음)', '100%', b.deaths ? `${b.warnedRate}% (형식 기준 ${b.warnTextRate}%)` : '사망 없음', b.warnedRate === 100 || b.deathRate === 0, nearAny([[b.warnedRate, 100]])],
    ['강제 사망 (전 정책 합산)', '0 판 (10-24 바꿈: ≤20% → 0)', `${sum('forced')} 판 (${forcedAll}%, ${sum('forced')}/${sum('deaths')})`, sum('forced') === 0, false],
    ['  강제 사망 중 앞선 자유 경고 선택 없음 (전 정책)', '0 판', `${sum('forced') - sum('forcedTraced')} 판`, sum('forced') - sum('forcedTraced') === 0, false],
    ['조심형 봇 사망 (' + (care.join('·') || '없음') + ' 합산)', '측정', care.length ? `${careRate}% (${careD}/${careN}), 그중 강제 ${careForced}%` : '-', true, false],
    ['  봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음', '0 판', care.length ? `${careDeadly} 판 (전 정책 ${sum('deadlyPick')})` : '-', careDeadly === 0, false],
    ['전멸', '≤ 25%', `${b.allDead}%`, b.allDead <= 25, nearAny([[b.allDead, 25]])],
    ['밤 사건 수 / 판 (주민 사건만 — 시계·방치 판정 줄 뺌)', '≥ 6', `${b.nights} (방치 판정 줄 ${b.neglectRows != null ? b.neglectRows : '-'})`, b.nights >= 6, false],
    ['  그중 malice / hymn', '≥ 2 / ≥ 1', `${b.malice} / ${b.hymn}`, b.malice >= 2 && b.hymn >= 1, false],
    ['발견율 (보통)', '측정만 (10-24 A4: 하한 폐기)', `${b.discovery}%`, true, false],
    ['발견율 (게으름)', '측정만 (10-24 A4: 하한 폐기)', `${lazy.discovery}%`, true, false],
    ['끝까지 모르는 사건 ≥1 (게으름)', '100% 판', `${lazy.unknownOk}%`, lazy.unknownOk >= 90, nearAny([[lazy.unknownOk, 90]])],
    ['찬가 발견율 (부지런)', '≥ 70%', `${dil.hymnDiscovery}%`, dil.hymnDiscovery >= 70, nearAny([[dil.hymnDiscovery, 70]])],
    ['찬가 발견율 (게으름)', '측정만 (10-24 A4: 하한 폐기)', `${lazy.hymnDiscovery}%`, true, false],
    idRow('정체 — 성향 봇 평균, 각 후보 (A3)', idP, ID_MIN),
    ['정체 — 성향 봇 평균, 가장 큰 후보 (A3)', `≤ ${ID_MAX}%`, idP.ps.length ? `${mP.k} ${mP.v}%` : '-', idP.ps.length > 0 && mP.v <= ID_MAX, nearAny([[mP.v, ID_MAX]])],
    idRow('정체 — 사람 흉내 평균, 각 후보 (A3)', idH, ID_MIN),
    ['정체 — 사람 흉내 평균, 가장 큰 후보 (A3)', '측정 (디렉터 확인: 승객이 가장 흔한 결말)', idH.ps.length ? `${mH.k} ${mH.v}%` : '-', true, false],
    ['정체 분포 (옛 방식: 정책 전체 평균, 각 후보)', `측정 (옛 합격선 ≥ ${thr}%)`, Object.entries(idAll).map(([k, v]) => `${k} ${v}%`).join(' · ') || '없음', true, false],
    ['  옛 방식: 7후보 중 ≥7% 인 후보 수', '측정 (옛 합격선 ≥ 5)', `${idOk} 후보`, true, false],
    ['explicit 사건 / 판', '≥ 7', `${b.explicit}`, b.explicit >= 7, false],
    ['하루 결정 수', '≥ 5', `${b.decisions}`, b.decisions >= 5, false],
    ['명부 사인 빈칸 비율', '측정만', `${b.blank}%`, true, false],
    ['모험 봇 열흘 생존', '≥ 25% (10-24 바꿈 ≥40 → 25, 디렉터 확인)', risky ? `${risky.survived}%` : '-', !!risky && risky.survived >= 25, !!risky && nearAny([[risky.survived, 25]])],
    ['모험 봇 사망 중 굶주림', '< 50%', risky ? `${risky.starveShare}%` : '-', !!risky && risky.starveShare < 50, !!risky && nearAny([[risky.starveShare, 50]])],
    ['열차 결말 도달 (모험 / 균형)', '> 0%', risky ? `${risky.train}% / ${b.train}%` : `${b.train}%`, (risky ? risky.train : b.train) > 0, false],
    // ── A2 이른 날의 죽음 ──
    ['A2 D5까지 당신 사망 (균형)', '≥ 10%', b.deadByD5 != null ? `${b.deadByD5}%` : '-', Number.isFinite(b.deadByD5) && b.deadByD5 >= 10, nearAny([[b.deadByD5, 10]])],
    ['A2 균형 사망 중 한 사건 비중 (사인 사건)', '≤ 40%', b.topCause ? `${b.topCause.k} ${b.topCause.share}%` : '-', !!b.topCause && b.topCause.share <= 40, !!b.topCause && nearAny([[b.topCause.share, 40]])],
    ['A2 균형 사망 중 한 사건 비중 (원인 사건 = 부상 출처)', '≤ 40%', b.topRoot ? `${b.topRoot.k} ${b.topRoot.share}%` : '-', !!b.topRoot && b.topRoot.share <= 40, !!b.topRoot && nearAny([[b.topRoot.share, 40]])],
    ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌)', '날마다 > 0', D26.map((d) => `D${d} ${dayEv[d] || 0}`).join(' · '), D26.every((d) => (dayEv[d] || 0) > 0), false],
    // ── A1 이기심 = 늦게 오는 카르마 ──
    ['A1 이른 안전: 이기적 D1~D4 생존 − 균형', '≥ +5%p', diff('selfish', 'balanced', 'aliveD4') == null ? '-' : `${sgn(diff('selfish', 'balanced', 'aliveD4'))}%p (${aggs.selfish.aliveD4} vs ${b.aliveD4})`, diff('selfish', 'balanced', 'aliveD4') != null && diff('selfish', 'balanced', 'aliveD4') >= 5, nearAny([[diff('selfish', 'balanced', 'aliveD4'), 5]])],
    ['A1 이기심의 값: 열흘 생존 − 균형 (이기적 4종 각각 — 버릇 없는·끝까지 금기 포함)', '< 0 (모든 정책)', selfs.length ? fmtDiff(sDiff) + '%p' : '-', selfs.length === G.selfish.length && okAll(sDiff, (v) => v < 0), nearAny(sDiff.map(([, v]) => [v, 0]))],
    ['A1 이기적 4종 사인 쏠림 (한 사건 비중)', '≤ 60%', sTop.length ? sTop.map(([k, t]) => `${k} ${t.k} ${t.share}%`).join(' / ') : '-', sTop.length > 0 && sTop.every(([, t]) => t.share <= 60), nearAny(sTop.map(([, t]) => [t.share, 60]))],
    ['  카르마 (판 끝 평균: 균형 / 이기적 4종)', '측정', `${b.karma != null ? b.karma : '-'} / ${selfs.map((k) => aggs[k].karma).join(' · ') || '-'}`, true, false],
    // ── A4 게으름 = 처벌 ──
    ['A4 게으름의 값 — 생존 (보통−게으름 주 지표 / 부지런−게으름)', '≥ +5%p', fmtDiff(lzS) + '%p', okAll(lzS, (v) => v >= 5), nearAny(lzS.map(([, v]) => [v, 5]))],
    ['A4 게으름의 값 — D9 아침 주민 수 차', '> 0', fmtDiff(lzH), okAll(lzH, (v) => v > 0), false],
    ['A4 게으름의 값 — D7 아침 식량+물+약 차', '≥ +0.2', fmtDiff(lzR), okAll(lzR, (v) => v >= 0.2), false],
    ['  못 본 일(missed 적용) / 판 (게으름 / 보통 / 부지런)', '측정', `${lazy.neglect != null ? lazy.neglect : '-'} / ${b.neglect != null ? b.neglect : '-'} / ${dil.neglect != null ? dil.neglect : '-'}`, true, false],
    ['  위기 때 값 길(비용 있는 선택)이 열린 비율 (균형)', '측정 (디렉터 확인)', CRISIS.map((k) => `${k} ${cr[k] ? `${cr[k].rate}% (${cr[k].costOpen}/${cr[k].reached})` : '-'}`).join(' · '), true, false],
    ['헌신 봇 생존', '측정 (> 0%)', aggs.devoted ? `${aggs.devoted.survived}%` : '-', !!aggs.devoted && aggs.devoted.survived > 0, false],
    ['사망 원인 중 굶주림 (전 정책 합산)', '< 50%', `${starveAll}% (${sum('starveDeaths')}/${sum('deaths')})`, starveAll < 50, nearAny([[starveAll, 50]])],
    ['경고 없는 사망 (전 정책 합산, 강제 사망 포함)', '0 판', `${sum('unwarned')} 판 (그중 강제 ${sum('forced')})`, sum('unwarned') === 0, false],
  ];
  return { rows, idAll, thr, idP: idP.out, idH: idH.out };
}
// 여러 시드 블록의 판정을 합친다: 모든 블록 통과·경계 아님 = ✓ · 모든 블록 미달 = ✗ · 그 밖(블록마다 다름, 또는 합격선 ±5%p 안) = △ (확정 안 함)
function combine(gates) {
  return gates[0].rows.map((r0, i) => {
    const rs = gates.map((g) => g.rows[i]);
    const okAll = rs.every((r) => r[3]), okAny = rs.some((r) => r[3]), near = rs.some((r) => r[4]);
    return { k: r0[0], want: r0[1], got: rs.map((r) => r[2]), mark: okAll && !near ? '✓' : !okAny ? '✗' : '△', okAll, near };
  });
}

module.exports = { measure, aggregate, gate, combine, pct, avg, MARGIN, D3_TOGETHER, rootCause, funnelOf, deadlyPicked };
