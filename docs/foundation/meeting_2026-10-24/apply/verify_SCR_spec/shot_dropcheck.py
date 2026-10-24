# 검증용: 표 행 하나가 검증에 실패한 채(메모리에서만 events.json 에 틀린 행을 붙여 내준다) 게임이 뜨면 shot.py 가 진짜 Chrome 실행에서 FAIL 로 치는가. 파일은 고치지 않는다.
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import shot
shot.OUT = os.path.join(HERE, 'shots_neg')
shot.PORT = 8868
shot.PROFILE = os.path.join(HERE, '.profile_drop')
shot.RETRY = 0
orig = shot.Quiet.do_GET
def do_GET(self):
    if self.path.split('?')[0].endswith('/v4/data/events.json'):
        with open(os.path.join(ROOT, 'v4', 'data', 'events.json'), encoding='utf-8') as f:
            rows = json.load(f)
        rows.append({'id': 'zz_bad_row', 'kind': 'trial', 'when': 'day==99', 'text': 'x', 'choices': []})
        body = json.dumps(rows, ensure_ascii=False).encode('utf-8')
        self.send_response(200); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
    return orig(self)
shot.Quiet.do_GET = do_GET
httpd = shot.serve(); log = []
try:
    shot.shot(shot.find_browser(), 'car', 'neg_dropped_car', log)
finally:
    httpd.shutdown()
print(json.dumps([{k: x[k] for k in ('shot', 'ok', 'why', 'console_errors')} for x in log], ensure_ascii=False, indent=1))
