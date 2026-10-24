// 데이터 담당 (10-25) — 손잡이 시험 일꾼: (정책 × 시드 블록) 단위로 나눠 돈다 (run.js 는 정책 단위라 정책이 적으면 느리다).
// 표 파일은 고치지 않는다 — --inject 는 run.js 와 같은 꼴(표:id.열=값, 쉼표로 여럿)로 메모리에서만 바꾼다. 판 결과는 run.js 와 같다(같은 play·measure·aggregate).
// node exp_run.js --pols=a,b --blocks=1,1001 [--n=200] [--workers=12] [--inject=…] --json=out.json
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const { play, OPT } = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = +opt('n', 200);
function loadDb() {
  let db = T.loadDir(path.join(ROOT, 'v4/data'));
  const inj = opt('inject', '');
  if (!inj && !opt('patch', '')) return db;
  const raw = JSON.parse(JSON.stringify(db.raw));
  for (const spec of inj ? inj.split(',') : []) {
    const c = /^([A-Za-z]+):([a-z0-9_]+)\.([A-Za-z]+)=(.*)$/.exec(spec);
    if (!c) throw new Error('--inject 꼴: 표:id.열=값 ' + spec);
    const row = (raw[c[1]] || []).find((r) => r.id === c[2]);
    if (!row) throw new Error('--inject: 행 없음 ' + spec);
    row[c[3]] = /^-?\d+$/.test(c[4]) ? +c[4] : c[4];
  }
  return T.load(patch(raw));
}
// --patch=nothing_rope : (검증 지적 1 의 다른 길 시험) 카르마 판의 '이기적 위험 0 출구' 넷에 줄타기(point = 남을 내미는 길)를 단다 — 표는 안 고친다
function patch(raw) {
  if (opt('patch', '') !== 'nothing_rope') return raw;
  const PT = {
    d6_shutter: ['아무것도 하지 않는다', '횃불이 기둥 뒤를 비췄다. 쇠파이프가 당신 쪽으로 왔다.'],
    d6_shutter_b: ['아무것도 하지 않는다', '횃불이 기둥 뒤를 비췄다. 쇠파이프가 당신 쪽으로 왔다.'],
    d10_walk: ['걷는다', '동하가 당신 소매를 잡았다. 당신 이름도 불렸다.'],
    d10_walk_other: ['걷는다', '그 사람이 당신 소매를 잡았다. 당신 이름도 불렸다.'],
  };
  for (const [id, [label, text]] of Object.entries(PT)) {
    const ev = raw.events.find((e) => e.id === id);
    const c = ev && ev.choices.find((x) => x.label === label);
    if (!c) throw new Error('patch: 없음 ' + id + '/' + label);
    c.rope = { kind: 'point', fail: { text, how: /^d10/.test(id) ? 'ascended' : 'dead' } };
  }
  return raw;
}
if (opt('worker')) {
  const [name, b0s] = opt('worker').split('@');
  const b0 = +b0s;
  const db = loadDb();
  const runs = [];
  for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = play(db, seed, name); runs.push(S.measure(db, s, trace)); }
  process.send({ name, b0, agg: S.aggregate(db, runs) }, () => process.exit(0));
  return;   // eslint-disable-line no-unreachable
}
(async function main() {
  const t0 = Date.now();
  const pols = opt('pols').split(',');
  const blocks = opt('blocks').split(',').map(Number);
  const W = +opt('workers', 12);
  const jobs = []; for (const p of pols) for (const b of blocks) jobs.push(`${p}@${b}`);
  const res = {};
  const { fork } = require('child_process');
  const pass = args.filter((a) => /^--(n|inject|patch)=/.test(a));
  await new Promise((resolve, reject) => {
    let live = 0;
    const next = () => {
      if (!jobs.length && !live) return resolve();
      while (live < W && jobs.length) {
        const job = jobs.shift(); live++;
        const ch = fork(__filename, pass.concat([`--worker=${job}`]), { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        let got = false;
        ch.on('message', (m) => { res[`${m.name}@${m.b0}`] = m.agg; got = true; });
        ch.on('exit', (code) => { live--; if (!got) return reject(new Error(`일꾼 ${job} 실패 ${code}`)); next(); });
      }
    };
    next();
  });
  const byBlock = blocks.map((b) => Object.fromEntries(pols.map((p) => [p, res[`${p}@${b}`]])));
  fs.writeFileSync(opt('json'), JSON.stringify({ inject: opt('inject', ''), blocks, byBlock, a4Blocks: blocks, a4ByBlock: byBlock }, null, 1));
  console.log(`끝 ${((Date.now() - t0) / 1000).toFixed(0)}초 · ${pols.length}정책 × ${blocks.length}블록 × ${N}판 · inject ${opt('inject', '-')}`);
})().catch((e) => { console.error(e); process.exit(1); });
