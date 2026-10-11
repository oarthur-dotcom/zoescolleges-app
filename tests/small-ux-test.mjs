import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f13',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8784);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'free'});
  await page.addInitScript(()=>{ window.__copied=[]; Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied.push(t);}},configurable:true}); });
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8784/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(800);
  const r={};
  // header on phone
  r.header = await page.evaluate(()=>{ const lg=document.getElementById('logo-home'), so=document.getElementById('signout'); const lh=parseFloat(getComputedStyle(lg).lineHeight)||22; return {logoLines:Math.round(lg.getBoundingClientRect().height/lh), signOutLines:Math.round(so.getBoundingClientRect().height/ (parseFloat(getComputedStyle(so).lineHeight)||18))}; });
  // limit message (free plan, board already over 3)
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await page.waitForTimeout(300);
  await page.click('#fab-add'); await page.waitForTimeout(900);
  r.limitMessageVisible = await page.evaluate(()=>{ const m=document.getElementById('board-msg'); const rc=m.getBoundingClientRect(); return !!m.textContent.trim() && rc.top>=0 && rc.bottom<=innerHeight; });
  // nav: go to Profile (far right tab) and see if it's visible in the nav strip
  await page.evaluate(()=>goto('profile')); await page.waitForTimeout(700);
  r.activeTabVisible = await page.evaluate(()=>{ const n=document.getElementById('appnav').getBoundingClientRect(), a=document.querySelector('#appnav .navbtn.active').getBoundingClientRect(); return a.left>=n.left-1 && a.right<=n.right+1; });
  // detail labels for a school with only an SAT average
  r.detailLabels = await page.evaluate(()=>{ const c=state.catalog.find(x=>x.scorecard&&typeof x.scorecard.satAvg==='number'&&typeof x.scorecard.sat25!=='number'); openDetail(c.id); const t=document.getElementById('v-detail').innerText; const m=t.match(/(SAT (range \(25–75%\)|average))\s*\n?\s*([^\n]*)/i); return {school:c.name, shown:m?m[0].replace(/\s+/g,' ').slice(0,40):null}; });
  r.reviewLinks = await page.evaluate(()=>[...document.querySelectorAll('#v-detail a')].filter(a=>/Niche|Confidential/.test(a.textContent)).map(a=>a.textContent.trim()+' -> '+a.href.slice(0,70)));
  // invite copy link
  r.copyLink = await page.evaluate(async()=>{ openInvite(); await new Promise(r=>setTimeout(r,200)); document.getElementById('copy-link').click(); await new Promise(r=>setTimeout(r,200)); return window.__copied.pop()||null; });
  // onboarding priorities with default (untouched) prefs
  r.onboardPrioritiesDone = await page.evaluate(()=>{ state.prefs[state.me.user_id]=defaultPrefs(); try{ localStorage.removeItem('zc_onboard_done'); }catch(e){} goto('board'); const el=[...document.querySelectorAll('*')].find(x=>x.children.length<6 && /Set your priorities/.test(x.textContent||'') && x.textContent.length<200); return el? /Done|✓/.test(el.closest('div').innerText) : 'not shown'; });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f13/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
