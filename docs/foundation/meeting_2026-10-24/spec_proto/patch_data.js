// 시제품 데이터 패치 (스크래치 사본만). node patch_data.js <src data> <dst data> [knobs json]
const fs = require('fs'); const path = require('path');
const [src, dst] = process.argv.slice(2);
const K = Object.assign({ armStr: 80, spannerStr: 80, floodStr: 80, floodCost: 1, mobObs: 40, mobTalk: 35, doom: 9, mobKarma: 5, mobGrudge: 2, fogKarma: 8, kmul: 1, takeKarma: 3, informKarma: 5, mobBlock: 0, caughtPlus: 1, d10hold: 1, holdStr: 65, boil: 1, boilG: 3, doomLock: 0, medAny: 1, ascendUnseen: 1, medThief: 1, missG: 4, missShare: 3, A1: 1, A2: 1, A4: 1 }, JSON.parse(process.argv[4] || '{}'));
const rd = (f) => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
const ev = rd('events.json'), ne = rd('nightEvents.json'), nums = rd('numbers.json'), lines = rd('lines.json');
const E = (id) => { const r = ev.find((x) => x.id === id); if (!r) throw new Error('no event ' + id); return r; };
const C = (id, label) => { const c = E(id).choices.find((x) => x.label === label); if (!c) throw new Error('no choice ' + id + ' ' + label); return c; };
const outs = (c) => ['out', 'ok', 'fail'].map((k) => c[k]).filter(Boolean);
const add = (o, ...effs) => { o.effects = (o.effects || []).concat(effs); };
const karma = (n) => ({ verb: 'number', id: 'karma', n: n > 0 ? Math.round(n * K.kmul) : n });
const kill = { verb: 'kill', who: 'you', how: 'dead' };
const dieLedger = { who: 'you', status: 'dead', day: '{day}', cause: '' };
const flag = (id, set) => ({ verb: 'flag', id, set });
const inj = (who, n) => ({ verb: 'injure', who, n });
const num = (id, n, who) => (who ? { verb: 'number', id, n, who } : { verb: 'number', id, n });
const ch = (label, o) => Object.assign({ label, check: null, cost: {}, req: {}, taboo: '', warn: '' }, o);
const N = (id, o) => Object.assign({ id, role: 'grudge', actor: '', target: '', cond: '', weight: 5, kind: 'malice', trace: {}, rumor: { witness: '', line: '' }, effects: [], oncePerRun: 0 }, o);
const doomReq = { cond: `karma<${K.doom}`, why: '아무도 당신 말을 믿지 않는다' };

nums.push({ id: 'karma', owner: 'world', min: 0, max: 20, start: 0, perDay: 0, visible: 'never' });

