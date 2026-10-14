import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT='/home/claude/work/zoescolleges-app/';
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d)})}).listen(8991);
const b=await chromium.launch();const page=await b.newPage();
await page.goto('http://localhost:8991/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
const Q=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(Boolean);
for(const q of Q){ const a=await page.evaluate(q=>{const x=zoeAnswerPlain(q); return String(x||'')+" //SITE:"+String(zoeSite(q)||"null").slice(0,60)+" //SCH:"+zoeSchoolsInText(q.toLowerCase()).map(c=>c.name)},q);
 const kind=/I stick to|I can help with how the app works/.test(a)?'HANDOFF':'ANS'; console.log(kind+' | '+q+' => '+a.replace(/<[^>]+>/g,'').slice(0,100)+' ## '+a.split('//SITE:')[1].replace(/\n/g,' ')); }
await b.close();process.exit(0)
