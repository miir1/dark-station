// 최종판 데이터 정리 (data 담당, 2026-10-25) — node docs/foundation/final_2026-10-25/data_apply.js
// 입력 = 이 폴더의 data_before/*.json (작업 시작 때 v4/data 사본) → 출력 = v4/data/*.json (줄바꿈 꼴은 원래 파일 그대로).
// 몇 번을 돌려도 같은 결과(늘 data_before 에서 만든다). 바꾸는 것:
//   1. 그림 연결: d10_walk_other · d10_walk_alone 의 image (+ image 가 비었고 v4/img/cg/<사건 id>.png 가 있는 사건은 그 이름을 적어 둔다 — 화면 동작은 같다)
//   2. P1-11 원정 수납: 지도 4장의 m칸 12개 → 수납 가구 물건 12개(objects·maps·lines), '찾는' 원정 사건 → inspect:<수납> 조사 사건
//   3. 검증 잔여: ① 갚는 길 꼬리 글을 사건마다(swap warn) ② D6·카르마<8 은 갚는 길에 줄타기 없음 ③ D3·카르마<8 은 줄타기 없음
//      ④ 카르마 판의 이기적 위험 0 출구 4개(D6 셔터 '아무것도 하지 않는다' 둘·D10 '걷는다' 둘)에 줄타기 ⑤ 찾은 물건 아이콘 4장(퓨즈·성냥·무전기·밧줄)의 결과 글·깃발
//   4. (2차, 최종 점검 지적) 위기 창 되풀이 글(사다리 사본 + 하루 한 번 자물쇠) · 정체 끝 문장 한 줄 · 관리실 사물함 · 통로 글 · 소문 거짓 행 · 손등 깨물기 결과 글 · 약국 지나침 · 사본 그림 칸
//      시험용 DATA_SKIP: fix2(4 전부) · ladder(사다리만) · knob2(모험 손잡이만) · locker(사물함만) · pharm(약국만)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(__dirname, 'data_before');
const OUT = process.env.DATA_OUT ? path.resolve(process.env.DATA_OUT) : path.join(ROOT, 'v4', 'data');   // 시험용: DATA_OUT=다른 폴더
const SKIP = new Set((process.env.DATA_SKIP || '').split(',').filter(Boolean));          // 시험용: DATA_SKIP=trips,dayoff,newrope (그 부분만 빼고 만든다 — 기여도 재기)
const log = [];
const note = (s) => log.push(s);

