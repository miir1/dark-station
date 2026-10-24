// 보조 집계: node more.js <json...>
const fs=require('fs');
for(const f of process.argv.slice(2)){const o=JSON.parse(fs.readFileSync(f,'utf8'));
 for(const [pol,runs] of Object.entries(o.pols)){
  const n=runs.length; const pc=(x)=>(100*x/n).toFixed(1);
  const allDead=runs.filter(r=>r.why==='all_dead').length;
  const d6=Object.entries(runs.reduce((a,r)=>{for(const [k,v] of Object.entries(r.picks)) if(/^d6_shutter(_b)?\|(동하와 덤빈다|맞선다)/.test(k)) a[k]=(a[k]||0)+v; return a;},{}));
  const d6d=runs.filter(r=>r.diedAt&&/^d6_shutter/.test(r.diedAt)).length;
  const nr=(id)=>(runs.reduce((a,r)=>a+(r.night[id]||0),0)/n).toFixed(2);
  const blocks=o.seeds.map(b=>{const rr=runs.filter(r=>r.block===b);return (100*rr.filter(r=>r.survived).length/rr.length).toFixed(1);}).join('/');
  const ds=runs.filter(r=>r.dead&&r.cause==='dawn_strike').length, dm=runs.filter(r=>r.dead&&r.cause==='dawn_mob').length;
  console.log(`${f.padEnd(16)} ${pol.padEnd(11)} 생존(블록) ${blocks} | 전멸 ${pc(allDead)}% | D6 덤빔 ${JSON.stringify(Object.fromEntries(d6))} 죽음 ${d6d} | grudge_boils ${nr('grudge_boils')} steal_food_again ${nr('steal_food_again')} steal_meds_again ${nr('steal_meds_again')} ascend_unseen ${nr('ascend_unseen')} | 새벽습격 사망 ${ds} 둘러섬 사망 ${dm}`);
 }}
