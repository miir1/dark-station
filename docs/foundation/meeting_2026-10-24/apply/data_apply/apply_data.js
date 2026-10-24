// 데이터 담당 — 명세 spec_karma_death_neglect §2·§3·§4 (A1·A2·A4) + 명세 검토 지적의 데이터 몫 + A3 B1·B2 + 10-24 검증 잔여.
// 쓰기: node apply_data.js [원본 표 폴더=before_data] [쓸 폴더=v4/data] [손잡이 JSON]
//   원본(before_data = 고치기 전 v4/data 복사본)을 읽어 고친 표를 쓴다. 몇 번 돌려도 같은 결과(원본은 안 바뀐다).
//   파일 꼴은 원본 그대로 지킨다(events·nightEvents = CRLF 2칸, 나머지 = LF 2칸).
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..', '..', '..', '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'before_data');
const DST = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'v4', 'data');
// 손잡이 (명세 §8 + 검토 지적). 숫자는 [제안]
const K = Object.assign({
  armStr: 80, spannerStr: 80, floodStr: 75, floodCost: 1,   // A2 세 위기 판정 base (범람 80 → 75: 명세 §8 '열병이 사망의 40% 넘음 → 범람 str 낮춤', 10-24 데이터 측정)
  shutterFight: 50, shutterFightB: 45,                      // D6 덤빈다·맞선다 (지적 3: 모험·헌신이 실제로 고르게)
  mobObs: 40, mobTalk: 35, holdStr: 65, holdStrHigh: 50,    // dawn_mob·d10_hold 판정
  doom: 9, holdHigh: 14,                                    // d10_hold 걸리는 카르마 · 그 판정이 세지는 카르마(상한 뒤의 값, 지적 1-4)
  swapKarma: 8, swapTalk: 50,                               // 돌아온 사건의 남을 내미는 금기 → 판정 (지적 1-2)
  takeKarma: 3, informKarma: 5, mobKarma: 5, mobGrudge: 2, namesKarma: 8, namesGrudge: 2,
  missG: 5, missShare: 4, missWound: 2, boilG: 2,           // A4 못 본 일 (명세 §8 '게으름 생존차 < 5%p' 손잡이를 먼저 돌린 값: +4→+5 · ≥3→≥2 · +3→+4 · +1→+2)
  coldBowlW: 3,                                             // 곁가지 신호 행 cold_bowl 확률(weight/10)
  repay: 1, crateLid: 1, grab: 1,
  // 사다리 행을 곁가지(side)로: 한 밤 상한 2자리를 주민 사건과 다투지 않고 weight/10 확률로 따로 온다 — '늦게 오는 값'이 자리 싸움에 묻히지 않게
  ladderSide: 1, takeW: 7, informW: 5, mobW: 6, namesW: 8,
  sweat: 70,
  mobAll: 1, strikeSide: 0, strikeLate: 5,   // strikeLate = 카르마 ≥5 부터 원한 ≥5 인 사람의 새벽 습격(곁가지, 확률 weight/10)   // 1 = dawn_mob '가진 것을 다 내놓는다'(식량·물 전부, 지적 8의 '정말 다 내놓게')
}, JSON.parse(process.argv[4] || '{}'));

const rd = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
const ev = rd('events.json'), ne = rd('nightEvents.json'), nums = rd('numbers.json'), lines = rd('lines.json'), objs = rd('objects.json'), people = rd('people.json');
const log = [];
const note = (m) => log.push(m);

// ── 찾기 ──
const E = (id) => { const r = ev.find((x) => x.id === id); if (!r) throw new Error('사건 없음 ' + id); return r; };
const C = (id, label) => { const c = E(id).choices.find((x) => x.label === label); if (!c) throw new Error('선택지 없음 ' + id + ' / ' + label); return c; };
const NR = (id) => { const r = ne.find((n) => n.id === id); if (!r) throw new Error('밤 사건 없음 ' + id); return r; };
const O = (id) => { const r = objs.find((o) => o.id === id); if (!r) throw new Error('물건 없음 ' + id); return r; };
const outs = (c) => ['out', 'ok', 'fail'].map((k) => c[k]).filter(Boolean);
const add = (o, ...effs) => { o.effects = (o.effects || []).concat(effs); };
const dropFx = (o, pred) => { const n0 = (o.effects || []).length; o.effects = (o.effects || []).filter((e) => !pred(e)); return n0 - o.effects.length; };

// ── 효과 꼴 (원본과 같은 배열 꼴) ──
const karma = (n) => ({ verb: 'number', id: 'karma', n });
const num = (id, n, who) => (who ? { verb: 'number', id, n, who } : { verb: 'number', id, n });
const flag = (id, set) => ({ verb: 'flag', id, set });
const tr = (id, state) => ({ verb: 'trace', id, state });
const inj = (who, n) => ({ verb: 'injure', who, n });
const perm = (kind) => ({ verb: 'permanent', who: 'you', loss: kind });
const axis = (id, n) => ({ verb: 'axis', id, n });
const kill = (how) => (how ? { verb: 'kill', who: 'you', how } : { verb: 'kill', who: 'you' });
const dieLedger = (status) => ({ who: 'you', status: status || 'dead', day: '{day}', cause: '' });
const res = (text, effects, extra) => Object.assign({ text, effects: effects || [], ledger: '' }, extra || {});
const ch = (label, o) => Object.assign({ label, check: null, cost: {}, req: {}, taboo: '', warn: '' }, o);
const N = (id, o) => Object.assign({ id, role: 'grudge', actor: '', target: '', cond: '', weight: 5, kind: 'malice', trace: {}, rumor: { witness: '', line: '' }, effects: [], oncePerRun: 0 }, o);
const line = (id, text, o) => Object.assign({ id, speaker: 'narrator', context: '', grade: 'normal', text, rumor: 0, truth: 1 }, o || {});
const newEv = (o) => Object.assign({ id: '', kind: 'trial', when: '', grade: 'normal', explicit: 0, image: '', text: '', choices: [] }, o);
const insertBefore = (id, row) => { const at = ev.findIndex((x) => x.id === id); if (at < 0) throw new Error('자리 없음 ' + id); ev.splice(at, 0, row); };
const insertAfter = (id, row) => { const at = ev.findIndex((x) => x.id === id); if (at < 0) throw new Error('자리 없음 ' + id); ev.splice(at + 1, 0, row); };

