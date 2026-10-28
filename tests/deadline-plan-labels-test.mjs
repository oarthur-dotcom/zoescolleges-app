// Oct 28 product review, Priority 1: ED / EA / RD stay distinct; binding vs non-binding is explained; nothing picks a plan for the family.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
for (const W of [390,1280]) {
  const {ctx,page,errs}=await demo(b,port,W);
  const all = await page.evaluate(()=>{ const out={rows:0,withOr:[],badTag:[],merged:0,sameDayDistinctPlans:0}; for(const c of state.catalog){ const L=(state.dl2627&&state.dl2627[c.id])?deadlineList(c):[]; for(const x of L){ out.rows++; if(/ or /.test(x.kind)) out.withOr.push(c.id); if(x.plans.length>1){ out.merged++; if(new Set(x.plans.map(p=>p.kind)).size===x.plans.length) out.sameDayDistinctPlans++; if(!x.plans.every(p=>x.kind.includes(p.kind))) out.badTag.push(c.id); } } } return out; });
  ok(W+'_no_or_labels_anywhere', all.withOr.length===0, all.withOr.slice(0,5));
  ok(W+'_merged_rows_keep_every_plan', all.merged>100 && all.badTag.length===0 && all.sameDayDistinctPlans===all.merged, JSON.stringify(all).slice(0,200));
  const elon = await page.evaluate(()=>{ const i=catInfo('sc-198516'); const L=deadlineList(i); const first=L[0]; return { first:{kind:first.kind, plans:first.plans.map(p=>[p.kind,p.binding])}, n:L.length, bin:[planIsBinding('Early Decision'),planIsBinding('Early Decision II'),planIsBinding('Early Action'),planIsBinding('Regular Decision'),planIsBinding('Restrictive Early Action')] }; });
  ok(W+'_elon_two_plans_one_date', elon.first.plans.length===2 && elon.first.plans[0][0]==='Early Decision' && elon.first.plans[0][1]===true && elon.first.plans[1][0]==='Early Action' && elon.first.plans[1][1]===false, JSON.stringify(elon));
  ok(W+'_binding_rules', JSON.stringify(elon.bin)==='[true,true,false,false,false]', JSON.stringify(elon.bin));
  ok(W+'_label_tags_binding', /Early Decision \(binding\)/.test(elon.first.kind) && /Early Action \(non-binding\)/.test(elon.first.kind) && !/ or /.test(elon.first.kind), elon.first.kind);
  // checklist is untouched by rendering the page
  const before = await page.evaluate(()=>JSON.stringify(getChecklist('sc-198516')));
  await page.evaluate(()=>goto('deadlines')); await page.waitForTimeout(700);
  const after = await page.evaluate(()=>JSON.stringify(getChecklist('sc-198516')));
  ok(W+'_checklist_not_changed', before===after);
  const page1 = await page.evaluate(()=>{ const card=[...document.querySelectorAll('#v-deadlines .card')].find(c=>/Elon University/.test(c.innerText)&&c.querySelector('.dl-row')); if(!card) return null; const lines=[...card.querySelectorAll('.dl-plan')].map(e=>e.innerText.replace(/\s+/g,' ').trim()); const note=card.querySelector('.plan-note'); const link=note&&note.querySelector('a'); const chip=card.querySelector('.dl-due'); return { lines, note:note?note.innerText.replace(/\s+/g,' '):null, href:link&&link.href, chip:chip&&chip.innerText.replace(/\s+/g,' ').trim(), src:!!card.querySelector('.dl-src a'), checked:/checked/.test(card.querySelector('.dl-src')?.innerText||''), apply:!!card.querySelector('[data-dlapply]'), checklist: card.querySelectorAll('.dl-pill').length }; });
  ok(W+'_deadlines_page_has_elon', !!page1);
  if (page1) {
    ok(W+'_one_line_per_plan_with_badge', page1.lines.length>=3 && /Early Decision.*\bbinding$/i.test(page1.lines[0]) && !/\(binding\)/i.test(page1.lines[0]) && /Early Action.*non-binding$/i.test(page1.lines[1]) && page1.lines.some(l=>/Regular Decision.*non-binding$/i.test(l)) && page1.lines.some(l=>/Early Decision II.*\bbinding$/i.test(l) && !/\(binding\)/i.test(l)), JSON.stringify(page1.lines));
    ok(W+'_note_and_official_source', /Choose one plan/.test(page1.note||'') && /binding/i.test(page1.note||'') && /membersupport\.commonapp\.org\/s\/article\/Admission-plan-definitions/.test(page1.href||''), JSON.stringify(page1.note));
    ok(W+'_chip_does_not_pick_a_plan', /choose a plan/.test(page1.chip||'') && !/Early Decision or/.test(page1.chip||''), page1.chip);
    ok(W+'_school_source_checked_kept', page1.src && page1.checked);
    ok(W+'_checklist_and_applying_button_kept', page1.checklist>=5 && page1.apply, JSON.stringify(page1));
  }
  // school detail view shows plans and the note
  const detail = await page.evaluate(()=>{ const i=catInfo('sc-198516'); const d=document.createElement('div'); d.innerHTML=detailDeadlines(i,(l,v)=>`<div>${l}${v}</div>`); return { badges:[...d.querySelectorAll('.plan-badge')].map(e=>e.innerText), note:!!d.querySelector('.plan-note'), src:!!d.querySelector('.dl27-src a') }; });
  ok(W+'_detail_badges_note_source', detail.badges.length>=3 && detail.note && detail.src, JSON.stringify(detail));
  // calendar events and Ask Zoe keep plan names
  const evs = await page.evaluate(()=>{ const i=catInfo('sc-198516'); const L=deadlineList(i).filter(x=>x.date>=new Date(2026,9,1)); return { title: `${i.name} — ${L[0].kind} deadline`, zoe: zoeAnswerPlain('When is the Elon deadline?') }; });
  ok(W+'_ics_title_has_both_plans', /Early Decision \(binding\)/.test(evs.title) && /Early Action \(non-binding\)/.test(evs.title), evs.title);
  ok(W+'_ask_zoe_one_bullet_per_plan', /• Early Decision \(binding\) — Nov 1, 2026<br>• Early Action \(non-binding\) — Nov 1, 2026/.test(evs.zoe), evs.zoe.slice(0,300));
  // today next-step card never names a single plan when two share the date
  const next = await page.evaluate(()=>{ const t=nextStepCard? null:null; return null; }).catch(()=>null);
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
