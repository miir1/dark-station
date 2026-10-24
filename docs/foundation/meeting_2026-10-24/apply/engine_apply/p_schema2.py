p = r'C:\dev\dark_station\v4\engine\schema.js'
t = open(p, encoding='utf8').read()


def rep(a, b, cnt=1):
    global t
    assert t.count(a) == cnt, (a[:80], t.count(a))
    t = t.replace(a, b)


helpers = r"""  // ── 선택지 본문 검사 (기본 선택지와 swap 을 합친 선택지가 같이 쓴다) ──
  function checkChoiceBody(c, ctx, e2) {
    if (typeof c.label !== 'string' || !c.label) e2('label 필요');
    else if (Array.from(c.label).length > 18) e2(`label 18자 초과 ("${c.label}")`);
    if (c.check) {
      if (!isObj(c.check) || !['obs', 'str', 'tech', 'talk'].includes(c.check.skill) || !isInt(c.check.base) || c.check.base < 0 || c.check.base > 100) e2('check: {skill: obs/str/tech/talk, base: 0~100}');
      if (!isObj(c.ok) || !isObj(c.fail)) e2('check가 있으면 ok·fail 둘 다 필요');
    } else if (!isObj(c.out)) e2('out 필요');
    for (const o of [c.out, c.ok, c.fail].filter(Boolean)) {
      if (o.effects) checkEffects(o.effects, ctx, (m) => e2(m)); if (o.text != null && typeof o.text !== 'string') e2('결과 text는 글');
      if (o.image != null && typeof o.image !== 'string') e2('결과 image는 그림 id 글');
      if (o.ledger != null) checkLedger(o.ledger, ctx, (m) => e2(m));
      if (o.target != null && !validTarget(o.target, ctx)) e2(`target: 사람 id 또는 ${EVENT_TARGETS.join('·')}·most:<사람 수치> ("${o.target}")`);
    }
    if (c.req != null) {
      if (!isObj(c.req)) e2(`req: {${REQ_KEYS.join(', ')}} 꼴`);
      else {
        for (const k of Object.keys(c.req)) if (!REQ_KEYS.includes(k)) e2(`req.${k}: req 칸은 ${REQ_KEYS.join('·')}`);
        if (c.req.flag && !ID.test(c.req.flag)) e2('req.flag id 꼴 아님');
        if (c.req.permanent && !PERMANENT.includes(c.req.permanent)) e2('req.permanent 종류');
        if (c.req.notPermanent && !PERMANENT.includes(c.req.notPermanent)) e2('req.notPermanent 종류');
        if (c.req.cond != null && c.req.cond !== '') { if (typeof c.req.cond !== 'string') e2('req.cond: 조건식은 글'); else { try { C.parse(c.req.cond); } catch (e) { e2(`req.cond: ${e.message}`); } } }
        if (c.req.why != null && (typeof c.req.why !== 'string' || Array.from(c.req.why).length > 24)) e2('req.why: 잠금 이유는 글 24자 이내');
        if (c.req.target != null && ![0, 1, true, false].includes(c.req.target)) e2('req.target: 0/1');
      }
    }
    if (c.cost && isObj(c.cost)) for (const k of Object.keys(c.cost)) if (!ctx.numbers[k]) e2(`cost.${k}: numbers에 없음`);
  }
  // 사건·결과 대상: 사람 id · 대상 낱말 · most:<사람 수치>
  function validTarget(v, ctx) {
    if (typeof v !== 'string') return false;
    if (ctx.people[v] || EVENT_TARGETS.includes(v)) return true;
    const m = MOST_TARGET.exec(v);
    return !!(m && ctx.numbers[m[1]] && ctx.numbers[m[1]].owner === 'person');
  }
  // ── swap (10-24 A1): 조건(when)이 맞으면 그 변형의 칸이 기본 선택지의 칸을 덮는다. engine.js 가 같은 함수를 쓴다 ──
  //  · 변형에 적힌 칸은 빈 값이어도 덮는다(빈 값 = 그 칸을 비움: warn:'' → 경고 없음, cost:{} → 비용 없음, taboo:'' → 금기 아님)
  //  · 변형에 out 이 있고 check 가 없으면 판정이 사라진다(check·ok·fail 지움). 변형에 check 가 있으면 out 이 사라진다(ok·fail 은 변형 것, 없으면 기본 것)
  const blankV = (v) => v == null || v === '' || v === '-' || (isObj(v) && !Object.keys(v).length);
  const hasK = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function mergeSwap(base, v) {
    const m = Object.assign({}, base); delete m.swap;
    for (const k of Object.keys(v)) if (k !== 'when') m[k] = v[k];
    if (hasK(v, 'out') && !hasK(v, 'check')) { delete m.check; delete m.ok; delete m.fail; }
    if (hasK(v, 'check')) { if (blankV(v.check)) { delete m.ok; delete m.fail; } else delete m.out; }
    for (const k of ['check', 'cost', 'req', 'taboo', 'warn', 'hint', 'out', 'ok', 'fail']) if (blankV(m[k])) delete m[k];
    return m;
  }
  const swapsOf = (c) => (!isObj(c) || c.swap == null ? [] : (Array.isArray(c.swap) ? c.swap : [c.swap]).filter(isObj));
  const variantsOf = (c) => [c].concat(swapsOf(c).map((v) => mergeSwap(c, v)));
  // 선택지가 사건 대상(who:'target'·흔적/깃발의 _target·명부 줄 who target)을 쓰는가 — 결과에 제 target 열이 있으면 그 결과는 사건 대상을 안 쓴다
  function usesTarget(c) {
    for (const o of [c.out, c.ok, c.fail]) {
      if (!isObj(o) || (typeof o.target === 'string' && o.target)) continue;
      const e = o.effects;
      if (isObj(e)) for (const [k, v] of Object.entries(e)) {
        if ((k === 'trace' || k === 'flag') && isObj(v)) { if (Object.keys(v).some((x) => /\{target\}|_target$/.test(x))) return true; continue; }
        if (k === 'axis') continue;
        for (const x of Array.isArray(v) ? v : [v]) if (isObj(x) && x.who === 'target') return true;
      }
      for (const L of o.ledger == null ? [] : Array.isArray(o.ledger) ? o.ledger : [o.ledger]) if (isObj(L) && L.who === 'target') return true;
    }
    return false;
  }
  const needsTarget = (c) => !!(isObj(c) && ((isObj(c.req) && (c.req.target === 1 || c.req.target === true)) || usesTarget(c)));

  // 검사 = { errors, warnings }."""
