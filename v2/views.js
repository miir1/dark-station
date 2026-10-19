// 어두운 역 v2 — 화면: 상태(state)를 HTML 문자열로 바꾸는 순수 함수들 (DOM을 직접 만지지 않음 → Node에서 스모크 테스트 가능)
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.DS2;
  const D = E.D;
  const A = (typeof module !== 'undefined' && module.exports) ? require('./art.js') : root.DS2_ART;
  // 이름 → 초상화 id (결말 명부는 이름만 들고 있어서)
  const idByName = {};
  for (const [id, p] of Object.entries(D.PEOPLE)) idByName[p.name] = id;
  for (const [id, a] of Object.entries(D.ALLIES)) idByName[a.name] = id;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / b) * 100)));
  const sign = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0');
  const trustDots = (n) => '●'.repeat(n) + '○'.repeat(4 - n);

  function btn(act, label, o) {
    o = o || {};
    const at = ['type="button"', `data-act="${act}"`];
    if (o.arg != null) at.push(`data-arg="${esc(o.arg)}"`);
    if (o.disabled) at.push('disabled');
    if (o.confirm) at.push(`data-confirm="${esc(o.confirm)}"`);
    const cls = ['btn'].concat(o.cls || []).join(' ');
    return `<button ${at.join(' ')} class="${cls}">${esc(label)}${o.sub ? `<small>${o.sub}</small>` : ''}</button>`;
  }
  const lines = (arr) => (arr && arr.length ? `<ul class="fx">${arr.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '');
  const bar = (v, max, cls, ticks) => `<span class="bar ${cls || ''}"><i style="width:${pct(v, max)}%"></i>${(ticks || []).map((x) => `<b class="tick" style="left:${pct(x, max)}%"></b>`).join('')}</span>`;
  const resLine = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${D.RES[k]} ${sign(v)}`).join(' · ');
  const costText = (c) => Object.entries(c).map(([k, v]) => `${D.RES[k]} ${v}`).join('·');
  const repLines = (arr) => arr.map((l) => `<p class="rep ${l.kind}">${esc(l.text)}</p>`).join('');

  // ── 머리말: 날짜·게이지·자원 ──
  function header(s) {
    const day = s.phase === 'prologue' ? '프롤로그' : `D${Math.min(s.day, D.GOAL_DAY)} / ${D.GOAL_DAY}`;
    const lv = (v, warn, bad) => (v >= bad ? 'bad' : v >= warn ? 'warn' : '');
    const gauge = (label, v, cls, warn, bad, ticks) => `<div class="gauge ${cls} ${lv(v, warn, bad)}"><span>${label} <b>${v}</b>/8</span>${bar(v, 8, cls, ticks)}</div>`;
    const need = Math.ceil((1 + E.alive(s).length) * 0.5);
    const res = Object.keys(D.RES).map((k) => {
      const low = k === 'food' || k === 'water' ? s.res[k] < need * 2 : s.res[k] === 0;
      return `<div class="chip ${low ? 'low' : ''}"><span>${D.RES[k]}</span><b>${s.res[k]}</b><small>/${D.CAP[k]}</small></div>`;
    }).join('');
    return `<div class="top"><div class="day">${day}</div>${s.phase === 'prologue' ? '' : gauge('침수', s.flood, 'flood', E.FLOOD_POWER_STOP, 8, [E.FLOOD_POWER_STOP]) + gauge('노출', s.exposure, 'expo', 6, 8, [6])}</div><div class="chips">${res}</div>`;
  }

  // ── 프롤로그 ──
  function prologue(s) {
    const sc = D.PROLOGUE[s.pro];
    if (s.proResult) {
      const r = s.proResult;
      return `<h2 class="ct">${esc(sc.title)}</h2><div class="result"><p class="picked">▸ ${esc(r.choice)}</p>${r.text ? `<p>${esc(r.text)}</p>` : ''}${lines(r.lines)}</div>${btn('proNext', s.pro + 1 >= D.PROLOGUE.length ? '역에서의 첫날을 시작한다' : '계속', { cls: ['primary'] })}`;
    }
    return `${s.pro === 0 ? `<p class="hint tip">${esc(D.WARNING)}</p>` : ''}<h2 class="ct">${esc(sc.title)}</h2><p class="text">${esc(sc.text)}</p><div class="choices">${sc.choices.map((c, i) => btn('proChoose', c.text, { arg: i })).join('')}</div>`;
  }

  // ── 선택지 버튼 (판정 확률 + 비용 + 숨은 위험 + 경고) ──
  function choiceBtn(act, i, c) {
    const bits = [];
    if (c.locked) bits.push('🔒 ' + esc(c.reason));
    else {
      if (c.choice.cost) bits.push(`소모 ${esc(costText(c.choice.cost))}`);
      if (c.chance != null) bits.push(`${esc(D.SKILLS[c.choice.check.skill])} 판정 ${Math.round(c.chance * 100)}%`);
      const tags = E.choiceTags(c.choice);
      if (tags.length) bits.push(`<span class="risk">⚠ ${esc(tags.join(' · '))}</span>`);
      if (c.choice.req && (c.choice.req.item || c.choice.req.trait)) bits.push(`조건 충족: ${esc(c.choice.req.item ? D.ITEMS[c.choice.req.item] + ' 사용' : '특성')}`);
      if (c.warn) bits.push(`<span class="risk bad">⚠ ${esc(c.warn)}</span>`);
      if (c.choice.hint) bits.push(`<span class="risk bad">⚠ ${esc(c.choice.hint)}</span>`);
    }
    return btn(act, c.choice.text, { arg: i, disabled: c.locked, sub: bits.join('<br>'), cls: c.choice.hint ? ['quiet'] : [], confirm: c.choice.hint && !c.locked ? `${c.choice.text}\n\n${c.choice.hint}\n\n정말 선택할까요?` : '' });
  }

  // ── 아침: 역 ──
  function residentRow(s, r, pv) {
    const opts = E.taskOptions(s, r.id);
    const cur = s.plan[r.id] || 'rest';
    const eff = pv.ev.plan[r.id];
    const row = pv.ev.rows.find((x) => x.rid === r.id);
    const forced = eff !== cur;
    const sel = `<select class="sel" data-change="assign" data-rid="${r.id}" aria-label="${esc(r.name)}의 오늘 할 일">${opts.map((o) => `<option value="${o.id}" ${o.id === eff ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.name)}${o.disabled ? ` (${o.reason})` : ''}</option>`).join('')}</select>`;
    let out = '';
    if (row) {
      out = row.out;
      if (row.stress != null && !(row.task === 'rest')) out += ` · 스트레스 ${sign(row.stress)}`;
      if (row.task === 'rest') out = `스트레스 ${sign(row.stress)}${r.injury === 1 ? ' · 경상 회복' : ''}`;
      if (row.infect) out += ` · 곪을 위험 ${Math.round(row.infect * 100)}%`;
    }
    const sit = r.injury >= 3 ? `<div class="rout bad">위독 — 치료받지 못하면 D${r.crit}의 밤에 사망</div>` : r.injury === 2 ? '<div class="rout warn">중상 — 치료하지 않으면 하룻밤 뒤 위독</div>' : '';
    return `<div class="rrow"><div class="rhead">${A.portrait(r.id, r, 32)}<b>${esc(r.name)}</b><span class="mini">${D.PEOPLE[r.id].age}세 · ${esc(D.PEOPLE[r.id].bio)}</span>${badges(r)}</div>
      <div class="rbar"><span class="mini">스트레스 ${r.stress}</span>${bar(r.stress, 100, r.stress >= 70 ? 'hot' : '', [70])}</div>${sel}
      ${sit}<div class="rout ${row && row.bad ? 'bad' : ''}">${esc(out)}${forced ? ' · 몸 상태 때문에 쉼' : ''}</div></div>`;
  }
  function badges(r) {
    const b = [];
    if (r.injury === 1) b.push('<span class="badge">경상</span>');
    if (r.injury === 2) b.push('<span class="badge warn">중상</span>');
    if (r.injury >= 3) b.push('<span class="badge bad">위독</span>');
    if (r.breakdown > 0) b.push(`<span class="badge bad">${r.affl && D.AFFLICTIONS[r.affl] ? esc(D.AFFLICTIONS[r.affl].name) : '탈진'}</span>`);
    if (r.virtue) b.push(`<span class="badge good">${esc(D.VIRTUE.name)}</span>`);
    for (const id of r.scars || []) b.push(`<span class="badge warn">${esc(D.SCARS[id].name)}</span>`);
    return b.join('');
  }
  function goalCard(s) {
    const tr = E.trainInfo(s);
    const left = D.GOAL_DAY - s.day;
    const repairing = s.project && s.project.id === 'repair';
    const builders = Object.values(s.plan).filter((t) => t === 'build').length;
    const path = s.flags.passage_secured ? '개통 ✓' : repairing ? `작업 ${s.project.progress}/${D.PROJECTS.repair.work}${builders ? '' : ' — 아래 배치에서 공사 작업에 사람을 넣으세요'}` : s.flags.repair_open ? (s.project ? `착공 대기 — 지금 공사(${D.PROJECTS[s.project.id].name})가 끝나야 착공할 수 있어요` : '착공 가능 — 아래 [공사 시작]에서 통로 수리를 착공하세요') : s.flags.met_dohyeon ? '도현의 열쇠를 기다린다' : s.flags.skipped_dohyeon ? '아직 닫혀 있다' : '침수 통로에서 도울 사람을 찾는다 (수문 방면)';
    const pact = s.flags.hospital_pact ? '맺었다 ✓' : s.flags.pact_refused ? '거절했다 ✗' : s.flags.met_eunchae ? '은채의 소식을 기다린다' : s.flags.skipped_eunchae ? '놓쳤다 ✗' : '약국에서 도울 사람을 찾는다 (시장 방면)';
    const cap = tr.passage ? `지금 열차가 오면 ${tr.cap}명 (식량·물 ${E.BOARD_PER}개씩 ${tr.base}명${tr.hospital ? ` + 병원 ${tr.hospital}` : ''}${tr.litter ? ` + 들것 ${tr.litter}` : ''})` : '통로가 이어져야 열차가 닿는다';
    return `<section class="card goal"><h3>목표 — D${D.GOAL_DAY} 구조열차${left > 0 ? ` (${left}일 남음)` : ' (오늘!)'}</h3>
      <p><b>통로</b> ${esc(path)}</p><p><b>병원 협정</b> ${esc(pact)}</p><p><b>승차</b> ${esc(cap)}</p>
      <p class="hint">부품 ${E.BOARD_LITTER}개마다 들것 한 벌(좌석 +1, 최대 ${E.BOARD_LITTER_MAX}). 한 사람당 식량·물이 ${E.BOARD_PER}개씩 필요해요.</p></section>`;
  }
  // 하루 종료 버튼 바로 위: 이 배치로 밤을 보내면 어떻게 되는지 (가장 급한 경고 하나 + 핵심 숫자)
  function endPreview(s, pv) {
    const arrow = (a, b, cls) => `<b class="${cls || ''}">${a}→${b}</b>`;
    const low = (k) => (pv.res[k] < Math.ceil((1 + E.alive(s).length) * 0.5) * 2 ? 'warn' : '');
    const nums = `식량 ${arrow(s.res.food, pv.res.food, low('food'))} · 물 ${arrow(s.res.water, pv.res.water, low('water'))} · 침수 ${arrow(s.flood, pv.flood, pv.flood >= E.FLOOD_POWER_STOP ? 'warn' : '')} · 노출 ${arrow(s.exposure, pv.exposure, pv.exposure >= 6 ? 'warn' : '')}`;
    const warn = [];
    if (pv.deaths.length) warn.push(`${pv.deaths.join('·')} 오늘 밤 사망`);
    if (s.project && !Object.values(pv.ev.plan).includes('build')) warn.push(`${s.project.id === 'repair' ? '통로' : '공사'} 작업자 미배치`);
    const other = pv.warnings.filter((w) => !/사망/.test(w.text) && w.kind !== 'good');
    if (other.length) warn.push(other[0].text);
    const good = pv.warnings.filter((w) => w.kind === 'good');
    return `<p class="endpv">${nums}${warn.length ? `<br><span class="w">⚠ ${esc(warn.slice(0, 2).join(' · '))}</span>` : ''}${good.length ? `<br><span class="g">✓ ${esc(good[0].text)}</span>` : ''}</p>`;
  }
  function stationTab(s) {
    const pv = E.previewNight(s);
    const fc = E.forecast(s);
    let h = '';
    const hurt = E.alive(s).filter((r) => r.injury >= 2);
    h += A.stationScene(s, pv.ev.plan, { lit: pv.ev.made > 0 });
    if (hurt.length) h += `<section class="card alert"><h3>치료가 필요하다</h3>${hurt.map((r) => `<p class="rep ${r.injury >= 3 ? 'bad' : 'warn'}">${esc(r.name)} — ${r.injury >= 3 ? `위독: D${r.crit}의 밤까지 치료하지 못하면 사망` : '중상: 치료하지 않으면 하룻밤 뒤 위독'} (치료 담당 + 약품 1${s.res.meds < 1 ? ' — 지금 약품이 없다! 약국(시장 방면)이나 밤 사건으로만 구할 수 있다' : ''})</p>`).join('')}</section>`;
    h += goalCard(s);
    if (s.day === 1 && s.phase === 'morning' && !s.expDone) h += '<p class="hint tip">① 오늘의 배치를 확인하고 ② (선택) 지도 탭에서 원정을 보낸 뒤 ③ 아래 [하루를 보낸다]를 누르세요. 원정을 보내면 그 두 사람의 배치는 비니까 원정 후 [추천 배치]로 다시 짜세요.</p>';
    if (fc.length) h += `<section class="card"><h3>예보와 약속</h3>${repLines(fc)}</section>`;
    // 공사
    if (s.project) {
      const P = D.PROJECTS[s.project.id];
      h += `<section class="card"><h3>공사: ${esc(P.name)}</h3><p>${bar(s.project.progress, P.work)} ${s.project.progress}/${P.work} — 공사 작업을 맡은 사람이 하루 +1 (손재주 +1)</p></section>`;
    } else {
      const av = E.availableProjects(s);
      const after = (p) => { const left = s.res.parts - (p.cost.parts || 0); if (!p.cost.parts) return '부품은 그대로'; if (left < 0) return `부품 ${-left}개 모자람`; const seats = (n) => Math.min(E.BOARD_LITTER_MAX, Math.floor(Math.max(0, n) / E.BOARD_LITTER)); const sd = seats(left) - seats(s.res.parts); return `착공 후 부품 ${s.res.parts}→${left}${sd ? ` (들것 좌석 ${sign(sd)})` : ''}`; };
      const costWord = (p) => (p.cost.parts ? `부품 ${p.cost.parts}개` : '추가 재료비 없음');
      if (av.length) h += `<section class="card"><h3>공사 시작</h3><p class="hint">부품을 먼저 내고, 공사 작업을 맡은 사람이 일해야 완성돼요. 생활 시설은 하나만 지을 수 있어요. ${s.flags.repair_open ? '' : '통로 수리용 부품 3~5개는 따로 남겨 두세요.'}</p>${av.map((p) => btn('startProject', p.name, { arg: p.id, disabled: !p.afford, confirm: p.cost.parts ? `${p.name}: 부품 ${p.cost.parts}개를 내고 착공합니다. 되돌릴 수 없어요.` : `${p.name}: 추가 재료비 없이 착공합니다.`, sub: `${esc(costWord(p))} · 공사 작업 ${p.work}회분 · ${esc(p.desc)}<br>${esc(after(p))}` })).join('')}</section>`;
      if (s.facility) h += `<p class="hint">시설: ${esc(D.PROJECTS[s.facility].name)} — ${esc(D.PROJECTS[s.facility].desc)}</p>`;
    }
    // 배치
    const home = E.homeRes(s).filter((r) => !s.expParty.includes(r.id));
    h += `<section class="card"><h3>오늘의 배치</h3><p class="hint">근처에서 구할 수 있는 식량 ${s.forage} · 비상 해체로 뜯어낼 부품 ${s.salvageLeft}개 남음</p><div class="row2">${btn('suggest', '추천 배치')}${btn('repeat', '어제와 같이', { disabled: !Object.keys(s.lastPlan).length })}</div><p class="hint">추천 기준: ${esc(E.suggestWhy(s) || '모두 휴식')}</p>`;
    h += home.map((r) => residentRow(s, r, pv)).join('');
    if (s.expParty.length) h += `<p class="hint">원정에 다녀온 ${s.expParty.map((id) => esc(E.byId(s, id).name)).join('·')}은(는) 오늘 쉰다.</p>`;
    h += '</section>';
    // 예상
    const ev = pv.ev;
    const made = resLine({ food: ev.d.food, water: ev.d.water, parts: ev.d.parts });
    h += `<section class="card sum"><h3>내일 아침 예상</h3>${repLines(pv.warnings)}
      <p>생산 ${esc(made || '없음')}${ev.d.meds ? ` · 약품 ${sign(ev.d.meds)}` : ''}</p>
      <p>소모 식량 −${ev.consume.food} · 물 −${ev.consume.water} (주민 ${ev.people - 1}명 + 나)</p>
      <p>전력 ${ev.made}${ev.need ? ` (필요 ${ev.need})` : ''} · 침수 ${s.flood}→${pv.flood} · 노출 ${s.exposure}→${pv.exposure}</p>
      <p>창고 식량 ${s.res.food}→${pv.res.food} · 물 ${s.res.water}→${pv.res.water} · 부품 ${s.res.parts}→${pv.res.parts} · 약품 ${s.res.meds}→${pv.res.meds}</p>
      ${ev.notes.map((n) => `<p class="rep warn">${esc(n)}</p>`).join('')}
      <p class="hint">침수 ${E.FLOOD_POWER_STOP} 이상: 발전기 정지 · 침수 8: 수위 경보 · 노출 6 이상: 순찰대. 밤 사건의 결과는 제외한 예상이에요.</p></section>`;
    if (s.report.length) h += `<details class="card"><summary>지난 밤 기록</summary>${repLines(s.report)}</details>`;
    // 하루를 보낸다 (되돌릴 수 없는 위험이 있으면 확인)
    const allRest = home.every((r) => (pv.ev.plan[r.id] || 'rest') === 'rest') && home.length > 0;
    let confirm = '';
    if (pv.deaths.length) confirm = `${pv.deaths.map((n) => E.J(n, '이/가')).join(', ')} 오늘 밤 사망합니다. 그래도 하루를 보낼까요?`;
    else if (allRest && !s.expParty.length) confirm = '모두 휴식이라 아무것도 생산하지 않아요. 그대로 하루를 보낼까요?';
    h += `<div class="endbar">${endPreview(s, pv)}${btn('endDay', '하루를 보낸다 (저녁으로)', { cls: ['primary'], confirm })}</div>`;
    return h;
  }

  // ── 아침: 지도 ──
  function mapTab(s, ui) {
    let h = A.routeMap(s, ui.prep && ui.prep.region);
    h += `<section class="card"><h3>지상</h3><p class="hint">하루 한 번, 두 사람이 나가요. 보급(식량·물)은 가방 칸을 차지하고, 시간이 8시간을 넘기면 강행이에요(1시간마다 둘 다 스트레스 +10).</p>`;
    if (s.expDone) h += '<p class="rep warn">오늘은 이미 원정을 다녀왔다.</p>';
    for (const k of ['A', 'B']) {
      const R = D.REGIONS[k];
      const closed = s.closed[k] > 0;
      const chain = k === 'A' ? s.flags.met_eunchae : s.flags.met_dohyeon;
      const on = ui.prep && ui.prep.region === k;
      h += `<div class="region ${on ? 'on' : ''}"><div><b>${esc(R.name)}</b> <span class="mini">${esc(R.sub)} · 깊이 ${R.maxDepth}</span>${closed ? `<span class="badge bad">길 막힘 ${s.closed[k]}일</span>` : ''}${chain ? '<span class="badge good">연락 닿음</span>' : ''}</div><p class="mini">${esc(R.intro)}</p>${btn('prepRegion', on ? '선택됨' : '여기로 간다', { arg: k, disabled: closed || s.expDone })}</div>`;
    }
    h += '</section>';
    if (ui.prep && ui.prep.region && D.REGIONS[ui.prep.region] && !s.expDone) h += prepPanel(s, ui);
    return h;
  }
  function prepPanel(s, ui) {
    const p = ui.prep;
    const home = E.homeRes(s);
    let h = `<section class="card" id="prep"><h3>${esc(D.REGIONS[p.region].name)} 준비</h3><p class="hint">동행 2명을 고르세요 (${p.party.length}/2). 세 번째를 누르면 가장 먼저 고른 사람이 빠져요.</p>`;
    h += home.map((r) => {
      const why = r.injury >= 2 ? '중상' : r.stress >= E.STRESS_LIMIT_EXP ? `스트레스 ${r.stress}` : r.breakdown > 0 ? '탈진' : E.noExp(r) ? '다리를 전다' : '';
      const on = p.party.includes(r.id);
      const task = s.plan[r.id] && s.plan[r.id] !== 'rest' ? D.TASKS[s.plan[r.id]].name : '';
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-act="togglePartner" data-arg="${r.id}" aria-pressed="${on}" ${why ? 'disabled' : ''}>${A.portrait(r.id, r, 36)}<b>${on ? '✓ ' : ''}${esc(r.name)}</b><span class="mini">관찰 ${r.skills.obs} 완력 ${r.skills.str} 기술 ${r.skills.tech} 말솜씨 ${r.skills.talk}</span><span class="mini">${esc(D.TRAITS[r.good].name)}·${esc(D.TRAITS[r.bad].name)} / 스트레스 ${r.stress}${task ? ` / 지금 배치: ${esc(task)}` : ''}${why ? ' — 갈 수 없음: ' + esc(why) : ''}</span></button>`;
    }).join('');
    const step = (k, label) => `<div class="step"><span>${label}</span><span><button type="button" class="sb" data-act="pack" data-arg="${k}:-1" aria-label="${label} 줄이기">−</button><b>${p.pack[k]}</b><button type="button" class="sb" data-act="pack" data-arg="${k}:1" aria-label="${label} 늘리기">+</button></span><small>창고 ${s.res[k]}</small></div>`;
    h += `<h4>보급 (가방 칸을 차지해요)</h4>${step('food', '식량')}${step('water', '물')}${step('meds', '약품')}`;
    const owned = Object.keys(D.ITEMS).filter((i) => s.items[i]);
    if (owned.length) h += `<div class="step"><span>도구</span><span>${owned.map((i) => `<button type="button" class="tog ${p.pack.items.includes(i) ? 'on' : ''}" data-act="packItem" data-arg="${i}" aria-pressed="${p.pack.items.includes(i)}">${p.pack.items.includes(i) ? '✓ ' : ''}${esc(D.ITEMS[i])}</button>`).join('')}</span><small>칸 1개씩</small></div>`;
    const people = p.party.map((id) => E.byId(s, id));
    const cap = E.BASE_LOAD + people.reduce((a, r) => a + E.traitVal(r, 'expLoad'), 0) - (p.pack.food + p.pack.water + p.pack.meds + p.pack.items.length);
    h += `<p class="hint">전리품 자리 ${cap}칸. 두 사람이 4시간마다 식량·물을 1개씩 써요: 2개씩이면 4시간, 4개씩이면 8시간, 6개씩이면 12시간. 모자라면 굶으며 돌아와 스트레스가 올라요. 첫 사건까지는 4시간이에요(왕복 2 + 사건 2).</p>`;
    if (people.length) { const leaving = people.map((r) => { const t = s.plan[r.id]; return t && t !== 'rest' ? `${r.name}(${D.TASKS[t].name})` : null; }).filter(Boolean); if (leaving.length) h += `<p class="rep warn">이 둘이 빠지면 ${esc(leaving.join(', '))} 일이 비어요. 돌아오면 [추천 배치]로 다시 짜세요.</p>`; }
    const why = E.canDepart(s, p.region, p.party, p.pack);
    if (why && p.party.length === 2) h += `<p class="rep warn">${esc(why)}</p>`;
    h += btn('depart', '출발', { cls: ['primary'], disabled: !!why });
    return h + '</section>';
  }

  // ── 사람 ──
  function peopleTab(s) {
    let h = '';
    for (const r of s.residents) {
      const P = D.PEOPLE[r.id];
      const st = r.status === 'dead' ? '<span class="badge bad">사망</span>' : r.status === 'exp' ? '<span class="badge">원정 중</span>' : badges(r);
      h += `<section class="card person ${r.status === 'dead' ? 'dead' : ''}"><div class="rhead">${A.portrait(r.id, r, 48)}<b>${esc(r.name)}</b><span class="mini">${P.age}세 · ${esc(P.bio)}</span>${st}</div>
        <div class="rbar"><span class="mini">스트레스 ${r.stress}</span>${bar(r.stress, 100, r.stress >= 70 ? 'hot' : '', [70])}</div>
        <p class="mini">관찰 ${r.skills.obs} · 완력 ${r.skills.str} · 기술 ${r.skills.tech} · 말솜씨 ${r.skills.talk}</p>
        <p class="mini">장점 <b>${esc(D.TRAITS[r.good].name)}</b> ${esc(D.TRAITS[r.good].desc)}<br>단점 <b>${esc(D.TRAITS[r.bad].name)}</b> ${esc(D.TRAITS[r.bad].desc)}</p>
        ${(r.scars || []).length ? `<p class="mini">상처 ${r.scars.map((id) => `<b>${esc(D.SCARS[id].name)}</b> ${esc(D.SCARS[id].desc)}`).join(' · ')}</p>` : ''}
        ${r.breakdown > 0 && r.affl ? `<p class="mini">붕괴 <b>${esc(D.AFFLICTIONS[r.affl].name)}</b> ${esc(D.AFFLICTIONS[r.affl].desc)} — ${r.breakdown}일 더 일 못 함</p>` : ''}
        ${r.virtue ? `<p class="mini">각성 <b>${esc(D.VIRTUE.name)}</b> ${esc(D.VIRTUE.desc)}</p>` : ''}
        <p class="mini">신뢰 ${trustDots(r.trust)} · 바람: ${esc(P.wish)}</p>
        ${r.mem.length ? `<p class="mem">${r.mem.slice(-3).reverse().map((m) => `D${m.day} ${esc(m.text)}`).join('<br>')}</p>` : ''}</section>`;
    }
    for (const [id, a] of Object.entries(D.ALLIES)) if (s.allies[id]) h += `<section class="card person"><div class="rhead">${A.portrait(id, {}, 48)}<b>${esc(a.name)}</b><span class="mini">${esc(a.bio)}</span><span class="badge good">열차에 함께 간다</span></div></section>`;
    const hist = s.history.slice(-14).reverse();
    if (hist.length) h += `<section class="card"><h3>일지</h3>${hist.map((x) => `<p class="mini">${x.day ? 'D' + x.day : '프롤로그'} · ${esc(x.text)}</p>`).join('')}</section>`;
    return h;
  }

  // ── 원정 ──
  function expedition(s) {
    const v = E.expView(s);
    const R = D.REGIONS[v.region];
    const over = Math.max(0, v.hours - v.normal);
    const evNo = v.steps + (v.phase === 'event' ? 1 : 0);
    let h = `<div class="expbar"><b>${esc(R.name)}</b> · 깊이 ${v.depth} · ${evNo}번째 사건 <div class="hours ${over ? 'over' : ''}">예상 귀환 ${v.hours}시간${over ? ` (강행 +${over})` : ''}</div>${bar(Math.min(v.hours, v.max), v.max, over ? 'hot' : '', [v.normal])}<p class="mini">기본 ${v.normal}시간 · 최대 ${v.max}시간 · 넘기면 시간당 둘 다 스트레스 +10</p></div>`;
    h += `<p class="mini">동행: ${v.party.map((r) => `${esc(r.name)}(스트레스 ${r.stress}${r.injury ? ' · ' + (r.injury >= 3 ? '위독' : r.injury === 2 ? '중상' : '경상') : ''})`).join(', ')}</p>`;
    const short = v.have.food < v.need.food || v.have.water < v.need.water;
    h += `<p class="mini">전리품 ${v.used}/${v.cap}칸: ${esc(resLine(v.loot) || '없음')}<br>보급 식량 ${v.have.food}/${v.need.food} · 물 ${v.have.water}/${v.need.water}${v.pack.meds ? ' · 약품 ' + v.pack.meds : ''}${v.pack.items.length ? ' · ' + esc(v.pack.items.map((i) => D.ITEMS[i]).join('·')) : ''}</p>`;
    if (short) h += '<p class="rep warn">보급이 모자란다 (가진 것/필요한 것). 이대로 돌아가면 굶주려 스트레스가 오른다.</p>';
    if (v.phase === 'event') {
      h += `<h2 class="ct">${esc(v.event.title)}</h2><p class="text">${esc(v.event.text)}</p><div class="choices">`;
      v.choices.forEach((c, i) => { h += choiceBtn('expChoose', i, c); });
      return h + '</div>';
    }
    const r = v.result;
    h += `<div class="result" aria-live="polite"><p class="picked">▸ ${esc(r.choice)}</p>${r.roll ? `<p class="roll ${r.roll.success ? 'ok' : 'no'}">판정 ${Math.round(r.roll.chance * 100)}% — ${r.roll.success ? '성공' : '실패'}</p>` : ''}${r.text ? `<p>${esc(r.text)}</p>` : ''}${lines(r.lines)}</div>`;
    const o = v.options;
    const needFor = (hrs) => v.party.length * Math.ceil(hrs / 4);
    const sub = (x) => `총 ${x.hours}시간${x.over ? ` · 강행(스트레스 +${(x.hours - v.normal) * 10})` : ''} · 필요 식량·물 ${needFor(x.hours)}씩`;
    h += '<div class="choices">';
    if (v.force) h += '<p class="rep bad">위독한 동료가 있다. 지금 돌아가야 한다.</p>';
    h += btn('expNext', '이 구역을 더 살핀다', { arg: 'more', disabled: !o.more.ok, sub: esc(sub(o.more)) });
    h += btn('expNext', '더 깊이 내려간다', { arg: 'deeper', disabled: !o.deeper.ok, sub: esc(sub(o.deeper)) });
    h += btn('expNext', '여기서 돌아간다', { arg: 'return', cls: ['primary'], sub: esc(`귀환 ${o.back.hours}시간${o.back.over ? ` · 강행(스트레스 +${(o.back.hours - v.normal) * 10})` : ''} · 둘 다 스트레스 +12`) });
    return h + '</div>';
  }

  // ── 저녁 ──
  function evening(s) {
    const v = E.eveningView(s);
    if (v.type === 'promise') return `<p class="tag">저녁 · 약속</p><h2 class="ct">${esc(v.title)}</h2><p class="text">${esc(v.text)}</p><div class="choices">${v.choices.map((c, i) => choiceBtn('eveningChoose', i, c)).join('')}</div><p class="hint">약속은 건너뛸 수 없어요.</p>`;
    if (v.type === 'promiseResult') return `<p class="tag">저녁 · 약속</p><div class="result" aria-live="polite"><p class="picked">▸ ${esc(v.result.choice)}</p>${v.result.text ? `<p>${esc(v.result.text)}</p>` : ''}${lines(v.result.lines)}</div>${btn('eveningDone', '계속', { cls: ['primary'] })}`;
    if (v.type === 'talkResult') {
      const r = E.byId(s, v.rid);
      return `<p class="tag">저녁 · 화로 앞</p><div class="result" aria-live="polite"><p class="picked">▸ ${esc(r.name)}와 이야기했다</p><p>${esc(v.line)}</p>${lines([`스트레스 −${v.delta}`, '신뢰 +1'].concat(v.extra ? [v.extra.trim()] : []))}</div>${btn('eveningDone', '밤이 된다', { cls: ['primary'] })}`;
    }
    const home = E.homeRes(s).filter((r) => !s.expParty.includes(r.id));
    const away = s.expParty.map((id) => E.byId(s, id).name);
    return `<p class="tag">저녁 · 화로 앞</p><h2 class="ct">누구와 이야기할까</h2><p class="text">화로 앞에서 한 사람과 이야기하면 스트레스가 줄고 신뢰가 쌓여요. 세 번 이야기하면 그 사람의 사연과 함께 기술이 하나 올라요. 안 해도 괜찮아요.</p><div class="choices">${home.map((r) => btn('talk', r.name, { arg: r.id, sub: esc(`스트레스 ${r.stress} → −${Math.max(0, 8 - E.traitVal(r, 'talkEase'))} · 신뢰 ${trustDots(r.trust)}${r.talks === 2 ? ' · 이번이 세 번째: 기술 +1' : ''}`) })).join('')}${btn('skipTalk', '이야기하지 않고 밤으로', { cls: ['quiet'] })}</div>${away.length ? `<p class="hint">원정에서 돌아와 쉬는 중: ${esc(away.join('·'))}</p>` : ''}`;
  }
  // ── 밤 사건 ──
  function night(s) {
    const v = E.nightView(s);
    const dead = s.report.filter((l) => l.kind === 'bad' && /숨을 거뒀다/.test(l.text));
    let h = `<p class="tag">밤</p>${dead.map((l) => `<section class="card alert"><h3>${esc(l.text)}</h3></section>`).join('')}<section class="card">${repLines(s.report.filter((l) => !dead.includes(l)))}</section><h2 class="ct">${esc(v.title)}</h2><p class="text">${esc(v.text)}</p>`;
    if (!v.result) return h + `<div class="choices">${v.choices.map((c, i) => choiceBtn('nightChoose', i, c)).join('')}</div>`;
    const r = v.result;
    return h + `<div class="result" aria-live="polite"><p class="picked">▸ ${esc(r.choice)}</p>${r.roll ? `<p class="roll ${r.roll.success ? 'ok' : 'no'}">판정 ${Math.round(r.roll.chance * 100)}% — ${r.roll.success ? '성공' : '실패'}</p>` : ''}${r.text ? `<p>${esc(r.text)}</p>` : ''}${lines(r.lines)}</div>${btn('nightDone', s.nightEv.id === 'flood_break' && s.visitDay === s.day ? '또 한 가지 일이 생겼다' : s.day >= D.GOAL_DAY ? '아침이 밝았다 — 열차 시간' : '다음 날 아침', { cls: ['primary'] })}`;
  }
  // ── 승차 ──
  function boarding(s) {
    const b = s.boarding;
    const tr = E.trainInfo(s);
    let h = `<p class="tag">D${D.GOAL_DAY} · 열차 시간</p><h2 class="ct">구조열차가 들어온다</h2>`;
    if (b.cap === 0) return h + `<p class="text">${b.passage ? '통로는 이어졌지만 식량과 물이 모자란다. 한 사람도 태울 수 없다.' : '끊긴 통로 앞에서 열차가 속도를 줄이지 못한다. 선로 끝까지 길이 이어지지 않았다.'}</p>${btn('confirmBoarding', '열차를 지켜본다', { cls: ['primary'] })}`;
    h += `<p class="text">보급이 허락하는 만큼만 태울 수 있다. ${s.flags.hospital_pact ? '고지대 역에는 병원 팀이 기다린다.' : '고지대 역에서 어디에 머물지는 정해지지 않았다.'}</p>
      <p class="mini">정원 ${b.cap}명 = 식량·물 ${E.BOARD_PER}개씩 ${tr.base}명${tr.hospital ? ` + 병원 보급 ${tr.hospital}` : ''}${tr.litter ? ` + 들것 ${tr.litter}` : ''} (태울 대상 ${b.pool.length}명)</p>`;
    const full = b.picks.length >= b.cap;
    h += `<p class="${full ? 'rep warn' : 'mini'}" aria-live="polite">${full ? `정원 ${b.cap}명이 찼어요. 다른 사람을 태우려면 먼저 한 명을 빼 주세요.` : `선택 ${b.picks.length}/${b.cap}`}</p><div class="choices">`;
    h += b.pool.map((p) => {
      const on = b.picks.includes(p.id);
      const r = p.kind === 'resident' ? E.byId(s, p.id) : null;
      const info = r ? `${esc(D.PEOPLE[p.id].bio)} · 신뢰 ${trustDots(r.trust)} · 스트레스 ${r.stress}${r.injury ? ' · ' + (r.injury >= 3 ? '위독' : r.injury === 2 ? '중상' : '경상') : ''}<br>${esc(r.mem.filter((m) => m.key).slice(-1)[0] ? r.mem.filter((m) => m.key).slice(-1)[0].text : '바람: ' + D.PEOPLE[p.id].wish)}` : '약속을 지켜 준 사람';
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-act="board" data-arg="${p.id}" aria-pressed="${on}" ${!on && full ? 'disabled' : ''}>${A.portrait(p.id, r || {}, 40)}<b>${on ? '✓ ' : ''}${esc(p.name)}</b><span class="mini">${info}</span></button>`;
    }).join('');
    const left = b.pool.filter((p) => !b.picks.includes(p.id)).map((p) => p.name);
    return h + `</div>${btn('confirmBoarding', '이 사람들을 태운다', { cls: ['primary'], disabled: b.picks.length === 0, confirm: `${b.picks.length}명을 태웁니다.${left.length ? ` 남는 사람: ${left.join(', ')}.` : ''} 확정할까요?` })}`;
  }
  // ── 결말 ──
  function ended(s) {
    const e = s.ending;
    const mark = { boarded: '승차', stayed: '남음', dead: '사망' };
    const kind = { kept: '지킨 약속', broken: '버린 약속', late: '못 지킨 약속' };
    return `<p class="tag">${e.tier === 'wiped' ? '끝' : 'D' + D.GOAL_DAY + ' · 첫 번째 열차'}</p><h2 class="ct end">${esc(e.title)}</h2><p class="text">${esc(e.text)}</p><section class="card"><h3>명부</h3>${e.rows.map((r) => `<p class="roster ${r.status}">${A.portrait(idByName[r.name], { status: r.status === 'dead' ? 'dead' : '' }, 28)}<b>${esc(r.name)}</b> <span class="badge ${r.status === 'boarded' ? 'good' : r.status === 'dead' ? 'bad' : ''}">${mark[r.status]}</span><span class="mini"> ${esc(r.line)}</span></p>`).join('')}</section>
      ${e.ledger && e.ledger.length ? `<section class="card"><h3>약속</h3>${e.ledger.map((l) => `<p class="rep ${l.kind === 'kept' ? 'good' : l.kind === 'broken' ? 'bad' : 'warn'}">${kind[l.kind]} — ${esc(l.text)}</p>`).join('')}</section>` : ''}
      <p class="hint">전체 게임은 30일이에요. 이번 시연은 첫 열차까지예요. 아래 [플레이 기록 복사]를 눌러 채팅에 붙여 넣어 주시면 어디가 재미있고 어디가 답답했는지 고칠 수 있어요.</p>${btn('copyLog', '플레이 기록 복사')}${btn('restart', '처음부터 다시', { cls: ['primary'] })}`;
  }

  const NAV = [['station', '역'], ['map', '지도'], ['people', '사람']];
  function render(s, ui) {
    ui = ui || { tab: 'station', prep: null };
    let body, nav = '';
    switch (s.phase) {
      case 'prologue': body = prologue(s); break;
      case 'morning': {
        body = ui.tab === 'map' ? mapTab(s, ui) : ui.tab === 'people' ? peopleTab(s) : stationTab(s);
        nav = NAV.map(([id, name]) => `<button type="button" data-act="tab" data-arg="${id}" class="${ui.tab === id ? 'on' : ''}" ${ui.tab === id ? 'aria-current="page"' : ''}>${name}</button>`).join('');
        break;
      }
      case 'expedition': body = expedition(s); break;
      case 'evening': body = evening(s); break;
      case 'nightEvent': body = night(s); break;
      case 'boarding': body = boarding(s); break;
      case 'ended': body = ended(s); break;
      default: body = '<p>알 수 없는 상태</p>';
    }
    return { header: header(s), body, nav, title: s.phase === 'morning' ? `어두운 역 D${s.day}` : '어두운 역' };
  }

  const API = { render, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DS2_VIEWS = API;
})(this);
