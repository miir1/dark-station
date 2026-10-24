# engine_fix: stats.js gate 줄 고침 (10-24 검증 A1·A2·A3·REG) — 한 번만 돌린다
p = 'v4/sim/stats.js'
s = open(p, encoding='utf-8').read()


def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:90], s.count(old))
    s = s.replace(old, new)


rep("""  const careDeadly = care.reduce((t, k) => t + (aggs[k].deadlyPick || 0), 0);""",
"""  const careDeadly = care.reduce((t, k) => t + (aggs[k].deadlyPick || 0), 0);
  const quirk = (G.selfishQuirk || []).filter((k) => aggs[k]);""")
rep("""  // 정체 묶음 평균 (A3 분석 §5 추천: 성향 봇 평균과 사람 흉내 평균을 따로)
  const groupId = (names) => {
    const ps = names.filter((k) => aggs[k]);
    const out = {};
    for (const k of ps) for (const [c, v] of Object.entries(aggs[k].identity || {})) out[c] = (out[c] || 0) + v;""",
"""  // 정체 묶음 평균 (A3 분석 §5 추천: 성향 봇 평균과 사람 흉내 평균을 따로)
  //   (10-24 검증 A3) 프롤로그(D0) 사망 판을 뺀 분포(identityNP)로 낸다 — h_random·h_wary 는 판의 절반이 D0 계단에서 끝나고, 그 판은 축이 거의 0 이라 승객으로 센다.
  //   옛 방식(프롤로그 사망 포함)은 사람 흉내만 참고 줄로 싣는다. identityNP 가 없는 집계(옛 시험값)는 identity 를 쓴다
  const groupId = (names, key) => {
    const ps = names.filter((k) => aggs[k]);
    const out = {};
    for (const k of ps) for (const [c, v] of Object.entries(aggs[k][key || 'identityNP'] || aggs[k].identity || {})) out[c] = (out[c] || 0) + v;""")
rep("""  const idP = groupId(G.personality), idH = groupId(G.human);""",
"""  const idP = groupId(G.personality), idH = groupId(G.human), idHall = groupId(G.human, 'identity');
  const proH = G.human.filter((k) => aggs[k]).map((k) => [k, pct(aggs[k].prologueDeaths || 0, aggs[k].n)]);""")
rep("""  const mP = maxOf(idP), mH = maxOf(idH);""", """  const mP = maxOf(idP), mH = maxOf(idH), mHall = maxOf(idHall);""")
rep("""  // A1: 이기적 묶음
  const selfs = G.selfish.filter((k) => aggs[k]);
  const sDiff = selfs.map((k) => [k, diff(k, 'balanced', 'survived')]);
  const sTop = selfs.map((k) => [k, aggs[k].deaths ? aggs[k].topCause : { k: '-', share: 0 }]);
  // A2: D2~D6 날마다 그날 사건으로 죽은 판(정책 합산)
  const dayEv = {}; for (const a of Object.values(aggs)) for (const [d, v] of Object.entries(a.dayEvent || {})) dayEv[d] = (dayEv[d] || 0) + v;
  const D26 = [2, 3, 4, 5, 6];""",
"""  // A1: 이기적 묶음 (10-24 검증 A1) — 합격선은 버릇 없는 이기적(selfishPlain)만 잰다. 몸 꺼림(selfishQuirk)의 죽음은 '버틴다'를 두고 고른 주사위라
  //   이기심의 값이 아니라 봇 버릇이다(selfish 사망 231판 전부 · 카르마로 판정이 된 금기로 죽은 판 0) → 참고 줄(측정)
  const selfs = G.selfish.filter((k) => aggs[k]);
  const plainNames = G.selfishPlain || G.selfish;
  const plain = plainNames.filter((k) => aggs[k]);
  const sDiff = plain.map((k) => [k, diff(k, 'balanced', 'survived')]);
  const qDiff = quirk.map((k) => [k, diff(k, 'balanced', 'survived')]);
  const eDiff = plain.map((k) => [k, diff(k, 'balanced', 'aliveD4')]);
  // 사인 쏠림은 그 블록에서 SIGN_MIN_DEATHS 판 이상 죽은 정책만 판정한다(몇 판 안 죽으면 비중이 뜻이 없다). 판정할 정책이 없으면 △(확정 안 함)
  const topOf = (k) => (aggs[k].deaths ? aggs[k].topCause : { k: '-', share: 0 });
  const sTop = plain.map((k) => [k, topOf(k), (aggs[k].deaths || 0) >= SIGN_MIN_DEATHS]);
  const sJudged = sTop.filter(([, , j]) => j);
  // A2: D2~D6 날마다 그날 사건으로 죽은 판 (10-24 검증 A2) — 조심형(신중한 플레이어) 합산으로 판정한다.
  //   전 정책 합산은 h_random(정말 아무거나)·이기적 변형까지 더해, D3 처럼 신중한 플레이어에게 죽음 길이 없는 날도 > 0 으로 가렸다(D3 105 중 h_random 91)
  const dayEvOf = (names) => { const o = {}; for (const k of names) for (const [d, v] of Object.entries((aggs[k] && aggs[k].dayEvent) || {})) o[d] = (o[d] || 0) + v; return o; };
  const dayEv = dayEvOf(care);
  const dayEvP = dayEvOf(G.personality.filter((k) => aggs[k])), dayEvH = dayEvOf(G.human.filter((k) => aggs[k] && k !== 'h_random')), dayEvAll = dayEvOf(Object.keys(aggs));
  const D26 = [2, 3, 4, 5, 6];
  const fmtDays = (o) => D26.map((d) => `D${d} ${o[d] || 0}`).join(' · ');""")
