// CSP report-only check: serve the page WITH the new header and walk the main screens; collect "would block" reports.
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE='/tmp/claude-0/f28/site'; fs.mkdirSync(SITE,{recursive:true}); fs.copyFileSync('/home/claude/zoescolleges-app/index.html',SITE+'/index.html');
const CSP=fs.readFileSync('/tmp/claude-0/csp.txt','utf8');
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join(SITE,decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy-Report-Only':CSP}); r.end(d);});}).listen(8798);
const b=await launch(); const out={};
for (const [w,h] of [[390,844],[1440,900]]){
  const {page,log}=await newPage(b,{width:w,height:h},{plan:'family'}); const reports=[];
  page.on('console',m=>{ const t=m.text(); if(/Content Security Policy|Report Only|violates/i.test(t)) reports.push(t.slice(0,220)); });
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.route(/net-price-by-income|deadlines-2026|campus-feeds/,r=>r.fulfill({status:404,body:''}));
  await page.goto('http://localhost:8798/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(1500);
  for (const v of ['explore','recommends','compare','trip','deadlines','zoe','profile','board']) { await page.evaluate(v=>{ try{ goto(v); }catch(e){} },v); await page.waitForTimeout(700); }
  await page.evaluate(()=>{ const c=state.catalog.find(x=>x.name==='Massachusetts Institute of Technology'); openDetail(c.id); }); await page.waitForTimeout(1500);
  await page.evaluate(()=>fetch('https://example.org/csp-sanity').catch(()=>{})); await page.waitForTimeout(800);
  out[w]={reports:[...new Set(reports)], errors:log.pageerr};
}
console.log(JSON.stringify(out,null,1)); await b.close(); srv.close();
