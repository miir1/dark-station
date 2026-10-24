// 터널 비상 상자·창고 상자를 엔진으로 걸어 본다 (읽기만)
const path = require('path');
const R = path.join(__dirname, '..', '..', '..', '..', '..', 'v4');
const T = require(path.join(R, 'engine', 'tables.js'));
const E = require(path.join(R, 'engine', 'engine.js'));
const db = T.loadDir(process.argv[2] || path.join(R, 'data'));
const show = (s, tag) => console.log(tag, 'pending', s.pending && s.pending.id, '| box', s.traces.shelter_box && s.traces.shelter_box.st, '| crate', s.traces.crate_food && s.traces.crate_food.st, '| found', s.found && s.found.object, '| food', s.world.food, 'water', s.world.water, '| met_g', !!s.flags.met_gicheol, '| line', E.inspectLineId(s, db, 'shelter_box'));
const s = E.newGame(db, 1);
show(s, 'start');
if (s.pending) E.dispatch(s, { type: 'choose', i: 0 }, db);
show(s, 'woke');
E.dispatch(s, { type: 'move', map: 'tunnel', x: 1, y: 2 }, db); show(s, 'tunnel');
E.dispatch(s, { type: 'inspect', object: 'shelter_box' }, db); show(s, 'inspect box');
if (s.pending) { const v = E.eventView(s, db); console.log(' event', v.id, v.choices.map((c) => c.label).join(' / ')); }
