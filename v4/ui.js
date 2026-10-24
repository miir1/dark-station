// 어두운 역 v4 — 창. 그림은 무대(#cg) 위에, 글은 아래 상자(#box, 높이 고정, 스크롤 0)에. OS confirm/alert/prompt 없음.
// 모든 창은 Promise 로 열리고 고른 값으로 닫힌다. 키: Space/Enter/Z 다음·결정, ↑↓ 고르기, 1~9 번호, Esc/X 취소(취소 가능한 창만).
// 글이 상자를 넘치면 스크롤하지 않고 다음 장으로 나눈다(한 줄 창) / 앞 문장을 덜어 낸다(선택 창 — 그 문장들은 이미 한 줄씩 지나갔다).
// 연타 보호(2026-10-24 P0-S7): 눌린 채 반복되는 키(e.repeat)는 무시 · 선택 창은 열린 뒤 결정 키를 한 번 뗀 다음부터 Space·Enter 를 받는다 ·
//   경고(warn)·금기(taboo)가 있는 선택지가 하나라도 있으면 커서 없이 열고 첫 방향키가 커서를 놓는다 · 열린 뒤 0.4초는 입력을 막는다 ·
//   방향키도 열릴 때 눌려 있었으면 한 번 뗀 다음부터 받고, 창이 열려 있는 동안 방향키 자동 반복은 버린다 (검증 #12).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DELAYS = () => (window.DS4 && DS4.engine ? DS4.engine.DELAYS : { type: 18, card: 1400, fade: 700, toast: 2000 });
  let cur = null;          // 선택 창 { resolve, options, sel, cancel, cancelValue }
  let lineCur = null;      // 한 줄 창 { next }
  let openedAt = 0;
  let bot = null;          // 봇: (kind, info) → 고를 번호 / 'hold'(그대로 둔다 = 캡처 지점) / undefined(첫 번째 열린 선택지). 플레이스루·캡처용
  const BLOCK_MS = 400;    // 선택 창이 열린 뒤 입력을 막는 시간
  const OK_KEYS = ['z', 'Z', 'Enter', ' '];
  const okDown = new Set(); // 지금 눌려 있는 결정 키
  let armed = true;        // 선택 창이 열린 뒤 결정 키를 한 번 뗐는가 (열릴 때 결정 키가 안 눌려 있었으면 처음부터 true)
  // 방향키도 같다 (2026-10-24 검증 #12): 계단 쪽으로 ↑ 를 누른 채 걸어가 Space 로 조사하면, 창이 열린 뒤에도 ↑ 자동 반복이 커서를 맨 아래(죽는 선택)에 놓고 돌렸다.
  //   선택 창·확인창이 열릴 때 방향키가 눌려 있었으면 그 키를 뗄 때까지 방향키를 받지 않는다 · 창이 열려 있는 동안 방향키 자동 반복(e.repeat)은 버린다
  const DIR_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
  const dirDown = new Set(); // 지금 눌려 있는 방향키
  let dirArmed = true;     // 선택 창이 열린 뒤 방향키를 다 뗐는가
  // 두드림 보호 (2026-10-24 검증 #4): 방향키를 '누른 채'가 아니라 '두드리며' 걸어와 Space 를 연타하면 — 커서 없는 창의 ↑ 가 맨 아래(금기·죽음)에 커서를 놓고,
  //   확인창의 다음 ↑ 가 '그렇게 한다'로 옮겨 1.4초 안에 죽었다. 이제
  //   ① 커서 없는 창의 첫 방향키는 (어느 쪽이든) 경고 없는 첫 선택지에 커서를 놓는다 (경고 없는 것이 없으면 첫 열린 선택지)
  //   ② 위험한 선택지(경고·금기, 확인창의 '그렇게 한다' = danger)는 커서가 그 자리에 STEADY_MS 이상 머물렀고 + 결정 키를 그 전 누름에서 STEADY_MS 이상 쉬었다가
  //      새로 눌렀을 때만 Space·Enter 로 고른다 — 두드리는 방향키는 커서를 계속 옮기고, 연타하는 Space 는 쉼이 없어서 넘어가지 않는다. 번호 키·마우스는 그대로 바로 고른다
  const STEADY_MS = 300;
  let okAt = 0, okPrevAt = 0; // 결정 키를 누른 시각(이번·그 전) — 자동 반복은 빼고
  // 캡처 단계에서 먼저 듣는다: 반복 입력은 게임 쪽 처리기(game.js)까지 가지 않는다 (방향키 반복은 그대로 — 걷기·커서)
  document.addEventListener('keydown', (e) => {
    if (OK_KEYS.includes(e.key) && !e.repeat) { okPrevAt = okAt; okAt = Date.now(); }
    if (OK_KEYS.includes(e.key)) okDown.add(e.key);
    if (DIR_KEYS.includes(e.key)) dirDown.add(e.key);
    if (e.target && e.target.tagName === 'INPUT') return;                      // 저장 코드 칸에서는 글자를 눌러 쓸 수 있게
    if (cur && e.repeat && DIR_KEYS.includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // 선택 창이 열려 있으면 방향키 자동 반복은 버린다
    if (e.repeat && !/^Arrow/.test(e.key) && !['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Shift'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('keyup', (e) => {
    if (OK_KEYS.includes(e.key)) { okDown.delete(e.key); if (!okDown.size) armed = true; }
    if (DIR_KEYS.includes(e.key)) { dirDown.delete(e.key); dirDown.delete(e.key.length === 1 ? (e.key === e.key.toLowerCase() ? e.key.toUpperCase() : e.key.toLowerCase()) : e.key); if (!dirDown.size) dirArmed = true; }
  }, true);
  window.addEventListener('blur', () => { okDown.clear(); armed = true; dirDown.clear(); dirArmed = true; });

  // ── 무대 그림 층: 다음 그림이 올 때까지 유지. 그림이 없으면 층을 열지 않는다(자리표시 상자 없음) ──
  // 선택 창이 열리면 256×144 로 작아진다: 같은 이름의 v4 cg_s 그림(원본에서 그 크기로 뽑은 것)이 있으면 그것을 원래 크기로 (art.js cgSmall)
  function cg(src) {
    const el = $('cg');
    if (!src) { el.hidden = true; el.innerHTML = ''; el.className = ''; return; }
    const small = window.ART && ART.cgSmall ? ART.cgSmall(src) : '';
    el.hidden = false; el.className = small ? 'hassmall' : '';
    el.innerHTML = `<img class="big" alt="" src="${src}">${small ? `<img class="small" alt="" src="${small}">` : ''}`;
  }
  const cgClear = () => cg(null);
  // 무대에 글 한 장(명부 등). html 은 부른 쪽이 esc 해서 넘긴다
  function page(html, cls) {
    const el = $('cg');
    el.hidden = false; el.className = 'haspage';
    el.innerHTML = `<div class="page ${cls || ''}">${html}</div>`;
  }

  // 글이 상자 안에 들어가는가 (스크롤 0 약속)
  const fits = (el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;

  // ── 한 줄: 글자가 찍히듯 나오고, 누르면 다 나오거나 다음으로 ──
  function line(text, o) {
    o = o || {};
    if (cur) close(undefined);
    const box = $('box');
    box.className = 'line' + (o.black ? ' black' : '') + (o.face ? ' hasface' : '');
    const face = o.face ? `<img class="face${o.faceCls ? ' ' + o.faceCls : ''}" alt="" src="${o.face}">` : (o.name ? '<div class="face ph"></div>' : '');   // faceCls 'icon' = 찾은 물건 아이콘 40px 을 2배(80)로
    box.innerHTML = `${face}<div class="lt">${o.name ? `<p class="who">${esc(o.name)}</p>` : ''}<p class="tw"></p><p class="more">▼</p></div>`;
    box.hidden = false;
    const el = box.querySelector('.tw');
    const chars = Array.from(String(text));
    let i = 0, timer = 0;
    const ms = DELAYS().type;
    return new Promise((resolve) => {
      const done = () => { clearInterval(timer); el.textContent = text; i = chars.length; };
      if (ms <= 0) done();
      else timer = setInterval(() => { i++; el.textContent = chars.slice(0, i).join(''); if (i >= chars.length) clearInterval(timer); }, ms);
      lineCur = { next() { if (i < chars.length) { done(); return; } clearInterval(timer); lineCur = null; box.hidden = true; box.innerHTML = ''; resolve(); } };
      openedAt = Date.now();
      if (bot) setTimeout(() => { if (lineCur && bot('line', { text, opts: o }) !== 'hold') { done(); lineCur.next(); } }, 0);
    });
  }
  // 문장마다 끊되, 따옴표 안의 말은 한 번에.
  // 닫는 따옴표 뒤는 따옴표 안 말이 문장 끝 부호(. ! ? … —)로 끝났을 때만 끊는다 — '동하가 "네" 하고 신발을 벗었다.'는 한 장.
  // 따옴표 안 말이 부호로 끝났어도 바로 뒤가 인용 낱말(라고·하고·하며…)이면 같은 문장이다 — '"됐어." 라고 했다.'
  const QUOTE_TAIL = /^\s*(라고|라며|라는|라던|하고|하며|하는|하자|하기|하던|하더니|하곤|하면서|고\s|며\s)/;
  function splitSentences(text) {
    const out = []; let s = '', q = 0;
    const t = String(text);
    for (let i = 0; i < t.length; i++) {
      const c = t[i]; s += c;
      let closing = false;
      if (c === '“' || (c === '"' && q === 0)) q++; else if (c === '”' || (c === '"' && q > 0)) { q = Math.max(0, q - 1); closing = q === 0; }
      const end = closing ? /[.!?…—]/.test(t[i - 1] || '') && !QUOTE_TAIL.test(t.slice(i + 1)) : /[.!?…]/.test(c);
      if (!q && end && /\s/.test(t[i + 1] || '') && /\S/.test(t.slice(i + 1))) { out.push(s.trim()); s = ''; }
    }
    if (s.trim()) out.push(s.trim());
    return out;
  }
  // 한 장에 너무 긴 문장(따옴표로 묶인 말 등)은 쉼표·빈칸에서 다음 장으로 나눈다
  const PAGE_CHARS = 120;
  function paginate(sentence) {
    const out = [];
    let s = sentence;
    while (s.length > PAGE_CHARS) {
      let cut = s.lastIndexOf(', ', PAGE_CHARS); if (cut < PAGE_CHARS / 2) cut = s.lastIndexOf(' ', PAGE_CHARS);
      if (cut < PAGE_CHARS / 2) cut = PAGE_CHARS;
      out.push(s.slice(0, cut + 1).trim() + ' …'); s = s.slice(cut + 1).trim();
    }
    if (s) out.push(s);
    return out;
  }
  async function lines(text, o) { for (const s of splitSentences(text)) for (const p of paginate(s)) await line(p, o); }

  // ── 선택 창: 글 + 번호 선택지. o.options: [{label, sub(HTML), disabled, value, warn}]. o.fit: [문장…] 이면 넘칠 때 앞 문장부터 덜어 낸다 ──
  // o.sel: 처음 커서 자리(되돌릴 수 없는 확인창 = '다시 고른다'). 없으면 경고 있는 창은 커서 없음(-1), 아니면 첫 번째 열린 선택지
  function open(body, o) {
    o = o || {};
    if (cur) close(undefined);
    if (lineCur) { const l = lineCur; lineCur = null; l.next(); }
    const options = (o.options && o.options.length ? o.options : [{ label: o.next || '계속', value: true }]);
    const box = $('box');
    box.className = 'opts' + (o.cls ? ' ' + o.cls : '');
    const olist = `<div class="olist">${options.map((op, i) =>
      `<button type="button" class="opt" data-i="${i}" ${op.disabled ? 'disabled' : ''}><span class="num">${i < 9 ? i + 1 : ''}</span><span class="ol">${esc(op.label)}${op.sub ? `<small>${op.sub}</small>` : ''}</span></button>`).join('')}</div>`;
    const render = (b) => { box.innerHTML = `<div class="body">${b}</div>${olist}`; };
    box.hidden = false;
    render(body);
    const ok = () => fits(box) && fits(box.querySelector('.body'));
    if (!ok() && Array.isArray(o.fit) && o.fit.length > 1) {                    // 넘친다 → 앞 문장을 덜어 낸다
      const head = o.fitHead || '';
      for (let k = 1; k < o.fit.length && !ok(); k++) render(`${head}<p>… ${esc(o.fit.slice(k).join(' '))}</p>`);
    }
    if (!ok()) box.classList.add('tight');                                      // 그래도 넘치면 글씨를 한 단계 줄인다
    openedAt = Date.now();
    armed = okDown.size === 0;
    dirArmed = dirDown.size === 0;                                              // 방향키를 누른 채 열렸으면 뗄 때까지 커서가 안 움직인다
    const firstOpen = () => options.findIndex((x) => !x.disabled);
    const warned = options.some((x) => x.warn || x.taboo || /class="warn"/.test(String(x.sub || '')));
    const sel = Number.isInteger(o.sel) && options[o.sel] && !options[o.sel].disabled ? o.sel : warned ? -1 : Math.max(0, firstOpen());
    return new Promise((resolve) => {
      cur = { resolve, options, sel, selAt: Date.now(), cancel: !!o.cancel, cancelValue: o.cancelValue === undefined ? null : o.cancelValue, kind: o.kind || 'menu' };
      paint();
      // 봇(캡처·플레이스루): 고른 번호, 아니면 취소 가능한 창은 취소, 아니면 '첫 번째 열린 선택지'를 명시해서 고른다 (커서 자리에 기대지 않는다)
      if (bot) setTimeout(() => { if (!cur) return; const i = bot(cur.kind, { options: cur.options.map((x) => Object.assign({}, x, { sub: undefined })) }); if (i === 'hold') return; if (Number.isInteger(i) && cur.options[i] && !cur.options[i].disabled) choose(i, true); else if (cur.cancel) close(cur.cancelValue); else { const f = cur.options.findIndex((x) => !x.disabled); if (f >= 0) choose(f, true); } }, 0);
    });
  }
  function paint() {
    if (!cur) return;
    $('box').querySelectorAll('.opt').forEach((b, i) => b.classList.toggle('sel', i === cur.sel));
  }
  function close(value) {
    const c = cur; cur = null;
    $('box').hidden = true; $('box').innerHTML = '';
    if (c) c.resolve(value);
  }
  function choose(i, force) {
    if (!cur) return;
    const op = cur.options[i];
    if (!op || op.disabled) return;
    if (!force && Date.now() - openedAt < BLOCK_MS) return;
    close(op.value === undefined ? i : op.value);
  }
  // 위험한 선택지: 경고·금기가 붙었거나(부제의 경고 글 포함) 부른 쪽이 danger 로 표시한 것(되돌릴 수 없는 확인창의 '그렇게 한다')
  const danger = (x) => !!(x && (x.danger || x.warn || x.taboo || /class="warn"/.test(String(x.sub || ''))));
  function key(k) {
    if (lineCur) { if (k === 'ok' || k === 'back') lineCur.next(); return true; }
    if (!cur) return false;
    if (Date.now() - openedAt < BLOCK_MS) return true;                          // 열린 뒤 0.4초는 막는다
    const n = cur.options.length;
    if (k === 'up' || k === 'down') {
      if (!dirArmed) return true;                                               // 창이 열릴 때 눌려 있던 방향키 — 한 번 뗀 다음부터
      if (cur.sel < 0) {                                                        // 커서 없이 열린 창: 첫 방향키(어느 쪽이든)가 경고 없는 첫 선택지에 커서를 놓는다 (①)
        const open = Array.from({ length: n }, (_, j) => j).filter((j) => !cur.options[j].disabled);
        const i = open.find((j) => !danger(cur.options[j]));
        const at = i != null ? i : open[0];
        if (at != null) { cur.sel = at; cur.selAt = Date.now(); paint(); }
        return true;
      }
      let i = cur.sel;
      for (let step = 0; step < n; step++) { i = (i + (k === 'up' ? -1 : 1) + n) % n; if (!cur.options[i].disabled) break; }
      if (i !== cur.sel) cur.selAt = Date.now();
      cur.sel = i; paint();
    } else if (k === 'ok') {                                                    // 결정 키를 한 번 뗀 다음부터
      if (!armed || cur.sel < 0) return true;
      const now = Date.now();
      if (danger(cur.options[cur.sel]) && (now - cur.selAt < STEADY_MS || okAt - okPrevAt < STEADY_MS)) { steadyHint(); return true; }   // ② 머물지 않았거나 연타 중
      choose(cur.sel);
    }
    else if (k === 'back' && cur.cancel) close(cur.cancelValue);
    return true;
  }
  // 위험한 선택지에서 결정 키를 받지 않았을 때: 커서 줄이 한 번 깜빡여 '아직'을 보인다 (글 없이)
  function steadyHint() {
    const b = $('box').querySelector('.opt.sel');
    if (!b) return;
    b.classList.remove('steady'); void b.offsetWidth; b.classList.add('steady');
  }
  const pick = (i) => { if (cur && cur.options[i]) choose(i); else if (lineCur) lineCur.next(); };
  document.addEventListener('click', (e) => {
    if (lineCur && e.target.closest('#box')) { if (Date.now() - openedAt > 80) lineCur.next(); return; }
    const b = e.target.closest('#box .opt');
    if (b) { choose(Number(b.dataset.i)); }
  });

  // ── 토스트 (길을 막지 않는다) ──
  let toastT = 0;
  function toast(text, ms) {
    const t = $('toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || DELAYS().toast || 1800);
  }
  // ── 장 전환 카드: 검은 화면에 글 ──
  function card(title, sub) {
    const f = $('fade');
    f.innerHTML = `<div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
    f.hidden = false; f.className = 'in';
    const ms = DELAYS().card, fade = DELAYS().fade;
    return new Promise((res) => setTimeout(() => { f.className = 'out'; setTimeout(() => { f.hidden = true; f.className = ''; res(); }, fade); }, ms + fade));
  }
  const isOpen = () => !!cur || !!lineCur;
  const openKind = () => (cur ? cur.kind : lineCur ? 'line' : '');
  const setBot = (fn) => { bot = fn || null; };
  window.UI = { esc, open, line, lines, splitSentences, paginate, key, pick, close, toast, card, cg, cgClear, page, isOpen, openKind, setBot, get bot() { return bot; } };
})();
