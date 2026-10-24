// verify_A3: 정체 분포 독립 재측정 (읽기만 한다, 표 파일은 그대로 — B1·B2 되돌림은 메모리에서만)
// node verify_A3_identity.js [--variants=now,revertB1B2] [--blocks=5001,7001] [--n=200] [--par=11]
//   부모: 정책×변형×블록을 자식 프로세스로 나눠 돌리고 표를 찍는다 → verify_A3_identity.json
// node verify_A3_identity.js --child=pol,variant,seed0,n  → 자식: JSON 한 줄
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const bots = require(path.join(root, 'v4/sim/bots.js'));
const C = require(path.join(root, 'v4/engine/cond.js'));

function makeDb(variant) {
  const base = T.loadDir(path.join(root, 'v4/data'));
  if (variant === 'now') return base;
  const raw = JSON.parse(JSON.stringify(base.raw));
  const ev = (id) => raw.events.find((e) => e.id === id);
  if (variant === 'revertB1B2' || variant === 'revertB1') {
    const c = ev('starve_you').choices.find((x) => x.label === '선로 밑을 뒤진다');
    c.ok.effects.axis = Object.assign({}, c.ok.effects.axis || {}, { share: -1 });
  }
  if (variant === 'revertB1B2' || variant === 'revertB2') {
    const c = ev('patrol_pact').choices.find((x) => x.label === '동하를 보낸다');
    c.out.effects.axis = Object.assign({}, c.out.effects.axis || {}, { hand: 1 });
  }
  return T.load(raw);
}

const arg = process.argv.find((a) => a.startsWith('--child='));
if (arg) {
  const [pol, variant, s0, n] = arg.slice(8).split(',');
  const db = makeDb(variant);
  const cnt = {}, cntPro = {}, cntAlive = {}; let ended = 0, noId = 0, dead = 0, mismatch = 0, proDead = 0, alive = 0;
  const axSum = { share: 0, hand: 0, name: 0 };
  for (let seed = +s0; seed < +s0 + +n; seed++) {
    const { s } = bots.play(db, seed, pol);
    if (!s.ended) continue;
    ended++;
    const id = s.ended.identity;
    if (!id) { noId++; continue; }
    const ctx = { share: s.axes.share || 0, hand: s.axes.hand || 0, name: s.axes.name || 0 };
    const hits = db.identity.candidates.filter((c) => C.test(c.rule, ctx));
    if (hits.length !== 1 || hits[0].id !== id) mismatch++;
    cnt[id] = (cnt[id] || 0) + 1;
    const cause = s.ended.cause;
    if (cause && cause.event === 'pro_stairs') { proDead++; cntPro[id] = (cntPro[id] || 0) + 1; }
    else if (!cause) { alive++; cntAlive[id] = (cntAlive[id] || 0) + 1; }
    if (s.people && s.people.you && s.people.you.status === 'dead') dead++;
    for (const k of Object.keys(axSum)) axSum[k] += ctx[k];
  }
  const m = Math.max(1, ended - noId);
  process.stdout.write(JSON.stringify({ pol, variant, s0: +s0, n: +n, ended, noId, dead, mismatch, cnt, axSum, m, proDead, cntPro, alive, cntAlive }));
  process.exit(0);
}

