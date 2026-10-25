// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001] [--a4blocks=9] [--workers=8] [--all-objects] [--lazy-blank]
// 정책 × 판수 × 시드 블록을 돌려 표를 찍고, --report 면 v4/sim/report_<날짜><suffix>.md 에 쓴다 (C:\dev\dark_station 에서 실행).
//   정책 이름 = bots.POLICIES 의 키(밑줄 허용: selfish_rt0,h_random). 기본 = 전부(성향 봇·조사·모험·이기적 4종·사람 흉내 6종)
//   --blocks   시드 블록 시작값들(쉼표). 기본 1,1001,2001,3001,8001 (10-24 검토 지적 12: 4블록 이상 · 10-25 최종판: 표본 운을 줄이려 새 블록 8001 을 더해 5블록 —
//              8001 은 10-27 보고서 §3-1 의 '새 블록'이다. A4 정책만 더 도는 4001~7001 과 겹치지 않게 골랐다). 합격선은 블록마다 따로 재서 범위로 보고한다
//   --workers  정책을 나눠 동시에 돌리는 프로세스 수(기본 = 정책 수와 CPU−1 중 작은 것, 1 = 한 프로세스). 결과는 같다(정책마다 시드가 같다)
//   --seed0    블록 하나만, 이 시드부터 N판 (예: --seed0=2001 → 2001~2000+N). --blocks 가 있으면 무시
//   --a4blocks A4 게으름의 값을 재는 정책(보통·게으름·부지런 — bots.GROUPS.a4)만 블록을 이만큼까지 더 돈다(기본 9, 10-24 검증 A4-5: 4블록에서 ✓ 이던 줄이 8블록에서 깨졌다 · 10-25 기본 블록이 5개가 되어 8 → 9).
//              더 도는 블록 = 첫 블록 + 1000씩 올라가며 아직 안 쓴 시작값(10-25: 전에는 마지막 블록 + 1000씩 — 기본 블록에 8001 이 들어가 4001~7001 이 빠지지 않게).
//              기본이면 4001·5001·6001·7001 → A4 블록 9개 = 1~8001 (10-24~27 의 8블록 + 8001). 합격선 표의 A4 줄은 이 블록 전부로 판정하고, 블록 값은 따로 'A4 (블록 N개)' 표에 싣는다. 1 이하·블록 수 이하면 더 돌지 않는다
//   --all-objects  봇 아침 조사가 화면에서 못 닿는 물건(화로·역무실 안·서하 머리맡)도 본다 — 10-24 검증 전 판단(비교용)
//   --lazy-blank   게으름 봇이 명부를 늘 빈칸으로 둔다 — 10-24 검증 전 규칙(비교용)
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
OPT.allObjects = args.includes('--all-objects');   // 화면에서 못 닿는 물건도 조사 (10-24 검증 A4-5 전)
OPT.lazyBlank = args.includes('--lazy-blank');     // 게으름이 명부를 늘 빈칸 (10-24 검증 A4-5 전)
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
const DEFAULT_BLOCKS = ['1', '1001', '2001', '3001', '8001'];   // (10-25) 5블록 — 머리 설명 참고
const blocks = (opt('blocks') ? opt('blocks').split(',') : opt('seed0') ? [opt('seed0')] : DEFAULT_BLOCKS).map((x) => Math.max(1, Math.floor(+x))).filter((x, i, a) => Number.isFinite(x) && a.indexOf(x) === i);
if (!blocks.length) throw new Error('--blocks / --seed0: 시드 시작값이 없다');
// A4 정책만 더 도는 블록 (10-24 검증 A4-5) — 첫 블록 + 1000씩, 아직 안 쓴 시작값 (10-25)
const A4_N = opt('a4blocks') ? Math.max(1, Math.floor(+opt('a4blocks')) || 1) : 9;
const a4Extra = [];
for (let b = blocks[0] + 1000; blocks.length + a4Extra.length < A4_N; b += 1000) if (!blocks.includes(b)) a4Extra.push(b);
const a4Blocks = blocks.concat(a4Extra);
const isA4 = (name) => GROUPS.a4.includes(name);
const blocksOf = (name) => (isA4(name) ? a4Blocks : blocks);
const blockName = (b0) => `시드 ${b0}~${b0 + N - 1}`;

