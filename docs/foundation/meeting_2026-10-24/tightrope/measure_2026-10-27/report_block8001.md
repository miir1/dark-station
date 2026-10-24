# 봇 보고서 — 정책 20 × 200판 × 시드 블록 1 (2026-10-25)

데이터: v4/data (밤 사건 54, 사건 128, 후보 7). 시드 블록: 시드 8001~8200. 걸린 시간 101.7초. 규칙·데이터는 손대지 않았다.

## 1. 정책별 표 (블록 1개를 합친 200판)
| 정책 | 생존% | 사망% | 굶주림비중% | 실질경고% | 강제% | 열차% | 전멸% | 밤사건 | 시계 | malice | hymn | 발견% | 모름≥1% | 찬가발견% | explicit | 결정/일 | 빈칸% | 원정 | 날 | 굶주림 | D3셈% | 함께센다% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 37 | 63 | 0 | 100 | 0 | 0 | 12.5 | 13.84 | 12.13 | 5.69 | 3.47 | 69.9 | 91.5 | 94.4 | 10.15 | 23.25 | 61.8 | 4.7 | 7.95 | 6.43 | 95 | 0 |
| selfish | 30.5 | 69.5 | 0.7 | 100 | 0 | 0 | 6.5 | 21.56 | 13.91 | 12.12 | 4.02 | 67.6 | 100 | 91.5 | 10.62 | 20.67 | 69.2 | 7.33 | 8.59 | 4.8 | 100 | 0 |
| devoted | 20 | 80 | 0 | 100 | 0 | 2.5 | 2.5 | 9.79 | 9.28 | 3.38 | 3.18 | 68.3 | 87 | 94.3 | 8.67 | 26.75 | 20.8 | 3.43 | 6.39 | 6.49 | 95 | 0 |
| silent | 36 | 64 | 0 | 100 | 0 | 0 | 12.5 | 13.87 | 11.91 | 5.56 | 3.4 | 67.4 | 95.5 | 94 | 10.08 | 23.43 | 64 | 4.8 | 7.91 | 6.45 | 94.5 | 0 |
| caller | 26.5 | 73.5 | 0 | 100 | 0 | 0 | 8.5 | 12.54 | 11.36 | 5.41 | 3.03 | 68.5 | 90.5 | 96.2 | 9.41 | 24.52 | 61 | 4.6 | 7.35 | 6.25 | 94 | 0 |
| lazy | 26.5 | 73.5 | 0 | 100 | 0 | 0 | 13.5 | 14.62 | 11.25 | 6.29 | 3.24 | 47.3 | 95 | 77.2 | 9.91 | 20.67 | 60.6 | 4.18 | 7.53 | 6.33 | 94.5 | 0 |
| diligent | 39 | 61 | 0 | 100 | 0 | 0 | 10 | 13.01 | 12.27 | 5.35 | 3.47 | 95.4 | 46 | 99.9 | 11.11 | 65.24 | 28.2 | 4.85 | 8.1 | 6.5 | 95 | 0 |
| risky | 30.5 | 69.5 | 0 | 100 | 0 | 12.5 | 4 | 15.28 | 10.58 | 5.44 | 4.76 | 67.1 | 92.5 | 89.6 | 11.13 | 29.22 | 62.8 | 6.64 | 7.07 | 5.76 | 94 | 0 |
| steward | 40.5 | 59.5 | 0 | 100 | 0 | 0 | 13 | 14.39 | 12.55 | 5.93 | 3.44 | 65.7 | 95.5 | 94.8 | 10.05 | 22.48 | 23.6 | 4.84 | 8.27 | 7.09 | 96.5 | 0 |
| counter | 6 | 94 | 15.4 | 100 | 0 | 0.5 | 2 | 15.94 | 10.38 | 8.53 | 3.04 | 65.8 | 94 | 91.3 | 9.26 | 25.84 | 64.3 | 4.1 | 6.6 | 4.92 | 96 | 0 |
| child | 21 | 79 | 1.9 | 100 | 0 | 0 | 10 | 19.93 | 12.51 | 10.83 | 3.39 | 65.8 | 99.5 | 90.7 | 10.09 | 21.74 | 57.8 | 6.52 | 7.95 | 4.48 | 100 | 0 |
| selfish_nb | 33 | 67 | 0.7 | 100 | 0 | 0 | 9.5 | 22.87 | 14.45 | 13.02 | 4.05 | 67.4 | 100 | 91.5 | 11.19 | 20.36 | 66.7 | 6.67 | 8.85 | 4.74 | 100 | 0 |
| selfish_rt | 5.5 | 94.5 | 2.6 | 100 | 0 | 0 | 4.5 | 16.49 | 10.68 | 8.83 | 3.45 | 64.9 | 100 | 89.4 | 8.95 | 23.14 | 67.9 | 6.16 | 6.84 | 4.12 | 100 | 0 |
| selfish_rt0 | 8 | 92 | 3.3 | 100 | 0 | 0 | 6 | 17.11 | 10.93 | 9.26 | 3.52 | 64.8 | 100 | 89.2 | 9.18 | 22.87 | 68.9 | 6.15 | 7.01 | 4.15 | 100 | 0 |
| h_random | 0.5 | 99.5 | 19.1 | 100 | 0 | 0 | 0 | 3.78 | 2.93 | 1.55 | 1.23 | 69.7 | 37.5 | 94.7 | 3.75 | 33.88 | 66.7 | 2.05 | 2.44 | 4.74 | 48 | 51 |
| h_wary | 7.5 | 92.5 | 0 | 100 | 0 | 0.5 | 3 | 8.77 | 5.7 | 4.03 | 1.95 | 64.3 | 54 | 90.8 | 5.99 | 28.45 | 63.2 | 2.61 | 3.95 | 6.09 | 54 | 0 |
| h_first | 67 | 33 | 0 | 100 | 0 | 6 | 3 | 19.46 | 12.7 | 7.63 | 5.49 | 66 | 100 | 90.4 | 12.41 | 20.2 | 68.8 | 4.65 | 9.5 | 7.21 | 100 | 0 |
| h_cautious | 73.5 | 26.5 | 0 | 100 | 0 | 0 | 40 | 19.65 | 14.97 | 8.56 | 4.3 | 69.4 | 100 | 94.3 | 12.03 | 19.76 | 59.5 | 6.15 | 9.38 | 7.13 | 100 | 0 |
| h_cautious2 | 32 | 68 | 0 | 100 | 0 | 0 | 10.5 | 15.74 | 12.38 | 6.53 | 3.81 | 67.2 | 96.5 | 92.9 | 10.31 | 22.51 | 60.9 | 5.24 | 7.98 | 6.58 | 98 | 0 |
| h_mixed | 33 | 67 | 0 | 100 | 0 | 0 | 11.5 | 15.22 | 10.66 | 6.64 | 3.6 | 67.1 | 79.5 | 89.7 | 9.57 | 23.74 | 62.8 | 4.9 | 6.95 | 6.67 | 79.5 | 0 |

