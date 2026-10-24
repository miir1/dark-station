// 읽기 전용: run.js 출력에서 이 작업이 보는 줄만 뽑는다. node summarize.js a.txt [b.txt …]
const fs = require('fs');
const KEYS = ['당신 사망(올라감 포함)', '강제 사망 (전 정책 합산)', '경고 없는 사망', '봇 버릇 점검', '정체 — 사람 흉내 평균, 각 후보', '정체 — 성향 봇 평균, 가장 큰 후보', '모험 봇 열흘 생존', 'A2 D5까지', 'A2 균형 사망 중 한 사건 비중 (사인', 'A2 균형 사망 중 한 사건 비중 (원인', 'A2 D2~D6', 'A1 이른 안전', 'A1 이기심의 값', 'A1 이기적 4종 사인', '  카르마', 'A4 게으름의 값 — 생존', 'A4 게으름의 값 — D9', 'A4 게으름의 값 — D7', '  못 본 일', '헌신 봇 생존', '전멸'];
const POL = ['balanced', 'selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0', 'lazy', 'diligent', 'risky', 'devoted', 'counter', 'child', 'h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'];
for (const f of process.argv.slice(2)) {
  const t = fs.readFileSync(f, 'utf8').split('\n');
  console.log('\n######## ' + f);
  const blk = t.findIndex((l) => l.startsWith('### 블록별'));
  for (const p of POL) { const l = t.slice(blk).find((x) => x.startsWith(`| ${p} |`)); if (l) console.log(l.slice(0, 120)); }
  for (const l of t) if (/^- (balanced|selfish_nb|selfish) 사망 원인/.test(l) || /^- balanced 원인 사건/.test(l)) console.log(l.slice(0, 260));
  const gate = t.findIndex((l) => l.startsWith('## 2. 합격선'));
  for (const l of t.slice(gate)) { const c = l.split('|').map((x) => x.trim()); if (c.length > 8 && KEYS.some((k) => c[1] && c[1].startsWith(k.trim()) )) console.log(`${c[c.length - 2]} [${c[c.length - 3].slice(0, 160)}] ${c[1].slice(0, 40)} | ${c.slice(3, 7).map((x) => x.slice(0, 70)).join(' ; ')}`); }
  const id = t.findIndex((l) => l.startsWith('### 정체 묶음'));
  if (id >= 0) console.log(t.slice(id + 3, id + 5).join('\n'));
  const dd = t.findIndex((l) => l.startsWith('### 날별'));
  for (const p of ['balanced', 'h_cautious2']) { const l = t.slice(dd).find((x) => x.startsWith(`| ${p} |`)); if (l) console.log('날별 ' + l); }
}
