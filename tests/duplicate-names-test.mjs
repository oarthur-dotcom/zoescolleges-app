// No two schools in the catalog share a displayed name (Oct 14), and a typed duplicate name finds every school.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript'}); r.end(d); }); }).listen(8992);
const b = await chromium.launch(); const page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push('' + e));
await page.goto('http://localhost:8992/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(500);
const R = await page.evaluate(() => { const seen={}; let dups=0; for (const c of state.catalog) { if (seen[c.name]) dups++; seen[c.name]=1; }
  const labeled=state.catalog.filter(c=>c.nameRaw); const raws={}; labeled.forEach(c=>raws[c.nameRaw]=(raws[c.nameRaw]||0)+1);
  const q=Object.keys(raws)[0]; const found=(searchCatalog(q)||[]).filter(h=>h.c.nameRaw===q).length;
  return { dups, labeled: labeled.length, example: labeled[0] && labeled[0].name, query:q, expect:raws[q], found }; });
console.log(JSON.stringify(R), errs); console.log(R.dups===0 && R.labeled>=14 && R.found===R.expect && !errs.length ? 'PASS' : 'FAILED'); await b.close(); process.exit(0);
