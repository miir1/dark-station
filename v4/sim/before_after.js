// 어두운 역 v4 — 고치기 전·후 다섯 수치 비교 (2026-10-24 회의 P0-E2 재측정)
// 두 판본(예: 지금 커밋을 내보낸 폴더 / 지금 작업 폴더)의 엔진·봇·표를 각각 읽어 같은 시드로 돌리고 다섯 수치를 잰다.
// 봇 코드를 고치지 않고 재려고 엔진의 dispatch 를 감싸서 본다(그 판본의 bots.js 가 E.dispatch 를 부르는 그대로).
//
//   node v4/sim/before_after.js measure --root=<v4 폴더> --label=before --json=<저장할 json> [--n=200] [--blocks=1,1001,2001] [정책,정책…]
//     --per-object  지금 봇의 아침 조사를 옛 꼴(물건 하나씩)로 — 같은 데이터에서 칸 단위 조사의 몫만 따로 잴 때
//   node v4/sim/before_after.js table --before=<json> --after=<json> [--out=<txt>]
//
// 다섯 수치 (정책별, 블록을 합친 값 + 블록별 범위):
//   사망%      당신이 죽었거나 올라간 판
//   발견%      밤 사건 흔적 발견율 (night.discovery: 찾은 수 / 밤 사건 수) — 합격 기준은 게으름(lazy) ≥ 31.6%
//   굶주림     아침(trace 단계)마다 잰 당신 굶주림의 판 평균
//   함께센다%  D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 중 '함께 센다'를 고른 비율 (D3셈% = 간 판)
//   날         판 길이 (끝난 날의 평균)
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const mode = args[0];
const D3 = /^trial_d3_count(_|$)/;
const TOGETHER = '함께 센다';
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const avg = (a) => (a.length ? Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length) / 100 : 0);

