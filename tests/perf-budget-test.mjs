import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8997);
const b=await chromium.launch();
for(const [label,thr] of [['desktop',1],['phone (4x slower CPU)',4]]){
 const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage(); const cdp=await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate',{rate:thr});
 const t0=Date.now(); await page.goto('http://localhost:8997/index.html'); await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:90000}); const tLoad=Date.now()-t0;
 await page.evaluate(()=>startDemo()); await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:90000}); const tCat=Date.now()-t0; await page.waitForTimeout(1500);
 const R=await page.evaluate(()=>{ const T=(f)=>{ const t=performance.now(); f(); return Math.round(performance.now()-t); };
  const o={}; o.picks=T(()=>{goto('recommends');}); o.board=T(()=>goto('board')); o.explore_empty=T(()=>{goto('explore'); renderExList._lastKey='|'; renderExList('');});
  const keys=['b','bo','bos','bost','bosto','boston','boston ','boston m','boston ma']; o.keystrokes=keys.map(k=>T(()=>{ $('exsearch').value=k; renderExList(k); })); o.detail=T(()=>openDetail(state.catalog[100].id,'explore')); o.zoe=T(()=>zoeAnswer('cheapest schools')); o.profile=T(()=>goto('profile')); o.today=T(()=>goto('today'));
  o.longTasks=0; return o; });
 console.log(label,'dom ready',tLoad,'ms; catalog ready',tCat,'ms;',JSON.stringify(R)); await ctx.close(); }
process.exit(0);
