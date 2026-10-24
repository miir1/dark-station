# 장면 그림 생산 계획 (2026-10-24, 표현 부장)

근거: 디렉터 결정 10-24 A5("장면 그림은 가능하다면 지금부터"), plan.md §3, report_v4_2026-10-23.md §4.
셈 기준: `v4/data/events.json` 119행을 `v4/art.js` 의 찾는 순서(cgKey)대로 풀고, `v4/img/manifest.json` 에 있는 파일과 맞춰 봤다(2026-10-24 09:45 데이터).
Codex 구독은 **11/7 끝**. 11/7 이후에는 새 그림을 만들지 않는다(손찍기·후처리만).

## 0. 오늘(10/24) 만든 것 — 6장, Codex 3회(재시도 1 포함)

| 파일 | 쓰는 사건 | 판정 |
|---|---|---|
| d3_called_you | d3_called_you, called_up | 채택. 1인칭: 담요 쥔 두 손, 안개 속 따뜻한 빛, 계단 아래 가지런한 신발들. 형체 없음 |
| d0_ledger | d0_ledger | 채택. 1인칭 수첩(글자 없는 연필 줄), 장작 들고 묻는 순례, 뒤에 기철·마리 실루엣 |
| d1_rats | d1_rats | 1회 거부(폭력) → 같은 프롬프트 재시도로 채택. pro_stairs 와 같은 남자·계단 |
| d7_broadcast | d7_broadcast | 채택. 기둥 스피커, 담요 쓴 등들, 빈 수첩 |
| d9_stairs | d9_stairs | 채택. 그대로인 재, 가지런한 신발, 담요 속 순례의 검은 발 |
| d9_night_stand | d9_night_stand | 채택. 첫 계단 앞 내 구두, 긴 그림자 하나, 안개 속 빛 |

- 원본: art_src/cg_v3/ · 게임 그림: v4/img/cg/ (384×216, 48색) · 선택 창 그림: v4/img/cg_s/ (256×144, 48색) · 목록: v4/img/manifest.json 갱신(174 → 186).
- **pro_stairs 는 다시 그리지 않았다**: 10/22 에 만든 v4 그림이 이미 있고 게임이 그것을 띄운다(v3 대체가 아니었다). 기존 파일 덮어쓰기 금지라 그 자리를 d1_rats 에 썼다.
- d0_ledger 는 데이터의 image 칸이 비어 있지만 art.js 가 사건 id 로 찾으므로 바로 뜬다(game.js eventCg). 회의 응답(response_presentation.md)의 "명부는 글과 초상으로" 와 다르다 — 그림 없이 가려면 디렉터 결정 뒤 이 파일을 빼면 된다.
- 품질 메모는 art_src/codex_log.md '장면 그림' 절.

## 1. 남은 장면 그림 전수 (오늘 뒤)

'미룸' = 디렉터 결정 10-24 A1(이기심의 값)·A2(이른 날의 죽음)·A4(조사를 게을리하면 처벌)로 **글이 바뀔 장면**. 데이터 담당이 그 사건 글을 고친 뒤 하루 동안 안 바뀌면 '확정'으로 보고 그때 그린다. 그림은 선택 전 장면을 그리므로 글이 바뀌면 그림도 버려진다.

### 1-1. 데이터가 그림을 부르는데 파일이 없는 것 — 7장

| 파일 이름 | 쓰는 사건 | 언제 | 적나라 | 상태 | 이유 / 구도 씨앗 |
|---|---|---|---|---|---|
| trip_a1_backroom | trip_a1_backroom | 원정 A 1층 | 1 | 지금 가능 | 반쯤 열린 뒷방 문과 어둠, 계산대의 은채(등). 어머니·구더기는 '본다'를 고른 뒤의 글이라 그리지 않는다 |
| d5_lullaby | d5_lullaby | D5 밤 | 0 | **미룸 (A2)** | '놓친다' = 물에서 안 돌아옴. D5 죽음 길 |
| trip_a2_bones | trip_a2_bones | 원정 A 2층, D4~ | 1 | **미룸 (A2)** | 싸움 장면. 죽음 길이 날카로워질 후보 |
| flood_sick | flood_sick | 범람수 마신 밤 | 1 | **미룸 (A2·A4)** | 사흘 뒤 죽음 길 |
| wound_critical | wound_critical | 상처 3 | 1 | **미룸 (A4)** | '못 본 상처는 썩는다'로 글이 커질 예정 |
| dawn_dongha | dawn_dongha | 새벽(동하 원한 1단) | 1 | **미룸 (A1)** | 이기심 카르마의 습격 |
| dawn_dongha2 | dawn_dongha2 | 새벽(2단) | 1 | **미룸 (A1)** | 이기심 카르마의 습격, 실패하면 죽음 |

