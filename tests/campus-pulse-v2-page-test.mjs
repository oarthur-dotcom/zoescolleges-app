// Campus Pulse v2 — page test (headless browser, fake backend). Run: node tests/campus-pulse-v2-page-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f22/site', SHOTS = '/tmp/claude-0/f22/';
fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8794);
const ago = d => new Date(Date.now() - d * 864e5).toISOString(), ahead = d => new Date(Date.now() + d * 864e5).toISOString();
const MIT = { id: 'sc-166683', source: 'news.mit.edu', studentSite: 'https://thetech.com',
  meter: { recent30: 14, newest: ago(0.3), events: 3, level: 'very-active' },
  sections: {
    news: [
      { title: 'MIT engineers design a battery that charges in five minutes', link: 'https://news.mit.edu/a', date: ago(0.3), topic: 'Research' },
      { title: 'Beavers hockey opens season with home win', link: 'https://news.mit.edu/b', date: ago(2), topic: 'Sports' },
      { title: 'Students celebrate Independent Activities Period kickoff', link: 'https://news.mit.edu/c', date: ago(4), topic: 'Campus life' },
      { title: 'New exhibit at the MIT Museum explores robots in art', link: 'https://news.mit.edu/d', date: ago(8), topic: 'Arts' },
      { title: 'Institute announces expanded financial aid for families earning under $200k', link: 'https://news.mit.edu/e', date: ago(12), topic: 'Admissions & aid' }],
    admissions: [{ title: 'Early action: what we look for in your essays', link: 'https://mitadmissions.org/blogs/x', date: ago(1), topic: 'Admissions & aid' }],
    events: [
      { title: 'Campus tour and information session', link: 'https://calendar.mit.edu/event/tour', date: ahead(1), where: 'Lobby 7', allDay: false },
      { title: 'Fall concert: MIT Symphony Orchestra', link: 'https://calendar.mit.edu/event/sym', date: ahead(4), where: 'Kresge Auditorium', allDay: false },
      { title: 'Hackathon weekend', link: 'https://calendar.mit.edu/event/hack', date: ahead(9), where: null, allDay: true }] } };
const CHS = { id: 'college-of-charleston', source: 'charleston.edu', meter: { recent30: 3, newest: ago(2), events: 0, level: 'steady' },
  sections: { news: [{ title: 'CofC breaks ground on new science center', link: 'https://charleston.edu/news/a', date: ago(2), topic: 'Research' }] } };
