// Oct 25: the school's own Common Data Set GPA must actually reach the scoring (it used to be looked up on an object with no id), and a WEIGHTED average (> 4.0) must not be used.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8936);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); const page = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8936/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const ids = Object.keys(CDS_UNWEIGHTED); const allIds = Object.keys(CDS_GPA); const out = { found: 0, used: 0, weighted: [], weightedIgnored: 0, bad: [], total: ids.length };
  for (const id of ids) { const c = state.catalog.find(x => x.id === id); if (!c) continue; out.found++;
    const t = typicalGpa(c.scorecard), v = CDS_GPA[id];
    if (v > 4.0) { out.weighted.push(id); if (t !== v) out.weightedIgnored++; if (t === v) out.bad.push(id + ' weighted used'); }
    else if (t === v) out.used++; else out.bad.push(id + ' ' + v + ' vs ' + t); }
  const w=allIds.filter(id=>!(id in CDS_UNWEIGHTED)); out.others=w.length; out.othersUsed=w.filter(id=>{ const c=state.catalog.find(x=>x.id===id); return c && gpaFromCds(c.scorecard)!=null; }).length; return out; });
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
ok(r.found === r.total && r.total === 3, 'the 3 unweighted CDS schools are in the catalog ' + r.found + '/' + r.total);
ok(r.used === r.total, 'unweighted CDS averages reach scoring: ' + r.used + ' of ' + r.total);
ok(r.others === 26 && r.othersUsed === 0, 'the other 26 (weighted or unstated) are NOT used: ' + r.othersUsed);
ok(r.bad.length === 0, 'mismatch ' + r.bad.join('|')); ok(errs.length === 0, 'no page errors ' + errs.join('|'));
console.log(`cds-gpa-wired ${pass} pass, ${fail} fail`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
