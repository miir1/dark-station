// 데이터 담당 — 10-24 검증 잔여(A1·A2·A3·A4·REG) 고침. 앞 단계 표(before_fix = 이 작업 전 v4/data 복사본)를 읽어 고친 표를 쓴다.
// 쓰기: node fix_data.js [원본 폴더=before_fix] [쓸 폴더=v4/data] [손잡이 JSON]
//   몇 번 돌려도 같은 결과(원본은 안 바뀐다). 파일 꼴은 원본 그대로(events·nightEvents = CRLF 2칸, 나머지 = LF 2칸).
//   손잡이 endureGamble:1 = 디렉터 확인용 변형(카르마가 높으면 '버틴다'도 판정 — 기본은 0, 표에 넣지 않는다)
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..', '..', '..', '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'before_fix');
const DST = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'v4', 'data');
const K = Object.assign({
  // A1
  swapKarma: 8,              // 돌아온 사건의 카르마 문턱(앞 단계와 같다)
  karmaMax: 30,              // 카르마 상한 20 → 30 (상한에 붙은 뒤에도 이기심이 값으로 쌓이게, 지적 2)
  heavyKarma: 20, heavyW: 6, heavyGrudge: 3,   // 카르마 ≥20: 등 돌린 사람(원한 ≥3)도 새벽에 온다(곁가지, 확률 weight/10)
  signalGrudge: 3,           // 둘러섬·이름 대기 행의 행위자 원한 문턱 2 → 3 (등 돌림 신호가 먼저, 지적 3)
  feverDawn: 1,              // 열병 '남의 담요' 카르마 ≥8: 그 사람이 새벽에 온다(지적 2)
  floodDawn: 1,              // 범람 '남의 담요로 물길' 카르마 ≥8: 같은 값
  bowlMob: 1,                // 굶주림 '남의 그릇을 뺏는다' 카르마 ≥8: 아침에 다들 안다(둘러섬)
  repayAgain: 1,             // repay_bowl '그냥 지나간다'가 다음 배식에도 다시 묻게(지적 4)
  coldBowlW: 5,              // 곁가지 신호 cold_bowl 확률 3 → 5 (그릇이 비어 있어도, 지적 5)
  endureGamble: 0, endureBase: 70, endureHigh: 55,   // 디렉터 확인용 변형(지적 1) — 기본 0
  // A2
  railFail: 2, railObs: 40,  // starve_you '선로 밑을 뒤진다' 실패 부상(2 = 그대로). 1 로 낮추면 A2 쏠림은 ✓ 이지만 A4 굶주림 값이 사라진다(v1s_run vs v2s_run, 지적 6)
  armStr: 80, spannerStr: 80, floodStr: 75,
  floodCost: 3,              // d5_flood '창고를 버리고 뺀다': 화면 비용 = 실제로 나가는 식량(지적 14). 앞 단계 = 비용 1 + 결과 −4
  // A4
  missFood: 2, missWater: 2, missNotebook: 3, missStairsFog: 2,   // 못 본 도둑질·수첩·계단이 자원·시계에 닿게(지적 11)
  // 지도
  benchMove: 1,              // 의자1 (17,10) → (18,10): 서하 물통·붕대(17,9)를 서서 조사할 칸(지적 13). (16,10)은 서하 아침·마리 저녁 자리(spots.js)라 쓰지 않는다
}, JSON.parse(process.argv[4] || '{}'));

