// #51 "Where you stand" bars. Run: node tests/stand-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f51/site', SHOTS = '/tmp/claude-0/f51/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8813);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.goto('http://localhost:8813/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(700);
  const o = {};
  // fake profile has SAT 1300
  o.math = await page.evaluate(() => { const one = (id, prof) => { const K = (studentMember() || state.me).user_id; /* #65: the STUDENT's profile counts, never the parent's */ const save = state.profiles[K]; state.profiles[K] = { ...save, ...prof }; const h = standBarHtml(catInfo(id), false); state.profiles[K] = save; const d = document.createElement('div'); d.innerHTML = h; return d.innerText.replace(/\s+/g, ' ').slice(0, 180); };
    return { clemson1300: one('sc-217882', { sat: '1300', act: '' }), mit1300: one('sc-166683', { sat: '1300', act: '' }), cofc1300: one(state.catalog.find(c => c.scorecard && c.scorecard.sat75 < 1200 && c.scorecard.sat25).id, { sat: '1300', act: '' }), noRange: one('college-of-charleston', { sat: '1300', act: '' }),
      actOnly: one('sc-217882', { sat: '', act: '30' }), testOptional: one('sc-217882', { sat: '1300', testOptional: true }), noScores: one('sc-217882', { sat: '', act: '' }) }; });
  await page.evaluate(() => { const K = (studentMember() || state.me).user_id; state.profiles[K] = { ...(state.profiles[K] || {}), sat: '1300', act: '' }; goto('board'); }); await page.waitForTimeout(500);
  o.cards = await page.evaluate(() => [...document.querySelectorAll('#schools .stand.compact')].map(x => x.textContent.replace(/\s+/g, ' ')) /* #71: bars sit in the card's 'More' fold */);
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  await page.evaluate(() => openDetail('sc-217882')); await page.waitForTimeout(600);
  o.detail = await page.evaluate(() => { const s = document.querySelector('#v-detail .stand'); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 500) : null; });
  const el = await page.$('#v-detail .stand'); if (el) await el.screenshot({ path: `${SHOTS}${label}-detail-stand.png` });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.insideRange'] = /Your SAT is inside their middle 50%/.test(o.math.clemson1300) && /1220 and 1410/.test(o.math.clemson1300);
  ok[label + '.belowRange'] = /below their middle 50%/.test(o.math.mit1300);
  ok[label + '.aboveRange'] = /above their middle 50%/.test(o.math.cofc1300);
  ok[label + '.noRangeSaysSo'] = /reports an average SAT of \d+, not a range\. Your 1300 is \d+ (above|below) that average/.test(o.math.noRange) /* #70 */;
  ok[label + '.actUsedWhenOnlyAct'] = /Where you stand · ACT/.test(o.math.actOnly) && /inside their middle 50%/.test(o.math.actOnly);
  ok[label + '.testOptionalNoDot'] = /test-optional/.test(o.math.testOptional) && !/Your SAT is/.test(o.math.testOptional);
  ok[label + '.noScoresPrompt'] = /Add a score in My Profile/.test(o.math.noScores);
  ok[label + '.cardsShowBars'] = o.cards.length >= 4 && o.cards.some(t => /SAT 1220–1410 · you 1300/.test(t));
  ok[label + '.detailShowsBar'] = /Where you stand/i.test(o.detail || '') && /GPA/.test(o.detail || '');
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./stand-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
