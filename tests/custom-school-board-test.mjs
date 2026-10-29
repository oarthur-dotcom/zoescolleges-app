// Oct 28 (live bug on Obie's own board): a school added by hand ("custom-…") has no catalog record. The board, Today, Deadlines,
// report, compare and Ask Zoe must all keep working, never "Couldn't load your board: Cannot read properties of null (reading 'muse')".
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
for (const W of [390,1280]) {
  const {ctx,page,errs}=await demo(b,port,W);
  await page.evaluate(()=>{ for(const [id,name] of [['custom-skidmore-college','Skidmore College'],['custom-university-of-pittsburgh','University of Pittsburgh']]) state.schools.push({school_id:id,name,city:'Saratoga Springs',state:'NY',is_custom:true,checklist:{}}); });
  const errsFound = await page.evaluate(async()=>{ const bad=[]; const run=async(n,f)=>{ try{ const v=f(); if(v&&v.then) await v; }catch(e){ bad.push(n+': '+String(e).slice(0,120)); } };
    for(const v of ['today','board','deadlines','compare','pulse','report','journey','trip','cost','decide']) await run('goto '+v,()=>goto(v));
    await run('renderBoard',()=>renderBoard()); await run('updateDlNav',()=>updateDlNav());
    await run('zoe deadlines',()=>zoeAnswer('When are my deadlines?')); await run('zoe steps',()=>zoeAnswer('Which of my schools are cheapest and what are the next steps before the deadlines?'));
    await run('nextDeadline(null)',()=>{ if(nextDeadline(null)!==null) throw new Error('should be null'); }); await run('deadlineList(null)',()=>{ if(deadlineList(null).length!==0) throw new Error('should be empty'); });
    return bad; });
  ok(W+'_nothing_throws_with_custom_schools', errsFound.length===0, JSON.stringify(errsFound));
  await page.evaluate(()=>goto('board')); await page.waitForTimeout(700);
  const board = await page.evaluate(()=>({ banner:(document.getElementById('board-msg')||{}).innerText||'', err:/Couldn't load your board/.test(document.body.innerText), cards:[...document.querySelectorAll('#schools .card, #schools > *')].map(e=>e.innerText).join('|') }));
  ok(W+'_board_shows_custom_schools_and_no_error', !board.err && /Skidmore College/.test(board.cards) && /University of Pittsburgh/.test(board.cards), JSON.stringify(board).slice(0,200));
  await page.evaluate(()=>goto('deadlines')); await page.waitForTimeout(700);
  const dl = await page.evaluate(()=>({ txt:document.getElementById('v-deadlines').innerText, err:/Something went wrong|Couldn't load/.test(document.getElementById('v-deadlines').innerText) }));
  ok(W+'_deadlines_page_says_which_schools_are_not_tracked', !dl.err && /Not tracked here: Skidmore College, University of Pittsburgh/.test(dl.txt) && /no dates or checklist/.test(dl.txt), dl.txt.slice(0,300));
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
