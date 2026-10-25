# 봇 보고서 — 정책 20 × 200판 × 시드 블록 5 (2026-10-25)

데이터: v4/data (밤 사건 54, 사건 134, 후보 7). 시드 블록: 시드 1~200, 시드 1001~1200, 시드 2001~2200, 시드 3001~3200, 시드 8001~8200. 걸린 시간 839.9초. 규칙·데이터는 손대지 않았다. A4 정책(balanced·lazy·diligent)은 블록 9개(더 돈 블록: 시드 4001~4200, 시드 5001~5200, 시드 6001~6200, 시드 7001~7200) — 정책별 표·블록별 표는 기본 블록만, A4 줄 판정과 'A4 (블록 9개)' 표는 전부.

## 1. 정책별 표 (블록 5개를 합친 1000판)
| 정책 | 생존% | 사망% | 굶주림비중% | 실질경고% | 강제% | 열차% | 전멸% | 밤사건 | 시계 | malice | hymn | 발견% | 모름≥1% | 찬가발견% | explicit | 결정/일 | 빈칸% | 원정 | 날 | 굶주림 | D3셈% | 함께센다% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 40 | 60 | 0 | 100 | 0 | 0 | 11 | 14.37 | 12.56 | 5.84 | 3.54 | 67.8 | 93.4 | 94.2 | 11.85 | 26.93 | 63 | 4.96 | 8.08 | 6.27 | 95.8 | 0 |
| selfish | 32.3 | 67.7 | 0 | 100 | 0 | 0 | 8 | 22.94 | 14.44 | 13.01 | 3.89 | 67.2 | 100 | 93 | 13.18 | 25.85 | 66.5 | 7.69 | 8.89 | 4.52 | 100 | 0 |
| devoted | 20.4 | 79.6 | 0 | 100 | 0 | 4 | 1.1 | 10.85 | 10.4 | 3.71 | 3.47 | 65.8 | 88.3 | 93.9 | 9.86 | 29.07 | 22.5 | 3.48 | 6.83 | 6.68 | 94.4 | 0 |
| silent | 40.8 | 59.2 | 0 | 100 | 0 | 0 | 10.2 | 14.43 | 12.27 | 5.75 | 3.56 | 67.6 | 93.5 | 94.9 | 11.85 | 26.78 | 64 | 4.97 | 8.11 | 6.3 | 95.9 | 0 |
| caller | 30.3 | 69.7 | 0 | 100 | 0 | 0 | 9.1 | 12.91 | 11.91 | 5.26 | 3.31 | 67.2 | 90.2 | 95.5 | 11.02 | 28.17 | 61.6 | 4.75 | 7.51 | 6.07 | 95.4 | 0 |
| lazy | 28.4 | 71.6 | 0 | 100 | 0 | 0 | 9.1 | 14.87 | 11.9 | 6.43 | 3.37 | 47.2 | 97.4 | 78.9 | 11.64 | 23.94 | 61.5 | 4.55 | 7.67 | 6.2 | 95.9 | 0 |
| diligent | 42.7 | 57.3 | 0 | 100 | 0 | 0 | 9 | 13.21 | 12.94 | 5.09 | 3.66 | 95.6 | 45.2 | 100 | 12.68 | 69.01 | 28 | 5.03 | 8.21 | 6.4 | 95.7 | 0 |
| risky | 24 | 76 | 0 | 100 | 0 | 9.9 | 5.1 | 14.61 | 10.25 | 4.52 | 5.13 | 66.7 | 92.6 | 90.2 | 13.17 | 36.41 | 57.7 | 6.5 | 6.85 | 5.05 | 95.1 | 0 |
| steward | 37.8 | 62.2 | 0 | 100 | 0 | 0 | 10.7 | 13.57 | 12.27 | 5.21 | 3.49 | 66.7 | 93.4 | 95.3 | 10.95 | 27.3 | 26.1 | 4.62 | 7.95 | 6.98 | 94.3 | 0 |
| counter | 12.3 | 87.7 | 10.3 | 100 | 0 | 4.8 | 3.4 | 15.89 | 10.85 | 8.15 | 3.29 | 66.8 | 92.2 | 92 | 10.42 | 29.35 | 58.1 | 4.18 | 6.79 | 4.66 | 94.1 | 0 |
| child | 12.8 | 87.2 | 1.3 | 100 | 0 | 0 | 7.9 | 17.96 | 11.6 | 9.65 | 3.38 | 66.4 | 99.6 | 92.1 | 11.36 | 28.06 | 61.2 | 6.24 | 7.4 | 3.94 | 99.8 | 0 |
| selfish_nb | 31.6 | 68.4 | 0 | 100 | 0 | 0 | 7.6 | 23.29 | 14.59 | 13.29 | 3.87 | 67.2 | 100 | 93.1 | 13.36 | 25.3 | 66.3 | 7.1 | 8.94 | 4.43 | 100 | 0 |
| selfish_rt | 6.5 | 93.5 | 1.5 | 100 | 0 | 0 | 4.6 | 17.19 | 11.03 | 9.48 | 3.22 | 63.7 | 99.9 | 92 | 11.14 | 28.75 | 61.7 | 6.32 | 6.99 | 3.85 | 100 | 0 |
| selfish_rt0 | 6.5 | 93.5 | 1.3 | 100 | 0 | 0 | 5.1 | 17.28 | 11.03 | 9.55 | 3.21 | 63.6 | 99.9 | 92 | 11.15 | 28.7 | 62 | 6.26 | 6.98 | 3.84 | 100 | 0 |
| h_random | 0.4 | 99.6 | 15.3 | 100 | 0 | 0 | 0.2 | 4.06 | 3.02 | 1.65 | 1.32 | 69.6 | 36.6 | 93.9 | 4.5 | 35.73 | 59.3 | 1.95 | 2.49 | 4.8 | 45.4 | 48.5 |
| h_wary | 7 | 93 | 0 | 100 | 0 | 1.1 | 1 | 8.78 | 5.7 | 4.12 | 2.11 | 65.4 | 50.7 | 91.4 | 6.88 | 30.32 | 58.3 | 2.36 | 3.98 | 6.11 | 51.1 | 0 |
| h_first | 68.1 | 31.9 | 0 | 100 | 0 | 14.6 | 2.6 | 19.56 | 11.72 | 7.71 | 5.52 | 65.6 | 99.7 | 90.2 | 13.98 | 22.61 | 67.2 | 4.34 | 9.56 | 6.96 | 100 | 0 |
| h_cautious | 74.7 | 25.3 | 0 | 100 | 0 | 0 | 28.6 | 19.66 | 15.86 | 8.01 | 4.69 | 70.1 | 99.9 | 93.8 | 14.38 | 23.84 | 61.1 | 6.38 | 9.66 | 7.14 | 100 | 0 |
| h_cautious2 | 42.5 | 57.5 | 0 | 100 | 0 | 2.7 | 12.1 | 16.72 | 13.84 | 6.68 | 4.15 | 67 | 97.6 | 92.4 | 12.83 | 25.48 | 62.4 | 5.5 | 8.6 | 6.7 | 99.3 | 0 |
| h_mixed | 34.4 | 65.6 | 0 | 100 | 0 | 0.7 | 9.9 | 16 | 10.84 | 7.34 | 3.67 | 66.9 | 80.6 | 91.3 | 11.67 | 26.78 | 62 | 4.85 | 7.28 | 6.59 | 80.7 | 0 |

굶주림 = 아침마다 잰 당신 굶주림의 판 평균(10-24 추가) · D3셈% = D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 · 함께센다% = 그중 '함께 센다'를 고른 비율. 아침 조사는 칸 단위(10-24 P0-E2: 그 칸의 물건 전부, 조사 수 = 칸 수).

