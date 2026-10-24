p = r'C:\dev\dark_station\v4\sim\run.js'
t = open(p, encoding='utf8').read()


def rep(a, b, cnt=1):
    global t
    assert t.count(a) == cnt, (a[:90], t.count(a))
    t = t.replace(a, b)


rep("""// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001]
// 정책 × 판수 × 시드 블록을 돌려 표를 찍고, --report 면 v4/sim/report_<날짜><suffix>.md 에 쓴다 (C:\\dev\\dark_station 에서 실행).
//   --blocks   시드 블록 시작값들(쉼표). 기본 1,1001 = 시드 1~N 과 1001~1000+N. 합격선은 블록마다 따로 재서 범위로 보고한다""",
"""// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001] [--workers=8]
// 정책 × 판수 × 시드 블록을 돌려 표를 찍고, --report 면 v4/sim/report_<날짜><suffix>.md 에 쓴다 (C:\\dev\\dark_station 에서 실행).
//   정책 이름 = bots.POLICIES 의 키(밑줄 허용: selfish_rt0,h_random). 기본 = 전부(성향 봇·조사·모험·이기적 4종·사람 흉내 6종)
//   --blocks   시드 블록 시작값들(쉼표). 기본 1,1001,2001,3001 (10-24 검토 지적 12: 4블록 이상). 합격선은 블록마다 따로 재서 범위로 보고한다
//   --workers  정책을 나눠 동시에 돌리는 프로세스 수(기본 = 정책 수와 CPU−1 중 작은 것, 1 = 한 프로세스). 결과는 같다(정책마다 시드가 같다)""")

rep("""const path = require('path');
const fs = require('fs');
const T = require('../engine/tables.js');
const { POLICIES, CAREFUL, OPT, play } = require('./bots.js');
const S = require('./stats.js');

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\\d+$/.test(a)) || 200);
const only = (args.find((a) => /^[a-z,]+$/.test(a)) || '').split(',').filter(Boolean);""",
"""const path = require('path');
const fs = require('fs');
const os = require('os');
const T = require('../engine/tables.js');
const { POLICIES, CAREFUL, GROUPS, OPT, play } = require('./bots.js');
const S = require('./stats.js');

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\\d+$/.test(a)) || 200);
const only = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || '').split(',').filter(Boolean);""")

rep("""const names = Object.keys(POLICIES).filter((p) => !only.length || only.includes(p));
const blocks = (opt('blocks') ? opt('blocks').split(',') : opt('seed0') ? [opt('seed0')] : ['1', '1001']).map((x) => Math.max(1, Math.floor(+x))).filter((x, i, a) => Number.isFinite(x) && a.indexOf(x) === i);""",
"""const unknown = only.filter((p) => !POLICIES[p]);
if (unknown.length) throw new Error('모르는 정책: ' + unknown.join(',') + ' (있는 정책: ' + Object.keys(POLICIES).join(',') + ')');
const names = Object.keys(POLICIES).filter((p) => !only.length || only.includes(p));
const blocks = (opt('blocks') ? opt('blocks').split(',') : opt('seed0') ? [opt('seed0')] : ['1', '1001', '2001', '3001']).map((x) => Math.max(1, Math.floor(+x))).filter((x, i, a) => Number.isFinite(x) && a.indexOf(x) === i);""")

