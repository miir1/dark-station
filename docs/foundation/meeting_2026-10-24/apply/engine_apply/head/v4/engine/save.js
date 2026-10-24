// 어두운 역 v4 — 저장. 자동 저장 하나(ds4.save) + 직전 아침 사본(ds4.save.prev, 복구 전용, 화면에 안 보임) + 마이그레이션 체인.
// 복구 규칙(회의 쟁점 8): 저장이 깨지면 ① 직전 아침 사본으로 돌아가고 한 줄 안내 ② 둘 다 깨지면 새 게임 + 깨진 원본을 ds4.save.broken 에 보관.
// storage: localStorage 처럼 getItem/setItem/removeItem 을 가진 것이면 된다 (Node 테스트는 memoryStorage()).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : root.DS4.engine;

  const KEY = 'ds4.save';
  const KEY_PREV = 'ds4.save.prev';
  const KEY_BROKEN = 'ds4.save.broken';

  // 버전 n 의 저장을 n+1 로 올리는 함수들. 저장 형식을 바꾸는 커밋은 여기에 한 칸을 더하고 테스트(옛 fixture 로드)를 같이 둔다.
  const MIGRATIONS = {
    0: (raw) => { raw.v = 1; if (!raw.ledger) raw.ledger = { causes: {}, written: [] }; return raw; },
  };
  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let v = Number.isInteger(raw.v) ? raw.v : 0;
    let guard = 0;
    while (v < E.SAVE_V && guard++ < 20) {
      const fn = MIGRATIONS[v];
      if (!fn) return null;
      raw = fn(raw); v = raw.v;
    }
    return raw.v === E.SAVE_V ? raw : null;
  }

  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _map: m };
  }

  function createStore(opts) {
    opts = opts || {};
    const st = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
    const db = opts.db;
    const key = opts.key || KEY, keyPrev = key + '.prev', keyBroken = key + '.broken';
    const read = (k) => { try { return st.getItem(k); } catch (e) { return null; } };
    const write = (k, v) => { try { st.setItem(k, v); return true; } catch (e) { return false; } };
    const parse = (text) => { if (text == null) return null; try { return E.normalize(migrate(JSON.parse(text)), db); } catch (e) { return null; } };

    function save(state) { return write(key, JSON.stringify(state)); }
    // 아침(첫 단계) 진입 때 한 번: 직전 아침 사본 갱신. 플레이어가 돌릴 수 있는 것이 아니다.
    function markMorning(state) { return write(keyPrev, JSON.stringify(state)); }
    // 돌려주는 값: { state, recovered, broken, fresh, message }
    function load() {
      const mainText = read(key);
      const main = parse(mainText);
      if (main) return { state: main, recovered: false, broken: false, fresh: mainText == null, message: '' };
      if (mainText == null) return { state: null, recovered: false, broken: false, fresh: true, message: '' };
      const prev = parse(read(keyPrev));
      if (prev) { write(key, JSON.stringify(prev)); return { state: prev, recovered: true, broken: false, fresh: false, message: '저장이 깨져 직전 아침으로 돌아갔다.' }; }
      write(keyBroken, mainText);
      try { st.removeItem(key); } catch (e) { /* 무시 */ }
      return { state: null, recovered: false, broken: true, fresh: true, message: '저장을 읽을 수 없어 새로 시작한다.' };
    }
    function clear() { for (const k of [key, keyPrev]) { try { st.removeItem(k); } catch (e) { /* 무시 */ } } }
    // 정상 저장이 한 번 되면 깨진 원본은 지운다
    function clearBroken() { try { st.removeItem(keyBroken); } catch (e) { /* 무시 */ } }
    const exportCode = (state) => btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const importCode = (code) => { try { return parse(decodeURIComponent(escape(atob(String(code || '').trim())))); } catch (e) { return null; } };
    return { save, markMorning, load, clear, clearBroken, exportCode, importCode, keys: { main: key, prev: keyPrev, broken: keyBroken } };
  }

  const API = { KEY, KEY_PREV, KEY_BROKEN, MIGRATIONS, migrate, createStore, memoryStorage };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).save = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
