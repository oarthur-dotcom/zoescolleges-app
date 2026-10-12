// #58 Zoe's College Report. Run: node tests/report-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f58/site', SHOTS = '/tmp/claude-0/f58/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8822);
const R = {}, ok = {};
const boot = async (page, opts = {}) => { await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8822/index.html'); };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await boot(page); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && state.schools.length, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { const sid = state.schools[0].school_id; const v = getVisits(); v[sid] = { date: '2026-09-20', notes: 'Loved <b>the</b> quad', rating: 5, spots: [] }; lsSet('visits', v); });
  const o = {};
  o.todayCard = await page.evaluate(() => !!document.querySelector('#td-out [data-td-go="report"]'));
  await page.click('#td-out [data-td-go="report"]'); await page.waitForTimeout(600);
  o.r = await page.evaluate(() => { const b = document.querySelector('#report-body'); return { vis: !document.querySelector('#v-report').classList.contains('hidden'), h1: b.querySelector('h1').textContent, pages: b.querySelectorAll('.rp-page').length, schools: b.querySelectorAll('.rp-school').length, board: state.schools.length, take: b.querySelectorAll('.rp-take li').length, costRows: b.querySelectorAll('.rp-tbl')[0].querySelectorAll('tbody tr').length, text: b.innerText, thumbs: b.querySelectorAll('.rp-thumb').length, boldInjected: [...b.querySelectorAll('.rp-line b')].length }; });
  await page.screenshot({ path: `${SHOTS}${label}-report.png`, fullPage: true });
  await page.click('#report-back'); await page.waitForTimeout(300); o.backTo = await page.evaluate(() => currentView);
  await page.evaluate(() => goto('board')); await page.waitForTimeout(200); await page.click('#btn-report2'); await page.waitForTimeout(300); o.fromBoard = await page.evaluate(() => currentView);
  await page.click('#report-back'); await page.waitForTimeout(200); o.backBoard = await page.evaluate(() => currentView);
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(400); o.pfBtn = await page.evaluate(() => !!document.querySelector('[data-pf-report], #subnav [data-nav="report"]'));   // #68: Profile group sub-tab (or the profile header button)
  if (o.pfBtn) { await page.click(await page.$('[data-pf-report]') ? '[data-pf-report]' : '#subnav [data-nav="report"]'); await page.waitForTimeout(300); } o.fromProfile = await page.evaluate(() => currentView);
  if (label !== 'desktop') { await page.evaluate(() => goto('today')); await page.click('#tabbar [data-tb="more"], #tabbar .tb:last-child'); await page.waitForTimeout(300);
    o.sheet = await page.evaluate(() => !!document.querySelector('.tbs[data-nav="report"]')); if (o.sheet) { await page.click('.tbs[data-nav="report"]'); await page.waitForTimeout(300); } o.fromSheet = await page.evaluate(() => currentView); }
  // print: real PDF via the print engine, title set for the file name
  await page.evaluate(() => goto('report')); await page.waitForTimeout(400);
  o.title = await page.evaluate(() => { let t = ''; const p = window.print; window.print = () => { t = document.title; }; reportPrint(); window.print = p; return t; });
  if (label === 'desktop' || label === 'phone-dark') { await page.emulateMedia({ media: 'print' }); const pdf = await page.pdf({ path: `${SHOTS}${label}-report.pdf`, format: 'Letter', printBackground: true });
    o.pdfBytes = pdf.length; o.pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    o.printHidden = await page.evaluate(() => ['#tabbar', 'header.app', '#zoe-fab', '#report-print'].map(s => { const e = document.querySelector(s); return !e || e.getClientRects().length === 0; }).every(Boolean));
    o.printInk = await page.evaluate(() => getComputedStyle(document.querySelector('.rp h1')).color); await page.emulateMedia({ media: 'screen' }); }
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close();
  // sample family (demo)
  const b2 = await launch(); const { page: p2, log: l2 } = await newPage(b2, vp, { signedOut: true }); await boot(p2); await p2.waitForTimeout(2500);
  const hasDemo = await p2.evaluate(() => typeof startDemo === 'function'); if (hasDemo) { await p2.evaluate(() => startDemo()); await p2.waitForTimeout(2500); }
  o.demo = await p2.evaluate(() => !!document.querySelector('#demo-report') && !document.querySelector('#demo-bar').classList.contains('hidden'));
  if (o.demo) { await p2.click('#demo-report'); await p2.waitForTimeout(600); }
  o.demoR = await p2.evaluate(() => ({ view: currentView, h1: (document.querySelector('#report-body h1') || {}).textContent || '', schools: document.querySelectorAll('#report-body .rp-school').length }));
  await p2.screenshot({ path: `${SHOTS}${label}-demo-report.png` }); o.errors2 = l2.pageerr; await b2.close();
  R[label] = o; const t = o.r.text;
  ok[label + '.entryPoints'] = o.todayCard && o.fromBoard === 'report' && o.pfBtn && o.fromProfile === 'report' && (label === 'desktop' || (o.sheet && o.fromSheet === 'report'));
  ok[label + '.backGoesWhereYouCameFrom'] = o.backTo === 'today' && o.backBoard === 'board';
  ok[label + '.fiveSections'] = o.r.vis && o.r.pages === 5 && /College Report/.test(o.r.h1) && ['Student profile', 'The list, school by school', 'Costs', 'Deadlines', 'Next steps'].every(s => t.includes(s));
  ok[label + '.everySchool'] = o.r.schools === o.r.board && o.r.costRows === o.r.board && o.r.thumbs === o.r.board;
  ok[label + '.zoesTake'] = o.r.take >= 2 && /Zoe's take/.test(t);
  ok[label + '.visitNotesEscaped'] = /Loved <b>the<\/b> quad/.test(t) && o.r.boldInjected === 0;
  ok[label + '.pdfFileName'] = /^Zoe's College Report - .+ - \d{4}-\d{2}-\d{2}$/.test(o.title);
  if (o.pdfBytes) { ok[label + '.realPdf'] = o.pdfBytes > 20000 && o.pdfPages >= 5 && o.printHidden; ok[label + '.printsLightEvenInDarkMode'] = o.printInk === 'rgb(16, 28, 46)'; }
  ok[label + '.sampleFamilyReport'] = o.demo && o.demoR.view === 'report' && o.demoR.schools >= 3;
  ok[label + '.noErrors'] = !o.errors.length && !o.errors2.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass, JSON.stringify({ d: R.desktop && R.desktop.pdfPages, pd: R['phone-dark'] && R['phone-dark'].pdfPages, ink: R['phone-dark'] && R['phone-dark'].printInk, t: R.phone && R.phone.title }));
fs.writeFileSync(new URL('./report-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