rep("""const t0 = Date.now();
const TODAY = ((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());   // 이 컴퓨터의 날짜(전에는 UTC 라 한국 아침에 하루 전 날짜가 찍혔다)
const aggs = {}; const samples = {}; const byBlock = blocks.map(() => ({}));
for (const name of names) {
  const all = [];
  blocks.forEach((b0, bi) => {
    const runs = [];
    for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); if (bi === 0 && seed === b0) samples[name] = s; }
    byBlock[bi][name] = S.aggregate(db, runs);
    all.push(...runs);
  });
  aggs[name] = S.aggregate(db, all);   // 정책별 표 = 모든 블록을 합친 값
}
const ms = Date.now() - t0;
const cands = db.identity.candidates.length;
const gates = byBlock.map((a) => S.gate(a, cands, CAREFUL));
const combined = S.combine(gates);
""",
"""// 한 정책을 모든 블록에서 돌린다 → { perBlock: [[measure…]…], sample: 첫 블록 첫 판의 상태(--sample 일 때만) }
function runPolicy(name, wantSample) {
  let sample = null;
  const perBlock = blocks.map((b0, bi) => {
    const runs = [];
    for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); if (wantSample && bi === 0 && seed === b0) sample = s; }
    return runs;
  });
  return { perBlock, sample };
}
// 일꾼 프로세스: --worker=<정책> 하나만 돌려 부모에게 보낸다
if (opt('worker')) {
  const name = opt('worker');
  const res = runPolicy(name, args.includes('--sample'));
  process.send({ name, perBlock: res.perBlock, sample: res.sample }, () => process.exit(0));
  return;   // eslint-disable-line no-unreachable (CommonJS 맨 위 return)
}
const workers = Math.max(1, Math.min(names.length, opt('workers') ? Math.floor(+opt('workers')) || 1 : Math.max(1, os.cpus().length - 1)));
function runAll() {
  if (workers <= 1) return Promise.resolve(Object.fromEntries(names.map((n, i) => [n, runPolicy(n, args.includes('--sample') && i === 0)])));
  const { fork } = require('child_process');
  const pass = args.filter((a) => !/^[a-z][a-z0-9_,]*$/.test(a) && !['--report', '--sample'].includes(a) && !/^--(out|json|workers|compare|suffix)=/.test(a));   // 일꾼에게는 판 수·블록·inject·peek 만
  const queue = names.slice(); const out = {};
  return new Promise((resolve, reject) => {
    let live = 0;
    const next = () => {
      if (!queue.length && !live) { resolve(out); return; }
      while (live < workers && queue.length) {
        const name = queue.shift(); live++;
        const ch = fork(__filename, pass.concat([`--worker=${name}`], args.includes('--sample') && name === names[0] ? ['--sample'] : []), { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        let got = false;
        ch.on('message', (m) => { if (m && m.name === name) { out[name] = { perBlock: m.perBlock, sample: m.sample }; got = true; } });
        ch.on('exit', (code) => { live--; if (!got) { reject(new Error(`일꾼 ${name} 이(가) 결과 없이 끝남 (코드 ${code})`)); return; } next(); });
      }
    };
    next();
  });
}

(async function main() {
const t0 = Date.now();
const TODAY = ((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());   // 이 컴퓨터의 날짜(전에는 UTC 라 한국 아침에 하루 전 날짜가 찍혔다)
const aggs = {}; const samples = {}; const byBlock = blocks.map(() => ({}));
const results = await runAll();
for (const name of names) {
  const r = results[name];
  if (r.sample) samples[name] = r.sample;
  r.perBlock.forEach((runs, bi) => { byBlock[bi][name] = S.aggregate(db, runs); });
  aggs[name] = S.aggregate(db, [].concat(...r.perBlock));   // 정책별 표 = 모든 블록을 합친 값
}
const ms = Date.now() - t0;
const candIds = db.identity.candidates.map((c) => c.id);
const gates = byBlock.map((a) => S.gate(a, candIds, CAREFUL));
const combined = S.combine(gates);
const gateAll = S.gate(aggs, candIds, CAREFUL);   // 참고 열: 모든 블록을 합친 값으로 잰 실측(판정은 블록별)
""")