정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대) / steward 몫+손−이름+(정체 inspector 쪽 성향, 10-23 추가). 조심형(합격선 따로 집계) = balanced·silent·lazy·diligent·steward·selfish_nb.
- balanced 사망 원인: d5_flood 191 · fever_night 162 · d10_walk_weak 129 · dawn_strike 50 · d2_shutter_arm 42 · dawn_mob 8 · called_up 7 · d4_spanner 6 · dawn_strike_d6 5
- selfish 사망 원인: called_up 205 · dawn_strike 167 · dawn_mob 93 · d10_walk_weak 75 · d10_hold 73 · d10_grab 40 · fever_night 17 · dawn_strike_d6 6 · called_up_d6 1
- devoted 사망 원인: fever_night 302 · d5_flood 148 · d4_spanner 98 · d10_walk_weak 74 · d2_shutter_arm 56 · dawn_strike 53 · d6_shutter_b 27 · dawn_strike_d6 22 · fever_night_d3 16 [평범한 대안 두고 죽음 글 선택 220]
- silent 사망 원인: d5_flood 191 · fever_night 153 · d10_walk_weak 132 · dawn_strike 46 · d2_shutter_arm 41 · d4_spanner 9 · dawn_mob 9 · dawn_strike_d6 8 · called_up 3
- caller 사망 원인: fever_night 187 · d5_flood 176 · dawn_strike 91 · d10_walk_weak 90 · d4_spanner 57 · d2_shutter_arm 46 · dawn_strike_d6 13 · d6_shutter_b 10 · dawn_mob 9 · called_up 7 · fever_night_d3 5 · called_up_d6 3 · d10_walk_other 3 [평범한 대안 두고 죽음 글 선택 131]
- lazy 사망 원인: fever_night 200 · d5_flood 181 · dawn_strike 144 · d10_walk_weak 92 · d2_shutter_arm 41 · dawn_strike_d6 32 · dawn_mob 14 · d4_spanner 9 · called_up 3
- diligent 사망 원인: fever_night 187 · d5_flood 180 · d10_walk_weak 136 · d2_shutter_arm 43 · d4_spanner 11 · called_up 9 · dawn_mob 5 · dawn_strike 2
- risky 사망 원인: fever_night 250 · d5_flood 175 · d4_spanner 70 · d10_walk_weak 50 · d2_shutter_arm 49 · d6_shutter_b 41 · called_up 33 · dawn_strike 33 · fever_night_d3 17 · d6_shutter 16 · dawn_mob 13 · dawn_strike_d6 12 · called_up_d6 1 [평범한 대안 두고 죽음 글 선택 564]
- steward 사망 원인: fever_night 219 · d5_flood 171 · d10_walk_weak 125 · d2_shutter_arm 57 · dawn_strike 43 · dawn_strike_d6 7
- counter 사망 원인: dawn_strike 136 · fever_night 136 · d5_flood 116 · called_up 112 · d4_spanner 97 · starve_you 90 · dawn_mob 63 · d2_shutter_arm 59 · dawn_strike_d6 30 · d10_walk_weak 18 · d10_hold 9 · dawn_mob_d6 8 · called_up_d6 2 · fever_night_d3 1 [평범한 대안 두고 죽음 글 선택 305]
- child 사망 원인: called_up 197 · d6_shutter_b 166 · dawn_strike 144 · dawn_mob 124 · d5_flood 102 · d10_walk_weak 41 · d10_hold 25 · dawn_mob_d6 19 · fever_night 18 · d10_grab 11 · starve_you 11 · d10_walk_other 8 · dawn_strike_d6 4 · dawn_strike_d3 2 [평범한 대안 두고 죽음 글 선택 322]
- selfish_nb 사망 원인: dawn_strike 182 · called_up 155 · dawn_mob 117 · d10_walk_weak 100 · d10_hold 53 · d10_grab 42 · fever_night 20 · dawn_mob_d6 10 · dawn_strike_d6 5 [평범한 대안 두고 죽음 글 선택 10]
- selfish_rt 사망 원인: called_up 296 · dawn_mob 288 · dawn_strike 223 · d5_flood 50 · dawn_mob_d6 23 · d10_walk_weak 15 · starve_you 14 · dawn_strike_d6 8 · d10_hold 7 · d10_grab 6 · called_up_d6 4 · fever_night 1 [평범한 대안 두고 죽음 글 선택 99]
- selfish_rt0 사망 원인: called_up 294 · dawn_mob 290 · dawn_strike 222 · d5_flood 50 · dawn_mob_d6 23 · d10_walk_weak 16 · starve_you 12 · dawn_strike_d6 8 · fever_night 8 · d10_hold 7 · called_up_d6 4 · d10_grab 1 [평범한 대안 두고 죽음 글 선택 103]
- h_random 사망 원인: pro_stairs 489 · starve_you 152 · d3_called_you 94 · fever_night 38 · d2_night_shutter 37 · dawn_mob 31 · called_up 26 · d6_shutter 24 · d5_flood 22 · dawn_strike 19 · d4_spanner 18 · d6_shutter_b 11 · dawn_mob_d6 7 · dawn_strike_d6 6 · d8_patrol_return 4 · called_up_d6 4 · d2_shutter_arm 3 · d10_walk_weak 2 · dawn_strike_d3 2 · d10_hold 2 · d10_walk 1 · d9_night_stand 1 · called_up_d3 1 · fever_night_d3 1 · d10_grab 1 [평범한 대안 두고 죽음 글 선택 413]
- h_wary 사망 원인: pro_stairs 489 · dawn_mob 110 · called_up 108 · dawn_strike 82 · fever_night 62 · d10_walk_weak 22 · d5_flood 18 · d8_patrol_return 15 · d10_grab 12 · d10_hold 8 · dawn_strike_d6 2 · called_up_d6 1 · dawn_mob_d6 1
- h_first 사망 원인: fever_night 124 · dawn_strike 63 · d10_grab 42 · d10_walk_weak 23 · dawn_mob 22 · called_up 21 · d10_hold 17 · dawn_strike_d6 7
- h_cautious 사망 원인: d10_walk_weak 58 · d10_grab 48 · fever_night 46 · dawn_strike 45 · d10_hold 23 · called_up 17 · dawn_mob 14 · dawn_strike_d6 2
- h_cautious2 사망 원인: dawn_strike 135 · fever_night 112 · d5_flood 92 · dawn_mob 71 · d10_walk_weak 70 · d10_grab 34 · called_up 28 · d10_hold 12 · dawn_strike_d6 11 · d2_shutter_arm 7 · d4_spanner 2 · called_up_d6 1
- h_mixed 사망 원인: pro_stairs 193 · dawn_mob 105 · called_up 93 · dawn_strike 73 · fever_night 60 · d10_walk_weak 56 · d10_grab 32 · d10_hold 26 · d8_patrol_return 12 · d5_flood 6

강제 = 확정 사망 — 고를 때 열린 선택지 전부 살 확률 0 (10-24 tightrope R1, 살 확률 > 0 인 주사위가 하나라도 열려 있으면 강제가 아니다 · 옛 정의 '죽지 않는 열린 선택지 0개'는 아래 '줄타기·발견 지표' 표의 '옛 강제'). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택). 실질경고% = 사망 중 '경고 글이 있고 강제가 아닌' 선택으로 죽은 비율(10-22 리드 결정: 강제 사망은 경고 있음으로 세지 않는다). 둘 다 엔진의 사인 기록(ended.cause.forced·free)에서 읽는다.

### 블록별 (생존% / 사망% / 열차% / 강제%)
| 정책 | 시드 1~200 | 시드 1001~1200 | 시드 2001~2200 | 시드 3001~3200 | 시드 8001~8200 |
|---|---|---|---|---|---|
| balanced | 38.5 / 61.5 / 0 / 0 | 45 / 55 / 0 / 0 | 38 / 62 / 0 / 0 | 39 / 61 / 0 / 0 | 39.5 / 60.5 / 0 / 0 |
| selfish | 32 / 68 / 0 / 0 | 34.5 / 65.5 / 0 / 0 | 32 / 68 / 0 / 0 | 30 / 70 / 0 / 0 | 33 / 67 / 0 / 0 |
| devoted | 20.5 / 79.5 / 4.5 / 0 | 23 / 77 / 4 / 0 | 19.5 / 80.5 / 2.5 / 0 | 20 / 80 / 4 / 0 | 19 / 81 / 5 / 0 |
| silent | 39 / 61 / 0 / 0 | 34 / 66 / 0 / 0 | 45.5 / 54.5 / 0 / 0 | 48.5 / 51.5 / 0 / 0 | 37 / 63 / 0 / 0 |
| caller | 29.5 / 70.5 / 0 / 0 | 30 / 70 / 0 / 0 | 34.5 / 65.5 / 0 / 0 | 30 / 70 / 0 / 0 | 27.5 / 72.5 / 0 / 0 |
| lazy | 26 / 74 / 0 / 0 | 25.5 / 74.5 / 0 / 0 | 30.5 / 69.5 / 0 / 0 | 33 / 67 / 0 / 0 | 27 / 73 / 0 / 0 |
| diligent | 40 / 60 / 0 / 0 | 45 / 55 / 0 / 0 | 42 / 58 / 0 / 0 | 43 / 57 / 0 / 0 | 43.5 / 56.5 / 0 / 0 |
| risky | 21.5 / 78.5 / 12 / 0 | 25.5 / 74.5 / 10.5 / 0 | 23.5 / 76.5 / 7 / 0 | 24.5 / 75.5 / 11.5 / 0 | 25 / 75 / 8.5 / 0 |
| steward | 37 / 63 / 0 / 0 | 33 / 67 / 0 / 0 | 41.5 / 58.5 / 0 / 0 | 40.5 / 59.5 / 0 / 0 | 37 / 63 / 0 / 0 |
| counter | 13 / 87 / 3.5 / 0 | 15 / 85 / 5.5 / 0 | 12 / 88 / 6.5 / 0 | 12 / 88 / 5.5 / 0 | 9.5 / 90.5 / 3 / 0 |
| child | 14.5 / 85.5 / 0 / 0 | 13 / 87 / 0 / 0 | 14 / 86 / 0 / 0 | 12 / 88 / 0 / 0 | 10.5 / 89.5 / 0 / 0 |
| selfish_nb | 34.5 / 65.5 / 0 / 0 | 34.5 / 65.5 / 0 / 0 | 29.5 / 70.5 / 0 / 0 | 32.5 / 67.5 / 0 / 0 | 27 / 73 / 0 / 0 |
| selfish_rt | 5.5 / 94.5 / 0 / 0 | 8 / 92 / 0 / 0 | 5.5 / 94.5 / 0 / 0 | 6 / 94 / 0 / 0 | 7.5 / 92.5 / 0 / 0 |
| selfish_rt0 | 4.5 / 95.5 / 0 / 0 | 7.5 / 92.5 / 0 / 0 | 5.5 / 94.5 / 0 / 0 | 7 / 93 / 0 / 0 | 8 / 92 / 0 / 0 |
| h_random | 0 / 100 / 0 / 0 | 0 / 100 / 0 / 0 | 0.5 / 99.5 / 0 / 0 | 0 / 100 / 0 / 0 | 1.5 / 98.5 / 0 / 0 |
| h_wary | 9 / 91 / 2.5 / 0 | 6.5 / 93.5 / 0.5 / 0 | 6.5 / 93.5 / 1.5 / 0 | 7.5 / 92.5 / 1 / 0 | 5.5 / 94.5 / 0 / 0 |
| h_first | 63.5 / 36.5 / 14.5 / 0 | 70 / 30 / 15 / 0 | 69 / 31 / 14 / 0 | 64.5 / 35.5 / 15 / 0 | 73.5 / 26.5 / 14.5 / 0 |
| h_cautious | 68.5 / 31.5 / 0 / 0 | 79.5 / 20.5 / 0 / 0 | 77 / 23 / 0 / 0 | 74 / 26 / 0 / 0 | 74.5 / 25.5 / 0 / 0 |
| h_cautious2 | 45 / 55 / 4 / 0 | 40.5 / 59.5 / 2 / 0 | 45.5 / 54.5 / 4 / 0 | 41.5 / 58.5 / 2 / 0 | 40 / 60 / 1.5 / 0 |
| h_mixed | 30.5 / 69.5 / 1.5 / 0 | 34 / 66 / 0 / 0 | 36.5 / 63.5 / 1.5 / 0 | 40 / 60 / 0 / 0 | 31 / 69 / 0.5 / 0 |

### 정책별 비교 (생존% / 사망% / 열차%)
| 정책 | 지금 | 스냅샷(P1-11 전) |
|---|---|---|
| balanced | 40 / 60 / 0 | 38.3 / 61.7 / 0 |
| selfish | 32.3 / 67.7 / 0 | 23.5 / 76.5 / 0 |
| devoted | 20.4 / 79.6 / 4 | 18.1 / 81.9 / 1.8 |
| silent | 40.8 / 59.2 / 0 | 39 / 61 / 0 |
| caller | 30.3 / 69.7 / 0 | 29 / 71 / 0 |
| lazy | 28.4 / 71.6 / 0 | 27 / 73 / 0 |
| diligent | 42.7 / 57.3 / 0 | 41.4 / 58.6 / 0 |
| risky | 24 / 76 / 9.9 | 29.4 / 70.6 / 10.7 |
| steward | 37.8 / 62.2 / 0 | 39.8 / 60.2 / 0 |
| counter | 12.3 / 87.7 / 4.8 | 7 / 93 / 1 |
| child | 12.8 / 87.2 / 0 | 19.9 / 80.1 / 0 |
| selfish_nb | 31.6 / 68.4 / 0 | 24 / 76 / 0 |
| selfish_rt | 6.5 / 93.5 / 0 | 4.8 / 95.2 / 0 |
| selfish_rt0 | 6.5 / 93.5 / 0 | 4.1 / 95.9 / 0 |
| h_random | 0.4 / 99.6 / 0 | 0.6 / 99.4 / 0 |
| h_wary | 7 / 93 / 1.1 | 6.1 / 93.9 / 0.4 |
| h_first | 68.1 / 31.9 / 14.6 | 66.1 / 33.9 / 5.1 |
| h_cautious | 74.7 / 25.3 / 0 | 64.2 / 35.8 / 0 |
| h_cautious2 | 42.5 / 57.5 / 2.7 | 33.9 / 66.1 / 1.6 |
| h_mixed | 34.4 / 65.6 / 0.7 | 26.8 / 73.2 / 0 |

