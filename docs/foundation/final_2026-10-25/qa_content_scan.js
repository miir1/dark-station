// 최종 점검(내용) — 2026-10-25 QA. 게임 파일은 읽기만 한다.
// node docs/foundation/final_2026-10-25/qa_content_scan.js > docs/foundation/final_2026-10-25/qa_content_scan.txt
// 화면에 나갈 수 있는 모든 글(표 아홉 장 + 줄타기·swap 이 만드는 모습 + 화면 코드의 한국어 글자열)을 모아
//   ① 신 이름 ② 실존 지명 ③ 수치 노출(원한·카르마…) ④ 성적 묘사 ⑤ 자해 ⑥ 식인 직접 ⑦ 용어(§2 금지 표기) ⑧ 문장 규칙(31 §3)
//   ⑨ 안 만난 사람 이름(가리지 않는 줄) ⑩ 그림 연결(events image → 실제 파일) 을 본다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const V4 = path.join(ROOT, 'v4');
const S = require(path.join(V4, 'engine', 'schema.js'));
const T = require(path.join(V4, 'engine', 'tables.js'));
const rd = (n) => JSON.parse(fs.readFileSync(path.join(V4, 'data', n + '.json'), 'utf8'));
const tbl = {}; for (const n of ['events', 'lines', 'objects', 'people', 'maps', 'numbers', 'identity', 'nightEvents', 'phases']) tbl[n] = rd(n);
const db = T.loadDir(path.join(V4, 'data'));

const OUT = [];
const log = (...a) => OUT.push(a.join(' '));
const items = [];   // { src, id, where, text, kind, grade, explicit }
const add = (o) => { if (typeof o.text === 'string' && o.text.trim()) items.push(o); };

// ── 표에서 화면 글 모으기 ──
const knobGet = (id) => { const r = tbl.numbers.find((n) => n.id === id); return r ? r.start : undefined; };
const tailOf = (k) => { const L = tbl.lines.find((l) => l.id === 'rope_tail_' + k); return (L && L.text) || S.ROPE_TAIL[k] || ''; };
for (const e of tbl.events) {
  add({ src: 'events', id: e.id, where: 'text', text: e.text, kind: 'body', grade: e.grade, explicit: e.explicit });
  e.choices.forEach((c, i) => {
    const forms = S.variantsOf(c).concat(S.ropeFormsOf(c, knobGet, tailOf).map((f) => f.form));
    const seen = new Set();
    forms.forEach((f, fi) => {
      const tag = `c${i}${fi ? '/v' + fi : ''}`;
      const put = (where, text, kind) => { const k = where + '|' + text; if (seen.has(k)) return; seen.add(k); add({ src: 'events', id: e.id, where: `${tag}.${where}`, text, kind, grade: e.grade, explicit: e.explicit }); };
      put('label', f.label, 'label');
      put('warn', f.warn, 'warn');
      put('hint', f.hint, 'warn');
      if (f.req && f.req.why) put('why', f.req.why, 'warn');
      for (const k of ['out', 'ok', 'fail']) if (f[k] && f[k].text) put(k, f[k].text, 'result');
      for (const k of ['out', 'ok', 'fail']) if (f[k] && typeof f[k].ledger === 'string' && f[k].ledger) put(k + '.ledger', f[k].ledger, 'ledger');
    });
    if (c.rope && c.rope.fail && c.rope.fail.text) add({ src: 'events', id: e.id, where: `c${i}.rope.fail`, text: c.rope.fail.text, kind: 'result', grade: e.grade, explicit: e.explicit });
  });
}
for (const l of tbl.lines) add({ src: 'lines', id: l.id, where: `${l.speaker}|${l.context || '-'}`, text: l.text, kind: 'line', grade: l.grade, speaker: l.speaker, context: l.context || '' });
for (const o of tbl.objects) {
  add({ src: 'objects', id: o.id, where: 'name', text: o.name, kind: 'name' });
  if (o.ledgerFact) for (const [st, t] of Object.entries(o.ledgerFact)) add({ src: 'objects', id: o.id, where: 'ledgerFact.' + st, text: t, kind: 'ledger' });
  if (o.holds && o.holds.text) add({ src: 'objects', id: o.id, where: 'holds', text: o.holds.text, kind: 'result', grade: 'normal' });
}
for (const p of tbl.people) {
  add({ src: 'people', id: p.id, where: 'name', text: p.name, kind: 'name' });
  add({ src: 'people', id: p.id, where: 'bio', text: p.bio, kind: 'name' });
  for (const [k, v] of Object.entries(p.addressYou || {})) add({ src: 'people', id: p.id, where: 'addressYou.' + k, text: v, kind: 'name' });
  add({ src: 'people', id: p.id, where: 'addressCold', text: p.addressCold, kind: 'name' });
  add({ src: 'people', id: p.id, where: 'callsGod', text: p.callsGod, kind: 'callsGod' });
}
for (const m of tbl.maps) add({ src: 'maps', id: m.id, where: 'displayName', text: m.displayName, kind: 'name' });
for (const n of tbl.numbers) if (n.name) add({ src: 'numbers', id: n.id, where: 'name(' + n.visible + ')', text: n.name, kind: 'name' });
for (const c of tbl.identity.candidates) add({ src: 'identity', id: c.id, where: 'callName', text: c.callName, kind: 'name' });

