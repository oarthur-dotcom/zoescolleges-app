// Net price by income: never negative, and a higher-income band never pays less than a lower one (Oct 14 regression finding).
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript'}); r.end(d); }); }).listen(8993);
const b = await chromium.launch(); const page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push('' + e));
await page.goto('http://localhost:8993/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0 && state.incomePrices, null, { timeout: 60000 }); await page.waitForTimeout(500);
const R = await page.evaluate(() => { let rows=0, neg=0, nonMono=0, negAvg=0; const ids=Object.keys(state.incomePrices);
  for (const id of ids) { const row=state.incomePrices[id]; rows++; let prev=-1; for (let b=0;b<row.length;b++){ const v=bandNet(row,b); if(v==null) continue; if(v<0) neg++; if(v<prev) nonMono++; prev=v; } }
  for (const c of state.catalog) { const a=avgNet(c); if(a!=null && a<0) negAvg++; }
  return { rows, neg, nonMono, negAvg }; });
console.log(JSON.stringify(R), errs); console.log(R.rows>2000 && !R.neg && !R.nonMono && !R.negAvg && !errs.length ? 'PASS' : 'FAILED'); await b.close(); process.exit(0);
