// 10-24 줄타기 설계(tightrope/design.md)의 데이터 몫을 표 파일에 넣는다 (data 담당).
//   node docs/foundation/meeting_2026-10-24/tightrope/data_apply.js [--dir=표 폴더]   (기본 v4/data · dark_station 에서)
//   --dir 에 사본 폴더를 주면 그 사본만 고친다(시험용). 같은 표에 두 번 돌리면 오류로 멈춘다(이미 들어간 칸).
// 넣는 것:
//   ① events: §1-3 선택지 30개에 rope 칸(kind · starve_you 둘 from 8 · dawn_strike 그릇·맞고 버틴다·옆 담요 blind 1) + 실패 글(fail) 22개
//   ② events: dawn_strike 의 당신을 죽이지 않는 모든 결과에 flag strike_blind 0 (§2-2 ①)
//   ③ nightEvents 5행 (§2-2): grudge_boils · grudge_strike_you · steal_food_again · steal_meds_again · share_bowl
//   ④ lines: 경고 꼬리 rope_tail_pay · rope_tail_endure · rope_tail_point
//   ⑤ numbers: 줄타기 손잡이 rope_* 24행 (owner world · visible never — 값 = 설계 시험값 = 엔진 기본값)
// 파일은 원래 꼴(들여쓰기 2칸 · 줄끝 CRLF/LF)을 그대로 지켜 쓴다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const arg = (k) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const DIR = path.resolve(arg('dir') || path.join(root, 'v4/data'));

const read = (f) => { const t = fs.readFileSync(path.join(DIR, f + '.json'), 'utf8'); return { t, crlf: t.includes('\r\n'), j: JSON.parse(t) }; };
const write = (f, o) => { let r = JSON.stringify(o.j, null, 2) + '\n'; if (o.crlf) r = r.replace(/\n/g, '\r\n'); fs.writeFileSync(path.join(DIR, f + '.json'), r, 'utf8'); };

const DEAD = { who: 'you', status: 'dead', day: '{day}', cause: '' };
const ASC = { who: 'you', status: 'ascended', day: '{day}', cause: '' };
const SHOES = [{ verb: 'trace', id: 'shoes_stairs', state: 'pair' }];

