# 봇 보고서 — 정책 20 × 100판 × 시드 블록 4 (2026-10-24)

데이터: v4/data (밤 사건 53, 사건 128, 후보 7). 시드 블록: 시드 1~100, 시드 1001~1100, 시드 2001~2100, 시드 3001~3100. 걸린 시간 161.1초. 규칙·데이터는 손대지 않았다.

## 1. 정책별 표 (블록 4개를 합친 400판)
| 정책 | 생존% | 사망% | 굶주림비중% | 실질경고% | 강제% | 열차% | 전멸% | 밤사건 | 시계 | malice | hymn | 발견% | 모름≥1% | 찬가발견% | explicit | 결정/일 | 빈칸% | 원정 | 날 | 굶주림 | D3셈% | 함께센다% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 46 | 54 | 0 | 100 | 0 | 0 | 12 | 13.19 | 12.64 | 5.97 | 3.61 | 79.2 | 87.8 | 93.5 | 9.92 | 22.93 | 65.2 | 5 | 8.22 | 6.46 | 95 | 0 |
| selfish | 41.3 | 58.8 | 0 | 100 | 0 | 0 | 11.5 | 20.34 | 14.13 | 12.98 | 3.82 | 74.7 | 99.3 | 91.7 | 10.44 | 20.38 | 66.6 | 7.31 | 8.66 | 4.68 | 100 | 0 |
| devoted | 20.5 | 79.5 | 0 | 100 | 0 | 3 | 0.5 | 9.64 | 10.07 | 3.58 | 3.31 | 76.3 | 80.8 | 93.6 | 8.81 | 26.21 | 24.7 | 3.58 | 6.75 | 6.57 | 93 | 0 |
| silent | 48.8 | 51.3 | 0 | 100 | 0 | 0 | 11 | 13.61 | 12.88 | 6.03 | 3.67 | 78.3 | 92 | 93.7 | 10.17 | 22.3 | 65.6 | 5.06 | 8.44 | 6.56 | 96.3 | 0 |
| caller | 41.5 | 58.5 | 0 | 100 | 0 | 0 | 11.5 | 12.65 | 12.6 | 5.42 | 3.54 | 78.6 | 88.8 | 93.7 | 9.75 | 23.18 | 61.7 | 4.94 | 8.03 | 6.46 | 95.8 | 0 |
| lazy | 39 | 61 | 0 | 100 | 0 | 0 | 10 | 13.54 | 12.54 | 6.45 | 3.51 | 55.1 | 94.5 | 74.3 | 10.1 | 19.63 | 100 | 4.8 | 8.21 | 6.48 | 95 | 0 |
| diligent | 47 | 53 | 0 | 100 | 0 | 0 | 11.5 | 13.48 | 13.22 | 5.82 | 3.68 | 99.7 | 4.3 | 100 | 10.99 | 71.27 | 29.6 | 5.12 | 8.5 | 6.65 | 96.3 | 0 |
| risky | 26.5 | 73.5 | 0 | 100 | 0 | 7.3 | 2.5 | 14.07 | 10.89 | 5.38 | 4.99 | 73.3 | 89 | 89.4 | 10.92 | 28.83 | 62.2 | 6.69 | 7.12 | 5.71 | 94 | 0 |
| steward | 41.5 | 58.5 | 0 | 100 | 0 | 0 | 9.3 | 12.83 | 12.71 | 5.32 | 3.7 | 76.4 | 89.8 | 94.4 | 9.47 | 23.18 | 27.1 | 5.11 | 8.31 | 6.94 | 93 | 0 |
| counter | 36 | 64 | 0 | 100 | 0 | 7.5 | 6.8 | 15.98 | 11.37 | 9.35 | 3.24 | 77.8 | 87.3 | 95.3 | 9.56 | 24.6 | 61.4 | 3.89 | 7.49 | 5.2 | 94.8 | 0 |
| child | 67.3 | 32.8 | 0 | 100 | 0 | 0 | 26.5 | 19.87 | 13.7 | 11.98 | 3.58 | 75 | 98 | 91.7 | 11.44 | 20.56 | 67.9 | 6.26 | 8.86 | 4.58 | 98.8 | 0 |
| selfish_nb | 90 | 10 | 0 | 100 | 0 | 0 | 24.5 | 22.34 | 15.67 | 13.85 | 4.07 | 78.1 | 99.3 | 92 | 12.72 | 19.26 | 72.3 | 6.83 | 9.78 | 4.84 | 100 | 0 |
| selfish_rt | 10 | 90 | 0 | 100 | 0 | 0 | 8.3 | 16.78 | 11.4 | 10.62 | 3.29 | 71.7 | 100 | 90.1 | 8.8 | 22.06 | 62.4 | 6.42 | 7.23 | 4 | 100 | 0 |
| selfish_rt0 | 28 | 72 | 0 | 100 | 0 | 0 | 17.8 | 18.3 | 12.18 | 11.56 | 3.47 | 74.1 | 100 | 90.5 | 9.81 | 21.12 | 66.1 | 6.46 | 7.88 | 4.1 | 100 | 0 |
| h_random | 0 | 100 | 12 | 100 | 0 | 0 | 0 | 3.73 | 3.02 | 1.71 | 1.26 | 75.1 | 33.3 | 93.7 | 3.72 | 33.21 | 61.6 | 1.95 | 2.42 | 4.84 | 44.3 | 50.3 |
| h_wary | 44.5 | 55.5 | 0 | 100 | 0 | 3 | 9 | 10.71 | 7.21 | 5.81 | 2.34 | 75.6 | 49.8 | 91.8 | 7.8 | 27.73 | 65.2 | 2.47 | 4.84 | 6.68 | 49.8 | 0 |
| h_first | 100 | 0 | - | - | - | 10.3 | 6.3 | 18.23 | 14.29 | 8.2 | 5.58 | 77.5 | 99.3 | 89.6 | 13.23 | 19.49 | 66.4 | 4.89 | 9.99 | 7.27 | 100 | 0 |
| h_cautious | 100 | 0 | - | - | - | 0 | 48.3 | 18.78 | 15.82 | 8.5 | 4.67 | 77.2 | 98.3 | 91.2 | 12.87 | 19.45 | 63.6 | 6.26 | 9.8 | 7.27 | 100 | 0 |
| h_cautious2 | 63.8 | 36.3 | 0 | 100 | 0 | 2 | 20.5 | 15.77 | 14.12 | 6.98 | 4.26 | 78.6 | 94.5 | 91.9 | 11.43 | 21.15 | 63.5 | 5.77 | 8.96 | 6.77 | 98.8 | 0 |
| h_mixed | 78.8 | 21.3 | 0 | 100 | 0 | 0.3 | 28.3 | 16.91 | 12.06 | 8.83 | 3.77 | 75.3 | 81.3 | 91.8 | 11.76 | 22.71 | 64.4 | 4.85 | 8.02 | 6.96 | 81.3 | 0 |