const getOpt = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const P8 = bots.GROUPS.personality, P6 = ['balanced', 'selfish', 'devoted', 'silent', 'caller', 'steward'];
const H5 = bots.GROUPS.human, H6 = H5.concat(['h_first']);
const pols = [...new Set([...P8, ...H6, 'risky', 'lazy', 'diligent'])];
const variants = getOpt('variants', 'now,revertB1B2').split(',');
const blocks = getOpt('blocks', '5001,7001').split(',').map(Number);
const N = +getOpt('n', '200');
const PAR = +getOpt('par', '11');
const jobs = [];
for (const v of variants) for (const p of pols) for (const b of blocks) jobs.push([p, v, b, N]);
const res = []; let running = 0, i = 0;
const cand = makeDb('now').identity.candidates.map((c) => c.id);
const t0 = Date.now();
function next() {
  while (running < PAR && i < jobs.length) {
    const j = jobs[i++]; running++;
    execFile(process.execPath, [__filename, '--child=' + j.join(',')], { maxBuffer: 1 << 24 }, (err, out) => {
      running--;
      if (err) console.error('job fail', j, err.message); else res.push(JSON.parse(out));
      if (i >= jobs.length && running === 0) done(); else next();
    });
  }
}
function done() {
  const out = { blocks, N, variants, seconds: Math.round((Date.now() - t0) / 1000), table: {} };
  const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : 0);
  for (const v of variants) {
    const T2 = (out.table[v] = { perPolicy: {}, perBlock: {} });
    for (const p of pols) {
      const rs = res.filter((r) => r.pol === p && r.variant === v);
      const tot = rs.reduce((t, r) => t + r.ended, 0); const c = {};
      for (const r of rs) for (const [k, x] of Object.entries(r.cnt)) c[k] = (c[k] || 0) + x;
      const ax = {}; const mm = rs.reduce((t, r) => t + r.m, 0);
      for (const k of ['share', 'hand', 'name']) ax[k] = Math.round(100 * rs.reduce((t, r) => t + r.axSum[k], 0) / Math.max(1, mm)) / 100;
      const pro = rs.reduce((t, r) => t + r.proDead, 0), cp = {};
      for (const r of rs) for (const [k, x] of Object.entries(r.cntPro)) cp[k] = (cp[k] || 0) + x;
      const al = rs.reduce((t, r) => t + r.alive, 0), ca = {};
      for (const r of rs) for (const [k, x] of Object.entries(r.cntAlive)) ca[k] = (ca[k] || 0) + x;
      T2.perPolicy[p] = { n: tot, noId: rs.reduce((t, r) => t + r.noId, 0), dead: rs.reduce((t, r) => t + r.dead, 0), mismatch: rs.reduce((t, r) => t + r.mismatch, 0), dist: Object.fromEntries(cand.map((k) => [k, pct(c[k] || 0, tot)])), axAvg: ax,
        proStairsDead: pro, distNoPrologue: Object.fromEntries(cand.map((k) => [k, pct((c[k] || 0) - (cp[k] || 0), tot - pro)])), alive: al, distAlive: Object.fromEntries(cand.map((k) => [k, pct(ca[k] || 0, al)])) };
      for (const r of rs) { const bt = (T2.perBlock[r.s0] = T2.perBlock[r.s0] || {}); bt[p] = Object.fromEntries(cand.map((k) => [k, pct(r.cnt[k] || 0, r.ended)])); }
    }
    const avg = (names, src) => Object.fromEntries(cand.map((k) => [k, Math.round(10 * names.reduce((t, p) => t + src[p][k], 0) / names.length) / 10]));
    const pp = Object.fromEntries(pols.map((p) => [p, T2.perPolicy[p].dist]));
    T2.groups = { P8: avg(P8, pp), P6: avg(P6, pp), H5: avg(H5, pp), H6: avg(H6, pp), ALL: avg(pols, pp) };
    const ppNo = Object.fromEntries(pols.map((p) => [p, T2.perPolicy[p].distNoPrologue]));
    T2.groups.H5_noPrologue = avg(H5, ppNo);
    const ppAl = Object.fromEntries(pols.map((p) => [p, T2.perPolicy[p].distAlive]));
    T2.groups.H5_aliveOnly = avg(H5, ppAl);
    T2.groups.P8_aliveOnly = avg(P8, ppAl);
    T2.groupsPerBlock = Object.fromEntries(blocks.map((b) => [b, { P8: avg(P8, T2.perBlock[b]), H5: avg(H5, T2.perBlock[b]) }]));
  }
  const f = path.join(__dirname, 'verify_A3_identity.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  for (const v of variants) {
    const T2 = out.table[v];
    console.log('\n== ' + v + ' (blocks ' + blocks.join(',') + ' x ' + N + ') ==');
    console.log('policy | ' + cand.join(' | ') + ' | n | dead | noId | mismatch | axAvg s/h/n');
    for (const p of pols) { const r = T2.perPolicy[p]; console.log(p + ' | ' + cand.map((k) => r.dist[k]).join(' | ') + ' | ' + r.n + ' | ' + r.dead + ' | ' + r.noId + ' | ' + r.mismatch + ' | ' + r.axAvg.share + '/' + r.axAvg.hand + '/' + r.axAvg.name + ' | proStairs ' + r.proStairsDead + ' | alive ' + r.alive); }
    for (const [g, d] of Object.entries(T2.groups)) console.log('[' + g + '] ' + cand.map((k) => k + ' ' + d[k]).join(' · '));
    for (const [b, gs] of Object.entries(T2.groupsPerBlock)) console.log('  block ' + b + ': P8 ' + cand.map((k) => k + ' ' + gs.P8[k]).join(' · ') + ' | H5 ' + cand.map((k) => k + ' ' + gs.H5[k]).join(' · '));
  }
  console.log('\nwritten', f, out.seconds + 's');
}
next();