// 한 정책을 모든 블록에서 돌린다 → { perBlock: [[measure…]…], sample: 첫 블록 첫 판의 상태(--sample 일 때만) }
function runPolicy(name, wantSample) {
  let sample = null;
  const perBlock = blocksOf(name).map((b0, bi) => {
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
const a4ByBlock = a4Blocks.map(() => ({})); const a4All = {};   // A4 정책의 블록 전부(--a4blocks) — A4 줄 판정용
const results = await runAll();
for (const name of names) {
  const r = results[name];
  if (r.sample) samples[name] = r.sample;
  r.perBlock.forEach((runs, bi) => { const a = S.aggregate(db, runs); if (bi < blocks.length) byBlock[bi][name] = a; if (isA4(name)) a4ByBlock[bi][name] = a; });
  aggs[name] = S.aggregate(db, [].concat(...r.perBlock.slice(0, blocks.length)));   // 정책별 표 = 기본 블록을 합친 값 (A4 정책의 더 돈 블록은 A4 표에만)
  if (isA4(name)) a4All[name] = S.aggregate(db, [].concat(...r.perBlock));
}
const ms = Date.now() - t0;
const candIds = db.identity.candidates.map((c) => c.id);
const gates = byBlock.map((a) => S.gate(a, candIds, CAREFUL));
const combined = S.combine(gates);
const gateAll = S.gate(aggs, candIds, CAREFUL);   // 참고 열: 모든 블록을 합친 값으로 잰 실측(판정은 블록별)
// A4 줄은 A4 정책의 블록 전부로 판정한다 (10-24 검증 A4-5). gate 의 줄 순서는 정책 묶음과 상관없이 같다
const A4_ROW = /^( {2})?A4 /;   // A4 판정 줄 + (10-24 tightrope §2-3) '  A4 측정:' 줄 — 둘 다 A4 정책의 블록 전부로 잰다
const a4On = a4Extra.length > 0 && GROUPS.a4.every((k) => names.includes(k));
const a4Comb = a4On ? S.combine(a4ByBlock.map((a) => S.gate(a, candIds, CAREFUL))) : null;
const a4Pool = a4On ? S.gate(a4All, candIds, CAREFUL) : null;
if (a4On) combined.forEach((r, i) => { if (A4_ROW.test(r.k)) { r.mark = a4Comb[i].mark; r.okAll = a4Comb[i].okAll; r.near = a4Comb[i].near; r.a4 = a4Comb[i].got; r.a4Pool = a4Pool.rows[i][2]; } });

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
  // (10-26 고침) 옛 보고서가 여러 블록이면 c[3](첫 블록)만 읽어 '이전 실측'이 블록 하나로 보였다 — 머리줄을 읽어
  //   '합산' 열이 있으면 그것, 없으면 실측 열 전부(' ; ' 로 잇는다, 같으면 하나, 길면 첫 블록 + 블록 수), 끝에 그 보고서의 판정 [✓/△/✗] 을 붙인다. §3 이후 표는 읽지 않는다.
  let hdr = null;
  for (const ln of sec.split('\n').slice(1)) {
    if (/^## /.test(ln)) break;
    const c = ln.split('|').map((x) => x.trim());
    if (c[1] === '항목') { hdr = c; continue; }
    if (!(c.length >= 5 && c[1] && !/^-+$/.test(c[1]))) continue;
    const sumAt = hdr ? hdr.indexOf('합산') : -1, markAt = hdr ? hdr.indexOf('판정') : -1;
    const meas = hdr ? hdr.map((h, j) => (/^실측/.test(h) ? j : -1)).filter((j) => j >= 0) : [3];
    let v;
    if (sumAt > 0) v = `${c[sumAt]} (합산)`;
    else if (meas.length <= 1) v = c[meas[0] || 3];
    else { const vs = meas.map((j) => c[j]); const j1 = vs.join(' ; '); v = vs.every((x) => x === vs[0]) ? vs[0] : j1.length <= 60 ? j1 : `${vs[0]} (첫 블록, 모두 ${vs.length}블록)`; }
    gate[c[1]] = v + (markAt > 0 && c[markAt] ? ` [${c[markAt]}]` : '');
  }
  const head = (txt.split(/^## 1\. 정책별 표/m)[1] || '').split('\n');
  let cols = null;
  for (const ln of head) { const c = ln.split('|').map((x) => x.trim()); if (c[1] === '정책') cols = c; else if (cols && c.length > 3 && POLICIES[c[1]]) pol[c[1]] = { survived: c[cols.indexOf('생존%')], death: c[cols.indexOf('사망%')], train: c[cols.indexOf('열차%')], disc: c[cols.indexOf('발견%')], hymn: c[cols.indexOf('찬가발견%')], explicit: c[cols.indexOf('explicit')] }; else if (cols && !ln.startsWith('|')) break; }
  return { name: label || path.basename(p).replace(/^report_|\.md$/g, ''), gate, pol };
}
const compares = (opt('compare') || '').split(',').filter(Boolean).map(readReport).filter(Boolean);
// 합격선 이름이 바뀐 줄은 옛 이름으로도 찾는다
const ALIAS = { '찬가 발견율 (부지런)': ['찬가 발견율 (부지런 / 게으름)'], '찬가 발견율 (게으름)': ['찬가 발견율 (부지런 / 게으름)'],
  '사망 중 경고 있던 선택 (실질: 강제 사망은 경고 없음)': ['사망 중 경고 있던 선택'], '경고 없는 사망 (전 정책 합산, 강제 사망 포함)': ['경고 없는 사망 (전 정책 합산)'],   // 10-22 실질 기준으로 바뀐 줄
  // (10-26 고침) 10-24 에 이름만 바뀐 줄 — 옛 보고서 비교 열이 '—' 로 비었다
  '강제 사망 (전 정책 합산)': ['강제 사망 비율 (전 정책 합산)'], '밤 사건 수 / 판 (주민 사건만 — 시계·방치 판정 줄 뺌)': ['밤 사건 수 / 판'],
  '정체 분포 (옛 방식: 정책 전체 평균, 각 후보)': ['정체 분포 (정책 합산, 각 후보)'], '옛 방식: 7후보 중 ≥7% 인 후보 수': ['정체: 7후보 중 ≥5가 각 ≥7%'],
  // (10-24 검증 고침) 이름이 바뀐 줄 — 옛 줄과 재는 법이 다르면 '옛 방식' 참고 줄에 옛 값을 붙인다
  '참고: 사람 흉내 평균 (옛 방식 — 프롤로그 사망 포함) · 프롤로그(D0) 사망 판 비율': ['정체 — 사람 흉내 평균, 각 후보 (A3)'],
  '참고: 같은 값 — 성향 봇 8종 / 사람 흉내(h_random 뺌) / 전 정책 합산(옛 줄)': ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌)'],
  'A1 이른 안전: D1~D4 생존 − 균형 (버릇 없는 이기적 각각)': ['A1 이른 안전: 이기적 D1~D4 생존 − 균형'],
  'A1 이기심의 값: 열흘 생존 − 균형 (버릇 없는 이기적 각각 — selfish_nb·selfish_rt0)': ['A1 이기심의 값: 열흘 생존 − 균형 (이기적 4종 각각 — 버릇 없는·끝까지 금기 포함)'],
  'A1 이기적 사인 쏠림 (버릇 없는 이기적, 사망 ≥ 10%인 정책만)': ['A1 이기적 4종 사인 쏠림 (한 사건 비중)'],
  // (10-24 tightrope) 정의가 바뀐 줄 — 옛 값은 옛 정의(강제 = 위험 0 출구 없음 · A2 = D2~D6 날마다)로 잰 것
  '강제 사망 = 확정 사망 (고를 때 열린 선택지 전부 살 확률 0, 전 정책 합산)': ['강제 사망 (전 정책 합산)', '강제 사망 비율 (전 정책 합산)'],
  'A2 D2·D4·D5 날마다 그날 사건으로 죽은 판 (조심형 합산 — 신중한 플레이어, 깔때기 사건 뺌)': ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (조심형 합산 — 신중한 플레이어, 깔때기 사건 뺌)', 'A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌)'],
  // (10-25 최종판) A1 아슬함 합격선 = 화면 ≤ 85% 줄타기만 — 옛 보고서의 측정 줄 '느껴지는 아슬함'이 같은 값이다. 옛 합격선(줄타기 전부)은 참고 줄로
  'A1 아슬함: 화면 ≤ 85% (죽을 확률 ≥ 15%) 줄타기 넘김/판 (열흘 산 판, selfish_nb)': ['A1 느껴지는 아슬함: 화면 ≤ 85% (죽을 확률 ≥ 15%) 줄타기 넘김/판 (열흘 산 판, selfish_nb)'],
  'A1 아슬함: 산 판 중 화면 ≤ 85% 줄타기 ≥ 2번 넘김 (selfish_nb)': ['A1 느껴지는 아슬함: 산 판 중 화면 ≤ 85% 줄타기 ≥ 2번 넘김 (selfish_nb)'],
  '참고: 줄타기 판정 전부(90% 넘는 판정 포함 — 10-24 옛 A1 아슬함) 넘김/판 · 산 판 중 ≥ 2번 (selfish_nb)': ['A1 아슬함: 줄타기 판정 넘김/판 (열흘 산 판, selfish_nb)'] };
// 조심형 봇 사망 줄은 이름에 정책 목록이 들어 있어(10-24 selfish_nb 가 더해짐) 앞머리로 찾는다
const prevOf = (cmp, k0) => { const k = k0.trim(); if (cmp.gate[k] !== undefined) return cmp.gate[k]; const a = (ALIAS[k] || []).map((x) => cmp.gate[x]).find((v) => v !== undefined); if (a !== undefined) return a; if (k.startsWith('조심형 봇 사망 (')) { const o = Object.keys(cmp.gate).find((x) => x.startsWith('조심형 봇 사망 (')); if (o) return `${cmp.gate[o]} (옛 묶음 ${o.slice(10, -1)})`; } return '—'; };

const cols = ['생존%', '사망%', '굶주림비중%', '실질경고%', '강제%', '열차%', '전멸%', '밤사건', '시계', 'malice', 'hymn', '발견%', '모름≥1%', '찬가발견%', 'explicit', '결정/일', '빈칸%', '원정', '날', '굶주림', 'D3셈%', '함께센다%'];
const row = (a) => [a.survived, a.deathRate, a.deaths ? a.starveShare : '-', a.deaths ? a.warnedRate : '-', a.deaths ? a.forcedRate : '-', a.train, a.allDead, a.nights, a.clock, a.malice, a.hymn, a.discovery, a.unknownOk, a.hymnDiscovery, a.explicit, a.decisions, a.blank, a.trips, a.days, a.hunger, a.d3Reached, a.d3Reached ? a.d3Together : '-'];
let md = `# 봇 보고서 — 정책 ${names.length} × ${N}판 × 시드 블록 ${blocks.length} (${TODAY})\n\n`;
md += `데이터: v4/data (밤 사건 ${db.nightEvents.length}, 사건 ${db.eventsList.length}, 후보 ${db.identity.candidates.length}). 시드 블록: ${blocks.map(blockName).join(', ')}. 걸린 시간 ${(ms / 1000).toFixed(1)}초. 규칙·데이터는 손대지 않았다.`;
if (injected.length) md += ` **메모리에서만 더한 행: ${injected.join(', ')}** (표 파일은 그대로).`;
if (OPT.peek) md += ' **봇 조사 판단: 옛 판단(--peek).**';
if (OPT.perObject) md += ' **봇 아침 조사: 옛 물건 하나씩(--per-object).**';
if (OPT.allObjects) md += ' **봇 아침 조사: 화면에서 못 닿는 물건도(--all-objects, 10-24 검증 전).**';
if (OPT.lazyBlank) md += ' **게으름 봇 명부: 늘 빈칸(--lazy-blank, 10-24 검증 전).**';
if (a4Extra.length) md += ` A4 정책(${GROUPS.a4.join('·')})은 블록 ${a4Blocks.length}개(더 돈 블록: ${a4Extra.map(blockName).join(', ')}) — 정책별 표·블록별 표는 기본 블록만, A4 줄 판정과 'A4 (블록 ${a4Blocks.length}개)' 표는 전부.`;
md += '\n\n';
md += `## 1. 정책별 표 (블록 ${blocks.length}개를 합친 ${N * blocks.length}판)\n| 정책 | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${row(aggs[name]).join(' | ')} |\n`;
md += `\n굶주림 = 아침마다 잰 당신 굶주림의 판 평균(10-24 추가) · D3셈% = D3 밤 셈(trial_d3_count·_b·_c)까지 간 판 · 함께센다% = 그중 '함께 센다'를 고른 비율. 아침 조사는 칸 단위(10-24 P0-E2: 그 칸의 물건 전부, 조사 수 = 칸 수).\n`;
md += `\n정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대) / steward 몫+손−이름+(정체 inspector 쪽 성향, 10-23 추가). 조심형(합격선 따로 집계) = ${CAREFUL.join('·')}.\n`;
for (const name of names) md += `- ${name} 사망 원인: ` + (Object.entries(aggs[name].byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음') + (aggs[name].unwarned ? ` (경고 없는 죽음 ${aggs[name].unwarned})` : '') + (aggs[name].deadlyPick ? ` [평범한 대안 두고 죽음 글 선택 ${aggs[name].deadlyPick}]` : '')
  + (aggs[name].forced ? ` — 강제 ${aggs[name].forced}: ` + Object.entries(aggs[name].byForced).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') : '') + '\n';
md += `\n강제 = 확정 사망 — 고를 때 열린 선택지 전부 살 확률 0 (10-24 tightrope R1, 살 확률 > 0 인 주사위가 하나라도 열려 있으면 강제가 아니다 · 옛 정의 '죽지 않는 열린 선택지 0개'는 아래 '줄타기·발견 지표' 표의 '옛 강제'). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택). 실질경고% = 사망 중 '경고 글이 있고 강제가 아닌' 선택으로 죽은 비율(10-22 리드 결정: 강제 사망은 경고 있음으로 세지 않는다). 둘 다 엔진의 사인 기록(ended.cause.forced·free)에서 읽는다.\n`;
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
// ── 10-24 tightrope 표: 확정 사망 · 아슬함 · 실제 발견율 ──
const dash = (v, u) => (v == null || !Number.isFinite(v) ? '-' : `${v}${u || ''}`);
const FELT = require('../engine/engine.js').ROPE_FELT_MAX;   // (tightrope 검증) 느껴지는 줄타기 = 화면 % ≤ 85
md += `\n### 줄타기·발견 지표 (10-24 tightrope, 블록 합산 — '산 판' = 열흘을 산 판)\n| 정책 | 확정 사망 | 옛 강제(위험 0 출구 없음) | 경고 없는 사망 | 줄타기 굴림/판 | 줄타기 넘김/판 (산 판) | 산 판 중 줄타기 ≥2번% | 느껴지는 줄타기(≤${FELT}%) 넘김/판 (산 판) · 넘김 중 비중 | 산 판 중 느껴지는 줄타기 ≥2번% | 죽음 판정 넘김/판 (산 판) | 줄타기로 죽은 판 | 눈먼 새벽/판 · 그 죽음 | 실제 발견% | 옛 발견% | 누구나 아는 밤/판 · 숨은 밤/판 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const name of names) { const a = aggs[name]; md += `| ${name} | ${a.forced} | ${a.noSafeDeaths} | ${a.unwarned} | ${dash(a.ropeRolls)} | ${dash(a.ropeCloseSurv)} | ${dash(a.ropeClose2, '%')} | ${dash(a.ropeFeltSurv)} · ${dash(a.ropeFeltShare, '%')} | ${dash(a.ropeFelt2, '%')} | ${dash(a.closeCallsSurv)} | ${a.ropeDeaths} | ${dash(a.blindMet)} · ${a.blindDeaths} | ${dash(a.discReal, '%')} | ${dash(a.discovery, '%')} | ${dash(a.pubNights)} · ${dash(a.privNights)} |\n`; }
md += `\n확정 사망 = 고를 때 열린 선택지 전부 살 확률 0 (R1 — 엔진 ended.cause.forced). 옛 강제 = 당신이 죽지 않는 열린 선택지 0개(카르마 판의 줄타기는 일부러 그렇다). 줄타기 = rope 칸이 얹힌 판정(엔진 s.stats.ropeRolls·ropeClose), 느껴지는 줄타기 = 그중 화면 % ≤ ${FELT}(죽을 확률 ≥ ${100 - FELT}%)인 판정(ropeFeltRolls·ropeFelt — 90% 넘는 판정은 넘겨도 아슬하게 느껴지기 어렵다, 10-24 tightrope 검증 · **10-25 부터 A1 아슬함 합격선은 이 값**) · 넘김 중 비중 = 산 판 줄타기 넘김 가운데 느껴지는 줄타기의 몫, 죽음 판정 = 실패가 당신을 죽이는 모든 판정(deathRolls·closeCalls). 실제 발견% = 누구나 아는 밤(public·kill)을 뺀 주민 사건 가운데 발견한 비율 — 옛 발견%(발견%) 옆에 싣는다.\n`;
// ── 10-25 P1-11 원정 수납 표 (표에 수납·조사 원정 사건이 없으면 모두 0) ──
md += `\n### 원정 수납 (P1-11, 블록 합산 — 판 평균)\n| 정책 | 원정 | 원정 조사 물건 | 연 수납 | 조사로 걸린 원정 사건 |\n|---|---|---|---|---|\n`;
for (const name of names) { const a = aggs[name]; md += `| ${name} | ${a.trips} | ${dash(a.searched)} | ${dash(a.holdsOpened)} | ${dash(a.tripGated)} |\n`; }
md += `\n원정 = 원정을 나간 날 · 원정 조사 물건 = 원정 지도에서 조사한 물건(봇 tripSearch: 닫힌 수납·조사 원정 사건이 가리키는 물건) · 연 수납 = holds 를 열어 얻은 횟수(엔진 s.stats.holds) · 조사로 걸린 원정 사건 = when 에 inspect: 가 있는 원정 사건을 고른 횟수.\n`;
md += `\n원인 = 깔때기 사건(when 이 당신 부상을 보는 사건 — fever_night 등 — 과 새벽 위독)으로 죽었으면, 그 자리까지 당신을 다치게 한 출처(사건·night:밤 사건·neglect:방치 판정) 가운데 가장 많이 다치게 한 것. 아니면 사인 사건 그대로.\n`;
for (const name of names.filter((k) => aggs[k].deaths)) md += `- ${name} 원인 사건: ` + Object.entries(aggs[name].byRoot).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ') + '\n';
md += `\n### 정체 묶음 평균 (A3 분석 §5: 성향 봇 ${GROUPS.personality.filter((k) => aggs[k]).length}종 · 사람 흉내 ${GROUPS.human.filter((k) => aggs[k]).length}종, 블록 합산)\n| 묶음 | ${candIds.join(' | ')} |\n|---|${candIds.map(() => '---').join('|')}|\n`;
md += `| 성향 봇 (${GROUPS.personality.join('·')}) | ${candIds.map((c) => gateAll.idP[c]).join(' | ')} |\n| 사람 흉내 (${GROUPS.human.join('·')}) | ${candIds.map((c) => gateAll.idH[c]).join(' | ')} |\n`;
md += `\n## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±${S.MARGIN}%p 밖 / △ 블록마다 다르거나 ±${S.MARGIN}%p 안, 확정 안 함 / ✗ 모든 블록 미달)\n`;
md += `정체 '각 후보 ≥ 3%' 줄의 경계는 합격선의 절반(±1.5%p). '합산' 열은 모든 블록을 합친 실측(참고, 판정은 블록별).\n`;
md += `| 항목 | 합격선 | ${blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 합산 | 판정 |${compares.map((c) => ` ${c.name} |`).join('')}\n|---|---|${blocks.map(() => '---|').join('')}---|---|${compares.map(() => '---|').join('')}\n`;
for (const [i, r] of combined.entries()) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${r.a4 ? `${r.a4Pool} (A4 블록 ${a4Blocks.length}개 합산)` : gateAll.rows[i][2]} | ${r.mark}${r.a4 ? ` (블록 ${a4Blocks.length}개)` : ''} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\n`;
if (a4On) {
  md += `\n### A4 (블록 ${a4Blocks.length}개 — ${GROUPS.a4.join('·')}만 더 돌았다, 판정은 이 표의 블록 전부)\n| 항목 | 합격선 | ${a4Blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 합산 | 판정 |\n|---|---|${a4Blocks.map(() => '---|').join('')}---|---|\n`;
  for (const [i, r] of a4Comb.entries()) if (A4_ROW.test(r.k) || /^ {2}못 본 일/.test(r.k)) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${a4Pool.rows[i][2]} | ${r.mark} |\n`;
  md += `\nA4 정책 합산 (블록 ${a4Blocks.length}개): ` + GROUPS.a4.map((k) => `${k} 생존 ${a4All[k].survived}% · D9 주민 ${a4All[k].home9} · D7 자원 ${a4All[k].res7} · 못 본 일/판 ${a4All[k].neglect} · 발견 ${a4All[k].discovery}%`).join(' / ') + '\n';
}

console.log(md);
if (report) {
  const out = opt('out') ? path.resolve(opt('out')) : path.join(__dirname, `report_${TODAY}${suffix}.md`);   // --out=경로: 이름을 정해 쓴다
  fs.writeFileSync(out, md + '\n<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->\n', 'utf8');
  console.log('written', out);
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ blocks, a4Blocks, aggs, byBlock, a4All, a4ByBlock, gate: combined }, null, 1));   // --json=경로 (봇 수치를 다른 도구로 볼 때)
// 표본 한 판의 밤 사건 (틀 확인용)
if (args.includes('--sample') && samples[names[0]]) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }
})().catch((e) => { console.error(e); process.exit(1); });
