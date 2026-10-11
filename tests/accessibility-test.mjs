import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f16',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8787);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8787/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(800);
  const unnamed=async()=>page.evaluate(()=>{ const all=[...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea")];
    return all.filter(el=>!(el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")||(el.id&&document.querySelector(`label[for="${CSS.escape(el.id)}"]`))||el.closest("label"))).length; });
  const r={};
  await page.evaluate(()=>goto('profile')); await page.waitForTimeout(900);
  r.fieldsWithoutAName = await unnamed();
  await page.evaluate(()=>goto('board')); await page.waitForTimeout(600);
  r.tapTargets = await page.evaluate(()=>{ const s=document.querySelector('.stars.mine .s'), o=document.querySelector('#schools .openlink'); const bx=e=>e?Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height):null; return {myStar:bx(s), cardButton:bx(o)}; });
  r.mutedColor = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--muted').trim());
  r.head = await page.evaluate(()=>({favicon:!!document.querySelector('link[rel=icon]'), description:!!document.querySelector('meta[name=description]'), ogTitle:!!document.querySelector('meta[property="og:title"]')}));
  // rating still works after the bigger star tap area
  r.ratingClickWorks = await page.evaluate(async()=>{ const st=document.querySelector('.stars.mine .s:nth-child(3)'); if(!st) return 'no stars'; window.__writes.length=0; st.click(); await new Promise(r=>setTimeout(r,400)); return window.__writes.some(w=>w.table==='ratings'); });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f16/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
