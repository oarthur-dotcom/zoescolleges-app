// #53 Aid from the school (IPEDS institutional grants). Run: node tests/school-aid-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f53/site', SHOTS = '/tmp/claude-0/f53/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), AID = fs.readFileSync('/tmp/claude-0/school-aid.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8815);
const R = {}, ok = {};
for (const [label, vp, dark, missing] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true], ['file-not-published', { width: 390, height: 844 }, false, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*school-aid\.json/, r => missing ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'application/json', body: AID }));
  await page.goto('http://localhost:8815/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(900);
  const o = {};
  await page.evaluate(() => openDetail('sc-217882')); await page.waitForTimeout(600);
  o.detail = await page.evaluate(() => { const s = document.querySelector('#v-detail .aid-box'); return s ? s.innerText.replace(/\s+/g, ' ') : null; });
  await page.evaluate(() => goto('cost')); await page.waitForTimeout(500);
  o.costLines = await page.evaluate(() => [...document.querySelectorAll('.cost-aid')].map(x => x.textContent));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  if (!missing) {
    ok[label + '.schoolPage'] = /Aid from the school · Common/i.test(o.detail || '') && /53%/.test(o.detail) && /\$7,127/.test(o.detail) && /need-based and merit/.test(o.detail);
    ok[label + '.costsPage'] = o.costLines.length >= 5 && o.costLines.some(t => /53% get school grants · avg \$7,127/.test(t));
  } else ok[label + '.hiddenUntilPublished'] = o.detail === null && o.costLines.length === 0;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./school-aid-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
