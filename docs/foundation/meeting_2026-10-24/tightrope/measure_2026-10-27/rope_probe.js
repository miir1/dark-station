// 줄타기 '아슬함' 깊이 보기 (엔진 담당, 측정만 — 표·엔진·봇 파일은 고치지 않는다)
//   봇 판을 run.js 와 똑같이 돌리고, E.dispatch 를 메모리에서만 감싸 'choose' 마다 고른 결과(s.lastResult)와 엔진 집계(s.stats)를 읽는다.
//   읽기만 하므로 판 결과는 run.js 와 같다(맨 끝 '확인' 줄: 생존%가 main.json 과 같아야 한다).
//   재는 것(산 판 = run.js 와 같은 survived · 열흘 끝 = 그중 전멸로 일찍 끝나지 않은 판):
//     줄타기 판정 넘김 수 · ≥2번 % · 넘긴 판정의 가장 낮은 % · 누적 위험 = 1 − Π(넘긴 줄타기 판정의 성공 확률) — '그 판정들 가운데 한 번이라도 죽었을 확률'
//     죽음 판정(실패가 당신을 죽이는 모든 판정) 같은 값 · 줄타기 사망의 % 분포
// node docs/foundation/meeting_2026-10-24/tightrope/measure_2026-10-27/rope_probe.js [정책,…] [--blocks=1,1001,2001,3001] [--n=200] [--workers=8] [--main=main.json]
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = +opt('n', 200);
const blocks = opt('blocks', '1,1001,2001,3001').split(',').map(Number);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'selfish_nb,selfish,selfish_rt0,selfish_rt,balanced,lazy,h_cautious,h_first').split(',');

let cur = null;
const orig = E.dispatch;
E.dispatch = function (s, a, db) {
  const st0 = s && s.stats ? { rr: s.stats.ropeRolls || 0, dr: s.stats.deathRolls || 0 } : null;
  const r = orig.apply(this, arguments);
  if (cur && st0 && a && a.type === 'choose' && s.lastResult && s.lastResult.roll) {
    const L = s.lastResult; const rope = (s.stats.ropeRolls || 0) > st0.rr, death = (s.stats.deathRolls || 0) > st0.dr;
    const x = { ch: L.roll.chance, ok: !!L.roll.success, ev: L.event, kind: L.roped ? L.roped.kind : null, band: L.roped ? L.roped.band : null, blind: !!(L.roped && L.roped.blind) };
    if (rope) cur.ropes.push(x);
    if (death) cur.deaths.push(Object.assign({ rope }, x));
  }
  return r;
};

