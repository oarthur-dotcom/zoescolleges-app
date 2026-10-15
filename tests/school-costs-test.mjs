// Price board: verified school price (year, basis, source link) replaces the federal estimate; schools with no row keep the labelled estimate; bad rows ignored; out-of-state column used; migration missing degrades.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8962);
const b = await chromium.launch(); const R = {}; let fail = 0; const ok = (n, v) => { R[n] = v; if (!v) { fail++; console.log('FAIL', n); } }; const errs = [];
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 900 } }); page.on('pageerror', e => errs.push(String(e))); const t = n => W + ':' + n;
  await page.goto('http://localhost:8962/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0 && state.costs, null, { timeout: 60000 });
  const n = await page.evaluate(() => Object.keys(state.costs).length); ok(t('seedLoaded102'), n === 102);
  const A = await page.evaluate(() => { const i = state.catalog.find(c => c.id === 'university-of-colorado-boulder'); const prev = i.scorecard.costAvg; homeState = () => 'CO'; const inS = costFor(i); homeState = () => 'TX'; const outS = costFor(i); homeState = () => 'CO'; return { inV: inS && inS.v, outV: outS && outS.v, stickerIn: stickerPrice(i), prev }; });
  ok(t('inStateColumn'), A.inV === 39992 && A.stickerIn === 39992); ok(t('outOfStateColumn'), A.outV === 71784);
  const P = await page.evaluate(() => { const i = state.catalog.find(c => c.id === 'syracuse-university'); homeState = () => 'TX'; const a = costFor(i); homeState = () => 'NY'; const b2 = costFor(i); return [a.v, b2.v]; });
  ok(t('privateSamePrice'), P[0] === 95676 && P[1] === 95676);
  const G = await page.evaluate(() => { const i = state.catalog.find(c => c.id === 'sc-139940'); homeState = () => 'GA'; return costFor(i).v; }); ok(t('cents'), G === 34550);
  const X = await page.evaluate(() => { const i = state.catalog.find(c => c.id === 'sc-110592'); homeState = () => 'CA'; const inS = costFor(i) && costFor(i).v; homeState = () => 'TX'; const outS = costFor(i); homeState = () => 'CO'; return [inS, outS]; });
  ok(t('noPrintedOutOfStateTotalKeepsEstimate'), X[0] === 38500 && X[1] === null);
  // detail page shows verified note with a link, unverified shows estimate label
  await page.evaluate(() => { homeState = () => 'CO'; openDetail('university-of-colorado-boulder', 'board'); }); await page.waitForTimeout(600);
  const D = await page.evaluate(() => { const c = [...document.querySelectorAll('#v-detail .d-cell')].find(x => /Sticker cost/.test(x.textContent)); const a = c && c.querySelector('.cost-src a'); return { has: !!c, money: c && /39,992/.test(c.textContent), year: c && /2026-27/.test(c.textContent), link: a && a.href, rel: a && a.rel, hz: document.documentElement.scrollWidth <= innerWidth + 2 }; });
  ok(t('detailShowsVerified'), D.has && D.money && D.year && /colorado\.edu/.test(D.link || '') && /noopener/.test(D.rel || '')); ok(t('noHScrollDetail'), D.hz);
  await page.evaluate(() => { openDetail('sc-110592', 'board'); }); await page.waitForTimeout(600);
  const E = await page.evaluate(() => { const c = [...document.querySelectorAll('#v-detail .d-cell')].find(x => /Sticker cost/.test(x.textContent)); return c && /federal estimate/.test(c.textContent) && !c.querySelector('.cost-src a'); });
  ok(t('unverifiedLabelledEstimate'), !!E);
  // bad rows ignored
  const bad = await page.evaluate(() => [costOk({ school_id: 'x', academic_year: '2026-27', source_url: 'http://a.edu', in_state: { total: 30000 } }), costOk({ school_id: 'x', academic_year: '26', source_url: 'https://a.edu', in_state: { total: 30000 } }), costOk({ school_id: 'x', academic_year: '2026-27', source_url: 'https://a.edu', in_state: { total: 90 } }), costOk({ school_id: 'x', academic_year: '2026-27', source_url: 'https://a.edu', in_state: { total: 30000 } })]);
  ok(t('badRowsIgnored'), bad.join() === 'false,false,false,true');
  // net never above sticker
  const N = await page.evaluate(() => { const i = state.catalog.find(c => c.id === 'sc-153603'); homeState = () => 'IA'; i.scorecard.netPrice = 99000; const v = avgNet(i); return v <= stickerPrice(i); }); ok(t('netCappedAtSticker'), N);
  // migration missing: table error -> falls back silently
  const F = await page.evaluate(async () => { DEMO = false; const real = sb; sb = { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'relation "school_costs" does not exist', code: '42P01' } }) }) }; await loadCosts(); const r = { flag: BACKEND.costs, n: Object.keys(state.costs).length, price: stickerPrice(state.catalog.find(c => c.id === 'sc-153603')) }; sb = real; DEMO = true; BACKEND.costs = true; return r; });
  ok(t('missingTableFallsBack'), F.flag === false && F.n === 0 && typeof F.price === 'number');
  await page.screenshot({ path: `/tmp/claude-0/costs-${W}.png` });
}
console.log(fail ? 'FAILED' : 'PASS', JSON.stringify(R), 'pageerrors:', errs.length, errs.slice(0, 2)); await b.close(); process.exit(fail ? 1 : 0);
