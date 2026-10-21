// 어두운 역 v3 — 대화창. 모든 창은 Promise로 열리고, 고른 값으로 닫힌다. (키보드 ↑↓ Z/Enter, X/Esc, 터치)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cur = null;               // { resolve, options, sel, cancel }
  let openedAt = 0;

  // body: HTML 문자열. o.options: [{label, sub(HTML), disabled, value, confirm}], o.cancel: 취소 가능(값 o.cancelValue), o.full: 큰 창
  function open(body, o) {
    o = o || {};
    if (cur) close(undefined);
    if (lineCur) { const l = lineCur; lineCur = null; l.next(); }   // 한 줄 대화가 남아 있으면 끝내고 연다 (안 그러면 누름이 그쪽으로 가서 창이 멈춘다)
    const options = (o.options && o.options.length ? o.options : [{ label: o.next || '계속', value: true }]);
    const dlg = $('dlg');
    dlg.className = (o.center ? 'center' : o.full ? 'full' : '') + (o.grid ? ' grid' : '');
    // op.icon: 아이콘 HTML (글 앞에), o.grid: 큰 타일로 (메뉴)
    dlg.innerHTML = `<div class="box" role="dialog" aria-modal="true">${body}<div class="opts">${options.map((op, i) =>
      `<button type="button" class="opt${op.icon ? ' has-ic' : ''}" data-i="${i}" ${op.disabled ? 'disabled' : ''}>${op.icon || ''}<span class="ol">${!o.grid && options.length > 1 && i < 9 ? `<span class="num">${i + 1}</span>` : ''}${esc(op.label)}${op.sub ? `<small>${op.sub}</small>` : ''}</span></button>`).join('')}</div></div>`;
    dlg.hidden = false;
    openedAt = Date.now();
    return new Promise((resolve) => {
      cur = { resolve, options, sel: Math.max(0, options.findIndex((x) => !x.disabled)), cancel: !!o.cancel, cancelValue: o.cancelValue === undefined ? null : o.cancelValue };
      paint();
      const box = dlg.querySelector('.box'); if (box) box.scrollTop = 0;
    });
  }
  function paint() {
    if (!cur) return;
    $('dlg').querySelectorAll('.opt').forEach((b, i) => b.classList.toggle('sel', i === cur.sel));
    const el = $('dlg').querySelector('.opt.sel'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  function close(value) {
    const c = cur; cur = null;
    $('dlg').hidden = true; $('dlg').innerHTML = '';
    if (c) c.resolve(value);
  }
  function choose(i) {
    if (!cur) return;
    const op = cur.options[i];
    if (!op || op.disabled) return;
    if (Date.now() - openedAt < 180) return;            // 이전 창을 닫은 손가락이 바로 다음 창을 누르지 않게
    if (op.confirm && !window.confirm(op.confirm)) return;
    // 창 안의 입력 칸 값을 챙겨 둔다 (이름 입력 등)
    lastInputs = {}; $('dlg').querySelectorAll('input').forEach((el) => { lastInputs[el.id || el.name] = el.value; });
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
  document.addEventListener('click', (e) => {
    if (lineCur && e.target.closest('#dlg')) { if (Date.now() - openedAt > 120) lineCur.next(); return; }
    const b = e.target.closest('#dlg .opt');
    if (b) { choose(Number(b.dataset.i)); return; }
    if (cur && cur.cancel && e.target.id === 'dlg') close(cur.cancelValue);
  });
  let lastInputs = {};
  const pick = (i) => { if (cur && cur.options[i]) choose(i); };
  let toastT = 0;
  function toast(text, ms) {
    const t = $('toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 1800);
  }
  // ── 한 줄씩: 글자가 찍히듯 나오고, 누르면 다 나오거나 다음으로 ──
  let lineCur = null;
  function line(text, o) {
    o = o || {};
    if (cur) close(undefined);
    const dlg = $('dlg');
    dlg.className = 'line' + (o.black ? ' black' : '');
    const face = o.face ? `<img class="face" alt="" src="${o.face}">` : '';
    dlg.innerHTML = `<div class="box">${o.cg ? `<img class="cg" alt="" src="${o.cg}">` : ''}${face}<div class="lt">${o.name ? `<p class="who">${esc(o.name)}</p>` : ''}<p class="tw"></p><p class="more">▼</p></div></div>`;
    dlg.hidden = false;
    const el = dlg.querySelector('.tw');
    const chars = Array.from(text);
    let i = 0, timer = 0;
    return new Promise((resolve) => {
      const done = () => { clearInterval(timer); el.textContent = text; i = chars.length; };
      timer = setInterval(() => { i++; el.textContent = chars.slice(0, i).join(''); if (i >= chars.length) clearInterval(timer); }, 18);
      lineCur = { next() { if (i < chars.length) { done(); return; } clearInterval(timer); lineCur = null; dlg.hidden = true; dlg.innerHTML = ''; resolve(); } };
      openedAt = Date.now();
    });
  }
  // 문장마다 끊되, 따옴표(“ ”) 안의 말은 한 번에 보여 준다
  function splitSentences(text) {
    const out = []; let cur = '', q = 0;
    const t = String(text);
    for (let i = 0; i < t.length; i++) {
      const c = t[i]; cur += c;
      if (c === '“') q++; else if (c === '”') q = Math.max(0, q - 1);
      if (!q && /[.!?…”"]/.test(c) && /\s/.test(t[i + 1] || '') && /\S/.test(t.slice(i + 1))) { out.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  async function lines(text, o) { for (const s of splitSentences(text)) await line(s, o); }
  const say = (body, o) => open(body, o);
  const isOpen = () => !!cur || !!lineCur;
  window.UI = { open, say, key, isOpen, toast, esc, line, lines, splitSentences, pick, get lastInputs() { return lastInputs; } };
})();