rep("  // 검사 = { errors, warnings }.", helpers)

rep("""    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices) || ev.choices.length < 2 || !isObj(ev.choices[0])) return;
      const c0 = ev.choices[0], k0 = killWhos(c0);
      const why = c0.taboo ? `금기("${c0.taboo}")가 있다`""",
"""    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices) || ev.choices.length < 2 || !isObj(ev.choices[0])) return;
      const c0 = ev.choices[0], v0 = variantsOf(c0), k0 = [].concat(...v0.map(killWhos));   // swap 변형이 죽일 수 있어도 1번 자리 죽음이다
      const tab0 = v0.find((x) => x.taboo);
      const why = tab0 ? `금기("${tab0.taboo}")가 있다`""")

rep("""    //  reasonWord: 화면 글에 '때문에·왜냐하면' (문장 규칙 — 이유는 말하지 않는다)""",
"""    //  noExit (E4, 10-24 A1): 당신을 죽일 수 있는 선택(swap 변형 포함)이 있는 사건에, 비용·req 없고 당신을 죽이지 않는(변형까지) 선택지가 하나도 없다 — 강제 사망 길.
    //          금기도 출구로 센다. targetOptional 사건에서 대상이 필요한 선택지는 대상이 없으면 잠기므로 출구가 아니다.
    //          경고로 둔다(브라우저 로더가 틀린 행을 빼고 읽지 않게) — 지금 표에 0건인지는 테스트(karma.test.js)가 막는다.
    const killsMe = (c) => killWhos(c).some((w) => ME_WHO.includes(w));
    tables.events.forEach((ev, i) => {
      if (!Array.isArray(ev.choices)) return;
      const cs = ev.choices.filter(isObj);
      if (!cs.some((c) => variantsOf(c).some(killsMe))) return;
      const exit = cs.some((c) => variantsOf(c).every((x) => !x.cost && !x.req && !killsMe(x)) && !(ev.targetOptional && variantsOf(c).some(needsTarget)));
      if (!exit) warn('events', i, ev.id, 'noExit', '당신이 죽을 수 있는 사건인데 늘 고를 수 있고(비용·req 없음) 당신을 죽이지 않는 선택지가 없다 — 강제 사망 길. 죽지 않는 몸값(버틴다 등)·금기 출구를 하나 둔다');
    });
    //  reasonWord: 화면 글에 '때문에·왜냐하면' (문장 규칙 — 이유는 말하지 않는다)""")

rep("""      (Array.isArray(ev.choices) ? ev.choices : []).forEach((c, k) => { if (!isObj(c)) return; for (const col of ['label', 'warn', 'hint']) reason('events', i, ev.id, `choices[${k}].${col}`, c[col]); for (const r of ['out', 'ok', 'fail']) if (isObj(c[r])) reason('events', i, ev.id, `choices[${k}].${r}.text`, c[r].text); });""",
"""      (Array.isArray(ev.choices) ? ev.choices : []).forEach((c0, k) => { if (!isObj(c0)) return; variantsOf(c0).forEach((c, j) => { const at = j ? `choices[${k}].swap[${j - 1}]` : `choices[${k}]`; for (const col of ['label', 'warn', 'hint']) reason('events', i, ev.id, `${at}.${col}`, c[col]); if (isObj(c.req)) reason('events', i, ev.id, `${at}.req.why`, c.req.why); for (const r of ['out', 'ok', 'fail']) if (isObj(c[r])) reason('events', i, ev.id, `${at}.${r}.text`, c[r].text); }); });""")

rep("""  //   warnings[].kind: firstDeath(1번 자리 죽음) · reasonWord(이유 낱말) · owner(주인 없는 물건이 남의 머리맡 묶음에) · holdsRefill(다시 차는 수납, P1-11)""",
"""  //   warnings[].kind: firstDeath(1번 자리 죽음) · reasonWord(이유 낱말) · owner(주인 없는 물건이 남의 머리맡 묶음에) · holdsRefill(다시 차는 수납, P1-11) · noExit(강제 사망 길, E4 10-24)""")

rep("""  const API = { TABLES: T, IDENTITY_COLS, TABLE_NAMES, EFFECT_VERBS, PERMANENT, EVENT_TARGETS, WHO_WORDS, LEDGER_STATUS, validate, warnings, check, holdsOpenState,""",
"""  const API = { TABLES: T, IDENTITY_COLS, TABLE_NAMES, EFFECT_VERBS, PERMANENT, EVENT_TARGETS, MOST_TARGET, REQ_KEYS, SWAP_KEYS, WHO_WORDS, LEDGER_STATUS, validate, warnings, check, holdsOpenState, mergeSwap, swapsOf, variantsOf, usesTarget, needsTarget,""")
open(p, 'w', encoding='utf8').write(t)
print('ok')