// ════════════════ 수치 ════════════════
nums.push({ id: 'karma', owner: 'world', min: 0, max: 20, start: 0, perDay: 0, visible: 'never' });
note('numbers: karma 행 (world, 0~20, 화면에 안 보임)');

// ════════════════ A3 (정체 분석 B1·B2) ════════════════
{
  const n1 = dropFx(C('starve_you', '선로 밑을 뒤진다').ok, (e) => e.verb === 'axis' && e.id === 'share' && e.n === -1);
  const n2 = dropFx(C('patrol_pact', '동하를 보낸다').out, (e) => e.verb === 'axis' && e.id === 'hand' && e.n === 1);
  if (n1 !== 1 || n2 !== 1) throw new Error('A3 B1·B2 칸을 못 찾음');
  note('A3: starve_you 선로 밑을 뒤진다 ok 몫 −1 지움 · patrol_pact 동하를 보낸다 손 +1 지움');
}

// ════════════════ A1 §2-1 즉시 보상 · 쌓이는 값 ════════════════
{
  const b = C('trial_d1_bowls', '남의 그릇을 비운다'); delete b.out.target; add(b.out, num('hunger', -2, 'you'), karma(2));   // 대상 = 사건 randomSleeper (D1 동하 고정 버그)
  for (const id of ['d5_rail_body', 'd5_rail_body_b', 'd5_rail_body_c']) add(C(id, '받는다').out, karma(1));
  add(C('d5_lullaby', '놓친다').out, karma(2));
  add(C('d6_shutter', '아무것도 하지 않는다').out, karma(2), num('grudge', 3, 'gicheol'));
  add(C('d6_shutter_b', '아무것도 하지 않는다').out, karma(2));
  add(C('trade_shutter', '동하를 하루 보낸다').out, karma(3));
  add(C('patrol_pact', '동하를 보낸다').out, karma(4));
  for (const id of ['trial_d8_key', 'trial_d8_key_b']) add(C(id, '운임을 따로 챙긴다').out, karma(3));
  add(C('d9_hoard', '하나만 나눠 받는다').out, karma(1));
  add(C('starve_you', '창고를 턴다').out, karma(2));
  for (const o of outs(C('starve_you', '남의 그릇을 뺏는다'))) add(o, karma(3));
  add(C('fever_night', '남의 담요를 끌어온다').out, karma(3));
  if (K.sweat !== 70) C('fever_night', '불가에서 땀을 뺀다').check.base = K.sweat;   // 명세 §8: 열병이 사망의 40% 넘음 → 70 → 75
  add(C('d10_walk_weak', '옆 사람 물병을 비운다').out, karma(3));
  add(C('trip_a2_bodybag', '가져간다').out, karma(1));
  add(C('trip_b1_gate', '지나친다').out, karma(2));
  add(C('dawn_strike', '그릇 둘을 내민다').out, karma(-1));
  note('A1 §2-1: 즉시 보상 칸에 카르마 (+1~+4) · 갚기 dawn_strike 그릇 둘 −1 · trial_d1_bowls 남의 그릇 = 사건 대상·당신 굶주림 −2');
}

// ── 돌아온 사건의 남을 내미는 금기: 카르마가 높으면 판정 (지적 1-2). 성공 = 원래 결과, 실패 = 죽음 ──
function tabooSwap(c, warn, failText, how) {
  const base = c.out;
  c.swap = [{ when: `karma>=${K.swapKarma}`, check: { skill: 'talk', base: K.swapTalk }, warn,
    ok: res(base.text, base.effects.slice()), fail: res(failText, [kill(how)], { ledger: dieLedger(how === 'ascended' ? 'ascended' : 'dead') }) }];
}
// ── '버틴다' (늘 열린 몸값 — 죽지 않는다, E4 출구). 되풀이할수록·카르마가 높을수록 값이 커진다 (지적 1·11·21) ──
//   swap 순서 = 앞에서부터 처음 맞는 것. 영구 손상은 아직 성한 곳만(깃발 you_<부위>) — 경고 글이 사실과 어긋나지 않게
//   keep: 카르마가 높으면 위협을 끝내지 못한다(깃발을 안 지움 → 다음 밤·새벽에 다시 온다)
function endure(evId, label, o) {
  const fx = (lossKind, keepFlag) => [].concat(keepFlag ? [] : o.clear, lossKind ? [perm(lossKind)] : [], o.effects);
  const sw = [];
  const loss = o.loss; // { kind, flag, warn, text, keepText }
  if (o.keep) {
    if (loss) sw.push({ when: `karma>=${K.swapKarma} & fired:${evId}>=1 & !flag:${loss.flag}`, warn: `${loss.warn}. ${o.keep.warn}`, out: res(loss.keepText, fx(loss.kind, true)) });
    sw.push({ when: `karma>=${K.swapKarma}`, warn: `${o.warn}. ${o.keep.warn}`, out: res(o.keep.text, fx(null, true)) });
  }
  if (loss) sw.push({ when: `fired:${evId}>=1 & !flag:${loss.flag}`, warn: loss.warn, out: res(loss.text, fx(loss.kind, false)) });
  return ch(label, { warn: o.warn, out: res(o.text, fx(null, false)), swap: sw.length ? sw : undefined });
}

