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
| 당신 사망(올라감 포함) | **≥ 50%**, 상한 없음 | 보통 | R2 보정. 같이 검사: 사망 원인 사건의 선택지에 hint/warn 100% — "운이 아니라 결정" |
| 전멸 · 사망 중 전투 원인 | **≤ 25%** [제안] · ≤ 50% | 보통 | 사망 ≥50%와 양립하려면 "당신은 죽어도 명부는 남는다"가 대부분이어야 |
| 밤 사건 수 | ≥ 6 / 판 (malice ≥ 2, hymn ≥ 1) | 전 정책 | 쟁점 5 |
| 발견율(흔적·소문 중 하나라도) | 보통 50~70%, 게으름 ≥ 40%, 부지런은 상한 보고 | 보통 기준 | 쟁점 5 |
| 끝까지 모르는 사건 · 찬가 발견율 | ≥ 1 / 판 · 부지런 ≥ 70%, 게으름 ≥ 60% | 게으름 · 둘 | 쟁점 5 · 7 |
| 정체 분포 | 각 후보 ≥ **(100 / 후보 수) / 2 %** (4 → 12.5%, 5 → 10%, 7 → 7.1%) | 정체 정책 합산 | R4 보류 조건. fallback 후보 > 50%면 경고 |
| 하루 결정 수 · 같은 카드 반복 | ≥ 5 · ≤ 20% / 판 | 보통 | 쟁점 6 · 11_design_v2 |
| 적나라 장면 노출 | explicit=1 사건 ≥ 7 / 판 | 보통 | R3 매일 하나꼴 |
| 결정성·저장 왕복 | 100% | 전 정책 | 기존 테스트 유지 |
기준값은 `sim/baseline.json`에 저장, ±10% 밖이면 경고. 보고서 1장(이 표에 실측 열 추가)이 작업 6의 결과물.

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
| 밤 사건 대상 키워드 | `bond` · `any`/`randomSleeper`/`nearestSleeper`/`farthestSleeper`(자리 정보가 없어 전부 무작위) · `mostInjured` · 사람 id · 조건식 |
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
| 사건 `target` 열 (새, 선택) | 사람 id 또는 `any`·`randomSleeper`·`nearestSleeper`·`farthestSleeper`(무작위)·`mostInjured`·`bond`. 사건이 걸릴 때 정하고(못 정하면 그 사건은 안 걸린다) 결과의 `who:'target'`·명부 줄이 같은 사람을 가리킨다. **무작위 대상은 역에 있는 성인 주민만**(미성년 = people.age < 19, 디렉터 결정). 결과의 `target` 열이 있으면 그것이 먼저. `eventView` 에 `target`·`targetName` |
| 결말 열 (새, kind ending 전용) | `board: 1` = 이 결말이 걸려 있는 동안 `board` 동작이 열린다(단계 actions 에 없어도), 결말에서 `board_<id>` 깃발 주민은 `boarded`. `endStatus: walked` = 결말 뒤 역에 남은 산 사람(당신 포함)의 status. 없으면 그대로(명부 '남았다'). 다른 kind 에 쓰면 표 검사 오류 |
| 명부 status `walked` | '걸어 나갔다'. ledger rows·format·저장 정규화가 안다 |
| 결과의 명부 줄 `ledger` | `{who, status, day, cause, text}` 또는 그 **목록**, 또는 글 한 줄(당신의 사실 줄). `status` boarded/stayed/walked → 아직 역에 있는 그 사람의 status 를 바꾼다(dead/ascended 는 kill 효과가 정하고 여기선 기록만). `day` "{day}"·정수. `cause` 글 → 사인 칸, `"물건:상태"` → 그 물건의 ledgerFact 줄. `text` 가 있을 때만 사실 줄(written)에 쌓는다 — text 없는 행은 더 이상 쌓이지 않는다. 표 검사: status 값·`물건:상태` 참조·who |
| 결말 사인 `ended.cause` | 당신이 죽었거나 올라갔거나(결말 사건 안 포함) 떠났으면 `{event, choice, warned, image, night}`. 밤 사건이 당신을 데려가면 `event` = 그 밤 사건 id, `choice: null`, `warned: false`, `night: true` |
| 읽는 사람 `ended.readerId` | `'you'`·`'conductor'`·주민 id·`null`. 주민 = 살아 있는 주민 중 people.age 가 가장 많은 사람(역에 남은 사람 먼저, 없으면 탄 사람). `E.readerId(s, db)` 로도 |
| 사건 연쇄 | `choose` 뒤 끝나지 않았으면 같은 단계의 사건을 다시 찾는다. 이미 끝난 once 사건과 **이번 단계에 이미 고른 사건**(`s.phaseSeen`)은 빠진다 — `once:0`(되풀이) 사건도 한 단계에 한 번. `move` 도 사건을 깨운다(지도 조건 `map==x`) |
| 집계 `s.fired` | 고른 사건 id → 횟수. once:0 사건도 센다(explicit/판은 이것으로) |
| 소문 발견 | 들은 소문은 **참(truth 1)일 때만** 발견이다 |
| 배식 흔적 | 받은 그릇 `full`, 못 받은 그릇(0 이거나 식량·물 부족) `empty`. 둘 다 당신이 한 일이라 본 것(seen)·`by:'you'`. 밤에 빈 그릇이 차면 아침에 구별된다 |
| 몸 신호 `view.people[].signs` | `{sleepless, starving, ateFlesh}`(역에 없는 사람 null). 문턱은 밤 사건표 actor 조건식: role `fear`·`ascend` 행 → sleepless(당신 제외), role `steal`·`starve` 행 → starving(`any`·이름 지목 행 제외). ateFlesh = 깃발 `ate_flesh_<id>` 또는 `<id>_ate…`. `E.signs(s, db)` 로도 |
| 원정 `trip` | 낮 단계에 한 번(지역 하나). 첫 동작은 1층, 그다음은 **바로 아래층만**, 층마다 한 번. 편성: numbers `trip_party`(동행 수, 행이 없으면 0 = 혼자). `with:[id]` 로 고르거나 안 주면 시드 난수. 동행 = 역에 있는 주민 중 위독 아님·미성년 아님. `view.trip = {region, floor, floors, party}` |
| 바깥 사람 | 밤 사건 actor/target 에 **이름으로 지목된** 바깥 사람(outside)은 역 밖에서 행동·대상이 될 수 있다(any·조건식·무작위는 역의 주민만). kill 은 바깥 사람에게도 듣는다(status dead → 명부에 나온다) |
| 위독 판정 | 아침 사망 = injury 가 numbers 표 최대값이고 치료 깃발이 없고 **밤 굴림 직전에 이미 위독이던** 사람(`s.critical`). 밤 사건으로 막 위독이 된 사람은 하루를 받는다(그날 경고 사건·치료 기회) |
| 밤 소문 목격자 | `rumor.witness: target` 허용(대상이 역의 주민일 때) |
| 저장 | 새 칸 `fired`·`phaseSeen`·`critical`·`trip.floors`·`trip.party` 는 정규화가 빈 값으로 채운다(SAVE_V 그대로 1) |