rep("""    ['  봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음', '0 판', care.length ? `${careDeadly} 판 (전 정책 ${sum('deadlyPick')})` : '-', careDeadly === 0, false],""",
"""    ['  봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음', '0 판', care.length ? `${careDeadly} 판 (전 정책 ${sum('deadlyPick')})` : '-', careDeadly === 0, false],
    ['  참고: 몸 꺼림 정책(' + (quirk.join('·') || '없음') + ')의 같은 죽음 — 조심형이 아니다(10-24 검증)', '측정', quirk.length ? quirk.map((k) => `${k} ${aggs[k].deadlyPick || 0}`).join(' · ') + ' 판' : '-', true, false],""")
rep("""    idRow('정체 — 사람 흉내 평균, 각 후보 (A3)', idH, ID_MIN),
    ['정체 — 사람 흉내 평균, 가장 큰 후보 (A3)', '측정 (디렉터 확인: 승객이 가장 흔한 결말)', idH.ps.length ? `${mH.k} ${mH.v}%` : '-', true, false],""",
"""    idRow('정체 — 사람 흉내 평균, 각 후보 (A3, 프롤로그 사망 판 뺌)', idH, ID_MIN),
    ['정체 — 사람 흉내 평균, 가장 큰 후보 (A3, 프롤로그 사망 판 뺌)', '측정 (디렉터 확인: 승객이 가장 흔한 결말)', idH.ps.length ? `${mH.k} ${mH.v}%` : '-', true, false],
    ['  참고: 사람 흉내 평균 (옛 방식 — 프롤로그 사망 포함) · 프롤로그(D0) 사망 판 비율', '측정', idHall.ps.length ? Object.entries(idHall.out).map(([k, v]) => `${k} ${v}`).join(' · ') + ` · 가장 큰 ${mHall.k} ${mHall.v}% | D0 사망 ` + proH.map(([k, v]) => `${k} ${v}%`).join(' · ') : '-', true, false],""")
rep("""    ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌)', '날마다 > 0', D26.map((d) => `D${d} ${dayEv[d] || 0}`).join(' · '), D26.every((d) => (dayEv[d] || 0) > 0), false],""",
"""    ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (조심형 합산 — 신중한 플레이어, 깔때기 사건 뺌)', '날마다 > 0', care.length ? fmtDays(dayEv) : '-', care.length > 0 && D26.every((d) => (dayEv[d] || 0) > 0), false],
    ['  참고: 같은 값 — 성향 봇 8종 / 사람 흉내(h_random 뺌) / 전 정책 합산(옛 줄)', '측정', `성향 ${fmtDays(dayEvP)} | 사람 ${fmtDays(dayEvH)} | 전 ${fmtDays(dayEvAll)}`, true, false],""")
