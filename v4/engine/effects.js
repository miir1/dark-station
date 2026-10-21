// 어두운 역 v4 — 효과 동사 7종. 사건표·밤 사건표의 effects 를 상태에 적용한다. 이 파일 밖에서 상태 수치를 직접 고치지 않는다.
//   { food:-1 }                       numbers id → 세계면 world, 사람이면 who 의 것
//   { flag:{ parts_hidden:true } }    깃발
//   { trace:{ bowl_{actor}:'empty' } } 흔적(물건 상태). {actor}/{target} 자리표시 허용
//   { axis:{ share:1 } }              정체 축 (플레이어 선택에만 쓴다)
//   { injure:{ who:'you', n:1 } }     부상 +n (최대 3)
//   { kill:{ who:'target' } }         사망
//   { permanent:{ who:'actor', kind:'finger' } }  영구 손상 → 기술 −1 + 깃발
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const ID = isNode ? require('./identity.js') : root.DS4.identity;

  const PERM_SKILL = { finger: 'tech', leg: 'str', ear: 'talk' };   // 손상 → 깎이는 기술
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // who: 'you' | 'actor' | 'target' | 사람 id.  roles: { actor, target }
  function resolveWho(who, roles) {
    if (!who || who === 'self') return roles.actor || 'you';
    if (who === 'actor') return roles.actor;
    if (who === 'target') return roles.target;
    return who;
  }
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
  function kill(s, who, day, lines, how) {
    const p = s.people[who];
    if (!p || p.status !== 'home') return;
    p.status = how === 'ascended' ? 'ascended' : how === 'stayed' ? 'stayed' : 'dead'; p.day = day;
    if (lines) lines.push({ kind: p.status, who, day });
  }

  function apply(s, db, effects, roles, lines) {
    roles = roles || {};
    const who0 = roles.actor || 'you';
    for (const [k, v] of Object.entries(effects || {})) {
      switch (k) {
        case 'flag': for (const [f, on] of Object.entries(v)) { const id = fillRole(f, roles); if (on) s.flags[id] = true; else delete s.flags[id]; } break;   // x_actor → x_gicheol
        case 'trace': for (const [o, st] of Object.entries(v)) setTrace(s, db, fillRole(o, roles), st, s.day, roles.actor || 'you'); break;
        case 'axis': ID.nudge(s.axes, v); break;
        case 'injure': setNumber(s, db, 'injury', resolveWho(v.who, roles), v.n, lines); break;
        case 'kill': kill(s, resolveWho(v.who, roles), s.day, lines, v.how); break;
        case 'permanent': {
          const who = resolveWho(v.who, roles); const p = s.people[who];
          if (p && !p.permanent[v.kind]) { p.permanent[v.kind] = s.day; const sk = PERM_SKILL[v.kind]; if (sk) p.skills[sk] = Math.max(0, p.skills[sk] - 1); s.flags[`${who}_${v.kind}`] = true; if (lines) lines.push({ kind: 'permanent', who, what: v.kind }); }
          break;
        }
        default: if (v && typeof v === 'object') setNumber(s, db, k, resolveWho(v.who, roles) || who0, v.n, lines); else setNumber(s, db, k, who0, v, lines);   // 수치: ±정수 또는 {who, n}
      }
    }
    // 부상 3 = 위독 → 다음 날 치료 없으면 죽는다 (여기서는 표시만, 판정은 엔진의 새 날 처리)
    return s;
  }

  const API = { apply, setNumber, setTrace, kill, resolveWho, fillRole, PERM_SKILL };
  if (isNode) module.exports = API;
  else (root.DS4 = root.DS4 || {}).effects = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
