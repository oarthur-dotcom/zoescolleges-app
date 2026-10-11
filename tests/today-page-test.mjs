// #48 Today home screen. Run: node tests/today-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f48/site', SHOTS = '/tmp/claude-0/f48/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), DL = fs.readFileSync('/tmp/claude-0/f33/dl.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8810);
const ago = d => new Date(Date.now() - d * 864e5).toISOString(), ahead = d => new Date(Date.now() + d * 864e5).toISOString();
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true], ['empty-phone', { width: 390, height: 844 }, false, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, { empty: label === 'empty-phone' }); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  const empty = label === 'empty-phone';
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DL }));
  const bodies = [];
  await page.route('**/.netlify/functions/zoe-ai', r => { bodies.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'ok', mode: 'week' }) }); });
  await page.route('**/.netlify/functions/campus-pulse*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schools: { 'sc-166683': { top: [], stories: [{ title: 'MIT engineers design a battery', link: 'https://news.mit.edu/a', date: ago(0.5), kind: 'news' }, { title: 'Hockey wins', link: 'https://news.mit.edu/b', date: ago(2), kind: 'news', topic: 'Sports' }], visits: [{ title: 'Campus tour and information session', link: 'https://calendar.mit.edu/t', date: ahead(3), kind: 'events' }] } }, pending: [], none: [] }) }));
  await page.goto('http://localhost:8810/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(1800);
  const o = {};
  o.landing = await page.evaluate(() => currentView);
  o.hi = await page.textContent('#td-hi');
  o.cards = await page.evaluate(() => [...document.querySelectorAll('#td-out .td-card .td-h')].map(x => x.textContent.trim()));
  o.text = await page.evaluate(() => document.getElementById('td-out').innerText.replace(/\s+/g, ' ').slice(0, 900));
  await page.screenshot({ path: `${SHOTS}${label}-today.png`, fullPage: true });
  if (!empty) {
    await page.fill('#td-q', 'stanferd'); await page.press('#td-q', 'Enter'); await page.waitForTimeout(700);
    o.search = await page.evaluate(() => ({ view: currentView, first: (document.querySelector('#v-explore .srow .sn') || {}).textContent }));
    await page.evaluate(() => goto('today')); await page.waitForTimeout(400);
    await page.click('[data-td-week]'); await page.waitForTimeout(900);
    o.week = { view: await page.evaluate(() => currentView), mode: (bodies.at(-1) || {}).mode };
  }
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.landsOnToday'] = o.landing === 'today' && /^Good (morning|afternoon|evening)/.test(o.hi);
  if (!empty) {
    ok[label + '.fiveCards'] = o.cards.length === 6 && /Next deadline/.test(o.cards[0]) && /Zoe suggests/.test(o.cards[1]) && /New at your schools/.test(o.cards[2]) && /Your list/.test(o.cards[3]) && /College report/.test(o.cards[4]) && /Visits/.test(o.cards[5]);
    ok[label + '.nextDeadlineIsClemson'] = /Clemson University Early Action · Oct 15, 2026 · in 4 days/.test(o.text) && /Still to do:/.test(o.text);
    ok[label + '.newsAndVisitDays'] = /MIT engineers design a battery/.test(o.text) && /Campus tour and information session/.test(o.text);
    ok[label + '.listGrade'] = /Likely · .* Target · .* Reach/.test(o.text);
    ok[label + '.searchGoesToSchools'] = o.search.view === 'explore' && /Stanford/.test(o.search.first || '');
    ok[label + '.planMyWeek'] = o.week.view === 'zoe' && o.week.mode === 'week';
  } else ok[label + '.emptyFamilyFriendly'] = /No schools yet|Add schools/.test(o.text) && o.cards.length === 5;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX; ok[label + '.noBadText'] = !o.audit.bad.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./today-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