### 정체 분포 (정책별 %)
| 정책 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| balanced | 3.7 | 38.3 | 2 | 34.9 | 1.6 | 16.6 | 2.9 |
| selfish | 0 | 0 | 0 | 91.2 | 0 | 0.4 | 8.4 |
| devoted | 78.9 | 21.1 | 0 | 0 | 0 | 0 | 0 |
| silent | 0 | 48 | 0 | 37.2 | 0 | 14.8 | 0 |
| caller | 56.7 | 0 | 38.2 | 0 | 3.8 | 0 | 1.3 |
| lazy | 2.8 | 45.3 | 1.2 | 35.1 | 0.9 | 12.1 | 2.6 |
| diligent | 4.2 | 38.5 | 2 | 32.5 | 2.3 | 17.3 | 3.2 |
| risky | 2.7 | 33.5 | 0 | 9.9 | 1.7 | 49.6 | 2.6 |
| steward | 1.8 | 0 | 98.2 | 0 | 0 | 0 | 0 |
| counter | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| child | 0 | 0 | 0 | 0 | 0 | 0 | 100 |
| selfish_nb | 0 | 0 | 0 | 89.9 | 0 | 0.6 | 9.5 |
| selfish_rt | 0 | 0 | 0 | 85.1 | 0 | 0.2 | 14.7 |
| selfish_rt0 | 0 | 0 | 0 | 86.2 | 0 | 0.2 | 13.6 |
| h_random | 9.8 | 2.8 | 6.1 | 37 | 12.8 | 22.6 | 8.9 |
| h_wary | 8.7 | 8.2 | 1.8 | 37 | 12.9 | 28.7 | 2.7 |
| h_first | 79.2 | 3.2 | 0.5 | 0 | 15.9 | 1.1 | 0.1 |
| h_cautious | 2.3 | 15.7 | 5.9 | 61 | 1.7 | 9.7 | 3.7 |
| h_cautious2 | 4 | 29.1 | 1.9 | 31.1 | 3.8 | 27.6 | 2.5 |
| h_mixed | 9.6 | 15.9 | 4.4 | 35.3 | 7.6 | 23.9 | 3.3 |

### 당신 사망 원인 (balanced, 판 수)
- d5_flood: 191
- fever_night: 162
- d10_walk_weak: 129
- dawn_strike: 50
- d2_shutter_arm: 42
- dawn_mob: 8
- called_up: 7
- d4_spanner: 6
- dawn_strike_d6: 5

### 날별 당신 사망 (판 수, 1000판 중 · 괄호 = 그날 사건으로 죽은 판, 깔때기 사건(열병·새벽 위독 등) 뺌)
| 정책 | D0 | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 0 | 0 | 42 (42) | 0 | 11 (6) | 212 (201) | 27 (5) | 50 (21) | 54 (12) | 66 (13) | 138 (9) |
| selfish | 0 | 0 | 0 | 0 | 4 (4) | 17 (17) | 16 (16) | 164 (163) | 152 (149) | 111 (98) | 213 (138) |
| devoted | 0 | 0 | 56 (56) | 16 (0) | 135 (98) | 194 (158) | 97 (49) | 74 (14) | 79 (14) | 64 (8) | 81 (7) |
| silent | 0 | 0 | 41 (41) | 0 | 9 (9) | 205 (198) | 28 (8) | 60 (17) | 57 (16) | 54 (12) | 138 (6) |
| caller | 0 | 0 | 46 (46) | 5 (0) | 66 (57) | 206 (192) | 52 (28) | 72 (33) | 73 (25) | 75 (22) | 102 (12) |
| lazy | 0 | 0 | 41 (41) | 0 | 14 (13) | 227 (215) | 61 (32) | 81 (32) | 93 (38) | 81 (27) | 118 (26) |
| diligent | 0 | 0 | 43 (43) | 0 | 11 (11) | 194 (180) | 21 (0) | 47 (12) | 52 (2) | 68 (1) | 137 (1) |
| risky | 0 | 0 | 49 (49) | 17 (0) | 100 (73) | 226 (181) | 116 (70) | 101 (46) | 48 (14) | 48 (5) | 55 (5) |
| steward | 0 | 0 | 57 (57) | 0 | 10 (0) | 201 (180) | 29 (7) | 71 (14) | 53 (11) | 71 (4) | 130 (5) |
| counter | 0 | 0 | 59 (59) | 1 (0) | 115 (97) | 156 (133) | 93 (67) | 157 (132) | 151 (124) | 92 (75) | 53 (35) |
| child | 0 | 0 | 0 | 2 (2) | 5 (5) | 144 (144) | 247 (245) | 170 (163) | 107 (103) | 83 (78) | 114 (73) |
| selfish_nb | 0 | 0 | 0 | 0 | 4 (4) | 16 (16) | 26 (26) | 155 (155) | 127 (123) | 109 (93) | 247 (147) |
| selfish_rt | 0 | 0 | 0 | 0 | 6 (6) | 78 (78) | 361 (361) | 267 (267) | 120 (119) | 63 (63) | 40 (25) |
| selfish_rt0 | 0 | 0 | 0 | 0 | 6 (6) | 78 (78) | 360 (360) | 267 (267) | 120 (116) | 71 (67) | 33 (17) |
| h_random | 489 (489) | 7 (2) | 48 (47) | 110 (109) | 71 (65) | 75 (66) | 95 (88) | 50 (43) | 29 (28) | 14 (12) | 8 (6) |
| h_wary | 489 (489) | 0 | 0 | 0 | 8 (5) | 44 (39) | 64 (57) | 122 (109) | 87 (67) | 63 (49) | 53 (31) |
| h_first | 0 | 0 | 0 | 0 | 0 | 12 (10) | 15 (7) | 33 (25) | 60 (26) | 100 (28) | 99 (76) |
| h_cautious | 0 | 0 | 0 | 0 | 0 | 6 (6) | 2 (2) | 30 (27) | 23 (14) | 53 (19) | 139 (81) |
| h_cautious2 | 0 | 0 | 7 (7) | 0 | 2 (2) | 123 (114) | 32 (16) | 99 (79) | 81 (55) | 83 (42) | 148 (78) |
| h_mixed | 193 (193) | 0 | 0 | 0 | 0 | 28 (26) | 30 (27) | 65 (56) | 99 (85) | 95 (63) | 146 (90) |

### A1·A2·A4 지표 (블록 합산)
| 정책 | 생존% | D1~D4 생존% | D5까지 사망% | 산 날 | 카르마(끝) | 못 본 일/판 | 방치 줄/판 | D9 주민 | D7 자원 | 사인 1위 | 원인 1위 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 40 | 94.7 | 26.5 | 8.08 | 2.14 | 2.51 | 6.68 | 3.16 | 2.62 | d5_flood 31.8% | d5_flood 31.8% |
| selfish | 32.3 | 99.6 | 2.1 | 8.89 | 8.86 | 2.39 | 7.82 | 3.06 | 4.53 | called_up 30.3% | called_up 30.3% |
| devoted | 20.4 | 79.3 | 40.1 | 6.83 | 0 | 1.98 | 5.2 | 4.14 | 2.03 | fever_night 37.9% | starve_you 18.8% |
| silent | 40.8 | 95 | 25.5 | 8.11 | 2.17 | 2.57 | 6.61 | 3.17 | 2.68 | d5_flood 32.3% | starve_you 35.1% |
| caller | 30.3 | 88.3 | 32.3 | 7.51 | 2.14 | 2.22 | 5.92 | 3.15 | 2.57 | fever_night 26.8% | d5_flood 25.3% |
| lazy | 28.4 | 94.5 | 28.2 | 7.67 | 1.94 | 4.41 | 6.43 | 2.98 | 2.36 | fever_night 27.9% | dawn_strike 27.8% |
| diligent | 42.7 | 94.6 | 24.8 | 8.21 | 2.26 | 0.44 | 5.92 | 3.23 | 2.79 | fever_night 32.6% | starve_you 40.1% |
| risky | 24 | 83.4 | 39.2 | 6.85 | 4.07 | 1.65 | 3.83 | 3.16 | 10.17 | fever_night 32.9% | d5_flood 23% |
| steward | 37.8 | 93.3 | 26.8 | 7.95 | 2.07 | 2.58 | 6.4 | 3.02 | 1.77 | fever_night 35.2% | starve_you 41% |
| counter | 12.3 | 82.5 | 33.1 | 6.79 | 7.3 | 1.62 | 5.09 | 2.93 | 4.39 | dawn_strike 15.5% | dawn_strike 16.5% |
| child | 12.8 | 99.3 | 15.1 | 7.4 | 12.1 | 1.7 | 5.77 | 2.48 | 7.68 | called_up 22.6% | called_up 23.5% |
| selfish_nb | 31.6 | 99.6 | 2 | 8.94 | 9.26 | 2.39 | 7.87 | 3.06 | 4.84 | dawn_strike 26.6% | dawn_strike 27.3% |
| selfish_rt | 6.5 | 99.4 | 8.4 | 6.99 | 13.56 | 1.6 | 5.24 | 2.14 | 6.15 | called_up 31.7% | called_up 31.7% |
| selfish_rt0 | 6.5 | 99.4 | 8.4 | 6.98 | 13.69 | 1.61 | 5.24 | 2.21 | 6.15 | called_up 31.4% | dawn_mob 31.8% |
| h_random | 0.4 | 27.5 | 80 | 2.49 | 2.47 | 0.46 | 1.39 | 3.58 | 4.08 | pro_stairs 49.1% | pro_stairs 49.1% |
| h_wary | 7 | 50.3 | 54.1 | 3.98 | 4.58 | 1.18 | 3.09 | 3.57 | 3.34 | pro_stairs 52.6% | pro_stairs 52.6% |
| h_first | 68.1 | 100 | 1.2 | 9.56 | 4.86 | 2.97 | 7.45 | 4.38 | 2.63 | fever_night 38.9% | dawn_strike 21.3% |
| h_cautious | 74.7 | 100 | 0.6 | 9.66 | 6.19 | 3.1 | 7.95 | 2.57 | 4.1 | d10_walk_weak 22.9% | starve_you 38.3% |
| h_cautious2 | 42.5 | 99.1 | 13.2 | 8.6 | 4.32 | 2.76 | 7.18 | 3.02 | 2.81 | dawn_strike 23.5% | dawn_strike 24.9% |
| h_mixed | 34.4 | 80.7 | 22.1 | 7.28 | 6.16 | 2.39 | 6.04 | 3.21 | 4.27 | pro_stairs 29.4% | pro_stairs 29.4% |