if (K.A1) {
  // 즉시 보상 + 카르마
  const b = C('trial_d1_bowls', '남의 그릇을 비운다'); delete b.out.target; add(b.out, num('hunger', -2, 'you'), karma(2));
  for (const id of ['d5_rail_body', 'd5_rail_body_c', 'd5_rail_body_b']) add(C(id, '받는다').out, karma(1));
  add(C('d5_lullaby', '놓친다').out, karma(2));
  add(C('d6_shutter', '아무것도 하지 않는다').out, karma(2), num('grudge', 3, 'gicheol'));
  add(C('d6_shutter_b', '아무것도 하지 않는다').out, karma(2));
  add(C('trade_shutter', '동하를 하루 보낸다').out, karma(3));
  add(C('patrol_pact', '동하를 보낸다').out, karma(4));
  for (const id of ['trial_d8_key', 'trial_d8_key_b']) add(C(id, '운임을 따로 챙긴다').out, karma(3));
  add(C('starve_you', '창고를 턴다').out, karma(2));
  for (const o of outs(C('starve_you', '남의 그릇을 뺏는다'))) add(o, karma(3));
  const blanket = C('fever_night', '남의 담요를 끌어온다'); add(blanket.out, karma(3)); if (K.doomLock) blanket.req = Object.assign({}, doomReq, { why: '아무도 담요를 내주지 않는다' });
  add(C('dawn_strike', '그릇 둘을 내민다').out, karma(-1));
  const point = C('dawn_strike', '옆 담요를 가리킨다'); add(point.out, karma(3)); if (K.doomLock) point.req = doomReq;
  const other = C('called_up', '다른 이름을 댄다'); add(other.out, karma(3)); if (K.doomLock) other.req = Object.assign({}, doomReq, { why: '다른 이름이 목에서 안 나온다' });
  const bottle = C('d10_walk_weak', '옆 사람 물병을 비운다'); add(bottle.out, karma(3)); if (K.doomLock) bottle.req = Object.assign({}, doomReq, { why: '아무도 물병을 내려놓지 않는다' });
  add(C('trip_a2_bodybag', '가져간다').out, karma(1));
  add(C('d9_hoard', '하나만 나눠 받는다').out, karma(1));
  add(C('trip_b1_gate', '지나친다').out, karma(2));
  // 늦게 오는 값: 받아냄(1단) · 밀고(2단) · 둘러섬(3단) · 안개(끝)
  ne.push(N('take_back_you', { actor: 'grudge>=4', target: 'you', cond: `karma>=${K.takeKarma} & day>=4`, weight: 7, effects: [num('food', -2), num('grudge', -2, 'actor')], trace: { bowl_you: 'empty', crate_food: 'open' } }));
  ne.push(N('inform_you', { role: 'inform', actor: 'grudge>=4', target: 'you', cond: `karma>=${K.informKarma} & day>=5 & fog>=2 & !flag:named_you`, weight: 7, effects: [flag('named_you', 1), num('counted', 1, 'target'), num('grudge', -1, 'actor')], trace: { shoes_stairs: 'one' } }));
  ne.push(N('mob_you', { role: 'kill', actor: `grudge>=${K.mobGrudge}`, target: 'you', cond: `karma>=${K.mobKarma} & day>=5 & !flag:dawn_mob${K.mobBlock ? ' & !flag:dawn_strike' : ''}`, weight: 10, effects: [flag('dawn_mob', 1)], trace: { notebook_you: 'moved' }, public: 1 }));
  ne.push(N('fog_names_you', { role: 'clock', kind: 'neutral', actor: '', target: '', cond: `karma>=${K.fogKarma} & fog>=3 & !flag:named_you`, weight: 10, effects: [flag('named_you', 1)], trace: { shoes_stairs: 'one' } }));
  ev.push({ id: 'dawn_mob', kind: 'trial', when: 'phase==trace & flag:dawn_mob', grade: 'normal', explicit: 1, image: '', once: 0, target: 'randomSleeper',
    text: '새벽에 눈을 떴다. 담요 셋이 당신을 둘러서 있다. 아무도 말하지 않는다. 누가 당신 봉지를 들고 있다.',
    choices: [
      ch('가진 것을 다 내놓는다', { cost: { food: 3, water: 2 }, warn: '식량과 물이 다 나간다', out: { text: '봉지와 물병이 손에서 손으로 갔다.', effects: [flag('dawn_mob', 0), num('grudge', -3, 'all'), karma(-2), { verb: 'axis', id: 'share', n: 1 }] } }),
      ch('손가락 하나로 갚는다', { req: { notPermanent: 'finger' }, warn: '손가락을 잃는다', out: { text: '누가 당신 손을 판자에 눌렀다. 소리는 담요가 먹었다.', effects: [flag('dawn_mob', 0), { verb: 'permanent', who: 'you', loss: 'finger' }, inj('you', 1), num('grudge', -2, 'all')] } }),
      ch('다른 사람을 가리킨다', { taboo: '되돌릴 수 없다', req: K.doomLock ? doomReq : {}, warn: '그 사람이 대신 맞는다', out: { text: '손가락 끝을 따라 담요들이 돌아섰다.', effects: [flag('dawn_mob', 0), inj('target', 2), num('grudge', 3, 'target'), karma(3), { verb: 'axis', id: 'share', n: -1 }, { verb: 'axis', id: 'hand', n: -1 }] } }),
      ch('맞고 버틴다', { warn: '크게 다친다', out: { text: '발길질이 멎을 때까지 웅크렸다. 봉지는 그들이 가져갔다.', effects: [flag('dawn_mob', 0), inj('you', 2), num('food', -2), num('grudge', -1, 'all')] } }),
      ch('밀치고 달아난다', { check: { skill: 'obs', base: K.mobObs }, warn: '넘어지면 끝이다', ok: { text: '선로 쪽으로 굴렀다. 무릎이 깨졌다.', effects: [flag('dawn_mob', 0), inj('you', 1)] }, fail: { text: '발목이 잡혔다. 담요가 얼굴을 덮었다.', effects: [kill], ledger: dieLedger } }),
      ch('무릎을 꿇고 빈다', { check: { skill: 'talk', base: K.mobTalk }, warn: '안 들으면 끝이다', ok: { text: '누가 먼저 돌아섰다. 다들 따라갔다.', effects: [flag('dawn_mob', 0), num('grudge', -1, 'all')] }, fail: { text: '아무도 대답하지 않았다. 화로가 멀어졌다.', effects: [kill], ledger: dieLedger } }),
    ] });
}

  if (K.A1) {
    const ds = E('dawn_strike'); ds.choices.splice(1, 0, ch('맞고 버틴다', { warn: '크게 다친다', out: { text: '목을 비틀어 빠져나왔다. 그림자가 갈비뼈를 걷어찼다.', effects: [flag('dawn_strike', 0), inj('you', 2), num('grudge', -1, 'all')] } }));
    const cu = E('called_up'); cu.choices.splice(1, 0, ch('손등을 깨물며 버틴다', { warn: '손이 상한다', out: { text: '피 맛이 날 때까지 깨물었다. 이름은 새벽에 그쳤다.', effects: [flag('named_you', 0), inj('you', 1)] } }));
  }
  if (K.d10hold) {
    const at = ev.findIndex((x) => x.id === 'd10_train');
    ev.splice(at, 0, { id: 'd10_hold', kind: 'trial', when: `day==10 & phase==day & karma>=${K.doom}`, grade: 'normal', explicit: 0, image: '',
      text: '계단 앞에서 누가 당신 소매를 잡았다. 당신이 그릇을 비운 사람이다. 손을 놓지 않는다.',
      choices: [
        ch('가진 것을 내준다', { cost: { food: 2, water: 1 }, warn: '식량과 물이 준다', out: { text: '봉지를 받아 들고 손을 놓았다.', effects: [karma(-2), num('grudge', -3, 'all')] } }),
        ch('손가락을 내준다', { req: { notPermanent: 'finger' }, warn: '손가락을 잃는다', out: { text: '돌 위에 손을 올렸다. 그가 내리쳤다.', effects: [{ verb: 'permanent', who: 'you', loss: 'finger' }, inj('you', 1)] } }),
        ch('끌려가며 버틴다', { warn: '크게 다친다', out: { text: '계단 밑까지 끌려가 맞았다. 그래도 걸어 나왔다.', effects: [inj('you', 2)] } }),
        ch('뿌리치고 걷는다', { check: { skill: 'str', base: K.holdStr }, warn: '주저앉으면 끝이다', ok: { text: '소매가 찢어졌다. 계단이 당신을 받았다.', effects: [inj('you', 1)] }, fail: { text: '무릎이 꺾였다. 아무도 당신을 일으키지 않았다.', effects: [kill], ledger: dieLedger } }),
      ] });
  }