const rd = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
const ev = rd('events.json'), ne = rd('nightEvents.json'), nums = rd('numbers.json'), lines = rd('lines.json'), maps = rd('maps.json');
const log = [];
const note = (m) => log.push(m);
const E = (id) => { const r = ev.find((x) => x.id === id); if (!r) throw new Error('사건 없음 ' + id); return r; };
const C = (id, label) => { const c = E(id).choices.find((x) => x.label === label); if (!c) throw new Error('선택지 없음 ' + id + ' / ' + label); return c; };
const NR = (id) => { const r = ne.find((n) => n.id === id); if (!r) throw new Error('밤 사건 없음 ' + id); return r; };
const outs = (c) => ['out', 'ok', 'fail'].map((k) => c[k]).filter(Boolean);
const swaps = (c) => (c.swap == null ? [] : Array.isArray(c.swap) ? c.swap : [c.swap]);
const add = (o, ...effs) => { o.effects = (o.effects || []).concat(effs); };
const addFront = (o, ...effs) => { o.effects = effs.concat(o.effects || []); };
const dropFx = (o, pred) => { const n0 = (o.effects || []).length; o.effects = (o.effects || []).filter((e) => !pred(e)); return n0 - o.effects.length; };
const karma = (n) => ({ verb: 'number', id: 'karma', n });
const num = (id, n, who) => (who ? { verb: 'number', id, n, who } : { verb: 'number', id, n });
const flag = (id, set) => ({ verb: 'flag', id, set });
const axis = (id, n) => ({ verb: 'axis', id, n });
const tr = (id, state) => ({ verb: 'trace', id, state });
const kill = () => ({ verb: 'kill', who: 'you', how: 'dead' });
const res = (text, effects, extra) => Object.assign({ text, effects: effects || [], ledger: '' }, extra || {});
const clone = (o) => JSON.parse(JSON.stringify(o));
const isFx = (verb, id, who) => (e) => e.verb === verb && (id == null || e.id === id) && (who == null || e.who === who);
const CHANGED = new Set();   // 문장 검사할 사건 id
const touch = (id) => { CHANGED.add(id); return E(id); };

// ════════════════ A1 ════════════════
// [지적 3] '버틴다'의 카르마 ≥8 변형이 습격 깃발을 안 지워 매일 새벽 다시 왔다(누구의 원한과도 상관없이 = 세계가 심판).
//   → 깃발을 지운다. 대신 원한을 덜지 않는다(−1 지움): 다시 오는 것은 원한을 품은 사람이 밤에 다시 일어설 때(밤 행 mob_you·grudge_strike_*·grudge_names_you).
{
  const fix = (evId, label, flagId, warnFrom, warnTo) => {
    const c = C(evId, label); touch(evId); let n = 0;
    for (const v of swaps(c)) {
      if (!/karma>=/.test(v.when || '')) continue;
      const o = v.out; if (!o) continue;
      if (!o.effects.some((e) => e.verb === 'flag' && e.id === flagId)) addFront(o, flag(flagId, 0));
      dropFx(o, (e) => e.verb === 'number' && e.id === 'grudge' && e.who === 'all' && e.n < 0);
      if (warnFrom && v.warn) v.warn = v.warn.replace(warnFrom, warnTo);
      n++;
    }
    if (!n) throw new Error('카르마 변형 없음 ' + evId);
    return n;
  };
  const a = fix('dawn_strike', '맞고 버틴다', 'dawn_strike', '새벽에 또 온다', '그림자는 또 온다');
  const b = fix('dawn_mob', '맞고 버틴다', 'dawn_mob', '새벽에 또 온다', '담요들은 또 온다');
  const c = fix('called_up', '손등을 깨물며 버틴다', 'named_you', '이름이 또 온다', '이름이 또 온다');
  note(`[3] 카르마 ≥8 '버틴다' 변형 ${a + b + c}개: 습격·부름 깃발을 지운다 · 원한 −1 지움(원한은 남는다) · 경고 '새벽에 또 온다' → '그림자는/담요들은 또 온다'`);
  // 신호가 먼저: 둘러섬·이름 대기는 등 돌림(원한 ≥3)이 보이는 사람만
  for (const id of ['mob_you', 'grudge_names_you']) { const r = NR(id); r.actor = r.actor.replace(/grudge>=\d+/, `grudge>=${K.signalGrudge}`); }
  note(`[3] 밤 행 mob_you·grudge_names_you 행위자 원한 ≥2 → ≥${K.signalGrudge} (등 돌림 신호가 보이는 사람만 한다)`);
}

