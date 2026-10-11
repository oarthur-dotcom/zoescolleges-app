import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f9',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8780);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8780/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000});
  await page.click('[data-nav="explore"]'); await page.waitForTimeout(800);
  const r={};
  const top=async q=>{ await page.fill('#exsearch',q); await page.dispatchEvent('#exsearch','input'); await page.waitForTimeout(500);
    return {count:(await page.textContent('#excount')).replace(/\s+/g,' ').slice(0,110), top3:await page.evaluate(()=>[...document.querySelectorAll('#exlist .srow .sn')].slice(0,3).map(x=>x.textContent))}; };
  for(const q of ['MIT','Charleston','UNC','ucla','nyu','penn state','sc','Boston','zzqqxx']) r['search: '+q]=await top(q);
  await page.fill('#exsearch',''); await page.dispatchEvent('#exsearch','input'); await page.waitForTimeout(500);
  r.defaultCount=(await page.textContent('#excount')).replace(/\s+/g,' ').slice(0,80);
  r.twoYearInTop50=await page.evaluate(()=>[...document.querySelectorAll('#exlist .srow .sn')].slice(0,50).map(x=>state.catalog.find(c=>c.name===x.textContent)).filter(c=>c&&c.degreeType==='2-year').length);
  await page.selectOption('#ex-size','s'); await page.waitForTimeout(500);
  r.smallFilterCount=(await page.textContent('#excount')).replace(/\s+/g,' ').slice(0,60);
  r.smallFilterUnknownSizeIncluded=await page.evaluate(()=>[...document.querySelectorAll('#exlist .srow .sn')].map(x=>state.catalog.find(c=>c.name===x.textContent)).filter(c=>c&&typeof (c.scorecard||{}).size!=='number').length);
  await page.selectOption('#ex-size',''); await page.waitForTimeout(400);
  r.showMoreButton=await page.isVisible('#ex-more');
  if(r.showMoreButton){ const before=await page.locator('#exlist .srow').count(); await page.click('#ex-more'); await page.waitForTimeout(600); r.rowsBeforeAfterShowMore=[before, await page.locator('#exlist .srow').count()]; }
  // slider 0 = very small: does match favour small schools?
  r.sizeSlider0 = await page.evaluate(()=>{ const w=Object.assign({},myPrefs(),{size:0}); const big=state.catalog.find(c=>c.name==='Ohio State University-Main Campus'), small=state.catalog.find(c=>c.name==='Williams College');
    return {williams:matchScore(small,w), ohioState:matchScore(big,w)}; });
  // add-school dialog search
  r.addDialogMIT = await page.evaluate(()=>{ renderPicklist('MIT'); return [...document.querySelectorAll('#picklist .pn')].slice(0,2).map(x=>x.textContent); });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f9/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