굶주림 = 아침마다 잰 당신 굶주림의 판 평균(10-24 추가) · D3셈% = D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 · 함께센다% = 그중 '함께 센다'를 고른 비율. 아침 조사는 칸 단위(10-24 P0-E2: 그 칸의 물건 전부, 조사 수 = 칸 수).

정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대) / steward 몫+손−이름+(정체 inspector 쪽 성향, 10-23 추가). 조심형(합격선 따로 집계) = balanced·silent·lazy·diligent·steward·selfish_nb.
- balanced 사망 원인: d5_flood 36 · fever_night 28 · d10_walk_weak 24 · dawn_strike 18 · d2_shutter_arm 10 · d4_spanner 5 · called_up 3 · dawn_mob 2
- selfish 사망 원인: called_up 57 · dawn_strike 30 · dawn_mob 15 · d10_hold 12 · d10_walk_weak 11 · d10_grab 8 · fever_night 5 · starve_you 1 [평범한 대안 두고 죽음 글 선택 1]
- devoted 사망 원인: fever_night 60 · d5_flood 30 · d4_spanner 29 · dawn_strike 14 · d6_shutter_b 12 · d2_shutter_arm 10 · d10_walk_weak 5 [평범한 대안 두고 죽음 글 선택 58]
- silent 사망 원인: fever_night 36 · d5_flood 33 · d10_walk_weak 27 · dawn_strike 12 · d2_shutter_arm 11 · d4_spanner 6 · dawn_mob 2 · called_up 1
- caller 사망 원인: fever_night 44 · d5_flood 36 · d10_walk_weak 21 · dawn_strike 20 · d2_shutter_arm 12 · d4_spanner 9 · called_up 3 · dawn_mob 2 [평범한 대안 두고 죽음 글 선택 24]
- lazy 사망 원인: d5_flood 37 · fever_night 36 · dawn_strike 34 · d10_walk_weak 20 · d2_shutter_arm 11 · d4_spanner 6 · dawn_mob 2 · called_up 1
- diligent 사망 원인: fever_night 43 · d5_flood 30 · d10_walk_weak 30 · d2_shutter_arm 10 · d4_spanner 5 · called_up 2 · dawn_strike 1 · dawn_mob 1
- risky 사망 원인: d5_flood 42 · fever_night 38 · d4_spanner 15 · d2_shutter_arm 12 · d10_walk_weak 11 · dawn_strike 10 · called_up 6 · dawn_mob 3 · d6_shutter 2 [평범한 대안 두고 죽음 글 선택 97]
- steward 사망 원인: fever_night 50 · d5_flood 31 · d10_walk_weak 21 · dawn_strike 10 · d2_shutter_arm 7
- counter 사망 원인: called_up 30 · starve_you 29 · d4_spanner 28 · d5_flood 25 · dawn_strike 24 · fever_night 21 · dawn_mob 16 · d2_shutter_arm 8 · d10_walk_weak 4 · d10_hold 3 [평범한 대안 두고 죽음 글 선택 49]
- child 사망 원인: called_up 41 · dawn_strike 35 · d5_flood 30 · dawn_mob 25 · d10_walk_weak 10 · fever_night 6 · d10_grab 4 · d10_hold 4 · starve_you 3 [평범한 대안 두고 죽음 글 선택 36]
- selfish_nb 사망 원인: called_up 39 · dawn_strike 34 · dawn_mob 19 · d10_walk_weak 19 · d10_hold 9 · fever_night 7 · d10_grab 6 · starve_you 1 [평범한 대안 두고 죽음 글 선택 1]
- selfish_rt 사망 원인: dawn_mob 64 · called_up 53 · dawn_strike 46 · d5_flood 18 · starve_you 5 · d10_walk_weak 2 · d10_hold 1 [평범한 대안 두고 죽음 글 선택 23]
- selfish_rt0 사망 원인: dawn_mob 69 · dawn_strike 50 · called_up 33 · d5_flood 18 · starve_you 6 · d10_walk_weak 3 · fever_night 2 · d10_grab 2 · d10_hold 1 [평범한 대안 두고 죽음 글 선택 25]
- h_random 사망 원인: pro_stairs 92 · starve_you 38 · d3_called_you 28 · d2_night_shutter 10 · d5_flood 7 · fever_night 6 · dawn_mob 4 · dawn_strike 4 · called_up 4 · d6_shutter 2 · d8_patrol_return 1 · d6_shutter_b 1 · d10_hold 1 · d4_spanner 1 [평범한 대안 두고 죽음 글 선택 90]
- h_wary 사망 원인: pro_stairs 92 · dawn_mob 28 · called_up 24 · dawn_strike 18 · fever_night 10 · d8_patrol_return 5 · d10_walk_weak 3 · d5_flood 2 · d10_hold 2 · d4_spanner 1
- h_first 사망 원인: fever_night 27 · dawn_strike 14 · d10_walk_weak 9 · d10_grab 8 · called_up 4 · dawn_mob 3 · d10_hold 1
- h_cautious 사망 원인: dawn_strike 13 · dawn_mob 10 · called_up 8 · fever_night 8 · d10_walk_weak 8 · d10_grab 3 · d10_hold 3
- h_cautious2 사망 원인: dawn_strike 27 · d5_flood 23 · dawn_mob 22 · fever_night 21 · called_up 17 · d10_walk_weak 11 · d10_grab 7 · d2_shutter_arm 4 · d4_spanner 4
- h_mixed 사망 원인: pro_stairs 41 · called_up 21 · dawn_mob 20 · d10_walk_weak 13 · dawn_strike 13 · fever_night 11 · d8_patrol_return 6 · d10_grab 6 · d10_hold 3

강제 = 확정 사망 — 고를 때 열린 선택지 전부 살 확률 0 (10-24 tightrope R1, 살 확률 > 0 인 주사위가 하나라도 열려 있으면 강제가 아니다 · 옛 정의 '죽지 않는 열린 선택지 0개'는 아래 '줄타기·발견 지표' 표의 '옛 강제'). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택). 실질경고% = 사망 중 '경고 글이 있고 강제가 아닌' 선택으로 죽은 비율(10-22 리드 결정: 강제 사망은 경고 있음으로 세지 않는다). 둘 다 엔진의 사인 기록(ended.cause.forced·free)에서 읽는다.

