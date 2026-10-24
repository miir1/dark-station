# (화면 담당 2026-10-24 검증 잔여 고친 뒤 다시 재기 — verify_SCR_spec/probe.py 사본. 더한 일은 probe_fix_tasks.py)
# 적대적 검증(화면 명세 단계) — 게임 파일은 고치지 않는다. screen_check.py 의 CDP 도구만 빌려 쓴다(포트·결과 폴더는 따로).
# 쓰기 (C:\dev\dark_station 에서): python docs/foundation/meeting_2026-10-24/apply/screen_fix/probe.py <일...>
#   names   : 판 전체(봇 + 모든 사람 말 걸기·주인 물건 조사·수첩 세 쪽) 동안 화면에 뜬 모든 글에서 증언 전 사람의 진짜 이름을 찾는다
#   ledger  : 사망 명부(D1 이후 죽음)·결말 명부(열차 저장) — 이름표·칸 겹침
#   space   : 방향키를 누른 채(자동 반복) Space/Enter 연타 · 방향키를 두드리며 Space 연타 — 고른 선택
#   wall    : 벽걸이 수납(구급함·레버함·터널 벽감 상자) — 당신 몸이 가린 몫(그리기 순서 + 불투명 픽셀)
#   poses   : 저녁·밤 지도에서 사람마다 앉기·잠 그림을 실제로 썼나
#   resume  : 배식 단계 저장(repay_bowl)을 타이틀 '계속'으로 이어 하기 → 배식 창
#   late    : 못 본 밤 먼지 → 조사하면 사라짐 · 토스트 하루 한 번
import os, sys, json, time, asyncio, subprocess, shutil, urllib.request, base64, io
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
import screen_check as SC
import websockets
from PIL import Image

SC.PORT, SC.DBG = 18893, 19637


async def _send(self, method, params=None):
    self.n += 1
    i = self.n
    fut = asyncio.get_event_loop().create_future()
    self.pending[i] = fut
    await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    m = await asyncio.wait_for(fut, 900)
    if 'error' in m:
        raise RuntimeError(m['error'])
    return m.get('result', {})
SC.CDP.send = _send
SC.OUTD = HERE
RES = {}


def load_fx(name):
    p = os.path.join(HERE, name)
    if os.path.exists(p) and os.path.getsize(p) > 10:
        with open(p, encoding='utf-8') as f:
            SC.FIXTURES.update(json.load(f))


OBS = r"""
(() => {
  window.__leak = { hits: [], n: 0, tag: '', texts: 0 };
  const SKIP = /^testify_/;
  function secrets() {
    const D = window.__ds4; if (!D || !D.state || !D.db) return [];
    const st = D.state, db = D.db, out = [];
    for (const id of db.peopleOrder) {
      if (id === 'you') continue;
      const rows = db.lines['testify_' + id] || []; if (!rows.length) continue;
      if (!(db.lines['look_' + id] || []).length) continue;
      if (rows.some((r, i) => st.heard && st.heard['testify_' + id + '#' + i] != null)) continue;
      const n = st.people[id] && st.people[id].name; if (!n) continue;
      out.push([id, n]); if (n.length >= 3) out.push([id, n.slice(1)]);
    }
    return out;
  }
  window.__secrets = secrets;
  function check(src, t) {
    t = String(t || ''); if (!t.trim()) return; window.__leak.n++;
    if (SKIP.test(window.__leak.tag)) return;
    const D = window.__ds4;
    for (const [id, n] of secrets()) {
      const re = new RegExp('(?<!(?:한|두|세|네|몇|여러|열|[0-9])\\s?)' + n);
      if (re.test(t)) window.__leak.hits.push({ src, id, n, met: D.met(id), day: D.state.day, phase: D.state.phase, pending: D.state.pending ? D.state.pending.id : '', kind: D.UI.openKind(), tag: window.__leak.tag, text: t.slice(0, 220) });
    }
  }
  window.__check = check;
  const vis = (el) => !!(el && el.getClientRects && el.getClientRects().length && !(el.closest && el.closest('[hidden]')));
  const mo = new MutationObserver((recs) => {
    const s = new Set();
    for (const r of recs) { const el = r.target.nodeType === 3 ? r.target.parentElement : r.target; if (el) s.add(el); }
    for (const el of s) if (vis(el)) check(el.id || el.className || el.tagName, el.innerText || el.textContent || '');
  });
  const start = () => { if (!document.body) return setTimeout(start, 5); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); };
  start();
  const wrap = () => {
    if (!window.UI || !window.UI.lines) return setTimeout(wrap, 5);
    const L = window.UI.lines;
    window.UI.lines = function (t, o) { const tg = (o && o.tag) || ''; window.__leak.tag = tg; const p = L.apply(this, arguments); Promise.resolve(p).finally(() => { if (window.__leak.tag === tg) window.__leak.tag = ''; }); return p; };
  };
  wrap();
})();
"""

