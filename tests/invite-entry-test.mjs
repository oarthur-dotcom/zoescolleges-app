// #78: inviting family is obvious — header (desktop), More sheet (phone), Family tabs — all open the invite dialog.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f78i/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8952);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.goto('http://localhost:8952/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me && state.family, null, { timeout: 60000 }); await page.waitForTimeout(500);
  const o = {}; const isOpen = () => page.evaluate(() => document.getElementById('dlg-invite').open); const close = () => page.evaluate(() => document.getElementById('dlg-invite').close());
  if (vp.width > 900) { await page.click('#appnav [data-invite]'); await page.waitForTimeout(200); o.header = await isOpen(); o.viewAfter = await page.evaluate(() => currentView); await close(); }
  else { await page.click('[data-tb-more]'); await page.waitForTimeout(200); await page.click('#tb-sheet [data-invite]'); await page.waitForTimeout(200); o.sheet = await isOpen(); o.sheetClosed = await page.evaluate(() => document.getElementById('tb-sheet').classList.contains('hidden')); await close(); }
  await page.evaluate(() => gotoGroup('family')); await page.waitForTimeout(300); await page.click('#subnav [data-invite]'); await page.waitForTimeout(200); o.family = await isOpen(); await close();
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.oneTapInvite'] = vp.width > 900 ? (o.header && o.viewAfter === 'today') : (o.sheet && o.sheetClosed);
  ok[label + '.familyTabInvite'] = o.family;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./invite-entry-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