굶주림 = 아침마다 잰 당신 굶주림의 판 평균(10-24 추가) · D3셈% = D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 · 함께센다% = 그중 '함께 센다'를 고른 비율. 아침 조사는 칸 단위(10-24 P0-E2: 그 칸의 물건 전부, 조사 수 = 칸 수).

정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대) / steward 몫+손−이름+(정체 inspector 쪽 성향, 10-23 추가). 조심형(합격선 따로 집계) = balanced·selfish·silent·lazy·diligent·steward·selfish_nb.
- balanced 사망 원인: fever_night 87 · d5_flood 46 · d10_walk_weak 44 · d2_shutter_arm 20 · d4_spanner 19
- selfish 사망 원인: called_up 157 · dawn_strike 70 · d10_hold 8 [평범한 대안 두고 죽음 글 선택 235]
- devoted 사망 원인: fever_night 136 · d5_flood 71 · d4_spanner 35 · d2_shutter_arm 28 · d10_walk_weak 27 · d6_shutter_b 16 · dawn_strike 5 [평범한 대안 두고 죽음 글 선택 120]
- silent 사망 원인: fever_night 74 · d10_walk_weak 55 · d5_flood 49 · d2_shutter_arm 15 · d4_spanner 12
- caller 사망 원인: fever_night 81 · d10_walk_weak 54 · d5_flood 53 · d4_spanner 24 · d2_shutter_arm 17 · dawn_strike 5 [평범한 대안 두고 죽음 글 선택 56]
- lazy 사망 원인: fever_night 87 · d10_walk_weak 70 · d5_flood 44 · d4_spanner 23 · d2_shutter_arm 20
- diligent 사망 원인: fever_night 78 · d10_walk_weak 65 · d5_flood 36 · d4_spanner 18 · d2_shutter_arm 15
- risky 사망 원인: d5_flood 69 · fever_night 68 · dawn_strike 41 · d4_spanner 36 · called_up 26 · d10_walk_weak 24 · d2_shutter_arm 24 · d6_shutter 6 [평범한 대안 두고 죽음 글 선택 262]
- steward 사망 원인: fever_night 92 · d10_walk_weak 64 · d5_flood 48 · d2_shutter_arm 28 · dawn_strike 2 [평범한 대안 두고 죽음 글 선택 2]
- counter 사망 원인: fever_night 79 · d4_spanner 52 · d5_flood 41 · d10_walk_weak 39 · dawn_strike 28 · d2_shutter_arm 17 [평범한 대안 두고 죽음 글 선택 87]
- child 사망 원인: dawn_strike 88 · d5_flood 28 · fever_night 15 [평범한 대안 두고 죽음 글 선택 123]
- selfish_nb 사망 원인: dawn_strike 36 · fever_night 4 [평범한 대안 두고 죽음 글 선택 36]
- selfish_rt 사망 원인: dawn_mob 156 · called_up 124 · dawn_strike 80 [평범한 대안 두고 죽음 글 선택 360]
- selfish_rt0 사망 원인: dawn_mob 178 · dawn_strike 110 [평범한 대안 두고 죽음 글 선택 288]
- h_random 사망 원인: pro_stairs 201 · starve_you 48 · d3_called_you 44 · dawn_mob 21 · d2_night_shutter 19 · called_up 15 · fever_night 13 · d4_spanner 9 · dawn_strike 8 · d5_flood 6 · d6_shutter 5 · d8_patrol_return 4 · d6_shutter_b 3 · d2_shutter_arm 2 · d10_walk_weak 1 · d10_walk 1 [평범한 대안 두고 죽음 글 선택 181]
- h_wary 사망 원인: pro_stairs 201 · d8_patrol_return 21
- h_first 사망 원인: 없음
- h_cautious 사망 원인: 없음
- h_cautious2 사망 원인: fever_night 71 · d10_walk_weak 31 · d5_flood 27 · d4_spanner 11 · d2_shutter_arm 5
- h_mixed 사망 원인: pro_stairs 75 · d8_patrol_return 10

강제 = 그 순간 당신이 죽지 않는 열린 선택지가 0개였던 죽음(선택지 하나뿐, 나머지가 잠긴 주사위). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택). 실질경고% = 사망 중 '경고 글이 있고 강제가 아닌' 선택으로 죽은 비율(10-22 리드 결정: 강제 사망은 경고 있음으로 세지 않는다). 둘 다 엔진의 사인 기록(ended.cause.forced·free)에서 읽는다.

