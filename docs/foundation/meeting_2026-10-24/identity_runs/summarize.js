// runs.js 가 남긴 json 들을 표로 찍는다. node summarize.js baseline.json [patch_x.json ...] > summary.md
const fs = require('fs');
const ORDER = ['platform_one', 'passenger', 'conductor', 'driver', 'inspector', 'counted', 'counting_child'];
const KO = { platform_one: '승강장', passenger: '승객', conductor: '차장', driver: '기관사', inspector: '검표원', counted: '센 자', counting_child: '세는 아이' };
const BOTS = ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'lazy', 'diligent', 'risky', 'steward'];
const TH = { share: 2, hand: 1, name: 1 };
const atLeast = (h, t) => { let a = 0, n = 0; for (const [k, v] of Object.entries(h)) { n += v; if (+k >= t) a += v; } return n ? +(100 * a / n).toFixed(0) : 0; };
const mean = (h) => { let s = 0, n = 0; for (const [k, v] of Object.entries(h)) { s += +k * v; n += v; } return n ? (s / n).toFixed(1) : '0'; };
for (const f of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const P = r.policies; const names = Object.keys(P);
  const th = r.patches && r.patches.includes('hand2') ? Object.assign({}, TH, { hand: 2 }) : TH;
  console.log(`\n## ${f} — 패치: ${(r.patches || []).join(',') || '없음'} · 판수/정책 ${P[names[0]].n}`);
  console.log(`| 정책 | 사망% | ${ORDER.map((k) => KO[k]).join(' | ')} | 몫≥${th.share} | 손≥${th.hand} | 이름≥${th.name} | 평균 몫/손/이름 |`);
  console.log(`|---|---|${ORDER.map(() => '---').join('|')}|---|---|---|---|`);
  const row = (nm, p) => `| ${nm} | ${p.dead} | ${ORDER.map((k) => p.identity[k] || 0).join(' | ')} | ${atLeast(p.hist.share, th.share)} | ${atLeast(p.hist.hand, th.hand)} | ${atLeast(p.hist.name, th.name)} | ${mean(p.hist.share)}/${mean(p.hist.hand)}/${mean(p.hist.name)} |`;
  for (const nm of names) console.log(row(nm, P[nm]));
  const avg = (set) => { const ok = set.filter((n) => P[n]); if (!ok.length) return null; const o = {}; for (const k of ORDER) o[k] = +(ok.reduce((s, n) => s + (P[n].identity[k] || 0), 0) / ok.length).toFixed(1); return { o, k: ok.length }; };
  const b = avg(BOTS); if (b) console.log(`| **봇 ${b.k}종 합산(보고서 방식)** | | ${ORDER.map((k) => `**${b.o[k]}**`).join(' | ')} | | | | |`);
  const h = avg(names.filter((n) => n.startsWith('h_'))); if (h) console.log(`| **사람 흉내 ${h.k}종 평균** | | ${ORDER.map((k) => `**${h.o[k]}**`).join(' | ')} | | | | |`);
  const tend = avg(['selfish', 'devoted', 'silent', 'caller', 'steward', 'balanced']); if (tend) console.log(`| 성향 봇 5 + 균형 1 | | ${ORDER.map((k) => tend.o[k]).join(' | ')} | | | | |`);
  for (const nm of ['balanced', 'h_cautious', 'h_cautious2', 'h_wary', 'h_mixed']) if (P[nm] && P[nm].flipOut) {
    console.log(`\n- ${nm} 승강장의 사람 판 중 '이 선택 하나가 없었다면 다른 결말' (판 %): ` + Object.entries(P[nm].flipOut).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · '));
    console.log(`- ${nm} 다른 결말 판 중 '이 선택 하나가 없었다면 승강장의 사람' (판 %): ` + Object.entries(P[nm].flipIn).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · '));
    console.log(`- ${nm} 자주 나온 축 이동 (판 %): ` + Object.entries(P[nm].contrib).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(' · '));
  }
}
