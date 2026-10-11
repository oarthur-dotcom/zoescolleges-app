// #57 Design polish pass. Run: node tests/polish-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f57/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8821);
const VIEWS = ['today', 'board', 'explore', 'cost', 'deadlines', 'pulse', 'trip', 'memories', 'profile', 'zoe', 'compare', 'recommends'];
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8821/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = { small: {}, ox: {} };
  for (const v of VIEWS) { await page.evaluate(v => goto(v), v); await page.waitForTimeout(500); const a = await audit(page, 'body'); o.small[v] = a.small.filter(s => /^(button|#)|small/i.test(s) || /\d+x(2\d|3[0-3])$/.test(s)).length; o.ox[v] = a.overflowX; }
  await page.evaluate(() => goto('zoe')); await page.waitForTimeout(300);
  o.zoeHead = await page.evaluate(() => { const h = document.querySelector('.ztab-intro'); return Math.round(h.getBoundingClientRect().width); });
  await page.evaluate(() => goto('compare')); await page.waitForTimeout(300);
  o.cmp = await page.evaluate(() => { const l = document.querySelector('.trip-pick'); return l ? { tt: getComputedStyle(l).textTransform, h: Math.round(l.getBoundingClientRect().height) } : null; });
  await page.evaluate(() => goto('deadlines')); await page.waitForTimeout(300);
  o.dl = await page.evaluate(() => { const d = document.querySelector('.dl-summary .dl-due'); const c = d.closest('.card'); const m = document.querySelector('#v-deadlines .tp-city'); return { inside: d.getBoundingClientRect().right <= c.getBoundingClientRect().right + 0.5, metaFs: m ? getComputedStyle(m).fontSize : '' }; });
  await page.evaluate(() => goto('memories')); await page.waitForTimeout(300);
  o.mem = await page.evaluate(() => { const h = document.querySelector('.mem-hero>div'); return Math.round(h.getBoundingClientRect().width); });
  await page.evaluate(() => goto('explore')); await page.waitForTimeout(300);
  o.ex = await page.evaluate(() => ({ btn: getComputedStyle(document.querySelector('#ex-filters-btn')).display, more: getComputedStyle(document.querySelector('#ex-more-filters')).display }));
  if (label !== 'desktop') { await page.click('#ex-filters-btn'); await page.selectOption('#ex-relig', 'secular'); await page.waitForTimeout(400);
    o.exOpen = await page.evaluate(() => ({ more: getComputedStyle(document.querySelector('#ex-more-filters')).display, label: document.querySelector('#ex-filters-btn').textContent, exp: document.querySelector('#ex-filters-btn').getAttribute('aria-expanded'), count: document.querySelector('#excount').textContent })); }
  o.errors = log.pageerr; R[label] = o; await b.close();
  const phone = label !== 'desktop';
  ok[label + '.noSidewaysScroll'] = Object.values(o.ox).every(x => !x);
  ok[label + '.askZoeHeaderReadable'] = o.zoeHead >= 220;
  ok[label + '.compareNamesNormalCase'] = o.cmp && o.cmp.tt === 'none' && o.cmp.h >= 44;
  ok[label + '.deadlinePillFits'] = o.dl.inside && o.dl.metaFs === '13px';
  ok[label + '.memoriesHeader'] = phone ? o.mem >= 340 : o.mem >= 300;
  ok[label + '.exploreFilters'] = phone ? (o.ex.btn !== 'none' && o.ex.more === 'none' && o.exOpen.more === 'flex' && /Fewer filters \(1 on\)/.test(o.exOpen.label) && o.exOpen.exp === 'true') : (o.ex.btn === 'none' && o.ex.more === 'flex');
  ok[label + '.tapTargets'] = phone ? Object.values(o.small).reduce((a, b) => a + b, 0) <= 20 : true;
  ok[label + '.noErrors'] = !o.errors.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass, JSON.stringify(R.phone.small));
fs.writeFileSync(new URL('./polish-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
