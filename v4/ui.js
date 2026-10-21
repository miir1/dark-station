// 어두운 역 v4 — 창. 그림은 무대(#cg) 위에, 글은 아래 상자(#box, 높이 고정, 스크롤 0)에. OS confirm/alert 없음.
// 모든 창은 Promise 로 열리고 고른 값으로 닫힌다. 키: Space/Enter/Z 다음·결정, ↑↓ 고르기, 1~9 번호, Esc/X 취소(취소 가능한 창만).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DELAYS = () => (window.DS4 && DS4.engine ? DS4.engine.DELAYS : { type: 18, card: 1400, fade: 700, toast: 2000 });
  let cur = null;          // 선택 창 { resolve, options, sel, cancel, cancelValue }
  let lineCur = null;      // 한 줄 창 { next }
  let openedAt = 0;
  let bot = null;          // 봇: (kind, info) → 고를 번호 또는 undefined. 플레이스루·캡처용

  // ── 무대 그림 층: 다음 그림이 올 때까지 유지 ──
  function cg(srcOrNull, label) {
    const el = $('cg');
    if (!srcOrNull && !label) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = srcOrNull ? `<img alt="" src="${srcOrNull}">` : `<div class="ph">${esc(label || '')}</div>`;
  }
  const cgClear = () => cg(null);

  // ── 한 줄: 글자가 찍히듯 나오고, 누르면 다 나오거나 다음으로 ──
  function line(text, o) {
    o = o || {};
    if (cur) close(undefined);
    const box = $('box');
    box.className = 'line' + (o.black ? ' black' : '') + (o.face ? ' hasface' : '');
    const face = o.face ? `<img class="face" alt="" src="${o.face}">` : (o.name ? '<div class="face ph"></div>' : '');
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
      if (bot) setTimeout(() => { if (lineCur) { done(); lineCur.next(); } }, 0);
    });
  }
  // 문장마다 끊되, 따옴표 안의 말은 한 번에
  function splitSentences(text) {
    const out = []; let s = '', q = 0;
    const t = String(text);
    for (let i = 0; i < t.length; i++) {
      const c = t[i]; s += c;
      if (c === '“' || (c === '"' && q === 0)) q++; else if (c === '”' || (c === '"' && q > 0)) q = Math.max(0, q - 1);
      if (!q && /[.!?…”"]/.test(c) && /\s/.test(t[i + 1] || '') && /\S/.test(t.slice(i + 1))) { out.push(s.trim()); s = ''; }
    }
    if (s.trim()) out.push(s.trim());
    return out;
  }
  async function lines(text, o) { for (const s of splitSentences(text)) await line(s, o); }

  // ── 선택 창: 글 + 번호 선택지. o.options: [{label, sub(HTML), disabled, value}] ──
  function open(body, o) {
    o = o || {};
    if (cur) close(undefined);
    if (lineCur) { const l = lineCur; lineCur = null; l.next(); }
    const options = (o.options && o.options.length ? o.options : [{ label: o.next || '계속', value: true }]);
    const box = $('box');
    box.className = 'opts' + (o.cls ? ' ' + o.cls : '');
    box.innerHTML = `<div class="body">${body}</div><div class="olist">${options.map((op, i) =>
      `<button type="button" class="opt" data-i="${i}" ${op.disabled ? 'disabled' : ''}><span class="num">${i < 9 ? i + 1 : ''}</span><span class="ol">${esc(op.label)}${op.sub ? `<small>${op.sub}</small>` : ''}</span></button>`).join('')}</div>`;
    box.hidden = false;
    openedAt = Date.now();
    return new Promise((resolve) => {
      cur = { resolve, options, sel: Math.max(0, options.findIndex((x) => !x.disabled)), cancel: !!o.cancel, cancelValue: o.cancelValue === undefined ? null : o.cancelValue, kind: o.kind || 'menu' };
      paint();
      if (bot) setTimeout(() => { if (!cur) return; const i = bot(cur.kind, { options: cur.options.map((x) => Object.assign({}, x, { sub: undefined })) }); if (Number.isInteger(i) && cur.options[i] && !cur.options[i].disabled) choose(i, true); else if (cur.cancel) close(cur.cancelValue); else choose(cur.sel, true); }, 0);
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
    if (!force && Date.now() - openedAt < 120) return;
    close(op.value === undefined ? i : op.value);
  }
  function key(k) {
    if (lineCur) { if (k === 'ok' || k === 'back') lineCur.next(); return true; }
    if (!cur) return false;
    const n = cur.options.length;
    if (k === 'up' || k === 'down') {
      let i = cur.sel;
      for (let step = 0; step < n; step++) { i = (i + (k === 'up' ? -1 : 1) + n) % n; if (!cur.options[i].disabled) break; }
      cur.sel = i; paint();
    } else if (k === 'ok') choose(cur.sel);
    else if (k === 'back' && cur.cancel) close(cur.cancelValue);
    return true;
  }
  const pick = (i) => { if (cur && cur.options[i]) choose(i, true); else if (lineCur) lineCur.next(); };
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
  const setBot = (fn) => { bot = fn || null; };
  window.UI = { esc, open, line, lines, splitSentences, key, pick, close, toast, card, cg, cgClear, isOpen, setBot, get bot() { return bot; } };
})();