### 블록별 (생존% / 사망% / 열차% / 강제%)
| 정책 | 시드 1~100 | 시드 1001~1100 | 시드 2001~2100 | 시드 3001~3100 |
|---|---|---|---|---|
| balanced | 47 / 53 / 0 / 0 | 41 / 59 / 0 / 0 | 47 / 53 / 0 / 0 | 49 / 51 / 0 / 0 |
| selfish | 44 / 56 / 0 / 0 | 40 / 60 / 0 / 0 | 37 / 63 / 0 / 0 | 44 / 56 / 0 / 0 |
| devoted | 20 / 80 / 2 / 0 | 18 / 82 / 2 / 0 | 22 / 78 / 3 / 0 | 22 / 78 / 5 / 0 |
| silent | 43 / 57 / 0 / 0 | 50 / 50 / 0 / 0 | 59 / 41 / 0 / 0 | 43 / 57 / 0 / 0 |
| caller | 41 / 59 / 0 / 0 | 36 / 64 / 0 / 0 | 45 / 55 / 0 / 0 | 44 / 56 / 0 / 0 |
| lazy | 39 / 61 / 0 / 0 | 43 / 57 / 0 / 0 | 39 / 61 / 0 / 0 | 35 / 65 / 0 / 0 |
| diligent | 46 / 54 / 0 / 0 | 48 / 52 / 0 / 0 | 47 / 53 / 0 / 0 | 47 / 53 / 0 / 0 |
| risky | 34 / 66 / 10 / 0 | 22 / 78 / 8 / 0 | 24 / 76 / 3 / 0 | 26 / 74 / 8 / 0 |
| steward | 43 / 57 / 0 / 0 | 43 / 57 / 0 / 0 | 38 / 62 / 0 / 0 | 42 / 58 / 0 / 0 |
| counter | 41 / 59 / 10 / 0 | 34 / 66 / 4 / 0 | 32 / 68 / 9 / 0 | 37 / 63 / 7 / 0 |
| child | 64 / 36 / 0 / 0 | 68 / 32 / 0 / 0 | 66 / 34 / 0 / 0 | 71 / 29 / 0 / 0 |
| selfish_nb | 91 / 9 / 0 / 0 | 85 / 15 / 0 / 0 | 93 / 7 / 0 / 0 | 91 / 9 / 0 / 0 |
| selfish_rt | 10 / 90 / 0 / 0 | 9 / 91 / 0 / 0 | 16 / 84 / 0 / 0 | 5 / 95 / 0 / 0 |
| selfish_rt0 | 29 / 71 / 0 / 0 | 25 / 75 / 0 / 0 | 33 / 67 / 0 / 0 | 25 / 75 / 0 / 0 |
| h_random | 0 / 100 / 0 / 0 | 0 / 100 / 0 / 0 | 0 / 100 / 0 / 0 | 0 / 100 / 0 / 0 |
| h_wary | 40 / 60 / 2 / 0 | 37 / 63 / 3 / 0 | 49 / 51 / 4 / 0 | 52 / 48 / 3 / 0 |
| h_first | 100 / 0 / 5 / - | 100 / 0 / 13 / - | 100 / 0 / 11 / - | 100 / 0 / 12 / - |
| h_cautious | 100 / 0 / 0 / - | 100 / 0 / 0 / - | 100 / 0 / 0 / - | 100 / 0 / 0 / - |
| h_cautious2 | 61 / 39 / 0 / 0 | 63 / 37 / 3 / 0 | 63 / 37 / 3 / 0 | 68 / 32 / 2 / 0 |
| h_mixed | 75 / 25 / 0 / 0 | 80 / 20 / 1 / 0 | 82 / 18 / 0 / 0 | 78 / 22 / 0 / 0 |

### 정책별 비교 (생존% / 사망% / 열차%)
| 정책 | 지금 | data_before_100 |
|---|---|---|
| balanced | 46 / 54 / 0 | 54.8 / 45.3 / 0 |
| selfish | 41.3 / 58.8 / 0 | 98.8 / 1.3 / 0 |
| devoted | 20.5 / 79.5 / 3 | 40.5 / 59.5 / 0.3 |
| silent | 48.8 / 51.3 / 0 | 56.5 / 43.5 / 0 |
| caller | 41.5 / 58.5 / 0 | 49.3 / 50.8 / 0 |
| lazy | 39 / 61 / 0 | 52.3 / 47.8 / 0 |
| diligent | 47 / 53 / 0 | 58.3 / 41.8 / 0 |
| risky | 26.5 / 73.5 / 7.3 | 48.8 / 51.3 / 12.8 |
| steward | 41.5 / 58.5 / 0 | 58.3 / 41.8 / 0 |
| counter | 36 / 64 / 7.5 | 52.8 / 47.3 / 6 |
| child | 67.3 / 32.8 / 0 | 92.3 / 7.8 / 0 |
| selfish_nb | 90 / 10 / 0 | 98.8 / 1.3 / 0 |
| selfish_rt | 10 / 90 / 0 | 100 / 0 / 0 |
| selfish_rt0 | 28 / 72 / 0 | 100 / 0 / 0 |
| h_random | 0 / 100 / 0 | 4.5 / 95.5 / 0.3 |
| h_wary | 44.5 / 55.5 / 3 | 49.5 / 50.5 / 3.3 |
| h_first | 100 / 0 / 10.3 | 100 / 0 / 28.5 |
| h_cautious | 100 / 0 / 0 | 75 / 25 / 0 |
| h_cautious2 | 63.8 / 36.3 / 2 | 64.8 / 35.3 / 0.8 |
| h_mixed | 78.8 / 21.3 / 0.3 | 70.8 / 29.3 / 0.5 |

