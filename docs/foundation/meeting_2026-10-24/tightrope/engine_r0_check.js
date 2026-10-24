// 10-24 줄타기 엔진 몫 확인 (엔진 담당): 설계안을 rope 칸(R0)으로 넣은 표 ↔ 메모리 시험(patches.js 의 swap 펼침) — 봇 판이 같은가, 그리고 새 집계(stats)가 설계 §0 값을 내는가.
// 표 파일은 고치지 않는다(메모리에서만). dark_station 에서:
//   node docs/foundation/meeting_2026-10-24/tightrope/engine_r0_check.js same [정책,…] [판수=30]          → 두 표의 판 결과 해시 비교
//   node docs/foundation/meeting_2026-10-24/tightrope/engine_r0_check.js stats [정책,…] [판수=200] [--blocks=1,1001,2001,3001] [--out=파일]  → R0 표로 새 집계
// R0 표 = v4/data + rope 칸 30개(설계 §1-3) + 눈먼 새벽 rope.blind 3개 + 꼬리 줄 rope_tail_*(메모리 시험과 같은 '잘못되면 끝이다') + 메모리 시험의 a4:b·gsy·boilside:7·눈먼 새벽 깃발(표 값)
const path = require('path');
const { fork } = require('child_process');
const crypto = require('crypto');
const root = path.join(__dirname, '..', '..', '..', '..');
const T = require(path.join(root, 'v4/engine/tables.js'));
const E = require(path.join(root, 'v4/engine/engine.js'));
const B = require(path.join(root, 'v4/sim/bots.js'));
const ST = require(path.join(root, 'v4/sim/stats.js'));
const P = require(path.join(__dirname, 'patches.js'));

const args = process.argv.slice(2);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const pos = args.filter((a) => !a.startsWith('--'));
const MODE = pos[0] || 'same';
const POLS = (pos[1] || 'balanced,selfish,selfish_nb,selfish_rt,selfish_rt0,lazy,diligent,risky,h_cautious,h_first,h_cautious2,devoted,counter,child,h_wary,h_mixed').split(',');
const N = Number(pos[2] || (MODE === 'same' ? 30 : 200));
const BLOCKS = (opt('blocks') || (MODE === 'same' ? '1' : '1,1001,2001,3001')).split(',').map(Number);
const VARIANT = 'rope:vlo+fight:lo+blind+a4:b+gsy+boilside:7';
const clone = (o) => JSON.parse(JSON.stringify(o));

function tables() {
  const db0 = T.loadDir(path.join(root, 'v4/data'));
  // A = 메모리 시험(swap 펼침)
  const rawA = clone(db0.raw); P.apply(VARIANT, rawA);
  // B = rope 칸(R0) + 같은 표 값
  const rawB = clone(db0.raw);
  const find = (evId, label) => { const e = rawB.events.find((x) => x.id === evId); const c = e && e.choices.find((x) => x.label === label); if (!c) throw new Error(`선택지 없음 ${evId}/${label}`); return c; };
  for (const [e, l, k, minK] of P.LATE.concat(P.EARLY)) find(e, l).rope = Object.assign({ kind: k }, minK ? { from: minK } : {});
  for (const [e, l] of P.FIGHT) find(e, l).rope = { kind: 'fight' };
  for (const l of ['그릇 둘을 내민다', '맞고 버틴다', '옆 담요를 가리킨다']) find('dawn_strike', l).rope.blind = 1;
  // 눈먼 새벽의 표 값(엔진 몫 아님): grudge_boils 가 깃발을 세우고, dawn_strike 의 죽지 않는 모든 결과가 지운다 (patches.js blind 와 같다)
  const gb = rawB.nightEvents.find((x) => x.id === 'grudge_boils');
  gb.effects.flag = Object.assign({}, gb.effects.flag, { strike_blind: true });
  const kills = (o) => !!(o && o.effects && o.effects.kill && [].concat(o.effects.kill).some((k) => !k.who || ['you', 'self', 'actor', 'party', 'all'].includes(k.who)));
  const clear = (o) => { if (o && o.effects && !kills(o)) o.effects.flag = Object.assign({}, o.effects.flag, { strike_blind: false }); };
  for (const c of rawB.events.find((e) => e.id === 'dawn_strike').choices) for (const v of [c].concat(c.swap ? [].concat(c.swap) : [])) { clear(v.out); clear(v.ok); clear(v.fail); }
  P.apply('a4:b+gsy+boilside:7', rawB);
  for (const k of ['pay', 'endure', 'point']) rawB.lines.push({ id: 'rope_tail_' + k, speaker: 'ui', grade: 'choice', text: '잘못되면 끝이다' });
  const dbA = T.load(rawA), dbB = T.load(rawB);
  return { dbA, dbB, ropeCols: P.LATE.length + P.EARLY.length + P.FIGHT.length, warnB: dbB.warnings };
}

