// 보고서용 표: node doctable.js 지금.json 고친뒤.json [더.json:이름 ...]
const fs = require('fs');
const [nowF, afterF, ...extra] = process.argv.slice(2);
const now = JSON.parse(fs.readFileSync(nowF, 'utf8')).policies;
const aft = JSON.parse(fs.readFileSync(afterF, 'utf8')).policies;
const KO = { balanced: '균형', selfish: '이기', devoted: '헌신', silent: '침묵', caller: '부름', lazy: '게으름', diligent: '부지런', risky: '모험', steward: '관리(몫+손−이름+)',
  h_random: '사람: 아무거나', h_wary: '사람: 죽음 글만 피함', h_first: '사람: 맨 위', h_cautious: '사람: 조심(주사위 피함)', h_cautious2: '사람: 조심', h_mixed: '사람: 조심 6 · 아무거나 4' };
const MAIN = ['platform_one', 'passenger', 'conductor'];
const OTHER = ['driver', 'inspector', 'counted', 'counting_child'];
const r0 = (x) => Math.round(x);
const at = (h, t) => { let a = 0, n = 0; for (const [k, v] of Object.entries(h)) { n += v; if (+k >= t) a += v; } return n ? r0(100 * a / n) : 0; };
const cell = (p) => MAIN.map((k) => r0(p.identity[k] || 0)).join(' · ') + ' · ' + r0(OTHER.reduce((s, k) => s + (p.identity[k] || 0), 0));
console.log('| 정책 | 지금 승강장·승객·차장·그 밖 | 고친 뒤 | 지금 몫≥2 · 손≥1 · 이름≥1 (%) | 지금 평균 몫/손/이름 |');
console.log('|---|---|---|---|---|');
const mean = (h) => { let s = 0, n = 0; for (const [k, v] of Object.entries(h)) { s += +k * v; n += v; } return (s / n).toFixed(1); };
for (const k of Object.keys(KO)) if (now[k]) console.log(`| ${KO[k]} | ${cell(now[k])} | ${aft[k] ? cell(aft[k]) : '-'} | ${at(now[k].hist.share, 2)} · ${at(now[k].hist.hand, 1)} · ${at(now[k].hist.name, 1)} | ${mean(now[k].hist.share)} / ${mean(now[k].hist.hand)} / ${mean(now[k].hist.name)} |`);
const ALL7 = MAIN.concat(OTHER);
const avg = (P, set) => { const ok = set.filter((n) => P[n]); const o = {}; for (const k of ALL7) o[k] = ok.reduce((s, n) => s + (P[n].identity[k] || 0), 0) / ok.length; return { o, n: ok.length }; };
const fmt = (a) => ALL7.map((k) => a.o[k].toFixed(1)).join(' · ');
const SETS = { '봇 9종 합산(보고서 방식)': Object.keys(KO).filter((k) => !k.startsWith('h_')), '성향 봇 6종(균형·이기·헌신·침묵·부름·관리)': ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward'], '사람 흉내 6종': Object.keys(KO).filter((k) => k.startsWith('h_')), '사람 흉내 5종(맨 위 뺌)': ['h_random', 'h_wary', 'h_cautious', 'h_cautious2', 'h_mixed'] };
console.log('\n| 묶음 | 지금: 승강장·승객·차장·기관사·검표원·센 자·세는 아이 | 고친 뒤 |');
console.log('|---|---|---|');
for (const [nm, set] of Object.entries(SETS)) { const a = avg(now, set), b = avg(aft, set); console.log(`| ${nm} | ${fmt(a)} (${a.n}) | ${fmt(b)} (${b.n}) |`); }
