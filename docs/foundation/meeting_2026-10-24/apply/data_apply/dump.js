// 사건을 짧게 보여 준다: node dump.js <id...>
const ev = require('../../../../../v4/data/events.json');
const fx = (e) => (e || []).map((x) => x.verb === 'number' ? `${x.id}${x.n > 0 ? '+' : ''}${x.n}${x.who ? '@' + x.who : ''}` : x.verb === 'flag' ? `flag:${x.id}=${x.set}` : x.verb === 'trace' ? `tr:${x.id}=${x.state}` : x.verb === 'axis' ? `ax:${x.id}${x.n}` : x.verb === 'injure' ? `inj@${x.who}${x.n}` : x.verb === 'kill' ? `KILL@${x.who}` : x.verb === 'permanent' ? `perm@${x.who}:${x.kind || x.loss}` : JSON.stringify(x)).join(', ');
for (const id of process.argv.slice(2)) {
  const e = ev.find((x) => x.id === id); if (!e) { console.log('NO', id); continue; }
  console.log(`== ${e.id} [${e.kind}] when=${e.when} target=${e.target || ''} ${e.targetIf || ''} once=${e.once} expl=${e.explicit} img=${e.image}`);
  console.log('   ' + e.text);
  e.choices.forEach((c, i) => {
    console.log(`  [${i}] ${c.label} | chk=${c.check ? c.check.skill + c.check.base : ''} cost=${JSON.stringify(c.cost || {})} req=${JSON.stringify(c.req || {})} taboo=${c.taboo || ''} warn=${c.warn || ''} hint=${c.hint || ''}`);
    for (const k of ['out', 'ok', 'fail']) if (c[k]) console.log(`      ${k}: ${c[k].text} || ${fx(c[k].effects)}${c[k].target ? ' tgt=' + c[k].target : ''}${c[k].ledger ? ' L=' + JSON.stringify(c[k].ledger) : ''}`);
    if (c.swap) console.log('      swap: ' + JSON.stringify(c.swap));
  });
}