### 정체 분포 (정책별 %)
| 정책 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| balanced | 0.5 | 37.8 | 0 | 31.3 | 0.3 | 28 | 2.3 |
| selfish | 0 | 0 | 0 | 99.5 | 0 | 0 | 0.5 |
| devoted | 70.3 | 29.8 | 0 | 0 | 0 | 0 | 0 |
| silent | 0 | 36.5 | 0 | 33.8 | 0 | 29.8 | 0 |
| caller | 60.3 | 0 | 31.5 | 0 | 6.3 | 0 | 2 |
| lazy | 0.8 | 36.3 | 0.5 | 35 | 0.5 | 24.8 | 2.3 |
| diligent | 0.3 | 31 | 0 | 33.5 | 0 | 33 | 2.3 |
| risky | 1 | 14.5 | 0 | 13.8 | 4.3 | 63.5 | 3 |
| steward | 3 | 0 | 97 | 0 | 0 | 0 | 0 |
| counter | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| child | 0 | 0 | 0 | 0 | 0 | 0 | 100 |
| selfish_nb | 0 | 0 | 0 | 98.8 | 0 | 0 | 1.3 |
| selfish_rt | 0 | 0 | 0 | 90 | 0 | 0 | 10 |
| selfish_rt0 | 0 | 0 | 0 | 95.5 | 0 | 0 | 4.5 |
| h_random | 4.3 | 2 | 6 | 39.5 | 16.8 | 21.5 | 10 |
| h_wary | 1.3 | 1.8 | 0 | 39.3 | 18.3 | 37.5 | 2 |
| h_first | 43.3 | 0.3 | 0.5 | 0 | 55.5 | 0.5 | 0 |
| h_cautious | 0.3 | 4.3 | 0 | 82 | 0 | 12.3 | 1.3 |
| h_cautious2 | 0 | 20 | 0 | 41 | 0 | 37.8 | 1.3 |
| h_mixed | 1 | 3.3 | 2.3 | 54 | 5.8 | 29.8 | 4 |

### 당신 사망 원인 (balanced, 판 수)
- fever_night: 87
- d5_flood: 46
- d10_walk_weak: 44
- d2_shutter_arm: 20
- d4_spanner: 19

### 날별 당신 사망 (판 수, 400판 중 · 괄호 = 그날 사건으로 죽은 판, 깔때기 사건(열병·새벽 위독 등) 뺌)
| 정책 | D0 | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 0 | 0 | 20 (20) | 0 | 23 (19) | 48 (46) | 10 (0) | 14 (0) | 22 (0) | 35 (0) | 44 (0) |
| selfish | 0 | 0 | 0 | 0 | 1 (1) | 2 (2) | 6 (6) | 112 (112) | 55 (55) | 47 (47) | 12 (12) |
| devoted | 0 | 0 | 28 (28) | 3 (0) | 52 (35) | 85 (71) | 35 (17) | 31 (1) | 29 (1) | 27 (1) | 28 (1) |
| silent | 0 | 0 | 15 (15) | 0 | 14 (12) | 57 (49) | 6 (0) | 12 (0) | 13 (0) | 33 (0) | 55 (0) |
| caller | 0 | 0 | 17 (17) | 2 (0) | 24 (24) | 64 (54) | 9 (0) | 23 (2) | 17 (1) | 24 (1) | 54 (0) |
| lazy | 0 | 0 | 20 (20) | 0 | 24 (23) | 47 (44) | 9 (0) | 16 (0) | 29 (0) | 29 (0) | 70 (0) |
| diligent | 0 | 0 | 15 (15) | 0 | 19 (18) | 41 (36) | 9 (0) | 13 (0) | 20 (0) | 30 (0) | 65 (0) |
| risky | 0 | 0 | 24 (24) | 4 (0) | 41 (36) | 78 (71) | 19 (8) | 46 (34) | 31 (14) | 20 (8) | 31 (7) |
| steward | 0 | 0 | 28 (28) | 0 | 6 (0) | 52 (48) | 9 (0) | 7 (0) | 23 (1) | 45 (1) | 64 (0) |
| counter | 0 | 0 | 17 (17) | 6 (4) | 63 (56) | 50 (43) | 18 (4) | 24 (11) | 12 (0) | 26 (2) | 40 (1) |
| child | 0 | 0 | 0 | 5 (5) | 10 (10) | 32 (32) | 7 (6) | 32 (30) | 21 (14) | 16 (11) | 8 (8) |
| selfish_nb | 0 | 0 | 0 | 0 | 0 | 0 | 1 (1) | 9 (9) | 23 (19) | 4 (4) | 3 (3) |
| selfish_rt | 0 | 0 | 0 | 0 | 2 (2) | 2 (2) | 112 (112) | 161 (161) | 53 (53) | 24 (24) | 6 (6) |
| selfish_rt0 | 0 | 0 | 0 | 0 | 2 (2) | 2 (2) | 103 (103) | 96 (96) | 35 (35) | 29 (29) | 21 (21) |
| h_random | 201 (201) | 0 | 21 (21) | 47 (47) | 28 (25) | 25 (23) | 35 (33) | 19 (16) | 15 (12) | 7 (7) | 2 (1) |
| h_wary | 201 (201) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 21 (21) | 0 | 0 |
| h_first | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| h_cautious | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| h_cautious2 | 0 | 0 | 5 (5) | 0 | 11 (11) | 31 (27) | 9 (0) | 13 (0) | 16 (0) | 29 (0) | 31 (0) |
| h_mixed | 75 (75) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 (10) | 0 | 0 |

