import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json'), INC=fs.readFileSync('/tmp/claude-0/f18/income.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f18/site',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8790);
const b=await launch(); const out={};
for(const mode of ['data-published','data-not-published-yet']){
  const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.route(/jsdelivr.*net-price-by-income\.json/,r=> mode==='data-published' ? r.fulfill({contentType:'application/json',body:INC}) : r.fulfill({status:404,body:'not found'}));
  await page.goto('http://localhost:8790/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(1200);
  const r={};
  r.dataLoaded = await page.evaluate(()=>!!state.incomePrices);
  const cofc = ()=>page.evaluate(()=>{ const c=[...document.querySelectorAll('#schools .school')].find(x=>x.innerText.includes('College of Charleston')); return c? (c.querySelector('.facts')||{}).innerText.replace(/\s+/g,' ') : null; });
  r.boardBefore = await cofc();
  // no income yet -> Compare cost card nudge
  await page.evaluate(()=>{ Object.keys(cmpSel).forEach(k=>delete cmpSel[k]); state.schools.slice(0,3).forEach(s=>cmpSel[s.school_id]=true); goto('compare'); });
  await page.waitForTimeout(600);
  r.costCardBefore = await page.evaluate(()=>{ const c=document.querySelector('.cost-card'); return c? c.innerText.replace(/\s+/g,' ').slice(0,160) : null; });
  // set income via the Profile select ($48-75k), home state MA
  await page.evaluate(()=>goto('profile')); await page.waitForTimeout(700);
  r.incomeSelectVisible = await page.isVisible('#pf-income');
  await page.evaluate(()=>{ const s=document.getElementById('pf-income'); s.value='2'; s.dispatchEvent(new Event('change')); });
  await page.waitForTimeout(500);
  await page.evaluate(()=>{ const p=studentProfile(); if(p) p.home_state='MA'; });
  r.savedBand = await page.evaluate(()=>myPrefs().incomeBand);
  await page.evaluate(()=>goto('board')); await page.waitForTimeout(600);
  r.boardAfter = await cofc();
  r.detailCofC = await page.evaluate(()=>{ const c=state.catalog.find(x=>x.name==='College of Charleston'); openDetail(c.id); const t=document.getElementById('v-detail').innerText; const m=t.match(/YOUR NET PRICE[^\n]*\n[^\n]*/i); return m?m[0].replace(/\s+/g,' '):null; });
  r.detailMIT_lowIncome = await page.evaluate(async()=>{ await setIncomeBand('0'); const c=state.catalog.find(x=>x.name==='Massachusetts Institute of Technology'); openDetail(c.id); const t=document.getElementById('v-detail').innerText; const m=t.match(/YOUR NET PRICE[^\n]*\n[^\n]*/i); await setIncomeBand('2'); return m?m[0].replace(/\s+/g,' '):null; });
  await page.evaluate(()=>goto('compare')); await page.waitForTimeout(600);
  r.compareRow = await page.evaluate(()=>[...document.querySelectorAll('.cx-k')].map(x=>x.textContent).find(t=>/Your net price/.test(t))||null);
  r.costCardAfter = await page.evaluate(()=>{ const c=document.querySelector('.cost-card'); return c? c.innerText.replace(/\s+/g,' ').slice(0,170) : null; });
  // explore cost sort uses your price
  await page.click('[data-nav="explore"]'); await page.waitForTimeout(600); await page.selectOption('#ex-sort2','cost'); await page.waitForTimeout(800);
  r.exploreCostSortFirst = await page.evaluate(()=>[...document.querySelectorAll('#exlist .srow')].slice(0,2).map(x=>x.querySelector('.sn').textContent+' | '+x.querySelector('.scl').innerText.replace(/\s+/g,' ').slice(0,40)));
  // saving priorities keeps the income choice; onboarding not ticked by income alone
  r.incomeKeptAfterPrioritySave = await page.evaluate(async()=>{ goto('profile'); await new Promise(r=>setTimeout(r,400)); document.getElementById('sl-save').click(); await new Promise(r=>setTimeout(r,400)); return myPrefs().incomeBand; });
  r.pageErrors=log.pageerr; out[mode]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f18/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
