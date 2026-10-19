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
    const options = (o.options && o.options.length ? o.options : [{ label: o.next || '계속', value: true }]);
    const dlg = $('dlg');
    dlg.className = o.full ? 'full' : '';
    dlg.innerHTML = `<div class="box" role="dialog" aria-modal="true">${body}<div class="opts">${options.map((op, i) =>
      `<button type="button" class="opt" data-i="${i}" ${op.disabled ? 'disabled' : ''}>${esc(op.label)}${op.sub ? `<small>${op.sub}</small>` : ''}</button>`).join('')}</div></div>`;
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
    close(op.value === undefined ? i : op.value);
  }
  function key(k) {
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
    const b = e.target.closest('#dlg .opt');
    if (b) { choose(Number(b.dataset.i)); return; }
    if (cur && cur.cancel && e.target.id === 'dlg') close(cur.cancelValue);
  });
  let toastT = 0;
  function toast(text, ms) {
    const t = $('toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 1800);
  }
  const say = (body, o) => open(body, o);
  const isOpen = () => !!cur;
  window.UI = { open, say, key, isOpen, toast, esc };
})();
