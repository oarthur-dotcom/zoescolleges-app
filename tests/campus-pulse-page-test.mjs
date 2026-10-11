import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f20/site',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8793);
const b=await launch(); const {ctx,page,log}=await newPage(b,{width:390,height:844},{plan:'family'});
await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
await page.route(/net-price-by-income/,r=>r.fulfill({status:404,body:''}));
let auth=null;
await page.route('**/.netlify/functions/campus-pulse*', r=>{ auth=r.request().headers()['authorization']||null; const id=new URL(r.request().url()).searchParams.get('id');
  if(id==='college-of-charleston') return r.fulfill({contentType:'application/json',body:JSON.stringify({source:'charleston.edu',items:[
    {title:"CofC breaks ground on new science center",link:"https://charleston.edu/news/a",date:new Date(Date.now()-2*864e5).toISOString()},
    {title:"Homecoming weekend: what to know",link:"https://charleston.edu/news/b",date:new Date(Date.now()-6*864e5).toISOString()},
    {title:"Cougars sailing team wins regatta",link:"https://charleston.edu/news/c",date:new Date(Date.now()-40*864e5).toISOString()}]})});
  return r.fulfill({contentType:'application/json',body:JSON.stringify({items:[],reason:'no-feed'})}); });
await page.goto('http://localhost:8793/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(800);
const r={};
r.cardButton = await page.evaluate(()=>{ const c=[...document.querySelectorAll('#schools .school')].find(x=>x.innerText.includes('College of Charleston')); const a=c&&c.querySelector('[data-pulse-open]'); return a?a.textContent:null; });
await page.evaluate(()=>{ const c=[...document.querySelectorAll('#schools .school')].find(x=>x.innerText.includes('College of Charleston')); c.querySelector('[data-pulse-open]').click(); });
await page.waitForTimeout(1500);
r.openedDetail = await page.evaluate(()=>!document.getElementById('v-detail').classList.contains('hidden'));
r.pulseInView = await page.evaluate(()=>{ const el=document.getElementById('pulse'); const rc=el.getBoundingClientRect(); return rc.top<innerHeight && rc.bottom>0; });
r.headlines = await page.evaluate(()=>[...document.querySelectorAll('.pulse-item')].map(x=>x.innerText.replace(/\s+/g,' ')));
r.studentLinks = await page.evaluate(()=>[...document.querySelectorAll('.pulse-links a')].map(a=>a.textContent.trim()));
r.loginTokenSent = auth;
r.nicheAnywhere = await page.evaluate(()=>/niche/i.test(document.documentElement.innerHTML));
await page.locator('#pulse').screenshot({path:'/tmp/claude-0/f20/pulse-cofc.png'});
const other=await page.evaluate(()=>{ const c=state.catalog.find(x=>x.name==='Clemson University'); openDetail(c.id); return c.id; }); await page.waitForTimeout(800);
r.noFeedMessage = await page.evaluate(()=>document.querySelector('[data-pulse-news]').innerText.trim());
r.overflowX = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
r.pageErrors=log.pageerr; console.log(JSON.stringify(r,null,1)); fs.writeFileSync('/tmp/claude-0/f20/page-result.json',JSON.stringify(r,null,1)); await b.close(); srv.close();
