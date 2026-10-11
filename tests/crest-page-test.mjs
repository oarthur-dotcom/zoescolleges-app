// #39 crest for schools without a photo — page test. Run: node tests/crest-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f39/site', SHOTS = '/tmp/claude-0/f39/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = JSON.parse(fs.readFileSync('/tmp/claude-0/f35-colleges.json'));
for (const c of CAT.colleges) if (['sc-155335', 'sc-237950', 'university-of-vermont'].includes(c.id)) delete c.photo;   // make sure some board schools have no photo
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8799);
const R = {}, ok = {};
for (const [label, vp, dark] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(CAT) }));
  await page.goto('http://localhost:8799/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(900);
  const o = {};
  await page.evaluate(() => { const t = document.getElementById('view-tiles'); if (t) t.click(); }); await page.waitForTimeout(400);
  o.tileCrests = await page.evaluate(() => [...document.querySelectorAll('#schools .cover.cover-ph')].map(c => /data:image\/svg\+xml/.test(c.getAttribute('style')) ));
  o.crestImagesDecode = await page.evaluate(async () => { const m = [...document.querySelectorAll('#schools .cover.cover-ph')].map(c => (c.getAttribute('style').match(/url\('([^']+)'\)/) || [])[1]).filter(Boolean);
    const res = await Promise.all(m.map(u => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = u; }))); return res; });
  o.initials = await page.evaluate(() => [crestInitials('Roxbury Community College'), crestInitials('University of Vermont'), crestInitials("Saint Mary's College of California"), crestInitials('Texas A & M University-Commerce')]);
  await page.locator('#schools').screenshot({ path: `${SHOTS}${label}-board-tiles.png` });
  await page.evaluate(() => goto('explore')); await page.fill('#exsearch', 'Newman University'); await page.waitForTimeout(900);
  o.exploreThumbs = await page.evaluate(() => [...document.querySelectorAll('#v-explore .srow-thumb.ph')].slice(0, 5).map(t => /data:image\/svg/.test(t.getAttribute('style')) && !t.textContent.trim()));
  await page.screenshot({ path: `${SHOTS}${label}-explore.png` });
  o.audit = await audit(page, '#v-explore'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.tileCrests'] = o.tileCrests.length >= 3 && o.tileCrests.every(Boolean);
  ok[label + '.crestsRender'] = o.crestImagesDecode.length >= 3 && o.crestImagesDecode.every(Boolean);
  ok[label + '.initials'] = JSON.stringify(o.initials) === '["RCC","UV","SMC","TAM"]';
  ok[label + '.exploreThumbs'] = o.exploreThumbs.length > 0 && o.exploreThumbs.every(Boolean);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./crest-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
