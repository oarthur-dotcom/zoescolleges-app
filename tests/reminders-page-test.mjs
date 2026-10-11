import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f17/site',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8789);
const b=await launch(); const out={};
for(const mode of ['table-exists','table-missing']){
  const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto('http://localhost:8789/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000});
  await page.evaluate((mode)=>{ window.__rp={saved:[]}; const real=sb.from.bind(sb);
    sb.from=(t)=>{ if(t!=='reminder_prefs') return real(t);
      if(mode==='table-missing'){ const err={message:'relation "public.reminder_prefs" does not exist',code:'42P01'}; const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null,error:err}),upsert:async()=>({error:err})}; return q; }
      const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:window.__rp.row||null,error:null}),upsert:async(row)=>{ window.__rp.saved.push(row); window.__rp.row=row; return {error:null}; }}; return q; };
    // make sure Clemson + Arizona are on the board
    for(const n of ['Clemson University','University of Arizona']){ const c=state.catalog.find(x=>x.name===n); if(!state.schools.find(s=>s.school_id===c.id)) state.schools.push({school_id:c.id,name:c.name,city:c.city,state:c.state,position:99}); }
  }, mode);
  await page.click('[data-nav="deadlines"]'); await page.waitForTimeout(900);
  const r={};
  r.cardShown = await page.isVisible('#dl-remind .dl-remind-card');
  if(r.cardShown){
    r.offText = (await page.textContent('#dl-remind')).replace(/\s+/g,' ').trim().slice(0,170);
    await page.click('#dl-remind-btn'); await page.waitForTimeout(500);
    r.saved = await page.evaluate(()=>window.__rp.saved.map(x=>({email_on:x.email_on, hasFamily:!!x.family_id, own:x.user_id===state.me.user_id})));
    r.onText = (await page.textContent('#dl-remind')).replace(/\s+/g,' ').trim().slice(0,150);
    await page.locator('#dl-remind').screenshot({path:'/tmp/claude-0/f17/reminder-card-on.png'});
    await page.click('#dl-remind-btn'); await page.waitForTimeout(400);
    r.afterTurnOff = await page.evaluate(()=>window.__rp.row.email_on);
  }
  r.restOfDeadlinesStillRenders = await page.evaluate(()=>document.querySelectorAll('#dl-out .dl-row').length);
  r.pageErrors=log.pageerr; out[mode]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f17/page-result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
