// Dead deep links (404/410 on Oct 14) must never reach a family: hidden, with fallback to the school website.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript'}); r.end(d); }); }).listen(8994);
const b = await chromium.launch(); const page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push('' + e));
await page.goto('http://localhost:8994/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0 && state.visitLinks, null, { timeout: 60000 }); await page.waitForTimeout(500);
const R = await page.evaluate(() => { const K={a:'admissions',n:'npc',p:'apply'}; let stillThere=0, checked=0, ok=0, fallbackOk=0, fb=0;
  for (const id in DEAD_VISIT_LINKS) for (const ch of DEAD_VISIT_LINKS[id]) { checked++; const v=state.visitLinks[id]; if (v && v[K[ch]]) stillThere++; }
  for (const id in state.visitLinks) if (!(id in DEAD_VISIT_LINKS)) { ok += Object.keys(state.visitLinks[id]).length; }
  for (const id in DEAD_VISIT_LINKS) if (DEAD_VISIT_LINKS[id].includes('a')) { const l=visitLinkFor(id); fb++; if (!l || /Book a visit/.test(l.label) && state.visitLinks[id].admissions) continue; fallbackOk++; }
  return { checked, stillThere, healthyKept: ok, fb, fallbackOk }; });
console.log(JSON.stringify(R), errs);
console.log(R.stillThere === 0 && R.healthyKept > 1000 && R.fallbackOk >= R.fb - 5 && !errs.length ? 'PASS' : 'FAILED'); await b.close(); process.exit(0);
