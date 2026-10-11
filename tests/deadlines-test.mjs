import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f11',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8782);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8782/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(600);
  const r=await page.evaluate(()=>{
    const res={}; const withDL=state.catalog.filter(c=>c.earlyDeadline||c.regularDeadline);
    const realText=withDL.filter(c=>/\d{4}/.test((c.earlyDeadline||"")+(c.regularDeadline||"")));
    res.schoolsWithARealDate=realText.length; res.parsedToADate=realText.filter(c=>parseDeadlineDate(c)).length;
    const show=n=>{ const c=state.catalog.find(x=>x.name===n); if(!c) return 'missing'; const d=parseDeadlineDate(c); return {early:c.earlyDeadline, regular:c.regularDeadline, countdownTo:d?d.toDateString():null}; };
    for(const n of ['Clemson University','University of Arizona','University of Utah','The University of Alabama']) res[n]=show(n);
    return res; });
  // Deadlines screen with Clemson + Arizona on the board
  await page.evaluate(()=>{ for(const n of ['Clemson University','University of Arizona']){ const c=state.catalog.find(x=>x.name===n); if(c && !state.schools.find(s=>s.school_id===c.id)) state.schools.push({school_id:c.id,name:c.name,city:c.city,state:c.state,position:99}); } });
  await page.click('[data-nav="deadlines"]'); await page.waitForTimeout(800);
  r.screenNextLine = await page.evaluate(()=>{ const e=document.querySelector('#dl-out .dl-summary .dl-due'); return e?e.textContent.trim():null; });
  r.screenClemsonRow = await page.evaluate(()=>{ const card=[...document.querySelectorAll('#dl-out .card')].find(c=>c.innerText.includes('Clemson')); return card?card.innerText.replace(/\s+/g,' ').slice(0,140):null; });
  r.calendarEvents = await page.evaluate(()=>{ try{ const rows=state.schools.map(s=>({rec:s,info:catInfo(s.school_id)})).filter(x=>x.info); rows.forEach(r=>{ r._d=parseDeadlineDate(r.info); }); dlSel=dlSel||{}; rows.forEach(r=>{ if(r._d) dlSel[r.rec.school_id]=true; }); return deadlineEvents(rows).map(e=>e.title+' @ '+e.date.toDateString()); }catch(e){ return 'err '+e.message; } });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f11/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