### 줄타기·발견 지표 (10-24 tightrope, 블록 합산 — '산 판' = 열흘을 산 판)
| 정책 | 확정 사망 | 옛 강제(위험 0 출구 없음) | 경고 없는 사망 | 줄타기 굴림/판 | 줄타기 넘김/판 (산 판) | 산 판 중 줄타기 ≥2번% | 느껴지는 줄타기(≤85%) 넘김/판 (산 판) · 넘김 중 비중 | 산 판 중 느껴지는 줄타기 ≥2번% | 죽음 판정 넘김/판 (산 판) | 줄타기로 죽은 판 | 눈먼 새벽/판 · 그 죽음 | 실제 발견% | 옛 발견% | 누구나 아는 밤/판 · 숨은 밤/판 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| balanced | 0 | 116 | 0 | 0.55 | 0.67 | 16% | 0.22 · 33% | 1.5% | 3.51 | 70 | 0.29 · 53 | 59.8% | 67.8% | 2.83 · 11.54 |
| selfish | 0 | 677 | 0 | 3.78 | 4.15 | 78.9% | 2.1 · 50.6% | 53.3% | 4.24 | 651 | 0.28 · 59 | 53.4% | 67.2% | 6.79 · 16.16 |
| devoted | 0 | 68 | 0 | 0.05 | 0.08 | 0% | 0.04 · 47.1% | 0% | 5.18 | 5 | 0.18 · 68 | 61.7% | 65.8% | 1.16 · 9.69 |
| silent | 0 | 112 | 0 | 0.52 | 0.57 | 14.2% | 0.19 · 33.2% | 2.2% | 3.31 | 66 | 0.29 · 52 | 59.8% | 67.6% | 2.8 · 11.63 |
| caller | 0 | 157 | 0 | 0.4 | 0.48 | 11.6% | 0.11 · 22.2% | 1.3% | 4.36 | 68 | 0.23 · 91 | 59.9% | 67.2% | 2.36 · 10.55 |
| lazy | 0 | 231 | 0 | 1.24 | 1.59 | 46.8% | 0.92 · 57.6% | 26.1% | 4.78 | 193 | 1.03 · 166 | 30.6% | 47.2% | 3.56 · 11.3 |
| diligent | 0 | 77 | 0 | 0.18 | 0.22 | 6.6% | 0 · 0% | 0% | 3.13 | 16 | 0 · 0 | 94.8% | 95.6% | 2.19 · 11.02 |
| risky | 0 | 75 | 0 | 1.06 | 1.79 | 35.4% | 0.18 · 10.3% | 1.7% | 5.79 | 114 | 0.18 · 29 | 58.8% | 66.7% | 2.78 · 11.83 |
| steward | 0 | 50 | 0 | 0.05 | 0.07 | 0% | 0.03 · 44.4% | 0% | 3.34 | 5 | 0.23 · 50 | 60.3% | 66.7% | 2.2 · 11.37 |
| counter | 0 | 437 | 0 | 2.1 | 3.46 | 77.2% | 1.67 · 48.2% | 35.8% | 5.82 | 411 | 0.16 · 76 | 54.9% | 66.8% | 4.21 · 11.69 |
| child | 0 | 550 | 0 | 3.24 | 4.55 | 82.8% | 3.92 · 86.3% | 79.7% | 5.62 | 728 | 0.18 · 41 | 54% | 66.4% | 4.86 · 13.1 |
| selfish_nb | 0 | 674 | 0 | 4.1 | 4.34 | 75.3% | 2.43 · 56.1% | 49.4% | 4.45 | 649 | 0.27 · 58 | 53.1% | 67.2% | 7.02 · 16.27 |
| selfish_rt | 0 | 836 | 0 | 2.79 | 2.68 | 63.1% | 1.88 · 70.1% | 47.7% | 2.68 | 935 | 0.13 · 42 | 51.2% | 63.7% | 4.42 · 12.77 |
| selfish_rt0 | 0 | 832 | 0 | 2.83 | 2.68 | 63.1% | 1.82 · 67.8% | 46.2% | 2.68 | 935 | 0.13 · 40 | 51% | 63.6% | 4.44 · 12.83 |
| h_random | 0 | 76 | 0 | 0.35 | 2.75 | 50% | 1 · 36.4% | 25% | 4.5 | 92 | 0.03 · 12 | 63.8% | 69.6% | 0.64 · 3.41 |
| h_wary | 0 | 426 | 0 | 1.11 | 2.47 | 57.1% | 1.63 · 65.9% | 40% | 3.16 | 339 | 0.09 · 36 | 54.9% | 65.4% | 2.05 · 6.73 |
| h_first | 0 | 319 | 0 | 1.62 | 1.49 | 36.4% | 0.64 · 43% | 18.1% | 1.55 | 195 | 0.41 · 63 | 57.8% | 65.6% | 3.62 · 15.94 |
| h_cautious | 0 | 253 | 0 | 2.32 | 2.14 | 54.6% | 0.56 · 26.1% | 16.9% | 2.29 | 214 | 0.4 · 41 | 57.9% | 70.1% | 5.68 · 13.99 |
| h_cautious2 | 0 | 356 | 0 | 0.97 | 0.87 | 17.2% | 0.51 · 59% | 10.8% | 2.09 | 234 | 0.36 · 111 | 57.3% | 67% | 3.79 · 12.93 |
| h_mixed | 0 | 451 | 0 | 2.21 | 2.72 | 65.4% | 1.1 · 40.6% | 28.2% | 3.16 | 375 | 0.27 · 48 | 54.7% | 66.9% | 4.31 · 11.69 |

확정 사망 = 고를 때 열린 선택지 전부 살 확률 0 (R1 — 엔진 ended.cause.forced). 옛 강제 = 당신이 죽지 않는 열린 선택지 0개(카르마 판의 줄타기는 일부러 그렇다). 줄타기 = rope 칸이 얹힌 판정(엔진 s.stats.ropeRolls·ropeClose), 느껴지는 줄타기 = 그중 화면 % ≤ 85(죽을 확률 ≥ 15%)인 판정(ropeFeltRolls·ropeFelt — 90% 넘는 판정은 넘겨도 아슬하게 느껴지기 어렵다, 10-24 tightrope 검증 · **10-25 부터 A1 아슬함 합격선은 이 값**) · 넘김 중 비중 = 산 판 줄타기 넘김 가운데 느껴지는 줄타기의 몫, 죽음 판정 = 실패가 당신을 죽이는 모든 판정(deathRolls·closeCalls). 실제 발견% = 누구나 아는 밤(public·kill)을 뺀 주민 사건 가운데 발견한 비율 — 옛 발견%(발견%) 옆에 싣는다.

### 원정 수납 (P1-11, 블록 합산 — 판 평균)
| 정책 | 원정 | 원정 조사 물건 | 연 수납 | 조사로 걸린 원정 사건 |
|---|---|---|---|---|
| balanced | 4.96 | 22.04 | 6.16 | 10.57 |
| selfish | 7.69 | 34.81 | 6.92 | 17.47 |
| devoted | 3.48 | 14.46 | 4.99 | 6.28 |
| silent | 4.97 | 22.1 | 6.16 | 10.62 |
| caller | 4.75 | 20.85 | 5.94 | 9.9 |
| lazy | 4.55 | 19.95 | 5.91 | 9.35 |
| diligent | 5.03 | 22.43 | 6.15 | 10.82 |
| risky | 6.5 | 36.58 | 7 | 11.38 |
| steward | 4.62 | 20.29 | 5.92 | 9.67 |
| counter | 4.18 | 17.92 | 5.43 | 8.18 |
| child | 6.24 | 28.22 | 6.87 | 13.79 |
| selfish_nb | 7.1 | 32.17 | 6.91 | 16 |
| selfish_rt | 6.32 | 28.69 | 6.94 | 14.07 |
| selfish_rt0 | 6.26 | 28.4 | 6.94 | 13.91 |
| h_random | 1.95 | 8.29 | 2.51 | 3.58 |
| h_wary | 2.36 | 10.36 | 2.82 | 4.53 |
| h_first | 4.34 | 18.52 | 5.6 | 6.9 |
| h_cautious | 6.38 | 28.79 | 6.79 | 15.16 |
| h_cautious2 | 5.5 | 24.55 | 6.42 | 12.62 |
| h_mixed | 4.85 | 21.8 | 5.33 | 10.55 |

원정 = 원정을 나간 날 · 원정 조사 물건 = 원정 지도에서 조사한 물건(봇 tripSearch: 닫힌 수납·조사 원정 사건이 가리키는 물건) · 연 수납 = holds 를 열어 얻은 횟수(엔진 s.stats.holds) · 조사로 걸린 원정 사건 = when 에 inspect: 가 있는 원정 사건을 고른 횟수.