# 판 전체 운전: autoRun 과 같은 길(전동차→터널→승강장→열흘) + 날·단계마다 '둘러보기'(이름 글 확인 · 말 걸기 · 주인 물건 조사 · 수첩 세 쪽)
DRIVER = r"""
window.__drive = async function (opt) {
  opt = opt || {};
  const D = __ds4, E = D.E, db = D.db, UI = D.UI;
  const st = () => D.state;
  const log = [];
  let book = [];
  const meHit = (v) => v && (v.who == null || v.who === 'you' || v.who === 'self');
  const outValue = (o) => { if (!o || !o.effects) return 0; const e = o.effects; let sc = 0; if (e.kill && meHit(e.kill)) sc -= 100; if (e.injure && meHit(e.injure)) sc -= 6 * (e.injure.n || 1); if (e.permanent && meHit(e.permanent)) sc -= 4; for (const k of ['food', 'water', 'meds']) if (typeof e[k] === 'number') sc += 1.5 * e[k]; return sc; };
  function pickEvent() {
    const ev = E.eventView(st(), db); if (!ev) return undefined;
    const rows = db.events[ev.id] ? db.events[ev.id].choices : [];
    let best = -1, bs = -Infinity;
    ev.choices.forEach((c, i) => { if (c.locked) return; const row = (E.effChoice ? E.effChoice(st(), db, rows[i] || {}) : rows[i]) || {}; const p = c.chance != null ? c.chance / 100 : 1;
      let sc = row.check ? p * outValue(row.ok) + (1 - p) * outValue(row.fail) : outValue(row.out); if (c.taboo) sc -= (opt.taboo ? -3 : 3); if (c.warn) sc -= 0.5; if (c.cost) sc -= 0.3; if (sc > bs) { bs = sc; best = i; } });
    log.push(`D${st().day} ${st().phase} ${ev.id} -> ${ev.choices[best] ? ev.choices[best].label : '?'}`);
    return best >= 0 ? best : undefined;
  }
  D.setBot((kind, info) => {
    if (kind === 'line') return undefined;
    if (kind === 'event') { const bi = info.options.findIndex((o) => o.value === 'board'); if (bi >= 0 && opt.board && !opt._b) { opt._b = 1; return bi; } return pickEvent(); }
    if (kind === 'board') { const bi = info.options.findIndex((o) => / 태운다$/.test(o.label)); return bi >= 0 ? bi : info.options.length - 1; }
    if (kind === 'book') { const want = book.shift(); if (!want) return info.options.length - 1; const i = info.options.findIndex((o) => o.value === want); return i >= 0 ? i : info.options.length - 1; }
    if (kind === 'bookpage') { if (opt.cause && book.causeTry !== st().day) { const ci = info.options.findIndex((o) => String(o.value || '').startsWith('cause:') && !o.disabled); if (ci >= 0) { book.causeTry = st().day; return ci; } } return info.options.length - 1; }
    if (kind === 'cause') { return info.options.length - 1; }
    if (kind === 'trip') return 0;
    if (kind === 'deeper') return 1;
    if (kind === 'ration') return info.options.length - 1;
    if (kind === 'confirm2') return 0;
    if (kind === 'treat') { const i = info.options.findIndex((o) => o.value === 'you' && !o.disabled); return i >= 0 && (st().people.you.n.injury || 0) >= 2 ? i : info.options.length - 1; }
    if (kind === 'tend') { const i = info.options.findIndex((o) => o.label === '말을 건다'); return i >= 0 ? i : info.options.length - 1; }
    if (kind === 'fire') return 0;
    if (kind === 'write') return 1;
    return undefined;
  });
  const check = window.__check || (() => {});
  const OWN = /^(bowl|bottle|blanket|pillow|bandage)_(soonrye|seoha|gicheol|eunji|dongha|mari)$/;
  async function look(tagp) {
    for (const p of D.peopleOnMap()) { check('map-person:' + p.id, p.name); check('hover-person:' + p.id, D.hoverName(p.x, p.y)); }
    for (const o of D.objectsOnMap()) { if (o.hidden) continue; check('map-obj:' + o.id, o.name); check('hover-obj:' + o.id, D.hoverName(o.x, o.y)); }
    const g = document.getElementById('goal'); if (g) check('goal', g.textContent);
    const h = document.getElementById('hint'); if (h) check('hint', h.textContent);
  }
  async function explore() {
    const ph = st().phase;
    await look();
    if (ph === 'day' || ph === 'trace' || ph === 'evening') {
      for (const p of D.peopleOnMap().filter((q) => q.talkable)) { if (st().ended || st().phase !== ph) break; await D.idle(); await D.flow(() => D.talkTo(p.id)); await D.idle(); }
      const objs = D.objectsOnMap().filter((o) => !o.hidden && OWN.test(o.id));
      for (const o of objs.slice(0, opt.maxObj || 8)) { if (st().ended || st().phase !== ph) break; await D.use(o.id); await D.idle(); await look(); }
    }
    if (!st().ended) { book = ['ledger', 'facts', 'log']; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); await new Promise((r) => setTimeout(r, 50)); await D.idle(); book = []; }
  }
  await D.idle();
  await D.use('lever'); await D.use('notebook_dash'); await D.goto(21, 3); await D.idle();
  await D.use('gicheol'); await D.goto(29, 2); await D.idle();
  await look();
  await D.use('soonrye'); await D.use('speaker'); await D.use('blanket_mari');
  const did = {}; const once = (k) => (did[k] ? false : (did[k] = true));
  let guard = 0;
  while (!st().ended && guard++ < (opt.guard || 400)) {
    await D.idle();
    if (st().ended) break;
    const ph = st().phase, d = st().day;
    if (opt.stopDay != null && d >= opt.stopDay) break;
    if (ph === 'trace' && d > 0 && opt.lateProbe && once('late' + d)) {
      const t = document.getElementById('toast');
      if (!window.__tobs) { window.__toasts = []; window.__tobs = new MutationObserver(() => { if (!t.hidden) window.__toasts.push(t.textContent); }); window.__tobs.observe(t, { childList: true, characterData: true, subtree: true, attributes: true }); }
      const eng = Object.entries(st().traces).filter(([k, x]) => x.late && x.day === d - 1 && !x.seen).map(([k, x]) => [k, x.st]);
      const mapLate = D.objectsOnMap().filter((o) => o.late).map((o) => [o.id, o.hidden]);
      await new Promise((r) => setTimeout(r, 250));
      const rec = { d, eng, mapLate, dust0: ((RENDER.last && RENDER.last.dust) || []).map((x) => x.id), noticeDay: st().noticeDay, office: st().traces.office_door ? st().traces.office_door.st : null, metSeoha: !!st().flags.met_seoha, key: !!st().flags.has_office_key, ins: [] };
      const vis = mapLate.filter((x) => !x[1]).map((x) => x[0]);
      const nonLate = D.objectsOnMap().filter((o) => !o.hidden && !o.late && /^(bottle|blanket|pillow)_/.test(o.id)).map((o) => o.id).slice(0, 1);
      for (const oid of nonLate.concat(vis.slice(0, 2)).concat(vis.slice(0, 1))) {
        window.__toasts = []; const before = D.inspectLog.length;
        await D.use(oid); await D.idle(); await new Promise((r) => setTimeout(r, 200));
        rec.ins.push({ oid, toasts: window.__toasts.slice(), log: D.inspectLog.slice(before), dust: ((RENDER.last && RENDER.last.dust) || []).map((x) => x.id) });
      }
      (window.__lateLog = window.__lateLog || []).push(rec);
      continue;
    }
    if (once('x' + d + ph)) { if (!opt.noExplore) await explore(); continue; }
    if (!opt.skipShutter && ph === 'day' && d === 1 && !st().flags.met_eunji && once('shutter')) { await D.use('shutter_gap'); continue; }
    if (opt.shutterDay && ph === 'day' && d === opt.shutterDay && once('shutter2')) { await D.use('shutter_gap'); await D.idle(); continue; }
    if (ph === 'trace' && d > 0 && once('trace' + d)) { await D.use('notebook_you'); continue; }
    await D.use('fire');
  }
  return { log, day: st().day, phase: st().phase, ended: st().ended ? st().ended.why : null, you: st().people.you.status };
};
"""


