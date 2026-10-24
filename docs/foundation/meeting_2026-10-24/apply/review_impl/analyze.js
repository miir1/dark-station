const fs = require('fs'); const path = require('path');
const R = process.argv[2];
const load = (p) => [1, 1001, 2001, 3001].map((s) => JSON.parse(fs.readFileSync(path.join(R, `${p}_${s}.json`), 'utf8')));
const P = load('rp'), B = load('rb'), NB = load('rnb');
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '-');
const surv = (runs) => runs.filter((r) => !r.dead).length;
const line = (t) => console.log(t);
line('## 1. 이기적 봇: bodyAverse 있음(명세) vs 없음 — 열흘 생존 %, 균형 대비');
for (let b = 0; b < 4; b++) { const sp = P[b].selfish, snb = NB[b].selfish, bal = P[b].balanced; const top = (runs) => { const c = {}; for (const r of runs.filter((x) => x.dead)) c[r.cause] = (c[r.cause] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', '); };
  line(`블록${b + 1}: 균형 ${pct(surv(bal), 200)} | 이기(명세) ${pct(surv(sp), 200)} (karma ${(sp.reduce((a, r) => a + r.karma, 0) / 200).toFixed(1)}) | 이기(bodyAverse 없음) ${pct(surv(snb), 200)} (karma ${(snb.reduce((a, r) => a + r.karma, 0) / 200).toFixed(1)}, 사인 ${top(snb)}) · 버틴다 고른 판 ${snb.filter((r) => r.endured.length).length}`); }
line('\n## 2. d4_spanner 대상이 기철 자신인 판 (다른 사람이 셌다고 한다 의 대상)');
let sp = 0, spG = 0, spPick = 0, spPickG = 0;
for (const blk of P) for (const runs of Object.values(blk)) for (const r of runs) for (const p of r.picks) if (p.ev === 'd4_spanner') { sp++; if (p.target === 'gicheol') spG++; if (p.label === '다른 사람이 셌다고 한다') { spPick++; if (p.outTarget === 'gicheol' || p.target === 'gicheol') spPickG++; } }
line(`d4_spanner 걸린 횟수 ${sp}, 대상=기철 ${spG} (${pct(spG, sp)}%) · 금기 고름 ${spPick}, 그중 기철을 가리킴 ${spPickG}`);
let da = 0, daT = 0; for (const blk of P) for (const runs of Object.values(blk)) for (const r of runs) for (const p of r.picks) if (p.ev === 'dawn_mob') { da++; }
line(`dawn_mob 걸린 횟수 ${da}`);
line('\n## 3. 사망 원인 비중 (정책별, 4블록 합산, 상위 4) · 부상 경로(fever_night+injury_untreated) · D10 사인');
for (const pol of Object.keys(P[0])) { const all = P.flatMap((b) => b[pol]); const d = all.filter((r) => r.dead); const c = {}; for (const r of d) c[r.cause] = (c[r.cause] || 0) + 1;
  const inj = d.filter((r) => r.cause === 'fever_night' || r.cause === 'injury_untreated').length; const endFever = d.filter((r) => r.cause === 'fever_night' && r.endured.length).length;
  const byDay = {}; for (const r of d) byDay[r.deathDay] = (byDay[r.deathDay] || 0) + 1; const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  line(`${pol.padEnd(9)} 사망 ${pct(d.length, all.length)}% | ${Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, d.length)}`).join(' · ')} | 부상경로 ${pct(inj, d.length)} (그중 앞서 '버틴다' ${endFever}) | 가장 많이 죽는 날 D${topDay[0]} ${pct(topDay[1], d.length)}%`); }
line('\n## 3b. 같은 표 — 지금 데이터(base)');
for (const pol of Object.keys(B[0])) { const all = B.flatMap((b) => b[pol]); const d = all.filter((r) => r.dead); const c = {}; for (const r of d) c[r.cause] = (c[r.cause] || 0) + 1; line(`${pol.padEnd(9)} 사망 ${pct(d.length, all.length)}% | ${Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, d.length)}`).join(' · ')}`); }
line('\n## 4. A4 판별 값: 블록별 부지런−게으름 · 보통(균형)−게으름 (생존%p · home9 · res7) + 합산 표준오차');
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
for (let b = 0; b < 4; b++) { const L = P[b].lazy, D = P[b].diligent, N = P[b].balanced; const h = (runs) => mean(runs.filter((r) => r.home9 != null).map((r) => r.home9)); const rs = (runs) => mean(runs.filter((r) => r.res7 != null).map((r) => r.res7));
  line(`블록${b + 1}: 부지런−게으름 생존 ${(100 * (surv(D) - surv(L)) / 200).toFixed(1)} · home9 ${(h(D) - h(L)).toFixed(2)} · res7 ${(rs(D) - rs(L)).toFixed(2)} | 보통−게으름 생존 ${(100 * (surv(N) - surv(L)) / 200).toFixed(1)} · home9 ${(h(N) - h(L)).toFixed(2)} · res7 ${(rs(N) - rs(L)).toFixed(2)}`); }
{ const L = P.flatMap((b) => b.lazy), D = P.flatMap((b) => b.diligent); const pl = surv(L) / L.length, pd = surv(D) / D.length; const se = Math.sqrt(pl * (1 - pl) / L.length + pd * (1 - pd) / D.length);
  line(`합산 800판: 부지런 ${(100 * pd).toFixed(1)} − 게으름 ${(100 * pl).toFixed(1)} = ${(100 * (pd - pl)).toFixed(1)}%p (표준오차 ±${(100 * se).toFixed(1)}%p)`);
  const Lb = B.flatMap((b) => b.lazy), Db = B.flatMap((b) => b.diligent); line(`같은 값 지금 데이터: ${(100 * (surv(Db) - surv(Lb)) / 800).toFixed(1)}%p`); }
