# 검증용: timing 일이 'car' 준비에서 멈춘 까닭 보기 — 60Hz rAF 흉내로 열고 30초 동안 상태를 찍는다
import os, sys, json, asyncio, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'v4', 'tools'))
sys.dont_write_bytecode = True
import screen_check as sc
sc.PORT = 18995
sc.DBG = 19737
sc.OUTD = os.path.join(HERE, 'probe')


async def task_tdebug(c, opts):
    out = []
    for hz in (None, 60):
        await c.open('/v4/index.html?fast=1&auto=car&seed=7&sc=' + str(int(time.time())), hz=hz)
        t0 = time.time()
        rows = []
        while time.time() - t0 < 40:
            try:
                v = await c.ev("(() => { try { const D = window.__ds4; if (!D) return 'no __ds4'; return { st: !!D.state, map: D.scene.map && D.scene.map.id, bot: !!D.UI.bot, open: D.UI.openKind(), auto: !!D.scene.auto, moving: !!D.scene.moving, log: (D.autoLog || []).slice(-3) }; } catch (e) { return String(e); } })()", False)
            except Exception as e:
                v = str(e)[:200]
            rows.append([round(time.time() - t0, 1), v])
            await asyncio.sleep(4)
        out.append({'hz': hz, 'rows': rows, 'errors': c.errors(), 'console': c.console[-15:]})
        print(hz, json.dumps(rows[-1], ensure_ascii=False)[:400], c.errors()[:3])
    with open(os.path.join(HERE, 'probe_timing_debug.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


sc.task_tdebug = task_tdebug
if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    os.makedirs(sc.OUTD, exist_ok=True)
    asyncio.run(sc.amain(['tdebug'], {}))
