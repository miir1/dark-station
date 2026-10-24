p = r'C:\dev\dark_station\docs\foundation\31_tables_schema.md'
t = open(p, encoding='utf8').read()


def rep(a, b, cnt=1):
    global t
    assert t.count(a) == cnt, (a[:90], t.count(a))
    t = t.replace(a, b)


rep("""| 발견율(흔적·소문 중 하나라도) | 보통 50~70%, 게으름 ≥ 40%, 부지런은 상한 보고 | 보통 기준 | 쟁점 5 |
| 끝까지 모르는 사건 · 찬가 발견율 | ≥ 1 / 판 · 부지런 ≥ 70%, 게으름 ≥ 60% | 게으름 · 둘 | 쟁점 5 · 7 |
| 정체 분포 | 각 후보 ≥ **(100 / 후보 수) / 2 %** (4 → 12.5%, 5 → 10%, 7 → 7.1%) | 정체 정책 합산 | R4 보류 조건. fallback 후보 > 50%면 경고 |""",
"""| 발견율(흔적·소문 중 하나라도) | **측정만** (10-24 A4: 하한 폐기 — 발견율을 맞추려 소문을 늘리지 않는다). 부지런은 상한 보고 | 보통·게으름 | 쟁점 5 · 10-24 A4 |
| 끝까지 모르는 사건 · 찬가 발견율 | ≥ 1 / 판 · 부지런 ≥ 70%, **게으름은 측정만**(10-24 A4) | 게으름 · 둘 | 쟁점 5 · 7 |
| 정체 분포 (10-24 A3 바꿈) | **성향 봇 평균**(balanced·selfish·devoted·silent·caller·steward·counter·child)과 **사람 흉내 평균**(h_random·h_wary·h_cautious·h_cautious2·h_mixed)을 따로: 둘 다 각 후보 ≥ **3%**, 성향 봇 평균의 가장 큰 후보 ≤ **40%**. 사람 흉내의 가장 큰 후보는 측정(디렉터 확인: 승객이 가장 흔한 결말). 옛 '정책 전체 평균 각 ≥ (100/후보 수)/2 %' 는 측정만 | 묶음별 | A3 분석 §5·§6 (성향 0 봇 다섯이 같은 결말을 다섯 번 세지 않게). 정체 '각 후보' 줄의 경계는 합격선의 절반(±1.5%p) |""")

rep("""| 강제 사망 비율 (10-22 추가) | ≤ 20% [제안] · 앞선 자유 경고 선택 없는 강제 사망 0판 | 전 정책 합산 |""",
"""| 강제 사망 (10-22 추가, **10-24 바꿈**) | **0 판** (전에는 ≤ 20%) · 앞선 자유 경고 선택 없는 강제 사망 0판 | 전 정책 합산 |""")

rep("""| 조심형 봇 사망 (10-22 추가) | 측정 | balanced·selfish·silent·lazy·diligent·steward 합산 | 경고 글이 죽음을 바로 말하는 선택을 피하는 사람의 사망률 — "봇의 버릇"이 아니라 게임이 죽이는 정도 |
기준값은""",
"""| 조심형 봇 사망 (10-22 추가) | 측정 | balanced·selfish·silent·lazy·diligent·steward·selfish_nb 합산 (사람 흉내·모험·남을 내미는 금기를 좋아하는 정책은 뺀다) | 경고 글이 죽음을 바로 말하는 선택을 피하는 사람의 사망률 — "봇의 버릇"이 아니라 게임이 죽이는 정도 |
| **A2 이른 날의 죽음** (10-24) | 균형 D5까지 당신 사망 ≥ 10% · 균형 사망 중 한 사건 비중 ≤ 40% (사인 사건 기준 · **원인 사건 = 부상 출처** 기준 두 줄) · D2~D6 **날마다** 그날 사건으로 죽은 판 > 0 (정책 합산, 깔때기 사건 뺌) + 날별 사망표 | 균형 · 전 정책 | 명세 §6-3 · 검토 지적 3·17 |
| **A1 이기심의 값** (10-24, 옛 '이기적 사망 > 0' 대신) | 이른 안전: selfish D1~D4 생존 − 균형 ≥ +5%p · 열흘 생존 − 균형 < 0 을 **이기적 4종 각각**(selfish · selfish_nb 버릇 없음 · selfish_rt 끝까지 금기 · selfish_rt0 끝까지 금기·몸 꺼림 없음) · 이기적 4종 사인 쏠림 ≤ 60% · 카르마 측정 | 이기적 4종 · 균형 | 명세 §6-3 · 검토 지적 1·11·17 |
| **A4 게으름의 값** (10-24) | 생존 (보통 − 게으름 = **주 지표**, 부지런 − 게으름) ≥ +5%p · D9 아침 주민 수 차 > 0 · D7 아침 식량+물+약 차 ≥ +0.2 · 못 본 일(missed)/판 측정 | balanced·diligent·lazy | 명세 §6-3 · 검토 지적 12 (부지런 봇은 모든 칸·소문을 보는 상한선이라 사람이 할 수 없다 — 보통을 주 지표로) |
| 모험 봇 열흘 생존 (10-24 바꿈) | ≥ 40% → **≥ 25%** [리드·디렉터 확인 필요 — 이른 위기 판정을 모험이 다 굴린다] | risky | 명세 §6-3 |
| 위기 때 값 길이 열린 비율 (10-24) | 측정 (d2_shutter_arm·d4_spanner·d5_flood 가 걸렸을 때 비용 있는 금기 아닌 선택이 열려 있던 비율) | 균형 | 검토 지적 18 — 디렉터 확인용 |
기준값은""")