if (K.A2) {
  // D2 셔터: 실패하면 팔이 끼는 위기
  const talk = C('d2_night_shutter', '틈으로 말을 건다');
  talk.fail.effects = talk.fail.effects.filter((e) => e.verb !== 'injure').concat([flag('shutter_arm', 1)]);
  ev.push({ id: 'd2_shutter_arm', kind: 'trial', when: 'day==2 & phase==night & flag:shutter_arm', grade: 'normal', explicit: 1, image: '', target: 'randomSleeper',
    text: '틈으로 들어온 손이 당신 손목을 잡았다. 너머에서 당긴다. 셔터 날이 팔꿈치까지 왔다.',
    choices: [
      ch('통조림을 내밀어 바꾼다', { cost: { food: 2 }, warn: '식량이 준다', out: { text: '통조림이 넘어가자 손이 풀렸다.', effects: [flag('shutter_arm', 0), inj('you', 1)] } }),
      ch('옆 사람 팔을 내민다', { taboo: '되돌릴 수 없다', warn: '그 사람이 대신 끌린다', out: { text: '잠든 팔을 틈에 밀었다. 비명이 셔터를 울렸다.', effects: [flag('shutter_arm', 0), inj('target', 2), num('grudge', 4, 'target'), karma(3), { verb: 'axis', id: 'share', n: -1 }, { verb: 'axis', id: 'hand', n: -1 }] } }),
      ch('팔을 비틀어 뺀다', { check: { skill: 'str', base: K.armStr }, warn: '못 빼면 끝이다', ok: { text: '팔꿈치 살이 셔터 날에 남았다. 팔은 돌아왔다.', effects: [flag('shutter_arm', 0), inj('you', 2)] }, fail: { text: '셔터 밑으로 어깨까지 끌려갔다. 너머에서 웃었다.', effects: [flag('shutter_arm', 0), kill], ledger: dieLedger } }),
    ] });
  // D4 스패너: 모두에게 열리고, 상자를 세면 밤에 온다
  const g = E('trial_d4_gicheol'); g.when = 'day==4 & phase==day & alive:gicheol & flag:met_gicheol';
  const trust = C('trial_d4_gicheol', '믿는다'); trust.warn = '부품이 빈다'; add(trust.out, num('parts', -2));
  const count = C('trial_d4_gicheol', '상자를 센다'); count.warn = '헤드램프가 당신을 따라온다'; add(count.out, flag('gicheol_counted', 1));
  const press = C('trial_d4_gicheol', '추궁한다'); press.fail.effects = [inj('you', 1), flag('gicheol_counted', 1)];
  ev.push({ id: 'd4_spanner', kind: 'trial', when: 'day==4 & phase==night & flag:gicheol_counted & alive:gicheol', grade: 'normal', explicit: 1, image: '', target: 'randomSleeper',
    text: '기철이 머리맡에 서 있다. 헤드램프가 꺼져 있다. 손에 스패너가 있다. "셌지."',
    choices: [
      ch('그릇 하나로 입을 막는다', { cost: { food: 1 }, warn: '식량이 준다', out: { text: '기철이 그릇을 받아 들고 돌아섰다.', effects: [flag('gicheol_counted', 0), num('grudge', -2, 'gicheol')] } }),
      ch('다른 사람이 셌다고 한다', { taboo: '되돌릴 수 없다', warn: '그 사람이 맞는다', out: { text: '헤드램프가 켜지고 다른 담요로 갔다.', effects: [flag('gicheol_counted', 0), inj('target', 2), num('grudge', 4, 'target'), karma(3), { verb: 'axis', id: 'share', n: -1 }, { verb: 'axis', id: 'hand', n: -1 }] } }),
      ch('스패너를 막는다', { check: { skill: 'str', base: K.spannerStr }, warn: '못 막으면 끝이다', ok: { text: '팔뚝으로 받았다. 뼈가 울렸다.', effects: [flag('gicheol_counted', 0), inj('you', 1)] }, fail: { text: '두 번째가 관자놀이로 왔다.', effects: [flag('gicheol_counted', 0), kill], ledger: dieLedger } }),
    ] });
  // D5 범람: 공짜 '퍼낸다'를 판정으로, 창고를 버리려면 식량이 있어야
  const fl = E('d5_flood');
  const ab = C('d5_flood', '창고를 버리고 뺀다'); ab.cost = { food: K.floodCost };
  const bail = C('d5_flood', '모두 매달려 퍼낸다'); const t0 = bail.out ? bail.out.text : '';
  bail.check = { skill: 'str', base: K.floodStr }; bail.warn = '쓸려 가면 끝이다';
  bail.ok = { text: t0 || '새벽까지 퍼냈다. 물이 무릎에서 멈췄다.', effects: (bail.out && bail.out.effects) || [] };
  bail.fail = { text: '발이 물살에 들렸다. 배수구 쪽으로 끌려갔다.', effects: [kill], ledger: dieLedger }; delete bail.out;
  fl.target = 'randomSleeper';
  fl.choices.push(ch('남의 담요로 물길을 막는다', { taboo: '되돌릴 수 없다', warn: '그 사람이 밤새 젖는다', out: { text: '담요를 둘둘 말아 물길에 박았다. 주인은 젖은 채 떨었다.', effects: [inj('target', 1), num('fear', 2, 'target'), num('grudge', 3, 'target'), karma(2), { verb: 'axis', id: 'share', n: -1 }] } }));
  // D6 횃불: 덤벼서 지면 죽는다 (설계 v3)
  for (const [id, lb] of [['d6_shutter', '동하와 덤빈다'], ['d6_shutter_b', '맞선다']]) { const c = C(id, lb); c.warn = '넷이다. 지면 끝이다'; c.fail = { text: '횃불이 얼굴로 왔다. 바닥이 가까워졌다.', effects: [kill], ledger: dieLedger }; }
}