// ── dawn_strike: 맞고 버틴다(새) · 옆 담요 금기 swap · 대상은 사건에서 (targetOptional) ──
{
  const ds = E('dawn_strike');
  ds.target = 'randomSleeper'; ds.targetOptional = 1;
  const point = C('dawn_strike', '옆 담요를 가리킨다'); delete point.out.target; add(point.out, karma(3));
  tabooSwap(point, '아무도 안 돌아서면 끝이다', '손가락이 허공을 가리켰다. 아무도 돌아보지 않았다. 손이 다시 목을 눌렀다.');
  ds.choices.splice(1, 0, endure('dawn_strike', '맞고 버틴다', {
    warn: '크게 다친다', text: '목을 비틀어 빠져나왔다. 그림자가 갈비뼈를 걷어찼다.',
    clear: [flag('dawn_strike', 0)], effects: [inj('you', 2), num('grudge', -1, 'all')],
    loss: { kind: 'ear', flag: 'you_ear', warn: '귀를 잃는다', text: '목을 비틀어 빠져나왔다. 그림자가 귀를 걷어찼다. 한쪽 귀가 먹었다.', keepText: '그림자가 귀를 걷어찼다. 한쪽 귀가 먹었다. 그림자는 제 담요에 앉아 이쪽을 봤다.' },
    keep: { warn: '새벽에 또 온다', text: '목을 비틀어 빠져나왔다. 그림자가 갈비뼈를 걷어찼다. 그림자는 제 담요에 앉아 이쪽을 봤다.' },
  }));
  note('dawn_strike: [1] 맞고 버틴다(부상 2 · 두 번째부터 귀 · 카르마 ≥8 이면 다음 새벽에 또 옴) · 옆 담요 금기 카르마 +3, 카르마 ≥8 이면 talk 50 (실패 = 죽음) · 사건 대상 randomSleeper + targetOptional');
}
// ── called_up: 손등을 깨물며 버틴다(새) · 다른 이름 금기 swap · targetOptional ──
{
  const cu = E('called_up');
  cu.targetOptional = 1;
  const other = C('called_up', '다른 이름을 댄다'); add(other.out, karma(3));
  tabooSwap(other, '그 사람이 되받으면 끝이다', '그 사람이 깨어 당신 이름을 되받아 댔다. 계단이 따뜻해졌다. 신발이 저절로 벗겨졌다.', 'ascended');
  const at = cu.choices.findIndex((c) => c.label === '귀를 막는다') + 1;
  cu.choices.splice(at, 0, endure('called_up', '손등을 깨물며 버틴다', {
    warn: '다친다', text: '피 맛이 날 때까지 깨물었다. 이름은 새벽에 그쳤다.',
    clear: [flag('named_you', 0)], effects: [inj('you', 1)],
    loss: { kind: 'finger', flag: 'you_finger', warn: '손가락을 잃는다', text: '손가락 한 마디를 물어뜯었다. 이름은 새벽에 그쳤다.', keepText: '손가락 한 마디를 물어뜯었다. 이름은 새벽까지 그치지 않았다.' },
    keep: { warn: '이름이 또 온다', text: '피 맛이 날 때까지 깨물었다. 이름은 새벽까지 그치지 않았다.' },
  }));
  note('called_up: [2] 손등을 깨물며 버틴다(부상 1 · 두 번째부터 손가락 · 카르마 ≥8 이면 다음 밤에 또 옴) · 다른 이름 금기 카르마 +3, 카르마 ≥8 이면 talk 50 (실패 = 올라감) · targetOptional');
}
// ── 늦게 오는 값 — 사다리 (nightEvents 새 행) ──
{
  const side = K.ladderSide ? { side: 1 } : {};
  ne.push(N('take_back_you', Object.assign({ actor: 'grudge>=4', target: 'you', cond: `karma>=${K.takeKarma} & day>=4`, weight: K.ladderSide ? K.takeW : 7, effects: [num('food', -2), num('grudge', -2, 'actor')], trace: { bowl_you: 'empty', crate_food: 'open' }, public: 1 }, side)));
  ne.push(N('inform_you', Object.assign({ role: 'inform', actor: 'grudge>=4', target: 'you', cond: `karma>=${K.informKarma} & day>=5 & fog>=2 & !flag:named_you`, weight: K.ladderSide ? K.informW : 7, effects: [flag('named_you', 1), num('counted', 1, 'target'), num('grudge', -1, 'actor')], trace: { shoes_stairs: 'one' } }, side)));
  ne.push(N('mob_you', Object.assign({ role: 'kill', actor: `grudge>=${K.mobGrudge}`, target: 'you', cond: `karma>=${K.mobKarma} & day>=5 & !flag:dawn_mob`, weight: K.ladderSide ? K.mobW : 10, effects: [flag('dawn_mob', 1)], trace: { notebook_you: 'moved' }, public: 1 }, side)));
  // 4단(지적 4 · 03 결정 E9 '안개는 무심하다'): 세계 시계가 아니라 사람 — 원한을 품은 주민이 밤에 계단 쪽에 대고 당신 이름을 댄다
  ne.push(N('grudge_names_you', Object.assign({ role: 'inform', actor: `grudge>=${K.namesGrudge}`, target: 'you', cond: `karma>=${K.namesKarma} & fog>=3 & !flag:named_you`, weight: K.ladderSide ? K.namesW : 10, effects: [flag('named_you', 1), num('counted', 1, 'target')], trace: { shoes_stairs: 'one' } }, side)));
  // 3단 둘째 줄: 원한 ≥5 인 사람이 새벽에 목을 누른다(기존 grudge_strike_you 와 같은 dawn_strike) — 카르마 ≥5 부터, 자리 싸움 밖에서
  if (K.strikeLate) ne.push(N('grudge_strike_late', Object.assign({ role: 'kill', actor: 'grudge>=5 & self!=dongha', target: 'you', cond: `karma>=${K.mobKarma} & day>=5 & !flag:dawn_strike & !flag:dawn_dongha & !flag:dawn_dongha2`, weight: K.strikeLate, effects: [flag('dawn_strike', 1)], trace: { blanket_actor: 'rolled', notebook_you: 'moved' }, rumor: { witness: '', line: 'rum_over_you' }, public: 1 }, side)));
  // 신호(§2-4): 당신 그릇이 줄 끝으로 — 곁가지 행(지적 20: 한 밤 상한 밖, 대상 없음)
  ne.push(N('cold_bowl', { actor: 'grudge>=3', target: '', cond: 'day>=2 & trace:bowl_you==full', weight: K.coldBowlW, kind: 'neutral', trace: { bowl_you: 'pushed' }, side: 1 }));
  note('nightEvents 사다리: take_back_you(카르마≥3) · inform_you(≥5) · mob_you(≥5, public) · grudge_names_you(≥8, 사람이 하는 일 — 옛 fog_names_you 대신) · cold_bowl(곁가지, 흔적만)');
}
// ── dawn_mob (새, 3단 둘러섬) ──
{
  const pointOut = res('손끝을 따라 담요들이 돌아섰다. 그 사람이 웅크린 채 맞았다.', [flag('dawn_mob', 0), inj('target', 2), num('grudge', 3, 'target'), karma(3), axis('share', -1), axis('hand', -1)]);
  const point = ch('다른 사람을 가리킨다', { taboo: 'give_other', warn: '그 사람이 대신 맞는다', out: pointOut });
  tabooSwap(point, '아무도 안 돌아서면 끝이다', '손끝을 따라 아무도 돌아서지 않았다. 발길질이 다시 당신에게 왔다.');
  ev.splice(ev.findIndex((x) => x.id === 'dawn_strike') + 1, 0, newEv({ id: 'dawn_mob', when: 'phase==trace & flag:dawn_mob', explicit: 1, once: 0,
    target: 'randomSleeper', targetIf: 'grudge<2', targetOptional: 1,   // 지적 14: 둘러선 사람(원한 ≥2)은 가리킬 수 없다 · 다 둘러섰으면 금기만 잠긴다
    text: '새벽에 눈을 떴다. 담요들이 당신을 둘러서 있다. 아무도 말하지 않는다. 누가 당신 봉지를 들고 있다.',
    choices: [
      K.mobAll
        ? ch('가진 것을 다 내놓는다', { cost: { food: 1, water: 1 }, warn: '식량과 물이 다 나간다', out: res('봉지와 물병이 손에서 손으로 갔다. 창고 상자까지 비었다. 담요들이 하나씩 돌아갔다.', [flag('dawn_mob', 0), num('food', -16), num('water', -16), tr('crate_food', 'empty'), num('grudge', -3, 'all'), karma(-2), axis('share', 1)]) })
        : ch('봉지와 물병을 내놓는다', { cost: { food: 3, water: 2 }, warn: '식량 셋과 물 둘이 나간다', out: res('봉지와 물병이 손에서 손으로 갔다. 담요들이 하나씩 돌아갔다.', [flag('dawn_mob', 0), num('grudge', -3, 'all'), karma(-2), axis('share', 1)]) }),
      endure('dawn_mob', '맞고 버틴다', {
        warn: '크게 다친다', text: '발길질이 멎을 때까지 웅크렸다. 봉지는 그들이 가져갔다.',
        clear: [flag('dawn_mob', 0)], effects: [inj('you', 2), num('food', -2), num('grudge', -1, 'all')],
        loss: { kind: 'leg', flag: 'you_leg', warn: '다리를 잃는다', text: '발길질이 무릎으로 왔다. 무릎이 반대로 꺾였다. 봉지는 그들이 가져갔다.', keepText: '발길질이 무릎으로 왔다. 무릎이 반대로 꺾였다. 담요들은 눕지 않고 앉아 있었다.' },
        keep: { warn: '새벽에 또 온다', text: '발길질이 멎을 때까지 웅크렸다. 봉지는 그들이 가져갔다. 담요들은 눕지 않고 앉아 있었다.' },
      }),
      ch('손가락 하나로 갚는다', { req: { notPermanent: 'finger' }, warn: '손가락을 잃는다', out: res('누가 당신 손을 판자에 눌렀다. 칼이 한 번 내려왔다. 판자에 손가락 한 마디가 남았다.', [flag('dawn_mob', 0), perm('finger'), inj('you', 1), num('grudge', -2, 'all')]) }),
      point,
      ch('밀치고 달아난다', { check: { skill: 'obs', base: K.mobObs }, warn: '넘어지면 끝이다', ok: res('선로 쪽으로 굴렀다. 무릎이 깨졌다.', [flag('dawn_mob', 0), inj('you', 1)]), fail: res('발목이 잡혔다. 담요가 얼굴을 덮었다. 발길질이 멎지 않았다.', [kill()], { ledger: dieLedger() }) }),
      ch('무릎을 꿇고 빈다', { check: { skill: 'talk', base: K.mobTalk }, warn: '안 들으면 끝이다', ok: res('누가 먼저 돌아섰다. 다들 따라갔다.', [flag('dawn_mob', 0), num('grudge', -1, 'all')]), fail: res('아무도 대답하지 않았다. 화로가 멀어졌다.', [kill()], { ledger: dieLedger() }) }),
    ] }));
  note('events: dawn_mob (새, explicit) — 내놓는다(식량 3·물 2, 카르마 −2) · 맞고 버틴다 · 손가락 · 가리킨다(금기, targetIf grudge<2, 카르마 ≥8 이면 판정) · 달아난다 obs 40 · 빈다 talk 35');
}
// ── d10_hold (새, 5단 — D10 낮, 열차·걷기 앞) ──
{
  const strong = ch('뿌리치고 걷는다', { check: { skill: 'str', base: K.holdStr }, warn: '주저앉으면 끝이다',
    ok: res('소매가 찢어졌다. 선로가 당신을 받았다.', [inj('you', 1)]), fail: res('무릎이 꺾였다. 아무도 당신을 일으키지 않았다.', [kill()], { ledger: dieLedger() }) });
  strong.swap = [{ when: `karma>=${K.holdHigh}`, check: { skill: 'str', base: K.holdStrHigh } }];   // 상한에 닿은 뒤의 값(지적 1-4): 판정이 세진다
  const hold = endure('d10_hold', '끌려가며 버틴다', { warn: '크게 다친다', text: '선로 끝까지 끌려가 맞았다. 그래도 걸어 나왔다.', clear: [], effects: [inj('you', 2)] });
  hold.swap = [{ when: `karma>=${K.holdHigh} & !flag:you_leg`, warn: '크게 다친다. 다리를 잃는다', out: res('선로 끝까지 끌려가 맞았다. 무릎이 반대로 꺾였다. 그래도 기어 나왔다.', [perm('leg'), inj('you', 2)]) }];
  insertBefore('d10_train', newEv({ id: 'd10_hold', when: `day==10 & phase==day & karma>=${K.doom}`, explicit: 1,
    target: 'most:grudge', targetIf: 'grudge>=3',   // 지적 6: 원한이 가장 높은, 역에 있는 사람 — 없으면 안 걸린다
    text: '떠날 채비를 하는데 누가 당신 소매를 잡았다. 밤마다 당신 쪽을 등지고 눕던 사람이다. 손을 놓지 않는다.',
    choices: [
      ch('가진 것을 내준다', { cost: { food: 2, water: 1 }, warn: '식량 둘과 물 하나가 나간다', out: res('봉지를 받아 들고 손을 놓았다.', [karma(-2), num('grudge', -3, 'all')]) }),
      hold,
      ch('손가락을 내준다', { req: { notPermanent: 'finger' }, warn: '손가락을 잃는다', out: res('돌 위에 손을 올렸다. 그가 내리쳤다. 돌 위에 손가락이 굴렀다.', [perm('finger'), inj('you', 1), num('grudge', -3, 'target')]) }),
      strong,
    ] }));
  note(`events: d10_hold (새, explicit) — when day==10 & 카르마≥${K.doom}, 대상 most:grudge·grudge≥3 · 내준다(카르마 −2) · 끌려가며 버틴다 · 손가락 · 뿌리친다 str ${K.holdStr} (카르마 ≥${K.holdHigh} 이면 ${K.holdStrHigh}, 버틴다는 다리)`);
}
// ── D10 이기심의 같은 날 값(지적 2): 물병을 빼앗긴 사람이 발목을 잡는다 ──
if (K.grab) {
  add(C('d10_walk_weak', '옆 사람 물병을 비운다').out, flag('took_bottle_target', 1));
  const legGrab = ch('끌려 넘어진다', { warn: '다리를 잃는다', out: res('선로에 얼굴부터 넘어졌다. 발목이 반대로 꺾였다. 그 사람은 물병을 들고 앞서갔다.', [perm('leg'), inj('you', 1)]),
    swap: [{ when: 'flag:you_leg', warn: '크게 다친다', out: res('선로에 얼굴부터 넘어졌다. 이가 하나 나갔다. 그 사람은 물병을 들고 앞서갔다.', [inj('you', 2)]) }] });
  insertAfter('d10_walk_weak', newEv({ id: 'd10_grab', when: 'day==10 & phase==day & !flag:passage_open', explicit: 1,
    target: 'randomSleeper', targetIf: 'flag:took_bottle_target',
    text: '몇 걸음 못 가서 발목이 잡혔다. 물병을 빼앗긴 사람이다. 손톱이 살에 박힌다.',
    choices: [
      ch('물병을 돌려준다', { cost: { water: 1 }, warn: '물이 준다', out: res('물병을 내밀었다. 손이 풀렸다.', [num('thirst', -3, 'target'), num('grudge', -2, 'target'), karma(-1)]) }),
      legGrab,
      ch('발을 빼낸다', { check: { skill: 'str', base: 60 }, warn: '넘어지면 끝이다', ok: res('발목 살이 손톱에 벗겨졌다. 걸었다.', [inj('you', 1)]), fail: res('선로에 엎어졌다. 그 사람이 등을 밟고 지나갔다. 아무도 일으키지 않았다.', [kill()], { ledger: dieLedger() }) }),
    ] }));
  note('events: d10_grab (새) — d10_walk_weak 물병 금기 뒤 같은 낮에 그 사람이 발목을 잡는다(물 1로 돌려준다 · 끌려 넘어진다 · 발을 빼낸다 str 60)');
}
// ── 갚는 길(지적 22): 배식 때 등 돌린 사람에게 내 몫을 덜어 준다 (P1 repay 의 가벼운 꼴) ──
if (K.repay) {
  insertAfter('trial_d1_bowls', newEv({ id: 'repay_bowl', when: 'day>=2 & phase==ration & karma>=1', once: 0,
    target: 'most:grudge', targetIf: 'grudge>=3 & !flag:repay_asked_target',   // 한 사람에게 한 번만 묻는다(매일 뜨지 않게)
    text: '줄 끝에 누가 빈 그릇을 들고 서 있다. 당신 쪽을 등지고 있다.',
    choices: [
      ch('그냥 지나간다', { out: res('그릇을 받아 들고 불가로 갔다.', [flag('repay_asked_target', 1)]) }),
      ch('내 몫을 덜어 준다', { warn: '당신이 굶는다', out: res('당신 그릇에서 반을 덜어 그 그릇에 부었다. 그 사람이 처음으로 돌아봤다.', [flag('repay_asked_target', 1), num('hunger', 2, 'you'), num('hunger', -2, 'target'), num('grudge', -3, 'target'), karma(-1), axis('share', 1)]) }),
    ] }));
  note('events: repay_bowl (새) — 배식 때 원한 ≥3 인 사람에게 내 몫을 덜어 준다(당신 굶주림 +2, 그 사람 원한 −3, 카르마 −1)');
}