### 1-2. image 칸은 비었지만 그림을 붙일 사건 (art.js 가 사건 id 로 찾는다) — 1장

| 파일 이름 | 사건 | 상태 | 비고 |
|---|---|---|---|
| dawn_strike | dawn_strike (새벽, 누가 목을 조름) | **미룸 (A1)** | 이기심 카르마의 습격. 글 확정 뒤 |

(d0_ledger 는 오늘 만들었다. d0_ledger_b(수첩 없음)는 그림 없이 둔다.)

### 1-3. 시제품(v3) 그림으로 대신 띄우는 것 — 10장 · 12사건

파일 이름은 image 칸 이름(사건 id 와 다르므로). art.js 는 v4/img/cg/<image>.png 를 v3 대체보다 먼저 찾는다.

| 파일 이름 | 쓰는 사건 | 지금 뜨는 v3 그림 | 상태 |
|---|---|---|---|
| cg_notebook | pro_notebook (D0 전동차 수첩) | open_cab | 지금 가능 |
| cg_gicheol | pro_gicheol (D0 터널) | open_gicheol | 지금 가능 |
| cg_speaker | pro_speaker (D0 스피커) | open_speaker | 지금 가능 |
| cg_pharmacy | trip_a1_pharmacy | a1_pharmacy | 지금 가능 |
| cg_gate | trip_b1_gate | b1_gate | 지금 가능 |
| cg_dohyeon | d4_dohyeon_key, d6_dohyeon_back, d6_dohyeon_price | dohyeon_key | 지금 가능 (죽음 장면 아님) |
| cg_notebook_back | d3_guess (D4 아침 수첩 뒷장) | story_ticket | 지금 가능 (낮은 순위) |
| cg_train | d10_train (열차 결말) | story_ticket | 지금 가능 |
| cg_bottles | d3_bottle (D3 물 도둑) | n_thief | **미룸 (A4)** — '못 본 도둑질은 다시 온다' |
| cg_flood | d5_flood (D5 범람) | flood_break | **미룸 (A2)** — D5 밤 |

### 1-4. 일부러 비운 것 (계획에 안 넣음)
- title_dark (pro_cold, 첫 장면) · cg_ledger (ending_ledger, 결말 명부): art.js 에서 '그림 없음'으로 정해 둔 것. 디렉터가 원하실 때만 만든다.

### 1-5. 이미 있지만 다시 그릴 후보 (덮어쓰기라 디렉터 승인 뒤에만)
- pro_stairs: 바뀐 경고("계단 줄 위로는 가지 마")의 **줄**이 그림에 따로 없다 — 지금은 안개의 곧은 아랫단이 줄 역할을 한다. 지도 위 계단 덧그림(화면 쪽)으로 줄을 보이면 그림은 그대로 둬도 된다.
- trial_d3_count: 세는 손이 384×216 에서 약 10px, 순례 손이 '입'이 아니라 '얼굴'에 있는 것처럼 읽힘.
- d10_walk: 동하 재킷이 초록이 아니라 회색.
- trip_b1_workers: 장화 속 잘린 발이 작은 크기에서 안 읽힘.
- (Codex 0, 손찍기) d9_stairs: 48색에서 순례 발이 밝아져 '검은 발'이 약하다 — 발 부분만 어둡게 덧칠할 수 있다.

### 합계
- **지금 그릴 수 있는 것 9장**: trip_a1_backroom + 1-3 의 8장.
- **글 확정 뒤로 미루는 것 9장**: dawn_strike · dawn_dongha · dawn_dongha2 (A1 카르마 습격) / d5_lullaby · cg_flood · trip_a2_bones · flood_sick (A2 이른 날 죽음) / wound_critical · cg_bottles (A4 못 본 것의 처벌).
- A1·A2 작업에서 **새로 생기는 사건**(새 습격·새 죽음 장면)은 예비일에 더한다.

## 2. 날짜별 생산 계획 (10/25~11/6, 하루 상한 4~5회)

한 번 부를 때 3장씩 묶는다(10/22·10/24 에 3장 한 번에 통과). 재시도는 거부된 그림만 **같은 프롬프트로**(거부는 출력 단계 모더레이션이라 같은 글로도 통과한다: d2_rat_blanket, pro_stairs, 오늘 d1_rats).