function runPolicy(db, name) {
  return blocks.map((b0) => {
    const out = [];
    for (let seed = b0; seed < b0 + N; seed++) {
      cur = { ropes: [], deaths: [] };
      const { s } = B.play(db, seed, name);
      const you = s.people.you; const dead = you.status === 'dead' || you.status === 'ascended';
      const survived = !!(s.ended && s.ended.why !== 'you_gone' && !dead);
      const cause = s.ended && s.ended.cause;
      out.push({ seed, survived, full: survived && s.ended.why !== 'all_dead', why: s.ended ? s.ended.why : 'none', ropes: cur.ropes, deaths: cur.deaths, ropedDeath: dead && !!(cause && cause.roped), engineRopeClose: s.stats.ropeClose || 0, karma: s.world.karma || 0, day: s.day });
      cur = null;
    }
    return out;
  });
}
if (opt('worker')) {
  const db = T.loadDir(path.join(ROOT, 'v4/data'));
  const name = opt('worker');
  process.send({ name, perBlock: runPolicy(db, name) }, () => process.exit(0));
  return;   // eslint-disable-line no-unreachable
}

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
const avg = (a) => (a.length ? Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length) / 100 : null);
const passed = (xs) => xs.filter((x) => x.ok);
const risk = (xs) => 1 - passed(xs).reduce((p, x) => p * (Math.min(100, x.ch) / 100), 1);
function summ(runs) {
  const surv = runs.filter((r) => r.survived), full = runs.filter((r) => r.full);
  const rp = (rs) => rs.map((r) => passed(r.ropes).length);
  const dp = (rs) => rs.map((r) => passed(r.deaths).length);
  const minCh = surv.map((r) => passed(r.ropes)).filter((xs) => xs.length).map((xs) => Math.min(...xs.map((x) => x.ch)));
  const ropeDeaths = runs.filter((r) => r.ropedDeath);
  const lastRope = ropeDeaths.map((r) => r.ropes.filter((x) => !x.ok).slice(-1)[0]).filter(Boolean);
  const kinds = {};
  for (const r of surv) for (const x of passed(r.ropes)) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
  return {
    n: runs.length, survived: pct(surv.length, runs.length), full: pct(full.length, runs.length),
    ropePassSurv: avg(rp(surv)), ropePass2Surv: pct(rp(surv).filter((v) => v >= 2).length, surv.length), ropePass3Surv: pct(rp(surv).filter((v) => v >= 3).length, surv.length),
    ropePassFull: avg(rp(full)), ropePass2Full: pct(rp(full).filter((v) => v >= 2).length, full.length),
    riskSurv: avg(surv.map((r) => risk(r.ropes))), risk30: pct(surv.filter((r) => risk(r.ropes) >= 0.3).length, surv.length), risk50: pct(surv.filter((r) => risk(r.ropes) >= 0.5).length, surv.length),
    minChSurv: avg(minCh), deathPassSurv: avg(dp(surv)), deathRiskSurv: avg(surv.map((r) => risk(r.deaths))),
    ropeDeaths: ropeDeaths.length, ropeDeathCh: avg(lastRope.map((x) => x.ch)), ropeDeath70: pct(lastRope.filter((x) => x.ch >= 70).length, lastRope.length),
    engineMatch: surv.every((r) => passed(r.ropes).length === r.engineRopeClose), kindsSurv: kinds,
  };
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
        ch.on('message', (m) => { res[m.name] = m.perBlock; });
        ch.on('exit', (code) => { live--; if (!res[name]) return reject(new Error(`일꾼 ${name} 실패 ${code}`)); next(); });
      }
    };
    next();
  });
  const mainP = opt('main', path.join(__dirname, 'main.json'));
  const MAIN = fs.existsSync(mainP) ? JSON.parse(fs.readFileSync(mainP, 'utf8')) : null;
  let md = `# 줄타기 아슬함 깊이 보기 — 정책 ${pols.length} × ${N}판 × 블록 ${blocks.join('·')}\n\n`;
  md += '산 판 = run.js 와 같은 생존(전멸로 일찍 끝난 판 포함) · 열흘 끝 = 그중 전멸로 일찍 끝나지 않은 판. 누적 위험 = 1 − Π(넘긴 줄타기 판정의 성공 확률) — 그 판정들 가운데 한 번이라도 졌을 확률.\n\n';
  md += '| 정책 | 생존% (열흘 끝%) | 줄타기 넘김/판 산 판 (열흘 끝) | ≥2번% 산 판 (열흘 끝) | ≥3번% | 넘긴 줄타기 가장 낮은 % (평균) | 누적 위험 평균 · ≥30% 판 · ≥50% 판 | 죽음 판정 넘김/판 · 누적 위험 (산 판) | 줄타기 사망 판 · 그 판정 % 평균 · ≥70% 판정에서 진 비율 | 블록별 넘김/판 (산 판) · ≥2번% | 엔진 집계와 같음 · run.js 생존과 같음 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  const json = {};
  for (const p of pols) {
    const all = [].concat(...res[p]); const a = summ(all); const bs = res[p].map(summ); json[p] = { all: a, blocks: bs };
    const same = MAIN && MAIN.aggs[p] ? (MAIN.aggs[p].survived === a.survived ? '같음' : `다름 (run.js ${MAIN.aggs[p].survived})`) : '-';
    md += `| ${p} | ${a.survived} (${a.full}) | ${a.ropePassSurv} (${a.ropePassFull}) | ${a.ropePass2Surv} (${a.ropePass2Full}) | ${a.ropePass3Surv} | ${a.minChSurv} | ${a.riskSurv} · ${a.risk30}% · ${a.risk50}% | ${a.deathPassSurv} · ${a.deathRiskSurv} | ${a.ropeDeaths} · ${a.ropeDeathCh} · ${a.ropeDeath70}% | ${bs.map((b) => `${b.ropePassSurv}·${b.ropePass2Surv}`).join(' / ')} | ${a.engineMatch ? '같음' : '다름'} · ${same} |\n`;
  }
  md += '\n넘긴 줄타기 종류 (산 판, 판정 수): ' + pols.map((p) => `${p} ` + Object.entries(json[p].all.kindsSurv).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join('·')).join(' / ') + '\n';
  console.log(md);
  if (opt('out')) fs.writeFileSync(opt('out'), md, 'utf8');
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(json, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
