# 어두운 역 v4 — 그림 목록 만들기. v4/img 아래 png 를 전부 찾아 v4/img/manifest.json 에 적는다.
# 쓰기:  python v4/tools/manifest.py        (C:\dev\dark_station 에서)
# art.js 는 이 목록에 있는 그림만 읽는다 (없는 파일을 찔러 보면 콘솔에 404 가 남기 때문).
# 그림 담당이 v4/img/cg 에 <사건 id>.png 를 새로 넣으면 이것만 다시 돌리면 된다. shot.py 는 캡처 전에 자동으로 돌린다.
import os, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'v4', 'img')
OUT = os.path.join(IMG, 'manifest.json')
SKIP_DIRS = {'cg_test'}          # 수위 시험 그림은 게임에 안 쓴다


def build():
    names = []
    for dirpath, dirnames, filenames in os.walk(IMG):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.'))
        for fn in sorted(filenames):
            if not fn.lower().endswith('.png'):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), IMG).replace(os.sep, '/')
            names.append(rel[:-4])
    names.sort()
    old = None
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding='utf-8') as f:
                old = json.load(f)
        except Exception:
            old = None
    if old != names:
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump(names, f, ensure_ascii=False, indent=0)
            f.write('\n')
    return names


if __name__ == '__main__':
    got = build()
    by = {}
    for n in got:
        by.setdefault(n.split('/')[0], 0)
        by[n.split('/')[0]] += 1
    print('manifest', len(got), '|', ' '.join(f'{k} {v}' for k, v in sorted(by.items())), '->', OUT)
