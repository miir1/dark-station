# 어두운 역 v3 — 쯔꾸르풍 (시험판)

v2의 규칙 엔진(`../v2/data.js`, `../v2/engine.js`)을 그대로 쓰고, 화면만 타일 맵 + 대화창 + 턴제 전투로 바꾼 버전.

- `index.html` · `style.css` — 화면 틀, 폰용 방향 버튼(▲▼◀▶)·조사·메뉴
- `sprites.js` — Kenney 1-Bit Pack(CC0, `assets/LICENSE_kenney_1bit.txt`) 타일 시트에서 잘라 색을 입혀 그림
- `maps.js` — 을지로입구역 맵(사람은 오늘 배치된 일터에 선다), 원정 던전 4장(시장 A1·A2, 수문 B1·B2)
- `ui.js` — 대화창 (Promise로 열고 고른 값으로 닫힘, 키보드·터치)
- `battle.js` — 부위(머리·몸통·팔·다리)를 노리는 턴제 전투. 끝나면 엔진 `expFight`에 결과·부러진 부위를 넘김
- `game.js` — 맵 걷기·조명(전력 없으면 어둡다)·침수(선로부터 물이 찬다)·조사·단계 흐름(프롤로그·저녁·밤·승차·결말)

조작: 방향키/WASD 이동, Z·Enter·Space 조사/선택, X·Esc 메뉴/취소. 폰은 아래 버튼.
저장: localStorage `darkstation.v3.save` (v2 저장과 따로).
개발: `http://localhost:8512/v3/index.html?fixture=morning_mid` (v2 픽스처 사용), 콘솔 `__ds3`.
