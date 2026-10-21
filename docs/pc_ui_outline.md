# 어두운 역 — PC 화면·조작·메뉴 개요 (2026-10-21)

"보통 게임에 있어야 하는 것"을 먼저 배우고, 그 위에 우리 게임을 얹는다. 자료는 젤다 야생의 숨결 UI 분석, 마더/드래곤 퀘스트 계열 메뉴, RPG Maker의 기본 조작, 닌텐도의 가르치는 방식(기승전결), 게임 느낌(게임 필) 연구를 봤다. 출처는 맨 끝.

---

## 1. 배운 것 — 좋은 게임이 공통으로 가진 것

### 1-1. 화면에 보이는 것(HUD)은 적을수록 좋다
- 야생의 숨결 팀의 원칙은 **"꼭 필요한 것만"**. 정보를 합쳐서 눈이 갈 곳을 줄였고, 설정에 '프로 HUD'(미니맵·온도계를 아예 지우고 하트만)까지 뒀다.
- 세계 안의 단서(풀 소리, 적 소리)가 HUD를 대신한다. 상황에 맞는 조작 안내는 **필요할 때만** 뜬다.
- 추적하는 목표는 **한 번에 하나**. 지도는 가 본 곳만 보여 준다.
- → 우리: 오른쪽 패널에 숫자는 **식량·물·땔감 셋**, 목표 한 줄. 침수·시선·스트레스는 그림(물·안개·얼굴). 이미 정한 방향이 맞다.

### 1-2. 메뉴는 얕고, 첫 항목이 '계속'이다
- 메뉴 나무는 **3단계를 넘지 않는다.** 깊으면 플레이어가 길을 잃는다.
- 일시정지(Esc) 메뉴는 빠르고 작게: **계속(기본 선택) · 설정 · 저장/불러오기 · 타이틀로.** 뒤로 가는 길이 모든 화면에 보인다. 배경은 어둡게, 소리는 멈춘다 — "정말 멈췄다"를 믿게.
- 자주 쓰는 것은 메뉴 밖에 둔다(젤다 시간의 오카리나의 '아이언 부츠' 교훈: 자주 바꾸는 물건을 메뉴 깊이 두면 지옥).
- 마더 2의 교훈: 눈앞의 것에 대고 버튼 하나면 **당연한 행동**(말 걸기·조사)이 바로 된다 — 메뉴를 열지 않고.
- 일지(저널)는 서사 장치이자 메뉴다(레드 데드 리뎀션 2). 우리 **수첩**이 정확히 이것.
- → 우리: Esc = 일시정지(계속·설정·저장·타이틀). **Tab = 수첩**(명부·규칙·약속·일지가 탭). 지금의 '메뉴 6타일(사람들·시선·일지·소리·처음부터·닫기)'은 일시정지와 수첩이 섞여 있어 이상했다 — 둘로 가른다.

### 1-3. 조작은 관습대로, 바꿀 수 있게
- RPG Maker 기본: **화살표 이동, Z/Enter/Space 결정, X/Esc 취소·메뉴, Shift 달리기**. 많은 게임이 WASD를 덧붙인다. F1로 키 바꾸기.
- Esc가 '취소'와 '메뉴'를 겸하는 것이 관습.
- → 우리: WASD + 화살표 이동, **Space/Enter/Z 조사·결정**, **Esc/X 취소·일시정지**, Shift 달리기, Tab 수첩, 1~4 선택지, F 전체화면. 마우스: 클릭 걷기·클릭 조사·호버 설명. 설정에서 키 바꾸기.

### 1-4. 가르치되 말로 하지 않는다 (닌텐도의 기승전결)
- 마리오 3D월드의 스테이지는 **도입 → 전개 → 전환 → 결말**: 새 요소를 안전한 곳에서 보여 주고, 키우고, 비틀고, 마무리. 5분 안에 하나를 가르친다. "무엇을 할지는 말하되 어떻게는 말하지 않는다", "말로 설명하지 않는다".
- → 우리 열흘이 이 틀이다: D1 전기 카드(도입, 안전) → D3 세는 소리(전개) → D5 범람(전환) → D7 방송(결말·새 규칙). 튜토리얼 창 대신 **순례의 한마디**와 **첫 카드**가 가르친다.

