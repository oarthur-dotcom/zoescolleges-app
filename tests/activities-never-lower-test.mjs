// Listing activities never lowers a chance band or Admit Power compared with listing none; order of activities does not matter (Oct 23).
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8935);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); const page = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8935/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
const r=await page.evaluate(()=>{
  const T=ACT_TYPES; const f=rx=>T.find(t=>rx.test(t));
  const weak={category:"Other Club/Activity",position:"Member / participant",tier:4,hrs:2,weeks:4,grades:[12]};
  const strong=[{category:f(/JV\/Varsity/),sport:"Soccer",position:"Captain",tier:3,hrs:18,weeks:20,grades:[9,10,11,12]},{category:"Other Club/Activity",position:"Founder",tier:1,hrs:13,weeks:30,grades:[10,11,12]},{category:"Work (Paid)",position:"Manager",tier:3,hrs:25,weeks:20,grades:[10,11,12]}];
  const out={};
  for(const g of ['3.0','3.21','3.5','3.8']){
    const bands=acts=>{ const p={gpa:g,testOptional:true,rigor:{honors:9,grade:12},activities:acts}; const o=studentProfile; studentProfile=()=>p; const m={}; (state.catalog||[]).forEach(c=>{ if(c.scorecard&&typeof c.scorecard.admissionRate==='number'){ const ch=chanceFor(c); if(ch) m[c.unitid||c.id]=ch.band; } }); studentProfile=o; return m; };
    const rank={reach:0,target:1,likely:2}; const n0=bands([]), w=bands([weak]), st=bands(strong);
    const cmp=(a,b)=>{ let up=0,down=0; for(const k in a){ if(rank[b[k]]>rank[a[k]]) up++; else if(rank[b[k]]<rank[a[k]]) down++; } return {up,down}; };
    out['gpa'+g]={none_to_weak:cmp(n0,w), none_to_strong:cmp(n0,st), weak_to_strong:cmp(w,st), n:Object.keys(n0).length};
  }
  
  const A={ weak, strong0:strong[0], strong1:strong[1], strong2:strong[2] };
  const meter=acts=>{ const p={gpa:'3.21',testOptional:true,rigor:{honors:9,grade:12},activities:acts}; const o=studentProfile; studentProfile=()=>p; const m=apMeterData(p).total; studentProfile=o; return m; };
  out.meterNone=meter([]); out.meterWeak=meter([weak]); out.meterStrong=meter(strong);
  const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[x,...p]));
  out.orderVariants=new Set(perms([weak,...strong]).map(p=>meter(p))).size;
  return out;});
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
for (const g of Object.keys(r)) { if (!g.startsWith('gpa')) continue; ok(r[g].none_to_weak.down === 0, g + ' a weak activity lowered ' + r[g].none_to_weak.down + ' schools'); ok(r[g].none_to_strong.down === 0, g + ' strong lowered some'); ok(r[g].none_to_strong.up > 0, g + ' strong lifts some'); }
ok(r.meterWeak >= r.meterNone, 'Admit Power with a weak activity ' + r.meterWeak + ' vs none ' + r.meterNone); ok(r.meterStrong >= r.meterWeak, 'strong >= weak'); ok(r.orderVariants === 1, 'order independent: ' + r.orderVariants);
ok(errs.length === 0, 'no page errors ' + errs.join('|')); console.log(`activities-never-lower ${pass} pass, ${fail} fail`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
