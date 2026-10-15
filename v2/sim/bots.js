// 자동 플레이 봇: 화면에 보이는 정보(상태·선택지의 성공률·조건)만 쓴다. 결과 문장·난수는 보지 않는다.
const E = require('../engine.js');
const D = E.D;

function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const POLICIES = {
  balanced: { expedition: 'smart', facility: 'farm', talk: true, plan: 'suggest' },
  clinic: { expedition: 'smart', facility: 'clinic', talk: true, plan: 'suggest' },
  nofacility: { expedition: 'smart', facility: null, talk: true, plan: 'suggest' },
  stay: { expedition: 'never', facility: 'farm', talk: true, plan: 'suggest' },
  rush: { expedition: 'always', facility: 'farm', talk: false, plan: 'suggest' },
  neglect: { expedition: 'never', facility: null, talk: false, plan: 'rest' },
  skipchains: { expedition: 'smart', facility: 'farm', talk: true, plan: 'suggest', skipChains: true },
  sloppy: { expedition: 'smart', facility: 'farm', talk: true, plan: 'suggest', sloppy: 0.2 },
  march: { expedition: 'smart', facility: 'farm', talk: true, plan: 'suggest', march: true },
};

// 사람은 글을 읽고 '도움 되는 쪽'을 고른다. 봇은 소극적인 선택지(지나친다·거절 등)를 기본적으로 피한다.
const PASSIVE = ['지나친다', '지나간다', '서둘러 떠난다', '포기', '둘러보고 나온다', '돌아선다', '건드리지 않는다', '거절', '필요 없다', '못 본 척', '열지 않는다', '돌아서 간다', '눈여겨본다', '일찍 눕는다', '그냥 둔다', '이번에는'];
function bestChoice(s, choices, opts) {
  // choices: [{choice, locked, chance}] — 잠기지 않은 것 중 성공률 높은 것, 판정 없으면 0.8로 취급, 비용 있으면 약간 감점
  let best = -1, bs = -9;
  choices.forEach((c, i) => {
    if (c.locked) return;
    let sc = c.chance == null ? 0.8 : c.chance;
    if (c.choice.cost) sc -= 0.05;
    if (!(opts && opts.keepPassive) && PASSIVE.some((w) => c.choice.text.includes(w))) sc -= 1;
    if (opts && opts.avoidTexts && opts.avoidTexts.some((t) => c.choice.text.includes(t))) sc -= 2;
    if (sc > bs) { bs = sc; best = i; }
  });
  return best;
}

function pickParty(s) {
  const fit = E.homeRes(s).filter((r) => r.injury < 2 && r.stress < 60 && r.breakdown <= 0);
  if (fit.length < 2) return null;
  fit.sort((a, b) => (b.skills.obs + b.skills.str + b.skills.tech) - (a.skills.obs + a.skills.str + a.skills.tech) || a.stress - b.stress);
  return [fit[0].id, fit[1].id];
}
function chooseRegion(s) {
  const open = (k) => s.closed[k] <= 0;
  if (open('B') && !s.flags.met_dohyeon && !s.flags.skipped_dohyeon) return 'B';
  if (open('A') && !s.flags.met_eunchae && !s.flags.skipped_eunchae) return 'A';
  const order = s.res.parts < 6 ? ['A', 'B'] : ['B', 'A'];
  for (const k of order) if (open(k)) return k;
  return null;
}
function runExpedition(s, pol, br) {
  let guard = 0;
  while (s.phase === 'expedition' && guard++ < 40) {
    const v = E.expView(s);
    if (v.phase === 'event') {
      const i = bestChoice(s, v.choices, pol.skipChains ? { avoidTexts: ['자물쇠를 따', '약품 1개를 건네', '물에 들어가', '밧줄을 던져'] } : null);
      if (i < 0 || !E.dispatch(s, { type: 'expChoose', i }).ok) { E.dispatch(s, { type: 'expChoose', i: v.choices.findIndex((c) => !c.locked) }); }
    } else {
      const o = v.options;
      const crowded = v.used >= v.cap - 2;
      let mode = 'return';
      const injured = v.party.some((r) => r.injury >= 1);
      const okOver = (o) => pol.march ? true : !o.over;     // march 정책은 8시간을 넘겨 강행한다
      if (!injured && !crowded && o.more.ok && okOver(o.more) && v.steps < 3 && (v.depth === 2 || v.steps >= 1)) mode = 'more';
      if (!injured && !crowded && v.depth === 1 && o.deeper.ok && okOver(o.deeper) && v.steps >= 1) mode = 'deeper';
      if (pol.march && !injured && !crowded && mode === 'return' && o.more.ok && v.steps < 4) mode = 'more';
      if (!E.dispatch(s, { type: 'expNext', mode }).ok) E.dispatch(s, { type: 'expNext', mode: 'return' });
    }
  }
}
function wantExpedition(s, pol) {
  if (pol.expedition === 'never' || s.expDone) return false;
  if (pol.expedition === 'always') return true;
  // smart: 식량·물에 여유가 있고, 보급 걱정이 없을 때 간다 (너무 비어 있으면 잔류)
  const people = 1 + E.alive(s).length;
  const needDay = Math.ceil(people * 0.5);
  if (s.res.food < 6 || s.res.water < 6) return false;
  if (s.day >= D.GOAL_DAY - 1) return false;
  if (s.visitDay === s.day || (s.day === D.CALENDAR.surge.day && s.flood >= 3)) return false;
  return true;
}
function doMorning(s, pol, br) {
  // 약속(수리 3부품)에 쓸 부품을 남겨 둔다: 도현을 만났거나 약속이 예약돼 있으면 3개 예약
  const reserve = (s.promises.some((p) => p.id === 'dohyeon_key') || (s.flags.repair_open && !s.flags.passage_secured && !s.project)) ? 3 : 0;
  if (pol.facility && !s.project && !s.facility && s.res.parts >= 6 + reserve && s.day >= 2 && s.day <= 6) E.dispatch(s, { type: 'startProject', id: pol.facility });
  if (s.flags.repair_open && !s.project && !s.flags.passage_secured) E.dispatch(s, { type: 'startProject', id: 'repair' });
  if (wantExpedition(s, pol)) {
    const party = pickParty(s); const region = chooseRegion(s);
    if (party && region) {
      const pack = { food: 2, water: 2, meds: Math.min(1, s.res.meds), items: Object.keys(s.items).filter((k) => s.items[k]) };
      if (s.res.food >= 4 + 2 && s.res.water >= 4 + 2) {
        pack.food = 3; pack.water = 3;
      }
      if (E.dispatch(s, { type: 'expStart', region, party, pack }).ok) runExpedition(s, pol, br);
    }
  }
  let plan = pol.plan === 'rest' ? {} : E.suggestPlan(s);
  if (pol.sloppy) {            // 사람처럼 실수한다: 일부 사람의 일을 엉뚱한 것으로 바꾼다
    const tasks = Object.keys(D.TASKS);
    for (const id of Object.keys(plan)) if (br() < pol.sloppy) plan[id] = tasks[Math.floor(br() * tasks.length)];
  }
  E.dispatch(s, { type: 'setPlan', plan });
  E.dispatch(s, { type: 'endDay' });
}
function doEvening(s, pol) {
  const v = E.eveningView(s);
  if (v.type === 'promise') {
    let i = bestChoice(s, v.choices, null);
    // 첫 번째 선택지(받아들이기)를 우선
    const first = v.choices.findIndex((c) => !c.locked);
    i = first;
    E.dispatch(s, { type: 'eveningChoose', i });
    E.dispatch(s, { type: 'eveningDone' });
  } else if (v.type === 'talk') {
    if (pol.talk) {
      const who = E.homeRes(s).filter((r) => !s.expParty.includes(r.id)).sort((a, b) => b.stress - a.stress)[0];
      if (who) E.dispatch(s, { type: 'talk', rid: who.id });
      E.dispatch(s, { type: 'eveningDone' });
    } else E.dispatch(s, { type: 'skipTalk' });
  } else E.dispatch(s, { type: 'eveningDone' });
}

