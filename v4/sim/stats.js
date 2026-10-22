// 어두운 역 v4 — 정책별 통계와 합격선 판정 (docs/foundation/31_tables_schema.md §4)
const N = require('../engine/night.js');

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const avg = (a) => (a.length ? Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length) / 100 : 0);

// 한 판에서 뽑는 값
function measure(db, s, trace) {
  const you = s.people.you;
  const dead = you.status === 'dead' || you.status === 'ascended';
  const residents = db.peopleOrder.filter((id) => id !== 'you' && db.people[id] && !db.people[id].outside);
  const allDead = residents.every((id) => !['home', 'boarded', 'walked'].includes(s.people[id].status));
  // explicit = 고른 적 있는 적나라 사건 수(서로 다른 id). s.fired 는 once:0(되풀이) 사건도 센다 — s.done 만 보면 빠졌다
  const explicit = Object.keys(s.fired || s.done).filter((id) => db.events[id] && db.events[id].explicit).length;
  const disc = N.discovery(s);
  const resident = s.nightLog.filter((e) => e.role !== 'clock');
  const malice = resident.filter((e) => e.kind === 'malice').length, hymn = resident.filter((e) => e.kind === 'hymn').length;
  const hymnFound = s.nightLog.filter((e) => e.kind === 'hymn' && e.discovered).length;
  const deadRows = s.ended ? s.ended.ledger.filter((r) => r.id !== 'you' && (r.status === 'dead' || r.status === 'ascended')) : [];
  const blank = deadRows.filter((r) => r.cause == null).length;
  const days = Math.max(1, Math.min(s.day, 10));
  return {
    seed: s.seed, days: s.day, dead, why: s.ended ? s.ended.why : 'none', cause: s.ended && s.ended.cause ? s.ended.cause : null,
    allDead, identity: s.ended ? s.ended.identity : null, nights: resident.length, clock: s.nightLog.length - resident.length, malice, hymn, found: disc.found, unknown: disc.unknown, hymnFound,
    train: !!(s.ended && s.ended.why === 'd10_train'), survived: !!(s.ended && s.ended.why !== 'you_gone' && !dead),
    explicit, decisionsPerDay: s.stats.decisions / days, deadRows: deadRows.length, blank, trips: trace.trips, nightsRolled: s.stats.nights,
    // 강제 사망 = 선택으로 끝났는데 그 순간 당신 kill 이 없는 열린 선택지가 0개(선택지 하나뿐인 죽음, 다른 길이 모두 잠긴 주사위).
    // freeBefore = 그 죽음 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택) "사건/선택" — 강제 사망의 실제 갈림길
    forced: dead && !!(trace.death && trace.death.forced),
    freeBefore: dead && trace.death && trace.death.lastFree ? `${trace.death.lastFree.event}/${trace.death.lastFree.choice}` : null,
  };
}

// 정책별 집계
function aggregate(db, runs) {
  const n = runs.length;
  const deaths = runs.filter((r) => r.dead);
  const byCause = {};
  for (const r of deaths) { const k = r.cause ? r.cause.event : (r.why === 'all_dead' ? '전멸' : r.why); byCause[k] = (byCause[k] || 0) + 1; }
  const warned = deaths.filter((r) => r.cause && r.cause.warned).length;
  const forced = deaths.filter((r) => r.forced);
  const byForced = {};   // 강제 사망: "죽은 사건 ← 앞선 자유 경고 선택"
  for (const r of forced) { const k = `${r.cause ? r.cause.event : r.why} ← ${r.freeBefore || '(앞선 자유 선택 없음)'}`; byForced[k] = (byForced[k] || 0) + 1; }
  const unwarned = deaths.filter((r) => !(r.cause && r.cause.warned)).length;   // 경고 없는 죽음(사인 없음 포함)
  const ids = {};
  for (const r of runs) if (r.identity) ids[r.identity] = (ids[r.identity] || 0) + 1;
  const totalNights = runs.reduce((a, r) => a + r.nights, 0);
  return {
    n, deathRate: pct(deaths.length, n), warnedRate: pct(warned, deaths.length), unwarned, deaths: deaths.length, starveDeaths: deaths.filter((r) => r.cause && r.cause.event === 'starve_you').length, byCause,
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
  };
}