// ════════════════ A2 §3 이른 날의 죽음 ════════════════
{
  // D2 셔터: 말 걸기 실패 = 팔이 끼는 위기 (지적 27: 사건 대상 없이, 금기 결과에만 대상)
  const talk = C('d2_night_shutter', '틈으로 말을 건다');
  talk.fail.text = '말이 끊겼다. 틈으로 손 하나가 들어왔다.';
  talk.fail.effects = talk.fail.effects.filter((e) => e.verb !== 'injure').concat([flag('shutter_arm', 1)]);
  insertAfter('d2_night_shutter', newEv({ id: 'd2_shutter_arm', when: 'day==2 & phase==night & flag:shutter_arm', explicit: 1,
    text: '틈으로 들어온 손이 당신 손목을 잡았다. 너머에서 당긴다. 셔터 날이 팔꿈치까지 왔다.',
    choices: [
      ch('통조림을 내밀어 바꾼다', { cost: { food: 2 }, warn: '식량이 준다', out: res('통조림이 넘어가자 손이 풀렸다. 손목에 손톱자국이 남았다.', [flag('shutter_arm', 0), inj('you', 1)]) }),
      ch('옆 사람 팔을 내민다', { taboo: 'give_other', warn: '그 사람이 대신 끌린다', out: res('잠든 팔을 틈에 밀었다. 비명이 셔터를 울렸다.', [flag('shutter_arm', 0), inj('target', 2), num('grudge', 4, 'target'), karma(3), axis('share', -1), axis('hand', -1)], { target: 'randomSleeper' }) }),
      ch('팔을 비틀어 뺀다', { check: { skill: 'str', base: K.armStr }, warn: '못 빼면 끝이다', ok: res('팔꿈치 살이 셔터 날에 남았다. 팔은 돌아왔다.', [flag('shutter_arm', 0), inj('you', 2)]), fail: res('셔터 밑으로 어깨까지 끌려갔다. 너머에서 웃었다.', [flag('shutter_arm', 0), kill()], { ledger: dieLedger() }) }),
    ] }));
  // D4 기철: 기철을 만난 판 모두 · 믿으면 부품이 빈다 · 세거나 추궁에 지면 밤에 온다
  const g = E('trial_d4_gicheol'); g.when = 'day==4 & phase==day & alive:gicheol & flag:met_gicheol';
  const trust = C('trial_d4_gicheol', '믿는다'); trust.warn = '부품이 빈다'; trust.out.text = '고개를 끄덕였다. 기철이 헤드램프를 껐다. 그날 밤 부품 상자가 가벼워졌다.'; add(trust.out, num('parts', -2));
  const count = C('trial_d4_gicheol', '상자를 센다'); count.warn = '헤드램프가 당신을 따라온다'; add(count.out, flag('gicheol_counted', 1));
  const press = C('trial_d4_gicheol', '추궁한다'); press.fail.effects = [inj('you', 1), flag('gicheol_counted', 1)];
  insertAfter('trial_d4_gicheol', newEv({ id: 'd4_spanner', when: 'day==4 & phase==night & flag:gicheol_counted & alive:gicheol', explicit: 1,
    target: 'randomSleeper', targetIf: 'self!=gicheol',   // 지적 14: 기철이 자기를 때리지 않게
    text: '기철이 머리맡에 서 있다. 헤드램프가 꺼져 있다. 손에 스패너가 있다. "셌지."',
    choices: [
      ch('그릇 하나로 입을 막는다', { cost: { food: 1 }, warn: '식량이 준다', out: res('기철이 그릇을 받아 들고 돌아섰다.', [flag('gicheol_counted', 0), num('grudge', -2, 'gicheol')]) }),
      ch('다른 사람이 셌다고 한다', { taboo: 'give_other', warn: '그 사람이 맞는다', out: res('헤드램프가 켜지고 다른 담요로 갔다. 둔한 소리가 두 번 났다.', [flag('gicheol_counted', 0), inj('target', 2), num('grudge', 4, 'target'), karma(3), axis('share', -1), axis('hand', -1)]) }),
      ch('스패너를 막는다', { check: { skill: 'str', base: K.spannerStr }, warn: '못 막으면 끝이다', ok: res('팔뚝으로 받았다. 뼈가 울렸다.', [flag('gicheol_counted', 0), inj('you', 1)]), fail: res('두 번째가 관자놀이로 왔다. 베개에 피가 번졌다.', [flag('gicheol_counted', 0), kill()], { ledger: dieLedger() }) }),
    ] }));
  // D5 범람: 퍼내기는 판정, 창고를 버리려면 식량이 있어야, 남의 담요 금기(물길을 막는다)
  const ab = C('d5_flood', '창고를 버리고 뺀다'); ab.cost = { food: K.floodCost };
  const bail = C('d5_flood', '모두 매달려 퍼낸다');
  bail.check = { skill: 'str', base: K.floodStr }; bail.warn = '쓸려 가면 끝이다';
  bail.ok = res(bail.out.text, bail.out.effects); bail.fail = res('발이 물살에 들렸다. 배수구 쪽으로 끌려갔다.', [kill()], { ledger: dieLedger() }); delete bail.out;
  E('d5_flood').choices.push(ch('남의 담요로 물길을 막는다', { taboo: 'take_blanket', warn: '그 사람이 밤새 젖는다',
    out: res('담요를 말아 물길에 박았다. 주인은 젖은 채 떨었다. 물은 내려갔다.', [num('flood', -3), inj('target', 1), num('fear', 2, 'target'), num('grudge', 3, 'target'), karma(2), axis('share', -1)], { target: 'randomSleeper' }) }));
  // D6 횃불: 덤벼서 지면 죽는다 · 이기는 쪽이 넉넉해 모험·헌신이 실제로 고른다(지적 3)
  for (const [id, lb, base] of [['d6_shutter', '동하와 덤빈다', K.shutterFight], ['d6_shutter_b', '맞선다', K.shutterFightB]]) {
    const c = C(id, lb); c.warn = '넷이다. 지면 끝이다'; c.check.base = base;
    c.fail = res('횃불이 얼굴로 왔다. 바닥이 가까워졌다.', [kill()].concat(c.fail.effects.filter((e) => e.verb === 'trace' || (e.verb === 'number' && e.id === 'food') || (e.verb === 'flag' && e.id === 'eunji_sold'))), { ledger: dieLedger() });
  }
  note(`A2: d2_night_shutter 말 걸기 실패 → d2_shutter_arm(새, str ${K.armStr}) · trial_d4_gicheol 만난 판 모두 → d4_spanner(새, str ${K.spannerStr}, 기철 빼기) · d5_flood 퍼낸다 str ${K.floodStr}·창고 비용 식량 1·남의 담요 금기 · d6 덤빈다 str ${K.shutterFight}/${K.shutterFightB} 실패 = 죽음`);
}

