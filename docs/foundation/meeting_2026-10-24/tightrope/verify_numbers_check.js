// 적대적 검증 (verify_numbers) — 엔진의 forced·warned 깃발을 믿지 않고 직접 잰다. 표·엔진은 고치지 않는다.
// node docs/foundation/meeting_2026-10-24/tightrope/verify_numbers_check.js [판수=120] [시드0=120001] [시도=40]
//  1) 당신이 '선택'으로 죽은 판마다: 고르기 직전 상태를 복사해, 그때 화면(eventView)에 열린 선택지를 하나씩 '시도'번 다른 난수로 골라 본다.
//     어느 선택지로도 한 번도 안 살면 = 확정(강제) 사망. (엔진 survival 계산을 쓰지 않는 경험적 확인)
//  2) 죽은 선택지에 화면 경고 글(warn·hint)이 있었나, 화면 % 가 있었나 (화면 eventView 그대로)
//  3) 모든 선택 시점: 화면에 열린 '죽을 수 있는 판정'(실패가 당신을 죽임)의 화면 % 최저값 · 30 미만 수
//  4) 줄타기 판정을 고른 굴림: 화면 % 평균 대 실제 성공률 · 화면 % 와 엔진이 굴린 % 가 다른 경우 수
//  5) 선택이 아닌 죽음(밤 사건·새벽 위독 등) 수
//  6) 화면 eventView 에 karma 글자/숫자가 새는지(글에 '카르마' 또는 karma 키)
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const db = T.loadDir(path.join(ROOT, 'v4/data'));

const args = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const N = args[0] || 120, SEED0 = args[1] || 120001, TRIES = args[2] || 40;
const pols = Object.keys(B.POLICIES);

const killMe = (o) => { if (!o || !o.effects || !o.effects.kill) return false; const ks = [].concat(o.effects.kill); return ks.some((k) => { const w = k && typeof k === 'object' ? k.who : k; return !w || ['you', 'self', 'actor', 'party', 'all'].includes(w); }); };

const orig = E.dispatch;
let ctx = null;   // 이번 판 수집
E.dispatch = function (s, a, dbx) {
  if (!a || a.type !== 'choose' || !s.pending || s.ended) return orig.call(this, s, a, dbx);
  const pre = JSON.stringify(s);
  const view = E.eventView(s, dbx);
  const ev = dbx.events[s.pending.id];
  // 3) 화면에 열린 죽음 판정의 % (실패가 당신을 죽임 — 엔진 effChoice 로 모습만 얻고, 죽임 판정은 여기서 직접)
  view.choices.forEach((cv, j) => {
    if (cv.locked) return;
    const c = E.effChoice(s, dbx, ev.choices[j]);
    if (c.check && killMe(c.fail) && !killMe(c.ok)) { ctx.deathRollsShown++; if (cv.chance < ctx.minShown) ctx.minShown = cv.chance; if (cv.chance < 30) ctx.below30.push(`${ev.id}/${cv.label} ${cv.chance}%`); if (!(cv.warn || cv.hint)) ctx.rollNoWarn.push(`${ev.id}/${cv.label}`); }
  });
  // 6) karma 새는지
  const vj = JSON.stringify(view);
  if (/karma|카르마/.test(vj)) ctx.karmaLeak.push(ev.id);
  const i = a.i;
  const pickC = E.effChoice(s, dbx, ev.choices[i]);
  const r = orig.call(this, s, a, dbx);
  if (!r.ok) return r;
  const lr = s.lastResult || {};
  if (pickC.roped && lr.roll) { ctx.ropePicked++; ctx.ropeShownSum += view.choices[i].chance; if (lr.roll.success) ctx.ropeOk++; if (lr.roll.chance !== view.choices[i].chance) ctx.ropeMismatch++; }
  if (pickC.check && lr.roll && killMe(pickC.fail)) { ctx.drPicked++; ctx.drShownSum += view.choices[i].chance; if (lr.roll.success) ctx.drOk++; }
  if (s.people.you.status !== 'home' && !ctx.deathAt) ctx.deathAt = { pre, view, ev: ev.id, i, label: view.choices[i].label, warn: view.choices[i].warn, hint: view.choices[i].hint, chance: view.choices[i].chance };
  return r;
};

function tryChoice(pre, j, k) {
  const s = JSON.parse(pre);
  s.rng = (Math.imul(k + 1, 2654435761) ^ (s.rng * 31 + j * 7919)) >>> 0;
  const r = orig(s, { type: 'choose', i: j }, db);
  if (!r.ok) return null;
  return s.people.you.status === 'home';
}

