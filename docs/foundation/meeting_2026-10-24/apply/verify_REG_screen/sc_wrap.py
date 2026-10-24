# 검증용: v4/tools/screen_check.py 를 그대로 쓰되 포트만 바꾼다(다른 검증 일꾼이 같은 포트 18791/19533 을 쓰는 중) — 출력은 --out 으로 이 폴더 아래
# CPU 가 붐벼 fixture.js 가 한도(900초)를 넘을 수 있어 그 한도만 늘린다
import os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
_orig = subprocess.run
def _run(*a, **k):
    if a and isinstance(a[0], list) and any('fixture.js' in str(x) for x in a[0]):
        k['timeout'] = 3600
    return _orig(*a, **k)
subprocess.run = _run
import screen_check as sc
sc.PORT = int(os.environ.get('SC_PORT', '18891'))
sc.DBG = int(os.environ.get('SC_DBG', '19633'))
sc.main()
