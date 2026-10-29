// Oct 28 preview findings: (1) a chosen plan whose date has passed must not hide later open rounds,
// (2) Ask Zoe "cheapest on my board" uses the Costs-page basis (out-of-state included), (3) sample family shows its real plan.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); let bad=0; const ok=(n,c,x)=>{ if(!c){ bad++; console.log('FAIL:',n,x??''); } else console.log('ok:',n); };
for (const W of [390,1280]) {
  const {page,errs}=await demo(b,port,W);
  const r = await page.evaluate(()=>{
    const id='sc-217882', info=catInfo(id); const L=deadlineList(info); const today=new Date(); today.setHours(0,0,0,0);
    const past=L.flatMap(x=>x.plans).find(p=>p.date<today), open=L.filter(x=>x.date>=today);
    if(!past) return {skip:true, rounds:L.map(x=>x.date.toISOString().slice(0,10))};
    setPlanChoice(id,past.key);
    const my=myDeadlines(info), nx=nextDeadline(info);
    const html=planChooserHtml(info,id);
    return { past:past.key, openCount:open.length, myCount:my.length, nxDate:nx.date.toISOString().slice(0,10), nxOpen:nx.date>=today, msgPassed:/closed on/.test(html), allOpenShown:open.every(o=>my.some(m=>m.date.getTime()===o.date.getTime())) };
  });
  ok(W+'_past_plan_found', !r.skip, JSON.stringify(r));
  if(!r.skip){
    ok(W+'_past_choice_keeps_open_rounds', r.allOpenShown && r.myCount>=r.openCount && r.nxOpen, JSON.stringify(r));
    ok(W+'_chooser_says_plan_closed', r.msgPassed, JSON.stringify(r));
  }
  // future choice still narrows to that one round
  const f = await page.evaluate(()=>{ const id='sc-198516', info=catInfo(id); const L=deadlineList(info); const today=new Date(); today.setHours(0,0,0,0); const fut=L.flatMap(x=>x.plans).find(p=>p.date>=today); setPlanChoice(id,fut.key); return { n:myDeadlines(info).length, same:myDeadlines(info)[0].date.getTime()===fut.date.getTime() }; });
  ok(W+'_future_choice_still_narrows', f.n===1 && f.same, JSON.stringify(f));
  // sample family plan label
  const sc = await page.evaluate(()=>{ renderBoard && renderBoard(); return { plan:state.family.plan, text:document.getElementById('schoolcount')?.innerText||'' }; });
  ok(W+'_sample_family_not_over_limit', sc.plan==='family_plus' && !/\/\s*3 schools/.test(sc.text), JSON.stringify(sc));
  const p2 = await page.evaluate(()=>{ const keep=state.family.plan; state.family.plan='familyplus'; const l=plan().schools; state.family.plan=keep; return l; });
  ok(W+'_plan_tolerates_old_key', p2>999, p2);
  // Ask Zoe cheapest uses out-of-state basis
  const z = await page.evaluate(()=>{ const a=zoeAnswer('Which school on my board is cheapest?'); const d=document.createElement('div'); d.innerHTML=a; const txt=d.textContent.replace(/\s+/g,' ');
    const costs=state.schools.map(s=>({n:state.catalog.find(c=>c.id===s.school_id)?.name, c:offerCost(s.school_id)})).filter(x=>x.c).sort((a,b)=>a.c.v-b.c.v);
    return { txt, expectFirst:costs[0]&&costs[0].n, expectV:costs[0]&&Math.round(costs[0].c.v) }; });
  ok(W+'_cheapest_matches_costs_page_basis', z.expectFirst && z.txt.indexOf(z.expectFirst) > -1 && /same basis as your Costs page/.test(z.txt) && z.txt.split("•")[1].includes(z.expectFirst), JSON.stringify(z));
  ok(W+'_no_errors', errs.length===0, errs.join('|'));
  await page.context().close();
}
await b.close(); srv.close(); console.log(bad?`FAILED ${bad}`:'ALL PASS'); process.exit(bad?1:0);