### 정책별 비교 (생존% / 사망% / 열차%)
| 정책 | 지금 | 2026-10-26 |
|---|---|---|
| balanced | 37 / 63 / 0 | 45.5 / 54.5 / 0 |
| selfish | 30.5 / 69.5 / 0 | 42.9 / 57.1 / 0 |
| devoted | 20 / 80 / 2.5 | 23.8 / 76.3 / 3.4 |
| silent | 36 / 64 / 0 | 48.4 / 51.6 / 0 |
| caller | 26.5 / 73.5 / 0 | 40 / 60 / 0 |
| lazy | 26.5 / 73.5 / 0 | 39.5 / 60.5 / 0 |
| diligent | 39 / 61 / 0 | 47.3 / 52.8 / 0 |
| risky | 30.5 / 69.5 / 12.5 | 24.4 / 75.6 / 7.6 |
| steward | 40.5 / 59.5 / 0 | 41.8 / 58.3 / 0 |
| counter | 6 / 94 / 0.5 | 34.6 / 65.4 / 7.1 |
| child | 21 / 79 / 0 | 67.3 / 32.8 / 0 |
| selfish_nb | 33 / 67 / 0 | 89.6 / 10.4 / 0 |
| selfish_rt | 5.5 / 94.5 / 0 | 10.4 / 89.6 / 0 |
| selfish_rt0 | 8 / 92 / 0 | 30.8 / 69.3 / 0 |
| h_random | 0.5 / 99.5 / 0 | 0.1 / 99.9 / 0 |
| h_wary | 7.5 / 92.5 / 0.5 | 44.5 / 55.5 / 3 |
| h_first | 67 / 33 / 6 | 100 / 0 / 9.8 |
| h_cautious | 73.5 / 26.5 / 0 | 100 / 0 / 0 |
| h_cautious2 | 32 / 68 / 0 | 64.1 / 35.9 / 1.5 |
| h_mixed | 33 / 67 / 0 | 78.8 / 21.3 / 0.1 |

### 정체 분포 (정책별 %)
| 정책 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| balanced | 1.5 | 36 | 0 | 34 | 0.5 | 26 | 2 |
| selfish | 0 | 0 | 0 | 99 | 0 | 0.5 | 0.5 |
| devoted | 74 | 26 | 0 | 0 | 0 | 0 | 0 |
| silent | 0 | 38.5 | 0 | 34 | 0 | 27.5 | 0 |
| caller | 57.5 | 0 | 31.5 | 0 | 8 | 0 | 3 |
| lazy | 0 | 47.5 | 0 | 30.5 | 0 | 20 | 2 |
| diligent | 0 | 37 | 0 | 27.5 | 0.5 | 31.5 | 3.5 |
| risky | 2 | 22.5 | 0 | 14.5 | 1.5 | 56.5 | 3 |
| steward | 5 | 0 | 95 | 0 | 0 | 0 | 0 |
| counter | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| child | 0 | 0 | 0 | 0 | 0 | 0 | 100 |
| selfish_nb | 0 | 0 | 0 | 98.5 | 0 | 0.5 | 1 |
| selfish_rt | 0 | 0 | 0 | 98.5 | 0 | 0 | 1.5 |
| selfish_rt0 | 0 | 0 | 0 | 99 | 0 | 0 | 1 |
| h_random | 9.5 | 3 | 6 | 32 | 13 | 26 | 10.5 |
| h_wary | 5 | 5.5 | 2.5 | 37.5 | 11 | 34.5 | 4 |
| h_first | 60 | 6 | 0.5 | 0 | 31 | 2.5 | 0 |
| h_cautious | 0 | 9 | 0 | 76 | 0 | 14.5 | 0.5 |
| h_cautious2 | 0.5 | 18 | 0.5 | 39 | 2.5 | 36.5 | 3 |
| h_mixed | 3.5 | 11.5 | 6.5 | 48 | 4 | 22 | 4.5 |

### 당신 사망 원인 (balanced, 판 수)
- d5_flood: 36
- fever_night: 28
- d10_walk_weak: 24
- dawn_strike: 18
- d2_shutter_arm: 10
- d4_spanner: 5
- called_up: 3
- dawn_mob: 2

### 날별 당신 사망 (판 수, 200판 중 · 괄호 = 그날 사건으로 죽은 판, 깔때기 사건(열병·새벽 위독 등) 뺌)
| 정책 | D0 | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 0 | 0 | 10 (10) | 0 | 5 (5) | 39 (38) | 7 (1) | 13 (10) | 8 (3) | 17 (4) | 27 (3) |
| selfish | 0 | 0 | 0 | 0 | 2 (2) | 3 (3) | 12 (12) | 50 (49) | 17 (16) | 21 (18) | 34 (23) |
| devoted | 0 | 0 | 10 (10) | 6 (0) | 43 (29) | 33 (30) | 25 (15) | 15 (5) | 11 (1) | 9 (2) | 8 (3) |
| silent | 0 | 0 | 11 (11) | 0 | 7 (6) | 35 (33) | 5 (3) | 13 (5) | 16 (3) | 13 (3) | 28 (1) |
| caller | 0 | 0 | 12 (12) | 0 | 13 (9) | 43 (39) | 13 (5) | 16 (6) | 12 (3) | 15 (6) | 23 (2) |
| lazy | 0 | 0 | 11 (11) | 0 | 6 (6) | 45 (41) | 8 (1) | 18 (10) | 21 (12) | 11 (3) | 27 (7) |
| diligent | 0 | 0 | 10 (10) | 0 | 6 (5) | 35 (30) | 2 (0) | 14 (4) | 10 (0) | 15 (0) | 30 (0) |
| risky | 0 | 0 | 12 (12) | 2 (0) | 19 (15) | 51 (46) | 11 (5) | 11 (6) | 9 (2) | 11 (2) | 13 (2) |
| steward | 0 | 0 | 7 (7) | 0 | 1 (0) | 33 (32) | 4 (2) | 16 (2) | 14 (1) | 22 (3) | 22 (1) |
| counter | 0 | 0 | 8 (8) | 0 | 32 (30) | 34 (31) | 13 (10) | 39 (33) | 32 (29) | 19 (15) | 11 (7) |
| child | 0 | 0 | 0 | 0 | 1 (1) | 33 (33) | 14 (14) | 34 (32) | 23 (21) | 24 (22) | 29 (19) |
| selfish_nb | 0 | 0 | 0 | 0 | 2 (2) | 3 (3) | 6 (6) | 34 (34) | 27 (24) | 22 (18) | 40 (21) |
| selfish_rt | 0 | 0 | 0 | 0 | 2 (2) | 23 (23) | 59 (59) | 72 (72) | 23 (23) | 3 (3) | 7 (5) |
| selfish_rt0 | 0 | 0 | 0 | 0 | 2 (2) | 23 (23) | 59 (59) | 57 (56) | 23 (23) | 11 (10) | 9 (6) |
| h_random | 92 (92) | 1 (0) | 11 (11) | 30 (30) | 16 (16) | 20 (17) | 13 (13) | 8 (7) | 6 (5) | 1 (1) | 1 (1) |
| h_wary | 92 (92) | 0 | 0 | 0 | 3 (2) | 11 (9) | 28 (25) | 19 (18) | 18 (16) | 6 (5) | 8 (5) |
| h_first | 0 | 0 | 0 | 0 | 0 | 0 | 9 (5) | 9 (3) | 9 (6) | 18 (4) | 21 (12) |
| h_cautious | 0 | 0 | 0 | 0 | 0 | 1 (1) | 7 (7) | 10 (8) | 7 (6) | 10 (5) | 18 (10) |
| h_cautious2 | 0 | 0 | 4 (4) | 0 | 4 (4) | 29 (26) | 18 (12) | 17 (15) | 25 (20) | 17 (12) | 22 (11) |
| h_mixed | 41 (41) | 0 | 0 | 0 | 0 | 1 (1) | 17 (16) | 25 (22) | 15 (11) | 11 (8) | 24 (11) |

