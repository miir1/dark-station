import os, sys, json, time, base64, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import start, OUTD, PORT, save_dataurl
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
cdp, proc, httpd = start()
LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    print(s)
    LOG.append(s)


INSTALL = r"""
(() => {
  window.__u4 = { lines: [], pick: 0 };
  __ds4.setBot((kind, info) => {
    if (kind === 'line') { __u4.lines.push({ k: 'line', text: info.text, face: info.opts && info.opts.faceCls || '', tag: info.opts && info.opts.tag || '' }); return undefined; }
    const labels = (info.options || []).map((o) => o.label);
    __u4.lines.push({ k: kind, options: labels, pick: kind === 'event' ? __u4.pick : 0 });
    if (kind === 'event') return __u4.pick;
    if (kind === 'confirm2') return 0;
    return 0;
  });
  return true;
})()
"""
IDLE = "__ds4.idle().then(() => true)"


def crop_js(x, y, name):
    # crop game canvas around map cell (x,y): 3 cells wide, 3 tall (one above, one below)
    return f"""
(() => {{
  const cv = document.getElementById('cv'); const sc = __ds4.scene; const T = 32;
  const X = sc.cam.ox + ({x} - 1) * T, Y = sc.cam.oy + ({y} - 1) * T;
  const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#000'; g.fillRect(0, 0, 96, 96); g.drawImage(cv, X, Y, 96, 96, 0, 0, 96, 96);
  return c.toDataURL('image/png');
}})()
"""


def save_crop(x, y, name):
    d = cdp.ev(crop_js(x, y, name))
    b = base64.b64decode(d.split(',', 1)[1])
    im = Image.open(io.BytesIO(b))
    im = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
    p = os.path.join(OUTD, name)
    im.save(p)
    return p


def state_of(ids):
    return cdp.ev("(() => { const s = __ds4.state; return { traces: Object.fromEntries(%s.map((id) => [id, s.traces[id] ? s.traces[id].st : '(default ' + __ds4.db.objects[id].states[0] + ')'])), world: { food: s.world.food, water: s.world.water, meds: s.world.meds, parts: s.world.parts }, flags: Object.keys(s.flags || {}).filter((k) => s.flags[k]).slice(0, 60), day: s.day, phase: s.phase, map: __ds4.scene.map.id, pos: [__ds4.scene.px, __ds4.scene.py] }; })()" % json.dumps(ids))


def stand_and_face(x, y, face, teleport=False):
    if teleport:
        cdp.ev(f"(() => {{ const sc = __ds4.scene; sc.px = {x}; sc.py = {y}; sc.moving = null; sc.auto = null; sc.face = '{face}'; return true; }})()")
    else:
        cdp.ev(f"__ds4.goto({x}, {y}).then(() => true)")
        cdp.ev(f"(() => {{ __ds4.scene.face = '{face}'; return true; }})()")
    time.sleep(0.4)
    return cdp.ev("(() => ({ hint: document.getElementById('hint').textContent, pos: [__ds4.scene.px, __ds4.scene.py], face: __ds4.scene.face, target: __ds4.target() }))()")


def interact(pick=0):
    cdp.ev(f"(() => {{ __u4.lines = []; __u4.pick = {pick}; __ds4.interact(); return true; }})()")
    time.sleep(0.3)
    cdp.ev(IDLE)
    time.sleep(0.6)
    return cdp.ev("__u4.lines")


def test_obj(tag, mapx, mapy, stand, face, ids, pick=0, teleport=False):
    log(f'\n=== {tag} ===')
    before = state_of(ids)
    log('before:', json.dumps(before['traces'], ensure_ascii=False), json.dumps(before['world']))
    info = stand_and_face(stand[0], stand[1], face, teleport)
    log('stand:', info['pos'], info['face'], '| hint:', repr(info['hint']), '| target:', json.dumps(info['target'], ensure_ascii=False))
    save_crop(mapx, mapy, f'U4_flow_{tag}_before_x4.png')
    lines = interact(pick)
    for l in lines:
        log('   ', json.dumps(l, ensure_ascii=False))
    after = state_of(ids)
    log('after :', json.dumps(after['traces'], ensure_ascii=False), json.dumps(after['world']))
    save_crop(mapx, mapy, f'U4_flow_{tag}_after_x4.png')
    ol = cdp.ev("__ds4.openLog.slice(-3)")
    log('openLog tail:', json.dumps(ol, ensure_ascii=False))
    return before, after, lines


