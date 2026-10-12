// #66 Step 2: profile rebuilt on admissions standards. Run: node tests/profile-v2-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f66/site', SHOTS = '/tmp/claude-0/f66/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8903);
const R = {}, ok = {};
const open = async (b, vp, init, dark) => { const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' }); await page.addInitScript(init || '');
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8903/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(700); return { page, log }; };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const o = {};
  // A. The student editing her own profile
  { const { page, log } = await open(b, vp, 'window.__ASSTUDENT=true;', dark);
    await page.evaluate(() => { goto('profile'); profileTab('acad'); pfEdit = true; renderProfileView(); }); await page.waitForTimeout(300);
    o.form = await page.evaluate(() => ({ income: !!document.getElementById('pf-income'), offered: !!document.getElementById('pf-hs-ap'), moreOpen: document.getElementById('pf-more').open, tab: document.querySelector('#pf-tabs [data-ptab="acad"]').textContent, tab2: document.querySelector('#pf-tabs [data-ptab="who"]').textContent, rankOpts: [...document.querySelectorAll('#pf-rank option')].map(x => x.textContent)[0] }));
    await page.fill('#pf-gpa', '3.6'); await page.selectOption('#pf-grade', '12'); await page.fill('#pf-honors', '6'); await page.waitForTimeout(150);
    o.adj1 = await page.textContent('#pf-adj');
    await page.selectOption('#pf-level', '5'); await page.waitForTimeout(100); o.adj2 = await page.textContent('#pf-adj');
    await page.evaluate(() => { document.getElementById('pf-more').open = true; }); await page.selectOption('#pf-major1', 'Engineering'); await page.selectOption('#pf-major2', 'Business'); await page.selectOption('#pf-rank', 'Top 10%'); await page.fill('#pf-hs', 'Brookline High School');
    await page.screenshot({ path: `${SHOTS}${label}-form.png`, fullPage: false });
    // activity: a summer job
    await page.click('#pf-act-add'); await page.waitForTimeout(200); await page.selectOption('.act-card.open .a-cat', 'Work (Paid)'); await page.waitForTimeout(200);
    o.work = await page.evaluate(() => ({ lvls: [...document.querySelectorAll('.act-card.open .a-lvl option')].map(x => x.textContent), pos: [...document.querySelectorAll('.act-card.open .a-pos option')].map(x => x.textContent), when: [...document.querySelectorAll('.act-card.open .a-tm')].map(x => x.textContent) }));
    await page.click('.act-card.open .a-tm[data-v="During school break"]'); await page.waitForTimeout(150);
    await page.click('.act-card.open .a-hr[data-v="8"]'); await page.waitForTimeout(150);
    await page.selectOption('.act-card.open .a-lvl', '3'); await page.selectOption('.act-card.open .a-pos', 'Shift lead / supervisor');
    await page.click('.act-card.open .a-gr[data-gr="11"]'); await page.click('.act-card.open .a-gr[data-gr="12"]');
    await page.screenshot({ path: `${SHOTS}${label}-activity.png`, fullPage: false });
    await page.click('.act-card.open .a-done'); await page.waitForTimeout(600);
    await page.evaluate(() => saveProfileForm()); await page.waitForTimeout(600);
    o.saved = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'profiles' && (x.op === 'upsert')).pop(); return w && { rigor: w.p.rigor, major: w.p.major, rank: w.p.rank, hs: w.p.hs, act: w.p.activities[w.p.activities.length - 1] }; });
    o.explain = await page.evaluate(() => { const c = state.catalog.find(x => x.scorecard && x.scorecard.admissionRate > 0.2 && x.scorecard.admissionRate < 0.35); const e = chanceExplain(c); return JSON.stringify(e); });
    o.summary = await page.evaluate(() => document.getElementById('pf-summary').innerText);
    await page.evaluate(() => goto('report')); await page.waitForTimeout(500); o.report = await page.evaluate(() => (document.querySelector('.rp-cover .rp-sub') || {}).innerText || '');
    o.audit = await audit(page, 'body'); o.errA = log.pageerr; }
  // B. The parent looking at the grades tab while Zoe (who has no grades yet) has her own account
  { const { page, log } = await open(b, vp, '', dark);
    await page.evaluate(() => { goto('profile'); profileTab('acad'); }); await page.waitForTimeout(300);
    o.parent = await page.evaluate(() => ({ text: document.getElementById('pf-summary').innerText, formHidden: document.getElementById('pf-form-card').classList.contains('hidden'), actsHidden: document.getElementById('pf-acts-card').classList.contains('hidden'), tab: document.querySelector('#pf-tabs [data-ptab="acad"]').textContent }));
    await page.evaluate(() => openPriorities()); await page.waitForTimeout(300);
    o.prefs = await page.evaluate(() => { const rows = [...document.querySelectorAll('#lifeprefs .lp-row')].map(r => r.getBoundingClientRect().height); const ends = [...document.querySelectorAll('.ends')].map(e => { const [a, b2] = e.querySelectorAll('span'); return a.getBoundingClientRect().right <= b2.getBoundingClientRect().left + 1; }); return { maxRow: Math.max(...rows), endsClear: ends.every(Boolean), labels: [...document.querySelectorAll('.ends span')].map(x => x.textContent).join('|') }; });
    await page.screenshot({ path: `${SHOTS}${label}-priorities.png` });
    o.errB = log.pageerr; }
  await b.close(); R[label] = o;
  ok[label + '.basicsOnly'] = !o.form.income && !o.form.offered && !o.form.moreOpen && /My grades/.test(o.form.tab) && /My priorities/.test(o.form.tab2) && /doesn't rank/.test(o.form.rankOpts);
  ok[label + '.weightedGpaHonest'] = /3\.73/.test(o.adj1) && /about 24 courses/.test(o.adj1) && /estimated/.test(o.adj1) && /most demanding/.test(o.adj2) && !/estimated/.test(o.adj2);
  ok[label + '.workRecognitionFits'] = o.work.lvls.join('|') === 'Employee|Given more responsibility / promoted|Supervisor, manager, or a workplace award' && o.work.pos.includes('Shift lead / supervisor') && o.work.when.join('|') === 'School year|Summer & breaks|All year';
  ok[label + '.savedOnStandards'] = o.saved && o.saved.rigor.grade === 12 && o.saved.rigor.level === 5 && o.saved.rigor.honors === 6 && o.saved.major === 'Engineering + Business' && o.saved.rank === 'Top 10%' && o.saved.hs.name === 'Brookline High School' && !('apOffered' in o.saved.hs)
    && o.saved.act.category === 'Work (Paid)' && o.saved.act.timing === 'During school break' && +o.saved.act.weeks === 8 && +o.saved.act.hrs === 8 && o.saved.act.tier === 3;
  ok[label + '.rigorCountsInChance'] = /Course rigor/.test(o.explain) && /Rated most demanding/.test(o.explain);
  ok[label + '.summaryAndReport'] = /12th/.test(o.summary) && /most demanding/.test(o.summary) && /Engineering \+ Business/.test(o.summary) && /Brookline High School/.test(o.report) && /Grade 12/.test(o.report);
  ok[label + '.parentSeesStudentReadOnly'] = /Zoe hasn't added grades yet/.test(o.parent.text) && o.parent.formHidden && o.parent.actsHidden && /Zoe's grades/.test(o.parent.tab);
  ok[label + '.prioritiesTidy'] = o.prefs.maxRow < 90 && o.prefs.endsClear && /small town/.test(o.prefs.labels) && /small college/.test(o.prefs.labels);
  ok[label + '.noErrors'] = !o.errA.length && !o.errB.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./profile-v2-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
