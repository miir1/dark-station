// 10-26 시험(메모리에서만, 표 파일은 그대로): 늦은 사건의 '버틴다'를 카르마가 높으면 잠그면 어떻게 되나 — A1 구조 한계 제안의 크기 재기
// node docs/foundation/meeting_2026-10-24/apply/measure_2026-10-26/exp_hold_lock.js [문턱=12] [정책,…] [판수=200]
// 바꾸는 것(메모리): called_up '손등을 깨물며 버틴다' · dawn_strike '맞고 버틴다' · dawn_mob '맞고 버틴다' · d10_hold '끌려가며 버틴다'
//   의 req 에 cond 'karma<문턱' 을 더한다(why '몸이 더 버티지 못한다'). 강제 사망이 생기면 그 수와 '앞선 자유 경고 선택' 추적을 함께 본다.
const path = require('path');
const { fork } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const BLOCKS = [1, 1001, 2001, 3001];
const args = process.argv.slice(2);
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
const THR = nums[0] || 12;
const N = nums[1] || 200;
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'balanced,selfish,selfish_nb,selfish_rt0,h_cautious,h_first,child,risky').split(',');
const HOLDS = { called_up: '손등을 깨물며 버틴다', dawn_strike: '맞고 버틴다', dawn_mob: '맞고 버틴다', d10_hold: '끌려가며 버틴다' };
const w = args.find((a) => a.startsWith('--worker='));
if (w) {
  const name = w.slice(9);
  const T = require(path.join(root, 'v4/engine/tables.js'));
  const { play } = require(path.join(root, 'v4/sim/bots.js'));
  const S = require(path.join(root, 'v4/sim/stats.js'));
  let db = T.loadDir(path.join(root, 'v4/data'));   // 읽은 표는 얼어 있다(Object.freeze) — run.js --inject 처럼 원본 사본을 고쳐 다시 읽는다
  if (THR < 99) {
    const raw = JSON.parse(JSON.stringify(db.raw));
    for (const [ev, lab] of Object.entries(HOLDS)) {
      const row = raw.events.find((e) => e.id === ev); const c = row && row.choices.find((x) => x.label === lab);
      if (!c) throw new Error('선택지 없음 ' + ev + '/' + lab);
      c.req = Object.assign({}, c.req || {}, { cond: `karma<${THR}`, why: '몸이 더 버티지 못한다' });
    }
    db = T.load(raw);
  }
  const runs = [];
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); }
  const a = S.aggregate(db, runs);
  const per = BLOCKS.map((b0, i) => S.aggregate(db, runs.slice(i * N, (i + 1) * N)).survived);
  process.send({ name, a: { survived: a.survived, deathRate: a.deathRate, deaths: a.deaths, forced: a.forced, forcedTraced: a.forcedTraced, unwarned: a.unwarned, byForced: a.byForced, top: a.topCause, allDead: a.allDead, karma: a.karma, byCause: a.byCause }, per }, () => process.exit(0));
} else {
  const out = {}; let live = 0; const q = pols.slice();
  const done = () => {
    console.log(`문턱 karma<${THR} 일 때만 '버틴다'가 열림 (메모리 시험, ${N}판 × ${BLOCKS.length}블록)`);
    console.log('| 정책 | 생존% | 블록별 생존% | 사망 | 강제 사망 | 그중 앞선 자유 경고 선택 있음 | 경고 없는 사망 | 전멸% | 사인 1위 |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const p of pols) { const { a, per } = out[p]; console.log(`| ${p} | ${a.survived} | ${per.join(' / ')} | ${a.deaths} | ${a.forced} | ${a.forcedTraced} | ${a.unwarned} | ${a.allDead} | ${a.top.k} ${a.top.share}% |`); }
    for (const p of pols) { const { a } = out[p]; if (a.forced) console.log(`- ${p} 강제: ` + Object.entries(a.byForced).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(' · ')); }
  };
  const next = () => {
    if (!q.length && !live) { done(); return; }
    while (live < 8 && q.length) {
      const p = q.shift(); live++;
      const ch = fork(__filename, [String(THR), String(N), `--worker=${p}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      ch.on('message', (m) => { out[m.name] = m; });
      ch.on('exit', () => { live--; next(); });
    }
  };
  next();
}
