// 어두운 역 — 게임 규칙 (화면과 분리, Node 테스트 가능)
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DS_DATA;

  const SAVE_VERSION = 1;
  const PROD_EVERY = 10;      // 생산·회복 주기(초)
  const FIRE_DECAY = 40;      // 불이 한 단계 약해지는 간격
  const CD = { stoke: 5, gather: 15, traps: 30 };
  const MAX_LOG = 60;
  const BED_CAP = 4;

  function newState() {
    const s = {
      v: SAVE_VERSION, time: 0,
      flags: {},
      fire: 0, fireDecayAt: 0, warmSec: 0, builderAt: 0, nextSurvivorAt: 0,
      res: { fuel: 5, scrap: 0, food: 0, water: 0, meds: 0, parts: 0 },
      buildings: {}, items: {}, pop: 0, workers: {},
      player: { hp: 10, maxHp: 10, mind: 10, maxMind: 10, skills: { obs: 1, str: 1, tech: 1, talk: 1 } },
      districts: {},
      cd: { stoke: 0, gather: 0, traps: 0 },
      expedition: null, ended: null,
      log: [], logSeq: 0,
    };
    log(s, '역사는 어둡고 춥다.');
    return s;
  }

  function log(s, text, kind) {
    if (!text) return;
    s.logSeq += 1;
    s.log.unshift({ id: s.logSeq, text, kind: kind || '' });
    if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
  }

  // ── 공용 ──
  const count = (s, id) => s.buildings[id] || 0;
  const popCap = (s) => count(s, 'bed') * BED_CAP;
  const assigned = (s) => Object.values(s.workers).reduce((a, b) => a + b, 0);
  const idle = (s) => Math.max(0, s.pop - assigned(s));
  const capacity = (s) => (s.items.backpack ? 35 : 20);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function canAfford(res, cost) {
    return Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v);
  }
  function pay(res, cost) {
    for (const [k, v] of Object.entries(cost)) res[k] = (res[k] || 0) - v;
  }
  function reqMet(s, req) {
    return !req || Object.entries(req).every(([k, v]) => count(s, k) >= v);
  }

  function buildCost(s, id) {
    const b = D.BUILDINGS[id];
    const n = count(s, id);
    const out = {};
    for (const [k, v] of Object.entries(b.cost)) out[k] = b.scale ? Math.round(v * Math.pow(1.3, n)) : v;
    return out;
  }
  function buildVisible(s, id) {
    const b = D.BUILDINGS[id];
    return !!s.flags.builderReady && reqMet(s, b.req) && (!b.reqFlag || !!s.flags[b.reqFlag]);
  }
  function canBuild(s, id) {
    return buildVisible(s, id) && count(s, id) < D.BUILDINGS[id].max && canAfford(s.res, buildCost(s, id));
  }
  function canCraft(s, id) {
    return count(s, 'workbench') > 0 && !s.items[id] && canAfford(s.res, D.ITEMS[id].cost);
  }
  function jobVisible(s, id) {
    return s.pop > 0 && reqMet(s, D.JOBS[id].req);
  }

  // ── 시간 진행 (1초) ──
  function tick(s, rng) {
    if (s.ended) return;
    s.time += 1;
    for (const k of Object.keys(s.cd)) if (s.cd[k] > 0) s.cd[k] -= 1;

    if (s.flags.fireLit) {
      const floor = s.flags.builderReady ? 1 : 0;   // 한 씨가 불씨를 지킨다
      if (s.time >= s.fireDecayAt) {
        if (s.fire > floor) {
          s.fire -= 1;
          log(s, s.fire === 0 ? '불이 꺼졌다.' : D.ROOM_TEXT[s.fire] + '.');
        }
        s.fireDecayAt = s.time + FIRE_DECAY;
      }
    }

    // 낯선 사람 → 건설
    if (s.flags.fireLit && !s.flags.strangerArrived) {
      if (s.fire >= 2) s.warmSec += 1;
      if (s.warmSec >= 20) {
        s.flags.strangerArrived = true;
        s.builderAt = s.time + 30;
        log(s, '불빛을 보고 누군가 계단을 내려왔다. 낡은 역무원 조끼를 입은 노인이 난로 옆에 쓰러진다.', 'event');
      }
    }
    if (s.flags.strangerArrived && !s.flags.builderReady && s.time >= s.builderAt) {
      if (s.fire >= 2) {
        s.flags.builderReady = true;
        s.nextSurvivorAt = s.time + 30;
        log(s, '노인이 몸을 일으킨다. "한 씨라고 불러요. 이 역 정비 담당이었지. 고철만 있으면 뭐든 만들어 주리다." 한 씨가 불을 지키기 시작한다.', 'event');
      } else {
        log(s, '노인은 아직 떨고 있다. 불이 더 필요하다.');
        s.builderAt = s.time + 20;
      }
    }

    // 생존자 도착
    if (s.flags.builderReady && popCap(s) > s.pop && s.fire >= 1 && s.time >= s.nextSurvivorAt) {
      const room = popCap(s) - s.pop;
      const n = Math.min(room, 1 + Math.floor(rng() * 3));
      s.pop += n;
      log(s, n === 1 ? '생존자 한 명이 불빛을 따라 내려왔다.' : `생존자 ${n}명이 불빛을 따라 내려왔다.`, 'event');
      s.nextSurvivorAt = s.time + 30 + Math.floor(rng() * 30);
    }

    if (s.time % PROD_EVERY === 0) produce(s, rng);
  }

  function produce(s, rng) {
    const r = s.res;
    if (s.pop > 0) {
      // 직업 생산 (재료 부족한 일꾼은 쉼)
      for (const [id, job] of Object.entries(D.JOBS)) {
        const n = s.workers[id] || 0;
        for (let i = 0; i < n; i++) {
          const inputs = Object.entries(job.prod).filter(([, v]) => v < 0);
          if (!inputs.every(([k, v]) => (r[k] || 0) >= -v)) break;
          for (const [k, v] of Object.entries(job.prod)) r[k] = (r[k] || 0) + v;
        }
      }
      r.fuel += idle(s) * 2;
      // 식량 소비: 3명당 1
      const eat = Math.ceil(s.pop / 3);
      if (r.food >= eat) r.food -= eat;
      else {
        r.food = 0;
        if (rng() < 0.5) {
          s.pop -= 1;
          trimWorkers(s);
          log(s, '굶주림을 못 견딘 생존자 한 명이 역을 떠났다.', 'bad');
        } else log(s, '식량이 바닥났다. 사람들이 배고파한다.', 'bad');
      }
    }
    // 역에 있을 때만 회복
    if (!s.expedition && s.fire >= 1) {
      const p = s.player;
      p.hp = Math.min(p.maxHp, p.hp + 1);
      p.mind = Math.min(p.maxMind, p.mind + 1);
    }
  }

  function trimWorkers(s) {
    let over = assigned(s) - s.pop;
    for (const id of Object.keys(s.workers)) {
      while (over > 0 && s.workers[id] > 0) { s.workers[id] -= 1; over -= 1; }
    }
  }

  // ── 역사 행동 ──
  function light(s) {
    if (s.flags.fireLit && s.fire > 0) return false;
    if (s.res.fuel < 5) { log(s, '땔감이 부족하다.'); return false; }
    s.res.fuel -= 5;
    s.flags.fireLit = true;
    s.fire = 2;
    s.fireDecayAt = s.time + FIRE_DECAY;
    log(s, '난로에 불이 붙었다. ' + D.ROOM_TEXT[2] + '.');
    return true;
  }
  function stoke(s) {
    if (!s.flags.fireLit || s.fire === 0 || s.cd.stoke > 0 || s.fire >= 4) return false;
    if (s.res.fuel < 1) { log(s, '땔감이 없다.'); return false; }
    s.res.fuel -= 1;
    s.fire += 1;
    s.fireDecayAt = s.time + FIRE_DECAY;
    s.cd.stoke = CD.stoke;
    log(s, D.FIRE_TEXT[s.fire] + '. ' + D.ROOM_TEXT[s.fire] + '.');
    return true;
  }
  function gather(s, rng) {
    if (!s.flags.fireLit || s.cd.gather > 0) return false;
    let fuel = 4 + Math.floor(rng() * 4);
    if (count(s, 'cart')) fuel = Math.round(fuel * 1.5);
    const scrap = 1 + Math.floor(rng() * 3);
    s.res.fuel += fuel;
    s.res.scrap += scrap;
    s.cd.gather = CD.gather;
    log(s, `어두운 선로를 더듬어 땔감 ${fuel}, 고철 ${scrap}을 주웠다.`);
    return true;
  }
  function checkTraps(s, rng) {
    const n = count(s, 'trap');
    if (!n || s.cd.traps > 0) return false;
    let food = 0, scrap = 0;
    for (let i = 0; i < n; i++) { if (rng() < 0.7) food += 1; if (rng() < 0.1) scrap += 1; }
    s.res.food += food; s.res.scrap += scrap;
    s.cd.traps = CD.traps;
    log(s, food ? `덫에 쥐 ${food}마리가 걸려 있었다.` + (scrap ? ` 고철 ${scrap}도 끼어 있다.` : '') : '덫은 비어 있다.');
    return true;
  }
  function build(s, id) {
    if (!canBuild(s, id)) return false;
    pay(s.res, buildCost(s, id));
    s.buildings[id] = count(s, id) + 1;
    log(s, D.BUILDINGS[id].msg);
    if (id === 'barricade') {
      s.flags.expeditions = true;
      s.districts.euljiro = { unlocked: true, cleared: false };
    }
    if (id === 'radio') {
      s.flags.radio = true;
      s.districts.namsan = { unlocked: true, cleared: false };
      log(s, D.RADIO_MSG, 'event');
    }
    return true;
  }
  function craft(s, id) {
    if (!canCraft(s, id)) return false;
    pay(s.res, D.ITEMS[id].cost);
    s.items[id] = true;
    log(s, `한 씨가 ${D.ITEMS[id].name}을(를) 만들어 건넨다.`);
    return true;
  }
  function assign(s, id, delta) {
    if (!jobVisible(s, id)) return false;
    const cur = s.workers[id] || 0;
    if (delta > 0 && idle(s) < 1) return false;
    if (delta < 0 && cur < 1) return false;
    s.workers[id] = cur + (delta > 0 ? 1 : -1);
    return true;
  }

  // ── 원정 ──
  function districtList(s) {
    return Object.keys(D.DISTRICTS).filter((id) => s.districts[id] && s.districts[id].unlocked);
  }
  function packLoad(exp) {
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    return sum(exp.pack) + sum(exp.loot);
  }
  function canStart(s, id, pack) {
    if (!s.flags.expeditions || s.expedition || s.ended) return '원정을 떠날 수 없다';
    if (!s.districts[id] || !s.districts[id].unlocked) return '아직 갈 수 없는 곳이다';
    if (s.player.hp < 4) return '몸이 너무 상했다 (체력 4 이상 필요)';
    if (s.player.mind < 3) return '정신이 너무 지쳤다 (정신력 3 이상 필요)';
    const total = (pack.food || 0) + (pack.water || 0) + (pack.meds || 0);
    if (total > capacity(s)) return '배낭이 넘친다';
    for (const k of ['food', 'water', 'meds']) {
      if ((pack[k] || 0) < 0 || (pack[k] || 0) > s.res[k]) return `${D.RES[k]}이(가) 부족하다`;
    }
    return '';
  }
  function startExpedition(s, id, pack, rng) {
    if (canStart(s, id, pack)) return false;
    const p = { food: pack.food || 0, water: pack.water || 0, meds: pack.meds || 0 };
    for (const k of Object.keys(p)) s.res[k] -= p[k];
    const d = D.DISTRICTS[id];
    const randoms = Object.keys(D.EVENTS).filter((e) => D.EVENTS[e].random);
    const queue = d.steps.map((st) => {
      if (st !== 'R') return st;
      const pick = randoms.splice(Math.floor(rng() * randoms.length), 1)[0];
      return pick;
    });
    s.expedition = { district: id, queue, index: -1, phase: 'event', result: null, pack: p, loot: {}, recruits: 0 };
    log(s, `${d.name}(으)로 출발했다. ${d.intro}`);
    enterStep(s, 0);
    return true;
  }

  function enterStep(s, index) {
    const exp = s.expedition;
    exp.index = index;
    exp.phase = 'event';
    exp.result = null;
    const notes = [];
    // 이동 1칸 = 식량 1 + 물 1 (배낭 → 수집품 순)
    for (const k of ['food', 'water']) {
      if (exp.pack[k] > 0) exp.pack[k] -= 1;
      else if ((exp.loot[k] || 0) > 0) exp.loot[k] -= 1;
      else if (k === 'food') { hurt(s, 'hp', -1); hurt(s, 'mind', -1); notes.push('굶주림: 체력 -1, 정신력 -1'); }
      else { hurt(s, 'hp', -2); notes.push('갈증: 체력 -2'); }
    }
    if (D.DISTRICTS[exp.district].fog && !s.items.mask) {
      hurt(s, 'hp', -1); notes.push('안개: 체력 -1 (방독면 없음)');
    }
    exp.notes = notes;
    checkCollapse(s);
  }

  function hurt(s, stat, delta) {
    const p = s.player;
    if (stat === 'hp') p.hp = clamp(p.hp + delta, 0, p.maxHp);
    else p.mind = clamp(p.mind + delta, 0, p.maxMind);
  }

  function checkChance(s, check) {
    let c = check.base + 0.15 * (s.player.skills[check.skill] || 0);
    if (check.item && s.items[check.item]) c += check.bonus || 0;
    return clamp(c, 0.05, 0.95);
  }

  // 선택지 상태: { locked, reason, chance }
  function choiceState(s, ch) {
    const exp = s.expedition;
    const r = ch.req || {};
    if (r.item && !s.items[r.item]) return { locked: true, reason: `${D.ITEMS[r.item].name} 필요` };
    if (r.flag && !s.flags[r.flag]) return { locked: true, reason: '조건 미충족' };
    if (r.skill) {
      for (const [k, v] of Object.entries(r.skill)) {
        if ((s.player.skills[k] || 0) < v) return { locked: true, reason: `${D.SKILLS[k]} ${v} 필요` };
      }
    }
    if (ch.cost) {
      for (const [k, v] of Object.entries(ch.cost)) {
        const have = (exp.pack[k] || 0) + (exp.loot[k] || 0);
        if (have < v) return { locked: true, reason: `${D.RES[k]} ${v} 필요` };
      }
    }
    return { locked: false, reason: '', chance: ch.check ? checkChance(s, ch.check) : null };
  }

  function choose(s, i, rng) {
    const exp = s.expedition;
    if (!exp || exp.phase !== 'event') return false;
    const ev = D.EVENTS[exp.queue[exp.index]];
    const ch = ev.choices[i];
    if (!ch) return false;
    const st = choiceState(s, ch);
    if (st.locked) return false;
    if (ch.cost) for (const [k, v] of Object.entries(ch.cost)) takeSupply(exp, k, v);
    let outcome = ch.out, roll = null;
    if (ch.check) {
      const r = rng();
      roll = { chance: st.chance, success: r < st.chance };
      outcome = roll.success ? ch.ok : ch.fail;
    }
    const lines = applyOutcome(s, outcome || {});
    exp.phase = 'result';
    exp.result = { choice: ch.text, text: (outcome && outcome.text) || '', lines, roll };
    if (outcome && outcome.ending) { finish(s, outcome.ending); return true; }
    if (s.player.hp <= 0 || s.player.mind <= 0) log(s, `${ev.title}: ${exp.result.text}`);
    checkCollapse(s);
    return true;
  }

  function takeSupply(exp, k, v) {
    const fromPack = Math.min(exp.pack[k] || 0, v);
    if (k in exp.pack) exp.pack[k] -= fromPack;
    const rest = v - fromPack;
    if (rest > 0) exp.loot[k] = (exp.loot[k] || 0) - rest;
  }

  function applyOutcome(s, o) {
    const exp = s.expedition, p = s.player, lines = [];
    if (o.hp) { hurt(s, 'hp', o.hp); lines.push(`체력 ${o.hp > 0 ? '+' : ''}${o.hp}`); }
    if (o.mind) { hurt(s, 'mind', o.mind); lines.push(`정신력 ${o.mind > 0 ? '+' : ''}${o.mind}`); }
    if (o.pack) {
      for (const [k, v] of Object.entries(o.pack)) {
        if (v < 0) takeSupply(exp, k, Math.min(-v, (exp.pack[k] || 0) + (exp.loot[k] || 0)));
        lines.push(`${D.RES[k]} ${v}`);
      }
    }
    if (o.loseLoot) {
      for (const k of Object.keys(exp.loot)) exp.loot[k] = Math.floor(exp.loot[k] * (1 - o.loseLoot));
      lines.push('수집품 절반 잃음');
    }
    if (o.loot) {
      for (const [k, v] of Object.entries(o.loot)) {
        const room = capacity(s) - packLoad(exp);
        const got = Math.max(0, Math.min(v, room));
        if (got > 0) exp.loot[k] = (exp.loot[k] || 0) + got;
        lines.push(got < v ? `${D.RES[k]} +${got} (배낭이 가득 차 ${v - got}개 버림)` : `${D.RES[k]} +${v}`);
      }
    }
    if (o.skill) {
      for (const [k, v] of Object.entries(o.skill)) {
        p.skills[k] = (p.skills[k] || 0) + v;
        lines.push(`${D.SKILLS[k]} +${v}`);
      }
    }
    if (o.flag) s.flags[o.flag] = true;
    if (o.recruit) { exp.recruits += o.recruit; lines.push(`역으로 올 생존자 +${o.recruit}`); }
    return lines;
  }

  // 체력·정신력 바닥 처리
  function checkCollapse(s) {
    const exp = s.expedition, p = s.player;
    if (!exp) return;
    if (p.hp <= 0) {
      s.expedition = null;
      p.hp = 3; p.mind = Math.max(p.mind, 3);
      log(s, '눈앞이 캄캄해졌다… 눈을 떠 보니 역 난로 옆이다. 누군가 당신을 끌고 왔다. 짐은 모두 잃었다.', 'bad');
      return;
    }
    if (p.mind <= 0) {
      for (const k of Object.keys(exp.loot)) exp.loot[k] = Math.floor(exp.loot[k] / 2);
      p.mind = 3;
      log(s, '공포가 머리끝까지 차올랐다. 정신없이 역으로 달아난다. (수집품 절반 잃음)', 'bad');
      returnHome(s, true);
    }
  }

  function proceed(s) {
    const exp = s.expedition;
    if (!exp || exp.phase !== 'result') return false;
    if (exp.index + 1 < exp.queue.length) { enterStep(s, exp.index + 1); return true; }
    // 지역 완료
    const id = exp.district, d = D.DISTRICTS[id];
    if (!s.districts[id].cleared) {
      s.districts[id].cleared = true;
      if (d.clear.skill) for (const [k, v] of Object.entries(d.clear.skill)) s.player.skills[k] += v;
      if (d.clear.unlock) s.districts[d.clear.unlock] = s.districts[d.clear.unlock] || { unlocked: true, cleared: false };
      log(s, d.clear.text, 'event');
    }
    returnHome(s);
    return true;
  }

  function returnHome(s, fled) {
    const exp = s.expedition;
    if (!exp) return false;
    const got = [];
    for (const src of [exp.pack, exp.loot]) {
      for (const [k, v] of Object.entries(src)) if (v > 0) s.res[k] = (s.res[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(exp.loot)) if (v > 0) got.push(`${D.RES[k]} ${v}`);
    if ((exp.loot.parts || 0) > 0) s.flags.seenParts = true;
    if (exp.recruits) { s.pop += exp.recruits; got.push(`생존자 ${exp.recruits}명`); }
    s.expedition = null;
    log(s, (fled ? '겨우 역으로 돌아왔다. ' : '역으로 돌아왔다. ') + (got.length ? '가져온 것: ' + got.join(', ') : '빈손이다.'));
    return true;
  }

  function useMed(s) {
    const exp = s.expedition;
    if (!exp) return false;
    const have = (exp.pack.meds || 0) + (exp.loot.meds || 0);
    if (have < 1 || s.player.hp >= s.player.maxHp) return false;
    takeSupply(exp, 'meds', 1);
    hurt(s, 'hp', 4);
    return true;
  }

  function finish(s, ending) {
    s.ended = ending;
    s.expedition = null;
    s.districts.namsan.cleared = true;
    log(s, D.ENDINGS[ending].title + ' — ' + D.ENDINGS[ending].text, 'event');
  }

  // ── 저장 ──
  function normalize(raw) {
    const base = newState();
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return base;
    const s = Object.assign(base, raw);
    for (const key of ['flags', 'res', 'buildings', 'items', 'workers', 'districts', 'cd']) {
      s[key] = Object.assign({}, newState()[key], raw[key] || {});
    }
    s.player = Object.assign(newState().player, raw.player || {});
    s.player.skills = Object.assign(newState().player.skills, (raw.player && raw.player.skills) || {});
    if (!Array.isArray(s.log)) s.log = [];
    for (const [k, v] of Object.entries(s.res)) if (typeof v !== 'number' || !isFinite(v)) s.res[k] = 0;
    if (s.expedition && !D.DISTRICTS[s.expedition.district]) s.expedition = null;
    return s;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const API = {
    CD, PROD_EVERY, newState, tick, log,
    light, stoke, gather, checkTraps, build, craft, assign,
    buildCost, buildVisible, canBuild, canCraft, jobVisible, popCap, idle, capacity, packLoad,
    districtList, canStart, startExpedition, choiceState, choose, proceed, returnHome, useMed,
    normalize, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DS_ENGINE = API;
})(this);