const tot = {}; const forcedList = []; const unwarnedList = []; const nonChoice = {};
let G = { deathRollsShown: 0, minShown: 101, below30: [], rollNoWarn: [], karmaLeak: [], ropePicked: 0, ropeShownSum: 0, ropeOk: 0, ropeMismatch: 0, drPicked: 0, drShownSum: 0, drOk: 0 };
const t0 = Date.now();
for (const p of pols) {
  const st = (tot[p] = { n: 0, dead: 0, choiceDeaths: 0, nonChoice: 0, empForced: 0, noWarn: 0, noChanceAndNoDeathText: 0, minBestSurv: 1 });
  for (let seed = SEED0; seed < SEED0 + N; seed++) {
    ctx = { deathRollsShown: 0, minShown: 101, below30: [], rollNoWarn: [], karmaLeak: [], ropePicked: 0, ropeShownSum: 0, ropeOk: 0, ropeMismatch: 0, drPicked: 0, drShownSum: 0, drOk: 0, deathAt: null };
    const { s } = B.play(db, seed, p);
    st.n++;
    for (const k of ['deathRollsShown', 'ropePicked', 'ropeShownSum', 'ropeOk', 'ropeMismatch', 'drPicked', 'drShownSum', 'drOk']) G[k] += ctx[k];
    G.minShown = Math.min(G.minShown, ctx.minShown); G.below30.push(...ctx.below30); G.rollNoWarn.push(...ctx.rollNoWarn); G.karmaLeak.push(...ctx.karmaLeak);
    const you = s.people.you;
    const dead = you.status === 'dead' || you.status === 'ascended';
    if (!dead) continue;
    st.dead++;
    const d = ctx.deathAt;
    const cause = s.ended && s.ended.cause;
    if (!d || !cause || cause.night || cause.event !== d.ev) { st.nonChoice++; const k = cause ? cause.event : s.ended ? s.ended.why : '?'; nonChoice[k] = (nonChoice[k] || 0) + 1; continue; }
    st.choiceDeaths++;
    // 1) 경험적 강제 판정
    let best = 0; const per = [];
    d.view.choices.forEach((cv, j) => {
      if (cv.locked) return;
      let live = 0, tried = 0;
      for (let k = 0; k < TRIES; k++) { const ok = tryChoice(d.pre, j, k); if (ok == null) break; tried++; if (ok) live++; }
      const f = tried ? live / tried : 0; per.push(`${cv.label}=${Math.round(100 * f)}%`); if (f > best) best = f;
    });
    st.minBestSurv = Math.min(st.minBestSurv, best);
    if (best === 0) { st.empForced++; forcedList.push(`${p} seed ${seed} D${s.day} ${d.ev} [${per.join(', ')}]`); }
    // 2) 경고
    if (!(d.warn || d.hint)) { st.noWarn++; unwarnedList.push(`${p} seed ${seed} ${d.ev}/${d.label} (화면 경고 없음)`); }
  }
}
const lines = [];
lines.push(`적대적 검증 — 정책 ${pols.length} × ${N}판 (시드 ${SEED0}~${SEED0 + N - 1}), 죽은 선택마다 열린 선택지 각 ${TRIES}번 다시 굴림. ${((Date.now() - t0) / 1000).toFixed(1)}초`);
lines.push('');
lines.push('| 정책 | 판 | 사망 | 선택으로 죽음 | 선택 아닌 죽음 | 경험적 확정 사망 | 화면 경고 없는 죽음 | 죽은 자리의 가장 좋은 살 길(최저) |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const p of pols) { const t = tot[p]; lines.push(`| ${p} | ${t.n} | ${t.dead} | ${t.choiceDeaths} | ${t.nonChoice} | ${t.empForced} | ${t.noWarn} | ${t.choiceDeaths ? Math.round(100 * t.minBestSurv) + '%' : '-'} |`); }
const sum = (k) => pols.reduce((a, p) => a + tot[p][k], 0);
lines.push('');
lines.push(`합계: 사망 ${sum('dead')} · 선택으로 죽음 ${sum('choiceDeaths')} · 선택 아닌 죽음 ${sum('nonChoice')} ${JSON.stringify(nonChoice)} · 경험적 확정 사망 ${sum('empForced')} · 화면 경고 없는 죽음 ${sum('noWarn')}`);
lines.push(`화면에 열린 '죽을 수 있는 판정' ${G.deathRollsShown}개: 화면 % 최저 ${G.minShown} · 30 미만 ${G.below30.length}개 · 경고 글 없는 죽음 판정 ${G.rollNoWarn.length}개`);
lines.push(`고른 줄타기 판정 ${G.ropePicked}번: 화면 % 평균 ${(G.ropeShownSum / Math.max(1, G.ropePicked)).toFixed(2)} · 실제 성공률 ${(100 * G.ropeOk / Math.max(1, G.ropePicked)).toFixed(2)}% · 화면 %≠굴린 % ${G.ropeMismatch}`);
lines.push(`고른 죽음 판정 전체 ${G.drPicked}번: 화면 % 평균 ${(G.drShownSum / Math.max(1, G.drPicked)).toFixed(2)} · 실제 성공률 ${(100 * G.drOk / Math.max(1, G.drPicked)).toFixed(2)}%`);
lines.push(`화면 eventView 에 karma/카르마: ${G.karmaLeak.length}건 ${[...new Set(G.karmaLeak)].slice(0, 10).join(',')}`);
if (G.below30.length) lines.push('30 미만 예: ' + [...new Set(G.below30)].slice(0, 15).join(' / '));
if (G.rollNoWarn.length) lines.push('경고 없는 죽음 판정 예: ' + [...new Set(G.rollNoWarn)].slice(0, 15).join(' / '));
if (forcedList.length) lines.push('경험적 확정 사망:\n' + forcedList.slice(0, 40).join('\n'));
if (unwarnedList.length) lines.push('화면 경고 없는 죽음:\n' + unwarnedList.slice(0, 40).join('\n'));
console.log(lines.join('\n'));
