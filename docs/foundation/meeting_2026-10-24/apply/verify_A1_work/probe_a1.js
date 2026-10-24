// verify_A1 (적대적 검증, 읽기 전용): 이기적 봇 판을 돌리며 E.dispatch 를 감싸 선택·카르마·화면 신호를 기록한다.
// node docs/foundation/meeting_2026-10-24/apply/verify_A1_work/probe_a1.js [판수=200] [정책,…] [--blocks=1,1001]
// 게임 파일은 고치지 않는다(메모리에서 함수만 감싼다). 출력은 표준 출력.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));

const args = process.argv.slice(2);
const N = +(args.find((a) => /^\d+$/.test(a)) || 200);
const pols = (args.find((a) => /^[a-z][a-z0-9_,]*$/.test(a)) || 'balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,h_cautious,h_wary,h_mixed').split(',');
const bo = args.find((a) => a.startsWith('--blocks='));
const blocks = bo ? bo.slice(9).split(',').map(Number) : [1, 1001];

const LADDER_EV = ['dawn_strike', 'dawn_mob', 'called_up', 'd10_hold', 'd10_grab', 'repay_bowl'];
const meWho = (w) => w == null || w === 'you' || w === 'self';
const killsYou = (c) => [c.out, c.ok, c.fail].some((o) => o && o.effects && o.effects.kill && (Array.isArray(o.effects.kill) ? o.effects.kill : [o.effects.kill]).some((kv) => meWho(kv && kv.who)));
const karmaDelta = (o) => { if (!o || !o.effects || o.effects.karma == null) return 0; const k = o.effects.karma; const l = Array.isArray(k) ? k : [k]; return l.reduce((a, x) => a + (typeof x === 'number' ? x : (x && x.n) || 0), 0); };

let cur = null;   // 지금 판 기록
const origDispatch = E.dispatch;
E.dispatch = function (s, a, dbx) {
  if (!cur) return origDispatch.apply(this, arguments);
  let pre = null;
  if (a && a.type === 'choose' && s.pending) {
    const ev = dbx.events[s.pending.id];
    const c0 = ev.choices[a.i];
    const st = c0 ? E.choiceState(s, dbx, ev, c0) : null;
    const c = c0 ? E.effChoice(s, dbx, c0) : null;
    // 이 창의 열린 선택지 가운데 당신이 죽지 않는 것 · 카르마를 줄이는 것(갚는 길) · 비용 없이 죽지 않는 것(버티는 길)
    const open = ev.choices.map((x) => ({ x, st: E.choiceState(s, dbx, ev, x), e: E.effChoice(s, dbx, x) })).filter((o) => !o.st.locked);
    const safe = open.filter((o) => !killsYou(o.e));
    const repay = open.filter((o) => [o.e.out, o.e.ok].some((q) => karmaDelta(q) < 0));
    const endureFree = safe.filter((o) => !o.e.cost || !Object.keys(o.e.cost).length);
    pre = { day: s.day, phase: s.phase, ev: ev.id, i: a.i, label: c0 && c0.label, taboo: !!(c && c.taboo), warn: c ? `${c.warn || ''} ${c.hint || ''}`.trim() : '', check: c && c.check ? c.check.skill + c.check.base : '', swapped: c !== c0,
      karma: s.world.karma || 0, injury: s.people.you.n.injury || 0, deadly: c ? killsYou(c) : false, safeOpen: safe.length, repayOpen: repay.length, freeSafe: endureFree.length, nOpen: open.length, locked: st && st.locked };
  }
  const r = origDispatch.apply(this, arguments);
  if (pre && r.ok) {
    pre.karmaAfter = s.world.karma || 0;
    const lr = s.lastResult || {};
    pre.roll = lr.roll ? (lr.roll.success ? 'ok' : 'fail') : '';
    pre.died = s.people.you.status !== 'home';
    cur.choices.push(pre);
    if (!pre.safeOpen) cur.noSafe.push(pre);
  }
  if (a && a.type === 'next' && r.ok && s.phase === 'trace' && !s.ended) snap(s, dbx);
  return r;
};
// 아침(흔적 단계)마다 화면에 보일 신호: 역에 있는 사람 가운데 등 돌림(signs.cold)·차가운 호칭·밀린 그릇
function snap(s, dbx) {
  const v = E.view(s, dbx);
  const home = v.people.filter((p) => p.id !== 'you' && p.status === 'home' && p.met);
  const cold = home.filter((p) => p.signs && p.signs.cold).map((p) => p.id);
  const coldAddr = home.filter((p) => { const row = dbx.people[p.id]; return row && typeof row.addressCold === 'string' && p.address === row.addressCold && (s.people[p.id].n.grudge || 0) >= 5; }).map((p) => p.id);
  const bowl = s.traces.bowl_you ? s.traces.bowl_you.st : '';
  cur.mornings.push({ day: s.day, karma: s.world.karma || 0, home: home.length, cold, coldAddr, bowl, maxGrudge: Math.max(0, ...home.map((p) => s.people[p.id].n.grudge || 0)) });
}