rep("""    ['A1 이른 안전: 이기적 D1~D4 생존 − 균형', '≥ +5%p', diff('selfish', 'balanced', 'aliveD4') == null ? '-' : `${sgn(diff('selfish', 'balanced', 'aliveD4'))}%p (${aggs.selfish.aliveD4} vs ${b.aliveD4})`, diff('selfish', 'balanced', 'aliveD4') != null && diff('selfish', 'balanced', 'aliveD4') >= 5, nearAny([[diff('selfish', 'balanced', 'aliveD4'), 5]])],
    ['A1 이기심의 값: 열흘 생존 − 균형 (이기적 4종 각각 — 버릇 없는·끝까지 금기 포함)', '< 0 (모든 정책)', selfs.length ? fmtDiff(sDiff) + '%p' : '-', selfs.length === G.selfish.length && okAll(sDiff, (v) => v < 0), nearAny(sDiff.map(([, v]) => [v, 0]))],
    ['A1 이기적 4종 사인 쏠림 (한 사건 비중)', '≤ 60%', sTop.length ? sTop.map(([k, t]) => `${k} ${t.k} ${t.share}%`).join(' / ') : '-', sTop.length > 0 && sTop.every(([, t]) => t.share <= 60), nearAny(sTop.map(([, t]) => [t.share, 60]))],""",
"""    ['A1 이른 안전: D1~D4 생존 − 균형 (버릇 없는 이기적 각각)', '≥ +5%p', plain.length ? fmtDiff(eDiff) + `%p (균형 ${b.aliveD4})` : '-', plain.length > 0 && okAll(eDiff, (v) => v >= 5), nearAny(eDiff.map(([, v]) => [v, 5]))],
    ['A1 이기심의 값: 열흘 생존 − 균형 (버릇 없는 이기적 각각 — ' + plainNames.join('·') + ')', '< 0 (모든 정책)', plain.length ? fmtDiff(sDiff) + '%p' : '-', plain.length === plainNames.length && okAll(sDiff, (v) => v < 0), nearAny(sDiff.map(([, v]) => [v, 0]))],
    ['  참고: 몸 꺼림 버릇이 있는 이기적(' + (quirk.join('·') || '없음') + ') 열흘 생존 − 균형 — 이기심의 값이 아니다(10-24 검증 A1)', '측정', quirk.length ? fmtDiff(qDiff) + '%p' : '-', true, false],
    [`A1 이기적 사인 쏠림 (버릇 없는 이기적, 사망 ≥ ${SIGN_MIN_DEATHS}판인 정책만)`, '≤ 60%', sTop.length ? sTop.map(([k, t, j]) => `${k} ${t.k} ${t.share}%` + (j ? '' : ` (사망 ${aggs[k].deaths || 0}판 — 판정 안 함)`)).join(' / ') : '-', sJudged.every(([, t]) => t.share <= 60), !sJudged.length || nearAny(sJudged.map(([, t]) => [t.share, 60]))],
    ['  참고: 몸 꺼림 이기적 사인 쏠림', '측정', quirk.length ? quirk.map((k) => `${k} ${topOf(k).k} ${topOf(k).share}%`).join(' / ') : '-', true, false],""")
rep("""const MARGIN = 5;""", """const MARGIN = 5;
const SIGN_MIN_DEATHS = 20;   // A1 사인 쏠림을 판정하는 최소 사망 판 수(블록마다) — 200판 블록의 10%""")
rep("""module.exports = { measure, aggregate, gate, combine, pct, avg, MARGIN, D3_TOGETHER, rootCause, funnelOf, deadlyPicked };""",
"""module.exports = { measure, aggregate, gate, combine, pct, avg, MARGIN, SIGN_MIN_DEATHS, D3_TOGETHER, rootCause, funnelOf, deadlyPicked };""")
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