function measure(root, n, blocks, only, label) {
  const T = require(path.join(root, 'engine', 'tables.js'));
  const E = require(path.join(root, 'engine', 'engine.js'));
  const NIGHT = require(path.join(root, 'engine', 'night.js'));
  const B = require(path.join(root, 'sim', 'bots.js'));
  const db = T.loadDir(path.join(root, 'data'));
  if (args.includes('--per-object')) { if (!B.OPT || !('perObject' in B.OPT)) throw new Error('--per-object: 이 판본의 bots.js 에 OPT.perObject 가 없다'); B.OPT.perObject = true; }   // 옛 아침 조사(물건 하나씩)
  // dispatch 감싸기: 아침 굶주림 표본 · D3 셈 선택
  const raw = E.dispatch;
  let cur = null;
  E.dispatch = function (s, a, d) {
    if (cur && s.phase === 'trace' && !cur.sampled[s.day]) { cur.sampled[s.day] = true; cur.hunger.push(s.people.you.n.hunger || 0); }
    const evId = a && a.type === 'choose' && s.pending ? s.pending.id : null;
    const r = raw.call(this, s, a, d);
    if (cur && r.ok && evId && D3.test(evId) && s.lastResult && s.lastResult.event === evId) cur.d3 = s.lastResult.choice;
    return r;
  };
  const policies = Object.keys(B.POLICIES).filter((p) => !only.length || only.includes(p));
  const out = { root, n, blocks, policies: {}, data: { events: db.eventsList.length, nights: db.nightEvents.length } };
  const t0 = Date.now();
  for (const pol of policies) {
    const per = blocks.map((b0) => {
      const runs = [];
      for (let seed = b0; seed < b0 + n; seed++) {
        cur = { sampled: {}, hunger: [], d3: null };
        const { s } = B.play(db, seed, pol);
        if (!cur.sampled[s.day] && s.phase === 'trace') cur.hunger.push(s.people.you.n.hunger || 0);
        const you = s.people.you;
        const disc = NIGHT.discovery(s);
        runs.push({ dead: you.status === 'dead' || you.status === 'ascended', found: disc.found, nights: s.nightLog.filter((e) => e.role !== 'clock').length,
          hunger: cur.hunger.length ? cur.hunger.reduce((x, y) => x + y, 0) / cur.hunger.length : null, d3: cur.d3, days: s.day });
      }
      return agg(runs);
    });
    out.policies[pol] = { all: agg(per.flatMap((p) => p.runs)), blocks: per.map((p) => { const { runs, ...rest } = p; void runs; return rest; }) };
    delete out.policies[pol].all.runs;
    process.stderr.write(`${label || root} ${pol} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  E.dispatch = raw;
  out.seconds = Math.round((Date.now() - t0) / 100) / 10;
  return out;
}
function agg(runs) {
  const reached = runs.filter((r) => r.d3 != null);
  return { runs, n: runs.length, death: pct(runs.filter((r) => r.dead).length, runs.length),
    discovery: pct(runs.reduce((a, r) => a + r.found, 0), runs.reduce((a, r) => a + r.nights, 0)),
    hunger: avg(runs.filter((r) => r.hunger != null).map((r) => r.hunger)),
    d3Reached: pct(reached.length, runs.length), d3Together: pct(reached.filter((r) => r.d3 === TOGETHER).length, reached.length),
    days: avg(runs.map((r) => r.days)) };
}

function table(before, after) {
  const pols = Object.keys(after.policies).filter((p) => before.policies[p]);
  const rng = (bl, k) => { const v = bl.map((b) => b[k]); return `${Math.min(...v)}~${Math.max(...v)}`; };
  const cell = (b, a, k, unit) => { const d = Math.round((a.all[k] - b.all[k]) * 100) / 100; return `${b.all[k]}${unit} → ${a.all[k]}${unit} (${d >= 0 ? '+' : ''}${d}) [블록 ${rng(a.blocks, k)}]`; };
  const L = [];
  L.push(`# 엔진 재측정 — 고치기 전·후 다섯 수치 (P0-E2, ${new Date().toLocaleString('sv-SE', { hour12: false }).slice(0, 16)})`);
  L.push('');
  L.push(`고치기 전 = 지금 커밋(HEAD)의 v4/engine·v4/data·v4/sim 을 내보낸 폴더 (사건 ${before.data.events}, 밤 사건 ${before.data.nights})`);
  L.push(`고친 뒤 = 지금 작업 폴더 (데이터 P0-D1·D2 + 엔진 P0-E1·E2, 봇 아침 조사 칸 단위) (사건 ${after.data.events}, 밤 사건 ${after.data.nights})`);
  L.push(`정책마다 ${after.n}판 × 시드 블록 ${after.blocks.length}개 (${after.blocks.map((b) => `${b}~${b + after.n - 1}`).join(', ')}) = ${after.n * after.blocks.length}판. 같은 시드. 칸 = 전 → 후 (차이) [고친 뒤 블록별 범위].`);
  L.push('');
  const head = ['정책', '당신 사망%', '흔적 발견%', '평균 굶주림(아침)', "D3 '함께 센다'%", '판 길이(날)'];
  L.push(`| ${head.join(' | ')} |`);
  L.push(`|${head.map(() => '---').join('|')}|`);
  for (const p of pols) {
    const b = before.policies[p], a = after.policies[p];
    L.push(`| ${p} | ${cell(b, a, 'death', '')} | ${cell(b, a, 'discovery', '')} | ${cell(b, a, 'hunger', '')} | ${cell(b, a, 'd3Together', '')} (D3셈 ${b.all.d3Reached}→${a.all.d3Reached}) | ${cell(b, a, 'days', '')} |`);
  }
  L.push('');
  const lazyA = after.policies.lazy, lazyB = before.policies.lazy, balA = after.policies.balanced, balB = before.policies.balanced;
  if (lazyA && lazyB) L.push(`- 게으른 봇(lazy) 흔적 발견율: ${lazyB.all.discovery}% → ${lazyA.all.discovery}% (블록 ${rng(lazyA.blocks, 'discovery')}) — 기준 ≥ 31.6%: ${Math.min(...lazyA.blocks.map((x) => x.discovery)) >= 31.6 ? '통과(모든 블록)' : lazyA.all.discovery >= 31.6 ? '합친 값은 통과, 블록 하나 이상 미달' : '미달'}`);
  if (balA && balB) { const d = Math.round((balA.all.death - balB.all.death) * 10) / 10; L.push(`- 균형 봇(balanced) 당신 사망률: ${balB.all.death}% → ${balA.all.death}% (${d >= 0 ? '+' : ''}${d}%p) — ${d < -3 ? '3%p 넘게 떨어짐: 원인 보고 필요' : '3%p 넘게 떨어지지 않음'}`); }
  for (const p of pols) { const d = Math.round((after.policies[p].all.death - before.policies[p].all.death) * 10) / 10; if (d < -3) L.push(`  - ${p}: 사망률 ${d}%p (3%p 넘게 떨어짐)`); }
  L.push(`- 걸린 시간: 전 ${before.seconds}초 · 후 ${after.seconds}초`);
  return L.join('\n') + '\n';
}

if (require.main === module && mode === 'measure') {
  const root = path.resolve(opt('root', path.join(__dirname, '..')));
  const n = +opt('n', 200);
  const blocks = opt('blocks', '1,1001,2001').split(',').map((x) => Math.max(1, Math.floor(+x))).filter(Number.isFinite);
  const only = (args.slice(1).find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || '').split(',').filter(Boolean);   // 첫 낱말(measure)은 빼고
  const res = measure(root, n, blocks, only, opt('label', ''));
  res.label = opt('label', '');
  const json = opt('json', '');
  if (json) fs.writeFileSync(json, JSON.stringify(res, null, 1));
  else console.log(JSON.stringify(res, null, 1));
} else if (require.main === module && mode === 'table') {
  const before = JSON.parse(fs.readFileSync(opt('before'), 'utf8'));
  const after = JSON.parse(fs.readFileSync(opt('after'), 'utf8'));
  const txt = table(before, after);
  if (opt('out', '')) fs.writeFileSync(opt('out'), txt, 'utf8');
  console.log(txt);
} else if (require.main === module) {
  console.error('쓰는 법: node v4/sim/before_after.js measure --root=<v4 폴더> --json=<파일> | table --before=<json> --after=<json> [--out=<txt>]');
  process.exit(2);
}

module.exports = { measure, table, agg };