### A1·A2·A4 지표 (블록 합산)
| 정책 | 생존% | D1~D4 생존% | D5까지 사망% | 산 날 | 카르마(끝) | 못 본 일/판 | 방치 줄/판 | D9 주민 | D7 자원 | 사인 1위 | 원인 1위 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 37 | 92.5 | 27 | 7.95 | 2.14 | 2.32 | 6.53 | 2.98 | 2.51 | d5_flood 28.6% | d5_flood 28.6% |
| selfish | 30.5 | 99 | 2.5 | 8.59 | 9.63 | 2.1 | 7.65 | 3.04 | 5.49 | called_up 41% | called_up 41% |
| devoted | 20 | 70.5 | 46 | 6.39 | 0 | 1.63 | 4.75 | 3.84 | 2.16 | fever_night 37.5% | d4_spanner 19.4% |
| silent | 36 | 91 | 26.5 | 7.91 | 2.25 | 2.46 | 6.62 | 3.06 | 2.42 | fever_night 28.1% | starve_you 40.6% |
| caller | 26.5 | 87.5 | 34 | 7.35 | 2.22 | 2.11 | 5.84 | 2.98 | 2.91 | fever_night 29.9% | starve_you 25.9% |
| lazy | 26.5 | 91.5 | 31 | 7.53 | 2.03 | 4.31 | 6.3 | 3.04 | 2.03 | d5_flood 25.2% | dawn_strike 31.3% |
| diligent | 39 | 92 | 25.5 | 8.1 | 2.31 | 0.44 | 6.01 | 3.13 | 2.5 | fever_night 35.2% | starve_you 41% |
| risky | 30.5 | 83.5 | 42 | 7.07 | 3.64 | 1.98 | 4.54 | 3.43 | 9.7 | d5_flood 30.2% | d5_flood 30.2% |
| steward | 40.5 | 96 | 20.5 | 8.27 | 2.05 | 2.86 | 6.93 | 2.9 | 1.83 | fever_night 42% | starve_you 45.4% |
| counter | 6 | 80 | 37 | 6.6 | 7.68 | 1.57 | 5.11 | 3.25 | 3.91 | called_up 16% | called_up 18.6% |
| child | 21 | 99.5 | 17 | 7.95 | 11.8 | 2.04 | 6.61 | 2.66 | 6.99 | called_up 25.9% | called_up 28.5% |
| selfish_nb | 33 | 99 | 2.5 | 8.85 | 10.48 | 2.19 | 7.84 | 2.9 | 5.54 | called_up 29.1% | called_up 37.3% |
| selfish_rt | 5.5 | 99 | 12.5 | 6.84 | 13.89 | 1.42 | 5.23 | 2.12 | 6.96 | dawn_mob 33.9% | dawn_mob 33.9% |
| selfish_rt0 | 8 | 99 | 12.5 | 7.01 | 13.85 | 1.44 | 5.39 | 2.42 | 6.97 | dawn_mob 37.5% | dawn_mob 38% |
| h_random | 0.5 | 25 | 85 | 2.44 | 2.27 | 0.43 | 1.28 | 2.67 | 3.71 | pro_stairs 46.2% | pro_stairs 46.2% |
| h_wary | 7.5 | 52.5 | 53 | 3.95 | 5.19 | 1.26 | 3.03 | 2.92 | 3.78 | pro_stairs 49.7% | pro_stairs 49.7% |
| h_first | 67 | 100 | 0 | 9.5 | 5.02 | 2.85 | 8.09 | 4.17 | 2.92 | fever_night 40.9% | dawn_strike 22.7% |
| h_cautious | 73.5 | 100 | 0.5 | 9.38 | 6.79 | 3.07 | 7.64 | 2.43 | 3.59 | dawn_strike 24.5% | starve_you 28.3% |
| h_cautious2 | 32 | 96 | 18.5 | 7.98 | 4.76 | 2.5 | 6.53 | 3.05 | 2.71 | dawn_strike 19.9% | dawn_strike 19.9% |
| h_mixed | 33 | 79.5 | 21 | 6.95 | 6.14 | 2.15 | 5.6 | 2.93 | 3.82 | pro_stairs 30.6% | pro_stairs 30.6% |

