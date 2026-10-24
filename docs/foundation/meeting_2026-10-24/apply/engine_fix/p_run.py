# engine_fix: run.js — A4 정책만 블록을 더 돈다(--a4blocks, 기본 8) · 새 봇 옵션 · 이름 바뀐 합격선 줄 ALIAS (10-24 검증 A4-5 등). 한 번만 돌린다
p = 'v4/sim/run.js'
s = open(p, encoding='utf-8').read()


def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:90], s.count(old))
    s = s.replace(old, new)


rep("""// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001] [--workers=8]""",
"""// node v4/sim/run.js [판수=200] [정책,정책…] [--report] [--suffix=b] [--out=v4/sim/report_x.md] [--compare=report_x.md,다른보고서.md] [--peek] [--inject=numbers:trip_party=2,objects:fire.resetOn=morning] [--blocks=1,1001] [--seed0=2001] [--a4blocks=8] [--workers=8] [--all-objects] [--lazy-blank]""")
rep("""//   --seed0    블록 하나만, 이 시드부터 N판 (예: --seed0=2001 → 2001~2000+N). --blocks 가 있으면 무시""",
"""//   --seed0    블록 하나만, 이 시드부터 N판 (예: --seed0=2001 → 2001~2000+N). --blocks 가 있으면 무시
//   --a4blocks A4 게으름의 값을 재는 정책(보통·게으름·부지런 — bots.GROUPS.a4)만 블록을 이만큼까지 더 돈다(기본 8, 10-24 검증 A4-5: 4블록에서 ✓ 이던 줄이 8블록에서 깨졌다).
//              더 도는 블록 = 마지막 블록 + 1000씩. 합격선 표의 A4 줄은 이 블록 전부로 판정하고, 블록 값은 따로 'A4 (블록 N개)' 표에 싣는다. 1 이하·블록 수 이하면 더 돌지 않는다
//   --all-objects  봇 아침 조사가 화면에서 못 닿는 물건(화로·역무실 안·서하 머리맡)도 본다 — 10-24 검증 전 판단(비교용)
//   --lazy-blank   게으름 봇이 명부를 늘 빈칸으로 둔다 — 10-24 검증 전 규칙(비교용)""")
rep("""OPT.perObject = args.includes('--per-object');   // 옛 아침 조사(물건 하나씩)로 비교 (10-24 P0-E2 전)""",
"""OPT.perObject = args.includes('--per-object');   // 옛 아침 조사(물건 하나씩)로 비교 (10-24 P0-E2 전)
OPT.allObjects = args.includes('--all-objects');   // 화면에서 못 닿는 물건도 조사 (10-24 검증 A4-5 전)
OPT.lazyBlank = args.includes('--lazy-blank');     // 게으름이 명부를 늘 빈칸 (10-24 검증 A4-5 전)""")
rep("""if (!blocks.length) throw new Error('--blocks / --seed0: 시드 시작값이 없다');""",
"""if (!blocks.length) throw new Error('--blocks / --seed0: 시드 시작값이 없다');
// A4 정책만 더 도는 블록 (10-24 검증 A4-5)
const A4_N = opt('a4blocks') ? Math.max(1, Math.floor(+opt('a4blocks')) || 1) : 8;
const a4Extra = [];
for (let b = blocks[blocks.length - 1] + 1000; blocks.length + a4Extra.length < A4_N; b += 1000) if (!blocks.includes(b)) a4Extra.push(b);
const a4Blocks = blocks.concat(a4Extra);
const isA4 = (name) => GROUPS.a4.includes(name);
const blocksOf = (name) => (isA4(name) ? a4Blocks : blocks);""")
rep("""  const perBlock = blocks.map((b0, bi) => {""", """  const perBlock = blocksOf(name).map((b0, bi) => {""")
rep("""const aggs = {}; const samples = {}; const byBlock = blocks.map(() => ({}));
const results = await runAll();
for (const name of names) {
  const r = results[name];
  if (r.sample) samples[name] = r.sample;
  r.perBlock.forEach((runs, bi) => { byBlock[bi][name] = S.aggregate(db, runs); });
  aggs[name] = S.aggregate(db, [].concat(...r.perBlock));   // 정책별 표 = 모든 블록을 합친 값
}""",
"""const aggs = {}; const samples = {}; const byBlock = blocks.map(() => ({}));
const a4ByBlock = a4Blocks.map(() => ({})); const a4All = {};   // A4 정책의 블록 전부(--a4blocks) — A4 줄 판정용
const results = await runAll();
for (const name of names) {
  const r = results[name];
  if (r.sample) samples[name] = r.sample;
  r.perBlock.forEach((runs, bi) => { const a = S.aggregate(db, runs); if (bi < blocks.length) byBlock[bi][name] = a; if (isA4(name)) a4ByBlock[bi][name] = a; });
  aggs[name] = S.aggregate(db, [].concat(...r.perBlock.slice(0, blocks.length)));   // 정책별 표 = 기본 블록을 합친 값 (A4 정책의 더 돈 블록은 A4 표에만)
  if (isA4(name)) a4All[name] = S.aggregate(db, [].concat(...r.perBlock));
}""")
rep("""const gates = byBlock.map((a) => S.gate(a, candIds, CAREFUL));
const combined = S.combine(gates);
const gateAll = S.gate(aggs, candIds, CAREFUL);   // 참고 열: 모든 블록을 합친 값으로 잰 실측(판정은 블록별)""",
"""const gates = byBlock.map((a) => S.gate(a, candIds, CAREFUL));
const combined = S.combine(gates);
const gateAll = S.gate(aggs, candIds, CAREFUL);   // 참고 열: 모든 블록을 합친 값으로 잰 실측(판정은 블록별)
// A4 줄은 A4 정책의 블록 전부로 판정한다 (10-24 검증 A4-5). gate 의 줄 순서는 정책 묶음과 상관없이 같다
const A4_ROW = /^A4 /;
const a4On = a4Extra.length > 0 && GROUPS.a4.every((k) => names.includes(k));
const a4Comb = a4On ? S.combine(a4ByBlock.map((a) => S.gate(a, candIds, CAREFUL))) : null;
const a4Pool = a4On ? S.gate(a4All, candIds, CAREFUL) : null;
if (a4On) combined.forEach((r, i) => { if (A4_ROW.test(r.k)) { r.mark = a4Comb[i].mark; r.okAll = a4Comb[i].okAll; r.near = a4Comb[i].near; r.a4 = a4Comb[i].got; r.a4Pool = a4Pool.rows[i][2]; } });""")
rep("""  '정체 분포 (옛 방식: 정책 전체 평균, 각 후보)': ['정체 분포 (정책 합산, 각 후보)'], '옛 방식: 7후보 중 ≥7% 인 후보 수': ['정체: 7후보 중 ≥5가 각 ≥7%'] };""",
"""  '정체 분포 (옛 방식: 정책 전체 평균, 각 후보)': ['정체 분포 (정책 합산, 각 후보)'], '옛 방식: 7후보 중 ≥7% 인 후보 수': ['정체: 7후보 중 ≥5가 각 ≥7%'],
  // (10-24 검증 고침) 이름이 바뀐 줄 — 옛 줄과 재는 법이 다르면 '옛 방식' 참고 줄에 옛 값을 붙인다
  '참고: 사람 흉내 평균 (옛 방식 — 프롤로그 사망 포함) · 프롤로그(D0) 사망 판 비율': ['정체 — 사람 흉내 평균, 각 후보 (A3)'],
  '참고: 같은 값 — 성향 봇 8종 / 사람 흉내(h_random 뺌) / 전 정책 합산(옛 줄)': ['A2 D2~D6 날마다 그날 사건으로 죽은 판 (정책 합산, 깔때기 사건 뺌)'],
  'A1 이른 안전: D1~D4 생존 − 균형 (버릇 없는 이기적 각각)': ['A1 이른 안전: 이기적 D1~D4 생존 − 균형'],
  'A1 이기심의 값: 열흘 생존 − 균형 (버릇 없는 이기적 각각 — selfish_nb·selfish_rt0)': ['A1 이기심의 값: 열흘 생존 − 균형 (이기적 4종 각각 — 버릇 없는·끝까지 금기 포함)'],
  'A1 이기적 사인 쏠림 (버릇 없는 이기적, 사망 ≥ 20판인 정책만)': ['A1 이기적 4종 사인 쏠림 (한 사건 비중)'] };""")
