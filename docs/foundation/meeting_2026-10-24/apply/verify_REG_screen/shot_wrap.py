# 검증용: v4/tools/shot.py 를 그대로 쓰되 출력(PNG·shots.json)과 프로필을 이 폴더 아래로 돌린다 (v4/shots 를 덮지 않는다)
# 다른 검증 일꾼들이 동시에 시뮬을 돌려 CPU 가 붐빈다 → fixture.js 시간 한도만 600초에서 3000초로 늘린다 (판정 규칙은 그대로)
import os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
_orig = subprocess.run
def _run(*a, **k):
    if a and isinstance(a[0], list) and any('fixture.js' in str(x) for x in a[0]):
        k['timeout'] = 3000
    return _orig(*a, **k)
subprocess.run = _run
import shot
shot.OUT = os.path.join(HERE, 'shots')
shot.PROFILE = os.path.join(HERE, '.profile')
shot.PORT = int(os.environ.get('SHOT_PORT', '8765'))
shot.main()