### 줄타기·발견 지표 (10-24 tightrope, 블록 합산 — '산 판' = 열흘을 산 판)
| 정책 | 확정 사망 | 옛 강제(위험 0 출구 없음) | 경고 없는 사망 | 줄타기 굴림/판 | 줄타기 넘김/판 (산 판) | 산 판 중 줄타기 ≥2번% | 죽음 판정 넘김/판 (산 판) | 줄타기로 죽은 판 | 눈먼 새벽/판 · 그 죽음 | 실제 발견% | 옛 발견% | 누구나 아는 밤/판 · 숨은 밤/판 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 0 | 27 | 0 | 0.61 | 0.61 | 16.2% | 3.78 | 23 | 0.32 · 16 | 62.1% | 69.9% | 2.83 · 11.01 |
| selfish | 0 | 138 | 0 | 3.59 | 3.92 | 82% | 4.11 | 129 | 0.26 · 10 | 55.1% | 67.6% | 6.02 · 15.54 |
| devoted | 0 | 13 | 0 | 0.09 | 0.2 | 2.5% | 5.05 | 3 | 0.16 · 13 | 64.1% | 68.3% | 1.13 · 8.66 |
| silent | 0 | 21 | 0 | 0.58 | 0.81 | 19.4% | 3.82 | 15 | 0.22 · 10 | 60% | 67.4% | 2.59 · 11.28 |
| caller | 0 | 35 | 0 | 0.43 | 0.66 | 11.3% | 4.23 | 11 | 0.18 · 19 | 61.1% | 68.5% | 2.36 · 10.18 |
| lazy | 0 | 48 | 0 | 1.35 | 1.43 | 35.8% | 4.83 | 37 | 1.04 · 34 | 31.2% | 47.3% | 3.42 · 11.2 |
| diligent | 0 | 13 | 0 | 0.19 | 0.24 | 7.7% | 3.42 | 4 | 0 · 0 | 94.5% | 95.4% | 2.13 · 10.88 |
| risky | 0 | 20 | 0 | 0.97 | 1.64 | 42.6% | 4.95 | 15 | 0.29 · 9 | 58.6% | 67.1% | 3.14 · 12.14 |
| steward | 0 | 10 | 0 | 0.15 | 0.15 | 0% | 3.27 | 4 | 0.3 · 10 | 58.7% | 65.7% | 2.44 · 11.95 |
| counter | 0 | 95 | 0 | 2.87 | 5.08 | 91.7% | 7.5 | 99 | 0.16 · 10 | 54.1% | 65.8% | 4.07 · 11.87 |
| child | 0 | 122 | 0 | 3.23 | 3.95 | 76.2% | 4.95 | 121 | 0.25 · 13 | 52.2% | 65.8% | 5.64 · 14.29 |
| selfish_nb | 0 | 133 | 0 | 4.49 | 5.47 | 81.8% | 5.88 | 118 | 0.28 · 13 | 53.6% | 67.4% | 6.79 · 16.09 |
| selfish_rt | 0 | 166 | 0 | 2.62 | 2 | 54.5% | 2 | 189 | 0.14 · 10 | 53.3% | 64.9% | 4.09 · 12.4 |
| selfish_rt0 | 0 | 159 | 0 | 2.92 | 3.31 | 68.8% | 3.31 | 184 | 0.16 · 13 | 52.8% | 64.8% | 4.35 · 12.77 |
| h_random | 0 | 14 | 0 | 0.3 | 1 | 0% | 4 | 11 | 0.03 · 2 | 64.3% | 69.7% | 0.57 · 3.21 |
| h_wary | 0 | 88 | 0 | 1.3 | 2.8 | 60% | 3.2 | 78 | 0.12 · 10 | 52.1% | 64.3% | 2.23 · 6.54 |
| h_first | 0 | 66 | 0 | 1.83 | 1.78 | 47.8% | 1.84 | 39 | 0.44 · 13 | 58.2% | 66% | 3.64 · 15.82 |
| h_cautious | 0 | 53 | 0 | 2.86 | 2.84 | 59.9% | 3.07 | 48 | 0.39 · 10 | 55.9% | 69.4% | 6.03 · 13.62 |
| h_cautious2 | 0 | 89 | 0 | 1.24 | 1.2 | 17.2% | 2.75 | 64 | 0.29 · 21 | 57.4% | 67.2% | 3.61 · 12.13 |
| h_mixed | 0 | 87 | 0 | 2.29 | 2.67 | 60.6% | 3 | 71 | 0.28 · 9 | 54.5% | 67.1% | 4.2 · 11.02 |

확정 사망 = 고를 때 열린 선택지 전부 살 확률 0 (R1 — 엔진 ended.cause.forced). 옛 강제 = 당신이 죽지 않는 열린 선택지 0개(카르마 판의 줄타기는 일부러 그렇다). 줄타기 = rope 칸이 얹힌 판정(엔진 s.stats.ropeRolls·ropeClose), 죽음 판정 = 실패가 당신을 죽이는 모든 판정(deathRolls·closeCalls). 실제 발견% = 누구나 아는 밤(public·kill)을 뺀 주민 사건 가운데 발견한 비율 — 옛 발견%(발견%) 옆에 싣는다.

