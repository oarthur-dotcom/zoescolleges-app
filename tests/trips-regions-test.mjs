// #43 Trips split far-apart campuses into regional trips. Run: node tests/trips-regions-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f43/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8805);
const R = {}, ok = {};
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {});
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/router\.project-osrm\.org/, r => r.abort()); await page.route(/tile\.openstreetmap/, r => r.abort());
  await page.goto('http://localhost:8805/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(700);
  const setTrip = names => page.evaluate(n => { localStorage.clear(); for (const x of n) { const c = state.catalog.find(y => y.name === x); toggleTrip(c.id); } goto('trip'); }, names);
  const o = {};
  await setTrip(['Massachusetts Institute of Technology', 'Boston College', 'University of Vermont', 'College of Charleston', 'Clemson University']); await page.waitForTimeout(400);
  await page.click('#trip-build'); await page.waitForTimeout(800);
  o.chooser = await page.evaluate(() => [...document.querySelectorAll('.tr-reg')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  await page.screenshot({ path: `/tmp/claude-0/f43/${label}-regions.png` });
  await page.click('[data-plan-region="0"]'); await page.waitForTimeout(1500);
  o.region0 = await page.evaluate(() => ({ stops: tripBuilt.ordered.map(s => s.name), days: tripDays().length, maxLegMi: Math.max(...tripBuilt.legs.map(l => l.mi)) }));
  await page.click('#trip-build'); await page.waitForTimeout(600); await page.click('[data-plan-all]'); await page.waitForTimeout(1500);
  o.all = await page.evaluate(() => ({ stops: tripBuilt.ordered.length, days: tripDays().length }));
  await setTrip(['Massachusetts Institute of Technology', 'Boston College']); await page.waitForTimeout(300); await page.click('#trip-build'); await page.waitForTimeout(1200);
  o.oneRegion = await page.evaluate(() => ({ chooser: !!document.querySelector('.tr-reg'), stops: tripBuilt && tripBuilt.ordered.length }));
  o.audit = await audit(page, '#v-trip'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.twoRegions'] = o.chooser.length === 2 && /MA|VT/.test(o.chooser[0]) && /3 campuses/.test(o.chooser[0]) && /SC/.test(o.chooser[1]);
  ok[label + '.regionTripIsLocal'] = o.region0.stops.length === 3 && o.region0.maxLegMi < 300 && !o.region0.stops.some(n => /Charleston|Clemson/.test(n));
  ok[label + '.planAllStillPossible'] = o.all.stops === 5;
  ok[label + '.singleRegionNoChooser'] = !o.oneRegion.chooser && o.oneRegion.stops === 2;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./trips-regions-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
