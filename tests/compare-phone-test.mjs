// #42 Compare on phones: card-per-measure layout, no sideways scroll; desktop table unchanged. Run: node tests/compare-phone-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f42/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8804);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['small-phone', { width: 360, height: 740 }], ['phone-dark', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.goto('http://localhost:8804/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.evaluate(() => goto('compare')); await page.waitForTimeout(500);
  const boxes = await page.$$('#v-compare input[type=checkbox]'); for (const x of boxes.slice(0, 4)) await x.click(); await page.click('#cmp-build'); await page.waitForTimeout(700);
  const o = await page.evaluate(() => { const vis = el => el && getComputedStyle(el).display !== 'none';
    return { cardsVisible: vis(document.querySelector('.cxm')), tableVisible: vis(document.querySelector('.cx-card')), rows: document.querySelectorAll('.cxm-row').length,
      valsPerRow: [...document.querySelectorAll('.cxm-row')].map(r => r.querySelectorAll('.cxm-v').length), legend: [...document.querySelectorAll('.cxm-leg')].map(x => x.textContent),
      starsMatch: [...document.querySelectorAll('.cxm-row')].every((r, i) => { const t = [...document.querySelectorAll('.cx-grid .cx-cell')].filter(c => c.classList.contains('best')).length; return true; }),
      bestCountSame: document.querySelectorAll('.cxm-v.best').length === document.querySelectorAll('.cx-cell.best').length }; });
  if (vp.width <= 640) { const el = await page.$('.cxm'); if (el) await el.scrollIntoViewIfNeeded(); }
  await page.screenshot({ path: `/tmp/claude-0/f42/${label}.png` });
  o.audit = await audit(page, '#v-compare'); o.errors = log.pageerr; R[label] = o; await b.close();
  if (vp.width <= 640) { ok[label + '.cardLayout'] = o.cardsVisible && !o.tableVisible && o.rows >= 8 && o.valsPerRow.every(n => n === 4) && o.legend.length === 4; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX && !o.audit.wide.length; }
  else ok[label + '.tableUnchanged'] = o.tableVisible && !o.cardsVisible;
  ok[label + '.sameWinners'] = o.bestCountSame; ok[label + '.noBadText'] = !o.audit.bad.length; ok[label + '.noErrors'] = !o.errors.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./compare-phone-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
