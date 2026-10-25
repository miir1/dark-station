# 어두운 역 v4 — 최종 점검(QA) 플레이어. 헤드리스 Chrome 을 DevTools 로 붙잡아 키(방향키·Space·숫자·Esc·Tab)로 처음부터 끝까지 한다.
# 게임 파일은 고치지 않는다. 관찰은 __ds4 훅 + 창마다 기록하는 'hold' 봇(UI.setBot — 고르지 않고 붙잡기만).
# 쓰기: python qa_play.py <run 이름> <정책> [--real] [--limit=초] [--port=N] [--dbg=N] [--state=저장.json]
import os, sys, json, time, base64, asyncio, subprocess, threading, functools, http.server, socketserver, shutil, urllib.request, random, re
import websockets

ROOT = r'C:\dev\dark_station'
OUTD = os.path.join(ROOT, 'docs', 'foundation', 'final_2026-10-25', 'qa_play')
HERE = os.path.dirname(os.path.abspath(__file__))
INJECT = open(os.path.join(HERE, 'qa_inject.js'), encoding='utf-8').read()

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict((a[2:].split('=', 1) + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
RUN = args[0] if args else 'r1'
POLICY = args[1] if len(args) > 1 else 'normal'
REAL = 'real' in opts
LIMIT = float(opts.get('limit') or (5400 if REAL else 1500))
PORT = int(opts.get('port') or 18890)
DBG = int(opts.get('dbg') or 19640)
STATE = opts.get('state') or ''
SHOTALL = 'shotall' in opts
RELOAD = float(opts.get('reload') or 0)
RSEED = int(opts.get('rseed') or 0) or random.randrange(1, 10**6)
rnd = random.Random(RSEED)

VK = {'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, ' ': 32, 'Enter': 13, 'Escape': 27, 'Tab': 9, 'h': 72}
CODE = {' ': 'Space', 'Enter': 'Enter', 'Escape': 'Escape', 'Tab': 'Tab', 'h': 'KeyH'}
DIRKEY = {'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight'}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    request_queue_size = 128
    daemon_threads = True
    allow_reuse_address = False

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def serve():
    global PORT
    for p in range(PORT, PORT + 30):
        try:
            httpd = Server(('127.0.0.1', p), functools.partial(Quiet, directory=ROOT))
        except OSError:
            continue
        PORT = p
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        return httpd
    raise SystemExit('no port')


class CDP:
    def __init__(self, ws):
        self.ws, self.n, self.console, self.pending = ws, 0, [], {}
        self.reader = asyncio.ensure_future(self._read())

    async def _read(self):
        async for msg in self.ws:
            m = json.loads(msg)
            if 'id' in m and m['id'] in self.pending:
                self.pending.pop(m['id']).set_result(m)
            elif m.get('method') == 'Runtime.consoleAPICalled':
                p = m['params']
                self.console.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args'])[:600])
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                self.console.append('EXCEPTION: ' + str(d.get('exception', {}).get('description', d.get('text')))[:600])

    async def send(self, method, params=None):
        self.n += 1
        i = self.n
        fut = asyncio.get_event_loop().create_future()
        self.pending[i] = fut
        await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
        m = await asyncio.wait_for(fut, 120)
        if 'error' in m:
            raise RuntimeError(m['error'])
        return m.get('result', {})

    async def ev(self, expr, aw=True):
        r = await self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': aw, 'returnByValue': True})
        if r.get('exceptionDetails'):
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:800])
        return r.get('result', {}).get('value')

    async def key(self, k, typ):
        code = CODE.get(k) or (('Digit' + k) if k.isdigit() else k)
        vk = VK.get(k) or (ord(k) if len(k) == 1 else 0)
        txt = k if (typ == 'keyDown' and len(k) == 1) else ''
        await self.send('Input.dispatchKeyEvent', {'type': typ, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'nativeVirtualKeyCode': vk, 'text': txt, 'unmodifiedText': txt})

    async def press(self, k, hold=0.03):
        await self.key(k, 'keyDown')
        await asyncio.sleep(hold)
        await self.key(k, 'keyUp')

    async def click(self, x, y):
        for t in ('mouseMoved', 'mousePressed', 'mouseReleased'):
            await self.send('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})

    async def shot(self, path):
        r = await self.send('Page.captureScreenshot', {'format': 'png'})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))


WEIRD = [(re.compile(r'\{[a-zA-Z_:/]+\}'), '치환 안 된 {칸}'), (re.compile(r'undefined|NaN|\[object|null\b'), 'undefined/NaN/null'),
         (re.compile(r'이\(가\)|을\(를\)|은\(는\)|과\(와\)|\(으\)로'), '조사 괄호'), (re.compile(r'\b[a-z]+_[a-z0-9_]+\b'), '영문 id'),
         (re.compile(r'원한|카르마|karma|grudge|trust|stress'), '수치 이름'), (re.compile(r'  '), '빈칸 두 개'), (re.compile(r'\.\.(?!\.)'), '마침표 두 개'),
         ]