// ════════════════ A4 §4 게으름 = 처벌 ════════════════
{
  const pub = ['starve_resident', 'ascend', 'mari_pillow', 'eunji_goes_instead', 'dohyeon_valve', 'grudge_strike_you', 'dongha_pipe_you', 'dongha_end_you', 'steal_you'];
  for (const id of pub) NR(id).public = 1;
  if (K.strikeSide) { const g = NR('grudge_strike_you'); g.side = 1; g.weight = K.strikeSide; }   // 원한 습격도 자리 싸움 밖에서(사다리와 같은 이유)
  // 도둑질: 본 사람이 있으면 봉지 하나가 돌아온다 · 못 보면 한 번 더 가져가고, 잡힐 때까지 밤마다 온다
  for (const id of ['steal_food', 'steal_food_seoha']) {
    NR(id).caught = { effects: [num('food', 1)] };
    NR(id).missed = { effects: [num('food', -1), flag('unseen_thief_actor', 1)], trace: { crate_food: 'open' } };
  }
  ne.push(N('steal_food_again', { role: 'steal', actor: 'flag:unseen_thief_actor', target: '', cond: 'food>=1', weight: 10, effects: [num('food', -2)], trace: { crate_food: 'open' }, caught: { effects: [flag('unseen_thief_actor', 0)] } }));
  ne.push(N('steal_meds_again', { role: 'steal', actor: 'flag:unseen_thief_actor', target: '', cond: 'meds>=1', weight: 10, effects: [num('meds', -1)], trace: { crate_food: 'open' }, caught: { effects: [flag('unseen_thief_actor', 0)] } }));
  // 물: 본 사람이 있으면 물통 주인이 되찾는다 · 못 보면 주인이 마른다
  NR('steal_water').caught = { effects: [num('thirst', -2, 'target')] };
  NR('steal_water').missed = { effects: [num('thirst', 3, 'target'), num('water', -1)], trace: { bottle_target: 'empty' } };
  // 상처: 보면 붕대를 갈아 준다 · 못 본 상처는 썩는다
  NR('wound_rots').caught = { effects: [inj('actor', -1)], trace: { bandage_actor: 'clean' } };
  NR('wound_rots').missed = { effects: [inj('actor', K.missWound)], trace: { bandage_actor: 'rot' } };
  NR('swing_pipe').missed = { effects: [inj('target', 1)], trace: { bandage_target: 'wet' } };
  // 원한: 보면 누그러진다 · 못 본 원한은 터진다
  for (const id of ['hungry_blames_you', 'eye_you']) {
    NR(id).caught = { effects: [num('grudge', -1, 'actor'), flag('unseen_grudge_actor', 0)] };
    NR(id).missed = { effects: [num('grudge', K.missG, 'actor'), flag('unseen_grudge_actor', 1)], trace: { blanket_actor: 'rolled' } };
  }
  NR('read_notebook').missed = { effects: [num('grudge', 1, 'actor')], trace: { notebook_you: 'moved' } };
  ne.push(N('grudge_boils', { role: 'kill', actor: `flag:unseen_grudge_actor & grudge>=${K.boilG} & self!=dongha`, target: 'you', cond: 'day>=3 & !flag:dawn_strike & !flag:dawn_dongha & !flag:dawn_dongha2', weight: 10, effects: [flag('dawn_strike', 1), flag('unseen_grudge_actor', 0)], trace: { blanket_actor: 'rolled', notebook_you: 'moved' }, public: 1 }));
  // 안개: 계단에 선 사람을 보면 데려온다 · 못 보면 재가 내려오고 그 사람이 먼저 올라간다
  NR('stand_stairs').caught = { effects: [flag('stood_stairs_actor', 0)] };
  NR('stand_stairs').missed = { effects: [num('fog', 1), flag('unseen_stairs_actor', 1)], trace: { stairs_ash: 'deep' } };
  ne.push(N('ascend_unseen', { role: 'ascend', kind: 'neutral', actor: 'flag:unseen_stairs_actor', target: '', cond: 'fog>=3', weight: 10, effects: [{ verb: 'kill', who: 'actor', how: 'ascended' }, num('fear', 3, 'bondOfActor')], trace: { shoes_stairs: 'pair', blanket_actor: 'empty' }, public: 1 }));
  // 주민의 위기: 못 본 희생은 혼자 쓰러진다 · 본 희생은 다음 배식 때 갚을 수 있다(지적 9: 자동 차감 대신 선택)
  NR('share_bowl').caught = { effects: [flag('share_seen_actor', 1)] };
  NR('share_bowl').missed = { effects: [num('hunger', K.missShare, 'actor')], trace: { bowl_actor: 'empty' } };
  NR('soonrye_water').missed = { effects: [num('thirst', 2, 'soonrye'), inj('soonrye', 1)], trace: { bottle_soonrye: 'empty' } };
  NR('dongha_carries').missed = { effects: [num('hunger', 2, 'dongha')], trace: { bowl_dongha: 'empty' } };
  insertAfter('repay_bowl', newEv({ id: 'share_back', when: 'day>=2 & phase==ration', once: 0,
    target: 'randomSleeper', targetIf: 'flag:share_seen_target',
    text: '밤에 제 그릇을 남에게 밀어 주던 사람이다. 오늘도 제 그릇을 옆으로 밀어 둔다.',
    choices: [
      ch('모른 척한다', { out: res('그릇은 옆으로 밀린 채였다.', [flag('share_seen_target', 0)]) }),
      ch('내 몫을 덜어 준다', { warn: '당신이 굶는다', out: res('당신 그릇에서 반을 덜어 그 그릇에 부었다. 그 사람이 고개를 숙였다.', [flag('share_seen_target', 0), num('hunger', 2, 'you'), num('hunger', -3, 'target'), axis('share', 1)]) }),
    ] }));
  note(`A4: missed·caught — steal_food(·_seoha) · steal_water · wound_rots · swing_pipe · hungry_blames_you · eye_you · read_notebook · stand_stairs · share_bowl · soonrye_water · dongha_carries / 새 밤 행 steal_food_again · steal_meds_again · grudge_boils · ascend_unseen / public ${pub.length + 4}행 / share_bowl 본 일 → 배식 사건 share_back(선택, 자동 차감 없음)`);
}

