// E4 noExit 검사 시험 (읽기만): 당신을 죽일 수 있는 선택이 있는 사건에 '비용·req 없고 당신을 안 죽이는' 선택지가 ≥1 인가
const path = require('path');
const dir = path.resolve(process.argv[2]);
const T = require(path.join(dir, 'engine/tables.js'));
const E = require(path.join(dir, 'engine/engine.js'));
const db = T.loadDir(path.join(dir, 'data'));
const bad = [], tabooOnly = [];
for (const ev of db.eventsList) {
  if (!ev.choices.some((c) => E.killsYou(c))) continue;
  const free = ev.choices.filter((c) => !c.cost && !c.req && !E.killsYou(c));
  if (!free.length) bad.push(`${ev.id} [${ev.kind}] — ${ev.choices.map((c) => c.label + (E.killsYou(c) ? '(죽음)' : '') + (c.cost ? '(비용)' : '') + (c.req ? '(req)' : '')).join(' / ')}`);
  else if (free.every((c) => c.taboo)) tabooOnly.push(`${ev.id} — 열린 안 죽는 길이 금기뿐: ${free.map((c) => c.label).join(', ')}`);
}
console.log(`## ${process.argv[2]}\nE4 위반(오류가 될 사건) ${bad.length}건`); bad.forEach((b) => console.log('  ' + b));
console.log(`금기만 남는 사건 ${tabooOnly.length}건`); tabooOnly.forEach((b) => console.log('  ' + b));
