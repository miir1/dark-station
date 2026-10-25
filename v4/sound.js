// 어두운 역 v4 — 소리. 녹음 파일 없이 Web Audio API 로 그 자리에서 만든다 (디렉터 C5·B6: 효과음·앰비언트만, 음악 없음 — 침묵이 무기).
// 무섭되 시끄럽지 않게: 전체를 작게 잡고(크기 3단 작게·보통·크게), 맨 끝에 압축기를 걸어 튀는 소리를 누른다.
//
// 지키는 것
//  - 첫 입력(키·클릭) 전에는 AudioContext 를 만들지 않는다 (브라우저 자동재생 정책). Esc·Shift 같은 키는 입력으로 치지 않는다(사용자 활성화가 아니다).
//  - 메뉴(Esc)에 소리 켜기·끄기와 크기 3단 — localStorage 'darkstation.v4.sound' 에 저장(읽고 쓸 때 try/catch). M 키 = 소리 켜기·끄기.
//  - 탭이 숨겨지면 줄이고 멈춘다(suspend). 다시 보이면 이어서.
//  - ?fast=1 · 캡처(?auto= · shot= · sc= · audit=) = 무음: AudioContext 를 아예 만들지 않는다 (shot.py·screen_check.py 결과가 그대로).
//  - ?snd=log = 확인용: 소리 그래프는 그대로 만들되 출력은 0(무음), 만든 노드 수와 부른 소리를 SND.log 에 남긴다.
//      캡처 주소와 같이 주면(?fast=1&auto=run&snd=log) 입력 없이 바로 만든다 — 봇 판에서 사건마다 소리가 붙는지 본다 (v4/tools/sound_check.py).
//  - 소리가 고장 나도 게임은 멈추지 않는다: 모든 길이 try/catch, 고장 나면 조용히 꺼지고 SND.status().broken 에만 남는다 (콘솔 오류 0).
//
// 게임 쪽 연결 (짧게): game.js frame() 에서 SND.frame(scene, state, now, {knock}) 한 줄 · 사건·조사·수납·판정·죽음·말풍선은 SND.play(<종류>, {...}) 한 줄씩 ·
//   ui.js choose() 에서 SND.play('pick') · game.js 멈춤 메뉴가 SND.menu()/SND.menuPick() 을 붙인다.
//   발걸음(걷기 4박자 — render.js WALK_BEAT 의 발 디딤 박자)·셔터 두드림(render.js 의 두드림 박자 2.6초에 세 번)·다침(당신 부상이 늘었다)은 SND.frame 이 scene·state 를 보고 스스로 낸다.
(function (root) {
  'use strict';
  const STORE_KEY = 'darkstation.v4.sound';
  const LEVELS = [0.32, 0.5, 0.75];                 // 마스터 크기: 작게 · 보통 · 크게
  const LEVEL_NAMES = ['작게', '보통', '크게'];
  const qs = new URLSearchParams(root.location ? root.location.search : '');
  const TEST = qs.get('snd') === 'log';
  const CAPTURE = qs.get('fast') === '1' || ['auto', 'shot', 'sc', 'audit'].some((k) => qs.has(k));
  const OFF = CAPTURE && !TEST;                     // 캡처·빠른 모드 = 무음 (만들지 않는다)
  const EAGER = CAPTURE && TEST;                    // 봇 판 확인: 입력 없이 바로 만든다 (출력은 무음)
  const pref = { on: true, level: 1 };
  try {
    const j = JSON.parse(root.localStorage.getItem(STORE_KEY) || 'null');
    if (j && typeof j === 'object') { pref.on = j.on !== false; if ([0, 1, 2].includes(j.level)) pref.level = j.level; }
  } catch (e) { /* 저장소가 막혀 있으면 기본값 */ }
  function savePref() { try { root.localStorage.setItem(STORE_KEY, JSON.stringify({ on: pref.on, level: pref.level })); } catch (e) { /* 저장 못 해도 이번 판은 그대로 */ } }

  const R = Math.random;
  const rnd = (a, b) => a + (b - a) * R();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  let ac = null, out = null, comp = null, master = null, amb = null, sfx = null, verb = null, tap = null;
  let noise = null, beds = null, tickT = 0, suspendT = 0;
  let hidden = !!(root.document && root.document.visibilityState === 'hidden'), deathHush = false, broken = '', gestured = false;
  let clock = { drip: 0, hiss: 0 };                 // 다음 물방울·쉿 소리 시각 (ac 시계)
  const seen = { at: 0, scene: null, state: null, knock: false };   // 마지막 SND.frame 이 본 것
  const walk = { beat: -1, wd: 0, t: 0, run: false, foot: 0 };
  let knockPh = -1, lastState = null, lastInj = 0, lastTg = null, lastAmbKey = '', lastRadio = -9;
  const log = [];                                    // ?snd=log: 부른 소리 [{t, kind, played, …}]
  let nodeCount = 0;
  const nodeKinds = {};
  function note(kind, o) {
    if (!TEST) return;
    log.push(Object.assign({ t: Math.round(performance.now()) }, o, { kind }));
    if (log.length > 4000) log.splice(0, 1000);
  }
  function fail(e) {                                 // 소리가 고장 나면 조용히 끈다 (게임은 그대로)
    broken = String(e && e.message ? e.message : e).slice(0, 200);
    try { if (master && ac) master.gain.setValueAtTime(0, ac.currentTime); if (ac && ac.state === 'running') ac.suspend().catch(() => {}); } catch (e2) { /* 끝 */ }
    note('broken', { why: broken });
  }

  // ── 재료: 잡음 버퍼 (흰·갈색 — 갈색은 끝과 처음을 맞춰 이음매에서 딸깍하지 않게) · 타닥 조각 · 지하 울림(잔향) ──
  function makeNoises(c) {
    const sr = c.sampleRate;
    const mk = (kind, sec) => {
      const n = Math.floor(sr * sec), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
      let last = 0, peak = 0;
      for (let i = 0; i < n; i++) { const w = R() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last; } else d[i] = w; }
      if (kind === 'brown') { const k = (d[n - 1] - d[0]) / (n - 1); for (let i = 0; i < n; i++) { d[i] -= k * i; peak = Math.max(peak, Math.abs(d[i])); } for (let i = 0; i < n; i++) d[i] *= 0.9 / (peak || 1); }
      return b;
    };
    const crk = [];
    for (let k = 0; k < 8; k++) {
      const n = Math.floor(sr * rnd(0.004, 0.03)), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < 10 ? 1.5 : 1);
      crk.push(b);
    }
    const irN = Math.floor(sr * 2.4), ir = c.createBuffer(2, irN, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irN; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / irN, 3.2) * Math.min(1, i / (sr * 0.015)); }
    return { white: mk('white', 3), brown: mk('brown', 5), crk, ir };
  }
  // 그래프: 소리들 → (amb 앰비언트 · sfx 효과음 · verb 지하 울림) → master(크기) → 압축기 → [확인용 탭] → out(확인용이면 0) → 스피커
  function graph(c, level, test) {
    out = c.createGain(); out.gain.value = test ? 0 : 1; out.connect(c.destination);
    comp = c.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.3;
    if (test) { tap = c.createAnalyser(); tap.fftSize = 2048; comp.connect(tap); tap.connect(out); } else comp.connect(out);
    master = c.createGain(); master.gain.value = level; master.connect(comp);
    amb = c.createGain(); amb.gain.value = 1; amb.connect(master);
    sfx = c.createGain(); sfx.gain.value = 1; sfx.connect(master);
    verb = c.createConvolver(); verb.buffer = noise.ir;
    const dark = c.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 2400;
    const vg = c.createGain(); vg.gain.value = 0.55;
    verb.connect(dark); dark.connect(vg); vg.connect(master);
  }
  const gain0 = () => { const g = ac.createGain(); g.gain.value = 0; return g; };   // 자동화가 시작되기 전에는 0 (기본값 1 이면 시작 샘플에 딸깍 — 오프라인 측정에서 잡았다)
  const filt = (type, f, q) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; return n; };
  const panner = (v) => { if (!ac.createStereoPanner) return ac.createGain(); const p = ac.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; };
  function loop(buf, rate) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; if (rate) s.playbackRate.value = rate; s.start(ac.currentTime, R() * (buf.duration - 0.2)); return s; }
  // 계속 나는 것(바닥): 웅웅거림 · 공기 · 화로 · 물 흐름. 크기는 tick 이 목표값으로 천천히 옮긴다
  function makeBeds() {
    const b = {};
    b.hum = ac.createGain(); b.hum.gain.value = 0; b.hum.connect(amb);
    const wob = ac.createGain(); wob.gain.value = 1; wob.connect(b.hum);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.055; const lg = ac.createGain(); lg.gain.value = 0.22; lfo.connect(lg); lg.connect(wob.gain); lfo.start();
    b.humOsc = [[43, 0.0055], [43.6, 0.0045], [86.5, 0.0035], [129.5, 0.003], [172, 0.0012]].map(([f, g]) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gn = ac.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(wob); o.start(); return { o, f };
    });
    b.airLp = filt('lowpass', 220, 0.6);
    b.air = ac.createGain(); b.air.gain.value = 0;
    loop(noise.brown).connect(b.airLp); b.airLp.connect(b.air); b.air.connect(amb);
    b.firePan = panner(0); b.firePan.connect(amb);
    b.fire = ac.createGain(); b.fire.gain.value = 0; b.fire.connect(b.firePan);
    const fbp = filt('bandpass', 650, 0.7), flp = filt('lowpass', 1800);
    b.fireBed = ac.createGain(); b.fireBed.gain.value = 0.22;
    loop(noise.white).connect(fbp); fbp.connect(flp); flp.connect(b.fireBed); b.fireBed.connect(b.fire);
    b.waterPan = panner(0); b.waterPan.connect(amb);
    b.water = ac.createGain(); b.water.gain.value = 0; b.water.connect(b.waterPan);
    b.waterBp = filt('bandpass', 900, 0.5);
    const wlp = filt('lowpass', 2600), wsh = ac.createGain(); wsh.gain.value = 0.55;
    loop(noise.white, 0.9).connect(b.waterBp); b.waterBp.connect(wlp); wlp.connect(wsh); wsh.connect(b.water);
    const wrl = filt('lowpass', 380), wrg = ac.createGain(); wrg.gain.value = 0.9;
    loop(noise.brown, 1.3).connect(wrl); wrl.connect(wrg); wrg.connect(b.water);
    return b;
  }

  // ── 시작: 첫 입력 때 (또는 확인용 봇 판이면 바로) ──
  function start() {
    if (ac || OFF || broken) return;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { broken = 'AudioContext 없음'; return; }
    try {
      ac = new AC();
      if (TEST) countNodes(ac);
      noise = makeNoises(ac);
      graph(ac, 0, TEST);
      beds = makeBeds();
      clock = { drip: ac.currentTime + rnd(1, 4), hiss: ac.currentTime + rnd(6, 12) };
      applyMaster(0.6);
      tickT = setInterval(tick, 100);
      note('start', { ctx: ac.state, sampleRate: ac.sampleRate });
    } catch (e) { fail(e); }
  }
  function countNodes(c) {                           // 확인용: 만든 노드 수를 센다
    for (const k of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner', 'createConvolver', 'createDynamicsCompressor', 'createAnalyser', 'createBuffer']) {
      const f = c[k];
      if (typeof f !== 'function') continue;
      c[k] = function () { nodeCount++; nodeKinds[k] = (nodeKinds[k] || 0) + 1; return f.apply(c, arguments); };
    }
  }
  // 크기 = 켜짐 · 탭 보임 · 3단 크기. 0 이 되면 잠시 뒤 멈춘다(suspend — CPU 를 쓰지 않는다)
  function applyMaster(tc) {
    if (!ac || !master) return;
    try {
      const target = pref.on && !hidden && !broken ? LEVELS[pref.level] : 0;
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(target, t, tc || (target ? 0.2 : 0.06));
      clearTimeout(suspendT);
      if (!target) suspendT = setTimeout(() => { try { if (ac && ac.state === 'running' && (!pref.on || hidden)) ac.suspend().catch(() => {}); } catch (e) { /* 끝 */ } }, 700);
      else if (ac.state === 'suspended' && (gestured || EAGER)) ac.resume().catch(() => {});
    } catch (e) { fail(e); }
  }

  // ── 소리 조각 ──
  function route(node, o) {
    let n = node;
    if (o && o.pan) { const p = panner(o.pan); n.connect(p); n = p; }
    n.connect((o && o.bus) || sfx);
    if (o && o.verb) { const v = ac.createGain(); v.gain.value = o.verb; n.connect(v); v.connect(verb); }
  }
  function env(t, peak, atk, dur) {
    const g = gain0();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
  // 잡음 한 덩이: 거르고(type·f·q, f1 이면 그쪽으로 미끄러진다) 짧게 올렸다 줄인다
  function burst(t, o) {
    const dur = o.dur || 0.08;
    const s = ac.createBufferSource(); s.buffer = noise.white; if (o.rate) s.playbackRate.value = o.rate;
    const f = filt(o.type || 'bandpass', o.f || 1000, o.q == null ? 1 : o.q);
    if (o.f1) { f.frequency.setValueAtTime(o.f || 1000, t); f.frequency.exponentialRampToValueAtTime(o.f1, t + dur); }
    const g = env(t, o.gain || 0.05, o.atk || 0.002, dur);
    s.connect(f); f.connect(g); route(g, o);
    s.start(t, R() * (noise.white.duration - dur - 0.2)); s.stop(t + dur + 0.05);
  }
  function tone(t, o) {
    const dur = o.dur || 0.1;
    const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = env(t, o.gain || 0.03, o.atk || 0.003, dur);
    let n = osc;
    if (o.lp) { const f = filt('lowpass', o.lp); osc.connect(f); n = f; }
    n.connect(g); route(g, o);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // 삐걱: 낮은 톱니(딱딱 끊기는 마찰)를 좁은 공명에 통과시키고, 마찰 빠르기를 흔든다
  function creak(t, o) {
    const dur = o.dur || 0.4, f0 = o.f || 55, peak = o.gain || 0.02;
    const osc = ac.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    for (let i = 1; i <= 7; i++) osc.frequency.linearRampToValueAtTime(f0 * rnd(0.7, 1.45), t + dur * i / 7);
    const bp = filt('bandpass', o.bp || 1000, 7), bp2 = filt('bandpass', (o.bp || 1000) * 1.9, 9);
    const g = gain0();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.2); g.gain.linearRampToValueAtTime(peak * 0.6, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(bp); osc.connect(bp2); bp.connect(g); bp2.connect(g); route(g, o);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ── 발걸음: 바닥 종류별 (승강장 타일·콘크리트·끝선 · 전동차 쇠 · 선로 자갈 · 물 · 젖은 바닥) ──
  const STEP = {
    tile: (t, g, p) => { burst(t, { f: 1500, q: 1.1, dur: 0.05, gain: 0.045 * g, pan: p, verb: 0.12 }); tone(t, { f: 125, f1: 70, dur: 0.05, gain: 0.028 * g, pan: p }); },
    concrete: (t, g, p) => { burst(t, { type: 'lowpass', f: 850, dur: 0.065, gain: 0.055 * g, pan: p, verb: 0.1 }); tone(t, { f: 95, f1: 60, dur: 0.06, gain: 0.032 * g, pan: p }); },
    edge: (t, g, p) => { STEP.concrete(t, g, p); burst(t + 0.004, { f: 3200, q: 4, dur: 0.02, gain: 0.012 * g, pan: p }); },
    metal: (t, g, p) => { burst(t, { f: 950, q: 2.5, dur: 0.06, gain: 0.04 * g, pan: p }); burst(t, { f: 2300, q: 16, dur: 0.2, gain: 0.026 * g, pan: p, verb: 0.2 }); tone(t, { f: 150, f1: 95, dur: 0.05, gain: 0.028 * g, pan: p }); },
    gravel: (t, g, p) => { for (const dt of [0, 0.011, 0.024, 0.04]) burst(t + dt, { f: rnd(2000, 3200), q: 0.9, dur: 0.03, gain: rnd(0.018, 0.032) * g, pan: p }); burst(t, { type: 'lowpass', f: 400, dur: 0.06, gain: 0.028 * g, pan: p }); },
    water: (t, g, p) => { burst(t, { f: 500, f1: 1600, q: 1.2, dur: 0.17, gain: 0.045 * g, pan: p, verb: 0.25 }); tone(t + 0.05, { f: 1300, f1: 2100, dur: 0.04, gain: 0.007 * g, pan: p }); },
    wet: (t, g, p) => { STEP.concrete(t, g * 0.9, p); burst(t + 0.01, { f: 900, f1: 1500, q: 1.5, dur: 0.08, gain: 0.016 * g, pan: p }); },
  };
  function surface(sc, x, y) {
    const id = sc.map.id, t = (sc.rows[y] || '')[x] || '#';
    if (id === 'car') return 'metal';
    if (id === 'tunnel') return 'gravel';
    if (t === 'w') return 'water';
    if (/^drain/.test(id)) return 'wet';
    if (/^mall/.test(id)) return 'tile';
    if (t === '~' || t === 'B') return 'gravel';
    if (t === ',' || t === 'R') return 'concrete';
    if (t === '=') return 'edge';
    return 'tile';
  }
  function step(t, o) { (STEP[o.surface] || STEP.tile)(t, (o.run ? 1.25 : 1) * rnd(0.85, 1.1), o.pan || 0); }

  // ── 조사(손이 닿는 소리, 재료별) · 수납 열기(삐걱·덜컥) ──
  const MAT = [
    [/^(medkit|shelter_box|radio|speaker|lever|valve|pipe|scissors|cistern|ladder|pharmacy_shutter|shutter_gap|vent_shaft|pump_room|worker_pipe|cab_door|cab_window|phonebooth|stall_cart|parts_crate)/, 'metal'],
    [/^(locker|barrel|toolbox)_/, 'metal'],                                         // (10-25 P1-11) 원정 수납 가구: 쇠 사물함·드럼통·공구함
    [/^(crate_food|board|bench|chalk_wall|office_door|train_seat)/, 'wood'],
    [/^(shelf|drawer|crate)_/, 'wood'],                                               //   선반·서랍장·쌓인 상자
    [/^(blanket|pillow|bandage|bag|bodybag|shoe|car_shoes)/, 'cloth'],
    [/^notebook/, 'paper'],
    [/^bottle/, 'bottle'],
    [/^bowl/, 'bowl'],
    [/^(stairs|rubble|repair_rubble|bone_pile|grave|body_rail)/, 'grit'],
  ];
  const material = (id) => { for (const [re, m] of MAT) if (re.test(id)) return m; return 'thing'; };
  const TOUCH = {
    cloth: (t) => { burst(t, { f: 2200, q: 0.6, dur: 0.22, atk: 0.04, gain: 0.026 }); burst(t + 0.09, { f: 1500, q: 0.7, dur: 0.18, atk: 0.03, gain: 0.018 }); },
    wood: (t) => { creak(t, { dur: 0.28, f: 60, bp: 950, gain: 0.012 }); burst(t + 0.2, { type: 'lowpass', f: 520, dur: 0.07, gain: 0.035 }); },
    metal: (t) => { burst(t, { f: 3200, q: 3, dur: 0.02, gain: 0.018 }); tone(t, { f: 1870, dur: 0.22, gain: 0.009, verb: 0.2 }); tone(t, { f: 2810, dur: 0.12, gain: 0.005 }); },
    paper: (t) => { burst(t, { type: 'highpass', f: 2600, dur: 0.1, atk: 0.01, gain: 0.02 }); burst(t + 0.08, { type: 'highpass', f: 3000, dur: 0.12, atk: 0.02, gain: 0.014 }); },
    bottle: (t) => { burst(t, { f: 800, q: 2, dur: 0.06, gain: 0.018 }); tone(t + 0.02, { f: 480, f1: 540, dur: 0.12, gain: 0.009, type: 'triangle' }); },
    bowl: (t) => { burst(t, { f: 2600, q: 4, dur: 0.02, gain: 0.014 }); tone(t, { f: 690, dur: 0.25, gain: 0.008, type: 'triangle' }); },
    grit: (t) => { burst(t, { f: 1800, q: 0.8, dur: 0.12, atk: 0.02, gain: 0.02 }); burst(t + 0.1, { f: 1400, q: 0.8, dur: 0.1, gain: 0.014 }); },
    thing: (t) => { burst(t, { type: 'lowpass', f: 1200, dur: 0.08, gain: 0.022 }); },
  };
  function inspect(t, o) {
    const id = String(o.id || '');
    if (id === 'fire') { for (let i = 0; i < 4; i++) crackle(t + rnd(0, 0.25), 0.03, 0, sfx); burst(t, { type: 'lowpass', f: 600, dur: 0.12, gain: 0.025 }); return; }   // 장작을 뒤적인다
    if (!o.ev && ((id === 'speaker' && o.st === 'on') || (id === 'radio' && o.st === 'on'))) { radio(t, { v: 0.5 }); return; }   // 켜진 스피커·무전기 (사건이 걸리면 사건이 지직거린다)
    (TOUCH[material(id)] || TOUCH.thing)(t);
  }
  const OPEN = {
    crate: (t) => { creak(t, { dur: 0.6, f: 46, bp: 820, gain: 0.026, verb: 0.25 }); burst(t + 0.52, { type: 'lowpass', f: 420, dur: 0.1, gain: 0.055 }); tone(t + 0.52, { f: 95, f1: 58, dur: 0.15, gain: 0.036 }); },
    bag: (t) => { let tt = t; for (let i = 0; i < 14; i++) { burst(tt, { f: 4200, q: 2, dur: 0.012, gain: 0.013 }); tt += 0.03 - i * 0.0012; } burst(tt + 0.05, { f: 1800, q: 0.6, dur: 0.2, atk: 0.03, gain: 0.02 }); },
    box: (t) => { burst(t, { f: 3800, q: 6, dur: 0.018, gain: 0.032 }); burst(t + 0.075, { f: 3500, q: 6, dur: 0.018, gain: 0.028 }); burst(t + 0.14, { type: 'lowpass', f: 350, dur: 0.09, gain: 0.036 }); tone(t + 0.14, { f: 820, dur: 0.4, gain: 0.009, verb: 0.3 }); tone(t + 0.14, { f: 1236, dur: 0.28, gain: 0.006 }); },
    lever: (t) => { burst(t, { f: 1500, q: 2, dur: 0.2, atk: 0.05, gain: 0.014 }); burst(t + 0.2, { type: 'lowpass', f: 520, dur: 0.15, gain: 0.075, verb: 0.5 }); tone(t + 0.2, { f: 74, f1: 44, dur: 0.32, gain: 0.06 }); burst(t + 0.2, { f: 640, q: 12, dur: 0.55, gain: 0.026, verb: 0.6 }); },
    shutter: (t) => { for (let i = 0; i < 16; i++) burst(t + i * 0.055 + rnd(0, 0.01), { f: rnd(700, 1100), q: 2, dur: 0.05, gain: rnd(0.013, 0.026), verb: 0.3 }); burst(t, { f: 1200, q: 0.7, dur: 0.95, atk: 0.1, gain: 0.018 }); },
    valve: (t) => { creak(t, { dur: 0.7, f: 38, bp: 1700, gain: 0.016, verb: 0.4 }); burst(t + 0.66, { type: 'lowpass', f: 450, dur: 0.1, gain: 0.045 }); },
    // (10-25 P1-11) 원정 수납 가구 — 쇠 사물함 문(경첩 삐걱 → 문짝이 벽에 닿는 쇳소리) · 서랍(나무가 미끄러지다 턱 걸린다) ·
    //   드럼통 뚜껑(긁히며 벗겨지고 빈 통이 운다) · 선반 밑 뒤지기(종이·상자 밀리는 소리 + 캔 하나)
    locker: (t) => { creak(t, { dur: 0.42, f: 70, bp: 1500, gain: 0.014, verb: 0.3 }); burst(t + 0.38, { f: 2400, q: 5, dur: 0.02, gain: 0.03 }); tone(t + 0.38, { f: 690, dur: 0.5, gain: 0.008, verb: 0.4 }); tone(t + 0.38, { f: 1040, dur: 0.3, gain: 0.005 }); },
    drawer: (t) => { burst(t, { f: 700, f1: 1100, q: 0.9, dur: 0.32, atk: 0.04, gain: 0.03 }); creak(t + 0.02, { dur: 0.28, f: 90, bp: 1200, gain: 0.006 }); burst(t + 0.33, { type: 'lowpass', f: 480, dur: 0.08, gain: 0.05 }); tone(t + 0.33, { f: 120, f1: 80, dur: 0.1, gain: 0.03 }); },
    lid: (t) => { burst(t, { f: 1800, f1: 900, q: 2, dur: 0.35, atk: 0.03, gain: 0.02 }); burst(t + 0.34, { type: 'lowpass', f: 600, dur: 0.1, gain: 0.05, verb: 0.3 }); tone(t + 0.34, { f: 310, f1: 290, dur: 0.6, gain: 0.012, verb: 0.5 }); tone(t + 0.34, { f: 455, dur: 0.4, gain: 0.006 }); },
    rummage: (t) => { for (const dt of [0, 0.12, 0.27]) burst(t + dt, { type: 'lowpass', f: rnd(500, 900), dur: 0.09, gain: 0.03 }); burst(t + 0.2, { f: 2600, q: 5, dur: 0.02, gain: 0.02 }); tone(t + 0.2, { f: 1480, dur: 0.18, gain: 0.006, type: 'triangle' }); },
  };
  const OPEN_KIND = { crate_food: 'crate', bag: 'bag', medkit: 'box', shelter_box: 'box', lever: 'lever', pharmacy_shutter: 'shutter', valve: 'valve' };
  // 원정 수납 가구는 물건 id 앞머리로 (locker_a1 → 사물함 문) — 표에 없는 것은 상자(crate)
  const OPEN_PREFIX = [[/^locker_/, 'locker'], [/^drawer_/, 'drawer'], [/^barrel_/, 'lid'], [/^toolbox_/, 'box'], [/^crate_/, 'crate'], [/^shelf_/, 'rummage'], [/^(bag|bodybag)_/, 'bag'], [/^phonebooth/, 'box']];
  const openKind = (id) => { if (OPEN_KIND[id]) return OPEN_KIND[id]; for (const [re, k] of OPEN_PREFIX) if (re.test(String(id || ''))) return k; return 'crate'; };
  function open(t, o) { const ids = o.ids || []; OPEN[openKind(ids[0])](t); }

  // ── 선택 확정 · 판정 · 다침 · 죽음 · 말풍선 · 셔터 두드림 · 방송 지직 ──
  function pick(t, o) {
    if (o.danger) { tone(t, { f: 96, f1: 66, dur: 0.32, gain: 0.045 }); burst(t, { type: 'lowpass', f: 300, dur: 0.12, gain: 0.026 }); return; }   // 되돌릴 수 없는 것·경고 붙은 것: 낮게
    tone(t, { f: 300, f1: 255, dur: 0.06, gain: 0.016, type: 'triangle' }); burst(t, { type: 'highpass', f: 3000, dur: 0.012, gain: 0.005 });
  }
  function ok(t, o) {                                // 됐다: 참았던 숨을 내쉰다 · 죽을 뻔한 판정을 넘겼으면(close) 심장 두 번 뒤에
    let at = t;
    if (o.close) { for (const dt of [0, 0.26]) tone(t + dt, { f: 62, f1: 40, dur: 0.16, gain: 0.065, lp: 220 }); at = t + 0.55; }
    burst(at, { type: 'lowpass', f: 950, dur: 0.7, atk: 0.16, gain: 0.02 });
    tone(at, { f: 147, f1: 156, dur: 0.6, atk: 0.12, gain: 0.009 });
  }
  function bad(t) {                                  // 안 됐다: 낮게 가라앉는다
    tone(t, { f: 80, f1: 38, dur: 0.6, gain: 0.055 });
    burst(t, { type: 'lowpass', f: 260, dur: 0.25, gain: 0.04 });
    tone(t + 0.03, { f: 233, f1: 218, dur: 1.0, atk: 0.06, gain: 0.005, type: 'sawtooth', lp: 650 });
  }
  function hurt(t) {
    burst(t, { type: 'lowpass', f: 900, dur: 0.14, gain: 0.07, verb: 0.25 });
    tone(t, { f: 125, f1: 45, dur: 0.3, gain: 0.065 });
    burst(t + 0.008, { f: 2600, q: 1, dur: 0.05, gain: 0.018 });
    tone(t + 0.05, { f: 3100, dur: 1.4, atk: 0.2, gain: 0.002 });   // 귀가 잠깐 운다 (아주 작게)
  }
  function death(t) {                                // 낮은 충격 하나 → 앰비언트까지 다 꺼진다 (침묵은 새 판까지)
    burst(t, { type: 'lowpass', f: 700, dur: 0.12, gain: 0.05 });
    burst(t, { type: 'lowpass', f: 170, dur: 0.8, gain: 0.11, verb: 0.7 });
    tone(t, { f: 58, f1: 24, dur: 2.6, gain: 0.13 });
    deathHush = true;
    amb.gain.cancelScheduledValues(t); amb.gain.setValueAtTime(amb.gain.value, t); amb.gain.setTargetAtTime(0, t + 0.15, 0.35);
  }
  function bubble(t) { tone(t, { f: 1650, dur: 0.035, gain: 0.004 }); tone(t + 0.014, { f: 2180, dur: 0.03, gain: 0.0025 }); }
  function knock(t, o) {                             // 셔터 두드림: 쇠판 + 둔한 주먹 + 판 떨림. one = 한 번만(지도 위 두드림 박자에 맞춰 한 번씩)
    const v = o.v == null ? 1 : o.v, p = o.pan || 0;
    for (const dt of o.one ? [0] : [0, 0.33, 0.66]) {
      burst(t + dt, { f: 420, q: 1.4, dur: 0.1, gain: 0.065 * v, pan: p, verb: 0.5 });
      tone(t + dt, { f: 110, f1: 72, dur: 0.12, gain: 0.045 * v, pan: p });
      burst(t + dt + 0.004, { f: 1300, q: 5, dur: 0.3, gain: 0.014 * v, pan: p, verb: 0.4 });
    }
  }
  function radio(t, o) {                             // 방송·무전 지직: 끊겼다 이어지는 잡음 + 전기 웅웅. long = 스피커 방송(알아듣지 못할 목소리가 섞인다)
    const v = o.v == null ? 1 : o.v, dur = o.long ? 2.8 : 1.3;
    lastRadio = t;
    const s = ac.createBufferSource(); s.buffer = noise.white; s.loop = true;
    const bp = filt('bandpass', 2300, 0.55), hp = filt('highpass', 450, 0.7), g = gain0();
    g.gain.setValueAtTime(0, t);
    for (let tt = t; tt < t + dur; tt += rnd(0.015, 0.07)) g.gain.setValueAtTime(R() < 0.22 ? 0.0012 * v : rnd(0.008, 0.028) * v, tt);
    g.gain.setTargetAtTime(0, t + dur, 0.04);
    s.connect(bp); bp.connect(hp); hp.connect(g); route(g, { verb: 0.25 });
    s.start(t, R() * 0.5); s.stop(t + dur + 0.3);
    tone(t, { f: 50, dur, gain: 0.005 * v, type: 'square', lp: 320, atk: 0.02 });
    if (o.long) murmur(t + 0.4, dur - 0.6, v);
  }
  function murmur(t, dur, v) {                       // 모음 같은 대역 잡음을 음절 박자로 (말소리 같지만 낱말은 없다)
    const s = ac.createBufferSource(); s.buffer = noise.white; s.loop = true;
    const f1 = filt('bandpass', 700, 6), g = gain0();
    g.gain.setValueAtTime(0.0008, t);
    for (let tt = t; tt < t + dur - 0.2; tt += rnd(0.12, 0.28)) { g.gain.linearRampToValueAtTime(rnd(0.006, 0.014) * v, tt + 0.04); g.gain.linearRampToValueAtTime(0.0008, tt + rnd(0.08, 0.12)); f1.frequency.setValueAtTime(rnd(480, 950), tt); }
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f1); f1.connect(g); route(g, { verb: 0.4 });
    s.start(t, R() * 0.5); s.stop(t + dur + 0.1);
  }
  // 사건 창이 열릴 때: 본문이 그 소리를 말하면 (스피커·무전기 지직 · 셔터 두드림). 그 밖의 사건은 조용하다
  function event(t, o) {
    const id = String(o.id || ''), text = String(o.text || '');
    if (id === 'd7_broadcast') { note('event_sound', { id, sound: 'radio_long' }); return radio(t, { long: true, v: 0.9 }); }
    if (/지직|스피커가|무전기가/.test(text)) { const long = /스피커/.test(text); if (t - lastRadio > 1) { note('event_sound', { id, sound: long ? 'radio_long' : 'radio' }); radio(t, { long, v: 0.8 }); } return; }
    if (/두드리|두드린|두드려/.test(text)) { note('event_sound', { id, sound: 'knock' }); knock(t, { v: 0.8 }); }
  }

  // ── 앰비언트: 지도·자리·밤으로 목표값을 정하고(ambTargets) 0.1초마다 천천히 옮긴다(applyBeds) · 가끔 나는 것(물방울·타닥·쉿)은 schedule ──
  const PROFILE = {
    station: { hum: 1, air: 0.5, airF: 240, drip: [2.5, 8] },
    car: { hum: 0.8, air: 0.35, airF: 160, drip: [7, 16] },
    tunnel: { hum: 0.9, air: 0.85, airF: 420, drip: [1.6, 5] },
    mall: { hum: 0.85, air: 0.45, airF: 260, drip: [4, 11], water: 0.2 },
    drain: { hum: 0.8, air: 0.4, airF: 300, drip: [1.2, 4], water: 0.6 },
    title: { hum: 0.7, air: 0.35, airF: 200, drip: [5, 12] },
  };
  const profOf = (id) => PROFILE[id] || (/^mall/.test(id) ? PROFILE.mall : /^drain/.test(id) ? PROFILE.drain : PROFILE.station);
  const FIRE_ST = { lit: 1, kept: 1, low: 0.45, wet: 0.12 };
  const G = { hum: 1, air: 0.045, fire: 0.2, water: 0.11, crackle: 0.14, drip: 0.022, hiss: 0.035 };   // 바닥 크기(보통 마스터 0.5 기준으로 작게 맞춘 값 — sound_check.py 가 dBFS 로 잰다)
  const srcCache = {};
  function sources(m) {                              // 지도마다 한 번: 쉿 소리 자리(계단 S 칸·계단·환기 통로) · 물 자리(물 칸 w · 배수로 통로 B)
    if (srcCache[m.id]) return srcCache[m.id];
    const hiss = [], water = [];
    m.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (m.id === 'station' && c === 'S') hiss.push([x, y]); if (c === 'w' || (m.id === 'station' && c === 'B')) water.push([x, y]); } });
    for (const o of m.objects || []) if (/^(stairs_ash|vent_shaft)$/.test(o.id)) hiss.push([o.x, o.y]);
    return (srcCache[m.id] = { hiss, water });
  }
  function nearest(list, x, y) { let best = null; for (const [sx, sy] of list) { const d = Math.hypot(sx - x, sy - y); if (!best || d < best.d) best = { x: sx, y: sy, d }; } return best; }
  function posOf(sc) { const m = sc.moving; if (!m) return [sc.px, sc.py]; const k = 1 - Math.min(1, m.t); return [sc.px - m.dx * k, sc.py - m.dy * k]; }
  function ambTargets(info) {
    const tg = { map: 'title', night: false, hum: PROFILE.title.hum, humF: 1, air: PROFILE.title.air, airF: PROFILE.title.airF, fire: 0, firePan: 0, water: 0, waterPan: 0, drip: PROFILE.title.drip, hiss: null, amb: 1 };
    if (!info || !info.scene || !info.scene.map || !info.state) { if (deathHush) tg.amb = 0; return tg; }
    const sc = info.scene, st = info.state, m = sc.map, P = profOf(m.id);
    const night = st.phase === 'night' || st.phase === 'aftermath', eve = st.phase === 'evening';
    const k = night ? 0.55 : eve ? 0.85 : 1;
    const [x, y] = posOf(sc);
    tg.map = m.id; tg.night = night;
    tg.hum = P.hum * (night ? 0.6 : 1); tg.humF = night ? 0.86 : 1;                 // 밤: 더 낮고 조용하게
    tg.air = P.air * k; tg.airF = P.airF * (night ? 0.75 : 1);
    if (m.fire && m.fire[0] >= 0) {
      const d = Math.hypot(x - m.fire[0], y - m.fire[1]), near = clamp(1 - d / 12, 0, 1);
      const fst = st.traces && st.traces.fire ? st.traces.fire.st : 'lit';
      tg.fire = near * near * (FIRE_ST[fst] == null ? 1 : FIRE_ST[fst]) * (night ? 0.7 : 1);
      tg.firePan = clamp((m.fire[0] - x) / 7, -0.8, 0.8);
    }
    const src = sources(m), w = nearest(src.water, x, y);
    if (P.water) tg.water = P.water * (w ? 0.6 + 0.4 * clamp(1 - w.d / 6, 0, 1) : 1);   // 원정 지도 = 물 흐르는 소리 (배수로는 크게, 지하상가는 벽 너머로)
    else if (w) tg.water = 0.35 * Math.pow(clamp(1 - w.d / 10, 0, 1), 2);               // 승강장: 배수로 통로 쪽으로 가면 들린다
    if (w) tg.waterPan = clamp((w.x - x) / 6, -0.8, 0.8);
    tg.water *= night ? 0.75 : 1;
    tg.drip = night ? [P.drip[0] * 1.5, P.drip[1] * 1.5] : P.drip;
    const h = nearest(src.hiss, x, y);
    if (h && h.d < 8) tg.hiss = { v: Math.pow(1 - h.d / 8, 1.4) * (night ? 1.2 : 1), pan: clamp((h.x - x) / 6, -0.9, 0.9) };   // 안개 낀 계단·환기 통로 가까이: 가끔 낮은 쉿
    if (st.ended) tg.amb = 0.5;
    if (deathHush) tg.amb = 0;
    return tg;
  }
  // 목표값이 바뀐 것만 옮긴다 (0.1초마다 같은 값을 또 걸면 자동화 목록만 쌓인다). 바닥은 beds 에 지난 값을 적어 둔다
  function applyBeds(tg, tc) {
    const t = ac.currentTime, last = beds.last || (beds.last = new Map());
    const set = (p, v) => {
      const was = last.get(p);
      if (tc && was != null && Math.abs(was - v) <= Math.max(1e-4, Math.abs(v) * 0.01)) return;
      last.set(p, v);
      if (tc) p.setTargetAtTime(v, t, tc); else p.setValueAtTime(v, t);
    };
    set(beds.hum.gain, tg.hum * G.hum);
    for (const h of beds.humOsc) set(h.o.frequency, h.f * tg.humF);
    set(beds.air.gain, tg.air * G.air); set(beds.airLp.frequency, tg.airF);
    set(beds.fire.gain, tg.fire * G.fire);
    if (beds.firePan.pan) set(beds.firePan.pan, tg.firePan);
    set(beds.water.gain, tg.water * G.water);
    if (beds.waterPan.pan) set(beds.waterPan.pan, tg.waterPan);
    if (tg.water > 0 && (!tc || R() < 0.05)) set(beds.waterBp.frequency, 750 + R() * 400);   // 물살이 가끔 조금씩 바뀐다
    set(amb.gain, tg.amb);
  }
  function crackle(t, vol, pan, dest) {
    const b = noise.crk[Math.floor(R() * noise.crk.length)];
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rnd(0.7, 1.5);
    const hp = filt('highpass', rnd(900, 2200)), g = ac.createGain(); g.gain.value = vol;
    s.connect(hp); hp.connect(g); g.connect(dest || beds.fire);
    s.start(t);
  }
  function drip(t, v) { const f = rnd(900, 1700); tone(t, { f, f1: f * 1.9, dur: 0.05, gain: v, atk: 0.001, pan: rnd(-0.8, 0.8), bus: amb, verb: 0.9 }); }
  function hiss(t, v, pan) {
    const dur = rnd(2.6, 4.2);
    const s = ac.createBufferSource(); s.buffer = noise.white; s.loop = true;
    const bp = filt('bandpass', 1500, 0.9), hp = filt('highpass', 600), g = gain0();
    bp.frequency.setValueAtTime(1300, t); bp.frequency.linearRampToValueAtTime(rnd(1700, 2300), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.35); g.gain.linearRampToValueAtTime(v * 0.7, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp); bp.connect(hp); hp.connect(g); route(g, { bus: amb, pan, verb: 0.4 });
    s.start(t, R() * 0.5); s.stop(t + dur + 0.1);
  }
  const counts = { drip: 0, crackle: 0, hiss: 0 };
  function schedule(t0, t1, tg) {                   // [t0, t1) 안에 가끔 나는 것들
    if (tg.amb <= 0.001) return;
    let lam = 9 * tg.fire * (t1 - t0);              // 타닥: 불이 가까울수록 자주 (1초에 최대 9번)
    while (lam > 0) { if (R() < lam) { crackle(rnd(t0, t1), G.crackle * rnd(0.25, 1) * Math.sqrt(tg.fire)); counts.crackle++; } lam -= 1; }
    if (t0 >= clock.drip) { drip(rnd(t0, t1), G.drip * rnd(0.35, 1) * (tg.night ? 0.7 : 1)); counts.drip++; clock.drip = t0 + rnd(tg.drip[0], tg.drip[1]); }
    if (tg.hiss && t0 >= clock.hiss) { hiss(t0, G.hiss * tg.hiss.v, tg.hiss.pan); counts.hiss++; clock.hiss = t0 + rnd(10, 24); }
    else if (!tg.hiss && clock.hiss < t0 + 3) clock.hiss = t0 + rnd(3, 8);                // 멀리 있다가 다가가면 몇 초 뒤에
  }
  function tick() {
    if (!ac || broken || ac.state !== 'running' && !TEST) return;
    try {
      const fresh = performance.now() - seen.at < 500;                                    // 0.5초 넘게 frame 이 없으면 = 타이틀(게임 전)
      const tg = ambTargets(fresh ? seen : null);
      lastTg = tg;
      applyBeds(tg, 0.4);
      if (ac.state === 'running') schedule(ac.currentTime, ac.currentTime + 0.1, tg);
      const key = `${tg.map}|${tg.night ? 'night' : 'day'}|${tg.amb}`;
      if (key !== lastAmbKey) { lastAmbKey = key; note('amb', { map: tg.map, night: tg.night, amb: tg.amb, fire: +tg.fire.toFixed(2), water: +tg.water.toFixed(2) }); }
    } catch (e) { fail(e); }
  }

  // ── 게임이 프레임마다 부른다: 발걸음(걷기 박자) · 셔터 두드림(지도 위 박자) · 다침(당신 부상이 늘었다) ──
  // extra.knock = 셔터 너머 두드리는 중 (game.js bark.live.has('shutter') — render.js 가 같은 박자로 셔터를 흔든다)
  function frame(sc, st, now, extra) {
    if (OFF || broken) return;
    try {
      if (EAGER && !ac) start();
      seen.at = performance.now(); seen.scene = sc; seen.state = st; seen.knock = !!(extra && extra.knock);
      if (!ac || !sc || !sc.map || !st) return;
      // 새 판(state 가 바뀜) = 기준을 다시 잡고 죽음의 침묵을 푼다
      const you = st.people && st.people.you;
      const inj = you && you.n ? you.n.injury || 0 : 0;
      if (st !== lastState) { lastState = st; lastInj = inj; if (deathHush && !st.ended) { deathHush = false; note('hush_off', {}); } }
      else { if (inj > lastInj && !st.ended) play('hurt', { inj }); lastInj = inj; }
      // 발걸음: 이어 걸은 거리 16px 마다 한 박자 — 박자 0·2(왼발·오른발)에 한 번씩 = 한 칸에 한 걸음
      const wd = sc.walkDist || 0;
      if (wd <= 0) { walk.beat = -1; walk.wd = 0; }
      else {
        const pace = now > walk.t && wd > walk.wd ? (wd - walk.wd) / (now - walk.t) : 0;
        if (pace) walk.run = pace > 0.19;                                                    // 걷기 32px/230ms ≈ 0.14 · 달리기 ≈ 0.25
        const b = Math.floor(wd / 16);
        if (b !== walk.beat) {
          if (walk.beat < 0 || b % 2 === 0) { walk.foot ^= 1; play('step', { surface: surface(sc, sc.px, sc.py), run: walk.run, pan: walk.foot ? 0.08 : -0.08 }); }
          walk.beat = b;
        }
        walk.wd = wd;
      }
      walk.t = now;
      // 셔터 두드림: render.js 와 같은 시계(now % 2600 의 0·330·660ms)에 한 번씩 — 셔터가 흔들리는 그 프레임에 소리가 난다
      if (seen.knock && sc.map.id === 'station') {
        const ph = now % 2600;
        const hit = knockPh >= 0 && (ph < knockPh || (knockPh < 330 && ph >= 330) || (knockPh < 660 && ph >= 660));
        knockPh = ph;
        if (hit) {
          const sg = (sc.map.objects || []).find((o) => o.id === 'shutter_gap') || { x: 1, y: 6 };
          const [x, y] = posOf(sc), d = Math.hypot(x - sg.x, y - sg.y);
          play('knock', { one: true, v: 0.25 + 0.75 * Math.pow(clamp(1 - d / 18, 0, 1), 1.5), pan: clamp((sg.x - x) / 8, -0.85, 0.85) });
        }
      } else knockPh = -1;
    } catch (e) { fail(e); }
  }

  // ── 소리 내기: SND.play(<종류>, {...}). 첫 입력 전·꺼짐·탭 숨김·죽음의 침묵이면 아무것도 안 한다 ──
  const SFX = { step, inspect, open, pick, ok, fail: bad, hurt, death, bubble, knock, radio, event };
  function play(kind, o) {
    o = o || {};
    const why = OFF ? 'off' : broken ? 'broken' : !ac ? 'no-input-yet' : !pref.on ? 'muted' : hidden ? 'hidden' : deathHush && kind !== 'death' ? 'hush' : !SFX[kind] ? 'unknown' : '';
    if (TEST) { const s = {}; for (const k of ['surface', 'id', 'st', 'danger', 'close', 'v', 'one', 'run', 'inj']) if (o[k] !== undefined) s[k] = typeof o[k] === 'number' ? +o[k].toFixed(2) : o[k]; if (o.ids) s.ids = o.ids.join(','); note(kind, Object.assign(s, { played: !why, why: why || undefined, nodes: nodeCount })); }
    if (why) return false;
    try { SFX[kind](ac.currentTime + 0.01, o); return true; } catch (e) { fail(e); return false; }
  }

  // ── 켜기·끄기 · 크기 · M 키 · 탭 숨김 · 첫 입력 ──
  function setOn(v) {
    pref.on = !!v; savePref();
    if (pref.on && !ac && gestured) start();
    applyMaster();
    note('setOn', { on: pref.on });
  }
  function setLevel(i) {
    pref.level = clamp(Math.round(i), 0, 2); savePref();
    applyMaster(0.08);
    note('setLevel', { level: pref.level });
    if (ac && pref.on && !hidden) setTimeout(() => play('pick', {}), 160);                  // 새 크기로 한 번 들려 준다
  }
  function toggle() {
    setOn(!pref.on);
    try { if (root.UI && root.UI.toast) root.UI.toast(pref.on ? `소리 켬 — ${LEVEL_NAMES[pref.level]} (M)` : '소리 끔 (M)', 1300); } catch (e) { /* 토스트 없어도 */ }
    return pref.on;
  }
  // 멈춤 메뉴(Esc)에 붙는 두 줄: 켜기·끄기 · 크기(작게 → 보통 → 크게 → 작게). menuPick 이 true 면 메뉴로 돌아간다
  function menu() {
    return [{ label: pref.on ? '소리 끄기' : '소리 켜기', sub: '<small>M</small>', value: 'snd:onoff' },
      { label: `소리 크기 — ${LEVEL_NAMES[pref.level]}`, sub: '<small>작게 · 보통 · 크게</small>', value: 'snd:level' }];
  }
  function menuPick(v) {
    if (v === 'snd:onoff') { setOn(!pref.on); return true; }
    if (v === 'snd:level') { setLevel((pref.level + 1) % 3); return true; }
    return false;
  }
  if (!OFF) {
    // 첫 입력: 사용자 활성화가 되는 입력만 (Esc·Shift·Ctrl·Alt·Meta·Tab 키는 아니다). 그 뒤에도 멈춰 있으면(브라우저가 막았다) 입력마다 다시 깨운다
    const NOT_GESTURE = ['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'];
    const onGesture = (e) => {
      try {
        if (e.type === 'keydown' && NOT_GESTURE.includes(e.key)) return;
        gestured = true;
        if (!pref.on || hidden || broken) return;
        if (!ac) start(); else if (ac.state === 'suspended') ac.resume().catch(() => {});
      } catch (err) { fail(err); }
    };
    for (const ev of ['keydown', 'pointerdown', 'mousedown', 'touchend']) root.addEventListener(ev, onGesture, true);
    root.addEventListener('keydown', (e) => {
      if (e.repeat || (e.target && e.target.tagName === 'INPUT') || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') { toggle(); e.preventDefault(); }
    });
    if (root.document) root.document.addEventListener('visibilitychange', () => { hidden = root.document.visibilityState === 'hidden'; applyMaster(hidden ? 0.08 : 0.25); note('visibility', { hidden }); });
  }

  // ── 확인용 (v4/tools/sound_check.py) ──
  function status() {
    return { off: OFF, test: TEST, eager: EAGER, broken, gestured, ctx: ac ? ac.state : null, on: pref.on, level: pref.level, levelName: LEVEL_NAMES[pref.level], hidden, deathHush,
      nodes: nodeCount, nodeKinds: Object.assign({}, nodeKinds), counts: Object.assign({}, counts), master: master ? +master.gain.value.toFixed(4) : null,
      amb: lastTg ? { map: lastTg.map, night: lastTg.night, hum: +lastTg.hum.toFixed(3), humF: lastTg.humF, air: +lastTg.air.toFixed(3), fire: +lastTg.fire.toFixed(3), water: +lastTg.water.toFixed(3), hiss: lastTg.hiss ? +lastTg.hiss.v.toFixed(3) : 0, amb: lastTg.amb } : null };
  }
  function meter() {                                 // 확인용 탭(압축기 뒤 = 스피커로 갈 소리, 출력은 0): 지금 2048 샘플의 RMS·최댓값 (dBFS)
    if (!tap) return null;
    const d = new Float32Array(tap.fftSize); tap.getFloatTimeDomainData(d);
    let s = 0, p = 0; for (const v of d) { s += v * v; p = Math.max(p, Math.abs(v)); }
    const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(1) : -200);
    return { rms: db(Math.sqrt(s / d.length)), peak: db(p) };
  }
  // 오프라인으로 한 소리를 그려 크기를 잰다: kind = SFX 종류 또는 'amb'(o = {scene, state} 모양). 실제 그래프(크기·압축기·잔향)와 같은 길로
  async function offline(kind, o, sec, level, wantPcm) {
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return null;
    const sr = 48000, off = new OAC(2, Math.ceil(sr * (sec || 2)), sr);
    const saved = [ac, out, comp, master, amb, sfx, verb, tap, noise, beds, deathHush, clock, lastRadio];
    try {
      ac = off; tap = null; deathHush = false; lastRadio = -9;
      noise = makeNoises(off); graph(off, LEVELS[level == null ? 1 : level], false);
      if (o && o.raw) { master.disconnect(); master.connect(off.destination); }   // 확인용: 압축기 없이
      if (kind === 'amb') {
        beds = makeBeds(); const tg = ambTargets(o); clock = { drip: 0.3, hiss: 0.5 };
        if (o.only) { for (const k of ['hum', 'air', 'fire', 'water']) if (k !== o.only) tg[k] = 0; if (o.only !== 'hiss') tg.hiss = null; if (o.only !== 'drip') clock.drip = 1e9; }   // 한 층만 (크기 맞추기용)
        applyBeds(tg, 0); for (let t = 0; t < sec; t += 0.1) schedule(t, t + 0.1, tg);
      }
      else SFX[kind](0.02, o || {});
    } finally { [ac, out, comp, master, amb, sfx, verb, tap, noise, beds, deathHush, clock, lastRadio] = saved; }
    const buf = await off.startRendering();
    const L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length, win = Math.floor(sr * 0.05);
    let p = 0, pi = 0, s = 0, ws = 0, wmax = 0;
    for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > p) { p = a; pi = i; } const e = (L[i] * L[i] + Rr[i] * Rr[i]) / 2; s += e; ws += e; if ((i + 1) % win === 0) { wmax = Math.max(wmax, ws / win); ws = 0; } }
    const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(1) : -200);
    const res = { kind, sec, level: LEVEL_NAMES[level == null ? 1 : level], peakDb: db(p), peakAt: +(pi / sr).toFixed(3), rmsDb: db(Math.sqrt(s / n)), loudest50msDb: db(Math.sqrt(wmax)) };
    if (wantPcm) {                                   // 견본 WAV 용: 16비트 스테레오를 base64 로
      const pcm = new Int16Array(n * 2); for (let i = 0; i < n; i++) { pcm[2 * i] = clamp(L[i], -1, 1) * 32767; pcm[2 * i + 1] = clamp(Rr[i], -1, 1) * 32767; }
      let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      res.pcm = btoa(bin); res.sampleRate = sr;
    }
    return res;
  }

  root.SND = { frame, play, menu, menuPick, setOn, setLevel, toggle, status, meter, log, _offline: offline, LEVEL_NAMES,
    get on() { return pref.on; }, get level() { return pref.level; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
