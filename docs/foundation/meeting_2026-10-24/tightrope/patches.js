// 줄타기 설계(design.md)를 표 사본(db.raw — 정규화된 꼴)에 메모리에서만 넣는다. 표 파일은 고치지 않는다.
// apply(변형 이름, raw) → 바꾼 칸 목록(글). 선택지는 label 로 찾는다(없으면 오류 — 표가 바뀐 것).
// 변형 이름 = 조각을 '+' 로 잇는다. 예: rope+a4 · rope:hi+a4:b · base
//   rope[:표]  = §1 줄타기(카르마 구간별 판정). 표 = mid(기본) · hi(더 가혹) · lo(덜 가혹)
//   blind      = §2-1 못 본 원한이 터진 새벽(grudge_boils → dawn_strike 에 안전 출구 없음)
//   a4[:b]     = §2-2·2-3 못 본 일이 당신에게 오는 길(도둑이 당신 그릇·나눈 사람의 원한). b = 더 센 값
const BANDS = [['karma>=16', 3], ['karma>=12', 2], ['karma>=8', 1], ['karma>=5', 0]];
// 판정 base(%) — 화면 % = base + 기술×5 (당신 기술은 처음 모두 1 → +5). 바닥 = 표의 가장 낮은 값(영구 손상으로 기술이 0이 되어도 base 아래로 안 내려간다)
const TABLES = {
  mid: { pay: [90, 85, 75, 65], endure: [85, 75, 65, 55], point: [80, 65, 50, 35] },
  hi: { pay: [85, 80, 70, 60], endure: [80, 70, 60, 50], point: [75, 60, 45, 35] },
  lo: { pay: [92, 88, 80, 70], endure: [88, 80, 70, 60], point: [82, 70, 55, 40] },
  vlo: { pay: [92, 90, 85, 78], endure: [88, 85, 78, 70], point: [82, 70, 55, 40] },
  vvlo: { pay: [94, 92, 88, 82], endure: [90, 88, 82, 75], point: [82, 70, 55, 40] },
};
const BLINDS = { lo: { pay: 90, endure: 80, point: 70 }, mid: { pay: 85, endure: 75, point: 65 }, hi: { pay: 80, endure: 70, point: 60 }, xhi: { pay: 75, endure: 65, point: 55 } };
let BLIND = BLINDS.mid;
// 늦은 사건의 원래 죽음 판정(밀쳐 낸다·축 늘어진다·귀를 막는다·뿌리치고 걷는다·발을 빼낸다 …)도 카르마 구간마다 깎는다: base − [0, 5, 10, 15], 바닥 30
const FIGHT_PEN = [0, 5, 10, 15]; const FLOOR = 30;
const FIGHT = [['dawn_strike', '밀쳐 낸다'], ['dawn_strike', '소리친다'], ['dawn_strike', '축 늘어진다'], ['dawn_mob', '밀치고 달아난다'], ['dawn_mob', '무릎을 꿇고 빈다'], ['called_up', '귀를 막는다'], ['d10_hold', '뿌리치고 걷는다'], ['d10_grab', '발을 빼낸다']];
const SKILL = { pay: 'talk', endure: 'str', point: 'talk' };
const FAIL_TEXT = { pay: '받아 들고도 손이 풀리지 않았다.', endure: '버티던 몸이 먼저 꺾였다.', point: '아무도 손끝을 따라 돌아보지 않았다.' };

