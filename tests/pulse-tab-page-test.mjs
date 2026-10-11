// #34 Campus Pulse tab — page test (headless browser, fake backend). Run: node tests/pulse-tab-page-test.mjs
// Checks: Pulse has its own nav tab and is gone from My Board; the tab shows the board's news, visit days, deadline
// nudges and the weekly-email switch; card dots + nav count; the school page shows a deadline nudge and visit days
// with "Add to Trips"; phone + desktop + dark mode, no page errors, no sideways scroll.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f34/site', SHOTS = '/tmp/claude-0/f34/';
fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f33/colleges.json'), DL = fs.readFileSync('/tmp/claude-0/f33/dl.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8796);
const ago = d => new Date(Date.now() - d * 864e5).toISOString(), ahead = d => new Date(Date.now() + d * 864e5).toISOString();
const MITs = [
  { title: 'MIT engineers design a battery that charges in five minutes', link: 'https://news.mit.edu/a', date: ago(0.3), topic: 'Research', kind: 'news' },
  { title: 'Early action: what we look for in your essays', link: 'https://mitadmissions.org/blogs/x', date: ago(1), topic: 'Admissions & aid', kind: 'admissions' },
  { title: 'Beavers hockey opens season with home win', link: 'https://news.mit.edu/b', date: ago(2), topic: 'Sports', kind: 'news' },
  { title: 'New exhibit at the MIT Museum explores robots in art', link: 'https://news.mit.edu/d', date: ago(12), topic: 'Arts', kind: 'news' }];
const MITv = [{ title: 'Campus tour and information session', link: 'https://calendar.mit.edu/event/tour', date: ahead(2), where: 'Lobby 7', allDay: false, kind: 'events' }];
const CHSs = [{ title: 'CofC breaks ground on new science center', link: 'https://charleston.edu/news/a', date: ago(2), topic: 'Research', kind: 'news' }];
const CHSv = [{ title: 'Fall Open House', link: 'https://charleston.edu/events/oh', date: ahead(6), where: 'Cistern Yard', allDay: false, kind: 'events' }];
const MITfull = { id: 'sc-166683', meter: { recent30: 14, newest: ago(0.3), events: 2, level: 'very-active' },
  sections: { news: MITs.filter(x => x.kind === 'news'), admissions: MITs.filter(x => x.kind === 'admissions'),
    events: [...MITv, { title: 'Fall concert: MIT Symphony Orchestra', link: 'https://calendar.mit.edu/event/sym', date: ahead(4), where: 'Kresge', allDay: false }] } };