def weird(text):
    out = []
    for rx, name in WEIRD:
        m = rx.search(text or '')
        if m:
            out.append(name + ': ' + (text[max(0, m.start() - 20):m.end() + 20]))
    return out


class Player:
    def __init__(self, c):
        self.c = c
        self.t0 = time.time()
        self.wins = []          # 창 기록 (__qa.take)
        self.choices = []       # 내가 고른 것
        self.issues = []
        self.days = {}          # day → 집계
        self.keys = 0
        self.steps = 0
        self.fallback = 0
        self.lastOk = 0
        self.visited = set()
        self.started = False
        self.finished = ''
        self.shots = 0
        self.shot_tags = set()
        self.rope = []
        self.trip_log = []
        self.unseen = []
        self.stuck = 0
        self.plan_key = None
        self.plan = []
        self.talked_today = set()
        self.notebook_done = False
        self.esc_done = False
        self.treat_done = set()
        self.last_sig = None
        self.same = 0
        self.evseen = {}
        self.deaths = []
        self.ending = None
        self.cur_day = -1
        self.events_shown = []
        self.missing_seen = set()
        self.nocg_events = []

    def day(self, d):
        if d not in self.days:
            self.days[d] = {'lines': 0, 'chars': 0, 'choices': 0, 'steps': 0, 'keys': 0, 'events': 0, 'wall_s': 0.0, 't_first': time.time(), 'cards': 0, 'trips': 0, 'opened': 0}
        return self.days[d]

    def note(self, kind, msg, **kw):
        e = dict(kind=kind, msg=msg, t=round(time.time() - self.t0, 1), **kw)
        self.issues.append(e)
        print('  !', kind, msg[:200])

    async def snap(self):
        return await self.c.ev('__qa.snap()', False)

    async def shot(self, tag, force=False):
        if (tag in self.shot_tags and not force) or self.shots > 60:
            return
        self.shot_tags.add(tag)
        self.shots += 1
        safe = re.sub(r'[^A-Za-z0-9_\-]', '_', tag)[:60]
        await self.c.shot(os.path.join(OUTD, f'qa_play_{RUN}_{self.shots:02d}_{safe}.png'))

    async def press(self, k, hold=0.03):
        self.keys += 1
        s = self.cur_day
        self.day(s)['keys'] += 1
        if k in (' ', 'Enter'):
            gap = time.time() - self.lastOk
            if gap < 0.36:
                await asyncio.sleep(0.36 - gap)
            self.lastOk = time.time()
        await self.c.press(k, hold)

    async def pull(self):
        new = await self.c.ev('__qa.take()', False) or []
        for w in new:
            self.wins.append(w)
            d = self.day(w['day'])
            if w['kind'] == 'line':
                if w['text'] and w['text'] == getattr(self, 'prev_line', None):
                    self.rep_line = getattr(self, 'rep_line', 1) + 1
                    if self.rep_line == 3:
                        self.note('repeat_line', f'같은 줄이 연달아 3번: {w["text"][:100]}', tag=w['tag'], day=w['day'])
                else:
                    self.rep_line = 1
                self.prev_line = w['text']
                d['lines'] += 1
                d['chars'] += len(w['text'])
                for x in weird(w['text']):
                    self.note('weird_text', x, tag=w['tag'], day=w['day'])
                if w['tag'] == 'night_unseen' or w['tag'] == 'night_report':
                    if w['tag'] == 'night_unseen':
                        self.unseen.append({'day': w['day'], 'text': w['text']})
            else:
                d['choices'] += 1
                if w['kind'] == 'event':
                    d['events'] += 1
                for lab in w.get('opts') or []:
                    for x in weird(lab):
                        self.note('weird_text', 'opt ' + x, kind=w['kind'], day=w['day'])
        return new

    # ── 창 처리 ──
    async def handle_line(self, s):
        await self.press(' ')
        await asyncio.sleep(0.02 if not REAL else 0.05)

    def pick_event(self, ev, s):
        ch = ev['choices']
        open_ = [c for c in ch if not c['locked']]
        if not open_:
            return None
        P = POLICY
        def sc(c):
            v = 0.0
            if P in ('normal', 'lazy', 'real'):
                v -= 30 * (1 - c['surv'])
                v -= 2.0 * c['karma']
                v -= 1.5 * c['hurt']
                v += 0.2 * c['food']
                if c['taboo']:
                    v -= 5
                v += rnd.random() * 1.2
            elif P == 'survivor':
                v -= 120 * (1 - c['surv'])
                v -= 1.0 * c['karma']
                v -= 3.0 * c['hurt']
                v += 0.6 * c['food']
                v -= 0.3 * sum(c['cost'].values()) if c['cost'] else 0
                if c['taboo']:
                    v -= 20
                v += rnd.random() * 0.5
            elif P == 'selfish':
                v += 3.0 * c['karma'] - 6 * (1 - c['surv']) + 0.3 * c['food'] + rnd.random()
                if c['taboo']:
                    v += 1
            elif P == 'risky':
                v += (2 if c['chance'] is not None else 0) + 0.5 * c['food'] - 1.0 * c['karma'] + rnd.random() * 2
            else:
                v = rnd.random()
            return v
        best = max(open_, key=sc)
        return best['i']

    async def choose_index(self, s, idx, how='arrows'):
        """창에서 idx 번째 선택지를 키로 고른다: 방향키로 커서를 옮기고 0.35초 멈춘 뒤 Space (위험한 선택지의 머무름 보호), 아니면 번호 키."""
        opts = s['opts']
        if idx is None or idx >= len(opts):
            return False
        await asyncio.sleep(0.45)          # 열린 뒤 0.4초 막힘
        if how == 'digit' and idx < 9:
            await self.press(str(idx + 1))
        else:
            for _ in range(len(opts) + 3):
                cur = await self.snap()
                if not cur['kind']:
                    return True
                sel = next((i for i, o in enumerate(cur['opts']) if o['sel']), -1)
                if sel == idx:
                    break
                if sel < 0:
                    await self.press('ArrowDown')
                    continue
                n = len(cur['opts'])
                down = (idx - sel) % n
                up = (sel - idx) % n
                await self.press('ArrowDown' if down <= up else 'ArrowUp')
                await asyncio.sleep(0.03)
            await asyncio.sleep(0.36)
            await self.press(' ')
        await asyncio.sleep(0.08)
        for k in range(3):
            s2 = await self.snap()
            if s2['kind'] != s['kind'] or s2['text'] != s['text'] or [o['label'] for o in s2['opts']] != [o['label'] for o in opts]:
                return True
            await asyncio.sleep(0.4)
            await self.press(' ')
        # 키가 먹지 않았다 → 숫자 키로
        self.note('key_ignored', f"{s['kind']} 창에서 Space 가 3번 먹지 않았다 → 번호 키", opt=opts[idx]['label'])
        await self.press(str(idx + 1))
        return True

    async def handle_choice(self, s):
        kind = s['kind']
        st = s['st'] or {}
        opts = s['opts']
        labels = [o['label'] for o in opts]
        rec = {'kind': kind, 'day': st.get('day'), 'phase': st.get('phase'), 'text': s['text'][:300], 'opts': labels, 'boxCls': s['boxCls'], 'pend': st.get('pending')}
        idx = None
        how = 'arrows' if rnd.random() < 0.75 else 'digit'
        first_open = next((i for i, o in enumerate(opts) if not o['disabled']), 0)
        if kind == 'title':
            if self.started:
                self.finished = self.finished or 'title'
                return 'done'
            want = '계속' if (STATE or getattr(self, 'resumed', False)) else '새로 시작'
            if getattr(self, 'resumed', False):
                self.resume_title = labels
            idx = next((i for i, l in enumerate(labels) if l.startswith(want)), first_open)
            self.started = True
        elif kind == 'confirm':
            idx = 0
        elif kind == 'event':
            ev = await self.c.ev('__qa.evalChoices()', False)
            rec['ev'] = ev
            self.events_shown.append(ev['id'] if ev else '?')
            evid = ev['id'] if ev else '?'
            self.evseen[evid] = self.evseen.get(evid, 0) + 1
            # 장면 그림
            cgs = [i for i in s['cg'] if i['vis']]
            rec['cg'] = cgs
            if not cgs:
                self.nocg_events.append({'id': evid, 'day': st.get('day'), 'phase': st.get('phase')})
            elif not all(i['ok'] for i in cgs):
                self.note('broken_img', f'{evid} 그림이 깨졌다 ' + json.dumps(cgs, ensure_ascii=False))
            # 줄타기 창
            chance = [(o['label'], [x for x in o['subs'] if 'chance' in x[0]], [x for x in o['subs'] if 'warn' in x[0]]) for o in opts]
            if ' rope' in ' ' + s['boxCls'] or any(c[1] for c in chance):
                r = {'id': evid, 'day': st.get('day'), 'karma': st.get('karma'), 'boxCls': s['boxCls'], 'blind': s['blind'],
                     'opts': [{'label': o['label'], 'subs': o['subs'], 'disabled': o['disabled']} for o in opts],
                     'surv': [c['surv'] for c in ev['choices']] if ev else None}
                self.rope.append(r)
                hb = re.search(r'hb(\d)', s['boxCls'])
                if hb:
                    await self.shot(f'rope_{evid}_hb{hb.group(1)}')
                # 일관성: 테두리 박동은 열린 선택지 전부가 죽을 수 있을 때만
                if ev:
                    opn = [c for c in ev['choices'] if not c['locked']]
                    nosafe = bool(opn) and all(c['surv'] < 1 for c in opn)
                    if nosafe != bool(hb):
                        self.note('rope_beat', f'{evid}: 위험 0 출구 없음={nosafe} 인데 박동={bool(hb)}', boxCls=s['boxCls'])
                    for c, o in zip(ev['choices'], opts):
                        if c['surv'] < 1 and not c['locked'] and not any('chance' in x[0] or 'warn' in x[0] for x in o['subs']):
                            self.note('rope_nowarn', f'{evid}: 죽을 수 있는 선택지에 %·경고가 없다: {o["label"]}')
            if evid and st.get('day', 0) >= 1 and self.evseen[evid] > 3 and not evid.startswith('trip'):
                self.note('repeat_event', f'{evid} 가 {self.evseen[evid]} 번째 떴다')
            # 열차: 태울 사람 먼저
            bi = next((i for i, l in enumerate(labels) if l.startswith('태울 사람')), None)
            if bi is not None and not getattr(self, 'boarded', False):
                self.boarded = True
                idx = bi
            else:
                idx = self.pick_event(ev, s) if ev else first_open
                if ev and POLICY in ('normal', 'real', 'survivor') and ev['kind'] == 'ending':
                    # 결말: 열차가 열려 있으면 탄다, 아니면 걷는다 (명부를 보려고)
                    pref = [c['i'] for c in ev['choices'] if not c['locked'] and re.search(r'탄다', c['label'])]
                    if pref:
                        idx = pref[0]
            rec['picked'] = labels[idx] if idx is not None and idx < len(labels) else None
            if SHOTALL:
                await self.shot(f'ev_D{st.get("day")}_{st.get("phase")}_{evid}', force=True)
            elif st.get('day', 0) >= 1 and rnd.random() < 0.12:
                await self.shot('event_' + evid)
        elif kind == 'confirm2':
            idx = 0
        elif kind == 'board':
            on = [i for i, l in enumerate(labels) if l.endswith('태운다')]
            idx = on[0] if on else len(labels) - 1
        elif kind == 'fire':
            ph = st.get('phase')
            look = next((i for i, l in enumerate(labels) if l == '화로를 살핀다'), None)
            write = next((i for i, l in enumerate(labels) if l == '수첩에 적는다'), None)
            if write is not None and POLICY != 'lazy':
                idx = write
            elif look is not None and POLICY not in ('lazy',) and ph == 'trace' and rnd.random() < 0.8:
                idx = look
            else:
                idx = 0
            if s['text'] and '더 이야기할 사람' in s['text']:
                pass
        elif kind == 'ration':
            go = len(labels) - 1
            idx = go
            if POLICY == 'selfish' and not getattr(self, 'ration_cut_' + str(st.get('day')), False):
                setattr(self, 'ration_cut_' + str(st.get('day')), True)
                cut = [i for i, l in enumerate(labels[1:-1], 1) if l.endswith('그릇을 뺀다')]
                if cut and (st.get('food') or 0) <= 6:
                    idx = rnd.choice(cut)
            if POLICY in ('normal', 'real') and (st.get('food') or 0) <= 2 and (st.get('hunger') or 0) < 4 and not getattr(self, 'ration_me_' + str(st.get('day')), False):
                setattr(self, 'ration_me_' + str(st.get('day')), True)
                if labels[0].endswith('그릇을 뺀다'):
                    idx = 0
        elif kind == 'write':
            idx = 1 if POLICY == 'lazy' else 0
        elif kind == 'trip':
            idx = 0
        elif kind == 'deeper':
            idx = 0 if (st.get('day', 0) >= 3 and (st.get('inj') or 0) < 2 and POLICY != 'lazy') else 1
            self.want_up = idx == 1
        elif kind == 'tripup':
            idx = 0
        elif kind == 'treat':
            me = next((i for i, o in enumerate(opts) if not o['disabled'] and o['label'] != '돌아간다'), None)
            idx = me if me is not None else len(labels) - 1
        elif kind == 'tend':
            t = next((i for i, l in enumerate(labels) if l == '상처를 감아 준다' and not opts[i]['disabled']), None)
            idx = t if t is not None and POLICY != 'selfish' else 0
        elif kind in ('death_ledger', 'ending'):
            await self.shot(kind + '_' + (st.get('ended') or ''), force=True)
            rec['ledger'] = s['text'][:800]
            rec['cgPage'] = s['cgPage']
            if kind == 'death_ledger':
                self.deaths.append({'day': st.get('day'), 'phase': st.get('phase'), 'why': st.get('ended'), 'text': s['text'][:400], 'cg': s['cg']})
            else:
                self.ending = {'day': st.get('day'), 'why': st.get('ended'), 'page': s['cgPage'], 'text': s['text'][:300]}
            idx = 0
        elif kind == 'book':
            idx = 0 if not self.notebook_done else len(labels) - 1
        elif kind == 'bookpage':
            self.notebook_done = True
            rec['page'] = s['text'][:600]
            idx = len(labels) - 1
        elif kind == 'pause':
            self.esc_done = True
            rec['menu'] = labels
            idx = 0
        else:
            idx = first_open
        rec['picked'] = rec.get('picked') or (labels[idx] if idx is not None and idx < len(labels) else None)
        self.choices.append(rec)
        await self.choose_index(s, idx, how)
        return 'ok'

    # ── 지도 위에서 ──
    async def walk_to(self, tx, ty, onto=False, interact=True, budget=30):
        DXY = {'up': (0, -1), 'down': (0, 1), 'left': (-1, 0), 'right': (1, 0)}
        for n in range(budget):
            p = await self.c.ev(f'(() => {{ const f = document.getElementById("fade"); const sc = __ds4.scene; return {{ open: __ds4.UI.isOpen() || !f.hidden, px: sc.px, py: sc.py, face: sc.face, p: __qa.path({tx},{ty},{str(onto).lower()}) }}; }})()', False)
            if p['open']:
                return 'window'
            if p['p'] is None:
                break
            path = p['p']
            if not path['dirs']:
                if path['face'] and p['face'] != path['face']:
                    await self.press(DIRKEY[path['face']])
                    await asyncio.sleep(0.06 if not REAL else 0.1)
                if interact:
                    await self.press(' ')
                return 'ok'
            x, y = p['px'], p['py']
            for d in path['dirs']:
                ex, ey = x + DXY[d][0], y + DXY[d][1]
                await self.c.key(DIRKEY[d], 'keyDown')
                self.keys += 1
                q = None
                for _ in range(60):
                    q = await self.c.ev('[__ds4.scene.px,__ds4.scene.py,__ds4.UI.isOpen()?1:0,__ds4.scene.moving?1:0]', False)
                    if q[0] != x or q[1] != y or q[2]:
                        break
                    await asyncio.sleep(0.006)
                await self.c.key(DIRKEY[d], 'keyUp')
                if q[0] != x or q[1] != y:
                    self.steps += 1
                    self.day(self.cur_day)['steps'] += 1
                if REAL:
                    for _ in range(80):
                        q = await self.c.ev('[__ds4.scene.px,__ds4.scene.py,__ds4.UI.isOpen()?1:0,__ds4.scene.moving?1:0]', False)
                        if not q[3]:
                            break
                        await asyncio.sleep(0.015)
                else:
                    q = await self.c.ev('[__ds4.scene.px,__ds4.scene.py,__ds4.UI.isOpen()?1:0,__ds4.scene.moving?1:0]', False)
                if q[2]:
                    return 'window'
                if (q[0], q[1]) != (ex, ey):
                    if (q[0], q[1]) == (x, y):
                        self.nomove = getattr(self, 'nomove', 0) + 1
                        if self.nomove % 25 == 1:
                            print('   nomove', d, (x, y), '->', (tx, ty), s_map if (s_map := None) else '')
                        await asyncio.sleep(0.1)
                    break
                x, y = ex, ey
        # 키로 못 갔다 → 마우스로 그 칸을 누른다 (클릭하면 간다)
        self.fallback += 1
        self.fallback_to = getattr(self, 'fallback_to', [])
        self.fallback_to.append([self.cur_day, (await self.snap())['map'], tx, ty])
        xy = await self.c.ev(f'__qa.cellXY({tx},{ty})', False)
        if xy:
            await self.c.click(xy[0], xy[1])
            await asyncio.sleep(0.05)
            t1 = await self.snap()
            self.fallback_to[-1].append(t1['toast'])
            await asyncio.sleep(0.6 if REAL else 0.2)
            for _ in range(100):
                s = await self.snap()
                if s['kind'] or not (s['auto'] or s['moving']):
                    break
                await asyncio.sleep(0.05)
            return 'click'
        return 'fail'

    def mkplan(self, s):
        st = s['st']
        day, ph, mp = st['day'], st['phase'], s['map']
        return (day, ph, mp, s['trip']['floor'] if s['trip'] else 0)

    async def roam(self, s):
        st = s['st']
        key = self.mkplan(s)
        if key != self.plan_key:
            self.plan_key = key
            self.plan = await self.make_plan(s)
            self.talked_today = set() if key[1] in ('trace',) else self.talked_today
        if not self.plan:
            mp = s['map']
            if mp == 'car':
                self.plan = [('obj', 'lever'), ('cell', 21, 3)]
            elif mp == 'tunnel':
                th0 = await self.c.ev('__qa.things()', False)
                self.plan = [('npc', p['id']) for p in th0['people'] if p['talkable']] + [('cell', 29, 2)]
            elif s['trip']:
                th0 = await self.c.ev('__qa.things()', False)
                e = th0['exits'].get('E') or [1, 1]
                self.plan = [('cell', e[0], e[1], True)]
            else:
                self.plan = [('fire',)]
            self.regen = getattr(self, 'regen', 0) + 1
        step = self.plan.pop(0)
        th = await self.c.ev('__qa.things()', False)
        if step[0] == 'obj':
            o = next((o for o in th['objs'] if o['id'] == step[1]), None)
            if o:
                r = await self.walk_to(o['x'], o['y'])
                self.visited.add((st['day'], step[1]))
        elif step[0] == 'npc':
            p = next((p for p in th['people'] if p['id'] == step[1] and p['talkable']), None)
            if p:
                await self.walk_to(p['x'], p['y'])
                self.talked_today.add(step[1])
        elif step[0] == 'cell':
            await self.walk_to(step[1], step[2], onto=True, interact=step[3] if len(step) > 3 else False)
        elif step[0] == 'fire':
            f = next((o for o in th['objs'] if o['id'] == 'fire'), None)
            if f:
                await self.walk_to(f['x'], f['y'])
            else:
                self.note('no_fire', f'{s["map"]} 에서 화로를 못 찾았다')
        elif step[0] == 'key':
            await self.press(step[1])
            await asyncio.sleep(0.2)
        elif step[0] == 'wait':
            await asyncio.sleep(step[1])

    async def make_plan(self, s):
        st = s['st']
        day, ph, mp = st['day'], st['phase'], s['map']
        th = await self.c.ev('__qa.things()', False)
        objs = {o['id']: o for o in th['objs']}
        ppl = [p for p in th['people'] if p['talkable']]
        lazy = POLICY == 'lazy'
        plan = []
        if mp == 'car':
            for oid in ['medkit', 'bag', 'notebook_dash', 'radio_cab', 'cab_door', 'shoe_cab', 'lever']:
                if oid in objs:
                    plan.append(('obj', oid))
            plan.append(('cell', 21, 3))
            return plan
        if mp == 'tunnel':
            plan += [('cell', 12, 2, False), ('wait', 0.8 if not REAL else 3)]
            for p in ppl:
                plan.append(('npc', p['id']))
            for oid in ['shelter_box', 'vent_shaft', 'rubble']:
                if oid in objs:
                    plan.append(('obj', oid))
            plan.append(('cell', 29, 2))
            return plan
        if s['trip']:
            # 원정 층: 도착 사건 뒤 → 가구 → 계단
            plan.append(('wait', 0.3))
            furn = [o for o in th['objs'] if o['closed'] or re.match(r'^(locker|shelf|drawer|barrel|toolbox|crate|bag|bodybag|cistern|phonebooth|worker_pipe|bone_pile|pharmacy|stall|valve|pump|ladder)', o['id'])]
            for o in furn:
                plan.append(('obj', o['id']))
            ex = th['exits']
            down = ex.get('v')
            go_down = down and st['day'] >= 3 and (st.get('inj') or 0) < 2 and not lazy
            if go_down:
                plan.append(('cell', down[0], down[1], True))
            plan.append(('cell', ex['E'][0], ex['E'][1], True))
            plan.append(('cell', ex['E'][0], ex['E'][1], True))
            return plan
        if mp != 'station':
            return [('wait', 0.5)]
        # 승강장
        if day == 0:
            if ph == 'day':
                for oid in ['speaker', 'board', 'notebook_you', 'blanket_mari', 'crate_food', 'chalk_wall', 'grave', 'office_door', 'stairs_ash']:
                    if oid in objs:
                        plan.append(('obj', oid))
                for p in ppl:
                    plan.append(('npc', p['id']))
                plan.append(('fire',))
            elif ph == 'evening':
                for p in ppl[:1]:
                    plan.append(('npc', p['id']))
                plan.append(('fire',))
            else:
                plan.append(('fire',))
            return plan
        if ph == 'trace':
            if not lazy:
                cand = [o for o in th['objs'] if re.match(r'^(bottle|bowl|bandage|blanket|pillow)_', o['id']) or o['id'] in ('crate_food', 'parts_crate', 'radio', 'speaker', 'chalk_wall', 'shoes_stairs', 'body_rail', 'grave', 'scissors', 'pipe', 'stairs_line', 'stairs_ash')]
                late = [o for o in cand if o.get('late')]
                rnd.shuffle(cand)
                pick = late + [o for o in cand if o not in late][:7]
                for o in pick:
                    plan.append(('obj', o['id']))
                for p in ppl[:2]:
                    plan.append(('npc', p['id']))
            if not self.notebook_done and day >= 2:
                plan.append(('key', 'Tab'))
            plan.append(('fire',))
        elif ph == 'day':
            inj = st.get('inj') or 0
            if inj >= 2 and (day, 'treat') not in self.treat_done:
                self.treat_done.add((day, 'treat'))
                plan.append(('key', 'h'))
            if day == 1 and 'shutter_gap' in objs:
                plan.append(('obj', 'shutter_gap'))
            if not self.esc_done and day >= 3:
                plan.append(('key', 'Escape'))
            low = (st.get('food') or 0) <= 6 or (st.get('water') or 0) <= 6
            go_trip = not st.get('trip') and inj == 0 and day >= 1 and (low or rnd.random() < 0.6 or day in (4, 5))
            if POLICY == 'lazy':
                go_trip = go_trip and rnd.random() < 0.5
            if go_trip:
                region = 'A' if (day % 2 == 0) else 'B'
                ex = {'A': (0, 6), 'B': (27, 13)}[region]
                plan.append(('cell', ex[0], ex[1], True))
                return plan
            if not lazy:
                for p in ppl[:1]:
                    plan.append(('npc', p['id']))
            plan.append(('fire',))
        elif ph == 'evening':
            if ppl and not lazy:
                plan.append(('npc', rnd.choice(ppl)['id']))
            plan.append(('fire',))
        else:
            plan.append(('fire',))
        return plan

    def sig(self, s):
        st = s['st'] or {}
        return json.dumps([s['kind'], s['text'][:80], [o['label'] for o in s['opts']], st.get('day'), st.get('phase'), s['map'], s['px'], s['py'], s['fade'], st.get('pending'), s['trip']], ensure_ascii=False)

    async def reload(self):
        url = await self.c.ev('location.href', False)
        st0 = await self.snap()
        self.before_reload = {k: st0[k] for k in ('st', 'map', 'px', 'py', 'kind', 'text')}
        await self.c.send('Page.navigate', {'url': url})
        for _ in range(300):
            await asyncio.sleep(0.2)
            try:
                if await self.c.ev('!!(window.__ds4 && window.__ds4.db && window.UI && UI.isOpen())', False):
                    break
            except Exception:
                pass
        await self.c.ev(INJECT, False)
        self.started = False
        self.resumed = True
        await self.shot('reload_title', force=True)

    async def run(self):
        while True:
            if RELOAD and not getattr(self, 'resumed', False) and time.time() - self.t0 > RELOAD:
                idle0 = await self.c.ev('__qa.idle()', True)
                if idle0:
                    await self.reload()
                    continue
            if time.time() - self.t0 > LIMIT:
                self.note('time_limit', f'{LIMIT}초 안에 끝나지 않았다')
                self.finished = self.finished or 'time_limit'
                return
            await self.pull()
            s = await self.snap()
            st = s['st']
            if st:
                if st['day'] != self.cur_day:
                    if self.cur_day in self.days:
                        self.days[self.cur_day]['wall_s'] = round(time.time() - self.days[self.cur_day]['t_first'], 1)
                    self.cur_day = st['day']
                    self.day(self.cur_day)
                    print(f'[{RUN}] D{st["day"]} t={time.time() - self.t0:.0f}s food={st["food"]} water={st["water"]} inj={st["inj"]} karma={st["karma"]} alive={st["alive"]} hud="{s["hud"][:80]}"')
                for m in s['missing']:
                    if m not in self.missing_seen:
                        self.missing_seen.add(m)
                        self.note('missing_art', m)
            g = self.sig(s)
            now = time.time()
            if g != self.last_sig:
                self.last_sig = g
                self.sig_t = now
                self.stuck_noted = 0
            idle_for = now - getattr(self, 'sig_t', now)
            lim = 45 if REAL else 25
            if idle_for > lim and self.stuck_noted == 0:
                self.stuck_noted = 1
                self.note('stuck', f'같은 화면 {idle_for:.0f}초: kind={s["kind"]} text={s["text"][:80]} map={s["map"]} ({s["px"]},{s["py"]}) goal={s["goal"]} plan={self.plan[:3]}', snap={k: s[k] for k in ('kind', 'text', 'opts', 'map', 'px', 'py', 'goal', 'hint', 'st', 'trip', 'tg')})
                await self.shot('stuck', force=True)
                await self.press('Escape')
            if idle_for > lim * 3:
                self.finished = 'stuck'
                return
            if s['fade']:
                if st:
                    self.day(st['day'])['cards'] += 0
                await asyncio.sleep(0.1)
                continue
            kind = s['kind']
            if kind == 'line':
                await self.handle_line(s)
                continue
            if kind:
                r = await self.handle_choice(s)
                if r == 'done':
                    return
                continue
            if not st:
                await asyncio.sleep(0.2)
                continue
            if st['ended'] and not s['kind']:
                await asyncio.sleep(0.15)
                continue
            idle = await self.c.ev('__qa.idle()', True)
            if not idle:
                await asyncio.sleep(0.05)
                continue
            await self.roam(s)

    def summary(self):
        if self.cur_day in self.days:
            self.days[self.cur_day]['wall_s'] = round(time.time() - self.days[self.cur_day]['t_first'], 1)
        for d in self.days.values():
            d.pop('t_first', None)
        return {'run': RUN, 'policy': POLICY, 'real': REAL, 'rseed': RSEED, 'finished': self.finished, 'wall_s': round(time.time() - self.t0, 1), 'keys': self.keys, 'steps': self.steps,
                'click_fallback': self.fallback, 'fallback_to': getattr(self, 'fallback_to', []), 'days': self.days, 'deaths': self.deaths, 'ending': self.ending, 'issues': self.issues, 'rope': self.rope, 'unseen': self.unseen,
                'nocg_events': self.nocg_events, 'before_reload': getattr(self, 'before_reload', None), 'resume_title': getattr(self, 'resume_title', None), 'events_shown': self.events_shown, 'missing': sorted(self.missing_seen)}


