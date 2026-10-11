import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f6',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8776);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8776/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0,null,{timeout:60000}); await page.waitForTimeout(800);
  const r={};
  r.badValuesInMemory = await page.evaluate(()=>{ let n=0; for(const c of state.catalog){ const s=c.scorecard||{}, i=c.ipeds||{}; if(s.admissionRate===0||s.gradRate===0||(s.netPrice<0)||s.size===0||(i.retention!=null&&i.retention<=0)||(i.studentFacultyRatio>60)) n++; } return n; });
  r.cleaned = await page.evaluate(()=>state.catalogCleaned||null);
  r.catalogSize = await page.evaluate(()=>state.catalog.length);
  // detail pages of known-bad schools
  for(const nm of ['Bakersfield College','Moorpark College','Belanger School of Nursing','College of Charleston']){
    const id=await page.evaluate(nm=>{const c=state.catalog.find(x=>x.name===nm); return c&&c.id;},nm); if(!id) { r[nm]='not found'; continue; }
    await page.evaluate(id=>openDetail(id),id).catch(()=>{}); await page.waitForTimeout(500);
    const t=await page.evaluate(()=>document.getElementById('v-detail').innerText);
    r[nm]={negPct:/-\d+%/.test(t), negMoney:/\$-\d/.test(t), retentionLine:(t.match(/RETENTION \(1ST YR\)[^\n]*\n?[^\n]*/i)||['(no retention row)'])[0].replace(/\s+/g,' ').slice(0,40), minus200:t.includes('-200%'), netLine:(t.match(/Net price[^\n]*\n?[^\n]*/i)||[''])[0].replace(/\s+/g,' ').slice(0,50)};
  }
  // explore sorts
  await page.click('[data-nav="explore"]'); await page.waitForTimeout(800);
  for(const s of ['cost','sel']){ await page.selectOption('#ex-sort2',s); await page.waitForTimeout(800);
    r['sort_'+s+'_first3']=await page.evaluate(()=>[...document.querySelectorAll('#exlist .srow')].slice(0,3).map(x=>x.querySelector('.sn').textContent+' | '+x.querySelector('.scl').innerText.replace(/\s+/g,' ').slice(0,40))); }
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f6/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
