import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':f.endsWith('.html')?'text/html':'text/javascript'}); r.end(d); }); }).listen(8921);
const b = await chromium.launch();
for (const W of [360, 390]) {
  const page = await b.newPage({ viewport: { width: W, height: 844 } });
  await page.goto('http://localhost:8921/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  for (const v of ['today','board','recommends','explore','compare','profile','cost','deadlines','trip','journey','pulse','sauce']) {
    await page.evaluate(v => { try { goto(v); } catch (e) {} }, v); await page.waitForTimeout(600);
    const bad = await page.evaluate(() => { const out = []; const root = document.querySelector('section:not(.hidden)') || document.body;
      root.querySelectorAll('*').forEach(el => { const cs = getComputedStyle(el); if (!el.offsetParent || !el.innerText) return;
        if (el.children.length === 0 || el.matches('b,span,em,button,a,label')) { if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis')) out.push((el.className || el.tagName) + ' | ' + el.innerText.slice(0, 40)); }
        const r = el.getBoundingClientRect(); if (r.right > innerWidth + 2 && r.width < innerWidth * 2 && r.width > 0) out.push('OFFSCREEN ' + (el.className || el.tagName) + ' | ' + el.innerText.slice(0, 30)); });
      return [...new Set(out)].slice(0, 12); });
    console.log(W, v, JSON.stringify(bad));
  }
}
process.exit(0);