async def amain():
    os.makedirs(OUTD, exist_ok=True)
    httpd = serve()
    prof = os.path.join(HERE, f'.prof_{RUN}')
    shutil.rmtree(prof, ignore_errors=True)
    os.makedirs(prof, exist_ok=True)
    br = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    if not os.path.exists(br):
        br = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([br, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
                             f'--user-data-dir={prof}', '--window-size=1280,720', f'--remote-debugging-port={DBG}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    res = None
    try:
        ws_url = None
        for _ in range(80):
            try:
                lst = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json/list', timeout=2).read())
                pg = [t for t in lst if t.get('type') == 'page']
                if pg:
                    ws_url = pg[0]['webSocketDebuggerUrl']
                    break
            except Exception:
                pass
            time.sleep(0.5)
        async with websockets.connect(ws_url, max_size=None) as ws:
            c = CDP(ws)
            await c.send('Page.enable')
            await c.send('Runtime.enable')
            await c.send('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 720, 'deviceScaleFactor': 1, 'mobile': False})
            q = ('fast=1&' if not REAL else '') + 'snd=log&qa=1'
            url = f'http://127.0.0.1:{PORT}/v4/index.html?{q}'
            await c.send('Page.navigate', {'url': url})
            for _ in range(300):
                await asyncio.sleep(0.2)
                try:
                    if await c.ev('!!(window.__ds4 && window.__ds4.db && window.UI && UI.isOpen())', False):
                        break
                except Exception:
                    pass
            if STATE:
                raw = open(STATE, encoding='utf-8').read()
                await c.ev(f'localStorage.setItem("ds4.save", {json.dumps(raw)}); "ok"', False)
                await c.send('Page.navigate', {'url': url})
                for _ in range(300):
                    await asyncio.sleep(0.2)
                    try:
                        if await c.ev('!!(window.__ds4 && window.__ds4.db && window.UI && UI.isOpen())', False):
                            break
                    except Exception:
                        pass
            print('inject', await c.ev(INJECT, False))
            # 타이틀은 봇을 붙이기 전에 열렸다 — 지금 열린 창을 기록에 한 줄
            p = Player(c)
            await p.shot('title', force=True)
            try:
                await p.run()
            except Exception as e:
                import traceback
                traceback.print_exc()
                p.note('driver_error', repr(e)[:300])
                try:
                    await p.shot('driver_error', force=True)
                except Exception:
                    pass
            res = p.summary()
            try:
                res['sound'] = await c.ev('__qa.sound()', False)
            except Exception as e:
                res['sound'] = repr(e)
            try:
                res['final_state'] = await c.ev('(() => { const s = __ds4.state; return s ? { day: s.day, phase: s.phase, seed: s.seed, ended: s.ended, you: s.people.you.status, people: Object.fromEntries(Object.values(s.people).map(p => [p.id, p.status + (p.day!=null?"@D"+p.day:"")])), stats: s.stats } : null; })()', False)
            except Exception as e:
                res['final_state'] = repr(e)
            res['console_errors'] = [x for x in c.console if x.startswith('error') or x.startswith('EXCEPTION') or x.startswith('warning')][:50]
            res['windows'] = p.wins
            res['choices'] = p.choices
    finally:
        proc.terminate()
        httpd.shutdown()
        time.sleep(1)
        shutil.rmtree(prof, ignore_errors=True)
    if res:
        with open(os.path.join(OUTD, f'qa_play_{RUN}.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print(f'[{RUN}] finished={res["finished"]} wall={res["wall_s"]}s keys={res["keys"]} steps={res["steps"]} fallback={res["click_fallback"]} issues={len(res["issues"])} deaths={len(res["deaths"])} ending={res["ending"] and res["ending"]["why"]}')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(amain())