if (K.A4) {
  const R = (id) => { const r = ne.find((n) => n.id === id); if (!r) throw new Error('no night ' + id); return r; };
  // 누구나 아는 밤
  for (const id of ['starve_resident', 'ascend', 'mari_pillow', 'eunji_goes_instead', 'grudge_strike_you', 'dongha_pipe_you', 'dongha_end_you', 'steal_you']) R(id).public = 1;
  // 도둑질: 못 보면 다시 온다
  for (const id of ['steal_food', 'steal_food_seoha']) R(id).missed = { effects: [flag('unseen_thief_actor', 1)], trace: { crate_food: 'empty' } };
  ne.push(N('steal_food_again', { role: 'steal', actor: 'flag:unseen_thief_actor', target: '', cond: 'food>=1', weight: 10, effects: [num('food', -2)], trace: { crate_food: 'empty' }, caught: { effects: [flag('unseen_thief_actor', 0)] } }));
  // 물: 못 보면 물통 주인이 마른다
  R('steal_water').missed = { effects: [num('thirst', 3, 'target'), num('water', -1)] };
  // 상처: 못 본 상처는 썩는다
  R('wound_rots').missed = { effects: [inj('actor', 1)], trace: { bandage_actor: 'rot' } };
  R('swing_pipe').missed = { effects: [inj('target', 1)] };
  if (K.caughtPlus) {
    for (const id of ['steal_food', 'steal_food_seoha']) R(id).caught = { effects: [num('food', 1)] };
    R('wound_rots').caught = { effects: [flag('wound_seen_actor', 1)] };
    R('share_bowl').caught = { effects: [num('hunger', -2, 'actor'), num('hunger', 1, 'you')] };
    R('steal_water').caught = { effects: [num('thirst', -2, 'target')] };
  }
  // 원한: 못 본 원한은 터진다
  R('hungry_blames_you').missed = { effects: [num('grudge', K.missG, 'actor'), flag('unseen_grudge_actor', 1)] };
  R('hungry_blames_you').caught = { effects: [num('grudge', -1, 'actor'), flag('unseen_grudge_actor', 0)] };
  R('eye_you').missed = { effects: [num('grudge', K.missG, 'actor'), flag('unseen_grudge_actor', 1)] };
  R('read_notebook').missed = { effects: [num('grudge', 1, 'actor')] };
  if (K.boil) ne.push(N('grudge_boils', { role: 'kill', actor: `flag:unseen_grudge_actor & grudge>=${K.boilG}`, target: 'you', cond: 'day>=3 & !flag:dawn_strike', weight: 10, effects: [flag('dawn_strike', 1), flag('unseen_grudge_actor', 0)], trace: { blanket_actor: 'rolled', notebook_you: 'moved' }, public: 1 }));
  if (K.medThief) ne.push(N('steal_meds_again', { role: 'steal', actor: 'flag:unseen_thief_actor', target: '', cond: K.medAny ? 'meds>=1' : 'food==0 & meds>=1', weight: 10, effects: [num('meds', -1)], trace: { crate_food: 'moved' }, caught: { effects: [flag('unseen_thief_actor', 0)] } }));
  // 안개: 계단에 선 사람을 못 보면 재가 내려온다, 보면 데려온다
  R('stand_stairs').missed = { effects: [num('fog', 1), flag('unseen_stairs_actor', 1)], trace: { stairs_ash: 'deep' } };
  if (K.ascendUnseen) ne.push(N('ascend_unseen', { role: 'ascend', kind: 'neutral', actor: 'flag:unseen_stairs_actor', target: '', cond: 'fog>=3', weight: 10, effects: [{ verb: 'kill', who: 'actor', how: 'ascended' }, num('fear', 3, 'bondOfActor')], trace: { shoes_stairs: 'pair', blanket_actor: 'empty' }, public: 1 }));
  R('stand_stairs').caught = { effects: [flag('stood_stairs_actor', 0)] };
  // 주민의 위기: 못 본 희생은 혼자 쓰러진다
  R('share_bowl').missed = { effects: [num('hunger', K.missShare, 'actor')] };
  R('soonrye_water').missed = { effects: [num('thirst', 2, 'soonrye'), inj('soonrye', 1)] };
  R('dongha_carries').missed = { effects: [num('hunger', 2, 'dongha')] };
}
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
const wr = (f, o) => fs.writeFileSync(path.join(dst, f), JSON.stringify(o, null, 1));
wr('events.json', ev); wr('nightEvents.json', ne); wr('numbers.json', nums);
console.log('data patched', JSON.stringify(K));
