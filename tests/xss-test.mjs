import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f7',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8777);
const b=await launch(); const out={};
const P=n=>`<img src=x onerror="window.__x${n}=1">`;
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8777/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(800);
  const r=await page.evaluate(async ()=>{
    const P=n=>`<img src=x onerror="window.__x${n}=1">`; const res={};
    const sid=state.members.find(m=>m.role==='student')||state.members[0]; const uid=(sid||state.me).user_id;
    state.members.forEach(m=>{ if(m.user_id===uid) m.role='student'; });
    state.profiles[uid]=Object.assign({},state.profiles[uid]||{}, {gpa:`3.8${P(2)}`, act:`30${P(3)}`, sat:'1400', major:`Computer Science${P(1)}`});
    const sel=state.catalog.find(c=>c.scorecard&&c.scorecard.admissionRate<0.5);
    const box=document.createElement('div'); document.body.appendChild(box);
    box.innerHTML=chanceMathHtml(sel); res.majorShownAsText=box.innerText.includes('<img');
    try{ renderReport(); }catch(e){ res.reportErr=String(e).slice(0,80); }
    try{ showTxPreview({gpa:`4.0${P(4)}`, apIb:5}); }catch(e){ res.txErr=String(e).slice(0,80); }
    try{ openBinderChat({title:'t', ts:Date.now(), msgs:[{who:'z',html:`<b>Bold kept</b>${P(5)}<a href="javascript:window.__x6=1">bad link</a><a href="https://example.org">good link</a><script>window.__x7=1<\/script>`}]}); }catch(e){ res.binderErr=String(e).slice(0,80); }
    await new Promise(r=>setTimeout(r,800));
    const lastLog=[...document.querySelectorAll('.bk-log')].pop();
    res.binderBoldKept=!!(lastLog&&lastLog.querySelector('b')); res.binderGoodLinkKept=!!(lastLog&&lastLog.querySelector('a[href^="https://"]')); res.binderJsLinkPresent=!!(lastLog&&lastLog.querySelector('a[href^="javascript"]'));
    res.injectedCodeRan={major:!!window.__x1, reportGpa:!!window.__x2, reportAct:!!window.__x3, transcript:!!window.__x4, binderImg:!!window.__x5};
    return res; });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f7/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
