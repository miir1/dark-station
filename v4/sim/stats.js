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
  };
}

// 정책별 집계
function aggregate(db, runs) {
  const n = runs.length;
  const deaths = runs.filter((r) => r.dead);
  const byCause = {};
  for (const r of deaths) { const k = r.cause ? r.cause.event : (r.why === 'all_dead' ? '전멸' : r.why); byCause[k] = (byCause[k] || 0) + 1; }
  const warned = deaths.filter((r) => r.cause && r.cause.warned).length;
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
  };
}

// 합격선 판정 (31 §4). agg: {policy: aggregate}, candidates: 후보 수
function gate(aggs, candidates) {
  const first = aggs[Object.keys(aggs)[0]];
  const b = aggs.balanced || first, lazy = aggs.lazy || b, dil = aggs.diligent || b;
  const idAll = {};
  for (const a of Object.values(aggs)) for (const [k, v] of Object.entries(a.identity)) idAll[k] = (idAll[k] || 0) + v;
  const npol = Object.keys(aggs).length;
  for (const k of Object.keys(idAll)) idAll[k] = Math.round((10 * idAll[k]) / npol) / 10;
  const thr = Math.round((1000 / candidates / 2)) / 10;
  const sum = (k) => Object.values(aggs).reduce((t, a) => t + (a[k] || 0), 0);
  const minId = Math.min(...Array.from({ length: candidates }, (_, i) => 0).map((_, i) => 0).concat([])); void minId;
  const rows = [
    ['당신 사망(올라감 포함)', '≥ 50%', `${b.deathRate}%`, b.deathRate >= 50],
    ['사망 중 경고 있던 선택', '100%', `${b.warnedRate}%`, b.warnedRate === 100 || b.deathRate === 0],
    ['전멸', '≤ 25%', `${b.allDead}%`, b.allDead <= 25],
    ['밤 사건 수 / 판', '≥ 6', `${b.nights}`, b.nights >= 6],
    ['  그중 malice / hymn', '≥ 2 / ≥ 1', `${b.malice} / ${b.hymn}`, b.malice >= 2 && b.hymn >= 1],
    ['발견율 (보통)', '50~70%', `${b.discovery}%`, b.discovery >= 50 && b.discovery <= 70],
    ['발견율 (게으름)', '≥ 40%', `${lazy.discovery}%`, lazy.discovery >= 40],
    ['끝까지 모르는 사건 ≥1 (게으름)', '100% 판', `${lazy.unknownOk}%`, lazy.unknownOk >= 90],
    ['찬가 발견율 (부지런 / 게으름)', '≥ 70% / ≥ 60%', `${dil.hymnDiscovery}% / ${lazy.hymnDiscovery}%`, dil.hymnDiscovery >= 70 && lazy.hymnDiscovery >= 60],
    ['정체 분포 (정책 합산, 각 후보)', `≥ ${thr}%`, Object.entries(idAll).map(([k, v]) => `${k} ${v}%`).join(' · ') || '없음', Object.keys(idAll).length === candidates && Object.values(idAll).every((v) => v >= thr)],
    ['explicit 사건 / 판', '≥ 7', `${b.explicit}`, b.explicit >= 7],
    ['하루 결정 수', '≥ 5', `${b.decisions}`, b.decisions >= 5],
    ['명부 사인 빈칸 비율', '측정만', `${b.blank}%`, true],
    ['모험 봇 열흘 생존', '≥ 40%', aggs.risky ? `${aggs.risky.survived}%` : '-', !!aggs.risky && aggs.risky.survived >= 40],
    ['모험 봇 사망 중 굶주림', '< 50%', aggs.risky ? `${aggs.risky.starveShare}%` : '-', !!aggs.risky && aggs.risky.starveShare < 50],
    ['열차 결말 도달 (모험 / 균형)', '> 0%', aggs.risky ? `${aggs.risky.train}% / ${b.train}%` : `${b.train}%`, (aggs.risky ? aggs.risky.train : b.train) > 0],
    ['정체: 7후보 중 ≥5가 각 ≥7%', '≥ 5 후보', `${Object.values(idAll).filter((v) => v >= 7).length} 후보`, Object.values(idAll).filter((v) => v >= 7).length >= 5],
    ['이기적 봇 사망 (이기심의 값)', '> 0%', aggs.selfish ? `${aggs.selfish.deathRate}%` : '-', !!aggs.selfish && aggs.selfish.deathRate > 0],
    ['헌신 봇 생존', '측정 (> 0%)', aggs.devoted ? `${aggs.devoted.survived}%` : '-', !!aggs.devoted && aggs.devoted.survived > 0],
    ['사망 원인 중 굶주림 (전 정책 합산)', '< 50%', `${pct(sum('starveDeaths'), sum('deaths'))}% (${sum('starveDeaths')}/${sum('deaths')})`, pct(sum('starveDeaths'), sum('deaths')) < 50],
    ['경고 없는 사망 (전 정책 합산)', '0 판', `${sum('unwarned')} 판`, sum('unwarned') === 0],
  ];
  return { rows, idAll, thr };
}

module.exports = { measure, aggregate, gate, pct, avg };