line('\n## 5. 밤 사건 수 집계(stats.measure) 가 방치 줄을 세는가: 균형 판당 nights(통계) vs 진짜 밤 사건 · 방치 줄');
for (const [nm, X] of [['proto', P], ['base', B]]) { const all = X.flatMap((b) => b.balanced); line(`${nm}: stats nights ${mean(all.map((r) => r.nightsStat)).toFixed(2)} · 진짜 ${mean(all.map((r) => r.realNights)).toFixed(2)} · 방치 줄 ${mean(all.map((r) => r.neglectRows)).toFixed(2)} · malice(통계) ${mean(all.map((r) => r.maliceStat)).toFixed(2)}`); }
line('\n## 6. 정체 분포 (봇 9종 평균 / 성향 봇 6종 평균) — base vs proto (B1·B2 없음)');
const ids = (X, pols) => { const c = {}; let n = 0; for (const pol of pols) for (const b of X) for (const r of b[pol]) { n++; c[r.identity || 'none'] = (c[r.identity || 'none'] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, n)}`).join(' · '); };
const ALL = Object.keys(P[0]), SIX = ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward'];
line(`base 9종: ${ids(B, ALL)}`); line(`proto 9종: ${ids(P, ALL)}`); line(`base 6종: ${ids(B, SIX)}`); line(`proto 6종: ${ids(P, SIX)}`);
line('\n## 7. 새 위기 사건: 도달·선택 (균형 봇, 4블록) — 판정 굴린 비율과 그때 식량');
for (const ev of ['d2_shutter_arm', 'd4_spanner', 'd5_flood', 'dawn_mob', 'd10_hold', 'called_up', 'dawn_strike']) { const picks = P.flatMap((b) => b.balanced).flatMap((r) => r.picks.filter((p) => p.ev === ev)); const c = {}; for (const p of picks) c[p.label] = (c[p.label] || 0) + 1; line(`${ev}: ${picks.length}회 — ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ')}`); }
line('\n## 7b. 이기적 봇(명세) 같은 표');
for (const ev of ['d2_shutter_arm', 'd4_spanner', 'd5_flood', 'dawn_mob', 'd10_hold', 'called_up', 'dawn_strike']) { const picks = P.flatMap((b) => b.selfish).flatMap((r) => r.picks.filter((p) => p.ev === ev)); const c = {}; for (const p of picks) c[p.label] = (c[p.label] || 0) + 1; line(`${ev}: ${picks.length}회 — ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ')}`); }
line('\n## 7c. 이기적 봇(bodyAverse 없음) 같은 표');
for (const ev of ['dawn_mob', 'd10_hold', 'called_up', 'dawn_strike']) { const picks = NB.flatMap((b) => b.selfish).flatMap((r) => r.picks.filter((p) => p.ev === ev)); const c = {}; for (const p of picks) c[p.label] = (c[p.label] || 0) + 1; line(`${ev}: ${picks.length}회 — ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ')}`); }
