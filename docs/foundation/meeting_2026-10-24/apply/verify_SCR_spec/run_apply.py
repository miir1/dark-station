# 검증용: screen_check.py apply 를 다른 포트·결과 폴더로 다시 돌린다 (연타 검사는 probe.py space 가 따로 — --n=0)
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC
SC.PORT, SC.DBG = 18897, 19641
sys.argv = [sys.argv[0], 'apply', '--n=0', '--out=' + os.path.join(HERE, 'rerun_apply')]
SC.main()
