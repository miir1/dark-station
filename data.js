// 어두운 역 — 게임 데이터 (자원·건물·도구·지역·사건)
(function (root) {
  'use strict';

  const RES = { fuel: '땔감', scrap: '고철', food: '식량', water: '물', meds: '약품', parts: '전자부품' };
  const SKILLS = { obs: '관찰', str: '완력', tech: '기술', talk: '말솜씨' };

  const FIRE_TEXT = ['불이 꺼져 있다', '불씨가 깜빡인다', '불이 타오른다', '불이 활활 탄다', '불길이 거세다'];
  const ROOM_TEXT = ['역사는 얼어붙을 듯 춥다', '역사는 춥다', '역사는 견딜 만하다', '역사는 따뜻하다', '역사는 덥다'];

  // scale: 지을 때마다 비용 ×1.3
  const BUILDINGS = {
    trap: { name: '쥐덫', max: 10, scale: true, cost: { scrap: 5 }, desc: '덫 확인 시 식량', msg: '선로 옆에 쥐덫을 놓았다.' },
    bed: { name: '침상', max: 8, scale: true, cost: { fuel: 15, scrap: 5 }, desc: '생존자 수용 +4', msg: '승강장 구석에 침상을 짰다.' },
    cart: { name: '손수레', max: 1, cost: { fuel: 30, scrap: 10 }, desc: '선로 뒤지기 땔감 +50%', msg: '바퀴 달린 수레를 만들었다. 더 많이 실을 수 있다.' },
    farm: { name: '버섯 재배실', max: 1, req: { bed: 1 }, cost: { fuel: 25, scrap: 15 }, desc: '재배꾼 배치 가능', msg: '역무실을 버섯 재배실로 바꿨다.' },
    purifier: { name: '정수기', max: 1, req: { bed: 1 }, cost: { fuel: 10, scrap: 25 }, desc: '정수 담당 배치 가능', msg: '배수관을 이어 정수기를 만들었다.' },
    workbench: { name: '작업대', max: 1, req: { bed: 1 }, cost: { fuel: 30, scrap: 30 }, desc: '도구 제작, 고철공 배치 가능', msg: '매표소 창구를 작업대로 개조했다.' },
    barricade: { name: '출구 바리케이드', max: 1, req: { workbench: 1 }, cost: { fuel: 40, scrap: 40 }, desc: '지상 원정 개방', msg: '출구 계단을 바리케이드로 막고 쪽문을 냈다. 이제 지상으로 나갈 수 있다.' },
    radio: { name: '무전 설비', max: 1, req: { workbench: 1 }, reqFlag: 'seenParts', cost: { scrap: 40, parts: 4 }, desc: '먼 곳의 신호 수신', msg: '안테나를 환풍구 위로 뽑아 올렸다.' },
  };

  const ITEMS = {
    flashlight: { name: '손전등', cost: { scrap: 15 }, desc: '어두운 곳 선택지 개방' },
    pipe: { name: '쇠파이프', cost: { scrap: 10 }, desc: '완력 판정 +20%' },
    rope: { name: '케이블 밧줄', cost: { scrap: 12 }, desc: '높은 곳·끊긴 길 선택지 개방' },
    mask: { name: '방독면', cost: { scrap: 20, parts: 1 }, desc: '안개 구역 피해 없음' },
    backpack: { name: '큰 배낭', cost: { fuel: 20, scrap: 15 }, desc: '휴대량 20 → 35' },
  };

  // 10초마다 생산. 음수는 재료(부족하면 그 일꾼은 쉼)
  const JOBS = {
    ratcatcher: { name: '쥐잡이', req: { trap: 1 }, prod: { food: 2 } },
    farmer: { name: '재배꾼', req: { farm: 1 }, prod: { food: 3 } },
    waterman: { name: '정수 담당', req: { purifier: 1 }, prod: { water: 2, fuel: -1 } },
    smith: { name: '고철공', req: { workbench: 1 }, prod: { scrap: 2, fuel: -1 } },
  };

  // steps: 사건 id 또는 'R'(무작위 사건)
  const DISTRICTS = {
    euljiro: {
      name: '을지로 지하상가', fog: false, steps: ['eu_1', 'R', 'eu_2', 'eu_3'],
      intro: '셔터가 내려진 지하상가 통로를 따라 걷는다. 발소리가 멀리까지 울린다.',
      clear: { text: '지하상가 끝 계단 위로 종로 거리가 보인다. (종로 개방, 기술 +1)', skill: { tech: 1 }, unlock: 'jongno' },
    },
    jongno: {
      name: '종로', fog: false, steps: ['jo_1', 'R', 'jo_2', 'R', 'jo_3'],
      intro: '잿빛 하늘 아래 종로 대로가 텅 비어 있다. 버스 한 대가 옆으로 누워 있다.',
      clear: { text: '남쪽 명동 방향으로 회색 안개가 띠처럼 깔려 있다. 방독면 없이는 오래 버티기 어렵겠다. (명동 개방, 말솜씨 +1)', skill: { talk: 1 }, unlock: 'myeongdong' },
    },
    myeongdong: {
      name: '명동', fog: true, steps: ['md_1', 'R', 'md_2', 'R', 'md_3'],
      intro: '안개가 무릎 높이에서 소용돌이친다. 간판들이 안개 위로 묘비처럼 솟아 있다.',
      clear: { text: '용산 전자상가에는 아직 쓸 만한 부품이 산더미라고 한다. 다만 그곳엔 철모단이 있다. (용산 개방, 관찰 +1)', skill: { obs: 1 }, unlock: 'yongsan' },
    },
    yongsan: {
      name: '용산', fog: true, steps: ['ys_1', 'R', 'ys_2', 'R', 'R', 'ys_3'],
      intro: '끊긴 철로가 남쪽으로 뻗어 있다. 철로 위에 사람 발자국이 많다.',
      clear: { text: '부품만 충분하다면 역에서 무전 설비를 만들 수 있을 것이다. (완력 +1)', skill: { str: 1 } },
    },
    namsan: {
      name: '남산 송신소', fog: true, steps: ['ns_1', 'R', 'ns_2', 'ns_3'],
      intro: '무전에서 들은 목소리를 따라 남산을 오른다. 송신탑 꼭대기에 붉은 등이 깜빡인다.',
      clear: { text: '' },
    },
  };

  // 선택지 필드
  //  req: { item, flag, skill:{obs:2} }      — 조건 미충족이면 잠김으로 표시
  //  cost: { food:1 }                        — 배낭에서 차감 (보유량이 조건)
  //  check: { skill, base, item, bonus }     — 성공률 = base + 기술×15% (+도구)
  //  ok / fail / out: 결과 { text, hp, mind, loot, pack, skill, flag, item, recruit, loseLoot, ending }
  const EVENTS = {
    // ── 을지로 지하상가 ──
    eu_1: {
      title: '셔터 내린 상가',
      text: '통로 셔터가 반쯤 내려와 있다. 셔터 너머에서 무언가 긁는 소리가 난다.',
      choices: [
        { text: '셔터 밑으로 기어 들어간다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '긁는 소리는 환풍구 철판이었다. 바닥에 공구 상자가 굴러다닌다.', loot: { scrap: 6 } },
          fail: { text: '셔터 모서리에 팔이 베였다. 그래도 고철 몇 개는 건졌다.', hp: -2, loot: { scrap: 3 } } },
        { text: '쇠파이프로 셔터를 들어 올린다', req: { item: 'pipe' },
          out: { text: '셔터가 비명을 지르며 올라간다. 안쪽 가게 두 곳을 차분히 뒤졌다.', loot: { scrap: 8, fuel: 3 } } },
        { text: '돌아서 다른 통로로 간다',
          out: { text: '먼 길을 돌았다. 목이 탄다.', pack: { water: -1 } } },
      ],
    },
    eu_2: {
      title: '닫힌 약국',
      text: '유리문에 "진통제 품절" 손글씨가 붙어 있다. 진열대는 대부분 비었고, 조제실 문은 잠겨 있다.',
      choices: [
        { text: '조제실 자물쇠를 딴다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '찰칵. 조제실 선반에 약상자 두 개가 남아 있다.', loot: { meds: 2 } },
          fail: { text: '자물쇠는 꿈쩍도 않는다. 시간만 버렸다는 생각이 떠나지 않는다.', mind: -1 } },
        { text: '진열대 아래를 샅샅이 뒤진다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '진열대 밑에 굴러 들어간 약통과 통조림을 찾았다.', loot: { meds: 1, food: 1 } },
          fail: { text: '먼지뿐이다.' } },
        { text: '손전등으로 조제실 환기창을 비춘다', req: { item: 'flashlight' },
          out: { text: '환기창 너머 선반에 상자가 보인다. 팔을 뻗어 꺼냈다.', loot: { meds: 2, water: 1 } } },
      ],
    },
    eu_3: {
      title: '마네킹 사이의 노인',
      text: '옷가게 마네킹 사이에 노인이 앉아 라디오를 고치고 있다. "위에서 내려온 거요, 아래서 올라온 거요?"',
      choices: [
        { text: '을지로입구역에서 왔다고 말한다',
          out: { text: '노인이 고개를 끄덕인다. "그 역엔 아직 불이 붙어 있군. 이거 가져가요." 녹슨 회로판을 건넨다.', loot: { parts: 2 }, flag: 'metOldman' } },
        { text: '라디오 수리를 돕는다', check: { skill: 'tech', base: 0.5 },
          ok: { text: '잡음 사이로 음악이 잠깐 흘렀다. 노인이 웃는다. "남산 쪽에서 가끔 이런 게 잡혀요." 그는 부품 꾸러미를 통째로 내준다.', loot: { parts: 3 }, mind: 2, flag: 'metOldman' },
          fail: { text: '회로 타는 냄새가 났다. 노인은 한숨을 쉬지만 부품 하나는 챙겨 준다.', loot: { parts: 1 } } },
        { text: '조용히 지나친다',
          out: { text: '등 뒤로 라디오 잡음이 오래 따라왔다.', mind: -1 } },
      ],
    },

    // ── 종로 ──
    jo_1: {
      title: '광장시장 노점',
      text: '무너진 시장 지붕 아래 몇 사람이 불을 피우고 물건을 늘어놓았다. 우두머리 같은 여자가 당신을 훑어본다.',
      choices: [
        { text: '식량 2개를 고철과 바꾼다', cost: { food: 2 },
          out: { text: '여자는 통조림을 흔들어 보고 고철 꾸러미를 내민다.', loot: { scrap: 10 } } },
        { text: '흥정한다', check: { skill: 'talk', base: 0.4 },
          ok: { text: '"말은 잘하네." 여자는 부품 하나를 덤으로 얹어 준다.', loot: { parts: 1, scrap: 5 } },
          fail: { text: '여자는 웃으며 등을 돌린다. 시장 사람들의 시선이 차갑다.', mind: -1 } },
        { text: '역 위치를 알려 주고 함께 살자고 한다', req: { skill: { talk: 2 } },
          out: { text: '여자는 오래 생각하다 어린 상인 둘을 보낸다. "저 애들을 부탁해요."', recruit: 2 } },
      ],
    },
    jo_2: {
      title: '보신각의 감시자',
      text: '보신각 기와 위에 누군가 망을 보고 있다. 화살이 발 앞에 꽂힌다. "물건 내려놓고 가!"',
      choices: [
        { text: '정면으로 돌진한다', check: { skill: 'str', base: 0.35, item: 'pipe', bonus: 0.2 },
          ok: { text: '감시자가 비명을 지르며 달아났다. 그가 지키던 상자를 열었다.', loot: { fuel: 6, scrap: 6, food: 2 } },
          fail: { text: '화살 하나가 어깨를 스쳤다. 물러설 수밖에 없었다.', hp: -3 } },
        { text: '식량 1개를 두고 지나간다', cost: { food: 1 },
          out: { text: '화살은 더 날아오지 않았다.' } },
        { text: '그림자를 따라 우회한다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '골목을 돌아 그들의 보급 상자를 찾았다.', loot: { food: 3, water: 2 } },
          fail: { text: '골목에서 길을 잃었다.', pack: { water: -1 }, mind: -1 } },
      ],
    },
    jo_3: {
      title: '물에 잠긴 서점',
      text: '대형 서점 지하가 물에 잠겨 있다. 수면 위로 책장 몇 개가 섬처럼 솟아 있다.',
      choices: [
        { text: '밧줄을 책장 사이에 걸고 건넌다', req: { item: 'rope' },
          out: { text: '맨 끝 사무실에서 지도 묶음과 비상 배터리를 찾았다. 지도를 읽으며 서울의 길이 머릿속에 그려진다. (관찰 +1)', loot: { parts: 2 }, skill: { obs: 1 } } },
        { text: '헤엄쳐 건넌다', check: { skill: 'str', base: 0.4 },
          ok: { text: '차가운 물을 가르고 사무실에 닿았다. 배터리 하나를 건졌다.', loot: { parts: 1 } },
          fail: { text: '물이 생각보다 깊고 차갑다. 간신히 되돌아왔다.', hp: -2, mind: -1 } },
        { text: '젖지 않은 책 몇 권을 땔감으로 챙긴다',
          out: { text: '누군가의 책을 태울 생각에 마음이 무겁다.', loot: { fuel: 5 }, mind: -1 } },
      ],
    },

    // ── 명동 ──
    md_1: {
      title: '안개 속 노랫소리',
      text: '안개 너머에서 아이 목소리로 부르는 동요가 들린다. 같은 소절만 반복된다.',
      choices: [
        { text: '소리 나는 쪽으로 간다',
          out: { text: '녹음기였다. 숨어 있던 자들이 덮쳤다. 짐 일부를 빼앗기고 겨우 빠져나왔다.', hp: -3, mind: -1, loseLoot: 0.5 } },
        { text: '소리를 피해 다른 길로 간다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '녹음기 옆 덤불 뒤에 약탈자들의 빈 은신처가 있었다.', loot: { scrap: 8, food: 2 } },
          fail: { text: '안개 속을 한참 돌았다.', pack: { water: -1 } } },
        { text: '쇠파이프를 쥐고 매복을 역습한다', req: { item: 'pipe' }, check: { skill: 'str', base: 0.45, item: 'pipe', bonus: 0.2 },
          ok: { text: '두 명이 달아났다. 그들이 버린 짐을 챙겼다.', loot: { meds: 2, scrap: 6 } },
          fail: { text: '셋이었다. 맞으며 물러났다.', hp: -3 } },
      ],
    },
    md_2: {
      title: '명동성당',
      text: '성당 문 앞에 흰 천을 두른 사람들이 서 있다. "여기서는 무기를 내려놓아야 합니다."',
      choices: [
        { text: '무기를 내려놓고 들어간다',
          out: { text: '그들은 물과 따뜻한 수프를 나눠 준다. 늙은 수녀가 당신 역의 이야기를 듣고 고개를 끄덕인다.', loot: { water: 3 }, hp: 3, mind: 2, flag: 'cathedralFriend' } },
        { text: '약품 1개를 기부한다', cost: { meds: 1 },
          out: { text: '수녀가 지하 창고를 열어 준다. "필요한 만큼만 가져가세요."', loot: { food: 4, parts: 1 }, mind: 1, flag: 'cathedralFriend' } },
        { text: '역과 서로 돕자고 설득한다', check: { skill: 'talk', base: 0.35 },
          ok: { text: '젊은 신자 둘이 당신의 역으로 가겠다고 나선다.', recruit: 2, flag: 'cathedralFriend' },
          fail: { text: '"우리는 이곳을 떠나지 않습니다." 문이 조용히 닫힌다.', mind: -1 } },
      ],
    },
    md_3: {
      title: '은행 금고',
      text: '무너진 은행 지하 금고 문이 반쯤 열려 있다. 돈다발은 휴지가 됐지만, 금고 안에 비상 발전기가 있다.',
      choices: [
        { text: '발전기를 분해한다', check: { skill: 'tech', base: 0.45 },
          ok: { text: '쓸 만한 부품을 깔끔하게 떼어 냈다.', loot: { parts: 3 } },
          fail: { text: '감전됐다. 손이 떨리지만 부품 하나는 건졌다.', hp: -1, loot: { parts: 1 } } },
        { text: '손전등으로 금고 안쪽을 살핀다', req: { item: 'flashlight' },
          out: { text: '금고 깊은 칸에 비상 키트가 있다.', loot: { parts: 2, meds: 1 } } },
        { text: '돈다발을 땔감으로 챙긴다',
          out: { text: '한때 사람들이 목숨 걸던 종이다. 잘 탈 것이다.', loot: { fuel: 8 } } },
      ],
    },

    // ── 용산 ──
    ys_1: {
      title: '철로 위 행렬',
      text: '용산으로 가는 철로 위로 짐을 진 사람들이 줄지어 걷는다. 철모를 쓴 자들이 그들을 감시한다.',
      choices: [
        { text: '행렬에 섞여 들어간다', check: { skill: 'obs', base: 0.45 },
          ok: { text: '아무도 당신을 의심하지 않았다. 전자상가 입구까지 무사히 왔다.', mind: 1 },
          fail: { text: '철모 쓴 자가 당신을 붙잡는다. 통행세로 물 2개를 빼앗겼다.', pack: { water: -2 } } },
        { text: '통행세로 식량 2개를 낸다', cost: { food: 2 },
          out: { text: '그들은 장부에 표시를 하고 길을 내준다.' } },
        { text: '밧줄로 선로 아래 배수로로 내려간다', req: { item: 'rope' },
          out: { text: '배수로를 따라 걸었다. 버려진 공구함도 주웠다.', loot: { scrap: 8 } } },
      ],
    },
    ys_2: {
      title: '기울어진 전자상가',
      text: '전자상가 건물이 기울어 있다. 위층 수리점 간판들이 아직 매달려 있다.',
      choices: [
        { text: '계단으로 꼭대기까지 오른다', check: { skill: 'str', base: 0.4 },
          ok: { text: '꼭대기 수리점은 손대지 않은 그대로였다.', loot: { parts: 4 } },
          fail: { text: '계단이 무너져 굴렀다. 손에 쥔 건 부품 하나뿐.', hp: -2, loot: { parts: 1 } } },
        { text: '손전등을 켜고 지하 창고를 뒤진다', req: { item: 'flashlight' },
          out: { text: '창고 선반에 포장도 뜯지 않은 부품 상자가 있다.', loot: { parts: 3, scrap: 5 } } },
        { text: '1층 매장만 빠르게 훑는다',
          out: { text: '남들이 이미 훑고 간 자리다. 그래도 조금은 남았다.', loot: { parts: 1, scrap: 4 } } },
      ],
    },
    ys_3: {
      title: '철모단 대장',
      text: '철모단 대장이 길을 막는다. 군복 위에 장난감 배지를 잔뜩 달았다. "남의 동네 부품을 퍼 가면서 인사도 안 해?"',
      choices: [
        { text: '싸운다', check: { skill: 'str', base: 0.35, item: 'pipe', bonus: 0.2 },
          ok: { text: '대장이 쓰러지고 철모단은 흩어졌다. 그의 창고에 무전기 진공관이 있었다.', loot: { parts: 3 }, flag: 'beatGang' },
          fail: { text: '부하들이 몰려들었다. 짐을 빼앗기고 쫓겨났다.', hp: -4, loseLoot: 0.5 } },
        { text: '약품 2개로 거래한다', cost: { meds: 2 },
          out: { text: '대장이 약품을 받고 웃는다. "남산에 가면 내 동생 좀 찾아 줘."', loot: { parts: 2 }, flag: 'gangDeal' } },
        { text: '명동성당 수녀의 이름을 댄다', req: { flag: 'cathedralFriend' },
          out: { text: '대장의 얼굴이 굳는다. "수녀님이 보냈다고? …가져가."', loot: { parts: 3 }, mind: 1 } },
        { text: '설득한다', check: { skill: 'talk', base: 0.4 },
          ok: { text: '"…역에 불이 있다고?" 부하 하나가 당신을 따라가겠다고 한다.', loot: { parts: 2 }, recruit: 1 },
          fail: { text: '대장은 말 대신 주먹을 날렸다.', hp: -2 } },
      ],
    },

    // ── 남산 ──
    ns_1: {
      title: '케이블카 승강장',
      text: '끊긴 케이블이 바람에 흔들린다. 정상까지 가는 길은 무너진 도로 하나뿐이다.',
      choices: [
        { text: '끊긴 케이블을 타고 오른다', req: { item: 'rope' },
          out: { text: '손바닥이 찢어질 듯했지만 금세 중턱에 닿았다.', mind: 1 } },
        { text: '무너진 도로를 기어오른다', check: { skill: 'str', base: 0.5 },
          ok: { text: '숨이 턱까지 찼지만 올라섰다.' },
          fail: { text: '돌무더기가 무너져 미끄러졌다.', hp: -3 } },
        { text: '바위 뒤에서 쉬었다 간다', cost: { food: 1, water: 1 },
          out: { text: '잠깐 눈을 붙였다. 몸이 조금 가볍다.', hp: 2 } },
      ],
    },
    ns_2: {
      title: '송신소 철문',
      text: '송신탑 아래 철문 앞에 군인 한 명이 앉아 있다. 총은 녹슬었고, 그는 아주 늙었다.',
      choices: [
        { text: '무전에서 들은 호출 부호를 말한다',
          out: { text: '노병이 오랫동안 당신을 본다. "정말로… 누가 들었군." 철문이 열린다.' } },
        { text: '철모단 대장의 동생을 아느냐고 묻는다', req: { flag: 'gangDeal' },
          out: { text: '노병이 웃는다. "그 녀석 형은 아직 살아 있나?" 그는 탄약 상자를 내민다. 안에는 고철과 약품이 들어 있다.', loot: { scrap: 10, meds: 1 }, mind: 2 } },
      ],
    },
    ns_3: {
      title: '송신실',
      text: '송신실 테이프 기계가 같은 방송을 몇 년째 반복하고 있었다. 송신기는 아직 살아 있다. 이 탑에서라면 서울의 모든 역에 목소리를 보낼 수 있다.',
      choices: [
        { text: '당신의 역 위치와 불빛을 방송한다',
          out: { text: '당신의 목소리가 안개 위로 퍼져 나간다.', ending: 'light' } },
        { text: '송신기를 해체해 역으로 가져간다', check: { skill: 'tech', base: 0.4 },
          ok: { text: '부품을 하나하나 떼어 냈다.', ending: 'keep' },
          fail: { text: '송신기가 불꽃을 튀기며 멈췄다. 반복 방송도 끊겼다.', ending: 'silence' } },
        { text: '반복 방송을 그대로 둔다',
          out: { text: '테이프가 계속 돈다.', ending: 'echo' } },
      ],
    },

    // ── 무작위 사건 ──
    r_rats: {
      title: '쥐떼', random: true,
      text: '하수구에서 개만 한 쥐 수십 마리가 쏟아져 나온다.',
      choices: [
        { text: '맞서 싸운다', check: { skill: 'str', base: 0.45, item: 'pipe', bonus: 0.2 },
          ok: { text: '쥐떼가 흩어졌다. 몇 마리는 저녁거리가 됐다.', loot: { food: 3 } },
          fail: { text: '물렸다. 상처가 화끈거린다.', hp: -2 } },
        { text: '식량 1개를 던지고 달아난다', cost: { food: 1 },
          out: { text: '쥐떼가 통조림에 몰려든 사이 빠져나왔다.' } },
        { text: '정신없이 도망친다',
          out: { text: '한참을 달렸다. 심장이 아직 쿵쾅거린다.', mind: -1 } },
      ],
    },
    r_car: {
      title: '버려진 승용차', random: true,
      text: '문이 열린 승용차가 도로 한가운데 서 있다.',
      choices: [
        { text: '차 안을 뒤진다', check: { skill: 'obs', base: 0.55 },
          ok: { text: '트렁크 깊숙이 비상 가방이 있었다.', loot: { water: 2, scrap: 3 } },
          fail: { text: '시트 밑에서 손을 베였다.', hp: -1, loot: { scrap: 2 } } },
        { text: '연료 탱크에서 기름을 뺀다', req: { skill: { tech: 2 } },
          out: { text: '남은 기름을 페트병에 담았다. 불쏘시개로 그만이다.', loot: { fuel: 8 } } },
        { text: '지나친다', out: { text: '' } },
      ],
    },
    r_body: {
      title: '벽에 기댄 시신', random: true,
      text: '배낭을 멘 채 벽에 기대 숨진 사람이 있다. 손에 사진 한 장을 쥐고 있다.',
      choices: [
        { text: '배낭을 챙긴다',
          out: { text: '약품과 고철이 들어 있다. 사진 속 가족들이 당신을 보는 것 같다.', loot: { meds: 1, scrap: 3 }, mind: -1 } },
        { text: '돌무더기로 덮어 준다', cost: { water: 1 },
          out: { text: '목이 마르지만 마음은 조금 가볍다.', mind: 2 } },
      ],
    },
    r_trader: {
      title: '떠돌이 상인', random: true,
      text: '커다란 짐을 진 상인이 손을 흔든다. "물이랑 약 바꿔 갈래?"',
      choices: [
        { text: '물 2개를 약품 1개와 바꾼다', cost: { water: 2 },
          out: { text: '상인이 약통을 건넨다.', loot: { meds: 1 } } },
        { text: '흥정한다', check: { skill: 'talk', base: 0.45 },
          ok: { text: '"졌다, 졌어." 상인은 부품 하나를 그냥 준다.', loot: { parts: 1 } },
          fail: { text: '상인은 혀를 차고 떠났다.' } },
        { text: '그냥 보낸다', out: { text: '' } },
      ],
    },
    r_dogs: {
      title: '들개', random: true,
      text: '야윈 들개 세 마리가 낮게 으르렁거리며 다가온다.',
      choices: [
        { text: '파이프를 휘둘러 쫓는다', check: { skill: 'str', base: 0.4, item: 'pipe', bonus: 0.2 },
          ok: { text: '개들이 꼬리를 말고 달아났다.' },
          fail: { text: '다리를 물렸다.', hp: -2 } },
        { text: '식량 1개를 던져 준다', cost: { food: 1 },
          out: { text: '개들이 먹이를 물고 사라졌다.' } },
        { text: '천천히 뒷걸음질 친다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '눈을 피하지 않고 물러났다. 개들은 따라오지 않았다.' },
          fail: { text: '돌에 걸려 넘어졌다. 개들이 달려들었다.', hp: -2, mind: -1 } },
      ],
    },
    r_cry: {
      title: '울음소리', random: true,
      text: '무너진 건물 안에서 누군가 도와 달라고 운다.',
      choices: [
        { text: '건물 안으로 들어간다', check: { skill: 'obs', base: 0.4 },
          ok: { text: '다리가 깔린 청년이었다. 구해 주자 당신의 역으로 가겠다고 한다.', recruit: 1, mind: 1 },
          fail: { text: '천장이 무너졌다. 울음은 이미 그쳐 있었다.', hp: -3, mind: -1 } },
        { text: '못 들은 척 지나간다',
          out: { text: '울음소리가 귓가에서 떠나지 않는다.', mind: -2 } },
      ],
    },
    r_store: {
      title: '편의점', random: true,
      text: '간판이 떨어진 편의점이다. 1층은 털렸지만 2층 창고 창문이 깨지지 않았다.',
      choices: [
        { text: '밧줄을 걸고 2층으로 오른다', req: { item: 'rope' },
          out: { text: '창고에 생수와 통조림 상자가 그대로 있다.', loot: { food: 3, water: 3 } } },
        { text: '1층을 다시 뒤진다', check: { skill: 'obs', base: 0.5 },
          ok: { text: '계산대 아래 숨겨진 상자를 찾았다.', loot: { food: 2 } },
          fail: { text: '빈 봉지뿐이다.' } },
      ],
    },
    r_rain: {
      title: '검은 비', random: true,
      text: '하늘이 어두워지더니 검은 비가 내리기 시작한다.',
      choices: [
        { text: '처마 밑에서 그칠 때까지 기다린다', cost: { food: 1 },
          out: { text: '비가 그쳤다. 배가 고프다.' } },
        { text: '비를 맞으며 걷는다',
          out: { text: '피부가 따끔거린다.', hp: -1 } },
      ],
    },
    r_lost: {
      title: '길 잃은 생존자', random: true,
      text: '빈 페트병을 든 여자가 넋 나간 얼굴로 서 있다. "여기가… 어디죠?"',
      choices: [
        { text: '물 1개를 나눠 주고 역으로 오라고 한다', cost: { water: 1 },
          out: { text: '여자는 물을 마시고 고개를 끄덕인다. 역에서 다시 보자고 했다.', recruit: 1, mind: 1 } },
        { text: '역으로 가는 길만 알려 준다', check: { skill: 'talk', base: 0.5 },
          ok: { text: '여자는 당신의 설명을 몇 번이고 되뇌며 떠났다.', recruit: 1 },
          fail: { text: '여자는 반대쪽으로 걸어갔다.' } },
        { text: '외면한다', out: { text: '', mind: -1 } },
      ],
    },
  };

  const ENDINGS = {
    light: { title: '불빛의 역', text: '사흘 뒤, 을지로입구역 계단으로 첫 손님이 내려왔다. 그다음엔 열 명, 그다음엔 백 명. 어두운 역은 더 이상 어둡지 않았다.' },
    keep: { title: '지켜 낸 역', text: '부품은 역을 십 년은 더 버티게 할 것이다. 하지만 반복 방송이 끊긴 뒤, 남산의 불빛을 찾아오는 사람은 없었다.' },
    silence: { title: '꺼진 탑', text: '탑은 침묵했다. 당신은 빈손으로 산을 내려왔다. 역의 난로는 여전히 타오르고 있었다. 그것만은 남았다.' },
    echo: { title: '메아리', text: '누군가는 이 방송을 듣고 희망을 품을 것이다. 거짓이라 해도. 당신은 조용히 산을 내려와 난로 앞에 앉았다.' },
  };

  const RADIO_MSG = '무전기에서 잡음이 걷히고 목소리가 들린다. "…여기는 남산 송신소… 살아 있는 사람은… 응답하라…" (남산 송신소 개방)';

  const DATA = { RES, SKILLS, FIRE_TEXT, ROOM_TEXT, BUILDINGS, ITEMS, JOBS, DISTRICTS, EVENTS, ENDINGS, RADIO_MSG };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DS_DATA = DATA;
})(this);