원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.
- balanced 원인 사건: d5_flood 191 · starve_you 191 · d2_shutter_arm 67 · dawn_strike 64 · d7_rot 17 · dawn_mob 14 · d9_inspection_b 11 · called_up 10
- selfish 원인 사건: called_up 205 · dawn_strike 175 · dawn_mob 94 · d10_hold 75 · starve_you 43 · d10_grab 40 · d1_night_storage 20 · d9_inspection 7
- devoted 원인 사건: starve_you 150 · d5_flood 148 · d2_shutter_arm 129 · d4_spanner 102 · patrol_pact 58 · dawn_strike 54 · d7_rot 35 · d5_rail_body 27
- silent 원인 사건: starve_you 208 · d5_flood 191 · dawn_strike 65 · d2_shutter_arm 64 · dawn_mob 13 · d7_rot 12 · patrol_pact 10 · d4_spanner 9
- caller 원인 사건: d5_flood 176 · starve_you 165 · dawn_strike 99 · d2_shutter_arm 76 · d4_spanner 57 · d7_rot 20 · d9_inspection_b 16 · d9_inspection 15
- lazy 원인 사건: dawn_strike 199 · d5_flood 181 · starve_you 158 · d2_shutter_arm 61 · dawn_strike_d6 43 · dawn_mob 20 · d9_inspection 12 · d7_rot 12
- diligent 원인 사건: starve_you 230 · d5_flood 180 · d2_shutter_arm 71 · d9_inspection 21 · d7_rot 18 · d4_spanner 11 · called_up 11 · d1_night_storage 6
- risky 원인 사건: d5_flood 175 · trip_b2_pumproom 76 · d4_spanner 70 · trip_a2_stockroom 57 · d2_shutter_arm 53 · d6_shutter_b 41 · called_up 41 · trip_b2_drowned 36
- steward 원인 사건: starve_you 255 · d5_flood 171 · d2_shutter_arm 88 · dawn_strike 50 · d9_inspection 24 · d9_inspection_b 10 · patrol_pact 8 · dawn_strike_d6 8
- counter 원인 사건: dawn_strike 145 · called_up 121 · d5_flood 116 · starve_you 100 · d2_shutter_arm 99 · d4_spanner 98 · dawn_mob 87 · dawn_strike_d6 30
- child 원인 사건: called_up 205 · d6_shutter_b 166 · dawn_strike 147 · dawn_mob 134 · d5_flood 102 · d10_hold 31 · dawn_mob_d6 19 · starve_you 14
- selfish_nb 원인 사건: dawn_strike 187 · called_up 168 · dawn_mob 149 · d10_hold 56 · d10_grab 42 · starve_you 22 · d1_night_storage 17 · dawn_mob_d6 14
- selfish_rt 원인 사건: called_up 296 · dawn_mob 289 · dawn_strike 223 · d5_flood 50 · dawn_mob_d6 23 · starve_you 17 · d10_hold 9 · dawn_strike_d6 8
- selfish_rt0 원인 사건: dawn_mob 297 · called_up 296 · dawn_strike 222 · d5_flood 50 · dawn_mob_d6 23 · starve_you 15 · d10_hold 11 · dawn_strike_d6 8
- h_random 원인 사건: pro_stairs 489 · starve_you 158 · d3_called_you 94 · d2_night_shutter 37 · dawn_mob 33 · called_up 26 · d6_shutter 24 · d5_flood 22
- h_wary 원인 사건: pro_stairs 489 · dawn_mob 116 · called_up 109 · dawn_strike 84 · starve_you 19 · d5_flood 18 · d8_patrol_return 15 · d1_night_storage 12
- h_first 원인 사건: dawn_strike 68 · trip_a2_stockroom 64 · d10_grab 42 · dawn_mob 31 · starve_you 23 · called_up 21 · d10_hold 17 · d1_night_storage 9
- h_cautious 원인 사건: starve_you 97 · d10_grab 48 · dawn_strike 47 · d10_hold 23 · called_up 17 · dawn_mob 16 · dawn_strike_d6 2 · night:steal_meds_again 1
- h_cautious2 원인 사건: dawn_strike 143 · starve_you 125 · d5_flood 92 · dawn_mob 74 · d10_grab 34 · called_up 29 · d7_rot 14 · d10_hold 12
- h_mixed 원인 사건: pro_stairs 193 · dawn_mob 109 · called_up 93 · dawn_strike 76 · starve_you 53 · d10_grab 32 · d10_hold 26 · trip_b2_pumproom 14

### 정체 묶음 평균 (A3 분석 §5: 성향 봇 8종 · 사람 흉내 5종, 블록 합산)
| 묶음 | driver | conductor | inspector | passenger | counted | platform_one | counting_child |
|---|---|---|---|---|---|---|---|
| 성향 봇 (balanced·selfish·devoted·silent·caller·steward·counter·child) | 17.6 | 13.4 | 17.3 | 20.4 | 13.2 | 4 | 14.1 |
| 사람 흉내 (h_random·h_wary·h_cautious·h_cautious2·h_mixed) | 10.9 | 17.2 | 5.7 | 25.9 | 13 | 20.7 | 6.6 |

## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±5%p 밖 / △ 블록마다 다르거나 ±5%p 안, 확정 안 함 / ✗ 모든 블록 미달)
정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).
| 항목 | 합격선 | 실측 시드 1~200 | 실측 시드 1001~1200 | 실측 시드 2001~2200 | 실측 시드 3001~3200 | 실측 시드 8001~8200 | 합산 | 판정 | 스냅샷(P1-11 전) |
|---|---|---|---|---|---|---|---|---|---|
| 당신 사망(올라감 포함) | ≥ 50% | 61.5% | 55% | 62% | 61% | 60.5% | 60% | △ | 61.7% (합산) [✓] |
| 사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음) | 100% | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | 100% (형식 기준 100%) | △ | 100% (형식 기준 100%) (합산) [△] |
| 강제 사망 = 확정 사망 (고를 때 열린 선택지 전부 살 확률 0, 전 정책 합산) | 0 판 (10-24 tightrope R1: 살 확률 > 0 인 주사위는 강제가 아니다) | 0 판 (0%, 0/2855) | 0 판 (0%, 0/2792) | 0 판 (0%, 0/2783) | 0 판 (0%, 0/2789) | 0 판 (0%, 0/2846) | 0 판 (0%, 0/14065) | ✓ | 0 판 (0%, 0/14570) (합산) [✓] |
|   강제 사망 중 앞선 자유 경고 선택 없음 (전 정책) | 0 판 | 0 판 | 0 판 | 0 판 | 0 판 | 0 판 | 0 판 | ✓ | 0 판 (합산) [✓] |
|   참고: 위험 0 출구가 없던 죽음 (옛 강제 정의 — 카르마 판의 줄타기는 일부러 그렇다, 전 정책) | 측정 | 1393 판 (그중 줄타기 판정 1264) | 1336 판 (그중 줄타기 판정 1250) | 1314 판 (그중 줄타기 판정 1246) | 1358 판 (그중 줄타기 판정 1259) | 1372 판 (그중 줄타기 판정 1276) | 6773 판 (그중 줄타기 판정 6295) | ✓ | 7496 판 (그중 줄타기 판정 6677) (합산) [✓] |
| 조심형 봇 사망 (balanced·silent·lazy·diligent·steward·selfish_nb 합산) | 측정 | 64.2% (770/1200), 그중 강제 0% | 63.8% (766/1200), 그중 강제 0% | 62.2% (746/1200), 그중 강제 0% | 60.6% (727/1200), 그중 강제 0% | 64.8% (778/1200), 그중 강제 0% | 63.1% (3787/6000), 그중 강제 0% | ✓ | 65.1% (3905/6000), 그중 강제 0% (합산) [✓] |
|   봇 버릇 점검: 조심형이 평범한 대안(안 죽고·금기 아니고·죽음 글 없음)을 두고 죽음 글 선택지로 죽음 | 0 판 | 0 판 (전 정책 427) | 4 판 (전 정책 407) | 4 판 (전 정책 444) | 1 판 (전 정책 449) | 1 판 (전 정책 440) | 10 판 (전 정책 2167) | △ | 0 판 (전 정책 1760) (합산) [✓] |
|   참고: 몸 꺼림 정책(selfish·selfish_rt)의 같은 죽음 — 조심형이 아니다(10-24 검증) | 측정 | selfish 0 · selfish_rt 17 판 | selfish 0 · selfish_rt 19 판 | selfish 0 · selfish_rt 30 판 | selfish 0 · selfish_rt 19 판 | selfish 0 · selfish_rt 14 판 | selfish 0 · selfish_rt 99 판 | ✓ | selfish 1 · selfish_rt 85 판 (합산) [✓] |
| 전멸 | ≤ 25% | 9% | 14% | 10% | 14% | 8% | 11% | ✓ | 12.2% (합산) [✓] |
| 밤 사건 수 / 판 (주민 사건만 — 시계·방치 판정 줄 뺌) | ≥ 6 | 14.28 (방치 판정 줄 6.84) | 14.38 (방치 판정 줄 6.64) | 14.68 (방치 판정 줄 6.7) | 14.16 (방치 판정 줄 6.58) | 14.34 (방치 판정 줄 6.65) | 14.37 (방치 판정 줄 6.68) | ✓ | 14.18 (방치 판정 줄 6.64) (합산) [✓] |
|   그중 malice / hymn | ≥ 2 / ≥ 1 | 5.91 / 3.6 | 5.85 / 3.46 | 5.98 / 3.51 | 5.56 / 3.55 | 5.91 / 3.6 | 5.84 / 3.54 | ✓ | 5.78 / 3.61 (합산) [✓] |
| 발견율 (보통) | 측정만 (10-24 A4: 하한 폐기) | 67.9% | 66.3% | 67% | 69.2% | 68.5% | 67.8% | ✓ | 68.5% (합산) [✓] |
| 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 47.6% | 47.8% | 46.3% | 47.9% | 46.6% | 47.2% | ✓ | 48% (합산) [✓] |
| 끝까지 모르는 사건 ≥1 (게으름) | 100% 판 | 97.5% | 96.5% | 97.5% | 97.5% | 98% | 97.4% | ✓ | 96.3% (합산) [△] |
| 찬가 발견율 (부지런) | ≥ 70% | 100% | 100% | 100% | 100% | 100% | 100% | ✓ | 100% (합산) [✓] |
| 찬가 발견율 (게으름) | 측정만 (10-24 A4: 하한 폐기) | 78.6% | 79.5% | 80.8% | 79.5% | 76.4% | 78.9% | ✓ | 76.3% (합산) [✓] |
| 정체 — 성향 봇 평균, 각 후보 (A3) | 각 ≥ 3% | passenger 20.6 · conductor 12.4 · counting_child 13.9 · platform_one 4.3 · driver 17.9 · counted 13.2 · inspector 17.7 (8종) | platform_one 4.1 · passenger 20.5 · conductor 13.7 · driver 17.1 · counted 13.2 · counting_child 14.4 · inspector 17 (8종) | platform_one 3.9 · passenger 19.8 · conductor 14.6 · inspector 17.3 · driver 17.3 · counted 13.3 · counting_child 13.9 (8종) | inspector 17.2 · passenger 19.9 · conductor 13.1 · platform_one 4.3 · counting_child 13.9 · driver 18.3 · counted 13.4 (8종) | conductor 13.3 · passenger 21.2 · platform_one 3.4 · counted 12.9 · driver 17.6 · inspector 17.4 · counting_child 14.3 (8종) | passenger 20.4 · conductor 13.4 · counting_child 14.1 · platform_one 4 · driver 17.6 · counted 13.2 · inspector 17.3 (8종) | △ | conductor 13.2 · passenger 20.5 · platform_one 6.6 · counting_child 13.2 · inspector 16.3 · driver 16.8 · counted 13.4 (8종) (합산) [✓] |
| 정체 — 성향 봇 평균, 가장 큰 후보 (A3) | ≤ 40% | passenger 20.6% | passenger 20.5% | passenger 19.8% | passenger 19.9% | passenger 21.2% | passenger 20.4% | ✓ | passenger 20.5% (합산) [✓] |
| 정체 — 사람 흉내 평균, 각 후보 (A3, 프롤로그 사망 판 뺌) | 각 ≥ 3% | counted 11.8 · platform_one 21.3 · driver 10.5 · conductor 15 · counting_child 7.1 · inspector 7.3 · passenger 27.1 (5종) | conductor 18.5 · driver 9.4 · inspector 5.1 · counted 14.2 · platform_one 19.9 · passenger 24.1 · counting_child 8.8 (5종) | driver 12.2 · platform_one 20.7 · counted 13.4 · passenger 25 · counting_child 5 · inspector 5.9 · conductor 17.7 (5종) | counted 13 · passenger 27.2 · driver 11.4 · platform_one 19.9 · counting_child 6.2 · inspector 5.6 · conductor 16.8 (5종) | counting_child 6 · counted 12.8 · driver 10.8 · inspector 4.9 · passenger 26 · platform_one 21.4 · conductor 17.9 (5종) | counted 13 · platform_one 20.7 · driver 10.9 · conductor 17.2 · counting_child 6.6 · inspector 5.7 · passenger 25.9 (5종) | ✓ | counting_child 6.9 · platform_one 25 · counted 12.4 · passenger 34.2 · conductor 10.3 · driver 7 · inspector 4.1 (5종) (합산) [△] |
| 정체 — 사람 흉내 평균, 가장 큰 후보 (A3, 프롤로그 사망 판 뺌) | 측정 (디렉터 확인: 승객이 가장 흔한 결말) | passenger 27.1% | passenger 24.1% | passenger 25% | passenger 27.2% | passenger 26% | passenger 25.9% | ✓ | passenger 34.2% (합산) [✓] |
|   참고: 사람 흉내 평균 (옛 방식 — 프롤로그 사망 포함) · 프롤로그(D0) 사망 판 비율 | 측정 | counted 6.4 · passenger 43.1 · platform_one 22.4 · driver 6.5 · conductor 12.6 · counting_child 4.3 · inspector 4.7 · 가장 큰 passenger 43.1% ‖ D0 사망 h_random 51.5% · h_wary 51.5% · h_cautious 0% · h_cautious2 0% · h_mixed 22% | conductor 15 · passenger 39.3 · driver 5.8 · inspector 3.7 · counted 8.4 · platform_one 22.2 · counting_child 5.6 · 가장 큰 passenger 39.3% ‖ D0 사망 h_random 50% · h_wary 50% · h_cautious 0% · h_cautious2 0% · h_mixed 20% | driver 7.5 · passenger 39.4 · platform_one 21.8 · counted 8.3 · counting_child 3.4 · inspector 4.2 · conductor 15.4 · 가장 큰 passenger 39.4% ‖ D0 사망 h_random 48% · h_wary 48% · h_cautious 0% · h_cautious2 0% · h_mixed 17% | platform_one 22.2 · passenger 40.5 · counted 7.6 · driver 7.6 · counting_child 3.9 · inspector 4.1 · conductor 14.1 · 가장 큰 passenger 40.5% ‖ D0 사망 h_random 49% · h_wary 49% · h_cautious 0% · h_cautious2 0% · h_mixed 17% | platform_one 23.9 · counting_child 3.9 · passenger 39.1 · counted 8.1 · driver 7 · inspector 3.4 · conductor 14.6 · 가장 큰 passenger 39.1% ‖ D0 사망 h_random 46% · h_wary 46% · h_cautious 0% · h_cautious2 0% · h_mixed 20.5% | counted 7.8 · passenger 40.3 · platform_one 22.5 · driver 6.9 · conductor 14.3 · counting_child 4.2 · inspector 4 · 가장 큰 passenger 40.3% ‖ D0 사망 h_random 48.9% · h_wary 48.9% · h_cautious 0% · h_cautious2 0% · h_mixed 19.3% | ✓ | counting_child 4.3 · passenger 47.3 · platform_one 26.3 · counted 7 · conductor 8.7 · driver 3.9 · inspector 2.5 · 가장 큰 passenger 47.3% ‖ D0 사망 h_random 48.9% · h_wary 48.9% · h_cautious 0% · h_cautious2 0% · h_mixed 19.3% (합산) [✓] |
| 정체 분포 (옛 방식: 정책 전체 평균, 각 후보) | 측정 (옛 합격선 ≥ 7.1%) | passenger 35.3% · conductor 13.7% · counting_child 9.5% · platform_one 11.8% · driver 13.5% · counted 7.8% · inspector 8.4% | platform_one 11.2% · passenger 34.6% · conductor 15.5% · driver 12.8% · counted 8.4% · counting_child 9.7% · inspector 7.9% | platform_one 10.7% · passenger 34.9% · conductor 16.2% · inspector 8.1% · driver 13.1% · counted 8.4% · counting_child 8.7% | inspector 8.1% · passenger 35.5% · conductor 14.5% · platform_one 11.1% · counting_child 8.8% · driver 13.6% · counted 8.4% | conductor 15.1% · passenger 35.6% · platform_one 11.6% · counted 8.3% · driver 13.1% · inspector 8% · counting_child 8.4% | passenger 35.2% · conductor 15% · counting_child 9% · platform_one 11.3% · driver 13.2% · counted 8.3% · inspector 8.1% | ✓ | conductor 12.9% · passenger 38% · platform_one 14.8% · counting_child 7.5% · inspector 7.2% · driver 10.5% · counted 9.1% (합산) [✓] |
|   옛 방식: 7후보 중 ≥7% 인 후보 수 | 측정 (옛 합격선 ≥ 5) | 7 후보 | 7 후보 | 7 후보 | 7 후보 | 7 후보 | 7 후보 | ✓ | 7 후보 (합산) [✓] |
| explicit 사건 / 판 | ≥ 7 | 11.87 | 11.9 | 11.94 | 11.84 | 11.73 | 11.85 | ✓ | 10.26 (합산) [✓] |
| 하루 결정 수 | ≥ 5 | 26.89 | 27.07 | 26.56 | 26.92 | 27.2 | 26.93 | ✓ | 23.09 (합산) [✓] |
| 명부 사인 빈칸 비율 | 측정만 | 66.2% | 65.2% | 60.3% | 63.1% | 60% | 63% | ✓ | 64% (합산) [✓] |
| 모험 봇 열흘 생존 | ≥ 25% (10-24 바꿈 ≥40 → 25, 디렉터 확인) | 21.5% | 25.5% | 23.5% | 24.5% | 25% | 24% | △ | 29.4% (합산) [△] |
| 모험 봇 사망 중 굶주림 | < 50% | 0% | 0% | 0% | 0% | 0% | 0% | ✓ | 0% (합산) [✓] |
| 열차 결말 도달 (모험 / 균형) | > 0% | 12% / 0% | 10.5% / 0% | 7% / 0% | 11.5% / 0% | 8.5% / 0% | 9.9% / 0% | ✓ | 10.7% / 0% (합산) [✓] |
| A2 D5까지 당신 사망 (균형) | ≥ 10% | 27.5% | 27% | 24.5% | 26% | 27.5% | 26.5% | ✓ | 24.8% (합산) [✓] |
| A2 균형 사망 중 한 사건 비중 (사인 사건) | ≤ 40% | d5_flood 29.3% | d5_flood 34.5% | d5_flood 29.8% | d5_flood 34.4% | d5_flood 31.4% | d5_flood 31.8% | ✓ | fever_night 30.1% (합산) [△] |
| A2 균형 사망 중 한 사건 비중 (원인 사건 = 부상 출처) | ≤ 40% | starve_you 31.7% | d5_flood 34.5% | starve_you 37.9% | d5_flood 34.4% | d5_flood 31.4% | d5_flood 31.8% | △ | starve_you 31% (합산) [△] |
| A2 D2·D4·D5 날마다 그날 사건으로 죽은 판 (조심형 합산 — 신중한 플레이어, 깔때기 사건 뺌) | 날마다 > 0 | D2 43 · D4 14 · D5 186 | D2 48 · D4 13 · D5 201 | D2 42 · D4 3 · D5 184 | D2 50 · D4 3 · D5 192 | D2 41 · D4 10 · D5 227 | D2 224 · D4 43 · D5 990 | ✓ | D2 245 · D4 189 · D5 820 (합산) [✓] |
|   A2 D3·D6 그날 사건으로 죽은 판 (조심형 합산 — D3 규칙을 배우는 날 · D6 값을 치르면 사는 날, 10-24 디렉터) | 측정 | D3 0 · D6 11 | D3 0 · D6 23 | D3 0 · D6 20 | D3 0 · D6 14 | D3 0 · D6 10 | D3 0 · D6 78 | ✓ | D3 2 · D6 116 (합산) [✓] |
|   참고: 같은 값 — 성향 봇 8종 / 사람 흉내(h_random 뺌) / 전 정책 합산(옛 줄) | 측정 | 성향 D2 44 · D3 0 · D4 58 · D5 232 · D6 81 ‖ 사람 D2 3 · D3 0 · D4 1 · D5 37 · D6 20 ‖ 전 D2 94 · D3 22 · D4 90 · D5 426 · D6 297 | 성향 D2 63 · D3 0 · D4 50 · D5 245 · D6 92 ‖ 사람 D2 2 · D3 0 · D4 2 · D5 33 · D6 21 ‖ 전 D2 102 · D3 21 · D4 95 · D5 446 · D6 304 | 성향 D2 66 · D3 1 · D4 58 · D5 239 · D6 79 ‖ 사람 D2 1 · D3 0 · D4 2 · D5 41 · D6 18 ‖ 전 D2 97 · D3 21 · D4 95 · D5 467 · D6 279 | 성향 D2 69 · D3 0 · D4 51 · D5 241 · D6 90 ‖ 사람 D2 1 · D3 0 · D4 1 · D5 42 · D6 21 ‖ 전 D2 110 · D3 21 · D4 78 · D5 452 · D6 296 | 성향 D2 59 · D3 1 · D4 59 · D5 266 · D6 83 ‖ 사람 D2 0 · D3 0 · D4 1 · D5 32 · D6 22 ‖ 전 D2 85 · D3 26 · D4 103 · D5 441 · D6 295 | 성향 D2 301 · D3 2 · D4 276 · D5 1223 · D6 425 ‖ 사람 D2 7 · D3 0 · D4 7 · D5 185 · D6 102 ‖ 전 D2 488 · D3 111 · D4 461 · D5 2232 · D6 1471 | ✓ | 성향 D2 311 · D3 3 · D4 390 · D5 1109 · D6 354 ‖ 사람 D2 14 · D3 0 · D4 36 · D5 182 · D6 270 ‖ 전 D2 506 · D3 123 · D4 689 · D5 2140 · D6 1610 (합산) [✓] |
| A1 이른 안전: D1~D4 생존 − 균형 (버릇 없는 이기적 각각) | ≥ +5%p | selfish_nb +4.5 / selfish_rt0 +4.5%p (균형 94.5) | selfish_nb +7 / selfish_rt0 +7%p (균형 93) | selfish_nb +4 / selfish_rt0 +3.5%p (균형 96) | selfish_nb +4 / selfish_rt0 +4%p (균형 95.5) | selfish_nb +5 / selfish_rt0 +4.5%p (균형 94.5) | selfish_nb +4.9 / selfish_rt0 +4.7%p (균형 94.7) | △ | selfish_nb +8.4 / selfish_rt0 +8.3%p (균형 90.9) (합산) [△] |
| A1 이기심의 값: 열흘 생존 − 균형 (버릇 없는 이기적 각각 — selfish_nb·selfish_rt0) | < 0 (모든 정책) | selfish_nb -4 / selfish_rt0 -34%p | selfish_nb -10.5 / selfish_rt0 -37.5%p | selfish_nb -8.5 / selfish_rt0 -32.5%p | selfish_nb -6.5 / selfish_rt0 -32%p | selfish_nb -12.5 / selfish_rt0 -31.5%p | selfish_nb -8.4 / selfish_rt0 -33.5%p | △ | selfish_nb -14.3 / selfish_rt0 -34.2%p (합산) [✓] |
|   참고: 몸 꺼림 버릇이 있는 이기적(selfish·selfish_rt) 열흘 생존 − 균형 — 이기심의 값이 아니다(10-24 검증 A1) | 측정 | selfish -6.5 / selfish_rt -33%p | selfish -10.5 / selfish_rt -37%p | selfish -6 / selfish_rt -32.5%p | selfish -9 / selfish_rt -33%p | selfish -6.5 / selfish_rt -32%p | selfish -7.7 / selfish_rt -33.5%p | ✓ | selfish -14.8 / selfish_rt -33.5%p (합산) [✓] |
| A1 이기적 사인 쏠림 (버릇 없는 이기적, 사망 ≥ 10%인 정책만) | ≤ 60% | selfish_nb called_up 26% / selfish_rt0 called_up 38.2% | selfish_nb dawn_strike 29% / selfish_rt0 dawn_mob 31.9% | selfish_nb dawn_strike 31.2% / selfish_rt0 dawn_mob 30.2% | selfish_nb called_up 28.9% / selfish_rt0 called_up 30.6% | selfish_nb dawn_strike 26.7% / selfish_rt0 called_up 33.7% | selfish_nb dawn_strike 26.6% / selfish_rt0 called_up 31.4% | ✓ | selfish_nb dawn_strike 28.9% / selfish_rt0 called_up 33.6% (합산) [✓] |
|   참고: 몸 꺼림 이기적 사인 쏠림 | 측정 | selfish called_up 27.9% / selfish_rt called_up 38.1% | selfish called_up 32.8% / selfish_rt dawn_mob 31% | selfish dawn_strike 28.7% / selfish_rt dawn_mob 31.7% | selfish called_up 34.3% / selfish_rt called_up 33% | selfish called_up 30.6% / selfish_rt called_up 34.6% | selfish called_up 30.3% / selfish_rt called_up 31.7% | ✓ | selfish called_up 37.6% / selfish_rt called_up 32.9% (합산) [✓] |
|   카르마 (판 끝 평균: 균형 / 이기적 4종) | 측정 | 2.01 / 8.82 · 9.49 · 13.91 · 14.02 | 2.09 / 8.62 · 8.89 · 13.12 · 13.26 | 2.32 / 8.85 · 9.46 · 13.6 · 13.79 | 2.14 / 9.17 · 9.21 · 13.63 · 13.73 | 2.17 / 8.85 · 9.27 · 13.56 · 13.68 | 2.14 / 8.86 · 9.26 · 13.56 · 13.69 | ✓ | 2.12 / 9.87 · 10.12 · 14.49 · 14.53 (합산) [✓] |
| A1 아슬함: 화면 ≤ 85% (죽을 확률 ≥ 15%) 줄타기 넘김/판 (열흘 산 판, selfish_nb) | ≥ 2 | 2.7 (산 판 69 · 산 판 줄타기 넘김 중 59.2% · 전체 판 2.05) | 2.1 (산 판 69 · 산 판 줄타기 넘김 중 52.2% · 전체 판 1.7) | 2.41 (산 판 59 · 산 판 줄타기 넘김 중 55% · 전체 판 1.84) | 2.63 (산 판 65 · 산 판 줄타기 넘김 중 59.2% · 전체 판 1.9) | 2.31 (산 판 54 · 산 판 줄타기 넘김 중 53.9% · 전체 판 1.73) | 2.43 (산 판 316 · 산 판 줄타기 넘김 중 56.1% · 전체 판 1.84) | ✓ | 3.58 (산 판 240 · 산 판 줄타기 넘김 중 80.7% · 전체 판 2.29) (합산) [✓] |
| A1 아슬함: 산 판 중 화면 ≤ 85% 줄타기 ≥ 2번 넘김 (selfish_nb) | ≥ 60% | 49.3% | 43.5% | 49.2% | 56.9% | 48.1% | 49.4% | ✗ | 70% (합산) [△] |
|   참고: 줄타기 판정 전부(90% 넘는 판정 포함 — 10-24 옛 A1 아슬함) 넘김/판 · 산 판 중 ≥ 2번 (selfish_nb) | 측정 (옛 합격선 ≥ 2 · ≥ 60%) | 4.55 · 68.1% (산 판 69 · 전체 판 3.71) | 4.03 · 78.3% (산 판 69 · 전체 판 3.3) | 4.37 · 79.7% (산 판 59 · 전체 판 3.43) | 4.45 · 76.9% (산 판 65 · 전체 판 3.42) | 4.3 · 74.1% (산 판 54 · 전체 판 3.42) | 4.34 · 75.3% (산 판 316 · 전체 판 3.46) | ✓ | 4.44 · 82.9% (산 판 240 · 전체 판 3.02) (합산) [✓] |
|   죽음 판정 넘김/판 (산 판 — 당신을 죽이는 모든 판정) | 측정 | balanced 3.58 · lazy 5 · selfish_nb 4.67 | balanced 3.23 · lazy 4.78 · selfish_nb 4.14 | balanced 3.91 · lazy 4.93 · selfish_nb 4.47 | balanced 3.31 · lazy 4.52 · selfish_nb 4.52 | balanced 3.58 · lazy 4.7 · selfish_nb 4.44 | balanced 3.51 · lazy 4.78 · selfish_nb 4.45 | ✓ | balanced 3.78 · lazy 5.19 · selfish_nb 4.79 (합산) [✓] |
|   줄타기 판정 굴림/판 (그중 줄타기로 죽은 판) | 측정 | balanced 0.45 (15판) · lazy 1.23 (34판) · selfish_nb 4.34 (126판) | balanced 0.48 (16판) · lazy 1.2 (49판) · selfish_nb 3.9 (119판) | balanced 0.65 (13판) · lazy 1.22 (35판) · selfish_nb 4.12 (137판) | balanced 0.5 (10판) · lazy 1.35 (38판) · selfish_nb 4.06 (128판) | balanced 0.68 (16판) · lazy 1.19 (37판) · selfish_nb 4.11 (139판) | balanced 0.55 (70판) · lazy 1.24 (193판) · selfish_nb 4.1 (649판) | ✓ | balanced 0.61 (78판) · lazy 1.3 (200판) · selfish_nb 3.71 (685판) (합산) [✓] |
| A4 게으름의 값 — 생존 (보통−게으름 주 지표 / 부지런−게으름) | ≥ +5%p | 보통−게으름 +12.5 / 부지런−게으름 +14%p | 보통−게으름 +19.5 / 부지런−게으름 +19.5%p | 보통−게으름 +7.5 / 부지런−게으름 +11.5%p | 보통−게으름 +6 / 부지런−게으름 +10%p | 보통−게으름 +12.5 / 부지런−게으름 +16.5%p | 보통−게으름 +12.3 / 부지런−게으름 +13.8%p (A4 블록 9개 합산) | △ (블록 9개) | 보통−게으름 +10.3 / 부지런−게으름 +14.1%p (합산) [△] |
| A4 게으름의 값 — D9 아침 주민 수 차 | > 0 | 보통−게으름 +0.13 / 부지런−게으름 +0.16 | 보통−게으름 +0.46 / 부지런−게으름 +0.51 | 보통−게으름 +0.29 / 부지런−게으름 +0.3 | 보통−게으름 -0.01 / 부지런−게으름 +0.19 | 보통−게으름 +0.04 / 부지런−게으름 +0.15 | 보통−게으름 +0.14 / 부지런−게으름 +0.23 (A4 블록 9개 합산) | △ (블록 9개) | 보통−게으름 +0.1 / 부지런−게으름 +0.22 (합산) [△] |
| A4 게으름의 값 — D7 아침 식량+물+약 차 | ≥ +0.2 | 보통−게으름 +0.3 / 부지런−게으름 +0.32 | 보통−게으름 +0.16 / 부지런−게으름 +0.36 | 보통−게으름 +0.2 / 부지런−게으름 +0.7 | 보통−게으름 +0.13 / 부지런−게으름 +0.36 | 보통−게으름 +0.54 / 부지런−게으름 +0.44 | 보통−게으름 +0.26 / 부지런−게으름 +0.38 (A4 블록 9개 합산) | △ (블록 9개) | 보통−게으름 +0.46 / 부지런−게으름 +0.73 (합산) [✓] |
|   못 본 일(missed 적용) / 판 (게으름 / 보통 / 부지런) | 측정 | 4.52 / 2.52 / 0.45 | 4.09 / 2.61 / 0.43 | 4.45 / 2.63 / 0.45 | 4.58 / 2.42 / 0.46 | 4.42 / 2.41 / 0.44 | 4.41 / 2.51 / 0.44 | ✓ | 4.19 / 2.36 / 0.45 (합산) [✓] |
|   A4 측정: 실제 발견율 — 누구나 아는 밤 뺌 (게으름 / 보통 / 부지런) | 측정 | 30.9% / 60.3% / 94.6% (옛 발견율 47.6% / 67.9% / 95.4%) | 31.1% / 58% / 95.1% (옛 발견율 47.8% / 66.3% / 95.9%) | 29.4% / 59% / 95.1% (옛 발견율 46.3% / 67% / 95.9%) | 31.1% / 61.4% / 94.5% (옛 발견율 47.9% / 69.2% / 95.4%) | 30.5% / 60.6% / 94.5% (옛 발견율 46.6% / 68.5% / 95.4%) | 30.5% / 59.6% / 95% (옛 발견율 47.2% / 67.6% / 95.8%) (A4 블록 9개 합산) | ✓ (블록 9개) | 31.9% / 60.7% / 94.5% (옛 발견율 48.2% / 68.5% / 95.4%) (합산) [✓] |
|   A4 측정: 누구나 아는 밤/판 · 숨은 밤/판 (게으름 / 보통 / 부지런) | 측정 | 3.7 / 2.72 / 2.01 · 11.59 / 11.56 / 10.71 | 3.43 / 2.86 / 2.31 · 10.77 / 11.52 / 11.22 | 3.57 / 2.87 / 2.24 · 11.33 / 11.81 / 11.29 | 3.75 / 2.85 / 2.19 · 11.64 / 11.31 / 11.16 | 3.37 / 2.86 / 2.19 · 11.2 / 11.48 / 10.74 | 3.58 / 2.88 / 2.2 · 11.28 / 11.61 / 11 (A4 블록 9개 합산) | ✓ (블록 9개) | 3.42 / 2.75 / 2.18 · 10.84 / 11.18 / 10.7 (합산) [✓] |
|   A4 측정: 눈먼 새벽/판 · 그 죽음 판 (게으름 / 보통 / 부지런) | 측정 | 1.04 / 0.31 / 0 · 33 / 13 / 0 | 1.06 / 0.3 / 0 · 42 / 11 / 0 | 0.96 / 0.26 / 0 · 29 / 9 / 0 | 1.12 / 0.24 / 0 · 30 / 10 / 0 | 0.98 / 0.36 / 0 · 32 / 10 / 0 | 1.05 / 0.3 / 0 · 316 / 92 / 0 (A4 블록 9개 합산) | ✓ (블록 9개) | 1.02 / 0.32 / 0 · 322 / 109 / 0 (합산) [✓] |
|   위기 때 값 길(비용 있는 선택)이 열린 비율 (균형) | 측정 (디렉터 확인) | d2_shutter_arm 16.4% (11/67) · d4_spanner 84.3% (97/115) · d5_flood 3.8% (7/185) | d2_shutter_arm 10.8% (7/65) · d4_spanner 86.7% (85/98) · d5_flood 5.9% (11/185) | d2_shutter_arm 17.2% (11/64) · d4_spanner 82% (82/100) · d5_flood 2.6% (5/191) | d2_shutter_arm 17.5% (11/63) · d4_spanner 89.2% (83/93) · d5_flood 6.8% (13/190) | d2_shutter_arm 10.3% (7/68) · d4_spanner 85.7% (72/84) · d5_flood 7.5% (14/186) | d2_shutter_arm 14.4% (47/327) · d4_spanner 85.5% (419/490) · d5_flood 5.3% (50/937) | ✓ | d2_shutter_arm 8% (27/337) · d4_spanner 36.7% (176/480) · d5_flood 15.9% (143/897) (합산) [✓] |
| 헌신 봇 생존 | 측정 (> 0%) | 20.5% | 23% | 19.5% | 20% | 19% | 20.4% | ✓ | 18.1% (합산) [✓] |
| 사망 원인 중 굶주림 (전 정책 합산) | < 50% | 1.9% (53/2855) | 2% (55/2792) | 2.1% (58/2783) | 2.1% (59/2789) | 1.9% (54/2846) | 2% (279/14065) | ✓ | 2.4% (353/14570) (합산) [✓] |
| 경고 없는 사망 (전 정책 합산, 강제 사망 포함) | 0 판 | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | 0 판 (그중 강제 0) | ✓ | 0 판 (그중 강제 0) (합산) [✓] |

