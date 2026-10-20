// 어두운 역 v3 — 연출: 장 전환(암전 + 날짜), 공기 입자(먼지·재·물방울), 소리(지하 울림·불 타닥임)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ── 장 전환: 화면이 어두워졌다가 글자가 떠오른다 ──
  function card(text, sub, ms) {
    const el = $('fade');
    el.innerHTML = `<div><b>${text}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    el.hidden = false;
    el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
    return new Promise((res) => setTimeout(() => {
      el.classList.remove('in'); el.classList.add('out');
      setTimeout(() => { el.hidden = true; el.classList.remove('out'); res(); }, 700);
    }, ms || 1400));
  }

  // ── 공기 입자 (맵 좌표, 칸 단위) ──
  const parts = [];
  function particles(ctx, T, w, h, kind, tick) {
    const want = kind === 'drain' ? 26 : 34;
    while (parts.length < want) parts.push(spawn(w, h, kind));
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.life -= 1;
      if (p.life <= 0 || p.y > h || p.x < 0 || p.x > w) Object.assign(p, spawn(w, h, kind));
      const a = Math.min(1, p.life / 60) * p.a;
      ctx.fillStyle = p.c.replace('A', a.toFixed(2));
      const s = Math.max(1, Math.round(T / 24 * p.s));
      ctx.fillRect(Math.round(p.x * T), Math.round(p.y * T), s, p.drip ? s * 3 : s);
    }
  }
  function spawn(w, h, kind) {
    const r = Math.random;
    if (kind === 'drain' && r() < 0.5) return { x: r() * w, y: 0, vx: 0, vy: 0.06 + r() * 0.04, life: 200, a: 0.5, s: 1, drip: true, c: 'rgba(134,163,168,A)' };
    const ember = r() < 0.25;
    return { x: r() * w, y: r() * h, vx: (r() - 0.5) * 0.006, vy: ember ? -0.01 - r() * 0.01 : 0.002 + r() * 0.004, life: 120 + r() * 240, a: ember ? 0.7 : 0.25, s: ember ? 1 : 1 + r(),
      c: ember ? 'rgba(208,140,70,A)' : 'rgba(200,190,170,A)' };
  }

  // ── 소리: 웹 오디오로 직접 만든다 (파일 없음) ──
  let ac = null, master = null, on = false;
  try { on = localStorage.getItem('darkstation.v3.sound') !== 'off'; } catch (e) { on = true; }
  function start() {
    if (ac || !on) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.0; master.connect(ac.destination);
    master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 3);
    // 지하 울림: 낮은 사인파 두 개가 천천히 맥놀이
    for (const [f, g] of [[46, 0.10], [46.7, 0.08], [92.5, 0.025]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const gn = ac.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(master); o.start();
    }
    // 바람 같은 잡음 (걸러서 낮게)
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995; d[i] = last * 3; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const ng = ac.createGain(); ng.gain.value = 0.35; src.connect(lp); lp.connect(ng); ng.connect(master); src.start();
    crackle();
  }
  // 불 타닥임: 짧은 잡음 덩어리를 불규칙하게
  function crackle() {
    if (!ac) return;
    const t = ac.currentTime;
    const n = ac.createBuffer(1, ac.sampleRate * 0.03, ac.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = ac.createBufferSource(); s.buffer = n;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    const g = ac.createGain(); g.gain.value = fireNear * (0.06 + Math.random() * 0.08);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t);
    setTimeout(crackle, 80 + Math.random() * 600);
  }
  let fireNear = 0.5;
  function setFire(v) { fireNear = Math.max(0, Math.min(1, v)); }
  // 효과음: 짧은 소리 (걸음·문·피격)
  function blip(kind) {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    if (kind === 'step') { o.type = 'triangle'; o.frequency.setValueAtTime(90 + Math.random() * 20, t); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); }
    else if (kind === 'hit') { o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); }
    else { o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.4); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); }
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem('darkstation.v3.sound', on ? 'on' : 'off'); } catch (e) { /* 무시 */ }
    if (on) { if (ac) ac.resume(); else start(); } else if (ac) ac.suspend();
    return on;
  }
  window.FX = { card, particles, start, toggle, blip, setFire, get soundOn() { return on; } };
})();