// ── 화면 코드의 한국어 글자열 (주석 뺌) ──
function codeStrings(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  const isHtml = /\.html$/.test(file);
  if (isHtml) { // html: 태그 밖 글 + 스크립트 글자열
    const text = src.replace(/<!--[\s\S]*?-->/g, '');
    text.split('\n').forEach((ln, k) => { const m = ln.match(/>([^<]*[가-힣][^<]*)</g); if (m) m.forEach((x) => out.push({ line: k + 1, text: x.slice(1, -1).trim() })); const a = ln.match(/(?:title|content|alt|placeholder|aria-label)="([^"]*[가-힣][^"]*)"/g); if (a) a.forEach((x) => out.push({ line: k + 1, text: x })); });
    return out;
  }
  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === '/' && nx === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (ch === '/' && nx === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; let j = i + 1, s = ''; const l0 = line;
      while (j < n && src[j] !== q) { if (src[j] === '\\') { s += src[j] + (src[j + 1] || ''); j += 2; continue; } if (src[j] === '\n') { if (q !== '`') break; line++; } s += src[j]; j++; }
      if (/[가-힣]/.test(s)) out.push({ line: l0, text: s });
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}
const CODE_FILES = ['game.js', 'ui.js', 'render.js', 'art.js', 'sound.js', 'spots.js', 'index.html'];
for (const f of CODE_FILES) {
  const p = path.join(V4, f);
  if (!fs.existsSync(p)) continue;
  for (const s of codeStrings(p)) add({ src: 'code', id: f + ':' + s.line, where: '', text: s.text, kind: 'code' });
}

// ── 검사 ──
const RULES = [
  ['신 이름', /네레|구르마|세엘|테르미아|오스렌|히스카|강림|징조|시선/],
  ['신 단독', /(^|[^가-힣])신(이|은|을|께|의|에게|님|들|이시여)?(?=[^가-힣]|$)/],
  ['호(신) 단독', /(^|[^가-힣])호(?=[^가-힣]|$)/],
  ['실존 종교', /하느님|하나님|부처님|예수|알라|여호와|사탄|성모/],
  ['실존 지명', /서울|을지로|명동|종로|회현|시청역|강남|신촌|홍대|동대문|남대문|충무로|광화문|청계|한강|부산|인천|대구|대전|광주|수원|용산|영등포|잠실|신림|사당|이태원|여의도|마포|서대문|성수|왕십리|압구정|선릉|역삼|구로|신도림|노량진|경복궁|남산|관악|송파|노원|도봉|은평|김포|일산|분당|판교|의정부|안양|부천|성남|고양|청량리|신당|약수|혜화|미아|수유|창동|상계|삼각지|이촌|공덕|합정|당산|문래|대림|봉천|방배|서초|뚝섬|건대|코레일|서울교통공사|메트로|[1-9]호선|경의선|경춘선|분당선|공항철도|KTX|신분당/],
  ['수치 노출', /(신뢰|스트레스|호감|카르마|원한|karma|grudge)\s*[:=]?\s*[+−-]?\d/i],
  ['수치 낱말', /카르마|원한|호감도|신뢰도|스트레스|karma|grudge/i],
  ['성적', /강간|성폭행|성추행|겁탈|능욕|옷을 벗기|몸을 더듬|추행|알몸|나체|젖가슴|가슴을 (만|움켜)|성기|섹스|성교|음란|애무|희롱|매춘|성매매|몸을 팔|욕정|발정|정액|사타구니/],
  ['자해', /자해|손목을 긋|목을 매|목을 맸|목매|스스로 목숨|목숨을 끊|자살|약을 털어|투신|뛰어내렸|극단적|스스로를 (찌|베|긋)/],
  ['식인 직접', /식인|인육|사람 ?고기|사람을 (먹|뜯|삶|굽)|살을 (먹|씹|발라|뜯|굽|삶)|살점을 (먹|씹)|고기를 (굽|삶|끓|씹|먹|뜯)|구운 (살|고기)|삶은 (살|고기)|뜯어 먹|살을 잘라 먹|뼈를 (발라|핥)/],
  ['식인 낱말(검토)', /고기|살점|국물|끓였|끓인|구웠|굽는|삶았|씹/],
  ['용어(§2)', /연기|천국|티켓|일지|로그|작업|인터랙트|상호작용|가스|(^|[^가-힣])표(?=[^가-힣]|$)|식량 ?[0-9]|병원 팀/],
  ['이유 낱말', /때문에|왜냐하면/],
];
const sentences = (t) => String(t).split(/(?<=[.?!…]["'”’」)]?)\s+/).map((x) => x.trim()).filter(Boolean);
const len = (x) => [...x].length;
const hits = {}; for (const [k] of RULES) hits[k] = [];
const lenErr = [];
const fmtErr = [];
const expWarn = [];
for (const it of items) {
  for (const [k, re] of RULES) {
    if (it.kind === 'callsGod' && /^신/.test(k)) continue;
    const m = re.exec(it.text);
    if (m) hits[k].push(it);
  }
  // 문장 규칙
  if (it.src === 'code' || it.kind === 'name' || it.kind === 'callsGod' || it.kind === 'ledger') continue;
  const ss = sentences(it.text);
  let maxLen = 40, maxSent = 4, whole = null;
  if (it.kind === 'label') { whole = 18; }
  else if (it.src === 'lines') {
    if (it.grade === 'toast') whole = 30; else if (it.grade === 'choice') whole = 18; else if (it.grade === 'fixed') { maxLen = 50; maxSent = 5; }
  } else if (it.grade === 'fixed') { maxLen = 50; maxSent = it.kind === 'body' ? 5 : 3; }
  const prob = [];
  if (whole != null) { if (len(it.text) > whole) prob.push(`${len(it.text)}자 > ${whole}`); }
  else {
    ss.forEach((x) => { if (len(x) > maxLen) prob.push(`문장 ${len(x)}자 > ${maxLen}: "${x}"`); });
    if (ss.length > maxSent) prob.push(`${ss.length}문장 > ${maxSent}`);
  }
  if (prob.length) lenErr.push({ it, prob });
  // {who:…} 서식
  const w = it.text.match(/\{[^}]*\}/g);
  if (w) for (const x of w) if (!/^\{who(:(이\/가|은\/는|을\/를|과\/와|이가|은는|을를|과와|의|이|가|아\/야))?\}$/.test(x) && !/^\{day\}$/.test(x)) fmtErr.push({ it, x });
  // explicit=0 인데 피·시체·칼 낱말 3개 이상
  if (it.src === 'events' && !it.explicit) { const c = (it.text.match(/피|시체|칼/g) || []).length; if (c >= 3) expWarn.push(it); }
}
const show = (it) => `${it.src}:${it.id}${it.where ? ' ' + it.where : ''} — "${it.text.length > 140 ? it.text.slice(0, 140) + '…' : it.text}"`;
log('# 최종 점검 — 화면 글 전수 검사 (qa_content_scan.js, 2026-10-25)');
log(`모은 글: ${items.length}개 (events ${items.filter((x) => x.src === 'events').length} · lines ${items.filter((x) => x.src === 'lines').length} · objects ${items.filter((x) => x.src === 'objects').length} · people ${items.filter((x) => x.src === 'people').length} · maps/numbers/identity ${items.filter((x) => ['maps', 'numbers', 'identity'].includes(x.src)).length} · 화면 코드 ${items.filter((x) => x.src === 'code').length})`);
log('');
for (const [k] of RULES) {
  log(`## ${k}: ${hits[k].length}건`);
  for (const it of hits[k]) log('- ' + show(it));
  log('');
}
log(`## 문장 규칙(31 §3) 위반: ${lenErr.length}건`);
for (const { it, prob } of lenErr) log(`- ${show(it)} · ${prob.join(' · ')}`);
log('');
log(`## {…} 서식: ${fmtErr.length}건`);
for (const { it, x } of fmtErr) log(`- ${show(it)} · ${x}`);
log('');
log(`## explicit=0 인데 피·시체·칼 3개 이상(경고): ${expWarn.length}건`);
for (const it of expWarn) log('- ' + show(it));
log('');

// ── ⑨ 안 만난 사람 이름: 화면이 가리지 않는(maskPeople 를 거치지 않는) 줄 ──
// game.js: 사건 본문·선택지·경고·결과·조사 글·수첩·사인 칸은 maskPeople/maskNames 를 거친다(증언 전 = 생김새).
//   가리지 않는 줄: 말 걸기(<사람>_*) · 소문(rum_*) · 몸짓(_idle) · 말풍선(bark_*) · 증언(testify_*) · 꿈(dream_*) · 결말(end_*·reveal_*·conductor_*·cab_*) · 토스트(toast_*)
const MASKED = (id) => /^insp_/.test(id) || /^look_/.test(id) || /^rope_/.test(id);
const PEOPLE = tbl.people.filter((p) => p.id !== 'you');
// 만남이 보장되는 날(그날 아침 이후로는 known) — 만남 사건 표에서 읽은 값: soonrye·mari D0 / gicheol D1 trace / eunji·dongha D2 trace / seoha D3 trace. 증언(진짜 이름)은 만난 날 저녁
const MET_BY = { soonrye: 1, mari: 1, gicheol: 2, eunji: 3, dongha: 3, seoha: 4, eunchae: 0, dohyeon: 0 };   // 이 날(포함)부터는 만남·증언이 끝났다
const nameRe = (p) => { const given = p.name.length >= 3 ? p.name.slice(1) : p.name; return new RegExp(`(?<!(?:한|두|세|네|몇|여러|열|[0-9])\\s?)(?:${p.name}|${given})`); };
function minDay(ctx) {
  let d = 0;
  const re = /day\s*(==|>=|>)\s*(\d+)/g; let m;
  while ((m = re.exec(ctx))) { const v = +m[2] + (m[1] === '>' ? 1 : 0); if (v > d) d = v; }
  return d;
}
const unmet = [];
for (const l of tbl.lines) {
  if (MASKED(l.id)) continue;
  for (const p of PEOPLE) {
    if (l.speaker === p.id) continue;
    if (!nameRe(p).test(l.text)) continue;
    const ctx = l.context || '';
    const safeFlag = p.metFlag && new RegExp(`(^|[^!])flag:${p.metFlag}(?![a-z_])`).test(ctx);
    const md = minDay(ctx);
    const safeDay = md >= (MET_BY[p.id] || 0);
    if (safeFlag && safeDay) continue;
    unmet.push({ l, p, md, safeFlag, safeDay });
  }
}
log(`## 안 만난 사람 이름 — 가리지 않는 줄 가운데 '만남 깃발도, 만남이 끝난 날 조건도' 없는 것: ${unmet.filter((x) => !x.safeFlag && !x.safeDay).length}건 (깃발은 있으나 증언 전일 수 있는 날: ${unmet.filter((x) => x.safeFlag && !x.safeDay).length}건 · 날은 되나 깃발 없음: ${unmet.filter((x) => !x.safeFlag && x.safeDay).length}건 — 날 조건만으로 충분)`);
for (const x of unmet.filter((y) => !y.safeDay)) log(`- ${x.safeFlag ? '[깃발 O·증언 전 가능]' : '[깃발 X]'} lines:${x.l.id} (${x.l.speaker}) ctx="${x.l.context || ''}" 최소 D${x.md} → ${x.p.name}(${x.p.id}, 만남 보장 D${MET_BY[x.p.id]}) — "${x.l.text}"`);
log('');
// 바깥사람(은채·도현): 생김새 줄이 없어 어디서나 진짜 이름 — 처음 나오는 곳 목록
log('## 바깥사람 이름(가림 없음)이 나오는 글');
for (const p of tbl.people.filter((q) => q.outside)) {
  const re = nameRe(p);
  const where = items.filter((it) => it.src !== 'people' && re.test(it.text));
  log(`- ${p.name}(${p.id}): ${where.length}곳`);
  for (const it of where) log(`    ${show(it)}${it.src === 'events' ? ' | when=' + (tbl.events.find((e) => e.id === it.id) || {}).when : it.src === 'lines' ? ' | ctx=' + (it.context || '') : ''}`);
}
log('');

// ── ⑩ 그림 연결 ──
const man4 = new Set(JSON.parse(fs.readFileSync(path.join(V4, 'img', 'manifest.json'), 'utf8')));
const v3p = path.join(ROOT, 'v3', 'img', 'manifest.json');
const man3 = new Set(fs.existsSync(v3p) ? JSON.parse(fs.readFileSync(v3p, 'utf8')).filter((n) => !/^(gods|cg\/(affl_|.*_(omen|advent)))/.test(n)) : []);
const V4_ALIAS = { scene_cannibal: 'd5_rail', scene_shutter: 'd6_shutter', cg_scissors: 'd7_fingers', scene_pillow: 'd8_pillow', cg_conductor: 'd9_inspection', cg_rot: 'd7_rot' };
const CG_ALIAS = { title_dark: '', cg_stairs: 'open_stairs', cg_speaker: 'open_speaker', cg_gicheol: 'open_gicheol', cg_notebook: 'open_cab', cg_bottles: 'n_thief',
  cg_count: 'story_voice', cg_notebook_back: 'story_ticket', scene_cannibal: 'corpse', cg_flood: 'flood_break', cg_pharmacy: 'a1_pharmacy', cg_gate: 'b1_gate', cg_dohyeon: 'dohyeon_key',
  cg_train: 'story_ticket', cg_ledger: '', cg_speaker_night: 'open_speaker', cg_bonepicker: 'a3_traces', cg_drowned: 'b4_tank', cg_walk: 'open_tunnel', scene_shutter: 'patrol', scene_pillow: 'n_fever',
  cg_scissors: 'n_rot', cg_conductor: 'story_ticket', title: 'title' };
function cgKey(id, evId) {   // art.js cgKey 와 같은 순서
  if (id && man4.has('cg/' + id)) return 'v4:' + id;
  if (evId && man4.has('cg/' + evId)) return 'v4:' + evId + '(사건 id)';
  if (id && V4_ALIAS[id] && man4.has('cg/' + V4_ALIAS[id])) return 'v4:' + V4_ALIAS[id] + '(별칭)';
  if (!id) return '';
  const a = CG_ALIAS[id] !== undefined ? CG_ALIAS[id] : id.replace(/^(cg|scene)_/, '');
  return a && man3.has('cg/' + a) ? 'v3:' + a : '';
}
const byState = { v4: [], v3: [], none: [], explicitNone: [], plainNone: [] };
for (const e of tbl.events) {
  const k = cgKey(e.image || '', e.id);
  const row = `${e.id} (image="${e.image || ''}", explicit=${e.explicit ? 1 : 0}, kind=${e.kind}) → ${k || '없음'}`;
  if (e.image && !k) byState.none.push(row);
  else if (k.startsWith('v3:')) byState.v3.push(row);
  else if (k.startsWith('v4:')) byState.v4.push(row + (man4.has('cg_s/' + k.slice(3).replace(/\(.*\)$/, '')) ? '' : ' · 작은 판(cg_s) 없음'));
  else if (e.explicit) byState.explicitNone.push(row);
  else byState.plainNone.push(row);
}
// 결과 그림(out.image 등)
const outImgs = [];
for (const e of tbl.events) e.choices.forEach((c, i) => { for (const f of S.variantsOf(c)) for (const k of ['out', 'ok', 'fail']) if (f[k] && f[k].image) outImgs.push(`${e.id} c${i}.${k}.image="${f[k].image}" → ${cgKey(f[k].image) || (/^death_/.test(f[k].image) && man4.has('cg/' + f[k].image) ? 'v4:' + f[k].image : '없음')}`); });
log(`## 그림 연결 — image 칸이 있는데 그림 파일이 없음(v4·v3 대체 모두 없음): ${byState.none.length}건`);
byState.none.forEach((r) => log('- ' + r));
log(`## 그림 연결 — v3 프로토타입 그림으로 대체되는 사건: ${byState.v3.length}건`);
byState.v3.forEach((r) => log('- ' + r));
log(`## 그림 연결 — 적나라(explicit=1)인데 image 칸이 비고 v4 cg/<사건 id> 도 없음(글만): ${byState.explicitNone.length}건`);
byState.explicitNone.forEach((r) => log('- ' + r));
log(`## 그림 연결 — v4 그림이 잡히는 사건: ${byState.v4.length}건`);
byState.v4.forEach((r) => log('- ' + r));
log(`## 결과 그림(out/ok/fail.image): ${outImgs.length}건`);
outImgs.forEach((r) => log('- ' + r));
log(`## 그림 없는 보통 사건(image 빈칸·explicit 0): ${byState.plainNone.length}건 (목록 생략)`);
// 쓰지 않는 v4 cg
const used = new Set(); for (const e of tbl.events) { const k = cgKey(e.image || '', e.id); if (k.startsWith('v4:')) used.add(k.slice(3).replace(/\(.*\)$/, '')); }
const IDENT_CG = ['dream_cab', 'dream_punch', 'dream_seat', 'dream_stairs'];
const unused = [...man4].filter((n) => n.startsWith('cg/')).map((n) => n.slice(3)).filter((n) => !used.has(n) && !/^death_/.test(n) && !IDENT_CG.includes(n));
log(`## 어느 사건에도 안 잡히는 v4 cg (death_·꿈 제외): ${unused.length}건 — ${unused.join(', ')}`);
console.log(OUT.join('\n'));
