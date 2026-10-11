import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f7',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8778);
const b=await launch();
for(const v of ['old','new']){
  const {ctx,page}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8778/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000});
  console.log(v, JSON.stringify(await page.evaluate(async()=>{
    state.members=[{user_id:'u1',role:'student',display_name:'Zoe'}]; state.me={user_id:'u1'};
    state.profiles={u1:{gpa:'3.8',sat:'1400',major:'Computer Science<img src=x onerror="window.__xm=1">'}};
    const sel=state.catalog.find(c=>c.name==='Boston College'); const st=chanceExplain(sel).steps.find(s=>s.k==='Competitive major');
    const box=document.createElement('div'); document.body.appendChild(box); box.innerHTML=chanceMathHtml(sel); await new Promise(r=>setTimeout(r,500));
    return {stepPresent:!!st, codeRan:!!window.__xm, shownAsText:box.innerText.includes('<img')}; })));
  await ctx.close();
}
await b.close(); srv.close();
