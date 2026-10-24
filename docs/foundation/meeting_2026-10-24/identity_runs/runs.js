// 정체 쏠림 측정 (읽기 전용 — 표 파일·보고서 파일은 건드리지 않는다).
// node runs.js [--root=<v4 폴더>] [--n=200] [--blocks=1,1001,2001] [--pols=a,b] [--patch=<이름,이름>] [--json=<출력.json>]
//   봇 9종(v4/sim/bots.js 그대로) + 사람 흉내 5종(선택지 고르는 법만 바꾸고 배식·조사·원정은 균형 봇과 같다).
//   --patch = 메모리 시험(표를 실행 중에만 바꾼다): patches.js 의 이름.
const path = require('path'); const fs = require('fs'); const Module = require('module');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROOT = arg('root', 'C:/dev/dark_station/v4');
const N = +arg('n', 200);
const BLOCKS = arg('blocks', '1,1001,2001').split(',').map(Number);
const T = require(path.join(ROOT, 'engine/tables.js'));
const E = require(path.join(ROOT, 'engine/engine.js'));
const R = require(path.join(ROOT, 'engine/rng.js'));
const IDN = require(path.join(ROOT, 'engine/identity.js'));
// bots.js 를 메모리에서 한 줄만 고쳐 읽는다: pol.custom 이 있으면 그 함수가 선택지를 고른다 (파일은 그대로)
const botsFile = path.join(ROOT, 'sim/bots.js');
let src = fs.readFileSync(botsFile, 'utf8');
const HOOK = 'function pickChoice(s, db, pol, metas) {';
if (!src.includes(HOOK)) throw new Error('bots.js pickChoice 머리가 바뀌었다');
src = src.replace(HOOK, HOOK + '\n  if (pol.custom) { metas = metas || E.choiceMeta(s, db); if (!metas) return -1; return pol.custom(s, db, metas); }');
const m = new Module(botsFile, module); m.filename = botsFile; m.paths = Module._nodeModulePaths(path.dirname(botsFile)); m._compile(src, botsFile);
const B = m.exports;
// ── 데이터 (메모리 시험 패치) ──
const raw = {};
for (const [k, f] of Object.entries(T.FILES)) { let p = path.join(ROOT, 'data', f); if (!fs.existsSync(p) && T.ALT_FILES[k]) p = path.join(ROOT, 'data', T.ALT_FILES[k]); raw[k] = JSON.parse(fs.readFileSync(p, 'utf8')); }
const PATCHES = require('./patches.js');
const patchNames = arg('patch', '').split(',').filter(Boolean);
for (const p of patchNames) { if (!PATCHES[p]) throw new Error('패치 없음 ' + p); PATCHES[p](raw); }
const db = T.load(raw);
// ── 사람 흉내 정책 ──
const open = (ms) => ms.filter((c) => !c.locked);
const warnedC = (c) => !!(c.warn || c.hint || c.taboo);
const deadly = (c) => B.deadlyText(c);
const pickUniform = (s, set) => set[Math.floor(R.rand(s) * set.length)].i;
// 처음 하는 사람: 경고 없는 것 → 그중 비용 없는 것 → 아무거나. 전부 경고면 죽음 글·금기 없는 것 중 성공 % 가 가장 높은 것
const cautiousPick = (s, ms) => {
  const o = open(ms); if (!o.length) return ms[0].i;
  let set = o.filter((c) => !warnedC(c));
  if (set.length) { const nc = set.filter((c) => !c.cost); return pickUniform(s, nc.length ? nc : set); }
  set = o.filter((c) => !deadly(c) && !c.taboo); if (!set.length) set = o;
  const best = Math.max(...set.map((c) => (c.chance != null ? c.chance : 100)));
  return pickUniform(s, set.filter((c) => (c.chance != null ? c.chance : 100) === best));
};
// 처음 하는 사람 2: 경고 없는 것 → 비용 없는 것 → 아무거나. 전부 경고면 죽음 글·금기 없는 것 중 아무거나(주사위를 피하지도 좋아하지도 않는다)
const cautious2 = (s, ms) => {
  const o = open(ms); if (!o.length) return ms[0].i;
  let set = o.filter((c) => !warnedC(c));
  if (set.length) { const nc = set.filter((c) => !c.cost); return pickUniform(s, nc.length ? nc : set); }
  set = o.filter((c) => !deadly(c) && !c.taboo); return pickUniform(s, set.length ? set : o);
};
const wary = (s, ms) => { const o = open(ms); if (!o.length) return ms[0].i; const nd = o.filter((c) => !deadly(c)); return pickUniform(s, nd.length ? nd : o); };
const HUMAN = {
  h_random: (s, db, ms) => { const o = open(ms); return o.length ? pickUniform(s, o) : ms[0].i; },     // 정말 아무거나
  h_wary: (s, db, ms) => wary(s, ms),                                                               // 아무거나, 단 '죽는다'류 글은 피함
  h_first: (s, db, ms) => { const o = open(ms).filter((c) => !deadly(c)); return (o[0] || open(ms)[0] || ms[0]).i; },   // 맨 위부터 읽고 죽음 글 아니면 그것
  h_cautious: (s, db, ms) => cautiousPick(s, ms),                                                   // 안전해 보이는 쪽
  h_cautious2: (s, db, ms) => cautious2(s, ms),                                                     // 안전해 보이는 쪽, 전부 경고면 아무거나
  h_mixed: (s, db, ms) => (R.rand(s) < 0.6 ? cautiousPick(s, ms) : wary(s, ms)),                    // 대체로 안전, 열에 넷은 궁금한 쪽
};
const base = B.POLICIES.balanced;
for (const [k, f] of Object.entries(HUMAN)) B.POLICIES[k] = Object.assign({}, base, { custom: f });   // play() 는 POLICIES[이름] 을 읽는다
const want = arg('pols', '').split(',').filter(Boolean);
const names = Object.keys(B.POLICIES).filter((k) => !want.length || want.includes(k));
// ── 축을 움직인 선택 기록: engine.dispatch 를 감싼다 ──
let cur = null;
const orig = E.dispatch;
E.dispatch = function (s, a, d) {
  const before = Object.assign({}, s.axes); const ev = s.pending ? s.pending.id : null;
  const r = orig.call(this, s, a, d);
  if (cur && r && r.ok) for (const k of Object.keys(s.axes)) {
    const dv = (s.axes[k] || 0) - (before[k] || 0);
    if (dv) { const lr = s.lastResult || {}; const key = `${k}${dv > 0 ? '+' : '-'} ${lr.event || ev || a.type}:${lr.choice || ''}`; cur[key] = (cur[key] || 0) + dv; }
  }
  return r;
};
const TH = { share: 2, hand: 1, name: 1 };
const TH2 = patchNames.includes('hand2') ? { share: 2, hand: 2, name: 1 } : TH;
const out = {};
for (const name of names) {
  const ids = {}, oct = {}, hist = { share: {}, hand: {}, name: {} }, contrib = {}, flipOut = {}, flipIn = {}; let n = 0, dead = 0; const idDead = {};
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) {
    cur = {};
    const { s } = B.play(db, seed, name);
    n++;
    const id = s.ended ? s.ended.identity : 'none'; ids[id] = (ids[id] || 0) + 1;
    const gone = s.people.you.status === 'dead' || s.people.you.status === 'ascended' || (s.ended && s.ended.why === 'you_gone'); if (gone) { dead++; idDead[id] = (idDead[id] || 0) + 1; }
    const o = ['share', 'hand', 'name'].map((k) => ((s.axes[k] || 0) >= TH2[k] ? '+' : '−')).join(''); oct[o] = (oct[o] || 0) + 1;
    for (const k of ['share', 'hand', 'name']) hist[k][s.axes[k] || 0] = (hist[k][s.axes[k] || 0] || 0) + 1;
    for (const key of Object.keys(cur)) contrib[key] = (contrib[key] || 0) + 1;   // 이 선택이 나온 판 수
    // 하나 빼 보기: 이 선택 하나의 축 이동이 없었다면 승강장의 사람이 아니었을 판(→ flipOut) / 이었을 판(→ flipIn)
    for (const [key, dv] of Object.entries(cur)) {
      const k = key.split(/[+-] /)[0]; const ax = Object.assign({}, s.axes); ax[k] = (ax[k] || 0) - dv;
      const alt = IDN.identity(ax, db.identity); const altId = alt ? alt.id : null;
      if (id === 'platform_one' && altId !== 'platform_one') flipOut[key] = (flipOut[key] || 0) + 1;
      if (id !== 'platform_one' && altId === 'platform_one') flipIn[key] = (flipIn[key] || 0) + 1;
    }
  }
  const pct = (v) => +(100 * v / n).toFixed(1);
  out[name] = { n, dead: pct(dead), identity: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, pct(v)])), identityDead: Object.fromEntries(Object.entries(idDead).map(([k, v]) => [k, pct(v)])), octant: Object.fromEntries(Object.entries(oct).map(([k, v]) => [k, pct(v)])), hist, contrib: Object.fromEntries(Object.entries(contrib).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, pct(v)])),
    flipOut: Object.fromEntries(Object.entries(flipOut).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, pct(v)])),
    flipIn: Object.fromEntries(Object.entries(flipIn).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, pct(v)])) };
  const pf = out[name].identity;
  const jj = arg('json', ''); if (jj) fs.writeFileSync(jj, JSON.stringify({ root: ROOT, n: N, blocks: BLOCKS, patches: patchNames, when: new Date().toISOString(), partial: true, policies: out }, null, 1));   // 정책마다 저장(중간에 끊겨도 남게)
  console.error(`${name.padEnd(10)} n=${n} 사망 ${out[name].dead}% | ` + ['platform_one', 'passenger', 'conductor', 'driver', 'inspector', 'counted', 'counting_child'].map((k) => `${k} ${pf[k] || 0}`).join(' · '));
}
const res = { root: ROOT, n: N, blocks: BLOCKS, patches: patchNames, when: new Date().toISOString(), policies: out };
const j = arg('json', ''); if (j) fs.writeFileSync(j, JSON.stringify(res, null, 1));
