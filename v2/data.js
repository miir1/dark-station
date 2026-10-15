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
    salvage: { name: '비상 해체', desc: '빈 상점·객차를 뜯어 부품 1 (총 6회)', slots: 1, stress: 5, skill: 'str' },
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
      text: '눈을 뜬다. 전동차가 터널 한가운데 멈춰 있다. 붉은 비상등이 깜빡이고, 안내방송은 “승객 여러분께서는 침착하게…”에서 끊긴 뒤 나오지 않는다.',
      choices: [
        { text: '비상 레버를 당겨 문을 연다', out: { text: '문이 쉭 소리를 내며 열린다. 문 옆 비상함에 생수 두 병이 들어 있다.', res: { water: 2 } } },
        { text: '먼저 칸 안을 둘러본다', out: { text: '좌석 밑에서 누군가 두고 간 공구 가방을 찾았다. 단단한 케이블 뭉치가 들어 있다.', res: { parts: 1 }, item: 'rope' } },
      ] },
    { title: '남은 승객들',
      text: '칸 끝에 여섯 사람이 웅크려 있다. 청소원 조끼의 할머니, 교복 입은 학생, 작업복의 남자, 시장 상인 차림의 여자와 짐꾼 청년, 간호사 가운을 든 중년 여자. 남자가 말한다. “앞쪽이 을지로입구역이오. 걸어서 십 분.”',
      choices: [
        { text: '“다 같이 갑시다.”', out: { text: '여섯 사람이 고개를 끄덕인다. 누군가 먼저 말해 주길 기다렸던 얼굴이다.', stressAll: -5 } },
        { text: '할머니의 상태부터 살핀다', out: { text: '“괜찮아, 괜찮아.” 할머니가 당신 손을 꼭 잡는다. 김순례라고 했다.', trust: { soonrye: 1 } } },
        { text: '간호사에게 응급 키트를 부탁한다', out: { text: '정마리 간호사가 가운 주머니에서 해열제와 붕대를 꺼내 준다.', res: { meds: 1 }, trust: { mari: 1 } } },
      ] },
    { title: '어두운 터널',
      text: '휴대폰 불빛에 의지해 선로를 걷는다. 앞쪽에서 무언가 무너지는 소리가 울린다.',
      choices: [
        { text: '정비사에게 앞장을 부탁한다', out: { text: '박기철은 침목을 짚으며 무너진 구간을 능숙하게 피해 간다.', trust: { gicheol: 1 } } },
        { text: '선로 옆 대피 공간을 뒤진다', out: { text: '작업자용 비상 상자다. 생수와 건빵이 들어 있다.', res: { food: 3, water: 3 } } },
        { text: '직접 앞장선다', out: { text: '돌에 걸려 무릎이 까졌다. 그래도 사람들이 바짝 따라온다.', stressAll: -3 } },
      ] },
    { title: '을지로입구역',
      text: '승강장에 닿았다. 개찰구 너머 출구 계단 위로 회색 안개가 천천히 흘러내린다. 어디선가 방송이 지직거린다. “…고지대 역으로… 열흘 뒤… 구조열차…” 끝까지 들리지 않는다.',
      choices: [
        { text: '열흘 안에 길을 열기로 한다', out: { text: '열차가 오는 날까지 고지대 역으로 가는 통로를 이어야 한다. 역은 일곱 사람이 지낼 만큼은 된다.' } },
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
    a1_pharmacy: { title: '셔터 내린 약국', prio: 10, text: '유리문 안쪽에서 누군가 손짓한다. 약사 가운을 입은 여자가 갇혀 있다. “문이 안 열려요. 저 혼자 어머니를 돌보고 있어요.”',
      choices: [
        { text: '자물쇠를 따 준다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '문이 열렸다. 약사 문은채가 약을 나눠 준다. “병원 쪽에 아는 사람이 있어요. 3일 뒤 소식 가져갈게요.”', loot: { meds: 1 }, promise: { id: 'eunchae_return', days: 3 }, flag: 'met_eunchae', mem: '약국에서 문은채를 도왔다.' },
          fail: { text: '자물쇠가 굳었다. 손을 다치고 시간만 날렸다.', injure: 1, hours: 1, retry: true } },
        { text: '약품 1개를 건네고 사정을 듣는다', cost: { meds: 1 },
          out: { text: '은채가 안쪽에서 빗장을 풀고 약을 되돌려 준다. “빚은 안 질게요. 병원 쪽에 아는 사람이 있어요. 3일 뒤 소식 가져갈게요.”', loot: { meds: 1 }, promise: { id: 'eunchae_return', days: 3 }, flag: 'met_eunchae', mem: '약을 나눠 문은채의 신뢰를 얻었다.' } },
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
          fail: { text: '인기척에 서둘러 나왔다. 누군가 이 자리를 지켜보고 있었다. 도망치다 넘어졌다.', stress: 4, exposure: 1, injure: 1 } },
        { text: '쇠파이프를 챙긴다', req: { noFlag: 'pipe_taken' }, out: { text: '벽에 기대 둔 쇠파이프를 가방에 꽂았다.', item: 'pipe', flag: 'pipe_taken' } },
        { text: '서둘러 떠난다', out: { text: '' } },
      ] },
    a4_stockroom: { title: '잠긴 창고', prio: 1, text: '철문 안쪽에 쌓인 상자가 틈으로 보인다. 자물쇠가 단단하다.',
      choices: [
        { text: '자물쇠를 연다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '찰칵. 창고 선반에 부품과 약품이 남아 있다.', loot: { parts: 3, meds: 1 } },
          fail: { text: '자물쇠는 꿈쩍도 않는다.', stress: 3 } },
        { text: '쇠파이프로 부순다', req: { item: 'pipe' }, out: { text: '요란한 소리와 함께 철문이 찌그러졌다. 소리가 오래 울렸다.', loot: { parts: 3, meds: 1 }, exposure: 1 } },
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
          fail: { text: '끌어내지 못했다. 물만 잔뜩 먹고 물러났다.', injure: 1, hours: 1, retry: true } },
        { text: '밧줄을 던져 끌어낸다', req: { item: 'rope' },
          out: { text: '밧줄을 배수관에 걸어 안전하게 끌어냈다. 남자는 권도현이라고 했다. “이틀 뒤에 보답하지.”', promise: { id: 'dohyeon_key', days: 2 }, flag: 'met_dohyeon', mem: '밧줄로 권도현을 구했다.' } },
        { text: '물이 차오른다, 지나친다', out: { text: '등 뒤에서 부르는 소리가 물소리에 묻혔다. 며칠 뒤에 그 남자가 스스로 빠져나왔다면 다시 찾아올지도 모른다.', stress: 4, flag: 'skipped_dohyeon', promise: { id: 'dohyeon_second', days: 3 }, mem: '침수된 통로의 외침을 지나쳤다.' } },
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
          fail: { text: '착지하다 발목이 크게 꺾였다.', injure: 2, loot: { parts: 1 } } },
        { text: '돌아서 간다', out: { text: '먼 길로 돌아 상자 하나만 챙겼다.', loot: { parts: 1 }, hours: 2 } },
      ] },
    b4_tank: { title: '고인 물탱크', prio: 1, text: '대형 물탱크에 물이 가득하다. 투명해 보이지만 냄새가 난다.',
      choices: [
        { text: '냄새와 색을 살펴 퍼 간다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '위쪽 맑은 물만 골라 담았다.', loot: { water: 6 } },
          fail: { text: '탁한 물이 섞였다. 마신 사람이 심한 배탈이 났다.', loot: { water: 4 }, injure: 2 } },
        { text: '한 통만 안전하게 떠 간다', out: { text: '맨 위쪽 물만 조금 떴다.', loot: { water: 2 } } },
        { text: '건드리지 않는다', out: { text: '' } },
      ] },
    // 통로를 열기 시작한 뒤의 수문 방면
    b5_route: { title: '공사 중인 통로', prio: 6, when: { flag: 'repair_open' }, text: '도현이 이어 둔 통로 벽에 균열이 보인다. 가는 물줄기가 스며든다.',
      choices: [
        { text: '균열을 메운다', check: { skill: 'tech', base: 0.45 },
          ok: { text: '쐐기를 박고 밀봉재를 발랐다. 물줄기가 멎었다.', flood: -2, stress: -2 },
          fail: { text: '쐐기가 튕겨 손을 다쳤다. 균열은 그대로다.', injure: 1, hours: 1 } },
        { text: '표지만 달아 두고 부품을 챙긴다', out: { text: '위험 구간에 반사 테이프를 감고, 쓰다 남은 부품을 거뒀다.', loot: { parts: 1 } } },
        { text: '그냥 지나간다', out: { text: '' } },
      ] },
    g1_fallen: { title: '쓰러진 사람', prio: 0, text: '배낭을 멘 사람이 벽에 기대 숨을 헐떡인다. 입술이 갈라졌다.',
      choices: [
        { text: '약품 1개를 준다', cost: { meds: 1 }, out: { text: '그는 숨을 고르고 부품 꾸러미를 건넨다. “가져가요. 난 더 못 가.”', loot: { parts: 2 }, stress: -3 } },
        { text: '물 1개를 준다', cost: { water: 1 }, out: { text: '그는 물을 마시고 고개를 끄덕인다. 말없이 식량 한 줌을 쥐여 준다.', loot: { food: 2 } } },
        { text: '지나친다', out: { text: '숨소리가 등 뒤에서 오래 들린다.', stress: 4 } },
      ] },
    g2_rats: { title: '쥐떼', prio: 0, text: '하수구에서 개만 한 쥐 수십 마리가 쏟아져 나온다.',
      choices: [
        { text: '맞서 싸운다', check: { skill: 'str', base: 0.45, item: 'pipe', bonus: 0.2 },
          ok: { text: '쥐떼가 흩어졌다. 몇 마리는 저녁거리가 됐다.', loot: { food: 3 } },
          fail: { text: '물렸다. 상처가 곪기 시작한다.', injure: 2 } },
        { text: '식량 1개를 던지고 물러난다', cost: { food: 1 }, out: { text: '쥐떼가 통조림에 몰려든 사이 빠져나왔다.' } },
        { text: '돌아서 간다', out: { text: '한참을 돌아 나왔다.', hours: 1 } },
      ] },
    g3_crates: { title: '쌓인 보급 상자', prio: 0, text: '무너진 선반 아래 보급 상자가 깔려 있다. 철제 뚜껑이 휘어 있다.',
      choices: [
        { text: '뚜껑을 비틀어 연다', check: { skill: 'str', base: 0.45 },
          ok: { text: '뚜껑이 요란하게 떨어졌다. 통조림과 부품이 쏟아진다.', loot: { food: 2, parts: 1 } },
          fail: { text: '손을 베였다. 상자 가장자리의 부품 하나만 챙겼다.', injure: 1, loot: { parts: 1 } } },
        { text: '쇠파이프로 뚜껑을 쳐서 연다', req: { item: 'pipe' }, out: { text: '두세 번 내리치자 뚜껑이 열렸다. 소리가 멀리 울렸다.', loot: { food: 2, parts: 2 }, exposure: 1 } },
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
        { text: '그냥 지나간다', out: { text: '아이의 시선이 오래 따라온다.', stress: 3 } },
      ] },
  };

  // ── 저녁 약속 사건 (예약 후속) ──
  const PROMISES = {
    eunchae_return: { title: '은채의 소식', text: '약국에서 만난 은채가 역으로 찾아왔다. “병원 팀과 연락이 닿았어요. 우리 역과 협정을 맺을 수 있대요. 대신 보급과 약을 요구해요.”',
      choices: [
        { text: '협정을 맺는다', cost: { food: 3, meds: 1 }, out: { text: '은채가 병원 쪽 사람과 악수한다. “이제 고지대 역에 갈 수 있는 곳이 생겼어요.”', flag: 'hospital_pact', ally: 'eunchae', exposure: 1, mem: '병원과 협정을 맺었다.' } },
        { text: '며칠만 기다려 달라고 한다', delay: 2, req: { noFlag: 'delayed_eunchae' }, out: { text: '은채는 이틀 뒤에 다시 오겠다고 한다. (한 번만 미룰 수 있다)', promise: { id: 'eunchae_return', days: 2 }, flag: 'delayed_eunchae' } },
        { text: '거절한다', hint: '거절하면 병원 협정은 사라진다 — 고지대 역에서 병원 팀의 마중이 없다', out: { text: '은채는 말없이 돌아선다. 다시 오지 않을 것 같다.', flag: 'pact_refused', stress: 3, mem: '병원 협정을 거절했다.' } },
      ] },
    dohyeon_key: { title: '도현의 열쇠', text: '도현이 열쇠를 들고 역에 왔다. “이 열쇠로 지하 통로를 열 수 있어. 하지만 낡아서 같이 고쳐야 해. 부품 3개면 돼.”',
      choices: [
        { text: '공동 수리를 시작한다', cost: { parts: 3 }, out: { text: '도현이 연장을 풀었다. 건설 담당이 이틀치 작업을 하면 통로가 이어진다.', flag: 'repair_open', ally: 'dohyeon', mem: '권도현과 통로 수리를 시작했다.' } },
        { text: '며칠만 기다려 달라고 한다', delay: 2, req: { noFlag: 'delayed_dohyeon' }, out: { text: '도현은 이틀 뒤에 다시 오겠다고 한다. (한 번만 미룰 수 있다)', promise: { id: 'dohyeon_key', days: 2 }, flag: 'delayed_dohyeon' } },
        { text: '필요 없다고 한다', hint: '거절하면 통로를 이을 수 없다 — 열차가 고지대 역까지 닿지 못한다', out: { text: '도현은 열쇠를 도로 집어넣고 터덜터덜 돌아간다.', flag: 'repair_refused', stress: 3, mem: '통로 수리 제안을 거절했다.' } },
      ] },
    // 통로를 지나쳤을 때의 두 번째 기회 (더 비싸고 늦다)
    dohyeon_second: { title: '도현의 두 번째 찾아옴', text: '며칠 전 침수된 통로에서 외치던 남자가 역 계단을 내려왔다. 팔에 붕대를 감았다. “그날 못 본 척했지. 괜찮아, 나라도 그랬을 거야. 그래도 통로는 열어야지. 이번엔 부품이 더 든다. 5개.”',
      choices: [
        { text: '공동 수리를 시작한다', cost: { parts: 5 }, out: { text: '도현이 연장을 풀었다. 건설 담당이 이틀치 작업을 하면 통로가 이어진다.', flag: 'repair_open', ally: 'dohyeon', mem: '늦게나마 권도현과 통로 수리를 시작했다.' } },
        { text: '필요 없다고 한다', hint: '거절하면 통로를 이을 수 없다 — 열차가 고지대 역까지 닿지 못한다', out: { text: '도현은 어깨를 으쓱하고 돌아선다.', flag: 'repair_refused', stress: 3, mem: '통로 수리 제안을 거절했다.' } },
      ] },
  };

  // ── 밤 사건 (매일 1장, 달력 사건은 별도). {who}/{who2}는 주민 이름, weight는 숫자 또는 (상태)=>숫자 ──
  const NIGHT = {
    n_knock: { title: '쪽문을 두드리는 소리', weight: 3, minDay: 2, text: '한밤중, 계단 쪽 철문을 누군가 두드린다. “들여보내 주세요… 제발.”',
      choices: [
        { text: '문을 열어 들인다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '지친 얼굴의 사람이 담요를 받아 들고 하룻밤 자고 간다. 아침에 부품 하나를 두고 사라졌다.', res: { food: -2, parts: 1 }, stress: -2 },
          fail: { text: '문을 연 순간 둘이 밀고 들어와 창고를 털어 달아났다.', res: { food: -3, parts: -1 }, injure: 1, exposure: 1 } },
        { text: '틈으로 먼저 살핀다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '혼자다. 무기도 없다. 들어온 그는 가방에서 통조림을 꺼내 나눈다.', res: { food: 2 } },
          fail: { text: '어두워서 누군지 알 수 없었다. 문을 열지 못했다.', stress: 2 } },
        { text: '열지 않는다', out: { text: '두드리는 소리가 한참 이어지다 멎었다. 아무도 그 이야기를 꺼내지 않는다.', stress: 5 } },
      ] },
    n_fever: { title: '열병', weight: 2, minDay: 2, who: 1, text: '{who:이/가} 밤새 열에 시달린다. 이마가 불덩이 같다.',
      choices: [
        { text: '약품을 쓴다', cost: { meds: 1 }, out: { text: '해열제를 먹이자 새벽쯤 열이 내렸다.', stress: -2 } },
        { text: '물수건으로 밤새 간호한다', cost: { water: 2 }, check: { skill: 'talk', base: 0.5 },
          ok: { text: '밤을 꼬박 새웠다. 아침엔 열이 내렸다.' },
          fail: { text: '열은 내리지 않았다. 하루 앓아누울 것 같다.', injure: 1 } },
        { text: '따로 눕혀 두고 지켜본다', out: { text: '열이 오래 갔다.', injure: 1, stress: 2 } },
      ] },
    n_quarrel: { title: '다툼', weight: 2, minDay: 3, who: 2, text: '배급 문제로 {who:과/와} {who2:이/가} 멱살을 잡았다. 다들 당신을 쳐다본다.',
      choices: [
        { text: '사이에 끼어 말린다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '둘은 씩씩대다 결국 악수했다. 분위기가 풀렸다.', stress: -3 },
          fail: { text: '주먹이 오갔다. 한 사람이 다쳤다.', injure: 1, stress: 3 } },
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
    // 노출이 높을수록 자주 온다. 경계를 세워 두면 막을 수 있다.
    n_thief: { title: '창고를 뒤지는 소리', weight: (s) => Math.max(0, s.exposure - 3), minDay: 2, text: '자정 무렵 누군가 창고를 뒤지는 소리가 들린다. 불빛이 새어 나간 모양이다.',
      choices: [
        { text: '경계를 서던 사람이 막는다', req: { guards: 1 }, out: { text: '경계조가 도둑을 쫓아냈다. 문 밖에 흘린 통조림까지 주웠다.', exposure: -1, stress: -2 } },
        { text: '직접 쫓아간다', check: { skill: 'str', base: 0.45 },
          ok: { text: '계단에서 붙잡아 물건을 되찾았다.', stress: -2 },
          fail: { text: '놓치고 넘어졌다. 그사이 창고가 털렸다.', res: { food: -3, parts: -1 }, injure: 1 } },
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
        fail: { text: '몸싸움 끝에 순찰대가 물러갔지만 식량을 빼앗겼다.', res: { food: -3 }, injure: 1, exposure: -1 } },
      { text: '시장 쪽 거래를 2일간 끊는다', out: { text: '순찰대는 “좋아, 며칠은 조용하겠군.” 하고 돌아갔다. 시장 방면 길이 막힌다.', exposure: -2, close: { region: 'A', days: 2 } } },
    ],
  };
  const FLOOD_BREAK = {
    title: '수위 경보', text: '배수 능력을 넘어 물이 역 바닥까지 찼다. 비축품이 젖고 있다.',
    choices: [
      { text: '비축 창고를 포기하고 물을 뺀다', out: { text: '창고가 물에 잠겼지만 수위가 내려갔다.', res: { food: -6, parts: -2 }, flood: -4 } },
      { text: '모두 매달려 물을 퍼낸다', out: { text: '밤새 양동이를 날랐다. 수위는 내려갔지만 모두 녹초다.', stress: 8, flood: -4 } },
    ],
  };

  const DATA = { GOAL_DAY, SKILLS, RES, CAP, ITEMS, REGION_NAMES, TRAITS, PEOPLE, START_PEOPLE, ALLIES, TASKS, TASK_ORDER, PROJECTS, PROLOGUE, REGIONS, GENERIC, EVENTS, PROMISES, NIGHT, CALENDAR, PATROL, FLOOD_BREAK };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DS2_DATA = DATA;
})(this);