// [지적 2] 카르마를 올리는 선택 25개 중 카르마로 바뀌는 것 3개뿐 — 되풀이되는 공짜 출구(열병 '남의 담요'·굶주림 '남의 그릇')에 값을 단다.
//   잠그지 않는다(잠그면 강제 사망 — exp_fever_lock). 대신 카르마 ≥8 이면 피해자가 새벽에 온다(사람이 하는 일, 경고에 쓴다).
{
  if (K.feverDawn) {
    const c = C('fever_night', '남의 담요를 끌어온다'); touch('fever_night');
    const o = clone(c.out);
    for (const e of o.effects) if (e.verb === 'number' && e.id === 'grudge' && e.who === 'target') e.n = 5;
    add(o, flag('dawn_strike', 1));
    o.text = '옆 담요를 끌어와 덮었다. 그 사람은 밤새 떨며 이쪽을 봤다. 아침에 열이 내렸다.';
    c.swap = [{ when: `karma>=${K.swapKarma}`, warn: '그 사람이 밤새 떤다. 새벽에 그 사람이 온다', out: o }];
    note(`[2] fever_night '남의 담요를 끌어온다': 카르마 ≥${K.swapKarma} 이면 그 사람 원한 +5 · 새벽 습격(dawn_strike) 깃발 · 경고 '새벽에 그 사람이 온다'`);
  }
  if (K.floodDawn) {
    const c = C('d5_flood', '남의 담요로 물길을 막는다'); touch('d5_flood');
    const o = clone(c.out);
    for (const e of o.effects) if (e.verb === 'number' && e.id === 'grudge' && e.who === 'target') e.n = 5;
    add(o, flag('dawn_strike', 1));
    o.text = '담요를 말아 물길에 박았다. 주인은 젖은 채 이쪽을 봤다. 물은 내려갔다.';
    c.swap = [{ when: `karma>=${K.swapKarma}`, warn: '그 사람이 밤새 젖는다. 새벽에 그 사람이 온다', out: o }];
    note(`[2] d5_flood '남의 담요로 물길을 막는다': 카르마 ≥${K.swapKarma} 이면 같은 값(원한 +5 · 새벽 습격)`);
  }
  if (K.bowlMob) {
    const c = C('starve_you', '남의 그릇을 뺏는다'); touch('starve_you');
    const ok = clone(c.ok), fail = clone(c.fail);
    add(ok, flag('dawn_mob', 1)); add(fail, flag('dawn_mob', 1));
    ok.text = '잠든 사람의 그릇을 끌어왔다. 그 사람이 눈을 떴다. 아침까지 앉아서 당신을 봤다.';
    c.swap = [{ when: `karma>=${K.swapKarma}`, warn: '그 사람이 굶는다. 아침에 다들 안다', ok, fail }];
    note(`[2] starve_you '남의 그릇을 뺏는다': 카르마 ≥${K.swapKarma} 이면 성공·실패 모두 새벽 둘러섬(dawn_mob) 깃발 · 경고 '아침에 다들 안다'`);
  }
  // 상한 20 → 30, 그리고 상한 근처의 값: 카르마 ≥20 이면 등 돌린 사람(원한 ≥3)도 새벽에 온다
  const kr = nums.find((r) => r.id === 'karma'); if (!kr) throw new Error('karma 행 없음');
  kr.max = K.karmaMax;
  if (K.heavyKarma && !ne.some((r) => r.id === 'grudge_strike_heavy')) {
    const base = NR('grudge_strike_late');
    const row = clone(base);
    row.id = 'grudge_strike_heavy';
    row.actor = `grudge>=${K.heavyGrudge} & self!=dongha`;
    row.cond = `karma>=${K.heavyKarma} & !flag:dawn_strike & !flag:dawn_dongha & !flag:dawn_dongha2`;
    row.weight = K.heavyW;
    ne.splice(ne.indexOf(base) + 1, 0, row);
  }
  note(`[2] 카르마 상한 20 → ${K.karmaMax} · 새 곁가지 밤 행 grudge_strike_heavy(카르마 ≥${K.heavyKarma}, 행위자 원한 ≥${K.heavyGrudge}, 확률 ${K.heavyW * 10}%)`);
}