rep("""md += `\\n## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±${S.MARGIN}%p 밖 / △ 블록마다 다르거나 ±${S.MARGIN}%p 안, 확정 안 함 / ✗ 모든 블록 미달)\\n`;
md += `| 항목 | 합격선 | ${blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 판정 |${compares.map((c) => ` ${c.name} |`).join('')}\\n|---|---|${blocks.map(() => '---|').join('')}---|${compares.map(() => '---|').join('')}\\n`;
for (const r of combined) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${r.mark} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\\n`;
""",
"""// ── 10-24 A1·A2·A4 표: 날별 사망 · 원인 사건 · 이기적·게으름 지표 ──
const DAYS = Array.from({ length: 11 }, (_, d) => d);
md += `\\n### 날별 당신 사망 (판 수, ${N * blocks.length}판 중 · 괄호 = 그날 사건으로 죽은 판, 깔때기 사건(열병·새벽 위독 등) 뺌)\\n| 정책 | ${DAYS.map((d) => `D${d}`).join(' | ')} |\\n|---|${DAYS.map(() => '---').join('|')}|\\n`;
for (const name of names) md += `| ${name} | ${DAYS.map((d) => { const a = aggs[name].byDay[d] || 0, e = aggs[name].dayEvent[d] || 0; return a ? `${a} (${e})` : '0'; }).join(' | ')} |\\n`;
md += `\\n### A1·A2·A4 지표 (블록 합산)\\n| 정책 | 생존% | D1~D4 생존% | D5까지 사망% | 산 날 | 카르마(끝) | 못 본 일/판 | 방치 줄/판 | D9 주민 | D7 자원 | 사인 1위 | 원인 1위 |\\n|---|---|---|---|---|---|---|---|---|---|---|---|\\n`;
for (const name of names) { const a = aggs[name]; md += `| ${name} | ${a.survived} | ${a.aliveD4} | ${a.deadByD5} | ${a.daysLived} | ${a.karma} | ${a.neglect} | ${a.neglectRows} | ${a.home9N ? a.home9 : '-'} | ${a.res7N ? a.res7 : '-'} | ${a.deaths ? `${a.topCause.k} ${a.topCause.share}%` : '-'} | ${a.deaths ? `${a.topRoot.k} ${a.topRoot.share}%` : '-'} |\\n`; }
md += `\\n원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.\\n`;
for (const name of names.filter((k) => aggs[k].deaths)) md += `- ${name} 원인 사건: ` + Object.entries(aggs[name].byRoot).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ') + '\\n';
md += `\\n### 정체 묶음 평균 (A3 분석 §5: 성향 봇 ${GROUPS.personality.filter((k) => aggs[k]).length}종 · 사람 흉내 ${GROUPS.human.filter((k) => aggs[k]).length}종, 블록 합산)\\n| 묶음 | ${candIds.join(' | ')} |\\n|---|${candIds.map(() => '---').join('|')}|\\n`;
md += `| 성향 봇 (${GROUPS.personality.join('·')}) | ${candIds.map((c) => gateAll.idP[c]).join(' | ')} |\\n| 사람 흉내 (${GROUPS.human.join('·')}) | ${candIds.map((c) => gateAll.idH[c]).join(' | ')} |\\n`;
md += `\\n## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±${S.MARGIN}%p 밖 / △ 블록마다 다르거나 ±${S.MARGIN}%p 안, 확정 안 함 / ✗ 모든 블록 미달)\\n`;
md += `정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).\\n`;
md += `| 항목 | 합격선 | ${blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 합산 | 판정 |${compares.map((c) => ` ${c.name} |`).join('')}\\n|---|---|${blocks.map(() => '---|').join('')}---|---|${compares.map(() => '---|').join('')}\\n`;
for (const [i, r] of combined.entries()) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${gateAll.rows[i][2]} | ${r.mark} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\\n`;
""")

rep("""if (args.includes('--sample')) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }""",
"""if (args.includes('--sample') && samples[names[0]]) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }
})().catch((e) => { console.error(e); process.exit(1); });""")
open(p, 'w', encoding='utf8').write(t)
print('ok')
