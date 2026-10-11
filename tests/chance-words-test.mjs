import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f19/site',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8792);
const b=await launch(); const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
await page.route(/net-price-by-income/,r=>r.fulfill({status:404,body:''}));
await page.goto('http://localhost:8792/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(800);
const r=await page.evaluate(()=>{
  const P={top:{gpa:"4.0",sat:"1580",activities:[{tier:1,yrs:4,hrs:10},{tier:1,yrs:4,hrs:10},{tier:2,yrs:3,hrs:5}]}, mid:{gpa:"3.4",sat:"1250"}, low:{gpa:"2.6",sat:"1000"}, testOpt:{gpa:"3.95",testOptional:true}, none:{}};
  const saved={m:state.members, me:state.me, p:state.profiles};
  state.members=[{user_id:'u1',role:'student',display_name:'Zoe'}]; state.me={...state.me,user_id:'u1'};
  const out={}; let mismatch=0, empty=0, total=0, maxLen=0;
  for(const [k,prof] of Object.entries(P)){ state.profiles={u1:prof}; out[k]={};
    for(const c of state.catalog){ const ch=chanceFor(c); if(!ch) continue; total++; const w=chanceWords(c); if(!w) empty++; else { maxLen=Math.max(maxLen,w.length); if(!w.startsWith(ch.label+":")) mismatch++; } }
    for(const n of ['Harvard University','College of Charleston','Clemson University','University of Vermont','Boston University']){ const c=state.catalog.find(x=>x.name===n); out[k][n]=chanceWords(c); } }
  state.members=saved.m; state.me=saved.me; state.profiles=saved.p;
  return {checked:total, wordsDisagreeWithBadge:mismatch, emptyLines:empty, longestLine:maxLen, examples:out};
});
await page.evaluate(()=>goto('board')); await page.waitForTimeout(700);
r.boardCardsWithLine = await page.evaluate(()=>[...document.querySelectorAll('#schools .school')].filter(c=>c.querySelector('.chance-words')).length+' of '+document.querySelectorAll('#schools .school').length);
await page.locator('#schools .school').first().screenshot({path:'/tmp/claude-0/f19/board-card.png'});
await page.click('[data-nav="recommends"]'); await page.waitForTimeout(900);
r.picksWithLine = await page.evaluate(()=>[...document.querySelectorAll('.rec-card')].filter(c=>c.querySelector('.chance-words')).length+' of '+document.querySelectorAll('.rec-card').length);
r.overflowX = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
await page.locator('.rec-card').first().screenshot({path:'/tmp/claude-0/f19/pick-card.png'});
r.pageErrors=log.pageerr; console.log(JSON.stringify(r,null,1)); fs.writeFileSync('/tmp/claude-0/f19/result.json',JSON.stringify(r,null,1)); await b.close(); srv.close();