// [지적 4] 갚는 길이 비용 때문에 잠긴다 — 돌아온 사건 안의 갚는 선택을 넓힌다(늘 열린 몸값과 따로)
{
  // dawn_mob '가진 것을 다 내놓는다': 화면 비용(식량 1·물 1)이 실제(전부)와 달랐다(지적 14) → 비용 칸을 비우고 '가진 것이 하나라도 있으면' 열린다
  const all = C('dawn_mob', '가진 것을 다 내놓는다'); touch('dawn_mob');
  all.cost = {}; all.req = { cond: 'food>=1 | water>=1', why: '내놓을 것이 없다' };
  // 손가락으로 갚기·소매에 손가락 = 몸으로 갚는 길 — 카르마도 준다
  add(C('dawn_mob', '손가락 하나로 갚는다').out, karma(-1));
  add(C('d10_hold', '손가락을 내준다').out, karma(-1)); touch('d10_hold');
  // dawn_strike '그릇 둘을 내민다'(식량 2): 식량이 모자라면 물병 둘로
  const bowls = C('dawn_strike', '그릇 둘을 내민다');
  if (!swaps(bowls).length) bowls.swap = [{ when: 'food<2 & water>=2', label: '물병 둘을 내민다', cost: { water: 2 },
    out: res('목에서 손이 풀렸다. 그림자가 물병 둘을 안고 어둠으로 갔다.', clone(bowls.out.effects)) }];
  // d10_hold '가진 것을 내준다'(식량 2·물 1): 식량이 모자라면 물 셋으로
  const give = C('d10_hold', '가진 것을 내준다');
  if (!swaps(give).length) give.swap = [{ when: 'food<2 & water>=3', label: '물병 셋을 내준다', warn: '물 셋이 나간다', cost: { water: 3 },
    out: res('물병 셋을 받아 들고 손을 놓았다.', clone(give.out.effects)) }];
  // repay_bowl: '그냥 지나간다'가 다시 안 묻게 하던 깃발을 지운다 → 등 돌린 사람은 배식 때마다 줄 끝에 선다(갚을 기회 + 신호)
  if (K.repayAgain) { const pass = C('repay_bowl', '그냥 지나간다'); dropFx(pass.out, (e) => e.verb === 'flag' && e.id === 'repay_asked_target'); touch('repay_bowl'); }
  note("[4] 갚는 길: dawn_mob '다 내놓는다' 비용 칸 비움(가진 것이 하나라도 있으면 열림, 이유 '내놓을 것이 없다') · '손가락으로 갚는다'·d10_hold '손가락을 내준다' 카르마 −1 · dawn_strike 식량 모자라면 '물병 둘을 내민다' · d10_hold 식량 모자라면 '물병 셋을 내준다' · repay_bowl 지나쳐도 다음 배식에 다시 선다");
}

// [지적 5] 밀린 그릇 신호(cold_bowl)가 그릇이 찼을 때만 — 비어 있어도 줄 끝으로 밀린다
{
  const r = NR('cold_bowl');
  r.cond = 'day>=2 & trace:bowl_you!=pushed';
  r.weight = K.coldBowlW;
  note(`[5] cold_bowl: 조건 '그릇이 찼을 때' → '아직 안 밀렸을 때'(빈 그릇도) · 확률 30% → ${K.coldBowlW * 10}%`);
}

