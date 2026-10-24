// 10-26 시험(메모리에서만, 표 파일은 그대로): 제안한 칸 고침을 원본 사본에 넣고 4블록 × 200판으로 몇 줄을 다시 잰다.
// node docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/exp_patch.js <패치묶음 이름> [정책,…]
const path = require('path');
const { fork } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const BLOCKS = [1, 1001, 2001, 3001];
const N = 200;
const ch = (raw, ev, lab) => { const r = raw.events.find((e) => e.id === ev); const c = r && r.choices.find((x) => x.label === lab); if (!c) throw new Error(`선택지 없음 ${ev}/${lab}`); return c; };
const setInjure = (o, n) => { const e = o.effects || {}; const xs = Array.isArray(e.injure) ? e.injure : [e.injure]; let hit = 0; for (const x of xs) if (x && x.who === 'you') { x.n = n; hit++; } if (!hit) throw new Error('당신 부상 칸 없음'); };   // db.raw 는 effects 가 {동사: 값} 꼴
// 패치 묶음: 이름 → raw 를 고치는 함수 목록 (설명은 보고서에 그대로 옮긴다)
const SETS = {
  base: [],
  rat1: [(raw) => setInjure(ch(raw, 'starve_you', '선로 밑을 뒤진다').fail, 1)],                                   // 선로 밑 실패 부상 2 → 1
  rat1_early75: [(raw) => setInjure(ch(raw, 'starve_you', '선로 밑을 뒤진다').fail, 1),
    (raw) => { ch(raw, 'd2_shutter_arm', '팔을 비틀어 뺀다').check.base = 75; }, (raw) => { ch(raw, 'd4_spanner', '스패너를 막는다').check.base = 75; }],
  bowl2: [(raw) => { const o = ch(raw, 'trial_d1_bowls', '똑같이 조금씩').out; if (!o.effects.axis || o.effects.axis.share !== 1) throw new Error('축 칸 모양이 다르다 ' + JSON.stringify(o.effects.axis)); o.effects.axis.share = 2; }],   // D1 '똑같이 조금씩' 몫 +1 → +2 (정체 사람 흉내 inspector·driver)
  share1: [(raw) => { for (const c of raw.identity.candidates) c.rule = c.rule.replace(/share>=2/g, 'share>=1').replace(/share<2/g, 'share<1'); }],   // identity.json 몫 문턱 2 → 1 (모든 후보 rule)
  write0: [(raw) => { for (const [ev, lab] of [['d7_broadcast', '수첩에 받아 적는다'], ['d0_ledger', '말없이 적는다']]) { const o = ch(raw, ev, lab).out; if (!o.effects.axis || o.effects.axis.name !== -1) throw new Error('축 칸 모양이 다르다 ' + ev); delete o.effects.axis.name; if (!Object.keys(o.effects.axis).length) delete o.effects.axis; } }],   // '적는다' 두 곳의 이름 −1 을 지움 (적는 것 = 이름을 남김)
  early75: [(raw) => { ch(raw, 'd2_shutter_arm', '팔을 비틀어 뺀다').check.base = 75; }, (raw) => { ch(raw, 'd4_spanner', '스패너를 막는다').check.base = 75; }],
};
const args = process.argv.slice(2);
const setName = args.find((a) => SETS[a]) || 'base';
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a) && !SETS[a]) || 'balanced,lazy,diligent,risky,devoted,silent').split(',');
const w = args.find((a) => a.startsWith('--worker='));
if (w) {
  const name = w.slice(9);
  const T = require(path.join(root, 'v4/engine/tables.js'));
  const { play } = require(path.join(root, 'v4/sim/bots.js'));
  const S = require(path.join(root, 'v4/sim/stats.js'));
  let db = T.loadDir(path.join(root, 'v4/data'));
  const raw = JSON.parse(JSON.stringify(db.raw));
  for (const f of SETS[setName]) f(raw);
  db = T.load(raw);
  const runs = [];
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); }
  const per = BLOCKS.map((b0, i) => S.aggregate(db, runs.slice(i * N, (i + 1) * N)));
  const a = S.aggregate(db, runs);
  const pick = (x) => ({ identity: x.identity, survived: x.survived, deathRate: x.deathRate, deadByD5: x.deadByD5, top: x.topCause, root: x.topRoot, forced: x.forced, unwarned: x.unwarned });
  process.send({ name, a: pick(a), per: per.map(pick) }, () => process.exit(0));
} else {
  const out = {}; let live = 0; const q = pols.slice();
  const done = () => {
    console.log(`패치 묶음 ${setName} (메모리 시험, ${N}판 × ${BLOCKS.length}블록)`);
    console.log('| 정책 | 사망% (블록) | 생존% | D5까지 사망% | 사인 1위 (블록) | 원인 1위 (블록) | 강제·경고 없는 사망 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const p of pols) { const { a, per } = out[p];
      console.log(`| ${p} | ${a.deathRate} (${per.map((x) => x.deathRate).join(' / ')}) | ${a.survived} | ${a.deadByD5} | ${a.top.k} ${a.top.share} (${per.map((x) => x.top.share).join(' / ')}) | ${a.root.k} ${a.root.share} (${per.map((x) => `${x.root.k === a.root.k ? '' : x.root.k + ' '}${x.root.share}`).join(' / ')}) | ${a.forced} · ${a.unwarned} |`); }
  };
  const groups = () => { const G = { '성향 봇': ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward', 'counter', 'child'], '사람 흉내': ['h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'] };
    for (const [lab, ns] of Object.entries(G)) { const ps = ns.filter((p) => out[p]); if (!ps.length) continue; const o = {}; for (const p of ps) for (const [k, v] of Object.entries(out[p].a.identity || {})) o[k] = (o[k] || 0) + v / ps.length;
      const bl = [0, 1, 2, 3].map((i) => { const b = {}; for (const p of ps) for (const [k, v] of Object.entries(out[p].per[i].identity || {})) b[k] = (b[k] || 0) + v / ps.length; return b; });
      const ids = ['driver', 'conductor', 'inspector', 'passenger', 'counted', 'platform_one', 'counting_child'];
      console.log('- 정체 ' + lab + ' 평균 (' + ps.length + '종): ' + ids.map((k) => k + ' ' + Math.round(10 * (o[k] || 0)) / 10 + ' [' + bl.map((b) => Math.round(10 * (b[k] || 0)) / 10).join('/') + ']').join(' · ')); } };
  const next = () => {
    if (!q.length && !live) { done(); groups(); return; }
    while (live < 8 && q.length) {
      const p = q.shift(); live++;
      const c = fork(__filename, [setName, `--worker=${p}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      c.on('message', (m) => { out[m.name] = m; });
      c.on('exit', () => { live--; next(); });
    }
  };
  next();
}
