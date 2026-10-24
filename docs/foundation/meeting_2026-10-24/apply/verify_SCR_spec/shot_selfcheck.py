# 검증용: shot.py 판정이 '지점에 못 닿은' 캡처를 실패로 치는가 (진짜 Chrome 실행, 결과는 이 폴더 shots_neg/)
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import shot
shot.OUT = os.path.join(HERE, 'shots_neg')
shot.PORT = 8867
shot.PROFILE = os.path.join(HERE, '.profile_shotneg')
shot.RETRY = 0
res = {}
# 1) 가상 시간 3초 — night3 에 닿을 수 없다
shot.BUDGET['night3'] = 3000
httpd = shot.serve()
log = []
try:
    b = shot.find_browser()
    shot.shot(b, 'night3', 'neg_night3_short', log)
    # 2) 없는 지점 이름 — 봇 HOLD 가 없다 → 끝까지 돌아도 reached=1 이 없어야
    shot.BUDGET['nosuch'] = 20000
    shot.shot(b, 'nosuch', 'neg_nosuch', log)
finally:
    httpd.shutdown()
# 3) 판정 함수: 같은 줄인데 다른 지점 / reached=0 / 접두가 같은 지점 이름
fake = lambda s: ['[1:2:INFO:CONSOLE(1)] "' + s + '", source: x']
png = os.path.join(shot.OUT, 'neg_night3_short.png')
res['judge'] = {
  'other_key': shot.judge(png, fake('[ds4 auto] night5 hold reached=1 D5 night'), 'night3')[0],
  'reached0': shot.judge(png, fake('[ds4 auto] night3 end reached=0 D3 night'), 'night3')[0],
  'prefix_called3_vs_called3l': shot.judge(png, fake('[ds4 auto] called3l hold reached=1 D3 night'), 'called3')[0],
  'ok_line': shot.judge(png, fake('[ds4 auto] night3 hold reached=1 D3 night'), 'night3')[0],
  'dropped_rows': shot.judge(png, fake('[ds4 auto] night3 hold reached=1 D3 night') + ['[1:2:INFO:CONSOLE(9)] "[ds4] 표 검증 실패 행을 빼고 읽었다:", source: x'], 'night3')[0],
}
res['runs'] = [{k: x[k] for k in ('shot', 'ok', 'why', 'auto')} for x in log]
with open(os.path.join(HERE, 'shot_selfcheck.json'), 'w', encoding='utf-8') as f:
    json.dump(res, f, ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