// [지적 1] 디렉터 확인용 변형 — 기본은 넣지 않는다(endureGamble 0)
if (K.endureGamble) {
  const gamble = (evId, label, skill) => {
    const c = C(evId, label); touch(evId);
    const hi = swaps(c).filter((v) => /karma>=/.test(v.when || ''));
    const rest = swaps(c).filter((v) => !/karma>=/.test(v.when || ''));
    const okOut = (hi.length ? hi[hi.length - 1].out : c.out);
    const failText = '버티던 몸이 먼저 꺾였다. 아무도 일으키지 않았다.';
    const mk = (when, base) => ({ when, warn: '못 버티면 끝이다', check: { skill, base }, ok: clone(okOut), fail: res(failText, [kill()], { ledger: { who: 'you', status: 'dead', day: '{day}', cause: '' } }) });
    c.swap = [mk('karma>=14', K.endureHigh), mk(`karma>=${K.swapKarma}`, K.endureBase)].concat(rest);
  };
  gamble('dawn_strike', '맞고 버틴다', 'str'); gamble('dawn_mob', '맞고 버틴다', 'str'); gamble('d10_hold', '끌려가며 버틴다', 'str');
  // 늘 열린 출구 = 갚기(비용 칸 없음)
  const all = C('dawn_mob', '가진 것을 다 내놓는다'); all.req = {};
  const bowls = C('dawn_strike', '그릇 둘을 내민다'); bowls.label = '가진 것을 내민다'; bowls.cost = {}; bowls.warn = '식량과 물이 나간다'; bowls.swap = undefined; delete bowls.swap;
  add(bowls.out, num('food', -2), num('water', -2));
  const give = C('d10_hold', '가진 것을 내준다'); give.cost = {}; give.warn = '식량과 물이 나간다'; delete give.swap; add(give.out, num('food', -2), num('water', -2));
  note(`[1 변형] 카르마 ≥${K.swapKarma} '버틴다' = str ${K.endureBase}(≥14: ${K.endureHigh}) 판정, 실패 죽음 · 늘 열린 출구 = 갚기(비용 칸 없음)`);
}

// ════════════════ A2 ════════════════
// [지적 6] 굶주림 → 선로 밑 실패(부상 +2) → 열병 깔때기
{
  const c = C('starve_you', '선로 밑을 뒤진다'); touch('starve_you');
  for (const e of c.fail.effects) if (e.verb === 'injure' && e.who === 'you') e.n = K.railFail;
  c.check.base = K.railObs;
  note(`[6] starve_you '선로 밑을 뒤진다': 실패 부상 +2 → +${K.railFail} · 판정 obs ${K.railObs}`);
}
// [지적 8] 죽는 장면 글 — 적나라 원칙(유혈·절단·시체를 직접)
{
  C('d2_shutter_arm', '팔을 비틀어 뺀다').fail.text = '셔터 날이 팔꿈치를 잘랐다. 너머에서 남은 몸을 당겼다. 셔터 밑으로 피가 번졌다.'; touch('d2_shutter_arm');
  E('d2_shutter_arm').explicit = 1;
  C('d5_flood', '모두 매달려 퍼낸다').fail.text = '발이 물살에 들렸다. 배수구 쇠살에 얼굴이 박혔다. 물이 붉게 풀렸다.';
  for (const [id, lab] of [['d6_shutter', '동하와 덤빈다'], ['d6_shutter_b', '맞선다']]) { C(id, lab).fail.text = '횃불이 얼굴을 쳤다. 살 타는 냄새가 났다. 쇠파이프가 뒤통수를 깼다.'; touch(id); }
  E('d6_shutter_b').explicit = 1;
  C('d2_shutter_arm', '팔을 비틀어 뺀다').check.base = K.armStr;
  note("[8] 죽는 글: d2_shutter_arm 팔 잘림·피 · d5_flood 쇠살·피 · d6_shutter·_b 화상·두개골 (d6_shutter_b explicit 0 → 1)");
}
// [지적 14] d5_flood '창고를 버리고 뺀다': 화면 비용 1, 실제는 비용 1 + 결과 −4 → 화면 비용 = 실제(결과의 식량 차감을 비용으로 옮긴다)
{
  const c = C('d5_flood', '창고를 버리고 뺀다');
  const n = dropFx(c.out, (e) => e.verb === 'number' && e.id === 'food' && !e.who);
  if (n !== 1) throw new Error('d5_flood 결과 식량 칸을 못 찾음');
  c.cost = { food: K.floodCost };
  c.warn = '창고 식량이 떠내려간다';
  note(`[14] d5_flood '창고를 버리고 뺀다': 비용 식량 1 + 결과 −4 → 비용 식량 ${K.floodCost}(결과 차감 없음, 화면 = 실제) · 경고 '창고 식량이 떠내려간다'`);
  // 같은 꼴(비용 칸 없이 결과로만 나가는 자원)인데 경고 글이 그 자원을 말하지 않던 곳: dawn_mob '맞고 버틴다'(식량 −2)
  const hold = C('dawn_mob', '맞고 버틴다');
  const W = { '크게 다친다': '크게 다친다. 봉지를 뺏긴다', '다리를 잃는다. 담요들은 또 온다': '다리와 봉지를 잃는다. 담요들은 또 온다',
    '크게 다친다. 담요들은 또 온다': '봉지를 뺏기고 크게 다친다. 담요들은 또 온다', '다리를 잃는다': '다리와 봉지를 잃는다' };
  for (const v of [hold].concat(swaps(hold))) { if (!W[v.warn]) throw new Error('dawn_mob 버틴다 경고 꼴이 다름: ' + v.warn); v.warn = W[v.warn]; }
  note("[14] dawn_mob '맞고 버틴다': 결과의 식량 −2 를 경고에 적음('봉지를 뺏긴다' — 변형 넷 모두)");
  C('d5_flood', '모두 매달려 퍼낸다').check.base = K.floodStr;
}