const R = {}; const ok = {};
async function run(vp, label, dark) {
  const b = await launch(); const { ctx, page, log } = await newPage(b, vp, { plan: 'family' });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/net-price-by-income/, r => r.fulfill({ status: 404, body: '' }));
  let auth = null, digestCalls = 0;
  await page.route('**/.netlify/functions/campus-pulse*', r => { auth = r.request().headers()['authorization'] || null; const u = new URL(r.request().url());
    if (u.searchParams.has('ids')) { digestCalls++; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schools: {
      'sc-166683': { top: [{ ...MIT.sections.news[0], kind: 'news' }, { ...MIT.sections.admissions[0], kind: 'admissions' }, { ...MIT.sections.news[1], kind: 'news' }], meter: MIT.meter },
      'college-of-charleston': { top: [{ ...CHS.sections.news[0], kind: 'news' }], meter: CHS.meter } }, pending: [], none: ['university-of-vermont'] }) }); }
    const id = u.searchParams.get('id');
    if (id === 'sc-166683') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(MIT) });
    if (id === 'college-of-charleston') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(CHS) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], sections: {}, reason: 'no-feed' }) }); });
  await page.goto('http://localhost:8794/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const out = {};
  out.boardStrip = await page.evaluate(() => { const el = document.querySelector('#board-pulse .bpulse'); return el ? el.innerText.replace(/\s+/g, ' ').slice(0, 400) : null; });
  out.badges = await page.evaluate(() => [...document.querySelectorAll('#schools .pulse-new')].map(x => x.closest('[data-pulse-open]').dataset.pulseOpen + ':' + x.textContent));
  // #34: the board strip moved to the Pulse tab (tests/pulse-tab-page-test.mjs); the board keeps the card badges.
  // re-rendering the board must not refetch (10-minute cache)
  await page.evaluate(() => { renderBoard(); renderBoard(); }); await page.waitForTimeout(300);
  out.digestCalls = digestCalls;
  // the card's Pulse link opens the school page at its Pulse
  await page.evaluate(() => document.querySelector('#schools [data-pulse-open="sc-166683"]').click()); await page.waitForTimeout(1600);
  out.openedDetailAtPulse = await page.evaluate(() => { const el = document.getElementById('pulse'); const rc = el.getBoundingClientRect(); return !document.getElementById('v-detail').classList.contains('hidden') && rc.top < innerHeight && rc.bottom > 0; });
  out.meter = await page.evaluate(() => document.querySelector('[data-pulse-meter]').innerText.replace(/\s+/g, ' '));
  out.tabs = await page.evaluate(() => [...document.querySelectorAll('.ptab')].map(t => t.innerText.replace(/\s+/g, ' ')));
  out.allList = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-news] .pulse-item')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 90)));
  out.studentPaperLink = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-voices] a')].map(a => a.textContent.trim() + ' -> ' + a.href).find(t => /student paper/.test(t)) || null);
  out.pulseOrder = await page.evaluate(() => { const b = document.getElementById('detail-body').innerHTML; return { pulseBeforeTours: b.indexOf('id="pulse"') < b.indexOf('Official site') || b.indexOf('Official site') < 0 }; });
  await page.locator('#pulse').screenshot({ path: `${SHOTS}${label}-detail-pulse-all.png` });
  await page.click('.ptab[data-ptab="events"]'); await page.waitForTimeout(150);
  out.eventsTab = await page.evaluate(() => [...document.querySelectorAll('[data-pulse-news] .pulse-item')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 90)));
  await page.locator('#pulse').screenshot({ path: `${SHOTS}${label}-detail-pulse-events.png` });
  await page.click('.ptab[data-ptab="all"]'); await page.waitForTimeout(100);
  await page.click('[data-pulse-more]'); await page.waitForTimeout(100);
  out.showMoreCount = await page.evaluate(() => document.querySelectorAll('[data-pulse-news] .pulse-item').length);
  out.loginTokenSent = !!auth;
  out.topics = await page.evaluate(() => document.querySelector('[data-pulse-topics]').innerText.trim());
  await page.click('.pask'); await page.waitForTimeout(400);
  out.askZoe = await page.evaluate(() => ({ view: !document.getElementById('v-zoe').classList.contains('hidden'), text: document.getElementById('ztab-in').value }));
  // a school without feeds
  await page.evaluate(() => openDetail('university-of-vermont')); await page.waitForTimeout(900);
  out.noFeed = await page.evaluate(() => document.querySelector('[data-pulse-news]').innerText.trim() + ' | ' + document.querySelector('[data-pulse-meter]').innerText.trim());
  out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  out.nicheAnywhere = await page.evaluate(() => /niche/i.test(document.documentElement.innerHTML));
  out.pageErrors = log.pageerr;
  await b.close(); return out;
}
R.phone = await run({ width: 390, height: 844 }, 'phone');
R.desktop = await run({ width: 1440, height: 900 }, 'desktop');
R.phoneDark = await run({ width: 390, height: 844 }, 'phone-dark', true);
for (const [k, o] of Object.entries(R)) {
  ok[k + ':boardStripMovedToPulseTab'] = o.boardStrip === null;
  ok[k + ':badges'] = o.badges.some(b => b.startsWith('sc-166683:3 new')) && o.badges.some(b => b.startsWith('college-of-charleston:1 new'));
  ok[k + ':oneDigestRequest'] = o.digestCalls === 1;
  ok[k + ':opensAtPulse'] = o.openedDetailAtPulse;
  ok[k + ':meter'] = /Very active/.test(o.meter) && /14 stories/.test(o.meter) && /3 events coming up/.test(o.meter);
  ok[k + ':tabs'] = o.tabs.join('|').replace(/\d/g, '') === 'All|News|Admissions|Events';
  ok[k + ':newestFirstMixed'] = /MIT engineers/.test(o.allList[0]) && /Early action/.test(o.allList[1]) && o.allList.some(t => /Campus tour/.test(t));
  ok[k + ':events'] = o.eventsTab.length === 3 && /Lobby 7/.test(o.eventsTab[0]);
  ok[k + ':showMore'] = o.showMoreCount === 9;
  ok[k + ':studentPaper'] = /thetech\.com/.test(o.studentPaperLink || '');
  ok[k + ':noFeedFriendly'] = /haven't connected this school's feeds yet/.test(o.noFeed);
  ok[k + ':topics'] = /Talking about:/.test(o.topics) && /Research/.test(o.topics);
  ok[k + ':askZoePrefillsOnly'] = o.askZoe.view && /What's going on at Massachusetts Institute of Technology lately\? Recent headlines: "MIT engineers/.test(o.askZoe.text);
  ok[k + ':noOverflow'] = !o.overflowX; ok[k + ':noNiche'] = !o.nicheAnywhere; ok[k + ':noErrors'] = !o.pageErrors.length; ok[k + ':token'] = o.loginTokenSent;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./campus-pulse-v2-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
srv.close();
