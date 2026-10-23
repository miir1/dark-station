# 검수용(2026-10-24, U4 아이템 배치): 지도의 아이템 자리를 헤드리스 Chrome 으로 찍는다. 게임 파일은 건드리지 않는다.
# 방법: ?fast=1&auto=car 로 전동차에서 멈춘 게임을 iframe 에 띄우고, 밖에서 __ds4.scene(지도·당신 자리)만 바꿔 그 지도를 비춘다.
#       (상태·흔적은 D0 첫 상태 그대로 — 물건의 '기본 그림'과 크기를 보는 용도)
# 결과: docs/foundation/meeting_2026-10-24/audit_shots/map_<이름>.png
# 실행: python v4/tools/audit_items_shots.py   (C:\dev\dark_station 에서)
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import shot  # noqa: E402  (서버·브라우저 찾기만 빌려 쓴다)

ROOT = shot.ROOT
OUT_REL = 'docs/foundation/meeting_2026-10-24/audit_shots'
OUT = os.path.join(ROOT, *OUT_REL.split('/'))
PROBE = os.path.join(OUT, 'probe.html')
SPOTS = [('car_cab', 'car', 17, 3), ('station_store', 'station', 8, 3), ('station_platform', 'station', 15, 10),
         ('tunnel', 'tunnel', 9, 2), ('mall_a1', 'mall_a1', 10, 5), ('mall_a2', 'mall_a2', 14, 5)]

PROBE_HTML = """<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}iframe{border:0;width:1280px;height:720px}</style>
<iframe id="f" src="/v4/index.html?fast=1&auto=car"></iframe>
<script>
const q = new URLSearchParams(location.search);
const f = document.getElementById('f');
const iv = setInterval(() => {
  const w = f.contentWindow; const d = w && w.__ds4;
  if (!d || !d.state || !d.scene || !d.scene.map || d.scene.map.id !== 'car') return;
  const s = d.scene, m = d.db.maps[q.get('map')]; if (!m) return;
  s.map = m; s.rows = m.rows; s.w = m.rows[0].length; s.h = m.rows.length; s.px = +q.get('x'); s.py = +q.get('y'); s.face = 'down'; s.moving = null; s.auto = null;
  clearInterval(iv);
}, 50);
</script>"""


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(PROBE, 'w', encoding='utf-8') as f:
        f.write(PROBE_HTML)
    browser = shot.find_browser()
    httpd = shot.serve()
    prof = os.path.join(OUT, '.profile')
    try:
        for name, mp, x, y in SPOTS:
            out = os.path.join(OUT, f'map_{name}.png')
            url = f'http://127.0.0.1:{shot.PORT}/{OUT_REL}/probe.html?map={mp}&x={x}&y={y}&t={int(time.time())}'
            args = [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                    f'--user-data-dir={prof}', '--window-size=1280,720', '--virtual-time-budget=20000', f'--screenshot={out}', url]
            subprocess.run(args, capture_output=True, timeout=300)
            print(('OK  ' if os.path.exists(out) else 'FAIL'), out)
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    main()