### A1·A2·A4 지표 (블록 합산)
| 정책 | 생존% | D1~D4 생존% | D5까지 사망% | 산 날 | 카르마(끝) | 못 본 일/판 | 방치 줄/판 | D9 주민 | D7 자원 | 사인 1위 | 원인 1위 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 46 | 89.3 | 22.8 | 8.22 | 2.26 | 2.08 | 7.12 | 3.18 | 2.54 | fever_night 40.3% | starve_you 38.9% |
| selfish | 41.3 | 99.8 | 0.8 | 8.66 | 11.93 | 2.04 | 7.71 | 2.84 | 5.76 | called_up 66.8% | called_up 66.8% |
| devoted | 20.5 | 79.3 | 42 | 6.75 | 0 | 1.62 | 5.32 | 4.14 | 1.87 | fever_night 42.8% | d5_flood 22.3% |
| silent | 48.8 | 92.8 | 21.5 | 8.44 | 2.37 | 2.26 | 7.28 | 3.25 | 2.71 | fever_night 36.1% | starve_you 42.4% |
| caller | 41.5 | 89.3 | 26.8 | 8.03 | 2.32 | 2.01 | 6.56 | 2.98 | 2.72 | fever_night 34.6% | starve_you 32.1% |
| lazy | 39 | 89 | 22.8 | 8.21 | 2.49 | 4.43 | 7.1 | 3.04 | 2.49 | fever_night 35.7% | starve_you 39.3% |
| diligent | 47 | 91.5 | 18.8 | 8.5 | 2.5 | 0.04 | 6.65 | 3.31 | 2.93 | fever_night 36.8% | starve_you 44.3% |
| risky | 26.5 | 82.8 | 36.8 | 7.12 | 4.73 | 1.95 | 4.63 | 3.52 | 9.72 | d5_flood 23.5% | d5_flood 23.5% |
| steward | 41.5 | 91.5 | 21.5 | 8.31 | 1.93 | 2.38 | 7.29 | 3.36 | 1.9 | fever_night 39.3% | starve_you 48.3% |
| counter | 36 | 78.5 | 34 | 7.49 | 10.15 | 1.86 | 6.19 | 3 | 4.13 | fever_night 30.9% | dawn_strike 21.5% |
| child | 67.3 | 96.3 | 11.8 | 8.86 | 14.33 | 2.53 | 7.82 | 2.7 | 6.95 | dawn_strike 67.2% | dawn_strike 67.9% |
| selfish_nb | 90 | 100 | 0 | 9.78 | 14.61 | 2.49 | 9.01 | 2.9 | 5.71 | dawn_strike 90% | dawn_strike 92.5% |
| selfish_rt | 10 | 99.5 | 1 | 7.23 | 15.64 | 1.52 | 5.55 | 1.84 | 7.32 | dawn_mob 43.3% | dawn_mob 43.3% |
| selfish_rt0 | 28 | 99.5 | 1 | 7.88 | 15.96 | 1.71 | 6.17 | 2.09 | 7.38 | dawn_mob 61.8% | dawn_mob 61.8% |
| h_random | 0 | 25.8 | 80.5 | 2.42 | 2.58 | 0.44 | 1.34 | 3.11 | 6 | pro_stairs 50.3% | pro_stairs 50.3% |
| h_wary | 44.5 | 49.8 | 50.3 | 4.84 | 8.57 | 1.57 | 4.1 | 3.24 | 3.88 | pro_stairs 90.5% | pro_stairs 90.5% |
| h_first | 100 | 100 | 0 | 9.99 | 6.38 | 2.76 | 8.49 | 4.08 | 3.41 | - | - |
| h_cautious | 100 | 100 | 0 | 9.8 | 9.01 | 3.16 | 8.33 | 2.43 | 4.05 | - | - |
| h_cautious2 | 63.8 | 96 | 11.8 | 8.96 | 5.1 | 2.51 | 7.86 | 2.91 | 2.76 | fever_night 49% | starve_you 49.7% |
| h_mixed | 78.8 | 81.3 | 18.8 | 8.02 | 11.33 | 2.47 | 6.79 | 2.86 | 4.19 | pro_stairs 88.2% | pro_stairs 88.2% |

원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.
- balanced 원인 사건: starve_you 84 · d5_flood 46 · d2_shutter_arm 34 · d4_spanner 19 · d7_rot 7 · d9_inspection 6 · patrol_pact 5 · dawn_mob 5
- selfish 원인 사건: called_up 157 · dawn_strike 70 · d10_hold 8
- devoted 원인 사건: d5_flood 71 · starve_you 60 · d2_shutter_arm 53 · d4_spanner 37 · patrol_pact 26 · d7_rot 23 · d6_shutter_b 16 · d5_rail_body 9
- silent 원인 사건: starve_you 87 · d5_flood 49 · d2_shutter_arm 28 · d4_spanner 12 · d7_rot 8 · dawn_strike 5 · patrol_pact 4 · dawn_mob 4
- caller 원인 사건: starve_you 75 · d5_flood 53 · d2_shutter_arm 35 · d4_spanner 24 · d7_rot 12 · d9_inspection 8 · dawn_strike 8 · d9_inspection_b 8
- lazy 원인 사건: starve_you 96 · d5_flood 44 · d2_shutter_arm 32 · d4_spanner 23 · dawn_strike 12 · d7_rot 8 · called_up 7 · d9_inspection 5
- diligent 원인 사건: starve_you 94 · d5_flood 36 · d2_shutter_arm 26 · d4_spanner 18 · d9_inspection 12 · d7_rot 9 · d1_night_storage 7 · dawn_mob 4
- risky 원인 사건: d5_flood 69 · dawn_strike 45 · d4_spanner 36 · d2_shutter_arm 30 · called_up 26 · starve_you 17 · dawn_mob 15 · trip_b2_pumproom 13
- steward 원인 사건: starve_you 113 · d5_flood 48 · d2_shutter_arm 45 · d9_inspection 11 · patrol_pact 7 · d9_inspection_b 5 · dawn_strike 5
- counter 원인 사건: dawn_strike 55 · d4_spanner 52 · d5_flood 41 · d2_shutter_arm 37 · dawn_mob 25 · starve_you 15 · called_up 10 · d1_night_storage 9
- child 원인 사건: dawn_strike 89 · d5_flood 28 · d1_night_storage 9 · dawn_mob 3 · called_up 2
- selfish_nb 원인 사건: dawn_strike 37 · d1_night_storage 2 · starve_you 1
- selfish_rt 원인 사건: dawn_mob 156 · called_up 124 · dawn_strike 80
- selfish_rt0 원인 사건: dawn_mob 178 · dawn_strike 110
- h_random 원인 사건: pro_stairs 201 · starve_you 51 · d3_called_you 44 · dawn_mob 22 · d2_night_shutter 19 · called_up 15 · dawn_strike 9 · d4_spanner 9
- h_wary 원인 사건: pro_stairs 201 · d8_patrol_return 21
- h_cautious2 원인 사건: starve_you 72 · d5_flood 27 · d4_spanner 13 · dawn_mob 7 · d2_shutter_arm 7 · d7_rot 7 · dawn_strike 4 · d9_inspection_b 2
- h_mixed 원인 사건: pro_stairs 75 · d8_patrol_return 10

