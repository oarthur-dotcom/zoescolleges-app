// Oct 28 product review, Priority 3: Ask Zoe answers every part of a compound question (or says which part it cannot), uses real
// school/family data for deadline advice, and never puts family income into the external-AI hand-off.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
const txt = h => { const d=document.createElement('div'); d.innerHTML=h; return (d.innerText||d.textContent||'').replace(/\s+/g,' ').trim(); };
for (const W of [390,1280]) {
  const {ctx,page,errs}=await demo(b,port,W);
  const ask = q => page.evaluate(q=>{ const a=zoeAnswer(q); const d=document.createElement('div'); d.innerHTML=a; return { fallback:a===ZOE_FALLBACK, pending:_zoePending, text:(d.textContent||'').replace(/\s+/g,' ').trim(), parts:d.querySelectorAll('.zpart').length, heads:[...d.querySelectorAll('.zpart > b:first-child')].map(e=>e.textContent) }; }, q);
  // 1. affordability + what to do before the deadline (the review's example)
  let r = await ask('Can we afford Elon, and what should we do before its application deadline?');
  ok(W+'_afford_plus_steps_two_parts', r.parts===2 && /Can we afford Elon/.test(r.heads[0]) && /before its application deadline/.test(r.heads[1]), JSON.stringify(r.heads));
  ok(W+'_afford_part_has_price', /net price|Likely cost/.test(r.text) && /Sticker price/.test(r.text));
  ok(W+'_steps_part_uses_real_date_and_checklist', /Nov 1, 2026/.test(r.text) && /Still to do on your checklist \(\d+ of \d+ done\)/.test(r.text) && /Transcript/.test(r.text), r.text.slice(-420));
  ok(W+'_steps_part_states_limits', /confirm requirements and dates with the school/.test(r.text) && /checked Oct \d+/.test(r.text));
  ok(W+'_nothing_pending_when_all_answered', r.pending===null);
  // 2. admissions + deadline
  r = await ask('Is Clemson a reach for Maya and when do we need to apply by?');
  ok(W+'_chance_plus_deadline', r.parts===2 && /Admit Power/.test(r.text) && /Oct 15, 2026/.test(r.text) && /Jan 1, 2027/.test(r.text), r.text.slice(0,300));
  // 3. board-wide: cheapest + next steps (previously the second part was a generic site blurb)
  r = await ask('Which of my schools are cheapest and what are the next steps before the deadlines?');
  ok(W+'_board_cheapest_plus_steps', r.parts===2 && /Lowest cost on your board/.test(r.text) && /Your next deadlines and what is still open/.test(r.text) && /Still to do:/.test(r.text) && !/lets you add them to Google, Apple or Outlook/.test(r.text), r.text.slice(0,500));
  ok(W+'_board_steps_say_confirm_with_school', /confirm with the school/.test(r.text));
  // 4. single-school affordability used to return unrelated community colleges
  r = await ask('Is Boston University affordable?');
  ok(W+'_affordable_names_the_school', /Boston University/.test(r.text) && /net price/i.test(r.text) && !/Canada College|Fort Peck/.test(r.text), r.text.slice(0,200));
  r = await ask('What should I do before the Boston University deadline?');
  ok(W+'_single_school_steps', /Nov 2, 2026/.test(r.text) && /Still to do on your checklist/.test(r.text) && /Early Decision/.test(r.text), r.text.slice(0,300));
  // 5. a school that is not on the board: honest about what it cannot see
  r = await ask('What should we do before the Duke deadline?');
  ok(W+'_not_on_board_is_honest', /isn't on your board yet/.test(r.text) && /Add it to your board/.test(r.text) && /Jan 4, 2027|Nov 2, 2026/.test(r.text), r.text.slice(0,300));
  // 6. a part Zoe cannot answer: say so, answer the rest, hand off ONLY that part
  r = await ask('Can we afford Elon and who won the Red Sox game last night?');
  ok(W+'_unanswerable_part_named', r.parts===2 && /I can't answer this part/.test(r.text) && /Sticker price/.test(r.text), r.text.slice(0,400));
  ok(W+'_only_that_part_pending', r.pending==='Who won the Red Sox game last night?', r.pending);
  // 7. nothing answerable at all: the normal whole-question hand-off
  r = await ask('Who won the Red Sox game last night and what is the weather in Boston tomorrow?');
  ok(W+'_nothing_answerable_falls_back', r.fallback===true && r.pending===null, JSON.stringify(r).slice(0,200));
  // 8. two named schools, no "compare": both answered; two bands: both answered
  r = await ask('Tell me about Elon and Clemson');
  ok(W+'_two_schools_both_answered', /Elon University/.test(r.text) && /Clemson University/.test(r.text));
  r = await ask('What are my reaches and targets?');
  ok(W+'_reaches_and_targets_both', /Your reaches/.test(r.text) && /Your targets/.test(r.text), r.text.slice(0,200));
  // 9. no false splits
  const sp = await page.evaluate(()=>['Compare Elon and Clemson','What are my reaches and targets','Is my list balanced','How much does Elon cost','Which schools have D1 soccer and a big campus'].map(q=>zoeSplitParts(q).length));
  ok(W+'_no_false_splits', JSON.stringify(sp)==='[1,1,1,1,1]', JSON.stringify(sp));
  const sp3 = await page.evaluate(()=>zoeSplitParts('Can we afford Elon, and what should we do first, and when is the deadline, and how big is it, and is it safe').length);
  ok(W+'_at_most_three_parts', sp3===3, sp3);
  // 10. privacy: external-AI hand-off carries no family income and none of the app's answers
  await page.evaluate(()=>{ state.fin={income:187654, band:'high', kids:1, exact:true}; });
  await page.evaluate(()=>goto('zoe')); await page.waitForTimeout(500);
  await page.evaluate(()=>{ document.getElementById('ztab-in').value='Can we afford Elon and who won the Red Sox game last night?'; document.getElementById('ztab-form').requestSubmit(); }); await page.waitForTimeout(1200);
  const ui = await page.evaluate(()=>{ const log=document.getElementById('ztab-log'); const prompts=Object.values(_aiPrompts||{}); return { zparts:log.querySelectorAll('.zpart').length, aiBtn:log.querySelectorAll('.ai-btn').length, prompts, docOverflow:document.documentElement.scrollWidth>innerWidth+1, logOverflow:log.scrollWidth>log.clientWidth+1, textAll:log.innerText }; });
  ok(W+'_ui_shows_parts_and_handoff', ui.zparts===2 && ui.aiBtn>=1, JSON.stringify({z:ui.zparts,a:ui.aiBtn}));
  const joined = ui.prompts.join(' ');
  ok(W+'_handoff_prompt_has_only_unanswered_part', /Red Sox/.test(joined) && !/Sticker price|Average net price|Likely cost/.test(joined), joined.slice(0,300));
  ok(W+'_income_never_in_handoff', !/187[,.]?654|187k|\$187|income/i.test(joined) || /never your income/.test(joined) && !/187[,.]?654|187k|\$187/i.test(joined), joined.slice(0,300));
  ok(W+'_income_not_echoed_in_chat', !/187[,.]?654/.test(ui.textAll));
  ok(W+'_no_overflow', !ui.docOverflow && !ui.logOverflow);
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
