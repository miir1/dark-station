// verify_A4 — (iso2: 화면과 같게) 화면에서 조사할 수 없는 물건(화로 = 쓰면 단계 넘김·조사 아님, 역무실 안 창고·부품 상자, 서하 머리맡 17,9)을 봇도 조사하지 못하게 한 실험
// verify_A4 — 아침 조사만 떼어 본 실험 (v4 파일은 고치지 않는다: bots.POLICIES·INSPECT 를 메모리에서만 더한다)
// node iso.js <정책> <블록들(쉼표)> <판수> <출력.json>
//   b_noinsp  = 균형과 같고 아침 물건 조사 0칸 (말 걸기·소문은 보통 그대로)
//   b_obj1    = 균형과 같고 아침 물건 조사 1칸 (말·소문 보통)
//   b_notalk  = 균형과 같고 말·소문 0 (물건 2칸)
//   b_zero    = 물건 0·말 0·소문 0 (명부 쓰기는 보통처럼 반반 — lazy 와 다른 점)
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../../..');
const T = require(path.join(ROOT, 'v4/engine/tables.js'));
const B = require(path.join(ROOT, 'v4/sim/bots.js'));
const S = require(path.join(ROOT, 'v4/sim/stats.js'));
B.INSPECT.noinsp = { objects: 0, talk: 1, rumors: 1 };
B.INSPECT.obj1 = { objects: 1, talk: 1, rumors: 1 };
B.INSPECT.notalk = { objects: 2, talk: 0, rumors: 0 };
B.INSPECT.zero = { objects: 0, talk: 0, rumors: 0 };
const base = B.POLICIES.balanced;
B.POLICIES.b_noinsp = Object.assign({}, base, { inspect: 'noinsp' });
B.POLICIES.b_obj1 = Object.assign({}, base, { inspect: 'obj1' });
B.POLICIES.b_notalk = Object.assign({}, base, { inspect: 'notalk' });
B.POLICIES.b_zero = Object.assign({}, base, { inspect: 'zero' });
// 조사로 열린 사건(단계·사건·고른 선택·자원 변화)을 센다 — dispatch 를 감싼다(메모리에서만)
const E = require(path.join(ROOT, 'v4/engine/engine.js'));
const RES = ['food', 'water', 'meds', 'parts', 'fuel'];
let G = null;
const NOREACH = new Set(['fire', 'crate_food', 'parts_crate', 'bottle_seoha', 'bandage_seoha']);   // 지금 판의 기록
const orig = E.dispatch;
E.dispatch = function (s, a, db) {
  if (a && a.type === 'inspect' && s.pos && s.pos.map === 'station' && NOREACH.has(a.object) && !s.trip) return { ok: false, error: '화면에서 조사할 수 없는 물건(verify_A4 iso2)' };
  if (a && a.type === 'inspect') {
    const had = !!s.pending; const ph = s.phase;
    const r = orig.call(this, s, a, db);
    if (G && r.ok && !had && s.pending) G.insp.push({ ph, obj: a.object, ev: s.pending.id, day: s.day });
    return r;
  }
  if (a && a.type === 'choose' && G && s.pending) {
    const ev = s.pending.id; const ph = s.phase;
    const before = RES.map((k) => s.world[k] || 0); const hy = s.people.you.n.hunger || 0;
    const fromInsp = G.insp.length && G.insp[G.insp.length - 1].ev === ev && G.insp[G.insp.length - 1].day === s.day;
    const r = orig.call(this, s, a, db);
    if (r.ok && fromInsp && s.lastResult) {
      const d = RES.map((k, i) => (s.world[k] || 0) - before[i]);
      G.pick.push({ ph, ev, choice: s.lastResult.choice, d, hy: (s.people.you.n.hunger || 0) - hy, day: s.day });
    }
    return r;
  }
  return orig.call(this, s, a, db);
};
const [pol, blocksArg, nArg, out] = process.argv.slice(2);
const db = T.loadDir(path.join(ROOT, 'v4/data'));
const blocks = blocksArg.split(',').map(Number);
const N = +nArg;
const res = [];
for (const b0 of blocks) {
  for (let seed = b0; seed < b0 + N; seed++) {
    G = { insp: [], pick: [] };
    const { s, trace } = B.play(db, seed, pol);
    const m = S.measure(db, s, trace);
    // 덧붙이는 값: 판 끝 역에 남은 주민(당신 생사 무관) · 판 끝 자원 · 못 본 일 종류 · 당신이 본 late 흔적 수
    const residents = db.peopleOrder.filter((id) => id !== 'you');
    const lost = residents.filter((id) => ['dead', 'ascended'].includes(s.people[id].status)).length;
    const missedIds = s.nightLog.filter((e) => e.role === 'neglect' && /~missed$/.test(e.id)).map((e) => e.id.replace(/~missed$/, ''));
    const caughtIds = s.nightLog.filter((e) => e.role === 'neglect' && /~caught$/.test(e.id)).map((e) => e.id.replace(/~caught$/, ''));
    res.push({ block: b0, seed, dead: m.dead, survived: m.survived, deathDay: m.deathDay, causeKey: m.causeKey, root: m.root, home9: m.home9, res7: m.res7,
      neglect: m.neglect, lostEnd: lost, daysLived: m.daysLived, missedIds, caughtIds, found: m.found, unknown: m.unknown, karma: m.karma,
      fired_d2_seoha: (s.fired && s.fired.d2_seoha) || 0, fired_share_back: (s.fired && s.fired.share_back) || 0, picks: G.pick });
  }
}
fs.writeFileSync(out, JSON.stringify(res));
console.log(pol, 'done', res.length);