// ════════════════ A3 · A4 ════════════════
// [지적 12] d2_seoha '밥을 틈으로 넣는다' — 식량만 나가고 서하는 그대로·못 만남 → 비용이 화면에 보이고, 서하가 먹고, 문이 열린다(만남)
{
  const c = C('d2_seoha', '밥을 틈으로 넣는다'); touch('d2_seoha');
  dropFx(c.out, (e) => e.verb === 'number' && e.id === 'food');
  c.cost = { food: 1 };
  c.out.text = '건빵을 틈으로 넣었다. 씹는 소리 뒤에 문이 열렸다. 여학생이 휴대폰을 뒤집어 들고 있었다.';
  add(c.out, num('hunger', -4, 'seoha'), flag('met_seoha', 1), tr('office_door', 'open'), axis('share', 1));
  note("[12] d2_seoha '밥을 틈으로 넣는다': 결과 식량 −1 → 화면 비용 식량 1 · 서하 굶주림 −4 · 만남(met_seoha)·문 열림 · 몫 +1");
}
// [지적 11] 못 본 일이 자원·시계에 닿게
{
  const setMiss = (id, pred, n) => { const r = NR(id); const e = (r.missed.effects || []).find(pred); if (!e) throw new Error('missed 칸 없음 ' + id); e.n = n; };
  setMiss('steal_food', (e) => e.id === 'food', -K.missFood);
  setMiss('steal_food_seoha', (e) => e.id === 'food', -K.missFood);
  setMiss('steal_water', (e) => e.id === 'water', -K.missWater);
  setMiss('read_notebook', (e) => e.id === 'grudge', K.missNotebook);
  setMiss('stand_stairs', (e) => e.id === 'fog', K.missStairsFog);
  note(`[11] 못 본 일: steal_food·steal_food_seoha 식량 −1 → −${K.missFood} · steal_water 물 −1 → −${K.missWater} · read_notebook 원한 +1 → +${K.missNotebook} · stand_stairs 안개 +1 → +${K.missStairsFog}`);
}
// [지적 13] 서하 물통·붕대(17,9): 위 벽·좌우 담요·아래 의자1 → 의자1을 (18,10)으로(의자 둘이 나란히). (16,10)은 사람 자리(spots.js), (18,10)은 비어 있다
if (K.benchMove) {
  const st = maps.find((m) => m.id === 'station');
  const b = st.objects.find((o) => o.id === 'bench1');
  const busy = st.objects.some((o) => o.x === 18 && o.y === 10);
  if (!b || busy) throw new Error('의자1 자리 옮기기 실패');
  if (b.x === 17 && b.y === 10) { b.x = 18; note('[13] maps station: bench1 (17,10) → (18,10) — 서하 물통·붕대(17,9)를 (17,10)에 서서 조사 · 의자 둘이 (18,10)·(19,10)에 나란히'); }
}

