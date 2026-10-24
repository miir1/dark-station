// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001] [--workers=8]
// 정책 × 판수 × 시드 블록을 돌려 표를 찍고, --report 면 v4/sim/report_<날짜><suffix>.md 에 쓴다 (C:\dev\dark_station 에서 실행).
//   정책 이름 = bots.POLICIES 의 키(밑줄 허용: selfish_rt0,h_random). 기본 = 전부(성향 봇·조사·모험·이기적 4종·사람 흉내 6종)
//   --blocks   시드 블록 시작값들(쉼표). 기본 1,1001,2001,3001 (10-24 검토 지적 12: 4블록 이상). 합격선은 블록마다 따로 재서 범위로 보고한다
//   --workers  정책을 나눠 동시에 돌리는 프로세스 수(기본 = 정책 수와 CPU−1 중 작은 것, 1 = 한 프로세스). 결과는 같다(정책마다 시드가 같다)
//   --seed0    블록 하나만, 이 시드부터 N판 (예: --seed0=2001 → 2001~2000+N). --blocks 가 있으면 무시
//              판정: 모든 블록 통과·합격선 ±5%p 밖 = ✓ / 모든 블록 미달 = ✗ / 그 밖(블록마다 다름·±5%p 안) = △ (확정 안 함)
//   --compare  이전 보고서(들)의 합격선 표·정책별 생존/사망을 비교 열로 붙인다 (v4/sim 안의 이름 또는 경로, 쉼표로 여럿)
//   --peek     봇의 옛 '바뀐 흔적' 판단(숨은 seen 깃발을 보는 것)으로 돌린다 — 판단 변경의 영향 비교용
//   --inject   표 파일은 그대로 두고 메모리에서만 고쳐 돌린다(데이터 제안 시험용). numbers:id=값(세계 수치 행 추가, never) 또는 표:id.열=값(기존 행 한 칸), 쉼표로 여럿
const path = require('path');
const fs = require('fs');
const os = require('os');
const T = require('../engine/tables.js');
const { POLICIES, CAREFUL, GROUPS, OPT, play } = require('./bots.js');
const S = require('./stats.js');

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const only = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || '').split(',').filter(Boolean);
const report = args.includes('--report');
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : ''; };
const suffix = opt('suffix');
OPT.peek = args.includes('--peek');
OPT.perObject = args.includes('--per-object');   // 옛 아침 조사(물건 하나씩)로 비교 (10-24 P0-E2 전)
const dataDir = path.join(__dirname, '..', 'data');
let db = T.loadDir(dataDir);
const injected = [];
if (opt('inject')) {
  const raw = db.raw ? JSON.parse(JSON.stringify(db.raw)) : null;
  for (const spec of opt('inject').split(',')) {
    const m = /^numbers:([a-z0-9_]+)=(-?\d+)$/.exec(spec);
    const c = /^([A-Za-z]+):([a-z0-9_]+)\.([A-Za-z]+)=(.*)$/.exec(spec);   // 표:id.열=값 (기존 행의 한 칸)
    if (!raw || !(m || c)) throw new Error('--inject 꼴: numbers:id=값 또는 표:id.열=값');
    if (m) raw.numbers = raw.numbers.filter((r) => r.id !== m[1]).concat([{ id: m[1], owner: 'world', min: -9, max: 9, start: +m[2], perDay: 0, visible: 'never' }]);
    else { const row = (raw[c[1]] || []).find((r) => r.id === c[2]); if (!row) throw new Error('--inject: 행 없음 ' + spec); row[c[3]] = /^-?\d+$/.test(c[4]) ? +c[4] : c[4]; }
    injected.push(spec);
  }
  db = T.load(raw);
}
const unknown = only.filter((p) => !POLICIES[p]);
if (unknown.length) throw new Error('모르는 정책: ' + unknown.join(',') + ' (있는 정책: ' + Object.keys(POLICIES).join(',') + ')');
const names = Object.keys(POLICIES).filter((p) => !only.length || only.includes(p));
const blocks = (opt('blocks') ? opt('blocks').split(',') : opt('seed0') ? [opt('seed0')] : ['1', '1001', '2001', '3001']).map((x) => Math.max(1, Math.floor(+x))).filter((x, i, a) => Number.isFinite(x) && a.indexOf(x) === i);
if (!blocks.length) throw new Error('--blocks / --seed0: 시드 시작값이 없다');
const blockName = (b0) => `시드 ${b0}~${b0 + N - 1}`;

