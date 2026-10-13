// 어두운 역 — 화면
(function () {
  'use strict';
  const D = window.DS_DATA, E = window.DS_ENGINE;
  const SAVE_KEY = 'darkstation.save.v1';
  const rng = Math.random;

  let s = load();
  const ui = { tab: 'station', district: null, pack: { food: 0, water: 0, meds: 0 }, lastLogId: s.logSeq };

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const costText = (cost) => Object.entries(cost).map(([k, v]) => `${D.RES[k]} ${v}`).join(', ');

  function load() {
    try { return E.normalize(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { return E.newState(); }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* 저장 불가 환경 */ }
  }

  // 같은 내용이면 다시 그리지 않음 (클릭 중 버튼이 바뀌지 않도록)
  function setHTML(el, html) {
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
  }

  function btn(act, label, opts) {
    opts = opts || {};
    const attrs = [`data-act="${act}"`];
    if (opts.arg != null) attrs.push(`data-arg="${esc(opts.arg)}"`);
    if (opts.cd) attrs.push(`data-cd="${opts.cd}"`);
    if (opts.disabled) attrs.push('disabled');
    const sub = opts.sub ? `<small>${esc(opts.sub)}</small>` : '';
    return `<button type="button" class="btn" ${attrs.join(' ')}>${esc(label)}${sub}${opts.cd ? '<span class="cd"></span>' : ''}</button>`;
  }

  // ── 역사 ──
  function stationView() {
    const f = s.flags;
    let h = `<p class="status-line">${esc(D.FIRE_TEXT[s.fire])}. ${esc(D.ROOM_TEXT[s.fire])}.</p>`;
    h += '<div class="row">';
    if (!f.fireLit || s.fire === 0) h += btn('light', '난로에 불 붙이기', { sub: '땔감 5', disabled: s.res.fuel < 5 });
    else h += btn('stoke', '땔감 넣기', { cd: 'stoke', sub: '땔감 1', disabled: s.cd.stoke > 0 || s.fire >= 4 || s.res.fuel < 1 });
    if (f.fireLit) h += btn('gather', '선로 뒤지기', { cd: 'gather', disabled: s.cd.gather > 0 });
    if (s.buildings.trap) h += btn('traps', '덫 확인', { cd: 'traps', disabled: s.cd.traps > 0 });
    h += '</div>';

    if (f.builderReady) {
      const list = Object.keys(D.BUILDINGS).filter((id) => E.buildVisible(s, id));
      if (list.length) {
        h += '<h2>짓기</h2><div class="grid-list">';
        for (const id of list) {
          const b = D.BUILDINGS[id], n = s.buildings[id] || 0;
          const maxed = n >= b.max;
          const label = b.max > 1 && n ? `${b.name} (${n})` : b.name;
          h += btn('build', label, { arg: id, disabled: !E.canBuild(s, id), sub: maxed ? (b.max > 1 ? '최대' : '완료') : `${costText(E.buildCost(s, id))} · ${b.desc}` });
        }
        h += '</div>';
      }
    }
    if (s.buildings.workbench) {
      h += '<h2>제작</h2><div class="grid-list">';
      for (const [id, it] of Object.entries(D.ITEMS)) {
        h += btn('craft', it.name, { arg: id, disabled: !E.canCraft(s, id), sub: s.items[id] ? '보유' : `${costText(it.cost)} · ${it.desc}` });
      }
      h += '</div>';
    }
    if (s.pop > 0) {
      h += `<h2>생존자 ${s.pop} / ${E.popCap(s)}</h2><div class="jobs">`;
      h += `<span>땔감 줍기 <span class="hint">(땔감 +2)</span></span><span class="step"><span>${E.idle(s)}</span></span>`;
      for (const [id, j] of Object.entries(D.JOBS)) {
        if (!E.jobVisible(s, id)) continue;
        const n = s.workers[id] || 0;
        const prod = Object.entries(j.prod).map(([k, v]) => `${D.RES[k]} ${v > 0 ? '+' : ''}${v}`).join(', ');
        h += `<span>${esc(j.name)} <span class="hint">(${esc(prod)})</span></span><span class="step">` +
          `<button type="button" data-act="assign" data-arg="${id}:-1" ${n < 1 ? 'disabled' : ''} aria-label="줄이기">−</button>` +
          `<span>${n}</span>` +
          `<button type="button" data-act="assign" data-arg="${id}:1" ${E.idle(s) < 1 ? 'disabled' : ''} aria-label="늘리기">+</button></span>`;
      }
      h += `</div><p class="hint">10초마다 생산. 식량은 3명당 1씩 소비.</p>`;
    }
    return h;
  }

  // ── 지상 (원정 준비) ──
  function surfaceView() {
    const list = E.districtList(s);
    if (!ui.district || !list.includes(ui.district)) ui.district = list.find((id) => !s.districts[id].cleared) || list[0];
    let h = '<h2>지상</h2>';
    for (const id of list) {
      const d = D.DISTRICTS[id], st = s.districts[id];
      const meta = [`${d.steps.length}구역`, d.fog ? '안개' : '', st.cleared ? '탐색 완료' : ''].filter(Boolean).join(' · ');
      h += `<div class="district ${ui.district === id ? 'picked' : ''}"><span>${esc(d.name)} <span class="meta">${esc(meta)}</span></span>` +
        btn('pick', ui.district === id ? '선택됨' : '선택', { arg: id, disabled: ui.district === id }) + '</div>';
    }
    if (!ui.district) return h;
    const d = D.DISTRICTS[ui.district];
    const need = d.steps.length;
    h += `<h2>배낭 (${packTotal()} / ${E.capacity(s)})</h2><div class="pack">`;
    for (const k of ['food', 'water', 'meds']) {
      const v = ui.pack[k];
      h += `<span>${D.RES[k]} <span class="hint">(역 보유 ${s.res[k]})</span></span><span class="step">` +
        `<button type="button" data-act="pack" data-arg="${k}:-1" ${v < 1 ? 'disabled' : ''} aria-label="빼기">−</button><span>${v}</span>` +
        `<button type="button" data-act="pack" data-arg="${k}:1" ${v >= s.res[k] || packTotal() >= E.capacity(s) ? 'disabled' : ''} aria-label="넣기">+</button></span>`;
    }
    h += '</div>';
    h += `<p class="hint">한 구역 이동마다 식량 1·물 1. 이 지역은 ${need}구역이라 각각 ${need}개면 충분하다. 약품은 원정 중 체력 +4.</p>`;
    if (d.fog && !s.items.mask) h += '<p class="warn">안개 지역: 방독면이 없으면 구역마다 체력 -1.</p>';
    const why = E.canStart(s, ui.district, ui.pack);
    if (why) h += `<p class="warn">${esc(why)}</p>`;
    h += btn('depart', `${d.name}(으)로 출발`, { disabled: !!why });
    return h;
  }
  const packTotal = () => ui.pack.food + ui.pack.water + ui.pack.meds;

  // ── 원정 진행 ──
  function expeditionView() {
    const exp = s.expedition, d = D.DISTRICTS[exp.district];
    const ev = D.EVENTS[exp.queue[exp.index]];
    let h = `<p class="event-step">${esc(d.name)} · ${exp.index + 1} / ${exp.queue.length}구역</p>`;
    h += `<h3 class="event-title">${esc(ev.title)}</h3>`;
    if (exp.phase === 'event') {
      if (exp.notes && exp.notes.length) h += `<p class="notes">${esc(exp.notes.join(' · '))}</p>`;
      h += `<p class="event-text">${esc(ev.text)}</p><div class="choices">`;
      ev.choices.forEach((c, i) => {
        const st = E.choiceState(s, c);
        let meta = '';
        if (st.locked) meta = `<span class="choice-meta">🔒 ${esc(st.reason)}</span>`;
        else {
          const parts = [];
          if (c.cost) parts.push(costText(c.cost) + ' 소모');
          if (st.chance != null) parts.push(`${D.SKILLS[c.check.skill]} 판정 ${Math.round(st.chance * 100)}%`);
          if (c.req) parts.push('조건 충족');
          if (parts.length) meta = `<span class="choice-meta ${c.req ? 'ok' : ''}">${esc(parts.join(' · '))}</span>`;
        }
        h += `<button type="button" class="btn" data-act="choose" data-arg="${i}" ${st.locked ? 'disabled' : ''}>${esc(c.text)}<small>${meta}</small></button>`;
      });
      h += '</div>';
    } else {
      const r = exp.result;
      h += `<div class="result"><p class="picked">▸ ${esc(r.choice)}</p>`;
      if (r.roll) h += `<p class="roll ${r.roll.success ? 'ok' : 'no'}">판정 ${Math.round(r.roll.chance * 100)}% — ${r.roll.success ? '성공' : '실패'}</p>`;
      if (r.text) h += `<p>${esc(r.text)}</p>`;
      if (r.lines.length) h += `<ul>${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
      h += '</div><div class="row">';
      const last = exp.index + 1 >= exp.queue.length;
      if (last) h += btn('proceed', '탐색을 마치고 역으로 돌아간다');
      else {
        h += btn('proceed', '계속 나아간다', { sub: '식량 1 · 물 1' });
        h += btn('return', '역으로 돌아간다', { sub: '가진 것을 챙겨 귀환' });
      }
      h += '</div>';
    }
    return h;
  }

  // ── 옆 패널 ──
  function sideView() {
    let h = '<div class="box"><h2>창고</h2>';
    for (const [k, name] of Object.entries(D.RES)) {
      if (s.res[k] > 0 || (k === 'fuel') || (k === 'scrap' && s.flags.fireLit)) h += `<div class="kv"><span>${name}</span><span>${s.res[k]}</span></div>`;
    }
    h += '</div>';
    const owned = Object.keys(D.ITEMS).filter((id) => s.items[id]);
    if (owned.length) h += `<div class="box"><h2>도구</h2>${owned.map((id) => `<div class="kv"><span>${D.ITEMS[id].name}</span><span></span></div>`).join('')}</div>`;
    if (s.flags.expeditions) {
      const p = s.player;
      h += '<div class="box"><h2>나</h2>';
      h += `<div class="kv"><span>체력</span><span>${p.hp} / ${p.maxHp}</span></div><div class="bar hp"><i style="width:${p.hp / p.maxHp * 100}%"></i></div>`;
      h += `<div class="kv"><span>정신력</span><span>${p.mind} / ${p.maxMind}</span></div><div class="bar mind"><i style="width:${p.mind / p.maxMind * 100}%"></i></div>`;
      for (const [k, name] of Object.entries(D.SKILLS)) h += `<div class="kv"><span>${name}</span><span>${p.skills[k]}</span></div>`;
      if (!s.expedition) h += '<p class="hint">역에 불이 있으면 10초마다 체력·정신력 +1.</p>';
      h += '</div>';
    }
    if (s.expedition) {
      const exp = s.expedition;
      h += `<div class="box"><h2>배낭 ${E.packLoad(exp)} / ${E.capacity(s)}</h2>`;
      for (const k of Object.keys(D.RES)) {
        const v = (exp.pack[k] || 0) + (exp.loot[k] || 0);
        if (v > 0) h += `<div class="kv"><span>${D.RES[k]}</span><span>${v}</span></div>`;
      }
      const meds = (exp.pack.meds || 0) + (exp.loot.meds || 0);
      if (meds > 0) h += btn('med', '약품 사용', { sub: '체력 +4', disabled: s.player.hp >= s.player.maxHp || exp.phase !== 'event' });
      h += '</div>';
    }
    return h;
  }

  function logView() {
    return s.log.slice(0, 30).map((l, i) =>
      `<p class="${esc(l.kind)}${l.id > ui.lastLogId ? ' new' : ''}" style="opacity:${Math.max(0.15, 1 - i * 0.045).toFixed(2)}">${esc(l.text)}</p>`).join('');
  }

  function tabsView() {
    if (s.expedition || !s.flags.expeditions) return '';
    return `<button type="button" data-act="tab" data-arg="station" class="${ui.tab === 'station' ? 'on' : ''}">어두운 역</button>` +
      `<button type="button" data-act="tab" data-arg="surface" class="${ui.tab === 'surface' ? 'on' : ''}">지상</button>`;
  }

  function endingView() {
    const en = D.ENDINGS[s.ended];
    const min = Math.round(s.time / 60);
    return `<div class="ending"><h1>${esc(en.title)}</h1><p>${esc(en.text)}</p>` +
      `<p class="hint">플레이 시간 ${min}분 · 생존자 ${s.pop}명 · 탐색한 지역 ${Object.values(s.districts).filter((d) => d.cleared).length}곳</p>` +
      btn('reset', '처음부터 다시') + '</div>';
  }

  function render() {
    setHTML($('tabs'), tabsView());
    let view;
    if (s.expedition) view = expeditionView();
    else if (ui.tab === 'surface' && s.flags.expeditions) view = surfaceView();
    else view = stationView();
    setHTML($('view'), view);
    setHTML($('sidePane'), sideView());
    setHTML($('logPane'), logView());
    ui.lastLogId = s.logSeq;
    // 쿨다운 막대
    for (const el of document.querySelectorAll('[data-cd]')) {
      const k = el.dataset.cd;
      const bar = el.querySelector('.cd');
      if (bar) bar.style.width = (s.cd[k] > 0 ? (s.cd[k] / E.CD[k]) * 100 : 0) + '%';
    }
    const ov = $('overlay');
    if (s.ended) { setHTML(ov, endingView()); ov.hidden = false; } else ov.hidden = true;
    document.title = s.expedition ? `어두운 역 · ${D.DISTRICTS[s.expedition.district].name}` : '어두운 역';
  }

  const actions = {
    light: () => E.light(s),
    stoke: () => E.stoke(s),
    gather: () => E.gather(s, rng),
    traps: () => E.checkTraps(s, rng),
    build: (id) => E.build(s, id),
    craft: (id) => E.craft(s, id),
    assign: (arg) => { const [id, d] = arg.split(':'); E.assign(s, id, +d); },
    tab: (t) => { ui.tab = t; },
    pick: (id) => { ui.district = id; },
    pack: (arg) => {
      const [k, d] = arg.split(':');
      ui.pack[k] = Math.max(0, Math.min(s.res[k], ui.pack[k] + +d));
    },
    depart: () => {
      if (E.startExpedition(s, ui.district, ui.pack, rng)) ui.pack = { food: 0, water: 0, meds: 0 };
    },
    choose: (i) => E.choose(s, +i, rng),
    proceed: () => { E.proceed(s); if (!s.expedition) ui.tab = 'station'; },
    return: () => { E.returnHome(s); ui.tab = 'station'; },
    med: () => E.useMed(s),
    reset: () => {
      if (!confirm('지금까지의 진행을 지우고 처음부터 시작할까요?')) return;
      s = E.newState(); ui.tab = 'station'; ui.district = null; ui.pack = { food: 0, water: 0, meds: 0 }; ui.lastLogId = 0;
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    fn(el.dataset.arg);
    save();
    render();
  });

  // 다른 탭에 있으면 시간 정지
  setInterval(() => {
    if (document.hidden) return;
    E.tick(s, rng);
    if (s.time % 5 === 0) save();
    render();
  }, 1000);

  // 앱을 닫거나 내려도 진행이 남도록
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // 앱 설치·오프라인 실행
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
  window.__ds = { get state() { return s; } }; // 디버그용
})();