function read(name) {
  const t = fs.readFileSync(path.join(SRC, name + '.json'), 'utf8');
  return { eol: t.includes('\r\n') ? '\r\n' : '\n', data: JSON.parse(t.replace(/\r\n/g, '\n')) };
}
function write(name, f) {
  let t = JSON.stringify(f.data, null, 2) + '\n';
  if (f.eol === '\r\n') t = t.replace(/\n/g, '\r\n');
  fs.writeFileSync(path.join(OUT, name + '.json'), t, 'utf8');
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const F = { events: read('events'), objects: read('objects'), maps: read('maps'), lines: read('lines'), numbers: read('numbers'), identity: read('identity') };
const EV = F.events.data, OBJ = F.objects.data, MAPS = F.maps.data, LINES = F.lines.data, NUM = F.numbers.data, IDN = F.identity.data;
const ev = (id) => { const e = EV.find((x) => x.id === id); if (!e) throw new Error('사건 없음 ' + id); return e; };
const ch = (id, label) => { const c = ev(id).choices.find((x) => x.label === label); if (!c) throw new Error(`선택지 없음 ${id} / ${label}`); return c; };
const obj = (id) => { const o = OBJ.find((x) => x.id === id); if (!o) throw new Error('물건 없음 ' + id); return o; };
const num = (id) => { const r = NUM.find((x) => x.id === id); if (!r) throw new Error('수치 없음 ' + id); return r.start; };
const trace = (id, state) => ({ verb: 'trace', id, state });
const effects = (o) => (o.effects = o.effects || []);
const line = (id, text) => { if (LINES.some((l) => l.id === id)) throw new Error('줄 중복 ' + id); LINES.push({ id, speaker: 'narrator', context: '', grade: 'normal', text, rumor: 0, truth: 1 }); };
const LEDGER_DEAD = { who: 'you', status: 'dead', day: '{day}', cause: '' };

// ───────────────────────── 1. 그림 연결 ─────────────────────────
ev('d10_walk_other').image = 'd10_walk_other';
ev('d10_walk_alone').image = 'd10_walk_alone';
note('그림: d10_walk_other → d10_walk_other · d10_walk_alone → d10_walk_alone');
const CG = path.join(ROOT, 'v4', 'img', 'cg');
for (const e of EV) if (!e.image && fs.existsSync(path.join(CG, e.id + '.png'))) { e.image = e.id; note(`그림(같은 동작, 이름만 적음): ${e.id} → ${e.id}`); }

// ───────────────────────── 2. P1-11 원정 수납 ─────────────────────────
if (!SKIP.has('trips')) {
// 지도 m칸 → 바닥(또는 물) + 수납 물건. 벽을 등지게 한 칸 옮긴 것은 (원래 m칸 → 놓은 칸) 으로 적는다.
const PLACE = {
  mall_a1: [{ m: [9, 2], id: 'drawer_a1', at: [9, 1] }, { m: [16, 3], id: 'shelf_a1', at: [15, 1] }, { m: [3, 7], id: 'locker_a1', at: [1, 6] }],
  mall_a2: [{ m: [12, 2], id: 'shelf_a2', at: [12, 1] }, { m: [4, 4], id: 'locker_a2', at: [4, 4] }, { m: [12, 6], id: 'barrel_a2', at: [12, 6] }],
  drain_b1: [{ m: [10, 2], id: 'crate_b1', at: [11, 1] }, { m: [17, 2], id: 'barrel_b1', at: [15, 1] }, { m: [2, 7], id: 'bag_b1', at: [2, 7], tile: 'w' }],
  drain_b2: [{ m: [9, 2], id: 'toolbox_b2', at: [9, 1] }, { m: [16, 2], id: 'locker_b2', at: [16, 1] }, { m: [4, 5], id: 'barrel_b2', at: [4, 5] }],
};
for (const [mapId, list] of Object.entries(PLACE)) {
  const m = MAPS.find((x) => x.id === mapId);
  const rows = m.rows.map((r) => r.split(''));
  for (const p of list) {
    const [mx, my] = p.m;
    if (rows[my][mx] !== 'm') throw new Error(`${mapId} (${mx},${my}) 가 m 이 아니다`);
    rows[my][mx] = p.tile || '.';
    const [x, y] = p.at;
    if (!['.', 'w', 'm'].includes(rows[y][x])) throw new Error(`${mapId} (${x},${y}) 에 놓을 수 없다: ${rows[y][x]}`);
    if (m.objects.some((o) => o.x === x && o.y === y)) throw new Error(`${mapId} (${x},${y}) 에 이미 물건`);
    m.objects.push({ id: p.id, x, y });
    note(`지도 ${mapId}: m(${mx},${my}) → ${p.tile || '.'} · ${p.id} @ (${x},${y})`);
  }
  m.rows = rows.map((r) => r.join(''));
  if (m.rows.some((r) => r.includes('m'))) throw new Error(mapId + ' 에 m 이 남았다');
}
// 수납 물건 12개. holds = 위험 없는 수납(열면 한 번 얻고 열린 채) · 사건 = 위험한 수납(경고·판정, 내용은 사건 결과)
// 이미지 이름 = id 앞머리(locker·shelf·drawer·barrel·toolbox·crate·bag) — v4/img/props/<앞머리>(_open|_empty) 짝
const N = (id, name, states, insp, more) => Object.assign({ id, name, states, overlay: {}, inspectLine: Object.fromEntries(states.map((st, i) => [st, insp[i][0]])), ledgerFact: {}, solid: 1, light: 0, resetOn: 'never' }, more || {});
const NEW_OBJ = [
  // mall_a1 (1층, 얕다 — 위험 없는 작은 몫 셋)
  [N('drawer_a1', '계산대 서랍장', ['closed', 'open'], [['insp_drawer_a1', '계산대 뒤 서랍장이다. 맨 아래 칸이 닫혀 있다.'], ['insp_drawer_a1_open', '열어 본 서랍장이다. 영수증만 남았다.']],
    { holds: { text: '성냥 두 갑과 신문 뭉치가 있었다.', effects: [{ verb: 'number', id: 'fuel', n: 1 }] } })],
  [N('shelf_a1', '매점 선반', ['closed', 'empty'], [['insp_shelf_a1', '쓰러진 자판기 옆 선반이다. 밑에 무엇이 굴러 있다.'], ['insp_shelf_a1_empty', '빈 선반이다. 터진 캔 냄새가 남았다.']],
    { holds: { text: '선반 밑에 음료 캔 둘. 하나는 터져 있었다.', effects: [{ verb: 'number', id: 'water', n: 1 }], state: 'empty' } })],
  [N('locker_a1', '관리실 사물함', ['closed', 'open'], [['insp_locker_a1', '관리실 사물함이다. 문이 조금 벌어져 있다.'], ['insp_locker_a1_open', '빈 사물함이다. 옷걸이 하나가 흔들린다.']],
    { holds: { text: '사물함 안에 밧줄 한 타래가 감겨 있었다.', effects: [{ verb: 'flag', id: 'has_rope', set: 1 }] } })],
  // mall_a2 (2층 — 위험한 수납 둘 + 빈 사물함)
  [N('shelf_a2', '기운 선반', ['closed', 'picked', 'empty'], [['insp_shelf_a2', '기운 선반이다. 위에 상자가 쌓여 있다.'], ['insp_shelf_a2_picked', '기운 선반이다. 바닥은 비었고 위 상자는 그대로다.'], ['insp_shelf_a2_empty', '넘어진 선반이다. 상자는 다 뜯겼다.']])],
  [N('barrel_a2', '끼인 드럼통', ['closed', 'open'], [['insp_barrel_a2', '멈춘 에스컬레이터 밑에 드럼통이 끼어 있다.'], ['insp_barrel_a2_open', '빼낸 드럼통이다. 비었다.']])],
  [N('locker_a2', '구석 사물함', ['closed', 'open'], [['insp_locker_a2', '구석 사물함이다. 손잡이에 마른 피가 있다.'], ['insp_locker_a2_open', '빈 사물함이다. 안쪽 문에 손톱자국이 길다.']],
    { holds: { text: '누가 먼저 열었다. 안쪽 문에 손톱자국이 길게 나 있었다.' } })],
  // drain_b1 (1층 — 위험한 수납 하나·덜 위험한 수납 하나 + 무전기)
  [N('crate_b1', '쌓인 상자', ['closed', 'empty'], [['insp_crate_b1', '쌓인 상자다. 하나가 뜯겨 있다.'], ['insp_crate_b1_empty', '뜯은 상자다. 쥐똥만 남았다.']])],
  [N('barrel_b1', '녹슨 드럼통', ['closed', 'open'], [['insp_barrel_b1', '녹슨 드럼통이다. 뚜껑이 철사로 묶여 있다.'], ['insp_barrel_b1_open', '빈 드럼통이다. 비닐 조각이 붙어 있다.']],
    { holds: { text: '비닐에 싼 무전기가 들어 있었다. 아직 지직거린다.', effects: [{ verb: 'flag', id: 'has_radio', set: 1 }] } })],
  [N('bag_b1', '걸린 가방', ['closed', 'open'], [['insp_bag_b1', '배수관에 가방이 걸려 있다. 물 밑이 보이지 않는다.'], ['insp_bag_b1_open', '빈 가방이 물에 떠 있다.']], { solid: 0 })],
  // drain_b2 (2층 — 위험한 수납 하나 + 퓨즈 + 빈 드럼통, 저수조는 물 긷는 사건)
  [N('toolbox_b2', '펌프 공구함', ['closed', 'open'], [['insp_toolbox_b2', '펌프 관리용 공구함이다. 걸쇠가 녹슬었다.'], ['insp_toolbox_b2_open', '빈 공구함이다. 기름 냄새가 난다.']],
    { holds: { text: '퓨즈 두 개와 절연 테이프가 있었다.', effects: [{ verb: 'number', id: 'parts', n: 1 }] } })],
  [N('locker_b2', '잠긴 사물함', ['closed', 'open'], [['insp_locker_b2', '펌프실 옆 사물함이다. 안에서 물소리가 난다.'], ['insp_locker_b2_open', '열린 사물함이다. 바닥에 물이 고였다.']])],
  [N('barrel_b2', '잠긴 드럼통', ['closed', 'open'], [['insp_barrel_b2', '반쯤 물에 잠긴 드럼통이다. 뚜껑이 떠 있다.'], ['insp_barrel_b2_open', '흙탕물이 찬 드럼통이다.']],
    { holds: { text: '드럼통 안은 흙탕물뿐이었다. 바닥에서 무엇이 한 번 뒤척였다.' } })],
];
// 줄 글은 N 에 넘긴 [id, 글] 에서 꺼낸다
const INSP = {
  drawer_a1: [['insp_drawer_a1', '계산대 뒤 서랍장이다. 맨 아래 칸이 닫혀 있다.'], ['insp_drawer_a1_open', '열어 본 서랍장이다. 영수증만 남았다.']],
  shelf_a1: [['insp_shelf_a1', '쓰러진 자판기 옆 선반이다. 밑에 무엇이 굴러 있다.'], ['insp_shelf_a1_empty', '빈 선반이다. 터진 캔 냄새가 남았다.']],
  locker_a1: [['insp_locker_a1', '관리실 사물함이다. 문이 조금 벌어져 있다.'], ['insp_locker_a1_open', '빈 사물함이다. 옷걸이 하나가 흔들린다.']],
  shelf_a2: [['insp_shelf_a2', '기운 선반이다. 위에 상자가 쌓여 있다.'], ['insp_shelf_a2_picked', '기운 선반이다. 바닥은 비었고 위 상자는 그대로다.'], ['insp_shelf_a2_empty', '넘어진 선반이다. 상자는 다 뜯겼다.']],
  barrel_a2: [['insp_barrel_a2', '멈춘 에스컬레이터 밑에 드럼통이 끼어 있다.'], ['insp_barrel_a2_open', '빼낸 드럼통이다. 비었다.']],
  locker_a2: [['insp_locker_a2', '구석 사물함이다. 손잡이에 마른 피가 있다.'], ['insp_locker_a2_open', '빈 사물함이다. 안쪽 문에 손톱자국이 길다.']],
  crate_b1: [['insp_crate_b1', '쌓인 상자다. 하나가 뜯겨 있다.'], ['insp_crate_b1_empty', '뜯은 상자다. 쥐똥만 남았다.']],
  barrel_b1: [['insp_barrel_b1', '녹슨 드럼통이다. 뚜껑이 철사로 묶여 있다.'], ['insp_barrel_b1_open', '빈 드럼통이다. 비닐 조각이 붙어 있다.']],
  bag_b1: [['insp_bag_b1', '배수관에 가방이 걸려 있다. 물 밑이 보이지 않는다.'], ['insp_bag_b1_open', '빈 가방이 물에 떠 있다.']],
  toolbox_b2: [['insp_toolbox_b2', '펌프 관리용 공구함이다. 걸쇠가 녹슬었다.'], ['insp_toolbox_b2_open', '빈 공구함이다. 기름 냄새가 난다.']],
  locker_b2: [['insp_locker_b2', '펌프실 옆 사물함이다. 안에서 물소리가 난다.'], ['insp_locker_b2_open', '열린 사물함이다. 바닥에 물이 고였다.']],
  barrel_b2: [['insp_barrel_b2', '반쯤 물에 잠긴 드럼통이다. 뚜껑이 떠 있다.'], ['insp_barrel_b2_open', '흙탕물이 찬 드럼통이다.']],
};
for (const [o] of NEW_OBJ) {
  if (OBJ.some((x) => x.id === o.id)) throw new Error('물건 중복 ' + o.id);
  OBJ.push(o);
  for (const [id, text] of INSP[o.id]) line(id, text);
  note(`물건 ${o.id} (${o.name}) ${o.states.join('/')}${o.holds ? ' · holds: ' + (o.holds.text || '') + (o.holds.effects ? ' ' + JSON.stringify(o.holds.effects) : '') : ' · 사건 수납'}`);
}
// 기존 원정 물건: 시체 자루는 한 번 고르면 끝(닫았다·가져갔다)
const bag = obj('bodybag_a2');
bag.states = ['normal', 'zipped', 'taken'];
bag.inspectLine = { normal: 'insp_bodybag', zipped: 'insp_bodybag_zipped', taken: 'insp_bodybag_taken' };
line('insp_bodybag_zipped', '지퍼를 닫은 시체 자루다. 냄새는 그대로다.');
line('insp_bodybag_taken', '자루가 있던 자리에 젖은 자국만 남았다.');
note('물건 bodybag_a2: states normal → normal/zipped/taken (한 판에 한 번)');

// '찾는' 원정 사건 → 그 수납을 조사할 때만. 위험한 수납은 경고·판정 그대로, 고른 결과가 수납 상태를 바꾼다(다시 차지 않는다)
const gate = (id, when) => { const e = ev(id); note(`원정 사건 ${id}: when "${e.when}" → "${when}"`); e.when = when; return e; };
// mall_a1 — 전화 부스 카드(부스 조사) · 자판기 캔(→ shelf_a1 holds 로, 선택지 하나뿐이던 사건은 지운다)
gate('trip_a1_phone', 'day>=2 & region==A & floor==1 & inspect:phonebooth & trace:phonebooth==card');
{ const i = EV.findIndex((x) => x.id === 'trip_a1_vending'); EV.splice(i, 1); note('원정 사건 trip_a1_vending 지움 → shelf_a1 holds (선택지 하나·위험 없음 = 수납 내용)'); }
// mall_a2 — 기운 선반(상자 끌어내리기) · 끼인 드럼통(들어 올리기) · 시체 자루
{
  const e = gate('trip_a2_stockroom', 'day>=2 & region==A & floor==2 & inspect:shelf_a2 & trace:shelf_a2!=empty');
  const pull = ch('trip_a2_stockroom', '상자를 끌어내린다');
  effects(pull.ok).push(trace('shelf_a2', 'empty')); effects(pull.fail).push(trace('shelf_a2', 'empty'));
  const floor = ch('trip_a2_stockroom', '바닥 것만 줍는다');
  effects(floor.out).push(trace('shelf_a2', 'picked'));
  floor.swap = [{ when: 'trace:shelf_a2==picked', label: '선반을 그대로 둔다', out: { text: '바닥은 이미 비었다. 선반은 건드리지 않았다.', effects: [], ledger: '' } }];
  void e;
}
{
  const e = gate('trip_a2_escalator', 'day>=1 & region==A & floor==2 & inspect:barrel_a2 & trace:barrel_a2==closed');
  e.text = '멈춘 에스컬레이터 밑에 드럼통이 끼어 있다. 안에서 캔 구르는 소리가 난다. 빼내려면 계단판을 들어야 한다.';
  const lift = ch('trip_a2_escalator', '들어 올린다');
  lift.ok.text = '계단판을 들고 드럼통을 끌어냈다. 통조림 둘, 물 둘.';
  effects(lift.ok).push(trace('barrel_a2', 'open'));
  lift.fail.text = '계단판이 미끄러졌다. 정강이가 밑에 깔렸다.';
}
{
  gate('trip_a2_bodybag', 'day>=3 & region==A & floor==2 & inspect:bodybag_a2 & trace:bodybag_a2==normal');
  effects(ch('trip_a2_bodybag', '지퍼를 닫는다').out).push(trace('bodybag_a2', 'zipped'));
  effects(ch('trip_a2_bodybag', '가져간다').out).push(trace('bodybag_a2', 'taken'));
}
// drain_b1 — 쌓인 상자 · 배수관에 걸린 가방 · 배수관의 사람들(배수관 조사)
{
  gate('trip_g_crates', 'day>=1 & floor==1 & region==B & inspect:crate_b1 & trace:crate_b1==closed');
  const dig = ch('trip_g_crates', '뒤진다');
  effects(dig.ok).push(trace('crate_b1', 'empty')); effects(dig.fail).push(trace('crate_b1', 'empty'));
}
{
  gate('trip_b1_debris', 'day>=1 & region==B & floor==1 & inspect:bag_b1 & trace:bag_b1==closed');
  const pull = ch('trip_b1_debris', '꺼낸다');
  effects(pull.ok).push(trace('bag_b1', 'open')); effects(pull.fail).push(trace('bag_b1', 'open'));
}
gate('trip_b1_workers', 'day>=4 & region==B & floor==1 & inspect:worker_pipe & trace:worker_pipe==bodies');
// drain_b2 — 잠긴 사물함 · 저수조 물탱크(물 긷기, 다시 길을 수 있다)
{
  gate('trip_b2_lockers', 'day>=1 & region==B & floor==2 & inspect:locker_b2 & trace:locker_b2==closed');
  const pry = ch('trip_b2_lockers', '비틀어 연다');
  effects(pry.ok).push(trace('locker_b2', 'open')); effects(pry.fail).push(trace('locker_b2', 'open'));
}
gate('trip_b2_pumproom', 'day>=2 & region==B & floor==2 & inspect:cistern');

}
// ───────────────────────── 3-⑤ 찾은 물건 아이콘: 무전기 쓰임 ─────────────────────────
// 밧줄(has_rope) = 배수로 1층 '밧줄을 던진다'(이미 있던 잠긴 선택지) · 성냥 = 땔감 +1 · 퓨즈 = 부품 +1 · 무전기(has_radio) = D7 방송에서 쓴다
ev('d7_broadcast').choices.push({ label: '무전기 주파수를 맞춘다', check: null, cost: {}, req: { flag: 'has_radio', why: '무전기가 없다' }, taboo: '', warn: '',
  out: { text: '무전기에서도 같은 목소리가 났다. 그 밑에서 사람 하나가 숨을 쉬고 있었다.', effects: [{ verb: 'flag', id: 'fare_known', set: 1 }, { verb: 'axis', id: 'name', n: -1 }, { verb: 'number', id: 'fear', who: 'you', n: -1 }], ledger: '' } });
note('d7_broadcast: 선택지 + "무전기 주파수를 맞춘다" (req has_radio · fare_known · 이름 축 −1 = "받아 적는다"와 같은 축 · 두려움 −1). 축이 같아 정체 분포를 흔들지 않는다');

// ───────────────────────── 3-④ 이기적 위험 0 출구에 줄타기 ─────────────────────────
// kind 는 넷 다 point(가리킨다 — 가장 빨리 좁아진다): 남이 대신 치르는 출구(기철이 밟히는 동안 가만히 · 불린 사람을 두고 걷는다).
//   d6_shutter_b 를 endure 로 둔 시험(3차)에서는 화면 93% 라 이기적 봇이 열쇠(값) 대신 그 출구를 골라 D6 에 더 죽고(selfish_nb D6 59판) '봇 버릇 점검'이 7~14판이 되어 point 로 되돌렸다.
const K1 = num('rope_k1'), K2 = num('rope_k2');
const ropeOn = (c) => { const r = c.rope; const from = Math.max(K1, Number.isInteger(r.from) ? r.from : 0); const k = `karma>=${from}`; return r.blind ? `(${k} | flag:${typeof r.blind === 'string' ? r.blind : 'strike_blind'})` : k; };
const NEW_ROPE = [
  ['d6_shutter', '아무것도 하지 않는다', { kind: 'point', fail: { text: '횃불이 기둥 뒤를 비췄다. 쇠파이프가 당신 쪽으로 왔다.', how: 'dead', image: 'death_beaten', ledger: LEDGER_DEAD } }, '기철이 밟히고 창고가 빈다. 눈에 띄면 끝이다'],
  ['d6_shutter_b', '아무것도 하지 않는다', { kind: 'point', fail: { text: '횃불이 기둥 뒤를 비췄다. 쇠파이프가 당신 쪽으로 왔다.', how: 'dead', image: 'death_beaten', ledger: LEDGER_DEAD } }, '창고가 비고 또 온다. 눈에 띄면 끝이다'],
  ['d10_walk', '걷는다', { kind: 'point', fail: { text: '동하가 당신 소매를 잡았다. 당신 이름도 불렸다.', how: 'ascended', image: 'death_counted', ledger: { who: 'you', status: 'ascended', day: '10', cause: '' } } }, '소매를 잡히면 끝이다'],
  ['d10_walk_other', '걷는다', { kind: 'point', fail: { text: '그 사람이 당신 소매를 잡았다. 당신 이름도 불렸다.', how: 'ascended', image: 'death_counted', ledger: { who: 'you', status: 'ascended', day: '10', cause: '' } } }, '소매를 잡히면 끝이다'],
];
const TAIL = new Map();   // 선택지 → 줄타기가 걸릴 때의 경고(꼬리 포함)
if (!SKIP.has('newrope')) for (const [id, label, rope, warn] of NEW_ROPE) { const c = ch(id, label); if (c.rope) throw new Error('이미 줄타기 ' + id); c.rope = rope; TAIL.set(c, warn); note(`줄타기 + ${id} / ${label}: ${rope.kind} · 실패 "${rope.fail.text}" · 경고(카르마 판) "${warn}"`); }

// ───────────────────────── 3-① 갚는 길 꼬리 글을 사건마다 ─────────────────────────
// 엔진 꼬리(rope_tail_pay) 는 모든 사건에 같은 글이라 잠김 이유('식량이 모자라다')와 붙어 헷갈렸다. 엔진에는 사건별 꼬리 칸이 없다(rope 칸 = kind·from·blind·skill·fail)
// → 줄타기가 걸리는 조건(카르마 ≥ rope_k1 과 from 중 큰 값, 눈먼 새벽이면 | 깃발)과 같은 swap 으로 경고 글만 바꾼다. 경고에 '끝이다'가 있으면 엔진은 꼬리를 덧붙이지 않는다.
// d10_hold 는 사건 조건이 karma>=9 라 늘 줄타기 → 경고 칸을 바로 바꾼다.
const PAY_TAIL = [
  ['dawn_strike', '그릇 둘을 내민다', '받고도 안 놓으면 끝이다'],
  ['dawn_mob', '가진 것을 다 내놓는다', '식량과 물이 다 나간다. 그래도 안 멎으면 끝이다'],
  ['dawn_mob', '손가락 하나로 갚는다', '손가락을 잃는다. 그래도 안 멎으면 끝이다'],
  ['called_up', '불을 키우고 밤을 샌다', '불이 먼저 꺼지면 끝이다'],
  ['d10_grab', '물병을 돌려준다', '물이 준다. 받고도 안 놓으면 끝이다'],
  ['starve_you', '창고를 턴다', '들키면 아침에 안다. 누가 지키고 있으면 끝이다'],
];
for (const [id, label, warn] of PAY_TAIL) { const c = ch(id, label); if (!c.rope || c.rope.kind !== 'pay') throw new Error('갚는 줄타기 아님 ' + id); TAIL.set(c, warn); }
{
  const give = ch('d10_hold', '가진 것을 내준다'); give.warn = '식량 둘과 물 하나가 나간다. 받고도 안 놓으면 끝이다'; give.swap[0].warn = '물 셋이 나간다. 받고도 안 놓으면 끝이다';
  const finger = ch('d10_hold', '손가락을 내준다'); finger.warn = '손가락을 잃는다. 그래도 안 놓으면 끝이다';
  note('꼬리 d10_hold (늘 줄타기 — 사건 조건 karma>=9): 경고 칸을 바로 "…받고도 안 놓으면 끝이다" · "손가락을 잃는다. 그래도 안 놓으면 끝이다"');
}

// ───────────────────────── 3-⑥ 손잡이: K2(카르마 8~11) 갚는 길이 '느껴지는' 줄타기가 되게 ─────────────────────────
// 수납·D3/D6·④를 넣은 첫 봇 판(1차)에서 경고를 읽고 버티는 이기적(selfish_nb)이 덜 죽고(균형 대비 −14.3 → −8.4%p, 블록 −4) 산 판 중 '화면 ≤ 85% 줄타기 ≥ 2번'이 49% 로 내려갔다.
// 이기적이 사는 구간은 K2 이고 거기서 늘 가장 높은 % 인 갚는 길(화면 93%)을 고르기 때문 → K2 갚는 길 88 → 80(화면 85%), 갚는다 > 버틴다 를 지키려고 K2 버틴다 80 → 78(화면 83%).
// 시험(4정책 × 5블록, 버틴다는 그대로 둔 판): selfish_nb −11.3%p · 느껴지는 줄타기 ≥ 2번 64% · 균형 그대로 · 모험 24 → 22. 표 한 곳(numbers)이라 되돌리기 쉽다.
if (!SKIP.has('knob')) {
  for (const [id, v] of [['rope_pay_2', 80], ['rope_endure_2', 78]]) { const r = NUM.find((x) => x.id === id); note(`손잡이 ${id}: ${r.start} → ${v} (화면 ${r.start + 5}% → ${v + 5}%)`); r.start = v; }
}

// ───────────────────────── 3-②③ D3·D6 (카르마 < K2) 줄타기 끄기 ─────────────────────────
// 엔진 줄타기에는 날짜 조건이 없다 → 그날·그 카르마에만 걸리는 사본 사건을 앞에 두고 원래 사건은 그 경우를 뺀다(같은 글·같은 그림·같은 선택지, rope 만 다르다).
//   D3 (규칙을 배우는 날) · 카르마 < K2: 줄타기를 모두 뗀다(눈먼 새벽 포함). fight 는 K1 에서 깎는 값이 0 이라 % 는 같고, 원래 판정·경고(밀쳐 낸다 등 원래부터 죽는 판정)는 그대로 남는다.
//   D6 (값을 치르면 사는 날) · 카르마 < K2: pay 줄타기만 뗀다(눈먼 새벽 포함). 버틴다·가리킨다는 그대로.
//   카르마 ≥ K2 인 판은 두 날 모두 원래 사건 = 줄타기 그대로.
const ALL = ['pay', 'endure', 'point', 'fight'];
const DAYOFF = [
  { id: 'dawn_strike', days: { 3: ALL, 6: ['pay'] } },
  { id: 'dawn_mob', days: { 3: ALL, 6: ['pay'] } },
  { id: 'called_up', days: { 3: ALL, 6: ['pay'] } },
  { id: 'fever_night', days: { 3: ALL } },
];
const COPIES = {};   // 원래 id → [사본 id…]
if (!SKIP.has('dayoff')) for (const { id, days } of DAYOFF) {
  const orig = ev(id);
  const w0 = orig.when;
  const ds = Object.keys(days);
  const copies = [];
  for (const d of ds) {
    const cp = clone(orig);
    cp.id = `${id}_d${d}`;
    cp.when = `(${w0}) & day==${d} & karma<${K2}`;
    if (!cp.image && fs.existsSync(path.join(CG, id + '.png'))) cp.image = id;   // 원래 사건 그림 파일이 있을 때만 그 이름을 적는다 (2차: fever_night_d3 가 없는 그림 'fever_night' 을 가리켰다 — 원래 사건은 빈칸)
    const off = [];
    cp.choices.forEach((c) => { if (c.rope && days[d].includes(c.rope.kind)) { off.push(`${c.label}(${c.rope.kind})`); delete c.rope; } });
    copies.push(cp);
    note(`사본 ${cp.id}: when "${cp.when}" · 줄타기 뗌 ${off.join(', ')}`);
  }
  orig.when = `(${w0}) & !(${ds.length > 1 ? '(' + ds.map((d) => `day==${d}`).join(' | ') + ')' : `day==${ds[0]}`} & karma<${K2})`;
  note(`원래 ${id}: when → "${orig.when}"`);
  const at = EV.indexOf(orig);
  EV.splice(at, 0, ...copies);
  COPIES[id] = copies.map((c) => c.id);
}
// '되풀이할수록'(fired:<사건>>=1) 은 사본에서 고른 것도 센다
const firedAll = (s) => s.replace(/fired:(dawn_strike|dawn_mob|called_up)>=1/g, (m, id) => `(${[id].concat(COPIES[id] || []).map((x) => `fired:${x}>=1`).join(' | ')})`);
for (const e of EV) for (const c of e.choices) {
  if (c.req && typeof c.req.cond === 'string') c.req.cond = firedAll(c.req.cond);
  for (const v of [].concat(c.swap || [])) if (v && typeof v.when === 'string') v.when = firedAll(v.when);
}
note('fired:dawn_strike·dawn_mob·called_up>=1 → 사본 사건(_d3·_d6)에서 고른 것도 센다');

// 꼬리 swap 을 붙인다 — 줄타기가 남은 선택지만(사본에서 rope 를 뗀 선택지는 경고도 원래 그대로)
const tailFor = (orig) => TAIL.get(orig);
function addTail(c, warn) {
  const on = ropeOn(c);
  const old = [].concat(c.swap || []);
  const mixed = old.map((v) => Object.assign({}, v, { when: `(${v.when}) & ${on}`, warn: v.warn ? `${v.warn.replace(/[.\s]+$/, '')}. ${warn.split('. ').pop()}` : warn }));
  c.swap = mixed.concat(old, [{ when: on, warn }]);
}
for (const e of EV) {
  const base = e.id.replace(/_d[36]$/, '');
  const src = base !== e.id ? ev(base) : e;
  e.choices.forEach((c, i) => {
    const w = tailFor(src.choices[i]) || (src === e ? tailFor(c) : null);
    if (!w || !c.rope) return;
    if (c.rope.kind === 'pay' && e.id.startsWith('d10_hold')) return;
    addTail(c, w);
    note(`꼬리 ${e.id} / ${c.label}: 줄타기가 걸릴 때(${ropeOn(c)}) 경고 "${w}"`);
  });
}

// ═════════════════════════ 4. 2차 — 최종 점검 지적 (data 담당, 2026-10-25) ═════════════════════════
if (!SKIP.has('fix2')) {
note('── 2차 (최종 점검 지적) ──');
const outsOf = (c) => ['out', 'ok', 'fail'].filter((k) => c[k] && typeof c[k] === 'object').map((k) => c[k]);
const variantsOf = (c) => [c].concat([].concat(c.swap || []).filter((v) => v && typeof v === 'object'));
const swapOut = (c, from, to) => { let n = 0; for (const v of variantsOf(c)) for (const o of outsOf(v)) if (o.text === from) { o.text = to; n++; } return n; };

// 4-1. 정체 끝 문장 한 줄 (지적 2): reveal_* 다음 end_* 가 같은 말을 되풀이했다(end_* = reveal_* 가 길어지기 전의 짧은 판).
//   화면은 '그림 한 장 + 한 줄'(game.js endingScreen) — reveal 목록에서 end_* 를 빼고, 쓰는 데가 없어진 end_* 줄은 지운다.
{
  const drop = new Set();
  for (const c of IDN.candidates) { const keep = c.reveal.filter((id) => !/^end_/.test(id)); c.reveal.filter((id) => /^end_/.test(id)).forEach((id) => drop.add(id)); if (keep.length !== c.reveal.length) note(`정체 ${c.id}: reveal [${c.reveal.join(', ')}] → [${keep.join(', ')}]`); c.reveal = keep; }
  const used = (id) => IDN.candidates.some((c) => c.reveal.includes(id) || (c.dreams || []).includes(id));
  for (const id of drop) if (!used(id)) { const n0 = LINES.length; for (let i = LINES.length - 1; i >= 0; i--) if (LINES[i].id === id) LINES.splice(i, 1); note(`줄 ${id} 지움 (${n0 - LINES.length}행, 쓰는 데 없음)`); }
}

// 4-2. 관리실 사물함 (지적 3): 밧줄(has_rope)은 D0 공구 가방(pro_bag 케이블)이 이미 세운다 → 가방을 연 사람은 얻는 것도 아이콘도 없었다.
//   퓨즈(부품 +1)를 같이 둔다. 화면 wordIcon: 글에서 먼저 나온 '밧줄'은 새로 얻었을 때만, 아니면 '퓨즈'(부품이 늘었다) 아이콘.
if (!SKIP.has('locker')) {
  const o = obj('locker_a1');
  o.holds.text = '사물함 안에 밧줄 한 타래와 퓨즈 상자가 있었다.';
  o.holds.effects.push({ verb: 'number', id: 'parts', n: 1 });
  note(`물건 locker_a1 holds: "${o.holds.text}" ${JSON.stringify(o.holds.effects)}`);
}

// 4-3. 통로 글 (지적 10): passage_alone·_b 는 도현을 만나지 않은 판에도 걸린다(!flag:met_dohyeon) — 처음 보는 사람의 진짜 이름이 나왔다.
//   세 경우(못 만남·떠남·거절) 모두에 맞는 글로.
for (const id of ['passage_alone', 'passage_alone_b']) { const e = ev(id); const t0 = e.text; e.text = e.text.replace('무너진 통로. 도현은 없다.', '무너진 통로. 길을 아는 사람은 없다.'); if (e.text === t0) throw new Error('통로 글 못 바꿈 ' + id); note(`${id} 본문: "${t0}" → "${e.text}"`); }

// 4-4. 소문 거짓 행 (지적 13): rum_saw_shadow 거짓 행이 D1(동하가 아직 역에 없음) 밤에도 생겨 안 만난 사람 이름이 나왔다.
//   화면은 소문 줄을 행 번호로만 고른다(참 = 0행, 거짓 = 1행 — 조건 칸을 안 본다) → 이름 없이 엉뚱한 쪽을 가리키는 거짓으로.
{
  const rows = LINES.filter((l) => l.id === 'rum_saw_shadow');
  const f = rows.find((l) => l.truth === 0);
  note(`소문 rum_saw_shadow 거짓 행: "${f.text}" → "밤에 덩치 큰 사람이 창고 쪽으로 갔어."`);
  f.text = '밤에 덩치 큰 사람이 창고 쪽으로 갔어.';
}

// 4-5. 손등 깨물기 결과 글 (지적 14): '손가락 한 마디를 물어뜯었다'·'피 맛이 날 때까지 깨물었다'가 스스로 몸을 해치는 행동을 바로 그린다.
//   D2(자해 장면은 화면 밖)·10-21 보정(간접 = 흔적·사후)에 맞춰 행동은 빼고 아침에 남은 것만 쓴다. 효과(부상·손가락)는 그대로.
{
  const MAP = [
    ['피 맛이 날 때까지 깨물었다. 이름은 새벽에 그쳤다.', '이름은 새벽에 그쳤다. 손등에 잇자국이 깊게 남았다.'],
    ['피 맛이 날 때까지 깨물었다. 이름은 새벽까지 그치지 않았다.', '이름은 새벽까지 그치지 않았다. 손등에 잇자국이 깊게 남았다.'],
    ['손가락 한 마디를 물어뜯었다. 이름은 새벽에 그쳤다.', '이름은 새벽에 그쳤다. 날이 밝자 손가락 한 마디가 없었다.'],
    ['손가락 한 마디를 물어뜯었다. 이름은 새벽까지 그치지 않았다.', '이름은 새벽까지 그치지 않았다. 날이 밝자 손가락 한 마디가 없었다.'],
  ];
  for (const e of EV) for (const c of e.choices) for (const [a, b] of MAP) { const n = swapOut(c, a, b); if (n) note(`${e.id} / ${c.label}: "${a}" → "${b}" (${n}곳)`); }
}

// 4-6. 약국 지나침 (지적 7): '지나친다'가 skipped_eunchae 를 세우는데 when 이 그 깃발을 안 봐서, 은채를 만나기 전 A1 에 갈 때마다 다시 걸리고 손 −1 이 쌓였다.
//   도현 문(trip_b1_gate: !flag:skipped_dohyeon)과 같이 — 지나친 뒤에는 다시 안 걸린다. 자물쇠를 못 딴 판은 다음에 다시 걸린다.
if (!SKIP.has('pharm')) { const e = ev('trip_a1_pharmacy'); const w0 = e.when; e.when = `${w0} & !flag:skipped_eunchae`; note(`trip_a1_pharmacy when: "${w0}" → "${e.when}"`); }

// 4-7. 위기 창 되풀이 글 (지적 1): 늦은 위기(굶주림·위독·열병·새벽 습격·둘러섬·불림)가 매일 같은 글로 떴다. '사흘째'·'오늘을 넘기면 끝이다'도 날과 안 맞았다.
//   엔진 사건 글에는 변형 칸이 없다 → 같은 사건의 사본(<id>_r2…, 글만 다르다)을 앞에 둔다. k 번째로 뜨면 k 번째 글(마지막 글은 그 뒤로 되풀이).
//   사다리 = fired:<앞 단계> ≥ 1 (표 순서 r_n … r2 → 사본 _d3·_d6 → 원래). 같은 단계에서 사본이 줄줄이 걸리지 않게 하루 한 번 자물쇠(lock_*: 고르면 1, 아침에 0)를 모든 단계에 둔다
//   — 봇 판에서 이 사건들은 하루에 두 번 뜬 적이 없다(data2_probe_perday.txt). 선택지·판정·줄타기·그림은 원래와 같다. 사본은 explicit 0(같은 장면을 적나라 수에 두 번 세지 않는다).
const LADDER = [
  ['starve_you', 'lock_starve', [
    '며칠째 제대로 먹지 못했다. 손이 떨려 연필을 못 쥔다. 눈앞이 어둡다.',
    '또 빈속으로 누웠다. 침이 고이지 않는다. 남의 그릇 쪽으로 눈이 간다.',
    '배가 더는 아프지 않다. 그게 더 무섭다. 손톱 밑이 하얗게 질렸다.',
    '일어서면 벽이 기운다. 굶주림이 몸에 붙었다. 다들 잠든 척한다.']],
  ['wound_critical', 'lock_wound', [
    '붕대 밑이 검게 부었다. 고름 냄새가 난다. 열이 머리까지 올랐다. 오늘 밤 안에 못 고치면 끝이다.',
    '붕대를 풀자 고름이 흘렀다. 넘긴 고비가 다시 왔다. 오늘도 못 고치면 끝이다.',
    '상처 가장자리가 까맣게 죽었다. 썩는 냄새를 다들 맡는다. 오늘도 못 고치면 끝이다.',
    '상처가 낫지도 터지지도 않는다. 열은 그대로다. 고치지 못한 날 밤이 마지막이다.']],
  ['fever_night', 'lock_fever', [
    null,
    '열이 또 오른다. 담요가 땀에 젖었다. 아무도 깨지 않는다.',
    '열이 내리지 않는다. 천장이 가까워졌다 멀어진다. 숨소리가 남의 것 같다.',
    '밤마다 열이다. 몸이 떨리다가 뜨거워진다. 화로 불빛이 멀다.']],
  ['dawn_strike', 'lock_strike', [
    null,
    '또 그 무게에 깼다. 가슴 위에 누가 앉아 목을 누른다. 손이 지난번보다 차다. 얼굴은 어둠 속이다.',
    '숨이 막혀 깼다. 가슴 위의 무게가 익숙하다. 목을 누르는 손이 이제 망설이지 않는다. 얼굴은 끝내 어둠 속이다.']],
  ['dawn_mob', 'lock_mob', [
    null,
    '새벽에 또 둘러섰다. 이번엔 아무도 눈을 피하지 않는다. 누가 당신 봉지를 들고 있다. 손마다 무엇이 들려 있다.']],
  ['called_up', 'lock_called', [
    null,
    '자정. 그 목소리가 또 당신 이름을 부른다. 지난번보다 한 칸 가깝다. 아무도 뒤척이지 않는다.']],
];
if (!SKIP.has('ladder')) for (const [id, lock, texts] of LADDER) {
  const orig = ev(id);
  if (texts[0]) { note(`${id} 본문(첫 글): "${orig.text}" → "${texts[0]}"`); orig.text = texts[0]; }
  const fam = [id].concat(COPIES[id] || []);                     // 원래 + 날 사본(_d3·_d6)
  if (NUM.some((r) => r.id === lock)) throw new Error('수치 중복 ' + lock);
  NUM.push({ id: lock, owner: 'world', min: 0, max: 1, start: 0, perDay: -1, visible: 'never' });
  const addLock = (e) => { for (const c of e.choices) for (const v of variantsOf(c)) for (const o of outsOf(v)) effects(o).push({ verb: 'number', id: lock, n: 1 }); e.when = `(${e.when}) & ${lock}==0`; };
  for (const fid of fam) addLock(ev(fid));
  const firstFired = '(' + fam.map((x) => `fired:${x}>=1`).join(' | ') + ')';
  const base = clone(orig);                                       // 자물쇠까지 붙은 원래(날 사본을 뺀 조건)
  const rungs = [];
  for (let k = 2; k <= texts.length; k++) {
    const cp = clone(base);
    cp.id = `${id}_r${k}`;
    cp.text = texts[k - 1];
    cp.explicit = 0;
    cp.when = `${base.when} & ${k === 2 ? firstFired : `fired:${id}_r${k - 1}>=1`}`;
    rungs.unshift(cp);                                            // 높은 단계가 앞
  }
  EV.splice(Math.min(...fam.map((x) => EV.indexOf(ev(x)))), 0, ...rungs);   // 가족(날 사본·원래) 가운데 표에서 가장 앞 자리 바로 앞
  note(`사다리 ${id}: 자물쇠 ${lock}(하루 한 번) · 사본 ${rungs.map((r) => r.id).join(' · ')} — 글 ${texts.length}개`);
  for (const r of rungs.slice().reverse()) note(`  ${r.id}: when "${r.when}" · "${r.text}"`);
}
// 사본이 표에서 날 사본·원래보다 앞에 섰는지 확인
for (const [id] of LADDER) { if (SKIP.has('ladder')) break; const at = (x) => EV.findIndex((e) => e.id === x); const fam = [id].concat(COPIES[id] || []); const lo = Math.min(...fam.map(at)); const rs = EV.filter((e) => e.id.startsWith(id + '_r')).map((e) => at(e.id)); if (rs.some((i) => i > lo)) throw new Error('사다리 순서 ' + id); }

// 4-8. 모험 봇 손잡이 (지적 4·5·11) — 시험(data2_knob.txt)으로 정한다. 시험용 DATA_KNOB2='[["사건","선택지",값],…]' 가 있으면 그것으로 바꿔 만든다
//   P1-11 로 저수조·기운 선반이 '조사하면 늘 걸리는' 사건이 되어 모험 봇이 거의 매 원정 그 판정을 굴린다(부상 출처 43 → 72 · 32 → 57, 최종 점검 지적 5).
//   둘 다 위험 대 보상은 그대로 두고(실패 = 부상 2·범람수 / 다리) 성공만 45 → 60 · 50 → 60. 시험(5블록 × 200판): 모험 22.5 → 25.0(블록 24~26.5, ✗ → △) ·
//   balanced·selfish_nb·lazy·diligent·child 는 한 판도 안 바뀐다(이 판정을 고르지 않는다). D6 '아무것도 하지 않는다' 줄타기(④)는 건드리지 않는다 — 10-24 디렉터 질문 1(카르마 판의 위험 0 출구를 없앤다)
const KNOB2 = process.env.DATA_KNOB2 ? JSON.parse(process.env.DATA_KNOB2) : [['trip_b2_pumproom', '탱크까지 간다', 60], ['trip_a2_stockroom', '상자를 끌어내린다', 60]];
if (!SKIP.has('knob2')) {
  for (const [id, label, v] of KNOB2) { const c = ch(id, label); note(`손잡이 ${id} / ${label}: check.base ${c.check.base} → ${v}`); c.check.base = v; }
}
}

for (const k of Object.keys(F)) write(k, F[k]);
if (!process.env.DATA_OUT) fs.writeFileSync(path.join(__dirname, 'data_apply_log.txt'), log.join('\n') + '\n', 'utf8');
console.log(log.join('\n'));