async def connect():
    prof = os.path.join(HERE, '.profile_probe_' + str(SC.DBG))
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    proc = subprocess.Popen([SC.browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={SC.DBG}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws_url = None
    for _ in range(80):
        try:
            lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{SC.DBG}/json/list', timeout=2).read())
            pg = [t for t in lst if t.get('type') == 'page']
            if pg:
                ws_url = pg[0]['webSocketDebuggerUrl']
                break
        except Exception:
            pass
        time.sleep(0.5)
    return proc, prof, ws_url


async def t_names(c, opts):
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': OBS}))['identifier']
    out = []
    try:
        for seed in [int(x) for x in opts.get('seeds', '3,11').split(',')]:
            await c.open(f'/v4/index.html?fast=1&auto=car&seed={seed}&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
            await c.ev(DRIVER, False)
            t0 = time.time()
            dopt = json.dumps({'maxObj': int(opts.get('maxobj', '8')), 'cause': True})
            await c.ev("(window.__driveRes = null, __drive(" + dopt + ").then((r) => { window.__driveRes = r; }, (e) => { window.__driveRes = { err: String(e && e.stack || e) }; }), 1)", False)
            r = None
            while time.time() - t0 < int(opts.get('limit', '2400')):
                await asyncio.sleep(3)
                r = await c.ev('window.__driveRes', False)
                if r:
                    break
            r = r or {'err': 'timeout', 'state': await c.ev("({ d: __ds4.state.day, ph: __ds4.state.phase, open: __ds4.UI.openKind() })", False)}
            hits = await c.ev('window.__leak.hits', False)
            n = await c.ev('window.__leak.n', False)
            # 끝 화면(명부)이 열려 있으면 그것까지
            await asyncio.sleep(1.0)
            hits = await c.ev('window.__leak.hits', False)
            uniq = {}
            for h in hits:
                k = (h['src'].split(':')[0], h['n'], h['text'][:60])
                uniq.setdefault(k, h)
            rec = {'seed': seed, 'run': r, 'secs': round(time.time() - t0), 'checked_texts': n, 'hits': len(hits), 'unique': list(uniq.values())[:80], 'errors': c.errors()[:10]}
            out.append(rec)
            print('names seed', seed, '| end', r.get('ended'), r.get('day'), r.get('you'), '| texts', n, '| leak hits', len(hits), 'unique', len(uniq), '| errors', len(c.errors()))
            for h in list(uniq.values())[:25]:
                print('   ', h['src'], h['n'], 'met' if h['met'] else 'UNMET', f"D{h['day']} {h['phase']}", h['pending'], h['kind'], '|', h['text'][:110])
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    RES['names'] = out


CHOICES_JS = r"""((ev) => { const s = __ds4.state; const r = s.lastResult || {}; const lg = (s.log || []).filter((l) => l.kind === 'choice');
  return { fired: (s.fired || {})[ev] || 0, newest: lg.length ? lg[0].text : '', lastEv: r.event || '', lastChoice: r.choice == null ? '' : String(r.choice), lastI: r.i == null ? -1 : r.i, open: __ds4.UI.openKind(), you: s.people.you.status, ended: s.ended ? s.ended.why : null,
    pending: s.pending ? s.pending.id : null, sel: (document.querySelector('#box .opt.sel .ol') || {}).textContent || '' }; })"""


async def key_pump(c, plan, secs):
    """plan: dict  hold=[키…](처음 한 번 누르고 35ms 마다 자동 반복) · mash=키(80ms 마다 누름/뗌) · tap=키(160ms 마다 누름/뗌)"""
    t0 = time.time()
    for k in plan.get('hold', []):
        await c.key(k, 'keyDown')
    nxt = {'rep': 0, 'mash': 0, 'tap': 0}
    while time.time() - t0 < secs:
        now = time.time() - t0
        if now >= nxt['rep']:
            for k in plan.get('hold', []):
                await c.key(k, 'keyDown', True)
            nxt['rep'] = now + 0.035
        if plan.get('mash') and now >= nxt['mash']:
            await c.key(plan['mash'], 'keyDown')
            await c.key(plan['mash'], 'keyUp')
            nxt['mash'] = now + 0.08
        if plan.get('tap') and now >= nxt['tap']:
            await c.key(plan['tap'], 'keyDown')
            await asyncio.sleep(0.03)
            await c.key(plan['tap'], 'keyUp')
            nxt['tap'] = now + 0.16
        await asyncio.sleep(0.01)
    for k in plan.get('hold', []):
        await c.key(k, 'keyUp')


SPACE_MODES = {
    'hold_down+mash_space': {'hold': ['ArrowDown'], 'mash': ' '},
    'hold_up+mash_space': {'hold': ['ArrowUp'], 'mash': ' '},
    'hold_s+mash_enter': {'hold': ['s'], 'mash': 'Enter'},
    'hold_space+hold_up': {'hold': [' ', 'ArrowUp']},
    'tap_up+mash_space': {'tap': 'ArrowUp', 'mash': ' '},          # 누른 채가 아니라 두드리며 걷기 (더 거친 경우)
    'tap_down+mash_space': {'tap': 'ArrowDown', 'mash': ' '},
}


async def t_space(c, opts):
    evs = [e for e in opts.get('evs', 'pro_stairs,d3_called_you,called_up,dawn_mob,d10_hold,dawn_strike').split(',') if e in SC.FIXTURES]
    modes = [m for m in opts.get('modes', ','.join(SPACE_MODES)).split(',') if m in SPACE_MODES]
    out = []
    for ev in evs:
        rows = await_rows = None
        for m in modes:
            r = {'ev': ev, 'mode': m}
            try:
                await c.open(f'/v4/index.html?fast=1&auto=evline&state=/__fixture/{ev}.json&sc={int(time.time())}')
                await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && !__ds4.UI.bot", 90)
                await asyncio.sleep(0.3)
                r['before'] = await c.ev(CHOICES_JS + f"('{ev}')", False)
                r['choices'] = await c.ev("(() => { const v = __ds4.E.eventView(__ds4.state, __ds4.db); const m = __ds4.E.choiceMeta(__ds4.state, __ds4.db) || []; return v ? v.choices.map((x, i) => ({ label: x.label, warn: x.warn || '', taboo: !!x.taboo, chance: x.chance, kill: !!(m[i] && m[i].kill) })) : []; })()", False)
                await key_pump(c, SPACE_MODES[m], float(opts.get('secs', '6')))
                await asyncio.sleep(0.8)
                r['after'] = await c.ev(CHOICES_JS + f"('{ev}')", False)
                picked = r['after']['fired'] > r['before']['fired'] or (r['after']['lastEv'] == ev and r['before']['lastEv'] != ev)
                r['picked'] = r['after']['newest'] if picked else ''
                pk = None
                if picked and r['after']['lastEv'] == ev and r['after']['lastI'] >= 0:
                    i = r['after']['lastI']
                    pk = dict(r['choices'][i], idx=i) if i < len(r['choices']) else {'idx': i, 'label': r['after']['lastChoice']}
                elif picked:
                    pk = {'label': r['after']['lastChoice'], 'ev': r['after']['lastEv']}
                r['picked_info'] = pk
                r['died'] = r['after']['you'] != 'home'
            except BaseException as e:
                r['error'] = repr(e)[:300]
            r['errors'] = c.errors()[:5]
            out.append(r)
            print('space', ev, m, '| picked:', r.get('picked') or '-', '| info', r.get('picked_info'), '| died', r.get('died'), '| open', (r.get('after') or {}).get('open'), (r.get('after') or {}).get('sel'), '|', r.get('error', ''))
    RES['space'] = out


# 벽걸이 가림: 한 프레임을 그리며 drawImage 를 모두 적고, 그 물건 그림의 불투명 픽셀 가운데 '뒤에 그린 당신 그림'의 불투명 픽셀에 덮인 몫
OCCL_JS = r"""((objId) => {
  const D = __ds4, R = window.RENDER, A = window.ART;
  const sid = A.spriteId('you'), youImgs = new Set();
  for (const d of ['up', 'down', 'left', 'right']) for (let f = 0; f < 4; f++) for (let h = 0; h < 4; h++) { try { const im = A.person(sid, f, h, d); if (im) youImgs.add(im); } catch (e) {} }
  const o = D.objectsOnMap().find((q) => q.id === objId);
  if (!o) return { err: 'no obj' };
  const art = R.artFor ? R.artFor(o) : null;
  const calls = [];
  const P = CanvasRenderingContext2D.prototype, orig = P.drawImage;
  P.drawImage = function (im) { const a = Array.prototype.slice.call(arguments, 1); const m = this.getTransform(); calls.push({ im, a, e: m.e, f: m.f, sx: m.a, sy: m.d }); return orig.apply(this, arguments); };
  try { D.frame(); } finally { P.drawImage = orig; }
  const rect = (c) => { const im = c.im, a = c.a; let sx = 0, sy = 0, sw = im.width, sh = im.height, dx, dy, dw, dh;
    if (a.length === 2) { dx = a[0]; dy = a[1]; dw = sw; dh = sh; } else if (a.length === 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; } else { sx = a[0]; sy = a[1]; sw = a[2]; sh = a[3]; dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
    return { sx, sy, sw, sh, dx: c.e + dx * c.sx, dy: c.f + dy * c.sy, dw: dw * c.sx, dh: dh * c.sy }; };
  const alpha = (im) => { const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
  const si = calls.findIndex((c) => c.im === art);
  if (si < 0) return { err: 'storage image not drawn', state: o.state, n: calls.length };
  const S = rect(calls[si]), sa = alpha(calls[si].im);
  const mask = new Map();   // 'x,y' canvas px → 1 (그 물건의 불투명 픽셀)
  let sTot = 0, sBottom = -1e9;
  for (let y = 0; y < S.sh; y++) for (let x = 0; x < S.sw; x++) { if (sa[((S.sy + y) * calls[si].im.width + (S.sx + x)) * 4 + 3] > 40) { const X = Math.round(S.dx + x * S.dw / S.sw), Y = Math.round(S.dy + y * S.dh / S.sh); mask.set(X + ',' + Y, 1); sTot++; sBottom = Math.max(sBottom, Y); } }
  let covered = 0, youTop = 1e9; const seen = new Set();
  calls.forEach((c, i) => { if (i <= si || !youImgs.has(c.im)) return; const Rr = rect(c), ya = alpha(c.im);
    for (let y = 0; y < Rr.sh; y++) for (let x = 0; x < Rr.sw; x++) { if (ya[((Rr.sy + y) * c.im.width + (Rr.sx + x)) * 4 + 3] > 40) { const X = Math.round(Rr.dx + x * Rr.dw / Rr.sw), Y = Math.round(Rr.dy + y * Rr.dh / Rr.sh); youTop = Math.min(youTop, Y); const k = X + ',' + Y; if (mask.has(k) && !seen.has(k)) { seen.add(k); covered++; } } } });
  const youDrawnBefore = calls.some((c, i) => i < si && youImgs.has(c.im));
  return { obj: objId, state: o.state, storagePx: sTot, coveredPx: covered, visiblePct: sTot ? Math.round(1000 * (1 - covered / sTot)) / 10 : null, gapPx: youTop < 1e9 ? youTop - sBottom - 1 : null, youDrawnBefore, crouch: !!D.scene.crouch, you: [D.scene.px, D.scene.py, D.scene.face] };
})"""


HOLD_OUT = r"""(() => { window.__lines = []; window.__held = 0; __ds4.setBot((k, info) => { if (k === 'line') { window.__lines.push([info.text, info.opts && info.opts.tag]); if (info.opts && /:out$/.test(info.opts.tag || '') && !window.__held) { window.__held = 1; return 'hold'; } return undefined; } if (k === 'event') return 0; return undefined; }); return 1; })()"""


async def occl(c, oid):
    return await c.ev(OCCL_JS + f"('{oid}')", False)


async def t_wall(c, opts):
    out = {}
    # 전동차: 구급함(19,1) · 레버함(20,1) — 바로 아래 칸에서 위를 보고 (닫힘 · 여는 결과 글 동안 · 연 뒤)
    for oid, (x, y) in (('medkit', (19, 2)), ('lever', (20, 2))):
        await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
        await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
        await SC.normal_speed(c)
        await SC.place(c, x, y, 'up')
        await asyncio.sleep(0.3)
        rec = {'closed': await occl(c, oid)}
        await SC.ap_zoom(c, f'verify_wall_{oid}_closed.png', x - 2, y - 2, x + 3, y + 1, 5)
        await c.ev(HOLD_OUT, False)
        await c.ev("__ds4.interact(); 1", False)
        await SC.until(c, "window.__held === 1", 20)
        await asyncio.sleep(0.6)
        rec['during_result'] = await occl(c, oid)
        await SC.ap_zoom(c, f'verify_wall_{oid}_open_during.png', x - 2, y - 2, x + 3, y + 1, 5)
        await c.ev("(() => { __ds4.setBot((k) => undefined); __ds4.UI.key('ok'); return 1; })()", False)
        await SC.drive_lines(c, 15)
        await asyncio.sleep(0.4)
        rec['after'] = await occl(c, oid)
        out[oid] = rec
        print('wall', oid, json.dumps(rec, ensure_ascii=False))
    # 터널 벽감 상자(14,0): 바로 아래(14,1) · 옆 칸(13,1)·(15,1) 위 보기 / 옆 칸에서 열기
    await c.open(f'/v4/index.html?fast=1&auto=tunnel&seed=7&sc={int(time.time())}')
    await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'tunnel' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
    await SC.normal_speed(c)
    rec = {}
    for (x, y) in ((14, 1), (13, 1), (15, 1)):
        await SC.place(c, x, y, 'up')
        await asyncio.sleep(0.3)
        rec[f'closed_{x}_{y}'] = await occl(c, 'shelter_box')
        rec[f'hint_{x}_{y}'] = await c.ev("document.getElementById('hint').textContent", False)
    await SC.ap_zoom(c, 'verify_wall_shelter_closed_14_1.png', 12, 0, 17, 3, 5)
    for (x, y) in ((14, 1), (13, 1)):
        if (x, y) == (13, 1):
            await c.open(f'/v4/index.html?fast=1&auto=tunnel&seed=7&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'tunnel' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
            await SC.normal_speed(c)
        await SC.place(c, x, y, 'up')
        await asyncio.sleep(0.2)
        await c.ev(HOLD_OUT, False)
        await c.ev("__ds4.interact(); 1", False)
        await SC.until(c, "window.__held === 1", 20)
        await asyncio.sleep(0.6)
        rec[f'during_{x}_{y}'] = await occl(c, 'shelter_box')
        await SC.ap_zoom(c, f'verify_wall_shelter_open_during_{x}_{y}.png', 12, 0, 17, 3, 5)
        await c.ev("(() => { __ds4.setBot((k) => undefined); __ds4.UI.key('ok'); return 1; })()", False)
        await SC.drive_lines(c, 15)
        await asyncio.sleep(0.4)
        rec[f'after_{x}_{y}'] = await occl(c, 'shelter_box')
        await SC.ap_zoom(c, f'verify_wall_shelter_open_after_{x}_{y}.png', 12, 0, 17, 3, 5)
    out['shelter_box'] = rec
    print('wall shelter', json.dumps(rec, ensure_ascii=False))
    RES['wall'] = out


POSE_JS = r"""(() => {
  const D = __ds4, A = window.ART, calls = [];
  const wrap = (name) => { const f = A[name]; A[name] = function () { const r = f.apply(this, arguments); calls.push({ fn: name, args: Array.prototype.slice.call(arguments).map(String), ok: !!r }); return r; }; return () => { A[name] = f; }; };
  const un = ['sitPose', 'pose', 'sleeper', 'sleeperBack', 'person'].map(wrap);
  try { D.frame(); } finally { un.forEach((u) => u()); }
  const ppl = D.peopleOnMap();
  return ppl.map((p) => { const k = A.spriteId(p.id); const mine = calls.filter((c) => c.args[0] === p.id || c.args[0] === k);
    return { id: p.id, pose: p.pose, face: p.face, cold: !!p.cold, sitOwnImg: !!A.IMG['v4/sit/' + k], sleepOwnImg: !!A.IMG['v4/sleep/' + k],
      sitPose: mine.filter((c) => c.fn === 'sitPose').map((c) => c.ok), shared: mine.some((c) => c.fn === 'pose'), sleeper: mine.filter((c) => c.fn === 'sleeper' || c.fn === 'sleeperBack').map((c) => c.fn + ':' + c.ok), personCalls: mine.filter((c) => c.fn === 'person').length }; });
})()"""


async def t_poses(c, opts):
    out = {}
    await SC.goto_point(c, 'eve3', "__ds4.state.day === 3 && __ds4.state.phase === 'evening'")
    await SC.normal_speed(c)
    for (x, y, nm) in ((13, 13, 'far'), (13, 11, 'near')):
        await SC.place(c, x, y, 'up')
        await asyncio.sleep(0.3)
        out['evening_' + nm] = await c.ev(POSE_JS, False)
    await SC.ap_zoom(c, 'verify_poses_evening.png', 8, 8, 19, 14, 3)
    await SC.goto_point(c, 'beds', "__ds4.state.day === 2 && __ds4.state.phase === 'night'")
    await SC.normal_speed(c)
    out['night'] = await c.ev(POSE_JS, False)
    await SC.ap_zoom(c, 'verify_poses_night.png', 14, 8, 23, 12, 4)
    # 시트 자체: 9명 × 앉기 4줄 · 잠 1장 — 비어 있지 않고 사람마다 다르다
    sheets = {}
    import hashlib
    for kind in ('sit', 'sleep'):
        for f in sorted(os.listdir(os.path.join(ROOT, 'v4', 'img', kind))):
            im = Image.open(os.path.join(ROOT, 'v4', 'img', kind, f)).convert('RGBA')
            rows = im.height // 32
            ops = [sum(1 for y in range(r * 32, r * 32 + 32) for x in range(32) if im.getpixel((x, y))[3] > 40) for r in range(rows)]
            sheets[kind + '/' + f] = {'rows_opaque': ops, 'md5': hashlib.md5(im.tobytes()).hexdigest()[:10]}
    out['sheets'] = sheets
    dup = {}
    for k, v in sheets.items():
        dup.setdefault((k.split('/')[0], v['md5']), []).append(k)
    out['sheet_dups'] = [v for v in dup.values() if len(v) > 1]
    print('poses evening far', json.dumps(out['evening_far'], ensure_ascii=False))
    print('poses evening near', json.dumps(out['evening_near'], ensure_ascii=False))
    print('poses night', json.dumps(out['night'], ensure_ascii=False))
    print('sheets', json.dumps(sheets, ensure_ascii=False), 'dups', out['sheet_dups'])
    RES['poses'] = out


async def t_resume(c, opts):
    out = {}
    for ev in [e for e in opts.get('evs', 'repay_bowl,share_back').split(',') if e in SC.FIXTURES]:
        r = {}
        try:
            await c.open(f'/v4/index.html?fast=1&auto=car&seed=7&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
            r['saved'] = await c.ev(f"""(async () => {{ const raw = await fetch('/__fixture/{ev}.json').then((x) => x.json()); const s = __ds4.E.normalize(DS4.save.migrate(raw), __ds4.db); __ds4.store().save(s); return {{ day: s.day, phase: s.phase, pending: s.pending ? s.pending.id : null }}; }})()""", True)
            await c.open(f'/v4/index.html?fast=1&sc={int(time.time())}')
            await c.wait("__ds4.db && __ds4.UI.openKind() === 'title'", 60)
            r['title'] = await c.ev("[...document.querySelectorAll('#box .opt .ol')].map((b) => b.textContent)", False)
            await asyncio.sleep(0.5)
            await c.ev("__ds4.UI.pick(0); 1", False)
            seq = []
            for _ in range(40):
                await asyncio.sleep(0.5)
                k = await c.ev("__ds4.UI.openKind()", False)
                st = await c.ev("({ d: __ds4.state && __ds4.state.day, ph: __ds4.state && __ds4.state.phase, p: __ds4.state && __ds4.state.pending ? __ds4.state.pending.id : null })", False)
                seq.append([k, st])
                if k == 'line':
                    await c.ev("__ds4.UI.key('ok'); 1", False)
                elif k == 'event':
                    await asyncio.sleep(0.5)
                    await c.ev("__ds4.UI.pick(0); 1", False)
                elif k == 'ration':
                    r['ration_opened'] = True
                    await asyncio.sleep(0.5)
                    await c.ev("__ds4.UI.pick(document.querySelectorAll('#box .opt').length - 1); 1", False)
                elif k == '' and st.get('ph') not in ('ration',) and r.get('ration_opened'):
                    break
                elif k == '' and len(seq) > 12 and all(x[0] == '' for x in seq[-6:]):
                    break
            r['seq'] = seq[-14:]
            r['final'] = await c.ev("({ d: __ds4.state.day, ph: __ds4.state.phase, p: __ds4.state.pending ? __ds4.state.pending.id : null, open: __ds4.UI.openKind() })", False)
        except BaseException as e:
            r['error'] = repr(e)[:300]
        r['errors'] = c.errors()[:5]
        out[ev] = r
        print('resume', ev, '| saved', r.get('saved'), '| title', r.get('title'), '| ration opened', r.get('ration_opened'), '| final', r.get('final'), '|', r.get('error', ''), r['errors'])
    RES['resume'] = out


async def t_late(c, opts):
    """시뮬 저장(새벽 trace 단계 사건)에서: 엔진이 실제로 남긴 late 흔적 → 지도 먼지 → 조사하면 사라짐 · 토스트는 그날 첫 조사 한 번."""
    out = []
    for ev in [e for e in opts.get('evs', 'dawn_mob,dawn_strike,crate_lid').split(',') if e in SC.FIXTURES]:
        r = {'ev': ev}
        try:
            await c.open(f'/v4/index.html?fast=1&auto=evhold&state=/__fixture/{ev}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.openKind() === 'event'", 90)
            await c.ev(SC.SP_FLOW_BOT, False)
            await c.ev("__ds4.UI.pick(0); 1", False)
            await SC.until(c, "!__ds4.state.pending && !__ds4.UI.isOpen() && !__ds4.scene.auto", 40)
            await SC.normal_speed(c)
            await asyncio.sleep(0.5)
            await c.ev(SC.PASS_BOT, False)
            r['state'] = await c.ev("({ d: __ds4.state.day, ph: __ds4.state.phase, noticeDay: __ds4.state.noticeDay, you: __ds4.state.people.you.status })", False)
            r['engine_late'] = await c.ev("Object.entries(__ds4.state.traces).filter(([k, t]) => t.late).map(([k, t]) => [k, t.st, t.day, t.seen])", False)
            r['map_late'] = await c.ev("__ds4.objectsOnMap().filter((o) => o.late).map((o) => [o.id, o.hidden])", False)
            await asyncio.sleep(0.3)
            r['dust_drawn'] = await c.ev("(RENDER.last.dust || []).map((d) => d.id)", False)
            ins = []
            targets = [x[0] for x in r['map_late'] if not x[1]][:2] or []
            other = await c.ev("__ds4.objectsOnMap().filter((o) => !o.hidden && !o.late && /^(bowl|bottle|blanket)_/.test(o.id)).map((o) => o.id).slice(0, 1)", False)
            for oid in targets + other + targets[:1]:
                await c.ev("window.__toasts = []; (() => { const t = document.getElementById('toast'); if (!window.__tobs) { window.__tobs = new MutationObserver(() => { if (!t.hidden) window.__toasts.push(t.textContent); }); window.__tobs.observe(t, { childList: true, characterData: true, subtree: true, attributes: true }); } })(); 1", False)
                txt = await SC.ap_inspect(c, oid)
                await asyncio.sleep(0.3)
                ins.append({'obj': oid, 'texts': txt, 'toasts': await c.ev('window.__toasts', False), 'dust_after': await c.ev("(RENDER.last.dust || []).map((d) => d.id)", False),
                            'lid': await c.ev("(__ds4.inspectLog.slice(-1)[0] || {}).lid", False)})
            r['inspect'] = ins
        except BaseException as e:
            r['error'] = repr(e)[:300]
        r['errors'] = c.errors()[:5]
        out.append(r)
        print('late', ev, json.dumps(r, ensure_ascii=False)[:900])
    RES['late'] = out


LEDGER_JS = r"""(() => { const box = document.getElementById('box'), cg = document.getElementById('cg');
  const ov = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const rowsOf = (sel) => [...document.querySelectorAll(sel)].map((r) => { const kids = [...r.children].filter((k) => k.getClientRects().length); const rs = kids.map((k) => k.getBoundingClientRect());
    const overlaps = []; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) if (rs[i].width && rs[j].width && ov(rs[i], rs[j])) overlaps.push([kids[i].className || i, kids[j].className || j]);
    const clipped = kids.filter((k) => k.scrollWidth > k.clientWidth + 1).map((k) => k.className || k.tagName);
    return { text: r.textContent, overlaps, clipped, kids: kids.map((k, i) => [k.className, Math.round(rs[i].left), Math.round(rs[i].right), k.textContent]) }; });
  return { kind: __ds4.UI.openKind(), head: ((box && box.querySelector('.who')) || {}).textContent || '', mini: rowsOf('#box .ledger .row'), page: rowsOf('#cg .lrow'),
    boxOverflow: box ? box.scrollHeight > box.clientHeight + 1 : null, secrets: window.__secrets ? window.__secrets() : null, real: Object.values(__ds4.state.people).filter((p) => p.id !== 'you').map((p) => p.name) }; })()"""


async def t_ledger(c, opts):
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': OBS}))['identifier']
    out = {}
    try:
        # (가) 사망 명부: 시뮬 저장(증언 기록 없음 = 모두 생김새 이름표)에서 '대답한다'(금기, 당신이 올라간다) → 확인창 '그렇게 한다' → 사망 명부
        for ev, pat in (('called_up', '대답한다'), ('d3_called_you', '대답한다')):
            if ev not in SC.FIXTURES:
                continue
            await c.open(f'/v4/index.html?fast=1&auto=evhold&state=/__fixture/{ev}.json&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.UI.openKind() === 'event'", 90)
            await c.ev("(() => { __ds4.setBot((k, info) => { if (k === 'confirm2') return 0; if (k === 'death_ledger' || k === 'ending') return 'hold'; return undefined; }); return 1; })()", False)
            idx = await c.ev(f"[...document.querySelectorAll('#box .opt .ol')].findIndex((b) => b.textContent.startsWith('{pat}'))", False)
            await asyncio.sleep(0.5)
            await c.ev(f"__ds4.UI.pick({idx}); 1", False)
            await SC.until(c, "__ds4.UI.openKind() === 'death_ledger'", 40)
            await asyncio.sleep(0.5)
            r = await c.ev(LEDGER_JS, False)
            r['leaks'] = await c.ev('window.__leak.hits', False)
            await SC.stage_shot(c, os.path.join(HERE, f'verify_ledger_death_{ev}.png'))
            out['death_' + ev] = r
            print('ledger death', ev, '| kind', r['kind'], '| head', r['head'], '| rows', [x['text'] for x in r['mini']], '| overlaps', [x['overlaps'] for x in r['mini'] if x['overlaps']], '| clipped', [x['clipped'] for x in r['mini'] if x['clipped']], '| overflow', r['boxOverflow'], '| leaks', len(r['leaks']))
        # (나) 결말 명부: 열차 저장(shot.py 와 같은 길)
        if 'd10_train' in SC.FIXTURES:
            await c.open(f'/v4/index.html?fast=1&auto=train&state=/__fixture/d10_train.json&sc={int(time.time())}')
            await SC.until(c, "__ds4.UI.openKind() === 'ending'", 120)
            await asyncio.sleep(0.6)
            r = await c.ev(LEDGER_JS, False)
            r['leaks'] = await c.ev('window.__leak.hits', False)
            await SC.stage_shot(c, os.path.join(HERE, 'verify_ledger_ending_train.png'))
            out['ending_train'] = r
            print('ledger ending', '| kind', r['kind'], '| head', r['head'], '| rows', [x['text'] for x in r['page']], '| overlaps', [x['overlaps'] for x in r['page'] if x['overlaps']], '| clipped', [x['clipped'] for x in r['page'] if x['clipped']], '| leaks', len(r['leaks']))
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    RES['ledger'] = out


async def t_late2(c, opts):
    out = []
    for seed in [int(x) for x in opts.get('lseeds', '3,5,9').split(',')]:
        await c.open(f'/v4/index.html?fast=1&auto=car&seed={seed}&sc={int(time.time())}')
        await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 120)
        await c.ev(DRIVER, False)
        t0 = time.time()
        dopt = json.dumps({'noExplore': True, 'lateProbe': True, 'stopDay': int(opts.get('lstop', '7'))})
        await c.ev("(window.__lateLog = [], window.__driveRes = null, __drive(" + dopt + ").then((r) => { window.__driveRes = r; }, (e) => { window.__driveRes = { err: String(e && e.stack || e) }; }), 1)", False)
        r = None
        while time.time() - t0 < int(opts.get('limit', '1500')):
            await asyncio.sleep(3)
            r = await c.ev('window.__driveRes', False)
            if r:
                break
        lg = await c.ev('window.__lateLog', False)
        out.append({'seed': seed, 'run': r, 'late': lg, 'errors': c.errors()[:5]})
        print('late2 seed', seed, '| end', (r or {}).get('day'), (r or {}).get('phase'), (r or {}).get('err', ''))
        for x in lg or []:
            print('   D', x['d'], 'eng', x['eng'], 'map', x['mapLate'], 'dust0', x['dust0'], 'noticeDay', x['noticeDay'], 'office', x.get('office'), 'met_seoha', x.get('metSeoha'), 'key', x.get('key'))
            for i in x['ins']:
                print('      inspect', i['oid'], '| toasts', i['toasts'], '| lid', [l.get('lid') for l in i['log'] if 'lid' in l], '| dust after', i['dust'])
    RES['late2'] = out


TRACE_JS = r"""(() => { const b = document.querySelector('#box'); return [__ds4.UI.openKind(), (document.querySelector('#box .opt.sel .ol') || {}).textContent || '', ((b && b.querySelector('.body')) || {}).textContent ? b.querySelector('.body').textContent.slice(0, 30) : '', __ds4.state.people.you.status]; })()"""


async def t_space2(c, opts):
    """두드림 재현: 같은 사건을 여러 번 · 느린 두드림 · 창 상태를 50ms 마다 기록."""
    out = []
    plans = {'tap_up160+space80': {'tap': 'ArrowUp', 'mash': ' ', 'tapdt': 0.16, 'mashdt': 0.08},
             'tap_up400+space150': {'tap': 'ArrowUp', 'mash': ' ', 'tapdt': 0.40, 'mashdt': 0.15}}
    for ev in [e for e in opts.get('evs2', 'pro_stairs,d3_called_you').split(',') if e in SC.FIXTURES]:
        for pname, pl in plans.items():
            for rep in range(int(opts.get('reps', '3'))):
                r = {'ev': ev, 'plan': pname, 'rep': rep, 'trace': []}
                try:
                    await c.open(f'/v4/index.html?fast=1&auto=evline&state=/__fixture/{ev}.json&sc={int(time.time())}')
                    await c.wait("__ds4.state && __ds4.UI.openKind() === 'line' && !__ds4.UI.bot", 300)
                    await asyncio.sleep(0.3)
                    before = await c.ev(CHOICES_JS + f"('{ev}')", False)
                    t0 = time.time(); nt = nm = 0; last = None
                    while time.time() - t0 < float(opts.get('secs', '6')):
                        now = time.time() - t0
                        if now >= nt:
                            await c.key(pl['tap'], 'keyDown'); await asyncio.sleep(0.03); await c.key(pl['tap'], 'keyUp'); nt = now + pl['tapdt']
                            r['trace'].append([round(now, 2), 'TAP'])
                        if now >= nm:
                            await c.key(pl['mash'], 'keyDown'); await c.key(pl['mash'], 'keyUp'); nm = now + pl['mashdt']
                        st = await c.ev(TRACE_JS, False)
                        if st != last:
                            r['trace'].append([round(now, 2)] + st); last = st
                        if st[3] != 'home':
                            break
                        await asyncio.sleep(0.01)
                    await asyncio.sleep(0.6)
                    after = await c.ev(CHOICES_JS + f"('{ev}')", False)
                    r['after'] = after
                    r['picked'] = after['lastChoice'] if (after['fired'] > before['fired'] and after['lastEv'] == ev) else ''
                    r['died'] = after['you'] != 'home'
                except BaseException as e:
                    r['error'] = repr(e)[:300]
                out.append(r)
                print('space2', ev, pname, rep, '| picked', r.get('picked') or '-', '| died', r.get('died'), '|', r.get('error', ''))
                print('      ', [x for x in r['trace'] if x[1] != 'TAP'][:14])
    RES['space2'] = out


async def t_shutter(c, opts):
    """D1 낮에 셔터를 건너뛴 판: D2 새벽 순례가 셔터를 연다(met_eunji) → D2 낮 셔터 조사 = trade_shutter. 증언(D2 저녁) 전에 진짜 이름이 보이는가."""
    ident = (await c.send('Page.addScriptToEvaluateOnNewDocument', {'source': OBS}))['identifier']
    out = []
    try:
        for seed in [int(x) for x in opts.get('sseeds', '7').split(',')]:
            await c.open(f'/v4/index.html?fast=1&auto=car&seed={seed}&sc={int(time.time())}')
            await c.wait("__ds4.state && __ds4.scene.map && __ds4.scene.map.id === 'car' && !__ds4.UI.bot && !__ds4.UI.isOpen()", 300)
            await c.ev(DRIVER, False)
            await c.ev("window.__evlog = []; (() => { const L = window.UI.lines; window.UI.lines = function (t, o) { window.__evlog.push({ d: __ds4.state.day, ph: __ds4.state.phase, p: __ds4.state.pending ? __ds4.state.pending.id : '', tag: (o && o.tag) || '', name: (o && o.name) || '', text: String(t).slice(0, 160) }); return L.apply(this, arguments); }; })(); 1", False)
            t0 = time.time()
            dopt = json.dumps({'noExplore': True, 'skipShutter': True, 'shutterDay': 2, 'stopDay': 3})
            await c.ev("(window.__driveRes = null, __drive(" + dopt + ").then((r) => { window.__driveRes = r; }, (e) => { window.__driveRes = { err: String(e && e.stack || e) }; }), 1)", False)
            r = None
            while time.time() - t0 < int(opts.get('limit', '1500')):
                await asyncio.sleep(3)
                r = await c.ev('window.__driveRes', False)
                if r:
                    break
            hits = await c.ev('window.__leak.hits', False)
            evlog = await c.ev("window.__evlog.filter((x) => x.d >= 2 && x.d <= 2)", False)
            box = await c.ev("({ hud: document.getElementById('hud') ? document.getElementById('hud').textContent : '' })", False)
            uniq = {}
            for h in hits:
                uniq.setdefault((h['src'].split(':')[0], h['n'], h['text'][:50]), h)
            rec = {'seed': seed, 'run': r, 'hits': list(uniq.values()), 'evlog_d2': evlog[:80]}
            out.append(rec)
            print('shutter seed', seed, '| run', json.dumps(r, ensure_ascii=False)[:300], '| leak', len(hits), 'unique', len(uniq))
            for h in list(uniq.values())[:20]:
                print('   ', h['src'], h['n'], 'met' if h['met'] else 'UNMET', f"D{h['day']} {h['phase']}", h['pending'], h['kind'], h['tag'], '|', h['text'][:120])
            for x in evlog[:40]:
                print('     ev', x)
    finally:
        await c.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': ident})
    RES['shutter'] = out


async def t_office(c, opts):
    """역무실 문이 열린(open) 뒤에도 당신이 역무실 안(창고 상자·부품 상자)까지 걸어갈 수 있나."""
    await SC.goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    await SC.normal_speed(c)
    r = {}
    r['office_before'] = await c.ev("__ds4.state.traces.office_door.st", False)
    r['door_obj'] = await c.ev("(() => { const o = __ds4.objectsOnMap().find((q) => q.id === 'office_door'); return o ? { x: o.x, y: o.y, solid: o.solid, state: o.state } : null; })()", False)
    for tgt in ('crate_food', 'parts_crate'):
        await SC.place(c, 17, 2, 'left')
        await asyncio.sleep(0.2)
        ok = await c.ev(f"(() => {{ const o = __ds4.objectsOnMap().find((q) => q.id === '{tgt}'); const r = __ds4.walkTo(o.x, o.y); return {{ r, auto: !!__ds4.scene.auto, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }}; }})()", False)
        r['walk_' + tgt] = ok
        await asyncio.sleep(1.5)
        r['pos_after_' + tgt] = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
    # 문 칸으로 바로 걸어 들어가기 (16,2)→(15,2)
    await SC.place(c, 16, 2, 'left')
    await asyncio.sleep(0.2)
    r['walk_door_cell'] = await c.ev("(() => { const r = __ds4.walkTo(15, 2); return { r, auto: !!__ds4.scene.auto }; })()", False)
    await asyncio.sleep(1.0)
    r['pos_after_door'] = await c.ev("[__ds4.scene.px, __ds4.scene.py]", False)
    await SC.ap_zoom(c, 'verify_office_door.png', 4, 0, 19, 5, 3)
    print('office', json.dumps(r, ensure_ascii=False))
    RES['office'] = out_ = r


async def t_cause(c, opts):
    """사인 칸: 죽은 사람에 대한 사실 줄(표의 ledgerFact 그대로 — '순례 물통 빔.')이 있으면 사인 칸 고르기에 그 줄이 나오는가."""
    await SC.goto_point(c, 'morning3', "__ds4.state.day === 3 && __ds4.state.phase === 'trace'")
    r = {}
    r['setup'] = await c.ev("""(() => { const s = __ds4.state; const p = s.people.soonrye; p.status = 'dead'; p.day = 2;
      s.ledger.written.push({ day: 3, who: 'soonrye', object: 'bottle_soonrye', text: 'D2 밤. 순례 물통 빔.' }); s.ledger.written.push({ day: 3, who: 'you', text: '순례가 밤마다 계단 줄을 긋는다.' });
      return { name: p.name, facts: s.ledger.written.map((w) => w.text) }; })()""", False)
    await c.ev("""(() => { window.__opts = {}; __ds4.setBot((k, info) => { window.__opts[k] = info.options.map((o) => o.label); if (k === 'book') return 0; if (k === 'bookpage') { const i = info.options.findIndex((o) => String(o.value || '').startsWith('cause:')); return i >= 0 && !window.__did ? (window.__did = 1, i) : info.options.length - 1; } if (k === 'cause') return info.options.length - 1; return undefined; }); return 1; })()""", False)
    await c.ev("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); 1", False)
    await asyncio.sleep(2.0)
    r['opts'] = await c.ev('window.__opts', False)
    print('cause', json.dumps(r, ensure_ascii=False))
    RES['cause'] = r


async def main(tasks, opts):
    for f in ('fx_spec.json', 'fx_space.json', 'fixture_d10_train.json', 'nat_fix.json'):
        load_fx(f)
    httpd = SC.serve()
    proc, prof, ws_url = await connect()
    try:
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = SC.CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            for t in tasks:
                fn = globals().get('t_' + t)
                try:
                    await fn(c, opts)
                except BaseException as e:
                    RES.setdefault('errors', {})[t] = repr(e)[:400]
                    print('TASK FAIL', t, repr(e)[:400])
                with open(os.path.join(HERE, f'probe_{"_".join(tasks)}.json'), 'w', encoding='utf-8') as fp:
                    json.dump(RES, fp, ensure_ascii=False, indent=1)
    finally:
        proc.terminate()
        httpd.shutdown()
        time.sleep(1.5)
        shutil.rmtree(prof, ignore_errors=True)


import probe_fix_tasks
probe_fix_tasks.install(sys.modules[__name__])

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if opts.get('port'):
        SC.PORT = int(opts['port'])
    if opts.get('dbg'):
        SC.DBG = int(opts['dbg'])
    asyncio.run(main(args, opts))

