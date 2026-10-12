// #79 cost prediction: exact income + kids in college (family-shared, saved with a clear message), an SAI estimate,
// "Likely for you" per school (never above sticker), a merit hint, and each school's official calculator.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f79/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
const CAT = fs.readFileSync('/home/claude/zoescolleges-data/colleges.json'); const VL = fs.readFileSync('/home/claude/zoescolleges-data/visit-links.json');
const NP = fs.readFileSync('/home/claude/zoescolleges-data/net-price-by-income.json'); const AID = fs.readFileSync('/home/claude/zoescolleges-data/school-aid.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8962);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*visit-links\.json/, r => r.fulfill({ contentType: 'application/json', body: VL }));
  await page.route(/jsdelivr.*net-price-by-income\.json/, r => r.fulfill({ contentType: 'application/json', body: NP }));
  await page.route(/jsdelivr.*school-aid\.json/, r => r.fulfill({ contentType: 'application/json', body: AID }));
  await page.goto('http://localhost:8962/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me && state.family, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = {};
  o.sai = await page.evaluate(() => ({ s60: estimateSAI(60000), s150: estimateSAI(150000), s200: estimateSAI(200000), s400: estimateSAI(400000) }));
  await page.evaluate(() => goto('cost')); await page.waitForTimeout(400);
  o.before = await page.evaluate(() => ({ box: !!document.getElementById('cf-income'), head: [...document.querySelectorAll('#cost-out .cost-th span')].map(x => x.textContent)[2] }));
  await page.fill('#cf-income', '185000'); await page.click('[data-cfk="2"]'); await page.click('#cf-save'); await page.waitForTimeout(500);
  o.after = await page.evaluate(() => ({ msg: (document.getElementById('cf-msg') || {}).textContent, head: [...document.querySelectorAll('#cost-out .cost-th span')].map(x => x.textContent)[2], sai: (document.querySelector('.cf-sai') || {}).textContent || '',
    saved: window.__writes.filter(w => w.table === 'preferences').map(w => ({ i: w.p.weights.incomeExact, k: w.p.weights.kidsInCollege, b: w.p.weights.incomeBand })).pop(),
    rows: state.schools.map(s => { const c = catInfo(s.school_id); const y = yourNet(c); return c && { n: c.name, st: stickerPrice(c), y: y && y.v, basis: y && y.basis, pub: /public/i.test(c.ownership || '') }; }).filter(Boolean),
    npc: document.querySelectorAll('#cost-out .cost-npc').length, why: document.querySelectorAll('#cost-out .cost-aid').length }));
  // Oct 12: at full price, UNH's likely cost takes off the school aid 95% of students get (~$12,949 avg) — about $44k, sticker ~$56k
  o.unh = await page.evaluate(async () => { await setFamilyFinance(250000, 1); const c = catInfo('university-of-new-hampshire'); const y = c && yourNet(c); return c && { st: stickerPrice(c), y: y && y.v, basis: y && y.basis, why: y && yourNetWhy(y) }; });
  // a lower income uses the federal bracket data
  o.low = await page.evaluate(async () => { await setFamilyFinance(60000, 1); const c = catInfo('university-of-new-hampshire') || state.catalog.find(x => state.incomePrices && state.incomePrices[x.id]); const y = yourNet(c); return { band: myIncomeBand(), basis: y && y.basis }; });
  await page.screenshot({ path: `/tmp/claude-0/f79/${label}-cost.png`, fullPage: true });
  o.audit = await audit(page, '#v-cost'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.likelyTakesOffSchoolAid'] = !o.unh || (o.unh.basis === 'schoolaid' && Math.abs(o.unh.y - (o.unh.st - Math.round(12949 * 0.95))) < 600 && /95% of students/.test(o.unh.why));
  ok[label + '.saiSensible'] = o.sai.s60 < 8000 && o.sai.s150 > 15000 && o.sai.s150 < 35000 && o.sai.s200 > o.sai.s150 && o.sai.s400 > 100000;
  ok[label + '.familyBox'] = o.before.box;
  ok[label + '.saveSaysWhatChanged'] = /Saved ✓/.test(o.after.msg) && /\$185,000/.test(o.after.msg) && /2 in college/.test(o.after.msg) && o.after.saved && o.after.saved.i === 185000 && o.after.saved.k === 2 && o.after.saved.b === 4;
  ok[label + '.likelyForYou'] = o.after.head === 'Likely for you' && /Student Aid Index/.test(o.after.sai) && /per student/.test(o.after.sai);
  ok[label + '.neverAboveSticker'] = o.after.rows.length > 0 && o.after.rows.every(r => r.y == null || r.st == null || r.y <= r.st);
  ok[label + '.basisExplained'] = o.after.rows.some(r => r.basis) && o.after.why > 0;
  { const mit = o.after.rows.find(r => /Massachusetts Institute/.test(r.n)); ok[label + '.generousSchoolNearSAI'] = !!mit && mit.basis === 'sai' && mit.y < 25000; }
  ok[label + '.calculatorLinks'] = o.after.npc > 0;
  ok[label + '.lowIncomeUsesFederalData'] = o.low.band === 2 && (o.low.basis === 'band' || o.low.basis == null);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify({ sai: R.phone.sai, after: { ...R.phone.after, rows: R.phone.after.rows } }).slice(0, 1800)); console.log(JSON.stringify(ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./cost-predict-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
