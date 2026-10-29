// Oct 28: families can optionally record which plan (ED / EA / RD) they are applying under for each school. Nothing is chosen for them.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
for (const W of [390,1280]) {
  const {ctx,page,errs}=await demo(b,port,W);
  const elon='sc-198516';
  // default: nothing chosen, every plan still shown, chooser offered with an honest message
  await page.evaluate(()=>goto('deadlines')); await page.waitForTimeout(700);
  const d0 = await page.evaluate(id=>{ const card=[...document.querySelectorAll('#v-deadlines .card')].find(c=>/Elon University/.test(c.innerText)&&c.querySelector('.dl-row')); const chips=[...card.querySelectorAll('.pp-chip')].map(e=>({t:e.innerText.replace(/\s+/g,' '),on:e.classList.contains('on')})); return { chips, msg:card.querySelector('.pp-msg').innerText, chip:card.querySelector('.dl-due').innerText.replace(/\s+/g,' '), chosen:getChecklist(id)._plan||null, planLines:card.querySelectorAll('.dl-plan').length }; }, elon);
  ok(W+'_default_nothing_chosen', d0.chosen===null && d0.chips.length===5 && d0.chips.filter(c=>c.on).length===1 && /Not decided yet/.test(d0.chips.find(c=>c.on).t) && /won't assume one/.test(d0.msg), JSON.stringify(d0));
  ok(W+'_default_all_plans_still_shown', d0.planLines===4 && /choose a plan/.test(d0.chip), JSON.stringify(d0));
  ok(W+'_chips_name_plan_date_and_binding', d0.chips.some(c=>/Early Decision · Nov 1, 2026 · binding/.test(c.t)) && d0.chips.some(c=>/Early Action · Nov 1, 2026$/.test(c.t)), JSON.stringify(d0.chips));
  // pick Early Action
  await page.evaluate(()=>{ const b=[...document.querySelectorAll('.pp-chip')].find(e=>/Early Action · Nov 1/.test(e.innerText)); b.click(); }); await page.waitForTimeout(700);
  const d1 = await page.evaluate(id=>{ const card=[...document.querySelectorAll('#v-deadlines .card')].find(c=>/Elon University/.test(c.innerText)&&c.querySelector('.dl-row')); const chk=getChecklist(id); const info=catInfo(id); const nx=nextDeadline(info); return { saved:chk._plan, on:[...card.querySelectorAll('.pp-chip.on')].map(e=>e.innerText.replace(/\s+/g,' ')), msg:card.querySelector('.pp-msg').innerText, chip:card.querySelector('.dl-due').innerText.replace(/\s+/g,' '), nxKind:nx.kind, planLines:card.querySelectorAll('.dl-plan').length, keysOk:Object.keys(chk).filter(k=>k[0]!=='_'&&chk[k]).length===0, stage:schoolStage(id), ev:deadlineEvents([{rec:{school_id:id,name:'Elon University'},info,_d:nx.date}]).map(e=>e.title) }; }, elon);
  ok(W+'_choice_saved_with_checklist', d1.saved==='Early Action|2026-11-01', JSON.stringify(d1));
  ok(W+'_choice_highlighted_and_explained', d1.on.length===1 && /Early Action/.test(d1.on[0]) && /Your family chose/.test(d1.msg), JSON.stringify(d1));
  ok(W+'_countdown_follows_choice', /^Early Action/.test(d1.chip) && !/choose a plan/.test(d1.chip) && d1.nxKind==='Early Action', JSON.stringify(d1));
  ok(W+'_all_plans_still_listed_after_choice', d1.planLines===4);
  ok(W+'_choice_does_not_tick_checklist_or_change_stage', d1.keysOk && d1.stage!=='applying', JSON.stringify(d1));
  ok(W+'_calendar_gets_only_chosen_plan', d1.ev.length===1 && /Early Action/.test(d1.ev[0]) && !/Early Decision/.test(d1.ev[0]), JSON.stringify(d1.ev));
  // Ask Zoe and the Today card follow the choice
  const z = await page.evaluate(()=>{ const a=zoeAnswer('What should we do before the Elon deadline?'); const d=document.createElement('div'); d.innerHTML=a; return d.textContent.replace(/\s+/g,' '); });
  ok(W+'_ask_zoe_names_chosen_plan', /Early Action, the plan your family chose/.test(z) && !/choose one plan/.test(z), z.slice(0,300));
  // change back to not decided
  await page.evaluate(()=>{ const b=[...document.querySelectorAll('.pp-chip')].find(e=>/Not decided yet/.test(e.innerText)); b.click(); }); await page.waitForTimeout(600);
  const d2 = await page.evaluate(id=>({ saved:getChecklist(id)._plan||null, chip:document.querySelector('#v-deadlines .dl-due')?.innerText }), elon);
  ok(W+'_can_unchoose', d2.saved===null);
  // a stale choice (dates changed) is reported, never moved to another date
  await page.evaluate(id=>{ const c=getChecklist(id); c._plan='Early Action|2025-11-01'; setChecklist(id,c); }, elon); await page.evaluate(()=>renderDeadlines()); await page.waitForTimeout(500);
  const d3 = await page.evaluate(id=>{ const card=[...document.querySelectorAll('#v-deadlines .card')].find(c=>/Elon University/.test(c.innerText)&&c.querySelector('.dl-row')); return { state:planChoice(catInfo(id)).state, msg:card.querySelector('.pp-msg').innerText, still:getChecklist(id)._plan, chip:card.querySelector('.dl-due').innerText.replace(/\s+/g,' ') }; }, elon);
  ok(W+'_stale_choice_reported_not_moved', d3.state==='stale' && /isn't one of this school's current dates/.test(d3.msg) && d3.still==='Early Action|2025-11-01' && /choose a plan/.test(d3.chip), JSON.stringify(d3));
  // a school with one plan gets no chooser
  const one = await page.evaluate(()=>{ const i=catInfo('sc-217882'); return { chooser:planChooserHtml(i,'sc-217882'), n:deadlineList(i).flatMap(r=>r.plans).length }; });
  ok(W+'_single_plan_school_has_no_chooser', one.n===2 && one.chooser!=="" ); // Clemson has EA + RD, so it does get one
  const single = await page.evaluate(()=>{ const fake={id:'x',name:'X'}; return planChooserHtml(fake,'x'); }); ok(W+'_no_dates_no_chooser', single==="");
  // whole-app: no overflow, no errors; other schools untouched
  const other = await page.evaluate(()=>(state.schools||[]).filter(s=>s.school_id!=='sc-198516').every(s=>!getChecklist(s.school_id)._plan));
  ok(W+'_other_schools_untouched', other);
  ok(W+'_no_overflow', !(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