try:
    cdp.nav(f'http://127.0.0.1:{PORT}/v4/index.html?fast=1&auto=car&seed=7')
    for _ in range(300):
        time.sleep(0.2)
        try:
            if cdp.ev("!!(window.__ds4 && __ds4.scene && __ds4.scene.map && __ds4.scene.map.id==='car' && !__ds4.UI.isOpen() && !__ds4.UI.bot)"):
                break
        except Exception:
            pass
    time.sleep(0.5)
    cdp.ev(INSTALL)
    # whole-screen view of car at start
    cdp.shot(os.path.join(OUTD, 'U4_flow_car_start_screen.png'))
    test_obj('car_medkit', 19, 1, (19, 2), 'up', ['medkit'], 0)
    test_obj('car_bag', 10, 4, (10, 3), 'down', ['bag'], 0)
    test_obj('car_lever', 20, 1, (20, 2), 'up', ['lever'], 0)
    test_obj('car_notebook_dash', 18, 4, (18, 3), 'down', ['notebook_dash'], 0)
    test_obj('car_radio_cab', 20, 4, (20, 3), 'down', ['radio_cab'], 0)
    test_obj('car_shoe_cab', 18, 2, (17, 2), 'right', ['shoe_cab'], 0)
    cdp.shot(os.path.join(OUTD, 'U4_flow_car_after_screen.png'))
    # to tunnel
    cdp.ev("__ds4.goto(21, 3).then(() => __ds4.idle()).then(() => true)")
    time.sleep(1.0)
    cdp.ev(IDLE)
    log('\nmap now:', cdp.ev("__ds4.scene.map.id"), cdp.ev("[__ds4.scene.px, __ds4.scene.py]"))
    test_obj('tunnel_shelter_box_inspect', 14, 0, (14, 1), 'up', ['shelter_box'], 0)
    cdp.shot(os.path.join(OUTD, 'U4_flow_tunnel_shelter_screen.png'))
    # talk to gicheol: choice 1 = '벽감 상자부터 연다'
    log('\n=== tunnel_gicheol_choice1 ===')
    cdp.ev("(() => { __u4.lines = []; __u4.pick = 1; return true; })()")
    cdp.ev("__ds4.use('gicheol').then(() => __ds4.idle()).then(() => true)")
    time.sleep(0.8)
    for l in cdp.ev("__u4.lines"):
        log('   ', json.dumps(l, ensure_ascii=False))
    log('after :', json.dumps(state_of(['shelter_box', 'rubble'])['traces'], ensure_ascii=False), json.dumps(state_of(['shelter_box'])['world']))
    log('openLog tail:', json.dumps(cdp.ev("__ds4.openLog.slice(-3)"), ensure_ascii=False))
    save_crop(14, 0, 'U4_flow_tunnel_shelter_box_after_gicheol_x4.png')
    cdp.ev("(() => { __u4.pick = 0; return true; })()")
    # to station
    cdp.ev("__ds4.goto(29, 2).then(() => __ds4.idle()).then(() => true)")
    time.sleep(1.0)
    cdp.ev(IDLE)
    log('\nmap now:', cdp.ev("__ds4.scene.map.id"), cdp.ev("[__ds4.scene.px, __ds4.scene.py]"))
    # can we walk to the storage crates at D0?
    r = cdp.ev("(() => { const ok = __ds4.walkTo(8, 2); return { ok, auto: !!__ds4.scene.auto }; })()")
    log('walkTo crate_food at D0:', r)
    cdp.ev(IDLE)
    log('pos after walk attempt:', cdp.ev("[__ds4.scene.px, __ds4.scene.py]"), 'office_door:', cdp.ev("__ds4.state.traces.office_door ? __ds4.state.traces.office_door.st : 'locked(default)'"))
    # simulate the room being reachable (office door open, as after d2_seoha) and test the crate's '열기' promise
    cdp.ev("(() => { __ds4.state.traces.office_door = Object.assign({}, __ds4.state.traces.office_door || {}, { st: 'open' }); return true; })()")
    test_obj('station_crate_food_open_attempt', 8, 2, (8, 3), 'up', ['crate_food'], 0, teleport=True)
    test_obj('station_parts_crate', 9, 1, (9, 2), 'up', ['parts_crate'], 0, teleport=True)
    cdp.shot(os.path.join(OUTD, 'U4_flow_station_storage_screen.png'))
    # bedside trace bundle: inspect one bundle cell (bottle+bandage) — all objects in one go
    test_obj('station_bundle_you', 11, 11, (11, 12), 'up', ['bottle_you', 'bandage_you'], 0, teleport=True)
    log('cellLog tail:', json.dumps(cdp.ev("__ds4.cellLog.slice(-4)"), ensure_ascii=False))
    errs = [c for c in cdp.console if c[0] in ('error', 'exception')]
    log('\nconsole errors:', errs[:10])
finally:
    with open(os.path.join(OUTD, 'U4_flow_log.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(LOG))
    try:
        proc.kill()
    except Exception:
        pass
    httpd.shutdown()