const R = {}; const ok = {};
async function run(vp, label, dark) {
  const b = await launch(); const { page, log } = await newPage(b, vp, { plan: 'family' });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DL }));
  await page.route(/net-price-by-income/, r => r.fulfill({ status: 404, body: '' }));
  let digestUrls = [];
  await page.route('**/.netlify/functions/campus-pulse*', r => { const u = new URL(r.request().url());
    if (u.searchParams.has('ids')) { digestUrls.push(u.search); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schools: {
      'sc-166683': { top: MITs.slice(0, 3), stories: MITs, visits: MITv, meter: MITfull.meter },
      'college-of-charleston': { top: CHSs, stories: CHSs, visits: CHSv, meter: { recent30: 3, level: 'steady' } },
      'sc-217882': { top: [], stories: [], visits: [], meter: { recent30: 0, level: 'quiet' } } },
      pending: [], none: ['university-of-vermont', 'sc-155335', 'sc-237950'] }) }); }
    const id = u.searchParams.get('id');
    if (id === 'sc-166683') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(MITfull) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], sections: {}, reason: 'no-feed' }) }); });
  await page.goto('http://localhost:8796/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 });
  await page.evaluate(() => goto('board')); await page.waitForTimeout(700);   // #48: the app now opens on Today
  await page.waitForTimeout(1800);
  const out = {};
  out.navTabs = await page.evaluate(() => [...document.querySelectorAll('#appnav .navbtn')].map(b => b.textContent.trim()));
  out.boardHasPulseBox = await page.evaluate(() => !!document.querySelector('#v-board .bpulse, #board-pulse'));
  out.cardBadges = await page.evaluate(() => [...document.querySelectorAll('#schools .pulse-new')].map(x => x.closest('[data-pulse-open]').dataset.pulseOpen + ':' + x.textContent));
  out.digestAsksForEvents = digestUrls.every(s => /events=1/.test(s)) && digestUrls.length >= 1;
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  // Pulse tab
  await page.click(vp.width <= 640 ? '#tabbar [data-nav="pulse"]' : '#appnav .navbtn[data-nav="pulse"]'); await page.waitForTimeout(700);
  out.tabText = await page.evaluate(() => document.getElementById('pt-out').innerText.replace(/\s+/g, ' ').slice(0, 1400));
  out.feedOrder = await page.evaluate(() => [...document.querySelectorAll('.pt-feed .pt-tile-t')].map(a => a.textContent.slice(0, 50)));
  out.visits = await page.evaluate(() => [...document.querySelectorAll('#pt-out .pt-visit')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 120)));
  out.nudges = await page.evaluate(() => [...document.querySelectorAll('#pt-out .pt-nudge')].map(x => x.innerText.replace(/\s+/g, ' ')));
  out.notConnected = await page.evaluate(() => (document.querySelector('.pt-nc') || {}).innerText || '');
  out.weeklyCard = await page.evaluate(() => (document.querySelector('.pt-weekly') || {}).innerText || '');
  out.audit = await audit(page, '#v-pulse');
  await page.screenshot({ path: `${SHOTS}${label}-pulse-tab.png`, fullPage: true });
  // school filter chip
  await page.selectOption('[data-pt-school-sel]', 'college-of-charleston'); await page.waitForTimeout(200);
  out.filtered = await page.evaluate(() => [...document.querySelectorAll('.pt-feed .bp-school')].map(a => a.textContent));
  await page.selectOption('[data-pt-school-sel]', 'all'); await page.waitForTimeout(150);
  // add a visit day to Trips
  await page.evaluate(() => document.querySelector('#pt-out [data-trip-add="college-of-charleston"]').click()); await page.waitForTimeout(150);
  out.tripAdded = await page.evaluate(() => getTrip().has('college-of-charleston') && document.querySelector('#pt-out [data-trip-add="college-of-charleston"]').textContent);
  out.tripNav = await page.evaluate(() => document.querySelector('#appnav .navbtn[data-nav="trip"]').textContent);
  // weekly email switch
  await page.evaluate(() => document.querySelector('[data-pw-toggle]').click()); await page.waitForTimeout(300);
  out.weeklyWrite = await page.evaluate(() => JSON.stringify(window.__writes.filter(w => w.table === 'reminder_prefs').map(w => ({ op: w.op, on: w.p.pulse_weekly, hasEmailOn: 'email_on' in w.p }))));
  out.weeklyAfter = await page.evaluate(() => (document.querySelector('.pt-weekly') || {}).innerText || '');
  // nudge opens Deadlines
  if (await page.$('#pt-out .pt-nudge')) { await page.evaluate(() => document.querySelector('#pt-out .pt-nudge').click()); await page.waitForTimeout(400);
    out.nudgeOpensDeadlines = await page.evaluate(() => !document.getElementById('v-deadlines').classList.contains('hidden')); }
  // school page: nudge + visit day + add to trips
  await page.evaluate(() => goto('pulse')); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.pt-feed [data-pulse-open="sc-166683"]').click()); await page.waitForTimeout(1600);
  out.detailVisit = await page.evaluate(() => [...document.querySelectorAll('#pulse .pt-visit')].map(x => x.innerText.replace(/\s+/g, ' ')));
  out.detailFirstEvent = await page.evaluate(() => { const h = [...document.querySelectorAll('#pulse .pulse-item')].map(x => x.innerText.replace(/\s+/g, ' ')); return h.filter(t => /tour|concert/i.test(t)).slice(0, 2); });
  out.detailAudit = await audit(page, '#pulse');
  await page.locator('#pulse').screenshot({ path: `${SHOTS}${label}-detail-pulse.png` });
  out.clemsonNudge = await page.evaluate(() => { openDetail('sc-217882', 'board'); return new Promise(r => setTimeout(() => r((document.querySelector('#pulse .pt-nudge') || {}).innerText || 'none'), 600)); });
  out.errors = log.pageerr; out.consoleErrors = log.console.filter(c => !/favicon|ERR_|Failed to load resource/.test(c));
  await b.close(); return out;
}
fs.mkdirSync(SHOTS, { recursive: true });
R.desktop = await run({ width: 1280, height: 900 }, 'desktop');
R.phone = await run({ width: 390, height: 844 }, 'phone');
R.dark = await run({ width: 390, height: 844 }, 'phone-dark', true);
for (const [k, o] of Object.entries(R)) {
  ok[k + '.pulseTabInNav'] = o.navTabs.some(t => /Pulse/.test(t)) && o.navTabs.indexOf(o.navTabs.find(t => /Pulse/.test(t))) === o.navTabs.indexOf('Deadlines') + 1;
  ok[k + '.navShowsNewCount'] = o.navTabs.some(t => /Pulse · 4/.test(t));
  ok[k + '.notOnHomePage'] = o.boardHasPulseBox === false;
  ok[k + '.cardDots'] = o.cardBadges.includes('sc-166683:3 new') && o.cardBadges.includes('college-of-charleston:1 new');
  ok[k + '.digestIncludesEvents'] = o.digestAsksForEvents;
  ok[k + '.feedNewestFirst'] = o.feedOrder[0].startsWith('MIT engineers') && o.feedOrder.length === 5;
  ok[k + '.visitDays'] = o.visits.length === 2 && /Campus tour/.test(o.visits[0]) && /Open House/.test(o.visits[1]);
  ok[k + '.notConnectedListed'] = /University of Vermont/.test(o.notConnected) && /Clemson/.test(o.notConnected);
  ok[k + '.filterBySchool'] = o.filtered.length === 1 && /Charleston/.test(o.filtered[0]);
  ok[k + '.addToTrips'] = o.tripAdded === '✓ In Trips' && /Trips · 1/.test(o.tripNav);
  ok[k + '.weeklySwitch'] = /Turn on/.test(o.weeklyCard) && o.weeklyWrite === '[{"op":"upsert","on":true,"hasEmailOn":false}]' && /Turn off/.test(o.weeklyAfter);
  ok[k + '.detailVisitDayFirst'] = o.detailVisit.length === 1 && /Visit day/.test(o.detailVisit[0]) && /Add to Trips|In Trips/.test(o.detailVisit[0]);
  ok[k + '.noDeadlinesOnPulse'] = o.nudges.length === 0 && !/Deadlines coming up/.test(o.tabText) && o.clemsonNudge === 'none';
  ok[k + '.noPageErrors'] = !o.errors.length;
  ok[k + '.noSidewaysScroll'] = !o.audit.overflowX && !o.detailAudit.overflowX;
  ok[k + '.noBadText'] = !o.audit.bad.length && !o.detailAudit.bad.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./pulse-tab-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
srv.close();
