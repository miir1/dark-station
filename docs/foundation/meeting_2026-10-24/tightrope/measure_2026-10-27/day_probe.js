// 이른 날 깊이 보기 (엔진 담당, 측정만): 정책마다 판을 run.js 와 똑같이 돌려 S.measure 를 읽고,
//   그날 사건으로 죽은 판(깔때기 아님)을 날 × 사인 사건/선택으로 센다. D3(규칙을 배우는 날)·D6(값을 치르면 사는 날)이 신중한 사람에게 어떤지 본다.
// node docs/foundation/meeting_2026-10-24/tightrope/measure_2026-10-27/day_probe.js [정책,…] [--blocks=1,1001,2001,3001,8001] [--n=200] [--workers=8] [--out=파일]
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = +opt('n', 200);
const blocks = opt('blocks', '1,1001,2001,3001,8001').split(',').map(Number);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || B.CAREFUL.concat(['h_cautious', 'h_first', 'h_cautious2']).join(',')).split(',');
if (opt('worker')) {
  const db = T.loadDir(path.join(ROOT, 'v4/data'));
  const name = opt('worker');
  const rows = [];
  for (const b0 of blocks) for (let seed = b0; seed < b0 + N; seed++) {
    const { s, trace } = B.play(db, seed, name);
    const m = S.measure(db, s, trace);
    if (m.dead) rows.push({ b0, seed, day: m.deathDay, cause: m.causeKey, choice: m.cause ? m.cause.choice : null, dayEvent: m.dayEvent, roped: m.ropeDeath, karma: m.karma, root: m.root });
  }
  process.send({ name, rows }, () => process.exit(0));
  return;   // eslint-disable-line no-unreachable
}
(async function main() {
  const { fork } = require('child_process');
  const W = Math.max(1, +opt('workers', Math.min(pols.length, 8)));
  const res = {}; const q = pols.slice(); let live = 0;
  await new Promise((resolve, reject) => {
    const next = () => {
      if (!q.length && !live) return resolve();
      while (live < W && q.length) {
        const name = q.shift(); live++;
        const ch = fork(__filename, [`--worker=${name}`, `--n=${N}`, `--blocks=${blocks.join(',')}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        ch.on('message', (m) => { res[m.name] = m.rows; });
        ch.on('exit', (code) => { live--; if (!res[name]) return reject(new Error(`일꾼 ${name} 실패 ${code}`)); next(); });
      }
    };
    next();
  });
  let md = `# 이른 날 깊이 보기 — 정책 ${pols.length} × ${N}판 × 블록 ${blocks.join('·')} (그날 사건으로 죽은 판 = 깔때기 사건 아님)\n\n`;
  for (const d of [2, 3, 4, 5, 6]) {
    md += `## D${d}\n`;
    for (const p of pols) {
      const rs = res[p].filter((r) => r.day === d);
      if (!rs.length) { md += `- ${p}: 0\n`; continue; }
      const ev = rs.filter((r) => r.dayEvent), fn = rs.filter((r) => !r.dayEvent);
      const cnt = (xs, f) => { const o = {}; for (const r of xs) { const k = f(r); o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '); };
      md += `- ${p}: 그날 사건 ${ev.length} (${cnt(ev, (r) => `${r.cause}/${r.choice}${r.roped ? ' [줄타기]' : ''}`) || '-'}) · 깔때기 ${fn.length} (${cnt(fn, (r) => `${r.cause}←${r.root}`) || '-'})\n`;
    }
    md += '\n';
  }
  const crisis6 = pols.map((p) => `${p} ${res[p].filter((r) => /^d6_/.test(r.cause)).length}`).join(' · ');
  md += `D6 위기 사건(d6_*)으로 죽은 판: ${crisis6}\n`;
  const crisis3 = pols.map((p) => `${p} ${res[p].filter((r) => /^d3_|^trial_d3/.test(r.cause)).length}`).join(' · ');
  md += `D3 사건(d3_*·trial_d3*)으로 죽은 판: ${crisis3}\n`;
  console.log(md);
  if (opt('out')) fs.writeFileSync(opt('out'), md, 'utf8');
})().catch((e) => { console.error(e); process.exit(1); });