// ════════════════ 대사 (조사 _late · 토스트 · 신호) ════════════════
{
  const L = [
    line('toast_late', '어제 못 본 자리가 그대로다.', { speaker: 'ui', grade: 'toast' }),
    line('insp_crate_open_late', '뚜껑이 어제처럼 열려 있다. 봉지가 더 비었다.'),
    line('insp_bottle_empty_late', '물통 주둥이가 말라 갈라졌다. 이틀째 빈 채다.'),
    line('insp_bandage_rot_late', '붕대가 검게 말라붙었다. 어제부터 아무도 안 풀었다.'),
    line('insp_bandage_wet_late', '붕대가 어제부터 피에 젖은 채다. 아무도 갈지 않았다.'),
    line('insp_blanket_rolled_late', '담요가 당신 쪽을 등지고 말려 있다. 어제도 그랬다.'),
    line('insp_notebook_moved_late', '연필이 어제처럼 옆에 있다. 펼친 장이 또 바뀌었다.'),
    line('insp_stairs_deep_late', '재가 한 칸 더 내려왔다. 계단 위 신발 자국이 그대로다.'),
    line('insp_bowl_empty_late', '빈 그릇이다. 손잡이가 옆 그릇 쪽으로 돌려져 있다.'),   // 지적 27: 그릇은 아침마다 비워지고 배식에서 다시 찬다 — 지금 모습만
    line('insp_bowl_pushed', '당신 그릇이 줄 끝으로 밀려나 있다.'),
  ];
  for (const l of L) { if (lines.some((x) => x.id === l.id)) throw new Error('이미 있는 줄 ' + l.id); lines.push(l); }
  note(`lines: 새 줄 ${L.length} (toast_late · _late 조사 글 8 · insp_bowl_pushed)`);
}
// ── 물건: 당신 그릇 새 상태 pushed ──
{
  const b = O('bowl_you'); b.states.push('pushed'); b.inspectLine.pushed = 'insp_bowl_pushed';
  note('objects: bowl_you 상태 pushed (줄 끝으로 밀림) + 조사 글');
}
// ── 인물: 차가운 호칭 (E5) ──
{
  const cold = { soonrye: '이봐', gicheol: '어이', eunji: '야', dongha: '당신', seoha: '', mari: '' };
  for (const p of people) if (Object.prototype.hasOwnProperty.call(cold, p.id)) p.addressCold = cold[p.id];
  note('people: addressCold — 순례 이봐 · 기철 어이 · 은지 야 · 동하 당신 · 서하·마리 "" (부르지 않는다)');
}