const clone = (o) => JSON.parse(JSON.stringify(o));
const ROPED = new WeakMap();   // 선택지 → 앞에 붙인 줄타기 변형 수 (blind 가 그 뒤에 끼운다)
function choiceOf(raw, evId, label) {
  const ev = raw.events.find((e) => e.id === evId);
  if (!ev) throw new Error('사건 없음 ' + evId);
  const c = ev.choices.find((x) => x.label === label);
  if (!c) throw new Error(`선택지 없음 ${evId}/${label}`);
  return { ev, c };
}
const killsYou = (o) => !!(o && o.effects && o.effects.kill && [].concat(o.effects.kill).some((k) => !k.who || ['you', 'self', 'actor', 'party', 'all'].includes(k.who)));
function withKill(o, text) {
  const out = clone(o || { text: '', effects: {} });
  out.effects = out.effects || {};
  if (!killsYou(out)) out.effects.kill = { who: 'you' };
  if (text) out.text = text;
  return out;
}
// 한 변형(m = 기본 선택지에 옛 swap 을 덮은 모습)을 줄타기 판정으로 바꾼 swap 한 줄
function ropeVariant(when, m, pct, kind, failText) {
  const v = { when };
  if (m.label) v.label = m.label;
  if (m.cost) v.cost = clone(m.cost);
  if (m.req) v.req = clone(m.req);
  if (m.taboo) v.taboo = m.taboo;
  const w = m.warn || '';
  v.warn = /끝이다/.test(w) ? w : (w ? `${w}. 잘못되면 끝이다` : '잘못되면 끝이다');
  if (m.check) {
    v.check = { skill: m.check.skill, base: Math.min(m.check.base, pct) };
    v.ok = clone(m.ok);
    v.fail = killsYou(m.fail) ? clone(m.fail) : withKill(m.fail, failText);
  } else {
    v.check = { skill: SKILL[kind], base: pct };
    v.ok = clone(m.out);
    v.fail = withKill({ text: '', effects: {} }, failText || FAIL_TEXT[kind]);
  }
  return v;
}
// 선택지 하나를 줄타기로: 카르마 구간마다(높은 구간부터) [옛 swap 마다 합친 줄…, 기본 줄]. 옛 swap 은 맨 뒤에 남는다(카르마 < 5).
function rope(raw, log, evId, label, kind, table, extra, minK) {
  const { c } = choiceOf(raw, evId, label);
  const olds = c.swap ? [].concat(c.swap) : [];
  const base = Object.assign({}, c); delete base.swap;
  const merged = (v) => { const m = Object.assign({}, base, v); if (v.check) delete m.out; if (v.out && !v.check) { delete m.check; delete m.ok; delete m.fail; } return m; };
  const vs = [];
  for (const [cond, bi] of BANDS) {
    if (minK && Number(cond.slice(7)) < minK) continue;
    const pct = table[kind][bi];
    for (const v of olds) vs.push(ropeVariant(`(${v.when}) & ${cond}`, merged(v), pct, kind));
    vs.push(ropeVariant(cond, base, pct, kind));
  }
  if (extra) for (const [cond, pct] of extra) { for (const v of olds) vs.push(ropeVariant(`(${v.when}) & ${cond}`, merged(v), pct, kind)); vs.push(ropeVariant(cond, base, pct, kind)); }
  c.swap = vs.concat(olds); ROPED.set(c, { n: vs.length, table, kind, minK });
  log.push(`${evId}/${label}:${kind}`);
}
// §1 줄타기 대상 (사건, 선택 label, 종류)
const LATE = [
  ['dawn_strike', '그릇 둘을 내민다', 'pay'], ['dawn_strike', '맞고 버틴다', 'endure'], ['dawn_strike', '옆 담요를 가리킨다', 'point'],
  ['dawn_mob', '가진 것을 다 내놓는다', 'pay'], ['dawn_mob', '맞고 버틴다', 'endure'], ['dawn_mob', '손가락 하나로 갚는다', 'pay'], ['dawn_mob', '다른 사람을 가리킨다', 'point'],
  ['called_up', '불을 키우고 밤을 샌다', 'pay'], ['called_up', '손등을 깨물며 버틴다', 'endure'], ['called_up', '다른 이름을 댄다', 'point'],
  ['d10_hold', '가진 것을 내준다', 'pay'], ['d10_hold', '끌려가며 버틴다', 'endure'], ['d10_hold', '손가락을 내준다', 'pay'],
  ['d10_grab', '물병을 돌려준다', 'pay'], ['d10_grab', '끌려 넘어진다', 'endure'],
];
const EARLY = [
  ['d2_shutter_arm', '옆 사람 팔을 내민다', 'point'], ['d4_spanner', '다른 사람이 셌다고 한다', 'point'], ['d5_flood', '남의 담요로 물길을 막는다', 'point'],
  ['fever_night', '남의 담요를 끌어온다', 'point'], ['d10_walk_weak', '옆 사람 물병을 비운다', 'point'],
  ['starve_you', '창고를 턴다', 'pay', 8], ['starve_you', '남의 그릇을 뺏는다', 'point', 8],
];
const ropeAll = (tname) => (raw, log) => { const t = TABLES[tname]; for (const [e, l, k, minK] of LATE.concat(EARLY)) rope(raw, log, e, l, k, t, null, minK); };
// §2-1 못 본 원한이 터진 새벽: grudge_boils 가 strike_blind 를 세우고, dawn_strike 의 세 출구가 BLIND 판정(카르마 구간이 더 낮으면 그쪽이 먼저 맞는다)
const fightOf = (pen) => (raw, log) => { for (const [e, l] of FIGHT) { const { c } = choiceOf(raw, e, l); const b = c.check.base; rope(raw, log, e, l, 'fight', { fight: pen.map((p) => Math.max(FLOOR, b - p)) }, null); } };
const blindOf = (lvl) => (raw, log) => { BLIND = BLINDS[lvl]; blind(raw, log); };
const blind = (raw, log) => {
  const n = raw.nightEvents.find((x) => x.id === 'grudge_boils');
  n.effects.flag = Object.assign({}, n.effects.flag, { strike_blind: true });
  const ev = raw.events.find((e) => e.id === 'dawn_strike');
  for (const [l, k] of [['그릇 둘을 내민다', 'pay'], ['맞고 버틴다', 'endure'], ['옆 담요를 가리킨다', 'point']]) {
    const { c } = choiceOf(raw, 'dawn_strike', l);
    const olds = c.swap ? [].concat(c.swap) : [];
    const info = ROPED.get(c) || null; const ropeN = info ? info.n : 0;
    const base = Object.assign({}, c); delete base.swap;
    const rest = olds.slice(ropeN);
    const merged = (v) => { const m = Object.assign({}, base, v); if (v.check) delete m.out; if (v.out && !v.check) { delete m.check; delete m.ok; delete m.fail; } return m; };
    // 눈먼 새벽이 카르마 구간과 겹치면 더 낮은 % (min) — 카르마가 높을수록 살 확률이 내려간다는 규칙을 지킨다
    const pre = [];
    if (info) for (const [cond, bi] of BANDS) { const pct = Math.min(info.table[k][bi], BLIND[k]); for (const v of rest) pre.push(ropeVariant(`(${v.when}) & flag:strike_blind & ${cond}`, merged(v), pct, k)); pre.push(ropeVariant(`flag:strike_blind & ${cond}`, base, pct, k)); }
    const add = rest.map((v) => ropeVariant(`(${v.when}) & flag:strike_blind`, merged(v), BLIND[k], k)).concat([ropeVariant('flag:strike_blind', base, BLIND[k], k)]);
    c.swap = pre.concat(olds.slice(0, ropeN), add, rest);
  }
  // 모든 결과가 strike_blind 를 지운다
  const clear = (o) => { if (o && o.effects && !killsYou(o)) o.effects.flag = Object.assign({}, o.effects.flag, { strike_blind: false }); };
  for (const c of ev.choices) for (const v of [c].concat(c.swap ? [].concat(c.swap) : [])) { clear(v.out); clear(v.ok); clear(v.fail); }
  log.push('grudge_boils+strike_blind', 'dawn_strike blind 3');
};
// §2-2 못 본 도둑은 당신 그릇으로 온다 · §2-3 못 본 나눔은 원한이 된다
const a4 = (strong) => (raw, log) => {
  const g = raw.nightEvents.find((x) => x.id === 'steal_food_again');
  g.effects = Object.assign({}, g.effects, { hunger: { who: 'you', n: strong ? 3 : 2 } });
  g.trace = Object.assign({}, g.trace, { bowl_you: 'empty' });
  const s = raw.nightEvents.find((x) => x.id === 'share_bowl');
  s.missed.effects = Object.assign({}, s.missed.effects, { grudge: { who: 'actor', n: strong ? 4 : 3 }, flag: { unseen_grudge_actor: true } });
  log.push('steal_food_again hunger you', 'share_bowl missed grudge+flag');
  if (strong) {
    const m = raw.nightEvents.find((x) => x.id === 'steal_meds_again');
    m.effects = Object.assign({}, m.effects, { injure: { who: 'you', n: 1 } });
    m.trace = Object.assign({}, m.trace, { bandage_you: 'rot' });
    log.push('steal_meds_again injure you');
  }
};
// §2-1 보강: 못 본 원한을 품은 사람은 '보이는' 습격(grudge_strike_you) 대신 눈먼 새벽(grudge_boils)으로 온다
const gsy = (raw, log) => { const n = raw.nightEvents.find((x) => x.id === 'grudge_strike_you'); n.actor = `(${n.actor}) & !flag:unseen_grudge_actor`; log.push('grudge_strike_you actor !unseen'); };
// §2-3 보강: 못 본 수첩(read_notebook)도 못 본 원한이 된다
const nb = (raw, log) => { const n = raw.nightEvents.find((x) => x.id === 'read_notebook'); n.missed.effects = Object.assign({}, n.missed.effects, { flag: { unseen_grudge_actor: true } }); log.push('read_notebook missed +unseen'); };
// §2-1 보강: 눈먼 새벽은 그 밤에 반드시 온다 — grudge_boils 를 곁가지 행(상한 밖, weight 10 = 그 밤 100%)으로
const boilsideOf = (w) => (raw, log) => { const n = raw.nightEvents.find((x) => x.id === 'grudge_boils'); n.side = 1; n.weight = w; log.push('grudge_boils side w' + w); };
const boilside = boilsideOf(10);
const PIECES = { gsy, nb, boilside, 'boilside:7': boilsideOf(7), 'boilside:5': boilsideOf(5), 'blind:lo': blindOf('lo'), rope: ropeAll('mid'), 'rope:hi': ropeAll('hi'), 'rope:lo': ropeAll('lo'), 'rope:vlo': ropeAll('vlo'), 'rope:vvlo': ropeAll('vvlo'), fight: fightOf(FIGHT_PEN), 'fight:lo': fightOf([0, 0, 5, 10]), blind: blindOf('mid'), 'blind:hi': blindOf('hi'), 'blind:xhi': blindOf('xhi'), a4: a4(false), 'a4:b': a4(true) };
function apply(name, raw) {
  if (name === 'base') return [];
  const log = [];
  for (const p of name.split('+')) { const f = PIECES[p]; if (!f) throw new Error('조각 없음: ' + p); f(raw, log); }
  return log;
}
module.exports = { apply, TABLES, BLINDS, LATE, EARLY, BANDS, FIGHT, FIGHT_PEN, FLOOR };