const out = {};
for (const pol of pols) {
  const runs = [];
  for (const b0 of blocks) for (let seed = b0; seed < b0 + N; seed++) {
    cur = { seed, choices: [], mornings: [], noSafe: [] };
    const { s } = B.play(db, seed, pol);
    cur.end = { why: s.ended && s.ended.why, you: s.people.you.status, day: s.day, karma: s.world.karma || 0, cause: s.ended && s.ended.cause, hurt: (s.hurt || []).map((h) => h.src) };
    runs.push(cur); cur = null;
  }
  out[pol] = runs;
}

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const lines = [];
const P = (x) => { lines.push(x); console.log(x); };
P(`# verify_A1 probe — 정책 ${pols.length} × ${N}판 × 블록 ${blocks.join(',')} (${new Date().toISOString()})`);
for (const pol of pols) {
  const runs = out[pol]; const n = runs.length;
  const dead = runs.filter((r) => r.end.you !== 'home' && r.end.you !== 'boarded' && r.end.you !== 'left' && r.end.why !== 'd10_train' && (r.end.you === 'dead' || r.end.you === 'ascended'));
  const taboos = runs.flatMap((r) => r.choices.filter((c) => c.taboo));
  const tabooOther = taboos.filter((c) => /그 사람|남의|옆 |다른/.test(`${c.label} ${c.warn}`));
  const tabooFree = taboos.filter((c) => !c.deadly);
  const tabooSwapped = runs.flatMap((r) => r.choices.filter((c) => c.swapped && c.deadly && /가리킨다|다른 이름|다른 사람|옆 담요/.test(c.label)));
  const maxK = runs.map((r) => Math.max(0, ...r.choices.map((c) => c.karmaAfter || 0), r.end.karma));
  const reach8 = runs.filter((r, k) => maxK[k] >= 8);
  // 죽음 분류
  const cls = {};
  for (const r of dead) {
    const last = r.choices[r.choices.length - 1] || {};
    let k;
    if (last.swapped && /가리킨다|다른 이름|다른 사람|옆 담요/.test(last.label || '')) k = 'A 카르마로 판정이 된 금기를 다시 고름(talk 실패)';
    else if (LADDER_EV.includes(last.ev)) k = `B 돌아온 사건(${last.ev})에서 버티기 대신 주사위 '${last.label}'`;
    else if (last.ev === 'fever_night') k = 'C 열병(부상 깔때기)';
    else k = `D 그 밖(${last.ev}/${last.label})`;
    cls[k] = (cls[k] || 0) + 1;
  }
  const firstTabooDay = runs.map((r) => { const t = r.choices.find((c) => c.taboo && c.karmaAfter > c.karma); return t ? t.day : null; });
  const lags = dead.map((r) => { const k = runs.indexOf(r); return firstTabooDay[k] != null ? r.end.day - firstTabooDay[k] : null; }).filter((x) => x != null);
  P(`\n## ${pol} — ${n}판 · 생존 ${pct(n - dead.length, n)}% · 사망 ${pct(dead.length, n)}%`);
  P(`- 금기 고름 ${taboos.length}회(판당 ${(taboos.length / n).toFixed(2)}) · 그중 남을 내미는 금기 ${tabooOther.length} · 그 순간 위험 0(죽는 결과 없음) ${tabooFree.length} (${pct(tabooFree.length, taboos.length)}%)`);
  P(`- 카르마 8 이상 닿은 판 ${pct(reach8.length, n)}% · 판 끝 카르마 평균 ${(runs.reduce((a, r) => a + r.end.karma, 0) / n).toFixed(2)} · 최대 20 닿은 판 ${pct(maxK.filter((x) => x >= 20).length, n)}%`);
  P(`- 카르마 8+ 로 판정이 된 남을 내미는 금기를 고른 횟수 ${tabooSwapped.length} (그중 실패 사망 ${tabooSwapped.filter((c) => c.roll === 'fail').length})`);
  const evCount = {}; for (const r of runs) for (const c of r.choices) if (LADDER_EV.includes(c.ev)) { const key = `${c.ev}: ${c.label}${c.swapped ? ' [swap]' : ''}${c.roll ? ' (' + c.roll + ')' : ''}${c.died ? ' †' : ''}`; evCount[key] = (evCount[key] || 0) + 1; }
  P(`- 돌아온 사건에서 고른 것: ${Object.entries(evCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`);
  P(`- 사망 분류: ${Object.entries(cls).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`);
  if (lags.length) P(`- 첫 '카르마가 오른 금기'에서 죽음까지 날 수: 평균 ${(lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(2)} · 0일(같은 날) ${lags.filter((x) => x === 0).length} · 1~2일 ${lags.filter((x) => x >= 1 && x <= 2).length} · 3일+ ${lags.filter((x) => x >= 3).length}`);
  // 신호가 먼저 보였나: 돌아온 사건(카르마·원한) 첫 창 전날까지의 아침에 등 돌림이 보였나
  let firstLadder = 0, signBefore = 0, addrBefore = 0, bowlBefore = 0, noSignRuns = [];
  for (const r of runs) {
    const fl = r.choices.find((c) => ['dawn_strike', 'dawn_mob', 'called_up', 'd10_hold'].includes(c.ev) && (c.karma >= 3 || c.ev !== 'called_up'));
    if (!fl) continue;
    firstLadder++;
    const ms = r.mornings.filter((m) => m.day <= fl.day);
    if (ms.some((m) => m.cold.length)) signBefore++; else noSignRuns.push(`${r.seed}:${fl.ev}@D${fl.day}/k${fl.karma}`);
    if (ms.some((m) => m.coldAddr.length)) addrBefore++;
    if (ms.some((m) => m.bowl === 'pushed')) bowlBefore++;
  }
  P(`- 돌아온 사건(새벽 습격·둘러섬·이름 불림·소매)이 처음 온 판 ${firstLadder} · 그날 아침까지 등 돌림이 보였던 판 ${signBefore} (${pct(signBefore, firstLadder)}%) · 차가운 호칭 ${addrBefore} (${pct(addrBefore, firstLadder)}%) · 밀린 그릇 ${bowlBefore} (${pct(bowlBefore, firstLadder)}%)`);
  if (noSignRuns.length) P(`  · 신호 없이 온 판 예: ${noSignRuns.slice(0, 8).join(' ')}`);
  // 카르마 8 이상인데 그날 아침 등 돌린 사람이 없는 아침(카르마는 높은데 화면에 신호 없음)
  const hiNoSign = runs.flatMap((r) => r.mornings.filter((m) => m.karma >= 8 && !m.cold.length));
  const hiM = runs.flatMap((r) => r.mornings.filter((m) => m.karma >= 8));
  P(`- 카르마 8+ 인 아침 ${hiM.length} 중 등 돌린 사람이 하나도 안 보인 아침 ${hiNoSign.length} (${pct(hiNoSign.length, hiM.length)}%) — 그중 역에 아무도 없는 아침 ${hiNoSign.filter((m) => !m.home).length}`);
  // 늘 열린 길: 이 정책이 만난 모든 창에서 죽지 않는 열린 선택지 0개였던 창 / 돌아온 사건에서 비용 없이 버티는 길이 닫힌 창 / 갚는 길이 열린 창 비율
  const all = runs.flatMap((r) => r.choices);
  const ladderW = all.filter((c) => ['dawn_strike', 'dawn_mob', 'called_up', 'd10_hold'].includes(c.ev));
  P(`- 창 ${all.length}개 중 안 죽는 열린 선택지 0개 ${runs.reduce((a, r) => a + r.noSafe.length, 0)} · 돌아온 사건 창 ${ladderW.length} 중 비용 없이 안 죽는 길 닫힘 ${ladderW.filter((c) => !c.freeSafe).length} · 카르마를 줄이는 길 열림 ${ladderW.filter((c) => c.repayOpen).length} (${pct(ladderW.filter((c) => c.repayOpen).length, ladderW.length)}%)`);
  const fev = all.filter((c) => c.ev === 'fever_night');
  const fevTab = fev.filter((c) => c.taboo);
  P(`- 열병 창 ${fev.length} · 그중 '남의 담요'(금기, 위험 0) 고름 ${fevTab.length} · 그때 카르마 8+ ${fevTab.filter((c) => c.karma >= 8).length} · 14+ ${fevTab.filter((c) => c.karma >= 14).length}`);
}
require('fs').writeFileSync(path.join(__dirname, 'probe_a1_out_' + pols.join('_') + '.json'), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.slice(0, 40)])), null, 0));