### A4 (블록 9개 — balanced·lazy·diligent만 더 돌았다, 판정은 이 표의 블록 전부)
| 항목 | 합격선 | 실측 시드 1~200 | 실측 시드 1001~1200 | 실측 시드 2001~2200 | 실측 시드 3001~3200 | 실측 시드 8001~8200 | 실측 시드 4001~4200 | 실측 시드 5001~5200 | 실측 시드 6001~6200 | 실측 시드 7001~7200 | 합산 | 판정 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A4 게으름의 값 — 생존 (보통−게으름 주 지표 / 부지런−게으름) | ≥ +5%p | 보통−게으름 +12.5 / 부지런−게으름 +14%p | 보통−게으름 +19.5 / 부지런−게으름 +19.5%p | 보통−게으름 +7.5 / 부지런−게으름 +11.5%p | 보통−게으름 +6 / 부지런−게으름 +10%p | 보통−게으름 +12.5 / 부지런−게으름 +16.5%p | 보통−게으름 +18 / 부지런−게으름 +17%p | 보통−게으름 +17.5 / 부지런−게으름 +10%p | 보통−게으름 +8.5 / 부지런−게으름 +14%p | 보통−게으름 +9 / 부지런−게으름 +12%p | 보통−게으름 +12.3 / 부지런−게으름 +13.8%p | △ |
| A4 게으름의 값 — D9 아침 주민 수 차 | > 0 | 보통−게으름 +0.13 / 부지런−게으름 +0.16 | 보통−게으름 +0.46 / 부지런−게으름 +0.51 | 보통−게으름 +0.29 / 부지런−게으름 +0.3 | 보통−게으름 -0.01 / 부지런−게으름 +0.19 | 보통−게으름 +0.04 / 부지런−게으름 +0.15 | 보통−게으름 +0.27 / 부지런−게으름 +0.55 | 보통−게으름 -0.07 / 부지런−게으름 -0.06 | 보통−게으름 +0.01 / 부지런−게으름 +0.15 | 보통−게으름 +0.2 / 부지런−게으름 +0.25 | 보통−게으름 +0.14 / 부지런−게으름 +0.23 | △ |
| A4 게으름의 값 — D7 아침 식량+물+약 차 | ≥ +0.2 | 보통−게으름 +0.3 / 부지런−게으름 +0.32 | 보통−게으름 +0.16 / 부지런−게으름 +0.36 | 보통−게으름 +0.2 / 부지런−게으름 +0.7 | 보통−게으름 +0.13 / 부지런−게으름 +0.36 | 보통−게으름 +0.54 / 부지런−게으름 +0.44 | 보통−게으름 +0.58 / 부지런−게으름 +0.31 | 보통−게으름 +0.05 / 부지런−게으름 +0.22 | 보통−게으름 +0.21 / 부지런−게으름 +0.38 | 보통−게으름 +0.11 / 부지런−게으름 +0.29 | 보통−게으름 +0.26 / 부지런−게으름 +0.38 | △ |
|   못 본 일(missed 적용) / 판 (게으름 / 보통 / 부지런) | 측정 | 4.52 / 2.52 / 0.45 | 4.09 / 2.61 / 0.43 | 4.45 / 2.63 / 0.45 | 4.58 / 2.42 / 0.46 | 4.42 / 2.41 / 0.44 | 4.44 / 2.57 / 0.43 | 4.62 / 2.71 / 0.3 | 4.31 / 2.5 / 0.4 | 4.46 / 2.6 / 0.4 | 4.43 / 2.55 / 0.42 | ✓ |
|   A4 측정: 실제 발견율 — 누구나 아는 밤 뺌 (게으름 / 보통 / 부지런) | 측정 | 30.9% / 60.3% / 94.6% (옛 발견율 47.6% / 67.9% / 95.4%) | 31.1% / 58% / 95.1% (옛 발견율 47.8% / 66.3% / 95.9%) | 29.4% / 59% / 95.1% (옛 발견율 46.3% / 67% / 95.9%) | 31.1% / 61.4% / 94.5% (옛 발견율 47.9% / 69.2% / 95.4%) | 30.5% / 60.6% / 94.5% (옛 발견율 46.6% / 68.5% / 95.4%) | 29.5% / 60% / 94.8% (옛 발견율 46.5% / 68% / 95.7%) | 30.2% / 59% / 95.8% (옛 발견율 46.7% / 67.3% / 96.5%) | 30.9% / 59% / 95% (옛 발견율 47.3% / 67.3% / 95.8%) | 30.8% / 59.3% / 95.3% (옛 발견율 48.4% / 67.3% / 96.1%) | 30.5% / 59.6% / 95% (옛 발견율 47.2% / 67.6% / 95.8%) | ✓ |
|   A4 측정: 누구나 아는 밤/판 · 숨은 밤/판 (게으름 / 보통 / 부지런) | 측정 | 3.7 / 2.72 / 2.01 · 11.59 / 11.56 / 10.71 | 3.43 / 2.86 / 2.31 · 10.77 / 11.52 / 11.22 | 3.57 / 2.87 / 2.24 · 11.33 / 11.81 / 11.29 | 3.75 / 2.85 / 2.19 · 11.64 / 11.31 / 11.16 | 3.37 / 2.86 / 2.19 · 11.2 / 11.48 / 10.74 | 3.63 / 3 / 2.15 · 11.4 / 11.92 / 10.83 | 3.53 / 3.07 / 2.15 · 11.43 / 11.99 / 10.7 | 3.45 / 2.89 / 2.26 · 11.09 / 11.42 / 10.87 | 3.79 / 2.82 / 2.32 · 11.11 / 11.46 / 11.48 | 3.58 / 2.88 / 2.2 · 11.28 / 11.61 / 11 | ✓ |
|   A4 측정: 눈먼 새벽/판 · 그 죽음 판 (게으름 / 보통 / 부지런) | 측정 | 1.04 / 0.31 / 0 · 33 / 13 / 0 | 1.06 / 0.3 / 0 · 42 / 11 / 0 | 0.96 / 0.26 / 0 · 29 / 9 / 0 | 1.12 / 0.24 / 0 · 30 / 10 / 0 | 0.98 / 0.36 / 0 · 32 / 10 / 0 | 1.06 / 0.26 / 0 · 39 / 10 / 0 | 1.09 / 0.3 / 0 · 32 / 7 / 0 | 1.02 / 0.31 / 0 · 37 / 17 / 0 | 1.13 / 0.34 / 0 · 42 / 5 / 0 | 1.05 / 0.3 / 0 · 316 / 92 / 0 | ✓ |

A4 정책 합산 (블록 9개): balanced 생존 40.7% · D9 주민 3.13 · D7 자원 2.64 · 못 본 일/판 2.55 · 발견 67.6% / lazy 생존 28.4% · D9 주민 2.99 · D7 자원 2.38 · 못 본 일/판 4.43 · 발견 47.2% / diligent 생존 42.2% · D9 주민 3.22 · D7 자원 2.76 · 못 본 일/판 0.42 · 발견 95.8%

<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->
