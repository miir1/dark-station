# 31. 표 아홉 장 스키마 · 용어집 · 문장 검사 · 봇 합격선 (2026-10-21, 회의록 작업 3)

작성: 구현·검증 부장. 근거: 11_design_v2 · issues/minutes · 03_director_decisions 결정 기록(사망 ≥50%, 적나라 매일 하나꼴, 가상 역명, 사인 빈칸, 정체 후보 4~7, R1 열흘 전체).
"스키마" = 표의 칸 이름 약속. 모든 표는 `data/*.json`(또는 같은 내용의 .csv), 기반설계·텍스트 에디터가 직접 고친다. 코드는 열 이름만 안다.
공통 규칙: id는 소문자 영문·숫자·밑줄 24자 이내. 글(text·line) 열은 전부 한국어, §3 문장 검사 대상. 숫자 범위를 벗어나면 표 검사가 막는다.

## 1. 표 아홉 장
### ① 진행 순서표 `phases` — 하루가 어떤 순서로 가나
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · order | trace / ration / seat / day / evening / night / aftermath · 1~7 | 단계와 순서 |
| actions | dispatch 동작 id 목록 | 이 단계에서 허용되는 조작 |
| skipIf · timeBudgetSec | 조건식/빈칸 · 30~300 | 건너뛰는 조건(D0은 ration 없음) · 설계 목표 시간(검증용) |
예: `trace, 1, [inspect, talk], day==0, 90` · `ration, 2, [setBowl, confirmRation], -, 60`
### ② 자원·수치표 `numbers` — 세계 시계와 몸
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id | food / water / fuel / fog / flood / day / 몸: hunger / thirst / injury / counted / 손상: finger / leg / ear | 수치·깃발 이름 |
| owner | world / person | 세계 하나인가, 사람마다인가 |
| min · max · start · perDay | 정수 | 범위·첫 값·자동 변화(fuel 0 = 마지막 밤, 안개 +1은 밤 사건표가 건다) |
| visible | always / inspect / never | 화면에 보이나(never = 봇만. 정체 축이 여기 속함) |
예: `fuel, world, 0, 12, 8, -1, always` · `counted, person, 0, 1, 0, -, inspect`
### ③ 사건표 `events` — 원정 사건·매일 시험·고정 장면·결말
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · kind · when | kind: trip / trial / fixed / ending · when: day 범위 + phase + 조건식 | 종류와 때(fixed는 날짜 고정) |
| grade · explicit | normal / fixed · 0 / 1 | 글 등급(§3, fixed만 1문장 타자) · 적나라 표시(매일 하나꼴을 세는 열) |
| text · image | 글 · 그림 id/빈칸 | 상황 글(normal ≤40자×4문장, fixed 선택 전 ≤5문장) · 바뀌기 전 그림 1장 |
| choices[] | label(≤18자) · check(skill, base%) · cost · req(flag/item/손상) · taboo · out / ok / fail | 선택지. 항상 고를 수 있는 것 ≥1 |
| out.effects | numbers id → ±정수, flag +/-, trace id → 상태, axis → ±1, injure(who, n), kill(who), permanent(who, 손상) | 결과. **코드가 아는 효과 동사는 이 목록뿐** |
| out.text · out.ledger | 글 / 명부 줄 반영(⑨ 뒤 명부 행 참조) | 결과 글과 명부 |
예: `d5_rail_body, fixed, day==5&night, fixed, 1, "선로에 사람이 걸려 있었다…", scene_cannibal, [받는다 / 받지 않는다 / 칼을 빼앗는다(str 55%)]` · `trip_a1_stall, trip, day>=1&region==A, normal, 0, "가판대 밑에 상자가 있다.", -, [연다 / 지나간다]`
### ④ 인물표 `people` — 주민 6 + 바깥 2 + 당신
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · name · age · bio · skills | 글 · obs/str/tech/talk 각 0~3 | 이름은 용어집 고정 |
| needs | hunger / thirst / fear 0~10, bond = 사람 id | 욕구 4 |
| secretFlag · malice · hymn | flag id · 조건식 → 밤 사건 id | 비밀(화면 글에 안 나옴) · 악의/찬가가 터지는 조건과 사건(⑦) |
| callsGod · addressYou[] | 글 ≤6자 · 후보 id → 호칭 | 신을 부르는 그 사람만의 말 · 정체가 기울 때 당신을 부르는 말 |
| **metFlag** (10-24) | 깃발 id(소문자·숫자·밑줄 24자) 또는 빈칸 | 만남 깃발. 빈칸 = 처음부터 아는 사람. 있으면 그 깃발이 서기 전까지 '안 만난 사람'(§6-3) |
| **startAway** (10-24) | 0 / 1 | 1 = 처음엔 역 밖(status `away`). metFlag 깃발이 서면 역에 온다(`home`). 1 이면 metFlag 필수, outside 와 함께 못 씀 |
예: `soonrye, 김순례, 68, 전 역사 청소원, {2,1,1,2}, {3,2,4,seoha}, believes_plus_one, fog>=2→inform_up, water==0→give_water, "저 위", {driver:기사 양반, …}` · `you, 당신, -, -, {1,1,1,1}, {0,0,0,-}, -, -, -, -, -`
### ⑤ 지도표 `maps` — 역·원정 층
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · **displayName** | 글 | **가상 역명은 이 열에서만 바뀐다.** 코드·사건·대사는 id만 쓴다 |
| rows[] | 문자 격자(기호표 고정: # . , = ~ w d S T R A B k t m v E) | 타일 |
| start · fire · beds[] · exits{} · objects[] | 좌표 (objects는 ⑧ id + 좌표) | 고정 자리와 물건 자리 |
| floodRows[] · dark | [행, 수위 몇부터] · 0.0~1.0 | 침수 · 기본 어둠 |
예: `station, "회현삼거리역", 28×16 격자, [13,11], [13,10], 6자리, {A:[1,6], B:[26,13]}, [bowl_seoha@16,9 …], [[14,1],[13,3]], 0.4` · `drain_b1, "배수로 1층", 20×12, …`
### ⑥ 대사표 `lines` — 사람이 하는 말·조사 글·토스트
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · speaker · context | 사람 id / narrator / ui · 조건식 | 누가, 언제(같은 id 여러 행 = 조건으로 고름) |
| grade | normal / fixed / toast(≤30자) / choice(≤18자) | 길이 등급 |
| text | 글. `{who:이/가}` 치환 허용 | 본문 |
| rumor · truth | 0/1 · 0/1 | 소문이면 참/거짓(⑦에서 씀) |
예: `cab_window, narrator, identity==driver_lean, normal, "유리창에 모자 쓴 사람이 비친다.", 0, -` · `gicheol_part_lie, gicheol, day==4&flag:parts_hidden, normal, "통로는 이틀이면 돼.", 1, 0`
### ⑦ 밤 사건표 `nightEvents` — 당신 없이 일어나는 일 (역할별 12 + 쌍 고유 5)
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · role | steal / lie / inform / kill / share / protect / … 또는 pair | 역할별 / 쌍 고유 |
| actor · target | 사람 id, 또는 역할 조건(actor=needs.hunger≥7, target=bond) | 누가 누구에게 |
| cond | 욕구 문턱 + 세계 시계(fog·flood·day·fuel)만. **당신 위치·선택은 조건 금지** | 발생 조건 |
| weight · kind | 1~10 · malice / hymn / neutral | 같은 밤 후보 중 가중치 · 봇 집계용 |
| trace[] | object id → 상태(⑧) | 남는 흔적 |
| rumor · effects · oncePerRun | 목격자 id + lines id · ③의 효과 동사 · 0/1 | 소문 한 줄(거짓 가능) · 결과 · 한 판 한 번 |
예: `steal_food, steal, hunger>=7, -, food<=3, 6, malice, [crate_food:torn, bowl_actor:full], {nearestSleeper, saw_shadow}, food-1, 0` · `soonrye_water, pair, soonrye, seoha, water==0, 10, hymn, [bowl_seoha:full, lips_soonrye:cracked], -, -, 1`
### ⑧ 흔적·물건표 `objects` — 지도 위 물건과 그 상태
| 열 | 값 범위 | 뜻 |
|---|---|---|
| id · name | 글 | 물건 |
| states[] · overlay | 상태 id ≤4(normal 포함) · 상태별 덧그림 id | 빈/찬/옮겨짐/피 · 표현 부장의 덧그림 ~20장이 여기 걸린다 |
| inspectLine · ledgerFact | 상태별 lines id · 수첩 사실 줄 서식/빈칸 | 조사 글(사실만) · 수첩에 적을 수 있는 줄 |
| solid · light · resetOn | 0/1 · 0~6 · never / inspect / morning | 막힘 · 광원 · 흔적이 지워지는 때(저장에 상태·날짜·행위자 보관) |
| **owner** (10-24) | 사람 id 또는 빈칸 | 주인. 빈칸이면 id 끝 `_<사람 id>`(bottle_mari → mari)가 주인, 그것도 없으면 주인 없는 물건. 배치 검사(§6-4 같은 칸 = 같은 주인)만 쓴다. id 끝과 다르면 오류 |
| **holds** (P1-11 엔진 몫) | `{ text, effects, state }` 또는 빈칸 | 수납 내용. 닫힌(states[0]) 채로 조사했고 그 조사에 걸린 사건이 없으면 '닫힘→얻음→열림'(§6-5). text = 열 때 한 번 보이는 글, effects = 사건 결과와 같은 효과(두 꼴), state = 연 뒤 상태(기본 open) |
예: `bowl_seoha, 서하 물통, [full, empty], {empty: bowl_empty_ov}, {empty: insp_bowl_empty}, {empty: "D{day} 밤. 서하 물통 빔."}, 0, 0, inspect` · `pillow_gicheol, 기철 베개, [normal, blood], {blood: pillow_blood_ov}, …, never`
### ⑨ 정체 결정표 `identity` — 후보 4~7로 늘고 줄 수 있게
| 열 | 값 범위 | 뜻 |
|---|---|---|
| axes(표 머리) | 축 id 목록(지금 share / hand / name, 축 수 변경 가능) | 각 축 −9~+9 정수, 저장에만 |
| candidate | driver / passenger / inspector / counted / conductor / platform_one / counting_child … | 4~7개, 행 추가로 늘림 |
| rule | 축별 조건식(예: share<=-2 & hand>=2) | **칸 번호가 아니라 조건식**이라 후보 수·축 수가 바뀌어도 표만 고친다 |
| priority · fallback | 1~9 · 0/1 | 둘 이상 맞으면 높은 것(**센 자 덮어쓰기** = 9) · 아무 것도 안 맞을 때 후보(정확히 1행) |
| reveal | lines id(차장 호칭·운전석·명부 첫 줄) + image id | 결말 연출 |
| dreams[] · callName · ledgerReader | 꿈 lines id · 호칭 단계 · you / conductor / resident | "쌓인다"를 보이는 재료 · 명부를 읽는 사람 |
예: `driver, share<=-2 & hand>=2, 5, 0, [reveal_driver, seat_shoe], [dream_cab1..3], 기사 양반, conductor` · `counted, name>=3 & share>=1, 9, 0, [reveal_counted], …, (이름 안 부름), resident`
표 검사: 후보 ≥4, fallback 정확히 1, 모든 후보에 reveal·ledgerReader 있음, 봇 정책마다 도달 가능(§4).
### 명부 행(결말 출력, 표가 아니라 상태) — 사인 칸 빈칸 반영
| 열 | 값 범위 |
|---|---|
| name · line(0=당신) · status | boarded / dead / ascended / stayed |
| day | 죽거나 올라간 날 또는 빈칸 |
| **cause** | **빈칸 허용** — 플레이어가 적기를 고른 사실 줄 id만. 비워 두면 "___" 그대로 출력. 적지 않는 것도 선택 |
| written[] | 플레이어가 적은 사실 줄 id(⑧ ledgerFact) |

## 2. 용어집 초안 (30개 이내) — 화면 글은 이 표기만 쓴다
| 구분 | 용어 — 뜻 (금지 표기) |
|---|---|
| 세계 | **안개** 계단에서 멈춘 잿빛(연기·가스 ✗) · **재** 안개가 내려온 자리, 칸 단위 · **위/저 위** 지상 쪽(천국·신 ✗) |
| 세계 | **세는 것/셈** 밤에 사람 수를 세는 소리, 사람마다 다른 이름(④ callsGod) · **세어진다** 셈에 대답해 운임이 붙은 상태 · **올라간다** 신발 벗고 계단을 오름("죽는다"와 구별) |
| 세계 | **열차/차장/검표** 정오에 오는 것 / 명단을 읽는 이 / 운임을 묻는 일 · **운임** 빵·물·지킨 약속 하나(표·티켓 ✗) |
| 세계 | **명부** 당신 글씨의 명단 한 장, 결말 화면 · **수첩** 사실 줄 + 뒷장 추측문(일지·로그 ✗) · **흔적/소문** 밤 사건의 물건 상태 / 목격자 한 줄(거짓 가능) |
| 세계 | **순찰대** 셔터 너머 무리("병원 팀"은 은채만) · **땔감** 화로 연료, 0 = 마지막 밤 · **통로/배수로/지하상가** R/B/A 방향의 화면 이름 |
| UI | **그릇** 배식 단위("식량 1" ✗) · **자리** 하루 배치 칸(일·작업 ✗) · **조사** Space로 보는 행동(상호작용·인터랙트 ✗) |
| UI | **띠/패널/창** 아래 목표줄 / 오른쪽 숫자 / 대화상자 · **고정 장면** fixed 등급 글 · **경상/중상/위독** injury 1/2/3 · **손가락/다리/귀** 영구 손상 3종 |
| 엔진 | **dispatch/action** 상태를 바꾸는 유일한 문 / 그 입력 · **state/normalize/migrate** 순수 JSON 상태 / 저장 검사 / 버전 변환 · **phase** ①의 단계 id |
| 엔진 | **effect** ③의 효과 동사 7종 · **axis/candidate** 정체 축 정수 / 정체 후보 · **trace/rumor** ⑦·⑧의 흔적 상태 / 소문 줄 · **fixture/bot policy** 검증용 고정 상태 / 봇 선택 규칙 |
## 3. 문장 검사 규칙 (`tools/check_text` — 표의 글 열 전부)
| 규칙 | 기준 | 위반 처리 |
|---|---|---|
| 길이 normal | 문장 ≤40자, 한 글 ≤4문장 | 오류(표:id:문장) |
| 길이 fixed · choice · toast | 문장 ≤50자, 선택 전 ≤5 + 결과 ≤3문장 · ≤18자 · ≤30자 | 오류 |
| 금지(성폭력) | 낱말: 강간, 성폭행, 성추행, 겁탈, 능욕, 옷을 벗기, 몸을 더듬, 추행 | 오류 — 글 열에 못 쓴다. 간접 언급은 사건 설명(비표시) 열에만 |
| 금지(자해) | 낱말: 자해, 손목을 긋, 목을 매, 스스로 목숨, 자살, 약을 털어 | 오류 |
| 허용 확인 | 살인·식인·시체·고문·배신은 검사 안 함. 단 `explicit=0`인 글에 피·시체·칼 낱말 3개 이상이면 경고 | 경고(표시 누락 의심) |
| 신 이름 0 | 네레·구르마·세엘·테르미아·오스렌·히스카·호 + "신"(단독) + "강림·징조·시선" — 화면 글 열에 나오면 위반. ④ callsGod 열 제외 | 오류 |
| 용어 통일 | §2 금지 표기(연기, 천국, 표, 티켓, 일지, 로그, 작업, 인터랙트…) | 오류 |
| 수치 노출 · 조사 | "신뢰·스트레스·호감·카르마"+숫자 · `{who:이/가}` 서식·조사 불일치 | 오류(E6) · 경고 |
| 결과 | 오류 0 = 통과. 경고는 텍스트 에디터가 판정해 `textcheck_ok.txt`에 id 적으면 다음부터 지나감 | |

## 4. 봇 합격선 표 (조사 정책 부지런·보통·게으름 × 정체 정책 4~6 × 200판)
| 항목 | 합격선 | 재는 정책 | 근거 |
|---|---|---|---|
| 당신 사망(올라감 포함) | **≥ 50%**, 상한 없음 | 보통 | R2 보정. 같이 검사: 사망 중 **실질 경고** 있던 선택 100% — "운이 아니라 결정". 실질 경고 = 고른 선택지에 hint/warn/taboo 가 있고 **강제가 아니다**(10-22 리드 결정: 선택지 하나뿐인 죽음·다른 길이 모두 잠긴 주사위는 경고 글이 있어도 '경고 있음'으로 세지 않는다). 밤 사건·새벽 위독 사망도 경고 없음 |
| 전멸 · 사망 중 전투 원인 | **≤ 25%** [제안] · ≤ 50% | 보통 | 사망 ≥50%와 양립하려면 "당신은 죽어도 명부는 남는다"가 대부분이어야 |
| 밤 사건 수 | ≥ 6 / 판 (malice ≥ 2, hymn ≥ 1) | 전 정책 | 쟁점 5 |
| 발견율(흔적·소문 중 하나라도) | **측정만** (10-24 A4: 하한 폐기 — 발견율을 맞추려 소문을 늘리지 않는다). 부지런은 상한 보고 | 보통·게으름 | 쟁점 5 · 10-24 A4 |
| 끝까지 모르는 사건 · 찬가 발견율 | ≥ 1 / 판 · 부지런 ≥ 70%, **게으름은 측정만**(10-24 A4) | 게으름 · 둘 | 쟁점 5 · 7 |
| 정체 분포 (10-24 A3 바꿈) | **성향 봇 평균**(balanced·selfish·devoted·silent·caller·steward·counter·child)과 **사람 흉내 평균**(h_random·h_wary·h_cautious·h_cautious2·h_mixed)을 따로: 둘 다 각 후보 ≥ **3%**, 성향 봇 평균의 가장 큰 후보 ≤ **40%**. 사람 흉내의 가장 큰 후보는 측정(디렉터 확인: 승객이 가장 흔한 결말). 옛 '정책 전체 평균 각 ≥ (100/후보 수)/2 %' 는 측정만 | 묶음별 — **프롤로그(D0) 사망 판은 뺀 분포**(10-24 검증 A3: h_random·h_wary 판의 절반이 D0 계단에서 끝나고 그 판은 축이 거의 0 이라 승객으로 셌다). 옛 방식(포함)은 사람 흉내 참고 줄 | A3 분석 §5·§6 (성향 0 봇 다섯이 같은 결말을 다섯 번 세지 않게). 정체 '각 후보' 줄의 경계는 합격선의 절반(±1.5%p) |
| 하루 결정 수 · 같은 카드 반복 | ≥ 5 · ≤ 20% / 판 | 보통 | 쟁점 6 · 11_design_v2 |
| 적나라 장면 노출 | explicit=1 사건 ≥ 7 / 판 | 보통 | R3 매일 하나꼴 |
| 결정성·저장 왕복 | 100% | 전 정책 | 기존 테스트 유지 |
| 강제 사망 = **확정 사망** (10-22 추가, **10-24 바꿈**, **10-24 tightrope R1 정의 바꿈**) | **0 판** (전에는 ≤ 20%) · 앞선 자유 경고 선택 없는 강제 사망 0판 · 참고 줄: 위험 0 출구가 없던 죽음(옛 정의, 측정) | 전 정책 합산 | 옛 "경고 있던 선택 100%"는 마지막 선택에 경고 글이 있는지만 봐서 선택지 하나뿐인 죽음·나머지가 잠긴 주사위도 통과했다. **강제 = 고를 때 열린 선택지 전부 살 확률 0** (살 확률 = 판정 없으면 결과가 당신을 안 죽일 때 1 · 판정이면 화면 % × (성공이 안 죽임) + (1 − %) × (실패가 안 죽임)) — 살 확률 > 0 인 주사위가 하나라도 열려 있으면 강제가 아니고, 경고 글이 있으면 실질 경고다(03 '어느 선택지에도 살 확률이 있다', 카르마 판의 줄타기는 일부러 위험 0 출구가 없다). 옛 정의(당신이 죽지 않는 열린 선택지 0개)는 `ended.cause.noSafe`. 엔진이 사인 기록(`ended.cause.forced`·`free`)에 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택)을 함께 남긴다 — 강제 사망의 실제 갈림길(진단용 줄) |
| 조심형 봇 사망 (10-22 추가) | 측정 | balanced·silent·lazy·diligent·steward·selfish_nb 합산 (사람 흉내·모험·남을 내미는 금기를 좋아하는 정책·**몸 꺼림(bodyAverse) 정책**은 뺀다 — 10-24 검증: 몸 꺼림은 제 몸으로 치르기보다 죽음 주사위를 일부러 고르는 버릇이라 조심형이 아니다) | 경고 글이 죽음을 바로 말하는 선택을 피하는 사람의 사망률 — "봇의 버릇"이 아니라 게임이 죽이는 정도 |
| **A2 이른 날의 죽음** (10-24) | 균형 D5까지 당신 사망 ≥ 10% · 균형 사망 중 한 사건 비중 ≤ 40% (사인 사건 기준 · **원인 사건 = 부상 출처** 기준 두 줄) · **D2·D4·D5 날마다** 그날 사건으로 죽은 판 > 0 (**10-24 디렉터 · tightrope §3 바꿈**: D3 = 규칙을 배우는 날 — 신중하면 그날 안 죽음, D6 = 값을 치르면 사는 날 → **D3·D6 그날 사망은 측정 줄**) (**조심형 합산** — 신중한 플레이어, 깔때기 사건 뺌. 10-24 검증 A2: 전 정책 합산은 h_random·이기적 변형이 더해져 D3 처럼 신중한 플레이어의 죽음 길이 없는 날도 > 0 으로 가렸다 — 성향 봇·사람 흉내(h_random 뺌)·전 정책 합산은 참고 줄) + 날별 사망표 | 균형 · 조심형 | 명세 §6-3 · 검토 지적 3·17 · 10-24 검증 A2 |
| **A1 이기심의 값** (10-24, 옛 '이기적 사망 > 0' 대신 · **10-24 검증 바꿈**) | 합격선은 **버릇 없는 이기적**(`GROUPS.selfishPlain` = selfish_nb 막히면 버틴다 · selfish_rt0 끝까지 남을 내미는 금기)만 잰다: 이른 안전 D1~D4 생존 − 균형 ≥ +5%p (각각) · 열흘 생존 − 균형 < 0 (각각) · 사인 쏠림 ≤ 60% (그 블록에서 **사망률 ≥ 10%**인 정책만 판정, 판정할 정책이 없으면 △). 몸 꺼림 정책(`selfishQuirk` = selfish·selfish_rt)의 생존 차·사인 쏠림·봇 버릇 죽음은 **참고 줄(측정)** — 그 죽음은 '버틴다'를 두고 고른 주사위(selfish 사망 231판 전부, 카르마로 판정이 된 금기로 죽은 판 0)라 이기심의 값이 아니다 · 카르마 측정 | 이기적 4종 · 균형 | 명세 §6-3 · 검토 지적 1·11·17 · 10-24 검증 A1·REG |
| **A1 아슬함** (10-24 tightrope §1-7 · **10-25 최종판 바꿈 — 검증 지적**) | **화면 ≤ 85%(죽을 확률 ≥ 15%, `E.ROPE_FELT_MAX`) 줄타기 판정 넘김/판 (열흘을 산 판) ≥ 2** · **산 판 중 그 판정 ≥ 2번 넘김 ≥ 60%** (값 칸에 산 판 수 · 산 판 줄타기 넘김 중 그 몫 % · 전체 판 평균) — 옛 합격선(줄타기 판정 전부)은 넘김의 절반쯤인 90% 넘는 판정까지 세어 '아슬하다'를 부풀렸다 → 참고 줄 '줄타기 판정 전부(…옛 A1 아슬함)' 하나(넘김/판 · 산 판 중 ≥ 2번 %, 측정)로 내렸다. 옛 집계(화면 ≤ 85% 칸 없음)는 '-'(미달) · 죽음 판정 넘김/판(산 판 — 당신을 죽이는 모든 판정) · 줄타기 굴림/판 · 줄타기로 죽은 판 | selfish_nb (`GROUPS.rope` — 경고를 읽고 버티는 이기적) · 측정 줄은 균형·게으름도 | 설계 tightrope §1-7 — 줄타기의 '아슬함'(죽을 뻔한 판정을 여러 번 넘김)이 실제로 느껴지는지 숫자로. 줄타기 = rope 칸이 얹힌 판정(엔진 `s.stats.ropeRolls·ropeClose`) |
| **A4 게으름의 값** (10-24) | 생존 (보통 − 게으름 = **주 지표**, 부지런 − 게으름) ≥ +5%p · D9 아침 주민 수 차 > 0 · D7 아침 식량+물+약 차 ≥ +0.2 · 못 본 일(missed)/판 측정. **(10-24 검증 A4-5) 이 세 정책만 블록 9개**(`run.js --a4blocks`, 기본 9 — 4블록 ✓ 이던 줄이 8블록에서 깨졌다 · 10-25 기본 블록이 5개가 되어 8 → 9: 1~8001)로 판정하고 블록 값은 따로 표. 봇 아침 조사는 **화면에서 닿는 물건만**(아래 봇 조사 규칙) · 게으름은 **조사만** 게으르다(명부는 보통처럼 반반 — 전에는 늘 빈칸이라 명부 차이가 섞였다) · **(10-24 tightrope §2-3) 측정 줄 셋**(A4 블록 전부로): **실제 발견율**(누구나 아는 밤 — public:1·kill 효과 행 — 을 뺀 주민 사건 가운데 발견, 옛 발견율 옆에 · 소문은 안 늘린다) · 누구나 아는 밤/판·숨은 밤/판 · 눈먼 새벽/판·그 죽음 판 | balanced·diligent·lazy | 명세 §6-3 · 검토 지적 12 (부지런 봇은 닿는 모든 칸·소문을 보는 상한선이라 사람이 할 수 없다 — 보통을 주 지표로) · 10-24 검증 A4-5 |
| 모험 봇 열흘 생존 (10-24 바꿈) | ≥ 40% → **≥ 25%** [리드·디렉터 확인 필요 — 이른 위기 판정을 모험이 다 굴린다] | risky | 명세 §6-3 |
| 위기 때 값 길이 열린 비율 (10-24) | 측정 (d2_shutter_arm·d4_spanner·d5_flood 가 걸렸을 때 비용 있는 금기 아닌 선택이 열려 있던 비율) | 균형 | 검토 지적 18 — 디렉터 확인용 |
기준값은 `sim/baseline.json`에 저장, ±10% 밖이면 경고. 보고서 1장(이 표에 실측 열 추가)이 작업 6의 결과물.
**판정 규칙 (10-22 추가, 10-24 기본 4블록, 10-25 기본 5블록)**: 합격선은 서로 다른 시드 블록 둘 이상(**기본 시드 1~N · 1001~ · 2001~ · 3001~ · 8001~ 다섯 블록** — 10-25 최종판: 표본 운을 줄이려 새 블록 8001 을 더했다, `run.js --blocks=` · `--seed0=`)에서 따로 잰다. 차이로 재는 줄(이기적 − 균형, 보통 − 게으름 등)도 %p 이면 같은 규칙이다(예: 합격선 +5%p 에 실측 +8%p 는 △). 모든 블록 통과이고 %로 재는 줄의 실측이 합격선에서 5%p 밖이면 ✓, 모든 블록 미달이면 ✗, 그 밖(블록마다 다름 · ±5%p 안)은 △ — ✓로 확정하지 않는다. 정책별 표는 블록을 합친 값, 블록별 생존·사망·열차·강제 %는 따로 싣는다.
**봇 선택 규칙 (10-22 추가, 화면 정보만 — E6)**: 판정 없는 선택의 경고 글이 죽음을 바로 말하면(끝이다·죽는다·올라간다·못 일어난다·센다) 대안이 있는 한 고르지 않는다(헌신·부르는 사람은 축이 세게 끌면 고를 수 있다). 몸이 성치 않을 때(부상 ≥1, 제 손으로 고른 병) 약만 드는 회복 선택은 비용 감점 없이 가점 +5 — 모험의 판정 가점(+4)보다 커서, 약을 손에 두고 열·병 주사위에 목숨을 걸지 않는다(원정·거래·협정과 그 변형 행 `trade_shutter_b` 등은 회복이 아니다). 모험 봇은 판정(%) 있는 위험만 가점, 판정 없는 경고에는 가점 없음.
**봇 선택 규칙 보강 (10-23, 리드 지적 A1)**: 죽음 글 목록에 '아침이 안 올'을 더하고, **판정 있는 선택도** 죽음 글이면 감점한다 — 크기는 화면의 실패 %(감점 10 × 피하는 정도 × 실패 %, 판정 없는 선택은 × 1). 전에는 판정이면 빼 줘서, 모든 선택지에 경고가 붙은 사건(dawn_dongha2 등)에서 낮은 % 감점(±1)만으로 갈려 조심형도 45% 죽는 주사위를 무릎 꿇기·손가락보다 먼저 골랐다. 모험 봇은 판정 없는 경고에 작은 감점(−0.5) — 굴릴 것 없이 손해만 확정이라, 경고 없는 쪽과 동점일 때 확정 사망(d8_patrol_return '내주지 않는다')을 반반으로 고르지 않는다. 모험은 여전히 판정 위험을 좋아해서 실패하면 죽는 주사위도 성공 약 56% 이상이면 고른다.
**봇 버릇 점검 (10-23, 합격선 줄)**: 조심형 봇이 *평범한 대안*(당신을 죽일 수 없고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽은 판 = **0 판**. 다른 길이 모두 죽음 주사위거나 금기뿐인 자리의 죽음은 들지 않는다(사건이 낸 선택). 엔진은 선택 결과에 고를 때 열려 있던 선택지 번호를 `lastResult.open` 으로 남긴다(집계용, 화면은 안 본다).
**봇 버릇 점검 보강 (10-24 검증 REG)**: ① 조심형에서 몸 꺼림(bodyAverse) 정책을 뺀다(그 죽음은 참고 줄). ② **성향 가점은 죽음 주사위를 사지 못한다** — 조심형(avoidDeadly ≥ 1)은 평범한 대안(열림·금기 아님·죽음 글 아님)이 열려 있으면 죽음 글 선택의 축 가점을 0 이하로 본다(`bots.axisCapped`). 전에는 selfish_nb 가 dawn_strike '축 늘어진다'(손 −1 가점 +2 > 실패 15% 감점 1.5)를 '맞고 버틴다'보다 위에 두어 73판을 죽었다. 끝까지 남을 내미는 정책(tabooBonus)의 남을 내미는 금기는 그 정책의 본뜻이라 그대로. 헌신·부르는 사람(avoidDeadly < 1)도 그대로.
**봇 아침 조사 = 화면에서 닿는 물건만 (10-24 검증 A4-5)**: 봇은 화면처럼 걸어가 앞 칸(또는 선 칸)의 물건을 조사한다(`bots.screenReach`). 막힌 칸 = game.js `blocked()` 와 같은 벽 타일(`# t R h D C`)·잠긴 역무실 문 `k`·숨지 않은 단단한 물건 칸(사람은 비켜 간다고 본다). 숨은 물건 = game.js `objectsOnMap` 의 hidden(선로 시신·무덤·계단 신발 none · 주인이 아직 안 온 물통·그릇·붕대 · 만나기 전 사람의 그릇). 승강장 화로는 화면 `useFire` 를 따른다: 지금 화면은 화로 창의 **'화로를 살핀다'**(`lookFire` = 엔진 inspect)를 골라야 보고, 단계를 넘길 때는 저절로 보지 않는다(10-24 화면 고침) → 봇도 화로를 **다른 칸과 같은 조사 한 칸**으로 고른다. 화면이 넘길 때 저절로 보게 바꾸면 `bots.FIRE_ON_ADVANCE = true`(아침 끝에 모든 정책이 한 번, 조사 칸 수에 안 듦), 살필 길이 없으면 `SCREEN_NOT_INSPECT.station` 에 'fire'. 지금 표에서 빠지는 물건: 역무실 안 창고 상자·부품 상자(문 물건이 solid 라 열려도 못 들어감) · 서하 머리맡(17,9). 부지런(상한 봇)도 같다. sim.test 가 game.js 글을 읽어 규칙(벽 타일·잠긴 문·단단한 물건·숨은 물건·화로: useFire 가 저절로 조사 ↔ FIRE_ON_ADVANCE · lookFire 로 살필 길 ↔ SCREEN_NOT_INSPECT)이 같은지 본다(화면이 바꾸면 실패 → 봇도 고친다). `run.js --all-objects` = 옛 판단, `--lazy-blank` = 옛 게으름 명부.
**봇 정책 (10-23)**: 9번째 정책 steward = 몫+·손−·이름+(보통 조사, 조심형). 이 조합이 없어서 정체 후보 inspector 가 정책 합산 0.1%였다. **주민 치료**: 저녁(그날 마지막 치료 기회)에 위독한 주민을 치료한다 — 몫+ 정책은 약을 다 쓰고, 몫 0 정책은 자기 몫 약 1을 남기고, 몫− 정책은 하지 않는다(화면에도 '상처를 감아 준다'가 있다).

## 5. 일정 재어림 (R1: 수직 슬라이스 = 열흘 전체, D3·D5는 점검점)
| 작업 | 범위 | 어림 | 주 |
|---|---|---|---|
| 5 해석기·표 로더·저장(현재+직전 아침 사본+변환)·`?fast=1` | 표 9장 읽기, 효과 동사 7, 밤 사건 굴림, 정체 함수, 테스트 결정성/왕복/8칸 | **중** | 2주 |
| 6 엔진 봇 정책 6 × 200판 + 보고서 | 조사 3 × 정체 4~6, baseline.json, 합격선 표 실측 | **소~중** (표가 채워진 뒤) | 1주 |
| 7 화면 D0~D10 + 플레이스루 | 프롤로그·하루 7단계·고정 장면 4+1·전투·결말 명부, 흔적 덧그림 연결, 0배속 완주 스크립트 | **대** | 5~6주 (D0~D3만이면 2~3주) |
합계 어림 **8~9주**(병렬 시 7주). 작업 7이 가장 크므로 D0~D3 화면을 먼저 올려 점검점을 통과한 뒤 D4~D10을 잇는다 — 범위 축소가 아니라 순서다.
- **D3 점검점**: 배식 그릇·아침 흔적·밤 사건이 실제로 돌고(발견율 측정 가능), 셈 "+1"에서 당신이 세어질 수 있는지, 저장/복구가 한 번 끊겨도 이어지는지, 정체 축이 세 축 모두 움직였는지.
- **D5 점검점**: 식인 장면(explicit, fixed 등급, 그림 1장)이 글·그림·선택·명부 줄까지 한 줄로 통하는지, 범람 수위가 밤 사건 조건을 실제로 바꾸는지, 전투 1회 + 영구 손상이 선택지 잠금으로 나타나는지, 사망률이 D5 시점에 이미 ≥25%인지(최종 ≥50%의 중간 지표).

## 6. 약속 추가 (2026-10-21 코디네이터 결정 ①②③, v4/engine 반영)
| 항목 | 약속 |
|---|---|
| 조건식 토큰 | 기본: `이름 연산자 값`, `&`·`\|`·`!`·괄호, 빈칸·`-`·`always`=참. 값은 정수 또는 이름(문자 비교). **접두 토큰**: `flag:x`(깃발) · `inspect:x`(그 물건을 방금 조사함, 사건 when 전용) · `talk:x`(그 사람에게 방금 말 걸음, when 전용) · `trace:x==상태`(흔적 상태, 없으면 `none`) · `alive:x`(그 사람이 역에 살아 있음). 그 밖의 이름: `day` `phase==night` `map==car` `region==A` `floor==1` 세계 수치(`food`…) 사람 수치(`hunger`, `needs.hunger`, `injury_gicheol`) |
| 단계 표 `hook` 열 | 선택. `rollNight` = 그 단계를 떠날 때 밤 사건을 굴린다. 단계 이름은 조건식에서 `phase==이름` 으로 쓴다 |
| effects 두 꼴 | 정식 = 객체 `{food:-1, hunger:{who:'actor', n:-3}, flag:{x:true}, trace:{crate_food:'open'}, axis:{share:1}, injure:{who,n}, kill:{who}, permanent:{who, kind}}`. 배열 `[{verb:'number', id, n, who}, {verb:'flag', id, set}, {verb:'trace', id, state}, {verb:'axis', id, n}, {verb:'injure', who, n}, {verb:'kill', who}, {verb:'permanent', who, loss}]` 도 받으며 **로더가 객체 꼴로 바꾼다** |
| 자리표시 | 흔적 물건 id 의 `{actor}`/`{target}` 또는 `_actor`/`_target` 접미 → 사람 id 로 치환 (`bowl_actor` → `bowl_gicheol`). 그런 물건이 objects 에 하나는 있어야 한다 |
| 밤 사건 대상 키워드 | `bond` · `any`/`randomSleeper`/`nearestSleeper`/`farthestSleeper`(자리 정보가 없어 전부 무작위) · `mostInjured` · 사람 id · 조건식. **나이로 거르지 않는다**(10-22 디렉터 결정 "미성년 처리 금지" — 서하(17)도 행위자·대상·부상·영구 손상·죽음이 다른 주민과 똑같다. 그림에서만 생성기 거부 때문에 서하를 잔혹 장면 프레임 밖에 둔다) |
| 밤 사건 금지 어휘 | `you_*`·`pos*`·`map`·`inspect:`·`talk:` — 당신의 위치·조작은 조건이 될 수 없다(표 검사 오류) |
| 정체 규칙 | `rule` 에는 **축 이름만**(몫·손·이름). 세계 수치·깃발 금지(표 검사 오류). 후보 키는 `id`(`candidate` 도 받음), 표 머리의 `thresholds`·`note` 는 메모로 무시 |
| 추가 약속 (10-21 늦게) | `injure.n` 은 ±1~3(음수 = 부상 회복) · `people.addressYou.default` = 정체가 안 기운 때의 기본 호칭 · 조건식에 빈 글 비교 `x==''` / `x!=''`(없는 값도 빈 글, `==`/`!=` 만) · `rumor.line: ""` = 소문 없음 |
| 비어 있는 칸 | 선택지의 `check:null` `cost:{}` `req:{}` `taboo:''` `warn:''` `ledger:''`, 밤 사건의 `target:''` 은 "없음"으로 읽는다 |
| 파일 이름 | `night_events.json` 정식, `nightEvents.json` 도 읽음 |

### §6-2. 약속 추가 (2026-10-22, 데이터·화면 담당 요청 20건을 엔진이 받음 — v4/engine, 테스트 v4/test/requests.test.js)
| 항목 | 약속 |
|---|---|
| 치료 `treat` | `{type:'treat', who}`. numbers 표 `treat_meds`(약 몇 개)·`treat_injury`(부상 변화, 음수)를 읽는다. 약이 모자라거나 · 다친 데가 없거나 · 오늘 이미 치료했거나(`treated_<who>` 깃발) · 표에 두 행이 없으면 거절. 성공하면 `treated_<who>` 깃발(그날 밤 위독 판정 면제, 아침에 지워짐). 단계 actions 에 `treat` 가 있어야 한다 |
| 결과 그림 | 선택 결과(out/ok/fail)의 `image` 열 → `lastResult.image`, 당신이 끝났으면 `ended.cause.image` |
| 효과 목록 | 한 결과 안에서 같은 수치 id·`injure`·`kill`·`permanent` 를 여러 번 쓰면 **값이 목록**이 되고 차례로 전부 적용된다(객체 꼴로 직접 쓸 때도 `injure:[{who,n},{who,n}]` 허용). 같은 `axis` 두 번은 합. 빈 목록은 표 검사 오류. 한 번만 쓴 키는 지금처럼 값 하나 |
| who 낱말 | `you` · `self`/`actor` · `target` · `companion`(원정 동행 중 살아 있는 첫 사람) · `party`(원정 편성 전원, 당신 포함) · `all`(역에 있는 사람 전부, 당신 포함) · `bondOfActor`(행위자의 bond) · `world` · 사람 id. 그 밖은 표 검사 오류. 풀 수 없으면(동행 없음 등) 아무 일도 없다 |
| 사건 `target` 열 (새, 선택) | 사람 id 또는 `any`·`randomSleeper`·`nearestSleeper`·`farthestSleeper`(무작위)·`mostInjured`·`bond`. 사건이 걸릴 때 정하고(못 정하면 그 사건은 안 걸린다) 결과의 `who:'target'`·명부 줄이 같은 사람을 가리킨다. 무작위 대상은 역에 있는 주민(당신 제외, 나이 무관 — 10-22 미성년 처리 금지). 결과의 `target` 열이 있으면 그것이 먼저. `eventView` 에 `target`·`targetName` |
| 결말 열 (새, kind ending 전용) | `board: 1` = 이 결말이 걸려 있는 동안 `board` 동작이 열린다(단계 actions 에 없어도), 결말에서 `board_<id>` 깃발 주민은 `boarded`. `endStatus: walked` = 결말 뒤 역에 남은 산 사람(당신 포함)의 status. 없으면 그대로(명부 '남았다'). 다른 kind 에 쓰면 표 검사 오류 |
| 명부 status `walked` | '걸어 나갔다'. ledger rows·format·저장 정규화가 안다 |
| 결과의 명부 줄 `ledger` | `{who, status, day, cause, text}` 또는 그 **목록**, 또는 글 한 줄(당신의 사실 줄). `status` boarded/stayed/walked → 아직 역에 있는 그 사람의 status 를 바꾼다(dead/ascended 는 kill 효과가 정하고 여기선 기록만). `day` "{day}"·정수. `cause` 글 → 사인 칸, `"물건:상태"` → 그 물건의 ledgerFact 줄. `text` 가 있을 때만 사실 줄(written)에 쌓는다 — text 없는 행은 더 이상 쌓이지 않는다. 표 검사: status 값·`물건:상태` 참조·who |
| 결말 사인 `ended.cause` | 당신이 죽었거나 올라갔거나(결말 사건 안 포함) 떠났으면 `{event, choice, warned, forced, free, image, night}`. **warned = 실질 경고**(고른 선택지에 warn·hint·taboo 가 있고 강제가 아님, 10-22) · **forced** = 그 순간 당신이 죽지 않는 열린 선택지가 0개(이 선택 포함; 결과 out·ok·fail 중 하나라도 kill 이 당신에게 닿으면 '죽을 수 있는' 선택) · **free** = 갈림길 `{event, choice, day}` 또는 null — 강제면 그 전 마지막 자유 경고 선택, 아니면 이 선택까지의 마지막 자유 경고 선택(자유 경고 선택 = 경고 글이 있고 다른 열린 선택지가 있던 선택; 상태 칸 `s.lastFree`). 밤 사건이 당신을 데려가면 `event` = 그 밤 사건 id, `choice: null`, `warned: false`, `forced: false`, `night: true`. 새벽 위독 사망은 `event: injury_untreated`, `warned: false` |
| 읽는 사람 `ended.readerId` | `'you'`·`'conductor'`·주민 id·`null`. 주민 = 살아 있는 주민 중 people.age 가 가장 많은 사람(역에 남은 사람 먼저, 없으면 탄 사람). `E.readerId(s, db)` 로도 |
| 사건 연쇄 | `choose` 뒤 끝나지 않았으면 같은 단계의 사건을 다시 찾는다. 이미 끝난 once 사건과 **이번 단계에 이미 고른 사건**(`s.phaseSeen`)은 빠진다 — `once:0`(되풀이) 사건도 한 단계에 한 번. `move` 도 사건을 깨운다(지도 조건 `map==x`) |
| 집계 `s.fired` | 고른 사건 id → 횟수. once:0 사건도 센다(explicit/판은 이것으로) |
| 소문 발견 | 들은 소문은 **참(truth 1)일 때만** 발견이다 |
| 배식 흔적 | 받은 그릇 `full`, 못 받은 그릇(0 이거나 식량·물 부족) `empty`. 둘 다 당신이 한 일이라 본 것(seen)·`by:'you'`. 밤에 빈 그릇이 차면 아침에 구별된다 |
| 몸 신호 `view.people[].signs` | `{sleepless, starving, ateFlesh}`(역에 없는 사람 null). 문턱은 밤 사건표 actor 조건식: role `fear`·`ascend` 행 → sleepless(당신 제외), role `steal`·`starve` 행 → starving(`any`·이름 지목 행 제외). ateFlesh = 깃발 `ate_flesh_<id>` 또는 `<id>_ate…`. `E.signs(s, db)` 로도 |
| 원정 `trip` | 낮 단계에 한 번(지역 하나). 첫 동작은 1층, 그다음은 **바로 아래층만**, 층마다 한 번. 편성: numbers `trip_party`(동행 수, 행이 없으면 0 = 혼자). `with:[id]` 로 고르거나 안 주면 시드 난수. 동행 = 역에 있는 주민 중 위독 아님(나이 무관 — 10-22 미성년 처리 금지). `view.trip = {region, floor, floors, party}` |
| 바깥 사람 | 밤 사건 actor/target 에 **이름으로 지목된** 바깥 사람(outside)은 역 밖에서 행동·대상이 될 수 있다(any·조건식·무작위는 역의 주민만). kill 은 바깥 사람에게도 듣는다(status dead → 명부에 나온다) |
| 위독 판정 | 아침 사망 = injury 가 numbers 표 최대값이고 치료 깃발이 없고 **그날 마지막 치료 기회(actions 에 `treat` 가 있는 단계)를 떠날 때 이미 위독이던** 사람(`s.critical`). 그 뒤 — 밤 단계의 고정·시험 사건(예: d6_shutter)이나 밤 굴림 — 에 막 위독이 된 사람은 하루를 받는다(다음 날 경고 사건·치료 기회). 표에 치료 단계가 없으면 밤 굴림 직전에 찍는다 (10-22 수정: 전에는 늘 밤 굴림 직전이라 밤 단계 사건의 부상은 유예가 없었다) |
| 밤 소문 목격자 | `rumor.witness: target` 허용(대상이 역의 주민일 때) |
| 저장 | 새 칸 `fired`·`phaseSeen`·`critical`·`trip.floors`·`trip.party`·`lastFree` 는 정규화가 빈 값으로 채운다(SAVE_V 그대로 1) |

### §6-3. 약속 추가 (2026-10-24, 디렉터 피드백 U2 — plan.md P0-E1, 테스트 v4/test/meet.test.js · contract.test.js)
| 항목 | 약속 |
|---|---|
| 인물표 새 칸 | `metFlag`(id 꼴 또는 빈칸)·`startAway`(0/1). 표 검사 오류: startAway 1 인데 metFlag 빈칸 · startAway 와 outside 를 같이 씀 · you 에 metFlag · **metFlag 깃발을 세우는 사건 효과(events 선택 결과·밤 사건의 effects.flag)가 하나도 없음**(오타 = 영영 못 만난다) |
| 계획 값 (P0-D1 이 넣는다) | soonrye `met_soonrye`/0 · mari `met_mari`/0 · seoha `met_seoha`/0 · gicheol `met_gicheol`/1 · eunji `met_eunji`/1 · dongha `met_eunji`/1 · eunchae·dohyeon 빈칸/0(outside 그대로) · you 빈칸/0 |
| status `away` | 새 판: `outside` 이면 outside, 아니고 startAway 1 이면 **away**, 아니면 home. away = 아직 역에 안 온 사람: 배식·새 날 수치(perDay)·밤 사건 행위자/대상/이름 지목 목격자·무작위 대상·동행·`all` 효과·위독 판정에서 빠진다. 저장 정규화가 아는 status 에 `away` 를 더했다 |
| 도착 | 선택 결과 효과 적용 직후·밤 굴림 직후·`setFlag` 직후·새 판·저장 불러오기에서, away 이면서 metFlag 깃발이 선 사람은 **home** 이 된다. 온 날은 `people[id].arrived`(명부의 날짜 칸 `day` 는 건드리지 않는다 — 살아 남은 사람 줄에 'D1' 이 찍히지 않게). 같은 깃발을 쓰는 사람(은지·동하)은 같이 온다. 효과 적용 직후라 이어지는 사건(연쇄)이 그 사람을 본다 |
| `alive:x` | 사건 when(엔진 phaseCtx)·밤 사건 조건(worldCtx)에서 **away 도 1**(살아 있음). 아직 안 온 사람의 도착 사건 조건(`alive:gicheol` 등)을 지킨다. 행위자·대상 고르기는 따로 home 만 본다 |
| 만남 `known` | `E.known(s, db, id)` = metFlag 가 비었거나 그 깃발이 섬. `view.people[].met` = 1/0. 화면은 met 0 인 사람의 진짜 이름·그릇을 보이지 않는다 |
| 안 만난 사람 빼기 | 배식 `ration`: home **이고 known** 인 사람만 받는다(bowls 에 있어도 건너뜀 — 식량·물·굶주림·그릇 흔적 그대로) · 사건 대상 무작위(`any`·`randomSleeper`…)·`mostInjured`: home 이고 known · 원정 동행: home 이고 known · 명부 `ledger.rows`: outside·away·안 만난 사람은 줄이 없다(당신 글씨라 모르는 이름은 못 적는다). 밤 sleepers 는 home 만이라 away 는 저절로 빠진다(안 만난 home 사람 — 잠긴 역무실의 서하 — 은 밤 사건에 그대로 나온다) |
| 말 걸기 `talk` | home 또는 **away** 인 사람에게 건다(역 밖에서 마주친 사람 — 터널의 기철). outside 는 그대로 못 건다. 안 만난 home 사람(순례 첫 만남)도 건다 — `talk:soonrye` 가 pro_platform 을 연다 |
| 들은 줄 `heard` | 상태 칸 `heard = {}`. 동작 `{type:'heard', key:'<줄id>#<행번호>'}` → `heard[key] = 오늘(day)`. **행번호 = lines 표에서 그 id 의 행들 가운데 몇 번째인가(0부터, 파일에 적힌 순서 = `db.lines[id]` 의 순서)**. `E.heardKey(db, id, 행 또는 번호)` 가 열쇠를 만든다. 없는 줄·행 번호는 거절. 어느 단계에서나 되고(actions 와 무관), 결정 수에 안 든다. 화면의 '오늘 안 들은 줄 먼저' = `heard[key] !== day` |
| 저장 | `heard` 는 정규화가 빈 값 `{}` 으로 채운다(옛 저장·깨진 값). away·arrived 는 그대로 왕복. SAVE_V 그대로 1 |
| 봇 (sim) | prologue: 승강장 물건 조사 뒤 `talk soonrye` 도 시도 · 배식·말 걸기·주민 치료는 known 인 사람만 · DEADLY 정규식에 '세어진다' · 전멸 집계에서 away 는 산 사람 |

### §6-4. 약속 추가 (2026-10-24, 디렉터 피드백 U4·U5·U2 — plan.md P0-E2, 테스트 v4/test/schema.test.js · stand.test.js · sim.test.js)
| 항목 | 약속 |
|---|---|
| 물건표 새 칸 | `owner`(사람 id 또는 빈칸). 주인 = owner > id 끝 `_<사람 id>`(가장 긴 것) > 없음. 표 검사 오류: people 에 없는 사람 · id 끝이 가리키는 주인과 다름 |
| 배치 검사 (오류) | 지도마다 `objects[]` 의 칸을 본다. ① 자리가 지도 밖 ② **한 칸에 단단한(solid 1) 물건 2개 이상** ③ 단단하지 않은 물건이 한 칸에 여럿일 때 **주인이 둘 이상**이거나 **주인 없는 물건이 둘 이상** ④ **단단하지 않은 물건이 `#`(벽)·`=`(승강장 끝선) 칸**에 있음. 단단한 물건 하나 + 단단하지 않은 물건은 한 칸에 둘 수 있고, 단단한 물건은 벽 칸에 둘 수 있다(벽걸이 구급함·벽감 상자) |
| 배치 경고 `owner` | 주인 없는 물건 **하나**가 한 사람의 물건 묶음과 한 칸에 있다(예: 승강장 (19,11) `scissors` + 마리 물통·붕대). 표는 읽힌다. 그 물건에 `owner` 를 적으면(`scissors` → `"owner": "mari"`) 사라진다. 오류로 두지 않은 까닭: 계획(P0-D2)이 마리 가위를 그 칸에 두라고 했고, 데이터가 owner 를 적기 전에 게임이 멈추면 안 된다 |
| 경고 `firstDeath` | 사건의 선택지 [0](Space 를 누른 채 지나가면 골리는 자리, P0-S7)에 **금기(taboo)** 가 있거나, **당신이 죽을 수 있거나**(out·ok·fail 의 kill 이 you·self·actor·party·all·빈칸), **다른 사람이 죽을 수 있는데 뒤에 아무도 안 죽는 선택지가 있다**. 모든 선택지가 같은 사람을 죽이는 장면(d8_pillow·d10_walk 등)은 자리를 바꿔도 같아서 세지 않는다. 선택지가 하나뿐인 사건도 뺀다 |
| 경고 `reasonWord` | 사건 본문·선택지 label·warn·hint·결과 text, 대사 text, 밤 사건 text 에 `때문에`·`왜냐하면` |
| 경고 읽기 | `T.warnings(표)` = `[{table,row,id,kind,msg,text}]`, `T.load()` 결과의 `db.warnings`. 오류(`T.validate`)와 따로 — 경고는 표를 막지 않는다. `S.check(표)` = `{errors, warnings}` |
| 서는 칸 검사 (`stand.test.js`) | `v4/spots.js`(화면 P0-S3)와 maps 를 읽는다. 지도마다 `start`, 화로가 있는 지도의 `fireStand`(= fire + `spots.FIRE_STAND`), 단계별 `SPOTS` 칸이 ① 지도 안 ② 지나갈 수 있는 타일(`#`·`t`·`R`·`h`·`D`·`C` 아님) ③ 그 칸에 단단한 물건 없음 ④ **윗칸에 키 큰 단단한 물건(`spots.TALL` 이면서 solid 1) 없음** ⑤ 같은 단계의 다른 사람이 같은 칸·윗칸에 없음(start·fireStand 는 아랫칸도 본다). SPOTS 의 단계 = phases id, 사람 = 주민 id. spots.js 가 없으면 이 검사만 건너뛴다(대체 규칙) |
| 봇 아침 조사 (sim) | 물건 하나씩이 아니라 **칸 단위** — 칸을 골라 그 칸의 물건 전부를 inspect 한다(화면 P0-S6 '한 칸 전부 조사'와 같다). 조사 수(`INSPECT.objects`: 부지런 99·보통 2·게으름 1) = 칸 수. 칸에 바뀐 흔적이 하나라도 있으면 그 칸을 먼저 본다 |
| 재측정 집계 (sim) | 봇 `trace.hunger`(아침 trace 단계마다 당신 굶주림) · `trace.d3`(D3 셈 trial_d3_count·_b·_c 에서 고른 선택 label). 보고서 열 `굶주림`(판 평균)·`D3셈%`(그 사건까지 간 판)·`함께센다%`. `run.js --out=경로` 로 보고서 이름을 정한다. 날짜는 이 컴퓨터의 날짜(전에는 UTC). 고치기 전·후 비교 = `node v4/sim/before_after.js measure --root=<v4 폴더> --json=…` 두 번 + `table --before --after` (봇 코드를 고치지 않고 dispatch 를 감싸서 잰다) |

### §6-5. 약속 추가 (2026-10-24, 디렉터 피드백 U4 '걸어가서 수납을 연다' — plan.md P1-11 의 엔진 몫, 테스트 v4/test/holds.test.js)
지금 표에는 holds·`inspect:` 원정 사건이 없어서 게임은 그대로다(같은 표로 봇 540판의 결과 해시가 고치기 전과 같다). 데이터가 원정 지도 m칸을 수납 물건으로 바꾸고 화면이 원정 지도를 걷게 하면 그때 쓰인다.
| 항목 | 약속 |
|---|---|
| 물건표 새 칸 `holds` | `{ "text": "건빵 두 봉지가 있었다.", "effects": [{"verb":"number","id":"food","n":2}], "state": "open" }` — 셋 다 선택. effects 는 사건 결과와 같은 두 꼴(배열이면 로더가 객체 꼴로). 빈 `{}` 는 없는 것. 표 검사 오류: states 가 둘 미만 · holds 에 text·effects·state 밖의 키 · state 가 states 밖이거나 연 뒤 상태가 첫 상태와 같음 · effects 의 모르는 수치·동사 · **effects 에 kill·permanent**(여는 것만으로 죽거나 몸을 잃지 않는다 — 위험은 선택지가 있는 사건으로) |
| 연 뒤 상태 | `holds.state` > `'open'`(states 에 있고 첫 상태가 아니면) > `states[1]`. `E.openStateOf(물건 행)` |
| 열기 흐름 | `inspect` 한 번 = ① 그 조사에 걸린 사건(원정 아닌 사건, when 에 `inspect:x`) → ② 원정 중이면 `inspect:x` 가 걸린 원정 사건 → ③ 둘 다 없고, 물건에 holds 가 있고, 지금 상태가 첫 상태(닫힘)이고, **사건이 쥐고 있지 않으면** 연다: effects 적용 → 연 뒤 상태(`by:'you'`, 본 것 seen) → 만남 깃발 도착 처리. 조사 전에 이미 걸린 사건이 있었으면 ②③ 은 없다. 연 것은 열린 채 남는다(resetOn never) |
| 사건이 쥔 물건 | when 에 `inspect:<그 물건>` 이 나오는 사건(어느 kind 든) 가운데 **지금 조건이 맞는 것**이 있으면 — 이미 고른 사건(done·phaseSeen·같은 원정의 trip.done)도 센다 — holds 를 열지 않는다. 위험한 수납 사건('비틀어 연다 / 둔다')을 거절한 뒤 다시 조사해 내용을 위험 없이 꺼내지 못하게 한다(10-21 '생존은 위험 대 보상'). 사건 조건이 더는 안 맞으면(날이 지났다·깃발이 섰다) holds 가 기본 흐름이 된다. 위험한 수납은 내용을 **사건 결과**에 두고 holds 는 비워 두면 된다 |
| 결과 `s.found` · `view.found` | 방금 연 수납 `{ object, state, day, text, lines }` 또는 null. lines = 바뀐 수치 `[{kind:'number', id, who, from, to}]`(lastResult.lines 와 같은 꼴) — 화면의 열기 3박자·찾은 물건 아이콘(ART.iconSrc(id))·패널 숫자 깜빡임이 읽는다. 다음 `inspect`·`next` 가 지운다. 저장 정규화: 없는 물건을 가리키거나 꼴이 깨지면 null(SAVE_V 그대로 1) |
| 닫힌 수납 묻기 | `E.closedHolds(s, db, 물건 id)` = holds 가 있고 지금 첫 상태. 화면 안내줄 'Space 열기 — <이름>' 에 쓸 수 있다 |
| 원정 사건 두 갈래 | **도착 사건** = when 에 `inspect:` 가 없는 원정 사건: 지금처럼 `trip` 동작(층에 들어설 때) 시드 난수로 하나. **조사 사건** = when 에 `inspect:` 가 나오는 원정 사건(`|` 로 섞여 있어도): 도착 때 걸지 않고, 원정 중 그 물건을 조사할 때 표 순서로 첫 맞는 것을 건다. 같은 원정에서 같은 사건은 한 번(trip.done), once 사건은 한 판에 한 번, target 열이 있으면 걸 때 정한다. `E.inspectGated(사건 행)` |
| `trip` 의 `walk` | `{type:'trip', region, floor, walk:true}` → 그 층에 들어섰으면 **도착 사건이 없어도 ok:true**(원정 지도를 걸어서 뒤지는 화면·봇용). walk 가 없으면 지금처럼 도착 사건이 걸렸을 때만 true(옛 화면은 false 를 '아무것도 없었다'로 읽는다). 어느 쪽이든 층에 들어서면 `s.trip` 은 바뀐다 |
| 엔진이 안 하는 것 | 원정 중 당신 자리(`s.pos`)는 바꾸지 않는다(화면이 지금 원정 지도를 보여 줘도 엔진의 map 은 역 그대로 — `map==station` 조건이 원정 뒤에도 그대로 맞게). 원정 지도의 물건은 화면이 그 지도에서만 조사하게 한다 |
| 봇 (sim) | 원정 동작에 `walk:true`. 층에 들어선 뒤 도착 사건을 고르고 `tripSearch`: 그 층 지도(`TRIP_MAPS` A → mall_a1·mall_a2, B → drain_b1·drain_b2 — 화면 game.js 의 TRIP_MAPS 와 같아야 하고 holds.test 가 맞춰 본다)의 물건 가운데 **닫힌 수납 또는 조사 원정 사건이 가리키는 물건**을 지도에 적힌 순서대로 조사한다. 집계 `trace.searched` = 원정에서 조사한 물건 수. 그런 물건이 없는 표(지금)에서는 아무것도 하지 않는다 |
| 경고 `holdsRefill` | holds 가 있는 물건의 resetOn 이 morning·inspect — 연 수납이 닫힌 상태로 돌아가 다시 찬다(위험 없이 매일 얻는 샘). 한 번 연 것을 열린 채 두려면 never. 이유 낱말 경고(`reasonWord`)는 holds.text 도 본다 |
| **(10-25 최종판) 사건이 쥔 물건 — 손질** | '지금 조건이 맞는 inspect: 사건' 가운데 **걸 수 없는 것은 쥐지 않는다**: ① 원정 사건(kind trip)인데 원정 중이 아니다(역에서 조사) ② 아직 안 고른 사건(done·phaseSeen·이번 원정 trip.done 에 없음)인데 target 열(targetOptional 아님)의 대상을 지금 못 정한다(`eventTarget(…, dry)` — 난수를 쓰지 않고 본다). 전에는 이때 사건도 안 걸리고 수납도 안 열려 조사가 아무 일 없이 끝났다. 이미 고른 사건은 대상이 사라져도 쥔다(거절한 뒤 위험 없이 새지 않게) |
| (10-25) 층을 옮기면 `found` 를 지운다 | `trip` 이 새 층에 들어서면(1층 시작·아래층) `s.found = null` — 윗층에서 연 수납의 '찾음'이 새 층에서 다시 뜨지 않게. 지우는 때 = 다음 `inspect` · `next` · `trip` |
| (10-25) 저장 정규화 — 흔적 | 표가 바뀐 뒤의 옛 저장: `traces` 에서 표에 없는 물건은 버리고, 지금 states 에 없는 상태(예: 원정 물건이 'normal' 하나에서 닫힘/열림 수납으로 바뀜)는 첫 상태 `{st: states[0], day: 0, by: null, seen: false, late: 0}` 로. 그대로 두면 닫힌 수납으로 안 보여 영영 못 연다. 바른 흔적은 그대로(SAVE_V 그대로 1) |
| (10-25) 집계 `s.stats.holds` | 수납(holds)을 연 횟수(새 판 0 · 옛 저장 0). 봇 통계 `measure.holdsOpened` · `searched`(trace.searched) · `tripGated`(s.fired 중 inspect: 원정 사건) → run.js '원정 수납 (P1-11)' 표 |
| (10-25) 경고 `unknownRef` · `unplaced` | **unknownRef**: 사건 when · 선택지 req.cond · swap.when · 단계 skipIf 의 `inspect:`/`trace:` 가 물건표에 없는 물건, `talk:`/`alive:` 가 인물표에 없는 사람, `trace:물건==값`(`!=`)의 값이 그 물건 states 에 없다 — 그 조건은 늘 같은 값이라 사건이 영영 안 걸리거나 늘 걸린다(이름 오타 하나로 원정 수납 사건이 조용히 사라진다). **unplaced**: 수납(holds, 빈 `{}` 뺌)이 있는 물건 또는 조사로 걸리는 원정 사건(kind trip · when 에 inspect:)이 가리키는 물건이 어느 지도(maps[].objects)에도 없다. 둘 다 경고(표는 읽힌다) — 실제 표에 0 인지는 holds.test.js 가 막는다 |

### §6-6. 약속 추가 (2026-10-24, 디렉터 결정 A1·A2·A4 엔진 몫 — 명세 spec_karma_death_neglect §6·§7 + 명세 검토 지적, 테스트 v4/test/karma.test.js)
엔진 칸을 데이터보다 **먼저** 열었다(검토 지적 13): 아래 칸은 지금 표에 없어도 되고, 넣으면 표 검사가 받는다. 지금 표로 봇 판 결과는 고치기 전과 같다(엔진만 바꾼 상태에서 5정책 × 40판 결과 해시 같음 — 봇 동점 규칙은 따로, 아래 '봇').
| 항목 | 약속 |
|---|---|
| 밤 사건 새 칸 `missed`·`caught` (E1) | `{ effects, trace }` — effects 는 두 꼴(배열이면 로더가 객체 꼴로), trace 는 `{물건: 상태}`(`_actor`·`_target` 자리표시 허용). 표 검사는 밤 사건 effects·trace 와 같다. 그 밖의 키·세계 시계(role clock) 행에 쓰면 오류. 빈 칸은 없는 것 |
| 방치 판정 (E2) | 밤 굴림 **첫머리**(`rollNight` → `applyNeglect`). 전날 밤(day == 오늘−1) 주민 사건 가운데 아직 판정 안 한 줄: 발견(`discovered`)이면 `caught`, 아니면 `missed` 를 **그 줄의 행위자·대상 그대로** 적용. 행위자나 대상이 역(home)에 없으면 건너뜀. 판정한 줄은 `judged:true`, 결과는 nightLog 에 `{id:'<id>~missed'·'~caught', role:'neglect', discovered:true}`, missed 를 적용하면 `s.stats.neglect++`. 더 오래된 줄은 판정 없이 judged. 판정 줄·세계 시계는 발견 집계(`discovery`)·봇 통계의 밤 사건 수에서 빠진다(`N.isResidentRow(e)` = 주민 사건 줄) |
| 누구나 아는 밤 `public` | 0/1. 1 이거나 effects 에 `kill` 이 있는 행은 굴릴 때 바로 발견(discovered:true) |
| 곁가지 행 `side` | 0/1. 1 = 한 밤 상한(max_per_night)·'행위자·대상 한 번' 규칙 밖에서 따로 굴린다: 주민 사건 뒤, 행마다 맞는 (행위자, 대상) 가운데 하나를 `weight/10` 확률로 한 번. 신호용 흔적 행(cold_bowl 등)이 원한 습격·밀고의 자리를 뺏지 않게(검토 지적 20). 세계 시계 행에는 못 쓴다 |
| 흔적 `late` (E3) | missed 의 trace 가 바꾼 흔적은 `late:1`(다른 흔적·저장 정규화는 0). `view.traces[].late`. 조사 글 줄 = `E.inspectLineId(s, db, 물건)` — `inspectLine[상태]` 의 `<줄id>_late` 가 대사표에 있으면 그것. 그날 아침 late 흔적(어제 밤 굴림에서 생긴 것)이 있으면 **그날 첫 조사** 때 `s.notice = 'toast_late'`(대사표에 그 줄이 있을 때만, 하루 한 번) → `view.notice`. 다음 조사·next 가 지운다 · **(10-24 검증 A4-4)** 같은 밤 방치 판정 뒤의 주민 사건·세계 시계가 그 물건을 다시 바꿔도(setTrace 는 late 0 으로 쓴다) `rollNight` 끝에서 late 를 되살린다 — '커져서 돌아온' 그 밤에 먼지·글·토스트가 사라지지 않게(`applyNeglect` 는 late 로 바꾼 물건 id 목록을 돌려준다) · **(A4-6)** '지금 늦은 흔적' = `E.lateNow(s, t)` = late 이고 **어젯밤 것**(day == 오늘−1). 조사 글(`inspectLineId`)·토스트·`view.traces[].late` 가 같은 규칙 — 며칠 지난 late 흔적에 '이틀째·어제부터' 글이 나오지 않는다(화면 먼지 game.js `lateOf` 는 같은 규칙 + 아직 안 봄) |
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
| 봇 (sim) | 정책 20: 성향 봇 8(balanced·selfish·devoted·silent·caller·steward + **counter** 몫−손+이름+ · **child** 몫−손−이름+, 10-23 승인) · 조사 2(lazy·diligent) · risky · 이기적 변형 3(**selfish_nb** bodyAverse 없음 · **selfish_rt** 남을 내미는 금기 +3 · **selfish_rt0** 같은데 몸 꺼림 없음) · 사람 흉내 6(**h_random·h_wary·h_first·h_cautious·h_cautious2·h_mixed** — A3 분석 runs.js 를 정식으로, 고르는 법만 다르고 배식·조사·원정은 균형과 같다. h_first 는 극단 모형이라 합격선 묶음에서 뺀다). selfish 에 **bodyAverse 3**(경고 글 '다친다·잃는다·상한다' −3, 명세 §6-2). **동점 규칙(A3)**: 가장 높은 선택이 경고 선택이면 경고 붙은 다른 선택 가운데 0.2점 안쪽도 동점 → 시드 난수. 묶음 `B.GROUPS = {personality, human, selfish}` · **(10-24 검증)** 조심형에서 몸 꺼림 정책을 뺌 · 묶음 `selfishPlain`(selfish_nb·selfish_rt0) · `selfishQuirk`(selfish·selfish_rt) · `a4`(balanced·lazy·diligent) · 성향 가점 상한(`axisCapped`) · 아침 조사 = 화면에서 닿는 물건만(`screenReach`) · 게으름 명부는 보통처럼 반반 · `OPT.allObjects`·`OPT.lazyBlank` = 옛 규칙 |
| 통계 (sim) | 밤 사건·malice·hymn·찬가 발견 = 주민 사건 줄만(방치 판정 줄 뺌, 검토 지적 16) · 새 값: 죽은 날 · D1~D4 생존 · D5까지 사망 · 산 날 · 카르마(끝) · 못 본 일(stats.neglect) · 방치 줄 수 · D9 아침 주민 수(home9) · D7 아침 식량+물+약(res7) · 사인 1위 · **원인 사건**(깔때기 사건 — when 이 당신 부상을 보는 사건과 새벽 위독 — 으로 죽었으면 그 자리까지 다치게 한 출처, 죽을 때 부상만큼 거슬러 가장 많이 다치게 한 것) · 날별 사망표(그날 사건/깔때기) · 위기 때 값 길이 열린 비율 · **(10-24 검증)** 프롤로그(D0) 사망 `prologue` · 정체 분포 `identityNP`(프롤로그 사망 판 뺌)·`prologueDeaths` · A2 날마다 줄 = 조심형 합산 · A1 줄 = 버릇 없는 이기적, 사인 쏠림은 사망률 ≥ `SIGN_MIN_RATE`(10%) 정책만 · 몸 꺼림·옛 방식 값은 참고 줄 |
| run.js | 기본 5블록(1·1001·2001·3001·**8001**, 10-25) · 정책 이름에 밑줄 · `--workers=N`(정책을 나눠 동시에, 기본 = CPU−1, 결과 같음) · 보고서에 날별 사망표 · A1·A2·A4 지표 표 · 원인 사건 · 정체 묶음 평균 표 · 합격선 표의 '합산' 열(참고) · (10-26 고침) `--compare` 비교 열 = 옛 보고서의 '합산' 열, 없으면 블록 값 전부(' ; ', 길면 첫 블록) + 그 보고서 판정 [✓/△/✗], 10-24 에 이름만 바뀐 줄은 옛 이름으로 찾는다 · **(10-24 검증 A4-5)** `--a4blocks=N`(기본 9, 10-25): A4 정책(balanced·lazy·diligent)만 **첫 블록 + 1000씩 올라가며 아직 안 쓴 시작값**을 더 돌고(10-25 바꿈 — 전에는 마지막 블록 + 1000씩. 기본이면 4001~7001 → A4 9블록 = 1~8001. `--blocks`·`--seed0` 를 이어진 값으로 주면 전과 같다), 합격선 표의 A4 줄은 그 블록 전부로 판정('판정 (블록 N개)', 합산 열 = 그 블록 전부) + 'A4 (블록 N개)' 표. 정책별 표·블록별 표는 기본 블록만 · `--all-objects`·`--lazy-blank` · **(10-25)** 보고서에 '원정 수납 (P1-11)' 표(정책별 판 평균: 원정 · 원정 조사 물건 · 연 수납 · 조사로 걸린 원정 사건) |

### §6-7. 약속 추가 (2026-10-24, 줄타기 — 카르마 판의 출구 · 게으름 측정 · 이른 날 합격선, 엔진 몫. 설계 meeting_2026-10-24/tightrope/design.md §1-5 R0~R4 · §1-6 · §1-7 · §2-3 · §3, 테스트 v4/test/rope.test.js)
엔진 칸을 데이터보다 **먼저** 열었다: 아래 칸은 지금 표에 없어도 되고(지금 표로 봇 판 결과는 고치기 전과 같다 — 10정책 × 40판 해시 같음), 넣으면 표 검사가 받는다. 확인: `tightrope/engine_r0_check.js same` — 설계안을 rope 칸으로 넣은 표가 메모리 시험(patches.js 의 swap 펼침)과 **20정책 × 80판 판 결과가 같다**(`engine_r0_same.txt`). 숫자는 전부 [제안].
| 항목 | 약속 |
|---|---|
| 선택지 **`rope`** 칸 (R0) | `{ kind, from, blind, skill, fail }` — **기본 선택지에만**(swap 변형에 쓰면 오류). `effChoice` 가 swap 을 고른 **뒤** 그 모습 위에 얹는다(귀·손가락·다리를 잃는 변형은 그대로 + 판정). kind = `pay`(갚는다, talk) · `endure`(버틴다, str) · `point`(가리킨다, talk) · `fight`(싸운다 — 원래 판정이 있어야 한다, 없으면 오류). `from` = 카르마 문턱(정수, 없으면 0 — 예 starve_you 의 창고·남의 그릇은 8 = K2 부터). `skill` = 판정 기술(없으면 kind 기본). 화면·봇·강제 판정·noExit 가 모두 줄타기 모습을 본다. 화면 `eventView` 에는 %·경고만 나가고 줄타기 표시·카르마 숫자는 안 나간다 |
| 구간 · 판정 % | 구간 = 그 순간의 `karma`: K1 ≥ `rope_k1`(5) · K2 ≥ `rope_k2`(8) · K3 ≥ `rope_k3`(12) · K4 ≥ `rope_k4`(16). 구간 0 이거나 karma < from 이면(눈먼 새벽도 아니면) 그대로. base: pay·endure·point = `rope_<kind>_<구간>`(판정이던 모습이면 min(원래, 표)) · fight = 원래 base − `rope_fight_<구간>`. 어느 쪽이든 `rope_floor`(30) 아래로 안 간다. 화면 % = base + 기술 × 5 (기술은 0 밑으로 안 내려간다 = 바닥). 기본값(설계 §1-2): pay 92·90·85·78 · endure 88·85·78·70 · point 82·70·55·40 · fight 0·0·5·10 · 눈먼 새벽 pay 85·endure 75·point 65 |
| 결과 | 판정 없던 모습: 성공 = 원래 out(**비용은 그대로 먼저 낸다**), 실패 = 당신 죽음(`fail.how`, 기본 dead) + `fail.text`(없으면 엔진 기본 글 — 경고 `ropeFail`) + `fail.effects`·`fail.image`·`fail.ledger`. 판정이던 모습: 실패가 당신을 안 죽였으면(창고를 턴다 = 부상) 원래 실패 효과 + 죽음, 글은 `fail.text`(없으면 원래 글). 원래 실패가 당신을 죽이면 그대로. 결과가 이미 당신을 죽이는 모습(대답한다 등 확정 죽음)에는 얹지 않는다 |
| 경고 꼬리 | 경고 = 원래 경고 + `. ` + 꼬리 — 대사표 **`rope_tail_pay`·`rope_tail_endure`·`rope_tail_point`** 줄(없으면 기본 '안 받으면 끝이다'·'못 버티면 끝이다'·'아무도 안 돌아서면 끝이다'). 꼬리에 '끝이다'가 꼭 든다 — 화면을 읽는 사람과 봇(DEADLY)이 같은 뜻으로 읽는다. 원래 경고에 이미 '끝이다'가 있으면 그대로. fight 는 원래 경고 |
| 눈먼 새벽 `rope.blind` | 1(깃발 `strike_blind`) 또는 깃발 id. 그 깃발이 서 있으면 **카르마와 상관없이** `rope_blind_<kind>`, 카르마 구간과 겹치면 낮은 쪽. pay·endure·point 만(fight 에 쓰면 오류). 깃발을 세우고(grudge_boils) 지우는(dawn_strike 결과) 것은 표 몫 |
| 손잡이 numbers **`rope_*` (24행)** | `rope_k1..4` · `rope_pay_1..4` · `rope_endure_1..4` · `rope_point_1..4` · `rope_fight_1..4`(깎는 값) · `rope_floor` · `rope_blind_pay/endure/point`. **owner world · visible never**(아니면 오류 — 화면에 카르마 쪽 숫자를 보이지 않는다). 판정 % 행은 0~100. 행이 없으면 기본값(schema `ROPE_DEFAULTS`). 표 한 곳에서 손잡이를 돌린다 |
| **강제 = 확정 사망** (R1) | `choose()` 의 forced = **열린 선택지 전부 살 확률 0**(살 확률 = `E.survival(선택지, 화면 %)`). warned(실질 경고)·free 도 이 정의. `lastResult.alts[].p`·`lastResult.p`(고른 것) · `lastResult.noSafe` / `ended.cause.noSafe` = 옛 정의(당신이 죽지 않는 열린 선택지 0개, 측정용) |
| `noExit` (R1 바꿈) | 당신을 죽일 수 있는 선택(swap 변형·줄타기 모습 포함)이 있는 사건에 **비용·req·대상 없고 살 확률 > 0 인**(판정이면 성공·실패 한쪽은 안 죽인다, 변형·줄타기 모습까지) 선택지가 없다 — 경고. 죽는 주사위도 살 길이 있으면 출구다(전에는 경고였다) |
| `firstDeath` (R2) | 1번 자리의 **줄타기 판정은 '당신이 죽을 수 있다'에서 뺀다** — rope 칸 모습(변형 목록에 안 든다) · 줄타기처럼 쓴 swap 변형(when 에 `karma`·`flag:strike_blind` 가 든, 살 길 있는 판정 — `ropeLikeSwap`). 금기·확정 죽음·다른 조건의 죽는 판정은 그대로 경고. 줄타기 구간에서 1번 = 갚는다(가장 높은 %) |
| 바닥 **`ropeFloor`** (R3, **오류**) | 당신을 죽이는 판정(변형 포함)의 base < `rope_floor`(없으면 30) · pay·endure·point 의 구간·눈먼 새벽 손잡이 % < 바닥(그 numbers 행, 손잡이 행이 없으면 바닥 행에 오류) · `rope_k` 가 오름차순이 아님. 지금 표 최저 35 |
| 집계 (R4) | `s.stats.ropeRolls`·`ropeClose`(줄타기 판정을 굴림·넘김) · `ropeFeltRolls`·`ropeFelt`(그중 화면 % ≤ `ROPE_FELT_MAX` 85 인 판정 — 느껴지는 아슬함, 10-24 tightrope 검증 · 10-25 부터 A1 아슬함 합격선) · `deathRolls`·`closeCalls`(실패가 당신을 죽이는 모든 판정을 굴림·넘김) · `blindMet`(눈먼 새벽 깃발이 선 사건에서 고름) · **`holds`**(연 수납 수 — P1-11, 10-25). `lastResult.roped` = `{kind, band, blind, base}` 또는 null · `lastResult.blind` · `ended.cause.roped·blind·noSafe`. `choiceMeta[].roped`(봇 점수는 안 본다). 저장: 옛 저장은 정규화가 0 으로 채운다(SAVE_V 그대로 1) |
| 경고 `ropeFail` | 판정 없던 모습에 pay·endure·point 줄타기를 얹는데 `rope.fail.text` 가 없다 — 사건마다 새 실패 글(40자 1문장 ≤ 2개)을 쓴다. 이유 낱말 검사(`reasonWord`)는 `rope.fail.text` 도 본다 |
| 봇 (sim, §1-6) | 사람 흉내 cautious·cautious2·mixed·wary: 모든 선택이 죽음 글일 때 **판정 없는 죽음 글(대답한다)은 성공 0%**(`bots.humanChance`) — 전에는 100% 로 봐서 '올라간다'를 90% 판정보다 먼저 골랐다. 묶음 `GROUPS.rope = ['selfish_nb']`(아슬함 합격선) |
| 통계 (sim, §1-7·§2-3) | `measure`: ropeRolls·ropeClose·ropeFeltRolls·ropeFelt·deathRolls·closeCalls·blindMet · ropeDeath·blindDeath·noSafe · **privTotal·privFound**(누구나 아는 밤 — public:1·kill 효과 행 — 을 뺀 주민 사건 수·발견) · pubTotal · **(10-25 P1-11) searched**(봇 trace.searched — 원정에서 조사한 물건)·**holdsOpened**(s.stats.holds)·**tripGated**(s.fired 중 inspect: 원정 사건을 고른 횟수). `aggregate`: survN(열흘 산 판) · ropeCloseSurv·ropeClose2(산 판 중 ≥ 2번 %)·**ropeFeltSurv·ropeFelt2**(같은 값, 화면 ≤ 85% 줄타기만)·**ropeFeltShare**(산 판 줄타기 넘김 중 그 몫 %, 넘김 0 이면 null)·closeCallsSurv(산 판만 — 산 판이 없으면 null) · ropeFelt·ropeFeltRolls(판 평균) · ropeRolls·deathRolls·closeCalls·blindMet(판 평균) · ropeDeaths·blindDeaths·noSafeDeaths · **discReal**(실제 발견율 = Σ 숨은 밤 발견 / Σ 숨은 밤, 옛 discovery 는 그대로) · pubNights·privNights · searched·holdsOpened·tripGated(판 평균, 10-25) |
| 합격선 줄 | '강제 사망 = 확정 사망 (…전 정책 합산)' 0 판 · 참고 '위험 0 출구가 없던 죽음' · **'A2 D2·D4·D5 날마다'** > 0 + 측정 'A2 D3·D6' · **'A1 아슬함'** 둘(selfish_nb, **화면 ≤ 85% 줄타기만** ≥ 2 · ≥ 60% — 10-25 최종판, 옛 측정 줄 '느껴지는 아슬함'이 판정 줄이 됐다) + 참고 '줄타기 판정 전부(…옛 A1 아슬함)' 하나 + 측정 죽음 판정 넘김·줄타기 굴림/사망 · **'A4 측정:'** 셋(실제 발견율 · 누구나 아는 밤/숨은 밤 · 눈먼 새벽/그 죽음, run.js 가 A4 블록 전부로 잰다). 이름이 바뀐 줄은 run.js `--compare` 가 옛 이름으로 찾는다 |
| run.js | 보고서에 **'줄타기·발견 지표'** 표(정책별 확정 사망 · 옛 강제 · 경고 없는 사망 · 줄타기 굴림/넘김(산 판)/≥2번% · 느껴지는 줄타기(≤ 85%) 넘김(산 판)·넘김 중 비중·≥2번% · 죽음 판정 넘김(산 판) · 줄타기 사망 · 눈먼 새벽 · 실제 발견%·옛 발견% · 누구나 아는 밤/숨은 밤) |
| 데이터 담당이 넣을 것 | 설계 §1-3 의 30 선택지에 rope 칸(kind · starve_you 둘은 from 8 · dawn_strike [0][1][5] 는 blind 1) + 실패 글(지금 R0 표로 ropeFail 21건) · 꼬리 줄 3(`rope_tail_*`, 없으면 기본 글) · numbers 24행(없으면 기본값 = 설계 시험값) · §2-2 nightEvents 5행 · dawn_strike 모든 결과 `strike_blind 0` |
