// Oct 28 product review, Priority 4 (option A, approved by Obie): admission, cost and family opinion are separate labelled questions;
// the Admit Power number, fit % and their limits sit under "More". No scoring changes.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
for (const W of [320,390,430,1280]) {
  const {ctx,page,errs}=await demo(b,port,W);
  await page.evaluate(()=>{ goto('board'); renderBoard(); }); await page.waitForTimeout(700);
  const d = await page.evaluate(()=>{ const cards=[...document.querySelectorAll('#v-board .mk3')]; const first=cards[0]; const card=first.closest('.sc, .card, .school, article, div[data-sid]')||first.parentElement;
    const qs=[...first.querySelectorAll('.mk-q')].map(e=>e.textContent); const heads=[...first.querySelectorAll('.mk-h')].map(e=>e.textContent.replace(/\s+/g,' ').trim()); const subs=[...first.querySelectorAll('.mk-s')].map(e=>e.textContent.replace(/\s+/g,' ').trim());
    const over=cards.some(m=>[...m.children].some(c=>c.scrollWidth>c.clientWidth+1)); const vis=document.querySelectorAll('#v-board .fit-pill').length;
    const how=document.querySelector('#v-board .how3'); const sc=window.scrollX; const tiles=[...first.children].map(c=>{const r=c.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.right)]});
    return { n:cards.length, schools:(state.schools||[]).length, qs, heads, subs, over, fitPills:vis, howText:how?how.textContent.replace(/\s+/g,' '):'', oldTiles:document.querySelectorAll('#v-board .big3').length, docOverflow:document.documentElement.scrollWidth>innerWidth+1, tiles, vw:innerWidth }; });
  ok(W+'_one_three_question_row_per_board_school', d.n===d.schools && d.n>0, JSON.stringify([d.n,d.schools]));
  ok(W+'_question_labels_in_order', d.qs.join('|')==='Can we get in?|Can we afford it?|Do we like it?', d.qs.join('|'));
  ok(W+'_each_question_has_a_headline_and_a_note', d.heads.length===3 && d.heads.every(h=>h.length>0) && d.subs.every(s=>s.length>0), JSON.stringify([d.heads,d.subs]));
  ok(W+'_admission_headline_is_the_band', /^(Likely|Target|Reach|—)$/.test(d.heads[0]), d.heads[0]);
  ok(W+'_cost_headline_says_what_kind_of_number', /^\$\d+k \/yr$|^—$/.test(d.heads[1].replace(/ /g,' ')) && /(your estimate|average net price|no price data)/.test(d.subs[1]), JSON.stringify([d.heads[1],d.subs[1]]));
  ok(W+'_family_headline', /^(★ \d\.\d|—)$/.test(d.heads[2]) && /(family average|no ratings yet)/.test(d.subs[2]), JSON.stringify([d.heads[2],d.subs[2]]));
  ok(W+'_fit_pill_and_old_four_tiles_gone_from_board_cards', d.fitPills===0 && d.oldTiles===0, JSON.stringify([d.fitPills,d.oldTiles]));
  ok(W+'_detail_explains_each_signal_and_limits', /Admit Power \d+ \(50 = the typical admitted student\)/.test(d.howText) && /not a prediction or a guarantee/.test(d.howText) && /Can we afford it\?/.test(d.howText) && /Priorities match \d+%/.test(d.howText) && /preference, not admission/.test(d.howText), d.howText.slice(0,260));
  ok(W+'_text_fits_inside_tiles_no_page_overflow', !d.over && !d.docOverflow, JSON.stringify([d.over,d.docOverflow]));
  ok(W+'_tiles_sit_inside_the_screen', d.tiles.every(([l,r])=>l>=0 && r<=d.vw+1), JSON.stringify(d.tiles));
  // scoring untouched: the same numbers as the model produces
  const same = await page.evaluate(()=>{ const s=state.schools[0]; const info=catInfo(s.school_id); const ch=chanceFor(info); const card=[...document.querySelectorAll('#v-board .mk3')][0]; return { band:ch&&ch.label, shown:card.querySelector('.mk-h').textContent.trim(), sortPower:!!document.querySelector('#board-sort option[value=power]') }; });
  ok(W+'_headline_matches_the_existing_model', same.band===same.shown && same.sortPower, JSON.stringify(same));
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
