# engine_fix: 31_tables_schema.md §4·§6-6 에 10-24 검증 고침을 적는다. 한 번만 돌린다
p = 'docs/foundation/31_tables_schema.md'
raw = open(p, 'rb').read()
crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')


def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:90], s.count(old))
    s = s.replace(old, new)


def line_starting(prefix):
    ls = [ln for ln in s.split('\n') if ln.startswith(prefix)]
    assert len(ls) == 1, (prefix, len(ls))
    return ls[0]


# §4 정체
old = line_starting('| 정체 분포 (10-24 A3 바꿈) |')
rep(old, old.replace('| 묶음별 |', '| 묶음별 — **프롤로그(D0) 사망 판은 뺀 분포**(10-24 검증 A3: h_random·h_wary 판의 절반이 D0 계단에서 끝나고 그 판은 축이 거의 0 이라 승객으로 셌다). 옛 방식(포함)은 사람 흉내 참고 줄 |'))
# §4 조심형
old = line_starting('| 조심형 봇 사망 (10-22 추가) |')
rep(old, '| 조심형 봇 사망 (10-22 추가) | 측정 | balanced·silent·lazy·diligent·steward·selfish_nb 합산 (사람 흉내·모험·남을 내미는 금기를 좋아하는 정책·**몸 꺼림(bodyAverse) 정책**은 뺀다 — 10-24 검증: 몸 꺼림은 제 몸으로 치르기보다 죽음 주사위를 일부러 고르는 버릇이라 조심형이 아니다) | 경고 글이 죽음을 바로 말하는 선택을 피하는 사람의 사망률 — "봇의 버릇"이 아니라 게임이 죽이는 정도 |')
# §4 A2
old = line_starting('| **A2 이른 날의 죽음** (10-24) |')
rep(old, '| **A2 이른 날의 죽음** (10-24) | 균형 D5까지 당신 사망 ≥ 10% · 균형 사망 중 한 사건 비중 ≤ 40% (사인 사건 기준 · **원인 사건 = 부상 출처** 기준 두 줄) · D2~D6 **날마다** 그날 사건으로 죽은 판 > 0 (**조심형 합산** — 신중한 플레이어, 깔때기 사건 뺌. 10-24 검증 A2: 전 정책 합산은 h_random·이기적 변형이 더해져 D3 처럼 신중한 플레이어의 죽음 길이 없는 날도 > 0 으로 가렸다 — 성향 봇·사람 흉내(h_random 뺌)·전 정책 합산은 참고 줄) + 날별 사망표 | 균형 · 조심형 | 명세 §6-3 · 검토 지적 3·17 · 10-24 검증 A2 |')
# §4 A1
old = line_starting('| **A1 이기심의 값** (10-24,')
rep(old, "| **A1 이기심의 값** (10-24, 옛 '이기적 사망 > 0' 대신 · **10-24 검증 바꿈**) | 합격선은 **버릇 없는 이기적**(`GROUPS.selfishPlain` = selfish_nb 막히면 버틴다 · selfish_rt0 끝까지 남을 내미는 금기)만 잰다: 이른 안전 D1~D4 생존 − 균형 ≥ +5%p (각각) · 열흘 생존 − 균형 < 0 (각각) · 사인 쏠림 ≤ 60% (그 블록에서 **사망 ≥ 20판**인 정책만 판정, 판정할 정책이 없으면 △). 몸 꺼림 정책(`selfishQuirk` = selfish·selfish_rt)의 생존 차·사인 쏠림·봇 버릇 죽음은 **참고 줄(측정)** — 그 죽음은 '버틴다'를 두고 고른 주사위(selfish 사망 231판 전부, 카르마로 판정이 된 금기로 죽은 판 0)라 이기심의 값이 아니다 · 카르마 측정 | 이기적 4종 · 균형 | 명세 §6-3 · 검토 지적 1·11·17 · 10-24 검증 A1·REG |")
# §4 A4
old = line_starting('| **A4 게으름의 값** (10-24) |')
rep(old, '| **A4 게으름의 값** (10-24) | 생존 (보통 − 게으름 = **주 지표**, 부지런 − 게으름) ≥ +5%p · D9 아침 주민 수 차 > 0 · D7 아침 식량+물+약 차 ≥ +0.2 · 못 본 일(missed)/판 측정. **(10-24 검증 A4-5) 이 세 정책만 블록 8개**(`run.js --a4blocks`, 기본 8 — 4블록 ✓ 이던 줄이 8블록에서 깨졌다)로 판정하고 블록 값은 따로 표. 봇 아침 조사는 **화면에서 닿는 물건만**(아래 봇 조사 규칙) · 게으름은 **조사만** 게으르다(명부는 보통처럼 반반 — 전에는 늘 빈칸이라 명부 차이가 섞였다) | balanced·diligent·lazy | 명세 §6-3 · 검토 지적 12 (부지런 봇은 닿는 모든 칸·소문을 보는 상한선이라 사람이 할 수 없다 — 보통을 주 지표로) · 10-24 검증 A4-5 |')
# §4 봇 버릇 점검 문단 끝에 덧붙임
old = line_starting('**봇 버릇 점검 (10-23, 합격선 줄)**')
rep(old, old + "\n**봇 버릇 점검 보강 (10-24 검증 REG)**: ① 조심형에서 몸 꺼림(bodyAverse) 정책을 뺀다(그 죽음은 참고 줄). ② **성향 가점은 죽음 주사위를 사지 못한다** — 조심형(avoidDeadly ≥ 1)은 평범한 대안(열림·금기 아님·죽음 글 아님)이 열려 있으면 죽음 글 선택의 축 가점을 0 이하로 본다(`bots.axisCapped`). 전에는 selfish_nb 가 dawn_strike '축 늘어진다'(손 −1 가점 +2 > 실패 15% 감점 1.5)를 '맞고 버틴다'보다 위에 두어 73판을 죽었다. 끝까지 남을 내미는 정책(tabooBonus)의 남을 내미는 금기는 그 정책의 본뜻이라 그대로. 헌신·부르는 사람(avoidDeadly < 1)도 그대로.\n**봇 아침 조사 = 화면에서 닿는 물건만 (10-24 검증 A4-5)**: 봇은 화면처럼 걸어가 앞 칸(또는 선 칸)의 물건을 조사한다(`bots.screenReach`). 막힌 칸 = game.js `blocked()` 와 같은 벽 타일(`# t R h D C`)·잠긴 역무실 문 `k`·숨지 않은 단단한 물건 칸(사람은 비켜 간다고 본다). 숨은 물건 = game.js `objectsOnMap` 의 hidden(선로 시신·무덤·계단 신발 none · 주인이 아직 안 온 물통·그릇·붕대 · 만나기 전 사람의 그릇). 승강장 화로는 조사가 아니다(화면에서 쓰면 단계를 넘김 — `useFire`). 지금 표에서 빠지는 물건: 화로 · 역무실 안 창고 상자·부품 상자(문 물건이 solid 라 열려도 못 들어감) · 서하 머리맡(17,9). 부지런(상한 봇)도 같다. sim.test 가 game.js 글을 읽어 규칙이 같은지 본다(화면이 바꾸면 실패 → 봇도 고친다). `run.js --all-objects` = 옛 판단, `--lazy-blank` = 옛 게으름 명부.")
# §6-6 흔적 late
old = line_starting('| 흔적 `late` (E3) |')
rep(old, old[:-1].rstrip() + " · **(10-24 검증 A4-4)** 같은 밤 방치 판정 뒤의 주민 사건·세계 시계가 그 물건을 다시 바꿔도(setTrace 는 late 0 으로 쓴다) `rollNight` 끝에서 late 를 되살린다 — '커져서 돌아온' 그 밤에 먼지·글·토스트가 사라지지 않게(`applyNeglect` 는 late 로 바꾼 물건 id 목록을 돌려준다) · **(A4-6)** '지금 늦은 흔적' = `E.lateNow(s, t)` = late 이고 **어젯밤 것**(day == 오늘−1). 조사 글(`inspectLineId`)·토스트·`view.traces[].late` 가 같은 규칙 — 며칠 지난 late 흔적에 '이틀째·어제부터' 글이 나오지 않는다(화면 먼지 game.js `lateOf` 는 같은 규칙 + 아직 안 봄) |")
# §6-6 봇 (sim) 정책 20 줄
old = line_starting('| 봇 (sim) | 정책 20:')
rep(old, old[:-1].rstrip() + " · **(10-24 검증)** 조심형에서 몸 꺼림 정책을 뺌 · 묶음 `selfishPlain`(selfish_nb·selfish_rt0) · `selfishQuirk`(selfish·selfish_rt) · `a4`(balanced·lazy·diligent) · 성향 가점 상한(`axisCapped`) · 아침 조사 = 화면에서 닿는 물건만(`screenReach`) · 게으름 명부는 보통처럼 반반 · `OPT.allObjects`·`OPT.lazyBlank` = 옛 규칙 |")
# §6-6 통계
old = line_starting('| 통계 (sim) |')
rep(old, old[:-1].rstrip() + " · **(10-24 검증)** 프롤로그(D0) 사망 `prologue` · 정체 분포 `identityNP`(프롤로그 사망 판 뺌)·`prologueDeaths` · A2 날마다 줄 = 조심형 합산 · A1 줄 = 버릇 없는 이기적, 사인 쏠림은 사망 ≥ `SIGN_MIN_DEATHS`(20)판 정책만 · 몸 꺼림·옛 방식 값은 참고 줄 |")
# §6-6 run.js
old = line_starting('| run.js |')
rep(old, old[:-1].rstrip() + " · **(10-24 검증 A4-5)** `--a4blocks=N`(기본 8): A4 정책(balanced·lazy·diligent)만 마지막 블록 + 1000씩 더 돌고, 합격선 표의 A4 줄은 그 블록 전부로 판정('판정 (블록 N개)', 합산 열 = 그 블록 전부) + 'A4 (블록 N개)' 표. 정책별 표·블록별 표는 기본 블록만 · `--all-objects`·`--lazy-blank` |")
if crlf:
    s = s.replace('\n', '\r\n')
open(p, 'wb').write(s.encode('utf-8'))
print('ok')