// ① 줄타기 칸 — [사건, 선택 label, rope 칸]. 실패 글은 40자 1문장 ≤ 2개(새 글) · 'swap 글 그대로' 셋은 지금 K≥8 변형의 실패 글을 그대로 쓴다
const ROPE = [
  // 늦은 값 사건 5개 — 갚는다·버틴다·가리킨다
  ['dawn_strike', '그릇 둘을 내민다', { kind: 'pay', blind: 1, fail: { text: '그림자는 받아 들고도 목을 놓지 않았다. 마지막 숨이 그 손 밑에서 막혔다.', how: 'dead', image: 'death_starve', ledger: DEAD } }],
  ['dawn_strike', '맞고 버틴다', { kind: 'endure', blind: 1, fail: { text: '갈비뼈가 안으로 꺾였다. 숨이 돌아오지 않았다.', how: 'dead', ledger: DEAD } }],
  ['dawn_strike', '옆 담요를 가리킨다', { kind: 'point', blind: 1, fail: { text: '손가락이 허공을 가리켰다. 아무도 돌아보지 않았다. 손이 다시 목을 눌렀다.', how: 'dead', ledger: DEAD } }],   // swap 글 그대로
  ['dawn_mob', '가진 것을 다 내놓는다', { kind: 'pay', fail: { text: '봉지를 다 받고도 발길질은 그치지 않았다. 숨소리가 먼저 끊겼다.', how: 'dead', ledger: DEAD } }],
  ['dawn_mob', '맞고 버틴다', { kind: 'endure', fail: { text: '웅크린 등 위로 발이 계속 내려왔다. 소리가 멎었다.', how: 'dead', ledger: DEAD } }],
  ['dawn_mob', '손가락 하나로 갚는다', { kind: 'pay', fail: { text: '칼이 한 번 더 내려왔다. 판자가 검게 젖었다.', how: 'dead', ledger: DEAD } }],
  ['dawn_mob', '다른 사람을 가리킨다', { kind: 'point', fail: { text: '손끝을 따라 아무도 돌아서지 않았다. 발길질이 다시 당신에게 왔다.', how: 'dead', ledger: DEAD } }],   // swap 글 그대로
  ['called_up', '불을 키우고 밤을 샌다', { kind: 'pay', fail: { text: '불이 꺼진 새벽, 입이 먼저 "네" 했다.', how: 'ascended', image: 'death_counted', effects: SHOES, ledger: ASC } }],
  ['called_up', '손등을 깨물며 버틴다', { kind: 'endure', fail: { text: '깨문 손이 입에서 빠졌다. 그 입으로 "네" 했다.', how: 'ascended', image: 'death_counted', effects: SHOES, ledger: ASC } }],
  ['called_up', '다른 이름을 댄다', { kind: 'point', fail: { text: '그 사람이 깨어 당신 이름을 되받아 댔다. 계단이 따뜻해졌다. 신발이 저절로 벗겨졌다.', how: 'ascended', ledger: ASC } }],   // swap 글 그대로
  ['d10_hold', '가진 것을 내준다', { kind: 'pay', fail: { text: '그는 받아 들고도 소매를 놓지 않았다. 소매를 감은 손이 목으로 올라왔다.', how: 'dead', ledger: DEAD } }],
  ['d10_hold', '끌려가며 버틴다', { kind: 'endure', fail: { text: '선로 끝에서 돌이 머리로 내려왔다.', how: 'dead', ledger: DEAD } }],
  ['d10_hold', '손가락을 내준다', { kind: 'pay', fail: { text: '돌은 손가락에서 멈추지 않았다. 떠나는 사람들은 돌아보지 않았다.', how: 'dead', ledger: DEAD } }],
  ['d10_grab', '물병을 돌려준다', { kind: 'pay', fail: { text: '물병을 받고도 손톱은 빠지지 않았다. 그 물병이 당신 머리를 내리쳤다.', how: 'dead', ledger: DEAD } }],
  ['d10_grab', '끌려 넘어진다', { kind: 'endure', fail: { text: '얼굴부터 레일에 박혔다. 일어나지 못했다.', how: 'dead', ledger: DEAD } }],
  // 이른 위기·열병·D10·굶는 밤 — 남을 내밀거나 훔치는 출구
  ['d2_shutter_arm', '옆 사람 팔을 내민다', { kind: 'point', fail: { text: '잠든 팔이 빠져나갔다. 셔터 날이 당신 팔로 왔다.', how: 'dead', ledger: DEAD } }],
  ['d4_spanner', '다른 사람이 셌다고 한다', { kind: 'point', fail: { text: '헤드램프는 켜지지 않았다. 스패너가 관자놀이로 왔다.', how: 'dead', ledger: DEAD } }],
  ['d5_flood', '남의 담요로 물길을 막는다', { kind: 'point', fail: { text: '주인이 담요를 놓지 않았다. 물살이 당신 발을 들었다.', how: 'dead', ledger: DEAD } }],
  ['fever_night', '남의 담요를 끌어온다', { kind: 'point', fail: { text: '주인이 담요를 도로 끌어갔다. 새벽에 몸이 식어 있었다.', how: 'dead', ledger: DEAD } }],
  ['d10_walk_weak', '옆 사람 물병을 비운다', { kind: 'point', fail: { text: '그 사람이 물병을 놓지 않았다. 마른 목 위로 이름이 내려왔다.', how: 'ascended', image: 'death_counted', ledger: ASC } }],
  ['starve_you', '창고를 턴다', { kind: 'pay', from: 8, fail: { text: '씹던 입이 멎었다. 어둠 속 누군가는 끝까지 보기만 했다.', how: 'dead', ledger: DEAD } }],
  ['starve_you', '남의 그릇을 뺏는다', { kind: 'point', from: 8, fail: { text: '그 사람이 손목을 잡았다. 주먹이 멎지 않았다.', how: 'dead', ledger: DEAD } }],   // 판정이던 선택지: 원래 실패(부상) 효과 + 죽음
  // 싸운다 8 — 원래 판정의 base 를 K3 −5 · K4 −10 (바닥 30), 원래 실패 글 그대로
  ['dawn_strike', '밀쳐 낸다', { kind: 'fight' }],
  ['dawn_strike', '소리친다', { kind: 'fight' }],
  ['dawn_strike', '축 늘어진다', { kind: 'fight' }],
  ['dawn_mob', '밀치고 달아난다', { kind: 'fight' }],
  ['dawn_mob', '무릎을 꿇고 빈다', { kind: 'fight' }],
  ['called_up', '귀를 막는다', { kind: 'fight' }],
  ['d10_hold', '뿌리치고 걷는다', { kind: 'fight' }],
  ['d10_grab', '발을 빼낸다', { kind: 'fight' }],
];
// ④ 경고 꼬리 — 종류마다 한 줄이 그 종류의 모든 선택지에 붙는다(엔진 ropeWarn). 그래서 어느 선택지에 붙어도 맞는 글로 쓴다
const TAILS = { pay: '모자라면 끝이다', endure: '못 버티면 끝이다', point: '안 통하면 끝이다' };
// ⑤ 손잡이 (설계 §1-2 · 엔진 schema ROPE_DEFAULTS 와 같은 값)
const KNOBS = [
  ['rope_k1', 5, 30], ['rope_k2', 8, 30], ['rope_k3', 12, 30], ['rope_k4', 16, 30],
  ['rope_pay_1', 92], ['rope_pay_2', 90], ['rope_pay_3', 85], ['rope_pay_4', 78],
  ['rope_endure_1', 88], ['rope_endure_2', 85], ['rope_endure_3', 78], ['rope_endure_4', 70],
  ['rope_point_1', 82], ['rope_point_2', 70], ['rope_point_3', 55], ['rope_point_4', 40],
  ['rope_fight_1', 0], ['rope_fight_2', 0], ['rope_fight_3', 5], ['rope_fight_4', 10],
  ['rope_floor', 30], ['rope_blind_pay', 85], ['rope_blind_endure', 75], ['rope_blind_point', 65],
];

