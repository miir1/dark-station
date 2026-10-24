p = r'C:\dev\dark_station\v4\engine\effects.js'
t = open(p, encoding='utf8').read()
a = """  const API = { apply, setNumber, setTrace, kill, permanent, resolveWho, resolveWhos, fillRole, PERM_SKILL, WHO_WORDS, list };"""
b = """  // 당신 부상의 출처 기록 (10-24 사인 집계 — '부상을 만든 선택' 기준, 검토 지적 17). lines 의 당신 injury 증가를 src 와 함께 s.hurt 에 남긴다.
  //   src: 'ev:<사건>/<선택 label>' · 'night:<밤 사건 id>' · 'neglect:<밤 사건 id>' · 'holds:<물건>'. 화면은 안 본다(봇·통계용). 최근 HURT_MAX 개만
  const HURT_MAX = 60;
  function noteHurt(s, lines, src) {
    if (!Array.isArray(lines)) return;
    for (const l of lines) if (l && l.kind === 'number' && l.id === 'injury' && l.who === 'you' && l.to > (l.from || 0)) {
      if (!Array.isArray(s.hurt)) s.hurt = [];
      s.hurt.push({ day: s.day, src, n: l.to - (l.from || 0) });
      if (s.hurt.length > HURT_MAX) s.hurt.splice(0, s.hurt.length - HURT_MAX);
    }
  }

  const API = { apply, setNumber, setTrace, kill, permanent, resolveWho, resolveWhos, fillRole, noteHurt, HURT_MAX, PERM_SKILL, WHO_WORDS, list };"""
assert t.count(a) == 1
t = t.replace(a, b)
open(p, 'w', encoding='utf8').write(t)
print('ok')
