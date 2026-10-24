데이터 담당 작업 기록 (2026-10-24, A1·A2·A4 데이터 몫 + 명세 검토 지적의 데이터 몫 + A3 B1·B2 + 10-24 검증 잔여)

- apply_data.js : 고친 표를 만드는 스크립트. before_data/(고치기 전 v4/data 복사본)를 읽어 v4/data 에 쓴다. 몇 번 돌려도 같다.
                  node apply_data.js [원본 폴더] [쓸 폴더] [손잡이 JSON]  — 손잡이 기본값은 파일 맨 위 K (명세 §8 + 검토 지적).
                  새·바뀐 글은 스크립트가 문장 검사(문장 40자·결과 3문장·선택 18자·토스트 30자·금지 낱말)를 한 뒤에만 쓴다.
- before_data/   : 고치기 전 표 (되돌릴 때 이 폴더를 v4/data 로 복사하면 된다)
- variant.sh     : 손잡이 변형을 var/v4 복사본에서만 잰다 (v4 는 안 건드림 · 쓰기 전에 v4/engine·v4/sim 을 var/v4 로 복사, 끝나면 지웠다). var_*.md = 변형별 결과
                  (base = 첫 판 · v2 mobAll · v12 사다리 확률↑ · v123 원한 습격 곁가지(기각: 이른 안전 깎임) · v124 카르마 ≥5 원한 습격 · v125 A4 손잡이 · sw75 땀 75(기각: 균형 사망 두 블록 50 아래) · fl75 범람 75(채택))
- run_iter1.md   : 첫 판(사다리 곁가지만, 손잡이 기본) 20정책 × 100판 × 4블록
- dump.js · picks.js · nights.js · ladder.js · views.js · late.js · probe_box.js : 읽기만 하는 점검 스크립트
    picks.js <정책> <판수> <사건 정규식>  = 사건·선택을 고른 횟수와 그 선택으로 끝난 판
    nights.js <정책> <판수>               = 밤 사건·방치 판정 줄 수와 사인
    views.js <정책> <판수> <사건,…>       = 새 사건이 화면에 보이는 모습(eventView) 첫 장면
    late.js (POL=정책)                     = 조사에서 '<줄>_late' 글과 toast_late 가 실제로 나오는지
- 전후 비교: ../data_before_100.md (고치기 전 표) · ../data_after_100.md (고친 뒤, --compare 로 전 값 열이 붙어 있다)
