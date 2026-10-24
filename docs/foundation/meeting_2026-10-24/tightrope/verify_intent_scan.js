// 적대적 검증 (10-24 tightrope) — 사건 전수 정적 조사. 표·엔진은 고치지 않는다(읽기만).
// node docs/foundation/meeting_2026-10-24/tightrope/verify_intent_scan.js > .../verify_intent_scan.txt
// 모든 사건 × karma × 눈먼 새벽 × 영구 손상 조합 × 자원(0/넉넉) × 기술(0/처음) × 대상(있음/없음) × 앞선 횟수(0/1)
//  - 확정 사망(열린 선택지 전부 살 확률 0) 조합이 있나
//  - 열린 선택지 중 '가장 높은 살 확률'의 최저값(사건별)
//  - 카르마 ≥ 5 에서 당신이 죽을 수 있는 사건(위험 사건)에 위험 0(살 확률 1) 출구가 남는가 — 사건별 목록
//  - 줄타기 선택지의 화면 % 가 30 밑으로 가는 조합이 있나
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));

const KARMAS = [0, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 20, 30];
const PERMS = [[], ['finger'], ['leg'], ['ear'], ['finger', 'leg'], ['finger', 'ear'], ['leg', 'ear'], ['finger', 'leg', 'ear']];
const base = E.newGame(db, 12345);
const residents = db.peopleOrder.filter((id) => id !== 'you');
const clone = (o) => JSON.parse(JSON.stringify(o));

const res = {};
let combos = 0, forcedCombos = [], ropeLow = [];
for (const ev of db.eventsList) {
  const r = res[ev.id] = { kind: ev.kind, when: ev.when, dangerAny: false, minBest: 1, minBestAt: null, risk0AtK5: new Set(), risk0Combos: 0, k5Combos: 0, forced: 0, ropeChoices: ev.choices.filter((c) => c.rope).length };
  for (const k of KARMAS) for (const blind of [false, true]) for (const perm of PERMS) for (const rich of [false, true]) for (const sk0 of [false, true]) for (const tgt of [true, false]) for (const fired of [0, 1]) {
    const s = clone(base);
    s.world.karma = k;
    s.flags.strike_blind = blind;
    for (const p of ['finger', 'leg', 'ear']) { if (perm.includes(p)) { s.people.you.permanent[p] = 1; s.flags['you_' + p] = true; } }
    for (const w of ['food', 'water', 'fuel', 'meds']) s.world[w] = rich ? 9 : 0;
    if (sk0) for (const x of Object.keys(s.people.you.skills)) s.people.you.skills[x] = 0;
    s.fired = s.fired || {}; if (fired) s.fired[ev.id] = 1;
    s.phase = (ev.when || '').includes('phase==trace') ? 'trace' : (ev.when || '').includes('phase==day') ? 'day' : 'night';
    const dm = /day==(\d+)/.exec(ev.when || ''); s.day = dm ? +dm[1] : 5;
    for (const id of residents) if (s.people[id]) s.people[id].status = 'home';
    s.pending = { id: ev.id, target: tgt ? residents[0] : null };
    let view; try { view = E.eventView(s, db); } catch (e) { continue; }
    combos++;
    const open = [];
    ev.choices.forEach((c0, i) => {
      const st = view.choices[i];
      if (st.locked) return;
      const c = E.effChoice(s, db, c0);
      const p = E.survival(c, st.chance);
      open.push({ i, p, label: c.label, roped: !!c.roped, chance: st.chance, kills: E.killsYou(c) });
      if (c.roped && st.chance != null && st.chance < 30) ropeLow.push(`${ev.id}[${i}] k${k} blind${+blind} chance ${st.chance}`);
    });
    if (!open.length) continue;
    const anyKill = open.some((o) => o.kills);
    if (anyKill) r.dangerAny = true;
    const best = Math.max(...open.map((o) => o.p));
    if (anyKill && best < r.minBest) { r.minBest = best; r.minBestAt = `k${k} blind${+blind} perm[${perm}] rich${+rich} sk0${+sk0} tgt${+tgt} fired${fired}`; }
    if (best === 0) { r.forced++; forcedCombos.push(`${ev.id} k${k} blind${+blind} perm[${perm}] rich${+rich} sk0${+sk0} tgt${+tgt} fired${fired}: ${open.map((o) => o.label).join(' / ')}`); }
    if (k >= 5 && anyKill) { r.k5Combos++; const z = open.filter((o) => o.p === 1); if (z.length) { r.risk0Combos++; z.forEach((o) => r.risk0AtK5.add(`[${o.i}] ${o.label}`)); } }
  }
}
console.log('조합 수', combos);
console.log('\n== 확정 사망 조합(열린 선택지 전부 살 확률 0) ==', forcedCombos.length);
forcedCombos.slice(0, 60).forEach((x) => console.log('  ' + x));
console.log('\n== 줄타기 선택지 화면 % < 30 ==', ropeLow.length);
ropeLow.slice(0, 20).forEach((x) => console.log('  ' + x));
console.log('\n== 위험 사건(당신을 죽일 수 있는 선택지가 열리는 사건): 가장 높은 살 확률의 최저값 ==');
for (const [id, r] of Object.entries(res)) if (r.dangerAny) console.log(`  ${id.padEnd(24)} 줄타기 ${r.ropeChoices} · 최저 best ${r.minBest} @ ${r.minBestAt}`);
console.log('\n== 카르마 ≥ 5 위험 사건에 남은 위험 0 출구 (조합 중 위험 0 출구가 열린 비율) ==');
for (const [id, r] of Object.entries(res)) if (r.k5Combos) console.log(`  ${id.padEnd(24)} 줄타기 ${r.ropeChoices} · 위험0 열림 ${r.risk0Combos}/${r.k5Combos} · ${Array.from(r.risk0AtK5).join(' | ') || '없음'}`);
