// verify_A1: 사건 요약 덤프 (읽기 전용)
const ev=require('../../../../../v4/data/events.json');
const arr=Array.isArray(ev)?ev:(ev.rows||Object.values(ev));
const ids=process.argv.slice(2);
const fx=(o)=>o?(o.effects||[]).map(e=>[e.verb,e.id||e.loss||'',e.n!=null?e.n:(e.set!=null?e.set:''),e.who||''].filter(x=>x!=='').join(':')).join(' '):'';
for(const r of arr){ if(ids.length&&!ids.includes(r.id)) continue;
 console.log(`## ${r.id} [${r.kind}] when=${r.when} target=${r.target||''} targetIf=${r.targetIf||''} targetOptional=${r.targetOptional||''} once=${r.once}`);
 console.log('   text: '+r.text);
 (r.choices||[]).forEach((c,i)=>{
  console.log(`  ${i}. ${c.label} | warn=${c.warn} | taboo=${c.taboo} | check=${c.check?c.check.skill+c.check.base:''} | cost=${JSON.stringify(c.cost)} | req=${JSON.stringify(c.req)}`);
  if(c.out) console.log('      out: '+fx(c.out)+' | '+c.out.text);
  if(c.ok) console.log('      ok: '+fx(c.ok)+' | '+c.ok.text);
  if(c.fail) console.log('      fail: '+fx(c.fail)+' | '+c.fail.text);
  (c.swap||[]).forEach(s=>{ console.log(`      swap when=${s.when} warn=${s.warn||''} taboo=${s.taboo!=null?s.taboo:''} check=${s.check?s.check.skill+s.check.base:''} label=${s.label||''}`); if(s.out) console.log('         s.out: '+fx(s.out)+' | '+s.out.text); if(s.ok) console.log('         s.ok: '+fx(s.ok)); if(s.fail) console.log('         s.fail: '+fx(s.fail)+' | '+s.fail.text);});
 });
}