### 1-5. 누르면 바로 반응해야 한다 (게임 필)
- 연구가 셋으로 나눈다: 물리감 조정 / 반응 증폭(주스) / **입력 간소화**(플레이어의 의도대로 바로 움직이게). 입력 지연은 어떤 연출로도 못 덮는다. 과한 연출은 오히려 혼란.
- → 우리: 클릭하면 즉시 걷기 시작, 선택지는 한 번에, 화면 전환 0.2초 안. 피격 흔들림·종소리는 이미 있으니 **더 넣지 않는다**.

### 1-6. 있어야 하는 화면 목록 (여러 자료의 공통분모)
타이틀(계속 게임이 맨 위) · 새로 시작 · 일시정지 · 설정(소리·화면·키) · 저장/불러오기 · 인벤토리 또는 일지 · 캐릭터/파티 · 지도 · 목표(퀘스트) · 상점/제작(해당 시) · 대화창 · 결말. 우리에게 없는 것: **설정, 저장 슬롯, 키 바꾸기, 타이틀의 '계속 게임' 우선**.

---

## 2. 우리 게임의 화면 — 1280×720 기준

```
┌──────────────────────────────────────────────┬──────────────┐
│                                              │  D3  ·  열차 7일│  ← 패널 위: 날짜·남은 날 (항상)
│                                              │  🍞6  💧8  🔥4 │  ← 숫자 셋뿐
│                 지도 960×640                  │──────────────│
│         (배율 2, 15×10칸, 스크롤)              │ ◆ 목표 한 줄   │
│                                              │──────────────│
│   사람 머리 위: 하는 일 아이콘 / … / !          │ [수첩] [명부]  │  ← Tab으로도
│                                              │ [시선]        │
│                                              │              │
├──────────────────────────────────────────────┤  (호버 설명이  │
│ [초상 192] 이름                               │   여기 뜬다)   │
│            대화 18px, 한 번에 한 문장 ▼          │              │
│            1. 선택지   2. 선택지  (힌트 14px)    │              │
└──────────────────────────────────────────────┴──────────────┘
                                         (Esc) 일시정지: 계속 · 설정 · 저장 · 타이틀
```
- **지도**: 클릭 = 걷기(길찾기), 사람·물건 클릭 = 조사, 호버 = 이름 + 한 줄. 사람 머리 위에 오늘 하는 일 아이콘(가시성).
- **대화창**: 지도 아래 1/3, 초상 왼쪽, 글은 한 문장씩, 선택지는 번호. 긴 글은 ▼. Space 한 번 = 한 문장.
- **패널**: 숫자 셋 + 목표 + 수첩/명부/시선 탭. 마우스를 올린 것의 설명이 패널 아래에 뜬다(판단 정보 친절하게).
- **1080p**: 배율 3. 작은 창: 배율 1, 패널은 지도 위에 접힘.

## 3. 조작표

| 하는 것 | 키보드 | 마우스 |
|---|---|---|
| 이동 | WASD · 화살표 (Shift 달리기) | 칸 클릭 → 걸어감 |
| 조사·말 걸기·결정 | Space · Enter · Z | 물건·사람 클릭 / 선택지 클릭 |
| 취소·일시정지 | Esc · X | 오른쪽 클릭 = 취소 |
| 수첩 (명부·규칙·약속·일지) | Tab | 패널 탭 클릭 |
| 선택지 고르기 | 1 2 3 4 | 클릭 |
| 다음 문장 | Space · Enter · 클릭 | 클릭 |
| 전체화면 | F | 패널 버튼 |
| 키 바꾸기 | 설정 | — |

## 4. 메뉴 시스템 — 둘로 가른다

| | 일시정지 (Esc) | 수첩 (Tab) |
|---|---|---|
| 뜻 | 게임 밖 | 게임 안의 물건 (기관사의 수첩) |
| 항목 | 계속(기본) · 설정(소리·화면·키) · 저장/불러오기(슬롯 3 + 코드) · 타이틀로 | 명부(사람 카드·소원·기억) · 규칙(신의 규칙 뒷장) · 약속(지킨/어긴/기다리는) · 일지(날짜별) |
| 깊이 | 2단 | 2단 (탭 → 사람 카드) |
| 배경 | 어둡게, 소리 멈춤 | 지도 그대로, 소리 그대로 |
| 지금과 다른 점 | 지금은 '처음부터'가 메뉴 한가운데 있고 설정이 없다 | 지금은 '사람들·시선·일지·수첩'이 따로 흩어져 있다 |