// 한 정책을 모든 블록에서 돌린다 → { perBlock: [[measure…]…], sample: 첫 블록 첫 판의 상태(--sample 일 때만) }
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

// ── 이전 보고서 읽기 (합격선 표 실측 열 · 정책별 생존%·사망%) ──
function readReport(spec) {
  const eq = spec.indexOf('=');
  const label = eq > 0 ? spec.slice(0, eq) : '';
  const file = eq > 0 ? spec.slice(eq + 1) : spec;
  const p = fs.existsSync(file) ? file : path.join(__dirname, file);
  if (!fs.existsSync(p)) { console.error(`--compare: 보고서를 못 찾음 ${file} (윈도에서는 C:/… 꼴 경로)`); return null; }
  const txt = fs.readFileSync(p, 'utf8');
  const gate = {}; const pol = {};
  const sec = txt.split(/^## 2\. 합격선 대비/m)[1] || '';
  for (const ln of sec.split('\n')) { const c = ln.split('|').map((x) => x.trim()); if (c.length >= 5 && c[1] && c[1] !== '항목' && !/^-+$/.test(c[1])) gate[c[1]] = c[3]; }
  const head = (txt.split(/^## 1\. 정책별 표/m)[1] || '').split('\n');
  let cols = null;
  for (const ln of head) { const c = ln.split('|').map((x) => x.trim()); if (c[1] === '정책') cols = c; else if (cols && c.length > 3 && POLICIES[c[1]]) pol[c[1]] = { survived: c[cols.indexOf('생존%')], death: c[cols.indexOf('사망%')], train: c[cols.indexOf('열차%')], disc: c[cols.indexOf('발견%')], hymn: c[cols.indexOf('찬가발견%')], explicit: c[cols.indexOf('explicit')] }; else if (cols && !ln.startsWith('|')) break; }
  return { name: label || path.basename(p).replace(/^report_|\.md$/g, ''), gate, pol };
}
const compares = (opt('compare') || '').split(',').filter(Boolean).map(readReport).filter(Boolean);
// 합격선 이름이 바뀐 줄은 옛 이름으로도 찾는다
const ALIAS = { '찬가 발견율 (부지런 / 게으름)': ['찬가 발견율 (부지런 / 게으름)'],
  '사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음)': ['사망 중 경고 있던 선택'], '경고 없는 사망 (전 정책 합산, 강제 사망 포함)': ['경고 없는 사망 (전 정책 합산)'] };   // 10-22 실질 기준으로 바뀐 줄
const prevOf = (cmp, k0) => { const k = k0.trim(); return cmp.gate[k] !== undefined ? cmp.gate[k] : (ALIAS[k] || []).map((a) => cmp.gate[a]).find((v) => v !== undefined) || '—'; };

const cols = ['생존%', '사망%', '굶주림비중%', '실질경고%', '강제%', '열차%', '전멸%', '밤사건', '시계', 'malice', 'hymn', '발견%', '모름≥1%', '찬가발견%', 'explicit', '결정/일', '빈칸%', '원정', '날', '굶주림', 'D3셈%', '함께센다%'];
const row = (a) => [a.survived, a.deathRate, a.deaths ? a.starveShare : '-', a.deaths ? a.warnedRate : '-', a.deaths ? a.forcedRate : '-', a.train, a.allDead, a.nights, a.clock, a.malice, a.hymn, a.discovery, a.unknownOk, a.hymnDiscovery, a.explicit, a.decisions, a.blank, a.trips, a.days, a.hunger, a.d3Reached, a.d3Reached ? a.d3Together : '-'];
let md = `# 봇 보고서 — 정책 ${names.length} × ${N}판 × 시드 블록 ${blocks.length} (${TODAY})\n\n`;
md += `데이터: v4/data (밤 사건 ${db.nightEvents.length}, 사건 ${db.eventsList.length}, 후보 ${db.identity.candidates.length}). 시드 블록: ${blocks.map(blockName).join(', ')}. 걸린 시간 ${(ms / 1000).toFixed(1)}초. 규칙·데이터는 손대지 않았다.`;
if (injected.length) md += ` **메모리에서만 더한 행: ${injected.join(', ')}** (표 파일은 그대로).`;
if (OPT.peek) md += ' **봇 조사 판단: 옛 판단(--peek).**';
if (OPT.perObject) md += ' **봇 아침 조사: 옛 물건 하나씩(--per-object).**';
md += '\n\n';
md += `## 1. 정책별 표 (블록 ${blocks.length}개를 합친 ${N * blocks.length}판)\n| 정책 | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${row(aggs[name]).join(' | ')} |\n`;
md += `\n굶주림 = 아침마다 잰 당신 굶주림의 판 평균(10-24 추가) · D3셈% = D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 · 함께센다% = 그중 '함께 센다'를 고른 비율. 아침 조사는 칸 단위(10-24 P0-E2: 그 칸의 물건 전부, 조사 수 = 칸 수).\n`;
md += `\n정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대) / steward 몫+손−이름+(정체 inspector 쪽 성향, 10-23 추가). 조심형(합격선 따로 집계) = ${CAREFUL.join('·')}.\n`;
for (const name of names) md += `- ${name} 사망 원인: ` + (Object.entries(aggs[name].byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음') + (aggs[name].unwarned ? ` (경고 없는 죽음 ${aggs[name].unwarned})` : '') + (aggs[name].deadlyPick ? ` [평범한 대안 두고 죽음 글 선택 ${aggs[name].deadlyPick}]` : '')
  + (aggs[name].forced ? ` — 강제 ${aggs[name].forced}: ` + Object.entries(aggs[name].byForced).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') : '') + '\n';
md += `\n강제 = 그 순간 당신이 죽지 않는 열린 선택지가 0개였던 죽음(선택지 하나뿐, 나머지가 잠긴 주사위). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택). 실질경고% = 사망 중 '경고 글이 있고 강제가 아닌' 선택으로 죽은 비율(10-22 리드 결정: 강제 사망은 경고 있음으로 세지 않는다). 둘 다 엔진의 사인 기록(ended.cause.forced·free)에서 읽는다.\n`;
if (blocks.length > 1) {
  md += `\n### 블록별 (생존% / 사망% / 열차% / 강제%)\n| 정책 | ${blocks.map(blockName).join(' | ')} |\n|---|${blocks.map(() => '---').join('|')}|\n`;
  for (const name of names) md += `| ${name} | ${byBlock.map((a) => `${a[name].survived} / ${a[name].deathRate} / ${a[name].train} / ${a[name].deaths ? a[name].forcedRate : '-'}`).join(' | ')} |\n`;
}
if (compares.length) {
  md += `\n### 정책별 비교 (생존% / 사망% / 열차%)\n| 정책 | 지금 | ${compares.map((c) => c.name).join(' | ')} |\n|---|---|${compares.map(() => '---').join('|')}|\n`;
  for (const name of names) md += `| ${name} | ${aggs[name].survived} / ${aggs[name].deathRate} / ${aggs[name].train} | ${compares.map((c) => (c.pol[name] ? `${c.pol[name].survived} / ${c.pol[name].death} / ${c.pol[name].train}` : '—')).join(' | ')} |\n`;
}
md += `\n### 정체 분포 (정책별 %)\n| 정책 | ${db.identity.candidates.map((c) => c.id).join(' | ')} |\n|---|${db.identity.candidates.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${db.identity.candidates.map((c) => aggs[name].identity[c.id] || 0).join(' | ')} |\n`;
md += `\n### 당신 사망 원인 (balanced, 판 수)\n` + Object.entries(aggs.balanced ? aggs.balanced.byCause : {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n') + (aggs.balanced && aggs.balanced.deaths ? '' : '- (사망 없음)') + '\n';
// ── 10-24 A1·A2·A4 표: 날별 사망 · 원인 사건 · 이기적·게으름 지표 ──
const DAYS = Array.from({ length: 11 }, (_, d) => d);
md += `\n### 날별 당신 사망 (판 수, ${N * blocks.length}판 중 · 괄호 = 그날 사건으로 죽은 판, 깔때기 사건(열병·새벽 위독 등) 뺌)\n| 정책 | ${DAYS.map((d) => `D${d}`).join(' | ')} |\n|---|${DAYS.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${DAYS.map((d) => { const a = aggs[name].byDay[d] || 0, e = aggs[name].dayEvent[d] || 0; return a ? `${a} (${e})` : '0'; }).join(' | ')} |\n`;
md += `\n### A1·A2·A4 지표 (블록 합산)\n| 정책 | 생존% | D1~D4 생존% | D5까지 사망% | 산 날 | 카르마(끝) | 못 본 일/판 | 방치 줄/판 | D9 주민 | D7 자원 | 사인 1위 | 원인 1위 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const name of names) { const a = aggs[name]; md += `| ${name} | ${a.survived} | ${a.aliveD4} | ${a.deadByD5} | ${a.daysLived} | ${a.karma} | ${a.neglect} | ${a.neglectRows} | ${a.home9N ? a.home9 : '-'} | ${a.res7N ? a.res7 : '-'} | ${a.deaths ? `${a.topCause.k} ${a.topCause.share}%` : '-'} | ${a.deaths ? `${a.topRoot.k} ${a.topRoot.share}%` : '-'} |\n`; }
md += `\n원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.\n`;
for (const name of names.filter((k) => aggs[k].deaths)) md += `- ${name} 원인 사건: ` + Object.entries(aggs[name].byRoot).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ') + '\n';
md += `\n### 정체 묶음 평균 (A3 분석 §5: 성향 봇 ${GROUPS.personality.filter((k) => aggs[k]).length}종 · 사람 흉내 ${GROUPS.human.filter((k) => aggs[k]).length}종, 블록 합산)\n| 묶음 | ${candIds.join(' | ')} |\n|---|${candIds.map(() => '---').join('|')}|\n`;
md += `| 성향 봇 (${GROUPS.personality.join('·')}) | ${candIds.map((c) => gateAll.idP[c]).join(' | ')} |\n| 사람 흉내 (${GROUPS.human.join('·')}) | ${candIds.map((c) => gateAll.idH[c]).join(' | ')} |\n`;
md += `\n## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±${S.MARGIN}%p 밖 / △ 블록마다 다르거나 ±${S.MARGIN}%p 안, 확정 안 함 / ✗ 모든 블록 미달)\n`;
md += `정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).\n`;
md += `| 항목 | 합격선 | ${blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 합산 | 판정 |${compares.map((c) => ` ${c.name} |`).join('')}\n|---|---|${blocks.map(() => '---|').join('')}---|---|${compares.map(() => '---|').join('')}\n`;
for (const [i, r] of combined.entries()) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${gateAll.rows[i][2]} | ${r.mark} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\n`;

console.log(md);
if (report) {
  const out = opt('out') ? path.resolve(opt('out')) : path.join(__dirname, `report_${TODAY}${suffix}.md`);   // --out=경로: 이름을 정해 쓴다
  fs.writeFileSync(out, md + '\n<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->\n', 'utf8');
  console.log('written', out);
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ blocks, aggs, byBlock, gate: combined }, null, 1));   // --json=경로 (봇 수치를 다른 도구로 볼 때)
// 표본 한 판의 밤 사건 (틀 확인용)
if (args.includes('--sample') && samples[names[0]]) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }
})().catch((e) => { console.error(e); process.exit(1); });
