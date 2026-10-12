// #70 Step 6: money and accuracy. Run: node tests/accuracy-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f70/site', SHOTS = '/tmp/claude-0/f70/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8907);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['desktop-dark', { width: 1280, height: 900 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8907/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  // 1 out-of-state prices (family is in MA)
  o.money = await page.evaluate(() => { const c = id => state.catalog.find(x => x.id === id); return { home: homeState(), cofc: avgNet(c('college-of-charleston')), cofcSur: oosSurcharge(c('college-of-charleston')), umass: oosSurcharge(c('umass-amherst')), umassNet: avgNet(c('umass-amherst')) === c('umass-amherst').scorecard.netPrice }; });
  await page.evaluate(() => openDetail('college-of-charleston', 'board')); await page.waitForTimeout(500);
  o.detail = await page.evaluate(() => [...document.querySelectorAll('#detail-body *')].filter(x => !x.children.length && /net price/i.test(x.textContent)).map(x => x.parentElement.innerText.replace(/\s+/g, ' ')));
  await page.evaluate(() => setIncomeBand('2')); await page.waitForTimeout(200);
  o.yours = await page.evaluate(() => { const y = yourNet(state.catalog.find(x => x.id === 'college-of-charleston')); return y && { v: y.v, oos: y.outOfState, sur: y.surcharge, html: yourNetHtml(state.catalog.find(x => x.id === 'college-of-charleston')) }; });
  // 2 shared checklist, one status with Decision Day
  await page.evaluate(() => { const o2 = getChecklist('college-of-charleston'); o2['Transcript'] = true; o2['Submitted'] = true; setChecklist('college-of-charleston', o2); }); await page.waitForTimeout(300);
  o.chk = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'family_schools' && x.op === 'update').pop(); const row = state.schools.find(s => s.school_id === 'college-of-charleston'); return { patch: w && w.p, shared: getChecklist('college-of-charleston'), status: row.app_status }; });
  await page.evaluate(async () => { await setSchoolStatus('university-of-vermont', 'applied'); }); await page.waitForTimeout(300);
  o.dd = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'family_schools' && x.op === 'update').pop(); return w && w.p; });
  // 3 Decision Day is calm
  await page.evaluate(() => goto('decide')); await page.waitForTimeout(400);
  o.decide = await page.evaluate(() => ({ buttons: document.querySelectorAll('.dd-st').length, pills: [...document.querySelectorAll('.dd-cpill')].map(x => x.textContent.trim()), updates: document.querySelectorAll('[data-ddedit]').length }));
  await page.click('[data-ddedit="college-of-charleston"]'); await page.waitForTimeout(200); o.decideOpen = await page.evaluate(() => document.querySelectorAll('.dd-st').length);
  await page.screenshot({ path: `${SHOTS}${label}-decide.png` });
  // 4 Compare: chart shows the picked schools; honest best-match wording
  await page.evaluate(() => { Object.keys(cmpSel).forEach(k => delete cmpSel[k]); cmpSel['sc-166683'] = true; cmpSel['college-of-charleston'] = true; goto('compare'); }); await page.waitForTimeout(600);
  o.cmp = await page.evaluate(() => ({ text: document.getElementById('cmp-out').innerText.replace(/\s+/g, ' '), costRows: document.querySelectorAll('#cmp-out .cc-row, #cmp-out .costbar-row, #cmp-out [data-ccrow]').length }));
  // 5 school page with only an SAT average
  await page.evaluate(() => openDetail('sc-108092', 'board')); await page.waitForTimeout(500); o.stand = await page.evaluate(() => (document.querySelector('#detail-body .stand') || {}).innerText || '');
  // 6 search cards: no politics/gun tags unless filtering by them; match % labeled
  await page.evaluate(() => { goto('explore'); const i = document.getElementById('exsearch'); i.value = 'charleston'; renderExList(i.value); }); await page.waitForTimeout(500);
  o.search = await page.evaluate(() => ({ life: [...document.querySelectorAll('#v-explore .scl.life')].map(x => x.innerText).join(' | '), }));
  await page.evaluate(() => goto('board')); await page.waitForTimeout(400); o.ring = await page.evaluate(() => (document.querySelector('.mring b') || {}).textContent || '');
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close(); R[label] = o;
  ok[label + '.outOfStatePrice'] = o.money.home === 'MA' && o.money.cofcSur === 38296 - 12978 && o.money.cofc === 18960 + 25318 && o.money.umass === 0 && o.money.umassNet && o.detail.some(t => /out-of-state/i.test(t) && /44,278/.test(t));
  ok[label + '.yourPriceIncludesIt'] = o.yours && o.yours.oos && o.yours.sur === 25318 && /out-of-state tuition/.test(o.yours.html);
  ok[label + '.checklistShared'] = o.chk.patch && o.chk.patch.checklist && o.chk.patch.checklist.Transcript === true && o.chk.shared.Submitted === true && o.chk.status === 'applied' && o.chk.patch.app_status === 'applied';
  ok[label + '.oneStatusBothWays'] = o.dd && o.dd.app_status === 'applied' && o.dd.checklist && o.dd.checklist.Submitted === true;
  ok[label + '.decisionDayCalm'] = o.decide.buttons === 0 && o.decide.updates === 6 && o.decide.pills.some(t => /Applied/.test(t)) && o.decideOpen === 7;
  ok[label + '.compareHonest'] = /Closest match to your priorities/.test(o.cmp.text) && !/Best fit for you/.test(o.cmp.text);
  ok[label + '.standNoContradiction'] = /average SAT of 1050/.test(o.stand) && !/doesn't report/.test(o.stand);
  ok[label + '.searchCardsCalm'] = !/Lean (Republican|Democratic)|Permissive|Strict/.test(o.search.life);
  ok[label + '.matchLabeled'] = /%$/.test(o.ring.trim());
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./accuracy-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
