# 어두운 역 v4 — 새 밑바탕 (데이터 주도 해석기)

프로토타입(v2·v3)은 건드리지 않는다. 규칙은 전부 **표 아홉 장**(`data/*.json`, 스키마 = `docs/foundation/31_tables_schema.md`)에 있고, 엔진은 표를 읽는 해석기다. 순수 브라우저 JS + Node 테스트, 빌드 없음.

- `engine/` — `rng.js` 시드 난수 · `cond.js` 조건식(eval 없음) · `schema.js` 표 검증(어느 표 몇 번째 행 어느 열이 틀렸는지) · `tables.js` 로더 · `effects.js` 효과 동사 7종 · `night.js` 밤 사건 굴림(당신 위치 비조건) · `identity.js` 정체 함수(조건식+priority+fallback) · `ledger.js` 명부(사인 빈칸 허용) · `engine.js` `dispatch(state, action, db)` 해석기 · `save.js` 자동 저장 1 + 직전 아침 사본 + 마이그레이션 + 복구
- `data/` — 기반설계 부장이 채우는 실제 표(`phases/numbers/events/people/maps/lines/night_events/objects/identity.json`). 아직 비어 있을 수 있다.
- `test/` — `node --test "v4/test/*.test.js"` (C:\dev\dark_station 에서). 테스트용 작은 표는 `test/fixtures/*.json`(스키마 예시 행). `data/` 를 읽지 않는다.
- 브라우저: `<script>` 로 rng → cond → schema → tables → identity → effects → night → ledger → engine → save 순서로 읽으면 `window.DS4.*` 에 붙는다. 표는 fetch 해서 `DS4.tables.load({...})` 에 넘긴다.
- 상태는 함수 없는 순수 JSON(난수 포함). 화면은 `DS4.engine.view(state, db)` 만 읽고, 조작은 `dispatch` 로만. `DS4.engine.setFast(true)` 가 `?fast=1` 훅(연출 지연 상수 전부 0).
- 표 검사만 하려면: `node -e "console.log(require('./v4/engine/tables.js').validate(require('./v4/engine/tables.js').loadDir('v4/data').raw))"` — 오류가 있으면 `TableError` 가 행·열을 적어 준다.
