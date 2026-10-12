// #54 Application requirements: school page card + per-school checklist. Run: node tests/requirements-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f54/site', SHOTS = '/tmp/claude-0/f54/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), DL = fs.readFileSync('/tmp/claude-0/f33/dl.json'), REQ = fs.readFileSync('/tmp/claude-0/requirements.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8816);
const R = {}, ok = {};
for (const [label, vp, dark, missing] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true], ['file-not-published', { width: 390, height: 844 }, false, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DL }));
  await page.route(/jsdelivr.*requirements\.json/, r => missing ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'application/json', body: REQ }));
  await page.goto('http://localhost:8816/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(900);
  const o = {};
  // a saved tick from before keeps counting
  await page.evaluate(() => { const c = getChecklist('sc-166683'); c['Essays'] = true; setChecklist('sc-166683', c); openDetail('sc-166683'); }); await page.waitForTimeout(600);
  o.card = await page.evaluate(() => { const s = document.querySelector('#v-detail .rq-box'); return s ? s.innerText.replace(/\s+/g, ' ') : null; });
  await page.evaluate(() => { lsSet('dlStages', ['exploring','visiting','applying','deciding']); goto('deadlines'); }); await page.waitForTimeout(600);
  o.pills = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-dlid]')].map(b => [b.dataset.dlid, [...b.querySelectorAll('.dl-pill')].map(p => p.textContent)])));
  // keyboard toggles a pill
  await page.focus('[data-dlid="sc-217882"] [data-task="Transcript"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  o.kb = await page.evaluate(() => !!getChecklist('sc-217882')['Transcript']);
  await page.screenshot({ path: `${SHOTS}${label}-deadlines.png` });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  if (!missing) {
    ok[label + '.schoolCard'] = /What they ask for/i.test(o.card || '') && /SAT \/ ACT Required/.test(o.card) && /Application fee \$75/.test(o.card) && /confirm on the school's admissions site/.test(o.card);
    ok[label + '.mitChecklist'] = JSON.stringify((o.pills['sc-166683']||[]).map(t=>t.replace(/^✓\s*/,'✓ '))) === '["✓ Essay","Recommendations","Transcript","Test scores","Fee $75","FAFSA / CSS","Submitted"]';
    ok[label + '.clemsonChecklist'] = JSON.stringify(o.pills['sc-217882']) === '["Essay (optional)","Recs (optional)","Transcript","Scores (optional)","Fee $70","FAFSA / CSS","Submitted"]';
  } else { ok[label + '.fallsBackToStandard'] = o.card === null && JSON.stringify(o.pills['sc-217882']) === '["Essays","Recommendations","Transcript","FAFSA / CSS","Test scores","Submitted"]'; }
  ok[label + '.keyboardToggles'] = o.kb;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./requirements-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
