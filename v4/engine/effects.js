// 어두운 역 v4 — 효과 동사 7종. 사건표·밤 사건표의 effects 를 상태에 적용한다. 이 파일 밖에서 상태 수치를 직접 고치지 않는다.
//   { food:-1 }                       numbers id → 세계면 world, 사람이면 who 의 것
//   { flag:{ parts_hidden:true } }    깃발
//   { trace:{ bowl_{actor}:'empty' } } 흔적(물건 상태). {actor}/{target} 자리표시 허용
//   { axis:{ share:1 } }              정체 축 (플레이어 선택에만 쓴다)
//   { injure:{ who:'you', n:1 } }     부상 +n (최대 3)
//   { kill:{ who:'target' } }         사망
//   { permanent:{ who:'actor', kind:'finger' } }  영구 손상 → 기술 −1 + 깃발
// 같은 동사·같은 수치를 한 결과에서 두 번 이상 쓰면 값이 목록이 된다: { injure:[{who:'dongha',n:1},{who:'gicheol',n:2}] } — 목록 순서대로 전부 적용.
// who 낱말: you · self/actor(행위자) · target · companion(원정 동행 한 사람) · party(원정 편성 전원, 당신 포함) · all(역에 있는 사람 전부, 당신 포함)
//           · bondOfActor(행위자의 bond) · world(세계 수치) · 사람 id.  풀 수 없으면(동행이 없는데 companion 등) 아무 일도 없다.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const ID = isNode ? require('./identity.js') : root.DS4.identity;

  const PERM_SKILL = { finger: 'tech', leg: 'str', ear: 'talk' };   // 손상 → 깎이는 기술
  const WHO_WORDS = ['you', 'self', 'actor', 'target', 'companion', 'party', 'all', 'bondOfActor', 'world'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const list = (v) => (Array.isArray(v) ? v : [v]);

  // who 하나 → 사람 id 목록. roles: { actor, target, companion, party }
  function resolveWhos(who, roles, s) {
    roles = roles || {};
    if (!who || who === 'self') return [roles.actor || 'you'];
    switch (who) {
      case 'actor': return roles.actor ? [roles.actor] : [];
      case 'target': return roles.target ? [roles.target] : [];
      case 'companion': return roles.companion ? [roles.companion] : [];
      case 'party': return Array.isArray(roles.party) ? roles.party.slice() : [];
      case 'all': return s ? Object.values(s.people).filter((p) => p.status === 'home').map((p) => p.id) : [];
      case 'bondOfActor': { const a = s && roles.actor ? s.people[roles.actor] : null; const b = a && a.needs ? a.needs.bond : ''; return b ? [b] : []; }
      default: return [who];
    }
  }
  const resolveWho = (who, roles, s) => resolveWhos(who, roles, s)[0] || null;   // 한 사람만 필요할 때
  // 'bowl_{actor}' 와 'bowl_actor' 둘 다 자리표시
  const fillRole = (str, roles) => String(str).replace(/\{(actor|target)\}|_(actor|target)$/g, (m, k, k2) => (k ? roles[k] || '' : '_' + (roles[k2] || '')));

  function setNumber(s, db, id, who, delta, lines) {
    const def = db.numbers[id];
    if (!def) return;
    if (def.owner === 'world' || who === 'world') { if (def.owner !== 'world') return; const before = s.world[id]; s.world[id] = clamp(before + delta, def.min, def.max); if (lines && s.world[id] !== before) lines.push({ kind: 'number', id, who: null, from: before, to: s.world[id] }); return; }
    const p = s.people[who];
    if (!p || p.status === 'dead') return;
    const before = p.n[id];
    p.n[id] = clamp((before || 0) + delta, def.min, def.max);
    if (lines && p.n[id] !== before) lines.push({ kind: 'number', id, who, from: before, to: p.n[id] });
  }

  function setTrace(s, db, objId, st, day, by) {
    if (!db.objects[objId] || !db.objects[objId].states.includes(st)) return false;
    s.traces[objId] = { st, day, by: by || null, seen: false };
    return true;
  }

  // how: dead(기본) | ascended(올라감) | stayed(역에 남아 떠남 — 명부엔 '남았다') | ashed(재가 됨 = dead)
  // 바깥 사람(outside)도 죽을 수 있다(밤에 밸브를 잠그고 돌아오지 않는다 등).
  function kill(s, who, day, lines, how) {
    const p = s.people[who];
    if (!p || (p.status !== 'home' && p.status !== 'outside')) return;
    p.status = how === 'ascended' ? 'ascended' : how === 'stayed' ? 'stayed' : 'dead'; p.day = day;
    if (lines) lines.push({ kind: p.status, who, day });
  }
  function permanent(s, who, kind, lines) {
    const p = s.people[who];
    if (!p || p.permanent[kind]) return;
    p.permanent[kind] = s.day; const sk = PERM_SKILL[kind]; if (sk) p.skills[sk] = Math.max(0, p.skills[sk] - 1); s.flags[`${who}_${kind}`] = true;
    if (lines) lines.push({ kind: 'permanent', who, what: kind });
  }

  function apply(s, db, effects, roles, lines) {
    roles = roles || {};
    const who0 = roles.actor || 'you';
    for (const [k, v0] of Object.entries(effects || {})) {
      switch (k) {
        case 'flag': for (const [f, on] of Object.entries(v0)) { const id = fillRole(f, roles); if (on) s.flags[id] = true; else delete s.flags[id]; } break;   // x_actor → x_gicheol
        case 'trace': for (const [o, st] of Object.entries(v0)) setTrace(s, db, fillRole(o, roles), st, s.day, roles.actor || 'you'); break;
        case 'axis': ID.nudge(s.axes, v0); break;
        case 'injure': for (const v of list(v0)) for (const w of resolveWhos(v.who, roles, s)) setNumber(s, db, 'injury', w, v.n, lines); break;
        case 'kill': for (const v of list(v0)) for (const w of resolveWhos(v.who, roles, s)) kill(s, w, s.day, lines, v.how); break;
        case 'permanent': for (const v of list(v0)) for (const w of resolveWhos(v.who, roles, s)) permanent(s, w, v.kind, lines); break;
        default:
          for (const v of list(v0)) {   // 수치: ±정수(행위자) 또는 {who, n}
            if (v && typeof v === 'object') for (const w of resolveWhos(v.who, roles, s)) setNumber(s, db, k, w, v.n, lines);
            else setNumber(s, db, k, who0, v, lines);
          }
      }
    }
    // 부상 3 = 위독 → 다음 날 치료 없으면 죽는다 (여기서는 표시만, 판정은 엔진의 새 날 처리)
    return s;
  }

  const API = { apply, setNumber, setTrace, kill, permanent, resolveWho, resolveWhos, fillRole, PERM_SKILL, WHO_WORDS, list };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).effects = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
