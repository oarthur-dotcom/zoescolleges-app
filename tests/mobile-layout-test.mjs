// Oct 28 product review, Priority 2: the floating Zoe button, the Schools tab strip and the Ask Zoe input on phones.
import { serve, launch, demo } from './_harness.mjs';
const {srv,port}=serve(); const b=await launch(); const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
const W_LIST=[320,390,430,1280];
for (const W of W_LIST) {
  const phone=W<=640; const H=phone?760:900;
  const {ctx,page,errs}=await demo(b,port,W,H);
  await page.evaluate(()=>document.querySelector('.demo-bar')&&0);
  // no sideways page scroll anywhere
  const views=['today','board','deadlines','zoe','compare','pulse'];
  let overflowAt=[]; for(const v of views){ await page.evaluate(v=>goto(v),v); await page.waitForTimeout(450); if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)) overflowAt.push(v); }
  ok(W+'_no_horizontal_page_overflow', overflowAt.length===0, overflowAt);
  // ---- Schools tab strip
  await page.evaluate(()=>goto('board')); await page.waitForTimeout(500);
  const strip = await page.evaluate(()=>{ const el=document.getElementById('subnav'), w=document.getElementById('subnav-wrap'), more=document.getElementById('sn-more'); const scrollable=el.scrollWidth>el.clientWidth+2; return { scrollable, canR:w.classList.contains('can-r'), moreVisible:!more.classList.contains('hidden')&&getComputedStyle(more).display!=='none', mask:getComputedStyle(el).webkitMaskImage||getComputedStyle(el).maskImage, tabs:[...el.querySelectorAll('.sn-tab')].map(e=>e.innerText.trim().split('\n')[0]) }; });
  if (strip.scrollable) {
    ok(W+'_strip_shows_cue_when_clipped', strip.canR && strip.moreVisible && /gradient/.test(strip.mask||''), JSON.stringify(strip));
    // every tab reachable: walk to the end with the › button and check the last tab is fully inside
    let guard=0; while(guard++<8 && await page.evaluate(()=>!document.getElementById('sn-more').classList.contains('hidden'))){ await page.click('#sn-more'); await page.waitForTimeout(450); }
    const end = await page.evaluate(()=>{ const el=document.getElementById('subnav'); const t=[...el.querySelectorAll('.sn-tab')]; const last=t[t.length-1].getBoundingClientRect(), box=el.getBoundingClientRect(); return { lastInside:last.right<=box.right+1 && last.left>=box.left-1, cueGone:!document.getElementById('subnav-wrap').classList.contains('can-r'), canL:document.getElementById('subnav-wrap').classList.contains('can-l'), last:t[t.length-1].innerText.trim() }; });
    ok(W+'_strip_last_tab_reachable_and_cue_clears', end.lastInside && end.cueGone && end.canL, JSON.stringify(end));
    // tapping a tab scrolled into view still works
    await page.evaluate(()=>document.querySelector('.sn-tab:last-child').click()); await page.waitForTimeout(500);
    ok(W+'_strip_last_tab_navigates', await page.evaluate(()=>currentView==='pulse'||currentView!=='board'));
  } else ok(W+'_strip_fits_no_cue_needed', !strip.moreVisible, JSON.stringify(strip));
  // ---- floating Zoe button never rests on a control (phone only; hidden on wide screens)
  if (phone) {
    const rest=[];
    for (const v of ['today','board','deadlines','compare']) {
      await page.evaluate(v=>goto(v),v); await page.waitForTimeout(450);
      const total=await page.evaluate(()=>document.documentElement.scrollHeight);
      for (let y=0; y<total; y+=Math.floor(H*0.6)) { await page.evaluate(y=>window.scrollTo(0,y),y); await page.waitForTimeout(80); await page.evaluate(()=>{ document.body.classList.remove('fab-tuck'); window.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(520);
        const st=await page.evaluate(()=>{ const f=document.getElementById('zoe-fab'); const vis=f&&!f.classList.contains('hidden')&&getComputedStyle(f).display!=='none'; return { vis, overlap: vis? fabOverlapsControl():false, pos:[...document.body.classList].filter(c=>/^fab-(left|peek)$/.test(c)).join(','), rect: vis? (r=>({l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom)}))(f.getBoundingClientRect()):null }; });
        if (st.vis && st.overlap) rest.push([v,y,st.pos]);
        if (st.vis && st.rect && st.pos!=='fab-peek' && (st.rect.r>W+1||st.rect.l<-1)) rest.push([v,y,'offscreen',JSON.stringify(st.rect)]);
      }
    }
    ok(W+'_zoe_button_never_on_a_control', rest.length===0, JSON.stringify(rest.slice(0,6)));
    // docked state is still tappable and opens Zoe
    await page.evaluate(()=>{ goto('today'); }); await page.waitForTimeout(500); await page.evaluate(()=>{ document.body.classList.add('fab-peek'); });
    const tappable = await page.evaluate(()=>{ const f=document.getElementById('zoe-fab'); const r=f.getBoundingClientRect(); const vis=Math.min(r.right,innerWidth)-Math.max(r.left,0); return vis>=10 && r.width>=40; });
    ok(W+'_docked_button_still_tappable', tappable); await page.evaluate(()=>document.body.classList.remove('fab-peek'));
  }
  // ---- Ask Zoe input with the keyboard open (short viewport), and long content
  await page.evaluate(()=>goto('zoe')); await page.waitForTimeout(500);
  const place = await page.evaluate(()=>{ const i=document.getElementById('ztab-in'); return { placeholder:i.placeholder, fits: i.scrollWidth<=i.clientWidth+1 }; });
  ok(W+'_placeholder_short', place.placeholder.length<=24, place.placeholder);
  await page.evaluate(()=>{ const long='x'.repeat(220)+' and what should we do before each application deadline for every school on our list '.repeat(2); for(let i=0;i<5;i++){ document.getElementById('ztab-in').value=(i===0?long:'Is my list balanced? '+i); document.getElementById('ztab-form').requestSubmit(); } }); await page.waitForTimeout(1600);
  const long = await page.evaluate(()=>{ const log=document.getElementById('ztab-log'); return { docOverflow:document.documentElement.scrollWidth>innerWidth+1, logOverflowX:log.scrollWidth>log.clientWidth+1, scrolls:log.scrollHeight>log.clientHeight }; });
  ok(W+'_long_content_no_sideways_overflow', !long.docOverflow && !long.logOverflowX, JSON.stringify(long));
  if (phone) {
    for (const KH of [300, 380]) { // viewport left when a phone keyboard is open
      await page.setViewportSize({width:W,height:KH}); await page.focus('#ztab-in'); await page.waitForTimeout(700);
      const kb = await page.evaluate(()=>{ const i=document.getElementById('ztab-in'), f=document.getElementById('ztab-form'), btn=f.querySelector('button'); const ri=i.getBoundingClientRect(), rb=btn.getBoundingClientRect(); const vh=window.visualViewport?visualViewport.height:innerHeight; return { kbMode:document.body.classList.contains('kb-open'), inputInside: ri.top>=0 && ri.bottom<=vh+1 && ri.left>=0 && ri.right<=innerWidth+1, askInside: rb.top>=0 && rb.bottom<=vh+1 && rb.right<=innerWidth+1, tabbarHidden:getComputedStyle(document.getElementById('tabbar')).display==='none', fabHidden:getComputedStyle(document.getElementById('zoe-fab')).display==='none', logRoom: Math.round(document.getElementById('ztab-log').getBoundingClientRect().height), vh }; });
      ok(W+'_keyboard'+KH+'_input_and_ask_visible', kb.kbMode && kb.inputInside && kb.askInside && kb.tabbarHidden && kb.fabHidden, JSON.stringify(kb));
      ok(W+'_keyboard'+KH+'_chat_log_has_room', kb.logRoom>=60, JSON.stringify(kb));
      await page.evaluate(()=>document.activeElement.blur()); await page.setViewportSize({width:W,height:H}); await page.waitForTimeout(600);
      ok(W+'_keyboard'+KH+'_closes_cleanly', await page.evaluate(()=>!document.body.classList.contains('kb-open') && getComputedStyle(document.getElementById('tabbar')).display!=='none'));
    }
  }
  ok(W+'_no_page_errors', errs.length===0, errs);
  await ctx.close();
}
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
