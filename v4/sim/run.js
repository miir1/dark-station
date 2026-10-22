// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001]
// 정책 × 판수 × 시드 블록을 돌려 표를 찍고, --report 면 v4/sim/report_<날짜><suffix>.md 에 쓴다 (C:\dev\dark_station 에서 실행).
//   --blocks   시드 블록 시작값들(쉼표). 기본 1,1001 = 시드 1~N 과 1001~1000+N. 합격선은 블록마다 따로 재서 범위로 보고한다
//   --seed0    블록 하나만, 이 시드부터 N판 (예: --seed0=2001 → 2001~2000+N). --blocks 가 있으면 무시
//              판정: 모든 블록 통과·합격선 ±5%p 밖 = ✓ / 모든 블록 미달 = ✗ / 그 밖(블록마다 다름·±5%p 안) = △ (확정 안 함)
//   --compare  이전 보고서(들)의 합격선 표·정책별 생존/사망을 비교 열로 붙인다 (v4/sim 안의 이름 또는 경로, 쉼표로 여럿)
//   --peek     봇의 옛 '바뀐 흔적' 판단(숨은 seen 깃발을 보는 것)으로 돌린다 — 판단 변경의 영향 비교용
//   --inject   표 파일은 그대로 두고 메모리에서만 고쳐 돌린다(데이터 제안 시험용). numbers:id=값(세계 수치 행 추가, never) 또는 표:id.열=값(기존 행 한 칸), 쉼표로 여럿
const path = require('path');
const fs = require('fs');
const T = require('../engine/tables.js');
const { POLICIES, CAREFUL, OPT, play } = require('./bots.js');
const S = require('./stats.js');

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const only = (args.find((a) => /^[a-z,]+$/.test(a)) || '').split(',').filter(Boolean);
const report = args.includes('--report');
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : ''; };
const suffix = opt('suffix');
OPT.peek = args.includes('--peek');
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
const names = Object.keys(POLICIES).filter((p) => !only.length || only.includes(p));
const blocks = (opt('blocks') ? opt('blocks').split(',') : opt('seed0') ? [opt('seed0')] : ['1', '1001']).map((x) => Math.max(1, Math.floor(+x))).filter((x, i, a) => Number.isFinite(x) && a.indexOf(x) === i);
if (!blocks.length) throw new Error('--blocks / --seed0: 시드 시작값이 없다');
const blockName = (b0) => `시드 ${b0}~${b0 + N - 1}`;

const t0 = Date.now();
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

