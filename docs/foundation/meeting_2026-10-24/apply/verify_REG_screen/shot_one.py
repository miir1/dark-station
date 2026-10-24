# 검증용: shot.py 의 shot() 으로 목록 밖 지점 하나를 찍는다 (예: open). 출력·프로필은 이 폴더 아래
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
import shot
shot.OUT = os.path.join(HERE, 'shots_extra')
shot.PROFILE = os.path.join(HERE, '.profile_one')
shot.PORT = 8779
key = sys.argv[1]
shot.BUDGET[key] = int(sys.argv[2]) if len(sys.argv) > 2 else 120000
httpd = shot.serve()
log = []
try:
    shot.shot(shot.find_browser(), key, 'zz_' + key, log)
finally:
    httpd.shutdown()
with open(os.path.join(HERE, 'shots_extra', 'zz_' + key + '.json'), 'w', encoding='utf-8') as f:
    json.dump(log, f, ensure_ascii=False, indent=1)