// ════════════════ 10-24 검증 잔여 ════════════════
{
  // 잔해 혼자 넘기 실패 글: 다시 해 볼 수 있는데 '혼자서는 못 넘겠다'고 단정하던 것 → 일어난 일만
  const r = C('pro_rubble_alone', '혼자 넘어 본다');
  r.fail.text = '가방이 찢겨 생수 한 병이 굴렀다. 발이 미끄러져 도로 내려왔다. 헤드램프 빛이 아직 당신 발에 있다.';
  note('pro_rubble_alone 실패 글: "혼자서는 못 넘겠다" → "발이 미끄러져 도로 내려왔다" (다시 해 볼 수 있다는 사실과 맞게)');
  // 창고 상자 'Space 열기': 닫힌 채 조사하면 아무 일도 없던 것 → 뚜껑을 여는 선택(닫는다 / 봉지 하나를 꺼낸다 = 금기)
  if (K.crateLid) {
    insertAfter('d1_night_storage', newEv({ id: 'crate_lid', when: 'map==station & inspect:crate_food & trace:crate_food==closed & (phase==trace | phase==day | phase==evening)', once: 0,
      text: '창고 상자 뚜껑을 들었다. 배식 때만 여는 상자다.',   // 사건 대상 없음 — 아직 아무도 안 만난 D0 에도 '열기'가 열린다. 본 사람은 결과의 target(만난 주민 중 무작위, 없으면 아무도 못 봄)
      choices: [
        ch('뚜껑을 닫는다', { out: res('뚜껑을 도로 닫았다.', []) }),
        ch('봉지 하나를 꺼낸다', { cost: { food: 1 }, taboo: 'steal_crate', warn: '누가 볼 수 있다', out: res('봉지 하나를 소매에 넣었다. 뚜껑 닫는 소리가 컸다.', [num('hunger', -3, 'you'), num('grudge', 2, 'target'), karma(1), tr('crate_food', 'open'), axis('share', -1)], { target: 'randomSleeper' }) }),
      ] }));
    note('events: crate_lid (새) — 닫힌 창고 상자를 조사하면 뚜껑을 연다: 닫는다 / 봉지 하나를 꺼낸다(금기, 식량 1 → 당신 굶주림 −3, 본 사람 원한 +2, 카르마 +1) · 사건 대상 없음(D0 에도 열린다)');
  }
}

