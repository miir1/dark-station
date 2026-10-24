# 검증용: 진짜 '이어 하기'(타이틀 → 계속) — 배식 단계 저장(repay_bowl·share_back 이 걸린 순간)을 localStorage 에 두고 새로 열어 고른다.
#   사건 창 → 하나 고름 → 배식 창이 뜨는가 (화면 담당 주장: '이어 하기 멈춤' 고침). 저장 코드 불러오기 길도 같이.
# 쓰기 (C:\dev\dark_station 에서): python -B docs/foundation/meeting_2026-10-24/apply/verify_REG_screen/resume_probe.py
import os, sys, json, asyncio, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
import screen_check as sc
sc.PORT = 18993
sc.DBG = 19735
sc.OUTD = os.path.join(HERE, 'probe')

BOT = r"""(() => { window.__seen = []; window.__kinds = []; __ds4.setBot((k, info) => { window.__kinds.push(k);
  if (k === 'line') { window.__seen.push(info.text); return undefined; }
  if (k === 'event') return 0;
  if (k === 'ration' || k === 'title') return 'hold';
  return undefined; }); return 1; })()"""


async def tryev(c, js):
    return await c.ev("(() => { try { return { ok: " + js + " }; } catch (e) { return { err: String(e && e.stack || e) }; } })()", False)


async def open_title(c, tag):
    last = None
    for i in range(4):                               # CPU 혼잡 때 로컬 http.server 가 파일을 못 줄 때가 있다(Failed to fetch · ART is not defined) — 다시 연다
        try:
            await c.open(f'/v4/index.html?fast=1&sc={int(time.time())}{tag}{i}')
            await c.wait("window.__ds4 && __ds4.db && __ds4.UI.openKind() === 'title'", 60)
            await asyncio.sleep(1.5)                 # 창이 막 열린 직후의 입력 막기(연타 보호)가 풀리도록
            return i
        except BaseException as e:
            last = e
    raise last


async def task_resume(c, opts):
    res = {}
    for ev in ('repay_bowl', 'share_back'):
        for path in ('continue', 'import'):
            r = {}
            try:
                r['open1_retries'] = await open_title(c, ev + path)
                r['save'] = await c.ev(f"(async () => {{ try {{ const s = await (await fetch('/__fixture/{ev}.json')).json(); __ds4.store().save(s); const code = __ds4.store().exportCode ? __ds4.store().exportCode(s) : null; window.__code = code; return {{ ok: 1, day: s.day, phase: s.phase, pending: s.pending && s.pending.id, code: code ? code.length : 0 }}; }} catch (e) {{ return {{ err: String(e && e.stack || e) }}; }} }})()", True)
                code = await c.ev("window.__code || ''", False)
                r['open2_retries'] = await open_title(c, ev + path + 'r')
                r['title_opts'] = await c.ev("[...document.querySelectorAll('#box .opt')].map((b) => b.textContent)", False)
                r['setbot'] = await tryev(c, BOT)
                if path == 'continue':
                    r['pick'] = await tryev(c, "(__ds4.UI.pick(0), 1)")
                else:
                    r['pick'] = await tryev(c, "(__ds4.UI.pick(2), 1)")
                    await sc.until(c, "__ds4.UI.openKind() === 'import' && document.getElementById('codeIn')", 15)
                    await asyncio.sleep(1.5)
                    r['fill'] = await tryev(c, f"(document.getElementById('codeIn').value = {json.dumps(code)}, 1)")
                    r['pick2'] = await tryev(c, "(__ds4.UI.pick(0), 1)")
                ok = await sc.until(c, "__ds4.UI.openKind() === 'ration'", 60)
                r['reached_ration_window'] = ok
                r['kinds'] = await c.ev('window.__kinds', False)
                r['seen'] = await c.ev('window.__seen', False)
                r['state'] = await c.ev("__ds4.state ? ({ day: __ds4.state.day, phase: __ds4.state.phase, pending: __ds4.state.pending && __ds4.state.pending.id, open: __ds4.UI.openKind(), last: __ds4.state.lastResult && __ds4.state.lastResult.event }) : null", False)
                await sc.stage_shot(c, os.path.join(HERE, f'probe_resume_{ev}_{path}.png'))
            except BaseException as e:
                r['error'] = str(e)[:1500]
            r['console_errors'] = c.errors()
            res[f'{ev}_{path}'] = r
            print(ev, path, 'ration window', r.get('reached_ration_window'), r.get('state'), r.get('error', '')[:200])
    with open(os.path.join(HERE, 'probe_resume.json'), 'w', encoding='utf-8') as fp:
        json.dump(res, fp, ensure_ascii=False, indent=1)


sc.task_resume = task_resume

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    with open(os.path.join(HERE, 'fixtures_resume.json'), encoding='utf-8') as f:
        sc.FIXTURES.update(json.load(f))
    os.makedirs(sc.OUTD, exist_ok=True)
    asyncio.run(sc.amain(['resume'], {}))
