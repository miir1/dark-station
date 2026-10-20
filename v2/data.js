// 어두운 역 v2 — 첫 시연(수직 슬라이스) 데이터: 주민·할 일·시설·원정 사건·밤 사건·약속 사건·프롤로그
(function (root) {
  'use strict';

  const GOAL_DAY = 10;                       // 시연 길이 (전체 30일 중 1막)
  const SKILLS = { obs: '관찰', str: '완력', tech: '기술', talk: '말솜씨' };
  const RES = { food: '식량', water: '물', parts: '부품', meds: '약품' };
  const CAP = { food: 24, water: 24, parts: 18, meds: 6 };
  const ITEMS = { rope: '밧줄', pipe: '쇠파이프' };
  const REGION_NAMES = { A: '시장 방면', B: '수문 방면' };

  // 특성 수치 키: forage 식량 수색+, expLoad 가방+, build 건설+, gen 발전+, heal 치료+, workStress 일 스트레스+,
  //              expStress 원정 스트레스+, threatStress 위협 사건 스트레스+, talkEase 대화 회복 약화, restLess 휴식 회복 약화,
  //              expCheck 원정 판정+, talkCheck 말솜씨 판정+, tag 선택지 태그
  const TRAITS = {
    frugal: { name: '알뜰', desc: '식량 수색 +1', forage: 1 },
    knees: { name: '무릎 약함', desc: '원정 스트레스 +4', expStress: 4 },
    sharp: { name: '눈썰미', desc: '이 사람이 원정 판정을 맡으면 +5%p', expCheck: 0.05 },
    timid: { name: '겁 많음', desc: '위협 사건 스트레스 +4', threatStress: 4 },
    handy: { name: '손재주', desc: '건설·발전 +1', build: 1, gen: 1 },
    stubborn: { name: '완고함', desc: '대화 회복 −4', talkEase: 4 },
    haggle: { name: '흥정꾼', desc: '거래 선택지 개방', tag: 'haggle' },
    restless: { name: '조급함', desc: '휴식 회복 −4', restLess: 4 },
    strong: { name: '힘꾼', desc: '가방 +2칸', expLoad: 2 },
    simple: { name: '눈치 없음', desc: '이 사람이 말솜씨 판정을 맡으면 −10%p', talkCheck: -0.1 },
    nursing: { name: '간호 경험', desc: '치료 +1', heal: 1 },
    insomnia: { name: '불면', desc: '휴식 회복 −4', restLess: 4 },
  };

  // story: 저녁 대화 3회 (3번째에 perk 기술 +1)
  const PEOPLE = {
    soonrye: { name: '김순례', age: 68, bio: '전 역사 청소원', skills: { obs: 2, str: 1, tech: 1, talk: 2 }, good: 'frugal', bad: 'knees', perk: 'obs',
      wish: '수원의 아들에게 소식 전하기',
      story: ['“이 역 계단을 삼십 년 닦았어. 어디가 새는지 다 알아.”', '“아들이 수원에 있어. 그날 아침에 전화를 못 받았지.”', '“너무 미안해하지 마. 살아 있으면 다 갚을 날이 와.” 순례가 눈여겨볼 곳을 알려 준다. (관찰 +1)'] },
    seoha: { name: '윤서하', age: 17, bio: '고등학생', skills: { obs: 3, str: 1, tech: 2, talk: 1 }, good: 'sharp', bad: 'timid', perk: 'tech',
      wish: '신호가 잡히는 곳 찾기',
      story: ['“시험 끝나는 날이었어요. 웃기죠.”', '“밤마다 휴대폰을 켜 봐요. 신호 안 잡히는 거 알면서도.”', '“나도 위에 나가 보고 싶어요.” 서하와 지도 읽는 법을 익혔다. (기술 +1)'] },
    gicheol: { name: '박기철', age: 45, bio: '지하철 정비사', skills: { obs: 1, str: 2, tech: 3, talk: 1 }, good: 'handy', bad: 'stubborn', perk: 'str',
      wish: '딸 둘의 무사 확인',
      story: ['“전동차 멈춘 건 정전 때문이 아니야. 변전소가 통째로 나갔어.”', '“딸이 둘이야. 큰애가 올해 대학 갔지.”', '“배워 둬. 내가 없을 때를 대비해서.” 기철이 버티는 요령을 가르쳐 준다. (완력 +1)'] },
    eunji: { name: '최은지', age: 24, bio: '광장시장 상인', skills: { obs: 2, str: 1, tech: 1, talk: 3 }, good: 'haggle', bad: 'restless', perk: 'obs',
      wish: '어머니 가게 간판 지키기',
      story: ['“시장 사람들은 살아남는 법을 알아. 흥정하는 법도.”', '“엄마 가게 간판을 아직 가지고 있어.”', '“값을 부르기 전에 상대 눈을 먼저 봐.” 은지가 사람 보는 법을 알려 준다. (관찰 +1)'] },
    dongha: { name: '한동하', age: 19, bio: '시장 짐꾼', skills: { obs: 1, str: 3, tech: 1, talk: 1 }, good: 'strong', bad: 'simple', perk: 'talk',
      wish: '은지 누나에게 보답하기',
      story: ['“짐 지는 거 하나는 자신 있어요.”', '“은지 누나가 저를 거둬 줬어요. 갚아야죠.”', '“말은 서툴러도 약속은 지켜요.” 동하와 진솔하게 이야기하는 법을 배웠다. (말솜씨 +1)'] },
    mari: { name: '정마리', age: 52, bio: '퇴근길 간호사', skills: { obs: 2, str: 1, tech: 2, talk: 2 }, good: 'nursing', bad: 'insomnia', perk: 'tech',
      wish: '다친 사람을 한 명도 잃지 않기',
      story: ['“병동에서 야간근무만 십 년 했어요. 잠이 안 오는 건 그래서죠.”', '“환자 이름을 매일 밤 하나씩 떠올려요.”', '“사람을 살리는 건 결국 사람이에요.” 마리가 응급처치 요령을 알려 준다. (기술 +1)'] },
  };
  const START_PEOPLE = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari'];

  const ALLIES = {
    eunchae: { name: '문은채', bio: '약사', flag: 'hospital_pact' },
    dohyeon: { name: '권도현', bio: '배수 정비공', flag: 'repair_open' },
  };

  // 할 일. slots: 최대 인원, power: 일꾼 1명당 전력, stress: 하루 스트레스 변화
  const TASKS = {
    rest: { name: '휴식', desc: '스트레스 −16, 경상 회복', slots: 9, stress: -16 },
    forage: { name: '식량 수색', desc: '식량 3 (근처 남은 양에서)', slots: 2, stress: 4, skill: 'obs' },
    pump: { name: '물 긷기', desc: '물 4, 전력 1', slots: 2, stress: 4, skill: 'tech', power: 1 },
    salvage: { name: '비상 해체', desc: '빈 상점·객차를 뜯어 부품 1 (완력 3이면 2) — 뜯어낼 부품은 모두 6개', slots: 1, stress: 5, skill: 'str' },
    gen: { name: '발전', desc: '전력 3, 노출 +1 (침수 5 이상이면 정지)', slots: 1, stress: 4, skill: 'tech' },
    drain: { name: '배수', desc: '침수 −2', slots: 2, stress: 5, skill: 'str' },
    guard: { name: '경계', desc: '노출 −2, 밤 도둑·순찰 대비', slots: 2, stress: 4, skill: 'str' },
    tend: { name: '치료', desc: '부상 −1, 약품 1', slots: 1, stress: 3, skill: 'tech' },
    build: { name: '공사 작업', desc: '공사 진행 +1 (작업 1회분)', slots: 4, stress: 5, skill: 'tech' },
    farm: { name: '버섯 재배', desc: '식량 4, 전력 1(시설)', slots: 2, stress: 4, skill: 'tech', facility: 'farm' },
  };
  const TASK_ORDER = ['forage', 'pump', 'gen', 'drain', 'guard', 'salvage', 'build', 'farm', 'tend', 'rest'];

  // 공사: 부품을 먼저 내고, 건설 담당이 work 작업분만큼 일하면 완성
  const PROJECTS = {
    farm: { name: '버섯 재배실', cost: { parts: 6 }, work: 2, group: 'living', desc: '재배 일 개방: 식량 4×2명 (전력 1)', done: '환기구 밑 창고에 버섯 배양판을 깔았다.' },
    clinic: { name: '진료소', cost: { parts: 4 }, work: 2, group: 'living', desc: '치료가 강해짐: 환자 2명, 부상 −2 (전력 1)', done: '역무실 한쪽을 진료소로 꾸몄다.' },
    repair: { name: '지하 통로 공동 수리', cost: {}, work: 2, group: 'route', hidden: true, desc: '고지대 역으로 가는 통로 확보 (열차 승차에 필요)', done: '도현과 함께 끊긴 배수 통로를 이었다. 열차가 지날 길이 열렸다.' },
  };

  // ── 프롤로그 (멈춘 전동차 → 을지로입구역) ──
  // out: { text, res, item, stressAll, trust:{id:n} }
  const PROLOGUE = [
    { title: '멈춘 전동차',
      cold: ['덜컹.', '“승객 여러분께서는 침착하게—”', '…', '누군가 당신의 이름을 불렀다. 아주 다정한 목소리였다.'],
      text: '눈을 뜬다. 붉은 비상등이 깜빡인다. 전동차가 터널 한가운데 멈춰 있다. 칸이 텅 비었다. 바닥에 신발과 가방이 흩어져 있고, 떨어진 휴대폰 몇 개가 아직 켜져 있다. 맨발 자국이 앞쪽 어둠으로 이어진다.',
      choices: [
        { text: '비상 레버를 당겨 문을 연다', out: { text: '문이 쉭 소리를 내며 열린다. 터널의 찬 공기가 밀려든다. 문 옆 비상함에 생수 두 병이 남아 있다.', res: { water: 2 } } },
        { text: '먼저 칸 안을 둘러본다', out: { text: '주인 없는 가방들 사이에서 공구 가방을 찾았다. 단단한 케이블 뭉치가 들어 있다. 끈에 걸린 사원증 사진이 웃고 있다.', res: { parts: 1 }, item: 'rope' } },
      ] },
    { title: '남은 승객들',
      text: '칸 맨 끝 구석에 여섯 사람이 서로 붙어 웅크려 있다. 다들 눈을 꼭 감고 있다. 청소원 조끼의 할머니가 사람들 어깨를 끌어안은 채 중얼거린다. “보지 마. 대답하지 마.”',
      choices: [
        { text: '“다 같이 갑시다.”', out: { text: '여섯 사람이 하나씩 눈을 뜬다. 누군가 먼저 일어나 주길 기다렸던 얼굴들이다.', stressAll: -5 } },
        { text: '할머니의 상태부터 살핀다', out: { text: '“괜찮아, 괜찮아.” 할머니가 당신 손을 꼭 잡는다. 손이 얼음장 같다. 김순례라고 했다.', trust: { soonrye: 1 } } },
        { text: '간호사에게 응급 키트를 부탁한다', out: { text: '정마리 간호사가 가운 주머니에서 해열제와 붕대를 꺼내 준다. 손이 떨리지 않는 사람은 그녀뿐이다.', res: { meds: 1 }, trust: { mari: 1 } } },
      ] },
    { title: '어두운 터널',
      text: '휴대폰 불빛에 의지해 선로를 걷는다. 맨발 자국이 선로를 따라 이어지다가, 옆 환기 통로로 꺾여 들어간다. 그 안쪽이 희미하게 잿빛이다. 아무도 그쪽을 보지 않는다. 앞쪽에서 무언가 무너지는 소리가 울린다.',
      choices: [
        { text: '정비사에게 앞장을 부탁한다', out: { text: '박기철은 침목을 짚으며 무너진 구간을 능숙하게 피해 간다.', trust: { gicheol: 1 } } },
        { text: '선로 옆 대피 공간을 뒤진다', out: { text: '작업자용 비상 상자다. 생수와 건빵이 들어 있다. 상자 옆에 작업화 한 켤레가 가지런히 벗겨져 있다.', res: { food: 3, water: 3 } } },
        { text: '직접 앞장선다', out: { text: '돌에 걸려 무릎이 까졌다. 그래도 사람들이 바짝 따라온다.', stressAll: -3 } },
      ] },
    { title: '을지로입구역',
      text: '승강장에 닿았다. 개찰구 너머, 지상으로 나가는 출구 계단 한가운데에서 잿빛 안개가 벽처럼 멈춰 있다.',
      // 도착 장면: cg 그림, who 말하는 사람
      beats: [
        { cg: 'open_stairs', text: '계단에 서류 가방과 양복 상의, 구두 한 켤레가 떨어져 있다. 맨발 자국이 안개 속으로 올라간다.' },
        { text: '안개 가장자리에 남자 하나가 엎어져 있다. 안개에 잠긴 다리가 재처럼 하얗게 바스러져 있다. 뻗은 손만 이쪽을 향해 있다.' },
        { who: 'seoha', text: '“…올라가면 안 되는 거죠?”' },
        { who: 'soonrye', text: '“세고 있는 거야. 저 위에서. 몇 명 남았나.”' },
        { cg: 'open_speaker', text: '기둥의 스피커가 지직거린다. 같은 말이 되풀이된다.' },
        { text: '“…안개는 낮은 곳부터 차오릅니다… 생존자는 고지대 역으로… 차량기지에서 구조열차를… 열흘 뒤 정오…”' },
        { who: 'gicheol', text: '“고지대 역 쪽 선로는 물에 잠겼소. 배수로로 돌아가는 길을 이어야 열차가 지나가오.”' },
      ],
      choices: [
        { text: '열흘 안에 길을 잇기로 한다', out: { text: '열흘. 그 안에 배수로 쪽 통로를 잇고, 일곱 사람을 먹이고 지켜야 한다. 승강장 한가운데 드럼통에 불을 피웠다.' } },
      ] },
  ];

  // ── 원정 지역 ──
  const REGIONS = {
    A: { name: '시장 방면', sub: '을지로 지하상가', maxDepth: 2,
      intro: '셔터 내린 지하상가 통로를 따라 걷는다. 발소리가 멀리까지 울린다.',
      depth: { 1: ['a1_pharmacy', 'a2_stall', 'a5_contact'], 2: ['a3_traces', 'a4_stockroom'] } },
    B: { name: '수문 방면', sub: '배수로와 침수 통로', maxDepth: 2,
      intro: '발목까지 차오른 물을 헤치고 배수 통로로 내려간다. 어디선가 물 흐르는 소리가 울린다.',
      depth: { 1: ['b1_gate', 'b2_pumproom', 'b5_route'], 2: ['b3_stairs', 'b4_tank'] } },
  };
  const GENERIC = ['g1_fallen', 'g2_rats', 'g3_crates', 'g4_map', 'g5_child'];

  // 선택지: req {item, skill, trait, flag, noFlag, guards}, cost {food..}, check {skill, base, item, bonus}, hint(결과가 무거운 선택의 경고), delay(미루기 일수)
  // 결과: text, loot{}, res{}(역 창고), lose{}, stress, injure, flood, exposure, flag, promise{id,days}, ally, item, hours, close{region,days}, mem, retry, heal
  // 사건: when{flag} 조건이 맞아야 나옴, prio ≥ 5 이면 그 지역 첫 사건으로 우선
  const EVENTS = {
    a1_pharmacy: { title: '셔터 내린 약국', prio: 10, text: '유리문 안쪽에서 약사 가운을 입은 여자가 경계하며 내다본다. 앞 셔터는 반쯤 내려앉아 자물쇠가 굳었다. “혼자 어머니를 돌보고 있어요. 뒷문은 열 수 있는데… 낯선 사람한테 열기가 무서워요.”',
      choices: [
        { text: '자물쇠를 따 준다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '굳은 자물쇠가 돌아가고 셔터가 올라갔다. 약사 문은채가 그제야 숨을 내쉬며 약을 나눠 준다. “병원 쪽에 아는 사람이 있어요. 3일 뒤 소식 가져갈게요.”', loot: { meds: 1 }, promise: { id: 'eunchae_return', days: 3 }, flag: 'met_eunchae', mem: '약국에서 문은채를 도왔다.' },
          fail: { text: '드라이버가 미끄러져 손바닥을 꿰뚫었다. 셔터에 피가 줄줄 흘렀다. 자물쇠는 그대로다.', injure: 1, hours: 1, retry: true } },
        { text: '문틈으로 약품 1개를 밀어 넣고 기다린다', cost: { meds: 1 },
          out: { text: '잠시 뒤 뒷문 빗장이 풀렸다. 은채가 약을 되돌려 준다. “정말 도우러 오셨군요. 빚은 안 질게요. 병원 쪽에 아는 사람이 있어요. 3일 뒤 소식 가져갈게요.”', loot: { meds: 1 }, promise: { id: 'eunchae_return', days: 3 }, flag: 'met_eunchae', mem: '약을 나눠 문은채의 신뢰를 얻었다.' } },
        { text: '지나친다', out: { text: '유리문 너머의 시선이 한참 등에 따라붙는다.', stress: 4, flag: 'skipped_eunchae', mem: '약국의 도움 요청을 지나쳤다.' } },
      ] },
    a2_stall: { title: '무너진 시장 노점', prio: 1, text: '무너진 시장 지붕 아래 몇 사람이 불을 피우고 물건을 늘어놓았다. 우두머리 같은 여자가 당신을 훑어본다.',
      choices: [
        { text: '식량 2개를 부품 2개와 바꾼다', cost: { food: 2 }, out: { text: '여자는 통조림을 흔들어 보고 부품 꾸러미를 내민다.', loot: { parts: 2 } } },
        { text: '흥정한다', req: { trait: 'haggle' }, cost: { food: 2 }, out: { text: '은지가 눈을 마주치고 값을 부르자 여자가 웃는다. “장사 해 본 솜씨네.”', loot: { parts: 3, water: 1 } } },
        { text: '좌판을 눈여겨본다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '좌판 구석에 빠져 있던 부품 하나를 알아보고 주워 왔다.', loot: { parts: 1 } },
          fail: { text: '아무것도 찾지 못했다.' } },
      ] },
    a3_traces: { title: '사람이 머물던 흔적', prio: 1, text: '담요와 빈 통조림이 바닥에 널려 있다. 불씨가 아직 따뜻하다. 누군가 얼마 전까지 있었다.',
      choices: [
        { text: '구석까지 뒤진다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '벽 틈에 감춘 보급품을 찾았다.', loot: { food: 2, parts: 2 } },
          fail: { text: '담요 밑에서 무언가 꿈틀했다. 들춰 보니 반쯤 먹힌 사람이었다. 뒤에서 누군가 이쪽을 지켜보고 있었다. 도망치다 철근에 허벅지가 찢겼다.', stress: 6, exposure: 1, injure: 1 } },
        { text: '쇠파이프를 챙긴다', req: { noFlag: 'pipe_taken' }, out: { text: '벽에 기대 둔 쇠파이프를 가방에 꽂았다.', item: 'pipe', flag: 'pipe_taken' } },
        { text: '서둘러 떠난다', out: { text: '' } },
      ] },
    a4_stockroom: { title: '잠긴 창고', prio: 1, text: '철문 안쪽에 쌓인 상자가 틈으로 보인다. 자물쇠가 단단하다.',
      choices: [
        { text: '자물쇠를 연다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '찰칵. 창고 선반에 부품과 약품이 남아 있다.', loot: { parts: 3, meds: 1 } },
          fail: { text: '자물쇠는 꿈쩍도 않는다.', stress: 3 } },
        { text: '쇠파이프로 부순다', req: { item: 'pipe' }, out: { text: '요란한 소리와 함께 철문이 찌그러졌다. 소리가 오래 울렸다.', loot: { parts: 3, meds: 1 }, exposure: 1, god: { seel: 1 } } },
        { text: '포기하고 돌아선다', out: { text: '' } },
      ] },
    // 협정 뒤 시장 방면의 달라진 모습 (같은 장소가 이전 선택으로 바뀐다)
    a5_contact: { title: '병원 연락소', prio: 6, when: { flag: 'hospital_pact' }, text: '은채가 말한 병원 팀의 연락소가 시장 지하에 마련돼 있다. 담요를 두른 사람들이 지도를 펼쳐 놓고 있다. 은채가 손을 흔든다.',
      choices: [
        { text: '승차 보급을 보태 달라고 청한다', cost: { food: 2 }, out: { text: '병원 팀이 열차 좌석 두 개분의 담요와 물을 맡아 주겠다고 한다. “고지대 역에서 만나요.”', flag: 'seat_bonus', mem: '병원 팀이 승차 보급을 보태 주기로 했다.' } },
        { text: '식량을 약품으로 바꾼다', cost: { food: 2 }, out: { text: '은채가 약상자에서 해열제와 소독약을 꺼내 준다.', loot: { meds: 2 } } },
        { text: '안부만 나누고 간다', out: { text: '은채가 따뜻한 물을 한 잔 건넨다. 잠깐 숨이 놓인다.', stress: -3 } },
      ] },
    b1_gate: { title: '침수된 통로', prio: 10, text: '허리까지 찬 물 너머 작업등이 깜빡인다. 정비복 차림의 남자가 배수관에 발이 낀 채 매달려 있다. “거기 누구 있소! 물이 차오르고 있어!”',
      choices: [
        { text: '물에 들어가 끌어낸다', check: { skill: 'str', base: 0.4 },
          ok: { text: '남자는 권도현이라고 했다. 물을 뱉으며 말한다. “이틀 뒤에 보답하지.”', promise: { id: 'dohyeon_key', days: 2 }, flag: 'met_dohyeon', mem: '침수된 통로에서 권도현을 구했다.' },
          fail: { text: '물속에서 남자가 미친 듯이 매달려 함께 가라앉았다. 겨우 떼어 내고 기어 나왔다. 폐에 구정물이 찼다.', injure: 1, hours: 1, retry: true } },
        { text: '밧줄을 던져 끌어낸다', req: { item: 'rope' },
          out: { text: '밧줄을 배수관에 걸어 안전하게 끌어냈다. 남자는 권도현이라고 했다. “이틀 뒤에 보답하지.”', promise: { id: 'dohyeon_key', days: 2 }, flag: 'met_dohyeon', mem: '밧줄로 권도현을 구했다.' } },
        { text: '물이 차오른다, 지나친다', out: { text: '등 뒤에서 부르는 소리가 물소리에 묻혔다. 며칠 뒤에 그 남자가 스스로 빠져나왔다면 다시 찾아올지도 모른다.', stress: 4, god: { nereh: 1 }, flag: 'skipped_dohyeon', promise: { id: 'dohyeon_second', days: 3 }, mem: '침수된 통로의 외침을 지나쳤다.' } },
      ] },
    b2_pumproom: { title: '배수 펌프실', prio: 1, text: '벽에 낡은 펌프 세 대가 붙어 있다. 한 대는 모터가 살아 있어 보인다. 구석에 케이블 뭉치가 걸려 있다.',
      choices: [
        { text: '펌프를 살펴 손본다', check: { skill: 'tech', base: 0.45 },
          ok: { text: '펌프 한 대가 돌기 시작했다. 물이 조금 빠진다.', loot: { parts: 2 }, flood: -1 },
          fail: { text: '모터에서 연기가 났다. 부품 하나만 건졌다.', loot: { parts: 1 }, stress: 3 } },
        { text: '케이블을 밧줄로 챙긴다', req: { noFlag: 'rope_taken' }, out: { text: '튼튼한 케이블을 감아 밧줄로 챙겼다.', item: 'rope', flag: 'rope_taken' } },
        { text: '둘러보고 나온다', out: { text: '' } },
      ] },
    b3_stairs: { title: '끊긴 계단', prio: 1, text: '아래층 하역장으로 가는 계단이 끊겼다. 밑에 상자가 쌓인 게 보인다.',
      choices: [
        { text: '밧줄로 내려간다', req: { item: 'rope' }, out: { text: '밧줄을 걸고 내려가 상자를 뒤졌다.', loot: { parts: 3, water: 2 } } },
        { text: '뛰어내린다', check: { skill: 'str', base: 0.5 },
          ok: { text: '무릎이 시큰했지만 착지했다. 상자를 챙겼다.', loot: { parts: 3, water: 2 } },
          fail: { text: '착지하는 순간 발목에서 마른 나뭇가지 부러지는 소리가 났다. 발이 반대쪽을 보고 있다.', injure: 2, loot: { parts: 1 } } },
        { text: '돌아서 간다', out: { text: '먼 길로 돌아 상자 하나만 챙겼다.', loot: { parts: 1 }, hours: 2 } },
      ] },
    b4_tank: { title: '고인 물탱크', prio: 1, text: '대형 물탱크에 물이 가득하다. 투명해 보이지만 냄새가 난다.',
      choices: [
        { text: '냄새와 색을 살펴 퍼 간다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '위쪽 맑은 물만 골라 담았다.', loot: { water: 6 } },
          fail: { text: '바닥에 가라앉은 것이 쥐 사체였다는 건 다 마신 뒤에 알았다. 마신 사람이 밤새 피 섞인 물을 쏟았다.', loot: { water: 4 }, injure: 2 } },
        { text: '한 통만 안전하게 떠 간다', out: { text: '맨 위쪽 물만 조금 떴다.', loot: { water: 2 } } },
        { text: '건드리지 않는다', out: { text: '' } },
      ] },
    // 통로를 열기 시작한 뒤의 수문 방면
    b5_route: { title: '공사 중인 통로', prio: 6, when: { flag: 'repair_open' }, text: '도현이 이어 둔 통로 벽에 균열이 보인다. 가는 물줄기가 스며든다.',
      choices: [
        { text: '균열을 메운다', check: { skill: 'tech', base: 0.45 },
          ok: { text: '쐐기를 박고 밀봉재를 발랐다. 물줄기가 멎었다.', flood: -2, stress: -2 },
          fail: { text: '튕겨 나간 쐐기가 손등을 뚫고 박혔다. 균열은 그대로다.', injure: 1, hours: 1 } },
        { text: '표지만 달아 두고 부품을 챙긴다', out: { text: '위험 구간에 반사 테이프를 감고, 쓰다 남은 부품을 거뒀다.', loot: { parts: 1 } } },
        { text: '그냥 지나간다', out: { text: '' } },
      ] },
    g1_fallen: { title: '쓰러진 사람', prio: 0, text: '배낭을 멘 사람이 벽에 기대 숨을 헐떡인다. 입술이 갈라졌다.',
      choices: [
        { text: '약품 1개를 준다', cost: { meds: 1 }, out: { text: '그는 숨을 고르고 부품 꾸러미를 건넨다. “가져가요. 난 더 못 가.”', loot: { parts: 2 }, stress: -3 } },
        { text: '물 1개를 준다', cost: { water: 1 }, out: { text: '그는 물을 마시고 고개를 끄덕인다. 말없이 식량 한 줌을 쥐여 준다.', loot: { food: 2 } } },
        { text: '지나친다', out: { text: '등 뒤에서 숨소리가 몇 번 이어지다 멎었다. 아무도 돌아보지 않았다.', stress: 4 } },
      ] },
    g2_rats: { title: '쥐떼', prio: 0, text: '하수구에서 개만 한 쥐 수십 마리가 쏟아져 나온다.',
      choices: [
        { text: '맞서 싸운다', check: { skill: 'str', base: 0.45, item: 'pipe', bonus: 0.2 },
          ok: { text: '쥐떼가 흩어졌다. 몇 마리는 저녁거리가 됐다.', loot: { food: 3 } },
          fail: { text: '쥐 세 마리가 종아리에 매달려 살점을 뜯어 갔다. 상처 가장자리가 벌써 검게 변한다.', injure: 2 } },
        { text: '식량 1개를 던지고 물러난다', cost: { food: 1 }, out: { text: '쥐떼가 통조림에 몰려든 사이 빠져나왔다.' } },
        { text: '돌아서 간다', out: { text: '한참을 돌아 나왔다.', hours: 1 } },
      ] },
    g3_crates: { title: '쌓인 보급 상자', prio: 0, text: '무너진 선반 아래 보급 상자가 깔려 있다. 철제 뚜껑이 휘어 있다.',
      choices: [
        { text: '뚜껑을 비틀어 연다', check: { skill: 'str', base: 0.45 },
          ok: { text: '뚜껑이 요란하게 떨어졌다. 통조림과 부품이 쏟아진다.', loot: { food: 2, parts: 1 } },
          fail: { text: '휜 철판에 손바닥이 깊이 베였다. 흰 힘줄이 보였다. 부품 하나만 챙겼다.', injure: 1, loot: { parts: 1 } } },
        { text: '쇠파이프로 뚜껑을 쳐서 연다', req: { item: 'pipe' }, out: { text: '두세 번 내리치자 뚜껑이 열렸다. 소리가 멀리 울렸다.', loot: { food: 2, parts: 2 }, exposure: 1, god: { seel: 1 } } },
        { text: '바깥에 나온 것만 챙긴다', out: { text: '선반 밖으로 삐져나온 부품 하나를 주웠다.', loot: { parts: 1 } } },
      ] },
    g4_map: { title: '벽의 노선도', prio: 0, text: '찢어진 노선도에 누군가 붉은 펜으로 표시를 해 두었다. 몇몇 출구에 X자가 그려져 있다.',
      choices: [
        { text: '표시를 따라 확인한다', check: { skill: 'obs', base: 0.5 },
          ok: { text: 'X자 표시 밑에 숨겨 둔 비상 가방이 있었다.', loot: { parts: 2, meds: 1 } },
          fail: { text: '표시를 잘못 읽어 한참 헤맸다.', stress: 3, hours: 1 } },
        { text: '노선도를 눈에 익혀 둔다', out: { text: '지상까지 가는 길이 머릿속에 그려진다. 마음이 조금 놓인다.', stress: -3 } },
        { text: '지나친다', out: { text: '' } },
      ] },
    g5_child: { title: '구석의 아이', prio: 0, text: '해진 외투를 입은 아이가 빈 깡통을 안고 있다. 말을 걸어도 대답하지 않는다.',
      choices: [
        { text: '식량 1개를 건넨다', cost: { food: 1 }, out: { text: '아이가 깡통에 손을 뻗더니 생수 한 병을 내민다. 말없이 고개만 끄덕인다.', loot: { water: 2 }, stress: -3 } },
        { text: '물 1개를 건넨다', cost: { water: 1 }, out: { text: '아이가 외투 속에서 건빵 봉지를 꺼내 내민다.', loot: { food: 2 }, stress: -3 } },
        { text: '그냥 지나간다', out: { text: '아이의 시선이 오래 따라온다. 돌아오는 길에 같은 자리를 지났다. 깡통만 남아 있었다.', stress: 3 } },
      ] },
  };

  // ── 저녁 약속 사건 (예약 후속) ──
  const PROMISES = {
    eunchae_return: { title: '은채의 소식', text: '약국에서 만난 은채가 역으로 찾아왔다. “병원 팀과 연락이 닿았어요. 우리 역과 협정을 맺을 수 있대요. 대신 보급과 약을 요구해요.”',
      choices: [
        { text: '협정을 맺는다', cost: { food: 3, meds: 1 }, out: { text: '은채가 병원 쪽 사람과 악수한다. “이제 고지대 역에 갈 수 있는 곳이 생겼어요.”', flag: 'hospital_pact', ally: 'eunchae', exposure: 1, mem: '병원과 협정을 맺었다.', god: { termia: 1, ho: 1 } } },
        { text: '며칠만 기다려 달라고 한다', delay: 2, req: { noFlag: 'delayed_eunchae' }, out: { text: '은채는 이틀 뒤에 다시 오겠다고 한다. (한 번만 미룰 수 있다)', promise: { id: 'eunchae_return', days: 2 }, flag: 'delayed_eunchae' } },
        { text: '거절한다', hint: '거절하면 병원 협정은 사라진다 — 고지대 역에서 병원 팀의 마중이 없다', out: { text: '은채는 말없이 돌아선다. 다시 오지 않을 것 같다.', flag: 'pact_refused', stress: 3, mem: '병원 협정을 거절했다.', god: { termia: 1 } } },
      ] },
    dohyeon_key: { title: '도현의 열쇠', text: '도현이 열쇠를 들고 역에 왔다. “이 열쇠로 지하 통로를 열 수 있어. 하지만 낡아서 같이 고쳐야 해. 부품 3개면 돼.”',
      choices: [
        { text: '부품 3개를 내주고 공동 수리를 약속한다', cost: { parts: 3 }, out: { text: '도현이 연장을 풀었다. “공사는 너희 역에서 시작해. 일손 붙여 주면 이틀이면 이어져.” → 역 탭 [공사 시작]에서 통로 수리를 착공하고, 공사 작업에 사람을 배치하세요.', flag: 'repair_open', ally: 'dohyeon', mem: '권도현과 통로 공동 수리를 약속했다.', god: { termia: 1, ho: 1 } } },
        { text: '며칠만 기다려 달라고 한다', delay: 2, req: { noFlag: 'delayed_dohyeon' }, out: { text: '도현은 이틀 뒤에 다시 오겠다고 한다. (한 번만 미룰 수 있다)', promise: { id: 'dohyeon_key', days: 2 }, flag: 'delayed_dohyeon' } },
        { text: '필요 없다고 한다', hint: '거절하면 통로를 이을 수 없다 — 열차가 고지대 역까지 닿지 못한다', out: { text: '도현은 열쇠를 도로 집어넣고 터덜터덜 돌아간다.', flag: 'repair_refused', stress: 3, mem: '통로 수리 제안을 거절했다.', god: { termia: 1 } } },
      ] },
    // 통로를 지나쳤을 때의 두 번째 기회 (더 비싸고 늦다)
    dohyeon_second: { title: '도현의 두 번째 찾아옴', text: '며칠 전 침수된 통로에서 외치던 남자가 역 계단을 내려왔다. 팔에 붕대를 감았다. “그날 못 본 척했지. 괜찮아, 나라도 그랬을 거야. 그래도 통로는 열어야지. 이번엔 부품이 더 든다. 5개.”',
      choices: [
        { text: '부품 5개를 내주고 공동 수리를 약속한다', cost: { parts: 5 }, out: { text: '도현이 연장을 풀었다. “공사는 너희 역에서 시작해. 일손 붙여 주면 이틀이면 이어져.” → 역 탭 [공사 시작]에서 통로 수리를 착공하고, 공사 작업에 사람을 배치하세요.', flag: 'repair_open', ally: 'dohyeon', mem: '늦게나마 권도현과 통로 공동 수리를 약속했다.', god: { termia: 1, ho: 1 } } },
        { text: '필요 없다고 한다', hint: '거절하면 통로를 이을 수 없다 — 열차가 고지대 역까지 닿지 못한다', out: { text: '도현은 어깨를 으쓱하고 돌아선다.', flag: 'repair_refused', stress: 3, mem: '통로 수리 제안을 거절했다.', god: { termia: 1 } } },
      ] },
  };

  // ── 영구 상처: 중상·위독에 이를 때 굴려서 남는다 (사람마다 최대 2개). skill: 그 기술 −1, noExp: 원정 불가, 나머지 키는 특성과 같다 ──
  const SCARS = {
    finger: { name: '잘린 손가락', desc: '기술 −1', skill: 'tech', text: '{who}의 손가락 두 마디가 짓이겨져 덜렁거렸다. 녹슨 가위로 잘라 냈다. 비명은 생각보다 짧았다.' },
    eye: { name: '잃은 눈', desc: '관찰 −1', skill: 'obs', text: '{who}의 왼쪽 눈이 부어오르다 터졌다. 고름이 멎은 자리에는 아무것도 남지 않았다.' },
    hand: { name: '으스러진 손', desc: '완력 −1', skill: 'str', text: '{who}의 손뼈가 으스러져 손등이 안쪽으로 꺾였다. 다시는 주먹을 쥐지 못한다.' },
    leg: { name: '저는 다리', desc: '원정 불가', noExp: true, text: '{who}의 정강이뼈가 살을 뚫고 나왔다. 부목을 댔지만 다시는 제대로 걷지 못한다.' },
    lung: { name: '썩은 폐', desc: '휴식 회복 −4', restLess: 4, text: '{who}의 기침에 검은 피가 섞이기 시작했다. 밤새 멎지 않는다.' },
    face: { name: '뭉개진 얼굴', desc: '말솜씨 −1', skill: 'talk', text: '{who}의 얼굴 반쪽이 뭉개졌다. 아이들이 {who:을/를} 보면 고개를 돌린다.' },
  };
  const SCAR_CHANCE = { 2: 0.45, 3: 0.6 };   // 중상에 이를 때 / 위독에 이를 때

  // ── 붕괴: 스트레스 100에 닿으면 각성하거나 무너진다 (days 동안 일을 못 함) ──
  const VIRTUE = { name: '굳건함', desc: '일 스트레스 −2', workStress: -2, chance: 0.25,
    text: '{who:이/가} 벽에 머리를 박고 한참을 서 있었다. 그리고 고개를 들었다. “아직 아니야.” 그 목소리에 다들 숨을 돌린다.' };
  const AFFLICTIONS = {
    hoard: { name: '편집증', desc: '식량 −3을 숨김', days: 2, food: -3,
      text: '{who:이/가} 밤새 창고를 들락거렸다. 아침에 보니 통조림이 비었다. 침낭 속에 감춘 깡통을 껴안고 “내 거야”만 되뇐다.' },
    despair: { name: '자포자기', desc: '3일간 일 못 함 · 매일 밤 모두 스트레스 +3', days: 3, ambient: 3, others: 4,
      text: '{who:이/가} 선로 위에 드러누워 움직이지 않는다. 물도 받아먹지 않는다. 밤마다 흐느끼는 소리가 승강장을 채운다.' },
    violent: { name: '폭력', desc: '다른 주민 부상 1 · 모두 스트레스 +6', days: 2, others: 6, hurtOther: 1,
      text: '{who:이/가} 아무 말 없이 {who2:을/를} 덮쳤다. 쇠파이프가 세 번 내려가고서야 사람들이 떼어 냈다.' },
    flee: { name: '도주', desc: '본인 중상', days: 2, hurtSelf: 2,
      text: '{who:이/가} 비명을 지르며 터널로 뛰쳐나갔다. 새벽에 피투성이로 기어 돌아왔다. 무엇을 봤는지는 말하지 않는다.' },
  };

  // ── 시신: 누군가 죽은 그날 밤(또는 다음 밤) 반드시 처리해야 한다. taboo는 되돌릴 수 없는 선 ──
  const CORPSE = { title: '시신', text: '{who}의 몸이 담요 아래서 굳어 간다. 벌써 파리가 꼬인다. 누군가 정해야 한다.',
    choices: [
      { text: '선로 끝에 묻고 이름을 불러 준다', cost: { food: 1 }, out: { text: '마지막 건빵 한 조각을 무덤 위에 올렸다. 한 사람씩 {who}의 이름을 불렀다. 우는 사람은 없었다. 울 기운이 없었다.', stress: -8, mem: '{who:을/를} 묻어 주었다.', buried: true, god: { osren: 1, ho: 2 } } },
      { text: '터널 깊숙이 끌어다 둔다', hint: '시신을 두면 썩는 냄새와 병이 돌 수 있다', out: { text: '발목을 잡고 끌었다. 머리가 침목에 부딪히는 소리가 어둠 속으로 멀어졌다.', stress: 3, flag: 'corpse_left', god: { osren: 2, gurmah: 1 } } },
      { text: '살을 발라 식량으로 쓴다', taboo: true, hint: '돌아올 수 없는 선이다 — 모두 스트레스 +15, 이 일은 명부에 남는다', out: { text: '아무도 눈을 마주치지 않았다. 칼날이 뼈에 닿을 때마다 누군가 토했다. 그날 밤 모두 배불리 먹었다. 맛에 대해서는 아무도 말하지 않는다.', res: { food: 6 }, stress: 15, flag: 'ate_dead', memAll: '{who:을/를} 먹었다.', hoGone: true, god: { osren: 2, gurmah: 3 } } },
    ] };

  // ── 바깥 신들 (docs/gods_design.md). 시선 0~6: 3에 닿으면 징조, 6에 닿으면 강림(있는 신만) 뒤 2로 ──
  // 결과 키(신 전용): god{id:n} 시선, vanish('water'|'random'|'weakest'|'who') 시신 없이 사라짐, foodHalf, possess(who), scarGuard(상처 id),
  //                  ticket 검표, ashGift 잿빛 선물, reap 거둠, flame 불씨지기(who), noDark 일수, hoCall 다음 붕괴는 각성, hoGone
  const GODS = {
    nereh: { name: '네레흐', alias: '바닥의 어미', kind: 'hostile', hint: '배수로 바닥의 숨소리',
      raise: 'D5 수문 범람 +2 · 침수 4 이상인 밤 +1 · 수문 방면 깊이 2 +1 · 물에 빠진 사람을 버림 +1 / 침수 1 이하인 밤 −1',
      omen: { title: '물속의 노래', who: 1, text: '배수로 쪽에서 자장가가 들린다. 어머니 목소리다. {who:이/가} 일어나 맨발로 물가를 향해 걸어간다. 눈을 뜬 채 자고 있다.',
        choices: [
          { text: '달려가 끌어낸다', check: { skill: 'str', base: 0.5 },
            ok: { text: '허리를 붙잡고 뒤로 넘어졌다. {who:이/가} 깨어나 비명을 질렀다. 발목에 손자국 같은 멍이 남았다.', stress: 4 },
            fail: { text: '물속에서 무언가가 {who}의 발목을 잡아당겼다. 겨우 빼냈을 때 다리 살이 물에 불어 하얗게 벗겨져 있었다.', injure: 2, stress: 4, god: { nereh: 1 } } },
          { text: '다 같이 노래를 덮을 만큼 크게 떠든다', out: { text: '밤새 아무 노래나 고래고래 불렀다. 자장가는 새벽에야 멎었다. 목이 쉬었다.', stress: 6, exposure: 1 } },
          { text: '보내 준다', out: { text: '{who:은/는} 웃으며 물속으로 걸어 들어갔다. 물결 하나 일지 않았다. 아무도 따라가지 않았다.', vanish: 'who', god: { nereh: 1 } } },
        ] },
      advent: { title: '들숨', text: '역 전체가 한 번 크게 기울었다. 배수로의 물이 거꾸로 빨려 들어갔다가 숨을 내쉬듯 쏟아져 나온다. 바닥의 어미가 숨을 쉰다. 물가에서 일하던 사람들의 발목에 검은 물이 감긴다.',
        choices: [
          { text: '물가의 사람들부터 끌어올린다', check: { skill: 'str', base: 0.4 },
            ok: { text: '모두 끌어올렸다. 그사이 창고에 물이 들이쳐 식량 절반이 퉁퉁 불어 썩었다.', flood: 3, foodHalf: true },
            fail: { text: '한 사람의 손이 미끄러졌다. 검은 물이 그를 삼키고 아무 일 없다는 듯 잔잔해졌다. 창고의 식량 절반도 썩었다.', flood: 3, foodHalf: true, vanish: 'water' } },
          { text: '창고 문부터 막는다', out: { text: '식량은 지켰다. 물가에서 비명이 한 번 들렸고, 그다음은 조용했다.', flood: 3, vanish: 'water' } },
        ] } },
    gurmah: { name: '구르마흐', alias: '빈 입', kind: 'hostile', hint: '굶주린 꿈속의 속삭임',
      raise: '굶은 밤 +2 · 창고가 하루치도 안 남은 밤 +1 · 시신을 버림 +1 · 시신을 먹음 +3 / 배불리 먹은 밤(식량이 인원×3 이상) −1',
      omen: { title: '배부른 꿈', who: 2, text: '{who:이/가} 잠결에 {who2}의 팔을 물었다. 깨워도 이를 풀지 않는다. 겨우 떼어 내자 {who:이/가} 웃으며 말한다. “꿈에서 배불리 먹었어. 또 먹고 싶어.”',
        choices: [
          { text: '{who:을/를} 밤새 묶어 둔다', out: { text: '밧줄에 묶인 채 {who:이/가} 밤새 입맛을 다셨다. 아무도 잠들지 못했다.', stress: 5 } },
          { text: '못 들은 걸로 한다', out: { text: '새벽에 {who2}의 팔에 이빨 자국이 하나 더 늘었다.', injure: 1, stress: 3, god: { gurmah: 1 } } },
        ] },
      advent: { title: '잔칫상', text: '아침, 승강장 한가운데 김이 나는 고기가 산더미처럼 차려져 있다. 기름이 반짝인다. 누구의 살인지 아무도 모른다. 모두의 배가 울었다.',
        choices: [
          { text: '먹는다', out: { text: '처음엔 한 입이었다. 손이 멈추지 않았다. 다 먹고 나서야 고기 사이에서 반지 낀 손가락을 찾았다.', res: { food: 10 }, stress: 20, possess: true, hoGone: true, memAll: '빈 입의 잔칫상을 먹었다.' } },
          { text: '상을 엎는다', out: { text: '고기가 바닥에 쏟아지자 꿈틀거리며 어둠 속으로 기어갔다. 다음 날 아침, 가장 약한 사람의 침낭이 비어 있었다.', stress: 10, vanish: 'weakest' } },
        ] } },
    seel: { name: '세엘', alias: '세는 자', kind: 'hostile', hint: '계단 위 안개 속의 눈',
      raise: '노출 6 이상인 밤 +1 · 불을 사흘 연속 켬 +1 · 큰 소리를 낸 선택 +1 / 경계 2명을 세운 밤 −1',
      omen: { title: '세는 소리', text: '밤새 출구 계단 위에서 누군가 숫자를 센다. “하나… 둘… 셋…” 역에 있는 사람 수와 정확히 같은 수에서 멈춘다. 그리고 처음부터 다시 센다.',
        choices: [
          { text: '모두 깨어 함께 숫자를 센다', out: { text: '이쪽에서 세는 소리와 저쪽의 소리가 겹쳤다. 하나가 더 많았다. 아무도 다시 세지 않았다.', stress: 6 } },
          { text: '불을 모두 끄고 숨을 죽인다', out: { text: '어둠 속에서 세는 소리가 승강장 바로 위까지 내려왔다가 멀어졌다.', stress: 3, exposure: -2 } },
        ] },
      advent: { title: '눈이 내려온다', text: '안개가 계단을 타고 승강장까지 밀려 내려왔다. 그 한가운데 눈 하나가 떠 있다. 사람의 키만 한 눈이 천천히 사람들을 한 명씩 본다.',
        choices: [
          { text: '경계를 서던 사람이 계단 앞을 막는다', req: { guards: 1 }, out: { text: '경계가 눈을 마주 봤다. 안개가 물러났다. 그가 비명을 지르며 얼굴을 감쌌다. 손가락 사이로 피눈물이 흘렀다.', scarGuard: 'eye', exposure: -3 } },
          { text: '모두 눈을 감고 기다린다', out: { text: '눈을 떴을 때 안개는 걷혀 있었다. 한 사람의 자리가 비어 있었다. 계단 위로 맨발 자국이 이어졌다.', vanish: 'random', exposure: -3 } },
        ] } },
    termia: { name: '테르미아', alias: '검표원', kind: 'neutral', hint: '선로 끝에서 오는 규칙',
      raise: '약속을 지킴 +1 · 약속을 어김 +1 (좋고 나쁨이 아니라 약속 자체에 반응)',
      omen: { title: '검표', text: '꿈속에서 열차 안이다. 제복의 차장이 통로를 걸어오며 표를 검사한다. 당신 차례다. 차장의 수첩에는 당신이 한 약속과 어긴 약속이 빼곡히 적혀 있다.',
        choices: [
          { text: '표를 내민다', out: { text: '차장이 수첩을 넘기다 고개를 끄덕였다. 혹은 저었다. 펀치가 손등에 구멍을 뚫었다. 아침에 손등에 정말 구멍이 나 있었다.', ticket: true } },
          { text: '고개를 돌린다', out: { text: '차장은 아무 말 없이 다음 칸으로 갔다.', god: { termia: -1 } } },
        ] } },
    osren: { name: '오스렌', alias: '잿빛 손', kind: 'neutral', hint: '죽은 이 곁의 잿빛 손',
      raise: '누군가 죽음 +1 · 장례 +1 · 시신을 버리거나 먹음 +2',
      omen: { title: '잿빛 손님', text: '저녁 화로 앞에 잿빛 손님이 앉아 있다. 얼굴이 자꾸 아는 사람으로 바뀐다. 손님이 묻는다. “잘 보내 주었나?”',
        choices: [
          { text: '자리를 내준다', out: { text: '손님은 불을 쬐다 일어났다. 그가 앉았던 자리에 재가 한 줌 남았다.', ashGift: true } },
          { text: '불을 들어 쫓는다', out: { text: '손님은 웃으며 재로 흩어졌다. 그 재가 밤새 사람들의 입에 들어갔다.', stress: 3, god: { osren: -1 } } },
        ] },
      advent: { title: '거둠', text: '잿빛 손이 승강장 천장에서 천천히 내려온다. 셀 수 없이 많은 손가락이 무언가를 고르듯 사람들 위를 더듬는다.',
        choices: [
          { text: '그대로 둔다', out: { text: '손이 한 사람을 골라 쓰다듬고 거두어 갔다.', reap: true } },
          { text: '손을 붙잡고 말을 건다', check: { skill: 'talk', base: 0.35 },
            ok: { text: '“아직은 아니야.” 손가락들이 망설이다 천장으로 돌아갔다.', stress: 4 },
            fail: { text: '손이 말을 건 사람의 입을 쓸고 지나갔다. 그리고 원래 고른 사람을 거두어 갔다.', reap: true, stress: 6 } },
        ] } },
    hiska: { name: '히스카', alias: '작은 불', kind: 'friendly', hint: '화로 속의 작은 얼굴',
      raise: '불을 켠 밤 두 번에 +1 · 어둠 속에서 불을 피움 +1 / 어두운 밤 −1',
      omen: { title: '불 속의 얼굴', text: '화로 불꽃이 사람 얼굴 모양으로 일렁인다. 아이 얼굴 같기도 하다. 불 곁에 있으면 이상하게 마음이 놓인다.',
        choices: [
          { text: '불 앞에 둘러앉는다', out: { text: '오랜만에 다 같이 깊이 잤다. 그 뒤로 이틀 동안 어둠 속의 소리가 들리지 않았다.', stress: -6, noDark: 2 } },
          { text: '불을 줄인다', out: { text: '얼굴은 작아지다 사라졌다. 조금 쓸쓸했다.', exposure: -1, god: { hiska: -1 } } },
        ] },
      advent: { title: '영원의 불씨', who: 1, text: '화로의 불이 스스로 일어나 {who}의 가슴 앞에 멈춘다. 받아 달라는 듯 떨린다. 받으면 이 불은 꺼지지 않는다. 대신 받은 사람은 불 곁을 떠나지 못한다.',
        choices: [
          { text: '{who:이/가} 불씨를 받는다', out: { text: '불씨가 {who}의 가슴속으로 들어갔다. 그날부터 역은 밤새 밝다. {who:은/는} 다시는 계단을 오르지 않는다.', flame: true, stress: -4 } },
          { text: '불씨를 돌려보낸다', out: { text: '불씨는 화로로 돌아가 조용히 사그라들었다.', stress: 2, god: { hiska: -2 } } },
        ] } },
    ho: { name: '호', alias: '부르는 소리', kind: 'friendly', hint: '이름을 부를 때의 온기',
      raise: '저녁 대화 +1 · 장례에서 이름을 부름 +2 · 약속을 지킴 +1 / 사람을 먹으면 영원히 떠남',
      omen: { title: '부르는 소리', text: '어둠 속에서 누군가 이름을 부른다. 한 사람씩, 아주 다정하게. 아무도 자기 이름이 불리는 걸 무서워하지 않았다.',
        choices: [
          { text: '대답한다', out: { text: '“여기 있어요.” 대답한 사람들의 가슴에 작은 온기가 남았다. 누군가 한계에 닿으면 이 소리가 붙잡아 줄 것이다.', hoCall: true, stress: -3 } },
          { text: '귀를 막는다', out: { text: '소리는 한참 이름을 부르다 멎었다.', god: { ho: -1 } } },
        ] } },
  };

  // ── 신의 영향을 받은 크리처 ──
  // 원정: creature(신 id)가 붙은 사건은 그 신의 시선이 높을수록 자주 나온다. region이 있으면 그 지역에서만.
  const CREATURE_EVENTS = {
    c_drowned: { title: '익사자', creature: 'nereh', region: 'B', text: '물속에서 퉁퉁 불은 사람이 일어선다. 눈구멍에 물이 고여 찰랑거린다. 입을 벌리자 배수로 물이 쏟아졌다. 발목을 향해 손을 뻗는다.',
      choices: [
        { text: '쇠파이프로 머리를 친다', req: { item: 'pipe' }, out: { text: '머리가 젖은 빵처럼 뭉개졌다. 그 안에서 작은 물고기들이 쏟아져 나왔다. 주머니에서 부품을 챙겼다.', loot: { parts: 2 }, stress: 4, god: { seel: 1 } } },
        { text: '물 밖으로 달아난다', check: { skill: 'str', base: 0.5 },
          ok: { text: '첨벙거리며 계단을 기어올랐다. 뒤에서 물이 한숨을 쉬었다.', hours: 1 },
          fail: { text: '발목을 잡혔다. 물속으로 끌려 들어가다 겨우 빠져나왔다. 발목에 손가락 자국이 검게 남았다.', injure: 2, hours: 1, god: { nereh: 1 } } },
        { text: '가진 물을 던져 준다', cost: { water: 2 }, out: { text: '그것은 물통을 끌어안고 천천히 가라앉았다. 고맙다는 듯이.', god: { nereh: -1 } } },
      ] },
    c_twomouth: { title: '입이 둘인 쥐', creature: 'gurmah', text: '턱 아래에 입이 하나 더 달린 쥐들이 몰려온다. 아래쪽 입에는 사람 이빨이 나 있다. 위쪽 입이 찍찍대는 동안 아래쪽 입이 웃는다.',
      choices: [
        { text: '맞서 싸운다', check: { skill: 'str', base: 0.4, item: 'pipe', bonus: 0.2 },
          ok: { text: '쥐들을 때려잡았다. 고기는 고기다. 아래쪽 입은 잘라 버렸다.', loot: { food: 3 }, god: { gurmah: 1 } },
          fail: { text: '아래쪽 입이 정강이를 물고 살점을 씹어 삼켰다. 쥐는 사람처럼 트림을 했다.', injure: 2 } },
        { text: '식량 2개를 던지고 물러난다', cost: { food: 2 }, out: { text: '쥐들이 통조림을 깡통째 씹어 먹는 소리를 뒤로하고 빠져나왔다.' } },
        { text: '돌아서 간다', out: { text: '한참을 돌아 나왔다. 아래쪽 입의 웃음소리가 오래 따라왔다.', hours: 1, stress: 3 } },
      ] },
    c_counter: { title: '세는 아이', creature: 'seel', text: '벽을 보고 선 아이가 숫자를 센다. “하나, 둘.” 당신들 발소리에 맞춰 센다. 돌아보지 않는다.',
      choices: [
        { text: '말을 건다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '아이가 세는 걸 멈추고 손가락으로 벽 틈을 가리켰다. 누군가 숨겨 둔 꾸러미가 있었다. 돌아보니 아이는 없었다.', loot: { parts: 2, meds: 1 }, god: { seel: -1 } },
          fail: { text: '아이가 돌아봤다. 얼굴에 눈이 없었다. 눈이 있어야 할 자리에서 숫자를 세는 소리가 났다.', stress: 8, exposure: 1, god: { seel: 1 } } },
        { text: '숨을 죽이고 지나간다', out: { text: '등 뒤에서 아이가 “셋”이라고 말했다. 동행은 둘뿐이었다.', stress: 4 } },
      ] },
    c_conductor: { title: '차장', creature: 'termia', text: '물 빠진 터널 한가운데 제복을 갖춰 입은 차장이 서 있다. 모자 밑으로 얼굴이 보이지 않는다. “표를 보여 주시겠습니까.”',
      choices: [
        { text: '식량 2개를 운임으로 낸다', cost: { food: 2 }, req: { noFlag: 'punched' }, out: { text: '차장이 펀치로 손등에 구멍을 뚫었다. 피가 나지 않았다. “열차에서 뵙겠습니다.” (승차 정원 +1)', flag: 'punched', seatPlus: 1, god: { termia: 1 } } },
        { text: '표가 없다고 말한다', out: { text: '차장이 수첩에 무언가 적었다. 펜이 종이를 긁는 소리가 이빨 가는 소리 같았다.', stress: 4, god: { termia: 1 } } },
        { text: '뒤로 물러선다', out: { text: '돌아보니 차장은 없었다. 선로에 펀치 구멍 같은 동그란 자국만 남았다.', hours: 1 } },
      ] },
    c_bonepicker: { title: '뼈 줍는 이', creature: 'osren', text: '잿빛 누더기를 걸친 노인이 자루 가득 뼈를 줍고 있다. 당신들을 보고 이 빠진 입으로 웃는다. “좋은 뼈가 있으면 바꿔 주지.”',
      choices: [
        { text: '손가락 하나를 내준다', out: { text: '노인이 녹슨 펜치를 꺼냈다. 뼈가 끊기는 소리는 생각보다 작았다. 노인은 약상자와 부품 꾸러미를 내밀었다.', scarParty: 'finger', loot: { meds: 2, parts: 2 }, god: { osren: 1 } } },
        { text: '식량 2개를 내민다', cost: { food: 2 }, out: { text: '노인이 통조림을 흔들어 보고 자루에서 약병 하나를 꺼냈다. 병 안에 이빨이 하나 들어 있었다.', loot: { meds: 1 } } },
        { text: '지나간다', out: { text: '노인이 등 뒤에서 중얼거렸다. “어차피 다 내게 오게 돼 있어.”', stress: 2 } },
      ] },
    c_echo: { title: '메아리', creature: 'ho', text: '터널 저편에서 누군가 이름을 부른다. 죽은 줄 알았던 가족의 목소리다. 동행이 걸음을 멈췄다.',
      choices: [
        { text: '소리를 따라간다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '소리가 멈춘 자리에 누군가 남긴 쪽지와 꾸러미가 있었다. 쪽지에는 “살아 있어”라고만 적혀 있었다.', loot: { food: 2, water: 2 }, stress: -4, god: { ho: 1 } },
          fail: { text: '소리는 점점 아래로 내려갔다. 따라가다 바닥이 꺼졌다. 떨어지는 동안에도 그 목소리가 이름을 불렀다.', injure: 2, hours: 1 } },
        { text: '이름을 불러 대답한다', out: { text: '“여기 있어!” 메아리가 따뜻하게 돌아왔다. 둘 다 조금 울었다.', stress: -5, god: { ho: 1 } } },
        { text: '귀를 막고 지나간다', out: { text: '목소리는 한참 따라오다 울음으로 바뀌었다.', stress: 3 } },
      ] },
  };
  const CREATURES = Object.keys(CREATURE_EVENTS);
  Object.assign(EVENTS, CREATURE_EVENTS);

  // ── 밤 사건 (매일 1장, 달력 사건은 별도). {who}/{who2}는 주민 이름, weight는 숫자 또는 (상태)=>숫자 ──
  const NIGHT = {
    n_knock: { title: '쪽문을 두드리는 소리', weight: 3, minDay: 2, text: '한밤중, 계단 쪽 철문을 누군가 두드린다. “들여보내 주세요… 제발.”',
      choices: [
        { text: '문을 열어 들인다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '지친 얼굴의 사람이 담요를 받아 들고 하룻밤 자고 간다. 아침에 부품 하나를 두고 사라졌다.', res: { food: -2, parts: 1 }, stress: -2 },
          fail: { text: '문을 연 순간 둘이 밀고 들어왔다. 하나가 문지기의 얼굴을 벽돌로 내리쳤다. 창고를 털어 달아났다.', res: { food: -3, parts: -1 }, injure: 2, exposure: 1 } },
        { text: '틈으로 먼저 살핀다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '혼자다. 무기도 없다. 들어온 그는 가방에서 통조림을 꺼내 나눈다.', res: { food: 2 } },
          fail: { text: '어두워서 누군지 알 수 없었다. 문을 열지 못했다.', stress: 2 } },
        { text: '열지 않는다', out: { text: '두드리는 소리가 손톱 긁는 소리로 바뀌었다가 멎었다. 아침에 문 밑으로 핏자국이 번져 있었다. 아무도 그 이야기를 꺼내지 않는다.', stress: 5 } },
      ] },
    n_fever: { title: '열병', weight: 2, minDay: 2, who: 1, text: '{who:이/가} 밤새 열에 시달린다. 이마가 불덩이 같다.',
      choices: [
        { text: '약품을 쓴다', cost: { meds: 1 }, out: { text: '해열제를 먹이자 새벽쯤 열이 내렸다.', stress: -2 } },
        { text: '물수건으로 밤새 간호한다', cost: { water: 2 }, check: { skill: 'talk', base: 0.5 },
          ok: { text: '밤을 꼬박 새웠다. 아침엔 열이 내렸다.' },
          fail: { text: '새벽녘 {who:이/가} 헛소리를 하며 경련했다. 혀를 깨물지 않게 수건을 물렸다.', injure: 1 } },
        { text: '따로 눕혀 두고 지켜본다', out: { text: '열이 오래 갔다.', injure: 1, stress: 2 } },
      ] },
    n_quarrel: { title: '다툼', weight: 2, minDay: 3, who: 2, text: '배급 문제로 {who:과/와} {who2:이/가} 서로의 목을 졸랐다. 얼굴이 시퍼레지는데도 손을 놓지 않는다. 다들 당신을 쳐다본다.',
      choices: [
        { text: '사이에 끼어 말린다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '둘은 씩씩대다 결국 악수했다. 분위기가 풀렸다.', stress: -3 },
          fail: { text: '말리는 손을 뿌리치고 하나가 상대의 귀를 물어뜯었다. 바닥에 귓바퀴 조각이 떨어졌다.', injure: 1, stress: 3 } },
        { text: '내 몫을 나눠 준다', cost: { food: 2 }, out: { text: '당신이 자기 몫을 내밀자 둘 다 머쓱해졌다.', stress: -4 } },
        { text: '못 본 척한다', out: { text: '다툼은 새벽까지 이어졌다.', stress: 6 } },
      ] },
    n_leak: { title: '물이 새는 소리', weight: 2, minDay: 2, text: '천장 배관에서 물이 떨어진다. 바닥이 질척하다.',
      choices: [
        { text: '배관을 손본다', check: { skill: 'tech', base: 0.45 },
          ok: { text: '새는 곳을 막고 받이를 달았다. 꽤 많은 물을 모았다.', res: { water: 4 } },
          fail: { text: '배관이 터져 바닥이 물바다가 됐다.', flood: 2, stress: 2 } },
        { text: '양동이를 받쳐 둔다', out: { text: '아침까지 양동이 두 개가 찼다.', res: { water: 2 }, flood: 1 } },
      ] },
    n_quiet: { title: '조용한 밤', weight: 2, minDay: 2, text: '오늘 밤은 이상하게 조용하다. 누군가 작게 노래를 흥얼거린다.',
      choices: [
        { text: '다 같이 둘러앉아 남은 건빵을 나눈다', cost: { food: 1 }, out: { text: '옛날 노래를 하나씩 불렀다. 오랜만에 웃음소리가 났다.', stress: -6 } },
        { text: '일찍 눕는다', out: { text: '푹 잤다. 다친 사람들도 한결 낫다.', stress: -3, heal: 1 } },
      ] },
      // 전력이 끊긴 밤에만 온다
    n_dark: { title: '불 꺼진 승강장', weight: (s) => (s.dark && !(s.noDarkUntil >= s.day) ? 5 : 0), minDay: 1, text: '발전기가 멈춘 밤. 승강장 저편 선로 위로 무언가 질질 끌리는 소리가 다가온다. 숨소리가 하나 더 들린다.',
      choices: [
        { text: '쇠파이프를 들고 불빛 없이 나간다', check: { skill: 'str', base: 0.4 },
          ok: { text: '쥐도 사람도 아니었다. 그것은 손전등 불빛이 닿자 선로 아래로 미끄러져 사라졌다. 끈적한 자국만 남았다.', stress: -2 },
          fail: { text: '어둠 속에서 무언가가 팔을 물고 놓지 않았다. 끌려가기 직전에 겨우 빼냈다. 팔뚝 살점이 한 움큼 없다.', injure: 2, stress: 4 } },
        { text: '부품을 태워 불을 피운다', cost: { parts: 1 }, out: { text: '전선 피복이 타는 매캐한 냄새와 함께 불빛이 번지자 소리가 멎었다. 연기가 계단 위로 새어 나갔다.', exposure: 1, god: { hiska: 1 } } },
        { text: '모두 숨을 죽이고 기다린다', out: { text: '소리는 새벽까지 승강장 가장자리를 맴돌았다. 아무도 눈을 감지 못했다. 아침에 보니 침낭 하나가 갈가리 찢겨 있었다.', stress: 6 } },
      ] },
    // 시신을 터널에 버려 두면 온다
    n_rot: { title: '썩는 냄새', weight: (s) => (s.flags.corpse_left ? 4 : 0), minDay: 2, who: 1, text: '터널 쪽에서 들큼한 냄새가 밀려온다. {who:이/가} 밤새 구역질을 하더니 열이 오르기 시작했다.',
      choices: [
        { text: '가서 시신을 태운다', cost: { parts: 1 }, out: { text: '부풀어 오른 몸에 불을 붙였다. 기름 타는 냄새가 사흘 동안 빠지지 않았다.', exposure: 2, stress: 4, unflag: 'corpse_left', god: { hiska: 1 } } },
        { text: '약품으로 열을 잡는다', cost: { meds: 1 }, out: { text: '열은 잡았다. 냄새는 그대로다.' } },
        { text: '코를 막고 버틴다', out: { text: '{who:이/가} 새벽에 피 섞인 설사를 쏟았다. 냄새는 갈수록 짙어진다.', injure: 1, stress: 4 } },
      ] },
    // ── 신의 영향을 받은 밤의 크리처 ──
    n_leeches: { title: '물거머리', creature: 'nereh', weight: (s) => (s.flood >= 4 ? 1 + (s.gods ? s.gods.nereh : 0) : 0), minDay: 2, who: 1, text: '물이 찬 바닥에서 손가락만 한 검은 거머리들이 기어 올라왔다. 잠든 {who}의 다리에 수십 마리가 붙어 부풀고 있다.',
      choices: [
        { text: '부품을 태워 지져 뗀다', cost: { parts: 1 }, out: { text: '불에 닿자 거머리들이 비명 같은 소리를 내며 떨어졌다. 다리에 동그란 자국이 빼곡하다.', stress: 2 } },
        { text: '손으로 뜯어낸다', out: { text: '뜯을 때마다 살점이 함께 딸려 나왔다. 거머리 몸속에서 피가 아니라 검은 물이 쏟아졌다.', injure: 1, stress: 3, god: { nereh: 1 } } },
      ] },
    n_moths: { title: '안개 나방', creature: 'seel', weight: (s) => ((s.litStreak || 0) >= 1 ? 1 + 0.7 * (s.gods ? s.gods.seel : 0) : 0), minDay: 2, text: '불빛에 잿빛 나방들이 몰려든다. 날개를 털 때마다 가루가 흩날리고, 가루가 내려앉은 자리마다 안개가 피어오른다. 날개 무늬가 눈 모양이다.',
      choices: [
        { text: '불을 끈다', out: { text: '어둠 속에서 나방들이 사람들 얼굴에 내려앉았다. 날개가 눈꺼풀을 더듬었다.', exposure: -1, stress: 4 } },
        { text: '잡아서 불에 태운다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '한 마리씩 불에 던졌다. 타면서 작은 눈들이 터졌다.', exposure: -1 },
          fail: { text: '나방이 터지면서 가루가 폭발하듯 퍼졌다. 안개가 계단 위로 길을 만들었다.', exposure: 2, god: { seel: 1 } } },
        { text: '내버려 둔다', out: { text: '아침까지 안개가 승강장에 깔렸다. 누군가 위에서 이쪽을 보고 있다는 느낌이 지워지지 않는다.', exposure: 2 } },
      ] },
    n_lampimp: { title: '등잔 도깨비', creature: 'hiska', weight: (s) => (s.gods && s.gods.hiska >= 1 ? 1 + 0.5 * s.gods.hiska : 0), minDay: 2, text: '화로 속에서 손가락만 한 불 도깨비가 기어 나왔다. 부품 더미를 가리키며 손짓한다. 배가 고픈 모양이다.',
      choices: [
        { text: '부품 1개를 먹인다', cost: { parts: 1 }, out: { text: '도깨비가 볼트를 우물우물 씹더니 화로 위에 앉아 밤새 불을 지켰다. 어둠 속의 소리가 다가오지 못했다.', stress: -4, noDark: 1, god: { hiska: 1 } } },
        { text: '쫓아낸다', out: { text: '도깨비가 서럽게 타닥거리며 화로 속으로 사라졌다. 불이 조금 약해진 것 같다.', stress: 2, god: { hiska: -1 } } },
      ] },
    n_ghoul: { title: '굶은 자', creature: 'gurmah', weight: (s) => ((s.gods && s.gods.gurmah >= 2) || s.flags.ate_dead ? 1 + (s.gods ? s.gods.gurmah : 0) : 0), minDay: 2, text: '창고 쪽에서 무언가 씹는 소리가 난다. 손전등을 비추자 갈비뼈가 다 드러난 사람이 통조림을 깡통째 씹고 있다. 입이 귀까지 찢어져 있다. 이쪽을 보고 웃는다.',
      choices: [
        { text: '경계가 몰아낸다', req: { guards: 1 }, check: { skill: 'str', base: 0.5, guards: true },
          ok: { text: '쇠파이프에 맞은 그것이 네 발로 계단을 기어 올라갔다. 이빨 몇 개가 바닥에 남았다.', stress: -2 },
          fail: { text: '그것이 경계의 어깨를 물고 살점을 뜯어 갔다. 씹으면서 웃었다.', injure: 2, stress: 4 } },
        { text: '식량 3개를 던져 준다', cost: { food: 3 }, out: { text: '그것은 통조림을 안고 어둠 속으로 사라졌다. 내일도 올 것 같다.', god: { gurmah: 1 } } },
        { text: '숨어서 기다린다', out: { text: '새벽까지 씹는 소리가 이어졌다. 아침에 창고 바닥에 이빨 자국 난 깡통만 굴러다녔다.', res: { food: -4 }, stress: 6 } },
      ] },
    // 노출이 높을수록 자주 온다. 경계를 세워 두면 막을 수 있다.
    n_thief: { title: '창고를 뒤지는 소리', weight: (s) => Math.max(0, s.exposure - 3), minDay: 2, text: '자정 무렵 누군가 창고를 뒤지는 소리가 들린다. 불빛이 새어 나간 모양이다.',
      choices: [
        { text: '경계를 서던 사람이 막는다', req: { guards: 1 }, out: { text: '경계조가 도둑을 쫓아냈다. 문 밖에 흘린 통조림까지 주웠다.', exposure: -1, stress: -2 } },
        { text: '직접 쫓아간다', check: { skill: 'str', base: 0.45 },
          ok: { text: '계단에서 붙잡아 물건을 되찾았다.', stress: -2 },
          fail: { text: '계단에서 붙잡았지만 상대가 칼을 꺼냈다. 옆구리가 뜨거웠다. 그사이 창고가 털렸다.', res: { food: -3, parts: -1 }, injure: 2 } },
        { text: '그냥 둔다', out: { text: '아침에 보니 식량 상자가 가벼워져 있다.', res: { food: -3, parts: -1 } } },
      ] },
  };

  // 달력 사건 (고정). 예보는 forecast 일수만큼 앞서 아침 화면에 표시.
  const CALENDAR = {
    surge: { day: 5, forecast: 3, title: '수문 범람', short: '침수 +3', text: '수문이 터졌다. 배수로에서 물이 거꾸로 밀려든다. 침수 +3.' },
    patrol: { day: 8, forecast: 3, title: '순찰대 방문', short: '외부 세력 방문', text: '횃불을 든 순찰대가 계단을 내려온다. “이 역 책임자가 누구지? 보급 상태를 좀 보자.”' },
  };
  const PATROL = {
    title: '순찰대 방문', text: '횃불을 든 순찰대가 계단을 내려온다. “이 역 책임자가 누구지? 보급 상태를 좀 보자.”',
    choices: [
      { text: '식량 4개를 내준다', cost: { food: 4 }, out: { text: '순찰대는 자루를 메고 말없이 올라갔다.', exposure: -3 } },
      { text: '경계를 서던 두 사람과 함께 맞선다', req: { guards: 2 }, check: { skill: 'str', base: 0.45, guards: true },
        ok: { text: '경계조가 계단을 막고 버텼다. 순찰대는 욕을 하며 물러갔다.', exposure: -3, stress: -3 },
        fail: { text: '개머리판이 경계조의 이를 부러뜨렸다. 순찰대는 웃으며 식량 자루를 메고 올라갔다.', res: { food: -3 }, injure: 2, exposure: -1 } },
      { text: '시장 쪽 거래를 2일간 끊는다', out: { text: '순찰대는 “좋아, 며칠은 조용하겠군.” 하고 돌아갔다. 시장 방면 길이 막힌다.', exposure: -2, close: { region: 'A', days: 2 } } },
    ],
  };
  const FLOOD_BREAK = {
    title: '수위 경보', text: '배수 능력을 넘어 물이 역 바닥까지 찼다. 비축품이 젖고 있다.',
    choices: [
      { text: '비축 창고를 포기하고 물을 뺀다', out: { text: '창고 문을 열자 불어 터진 통조림과 쥐 사체가 함께 떠내려갔다. 수위는 내려갔다.', res: { food: -6, parts: -2 }, flood: -4 } },
      { text: '모두 매달려 물을 퍼낸다', out: { text: '밤새 양동이를 날랐다. 손바닥이 벗겨져 양동이 손잡이가 피로 미끌거렸다. 수위는 내려갔다.', stress: 8, flood: -4 } },
    ],
  };

  // ── 전투 (v3 쯔꾸르판): 크리처와 싸우면 부위가 다친다. 부러진 부위 → 부상 + 확률로 그 부위의 영구 상처 ──
  const BODY = {
    head: { name: '머리', injure: 2, scarChance: 0.5, scars: ['eye', 'face'] },
    body: { name: '몸통', injure: 2, scarChance: 0.3, scars: ['lung'] },
    arm: { name: '팔', injure: 1, scarChance: 0.5, scars: ['hand', 'finger'] },
    leg: { name: '다리', injure: 1, scarChance: 0.4, scars: ['leg'] },
  };
  // enemy.parts: 부위별 체력. 머리나 몸통이 0이면 쓰러진다. 다리가 부러지면 도망이 반드시 성공, 팔이 부러지면 공격 −1.
  const FIGHTS = {
    g2_rats: { enemy: { name: '쥐떼', spr: [31, 8], tint: '#a89a86', parts: { head: 2, body: 5, arm: 2, leg: 3 }, atk: 1, acc: 0.7 },
      win: { text: '쥐떼가 흩어졌다. 몇 마리는 저녁거리가 됐다.', loot: { food: 3 } },
      lose: { text: '쥐들이 상처를 물고 늘어졌다. 겨우 떨쳐 냈다.', stress: 4 },
      flee: { text: '쥐떼를 피해 한참을 돌아 나왔다.', hours: 1 } },
    c_twomouth: { enemy: { name: '입이 둘인 쥐', spr: [31, 8], tint: '#c98a6a', parts: { head: 3, body: 6, arm: 3, leg: 3 }, atk: 2, acc: 0.65 },
      win: { text: '아래쪽 입까지 짓이겼다. 고기는 고기다.', loot: { food: 3 }, god: { gurmah: 1 } },
      lose: { text: '아래쪽 입이 살점을 씹어 삼키고 웃었다. 쥐들은 배가 불러 물러갔다.', stress: 5, god: { gurmah: 1 } },
      flee: { text: '웃음소리를 뒤로하고 달아났다.', hours: 1, stress: 3 } },
    c_drowned: { enemy: { name: '익사자', spr: [24, 8], tint: '#7fa3b8', parts: { head: 3, body: 8, arm: 4, leg: 5 }, atk: 2, acc: 0.6 },
      win: { text: '불은 머리가 터지자 물고기들이 쏟아져 나왔다. 주머니에서 부품을 챙겼다.', loot: { parts: 2 }, stress: 4, god: { nereh: -1 } },
      lose: { text: '물속으로 끌려 들어갔다가 겨우 빠져나왔다. 발목에 손가락 자국이 검게 남았다.', stress: 6, god: { nereh: 1 } },
      flee: { text: '첨벙거리며 계단을 기어올랐다.', hours: 1 } },
    c_bonepicker: { enemy: { name: '뼈 줍는 이', spr: [24, 6], tint: '#9c9c9c', parts: { head: 4, body: 9, arm: 4, leg: 4 }, atk: 3, acc: 0.55 },
      win: { text: '노인의 자루를 빼앗았다. 뼈 사이에 약과 부품이 섞여 있었다. 노인은 쓰러진 채 웃었다. “다 내게 오게 돼 있어.”', loot: { meds: 2, parts: 3 }, stress: 6, god: { osren: 2 } },
      lose: { text: '노인의 펜치가 손가락 사이를 파고들었다. 노인은 자루를 메고 유유히 사라졌다.', stress: 6, god: { osren: 1 } },
      flee: { text: '노인의 웃음이 등 뒤에서 오래 따라왔다.', hours: 1, stress: 2 } },
  };
  const WARNING = '죽음, 신체 훼손, 굶주림, 식인 같은 무겁고 적나라한 장면이 나옵니다. 18세 이상에게 권합니다.';
  const DATA = { GOAL_DAY, SKILLS, RES, CAP, ITEMS, REGION_NAMES, TRAITS, PEOPLE, START_PEOPLE, ALLIES, TASKS, TASK_ORDER, PROJECTS, PROLOGUE, REGIONS, GENERIC, EVENTS, PROMISES, NIGHT, CALENDAR, PATROL, FLOOD_BREAK, SCARS, SCAR_CHANCE, VIRTUE, AFFLICTIONS, CORPSE, WARNING, GODS, CREATURES, BODY, FIGHTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DS2_DATA = DATA;
})(this);
