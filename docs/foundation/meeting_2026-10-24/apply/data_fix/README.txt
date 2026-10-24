데이터 담당 — 10-24 검증 잔여 16건 (2026-10-24 저녁). 파일 목록과 다시 만드는 법만 적는다.

- fix_data.js      : 고친 표를 만드는 스크립트. before_fix/(이 작업 전 v4/data 복사본)를 읽어 v4/data 에 쓴다. 몇 번 돌려도 같다.
                     node fix_data.js [원본 폴더=before_fix] [쓸 폴더=v4/data] [손잡이 JSON]
                     새·바뀐 글은 문장 검사(문장 40자·결과 3문장·선택 18자·경고 30자·이유 24자·금지 낱말·숫자)를 통과해야 쓴다.
                     손잡이 endureGamble:1 = 디렉터 확인용 변형(카르마 8 이상이면 '버틴다'도 판정 + 갚기 늘 열림). 기본 0 — 표에는 안 넣었다.
                     손잡이 railFail:1 = starve_you 선로 밑 실패 부상 1 (시험만, 기본 2 = 그대로).
- before_fix/      : 이 작업 전 표. 되돌리려면 이 폴더 파일을 v4/data 로 복사한다.
- snapbase/        : 비교용으로 얼려 둔 엔진·봇 사본(18:4x 시점) + 고치기 전 표. 엔진 담당이 같은 시간에 봇·통계를 고치고 있어서
                     전후 비교는 이 사본 하나로 했다 (cp -r snapbase/v4/{engine,sim} <새폴더>/v4/ 후 데이터만 바꿔 run.js).
- base_run.txt     : 시작할 때(옛 엔진) 그대로 잰 값 — 검증 sim_full.txt 와 같은 숫자(재현 확인)
- base2_run.txt    : snapbase 엔진 + 고치기 전 표 (전, 20정책 × 200판 × 4블록)
- final_s_run.txt  : snapbase 엔진 + 고친 표 (후, 같은 조건)
- v1s_run.txt      : 같은 조건, railFail 1 시험 · v1g_run.txt : 디렉터 변형(endureGamble 1) 시험 · v2s_run.txt : 의자 자리만 다른 최종안
- live_after_100.txt : 지금 v4(살아 있는 엔진) + 고친 표, run.js 100
- probe_b_compare.txt · probe_a1_compare.txt : 지적 3·4·5 재측정 (검증 probe_a1b.js·probe_a1.js 를 DS_ROOT 로 사본을 가리키게 한 것)
- reach_seoha.json : 화면에서 서하 물통·붕대(17,9)까지 걸어가 조사되는가 (probe_reach_seoha.py, 저장 D_share·A_water)
- shot_run.txt     : python v4/tools/shot.py --profile=<이 폴더>/.profile_shot (프로필은 끝나고 지웠다)
- audit_karma.js · audit_axis.js · audit_after.txt : 카르마 선택·swap 목록, 화면 비용 < 실제 목록, 축 효과 목록 (읽기만)
- summarize.js · probe_axes.js · probe_disc.js : 보고서 줄 뽑기·정책별 축 분포·밤 행 발견 수 (읽기만)