const log = [];
const die = (m) => { throw new Error(m); };
// ── events ──
const E = read('events');
const evOf = (id) => E.j.find((e) => e.id === id) || die('사건 없음 ' + id);
for (const [id, label, rope] of ROPE) {
  const c = evOf(id).choices.find((x) => x.label === label) || die(`선택지 없음 ${id}/${label}`);
  if (c.rope !== undefined) die(`이미 rope 칸이 있다 ${id}/${label} — 두 번 돌렸나?`);
  c.rope = JSON.parse(JSON.stringify(rope));
  log.push(`events ${id}/${label}: rope ${rope.kind}${rope.from ? ' from ' + rope.from : ''}${rope.blind ? ' blind' : ''}${rope.fail ? ' + 실패 글' : ''}`);
}
// ② dawn_strike: 당신을 죽이지 않는 모든 결과가 strike_blind 를 지운다
const killsYou = (o) => Array.isArray(o.effects) && o.effects.some((e) => e.verb === 'kill' && (!e.who || ['you', 'self', 'actor', 'party', 'all'].includes(e.who)));
let cleared = 0;
for (const c of evOf('dawn_strike').choices) for (const v of [c].concat(c.swap ? [].concat(c.swap) : [])) for (const k of ['out', 'ok', 'fail']) {
  const o = v[k]; if (!o || typeof o !== 'object' || killsYou(o)) continue;
  o.effects = Array.isArray(o.effects) ? o.effects : [];
  if (o.effects.some((e) => e.verb === 'flag' && e.id === 'strike_blind')) die('dawn_strike 에 이미 strike_blind');
  const at = o.effects.findIndex((e) => e.verb === 'flag' && e.id === 'dawn_strike');
  o.effects.splice(at >= 0 ? at + 1 : 0, 0, { verb: 'flag', id: 'strike_blind', set: 0 });
  cleared++;
}
log.push(`events dawn_strike: 죽지 않는 결과 ${cleared}개에 flag strike_blind 0`);
write('events', E);

// ── nightEvents ③ ──
const N = read('nightEvents');
const row = (id) => N.j.find((x) => x.id === id) || die('밤 사건 없음 ' + id);
{ const r = row('grudge_boils');
  if (r.side) die('grudge_boils 에 이미 side');
  r.weight = 7; r.side = 1;
  r.effects.push({ verb: 'flag', id: 'strike_blind', set: 1 });
  log.push('nightEvents grudge_boils: side 1 · weight 10 → 7 (그 밤 70%, 상한 밖) · + flag strike_blind 1'); }
{ const r = row('grudge_strike_you');
  if (/unseen_grudge_actor/.test(r.actor)) die('grudge_strike_you 이미 고침');
  r.actor = `(${r.actor}) & !flag:unseen_grudge_actor`;
  log.push(`nightEvents grudge_strike_you: actor → ${r.actor}`); }
{ const r = row('steal_food_again');
  r.effects.push({ verb: 'number', id: 'hunger', who: 'you', n: 3 });
  r.trace = Object.assign({}, r.trace, { bowl_you: 'empty' });
  log.push('nightEvents steal_food_again: + hunger you +3 · trace + bowl_you empty'); }
{ const r = row('steal_meds_again');
  r.effects.push({ verb: 'injure', who: 'you', n: 1 });
  r.trace = Object.assign({}, r.trace, { bandage_you: 'rot' });
  log.push('nightEvents steal_meds_again: + injure you 1 · trace + bandage_you rot'); }
{ const r = row('share_bowl');
  r.missed.effects.push({ verb: 'number', id: 'grudge', n: 4, who: 'actor' }, { verb: 'flag', id: 'unseen_grudge_actor', set: 1 });
  log.push('nightEvents share_bowl: missed.effects + grudge actor +4 · flag unseen_grudge_actor 1'); }
write('nightEvents', N);

// ── lines ④ ──
const L = read('lines');
for (const [k, text] of Object.entries(TAILS)) {
  const id = 'rope_tail_' + k;
  if (L.j.some((x) => x.id === id)) die('이미 있는 줄 ' + id);
  L.j.push({ id, speaker: 'ui', context: '', grade: 'choice', text, rumor: 0, truth: 1 });
  log.push(`lines ${id}: "${text}"`);
}
write('lines', L);

// ── numbers ⑤ ──
const M = read('numbers');
for (const [id, start, max] of KNOBS) {
  if (M.j.some((x) => x.id === id)) die('이미 있는 수치 ' + id);
  M.j.push({ id, owner: 'world', min: 0, max: max || 100, start, perDay: 0, visible: 'never' });
}
log.push(`numbers rope_* ${KNOBS.length}행: ${KNOBS.map(([id, v]) => `${id.replace('rope_', '')}=${v}`).join(' ')}`);
write('numbers', M);

console.log(`# 데이터 넣기 — ${DIR}\n` + log.map((x) => '- ' + x).join('\n'));
