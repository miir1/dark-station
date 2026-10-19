"""v3/img 아래 png 목록을 manifest.json으로 (게임이 이 목록만 불러온다)."""
import json
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v3', 'img')
names = []
for root, _, files in os.walk(base):
    for f in files:
        if f.endswith('.png'):
            names.append(os.path.relpath(os.path.join(root, f), base).replace(os.sep, '/')[:-4])
json.dump(sorted(names), open(os.path.join(base, 'manifest.json'), 'w'), ensure_ascii=False)
print(len(names), 'images')
