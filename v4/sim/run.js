// node v4/sim/run.js [판수=200] [정책,정책…] [--report]
// 정책 × 판수를 돌려 표를 찍고, --report 면 v4/sim/report_<날짜>.md 에 쓴다 (C:\dev\dark_station 에서 실행).
const path = require('path');
const fs = require('fs');
const T = require('../engine/tables.js');
const { POLICIES, play } = require('./bots.js');
const S = require('./stats.js');

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const only = (args.find((a) => /^[a-z,]+$/.test(a)) || '').split(',').filter(Boolean);
const report = args.includes('--report');
const suffix = (args.find((a) => a.startsWith('--suffix=')) || '--suffix=').slice(9);
const db = T.loadDir(path.join(__dirname, '..', 'data'));
const names = Object.keys(POLICIES).filter((p) => !only.length || only.includes(p));

const t0 = Date.now();
const aggs = {}; const samples = {};
for (const name of names) {
  const runs = [];
  for (let seed = 1; seed <= N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); if (seed === 1) samples[name] = s; }
  aggs[name] = S.aggregate(db, runs);
}
const ms = Date.now() - t0;
const g = S.gate(aggs, db.identity.candidates.length);

const cols = ['생존%', '사망%', '굶주림비중%', '경고%', '열차%', '전멸%', '밤사건', '시계', 'malice', 'hymn', '발견%', '모름≥1%', '찬가발견%', 'explicit', '결정/일', '빈칸%', '원정', '날'];
const row = (a) => [a.survived, a.deathRate, a.starveShare, a.warnedRate, a.train, a.allDead, a.nights, a.clock, a.malice, a.hymn, a.discovery, a.unknownOk, a.hymnDiscovery, a.explicit, a.decisions, a.blank, a.trips, a.days];
let md = `# 봇 보고서 — 정책 ${names.length} × ${N}판 (${new Date().toISOString().slice(0, 10)})\n\n`;
md += `데이터: v4/data (밤 사건 ${db.nightEvents.length}, 사건 ${db.eventsList.length}, 후보 ${db.identity.candidates.length}). 걸린 시간 ${(ms / 1000).toFixed(1)}초. 규칙·데이터는 손대지 않았다.\n\n`;
md += `## 1. 정책별 표\n| 정책 | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${row(aggs[name]).join(' | ')} |\n`;
md += `\n정책: balanced 축 중립·보통 조사 / selfish 몫−손− / devoted 몫+손+ / silent 이름− / caller 이름+ / lazy 게으른 조사(1곳·말 0) / diligent 부지런(상한 보고용) / risky 모험(판정+경고 선택 우선 ≥35%, 원정 매일 2층 우선, 거래·협정·범람수는 자원 + 최대).\n`;
for (const name of names) md += `- ${name} 사망 원인: ` + Object.entries(aggs[name].byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') + '\n';
md += `\n### 정체 분포 (정책별 %)\n| 정책 | ${db.identity.candidates.map((c) => c.id).join(' | ')} |\n|---|${db.identity.candidates.map(() => '---').join('|')}|\n`;
for (const name of names) md += `| ${name} | ${db.identity.candidates.map((c) => aggs[name].identity[c.id] || 0).join(' | ')} |\n`;
md += `\n### 당신 사망 원인 (balanced, 판 수)\n` + Object.entries(aggs.balanced ? aggs.balanced.byCause : {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n') + '\n';
md += `\n## 2. 합격선 대비\n| 항목 | 합격선 | 실측 | 판정 |\n|---|---|---|---|\n`;
for (const [k, want, got, ok] of g.rows) md += `| ${k} | ${want} | ${got} | ${ok ? '✓' : '✗'} |\n`;

console.log(md);
if (report) {
  const out = path.join(__dirname, `report_${new Date().toISOString().slice(0, 10)}${suffix}.md`);
  fs.writeFileSync(out, md + '\n<!-- §3 원인 추정은 구현·검증 부장이 손으로 덧붙인다 -->\n', 'utf8');
  console.log('written', out);
}
// 표본 한 판의 밤 사건 (틀 확인용)
if (args.includes('--sample')) { const s = samples[names[0]]; console.log(JSON.stringify({ seed: s.seed, day: s.day, why: s.ended && s.ended.why, cause: s.ended && s.ended.cause, nightLog: s.nightLog.map((e) => `${e.day}:${e.id}:${e.actor}>${e.target}${e.discovered ? '*' : ''}`), world: s.world, axes: s.axes, log: s.log.slice(0, 40).reverse().map((l) => `D${l.day} ${l.phase} ${l.text}`) }, null, 1)); }