// ── 이전 보고서 읽기 (합격선 표 실측 열 · 정책별 생존%·사망%) ──
function readReport(spec) {
  const eq = spec.indexOf('=');
  const label = eq > 0 ? spec.slice(0, eq) : '';
  const file = eq > 0 ? spec.slice(eq + 1) : spec;
  const p = fs.existsSync(file) ? file : path.join(__dirname, file);
  if (!fs.existsSync(p)) return null;
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
const ALIAS = { '찬가 발견율 (부지런 / 게으름)': ['찬가 발견율 (부지런 / 게으름)'] };
const prevOf = (cmp, k0) => { const k = k0.trim(); return cmp.gate[k] !== undefined ? cmp.gate[k] : (ALIAS[k] || []).map((a) => cmp.gate[a]).find((v) => v !== undefined) || '—'; };

const cols = ['생존%', '사망%', '굶주림비중%', '경고%', '열차%', '전멸%', '밤사건', '시계', 'malice', 'hymn', '발견%', '모름≥1%', '찬가발견%', 'explicit', '결정/일', '빈칸%', '원정', '날'];
const row = (a) => [a.survived, a.deathRate, a.starveShare, a.warnedRate, a.train, a.allDead, a.nights, a.clock, a.malice, a.hymn, a.discovery, a.unknownOk, a.hymnDiscovery, a.explicit, a.decisions, a.blank, a.trips, a.days];
let md = `# 봇 보고서 — 정책 ${names.length} × ${N}판 × 시드 블록 ${blocks.length} (${new Date().toISOString().slice(0, 10)})\n\n`;
md += `데이터: v4/data (밤 사건 ${db.nightEvents.length}, 사건 ${db.eventsList.length}, 후보 ${db.identity.candidates.length}). 시드 블록: ${blocks.map(blockName).join(', ')}. 걸린 시간 ${(ms / 1000).toFixed(1)}초. 규칙·데이터는 손대지 않았다.`;
if (injected.length) md += ` **메모리에서만 더한 행: ${injected.join(', ')}** (표 파일은 그대로).`;
if (OPT.peek) md += ' **봇 조사 판단: 옛 판단(--peek).**';
md += '\n\n';
md += `## 1. 정책별 표 (블록 ${blocks.length}개를 합친 ${N * blocks.length}판)\n| 정책 | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${row(aggs[name]).join(' | ')} |\n`;
md += `\n정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 1층→2층, 거래·협정·범람수는 자원 + 최대).\n`;
for (const name of names) md += `- ${name} 사망 원인: ` + Object.entries(aggs[name].byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') + (aggs[name].unwarned ? ` (경고 없는 죽음 ${aggs[name].unwarned})` : '')
  + (aggs[name].forced ? ` — 강제 ${aggs[name].forced}: ` + Object.entries(aggs[name].byForced).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') : '') + '\n';
md += `\n강제 = 그 순간 당신이 죽지 않는 열린 선택지가 0개였던 죽음(선택지 하나뿐, 나머지가 잠긴 주사위). "←" 뒤는 그 전 마지막 자유 경고 선택(대안이 있었는데 고른 경고 선택).\n`;
if (blocks.length > 1) {
  md += `\n### 블록별 (생존% / 사망% / 열차% / 강제%)\n| 정책 | ${blocks.map(blockName).join(' | ')} |\n|---|${blocks.map(() => '---').join('|')}|\n`;
  for (const name of names) md += `| ${name} | ${byBlock.map((a) => `${a[name].survived} / ${a[name].deathRate} / ${a[name].train} / ${a[name].forcedRate}`).join(' | ')} |\n`;
}
if (compares.length) {
  md += `\n### 정책별 비교 (생존% / 사망% / 열차%)\n| 정책 | 지금 | ${compares.map((c) => c.name).join(' | ')} |\n|---|---|${compares.map(() => '---').join('|')}|\n`;
  for (const name of names) md += `| ${name} | ${aggs[name].survived} / ${aggs[name].deathRate} / ${aggs[name].train} | ${compares.map((c) => (c.pol[name] ? `${c.pol[name].survived} / ${c.pol[name].death} / ${c.pol[name].train}` : '—')).join(' | ')} |\n`;
}
md += `\n### 정체 분포 (정책별 %)\n| 정책 | ${db.identity.candidates.map((c) => c.id).join(' | ')} |\n|---|${db.identity.candidates.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${db.identity.candidates.map((c) => aggs[name].identity[c.id] || 0).join(' | ')} |\n`;
md += `\n### 당신 사망 원인 (balanced, 판 수)\n` + Object.entries(aggs.balanced ? aggs.balanced.byCause : {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n') + '\n';
md += `\n## 2. 합격선 대비 (블록마다 따로 잰다 — ✓ 모든 블록 통과·합격선 ±${S.MARGIN}%p 밖 / △ 블록마다 다르거나 ±${S.MARGIN}%p 안, 확정 안 함 / ✗ 모든 블록 미달)\n`;
md += `| 항목 | 합격선 | ${blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 판정 |${compares.map((c) => ` ${c.name} |`).join('')}\n|---|---|${blocks.map(() => '---|').join('')}---|${compares.map(() => '---|').join('')}\n`;
for (const r of combined) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${r.mark} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\n`;

console.log(md);
if (report) {
  const out = path.join(__dirname, `report_${new Date().toISOString().slice(0, 10)}${suffix}.md`);
  fs.writeFileSync(out, md + '\n<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->\n', 'utf8');
  console.log('written', out);
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ blocks, aggs, byBlock, gate: combined }, null, 1));   // --json=경로 (봇 수치를 다른 도구로 볼 때)
// 표본 한 판의 밤 사건 (틀 확인용)
if (args.includes('--sample')) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }
