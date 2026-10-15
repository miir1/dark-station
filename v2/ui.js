// 어두운 역 v2 — 화면 연결(DOM·저장). 규칙은 engine.js, 화면 문자열은 views.js.
(function () {
  'use strict';
  const E = window.DS2, V = window.DS2_VIEWS;
  const SAVE_KEY = 'darkstation.v2.save';
  const UI_KEY = 'darkstation.v2.ui';
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const devFixture = isLocal && !!qs.get('fixture');          // 개발 전용: 저장하지 않고 특정 단계 화면을 연다

  function newSeed() { return (Date.now() & 0x7fffffff) >>> 0; }
  function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
  function load() {
    const raw = readSave();
    const s = E.normalize(raw);
    return s || E.newGame(newSeed());
  }
  // 다른 탭이 더 진행했으면 그 상태를 이어받는다 (낡은 탭이 진행을 덮어쓰지 않게)
  function save() {
    if (devFixture) return;
    try {
      const stored = readSave();
      if (stored && typeof stored.rev === 'number' && stored.rev > (state.rev || 0)) {
        const s2 = E.normalize(stored);
        if (s2) { state = s2; ui.msg = '다른 탭에서 더 진행된 게임이에요. 그 진행을 이어받았어요.'; return; }
      }
      state.rev = (state.rev || 0) + 1;
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* 저장 불가 환경 */ }
  }

  let state = load();
  const ui = { tab: 'station', prep: null, msg: '' };
  try { const u = JSON.parse(sessionStorage.getItem(UI_KEY)); if (u && ['station', 'map', 'people'].includes(u.tab)) { ui.tab = u.tab; if (u.prep && window.DS2_DATA.REGIONS[u.prep.region]) ui.prep = u.prep; } } catch (e) { /* 무시 */ }
  function saveUi() { try { sessionStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, prep: ui.prep })); } catch (e) { /* 무시 */ } }

  if (devFixture) {
    const xhr = new XMLHttpRequest(); xhr.open('GET', 'fixtures/' + qs.get('fixture').replace(/[^a-z0-9_]/gi, '') + '.json', false);
    try { xhr.send(); const s = E.normalize(JSON.parse(xhr.responseText)); if (s) state = s; } catch (e) { /* 무시 */ }
    ui.tab = ['station', 'map', 'people'].includes(qs.get('tab')) ? qs.get('tab') : 'station';
    if (qs.get('prep') && window.DS2_DATA.REGIONS[qs.get('prep')]) ui.prep = { region: qs.get('prep'), party: ['gicheol', 'seoha'], pack: { food: 3, water: 2, meds: 1, items: [] } };
  }

  const lastSig = {};
  const setHTML = (el, html) => { if (lastSig[el.id] !== html) { el.innerHTML = html; lastSig[el.id] = html; } };
  let lastViewKey = '';
  const viewKey = () => [state.phase, ui.tab, state.exp && state.exp.phase, state.evening && state.evening.type, state.nightEv && !!state.nightEv.result, state.pro, !!state.proResult, state.day].join('|');

  function render() {
    // 렌더 전에 포커스·스크롤을 기억해 둔다
    const ae = document.activeElement;
    const focusKey = ae && ae.dataset && (ae.dataset.change ? `[data-change="${ae.dataset.change}"][data-rid="${ae.dataset.rid}"]` : ae.dataset.act ? `[data-act="${ae.dataset.act}"][data-arg="${ae.dataset.arg}"]` : null);
    let v;
    try { v = V.render(state, ui); }
    catch (err) {
      setHTML($('header'), '');
      setHTML($('body'), '<h2 class="ct">화면을 그리지 못했어요</h2><p class="text">저장된 게임이 현재 버전과 맞지 않는 것 같아요. 저장을 지우고 새로 시작할 수 있어요.</p><button type="button" class="btn primary" data-act="hardreset">저장을 지우고 새로 시작</button>');
      $('nav').hidden = true;
      if (window.console) console.error(err);
      return;
    }
    setHTML($('header'), v.header);
    setHTML($('body'), v.body + (ui.msg ? `<p class="toast" role="status">${V.esc(ui.msg)}</p>` : ''));
    setHTML($('nav'), v.nav);
    $('nav').hidden = !v.nav;
    $('foot').hidden = state.phase === 'ended';
    document.title = v.title;
    const key = viewKey();
    if (key !== lastViewKey) { window.scrollTo(0, 0); lastViewKey = key; }
    if (focusKey) { const el = document.querySelector(focusKey); if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } } }
    saveUi();
  }

  function act(a) {
    const snapshot = JSON.stringify(state);
    let r;
    try { r = E.dispatch(state, a); }
    catch (err) { state = JSON.parse(snapshot); r = { ok: false, error: '처리 중 문제가 생겨 직전 상태로 되돌렸어요.' }; if (window.console) console.error(err); }
    ui.msg = r.ok ? '' : r.error;
    if (r.ok) save();
    render();
    return r.ok;
  }

  let lockUntil = 0;           // 더블탭으로 결과 화면을 건너뛰지 않도록
  const handlers = {
    tab: (arg) => { ui.tab = arg; },
    prepRegion: (arg) => {
      if (ui.prep && ui.prep.region === arg) return;
      ui.prep = ui.prep ? Object.assign({}, ui.prep, { region: arg }) : { region: arg, party: [], pack: { food: 2, water: 2, meds: Math.min(1, state.res.meds), items: [] } };
      setTimeout(() => { const el = document.getElementById('prep'); if (el) el.scrollIntoView({ block: 'start' }); }, 0);
    },
    togglePartner: (arg) => {
      const p = ui.prep; if (!p) return;
      const i = p.party.indexOf(arg);
      if (i >= 0) p.party.splice(i, 1); else { if (p.party.length >= 2) p.party.shift(); p.party.push(arg); }
    },
    pack: (arg) => {
      const p = ui.prep; if (!p) return;
      const [k, d] = arg.split(':');
      const max = { food: 6, water: 6, meds: 2 }[k];
      p.pack[k] = Math.max(0, Math.min(Math.min(max, state.res[k]), p.pack[k] + Number(d)));
    },
    packItem: (arg) => { const p = ui.prep; if (!p) return; const i = p.pack.items.indexOf(arg); if (i >= 0) p.pack.items.splice(i, 1); else p.pack.items.push(arg); },
  };
  const direct = {
    proChoose: (arg) => ({ type: 'proChoose', i: Number(arg) }),
    proNext: () => ({ type: 'proNext' }),
    startProject: (arg) => ({ type: 'startProject', id: arg }),
    endDay: () => ({ type: 'endDay' }),
    expChoose: (arg) => ({ type: 'expChoose', i: Number(arg) }),
    expNext: (arg) => ({ type: 'expNext', mode: arg }),
    eveningChoose: (arg) => ({ type: 'eveningChoose', i: Number(arg) }),
    eveningDone: () => ({ type: 'eveningDone' }),
    talk: (arg) => ({ type: 'talk', rid: arg }),
    skipTalk: () => ({ type: 'skipTalk' }),
    nightChoose: (arg) => ({ type: 'nightChoose', i: Number(arg) }),
    nightDone: () => ({ type: 'nightDone' }),
    board: (arg) => ({ type: 'board', id: arg }),
    confirmBoarding: () => ({ type: 'confirmBoarding' }),
  };

  function playLog() {
    const s = state;
    const D = window.DS2_DATA;
    return JSON.stringify({ seed: s.seed, day: s.day, phase: s.phase, ending: s.ending && { tier: s.ending.tier, title: s.ending.title, ledger: s.ending.ledger, rows: s.ending.rows },
      stats: s.stats, flags: s.flags, res: s.res, flood: s.flood, exposure: s.exposure, facility: s.facility,
      residents: s.residents.map((r) => ({ name: r.name, status: r.status, stress: r.stress, injury: r.injury, trust: r.trust, talks: r.talks, mem: r.mem.map((m) => `D${m.day} ${m.text}`) })),
      history: s.history.map((h) => `${h.day ? 'D' + h.day : '프롤로그'} ${h.text}`), goalDay: D.GOAL_DAY }, null, 1);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const name = el.dataset.act, arg = el.dataset.arg;
    if (handlers[name]) { handlers[name](arg); ui.msg = ''; render(); return; }
    if (Date.now() < lockUntil) return;                                   // 방금 화면이 바뀌었다
    if (el.dataset.confirm && !window.confirm(el.dataset.confirm)) return;
    if (direct[name]) { if (act(direct[name](arg))) lockUntil = Date.now() + 350; if (state.phase !== 'morning') ui.prep = null; return; }
    if (name === 'suggest') { act({ type: 'setPlan', plan: E.suggestPlan(state) }); return; }
    if (name === 'repeat') { act({ type: 'setPlan', plan: state.lastPlan }); return; }
    if (name === 'depart') {
      const p = ui.prep;
      if (p && act({ type: 'expStart', region: p.region, party: p.party, pack: p.pack })) { ui.prep = null; ui.tab = 'station'; lockUntil = Date.now() + 350; render(); }
      return;
    }
    if (name === 'copyLog') {
      const text = playLog();
      const done = () => { ui.msg = '플레이 기록을 복사했어요. 채팅에 붙여 넣어 주세요.'; render(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('아래 내용을 복사해 주세요', text));
      else window.prompt('아래 내용을 복사해 주세요', text);
      return;
    }
    if (name === 'restart') {
      const msg = state.phase === 'ended' ? '처음부터 다시 시작할까요?' : `저장된 진행(D${Math.min(state.day, 10)})이 지워집니다. 정말 처음부터 시작할까요?`;
      if (window.confirm(msg)) { state = E.newGame(newSeed()); state.rev = ((readSave() || {}).rev || 0) + 1; ui.tab = 'station'; ui.prep = null; save(); render(); }
      return;
    }
    if (name === 'hardreset') { try { localStorage.removeItem(SAVE_KEY); sessionStorage.removeItem(UI_KEY); } catch (e2) { /* 무시 */ } location.reload(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'assign') act({ type: 'assign', rid: el.dataset.rid, task: el.value });
  });
  window.addEventListener('storage', (e) => { if (e.key === SAVE_KEY && e.newValue) { const s2 = E.normalize(JSON.parse(e.newValue)); if (s2 && (s2.rev || 0) > (state.rev || 0)) { state = s2; render(); } } });

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  render();
  if (isLocal) window.__ds2 = { get state() { return state; }, act, render };   // 디버그용 (localhost에서만)
})();
