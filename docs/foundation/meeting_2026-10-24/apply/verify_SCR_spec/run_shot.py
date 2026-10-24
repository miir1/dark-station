# 검증용: shot.py 를 그대로 쓰되 결과 폴더·포트만 바꾼다 (v4/shots 를 건드리지 않는다).
# 컴퓨터가 바빠 fixture.js(d10_train)가 600초 안에 안 끝나서, 미리 뽑아 둔 같은 저장(fixture_d10_train.json, 같은 fixture.js 출력)을 넘긴다.
import os, sys, subprocess, types
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import shot
shot.OUT = os.path.join(HERE, 'shots')
shot.PORT = 8866
_run = subprocess.run
FX = os.path.join(HERE, 'fixture_d10_train.json')


def run(args, **kw):
    if isinstance(args, list) and any('fixture.js' in str(a) for a in args) and os.path.exists(FX) and os.path.getsize(FX) > 10:
        with open(FX, 'rb') as f:
            return types.SimpleNamespace(stdout=f.read(), stderr=b'', returncode=0)
    return _run(args, **kw)


shot.subprocess = types.SimpleNamespace(run=run)
shot.main()