rep("""**판정 규칙 (10-22 추가)**: 합격선은 서로 다른 시드 블록 둘 이상(기본 시드 1~N 과 1001~1000+N, `run.js --blocks=` · `--seed0=`)에서 따로 잰다.""",
"""**판정 규칙 (10-22 추가, 10-24 기본 4블록)**: 합격선은 서로 다른 시드 블록 둘 이상(**기본 시드 1~N · 1001~ · 2001~ · 3001~ 네 블록**, `run.js --blocks=` · `--seed0=`)에서 따로 잰다. 차이로 재는 줄(이기적 − 균형, 보통 − 게으름 등)도 %p 이면 같은 규칙이다(예: 합격선 +5%p 에 실측 +8%p 는 △).""")

t = t.rstrip('\n') + """

### §6-6. 약속 추가 (2026-10-24, 디렉터 결정 A1·A2·A4 엔진 몫 — 명세 spec_karma_death_neglect §6·§7 + 명세 검토 지적, 테스트 v4/test/karma.test.js)
엔진 칸을 데이터보다 **먼저** 열었다(검토 지적 13): 아래 칸은 지금 표에 없어도 되고, 넣으면 표 검사가 받는다. 지금 표로 봇 판 결과는 고치기 전과 같다(엔진만 바꾼 상태에서 5정책 × 40판 결과 해시 같음 — 봇 동점 규칙은 따로, 아래 '봇').
| 항목 | 약속 |
|---|---|
| 밤 사건 새 칸 `missed`·`caught` (E1) | `{ effects, trace }` — effects 는 두 꼴(배열이면 로더가 객체 꼴로), trace 는 `{물건: 상태}`(`_actor`·`_target` 자리표시 허용). 표 검사는 밤 사건 effects·trace 와 같다. 그 밖의 키·세계 시계(role clock) 행에 쓰면 오류. 빈 칸은 없는 것 |
| 방치 판정 (E2) | 밤 굴림 **첫머리**(`rollNight` → `applyNeglect`). 전날 밤(day == 오늘−1) 주민 사건 가운데 아직 판정 안 한 줄: 발견(`discovered`)이면 `caught`, 아니면 `missed` 를 **그 줄의 행위자·대상 그대로** 적용. 행위자나 대상이 역(home)에 없으면 건너뜀. 판정한 줄은 `judged:true`, 결과는 nightLog 에 `{id:'<id>~missed'·'~caught', role:'neglect', discovered:true}`, missed 를 적용하면 `s.stats.neglect++`. 더 오래된 줄은 판정 없이 judged. 판정 줄·세계 시계는 발견 집계(`discovery`)·봇 통계의 밤 사건 수에서 빠진다(`N.isResidentRow(e)` = 주민 사건 줄) |
| 누구나 아는 밤 `public` | 0/1. 1 이거나 effects 에 `kill` 이 있는 행은 굴릴 때 바로 발견(discovered:true) |
| 곁가지 행 `side` | 0/1. 1 = 한 밤 상한(max_per_night)·'행위자·대상 한 번' 규칙 밖에서 따로 굴린다: 주민 사건 뒤, 행마다 맞는 (행위자, 대상) 가운데 하나를 `weight/10` 확률로 한 번. 신호용 흔적 행(cold_bowl 등)이 원한 습격·밀고의 자리를 뺏지 않게(검토 지적 20). 세계 시계 행에는 못 쓴다 |
| 흔적 `late` (E3) | missed 의 trace 가 바꾼 흔적은 `late:1`(다른 흔적·저장 정규화는 0). `view.traces[].late`. 조사 글 줄 = `E.inspectLineId(s, db, 물건)` — `inspectLine[상태]` 의 `<줄id>_late` 가 대사표에 있으면 그것. 그날 아침 late 흔적(어제 밤 굴림에서 생긴 것)이 있으면 **그날 첫 조사** 때 `s.notice = 'toast_late'`(대사표에 그 줄이 있을 때만, 하루 한 번) → `view.notice`. 다음 조사·next 가 지운다 |
| 검사 `noExit` (E4) | **경고**(오류 아님 — 브라우저 로더가 행을 빼고 읽지 않게, 검토 지적 25): 당신을 죽일 수 있는 선택(swap 변형 포함)이 있는 사건에 **비용·req 없고 당신을 죽이지 않는**(변형까지) 선택지가 없다. 금기도 출구로 센다. targetOptional 사건에서 대상이 필요한 선택지는 출구가 아니다. 지금 표에 0건인지는 karma.test.js 가 막는다 |
| 신호 (E5) | `view.people[].signs.cold` = 원한 `grudge` ≥ 세계 수치 `sign_cold`(행이 없으면 3), 당신은 늘 false. 인물표 새 칸 **`addressCold`**(글 ≤6자, `""` = 부르지 않는다). `E.address(s, db, id)` = 원한 ≥ `sign_cold_call`(없으면 5)이고 addressCold 칸이 있으면 그것, 아니면 축이 하나라도 0 이 아닐 때 `addressYou[기운 후보]`, 그다음 `addressYou.default`, 칸이 없으면 null. `view.people[].address`(역에 있는 사람만). 굶주림 신호 `starving` 은 **깃발만 보는 행위자 조건**(`flag:unseen_thief_actor` 등)을 문턱으로 쓰지 않는다(검토 지적 23) — sleepless 는 그대로 |
| 선택지 `req` 칸 | `flag` · `permanent` · `notPermanent` · **`cond`**(조건식 — 사건 when 과 같은 환경) · **`why`**(잠금 이유 글 ≤24자 — 있으면 모든 잠금 이유를 이 글로) · **`target`**(1 = 사건 대상이 있어야 열림). 그 밖의 키는 오류 |
| 선택지 **`swap`** (10-24 A1, 검토 지적 1·2·11·21) | `{ when, …선택지 칸 }` 또는 그 목록(앞에서부터 처음 맞는 것). when 이 지금 맞으면 그 변형의 칸이 기본 선택지의 칸을 덮는다(label·check·cost·req·taboo·warn·hint·out·ok·fail). 변형에 적힌 칸은 **빈 값이어도 덮는다**(warn:'' = 경고 없음, cost:{} = 비용 없음). 변형에 out 만 있으면 판정이 사라지고, check 가 있으면 out 이 사라진다. 합친 선택지도 기본 선택지와 같은 검사를 받는다. 화면·봇·강제 사망 판정·noExit·firstDeath 가 모두 바뀐 모습을 본다. 예: 카르마 ≥ 8 이면 '다른 이름을 댄다'(금기)가 `talk 50`·경고 '아무도 안 돌아설 수 있다'·실패 = 죽음 / '버틴다'를 두 번째부터 손가락을 잃게(`when: "fired:called_up>=1"`) |
| 조건식 `fired:<사건 id>` | 사건 when·req.cond·swap.when 에서 그 사건을 고른 횟수(s.fired). '되풀이할수록' 값이 커지게 |
| 사건 `targetOptional` | 0/1 (target 열과 같이). 1 = 대상을 못 정해도 사건은 걸린다 — **대상이 필요한 선택지**(결과가 `who:'target'`·`_target` 흔적/깃발·명부 줄 who target 을 쓰고 결과에 제 target 열이 없는 것, 또는 `req.target:1`)만 잠긴다(이유 = req.why 또는 '댈 이름이 없다'). 주민이 다 사라져도 called_up·dawn_mob 이 걸리게(검토 지적 1-3·27) |
| 사건 `targetIf` | 조건식 (target 열과 같이). 대상 후보가 맞아야 한다. 환경 = 사건 when 환경 + 그 사람의 수치(맨이름 `grudge`·`injury`…와 `grudge_target`) · `self`(그 사람 id) · `bond` · 깃발·물건의 `_<id>` → `_target`(`flag:share_seen_target`). 예 `self!=gicheol`(d4_spanner 의 기철 빼기, 검토 지적 14) · `grudge>=3` |
| 대상 `most:<사람 수치>` | 사건·결과 target 에 쓸 수 있다. 그 수치가 가장 큰 주민(0보다 클 때만, 같으면 시드 난수), 역에 있고 만난 사람만. 예 d10_hold `target: most:grudge` + `targetIf: grudge>=3` → 등 돌린 사람이 역에 없으면 안 걸린다(검토 지적 6) |
| who:'you' 보존 | 로더가 `{verb:'number', who:'you', n}` 을 맨숫자로 바꾸지 않는다 — 밤 사건·방치 판정에서 맨숫자는 행위자(주민)의 것이라 '당신 +1' 이 행위자에게 가던 오류를 막는다(검토 지적 15). 선택 결과에선 행위자가 당신이라 결과가 같다 |
| 부상 출처 `s.hurt` | 당신 부상이 늘 때마다 `{day, src, n}`(src = `ev:<사건>/<선택>` · `night:<밤 사건>` · `neglect:<밤 사건>` · `holds:<물건>`), 최근 60개. 화면은 안 본다. 통계의 '원인 사건'이 쓴다 |
| 사인 기록 | `ended.cause` 에 `warn`(고른 선택지의 화면 경고 글) · `swapped`(swap 변형으로 골랐다). `lastResult.alts` = 고를 때 열린 선택지의 모습 `[{i, kill, taboo, warn}]`(swap 뒤 — 봇 버릇 점검이 쓴다) |
| 저장 | 새 칸 `hurt`·`notice`·`noticeDay`·`stats.neglect`·흔적 `late`·nightLog `judged` 는 정규화가 채운다(SAVE_V 그대로 1) |
| 봇 (sim) | 정책 20: 성향 봇 8(balanced·selfish·devoted·silent·caller·steward + **counter** 몫−손+이름+ · **child** 몫−손−이름+, 10-23 승인) · 조사 2(lazy·diligent) · risky · 이기적 변형 3(**selfish_nb** bodyAverse 없음 · **selfish_rt** 남을 내미는 금기 +3 · **selfish_rt0** 같은데 몸 꺼림 없음) · 사람 흉내 6(**h_random·h_wary·h_first·h_cautious·h_cautious2·h_mixed** — A3 분석 runs.js 를 정식으로, 고르는 법만 다르고 배식·조사·원정은 균형과 같다. h_first 는 극단 모형이라 합격선 묶음에서 뺀다). selfish 에 **bodyAverse 3**(경고 글 '다친다·잃는다·상한다' −3, 명세 §6-2). **동점 규칙(A3)**: 가장 높은 선택이 경고 선택이면 경고 붙은 다른 선택 가운데 0.2점 안쪽도 동점 → 시드 난수. 묶음 `B.GROUPS = {personality, human, selfish}` |
| 통계 (sim) | 밤 사건·malice·hymn·찬가 발견 = 주민 사건 줄만(방치 판정 줄 뺌, 검토 지적 16) · 새 값: 죽은 날 · D1~D4 생존 · D5까지 사망 · 산 날 · 카르마(끝) · 못 본 일(stats.neglect) · 방치 줄 수 · D9 아침 주민 수(home9) · D7 아침 식량+물+약(res7) · 사인 1위 · **원인 사건**(깔때기 사건 — when 이 당신 부상을 보는 사건과 새벽 위독 — 으로 죽었으면 그 자리까지 다치게 한 출처, 죽을 때 부상만큼 거슬러 가장 많이 다치게 한 것) · 날별 사망표(그날 사건/깔때기) · 위기 때 값 길이 열린 비율 |
| run.js | 기본 4블록(1·1001·2001·3001) · 정책 이름에 밑줄 · `--workers=N`(정책을 나눠 동시에, 기본 = CPU−1, 결과 같음) · 보고서에 날별 사망표 · A1·A2·A4 지표 표 · 원인 사건 · 정체 묶음 평균 표 · 합격선 표의 '합산' 열(참고) |
"""
open(p, 'w', encoding='utf8').write(t)
print('ok')
