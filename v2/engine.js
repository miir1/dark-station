// 어두운 역 v2 — 규칙 엔진 (화면과 분리, Node 테스트·봇 가능). 모든 조작은 dispatch(state, action) 하나로.
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DS2_DATA;

  const SAVE_V = 2;
  const MAX_LOG = 60;
  const STRESS_LIMIT_EXP = 70;       // 이 이상이면 원정 불가
  const MAX_HOURS = 10;              // 강행 한계
  const NORMAL_HOURS = 8;            // 기본 활동 시간
  const BASE_LOAD = 14;              // 가방 칸
  const FLOOD_POWER_STOP = 5;        // 침수 5 이상이면 발전기가 잠긴다
  const BOARD_PER = 2;               // 승차 1명당 식량·물 각각 2
  const BOARD_LITTER = 4;            // 부품 4개로 들것·침낭 한 벌 = 좌석 1개 (최대 2개)
  const BOARD_LITTER_MAX = 2;
  const INFECT = 0.3;                // 경상으로 일하면 밤마다 곪을 확률
  const EDGE = 80;                   // 스트레스 80부터는 밤마다 무너질 수 있다 (80: 20% … 95: 80%, 100: 반드시)

  // ── 난수 (상태에 저장 → 새로고침해도 같은 결과) ──
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sf = (v) => 0.75 + 0.25 * v;                    // 기술 계수: 0→0.75 … 3→1.5
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  // 한국어 조사: J('윤서하','이/가') → '윤서하가'
  function josa(name, pair) {
    const [a, b] = pair.split('/');
    const str = String(name);
    const ch = str.charCodeAt(str.length - 1);
    const has = ch >= 0xAC00 && ch <= 0xD7A3 && ((ch - 0xAC00) % 28) !== 0;
    return has ? a : b;
  }
  const J = (name, pair) => name + josa(name, pair);

  // ── 상태 ──
  function makeResident(id) {
    const p = D.PEOPLE[id];
    return { id, name: p.name, good: p.good, bad: p.bad, skills: Object.assign({}, p.skills),
      stress: 20, injury: 0, crit: null, trust: 0, talks: 0, hunger: 0, thirst: 0, breakdown: 0, status: 'home', mem: [],
      scars: [], affl: null, virtue: false };
  }
  function newGame(seed) {
    seed = (seed == null ? 1 : seed) >>> 0;
    const s = {
      v: SAVE_V, seed, rng: seed, day: 1, phase: 'prologue', pro: 0,
      res: { food: 6, water: 6, parts: 4, meds: 1 }, flood: 0, exposure: 0, forage: 52, salvageLeft: 6,
      residents: D.START_PEOPLE.map(makeResident), allies: {}, flags: {}, items: {},
      facility: null, project: null, plan: {}, lastPlan: {}, expParty: [], expDone: false,
      closed: { A: 0, B: 0 }, promises: [], visitDay: D.CALENDAR.patrol.day,
      exp: null, evening: null, nightEv: null, lastNight: null, report: [], log: [], history: [],
      boarding: null, ending: null, stats: { deaths: 0, expeditions: 0, nights: 0 }, corpses: [], dark: false,
      gods: Object.fromEntries(Object.keys(D.GODS).map((k) => [k, 0])), godSeen: {}, godQueue: [], buried: [], litStreak: 0, litNights: 0, seatMod: 0,
      possessed: null, flame: null, noDarkUntil: 0, nightPlan: {}, storyDone: {},
    };
    return s;
  }

  // ── 조회 도우미 ──
  const alive = (s) => s.residents.filter((r) => r.status !== 'dead');
  const homeRes = (s) => s.residents.filter((r) => r.status === 'home');
  const byId = (s, id) => s.residents.find((r) => r.id === id);
  function traitVal(r, key) {
    let v = 0;
    for (const t of [r.good, r.bad]) { const m = D.TRAITS[t]; if (m && typeof m[key] === 'number') v += m[key]; }
    for (const id of r.scars || []) { const m = D.SCARS[id]; if (m && typeof m[key] === 'number') v += m[key]; }
    if (r.virtue && typeof D.VIRTUE[key] === 'number' && key !== 'chance') v += D.VIRTUE[key];
    return v;
  }
  const noExp = (r) => (r.scars || []).some((id) => D.SCARS[id] && D.SCARS[id].noExp);
  const hasTag = (r, tag) => [r.good, r.bad].some((t) => D.TRAITS[t] && D.TRAITS[t].tag === tag);
  const resText = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${D.RES[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ');

  function say(s, text, kind) {
    if (!text) return;
    s.report.push({ text, kind: kind || '' });
    s.log.unshift({ day: s.day, text, kind: kind || '' });
    if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
  }
  function memo(r, day, text, key) {
    if (!r || !text) return;
    r.mem.push({ day, text, key: !!key });
    if (r.mem.length > 8) r.mem.shift();
  }
  // 문장의 {who}/{who2} 자리에 이름을 넣는다. {who:이/가} 처럼 조사도 맞춘다.
  function fillText(str, names) {
    return String(str).replace(/\{(who2?)(?::([^}]+))?\}/g, (m, k, pair) => {
      const n = k === 'who' ? names[0] : (names[1] || names[0]);
      return pair ? n + josa(n, pair) : n;
    });
  }
  function addRes(s, k, v) { s.res[k] = clamp(s.res[k] + v, 0, D.CAP[k]); }

  // 부상. 중상(2)·위독(3)에 처음 닿을 때 영구 상처를 굴린다. 상처가 남으면 그 문장을 돌려준다.
  function injure(s, r, n) {
    if (!r || r.status === 'dead') return '';
    const before = r.injury;
    r.injury = Math.min(3, r.injury + n);
    if (r.injury >= 3 && r.crit == null) r.crit = s.day + 1;
    for (const lv of [2, 3]) if (before < lv && r.injury >= lv) { const t = rollScar(s, r, lv); if (t) return t; }
    return '';
  }
  function rollScar(s, r, lv) {
    if (!r.scars) r.scars = [];
    if (r.scars.length >= 2 || rand(s) >= D.SCAR_CHANCE[lv]) return '';
    return applyScar(s, r, pick(s, Object.keys(D.SCARS).filter((k) => !r.scars.includes(k))));
  }
  // 원하는 상처를 남긴다 (이미 있으면 다른 것, 2개가 차 있으면 아무것도)
  function forceScar(s, r, want) {
    if (!r) return '';
    if (!r.scars) r.scars = [];
    if (r.scars.length >= 2) return '';
    const id = r.scars.includes(want) ? pick(s, Object.keys(D.SCARS).filter((k) => !r.scars.includes(k))) : want;
    return applyScar(s, r, id);
  }
  function applyScar(s, r, id) {
    const S = D.SCARS[id];
    r.scars.push(id);
    if (S.skill) r.skills[S.skill] = Math.max(0, r.skills[S.skill] - 1);
    memo(r, s.day, `${J(S.name, '이/가')} 남았다.`, true);
    s.history.push({ day: s.day, text: `${r.name}: ${S.name} (${S.desc})` });
    return `${fillText(S.text, [r.name])} — 영구: ${S.name} (${S.desc})`;
  }
  function kill(s, r, why, noBody) {
    r.status = 'dead';
    s.plan[r.id] = undefined;
    s.stats.deaths += 1;
    s.history.push({ day: s.day, text: `${J(r.name, '이/가')} 숨을 거뒀다. (${why})` });
    say(s, noBody ? `${J(r.name, '이/가')} 사라졌다. 시신조차 남지 않았다. (${why})` : `${J(r.name, '이/가')} 숨을 거뒀다. 마지막 숨은 물 끓는 소리 같았다. 감기지 않은 눈을 누군가 손바닥으로 덮었다. (${why})`, 'bad');
    if (!noBody) { if (!s.corpses) s.corpses = []; s.corpses.push({ id: r.id, name: r.name }); }
    if (s.possessed === r.id) s.possessed = null;
    if (s.flame && s.flame.keeper === r.id) s.flame = null;
    const g = addAttention(s, 'osren', 1, '죽음'); if (g) say(s, g, 'warn');
    for (const o of alive(s)) o.stress = clamp(o.stress + 5, 0, 100);
    for (const o of alive(s)) memo(o, s.day, `${J(r.name, '을/를')} 잃었다.`, true);
  }

  // ── 바깥 신들: 시선 ──
  const GOD_OMEN = 3, GOD_ADVENT = 5, GOD_AFTER = 2;
  function godLabel(s, id) {
    const G = D.GODS[id];
    return (s.godSeen && s.godSeen[id] >= 2) ? `${G.name}(「${G.alias}」)` : `「${G.alias}」`;
  }
  // 시선을 바꾸고, 3·6에 처음 닿으면 징조·강림을 그날 밤으로 예약한다. 화면에 쓸 짧은 문장을 돌려준다.
  function addAttention(s, id, n, why) {
    const G = D.GODS[id];
    if (!G || !n) return '';
    if (id === 'ho' && s.flags.ho_gone) return '';
    const old = s.gods[id] || 0;
    const nv = clamp(old + n, 0, GOD_ADVENT);
    if (nv === old) return '';
    s.gods[id] = nv;
    const q = (kind) => { if (!s.godQueue.some((x) => x.god === id && x.kind === kind)) s.godQueue.push({ god: id, kind }); };
    if (old < GOD_OMEN && nv >= GOD_OMEN) q('omen');
    if (old < GOD_ADVENT && nv >= GOD_ADVENT && G.advent) q('advent');
    return `시선 ${godLabel(s, id)} ${n > 0 ? '+' : '−'}${Math.abs(n)}${why ? ` (${why})` : ''}`;
  }
  // 밤마다 역의 상태가 끄는 시선 (미리보기와 실제가 같은 함수)
  function godNightDelta(s, o) {
    const g = s.gods || {};
    const out = [];
    const add = (id, n, why) => { if (n < 0 && !(g[id] > 0)) return; out.push({ id, n, why }); };
    if (o.surge) add('nereh', 2, '수문 범람 — 어미의 들숨');
    if (o.flood >= 4) add('nereh', 1, '침수 4 이상'); else if (o.flood <= 1 && !o.surge) add('nereh', -1, '침수 1 이하');
    if (o.shortFood) add('gurmah', 2, '굶주림'); else if (o.foodAfter < Math.ceil(o.people * 0.5)) add('gurmah', 1, '창고가 거의 비었다'); else if (o.foodAfter >= o.people * 3) add('gurmah', -1, '배불리 먹음');
    if (o.exposure >= 6) add('seel', 1, '노출 6 이상');
    if (o.lit && (s.litStreak || 0) + 1 >= 3) add('seel', 1, '불을 사흘 연속 켬');
    if (o.guards >= 2) add('seel', -1, '경계 2명');
    if (o.lit) { if (((s.litNights || 0) + 1) % 2 === 0) add('hiska', 1, '불을 이틀 켬'); } else add('hiska', -1, '어두운 밤');
    return out.filter((x) => !(x.id === 'ho' && s.flags.ho_gone));
  }
  const boundToFlame = (s, r) => !!(s.flame && r && s.flame.keeper === r.id);

  // ── 할 일 / 계획 ──
  function slotsLeft(s, task, plan) {
    const used = Object.values(plan).filter((t) => t === task).length;
    return D.TASKS[task].slots - used;
  }
  function taskBlock(s, r, task) {                       // 이 사람이 이 일을 못 하는 이유 (없으면 '')
    const T = D.TASKS[task];
    if (!T) return '알 수 없는 일';
    if (task === 'rest') return '';
    if (r.breakdown > 0) return '탈진 상태';
    if (r.injury >= 2) return '중상 (휴식만 가능)';
    if (T.facility && s.facility !== T.facility) return '시설 필요';
    if (task === 'build' && !s.project) return '진행 중인 공사 없음';
    if (task === 'guard' && boundToFlame(s, r)) return '불씨 곁을 떠날 수 없다';
    if (task === 'salvage' && s.salvageLeft <= 0) return '더 해체할 곳 없음';
    if (task === 'forage' && s.forage <= 0) return '근처 식량이 바닥남';
    return '';
  }
  function effectivePlan(s) {
    const plan = {};
    for (const r of alive(s)) {
      if (s.expParty.includes(r.id)) { plan[r.id] = 'exp'; continue; }
      let t = s.plan[r.id] || 'rest';
      if (taskBlock(s, r, t) || slotsLeft(s, t, plan) <= 0) t = 'rest';
      plan[r.id] = t;
    }
    return plan;
  }
  function taskOptions(s, rid) {
    const r = byId(s, rid);
    const cur = s.plan[rid] || 'rest';
    return D.TASK_ORDER.map((id) => {
      const T = D.TASKS[id];
      let reason = taskBlock(s, r, id);
      if (!reason && id !== cur) {
        const others = Object.assign({}, s.plan); delete others[rid];
        const eff = {}; for (const o of alive(s)) if (o.id !== rid) eff[o.id] = others[o.id] || 'rest';
        if (slotsLeft(s, id, eff) <= 0 && id !== 'rest') reason = `자리 없음 (최대 ${T.slots}명)`;
      }
      return { id, name: T.name, desc: T.desc, disabled: !!reason, reason };
    });
  }

  // 오늘 계획의 예상 결과 (미리보기와 밤 정산이 같은 함수를 쓴다 → 화면 = 실제)
  function evalPlan(s) {
    const plan = effectivePlan(s);
    const rows = []; const notes = [];
    const d = { food: 0, water: 0, parts: 0, meds: 0, flood: 0, exposure: 0 };
    let made = 0, need = 0, power = 0, poolUse = 0, salvageUse = 0, progress = 0, genRunning = false;
    const heals = [];
    const workers = (task) => alive(s).filter((r) => plan[r.id] === task);

    const floodStop = s.flood >= FLOOD_POWER_STOP;
    const idle = [];
    for (const r of workers('gen')) {
      if (floodStop) { rows.push({ rid: r.id, task: 'gen', out: `침수 ${FLOOD_POWER_STOP} 이상 — 발전기 정지 (쉰다)`, bad: true }); idle.push(r.id); continue; }
      const out = 3 + traitVal(r, 'gen'); made += out; genRunning = true; rows.push({ rid: r.id, task: 'gen', out: `전력 +${out}` });
    }
    const flameOn = !!(s.flame && byId(s, s.flame.keeper) && byId(s, s.flame.keeper).status !== 'dead');
    if (flameOn) made += 3;
    if (floodStop && workers('gen').length) notes.push(`침수가 ${FLOOD_POWER_STOP} 이상이라 발전기가 잠긴다. 전력이 끊겨 물 긷기·재배·진료소가 멈춘다 (배수가 먼저다)`);
    power = made;
    // 전력 소비 순서: 물 긷기 → 재배 → 치료(진료소)
    let farmPowered = false, clinicPowered = false;
    for (const r of workers('pump')) {
      need += 1;
      if (power >= 1) { power -= 1; const out = Math.round(4 * sf(r.skills.tech)); d.water += out; rows.push({ rid: r.id, task: 'pump', out: `물 +${out}` }); }
      else { rows.push({ rid: r.id, task: 'pump', out: '전력 부족, 일 못 함 (쉰다)', bad: true }); idle.push(r.id); if (!floodStop) notes.push('전력이 모자라 물 긷기가 멈춘다'); }
    }
    const farmers = workers('farm');
    if (farmers.length) {
      need += 1;
      if (power >= 1) { power -= 1; farmPowered = true; for (const r of farmers) { const out = Math.round(4 * sf(r.skills.tech)); d.food += out; rows.push({ rid: r.id, task: 'farm', out: `식량 +${out}` }); } }
      else { for (const r of farmers) { rows.push({ rid: r.id, task: 'farm', out: '전력 부족, 일 못 함 (쉰다)', bad: true }); idle.push(r.id); } if (!floodStop) notes.push('전력이 모자라 재배가 멈춘다'); }
    }
    let poolLeft = s.forage;
    for (const r of workers('forage')) {
      const out = Math.min(poolLeft, Math.max(1, Math.round((3 + traitVal(r, 'forage')) * sf(r.skills.obs))));
      poolLeft -= out; poolUse += out; d.food += out; rows.push({ rid: r.id, task: 'forage', out: `식량 +${out}` });
    }
    let salvLeft = s.salvageLeft;
    for (const r of workers('salvage')) {
      const out = Math.min(salvLeft, 1 + (r.skills.str >= 3 ? 1 : 0));
      salvLeft -= out; salvageUse += out; d.parts += out; rows.push({ rid: r.id, task: 'salvage', out: `부품 +${out}` });
    }
    for (const r of workers('drain')) { const out = Math.floor(2 * sf(r.skills.str)); d.flood -= out; rows.push({ rid: r.id, task: 'drain', out: `침수 −${out}` }); }
    for (const r of workers('guard')) { const out = Math.floor(2 * sf(r.skills.str)); d.exposure -= out; rows.push({ rid: r.id, task: 'guard', out: `노출 −${out}` }); }
    for (const r of workers('build')) {
      if (!s.project) continue;
      const out = 1 + traitVal(r, 'build'); progress += out; rows.push({ rid: r.id, task: 'build', out: `공사 +${out}` });
    }
    // 치료: 환자(위독 우선) 순서로
    const healers = workers('tend');
    if (healers.length) {
      const clinic = s.facility === 'clinic';
      let canClinic = false;
      if (clinic) { need += 1; if (power >= 1) { power -= 1; canClinic = true; clinicPowered = true; } else notes.push('전력이 모자라 진료소가 멈춘다'); }
      const per = canClinic ? 2 : 1;
      const patients = alive(s).filter((r) => r.injury > 0 && plan[r.id] !== 'exp').sort((a, b) => (b.injury - a.injury) || (a.crit || 99) - (b.crit || 99));
      let medsLeft = s.res.meds, idx = 0;
      for (const h of healers) {
        let treated = 0;
        for (let k = 0; k < per && idx < patients.length; k++, idx++) {
          if (medsLeft < 1) { notes.push('약품이 없어 치료하지 못한다'); break; }
          medsLeft -= 1; treated += 1;
          const amount = 1 + traitVal(h, 'heal') + (canClinic ? 1 : 0);
          heals.push({ pid: patients[idx].id, amount, healer: h.id });
          d.meds -= 1;
        }
        rows.push({ rid: h.id, task: 'tend', out: treated ? `치료 ${treated}명 (약품 −${treated})` : (patients.length ? '약품이 없어 치료 불가 (쉰다)' : '치료할 사람 없음 (쉰다)'), bad: !treated }); if (!treated) idle.push(h.id);
      }
    }
    for (const r of workers('rest')) rows.push({ rid: r.id, task: 'rest', out: '휴식' });
    // 전력이 없으면 역이 어둡다 (모두 스트레스 +), 자포자기한 사람이 있으면 밤새 흐느낀다
    const dark = !genRunning && !flameOn;
    const sobbing = alive(s).filter((r) => r.affl === 'despair' && r.breakdown > 0).length;
    const ambient = (dark ? 4 : 0) + sobbing * D.AFFLICTIONS.despair.ambient;
    for (const r of alive(s)) if (plan[r.id] === 'exp') rows.push({ rid: r.id, task: 'exp', out: '원정 중' });
    if (genRunning) d.exposure += 1;
    // 사람마다 스트레스 변화 (화면에 보여 주는 숫자 = 실제 정산 값)
    for (const row of rows) {
      const r = byId(s, row.rid);
      if (row.task === 'exp') continue;
      const eff = idle.includes(row.rid) ? 'rest' : row.task;
      row.stress = (eff === 'rest' ? -Math.max(0, 16 - traitVal(r, 'restLess')) : D.TASKS[eff].stress + traitVal(r, 'workStress')) + ambient;
      if (r.injury === 1 && eff !== 'rest') row.infect = INFECT;
    }
    const away = alive(s).filter((r) => plan[r.id] === 'exp').length;
    const people = 1 + alive(s).length - away;
    const consume = { food: Math.ceil(people * 0.5), water: Math.ceil(people * 0.5) };
    const possessed = s.possessed && byId(s, s.possessed);
    if (possessed && possessed.status === 'home') { consume.food += 2; notes.push(`${J(possessed.name, '이/가')} 밤마다 몰래 먹는다 (식량 −2)`); }
    return { plan, rows, notes, d, made, need, poolUse, salvageUse, progress, heals, genRunning, consume, farmPowered, clinicPowered, people, idle, floodStop, dark, sobbing, ambient, flameOn };
  }

  // 내일 아침 예상 상태 (밤 사건의 무작위 결과는 제외). 화면 미리보기와 실제 정산이 같은 계산을 쓴다.
  function previewNight(s) {
    const ev = evalPlan(s);
    const surge = s.day === D.CALENDAR.surge.day ? 3 : 0;
    const raw = { food: s.res.food + ev.d.food - ev.consume.food, water: s.res.water + ev.d.water - ev.consume.water, parts: s.res.parts + ev.d.parts, meds: s.res.meds + ev.d.meds };
    const short = { food: Math.max(0, -raw.food), water: Math.max(0, -raw.water) };
    const res = {}; for (const k of Object.keys(raw)) res[k] = clamp(raw[k], 0, D.CAP[k]);
    let flood = clamp(s.flood + ev.d.flood + floodAuto(s.day) + surge, 0, 8);       // 실제 정산과 같은 순서: 먼저 상한, 그다음 수리 완성의 −2
    const completes = !!(s.project && ev.progress > 0 && s.project.progress + ev.progress >= D.PROJECTS[s.project.id].work);
    if (completes && s.project.id === 'repair') flood = clamp(flood - 2, 0, 8);
    const exposure = clamp(s.exposure + ev.d.exposure, 0, 8);
    const warnings = [];
    const healed = new Map(ev.heals.map((h) => [h.pid, h.amount]));
    const deaths = [];
    for (const r of alive(s)) {
      if (r.injury >= 3 && r.crit != null && s.day >= r.crit && !(healed.has(r.id) && r.injury - healed.get(r.id) < 3)) deaths.push(r.name);
    }
    for (const n of deaths) warnings.push({ text: `${J(n, '이/가')} 오늘 밤 사망한다 — 치료를 받지 못한다`, kind: 'bad' });
    if (surge && flood < 8) warnings.push(flood >= FLOOD_POWER_STOP
      ? { text: `${D.CALENDAR.surge.title}: 침수 ${flood} — 발전기가 잠겨 내일 전력이 끊긴다`, kind: 'bad' }
      : { text: `${D.CALENDAR.surge.title}을 버틴다 (침수 ${flood}) — 발전기 무사`, kind: 'good' });
    if (flood >= 8) warnings.push({ text: '침수 8 도달 → 오늘 밤 수위 경보 (식량 −6·부품 −2, 또는 모두 스트레스 +8)', kind: 'bad' });
    if (exposure >= 6 && (s.visitDay == null || s.visitDay > s.day + 1)) warnings.push({ text: '노출 6 이상 → 내일 밤 순찰대가 찾아온다', kind: 'warn' });
    const infected = ev.rows.filter((x) => x.infect).map((x) => byId(s, x.rid).name);
    if (infected.length) warnings.push({ text: `경상인 채로 일한다: ${infected.join('·')} — 각자 ${Math.round(INFECT * 100)}% 확률로 곪아 중상`, kind: 'warn' });
    const fainting = (k) => homeRes(s).filter((r) => !s.expParty.includes(r.id) && r[k] >= (k === 'hunger' ? 1 : 0)).map((r) => r.name);
    if (short.food) { const f = fainting('hunger'); warnings.push({ text: `식량이 모자란다 — 모두 스트레스 +8${f.length ? `, ${f.join('·')} 쓰러진다 (부상 1)` : ', 이틀 연속이면 쓰러진다'}`, kind: 'bad' }); }
    if (short.water) warnings.push({ text: '물이 모자란다 — 모두 스트레스 +10, 오늘 밤 모두 쓰러진다 (부상 1)', kind: 'bad' });
    if (!short.food && !short.water && (res.food === 0 || res.water === 0)) warnings.push({ text: '창고가 바닥난다 — 내일부터 모자랄 수 있다', kind: 'warn' });
    if (completes) warnings.push({ text: `${D.PROJECTS[s.project.id].name} 완성${s.project.id === 'repair' ? ' (침수 −2)' : ''}`, kind: 'good' });
    const guards = ev.rows.filter((x) => x.task === 'guard').length;
    const godDelta = godNightDelta(s, { surge: !!surge, flood, exposure, shortFood: short.food > 0, foodAfter: res.food, people: ev.people, guards, lit: !ev.dark });
    if (godDelta.length) {
      const cross = godDelta.filter((x) => x.n > 0).map((x) => { const v = (s.gods[x.id] || 0) + x.n; return (s.gods[x.id] || 0) < GOD_OMEN && v >= GOD_OMEN ? `${godLabel(s, x.id)} 징조가 온다` : (s.gods[x.id] || 0) < GOD_ADVENT && v >= GOD_ADVENT && D.GODS[x.id].advent ? `${godLabel(s, x.id)} 강림한다` : ''; }).filter(Boolean);
      warnings.push({ text: `시선: ${godDelta.map((x) => `${godLabel(s, x.id)} ${x.n > 0 ? '+' : '−'}${Math.abs(x.n)} (${x.why})`).join(' · ')}${cross.length ? ` → ${cross.join(' · ')}` : ''}`, kind: cross.length ? 'bad' : godDelta.some((x) => x.n > 0 && D.GODS[x.id].kind === 'hostile') ? 'warn' : '' });
    }
    if (ev.dark) warnings.push({ text: '전력 0 — 오늘 밤 역이 어둡다: 모두 스트레스 +4 · 밤 사건 판정 −10%p', kind: 'warn' });
    if (ev.sobbing) warnings.push({ text: `자포자기한 사람이 밤새 흐느낀다 — 모두 스트레스 +${ev.sobbing * D.AFFLICTIONS.despair.ambient}`, kind: 'warn' });
    if (ev.made > 0 && ev.need === 0 && ev.genRunning) warnings.push({ text: `전력 ${ev.made}은 불만 밝힌다 — 어둠을 막지만 노출 +1`, kind: '' });
    return { ev, res, short, flood, exposure, surge, warnings, deaths, godDelta };
  }

  // 열차 정원: 통로가 이어졌고, 한 사람당 식량 2·물 2씩 있을 때만 태울 수 있다
  function boardingPool(s) {
    const pool = alive(s).map((r) => ({ id: r.id, name: r.name, kind: 'resident' }));
    for (const [id, a] of Object.entries(D.ALLIES)) if (s.allies[id] && s.flags[a.flag]) pool.push({ id, name: a.name, kind: 'ally' });
    return pool;
  }
  function trainInfo(s) {
    const pool = boardingPool(s);
    const base = Math.min(Math.floor(s.res.food / BOARD_PER), Math.floor(s.res.water / BOARD_PER));
    const hospital = s.flags.seat_bonus ? 2 : 0;                              // 병원 팀이 좌석 두 개분의 보급을 맡아 준다
    const litter = Math.min(BOARD_LITTER_MAX, Math.floor(s.res.parts / BOARD_LITTER));   // 부품으로 들것·침낭을 만든다
    const seat = s.seatMod || 0;                                           // 검표원의 판정 (±)
    const supplyCap = Math.max(0, base + hospital + litter + seat);
    return { passage: !!s.flags.passage_secured, pact: !!s.flags.hospital_pact, pool: pool.length, base, hospital, litter, seat, supplyCap, cap: s.flags.passage_secured ? Math.min(pool.length, supplyCap) : 0 };
  }

  // ── 달력·예보 ──
  const floodAuto = (day) => (day >= 3 && day <= 8 ? (day % 2 === 0 ? 1 : 0) : day >= 9 ? 1 : 0);
  function forecast(s) {
    const out = [];
    const cal = D.CALENDAR;
    if (s.day >= cal.surge.day - cal.surge.forecast && s.day <= cal.surge.day) out.push({ text: `D${cal.surge.day} 밤 ${cal.surge.title} 예보: ${cal.surge.short} — 그날 밤 침수가 4 이하면 버티고, ${FLOOD_POWER_STOP} 이상이면 발전기가 잠기고, 8이면 수위 경보${s.day === cal.surge.day ? ' (오늘 밤!)' : ''}`, kind: s.day === cal.surge.day ? 'warn' : '' });
    if (s.visitDay != null && s.day <= s.visitDay && s.visitDay - s.day <= 3) out.push({ text: `D${s.visitDay} 밤 순찰대 방문 예보${s.visitDay === s.day ? ' — 오늘 밤!' : ''} (경계 2명을 세우면 맞설 수 있다)`, kind: s.visitDay === s.day ? 'warn' : '' });
    if (floodAuto(s.day) > 0) out.push({ text: `오늘 밤 침수 +${floodAuto(s.day)} (배수로 역류)`, kind: '' });
    for (const q of s.godQueue || []) if (D.GODS[q.god] && D.GODS[q.god][q.kind]) out.push({ text: `오늘 밤 ${godLabel(s, q.god)}의 ${q.kind === 'omen' ? '징조가' : '강림이'} 온다`, kind: q.kind === 'advent' ? 'bad' : 'warn' });
    for (const p of s.promises.slice().sort((a, b) => a.due - b.due)) out.push({ text: `D${p.due} 저녁 약속: ${(D.PROMISES[p.id] || {}).title}`, kind: p.due <= s.day ? 'warn' : '' });
    for (const k of ['A', 'B']) if (s.closed[k] > 0) out.push({ text: `${D.REGION_NAMES[k]} 길 막힘 ${s.closed[k]}일`, kind: 'bad' });
    if (s.flood >= 6) out.push({ text: '침수 6 이상: 원정 귀환 시간 +1시간', kind: 'warn' });
    if (s.flood >= FLOOD_POWER_STOP) out.push({ text: `침수 ${FLOOD_POWER_STOP} 이상: 발전기가 잠겨 전력이 끊긴다`, kind: 'bad' });
    if (s.day >= D.GOAL_DAY - 3) { const tr = trainInfo(s); out.push({ text: `D${D.GOAL_DAY} 열차: ${tr.passage ? `승차 정원 ${tr.cap}명 (식량·물 ${BOARD_PER}개씩 → ${tr.base}명${tr.hospital ? ' + 병원 보급 ' + tr.hospital : ''}${tr.litter ? ' + 들것 ' + tr.litter : ''}${tr.seat ? ` ${tr.seat > 0 ? '+' : '−'} 검표 ${Math.abs(tr.seat)}` : ''})` : '통로가 이어지지 않으면 열차가 닿지 못한다'}`, kind: s.day === D.GOAL_DAY ? 'warn' : '' }); }
    return out;
  }

  // ── 선택지 판정 공통 ──
  function rollerPool(s, ctx) {
    if (ctx === 'exp') return s.exp.party.map((id) => byId(s, id));
    if (ctx === 'guards') return alive(s).filter((r) => s.guardIds && s.guardIds.includes(r.id));
    return homeRes(s);
  }
  function bestRoller(pool, skill) {
    let best = null;
    for (const r of pool) if (!best || r.skills[skill] > best.skills[skill]) best = r;
    return best;
  }
  function packItems(s) { return s.exp ? s.exp.pack.items : []; }
  function have(s, k, ctx) {
    if (ctx === 'exp') { const e = s.exp; return (k === 'parts' ? 0 : (e.pack[k] || 0)) + (e.loot[k] || 0); }
    return s.res[k];
  }
  function checkChance(s, check, ctx) {
    const pool = rollerPool(s, check.guards ? 'guards' : ctx);
    const r = bestRoller(pool, check.skill);
    if (!r) return 0.15;
    let c = check.base + 0.12 * r.skills[check.skill];
    if (check.item && packItems(s).includes(check.item)) c += check.bonus || 0;
    c += traitVal(r, 'expCheck') * (ctx === 'exp' ? 1 : 0);
    if (check.skill === 'talk') c += traitVal(r, 'talkCheck');
    if (ctx === 'station' && s.phase === 'nightEvent' && s.dark) c -= 0.1;
    return clamp(c, 0.15, 0.9);
  }
  function choiceState(s, ch, ctx) {
    const rq = ch.req || {};
    const pool = rollerPool(s, ctx);
    if (rq.item && !packItems(s).includes(rq.item)) return { locked: true, reason: `${D.ITEMS[rq.item]} 필요 (가방에 없음)` };
    if (rq.trait && !pool.some((r) => hasTag(r, rq.trait))) return { locked: true, reason: '해당 특성을 가진 동행 필요' };
    if (rq.flag && !s.flags[rq.flag]) return { locked: true, reason: '조건 미충족' };
    if (rq.noFlag && s.flags[rq.noFlag]) return { locked: true, reason: '이미 했다' };
    if (ch.delay && s.day + ch.delay > D.GOAL_DAY) return { locked: true, reason: '열차 시간 이후라 미룰 수 없다' };
    if (rq.guards && (s.guardIds || []).length < rq.guards) return { locked: true, reason: `경계 ${rq.guards}명 필요 (오늘 ${(s.guardIds || []).length}명)` };
    if (ch.cost) for (const [k, v] of Object.entries(ch.cost)) if (have(s, k, ctx) < v) return { locked: true, reason: `${D.RES[k]} ${v} 필요` };
    const st = { locked: false, reason: '', chance: ch.check ? checkChance(s, ch.check, ctx) : null, warn: '' };
    if (ctx === 'station' && s.phase === 'evening' && ch.cost && ch.cost.meds) {
      const planned = evalPlan(s).heals.length;
      if (s.res.meds - ch.cost.meds < planned) st.warn = '약품이 모자라져 오늘 밤 치료가 취소된다 (위독자는 사망할 수 있다)';
    }
    return st;
  }
  // 선택지에 숨은 위험을 미리 알려 주는 짧은 태그 (보상은 알려 주지 않는다)
  function choiceTags(ch) {
    const t = [];
    const add = (src, pre) => {
      if (!src) return;
      if (src.injure) t.push(`${pre}${src.injure >= 2 ? '중상' : '부상'}`);
      if (src.hours) t.push(`${pre}시간 +${src.hours}`);
      if (src.flood > 0) t.push(`${pre}침수 +${src.flood}`);
      if (src.exposure > 0) t.push(`${pre}노출 +${src.exposure}`);
      if (src.stress > 0) t.push(`${pre}스트레스 +${src.stress}`);
      if (src.close) t.push(`${pre}${D.REGION_NAMES[src.close.region]} 길 막힘`);
      for (const [k, v] of Object.entries(Object.assign({}, src.res, Object.fromEntries(Object.entries(src.lose || {}).map(([a, b]) => [a, -b]))))) if (v < 0) t.push(`${pre}${D.RES[k]} −${-v}`);
      if (src.vanish) t.push(`${pre}누군가 사라짐`);
      if (src.scarParty || src.scarGuard) t.push(`${pre}영구 상처`);
      if (src.foodHalf) t.push(`${pre}식량 절반이 썩음`);
      if (src.reap) t.push(`${pre}한 사람이 거두어짐`);
      if (src.possess) t.push(`${pre}한 사람이 허기에 들림`);
      if (src.hoGone) t.push(`${pre}부르는 소리가 영원히 떠남`);
      for (const [id, n] of Object.entries(src.god || {})) if (n > 0) t.push(`${pre}시선 「${D.GODS[id].alias}」 +${n}`);
    };
    if (ch.check) { add(ch.fail, '실패 시 '); add(ch.ok, '성공해도 '); } else add(ch.out, '');
    return t;
  }
  function payCost(s, cost, ctx) {
    for (const [k, v] of Object.entries(cost || {})) {
      if (ctx === 'exp') {
        const e = s.exp; let left = v;
        if (k !== 'parts') { const t = Math.min(e.pack[k] || 0, left); e.pack[k] -= t; left -= t; }
        if (left > 0) e.loot[k] = (e.loot[k] || 0) - left;
      } else s.res[k] -= v;
    }
  }

  // ── 결과 적용 ──
  function lootCap(s, e) {
    const party = e.party.map((id) => byId(s, id));
    return BASE_LOAD + party.reduce((a, r) => a + traitVal(r, 'expLoad'), 0) - (e.pack.food + e.pack.water + e.pack.meds + e.pack.items.length);
  }
  const lootUsed = (e) => Object.values(e.loot).reduce((a, b) => a + b, 0);
  function describeOutcome(o) {
    const L = [];
    if (o.loot) L.push(resText(o.loot));
    if (o.res) L.push(resText(o.res));
    if (o.lose) L.push(resText(Object.fromEntries(Object.entries(o.lose).map(([k, v]) => [k, -v]))));
    if (o.stress) L.push(`스트레스 ${o.stress > 0 ? '+' : ''}${o.stress}`);
    if (o.flood) L.push(`침수 ${o.flood > 0 ? '+' : ''}${o.flood}`);
    if (o.exposure) L.push(`노출 ${o.exposure > 0 ? '+' : ''}${o.exposure}`);
    if (o.hours) L.push(`시간 +${o.hours}`);
    if (o.item) L.push(`${D.ITEMS[o.item]} 획득`);
    if (o.promise) L.push(`${o.promise.days}일 뒤 저녁 약속 예약`);
    if (o.close) L.push(`${D.REGION_NAMES[o.close.region]} 길 ${o.close.days}일 막힘`);
    if (o.ally) L.push(`${D.ALLIES[o.ally].name} 합류 약속`);
    if (o.heal) L.push('다친 사람 부상 한 단계 회복');
    return L.filter(Boolean);
  }
  function applyOutcome(s, o, ctx, threat) {
    const e = s.exp;
    const lines = describeOutcome(o);
    const party = ctx === 'exp' ? e.party.map((id) => byId(s, id)) : [];
    if (o.res) for (const [k, v] of Object.entries(o.res)) addRes(s, k, v);
    if (o.loot) {
      if (ctx === 'exp') {
        for (const [k, v] of Object.entries(o.loot)) {
          const room = Math.max(0, lootCap(s, e) - lootUsed(e));
          const got = Math.min(v, room);
          if (got > 0) e.loot[k] = (e.loot[k] || 0) + got;
          if (got < v) lines.push(`가방이 가득 차 ${D.RES[k]} ${v - got}개를 두고 간다`);
        }
      } else for (const [k, v] of Object.entries(o.loot)) addRes(s, k, v);
    }
    if (o.lose) for (const [k, v] of Object.entries(o.lose)) {
      if (ctx === 'exp') { const t = Math.min(e.loot[k] || 0, v); e.loot[k] = (e.loot[k] || 0) - t; } else addRes(s, k, -v);
    }
    if (o.stressAll) for (const r of alive(s)) r.stress = clamp(r.stress + o.stressAll, 0, 100);
    if (o.stress) {
      const group = ctx === 'exp' ? party : homeRes(s);
      for (const r of group) r.stress = clamp(r.stress + o.stress + (o.stress > 0 && threat ? traitVal(r, 'threatStress') : 0), 0, 100);
    }
    if (o.injure) {
      const named = (s.nightEv && s.nightEv.who ? s.nightEv.who : []).map((id) => byId(s, id)).filter((r) => r && r.status === 'home');
      const group = ctx === 'exp' ? party : (named.length ? named : homeRes(s).filter((r) => !s.expParty.includes(r.id)));
      if (group.length) { const t = pick(s, group); const scar = injure(s, t, o.injure); lines.push(`${t.name} 부상 ${o.injure}`); if (scar) lines.push(scar); if (ctx === 'exp') memo(t, s.day, '원정에서 다쳤다.', true); }
    }
    if (o.heal) for (const r of homeRes(s)) if (r.injury > 0 && r.injury < 3) r.injury = Math.max(0, r.injury - o.heal);
    if (o.flood) s.flood = clamp(s.flood + o.flood, 0, 8);
    if (o.exposure) s.exposure = clamp(s.exposure + o.exposure, 0, 8);
    if (o.flag) for (const f of [].concat(o.flag)) s.flags[f] = true;
    if (o.unflag) delete s.flags[o.unflag];
    if (o.buried && s.corpses && s.corpses[0]) s.buried.push(s.corpses[0].id);
    if (o.hoGone) { s.flags.ho_gone = true; s.gods.ho = 0; s.godQueue = s.godQueue.filter((x) => x.god !== 'ho'); lines.push('부르는 소리가 영원히 떠났다'); }
    if (o.god) for (const [id, n] of Object.entries(o.god)) { const g = addAttention(s, id, n); if (g) lines.push(g); }
    if (o.foodHalf) { const lost = Math.ceil(s.res.food / 2); s.res.food -= lost; lines.push(`식량 −${lost} (절반이 썩었다)`); }
    if (o.vanish) { const v = vanishOne(s, o.vanish); if (v) lines.push(v); }
    if (o.possess) {
      const c = homeRes(s).filter((r) => !boundToFlame(s, r));
      if (c.length) { const r = pick(s, c); s.possessed = r.id; memo(r, s.day, '빈 입이 들어앉았다.', true); lines.push(`${J(r.name, '이/가')} 허기에 들렸다 — 매일 밤 식량 −2를 몰래 먹는다`); }
    }
    if (o.scarGuard) { const g = homeRes(s).filter((r) => (s.guardIds || []).includes(r.id)); if (g.length) { const sc = forceScar(s, pick(s, g), o.scarGuard); if (sc) lines.push(sc); } }
    if (o.scarParty && party.length) { const sc = forceScar(s, pick(s, party), o.scarParty); if (sc) lines.push(sc); }
    if (o.seatPlus) { s.seatMod = clamp((s.seatMod || 0) + o.seatPlus, -2, 2); }
    if (o.ticket) {
      const kept = ['hospital_pact', 'repair_open'].filter((f) => s.flags[f]).length;
      const broken = ['pact_refused', 'repair_refused', 'skipped_eunchae'].filter((f) => s.flags[f]).length + (s.flags.skipped_dohyeon && !s.flags.met_dohyeon ? 1 : 0);
      const d = Math.sign(kept - broken);
      s.seatMod = clamp((s.seatMod || 0) + d, -2, 2);
      lines.push(d > 0 ? `지킨 약속 ${kept} > 어긴 약속 ${broken} — 승차 정원 +1` : d < 0 ? `어긴 약속 ${broken} > 지킨 약속 ${kept} — 승차 정원 −1` : `지킨 약속 ${kept} = 어긴 약속 ${broken} — 정원 그대로`);
    }
    if (o.ashGift) {
      const dead = s.buried.map((id) => byId(s, id)).filter(Boolean);
      const living = alive(s);
      if (dead.length && living.length) {
        const d = dead[dead.length - 1];
        const k = Object.keys(d.skills).sort((a, b) => d.skills[b] - d.skills[a])[0];
        const r = pick(s, living); r.skills[k] += 1;
        memo(r, s.day, `${d.name}의 재를 받았다.`, true);
        lines.push(`${d.name}의 재가 ${r.name}에게 남았다 — ${D.SKILLS[k]} +1`);
      } else { for (const r of homeRes(s)) r.stress = clamp(r.stress + 8, 0, 100); lines.push('장례를 치른 적이 없다 — 모두 스트레스 +8'); }
    }
    if (o.reap) {
      const crit = alive(s).filter((r) => r.injury >= 3);
      if (crit.length) { const r = crit[0]; kill(s, r, '잿빛 손이 거두어 갔다', true); lines.push(`${J(r.name, '이/가')} 거두어졌다`); }
      else {
        const r = alive(s).slice().sort((a, b) => b.stress - a.stress)[0];
        if (r) { r.affl = null; r.breakdown = 0; r.stress = 40; lines.push(`잿빛 손이 ${r.name}의 무너진 마음을 거두어 갔다 — 스트레스 40, 붕괴 회복`); }
      }
    }
    if (o.flame) { const id = s.nightEv && s.nightEv.who && s.nightEv.who[0]; const r = id && byId(s, id); if (r) { s.flame = { keeper: r.id }; memo(r, s.day, '영원의 불씨를 받았다.', true); lines.push(`${J(r.name, '이/가')} 불씨지기가 되었다 — 매일 전력 +3, 경계·원정 불가`); } }
    if (o.noDark) s.noDarkUntil = s.day + o.noDark;
    if (o.hoCall) s.flags.ho_call = true;
    if (o.memAll) { for (const r of alive(s)) memo(r, s.day, o.memAll, true); s.history.push({ day: s.day, text: o.memAll }); }
    if (o.promise) addPromise(s, o.promise.id, s.day + o.promise.days);
    if (o.ally) s.allies[o.ally] = true;
    if (o.item) s.items[o.item] = true;
    if (o.hours && e) { const room = Math.max(e.extra, MAX_HOURS - (2 * e.depth + 2 * (e.steps + 1) + floodPenalty(s))); e.extra = Math.min(e.extra + o.hours, room); }
    if (o.close) s.closed[o.close.region] = o.close.days + 1;     // 밤에 정해지고 바로 하루가 지나므로 +1
    if (o.trust) for (const [id, n] of Object.entries(o.trust)) { const r = byId(s, id); if (r) r.trust = clamp(r.trust + n, 0, 4); }
    if (o.mem) { for (const r of (ctx === 'exp' ? party : [])) memo(r, s.day, o.mem, true); s.history.push({ day: s.day, text: o.mem }); }
    return lines;
  }
  // 시신 없이 사라짐: 'water' 물가에서 일하던 사람, 'random', 'weakest' 가장 약한 사람, 'who' 사건의 주인공
  function vanishOne(s, mode) {
    const home = alive(s).filter((r) => r.status === 'home');
    let c = [];
    if (mode === 'who') c = (s.nightEv && s.nightEv.who || []).map((id) => byId(s, id)).filter((r) => r && r.status !== 'dead');
    else if (mode === 'water') c = home.filter((r) => ['drain', 'pump'].includes((s.nightPlan || {})[r.id]));
    else if (mode === 'weakest') c = home.slice().sort((a, b) => (b.injury - a.injury) || (b.stress - a.stress)).slice(0, 1);
    if (!c.length) c = home;
    if (!c.length) return '';
    const r = pick(s, c);
    kill(s, r, mode === 'water' ? '바닥의 어미가 끌어갔다' : mode === 'who' ? '스스로 걸어 들어갔다' : '돌아오지 않았다', true);
    return `${J(r.name, '이/가')} 사라졌다`;
  }
  function addPromise(s, id, due) {
    if (s.promises.length >= 3 || s.promises.some((p) => p.id === id)) return false;
    s.promises.push({ id, due: Math.min(due, D.GOAL_DAY) });     // 열차 이후로는 미룰 수 없다
    return true;
  }

  function runChoice(s, ev, i, ctx, threat) {
    const ch = ev.choices[i];
    if (!ch) return null;
    const st = choiceState(s, ch, ctx);
    if (st.locked) return null;
    payCost(s, ch.cost, ctx);
    let outcome = ch.out, roll = null;
    if (ch.check) {
      const r = rand(s);
      roll = { chance: st.chance, success: r < st.chance };
      outcome = roll.success ? ch.ok : ch.fail;
    }
    const lines = applyOutcome(s, outcome || {}, ctx, threat);
    return { choice: ch.text, text: (outcome && outcome.text) || '', lines, roll, retry: !!(outcome && outcome.retry) };
  }

  // ── 원정 ──
  const floodPenalty = (s) => (s.flood >= 6 ? 1 : 0);
  function expHours(s, e, extraEvents) { return 2 * e.depth + 2 * (e.steps + (extraEvents || 0)) + e.extra + floodPenalty(s); }
  function expNeed(e, hours) { return e.party.length * Math.ceil(hours / 4); }
  const repeatable = (id) => D.GENERIC.includes(id) || D.CREATURES.includes(id);
  const eligible = (s, id) => {
    if (!repeatable(id) && s.flags['done_' + id]) return false;
    const w = D.EVENTS[id] && D.EVENTS[id].when;
    return !(w && w.flag && !s.flags[w.flag]);
  };
  function pickEvent(s, e) {
    const reg = D.REGIONS[e.region];
    const list = (reg.depth[e.depth] || []).filter((id) => eligible(s, id));
    const chain = list.filter((id) => (D.EVENTS[id].prio || 0) >= 5);
    if (e.depth === 1 && e.steps === 0 && chain.length) return chain[0];
    const gen = D.GENERIC.filter((id) => eligible(s, id)).map((id) => [id, 2]);
    for (const id of D.CREATURES) { const ev = D.EVENTS[id]; if (!ev.region || ev.region === e.region) gen.push([id, 0.5 + 0.8 * ((s.gods || {})[ev.creature] || 0)]); }
    const wpick = () => { let r = rand(s) * gen.reduce((a, x) => a + x[1], 0); for (const [id, w] of gen) { r -= w; if (r <= 0) return id; } return gen[gen.length - 1][0]; };
    if (gen.length && (rand(s) < 0.3 || !list.length)) return wpick();
    return list.length ? pick(s, list) : wpick();
  }
  function canDepart(s, region, party, pack) {
    if (s.phase !== 'morning') return '지금은 원정을 떠날 수 없다';
    if (s.expDone) return '오늘은 이미 원정을 다녀왔다';
    if (!D.REGIONS[region]) return '가는 곳을 고르세요';
    if (s.closed[region] > 0) return '길이 막혀 있다';
    if (!Array.isArray(party) || party.length !== 2 || party[0] === party[1]) return '동행 2명을 고르세요';
    const people = party.map((id) => byId(s, id));
    for (const r of people) {
      if (!r || r.status !== 'home') return '원정을 갈 수 없는 사람이 있다';
      if (r.injury >= 2) return `${r.name}: 중상이라 갈 수 없다`;
      if (r.stress >= STRESS_LIMIT_EXP) return `${r.name}: 스트레스 ${STRESS_LIMIT_EXP} 이상이라 갈 수 없다`;
      if (r.breakdown > 0) return `${r.name}: 탈진 상태`;
      if (noExp(r)) return `${r.name}: 다리를 절어 원정을 갈 수 없다`;
      if (boundToFlame(s, r)) return `${r.name}: 불씨 곁을 떠날 수 없다`;
    }
    const p = { food: pack.food | 0, water: pack.water | 0, meds: pack.meds | 0, items: (pack.items || []).filter((i) => s.items[i]) };
    if (p.food < 0 || p.water < 0 || p.meds < 0) return '보급 수량이 잘못됐다';
    if (p.food < 2 || p.water < 2) return '식량·물을 각각 2개 이상 챙기세요';
    if (p.food > s.res.food || p.water > s.res.water || p.meds > s.res.meds) return '창고에 없는 만큼은 챙길 수 없다';
    const cap = BASE_LOAD + people.reduce((a, r) => a + traitVal(r, 'expLoad'), 0) - (p.food + p.water + p.meds + p.items.length);
    if (cap < 4) return '가방이 너무 무겁다 (전리품 자리 4칸 이상 필요)';
    return '';
  }
  function expStart(s, region, party, pack) {
    if (canDepart(s, region, party, pack)) return false;
    const p = { food: pack.food | 0, water: pack.water | 0, meds: pack.meds | 0, items: (pack.items || []).filter((i) => s.items[i]) };
    s.res.food -= p.food; s.res.water -= p.water; s.res.meds -= p.meds;
    for (const id of party) { byId(s, id).status = 'exp'; s.plan[id] = undefined; }
    s.expParty = party.slice();
    s.exp = { region, party: party.slice(), depth: 1, steps: 0, extra: 0, pack: p, loot: {}, phase: 'event', eventId: null, result: null, force: false };
    s.stats.expeditions += 1;
    s.phase = 'expedition';
    s.exp.eventId = pickEvent(s, s.exp);
    return true;
  }
  function expView(s) {
    const e = s.exp; if (!e) return null;
    const ev = e.eventId ? D.EVENTS[e.eventId] : null;
    const hoursNow = expHours(s, e, e.phase === 'event' ? 1 : 0);
    const info = {
      region: e.region, depth: e.depth, steps: e.steps, phase: e.phase, party: e.party.map((id) => byId(s, id)),
      hours: hoursNow, normal: NORMAL_HOURS, max: MAX_HOURS, loot: e.loot, pack: e.pack, cap: lootCap(s, e), used: lootUsed(e),
      need: { food: expNeed(e, hoursNow), water: expNeed(e, hoursNow) }, have: { food: e.pack.food + (e.loot.food || 0), water: e.pack.water + (e.loot.water || 0) },
      event: ev, choices: ev ? ev.choices.map((c) => Object.assign({ choice: c }, choiceState(s, c, 'exp'))) : [], result: e.result, force: e.force,
    };
    if (e.phase === 'result') {
      const more = expHours(s, e, 1), deeper = 2 * (e.depth + 1) + 2 * (e.steps + 1) + e.extra + floodPenalty(s);
      const reg = D.REGIONS[e.region];
      info.options = {
        more: { hours: more, ok: !e.force && more <= MAX_HOURS, over: more > NORMAL_HOURS },
        deeper: { hours: deeper, ok: !e.force && e.depth < reg.maxDepth && deeper <= MAX_HOURS, over: deeper > NORMAL_HOURS },
        back: { hours: expHours(s, e, 0), over: expHours(s, e, 0) > NORMAL_HOURS },
      };
    }
    return info;
  }
  function expChoose(s, i) {
    const e = s.exp;
    if (!e || e.phase !== 'event') return false;
    const ev = D.EVENTS[e.eventId];
    const res = runChoice(s, ev, i, 'exp', false);
    if (!res) return false;
    e.steps += 1;
    if (!res.retry && !repeatable(e.eventId)) s.flags['done_' + e.eventId] = true;
    e.result = res; e.phase = 'result';
    if (e.party.some((id) => byId(s, id).injury >= 3)) e.force = true;
    return true;
  }
  // 전투 결과 (v3 화면에서 싸운 뒤): result 'win'|'lose'|'flee', wounds [{rid, part}] 부러진 부위
  function expFight(s, result, wounds) {
    const e = s.exp;
    if (!e || e.phase !== 'event') return false;
    const F = D.FIGHTS[e.eventId];
    if (!F || !F[result]) return false;
    const lines = [];
    for (const w of (Array.isArray(wounds) ? wounds : []).slice(0, 8)) {
      const r = w && byId(s, w.rid), P = w && D.BODY[w.part];
      if (!r || !P || !e.party.includes(r.id) || r.status === 'dead') continue;
      const sc = injure(s, r, P.injure);
      lines.push(`${r.name}: ${J(P.name, "이/가")} 부러졌다 (부상 ${P.injure})`);
      if (sc) lines.push(sc);
      else if (rand(s) < P.scarChance) { const sc2 = forceScar(s, r, pick(s, P.scars)); if (sc2) lines.push(sc2); }
      memo(r, s.day, `${F.enemy.name}에게 ${J(P.name, "을/를")} 다쳤다.`, true);
    }
    const o = F[result];
    const more = applyOutcome(s, o, 'exp', true);
    e.steps += 1;
    e.result = { choice: result === 'win' ? `${J(F.enemy.name, "과/와")} 싸워 이겼다` : result === 'lose' ? `${F.enemy.name}에게 졌다` : `${F.enemy.name}에게서 도망쳤다`, text: o.text, lines: lines.concat(more), roll: null, retry: false };
    e.phase = 'result';
    if (e.party.some((id) => byId(s, id).injury >= 3)) e.force = true;
    return true;
  }
  function expNext(s, mode) {
    const e = s.exp;
    if (!e || e.phase !== 'result') return false;
    const v = expView(s);
    if (mode === 'return') return finishExp(s);
    if (mode === 'more' && !v.options.more.ok) return false;
    if (mode === 'deeper' && !v.options.deeper.ok) return false;
    if (mode !== 'more' && mode !== 'deeper') return false;
    if (mode === 'deeper') { e.depth += 1; if (e.region === 'B') addAttention(s, 'nereh', 1, '수문 깊이 2'); }
    e.phase = 'event'; e.result = null;
    e.eventId = pickEvent(s, e);
    return true;
  }
  function finishExp(s) {
    const e = s.exp;
    const hours = expHours(s, e, 0);
    const over = Math.max(0, hours - NORMAL_HOURS);
    const party = e.party.map((id) => byId(s, id));
    const need = expNeed(e, hours);
    const usedUp = {};
    for (const k of ['food', 'water']) {
      let left = need;
      const t1 = Math.min(e.pack[k], left); e.pack[k] -= t1; left -= t1;
      const t2 = Math.min(e.loot[k] || 0, left); e.loot[k] = (e.loot[k] || 0) - t2; left -= t2;
      usedUp[k] = left;
    }
    const lines = [`걸린 시간 ${hours}시간${over ? ` (강행 +${over})` : ''}`];
    for (const r of party) {
      let st = 12 + traitVal(r, 'expStress') + 10 * over;
      st += 4 * (usedUp.food > 0 ? 1 : 0) + 5 * (usedUp.water > 0 ? 1 : 0);
      r.stress = clamp(r.stress + st, 0, 100);
      r.status = 'home';
    }
    if (usedUp.food > 0 || usedUp.water > 0) lines.push('보급이 모자라 굶주리며 돌아왔다');
    const back = {};
    for (const k of ['food', 'water', 'meds', 'parts']) { const n = (e.pack[k] || 0) + (e.loot[k] || 0); if (n > 0) { back[k] = n; addRes(s, k, n); } }
    for (const it of e.pack.items) s.items[it] = true;
    if (back.parts) s.flags.seenParts = true;
    const names = party.map((r) => r.name).join('·');
    say(s, `${names} 귀환. ${lines.join(' / ')}${Object.keys(back).length ? ' / 가져온 것: ' + resText(back) : ''}`, '');
    s.history.push({ day: s.day, text: `${D.REGIONS[e.region].name} 원정 (${names})` });
    for (const r of party) memo(r, s.day, `${D.REGIONS[e.region].name} 원정에 다녀왔다.`);
    s.expDone = true; s.exp = null; s.phase = 'morning';
    return true;
  }

  // ── 공사 ──
  function startProject(s, id) {
    const P = D.PROJECTS[id];
    if (!P || s.phase !== 'morning' || s.project) return false;
    if (P.hidden && !s.flags.repair_open) return false;
    if (id === 'repair' && s.flags.passage_secured) return false;
    if (P.group === 'living' && s.facility) return false;
    for (const [k, v] of Object.entries(P.cost)) if (s.res[k] < v) return false;
    for (const [k, v] of Object.entries(P.cost)) s.res[k] -= v;
    s.project = { id, progress: 0 };
    return true;
  }
  function availableProjects(s) {
    return Object.entries(D.PROJECTS).filter(([id, P]) => {
      if (P.hidden && !s.flags.repair_open) return false;
      if (id === 'repair' && s.flags.passage_secured) return false;
      if (P.group === 'living' && s.facility) return false;
      return true;
    }).map(([id, P]) => ({ id, name: P.name, desc: P.desc, cost: P.cost, work: P.work, afford: Object.entries(P.cost).every(([k, v]) => s.res[k] >= v) }));
  }

  // ── 저녁·밤·다음 날 ──
  function endDay(s) {
    if (s.phase !== 'morning') return false;
    s.lastPlan = {}; for (const r of alive(s)) if (s.plan[r.id]) s.lastPlan[r.id] = s.plan[r.id];
    const due = s.promises.filter((p) => p.due <= s.day).sort((a, b) => a.due - b.due)[0];
    const sid = D.STORY.evenings[s.day];
    s.evening = sid && !s.storyDone[sid] ? { type: 'promise', id: sid } : due ? { type: 'promise', id: due.id } : { type: 'talk' };
    s.phase = 'evening';
    return true;
  }
  function eveningChoose(s, i) {
    if (s.phase !== 'evening' || !s.evening || s.evening.type !== 'promise') return false;
    const pr = D.PROMISES[s.evening.id];
    const ch = pr.choices[i];
    if (!ch || choiceState(s, ch, 'station').locked) return false;
    const id = s.evening.id;
    const kept = s.promises;
    s.promises = s.promises.filter((p) => p.id !== id);   // 먼저 지워야 '기다려 달라'가 같은 약속을 다시 예약할 수 있다
    const res = runChoice(s, pr, i, 'station', false);
    if (!res) { s.promises = kept; return false; }
    if (pr.story) {
      s.storyDone[id] = true;
      s.history.push({ day: s.day, text: `${pr.title}: ${ch.text}` });
      if (id === 'story_voice' || id === 'story_ticket') s.godSeen.termia = (s.godSeen.termia || 0) + 1;   // 검표원의 규칙이 수첩에 적힌다
    }
    s.evening = { type: 'promiseResult', id, result: res };
    return true;
  }
  function talk(s, rid) {
    if (s.phase !== 'evening' || !s.evening || s.evening.type !== 'talk') return false;
    const r = byId(s, rid);
    if (!r || r.status !== 'home' || s.expParty.includes(rid)) return false;
    const story = D.PEOPLE[rid].story;
    const line = story[Math.min(r.talks, story.length - 1)];
    const delta = Math.max(0, 8 - traitVal(r, 'talkEase'));
    r.stress = clamp(r.stress - delta, 0, 100);
    r.trust = clamp(r.trust + 1, 0, 4);
    let extra = '';
    if (r.talks === 2) { r.skills[D.PEOPLE[rid].perk] += 1; extra = ' 기술 +1'; }
    r.talks += 1;
    memo(r, s.day, `저녁에 이야기를 나눴다.`);
    addAttention(s, 'ho', 1, '저녁 대화');
    s.evening = { type: 'talkResult', rid, line, extra, delta };
    return true;
  }
  function eveningDone(s) {
    if (s.phase !== 'evening' || !s.evening) return false;
    if (s.evening.type === 'promise') return false;           // 약속은 반드시 선택
    if (s.evening.type === 'promiseResult') {
      const nxt = s.promises.filter((p) => p.due <= s.day).sort((a, b) => a.due - b.due)[0];
      if (nxt) { s.evening = { type: 'promise', id: nxt.id }; return true; }
    }
    s.evening = null;
    return runNight(s);
  }
  function skipTalk(s) { if (s.phase !== 'evening' || !s.evening || s.evening.type !== 'talk') return false; s.evening = null; return runNight(s); }

  // 스트레스 100: 드물게 각성, 대개는 무너진다 (종류마다 다른 대가)
  function crack(s, r) {
    const called = !!s.flags.ho_call;
    if (called) delete s.flags.ho_call;
    if (called || (!r.virtue && rand(s) < D.VIRTUE.chance)) {
      r.virtue = true; r.stress = 35;
      for (const o of alive(s)) if (o.id !== r.id) o.stress = clamp(o.stress - 5, 0, 100);
      say(s, `${fillText(D.VIRTUE.text, [r.name])} — 각성: ${D.VIRTUE.name} (${D.VIRTUE.desc}) · 모두 스트레스 −5`, 'good');
      memo(r, s.day, '한계에서 버텨 냈다.', true);
      s.history.push({ day: s.day, text: `${r.name}: 각성 — ${D.VIRTUE.name}` });
      return;
    }
    const others = alive(s).filter((o) => o.id !== r.id);
    const id = pick(s, Object.keys(D.AFFLICTIONS).filter((k) => !D.AFFLICTIONS[k].hurtOther || others.length));
    const A = D.AFFLICTIONS[id];
    const victim = A.hurtOther ? pick(s, others) : null;
    r.affl = id; r.breakdown = A.days; r.stress = 80;
    const fx = [];
    let scar = '';
    if (A.food) { const lost = Math.min(s.res.food, -A.food); s.res.food -= lost; fx.push(`식량 −${lost}`); }
    if (A.others) { for (const o of others) o.stress = clamp(o.stress + A.others, 0, 100); fx.push(`모두 스트레스 +${A.others}`); }
    if (victim) { scar = injure(s, victim, A.hurtOther); fx.push(`${victim.name} 부상 ${A.hurtOther}`); memo(victim, s.day, `${r.name}에게 맞았다.`, true); }
    if (A.hurtSelf) { scar = injure(s, r, A.hurtSelf); fx.push(`${r.name} 부상 ${A.hurtSelf}`); }
    say(s, `${fillText(A.text, [r.name, victim ? victim.name : r.name])} — 붕괴: ${A.name} (${fx.join(' · ')}${fx.length ? ' · ' : ''}${A.days}일간 일 못 함)`, 'bad');
    say(s, scar, 'bad');
    memo(r, s.day, `한계에 닿아 무너졌다 (${A.name}).`, true);
    s.history.push({ day: s.day, text: `${r.name}: 붕괴 — ${A.name}` });
  }

  function runNight(s) {
    s.report = [];
    s.stats.nights += 1;
    const ev = evalPlan(s);
    const plan = ev.plan;
    s.dark = ev.dark;
    s.nightPlan = Object.assign({}, plan);
    s.guardIds = alive(s).filter((r) => plan[r.id] === 'guard').map((r) => r.id);
    // 1) 생산·소모
    s.forage -= ev.poolUse; s.salvageLeft -= ev.salvageUse;
    const prod = { food: ev.d.food, water: ev.d.water, parts: ev.d.parts };
    for (const h of ev.heals) {
      const p = byId(s, h.pid);
      s.res.meds -= 1;
      p.injury = Math.max(0, p.injury - h.amount);
      if (p.injury < 3) p.crit = null;
    }
    s.res.food += prod.food - ev.consume.food; s.res.water += prod.water - ev.consume.water; s.res.parts += prod.parts;
    const home = homeRes(s).filter((r) => !s.expParty.includes(r.id));
    const shortFood = Math.max(0, -s.res.food), shortWater = Math.max(0, -s.res.water);
    s.res.food = clamp(s.res.food, 0, D.CAP.food); s.res.water = clamp(s.res.water, 0, D.CAP.water); s.res.parts = clamp(s.res.parts, 0, D.CAP.parts);
    const made = [];
    if (prod.food) made.push(`식량 +${prod.food}`); if (prod.water) made.push(`물 +${prod.water}`); if (prod.parts) made.push(`부품 +${prod.parts}`);
    say(s, `일과: ${made.join(' · ') || '생산 없음'} / 소모: 식량 −${ev.consume.food} · 물 −${ev.consume.water}`);
    for (const n of ev.notes) say(s, n, 'warn');
    if (shortFood > 0) say(s, `식량이 바닥났다. 빈 깡통 바닥을 손가락으로 훑는 소리만 들린다. 모두 스트레스 +8`, 'bad');
    if (shortWater > 0) say(s, `물이 떨어졌다. 누군가 바닥에 고인 녹물을 핥았다. 모두 스트레스 +10`, 'bad');
    for (const r of home) {
      if (shortFood > 0) { r.stress = clamp(r.stress + 8, 0, 100); r.hunger += 1; if (r.hunger >= 2) { const sc = injure(s, r, 1); r.hunger = 0; say(s, `${J(r.name, '이/가')} 허기에 쓰러졌다. 광대뼈가 살갗을 뚫고 나올 것 같다. 부상 1`, 'bad'); say(s, sc, 'bad'); } } else r.hunger = 0;
      if (shortWater > 0) { r.stress = clamp(r.stress + 10, 0, 100); r.thirst += 1; if (r.thirst >= 1) { const sc = injure(s, r, 1); r.thirst = 0; say(s, `${r.name}의 입술이 갈라져 피가 맺혔다. 일어서지 못한다. 부상 1`, 'bad'); say(s, sc, 'bad'); } } else r.thirst = 0;
    }
    // 2) 침수·노출
    const surge = s.day === D.CALENDAR.surge.day ? 3 : 0;
    s.flood = clamp(s.flood + ev.d.flood + floodAuto(s.day) + surge, 0, 8);
    s.exposure = clamp(s.exposure + ev.d.exposure, 0, 8);
    if (surge) {
      say(s, D.CALENDAR.surge.text, 'warn');
      if (s.flood >= 8) say(s, '대비가 모자랐다. 물이 바닥까지 찼다.', 'bad');
      else if (s.flood >= FLOOD_POWER_STOP) say(s, `물이 발전기 자리까지 올라왔다. 침수 ${s.flood} — 발전기가 잠겨 내일 전력이 끊긴다. 배수로 물을 빼야 다시 돌린다.`, 'bad');
      else say(s, `미리 물을 빼 둔 덕에 발전기까지 닿지 않았다. 침수 ${s.flood}.`, 'good');
    }
    say(s, `침수 ${s.flood}/8 · 노출 ${s.exposure}/8`);
    {
      const o = { surge: !!surge, flood: s.flood, exposure: s.exposure, shortFood: shortFood > 0, foodAfter: s.res.food, people: ev.people, guards: s.guardIds.length, lit: !ev.dark };
      for (const x of godNightDelta(s, o)) { const g = addAttention(s, x.id, x.n, x.why); if (g) say(s, g, x.n > 0 && D.GODS[x.id].kind === 'hostile' ? 'warn' : ''); }
      if (!ev.dark) s.litNights = (s.litNights || 0) + 1;
      s.litStreak = ev.dark ? 0 : ((s.litStreak || 0) + 1 >= 3 ? 0 : (s.litStreak || 0) + 1);
    }
    if (ev.dark) say(s, '발전기가 돌지 않았다. 역 전체가 어둠에 잠겼다. 모두 스트레스 +4 · 밤 사건 판정 −10%p', 'warn');
    if (ev.sobbing) say(s, `밤새 흐느끼는 소리가 이어졌다. 모두 스트레스 +${ev.sobbing * D.AFFLICTIONS.despair.ambient}`, 'warn');
    if (s.exposure >= 6 && (s.visitDay == null || s.visitDay > s.day + 1)) { s.visitDay = s.day + 1; say(s, '노출이 높다. 내일 밤 순찰대가 올 것 같다.', 'warn'); }
    // 3) 공사
    if (s.project && ev.progress > 0) {
      s.project.progress += ev.progress;
      const P = D.PROJECTS[s.project.id];
      if (s.project.progress >= P.work) {
        say(s, P.done, 'good');
        if (P.group === 'living') s.facility = s.project.id;
        if (s.project.id === 'repair') { s.flags.passage_secured = true; s.flood = clamp(s.flood - 2, 0, 8); }
        s.project = null;
      } else say(s, `${P.name} 공사 ${s.project.progress}/${P.work}`);
    }
    // 4) 스트레스·부상·사망
    for (const r of alive(s)) {
      let t = plan[r.id];
      if (t === 'exp') continue;
      if (ev.idle.includes(r.id)) t = 'rest';                  // 전력·약품이 없어 일을 못 한 사람은 쉰다
      if (t === 'rest') {
        r.stress = clamp(r.stress - Math.max(0, 16 - traitVal(r, 'restLess')) + ev.ambient, 0, 100);
        if (r.injury === 1) r.injury = 0;
      } else r.stress = clamp(r.stress + D.TASKS[t].stress + traitVal(r, 'workStress') + ev.ambient, 0, 100);
      if (r.breakdown > 0) { r.breakdown -= 1; if (r.breakdown === 0) r.affl = null; }
      else if (r.stress >= 100 || (r.stress >= EDGE && rand(s) < (r.stress - EDGE + 5) / 25)) crack(s, r);
    }
    // 감염: 경상인 채로 일을 하면 상처가 곪는다
    for (const r of alive(s)) {
      const t = ev.idle.includes(r.id) ? 'rest' : plan[r.id];
      if (r.injury === 1 && t && t !== 'rest' && t !== 'exp' && rand(s) < INFECT) {
        const sc = injure(s, r, 1);
        say(s, `${r.name}의 상처가 곪았다. 붕대 밑에서 누런 진물이 배어 나온다. 중상`, 'bad'); say(s, sc, 'bad');
      }
    }
    const healed = new Set(ev.heals.map((h) => h.pid));
    for (const r of alive(s)) {
      if (r.injury >= 2 && r.injury < 3 && !healed.has(r.id)) {
        r.untreated = (r.untreated || 0) + 1;
        if (r.untreated >= 1) { const sc = injure(s, r, 1); r.untreated = 0; say(s, `${r.name}의 상처가 썩어 들어간다. 붕대를 풀자 구더기가 꿈틀거렸다. 위독 — 내일 밤까지 치료하지 못하면 죽는다.`, 'bad'); say(s, sc, 'bad'); }
      } else r.untreated = 0;
    }
    for (const r of alive(s)) if (r.injury >= 3 && r.crit != null && s.day >= r.crit) kill(s, r, '치료받지 못했다');
    if (!alive(s).length) return finishGame(s, 'wiped');
    // 5) 이야기 뼈대: 그날 확정된 신의 징조 (이미 겪었으면 건너뛴다)
    const og = D.STORY.omens[s.day];
    if (og && !s.godSeen[og] && !s.godQueue.some((x) => x.god === og)) {
      s.gods[og] = Math.max(s.gods[og] || 0, GOD_OMEN);
      s.godQueue.unshift({ god: og, kind: 'omen' });
    }
    // 6) 밤 사건
    s.nightEv = nextNightEvent(s);
    if (s.nightEv) { s.phase = 'nightEvent'; return true; }
    return advanceDay(s);
  }
  // 사건 문장의 {who}/{who2} 자리에 주민 이름을 넣는다. {who:이/가} 처럼 조사도 맞춘다.
  function fillNames(obj, names) { return JSON.parse(fillText(JSON.stringify(obj), names)); }
  function nextNightEvent(s) {
    if (s.flood >= 8) return { id: 'flood_break', ev: D.FLOOD_BREAK, threat: true };
    if (s.visitDay === s.day) return { id: 'patrol', ev: D.PATROL, threat: true };
    if (s.corpses && s.corpses.length) return { id: 'corpse', ev: fillNames(D.CORPSE, [s.corpses[0].name]), who: [], threat: false };
    while (s.godQueue && s.godQueue.length) {
      const q = s.godQueue[0];
      const G = D.GODS[q.god], src = G && G[q.kind];
      if (!src || (q.god === 'ho' && s.flags.ho_gone)) { s.godQueue.shift(); continue; }
      const people = homeRes(s);
      if (!people.length) { s.godQueue.shift(); continue; }
      const who = [];
      if (q.god === 'gurmah') { const h = people.slice().sort((a, b) => (b.hunger - a.hunger) || (b.stress - a.stress))[0]; who.push(h.id); }
      while (who.length < (src.who || 0) && who.length < people.length) { const p = pick(s, people); if (!who.includes(p.id)) who.push(p.id); }
      const names = who.map((id) => byId(s, id).name);
      return { id: 'god', god: q.god, kind: q.kind, ev: names.length ? fillNames(src, names) : JSON.parse(JSON.stringify(src)), who, threat: G.kind === 'hostile' };
    }
    const cand = Object.entries(D.NIGHT).map(([id, n]) => [id, n, typeof n.weight === 'function' ? n.weight(s) : n.weight]).filter(([id, n, w]) => s.day >= n.minDay && id !== s.lastNight && w > 0);
    if (!cand.length) return null;
    const total = cand.reduce((a2, [, , w]) => a2 + w, 0);
    let r = rand(s) * total, chosen = cand[0];
    for (const c of cand) { r -= c[2]; if (r <= 0) { chosen = c; break; } }
    const [id, n] = chosen;
    const people = homeRes(s);
    const who = [];
    for (let i = 0; i < (n.who || 0) && people.length > who.length; i++) {
      let p; do { p = pick(s, people); } while (who.includes(p.id));
      who.push(p.id);
    }
    const ev = who.length ? fillNames(n, who.map((x) => byId(s, x).name)) : JSON.parse(JSON.stringify(n));   // 상태에는 함수 없는 순수 데이터만 둔다
    return { id, ev, who, threat: false };
  }
  function nightChoose(s, i) {
    if (s.phase !== 'nightEvent' || !s.nightEv || s.nightEv.result) return false;
    const res = runChoice(s, s.nightEv.ev, i, 'station', s.nightEv.threat);
    if (!res) return false;
    s.nightEv.result = res;
    s.history.push({ day: s.day, text: `${s.nightEv.ev.title}: ${res.choice}` });
    if (s.nightEv.id === 'patrol') s.visitDay = s.day < D.CALENDAR.patrol.day ? D.CALENDAR.patrol.day : null;
    else if (s.nightEv.id === 'corpse') s.corpses.shift();
    else if (s.nightEv.id === 'god') {
      s.godQueue.shift();
      s.godSeen[s.nightEv.god] = (s.godSeen[s.nightEv.god] || 0) + 1;
      if (s.nightEv.kind === 'advent') s.gods[s.nightEv.god] = GOD_AFTER;
    }
    else if (D.NIGHT[s.nightEv.id]) s.lastNight = s.nightEv.id;
    return true;
  }
  function nightDone(s) {
    if (s.phase !== 'nightEvent' || !s.nightEv || !s.nightEv.result) return false;
    // 수위 경보에 가려진 순찰대는 같은 밤에 이어서 온다
    if (s.nightEv.id !== 'patrol' && s.visitDay === s.day) { s.nightEv = { id: 'patrol', ev: D.PATROL, threat: true }; return true; }
    s.nightEv = null;
    return advanceDay(s);
  }
  function advanceDay(s) {
    s.dark = false;
    for (const r of alive(s)) if (r.injury >= 3 && r.crit != null && s.day >= r.crit && r.status !== 'dead') kill(s, r, '치료받지 못했다');
    if (!alive(s).length) return finishGame(s, 'wiped');
    if (s.day >= D.GOAL_DAY) return enterBoarding(s);
    s.day += 1;
    for (const k of ['A', 'B']) if (s.closed[k] > 0) s.closed[k] -= 1;
    s.expParty = []; s.expDone = false; s.guardIds = [];
    s.plan = {};
    for (const r of alive(s)) if (s.lastPlan[r.id] && !taskBlock(s, r, s.lastPlan[r.id])) s.plan[r.id] = s.lastPlan[r.id];
    s.phase = 'morning';
    return true;
  }

  // ── 승차와 결말 ──
  function enterBoarding(s) {
    const info = trainInfo(s);
    const pool = boardingPool(s);
    const trust = (p) => (p.kind === 'ally' ? 5 : byId(s, p.id).trust);
    const order = pool.slice().sort((x, y) => trust(y) - trust(x));
    s.boarding = { pool, cap: info.cap, supplyCap: info.supplyCap, passage: info.passage, picks: order.slice(0, info.cap).map((p) => p.id), self: false };
    s.phase = 'boarding';
    return true;
  }
  function toggleBoard(s, id) {
    const b = s.boarding;
    if (s.phase !== 'boarding' || !b || !b.pool.some((p) => p.id === id)) return false;
    const i = b.picks.indexOf(id);
    if (i >= 0) b.picks.splice(i, 1); else if (b.picks.length + (b.self ? 1 : 0) < b.cap) b.picks.push(id); else return false;
    return true;
  }
  // 명부의 첫 이름은 당신이다. 타면 자리 하나를 쓴다
  function boardSelf(s) {
    const b = s.boarding;
    if (s.phase !== 'boarding' || !b || b.cap === 0) return false;
    if (b.self) { b.self = false; return true; }
    if (b.picks.length + 1 > b.cap) return false;
    b.self = true;
    return true;
  }
  function confirmBoarding(s) {
    if (s.phase !== 'boarding') return false;
    if (s.boarding.cap > 0 && s.boarding.picks.length === 0 && !s.boarding.self) return false;      // 아무도 태우지 않는 선택은 없다
    return finishGame(s, 'train');
  }
  function closingLine(r) {
    if (!r) return '';
    const keys = r.mem.filter((m) => m.key);
    return keys.length ? keys[keys.length - 1].text : `바람: ${D.PEOPLE[r.id].wish}`;
  }
  function finishGame(s, kind) {
    const rows = [];
    let tier = 'wiped', title = '꺼진 역', text = '역에는 아무도 남지 않았다.';
    if (kind === 'train') {
      const b = s.boarding;
      const boarded = b.picks.length, total = D.START_PEOPLE.length + b.pool.filter((p) => p.kind === 'ally').length;   // 죽은 사람도 분모에 포함
      for (const p of b.pool) {
        const r = p.kind === 'resident' ? byId(s, p.id) : null;
        rows.push({ name: p.name, status: b.picks.includes(p.id) ? 'boarded' : 'stayed', line: p.kind === 'ally' ? '약속을 지켜 준 사람.' : closingLine(r) });
      }
      rows.unshift({ name: '당신', status: b.self ? 'boarded' : 'stayed', line: b.self ? '명부의 첫 줄. 펀치 자국이 난 손으로 손잡이를 잡았다.' : '명부의 첫 줄. 승강장에 남아 떠나는 불빛을 셌다.' });
      if (b.cap === 0 && b.passage) { tier = 'missed'; title = '비어 있는 열차'; text = '통로는 이어졌지만 식량과 물이 모자랐다. 한 사람도 열차에 태울 수 없었다. 이번 시연은 여기까지예요.'; }
      else if (b.cap === 0) { tier = 'missed'; title = '지나간 열차'; text = '열차는 고지대 역까지 닿지 못했다. 끊긴 통로 앞에서 불빛은 멀어졌다. 이번 시연은 여기까지예요.'; }
      else if (s.flags.hospital_pact && boarded >= Math.ceil(total * 0.75)) { tier = 'safe'; title = '열린 길'; text = '열차는 병원 팀이 맞이하는 고지대 역에 닿았다. 따뜻한 수프와 침상이 기다리고 있었다.'; }
      else if (boarded >= Math.ceil(total * 0.5)) { tier = 'half'; title = '절반의 승차'; text = '열차는 고지대 역에 닿았지만 모두를 태우지는 못했다. 남은 사람들은 다음 열차를 기다린다.'; }
      else { tier = 'thin'; title = '먼 길'; text = '몇 사람만 열차에 올랐다. 역에 남은 불빛이 오래도록 흔들렸다.'; }
    } else {
      for (const r of s.residents) rows.push({ name: r.name, status: 'dead', line: closingLine(r) });
    }
    for (const r of s.residents) if (r.status === 'dead' && !rows.some((x) => x.name === r.name)) rows.push({ name: r.name, status: 'dead', line: closingLine(r) });
    const ledger = [];
    if (s.flags.hospital_pact) ledger.push({ kind: 'kept', text: '병원과 협정을 맺었다 (문은채)' });
    if (s.flags.passage_secured) ledger.push({ kind: 'kept', text: '지하 통로를 이었다 (권도현)' });
    if (s.flags.pact_refused) ledger.push({ kind: 'broken', text: '병원과의 협정을 거절했다' });
    if (s.flags.repair_refused) ledger.push({ kind: 'broken', text: '통로 공동 수리 제안을 거절했다' });
    if (s.flags.ate_dead) ledger.push({ kind: 'broken', text: '죽은 동료의 살을 먹었다' });
    if (s.flags.skipped_eunchae) ledger.push({ kind: 'broken', text: '약국의 도움 요청을 지나쳤다' });
    if (s.flags.skipped_dohyeon && !s.flags.met_dohyeon) ledger.push({ kind: 'broken', text: '침수된 통로의 외침을 지나쳤다' });
    for (const p of s.promises) ledger.push({ kind: 'late', text: `${(D.PROMISES[p.id] || {}).title || p.id} — 열차 시간 안에 지키지 못했다` });
    if (s.flags.repair_open && !s.flags.passage_secured) ledger.push({ kind: 'late', text: '통로 수리를 끝내지 못했다' });
    if (s.flags.ate_dead && kind === 'train') text += ' 열차 안에서 아무도 서로의 얼굴을 보지 않았다.';
    if (kind === 'train' && s.boarding.cap > 0) text += s.boarding.self
      ? ' 문이 닫히기 직전, 승강장 쪽 안개 속에서 누군가 당신의 이름을 불렀다. 당신은 대답하지 않았다.'
      : ' 당신은 타지 않았다. 열차가 떠난 뒤, 수첩의 첫 줄 아래에 새 빈칸이 하나 생겨 있었다.';
    s.ending = { tier, title, text, rows, ledger, day: s.day, flags: Object.assign({}, s.flags), self: !!(s.boarding && s.boarding.self) };
    s.phase = 'ended';
    return true;
  }

  // ── 추천 배치 (화면의 [추천 배치] 버튼과 봇이 함께 사용; 화면에 보이는 정보만 씀) ──
  function suggestPlan(s) {
    const plan = {};
    const free = alive(s).filter((r) => !s.expParty.includes(r.id) && r.injury < 2 && r.breakdown <= 0);
    const take = (task, n, key) => {
      for (let i = 0; i < n; i++) {
        const cand = free.filter((r) => !plan[r.id] && !taskBlock(s, r, task)).sort((a, b) => b.skills[key || D.TASKS[task].skill] - a.skills[key || D.TASKS[task].skill] || a.stress - b.stress);
        if (!cand.length) return;
        plan[cand[0].id] = task;
      }
    };
    const people = 1 + alive(s).length - s.expParty.length;
    const need = Math.ceil(people * 0.5);
    const foodShort = s.res.food < need * 2 + 2;
    const waterShort = s.res.water < need * 2 + 2;
    const floodStop = s.flood >= FLOOD_POWER_STOP;
    // 1) 사람 목숨과 공사가 먼저
    const patients = alive(s).filter((r) => r.injury >= 2);
    if (patients.length && s.res.meds >= 1) take('tend', patients.length > 1 && s.facility === 'clinic' ? 1 : 1);
    if (s.project) take('build', 2);
    // 2) 침수가 5 이상이면 발전기가 잠기니 배수가 먼저
    if (floodStop) take('drain', 2); else if (s.flood >= 3) take('drain', 1);
    // 3) 물·식량·전력
    const tense = alive(s).some((r) => r.stress >= 45);
    const wantPower = !floodStop && ((waterShort ? 1 : 0) + (s.facility === 'farm' ? 1 : 0) + (s.facility === 'clinic' && patients.length ? 1 : 0) + (tense ? 1 : 0));
    if (wantPower > 0) take('gen', 1);
    const powered = Object.values(plan).includes('gen');
    if (powered && waterShort) take('pump', 2); else if (powered && s.res.water < need * 3) take('pump', 1);
    if (s.facility === 'farm' && powered) take('farm', 2);
    if (s.forage > 0 && (foodShort || s.res.food < need * 4)) take('forage', 2);
    if (s.exposure >= 4 || (s.visitDay != null && s.visitDay - s.day <= 1)) take('guard', s.visitDay != null && s.visitDay === s.day ? 2 : 1);
    // 스트레스 높은 사람은 쉬게 한다
    for (const r of free) if (!plan[r.id] && r.stress >= 55) plan[r.id] = 'rest';
    if (s.salvageLeft > 0 && s.res.parts < 6) take('salvage', 1);
    for (const r of free) if (!plan[r.id]) plan[r.id] = 'rest';
    return plan;
  }

  // 추천 배치의 이유 한 줄 (같은 배치를 세어 말로 풀어 줌)
  function suggestWhy(s) {
    const plan = suggestPlan(s);
    const n = (t) => Object.values(plan).filter((x) => x === t).length;
    const out = [];
    if (n('tend')) out.push('부상자 치료');
    if (n('build')) out.push(s.project && s.project.id === 'repair' ? '통로 공사' : '공사 진행');
    if (n('drain')) out.push(s.flood >= FLOOD_POWER_STOP ? `침수 ${s.flood}라 발전기가 잠겨 배수 ${n('drain')}명` : `침수 ${s.flood} 낮추기`);
    if (n('gen') || n('pump')) out.push(s.res.water < 8 ? '물이 모자라 발전·펌프' : n('pump') ? '전력·물 확보' : '불을 켜 어둠 막기');
    if (n('farm')) out.push('재배실 가동');
    if (n('forage')) out.push('식량 확보');
    if (n('guard')) out.push(s.visitDay != null && s.visitDay - s.day <= 1 ? '순찰대 대비 경계' : '노출 낮추기 경계');
    if (n('salvage')) out.push('부품 모으기');
    const rest = n('rest');
    if (rest) out.push(`나머지 ${rest}명 휴식`);
    return out.slice(0, 4).join(' · ');
  }

  // ── 프롤로그 ──
  function proChoose(s, i) {
    if (s.phase !== 'prologue' || s.proResult) return false;
    const sc = D.PROLOGUE[s.pro];
    const ch = sc && sc.choices[i];
    if (!ch) return false;
    const o = ch.out;
    if (o.res) for (const [k, v] of Object.entries(o.res)) addRes(s, k, v);
    if (o.item) s.items[o.item] = true;
    if (o.flag) s.flags[o.flag] = true;
    if (o.stressAll) for (const r of s.residents) r.stress = clamp(r.stress + o.stressAll, 0, 100);
    if (o.trust) for (const [id, n] of Object.entries(o.trust)) { const r = byId(s, id); if (r) r.trust = clamp(r.trust + n, 0, 4); }
    s.history.push({ day: 0, text: `${sc.title}: ${ch.text}` });
    s.proResult = { choice: ch.text, text: o.text, lines: describeOutcome(o).concat(o.item ? [`${D.ITEMS[o.item]} 획득`] : []) };
    return true;
  }
  function proNext(s) {
    if (s.phase !== 'prologue' || !s.proResult) return false;
    s.proResult = null;
    if (s.pro + 1 >= D.PROLOGUE.length) { s.phase = 'morning'; s.report = []; say(s, '역에서의 첫날이 밝았다. 열차는 열흘 뒤에 온다.'); s.plan = suggestPlan(s); }
    else s.pro += 1;
    return true;
  }

  // ── 단일 진입점 ──
  const hasOwn = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const isIdx = (v) => Number.isInteger(v) && v >= 0 && v < 20;
  function dispatch(s, a) {
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') return { ok: false, error: '잘못된 동작' };
    let ok = false;
    switch (a.type) {
      case 'proChoose': if (!isIdx(a.i)) break; ok = proChoose(s, a.i); break;
      case 'proNext': ok = proNext(s); break;
      case 'assign': {
        if (!hasOwn(D.TASKS, a.task) || typeof a.rid !== 'string') break;
        const r = byId(s, a.rid);
        if (s.phase !== 'morning' || !r || r.status !== 'home' || s.expParty.includes(a.rid)) break;
        const opt = taskOptions(s, a.rid).find((o) => o.id === a.task);
        if (!opt || opt.disabled) break;
        s.plan[a.rid] = a.task; ok = true; break;
      }
      case 'setPlan': {
        if (s.phase !== 'morning' || (a.plan != null && typeof a.plan !== 'object')) break;
        s.plan = {};
        for (const [rid, t] of Object.entries(a.plan || {})) { const r = byId(s, rid); if (r && hasOwn(D.TASKS, t) && r.status === 'home' && !s.expParty.includes(rid) && !taskBlock(s, r, t) && slotsLeft(s, t, s.plan) > 0) s.plan[rid] = t; }
        ok = true; break;
      }
      case 'startProject': if (!hasOwn(D.PROJECTS, a.id)) break; ok = startProject(s, a.id); break;
      case 'expStart': {
        const pk = a.pack && typeof a.pack === 'object' ? a.pack : {};
        if (!hasOwn(D.REGIONS, a.region) || !Array.isArray(a.party) || (pk.items != null && (!Array.isArray(pk.items) || !pk.items.every((i) => hasOwn(D.ITEMS, i))))) break;
        ok = expStart(s, a.region, a.party, pk); break;
      }
      case 'expChoose': if (!isIdx(a.i)) break; ok = expChoose(s, a.i); break;
      case 'expNext': if (typeof a.mode !== 'string') break; ok = expNext(s, a.mode); break;
      case 'expFight': if (typeof a.result !== 'string') break; ok = expFight(s, a.result, a.wounds); break;
      case 'endDay': ok = endDay(s); break;
      case 'eveningChoose': if (!isIdx(a.i)) break; ok = eveningChoose(s, a.i); break;
      case 'talk': if (typeof a.rid !== 'string') break; ok = talk(s, a.rid); break;
      case 'skipTalk': ok = skipTalk(s); break;
      case 'eveningDone': ok = eveningDone(s); break;
      case 'nightChoose': if (!isIdx(a.i)) break; ok = nightChoose(s, a.i); break;
      case 'nightDone': ok = nightDone(s); break;
      case 'board': if (typeof a.id !== 'string') break; ok = toggleBoard(s, a.id); break;
      case 'confirmBoarding': ok = confirmBoarding(s); break;
      case 'boardSelf': ok = boardSelf(s); break;
      default: return { ok: false, error: '알 수 없는 동작' };
    }
    return { ok, error: ok ? '' : '지금은 할 수 없는 동작' };
  }

  // ── 저장 데이터 정규화 ──
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_V) return null;
    const base = newGame(raw.seed || 1);
    const s = Object.assign(base, raw);
    for (const k of ['res', 'closed', 'flags', 'items', 'allies', 'plan', 'lastPlan', 'stats']) s[k] = Object.assign({}, base[k], raw[k] || {});
    for (const k of Object.keys(D.CAP)) if (typeof s.res[k] !== 'number' || !isFinite(s.res[k])) s.res[k] = 0;
    if (!Array.isArray(s.residents) || !s.residents.length) s.residents = base.residents;
    for (const k of ['report', 'log', 'history', 'promises', 'expParty', 'corpses', 'godQueue', 'buried']) if (!Array.isArray(s[k])) s[k] = [];
    s.gods = Object.assign({}, base.gods, raw.gods || {});
    for (const k of Object.keys(s.gods)) if (!Number.isFinite(s.gods[k])) s.gods[k] = 0;
    if (!s.godSeen || typeof s.godSeen !== 'object') s.godSeen = {};
    if (!s.storyDone || typeof s.storyDone !== 'object') s.storyDone = {};
    for (const k of ['litStreak', 'litNights', 'seatMod', 'noDarkUntil']) if (!Number.isFinite(s[k])) s[k] = 0;
    if (typeof s.rng !== 'number') s.rng = s.seed >>> 0;
    // 상태 구조가 어긋난 저장은 쓰지 않는다 (불러오면 화면이 깨지므로 새 게임으로)
    const need = { expedition: s.exp, evening: s.evening, nightEvent: s.nightEv, boarding: s.boarding, ended: s.ending };
    if (Object.prototype.hasOwnProperty.call(need, s.phase) && !need[s.phase]) return null;
    if (!['prologue', 'morning', 'expedition', 'evening', 'nightEvent', 'boarding', 'ended'].includes(s.phase)) return null;
    for (const r of s.residents) { for (const k of ['stress', 'injury', 'trust', 'talks', 'hunger', 'thirst', 'breakdown']) if (!Number.isFinite(r[k])) r[k] = 0; if (!Array.isArray(r.mem)) r.mem = []; if (!Array.isArray(r.scars)) r.scars = []; if (r.affl && !D.AFFLICTIONS[r.affl]) r.affl = null; r.virtue = !!r.virtue; }
    return s;
  }

  const API = {
    D, SAVE_V, EDGE, NORMAL_HOURS, MAX_HOURS, BASE_LOAD, STRESS_LIMIT_EXP, FLOOD_POWER_STOP, BOARD_PER, BOARD_LITTER, BOARD_LITTER_MAX, J, josa, trainInfo, choiceTags,
    newGame, dispatch, normalize, rand,
    alive, homeRes, byId, traitVal, hasTag, noExp, fillText, injure, crack, addAttention, godLabel, godNightDelta, boundToFlame, GOD_OMEN, GOD_ADVENT, taskOptions, evalPlan, previewNight, effectivePlan, suggestPlan, suggestWhy, forecast, floodAuto,
    expView, canDepart, describeOutcome, choiceState, availableProjects, boardingPool, lootCap, resText, sf,
    nightView: (s) => (s.nightEv ? { title: s.nightEv.ev.title, text: s.nightEv.ev.text, choices: s.nightEv.ev.choices.map((c) => Object.assign({ choice: c }, choiceState(s, c, 'station'))), result: s.nightEv.result || null } : null),
    eveningView: (s) => {
      if (!s.evening) return null;
      if (s.evening.type === 'promise') { const p = D.PROMISES[s.evening.id]; return { type: 'promise', title: p.title, text: p.text, choices: p.choices.map((c) => Object.assign({ choice: c }, choiceState(s, c, 'station'))) }; }
      return s.evening;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DS2 = API;
})(this);
