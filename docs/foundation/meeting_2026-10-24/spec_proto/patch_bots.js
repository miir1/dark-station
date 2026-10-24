// 시제품 봇 패치 (스크래치 사본만 — v4/sim 에 직접 쓰지 말 것). node patch_bots.js <proto/sim>
// 이기적 봇 = 제 몸으로 치르는 선택을 꺼린다: 경고 글에 '다친다·잃는다·상한다'가 있으면 −3 (화면에 보이는 글만 본다, E6).
const fs = require('fs'); const path = require('path');
const p = path.join(process.argv[2], 'bots.js'); let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { if (!t.includes(a)) throw new Error('anchor: ' + a.slice(0, 50)); t = t.replace(a, b); };
rep("selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1 },", "selfish: { share: -1, hand: -1, name: 0, inspect: 'normal', avoidWarn: 1, avoidDeadly: 1, bodyAverse: 3 },");
rep("  if (c.taboo) sc -= 3;", "  if (c.taboo) sc -= 3;\n  if (pol.bodyAverse && /다친다|잃는다|상한다/.test(`${c.warn || ''}`)) sc -= pol.bodyAverse;");
fs.writeFileSync(p, t); console.log('bots patched');