// ════════════════ 문장 검사 (새·바뀐 글) ════════════════
const sentences = (t) => String(t || '').split(/(?<=[.?!…])\s+(?=[^\s"」])|(?<=[.?!…]["」])\s+/).map((x) => x.trim()).filter(Boolean);
const textErr = [];
function checkText(where, t, max, maxSent) {
  if (!t) return;
  const ss = sentences(t);
  if (maxSent && ss.length > maxSent) textErr.push(`${where}: ${ss.length}문장 > ${maxSent} — ${t}`);
  for (const s of ss) if (Array.from(s).length > max) textErr.push(`${where}: ${Array.from(s).length}자 > ${max} — ${s}`);
  if (/카르마|원한|때문에|왜냐하면|티켓|작업|[0-9]/.test(t)) textErr.push(`${where}: 금지 낱말·숫자 — ${t}`);
}
const ORIG = new Set();
for (const e0 of rd('events.json')) { ORIG.add(e0.text); for (const c0 of e0.choices) for (const v of [c0].concat(swaps(c0))) { ORIG.add(v.warn); ORIG.add(v.label); if (v.req && v.req.why) ORIG.add(v.req.why); for (const r of ['out', 'ok', 'fail']) if (v[r]) ORIG.add(v[r].text); } }
const checkNew = (where, t, max, maxSent) => { if (!ORIG.has(t)) checkText(where, t, max, maxSent); };
for (const id of CHANGED) {
  const e = E(id); const fixed = e.grade === 'fixed';
  checkNew(`${id}.text`, e.text, fixed ? 50 : 40, fixed ? 5 : 4);
  e.choices.forEach((c, k) => {
    for (const v of [c].concat(swaps(c))) {
      if (v.label && !ORIG.has(v.label) && Array.from(v.label).length > 18) textErr.push(`${id}[${k}] label 18자 초과 ${v.label}`);
      for (const r of ['out', 'ok', 'fail']) if (v[r]) checkNew(`${id}[${k}].${r}`, v[r].text, fixed ? 50 : 40, 3);
      if (v.warn) checkNew(`${id}[${k}].warn`, v.warn, 30, 2);
      if (v.req && v.req.why) checkNew(`${id}[${k}].req.why`, v.req.why, 24, 1);
    }
  });
}
if (textErr.length) { console.error('문장 검사 위반:\n' + textErr.join('\n')); process.exit(1); }

// ════════════════ 쓰기 (원본 파일 꼴 그대로) ════════════════
function write(f, o) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  const crlf = src.includes('\r\n');
  let s = JSON.stringify(o, null, 2) + '\n';
  if (crlf) s = s.replace(/\n/g, '\r\n');
  fs.writeFileSync(path.join(DST, f), s, 'utf8');
}
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(SRC)) if (!fs.existsSync(path.join(DST, f))) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
write('events.json', ev); write('nightEvents.json', ne); write('numbers.json', nums); write('lines.json', lines); write('maps.json', maps);
console.log('표를 썼다 →', DST);
console.log(log.map((m) => ' · ' + m).join('\n'));
console.log('손잡이', JSON.stringify(K));
