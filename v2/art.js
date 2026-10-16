// 어두운 역 v2 — 그림: 상태를 SVG 문자열로 바꾸는 순수 함수들 (그림 파일 없이 코드로 그림 → 가볍고 Node에서도 돌아감)
// stationScene: 역 단면도 (배치·시설·침수·노출·전력이 그대로 보임) / routeMap: 노선도 / portrait: 주민 초상화
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.DS2;
  const D = E.D;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const given = (name) => name.slice(1); // 김순례 → 순례
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── 초상화 ──
  // 사람마다 머리 모양·소품을 다르게, 상태(스트레스·부상·탈진·사망)에 따라 표정과 붕대가 바뀐다
  const LOOKS = {
    soonrye: { skin: '#c9ab8c', hair: '#b9b4ab', collar: '#c97a3a',
      back: '<ellipse cx="24" cy="12" rx="6" ry="4.5" fill="#b9b4ab"/>',
      front: '<path d="M14 21 Q15 11 24 11 Q33 11 34 21 Q30 15 24 15 Q18 15 14 21Z" fill="#b9b4ab"/>',
      extra: '<circle cx="20" cy="24" r="3" fill="none" stroke="#3a3530" stroke-width=".9"/><circle cx="28" cy="24" r="3" fill="none" stroke="#3a3530" stroke-width=".9"/><path d="M23 24h2" stroke="#3a3530" stroke-width=".9"/><path d="M17 29q1.5 1 3 0M28 29q1.5 1 3 0" stroke="#9c8268" stroke-width=".6" fill="none"/>' },
    seoha: { skin: '#d8b896', hair: '#1c1a1a', collar: '#2c3550', tie: '#9b3b3b',
      back: '<path d="M12 22 Q11 9 24 8 Q37 9 36 22 L37 39 Q33 37 33 28 L15 28 Q15 37 11 39Z" fill="#1c1a1a"/>',
      front: '<path d="M14 21 Q16 11 24 11 Q32 11 34 21 Q31 16 26 16 L22 18 Q18 17 14 21Z" fill="#1c1a1a"/>' },
    gicheol: { skin: '#b8916e', hair: '#2a2622', collar: '#596068',
      back: '',
      front: '<path d="M13 19 Q14 9 24 9 Q34 9 35 19Z" fill="#26344a"/><path d="M12 19h25v2.2H12z" fill="#1d2838"/><circle cx="24" cy="14" r="1.6" fill="#c9a24a"/>',
      extra: '<path d="M20 30.5 Q24 29 28 30.5 Q24 32 20 30.5Z" fill="#2a2622"/>' },
    eunji: { skin: '#d4b08e', hair: '#5a3a26', collar: '#7a8b5a',
      back: '<path d="M13 30 Q11 12 24 10 Q37 12 35 30 L31 30 L31 22 L17 22 L17 30Z" fill="#5a3a26"/>',
      front: '<path d="M14 21 Q15 11 24 11 Q33 11 34 21 L30 17 L27 19 L24 16.5 L21 19 L18 17Z" fill="#5a3a26"/>',
      extra: '<path d="M18 40 L20 48 M30 40 L28 48" stroke="#c9b48a" stroke-width="1.6"/>' },
    dongha: { skin: '#b08562', hair: '#16130f', collar: '#3d3a35', wide: true,
      back: '',
      front: '<path d="M15 19 Q16 12 24 12 Q32 12 33 19Z" fill="#16130f"/><path d="M14.5 17.5 Q24 14 33.5 17.5 L33.5 20 Q24 16.6 14.5 20Z" fill="#dcd6c8"/>' },
    mari: { skin: '#cfa889', hair: '#2e2420', collar: '#8fb0c4',
      back: '<circle cx="24" cy="11" r="4.2" fill="#2e2420"/>',
      front: '<path d="M14 21 Q15 12 24 12 Q33 12 34 21 Q29 16 24 16 Q19 16 14 21Z" fill="#2e2420"/><path d="M17 12.5 L31 12.5 L29.5 8.5 L18.5 8.5Z" fill="#e8e4da"/><path d="M24 9.4v2.4M22.8 10.6h2.4" stroke="#b5483e" stroke-width=".9"/>' },
    eunchae: { skin: '#d6b393', hair: '#2a2220', collar: '#e8e4da',
      back: '<path d="M12 31 Q11 10 24 9 Q37 10 36 31 Q34 35 31 34 L31 22 L17 22 L17 34 Q14 35 12 31Z" fill="#2a2220"/>',
      front: '<path d="M14 21 Q16 11 24 11 Q32 11 34 21 Q28 15 20 17Z" fill="#2a2220"/>' },
    dohyeon: { skin: '#b48d6a', hair: '#211d18', collar: '#4f5a4a',
      back: '',
      front: '<path d="M13 19 Q13 8 24 8 Q35 8 35 19Z" fill="#d6b03c"/><path d="M11.5 18.5h25v2.4h-25z" fill="#b8962e"/>' },
  };

  function portrait(id, st, size) {
    const L = LOOKS[id];
    if (!L) return '';
    st = st || {};
    const sz = size || 40;
    const dead = st.status === 'dead';
    const inj = st.injury || 0;
    const stress = st.stress || 0;
    const tired = st.breakdown > 0;
    const skin = inj >= 3 ? '#b9a596' : L.skin;
    const shoulders = L.wide ? 'M6 48 Q7 37 24 36 Q41 37 42 48Z' : 'M9 48 Q10 38 24 37 Q38 38 39 48Z';
    let eyes;
    if (tired || dead) eyes = '<path d="M18.5 24.5h3M26.5 24.5h3" stroke="#2a2420" stroke-width="1.1" stroke-linecap="round"/>';
    else eyes = '<circle cx="20" cy="24" r="1.15" fill="#2a2420"/><circle cx="28" cy="24" r="1.15" fill="#2a2420"/>';
    let mouth;
    if (stress >= 70 || inj >= 2) mouth = '<path d="M21 31.5 Q24 29.6 27 31.5" stroke="#5a3a30" stroke-width="1" fill="none" stroke-linecap="round"/>';
    else if (stress >= 40) mouth = '<path d="M21.2 30.8h5.6" stroke="#5a3a30" stroke-width="1" stroke-linecap="round"/>';
    else mouth = '<path d="M21 30 Q24 32.2 27 30" stroke="#5a3a30" stroke-width="1" fill="none" stroke-linecap="round"/>';
    let marks = '';
    if (stress >= 70 && !dead) marks += '<path d="M33 19 q1.2 2 0 3 q-1.2 -1 0 -3Z" fill="#8fb0c4"/>';
    if (inj >= 1) marks += '<path d="M15 16.5 L33 19.5" stroke="#e8e2d4" stroke-width="2.6"/>';
    if (inj >= 2) marks += '<rect x="27.5" y="26.5" width="4.5" height="3" rx=".6" fill="#e8e2d4" transform="rotate(-12 29.7 28)"/>';
    if (inj >= 3) marks += '<path d="M15.2 16.6 L18 17.1" stroke="#b5483e" stroke-width="2.6"/>';
    const collar = L.tie ? `<path d="M19 37 L24 42 L29 37" fill="none" stroke="#e8e4da" stroke-width="1.4"/><path d="M24 41 l-1.3 5 h2.6Z" fill="${L.tie}"/>` : '';
    const ring = inj >= 3 && !dead ? '#b5483e' : inj === 2 && !dead ? '#c99b48' : '#3a3732';
    return `<svg class="portrait${dead ? ' dead' : ''}" width="${sz}" height="${sz}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
      + `<circle cx="24" cy="24" r="23.5" fill="#1f1d1a" stroke="${ring}"/>`
      + `<g clip-path="circle(23px at 24px 24px)" style="clip-path:circle(23px at 24px 24px)">`
      + L.back
      + `<path d="${shoulders}" fill="${L.collar}"/>${collar}`
      + `<rect x="21" y="31" width="6" height="7" fill="${skin}"/>`
      + `<ellipse cx="24" cy="24" rx="9.6" ry="11" fill="${skin}"/>`
      + L.front + eyes + mouth + (L.extra || '') + marks
      + '</g></svg>';
  }

  // ── 역 단면도 ──
  // 무대: 왼쪽 출구 계단(노출=안개) · 뒷벽 상점·시설 자리 · 승강장(사람) · 선로(멈춘 전동차·발전기·침수 물) · 오른쪽 끊긴 통로
  const W = 360, H = 190;
  const PLAT = 112;       // 승강장 바닥(사람이 서는 선)
  const TRACK = 182;      // 선로 바닥
  const REST_X = [158, 196, 214, 140, 232, 122, 104];   // 쉬는 사람은 화로(176) 둘레에
  // 할 일별 서 있는 자리 [x, 바닥 y, 간격]
  const SPOT = {
    rest: [176, PLAT, 20], forage: [86, PLAT, 19], salvage: [58, PLAT, 19], pump: [236, PLAT, 19],
    gen: [252, TRACK - 6, 19], drain: [130, TRACK - 4, 20], guard: [26, PLAT, 18], tend: [128, PLAT, 19],
    build: [150, PLAT, 19], farm: [150, PLAT, 19],
  };

  function figure(x, y, o) {
    // 서 있는 사람(머리+몸통) 또는 누운 사람
    const fill = o.crit ? '#c47a6c' : o.hurt ? '#b9a07a' : '#b8ad98';
    const label = `<text x="${x}" y="${y + 9}" class="nm" text-anchor="middle">${esc(o.name)}</text>`;
    if (o.lying) return `<g class="fig"><ellipse cx="${x}" cy="${y - 2.5}" rx="9" ry="3" fill="${fill}"/><circle cx="${x - 10}" cy="${y - 3.5}" r="3" fill="${fill}"/>${label}</g>`;
    const bob = o.work ? ' work' : '';
    return `<g class="fig${bob}"><circle cx="${x}" cy="${y - 19}" r="3.4" fill="${fill}"/><path d="M${x - 4.2} ${y} L${x - 4.6} ${y - 9} Q${x - 4.8} ${y - 15} ${x} ${y - 15} Q${x + 4.8} ${y - 15} ${x + 4.6} ${y - 9} L${x + 4.2} ${y}Z" fill="${fill}"/>${label}</g>`;
  }

  function stationScene(s, plan, power) {
    // plan: 오늘 실제로 하게 될 일 { rid: task }, power: { lit: 전등이 켜지는지 }
    plan = plan || s.plan || {};
    const lit = !!(power && power.lit);
    const flood = clamp(s.flood || 0, 0, 8);
    const expo = clamp(s.exposure || 0, 0, 8);
    const waterTop = TRACK - flood * 8.2;            // 침수 8이면 승강장 턱 근처까지
    const genDrowned = flood >= E.FLOOD_POWER_STOP;
    let g = '';
    // 배경 벽
    g += `<rect width="${W}" height="${H}" fill="#121110"/>`;
    g += `<rect x="0" y="16" width="${W}" height="${PLAT - 16}" fill="${lit ? '#24211c' : '#191715'}"/>`;
    // 전등 + 빛
    for (const x of [70, 150, 230, 310]) {
      g += `<path d="M${x} 0v10" stroke="#3a3732"/><rect x="${x - 9}" y="10" width="18" height="3" fill="${lit ? '#f0d9a0' : '#3a3732'}" class="${lit ? 'lamp' : ''}"/>`;
      if (lit) g += `<path d="M${x - 9} 13 L${x - 34} ${PLAT} L${x + 34} ${PLAT} L${x + 9} 13Z" fill="url(#ds-beam)" class="lamp"/>`;
    }
    // 천장
    g += `<rect x="0" y="0" width="${W}" height="9" fill="#0b0a09"/>`;
    // 출구 계단 + 지상 안개(노출)
    g += '<path d="M0 22 L44 22 L44 112 L0 112Z" fill="#0f0e0d"/>';
    for (let i = 0; i < 9; i++) g += `<path d="M${4 + i * 4} ${104 - i * 9.5}h8" stroke="#3a3732" stroke-width="2"/>`;
    g += '<text x="6" y="20" class="lbl">출구</text>';
    if (expo > 0) {
      const op = (0.12 + expo / 8 * 0.6).toFixed(2);
      g += `<g class="fog" opacity="${op}"><ellipse cx="16" cy="30" rx="30" ry="12" fill="#8d8a80"/><ellipse cx="34" cy="${36 + expo * 4}" rx="${18 + expo * 2}" ry="8" fill="#8d8a80"/>${expo >= 6 ? `<ellipse cx="60" cy="${60 + expo * 3}" rx="26" ry="9" fill="#8d8a80"/>` : ''}</g>`;
    }
    // 뒷벽: 상점 셔터
    g += '<rect x="64" y="40" width="44" height="50" fill="#1a1917" stroke="#2c2a26"/>';
    for (let y = 44; y < 90; y += 4) g += `<path d="M64 ${y}h44" stroke="#2c2a26"/>`;
    g += '<text x="70" y="36" class="lbl">상점</text>';
    // 시설 자리
    g += facilityArt(s, lit);
    // 화로
    g += '<g class="fire"><path d="M168 112 L184 112 L181 104 L171 104Z" fill="#3a2a1e"/><path d="M176 104 Q170 98 174 92 Q175 97 177 95 Q178 90 176 86 Q184 93 180 104Z" fill="#e0a24a"/><path d="M176.5 104 Q173.5 100 176 96 Q177.5 99.5 179 104Z" fill="#f4d58a"/></g>';
    g += '<ellipse cx="176" cy="110" rx="38" ry="12" fill="url(#ds-fire)"/>';
    // 물 긷기 펌프
    g += '<path d="M248 112v-24h6v4h-3v20Z" fill="#4a4740"/><path d="M252 112v40" stroke="#4a4740" stroke-width="2"/>';
    // 승강장 바닥 / 턱
    g += `<rect x="0" y="${PLAT}" width="${W}" height="6" fill="#2c2a26"/><path d="M44 ${PLAT + 6}H${W}" stroke="#d6b25a" stroke-width="1.4" stroke-dasharray="6 4" opacity=".55"/>`;
    // 선로
    g += `<rect x="0" y="${PLAT + 6}" width="${W}" height="${H - PLAT - 6}" fill="#0c0b0a"/>`;
    g += `<path d="M0 ${TRACK}H${W}" stroke="#4a4740" stroke-width="2"/><path d="M0 ${TRACK - 4}H${W}" stroke="#3a3732"/>`;
    // 멈춘 전동차 (붉은 비상등)
    g += `<rect x="8" y="${PLAT + 12}" width="196" height="46" rx="5" fill="#1d1f22" stroke="#34373b"/>`;
    for (let x = 18; x < 196; x += 30) g += `<rect x="${x}" y="${PLAT + 18}" width="20" height="14" fill="#101214" stroke="#2a2d31"/>`;
    g += `<circle cx="198" cy="${PLAT + 18}" r="2.4" fill="#d9786b" class="blink"/>`;
    // 발전기
    g += `<g class="${genDrowned ? 'off' : ''}"><rect x="236" y="${TRACK - 30}" width="34" height="26" fill="#2f3a2e" stroke="#4a5a46"/><circle cx="246" cy="${TRACK - 17}" r="6" fill="none" stroke="#6a7a62" stroke-width="2"/><text x="236" y="${TRACK - 33}" class="lbl${genDrowned ? ' bad' : ''}">발전기${genDrowned ? ' 잠김' : ''}</text></g>`;
    // 끊긴 통로 → 고지대 방면
    g += passageArt(s);
    // 사람들 (물보다 먼저 그려 물에 잠긴 느낌)
    g += people(s, plan, genDrowned);
    // 침수 물
    if (flood > 0) g += `<rect x="0" y="${waterTop.toFixed(1)}" width="${W}" height="${(TRACK + 8 - waterTop).toFixed(1)}" fill="#6d8fb3" opacity="${flood >= E.FLOOD_POWER_STOP ? '.42' : '.3'}"/><path d="M0 ${waterTop.toFixed(1)}H${W}" stroke="#9cbbd8" opacity=".5" class="wave"/>`;
    // 정전이면 전체가 어두워진다
    if (!lit) g += `<rect width="${W}" height="${H}" fill="#000" opacity=".38" pointer-events="none"/>`;
    const defs = '<defs><linearGradient id="ds-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d9a0" stop-opacity=".22"/><stop offset="1" stop-color="#f0d9a0" stop-opacity="0"/></linearGradient><radialGradient id="ds-fire"><stop offset="0" stop-color="#e0a24a" stop-opacity=".35"/><stop offset="1" stop-color="#e0a24a" stop-opacity="0"/></radialGradient></defs>';
    const desc = `역 단면도: 전등 ${lit ? '켜짐' : '꺼짐'}, 침수 ${flood}, 노출 ${expo}`;
    return `<figure class="scene"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">${defs}${g}</svg></figure>`;
  }

  function facilityArt(s, lit) {
    const x = 122, y = 30, w = 56, h = 60;
    let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#151413" stroke="#3a3732"/>`;
    const proj = s.project && s.project.id !== 'repair' ? s.project : null;
    if (s.facility === 'farm') {
      g += `<text x="${x}" y="${y - 4}" class="lbl">버섯 재배실</text>`;
      for (let r = 0; r < 3; r++) {
        const yy = y + 16 + r * 16;
        g += `<path d="M${x + 4} ${yy}h${w - 8}" stroke="#5a554c" stroke-width="2"/>`;
        for (let i = 0; i < 6; i++) g += `<ellipse cx="${x + 9 + i * 8}" cy="${yy - 2.5}" rx="3" ry="2" fill="#c9b49a"/>`;
      }
      if (lit) g += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="6" fill="#b48ad6" opacity=".35"/>`;
    } else if (s.facility === 'clinic') {
      g += `<text x="${x}" y="${y - 4}" class="lbl">진료소</text>`;
      g += `<path d="M${x + w / 2} ${y + 10}v16M${x + w / 2 - 8} ${y + 18}h16" stroke="#d9786b" stroke-width="5"/>`;
      g += `<rect x="${x + 6}" y="${y + 40}" width="${w - 12}" height="8" fill="#d8d4cb" opacity=".7"/><path d="M${x + 8} ${y + 48}v8M${x + w - 8} ${y + 48}v8" stroke="#5a554c" stroke-width="2"/>`;
    } else if (proj) {
      const P = D.PROJECTS[proj.id];
      g += `<text x="${x}" y="${y - 4}" class="lbl">공사 중: ${esc(P.name)}</text>`;
      g += `<path d="M${x + 6} ${y + h}L${x + 6} ${y + 8}M${x + w - 6} ${y + h}L${x + w - 6} ${y + 8}M${x + 6} ${y + 20}L${x + w - 6} ${y + 40}M${x + w - 6} ${y + 20}L${x + 6} ${y + 40}M${x + 6} ${y + 30}h${w - 12}" stroke="#d6b25a" stroke-width="1.6" opacity=".8"/>`;
      g += `<rect x="${x + 6}" y="${y + h - 8}" width="${w - 12}" height="4" fill="#3a3732"/><rect x="${x + 6}" y="${y + h - 8}" width="${((w - 12) * proj.progress / P.work).toFixed(1)}" height="4" fill="#d6b25a"/>`;
    } else {
      g += `<text x="${x}" y="${y - 4}" class="lbl">빈 자리</text><path d="M${x + 14} ${y + h}V${y + 18}h${w - 28}V${y + h}" fill="#0b0a09" stroke="#2c2a26"/>`;
    }
    return g;
  }

  function passageArt(s) {
    const x = 300;
    let g = `<path d="M${x} ${TRACK}V${PLAT + 22} Q${x + 30} ${PLAT + 4} ${W} ${PLAT + 22}V${TRACK}Z" fill="#080706" stroke="#3a3732"/>`;
    g += `<text x="${x - 2}" y="${PLAT + 18}" class="lbl" text-anchor="end">고지대 방면 →</text>`;
    if (s.flags && s.flags.passage_secured) {
      g += `<path d="M${x + 8} ${TRACK - 4}L${W} ${TRACK - 4}" stroke="#e0a24a" stroke-width="2" class="lamp"/><circle cx="${x + 34}" cy="${PLAT + 34}" r="10" fill="#e0a24a" opacity=".25"/><text x="${x + 6}" y="${TRACK - 10}" class="lbl ok">이어짐</text>`;
    } else if (s.project && s.project.id === 'repair') {
      g += `<path d="M${x + 8} ${TRACK - 2}l12 -18l12 18M${x + 32} ${TRACK - 2}l12 -18l12 18" fill="#3a332a" stroke="#d6b25a" stroke-width="1.2"/>`;
    } else {
      g += `<path d="M${x + 4} ${TRACK}l8 -20l10 6l9 -16l10 12l8 -8l11 26Z" fill="#3a3530" stroke="#4a4740"/>`;
    }
    return g;
  }

  function people(s, plan, genDrowned) {
    const count = {};
    let g = '';
    for (const r of s.residents) {
      if (r.status === 'dead' || r.status === 'exp') continue;
      const lying = r.injury >= 2;
      let task = lying ? 'tend' : (plan[r.id] || 'rest');
      if (task === 'gen' && genDrowned) task = 'rest';        // 발전기가 잠기면 그 사람은 쉰다 (엔진과 같은 규칙)
      if (task === 'build' && s.project && s.project.id === 'repair') task = 'repair';
      let spot = SPOT[task] || SPOT.rest;
      if (task === 'repair') spot = [326, TRACK - 4, 18];
      // 같은 자리에 여럿이면 가운데부터 좌우로 번갈아 선다 (누운 사람은 침상 줄)
      const k = lying ? 'bed' : task;
      const n = count[k] = (count[k] || 0) + 1;
      const x = lying ? 92 + (n - 1) * 26 : task === 'rest' ? REST_X[(n - 1) % REST_X.length] : spot[0] + (n === 1 ? 0 : (n % 2 === 0 ? -1 : 1) * Math.ceil((n - 1) / 2) * spot[2]);
      const y = lying ? PLAT : spot[1];
      g += figure(Math.round(x), y, { name: given(r.name), lying, hurt: r.injury === 1, crit: r.injury >= 3, work: task !== 'rest' && !lying });
    }
    return g;
  }

  // ── 노선도 ──
  function routeMap(s, sel) {
    const f = s.flags || {};
    const st = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#d8d4cb" stroke-width="2"/>`;
    const C = { A: '#c98a3a', B: '#5b8bb5', main: '#3cb44a' };
    const HOME = [178, 112], GOAL = [318, 112];
    let g = '<rect width="360" height="224" fill="#121110"/>';
    for (let x = 0; x <= 360; x += 24) g += `<path d="M${x} 0V224" stroke="#191816"/>`;
    for (let y = 0; y <= 224; y += 24) g += `<path d="M0 ${y}H360" stroke="#191816"/>`;
    // 원정 두 갈래: 역 번호(깊이)는 동그라미 안에, 이름은 가장자리에
    const branch = (k, pts, labelY) => {
      const R = D.REGIONS[k];
      const closed = s.closed && s.closed[k] > 0;
      const on = sel === k;
      const d = 'M' + [HOME].concat(pts).map((p) => p.join(' ')).join(' L');
      let h = '';
      if (on) h += `<path d="${d}" stroke="${C[k]}" stroke-width="18" fill="none" opacity=".2" stroke-linejoin="round"/>`;
      h += `<path d="${d}" stroke="${C[k]}" stroke-width="${on ? 8 : 6}" fill="none" stroke-linejoin="round" opacity="${closed ? '.35' : '1'}"/>`;
      pts.forEach((p, i) => { h += st(p[0], p[1], 9, '#121110') + `<text x="${p[0]}" y="${p[1] + 4}" class="lbl strong" text-anchor="middle">${i + 1}</text>`; });
      h += `<text x="10" y="${labelY}" class="lbl strong" fill="${C[k]}" style="fill:${C[k]}">${esc(R.name)}</text><text x="10" y="${labelY + 14}" class="lbl">${esc(R.sub)}</text>`;
      if (closed) { const m = pts[0]; h += `<path d="M${m[0] - 10} ${m[1] - 10}l20 20M${m[0] + 10} ${m[1] - 10}l-20 20" stroke="#d9786b" stroke-width="3.4"/><text x="${m[0] + 14}" y="${m[1] + (k === 'A' ? -8 : 16)}" class="lbl bad">막힘 ${s.closed[k]}일</text>`; }
      return h;
    };
    g += branch('A', [[120, 74], [64, 46]], 18);
    g += branch('B', [[120, 150], [64, 178]], 200);
    // 연락 닿은 사람
    if (f.met_eunchae || f.hospital_pact) g += '<text x="106" y="76" class="lbl ok" text-anchor="end">✚ 은채</text>';
    if (f.met_dohyeon || f.repair_open) g += '<text x="106" y="148" class="lbl ok" text-anchor="end">⚒ 도현</text>';
    // 고지대 역으로 가는 통로
    const pass = !!f.passage_secured;
    const repairing = s.project && s.project.id === 'repair';
    g += `<path d="M${HOME[0]} ${HOME[1]} H${GOAL[0]}" stroke="${C.main}" stroke-width="6" ${pass ? '' : 'stroke-dasharray="4 7" opacity=".55"'}/>`;
    const passTxt = pass ? '통로 이어짐' : repairing ? `통로 수리 ${s.project.progress}/${D.PROJECTS.repair.work}` : '통로 끊김';
    g += `<text x="${(HOME[0] + GOAL[0]) / 2}" y="${HOME[1] - 12}" class="lbl ${pass ? 'ok' : repairing ? 'warn' : 'bad'}" text-anchor="middle">${passTxt}</text>`;
    // 역
    g += st(HOME[0], HOME[1], 12, '#121110') + st(HOME[0], HOME[1], 5, '#d8d4cb');
    g += `<text x="${HOME[0] + 14}" y="${HOME[1] + 28}" class="lbl strong">우리 역</text>`;
    g += st(GOAL[0], GOAL[1], 10, pass ? C.main : '#121110');
    g += `<text x="${GOAL[0]}" y="${GOAL[1] + 28}" class="lbl strong" text-anchor="middle">고지대 역</text>`;
    if (f.hospital_pact) g += `<text x="${GOAL[0]}" y="${GOAL[1] + 42}" class="lbl ok" text-anchor="middle">✚ 병원 팀</text>`;
    // 구조열차
    const left = Math.max(0, D.GOAL_DAY - s.day);
    g += `<g transform="translate(${GOAL[0] - 22} ${GOAL[1] - 44})"><rect width="44" height="18" rx="4" fill="#2c3a2c" stroke="${C.main}"/><rect x="5" y="5" width="9" height="7" fill="#f0d9a0"/><rect x="18" y="5" width="9" height="7" fill="#f0d9a0"/><rect x="31" y="5" width="9" height="7" fill="#f0d9a0"/></g>`;
    g += `<text x="352" y="${GOAL[1] - 52}" class="lbl warn" text-anchor="end">열차 D${D.GOAL_DAY} · ${left ? `${left}일 뒤` : '오늘'}</text>`;
    const desc = `노선도: 시장 방면${s.closed && s.closed.A ? ' 막힘' : ''}, 수문 방면${s.closed && s.closed.B ? ' 막힘' : ''}, 고지대 역 통로 ${pass ? '이어짐' : '끊김'}`;
    return `<figure class="scene map"><svg viewBox="0 0 360 224" role="img" aria-label="${esc(desc)}">${g}</svg></figure>`;
  }

  const API = { portrait, stationScene, routeMap, LOOKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DS2_ART = API;
})(this);
