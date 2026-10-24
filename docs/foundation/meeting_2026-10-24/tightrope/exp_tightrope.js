// 10-24 줄타기 설계 시험(메모리에서만 — 표·엔진 파일은 그대로). design.md 의 예상 수치를 낸다.
// node docs/foundation/meeting_2026-10-24/tightrope/exp_tightrope.js <변형=base|design|…> [정책,…] [판수=200] [--blocks=1,1001,2001,3001] [--probe]
//   변형: patches.js 의 VARIANTS 이름. base = 지금 표 그대로.
//   엔진은 고치지 않는다. 대신 E.dispatch 를 감싸 '살 확률'(선택지마다 판정 % 로 계산)을 재고, 새 강제 사망 정의(열린 선택지 모두 살 확률 0)를 센다.
const path = require('path');
const { fork } = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const flag = (k) => args.includes(`--${k}`);
const pos = args.filter((a) => !a.startsWith('--'));
const VARIANT = pos[0] || 'base';
const POLS = (pos[1] || 'balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,lazy,diligent,risky,h_cautious,h_first,h_cautious2,devoted').split(',');
const N = Number(pos[2] || 200);
const BLOCKS = (opt('blocks') || '1,1001,2001,3001').split(',').map(Number);
const PROBE = flag('probe');
const w = opt('worker');

const pctf = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const avg = (a) => (a.length ? Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length) / 100 : 0);

