import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f12',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8783);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.route(/router\.project-osrm\.org/,r=>r.abort());   // deterministic: use the built-in drive estimate
  await page.route(/tile\.openstreetmap/,r=>r.abort());
  await page.goto(`http://localhost:8783/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(600);
  const r={};
  r.setup = await page.evaluate(()=>{ localStorage.clear(); const want=['Massachusetts Institute of Technology','University of Vermont','College of Charleston','Clemson University','Boston College'];
    const ids=want.map(n=>{const c=state.catalog.find(x=>x.name===n); return c&&c.id;});
    const onBoard=ids.map(id=>state.schools.some(s=>s.school_id===id));
    ids.forEach(id=>toggleTrip(id)); return {onBoard}; });
  await page.click('[data-nav="trip"]'); await page.waitForTimeout(500);
  r.tripCountText = await page.textContent('#trip-count');
  await page.selectOption('#trip-days','2'); await page.click('#trip-build'); await page.waitForTimeout(2500);
  r.schedule = await page.evaluate(()=>{ const plan=tripDays(); const legs=tripBuilt.legs; let li=0, prevEnd=null, prevDay=null, problems=[]; const rows=[];
    plan.forEach((day,di)=>{ if(!day.length) rows.push(`Day ${di+1}: travel day`); day.forEach((s,si)=>{ const t=stopTime(di,si); const isFirst=(rows.filter(x=>!x.includes('travel')).length===0);
      if(!isFirst){ const leg=legs[li++]; const gapMin=(t-prevEnd)/60000; if(gapMin+1<leg.min) problems.push(`${s.name}: ${Math.round(gapMin)} min after previous visit but drive is ${Math.round(leg.min)} min`); }
      rows.push(`Day ${di+1} ${t.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} ${s.name}`); prevEnd=new Date(t.getTime()+120*60000); }); });
    return {rows, impossibleLegs:problems, days:plan.length}; });
  r.overPlanWarning = await page.evaluate(()=>{ const m=[...document.querySelectorAll('#trip-out .msg')].map(x=>x.textContent.replace(/\s+/g,' ').slice(0,90)); return m[0]||null; });
  // compare with a non-board school
  r.compare = await page.evaluate(()=>{ const bc=state.catalog.find(x=>x.name==='Boston College'), mit=state.catalog.find(x=>x.name==='Massachusetts Institute of Technology'); Object.keys(cmpSel).forEach(k=>delete cmpSel[k]); cmpSel[bc.id]=true; cmpSel[mit.id]=true; goto('compare'); return [...document.querySelectorAll('.cx-grid .cx-head')].map(x=>x.textContent); });
  // per-account trip lists
  r.perAccount = await page.evaluate(()=>{ const me=state.me; const a=getTrip().size; state.me={...me,user_id:'someone-else'}; const b=getTrip().size; state.me=me; const a2=getTrip().size; return {thisAccount:a, otherAccountSameDevice:b, backToThisAccount:a2}; });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f12/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
