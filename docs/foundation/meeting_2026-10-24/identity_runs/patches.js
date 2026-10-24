// 메모리 시험용 패치 — 표 파일은 고치지 않고 runs.js 가 읽은 표(raw)를 실행 중에만 바꾼다.
// 설계 v3 §4 축 정의: 몫(내줌 + / 챙김 −) · 손(개입 + / 방관 −) · 이름(부름·대답·밀고 + / 침묵 −)
const ev = (raw, id) => { const e = raw.events.find((x) => x.id === id); if (!e) throw new Error('사건 없음 ' + id); return e; };
const ch = (raw, id, label) => { const c = ev(raw, id).choices.find((x) => x.label === label); if (!c) throw new Error(`선택지 없음 ${id}:${label}`); return c; };
// 선택지 결과(out/ok/fail)의 축 효과를 바꾼다: set = {share: n, ...} (0 = 지움)
function setAxis(c, part, set) {
  const o = c[part]; if (!o) throw new Error('결과 없음 ' + part);
  o.effects = (o.effects || []).filter((e) => !(e.verb === 'axis' && Object.prototype.hasOwnProperty.call(set, e.id)));
  for (const [k, n] of Object.entries(set)) if (n) o.effects.push({ verb: 'axis', id: k, n });
}
const P = {
  // 문턱: 손 1 → 2 (설계 v3 §4 제안값 손 ±2). identity 표 rule 열만 바꾼다
  hand2: (raw) => { for (const c of raw.identity.candidates) c.rule = c.rule.replace(/hand>=1/g, 'hand>=2').replace(/hand<1/g, 'hand<2'); },
  // 손 부호: '보기만 한다'(방관)가 0 으로 적힌 짝을 −1 로 (손+1 쪽은 그대로)
  watch: (raw) => {
    setAxis(ch(raw, 'd4_shoes_home', '본다'), 'out', { hand: -1 });
    setAxis(ch(raw, 'd6_vent_voice', '듣는다'), 'out', { hand: -1 });
    setAxis(ch(raw, 'trial_d4_gicheol', '믿는다'), 'out', { hand: -1 });
  },
  // 남을 내보내는 것은 개입이 아니다: patrol_pact '동하를 보낸다' 손 +1 → 0 (몫 −1 은 그대로)
  sendDongha: (raw) => { setAxis(ch(raw, 'patrol_pact', '동하를 보낸다'), 'out', { hand: 0 }); },
  // 굶는 밤(starve_you, 되풀이)은 죽음 글이 아닌 세 길이 모두 몫 −1 이라 고를 수 없다. 선로 밑을 뒤져 찾은 것은 남의 것이 아니다: ok 몫 −1 → 0 (창고·남의 그릇은 −1 그대로)
  railForage: (raw) => { setAxis(ch(raw, 'starve_you', '선로 밑을 뒤진다'), 'ok', { share: 0 }); },
  // 똑같이 나누기는 '내 몫을 내준' 것이 아니다: trial_d1_bowls '똑같이 조금씩' 몫 +1 → 0
  evenBowls: (raw) => { setAxis(ch(raw, 'trial_d1_bowls', '똑같이 조금씩'), 'out', { share: 0 }); },
};
module.exports = P;