if (w) {
  const T = require(path.join(root, 'v4/engine/tables.js'));
  const E = require(path.join(root, 'v4/engine/engine.js'));
  const B = require(path.join(root, 'v4/sim/bots.js'));
  const S = require(path.join(root, 'v4/sim/stats.js'));
  const P = require(path.join(__dirname, 'patches.js'));
  if (!flag('nobotfix')) {
    // (설계 §1-6 봇 손질, 메모리에서만) 사람 흉내 cautious 류: 판정 없는 '죽음 글' 선택(대답한다 등)의 성공 % 를 100 이 아니라 0 으로 본다
    const Rg = require(path.join(root, 'v4/engine/rng.js'));
    const dt = B.deadlyText; const openOf = (ms) => ms.filter((c) => !c.locked); const warnedC = (c) => !!(c.warn || c.hint || c.taboo);
    const pickU = (s, set) => set[Math.floor(Rg.rand(s) * set.length)].i;
    const chanceOf = (c) => (c.chance != null ? c.chance : dt(c) ? 0 : 100);
    const cp = (s, ms, dice) => { const o = openOf(ms); if (!o.length) return ms[0].i; let set = o.filter((c) => !warnedC(c)); if (set.length) { const nc = set.filter((c) => !c.cost); return pickU(s, nc.length ? nc : set); }
      set = o.filter((c) => !dt(c) && !c.taboo); if (!set.length) { set = o.filter((c) => chanceOf(c) > 0); if (!set.length) set = o; }
      if (!dice) return pickU(s, set); const best = Math.max(...set.map(chanceOf)); return pickU(s, set.filter((c) => chanceOf(c) === best)); };
    const wp = (s, ms) => { const o = openOf(ms); if (!o.length) return ms[0].i; let nd = o.filter((c) => !dt(c)); if (!nd.length) nd = o.filter((c) => chanceOf(c) > 0); return pickU(s, nd.length ? nd : o); };
    B.HUMAN_PICK.wary = (s, ms) => wp(s, ms);
    B.HUMAN_PICK.cautious = (s, ms) => cp(s, ms, true); B.HUMAN_PICK.cautious2 = (s, ms) => cp(s, ms, false); B.HUMAN_PICK.mixed = (s, ms) => (Rg.rand(s) < 0.6 ? cp(s, ms, true) : wp(s, ms));
  }
  let db = T.loadDir(path.join(root, 'v4/data'));
  const raw = JSON.parse(JSON.stringify(db.raw));
  const applied = P.apply(VARIANT, raw);
  db = T.load(raw);
  const killsOut = (o) => !!o && E.killsYou({ out: o });
  const pSurv = (c, chance) => { if (c.check) { const ch = (chance == null ? 0 : chance) / 100; return ch * (killsOut(c.ok) ? 0 : 1) + (1 - ch) * (killsOut(c.fail) ? 0 : 1); } return killsOut(c.out) ? 0 : 1; };
  let REC = null;
  const orig = E.dispatch;
  E.dispatch = function (s, a, d) {
    if (!(a && a.type === 'choose' && s.pending && REC)) return orig.call(this, s, a, d);
    const ev = d.events[s.pending.id];
    const view = E.eventView(s, d);
    const karma = s.world.karma || 0;
    const opens = [];
    ev.choices.forEach((c0, i) => { const st = view.choices[i]; if (!st || st.locked) return; const c = E.effChoice(s, d, c0); const fk = c.check ? killsOut(c.fail) : false; opens.push({ i, p: pSurv(c, st.chance), taboo: !!c.taboo, cost: !!c.cost, deadly: !!c.check && fk, chance: st.chance, label: st.label }); });
    const ch = opens.find((o) => o.i === a.i);
    const day = s.day;
    if (ev.id === 'dawn_strike') { REC.strikes++; REC.blindLast = !!s.flags.strike_blind; if (s.flags.strike_blind) REC.blindN++; }
    const r = orig.call(this, s, a, d);
    if (r && r.ok && ch) {
      const maxP = Math.max(...opens.map((o) => o.p));
      const anyDeath = opens.some((o) => o.p < 1);
      const rec = { id: ev.id, day, karma, p: ch.p, maxP, safeOpen: opens.some((o) => o.p === 1), chosenSafe: ch.p === 1, anyDeath, deadly: ch.deadly, chance: ch.chance, label: ch.label, ok: !!(s.lastResult && s.lastResult.roll && s.lastResult.roll.success), taboo: ch.taboo };
      REC.ev.push(rec);
      if (ch.deadly) { REC.rolls++; if (rec.ok) { REC.close++; if (ch.chance <= 75) REC.tight++; } }
      if (ch.deadly && s.lastResult && s.lastResult.swapped) { REC.ropeRolls++; if (rec.ok) REC.ropeClose++; }
      if (anyDeath && maxP === 0) REC.noLife++;
    }
    return r;
  };
  const pub = new Set(db.nightEvents.filter((n) => n.public || (n.effects && n.effects.kill)).map((n) => n.id));
  const runs = [];
  const evStat = {};   // 사건별: 도달·카르마≥5 도달·안전 출구 열림·안전 출구 고름·죽음
  const missStat = {};
  for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) {
    REC = { ev: [], rolls: 0, close: 0, tight: 0, noLife: 0, ropeRolls: 0, ropeClose: 0, strikes: 0, blindN: 0 };
    const { s, trace } = B.play(db, seed, w);
    const m = S.measure(db, s, trace);
    const rows = s.nightLog.filter((e) => e.role !== 'clock' && e.role !== 'neglect');
    const priv = rows.filter((e) => !pub.has(e.id));
    m.privTotal = priv.length; m.privFound = priv.filter((e) => e.discovered).length; m.pubTotal = rows.length - priv.length;
    m.close = REC.close; m.tight = REC.tight; m.rolls = REC.rolls; m.noLife = REC.noLife; m.ropeRolls = REC.ropeRolls; m.ropeClose = REC.ropeClose; m.strikes = REC.strikes; m.blindN = REC.blindN; m.blindDead = m.dead && m.causeKey === 'dawn_strike' && REC.blindLast;
    m.deathNoLife = m.dead && !!(REC.ev.length && (() => { const L = REC.ev[REC.ev.length - 1]; return L.anyDeath && L.maxP === 0; })());
    m.block = b0;
    m.karmaSafe = REC.ev.filter((e) => e.karma >= 5 && e.anyDeath && e.safeOpen).length;
    runs.push(m);
    for (const e of REC.ev) { if (!e.anyDeath) continue; const k = evStat[e.id] = evStat[e.id] || { n: 0, k5: 0, safeOpen: 0, safeOpenK5: 0, chosenSafeK5: 0, dead: 0, labels: {} }; k.n++; if (e.karma >= 5) { k.k5++; if (e.safeOpen) k.safeOpenK5++; if (e.chosenSafe) k.chosenSafeK5++; k.labels[e.label] = (k.labels[e.label] || 0) + 1; } if (e.safeOpen) k.safeOpen++; }
    if (m.dead && m.causeKey && evStat[m.causeKey]) evStat[m.causeKey].dead++;
    for (const e of s.nightLog) if (e.role === 'neglect' && /~missed$/.test(e.id)) { const k = e.id.replace(/~missed$/, ''); missStat[k] = (missStat[k] || 0) + 1; }
  }
  const a = S.aggregate(db, runs);
  const per = BLOCKS.map((b0) => { const rs = runs.filter((r) => r.block === b0); return S.aggregate(db, rs).survived; });
  const sum = (k) => runs.reduce((x, r) => x + (r[k] || 0), 0);
  const surv = runs.filter((r) => r.survived);
  const out = {
    name: w, applied, n: runs.length, survived: a.survived, death: a.deathRate, per, top: a.topCause, topRoot: a.topRoot, byCause: a.byCause, dayEvent: a.dayEvent, byDay: a.byDay,
    forcedOld: a.forced, unwarned: a.unwarned, noLifeDeaths: runs.filter((r) => r.deathNoLife).length, noLifeEvents: sum('noLife'),
    ropeClose: avg(runs.map((r) => r.ropeClose)), ropeCloseSurv: avg(surv.map((r) => r.ropeClose)), ropeClose2: pctf(surv.filter((r) => r.ropeClose >= 2).length, surv.length), ropeRolls: avg(runs.map((r) => r.ropeRolls)),
    close: avg(runs.map((r) => r.close)), closeSurv: avg(surv.map((r) => r.close)), close2: pctf(surv.filter((r) => r.close >= 2).length, surv.length), tight: avg(runs.map((r) => r.tight)), rolls: avg(runs.map((r) => r.rolls)),
    karma: a.karma, karmaSafe: avg(runs.map((r) => r.karmaSafe)), aliveD4: a.aliveD4, deadByD5: a.deadByD5, daysLived: a.daysLived,
    neglect: a.neglect, privDisc: pctf(sum('privFound'), sum('privTotal')), privN: avg(runs.map((r) => r.privTotal)), pubN: avg(runs.map((r) => r.pubTotal)), discAll: a.discovery,
    strikes: avg(runs.map((r) => r.strikes)), blindN: avg(runs.map((r) => r.blindN)), blindDead: runs.filter((r) => r.blindDead).length,
    home9: a.home9, res7: a.res7, allDead: a.allDead, evStat: PROBE ? evStat : null, missStat: PROBE ? missStat : null,
    perBlock: BLOCKS.map((b0) => { const rs = runs.filter((r) => r.block === b0); return { surv: S.aggregate(db, rs).survived, dead: S.aggregate(db, rs).deathRate }; }),
  };
  process.send(out, () => process.exit(0));
} else {
  const res = {}; let live = 0; const q = POLS.slice(); const t0 = Date.now();
  const fmtCause = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n || 5).map(([k, v]) => `${k} ${v}`).join(' · ');
  const done = () => {
    const L = [];
    L.push(`# 변형 ${VARIANT} — ${N}판 × ${BLOCKS.length}블록 (${BLOCKS.join(',')}), ${Math.round((Date.now() - t0) / 1000)}초`);
    const ap = res[POLS[0]] && res[POLS[0]].applied; if (ap) L.push(`바꾼 칸 ${ap.length}: ${ap.slice(0, 60).join(' / ')}${ap.length > 60 ? ' …' : ''}`);
    L.push('| 정책 | 생존% | 블록별 생존% | 사망% | 확정사망(살 확률 0) | 옛 강제 | 경고 없는 사망 | 넘긴 죽음 판정/판 (산 판) | 산 판 중 ≥2번% | 줄타기 판정 넘김/판 (산 판) · 산 판 중 ≥2번% · 굴림/판 | ≤75% 넘김/판 | 죽음 판정 굴림/판 | 카르마 | 카르마≥5에서 안전 출구 열린 사건/판 | D1~D4 생존 | D5까지 사망 | 사인 1위 | 원인 1위 |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const p of POLS) { const r = res[p]; if (!r) continue; L.push(`| ${p} | ${r.survived} | ${r.per.join(' / ')} | ${r.death} | ${r.noLifeDeaths} | ${r.forcedOld} | ${r.unwarned} | ${r.close} (${r.closeSurv}) | ${r.close2} | ${r.ropeClose} (${r.ropeCloseSurv}) · ${r.ropeClose2} · ${r.ropeRolls} | ${r.tight} | ${r.rolls} | ${r.karma} | ${r.karmaSafe} | ${r.aliveD4} | ${r.deadByD5} | ${r.top.k} ${r.top.share}% | ${r.topRoot.k} ${r.topRoot.share}% |`); }
    L.push('');
    L.push('| 정책 | 날별 그날 사건 사망 D2·D3·D4·D5·D6 | 못 본 일/판 | 실제 발견%(누구나 아는 밤 뺌) | 숨은 밤/판 | 누구나 아는 밤/판 | 옛 발견% | D9 주민 | D7 자원 | 전멸% | 새벽 습격/판 · 그중 눈먼 새벽/판 · 눈먼 새벽 사망 |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const p of POLS) { const r = res[p]; if (!r) continue; const de = [2, 3, 4, 5, 6].map((d) => r.dayEvent[d] || 0).join('·'); L.push(`| ${p} | ${de} | ${r.neglect} | ${r.privDisc} | ${r.privN} | ${r.pubN} | ${r.discAll} | ${r.home9} | ${r.res7} | ${r.allDead} | ${r.strikes} · ${r.blindN} · ${r.blindDead} |`); }
    L.push('');
    for (const p of POLS) { const r = res[p]; if (!r) continue; L.push(`- ${p} 사인: ${fmtCause(r.byCause, 7)}`); }
    const pair = (a, b) => (res[a] && res[b] ? res[a].perBlock.map((x, i) => Math.round(10 * (x.surv - res[b].perBlock[i].surv)) / 10) : null);
    const dl = pair('balanced', 'lazy'), dd = pair('diligent', 'lazy');
    if (dl) L.push(`- 보통−게으름 생존: 합산 ${Math.round(10 * (res.balanced.survived - res.lazy.survived)) / 10}%p · 블록 ${dl.join(' / ')}`);
    if (dd) L.push(`- 부지런−게으름 생존: 합산 ${Math.round(10 * (res.diligent.survived - res.lazy.survived)) / 10}%p · 블록 ${dd.join(' / ')}`);
    if (res.balanced) for (const p of ['selfish', 'selfish_nb', 'selfish_rt', 'selfish_rt0']) if (res[p]) L.push(`- ${p} − 균형 생존: ${Math.round(10 * (res[p].survived - res.balanced.survived)) / 10}%p · 블록 ${pair(p, 'balanced').join(' / ')}`);
    if (PROBE) for (const p of POLS) { const r = res[p]; if (!r || !r.evStat) continue; L.push(`\n## ${p} 사건별 (죽을 수 있는 사건만): 도달 · 카르마≥5 도달 · 그때 안전 출구 열림 · 안전 출구 고름 · 그 사건 사망 · 카르마≥5 고른 것`); for (const [k, v] of Object.entries(r.evStat).sort((x, y) => y[1].n - x[1].n)) L.push(`  ${k}: ${v.n} · ${v.k5} · ${v.safeOpenK5} · ${v.chosenSafeK5} · ${v.dead} · ${fmtCause(v.labels, 4)}`); L.push(`  못 본 일(missed) 행별: ${fmtCause(r.missStat, 12)}`); }
    const txt = L.join('\n');
    console.log(txt);
    const of = opt('out'); if (of) require('fs').writeFileSync(path.join(__dirname, of), txt + '\n');
  };
  const next = () => {
    if (!q.length && !live) { done(); return; }
    while (live < Number(opt("workers") || 8) && q.length) {
      const p = q.shift(); live++;
      const ch = fork(__filename, args.concat([`--worker=${p}`]), { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      ch.on('message', (m) => { res[m.name] = m; });
      ch.on('exit', () => { live--; next(); });
    }
  };
  next();
}
