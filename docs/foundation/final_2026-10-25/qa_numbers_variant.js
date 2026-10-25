// read-only variant tester: node variant.js <variant> <policy> [blocks]
// loads v4/data, applies an in-memory change (no file writes), plays the same bots as run.js, prints one JSON line.
const path = require('path');
const ROOT = 'C:/dev/dark_station';
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const { play } = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const [variant, pol, blk] = process.argv.slice(2);
const blocks = (blk || '1,1001,2001,3001,8001').split(',').map(Number);
const base = T.loadDir(path.join(ROOT, 'v4/data'));
const raw = JSON.parse(JSON.stringify(base.raw));
const ev = (id) => raw.events.find((r) => r.id === id);
const ch = (id, label) => ev(id).choices.find((c) => c.label === label);
const V = {
  base: () => {},
  // A: D6 셔터 둘의 '아무것도 하지 않는다' 줄타기를 카르마 8(K2)부터
  d6from8: () => { for (const id of ['d6_shutter', 'd6_shutter_b']) { const c = ch(id, '아무것도 하지 않는다'); c.rope.from = 8; for (const w of c.swap || []) if (w.when === 'karma>=5') w.when = 'karma>=8'; } },
  // B: 저수조 '탱크까지 간다' 판정 45 → 60
  pump60: () => { ch('trip_b2_pumproom', '탱크까지 간다').check.base = 60; },
  // C: 약국 사건 한 판에 한 번 (fired:trip_a1_pharmacy<1)
  pharm1: () => { const e = ev('trip_a1_pharmacy'); e.when = e.when + ' & fired:trip_a1_pharmacy<1'; },
  // D: D4 스패너 '그릇 하나' 식량 1 → 2
  d4food2: () => { ch('d4_spanner', '그릇 하나로 입을 막는다').cost.food = 2; },
  // E: numbers rope_endure_1 88 → 80 (K1 버틴다 화면 93 → 85)
  endure1_80: () => { raw.numbers.find((r) => r.id === 'rope_endure_1').start = 80; },
  // A+B
  both: () => { V.d6from8(); V.pump60(); },
};
if (!V[variant]) throw new Error('variant?');
V[variant]();
const db = variant === 'base' ? base : T.load(raw);
const runs = [];
const perBlock = [];
for (const b0 of blocks) {
  const br = [];
  for (let seed = b0; seed < b0 + 200; seed++) { const { s, trace } = play(db, seed, pol); const m = S.measure(db, s, trace); runs.push(m); br.push(m); }
  perBlock.push(S.aggregate(db, br).survived);
}
const a = S.aggregate(db, runs);
console.log(JSON.stringify({ variant, pol, survived: a.survived, perBlock, aliveD4: a.aliveD4, deadByD5: a.deadByD5, topCause: a.topCause, ropeFeltSurv: a.ropeFeltSurv, ropeFelt2: a.ropeFelt2, karma: a.karma, identity: a.identity }));