// 합격선 판정 (31 §4). agg: {policy: aggregate}, candidates: 후보 수, careful: 조심형 정책 이름 목록(bots.CAREFUL)
// rows = [항목, 합격선, 실측, 통과, 경계]. 경계 = %로 재는 줄의 실측이 합격선에서 margin(기본 5%p) 안 — 표본이 바뀌면 뒤집힐 수 있어 ✓로 확정하지 않는다
const MARGIN = 5;
const nearAny = (pairs, margin) => pairs.some(([v, line]) => Number.isFinite(v) && Number.isFinite(line) && Math.abs(v - line) <= (margin == null ? MARGIN : margin));
function gate(aggs, candidates, careful) {
  const first = aggs[Object.keys(aggs)[0]];
  const b = aggs.balanced || first, lazy = aggs.lazy || b, dil = aggs.diligent || b;
  const idAll = {};
  for (const a of Object.values(aggs)) for (const [k, v] of Object.entries(a.identity)) idAll[k] = (idAll[k] || 0) + v;
  const npol = Object.keys(aggs).length;
  for (const k of Object.keys(idAll)) idAll[k] = Math.round((10 * idAll[k]) / npol) / 10;
  const thr = Math.round((1000 / candidates / 2)) / 10;
  const sum = (k) => Object.values(aggs).reduce((t, a) => t + (a[k] || 0), 0);
  const risky = aggs.risky;
  const starveAll = pct(sum('starveDeaths'), sum('deaths'));
  const forcedAll = pct(sum('forced'), sum('deaths'));
  const care = (careful || []).filter((k) => aggs[k]);
  const careN = care.reduce((t, k) => t + aggs[k].n, 0), careD = care.reduce((t, k) => t + aggs[k].deaths, 0), careF = care.reduce((t, k) => t + aggs[k].forced, 0);
  const careRate = pct(careD, careN), careForced = pct(careF, careD);
  const idOk = Object.values(idAll).filter((v) => v >= 7).length;
  const rows = [
    ['당신 사망(올라감 포함)', '≥ 50%', `${b.deathRate}%`, b.deathRate >= 50, nearAny([[b.deathRate, 50]])],
    ['사망 중 경고 있던 선택', '100%', `${b.warnedRate}%`, b.warnedRate === 100 || b.deathRate === 0, false],
    ['강제 사망 비율 (전 정책 합산)', '≤ 20% [제안]', `${forcedAll}% (${sum('forced')}/${sum('deaths')}, 그중 앞선 자유 경고 선택 있음 ${sum('forcedTraced')})`, forcedAll <= 20, nearAny([[forcedAll, 20]])],
    ['  강제 사망 중 앞선 자유 경고 선택 없음 (전 정책)', '0 판', `${sum('forced') - sum('forcedTraced')} 판`, sum('forced') - sum('forcedTraced') === 0, false],
    ['조심형 봇 사망 (' +(care.join('·') || '없음') + ' 합산)', '측정', care.length ? `${careRate}% (${careD}/${careN}), 그중 강제 ${careForced}%` : '-', true, false],
    ['전멸', '≤ 25%', `${b.allDead}%`, b.allDead <= 25, nearAny([[b.allDead, 25]])],
    ['밤 사건 수 / 판', '≥ 6', `${b.nights}`, b.nights >= 6, false],
    ['  그중 malice / hymn', '≥ 2 / ≥ 1', `${b.malice} / ${b.hymn}`, b.malice >= 2 && b.hymn >= 1, false],
    ['발견율 (보통)', '50~70%', `${b.discovery}%`, b.discovery >= 50 && b.discovery <= 70, nearAny([[b.discovery, 50], [b.discovery, 70]])],
    ['발견율 (게으름)', '≥ 40%', `${lazy.discovery}%`, lazy.discovery >= 40, nearAny([[lazy.discovery, 40]])],
    ['끝까지 모르는 사건 ≥1 (게으름)', '100% 판', `${lazy.unknownOk}%`, lazy.unknownOk >= 90, nearAny([[lazy.unknownOk, 90]])],
    ['찬가 발견율 (부지런 / 게으름)', '≥ 70% / ≥ 60%', `${dil.hymnDiscovery}% / ${lazy.hymnDiscovery}%`, dil.hymnDiscovery >= 70 && lazy.hymnDiscovery >= 60, nearAny([[dil.hymnDiscovery, 70], [lazy.hymnDiscovery, 60]])],
    ['정체 분포 (정책 합산, 각 후보)', `≥ ${thr}%`, Object.entries(idAll).map(([k, v]) => `${k} ${v}%`).join(' · ') || '없음', Object.keys(idAll).length === candidates && Object.values(idAll).every((v) => v >= thr), nearAny(Object.values(idAll).map((v) => [v, thr]), thr / 2)],
    ['explicit 사건 / 판', '≥ 7', `${b.explicit}`, b.explicit >= 7, false],
    ['하루 결정 수', '≥ 5', `${b.decisions}`, b.decisions >= 5, false],
    ['명부 사인 빈칸 비율', '측정만', `${b.blank}%`, true, false],
    ['모험 봇 열흘 생존', '≥ 40%', risky ? `${risky.survived}%` : '-', !!risky && risky.survived >= 40, !!risky && nearAny([[risky.survived, 40]])],
    ['모험 봇 사망 중 굶주림', '< 50%', risky ? `${risky.starveShare}%` : '-', !!risky && risky.starveShare < 50, !!risky && nearAny([[risky.starveShare, 50]])],
    ['열차 결말 도달 (모험 / 균형)', '> 0%', risky ? `${risky.train}% / ${b.train}%` : `${b.train}%`, (risky ? risky.train : b.train) > 0, false],
    ['정체: 7후보 중 ≥5가 각 ≥7%', '≥ 5 후보', `${idOk} 후보`, idOk >= 5, idOk === 5],
    ['이기적 봇 사망 (이기심의 값)', '> 0%', aggs.selfish ? `${aggs.selfish.deathRate}%` : '-', !!aggs.selfish && aggs.selfish.deathRate > 0, false],
    ['헌신 봇 생존', '측정 (> 0%)', aggs.devoted ? `${aggs.devoted.survived}%` : '-', !!aggs.devoted && aggs.devoted.survived > 0, false],
    ['사망 원인 중 굶주림 (전 정책 합산)', '< 50%', `${starveAll}% (${sum('starveDeaths')}/${sum('deaths')})`, starveAll < 50, nearAny([[starveAll, 50]])],
    ['경고 없는 사망 (전 정책 합산)', '0 판', `${sum('unwarned')} 판`, sum('unwarned') === 0, false],
  ];
  return { rows, idAll, thr };
}
// 여러 시드 블록의 판정을 합친다: 모든 블록 통과·경계 아님 = ✓ · 모든 블록 미달 = ✗ · 그 밖(블록마다 다름, 또는 합격선 ±5%p 안) = △ (확정 안 함)
function combine(gates) {
  return gates[0].rows.map((r0, i) => {
    const rs = gates.map((g) => g.rows[i]);
    const okAll = rs.every((r) => r[3]), okAny = rs.some((r) => r[3]), near = rs.some((r) => r[4]);
    return { k: r0[0], want: r0[1], got: rs.map((r) => r[2]), mark: okAll && !near ? '✓' : !okAny ? '✗' : '△', okAll, near };
  });
}

module.exports = { measure, aggregate, gate, combine, pct, avg, MARGIN };
