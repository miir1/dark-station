// 어두운 역 v4 — 브라우저 접착층. 엔진 파일은 그대로 두고, 표를 fetch 해서 db 를 만들고 ?fast=1 같은 주소 훅만 읽는다.
// 엔진 파일(rng → cond → schema → tables → identity → effects → night → ledger → engine → save)을 먼저 <script> 로 읽은 뒤 이 파일을 읽는다.
(function (root) {
  'use strict';
  const D4 = root.DS4;
  if (!D4 || !D4.tables || !D4.engine) throw new Error('DS4 엔진이 먼저 읽혀야 한다');

  const params = new URLSearchParams(root.location ? root.location.search : '');
  const fast = params.get('fast') === '1';
  if (fast) D4.engine.setFast(true);

  // data/*.json 아홉 장을 읽어 db 로. nightEvents 는 night_events.json 과 nightEvents.json 둘 다 시도한다.
  async function loadTables(base) {
    base = base || 'data/';
    const files = Object.assign({}, D4.tables.FILES);
    const out = {};
    for (const [k, f] of Object.entries(files)) {
      // 같은 표의 다른 파일 이름(nightEvents.json)이 있으면 그것부터 — 지금 data/ 에 있는 쪽이라 404 가 콘솔에 남지 않는다
      const names = D4.tables.ALT_FILES[k] ? [D4.tables.ALT_FILES[k], f] : [f];
      let r = null;
      for (const n of names) { r = await fetch(base + n, { cache: 'no-cache' }); if (r.ok) break; }
      if (!r.ok) throw new Error(`표 파일을 읽지 못했다: ${k} (${f})`);
      out[k] = await r.json();
    }
    dropped.length = 0;
    try { return D4.tables.load(out); }
    catch (e) {
      // 표가 고쳐지는 중이면(검증 실패) 틀린 행만 빼고 다시 읽는다 — 화면은 돌아간다. 엔진·표 담당에게 그대로 넘길 것.
      // (2026-10-24 검토 지적 13) 빠진 행이 눈에 보이게: 콘솔 오류(error — shot.py 가 캡처 실패로 친다) + dropped 목록(game.js 가 첫 화면 토스트로 알린다)
      if (!e.errors) throw e;
      const bad = {};
      for (const err of e.errors) { const m = /^(\w+)\[(\d+)\]/.exec(err.text || ''); if (!m) throw e; (bad[m[1]] = bad[m[1]] || new Set()).add(Number(m[2])); }
      for (const [table, idx] of Object.entries(bad)) {
        if (!Array.isArray(out[table])) throw e;
        out[table].forEach((row, i) => { if (idx.has(i)) dropped.push({ table, i, id: row && row.id ? row.id : '' }); });
        out[table] = out[table].filter((row, i) => !idx.has(i));
      }
      console.error('[ds4] 표 검증 실패 행을 빼고 읽었다:\n' + e.errors.map((x) => '  ' + x.text).join('\n'));
      return D4.tables.load(out);
    }
  }
  const dropped = [];                                // 마지막 loadTables 가 빼고 읽은 행 [{table, i, id}]

  // 대사표: 같은 id 의 여러 행 중 context 가 맞는 것. 여러 개면 마지막(더 구체적인 행이 뒤에 온다는 약속). pickRow 로 고르는 규칙을 바꿀 수 있다.
  function pickLine(db, id, ctx, pickRow) {
    const rows = db.lines[id];
    if (!rows || !rows.length) return null;
    const fit = rows.filter((l) => { try { return D4.cond.test(l.context, ctx); } catch (e) { return false; } });
    if (!fit.length) return null;
    return pickRow ? pickRow(fit) : fit[fit.length - 1];
  }
  // 조건식이 보는 값 (엔진 phaseCtx 와 같은 모양 + 정체 축). alive: 엔진과 같이 away(아직 역에 안 온 사람)도 살아 있음
  function lineCtx(s) {
    const ctx = Object.assign({}, s.world, s.axes, { day: s.day });
    ctx.flags = s.flags; ctx.phase = s.phase || '';
    ctx.map = s.pos.map || ''; ctx.region = s.trip ? s.trip.region : ''; ctx.floor = s.trip ? s.trip.floor : 0;
    ctx.trace = {}; for (const [id, t] of Object.entries(s.traces)) ctx.trace[id] = t.st;
    ctx.alive = {}; for (const p of Object.values(s.people)) { ctx.alive[p.id] = p.status === 'home' || p.status === 'away' ? 1 : 0; for (const [k, v] of Object.entries(p.n)) ctx[`${k}_${p.id}`] = v; }
    const c = D4.engine.identity(s, db_);
    ctx.identity = c ? c.id : '';
    return ctx;
  }
  // 조건 낱말 수 (말 걸기 줄 고르기: 조건이 많은 줄 = 더 구체적인 줄)
  function condWords(src) { try { return D4.cond.names(D4.cond.compile(src)).length; } catch (e) { return 0; } }
  // 말 걸기 줄 고르기 (2026-10-24 P0-S5, game.js talkTo · v4/tools/audit_narrative_timeline.js 가 같이 쓴다):
  //   그 사람의 맞는 줄 전부(<사람>_* — _idle 빼고) 가운데 ① 오늘 안 들은 줄 ② 조건 낱말이 많은 줄 ③ 표에서 뒤에 오는 줄.
  //   돌려주는 값 { id, i(행 번호), row, key('<줄id>#<행번호>' = 엔진 heard 열쇠), fresh(오늘 안 들었나), words } 또는 null
  function talkPick(db, s, who, ctx) {
    ctx = ctx || lineCtx(s);
    const heard = s.heard || {};
    const cands = [];
    let order = 0;
    for (const id of Object.keys(db.lines)) {
      if (!id.startsWith(who + '_') || id === who + '_idle') continue;
      db.lines[id].forEach((row, i) => {
        let ok = false;
        try { ok = D4.cond.test(row.context, ctx); } catch (e) { ok = false; }
        if (!ok) return;
        const key = `${id}#${i}`;
        cands.push({ id, i, row, key, fresh: heard[key] !== s.day, words: condWords(row.context), order: order++ });
      });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => (Number(b.fresh) - Number(a.fresh)) || (b.words - a.words) || (b.order - a.order));
    return cands[0];
  }
  let db_ = null;
  const setDb = (db) => { db_ = db; };
  // {who:이/가} 같은 조사 치환. who 는 사람 이름.
  function fill(text, who) {
    return String(text || '').replace(/\{who(?::([^}]+))?\}/g, (m, josa) => {
      if (!josa) return who || '';
      const name = who || '';
      const PAIRS = { '이가': '이/가', '은는': '은/는', '을를': '을/를', '과와': '과/와' };
      const parts = (PAIRS[josa] || josa).split('/');
      const last = name.charCodeAt(name.length - 1);
      const hasFinal = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 !== 0 : false;
      if (parts.length === 1) return name + parts[0];
      return name + (hasFinal ? parts[0] : parts[1]);
    });
  }

  D4.browser = { params, fast, loadTables, pickLine, lineCtx, setDb, fill, talkPick, condWords, dropped };
})(typeof globalThis !== 'undefined' ? globalThis : this);