| 날짜 | 호출 | 내용 | 조건 |
|---|---|---|---|
| 10/25 (일) | 2 (+재시도 ≤2) | ⓐ 프롤로그 v3 대체 3장: cg_notebook · cg_gicheol · cg_speaker / ⓑ 원정 3장: trip_a1_backroom · cg_pharmacy · cg_gate | 바로 |
| 10/26 (월) | 2 (+≤2) | plan.md §3 ③ 큰 장소 물건 시트 1회(P1-10) / ⓒ 남은 안정 3장: cg_dohyeon · cg_notebook_back · cg_train | 바로 |
| 10/27 (화) | 0~2 | P2 필요할 때만(당신 걷기 6장·타일 변형). 그 밖은 쉰다 | **장면 글 확정 기한**(보고서 §4) |
| 10/28 (수) | 1 (+≤2) | ⓓ A1 카르마 습격 3장: dawn_strike · dawn_dongha · dawn_dongha2 | 글 확정됐을 때만. 폭력이라 거부 위험 높음 |
| 10/29 (목) | 1 (+≤2) | ⓔ D3~D5 3장: d5_lullaby · cg_flood · cg_bottles | 글 확정됐을 때만 |
| 10/30 (금) | 1 (+≤2) | ⓕ 몸이 망가지는 3장: wound_critical · flood_sick · trip_a2_bones | 글 확정됐을 때만. 적나라, 거부 위험 높음 |
| 10/31 (토) ~ 11/2 (월) | 하루 0~5 | 예비: 확정이 늦은 ⓓ~ⓕ 를 하루씩 밀어 받는다. A1·A2 로 새로 생긴 사건 그림 | |
| 11/3 (화) ~ 11/5 (목) | 하루 0~5 | 디렉터가 다시 그리기를 승인한 그림(§1-5), 거부로 못 만든 그림의 우회 구도 | |
| 11/6 (금) | 0~5 | 마지막 날: 남은 것 전부. 후처리·목록 갱신 | |
| 11/7 (토) | 0 | 구독 끝 | |

어림: 묶음 6번(ⓐ~ⓕ) + 큰 물건 1 + 재시도(안정 묶음 30% ≈ 1~2, 위험 묶음 100% ≈ 3~6) + P2 0~2 = **약 11~17회**. 13일 × 하루 4~5회 = 52~65회 안에 넉넉하다. 남는 몫은 전부 예비(새 사건·다시 그리기)다.
미룬 장면의 글이 11/2 까지도 확정되지 않으면 그 장면은 v3 대체 또는 그림 없음으로 남는다(11/3~11/6 은 위험 큰 재시도에 써야 하므로).

## 3. 그리는 규칙 (지금까지와 같음)
- 파일 이름 = 사건 id. image 칸이 사건 id 와 다르면 image 칸 이름(§1-3). 여러 사건이 같은 image 를 쓰면 한 장으로 모두 덮는다(d3_called_you = d3_called_you + called_up).
- 명령: `codex.exe exec --skip-git-repo-check -i <참고 원본> -C art_src -s workspace-write "<프롬프트>" < /dev/null`. 원본은 art_src/cg_v3/. 프롬프트는 art_src/prompt_v4_scenes*.md 로 남긴다(오늘 1·2).
- 참고 그림(-i): 같은 장소의 기존 원본(계단 = pro_stairs, 승강장 밤 = trial_d3_count, 부르는 빛 = d3_called_you)을 붙여 결을 맞춘다. "한 장씩 한 번만 그려라"를 넣는다(오늘 세 번 모두 장당 1회만 뽑았다).
- 후처리: `tools/chunky.py` 의 cg 함수 → v4/img/cg/<이름>.png (384×216, 48색), 같은 함수 256×144 → v4/img/cg_s/<이름>.png. **있는 파일은 덮어쓰지 않는다.** 마지막에 `python v4/tools/manifest.py`.
  ※ portrait_cg_v4.py 를 통째로 돌리면 꿈 그림·초상 80·cg_s 를 다시 쓰고 안 쓰는 cg_s 를 지우므로, 새 그림만 chunky.cg 로 직접 뽑는다.
- 48색으로 줄이면 피 빨강·겨자색이 주황·갈색 쪽으로 죽고, 작은 빛(스피커 불빛)은 약해진다. 핵심 색이 죽으면 손찍기 덧칠로 살린다(Codex 0).
- 수위: 유혈·절단·시체는 직접, 식인·자살은 간접, 성적 묘사 없음. 미성년(서하)은 프레임 밖. 글자·간판·숫자 없음. 얼굴은 등·그림자·가림으로(초상이 있는 주민은 초상과 같은 얼굴이면 보여도 된다 — d0_ledger 순례).
- 세계의 이유는 그리지 않는다: '위'에서 부르는 것은 형체 없이 빛·안개·재·가지런한 신발로만.
- 호출마다 art_src/codex_log.md 에 시각·프롬프트·결과·판정을 적는다.
