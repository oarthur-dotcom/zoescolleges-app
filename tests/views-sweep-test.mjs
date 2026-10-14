import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8996);
const b=await chromium.launch();
for(const W of [360,390,768,1280]){ const page=await b.newPage({viewport:{width:W,height:844}}); const errs=[]; page.on('pageerror',e=>errs.push(''+e)); page.on('response',r=>{ if(r.status()>=400) errs.push(r.status()+' '+r.url().slice(0,90)); });
 await page.goto('http://localhost:8996/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
 await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
 const res=[]; for(const v of ['today','board','recommends','discover','explore','compare','pulse','cost','deadlines','trip','talk','journey','memories','decide','family','zoe','profile','report','sauce']){ await page.evaluate(v=>{try{goto(v)}catch(e){}},v); await page.waitForTimeout(350);
  res.push(await page.evaluate(v=>{ const sec=[...document.querySelectorAll('section')].find(s=>!s.classList.contains('hidden')&&s.offsetParent); const over=[...(sec||document.body).querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return e.offsetParent&&r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'}).slice(0,2).map(e=>(e.className||e.tagName)+'');
   return {v,shown:sec&&sec.id,hscroll:document.documentElement.scrollWidth>innerWidth+2,over,bad:/\bNaN\b|undefined|\[object|\bnull\b/.test(sec?sec.innerText:''),empty:(sec?sec.innerText.trim().length:0)<20}; },v)); }
 const bad=res.filter(r=>r.hscroll||r.over.length||r.bad||r.empty||r.shown!=='v-'+r.v);
 console.log(W,'views',res.length,'problems',JSON.stringify(bad),'errs',JSON.stringify([...new Set(errs)].filter(e=>!/mp4/.test(e)))); await page.close(); }
process.exit(0);