### 정체 묶음 평균 (A3 분석 §5: 성향 봇 8종 · 사람 흉내 5종, 블록 합산)
| 묶음 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| 성향 봇 (balanced·selfish·devoted·silent·caller·steward·counter·child) | 16.8 | 13 | 16.1 | 20.6 | 13.3 | 7.2 | 13.1 |
| 사람 흉내 (h_random·h_wary·h_cautious·h_cautious2·h_mixed) | 1.4 | 6.3 | 1.7 | 51.2 | 8.2 | 27.8 | 3.7 |

## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±5%p 밖 / △ 블록마다 다르거나 ±5%p 안, 확정 안 함 / ✗ 모든 블록 미달)
정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).
| 항목 | 합격선 | 실측 시드 1~100 | 실측 시드 1001~1100 | 실측 시드 2001~2100 | 실측 시드 3001~3100 | 합산 | 판정 | data_before_100 |
|---|---|---|---|---|---|---|---|---|
| 당신 사망(올라감 포함) | ≥ 50% | 53% | 59% | 53% | 51% | 54% | △ | 51% |
| 사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음) | 100% | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | △ | 100% (형식 기준 100%) |
| 강제 사망 (전 정책 합산) | 0 판 (10-24 바꿈: ≤20% → 0) | 0 판 (0%, 0/1032) | 0 판 (0%, 0/1058) | 0 판 (0%, 0/1008) | 0 판 (0%, 0/1021) | 0 판 (0%, 0/4119) | ✓ | 0 판 (0%, 0/703) |
|   강제 사망 중 앞선 자유 경고 선택 없음 (전 정책) | 0 판 | 0 판 | 0 판 | 0 판 | 0 판 | 0 판 | ✓ | 0 판 |
| 조심형 봇 사망 (balanced·selfish·silent·lazy·diligent·steward·selfish_nb 합산) | 측정 | 49.6% (347/700), 그중 강제 0% | 50% (350/700), 그중 강제 0% | 48.6% (340/700), 그중 강제 0% | 49.9% (349/700), 그중 강제 0% | 49.5% (1386/2800), 그중 강제 0% | ✓ | 32.4% (227/700), 그중 강제 0% |
|   봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음 | 0 판 | 63 판 (전 정책 425) | 77 판 (전 정책 449) | 69 판 (전 정책 433) | 64 판 (전 정책 443) | 273 판 (전 정책 1750) | ✗ | 0 판 (전 정책 121) |
| 전멸 | ≤ 25% | 13% | 9% | 11% | 15% | 12% | ✓ | 10% |
| 밤 사건 수 / 판 (주민 사건만 — 시계·방치 판정 줄 뺌) | ≥ 6 | 13.44 (방치 판정 줄 7.26) | 13.51 (방치 판정 줄 7.06) | 12.95 (방치 판정 줄 7.28) | 12.85 (방치 판정 줄 6.89) | 13.19 (방치 판정 줄 7.12) | ✓ | 14.81 (방치 판정 줄 0) |
|   그중 malice / hymn | ≥ 2 / ≥ 1 | 6.06 / 3.71 | 6.29 / 3.63 | 5.75 / 3.56 | 5.78 / 3.54 | 5.97 / 3.61 | ✓ | 5.73 / 4.26 |
| 발견율 (보통) | 측정만 (10-24 A4: 하한 폐기) | 80.7% | 79.2% | 77.8% | 79% | 79.2% | ✓ | 79.3% |
| 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 55.4% | 55.3% | 55.2% | 54.4% | 55.1% | ✓ | 51.2% |
| 끝까지 모르는 사건 ≥1 (게으름) | 100% 판 | 94% | 97% | 96% | 91% | 94.5% | △ | 100% |
| 찬가 발견율 (부지런) | ≥ 70% | 100% | 100% | 100% | 100% | 100% | ✓ | 100% |
| 찬가 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 76.9% | 71% | 74.4% | 75.1% | 74.3% | ✓ | 74.7% |
| 정체 — 성향 봇 평균, 각 후보 (A3) | 각 ≥ 3% | platform_one 6.9 · counting_child 13.4 · conductor 13 · passenger 19.9 · counted 13 · driver 17.9 · inspector 16 (8종) | passenger 21.6 · conductor 13.1 · platform_one 6.3 · counting_child 12.9 · driver 16.1 · inspector 16.6 · counted 13.4 (8종) | passenger 20.3 · platform_one 7.8 · conductor 13.3 · counting_child 12.8 · driver 15.9 · inspector 16.5 · counted 13.6 (8종) | passenger 20.5 · conductor 12.6 · platform_one 8 · counting_child 13.4 · driver 17.1 · inspector 15.1 · counted 13.3 (8종) | platform_one 7.2 · counting_child 13.1 · conductor 13 · passenger 20.6 · counted 13.3 · driver 16.8 · inspector 16.1 (8종) | ✓ | platform_one 14.9 · passenger 19.9 · conductor 10 · driver 7 · counted 18.5 · inspector 12.4 · counting_child 17.4 (8종) |
| 정체 — 성향 봇 평균, 가장 큰 후보 (A3) | ≤ 40% | passenger 19.9% | passenger 21.6% | passenger 20.3% | passenger 20.5% | passenger 20.6% | ✓ | passenger 19.9% |
| 정체 — 사람 흉내 평균, 각 후보 (A3) | 각 ≥ 3% | counting_child 2.6 · passenger 53 · counted 10.2 · platform_one 26.6 · inspector 1.4 · driver 0.2 · conductor 6 (5종) | passenger 53.2 · counting_child 3.6 · platform_one 28 · counted 5.8 · inspector 1.4 · driver 1.8 · conductor 6.2 (5종) | conductor 7.4 · passenger 46.4 · counting_child 3.8 · counted 8.4 · platform_one 30.2 · driver 2 · inspector 1.8 (5종) | platform_one 26.2 · passenger 52 · counting_child 4.8 · counted 8.2 · inspector 2 · driver 1.4 · conductor 5.4 (5종) | counting_child 3.7 · passenger 51.2 · counted 8.2 · platform_one 27.8 · inspector 1.7 · driver 1.4 · conductor 6.3 (5종) | ✗ | passenger 48.6 · inspector 2.4 · platform_one 27.2 · conductor 3.6 · counted 9.4 · driver 2 · counting_child 6.8 (5종) |
| 정체 — 사람 흉내 평균, 가장 큰 후보 (A3) | 측정 (디렉터 확인: 승객이 가장 흔한 결말) | passenger 53% | passenger 53.2% | passenger 46.4% | passenger 52% | passenger 51.2% | ✓ | passenger 48.6% |
| 정체 분포 (옛 방식: 정책 전체 평균, 각 후보) | 측정 (옛 합격선 ≥ 7.1%) | platform_one 15.5% · counting_child 7.4% · conductor 10.7% · passenger 39.4% · counted 10.1% · driver 10.1% · inspector 6.9% | passenger 39.7% · conductor 11.4% · platform_one 15.8% · counting_child 7.2% · driver 8.7% · inspector 7% · counted 10.4% | passenger 38.4% · platform_one 17.2% · conductor 10.7% · counting_child 7% · driver 9% · inspector 7.1% · counted 10.8% | passenger 39.9% · conductor 10.7% · platform_one 15.3% · counting_child 7.8% · driver 9.5% · inspector 6.6% · counted 10.3% | platform_one 15.9% · counting_child 7.3% · conductor 10.9% · passenger 39.4% · counted 10.4% · driver 9.3% · inspector 6.9% | ✓ | platform_one 22.3% · passenger 38.5% · conductor 6.7% · driver 4.4% · counted 14.1% · inspector 5.6% · counting_child 8.7% |
|   옛 방식: 7후보 중 ≥7% 인 후보 수 | 측정 (옛 합격선 ≥ 5) | 6 후보 | 7 후보 | 7 후보 | 6 후보 | 6 후보 | ✓ | 4 후보 |
| explicit 사건 / 판 | ≥ 7 | 9.88 | 10.11 | 9.79 | 9.91 | 9.92 | ✓ | 10.14 |
| 하루 결정 수 | ≥ 5 | 22.82 | 22.4 | 22.47 | 24.02 | 22.93 | ✓ | 19.02 |
| 명부 사인 빈칸 비율 | 측정만 | 64.5% | 59.2% | 67% | 70.2% | 65.2% | ✓ | 58.5% |
| 모험 봇 열흘 생존 | ≥ 25% (10-24 바꿈 ≥40 → 25, 디렉터 확인) | 34% | 22% | 24% | 26% | 26.5% | △ | 45% |
| 모험 봇 사망 중 굶주림 | < 50% | 0% | 0% | 0% | 0% | 0% | ✓ | 0% |
| 열차 결말 도달 (모험 / 균형) | > 0% | 10% / 0% | 8% / 0% | 3% / 0% | 8% / 0% | 7.3% / 0% | ✓ | 11% / 0% |
| A2 D5까지 당신 사망 (균형) | ≥ 10% | 20% | 18% | 26% | 27% | 22.8% | ✓ | 0% |
| A2 균형 사망 중 한 사건 비중 (사인 사건) | ≤ 40% | fever_night 39.6% | fever_night 47.5% | fever_night 35.8% | fever_night 37.3% | fever_night 40.3% | △ | d10_walk_weak 52.9% |
| A2 균형 사망 중 한 사건 비중 (원인 사건 = 부상 출처) | ≤ 40% | starve_you 39.6% | starve_you 47.5% | starve_you 35.8% | starve_you 31.4% | starve_you 38.9% | △ | starve_you 58.8% |
| A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌) | 날마다 > 0 | D2 46 · D3 13 · D4 63 · D5 143 · D6 66 | D2 58 · D3 13 · D4 69 · D5 128 · D6 75 | D2 40 · D3 16 · D4 74 · D5 138 · D6 75 | D2 66 · D3 14 · D4 68 · D5 141 · D6 74 | D2 210 · D3 56 · D4 274 · D5 550 · D6 290 | ✓ | D2 4 · D3 16 · D4 3 · D5 5 · D6 3 |
| A1 이른 안전: 이기적 D1~D4 생존 − 균형 | ≥ +5%p | +8%p (99 vs 91) | +11%p (100 vs 89) | +9%p (100 vs 91) | +14%p (100 vs 86) | +10.5%p (99.8 vs 89.3) | △ | 0%p (100 vs 100) |
| A1 이기심의 값: 열흘 생존 − 균형 (이기적 4종 각각 — 버릇 없는·끝까지 금기 포함) | < 0 (모든 정책) | selfish -3 / selfish_nb +44 / selfish_rt -37 / selfish_rt0 -18%p | selfish -1 / selfish_nb +44 / selfish_rt -32 / selfish_rt0 -16%p | selfish -10 / selfish_nb +46 / selfish_rt -31 / selfish_rt0 -14%p | selfish -5 / selfish_nb +42 / selfish_rt -44 / selfish_rt0 -24%p | selfish -4.7 / selfish_nb +44 / selfish_rt -36 / selfish_rt0 -18%p | ✗ | selfish +48 / selfish_nb +48 / selfish_rt +51 / selfish_rt0 +51%p |
| A1 이기적 4종 사인 쏠림 (한 사건 비중) | ≤ 60% | selfish called_up 75% / selfish_nb dawn_strike 77.8% / selfish_rt dawn_mob 41.1% / selfish_rt0 dawn_mob 57.7% | selfish called_up 51.7% / selfish_nb dawn_strike 100% / selfish_rt dawn_mob 42.9% / selfish_rt0 dawn_mob 57.3% | selfish called_up 85.7% / selfish_nb dawn_strike 85.7% / selfish_rt dawn_mob 44% / selfish_rt0 dawn_mob 65.7% | selfish called_up 53.6% / selfish_nb dawn_strike 88.9% / selfish_rt dawn_mob 45.3% / selfish_rt0 dawn_mob 66.7% | selfish called_up 66.8% / selfish_nb dawn_strike 90% / selfish_rt dawn_mob 43.3% / selfish_rt0 dawn_mob 61.8% | ✗ | selfish called_up 100% / selfish_nb called_up 100% / selfish_rt - 0% / selfish_rt0 - 0% |
|   카르마 (판 끝 평균: 균형 / 이기적 4종) | 측정 | 2.32 / 11.98 · 14.82 · 15.48 · 15.92 | 2.55 / 12.24 · 14.63 · 15.62 · 15.83 | 1.86 / 11.48 · 14.47 · 15.67 · 16.11 | 2.32 / 12.02 · 14.52 · 15.8 · 15.99 | 2.26 / 11.93 · 14.61 · 15.64 · 15.96 | ✓ | 0 / 0 · 0 · 0 · 0 |
| A4 게으름의 값 — 생존 (보통−게으름 주 지표 / 부지런−게으름) | ≥ +5%p | 보통−게으름 +8 / 부지런−게으름 +7%p | 보통−게으름 -2 / 부지런−게으름 +5%p | 보통−게으름 +8 / 부지런−게으름 +8%p | 보통−게으름 +14 / 부지런−게으름 +12%p | 보통−게으름 +7 / 부지런−게으름 +8%p | △ | 보통−게으름 -5 / 부지런−게으름 +10%p |
| A4 게으름의 값 — D9 아침 주민 수 차 | > 0 | 보통−게으름 +0.3 / 부지런−게으름 +0.4 | 보통−게으름 0 / 부지런−게으름 +0.3 | 보통−게으름 +0.4 / 부지런−게으름 +0 | 보통−게으름 -0.1 / 부지런−게으름 +0.3 | 보통−게으름 +0.1 / 부지런−게으름 +0.3 | △ | 보통−게으름 0 / 부지런−게으름 +0.1 |
| A4 게으름의 값 — D7 아침 식량+물+약 차 | ≥ +0.2 | 보통−게으름 +0.5 / 부지런−게으름 +0.4 | 보통−게으름 -0.3 / 부지런−게으름 +0.1 | 보통−게으름 -0.1 / 부지런−게으름 +0.5 | 보통−게으름 +0.1 / 부지런−게으름 +0.8 | 보통−게으름 +0.1 / 부지런−게으름 +0.4 | △ | 보통−게으름 +0.2 / 부지런−게으름 +0.2 |
|   못 본 일(missed 적용) / 판 (게으름 / 보통 / 부지런) | 측정 | 4.47 / 2 / 0.01 | 4.47 / 2.2 / 0.04 | 4.52 / 2.19 / 0.03 | 4.27 / 1.92 / 0.06 | 4.43 / 2.08 / 0.04 | ✓ | 0 / 0 / 0 |
|   위기 때 값 길(비용 있는 선택)이 열린 비율 (균형) | 측정 (디렉터 확인) | d2_shutter_arm 6.3% (2/32) · d4_spanner 46.5% (20/43) · d5_flood 39.6% (36/91) | d2_shutter_arm 14.3% (6/42) · d4_spanner 46.2% (24/52) · d5_flood 43.8% (39/89) | d2_shutter_arm 6.1% (2/33) · d4_spanner 42.6% (20/47) · d5_flood 44% (40/91) | d2_shutter_arm 13.3% (6/45) · d4_spanner 29.8% (14/47) · d5_flood 41.9% (36/86) | d2_shutter_arm 10.5% (16/152) · d4_spanner 41.3% (78/189) · d5_flood 42.3% (151/357) | ✓ | d2_shutter_arm - · d4_spanner - · d5_flood 0% (0/100) |
| 헌신 봇 생존 | 측정 (> 0%) | 20% | 18% | 22% | 22% | 20.5% | ✓ | 39% |
| 사망 원인 중 굶주림 (전 정책 합산) | < 50% | 1.3% (13/1032) | 0.8% (8/1058) | 1.5% (15/1008) | 1.2% (12/1021) | 1.2% (48/4119) | ✓ | 2.6% (18/703) |
| 경고 없는 사망 (전 정책 합산, 강제 사망 포함) | 0 판 | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | ✓ | 0 판 (그중 강제 0) |

<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->