const w = opt('worker');
if (w) {
  const { dbA, dbB } = tables();
  if (MODE === 'same') {
    // 줄타기 집계(ropeRolls·ropeClose·blindMet)는 rope 칸만 센다(swap 펼침은 줄타기인 줄 모른다) — 그것과 사인 기록의 roped·swapped 만 빼고 전부 비교
    const strip = (s) => { const o = clone(s); delete o.lastResult; if (o.ended) delete o.ended.cause; delete o.stats.ropeRolls; delete o.stats.ropeClose; delete o.stats.blindMet; return o; };
    const hA = crypto.createHash('sha1'), hB = crypto.createHash('sha1');
    let diff = null;
    for (const b0 of BLOCKS) for (let seed = b0; seed < b0 + N; seed++) {
      const a = B.play(dbA, seed, w).s, b = B.play(dbB, seed, w).s;
      const ja = JSON.stringify(strip(a)), jb = JSON.stringify(strip(b));
      hA.update(ja); hB.update(jb);
      if (!diff && ja !== jb) diff = { seed, a: a.log.slice(0, 6).map((l) => `D${l.day} ${l.text}`), b: b.log.slice(0, 6).map((l) => `D${l.day} ${l.text}`) };
    }
    process.send({ name: w, a: hA.digest('hex').slice(0, 12), b: hB.digest('hex').slice(0, 12), diff }, () => process.exit(0));
  } else {
    const runs = [];
    const per = [];
    for (const b0 of BLOCKS) { const rs = []; for (let seed = b0; seed < b0 + N; seed++) { const { s, trace } = B.play(dbB, seed, w); rs.push(ST.measure(dbB, s, trace)); } per.push(ST.aggregate(dbB, rs)); runs.push(...rs); }
    const a = ST.aggregate(dbB, runs);
    const pick = (x) => ({ survived: x.survived, death: x.deathRate, forced: x.forced, noSafe: x.noSafeDeaths, unwarned: x.unwarned, ropeRolls: x.ropeRolls, ropeCloseSurv: x.ropeCloseSurv, ropeClose2: x.ropeClose2, closeCallsSurv: x.closeCallsSurv, ropeDeaths: x.ropeDeaths, blindMet: x.blindMet, blindDeaths: x.blindDeaths, discReal: x.discReal, discovery: x.discovery, pubNights: x.pubNights, aliveD4: x.aliveD4, dayEvent: x.dayEvent, home9: x.home9, res7: x.res7, karma: x.karma, top: x.topCause });
    process.send({ name: w, all: pick(a), per: per.map((x) => ({ survived: x.survived, ropeCloseSurv: x.ropeCloseSurv, ropeClose2: x.ropeClose2 })) }, () => process.exit(0));
  }
} else {
  const t0 = Date.now();
  const { ropeCols, warnB } = tables();
  const res = {}; const q = POLS.slice(); let live = 0;
  const done = () => {
    const L = [`# 엔진 R0 확인 (${MODE}) — 정책 ${POLS.length} × ${N}판 × 블록 ${BLOCKS.join(',')}, ${Math.round((Date.now() - t0) / 1000)}초`,
      `R0 표: rope 칸 ${ropeCols}개 + 눈먼 새벽 3 · 표 경고 ${warnB.length}건 (${[...new Set(warnB.map((x) => x.kind))].join(', ') || '없음'}) · noExit ${warnB.filter((x) => x.kind === 'noExit').length}`];
    if (MODE === 'same') {
      L.push('| 정책 | 메모리 시험(swap 펼침) | rope 칸(R0) | 같다 |', '|---|---|---|---|');
      for (const p of POLS) { const r = res[p]; L.push(`| ${p} | ${r.a} | ${r.b} | ${r.a === r.b ? '✓' : '✗ 첫 차이 시드 ' + r.diff.seed} |`); }
    } else {
      L.push('| 정책 | 생존% | 블록별 생존% | 사망% | 확정 사망 | 옛 강제 | 경고 없는 사망 | 줄타기 굴림/판 | 줄타기 넘김/판(산 판) · 블록별 | 산 판 중 ≥2번% · 블록별 | 죽음 판정 넘김/판(산 판) | 줄타기 사망 | 눈먼 새벽/판 · 사망 | 실제 발견% (옛) | 누구나 아는 밤/판 | D1~D4 생존 | 그날 사건 사망 D2·D3·D4·D5·D6 | D9 주민 · D7 자원 | 카르마 | 사인 1위 |');
      L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
      for (const p of POLS) { const r = res[p]; const a = r.all; L.push(`| ${p} | ${a.survived} | ${r.per.map((x) => x.survived).join(' / ')} | ${a.death} | ${a.forced} | ${a.noSafe} | ${a.unwarned} | ${a.ropeRolls} | ${a.ropeCloseSurv} · ${r.per.map((x) => x.ropeCloseSurv).join('/')} | ${a.ropeClose2} · ${r.per.map((x) => x.ropeClose2).join('/')} | ${a.closeCallsSurv} | ${a.ropeDeaths} | ${a.blindMet} · ${a.blindDeaths} | ${a.discReal} (${a.discovery}) | ${a.pubNights} | ${a.aliveD4} | ${[2, 3, 4, 5, 6].map((d) => a.dayEvent[d] || 0).join('·')} | ${a.home9} · ${a.res7} | ${a.karma} | ${a.top.k} ${a.top.share}% |`); }
      const d = (x, y) => (res[x] && res[y] ? Math.round(10 * (res[x].all.survived - res[y].all.survived)) / 10 : '-');
      L.push('', `- selfish_nb − 균형: ${d('selfish_nb', 'balanced')}%p · 보통 − 게으름: ${d('balanced', 'lazy')}%p · 부지런 − 게으름: ${d('diligent', 'lazy')}%p`);
    }
    const txt = L.join('\n');
    console.log(txt);
    if (opt('out')) require('fs').writeFileSync(path.join(__dirname, opt('out')), txt + '\n');
  };
  const next = () => {
    if (!q.length && !live) { done(); return; }
    while (live < Number(opt('workers') || 8) && q.length) {
      const p = q.shift(); live++;
      const ch = fork(__filename, args.concat([`--worker=${p}`]), { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      ch.on('message', (m) => { res[m.name] = m; });
      ch.on('exit', () => { live--; next(); });
    }
  };
  next();
}