// ════════════════ 문장 검사 (새·바뀐 글) ════════════════
const sentences = (t) => String(t || '').split(/(?<=[.?!…])\s+(?=[^\s"」])|(?<=[.?!…]["」])\s+/).map((x) => x.trim()).filter(Boolean);
const textErr = [];
function checkText(where, t, max, maxSent) {
  if (!t) return;
  const ss = sentences(t);
  if (maxSent && ss.length > maxSent) textErr.push(`${where}: ${ss.length}문장 > ${maxSent} — ${t}`);
  for (const s of ss) if (Array.from(s).length > max) textErr.push(`${where}: ${Array.from(s).length}자 > ${max} — ${s}`);
  if (/카르마|원한|때문에|왜냐하면|티켓|작업/.test(t)) textErr.push(`${where}: 금지 낱말 — ${t}`);
}
// 원본에 이미 있던 글은 건너뛴다(이 작업이 쓴 글만 검사) — 원본 사건의 모든 글 모음
const ORIG_TEXT = new Set();
for (const e0 of rd('events.json')) { ORIG_TEXT.add(e0.text); for (const c0 of e0.choices) { ORIG_TEXT.add(c0.warn); for (const r of ['out', 'ok', 'fail']) if (c0[r]) ORIG_TEXT.add(c0[r].text); } }
const checkNew = (where, t, max, maxSent) => { if (!ORIG_TEXT.has(t)) checkText(where, t, max, maxSent); };
const NEW_EV = ['dawn_mob', 'd10_hold', 'd10_grab', 'repay_bowl', 'share_back', 'd2_shutter_arm', 'd4_spanner', 'crate_lid'];
const TOUCHED = NEW_EV.concat(['dawn_strike', 'called_up', 'd5_flood', 'd6_shutter', 'd6_shutter_b', 'd2_night_shutter', 'trial_d4_gicheol', 'pro_rubble_alone']);
for (const id of TOUCHED) {
  const e = E(id); const fixed = e.grade === 'fixed';
  checkNew(`${id}.text`, e.text, fixed ? 50 : 40, fixed ? 5 : 4);
  e.choices.forEach((c, k) => {
    for (const v of [c].concat(c.swap ? (Array.isArray(c.swap) ? c.swap : [c.swap]) : [])) {
      if (v.label && Array.from(v.label).length > 18) textErr.push(`${id}[${k}] label 18자 초과 ${v.label}`);
      for (const r of ['out', 'ok', 'fail']) if (v[r]) checkNew(`${id}[${k}].${r}`, v[r].text, fixed ? 50 : 40, 3);
      if (v.warn) checkNew(`${id}[${k}].warn`, v.warn, 30, 2);
    }
  });
}
for (const l of lines) if (/_late$|^toast_late$|^insp_bowl_pushed$/.test(l.id)) checkText(`lines.${l.id}`, l.text, l.grade === 'toast' ? 30 : 40, 4);
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
write('events.json', ev); write('nightEvents.json', ne); write('numbers.json', nums); write('lines.json', lines); write('objects.json', objs); write('people.json', people);
console.log('표를 썼다 →', DST);
console.log(log.map((m) => ' · ' + m).join('\n'));
console.log('손잡이', JSON.stringify(K));