// 상태 s 에서 끝까지 진행한다. stopAt(s)이 참이 되면 (아침 결정 직전에) 멈추고 s 를 돌려준다.
// firstMorning: 'go' | 'stay' 이면 이어지는 첫 아침에만 원정 여부를 강제한다 (같은 상태에서 갈라 보기).
function run(s, pol, br, opts) {
  opts = opts || {};
  const trace = { minFood: 99, minWater: 99, surplusDays: 0, foodSurplus: 0, waterSurplus: 0, days: 0, maxStress: 0, series: [] };
  let guard = 0, forced = opts.firstMorning || null;
  while (s.phase !== 'ended' && guard++ < 2000) {
    switch (s.phase) {
      case 'prologue': {
        const sc = D.PROLOGUE[s.pro];
        E.dispatch(s, { type: 'proChoose', i: Math.floor(br() * sc.choices.length) });
        E.dispatch(s, { type: 'proNext' }); break;
      }
      case 'morning': {
        if (opts.stopAt && opts.stopAt(s)) return { s, trace, stopped: true };
        trace.series.push({ day: s.day, food: s.res.food, water: s.res.water, parts: s.res.parts, meds: s.res.meds, flood: s.flood, exposure: s.exposure, stress: Math.round(E.alive(s).reduce((a, r) => a + r.stress, 0) / Math.max(1, E.alive(s).length)), alive: E.alive(s).length });
        trace.minFood = Math.min(trace.minFood, s.res.food); trace.minWater = Math.min(trace.minWater, s.res.water);
        const people = 1 + E.alive(s).length; const need = Math.ceil(people * 0.5);
        if (s.res.food >= need * 3) trace.foodSurplus += 1;
        if (s.res.water >= need * 3) trace.waterSurplus += 1;
        if (s.res.food >= need * 3 && s.res.water >= need * 3) trace.surplusDays += 1;
        trace.days += 1;
        let p2 = pol;
        if (forced) { p2 = Object.assign({}, pol, { expedition: forced === 'go' ? 'always' : 'never' }); forced = null; }
        doMorning(s, p2, br); break;
      }
      case 'evening': doEvening(s, pol); break;
      case 'nightEvent': {
        const v = E.nightView(s);
        if (!v.result) {
          const i = bestChoice(s, v.choices, null);
          E.dispatch(s, { type: 'nightChoose', i: i < 0 ? v.choices.findIndex((c) => !c.locked) : i });
        }
        E.dispatch(s, { type: 'nightDone' }); break;
      }
      case 'boarding': E.dispatch(s, { type: 'confirmBoarding' }); break;
      case 'expedition': runExpedition(s, pol, br); break;
      default: throw new Error('unknown phase ' + s.phase);
    }
  }
  return { s, trace };
}
function play(seed, policyName, opts) {
  return run(E.newGame(seed), POLICIES[policyName], mulberry32((seed * 7919 + 13) >>> 0), opts);
}

module.exports = { play, run, POLICIES, mulberry32 };