원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.
- balanced 원인 사건: d5_flood 36 · starve_you 32 · dawn_strike 20 · d2_shutter_arm 15 · d4_spanner 5 · called_up 3 · d9_inspection_b 3 · d7_rot 3
- selfish 원인 사건: called_up 57 · dawn_strike 34 · dawn_mob 16 · d10_hold 13 · d10_grab 8 · starve_you 7 · night:steal_meds_again 2 · d1_night_storage 2
- devoted 원인 사건: d4_spanner 31 · d5_flood 30 · d2_shutter_arm 25 · starve_you 14 · dawn_strike 14 · patrol_pact 14 · d6_shutter_b 12 · d7_rot 8
- silent 원인 사건: starve_you 52 · d5_flood 33 · d2_shutter_arm 16 · dawn_strike 13 · d4_spanner 6 · dawn_mob 4 · called_up 1 · patrol_pact 1
- caller 원인 사건: starve_you 38 · d5_flood 36 · d2_shutter_arm 23 · dawn_strike 21 · d4_spanner 9 · d9_inspection 6 · dawn_mob 5 · called_up 3
- lazy 원인 사건: dawn_strike 46 · d5_flood 37 · starve_you 26 · d2_shutter_arm 17 · d4_spanner 6 · d7_rot 3 · dawn_mob 2 · d1_night_storage 2
- diligent 원인 사건: starve_you 50 · d5_flood 30 · d2_shutter_arm 17 · d4_spanner 5 · d9_inspection 5 · d7_rot 4 · patrol_pact 3 · dawn_mob 3
- risky 원인 사건: d5_flood 42 · d4_spanner 15 · d2_shutter_arm 14 · trip_b2_pumproom 11 · dawn_strike 11 · trip_a2_stockroom 8 · called_up 7 · starve_you 6
- steward 원인 사건: starve_you 54 · d5_flood 31 · d2_shutter_arm 13 · dawn_strike 10 · d9_inspection 3 · d9_inspection_b 2 · patrol_pact 2 · patrol_pact_b 2
- counter 원인 사건: called_up 35 · starve_you 29 · dawn_strike 29 · d4_spanner 28 · d5_flood 25 · dawn_mob 21 · d2_shutter_arm 14 · d10_hold 3
- child 원인 사건: called_up 45 · dawn_strike 36 · d5_flood 30 · dawn_mob 29 · d10_grab 4 · d10_hold 4 · d1_night_storage 4 · starve_you 4
- selfish_nb 원인 사건: called_up 50 · dawn_strike 35 · dawn_mob 26 · d10_hold 10 · d10_grab 6 · d1_night_storage 3 · starve_you 2 · d9_inspection_b 1
- selfish_rt 원인 사건: dawn_mob 64 · called_up 53 · dawn_strike 46 · d5_flood 18 · starve_you 6 · night:steal_meds_again 1 · d10_hold 1
- selfish_rt0 원인 사건: dawn_mob 70 · dawn_strike 50 · called_up 35 · d5_flood 18 · starve_you 6 · d10_hold 2 · d10_grab 2 · d1_night_storage 1
- h_random 원인 사건: pro_stairs 92 · starve_you 40 · d3_called_you 28 · d2_night_shutter 10 · d5_flood 7 · dawn_mob 4 · dawn_strike 4 · called_up 4
- h_wary 원인 사건: pro_stairs 92 · dawn_mob 28 · called_up 24 · dawn_strike 18 · starve_you 6 · d8_patrol_return 5 · d1_night_storage 4 · d5_flood 2
- h_first 원인 사건: dawn_strike 15 · starve_you 10 · d10_grab 8 · dawn_mob 7 · d1_night_storage 6 · trip_a2_stockroom 4 · called_up 4 · d9_inspection 4
- h_cautious 원인 사건: starve_you 15 · dawn_strike 14 · dawn_mob 10 · called_up 8 · d10_grab 3 · d10_hold 3
- h_cautious2 원인 사건: dawn_strike 27 · d5_flood 23 · dawn_mob 23 · called_up 18 · starve_you 18 · d10_grab 7 · d4_spanner 6 · d2_shutter_arm 5
- h_mixed 원인 사건: pro_stairs 41 · called_up 22 · dawn_mob 21 · starve_you 17 · dawn_strike 14 · d8_patrol_return 6 · d10_grab 6 · d10_hold 3

### 정체 묶음 평균 (A3 분석 §5: 성향 봇 8종 · 사람 흉내 5종, 블록 합산)
| 묶음 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| 성향 봇 (balanced·selfish·devoted·silent·caller·steward·counter·child) | 17.3 | 12.6 | 15.8 | 20.9 | 13.6 | 6.8 | 13.2 |
| 사람 흉내 (h_random·h_wary·h_cautious·h_cautious2·h_mixed) | 6.4 | 11.5 | 4.9 | 34.9 | 10.4 | 24.8 | 7.2 |

## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±5%p 밖 / △ 블록마다 다르거나 ±5%p 안, 확정 안 함 / ✗ 모든 블록 미달)
정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).
| 항목 | 합격선 | 실측 시드 8001~8200 | 합산 | 판정 | 2026-10-26 |
|---|---|---|---|---|---|
| 당신 사망(올라감 포함) | ≥ 50% | 63% | 63% | ✓ | 54.5% (합산) [△] |
| 사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음) | 100% | 100% (형식 기준 100%) | 100% (형식 기준 100%) | △ | 100% (형식 기준 100%) (합산) [△] |
| 강제 사망 = 확정 사망 (고를 때 열린 선택지 전부 살 확률 0, 전 정책 합산) | 0 판 (10-24 tightrope R1: 살 확률 > 0 인 주사위는 강제가 아니다) | 0 판 (0%, 0/2853) | 0 판 (0%, 0/2853) | ✓ | 0 판 (0%, 0/8212) (합산) [✓] |
|   강제 사망 중 앞선 자유 경고 선택 없음 (전 정책) | 0 판 | 0 판 | 0 판 | ✓ | 0 판 (합산) [✓] |
|   참고: 위험 0 출구가 없던 죽음 (옛 강제 정의 — 카르마 판의 줄타기는 일부러 그렇다, 전 정책) | 측정 | 1397 판 (그중 줄타기 판정 1263) | 1397 판 (그중 줄타기 판정 1263) | ✓ | — |
| 조심형 봇 사망 (balanced·silent·lazy·diligent·steward·selfish_nb 합산) | 측정 | 64.7% (776/1200), 그중 강제 0% | 64.7% (776/1200), 그중 강제 0% | ✓ | 49.3% (2761/5600), 그중 강제 0% (합산) [✓] (옛 묶음 balanced·selfish·silent·lazy·diligent·steward·selfish_nb 합산) |
|   봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음 | 0 판 | 1 판 (전 정책 404) | 1 판 (전 정책 404) | ✗ | 534 판 (전 정책 3463) (합산) [✗] |
|   참고: 몸 꺼림 정책(selfish·selfish_rt)의 같은 죽음 — 조심형이 아니다(10-24 검증) | 측정 | selfish 1 · selfish_rt 23 판 | selfish 1 · selfish_rt 23 판 | ✓ | — |
| 전멸 | ≤ 25% | 12.5% | 12.5% | ✓ | 10.4% (합산) [✓] |
| 밤 사건 수 / 판 (주민 사건만 — 시계·방치 판정 줄 뺌) | ≥ 6 | 13.84 (방치 판정 줄 6.53) | 13.84 (방치 판정 줄 6.53) | ✓ | 13.45 (방치 판정 줄 7.31) (합산) [✓] |
|   그중 malice / hymn | ≥ 2 / ≥ 1 | 5.69 / 3.47 | 5.69 / 3.47 | ✓ | 6.08 / 3.62 (합산) [✓] |
| 발견율 (보통) | 측정만 (10-24 A4: 하한 폐기) | 69.9% | 69.9% | ✓ | 78.7% (합산) [✓] |
| 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 47.3% | 47.3% | ✓ | 55.1% (합산) [✓] |
| 끝까지 모르는 사건 ≥1 (게으름) | 100% 판 | 95% | 95% | △ | 95.5% (합산) [△] |
| 찬가 발견율 (부지런) | ≥ 70% | 99.9% | 99.9% | ✓ | 100% (합산) [✓] |
| 찬가 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 77.2% | 77.2% | ✓ | 75.1% (합산) [✓] |
| 정체 — 성향 봇 평균, 각 후보 (A3) | 각 ≥ 3% | platform_one 6.8 · conductor 12.6 · passenger 20.9 · counting_child 13.2 · driver 17.3 · counted 13.6 · inspector 15.8 (8종) | platform_one 6.8 · conductor 12.6 · passenger 20.9 · counting_child 13.2 · driver 17.3 · counted 13.6 · inspector 15.8 (8종) | ✓ | platform_one 7.8 · counting_child 13.3 · conductor 12.9 · passenger 20.2 · counted 13.4 · driver 16.4 · inspector 16.1 (8종) (합산) [✓] |
| 정체 — 성향 봇 평균, 가장 큰 후보 (A3) | ≤ 40% | passenger 20.9% | passenger 20.9% | ✓ | passenger 20.2% (합산) [✓] |
| 정체 — 사람 흉내 평균, 각 후보 (A3, 프롤로그 사망 판 뺌) | 각 ≥ 3% | driver 6.4 · counting_child 7.2 · passenger 34.9 · counted 10.4 · platform_one 24.8 · inspector 4.9 · conductor 11.5 (5종) | driver 6.4 · counting_child 7.2 · passenger 34.9 · counted 10.4 · platform_one 24.8 · inspector 4.9 · conductor 11.5 (5종) | ✓ | — |
| 정체 — 사람 흉내 평균, 가장 큰 후보 (A3, 프롤로그 사망 판 뺌) | 측정 (디렉터 확인: 승객이 가장 흔한 결말) | passenger 34.9% | passenger 34.9% | ✓ | — |
|   참고: 사람 흉내 평균 (옛 방식 — 프롤로그 사망 포함) · 프롤로그(D0) 사망 판 비율 | 측정 | platform_one 26.7 · driver 3.7 · counting_child 4.5 · passenger 46.5 · counted 6.1 · inspector 3.1 · conductor 9.4 · 가장 큰 passenger 46.5% ‖ D0 사망 h_random 46% · h_wary 46% · h_cautious 0% · h_cautious2 0% · h_mixed 20.5% | platform_one 26.7 · driver 3.7 · counting_child 4.5 · passenger 46.5 · counted 6.1 · inspector 3.1 · conductor 9.4 · 가장 큰 passenger 46.5% ‖ D0 사망 h_random 46% · h_wary 46% · h_cautious 0% · h_cautious2 0% · h_mixed 20.5% | ✓ | counting_child 4.5 · passenger 49.9 · counted 8.4 · platform_one 27.8 · inspector 1.4 · driver 1.8 · conductor 6.3 (5종) (합산) [✗] |
| 정체 분포 (옛 방식: 정책 전체 평균, 각 후보) | 측정 (옛 합격선 ≥ 7.1%) | platform_one 14.9% · conductor 13% · passenger 38.4% · counting_child 7% · driver 10.9% · counted 8.6% · inspector 7.1% | platform_one 14.9% · conductor 13% · passenger 38.4% · counting_child 7% · driver 10.9% · counted 8.6% · inspector 7.1% | ✓ | platform_one 16.1% · counting_child 7.6% · conductor 11% · passenger 38.7% · counted 10.4% · driver 9.4% · inspector 6.8% (합산) [✓] |
|   옛 방식: 7후보 중 ≥7% 인 후보 수 | 측정 (옛 합격선 ≥ 5) | 7 후보 | 7 후보 | ✓ | 6 후보 (합산) [✓] |
| explicit 사건 / 판 | ≥ 7 | 10.15 | 10.15 | ✓ | 10.06 (합산) [✓] |
| 하루 결정 수 | ≥ 5 | 23.25 | 23.25 | ✓ | 22.55 (합산) [✓] |
| 명부 사인 빈칸 비율 | 측정만 | 61.8% | 61.8% | ✓ | 64.9% (합산) [✓] |
| 모험 봇 열흘 생존 | ≥ 25% (10-24 바꿈 ≥40 → 25, 디렉터 확인) | 30.5% | 30.5% | ✓ | 24.4% (합산) [△] |
| 모험 봇 사망 중 굶주림 | < 50% | 0% | 0% | ✓ | 0% (합산) [✓] |
| 열차 결말 도달 (모험 / 균형) | > 0% | 12.5% / 0% | 12.5% / 0% | ✓ | 7.6% / 0% (합산) [✓] |
| A2 D5까지 당신 사망 (균형) | ≥ 10% | 27% | 27% | ✓ | 20.1% (합산) [✓] |
| A2 균형 사망 중 한 사건 비중 (사인 사건) | ≤ 40% | d5_flood 28.6% | d5_flood 28.6% | ✓ | fever_night 39.9% (합산) [△] |
| A2 균형 사망 중 한 사건 비중 (원인 사건 = 부상 출처) | ≤ 40% | d5_flood 28.6% | d5_flood 28.6% | ✓ | starve_you 41.1% (합산) [△] |
| A2 D2·D4·D5 날마다 그날 사건으로 죽은 판 (조심형 합산 — 신중한 플레이어, 깔때기 사건 뺌) | 날마다 > 0 | D2 49 · D4 24 · D5 177 | D2 49 · D4 24 · D5 177 | ✓ | D2 389 · D3 105 · D4 526 · D5 1157 · D6 557 (합산) [✓] |
|   A2 D3·D6 그날 사건으로 죽은 판 (조심형 합산 — D3 규칙을 배우는 날 · D6 값을 치르면 사는 날, 10-24 디렉터) | 측정 | D3 0 · D6 13 | D3 0 · D6 13 | ✓ | — |
|   참고: 같은 값 — 성향 봇 8종 / 사람 흉내(h_random 뺌) / 전 정책 합산(옛 줄) | 측정 | 성향 D2 58 · D3 0 · D4 82 · D5 239 · D6 62 ‖ 사람 D2 4 · D3 0 · D4 6 · D5 37 · D6 60 ‖ 전 D2 106 · D3 30 · D4 136 · D5 459 · D6 270 | 성향 D2 58 · D3 0 · D4 82 · D5 239 · D6 62 ‖ 사람 D2 4 · D3 0 · D4 6 · D5 37 · D6 60 ‖ 전 D2 106 · D3 30 · D4 136 · D5 459 · D6 270 | ✓ | D2 389 · D3 105 · D4 526 · D5 1157 · D6 557 (합산) [✓] |
| A1 이른 안전: D1~D4 생존 − 균형 (버릇 없는 이기적 각각) | ≥ +5%p | selfish_nb +6.5 / selfish_rt0 +6.5%p (균형 92.5) | selfish_nb +6.5 / selfish_rt0 +6.5%p (균형 92.5) | △ | +8.7%p (99.8 vs 91.1) (합산) [△] |
| A1 이기심의 값: 열흘 생존 − 균형 (버릇 없는 이기적 각각 — selfish_nb·selfish_rt0) | < 0 (모든 정책) | selfish_nb -4 / selfish_rt0 -29%p | selfish_nb -4 / selfish_rt0 -29%p | △ | selfish -2.6 / selfish_nb +44.1 / selfish_rt -35.1 / selfish_rt0 -14.7%p (합산) [✗] |
|   참고: 몸 꺼림 버릇이 있는 이기적(selfish·selfish_rt) 열흘 생존 − 균형 — 이기심의 값이 아니다(10-24 검증 A1) | 측정 | selfish -6.5 / selfish_rt -31.5%p | selfish -6.5 / selfish_rt -31.5%p | ✓ | — |
| A1 이기적 사인 쏠림 (버릇 없는 이기적, 사망 ≥ 10%인 정책만) | ≤ 60% | selfish_nb called_up 29.1% / selfish_rt0 dawn_mob 37.5% | selfish_nb called_up 29.1% / selfish_rt0 dawn_mob 37.5% | ✓ | selfish called_up 67% / selfish_nb dawn_strike 88% / selfish_rt dawn_mob 39.1% / selfish_rt0 dawn_mob 60.1% (합산) [✗] |
|   참고: 몸 꺼림 이기적 사인 쏠림 | 측정 | selfish called_up 41% / selfish_rt dawn_mob 33.9% | selfish called_up 41% / selfish_rt dawn_mob 33.9% | ✓ | — |
|   카르마 (판 끝 평균: 균형 / 이기적 4종) | 측정 | 2.14 / 9.63 · 10.48 · 13.89 · 13.85 | 2.14 / 9.63 · 10.48 · 13.89 · 13.85 | ✓ | 2.33 / 11.94 · 14.58 · 15.78 · 16.08 (합산) [✓] |
| A1 아슬함: 줄타기 판정 넘김/판 (열흘 산 판, selfish_nb) | ≥ 2 | 5.47 (산 판 66 · 전체 판 3.9) | 5.47 (산 판 66 · 전체 판 3.9) | ✓ | — |
| A1 아슬함: 산 판 중 줄타기 판정 ≥ 2번 넘김 (selfish_nb) | ≥ 60% | 81.8% | 81.8% | ✓ | — |
|   죽음 판정 넘김/판 (산 판 — 당신을 죽이는 모든 판정) | 측정 | balanced 3.78 · lazy 4.83 · selfish_nb 5.88 | balanced 3.78 · lazy 4.83 · selfish_nb 5.88 | ✓ | — |
|   줄타기 판정 굴림/판 (그중 줄타기로 죽은 판) | 측정 | balanced 0.61 (23판) · lazy 1.35 (37판) · selfish_nb 4.49 (118판) | balanced 0.61 (23판) · lazy 1.35 (37판) · selfish_nb 4.49 (118판) | ✓ | — |
| A4 게으름의 값 — 생존 (보통−게으름 주 지표 / 부지런−게으름) | ≥ +5%p | 보통−게으름 +10.5 / 부지런−게으름 +12.5%p | 보통−게으름 +10.5 / 부지런−게으름 +12.5%p | ✓ | 보통−게으름 +6 / 부지런−게으름 +7.8%p (합산) [△] |
| A4 게으름의 값 — D9 아침 주민 수 차 | > 0 | 보통−게으름 -0.06 / 부지런−게으름 +0.09 | 보통−게으름 -0.06 / 부지런−게으름 +0.09 | ✗ | 보통−게으름 +0.2 / 부지런−게으름 +0.3 (합산) [✓] |
| A4 게으름의 값 — D7 아침 식량+물+약 차 | ≥ +0.2 | 보통−게으름 +0.48 / 부지런−게으름 +0.47 | 보통−게으름 +0.48 / 부지런−게으름 +0.47 | ✓ | 보통−게으름 +0.1 / 부지런−게으름 +0.4 (합산) [△] |
|   못 본 일(missed 적용) / 판 (게으름 / 보통 / 부지런) | 측정 | 4.31 / 2.32 / 0.44 | 4.31 / 2.32 / 0.44 | ✓ | 4.4 / 2.16 / 0.03 (합산) [✓] |
|   A4 측정: 실제 발견율 — 누구나 아는 밤 뺌 (게으름 / 보통 / 부지런) | 측정 | 31.2% / 62.1% / 94.5% (옛 발견율 47.3% / 69.9% / 95.4%) | 31.2% / 62.1% / 94.5% (옛 발견율 47.3% / 69.9% / 95.4%) | ✓ | — |
|   A4 측정: 누구나 아는 밤/판 · 숨은 밤/판 (게으름 / 보통 / 부지런) | 측정 | 3.42 / 2.83 / 2.13 · 11.2 / 11.01 / 10.88 | 3.42 / 2.83 / 2.13 · 11.2 / 11.01 / 10.88 | ✓ | — |
|   A4 측정: 눈먼 새벽/판 · 그 죽음 판 (게으름 / 보통 / 부지런) | 측정 | 1.04 / 0.32 / 0 · 34 / 16 / 0 | 1.04 / 0.32 / 0 · 34 / 16 / 0 | ✓ | — |
|   위기 때 값 길(비용 있는 선택)이 열린 비율 (균형) | 측정 (디렉터 확인) | d2_shutter_arm 7.1% (5/70) · d4_spanner 42% (42/100) · d5_flood 15.3% (28/183) | d2_shutter_arm 7.1% (5/70) · d4_spanner 42% (42/100) · d5_flood 15.3% (28/183) | ✓ | d2_shutter_arm 9.7% (28/290) · d4_spanner 44.6% (173/388) · d5_flood 40.9% (298/729) (합산) [✓] |
| 헌신 봇 생존 | 측정 (> 0%) | 20% | 20% | ✓ | 23.8% (합산) [✓] |
| 사망 원인 중 굶주림 (전 정책 합산) | < 50% | 2.9% (83/2853) | 2.9% (83/2853) | ✓ | 1.4% (119/8212) (합산) [✓] |
| 경고 없는 사망 (전 정책 합산, 강제 사망 포함) | 0 판 | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | ✓ | 0 판 (그중 강제 0) (합산) [✓] |

<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->
