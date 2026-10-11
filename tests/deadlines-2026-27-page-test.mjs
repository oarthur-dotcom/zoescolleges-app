// 2026–27 deadlines — page test (headless browser, fake backend). Run: node tests/deadlines-2026-27-page-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f24/site'; fs.mkdirSync(SITE, { recursive: true });
fs.copyFileSync('/home/claude/zoescolleges-app/index.html', SITE + '/index.html');
const CAT = fs.readFileSync('/home/claude/zoescolleges-data/colleges.json'); const DLF = fs.readFileSync('/tmp/claude-0/dl/deadlines-2026-27.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(d); }); }).listen(8795);
const R = {}, ok = {};
async function run(withFile, vp) {
  const b = await launch(); const { page, log } = await newPage(b, vp, { plan: 'family' });
  await page.addInitScript(() => { const T = new Date('2026-10-11T15:00:00Z').getTime(); const D = Date; class FD extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } } window.Date = FD; });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/net-price-by-income/, r => r.fulfill({ status: 404, body: '' }));
  await page.route(/deadlines-2026-27\.json/, r => withFile ? r.fulfill({ contentType: 'application/json', body: DLF }) : r.fulfill({ status: 404, body: '' }));
  await page.goto('http://localhost:8795/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const o = {};
  await page.evaluate(() => { const c = state.catalog.find(x => x.name === 'Clemson University'); openDetail(c.id); }); await page.waitForTimeout(500);
  o.clemsonDetail = await page.evaluate(() => { const el = document.querySelector('.dl27'); return el ? el.innerText.replace(/\s+/g, ' ') : document.querySelector('#detail-body').innerText.match(/Early deadline[^\n]*\n?[^\n]*/)?.[0] || null; });
  if (withFile) await page.locator('.dl27').screenshot({ path: '/tmp/claude-0/f24/clemson-deadlines.png' });
  await page.evaluate(() => goto('deadlines')); await page.waitForTimeout(600);
  o.tracker = await page.evaluate(() => [...document.querySelectorAll('#dl-out .dl-row')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 170)));
  o.sourceLinks = await page.evaluate(() => document.querySelectorAll('#dl-out .dl-src a').length);
  o.summary = await page.evaluate(() => document.querySelector('.dl-summary').innerText.replace(/\s+/g, ' '));
  if (withFile) await page.screenshot({ path: '/tmp/claude-0/f24/tracker.png', fullPage: false });
  o.compareCell = await page.evaluate(() => { const c = state.catalog.find(x => x.name === 'Massachusetts Institute of Technology'); return nextDlText(c); });
  o.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  o.errors = log.pageerr; await b.close(); return o;
}
R.withFile = await run(true, { width: 390, height: 844 });
R.withFileDesktop = await run(true, { width: 1440, height: 900 });
R.noFile = await run(false, { width: 390, height: 844 });
const W = R.withFile;
ok.detailShowsRoundsAndSource = /Application deadlines 2026–27/.test(W.clemsonDetail) && /Early Action/.test(W.clemsonDetail) && /Oct 15, 2026/.test(W.clemsonDetail) && /in 4 days/.test(W.clemsonDetail) && /see the source/.test(W.clemsonDetail);
ok.trackerMitDated = W.tracker.some(t => /Massachusetts Institute of Technology/.test(t) && /Early Action · in 21 days/.test(t));
ok.trackerSoonestClemson = /Next: Clemson University Early Action · in 4 days/.test(W.summary);
ok.trackerSourceLinks = W.sourceLinks >= 4;
ok.compareNextDeadline = W.compareCell === 'Early Action · Nov 1, 2026';
ok.noFileFallsBackToOldDates = !/Application deadlines 2026–27/.test(R.noFile.clemsonDetail || '') && R.noFile.tracker.some(t => /Clemson University/.test(t) && /in 4 days/.test(t)) && !R.noFile.tracker.some(t => /Massachusetts Institute of Technology/.test(t) && /in 21 days/.test(t));
for (const k of ['withFile', 'withFileDesktop', 'noFile']) { ok[k + ':noErrors'] = !R[k].errors.length; ok[k + ':noOverflow'] = !R[k].overflowX; }
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1)); fs.writeFileSync('/home/claude/zoescolleges-app/tests/deadlines-2026-27-page-result-2026-10-11.json', JSON.stringify(R, null, 1)); srv.close();
