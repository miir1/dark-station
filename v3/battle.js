// 어두운 역 v3 — 턴제 전투. 부위(머리·몸통·팔·다리)를 노린다. 화면의 확률 = 실제 확률.
// 끝나면 { result: 'win'|'lose'|'flee', wounds: [{rid, part}] } 를 돌려주고, 상처와 보상은 엔진(expFight)이 처리한다.
(function () {
  'use strict';
  const PARTS = ['head', 'body', 'arm', 'leg'];
  const PNAME = { head: '머리', body: '몸통', arm: '팔', leg: '다리' };
  const AIM = { head: 0.45, body: 0.8, arm: 0.65, leg: 0.65 };        // 부위별 기본 명중
  const ENEMY_AIM = { head: 15, body: 40, arm: 25, leg: 20 };          // 적이 노리는 부위 비중
  const esc = (t) => UI.esc(t);
  const pct = (p) => Math.round(Math.max(0, Math.min(1, p)) * 100);
  const J = (n, pair) => window.DS2.J(n, pair);

  const ART_ID = { g2_rats: 'rats', c_twomouth: 'twomouth', c_drowned: 'drowned', c_bonepicker: 'bonepicker' };
  function spriteImg(id, size) {
    const c = ART.creatureSprite(ART_ID[id] || 'rats');
    return `<img alt="" width="${size}" height="${size}" style="image-rendering:pixelated" src="${c.toDataURL()}">`;
  }

  async function run(s, F, party, opts) {
    opts = opts || {};
    const pipe = !!opts.pipe;
    const en = { name: F.enemy.name, hp: Object.assign({}, F.enemy.parts), max: Object.assign({}, F.enemy.parts), atk: F.enemy.atk, acc: F.enemy.acc };
    const team = party.map((r) => {
      const max = { head: 3, body: 5 + r.skills.str - (r.injury || 0), arm: 4, leg: 4 };
      max.body = Math.max(2, max.body);
      return { r, hp: Object.assign({}, max), max, broken: {}, down: false, guard: false };
    });
    const wounds = [];
    const log = [`<b>${esc(J(en.name, '이/가'))}</b> 덮쳐 온다.`];
    const enemyDown = () => en.hp.head <= 0 || en.hp.body <= 0;
    const allDown = () => team.every((m) => m.down);
    const fleeChance = () => (en.hp.leg <= 0 ? 1 : Math.min(0.9, 0.35 + 0.1 * Math.max(...team.filter((m) => !m.down).map((m) => m.r.skills.obs))));
    const hitChance = (m, part) => Math.min(0.95, AIM[part] + 0.05 * m.r.skills.obs + (pipe ? 0.05 : 0) - (m.broken.arm ? 0.15 : 0));
    const dmg = (m) => Math.max(1, 1 + Math.floor(m.r.skills.str / 2) + (pipe ? 1 : 0) - (m.broken.arm ? 1 : 0));

    function view(actor) {
      const ep = PARTS.map((p) => `<span class="${en.hp[p] <= 0 ? 'broken' : ''}">${PNAME[p]} ${Math.max(0, en.hp[p])}/${en.max[p]}</span>`).join('');
      const tp = team.map((m) => `<div class="person"><b>${esc(m.r.name)}</b>${m.down ? '<span class="badge bad">쓰러짐</span>' : m.guard ? '<span class="badge">방어</span>' : ''}${m === actor ? '<span class="badge good">차례</span>' : ''}<div class="parts">${PARTS.map((p) => `<span class="${m.hp[p] <= 0 ? 'broken' : ''}">${PNAME[p]} ${Math.max(0, m.hp[p])}/${m.max[p]}</span>`).join('')}</div></div>`).join('');
      return `<div class="battle"><p class="tag">전투</p><div class="enemy">${spriteImg(opts.id, 128)}<p class="title">${esc(en.name)}</p></div>
        <div class="parts">${ep}</div>
        <p class="mini">머리나 몸통이 무너지면 쓰러진다. 다리를 부수면 반드시 도망칠 수 있고, 팔을 부수면 공격이 약해진다. 사람도 같다 — 부러진 부위는 돌아가서 부상과 영구 상처로 남는다.</p>
        <div class="blog">${log.slice(-3).join('<br>')}</div>${tp}</div>`;
    }

    function hitMember(m, part, n) {
      m.hp[part] -= n;
      let t = `${esc(m.r.name)}의 ${PNAME[part]} −${n}`;
      if (m.hp[part] <= 0 && !m.broken[part]) {
        m.broken[part] = true; wounds.push({ rid: m.r.id, part });
        t += ` — <b>${J(PNAME[part], '이/가')} 부러졌다</b>`;
        if (part === 'head' || part === 'body') { m.down = true; t += ` ${esc(m.r.name)} 쓰러짐`; }
      }
      return t;
    }
    function enemyTurn() {
      if (enemyDown()) return;
      const targets = team.filter((m) => !m.down);
      if (!targets.length) return;
      const m = targets[Math.floor(Math.random() * targets.length)];
      let r = Math.random() * 100, part = 'body';
      for (const p of PARTS) { r -= ENEMY_AIM[p]; if (r <= 0) { part = p; break; } }
      const acc = en.acc - (m.guard ? 0.25 : 0);
      if (Math.random() < acc) {
        const n = Math.max(1, en.atk - (en.hp.arm <= 0 ? 1 : 0) - (m.guard ? 1 : 0));
        log.push(`${esc(en.name)}의 공격 → ${hitMember(m, part, n)}`);
      } else log.push(`${esc(en.name)}의 공격이 ${esc(m.r.name)}의 ${J(PNAME[part], '을/를')} 스쳐 지나갔다.`);
    }

    for (let round = 0; round < 30; round++) {
      for (const m of team) {
        if (m.down || enemyDown()) continue;
        m.guard = false;
        const options = PARTS.map((p) => ({ label: `${J(PNAME[p], '을/를')} 노린다`, value: 'atk:' + p, disabled: en.hp[p] <= 0,
          sub: `명중 ${pct(hitChance(m, p))}% · 피해 ${dmg(m)}${p === 'head' ? ' · 머리가 무너지면 즉사' : p === 'leg' ? ' · 다리를 부수면 도망 확정' : p === 'arm' ? ' · 팔을 부수면 적 공격 −1' : ''}` }));
        options.push({ label: '막는다', value: 'guard', sub: '이번 차례 맞을 확률 −25%p, 피해 −1' });
        options.push({ label: '도망친다', value: 'flee', sub: `성공 ${pct(fleeChance())}% · 실패하면 한 번 더 맞는다` });
        const a = await UI.open(view(m), { options, full: true });
        if (a === 'guard') { m.guard = true; log.push(`${esc(J(m.r.name, '이/가'))} 몸을 웅크렸다.`); }
        else if (a === 'flee') {
          if (Math.random() < fleeChance()) { await UI.open(view(null) + '<p>등을 돌려 달아났다.</p>'); return { result: 'flee', wounds }; }
          log.push('도망치지 못했다.');
          enemyTurn();
          if (allDown()) break;
        } else if (typeof a === 'string' && a.startsWith('atk:')) {
          const p = a.slice(4);
          if (Math.random() < hitChance(m, p)) {
            const n = dmg(m); en.hp[p] -= n;
            let t = `${esc(m.r.name)}의 일격 → ${esc(en.name)}의 ${PNAME[p]} −${n}`;
            if (en.hp[p] <= 0) t += ` — <b>${J(PNAME[p], '이/가')} 부서졌다</b>`;
            log.push(t);
          } else log.push(`${esc(m.r.name)}의 공격이 빗나갔다.`);
        }
      }
      if (enemyDown()) { await UI.open(view(null) + `<p>${esc(J(en.name, '이/가'))} 쓰러졌다.</p>`); return { result: 'win', wounds }; }
      enemyTurn();
      if (allDown()) { await UI.open(view(null) + '<p>모두 쓰러졌다. 정신을 차렸을 때 그것은 사라지고 없었다.</p>'); return { result: 'lose', wounds }; }
    }
    return { result: 'flee', wounds };
  }
  window.BATTLE = { run };
})();