타이틀: **계속(맨 위, 있을 때만) · 새로 시작 · 불러오기 · 설정**. 새로 시작에서 이름 입력(비우면 '당신').

## 5. 가르치는 순서 (튜토리얼 창 없음)
| 날 | 새로 배우는 것 | 누가 가르치나 |
|---|---|---|
| D0 | 걷기·조사·대화 | 전동차 안의 물건 둘, 기철 |
| D1 | 카드, 자리, 식량·물·땔감 | 순례 "전기를 켤래, 끌래", 첫 수첩 페이지 |
| D2 | 원정·보급·유대 | 출구 앞 준비 화면, 첫 곁에 |
| D3 | 시선(이름을 얻는다) | 수첩 뒷장 첫 줄 |
| D5 | 침수 | 선로의 물이 승강장에 닿는다 |
| D7 | 운임 | 방송 |

## 6. 만드는 순서 (화면만, 엔진은 그대로)
1. 레이아웃: 가로 틀(지도·패널·대화창), 배율 규칙, 전체화면. 십자키·폰 패드 제거.
2. 조작: WASD/화살표/Space/Esc/Tab/숫자, 클릭 걷기(길찾기 재사용), 호버 설명, 오른쪽 클릭 취소.
3. 메뉴 둘로 가르기: 일시정지(설정·저장 슬롯·코드·타이틀), 수첩(명부·규칙·약속·일지 탭).
4. 패널: 숫자 셋·목표·탭·호버 설명 자리. 사람 머리 위 일 아이콘.
5. 대화창: 초상 192, 한 문장씩, 번호 선택지, 힌트.
6. 타이틀: 계속 우선, 새로 시작(이름), 불러오기, 설정.
7. 끝났다는 증거: 마우스만으로 한 판, 키보드만으로 한 판, 각각 끝까지. 하루 클릭 ≤ 20.

---

## 출처
- [A UI/UX analysis of Zelda: Breath of the Wild (Game Developer)](https://www.gamedeveloper.com/art/a-ui-ux-analysis-of-zelda-breath-of-the-wilds)
- [Immersive, impressionable UI — BotW 팀 인터뷰 정리 (The Famicast)](https://www.thefamicast.com/2017/12/part-2-immersive-impressionable-ui.html)
- [Breath of the Wild Pro HUD (Siliconera)](https://www.siliconera.com/breath-wilds-pro-mode-disables-mini-map-temperature-meter-hud/)
- [Tears of the Kingdom — UI 개선과 남은 문제 (UX Collective)](https://uxdesign.cc/tears-of-the-kingdom-how-nintendo-improved-and-ignored-ui-issues-843f094b14b2)
- [UX and UI in game design: HUD, inventory, menus (Medium)](https://medium.com/@brdelfino.work/ux-and-ui-in-game-design-exploring-hud-inventory-and-menus-5d8c189deb65)
- [Video game inventory UX (Acagamic)](https://acagamic.com/newsletter/2023/03/21/how-to-unlock-the-secrets-of-video-game-inventory-ux-design/)
- [Designing immersive pause menus (Wayline)](https://www.wayline.io/blog/designing-immersive-pause-menus)
- [Mother 3 (Nintendo Wire 10주년 회고)](https://nintendowire.com/news/2016/04/20/look-mother-3-10th-anniversary/)
- [Mother 2 메뉴·'당연한 행동' 버튼 (yourgamerprofile)](https://yourgamerprofile.com/reviews/cmp1nkkkf0iba01ovq8d962xe)
- [RPG Maker 기본 조작 (itch.io 커뮤니티)](https://itch.io/post/985216)
- [RPG Maker Z/X 권장 (rpgmaker.net 공략)](https://rpgmaker.net/games/10173/walkthrough)
- [Nintendo's level design secrets in four steps — 기승전결 (MCV / Game Maker's Toolkit)](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)
- [Learning how Mario teaches us the basics (Nintendo Life)](https://www.nintendolife.com/news/2016/02/video_learning_how_mario_teaches_us_the_basics)
- [Designing Game Feel: A Survey (ITU)](https://pure.itu.dk/en/publications/designing-game-feel-a-survey/)
- [Juice overload (Wayline)](https://www.wayline.io/blog/juice-overload-sensory-feedback-hurts-gameplay)