rep("""if (OPT.perObject) md += ' **봇 아침 조사: 옛 물건 하나씩(--per-object).**';""",
"""if (OPT.perObject) md += ' **봇 아침 조사: 옛 물건 하나씩(--per-object).**';
if (OPT.allObjects) md += ' **봇 아침 조사: 화면에서 못 닿는 물건도(--all-objects, 10-24 검증 전).**';
if (OPT.lazyBlank) md += ' **게으름 봇 명부: 늘 빈칸(--lazy-blank, 10-24 검증 전).**';
if (a4Extra.length) md += ` A4 정책(${GROUPS.a4.join('·')})은 블록 ${a4Blocks.length}개(더 돈 블록: ${a4Extra.map(blockName).join(', ')}) — 정책별 표·블록별 표는 기본 블록만, A4 줄 판정과 'A4 (블록 ${a4Blocks.length}개)' 표는 전부.`;""")
rep("""for (const [i, r] of combined.entries()) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${gateAll.rows[i][2]} | ${r.mark} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\\n`;""",
"""for (const [i, r] of combined.entries()) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${r.a4 ? `${r.a4Pool} (A4 블록 ${a4Blocks.length}개 합산)` : gateAll.rows[i][2]} | ${r.mark}${r.a4 ? ` (블록 ${a4Blocks.length}개)` : ''} |${compares.map((c) => ` ${prevOf(c, r.k)} |`).join('')}\\n`;
if (a4On) {
  md += `\\n### A4 (블록 ${a4Blocks.length}개 — ${GROUPS.a4.join('·')}만 더 돌았다, 판정은 이 표의 블록 전부)\\n| 항목 | 합격선 | ${a4Blocks.map((b0) => `실측 ${blockName(b0)}`).join(' | ')} | 합산 | 판정 |\\n|---|---|${a4Blocks.map(() => '---|').join('')}---|---|\\n`;
  for (const [i, r] of a4Comb.entries()) if (A4_ROW.test(r.k) || /^ {2}못 본 일/.test(r.k)) md += `| ${r.k} | ${r.want} | ${r.got.join(' | ')} | ${a4Pool.rows[i][2]} | ${r.mark} |\\n`;
  md += `\\nA4 정책 합산 (블록 ${a4Blocks.length}개): ` + GROUPS.a4.map((k) => `${k} 생존 ${a4All[k].survived}% · D9 주민 ${a4All[k].home9} · D7 자원 ${a4All[k].res7} · 못 본 일/판 ${a4All[k].neglect} · 발견 ${a4All[k].discovery}%`).join(' / ') + '\\n';
}""")
rep("""if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ blocks, aggs, byBlock, gate: combined }, null, 1));""",
"""if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ blocks, a4Blocks, aggs, byBlock, a4All, a4ByBlock, gate: combined }, null, 1));""")
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
