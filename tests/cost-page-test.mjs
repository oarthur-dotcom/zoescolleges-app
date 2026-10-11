// #52 Costs page + aid-letter reader. Run: node tests/cost-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f52/site', SHOTS = '/tmp/claude-0/f52/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const NP_CACHE = '/tmp/claude-0/np-4dee74b.json';  // copy of the pinned data file (curl it if missing); avoids a network call in the test
const NP = fs.existsSync(NP_CACHE) ? fs.readFileSync(NP_CACHE, 'utf8') : await fetch('https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@4dee74b/net-price-by-income.json').then(r => r.text()).catch(() => '{"schools":{}}');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8814);
const R = {}, ok = {};
// server-side cleaner
const A = await import(new URL('../netlify/functions/aid-letter-read.mjs', import.meta.url));
const c = A.cleanAid({ school: 'Elon University', costOfAttendance: '$78,450', grants: [{ name: 'Presidential Scholarship', amount: '20,000' }, { name: 'Bad', amount: -5 }], loans: [{ name: 'Direct Unsubsidized', amount: 2000, kind: 'unsubsidized' }, { name: 'X', amount: 9e9, kind: 'weird' }], workStudy: 1500, confidence: 'nope' });
ok.cleanerParsesMoney = c.costOfAttendance === 78450 && c.grants.length === 1 && c.grants[0].amount === 20000 && c.loans.length === 1 && c.confidence === 'medium';
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*net-price-by-income\.json/, r => r.fulfill({ contentType: 'application/json', body: NP }));
  await page.route('**/.netlify/functions/aid-letter-read', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ fields: { school: 'Massachusetts Institute of Technology', academicYear: '2027-28', costOfAttendance: 85960, grants: [{ name: 'MIT Scholarship', amount: 61000 }, { name: 'Federal Pell Grant', amount: 2000 }], loans: [{ name: 'Direct Subsidized Loan', amount: 3500, kind: 'subsidized' }], workStudy: 2400, confidence: 'high' } }) }));
  const zoeBodies = []; await page.route('**/.netlify/functions/zoe-ai', r => { zoeBodies.push(JSON.parse(r.request().postData())); r.fulfill({ contentType: 'application/json', body: '{"reply":"explained","mode":"chat"}' }); });
  await page.goto('http://localhost:8814/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = {};
  await page.evaluate(() => goto('cost')); await page.waitForTimeout(500);
  await page.selectOption('#cost-income2', '2'); await page.waitForTimeout(700);
  o.rows = await page.evaluate(() => [...document.querySelectorAll('.cost-tr:not(.cost-th)')].map(r => r.innerText.replace(/\s+/g, ' ')));
  o.sum = await page.evaluate(() => (document.querySelector('.cost-sum') || {}).innerText || '');
  // upload a letter (reader mocked) -> review -> save
  await page.setInputFiles('#offer-file', '/tmp/claude-0/t1.png'); await page.waitForTimeout(900);
  o.review = await page.evaluate(() => ({ school: document.getElementById('of-school').value, coa: document.getElementById('of-coa').value, grants: document.querySelectorAll('[data-line=grant]').length, loans: document.querySelectorAll('[data-line=loan]').length, note: document.querySelector('.offer-form .msg') ? document.querySelector('.offer-form .msg').innerText : '' }));
  await page.click('#of-save'); await page.waitForTimeout(400);
  o.card = await page.evaluate(() => (document.querySelector('.offer-card') || {}).innerText || '');
  o.mitRow = await page.evaluate(() => [...document.querySelectorAll('.cost-tr')].map(r => r.innerText.replace(/\s+/g, ' ')).find(t => /Massachusetts/.test(t)));
  await page.screenshot({ path: `${SHOTS}${label}-cost.png`, fullPage: true });
  // manual: grants more than cost refused
  await page.evaluate(() => document.querySelector('[data-offer-add]').click()); await page.waitForTimeout(200);
  await page.fill('#of-coa', '1000'); await page.fill('[data-line=grant] .of-a', '5000'); await page.selectOption('#of-school', { index: 1 }); await page.click('#of-save'); await page.waitForTimeout(200);
  o.badMsg = await page.textContent('#of-msg');
  await page.click('#of-cancel');
  await page.click('[data-offer-zoe]'); await page.waitForTimeout(900);
  o.zoe = { view: await page.evaluate(() => currentView), q: (zoeBodies.at(-1) || {}).q || '' };
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.rowsForEveryBoardSchool'] = o.rows.length === 6 && o.rows.every(t => /\$/.test(t));
  ok[label + '.incomeBandUsed'] = /Lowest/.test(o.sum) && /Highest/.test(o.sum);
  ok[label + '.letterPrefillsForm'] = o.review.school === 'sc-166683' && o.review.coa === '85960' && o.review.grants === 2 && o.review.loans === 1 && /check every number/.test(o.review.note);
  ok[label + '.offerMath'] = /\$85,960/.test(o.card) && /\$63,000/.test(o.card) && /\$22,960/.test(o.card) && /\$3,500/.test(o.card) && /Loans aren't aid/.test(o.card) && /\$22,960 \+ \$3,500 loans/.test(o.mitRow || '');
  ok[label + '.refusesBadNumbers'] = /more than the cost/.test(o.badMsg);
  ok[label + '.zoeExplains'] = o.zoe.view === 'zoe' && /MIT Scholarship \$61,000/.test(o.zoe.q) && /Direct Subsidized Loan \$3,500/.test(o.zoe.q);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX; ok[label + '.noBadText'] = !o.audit.bad.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./cost-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
